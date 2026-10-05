/*
  The stage: where a piece is played, finished, and replaced by the next.

  One line in the <head> of a page carries it, written once in _includes/layout.njk:

      <script src='js/stage.js' type='module'></script>

  A page's feature is not a fixed page any more. It is a piece: a small, procedurally generated,
  randomly configured item with a few knobs and a clear end -- a fidget toy with levers on it --
  made on the spot by a world's module from a seed. The visitor sets the knobs, the piece is
  finished, it vanishes with some ceremony, and the next card in the feed's stack opens in its
  place, so one piece follows another without end. _includes/stage.njk writes the stage; this
  file runs it; js/feed.js hands it the next card.

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
             on every move, set on the first release; ctx.value(id) is where it starts from the
             first frame on
    press    one big button pressed `count` times (label); apply(id, n) each press, set at count
    hold     one big button held for `ms` (label); apply(id, heldMs) when let go after long enough
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
                                     brings the stage into view
        .next()                      finish nothing, open the next card from the feed's stack
        .skip()                      leave the current piece without ceremony and open the next
        .current()                   { file, seed } or null
      events on window: 'stage:open' { file, seed }, 'stage:complete' { file, seed },
      'stage:home' (the threshold's own state, on going back)

  The URL carries the piece: `world.html#<seed>` is this piece, shareable, and the back button
  walks back through the pieces a visitor finished (a skipped one is replaced, not kept).
  Opening a card from another world moves the address to that world's page without a load: a
  page is wherever the stage is.

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
  world: document.getElementById('stage-world'),
  read: document.getElementById('stage-read'),
  title: document.getElementById('stage-title'),
  brief: document.getElementById('stage-brief'),
  body: document.getElementById('stage-body'),
  scene: document.getElementById('stage-scene'),
  canvas: document.getElementById('stage-canvas'),
  knobs: document.getElementById('stage-knobs'),
  status: document.getElementById('stage-status'),
  progress: document.getElementById('stage-progress'),
  done: document.getElementById('stage-done'),
  doneText: document.getElementById('stage-done-text'),
  skip: document.getElementById('stage-skip'),
  again: document.getElementById('stage-again'),
  burst: document.getElementById('stage-burst'),
  gate: null // the element the unlock helper powers down, one per unpowered open
} : null;

// What the page said before any piece opened: the threshold goes back to it.
const home = stage ? {
  name: ui.world.textContent,
  line: ui.title.textContent,
  title: document.title,
  world: document.documentElement.dataset.world || ''
} : null;

let current = null; // the piece on stage, and everything the stage knows about it
let pending = null; // the token of the open() in flight, so a slow module cannot land late
let frameHandle = 0;
let lastFrame = 0;
let firstPiece = null; // on a page of no world (the 404): the piece that opened on arrival
const altRnd = mulberry32(newSeed()); // for the 'tap for me' button, apart from the piece's own

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

  document.documentElement.dataset.world = world.mood;
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
  ui.title.textContent = world.what || world.name;
  ui.brief.textContent = '';
  ui.knobs.textContent = '';
  ui.progress.textContent = '';
  ui.status.textContent = '';
  ui.done.hidden = true;
  ui.skip.hidden = true;
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
  ui.skip.hidden = false;
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
  ui.skip.hidden = false;
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
    colors: readColors(stage),
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
  ui.skip.hidden = false;

  // The scene has a size only once the stage is in a mode that shows it.
  setMode(opts && opts.arriving && !calm.matches ? 'arriving' : 'live');
  current.ctx = makeCtx(env);
  sizeScene();
  try {
    if (typeof piece.start === 'function') piece.start(current.ctx);
  } catch (e) {
    /* a piece that cannot start still has its knobs; the frame loop guards itself */
  }
  if (opts && opts.arriving) {
    window.setTimeout(() => {
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

function sizeScene() {
  if (!current || !current.ctx) return;
  const box = ui.scene.getBoundingClientRect();
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
  for (const s of current.state.values()) {
    if (s.set) set += 1;
    ui.progress.appendChild(el('span', 'stage-dot' + (s.set ? ' is-set' : '')));
  }
  ui.progress.appendChild(hidden(set + ' of ' + current.state.size + ' set'));
}

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
    input.addEventListener('change', () => markSet(step.id, Number(input.value), 'knob'));
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
    let ticker = 0;
    function down() {
      if (started || b.disabled) return;
      started = performance.now();
      b.classList.add('is-held');
      b.setAttribute('aria-pressed', 'true');
      ticker = window.setInterval(() => {
        knob.style.setProperty('--knob-pct', Math.min(100, ((performance.now() - started) / ms) * 100).toFixed(1) + '%');
      }, 50);
    }
    function up() {
      if (!started) return;
      const held = performance.now() - started;
      started = 0;
      window.clearInterval(ticker);
      b.classList.remove('is-held');
      b.setAttribute('aria-pressed', 'false');
      if (held >= ms) {
        knob.style.setProperty('--knob-pct', '100%');
        apply(step.id, held);
        markSet(step.id, held, 'knob');
      } else {
        knob.style.setProperty('--knob-pct', '0%');
        ui.status.textContent = 'let go early; hold it longer';
      }
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
  ui.skip.hidden = true;
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
  const token = c.token;
  const linger = calm.matches ? 500 : 1200;
  window.setTimeout(() => {
    if (!current || current.token !== token) return;
    setMode('vanishing');
    window.setTimeout(() => {
      if (!current || current.token !== token) return;
      next();
    }, calm.matches ? 120 : 520);
  }, linger);
}

// Leave without ceremony. A skipped piece is replaced in the history, so going back walks
// through what was finished and not what was passed over.
function skip() {
  if (!current) {
    next({ replace: true });
    return;
  }
  const token = current.token;
  setMode('vanishing');
  window.setTimeout(() => {
    if (!current || current.token !== token) return;
    next({ replace: true });
  }, calm.matches ? 60 : 420);
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
  if (!file) {
    const pool = WORLDS.filter((w) => w.file !== avoid && (!fit || fit(w.file)));
    const world = pool.length ? pool[Math.floor(Math.random() * pool.length)] : WORLDS[0];
    if (!world) return;
    file = world.file;
  }
  if (extra.first) firstPiece = { file, seed };
  open(file, seed, Object.assign({ arriving: true }, extra));
}

function close() {
  pending = null;
  if (current) {
    const g = current.ctx && current.ctx.g;
    if (g) g.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    current = null;
  }
  if (ui.gate) {
    ui.gate.remove();
    ui.gate = null;
  }
  for (const box of ui.body.querySelectorAll('.unlock')) box.remove();
  ui.done.hidden = true;
}

// The threshold's own state, back from a piece: what the page said before anything opened.
function goHome() {
  close();
  ui.world.textContent = home.name;
  ui.title.textContent = home.line;
  ui.brief.textContent = '';
  if (ui.read) ui.read.hidden = true;
  document.title = home.title;
  if (home.world) document.documentElement.dataset.world = home.world;
  else delete document.documentElement.dataset.world;
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

  ui.skip.addEventListener('click', skip);
  let lastWidth = 0;
  window.addEventListener('resize', () => {
    if (!current) return;
    const w = ui.scene.getBoundingClientRect().width;
    if (Math.abs(w - lastWidth) < 1) return;
    lastWidth = w;
    sizeScene();
    // A piece that draws only in start() draws again at the new size.
    if (typeof current.piece.frame !== 'function' && typeof current.piece.start === 'function') {
      try {
        current.piece.start(current.ctx);
      } catch (e) {
        /* nothing more to do */
      }
    }
  });
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
    skip,
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
