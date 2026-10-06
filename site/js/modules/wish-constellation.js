/* The wish constellation: the persona's stars as a live sky. As a card it is the sky with a
   reading under it (paint, spark); as a piece it is that sky asked for a reading and minted as a
   postcard, a meteor shower to catch comet memos from, or the whole sky set orbiting for one
   full turn. See js/feed.js for what a module is and js/stage.js for what a piece is.

   A card and the feature it opens as are one reading: the spark puts the star it read and the line
   it gave on its spec as `of`, and the piece carries both -- the reading starts at that star, and
   the line comes back in the postcard or on the first comet. */

// The card this piece was opened from, in the sky's own terms: the star it read and the line it
// gave, or null for a piece nobody pressed (js/stage.js hands it over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  if (!was) return null;
  const star = typeof was.star === 'string' ? was.star : '';
  const line = typeof was.oracle === 'string' ? was.oracle : '';
  return star || line ? { star, line } : null;
}

const PAD = 12;

const ORACLE = [
  'Move one star and ask again.',
  'Whatever is nearest the middle is the thing to do first.',
  'The gap between the two farthest stars is the size of the next small experiment.',
  'A sky this shape wants one more star, and not where you would put it.',
  'Read it as a map, then walk the other way.',
  'The dim ones are not less true.'
];

const OPENERS = ['the sky leans toward momentum', 'the sky hums with patient energy', 'the sky suggests a turning point',
  'the sky maps a curious detour', 'the sky carries a brave undertone'];
const CLOSERS = ['follow the smallest spark and let it grow', 'name one next step and begin before overthinking',
  'protect your attention like it is lantern light', 'share a rough draft; feedback is part of flight',
  'keep play in the process and precision will follow', 'make the next move tiny, clear, and kind'];
const COMETS = ['momentum loves imperfect beginnings', 'aim for wonder, then refine', 'brave ideas arrive before permission',
  'your future self votes for this attempt', 'let play lead; precision will catch up'];
const FIRST = ['Lantern', 'Velvet', 'Copper', 'Quiet', 'Spiral', 'Silver', 'Saffron', 'Echo', 'Midnight', 'Bloom'];
const SECOND = ['Harbor', 'Engine', 'Garden', 'Signal', 'Bridge', 'Compass', 'Archive', 'Drift', 'Choir', 'Voyage'];
const COUNT = ['', 'one', 'two', 'three', 'four'];
const TIMES = ['', 'once', 'twice', 'three times', 'four times'];

const LENSES = [{ label: 'as a map', value: 'map' }, { label: 'as weather', value: 'weather' },
  { label: 'as a melody', value: 'melody' }, { label: 'as a warning', value: 'warning' }];
const SIDES = [{ label: 'from the west', value: 'w' }, { label: 'from the east', value: 'e' },
  { label: 'from the north', value: 'n' }, { label: 'from anywhere', value: 'any' }];
const SPINS = [{ label: 'sunwise', value: 1 }, { label: 'widdershins', value: -1 }, { label: 'in and out', value: 0 }];

/* ---- reading the sky ----------------------------------------------------------------------- */

function summary(stars) {
  const n = stars.length || 1;
  let cx = 0;
  let cy = 0;
  for (const s of stars) {
    cx += s.x;
    cy += s.y;
  }
  cx /= n;
  cy /= n;
  let spread = 0;
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy);
  return { cx, cy, spread: spread / n };
}

function shape(stars) {
  if (stars.length < 3) return 'barely a sky yet';
  const m = summary(stars);
  const side = m.cx < 40 ? 'leaning west' : m.cx > 60 ? 'leaning east' : 'centred';
  return (m.spread < 14 ? 'close-knit' : m.spread < 26 ? 'loosely gathered' : 'scattered wide') + ', ' + side;
}

