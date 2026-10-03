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

  # GitHub Pages still publishes /site in parallel with CloudFront while the
  # AWS deploy settles in. Managing it here is what the README used to ask for
  # by hand (Settings → Pages → Source: GitHub Actions); removing this block
  # is how the Pages site gets retired. See ../README.md#hosting.
  pages {
    build_type = "workflow"
  }

  archive_on_destroy = true
}
