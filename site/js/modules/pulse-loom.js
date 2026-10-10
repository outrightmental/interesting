/* The pulse loom: two beats that cross, and a wheel that only seems to turn back. As a card it is
   one of the two puzzles below, drawn small (paint, spark); as a piece it is that puzzle, and the
   card it was opened from says which. See js/feed.js for what a module is and js/stage.js for
   what a piece is.

   Two puzzles, both deduction, both solvable from what is drawn and nothing heard:

     crossings       Two drums round one loop of L beats. The outer drum plays a bar of a beats over
                     and over, the inner a bar of b beats, started a few beats late; each bar strikes
                     on one or two of its beats, and every strike is drawn on its ring. Count the
                     beats of the loop on which both strike, and name the first of them. A wrong
                     check says which of the two is off and no more; a hint, at a price, lights one
                     crossing from the far end.
     the wagon wheel A wheel of n identical teeth turns clockwise while a camera takes p pictures
                     per turn, so each picture catches the wheel n/p teeth on from the last. Say
                     which way the pictures seem to turn and after how many pictures a tooth looks
                     back where it began. The check runs the pictures; a wrong one says which answer
                     is off and no more.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the drums, their bars and the shift, or the teeth and the pictures -- and piece(env)
   opens on that rather than rolling another. */

const TAU = Math.PI * 2;
const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// Outer and inner bar lengths whose loop (two or three times their meeting) stays at 36 beats or
// fewer, so the ring can still be read.
const PAIRS = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 6], [2, 7], [3, 6], [4, 8], [6, 9], [2, 9], [3, 9], [2, 4]];
const WAYS = [
  { label: 'clockwise', value: 'cw' },
  { label: 'counterclockwise', value: 'ccw' },
  { label: 'standing still', value: 'still' }
];

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

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a, b) {
  return a * b / gcd(a, b);
}

/* ---- the rite: how the loom moves ----------------------------------------------------------- */

/* Nothing on the loom fades, glides or cuts bare (README: "Motion axiom", the cut): a thing moves
   in a few treads, always forward, and a surface that changes changes by its AREA behind one clean
   edge -- the piece's slice or curve, its signature (rite.paint, one path), never cells or a
   pattern. A crossing that is lit is strung tread by tread from the outer ring to the inner on
   rite.stair, a halo round each of its two strikes is cut in by the piece's edge up the same stair
   and rests as two shades of its colour split by that edge, and its knot is tied once the thread
   has reached the inner ring; the solved loop's band between the rings is cut in the same way and
   rests in two shades. The wagon wheel turns in rite.turn's even clicks, a tooth at a time, when
   there is something to see it do: for its first few teeth as the piece opens, so the way it goes
   is seen, and for as long as each run of the camera goes, the pictures being of it turning. Then
   it finishes the tooth it is on and stands -- on identical teeth, looking just as it did -- so the
   loom never loops while nobody asks it anything, and it stands throughout for a visitor who asked
   for less motion. The camera's shutter falls on
   rite.series's treads for as long as its run goes and then rests: before the solve on the run's
   last picture, after it on one lap that ends on a picture where a tooth is home again. Each
   picture is cut onto the plate at its shutter's moment, the old one standing until then; the
   strip goes on from the pictures before it, so a new run never empties it, and a slot a picture
   fills for the first time is cut in by the edge and rests in two shades. The omen's arrow is drawn
   round its arc up a stair; what the lamp tells is cut on at its moment over what it told before.
   A visitor who asked for less motion sees every run at its end at once. Every crossing, picture
   and word moves on a roll of its own (rite.at), read against the piece's own clock, which frame()
   advances by the frames it is given and which stands still while none come; the harnesses hand a
   rite like the stage does, and a piece with none stands still. Once everything has landed the
   loom is not drawn again until something changes (settled, below), and a loom at rest answers
   false from frame(), so the stage asks for no frame until a knob, a tap, a check, a new size or
   the scene coming back sets something going.
   A card of the loom is a still picture. */

// The rite of a piece handed none: everything stands where it ends, and a surface is cut by a
// plain upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 1, turn: () => 1, flicker: () => 1,
  series: (p, n) => n, treads: 1, kind: 'slice', angle: 90,
  region: (g, x, y, w, h, k) => {
    if (k > 0) g.rect(x, y, w * Math.min(1, k), h);
  },
  paint: (g, x, y, w, h, k, style) => {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w * Math.min(1, k), h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The rite rolled for one thing the loom moves: the same edge, its own treads. Kept with the rite
// it was rolled from, so a frame reuses a roll rather than making it afresh thirty times a second;
// a wheel on its hundredth tooth has rolled a hundred, so the keeping is let go now and then.
const ROLLS = new WeakMap();
function own(rite, seed) {
  let kept = ROLLS.get(rite);
  if (!kept) {
    kept = new Map();
    ROLLS.set(rite, kept);
  }
  let got = kept.get(seed);
  if (!got) {
    if (kept.size > 96) kept.clear();
    got = rite.at(seed);
    kept.set(seed, got);
  }
  return got;
}

// How far through its rite a thing is, s.t seconds in, that began at `since`: 1 when it has been
// there all along (or less motion was asked for), 0 before it begins. Each change asked about is
// also kept in s.until, the moment the last of them lands, so a frame after that knows it has
// nothing new to draw (settled, below).
function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0 || s.t == null) return 1;
  if (!(s.until >= since + span)) s.until = since + span;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The size and the state the canvas was last drawn at.
