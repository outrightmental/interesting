[![Deploy site](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml)
[![Make the website more interesting](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml)

# interesting
iterate a more interesting website

**https://interesting.outright.io/**

## How it works

- **`/site`** — the static website, published to an S3 bucket behind CloudFront at
  [interesting.outright.io](https://interesting.outright.io/). `site/` is the whole artifact:
  plain HTML with no build step, and nothing else is published. A request for a page that is not
  there gets `error.html` back, with a 404, from a CloudFront custom error response.
- **`/infra`** — the hosting, as code. [`infra/`](infra) is a self-contained Terraform project
  that owns the bucket, the CloudFront distribution, the certificate and DNS, the deploy IAM
  user, the Actions secrets the deploy uses — and this repository itself. It is applied by hand:
  no workflow here runs `terraform plan` or `apply`. See [`infra/README.md`](infra/README.md).
- **Test, then deploy** — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is the
  pipeline for `main`. Every commit that lands there is tested
  ([`.github/workflows/test.yml`](.github/workflows/test.yml)), and when the tests pass, `/site`
  is published: synced to the bucket with `--delete`, then the CloudFront cache is invalidated.
  A failing test blocks the deploy. The pipeline also starts when the hourly AI workflow
  finishes, because GitHub starts no workflow for a commit pushed by another workflow.
  CloudFront is the only publisher: the site used to be served from GitHub Pages as well, which
  is retired.
- **Hourly AI iteration** — [`.github/workflows/make-interesting.yml`](.github/workflows/make-interesting.yml)
  runs every hour (or manually via *Run workflow*). It picks a random model from
  [GitHub Copilot](https://docs.github.com/copilot), reached through the
  [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) and billed to a GitHub Copilot
  subscription (see [Setup](#setup)), gives it the mission **"make the website more interesting as a
  coherent whole"**,
  and commits the result to `main`; the pipeline above then tests and deploys it. Models the
  account cannot use are skipped. A model
  that returns an unusable answer is replaced by another random model, or asked again if no other
  is left, for up to three attempts per run.
- **One run at a time** — a run that starts while an earlier run of the workflow is still going
  skips itself and finishes green without doing anything, so there is never more than one
  iteration in flight. (To retry a failed run use *Run workflow*: *Re-run failed jobs* does not
  repeat the check, so it waits for the current run instead of skipping.)
- **Only flagship models** — the random pick draws from a list of large, top-tier models (see
  [Which models](#which-models)); small and mid-tier models are never picked.

### Reachability axiom

All of the content stays reachable from the root, through a navigation affordance and through a
sitemap. It is an invariant of the iteration process rather than a one-off tidy-up:

- **Stated in the prompt.** The `Rules:` block every run is given says that `index.html` must lead
  to every page — directly, or by following links through the pages it leads to, such as a site map
  page — and that `sitemap.xml` must list every page. A page a run adds is wired into both by that
  same run, and a page it deletes comes out of both.
- **Held to in code.** `check_reachability` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  would orphan a page: one no chain of links from `index.html` arrives at, or one the sitemap stops
  listing. A shared nav, a site map page and a nav built by a shared script all count as a way
  through. Only what the run itself breaks is refused: a page that was already orphaned stays the
  site's own problem to repair, because rejecting every plan over it would leave no plan able to
  repair it.
- **Both kinds of sitemap.** [`site/sitemap.xml`](site/sitemap.xml) for anything that reads the
  site mechanically, and [`site/sitemap.html`](site/sitemap.html) for a visitor. The `<loc>` values
  are relative paths, like every other link in `/site`: the site has no fixed domain and is served
  under a sub-path, so a hard-coded origin would be wrong for every fork and local copy.
- **`sitemap.xml` is protected**, alongside `index.html` and `error.html`: it may be rewritten,
  never deleted, and it is always shown to the model, so a run can always wire a new page into it.
- **True of the site as committed**, not only of what a future run adds. Because the code only
  refuses what a run breaks, the invariant has to start out true, so `RealSiteTest` in
  [`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) checks
  `/site` itself on every pull request and before every deploy.

### Responsive and accessible axiom

Every page works on a small screen as well as a large one, and works for a visitor who cannot see
it, cannot use a mouse, or has asked their system for less motion. Like reachability it is an
invariant of the iteration process, not a one-off tidy-up: it does not depend on which model happens
to be drawn in a given hour.

- **The standard is [WCAG 2.2 level AA](https://www.w3.org/TR/WCAG22/).** Every check names the
  success criterion it stands for, so the set can grow without becoming a matter of taste.
- **Stated in the prompt.** The `Rules:` block every run is given carries this as a second `AXIOM`
  beside reachability. It asks for more than any validator can judge — fluid layout with nothing
  overflowing sideways at 320px wide, tap targets around 44px, text contrast at 4.5:1 — because the
  prompt can ask for what code cannot see.
- **Held to in code.** `check_accessibility` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  makes a page fail the mechanical half of it. Thirteen signals, each one something a page either
  plainly has or plainly lacks: `width=device-width` and zoom left alone (1.4.10 Reflow, 1.4.4
  Resize Text); `lang` on `<html>` (3.1.1); a `<title>` (2.4.2); exactly one `<main>` landmark
  (1.3.1, 2.4.1); headings that start at `<h1>` and skip no level (1.3.1); `alt` on every `<img>`,
  `alt=""` being how a page marks one decorative (1.1.1); an accessible name on every link, button
  and form control, from its own text, a `<label for>` or an `aria-label` (4.1.2, 2.4.4, 3.3.2); a
  `:focus` style wherever the browser's outline is taken away (2.4.7); no positive `tabindex`
  (2.4.3); and a `prefers-reduced-motion` rule, in CSS or through `matchMedia`, wherever the page
  animates (2.3.3).
- **Responsiveness is checked as accessibility**, because that is what it is. A page that insists on
  a desktop-width window, or that forbids the pinch zoom people enlarge text with, has shut out the
  same visitor a missing alt text does.
- **Only what the run itself breaks is refused**, exactly as with reachability: a page that already
  falls short stays the site's own problem to repair, because rejecting every plan over it would
  leave no plan able to repair it. A page a run writes from scratch has no such excuse, so it is
  born responsive and accessible. Every reason is a fixed string, so a repair can only take reasons
  away — mending one of two nameless buttons is never read as a new fault.
- **Read as markup, not as text.** Pages are parsed with `html.parser`, so the markup these pages
  build inside JavaScript strings is never mistaken for markup of the page itself, and a page's
  linked stylesheets and scripts are read along with it, so the checks stay true of a federated site
  where the focus ring and the motion live in `css/site.css` and `js/site.js`.
- **True of the site as committed.** Because the code only refuses what a run breaks, the invariant
  has to start out true, so `RealSiteTest` in
  [`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) checks
  `/site` itself on every pull request and before every deploy. A violation **fails the build and
  blocks the deploy**; a warning in an hourly log nobody reads would change nothing.

### Silo

The AI can only ever modify `/site`:

1. The model has no tools or shell: the Copilot CLI runs in an empty directory with every tool
   disabled, so the model only returns JSON describing files to write/delete. If the model ever
   manages to use a tool, the run stops and nothing is applied.
2. [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) rejects any path
   that is absolute, contains `..`/hidden segments or anything but lowercase letters, digits, `.`,
   `_` and `-`, resolves outside `/site` (including via symlinks) or has a non-static file type.
   It never deletes `index.html`, `error.html` or `sitemap.xml`, never touches a file the model was
   not shown, and applies an answer whole or not at all.
3. The workflow fails if anything outside `/site` changed, and only stages `site/` for commit. The
   repository's token is not in the checkout while the model's answer is processed. The model's
   one-line summary is stripped to plain text before it reaches the commit message.

### Which models

The random pick only ever draws from large, flagship models, listed as `MODELS` in
[`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py). Today they come from
Anthropic (Fable, Opus), OpenAI (Sol, Astra, GPT-5.5, GPT-5.3-Codex) and Moonshot (Kimi K3). Google
has no model in the pool, because Copilot only offers the Gemini Flash tier.

- **Small models are never picked at random.** Besides not being on the list, any model whose id
  contains a small or mid-tier name is refused: `haiku` and `sonnet`, and their equivalents at
  other providers such as `mini`, `nano`, `luna`, `terra`, `flash`, `lite`, `small`, `medium`,
  `micro` and `phi` (the full set is `SMALL_MODEL_MARKERS`). `fast` is on that list too, which
  also keeps out speed-tuned variants of flagships such as `claude-opus-4.8-fast`.
- **Changing the pool** needs no code change: set the repository variable `MODEL_POOL` to a
  comma-separated list of Copilot model ids. Models recognised as small or mid-tier are still
  refused. List flagships only, though: the rule works on names, so it cannot judge an unknown id
  that is only a version number. The ones known today, such as `gpt-5.4`, are refused by id.
- **Naming a model yourself**, through the *Run workflow* form, is not a random pick: the model is
  used as asked, with a warning in the log if it is not a flagship.
- Models that Copilot has retired or that the account cannot use are skipped automatically.

### Setup

- **Hosting** — run `terraform apply` in [`infra/`](infra) once, by hand. That creates the bucket,
  the distribution, the certificate and DNS, and sets the four repository secrets the deploy reads
  (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`,
  `AWS_CLOUDFRONT_DISTRIBUTION_ID`). No secret is set by hand: they come from the same apply that
  creates what they point at, so they cannot drift from it.
  [`infra/README.md`](infra/README.md) has the order and the costs. Until that apply has run, the
  deploy says so in its summary and finishes green instead of failing hourly — so run it around
  the time this lands, because GitHub Pages is retired and nothing else publishes the site.
- Actions must be allowed to push to the default branch (the AI's commit uses `GITHUB_TOKEN`).
- GitHub Copilot must accept the workflow's requests. Either of these works:
  - **Organization:** as an owner, open the organization's *Settings → Copilot → Policies*, enable
    **Copilot CLI** and select **Allow use of Copilot CLI billed to the organization**. No secret
    is needed: the workflow's own token is accepted through its `copilot-requests: write`
    permission, and usage is billed to the organization. The change can take a quarter of an hour
    to apply; until then runs fail with "Access denied by policy settings".
  - **Personal plan:** add a repository secret named `COPILOT_GITHUB_TOKEN` holding a fine-grained
    personal access token (resource owner: your own account) with the account permission
    **Copilot Requests**. Usage is billed to that user's Copilot plan. When this secret exists it
    is used instead of the workflow's own token.
- The hourly schedule makes about 720 model calls a month, more when answers have to be asked
  for again. They are billed as Copilot AI credits to whoever pays (see the two routes above), from
  the same allowance as that account's other Copilot use.
- Which models can be picked depends on who pays. The workflow's own token is only offered the
  models of the organization's Copilot plan and model policy: on 2026-10-02, for an organization
  with the policy enabled but no Copilot seats, that was `gpt-5.3-codex` alone, so every "random"
  pick landed on it. A personal token is offered every model of that user's plan. The run log
  names the models it tried that the account could not use.

### Development

[`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) tests the
script without calling any model. It runs on every pull request, and on `main` before each deploy:

```bash
python3 -m unittest discover -s .github/scripts -v
```

To try a real run without touching the repository's site, point the script at a copy (this needs a
logged-in `copilot` CLI):

```bash
cp -R site /tmp/site-copy && SITE_DIR=/tmp/site-copy python3 .github/scripts/make_interesting.py
```
