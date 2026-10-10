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
  exactly once -- one 'stage:complete', one chime, one landing of the done chip -- so fidgeting with
  a finished toy changes the piece without re-staging the finish.

  ---------------------------------------------------------------------------------------------
  The responsiveness axiom: every press on the scene does something

  Unresponsiveness is uninteresting (issue #89). A press on the picture is a visitor asking the
  piece a question, and an answer of nothing at all is the one answer this site does not give.
  Most of the time the piece answers: the press reaches its tap(), and what it draws, satisfies or
  moves is the answer. The rest of the time the stage answers for it, with the smallest
  acknowledgement there is -- one small mark cut in from the point pressed, a fifth of a second,
  gone (rejectTap()). That is a press received and nothing here, which is a different thing from
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
  visitor who asked for less motion gets the mark held still and taken away again rather than cut
  in, which is what the theme's crossfade does with the same query.

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
                                                    // piece started, dt since the last frame. It is
                                                    // asked for every frame the scene is on the
                                                    // screen, and draws only when something on it
                                                    // has moved: the canvas keeps the last picture,
                                                    // and a still one is not drawn again
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
  and it takes the whole piece apart -- the frame loop, the ceremony's timers, the timer under a
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
  "Motion axiom", the cut), from js/variant.js, seeded from the piece's seed so the same seed
  plays the same rite. Nothing a module draws moves along a formula or fades: a selection does
  not wash to another opacity, a wheel does not turn evenly, a solved thing does not glow in.
  Every change is a few treads that always go forward. rite.ease(t) is a landing, its first tread
  the longest way and each after it shorter, for a thing travelling to a new place;
  rite.stair(t, n) holds and then steps t onto a few even treads, for a state that changes (a
  highlight, a size, a count); rite.ratchet(t) turns in even clicks, a clock's, for anything that
  rotates; rite.flicker(t) is one cut -- 0 before the moment the roll chose, 1 after it, and never
  back -- for a thing that is simply there from its moment. And a surface that changes does so by
  its area behind the piece's one edge, its signature: rite.kind is 'slice' (a straight edge at
  rite.angle) or 'curve' (a circle grown from rite.origin), and rite.paint(g, x, y, w, h, k)
  fills the part of a box that edge has passed at coverage k -- one polygon or one arc, never a
  pattern and never cells -- while rite.region(g, x, y, w, h, k) adds the same path to g to clip
  or stroke with, and rite.matte(u, v, k) answers for one point of the box in fractions of it.
  rite.at(seed) is another roll with the same edge and treads of its own, for a module that wants
  one per thing it moves. The harnesses hand the same roll, and a module that moves anything
  along t * t, a lerp, a sine or an even rotation is the kind of module this site refuses.

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
const TURN_MS = 420; // how long the palette takes to step over, at the scheme's own tempo

let featured = null; // the palette the site is wearing for the activity on the stage, once landed
let turning = []; // the treads of the palette turn in flight, so two picks in a row never fight over the seeds
let wearing = null; // the four seeds this file last wrote inline on :root, or null when none are there
let moodTable = null; // each mood's own four seeds, off the stylesheet's rules (moodSeeds)
let inks = null; // the stage's own colours as the page loaded: --fg and --muted never change with a palette

/* Each mood's own four seeds, as _sass/_mood.scss writes them on :root[data-featured=<mood>]: taken
   off the stylesheet's own rules, once, the first time a palette is asked for. That is a walk over
   the rules and no restyle of the page, where reading a mood off :root means writing the attribute
   first and then making the browser restyle the whole document to answer -- the most expensive
   thing an open did. Only the top level is walked: a palette under a media query would not be the
   mood's own. A mood the walk did not find (a sheet the browser keeps from script, or the stub the
   stage harness runs in, which has none) answers null, and the caller reads the page instead. */
