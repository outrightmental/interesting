#!/usr/bin/env node
/*
  The puzzle axiom's instrument: prove every world's piece is a puzzle that solves, without a browser.

      node .github/scripts/piece_harness.mjs --modules <built site>/js/modules [--seeds 1,2,3]
                                             [--json] [--out report.json] [--require-all]

  Every world on the site is a puzzle a visitor can solve: a small, procedurally generated problem
  with a stated goal, a few knobs to answer it on, a check that says whether the answer solves it,
  and a solution the piece itself knows -- made by the world's module (js/modules/<world>.js) as
  piece(env) and run by js/stage.js, which documents the contract. The stage is the visitor's
  instrument; this is the law's. It loads each module from the folder it is given, asks it for a
  piece for each seed, and plays the piece the way the stage would, on a canvas that records
  nothing: the helper knobs (the ones not named in `solution`) set the way a visitor would set
  them -- a choice at one of its options, a toggle flipped, a press pressed its count, a hold held
  for its time, frames run for a wait -- and the answer knobs set to the piece's own solution; then
  the check is pressed, and the piece has to say it is solved. Every seed is played with a sky of
  five stars; one seed is also played the way the stage plays a module that does not read the sky
  (with none) or one that does (with a single star). Every seed is then played again with its
  knobs reached in a seeded order rather than down the page, and the first seed is played through
  from the top a second time, which has to come out exactly as the first.

  Then the other half of what makes a puzzle legitimate: a wrong answer must not solve it. Every
  seed is played with every answer knob wrong at once, and once more per answer knob with that one
  wrong and the rest right, and none of those checks may say solved -- a declared answer that does
  not change the verdict is a knob that is not an answer. A wrong value is the other option, the
  opposite toggle, the far end of a range or a number, the word with its last letter changed, the
  order with its first two swapped, the pick with one chosen swapped for one not, the grid with one
  cell cycled, and the piece's own `wrong` points for a tap. And a piece whose answer knobs all
  open on a value (no choice, no empty word) is played once with them left exactly as they opened,
  which may not solve either: a puzzle that opens solved is no puzzle.

  Then the dial. The persona keeps one difficulty for the whole site (issue #93) and js/stage.js
  hands it to a piece on env.difficulty, 1 (gentle) to 5 (fierce), so a piece is a puzzle at five
  settings rather than one: what a level buys is less help and, where an answer is a measurement,
  a narrower margin. Every stop is played -- a seed of its own at each, so a world of two shapes
  does not meet the dial in only one of them -- with its own solution, which has to solve, and
  with every answer wrong, which may not; and at the two ends the first seed is played as the card
  it was dealt as, because a piece follows its card whatever the setting. A card's own env carries
  no difficulty at all, which is how the plan a piece is of stays the seed's.

  The first seed is then played three times more, for the alignment axiom (issue #80). A card and
  the feature it opens as are one content piece, procedurally configured once: the stage hands the
  piece the card's configuration on env.variant -- the seven dials of site/js/variant.js -- and the
  content the card was showing on env.card. So the first seed is played under a configuration away
  from the no-op one, then as the card that configuration deals it, then as a card another seed was
  dealt. All three have to solve like any other play (a sky can change under a card, so a piece
  reads the card it is handed defensively), and the last two have to be different pieces: what a
  feature is follows from the card it was opened from, and a module that ignored env.card would
  open the same item whichever of its cards a visitor pressed, which is the bug the axiom is here
  to keep out.

  The stage harness beside this one (stage_harness.mjs) plays the other half of the axiom: the
  knobs and the check through js/stage.js's own controls, which is where a knob can turn out to be
  one the visitor cannot actually set.

  A module fails when:
    - piece(env) throws, or returns nothing, or returns something with no title, no goal, no
      steps, no check() or no solution;
    - a piece has fewer than MIN_STEPS knobs (a flow is more than one lever) or more than
      MAX_STEPS (a visitor has to be able to answer expediently), a knob of a kind the stage does
      not render, two knobs with one id, a choice with fewer than two or more than four options,
      a tap knob without tap(), an `after` that names no earlier knob, a solution that names a
      knob the piece has not got or a press, a hold or a wait (those are never answers), or a
      solution value that is not one the knob can be set to -- an option it has not got, a number
      off its range, a tolerance (`near`) wider than half the range, an order that is not a
      permutation of its items, a pick of the wrong size, a grid of the wrong length, a tap
      without its `taps` and `wrong` points;
    - the piece sets a knob itself (ctx.satisfy) before its visitor has set anything, or sets a
      knob that is not a tap or a wait, or a tap answer is not set by its wrong points (the taps
      set the knob and the check judges them: a tap() that only ever satisfies on the right spot
      has moved the verifier out of check(), where the law reads it);
    - the solution, checked, does not solve; a wrong answer, checked, does;
    - the same seed does not make the same piece (same title, goal, brief, knobs and solution),
      because a piece is an address a visitor can come back to or send to someone;
    - the same seed played a second time through the same module does not make the same piece or
      does not play out the same way, because a module keeps nothing between instantiations;
    - a piece can only be solved with its knobs set down the page, because nothing makes a
      visitor work in that order;
    - every seed makes the same piece, because the river is of pieces that differ;
    - the piece is the same piece whichever card it was opened from (the alignment axiom, issue
      #80). A module whose spark() makes nothing for the seeds tried is not held to this;
    - the piece does not come to its check within MAX_TAPS taps of its scene and MAX_SECONDS of
      simulated time, or start/apply/frame/tap/check/end throws;
    - it reaches for a clock or for Math.random: in here those throw, because a piece draws its
      randomness from the seeded rnd it is handed and its time from the frame clock, and
      anything else would make the same seed a different piece.
  A module that exports no piece() is reported as such and left to the caller to judge: the
  check in make_interesting.py requires one of every world the site lists.

  Each module is played in a worker thread of its own, with an empty environment and a limit of
  MODULE_TIMEOUT_MS of real time, so one module that never returns is reported alone and cannot
  hold the others up; a module is self-contained (it imports nothing but its own file) and
  never reaches for the document, the window or the browser's storage, none of which exist
  here, which is the law doing its job. The run itself is model-written code executed by the
  AI run: make_interesting.py starts it with a scrubbed environment and under Node's permission
  model (no file writes but the report, no child processes), so the most a rogue module can do
  is misreport itself -- this is a quality gate, not a security boundary, and the site's source
  is public anyway.

  Prints one line per module (or, with --json, one JSON document; with --out, writes it to that
  file as well) and exits 1 if any module with a piece fails -- or, with --require-all, if any
  module has no piece.
*/

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

export const MIN_STEPS = 2;
export const MAX_STEPS = 5;
export const MAX_TAPS = 12;
export const MAX_SECONDS = 45;
// Real time, per module, for all of its plays: six seeds solved, one sky, six orders, the replay,
// the wrong answers (one all-wrong, one per answer knob, and the opening values) for every seed,
// the three the alignment axiom adds (configured, as its own card, as another card), and the
// twelve the difficulty adds (a seed solved and wrong at each of the five stops of the dial, and
// the first seed's own card at the two ends). A runner that is twice as slow as a quick machine
// should still be judging pieces rather than reporting timeouts.
export const MODULE_TIMEOUT_MS = 150000;
const FRAME = 1 / 30;
const SETTLE = 0.5; // seconds of frames run after each knob, as a visitor pauses between them
const KINDS = ['choice', 'toggle', 'range', 'number', 'word', 'order', 'pick', 'grid', 'press', 'hold', 'tap', 'wait'];
// The kinds a knob named in `solution` may be: a press, a hold or a wait is never an answer.
export const ANSWER_KINDS = ['choice', 'toggle', 'range', 'number', 'word', 'order', 'pick', 'grid', 'tap'];
const SEEDS = [11, 2027, 31337, 777777, 9000001, 123456789]; // spread out: near seeds make near first draws
const W = 800;
const H = 450;