// The postcard's name comes from the exact arrangement of the stars, as it did on the old page.
function postcardName(stars, m) {
  let h = 2166136261;
  for (const s of stars) {
    h = Math.imul(h ^ Math.round(s.x * 10), 16777619) >>> 0;
    h = Math.imul(h ^ Math.round(s.y * 10), 16777619) >>> 0;
    const t = String(s.text || '');
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  }
  const region = (m.cy < 50 ? 'North' : 'South') + (m.cx < 50 ? 'West' : 'East');
  const mood = m.spread < 12 ? 'Knot' : m.spread < 24 ? 'Field' : 'Trail';
  return FIRST[h % FIRST.length] + ' ' + (stars.length < 4 ? 'Ember' : SECOND[(h >>> 3) % SECOND.length]) + ' of the ' + region + ' ' + mood;
}

function pickN(env, list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

/* ---- drawing ------------------------------------------------------------------------------- */

function backdrop(g, w, h, c) {
  const grad = g.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 1.1);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function dustOf(rnd, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([rnd(), rnd(), 0.08 + rnd() * 0.2]);
  return out;
}

function drawDust(g, w, h, c, dust, t) {
  dust.forEach((d, i) => {
    g.fillStyle = c.alpha(c.colors.fg, d[2] * (t ? 0.7 + 0.3 * Math.sin(t * 0.9 + i) : 1));
    g.fillRect(d[0] * w, d[1] * h, 1, 1);
  });
}

function centre(list) {
  const m = { x: 0, y: 0 };
  for (const p of list) {
    m.x += p.x / list.length;
    m.y += p.y / list.length;
  }
  return m;
}

// Lines between the stars: 'map' joins each to its two nearest within reach, 'warning' joins
// every pair within reach, 'weather' rings the middle, 'melody' strings them west to east.
function links(g, w, h, c, pts, reach, mode, boost) {
  const col = c.colors;
  const R = Math.min(w, h) * reach;
  g.lineWidth = 1;
  if (mode === 'weather') {
    const m = centre(pts);
    for (let k = 1; k <= 4; k++) {
      g.strokeStyle = c.alpha(col.accent, (0.5 - k * 0.1) * boost);
      g.beginPath();
      g.arc(m.x, m.y, R * k * 0.45, 0, Math.PI * 2);
      g.stroke();
    }
    return;
  }
  if (mode === 'melody') {
    const ys = pts.map((p) => p.y);
    const top = Math.min(...ys);
    const bot = Math.max(...ys);
    g.strokeStyle = c.alpha(col.muted, 0.22 * boost);
    for (let k = 0; k < 5; k++) {
      const y = top + ((bot - top) * k) / 4;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.strokeStyle = c.alpha(col.accent, 0.6 * boost);
    g.beginPath();
    pts.slice().sort((a, b) => a.x - b.x).forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    return;
  }
  for (let i = 0; i < pts.length; i++) {
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d < R) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const n of (mode === 'warning' ? near : near.slice(0, 2))) {
      if (n.j < i) continue;
      g.strokeStyle = c.alpha(mode === 'warning' ? col.accent2 : col.accent, (0.18 + (1 - n.d / R) * 0.5) * boost);
      g.beginPath();
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[n.j].x, pts[n.j].y);
      g.stroke();
    }
  }
}

