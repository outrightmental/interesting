/*
  The feed: every world as a card, flowing on for as long as a visitor scrolls.

  One line in the <head> of a page carries it, written once in _includes/layout.njk:

      <script src='js/feed.js' type='module'></script>

  _includes/worlds.njk writes the cards a page starts with -- one per world, from _data/worlds.json,
  each a plain link, so the reachability axiom holds with scripting off. This file takes them from
  there:

    - It lays them out as masonry columns, the way Pinterest does: each card goes into the
      shortest column, so a new card never moves an old one. Without it the grid is CSS columns.
    - It paints each card as it comes into view, through the world's module in js/modules/, in the
      world's own palette (each card carries data-mood, and _sass/_mood.scss re-tints it).
    - It keeps dealing as the visitor nears the bottom: the things the worlds make -- a coinage, a
      specimen, a rule, an omen, a forecast -- dealt between the worlds themselves, without end.
    - Every card it deals gets a variant: a randomized configuration (js/variant.js) that is what
      makes the second appearance of a world a different card and not a reprint of the first. The
      variant re-derives the card's four palette seeds inside its own mood, stretches its frame from
      its world's aspect ratio, and rides on env for the module to draw from. The card the template
      wrote for each world wears the variant that changes nothing (PLAIN), so a world leads with its
      own palette and its own frame, and the repeats are what vary.
    - It leads with the world the visitor's reading opens onto, badged "for you", and follows the
      reading as it changes (threshold:reading). With no sky yet it deals one unpowered card early,
      carrying the shared unlock (window.interestingSite.unlock), and every card that reads the sky
      follows the persona as stars are placed (persona:sky).
    - It paints a page's feature on request: window.interestingFeed.feature(host, canvas, file)
      paints the named world across the canvas in that world's palette (the host takes the
      world's data-mood) and keeps it live exactly as a card is, and unfeature(host) clears it.
      The threshold uses it to show the world a reading opens onto. feed:ready is dispatched on
      window once the API is there.

  ---------------------------------------------------------------------------------------------
  A module, in js/modules/<world>.js, where <world> is the page's file without ".html":

      export default {
        id: 'word-kiln',
        needsSky: false,                 // true for a world that reads the persona's stars
        paint(ctx, w, h, env) {},        // the card's picture, drawn once when the card is near
        animate(ctx, w, h, env, t) {},   // optional: redraw per frame while visible; never called
                                         // when the visitor has asked for less motion
        spark(env) {                     // a thing the world made, or null for none right now
          return { title, text, quote, mono, cite, overline, aspect, paint };
        }                                // aspect ('4 / 3') and paint() give the spark a picture
      };

  env is the same for both: { seed, rnd(), pick(list), int(a, b), chance(p), hash(text), stars,
  points(w, h, pad), colors: { bg, bg2, accent, accent2, fg, muted }, mix(a, b, t), alpha(c, a),
  reduced, world: { file, name, orientation }, variant }. rnd is seeded, so a card paints the same
  picture every time it is painted and a different one from its neighbour, and variant is the card's
  configuration (js/variant.js): variant.density is how much of itself to draw, variant.scale how
  large, variant.turn where to start. A module that reads none of them still varies, because its
  colours have been configured for it already; one that reads them varies in shape as well.

  Nothing here reaches for the browser's storage: the sky is read through window.interestingPersona
  and the reading through window.threshold, and nothing is written at all.
*/

import { roll, PLAIN, recolor, aspect, light, mulberry32, hash, mix, alpha } from './variant.js';

const persona = window.interestingPersona;
const site = window.interestingSite;
const root = document.documentElement.getAttribute('data-root') || '';
const here = document.documentElement.getAttribute('data-page') || '';
const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

const grid = document.getElementById('feed-grid');
const sentinel = document.getElementById('feed-more');