const COLORS = { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' };
const STARS = [
  { x: 18, y: 30, text: 'a window left open' },
  { x: 52, y: 22, text: 'the sound of a kettle' },
  { x: 71, y: 58, text: 'one more page' },
  { x: 35, y: 70, text: 'the long way home' },
  { x: 86, y: 26, text: 'a word I keep' }
];
const ONE_STAR = [STARS[1]];

// The configuration a piece is of: the seven dials of site/js/variant.js, which the stage hands it
// on env.variant (the alignment axiom, issue #80). PLAIN_DIALS is the no-op configuration the card
// the template wrote wears, and CONFIGURED is one away from it on every dial -- inside the ranges
// variant.js rolls in, and spelled out here rather than imported because a module is played with
// nothing but the harness beside it, exactly as it imports nothing itself.
const PLAIN_DIALS = { plain: true, trade: 0, lift: 0, wash: 0, density: 1, scale: 1, turn: 0, stretch: 1 };
const CONFIGURED = { plain: false, trade: 0.86, lift: 0.62, wash: 0.31, density: 1.21, scale: 0.91, turn: 0.74, stretch: 1.14 };

/* The persona's difficulty, which js/stage.js hands a piece on env.difficulty (issue #93): one
   setting for the whole site, 1 (gentle) to 5 (fierce), and the middle of the dial where nobody
   has moved it. Spelled out here rather than imported from js/persona.js, because a module is
   played with nothing but the harness beside it. A piece has to be a legitimate puzzle at every
   stop, which is what judgeModule plays below; a card carries no setting at all, so sparkOf()
   hands none and a module reads the middle through a defensive helper of its own. */
export const DIFFICULTY_NAMES = ['gentle', 'mild', 'fair', 'keen', 'fierce'];
export function difficultyAt(level) {
  const at = Math.max(1, Math.min(DIFFICULTY_NAMES.length, Math.round(Number(level)) || 3));
  return { level: at, of: DIFFICULTY_NAMES.length, name: DIFFICULTY_NAMES[at - 1] };
}
export const MIDDLE_DIFFICULTY = difficultyAt(3);

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

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The same env js/stage.js makes, less the document: the seeded source, the sky, the world's
// colours, the configuration this piece is of (`variant`), the card it was opened from (`card`,
// null for a piece nobody pressed) and the difficulty the visitor asked for (`difficulty`, null
// for the card's own env, which carries no setting).
/* rite:begin -- the same text stands in .github/scripts/piece_harness.mjs, which plays a module
   with no variant.js beside it; RealSiteTest holds the two copies to be one. */
/* ---- the rite: how a piece moves -----------------------------------------------------------

   Nothing a module draws moves along a formula either (README: "Motion axiom", the cut). A
   selection does not fade to another opacity, a wheel does not turn evenly, a solved thing does
   not wash in: each changes in a few treads, always forward, and a surface that changes changes by
   its area behind ONE clean edge -- a slice at an angle, or a curve round a point -- never a
   pattern, a noise or a scatter of cells. The piece's rite is rolled from its seed, so the same
   seed plays the same rite and a different seed a different one. env.rite is that roll, handed to
   every module by every env builder (js/feed.js, js/stage.js and the three harnesses):

     rite.ease(t)           t -> y in a few treads that land: the first the longest way, each
                            after it shorter -- what a thing travelling to a new place moves by
     rite.stair(t, n)       t stepped onto n even treads after a hold (the roll's own count when n
                            is not given; two to five whatever n asks): what a thing changing its
                            state moves by
     rite.ratchet(t)        t turned in even clicks, a clock's: how a wheel, a dial or a whole
                            scene turns, never a smooth rotation (rite.turn is the same)
     rite.flicker(t)        0 or 1: a thing arriving is cut on at the roll's moment and stays
     rite.series(t, n)      the count reached at t, 0 to n, in at most five treads (a count of
                            more than five takes several at a tread): a counter, a notch
     rite.kind, rite.angle  the piece's edge: 'slice' (a straight edge at `angle` degrees, 0 up,
                            90 right) or 'curve' (a circle grown from rite.origin, a corner or an
                            edge's middle of the box, as fractions) -- one per piece, its signature
     rite.paint(g, x, y, w, h, k, style)
                            the part of the box (x, y, w, h) the edge has passed at coverage k
                            (0..1), filled through g in one path: one polygon or one arc, never
                            cells; style, if given, is the fillStyle
     rite.region(g, x, y, w, h, k)
                            the same part added to g's current path, to fill, stroke or clip with
     rite.matte(u, v, k)    whether the point (u, v) of a box, in fractions of it, is behind the
                            edge at coverage k
     rite.treads            the roll's tread count
     rite.at(seed)          the same edge (kind, angle, origin) with its treads and its moment
                            rolled afresh from another seed: one per thing the piece moves, so
                            every movement differs and every one cuts the way the piece does

   Pure arithmetic over the seed and nothing more: no browser, no clock, no Math.random. */

export function rite(seed) {
  return riteOf(seed);
}

const RITE_ANGLES = [90, 112, 135, 150, 180, 45, 0, 270];
const RITE_ORIGINS = [[0, 1], [1, 1], [0, 0], [1, 0], [0.5, 1], [0, 0.5]];

function riteOf(seed, edge) {
  const src = mulberry32(((seed >>> 0) ^ 0x9e3779b9) >>> 0);
  const rnd = () => src();
  const between = (a, b) => a + rnd() * (b - a);
  // The edge is the piece's signature: rolled once from its seed, kept by every at().
  const sig = edge || {
    kind: rnd() < 0.5 ? 'slice' : 'curve',
    angle: RITE_ANGLES[Math.floor(rnd() * RITE_ANGLES.length)],
    origin: RITE_ORIGINS[Math.floor(rnd() * RITE_ORIGINS.length)]
  };
  if (edge) rnd();

  // The treads: a hold, then evenly spaced jumps.
  const treads = 3 + Math.floor(rnd() * 3);
  const first = between(0.18, 0.32);
  const last = between(0.82, 0.92);
  const momentsFor = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(n === 1 ? last : first + (last - first) * (i / (n - 1)));
    return out;
  };
  const clamp01 = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p);
  // Two to five treads, whatever a caller asks: one is a cut, and past five a stair is a ladder.
  const treadsOf = (n) => Math.min(5, Math.max(2, Math.floor(n || treads)));
  const stair = (p, n) => {
    const q = clamp01(p);
    if (q >= 1) return 1;
    const k = treadsOf(n);
    const moments = momentsFor(k);
    let i = 0;
    while (i < k && moments[i] <= q) i++;
    return i / k;
  };

  // The landing: the first tread the longest way, each after it shorter and held longer.
  const ratio = between(0.42, 0.62);
  const rises = [];
  let total = 0;
  for (let i = 0; i < treads; i++) {
    const r = Math.pow(ratio, i);
    rises.push(r);
    total += r;
  }
  const lands = [];
  let gap = between(0.08, 0.16);
  let at = gap;
  for (let i = 0; i < treads; i++) {
    lands.push(at);
    gap *= between(1.25, 1.55);
    at += gap;
  }
  const scale = between(0.82, 0.92) / lands[treads - 1];
  for (let i = 0; i < treads; i++) lands[i] *= scale;
  const ease = (p) => {
    const q = clamp01(p);
    if (q >= 1) return 1;
    let y = 0;
    for (let i = 0; i < treads && lands[i] <= q; i++) y += rises[i] / total;
    return Math.min(1, y);
  };

  // The ratchet: even clicks, evenly spaced -- a clock's, never a slip.
  const clicks = treads;
  const ratchet = (p) => {
    const q = clamp01(p);
    if (q >= 1) return 1;
    return Math.min(1, Math.floor(q * (clicks + 1)) / clicks);
  };

  // The flicker: cut on at the roll's moment, and on from then.
  const onAt = between(0.12, 0.4);
  const flicker = (p) => (clamp01(p) >= onAt && p > 0 ? 1 : 0);

  // A count of n reached on the stair's treads: whole numbers only, never past n, and a count of
  // more than five shared out over five treads rather than climbed one at a time.
  const series = (p, n) => {
    const m = Math.max(1, Math.floor(n || treads));
    return Math.round(stair(p, treadsOf(m)) * m);
  };

  // The edge in a box: the slice's direction (0deg up, 90deg right), or the curve's centre.
  const rad = (sig.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  // How far along the slice's direction a point of the box is, 0 at the corner it starts from
  // and 1 at the corner it ends on; and how far from the curve's centre, 1 at the farthest corner.
  const reach = (px, py, x, y, w, h) => {
    if (sig.kind === 'slice') {
      const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2 || 1;
      return ((px - (x + w / 2)) * dx + (py - (y + h / 2)) * dy + half) / (2 * half);
    }
    const ox = x + sig.origin[0] * w;
    const oy = y + sig.origin[1] * h;
    const far = Math.max(Math.hypot(x - ox, y - oy), Math.hypot(x + w - ox, y - oy), Math.hypot(x - ox, y + h - oy), Math.hypot(x + w - ox, y + h - oy)) || 1;
    return Math.hypot(px - ox, py - oy) / far;
  };
  const matte = (u, v, k) => {
    const c = clamp01(k);
    if (c <= 0) return false;
    if (c >= 1) return true;
    return reach(u, v, 0, 0, 1, 1) < c;
  };
  // The part of the box behind the edge, added to g's path: the box cut by the slice's line (a
  // polygon of up to five corners), or the curve's disc.
  const region = (g, x, y, w, h, k) => {
    const c = clamp01(k);
    if (!g || c <= 0) return;
    if (c >= 1) {
      g.rect(x, y, w, h);
      return;
    }
    if (sig.kind === 'curve') {
      const ox = x + sig.origin[0] * w;
      const oy = y + sig.origin[1] * h;
      const far = Math.max(Math.hypot(x - ox, y - oy), Math.hypot(x + w - ox, y - oy), Math.hypot(x - ox, y + h - oy), Math.hypot(x + w - ox, y + h - oy));
      g.moveTo(ox + far * c, oy);
      g.arc(ox, oy, far * c, 0, Math.PI * 2);
      return;
    }
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const inside = (pt) => reach(pt[0], pt[1], x, y, w, h) <= c;
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const ra = reach(a[0], a[1], x, y, w, h);
      const rb = reach(b[0], b[1], x, y, w, h);
      if (ra <= c) out.push(a);
      if ((ra <= c) !== (rb <= c)) {
        const f = (c - ra) / (rb - ra);
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
    }
    if (out.length < 3 && !inside(corners[0])) return;
    for (let i = 0; i < out.length; i++) {
      if (i === 0) g.moveTo(out[i][0], out[i][1]);
      else g.lineTo(out[i][0], out[i][1]);
    }
    g.closePath();
  };
  const paint = (g, x, y, w, h, k, style) => {
    const c = clamp01(k);
    if (c <= 0 || !g || typeof g.fillRect !== 'function') return;
    if (style != null) g.fillStyle = style;
    if (c >= 1) {
      g.fillRect(x, y, w, h);
      return;
    }
    if (sig.kind === 'curve') {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      g.beginPath();
      region(g, x, y, w, h, c);
      g.fill();
      g.restore();
      return;
    }
    g.beginPath();
    region(g, x, y, w, h, c);
    g.fill();
  };

  return {
    ease, stair, ratchet, flicker, matte, paint, region, series,
    turn: ratchet,
    treads, kind: sig.kind, angle: sig.angle, origin: sig.origin.slice(),
    at: (other) => riteOf(((seed >>> 0) ^ (other >>> 0) ^ 0x51a7c0de) >>> 0, sig)
  };
}
/* rite:end */

