/*
  The stage: where a piece is played, finished, and replaced by the next.

  One line in the <head> of a page carries it, written once in _includes/layout.njk:

      <script src='js/stage.js' type='module'></script>

  A page's feature is not a fixed page any more. It is a piece, and every piece is a puzzle: a
  small, procedurally generated problem with a stated goal, a few controls to answer it with, and
  one way to find out whether the answer is right -- made on the spot by a world's module from a
  seed. The visitor studies the scene, sets their answer on the knobs, and presses *check*; the
  stage asks the piece whether that answer solves it, and only a solved answer finishes the piece.
  A wrong answer costs a try, says so, and leaves everything exactly as it was, so the visitor can
  think again. When the puzzle is solved it plays its ceremony -- and then it waits. The stage
  never moves on by itself (issue #78): the ceremony ends by lighting the way on, one mark pinned
  in the lower right of the screen for every piece, and the press of that is what vanishes the
  piece and opens the next card in the feed's stack in its place. So one puzzle follows another
  without end, and it is the visitor who says when. _includes/stage.njk writes the stage; this
  file runs it; js/feed.js hands it the next card.

  ---------------------------------------------------------------------------------------------
  The puzzle axiom: every piece is a legitimate puzzle

  A fidget toy finishes when its levers have been pulled; a puzzle finishes when it is solved, and
  that is the whole difference. Every piece on this site is held to what makes a puzzle legitimate:

    - a goal, stated in one line (`goal`), that says what counts as solved;
    - the information needed to solve it, in the scene and the brief -- deduction, not guessing;
    - an answer the visitor commits to on the knobs and checks with one press, so a wrong answer
      is a try spent and not a hint handed over knob by knob;
    - a verifier (`check(ctx)`) that says whether the answer solves it, and a solution the piece
      knows (`solution`) that the law can prove solves it -- and prove that every wrong answer
      does not;
    - and every declared answer load-bearing: change any one of them and the puzzle is no longer
      solved.

  Two families of piece live inside that. A *deduction* puzzle puts everything on the screen and
  asks for an answer (a cipher to read, an order to find, a count to make, the odd one out). An
  *experiment* puzzle asks for a setting and runs the apparatus when the answer is checked (aim
  the probe through the ring, tune the spring so the swing crosses in three breaths): its
  check() computes the run deterministically and its frame() replays it, so a try is a run. In
  both, a wrong check gives feedback and never the answer, and a hint is the piece's to offer,
  at a price it reports through ctx.hint().

  ---------------------------------------------------------------------------------------------
  The continued-interaction axiom: Done is not the End

  A piece of content does not End just because it is Done (issue #86). Finishing is a report, not a
  closing time: finish() plays the ceremony, says so beside the progress dots and lights the way on,
  and changes nothing whatever about how playable the piece is. The frame loop keeps running, a tap
  on the scene still reaches tap(), every knob stays enabled and can be set again -- including one
  that was gated behind another, since every gate stands open once everything is set -- and the
  piece keeps hearing apply() for all of it. There is no timeout, no fade, no inert state and no
  teardown in between; close() is the one teardown and the only thing that reaches it is the next
  piece actually opening, which only the press of the way on can do.

  Two things follow from that, and are deliberate. The done mark is laid out with the rail at the
  end of the dots' row, not over the scene: a finished piece's picture is still the content, and
  the report on it does not get to sit on top of it or take a corner of it. And the ceremony runs
  exactly once -- one 'stage:complete', one chime, one burst -- so fidgeting with a finished toy
  changes the piece without re-staging the finish.

  ---------------------------------------------------------------------------------------------
  The responsiveness axiom: every press on the scene does something

  Unresponsiveness is uninteresting (issue #89). A press on the picture is a visitor asking the
  piece a question, and an answer of nothing at all is the one answer this site does not give.
  Most of the time the piece answers: the press reaches its tap(), and what it draws, satisfies or
  moves is the answer. The rest of the time the stage answers for it, with the smallest
  acknowledgement there is -- one small mark at the point pressed, a fifth of a second, gone
  (rejectTap()). That is a press received and nothing here, which is a different thing from
  silence.

  When the stage answers rather than the piece: a piece with no tap() of its own, a piece whose
  every tap knob is still locked behind another, a piece whose tap() threw -- and the stage's own
  non-live moments, a module still loading or a piece on its way out, where there is no piece to
  reach at all. The handler asks nothing about the mode, so every state the scene is on the screen
  in is covered by the one rule; the states it is not on the screen in -- unpowered, empty, and the
  threshold quiet or asking -- hide the scene in _sass/_stage.scss and offer the button that seeds
  a sky, or the way on, already lit. Nothing else about the contract moves: a piece that handles
  the tap goes on handling it, a tap knob is satisfied by the piece's own tap() and by nothing
  else, and the mark never satisfies a knob, advances the progress, finishes a piece or reaches the
  piece at all.

  It is deliberately tiny, and deliberately mute. Not a dialog, not a line of copy, not a shake of
  the whole frame: nothing that interrupts a piece a visitor is in the middle of, and nothing that
  could be mistaken for the piece itself answering. No sound either -- the chime belongs to the
  finish, and a site that clicked at every press is a site nobody can play in a quiet room. A
  visitor who asked for less motion gets the mark held still and taken away again rather than the
  ripple, which is what the theme's crossfade and the ceremony's burst do with the same query.

  A piece that wants to refuse one particular press refuses it itself, inside tap(): the stage
  cannot tell a tap the piece considered and declined from one it acted on, and guessing would put
  the stage's mark on top of the piece's own answer.

  ---------------------------------------------------------------------------------------------
  The alignment axiom: the feature is the card that was pressed

  Every content piece on this site is procedurally configured, and that configuration is the same
  whether the piece appears as a card in the feed or as the feature it opens as (issue #80). A card
  is a seed, the variant rolled from it (js/variant.js) and the content its world's module made for
  the two; all of that travels with the card to this file -- open(file, seed, { variant, card }) --
  and nothing is re-rolled on arrival. So the feature wears the card's palette (feature()), is
  framed by the card's own stretch (begin()), is titled by what the card was showing (heading()),
  and hands the module the same configuration on env, which is how a piece can be the very thing a
  visitor pressed rather than another item from the same world.

  The world's one-line description is never a feature's title. It is the same line for every card of
  that world, so writing it while a module loads, or when a world has no piece, was exactly the
  generic text the cards fell back to; the card's own title stands there instead. A piece opened with
  no card behind it -- a direct visit to `world.html#<seed>`, or a world picked at random when the
  stack has run dry -- is given the configuration that seed would have dealt (variant.revive) and the
  card that configuration would have made (sparkOf), so the axiom holds with no feed in the story.

  ---------------------------------------------------------------------------------------------
  The piece contract -- what a world's module (js/modules/<world>.js) exports as piece(env)

      piece(env) {
        return {
          title: 'the dark room',                   // the puzzle's name, in the site's voice
          brief: 'Press a lamp and it flips itself and its four neighbours.',   // the rules
          goal: 'Put every lamp out.',              // one line: what counts as solved (required)
          aspect: '1 / 1',                          // the scene's shape (optional)
          checkLabel: 'check the room',             // the word on the check button (optional)
          steps: [                                  // the knobs, 2 to 5 of them, in order
            { id: 'lamps', ask: 'the lamps', kind: 'grid', rows: 4, cols: 4 },
            { id: 'hint', ask: 'one lamp shown', kind: 'press', count: 1, label: 'show one' }
          ],
          solution: { lamps: [1, 0, 0, 1, ...] },   // for every answer knob, the value that solves
                                                    // it (required; see below)
          check(ctx) {                              // the verifier (required): read the answer off
            const dark = ...;                       // ctx.value(id) and say whether it solves
            return { solved: dark, say: dark ? 'every lamp is out' : 'three lamps still burn' };
          },
          start(ctx) {},                            // the scene is ready to draw on (called again
                                                    // after a resize if the piece has no frame)
          frame(t, dt, ctx) {},                     // one frame (optional); t is seconds since the
                                                    // piece started, dt since the last frame
          apply(id, value, ctx) {},                 // a knob was set (the stage sets it)
          tap(x, y, ctx) {},                        // the scene was tapped, x and y in 0..1
                                                    // (optional; a 'tap' knob needs it. A press
                                                    // this never reaches is answered by the stage
                                                    // -- the responsiveness axiom above)
          end(ctx) {}                               // the finale, once, when the puzzle is solved;
                                                    // the piece plays on after it (optional)
        };
      }

  Knob kinds. An *answer* knob is one named in `solution`; the rest are helpers (a hint, a run,
  a view to switch), and a piece may use any kind for either, except that press, hold and wait are
  never answers. Every knob is the visitor's to set; what the stage reads back is ctx.value(id).
    choice   2-4 options; apply(id, option.value)
    toggle   one button, on or off (off unless `value` is true); apply(id, boolean)
    range    a slider: min, max, step, value, low, high (the words at the ends); apply(id, number)
             on every move, set the first time the visitor lets go of it -- moved or not, because a
             slider already has an answer on it; ctx.value(id) is where it starts from the first
             frame on. In `solution` a range may be { value, near }: any value within `near` of
             it solves, which is how an experiment names a target with a tolerance
    number   an exact count: min, max, step, value, unit; a stepper with a field, set the first
             time it is stepped or typed into; apply(id, number)
    word     a short typed answer: length (the most letters), placeholder, upper (true to
             capitalise as typed); set once something is typed; apply(id, string). The verifier
             compares how it likes (case, spaces); solution gives the string
    order    items ({ label, value }) the visitor arranges with up and down; value is the array
             of item values in their current order, set at the first move; solution gives the
             array that solves
    pick     items ({ label, value }) with `count` to choose; value is the array of chosen item
             values in item order, set once exactly `count` are chosen (any number, if `count` is
             left out); solution gives the array
    grid     rows x cols cells of `states` states (2 unless given) the visitor cycles by pressing;
             value is the flat row-major array of cell states (from `value` if given, else all 0),
             set at the first press; `labels` names the states for a screen reader; solution gives
             the array
    press    one big button pressed `count` times (label); apply(id, n) each press, set at count
    hold     one big button held for `ms` (label); apply(id, heldMs) the moment the bar fills
    tap      the scene itself, tapped: the piece's tap() decides, and calls ctx.satisfy(id) when
             the knob is set (ctx.progress(id, 0..1) shows how close). A tap answer's solution is
             { taps: [{ x, y }, ...], wrong: [{ x, y }, ...] } -- the points that solve it, in
             order, and points that do not -- because only the piece knows where its targets are.
             The stage adds a 'tap for me' button for anyone who cannot tap the scene, which taps
             at a random point, so a tap knob with a *location* answer is one a piece should pair
             with a knob of another kind, or turn into a grid or a pick
    wait     a timed phase the piece runs in frame(): it calls ctx.progress(id, 0..1) and
             ctx.satisfy(id) when done
  Only a tap or a wait knob is the piece's to set, and never before the visitor has set
  something themselves. A knob with `after: '<id>'` is disabled until that knob is set. A knob
  with `optional: true` is a helper the check does not wait for -- a hint, a second look -- so a
  one-answer puzzle can offer one without forcing it; it is never an answer. Every knob stays
  live once set, and stays live once the puzzle is solved -- a solved puzzle is still the
  visitor's to play with -- but the ceremony plays once.

  The check. The stage renders one filled *check* button under the knobs, enabled once every
  knob is set, and a press of it is a try: the stage calls check(ctx) and the piece answers
  { solved, say }. Solved finishes the piece (ceremony, the done chip reading *solved*, the way on
  lit); not solved writes `say` -- or 'not yet' -- on the live line, counts the try, and changes
  nothing else. A piece never finishes itself: there is no complete() and no auto, and a tap or a
  wait knob being set is one more knob set, not a finish. ctx.tries is how many checks there have
  been and ctx.hints how many hints the piece has reported with ctx.hint(); the stage shows both.

  The solution. `solution` names every answer knob and the value that solves it; the law sets the
  knobs to it and presses check, and a piece that does not solve on its own solution is refused.
  It then sets every answer wrong at once, and each answer wrong on its own with the rest right,
  and a piece that is solved by any of those is refused too, because a declared answer that does
  not matter is a knob that is not an answer. A wrong value is the other option, the opposite
  toggle, the far end of a range or a number, the string with its last letter changed, the order
  with its first two swapped, the pick with one chosen swapped for one not, the grid with one
  cell cycled, the tap at the piece's own `wrong` points. So design the answer so that those are
  wrong: a range whose far end also solves is a target with no edge.

  ctx.set(id, value) is for a piece whose scene is the control: a tap on a cell of a grid drawn
  on the canvas, an item dragged into order. It may only be called from tap(), it writes the
  value onto the knob (the rail follows), and it counts as the visitor setting that knob.

  Every knob has to be settable by the visitor it is put in front of, and the stage has to say
  which ones are not set yet. A knob nobody can satisfy is a puzzle nobody can check, and the way
  that goes wrong is quiet: the visitor sets the last knob on the page, the scene answers, and
  nothing happens, because the check is waiting on one further up that never looked unfinished.
  The line under the live line names what is left, for exactly that (issue #60).

  A piece is one instantiation and nothing of it outlives its turn. close() is the one teardown
  and it takes the whole piece apart -- the frame loop, the ceremony's timers, a ticker under a
  hold still pressed down, the knobs, the check, the lines, the dots, the mark, the scene and its
  shape -- so every piece opens on an empty stage however many times its world has come round
  before. Its turn runs to the press of the way on and not to the solve: nothing is torn down
  while the visitor is still playing, however long ago they solved it.

  env, what piece() is handed, and the same configuration js/feed.js hands paint() and spark():
    { seed, rnd(), pick(list), int(a, b), chance(p), hash(text), stars, points(w, h, pad),
      colors, mix(a, b, t), alpha(c, a), reduced, world: { file, name, orientation },
      variant, card, difficulty, rite }. variant is the configuration this piece is of (js/variant.js):
    variant.density is how much of itself to draw, variant.scale how large, variant.turn where to
    start, and the stage has already framed the scene by variant.stretch and painted the site in
    the colours the three colour dials derived. card is the content the card was showing when it
    was pressed -- { kind, overline, title, quote, text, mono, cite, aspect, of } -- so a piece
    can open on the very thing a visitor pressed: card.of is whatever the module's own spark()
    put there for it (a puzzle's case number, its word, the star it was drawn from), handed
    straight back. A piece reads card when it has one and rolls its own subject when it is null,
    and either way the same seed makes the same piece.

  ---------------------------------------------------------------------------------------------
  The difficulty: one setting, every puzzle on the site

  env.difficulty is how hard the visitor asked for their puzzles -- { level, of, name, says, set },
  where level is 1 (gentle) to 5 (fierce) and the middle of the dial stands until a visitor moves
  it. The persona keeps it (js/persona.js, under `difficulty` in the local-state document), the
  persona sheet names it as plainly as the constellation, and the same slider stands on the stage
  beside the piece, because a setting is settable wherever it is a dependency (issue #93). Moving
  it deals this piece again at the same seed with the same card, so the subject a visitor pressed
  stays the subject and only how hard it is asked moves. Nothing is powered down over it: unlike
  the sky it always holds a value.

  What a level changes is the same thing in every world, so a visitor learns the dial once:

    the help      a piece's helper knob -- the hint, the second look, the replay -- gives
                  6 - level turns of it: five at gentle, three at the middle, one at fierce.
                  Never none, because a knob that does nothing is no knob, and as many of that
                  allowance as the world has to give. A helper with only one thing to say is
                  withheld at fierce instead, where the piece has knobs enough to spare it
    the margin    an answer read off a scale -- a distance in spans, an hour on a 24-hour dial,
                  notches round a rim, a water table in centimetres -- may be 3 - level steps out
                  and still count: two at gentle, one at mild, exactly on the mark from the middle
                  of the dial up. A count, an order, a word, or a target the scene itself decides
                  (a probe through a ring, a crossing timed by the apparatus) has no margin to
                  give, so those worlds move on the help alone

  It never changes the subject. The plan a piece is of is rolled from the seed and carried on the
  card's `of`, which is what keeps a card and the feature it opens as one thing (the alignment
  axiom above) -- so paint() and spark() are handed no difficulty at all, the feed's cards are the
  same river at any setting, and a module reads env.difficulty inside piece() and nowhere else.
  A module reads it defensively, through a small helper of its own: a card's env has none.

  ---------------------------------------------------------------------------------------------
  The rite: how a piece moves

  env.rite (and ctx.rite, the same object) is the piece's own roll of how it moves (README:
  "Motion axiom"), from js/variant.js, seeded from the piece's seed so the same seed plays the
  same rite. Nothing a module draws moves along a formula: a selection does not fade to another
  opacity, a wheel does not turn evenly, a solved thing does not wash in. rite.ease(t) is a
  glitch of a curve; rite.stair(t, n) steps t onto uneven treads, for a state that changes (a
  highlight, an opacity, a size); rite.ratchet(t) turns in clicks with backlash, for anything
  that rotates; rite.flicker(t) is 0 or 1, for a thing that arrives by blinking on; and
  rite.matte(x, y, k) says, for the cell at column x and row y, whether the piece's own
  procedurally generated matte -- noise, shards, scan lines, a dither, an iris, a grain -- lets
  a surface through at coverage k, so a region that becomes selected changes by its area in
  that pattern (tile it in cells of rite.cell px and fill the ones let through) and never by a
  fade. rite.at(seed) is another such roll, for a module that wants one per thing it moves. The
  harnesses hand the same roll, and a module that moves anything along t * t, a lerp, a sine
  or an even rotation is the kind of module this site refuses.

  ctx, the same object for the whole piece:
    canvas, g (its 2d context), w, h (CSS pixels; the context is already scaled for the screen),
    colors { bg, bg2, accent, accent2, fg, muted } in the world's palette, rnd() (seeded: the
    same seed makes the same piece), pick(list), int(a, b), chance(p), stars, points(w, h, pad),
    mix(a, b, t), alpha(c, a), reduced (less motion asked for), rite (how this piece moves: see
    env.rite below), satisfy(id, value), progress(id,
    fraction), status(text) (one live line under the knobs), value(id), set(id, value) (from
    tap() only), hint() (one hint given), tries, hints, done (solved), elapsed (seconds).

  The law: every world's piece must be a puzzle that solves. .github/scripts/piece_harness.mjs
  drives each module's piece through its knobs with a stub canvas, in a worker with no document,
  no clock and no Math.random: it sets the helpers the way a visitor would and the answers to the
  piece's own solution and presses check, which has to solve; then every answer wrong, and each
  answer wrong alone, none of which may solve. It refuses a piece with no goal, no check or no
  solution, one that solves before its visitor has set anything, one with fewer than two knobs or
  more than five, one that is not the same for the same seed or the same for every seed, one
  whose knobs reached in another order do not solve the same way, and one that is the same piece
  whichever of its world's cards it was opened from. The AI run's check_completion holds every
  plan to it, and RealSiteTest holds the site as committed. A piece is pure drawing and
  arithmetic on ctx: it never reaches for the document, the window, the clock or the browser's
  storage, and a module is self-contained (it imports nothing), which is also what lets the
  harness run it.

  ---------------------------------------------------------------------------------------------
  What a page can call

      window.interestingStage           (only on a page that has the stage)
        .open(file, seed, options)   open the named world's piece for `seed` on this stage;
                                     options.push=false keeps the URL, options.scroll=true
                                     brings the stage into view, and the rest of the options are
                                     the pressed card's configuration, which js/feed.js hands over
                                     whole (see the alignment axiom above): options.seeds={bg,bg2,
                                     accent,accent2} is the palette the site takes on for the
                                     piece, options.variant the seven dials the card was wearing,
                                     options.card the content it was showing. Any of them left out
                                     is derived from the seed instead, never guessed at
        .next()                      finish nothing, open the next card from the feed's stack
        .current()                   { file, seed } or null
      events on window: 'stage:open' { file, seed }, 'stage:complete' { file, seed },
      'stage:home' (the threshold's own state, on going back)

  The URL carries the piece: `world.html#<seed>` is this piece, shareable, and the back button
  walks back through the pieces a visitor finished (one left without finishing -- the way on
  pressed over a piece that needed a sky, or over a world with nothing to play -- is replaced,
  not kept).
  Opening a card from another world moves the address to that world's page without a load: a
  page is wherever the stage is -- and so is the site's colour, which follows the piece on the
  stage for as long as it is there (see feature(), and the precedence in _sass/_mood.scss).

  Nothing here reaches for the browser's storage. The sky and the difficulty are read through the
  persona, the next
  card through the feed, and the one thing written besides the address is the tally of solves --
  `puzzles` in the local-state document, through window.interestingState like everything else the
  site keeps, so it exports with the rest.
*/