const MIN_COLUMN = 230; // px, on a wide screen
const MIN_COLUMN_COMPACT = 150; // px, on a phone: two columns
const MAX_COLUMNS = 6;
const BATCH = 8; // cards dealt per approach to the bottom
const CAP = 480; // cards before the feed stops dealing: a safety valve nobody scrolls to
const FRAME_MS = 33; // animated cards redraw at about thirty frames a second

const FALLBACK = { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' };

/* ---- small helpers ----------------------------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function shuffle(list, rnd) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function readColors(card) {
  const style = getComputedStyle(card);
  const out = {};
  for (const name of Object.keys(FALLBACK)) {
    out[name] = style.getPropertyValue('--' + name).trim() || FALLBACK[name];
  }
  return out;
}

function sizeCanvas(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function skyStars() {
  return persona ? persona.stars() : [];
}

/* The environment a module paints and sparks from. The colours are read off the card, which has
   to be in the document for them to be its world's -- and for them to be the ones its variant
   configured, which is why tint() runs before this does. `starsOverride` is the ghost sky a
   powered-down card paints with. */
function makeEnv(card, seed, world, variant, starsOverride) {
  const rnd = mulberry32(seed);
  const stars = starsOverride || skyStars();
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
    colors: card.isConnected ? readColors(card) : Object.assign({}, FALLBACK),
    mix,
    alpha,
    reduced: calm.matches,
    world,
    variant: variant || PLAIN
  };
}

/* ---- the card's configuration ---------------------------------------------------------------- */

// The four seeds a variant moves. --fg and --muted are not among them on purpose (js/variant.js):
// they are what holds the text on a card at 4.5:1, whatever else the configuration does.
const SEEDS = ['bg', 'bg2', 'accent', 'accent2'];

/* Write a card's variant onto the card, as colour.

   The card already wears its world's palette through data-mood (_sass/_mood.scss). This reads those
   four seeds off it once, re-derives them through the variant (variant.recolor) and sets the result
   inline, which wins over the mood rule at the same names -- so _sass/_tokens.scss derives every M3
   role from the configured seeds, _sass/_feed.scss paints the card's surface and its media gradient
   from them, and makeEnv's readColors hands the module the same four. One configuration, one
   palette, everywhere the card is coloured.

   Nothing happens for a plain variant: the card the template wrote keeps its world's palette
   exactly, so the feed still leads with the fourteen moods and the repeats are what vary. */
function tint(card, m) {
  if (!m || !m.variant || m.variant.plain || m.tinted === m.variant || !card.isConnected) return;
  if (!m.base) m.base = readColors(card); // its own mood's seeds, before any configuration
  m.tinted = m.variant;
  const seeds = recolor(m.base, m.variant);
  for (const name of SEEDS) card.style.setProperty('--' + name, seeds[name]);
  card.style.setProperty('--card-light', light(m.variant));
}

/* ---- the worlds, read off the cards the template wrote --------------------------------------- */

const meta = new WeakMap(); // card element -> what the feed knows about it
const cards = []; // every card, in feed order
const salt = (Math.random() * 0x7fffffff) | 0; // a fresh miasma on every load
let seedCounter = 0;

function newSeed() {
  seedCounter += 1;
  return (salt ^ Math.imul(seedCounter, 2654435761)) >>> 0;
}

const WORLDS = grid ? Array.from(grid.querySelectorAll('.card-world')).map((card) => {
  const media = card.querySelector('.card-media');
  const text = card.querySelector('.card-text');
  return {
    file: card.dataset.world,
    id: card.dataset.world.replace(/\.html$/, ''),
    name: card.dataset.name || '',
    orientation: card.dataset.orientation || '',
    mood: card.dataset.mood || '',
    aspect: (media && media.style.aspectRatio) || '1 / 1',
    what: text ? text.textContent : ''
  };
}) : [];

const modules = new Map();

function loadModule(id) {
  if (!modules.has(id)) {
    const url = new URL('./modules/' + id + '.js', import.meta.url);
    modules.set(id, import(url.href).then((m) => m.default || null).catch(() => null));
  }
  return modules.get(id);
}

