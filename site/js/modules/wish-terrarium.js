/* The terrarium: plants under glass, grown from the persona's stars, and two puzzles kept there.
   As a card it is the puzzle the seed deals, drawn small through the glass (paint, spark); as a
   piece it is one of the two puzzles below, and the card it was opened from says which. See
   js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction:

     who gets water   Five or six plants in a row, each tagged with one rule -- soil below 3, lamp
                      off, not twice running, if the left one is, vent open and soil below 4 --
                      and the glass shows the readings every rule is judged by: a soil meter under
                      each plant, the lamp, the vent, and a drop beside any plant watered last
                      time. Mark the plants that get water. A wrong check says how many of the
                      right plants are marked and how many marked should stay dry, and no more.
     the oldest stem  Four stems, each tagged with how many leaves it grows in a week, each with
                      its leaves drawn and counted. Age is leaves over rate, and the ages are
                      whole weeks, all different. Put the stems oldest to youngest and say how old
                      the oldest is.

   The brief and answer labels repeat the drawn readings, so neither puzzle depends on seeing
   the canvas.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the rules and readings, or the rates and leaf counts -- and piece(env) opens on that
   rather than rolling another. The sky may be one star or many; it lights the glass, and the plan
   stands whatever the sky is now. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const LETTERS = ['A', 'B', 'C', 'D'];
const RANKS = ['oldest', 'second', 'third', 'youngest'];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
const RULES = {
  soil: { tag: 'soil below 3', rule: 'water it if its soil reads below 3' },
  lamp: { tag: 'lamp off', rule: 'water it only while the lamp is off' },
  twice: { tag: 'not twice running', rule: 'never water it two visits running, so not if it was watered last time' },
  left: { tag: 'if the left one is', rule: 'water it if the plant to its left is watered' },
  vent: { tag: 'vent open, soil below 4', rule: 'water it if the vent is open and its soil reads below 4' }
};
const RULE_IDS = ['soil', 'lamp', 'twice', 'left', 'vent'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/* How hard the visitor asked for their puzzles. The persona keeps one difficulty for the whole
   site (js/persona.js) and js/stage.js hands it to a piece on env.difficulty, 1 (gentle) to 5
   (fierce); a card's env carries none, so the middle of the dial stands in. A level buys `helps`
   -- how many things a piece will show when it is asked -- and `margin`, how far out a measured
   answer may be and still count. Read inside piece() only: the subject is the seed's. */
function asked(env) {
  const said = env && env.difficulty ? Number(env.difficulty.level) : NaN;
  const level = Number.isFinite(said) ? Math.max(1, Math.min(5, Math.round(said))) : 3;
  return { level, helps: 6 - level, margin: Math.max(0, 3 - level) };
}

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): one edge, a slice at an angle or a curve round a corner, which is the
   piece's signature, and the few treads every change climbs, always forward. Nothing under this
   glass moves along a formula, and nothing moves without a reason:

     the breeze      comes through the vent, and only while it is open: a gust bows each stem away
                     from the vent in a few treads and stands it up again in a few more, reaching
                     the stem nearest the vent first. With the vent shut -- or in the stems'
                     puzzle, which has none -- the air is still, and so are the stems.
     a marked plant  changes by its area: the air over its bed and the wet ground at its foot are
                     cut in behind the piece's edge as its stair climbs, its stem thickens on the
                     same stair and its drops come one to a tread; unmarked, all of it goes back
                     the way it came.
     a moved stem    has the air over its bed cut in behind the edge and taken back the way it
                     came, and its new rank cut on at its moment (rite.flicker: off, then on for
                     good). A hint is cut on the same way.
     a solved glass  blooms on each stem's own stair, left to right or oldest to youngest, and
                     the fog comes over it behind the piece's edge, densest at the top pane; once
                     it is there its drips run down the glass, each in treads of its own, and stay.

   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion, and for whatever stood there from the start (since < 0). Each stem and drip steps on a
   roll of its own (rite.at, the same edge with its own treads), so no two step together. */