import { PLAIN, revive, recolor, aspect as framed, ratioOf, mulberry32, hash, mix, alpha, rite } from './variant.js';

const root = document.documentElement.getAttribute('data-root') || '';
const stage = document.getElementById('stage');
const persona = window.interestingPersona;
const site = window.interestingSite;
const store = window.interestingState; // the one local-state store: the tally of solves is kept there
const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

const MAX_STEPS = 5;
const KINDS = ['choice', 'toggle', 'range', 'number', 'word', 'order', 'pick', 'grid', 'press', 'hold', 'tap', 'wait'];
const FALLBACK = { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' };

const WORLDS = (() => {
  try {
    const node = document.getElementById('site-worlds');
    return (node ? JSON.parse(node.textContent) : []).map((w) => Object.assign({}, w, { id: w.file.replace(/\.html$/, '') }));
  } catch (e) {
    return [];
  }
})();

/* ---- small helpers ----------------------------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function hidden(text) {
  return el('span', 'visually-hidden', text);
}

function readColors(node) {
  const style = getComputedStyle(node);
  const out = {};
  for (const name of Object.keys(FALLBACK)) out[name] = style.getPropertyValue('--' + name).trim() || FALLBACK[name];
  return out;
}

function newSeed() {
  return (Math.random() * 0x7fffffff) | 0;
}

function worldOf(file) {
  return WORLDS.find((w) => w.file === file) || null;
}

/* ---- the site's theme follows what is on the stage ------------------------------------------ */

/*
  The site features the activity on the stage, and the colour of the site says so (issue #61):
  pick a card out of the feed and the page it opens becomes that card's colour, so the theme a
  visitor arrives in is the theme they pressed.

  Two halves, which are the two halves a card in the feed already has:

    - the world's mood, as an attribute -- :root[data-featured], written last of the three on :root
      in _sass/_mood.scss, so a featured activity outranks both the page's own world and the
      visitor's reading. The reading is the site's standing skin; a piece is what the site wears
      while that piece is on the stage, and goHome() takes the attribute off again, so one card
      never re-skins the site for good.
    - the card's own configuration, as the four seeds inline on :root -- the palette js/variant.js
      derived for that one card inside its world's mood, handed over by js/feed.js
      (options.seeds). Inline wins over every rule, exactly as it does on the card itself, so the
      site matches the card that was picked and not merely its world.

  --fg and --muted are not touched here, any more than a card's configuration touches them: they
  are what holds the site's text at 4.5:1 over all fifteen palettes.
*/

// The four names a palette is (_sass/_mood.scss, js/variant.js), and no others.
const SEEDS = ['bg', 'bg2', 'accent', 'accent2'];
// The tones the theme may dip through, so one colour clears before the next: the neutral grey most
// of the time, now and then a deeper ink or a paler ash, the roll deciding which (README: "Motion
// axiom" -- the fade of the background is a movement of the rite like any other).
const TONES = ['#808080', '#808080', '#808080', '#2c2c30', '#b4b2ad'];
const DIP_MS = 140; // the quick fade out to that tone, at the scheme's own tempo
const RISE_MS = 420; // the fade from it into the colour of the card just pressed, at the same

let featured = null; // the palette the site is wearing for the activity on the stage, once landed
let fading = 0; // the crossfade in flight, so two picks in a row never fight over the seeds
let turnParity = 'b'; // which of the two veil spells the last palette turn played, so the next restarts

/* ---- the motion engine, where it is --------------------------------------------------------- */

// window.interestingMotion (js/motion.js) rolls every curve on the site, and the stage takes its
// own curves and its timers from the same roll, so a vanish is over before the next piece opens and
// the crossfade's dip runs along a curve rolled for that one shift. The stub browser the stage
// harness runs in has no engine, so every ask below falls back: the timers to the scheme's own
// figures, and a curve to the one polyline written here -- a glitch of a curve and never a formula,
// because no movement on this site runs along one (README: "Motion axiom").
const motion = window.interestingMotion || null;
const OWN_CURVE = [[0, 0], [0.1, 0.02], [0.38, 0.64], [0.45, 0.58], [0.62, 1.05], [0.8, 0.97], [0.9, 1.01], [1, 1]];

// A function t -> y along a polyline of [t, y] stops, which is what the engine hands back too.
function along(stops) {
  return (t) => {
    if (t <= 0) return stops[0][1];
    if (t >= 1) return stops[stops.length - 1][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, y0] = stops[i - 1];
        const [t1, y1] = stops[i];
        return t1 > t0 ? y0 + (y1 - y0) * ((t - t0) / (t1 - t0)) : y1;
      }
    }
    return 1;
  };
}

// A curve of the family, rolled for this one use, or the stage's own where there is no engine.
function riteEase(family) {
  if (motion && typeof motion.ease === 'function') {
    try {
      return motion.ease(family);
    } catch (e) {
      /* the stage's own curve stands */
    }
  }
  return along(OWN_CURVE);
}

// How long the stylesheet is giving a movement right now, or the scheme's own figure without it.
function riteMs(name, fallback) {
  if (motion && typeof motion.ms === 'function') {
    const ms = motion.ms(name);
    if (ms > 0) return ms;
  }
  return fallback;
}

function riteTempo() {
  const tempo = motion && motion.temper ? Number(motion.temper.tempo) : 1;
  return Number.isFinite(tempo) && tempo > 0 ? tempo : 1;
}

/* ---- the text rites ------------------------------------------------------------------------ */

/* Words on the stage are never swapped in: they are revealed (README: "Motion axiom"). The text is
   written whole first -- the harnesses read textContent back the instant a call returns, and the
   aria-live lines are read by a screen reader as one line -- and then, where the engine is on the
   page, the engine wraps each glyph in a sigil for the length of the rite (motion.reveal, which
   leaves textContent exactly the words throughout and unwraps after). The stub browser the stage
   harness runs in has no engine, so there the words are simply there. */
function reveal(node) {
  if (!node || calm.matches || !motion || typeof motion.reveal !== 'function') return;
  try {
    motion.reveal(node);
  } catch (e) {
    /* the words are there, which is the whole of what matters */
  }
}

// A line written and revealed, when it changed: the heading's words, a label, a count.
function inscribe(node, text) {
  if (!node) return;
  const words = text == null ? '' : String(text);
  if (node.textContent === words) return;
  node.textContent = words;
  if (words) reveal(node);
}

/* The live lines (the status, the wanted line, the tries) are typed in by the stylesheet rather
   than by the engine: a piece may write its status every frame, and a rite that restarted every
   frame would never land. The line is written whole and at once; data-said flips between two
   values so the stylesheet's line-said / line-said-b restarts, and never more often than one beat
   (--motion-medium), so a line rewritten under the rite is simply the new words landing under it. */
const saidAt = new Map();

function speak(node, text) {
  if (!node) return;
  const words = text == null ? '' : String(text);
  if (node.textContent === words) return;
  node.textContent = words;
  if (!words || calm.matches) return;
  const now = performance.now();
  const last = saidAt.get(node) || { at: -1e9, parity: 'b' };
  if (now - last.at < riteMs('medium', 340)) return;
  const parity = last.parity === 'a' ? 'b' : 'a';
  saidAt.set(node, { at: now, parity });
  node.setAttribute('data-said', parity);
}

// A small roll of a thing's particulars (a seal's tilt and teeth, a hatch's angle), seeded, so the
// same working wears the same seal twice and no two knobs on one rail wear the same one.
function particulars(node, rnd) {
  if (!node || !node.style) return;
  node.style.setProperty('--seal-rot', ((rnd() - 0.5) * 9).toFixed(2) + 'deg');
  node.style.setProperty('--seal-teeth', String(5 + Math.floor(rnd() * 7)));
  node.style.setProperty('--hatch-angle', Math.round(rnd() * 180) + 'deg');
  node.style.setProperty('--screen-pitch', (3 + Math.round(rnd() * 4)) + 'px');
  node.style.setProperty('--ward-angle', Math.round(-60 + rnd() * 120) + 'deg');
  node.style.setProperty('--bar-pitch', (5 + Math.round(rnd() * 6)) + 'px');
  node.style.setProperty('--plate-angle', Math.round(-20 + rnd() * 40) + 'deg');
}

// A rolled order 0..n-1 for things that are dealt one tread each, so the deal differs every time.
function dealOrder(n, rnd) {
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const held = order[i];
    order[i] = order[j];
    order[j] = held;
  }
  return order;
}

// The page scrolls along a rolled curve, or jumps: never along the browser's own smoothing.
function scrollToTop() {
  if (motion && typeof motion.scrollTo === 'function') motion.scrollTo(0);
  else window.scrollTo({ top: 0, behavior: 'auto' });
}

