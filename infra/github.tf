# Repository Actions secrets, set from this project's own resources so the
# deploy workflow can never drift from the infrastructure it deploys to.

resource "github_actions_secret" "aws_access_key_id" {
  repository      = github_repository.interesting.name
  secret_name     = "AWS_ACCESS_KEY_ID"
  plaintext_value = aws_iam_access_key.deploy.id
}

resource "github_actions_secret" "aws_secret_access_key" {
  repository      = github_repository.interesting.name
  secret_name     = "AWS_SECRET_ACCESS_KEY"
  plaintext_value = aws_iam_access_key.deploy.secret
}

resource "github_actions_secret" "aws_s3_bucket" {
  repository      = github_repository.interesting.name
  secret_name     = "AWS_S3_BUCKET"
  plaintext_value = module.website.bucket
}

resource "github_actions_secret" "aws_cloudfront_distribution_id" {
  repository      = github_repository.interesting.name
  secret_name     = "AWS_CLOUDFRONT_DISTRIBUTION_ID"
  plaintext_value = module.website.cdn_id
}