function star(g, c, p, tw, glow) {
  const tone = p.hot ? c.colors.accent2 : c.colors.accent;
  const r = 9 * tw * glow;
  const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  halo.addColorStop(0, c.alpha(tone, 0.5));
  halo.addColorStop(1, c.alpha(tone, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c.alpha(c.colors.fg, 0.95);
  g.beginPath();
  g.arc(p.x, p.y, 1.6 + 0.6 * tw, 0, Math.PI * 2);
  g.fill();
  if (p.ping > 0) {
    g.strokeStyle = c.alpha(c.colors.accent2, p.ping * 0.8);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(p.x, p.y, 6 + 16 * (1 - p.ping), 0, Math.PI * 2);
    g.stroke();
  }
}

function font(c, k, weight) {
  return (weight || 500) + ' ' + Math.max(10, Math.round(Math.min(c.w, c.h) * k)) + 'px system-ui, sans-serif';
}

// A star's thought, written beside it: to its right, unless that would run off the edge.
function label(c, p) {
  const g = c.g;
  const t = String(p.text || '');
  const text = t.length > 40 ? t.slice(0, 39) + '…' : t;
  g.font = font(c, 0.03);
  g.textBaseline = 'middle';
  const right = p.x + 10 + g.measureText(text).width > c.w - 4;
  g.textAlign = right ? 'right' : 'left';
  g.fillStyle = c.alpha(p.hot ? c.colors.accent2 : c.colors.fg, 0.8);
  g.fillText(text, p.x + (right ? -10 : 10), p.y);
}

function caption(c, text, a, y) {
  if (!text || a <= 0) return;
  const g = c.g;
  g.fillStyle = c.alpha(c.colors.fg, a);
  g.font = font(c, 0.04);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.w / 2, c.h * y);
}

// The postcard: a dark band rising from the foot of the sky with its name and its stamp.
function postcard(c, k, name, sub) {
  const g = c.g;
  const bh = c.h * 0.2;
  const y = c.h - bh * k;
  const f = Math.min(c.w, c.h);
  g.fillStyle = c.alpha(c.colors.bg, 0.78);
  g.fillRect(0, y, c.w, bh);
  g.strokeStyle = c.alpha(c.colors.accent2, 0.6 * k);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, y);
  g.lineTo(c.w, y);
  g.stroke();
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = c.alpha(c.colors.fg, k);
  g.font = font(c, 0.05, 600);
  g.fillText(name, f * 0.04, y + bh * 0.38);
  g.fillStyle = c.alpha(c.colors.muted, k);
  g.font = font(c, 0.032);
  g.fillText(sub, f * 0.04, y + bh * 0.72);
}

function meteor(c, m, tail) {
  const g = c.g;
  const len = Math.hypot(m.vx, m.vy) || 1;
  const hx = m.x * c.w;
  const hy = m.y * c.h;
  const tx = hx - (m.vx / len) * tail * c.w;
  const ty = hy - (m.vy / len) * tail * c.w;
  const grad = g.createLinearGradient(tx, ty, hx, hy);
  grad.addColorStop(0, c.alpha(c.colors.accent2, 0));
  grad.addColorStop(1, c.alpha(c.colors.accent2, 0.9));
  g.strokeStyle = grad;
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(hx, hy);
  g.stroke();
  g.fillStyle = c.colors.fg;
  g.beginPath();
  g.arc(hx, hy, 2.5, 0, Math.PI * 2);
  g.fill();
}

function ring(c, x, y, a, r) {
  c.g.strokeStyle = c.alpha(c.colors.accent2, a);
  c.g.lineWidth = 1.5;
  c.g.beginPath();
  c.g.arc(x, y, r, 0, Math.PI * 2);
  c.g.stroke();
}

// The card's sky: the stars, their nearest links, and dust -- as many motes, as far a reach between
// two stars and as large a star as the configuration the card was dealt asks for.
function sky(ctx, w, h, env, t) {
  const v = env.variant;
  backdrop(ctx, w, h, env);
  drawDust(ctx, w, h, env, dustOf(env.rnd, Math.round(40 * v.density)), 0);
  const pts = env.points(w, h, PAD);
  links(ctx, w, h, env, pts, 0.34 * v.scale, 'map', 1);
  pts.forEach((p, i) => star(ctx, env, p, t ? 0.75 + 0.25 * Math.sin(t * 1.7 + i * 1.3) : 1, v.scale));
}

/* ---- the pieces ---------------------------------------------------------------------------- */

function base(dust) {
  return { dust, t: 0, tw: 1.7, reach: 0.34, glow: 1, boost: 1, mode: 'map', flash: 0, labels: false, extra: [], warp: null, hit: null };
}