function scrollSceneIntoView(node) {
  if (motion && typeof motion.scrollIntoView === 'function') motion.scrollIntoView(node, { block: 'center' });
  else node.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function readSeeds(node) {
  const style = getComputedStyle(node);
  const out = {};
  for (const name of SEEDS) out[name] = style.getPropertyValue('--' + name).trim() || FALLBACK[name];
  return out;
}

function writeSeeds(seeds) {
  for (const name of SEEDS) document.documentElement.style.setProperty('--' + name, seeds[name]);
}

// The seeds come off again, so the rules in _sass/_mood.scss own the palette once more.
function clearSeeds() {
  for (const name of SEEDS) document.documentElement.style.removeProperty('--' + name);
}

// The four of `seeds` that are there, and nothing else a caller put on the object.
function someSeeds(seeds) {
  const out = {};
  if (seeds) {
    for (const name of SEEDS) {
      const value = typeof seeds[name] === 'string' ? seeds[name].trim() : '';
      if (value) out[name] = value;
    }
  }
  return out;
}

/* The site becomes `to` from wherever it is now, by way of a settled tone, and lands exactly on
   it (issue #61) -- a quick fade out to the tone so the colour it was leaves cleanly, then a
   fuller fade from the tone into the colour that was asked for, so the theme shifts through a
   settled middle rather than smearing one palette straight over another. A visitor who asked for
   less motion gets the change and not the shift.

   The shift is a working of its own (README: "Motion axiom"), and no two are alike: each of the
   four seeds leaves along a curve rolled for it alone and rises along another, the four staggered
   by a few rolled frames so the ground lands before the accents snap in, or the accents before the
   ground; the tone in the middle is the roll's -- grey most of the time, now and then an ink or an
   ash -- and the whole of it runs at the tempo of the mood the site is arriving in. */
function crossfade(from, to, done) {
  if (fading) cancelAnimationFrame(fading);
  fading = 0;
  // Nothing to shift: one world's own palette opening on its own page, most of the time.
  if (calm.matches || typeof requestAnimationFrame !== 'function'
      || SEEDS.every((name) => from[name] === to[name])) {
    writeSeeds(to);
    if (done) done();
    return;
  }
  // This turn's paint is still the colour the site was: the shift starts from there.
  writeSeeds(from);
  // The old ground is torn off the piece (README: "Motion axiom"): where the ground seed changes,
  // a veil the colour it was is laid over the inner and eaten down the ladder in bites (veil-tear
  // and veil-tear-b alternate, _sass/_stage.scss) while the seeds jump through their treads under
  // it, so the new palette arrives as shards and never as a wash. The stub records the strings.
  if (stage && stage.dataset && stage.style && from.bg !== to.bg) {
    stage.style.setProperty('--veil-bg', from.bg || 'transparent');
    turnParity = turnParity === 'a' ? 'b' : 'a';
    stage.dataset.turning = turnParity;
    later(() => delete stage.dataset.turning, riteMs('medium', 340) + 80);
  }
  const tempo = riteTempo();
  const tone = TONES[Math.floor(Math.random() * TONES.length)];
  // The palette turns over in a step series, never a smear (README: "Motion axiom"): each seed
  // flashes to the tone for one held frame, then jumps through three to six rolled intermediate
  // mixes with holds between them -- a hand-tinted plate changing frame by frame -- and lands on
  // the colour asked for. The treads' places in time come off a leave curve rolled for this
  // seed and their heights off an arrive curve rolled for it, so the stair is the roll's twice
  // over; the four seeds set out in a rolled order a few rolled frames apart.
  const plan = {};
  for (const name of SEEDS) {
    const dip = riteEase('leave');
    const rise = riteEase('arrive');
    const count = 3 + Math.floor(Math.random() * 4);
    const treads = [];
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      treads.push({
        at: Math.max(0, Math.min(1, dip(t * 0.92))), // when this tread is reached, as a fraction
        y: i === count ? 1 : Math.max(0, Math.min(1, rise(t))) // how far it is along the change
      });
    }
    treads.sort((a, b) => a.at - b.at);
    plan[name] = {
      wait: Math.round(Math.random() * 90 * tempo), // the stagger: when this seed sets out
      flashMs: DIP_MS * tempo * (0.25 + Math.random() * 0.3), // the one frame of the tone
      riseMs: RISE_MS * tempo * (0.8 + Math.random() * 0.5),
      treads,
      was: ''
    };
  }
  const total = Math.max(...SEEDS.map((name) => plan[name].wait + plan[name].flashMs + plan[name].riseMs));
  const startedAt = performance.now();
  const step = (now) => {
    const elapsed = now - startedAt;
    const at = {};
    let moved = false;
    for (const name of SEEDS) {
      const p = plan[name];
      const own = elapsed - p.wait;
      let value;
      if (own <= 0) {
        value = from[name];
      } else if (own < p.flashMs) {
        value = tone; // the one flash: the colour it was is gone before the next is there
      } else {
        const f = (own - p.flashMs) / p.riseMs;
        let y = 0;
        for (const tread of p.treads) if (f >= tread.at) y = tread.y;
        value = f >= 1 || y >= 1 ? to[name] : mix(tone, to[name], y);
      }
      at[name] = value;
      if (value !== p.was) moved = true;
      p.was = value;
    }
    if (moved) writeSeeds(at); // a hold is a frame nothing is written on
    if (elapsed < total) {
      fading = requestAnimationFrame(step);
      return;
    }
    writeSeeds(to);
    fading = 0;
    if (done) done();
  };
  fading = requestAnimationFrame(step);
}

/* The site features `mood`, in `seeds` when the card that was pressed handed its own palette over,
   and otherwise in the palette `variant` derives inside that mood -- so a piece nobody pressed
   wears the colour a card of its seed would have worn, just as it wears that card's frame and its
   picture (the alignment axiom above). Either way the four seeds are the configuration's, derived
   by the one file that derives a card's (variant.recolor).

   Hands back the palette the site is landing in, which is what the piece is painted in: a piece
   never reads a colour the crossfade is only passing through. */
function feature(mood, seeds, variant) {
  const root = document.documentElement;
  const from = readSeeds(root);
  clearSeeds(); // so the attribute below, and not the last piece's seeds, says what the site is
  if (mood) root.dataset.featured = mood;
  else delete root.dataset.featured;
  const own = readSeeds(root); // this mood's own four, before any configuration
  const handed = someSeeds(seeds);
  const configured = Object.keys(handed).length || !variant || variant.plain
    ? handed : someSeeds(recolor(own, variant));
  const to = Object.assign(own, configured);
  featured = to;
  crossfade(from, to);
  return to;
}

// Nothing is featured any more: the page's own world, or the visitor's reading, whichever
// _sass/_mood.scss gives the page once the attribute is off it.
function unfeature() {
  const root = document.documentElement;
  const from = readSeeds(root);
  featured = null;
  clearSeeds();
  delete root.dataset.featured;
  crossfade(from, readSeeds(root), clearSeeds);
}

const modules = new Map();
const readsSky = new Map(); // module id -> needsSky, once the module has loaded

function loadModule(id) {
  if (!modules.has(id)) {
    const url = new URL('./modules/' + id + '.js', import.meta.url);
    modules.set(id, import(url.href).then((m) => {
      const mod = m.default || null;
      readsSky.set(id, !!(mod && mod.needsSky));
      return mod;
    }).catch(() => null));
  }
  return modules.get(id);
}

/* A frame as a number: '16 / 9' is 1.7778, and a bare number -- which is what variant.aspect() gives
   back for a frame it has stretched -- is itself. The arithmetic is variant.ratioOf, the one reader
   of aspect ratios the site has; 16/9 stands in for anything unreadable. */
function aspectRatio(aspect) {
  return ratioOf(aspect) || 16 / 9;
}

/* ---- the stage's parts --------------------------------------------------------------------- */

const ui = stage ? {
  inner: document.getElementById('stage-inner'),
  head: document.getElementById('stage-head'),
  world: document.getElementById('stage-world'),
  sigil: document.getElementById('stage-sigil'), // the working's number: the seed, beside the name
  read: document.getElementById('stage-read'),
  title: document.getElementById('stage-title'),
  brief: document.getElementById('stage-brief'),
  goal: document.getElementById('stage-goal'),
  goalText: document.getElementById('stage-goal-text'),
  body: document.getElementById('stage-body'),
  scene: document.getElementById('stage-scene'),
  canvas: document.getElementById('stage-canvas'),
  knobs: document.getElementById('stage-knobs'),
  check: document.getElementById('stage-check'),
  tries: document.getElementById('stage-tries'),
  status: document.getElementById('stage-status'),
  wanted: document.getElementById('stage-wanted'),
  progress: document.getElementById('stage-progress'),
  done: document.getElementById('stage-done'),
  doneText: document.getElementById('stage-done-text'),
  onward: document.getElementById('stage-next'),
  again: document.getElementById('stage-again'),
  burst: document.getElementById('stage-burst'),
  tune: document.getElementById('stage-difficulty'),
  gate: null // the element the unlock helper powers down, one per unpowered open
} : null;

// What the page said before any piece opened: the threshold goes back to it. The page's own
// palette is not kept here, because the stage no longer overwrites it: <html data-world> stays
// what the layout wrote, and a featured activity is a palette of its own above it (see feature()).
const home = stage ? {
  name: ui.world.textContent,
  line: ui.title.textContent,
  title: document.title
} : null;

let current = null; // the piece on stage, and everything the stage knows about it
let lastWidth = 0; // the scene's width at the last reflow, so a resize that changes nothing is free
let pending = null; // the token of the open() in flight, so a slow module cannot land late
let frameHandle = 0;
let lastFrame = 0;
let firstPiece = null; // on a page of no world (the 404): the piece that opened on arrival
const altRnd = mulberry32(newSeed()); // for the 'tap for me' button, apart from the piece's own

// Everything the stage has running for the piece on stage: the ceremony's timers, a hold knob's
// ticker, the frame loop. A piece is an instantiation and nothing of it may outlive its turn, so
// each is registered here with the one call that stops it and close() stops the lot. The token
// guards further down stay as they are -- a callback that has already fired cannot be unfired --
// but nothing now depends on them to notice that its piece is gone.
const running = new Set();

function later(fn, ms) {
  let handle = 0;
  const stop = () => {
    running.delete(stop);
    window.clearTimeout(handle);
  };
  handle = window.setTimeout(() => {
    running.delete(stop);
    fn();
  }, ms);
  running.add(stop);
  return stop;
}

function ticking(fn, ms) {
  let handle = 0;
  const stop = () => {
    running.delete(stop);
    window.clearInterval(handle);
  };
  handle = window.setInterval(fn, ms);
  running.add(stop);
  return stop;
}

function stopRunning() {
  for (const stop of Array.from(running)) stop();
  running.clear();
}

function setMode(mode) {
  stage.dataset.mode = mode;
}

/* ---- opening a piece ---------------------------------------------------------------------- */

async function open(file, seed, options) {
  if (!stage) return false;
  const opts = options || {};
  const world = worldOf(file);
  if (!world) return false;
  seed = (Number(seed) >>> 0) || newSeed();
  // A piece torn down for another is unmade, not cut: its rail and seals are ghosted beside the
  // real rail and eaten down the ladder while the next develops (see ghostRail). The ghost is
  // taken before close() empties the rail, and its timer is registered after close() has stopped
  // everything the old piece had running, so it is the new piece's to sweep.
  const ghost = ghostRail();
  close();
  if (ghost) {
    stage.dataset.unmaking = '';
    later(() => {
      ghost.remove();
      delete stage.dataset.unmaking;
    }, riteMs('medium', 340) + 6 * riteMs('stagger', 44) + 80);
  }
  if (opts.redeal) stage.dataset.redeal = '';
  const token = {};
  pending = token;
  // The configuration this piece is of: the pressed card's seven dials, or -- for a piece nobody
  // pressed -- the ones that seed would have dealt (the alignment axiom above).
  const variant = revive(opts.variant, seed);
  let card = cardOf(opts.card);

  // A card pressed while the threshold is asking answers the question another way: by leaving.
  const probe = document.getElementById('persona-probe');
  if (probe && !probe.hidden) probe.hidden = true;

  // The site features this activity: its world's palette, as the card that was pressed wore it --
  // or as this configuration wears it, for a piece with no card behind it.
  feature(world.mood, opts.seeds, variant);
  if (ui.world) inscribe(ui.world, world.name);
  document.title = world.name + ' · interesting';
  if (opts.push !== false) {
    try {
      history[opts.replace ? 'replaceState' : 'pushState']({ world: file, seed }, '', root + file + '#' + seed);
    } catch (e) {
      /* a file: URL, or a browser that will not: the piece still opens */
    }
  }
  if (opts.scroll) scrollToTop();
  setMode('loading');
  // close() above left the stage empty: what the card was showing stands until the module lands and
  // begin() draws the piece. The world's one line is never written here -- it is the same line for
  // every card of the world, which is the generic text a pressed card used to fall back to.
  heading(world, card);
  if (ui.read && !opts.keepRead) ui.read.hidden = true;

  const mod = await loadModule(world.id);
  if (pending !== token) return false;
  const stars = persona ? persona.stars() : [];
  if (!card) {
    // No card behind this piece: the one this configuration would have dealt, so a feature opened
    // from an address is titled by the same arithmetic as one opened from the feed.
    card = sparkOf(mod, seed, world, variant, stars);
    if (card) heading(world, card);
  }
  if (!mod || typeof mod.piece !== 'function') {
    // A world without a piece (the law forbids it, but a stage never breaks): what the card said,
    // and the way on.
    empty(opts);
    return false;
  }
  const opened = { world, mod, seed, token, opts, variant, card };
  if (mod.needsSky && !stars.length && site && typeof site.unlock === 'function') {
    gate(opened);
    return true;
  }
  begin(opened);
  return true;
}

// Powered down, never broken: the piece needs a sky, and the one button that seeds it is the
// whole of what the stage says about that. The helper powers down a throwaway element of this
// open's own, so a later piece is never dimmed by a sky cleared after this one is gone.
function gate(opened) {
  setMode('unpowered');
  // Nothing to finish until there is a sky, so the way on is lit from the start: a visitor who
  // does not want to seed one is never held here. The focus stays on the heading, which is where
  // the piece would have put it.
  lightTheWayOn(false);
  const host = el('div', 'stage-gate');
  ui.body.insertBefore(host, ui.scene);
  ui.gate = host;
  let begun = false;
  site.unlock(host, {
    onReady() {
      if (pending !== opened.token || begun) return;
      begun = true;
      // There is a sky now, so a world that reads one can deal a card at last: a piece opened with
      // none behind it is still of the card its configuration makes (the alignment axiom above).
      if (!opened.card) {
        opened.card = sparkOf(opened.mod, opened.seed, opened.world, opened.variant,
          persona ? persona.stars() : []);
        if (opened.card) heading(opened.world, opened.card);
      }
      // Power coming on is an arrival: the plate warms like a tube and the piece develops.
      opened.opts = Object.assign({}, opened.opts, { arriving: true, powered: true });
      begin(opened);
    }
  });
  if (opened.opts.focus !== false) ui.title.focus({ preventScroll: true });
}

/* The old rail and its seals, ghosted beside the real rail for one movement: every knob and dot
   is moved (not copied -- the stub browser has no cloneNode) into a .stage-ghost under no pointer,
   which the stylesheet eats down the ladder knob by knob in the order they were dealt, and the
   caller sweeps when the movement is over. Nothing of it is in #stage-knobs or #stage-progress,
   so the rail reads as empty the instant open() returns. A visitor who asked for less motion
   gets the cut, as everywhere. */