function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1) + (c.done ? ' solved' : '');
}

// Whether a frame has nothing to draw: the canvas holds the picture last drawn at this size and
// state, and every change in that picture had come the whole of its way when it was drawn. A new
// size (the stage clears the canvas to resize it), the solve, or a new change draws again; a change
// made outside a draw clears s.drawn, so the next frame draws it.
function settled(s, c) {
  return s.drawn === sizeOf(c) && s.drawnAt > (s.until == null ? -Infinity : s.until);
}

// Draws the scene and notes when and at what size it was drawn.
function drawn(s, c, paint) {
  paint();
  s.drawn = sizeOf(c);
  s.drawnAt = s.t;
}

function fract(x) {
  return x - Math.floor(x);
}

// A surface that comes to stay, `k` of the way there, in the current fillStyle: the part of the
// box the piece's edge has passed, and over the half behind the edge's middle a second coat of the
// same colour. One edge moves while it comes, and at rest it is two shades of one colour split by
// that edge through the middle of the box. One path per coat; a shape that is not a box is a clip
// laid before it.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0 || w <= 0 || h <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

const SPAN = 0.8;     // seconds a crossing takes to string, a halo to be cut in
const REVEAL = 1.8;   // seconds the solved loop or the omen takes to be cut in
const STAGGER = 0.18; // seconds between one crossing and the next when the loom lights them all
const TOOTH = 1.1;    // seconds the wheel takes to click round one tooth
const OPENING = 3;    // teeth the wheel turns as its piece opens, to show which way it goes
const SHUTTER = 0.3;  // seconds a picture takes to land on the plate

function ground(g, w, h, c) {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// The loom's lint: specks placed by the configuration.
function lint(g, w, h, c, v) {
  const count = Math.max(8, Math.round(24 * v.density));
  g.fillStyle = c.alpha(c.colors.accent, 0.12);
  for (let i = 0; i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.41) % 1) * w, ((i * 0.7548777 + v.turn * 0.13) % 1) * h, 1.2, 1.2);
  }
}

function text(g, c, line, x, y, size, color, align, width) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color || c.colors.fg;
  if (width) g.fillText(line, x, y, width);
  else g.fillText(line, x, y);
}

function thread(g, c, from, to, color, strength, width) {
  g.strokeStyle = c.alpha(color, strength);
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(from.x, from.y);
  g.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2, to.x, to.y);
  g.stroke();
}

/* ---- crossings ----------------------------------------------------------------------------- */

// The beats of an n-beat bar a drum strikes on: the first, and sometimes one more.
function strikes(env, n) {
  const bar = [0];
  if (n >= 3 && env.chance(0.45)) bar.push(env.int(1, n - 1));
  return bar.sort((a, b) => a - b);
}

function outerSounds(plan, i) {
  return plan.outer.includes(i % plan.a);
}

function innerSounds(plan, i) {
  return plan.inner.includes((((i - plan.shift) % plan.b) + plan.b) % plan.b);
}

function crossingsOf(plan) {
  const out = [];
  for (let i = 0; i < plan.L; i++) if (outerSounds(plan, i) && innerSounds(plan, i)) out.push(i);
  return out;
}

function crossPlan(env) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const pair = env.pick(PAIRS);
    const a = pair[0];
    const b = pair[1];
    const meet = lcm(a, b);
    const k = meet * 3 <= 36 ? env.pick([2, 3]) : 2;
    const plan = { kind: 'cross', a, b, L: meet * k, shift: env.int(0, b - 1), outer: strikes(env, a), inner: strikes(env, b) };
    const hits = crossingsOf(plan).length;
    if (hits >= 1 && hits * 2 < plan.L) return plan;
  }
  return { kind: 'cross', a: 3, b: 4, L: 24, shift: 1, outer: [0], inner: [0] };
}

function carriedCross(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'cross') return null;
  const a = Number(p.a);
  const b = Number(p.b);
  const L = Number(p.L);
  const shift = Number(p.shift);
  if (!PAIRS.some((pair) => pair[0] === a && pair[1] === b)) return null;
  if (!Number.isInteger(L) || L % lcm(a, b) !== 0 || L < 2 * lcm(a, b) || L > 36) return null;
  if (!Number.isInteger(shift) || shift < 0 || shift >= b) return null;
  const bar = (list, n) => Array.isArray(list) && list.length >= 1 && list.length <= 2
    && list.every((v) => Number.isInteger(v) && v >= 0 && v < n) && new Set(list).size === list.length;
  if (!bar(p.outer, a) || !bar(p.inner, b)) return null;
  const plan = { kind: 'cross', a, b, L, shift, outer: p.outer.slice().sort((x, y) => x - y), inner: p.inner.slice().sort((x, y) => x - y) };
  const hits = crossingsOf(plan).length;
  if (hits < 1 || hits * 2 >= L) return null;
  return plan;
}

