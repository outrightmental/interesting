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

   How the feed moves (README: "Motion axiom"). Nothing a visitor watches here cuts or fades: the
   stylesheet (_sass/_feed.scss) holds the rites and this file puts the classes on at the moment
   each is due. A card dealt waits rolled up (card-rolled) until it first meets the viewport, then
   develops (card-enter) after a delay rolled with jitter for its place in the batch; a face
   re-dealt by "another" or by the sky arriving leaves down the matte ladder (card-redeal) before
   the new one climbs it (is-dealt) and its name is revealed glyph by glyph; a card taken leaves
   (card-leave), the one pressed pops over and goes up to the stage (card-taken); a badge pinned on
   develops (is-dealt) and one taken off leaves (is-gone); the suggested card and the unpowered one
   are sealed with the rolled texture (is-sealing / is-unsealing); and when the columns are laid
   again every card that changed its place travels there along a curve the engine rolled. The
   engine (window.interestingMotion) is optional throughout: without it the classes still go on
   and the clock takes them off. */
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

// A passing rite on an element: the engine puts the class is-<name> on and takes it off when the
// animation ends; without the engine the class goes on and the clock takes it off.
function play(node, name, after) {
  if (!node || !node.classList || calm.matches) return;
  const motion = engine();
  if (motion && typeof motion.rite === 'function') {
    motion.rite(node, name, after);
    return;
  }
  const cls = 'is-' + name;
  node.classList.remove(cls);
  requestAnimationFrame(() => {
    node.classList.add(cls);
    window.setTimeout(() => node.classList.remove(cls), after || riteMs('long') + 300);
  });
}

// Words a visitor watches arrive are revealed glyph by glyph; the words themselves never change.
function reveal(node, pace) {
  const motion = engine();
  if (node && motion && typeof motion.reveal === 'function' && !calm.matches) motion.reveal(node, { pace });
}

// The grain a card's mattes are offset by, from its seed, so no two cards wax or develop alike.
function grain(card, seed) {
  if (!card.style || typeof card.style.setProperty !== 'function') return;
  card.style.setProperty('--card-grain', ((seed % 97) - 48) + 'px ' + (((seed >>> 8) % 89) - 44) + 'px');
}

// A card rolled up develops: the k-th of a batch waits its rolled stagger, then climbs the ladder
// from the rolled geometry; the class comes off when the spell ends so a card laid again does not
// arrive again. A visitor who asked for less motion is shown the card.
function develop(card, k) {
  if (!card.classList.contains('card-rolled')) return;
  card.classList.remove('card-rolled');
  if (calm.matches) return;
  const motion = engine();
  const delay = motion && typeof motion.stagger === 'function' ? motion.stagger(k) : Math.round(k * 44 + Math.random() * 30);
  card.style.setProperty('--d', delay + 'ms');
  card.classList.add('card-enter');
  // The card's own spell ending takes the class off -- not a child's (a badge, a face re-dealt
  // under it), whose ends bubble up through it.
  const settle = (ev) => {
    if (ev && (ev.target !== card || ev.animationName !== 'card-in')) return;
    card.classList.remove('card-enter');
    card.removeEventListener('animationend', settle);
    card.removeEventListener('animationcancel', settle);
  };
  card.addEventListener('animationend', settle);
  card.addEventListener('animationcancel', settle);
  window.setTimeout(settle, delay + riteMs('long') + 200);
}

// A badge pinned on a card develops and its words are revealed; one taken off leaves down the
// ladder and goes when the spell has played.
function badge(card, text) {
  const mark = el('span', 'card-badge', text);
  (card.querySelector('.card-media') || card).appendChild(mark);
  play(mark, 'dealt', riteMs('long') + 300);
  reveal(mark, 0.6);
  return mark;
}

function unbadge(mark) {
  if (!mark) return;
  if (calm.matches || !engine()) {
    mark.remove();
    return;
  }
  mark.classList.add('is-gone');
  const gone = (ev) => {
    if (ev && ev.target !== mark) return;
    mark.remove();
  };
  mark.addEventListener('animationend', gone);
  window.setTimeout(gone, riteMs('medium') + 200);
}

function badgeOf(card, text) {
  return Array.from(card.querySelectorAll('.card-badge')).find((node) => node.textContent === text && !node.classList.contains('is-gone')) || null;
}