function ghostRail() {
  if (!ui || !ui.knobs || !ui.knobs.parentNode || calm.matches) return null;
  const side = ui.knobs.parentNode;
  for (const old of side.querySelectorAll('.stage-ghost')) old.remove(); // one ghost at a time
  const knobs = Array.from(ui.knobs.children || []);
  const dots = ui.progress ? Array.from(ui.progress.querySelectorAll('.stage-dot')) : [];
  if (!knobs.length && !dots.length) return null;
  const ghost = el('div', 'stage-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  const rail = el('div', 'stage-ghost-rail');
  for (const knob of knobs) rail.appendChild(knob);
  ghost.appendChild(rail);
  const seals = el('div', 'stage-ghost-seals');
  for (const dot of dots) seals.appendChild(dot);
  ghost.appendChild(seals);
  side.appendChild(ghost);
  return ghost;
}

function empty(opts) {
  inscribe(ui.brief, 'Nothing to solve here yet.');
  lightTheWayOn(false); // nothing to finish, so the way on is the whole of what this offers
  setMode('empty');
  if (!opts || opts.focus !== false) ui.title.focus({ preventScroll: true });
}

/* ---- the card a piece is of ------------------------------------------------------------------ */

/* The content a card was showing, as the stage keeps it: the plain strings js/feed.js reads off the
   card it hands over (shown() there), or a spec a module's own spark() just made, which is the same
   shape. `of` rides along untouched -- it is the module's own note to itself about what the card is
   of, and nothing here reads it. Null for a card with nothing to say, so the heading falls back to
   the world's name rather than to an empty line. */
function cardOf(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const line = (value) => (typeof value === 'string' ? value : '');
  const out = {
    kind: line(spec.kind) || 'spark',
    overline: line(spec.overline),
    title: line(spec.title),
    quote: line(spec.quote),
    text: line(spec.text),
    mono: line(spec.mono),
    cite: line(spec.cite),
    aspect: line(spec.aspect),
    of: spec.of || null
  };
  return out.title || out.quote || out.text || out.mono ? out : null;
}

/* The card a seed and a configuration would have been dealt, for a piece nobody pressed: the
   module's own spark() for that very configuration, which is what js/feed.js would have put on the
   card. So a direct visit to `world.html#<seed>`, a world picked at random when the stack has run
   dry, and a reading opening onto a world all land on a feature titled by the same arithmetic as a
   card of it, and the alignment axiom holds with no feed in the story (issue #80). */
function sparkOf(mod, seed, world, variant, stars) {
  if (!mod || typeof mod.spark !== 'function') return null;
  try {
    return cardOf(mod.spark(makeEnv(seed, world, stars, variant, null)));
  } catch (e) {
    return null; /* a world with nothing to say for this seed: its own name stands */
  }
}

/* The feature's heading, from the card this piece is of: the card's own title, and the line it was
   showing under it. The world's one-line description is never the title -- it is the same line for
   every card of the world, and a visitor who pressed one has read it already; the world's name
   stands in when a card has no title of its own.

   With no card at all -- a world that reads the sky, asked for one before there is a sky to deal a
   card from -- the page speaks for itself instead, with the world's own line under its name, which
   is what it says in its quiet state too. */
function heading(world, card) {
  const title = (card && card.title) || world.name;
  const changed = ui.title.textContent !== title;
  ui.title.textContent = title;
  if (changed) reveal(ui.title);
  inscribe(ui.brief, card ? (card.quote || card.text || card.mono || '') : (world.what || ''));
}

/* The difficulty the visitor has set, as a piece is handed it: the persona keeps the setting for
   the whole site (js/persona.js), and a stage with no persona beside it deals at the middle of the
   dial rather than at nothing, because a piece is never powered down waiting for one. */
function askedDifficulty() {
  if (persona && typeof persona.difficulty === 'function') {
    try {
      return persona.difficulty();
    } catch (e) {
      /* a persona that cannot say falls through to the middle of the dial */
    }
  }
  return { level: 3, of: 5, name: 'fair', says: 'three hints, and a measured answer on the mark', set: false };
}

function makeEnv(seed, world, stars, variant, card) {
  const rnd = mulberry32(seed);
  return {
    seed,
    rnd,
    pick: (list) => list[Math.floor(rnd() * list.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    hash,
    stars,
    points(w, h, pad) {
      const p = pad || 0;
      return stars.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    // The stage's own colours, with the featured palette's four seeds over them: the piece is
    // painted in the colour the site is landing in, never in one the crossfade is passing through.
    colors: Object.assign(readColors(stage), featured || {}),
    mix,
    alpha,
    reduced: calm.matches,
    world: { file: world.file, name: world.name, orientation: world.orientation },
    // The configuration the card was wearing, and the content it was showing: the piece is made
    // from the same two things the card was, which is the whole of the alignment axiom above.
    variant: variant || PLAIN,
    card: card || null,
    // How hard the visitor asked for it (issue #93). The one setting, read here and nowhere else
    // in this file, so every piece on the site is dealt at it.
    difficulty: askedDifficulty(),
    // How this piece moves (README: "Motion axiom"): its own roll of a curve, a stair, a ratchet,
    // a flicker and a matte, from the same seed, so nothing it draws moves along a formula.
    rite: rite(seed)
  };
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  const out = [];
  const ids = new Set();
  for (const s of steps.slice(0, MAX_STEPS)) {
    if (!s || typeof s !== 'object' || !s.id || ids.has(s.id) || KINDS.indexOf(s.kind) === -1) continue;
    ids.add(s.id);
    out.push(s);
  }
  return out;
}

function begin(opened) {
  const { world, mod, seed, token, opts, variant, card } = opened;
  const stars = persona ? persona.stars() : [];
  const env = makeEnv(seed, world, stars, variant, card);
  let piece = null;
  try {
    piece = mod.piece(env);
  } catch (e) {
    piece = null;
  }
  const steps = piece ? normalizeSteps(piece.steps) : [];
  if (!piece || !steps.length) {
    empty(opts);
    return;
  }
  if (ui.gate) {
    ui.gate.remove();
    ui.gate = null;
  }

  current = {
    world, mod, seed, piece, token, env, variant, card,
    steps,
    state: new Map(steps.map((s) => [s.id, { step: s, set: false, value: undefined, knob: null }])),
    completed: false,
    touched: false,
    tries: 0, // checks pressed: a wrong answer costs one, and the solve is reported on one
    hints: 0, // hints the piece has given, through ctx.hint()
    tally: null, // the tally across puzzles, once this one is solved
    inTap: false, // whether the piece's tap() is running, which is the one time ctx.set() counts
    startedAt: performance.now(),
    ctx: null
  };

  // The piece names itself, and what it was pressed as stands under it: a piece made from this
  // card has named the card's own thing, and one that has nothing to say falls back to the card
  // rather than to the world's one line (issue #80).
  const named = piece.title || (card && card.title) || world.name;
  const renamed = ui.title.textContent !== named;
  ui.title.textContent = named;
  if (renamed) reveal(ui.title); // the rite's word lands glyph by glyph (the text rites above)
  // The working's own particulars, rolled from its seed and not from the piece's stream (env.rnd is
  // the piece's to spend): the seal's tilt and teeth, the hatch's angle, and the blotches the
  // plate develops through, so a shared address develops the same way twice.
  const own = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  particulars(stage, own);
  platePlan(own);
  // The sigil: the working's number beside the world's name, which is the seed in this piece's own
  // address -- so the one piece of numerology on the site is also the way to send a piece to someone.
  // It is cast: hidden until written, so the stylesheet's sigil-cast plays on every un-hiding, and
  // the digits land through the glyph rite.
  if (ui.sigil) {
    ui.sigil.hidden = true;
    inscribe(ui.sigil, 'working ' + seed);
    ui.sigil.hidden = false;
  }
  inscribe(ui.brief, piece.brief || (card && (card.quote || card.text || card.mono)) || '');
  // The goal, in one line under the rules: what counts as solved. A puzzle without one is a toy,
  // so the line is only ever hidden for a piece that has not said. It is pronounced: the chip seals
  // and the words are revealed, on every un-hiding.
  const goal = typeof piece.goal === 'string' ? piece.goal.trim() : '';
  if (ui.goal) ui.goal.hidden = true;
  if (ui.goalText) inscribe(ui.goalText, goal);
  if (ui.goal) ui.goal.hidden = !goal;
  ui.canvas.setAttribute('aria-label', 'the scene: ' + named);
  // Framed as the card was: the piece's own ratio, stretched by the dial that stretched the card's
  // frame in the feed, so what a visitor pressed and what they land on are the same shape.
  const shape = framed(piece.aspect || '16 / 9', variant);
  const ratio = aspectRatio(shape);
  ui.scene.style.setProperty('--piece-aspect', shape);
  ui.scene.style.setProperty('--piece-ratio', ratio.toFixed(4));
  renderKnobs();
  renderProgress();
  renderCheck();
  renderTries();
  // Dim for the whole piece, lit only when it is finished (issue #78). begin() is reached both
  // through open()/close(), which dims it, and straight from a gate's onReady once a sky is
  // seeded, where it was lit so the visitor could pass the seeding by -- so the piece itself has
  // to put it back to dim, or a sky-gated world would start live with the way on still lit.
  dimTheWayOn();

  // The scene has a size only once the stage is in a mode that shows it.
  const arriving = !!(opts && opts.arriving && !calm.matches);
  setMode(arriving ? 'arriving' : 'live');
  // The deal (README: "Motion axiom"): while data-dealing is on, the plate develops through its
  // blotch matte, the head's lines arrive one tread each, the knobs stamp onto the rail in a rolled
  // order and the check is struck last (_sass/_stage.scss). It outlasts the mode, which only the
  // inner's travel reads: every part has its own delay and its own length, and the attribute comes
  // off once the slowest has landed.
  if (arriving) {
    stage.dataset.dealing = '';
    if (opts.powered) stage.dataset.powered = '';
  }
  current.ctx = makeCtx(env);
  sizeHead(); // this piece's title and line are written: the scene's room is whatever they left
  sizeScene();
  try {
    if (typeof piece.start === 'function') piece.start(current.ctx);
  } catch (e) {
    /* a piece that cannot start still has its knobs; the frame loop guards itself */
  }
  if (opts && opts.arriving) {
    // For as long as the stylesheet is giving the arrival right now (--motion-long, rolled by
    // js/motion.js), and a little over, so the mode never changes under a movement still going.
    later(() => {
      if (current && current.token === token && stage.dataset.mode === 'arriving') setMode('live');
    }, riteMs('long', 560) + 60);
    later(() => {
      if (!current || current.token !== token) return;
      delete stage.dataset.dealing;
      delete stage.dataset.redeal;
      delete stage.dataset.powered;
    }, riteMs('long', 560) + riteMs('medium', 340) + (steps.length + 3) * riteMs('stagger', 44) + 80);
  }
  if (!opts || opts.focus !== false) ui.title.focus({ preventScroll: true });
  startFrames();
  try {
    window.dispatchEvent(new CustomEvent('stage:open', { detail: { file: world.file, seed } }));
  } catch (e) {
    /* older browsers get the piece and no event */
  }
}

/* The matte the plate develops through (README: "Motion axiom"): a stack of hard-edged blotches at
   rolled places whose radii step up in four treads -- --plate-1 to --plate-4, each a mask value the
   stylesheet's plate-develop climbs before the engine's own full matte -- so the picture comes
   through in bites and never washes in. Seeded from the working's seed, so one address develops
   the same way twice and every seed differently. The stub records the strings and reads nothing. */
function platePlan(rnd) {
  if (!ui || !ui.scene || !ui.scene.style) return;
  const blots = [];
  const count = 10 + Math.floor(rnd() * 5);
  for (let i = 0; i < count; i++) {
    blots.push({ x: Math.round(rnd() * 100), y: Math.round(rnd() * 100), r: 16 + Math.round(rnd() * 30) });
  }
  const climb = [0.22, 0.42, 0.66, 1];
  for (let k = 0; k < climb.length; k++) {
    const layer = blots.map((b) => 'radial-gradient(circle at ' + b.x + '% ' + b.y + '%, #000 '
      + Math.round(b.r * climb[k]) + '%, transparent 0)').join(', ');
    ui.scene.style.setProperty('--plate-' + (k + 1), layer);
  }
}

/* A bar's treads (README: "Motion axiom"): a fill advances in six to nine rolled uneven steps and
   holds between them, never creeps. The list is the knob's own, rolled when it is dealt, and both
   the piece's progress() and a hold's ticker snap to it, so the step series is in the data the
   stylesheet is handed and not only in the paint. The last tread is the fill itself (1). */
function barTreads(rnd) {
  const n = 6 + Math.floor(rnd() * 4);
  const treads = [];
  for (let i = 1; i < n; i++) treads.push((i + (rnd() - 0.5) * 0.7) / n);
  treads.sort((a, b) => a - b);
  treads.push(1);
  return treads;
}

function snapTread(fraction, treads) {
  let at = 0;
  for (const t of treads || []) if (fraction >= t) at = t;
  return at;
}

function makeCtx(env) {
  const c = current;
  return {
    canvas: ui.canvas,
    g: null,
    w: 0,
    h: 0,
    dpr: 1,
    colors: env.colors,
    rnd: env.rnd,
    pick: env.pick,
    int: env.int,
    chance: env.chance,
    stars: env.stars,
    points: env.points, // the same stars in the same places the card's env puts them
    mix,
    alpha,
    reduced: calm.matches,
    rite: env.rite, // how this piece moves: the same roll piece() was handed
    satisfy(id, value) {
      markSet(id, value, 'piece');
    },
    progress(id, fraction) {
      const s = c.state.get(id);
      if (!s || !s.knob) return;
      const f = Math.max(0, Math.min(1, Number(fraction) || 0));
      // Snapped to the knob's own treads: the bar advances in rolled steps and holds between.
      const at = f >= 1 ? 1 : snapTread(f, s.treads);
      const pct = (at * 100).toFixed(1) + '%';
      if (s.shown !== pct) {
        s.shown = pct;
        s.knob.style.setProperty('--knob-pct', pct);
      }
    },
    status(text) {
      speak(ui.status, text == null ? '' : String(text));
    },
    value(id) {
      const s = c.state.get(id);
      return s ? s.value : undefined;
    },
    // A piece whose scene is the control writes the knob from tap(): a cell of a grid drawn on
    // the canvas, an item dragged into order. Only from tap(), because that is the visitor's own
    // gesture; the rail follows the value, and the knob counts as set by the visitor.
    set(id, value) {
      if (!c.inTap) return false;
      const s = c.state.get(id);
      if (!s) return false;
      s.value = value;
      if (typeof s.update === 'function') s.update(value);
      markSet(id, value, 'knob');
      return true;
    },
    // One hint given, at the piece's own price: the stage counts them beside the tries.
    hint() {
      c.hints += 1;
      renderTries();
    },
    get tries() {
      return c.tries;
    },
    get hints() {
      return c.hints;
    },
    get done() {
      return c.completed;
    },
    get elapsed() {
      return (performance.now() - c.startedAt) / 1000;
    }
  };
}

/* The room the heading takes out of the first screen, which is room the scene cannot have: its own
   height and the gap under it, onto --stage-head for _stage.scss (which only guesses at one line of
   it). Measured rather than assumed, because a title that wraps is taller, and the scene is what
   should give up the difference -- not the margin that lets the feed peek over the fold. offsetHeight
   and not a rect, so the ceremony's scaling of the stage's inner never reads as a shorter heading. */
function sizeHead() {
  if (!ui.head || !ui.inner) return;
  const gap = parseFloat(window.getComputedStyle(ui.inner).rowGap);
  const h = ui.head.offsetHeight + (isFinite(gap) ? gap : 0);
  if (h > 0) stage.style.setProperty('--stage-head', Math.round(h) + 'px');
}

/* The scene at a new size: the stage's own height budget, then the canvas, then the piece. */
function reflow() {
  sizeHead();
  if (!current) return;
  if (Math.abs(ui.scene.getBoundingClientRect().width - lastWidth) < 1) return;
  // A resize is a re-exposure, not a flicker: the canvas lands through two scanline treads
  // (plate-reexpose) off data-reflow, which the stage's own clock takes off again.
  if (!calm.matches) {
    stage.dataset.reflow = '';
    later(() => delete stage.dataset.reflow, riteMs('short', 170) + 40);
  }
  sizeScene();
  // A piece that draws only in start() draws again at the new size.
  if (typeof current.piece.frame !== 'function' && typeof current.piece.start === 'function') {
    try {
      current.piece.start(current.ctx);
    } catch (e) {
      /* nothing more to do */
    }
  }
}

function sizeScene() {
  if (!current || !current.ctx) return;
  const box = ui.scene.getBoundingClientRect();
  lastWidth = box.width; // whatever follows, the scene has been sized at this width
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ui.canvas.width = Math.round(w * dpr);
  ui.canvas.height = Math.round(h * dpr);
  const g = ui.canvas.getContext('2d');
  if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
  current.ctx.g = g;
  current.ctx.w = w;
  current.ctx.h = h;
  current.ctx.dpr = dpr;
}

/* ---- the knobs ----------------------------------------------------------------------------- */

function renderKnobs() {
  ui.knobs.textContent = '';
  // The knobs are dealt (README: "Motion axiom"): each stamps onto the rail one tread after the
  // last in an order rolled afresh for this deal -- --knob-i is the delay the stylesheet reads,
  // never the DOM order, which stays the piece's -- and each wears particulars of its own (the
  // seal's tilt and teeth, the hatch's angle, the bar's pitch), rolled from the seed and the
  // knob's place, so no knob on a rail is textured like its neighbour.
  const order = dealOrder(current.steps.length, altRnd);
  current.steps.forEach((step, i) => {
    const knob = el('div', 'knob');
    knob.dataset.id = step.id;
    knob.dataset.kind = step.kind;
    if (step.optional === true) knob.dataset.optional = 'true'; // a helper the check does not wait for
    knob.style.setProperty('--knob-i', String(order[i]));
    const own = mulberry32(((current.seed ^ ((i + 1) * 0x9e3779b9)) >>> 0) || 1);
    particulars(knob, own);
    current.state.get(step.id).treads = barTreads(own);
    const ask = el('p', 'knob-ask', step.ask || step.id);
    ask.id = 'knob-ask-' + step.id;
    // A helper the check does not wait for says so, so nobody wonders whether they must use it.
    if (step.optional === true) ask.appendChild(el('span', 'knob-optional', ' \u00b7 optional'));
    knob.appendChild(ask);
    const render = KNOBS[step.kind] || KNOBS.choice;
    render(step, knob, ask.id);
    const mark = el('span', 'knob-mark');
    mark.appendChild(hidden('set'));
    knob.appendChild(mark);
    current.state.get(step.id).knob = knob;
    ui.knobs.appendChild(knob);
  });
  updateGates();
}

function apply(id, value) {
  const c = current;
  if (!c) return;
  c.touched = true;
  // A knob changed after a wrong check: the verdict was about the answer that was, not this one.
  if (stage.dataset.verdict === 'wrong') delete stage.dataset.verdict;
  const s = c.state.get(id);
  if (s) s.value = value;
  try {
    if (typeof c.piece.apply === 'function') c.piece.apply(id, value, c.ctx);
  } catch (e) {
    /* one knob's handler failing must not stop the piece */
  }
}

function markSet(id, value, by) {
  const c = current;
  if (!c) return;
  const s = c.state.get(id);
  if (!s) return;
  // A knob the visitor set is the visitor having touched the piece, whatever else setting it did.
  // apply() is the usual way that is learnt, and a slider left where it stands never reaches it.
  if (by === 'knob') c.touched = true;
  if (value !== undefined) s.value = value;
  if (!s.set) {
    s.set = true;
    if (s.knob) {
      s.knob.classList.add('is-set');
      if (by === 'piece') s.knob.style.setProperty('--knob-pct', '100%');
    }
    renderProgress();
    updateGates();
    // Every knob set is an answer ready to check, and nothing more: a puzzle is finished by a
    // check that solves it, never by its knobs having all been touched.
    renderCheck();
  }
}

/* The check button: enabled once every knob is set, because a check with an answer missing is a
   try spent on nothing. Its word is the piece's own, and after a solve it offers one more look. */
function renderCheck() {
  const c = current;
  if (!c || !ui.check) return;
  const all = Array.from(c.state.values()).every((s) => s.set || s.step.optional === true);
  ui.check.disabled = !all;
  // The word on it lands by the glyph rite when it changes; the lamp itself is struck by the
  // stylesheet off `disabled` (check-strike), which is the whole of its state.
  inscribe(ui.check, c.completed ? 'check again' : (typeof c.piece.checkLabel === 'string' && c.piece.checkLabel.trim() ? c.piece.checkLabel.trim() : 'check'));
}

/* The score line beside the check: how many tries so far, or which try solved it, how many hints
   the piece gave, and -- once solved -- how many puzzles this browser has solved in all. Hidden
   until there is something to say. */
function renderTries() {
  const c = current;
  if (!c || !ui.tries) return;
  const parts = [];
  if (c.completed) parts.push(c.tries <= 1 ? 'solved first try' : 'solved on try ' + c.tries);
  else if (c.tries) parts.push(c.tries === 1 ? 'one try so far' : c.tries + ' tries so far');
  if (c.hints) parts.push(c.hints === 1 ? 'one hint' : c.hints + ' hints');
  if (c.completed && c.tally && c.tally.solved > 1) parts.push(c.tally.solved + ' solved so far');
  // Written whole, typed in by the stylesheet (line-said); its first appearance develops.
  speak(ui.tries, parts.join(' \u00b7 '));
  ui.tries.hidden = !parts.length;
}

/* The tally across puzzles: how many this browser has solved, with the tries and hints they took,
   kept under `puzzles` in the one local-state document (js/state.js) like everything else the site
   remembers, so it exports and travels with the rest of a visitor's state. Nothing here reaches for
   the browser's storage: the store owns that. Null where there is no store to keep it. */
function tally(c) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') return null;
  let kept = null;
  try {
    kept = store.get('puzzles', null);
  } catch (e) {
    kept = null;
  }
  if (!kept || typeof kept !== 'object') kept = {};
  const next = {
    solved: (Number(kept.solved) || 0) + 1,
    tries: (Number(kept.tries) || 0) + c.tries,
    hints: (Number(kept.hints) || 0) + c.hints
  };
  try {
    store.set('puzzles', next);
  } catch (e) {
    /* kept for the page at least */
  }
  return next;
}

/* The check, pressed: the one way a puzzle is finished. The piece is asked whether the answer on
   the knobs solves it; a solve runs the ceremony, and a wrong answer costs a try, says so on the
   live line and changes nothing else -- the knobs keep the answer that was given, so the visitor
   can see what they said and think again. After a solve a check is fidgeting: the verdict is said
   and the ceremony does not play twice. */
function judge() {
  const c = current;
  if (!c || !ui.check || ui.check.disabled) return;
  c.touched = true;
  let verdict = null;
  try {
    verdict = typeof c.piece.check === 'function' ? c.piece.check(c.ctx) : { solved: true };
  } catch (e) {
    verdict = null; /* a verifier that throws has not said yes */
  }
  const solved = !!(verdict && verdict.solved);
  const say = verdict && typeof verdict.say === 'string' ? verdict.say.trim() : '';
  if (c.completed) {
    speak(ui.status, say || (solved ? 'still solved' : 'not solved like that; the puzzle is done either way'));
    return;
  }
  c.tries += 1;
  // The try is written beside the verdict so the refusal replays and differs: the stylesheet
  // restarts the jolt off data-try-parity flipping (stage-no / stage-no-b), keyed by the count.
  stage.dataset.try = String(c.tries);
  stage.dataset.tryParity = c.tries % 2 ? 'a' : 'b';
  stage.dataset.verdict = solved ? 'solved' : 'wrong';
  try {
    window.dispatchEvent(new CustomEvent('stage:check', { detail: { file: c.world.file, seed: c.seed, solved, tries: c.tries } }));
  } catch (e) {
    /* no event, no matter */
  }
  if (solved) {
    finish(say);
    return;
  }
  speak(ui.status, say || 'not yet');
  renderTries();
}

function updateGates() {
  for (const s of current.state.values()) {
    const gate = s.step.after ? current.state.get(s.step.after) : null;
    const locked = !!(gate && !gate.set);
    const was = s.knob.classList.contains('is-locked');
    s.knob.classList.toggle('is-locked', locked);
    for (const control of s.knob.querySelectorAll('button, input')) control.disabled = locked;
    // A gate opening tears the ward off (README: "Motion axiom"): data-unwarding plays ward-tear
    // on the veil and comes off when it has, through the stage's own clock.
    if (was && !locked && !calm.matches) {
      const knob = s.knob;
      knob.setAttribute('data-unwarding', '');
      later(() => knob.removeAttribute('data-unwarding'), riteMs('medium', 340) + 80);
    }
  }
}

function tapsOpen() {
  // Whether a tap on the scene reaches the piece: always, unless every tap knob is still locked.
  const taps = Array.from(current.state.values()).filter((s) => s.step.kind === 'tap');
  if (!taps.length) return true;
  return taps.some((s) => !s.knob || !s.knob.classList.contains('is-locked'));
}

function renderProgress() {
  let set = 0;
  const left = [];
  let asked = 0;
  let begun = false; // has the visitor set anything at all, a hint included?
  const wanted = [];
  for (const s of current.state.values()) {
    if (s.set) begun = true;
    if (s.step.optional === true) continue; // a helper the check does not wait for is not a dot
    asked += 1;
    if (s.set) set += 1;
    else left.push(s.step.ask || s.step.id);
    wanted.push(s);
  }
  // The dots are the working's seals and they persist (README: "Motion axiom"): rendered once per
  // piece and lit in place, so a seal that lights stamps (seal-light) rather than being replaced
  // already lit. The ones lighting now are dealt a rolled order for their cascade (--dot-i), which
  // on a finish is every seal still dark lighting one tread after another toward the done chip.
  let dots = ui.progress.querySelectorAll('.stage-dot');
  if (dots.length !== wanted.length) {
    ui.progress.textContent = '';
    wanted.forEach((s, i) => {
      const dot = el('span', 'stage-dot');
      dot.setAttribute('data-i', String(i));
      dot.style.setProperty('--dot-i', String(i)); // its place in the deal, until it lights
      ui.progress.appendChild(dot);
    });
    ui.progress.appendChild(hidden(''));
    dots = ui.progress.querySelectorAll('.stage-dot');
  }
  const lighting = [];
  wanted.forEach((s, i) => {
    const dot = dots[i];
    if (!dot) return;
    if (s.set && !dot.classList.contains('is-set')) lighting.push(dot);
    else if (!s.set) dot.classList.remove('is-set');
  });
  const order = dealOrder(lighting.length, altRnd);
  lighting.forEach((dot, k) => {
    dot.style.setProperty('--dot-i', String(order[k]));
    dot.classList.add('is-set');
  });
  const count = ui.progress.querySelector('.visually-hidden');
  if (count) count.textContent = set + ' of ' + asked + ' set';
  // What is left, said out loud. A knob may be set in any order, and the one at the bottom of the
  // page is often not the last one a visitor has to touch -- a piece can gate its finale on an
  // earlier knob and leave an ungated one above it untouched. Without this line, setting the
  // bottom knob, watching the scene answer, and having the piece not finish reads as a piece that
  // broke rather than as one with a knob still waiting (issue #60).
  // Two are named, more are counted, because the stranded knob is always among the last one or two
  // left -- the visitor has done everything else by then -- and a list of five is noise.
  if (ui.wanted) {
    const tell = begun && left.length > 0;
    speak(ui.wanted, !tell ? ''
      : left.length <= 2 ? 'still to set: ' + left.join(' and ')
        : 'still to set: ' + left[0] + ', and ' + (left.length - 1) + ' more');
    ui.wanted.hidden = !tell;
  }
}

// The keys that work a slider: a keyup on one of them is the visitor having used it.
const SLIDER_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

const KNOBS = {
  choice(step, knob, askId) {
    const group = el('div', 'segmented');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', askId);
    const options = Array.isArray(step.options) ? step.options.slice(0, 4) : [];
    const buttons = [];
    options.forEach((option) => {
      const b = el('button', null, option.label == null ? String(option.value) : option.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        for (const other of group.querySelectorAll('button')) other.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        apply(step.id, option.value);
        markSet(step.id, option.value, 'knob');
      });
      buttons.push([option.value, b]);
      group.appendChild(b);
    });
    // The scene as the control (ctx.set): the pressed option follows the value.
    current.state.get(step.id).update = (v) => {
      for (const [value, b] of buttons) b.setAttribute('aria-pressed', value === v ? 'true' : 'false');
    };
    knob.appendChild(group);
  },
  toggle(step, knob) {
    const b = el('button', 'knob-toggle', step.label || step.ask || step.id);
    b.type = 'button';
    let on = !!step.value;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', () => {
      on = !on;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      apply(step.id, on);
      markSet(step.id, on, 'knob');
    });
    current.state.get(step.id).update = (v) => {
      on = !!v;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    knob.appendChild(b);
  },
  range(step, knob, askId) {
    const row = el('div', 'knob-range');
    if (step.low) row.appendChild(el('span', 'knob-end', step.low));
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(step.min == null ? 0 : step.min);
    input.max = String(step.max == null ? 100 : step.max);
    input.step = String(step.step == null ? 1 : step.step);
    input.value = String(step.value == null ? (Number(input.min) + Number(input.max)) / 2 : step.value);
    input.setAttribute('aria-labelledby', askId);
    input.addEventListener('input', () => apply(step.id, Number(input.value)));
    // Set when the visitor has used the slider, whether or not they moved it. A slider already
    // has an answer on it when the piece opens -- that is why ctx.value(id) is the piece's from
    // the first frame -- so leaving it where it is is giving that answer, and 'change' alone never
    // fires for one: the knob could not be set at all, and a piece whose other knobs were all set
    // would never finish (issue #60). Only marked, not applied: the piece hears about a value
    // through apply() when it changes, and an unmoved slider has not changed.
    const used = () => markSet(step.id, Number(input.value), 'knob');
    input.addEventListener('change', used);
    input.addEventListener('pointerup', used);
    input.addEventListener('keyup', (ev) => {
      if (SLIDER_KEYS.indexOf(ev.key) !== -1) used();
    });
    row.appendChild(input);
    if (step.high) row.appendChild(el('span', 'knob-end', step.high));
    knob.appendChild(row);
    // The scene knows where the slider starts before anything moves (ctx.value), unasked.
    current.state.get(step.id).value = Number(input.value);
    current.state.get(step.id).update = (v) => {
      input.value = String(v);
      const min = Number(input.min);
      const max = Number(input.max);
      if (max > min) input.style.setProperty('--range-pct', (((Number(input.value) - min) / (max - min)) * 100).toFixed(2) + '%');
    };
  },
  // An exact count: a stepper with a field, for an answer that is a number rather than a feel.
  // Stepped or typed into is used; where it stands is an answer already, so the first step or
  // the first change is what sets it, as with a slider.
  number(step, knob, askId) {
    const min = Number(step.min == null ? 0 : step.min);
    const max = Number(step.max == null ? 100 : step.max);
    const inc = Number(step.step == null ? 1 : step.step) || 1;
    const clamp = (v) => {
      const n = Number(v);
      if (!isFinite(n)) return min;
      return Math.min(max, Math.max(min, min + Math.round((n - min) / inc) * inc));
    };
    const row = el('div', 'knob-number');
    const less = el('button', 'knob-step', '−');
    less.type = 'button';
    less.setAttribute('aria-label', 'one less');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'knob-count';
    input.min = String(min);
    input.max = String(max);
    input.step = String(inc);
    input.value = String(step.value == null ? min : clamp(step.value));
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('aria-labelledby', askId);
    const more = el('button', 'knob-step', '+');
    more.type = 'button';
    more.setAttribute('aria-label', 'one more');
    const state = current.state.get(step.id);
    state.value = Number(input.value);
    const give = (v) => {
      const n = clamp(v);
      const was = input.value;
      input.value = String(n);
      // The number ratchets like an odometer (count-ratchet) when the stage wrote it: a typed
      // value is the visitor's own and is left alone.
      if (was !== input.value && motion && typeof motion.rite === 'function' && !calm.matches) {
        motion.rite(input, 'ratcheting', riteMs('short', 170) + 200);
      }
      apply(step.id, n);
      markSet(step.id, n, 'knob');
    };
    less.addEventListener('click', () => give(Number(input.value) - inc));
    more.addEventListener('click', () => give(Number(input.value) + inc));
    input.addEventListener('change', () => give(input.value));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        give(input.value);
      }
    });
    state.update = (v) => {
      input.value = String(clamp(v));
    };
    row.appendChild(less);
    row.appendChild(input);
    row.appendChild(more);
    if (step.unit) row.appendChild(el('span', 'knob-end', String(step.unit)));
    knob.appendChild(row);
  },
  // A short typed answer: a word, a code, a name. Set once something has been typed; Enter in
  // the field presses the check, because that is what Enter means in a puzzle.
  word(step, knob, askId) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'knob-word' + (step.upper === false ? '' : ' is-upper');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', step.upper === false ? 'off' : 'characters');
    input.setAttribute('autocorrect', 'off');
    if (step.length) input.maxLength = Math.max(1, Number(step.length) || 1);
    if (step.placeholder) input.placeholder = String(step.placeholder);
    input.setAttribute('aria-labelledby', askId);
    const state = current.state.get(step.id);
    state.value = '';
    const read = () => (step.upper === false ? input.value.trim() : input.value.trim().toUpperCase());
    const give = () => {
      const v = read();
      apply(step.id, v);
      if (v) markSet(step.id, v, 'knob');
    };
    input.addEventListener('input', give);
    input.addEventListener('change', give);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        give();
        if (ui.check && !ui.check.disabled) judge();
      }
    });
    state.update = (v) => {
      input.value = v == null ? '' : String(v);
    };
    knob.appendChild(input);
  },
  // Items to put in order, with up and down beside each. Any move is the visitor giving an order
  // -- a move at an end that goes nowhere included -- and "keep this order" says the order it
  // opened in is the answer, the way a slider left where it stands is one.
  order(step, knob, askId) {
    const items = (Array.isArray(step.items) ? step.items : []).slice(0, 8).filter((i) => i && typeof i === 'object');
    const list = el('ol', 'knob-order');
    list.setAttribute('aria-labelledby', askId);
    let values = Array.isArray(step.value) && step.value.length === items.length
      && step.value.every((v) => items.some((i) => i.value === v)) ? step.value.slice() : items.map((i) => i.value);
    const state = current.state.get(step.id);
    state.value = values.slice();
    const labelOf = (v) => {
      const item = items.find((i) => i.value === v);
      return item && item.label != null ? String(item.label) : String(v);
    };
    function give() {
      const v = values.slice();
      apply(step.id, v);
      markSet(step.id, v, 'knob');
    }
    // Where each row stands, by its value, so a swap can be played from the old place to the new.
    function tops() {
      const out = new Map();
      Array.from(list.children || []).forEach((row, k) => {
        if (typeof row.getBoundingClientRect === 'function') out.set(values[k], row.getBoundingClientRect().top);
      });
      return out;
    }
    function move(i, d, refocus) {
      const j = i + d;
      if (j >= 0 && j < values.length) {
        const before = calm.matches ? null : tops();
        const held = values[i];
        values[i] = values[j];
        values[j] = held;
        draw();
        // The swap in a step series (README: "Motion axiom"): the two rows that changed places are
        // handed the distance back to where they were (--dy) and the stylesheet's row-swap steps
        // them from there to here in treads. The DOM order is rebuilt at once and is the truth.
        if (before) {
          Array.from(list.children || []).forEach((row, k) => {
            const was = before.get(values[k]);
            if (was === undefined || typeof row.getBoundingClientRect !== 'function') return;
            const dy = was - row.getBoundingClientRect().top;
            if (Math.abs(dy) < 0.5) return;
            row.style.setProperty('--dy', dy.toFixed(1) + 'px');
            row.setAttribute('data-flip', k === j ? 'moved' : 'displaced');
          });
        }
        const row = list.children[j];
        const again = row && row.querySelectorAll('button')[refocus];
        if (again && typeof again.focus === 'function') again.focus();
      }
      give();
    }
    function draw() {
      list.textContent = '';
      values.forEach((v, i) => {
        const row = el('li', 'knob-order-item');
        row.appendChild(el('span', 'knob-order-label', labelOf(v)));
        const up = el('button', 'knob-order-move', '▲');
        up.type = 'button';
        up.setAttribute('aria-label', 'move ' + labelOf(v) + ' up');
        up.addEventListener('click', () => move(i, -1, 0));
        const down = el('button', 'knob-order-move', '▼');
        down.type = 'button';
        down.setAttribute('aria-label', 'move ' + labelOf(v) + ' down');
        down.addEventListener('click', () => move(i, 1, 1));
        row.appendChild(up);
        row.appendChild(down);
        list.appendChild(row);
      });
    }
    state.update = (v) => {
      if (Array.isArray(v) && v.length === values.length) {
        values = v.slice();
        draw();
      }
    };
    draw();
    knob.appendChild(list);
    const keep = el('button', 'btn-text knob-alt', 'keep this order');
    keep.type = 'button';
    keep.addEventListener('click', give);
    knob.appendChild(keep);
  },
  // Some of these, chosen: chips that press in. With `count` the knob is set once exactly that
  // many are chosen, and one more press swaps the earliest choice for the new one; without it,
  // any number is an answer.
  pick(step, knob, askId) {
    const items = (Array.isArray(step.items) ? step.items : []).slice(0, 12).filter((i) => i && typeof i === 'object');
    const count = step.count == null ? 0 : Math.max(1, Math.min(items.length, Number(step.count) || 0));
    const group = el('div', 'segmented knob-pick');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', askId);
    const chosen = new Set((Array.isArray(step.value) ? step.value : []).filter((v) => items.some((i) => i.value === v)));
    const state = current.state.get(step.id);
    const current_ = () => items.filter((i) => chosen.has(i.value)).map((i) => i.value);
    state.value = current_();
    const buttons = new Map();
    function paint() {
      for (const [v, b] of buttons) b.setAttribute('aria-pressed', chosen.has(v) ? 'true' : 'false');
    }
    function give() {
      const v = current_();
      apply(step.id, v);
      if (!count || v.length === count) markSet(step.id, v, 'knob');
    }
    items.forEach((item) => {
      const b = el('button', null, item.label == null ? String(item.value) : String(item.label));
      b.type = 'button';
      b.setAttribute('aria-pressed', chosen.has(item.value) ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (chosen.has(item.value)) {
          chosen.delete(item.value);
        } else {
          if (count && chosen.size >= count) chosen.delete(chosen.values().next().value);
          chosen.add(item.value);
        }
        paint();
        give();
      });
      buttons.set(item.value, b);
      group.appendChild(b);
    });
    state.update = (v) => {
      chosen.clear();
      (Array.isArray(v) ? v : []).forEach((x) => chosen.add(x));
      paint();
    };
    knob.appendChild(group);
    if (count) knob.appendChild(el('p', 'knob-note', 'choose ' + count));
  },
  // A grid of cells the visitor cycles through their states, row by row. The arrow keys walk the
  // cells; each is named for a screen reader by where it is and what it shows.
  grid(step, knob, askId) {
    const rows = Math.max(1, Math.min(10, Number(step.rows) || 3));
    const cols = Math.max(1, Math.min(10, Number(step.cols) || 3));
    const states = Math.max(2, Math.min(6, Number(step.states) || 2));
    const labels = Array.isArray(step.labels) ? step.labels : [];
    const n = rows * cols;
    const norm = (v) => (((Number(v) | 0) % states) + states) % states;
    let cells = Array.isArray(step.value) && step.value.length === n ? step.value.map(norm) : new Array(n).fill(0);
    const state = current.state.get(step.id);
    state.value = cells.slice();
    const table = el('div', 'knob-grid');
    table.setAttribute('role', 'group');
    table.setAttribute('aria-labelledby', askId);
    table.style.setProperty('--grid-cols', String(cols));
    const buttons = [];
    const name = (i) => 'row ' + (Math.floor(i / cols) + 1) + ', column ' + ((i % cols) + 1) + ': '
      + (labels[cells[i]] != null ? String(labels[cells[i]]) : (states === 2 ? (cells[i] ? 'on' : 'off') : 'state ' + cells[i]));
    const flips = new Array(n).fill(''); // which of the two flip spells each cell played last
    function paint() {
      buttons.forEach((b, i) => {
        const was = b.dataset.state;
        b.dataset.state = String(cells[i]);
        b.setAttribute('aria-label', name(i));
        if (states === 2) b.setAttribute('aria-pressed', cells[i] ? 'true' : 'false');
        b.textContent = states > 2 && cells[i] ? String(cells[i]) : '';
        // A cell that changed its state flips in one cut with a one-frame oversize (cell-flip,
        // cell-flip-b: the two alternate so every flip restarts); its neighbours stay still.
        if (was !== undefined && was !== b.dataset.state && !calm.matches) {
          flips[i] = flips[i] === 'a' ? 'b' : 'a';
          b.setAttribute('data-flip', flips[i]);
        }
      });
    }
    for (let i = 0; i < n; i++) {
      const b = el('button', 'knob-cell');
      b.type = 'button';
      b.addEventListener('click', () => {
        cells[i] = (cells[i] + 1) % states;
        paint();
        const v = cells.slice();
        apply(step.id, v);
        markSet(step.id, v, 'knob');
      });
      buttons.push(b);
      table.appendChild(b);
    }
    table.addEventListener('keydown', (ev) => {
      const at = document.activeElement ? buttons.indexOf(document.activeElement) : -1;
      if (at < 0) return;
      let to = -1;
      if (ev.key === 'ArrowRight') to = at + 1;
      else if (ev.key === 'ArrowLeft') to = at - 1;
      else if (ev.key === 'ArrowDown') to = at + cols;
      else if (ev.key === 'ArrowUp') to = at - cols;
      if (to >= 0 && to < n) {
        ev.preventDefault();
        buttons[to].focus();
      }
    });
    state.update = (v) => {
      if (Array.isArray(v) && v.length === n) {
        cells = v.map(norm);
        paint();
      }
    };
    paint();
    knob.appendChild(table);
  },
  press(step, knob) {
    const count = Math.max(1, Math.min(12, Number(step.count) || 3));
    const label = step.label || 'press';
    const word = (left) => (count > 1 && left > 0 ? label + ' (' + left + ')' : label);
    let n = 0;
    const b = el('button', 'knob-big', word(count));
    b.type = 'button';
    // Each press punches a notch (README: "Motion axiom"): a row of stamped-out seals under the
    // button, one filled per press in a cut with a one-frame oversize (notch-punch), so the count
    // is visible as well as said; the last notch is the knob's own seal.
    const notches = el('span', 'knob-notches');
    notches.setAttribute('aria-hidden', 'true');
    const marks = [];
    for (let i = 0; i < count; i++) {
      const notch = el('i');
      notch.style.setProperty('--notch-i', String(i));
      marks.push(notch);
      notches.appendChild(notch);
    }
    b.addEventListener('click', () => {
      n += 1;
      inscribe(b, word(count - n));
      if (marks[n - 1]) marks[n - 1].setAttribute('data-done', '');
      knob.style.setProperty('--knob-pct', ((n / count) * 100).toFixed(1) + '%');
      apply(step.id, n);
      if (n >= count) markSet(step.id, n, 'knob');
    });
    knob.appendChild(b);
    knob.appendChild(notches);
  },
  hold(step, knob) {
    const ms = Math.max(300, Math.min(8000, Number(step.ms) || 1500));
    const b = el('button', 'knob-big knob-hold', step.label || 'press and hold');
    b.type = 'button';
    let started = 0;
    let ticker = null;
    let fired = false; // this press has already filled the bar and set the knob
    const halt = () => {
      if (ticker) ticker();
      ticker = null;
    };
    function down() {
      if (started || b.disabled) return;
      started = performance.now();
      fired = false;
      b.classList.add('is-held');
      b.setAttribute('aria-pressed', 'true');
      // Registered, so a hold still down when the piece goes -- a finger that never lifts, a knob
      // disabled under it -- leaves no ticker running against a knob that is no longer anywhere.
      ticker = ticking(paint, 50);
    }
    // The bar, and the knob the moment the bar is full: the holding is the answer and the letting
    // go is not part of it, so a visitor who watches it fill and keeps holding has already set the
    // knob and the piece carries on under their finger (issue #74).
    // The bar advances in the knob's own treads (barTreads) and holds between them: the ticker
    // writes only when the next tread is reached, so the step series is in the data and the
    // stylesheet has nothing to smooth.
    let shown = '';
    function paint() {
      const held = performance.now() - started;
      if (held >= ms) {
        fill(held);
        return;
      }
      const s = current && current.state.get(step.id);
      const pct = (snapTread(held / ms, s && s.treads) * 100).toFixed(1) + '%';
      if (pct === shown) return;
      shown = pct;
      knob.style.setProperty('--knob-pct', pct);
    }
    function fill(held) {
      fired = true;
      halt(); // there is nothing left to paint: the bar stays full under the finger
      shown = '100%';
      knob.style.setProperty('--knob-pct', '100%');
      apply(step.id, held);
      markSet(step.id, held, 'knob');
    }
    // Letting go. After the bar filled this is nothing at all -- the knob is set, and setting it
    // twice over or saying it was let go early would both be lies. Before it, it is a hold that
    // did not last, and the bar goes back to where it started.
    function up() {
      if (!started) return;
      started = 0;
      halt();
      b.classList.remove('is-held');
      b.setAttribute('aria-pressed', 'false');
      if (fired) return;
      shown = '0%';
      knob.style.setProperty('--knob-pct', '0%'); // one cut back: the spring let go
      // The refusal: two hard cuts on the button (hold-refuse), and the line typed in.
      if (motion && typeof motion.rite === 'function' && !calm.matches) motion.rite(b, 'refusing', riteMs('short', 170) + 200);
      speak(ui.status, 'let go early; hold it longer');
    }
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      down();
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('blur', up);
    b.addEventListener('keydown', (ev) => {
      if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
        ev.preventDefault();
        down();
      }
    });
    b.addEventListener('keyup', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        up();
      }
    });
    knob.appendChild(b);
    knob.appendChild(el('span', 'knob-bar'));
  },
  tap(step, knob) {
    knob.appendChild(el('span', 'knob-bar'));
    // The scene is the control; this button is for anyone who cannot tap it.
    const b = el('button', 'btn-text knob-alt', step.label || 'tap for me');
    b.type = 'button';
    b.addEventListener('click', () => {
      // As live as the scene it stands in for, after the piece is finished as well (issue #86).
      if (!current || typeof current.piece.tap !== 'function') return;
      current.touched = true;
      current.inTap = true;
      try {
        current.piece.tap(0.2 + altRnd() * 0.6, 0.2 + altRnd() * 0.6, current.ctx);
      } catch (e) {
        /* the piece's tap failing is the piece's own problem */
      }
      current.inTap = false;
    });
    knob.appendChild(b);
  },
  wait(step, knob) {
    knob.appendChild(el('span', 'knob-bar'));
  }
};