/* ---- painting ------------------------------------------------------------------------------ */

// A sample sky for a world that reads the sky to paint with while there is none: seven stars in a
// ring, the shape the persona seeds, so the card shows what the world does with a sky.
function ghostSky(seed, v) {
  const rnd = mulberry32(seed);
  const list = [];
  const n = Math.max(4, Math.round(7 * v.density));
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + v.turn * Math.PI * 2 + (rnd() - 0.5) * 0.8;
    const radius = (14 + rnd() * 24) * v.scale;
    list.push({ x: 50 + Math.cos(angle) * radius, y: 48 + Math.sin(angle) * radius * 0.8, text: 'a star not yet placed' });
  }
  return list;
}

// A world that reads the sky, with no sky to read: its own picture, painted from the ghost sky,
// under a veil and a dashed ring, which is what powered down looks like on a card. The one card
// that powers it is dealt early.
function paintUnpowered(ctx, w, h, env) {
  const c = env.colors;
  ctx.fillStyle = alpha(c.bg, 0.62);
  ctx.fillRect(0, 0, w, h);
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = alpha(c.muted, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.3 * env.variant.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0, n = Math.round(9 * env.variant.density); i < n; i++) {
    ctx.fillStyle = alpha(c.muted, 0.12 + env.rnd() * 0.15);
    ctx.beginPath();
    ctx.arc(env.rnd() * w, env.rnd() * h, 1 + env.rnd() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintFallback(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  // The same corner variant.light() gives _sass/_feed.scss, so the picture and the frame behind it
  // agree about where the light is coming from.
  const x = w * (0.3 + v.turn * 0.52);
  const y = h * (0.2 + v.turn * 0.16);
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * v.scale);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

async function paint(card) {
  const m = meta.get(card);
  if (!m || !m.canvas || !card.isConnected) return;
  tint(card, m);
  const mod = m.id ? await loadModule(m.id) : null;
  const box = m.canvas.parentNode;
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!w || !h) return;
  const ctx = sizeCanvas(m.canvas, w, h);
  if (!ctx) return;
  const env = makeEnv(card, m.seed, m.world, m.variant);
  m.ctx = ctx;
  m.w = w;
  m.h = h;
  m.env = env;
  m.painted = true;
  m.dirty = false;
  m.animate = null;
  if (m.sky) {
    // The persona's sky, drawn the way the portrait draws it: the one picture every world shares.
    paintSky(ctx, w, h, env);
    return;
  }
  if (mod && mod.needsSky && !env.stars.length) {
    const ghost = makeEnv(card, m.seed, m.world, m.variant, ghostSky(m.seed, env.variant));
    if (typeof mod.paint === 'function') mod.paint(ctx, w, h, ghost);
    else paintFallback(ctx, w, h, ghost);
    paintUnpowered(ctx, w, h, env);
    return;
  }
  const painter = (m.spec && m.spec.paint) || (mod && mod.paint);
  if (painter) painter(ctx, w, h, env);
  else paintFallback(ctx, w, h, env);
  if (!(m.spec && m.spec.paint) && mod && typeof mod.animate === 'function') {
    m.animate = mod.animate;
    if (m.visible) activate(card);
  }
}

function paintSky(ctx, w, h, env) {
  const c = env.colors;
  paintFallback(ctx, w, h, env);
  const pts = env.points(w, h, 14);
  ctx.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d > Math.min(w, h) * 0.32 * env.variant.scale) continue;
      ctx.strokeStyle = alpha(c.accent, 0.5 - (d / Math.min(w, h)) * 0.9);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();
    }
  }
  for (const p of pts) {
    ctx.fillStyle = alpha(c.fg, 0.95);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8 * env.variant.scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The cards whose module animates, while they are on screen and motion is welcome.
const active = new Set();
let frameHandle = 0;
let lastFrame = 0;

function activate(card) {
  if (calm.matches || document.hidden) return;
  active.add(card);
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}

function deactivate(card) {
  active.delete(card);
}

function frame(now) {
  frameHandle = 0;
  if (document.hidden || calm.matches) return;
  if (now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    for (const card of active) {
      const m = meta.get(card);
      if (!m || !m.animate || !card.isConnected) {
        active.delete(card);
        continue;
      }
      try {
        m.animate(m.ctx, m.w, m.h, m.env, now / 1000);
      } catch (e) {
        m.animate = null;
        active.delete(card);
      }
    }
  }
  if (active.size) frameHandle = requestAnimationFrame(frame);
}

const watcher = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const m = meta.get(entry.target);
    if (!m) continue;
    m.visible = entry.isIntersecting;
    if (entry.isIntersecting) {
      if (!m.painted || m.dirty) paint(entry.target);
      else if (m.animate) activate(entry.target);
    } else {
      deactivate(entry.target);
    }
  }
}, { rootMargin: '320px 0px' }) : null;

