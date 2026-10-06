[![Deploy site](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/deploy.yml)
[![Make the website more interesting](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml)

# interesting
iterate a more interesting website

**https://makeitmoreinteresting.com/**

## How it works

- **`/site`** — the website, in source form. Everything anyone edits — a person or the hourly AI —
  lives here, and nothing else does: the pages, the shared layout and partials, the Sass, the feed
  with its one module per world and the configuration a content piece wears as a card and again as
  the feature it opens as (see [The feature and the feed](#the-feature-and-the-feed)), the three
  shared files behind the analytics tag (see [Analytics axiom](#analytics-axiom)), the one behind
  the local-state store (see [Local state axiom](#local-state-axiom)), the one behind the mood
  flow (see [Mood axiom](#mood-axiom)), the one behind a visitor's way of steering the site (see
  [Participation axiom](#participation-axiom)) and the shared helpers every page calls, among them
  the one destructive-control component (see
  [Destructive-caution axiom](#destructive-caution-axiom)). A request
  for a page that is not there gets `error.html` back, with a 404, from a CloudFront custom error
  response.
- **The build** — [`build.mjs`](build.mjs) turns `/site` into the artifact that is published to an
  S3 bucket behind CloudFront at [makeitmoreinteresting.com](https://makeitmoreinteresting.com/),
  in a throwaway folder outside the repository. Nothing generated is ever committed. The deploy
  changes one thing on the way — the GA4 measurement ID — and copies everything else as the build
  left it. See [Building the site](#building-the-site).
- **`/infra`** — the hosting, as code. [`infra/`](infra) is a self-contained Terraform project
  that owns the bucket, the CloudFront distribution, the certificate, the
  `makeitmoreinteresting.com` hosted zone and the records in it, the deploy IAM user, the Actions
  secrets the deploy uses — and this repository itself. It is applied by hand: no workflow here
  runs `terraform plan` or `apply`. See [`infra/README.md`](infra/README.md).
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
  runs every hour (or manually via *Run workflow*). It picks one of the heaviest models
  [GitHub Copilot](https://docs.github.com/copilot) offers, reached through the
  [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) at near-maximum reasoning
  effort and billed to a GitHub Copilot subscription (see [Setup](#setup)), gives it the run's
  mission — where *interesting* means user engagement time, and nothing else (see
  [Engagement-time axiom](#engagement-time-axiom)) —
  and commits the result to `main`; the pipeline above then tests and deploys it. Models the
  account cannot use are skipped. A model
  that returns an unusable answer is replaced by another random model, or asked again if no other
  is left, for up to three attempts per run.
- **Runs alternate** — an odd-numbered run is a *growing* run, with the mission **"make the
  website more interesting as a single coherent whole"**, and an even-numbered run is a
  *consolidating* run, with the mission **"consolidate, federate, refactor and clean up the website
  into a single coherent whole"**, which adds nothing. The workflow's run number decides (`n % 2`),
  the manual form can name a kind outright, and the commit message says which it was: it opens
  with *Make the website more interesting* or *Consolidate the website* (see
  [One single experience](#one-single-experience)).
- **One run at a time** — a run that starts while an earlier run of the workflow is still going
  skips itself and finishes green without doing anything, so there is never more than one
  iteration in flight. (To retry a failed run use *Run workflow*: *Re-run failed jobs* does not
  repeat the check, so it waits for the current run instead of skipping.)
- **Only the heaviest models, thinking hard** — the random pick draws from a short list of the
  heaviest models Copilot offers, the top of each provider's current line, and every one is asked
  for near-maximum reasoning effort (see [Which models](#which-models)); older flagships, lighter
  siblings and small and mid-tier models are never picked.

### Building the site

`/site` used to be the published artifact as it stood. It is source now, and the build underneath it
is deliberately small: a foundation to build a more holistic experience on, not a framework to learn.

- **Eleventy, and two conventions.** [`eleventy.config.mjs`](eleventy.config.mjs) is the whole
  pipeline. An `.html` file is a [Nunjucks](https://mozilla.github.io/nunjucks/) template with
  optional YAML front matter; `layout: layout.njk` wraps it in the shared shell in
  [`site/_includes`](site/_includes), so the `<head>`, the stylesheet links, the analytics,
  local-state, persona, helper, mood and feed lines, the logo and the constellation it opens, the
  persona floating opposite it, the sheet
  and the feed of every world are written once instead of in every page, and a page is nothing
  but its `<main>`. The feed, the site map and the mood atlas are rendered from
  [`site/_data/worlds.json`](site/_data/worlds.json), Eleventy global
  data that every template reads as `worlds`: the one flat list of the site's worlds.
  A `.scss` file
  compiles to `.css` at the same path, and one whose name starts with `_` is a partial, built into
  whatever `@use`s it and never on its own. Every other file type is copied through verbatim, never
  rendered, so a stray `{{` in a script cannot break a build.
- **Common files.** [`site/_sass`](site/_sass) is what "shared partials" means here, and it is
  the whole of the site's visual language (see [Material Design 3](#material-design-3)): the
  tokens (`_tokens.scss`: every M3 colour role derived from four seeds, the shape scale, the
  motion scheme, the elevation levels), the type scale as a mixin (`_type.scss`), the base rules,
  the main nav — the logo and its constellation (`_nav.scss`) — the buttons, chips, sliders and
  text fields, among them the warning button and the one confirmation modal (`_controls.scss`, see
  [Destructive-caution axiom](#destructive-caution-axiom)), the feature a page is and the filled
  card (`_panel.scss`), the unlock box, the persona's avatar
  and sheet (`_persona.scss`), the fifteen mood palettes and the query styling the mood flow
  renders into (`_mood.scss`), the feed's masonry and cards (`_feed.scss`) and the stage with its
  knobs (`_stage.scss`). `css/site.scss` is those partials and nothing else, and every page links the
  `css/site.css` it compiles to. A world page has no stylesheet of its own: its scene is drawn, not
  styled. `css/<page>.scss` is for the two list pages and holds what is true of that page alone,
  linked after the shared sheet so it overrides rather than repeats. `error.html` writes its styles into the page instead: CloudFront returns it for any 404,
  at whatever path was asked for, so a relative `<link>` next to it would be a guess. For the same
  reason it names the site's root in its front matter (`siteRoot: /`), and the layout writes its
  scripts and links from there; it is the one page that does, and a copy of the site served under
  a sub-path sets that sub-path there instead.
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

### Material Design 3

The site's one visual language is [Material Design 3](https://m3.material.io/), and it is written
once, in [`site/_sass`](site/_sass). It replaced a look that had grown by accretion — a frosted
slab per page, small-caps labels, pill borders on everything, a footer index two groups deep.

- **One tonal scheme, derived.** `_tokens.scss` works the way M3's dynamic colour works: four
  seeds (`--bg`, `--bg2`, `--accent`, `--accent2`) and every colour role derived from them with
  `color-mix()` — primary and its container, secondary container, tertiary, the five
  surface-container tiers, outline and outline-variant. The derivation is applied on `:root` and
  on anything carrying `data-mood`, so a mood re-skins the whole site and a card in the feed
  re-tints itself from its own world's seeds — a card the feed dealt from its world's seeds *and*
  its own configuration, which only ever blends the four that mood gives it (see
  [The feature and the feed](#the-feature-and-the-feed)). The dark scheme is the only scheme: the
  site is a night sky, and M3 lays dark surfaces out by tone rather than shadow.
- **A page's palette is its world's.** The fifteen palettes in `_mood.scss` are keyed by
  orientation id, the layout writes `<html data-world='…'>` from
  [`site/_data/worlds.json`](site/_data/worlds.json), and a visitor's reading on
  `<html data-mood='…'>` wins over it. No page carries colours of its own any more.
- **The activity on the stage outranks both.** `<html data-featured='…'>` is the third place the
  seeds land, written last in `_mood.scss`, so the piece a visitor picked colours the site over
  the page's own world *and* over the reading — and only while that piece is on the stage, because
  `js/stage.js` takes the attribute off again on the way home. The card that was pressed hands its
  own four seeds over with it, so the site takes the colour of that card and not merely of its
  world (see [The feature and the feed](#the-feature-and-the-feed)), and the shift is a crossfade
  through a neutral grey — a quick fade out to it, then a fuller fade into the new theme — or no
  shift at all for a visitor who asked for less motion.
- **The M3 parts, as classes.** The type scale is a mixin (`_type.scss`), and the components are
  the shared classes every page already used: a bare `<button>` is a tonal button, `a.action` an
  outlined one, `.btn-filled` and `.btn-text` the other two emphases, `aria-pressed='true'` reads
  as filled; `.panel` is a filled card, `.panel-title` title-medium, `.panel-note` body-medium;
  the logo and the chips of its constellation are tonal surfaces with M3 elevation, and the
  persona is the avatar floating opposite them; `input[type=range]` is the
  M3 slider with its 16px track and 4px handle (`js/site.js` keeps `--range-pct` on each one so
  the active track can fill to the handle). Every pressable thing carries a state layer, and the one focus indicator
  is a 3px primary ring.
- **No font is fetched.** Roboto is M3's default and is used where it is installed; nothing is
  loaded from a third party, which is the analytics axiom's rule for the site's own code too.
- **One build fix came with it.** Compressed Sass opens with a byte-order mark when a sheet holds
  a non-ASCII character, and inside the one page that inlines its styles (`error.html`) that mark
  glued itself to the first selector, which the browser then dropped — the whole `:root` block.
  The `css` filter in [`eleventy.config.mjs`](eleventy.config.mjs) strips it.

### The logo and the constellation

This is not the sort of website that uses conventional navigation (issue #54). The top app bar is
gone — the sticky blurred surface, its scroll lift, its row of destinations — and what is left is
two marks floating over the page: the sparkles **logo** in the upper left, and the **persona** in
the upper right. Nothing else is chrome. Two, exactly: a *go to <world>* link floated beside the
persona and a *steer the site* button held the middle of the bottom edge for a while after that
first pass, and both are gone (issue #64) — the first because the constellation already carried the
same destination, the second adopted into the far orbit beside *cookies* and *state*.

- **At rest, one mark.** A tonal pill with the sparkles in it, blurred so it reads over any
  world's palette. Roll over it, or give it the focus, and the site's name fades in beside it —
  quick and tight, clipped to nothing rather than hidden, so the logo keeps its accessible name
  either way.
- **On press, the lightbox.** The page goes behind the veil, which is not the logo's own: it is the
  one lightbox the whole site shares, the same one the persona sheet and the *are you sure?* modal
  open through — see [The lightbox](#the-lightbox) below. Escape, the veil and any destination all
  close it; Tab stays inside the menu while it is up, which is the one part of it the nav brings
  itself, because the nav is not a dialog.
- **The options branch out as a constellation.** Each one is a chip on a ray back to the logo's
  heart. `js/site.js` places them, because it is the only thing that can count them: the stars
  fall down the left edge in even steps, each pushed out sideways by its own amount so the set
  reads as a scatter rather than a list, and the second orbit takes a column of its own as soon as
  there is room for one — a phone gets one column, a wider screen two, and a short landscape
  viewport two because that is what makes them fit. `NavTest` holds the one thing a constellation
  of chips can get wrong that a list cannot: no two stars land on each other, on any of the three
  shapes of screen.
- **No ray is ever drawn over an option** (issue #72). A ray reaching across the scatter — the far
  column's out past the near column, a lower star's up past the chips above it — passes behind the
  pills in its way rather than across their labels. What is layered is the parts rather than the
  options: every ray, then every chip, then the logo they all leave from — all of it inside the
  one layer the shared lightbox lifts the whole mark into — so an option sets no layer of its own
  and the stacking cannot turn on the order the options happen to be in. `NavTest` holds both
  halves of that too — the harness reports each chip's box and each ray's line, so the geometry
  says which rays cross which chips on each of the three shapes, and the built stylesheet says a
  ray's layer is strictly below a chip's.
- **The near orbit is where to go, the far orbit is the apparatus.** Near: the three destinations
  from [`site/_data/worlds.json`](site/_data/worlds.json) — *the threshold* (the home icon, which
  is how a visitor gets home now that pressing the logo no longer navigates), *the mood atlas*,
  *site map* — plus the world a reading opens onto, once there is one. Far: *change this site*,
  *cookies*, *state*, *privacy* and *terms*.
- **Things come and go with the state.** The reading's world appears when the mood flow has read
  something and goes when it is forgotten; on that world itself the option says the world's name
  and is marked *you are here* rather than offering a trip to where the visitor already is, as the
  feed's own card does. *cookies* is there only on a copy of the site that has a measurement ID
  and so draws a consent banner. *state* says how much there is to carry away — *state · 3 kept*.
  And the option for the page a visitor is on carries `aria-current='page'` wherever it appears.
- **Three options are adopted, not copied.** *change this site*, *cookies* and *state* belong to
  `js/participate.js`, `js/analytics.js` and `js/state.js`, which are fixed files no run may write
  (see [Participation axiom](#participation-axiom), [Analytics axiom](#analytics-axiom) and [Local
  state axiom](#local-state-axiom)). So the shell does it from outside: it waits for each control
  to be drawn and hides it where its own file pinned it. *change this site* and *cookies* then
  press that same control, with the lightbox out of the way first, because what they open is
  somebody else's — a new tab and the consent library's own dialog. One new-issue link, one
  cookies dialog, one state menu, no fixed file touched — and `RealSiteTest` still holds every
  other file of the site to naming none of them.
- **…and *state* keeps the lightbox** (issue #66). It is the one option that is neither a place to
  go nor somebody else's dialog: it is a thing to do, and it gets the screen while it is being
  done. So the lightbox is not dropped for it. The constellation is put away, the panel
  `js/state.js` built is **moved** into `#sparknav-modal` — the middle of the veil that is already
  up — and dressed as a modal by that file's own styles: wider, taller, with room to read the
  document and paste one in. Nothing the lightbox is made of is torn down and raised again in
  between: `<html data-lightbox>` goes from `nav` straight to `state` without ever being removed,
  so the veil, the held frame loop and the inert page behind it never so much as blink. There is
  no way back to the constellation — Escape, the panel's own *close* and a press on the dimmed
  page around it all close the modal, and the lightbox goes down with it, which is what "return to
  the site" means. The asking is the shell's and the panel is the fixed file's, that way round on
  purpose: a store that offers no panel, or a run that breaks the asking, leaves the corner menu
  exactly as it always was, so nothing a run writes can leave a visitor without a way to their own
  state.
- **Which is what makes the two-item rule true.** At rest nothing floats over a page but the logo
  and the persona: nothing at the bottom edge, nothing beside either mark. `NavTest` holds both
  halves of it (issue #64) — the site's own stylesheets pin a closed list of things, every one of
  them one of the two marks, a part of one, an overlay only up while something is open, or the
  stage's own way on, which exists only on a page that is a stage and only while a piece is on it
  (issue #78); and the nav harness confirms that all three pinned controls are hidden where their
  files put them while the page is at rest, with every one of them still one press of the logo
  away.
- **The invitation leads off the site, and says so.** *change this site* is the one option in the
  constellation whose destination is not a page of this site. It presses the link
  `js/participate.js` drew, so the destination, the new tab and the query that shapes the issue are
  all still that file's; its accessible name carries the whole of the invitation — that this site
  is a continuously evolving work-in-progress art experiment, that the option opens a new issue
  where a visitor says what it should become next, and that it opens in a new tab.
- **It is a `<details>`.** The logo is the `<summary>`, so the disclosure, the keyboard handling
  and the no-script fallback are the browser's own: with scripting switched off the same chips
  cascade under the logo as plain links, staggered into a staircase where the script has said what
  order they are in. A viewport too short for a constellation of any shape falls back to that
  cascade as well, because it scrolls and a placed scatter cannot — an option below the fold would
  be one nothing could reach. Every option is written in the markup of every page,
  which is what keeps the [reachability axiom](#reachability-axiom) true without a script — and
  the two pages the far orbit added, `privacy.html` and `terms.html`, are listed in
  `sitemap.xml` and on the site map like everything else.
- **Responsive and accessible, like the rest.** 44px targets, the site's one focus ring, an
  accessible name on the logo with its visible word inside it (WCAG 2.5.3), `aria-current` on the
  page a visitor is on, and a `prefers-reduced-motion` path that drops the fade, the veil's fade
  and the branching alike.

### The lightbox

Everything on this site that floats over the whole page opens the same way, because it opens through
the same component. There are three of them: the constellation the sparkles logo branches out, the
**persona sheet** the avatar opens, and the one *are you sure you want to ______?* modal every
destructive control is guarded by. Before issue #70 only the first of them had any of this — the
veil was the nav's own element, in the nav's own markup, painted in the nav's own partial — and the
persona sheet was a bare `<dialog>` with a flat `::backdrop`: no blur, no fade, no stilled page, no
held frame loop. The note that became the issue put it plainly: *the lightbox effect for the main nav
(top left logo) is amazing!! the lightbox effect for the persona should be identical; they should
share a common lightbox component. the current persona lightbox is weak.*

- **Where it lives, and why there.** `window.interestingSite.lightbox()` in
  [`site/js/site.js`](site/js/site.js), painted by
  [`site/_sass/_lightbox.scss`](site/_sass/_lightbox.scss), over one `#lightbox-veil` the shell
  writes. Not a new `site/js/lightbox.js`: `js/site.js` is already where every shared component of
  the shell lives (`unlock`, `destructive`, `areYouSure`), every page already loads it, and it
  already loads after `js/persona.js` and before anything builds — which is the one ordering
  constraint a new file would have had to reproduce, for nothing. The veil is markup in
  [`_includes/layout.njk`](site/_includes/layout.njk) because the shell is markup; it is `hidden`
  until something raises it, so a visitor with no script gets no dimming they could not dismiss.
- **What raising one does.** Four things, and a caller gets all four or none. The **veil** dims,
  blurs and desaturates the page and fades in, and a press on it goes to whatever is on top. Every
  other child of `<body>` is **put aside** — `inert`, hidden from a screen reader, and marked
  `data-lightbox-aside`, which is also what the stylesheet pauses the CSS animations of; the one
  thing open is marked `data-lightbox-front`, which is what lifts it over the veil. The page's frame
  loop is **held**: the `requestAnimationFrame` callbacks a page asks for while a lightbox is up are
  kept and run when the last one comes down, because CSS can pause an animation but not a loop, and
  every animated page here runs one of its own. And `<html data-lightbox='nav'>` (or `'persona'`, or
  `'are-you-sure'`) says which one is up — written only when it changes, so a caller that renames
  its own box where it stands, as the constellation does when the state interface takes the lightbox
  over (`box.up('state')`, issue #66), never clears the attribute in between.
- **Which means each mark puts the other away.** The persona avatar goes behind the veil the logo
  raises, and the logo behind the veil the sheet raises. The two marks are one piece of chrome, and
  pressing either one of them makes the whole of the rest of the page the background.
- **They nest, because one opens over another.** *seed a small sky* in the persona sheet asks the
  shared question over a sky the visitor placed, so a second lightbox goes up over the first: the
  veil never drops, the frame loop stays held, the sheet goes behind the question while it is asked,
  and answering hands the sheet back to the front exactly as it was. The boxes are a stack and the
  top of it is what the page is arranged around.
- **A `<dialog>` keeps what a `<dialog>` is good at.** The persona sheet and the modal are still
  native dialogs, so the focus trap, Escape, the top layer and the press on the backdrop are the
  browser's own and nothing here reimplements them. The veil is the only thing they borrow, and
  their `::backdrop` is `transparent` so the shared veil is the only dimming — a backdrop of their
  own sits in the top layer *over* the veil and would flatten it.
- **Something drawn while a lightbox is up goes behind it.** Each of the three affordances the
  constellation adopts arrives from a deferred script, and one may arrive while the persona sheet is
  open, where the nav is watching nothing — so the lightbox watches `<body>` itself.
- **Tested as one component with three callers.**
  [`.github/scripts/lightbox_harness.mjs`](.github/scripts/lightbox_harness.mjs) loads the real
  `js/site.js` and `js/persona.js` into one stub browser and drives the logo, the sheet, the question
  asked from a page and the question asked over the sheet; `LightboxTest` asserts that all of them
  raise the same veil element, put the same page aside, leave exactly one thing in front and hold the
  frame loop, and `NavTest` still holds the nav's half of it.

### The feature and the feed

A page is its feature, and every page ends in the feed. Attention is the scarce thing on a page:
every typographical region and every boundary draws on it, so the shell spends none of it on
itself.

- **The feature fills the first screen.** A page's `<main>` is unbordered and full-bleed, the
  page's own palette washing to the viewport's edges, and at least the first screen tall (the
  viewport less the room the floating nav leaves and a margin), so the feed peeks above the fold
  on any display, a very large one included; the logo and the persona float over it, and it keeps
  the room they need clear at the top. Every direct child of `<main>` lands in one centred column
  (`_panel.scss`), so a page writes its content straight into `<main>`. A world page's `<main>` is
  the stage ([`site/_includes/stage.njk`](site/_includes/stage.njk),
  [`site/js/stage.js`](site/js/stage.js)): a piece of that world, played and finished there and
  followed by the next; see [Completion axiom](#completion-axiom). The threshold's feature is the
  same stage in its asking state: the sideways question itself, asked large on arrival, and once
  answered a piece of the world the reading opens onto.
- **The feed has no caption.** Its heading is written for screen readers only, and nothing says
  how many worlds there are or what to do with them: the grid speaks for itself. It replaced the
  footer index and its two groups, *off the sky* and *under the sky*, which are gone:
  [`site/_data/worlds.json`](site/_data/worlds.json) is one flat list now, and a world is a world
  whether or not it reads the persona's stars.


- **The cards the template writes are the index.** [`site/_includes/worlds.njk`](site/_includes/worlds.njk)
  writes one card per world from the list, each a plain link with the world's orientation over
  its name, in the world's own palette (`data-mood`) and aspect ratio (`aspect`), so the
  reachability axiom holds with scripting off and index.html's own markup links every world. The
  world a visitor is on is left out of its own feed. Without scripting the grid is CSS columns.
- **One module per world.** [`site/js/feed.js`](site/js/feed.js) lays the cards out
  Pinterest-fashion (each new card into the shortest column, so nothing already placed moves),
  paints each as it comes into view, and deals more as the bottom nears. What it paints and deals
  comes from [`site/js/modules/`](site/js/modules), one ES module per world named for its file:
  `paint(ctx, w, h, env)` draws the card, `spark(env)` makes one thing for the feed to deal — a
  coinage, a specimen, a rule with its bits, a core sample, an omen, a forecast, a mantra — with or
  without a picture and with `of` saying what the card is of, `animate()` is optional and never runs
  for a visitor who asked for less motion, and `needsSky` marks the eight that read the persona's
  stars. `piece(env)` makes the piece the stage plays when the card is opened
  (see [Completion axiom](#completion-axiom)), and every world's module has one, by law. `env` carries a seeded
  random source, the stars, the card's own colours and the helpers to mix them, and the card's
  configuration and content, so a card paints the same picture every time, a different one from
  its neighbour, and the feature it opens as is that same card.
- **A repeat is configured, not reprinted.** The feed deals without end, so every world comes round
  again and again, and a repeat used to differ only in whatever its module did with a fresh seed —
  same palette, same frame, four of the worlds drawing from the stars alone and so repeating one
  picture exactly. Every card the feed deals now carries a *variant*:
  [`site/js/variant.js`](site/js/variant.js), seven dials rolled from the card's own seed. Three are
  colour — which of the mood's two accents leads, how far the ground rises toward its lit corner,
  how far that corner is pushed into the accent — and the feed writes the four seeds they derive
  back onto the card, so `_tokens.scss` derives every M3 role from them, the card's surface and
  gradient follow, and `env.colors` hands the module the same four. The other four are shape:
  `stretch` frames the card away from its world's aspect ratio, and `density`, `scale` and `turn`
  are what every module leans on to draw itself differently. The card the template wrote keeps the
  variant that changes nothing, so a world leads with its own palette and its own frame and it is
  the repeats that vary; `--fg` and `--muted` are never configured, and the ground's ceiling is set
  where the contrast the accessibility axiom asks for runs out, which `CardVariantTest` measures
  over all fifteen palettes rather than taking on trust.
- **A card and the feature it opens as are one piece.** This is an axiom of the site, in the same
  spirit as the configuration above: *every content piece is procedurally configured, and that
  configuration is the same whether the piece appears as a card in the feed or as the feature it
  opens as* (issue [#80](https://github.com/outrightmental/interesting/issues/80)). It was not:
  pressing a card handed the stage the file, the seed and the four palette seeds and nothing else,
  so the feature was titled by the world's own one-line description from
  [`site/_data/worlds.json`](site/_data/worlds.json) — the same line for every card of that
  world, which is the generic text every card fell back to. The whole configuration travels now:
  `js/feed.js` reads what a card is showing and hands it over with the card's variant, through
  both the press and the next card off the stack, and `js/stage.js` revives it
  (`variant.revive`), features the card's palette, frames the scene by the same `stretch` that
  framed the card, writes the card's own title and line while the module loads, and hands the
  module `env.variant` and `env.card` — so a world's `piece(env)` is made from the two things its
  card was made from. A spark says what its card is *of* on its spec (`of`: the rule number, the
  coinage, the star it was drawn from — the module's own data, handed straight back), and every
  world's piece opens on that rather than rolling another: press *rule 110* and the bench runs
  rule 110. A piece nobody pressed — a direct visit to `world.html#<seed>`, or a world picked at
  random when the stack runs dry — is configured from its seed, which is where a card's
  configuration comes from too, and the stage derives the card that configuration would have
  dealt. The piece harness holds every world to it: a piece that is the same piece whichever of
  its world's cards it was opened from is refused, and the stage harness holds the stage to
  titling a feature from the card rather than from the world's line.
- **It follows the persona.** The world the visitor's reading opens onto is moved to the front and
  badged *for you*, and follows the reading as it changes. With no sky yet, a card that reads the
  sky paints a veiled ghost of itself, and one unpowered card is dealt early carrying the shared
  unlock (see [Powered down, never broken](#powered-down-never-broken)); every sky card repaints
  as stars are placed. Now and then the feed deals the question as a card, which opens the
  persona sheet — the one place that asks. Nothing in the feed writes to the state document.
- **Modular is the point.** A world is its page (two lines that include the stage), its line in the
  list and its module, and the feed is where the modules meet. Adding a world adds one of each; the hourly run
  is told so, and `RealSiteTest` holds the list, the modules and the mood flow to naming the same
  worlds, while `CardVariantTest` holds every module to varying with the card's configuration.

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
- **The cadence rule is the fifth `AXIOM`**, stated in the `Rules:` block beside the eight below.
  It names every phrasing the code refuses, in full, so it is a rule a run can follow rather than a
  trap it springs: the words *tonight*, *tomorrow*, *yesterday*, *hourly*, *nightly*, *daily* and
  *weekly*; the possessives *today's*, *this hour's*, *this week's*, *this month's*; and *every
  hour*, *each day*, *once a week* and the rest of that family. It also asks a run not to send a
  visitor away — "move one star **and** ask again", never "move one star **tomorrow** and ask
  again" — because the next move is the one worth asking for.
- **Held to in code.** `check_cadence` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  puts one of those phrasings on a page. As with the eight axioms below, only what the run itself
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
- **Runs alternate between growing and consolidating.** The prompt used to ask every run for
  both — re-federate aggressively, and add something only as the exception — and a run told to do
  both arrived at neither: it added a page and tidied a stylesheet, and the consolidation that was
  overdue stayed overdue. Now each kind gets a whole run. `run_kind()` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) reads the workflow's
  run number: odd is a growing run, even is a consolidating run (`n % 2`), and the manual *Run
  workflow* form can name either kind outright. The two differ in one block of the system prompt,
  between `ENVISION THE WHOLE FIRST` and `LEGIBLE TO A STRANGER`; everything else — the mission,
  the measure, the look at the whole, the holds, the axioms — is the same for both. A run the guard
  skips, or one that fails, still takes a number, so two runs of one kind can occasionally land in
  a row: the alternation is a rhythm, not an invariant.
- **A consolidating run re-federates, aggressively, and adds nothing.** `THIS RUN CONSOLIDATES THE
  SITE` rules out a new page, world, piece, query mechanism or feature, and `RE-FEDERATE,
  AGGRESSIVELY` asks the run to leave the site more of a single piece than it found it: lift the
  markup, styles and behaviour the pages repeat into the shared files
  ([`site/_includes`](site/_includes), [`site/_sass`](site/_sass), `css/site.scss`, a shared
  `js/site.js`), give every page the same header and navigation, settle on one visual language and
  hold every page to it. The prompt asks for the consolidation that is overdue rather than the one
  that is merely easy, and asks a run not to leave a near-duplicate standing because no single page
  is to blame for it. `REFACTOR AND CLEAN UP` adds the rest of the cleanup: dead code, unused
  styles, partials nothing includes, one name per thing, and undoing drift from the legibility
  holds — with the rule that what a visitor can do stays what it is, except where a merge or a
  retirement takes a near-duplicate away on purpose.
- **It reaches the pages themselves.** Merging pages that overlap and retiring the ones that no
  longer earn their place is part of re-federating, not a separate licence: the site is better as
  fewer pages that belong together than as more that do not. The reachability axiom is what keeps
  that safe — a page a run retires comes out of the navigation and the sitemap in the same run, or
  the plan is refused — and a run whose entire change is a deletion has always been accepted.
- **A growing run adds, and what it adds arrives federated.** `THIS RUN GROWS THE SITE` asks for
  the one change that most lengthens a visitor's stay and none of the tidying, which belongs to the
  run that follows: `ADD something` — new content, a new world for an orientation that has none, a
  second shape of piece for a world, a new way of querying a visitor's orientation
  ([Mood axiom](#mood-axiom)), an interactive toy, a hidden easter egg — or deepen what is there.
  Whatever a run adds arrives inside the shared layout, in the one visual language, wired into the
  one navigation, sharing the styles and behaviour it has in common with the rest, in that same
  run, and nothing it adds may repeat what a shared file already does. A page that stands apart
  leaves the site less of a whole however good that page is on its own, so a growing run is held
  to the whole as firmly as a consolidating one.
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
  whole" — and so does `CONSOLIDATION_MISSION`, the consolidating run's: "consolidate, federate,
  refactor and clean up the website into a **single** coherent whole".
- **Not a coded axiom, on purpose.** No check could settle whether a site reads as one
  experience, in the way `check_reachability` settles whether a page is orphaned, so this is a
  standard stated to the model and nothing else — the same reasoning that leaves the
  engagement-time definition uncoded. A plan that adds a page sharing nothing with the rest is
  accepted exactly as before. A test holds that open: it asserts the accepted plan *and* the whole
  list of `check_` functions, so an axiom cannot be added or retired without saying so there. That
  list grew to eight when [Destructive-caution axiom](#destructive-caution-axiom) arrived and to
  nine with [Completion axiom](#completion-axiom), which is what tells a standard no check could
  judge apart from a law that can be held.

### Legible to a stranger

Engagement time says how good the site has to be and *One single experience* says what shape it has
to be in. This says what it has to read like: **legible to a stranger** — a first-time visitor on a
phone can tell what the site is, what any page is for, what to do on it and where to go next,
without being told twice. Confusion spends engagement time as surely as boredom does, and a site
rewritten continuously by a model told to engage and to federate drifts, left to itself, towards
more chrome: by 2026-10-05 every sky page ended in eight stacked "relay" panels, three trail
gadgets and a world index, ~85 controls and six thousand pixels on a phone, nine of them ways of
saying where to go next, and the home page explained none of its own words.

- **Stated in the prompt.** `LEGIBLE` names the standard beside `WHOLE` and `INTERESTING` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py), and the system
  prompt spells out what it asks for under `LEGIBLE TO A STRANGER`, before the `Rules:` block so it
  is in hand while a run is still choosing, and again in the line a run reads last.
- **Six holds**, each one a thing a run can check its own change against: one name per page, used
  everywhere; one sentence of plain purpose at the top of every page, with the site's own terms
  explained once where a visitor first meets them; one way to do each thing (one navigation, one
  suggestion of where next, one index of every world, one place that asks — a new control
  improves the one that exists or replaces it, never stands beside it); content first and chrome
  small (the whole of the chrome is the logo in one top corner and the persona in the other; a
  page's feature fills the first screen, and what follows it is the feed and nothing else, with no
  caption); copy that speaks to the visitor
  and never about the machinery; and never a dead end, which is its own standard below.
- **Deliberately not held to in code.** No check could judge whether a page reads clearly, so the
  prompt is where this standard lives, exactly as `WHOLE` and `INTERESTING` do: it is not among the
  nine coded axioms, and `LegibilityStandardTest` holds the prompt to the standard the way
  `EngagementTimeTest` holds it to the measure.
- **One list of pages.** [`site/_data/worlds.json`](site/_data/worlds.json) is the one place a
  world's name, orientation, mood, card aspect and one-line description are kept, in one flat
  list. The feed ([`site/_includes/worlds.njk`](site/_includes/worlds.njk)), the site map and the
  mood atlas are rendered from it, counts included, so most of "one name per page" is a property
  of the build. Three places still carry the name by hand and change with the list: the page's
  own `title:` and `<h1>`, its `worldName` in `js/threshold.js`, and its `<loc>` in
  `sitemap.xml`; and a world's module in `js/modules/` is named for its file.
- **The shell it left behind.** The main nav is the sparkles logo in the upper left and the
  constellation it opens (see [The logo and the constellation](#the-logo-and-the-constellation)),
  with the persona floating opposite it (see [Persona](#persona)); a page's `<main>` is its
  feature and fills the first screen; every page ends with the feed, the one index of every world,
  which has no caption (see [The feature and the feed](#the-feature-and-the-feed)) — the site map
  and the mood atlas included, since both retired the world list each used to write itself and
  point at the cards below instead. That is the whole of the shared chrome, written once in
  [`site/_includes/layout.njk`](site/_includes/layout.njk), and a page sets nothing about
  navigation: no footer lists, no notes, no includes. A run is asked to keep it that size.

### Powered down, never broken

Wherever a component depends on something the visitor has not done yet, the component's only
announcement of that is the solution, in place (issue #46). A world that reads the saved sky does
not say "make one on the wish constellation page first" and does not offer a *refresh* button to
press after coming back: it presents as unpowered — dimmed, inert, like the part of an adventure
game whose generator has not been started — and carries the one button that starts it, *seed a sky
to begin*, which writes a small random sky to the persona exactly as placing stars in it would,
and powers the world up where the visitor stands. A quieter second choice may follow the button
and never replaces it: for the sky, a button that opens the persona sheet, where stars are placed
by hand.

- **Stated in the prompt**, under `POWERED DOWN, NEVER BROKEN`, to the model only: as with `WHOLE`,
  no check could tell a dead end from a deliberate one, so a `check_` of its own was ruled out
  (issue #46, question 1).
- **Held in the framework.** `window.interestingSite.unlock(host, { onReady })` in
  [`site/js/site.js`](site/js/site.js) is the pattern made shared: pass it the element to power
  down and the function to run once a sky exists, and it renders the unpowered state, the button and
  the quiet second choice, writes the seeded sky through the persona, and calls back — now, if a
  sky is already there, when the button is pressed, and again every time the sky changes in the
  persona while the page is open, so a world follows the sheet floating over it star by star and
  powers down again if the sky is cleared. [`site/_sass/_unlock.scss`](site/_sass/_unlock.scss)
  styles the powered-down host and the unlock box once for every page. All eight worlds that read the sky use it, the wish constellation included, and so
  does the feed's unpowered card; `js/site.js` is loaded without `defer` so the helper
  exists by the time a page's own script runs.
- **It applies when the prerequisite cannot be performed, too.** A browser that stores nothing
  still gets the button; the sky it seeds lasts for the page, and the box says so in one line.
- **The background action is the visitor's action.** The seeded sky is written under
  `constellation` like any other and overwrites what was there (question 4), so every sky world,
  the state menu and an exported document all see the same thing.

### Persona

The sky that several worlds read is a visitor's configuration of this site, and for a while
it was configured on one world of eighteen, the wish constellation, which made that page the
settings screen for the rest and left the rest pointing at it. It is a **persona** now — the term
interaction design uses for the configured self a system addresses — kept and changed in one place
and shown on every page.

- **One module.** [`site/js/persona.js`](site/js/persona.js) owns the sky as data (the key, the
  validation, the seeding, the thoughts a star carries, every write) and as interface. Every page
  loads it from the shared shell, without `defer`, so a world can read
  `window.interestingPersona.stars()` while its body is parsed and follow changes with
  `window.interestingPersona.onSky(fn)`. The eight sky worlds read the sky; none of them places a
  star, and the wish constellation is a world like the other seven: the persona's stars hung across
  the whole page, with the oracle, the meteors, the chime, orbit mode and the postcard, and a sky
  that follows the sheet as it is edited. A caught meteor adds a star through the persona, so every
  other world sees it too.
- **The avatar.** In the upper right of every page floats the persona the way an app
  shows its account: a round portrait of the sky, which is the button that opens the sheet. That
  shape is understood on sight, and it takes no room from the page's feature: with no persona yet
  the portrait ring is dashed and the button, *set up persona*, is filled and beckoning, the one
  lit control on the page, so the first thing to do is the first thing seen. Once there is a
  persona the portrait alone remains, its label *open persona* read by a screen reader, and the one
  sentence on where things stand is written beside it for screen readers only. Nothing else is ever
  put in that corner: a *go to <world>* link used to sit beside the avatar on a wide screen, which
  made two floating items of one corner and a third piece of navigation on the site, and the world
  a reading opens onto is an option in the logo's constellation instead, where it already was
  (issue #64). On a phone the feed's first card carries the same suggestion, as it always has.
- **The sheet.** The button opens a `<dialog>` floating over whatever page is open — inside the one
  lightbox the whole site shares, so the page behind it is dimmed, blurred, stilled, held and inert
  exactly as it is behind the logo's constellation; see [The lightbox](#the-lightbox) — with two
  sections. *Constellation* is the sky editor: tap the sky to place a star, drag one to move it,
  tap one to read its thought and remove it, or drop one, seed a small sky, or clear the sky — by
  pointer or by keyboard, where the arrow keys move a focused star and *Delete* removes it. Every
  change is written through the one state store under `constellation`, exactly as before, so the
  state menu, an exported document and a world open underneath all see the same sky at once.
  *Orientation* is the mood flow's home: it says what was read, asks the sideways question
  (`js/threshold.js` supplies the mechanism through `window.threshold.mount`) and forgets on
  request. When nothing has been read yet the sheet asks of its own accord on opening, so setting
  up a persona is placing a sky and answering one question, in one place.
- **Where the question is asked.** The threshold still asks on arrival, inline and never in the
  chrome: `index.html` hosts `#persona-probe` in its own `<main>`, so the question is that page's
  feature, asked large, and it is never a dialog in a visitor's way; the mood axiom's *never a
  gate* holds as it did. Every other page keeps the question one press away, inside the sheet.
  `js/threshold.js` is the engine only — orientations, mechanisms, signals, memory, `arrival()` —
  and draws no chrome.
- **Explained once, where it is met.** The sheet's first line says what a persona is, and the
  sentence beside the avatar, for screen readers, says where things stand. The word appears in
  the prompt too, so a run knows that no page places stars itself and that the avatar is the one
  way in.

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
  among eight. It asks for more than any validator can judge — fluid layout
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
  itself. The shared shell writes two names and no more: `threshold`, the mood flow's reading, and
  `constellation`, which the persona writes when a visitor places a star or asks a powered-down
  world to seed a sky; the nine names the
  shell's retired games once kept (`constellation-relay` and its kin) are taken out of a visitor's
  document on load, so an export stays an honest account of what the site keeps.
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
- **The meta menu.** *state*, an option in the logo's constellation (see [The logo and the
  constellation](#the-logo-and-the-constellation)): the button `js/state.js` pins to the
  bottom-right corner is hidden there and the option offered in the nav beside *cookies* and the
  *change this site* of the [participation axiom](#participation-axiom) instead, so nothing is
  left on the bottom edge at all. It opens a panel holding the whole document as text: copy it
  out, paste one in and press *replace mine*, or *clear*. Import **replaces** rather than merges,
  for reproducibility — the sky it opens is the sky it came from — and clearing asks first. Both
  reload the page afterwards, which is the simplest honest way to show a state every page reads at
  load time.
  Export and import are copy-paste rather than file download, so sharing is a paste into any
  message. The panel is keyboard-operable, closes on Escape with the focus returned, carries its
  own focus ring and 44px controls because the pages are free to restyle their own, and fits a
  320px screen.
- **Where that panel opens** (issue #66): in the middle of the lightbox the constellation was just
  in, not in the corner it is built in. `window.interestingState.menu.present(host)` is the one
  thing this file offers a shell — it moves the panel into the host, dresses it as a modal with
  its own styles and opens it, and hands back a function that closes it and puts it where it was.
  So the state interface takes up the whole screen and the visitor's whole attention while they
  are in it, and closing it puts them back on the page. Its contents, its words and its reload
  after an import or a clear are exactly as they were; only the framing changed. The offer is the
  fixed file's and the asking is the shell's, which is what makes it safe: the corner menu still
  works on its own, so a run that rewrites `js/site.js` badly cannot take a visitor's way to
  their own state away.
- **Stated in the prompt.** The `Rules:` block names the exact line, shows the three calls a page
  needs, names the keys the site keeps, and says that no page may touch `localStorage` or
  `sessionStorage` itself — nor any shared script it loads, which is why `js/threshold.js` keeps
  the mood reading through the store as well.
- **Held to in code.** `check_state` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  leaves a page without the line, and `pages_touching_storage` refuses one in which a page — or a
  shared script it loads — reaches for the browser's storage behind the store's back, because that
  would be state the meta menu could not export. As with the other eight, only what the run itself
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
their mood or mental orientation first, and what is offered follows from that. Like the five above
and the two below, this is an invariant of the iteration rather than a one-off change to the site as
it stands.

- **One line per page, again.** Every page carries
  `<script src='js/threshold.js' defer></script>` in its `<head>`, written once in
  [`site/_includes/layout.njk`](site/_includes/layout.njk). That file
  ([`site/js/threshold.js`](site/js/threshold.js)) is the whole flow: fifteen orientations and
  the world each one opens onto, the library of query mechanisms, the clock and time-zone signals
  read alongside an answer, and how much of a past visit survives. What it reads is shown beside
  the persona's avatar and in the persona sheet
  ([`site/js/persona.js`](site/js/persona.js), see [Persona](#persona)). The threshold asks
  unprompted, in its own feature, because it is the page that is the question; on every other
  page the question waits inside the sheet, one press away, so a visitor who followed a link to a
  world meets the world first, and every mechanism carries its own *skip*.
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
  always outweighs what is left, so a visitor is read again on every arrival at the threshold
  rather than filed once, and invited to be read again on every other page.
  [`site/moods.html`](site/moods.html) says how long it has been since they were last here, runs
  any mechanism on demand, and forgets the reading on request.
  The reading itself is kept under `threshold` in the one local-state document, through
  `window.interestingState` like everything else the site remembers, so it exports and travels with
  the rest of a visitor's state — and the gap that document already records is what tells an
  arrival apart from a click through the site.
- **The whole site transmogrifies.** The ascertained orientation lands on `<html data-mood>`, and
  `_sass/_mood.scss` turns that into fifteen palettes over the shared custom properties in
  `_tokens.scss`, so every page re-skins itself. The flow is ongoing rather than a gate at the
  front door: any page can ask again, in a new way. The reading is the site's standing skin, not
  the last word on its colour: an activity on the stage is featured over it (`<html
  data-featured>`) for as long as its piece is there, so the site matches the card a visitor
  picked, and the reading has the site back the moment nothing is featured.
- **Never a gate.** The query sits outside `<main>`, and every world is a plain link from the
  threshold, the site map and the shared index of every world, so the whole site is reachable with the
  question ignored, declined, or scripting switched off altogether. That is also what the
  reachability axiom demands, and `RealSiteTest` checks the stronger half of it: the threshold's
  own markup — not the scripts it loads — has to link to every world.
- **The shared script is protected, not fixed.** `js/threshold.js` joins `index.html`,
  `error.html` and `sitemap.xml` in `PROTECTED_FILES`: it may be rewritten and is always shown to
  the model, unlike the five fixed files, but it can never be deleted, because every page leans on
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
  least six of them not sky worlds — and that nothing is hidden behind an answer.

### Participation axiom

Every page carries a **way for the person looking at the site to say what it should become**: one
press of *change this site*, in the far orbit of the logo's constellation, and they are on a new
issue of this repository with the form already chosen and the page they came from already filled
in. The link behind it is the one `js/participate.js` pins to the middle of the bottom edge; the
shell hides it there and presses it from the constellation (issue #64), so the invitation is one
press from every page without a third thing floating over any of them. Like the six above it, it is
an invariant of the iteration rather than a one-off addition — and it is the only one that is about
the reader rather than about the site.

- **Why it is an axiom and not a nicety.** A site rewritten continuously by a model is steered by
  whoever can reach the model, and the only standing channel from a visitor back to the people and
  the prompt behind it is an issue here. A run that reworded the invitation, moved it somewhere
  quieter or dropped it altogether would be closing that channel — exactly the kind of change no
  run should be able to make and no reviewer would notice for a long time.
- **One line per page.** Every page carries `<script src='js/participate.js' defer></script>` in
  its `<head>`, written once in [`site/_includes/layout.njk`](site/_includes/layout.njk). Deferred,
  unlike the local-state line beside it: nothing on the page waits for it, and there is no API for
  a page to call.
- **The cadre of meta-menus.** Three affordances belong to the fixed files and to no page —
  *cookies* (the consent banner's way back to the choice), *steer the site*, and *state* (the
  local-state document, in and out). Each injects its own styles rather than reading a stylesheet,
  each is fixed to the device boundary rather than placed in page content, and none of them is a
  page's to restyle, reproduce or reword. That is what makes them reliable: whatever the page
  around them has become, they answer. Each of the three pins itself over the page where its own
  file says — *cookies* bottom-left, *steer the site* in the middle of the bottom edge, *state*
  bottom-right — and all three are **adopted** rather than copied: the shell hides the control each
  fixed file drew for itself and offers *change this site*, *cookies* and *state* in the logo's
  constellation (see [The logo and the constellation](#the-logo-and-the-constellation)), pressing
  the link and the button the first two drew and hosting the state menu's own panel in the
  lightbox — one new-issue link, one cookies dialog and one state menu on the site, with no fixed
  file restyled or reworded to arrange it. *state* is the one of the three that is not a corner
  affordance at all any more once it is open: it is a modal in the middle of the screen, because
  what it holds is a document to read, copy and paste rather than a question to answer in passing.
  The invitation is still the prominent member of the three, now by where it sits in the orbit
  rather than by holding an edge of the viewport to itself: it comes first in the far orbit,
  because the other two answer a question a visitor occasionally has while this one asks something
  of them.
- **Responsive and accessible, like everything else here.** An accessible name that says where the
  link goes and that it opens a new tab, with the visible words inside it (WCAG 2.5.3 Label in
  Name); its own `:focus-visible` ring, because pages of this site are free to take the browser's
  away for their own controls and several do (2.4.7); a 44px target (2.5.8); and no motion at all,
  so there is nothing to answer for when less of it is asked for.
- **Nothing of the visitor travels.** The link carries two things: the form to open, and the file
  name of the page the button was pressed on. Not the constellation, not what the mood flow has
  read, not a single value out of the local-state document — what this site keeps stays in the
  visitor's own browser and a new-issue URL is a public page. The page name is about the site
  rather than about the person, and it saves them describing where they were. `rel="noopener
  noreferrer"` means the new tab gets nothing of the old one either, and
  `ParticipateButtonTest` holds the absence: the file reaches for no stored value at all.
- **Templating on the GitHub side.** [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE) is what
  "excellent templating from there" means here. `steer-the-site.yml` is the form the button opens:
  one required box — *what should the site do, be, or become?* — a prefilled *where you were*, an
  optional *how far does it reach?*, an optional *why it would make the site more interesting*
  (which says what *interesting* means here, so an answer can aim the next change), and a closing
  note on what happens next and on the eight things no change can break. `something-is-wrong.yml`
  is the other half of steering, for a page that does not work, and it points at the *state* button
  for anyone whose saved sky is part of the problem. `config.yml` keeps blank issues enabled: a
  form is here to save someone the trouble of inventing a shape, never to insist on one — the same
  bargain the mood axiom's question makes. The two labels the forms ask for are owned in code, with
  the repository itself, in [`infra/issue-labels.tf`](infra/issue-labels.tf).
- **Stated in the prompt.** The `Rules:` block names the exact line, says the link and its wording
  are not a run's to change, to restyle or to reproduce, names the three affordances, and says how
  the shell adopts all three of them into the main nav so that a run never draws a second
  new-issue, *cookies* or *state* control of its own — and that it pins nothing of its own to an
  edge of the viewport, which is the two-item rule of issue #54 stated where the axiom whose
  affordance used to be the exception to it can be read. A page inviting a visitor to steer the
  site in its own prose is welcome, and is not a substitute for the line.
- **Held to in code.** `check_participate` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses a plan that
  leaves a page without the line. As with the other eight, only what the run itself breaks is
  refused.
- **The file is out of reach.** `js/participate.js` is in `FIXED_FILES` beside the analytics files
  and the local-state store: never shown to a model, refused outright as a write or a delete, and
  skipping the prompt budget. It is the one thing on the site that answers to the person reading it
  rather than to the model writing it.
- **True of the site as committed**, checked by `RealSiteTest` on every pull request and before
  every deploy: every built page carries the line, the line is in the shared shell, the three
  corner affordances each keep to their own edge, and the form the button names is a file that is
  really there. `ParticipateButtonTest` goes further and runs the real `participate.js` against a
  stub browser ([`participate_harness.mjs`](.github/scripts/participate_harness.mjs)) — the link,
  its name, its icon, what it knows about which page it is on, and what it refuses to carry.

### Destructive-caution axiom

Caution before a destructive action is a law of the site rather than a page's own choice. Any
control that throws a visitor's saved state away **reads as a warning button**, and **every press of
one opens the one shared modal** that asks *"are you sure you want to \_\_\_\_\_\_?"* with the
specific thing about to go in the blank — *clear your constellation*, *throw away everything this
site has kept in your browser* — and never a generic "are you sure?". Like the seven above, it is an
invariant of the iteration rather than a one-off tidy-up.

Both halves are about **consistency**, not about friction. The button is recognised as dangerous
before it is read, because it is the only warm control on a site of cool ones; and the question is
the same question in every corner, so a visitor learns in one place what a press is going to cost
them everywhere. **That is the safety switch** — there is no separate arming affordance, no
checkbox, no toggle and no hold-to-arm press, and the modal is a plain confirm/cancel with nothing
to type and no second press. *Don't overdo it.*

- **The threshold**, because there is a spectrum of severity and the caution has to begin
  somewhere:
  - **Above it**, held to both halves: a press that is **nothing but a loss**. The whole
    local-state document goes, or the whole of one name in it — a sky, a reading, a kept list — and
    nothing takes its place. Today: the meta menu's *clear*, the persona sheet's *clear the sky*
    and *forget my reading*, and the mood atlas's *forget my reading*. No world adds one of its
    own any more — a world's page is a stage and its piece keeps nothing, so there is no
    world-owned list left to throw away (see [Completion axiom](#completion-axiom)).
  - **At it**, held to the modal but not the warning: a **trade rather than a loss**. The whole of
    a name goes, but something the visitor asked for arrives in its place — *seed a small sky* over
    a placed one, *replace mine* over your own document. The question is the same; the paint is
    not, because the one button that gets a beginner started, and the one that walks a visitor into
    someone else's sky, are not dangers to be warned about.
  - **Below it**, held to neither: **one thing rather than the whole thing** — *remove this star*,
    one entry out of a list that can be added to again, which one more press puts back — and
    anything that only changes what is on the screen: *sweep the floor*, *reset decoder*, *turn the
    soil*. *remove* is the site's word for the one-item case, and naming it that is what lets the
    sweep of words below stay narrow.
- **One shared component.** `window.interestingSite.destructive(control, options)` in
  [`site/js/site.js`](site/js/site.js) is the whole law made shared: pass it the control and what
  the press is about to cost, and it paints the warning, guards every press with the modal, and
  calls back when the visitor says yes. `areYouSure(options)` is that modal alone, for a control at
  the threshold rather than above it. `options.when` says whether there is anything to lose right
  now, so an empty drawer emptied again takes nothing away and asks nothing — and the warning stays
  on the control either way, because a control that changes its clothes is a control nobody learns.
  [`site/_sass/_controls.scss`](site/_sass/_controls.scss) paints both: `button.warning` beside the
  ordinary pill, and `.are-you-sure`, which reaches every page through `css/site.scss`.
- **What a visitor is owed, once.** The modal is a `<dialog>`, so the browser supplies the
  backdrop, the focus trap and Escape; the focus starts on *cancel*, because the one press someone
  who got here by mistake should be a key away from is the one that changes nothing, and it comes
  back to the control that opened it however the question is answered — after the lightbox has come
  down, because the control it goes back to was `inert` a moment before. A press on the backdrop
  dismisses it, the buttons are 44px and wrap, and the box fits a 320px screen. Nothing in it
  animates, so there is no motion to answer for.
- **And it is asked over the same lightbox as everything else.** The question goes up through
  `window.interestingSite.lightbox()` (see [The lightbox](#the-lightbox)), so the page behind it is
  dimmed, blurred, stilled and out of reach while it is asked — the same veil the sparkles logo and
  the persona sheet raise. Asked from a control *inside* the persona sheet, as *seed a small sky* is,
  it is the second lightbox up: the veil never drops, the sheet goes behind the question, and
  answering hands the sheet back to the front. The same stack is what wakes the dialog up before it
  is shown: the dialog is a child of the body, built the first time anything asks, so a lightbox
  already up may have put it behind the veil with the rest of the page long before — and since the
  state interface asks from inside the logo's lightbox now (issue #66), one is. Naming it as the one
  thing to leave in front is what takes those marks off again, at ask time. A question nobody can
  answer is worse than no question.
- **The meta menu adopts it too.** [`site/js/state.js`](site/js/state.js) is in `FIXED_FILES`, is
  never shown to a model and deliberately carries its own inline styles — and its *clear* still
  goes through the shared component, because a visitor should meet the same question there as in a
  world. It used to ask `window.confirm('Clear everything this site has kept in your browser?')`
  and wear no warning at all. The one concession to the file being fixed is an adapter: if
  `js/site.js` — ordinary site source, and a run's to rewrite — no longer offers the component, the
  menu falls back to the browser's own question, which is less good and still asks. The menu paints
  its own `.warning`, under the same class name, for the same reason it paints its own everything.
- **Stated in the prompt.** The eighth `AXIOM` in the `Rules:` block names the class, shows the
  call, states the three steps of the threshold, and names in full the family of words the code
  reads as destructive — *clear*, *forget*, *empty*, *erase*, *wipe*, *delete*, *discard*, *throw
  away*, *throw out* — so it is a rule a run can follow rather than a trap it springs, as with the
  cadence and mood axioms.
- **Held to in code.** `check_destructive` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) refuses three
  things: a plan that leaves the site without the shared component (the behaviour in `js/site.js`
  or the `.warning` treatment in `css/site.css`); a plan in which a control whose own words say it
  throws saved state away does not wear the warning class, read off the page as committed; and a
  plan in which a page, or a script it loads, calls `window.confirm`. As with the other eight, only
  what the run itself breaks is refused, and every reason is one control's name or one file's, so a
  partial repair can only take reasons away.
- **What is deliberately not checked**: whether a given control is above the threshold or below it,
  and whether a warning button's press really reaches the modal. No regex can tie a click handler
  to the button it was attached to, and no code can judge how much a visitor would miss what a
  press takes away. So the prompt asks for both and the check does not pretend to — the same
  bargain the mood axiom makes with "is this a good question".
- **Read off the page as committed**, like the reachability and accessibility checks: `<script>`
  bodies are handed over as opaque text, so a control a page builds inside a JavaScript string is
  not a control of the page. The meta menu's own buttons are built that way and are in a fixed file
  besides, which is why `LocalStateStoreTest` is what holds them instead.
- **True of the site as committed**, not only of what a future run writes: `RealSiteTest` sweeps
  the built site on every pull request and before every deploy. That sweep is what found *clear
  omens*, *empty the drawer* and *empty the kiln* pressing without a word of warning — controls
  that have since gone with the pages that kept those lists — and the two `window.confirm` calls
  the persona sheet had grown. `LocalStateStoreTest` drives the meta menu's
  *clear* and *replace mine* against the stub browser, with the shared component in place and with
  it taken away, so the confirmation path there stays tested.

### Completion axiom

Every world is a piece a visitor can finish. A world's page is not fixed content but a **stage**,
and what a visitor opens there is a **piece**: a small, randomly configured item — think of a
fidget toy with a few levers and knobs on it — generated on the spot by the world's module from a
seed, with a clear flow that asks them to make a few choices and finish, expediently. When it is
finished it plays its ceremony and lights up the way on — one mark, in the lower right of the
screen — and there it stays: nothing moves on by itself, and the press of that mark is what
vanishes the whole piece and opens the next card in the feed in its place, so one piece follows
another without end and no two are quite the same. A "content page" does not discretely exist: it
exists as a procedural generation, and the feed that keeps dealing is the river of pieces coming
up the pipe. Like the eight above, this is an invariant of the
iteration, stated in the prompt and held to in code.

- **The stage.** [`site/_includes/stage.njk`](site/_includes/stage.njk) is every world page's
  `<main>` — a world page is front matter and two lines that include it — and
  [`site/js/stage.js`](site/js/stage.js), one shared line in the `<head>`, runs it: the world's
  name over the piece's title and its one line, the scene (a canvas) beside the knobs, a row of
  dots for progress, and the ceremony — a done mark over the scene, a burst in the world's palette
  and a short chime; for a visitor who asked for less motion there is no burst and no transition,
  only the mark. The scene fills the real estate the first screen has (issue #65): it
  is as tall as the viewport leaves once the nav's room, `<main>`'s padding, the heading — measured,
  because a title that wraps takes two lines — and the margin that lets the feed peek are off it,
  and as wide as that height allows at the piece's own aspect ratio, which is also the width of its
  column, so the knobs take every pixel it cannot use and no empty band is left across the middle of
  the page. The threshold is the same stage in
  its asking state. The URL carries the piece (`quiet-room.html#<seed>`), so a piece can be sent
  to someone and the back button walks back through what was finished; opening a card of another
  world moves the address to that world's page without a load, because a page is wherever the
  stage is. So is the site's colour: the piece on the stage is what the whole site is wearing
  while it is there — `<html data-featured>` and the pressed card's own four seeds, over both the
  page's world and the visitor's reading (see [Material Design 3](#material-design-3)) — so
  picking a card out of the feed shifts the site to match the card that was picked, and going home
  gives the reading the site back.
- **The way on** (issue
  [#78](https://github.com/outrightmental/interesting/issues/78)). The ceremony used to end in a
  departure: a linger of a second or so, and then the stage saw itself out whether the visitor was
  ready or not. What it ends on now is one mark pinned in the lower right of the viewport — a
  double caret, dim for the whole piece and lit the moment it is over — and the stage stops there.
  Pressing it is what scales the piece away and brings the next in from below, so a finished piece
  is the visitor's to sit with for as long as they like. It takes the keyboard as it lights, so
  whoever finished the piece with a key can go on with one. And it never moves between pieces,
  because it is pinned to the screen rather than laid out with the knobs, and written outside the
  box the vanish transforms — a transformed ancestor being what a fixed child would be positioned
  against. A *skip this one* button used to sit under the knobs; it is gone, the feed below being
  where a visitor goes to pick a world of their own. The one place the way on lights early is a
  stage with nothing to finish — a piece waiting on a sky, a world whose module is missing —
  because a stage is never a dead end.
- **The piece contract.** A world's module exports `piece(env)` beside `paint` and `spark`, and is
  handed the same configuration both halves of it are — `env.variant`, and `env.card` for the card
  this piece was opened from (see [The feature and the feed](#the-feature-and-the-feed)) — and
  returns `{ title, brief, aspect, steps, start, apply, frame, tap, end }`: two to five knobs
  (`steps`), each `{ id, ask, kind, … }` of a kind the stage renders — `choice` (two to four
  options), `toggle`, `range`, `press`, `hold`, `tap`, `wait` — and the piece is finished when
  every knob is set (the stage sets a choice, toggle, range, press or hold itself; a tap or a
  wait knob is set by the piece, through `ctx.satisfy`), or when it calls `ctx.complete()`. A
  knob may wait on another (`after`), and every knob stays live once set: a toy is for fidgeting
  with. `ctx` is the canvas and its context, the size, the world's colours, a seeded random
  source, the persona's stars, and `status()` and `progress()` for the one live line and the
  knob's bar; `frame(t, dt, ctx)` counts `t` from the piece's start, and `auto: false` lets a
  piece call `complete()` itself. A module is self-contained: it imports nothing. `js/stage.js`
  documents all of it at the top.
- **Settable, in any order, and sayable.** Every knob has to be one the visitor it is put in front
  of can actually set, and a piece has to be finishable whatever order they reach its knobs in:
  nothing makes anyone work down the page. The way that fails is quiet — the visitor sets the last
  knob they can see, the scene answers, and the piece does not finish, because it is waiting on one
  further up that never looked unfinished — so the stage names what is still to set under the
  piece's own live line. A slider is the case that taught this (issue
  [#60](https://github.com/outrightmental/interesting/issues/60)): it opens with an answer already
  on it, which is why `ctx.value(id)` is the piece's from the first frame, so pressing it and
  letting go where it stands is giving that answer and the stage takes it as set.
- **One instantiation, then nothing.** A piece is its turn on the stage and no part of it outlives
  that turn. The stage has one teardown, and it takes the whole piece apart — the frame loop, the
  ceremony's timers, a ticker under a hold still pressed down, the knobs, the lines, the dots, the
  mark, the scene and its shape — so a world that comes round again opens on an empty stage and
  plays exactly as it did the first time. A module keeps nothing outside `piece(env)` for the same
  reason.
- **Pure, so it can be played anywhere.** A piece is drawing and arithmetic on what the stage
  hands it and never reaches for the document, the window or the browser's storage. That is what
  lets [`.github/scripts/piece_harness.mjs`](.github/scripts/piece_harness.mjs) play every piece
  to its end in Node, with no browser: it asks each module for a piece for each of six seeds and
  sets the knobs the way the stage would — a choice at one of its options, a range at a point on
  it, a press pressed its count, a hold held its time, the scene tapped at seeded points for a
  tap knob, frames run for a wait knob — and reports whether the piece finished; one seed is also
  played with the sky the stage may hand the module (none, or a single star). Each module plays
  in a worker of its own with a time limit, an empty environment and no clock, no `Math.random`
  and no timers, so a piece that reaches for any of them fails; the run itself starts under
  Node's permission model with a scrubbed environment, because the modules are model-written
  code (a quality gate, not a security boundary: the site's source is public). Every seed is then
  played a second time with its knobs reached in a seeded order rather than down the page, and the
  first seed is played through again from the top, which has to come out exactly as it did the
  first time. The first seed is then played three times more, for the alignment axiom (see
  [The feature and the feed](#the-feature-and-the-feed)): under a configuration away from the
  no-op one, as the card that configuration deals it, and as a card another seed was dealt. All
  three have to finish — a sky can change under a card, so a piece reads the one it is handed
  defensively — and the last two have to be different pieces, because what a feature is follows
  from the card it was opened from. The harness is not in `/site`, so a run cannot soften it.
- **The stage, played too.** A piece can be flawless and the stage still leave the visitor playing
  it with no way to finish, because the knob the piece offered is not a knob the stage will take —
  which is what issue #60 was.
  [`.github/scripts/stage_harness.mjs`](.github/scripts/stage_harness.mjs) runs the real
  `js/stage.js` against a stub browser: the elements `_includes/stage.njk` writes, a clock the
  scenario steps by hand so a 1.8-second hold costs nothing, a canvas that records nothing, and a
  feed that deals the worlds it is told to. Six scenarios: a world played, another played, and the
  first dealt again, each round finishing, sitting out six seconds of its own clock to prove the
  stage does not see itself out, and then opening the next when the way on is pressed; a slider used
  where it stands, which must count; a knob nobody touched, which must stay unset *and* be named,
  with the way on still dim over it; a hold held past the fill, which must be set by the bar filling
  and not by the release (issue #74); a piece abandoned with a hold still pressed down, after which
  nothing of it may be on the stage or still running; and a card pressed, which must open as that
  card — its own title and line while the module loads, its configuration on the piece's `env`, its
  stretch on the scene's frame, and never the world's generic line (issue #80).
  `StageTest` plays purpose-built pieces through it and `RealSiteTest` plays the site as committed;
  like the piece harness it is outside `/site`, so a run cannot soften it. Deliberately, it holds
  the site as committed rather than refusing a plan: it drives the stage through the stage's own
  elements, and those are a run's to rewrite, so gating plans on it would pin markup the silo leaves
  open. The prompt says so, and says to keep all seven true when rewriting the stage.
- **Held to in code.** `check_completion` in
  [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) reads the one list
  of worlds off the built home page (the `#site-worlds` JSON the layout writes from
  `_data/worlds.json`, which the stage opens pieces from too) and refuses a plan that leaves a
  listed world without a module, without a `piece()`, or with a piece the harness cannot finish:
  one with fewer than two knobs or more than five, one that finishes itself before its visitor has
  set a knob, a knob of a kind the stage does not render, a piece that
  does not finish within twelve taps and forty-five seconds of simulated play, one that is not
  the same for the same seed (a piece is an address), one that does not finish the same way with its
  knobs reached in another order or played a second time, one that is the same for every seed
  (the river is of pieces that differ), or one that is the same piece whichever of its world's
  cards it was opened from (the alignment axiom: a feature is the card that was pressed). Only what
  the run itself breaks is refused, as with every other axiom, so a run can repair a world that is
  already stuck; and a plan that drops the list
  of worlds is refused outright, because the stage would have nothing to open.
- **Re-thought, not wrapped.** The worlds' old interactive pages were the material: what a page
  let a visitor do became the knobs, what it showed became the scene, what it said became the
  title and the line under it. The pages themselves are gone; a world has no stylesheet of its
  own any more, because its scene is drawn rather than styled.
- **What is deliberately not checked**: whether a piece is a good toy, whether its knobs are the
  right knobs, and whether its finish feels like one. No code could judge that; the prompt asks
  for it, names the old pages as the material, and says a second shape of piece for a world is
  as good a change as a new world. The stage is checked, but on the committed site rather than on a
  plan, for the reason given above.
- **True of the site as committed**: `RealSiteTest` builds `/site` and plays every world's piece
  to its end on every pull request and before every deploy, plays the stage itself through the four
  scenarios above, checks that every world page is the stage and that the threshold hosts the
  question on it, and checks that the limits the prompt states are the harness's own.

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
   It never deletes `index.html`, `error.html`, `sitemap.xml` or `js/threshold.js`, never writes or
   deletes the four fixed files — the three behind the analytics tag and the one behind the local-state store and its
   meta menu — never touches a file the model was not shown, and applies an answer whole or not at
   all.
3. The workflow fails if anything outside `/site` changed, and only stages `site/` for commit. The
   repository's token is not in the checkout while the model's answer is processed. The model's
   one-line summary is stripped to plain text before it reaches the commit message.

### Which models

The random pick only ever draws from the heaviest models Copilot offers, listed as `MODELS` in
[`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py): the top of each
provider's current line, and nothing older or lighter. Today they are Anthropic's Fable 5.1,
Fable 5 and Opus 5.5, OpenAI's GPT-6.1 Sol, GPT-6 Sol and GPT-6 Astra, and Moonshot's Kimi K3.
Flagships of an earlier generation (Opus 5, Opus 4.8, GPT-5.6 Sol), the general-purpose model a
tier down (GPT-5.5) and the coding-tuned sibling (GPT-5.3-Codex) used to be in the pool and are
deliberately out of it. Google has no model in the pool, because Copilot only offers the Gemini
Flash tier.

- **Near-maximum reasoning effort, every call.** Every model is asked for `--reasoning-effort
  xhigh`, one step below the CLI's `max` on its scale of `none`, `minimal`, `low`, `medium`,
  `high`, `xhigh`, `max`. The repository variable `REASONING_EFFORT` overrides it (`none` sends no
  flag). A model with no effort dial is asked once more without the flag rather than lost to the
  run, and because the answer takes longer at that effort, a model has a quarter of an hour to
  answer (`MODEL_TIMEOUT_SECONDS`) and the job an hour for its three attempts.
- **As much room to write as the CLI can ask for.** A run that re-federates half the site writes a
  long answer, and an answer that runs past the model's output limit used to be thrown away. Every
  call now asks for 64,000 output tokens — about a quarter of a megabyte of JSON
  (`DEFAULT_MAX_OUTPUT_TOKENS`), overridable with the repository variable `MAX_OUTPUT_TOKENS`
  (`none` asks for nothing) — and the prompt says that number out loud, so the model sizes the
  answer to fit before it starts writing. Copilot CLI 1.0.91 has no flag for a maximum output, so
  the budget travels in `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS`, the one variable it reads for one; on
  GitHub's own model routing the cap comes from Copilot's model catalog and the prompt is what
  carries the budget. An answer that runs past the limit even so is no longer lost: the CLI carries
  a cut-off answer on in a second turn, and the script puts the pieces back together, falling back
  to rejecting the answer and retrying with another model only when they cannot be rejoined.
- **Small models are never picked at random.** Besides not being on the list, any model whose id
  contains a small or mid-tier name is refused: `haiku` and `sonnet`, and their equivalents at
  other providers such as `mini`, `nano`, `luna`, `terra`, `flash`, `lite`, `small`, `medium`,
  `micro` and `phi` (the full set is `SMALL_MODEL_MARKERS`). `fast` is on that list too, which
  also keeps out speed-tuned variants of flagships such as `claude-opus-4.8-fast`.
- **Changing the pool** needs no code change: set the repository variable `MODEL_POOL` to a
  comma-separated list of Copilot model ids. Models recognised as small or mid-tier are still
  refused. List the heaviest only, though: the rule works on names, so it cannot judge an unknown
  id that is only a version number, and it cannot tell an older flagship from the current one. The
  non-flagships known today, such as `gpt-5.4`, are refused by id.
- **Naming a model yourself**, through the *Run workflow* form, is not a random pick: the model is
  used as asked, with a warning in the log if it is not a flagship.
- Models that Copilot has retired or that the account cannot use are skipped automatically.

### Setup

- **Hosting** — run `terraform apply` in [`infra/`](infra) once, by hand. That creates the bucket,
  the distribution, the certificate, the hosted zone and its records, and sets the five repository
  secrets the deploy reads (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`,
  `AWS_CLOUDFRONT_DISTRIBUTION_ID` and `GA_MEASUREMENT_ID`). No secret is set by hand: they come
  from the same apply that creates or names what they point at, so they cannot drift from it.
  [`infra/README.md`](infra/README.md) has the order and the costs — including the one step AWS
  cannot do for itself: pointing `makeitmoreinteresting.com`'s nameservers at the hosted zone, at
  the registrar, before the certificate can be validated. Until that apply has run, the deploy
  says so in its summary and finishes green instead of failing hourly — so run it around the time
  this lands, because GitHub Pages is retired and nothing else publishes the site.
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
  for again, and each one goes to one of the heaviest models at near-maximum reasoning effort, so
  each costs more than a call at a model's default effort would. They are billed as Copilot AI
  credits to whoever pays (see the two routes above), from the same allowance as that account's
  other Copilot use.
- Which models can be picked depends on who pays. The workflow's own token is only offered the
  models of the organization's Copilot plan and model policy: on 2026-10-02, for an organization
  with the policy enabled but no Copilot seats, that was `gpt-5.3-codex` alone, so every "random"
  pick landed on it — and that model is no longer in the pool, so such an organization now needs
  seats, a personal token, or a `MODEL_POOL` of its own before any run can land. A personal token
  is offered every model of that user's plan. The run log names the models it tried that the
  account could not use.

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
`LocalStateStoreTest` and `ParticipateButtonTest` run the two fixed scripts a visitor actually
operates against a stub browser in Node, for the same reason. `IssueFormTest` reads the issue
forms as text, and parses them as YAML when PyYAML is importable.

To try a real run without touching the repository's site, point the script at a copy (this needs a
logged-in `copilot` CLI). The build still runs from this repository, on a copy of whatever the model
proposes:

```bash
cp -R site /tmp/site-copy && SITE_DIR=/tmp/site-copy python3 .github/scripts/make_interesting.py
```
