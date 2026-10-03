# infra — interesting.outright.io

Self-contained Terraform project for the *interesting* website, built the same way
[BoardingFlow/infra](https://github.com/outrightmental/BoardingFlow/tree/main/infra) is (which
follows FishCareers', which follows outrightmental.com's, which follows TransformationLab's).
One project owns the whole stack for one property — including the GitHub repository it lives in.

## What this project owns

| File | Resources | Purpose |
| ---- | --------- | ------- |
| `repo.tf` | `github_repository.interesting` | The repository itself — `outrightmental/interesting` is repo-as-code: name, visibility, merge settings, Pages source, all here. It pre-existed this configuration, so the first apply **adopts** it via an import block; `archive_on_destroy` means a destroy archives rather than deletes it. |
| `website.tf` + `modules/website` | S3 bucket + CloudFront distribution, ACM certificate + DNS validation, A/AAAA alias records | The static site at https://interesting.outright.io/. The module is copied from BoardingFlow/infra. |
| `iam-deploy.tf` | `interesting-outright-io-deploy` IAM user + key + policy | Dedicated deploy credentials for the GitHub Actions workflow (S3 sync + CloudFront invalidation), scoped to exactly this bucket and this distribution. |
| `github.tf` | Repository Actions secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID` — set from this project's own resources so the deploy can never drift from the infrastructure. A single apply rotates the deploy credentials end to end. |
| `data.tf` | *(read-only)* | The `outright.io` hosted zone stays owned by the shared infra state; this project only reads its zone id and writes the `interesting.` records + cert-validation records into it. The AWS account id is read from the caller rather than written down. |

## Usage

Terraform here is applied by hand, locally — no workflow in this repository runs
`terraform plan` or `terraform apply`, and none should. The infrastructure changes when the
studio decides it does, not when a branch merges. The only Terraform in CI is
`fmt -check` + `validate` in [`test.yml`](../.github/workflows/test.yml), which reads no state
and needs no credentials.

```bash
export GITHUB_TOKEN=$(gh auth token)   # for the github provider (repo + secrets)
terraform -chdir=infra init            # add -reconfigure if a previous init pointed elsewhere
terraform -chdir=infra plan
terraform -chdir=infra apply
```

PowerShell equivalent for the token: `$env:GITHUB_TOKEN = (gh auth token)`.

State is kept in the shared S3 backend under the `interesting.outright.io` key (`main.tf`),
independent of every other property's state.

## First-time order

Unlike a fresh bootstrap, the repository and its content already exist, so the first apply
adopts rather than creates the repo:

1. `terraform apply` from a local checkout — **imports the existing repo**, creates the bucket,
   distribution, certificate, DNS, deploy user, and the repo's Actions secrets.
2. `git push` to `main` (or run the *Deploy site* workflow by hand) — the workflow syncs `site/`
   to the bucket and invalidates the distribution.

The certificate is DNS-validated automatically (validation records land in the `outright.io`
zone and `aws_acm_certificate_validation` blocks until issued), so a first apply takes a few
minutes — most of it CloudFront distribution creation.

Until step 1 has run, the deploy workflow's AWS job finds no secrets, says so in its summary and
finishes green rather than failing on every hourly commit. The first push after the apply
publishes for real, with no change needed to the workflow.

## Publishing

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) is the pipeline for `main`:
test, then sync `site/` to the bucket (`--delete` keeps the bucket an exact mirror) and
invalidate `/*`. There is no build step — `site/` is the finished artifact, plain HTML/CSS/JS
with zero dependencies, and the only thing published. `/screenshots` is a record kept in the
repository, not part of the site.

Not-found requests are answered by the bucket, not by a CloudFront custom error response: the
origin is the S3 *website* endpoint, whose `error_document` is `error.html`, so a request for a
missing key returns `site/error.html` with a 404. That replaces the `site/404.html` copy the
GitHub Pages deploy made.

GitHub Pages still publishes the same tested commit in parallel, so the site has a fallback
while CloudFront settles in. To retire it: delete the `pages` job from `deploy.yml`, remove the
`pages` block from `repo.tf`, and apply.

## Notes

- The distribution geo-blocks `CN`, the studio default inherited with the module
  (`blacklist_locations` in `modules/website/_inputs.tf`). Pass `[]` from `website.tf` to serve
  everywhere.
- `PriceClass_100` keeps edge locations to North America and Europe.
- `validate` reports two deprecation warnings, both for arguments of
  `github_repository.interesting`: `pages` and `vulnerability_alerts` have dedicated resources
  now. They are kept inline on purpose — written that way they are adopted by the repo's own
  import, where separate resources would each need their own import block, and the `pages` one
  is due to be deleted when Pages is retired. The provider is pinned to `~> 6.2`, so neither
  argument disappears underneath this project.
- `.terraform.lock.hcl` is committed, as `terraform init` wrote it — currently byte-identical to
  BoardingFlow's, so both properties run the same provider versions. It carries the registry's
  platform-independent hashes, so an `init` verifies on any OS; the first `init` on a new one
  also appends that platform's own hash. To record them all up front instead:
  `terraform -chdir=infra providers lock -platform=linux_amd64 -platform=darwin_arm64`.

## Costs

A static site behind CloudFront's `PriceClass_100` with a handful of visitors rounds to pennies
per month: S3 storage (`site/` is a few hundred KB), CloudFront requests, one Route53 query
volume. The hosted zone is shared and already paid for.

The hourly AI iteration makes this busier than a normal property: roughly 720 deploys a month,
each one an `aws s3 sync` and an invalidation. An invalidation of `/*` counts as one path, so
that stays inside CloudFront's 1,000 free paths a month.
