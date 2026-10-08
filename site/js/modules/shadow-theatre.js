/* The shadow theatre: paper cutouts, one lamp, and the wall they throw their shadows on. As a card
   it is the lamp's side view or the bench of cutouts with their shadows on the screen (paint,
   spark); as a piece it is one of the two puzzles below, and the card it was opened from says
   which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles:

     the lamp            Seen from the side: a cutout of a stated height stands a stated distance
                         from the wall, a lamp sits on the floor somewhere behind it, and the shadow
                         on the wall is drawn to scale and measured. Light runs straight, so the
                         shadow stands to the cutout as the lamp's distance to the wall stands to
                         its distance to the cutout: find how far behind the cutout the lamp is, and
                         say what the shadow does when something moves. The heights and distances
                         are chosen so the shadow comes out whole. A wrong check says how tall the
                         shadow would be from where the lamp was put, and whether the movement is
                         right, and no more.
     match the shadows   Four cutouts on the bench and four shadows on the screen, each a cutout
                         scaled by a stated factor and leaned sideways by the lamp, numbered in a
                         shuffled order. Say which cutout made which shadow. A wrong check says how
                         many are matched; a hint, at a price, names one.

   A card and the feature it opens as are one night at the theatre: the spark puts the whole plan on
   its spec as `of` -- the heights and distances, or the cutouts and their shadows -- and piece(env)
   opens on that rather than rolling another. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

// Paper cutouts, each one polygon in a box a unit across, y running down, standing on y = 0.5.
function starPoints() {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.2 : 0.5;
    out.push([Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100]);
  }
  return out;
}
function moonPoints() {
  const out = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    out.push([Math.round(Math.cos(a) * 0.5 * 100) / 100, Math.round(Math.sin(a) * 0.5 * 100) / 100]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    out.push([Math.round((Math.cos(a) * 0.36 - 0.14) * 100) / 100, Math.round(Math.sin(a) * 0.42 * 100) / 100]);
  }
  return out;
}
const CUTOUTS = [
  { name: 'key', points: [[-0.2, -0.5], [0.2, -0.5], [0.3, -0.3], [0.2, -0.1], [0.08, -0.1], [0.08, 0.2], [0.3, 0.2], [0.3, 0.3], [0.08, 0.3], [0.08, 0.38], [0.25, 0.38], [0.25, 0.5], [-0.08, 0.5], [-0.08, -0.1], [-0.2, -0.1], [-0.3, -0.3]] },
  { name: 'bell', points: [[-0.1, -0.5], [0.1, -0.5], [0.1, -0.4], [0.22, -0.3], [0.28, 0], [0.32, 0.25], [0.5, 0.35], [0.5, 0.42], [0.07, 0.42], [0.07, 0.5], [-0.07, 0.5], [-0.07, 0.42], [-0.5, 0.42], [-0.5, 0.35], [-0.32, 0.25], [-0.28, 0], [-0.22, -0.3], [-0.1, -0.4]] },
  { name: 'bird', points: [[-0.5, -0.1], [-0.3, 0], [-0.1, -0.15], [0.1, -0.3], [0.25, -0.35], [0.35, -0.28], [0.5, -0.22], [0.36, -0.15], [0.3, 0.05], [0.15, 0.25], [0.05, 0.5], [-0.02, 0.5], [-0.02, 0.3], [-0.25, 0.28], [-0.35, 0.2], [-0.5, 0.35], [-0.42, 0.1]] },
  { name: 'house', points: [[-0.35, 0.5], [-0.35, -0.05], [-0.5, -0.05], [0, -0.5], [0.18, -0.32], [0.18, -0.48], [0.3, -0.48], [0.3, -0.2], [0.5, -0.05], [0.35, -0.05], [0.35, 0.5]] },
  { name: 'cat', points: [[-0.3, -0.5], [-0.1, -0.3], [0.1, -0.3], [0.3, -0.5], [0.3, -0.2], [0.2, 0], [0.3, 0.2], [0.32, 0.4], [0.42, 0.3], [0.44, 0.08], [0.5, 0.1], [0.47, 0.36], [0.33, 0.5], [-0.32, 0.5], [-0.3, 0.2], [-0.2, 0], [-0.3, -0.2]] },
  { name: 'jug', points: [[-0.2, -0.5], [0.15, -0.5], [0.3, -0.42], [0.15, -0.38], [0.2, -0.1], [0.25, 0.3], [0.15, 0.5], [-0.15, 0.5], [-0.25, 0.3], [-0.2, -0.1], [-0.3, -0.12], [-0.4, 0.05], [-0.33, 0.18], [-0.45, 0.22], [-0.5, 0.05], [-0.45, -0.22], [-0.22, -0.32], [-0.15, -0.38]] },
  { name: 'boat', points: [[-0.5, 0.2], [-0.04, 0.2], [-0.04, -0.5], [0.04, -0.5], [0.04, -0.4], [0.42, 0.08], [0.04, 0.08], [0.04, 0.2], [0.5, 0.2], [0.35, 0.5], [-0.35, 0.5]] },
  { name: 'tree', points: [[0, -0.5], [0.35, 0], [0.15, 0], [0.45, 0.3], [0.08, 0.3], [0.08, 0.5], [-0.08, 0.5], [-0.08, 0.3], [-0.45, 0.3], [-0.15, 0], [-0.35, 0]] },
  { name: 'star', points: starPoints() },
  { name: 'moon', points: moonPoints() }
];

// What can move in the lamp puzzle, and what the shadow does when it does.
const MOVES = [
  { text: 'the lamp moves closer to the cutout', answer: 'grows' },
  { text: 'the lamp moves further from the cutout', answer: 'shrinks' },
  { text: 'the wall moves closer to the cutout', answer: 'shrinks' },
  { text: 'the wall moves further from the cutout', answer: 'grows' },
  { text: 'the cutout moves closer to the wall, the lamp and the wall staying put', answer: 'shrinks' },
  { text: 'the cutout moves closer to the lamp, the lamp and the wall staying put', answer: 'grows' }
];
const CHANGES = [
  { label: 'it grows', value: 'grows' },
  { label: 'it shrinks', value: 'shrinks' },
  { label: 'it stays the same', value: 'same' }
];

/* ---- shared drawing ------------------------------------------------------------------------- */

