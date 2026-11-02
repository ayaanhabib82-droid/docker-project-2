[CmdletBinding()]
param(
  [string]$ProjectName = "zepprz",
  [string]$Environment = "prod",
  [string]$Region = "ap-southeast-1"
)

$ErrorActionPreference = "Stop"

foreach ($commandName in @("aws", "terraform")) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$commandName' was not found in PATH."
  }
}

if ($ProjectName -notmatch "^[a-z][a-z0-9-]{1,14}$") {
  throw "ProjectName must be 2-15 lowercase letters, digits, or hyphens and start with a letter."
}
if ($Environment -notmatch "^[a-z][a-z0-9-]{1,9}$") {
  throw "Environment must be 2-10 lowercase letters, digits, or hyphens and start with a letter."
}

$terraformVersion = (& terraform version -json | ConvertFrom-Json).terraform_version
if ($LASTEXITCODE -ne 0 -or [version]$terraformVersion -lt [version]"1.10.0") {
  throw "Terraform 1.10 or newer is required for S3 state locking."
}

$accountOutput = & aws sts get-caller-identity --query Account --output text
$accountExitCode = $LASTEXITCODE
$accountId = "$accountOutput".Trim()
if ($accountExitCode -ne 0 -or $accountId -notmatch "^\d{12}$") {
  throw "Could not identify the active AWS account. Configure AWS credentials and try again."
}

$bucketName = "$ProjectName-$Environment-tfstate-$accountId-$Region"
if ($bucketName.Length -gt 63) {
  throw "Generated Terraform state bucket name exceeds S3's 63-character limit."
}

Write-Host "AWS account: $accountId"
Write-Host "Region:      $Region"
Write-Host "State bucket: $bucketName"
Write-Host "This creates or secures only the Terraform state bucket; it does not deploy the application."
if ((Read-Host "Type CREATE-STATE to continue") -cne "CREATE-STATE") {
  throw "State bucket setup cancelled."
}

$headResult = & aws s3api head-bucket --bucket $bucketName --expected-bucket-owner $accountId --region $Region 2>$null
$headExitCode = $LASTEXITCODE
if ($headExitCode -ne 0) {
  if ($Region -eq "us-east-1") {
    & aws s3api create-bucket --bucket $bucketName --region $Region
  } else {
    & aws s3api create-bucket --bucket $bucketName --region $Region --create-bucket-configuration "LocationConstraint=$Region"
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create the state bucket. Check the AWS error, permissions, and bucket name."
  }
} else {
  Write-Host "Using the existing state bucket owned by this AWS account."
}

& aws s3api put-public-access-block `
  --bucket $bucketName `
  --expected-bucket-owner $accountId `
  --region $Region `
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
if ($LASTEXITCODE -ne 0) { throw "Could not enable S3 Block Public Access." }

& aws s3api put-bucket-ownership-controls `
  --bucket $bucketName `
  --expected-bucket-owner $accountId `
  --region $Region `
  --ownership-controls '{"Rules":[{"ObjectOwnership":"BucketOwnerEnforced"}]}'
if ($LASTEXITCODE -ne 0) { throw "Could not enforce bucket-owner object ownership." }

& aws s3api put-bucket-versioning `
  --bucket $bucketName `
  --expected-bucket-owner $accountId `
  --region $Region `
  --versioning-configuration Status=Enabled
if ($LASTEXITCODE -ne 0) { throw "Could not enable state bucket versioning." }

& aws s3api put-bucket-encryption `
  --bucket $bucketName `
  --expected-bucket-owner $accountId `
  --region $Region `
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
if ($LASTEXITCODE -ne 0) { throw "Could not enable default S3 encryption." }

$policyPath = Join-Path $env:TEMP "$bucketName-policy.json"
$policy = @{
  Version   = "2012-10-17"
  Statement = @(
    @{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = @("arn:aws:s3:::$bucketName", "arn:aws:s3:::$bucketName/*")
      Condition = @{
        Bool = @{
          "aws:SecureTransport" = "false"
        }
      }
    }
  )
} | ConvertTo-Json -Depth 8

try {
  Set-Content -Path $policyPath -Value $policy -Encoding ASCII
  & aws s3api put-bucket-policy `
    --bucket $bucketName `
    --expected-bucket-owner $accountId `
    --region $Region `
    --policy "file://$policyPath"
  if ($LASTEXITCODE -ne 0) { throw "Could not apply the state bucket TLS-only policy." }
} finally {
  Remove-Item -LiteralPath $policyPath -ErrorAction SilentlyContinue
}

$backendPath = Join-Path $PSScriptRoot "backend.generated.hcl"
$backendConfig = @"
bucket       = "$bucketName"
key          = "$ProjectName/$Environment/terraform.tfstate"
region       = "$Region"
encrypt      = true
use_lockfile = true
"@
Set-Content -Path $backendPath -Value $backendConfig -Encoding ASCII

Push-Location $PSScriptRoot
try {
  & terraform init -migrate-state "-backend-config=$backendPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Terraform backend initialization failed. State bucket security is configured; review the error before retrying."
  }
} finally {
  Pop-Location
}

Write-Host "Remote Terraform state is ready. No application infrastructure was deployed."