function crossTitle(plan) {
  return 'crossings: ' + plan.a + ' against ' + plan.b + ' round ' + plan.L;
}

function crossGeometry(w, h, v) {
  const r = Math.min(w, h) * 0.38 * Math.min(1.12, Math.max(0.86, v.scale));
  return { cx: w / 2, cy: h / 2, r, outer: r * 0.94, inner: r * 0.66 };
}

function beatAngle(i, L) {
  return -Math.PI / 2 + i / L * TAU;
}

// The scene: the loop as two rings of beats, the outer drum's strikes on the outer ring and the
// inner drum's on the inner, every beat ticked, a few numbered, and the bars written in the middle.
function drawCross(g, w, h, c, plan, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const geo = crossGeometry(w, h, v);
  const L = plan.L;
  const size = Math.max(9, Math.min(16, Math.round(geo.r * 0.09)));
  const small = Math.max(8, Math.round(size * 0.85));
  ground(g, w, h, c);
  lint(g, w, h, c, v);
  // The solved loop: the band between the rings is cut in by the piece's edge up a stair, and
  // rests in two shades of its colour split by that edge.
  if (s.solvedAt != null) {
    const band = own(rite, 0x7f);
    const k = band.stair(came(s, s.solvedAt, REVEAL, c.reduced));
    if (k > 0) {
      const r0 = geo.inner * 0.9;
      const r1 = geo.outer * 1.06;
      g.save();
      g.beginPath();
      g.arc(geo.cx, geo.cy, r1, 0, TAU);
      g.moveTo(geo.cx + r0, geo.cy);
      g.arc(geo.cx, geo.cy, r0, 0, TAU, true);
      g.clip();
      g.fillStyle = c.alpha(col.accent2, 0.1);
      cover(g, band, geo.cx - r1, geo.cy - r1, r1 * 2, r1 * 2, k);
      g.restore();
    }
  }
  g.lineWidth = Math.max(1, geo.r * 0.005);
  g.strokeStyle = c.alpha(col.muted, 0.5);
  for (const radius of [geo.outer, geo.inner]) {
    g.beginPath();
    g.arc(geo.cx, geo.cy, radius, 0, TAU);
    g.stroke();
  }
  const every = L >= 24 ? 6 : 4;
  for (let i = 0; i < L; i++) {
    const a = beatAngle(i, L);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // The tick between the rings, so an alignment can be judged.
    g.strokeStyle = c.alpha(col.muted, 0.22 + 0.12 * v.density);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(geo.cx + cos * geo.inner * 1.06, geo.cy + sin * geo.inner * 1.06);
    g.lineTo(geo.cx + cos * geo.outer * 0.95, geo.cy + sin * geo.outer * 0.95);
    g.stroke();
    const on = outerSounds(plan, i);
    g.fillStyle = on ? col.accent : c.alpha(col.muted, 0.5);
    g.beginPath();
    g.arc(geo.cx + cos * geo.outer, geo.cy + sin * geo.outer, Math.max(1.5, geo.r * (on ? 0.028 : 0.011)), 0, TAU);
    g.fill();
    const inOn = innerSounds(plan, i);
    g.fillStyle = inOn ? col.accent2 : c.alpha(col.muted, 0.5);
    g.beginPath();
    g.arc(geo.cx + cos * geo.inner, geo.cy + sin * geo.inner, Math.max(1.5, geo.r * (inOn ? 0.028 : 0.011)), 0, TAU);
    g.fill();
    if (i === 0 || (i + 1) % every === 0) {
      text(g, c, String(i + 1), geo.cx + cos * geo.outer * 1.12, geo.cy + sin * geo.outer * 1.12, small, c.alpha(col.fg, 0.85));
    }
  }
  // The crossings that are shown: a thread strung between the two strikes tread by tread, from
  // the outer ring in; a halo round each strike cut in by the piece's edge up the same stair and
  // resting in two shades; and a knot tied once the thread has reached the inner ring -- each
  // crossing on a roll of its own.
  const halo = Math.max(4, geo.r * 0.07);
  s.lit.forEach((i, j) => {
    const lit = own(rite, 0x100 + i);
    const k = lit.stair(came(s, s.litAt && s.litAt[j], SPAN, c.reduced));
    if (k <= 0) return;
    const a = beatAngle(i, L);
    const from = { x: geo.cx + Math.cos(a) * geo.outer, y: geo.cy + Math.sin(a) * geo.outer };
    const to = { x: geo.cx + Math.cos(a) * geo.inner, y: geo.cy + Math.sin(a) * geo.inner };
    g.fillStyle = c.alpha(col.accent2, 0.24);
    for (const at of [from, to]) {
      g.save();
      g.beginPath();
      g.arc(at.x, at.y, halo, 0, TAU);
      g.clip();
      cover(g, lit, at.x - halo, at.y - halo, halo * 2, halo * 2, k);
      g.restore();
    }
    const tip = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    thread(g, c, from, tip, col.accent2, 0.9, Math.max(1.5, geo.r * 0.014));
    if (k >= 1) {
      g.fillStyle = col.fg;
      g.beginPath();
      g.arc((from.x + to.x) / 2, (from.y + to.y) / 2, Math.max(2, geo.r * 0.02), 0, TAU);
      g.fill();
    }
  });
  // The bars, written in the middle: each drum's bar as a row of beats.
  const rows = [
    { name: 'outer', n: plan.a, bar: plan.outer, tone: col.accent, note: 'from beat 1' },
    { name: 'inner', n: plan.b, bar: plan.inner, tone: col.accent2, note: plan.shift === 0 ? 'from beat 1' : 'from beat ' + (plan.shift + 1) }
  ];
  rows.forEach((row, k) => {
    const y = geo.cy + (k - 0.5) * size * 3.8;
    const cell = Math.min(size * 1.3, geo.inner * 1.3 / row.n);
    const x0 = geo.cx - cell * row.n / 2;
    text(g, c, row.name + ', ' + row.n + ' beats', geo.cx, y - size * 1.25, small, c.alpha(col.fg, 0.8));
    for (let b = 0; b < row.n; b++) {
      const on = row.bar.includes(b);
      g.fillStyle = on ? row.tone : c.alpha(col.muted, 0.5);
      g.beginPath();
      g.arc(x0 + (b + 0.5) * cell, y, Math.max(1.5, cell * (on ? 0.32 : 0.15)), 0, TAU);
      g.fill();
    }
    text(g, c, row.note, geo.cx, y + size * 1.2, small, c.alpha(col.muted, 0.9));
  });
  text(g, c, 'loop of ' + L, geo.cx, geo.cy + geo.inner * 0.8, small, c.alpha(col.fg, 0.75));
}