/* ---- the layout ---------------------------------------------------------------------------- */

let columns = [];
let heights = [];
let gap = 16;

function columnCount() {
  const width = grid.clientWidth;
  const min = window.innerWidth < 600 ? MIN_COLUMN_COMPACT : MIN_COLUMN;
  return Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + gap) / (min + gap))));
}

function place(card) {
  let shortest = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[shortest]) shortest = i;
  columns[shortest].appendChild(card);
  // Now that it is in the document its own mood's seeds can be read off it, so this is the first
  // moment its variant can be written onto it. A card whose spark has no picture is never painted
  // and would otherwise never be configured at all.
  tint(card, meta.get(card));
  heights[shortest] += card.offsetHeight + gap;
}

function rebuild() {
  grid.classList.add('is-masonry');
  gap = parseFloat(getComputedStyle(grid).columnGap) || 16;
  grid.textContent = '';
  const n = columnCount();
  columns = [];
  heights = [];
  for (let i = 0; i < n; i++) {
    const col = el('div', 'feed-col');
    grid.appendChild(col);
    columns.push(col);
    heights.push(0);
  }
  for (const card of cards) place(card);
  // A card's picture is the width of its column, so every painted card paints again at its new size.
  for (const card of cards) {
    const m = meta.get(card);
    if (!m || !m.painted) continue;
    m.dirty = true;
    if (m.visible) paint(card);
  }
}

function add(card, options) {
  const opts = options || {};
  if (opts.first) cards.unshift(card);
  else cards.push(card);
  if (watcher) watcher.observe(card);
  else paint(card);
}

/* ---- the cards ----------------------------------------------------------------------------- */

function registerStatic() {
  for (const card of Array.from(grid.querySelectorAll('.card-world'))) {
    const world = WORLDS.find((w) => w.file === card.dataset.world);
    if (!world) continue;
    // The first card of every world, and the one the template wrote: the plain variant, so a world
    // leads with its own palette, its own frame and its module's plainest reading.
    meta.set(card, { kind: 'world', world, id: world.id, seed: (hash(world.file) ^ salt) >>> 0,
      variant: PLAIN, canvas: card.querySelector('.card-canvas'), isStatic: true });
    add(card);
  }
}