// The stars as they stand in this piece: the persona's, any caught meteors, and the piece's warp.
function pts(c, s) {
  const list = c.points(c.w, c.h, PAD).concat(s.extra.map((e) => ({ x: e.x * c.w, y: e.y * c.h, text: e.text, hot: true })));
  if (s.hit) {
    s.hit.a -= 0.05;
    if (s.hit.a <= 0) s.hit = null;
    else if (list[s.hit.i]) list[s.hit.i].ping = s.hit.a;
  }
  return s.warp ? s.warp(list, c) : list;
}

function scene(c, s, list) {
  const g = c.g;
  backdrop(g, c.w, c.h, c);
  drawDust(g, c.w, c.h, c, s.dust, c.reduced ? 0 : s.t);
  links(g, c.w, c.h, c, list, s.reach, s.mode, s.boost);
  list.forEach((p, i) => star(g, c, p, c.reduced ? 1 : 0.75 + 0.25 * Math.sin(s.t * s.tw + i * 1.3), s.glow));
  if (s.labels) list.forEach((p) => label(c, p));
  if (s.flash > 0) {
    g.fillStyle = c.alpha(c.colors.accent2, s.flash * 0.22);
    g.fillRect(0, 0, c.w, c.h);
  }
}

// Tap a star to read its thought: the nearest one answers, and pings.
function readStar(c, s, x, y) {
  const list = pts(c, s);
  let best = -1;
  let bd = Infinity;
  list.forEach((p, i) => {
    const d = Math.hypot(p.x - x * c.w, p.y - y * c.h);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) return;
  s.hit = { i: best, a: 1 };
  c.status('this one says: ' + (list[best].text || 'nothing yet'));
}

// Ask the sky: a lens to read it through, a depth to listen at, a few askings, and a stillness
// in which the reading settles into a named postcard.
function oracle(env, dust) {
  const was = pressed(env);
  const n = env.stars.length;
  const lenses = pickN(env, LENSES, 3);
  const asks = env.int(2, 4);
  const holdMs = env.pick([1200, 1600, 2000]);
  const o0 = env.int(0, OPENERS.length - 1);
  const c0 = env.int(0, CLOSERS.length - 1);
  const m = summary(env.stars);
  const name = postcardName(env.stars, m);
  const size = n < 4 ? 'faint signal' : n < 12 ? 'steady chorus' : 'bright crowd';
  const region = (m.cy < 50 ? 'northern' : 'southern') + '-' + (m.cx < 50 ? 'western' : 'eastern');
  const density = m.spread < 12 ? 'tight' : m.spread < 24 ? 'balanced' : 'wide';
  const stamp = n + ' star' + (n === 1 ? '' : 's') + ' · ' + (m.spread < 12 ? 'tight and intentional' : m.spread < 24 ? 'balanced and exploratory' : 'wide and adventurous');
  const s = base(dust);
  s.band = 0;
  // The line the card gave is the one the reading opens on, when this piece was opened from one.
  s.caption = was ? was.line : '';
  let closer = was && was.line ? was.line : CLOSERS[c0];
  return {
    title: 'ask the sky ' + TIMES[asks],
    brief: 'Choose how to read your ' + n + ' star' + (n === 1 ? '' : 's') + ' and how far to listen, ask ' + TIMES[asks] + ', then hold still while the reading settles into a postcard.'
      + (was && was.star ? ' Your card read the one that said "' + was.star + '".' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'lens', ask: 'how to read it', kind: 'choice', options: lenses },
      { id: 'depth', ask: 'how far to listen', kind: 'range', min: 0, max: 100, step: 1, value: 40, low: 'a glance', high: 'a stare' },
      { id: 'ask', ask: 'ask the sky', kind: 'press', count: asks, label: 'ask', after: 'lens' },
      { id: 'settle', ask: 'hold still while it settles', kind: 'hold', ms: holdMs, label: 'hold still', after: 'ask' }
    ],
    start(c) {
      scene(c, s, pts(c, s));
    },
    apply(id, v, c) {
      if (id === 'lens') {
        s.mode = String(v);
        c.status(s.mode === 'map' ? 'as a map: read it, then walk the other way'
          : s.mode === 'weather' ? 'as weather: rings around whatever is nearest the middle'
            : s.mode === 'melody' ? 'as a melody: ' + n + ' note' + (n === 1 ? '' : 's') + ', west to east'
              : 'as a warning: every star within reach is talking at once');
      }
      if (id === 'depth') {
        const k = Math.max(0, Math.min(1, Number(v) / 100));
        s.reach = 0.16 + k * 0.5;
        s.glow = 0.7 + k * 1.1;
        c.status(k < 0.34 ? 'a glance: only the nearest stars speak' : k < 0.67 ? 'a look: the sky gathers itself' : 'a stare: everything within reach joins in');
      }
      if (id === 'ask') {
        const k = Number(v) || 0;
        s.flash = 1;
        closer = CLOSERS[(c0 + k * 2) % CLOSERS.length];
        s.caption = closer;
        c.status(OPENERS[(o0 + k) % OPENERS.length] + '; a ' + size + ' in the ' + region + ' sky, ' + density + '. ' + closer);
      }
      if (id === 'settle') c.status('settling');
    },
    tap(x, y, c) {
      readStar(c, s, x, y);
    },
    frame(t, dt, c) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 2);
      if (c.done) {
        s.band = Math.min(1, s.band + dt * 1.5);
        s.boost = 1 + s.band * 0.5;
      }
      scene(c, s, pts(c, s));
      caption(c, s.caption, 0.85, 0.9 - s.band * 0.2);
      if (s.band > 0) postcard(c, s.band, name, stamp);
    },
    end(c) {
      c.status('minted: ' + name + '. ' + closer);
    }
  };
}

