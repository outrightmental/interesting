# infra — interesting.outright.io

Self-contained Terraform project for the *interesting* website, built the same way
[BoardingFlow/infra](https://github.com/outrightmental/BoardingFlow/tree/main/infra) is (which
follows FishCareers', which follows outrightmental.com's, which follows TransformationLab's).
One project owns the whole stack for one property — including the GitHub repository it lives in.

## What this project owns

| File | Resources | Purpose |
| ---- | --------- | ------- |
| `repo.tf` | `github_repository.interesting` | The repository itself — `outrightmental/interesting` is repo-as-code: name, visibility, merge settings, all here. It pre-existed this configuration, so the first apply **adopts** it via an import block; `archive_on_destroy` means a destroy archives rather than deletes it. There is no `pages` block, which is how GitHub Pages stays retired. |
| `website.tf` + `modules/website` | S3 bucket + CloudFront distribution, ACM certificate + DNS validation, A/AAAA alias records | The static site at https://interesting.outright.io/. The module is copied from BoardingFlow/infra, with the two changes listed under [Notes](#notes). |
| `iam-deploy.tf` | `interesting-outright-io-deploy` IAM user + key + policy | Dedicated deploy credentials for the GitHub Actions workflow (S3 sync + CloudFront invalidation), scoped to exactly this bucket and this distribution. |
| `github.tf` | Repository Actions secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID` — set from this project's own resources so the deploy can never drift from the infrastructure. A single apply rotates the deploy credentials end to end. Plus `GA_MEASUREMENT_ID`, the GA4 property the site reports to (`ga_measurement_id` in `locals.tf`): not a credential, since the deploy publishes it in every page, but owned here so the repository itself holds no measurement ID. |
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
   distribution, certificate, DNS, deploy user, and the repo's Actions secrets. The same apply
   asks GitHub to turn the repository's Pages site off, since `repo.tf` no longer configures one;
   confirm that under *Settings → Pages* afterwards.
2. `git push` to `main` (or run the *Deploy site* workflow by hand) — the workflow builds `site/`,
   syncs the result to the bucket, and invalidates the distribution.

The certificate is DNS-validated automatically (validation records land in the `outright.io`
zone and `aws_acm_certificate_validation` blocks until issued), so a first apply takes a few
minutes — most of it CloudFront distribution creation.

**Run step 1 around the time the retirement of GitHub Pages merges.** Until it has run there is
no live deploy at all: the Pages publisher is gone from `deploy.yml`, and the AWS job finds no
secrets, so it says so in its summary and finishes green rather than failing on every hourly
commit. The first push after the apply publishes for real, with no change needed to the workflow.

## Publishing

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) is the pipeline for `main`:
test, then build `site/` and sync the result to the bucket (`--delete` keeps the bucket an exact
mirror) and invalidate `/*`. `site/` is source now, not the finished artifact: `npm ci` and
`npm run build` render its templates and compile its Sass into a folder under `RUNNER_TEMP` (see
the repository's own README for the pipeline), and it is that built folder — never the checkout —
that is published. The deploy refuses to sync a build with no `index.html` or `error.html`.

One substitution happens on the way, and only one: `js/analytics.js` ships a
`__GA_MEASUREMENT_ID__` placeholder, and the deploy replaces it with the `GA_MEASUREMENT_ID` secret
in the built artifact — the build copies the file through verbatim, placeholder and all — after
checking the value against `^G-[A-Z0-9]+$`. So no measurement ID is committed, and a checkout the
deploy has not run over keeps the placeholder, which switches that file off: no Google tag, no
consent banner, no cookies. If the secret is not set the site is published without analytics rather
than not published at all.

Not-found requests are served `site/error.html` by a CloudFront custom error response
(`modules/website/cloudfront.tf`): a key that is not in the bucket makes the S3 *website*
endpoint answer 404 — 403 if an object is there but unreadable — and the distribution maps both
to `/error.html`, kept as a 404 status so caches and crawlers are never told the page exists.
That replaces the `site/404.html` copy the GitHub Pages deploy made.

GitHub Pages is retired: no `pages` job in `deploy.yml`, no `pages` block in `repo.tf`, and
CloudFront is the site's only publisher.

## Notes

- `modules/website` is BoardingFlow's module with two changes, both in `cloudfront.tf`:
  the `custom_error_response` blocks that serve the error document (BoardingFlow has none —
  its site has no equivalent of `error.html`), and an empty `blacklist_locations` now meaning
  no geo restriction rather than an apply CloudFront must reject. `_inputs.tf` and `_outputs.tf`
  are byte-identical and `s3.tf` differs only in its header comment, so a fix in either property
  ports to the other.
- The distribution geo-blocks `CN`, the studio default inherited with the module
  (`blacklist_locations` in `modules/website/_inputs.tf`). Pass `[]` from `website.tf` to serve
  everywhere.
- `PriceClass_100` keeps edge locations to North America and Europe.
- `validate` reports two deprecation warnings, both from the `github` provider and both deliberate.
  One is for `vulnerability_alerts` on `github_repository.interesting`: there is a dedicated resource
  for it now, but it is kept inline because written that way it is adopted by the repo's own import,
  where a separate resource would need its own import block. The other is for `plaintext_value` on
  the Actions secrets, which the provider would rather have as `value`; identical warnings collapse
  into one, so it is reported against whichever secret comes last in `github.tf` and covers all five.
  The provider is pinned to `~> 6.2`, so neither argument can disappear underneath this project.
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
