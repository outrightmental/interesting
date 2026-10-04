[![Deploy site](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml)
[![Make the website more interesting](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml)

# interesting
iterate a more interesting website

**https://interesting.outright.io/**

## How it works

- **`/site`** — the website, in source form. Everything anyone edits — a person or the hourly AI —
  lives here, and nothing else does: the pages, the shared layout and partials, the Sass, and the
  three shared files behind the analytics tag (see [Analytics axiom](#analytics-axiom)). A request
  for a page that is not there gets `error.html` back, with a 404, from a CloudFront custom error
  response.
- **The build** — [`build.mjs`](build.mjs) turns `/site` into the artifact that is published to an
  S3 bucket behind CloudFront at [interesting.outright.io](https://interesting.outright.io/), in a
  throwaway folder outside the repository. Nothing generated is ever committed. The deploy changes
  one thing on the way — the GA4 measurement ID — and copies everything else as the build left it.
  See [Building the site](#building-the-site).
- **`/infra`** — the hosting, as code. [`infra/`](infra) is a self-contained Terraform project
  that owns the bucket, the CloudFront distribution, the certificate and DNS, the deploy IAM
  user, the Actions secrets the deploy uses — and this repository itself. It is applied by hand:
  no workflow here runs `terraform plan` or `apply`. See [`infra/README.md`](infra/README.md).
- **Test, then deploy** — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is the
  pipeline for `main`. Every commit that lands there is tested
  ([`.github/workflows/test.yml`](.github/workflows/test.yml)), and when the tests pass, `/site` is
  built and the generated folder is published: synced to the bucket with `--delete`, then the
  CloudFront cache is invalidated. A failing test blocks the deploy, and so does a failing build.
  The pipeline also starts when the hourly AI workflow
  finishes, because GitHub starts no workflow for a commit pushed by another workflow.
  CloudFront is the only publisher: the site used to be served from GitHub Pages as well, which
  is retired.
- **Hourly AI iteration** — [`.github/workflows/make-interesting.yml`](.github/workflows/make-interesting.yml)
  runs every hour (or manually via *Run workflow*). It picks a random model from
  [GitHub Copilot](https://docs.github.com/copilot), reached through the
  [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) and billed to a GitHub Copilot
  subscription (see [Setup](#setup)), gives it the mission **"make the website more interesting as a
  single coherent whole"** — where *interesting* means user engagement time, and nothing else (see
  [Engagement-time axiom](#engagement-time-axiom)) — and commits the result to `main`; the pipeline
  above then tests and deploys it. Every run is told to start by envisioning the site as **one
  functioning excellent experience** and then to re-federate it aggressively, which is the normal
  work of a run rather than one option among two (see [One single experience](#one-single-experience)).
  Models the account cannot use are skipped. A model
  that returns an unusable answer is replaced by another random model, or asked again if no other
  is left, for up to three attempts per run.
- **One run at a time** — a run that starts while an earlier run of the workflow is still going
  skips itself and finishes green without doing anything, so there is never more than one
  iteration in flight. (To retry a failed run use *Run workflow*: *Re-run failed jobs* does not
  repeat the check, so it waits for the current run instead of skipping.)
- **Only flagship models** — the random pick draws from a list of large, top-tier models (see
  [Which models](#which-models)); small and mid-tier models are never picked.

### Building the site

`/site` used to be the published artifact as it stood. It is source now, and the build underneath it
is deliberately small: a foundation to build a more holistic experience on, not a framework to learn.

- **Eleventy, and two conventions.** [`eleventy.config.mjs`](eleventy.config.mjs) is the whole
  pipeline. An `.html` file is a [Nunjucks](https://mozilla.github.io/nunjucks/) template with
  optional YAML front matter; `layout: layout.njk` wraps it in the shared shell in
  [`site/_includes`](site/_includes), so the `<head>`, the stylesheet links, the analytics line and
  the footer are written once instead of in every page, and a page is little more than its `<main>`.
  A `.scss` file
  compiles to `.css` at the same path, and one whose name starts with `_` is a partial, built into
  whatever `@use`s it and never on its own. Every other file type is copied through verbatim, never
  rendered, so a stray `{{` in a script cannot break a build.
- **Common files.** [`site/_sass`](site/_sass) is what "shared partials" means here: the palette as
  custom properties a page can override (`_tokens.scss`), the base rules, the panel, the controls,
  the footer, the values the stylesheets have in common (`_vars.scss`, which emits no CSS of its own)
  and the monospace readout seven pages use (`_readout.scss`, a mixin). `css/site.scss` is those
  partials and nothing else, and every page links the `css/site.css` it compiles to. `css/<page>.scss`
  holds what is true of that page alone and is linked after it, so a page overrides rather than
  repeats. `error.html` writes its styles into the page instead: CloudFront returns it for any 404,
  at whatever path was asked for, so a relative `<link>` next to it would be a guess.
- **Output paths mirror source paths.** `site/index.html` becomes `index.html` and
  `site/css/site.scss` becomes `css/site.css`. Eleventy's "pretty" permalinks would turn
  `about.html` into `about/index.html`, which would break every relative link the site is written
  with.
- **The output is throwaway.** `npm run build` writes to a temp folder outside the repository and
  prints the path as its last line, so a caller can read it without parsing anything else; the
  deploy builds into `$RUNNER_TEMP` and syncs that. Nothing generated is committed, and
  `node_modules/` is gitignored while `package-lock.json` is not, because `npm ci` needs it.

```bash
npm ci                              # once
npm run build                       # prints the folder it built into
npm run build -- --out ./build      # or pick the folder yourself
```

### Engagement-time axiom

The mission says the site gets *more interesting*. This is what interesting means here, and it is
the only thing it means: **user engagement time** — how long a person stays engaged, how much they
want to keep going, and how intrigued, astonished or entertained they are while they do. A page
nobody lingers on is not interesting however handsome it is. Coherence is worth the trouble for the
same reason: a site that holds together is one a visitor keeps exploring.

The site has no update rhythm to put in front of a visitor, either. It does not run a nightly
experiment and publishes no daily or hourly edition — it iterates continuously — so copy that dates
its content was false as often as it was true, and copy that deferred a visitor to another day spent
the one thing the mission is measured in.

- **Stated in the prompt.** The system prompt gives the definition twice: once before a run chooses
  what to do, so the standard is in hand while the choice is still open, and once in the line a run
  reads last. It says outright that a change is judged on whether it gives someone a reason to stay
  and keep going, not on whether it looks tidy or busy. `MISSION` names the aim, `INTERESTING`
  names the measure and `WHOLE` names the shape
  ([One single experience](#one-single-experience)), all three in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) and all three stated
  at both ends of a run.
- **The cadence rule is the fourth `AXIOM`**, stated in the `Rules:` block beside the three below.
  It names every phrasing the code refuses, in full, so it is a rule a run can follow rather than a
  trap it springs: the words *tonight*, *tomorrow*, *yesterday*, *hourly*, *nightly*, *daily* and
  *weekly*; the possessives *today's*, *this hour's*, *this week's*, *this month's*; and *every
  hour*, *each day*, *once a week* and the rest of that family. It also asks a run not to send a
  visitor away — "move one star **and** ask again", never "move one star **tomorrow** and ask
  again" — because the next move is the one worth asking for.
- **Held to in code.** `check_cadence` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  puts one of those phrasings on a page. As with the three axioms below, only what the run itself
  breaks is refused, and every reason is one phrase, so clearing part of a page can only take
  reasons away. The engagement-time definition itself is *not* checked in code, because no check
  could: it is a standard for the model to aim at, and the prompt is where a standard like that
  lives.
- **Checked on the built site**, like the others, and read as text rather than parsed as markup —
  the one check here that is. Most of this site's prose lives in the JavaScript that draws the page
  rather than in its markup, so a parser that handed `<script>` bodies over as opaque text (which is
  exactly what the accessibility checks want it to do) would have missed nearly every instance there
  was to find. A page's shared stylesheets and scripts are read with it as well, so copy cannot be
  federated out of reach.
- **The night-sky theme is untouched.** The sweep is deliberately narrow: only words that date the
  site or defer the visitor are refused, so *midnight*, *dusk*, *night* and *starlight* keep naming
  a mood rather than a schedule. "Toggle midnight rain", "returning to midnight tones" and "before
  midnight" are all still there, and a test fails if the atmosphere ever disappears along with the
  cadence.
- **The three vendored files are not policed.** `FIXED_FILES` are never a model's to write, so a
  phrase in one could not be a run's fault, and 55 KB of consent library is not this repository's
  prose to police — a future release of it saying "daily" in a comment must not be able to fail
  every page of the site at once.
- **A stated standard, not a feedback loop.** The site does measure engagement — that is what the
  GA4 tag is for — but nothing feeds those numbers back into a run, and nothing here could usefully:
  a model cannot be shown the engagement of a change it has not made yet, and the signal for a
  change deployed within the hour is noise. Closing that loop is its own piece of work.
- **This document still names the cadence, on purpose.** The ban is on what a visitor reads. The
  schedule is a real fact about the workflow — it runs hourly, that is what it costs, and anyone
  running or forking this needs to know — so "Hourly AI iteration", the `cron`, the workflow name
  and the figures under [Setup](#setup) all stay as they are. What changed in the repository is
  that `/site` no longer repeats any of it.
- **True of the site as committed**, not only of what a future run writes: `RealSiteTest` in
  [`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) sweeps the
  built site on every pull request and before every deploy. That sweep is what found
  "Tonight's experiment" on the home page, "tonight starts fresh" in its storage-failure note,
  "rewritten every hour" in the site map's closing axiom, and the readings that sent a visitor away
  until tomorrow.

### One single experience

Engagement time says how good the site has to be. This says what shape it has to be in: **one
functioning excellent experience** — one navigation, one visual language, one through-line a visitor
follows from the first page to the last — and not a set of pages that happen to share a domain. A
pile of individually decent pages satisfies "more interesting" and even satisfies engagement time
for a while, which is exactly why it has to be ruled out by name.

- **Every run envisions the whole first, unconditionally.** The system prompt opens the choice with
  `ENVISION THE WHOLE FIRST`: before a run chooses anything it reads every file it was given and
  pictures the site as one experience, then asks where what is there falls short of that — what the
  pages repeat, where they have drifted apart, which of them a visitor would not guess belong to the
  same site. That pass is the first half of every run, with nothing to decide about it; what the run
  does is the second half and follows from what it saw. It used to be a suggestion ("begin every run
  by taking a moment"), which is a different instruction.
- **Re-federating is the normal work of a run**, not one of two options. `RE-FEDERATE,
  AGGRESSIVELY` asks every run to leave the site more of a single piece than it found it: lift the
  markup, styles and behaviour the pages repeat into the shared files
  ([`site/_includes`](site/_includes), [`site/_sass`](site/_sass), `css/site.scss`, a shared
  `js/site.js`), give every page the same header and navigation, settle on one visual language and
  hold every page to it. The prompt asks for the consolidation that is overdue rather than the one
  that is merely easy, and asks a run not to leave a near-duplicate standing because no single page
  is to blame for it.
- **It reaches the pages themselves.** Merging pages that overlap and retiring the ones that no
  longer earn their place is part of re-federating, not a separate licence: the site is better as
  fewer pages that belong together than as more that do not. The reachability axiom is what keeps
  that safe — a page a run retires comes out of the navigation and the sitemap in the same run, or
  the plan is refused — and a run whose entire change is a deletion has always been accepted.
- **Adding is the exception, and it arrives federated.** A site that already holds together gets
  more interesting by growing, so `ADD something` is still there: new content, a new page, an
  interactive toy, a hidden easter egg. But it is no longer the equal first option, and it is never
  a way around the paragraph above. Whatever a run adds arrives inside the shared layout, in the one
  visual language, wired into the one navigation, sharing the styles and behaviour it has in common
  with the rest, in that same run. A page that stands apart leaves the site less of a whole however
  good that page is on its own.
- **Aggressive, not reckless.** The answer limit has not moved, so a federation too large for one
  answer is staged across runs rather than half done: the prompt says so, and the rule that a run
  leaves the site working — every link, stylesheet, script, layout and `@use` still pointing at
  something that is there — is unchanged.
- **Stated at both ends of the run**, the pattern this repository uses for every standard it holds a
  model to. `WHOLE` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) is named in the first
  line of the system prompt, again where the run chooses what to do, and again in the last line
  before the answer, so the aim is in hand while the choice is open and still in hand when it is
  made. `MISSION` carries it too: "make the website more interesting as a **single** coherent
  whole".
- **Not a fifth axiom, on purpose.** No check could settle whether a site reads as one experience,
  in the way `check_reachability` settles whether a page is orphaned, so this is a standard stated
  to the model and nothing else — the same reasoning that leaves the engagement-time definition
  uncoded. The four axioms below are still the whole of what the code refuses, and a plan that adds
  a page sharing nothing with the rest is accepted exactly as before. A test holds that open: it
  asserts the accepted plan *and* that no fifth `check_` has quietly appeared.

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
- **Checked on the built site**, which is the one a visitor sees. `build_site` runs the real build on
  a copy of the plan rather than keeping a second guess at what the build does, so a layout is not a
  page, a page is whatever the templates make of it, and a navigation that only exists once a partial
  has been included counts just the same. An answer that does not build is refused for that alone. A
  site that already does not build blocks nothing, for the same reason a pre-existing orphan does
  not.
- **Both kinds of sitemap.** [`site/sitemap.xml`](site/sitemap.xml) for anything that reads the
  site mechanically, and [`site/sitemap.html`](site/sitemap.html) for a visitor. The `<loc>` values
  are relative paths, like every other link in `/site`: the site has no fixed domain and is served
  under a sub-path, so a hard-coded origin would be wrong for every fork and local copy.
- **`sitemap.xml` is protected**, alongside `index.html` and `error.html`: it may be rewritten,
  never deleted, and it is always shown to the model, so a run can always wire a new page into it.
- **True of the site as committed**, not only of what a future run adds. Because the code only
  refuses what a run breaks, the invariant has to start out true, so `RealSiteTest` in
  [`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) builds
  `/site` and checks the result on every pull request and before every deploy.

### Analytics axiom

Every page reports to Google Analytics, and asks for consent before it does. That is an invariant of
the iteration process too, for the same reason the one above is: the hourly run may return complete
new content for any page it is shown.

- **One line per page.** Every page carries
  `<script src='js/analytics.js' defer></script>` in its `<head>` — written once in
  [`site/_includes/layout.njk`](site/_includes/layout.njk), the shared shell every page is built
  into, which is what a shared shell is for. The axiom is checked on the built site, so one line
  there satisfies it for all of them, and a run that rewrites the shell without it is refused for
  every page at once. [`site/js/analytics.js`](site/js/analytics.js) brings the rest with it, resolving its neighbours
  from its own URL so a page in a sub-folder works too: the consent banner
  ([orestbida/cookieconsent](https://github.com/orestbida/cookieconsent) 3.1.0, MIT, vendored into
  `site/js/` and `site/css/` exactly as published) and — only once a visitor accepts the analytics
  category — the Google tag, which is not even fetched before then. Declining later switches
  measurement back off and lets the banner clear the cookies it set, and a small *cookies* button in
  the corner of every page reopens the choice.
- **No measurement ID in the repository.** `analytics.js` ships a placeholder, and
  [`deploy.yml`](.github/workflows/deploy.yml) pastes the `GA_MEASUREMENT_ID` repository secret into
  the copy on its way to the bucket. The placeholder switches the whole file off, so a fork, a local
  copy or any checkout the deploy has not run over loads no tag, shows no banner and sets no cookie.
  The secret comes from the same `terraform apply` as the AWS ones ([`infra/github.tf`](infra/github.tf)).
- **Stated in the prompt.** The `Rules:` block names the exact line, tells a run to keep it on every
  page it rewrites and to put it on every page it adds, and names the relative `src` a page in a
  sub-folder uses. The rule that used to end "nothing harmful, deceptive or tracking" now forbids a
  run from adding tracking, telemetry, a beacon or a third-party script *of its own*.
- **Held to in code.** `check_analytics` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  leaves a page without the line. As with reachability, only what the run itself breaks is refused.
- **The three files are out of reach.** `FIXED_FILES` — `js/analytics.js` and the two vendored
  `cookieconsent` files — are never shown to a model and are refused outright as a write or a
  delete, so no run can quietly gut the tag or the banner. They skip the prompt budget as well, so
  55 KB of consent library cannot push a page of the site out of the prompt.
- **True of the site as committed**, checked by `RealSiteTest` on every pull request and before every
  deploy: every page loads the script, the three files are there, no measurement ID is committed,
  `deploy.yml` still replaces the placeholder, and the vendored library keeps its license and version.

### Responsive and accessible axiom

Every page works on a small screen as well as a large one, and works for a visitor who cannot see
it, cannot use a mouse, or has asked their system for less motion. Like reachability it is an
invariant of the iteration process, not a one-off tidy-up: it does not depend on which model happens
to be drawn in a given hour.

- **The standard is [WCAG 2.2 level AA](https://www.w3.org/TR/WCAG22/).** Every check names the
  success criterion it stands for, so the set can grow without becoming a matter of taste.
- **Stated in the prompt.** The `Rules:` block every run is given carries this as a third `AXIOM`
  beside reachability and analytics. It asks for more than any validator can judge — fluid layout
  with nothing overflowing sideways at 320px wide, tap targets around 44px, text contrast at 4.5:1 —
  because the prompt can ask for what code cannot see.
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
- **Checked on the built site**, like the other two. The viewport tag and the one `<main>` landmark
  are written once in [`site/_includes/layout.njk`](site/_includes/layout.njk), so a run that
  rewrites the shell without them is refused for every page at once, and a Sass partial is judged
  through the stylesheets it compiles into rather than on its own account.
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
  [`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) builds
  `/site` and checks the result on every pull request and before every deploy. A violation **fails
  the build and blocks the deploy**; a warning in an hourly log nobody reads would change nothing.

### Silo

The AI can only ever modify `/site` — but within it, everything: pages, the shared layout and
partials in `_includes`, the Sass in `_sass` and `css/`. There is no corner of the site it is kept
out of, because a run told to re-federate the site aggressively cannot do it without the shared
files (see [One single experience](#one-single-experience)).

1. The model has no tools or shell: the Copilot CLI runs in an empty directory with every tool
   disabled, so the model only returns JSON describing files to write/delete. If the model ever
   manages to use a tool, the run stops and nothing is applied.
2. [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) rejects any path
   that is absolute, contains `..`/hidden segments or anything but lowercase letters, digits, `.`,
   `_` and `-`, resolves outside `/site` (including via symlinks) or has a non-static file type.
   It never deletes `index.html`, `error.html` or `sitemap.xml`, never writes or deletes the three
   files behind the analytics tag, never touches a file the model was not shown, and applies an
   answer whole or not at all.
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
  the distribution, the certificate and DNS, and sets the five repository secrets the deploy reads
  (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`,
  `AWS_CLOUDFRONT_DISTRIBUTION_ID` and `GA_MEASUREMENT_ID`). No secret is set by hand: they come
  from the same apply that creates or names what they point at, so they cannot drift from it.
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
npm ci                                            # the tests build the site
python3 -m unittest discover -s .github/scripts -v
```

Most of the suite stands the build in with the identity, which is exactly what it is for the plain
HTML those fixtures are made of. `BuildPipelineTest` and `RealSiteTest` run the real build; without
the toolchain they skip, except in CI, where a missing toolchain is the thing to find out about.

To try a real run without touching the repository's site, point the script at a copy (this needs a
logged-in `copilot` CLI). The build still runs from this repository, on a copy of whatever the model
proposes:

```bash
cp -R site /tmp/site-copy && SITE_DIR=/tmp/site-copy python3 .github/scripts/make_interesting.py
```