function some(env, list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

function shuffled(env, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = env.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function text(g, str, x, y, size, color, align, weight) {
  g.font = (weight || 500) + ' ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  g.fillStyle = color;
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

// The house: its dark, the lamp's glow, the folds of the backcloth and the curtain along the top.
function house(g, w, h, c, v, lampX, lampY) {
  const col = c.colors;
  const m = Math.min(w, h);
  const background = g.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, col.bg2);
  background.addColorStop(1, col.bg);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  const light = g.createRadialGradient(lampX, lampY, 0, lampX, lampY, m * 1.3);
  light.addColorStop(0, c.alpha(col.accent2, 0.28));
  light.addColorStop(1, c.alpha(col.accent2, 0));
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  const folds = Math.max(4, Math.round(9 * v.density));
  g.strokeStyle = c.alpha(col.accent, 0.12);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < folds; i++) {
    const x = w * i / folds;
    g.moveTo(x, 0);
    g.quadraticCurveTo(x - w * 0.03, h * 0.45, x, h);
  }
  g.stroke();
  const curtain = h * 0.06;
  g.fillStyle = c.mix(col.bg2, col.bg, 0.55);
  g.fillRect(0, 0, w, curtain);
  g.strokeStyle = c.alpha(col.accent2, 0.65);
  g.beginPath();
  g.moveTo(0, curtain);
  g.lineTo(w, curtain);
  g.stroke();
}

function lampDot(g, c, x, y, r) {
  const glow = g.createRadialGradient(x, y, 0, x, y, r * 4);
  glow.addColorStop(0, c.alpha(c.colors.accent2, 0.6));
  glow.addColorStop(1, c.alpha(c.colors.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  g.fillStyle = c.colors.accent2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// One cutout's polygon, transformed point by point: `map` takes [x, y] in the unit box and gives
// a point on the canvas.
function polygon(g, points, map) {
  g.beginPath();
  points.forEach((p, i) => {
    const q = map(p);
    if (i) g.lineTo(q.x, q.y);
    else g.moveTo(q.x, q.y);
  });
  g.closePath();
}

function measure(g, str, size) {
  g.font = '500 ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  return g.measureText(str).width;
}

/* ---- the lamp: a distance from similar triangles -------------------------------------------- */

function lampPlan(env) {
  const options = [];
  for (let d = 2; d <= 9; d++) {
    for (let h = 2; h <= 6; h++) {
      for (let a = 2; a <= 12; a++) {
        if ((h * a) % d) continue;
        const H = h + (h * a) / d;
        if (H > 24 || H < h + 2) continue;
        options.push({ d, h, a });
      }
    }
  }
  const o = options[env.int(0, options.length - 1)];
  return { kind: 'lamp', h: o.h, a: o.a, d: o.d, move: env.int(0, MOVES.length - 1), cut: env.int(0, CUTOUTS.length - 1) };
}

function shadowHeight(p, d) {
  return p.h * (d + p.a) / d;
}

function carriedLamp(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'lamp') return null;
  const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!whole(p.h, 2, 6) || !whole(p.a, 2, 12) || !whole(p.d, 2, 9)) return null;
  if ((p.h * p.a) % p.d !== 0 || shadowHeight(p, p.d) > 24) return null;
  if (!whole(p.move, 0, MOVES.length - 1) || !whole(p.cut, 0, CUTOUTS.length - 1)) return null;
  return { kind: 'lamp', h: p.h, a: p.a, d: p.d, move: p.move, cut: p.cut };
}

function lampTitle(p) {
  return 'the lamp: a shadow ' + spans(shadowHeight(p, p.d)) + ' tall';
}

function spans(n) {
  return (n <= 12 ? WORDS[n] : String(n)) + (n === 1 ? ' span' : ' spans');
}

// The side view: floor, wall, the cutout standing on the floor, the shadow on the wall to scale,
// the lamp off to the left behind a break in the floor (its distance is the question).
function sideView(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const H = shadowHeight(p, p.d);
  const floor = h * 0.8;
  const wallX = w * 0.86;
  const lampX = w * 0.1 + (v.turn - 0.5) * w * 0.04;
  house(g, w, h, c, v, lampX, floor);
  // Scale: the taller of the shadow and the wider of the gap decide the span in pixels.
  const unit = Math.min((floor - h * 0.14) / H, (w * 0.46) / p.a) * Math.min(1, v.scale);
  const cutX = wallX - p.a * unit;
  const fs = Math.max(9, Math.min(15, m * 0.03));
  // The wall, and the shadow on it.
  g.fillStyle = c.mix(col.bg2, col.accent2, 0.55);
  g.fillRect(wallX, h * 0.06, w - wallX, floor - h * 0.06);
  g.fillStyle = c.alpha(col.bg, 0.92);
  g.fillRect(wallX, floor - H * unit, w - wallX, H * unit);
  // The floor.
  g.fillStyle = c.mix(col.bg, col.bg2, 0.5);
  g.fillRect(0, floor, w, h - floor);
  g.strokeStyle = c.alpha(col.fg, 0.5);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, floor);
  g.lineTo(w, floor);
  g.stroke();
  // The break in the floor between the lamp and the cutout: that stretch is not drawn to scale.
  const breakX = (lampX + cutX) / 2;
  g.strokeStyle = col.bg;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(breakX - 8, floor - 8);
  g.lineTo(breakX - 2, floor + 8);
  g.lineTo(breakX + 2, floor - 8);
  g.lineTo(breakX + 8, floor + 8);
  g.stroke();
  g.strokeStyle = c.alpha(col.fg, 0.5);
  g.lineWidth = 1.5;
  g.stroke();
  // The light: the ray from the cutout's top to the shadow's top is to scale; the stretch back to
  // the lamp is not, so it is dashed.
  g.strokeStyle = c.alpha(col.accent2, 0.7);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cutX, floor - p.h * unit);
  g.lineTo(wallX, floor - H * unit);
  g.stroke();
  g.setLineDash([4, 5]);
  g.beginPath();
  g.moveTo(lampX, floor);
  g.lineTo(cutX, floor - p.h * unit);
  g.stroke();
  g.setLineDash([]);
  // The cutout, a paper figure standing on the floor, and the lamp.
  const cut = CUTOUTS[p.cut];
  polygon(g, cut.points, (q) => ({ x: cutX + q[0] * p.h * unit * 0.6, y: floor - (0.5 - q[1]) * p.h * unit }));
  g.fillStyle = c.mix(col.bg, col.accent, 0.5);
  g.fill();
  g.strokeStyle = c.alpha(col.accent2, 0.7);
  g.lineWidth = 1;
  g.stroke();
  lampDot(g, c, lampX, floor - 3, Math.max(3, m * 0.012));
  // The measurements: the cutout's height, the gap to the wall, the shadow's height, and the
  // one that is asked.
  const dim = (x1, y1, x2, y2) => {
    g.strokeStyle = c.alpha(col.fg, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      g.beginPath();
      if (y1 === y2) {
        g.moveTo(x, y - 4);
        g.lineTo(x, y + 4);
      } else {
        g.moveTo(x - 4, y);
        g.lineTo(x + 4, y);
      }
      g.stroke();
    }
  };
  dim(cutX - p.h * unit * 0.45, floor, cutX - p.h * unit * 0.45, floor - p.h * unit);
  text(g, 'h = ' + spans(p.h), cutX - p.h * unit * 0.45 - 6, floor - p.h * unit / 2, fs, col.fg, 'right', 600);
  dim(cutX, floor + h * 0.06, wallX, floor + h * 0.06);
  text(g, 'a = ' + spans(p.a), (cutX + wallX) / 2, floor + h * 0.06 + fs, fs, col.fg, 'center', 600);
  dim(wallX - 8, floor, wallX - 8, floor - H * unit);
  text(g, 'H = ' + spans(H), wallX - 14, floor - H * unit / 2, fs, col.accent2, 'right', 600);
  dim(lampX, floor + h * 0.06, cutX, floor + h * 0.06);
  text(g, 'd = ' + (s.reveal ? spans(p.d) : '?'), (lampX + cutX) / 2, floor + h * 0.06 + fs, fs, s.reveal ? col.accent2 : col.accent, 'center', 700);
  text(g, 'the wall', wallX + (w - wallX) / 2, h * 0.1, fs * 0.9, c.alpha(col.bg, 0.8), 'center', 600);
  if (s.tried != null && !s.reveal) {
    // What the wall would show with the lamp where the visitor put it, drawn faintly over the real shadow.
    const would = shadowHeight(p, s.tried);
    const top = floor - Math.min(would, 30) * unit;
    g.strokeStyle = c.alpha(col.accent, 0.9);
    g.lineWidth = 1.5;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(wallX, top);
    g.lineTo(w, top);
    g.stroke();
    g.setLineDash([]);
  }
}