// The rite when an env carries none: every change already made, the air still, and a surface that
// is there at all is there whole.
const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 1, flicker: () => 1, series: (t, n) => n || 1,
  matte: () => true, treads: 1, kind: 'slice', angle: 90, origin: [0, 1],
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w, h);
  },
  paint(g, x, y, w, h, k, style) {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w, h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The rite rolled afresh for one thing this module moves, kept with the rite it was rolled from so
// a frame rolls each one once rather than thirty times a second.
const OWN = new WeakMap();
function own(rite, n) {
  let kept = OWN.get(rite);
  if (!kept) {
    kept = new Map();
    OWN.set(rite, kept);
  }
  let r = kept.get(n);
  if (!r) {
    r = rite.at(n);
    kept.set(n, r);
  }
  return r;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

function fract(x) {
  return x - Math.floor(x);
}

// The breeze through an open vent, as it leans a stem standing `far` of the glass's width from the
// vent: a gust every GUST seconds, the stem bowing away in a few treads and standing up again in a
// few more, and reaching a stem later the farther it stands from the vent, as a breeze would. 0 is
// upright and 1 the gust's full lean; with no rite to step by, the air is still.
const GUST = 6;
function gust(rite, t, far) {
  if (rite === STILL) return 0;
  const phase = fract(t / GUST - far * 0.3);
  return phase < 0.5 ? rite.stair(phase * 2) : 1 - rite.stair((phase - 0.5) * 2);
}

// A pulse: a highlight cut in up the stair and taken back down it, the way it came, within one
// play -- two forward movements, with the stair's hold between them.
function pulse(rite, p) {
  return p >= 1 ? 0 : p < 0.5 ? rite.stair(p * 2) : 1 - rite.stair((p - 0.5) * 2);
}

// How far a thing that is `on` has come up its stair since onAt, or back down it since offAt.
function level(rite, s, on, onAt, offAt, span, reduced) {
  if (on) return rite.stair(came(s, onAt, span, reduced));
  if (offAt == null || offAt < 0) return 0;
  return 1 - rite.stair(came(s, offAt, span, reduced));
}

/* ---- drawing shared by both ---------------------------------------------------------------- */

function write(g, text, x, y, size, align, tone, weight) {
  g.fillStyle = tone;
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function wrap(g, text, max) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && g.measureText(test).width > max) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// The air in the glasshouse: brighter under a lamp that is on, dappled by the configuration, with
// the stars as they stand shining faintly through the top panes, and the soil along the bottom.
// Each dapple drifts on a swing of its own: a lean in treads one way, then the other.
function glass(g, w, h, env, v, lit, t, rite) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, lit ? env.mix(c.bg2, c.fg, 0.16) : c.bg2);
  grad.addColorStop(1, env.mix(c.bg, c.accent, lit ? 0.04 : 0.09));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (lit) {
    const shaft = g.createRadialGradient(w / 2, h * 0.07, 0, w / 2, h * 0.07, h * 0.9);
    shaft.addColorStop(0, env.alpha(c.accent2, 0.16));
    shaft.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = shaft;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = env.alpha(c.fg, 0.4);
  for (const p of env.points(w, h, 10)) {
    g.beginPath();
    g.arc(p.x, 4 + p.y * 0.22, 1.2 * v.scale, 0, TAU);
    g.fill();
  }
  const n = Math.max(3, Math.round(7 * v.density));
  for (let i = 0; i < n; i++) {
    const drift = swing(own(rite, 0xda + i), t || 0, 6 + (i % 3) * 1.5, i * 0.17) * 0.02;
    const x = ((i * 0.618 + 0.1 + v.turn * 0.23 + drift + 1) % 1) * w;
    const y = ((i * 0.38 + 0.05 + v.turn * 0.1) % 1) * h * 0.55;
    const r = Math.min(w, h) * (0.07 + (i % 3) * 0.03) * v.scale;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, env.alpha(c.accent2, 0.09));
    d.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = d;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const soilY = h * 0.64;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, soilY, w, h - soilY);
  const grit = Math.round(40 * v.density);
  for (let i = 0; i < grit; i++) {
    g.fillStyle = env.alpha(c.accent2, 0.1 + ((i * 7) % 5) * 0.03);
    g.fillRect(((i * 0.618034 + v.turn * 0.5) % 1) * w, soilY + ((i * 0.754877) % 1) * (h - soilY), 1.5, 1.5);
  }
}

// The glass itself: fog and its drips, the frame and glazing bars, and a shine. The fog is
// { k, depth, on }: it develops through the matte to coverage k, densest at the top pane and
// thinnest at the soil, `depth` deep, and is not there at all while `on` is false (the flicker of
// its arrival); its drips creep down the glass in treads.
function pane(g, w, h, env, fog, t, rite) {
  const c = env.colors;
  if (fog && fog.on && fog.k > 0) {
    g.fillStyle = env.alpha(c.fg, 0.2 * fog.depth);
    develop(g, rite, 0, 0, w, h, (px, py) => fog.k * (1 - 0.75 * py / h), null, 40);
    g.strokeStyle = env.alpha(c.fg, 0.35 * fog.depth);
    g.lineWidth = 1.2;
    const n = Math.round(fog.k * fog.depth * 9);
    for (let i = 0; i < n; i++) {
      const drip = own(rite, 0xd0 + i);
      const x = ((i * 0.618034 + 0.07) % 1) * w;
      const y = drip.stair(fract(t * (0.03 + (i % 3) * 0.02) + i * 0.37), 12) * h * 0.7;
      g.beginPath();
      g.moveTo(x, Math.max(0, y - 18 * fog.depth));
      g.lineTo(x, y);
      g.stroke();
    }
  }
  g.strokeStyle = env.alpha(c.fg, 0.35);
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  g.lineWidth = 1;
  g.strokeStyle = env.alpha(c.fg, 0.18);
  g.beginPath();
  for (let x = w / 3; x < w - 1; x += w / 3) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  g.moveTo(0, h * 0.3);
  g.lineTo(w, h * 0.3);
  g.stroke();
  const shine = g.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, env.alpha(c.fg, 0.08));
  shine.addColorStop(0.5, env.alpha(c.fg, 0));
  g.fillStyle = shine;
  g.fillRect(0, 0, w, h);
}

