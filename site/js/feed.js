/* The shared feed. _includes/worlds.njk supplies one plain link per world; this module paints those cards, deals pieces between them, and hands a selected card to js/stage.js. Card env carries seed, seeded rnd/pick/int/chance, stars, colors, world and variant. A pressed card hands its seed, variant, palette and displayed content to the stage, including the module's own `of` value.

   What a world's module owes a card, and what a card owes it back (issue #92):

     paint(ctx, w, h, env)       Draw the still card, once. This is where the card's puzzle is
                                 dealt: env.rnd and the pick/int/chance built on it are a seeded
                                 stream, and paint is the one pass over the canvas that may spend
                                 it. A module that deals a plan should keep it with the env it was
                                 dealt from -- a WeakMap keyed on env -- so the next pass gets the
                                 same card and not another one.
     animate(ctx, w, h, env, t)  Redraw the card in motion, about thirty times a second, and be a
                                 pure function of (w, h, env, t): same arguments, same drawing,
                                 however many times it is called. env is the very same object paint
                                 was handed, stream and all, and that stream is already spent, so
                                 drawing from env.rnd here deals a different puzzle every frame --
                                 which is a card re-rolling itself thirty times a second, not an
                                 ambient picture. `t` is seconds since this card was painted,
                                 starting at zero, so animate(ctx, w, h, env, 0) draws exactly the
                                 picture paint left behind and the motion carries on from it rather
                                 than cutting into some arbitrary phase of a page-long clock; a
                                 repaint (a resize, a new sky) starts the count again. This is the
                                 same reading of time js/stage.js hands a piece's frame(t, dt, ctx),
                                 counted from when that piece opened. Return false to say that
                                 nothing on this card moves, and the loop lets it go.

   .github/scripts/card_variant_harness.mjs holds every module to this, and CardVariantTest in
   test_make_interesting.py makes the assertions.

   How the feed moves (README: "Motion axiom", the cut). Nothing a visitor watches here fades or
   glides: every change is one clean edge stepping across the thing that changes, in a few forward
   treads. The stylesheet (_sass/_feed.scss) draws the edges; this file puts the classes on at the
   moment each is due -- in the same task as the change it marks, so no frame is drawn between the
   two -- and asks the engine (window.interestingMotion, m.cut) for that one movement's treads and
   length, which it also uses to know when the movement is over. A card dealt waits rolled up
   (card-rolled) until it first meets the viewport, then develops (card-enter) a stagger after the
   card before it in its batch, up from below, or down from above for a card met while scrolling
   back up; a face re-dealt by "another" or by the sky arriving is cut away where it stands
   (card-redeal) before the new one is cut in (is-dealt); a card taken goes up toward the stage
   (card-leave, and card-taken for the one pressed); a badge pinned on comes down (is-dealt) and one
   taken off lifts away (is-gone); the suggested card and the unpowered one are sealed in their fill
   (is-sealing / is-unsealing); and when the columns are laid again every card near the screen that
   changed its place jumps there in the treads of one stair (js/motion.js flip).

   What it costs. A movement is played only where the visitor can see it: a card off screen simply
   takes its new state and its new place, and a module's frames are drawn only for a card on
   screen. The page is laid out once for a batch of cards, never once per card: sizes and colours
   are read in one pass before anything is written or moved. Nothing here animates a size: a plate
   that changes its shape is its new size at once while its face is cut away. The engine is
   optional throughout: without it the classes still go on and the clock takes them off. */
import { roll, PLAIN, recolor, aspect, light, mulberry32, hash, mix, alpha, rite } from './variant.js';