function lampPreview(g, w, h, env, p) {
  sideView(g, w, h, env, p, { tried: null, reveal: false }, env.variant);
}

function lampPiece(env, p) {
  const H = shadowHeight(p, p.d);
  const move = MOVES[p.move];
  const s = { tried: null, reveal: false };
  const draw = (c) => sideView(c.g, c.w, c.h, c, p, s, env.variant);
  const tenth = (n) => String(Math.round(n * 10) / 10);
  return {
    title: lampTitle(p),
    brief: 'One lamp, lit on purpose. Seen from the side: a paper cutout ' + spans(p.h) + ' tall stands ' + spans(p.a) + ' from the wall, and a lamp on the floor somewhere behind it throws its shadow onto the wall, ' + spans(H) + ' tall. Light runs straight, so the shadow stands to the cutout as the lamp\'s distance from the wall stands to its distance from the cutout.',
    goal: 'Say how far behind the cutout the lamp stands, and what the shadow does when ' + move.text + '.',
    aspect: '16 / 10',
    checkLabel: 'light the lamp',
    steps: [
      { id: 'distance', ask: 'the lamp\'s distance behind the cutout', kind: 'number', min: 1, max: 20, step: 1, value: 1, unit: 'spans' },
      { id: 'change', ask: 'the shadow, when ' + move.text, kind: 'choice', options: CHANGES }
    ],
    solution: { distance: p.d, change: move.answer },
    check(c) {
      const d = Number(c.value('distance'));
      const distanceRight = d === p.d;
      const changeRight = c.value('change') === move.answer;
      if (distanceRight && changeRight) return { solved: true, say: 'the lamp is ' + spans(p.d) + ' behind the cutout, and the shadow ' + move.answer };
      const parts = [];
      if (!distanceRight) {
        s.tried = Number.isFinite(d) && d >= 1 ? d : null;
        parts.push(s.tried ? 'from there the shadow would stand ' + tenth(shadowHeight(p, d)) + ' spans tall, not ' + H : 'the distance is off');
      }
      parts.push(changeRight ? 'the movement is right' : 'the movement is off');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('h = ' + p.h + ', a = ' + p.a + ', H = ' + H + '; d is the question');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'distance') {
        const d = Number(value);
        c.status(Number.isFinite(d) && d >= 1 ? 'the lamp ' + spans(Math.round(d)) + ' behind the cutout; light it to see' : 'the lamp has to stand somewhere');
      }
      if (id === 'change') {
        const o = CHANGES.find((x) => x.value === value);
        if (o) c.status('when ' + move.text + ', ' + o.label + ', you say');
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('d = ' + spans(p.d) + ': ' + p.h + ' spans times ' + (p.d + p.a) + ' over ' + p.d + ' is ' + H + '. the lamp stays lit');
      draw(c);
    }
  };
}