// One stem, `height` tall, with exactly `leaves` leaves along it, leaning with the breeze: a swing
// on the stem's own rite, the tip a few treads behind the foot. `glow` is how far up its stair the
// stem's marking has come (its stroke and its leaves thicken in those treads) and `bloom` how far
// its flower has opened; the petals turn in the ratchet's clicks. Returns where its tip is.
function stem(g, env, x, soilY, height, leaves, t, k, phase, bend, glow, bloom, rite) {
  const c = env.colors;
  const seg = 8;
  const pts = [];
  for (let j = 0; j <= seg; j++) {
    const r = j / seg;
    const lean = swing(rite, t, 5.5, phase / TAU + r * 0.08);
    const sway = lean * bend * r * 7 * k + Math.sin(r * 3 + phase) * bend * 5 * k * r;
    pts.push([x + sway, soilY - r * height]);
  }
  const at = (r) => {
    const j = Math.min(seg - 1, Math.floor(r * seg));
    const f = r * seg - j;
    return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
  };
  g.strokeStyle = env.alpha(c.accent, 0.6 + glow * 0.35);
  g.lineWidth = (1.4 + glow * 0.8) * k;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  g.stroke();
  const size = clamp((0.8 * height) / Math.max(1, leaves) * 0.55, 1.6 * k, 5 * k);
  g.fillStyle = env.alpha(c.accent, 0.4 + glow * 0.35);
  for (let i = 0; i < leaves; i++) {
    const p = at(0.1 + (0.82 * (i + 0.5)) / leaves);
    const dir = i % 2 ? -1 : 1;
    g.beginPath();
    g.ellipse(p[0] + dir * size * 1.2, p[1], size * 1.5, size * 0.65, dir * 0.5, 0, TAU);
    g.fill();
  }
  const tip = pts[seg];
  g.fillStyle = env.alpha(c.accent2, 0.2 + glow * 0.3 + bloom * 0.15);
  g.beginPath();
  g.arc(tip[0], tip[1], (3.5 + glow * 4 + bloom * 6) * k, 0, TAU);
  g.fill();
  if (bloom > 0.02) {
    const br = 4.5 * k * bloom;
    // Five petals: a click round of one petal's width lands the flower on itself.
    const turned = rite.ratchet(fract(t / 4.5)) * TAU / 5;
    g.fillStyle = env.alpha(c.accent2, 0.85 * bloom);
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU + turned;
      g.beginPath();
      g.ellipse(tip[0] + Math.cos(a) * br, tip[1] + Math.sin(a) * br, br, br * 0.55, a, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = env.alpha(c.fg, 0.95);
  g.beginPath();
  g.arc(tip[0], tip[1], (1.6 + bloom * 1.5) * k, 0, TAU);
  g.fill();
  return tip;
}

// A small drop, point down.
function drop(g, env, x, y, k, a) {
  g.fillStyle = env.alpha(env.colors.fg, a);
  g.beginPath();
  g.moveTo(x, y - 4 * k);
  g.quadraticCurveTo(x + 3.2 * k, y + 1.5 * k, x, y + 3.5 * k);
  g.quadraticCurveTo(x - 3.2 * k, y + 1.5 * k, x, y - 4 * k);
  g.fill();
}

// A lettered or numbered marker at the foot of a stem.
function badge(g, env, x, y, text, k, size) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.bg, 0.9);
  g.strokeStyle = env.alpha(c.accent, 0.9);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, 6.5 * k, 0, TAU);
  g.fill();
  g.stroke();
  write(g, text, x, y + 0.5, size, 'center', c.fg, '600');
}

// The air about one plant, `k` of the way to being lit: the column over its bed fills cell by cell
// through the matte, from the soil up to the top of the glass.
function column(g, env, rite, x0, top, width, bottom, k, tone) {
  if (k <= 0) return;
  g.fillStyle = tone;
  develop(g, rite, x0, top, width, bottom - top, k, null, 14);
}

// The wet ground at a plant's foot, `k` of the way to being there: the cells of an ellipse.
function wet(g, env, rite, x, y, rx, ry, k) {
  if (k <= 0) return;
  g.fillStyle = env.alpha(env.colors.accent2, 0.55);
  develop(g, rite, x - rx, y - ry, rx * 2, ry * 2, k,
    (px, py) => ((px - x) * (px - x)) / (rx * rx) + ((py - y) * (py - y)) / (ry * ry) <= 1, 16);
}

// The stroke scale and the small type size everything under the glass is drawn at.
function metrics(w, h, v) {
  return {
    k: clamp(Math.min(w, h) / 340, 0.6, 1.8) * v.scale,
    small: Math.max(8, Math.min(12, Math.round(Math.min(w, h) * 0.032)))
  };
}

