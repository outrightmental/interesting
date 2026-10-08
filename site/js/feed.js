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
   test_make_interesting.py makes the assertions. */
import { roll, PLAIN, recolor, aspect, light, mulberry32, hash, mix, alpha } from './variant.js';

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
    mix, alpha, reduced: calm.matches, world, variant: variant || PLAIN
  };
}

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
    return;
  }
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

function columnCount() {
  const min = window.innerWidth < 600 ? 150 : 230;
  return Math.max(1, Math.min(6, Math.floor((grid.clientWidth + gap) / (min + gap))));
}
function place(card) {
  let shortest = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[shortest]) shortest = i;
  columns[shortest].appendChild(card);
  tint(card, meta.get(card));
  heights[shortest] += card.offsetHeight + gap;
  if (!watcher && meta.get(card).canvas) paint(card);
}
function rebuild() {
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
}
function relayout() {
  if (relayoutHandle) return;
  relayoutHandle = requestAnimationFrame(() => {
    relayoutHandle = 0;
    rebuild();
  });
}

function registerStatic() {
  for (const card of Array.from(grid.querySelectorAll('.card-world'))) {
    const world = WORLDS.find((w) => w.file === card.dataset.world);
    if (!world) continue;
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
  const card = el('article', 'card card-spark card-enter');
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
function reroll(card) {
  const m = meta.get(card);
  if (!m || !m.mod) return;
  const seed = newSeed();
  const variant = roll(seed);
  let spec;
  try {
    spec = m.mod.spark(makeEnv(card, seed, m.world, variant));
  } catch (error) {
    console.error('Could not make another card for ' + m.world.name, error);
    return;
  }
  if (!spec) return;
  Object.assign(m, { seed, variant, spec });
  tint(card, m);
  const link = card.querySelector('.card-link');
  link.replaceChild(sparkBody(m.world, spec), link.querySelector('.card-body'));
  const oldMedia = link.querySelector('.card-media');
  const ratio = aspect(spec.aspect || m.world.aspect, variant);
  if (spec.paint && !oldMedia) {
    const picture = media(ratio);
    link.insertBefore(picture.box, link.firstChild);
    m.canvas = picture.canvas;
  } else if (!spec.paint && oldMedia) {
    oldMedia.remove();
    m.canvas = null;
  } else if (oldMedia) oldMedia.style.aspectRatio = ratio;
  m.painted = false;
  if (m.canvas) paint(card);
  relayout();
}

function consume(card) {
  const at = cards.indexOf(card);
  if (at < 0) return;
  cards.splice(at, 1);
  if (watcher) watcher.unobserve(card);
  deactivate(card);
  if (card === suggested) suggested = null;
  card.classList.add('card-leave');
  const gone = () => {
    card.remove();
    meta.delete(card);
    relayout();
  };
  if (calm.matches) gone();
  else window.setTimeout(gone, 300);
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
      place(card);
    }
  } finally {
    busy = false;
  }
  if (sentinel && nearBottom()) more();
}

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
    const badge = Array.from(suggested.querySelectorAll('.card-badge')).find((node) => node.textContent === 'for you');
    if (badge) badge.remove();
    suggested.classList.remove('card-suggested');
  }
  suggested = target;
  if (target) {
    (target.querySelector('.card-media') || target).appendChild(el('span', 'card-badge', 'for you'));
    target.classList.add('card-suggested');
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
      const old = Array.from(card.querySelectorAll('.card-badge')).find((node) => node.textContent === 'you are here');
      if (old) old.remove();
      if (isHere) (card.querySelector('.card-media') || card).appendChild(el('span', 'card-badge', 'you are here'));
    }
  });
  window.addEventListener('persona:sky', () => {
    for (const card of cards) {
      const m = meta.get(card);
      if (!m || !(m.id && modules.has(m.id) && m.painted)) continue;
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

window.interestingFeed = { take, consume };
if (grid && WORLDS.length) start();
window.dispatchEvent(new CustomEvent('feed:ready'));
