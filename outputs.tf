output "application_url" {
  description = "HTTPS application URL; use the configured domain when supplied."
  value       = var.domain_name == "" ? "https://${aws_cloudfront_distribution.site.domain_name}" : "https://${var.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.site.id
}

output "ecr_repository_url" {
  description = "ECR repository URL for publishing the Zepprz container image."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.application.name
}

output "rds_endpoint" {
  description = "Private PostgreSQL endpoint; reachable only from the ECS application security group."
  value       = aws_db_instance.main.address
}

output "rds_master_secret_arn" {
  description = "Secrets Manager ARN containing the AWS-managed RDS master credentials."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "redis_primary_endpoint" {
  description = "Private Redis primary endpoint; reachable only from the ECS application security group."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "backup_bucket_name" {
  description = "Private, encrypted S3 bucket for application exports and backups."
  value       = aws_s3_bucket.backups.id
}

output "alerts_topic_arn" {
  description = "SNS topic ARN for infrastructure alarms."
  value       = aws_sns_topic.alerts.arn
}