function shuffled(env, n) {
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(i);
  const out = [];
  while (rest.length) out.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  return out;
}

function startFor(env, order) {
  const n = order.length;
  let start = order.slice();
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, n);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return start;
}

/* ---- who gets water ------------------------------------------------------------------------ */

// Which plants the rules give water, judged left to right, so "if the left one is" has an answer.
function watered(plan) {
  const out = [];
  for (let i = 0; i < plan.n; i++) {
    const r = plan.rules[i];
    let yes = false;
    if (r === 'soil') yes = plan.soil[i] < 3;
    else if (r === 'lamp') yes = !plan.lamp;
    else if (r === 'twice') yes = !plan.last[i];
    else if (r === 'left') yes = i > 0 && out[i - 1];
    else if (r === 'vent') yes = !!plan.vent && plan.soil[i] < 4;
    out.push(yes);
  }
  return out;
}

function waterOk(p) {
  const n = Number(p && p.n);
  if (n !== 5 && n !== 6) return false;
  const list = (v, ok) => Array.isArray(v) && v.length === n && v.every(ok);
  if (!list(p.rules, (r, i) => RULE_IDS.includes(r) && !(i === 0 && r === 'left'))) return false;
  if (!list(p.soil, (v) => Number.isInteger(v) && v >= 1 && v <= 5)) return false;
  if (!list(p.last, (v) => v === 0 || v === 1)) return false;
  if ((p.lamp !== 0 && p.lamp !== 1) || (p.vent !== 0 && p.vent !== 1)) return false;
  const count = watered(p).filter(Boolean).length;
  return count >= 1 && count < n;
}

function waterPlan(env) {
  const n = env.chance(0.5) ? 6 : 5;
  for (let guard = 0; guard < 80; guard++) {
    const rules = [];
    const soil = [];
    const last = [];
    for (let i = 0; i < n; i++) {
      rules.push(env.pick(i === 0 ? RULE_IDS.filter((r) => r !== 'left') : RULE_IDS));
      soil.push(env.int(1, 5));
      last.push(env.chance(0.45) ? 1 : 0);
    }
    const plan = { kind: 'water', n, rules, soil, last, lamp: env.chance(0.5) ? 1 : 0, vent: env.chance(0.5) ? 1 : 0 };
    if (new Set(rules).size >= 3 && waterOk(plan)) return plan;
  }
  return { kind: 'water', n: 5, rules: ['soil', 'lamp', 'left', 'twice', 'vent'], soil: [2, 4, 3, 1, 3], last: [0, 1, 0, 1, 0], lamp: 1, vent: 1 };
}

function carriedWater(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'water' || !waterOk(p)) return null;
  return { kind: 'water', n: p.n, rules: p.rules.slice(), soil: p.soil.slice(), last: p.last.slice(), lamp: p.lamp, vent: p.vent };
}

function waterTitle(plan) {
  return 'who gets water: ' + WORDS[plan.n] + ' plants';
}

function waterGeometry(w, h, n) {
  const span = w * 0.9;
  return { left: (w - span) / 2, cell: span / n, soilY: h * 0.64 };
}

// The state the water puzzle is drawn from. Every moment is on the piece's own clock, and -1 is
// "from the start" (so a preview, and a plant never marked, stand still).
function waterState(n, t) {
  return {
    chosen: [], hinted: [], hintAt: new Array(n).fill(-1),
    markAt: new Array(n).fill(-1), unmarkAt: new Array(n).fill(-1),
    doneAt: -1, t
  };
}