/* ---- match the shadows ---------------------------------------------------------------------- */

function matchPlan(env) {
  const items = some(env, CUTOUTS.map((cut, i) => i), 4);
  const shadows = shuffled(env, [0, 1, 2, 3]).map((cut) => ({
    cut,
    f: env.pick([15, 20, 25]),
    k: (env.chance(0.5) ? 1 : -1) * env.int(35, 70)
  }));
  const order = shadows.map((sh) => sh.cut);
  let start = shuffled(env, order);
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, order);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return { kind: 'match', items, shadows, start };
}

function carriedMatch(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'match') return null;
  if (!Array.isArray(p.items) || p.items.length !== 4) return null;
  if (!p.items.every((i) => Number.isInteger(i) && i >= 0 && i < CUTOUTS.length) || new Set(p.items).size !== 4) return null;
  if (!Array.isArray(p.shadows) || p.shadows.length !== 4) return null;
  const okShadow = (sh) => sh && typeof sh === 'object' && Number.isInteger(sh.cut) && sh.cut >= 0 && sh.cut < 4
    && [15, 20, 25].includes(sh.f) && Number.isInteger(sh.k) && Math.abs(sh.k) >= 35 && Math.abs(sh.k) <= 70;
  if (!p.shadows.every(okShadow) || new Set(p.shadows.map((sh) => sh.cut)).size !== 4) return null;
  const shadows = p.shadows.map((sh) => ({ cut: sh.cut, f: sh.f, k: sh.k }));
  const order = shadows.map((sh) => sh.cut);
  if (!Array.isArray(p.start) || p.start.length !== 4 || !p.start.every((v) => Number.isInteger(v) && v >= 0 && v < 4) || new Set(p.start).size !== 4) return null;
  if (p.start.every((v, i) => v === order[i])) return null;
  return { kind: 'match', items: p.items.slice(), shadows, start: p.start.slice() };
}

