# The repository itself is repo-as-code. It pre-existed this configuration,
# so the first apply adopts it via the import block below instead of creating
# it; from then on its settings are managed here and can never drift.

import {
  to = github_repository.interesting
  id = "interesting"
}

resource "github_repository" "interesting" {
  name         = local.github_repo
  description  = "iterate a more interesting website"
  homepage_url = "https://${local.domain}"

  visibility = "public"

  has_issues      = true
  has_discussions = false
  has_projects    = false
  has_wiki        = false

  allow_merge_commit     = false
  allow_squash_merge     = true
  allow_rebase_merge     = false
  delete_branch_on_merge = true

  vulnerability_alerts = true

  # There is deliberately no `pages` block: GitHub Pages is retired, and the site
  # is served from S3 behind CloudFront. Leaving Pages out of this configuration
  # is what asks the provider to turn the repository's Pages site off; check
  # Settings → Pages once after the first apply, and set its source to None by
  # hand if anything of it is still there.
  archive_on_destroy = true
}
