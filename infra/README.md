# infra — makeitmoreinteresting.com

Self-contained Terraform project for the *interesting* website, built the same way
[BoardingFlow/infra](https://github.com/outrightmental/BoardingFlow/tree/main/infra) is (which
follows FishCareers', which follows outrightmental.com's, which follows TransformationLab's).
One project owns the whole stack for one property — including the GitHub repository it lives in.

## What this project owns

| File | Resources | Purpose |
| ---- | --------- | ------- |
| `repo.tf` | `github_repository.interesting` | The repository itself — `outrightmental/interesting` is repo-as-code: name, visibility, merge settings, all here. It pre-existed this configuration, so the first apply **adopts** it via an import block; `archive_on_destroy` means a destroy archives rather than deletes it. There is no `pages` block, which is how GitHub Pages stays retired. |
| `issue-labels.tf` | `github_issue_label.steer`, `github_issue_label.broken` | The two labels the issue forms in [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE) ask for, so the way a visitor steers the site is owned here with the repository rather than created by hand. A form naming a label the repository lacks is not an error — GitHub files the issue without it — so the forms work before this is applied and the labels stick once it has been. |
| `dns.tf` | `aws_route53_zone.primary`, `aws_route53domains_registered_domain.primary` | The `makeitmoreinteresting.com` hosted zone, and the domain's registration pointed at it. The site used to live at `interesting.outright.io`, a subdomain of a studio-wide zone this project could only read; its own apex domain has nothing in it but this site, so the zone is owned here with the rest of the stack. The domain is registered with Amazon Registrar in this same account, so its nameservers are set from the zone here too, and a registration pointing anywhere else is a plan diff rather than a site nobody can resolve. The registration is adopted, never registered or transferred: a destroy leaves it alone. |
| `website.tf` + `modules/website` | S3 bucket + CloudFront distribution, ACM certificate + DNS validation, A/AAAA alias records | The static site at https://makeitmoreinteresting.com/, also served at `www.` from the same distribution (one certificate with www as a SAN, both hostnames as CloudFront aliases, four alias records from one `for_each`). The module is copied from BoardingFlow/infra, with the two changes listed under [Notes](#notes). |
| `iam-deploy.tf` | `makeitmoreinteresting-com-deploy` IAM user + key + policy | Dedicated deploy credentials for the GitHub Actions workflow (S3 sync + CloudFront invalidation), scoped to exactly this bucket and this distribution. |
| `github.tf` | Repository Actions secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID` — set from this project's own resources so the deploy can never drift from the infrastructure. A single apply rotates the deploy credentials end to end. Plus `GA_MEASUREMENT_ID`, the GA4 property the site reports to (`ga_measurement_id` in `locals.tf`): not a credential, since the deploy publishes it in every page, but owned here so the repository itself holds no measurement ID. |
| `data.tf` | *(read-only)* | The AWS account id, read from the caller rather than written down. Nothing else is read from outside this project any more: the hosted zone used to be, back when the site was a subdomain of `outright.io`. |

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

State is kept in the shared S3 backend under the `makeitmoreinteresting.com` key (`main.tf`),
independent of every other property's state. It was under `interesting.outright.io` until the
domain moved; see [Moving the domain](#moving-the-domain) for the migration.

## First-time order

Unlike a fresh bootstrap, the repository and its content already exist, so the first apply
adopts rather than creates the repo:

1. `terraform apply` from a local checkout — **imports the existing repo**, creates the bucket,
   distribution, certificate, DNS, deploy user, and the repo's Actions secrets. The same apply
   asks GitHub to turn the repository's Pages site off, since `repo.tf` no longer configures one;
   confirm that under *Settings → Pages* afterwards.
2. `git push` to `main` (or run the *Deploy site* workflow by hand) — the workflow builds `site/`,
   syncs the result to the bucket, and invalidates the distribution.

The certificate is DNS-validated automatically (validation records land in this project's own
`makeitmoreinteresting.com` zone and `aws_acm_certificate_validation` blocks until issued), so a
first apply takes a few minutes — most of it CloudFront distribution creation. It can only
succeed once the domain's nameservers point at that zone: ACM resolves the validation record over
public DNS, so an undelegated zone makes the apply wait until it times out. Create and delegate
the zone first, as step 2 of [Moving the domain](#moving-the-domain) does.

**Run step 1 around the time the retirement of GitHub Pages merges.** Until it has run there is
no live deploy at all: the Pages publisher is gone from `deploy.yml`, and the AWS job finds no
secrets, so it says so in its summary and finishes green rather than failing on every hourly
commit. The first push after the apply publishes for real, with no change needed to the workflow.

## Moving the domain

The site was served from `interesting.outright.io` until the studio acquired
**makeitmoreinteresting.com**. Everything in this project now names the new domain, and three of
those things cannot simply be updated in place: the **bucket** is named after the domain, so it is
replaced; the **backend state key** is too, so the state has to be migrated; and the **hosted
zone** is a different zone altogether, which the registrar has to be pointing at before anything
that depends on it can apply. So the move is not one `terraform apply` — it is this order, once,
by hand.

Run it with the token exported, as in [Usage](#usage): `export GITHUB_TOKEN=$(gh auth token)`.

1. **Migrate the state.** `main.tf`'s backend key changed with the domain, so the first `init`
   after this merges has to carry the state across:

   ```bash
   terraform -chdir=infra init -migrate-state
   ```

   Terraform notices the key is different and offers to copy the state from
   `interesting.outright.io` to `makeitmoreinteresting.com`; answer `yes`. The old object is left
   where it was — delete it once the move is finished (step 6), not before.

2. **Create the zone, then delegate the domain to it.** Nothing else can be applied until public
   DNS answers for names in the new zone, because that is how ACM validates the certificate. The
   registered domain takes its nameservers from the zone, so targeting it creates both and points
   the registration at the zone:

   ```bash
   terraform -chdir=infra apply -target=aws_route53domains_registered_domain.primary
   terraform -chdir=infra output route53_name_servers
   ```

   Then wait until the delegation is live:

   ```bash
   dig +short NS makeitmoreinteresting.com @1.1.1.1
   ```

   Do not go on until that answers with the four `route53_name_servers`. A `.com` delegation is
   usually minutes, but it is the registry's clock, not ours, and a premature step 4 just sits in
   `aws_acm_certificate_validation` until it times out.

3. **Empty the old bucket.** Renaming the bucket means replacing it, and Terraform cannot delete a
   bucket that still has objects in it (`modules/website` sets no `force_destroy`, deliberately —
   it is shared with BoardingFlow). The bucket holds nothing but a mirror of the last build, so
   emptying it costs nothing that the next deploy will not put back:

   ```bash
   aws s3 rm s3://interesting.outright.io --recursive
   ```

   From here until step 5 the old host serves errors. It is being retired anyway.

4. **Apply the rest.**

   ```bash
   terraform -chdir=infra plan
   terraform -chdir=infra apply
   ```

   One apply does all of the rest: the new certificate is requested and DNS-validated in the new
   zone; the `makeitmoreinteresting.com` bucket is created and the old one destroyed; the
   distribution's aliases, origin and certificate are updated in place; the apex and `www` alias
   records are created; and the old `interesting.` A/AAAA and cert-validation records are deleted
   out of the `outright.io` zone, which is what retires the old host. The deploy IAM user is
   renamed in place, but its access key is replaced — `aws_iam_access_key.deploy` is keyed on the
   user's name — and the same apply writes the new key and the new bucket name into the
   repository's Actions secrets, so the deploy never holds a credential or a target that no longer
   exists. Budget ten to twenty minutes, nearly all of it the CloudFront update.

5. **Publish.** Run *Deploy site* by hand (or push to `main`): the new bucket is empty until the
   workflow syncs a build into it and invalidates `/*`.

6. **Then, by hand, the things Terraform does not own:**

   - Delete the old `interesting.outright.io` object from the `outrightmental-terraform-state`
     bucket, now that step 1's copy has been proven by a successful apply.
   - Delete the second `makeitmoreinteresting.com` hosted zone, the one commented *HostedZone
     created by Route53 Registrar*. Registering the domain made it, and the registration pointed at
     it until step 2. Wait two days after step 2 first: that is the `.com` NS TTL, so until then
     a resolver can still be asking it.
   - Point the GA4 data stream at `https://makeitmoreinteresting.com/`. The measurement ID is
     unchanged (`ga_measurement_id` in `locals.tf`) — GA4 measures a stream, not a hostname — so
     nothing in this project or the repository changes with it.
   - Check that `https://makeitmoreinteresting.com/` and `https://www.makeitmoreinteresting.com/`
     both serve the site over HTTPS, and that a made-up path still gets `error.html` with a 404.

### What the move deliberately leaves out

- **No redirect from `interesting.outright.io`.** The old records are deleted rather than pointed
  somewhere, so the old host stops resolving. Keeping it alive would mean keeping a certificate for
  a name in a zone this project no longer touches, plus something to do the redirecting — and the
  ask was to switch everything over, for a site whose pages have never named a domain. If inbound
  links turn out to matter, a redirect is a separate change to the `outright.io` zone's own project.
- **`www` serves the same site rather than redirecting to the apex.** Both hostnames are aliases on
  one distribution, which is one certificate SAN and two more records; making `www` 301 to the apex
  instead would need a CloudFront Function and a reason. The site publishes no canonical URL in any
  page (every link in `/site` is relative, and `sitemap.xml` uses relative `<loc>` values), so it
  has no absolute address to disagree with.

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
volume. The one fixed charge rather than a usage one is the hosted zone, at $0.50 a month: it used
to be the shared `outright.io` zone, already paid for, and `makeitmoreinteresting.com`'s is this
property's own (`dns.tf`), so its bill is too. The domain registration is a yearly Amazon
Registrar charge: `dns.tf` adopts the registration to set its nameservers, but never registers
or pays for the domain.

The hourly AI iteration makes this busier than a normal property: roughly 720 deploys a month,
each one an `aws s3 sync` and an invalidation. An invalidation of `/*` counts as one path, so
that stays inside CloudFront's 1,000 free paths a month.