// The scene's state before anyone has touched it: nothing lit, nothing solved, no clock yet (a
// card is drawn once and stands).
function crossBlank() {
  return { lit: [], litAt: [], solvedAt: null, t: 0, until: null, drawn: null, drawnAt: -Infinity };
}

function crossPreview(g, w, h, env, plan) {
  drawCross(g, w, h, env, plan, crossBlank(), env.variant);
}

function crossPiece(env, plan) {
  const helps = asked(env).helps;
  const hits = crossingsOf(plan);
  const s = crossBlank();
  const draw = (c) => drawn(s, c, () => drawCross(c.g, c.w, c.h, c, plan, s, env.variant));
  return {
    title: crossTitle(plan),
    brief: 'Strung on the loom: two drums round one loop of ' + plan.L + ' beats, beat 1 at the top. The outer drum plays its ' + plan.a + '-beat bar over and over from beat 1; '
      + 'the inner plays its ' + plan.b + '-beat bar from beat ' + (plan.shift + 1) + '. Every strike is on its ring: the outer drum on the outer ring, the inner on the inner.',
    goal: 'Count the beats on which both drums strike, and name the first of them.',
    aspect: '1 / 1',
    checkLabel: 'check the loop',
    steps: [
      { id: 'count', ask: 'how many beats of the loop both drums strike on', kind: 'number', min: 0, max: plan.L, step: 1, unit: 'beats' },
      { id: 'first', ask: 'the first beat they strike together', kind: 'number', min: 1, max: plan.L, step: 1, unit: 'beat' },
      { id: 'hint', ask: 'one crossing, lit', kind: 'press', count: 1, label: 'light one', optional: true }
    ],
    solution: { count: hits.length, first: hits[0] + 1 },
    check(c) {
      const countRight = Number(c.value('count')) === hits.length;
      const firstRight = Number(c.value('first')) === hits[0] + 1;
      if (countRight && firstRight) return { solved: true, say: 'the loom reads true: ' + (hits.length === 1 ? 'one crossing' : WORDS[hits.length] + ' crossings') + ', the first on beat ' + (hits[0] + 1) };
      return {
        solved: false,
        say: !countRight && !firstRight ? 'the count and the first beat are both off' : (!countRight ? 'the first beat holds; the count is off' : 'the count holds; the first beat is off')
      };
    },
    start(c) {
      c.status('outer every ' + plan.a + ', inner every ' + plan.b + ', round ' + plan.L + ' beats');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'count') c.status(Math.round(Number(value)) + ' crossings, you say');
      if (id === 'first') c.status('the first on beat ' + Math.round(Number(value)) + ', you say');
      if (id === 'hint') {
        const next = s.lit.length < helps ? hits.slice().reverse().find((i) => !s.lit.includes(i)) : undefined;
        if (next !== undefined) {
          s.lit.push(next);
          s.litAt.push(s.t);
          c.hint();
          c.status('both drums strike on beat ' + (next + 1));
        } else if (s.lit.length >= helps) {
          c.status('that is all the loom will light at this difficulty; read the rest off the beats');
        } else {
          c.status('every crossing is lit; count them, and read the first');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (settled(s, c)) return false;
      draw(c);
      return !settled(s, c);
    },
    end(c) {
      // The crossings not yet lit come in one after another round the loop, each in its turn;
      // the ones already lit stay as they are.
      s.solvedAt = s.t;
      let late = 0;
      for (const i of hits) {
        if (s.lit.includes(i)) continue;
        s.lit.push(i);
        s.litAt.push(s.t + late * STAGGER);
        late += 1;
      }
      c.status('the loop lit: ' + hits.map((i) => i + 1).join(', '));
      draw(c);
    }
  };
}

/* ---- the wagon wheel ----------------------------------------------------------------------- */

function wheelPlan(env) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = env.int(5, 12);
    const p = env.chance(0.15) ? n : env.int(6, 20);
    if (p < 6 || p > 20) continue;
    if (2 * (n % p) === p) continue;
    return { kind: 'wheel', n, p };
  }
  return { kind: 'wheel', n: 8, p: 7 };
}