// Things changing places move there. Every card is measured before `change` lays the columns
// again and after, and each that moved travels from its old place to its new one along a curve
// the engine rolled for it (steps where the browser cannot read the curve), each a little after
// the last. A card in the middle of arriving or leaving is left to its own rite.
function flipCards(change) {
  const motion = engine();
  const can = laid && !calm.matches && motion && typeof motion.curve === 'function'
    && typeof Element !== 'undefined' && Element.prototype && typeof Element.prototype.animate === 'function';
  if (!can) {
    change();
    return;
  }
  const before = [];
  for (const card of cards) {
    if (!card.isConnected || typeof card.getBoundingClientRect !== 'function') continue;
    if (card.classList.contains('card-rolled') || card.classList.contains('card-enter') || card.classList.contains('card-leave')) continue;
    before.push([card, card.getBoundingClientRect()]);
  }
  change();
  let k = 0;
  for (const [card, was] of before) {
    if (!card.isConnected) continue;
    const is = card.getBoundingClientRect();
    const dx = was.left - is.left;
    const dy = was.top - is.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    const curve = motion.curve('drift');
    const easing = curve && typeof curve.css === 'string' && curve.css.indexOf('linear(') === 0 ? curve.css : 'steps(5, jump-end)';
    const delay = typeof motion.stagger === 'function' ? motion.stagger(k) * 0.4 : k * 18;
    k += 1;
    try {
      card.animate([
        { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)' },
        { transform: 'none' }
      ], { duration: riteMs('long') * (0.8 + Math.random() * 0.5), easing, delay, fill: 'backwards' });
    } catch (error) {
      /* the browser could not read the curve: the card is where it is */
    }
  }
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

function makeEnv(card, seed, world, variant, starsOverride) {
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
    colors: card.isConnected ? readColors(card) : Object.assign({}, FALLBACK),
    mix, alpha, reduced: calm.matches, world, variant: variant || PLAIN,
    // How this piece moves (README: "Motion axiom"): its own roll of a curve, a stair, a ratchet,
    // a flicker and a matte, from the same seed, so nothing it draws moves along a formula.
    rite: rite(seed)
  };
}

// A tint is written as custom properties, and the stylesheet steps every colour that derives from
// them to the new palette along the stair (_feed.scss), so a re-tinted card never cuts or fades.
function tint(card, m) {
  if (!m || !m.variant || m.variant.plain || m.tinted === m.variant || !card.isConnected) return;
  if (!m.base) m.base = readColors(card);
  m.tinted = m.variant;
  const seeds = recolor(m.base, m.variant);
  for (const name of SEEDS) card.style.setProperty('--' + name, seeds[name]);
  card.style.setProperty('--card-light', light(m.variant));
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

// A card painted over a ghost of a sky not yet cast is unpowered: sealed with the texture until
// the sky arrives, when the seal is lifted (the texture leaves down the ladder) and it is painted
// for real.
function unpowered(card, is) {
  const was = card.classList.contains('card-unpowered');
  if (was === is) return;
  card.classList.toggle('card-unpowered', is);
  if (is) play(card, 'sealing', riteMs('long') + 200);
  else play(card, 'unsealing', riteMs('medium') + 200);
}

async function paint(card) {
  const m = meta.get(card);
  if (!m || !m.canvas || !card.isConnected) return;
  tint(card, m);
  const mod = m.id ? await loadModule(m.id) : null;
  if (meta.get(card) !== m) return;
  const box = m.canvas.parentNode;
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!w || !h) return;
  const ctx = sizeCanvas(m.canvas, w, h);
  if (!ctx) return;
  const env = makeEnv(card, m.seed, m.world, m.variant);
  Object.assign(m, { ctx, w, h, env, painted: true, dirty: false, animate: null, at: performance.now() });
  if (mod && mod.needsSky && !env.stars.length) {
    const ghost = makeEnv(card, m.seed, m.world, m.variant, ghostSky(m.seed, env.variant));
    if (typeof mod.paint === 'function') mod.paint(ctx, w, h, ghost);
    else paintFallback(ctx, w, h, ghost);
    paintUnpowered(ctx, w, h, env);
    unpowered(card, true);
    return;
  }
  unpowered(card, false);
  const painter = m.spec && m.spec.paint || mod && mod.paint;
  if (painter) painter(ctx, w, h, env);
  else paintFallback(ctx, w, h, env);
  if (!(m.spec && m.spec.paint) && mod && typeof mod.animate === 'function') {
    m.animate = mod.animate;
    if (m.visible) activate(card);
  }
}