/* ---- frames and taps ----------------------------------------------------------------------- */

function startFrames() {
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}

function frame(now) {
  frameHandle = 0;
  const c = current;
  if (!c || !c.ctx || !c.ctx.g) {
    lastFrame = 0;
    return;
  }
  const dt = lastFrame ? Math.max(0, Math.min(0.05, (now - lastFrame) / 1000)) : 0.016;
  lastFrame = now;
  if (!document.hidden) {
    try {
      if (typeof c.piece.frame === 'function') c.piece.frame((now - c.startedAt) / 1000, dt, c.ctx);
    } catch (e) {
      /* a frame that throws is skipped; the next may not */
    }
  }
  frameHandle = requestAnimationFrame(frame);
}

/* ---- every press on the scene is answered -------------------------------------------------- */

/* The tiny rejection of the responsiveness axiom above (issue #89): one mark at the point pressed,
   laid in the scene over the canvas, and taken away again a fifth of a second later. The press is
   visibly received and nothing else about the piece is touched -- no knob, no progress, no status
   line, no sound, and nothing the piece can see.

   The mark is written here rather than drawn on the canvas on purpose: the canvas belongs to the
   piece, which may be mid-frame and is about to paint over anything the stage put there. It takes
   no press of its own and says nothing to a screen reader -- it is the picture answering a touch,
   and a visitor who cannot see it is told nothing by it that the scene's label does not already
   say. _sass/_stage.scss animates it, and holds it still for a visitor who asked for less motion;
   `is-still` is that same answer in the stage's own hand, so the law can read which one played. */