function carriedWheel(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'wheel') return null;
  const n = Number(p.n);
  const pictures = Number(p.p);
  if (!Number.isInteger(n) || n < 5 || n > 12 || !Number.isInteger(pictures) || pictures < 6 || pictures > 20) return null;
  if (2 * (n % pictures) === pictures) return null;
  return { kind: 'wheel', n, p: pictures };
}

// Identical teeth hide whole teeth of movement; what the pictures show is the remainder, and a
// remainder past half a tooth reads as a short step the other way.
function seeming(plan) {
  const r = plan.n % plan.p;
  return r === 0 ? 'still' : 2 * r > plan.p ? 'ccw' : 'cw';
}

function returnAfter(plan) {
  return plan.p / gcd(plan.n, plan.p);
}

function wayLabel(value) {
  return WAYS.find((o) => o.value === value).label;
}

function wheelTitle(plan) {
  return 'the wagon wheel: ' + plan.n + ' teeth, ' + plan.p + ' pictures';
}

function wheel(g, c, x, y, r, teeth, angle, color, strength) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.strokeStyle = c.alpha(color, strength);
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.beginPath();
  g.arc(0, 0, r * 0.88, 0, TAU);
  g.moveTo(r * 0.17, 0);
  g.arc(0, 0, r * 0.17, 0, TAU);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU;
    g.moveTo(Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17);
    g.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
  }
  g.stroke();
  g.fillStyle = c.alpha(color, strength);
  for (let i = 0; i < teeth; i++) {
    g.save();
    g.rotate(i / teeth * TAU);
    g.fillRect(r * 0.83, -r * 0.035, r * 0.17, r * 0.07);
    g.restore();
  }
  g.restore();
}

// The arrow round a wheel. `drawn` is how much of its arc is drawn so far (0..1, the whole when
// not given) and `headed` whether its head is on yet: an arrow that arrives is drawn round up a
// stair, its head cut on at its moment and carried forward on the tip from then.
function rotationArrow(g, c, x, y, r, backward, color, drawn, headed) {
  const sign = backward ? -1 : 1;
  const start = -Math.PI * 0.86;
  const span = Math.PI * 1.15 * (drawn == null ? 1 : Math.max(0, Math.min(1, drawn)));
  if (span <= 0) return;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, r * 0.017);
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (start + span * i / 24) * sign;
    if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.stroke();
  if (headed === false) return;
  const a = (start + span) * sign;
  const px = x + Math.cos(a) * r;
  const py = y + Math.sin(a) * r;
  const tx = -Math.sin(a) * sign;
  const ty = Math.cos(a) * sign;
  const size = Math.max(3, r * 0.12);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(px, py);
  g.lineTo(px - tx * size + Math.cos(a) * size * 0.5, py - ty * size + Math.sin(a) * size * 0.5);
  g.lineTo(px - tx * size - Math.cos(a) * size * 0.5, py - ty * size - Math.sin(a) * size * 0.5);
  g.closePath();
  g.fill();
}

