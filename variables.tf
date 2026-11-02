variable "aws_region" {
  description = "AWS region for the VPC and application resources."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Lowercase project prefix used in AWS resource names."
  type        = string
  default     = "zepprz"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,14}$", var.project_name))
    error_message = "project_name must be 2-15 lowercase letters, digits, or hyphens and start with a letter."
  }
}

variable "environment" {
  description = "Deployment environment, such as prod or staging."
  type        = string
  default     = "prod"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,9}$", var.environment))
    error_message = "environment must be 2-10 lowercase letters, digits, or hyphens and start with a letter."
  }
}

variable "domain_name" {
  description = "Optional fully qualified domain name in an existing public Route 53 hosted zone."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Existing public Route 53 hosted zone ID; required when domain_name is set."
  type        = string
  default     = ""
}

variable "availability_zone_count" {
  description = "Number of Availability Zones for the multi-AZ deployment."
  type        = number
  default     = 2

  validation {
    condition     = var.availability_zone_count >= 2 && var.availability_zone_count <= 3
    error_message = "availability_zone_count must be 2 or 3."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR range for the application VPC; use a range from /16 through /20."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr)) ? (tonumber(split("/", var.vpc_cidr)[1]) >= 16 && tonumber(split("/", var.vpc_cidr)[1]) <= 20) : false
    error_message = "vpc_cidr must be a valid IPv4 CIDR with a prefix between /16 and /20."
  }
}

variable "image_tag" {
  description = "Existing tag in the Terraform-managed ECR repository used by ECS."
  type        = string
  default     = "latest"
}

variable "app_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.app_cpu)
    error_message = "app_cpu must be a supported Fargate CPU value: 256, 512, 1024, 2048, or 4096."
  }
}

variable "app_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Initial number of ECS tasks; keep within minimum_capacity and maximum_capacity."
  type        = number
  default     = 2
}

variable "minimum_capacity" {
  description = "Minimum ECS task count for autoscaling."
  type        = number
  default     = 2
}

variable "maximum_capacity" {
  description = "Maximum ECS task count for autoscaling."
  type        = number
  default     = 6
}

variable "db_instance_class" {
  description = "RDS PostgreSQL Multi-AZ instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Initial encrypted RDS storage in GiB."
  type        = number
  default     = 20
}

variable "database_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "zepprz"
}

variable "database_username" {
  description = "RDS master username; its password is managed by AWS Secrets Manager."
  type        = string
  default     = "zepprz_admin"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type, with one primary and one replica by default."
  type        = string
  default     = "cache.t4g.micro"
}

variable "waf_rate_limit" {
  description = "Maximum requests per IP per five-minute WAF evaluation window."
  type        = number
  default     = 2000

  validation {
    condition     = var.waf_rate_limit >= 10 && var.waf_rate_limit <= 2000000000
    error_message = "waf_rate_limit must be between 10 and 2,000,000,000."
  }
}

variable "alert_emails" {
  description = "Email addresses subscribed to infrastructure alarms; each recipient must confirm the SNS subscription."
  type        = set(string)
  default     = []
}

variable "enable_deletion_protection" {
  description = "Protect the load balancer and database from accidental deletion."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags applied to resources."
  type        = map(string)
  default     = {}
}