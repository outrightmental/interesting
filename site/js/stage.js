/*
  The stage: where a piece is played, finished, and replaced by the next.

  One line in the <head> of a page carries it, written once in _includes/layout.njk:

      <script src='js/stage.js' type='module'></script>

  A page's feature is not a fixed page any more. It is a piece: a small, procedurally generated,
  randomly configured item with a few knobs and a clear end -- a fidget toy with levers on it --
  made on the spot by a world's module from a seed. The visitor sets the knobs, the piece is
  finished, it plays its ceremony -- and then it waits. The stage never moves on by itself
  (issue #78): the ceremony ends by lighting the way on, one mark pinned in the lower right of
  the screen for every piece, and the press of that is what vanishes the piece and opens the next
  card in the feed's stack in its place. So one piece follows another without end, and it is the
  visitor who says when. _includes/stage.njk writes the stage; this file runs it; js/feed.js
  hands it the next card.

  ---------------------------------------------------------------------------------------------
  The piece contract -- what a world's module (js/modules/<world>.js) exports as piece(env)

      piece(env) {
        return {
          title: 'three breaths at your pace',     // the piece's name, in the site's voice
          brief: 'Set the pace and follow three breaths; the room goes dark when you are done.',
          aspect: '16 / 9',                         // the scene's shape (optional)
          auto: true,                               // finished when every knob is set (default);
                                                    // false: the piece calls ctx.complete() itself
          steps: [                                  // the knobs, 2 to 5 of them, in order
            { id: 'pace', ask: 'the pace', kind: 'choice',
              options: [{ label: 'slow', value: 12 }, { label: 'slower', value: 16 }] },
            { id: 'breathe', ask: 'follow three breaths', kind: 'wait', after: 'pace' }
          ],
          start(ctx) {},                            // the scene is ready to draw on (called again
                                                    // after a resize if the piece has no frame)
          frame(t, dt, ctx) {},                     // one frame (optional); t is seconds since the
                                                    // piece started, dt since the last frame
          apply(id, value, ctx) {},                 // a knob was set (the stage sets it)
          tap(x, y, ctx) {},                        // the scene was tapped, x and y in 0..1
                                                    // (optional; a 'tap' knob needs it)
          end(ctx) {}                               // the last frame before the vanish (optional)
        };
      }

  Knob kinds, and who satisfies them:
    choice   2-4 options; the stage calls apply(id, option.value) and marks the knob set
    toggle   one button, on or off (off unless `value` is true); apply(id, boolean)
    range    a slider: min, max, step, value, low, high (the words at the ends); apply(id, number)
             on every move, set the first time the visitor lets go of it -- moved or not, because
             a slider already has an answer on it and leaving it where it is is giving that answer;
             ctx.value(id) is where it starts from the first frame on
    press    one big button pressed `count` times (label); apply(id, n) each press, set at count
    hold     one big button held for `ms` (label); apply(id, heldMs) the moment the bar fills,
             with no wait for the release: the holding is the answer, so letting go after that
             changes nothing and letting go before it is a hold that did not count
    tap      the scene itself, tapped: the piece's tap() decides, and calls ctx.satisfy(id)
             when the knob is set (ctx.progress(id, 0..1) shows how close). A tap anywhere must
             count, since the stage adds a button for anyone who cannot tap the scene, which
             calls tap() at a random point, and the law taps at random points too.
    wait     a timed phase the piece runs in frame(): it calls ctx.progress(id, 0..1) and
             ctx.satisfy(id) when done
  Only a tap or a wait knob is the piece's to set, and never before the visitor has set
  something themselves: a piece is finished by the person playing it. A knob with
  `after: '<id>'` is disabled until that knob is set. Every knob stays live after it is set -- a
  toy is for fidgeting with -- and the piece is finished when all are set (or, with auto: false,
  when it calls ctx.complete()).

  Every knob has to be settable by the visitor it is put in front of, and the stage has to say
  which ones are not set yet. A knob nobody can satisfy is a piece nobody can finish, and the way
  that goes wrong is quiet: the visitor sets the last knob on the page, the scene answers, and
  nothing happens, because the piece is waiting on one further up that never looked unfinished.
  The line under the live line names what is left, for exactly that (issue #60).

  A piece is one instantiation and nothing of it outlives its turn. close() is the one teardown
  and it takes the whole piece apart -- the frame loop, the ceremony's timers, a ticker under a
  hold still pressed down, the knobs, the lines, the dots, the mark, the scene and its shape -- so
  every piece opens on an empty stage however many times its world has come round before.

  ctx, the same object for the whole piece:
    canvas, g (its 2d context), w, h (CSS pixels; the context is already scaled for the screen),
    colors { bg, bg2, accent, accent2, fg, muted } in the world's palette, rnd() (seeded: the
    same seed makes the same piece), pick(list), int(a, b), chance(p), stars, points(w, h, pad),
    mix(a, b, t), alpha(c, a), reduced (less motion asked for), satisfy(id, value), progress(id,
    fraction), status(text) (one live line under the knobs), value(id), done, elapsed (seconds),
    complete().

  The law: every world's piece must finish. .github/scripts/piece_harness.mjs drives each
  module's piece through its knobs with a stub canvas, in a worker with no document, no clock
  and no Math.random, and refuses one that does not complete expediently (two to five knobs,
  under forty-five seconds of simulated time), that sets its own knobs before the visitor has
  touched it, that is not the same piece for the same seed, or that is the same piece for every
  seed. The AI run's check_completion holds every plan to it, and RealSiteTest holds the site as
  committed. A piece is pure drawing and arithmetic on ctx: it never reaches for the document,
  the window, the clock or the browser's storage, and a module is self-contained (it imports
  nothing), which is also what lets the harness run it.

  ---------------------------------------------------------------------------------------------
  What a page can call

      window.interestingStage           (only on a page that has the stage)
        .open(file, seed, options)   open the named world's piece for `seed` on this stage;
                                     options.push=false keeps the URL, options.scroll=true
                                     brings the stage into view, options.seeds={bg,bg2,accent,
                                     accent2} is the palette the site takes on for the piece --
                                     the pressed card's own, so the site matches the card
                                     (js/feed.js hands it over; see feature() below)
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

  Nothing here reaches for the browser's storage. The sky is read through the persona, the next
  card through the feed, and nothing is written but the address.
*/