function moodSeeds(mood) {
  if (!mood) return null;
  if (!moodTable) {
    moodTable = new Map();
    try {
      for (const sheet of Array.from(document.styleSheets || [])) {
        let rules = null;
        try {
          rules = sheet.cssRules;
        } catch (e) {
          rules = null; /* a sheet from elsewhere: nothing of ours is in it */
        }
        for (const rule of Array.from(rules || [])) {
          const selector = typeof rule.selectorText === 'string' ? rule.selectorText : '';
          if (!selector.startsWith(':root[data-featured=') || !rule.style) continue;
          const named = selector.match(/^:root\[data-featured=["']?([\w-]+)["']?\]$/);
          const seeds = {};
          for (const name of SEEDS) {
            const value = rule.style.getPropertyValue('--' + name).trim();
            if (value) seeds[name] = value;
          }
          if (named && Object.keys(seeds).length === SEEDS.length) moodTable.set(named[1], seeds);
        }
      }
    } catch (e) {
      /* no table: every palette is read off the page */
    }
  }
  const seeds = moodTable.get(mood);
  return seeds ? Object.assign({}, seeds) : null;
}

/* What the site wears with no seeds of this file's inline on :root: the featured mood, else the
   visitor's reading, else the page's own world -- the order _sass/_mood.scss settles the three in
   -- off the table, or read off the page where the table has nothing. */
function underneath(root) {
  const d = root.dataset || {};
  return moodSeeds(d.featured || d.mood || d.world) || readSeeds(root);
}

/* ---- the motion engine, where it is --------------------------------------------------------- */

// window.interestingMotion (js/motion.js) rolls every stair on the site, and the stage takes its
// own stairs and its timers from the same roll, so a leaving is over before the next piece opens
// and the palette steps over along a stair rolled for that one turn. The stub browser the stage
// harness runs in has no engine, so every ask below falls back: the timers to the scheme's own
// figures, and a stair to the one written here -- three treads, a hold before each, always forward
// and never a formula, because no movement on this site runs along one (README: "Motion axiom").
const motion = window.interestingMotion || null;
const OWN_CURVE = [[0, 0], [0.28, 0], [0.28, 0.5], [0.58, 0.5], [0.58, 0.82], [0.86, 0.82], [0.86, 1], [1, 1]];

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

/* The cut (README: "Motion axiom"): every movement on the stage is one edge stepping across in a
   few forward treads, and its composition is chosen for the one trigger by the engine -- the
   family's stair with a count and spacing of treads rolled for it, and a length of its own --
   and written on the element that moves (--ease-<spell>, --motion-<spell>), which the stylesheet
   reads before its family's baked stair. A movement is over when its own animation ends
   (whenEnded, below); the length the engine hands back is only the clock behind that, for an
   animation that never plays. Each is a no-op in the stub browser, which has no engine, and for a
   visitor who asked for less motion. */

// One movement's composition written on an element (motion.cut); hands back its length in ms, or
// 0 where nothing was written.
function cutOn(node, spell, options) {
  if (!node || !node.style || calm.matches || !motion || typeof motion.cut !== 'function') return 0;
  try {
    return motion.cut(node, spell, options || {}) || 0;
  } catch (e) {
    return 0; /* the family's own stair plays */
  }
}

// An arrival for an element: where it comes from (a clear direction, --arrive-x/y), the slice it
// comes in behind (--arrive-angle, the direction it travels) and its stair, from a seed, written
// inline. Hands back the undo, which takes the inline roll off again.
function composeArrival(node, seed, spell) {
  if (!node || !node.style || calm.matches || !motion || typeof motion.arrive !== 'function') return null;
  try {
    const undo = motion.arrive(node, { seed: seed >>> 0, spell, className: false });
    return typeof undo === 'function' ? undo : null;
  } catch (e) {
    return null;
  }
}

// How long a movement written on an element is (--motion-<spell>, inline), or the roll's figure.
function inlineMs(node, spell, fallback) {
  if (node && node.style && typeof node.style.getPropertyValue === 'function') {
    const ms = parseFloat(node.style.getPropertyValue('--motion-' + spell));
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return fallback;
}

/* A movement is over when its own animation says so (README: "Motion axiom"), and not when a clock
   started before it says it must be. The class or the attribute a cut is played off comes away on
   the animationend of that one animation, on that element or on its ::before or ::after (whose
   events arrive at the element, naming the pseudo-element), so a main thread that is busy when a
   cut is asked for -- an open() restyling the page, a module drawing its first frame -- delays the
   cut's end along with its start and never takes a part away halfway across. An animation that is
   cancelled (a part moved where it is stilled) ends it too. The clock stays behind it, generous, for
   an animation that never plays: a stylesheet without it, a browser with no engine, a part never
   shown. `own` makes the whole wait the piece's, so close() stops it with the rest. Hands back a
   cancel that ends the wait without its ending. */
function whenEnded(node, name, pseudo, wait, fn, own) {
  let over = false;
  let stop = null;
  const listens = !!(node && typeof node.addEventListener === 'function' && typeof node.removeEventListener === 'function');
  const on = (ev) => {
    if (!ev || ev.target !== node || ev.animationName !== name) return;
    if (String(ev.pseudoElement || '').replace(/^:+/, '') !== (pseudo || '')) return;
    end();
  };
  function drop() {
    if (listens) {
      node.removeEventListener('animationend', on);
      node.removeEventListener('animationcancel', on);
    }
    if (stop) stop();
  }
  function end() {
    if (over) return;
    over = true;
    drop();
    fn();
  }
  const cancel = () => {
    if (over) return;
    over = true;
    drop();
  };
  if (listens) {
    node.addEventListener('animationend', on);
    node.addEventListener('animationcancel', on);
  }
  const handle = window.setTimeout(end, Math.max(0, wait));
  stop = () => {
    window.clearTimeout(handle);
    if (own) running.delete(cancel);
  };
  if (own) running.add(cancel);
  return cancel;
}

/* A part that lands and then stands unmasked: the done chip, the ask, a knob's seal, a dot lit, the
   picture developing onto the plate. The class the stylesheet plays the landing on (is-landing)
   goes on in the same frame the part is shown -- never a frame late, which would show it whole for
   that frame and then cut it away -- and comes off when its cut-in has ended (whenEnded, on the
   part itself or on its `pseudo`), so nothing stands masked after it has arrived and nothing is
   unmasked before. Its own wait and not the piece's, so a teardown in between can never leave it
   masked; a second landing takes over the first one's wait. `spell` false lands the part on treads
   it inherits (the plate's, from the inner's arrival), for as long as `length`. */
const landings = typeof WeakMap === 'function' ? new WeakMap() : null;

function land(node, spell, options) {
  if (!node || !node.classList) return;
  const opts = options || {};
  // A part that travels in (the ask) takes an arrival of its own; one that lands where it stands
  // (the done chip) takes only the treads.
  let ms = 0;
  if (spell === false) {
    ms = calm.matches || !motion ? 0 : Number(opts.length) || 0;
  } else if (opts.seed != null) {
    if (composeArrival(node, opts.seed, spell)) ms = inlineMs(node, spell, 0);
  } else {
    ms = cutOn(node, spell, { family: opts.family, duration: opts.duration, base: opts.base });
  }
  if (!ms) return; // less motion, or no engine: the part is simply there
  if (landings && landings.has(node)) landings.get(node)();
  node.classList.add('is-landing');
  const cancel = whenEnded(node, 'cut-in', opts.pseudo || '', (ms + (Number(opts.after) || 0)) * 2 + 200, () => {
    if (landings) landings.delete(node);
    node.classList.remove('is-landing');
  }, false);
  if (landings) landings.set(node, cancel);
}

/* Gone: after the way on is pressed the whole inner leaves, and it stays gone (data-gone) through
   the next module's loading, so nothing of the stage stands up again in a cut before the next
   piece is there; in whatever mode comes next the inner arrives whole behind one slice
   (_sass/_stage.scss), and the attribute comes off when that slice has landed -- off the inner's
   own animationend, with a clock behind it for a stylesheet that never played. */
let goneTurn = 0; // which leaving the stage is gone for, so a clock left from an earlier one never ends a later

function isGone() {
  return !!(stage && stage.dataset && stage.dataset.gone !== undefined);
}

function arriveWhole() {
  if (!isGone()) return;
  const turn = goneTurn;
  const ms = inlineMs(ui.inner, 'stage-in', riteMs('long', 560));
  window.setTimeout(() => {
    const mode = stage.dataset.mode;
    if (turn === goneTurn && mode !== 'vanishing' && mode !== 'loading') delete stage.dataset.gone;
  }, ms * 2 + 200);
}

/* ---- the text rites ------------------------------------------------------------------------ */

/* Words on the stage are never swapped in: they are cut in (README: "Motion axiom"). The text is
   written whole first -- the harnesses read textContent back the instant a call returns, and the
   aria-live lines are read by a screen reader as one line -- and then, where the engine is on the
   page, one slice at the register's slant steps across the line, a tread to a word or two
   (motion.reveal: one mask on the element and nothing wrapped round a letter, so textContent is
   the words throughout). Only a line of words is cut in this way and never a control, whose mask
   would take its whole face with it: a button's label is written in place. Words written while the
   stage is gone arrive with the stage and are not cut in a second time. The stub browser the stage
   harness runs in has no engine, so there the words are simply there. */
const revealing = typeof WeakMap === 'function' ? new WeakMap() : null; // node -> the undo of its cut

function reveal(node) {
  if (!node || calm.matches || isGone() || !motion || typeof motion.reveal !== 'function') return;
  try {
    const undo = motion.reveal(node);
    if (revealing && typeof undo === 'function') revealing.set(node, undo);
  } catch (e) {
    /* the words are there, which is the whole of what matters */
  }
}

// A cut still in flight on a node is ended before the node is written again: its mask comes off
// and the words stand whole, so a second line never lands half-cut behind the first one's edge.
function unreveal(node) {
  if (!node || !revealing) return;
  const undo = revealing.get(node);
  if (!undo) return;
  revealing.delete(node);
  try {
    undo();
  } catch (e) {
    /* nothing to end */
  }
}

// The words of a node, written whole (ending any cut still on it first).
function write(node, text) {
  if (!node) return;
  unreveal(node);
  node.textContent = text == null ? '' : String(text);
}

// A line written and revealed, when it changed: the heading's words, a label, a count.
function inscribe(node, text) {
  if (!node) return;
  const words = text == null ? '' : String(text);
  if (node.textContent === words) return;
  write(node, words);
  if (words) reveal(node);
}

/* The live lines (the status, the wanted line, the tries) are cut in by the stylesheet rather than
   by the engine: a piece may write its status every frame, and a cut that restarted every frame
   would never land. The line is written whole and at once; data-said flips between two values so
   the stylesheet's slice at the register's slant (line-said / line-said-b) starts again, and never
   more often than one beat (the length of the line's cut). A line rewritten under the edge lands
   under it as the new words -- and is then said again when the beat is over, so the last words
   written are always the ones cut in and no line ever simply switches to its new words. */
const saidAt = new Map();

function speak(node, text) {
  if (!node) return;
  const words = text == null ? '' : String(text);
  if (node.textContent === words) return;
  node.textContent = words;
  if (!words || calm.matches) return;
  say(node);
}

function say(node) {
  const now = performance.now();
  const last = saidAt.get(node) || { at: -1e9, parity: 'b', again: null, beat: 0 };
  const beat = last.beat || riteMs('medium', 340);
  if (now - last.at < beat) {
    // Under an edge still cutting: said again the moment the beat ends, with whatever is written
    // then.
    if (!last.again) {
      last.again = later(() => {
        last.again = null;
        if (node.textContent) say(node);
      }, Math.max(16, beat - (now - last.at) + 16));
    }
    saidAt.set(node, last);
    return;
  }
  const parity = last.parity === 'a' ? 'b' : 'a';
  // The treads and the length of this one line's cut (both spells read them), and the beat is as
  // long as the cut, so no line starts over one still being cut.
  const length = cutOn(node, 'line-said', { family: 'stair', duration: 'medium', alias: 'line-said-b' }) || riteMs('medium', 340);
  saidAt.set(node, { at: now, parity, again: null, beat: length });
  node.setAttribute('data-said', parity);
  // Whole, the line rests unmasked: the attribute comes off once the edge has crossed it (the end
  // of this parity's own cut), unless a newer line has taken it over in the meantime. Without the
  // engine there is no cut to wait for, and the clock is the length the stylesheet gives it.
  const ends = () => {
    if (node.getAttribute('data-said') === parity) node.removeAttribute('data-said');
  };
  if (motion) whenEnded(node, parity === 'a' ? 'line-said' : 'line-said-b', '', length * 2 + 200, ends, true);
  else later(ends, length + 40);
}

// The page scrolls in a rolled stair of treads, or jumps: never along the browser's own smoothing.
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

// The four seeds inline on :root. A seed already there as it is asked for is not written again:
// every write on :root restyles the whole page, so only a colour that changes costs that.
function writeSeeds(seeds) {
  for (const name of SEEDS) {
    if (!wearing || wearing[name] !== seeds[name]) document.documentElement.style.setProperty('--' + name, seeds[name]);
  }
  wearing = Object.assign({}, seeds);
}

// The seeds come off again, so the rules in _sass/_mood.scss own the palette once more.
function clearSeeds() {
  for (const name of SEEDS) document.documentElement.style.removeProperty('--' + name);
  wearing = null;
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

/* The site becomes `to` from wherever it is now, and lands exactly on it (issue #61): the palette
   steps over in a stair of two treads -- the four seeds together, the first a mix on the way from
   the colour the site was and the second the colour asked for -- and never slides one palette over
   another or dips through a third colour on the way. Two and no more, because a tread is one write
   of the four seeds on :root and every such write restyles the whole page: two is the shortest
   stair that is still a stair, and the arrival's own edge is what carries the piece into its new
   colours. A visitor who asked for less motion gets the change and not the steps.

   The turn is a movement of its own (README: "Motion axiom"), and no two are alike: when the first
   tread falls comes off a leave stair rolled for this turn (a hold, then treads coming quicker) and
   how far it goes off an arrive stair rolled for it (the first tread the longest way), at the tempo
   of the mood the site is arriving in. A timer per tread, never a frame loop, and nothing is laid
   over the piece for it: the palette only ever turns as a piece arrives or the threshold comes
   back. */
function crossfade(from, to, done) {
  for (const handle of turning) window.clearTimeout(handle);
  turning = [];
  // Nothing to turn: one world's own palette opening on its own page, most of the time.
  if (calm.matches || SEEDS.every((name) => from[name] === to[name])) {
    writeSeeds(to);
    if (done) done();
    return;
  }
  // This turn's paint is still the colour the site was: the turn starts from there (and writes
  // nothing where the site already wears it).
  writeSeeds(from);
  const length = TURN_MS * riteTempo();
  const when = riteEase('leave');
  const howFar = riteEase('arrive');
  const count = 2;
  const treads = [];
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const at = i === count ? length : Math.round(length * Math.max(0, Math.min(1, when(t * 0.92))));
    const y = i === count ? 1 : Math.max(0, Math.min(1, howFar(t)));
    const last = treads[treads.length - 1];
    // Two treads that fall at one moment are one tread, the further of the two: one write each.
    if (last && last.at >= at) last.y = Math.max(last.y, y);
    else if (!last || y > last.y) treads.push({ at, y });
  }
  for (const tread of treads) {
    turning.push(window.setTimeout(() => {
      if (tread.y < 1) {
        const at = {};
        for (const name of SEEDS) at[name] = mix(from[name], to[name], tread.y);
        writeSeeds(at);
        return;
      }
      turning = [];
      writeSeeds(to);
      if (done) done();
    }, tread.at));
  }
}

/* The site features `mood`, in `seeds` when the card that was pressed handed its own palette over,
   and otherwise in the palette `variant` derives inside that mood -- so a piece nobody pressed
   wears the colour a card of its seed would have worn, just as it wears that card's frame and its
   picture (the alignment axiom above). Either way the four seeds are the configuration's, derived
   by the one file that derives a card's (variant.recolor).

   Hands back the palette the site is landing in, which is what the piece is painted in: a piece
   never reads a colour the crossfade is only passing through.

   It asks the page for nothing it already knows. The colour the site is wearing is the one this
   file last wrote (or, with nothing written, the one the table gives the attributes on :root), and
   the mood's own four come off the stylesheet's rules (moodSeeds), so an open writes the attribute
   and the seeds and never makes the browser restyle the page to read them back. The attribute is
   written only when the mood changes: js/motion.js hears every write of it as a change of mood and
   rolls the page again under it, and another piece of the same world is no change of mood. */
function feature(mood, seeds, variant) {
  const root = document.documentElement;
  const from = wearing ? Object.assign({}, wearing) : underneath(root);
  if (mood) {
    if (root.dataset.featured !== mood) root.dataset.featured = mood;
  } else if (root.dataset.featured !== undefined) {
    delete root.dataset.featured;
  }
  let own = moodSeeds(mood); // this mood's own four, before any configuration
  if (!own) {
    clearSeeds(); // so the attribute, and not the last piece's seeds, says what the site is
    own = readSeeds(root);
  }
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
  const from = wearing ? Object.assign({}, wearing) : underneath(root);
  featured = null;
  if (root.dataset.featured !== undefined) delete root.dataset.featured;
  const d = root.dataset || {};
  let to = moodSeeds(d.mood || d.world);
  if (!to) {
    clearSeeds();
    to = readSeeds(root);
  }
  crossfade(from, to, clearSeeds);
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
// timer, the frame loop. A piece is an instantiation and nothing of it may outlive its turn, so
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

function stopRunning() {
  for (const stop of Array.from(running)) stop();
  running.clear();
}

function setMode(mode) {
  stage.dataset.mode = mode;
  // A stage that is gone arrives whole in any mode that shows it (see isGone above).
  if (mode !== 'vanishing' && mode !== 'loading') arriveWhole();
}

/* ---- opening a piece ---------------------------------------------------------------------- */

async function open(file, seed, options) {
  if (!stage) return false;
  const opts = options || {};
  const world = worldOf(file);
  if (!world) return false;
  seed = (Number(seed) >>> 0) || newSeed();
  // A piece torn down for another over a stage that stands leaves by a cut, not in one: its rail
  // and seals are ghosted over the real rail and leave behind one slice while the next is dealt
  // (see ghostRail). The ghost is taken before close() empties the rail, and its wait is
  // registered after close() has stopped everything the old piece had running, so it is the new
  // piece's to sweep. It is swept when its own slice has crossed it (whenEnded): this open() is the
  // longest task the stage runs, and a clock started inside it would sweep the ghost while most of
  // it still stood. A stage that is gone has nothing standing to ghost.
  const ghost = ghostRail();
  close(ghost);
  if (ghost) {
    const leaving = cutOn(ghost, 'knob-unmake', { family: 'leave', duration: 'medium' });
    whenEnded(ghost, 'cut-out', '', leaving ? leaving * 2 + 200 : riteMs('medium', 340) + 80, () => ghost.remove(), true);
  }
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
      // Power coming on is an arrival: the piece is dealt onto the stage like any other.
      opened.opts = Object.assign({}, opened.opts, { arriving: true });
      // First the gate -- the machine under its sheet -- is unmade where it stood (js/site.js),
      // and only then is the piece dealt in its place: one thing after another, never one edge
      // over another. Where nothing can play, the helper hands back at once.
      const gate = ui.gate;
      ui.gate = null;
      const go = () => { if (pending === opened.token) begin(opened); };
      if (gate && site && typeof site.unmake === 'function') site.unmake(gate, () => { gate.remove(); go(); });
      else { if (gate) gate.remove(); go(); }
    }
  });
  if (opened.opts.focus !== false) ui.title.focus({ preventScroll: true });
}

/* The old rail and its seals, ghosted over the real rail for one movement: every knob and dot is
   moved (not copied -- the stub browser has no cloneNode) into a .stage-ghost under no pointer,
   which the stylesheet takes away as one thing behind one slice toward where departures go, and
   the caller sweeps when the movement is over. Nothing of it is in #stage-knobs or
   #stage-progress, so the rail reads as empty the instant open() returns. A stage that is gone
   has nothing standing to ghost -- the rail left with the rest of the piece -- and a visitor who
   asked for less motion gets the change at once, as everywhere. */
function ghostRail() {
  if (!ui || !ui.knobs || !ui.knobs.parentNode || calm.matches || isGone()) return null;
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
  // A ghost is a picture of controls and not controls: nothing in it is reachable by a Tab from the
  // heading while it leaves, so the old piece's knobs are made inert and every control in them
  // taken out of the tab order (the stub browser may lack inert) -- but not disabled, which would
  // grey the picture in a cut just before its slice takes it away.
  if ('inert' in ghost) ghost.inert = true;
  if (typeof ghost.querySelectorAll === 'function') {
    for (const control of ghost.querySelectorAll('button, input, select, textarea')) control.tabIndex = -1;
  }
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
  unreveal(ui.title);
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
    // The rest (--fg, --muted) are the same under every palette, so they are the ones read as the
    // page loaded, and an open never restyles the page to ask for them again.
    colors: Object.assign({}, inks || readColors(stage), featured || {}),
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
    // How this piece moves (README: "Motion axiom", the cut): its own roll of a landing, a stair, a
    // ratchet, a one-cut flicker and one edge, from the same seed, so nothing it draws moves along
    // a formula and nothing it changes changes but by that edge.
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
    undos: [], // what takes the arrival's inline roll off the parts that outlive the piece
    ctx: null
  };

  // The piece names itself, and what it was pressed as stands under it: a piece made from this
  // card has named the card's own thing, and one that has nothing to say falls back to the card
  // rather than to the world's one line (issue #80).
  const named = piece.title || (card && card.title) || world.name;
  const renamed = ui.title.textContent !== named;
  unreveal(ui.title);
  ui.title.textContent = named;
  if (renamed) reveal(ui.title); // the rite's word is cut in by one slice (the text rites above)
  // The sigil: the working's number beside the world's name, which is the seed in this piece's own
  // address -- so the one piece of numerology on the site is also the way to send a piece to someone.
  // Hidden until written, and its figures cut in as they are written.
  if (ui.sigil) {
    ui.sigil.hidden = true;
    inscribe(ui.sigil, 'working ' + seed);
    ui.sigil.hidden = false;
  }
  inscribe(ui.brief, piece.brief || (card && (card.quote || card.text || card.mono)) || '');
  // The goal, in one line under the rules: what counts as solved. A puzzle without one is a toy,
  // so the line is only ever hidden for a piece that has not said. It is pronounced: the chip is
  // stamped on and the words are cut in, on every un-hiding.
  const goal = typeof piece.goal === 'string' ? piece.goal.trim() : '';
  if (ui.goal) ui.goal.hidden = true;
  if (ui.goalText) inscribe(ui.goalText, goal);
  if (ui.goal) ui.goal.hidden = !goal;
  ui.canvas.setAttribute('aria-label', 'the scene: ' + named);
  // Framed as the card was: the piece's own ratio, stretched by the dial that stretched the card's
  // frame in the feed, so what a visitor pressed and what they land on are the same shape. The shape
  // is the scene's, and the ratio is the body's: the scene's column is sized by it as well as the
  // scene, and a figure written on the scene alone never reaches the column, which then stood at
  // 16/9 and left a band between an upright scene and the knobs (issue #65).
  const shape = framed(piece.aspect || '16 / 9', variant);
  const ratio = aspectRatio(shape);
  ui.scene.style.setProperty('--piece-aspect', shape);
  ui.body.style.setProperty('--piece-ratio', ratio.toFixed(4));

  // The scene has a size only once the stage is in a mode that shows it.
  const arriving = !!(opts && opts.arriving && !calm.matches);
  // The arrival is one roll for this opening, written on the inner before anything is dealt: the
  // side the piece comes from (--arrive-x/y), the slice it comes in behind (--arrive-angle) and its
  // stair, seeded off the working, so the same address arrives the same way twice and no two
  // workings alike. Every part dealt below inherits it, so the piece comes in from one side as one
  // gesture rather than each part from a direction of its own.
  if (arriving) {
    const undoInner = composeArrival(ui.inner, seed ^ 0x51a6e, 'stage-in');
    if (undoInner) current.undos.push(undoInner);
  }
  // Over a stage that stands the parts are dealt (deal(), below); after the way on was pressed the
  // stage is gone, and the inner arrives whole instead, with nothing in it dealt a second time. A
  // piece that comes up from below is dealt from the bottom knob up, so the first knob down is the
  // one nearest the side it comes from; otherwise from the top, in the order the rail reads.
  const dealing = arriving && !isGone();
  current.fromBelow = dealing && parseFloat(ui.inner.style.getPropertyValue('--arrive-y')) > 0;
  renderKnobs();
  renderProgress();
  renderCheck();
  renderTries();
  // Dim for the whole piece, lit only when it is finished (issue #78). begin() is reached both
  // through open()/close(), which dims it, and straight from a gate's onReady once a sky is
  // seeded, where it was lit so the visitor could pass the seeding by -- so the piece itself has
  // to put it back to dim, or a sky-gated world would start live with the way on still lit.
  dimTheWayOn();
  setMode(arriving ? 'arriving' : 'live');
  current.ctx = makeCtx(env);
  sizeHead(); // this piece's title and line are written: the scene's room is whatever they left
  sizeScene();
  try {
    if (typeof piece.start === 'function') piece.start(current.ctx);
  } catch (e) {
    /* a piece that cannot start still has its knobs; the frame loop guards itself */
  }
  if (dealing) deal();
  if (opts && opts.arriving) {
    // The mode says the piece is arriving for as long as the arrival written on the inner is
    // (--motion-stage-in, inline) or, without the engine, the stylesheet is giving it right now
    // (--motion-long, rolled by js/motion.js). Nothing is painted off the mode: every part that
    // moves ends on its own animation, so this clock only says when the stage calls itself live.
    const travel = inlineMs(ui.inner, 'stage-in', riteMs('long', 560));
    later(() => {
      if (current && current.token === token && stage.dataset.mode === 'arriving') setMode('live');
    }, travel + 60);
  }
  if (!opts || opts.focus !== false) ui.title.focus({ preventScroll: true });
  startFrames();
  try {
    window.dispatchEvent(new CustomEvent('stage:open', { detail: { file: world.file, seed } }));
  } catch (e) {
    /* older browsers get the piece and no event */
  }
}

/* The deal (README: "Motion axiom"), onto a stage that stands. The picture develops onto the plate
   behind the arrival's slice in the arrival's own treads, which the canvas inherits from the inner;
   the knobs come onto the rail behind the same slice one after another (--knob-i, renderKnobs), each
   in treads cut for it; and the dots are stamped on in the order they read. Each part plays a class
   of its own and loses it when its own cut has ended (whenEnded), so nothing stands masked after it
   has landed -- the picture least of all, which repaints every frame anything on it moves and would
   otherwise be drawn through a mask until the slowest knob was down. Without the engine nothing was
   cut, and the parts are simply there. */
function deal() {
  const c = current;
  if (!c || !motion) return;
  const travel = inlineMs(ui.inner, 'stage-in', 0);
  if (travel) land(ui.canvas, false, { length: travel });
  const stagger = riteMs('stagger', 44);
  const wait = riteMs('short', 170);
  for (const s of c.state.values()) {
    const knob = s.knob;
    const ms = inlineMs(knob, 'knob-in', 0);
    if (!knob || !ms) continue;
    const delay = (Number(knob.style.getPropertyValue('--knob-i')) || 0) * stagger + wait;
    knob.classList.add('is-dealing');
    whenEnded(knob, 'cut-in', '', (ms + delay) * 2 + 200, () => knob.classList.remove('is-dealing'), true);
  }
  const stamp = riteMs('short', 170);
  const after = riteMs('medium', 340);
  ui.progress.querySelectorAll('.stage-dot').forEach((dot, i) => {
    dot.classList.add('is-dealing');
    whenEnded(dot, 'seal-stamp', '', (stamp + after + i * stagger) * 2 + 200, () => dot.classList.remove('is-dealing'), true);
  });
}

/* A bar's treads (README: "Motion axiom"): a fill advances in three to five rolled uneven steps
   and holds between them, never creeps. The list is the knob's own, rolled when it is dealt: the
   piece's progress() snaps to it, and a hold's bar is cut across on it (holdStair), so the step
   series is in the data the stylesheet is handed and not only in the paint. The last tread is the
   fill itself (1). */
function barTreads(rnd) {
  const n = 3 + Math.floor(rnd() * 3);
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

// The same treads as a timing function, for the hold's bar: at each moment t the fill jumps to t and
// holds, so the edge stands still between treads and is full exactly when the hold is. A browser
// that knows no linear() takes as many even steps.
function holdStair(treads) {
  const list = (treads || []).filter((t) => t > 0 && t <= 1);
  if (!list.length || list[list.length - 1] !== 1) list.push(1);
  if (motion && motion.stepped) return 'steps(' + list.length + ', jump-end)';
  const stops = ['0'];
  let was = 0;
  for (const t of list) {
    const at = (Math.round(t * 1000) / 10) + '%';
    stops.push(was + ' ' + at, (Math.round(t * 1000) / 1000) + ' ' + at);
    was = Math.round(t * 1000) / 1000;
  }
  return 'linear(' + stops.join(', ') + ')';
}

// Where on a knob the press that set it landed, as fractions of the knob: the point its seal's
// curve grows from. Read once a press, never in a loop.
function pressedOn(s, knob, ev) {
  if (!s || typeof knob.getBoundingClientRect !== 'function' || typeof ev.clientX !== 'number') return;
  const box = knob.getBoundingClientRect();
  if (!box.width || !box.height) return;
  s.pressed = {
    x: Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width)),
    y: Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height)),
    at: performance.now()
  };
}