function drawWater(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const n = plan.n;
  const geo = waterGeometry(w, h, n);
  const { k, small } = metrics(w, h, v);
  const tiny = Math.max(7, Math.min(11, Math.round(geo.cell * 0.16)));
  const doneP = s.doneAt >= 0 ? came(s, s.doneAt, 2.4, reduced) : 0;
  glass(g, w, h, env, v, !!plan.lamp, s.t, rite);
  // The lamp, on its cord, and the vent in the top corner.
  const lx = w * 0.5;
  const ly = h * 0.075;
  g.strokeStyle = env.alpha(c.muted, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(lx, 0);
  g.lineTo(lx, ly - 7 * k);
  g.stroke();
  if (plan.lamp) {
    const halo = g.createRadialGradient(lx, ly, 0, lx, ly, 30 * k);
    halo.addColorStop(0, env.alpha(c.accent2, 0.55));
    halo.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(lx - 30 * k, ly - 30 * k, 60 * k, 60 * k);
    g.fillStyle = c.accent2;
  } else {
    g.fillStyle = env.alpha(c.muted, 0.25);
  }
  g.beginPath();
  g.arc(lx, ly, 7 * k, 0, TAU);
  g.fill();
  g.strokeStyle = env.alpha(c.fg, 0.6);
  g.stroke();
  write(g, 'lamp ' + (plan.lamp ? 'on' : 'off'), lx + 12 * k, ly, small, 'left', env.alpha(c.fg, 0.9));
  const vx = w * 0.9;
  const vy = h * 0.075;
  g.strokeStyle = env.alpha(c.fg, 0.7);
  g.strokeRect(vx - 11 * k, vy - 7 * k, 22 * k, 14 * k);
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = vy - 4 * k + i * 4 * k;
    g.moveTo(vx - 8 * k, plan.vent ? y + 2 * k : y);
    g.lineTo(vx + 8 * k, plan.vent ? y - 2 * k : y);
  }
  g.stroke();
  write(g, 'vent ' + (plan.vent ? 'open' : 'shut'), vx - 14 * k, vy, small, 'right', env.alpha(c.fg, 0.9));
  // The plants, each with its number, its meter, its mark and its tag. A marked plant is a
  // surface that develops: the air over its bed, the wet ground at its foot, its drops and its
  // glow all come up the stem's own stair from the moment it was marked, and go back down it from
  // the moment it was unmarked.
  const got = watered(plan);
  for (let i = 0; i < n; i++) {
    const x = geo.left + (i + 0.5) * geo.cell;
    const mine = own(rite, 0x5e + i);
    const height = (geo.soilY - h * 0.16) * (0.55 + 0.09 * ((i * 3 + plan.soil[i]) % 5));
    const leaves = 4 + ((i * 5 + plan.soil[i]) % 4);
    const chosen = s.chosen.includes(i);
    const mark = level(mine, s, chosen, s.markAt[i], s.unmarkAt[i], 0.9, reduced);
    column(g, env, mine, x - geo.cell * 0.46, h * 0.12, geo.cell * 0.92, geo.soilY, mark, env.alpha(c.accent2, 0.11));
    wet(g, env, mine, x, geo.soilY, 12 * k, 4 * k, mark);
    const bp = s.doneAt >= 0 && got[i] ? came(s, s.doneAt + i * 0.22, 1.2, reduced) : 0;
    const bloom = bp > 0 && mine.flicker(bp) ? mine.stair(bp) : 0;
    const tip = stem(g, env, x, geo.soilY, height, leaves, s.t, k, i * 1.3 + v.turn * TAU, 0.5 + (i % 3) * 0.3, mark * 0.7, bloom, mine);
    const drops = Math.round(mark * 3);
    for (let j = 0; j < drops; j++) {
      const fall = own(rite, 0xd20 + i * 4 + j).stair(fract(s.t * 0.55 + j * 0.39 + i * 0.28), 9);
      drop(g, env, x + (j - 1) * 5 * k, tip[1] - (14 + fall * 18) * k, k * 0.8, 0.8);
    }
    if (s.hinted.includes(i) && own(rite, 0x41 + i).flicker(came(s, s.hintAt[i], 1, reduced))) {
      write(g, got[i] ? 'water it' : 'leave it dry', x, tip[1] - 12 * k, small, 'center', c.accent2, '600');
    }
    badge(g, env, x, geo.soilY, String(i + 1), k, small);
    const my = geo.soilY + h * 0.065;
    const bw = Math.min(geo.cell * 0.11, 9 * k);
    const gap = bw * 0.3;
    const x0 = x - (5 * bw + 4 * gap) / 2;
    for (let j = 0; j < 5; j++) {
      g.fillStyle = j < plan.soil[i] ? c.accent2 : env.alpha(c.muted, 0.25);
      g.fillRect(x0 + j * (bw + gap), my - bw / 2, bw, bw);
    }
    write(g, 'soil ' + plan.soil[i], x, my + bw * 0.5 + tiny * 0.8, tiny, 'center', env.alpha(c.fg, 0.9));
    if (plan.last[i]) {
      drop(g, env, x - tiny * 1.6, geo.soilY + h * 0.165, k * 0.9, 0.9);
      write(g, 'last time', x - tiny * 0.9, geo.soilY + h * 0.165, tiny, 'left', env.alpha(c.fg, 0.8));
    }
    g.font = '500 ' + tiny + 'px system-ui, sans-serif';
    const lines = [];
    for (const part of RULES[plan.rules[i]].tag.split(', ')) for (const line of wrap(g, part, geo.cell * 0.95)) lines.push(line);
    lines.forEach((line, j) => write(g, line, x, geo.soilY + h * 0.225 + j * tiny * 1.25, tiny, 'center', env.alpha(c.accent2, 0.95)));
  }
  pane(g, w, h, env, doneP > 0 ? { k: rite.stair(doneP), depth: 1, on: !!rite.flicker(doneP) } : null, s.t, rite);
}

function waterPreview(g, w, h, env, plan, t) {
  drawWater(g, w, h, env, plan, waterState(plan.n, t || 0), env.variant);
}

function waterPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.n;
  const got = watered(plan);
  const answer = [];
  for (let i = 0; i < n; i++) if (got[i]) answer.push(i);
  const s = waterState(n, (env.variant || PLAIN).turn * 5);
  const draw = (c) => drawWater(c.g, c.w, c.h, c, plan, s, env.variant);
  const kinds = RULE_IDS.filter((r) => plan.rules.includes(r));
  function chosenNow(c) {
    const v = c.value('water');
    return Array.isArray(v) ? v.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n) : s.chosen;
  }
  // The marking moves to `next`, and every plant whose state changed has its moment noted, so its
  // surface develops (or unmakes) from now.
  function take(next) {
    for (let i = 0; i < n; i++) {
      const was = s.chosen.includes(i);
      const now = next.includes(i);
      if (now && !was) s.markAt[i] = s.t;
      if (was && !now) s.unmarkAt[i] = s.t;
    }
    s.chosen = next;
  }
  return {
    title: waterTitle(plan),
    brief: capital(WORDS[n]) + ' plants wait under glass at midnight, each tagged with one rule. The lamp is ' + (plan.lamp ? 'on' : 'off') + ' and the vent is ' + (plan.vent ? 'open' : 'shut') + '. Each plant has a soil reading; a drop marks one watered last time. The tags: '
      + kinds.map((r) => RULES[r].tag + ' (' + RULES[r].rule + ')').join('; ') + '. Judge them left to right.',
    goal: 'Mark every plant that gets water, and none that stays dry.',
    aspect: '16 / 10',
    checkLabel: 'check the plants',
    steps: [
      { id: 'water', ask: 'the plants to water: tap them under the glass, or mark them here', kind: 'pick', items: plan.rules.map((r, i) => ({ label: 'plant ' + (i + 1) + ' (' + RULES[r].tag + '); soil ' + plan.soil[i] + (plan.last[i] ? '; watered last time' : '; not watered last time'), value: i })) },
      { id: 'hint', ask: 'one plant judged', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { water: answer },
    check(c) {
      const chosen = chosenNow(c);
      const right = answer.filter((i) => chosen.includes(i)).length;
      const dry = chosen.filter((i) => !got[i]).length;
      const solved = chosen.length === answer.length && right === answer.length && dry === 0;
      let say;
      if (solved) say = 'the round is kept: ' + (answer.length === 1 ? 'one plant drinks' : WORDS[answer.length] + ' plants drink') + ', and the rest stay dry';
      else if (!right) say = 'none of the right plants is marked yet' + (dry ? ', and ' + WORDS[dry] + ' marked that should stay dry' : '');
      else say = WORDS[right] + ' of the right plants marked' + (dry ? ', and ' + WORDS[dry] + ' marked that should stay dry' : '');
      return { solved, say };
    },
    start(c) {
      c.status('tap a plant to mark it for water');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'water' && Array.isArray(value)) {
        take(value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n).sort((a, b) => a - b));
        c.status(s.chosen.length ? 'marked: ' + s.chosen.map((i) => 'plant ' + (i + 1)).join(', ') : 'nothing marked');
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.rules.map((r, i) => i).find((i) => !s.hinted.includes(i) && s.chosen.includes(i) !== got[i])
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('plant ' + (next + 1) + (got[next] ? ' gets water' : ' stays dry'));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the glass will show at this difficulty; the rest is yours');
        } else {
          c.status('every plant you have judged wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = waterGeometry(c.w, c.h, n);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= n) {
        c.status('no plant there; tap a plant to mark it for water');
        return;
      }
      const next = s.chosen.includes(col) ? s.chosen.filter((i) => i !== col) : s.chosen.concat([col]).sort((a, b) => a - b);
      take(next);
      c.set('water', next.slice());
      c.status('plant ' + (col + 1) + (next.includes(col) ? ' marked for water' : ' left dry'));
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      c.status('watered: ' + answer.map((i) => 'plant ' + (i + 1)).join(', ') + '; the glass fogs over and the rest stay dry');
    }
  };
}

/* ---- the oldest stem ----------------------------------------------------------------------- */

function ages(plan) {
  return plan.leaves.map((l, i) => l / plan.rates[i]);
}

function ageOrder(plan) {
  const a = ages(plan);
  return [0, 1, 2, 3].sort((p, q) => a[q] - a[p]);
}

function ageOk(p) {
  if (!p || p.kind !== 'age') return false;
  const list = (v, ok) => Array.isArray(v) && v.length === 4 && v.every(ok);
  if (!list(p.rates, (r) => Number.isInteger(r) && r >= 1 && r <= 4)) return false;
  if (!list(p.leaves, (l, i) => Number.isInteger(l) && l >= 3 && l <= 24 && l % p.rates[i] === 0)) return false;
  const a = ages(p);
  if (new Set(a).size !== 4) return false;
  const order = ageOrder(p);
  const byLeaves = [0, 1, 2, 3].sort((x, y) => p.leaves[y] - p.leaves[x]);
  if (order.every((v, i) => v === byLeaves[i])) return false;
  return list(p.start, (v) => Number.isInteger(v) && v >= 0 && v < 4) && new Set(p.start).size === 4 && !p.start.every((v, i) => v === order[i]);
}

