output "site_url" {
  description = "Where the interesting website lives"
  value       = "https://${local.domain}/"
}

output "route53_name_servers" {
  description = "The hosted zone's nameservers — give these four to the registrar for makeitmoreinteresting.com"
  value       = aws_route53_zone.primary.name_servers
}

output "route53_zone_id" {
  description = "The makeitmoreinteresting.com hosted zone, owned by this project"
  value       = aws_route53_zone.primary.zone_id
}

output "repository" {
  description = "The Terraform-managed GitHub repository"
  value       = github_repository.interesting.html_url
}

output "s3_bucket" {
  description = "Static website S3 bucket"
  value       = module.website.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for makeitmoreinteresting.com"
  value       = module.website.cdn_id
}

output "cloudfront_domain_name" {
  description = "The distribution's *.cloudfront.net domain (aliased by Route53)"
  value       = module.website.domain_name
}

output "deploy_access_key_id" {
  description = "Deploy IAM user AWS Access Key ID (also set as a repo Actions secret)"
  value       = aws_iam_access_key.deploy.id
  sensitive   = true
}

output "deploy_secret_access_key" {
  description = "Deploy IAM user AWS Secret Access Key (also set as a repo Actions secret)"
  value       = aws_iam_access_key.deploy.secret
  sensitive   = true
}