export function makeEnv(seed, stars, variant, card, difficulty) {
  const rnd = mulberry32(seed);
  const list = stars || STARS;
  return {
    seed,
    rnd,
    pick: (items) => items[Math.floor(rnd() * items.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    hash,
    stars: list,
    points(w, h, pad) {
      const p = pad || 0;
      return list.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    colors: Object.assign({}, COLORS),
    mix,
    alpha,
    reduced: false,
    world: { file: 'world.html', name: 'a world', orientation: 'an orientation' },
    variant: variant || PLAIN_DIALS,
    card: card || null,
    difficulty: difficulty || null,
    rite: riteOf(seed)
  };
}

/* The card a seed and a configuration would be dealt, the way js/feed.js makes one and js/stage.js
   derives one for a piece nobody pressed: the module's own spark() for that very configuration.
   Null when the module makes nothing for it, which is a world with nothing to say right now. */
export function sparkOf(mod, seed, stars, variant) {
  if (!mod || typeof mod.spark !== 'function') return null;
  try {
    const spec = mod.spark(makeEnv(seed, stars, variant, null));
    if (!spec || typeof spec !== 'object') return null;
    const line = (value) => (typeof value === 'string' ? value : '');
    return {
      kind: 'spark',
      overline: line(spec.overline),
      title: line(spec.title),
      quote: line(spec.quote),
      text: line(spec.text),
      mono: line(spec.mono),
      cite: line(spec.cite),
      aspect: line(spec.aspect),
      of: spec.of || null
    };
  } catch (err) {
    return null;
  }
}

// A 2D context that accepts anything and records nothing, with a real context's defaults.
function stubContext(canvas) {
  const state = {
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    miterLimit: 10, lineDashOffset: 0, font: '10px sans-serif', textAlign: 'start',
    textBaseline: 'alphabetic', direction: 'ltr', globalAlpha: 1, globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', letterSpacing: '0px', wordSpacing: '0px',
    fontKerning: 'auto', fontStretch: 'normal', fontVariantCaps: 'normal', textRendering: 'auto'
  };
  const gradient = () => ({ addColorStop() {} });
  const image = (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w | 0, height: h | 0, colorSpace: 'srgb' });
  const special = {
    canvas,
    measureText: (text) => ({ width: String(text || '').length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(text || '').length * 8, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({ setTransform() {} }),
    getImageData: (x, y, w, h) => image(w, h),
    createImageData: (w, h) => image(typeof w === 'object' ? w.width : w, typeof w === 'object' ? w.height : h),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getLineDash: () => [],
    getContextAttributes: () => ({ alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: false })
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in special) return special[prop];
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function signatureOf(piece) {
  const steps = (piece.steps || []).map((s) => ({
    id: s.id, ask: s.ask, kind: s.kind, after: s.after,
    options: Array.isArray(s.options) ? s.options.map((o) => [o.label, o.value]) : undefined,
    items: Array.isArray(s.items) ? s.items.map((o) => [o.label, o.value]) : undefined,
    min: s.min, max: s.max, step: s.step, value: s.value, count: s.count, ms: s.ms, low: s.low, high: s.high, label: s.label,
    rows: s.rows, cols: s.cols, states: s.states, length: s.length, optional: s.optional
  }));
  return JSON.stringify({ title: piece.title, brief: piece.brief, goal: piece.goal, aspect: piece.aspect, steps,
    solution: piece.solution });
}

const isPoint = (pt) => pt && typeof pt === 'object' && isFinite(Number(pt.x)) && isFinite(Number(pt.y));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The range a range or number knob runs over, with the stage's own defaults. */
function span(step) {
  const min = Number(step.min == null ? 0 : step.min);
  const max = Number(step.max == null ? 100 : step.max);
  const inc = Number(step.step == null ? 1 : step.step) || 1;
  return { min, max, inc };
}

/* The target a range or number solution names: { value, near } or a bare number. */
function target(sol) {
  if (sol && typeof sol === 'object' && !Array.isArray(sol)) return { value: Number(sol.value), near: Math.max(0, Number(sol.near) || 0) };
  return { value: Number(sol), near: 0 };
}

/* What is wrong with `piece` as a puzzle, before it is played: the shape of its knobs and of the
   solution it declares for them. Every reason is one fixed phrase about one knob. */
function shapeProblems(piece) {
  const problems = [];
  if (!piece || typeof piece !== 'object') return ['piece() returned nothing'];
  if (typeof piece.title !== 'string' || !piece.title.trim()) problems.push('the piece has no title');
  if (typeof piece.goal !== 'string' || !piece.goal.trim()) problems.push('the piece has no goal; a puzzle says in one line what counts as solved');
  if (typeof piece.check !== 'function') problems.push('the piece has no check(); a puzzle has a verifier');
  const solution = piece.solution;
  if (!solution || typeof solution !== 'object' || Array.isArray(solution) || !Object.keys(solution).length) {
    problems.push('the piece has no solution; a puzzle knows the answer that solves it');
  }
  if (!Array.isArray(piece.steps) || !piece.steps.length) problems.push('the piece has no knobs (steps)');
  else {
    if (piece.steps.length < MIN_STEPS) problems.push('the piece has ' + piece.steps.length + ' knob; a flow is at least ' + MIN_STEPS);
    if (piece.steps.length > MAX_STEPS) problems.push('the piece has ' + piece.steps.length + ' knobs; at most ' + MAX_STEPS + ' finish expediently');
    const seen = new Set();
    piece.steps.forEach((s, i) => {
      const at = 'knob ' + (i + 1);
      if (!s || typeof s !== 'object') return problems.push(at + ' is not an object');
      if (typeof s.id !== 'string' || !s.id) problems.push(at + ' has no id');
      else if (seen.has(s.id)) problems.push(at + ' repeats the id "' + s.id + '"');
      seen.add(s.id);
      if (KINDS.indexOf(s.kind) === -1) problems.push(at + ' has a kind the stage does not render: ' + JSON.stringify(s.kind));
      if (typeof s.ask !== 'string' || !s.ask.trim()) problems.push(at + ' has no ask');
      if (s.kind === 'choice' && (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4)) {
        problems.push(at + ' is a choice with ' + (Array.isArray(s.options) ? s.options.length : 'no') + ' options; two to four');
      }
      if ((s.kind === 'order' || s.kind === 'pick') && (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > (s.kind === 'order' ? 8 : 12))) {
        problems.push(at + ' is ' + (s.kind === 'order' ? 'an order' : 'a pick') + ' with ' + (Array.isArray(s.items) ? s.items.length : 'no') + ' items; two to ' + (s.kind === 'order' ? 'eight' : 'twelve'));
      }
      if (s.kind === 'grid') {
        const rows = Number(s.rows) || 3;
        const cols = Number(s.cols) || 3;
        if (rows < 1 || rows > 10 || cols < 1 || cols > 10) problems.push(at + ' is a grid of ' + rows + ' by ' + cols + '; one to ten each way');
      }
      if ((s.kind === 'range' || s.kind === 'number') && !(span(s).max > span(s).min)) problems.push(at + ' runs from ' + span(s).min + ' to ' + span(s).max + '; a range needs room');
      if (s.kind === 'tap' && typeof piece.tap !== 'function') problems.push(at + ' is a tap knob but the piece has no tap()');
      if (s.after != null) {
        const earlier = piece.steps.slice(0, i).some((e) => e && e.id === s.after);
        if (!earlier) problems.push(at + ' comes after "' + s.after + '", which is not an earlier knob');
      }
    });
    // The solution, knob by knob: it has to name answers the stage can actually set.
    if (solution && typeof solution === 'object' && !Array.isArray(solution)) {
      for (const id of Object.keys(solution)) {
        const step = piece.steps.find((s) => s && s.id === id);
        const sol = solution[id];
        const at = 'the solution for "' + id + '"';
        if (!step) {
          problems.push(at + ' names a knob the piece has not got');
          continue;
        }
        if (ANSWER_KINDS.indexOf(step.kind) === -1) {
          problems.push(at + ' names a ' + step.kind + ' knob; a press, a hold or a wait is never an answer');
          continue;
        }
        if (step.optional === true) {
          problems.push(at + ' names an optional knob; an answer is never optional');
          continue;
        }
        switch (step.kind) {
          case 'choice':
            if (!Array.isArray(step.options) || !step.options.some((o) => o && o.value === sol)) problems.push(at + ' is not one of its options');
            break;
          case 'toggle':
            if (typeof sol !== 'boolean') problems.push(at + ' is not true or false');
            break;
          case 'range':
          case 'number': {
            const { min, max } = span(step);
            const t = target(sol);
            if (!isFinite(t.value) || t.value < min || t.value > max) problems.push(at + ' is off its range');
            else if (t.near >= (max - min) / 2) problems.push(at + ' allows ' + t.near + ' either way, which is half its range or more; a target needs an edge');
            else if (Math.abs(t.value - (t.value > (min + max) / 2 ? min : max)) <= t.near) problems.push(at + ' is solved at the far end of its range too');
            break;
          }
          case 'word':
            if (typeof sol !== 'string' || !sol.trim()) problems.push(at + ' is not a word');
            else if (step.length && sol.trim().length > Number(step.length)) problems.push(at + ' is longer than the field allows');
            break;
          case 'order': {
            const values = Array.isArray(step.items) ? step.items.map((i) => i && i.value) : [];
            if (!Array.isArray(sol) || sol.length !== values.length || !values.every((v) => sol.includes(v)) || new Set(sol).size !== sol.length) {
              problems.push(at + ' is not an order of its items');
            }
            break;
          }
          case 'pick': {
            const values = Array.isArray(step.items) ? step.items.map((i) => i && i.value) : [];
            const count = step.count == null ? 0 : Number(step.count);
            if (!Array.isArray(sol) || !sol.every((v) => values.includes(v)) || new Set(sol).size !== sol.length) problems.push(at + ' is not some of its items');
            else if (count && sol.length !== count) problems.push(at + ' picks ' + sol.length + ' where the knob asks for ' + count);
            else if (sol.length >= values.length) problems.push(at + ' picks every item, so nothing could be picked wrongly');
            else if (!sol.length) problems.push(at + ' picks nothing');
            break;
          }
          case 'grid': {
            const n = (Number(step.rows) || 3) * (Number(step.cols) || 3);
            const states = Math.max(2, Math.min(6, Number(step.states) || 2));
            if (!Array.isArray(sol) || sol.length !== n || !sol.every((v) => Number.isInteger(v) && v >= 0 && v < states)) {
              problems.push(at + ' is not ' + n + ' cell states');
            }
            break;
          }
          case 'tap':
            if (!sol || typeof sol !== 'object' || !Array.isArray(sol.taps) || !sol.taps.length || !sol.taps.every(isPoint)
                || !Array.isArray(sol.wrong) || !sol.wrong.length || !sol.wrong.every(isPoint)) {
              problems.push(at + ' needs its taps and its wrong points, each a list of { x, y }');
            } else if (sol.taps.length + sol.wrong.length > MAX_TAPS) {
              problems.push(at + ' needs more than ' + MAX_TAPS + ' taps to play');
            }
            break;
          default:
            break;
        }
      }
    }
  }
  return problems;
}

/* The wrong value for an answer knob: one the stage can set, as far from the solution as the knob
   allows, so a verifier that says yes to it is a verifier that is not looking. */
export function wrongFor(step, sol) {
  switch (step.kind) {
    case 'choice':
      return step.options.find((o) => o && o.value !== sol).value;
    case 'toggle':
      return !sol;
    case 'range':
    case 'number': {
      const { min, max } = span(step);
      const t = target(sol);
      return t.value > (min + max) / 2 ? min : max;
    }
    case 'word': {
      const word = String(sol).trim();
      const last = word.slice(-1).toUpperCase();
      return word.slice(0, -1) + (last === 'X' ? 'Y' : 'X');
    }
    case 'order': {
      const out = sol.slice();
      [out[0], out[1]] = [out[1], out[0]];
      return out;
    }
    case 'pick': {
      const values = step.items.map((i) => i.value);
      const unchosen = values.find((v) => !sol.includes(v));
      const out = sol.slice(1);
      out.push(unchosen);
      return values.filter((v) => out.includes(v));
    }
    case 'grid': {
      const states = Math.max(2, Math.min(6, Number(step.states) || 2));
      const out = sol.slice();
      out[0] = (out[0] + 1) % states;
      return out;
    }
    case 'tap':
      return sol.wrong;
    default:
      return sol;
  }
}

/* The value an answer knob opens on, the way the stage opens it, or undefined for a kind that
   opens unset (a choice, an empty word). */
function initialOf(step) {
  switch (step.kind) {
    case 'toggle':
      return !!step.value;
    case 'range':
    case 'number': {
      const { min, max } = span(step);
      if (step.kind === 'number') return step.value == null ? min : Number(step.value);
      return step.value == null ? (min + max) / 2 : Number(step.value);
    }
    case 'order': {
      const values = step.items.map((i) => i.value);
      return Array.isArray(step.value) && step.value.length === values.length && step.value.every((v) => values.includes(v)) ? step.value.slice() : values;
    }
    case 'pick': {
      const values = step.items.map((i) => i.value);
      const chosen = (Array.isArray(step.value) ? step.value : []).filter((v) => values.includes(v));
      const count = step.count == null ? 0 : Number(step.count);
      return !chosen.length || (count && chosen.length !== count) ? undefined : values.filter((v) => chosen.includes(v));
    }
    case 'grid': {
      const n = (Number(step.rows) || 3) * (Number(step.cols) || 3);
      const states = Math.max(2, Math.min(6, Number(step.states) || 2));
      return Array.isArray(step.value) && step.value.length === n ? step.value.map((v) => (((Number(v) | 0) % states) + states) % states) : new Array(n).fill(0);
    }
    default:
      return undefined;
  }
}

/* Play one piece to its check, as the stage would, and press it. Returns { ok, solved, problems,
   taps, seconds, title }. `opts.answers` says what goes on the answer knobs: 'solution' (the
   default), 'wrong' (every answer wrong), { only: id } (that answer wrong, the rest right) or
   'initial' (every answer left as it opened), and `opts.expect` whether the check should solve. */
export function play(mod, seed, options) {
  const opts = options || {};
  const stars = opts.stars || STARS;
  // The configuration this play is of, and the card it is of: what the stage hands a piece on
  // env.variant and env.card (the alignment axiom). The no-op configuration and no card unless
  // the caller asks for others, so every play below is one the stage could have opened.
  const variant = opts.variant || PLAIN_DIALS;
  const card = opts.card || null;
  // The difficulty this play is at: the middle of the dial unless the caller names another, so
  // every play below is one the stage could have opened.
  const difficulty = opts.difficulty || MIDDLE_DIFFICULTY;
  const answers = opts.answers || 'solution';
  const expect = opts.expect == null ? true : !!opts.expect;
  const out = { seed, stars: stars.length, label: opts.label || '', difficulty: difficulty.level, ok: false, solved: false, tries: 0, problems: [], taps: 0, seconds: 0, title: '', steps: 0, signature: '' };
  let piece;
  try {
    piece = mod.piece(makeEnv(seed, stars, variant, card, difficulty));
  } catch (err) {
    out.problems.push('piece() threw: ' + (err && err.message || err));
    return out;
  }
  const shape = shapeProblems(piece);
  if (shape.length) {
    out.problems.push(...shape);
    return out;
  }
  out.title = piece.title;
  out.steps = piece.steps.length;
  out.signature = signatureOf(piece);
  try {
    const again = mod.piece(makeEnv(seed, stars, variant, card, difficulty));
    if (signatureOf(again) !== out.signature) out.problems.push('the same seed does not make the same piece');
  } catch (err) {
    out.problems.push('piece() threw the second time: ' + (err && err.message || err));
  }
  if (out.problems.length) return out;

  const driver = mulberry32(seed ^ 0x5bd1e995);
  const canvas = { width: W, height: H, getContext: () => g };
  const g = stubContext(canvas);
  const state = new Map(piece.steps.map((s) => [s.id, { step: s, set: false, value: undefined }]));
  let completed = false;
  let resting = false;
  let inFrame = false;
  let ended = false;
  let touched = false; // has the visitor set a knob yet?
  let inTap = false;
  let time = 0;
  let tries = 0;
  const env = makeEnv(seed, stars, variant, card, difficulty);

  // What each answer knob is to be set to in this play, and whether it can be at all.
  const wanted = new Map();
  for (const id of Object.keys(piece.solution)) {
    const step = state.get(id).step;
    const sol = piece.solution[id];
    let value;
    if (answers === 'solution') value = sol;
    else if (answers === 'wrong') value = wrongFor(step, sol);
    else if (answers && typeof answers === 'object' && answers.only === id) value = wrongFor(step, sol);
    else if (answers === 'initial') value = initialOf(step);
    else value = sol;
    wanted.set(id, value);
  }

  function allSet() {
    for (const s of state.values()) if (!s.set && s.step.optional !== true) return false;
    return true;
  }
  function finish() {
    if (completed) return;
    completed = true;
    resting = false;
    if (!ended && typeof piece.end === 'function') {
      ended = true;
      piece.end(ctx);
    }
  }
  function mark(id, value) {
    const s = state.get(id);
    if (!s) return;
    if (!inFrame) resting = false;
    if (value !== undefined) s.value = value;
    if (!s.set) s.set = true;
  }
  const ctx = {
    canvas, g, w: W, h: H, dpr: 1,
    colors: env.colors, rnd: env.rnd, pick: env.pick, int: env.int, chance: env.chance, stars,
    points: env.points,
    mix, alpha, reduced: false, rite: env.rite,
    satisfy(id, value) {
      const s = state.get(id);
      if (!s) return;
      if (!touched) out.problems.push('the piece set knob "' + id + '" itself before the visitor had set anything');
      else if (s.step.kind !== 'tap' && s.step.kind !== 'wait') out.problems.push('the piece set knob "' + id + '" itself; only a tap or a wait knob is the piece\'s to set');
      mark(id, value);
    },
    set(id, value) {
      if (!inTap) {
        out.problems.push('the piece called ctx.set("' + id + '") outside tap(); a knob is the visitor\'s to set');
        return false;
      }
      const s = state.get(id);
      if (!s) return false;
      mark(id, value);
      return true;
    },
    hint() {},
    progress() {},
    status() {},
    value(id) { const s = state.get(id); return s ? s.value : undefined; },
    get tries() { return tries; },
    get hints() { return 0; },
    get done() { return completed; },
    get elapsed() { return time; }
  };
  function apply(id, value) {
    touched = true;
    resting = false;
    const s = state.get(id);
    if (s) s.value = value;
    if (typeof piece.apply === 'function') piece.apply(id, value, ctx);
  }
  // The frames, as js/stage.js gives them ("The frames."): a piece's frame() that answers false is
  // at rest, and is asked for no more frames until something sets it going again -- a knob, a tap,
  // a check, its end, or a knob it sets itself from outside its own frame. A piece that answers
  // false while it still has something to move, or while a wait knob is still waiting on its
  // frames, stalls here exactly as it would stall on the stage.
  function frames(seconds) {
    const n = Math.max(1, Math.round(seconds / FRAME));
    for (let i = 0; i < n && time < MAX_SECONDS + 1; i++) {
      time += FRAME;
      if (resting || typeof piece.frame !== 'function') continue;
      inFrame = true;
      try {
        if (piece.frame(time, FRAME, ctx) === false) resting = true;
      } finally {
        inFrame = false;
      }
    }
  }
  function tapAt(x, y) {
    touched = true;
    resting = false;
    inTap = true;
    try {
      piece.tap(x, y, ctx);
    } finally {
      inTap = false;
    }
    out.taps += 1;
    frames(0.2);
  }
  function unlocked(s) {
    return !s.step.after || (state.get(s.step.after) || { set: true }).set;
  }
  // The order a visitor meets the knobs in. Written order by default, because that is the order
  // the stage lays them out; seeded with `shuffle`, because nothing makes a visitor work down the
  // page -- they reach for whatever the piece has just drawn their eye to, and a piece that can
  // only be solved from the top down is a piece some visitor cannot solve.
  function reach() {
    // An optional knob -- a hint -- is one a visitor may never touch, so the shuffled plays leave
    // it alone and the plays in written order press it: the puzzle has to solve both ways.
    const list = Array.from(state.values()).filter((s) => !opts.shuffle || s.step.optional !== true);
    if (!opts.shuffle) return list;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(driver() * (i + 1));
      const held = list[i];
      list[i] = list[j];
      list[j] = held;
    }
    return list;
  }
  // The check, pressed: the verifier is asked, and a solve ends the piece.
  function judge() {
    tries += 1;
    resting = false;
    const verdict = piece.check(ctx);
    const solved = !!(verdict && verdict.solved);
    if (verdict && verdict.say != null && typeof verdict.say !== 'string') out.problems.push('check() said something that is not a string');
    if (solved) finish();
    return solved;
  }

  try {
    // Where each knob that opens on a value starts, known to the piece from the first frame, as on
    // the stage.
    for (const s of state.values()) {
      const initial = initialOf(s.step);
      if (initial !== undefined) s.value = initial;
      if (s.step.kind === 'word') s.value = '';
    }
    if (typeof piece.start === 'function') piece.start(ctx);
    frames(SETTLE);
    // Knobs in order, skipping locked ones until their gate opens; a pass that sets nothing ends it.
    let moved = true;
    while (!allSet() && moved && time < MAX_SECONDS) {
      moved = false;
      for (const s of reach()) {
        if (s.set || !unlocked(s)) continue;
        const step = s.step;
        const answer = wanted.has(step.id);
        const want = wanted.get(step.id);
        switch (step.kind) {
          case 'choice': {
            const option = answer ? step.options.find((o) => o && o.value === want) : step.options[Math.floor(driver() * step.options.length)];
            apply(step.id, option.value);
            mark(step.id, option.value);
            break;
          }
          case 'toggle': {
            // The first press flips it, as on the stage; an answer that is where it opened takes
            // two presses, there and back, because a press is what sets a toggle.
            let on = !step.value;
            apply(step.id, on);
            mark(step.id, on);
            if (answer && on !== want) {
              on = !on;
              apply(step.id, on);
              mark(step.id, on);
            }
            break;
          }
          case 'range':
          case 'number': {
            const { min, max, inc } = span(step);
            const v = answer ? target(want).value : min + Math.round(((max - min) * driver()) / inc) * inc;
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'word': {
            const v = answer ? String(want) : 'A';
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'order': {
            const v = answer ? want.slice() : initialOf(step);
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'pick': {
            let v;
            if (answer) v = want.slice();
            else {
              const values = step.items.map((i) => i.value);
              const count = step.count == null ? 1 : Number(step.count);
              v = values.slice(0, Math.max(1, count));
            }
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'grid': {
            const v = answer ? want.slice() : initialOf(step);
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'press': {
            const count = Math.max(1, Math.min(12, Number(step.count) || 3));
            for (let n = 1; n <= count; n++) {
              apply(step.id, n);
              frames(0.1);
            }
            mark(step.id, count);
            break;
          }
          case 'hold': {
            const ms = Math.max(300, Math.min(8000, Number(step.ms) || 1500));
            frames(ms / 1000);
            apply(step.id, ms);
            mark(step.id, ms);
            break;
          }
          case 'tap':
            if (answer) {
              // The piece's own points, in order; a tap answer is set by its taps, right or wrong,
              // and the check is what judges them.
              const points = Array.isArray(want) ? want : [];
              for (const pt of points) {
                if (s.set || out.taps >= MAX_TAPS) break;
                tapAt(Number(pt.x), Number(pt.y));
              }
              if (!s.set) {
                out.problems.push('knob "' + step.id + '" was not set by its ' + (answers === 'solution' || (answers && answers.only !== step.id && answers !== 'wrong') ? 'solution' : 'wrong') + ' taps; a tap answer is set by any taps and judged by check()');
              }
            } else {
              while (!s.set && out.taps < MAX_TAPS) tapAt(0.1 + driver() * 0.8, 0.1 + driver() * 0.8);
              if (!s.set) out.problems.push('knob "' + step.id + '" was not set by ' + MAX_TAPS + ' taps of the scene');
            }
            break;
          case 'wait':
            while (!s.set && time < MAX_SECONDS) frames(0.5);
            if (!s.set) out.problems.push('knob "' + step.id + '" was not set by ' + MAX_SECONDS + ' seconds of frames');
            break;
          default:
            break;
        }
        if (s.set) moved = true;
        if (out.problems.length) break;
        frames(SETTLE);
      }
      if (out.problems.length) break;
    }
    if (!out.problems.length) {
      if (!allSet()) {
        const stuck = Array.from(state.values()).filter((s) => !s.set && s.step.optional !== true).map((s) => s.step.id);
        out.problems.push('the piece never came to its check; still unset: ' + stuck.join(', '));
      } else if (completed) {
        out.problems.push('the piece was solved before its check was pressed');
      } else {
        // A check is a question and not a move: asked twice, it answers the same.
        const first = judge();
        out.solved = first;
        if (!first) {
          const second = judge();
          if (second !== first) out.problems.push('check() changed its mind when pressed again');
        }
        if (expect && !first) out.problems.push('the solution does not solve the puzzle (' + (answers === 'solution' ? 'every answer at its solution' : String(answers)) + ')');
        if (!expect && first) {
          const which = answers === 'wrong' ? 'every answer wrong' : answers === 'initial' ? 'every answer left as it opened' : 'only "' + answers.only + '" wrong';
          out.problems.push('the puzzle is solved with ' + which + '; ' + (answers === 'initial' ? 'a puzzle that opens solved is no puzzle' : 'an answer that does not matter is not an answer'));
        }
      }
    }
    if (completed) frames(1);
  } catch (err) {
    out.problems.push('the piece threw while played: ' + (err && err.stack ? String(err.stack).split('\n').slice(0, 2).join(' ') : err));
  }
  out.tries = tries;
  out.seconds = Math.round(time * 10) / 10;
  out.ok = !out.problems.length && (expect ? completed : !completed);
  return out;
}

/* The answer knobs a piece has, and whether every one of them opens on a value: the plays that
   leave the answers as they opened are only possible then. */
function answersOf(mod, seed) {
  try {
    const piece = mod.piece(makeEnv(seed, STARS, PLAIN_DIALS, null, MIDDLE_DIFFICULTY));
    if (!piece || !piece.solution || !Array.isArray(piece.steps)) return { ids: [], opensSet: false };
    const ids = Object.keys(piece.solution).filter((id) => piece.steps.some((s) => s && s.id === id));
    const opensSet = ids.length > 0 && ids.every((id) => {
      const step = piece.steps.find((s) => s.id === id);
      return step && initialOf(step) !== undefined;
    });
    return { ids, opensSet };
  } catch (err) {
    return { ids: [], opensSet: false };
  }
}

// Judge one module, already imported: every seed solved with the five stars, the first seed again
// with the sky the stage may hand it (none for a module that does not read the sky, one star for
// one that does), every seed once more with its knobs reached in a seeded order, the first seed
// played through from the top a second time, every seed with its answers wrong (all at once, one
// at a time, and as they opened), and the first seed under a configuration, as the card that
// configuration deals it, and as a card another seed was dealt (the alignment axiom).
export function judgeModule(mod, seeds) {
  const report = { hasPiece: false, ok: false, problems: [], runs: [] };
  if (!mod || typeof mod.piece !== 'function') {
    report.problems.push('the module exports no piece()');
    return report;
  }
  report.hasPiece = true;
  for (const seed of seeds) {
    const run = play(mod, seed);
    report.runs.push(run);
    for (const p of run.problems) report.problems.push('seed ' + seed + ': ' + p);
  }
  const signatures = new Set(report.runs.map((r) => r.signature).filter(Boolean));
  if (report.runs.every((r) => r.ok) && signatures.size < 2) {
    report.problems.push('every seed makes the same piece (' + JSON.stringify(report.runs[0].title) + '); the river is of pieces that differ');
  }
  const first = report.runs[0];
  const sky = mod.needsSky ? ONE_STAR : [];
  const skyRun = play(mod, seeds[0], { stars: sky, label: sky.length ? 'one star' : 'no stars' });
  report.runs.push(skyRun);
  for (const p of skyRun.problems) report.problems.push('seed ' + seeds[0] + ' with ' + (sky.length ? 'one star' : 'no stars') + ': ' + p);

  // Reached in another order. Nothing makes a visitor work down the page: they set the knob the
  // scene has just drawn their eye to, and a piece that is only solvable from the top down leaves
  // someone holding an answer that will not check (issue #60).
  for (const seed of seeds) {
    const run = play(mod, seed, { shuffle: true, label: 'another order' });
    report.runs.push(run);
    for (const p of run.problems) report.problems.push('seed ' + seed + ', its knobs reached in another order: ' + p);
  }

  // Played again, through the module that has already made a piece in this session. A visitor
  // meets a world more than once -- the feed deals it again, the river comes round -- and the
  // second piece has to be the first one all over again, not whatever the first one left behind.
  // Same piece, same play, same end: this run is the one that catches a module keeping state
  // outside piece(env) (issue #60).
  const replay = play(mod, seeds[0], { label: 'played again' });
  report.runs.push(replay);
  for (const p of replay.problems) report.problems.push('seed ' + seeds[0] + ' played a second time: ' + p);
  if (first && first.ok && replay.ok) {
    if (replay.signature !== first.signature) {
      report.problems.push('seed ' + seeds[0] + ' played a second time makes a different piece; a module keeps nothing between instantiations');
    } else if (replay.taps !== first.taps || replay.seconds !== first.seconds) {
      report.problems.push('seed ' + seeds[0] + ' played a second time does not play out the same (' + first.taps + ' taps, '
        + first.seconds + 's, then ' + replay.taps + ' taps, ' + replay.seconds + 's); a module keeps nothing between instantiations');
    }
  }

  // The wrong answers. A legitimate puzzle is one a wrong answer does not solve: every answer
  // wrong at once, then each answer wrong on its own with the rest right (so every declared
  // answer is load-bearing), then -- where every answer knob opens on a value -- the answers left
  // exactly as they opened, because a puzzle that opens solved is no puzzle.
  for (const seed of seeds) {
    const wrong = play(mod, seed, { answers: 'wrong', expect: false, label: 'every answer wrong' });
    report.runs.push(wrong);
    for (const p of wrong.problems) report.problems.push('seed ' + seed + ' with every answer wrong: ' + p);
    const { ids, opensSet } = answersOf(mod, seed);
    if (ids.length > 1) {
      for (const id of ids) {
        const one = play(mod, seed, { answers: { only: id }, expect: false, label: 'only ' + id + ' wrong' });
        report.runs.push(one);
        for (const p of one.problems) report.problems.push('seed ' + seed + ' with only "' + id + '" wrong: ' + p);
      }
    }
    if (opensSet) {
      const opened = play(mod, seed, { answers: 'initial', expect: false, label: 'as it opened' });
      report.runs.push(opened);
      for (const p of opened.problems) report.problems.push('seed ' + seed + ' with every answer as it opened: ' + p);
    }
  }

  // The alignment axiom (issue #80): a card and the feature it opens as are one content piece,
  // procedurally configured once. The stage hands the piece the card's configuration on
  // env.variant and the content the card was showing on env.card, so the same seed under a
  // configuration has to solve like any other play, and the piece a card opens as has to be a
  // piece of that card -- different from the one the same seed makes with no card behind it.
  // Otherwise two different cards of one world open the same feature, which is the bug the axiom
  // is here to keep out.
  const configured = play(mod, seeds[0], { variant: CONFIGURED, label: 'configured' });
  report.runs.push(configured);
  for (const p of configured.problems) report.problems.push('seed ' + seeds[0] + ' configured: ' + p);
  // Its own card, and a card of another seed entirely. Both have to play to the end -- a sky can
  // change under a card, so a piece reads the card it is handed defensively -- and the two have to
  // be different pieces, which is the axiom itself: what a feature is follows from the card it was
  // opened from. A module that ignored env.card would open the same item whichever of its cards was
  // pressed, and one that agrees with its cards only because piece() and spark() happen to draw in
  // the same order is one edit away from quietly disagreeing with them.
  const own = sparkOf(mod, seeds[0], STARS, CONFIGURED);
  // A card that says something else: the first other seed whose card is dealt different content,
  // because two cards that read the same are two cards no piece could tell apart.
  const said = (card) => (card ? [card.title, card.overline, card.quote, card.text, card.mono, card.cite].join('|') : '');
  let other = null;
  for (const seed of seeds.slice(1)) {
    const card = sparkOf(mod, seed, STARS, CONFIGURED);
    if (card && said(card) !== said(own)) {
      other = card;
      break;
    }
  }
  const asCard = play(mod, seeds[0], { variant: CONFIGURED, card: own, label: 'as its card' });
  report.runs.push(asCard);
  for (const p of asCard.problems) report.problems.push('seed ' + seeds[0] + ' opened as its own card: ' + p);
  const asOther = play(mod, seeds[0], { variant: CONFIGURED, card: other, label: 'as another card' });
  report.runs.push(asOther);
  for (const p of asOther.problems) report.problems.push('seed ' + seeds[0] + ' opened as another seed\'s card: ' + p);
  report.alignment = {
    hasSpark: typeof mod.spark === 'function',
    // Whether there were two cards to tell apart at all: a module whose spark() deals every seed
    // the same content cannot be held to the axiom here, and the caller is told so rather than
    // left to read a silent pass as one (RealSiteTest asks for it of every world on the site).
    tested: !!(own && other),
    card: own ? (own.title || own.quote || own.mono || own.text) : '',
    other: other ? (other.title || other.quote || other.mono || other.text) : '',
    follows: !!(own && other && asCard.signature && asOther.signature && asCard.signature !== asOther.signature)
  };
  if (own && other && asCard.ok && asOther.ok && !report.alignment.follows) {
    report.problems.push('the piece is the same piece (' + JSON.stringify(asCard.title) + ') whether it is opened from '
      + JSON.stringify(report.alignment.card) + ' or from ' + JSON.stringify(report.alignment.other)
      + '; a feature is the card that was pressed, so piece(env) has to read env.card');
  }

  /* The difficulty (issue #93). One setting the persona keeps for the whole site reaches every
     piece on env.difficulty, so a piece is a puzzle at five settings rather than one, and the law
     holds every one of them to the same thing: the piece's own solution has to solve it, and
     every answer wrong may not. A world whose help or whose margin moves with the dial is the
     point of the setting; a world that opens an unsolvable puzzle at one end of it is the bug.

     A stop takes a seed of its own rather than all five taking the first, because a world may
     deal more than one shape of puzzle and which shape a seed opens is the seed's: five stops on
     one seed would leave the other shapes unplayed at four of them. The first seed is also played
     at the two ends as the card it was dealt as, because a piece follows its card whatever the
     setting: the subject is the seed's and the difficulty is only how hard it is asked. */
  for (let level = 1; level <= DIFFICULTY_NAMES.length; level += 1) {
    const difficulty = difficultyAt(level);
    const seed = seeds[(level - 1) % seeds.length];
    const at = 'seed ' + seed + ' at difficulty ' + difficulty.name;
    const run = play(mod, seed, { difficulty, label: difficulty.name });
    report.runs.push(run);
    for (const p of run.problems) report.problems.push(at + ': ' + p);
    const wrong = play(mod, seed, { difficulty, answers: 'wrong', expect: false, label: difficulty.name + ', every answer wrong' });
    report.runs.push(wrong);
    for (const p of wrong.problems) report.problems.push(at + ' with every answer wrong: ' + p);
    if (own && (level === 1 || level === DIFFICULTY_NAMES.length)) {
      const card = play(mod, seeds[0], { variant: CONFIGURED, card: own, difficulty, label: difficulty.name + ', as its card' });
      report.runs.push(card);
      for (const p of card.problems) {
        report.problems.push('seed ' + seeds[0] + ' at difficulty ' + difficulty.name + ', opened as its own card: ' + p);
      }
    }
  }

  report.ok = report.runs.every((r) => r.ok) && !report.problems.length;
  for (const r of report.runs) delete r.signature;
  return report;
}

// In the worker: nothing a piece may not use is left reachable, then the module is played.
async function workerMain() {
  const forbid = (name) => function () {
    throw new Error(name + ' is not for a piece: randomness comes from the seeded rnd and time from the frame clock the stage hands it');
  };
  Math.random = forbid('Math.random');
  Date.now = forbid('Date.now');
  globalThis.Date = forbid('Date');
  // performance.now is a non-writable own property of the Performance global on some Node
  // versions, so a plain assignment throws under strict mode and would kill the whole worker --
  // reporting every module failed. Redefine it instead when assignment will not take, so the
  // clock really is taken away (a swallowed assignment would leave the real clock in place, which
  // is exactly what must not reach a piece).
  if (globalThis.performance) {
    const bar = forbid('performance.now');
    try {
      globalThis.performance.now = bar;
    } catch (e) {
      try {
        Object.defineProperty(globalThis.performance, 'now', { value: bar, configurable: true });
      } catch (e2) {
        /* a Performance global that will not be redefined: the frame clock is still a piece's only time */
      }
    }
  }
  for (const name of ['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
    try {
      globalThis[name] = forbid(name);
    } catch (e) {
      /* a read-only global stays as it is */
    }
  }
  const { file, seeds } = workerData;
  let mod = null;
  try {
    mod = (await import(pathToFileURL(file).href)).default || null;
  } catch (err) {
    parentPort.postMessage({ hasPiece: false, ok: false, problems: ['the module does not import: ' + (err && err.message || err)], runs: [] });
    return;
  }
  parentPort.postMessage(judgeModule(mod, seeds));
}

function judgeInWorker(file, seeds) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (report) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      resolve(report);
    };
    const worker = new Worker(new URL(import.meta.url), { workerData: { harness: 'piece', file, seeds }, env: {}, stdout: true, stderr: true });
    worker.stdout.on('data', () => {}); // a module's stray console output goes nowhere
    worker.stderr.on('data', () => {});
    const timer = setTimeout(() => {
      finish({ hasPiece: true, ok: false, problems: ['the module did not finish within ' + MODULE_TIMEOUT_MS / 1000 + ' seconds of real time'], runs: [] });
    }, MODULE_TIMEOUT_MS);
    worker.on('message', finish);
    worker.on('error', (err) => finish({ hasPiece: true, ok: false, problems: ['the module threw: ' + (err && err.message || err)], runs: [] }));
    worker.on('exit', (code) => finish({ hasPiece: true, ok: false, problems: ['the module ended the run (exit ' + code + ') before it was judged'], runs: [] }));
  });
}

export async function judge(dir, seeds) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js')).sort();
  const modules = [];
  for (const file of files) {
    const id = file.replace(/\.js$/, '');
    const report = await judgeInWorker(path.join(dir, file), seeds);
    modules.push(Object.assign({ id, file }, report));
  }
  return modules;
}

async function main(argv) {
  const args = { modules: '', seeds: SEEDS, json: false, out: '', requireAll: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--modules') args.modules = argv[++i] || '';
    else if (a === '--seeds') args.seeds = String(argv[++i] || '').split(',').map((s) => Number(s.trim()) >>> 0).filter(Boolean);
    else if (a === '--json') args.json = true;
    else if (a === '--out') args.out = argv[++i] || '';
    else if (a === '--require-all') args.requireAll = true;
  }
  if (!args.modules) {
    process.stderr.write('usage: piece_harness.mjs --modules <dir> [--seeds 1,2,3] [--json] [--out report.json] [--require-all]\n');
    return 2;
  }
  const modules = await judge(args.modules, args.seeds.length ? args.seeds : SEEDS);
  const failing = modules.filter((m) => m.hasPiece ? !m.ok : args.requireAll);
  const report = { ok: !failing.length, minSteps: MIN_STEPS, maxSteps: MAX_STEPS, maxTaps: MAX_TAPS, maxSeconds: MAX_SECONDS, modules };
  if (args.out) await writeFile(args.out, JSON.stringify(report) + '\n');
  if (args.json) {
    process.stdout.write(JSON.stringify(report) + '\n');
  } else {
    for (const m of modules) {
      const mark = m.hasPiece ? (m.ok ? 'ok  ' : 'FAIL') : 'none';
      const runs = m.runs.map((r) => (r.ok ? '' : '!') + JSON.stringify(r.title || '?') + ' (' + r.steps + ' knobs, ' + r.taps + ' taps, ' + r.seconds + 's, ' + (r.solved ? 'solved' : 'not solved') + (r.stars !== 5 ? ', ' + r.stars + ' stars' : '') + (r.label ? ', ' + r.label : '') + ')').join(', ');
      process.stdout.write(mark + '  ' + m.id + (runs ? ': ' + runs : '') + '\n');
      for (const p of m.problems) process.stdout.write('      - ' + p + '\n');
    }
  }
  return failing.length ? 1 : 0;
}

// In a worker of this harness's own: the stage harness imports this file for wrongFor() from
// inside its workers too, and must not be mistaken for one of them.
if (!isMainThread && workerData && workerData.harness === 'piece') {
  workerMain().catch((err) => {
    parentPort.postMessage({ hasPiece: true, ok: false, problems: ['the harness failed in the worker: ' + (err && err.message || err)], runs: [] });
  });
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The exit code is set rather than exited on: process.exit() can cut a report off mid-pipe
  // before stdout has drained (a report of twenty worlds runs past 64 KB), and the workers are
  // already terminated, so the loop ends on its own.
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }, (err) => {
    process.stderr.write(String(err && err.stack || err) + '\n');
    process.exitCode = 2;
  });
}