const root = document.documentElement.getAttribute('data-root') || '';
const stage = document.getElementById('stage');
const persona = window.interestingPersona;
const site = window.interestingSite;
const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

const MAX_STEPS = 5;
const KINDS = ['choice', 'toggle', 'range', 'press', 'hold', 'tap', 'wait'];
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

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toRgb(value) {
  const v = String(value || '').trim();
  if (v[0] === '#') {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [160, 170, 200];
}

function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}

function alpha(c, a) {
  const [r, g, b] = toRgb(c);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
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
const GRAY = '#808080'; // the neutral the theme dips through, so one colour clears before the next
const DIP_MS = 140; // the quick fade out to that neutral
const RISE_MS = 420; // the fade from it into the colour of the card just pressed

let featured = null; // the palette the site is wearing for the activity on the stage, once landed
let fading = 0; // the crossfade in flight, so two picks in a row never fight over the seeds

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

/* The site becomes `to` from wherever it is now, by way of a neutral grey, and lands exactly on
   it (issue #61) -- a quick fade out to the neutral so the colour it was leaves cleanly, then a
   fuller fade from the neutral into the colour that was asked for, so the theme shifts through a
   settled middle rather than smearing one palette straight over another. A visitor who asked for
   less motion gets the change and not the shift. */
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
  const startedAt = performance.now();
  const step = (now) => {
    const elapsed = now - startedAt;
    const at = {};
    if (elapsed < DIP_MS) {
      // Fading out to the neutral grey.
      const t = Math.max(0, elapsed / DIP_MS);
      for (const name of SEEDS) at[name] = mix(from[name], GRAY, t);
    } else {
      // Rising from the neutral grey into the new theme, landing exactly on it.
      const t = Math.min(1, (elapsed - DIP_MS) / RISE_MS);
      for (const name of SEEDS) at[name] = t < 1 ? mix(GRAY, to[name], t) : to[name];
    }
    writeSeeds(at);
    if (elapsed < DIP_MS + RISE_MS) {
      fading = requestAnimationFrame(step);
      return;
    }
    fading = 0;
    if (done) done();
  };
  fading = requestAnimationFrame(step);
}

/* The site features `mood`, in `seeds` when the card that was pressed handed its own palette over.
   Hands back the palette the site is landing in, which is what the piece is painted in: a piece
   never reads a colour the crossfade is only passing through. */