// The scene: the real wheel on the left, turning clockwise; the camera's pictures on the right,
// with the p places round the rim where the wheel is caught; a strip of the pictures taken.
function drawWheel(g, w, h, c, plan, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const m = Math.min(w, h);
  const pad = w * 0.045;
  const panel = (w - pad * 3) / 2;
  const left = pad + panel / 2;
  const right = w - left;
  const cy = h * 0.4;
  const radius = Math.min(panel * 0.35, h * 0.23) * Math.min(1.12, Math.max(0.86, v.scale));
  const size = Math.max(9, Math.min(18, Math.round(m * 0.042)));
  const small = Math.max(8, Math.round(size * 0.85));
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  lint(g, w, h, c, v);
  g.strokeStyle = c.alpha(col.muted, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w / 2, h * 0.16);
  g.lineTo(w / 2, h * 0.72);
  g.stroke();
  text(g, c, 'the wheel: ' + plan.n + ' teeth', left, h * 0.09, size, col.fg, 'center', panel);
  text(g, c, 'the pictures: ' + plan.p + ' per turn', right, h * 0.09, size, col.fg, 'center', panel);
  const phase = v.turn * TAU;
  // The real wheel: its turn is the ratchet, a tooth at a time in even clicks (s.spin, set in
  // frame() from the piece's clock).
  wheel(g, c, left, cy, radius, plan.n, phase + s.spin, col.accent, 0.95);
  rotationArrow(g, c, left, cy, radius * 1.13, false, col.accent);
  // The latest picture: it is cut onto the plate at its shutter's moment, on a roll of its own --
  // one per fall of the shutter, so a picture taken again in another run lands at another moment;
  // until then the plate, the place on the rim, the caption and the strip still show the pictures
  // before it.
  const shutter = own(rite, 0x200 + s.shots);
  const shotP = came(s, s.indexAt, SHUTTER, c.reduced);
  const landed = shutter.flicker(shotP);
  const film = landed ? s.film : s.film.slice(0, -1);
  const taken = film.length > 0;
  const plate = taken ? film[film.length - 1] : 0;
  // The p places round the rim: one picture per place, the wheel a pth of a turn on each time.
  // The place the camera stands at now is lit, and from its picture's moment grows to its size in
  // treads.
  const at = taken ? plate % plan.p : -1;
  for (let i = 0; i < plan.p; i++) {
    const a = -Math.PI / 2 + i / plan.p * TAU;
    const here = i === at;
    const grow = here && landed ? 0.6 + 0.4 * shutter.stair(shotP) : 1;
    g.fillStyle = c.alpha(col.accent2, here || i === 0 ? 1 : 0.6);
    g.beginPath();
    g.arc(right + Math.cos(a) * radius * 1.16, cy + Math.sin(a) * radius * 1.16, Math.max(1.5, radius * (here ? 0.055 * grow : i === 0 ? 0.045 : 0.03)), 0, TAU);
    g.fill();
  }
  wheel(g, c, right, cy, radius, plan.n, phase + plate / plan.p * TAU, col.accent2, 0.95);
  if (s.reveal) {
    // The omen: its arrow is drawn round up a stair, its head cut on at its moment; the
    // standstill's marks are cut on at that moment and hold.
    const way = seeming(plan);
    const omen = own(rite, 0x7e);
    const op = came(s, s.revealAt, REVEAL, c.reduced);
    if (way === 'still') {
      if (omen.flicker(op)) {
        g.strokeStyle = col.accent2;
        g.lineWidth = Math.max(1, radius * 0.025);
        g.beginPath();
        g.moveTo(right - radius * 0.05, cy - radius * 0.12);
        g.lineTo(right - radius * 0.05, cy + radius * 0.12);
        g.moveTo(right + radius * 0.05, cy - radius * 0.12);
        g.lineTo(right + radius * 0.05, cy + radius * 0.12);
        g.stroke();
      }
    } else rotationArrow(g, c, right, cy, radius * 1.3, way === 'ccw', col.accent2, omen.stair(op), omen.flicker(op));
  }
  text(g, c, 'turns clockwise', left, h * 0.7, small, c.alpha(col.fg, 0.85), 'center', panel);
  // The caption under the plate changes its words with the picture: the old words stand until the
  // picture is cut onto the plate, and are cut over to the new ones with it.
  text(g, c, taken ? 'picture ' + (plate + 1) : 'the first picture; ' + plan.p + ' to a turn', right, h * 0.7, small, c.alpha(col.fg, 0.85), 'center', panel);
  // What the lamp has told: each telling is cut on at its moment, on a roll of its own, over the
  // one told before, which stands until then -- never a gap between the two.
  const said = own(rite, 0x300 + s.shown).flicker(came(s, s.toldAt, SPAN, c.reduced)) ? s.told : s.toldWas;
  if (said) text(g, c, said, w / 2, h * 0.77, small, col.accent2, 'center', w * 0.9);
  // The strip of pictures taken, the latest at the right, going on from run to run: the slot a
  // picture fills for the first time is cut in by the piece's edge up its shutter's stair, and
  // every slot taken rests in two shades split by that edge. Once the strip is full a new picture
  // moves the pictures one slot on at its moment, every slot staying taken.
  const slots = Math.max(3, Math.min(6, Math.round(4 * v.density)));
  const gap = w * 0.018;
  const sw = (w - pad * 2 - gap * (slots - 1)) / slots;
  const top = h * 0.82;
  const sh = h * 0.105;
  const strip = film.slice(-slots);
  const filling = s.film.length <= slots;
  for (let i = 0; i < slots; i++) {
    const x = pad + i * (sw + gap);
    const shot = strip[i];
    const has = i < strip.length;
    const latest = has && landed && filling && i === strip.length - 1;
    const k = latest ? shutter.stair(shotP) : has ? 1 : 0;
    g.fillStyle = c.alpha(col.bg, 0.65);
    g.fillRect(x, top, sw, sh);
    if (k > 0) {
      g.fillStyle = c.alpha(col.accent2, 0.12);
      cover(g, latest ? shutter : rite, x, top, sw, sh, k);
    }
    g.strokeStyle = c.alpha(has ? col.accent2 : col.muted, has ? 0.65 : 0.3);
    g.lineWidth = 1;
    g.strokeRect(x, top, sw, sh);
    if (has) wheel(g, c, x + sw / 2, top + sh / 2, Math.min(sw, sh) * 0.39, plan.n, phase + shot / plan.p * TAU, col.accent2, 0.8);
  }
}