function matchTitle(p) {
  return 'match the shadows: ' + p.items.map((i) => CUTOUTS[i].name).join(', ');
}

// The bench of cutouts along the top and the screen with their shadows along the bottom.
function bench(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const lampX = w * (0.1 + v.turn * 0.1);
  house(g, w, h, c, v, lampX, h * 0.12);
  lampDot(g, c, lampX, h * 0.12, Math.max(3, m * 0.013));
  const fs = Math.max(9, Math.min(14, m * 0.03));
  const cell = w / 4;
  const benchY = h * 0.32;
  const size = Math.min(cell * 0.62, h * 0.24) * Math.min(1, v.scale);
  // The bench: a shelf, and the four cutouts standing on it.
  g.fillStyle = c.mix(col.bg, col.bg2, 0.7);
  g.fillRect(0, benchY, w, h * 0.012);
  p.items.forEach((cut, i) => {
    const x = (i + 0.5) * cell;
    polygon(g, CUTOUTS[cut].points, (q) => ({ x: x + q[0] * size, y: benchY - (0.5 - q[1]) * size }));
    g.fillStyle = c.mix(col.bg, col.accent, 0.5);
    g.fill();
    g.strokeStyle = c.alpha(col.accent2, 0.75);
    g.lineWidth = 1;
    g.stroke();
    text(g, 'the ' + CUTOUTS[cut].name, x, benchY + h * 0.012 + fs, fs, col.fg, 'center', 600);
  });
  // The screen: lit paper, with the four shadows numbered along it.
  const screenY = h * 0.44;
  const screenH = h * 0.5;
  g.fillStyle = c.mix(col.bg2, col.accent2, 0.6);
  g.fillRect(w * 0.02, screenY, w * 0.96, screenH);
  g.strokeStyle = c.alpha(col.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(w * 0.02, screenY, w * 0.96, screenH);
  p.shadows.forEach((sh, n) => {
    const f = sh.f / 10;
    const k = sh.k / 100;
    const base = Math.min(cell * 0.22, screenH * 0.26) * Math.min(1, v.scale);
    // The shadow leans by the lamp: a point's x is pushed sideways by how high it stands.
    const map = (q) => ({ x: q[0] * f * base + (0.5 - q[1]) * k * f * base, y: -(0.5 - q[1]) * f * base });
    const pts = CUTOUTS[p.items[sh.cut]].points.map(map);
    const minX = Math.min(...pts.map((q) => q.x));
    const maxX = Math.max(...pts.map((q) => q.x));
    const minY = Math.min(...pts.map((q) => q.y));
    const maxY = Math.max(...pts.map((q) => q.y));
    const cx = (n + 0.5) * cell - (minX + maxX) / 2;
    const cy = screenY + screenH * 0.52 - (minY + maxY) / 2;
    polygon(g, CUTOUTS[p.items[sh.cut]].points, (q) => {
      const r = map(q);
      return { x: cx + r.x, y: cy + r.y };
    });
    g.fillStyle = c.alpha(col.bg, 0.9);
    g.fill();
    text(g, String(n + 1), (n + 0.5) * cell, screenY + fs * 1.1, fs * 1.1, col.bg, 'center', 700);
    text(g, 'x ' + (f % 1 ? f.toFixed(1) : f), (n + 0.5) * cell, screenY + screenH - fs, fs * 0.9, c.alpha(col.bg, 0.8), 'center', 600);
    // The visitor's matching, written under each shadow once it has been set.
    if (s.order) {
      const guess = CUTOUTS[p.items[s.order[n]]].name;
      text(g, guess, (n + 0.5) * cell, screenY + screenH + fs * 0.9, fs * 0.9, s.reveal && s.order[n] === sh.cut ? col.accent2 : col.fg, 'center', 600);
    }
    if (s.hinted.includes(n)) {
      g.strokeStyle = c.alpha(col.accent, 0.95);
      g.lineWidth = 2;
      g.setLineDash([4, 4]);
      g.strokeRect((n + 0.06) * cell, screenY + 3, cell * 0.88, screenH - 6);
      g.setLineDash([]);
    }
  });
}

function matchPreview(g, w, h, env, p) {
  bench(g, w, h, env, p, { order: null, hinted: [], reveal: false }, env.variant);
}

function matchPiece(env, p) {
  const names = p.items.map((i) => CUTOUTS[i].name);
  const solution = p.shadows.map((sh) => sh.cut);
  const s = { order: p.start.slice(), hinted: [], reveal: false };
  const draw = (c) => bench(c.g, c.w, c.h, c, p, s, env.variant);
  function matched() {
    let n = 0;
    for (let i = 0; i < 4; i++) if (s.order[i] === solution[i]) n += 1;
    return n;
  }
  return {
    title: matchTitle(p),
    brief: 'The lamp is lit and the screen is read. Four paper cutouts stand on the bench and the lamp throws four shadows on the screen, each a cutout made larger by the factor written under it and leaned sideways by the lamp. The shadows are numbered in no particular order.',
    goal: 'Say which cutout made shadow 1, 2, 3 and 4.',
    aspect: '4 / 3',
    checkLabel: 'check the screen',
    steps: [
      { id: 'order', ask: 'the cutouts, in the order of the shadows they made', kind: 'order', items: p.items.map((cut, at) => ({ label: 'the ' + CUTOUTS[cut].name, value: at })), value: p.start.slice() },
      { id: 'hint', ask: 'one shadow named', kind: 'press', count: 1, label: 'name one', optional: true }
    ],
    solution: { order: solution },
    check(c) {
      const n = matched();
      return {
        solved: n === 4,
        say: n === 4 ? 'every shadow has its cutout' : (n === 0 ? 'no shadow has its cutout yet' : WORDS[n] + ' of four shadows ' + (n === 1 ? 'has' : 'have') + ' the right cutout')
      };
    },
    start(c) {
      c.status('four cutouts, four shadows, in no particular order');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === 4) {
        s.order = value.map(Number);
        c.status('shadows 1 to 4: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'hint') {
        const next = [0, 1, 2, 3].find((n) => !s.hinted.includes(n) && s.order[n] !== solution[n]);
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('shadow ' + (next + 1) + ' was cast by the ' + names[solution[next]]);
        } else {
          c.status('every shadow you have matched wrongly has been named; the rest is yours');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('shadows 1 to 4: ' + solution.map((i) => names[i]).join(', ') + '. the lamp stays lit');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsLamp(env) {
  return env.chance(0.5);
}

export default {
  id: 'shadow-theatre',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsLamp(env)) lampPreview(g, w, h, env, lampPlan(env));
    else matchPreview(g, w, h, env, matchPlan(env));
  },
  spark(env) {
    if (dealsLamp(env)) {
      const p = lampPlan(env);
      return {
        title: lampTitle(p),
        mono: 'h = ' + p.h + ' / a = ' + p.a + ' / H = ' + shadowHeight(p, p.d) + ' / d = ?',
        text: 'A cutout ' + spans(p.h) + ' tall, ' + spans(p.a) + ' from the wall, and a lamp on the floor somewhere behind it. The shadow is ' + spans(shadowHeight(p, p.d)) + ' tall. How far back is the lamp?',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => lampPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = matchPlan(env);
    return {
      title: matchTitle(p),
      text: 'Four cutouts on the bench, four shadows on the screen, each grown and leaned by the lamp. Say which made which.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => matchPreview(g, w, h, cardEnv, p),
      of: p
    };
  },
  piece(env) {
    const lamp = carriedLamp(env);
    if (lamp) return lampPiece(env, lamp);
    const match = carriedMatch(env);
    if (match) return matchPiece(env, match);
    return dealsLamp(env) ? lampPiece(env, lampPlan(env)) : matchPiece(env, matchPlan(env));
  }
};