function feature(mood, seeds) {
  const root = document.documentElement;
  const from = readSeeds(root);
  clearSeeds(); // so the attribute below, and not the last piece's seeds, says what the site is
  if (mood) root.dataset.featured = mood;
  else delete root.dataset.featured;
  const to = Object.assign(readSeeds(root), someSeeds(seeds));
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

function aspectRatio(aspect) {
  const m = String(aspect || '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) return 16 / 9;
  const r = Number(m[1]) / Number(m[2]);
  return r > 0 && isFinite(r) ? r : 16 / 9;
}

/* ---- the stage's parts --------------------------------------------------------------------- */

const ui = stage ? {
  inner: document.getElementById('stage-inner'),
  head: document.getElementById('stage-head'),
  world: document.getElementById('stage-world'),
  read: document.getElementById('stage-read'),
  title: document.getElementById('stage-title'),
  brief: document.getElementById('stage-brief'),
  body: document.getElementById('stage-body'),
  scene: document.getElementById('stage-scene'),
  canvas: document.getElementById('stage-canvas'),
  knobs: document.getElementById('stage-knobs'),
  status: document.getElementById('stage-status'),
  wanted: document.getElementById('stage-wanted'),
  progress: document.getElementById('stage-progress'),
  done: document.getElementById('stage-done'),
  doneText: document.getElementById('stage-done-text'),
  onward: document.getElementById('stage-next'),
  again: document.getElementById('stage-again'),
  burst: document.getElementById('stage-burst'),
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
  close();
  const token = {};
  pending = token;

  // A card pressed while the threshold is asking answers the question another way: by leaving.
  const probe = document.getElementById('persona-probe');
  if (probe && !probe.hidden) probe.hidden = true;

  // The site features this activity: its world's palette, as the card that was pressed wore it.
  feature(world.mood, opts.seeds);
  if (ui.world) ui.world.textContent = world.name;
  document.title = world.name + ' · interesting';
  if (opts.push !== false) {
    try {
      history[opts.replace ? 'replaceState' : 'pushState']({ world: file, seed }, '', root + file + '#' + seed);
    } catch (e) {
      /* a file: URL, or a browser that will not: the piece still opens */
    }
  }
  if (opts.scroll) window.scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });
  setMode('loading');
  // close() above left the stage empty: the world's own line is all there is to write until the
  // module lands and begin() draws the piece.
  ui.title.textContent = world.what || world.name;
  if (ui.read && !opts.keepRead) ui.read.hidden = true;

  const mod = await loadModule(world.id);
  if (pending !== token) return false;
  if (!mod || typeof mod.piece !== 'function') {
    // A world without a piece (the law forbids it, but a stage never breaks): the world's own
    // line, and the way on.
    empty(opts);
    return false;
  }
  const stars = persona ? persona.stars() : [];
  if (mod.needsSky && !stars.length && site && typeof site.unlock === 'function') {
    gate(world, mod, seed, token, opts);
    return true;
  }
  begin(world, mod, seed, token, opts);
  return true;
}

// Powered down, never broken: the piece needs a sky, and the one button that seeds it is the
// whole of what the stage says about that. The helper powers down a throwaway element of this
// open's own, so a later piece is never dimmed by a sky cleared after this one is gone.
function gate(world, mod, seed, token, opts) {
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
      if (pending !== token || begun) return;
      begun = true;
      begin(world, mod, seed, token, opts);
    }
  });
  if (opts.focus !== false) ui.title.focus({ preventScroll: true });
}

function empty(opts) {
  ui.brief.textContent = 'Nothing to finish here yet.';
  lightTheWayOn(false); // nothing to finish, so the way on is the whole of what this offers
  setMode('empty');
  if (!opts || opts.focus !== false) ui.title.focus({ preventScroll: true });
}