const persona = window.interestingPersona;
const root = document.documentElement.getAttribute('data-root') || '';
const here = document.documentElement.getAttribute('data-page') || '';
const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const grid = document.getElementById('feed-grid');
const sentinel = document.getElementById('feed-more');
const FALLBACK = { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' };
const SEEDS = ['bg', 'bg2', 'accent', 'accent2'];
const meta = new WeakMap();
const cards = [];
const modules = new Map();
const salt = (Math.random() * 0x7fffffff) | 0;
let seedCounter = 0;
let columns = [];
let heights = [];
let gap = 16;
let suggested = null;
let relayoutHandle = 0;
let laid = false;

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

function newSeed() {
  seedCounter += 1;
  return (salt ^ Math.imul(seedCounter, 2654435761)) >>> 0;
}

/* ---- the rites ---------------------------------------------------------------------------- */

function engine() {
  return window.interestingMotion || null;
}

// A rolled duration by name, or the stylesheet's baked one when the engine is not there.
function riteMs(name) {
  const motion = engine();
  const got = motion && typeof motion.ms === 'function' ? motion.ms(name) : 0;
  if (got) return got;
  return { short: 170, medium: 340, long: 560, slow: 1200, stagger: 44, shift: 640 }[name] || 340;
}

// One movement's treads and length, rolled by the engine for this trigger alone and written on
// the element as --ease-<rite> and --motion-<rite>, which the stylesheet reads (m.cut). Hands back
// the length in ms -- the duration's own length when there is no engine -- for the timer that
// stands in for the movement's end.
function cut(node, rite, duration) {
  const motion = engine();
  const got = node && !calm.matches && motion && typeof motion.cut === 'function' ? motion.cut(node, rite, { duration }) : 0;
  return got || riteMs(duration);
}

// A passing rite: its class goes on now, in the same task as the change it marks, so no frame is
// drawn between the two, and comes off when `ms` have passed. Put on again before then, it is the
// same movement carried on. A visitor who asked for less motion is shown the end at once.
const passing = new WeakMap();
function pass(node, cls, ms) {
  if (!node || !node.classList || calm.matches) return;
  const own = passing.get(node) || {};
  passing.set(node, own);
  if (own[cls]) window.clearTimeout(own[cls]);
  node.classList.add(cls);
  own[cls] = window.setTimeout(() => {
    own[cls] = 0;
    node.classList.remove(cls);
  }, ms);
}

function unpass(node, cls) {
  const own = node && passing.get(node);
  if (own && own[cls]) {
    window.clearTimeout(own[cls]);
    own[cls] = 0;
  }
  if (node && node.classList) node.classList.remove(cls);
}

// Whether a visitor can see a card's movement: it has arrived, and it is on screen or about to be
// (its watcher says so). A card anywhere else simply takes its new state, since a movement there
// would be drawn for no one.
function seen(card) {
  if (!card || calm.matches || !card.isConnected || card.classList.contains('card-rolled')) return false;
  const m = meta.get(card);
  return watcher ? !!(m && m.near) : true;
}

// What js/feed.js sets a card as, each painting a fill over its picture (_sass/_feed.scss): the
// primary for the card a reading points at, the quieter ink for one waiting for its sky. (The
// current card is set by the stage, on its link, and sealed by js/motion.js.)
const SET = ['card-suggested', 'card-unpowered'];

// A card set as something wears that state's class, and the class is what paints its fill. Where
// the visitor can see it, the change is a rite: set, the fill is sealed in as a curve from the
// point the card's light opens from (is-sealing); unset, it is cut away by a slice (is-unsealing)
// and the class comes off when it has gone, so the fill keeps its own ink to the last tread. A
// card still set some other way keeps its fill and plays neither. Anywhere else, or `quiet` (a card
// painted for the first time is simply what it is), the class just goes on or off.
function setAs(card, state, is, quiet) {
  const m = meta.get(card);
  if (!m) return;
  if (!m.set) m.set = new Set(SET.filter((name) => card.classList.contains(name)));
  if (m.set.has(state) === is) return;
  // A fill still being cut away is gone at once: the change starts from where the card is now.
  if (m.unsetting) m.unsetting();
  const live = !quiet && seen(card);
  const other = m.set.size > 0 || card.classList.contains('card-current');
  if (is) {
    m.set.add(state);
    card.classList.add(state);
    if (live && !other) pass(card, 'is-sealing', cut(card, 'seal', 'long') + 300);
    return;
  }
  m.set.delete(state);
  const kept = m.set.size > 0 || card.classList.contains('card-current');
  if (!live || kept) {
    card.classList.remove(state);
    return;
  }
  unpass(card, 'is-sealing');
  const timer = window.setTimeout(() => m.unsetting && m.unsetting(), cut(card, 'unseal', 'medium') + 200);
  card.classList.add('is-unsealing');
  m.unsetting = () => {
    window.clearTimeout(timer);
    m.unsetting = null;
    card.classList.remove('is-unsealing', state);
  };
}

// A card rolled up develops: the k-th card of the batch it was seen with waits k strides, then
// rises into place behind its slice in treads rolled for it -- up from below, the way the visitor
// scrolls, or down from above for a card met while scrolling back up (`above`) -- and the class
// comes off when its own movement ends. A visitor who asked for less motion is shown the card.
function develop(card, k, above) {
  if (!card.classList.contains('card-rolled')) return;
  card.classList.remove('card-rolled');
  if (calm.matches) return;
  const motion = engine();
  const m = meta.get(card);
  const delay = motion && typeof motion.stagger === 'function' ? motion.stagger(k) : k * 44;
  const own = ['--d', '--ease-develop', '--motion-develop'];
  card.style.setProperty('--d', delay + 'ms');
  if (above) {
    card.style.setProperty('--arrive-y', '-18px');
    card.style.setProperty('--arrive-angle', '180deg');
    own.push('--arrive-y', '--arrive-angle');
  }
  const length = cut(card, 'develop', 'long');
  card.classList.add('card-enter');
  if (m && m.inView && m.animate) activate(card);
  // The card's own movement ending takes the class off -- not a child's (a badge, a face re-dealt
  // under it), whose ends bubble up through it. A movement cancelled by the card changing column
  // mid-arrival (the columns laid again move it, and a moved node starts its animations afresh) is
  // not its end: the card arrives again where it now is, rather than snapping to rest.
  const settle = (ev) => {
    if (ev && (ev.target !== card || ev.pseudoElement || (ev.animationName !== 'cut-in' && ev.animationName !== 'lift-in'))) return;
    if (ev && ev.type === 'animationcancel' && card.isConnected) return;
    card.classList.remove('card-enter');
    card.removeEventListener('animationend', settle);
    card.removeEventListener('animationcancel', settle);
    for (const name of own) card.style.removeProperty(name);
  };
  card.addEventListener('animationend', settle);
  card.addEventListener('animationcancel', settle);
  window.setTimeout(settle, delay + length * 2 + 400);
}

// A badge pinned on a card the visitor can see comes down onto it behind a slice (is-dealt, put on
// before the badge is in the page, so no frame shows it unpinned); one taken off lifts away the
// way it came (is-gone) and goes when that has played. Anywhere else a badge is simply put on or
// taken off.
function badge(card, text) {
  const mark = el('span', 'card-badge', text);
  if (seen(card)) pass(mark, 'is-dealt', cut(mark, 'develop', 'long') + 300);
  (card.querySelector('.card-media') || card).appendChild(mark);
  return mark;
}

function unbadge(mark) {
  if (!mark) return;
  if (!seen(mark.closest ? mark.closest('.card') : null)) {
    mark.remove();
    return;
  }
  unpass(mark, 'is-dealt');
  const length = cut(mark, 'unmake', 'medium');
  mark.classList.add('is-gone');
  const gone = (ev) => {
    if (ev && (ev.target !== mark || ev.pseudoElement)) return;
    mark.remove();
  };
  mark.addEventListener('animationend', gone);
  mark.addEventListener('animationcancel', gone);
  window.setTimeout(gone, length + 300);
}

function badgeOf(card, text) {
  return Array.from(card.querySelectorAll('.card-badge')).find((node) => node.textContent === text && !node.classList.contains('is-gone')) || null;
}

// Things changing places move there: the engine's flip measures the settled cards near the screen
// before `change` lays the columns again and after, and each that moved jumps from its old place to
// its new one in the treads of one stair, all of them together (js/motion.js flip: never a glide).
// Only a card the visitor can see is measured and moved: one anywhere else simply takes its new
// place, as it would be drawn for no one. A card in the middle of arriving or leaving is left to
// its own movement, and nothing new is marked dealt here: a card dealt develops when its own
// watcher sees it.
function flipCards(change) {
  const motion = engine();
  if (!laid || calm.matches || !motion || typeof motion.flip !== 'function') {
    change();
    return;
  }
  const settled = cards.filter((card) => {
    if (!card.isConnected || card.classList.contains('card-rolled') || card.classList.contains('card-enter')
      || card.classList.contains('card-leave')) return false;
    const m = meta.get(card);
    return watcher ? !!(m && m.near) : true;
  });
  if (!settled.length) {
    change();
    return;
  }
  motion.flip(grid, change, { items: settled, dealt: false });
}

/* ---- the cards ---------------------------------------------------------------------------- */

function readColors(card) {
  const style = getComputedStyle(card);
  const out = {};
  for (const name of Object.keys(FALLBACK)) out[name] = style.getPropertyValue('--' + name).trim() || FALLBACK[name];
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

function makeEnv(card, seed, world, variant, starsOverride, colorsOverride) {
  const rnd = mulberry32(seed);
  const stars = starsOverride || skyStars();
  return {
    seed, rnd,
    pick: (list) => list[Math.floor(rnd() * list.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    hash, stars,
    points(w, h, pad) {
      const p = pad || 0;
      return stars.map((s) => ({ x: p + s.x / 100 * (w - p * 2), y: p + s.y / 100 * (h - p * 2), text: s.text }));
    },
    colors: colorsOverride || (card.isConnected ? readColors(card) : Object.assign({}, FALLBACK)),
    mix, alpha, reduced: calm.matches, world, variant: variant || PLAIN,
    // How this piece moves (README: "Motion axiom", the cut): its own roll of a landing, a stair,
    // a ratchet and a single cut, and its one edge -- a slice or a curve -- that it paints a change
    // with, all from the same seed, so nothing it draws moves along a formula.
    rite: rite(seed)
  };
}

// A tint is written as custom properties, and the stylesheet steps every colour that derives from
// them to the new palette along the stair (_feed.scss), so a re-tinted card never cuts or fades.
// Each card's own colours (its world's, from its data-mood) are read for the whole list before any
// card is written to, so a batch costs the page one style pass for the reading and not one a card.
function tintAll(list) {
  const due = list.filter((card) => {
    const m = meta.get(card);
    return m && m.variant && !m.variant.plain && m.tinted !== m.variant && card.isConnected;
  });
  for (const card of due) {
    const m = meta.get(card);
    if (!m.base) m.base = readColors(card);
  }
  for (const card of due) {
    const m = meta.get(card);
    m.tinted = m.variant;
    const seeds = recolor(m.base, m.variant);
    for (const name of SEEDS) card.style.setProperty('--' + name, seeds[name]);
    card.style.setProperty('--card-light', light(m.variant));
  }
}

function tint(card, m) {
  if (card && m && meta.get(card) === m) tintAll([card]);
}

function palette(card, m) {
  if (!card || !card.isConnected) return null;
  tint(card, m);
  const colors = readColors(card);
  const seeds = {};
  for (const name of SEEDS) seeds[name] = colors[name];
  return seeds;
}

function shown(m) {
  if (!m || !m.world) return null;
  const spec = m.spec;
  if (spec) {
    return {
      kind: 'spark',
      overline: spec.overline || m.world.name,
      title: spec.title || m.world.name,
      quote: spec.quote || '',
      text: spec.text || '',
      mono: spec.mono || '',
      cite: spec.cite || '',
      aspect: spec.aspect || m.world.aspect,
      of: spec.of || null
    };
  }
  return {
    kind: 'world',
    overline: m.world.orientation,
    title: m.world.name,
    quote: '',
    text: m.world.what,
    mono: '',
    cite: '',
    aspect: m.world.aspect,
    of: null
  };
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
    aspect: media && media.style.aspectRatio || '1 / 1',
    what: text ? text.textContent : ''
  };
}) : [];

function loadModule(id) {
  if (!modules.has(id)) {
    const url = new URL('./modules/' + id + '.js', import.meta.url);
    modules.set(id, import(url.href).then((m) => m.default || null).catch((error) => {
      console.error('Could not open ' + id, error);
      return null;
    }));
  }
  return modules.get(id);
}

function ghostSky(seed, variant) {
  const rnd = mulberry32(seed);
  const list = [];
  const n = Math.max(4, Math.round(7 * variant.density));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + variant.turn * Math.PI * 2 + (rnd() - 0.5) * 0.8;
    const r = (14 + rnd() * 24) * variant.scale;
    list.push({ x: 50 + Math.cos(a) * r, y: 48 + Math.sin(a) * r * 0.8, text: 'a star not yet placed' });
  }
  return list;
}

function paintFallback(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  const x = w * (0.3 + v.turn * 0.52);
  const y = h * (0.2 + v.turn * 0.16);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * v.scale);
  gradient.addColorStop(0, c.bg2);
  gradient.addColorStop(1, c.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

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

// A card painted over a ghost of a sky not yet cast is unpowered: it wears the fill until the sky
// arrives, when it is painted for real and the fill is cut away. Painted for the first time (or with
// a face re-dealt, which is cut in whole), it simply is what it is.
function unpowered(card, is, first) {
  setAs(card, 'card-unpowered', is, first);
}

async function paint(card) {
  const m = meta.get(card);
  if (!m || !m.canvas || !card.isConnected) return;
  // The plate's size and the card's colours are read together, before anything is written (the
  // card is tinted when it is placed, so tint() here has nothing left to write), and the canvas is
  // sized only after: a watcher painting a row of cards lays the page out once for the row and not
  // once for each card.
  tint(card, m);
  const box = m.canvas.parentNode;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const colors = readColors(card);
  const mod = m.id ? await loadModule(m.id) : null;
  if (meta.get(card) !== m || !m.canvas || m.canvas.parentNode !== box) return;
  if (!w || !h) return;
  const ctx = sizeCanvas(m.canvas, w, h);
  if (!ctx) return;
  const env = makeEnv(card, m.seed, m.world, m.variant, null, colors);
  const first = !m.painted;
  Object.assign(m, { ctx, w, h, env, painted: true, dirty: false, animate: null, at: performance.now() });
  if (mod && mod.needsSky && !env.stars.length) {
    const ghost = makeEnv(card, m.seed, m.world, m.variant, ghostSky(m.seed, env.variant), Object.assign({}, colors));
    if (typeof mod.paint === 'function') mod.paint(ctx, w, h, ghost);
    else paintFallback(ctx, w, h, ghost);
    paintUnpowered(ctx, w, h, env);
    unpowered(card, true, first);
    return;
  }
  unpowered(card, false, first);
  const painter = m.spec && m.spec.paint || mod && mod.paint;
  if (painter) painter(ctx, w, h, env);
  else paintFallback(ctx, w, h, env);
  if (!(m.spec && m.spec.paint) && mod && typeof mod.animate === 'function') {
    m.animate = mod.animate;
    if (viewer) {
      if (m.watched !== m.canvas) {
        if (m.watched) viewer.unobserve(m.watched);
        m.watched = m.canvas;
        m.inView = false;
        viewer.observe(m.canvas);
      } else if (m.inView) activate(card);
    }
  }
}

// The cards whose module is drawing them, frame by frame, while they are on screen. Nothing else
// on a card is drawn by script: every other movement is the stylesheet's.
const active = new Set();
let frameHandle = 0;
let lastFrame = 0;
function activate(card) {
  if (calm.matches || document.hidden || card.classList.contains('card-rolled')) return;
  active.add(card);
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}
function deactivate(card) { active.delete(card); }
// A card whose module says nothing on it moves (or that fails, or is gone) is let go for good and
// no longer watched, so it costs nothing from then on.
function still(card, m) {
  active.delete(card);
  if (!m) return;
  m.animate = null;
  m.inView = false;
  if (viewer && m.watched) viewer.unobserve(m.watched);
  m.watched = null;
}
function frame(now) {
  frameHandle = 0;
  if (document.hidden || calm.matches) return;
  if (now - lastFrame >= 33) {
    lastFrame = now;
    for (const card of active) {
      const m = meta.get(card);
      if (!m || !m.animate || !card.isConnected) {
        still(card, m);
        continue;
      }
      try {
        // Seconds since this card was painted, not since the page opened: the first frame is t = 0,
        // which is the still picture already on the canvas, so the motion starts where it stands.
        // A frame's timestamp can precede the performance.now() read paint took: never negative.
        // A module that says nothing moves is let go rather than asked again.
        const t = Math.max(0, (now - m.at) / 1000);
        if (m.animate(m.ctx, m.w, m.h, m.env, t) === false) still(card, m);
      } catch (error) {
        console.error('Could not animate a world card', error);
        still(card, m);
      }
    }
  }
  if (active.size) frameHandle = requestAnimationFrame(frame);
}

// Three watchers. One paints a card a screen ahead of the visitor, so the picture is there when the
// card is, and says the card is near: only a card near the screen plays a movement. One develops a
// card only as it meets the viewport, so the arrival is seen, from the side the visitor is
// scrolling from. And one runs a card's frames only while its picture is on screen; it watches only
// the pictures whose module moves, so a still card costs it nothing.
const watcher = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const m = meta.get(entry.target);
    if (!m) continue;
    m.near = entry.isIntersecting;
    if (m.near && (!m.painted || m.dirty)) paint(entry.target);
  }
}, { rootMargin: '320px 0px' }) : null;