function agePlan(env) {
  for (let guard = 0; guard < 80; guard++) {
    const rates = [];
    const leaves = [];
    for (let i = 0; i < 4; i++) {
      const r = env.int(1, 4);
      rates.push(r);
      leaves.push(r * env.int(Math.ceil(3 / r), Math.floor(24 / r)));
    }
    const plan = { kind: 'age', rates, leaves, start: [0, 1, 2, 3] };
    if (new Set(ages(plan)).size !== 4 || Math.max.apply(null, ages(plan)) < 4) continue;
    plan.start = startFor(env, ageOrder(plan));
    if (ageOk(plan)) return plan;
  }
  return { kind: 'age', rates: [2, 4, 1, 3], leaves: [16, 20, 6, 21], start: [0, 1, 2, 3] };
}

function carriedAge(env) {
  const p = env.card && env.card.of;
  if (!ageOk(p)) return null;
  return { kind: 'age', rates: p.rates.slice(), leaves: p.leaves.slice(), start: p.start.slice() };
}

function ageTitle() {
  return 'the oldest stem: four under glass';
}

function ageGeometry(w, h) {
  const span = w * 0.84;
  return { left: (w - span) / 2, cell: span / 4, soilY: h * 0.64 };
}

// The state the stems are drawn from; -1 is "from the start".
function ageState(order, t) {
  return { order: order.slice(), hinted: [], hintAt: [-1, -1, -1, -1], movedAt: [-1, -1, -1, -1], doneAt: -1, t };
}

function drawAge(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = ageGeometry(w, h);
  const { k, small } = metrics(w, h, v);
  const a = ages(plan);
  const doneP = s.doneAt >= 0 ? came(s, s.doneAt, 2.4, reduced) : 0;
  glass(g, w, h, env, v, true, s.t, rite);
  write(g, 'your chosen ranks are below the stems', w / 2, h * 0.05, small, 'center', env.alpha(c.muted, 0.85));
  for (let i = 0; i < 4; i++) {
    const x = geo.left + (i + 0.5) * geo.cell;
    const mine = own(rite, 0x5e + i);
    const height = (geo.soilY - h * 0.14) * (0.32 + (0.66 * plan.leaves[i]) / 24);
    const rank = s.order.indexOf(i);
    // A stem that has just changed place: the air over its bed fills through the matte and
    // empties again, and its new rank blinks on.
    const mp = came(s, s.movedAt[i], 1.1, reduced);
    column(g, env, mine, x - geo.cell * 0.46, h * 0.1, geo.cell * 0.92, geo.soilY, pulse(mine, mp), env.alpha(c.accent2, 0.12));
    const bp = s.doneAt >= 0 ? came(s, s.doneAt + rank * 0.3, 1.1, reduced) : 0;
    const bloom = bp > 0 && mine.flicker(bp) ? mine.stair(bp) : 0;
    const tip = stem(g, env, x, geo.soilY, height, plan.leaves[i], s.t, k, i * 1.3 + v.turn * TAU, 0.4 + (i % 3) * 0.25, 0, bloom, mine);
    write(g, plan.leaves[i] + ' leaves', x, tip[1] - 11 * k, small, 'center', env.alpha(c.fg, 0.9));
    if (s.hinted.includes(i) && own(rite, 0x41 + i).flicker(came(s, s.hintAt[i], 1, reduced))) {
      write(g, a[i] + (a[i] === 1 ? ' week' : ' weeks'), x, tip[1] - 11 * k - small * 1.3, small, 'center', c.accent2, '600');
    }
    badge(g, env, x, geo.soilY, LETTERS[i], k, small);
    write(g, plan.rates[i] + (plan.rates[i] === 1 ? ' leaf a week' : ' leaves a week'), x, geo.soilY + h * 0.07, small, 'center', env.alpha(c.accent2, 0.95));
    if (mine.flicker(mp)) write(g, RANKS[rank], x, geo.soilY + h * 0.13, small, 'center', env.alpha(c.fg, 0.8));
  }
  pane(g, w, h, env, doneP > 0 ? { k: rite.stair(doneP), depth: 0.5, on: !!rite.flicker(doneP) } : null, s.t, rite);
}

function agePreview(g, w, h, env, plan, t) {
  drawAge(g, w, h, env, plan, ageState(plan.start, t || 0), env.variant);
}