function makeEnv(seed, world, stars) {
  const rnd = mulberry32(seed);
  return {
    seed,
    rnd,
    pick: (list) => list[Math.floor(rnd() * list.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    stars,
    // The stage's own colours, with the featured palette's four seeds over them: the piece is
    // painted in the colour the site is landing in, never in one the crossfade is passing through.
    colors: Object.assign(readColors(stage), featured || {}),
    mix,
    alpha,
    reduced: calm.matches,
    world: { file: world.file, name: world.name, orientation: world.orientation }
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

function begin(world, mod, seed, token, opts) {
  const stars = persona ? persona.stars() : [];
  const env = makeEnv(seed, world, stars);
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
    world, mod, seed, piece, token, env,
    steps,
    state: new Map(steps.map((s) => [s.id, { step: s, set: false, value: undefined, knob: null }])),
    completed: false,
    touched: false,
    startedAt: performance.now(),
    ctx: null
  };

  ui.title.textContent = piece.title || world.name;
  ui.brief.textContent = piece.brief || '';
  ui.canvas.setAttribute('aria-label', 'the scene: ' + (piece.title || world.name));
  const ratio = aspectRatio(piece.aspect);
  ui.scene.style.setProperty('--piece-aspect', piece.aspect || '16 / 9');
  ui.scene.style.setProperty('--piece-ratio', ratio.toFixed(4));
  renderKnobs();
  renderProgress();

  // The scene has a size only once the stage is in a mode that shows it.
  setMode(opts && opts.arriving && !calm.matches ? 'arriving' : 'live');
  current.ctx = makeCtx(env);
  sizeHead(); // this piece's title and line are written: the scene's room is whatever they left
  sizeScene();
  try {
    if (typeof piece.start === 'function') piece.start(current.ctx);
  } catch (e) {
    /* a piece that cannot start still has its knobs; the frame loop guards itself */
  }
  if (opts && opts.arriving) {
    later(() => {
      if (current && current.token === token && stage.dataset.mode === 'arriving') setMode('live');
    }, 600);
  }
  if (!opts || opts.focus !== false) ui.title.focus({ preventScroll: true });
  startFrames();
  try {
    window.dispatchEvent(new CustomEvent('stage:open', { detail: { file: world.file, seed } }));
  } catch (e) {
    /* older browsers get the piece and no event */
  }
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
    points(w, h, pad) {
      const p = pad || 0;
      return env.stars.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    mix,
    alpha,
    reduced: calm.matches,
    satisfy(id, value) {
      markSet(id, value, 'piece');
    },
    progress(id, fraction) {
      const s = c.state.get(id);
      if (!s || !s.knob) return;
      const f = Math.max(0, Math.min(1, Number(fraction) || 0));
      s.knob.style.setProperty('--knob-pct', (f * 100).toFixed(1) + '%');
    },
    status(text) {
      ui.status.textContent = text == null ? '' : String(text);
    },
    value(id) {
      const s = c.state.get(id);
      return s ? s.value : undefined;
    },
    get done() {
      return c.completed;
    },
    get elapsed() {
      return (performance.now() - c.startedAt) / 1000;
    },
    complete() {
      finish();
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
  for (const step of current.steps) {
    const knob = el('div', 'knob');
    knob.dataset.id = step.id;
    knob.dataset.kind = step.kind;
    const ask = el('p', 'knob-ask', step.ask || step.id);
    ask.id = 'knob-ask-' + step.id;
    knob.appendChild(ask);
    const render = KNOBS[step.kind] || KNOBS.choice;
    render(step, knob, ask.id);
    const mark = el('span', 'knob-mark');
    mark.appendChild(hidden('set'));
    knob.appendChild(mark);
    current.state.get(step.id).knob = knob;
    ui.knobs.appendChild(knob);
  }
  updateGates();
}

function apply(id, value) {
  const c = current;
  if (!c) return;
  c.touched = true;
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
    const all = Array.from(c.state.values()).every((x) => x.set);
    if (all && c.piece.auto !== false) finish();
  }
}

function updateGates() {
  for (const s of current.state.values()) {
    const gate = s.step.after ? current.state.get(s.step.after) : null;
    const locked = !!(gate && !gate.set);
    s.knob.classList.toggle('is-locked', locked);
    for (const control of s.knob.querySelectorAll('button, input')) control.disabled = locked;
  }
}

function tapsOpen() {
  // Whether a tap on the scene reaches the piece: always, unless every tap knob is still locked.
  const taps = Array.from(current.state.values()).filter((s) => s.step.kind === 'tap');
  if (!taps.length) return true;
  return taps.some((s) => !s.knob || !s.knob.classList.contains('is-locked'));
}

function renderProgress() {
  ui.progress.textContent = '';
  let set = 0;
  const left = [];
  for (const s of current.state.values()) {
    if (s.set) set += 1;
    else left.push(s.step.ask || s.step.id);
    ui.progress.appendChild(el('span', 'stage-dot' + (s.set ? ' is-set' : '')));
  }
  ui.progress.appendChild(hidden(set + ' of ' + current.state.size + ' set'));
  // What is left, said out loud. A knob may be set in any order, and the one at the bottom of the
  // page is often not the last one a visitor has to touch -- a piece can gate its finale on an
  // earlier knob and leave an ungated one above it untouched. Without this line, setting the
  // bottom knob, watching the scene answer, and having the piece not finish reads as a piece that
  // broke rather than as one with a knob still waiting (issue #60).
  // Two are named, more are counted, because the stranded knob is always among the last one or two
  // left -- the visitor has done everything else by then -- and a list of five is noise.
  if (ui.wanted) {
    const say = set > 0 && left.length > 0;
    ui.wanted.textContent = !say ? ''
      : left.length <= 2 ? 'still to set: ' + left.join(' and ')
        : 'still to set: ' + left[0] + ', and ' + (left.length - 1) + ' more';
    ui.wanted.hidden = !say;
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
      group.appendChild(b);
    });
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
  },
  press(step, knob) {
    const count = Math.max(1, Math.min(12, Number(step.count) || 3));
    const label = step.label || 'press';
    const word = (left) => (count > 1 && left > 0 ? label + ' (' + left + ')' : label);
    let n = 0;
    const b = el('button', 'knob-big', word(count));
    b.type = 'button';
    b.addEventListener('click', () => {
      n += 1;
      b.textContent = word(count - n);
      knob.style.setProperty('--knob-pct', ((n / count) * 100).toFixed(1) + '%');
      apply(step.id, n);
      if (n >= count) markSet(step.id, n, 'knob');
    });
    knob.appendChild(b);
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
    function paint() {
      const held = performance.now() - started;
      if (held >= ms) {
        fill(held);
        return;
      }
      knob.style.setProperty('--knob-pct', ((held / ms) * 100).toFixed(1) + '%');
    }
    function fill(held) {
      fired = true;
      halt(); // there is nothing left to paint: the bar stays full under the finger
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
      knob.style.setProperty('--knob-pct', '0%');
      ui.status.textContent = 'let go early; hold it longer';
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
      if (!current || current.completed || typeof current.piece.tap !== 'function') return;
      current.touched = true;
      try {
        current.piece.tap(0.2 + altRnd() * 0.6, 0.2 + altRnd() * 0.6, current.ctx);
      } catch (e) {
        /* the piece's tap failing is the piece's own problem */
      }
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

if (ui) {
  ui.canvas.addEventListener('pointerdown', (ev) => {
    const c = current;
    if (!c || c.completed || typeof c.piece.tap !== 'function' || !tapsOpen()) return;
    const r = ui.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    c.touched = true;
    try {
      c.piece.tap((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height, c.ctx);
    } catch (e) {
      /* the piece's tap failing is the piece's own problem */
    }
  });
}

/* ---- finishing ----------------------------------------------------------------------------- */

function finish() {
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
  for (const control of ui.knobs.querySelectorAll('button, input')) control.disabled = true;
  // The piece's own closing line, if it writes one in end(), stands; this is the default.
  ui.status.textContent = c.piece.title ? 'finished: ' + c.piece.title : 'finished';
  try {
    if (typeof c.piece.end === 'function') c.piece.end(c.ctx);
  } catch (e) {
    /* the finale is optional */
  }
  setMode('done');
  ui.doneText.textContent = 'done';
  ui.done.hidden = false;
  // The ceremony is on the scene, which on a phone may be above the knob that finished it.
  const box = ui.scene.getBoundingClientRect();
  if (box.top < 0 || box.bottom > window.innerHeight) {
    ui.scene.scrollIntoView({ block: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
  }
  chime();
  burst();
  try {
    window.dispatchEvent(new CustomEvent('stage:complete', { detail: { file: c.world.file, seed: c.seed } }));
  } catch (e) {
    /* no event, no matter */
  }
  // The ceremony lingers, and then the way on lights up and the stage stops. What used to happen
  // here was the departure itself, on a timer; a finished piece is the visitor's to sit with for
  // as long as they like now, and the press is what sends it away (issue #78).
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
  later(() => {
    if (current !== piece) return; // something else took the stage while this one was leaving
    next(finished ? {} : { replace: true });
  }, calm.matches ? 120 : 520);
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
  // The next card off the stack is a card too: the site takes its colour as it arrives, the same
  // way it takes the colour of one a visitor pressed. A world picked at random below has none.
  const seeds = file && taken ? taken.seeds : null;
  if (!file) {
    const pool = WORLDS.filter((w) => w.file !== avoid && (!fit || fit(w.file)));
    const world = pool.length ? pool[Math.floor(Math.random() * pool.length)] : WORLDS[0];
    if (!world) return;
    file = world.file;
  }
  if (extra.first) firstPiece = { file, seed };
  open(file, seed, Object.assign({ arriving: true, seeds }, extra));
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
  const g = ui.canvas.getContext('2d');
  if (g) g.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  ui.canvas.setAttribute('aria-label', 'the scene');
  ui.scene.style.removeProperty('--piece-aspect');
  ui.scene.style.removeProperty('--piece-ratio');
  ui.brief.textContent = '';
  ui.knobs.textContent = '';
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
  ui.world.textContent = home.name;
  ui.title.textContent = home.line;
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

function chime() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    if (!chime.ctx) chime.ctx = new Ctor();
    const ac = chime.ctx;
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    const now = ac.currentTime;
    [[523.25, 0], [783.99, 0.12], [1046.5, 0.24]].forEach(([freq, at]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.045, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.55);
    });
  } catch (e) {
    /* no sound is fine */
  }
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
  const cx = scene.left - box.left + scene.width / 2;
  const cy = scene.top - box.top + scene.height / 2;
  const parts = [];
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 520;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 1.5 + Math.random() * 4,
      c: [colors.accent, colors.accent2, colors.fg][i % 3], life: 0.9 + Math.random() * 0.6, age: 0 });
  }
  let last = performance.now();
  let ring = 0;
  function tick(now) {
    // A frame's timestamp can precede the performance.now() read just before it: never negative.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    ring += dt;
    g.clearRect(0, 0, box.width, box.height);
    g.lineWidth = 3;
    g.strokeStyle = alpha(colors.accent, Math.max(0, 0.7 - ring * 0.9));
    g.beginPath();
    g.arc(cx, cy, Math.max(0, ring * 900), 0, Math.PI * 2);
    g.stroke();
    let alive = 0;
    for (const p of parts) {
      p.age += dt;
      if (p.age > p.life) continue;
      alive++;
      p.vy += 420 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.fillStyle = alpha(p.c, Math.max(0, 1 - p.age / p.life));
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    if (alive && ring < 1.6) requestAnimationFrame(tick);
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
      if (current || pending) close();
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
        ui.read.textContent = (r.source === 'answer' ? 'read just now as ' : 'carried over as ') + o.name;
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
  window.addEventListener('resize', reflow);
  // The heading changes shape without the window doing anything -- a longer title, a font that
  // arrives late, a mode that puts the ask up instead -- and the scene is sized against it.
  if (window.ResizeObserver && ui.head) new window.ResizeObserver(reflow).observe(ui.head);
  sizeHead();
  window.addEventListener('popstate', (ev) => {
    const s = ev.state && ev.state.world ? ev.state : parseHash();
    if (s && s.world && worldOf(s.world)) {
      if (!current || current.world.file !== s.world || current.seed !== s.seed) open(s.world, s.seed, { push: false });
      return;
    }
    if (location.hash) return; // the page's own fragment (the skip link): nothing to do
    if (threshold) goHome();
    else if (random && firstPiece) open(firstPiece.file, firstPiece.seed, { push: false, keepRead: true });
    // A world page's own entry always carries its piece's hash, so there is nothing else to land on.
  });
  // Learn which worlds read the sky, after the first paint has had its turn.
  window.setTimeout(() => {
    for (const w of WORLDS) loadModule(w.id);
  }, 1500);
  if (persona && typeof persona.onSky === 'function') {
    persona.onSky(() => {
      // A piece that reads the sky is made from it: a changed sky is a new piece -- unless the
      // visitor has already begun this one, whose progress is theirs to keep.
      if (current && current.mod && current.mod.needsSky && !current.completed && !current.touched) {
        open(current.world.file, current.seed, { push: false, focus: false });
      }
    });
  }

  if (threshold) {
    thresholdStart();
  } else if (pageWorld) {
    const h = parseHash();
    const file = h && h.world && worldOf(h.world) ? h.world : pageWorld;
    open(file, h ? h.seed : newSeed(), { push: true, replace: true, focus: false });
  } else if (random) {
    // A page of no world (the 404): whatever comes next, which is the first card of the feed. The
    // address stays what was asked for, with the line that says there is no page there.
    const h = parseHash();
    if (h && h.world && worldOf(h.world)) open(h.world, h.seed, { push: false, focus: false });
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