// The pictures kept: the six the widest strip shows, one more for the picture not yet on the plate,
// and one to spare -- always more than a strip shows once it has filled, so a full strip is never
// read as filling again.
const FILM = 8;

// The scene's state before anyone has touched it: the wheel at rest, no picture taken, the omen
// unread, and no clock yet (a card is drawn once and stands). `film` is the pictures taken, the
// latest last, as many as the strip can show; `runAt` is when the camera started this run and
// `index` the picture it took last in it, at `indexAt`; `shots` how many times the shutter has
// fallen since the piece opened (each fall composes its own rite); `turns` how many teeth the wheel
// has turned, `spin` the angle that comes to, and `spinShown` the angle the canvas was last drawn at.
function wheelBlank() {
  return { turns: 0, spin: 0, spinShown: 0, index: 0, indexAt: null, film: [], runAt: null, reveal: false, revealAt: null, told: '', toldWas: '', toldAt: null, shown: 0, shots: 0, t: 0,
    until: null, drawn: null, drawnAt: -Infinity };
}

// A picture taken: kept at the end of the film, the oldest let go past what the strip can show.
function take(s, picture) {
  s.film.push(picture);
  if (s.film.length > FILM) s.film.splice(0, s.film.length - FILM);
}

function wheelPreview(g, w, h, env, plan) {
  drawWheel(g, w, h, env, plan, wheelBlank(), env.variant);
}