// Catch meteors: a side for them to come from, a wind, and the sky tapped to catch a few; each
// one caught lands where you tapped, carrying a comet memo, and joins the constellation.
function shower(env, dust) {
  const was = pressed(env);
  const need = env.int(2, 4);
  const sides = pickN(env, SIDES, 3);
  const memos = pickN(env, COMETS, need);
  // The first memo caught is the line the card gave: a visitor who pressed a reading catches it.
  if (was && was.line) memos[0] = was.line;
  const s = base(dust);
  s.side = sides[0].value;
  s.wind = 0.4;
  s.m = null;
  s.bursts = [];
  s.rise = 0;
  let caught = 0;
  function spawn(c) {
    const side = s.side === 'any' ? 'wen'[Math.floor(c.rnd() * 3)] : s.side;
    const m = { x: 0.15 + c.rnd() * 0.7, y: -0.1, vx: (c.rnd() - 0.5) * 0.8, vy: 1 };
    if (side !== 'n') {
      m.x = side === 'w' ? -0.1 : 1.1;
      m.y = 0.05 + c.rnd() * 0.5;
      m.vx = side === 'w' ? 1 : -1;
      m.vy = 0.3 + c.rnd() * 0.3;
    }
    s.m = m;
  }
  return {
    title: 'catch ' + COUNT[need] + ' meteors',
    brief: 'Choose where the meteors come from and how the wind blows, then tap the sky to catch ' + COUNT[need] + '; each one lands where you tap with a comet memo, and they join your stars when you are done.'
      + (was && was.line ? ' The first one carries your card\'s line.' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'from', ask: 'where they come from', kind: 'choice', options: sides },
      { id: 'wind', ask: 'the wind', kind: 'range', min: 0, max: 100, step: 1, value: 40, low: 'still', high: 'a gale' },
      { id: 'catch', ask: 'tap the sky to catch ' + COUNT[need], kind: 'tap', label: 'catch one for me', after: 'from' },
      { id: 'thoughts', ask: 'the thoughts, written out', kind: 'toggle', label: 'write them out' }
    ],
    start(c) {
      spawn(c);
      scene(c, s, pts(c, s));
    },
    apply(id, v, c) {
      if (id === 'from') {
        s.side = String(v);
        spawn(c);
        c.status('the next one comes ' + (SIDES.find((o) => o.value === s.side) || SIDES[3]).label);
      }
      if (id === 'wind') {
        s.wind = Math.max(0, Math.min(1, Number(v) / 100));
        c.status(s.wind < 0.34 ? 'still air: slow meteors, easy to catch' : s.wind < 0.67 ? 'a breeze: they streak' : 'a gale: blink and they are gone');
      }
      if (id === 'thoughts') {
        s.labels = !!v;
        c.status(v ? 'every thought, written out' : 'the thoughts kept to themselves');
      }
    },
    tap(x, y, c) {
      if (c.done) return;
      if (caught >= need || c.value('from') === undefined) {
        readStar(c, s, x, y);
        return;
      }
      const memo = memos[caught % memos.length];
      caught += 1;
      s.extra.push({ x, y, text: memo });
      s.bursts.push({ x, y, a: 1 });
      s.flash = 0.6;
      spawn(c);
      c.progress('catch', caught / need);
      c.status('caught. comet memo: ' + memo);
      if (caught >= need) c.satisfy('catch');
    },
    frame(t, dt, c) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 2);
      const m = s.m;
      if (m && !c.done) {
        const sp = (0.22 + s.wind * 0.65) * dt;
        m.x += m.vx * sp;
        m.y += m.vy * sp;
        if (m.x < -0.15 || m.x > 1.15 || m.y > 1.15) spawn(c);
      }
      s.bursts = s.bursts.filter((b) => (b.a -= dt * 1.6) > 0);
      if (c.done) {
        s.rise = Math.min(1, s.rise + dt);
        s.glow = 1 + s.rise * 0.8;
        s.boost = 1 + s.rise * 0.6;
      }
      scene(c, s, pts(c, s));
      if (m && !c.done) meteor(c, m, 0.05 + s.wind * 0.14);
      for (const b of s.bursts) ring(c, b.x * c.w, b.y * c.h, b.a, (1 - b.a) * 40);
      if (c.done) ring(c, c.w / 2, c.h / 2, (1 - s.rise) * 0.6, s.rise * Math.max(c.w, c.h) * 0.8);
    },
    end(c) {
      s.labels = true;
      c.status(COUNT[need] + ' comet memos have joined your sky');
    }
  };
}