const REJECT_MS = 240; // how long the mark stays, whether it moves or not

function rejectTap(x, y) {
  if (!ui || !ui.scene) return;
  const mark = el('span', 'stage-reject');
  mark.setAttribute('aria-hidden', 'true');
  if (calm.matches) mark.classList.add('is-still');
  mark.style.setProperty('left', (x * 100).toFixed(2) + '%');
  mark.style.setProperty('top', (y * 100).toFixed(2) + '%');
  // The refused press is warded (README: "Motion axiom"): a generated ward glyph -- a rolled
  // three-to-seven-spoke asterisk at a rolled turn with a rolled gap -- that the stylesheet shows
  // in four hard frames (stage-reject) and never ripples. Pure paint: no glyph text, no fade.
  mark.style.setProperty('--ward-spokes', String(3 + Math.floor(altRnd() * 5)));
  mark.style.setProperty('--ward-rot', Math.round(altRnd() * 360) + 'deg');
  mark.style.setProperty('--ward-gap', (0.3 + altRnd() * 0.4).toFixed(2));
  ui.scene.appendChild(mark);
  // Registered like every other timer of the stage's, so a mark pressed out of a piece on its way
  // out goes with it rather than outliving it; close() sweeps whatever is still there.
  later(() => mark.remove(), REJECT_MS);
}