// Where the page was scrolled the last time cards were met: a batch met with the page scrolled
// further up than that was met scrolling back up, and comes down from above.
let metAt = 0;
const developer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  const met = [];
  for (const entry of entries) {
    if (!entry.isIntersecting || !meta.get(entry.target)) continue;
    developer.unobserve(entry.target);
    if (entry.target.classList.contains('card-rolled')) met.push(entry.target);
  }
  if (!met.length) return;
  const y = window.scrollY || 0;
  const above = y < metAt;
  metAt = y;
  // The temperament each card moves by is read for the lot before any of them is written to, so a
  // batch costs the page one style pass and not one per card.
  const motion = engine();
  if (motion && typeof motion.temperFor === 'function') for (const card of met) motion.temperFor(card);
  met.forEach((card, k) => develop(card, k, above));
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }) : null;

const viewer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const card = entry.target.closest('.card');
    const m = card && meta.get(card);
    if (!m || m.watched !== entry.target) continue;
    m.inView = entry.isIntersecting;
    if (m.inView && m.animate) activate(card);
    else deactivate(card);
  }
}) : null;

function columnCount() {
  const min = window.innerWidth < 600 ? 150 : 230;
  return Math.max(1, Math.min(6, Math.floor((grid.clientWidth + gap) / (min + gap))));
}
function shortest() {
  let s = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[s]) s = i;
  return s;
}
// What a card needs once it has its place: its tint, and -- where no watcher will see it -- its
// picture and its arrival now.
function placed(card) {
  tint(card, meta.get(card));
  if (!watcher && meta.get(card).canvas) paint(card);
  if (!developer) develop(card, 0);
}
// A card is placed in the shortest column, by its height already read (`size`). Laying the columns
// again (`cursors`: how far down each column the laying has reached), a card already where it
// belongs is not touched, so a movement it is in the middle of -- its arrival, a wax, a face being
// re-dealt -- plays on; only a card whose place changed is moved, and a card leaving (not in
// `cards` any more, finishing its movement where it stands) is stepped over.
function place(card, cursors, size) {
  const s = shortest();
  const col = columns[s];
  let n = cursors[s];
  let at = col.children[n] || null;
  while (at && at !== card && at.classList.contains('card-leave')) at = col.children[++n] || null;
  if (at !== card) col.insertBefore(card, at);
  cursors[s] = n + 1;
  heights[s] += size + gap;
  placed(card);
}
// A batch dealt goes on the ends of the columns, rolled up, to develop when its watcher sees it.
// Its cards are put down in the first column together, and their heights and their own colours are
// read in one pass -- the page laid out once for the lot -- before any of them is tinted; each then
// goes to whichever column is shortest, by arithmetic on the heights already known.
function lay(batch) {
  if (!columns.length) {
    for (const card of batch) grid.appendChild(card);
    return;
  }
  for (const card of batch) columns[0].appendChild(card);
  const sizes = batch.map((card) => card.offsetHeight);
  tintAll(batch);
  batch.forEach((card, i) => {
    const s = shortest();
    columns[s].appendChild(card);
    heights[s] += sizes[i] + gap;
    placed(card);
  });
}
// Changes that alter a card's height (a face re-dealt with another plate) wait for the next laying
// and are made inside it, so the cards they push aside are measured before and after and step to
// their new places with the rest.
const pending = [];
// The columns are kept from one laying to the next and made or taken away only when their number
// changes, so a relayout restarts no card's movement; a card whose plate changed width, or that was
// given a new plate, is repainted. Every card's height is read in one pass before any card is moved:
// the columns share one width, so which column a card lands in does not change how tall it is.
function rebuild(change) {
  if (change) pending.push(change);
  if (relayoutHandle) {
    cancelAnimationFrame(relayoutHandle);
    relayoutHandle = 0;
  }
  const changes = pending.splice(0);
  flipCards(() => {
    for (const made of changes) made();
    grid.classList.add('is-masonry');
    gap = parseFloat(getComputedStyle(grid).columnGap) || 16;
    const n = columnCount();
    while (columns.length < n) {
      const col = el('div', 'feed-col');
      grid.appendChild(col);
      columns.push(col);
    }
    // A column taken away: what is still in it (a card leaving) finishes in the last one kept.
    for (const col of columns.splice(n)) {
      while (col.firstChild) columns[n - 1].appendChild(col.firstChild);
      col.remove();
    }
    // A card the template wrote, not yet in a column, joins the first.
    for (const card of cards) if (!card.parentNode || card.parentNode === grid) columns[0].appendChild(card);
    const sizes = cards.map((card) => card.offsetHeight);
    tintAll(cards);
    heights = columns.map(() => 0);
    const cursors = columns.map(() => 0);
    cards.forEach((card, i) => place(card, cursors, sizes[i]));
  });
  laid = true;
  for (const card of cards) {
    const m = meta.get(card);
    if (!m || !m.canvas || !m.canvas.parentNode) continue;
    if (!m.dirty && (!m.painted || m.canvas.parentNode.clientWidth === m.w)) continue;
    m.dirty = true;
    if (m.near) paint(card);
  }
}
function add(card, first) {
  if (first) cards.unshift(card);
  else cards.push(card);
  if (watcher) watcher.observe(card);
  if (developer && card.classList.contains('card-rolled')) developer.observe(card);
}
function relayout(change) {
  if (change) pending.push(change);
  if (relayoutHandle) return;
  relayoutHandle = requestAnimationFrame(() => {
    relayoutHandle = 0;
    rebuild();
  });
}

