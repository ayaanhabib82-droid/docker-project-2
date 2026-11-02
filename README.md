# Zepprz Cab App

A static cab-booking demo and Terraform configuration for a future AWS deployment.

## Current status

- The app is a browser-only prototype. Bookings are stored in local browser storage; there is no production API or database integration.
- Terraform describes the AWS infrastructure, but publishing this repository does **not** create or deploy AWS resources.
- Review the AWS costs and setup/deployment steps before deploying.

## Project files

- `index.html`, `styles.css`, and `app.js` — browser demo.
- `Dockerfile` — local Nginx container.
- `main.tf`, `variables.tf`, and `outputs.tf` — AWS infrastructure.
- `Setup-TerraformState.ps1` — prepares the protected remote Terraform state bucket when you are ready.
- `Deploy.ps1` — publishes the container and offers a reviewed, confirmation-gated Terraform deployment.
- `terraform.tfvars.example` — example settings. Copy this to `terraform.tfvars` and customize it before deployment.
- `INFRASTRUCTURE.md` — prerequisites, deployment steps, security notes, and operational details.

## Deployment

Follow [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) when you are ready. The setup and deployment scripts require explicit confirmation before creating the state bucket, ECR repository, or application infrastructure.
