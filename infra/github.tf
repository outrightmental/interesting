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

# The GA4 measurement ID the deploy pastes into site/js/analytics.js on its way to the bucket, so
# that /site carries no measurement ID of its own and a fork or a local copy of it measures nothing.
# Delivered as a secret for the same reason as the four above: one place owns it, and the deploy
# cannot drift from the property it reports to.
resource "github_actions_secret" "ga_measurement_id" {
  repository      = github_repository.interesting.name
  secret_name     = "GA_MEASUREMENT_ID"
  plaintext_value = local.ga_measurement_id
}

# The Clickadu zones the deploy pastes into site/js/analytics.js on its way to the bucket (issue
# #110), owned here for the same reason the measurement ID is: one place owns them, and /site
# carries no publisher identifier of its own. A zone left empty in locals.tf sets no secret at all,
# and the deploy publishes the site without that format, so this applies cleanly before any zone
# exists and a zone is switched off again by emptying it.
resource "github_actions_secret" "clickadu" {
  for_each = {
    for name, value in {
      CLICKADU_BANNER_SRC       = local.clickadu_banner_src
      CLICKADU_IN_PAGE_PUSH_SRC = local.clickadu_in_page_push_src
    } : name => value if value != ""
  }

  repository      = github_repository.interesting.name
  secret_name     = each.key
  plaintext_value = each.value
}
