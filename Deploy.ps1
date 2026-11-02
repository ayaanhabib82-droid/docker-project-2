[CmdletBinding()]
param(
  [string]$ImageTag = "",
  [string]$Region = "ap-southeast-1",
  [switch]$ConfirmCreateEcr,
  [switch]$PlanOnly
)

$ErrorActionPreference = "Stop"

foreach ($commandName in @("aws", "docker", "terraform")) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$commandName' was not found in PATH."
  }
}

if (-not (Test-Path (Join-Path $PSScriptRoot "backend.generated.hcl"))) {
  throw "Run .\Setup-TerraformState.ps1 first to create and initialize the protected remote state bucket."
}

$dockerVersion = & docker info --format '{{.ServerVersion}}' 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not ready: $dockerVersion"
}

if ($ImageTag -eq "") {
  $ImageTag = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
}
if ($ImageTag -notmatch "^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$") {
  throw "ImageTag must be a valid Docker tag with at most 128 letters, digits, underscores, dots, or hyphens."
}

$accountOutput = & aws sts get-caller-identity --query Account --output text
$accountExitCode = $LASTEXITCODE
$accountId = "$accountOutput".Trim()
if ($accountExitCode -ne 0 -or $accountId -notmatch "^\d{12}$") {
  throw "Could not identify the active AWS account. Configure AWS credentials and try again."
}

Write-Host "AWS account: $accountId"
Write-Host "AWS region:  $Region"
Write-Host "Image tag:   $ImageTag"
Write-Host "This script will publish a container image and, after a separate confirmation, apply the Terraform plan."

Push-Location $PSScriptRoot
try {
  $repositoryOutput = & terraform output -raw ecr_repository_url 2>$null
  $outputExitCode = $LASTEXITCODE
  $repository = "$repositoryOutput".Trim()

  if ($outputExitCode -ne 0 -or $repository -notmatch "^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/") {
    if (-not $ConfirmCreateEcr -and (Read-Host "Type CREATE-ECR to create the ECR repository in account $accountId") -cne "CREATE-ECR") {
      throw "ECR creation cancelled."
    }

    & terraform apply -auto-approve "-target=aws_ecr_repository.app" "-var=image_tag=$ImageTag"
    if ($LASTEXITCODE -ne 0) {
      throw "ECR repository creation failed. No container was published."
    }

    $repository = (& terraform output -raw ecr_repository_url).Trim()
    if ($LASTEXITCODE -ne 0 -or $repository -notmatch "^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/") {
      throw "Terraform did not return a valid ECR repository URL."
    }
  }

  $repositoryAccount = ($repository -split "\.")[0]
  if ($repositoryAccount -ne $accountId) {
    throw "Configured AWS credentials target account $accountId but Terraform ECR output belongs to account $repositoryAccount."
  }
  $repositoryRegion = ($repository -split "\.")[3]
  if ($repositoryRegion -ne $Region) {
    throw "ECR repository is in $repositoryRegion but Deploy.ps1 was given region $Region. Use the same region as aws_region in terraform.tfvars."
  }

  $registry = ($repository -split "/", 2)[0]
  $loginPassword = & aws ecr get-login-password --region $Region
  if ($LASTEXITCODE -ne 0) {
    throw "Could not get an ECR login token for region $Region."
  }
  $loginPassword | & docker login --username AWS --password-stdin $registry
  $loginPassword = $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker could not authenticate to $registry."
  }

  $image = "${repository}:$ImageTag"
  & docker build --tag $image $PSScriptRoot
  if ($LASTEXITCODE -ne 0) { throw "Docker image build failed." }

  & docker push $image
  if ($LASTEXITCODE -ne 0) { throw "Docker image push failed." }

  $planPath = Join-Path $PSScriptRoot "deploy-$ImageTag.tfplan"
  & terraform plan "-var=image_tag=$ImageTag" "-out=$planPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Terraform plan failed. The image was published, but application infrastructure was not applied."
  }

  if ($PlanOnly) {
    Write-Host "Plan saved to $planPath. No application infrastructure was applied."
    return
  }

  Write-Host "Review the plan above. It can create billable AWS resources."
  if ((Read-Host "Type APPLY to apply this exact Terraform plan") -cne "APPLY") {
    Write-Host "Plan saved to $planPath. No infrastructure changes were applied."
    return
  }

  & terraform apply $planPath
  if ($LASTEXITCODE -ne 0) {
    throw "Terraform apply failed. Review the AWS/Terraform error and state before retrying."
  }

  & terraform output application_url
  if ($LASTEXITCODE -ne 0) {
    throw "Infrastructure was applied, but Terraform could not read the application URL output."
  }
} finally {
  Pop-Location
}