// The cards the template wrote are on the page before this runs: those below the first screen are
// rolled up to develop as the visitor reaches them, and those already in view are left as they are.
// Where each one sits is read for all of them before any is rolled up, so the page is laid out once.
function belowTheFold(card) {
  if (typeof card.getBoundingClientRect !== 'function' || !window.innerHeight) return false;
  try {
    return card.getBoundingClientRect().top > window.innerHeight;
  } catch (error) {
    return false;
  }
}
function registerStatic() {
  const statics = [];
  for (const card of Array.from(grid.querySelectorAll('.card-world'))) {
    const world = WORLDS.find((w) => w.file === card.dataset.world);
    if (world) statics.push([card, world]);
  }
  const below = statics.map(([card]) => !calm.matches && belowTheFold(card));
  statics.forEach(([card, world], i) => {
    const seed = (hash(world.file) ^ salt) >>> 0;
    meta.set(card, { kind: 'world', world, id: world.id, seed,
      variant: PLAIN, canvas: card.querySelector('.card-canvas'), isStatic: true });
    if (below[i]) card.classList.add('card-rolled');
    add(card);
  });
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
  const card = el('article', 'card card-world card-rolled');
  card.dataset.world = world.file;
  card.dataset.mood = world.mood;
  const link = el('a', 'card-link');
  link.href = root + world.file;
  const picture = media(aspect(world.aspect, variant));
  link.appendChild(picture.box);
  const body = el('div', 'card-body');
  body.appendChild(el('p', 'card-overline', world.orientation));
  body.appendChild(el('h3', 'card-title', world.name));
  body.appendChild(el('p', 'card-text', world.what));
  link.appendChild(body);
  card.appendChild(link);
  meta.set(card, { kind: 'world', world, id: world.id, seed, variant, canvas: picture.canvas });
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
  const card = el('article', 'card card-spark card-rolled');
  card.dataset.world = world.file;
  card.dataset.mood = world.mood;
  let spec;
  try {
    spec = mod.spark(makeEnv(card, seed, world, variant));
  } catch (error) {
    console.error('Could not make a card for ' + world.name, error);
    return null;
  }
  if (!spec) return null;
  const link = el('a', 'card-link');
  link.href = root + world.file;
  let canvas = null;
  if (spec.paint) {
    const picture = media(aspect(spec.aspect || world.aspect, variant));
    canvas = picture.canvas;
    link.appendChild(picture.box);
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
// Another face for the card: what the card is showing (m.spec, which take() and a press hand on)
// changes at once; what the visitor sees is cut away first where it stands, by a slice going up
// (card-redeal), and the new face is swapped in when that has played and cut in where it stands by
// a slice from below, its picture and then its words (is-dealt). A plate that changes its shape,
// or is put on or taken off, is its new size at once -- the card's old face is cut away by then and
// the new one not yet cut in, so nothing is drawn mid-way -- and the swap is made inside a laying
// of the columns, so the cards it pushes aside step to their new places in the treads of one stair
// (flipCards). Nothing animates a height. A card the visitor cannot see simply shows its new face,
// made in the next laying with any others.
function reroll(card, keepSeed) {
  const m = meta.get(card);
  if (!m || !m.mod) return;
  const seed = keepSeed === true ? m.seed : newSeed();
  const variant = keepSeed === true ? m.variant : roll(seed);
  let spec;
  try {
    spec = m.mod.spark(makeEnv(card, seed, m.world, variant));
  } catch (error) {
    console.error('Could not make another card for ' + m.world.name, error);
    return;
  }
  if (!spec) return;
  Object.assign(m, { seed, variant, spec });
  const live = seen(card);
  // Only the newest face is made: a swap still waiting when another face is dealt does nothing.
  const face = {};
  m.face = face;
  const change = () => {
    if (meta.get(card) !== m || m.face !== face || !card.isConnected) return;
    const link = card.querySelector('.card-link');
    link.replaceChild(sparkBody(m.world, m.spec), link.querySelector('.card-body'));
    const plate = link.querySelector('.card-media');
    const ratio = aspect(m.spec.aspect || m.world.aspect, m.variant);
    if (m.spec.paint && !plate) {
      const picture = media(ratio);
      link.insertBefore(picture.box, link.firstChild);
      m.canvas = picture.canvas;
    } else if (!m.spec.paint && plate) {
      plate.remove();
      m.canvas = null;
      still(card, m);
    } else if (plate) {
      plate.style.aspectRatio = ratio;
    }
    // Painted afresh once the columns are laid (rebuild), and quietly: a face cut in whole wears
    // whatever state it has from the start.
    m.painted = false;
    m.dirty = true;
  };
  const swap = () => {
    if (meta.get(card) !== m || m.face !== face || !card.isConnected) return;
    if (!live) {
      relayout(change);
      return;
    }
    pass(card, 'is-dealt', cut(card, 'develop', 'long') + riteMs('stagger') * 2 + 300);
    rebuild(change);
  };
  if (m.swap) {
    window.clearTimeout(m.swap);
    m.swap = 0;
  }
  if (m.swapEnd) {
    card.removeEventListener('animationend', m.swapEnd);
    m.swapEnd = null;
  }
  unpass(card, 'is-dealt');
  if (!live) {
    card.classList.remove('card-redeal');
    swap();
    return;
  }
  // The old face is cut away; its own movement ending (on the plate or the words, whichever lands
  // first) swaps the new one in, with the clock standing in for an end that never comes.
  const dealt = () => {
    if (m.swap) window.clearTimeout(m.swap);
    m.swap = 0;
    card.removeEventListener('animationend', m.swapEnd);
    m.swapEnd = null;
    card.classList.remove('card-redeal');
    swap();
  };
  m.swapEnd = (ev) => {
    if (!ev || ev.pseudoElement || !ev.target || ev.target.parentNode !== card.querySelector('.card-link')) return;
    if (ev.animationName !== 'cut-out') return;
    dealt();
  };
  const length = cut(card, 'unmake', 'medium');
  card.classList.add('card-redeal');
  card.addEventListener('animationend', m.swapEnd);
  m.swap = window.setTimeout(dealt, length + 300);
}

function consume(card) {
  const at = cards.indexOf(card);
  if (at < 0) return;
  // The card pressed is always seen; one the stage takes off the stack is seen only if it is near
  // the screen, and anywhere else it simply goes.
  const live = seen(card) || (card.classList.contains('card-taken') && !calm.matches);
  cards.splice(at, 1);
  if (watcher) watcher.unobserve(card);
  if (developer) developer.unobserve(card);
  still(card, meta.get(card));
  if (card === suggested) suggested = null;
  const m = meta.get(card);
  if (m) {
    // A face half-way to being re-dealt is not re-dealt: the card is leaving.
    if (m.swap) window.clearTimeout(m.swap);
    if (m.swapEnd) card.removeEventListener('animationend', m.swapEnd);
    m.swap = 0;
    m.swapEnd = null;
  }
  card.classList.remove('card-rolled', 'card-enter', 'card-redeal');
  unpass(card, 'is-dealt');
  let done = false;
  const gone = (ev) => {
    if (ev && (ev.target !== card || ev.pseudoElement || (ev.animationName !== 'cut-out' && ev.animationName !== 'lift-out'))) return;
    if (done) return;
    done = true;
    card.removeEventListener('animationend', gone);
    card.removeEventListener('animationcancel', gone);
    card.remove();
    meta.delete(card);
    relayout();
  };
  if (!live) gone();
  else {
    // It goes up toward the stage in treads rolled for this leaving alone, and its own movement
    // ending takes it away; the clock stands in only for an end that never comes, after at least
    // the page's own medium length, so the stage's loop waits out whatever the roll came to.
    const length = cut(card, 'unmake', 'medium');
    card.classList.add('card-leave');
    const motion = window.interestingMotion;
    const leaving = Math.max(length, motion && typeof motion.ms === 'function' ? motion.ms('medium') : 0) + 300;
    card.addEventListener('animationend', gone);
    card.addEventListener('animationcancel', gone);
    window.setTimeout(gone, leaving);
  }
  if (cards.length < 12) more();
}
function take(fit, avoid) {
  const playable = cards.filter((card) => {
    const m = meta.get(card);
    return m && m.world && (m.kind === 'world' || m.kind === 'spark') && !card.classList.contains('card-leave');
  });
  const okay = (card) => typeof fit !== 'function' || fit(meta.get(card).world.file);
  const card = playable.find((item) => okay(item) && meta.get(item).world.file !== avoid)
    || playable.find(okay) || playable[0];
  if (!card) return null;
  const m = meta.get(card);
  const taken = { file: m.world.file, seed: m.seed, kind: m.kind, seeds: palette(card, m),
    variant: m.variant, card: shown(m) };
  consume(card);
  return taken;
}
function openFromCard(ev) {
  const link = ev.target.closest('.card-link');
  if (!link || !window.interestingStage || !document.getElementById('stage')) return;
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const card = link.closest('.card');
  const m = card && meta.get(card);
  if (!m || !m.world || card.classList.contains('card-leave')) return;
  ev.preventDefault();
  const seeds = palette(card, m);
  const file = m.world.file;
  const seed = m.seed;
  const variant = m.variant;
  const was = shown(m);
  // The pressed card is the one handed to the stage: it goes up to it over its neighbours
  // (card-taken).
  card.classList.add('card-taken');
  consume(card);
  window.interestingStage.open(file, seed, { arriving: true, scroll: true, seeds, variant, card: was });
}

const order = shuffle(WORLDS.slice(), mulberry32(salt));
let cursor = 0;
let dealt = 0;
let busy = false;
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
  if (dealt % 4 === 0) {
    const world = nextWorld();
    return world ? worldCard(world, newSeed()) : null;
  }
  for (let tries = 0; tries < order.length; tries++) {
    const world = nextWorld();
    if (!world) break;
    const mod = await loadModule(world.id);
    if (!mod || typeof mod.spark !== 'function' || mod.needsSky && !skyReady) continue;
    const card = sparkCard(world, mod, newSeed());
    if (card) return card;
  }
  const world = nextWorld();
  return world ? worldCard(world, newSeed()) : null;
}
function nearBottom() {
  return sentinel.getBoundingClientRect().top < window.innerHeight + 900;
}
async function more() {
  if (busy || cards.length >= 480 || !order.length) return;
  busy = true;
  try {
    const batch = [];
    for (let i = 0; i < 8; i++) {
      const card = await buildNext();
      if (card) batch.push(card);
    }
    for (const card of batch) add(card);
    lay(batch);
  } finally {
    busy = false;
  }
  if (sentinel && nearBottom()) more();
}

// The card a fresh reading points at: badged "for you" and sealed in its fill; the one it pointed
// at before is unsealed and its badge taken off.
function suggest() {
  const flow = window.threshold;
  if (!flow || typeof flow.reading !== 'function') return false;
  const reading = flow.reading();
  const o = reading && reading.orientation;
  const read = !!(o && reading.source && reading.source !== 'signals' && o.world !== here);
  const target = read ? cards.find((card) => {
    const m = meta.get(card);
    return m && m.isStatic && m.world.file === o.world;
  }) || null : null;
  if (target === suggested) return false;
  if (suggested) {
    unbadge(badgeOf(suggested, 'for you'));
    setAs(suggested, 'card-suggested', false);
  }
  suggested = target;
  if (target) {
    badge(target, 'for you');
    setAs(target, 'card-suggested', true);
    const at = cards.indexOf(target);
    if (at > 0) {
      cards.splice(at, 1);
      cards.unshift(target);
    }
  }
  return true;
}

function start() {
  metAt = window.scrollY || 0;
  registerStatic();
  suggest();
  rebuild();
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) more();
    }, { rootMargin: '900px 0px' }).observe(sentinel);
  }
  grid.addEventListener('click', openFromCard);
  let lastWidth = grid.clientWidth;
  window.addEventListener('resize', () => {
    if (grid.clientWidth === lastWidth) return;
    lastWidth = grid.clientWidth;
    relayout();
  });
  window.addEventListener('threshold:reading', () => {
    if (suggest()) relayout();
  });
  // The world the stage opens onto is the current card: its link flips aria-current, which
  // js/motion.js seals (its fill grows in over its picture), and its badge is pinned on.
  window.addEventListener('stage:open', (ev) => {
    const file = ev.detail && ev.detail.file;
    for (const card of cards) {
      const m = meta.get(card);
      const isHere = !!(m && m.isStatic && m.world.file === file);
      if (isHere === card.classList.contains('card-current')) continue;
      card.classList.toggle('card-current', isHere);
      const link = card.querySelector('.card-link');
      if (link) {
        if (isHere) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      unbadge(badgeOf(card, 'you are here'));
      if (isHere) badge(card, 'you are here');
    }
  });
  let skyPending = false;
  if (persona && typeof persona.onSky === 'function') persona.onSky(() => {
    if (skyPending) return;
    skyPending = true;
    // The shared lightbox holds this frame until the sheet closes, so a drag reads once.
    requestAnimationFrame(() => {
      skyPending = false;
      const ready = skyStars().length > 0;
      for (const card of cards) {
        const m = meta.get(card);
        if (m && m.mod && m.mod.needsSky && ready) {
          // New words, same configuration: the displayed content and its `of` travel together.
          reroll(card, true);
          continue;
        }
        if (!m || !(m.id && modules.has(m.id) && m.painted)) continue;
        m.dirty = true;
        if (m.near) paint(card);
      }
    });
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

/* The persona borrows a real card configuration without consuming or changing the card. Each
   preview captures its stars and colours; drawing starts a fresh seeded stream even on a resize,
   and needs no further palette measurement. Nothing touches a piece already on the stage. */
async function previewSky(index) {
  if (!Number.isInteger(index) || index < 0) throw new TypeError('A sky preview needs a non-negative index.');
  const available = WORLDS.map((world) => {
    const card = cards.find((item) => {
      const m = meta.get(item);
      return m && m.world.file === world.file && item.isConnected && !item.classList.contains('card-leave');
    });
    return card ? { world, card } : null;
  }).filter(Boolean);
  const readers = (await Promise.all(available.map(async (reader) => {
    const mod = await loadModule(reader.world.id);
    return mod && mod.needsSky && typeof mod.spark === 'function'
      ? Object.assign(reader, { mod }) : null;
  }))).filter((reader) => reader && reader.card.isConnected && !reader.card.classList.contains('card-leave'));
  if (!readers.length) throw new Error('No sky puzzle preview could be opened.');
  const reader = readers[index % readers.length];
  const m = meta.get(reader.card);
  tint(reader.card, m);
  const env = makeEnv(reader.card, m.seed, reader.world, m.variant);
  if (!env.stars.length) throw new Error('A sky puzzle preview needs stars.');
  const spec = reader.mod.spark(env);
  if (!spec) throw new Error('This world supplied no sky puzzle preview.');
  const painter = typeof spec.paint === 'function' ? spec.paint : reader.mod.paint;
  if (typeof painter !== 'function') throw new Error('This world supplied no preview picture.');
  return {
    world: reader.world,
    title: spec.title || reader.world.name,
    line: spec.quote || spec.text || spec.mono || reader.world.what,
    aspect: aspect(spec.aspect || reader.world.aspect, m.variant || PLAIN),
    colors: env.colors,
    draw(ctx, w, h) {
      const picture = makeEnv(reader.card, m.seed, reader.world, m.variant, env.stars, env.colors);
      picture.reduced = true;
      painter(ctx, w, h, picture);
    }
  };
}

window.interestingFeed = { take, consume, previewSky };
if (grid && WORLDS.length) start();
window.dispatchEvent(new CustomEvent('feed:ready'));
