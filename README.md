[![Deploy site](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml)
[![Make the website more interesting](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml)

# interesting
iterate a more interesting website

**https://interesting.outright.io/**

## How it works

- **`/site`** — the website, in source form. Everything anyone edits — a person or the hourly AI —
  lives here, and nothing else does: the pages, the shared layout and partials, the Sass, the three
  shared files behind the analytics tag (see [Analytics axiom](#analytics-axiom)), the one behind
  the local-state store (see [Local state axiom](#local-state-axiom)) and the one behind the mood
  flow (see [Mood axiom](#mood-axiom)). A request
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
  runs every hour (or manually via *Run workflow*). It asks **Claude Fable 5.1**, at the **most
  reasoning effort** the CLI offers, reached through
  [GitHub Copilot](https://docs.github.com/copilot) and its
  [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) and billed to a GitHub Copilot
  subscription (see [Setup](#setup)), gives it the mission **"make the website more interesting as a
  coherent whole"** — where *interesting* means user engagement time, and nothing else (see
  [Engagement-time axiom](#engagement-time-axiom)) —
  and commits the result to `main`; the pipeline above then tests and deploys it. An answer that is
  unusable earns the same model another turn, for up to three attempts per run; no other model is
  ever substituted. See [Which model](#which-model).
- **One run at a time** — a run that starts while an earlier run of the workflow is still going
  skips itself and finishes green without doing anything, so there is never more than one
  iteration in flight. (To retry a failed run use *Run workflow*: *Re-run failed jobs* does not
  repeat the check, so it waits for the current run instead of skipping.)
- **One model, at max effort** — every run uses `claude-fable-5.1` and nothing else, and asks it
  for `max` reasoning effort. Nothing is picked at random (see [Which model](#which-model)).

### Building the site

`/site` used to be the published artifact as it stood. It is source now, and the build underneath it
is deliberately small: a foundation to build a more holistic experience on, not a framework to learn.

- **Eleventy, and two conventions.** [`eleventy.config.mjs`](eleventy.config.mjs) is the whole
  pipeline. An `.html` file is a [Nunjucks](https://mozilla.github.io/nunjucks/) template with
  optional YAML front matter; `layout: layout.njk` wraps it in the shared shell in
  [`site/_includes`](site/_includes), so the `<head>`, the stylesheet links, the analytics,
  local-state and mood lines, the mood ribbon and the footer are written once instead of in every
  page, and a page is little more than its `<main>`.
  A `.scss` file
  compiles to `.css` at the same path, and one whose name starts with `_` is a partial, built into
  whatever `@use`s it and never on its own. Every other file type is copied through verbatim, never
  rendered, so a stray `{{` in a script cannot break a build.
- **Common files.** [`site/_sass`](site/_sass) is what "shared partials" means here: the palette as
  custom properties a page can override (`_tokens.scss`), the base rules, the panel, the controls,
  the footer, the fourteen mood palettes and the query styling the mood flow renders into
  (`_mood.scss`), the values the stylesheets have in common (`_vars.scss`, which emits no CSS of
  its own) and the monospace readout ten pages use (`_readout.scss`, a mixin). `css/site.scss` is those
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
  and keep going, not on whether it looks tidy or busy. `MISSION` names the aim and `INTERESTING`
  names the measure, both in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py).
- **The cadence rule is the fifth `AXIOM`**, stated in the `Rules:` block beside the five below.
  It names every phrasing the code refuses, in full, so it is a rule a run can follow rather than a
  trap it springs: the words *tonight*, *tomorrow*, *yesterday*, *hourly*, *nightly*, *daily* and
  *weekly*; the possessives *today's*, *this hour's*, *this week's*, *this month's*; and *every
  hour*, *each day*, *once a week* and the rest of that family. It also asks a run not to send a
  visitor away — "move one star **and** ask again", never "move one star **tomorrow** and ask
  again" — because the next move is the one worth asking for.
- **Held to in code.** `check_cadence` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  puts one of those phrasings on a page. As with the five axioms below, only what the run itself
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
- **Stated in the prompt.** The `Rules:` block every run is given carries this as one `AXIOM`
  among six. It asks for more than any validator can judge — fluid layout
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

### Local state axiom

Everything this site keeps in a visitor's browser lives in one JSON document, every page reads and
writes it through one shared accessor, and a very small *state* menu in the corner of every page
takes that document out, puts someone else's in, or throws it away — so a person can collect their
skies here and hand one to someone else. Like the four above it, it is an invariant of the
iteration process rather than a one-off tidy-up.

- **One line per page.** Every page carries `<script src='js/state.js'></script>` in its `<head>`,
  written once in [`site/_includes/layout.njk`](site/_includes/layout.njk). It is deliberately not
  deferred, unlike the analytics line beside it: a page's own `<script>` runs while the body is
  parsed, which is before any deferred script, so the store has to be there already.
- **One document.** [`site/js/state.js`](site/js/state.js) keeps the whole of a visitor's state
  under one key, `interesting_state_v1`, as a self-describing envelope — `format`, `version`,
  `saved` and a `values` object — rather than a key per page with a parse and a `try`/`catch` per
  page to match. `values` holds the site's own page state and only that: the names today are
  `constellation` (the home sky every other page reinterprets), `capsules` and `omens`. The
  cookie-consent choice is not in there, because it belongs to the consent banner, which keeps it
  itself.
- **One way in and out.** `window.interestingState` owns the parsing, the defaults and every
  failure path. `read(key, fallback)` hands back `{ status, value }`, where `status` is `ok`,
  `missing`, `unreadable` or `unavailable` — a page can render first and explain afterwards, in its
  own words, because "you have not made a constellation yet" and "your constellation could not be
  read" are different things to say. `get` is the value alone; `set` returns `false` when it could
  only be kept in memory. **Two fallbacks**: an in-memory document when `localStorage` cannot be
  used — refused outright, or out of room part-way through a visit, after which what the page kept
  stays kept for as long as it is open — and the caller's default whenever a value is missing or
  the stored document is malformed. A `set` re-reads the document first and settles one name, leaving every other name as
  the browser has it: one document for the whole site is also one document for every tab of it, and
  a tab that wrote its own copy back whole would throw away what another tab had saved since.
- **The earlier keys are carried over.** `interesting_wish_constellation_v1` and its two siblings
  are folded into the document the first time a visitor arrives with them, and then taken away, so
  nobody loses a sky to the change.
- **The meta menu.** One button, bottom-right, opposite the consent banner's *cookies* button,
  bottom-left. It opens a panel holding the whole document as text: copy it out, paste one in and
  press *replace mine*, or *clear*. Import **replaces** rather than merges, for reproducibility —
  the sky it opens is the sky it came from — and clearing asks first. Both reload the page
  afterwards, which is the simplest honest way to show a state every page reads at load time.
  Export and import are copy-paste rather than file download, so sharing is a paste into any
  message. The panel is keyboard-operable, closes on Escape with the focus returned, carries its
  own focus ring and 44px controls because the pages are free to restyle their own, and fits a
  320px screen.
- **Stated in the prompt.** The `Rules:` block names the exact line, shows the three calls a page
  needs, names the keys the site keeps, and says that no page may touch `localStorage` or
  `sessionStorage` itself — nor any shared script it loads, which is why `js/threshold.js` keeps
  the mood reading through the store as well.
- **Held to in code.** `check_state` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  leaves a page without the line, and `pages_touching_storage` refuses one in which a page — or a
  shared script it loads — reaches for the browser's storage behind the store's back, because that
  would be state the meta menu could not export. As with the other five, only what the run itself
  breaks is refused.
- **The file is out of reach.** `js/state.js` is in `FIXED_FILES` beside the analytics files: never
  shown to a model, refused outright as a write or a delete, and skipping the prompt budget. A
  visitor's own way of getting their state back out of this site cannot be something an hourly
  rewrite might quietly reword.
- **True of the site as committed**, checked by `RealSiteTest` on every pull request and before
  every deploy: every built page loads the store, no page goes round it, the line is in the shared
  shell, and the earlier keys are still named in the migration. `LocalStateStoreTest` goes further
  and runs the real `state.js` against a stub browser
  ([`state_store_harness.mjs`](.github/scripts/state_store_harness.mjs)) — the fallbacks, the
  migration, export, import, clearing and the menu itself — because this is the one piece of
  behaviour on the site that every page leans on and no run may repair.

### Mood axiom

The site asks before it offers. The target of interest is **the whole population**, not the part of
it that happens to like whatever aesthetic the site is wearing, so no page puts particular content
in front of a visitor on the assumption that they want it: the site makes an effort to ascertain
their mood or mental orientation first, and what is offered follows from that. Like the five above,
this is an invariant of the iteration rather than a one-off change to the site as it stands.

- **One line per page, again.** Every page carries
  `<script src='js/threshold.js' defer></script>` in its `<head>`, written once in
  [`site/_includes/layout.njk`](site/_includes/layout.njk). That file
  ([`site/js/threshold.js`](site/js/threshold.js)) is the whole flow: fourteen orientations and
  the world each one opens onto, the library of query mechanisms, the clock and time-zone signals
  read alongside an answer, how much of a past visit survives, and the ribbon every page shows.
- **Queried, never asked to self-report.** A visitor is never asked to name their own state. They
  are asked about a door, a stone, the thing they would put in a pocket, the rate at which they
  tap, how long they hold a button down, where they put one mark in an empty field, which way they
  draw one line, where they set an unlabelled dial. Twelve mechanisms shipped with the axiom, and
  the clock, the time zone and the gap since the last visit are read alongside whichever one comes
  up.
- **Never the same way twice.** A mechanism counts as used the moment it is put in front of
  someone, answered or not, so the rule holds for a visitor who ignores the question as well as one
  who answers it. `check_mood` refuses a plan that leaves the site with fewer than
  `MIN_MOOD_PROBES` distinct mechanisms, counted out of the site's own source by their
  `probe: 'some-id'` declarations — so a run adds one simply by writing one, and **inventing
  another is the single most interesting change there is to make here**. The prompt says so where
  a run chooses what to do, beside "add a page".
- **Partly remembered.** What the site learns decays by half every thirty hours and a fresh answer
  always outweighs what is left, so a visitor is read again on every arrival rather than filed once.
  The ribbon says how long it has been since they were last here, and
  [`site/moods.html`](site/moods.html) will run any mechanism on demand or forget them entirely.
  The reading itself is kept under `threshold` in the one local-state document, through
  `window.interestingState` like everything else the site remembers, so it exports and travels with
  the rest of a visitor's state — and the gap that document already records is what tells an
  arrival apart from a click through the site.
- **The whole site transmogrifies.** The ascertained orientation lands on `<html data-mood>`, and
  `_sass/_mood.scss` turns that into fourteen palettes over the shared custom properties in
  `_tokens.scss`, so every page re-skins itself. The flow is ongoing rather than a gate at the
  front door: any page can ask again, in a new way.
- **Never a gate.** The query sits outside `<main>`, and every world is a plain link from the
  threshold, the site map and the shared wayfinding index, so the whole site is reachable with the
  question ignored, declined, or scripting switched off altogether. That is also what the
  reachability axiom demands, and `RealSiteTest` checks the stronger half of it: the threshold's
  own markup — not the scripts it loads — has to link to every world.
- **The shared script is protected, not fixed.** `js/threshold.js` joins `index.html`,
  `error.html` and `sitemap.xml` in `PROTECTED_FILES`: it may be rewritten and is always shown to
  the model, unlike the four fixed files, but it can never be deleted, because every page leans on
  it.
- **Stated in the prompt and held to in code**, the same arrangement as the others. `check_mood`
  in [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan
  that takes the line off a page, collapses the library, or puts a direct self-report question
  ("how are you feeling", "what's your mood", "pick your mood" and the rest of that short family)
  on one. Every refused phrasing is named in the prompt first, as with the cadence axiom, so it is
  a rule a run can follow rather than a trap it springs. Only what the run itself breaks is
  refused.
- **What is deliberately not checked**: whether a question is a good question, whether the
  orientations are the right orientations, and whether a world suits the orientation that opens on
  to it. No code could judge any of that, so the prompt asks for it and the checks do not pretend
  to.
- **True of the site as committed**, like the rest: `RealSiteTest` builds `/site` on every pull
  request and before every deploy and checks that every page carries the flow, that the library is
  wide, that no page asks outright, that every orientation opens onto a page that exists — with at
  least six of them off the sky — and that nothing is hidden behind an answer.

### Silo

The AI can only ever modify `/site` — but within it, everything: pages, the shared layout and
partials in `_includes`, the Sass in `_sass` and `css/`. There is no corner of the site it is kept
out of, because a run that cannot touch the shared files cannot make the site a coherent whole.

1. The model has no tools or shell: the Copilot CLI runs in an empty directory with every tool
   disabled, so the model only returns JSON describing files to write/delete. If the model ever
   manages to use a tool, the run stops and nothing is applied.
2. [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) rejects any path
   that is absolute, contains `..`/hidden segments or anything but lowercase letters, digits, `.`,
   `_` and `-`, resolves outside `/site` (including via symlinks) or has a non-static file type.
   It never deletes `index.html`, `error.html`, `sitemap.xml` or `js/threshold.js`, never writes or
   deletes the four fixed files — the three behind the analytics tag and the one behind the local-state store and its
   meta menu — never touches a file the model was not shown, and applies an answer whole or not at
   all.
3. The workflow fails if anything outside `/site` changed, and only stages `site/` for commit. The
   repository's token is not in the checkout while the model's answer is processed. The model's
   one-line summary is stripped to plain text before it reaches the commit message.

### Which model

One model, always: Anthropic's **Claude Fable 5.1** (`claude-fable-5.1`), asked for **`max`
reasoning effort**. Both are pinned as `PINNED_MODEL` and `REASONING_EFFORT` in
[`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py). Runs used to draw a
model at random from a dozen Copilot flagships; they no longer do, and nothing here picks a model
at random any more. One model thinking as hard as it can makes each hour's change as considered as
the plan allows, and makes one run comparable with the next.

- **`max` is the top of Copilot's scale** for `--reasoning-effort` (`none`, `minimal`, `low`,
  `medium`, `high`, `xhigh`, `max`), and the flag travels with every call the script makes.
  Thinking that hard takes minutes, which is what `MODEL_TIMEOUT_SECONDS` (12 minutes per answer)
  and the job's `timeout-minutes` allow for.
- **No fallback.** If Copilot retires the id, or the account's plan does not offer it, the run says
  which model it could not use and fails, rather than quietly substituting another one. Fix the
  plan or the policy (see [Setup](#setup)), or change `PINNED_MODEL`.
- **An unusable answer is asked for again**, from the same model, for up to three attempts per run
  — a model does not give the same answer twice.
- **Naming a model yourself** is still possible, for trying one by hand: type an id into the
  *Run workflow* form and that run uses it instead, with the departure noted in the log. Nothing
  unattended ever uses anything but `claude-fable-5.1`. A hand-named id that is recognisable as a
  small or mid-tier model earns a second warning: `haiku` and `sonnet`, and their equivalents at
  other providers such as `mini`, `nano`, `luna`, `terra`, `flash`, `lite`, `small`, `medium`,
  `micro` and `phi` (the full set is `SMALL_MODEL_MARKERS`). `fast` is on that list too, which
  also catches speed-tuned variants of flagships such as `claude-opus-4.8-fast`.

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
  the same allowance as that account's other Copilot use. `max` reasoning effort makes each of
  those calls think longer, and cost more, than a lesser setting would.
- Whether `claude-fable-5.1` can be used at all depends on who pays. The workflow's own token is
  only offered the models of the organization's Copilot plan and model policy: on 2026-10-02, for
  an organization with the policy enabled but no Copilot seats, that was `gpt-5.3-codex` alone. A
  personal token is offered every model of that user's plan. If the pinned model is not among
  them, every run fails and says so — there is no fallback (see
  [Which model](#which-model)).

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