function media(ratio) {
  const box = el('div', 'card-media');
  box.style.aspectRatio = ratio;
  const canvas = el('canvas', 'card-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  box.appendChild(canvas);
  return { box, canvas };
}

function worldCard(world, seed) {
  const variant = roll(seed);
  const card = el('article', 'card card-world card-enter');
  card.dataset.world = world.file;
  card.dataset.mood = world.mood;
  const link = el('a', 'card-link');
  link.href = root + world.file;
  const { box, canvas } = media(aspect(world.aspect, variant));
  link.appendChild(box);
  const body = el('div', 'card-body');
  body.appendChild(el('p', 'card-overline', world.orientation));
  body.appendChild(el('h3', 'card-title', world.name));
  body.appendChild(el('p', 'card-text', world.what));
  link.appendChild(body);
  card.appendChild(link);
  meta.set(card, { kind: 'world', world, id: world.id, seed, variant, canvas });
  return card;
}

function sparkBody(world, spec) {
  const body = el('div', 'card-body');
  body.appendChild(el('p', 'card-overline', spec.overline || world.name));
  body.appendChild(el('h3', 'card-title', spec.title || world.name));
  if (spec.quote) body.appendChild(el('p', 'card-quote', spec.quote));
  if (spec.text) body.appendChild(el('p', 'card-text', spec.text));
  if (spec.mono) body.appendChild(el('p', 'card-mono', spec.mono));
  if (spec.cite) body.appendChild(el('p', 'card-cite', spec.cite));
  return body;
}

function sparkCard(world, mod, seed) {
  const variant = roll(seed);
  const card = el('article', 'card card-spark card-enter');
  card.dataset.world = world.file;
  card.dataset.mood = world.mood;
  let spec;
  try {
    spec = mod.spark(makeEnv(card, seed, world, variant));
  } catch (e) {
    spec = null;
  }
  if (!spec) return null;

  const link = el('a', 'card-link');
  link.href = root + world.file;
  let canvas = null;
  if (spec.paint) {
    const m = media(aspect(spec.aspect || world.aspect, variant));
    canvas = m.canvas;
    link.appendChild(m.box);
  }
  link.appendChild(sparkBody(world, spec));
  card.appendChild(link);

  const actions = el('div', 'card-actions');
  const again = el('button', 'btn-text', 'another');
  again.type = 'button';
  again.setAttribute('aria-label', 'another from ' + world.name);
  again.addEventListener('click', () => reroll(card));
  actions.appendChild(again);
  card.appendChild(actions);

  meta.set(card, { kind: 'spark', world, id: world.id, seed, variant, canvas, spec, mod });
  return card;
}

// The same card, dealt again: a fresh seed and a fresh configuration, so another from this world
// is another card -- a different thing, in a different palette, in a different frame -- in place.
function reroll(card) {
  const m = meta.get(card);
  if (!m || !m.mod) return;
  const seed = newSeed();
  const variant = roll(seed);
  let spec;
  try {
    spec = m.mod.spark(makeEnv(card, seed, m.world, variant));
  } catch (e) {
    spec = null;
  }
  if (!spec) return;
  m.seed = seed;
  m.spec = spec;
  m.variant = variant;
  tint(card, m);
  const link = card.querySelector('.card-link');
  const oldBody = link.querySelector('.card-body');
  link.replaceChild(sparkBody(m.world, spec), oldBody);
  const oldMedia = link.querySelector('.card-media');
  const ratio = aspect(spec.aspect || m.world.aspect, variant);
  if (spec.paint && !oldMedia) {
    const made = media(ratio);
    link.insertBefore(made.box, link.firstChild);
    m.canvas = made.canvas;
  } else if (!spec.paint && oldMedia) {
    oldMedia.remove();
    m.canvas = null;
  } else if (oldMedia) {
    oldMedia.style.aspectRatio = ratio;
  }
  m.painted = false;
  if (m.canvas) paint(card);
  relayout();
}

// The question, as a card: the persona is the one place that asks, so the card opens it there.
function askCard() {
  const t = window.threshold;
  const card = el('article', 'card card-ask card-enter');
  const body = el('div', 'card-body');
  const r = t && typeof t.reading === 'function' ? t.reading() : null;
  const o = r && r.orientation;
  const read = !!(o && r.source && r.source !== 'signals');
  body.appendChild(el('p', 'card-overline', 'one sideways question'));
  body.appendChild(el('h3', 'card-title', read ? 'read as ' + o.name : 'ask me sideways'));
  if (read) body.appendChild(el('p', 'card-text', o.pull.charAt(0).toUpperCase() + o.pull.slice(1) + '. That opens onto ' + o.worldName + '.'));
  const controls = el('div', 'controls');
  if (persona) {
    const ask = el('button', null, read ? 'ask another way' : 'ask me');
    ask.type = 'button';
    ask.addEventListener('click', () => persona.open('reading'));
    controls.appendChild(ask);
  } else {
    const atlas = el('a', 'action', 'the mood atlas');
    atlas.href = root + 'moods.html';
    controls.appendChild(atlas);
  }
  if (read && o.world !== here) {
    const go = el('a', 'action btn-text', 'go to ' + o.worldName);
    go.href = root + o.world;
    controls.appendChild(go);
  }
  body.appendChild(controls);
  card.appendChild(body);
  meta.set(card, { kind: 'ask' });
  return card;
}

// No sky yet: the one card that powers every world that reads it, through the shared unlock.
function unlockCard() {
  const card = el('article', 'card card-unlock card-enter');
  const stack = el('div', 'card-stack');
  const { box, canvas } = media('16 / 10');
  stack.appendChild(box);
  const body = el('div', 'card-body');
  body.appendChild(el('p', 'card-overline', 'your sky'));
  const text = el('p', 'card-text');
  text.hidden = true;
  body.appendChild(text);
  stack.appendChild(body);
  card.appendChild(stack);
  meta.set(card, { kind: 'unlock', sky: true, seed: newSeed(), variant: PLAIN, canvas, world: null });
  if (site && typeof site.unlock === 'function') {
    // The box the helper puts before the host says everything there is to say; this card adds
    // one line only once there is a sky to count.
    site.unlock(box, {
      onReady(stars) {
        const n = Array.isArray(stars) ? stars.length : 0;
        text.textContent = n + ' star' + (n === 1 ? '' : 's') + '. Open your persona to move them.';
        text.hidden = false;
        const m = meta.get(card);
        if (m) {
          m.dirty = true;
          if (m.visible) paint(card);
        }
        relayout();
      },
      onPowerDown() {
        text.hidden = true;
        relayout();
      }
    });
  }
  return card;
}

/* ---- a page's feature ---------------------------------------------------------------------- */

const features = new Set();

// Paint `file`'s world across `canvas`, which fills `host`, in that world's palette, and keep it
// live exactly as a card is: painted when near, animated when visible, repainted as the sky
// changes. The threshold's feature is one; a world page's feature is the world itself.
function feature(host, canvas, file) {
  const world = WORLDS.find((w) => w.file === file);
  if (!world || !host || !canvas) return false;
  unfeature(host);
  host.dataset.mood = world.mood;
  // The plain variant: a page's feature is the world itself, not a repeat of it, so it is painted
  // in the world's own palette at the world's own size.
  meta.set(host, { kind: 'feature', world, id: world.id, seed: newSeed(), variant: PLAIN, canvas });
  features.add(host);
  if (watcher) watcher.observe(host);
  else paint(host);
  return true;
}

function unfeature(host) {
  const m = meta.get(host);
  if (!m) return;
  if (watcher) watcher.unobserve(host);
  deactivate(host);
  features.delete(host);
  meta.delete(host);
  delete host.dataset.mood;
  const ctx = m.canvas && m.canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, m.canvas.width, m.canvas.height);
}