function agePiece(env, plan) {
  const helps = asked(env).helps;
  const order = ageOrder(plan);
  const a = ages(plan);
  const oldest = a[order[0]];
  const s = ageState(plan.start, (env.variant || PLAIN).turn * 5);
  const draw = (c) => drawAge(c.g, c.w, c.h, c, plan, s, env.variant);
  const named = (list) => list.map((i) => LETTERS[i]).join(', ');
  function current(c) {
    const v = c.value('order');
    return Array.isArray(v) && v.length === 4 ? v.map(Number) : s.order;
  }
  // The order moves to `next`, and every stem that changed place has its moment noted.
  function arrange(next) {
    for (let i = 0; i < 4; i++) if (s.order.indexOf(i) !== next.indexOf(i)) s.movedAt[i] = s.t;
    s.order = next;
  }
  return {
    title: ageTitle(),
    brief: 'Four stems under glass. Each tag gives how many leaves that stem grows in a week, and its leaves are drawn and counted. A stem that grows three leaves a week and carries twelve has grown for four weeks. Set the order with the arrows, or tap a stem to move it up one place; a stem already first moves to the end.',
    goal: 'Put the stems oldest to youngest, and say how many weeks the oldest has grown.',
    aspect: '16 / 10',
    checkLabel: 'check the bed',
    steps: [
      { id: 'order', ask: 'the stems, oldest first', kind: 'order', items: LETTERS.map((l, i) => ({ label: 'stem ' + l + ': ' + plan.leaves[i] + ' leaves; ' + plan.rates[i] + ' per week', value: i })), value: plan.start.slice() },
      { id: 'oldest', ask: 'how long the oldest has grown', kind: 'number', min: 1, max: 24, step: 1, value: 1, unit: 'weeks' },
      { id: 'hint', ask: 'one stem\'s age', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: order.slice(), oldest },
    check(c) {
      const cur = current(c);
      let right = 0;
      for (let i = 0; i < 4; i++) if (cur[i] === order[i]) right += 1;
      const weeks = Math.round(Number(c.value('oldest')));
      const ageRight = weeks === oldest;
      if (right === 4 && ageRight) return { solved: true, say: 'the leaves read true, oldest to youngest: ' + named(order) + '; stem ' + LETTERS[order[0]] + ' has grown ' + oldest + ' weeks' };
      const parts = [];
      parts.push(right === 4 ? 'the order is right' : right === 0 ? 'none of the stems is in the right place yet' : WORDS[right] + ' of four in the right place');
      if (!ageRight) parts.push(weeks < oldest ? 'the oldest is older than that' : 'the oldest is younger than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('four tags, four counts; tap a stem to move it up');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === 4) {
        arrange(value.map(Number));
        c.status('oldest first: ' + named(s.order));
      }
      if (id === 'oldest') c.status('you say the oldest has grown ' + Math.round(Number(value)) + ' weeks');
      if (id === 'hint') {
        const next = s.hinted.length < helps ? order.find((i) => !s.hinted.includes(i)) : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('stem ' + LETTERS[next] + ' has grown ' + a[next] + (a[next] === 1 ? ' week' : ' weeks'));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the glass will show at this difficulty; the rest is in the stems');
        } else {
          c.status('every stem\'s age is shown');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = ageGeometry(c.w, c.h);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= 4) {
        c.status('no stem there; tap a stem to move it up one place');
        return;
      }
      const rank = s.order.indexOf(col);
      const next = s.order.slice();
      if (rank === 0) {
        next.splice(0, 1);
        next.push(col);
      } else {
        next[rank] = next[rank - 1];
        next[rank - 1] = col;
      }
      arrange(next);
      c.set('order', next.slice());
      c.status('stem ' + LETTERS[col] + ' is now ' + RANKS[next.indexOf(col)]);
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      c.status('stem ' + LETTERS[order[0]] + ' came up first, ' + oldest + ' weeks ago; the bed blooms oldest to youngest');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the two this card is, and its plan, dealt once from the env's seeded stream and kept
// with that env. Every pass over one card -- the still picture and then every animated frame --
// asks here, so they are all the same card; dealing per frame instead would re-roll the whole
// puzzle thirty times a second (issue #92, and js/feed.js on what animate owes a card).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const water = env.chance(0.55);
    got = { water, plan: water ? waterPlan(env) : agePlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'wish-terrarium',
  needsSky: true,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.water) waterPreview(g, w, h, env, d.plan, env.variant.turn * 5);
    else agePreview(g, w, h, env, d.plan, env.variant.turn * 5);
  },
  animate(g, w, h, env, t) {
    if (env.reduced) return false;
    const d = deal(env);
    if (d.water) waterPreview(g, w, h, env, d.plan, t + env.variant.turn * 5);
    else agePreview(g, w, h, env, d.plan, t + env.variant.turn * 5);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const d = deal(env);
    if (d.water) {
      const plan = d.plan;
      return {
        title: waterTitle(plan),
        mono: 'lamp ' + (plan.lamp ? 'on' : 'off') + ' / vent ' + (plan.vent ? 'open' : 'shut') + '\nsoil ' + plan.soil.join(' ') + '\ntags: ' + plan.rules.map((r) => RULES[r].tag).join('; '),
        text: 'A midnight round under glass. Every plant wears one rule; the readings say which of them drink. Mark them.',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => waterPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 5),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: ageTitle(),
      mono: LETTERS.map((l, i) => l + ': ' + plan.leaves[i] + ' leaves, ' + plan.rates[i] + ' a week').join('\n'),
      text: 'A reading of the leaves: four stems, four rates of growth. Which came up first, and how many weeks ago?',
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => agePreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 5),
      of: plan
    };
  },
  piece(env) {
    const water = carriedWater(env);
    if (water) return waterPiece(env, water);
    const age = carriedAge(env);
    if (age) return agePiece(env, age);
    const d = deal(env);
    return d.water ? waterPiece(env, d.plan) : agePiece(env, d.plan);
  }
};