// Where the press landed in the scene, as a fraction of it: 0..1, and the middle for a pointer
// that arrived without coordinates, so a press is never answered at a corner it was nowhere near.
function pressedAt(value, from, size) {
  const f = (Number(value) - from) / size;
  return isFinite(f) ? Math.max(0, Math.min(1, f)) : 0.5;
}

if (ui) {
  // A tap on the scene, finished or not: a piece that is over is still a piece to play with
  // (issue #86), so nothing here asks whether it is done. And the press is answered either way:
  // the piece's own tap() where there is one to reach, and the stage's small mark where there is
  // not, because a press that lands on nothing at all is the one thing the scene may not do
  // (issue #89).
  ui.canvas.addEventListener('pointerdown', (ev) => {
    const r = ui.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return; // the scene is not on the screen: there was nothing to press
    const x = pressedAt(ev.clientX, r.left, r.width);
    const y = pressedAt(ev.clientY, r.top, r.height);
    const c = current;
    if (!c || typeof c.piece.tap !== 'function' || !tapsOpen()) {
      rejectTap(x, y);
      return;
    }
    c.touched = true;
    c.inTap = true;
    try {
      c.piece.tap(x, y, c.ctx);
    } catch (e) {
      // The piece's tap failing is the piece's own problem, but the press is still the visitor's:
      // a tap() that threw answered nothing, so the stage answers in its place.
      rejectTap(x, y);
    }
    c.inTap = false;
  });
}

/* ---- finishing ----------------------------------------------------------------------------- */

/* The piece is finished: the ceremony runs and the way on lights, and that is the whole of what
   changes. Done is not the End (issue #86): the frame loop keeps running, the knobs stay enabled
   and settable again, a tap still reaches tap(), and nothing of the piece is taken apart -- close()
   is the one teardown and the only thing that reaches it is the next piece actually opening. The
   knobs used to be disabled here, in one line, which turned a toy into a picture of a toy the
   moment it was solved: a visitor still playing with the thing found it dead under their hands,
   over a mark that said the stage was waiting for them.

   It runs once. A knob re-set after this does not play a second ceremony, dispatch a second
   'stage:complete' or re-light anything -- one piece is finished once -- and markSet() sees to that
   by only reaching here when a knob goes from unset to set. What a re-set knob does reach is the
   piece's own apply(), which is where fidgeting with a finished toy belongs. */
function finish(say) {
  const c = current;
  if (!c || c.completed) return;
  c.completed = true;
  for (const s of c.state.values()) {
    if (!s.set) {
      s.set = true;
      if (s.knob) s.knob.classList.add('is-set');
    }
  }
  renderProgress();
  // Every knob is set, so every gate stands open: a knob that was waiting on another is now one
  // more thing to play with rather than one more thing dimmed out.
  updateGates();
  // What the verifier said on the solve, or the default; the piece's own closing line, if it
  // writes one in end(), stands over both.
  speak(ui.status, say || (c.piece.title ? 'solved: ' + c.piece.title : 'solved'));
  c.tally = tally(c);
  renderTries();
  renderCheck();
  try {
    if (typeof c.piece.end === 'function') c.piece.end(c.ctx);
  } catch (e) {
    /* the finale is optional */
  }
  setMode('done');
  // The seal (README: "Motion axiom"): the done chip is stamped like wax by the stylesheet on its
  // un-hiding (stage-pop in hard treads, an ink splat drying under it), at a tilt and with a tooth
  // count rolled for this solve and no other, and the word lands by the glyph rite.
  particulars(ui.done, altRnd);
  ui.done.hidden = true;
  inscribe(ui.doneText, 'solved');
  ui.done.hidden = false;
  // The finale is on the scene, which on a phone may be above the knob that finished it. The done
  // mark is not: it reports from the end of the dots' row in the rail, clear of the picture.
  const box = ui.scene.getBoundingClientRect();
  if (box.top < 0 || box.bottom > window.innerHeight) scrollSceneIntoView(ui.scene);
  chime();
  burst();
  try {
    window.dispatchEvent(new CustomEvent('stage:complete', { detail: { file: c.world.file, seed: c.seed } }));
  } catch (e) {
    /* no event, no matter */
  }
  // The ceremony lingers, and then the way on lights up and the stage stops -- stops moving, not
  // stops working. What used to happen here was the departure itself, on a timer; a finished piece
  // is the visitor's to sit with, and go on playing with, for as long as they like now, and the
  // press is what sends it away (issues #78 and #86).
  const token = c.token;
  later(() => {
    if (!current || current.token !== token) return;
    lightTheWayOn(true);
  }, calm.matches ? 500 : 1200);
}

/* ---- the way on ----------------------------------------------------------------------------- */

// Lit: there is somewhere to go. `disabled` is the whole of the state -- the stylesheet dims it,
// fills it and raises it off that one flag -- so there is nothing here to fall out of step with
// what the visitor sees. A finished piece also hands it the keyboard, so the way on is one key
// away from the knob that finished the piece; the stage's other lit moments (a piece waiting on a
// sky, a world with nothing to play) leave the focus on the heading, where they already put it.
function lightTheWayOn(focus) {
  if (!ui.onward) return;
  ui.onward.disabled = false;
  if (focus) ui.onward.focus({ preventScroll: true });
}

function dimTheWayOn() {
  if (ui.onward) ui.onward.disabled = true;
}

// The way on, pressed: the piece scales away and the next card opens in its place -- exactly what
// the timer in finish() used to do on the visitor's behalf. A piece nobody finished is replaced in
// the history rather than kept, so the back button walks back through what was finished and not
// what was passed over.
function goOn() {
  if (!ui.onward || ui.onward.disabled) return;
  dimTheWayOn(); // one press is one piece: a second one cannot overtake the first
  const finished = !!(current && current.completed);
  const piece = current; // null where there was nothing to finish: a missing module, or a gate
  setMode('vanishing');
  // The vanish takes the time the stylesheet is giving it right now (--motion-long, rolled by
  // js/motion.js), so the next piece opens once the last has gone and not a frame before.
  later(() => {
    if (current !== piece) return; // something else took the stage while this one was leaving
    next(finished ? {} : { replace: true });
  }, calm.matches ? 120 : riteMs('long', 520) + 40);
}

async function next(options) {
  const extra = options || {};
  const feed = window.interestingFeed;
  // With no sky yet, a card whose world reads one is passed over for the next that does not, so
  // the river keeps flowing (the feed deals the one unlock card early anyway). Which worlds read
  // the sky is what their modules say, so the modules are loaded first -- small, and cached after
  // the first time -- with a short limit so a slow network never holds the river up.
  const stars = persona ? persona.stars() : [];
  if (!stars.length && WORLDS.some((w) => !readsSky.has(w.id))) {
    const token = (pending = {});
    await Promise.race([
      Promise.all(WORLDS.map((w) => loadModule(w.id))),
      new Promise((resolve) => window.setTimeout(resolve, 1500))
    ]);
    if (pending !== token) return; // something else opened meanwhile
  }
  const fit = stars.length ? null : (file) => readsSky.get(file.replace(/\.html$/, '')) !== true;
  const avoid = current ? current.world.file : null;
  const taken = feed && typeof feed.take === 'function' ? feed.take(fit, avoid) : null;
  let file = taken && worldOf(taken.file) ? taken.file : null;
  let seed = taken ? taken.seed : newSeed();
  // The next card off the stack is a card too: its whole configuration arrives with it, the same
  // way a pressed card's does, so the piece that opens is that card and not a generic turn of its
  // world. A world picked at random below has no card, and open() derives one from its seed.
  const seeds = file && taken ? taken.seeds : null;
  const variant = file && taken ? taken.variant : null;
  const card = file && taken ? taken.card : null;
  if (!file) {
    const pool = WORLDS.filter((w) => w.file !== avoid && (!fit || fit(w.file)));
    const world = pool.length ? pool[Math.floor(Math.random() * pool.length)] : WORLDS[0];
    if (!world) return;
    file = world.file;
  }
  if (extra.first) firstPiece = { file, seed };
  open(file, seed, Object.assign({ arriving: true, seeds, variant, card }, extra));
}

// Take the piece on stage apart, completely. Every instantiation starts from an empty stage, so
// this is the one teardown and it leaves nothing of the last piece behind: no timer of its
// ceremony, no ticker under a knob still held, no frame loop, no knob, no line, no dot, no mark,
// and no scene. Everything open() goes on to write is cleared here too, so a close() that opens
// nothing after it -- the threshold going back, the question coming up -- is just as clean.
function close() {
  pending = null;
  stopRunning();
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  lastFrame = 0;
  current = null;
  if (ui.gate) {
    ui.gate.remove();
    ui.gate = null;
  }
  for (const box of ui.body.querySelectorAll('.unlock')) box.remove();
  // A press answered a moment ago, whose mark had not yet timed out: stopRunning() above cleared
  // the timer that would have taken it away, so it comes away with the rest of the piece.
  for (const mark of ui.scene.querySelectorAll('.stage-reject')) mark.remove();
  const g = ui.canvas.getContext('2d');
  if (g) g.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  ui.canvas.setAttribute('aria-label', 'the scene');
  ui.scene.style.removeProperty('--piece-aspect');
  ui.scene.style.removeProperty('--piece-ratio');
  for (let k = 1; k <= 4; k++) ui.scene.style.removeProperty('--plate-' + k);
  delete stage.dataset.dealing;
  delete stage.dataset.redeal;
  delete stage.dataset.powered;
  delete stage.dataset.reflow;
  delete stage.dataset.turning;
  delete stage.dataset.try;
  delete stage.dataset.tryParity;
  if (ui.sigil) {
    ui.sigil.textContent = '';
    ui.sigil.hidden = true;
  }
  ui.brief.textContent = '';
  if (ui.goalText) ui.goalText.textContent = '';
  if (ui.goal) ui.goal.hidden = true;
  ui.knobs.textContent = '';
  if (ui.check) {
    ui.check.disabled = true;
    ui.check.textContent = 'check';
  }
  if (ui.tries) {
    ui.tries.textContent = '';
    ui.tries.hidden = true;
  }
  delete stage.dataset.verdict;
  ui.status.textContent = '';
  ui.progress.textContent = '';
  if (ui.wanted) {
    ui.wanted.textContent = '';
    ui.wanted.hidden = true;
  }
  ui.doneText.textContent = 'done';
  ui.done.hidden = true;
  dimTheWayOn();
}

// The threshold's own state, back from a piece: what the page said before anything opened.
function goHome() {
  close();
  inscribe(ui.world, home.name);
  const returning = ui.title.textContent !== home.line;
  ui.title.textContent = home.line;
  if (returning) reveal(ui.title); // the invitation re-materialises by the glyph rite
  if (ui.read) ui.read.hidden = true;
  document.title = home.title;
  // Nothing is featured now, so the site goes back to its own colour: the page's own world, or
  // the visitor's reading over it.
  unfeature();
  setMode('quiet');
  try {
    window.dispatchEvent(new CustomEvent('stage:home'));
  } catch (e) {
    /* nothing */
  }
}

/* ---- ceremony ------------------------------------------------------------------------------ */

/* The chime is cast from the working (README: "Motion axiom"), never the same three sines: three to
   five notes whose degrees are rolled from a small modal table -- a brighter mode for the tender
   worlds, one with a flattened degree for the restless ones -- at intervals rolled between 70 and
   240ms with one hesitation and one grace note, the waveform rolled between sine and triangle,
   the whole at the mood's tempo, the last note now and then doubled an octave up as a flicker.
   Seeded from the seed, so a shared working rings the same and no two workings ring alike. The
   envelope is a step series of its own: hard attacks and held steps down, no ramps. Quiet. */
const MODES = {
  bright: [0, 2, 4, 6, 7, 9, 11, 12], // lydian-ish
  plain: [0, 2, 4, 5, 7, 9, 11, 12],
  flat: [0, 2, 3, 5, 7, 8, 10, 12], // a flattened third and sixth
  open: [0, 2, 5, 7, 9, 12, 14]
};
const TENDER_MOODS = ['tender', 'quiet', 'soft', 'warm', 'calm', 'still', 'gentle'];
const RESTLESS_MOODS = ['restless', 'wild', 'sharp', 'feral', 'fierce', 'dark', 'cold', 'storm'];

function chime() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    if (!chime.ctx) chime.ctx = new Ctor();
    const ac = chime.ctx;
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    const seed = current ? current.seed : newSeed();
    const mood = current ? String(current.world.mood || '') : '';
    const own = mulberry32((seed ^ 0x51a7) >>> 0);
    const tempo = riteTempo();
    const family = TENDER_MOODS.indexOf(mood) !== -1 ? 'bright' : RESTLESS_MOODS.indexOf(mood) !== -1 ? 'flat'
      : (own() < 0.5 ? 'plain' : 'open');
    const scale = MODES[family];
    const base = 440 * Math.pow(2, (own() < 0.5 ? 0 : 3) / 12); // A or C, this working's choosing
    const count = 3 + Math.floor(own() * 3);
    const hesitation = Math.floor(own() * count); // the one note held back
    const grace = Math.floor(own() * count); // the one note with a grace before it
    const wave = own() < 0.6 ? 'sine' : 'triangle';
    const now = ac.currentTime;
    let at = 0;
    let degree = Math.floor(own() * 3);
    for (let i = 0; i < count; i++) {
      degree = Math.max(0, Math.min(scale.length - 1, degree + (own() < 0.7 ? 1 + Math.floor(own() * 2) : -1)));
      const freq = base * Math.pow(2, scale[degree] / 12);
      if (i === grace) note(ac, wave, freq * Math.pow(2, -2 / 12), now + at, 0.06, 0.02); // the slip
      note(ac, wave, freq, now + at, 0.42 + own() * 0.2, 0.045);
      if (i === count - 1 && own() < 0.35) note(ac, wave, freq * 2, now + at + 0.05, 0.16, 0.02); // the flicker
      at += (0.07 + own() * 0.17 + (i === hesitation ? 0.14 : 0)) * tempo;
    }
  } catch (e) {
    /* no sound is fine */
  }
}