/* ---- dealing -------------------------------------------------------------------------------- */

const order = shuffle(WORLDS.slice(), mulberry32(salt));
let cursor = 0;
let dealt = 0;
let busy = false;
let unlockDealt = false;

function nextWorld() {
  if (!order.length) return null;
  const world = order[cursor % order.length];
  cursor += 1;
  if (cursor % order.length === 0) shuffle(order, mulberry32(salt ^ cursor));
  return world;
}

async function buildNext() {
  dealt += 1;
  const skyReady = skyStars().length > 0;
  if (!unlockDealt && !skyReady && dealt === 2 && persona) {
    unlockDealt = true;
    return unlockCard();
  }
  if (dealt % 9 === 5 && window.threshold) return askCard();
  if (dealt % 4 === 0) {
    const w = nextWorld();
    return w ? worldCard(w, newSeed()) : null;
  }
  for (let tries = 0; tries < order.length; tries++) {
    const w = nextWorld();
    if (!w) break;
    const mod = await loadModule(w.id);
    if (!mod || typeof mod.spark !== 'function') continue;
    if (mod.needsSky && !skyReady) continue;
    const card = sparkCard(w, mod, newSeed());
    if (card) return card;
  }
  const w = nextWorld();
  return w ? worldCard(w, newSeed()) : null;
}