// One full turn: a way for the stars to turn around the middle of the sky, a speed, the chime
// if you like, and the turn watched through; the stars go back to their places at the end.
function orbit(env, dust) {
  const was = pressed(env);
  const spins = pickN(env, SPINS, env.int(2, 3));
  const title = env.pick(['one full turn of the sky', 'set the sky orbiting', 'the sky, once around']);
  const s = base(dust);
  s.spin = null;
  s.ang = 0;
  s.turned = 0;
  s.speed = 0.35;
  s.chime = false;
  s.sweep = 0;
  s.home = 0;
  s.warp = (list, c) => {
    if (s.spin === null) return list;
    const m = centre(list);
    const k = s.spin === 0 ? 1 + 0.4 * Math.sin(s.ang) : 1;
    const a = s.spin * s.ang;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const back = s.home * s.home * (3 - 2 * s.home);
    return list.map((p) => {
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const x = m.x + (dx * cos - dy * sin) * k;
      const y = m.y + (dx * sin + dy * cos) * k;
      return Object.assign({}, p, { x: Math.max(PAD, Math.min(c.w - PAD, x + (p.x - x) * back)), y: Math.max(PAD, Math.min(c.h - PAD, y + (p.y - y) * back)) });
    });
  };
  return {
    title,
    brief: 'Choose which way your stars turn and how fast, ring the chime if you like, and watch one full turn; they go back to their places when it is done.'
      + (was && was.star ? ' The one your card read said "' + was.star + '"; it comes round too.' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'spin', ask: 'which way they turn', kind: 'choice', options: spins },
      { id: 'speed', ask: 'how fast', kind: 'range', min: 0, max: 100, step: 1, value: 35, low: 'a drift', high: 'a whirl' },
      { id: 'chime', ask: 'the star chime', kind: 'toggle', label: 'play the chime' },
      { id: 'turn', ask: 'one full turn', kind: 'wait', after: 'spin' }
    ],
    start(c) {
      scene(c, s, pts(c, s));
    },
    apply(id, v, c) {
      if (id === 'spin') {
        s.spin = Number(v) || 0;
        c.status(s.spin === 0 ? 'in and out: the sky breathes around its middle' : (s.spin > 0 ? 'sunwise' : 'widdershins') + ', around the middle of the sky');
      }
      if (id === 'speed') {
        s.speed = Math.max(0, Math.min(1, Number(v) / 100));
        s.tw = 1 + s.speed * 3;
        c.status(s.speed < 0.34 ? 'a drift: a slow turn' : s.speed < 0.67 ? 'a steady turn' : 'a whirl: hold on to something');
      }
      if (id === 'chime') {
        s.chime = !!v;
        c.status(v ? 'playing your constellation from west to east' : 'the chime is stopped');
      }
    },
    tap(x, y, c) {
      readStar(c, s, x, y);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (s.spin !== null && !c.done) {
        const rate = (Math.PI * 2) / (12 - s.speed * 8);
        s.ang += rate * dt;
        s.turned += rate * dt;
        c.progress('turn', Math.min(1, s.turned / (Math.PI * 2)));
        if (s.turned >= Math.PI * 2) c.satisfy('turn');
      }
      if (c.done) {
        s.home = Math.min(1, s.home + dt * 1.2);
        s.boost = 1 + s.home * 0.5;
      }
      const list = pts(c, s);
      const sx = s.sweep * c.w;
      if (s.chime) {
        s.sweep = (s.sweep + dt / 2.8) % 1;
        list.forEach((p) => {
          p.ping = Math.max(p.ping || 0, 1 - Math.abs(p.x - sx) / (c.w * 0.07));
        });
      }
      scene(c, s, list);
      if (s.chime) {
        c.g.strokeStyle = c.alpha(c.colors.accent2, 0.25);
        c.g.lineWidth = 1;
        c.g.beginPath();
        c.g.moveTo(sx, 0);
        c.g.lineTo(sx, c.h);
        c.g.stroke();
      }
    },
    end(c) {
      c.status('one turn, and the stars are back where you left them');
    }
  };
}

function piece(env) {
  if (!env.stars.length) return null;
  const dust = dustOf(env.rnd, 60);
  if (env.chance(0.36)) return oracle(env, dust);
  return env.chance(0.5) ? shower(env, dust) : orbit(env, dust);
}

export default {
  id: 'wish-constellation',
  needsSky: true,
  paint(ctx, w, h, env) {
    sky(ctx, w, h, env, 0);
  },
  animate(ctx, w, h, env, t) {
    sky(ctx, w, h, env, t + env.variant.turn * 6);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    const line = env.pick(ORACLE);
    return {
      title: 'a reading from your sky',
      quote: 'the sky says: ' + star.text,
      text: env.stars.length + ' star' + (env.stars.length === 1 ? '' : 's') + ', ' + shape(env.stars) + '. ' + line,
      aspect: '4 / 3',
      paint: (ctx, w, h, e) => sky(ctx, w, h, e, 0),
      // What this card is of, for the piece it opens as: the star it read, and the line it gave.
      of: { star: star.text, oracle: line }
    };
  },
  piece
};