// One note: a hard attack and a step series of held gains down to nothing, never a ramp.
function note(ac, wave, freq, at, length, loud) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, at);
  const steps = 4;
  gain.gain.setValueAtTime(loud, at);
  for (let s = 1; s <= steps; s++) gain.gain.setValueAtTime(loud * (1 - s / steps) * 0.8, at + (length * s) / steps);
  gain.gain.setValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

// A hash in 0..1 of a few integers, for the dither that decides what is drawn on a frame.
function dither(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function burst() {
  if (calm.matches || !ui.burst) return;
  const canvas = ui.burst;
  const box = stage.getBoundingClientRect();
  const scene = ui.scene.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = current ? current.env.colors : FALLBACK;
  const seed = current ? current.seed : newSeed();
  const cx = scene.left - box.left + scene.width / 2;
  const cy = scene.top - box.top + scene.height / 2;
  /* The burst is the stamping of the working onto the plate (README: "Motion axiom"), drawn in
     hard-held frames: a generated seal -- a polygon of rolled sides, a ring of the seed's digits
     ticking round it, hatch lines at a rolled angle -- is impressed over the scene's centre,
     flips to its negative, holds, and dissolves through a dither matte (cells let through by a
     seeded threshold falling in rolled treads, never an alpha fade); the shards of the palette fly
     out in a rolled number of sectors and die by dither too, each drawn or not on a frame by a
     seeded coin and never dimmed. The ring opens in treads along a wipe curve rolled for this one
     finish. Seeded from the seed for its shape, from the roll for its holds. */
  const own = mulberry32((seed ^ 0x5ea1) >>> 0);
  const grain = motion && motion.temper ? Number(motion.temper.grain) || 0.45 : 0.45;
  const ringOpens = riteEase('wipe');
  const ringReach = 700 + Math.random() * 400;
  const sides = 3 + Math.floor(own() * 7);
  const turn = own() * Math.PI * 2;
  const R = Math.max(40, Math.min(scene.width, scene.height) * (0.14 + own() * 0.1));
  const hatch = own() * Math.PI;
  const pitch = 5 + Math.round(own() * 6);
  const digits = String(seed);
  const sectors = 2 + Math.floor(own() * 5);
  const cell = 8 + Math.round(own() * 8);
  const dash = [4 + Math.round(own() * 10), 3 + Math.round(own() * 8)];
  // The dissolve: coverage falls from 1 to 0 in a rolled number of uneven treads.
  const treads = [];
  const n = 4 + Math.floor(own() * 4);
  for (let i = 1; i < n; i++) treads.push(Math.max(0.02, Math.min(0.98, (n - i + (own() - 0.5) * 0.8) / n)));
  treads.sort((a, b) => b - a);
  treads.push(0);
  const parts = [];
  for (let i = 0; i < 110; i++) {
    const sector = Math.floor(own() * sectors);
    const spread = (Math.PI * 2) / sectors;
    const a = sector * spread + turn + (own() - 0.5) * spread * 0.45;
    const v = 140 + own() * 520;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 1.5 + own() * 4,
      c: [colors.accent, colors.accent2, colors.fg][i % 3], life: 0.8 + own() * 0.7, age: 0 });
  }
  const plan = {
    positive: 0.16 + Math.random() * 0.08, // seconds the positive seal holds
    negative: 0.1 + Math.random() * 0.08, // the negative
    again: 0.08 + Math.random() * 0.06, // positive once more
    dissolve: 0.6 + Math.random() * 0.3 // the dither dissolve
  };
  const total = plan.positive + plan.negative + plan.again + plan.dissolve;
  function seal(negative, coverage) {
    // The dither matte: only the cells the seeded threshold lets through at this coverage show.
    if (coverage <= 0) return;
    g.save();
    if (coverage < 1) {
      g.beginPath();
      const span = R * 1.5;
      for (let y = -span; y < span; y += cell) {
        for (let x = -span; x < span; x += cell) {
          if (dither(Math.round(x / cell), Math.round(y / cell), seed) < coverage) g.rect(cx + x, cy + y, cell, cell);
        }
      }
      g.clip();
    }
    const ink = negative ? colors.bg : colors.accent;
    const paper = negative ? colors.accent : colors.bg;
    g.lineWidth = 3;
    g.strokeStyle = ink;
    g.fillStyle = paper;
    g.beginPath();
    for (let s = 0; s <= sides; s++) {
      const a = turn + (s / sides) * Math.PI * 2;
      const r = R * (s % 2 ? 1 : 0.9);
      if (s) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
    // The hatch, clipped to the seal.
    g.save();
    g.clip();
    g.lineWidth = 1;
    g.strokeStyle = alpha(ink, 0.55);
    g.beginPath();
    for (let d = -R * 2; d < R * 2; d += pitch) {
      g.moveTo(cx + Math.cos(hatch) * d - Math.sin(hatch) * R * 2, cy + Math.sin(hatch) * d + Math.cos(hatch) * R * 2);
      g.lineTo(cx + Math.cos(hatch) * d + Math.sin(hatch) * R * 2, cy + Math.sin(hatch) * d - Math.cos(hatch) * R * 2);
    }
    g.stroke();
    g.restore();
    // The ring of digits round it, in the tertiary, each on its spoke.
    g.fillStyle = negative ? colors.bg : colors.accent2;
    g.font = 'bold 12px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < digits.length; i++) {
      const a = turn + (i / digits.length) * Math.PI * 2;
      g.fillText(digits.charAt(i), cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14));
    }
    g.restore();
  }
  let last = performance.now();
  let elapsed = 0;
  let held = 0; // raf frames the drawn frame is held for: every frame is held
  let frames = 0;
  function tick(now) {
    // A frame's timestamp can precede the performance.now() read just before it: never negative.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    frames += 1;
    elapsed += dt;
    if (held > 0) {
      held -= 1;
      requestAnimationFrame(tick);
      return;
    }
    held = 1 + Math.floor(Math.random() * (2 + grain * 2));
    g.clearRect(0, 0, box.width, box.height);
    // The ring, opening in six treads and gone in one cut.
    const open = ringOpens(Math.min(1, elapsed / 1.1));
    if (elapsed < 1.1) {
      g.lineWidth = 2;
      g.strokeStyle = colors.accent;
      g.setLineDash(dash);
      g.lineDashOffset = frames * 3;
      g.beginPath();
      g.arc(cx, cy, Math.max(0, (Math.floor(open * 6) / 6) * ringReach), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    // The seal: positive, negative, positive, then eaten by the dither in treads.
    let coverage = 1;
    let negative = false;
    if (elapsed < plan.positive) negative = false;
    else if (elapsed < plan.positive + plan.negative) negative = true;
    else if (elapsed < plan.positive + plan.negative + plan.again) negative = false;
    else {
      const f = (elapsed - plan.positive - plan.negative - plan.again) / plan.dissolve;
      coverage = treads[Math.min(treads.length - 1, Math.floor(f * treads.length))];
    }
    seal(negative, coverage);
    // The shards: moved every frame, drawn when the dither says so, dimmed never.
    let alive = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.age += dt;
      if (p.age > p.life) continue;
      alive++;
      p.vy += 420 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (dither(i, frames, seed) < p.age / p.life) continue; // dying by dither
      g.fillStyle = p.c;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    if (alive || elapsed < total) requestAnimationFrame(tick);
    else g.clearRect(0, 0, box.width, box.height);
  }
  requestAnimationFrame(tick);
}

/* ---- the threshold ------------------------------------------------------------------------- */

function readingNow() {
  const t = window.threshold;
  if (!t || typeof t.reading !== 'function') return null;
  try {
    return t.reading();
  } catch (e) {
    return null;
  }
}

// On the threshold the stage asks first. The persona puts the sideways question in #persona-probe
// (un-hiding it) and clears it when the question is answered or skipped; a reading opens a piece
// of the world it opens onto; with no reading the stage waits quiet, with the one button that asks
// and the one that skips to the first card instead.
function thresholdStart() {
  const probe = document.getElementById('persona-probe');
  const controls = document.getElementById('threshold-controls');
  const askButton = document.getElementById('threshold-ask');
  const skipButton = document.getElementById('threshold-skip');
  let wasAsking = false; // the question was just up: whatever it leaves behind opens a fresh piece

  if (controls) controls.hidden = false;
  if (ui.again) ui.again.hidden = false;
  function ask() {
    if (persona && typeof persona.ask === 'function') persona.ask();
  }
  if (askButton) askButton.addEventListener('click', ask);
  if (ui.again) ui.again.addEventListener('click', ask);
  if (skipButton) {
    skipButton.addEventListener('click', () => {
      if (ui.read) ui.read.hidden = true;
      next();
    });
  }

  function render() {
    const asking = !!(probe && !probe.hidden);
    if (asking) {
      // Through goHome(), not a bare close(): the piece that was on takes its name, its line and
      // its featured palette with it, so the question is asked on the threshold's own ground.
      if (current || pending) goHome();
      setMode('asking');
      wasAsking = true;
      return;
    }
    const r = readingNow();
    const o = r && r.orientation;
    const read = !!(o && r.source && r.source !== 'signals');
    const fresh = wasAsking;
    wasAsking = false;
    if (read && worldOf(o.world) && (fresh || (!current && !pending))) {
      if (ui.read) {
        inscribe(ui.read, (r.source === 'answer' ? 'read just now as ' : 'carried over as ') + o.name);
        ui.read.hidden = false;
      }
      open(o.world, newSeed(), { arriving: true, keepRead: true, focus: r.source === 'answer' });
      return;
    }
    if (!current && !pending) setMode('quiet');
  }

  if (probe && window.MutationObserver) {
    new MutationObserver(render).observe(probe, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('threshold:reading', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}

/* ---- the address --------------------------------------------------------------------------- */

function parseHash() {
  const h = (location.hash || '').slice(1);
  const m = h.match(/^(?:([a-z0-9-]+):)?(\d{1,10})$/);
  if (!m) return null;
  return { world: m[1] ? m[1] + '.html' : null, seed: Number(m[2]) };
}

function start() {
  if (!stage) return;
  const pageWorld = stage.dataset.stageWorld ? stage.dataset.stageWorld + '.html' : null;
  const threshold = stage.dataset.threshold === 'true';
  const random = stage.dataset.stageRandom === 'true';

  if (ui.onward) ui.onward.addEventListener('click', goOn);
  if (ui.check) ui.check.addEventListener('click', judge);
  window.addEventListener('resize', reflow);
  // The heading changes shape without the window doing anything -- a longer title, a font that
  // arrives late, a mode that puts the ask up instead -- and the scene is sized against it.
  if (window.ResizeObserver && ui.head) new window.ResizeObserver(reflow).observe(ui.head);
  sizeHead();
  window.addEventListener('popstate', (ev) => {
    const s = ev.state && ev.state.world ? ev.state : parseHash();
    if (s && s.world && worldOf(s.world)) {
      // Back or forward through the pieces: an arrival like any other (README: "Motion axiom").
      if (!current || current.world.file !== s.world || current.seed !== s.seed) open(s.world, s.seed, { push: false, arriving: true });
      return;
    }
    if (location.hash) return; // the page's own fragment (the skip link): nothing to do
    if (threshold) goHome();
    else if (random && firstPiece) open(firstPiece.file, firstPiece.seed, { push: false, keepRead: true, arriving: true });
    // A world page's own entry always carries its piece's hash, so there is nothing else to land on.
  });
  // Learn which worlds read the sky, after the first paint has had its turn.
  window.setTimeout(() => {
    for (const w of WORLDS) loadModule(w.id);
  }, 1500);
  /* Settable where it is a dependency (issue #93): every piece this stage deals is made at the
     persona's difficulty, so the one slider that sets it stands beside the piece as well as in the
     sheet. A piece is never powered down over it: the setting always holds a value, and the
     alternative would be every puzzle on the site dimmed behind a slider nobody had been asked to
     touch yet. */
  if (ui.tune && persona && typeof persona.tuner === 'function') {
    persona.tuner(ui.tune, { note: 'Every piece on this site is dealt at this setting.' });
  }
  if (persona && typeof persona.onDifficulty === 'function') {
    // Deal this piece again whenever the setting changes -- the same seed and the same card, so
    // the subject the visitor pressed stays the subject and only how hard it is asked moves. The
    // re-deal hangs off the persona's own change rather than this slider's, so moving the setting
    // in the persona sheet changes the piece on the stage just as moving the slider beside it
    // does: one setting, every puzzle on the site, settable wherever it is met.
    persona.onDifficulty(() => {
      if (!current) return;
      // The re-deal is a shuffle (README: "Motion axiom"): the rail that was is unmade and the
      // same working is dealt again through its own matte -- an arrival with no travel (redeal).
      open(current.world.file, current.seed,
        { push: false, focus: false, variant: current.variant, card: current.card, arriving: true, redeal: true });
    });
  }
  if (persona && typeof persona.onSky === 'function') {
    persona.onSky(() => {
      // A piece that reads the sky is made from it: a changed sky is a new piece -- unless the
      // visitor has already begun this one, whose progress is theirs to keep.
      if (current && current.mod && current.mod.needsSky && !current.completed && !current.touched) {
        // The same card, remade under the new sky: the configuration it opened with goes back in,
        // so a piece re-made for a sky is still the card that was pressed.
        open(current.world.file, current.seed,
          { push: false, focus: false, variant: current.variant, card: current.card, arriving: true, redeal: true });
      }
    });
  }

  // The first open is the most-seen open of all, so it arrives like every other (README: "Motion
  // axiom"): the plate develops, the words land, the knobs are dealt. 'arriving' is the mode's
  // name for it and 'live' is where it lands, as for a card pressed in the feed.
  if (threshold) {
    thresholdStart();
  } else if (pageWorld) {
    const h = parseHash();
    const file = h && h.world && worldOf(h.world) ? h.world : pageWorld;
    open(file, h ? h.seed : newSeed(), { push: true, replace: true, focus: false, arriving: true });
  } else if (random) {
    // A page of no world (the 404): whatever comes next, which is the first card of the feed. The
    // address stays what was asked for, with the line that says there is no page there.
    const h = parseHash();
    if (h && h.world && worldOf(h.world)) open(h.world, h.seed, { push: false, focus: false, arriving: true });
    else next({ push: false, keepRead: true, focus: false, first: true });
  }
}

if (stage) {
  window.interestingStage = {
    open,
    next,
    current: () => (current ? { file: current.world.file, seed: current.seed } : null),
    worlds: () => WORLDS.slice()
  };
}

start();
try {
  window.dispatchEvent(new CustomEvent('stage:ready'));
} catch (e) {
  /* no event, no matter */
}