// The knobs whose plate carries the seal: those with no control in them that stays set. A choice,
// a toggle, a pick and a grid are sealed by their own pressed control (_controls.scss), and a
// second curve on the plate round the same press, at another size and in other treads, would be
// two edges for one change -- so their plate only steps to its set colour.
const PLATE_SEALED = ['range', 'number', 'word', 'order', 'press', 'hold', 'tap', 'wait'];

// A knob set, and sealed (README: "Motion axiom"): the seal's point is written on the knob once,
// as it becomes set -- where the press that set it landed if one did a moment ago, and its middle
// for a key, for the piece setting it, or for a finish setting the rest -- so the two shades its
// plate rests in are split round a point with a reason, the curve lands from there (is-landing,
// on the plate's ::before), and its dot lights round the same point (renderProgress).
function seal(s) {
  if (!s || !s.knob || !s.knob.style) return;
  const p = s.pressed && performance.now() - s.pressed.at < 1500 ? s.pressed : { x: 0.5, y: 0.5 };
  s.seal = [Math.round(p.x * 100) + '%', Math.round(p.y * 100) + '%'];
  s.knob.style.setProperty('--seal-x', s.seal[0]);
  s.knob.style.setProperty('--seal-y', s.seal[1]);
  s.knob.classList.add('is-set');
  if (s.knob.dataset.seal === 'plate') land(s.knob, 'knob-seal', { family: 'arrive', duration: 'long', pseudo: 'before' });
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
   and not a rect: it is the heading's laid-out height, which the translate an arriving or leaving
   inner moves by never changes. */
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
  // A resize is the same picture at a new size, not a new one: the canvas is sized again and the
  // piece draws on it at once, with nothing played over it.
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
  // The knobs are dealt (README: "Motion axiom", deal()): each comes onto the rail behind the
  // arrival's slice one tread after the last, starting from the end of the rail nearest the side the
  // piece comes from -- the bottom knob first for a piece that comes up from below, the top one
  // otherwise -- and each in treads cut for it alone, seeded off the working and its place, so the
  // same address deals the same way twice. --knob-i is the turn the stylesheet waits; the DOM order
  // stays the piece's. The side they all come from is the piece's (the inner's --arrive-*).
  const count = current.steps.length;
  current.steps.forEach((step, i) => {
    const knob = el('div', 'knob');
    const state = current.state.get(step.id);
    knob.dataset.id = step.id;
    knob.dataset.kind = step.kind;
    if (step.optional === true) knob.dataset.optional = 'true'; // a helper the check does not wait for
    // The stage seals a knob itself, round the point it was set at (seal), so the engine's own
    // seal of whatever becomes set (js/motion.js) passes it by.
    knob.setAttribute('data-rite', 'none');
    knob.addEventListener('pointerdown', (ev) => pressedOn(state, knob, ev), true);
    knob.style.setProperty('--knob-i', String(current.fromBelow ? count - 1 - i : i));
    // Sealed on the plate only where nothing in it seals itself (seal()).
    if (PLATE_SEALED.indexOf(step.kind) !== -1) knob.dataset.seal = 'plate';
    const at = ((current.seed ^ ((i + 1) * 0x9e3779b9)) >>> 0) || 1;
    cutOn(knob, 'knob-in', { family: 'arrive', duration: 'medium', seed: at });
    state.treads = barTreads(mulberry32(at));
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
      // Sealed round where it was set, the curve growing from that point (_stage.scss); a knob
      // the piece set was pressed nowhere, so it is sealed round its middle.
      if (by === 'piece') s.pressed = null;
      seal(s);
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
  // The lamp is lit by the stylesheet off `disabled`, which is the whole of its state: its colour
  // steps to the primary along the stair. The word on it is a control's face, written in place
  // when it changes and not cut in (the text rites above).
  const label = c.completed ? 'check again' : (typeof c.piece.checkLabel === 'string' && c.piece.checkLabel.trim() ? c.piece.checkLabel.trim() : 'check');
  if (ui.check.textContent !== label) write(ui.check, label);
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
  // Written whole, and cut in by the stylesheet (line-said).
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
  // The try is written beside the verdict so the refusal plays again: the stylesheet starts the
  // row's one knock aside again off data-try-parity flipping (stage-no / stage-no-b, which go
  // opposite ways), keyed by the count.
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
    // A gate opening cuts the ward away (README: "Motion axiom"): data-unwarding has the slice at
    // the register's angle take the veil off in treads cut for this one opening, and comes off
    // when the ward's own cut has ended (whenEnded, on the knob's ::after).
    if (was && !locked && !calm.matches) {
      const knob = s.knob;
      const ms = cutOn(knob, 'unward', { family: 'leave', duration: 'medium' });
      knob.setAttribute('data-unwarding', '');
      const off = () => knob.removeAttribute('data-unwarding');
      whenEnded(knob, 'cut-out', 'after', ms ? ms * 2 + 200 : riteMs('medium', 340) + 80, off, true);
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
  // piece and lit in place, so a seal that lights is cut in by a curve (seal-light) rather than
  // being replaced already lit. A dot lights round the same point its knob was sealed round
  // (seal), as its knob is set; where more than one lights at once (a finish setting what was left)
  // they light one tread after another in the order they read (--light-i). The stage lights them
  // itself, so the engine's own seal of whatever becomes set passes them by.
  let dots = ui.progress.querySelectorAll('.stage-dot');
  if (dots.length !== wanted.length) {
    ui.progress.textContent = '';
    wanted.forEach((s, i) => {
      const dot = el('span', 'stage-dot');
      dot.setAttribute('data-i', String(i));
      dot.setAttribute('data-rite', 'none');
      dot.style.setProperty('--dot-i', String(i)); // its turn in the deal, in the order it reads
      ui.progress.appendChild(dot);
    });
    ui.progress.appendChild(hidden(''));
    dots = ui.progress.querySelectorAll('.stage-dot');
  }
  const lighting = [];
  wanted.forEach((s, i) => {
    const dot = dots[i];
    if (!dot) return;
    if (s.set && !dot.classList.contains('is-set')) lighting.push([dot, s]);
    else if (!s.set) dot.classList.remove('is-set');
  });
  const turn = riteMs('stagger', 44) * 1.5; // one tread of the cascade, as the stylesheet waits it
  lighting.forEach(([dot, s], k) => {
    dot.style.setProperty('--light-i', String(k));
    if (s.seal) {
      dot.style.setProperty('--seal-x', s.seal[0]);
      dot.style.setProperty('--seal-y', s.seal[1]);
    }
    dot.classList.add('is-set');
    land(dot, 'seal-light', { family: 'arrive', duration: 'medium', after: k * turn, pseudo: 'before' });
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
      // The field drops onto its new figure in treads (count-drop) when the stage wrote it: a
      // typed value is the visitor's own and is left still.
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
        // them from there to here in landing treads, one way only. The DOM order is rebuilt at
        // once and is the truth. Every place is read before anything is written, so the move costs
        // one layout and not one a row.
        if (before) {
          const after = tops();
          Array.from(list.children || []).forEach((row, k) => {
            const was = before.get(values[k]);
            const is = after.get(values[k]);
            if (was === undefined || is === undefined || Math.abs(was - is) < 0.5) return;
            row.style.setProperty('--dy', (was - is).toFixed(1) + 'px');
            row.setAttribute('data-flip', '');
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
    // A cell that changed its state was stamped by the press that changed it, as every control is
    // (js/motion.js), and its colour steps along the stair; its neighbours stay still.
    function paint() {
      buttons.forEach((b, i) => {
        b.dataset.state = String(cells[i]);
        b.setAttribute('aria-label', name(i));
        if (states === 2) b.setAttribute('aria-pressed', cells[i] ? 'true' : 'false');
        b.textContent = states > 2 && cells[i] ? String(cells[i]) : '';
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
    // Each press fills a notch (README: "Motion axiom"): a row of small diamonds under the button,
    // one filled and stamped on per press (seal-stamp), so the count is visible as well as said;
    // the last notch is the knob's own seal. The label counts down in place: it is a control's
    // face, written and not cut in.
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
      write(b, word(count - n));
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
    const state = current.state.get(step.id);
    // The bar is cut across in the knob's own treads for exactly as long as the hold takes: the
    // stylesheet plays it off is-held (_sass/_stage.scss), so nothing here runs while it fills.
    knob.style.setProperty('--motion-hold-fill', ms + 'ms');
    knob.style.setProperty('--ease-hold-fill', holdStair(state.treads));
    let started = 0;
    let timers = [];
    let fired = false; // this press has already filled the bar and set the knob
    const halt = () => {
      for (const stop of timers) stop();
      timers = [];
    };
    const show = (pct) => knob.style.setProperty('--knob-pct', pct);
    function down() {
      if (started || b.disabled) return;
      started = performance.now();
      fired = false;
      b.classList.add('is-held');
      b.setAttribute('aria-pressed', 'true');
      // The knob the moment the bar is full: the holding is the answer and the letting go is not
      // part of it, so a visitor who watches it fill and keeps holding has already set the knob and
      // the piece carries on under their finger (issue #74). One timer, registered, so a hold still
      // down when the piece goes -- a finger that never lifts, a knob disabled under it -- leaves
      // nothing running against a knob that is no longer anywhere.
      timers.push(later(() => fill(performance.now() - started), ms));
      // Less motion asked for: no animation steps the bar, so each tread is written here at the
      // moment the stair would have taken it, and how long is left can still be read off it.
      if (calm.matches) {
        show('0%');
        for (const t of state.treads || []) {
          if (t < 1) timers.push(later(() => show((t * 100).toFixed(1) + '%'), t * ms));
        }
      }
    }
    function fill(held) {
      fired = true;
      halt(); // the bar stays full under the finger
      show('100%');
      apply(step.id, held);
      markSet(step.id, held, 'knob');
    }
    // Where the bar's edge has got to while it is held: the animation's, read off the bar once.
    function reached() {
      const bar = knob.querySelector('.knob-bar');
      if (!bar || calm.matches) return '';
      try {
        return String(getComputedStyle(bar, '::before').getPropertyValue('--cut') || '').trim();
      } catch (e) {
        return '';
      }
    }
    // Letting go. After the bar filled this is nothing at all -- the knob is set, and setting it
    // twice over or saying it was let go early would both be lies. Before it, it is a hold that
    // did not last, and the bar steps back to empty from wherever its edge had reached, along the
    // stair (the bar's own --cut transition). While held, that edge is the animation's and not the
    // knob's, so the point it reached is written as the knob's own before the animation comes off
    // -- or the edge would drop to empty in one frame -- and the empty is written two frames later,
    // once that point has been drawn as the place the step back starts from.
    function up() {
      if (!started) return;
      started = 0;
      halt();
      const at = fired ? '' : reached();
      if (at) show(at);
      b.classList.remove('is-held');
      b.setAttribute('aria-pressed', 'false');
      if (fired) return;
      if (at && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!started && !fired) show('0%');
        }));
      } else {
        show('0%');
      }
      // The refusal: the button knocked aside once (stage-no, off is-refusing), and the line cut in.
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

/* The piece's own frames, and nothing more: the loop asks for a frame only while there is a piece
   that draws in frame() and a scene on the screen to draw it on. A piece that draws only in start()
   costs no frame at all, and one whose scene has been scrolled out of sight (the feed read under
   it) stops until the scene comes back, when it picks up where its clock now is -- nothing is
   computed that does not show. */
let sceneSeen = true;

function startFrames() {
  if (!frameHandle && sceneSeen) frameHandle = requestAnimationFrame(frame);
}

function frame(now) {
  frameHandle = 0;
  const c = current;
  if (!c || !c.ctx || !c.ctx.g || typeof c.piece.frame !== 'function' || !sceneSeen) {
    lastFrame = 0;
    return;
  }
  const dt = lastFrame ? Math.max(0, Math.min(0.05, (now - lastFrame) / 1000)) : 0.016;
  lastFrame = now;
  if (!document.hidden) {
    try {
      c.piece.frame((now - c.startedAt) / 1000, dt, c.ctx);
    } catch (e) {
      /* a frame that throws is skipped; the next may not */
    }
  }
  frameHandle = requestAnimationFrame(frame);
}

/* ---- every press on the scene is answered -------------------------------------------------- */

/* The tiny rejection of the responsiveness axiom above (issue #89): one mark at the point pressed,
   laid in the scene over the canvas, cut in by a curve from that point and taken away again a
   fifth of a second later. The press is visibly received and nothing else about the piece is
   touched -- no knob, no progress, no status line, no sound, and nothing the piece can see.

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
  // The press received (README: "Motion axiom"): a ring cut in by a curve growing from its own
  // centre, which is the point pressed, in two treads cut for this press (stage-reject), and
  // never rippled or faded. Pure paint: no text, no fade.
  const length = cutOn(mark, 'stage-reject', { family: 'flicker', base: REJECT_MS });
  ui.scene.appendChild(mark);
  // Registered like every other wait of the stage's, so a mark pressed out of a piece on its way
  // out goes with it rather than outliving it; close() sweeps whatever is still there. It is taken
  // away a moment after its own cut has ended (whenEnded), so a press answered while the page is
  // busy is still answered whole; held still, or without the engine, it stays the scheme's fifth
  // of a second.
  const away = () => mark.remove();
  if (length) whenEnded(mark, 'cut-in', '', length * 2 + 200, () => later(away, 40), true);
  else later(away, REJECT_MS + 40);
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
      if (s.knob) {
        s.pressed = null; // set by the finish and pressed nowhere: sealed round its middle
        seal(s);
      }
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
  // The ceremony's one edge (README: "Motion axiom"): the done chip lands as a curve growing out of
  // its end of the dots' row, in treads cut for this solve (is-landing, done-land), and its word
  // arrives with it rather than being cut in a second time. That and the chime are the whole of it:
  // the dots already say every knob is set and the way on lights after it, so nothing is laid over
  // the stage to say it again.
  write(ui.doneText, 'solved');
  ui.done.hidden = false;
  land(ui.done, 'done-land', { family: 'arrive', duration: 'long' });
  // The finale is on the scene, which on a phone may be above the knob that finished it. The done
  // mark is not: it reports from the end of the dots' row in the rail, clear of the picture.
  const box = ui.scene.getBoundingClientRect();
  if (box.top < 0 || box.bottom > window.innerHeight) scrollSceneIntoView(ui.scene);
  chime();
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

// Dim again: the lamp steps back to the unlit plate along the stair, as it stepped up (the colour
// transition every control carries), off the same one flag.
function dimTheWayOn() {
  if (!ui.onward) return;
  ui.onward.disabled = true;
}

// The way on, pressed: the piece leaves and the next card opens in its place -- exactly what the
// timer in finish() used to do on the visitor's behalf. A piece nobody finished is replaced in
// the history rather than kept, so the back button walks back through what was finished and not
// what was passed over.
function goOn() {
  if (!ui.onward || ui.onward.disabled) return;
  dimTheWayOn(); // one press is one piece: a second one cannot overtake the first
  const finished = !!(current && current.completed);
  const piece = current; // null where there was nothing to finish: a missing module, or a gate
  // The leaving is cut for this one press: the whole inner goes behind one slice toward where the
  // roll sends departures, at a length of its own, and the stage stays gone until the next piece
  // arrives whole (isGone above). Less motion asked for: the next piece is simply there.
  const leaving = cutOn(ui.inner, 'stage-unmake', { family: 'leave', base: riteMs('long', 560) });
  if (!calm.matches) {
    goneTurn += 1;
    stage.dataset.gone = '';
  }
  setMode('vanishing');
  // The next piece opens once the last has gone and not a frame before: when the inner's own slice
  // has crossed it (whenEnded), however late a busy page started it -- or, with nothing cut (less
  // motion, no engine), after the stylesheet's own length (--motion-long, js/motion.js).
  const onward = () => {
    if (current !== piece) return; // something else took the stage while this one was leaving
    next(finished ? {} : { replace: true });
  };
  if (calm.matches) later(onward, 120);
  else if (leaving) whenEnded(ui.inner, 'cut-out', '', leaving * 2 + 200, onward, true);
  else later(onward, riteMs('long', 520) + 40);
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
// ceremony, no timer under a knob still held, no frame loop, no knob, no line, no dot, no mark,
// and no scene. Everything open() goes on to write is cleared here too, so a close() that opens
// nothing after it -- the threshold going back, the question coming up -- is just as clean.
function close(keep) {
  pending = null;
  stopRunning();
  // A ghost of an earlier rail still leaving goes with the piece, unless it is the one open() has
  // just made of this piece's own rail (keep), whose leaving is the next piece's to sweep.
  if (ui.knobs && ui.knobs.parentNode && typeof ui.knobs.parentNode.querySelectorAll === 'function') {
    for (const ghost of ui.knobs.parentNode.querySelectorAll('.stage-ghost')) if (ghost !== keep) ghost.remove();
  }
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  lastFrame = 0;
  // The arrival's inline roll comes off the inner, which stays, so the next piece rolls its own;
  // the lines said are forgotten with the piece.
  if (current && current.undos) {
    for (const undo of current.undos) {
      try {
        undo();
      } catch (e) {
        /* nothing to take off */
      }
    }
  }
  saidAt.clear();
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
  ui.canvas.classList.remove('is-landing');
  ui.scene.style.removeProperty('--piece-aspect');
  ui.body.style.removeProperty('--piece-ratio');
  delete stage.dataset.try;
  delete stage.dataset.tryParity;
  // The words still being cut in have their cut ended before they are taken away (write).
  if (ui.sigil) {
    write(ui.sigil, '');
    ui.sigil.hidden = true;
  }
  write(ui.brief, '');
  if (ui.goalText) write(ui.goalText, '');
  if (ui.goal) ui.goal.hidden = true;
  unreveal(ui.world);
  ui.knobs.textContent = '';
  if (ui.check) {
    ui.check.disabled = true;
    write(ui.check, 'check');
  }
  if (ui.tries) {
    ui.tries.textContent = '';
    ui.tries.hidden = true;
  }
  delete stage.dataset.verdict;
  for (const line of [ui.status, ui.wanted, ui.tries]) if (line) line.removeAttribute('data-said');
  ui.status.textContent = '';
  ui.progress.textContent = '';
  if (ui.wanted) {
    ui.wanted.textContent = '';
    ui.wanted.hidden = true;
  }
  write(ui.doneText, 'done');
  ui.done.hidden = true;
  ui.done.classList.remove('is-landing');
  dimTheWayOn();
}

// The threshold's own state, back from a piece: what the page said before anything opened.
function goHome() {
  close();
  inscribe(ui.world, home.name);
  const returning = ui.title.textContent !== home.line;
  unreveal(ui.title);
  ui.title.textContent = home.line;
  if (returning) reveal(ui.title); // the invitation is cut in again by one slice
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
   the whole at the mood's tempo, the last note now and then doubled an octave up.
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
      if (i === grace) note(ac, wave, freq * Math.pow(2, -2 / 12), now + at, 0.06, 0.02); // the grace note
      note(ac, wave, freq, now + at, 0.42 + own() * 0.2, 0.045);
      if (i === count - 1 && own() < 0.35) note(ac, wave, freq * 2, now + at + 0.05, 0.16, 0.02); // the octave over it
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

  // The ask -- the question, or the quiet invitation -- arrives behind a slice of its own on every
  // change of mode that shows it (is-landing, _sass/_stage.scss); a stage that is gone brings it
  // with the rest. The answer cards inside it are js/threshold.js's to deal, each behind its own
  // slice, and nothing here deals them a second time.
  const askBox = document.getElementById('stage-ask');
  const askArrives = () => {
    if (!isGone()) land(askBox, 'ask-in', { seed: newSeed() });
  };

  function render() {
    const asking = !!(probe && !probe.hidden);
    if (asking) {
      // Through goHome(), not a bare close(): the piece that was on takes its name, its line and
      // its featured palette with it, so the question is asked on the threshold's own ground.
      if (current || pending) goHome();
      if (stage.dataset.mode !== 'asking') askArrives();
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
    if (!current && !pending) {
      if (stage.dataset.mode !== 'quiet') askArrives();
      setMode('quiet');
    }
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

  // The stage's own colours, read once while nothing has been written over them (makeEnv).
  inks = readColors(stage);
  if (ui.onward) ui.onward.addEventListener('click', goOn);
  if (ui.check) ui.check.addEventListener('click', judge);
  window.addEventListener('resize', reflow);
  // The heading changes shape without the window doing anything -- a longer title, a font that
  // arrives late, a mode that puts the ask up instead -- and the scene is sized against it.
  if (window.ResizeObserver && ui.head) new window.ResizeObserver(reflow).observe(ui.head);
  sizeHead();
  // The piece draws only while its scene is on the screen (startFrames): a scene scrolled out of
  // sight stops asking for frames, and asks again the moment it is back.
  if (window.IntersectionObserver && ui.scene) {
    new window.IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      sceneSeen = !last || last.isIntersecting;
      if (sceneSeen) startFrames();
    }).observe(ui.scene);
  }
  // A stage that was gone has arrived once its inner's slice has landed (isGone above).
  if (ui.inner && typeof ui.inner.addEventListener === 'function') {
    ui.inner.addEventListener('animationend', (ev) => {
      if (ev.target !== ui.inner || ev.animationName !== 'cut-in' || !isGone()) return;
      const mode = stage.dataset.mode;
      if (mode !== 'vanishing' && mode !== 'loading') delete stage.dataset.gone;
    });
  }
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
      // The re-deal is a shuffle (README: "Motion axiom"): the rail that was leaves behind its
      // slice and the same working is dealt again onto the stage that stands.
      open(current.world.file, current.seed,
        { push: false, focus: false, variant: current.variant, card: current.card, arriving: true });
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
          { push: false, focus: false, variant: current.variant, card: current.card, arriving: true });
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