const active = new Set();
let frameHandle = 0;
let lastFrame = 0;
function activate(card) {
  if (calm.matches || document.hidden) return;
  active.add(card);
  if (!frameHandle) frameHandle = requestAnimationFrame(frame);
}
function deactivate(card) { active.delete(card); }
function frame(now) {
  frameHandle = 0;
  if (document.hidden || calm.matches) return;
  if (now - lastFrame >= 33) {
    lastFrame = now;
    for (const card of active) {
      const m = meta.get(card);
      if (!m || !m.animate || !card.isConnected) {
        active.delete(card);
        continue;
      }
      try {
        // Seconds since this card was painted, not since the page opened: the first frame is t = 0,
        // which is the still picture already on the canvas, so the motion starts where it stands.
        // A frame's timestamp can precede the performance.now() read paint took: never negative.
        // A module that says nothing moves is let go rather than asked again.
        const t = Math.max(0, (now - m.at) / 1000);
        if (m.animate(m.ctx, m.w, m.h, m.env, t) === false) {
          m.animate = null;
          active.delete(card);
        }
      } catch (error) {
        console.error('Could not animate a world card', error);
        m.animate = null;
        active.delete(card);
      }
    }
  }
  if (active.size) frameHandle = requestAnimationFrame(frame);
}

// Two watchers: one paints a card a screen ahead of the visitor, so the picture is there when the
// card is; the other develops it only as it meets the viewport, so the arrival is seen.
const watcher = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const m = meta.get(entry.target);
    if (!m) continue;
    m.visible = entry.isIntersecting;
    if (entry.isIntersecting) {
      if (!m.painted || m.dirty) paint(entry.target);
      else if (m.animate) activate(entry.target);
    } else deactivate(entry.target);
  }
}, { rootMargin: '320px 0px' }) : null;

const developer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  let k = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting || !meta.get(entry.target)) continue;
    if (entry.target.classList.contains('card-rolled')) develop(entry.target, k++);
    developer.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }) : null;

function columnCount() {
  const min = window.innerWidth < 600 ? 150 : 230;
  return Math.max(1, Math.min(6, Math.floor((grid.clientWidth + gap) / (min + gap))));
}
// A card is placed in the shortest column; one being dealt goes in through the engine's flip,
// which marks it dealt (is-dealt) for the stylesheet. Where no watcher will see it meet the
// viewport, it develops now.
function place(card, dealing) {
  let shortest = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[shortest]) shortest = i;
  const col = columns[shortest];
  const motion = engine();
  if (dealing && laid && motion && typeof motion.flip === 'function') motion.flip(col, () => col.appendChild(card));
  else col.appendChild(card);
  tint(card, meta.get(card));
  heights[shortest] += card.offsetHeight + gap;
  if (!watcher && meta.get(card).canvas) paint(card);
  if (!developer) develop(card, 0);
}
function rebuild() {
  flipCards(() => {
    grid.classList.add('is-masonry');
    gap = parseFloat(getComputedStyle(grid).columnGap) || 16;
    grid.textContent = '';
    columns = [];
    heights = [];
    for (let i = 0, n = columnCount(); i < n; i++) {
      const col = el('div', 'feed-col');
      grid.appendChild(col);
      columns.push(col);
      heights.push(0);
    }
    for (const card of cards) {
      card.classList.remove('card-enter');
      place(card);
    }
  });
  laid = true;
  for (const card of cards) {
    const m = meta.get(card);
    if (!m || !m.painted) continue;
    m.dirty = true;
    if (m.visible) paint(card);
  }
}
function add(card, first) {
  if (first) cards.unshift(card);
  else cards.push(card);
  if (watcher) watcher.observe(card);
  if (developer && card.classList.contains('card-rolled')) developer.observe(card);
}
function relayout() {
  if (relayoutHandle) return;
  relayoutHandle = requestAnimationFrame(() => {
    relayoutHandle = 0;
    rebuild();
  });
}