function wheelPiece(env, plan) {
  const way = seeming(plan);
  const back = returnAfter(plan);
  const helps = asked(env).helps;
  const s = wheelBlank();
  const interval = 0.45;
  const roll = Math.min(24, back * 2 + 2);
  // The run after the solve: one lap of whole returns, at most 24 pictures, so the camera rests on
  // a picture where a tooth is home again -- the omen read.
  const lap = back * Math.max(1, Math.min(3, Math.floor(24 / back)));
  const rite = riteOf(env);
  const draw = (c) => drawn(s, c, () => {
    s.spinShown = s.spin;
    drawWheel(c.g, c.w, c.h, c, plan, s, env.variant);
  });
  // The camera starts (again) now: its first picture is taken and lands on the plate at its
  // shutter's moment, the strip going on from the pictures before it.
  function shoot() {
    s.runAt = s.t;
    s.index = 0;
    s.indexAt = s.t;
    take(s, 0);
    s.shots += 1;
    s.drawn = null;
  }
  return {
    title: wheelTitle(plan),
    brief: 'The old omen of the turning wheel. The wheel has ' + plan.n + ' identical teeth and turns clockwise, never the other way. A camera takes ' + plan.p
      + ' pictures in one turn, so between pictures the wheel moves 1/' + plan.p + ' of a turn: ' + plan.n + '/' + plan.p
      + ' of a tooth. The pictures are shown one after another.',
    goal: 'Say which way the pictures seem to turn, and after how many pictures a tooth is back where it began.',
    aspect: '4 / 3',
    checkLabel: 'take the pictures',
    steps: [
      { id: 'seem', ask: 'which way the pictures seem to turn', kind: 'choice', options: WAYS },
      { id: 'back', ask: 'after how many pictures a tooth is back where it began', kind: 'number', min: 1, max: 20, step: 1, unit: 'pictures' },
      { id: 'hint', ask: 'how far the wheel moves between pictures', kind: 'press', count: 1, label: 'show me', optional: true }
    ],
    solution: { seem: way, back },
    check(c) {
      const seemRight = c.value('seem') === way;
      const backRight = Number(c.value('back')) === back;
      shoot();
      if (seemRight && backRight) return { solved: true, say: 'the omen reads: the pictures ' + (way === 'still' ? 'stand still' : 'seem to go ' + wayLabel(way)) + ', and a tooth is back after ' + back };
      return {
        solved: false,
        say: !seemRight && !backRight ? 'the direction and the return count are both off' : (!seemRight ? 'the return count holds; the pictures do not seem to go that way' : 'the way is right; the return count is off')
      };
    },
    start(c) {
      c.status(plan.n + ' teeth, ' + plan.p + ' pictures per turn');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'seem') c.status('you expect the pictures to ' + (value === 'still' ? 'stand still' : 'seem to go ' + wayLabel(value)));
      if (id === 'back') c.status('a tooth back where it began after ' + Math.round(Number(value)) + ' pictures, you say');
      if (id === 'hint') {
        // Two things the lamp will tell you, in this order, and the difficulty says how many of
        // them it tells: the step between pictures, and then which way the wheel seems to go.
        const whole = Math.floor(plan.n / plan.p);
        const rest = plan.n % plan.p;
        const step = 'between pictures: ' + (whole ? whole + ' whole ' + (whole === 1 ? 'tooth' : 'teeth') + (rest ? ' and ' : '') : '') + (rest ? rest + '/' + plan.p + ' of a tooth' : '');
        const shows = [step + '; identical teeth hide whole teeth',
          'the pictures ' + (way === 'still' ? 'stand still' : 'seem to go ' + wayLabel(way))];
        if (s.shown < Math.min(shows.length, helps)) {
          s.toldWas = s.told;
          s.told = shows[s.shown];
          s.toldAt = s.t;
          s.shown += 1;
          c.hint();
          c.status(s.told);
        } else if (s.shown >= helps) {
          c.status('that is all the lamp will tell at this difficulty: ' + s.told);
        } else {
          c.status('the lamp has told what it has: ' + s.told);
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      const step = Math.max(0, dt);
      s.t += step;
      const last = c.done ? lap : roll;
      // The wheel turns a tooth every TOOTH seconds, in the ratchet's even clicks: never a smooth
      // rotation and never a click back, and every tooth on a roll of its own, so no two teeth
      // click round in the same rhythm. It turns for its first teeth as the piece opens and while
      // the camera's run goes; after that it finishes the tooth it is on and stands. Less motion
      // asked for, it stands throughout.
      const turning = !c.reduced && (s.t < OPENING * TOOTH || (s.runAt != null && s.t - s.runAt < last * interval));
      if (!c.reduced && (turning || s.turns > Math.floor(s.turns))) {
        const on = s.turns + step / TOOTH;
        s.turns = turning ? on : Math.min(Math.floor(s.turns) + 1, on);
      }
      const tooth = Math.floor(s.turns);
      s.spin = (tooth + own(rite, 0x500 + tooth).turn(fract(s.turns))) * TAU / plan.n;
      if (s.runAt != null) {
        // The shutter falls on the stair's treads: the pictures of a run come after a hold at the
        // rite's own even intervals, as far as the run goes -- `roll` pictures before the solve,
        // one lap after it -- and the camera rests on the last. Less motion asked for, the run is
        // at its end at once.
        const run = Math.max(0, s.t - s.runAt);
        const shot = c.reduced ? last : rite.series(Math.min(1, run / (last * interval)), last);
        if (shot > s.index) {
          for (let i = s.index + 1; i <= shot; i++) take(s, i);
          s.index = shot;
          s.indexAt = s.t;
          s.shots += 1;
          s.drawn = null;
        }
      }
      // Between the wheel's clicks and the camera's pictures nothing on the loom changes, and it is
      // not drawn. The frame answers whether anything is still moving: the wheel on its way round
      // a tooth, or a picture, a word or the omen still to land. A standing wheel and a landed loom
      // answer false, and the stage asks for no frame until the visitor sets something going.
      if (!(s.spin === s.spinShown && settled(s, c))) draw(c);
      return turning || s.turns > Math.floor(s.turns) || !settled(s, c);
    },
    end(c) {
      s.reveal = true;
      s.revealAt = s.t;
      // The check that solved it has just started the camera; its run is now the omen's lap.
      if (s.runAt !== s.t) shoot();
      c.status('the pictures go on: ' + (way === 'still' ? 'every one the same' : 'seeming to go ' + wayLabel(way)) + ', a tooth home every ' + back);
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsWheel(env) {
  return env.chance(0.45);
}

export default {
  id: 'pulse-loom',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsWheel(env)) wheelPreview(g, w, h, env, wheelPlan(env));
    else crossPreview(g, w, h, env, crossPlan(env));
  },
  spark(env) {
    if (dealsWheel(env)) {
      const plan = wheelPlan(env);
      return {
        title: wheelTitle(plan),
        text: 'An old omen: the wheel only ever turns clockwise. Which way will its pictures seem to go, and when does a tooth look home again?',
        mono: 'one tooth      1/' + plan.n + ' of a turn\none picture    1/' + plan.p + ' of a turn',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => wheelPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = crossPlan(env);
    return {
      title: crossTitle(plan),
      text: 'Two drums strung round one loop. Count the beats they strike together, and name the first.',
      mono: 'outer  ' + plan.a + '-beat bar from beat 1\ninner  ' + plan.b + '-beat bar from beat ' + (plan.shift + 1) + '\nloop   ' + plan.L + ' beats',
      aspect: '1 / 1',
      paint: (g, w, h, cardEnv) => crossPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const turning = carriedWheel(env);
    if (turning) return wheelPiece(env, turning);
    const crossing = carriedCross(env);
    if (crossing) return crossPiece(env, crossing);
    return dealsWheel(env) ? wheelPiece(env, wheelPlan(env)) : crossPiece(env, crossPlan(env));
  }
};