async function more() {
  if (busy || cards.length >= CAP || !order.length) return;
  busy = true;
  const batch = [];
  for (let i = 0; i < BATCH; i++) {
    const card = await buildNext();
    if (card) batch.push(card);
  }
  for (const card of batch) {
    add(card);
    place(card);
  }
  busy = false;
  if (sentinel && nearBottom()) more();
}

// Whether the sentinel is still inside the margin the observer watches: the observer only fires
// when that changes, so after a batch the feed keeps dealing until the sentinel is clear of it.
function nearBottom() {
  const box = sentinel.getBoundingClientRect();
  return box.top < window.innerHeight + 900;
}

/* ---- the suggested world ------------------------------------------------------------------- */

let suggested = null;

function suggest() {
  const t = window.threshold;
  if (!t || typeof t.reading !== 'function') return false;
  let r = null;
  try {
    r = t.reading();
  } catch (e) {
    r = null;
  }
  const o = r && r.orientation;
  const read = !!(o && r.source && r.source !== 'signals' && o.world !== here);
  const target = read ? cards.find((card) => {
    const m = meta.get(card);
    return m && m.isStatic && m.world.file === o.world;
  }) || null : null;
  if (target === suggested) return false;
  if (suggested) {
    const badge = suggested.querySelector('.card-badge');
    if (badge) badge.remove();
    suggested.classList.remove('card-suggested');
  }
  suggested = target;
  if (target) {
    const box = target.querySelector('.card-media') || target;
    box.appendChild(el('span', 'card-badge', 'for you'));
    target.classList.add('card-suggested');
    const at = cards.indexOf(target);
    if (at > 0) {
      cards.splice(at, 1);
      cards.unshift(target);
    }
  }
  return true;
}

/* ---- start --------------------------------------------------------------------------------- */

let relayoutHandle = 0;

function relayout() {
  if (relayoutHandle) return;
  relayoutHandle = requestAnimationFrame(() => {
    relayoutHandle = 0;
    rebuild();
  });
}

function start() {
  registerStatic();
  suggest();
  rebuild();

  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more();
    }, { rootMargin: '900px 0px' }).observe(sentinel);
  }

  let lastWidth = grid.clientWidth;
  window.addEventListener('resize', () => {
    for (const host of features) {
      const m = meta.get(host);
      if (!m || !m.painted) continue;
      m.dirty = true;
      if (m.visible) paint(host);
    }
    if (grid.clientWidth === lastWidth) return;
    lastWidth = grid.clientWidth;
    relayout();
  });

  window.addEventListener('threshold:reading', () => {
    if (suggest()) relayout();
  });

  // The sky changed in the persona: every card that reads it paints again, and the sparks that
  // were waiting on a sky can be dealt from here on.
  window.addEventListener('persona:sky', () => {
    for (const card of [...cards, ...features]) {
      const m = meta.get(card);
      if (!m) continue;
      const reads = m.sky || (m.id && modules.has(m.id) && m.painted);
      if (!reads) continue;
      m.dirty = true;
      if (m.visible) paint(card);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) for (const card of active) activate(card);
  });

  if (typeof calm.addEventListener === 'function') {
    calm.addEventListener('change', () => {
      if (calm.matches) active.clear();
    });
  }
}

window.interestingFeed = { feature, unfeature };

if (grid && WORLDS.length) start();
try {
  window.dispatchEvent(new CustomEvent('feed:ready'));
} catch (e) {
  /* an older browser gets the API and no event */
}