// The cards the template wrote are on the page before this runs: those below the first screen are
// rolled up to develop as the visitor reaches them, and those already in view are left as they are.
function belowTheFold(card) {
  if (typeof card.getBoundingClientRect !== 'function' || !window.innerHeight) return false;
  try {
    return card.getBoundingClientRect().top > window.innerHeight;
  } catch (error) {
    return false;
  }
}
function registerStatic() {
  for (const card of Array.from(grid.querySelectorAll('.card-world'))) {
    const world = WORLDS.find((w) => w.file === card.dataset.world);
    if (!world) continue;
    const seed = (hash(world.file) ^ salt) >>> 0;
    meta.set(card, { kind: 'world', world, id: world.id, seed,
      variant: PLAIN, canvas: card.querySelector('.card-canvas'), isStatic: true });
    grain(card, seed);
    if (!calm.matches && belowTheFold(card)) card.classList.add('card-rolled');
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
  const card = el('article', 'card card-world card-rolled');
  card.dataset.world = world.file;
  card.dataset.mood = world.mood;
  grain(card, seed);
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
  grain(card, seed);
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
// changes at once; what the visitor sees leaves down the ladder first (card-redeal), and the new
// face is swapped in when that has played, develops (is-dealt), and has its name revealed.
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
  grain(card, seed);
  const swap = () => {
    if (meta.get(card) !== m || !card.isConnected) return;
    tint(card, m);
    const link = card.querySelector('.card-link');
    link.replaceChild(sparkBody(m.world, m.spec), link.querySelector('.card-body'));
    const oldMedia = link.querySelector('.card-media');
    const ratio = aspect(m.spec.aspect || m.world.aspect, m.variant);
    if (m.spec.paint && !oldMedia) {
      const picture = media(ratio);
      link.insertBefore(picture.box, link.firstChild);
      m.canvas = picture.canvas;
    } else if (!m.spec.paint && oldMedia) {
      oldMedia.remove();
      m.canvas = null;
    } else if (oldMedia) oldMedia.style.aspectRatio = ratio;
    m.painted = false;
    if (m.canvas) paint(card);
    play(card, 'dealt', riteMs('long') + 300);
    reveal(link.querySelector('.card-title'), 0.5);
    relayout();
  };
  if (m.swap) {
    window.clearTimeout(m.swap);
    m.swap = 0;
  }
  if (calm.matches || card.classList.contains('card-rolled') || !card.isConnected) {
    card.classList.remove('card-redeal');
    swap();
    return;
  }
  card.classList.add('card-redeal');
  m.swap = window.setTimeout(() => {
    m.swap = 0;
    card.classList.remove('card-redeal');
    swap();
  }, riteMs('medium') + 20);
}

function consume(card) {
  const at = cards.indexOf(card);
  if (at < 0) return;
  cards.splice(at, 1);
  if (watcher) watcher.unobserve(card);
  if (developer) developer.unobserve(card);
  deactivate(card);
  if (card === suggested) suggested = null;
  card.classList.remove('card-rolled', 'card-enter', 'card-redeal');
  card.classList.add('card-leave');
  const gone = () => {
    card.remove();
    meta.delete(card);
    relayout();
  };
  // The card leaves along the rolled curve and for the rolled time the stylesheet gives card-out
  // (README: "Motion axiom"), so the stage's loop waits out whatever the roll came to.
  const motion = window.interestingMotion;
  const leaving = motion && typeof motion.ms === 'function' ? motion.ms('medium') + 40 : 300;
  if (calm.matches) gone();
  else window.setTimeout(gone, leaving);
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
  // The pressed card is the one handed to the stage: it pops over and goes up to it (card-taken).
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
    for (const card of batch) {
      add(card);
      place(card, true);
    }
  } finally {
    busy = false;
  }
  if (sentinel && nearBottom()) more();
}

// The card a fresh reading points at: badged "for you" and sealed with the texture; the one it
// pointed at before is unsealed and its badge taken off.
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
    suggested.classList.remove('card-suggested');
    play(suggested, 'unsealing', riteMs('medium') + 200);
  }
  suggested = target;
  if (target) {
    badge(target, 'for you');
    target.classList.add('card-suggested');
    play(target, 'sealing', riteMs('long') + 200);
    const at = cards.indexOf(target);
    if (at > 0) {
      cards.splice(at, 1);
      cards.unshift(target);
    }
  }
  return true;
}

function start() {
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
  // js/motion.js seals (the texture climbs onto its picture), and its badge develops.
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
        if (m.visible) paint(card);
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

window.interestingFeed = { take, consume };
if (grid && WORLDS.length) start();
window.dispatchEvent(new CustomEvent('feed:ready'));
