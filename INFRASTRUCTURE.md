# Zepprz AWS infrastructure

The Terraform configuration provisions the AWS topology shown in the supplied architecture: Route 53 (optional custom domain), CloudFront, WAF, a multi-AZ VPC, an internet-facing ALB, private ECS Fargate tasks, private Multi-AZ PostgreSQL and Redis, ECR, CloudWatch, SNS, and an encrypted private S3 backup/export bucket.

The existing application is a static browser demo. It stores demo bookings in browser local storage and has no API, database, or Redis client. RDS and Redis are provisioned as requested, but the application will not use them until backend services and their application configuration are implemented. The S3 bucket is available for exports; this frontend does not upload files to it.

## Prerequisites

- Terraform 1.10 or newer, AWS CLI, Docker, and Windows PowerShell.
- AWS credentials configured locally with permission to create the listed services, IAM roles, and the CloudFront-scope WAF resources in `us-east-1`.
- For a custom domain, an existing public Route 53 hosted zone and its zone ID. Leave both domain variables blank to use the CloudFront hostname.

Copy `terraform.tfvars.example` to `terraform.tfvars` and adjust values as needed. Keep the AWS region the same in `terraform.tfvars`, `Setup-TerraformState.ps1`, and `Deploy.ps1`. Do not commit `terraform.tfvars`, Terraform state, generated backend configuration, or plan files: they can contain sensitive infrastructure data.

## First deployment

From PowerShell in this project folder, create and initialize the protected S3 remote-state bucket:

```powershell
.\Setup-TerraformState.ps1 -Region ap-southeast-1
```

This setup creates or secures only the Terraform state bucket (S3 public access blocked, encryption and versioning enabled, TLS-only policy, native state locking). It asks for confirmation before making that bucket. It does **not** create the application VPC or deploy the app.

After checking `terraform.tfvars.example` values and AWS account/region, run:

```powershell
.\Deploy.ps1 -Region ap-southeast-1
```

The deployment script shows the active AWS account, asks `CREATE-ECR` before creating the ECR repository (if needed), builds and pushes a uniquely tagged image, then prints a complete Terraform plan. It applies that exact plan only if you type `APPLY`. If you decline, the reviewed plan remains as an ignored `deploy-<tag>.tfplan` file.

CloudFront distribution deployment can take several minutes. If you set `alert_emails`, each recipient must confirm the SNS subscription email. `terraform output application_url` prints the URL after a successful deployment.

For a manual deployment, run `terraform init -backend-config=backend.generated.hcl`, create the ECR repository with `terraform apply -target=aws_ecr_repository.app`, build and push an image tagged with the intended release version, then run `terraform plan -var="image_tag=<tag>" -out=deploy.tfplan` and inspect it before `terraform apply deploy.tfplan`.

## Operational notes

- CloudFront redirects viewer HTTP to HTTPS and applies AWS managed WAF rules plus an IP rate limit. Requests to the ALB are restricted to CloudFront origin-facing addresses and require a secret origin header.
- CloudFront caches the unversioned demo assets for up to five minutes by default. Invalidate the distribution after an urgent release if needed.
- CloudFront-to-ALB traffic uses HTTP in this configuration, even when a viewer domain is configured. Add a separate origin hostname, matching ALB TLS certificate, and HTTPS listener before handling sensitive production traffic.
- ECS tasks run without public IPs, and PostgreSQL/Redis accept inbound connections only from the ECS task security group. RDS credentials are managed in Secrets Manager; the Redis token and CloudFront origin header are sensitive Terraform state values.
- NAT Gateways in each AZ, Multi-AZ RDS, Redis replicas, ALB, CloudFront, and WAF have ongoing AWS charges. Review the plan and AWS pricing before applying.
- The state bucket is separate from the application stack. Preserve it and its Terraform state when destroying application resources.
- To destroy the stack, first disable `enable_deletion_protection` and apply that change. RDS retains a final snapshot and the S3 bucket must be empty before deletion.