/* The wish constellation: the visitor's stars, set as puzzles. As a card it is one of the two
   puzzles below painted small (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction, both drawn from where the visitor's stars sit -- their places, never
   their words -- and filled out with lights invented from the seed when the sky has too few, so a
   sky of one star still makes a whole puzzle:

     the postcard        Two views of the same lights, a left eye and a right eye a step apart. A
                         light shifts between the views by more the nearer it is, so the order of
                         the shifts is the order of the depths. Put the lights nearest to farthest.
                         A wrong check says how many stand in the right place and no more; a hint,
                         at a price, shows where one light stands.
     which sky is yours  Four small skies. One is the visitor's pattern turned clockwise by one,
                         two or three quarter turns, perhaps flipped left for right first; the other
                         three are near misses, the same lights with a few nudged. Say which sky,
                         how far it turned and whether it was flipped. A wrong check says which of
                         the three parts hold and no more; a hint marks one decoy.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the lights, their depths, the four skies -- and piece(env) opens on that rather than
   rolling another. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const PLACE = ['nearest', 'second nearest', 'third nearest', 'fourth nearest', 'fifth nearest', 'sixth nearest'];
const LETTERS = 'ABCDEFG';
const SKIES = 'ABCD';
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
// How far the nearest and the farthest light shift between the two views, in hundredths of a view.
const SHIFT_NEAR = 26;
const SHIFT_FAR = 4;

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
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes. A light that is tapped or hinted gets
   its ring in the ratchet's even clicks and its word cut on at its moment; the light last touched
   has a halo cut in by the piece's edge, and the one touched before it gives its halo back the
   same way, the region shrinking; a sky that is chosen is cut in by the edge and the one chosen
   before it gives its fill back, a sky marked as a decoy is veiled by the edge, and the sky that
   turns out to be yours is lit by it; the visitor's own sky, once the puzzle is solved, flips in
   treads and turns in rite.ratchet's clicks to meet it; the postcard's finale draws each light's
   travel in treads. A surface that stays changed rests as two shades of its colour split by the
   edge through its middle, never a flat wash or a pattern, and one that is given back or taken
   up again mid-way sets out from where it stood, never from either end. A line of words that
   changes keeps the words that stood until the new ones' moment and is cut over to them once, so
   nothing blanks and comes back. The lights themselves hold still: they wait for nothing, so they
   do not twinkle -- and on the postcard a light that varied in size could be read as a clue to
   its depth. Every change is read against the piece's own clock, s.t, which frame() advances: a
   change made at `since` has come came() of its way, which is 1 at once for a visitor who asked
   for less motion, and for whatever stood there from the start (since < 0). Each light, each sky
   and each line moves on a roll of its own, and each time it moves it is rolled again (roll():
   the thing's seed crossed with how many times it has moved), so no two step together and no
   press plays like the one before -- every roll keeping the piece's edge. Once every change has
   landed the scene is not drawn again until something changes: frame() says it is at rest (it
   returns false) and the stage asks for no more frames until the visitor acts, the scene is sized
   again or it comes back into view. */

// The rite of a piece handed none: everything stands where it ends, and a surface is cut by a
// plain upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 1, turn: () => 1, flicker: () => 1,
  treads: 1, kind: 'slice', angle: 90,
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

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two
// triggers of one movement play alike while the same seed still plays the same piece. Kept with
// the rite it was rolled from, so a frame reuses a roll rather than making it afresh thirty times
// a second; the keeping is let go now and then so a long visit does not hoard them.
const ROLLS = new WeakMap();
function roll(rite, base, n) {
  const seed = ((base | 0) ^ (Math.imul((n | 0) + 1, 0x9e37) | 0)) >>> 0;
  let kept = ROLLS.get(rite);
  if (!kept) {
    kept = new Map();
    ROLLS.set(rite, kept);
  }
  let own = kept.get(seed);
  if (!own) {
    if (kept.size > 96) kept.clear();
    own = rite.at(seed);
    kept.set(seed, own);
  }
  return own;
}

// How far a change made at `since` has come, over `span` seconds. Each change asked about is also
// kept in s.until, the moment the last of them lands, so a frame after that knows it has nothing
// new to draw (settled, below).
function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  if (!(s.until >= since + span)) s.until = since + span;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The size and the state the canvas was last drawn at.
function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1) + (c.done ? ' solved' : '');
}

// Whether a frame has nothing to draw: the canvas holds the picture last drawn at this size and
// state, and every change in that picture had come the whole of its way when it was drawn. The
// sky at rest stands still, so drawing it again would spend a frame on nothing a visitor could
// see; a new size (the stage clears the canvas to resize it), the solve, or a new change draws
// again.
function settled(s, c) {
  return s.drawn === sizeOf(c) && s.drawnAt > (s.until == null ? -Infinity : s.until);
}

// Draws the scene and notes when and at what size it was drawn.
function drawn(s, c, paint) {
  paint();
  s.drawn = sizeOf(c);
  s.drawnAt = s.t;
}

// A surface that comes and goes -- a light's halo, a chosen sky's fill: whether it is coming
// (`on`), the level it stood at when that last changed (`from`), when (`at`), and how many times
// it has moved (`n`, the roll for its movement).
function surface() {
  return { on: false, from: 0, at: null, n: 0 };
}

// Where a surface stands: up its stair from where it stood toward whole while it comes, down it
// toward nothing while it goes -- always from where it stood, so a change of mind mid-way never
// jumps it to either end first.
function level(sf, rite, base, s, span, reduced) {
  if (sf.at == null) return sf.on ? 1 : 0;
  const q = roll(rite, base, sf.n).stair(came(s, sf.at, span, reduced));
  return sf.on ? sf.from + (1 - sf.from) * q : sf.from * (1 - q);
}

// The surface set coming or going from now, from where it stands, on a fresh roll.
function turnTo(sf, on, rite, base, s, span, reduced) {
  if (sf.on === on) return;
  sf.from = level(sf, rite, base, s, span, reduced);
  sf.on = on;
  sf.at = s.t;
  sf.n += 1;
}

// How long a light's halo and a chosen sky's fill take to come or go.
const HALO = 0.6;
const CHOSEN = 0.8;

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes or goes, and at rest it is two shades of one colour split
// by that edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A disc that is `k` of the way to being there: the cover of its bounding box, clipped to it.
function disc(g, rite, x, y, r, k, fill) {
  if (k <= 0) return;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.clip();
  g.fillStyle = fill;
  cover(g, rite, x - r, y - r, r * 2, r * 2, k);
  g.restore();
}

/* ---- shared arithmetic ---------------------------------------------------------------------- */

function dials(env) {
  const v = env && env.variant;
  const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
  return v && typeof v === 'object' ? { density: num(v.density, 1), scale: num(v.scale, 1), turn: num(v.turn, 0) } : PLAIN;
}

function range(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
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

function isPerm(list, n) {
  return Array.isArray(list) && list.length === n && list.every((v) => Number.isInteger(v) && v >= 0 && v < n) && new Set(list).size === n;
}

function okPoints(list, n0, n1) {
  return Array.isArray(list) && list.length >= n0 && list.length <= n1
    && list.every((p) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
}

function copyPoints(list) {
  return list.map((p) => ({ x: p.x, y: p.y }));
}

// n lights in a square of hundredths, each at least `gap` from the rest: the visitor's stars first,
// by where they sit, then lights invented from the seed when the sky has too few.
function gather(env, n, gap, box) {
  const pts = [];
  const far = (p) => pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= gap);
  const into = (x, y) => ({ x: Math.round(box[0] + x / 100 * (box[1] - box[0])), y: Math.round(box[2] + y / 100 * (box[3] - box[2])) });
  for (const s of (Array.isArray(env.stars) ? env.stars : [])) {
    if (pts.length >= n) break;
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = into(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    if (far(p)) pts.push(p);
  }
  for (let guard = 0; pts.length < n; guard++) {
    const p = into(env.rnd() * 100, env.rnd() * 100);
    if (far(p) || guard > 300) pts.push(p);
  }
  return pts;
}

/* ---- drawing -------------------------------------------------------------------------------- */

function backdrop(g, w, h, c) {
  const grad = g.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 1.1);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// Motes behind everything: as many as the configuration asks for, where its turn puts them.
function dust(g, w, h, c, v) {
  g.fillStyle = c.alpha(c.colors.fg, 0.16);
  const count = Math.max(8, Math.round(36 * v.density));
  for (let i = 0; i < count; i++) {
    g.fillRect(((i * 0.618034 + v.turn * 0.37) % 1) * w, ((i * 0.754878 + v.turn * 0.19) % 1) * h, v.scale, v.scale);
  }
}

// Lines between lights: each joined to its two nearest within reach, brighter the nearer.
function links(g, side, c, pts, reach, boost) {
  const R = side * reach;
  g.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d < R) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const n of near.slice(0, 2)) {
      if (n.j < i) continue;
      g.strokeStyle = c.alpha(c.colors.accent, (0.18 + (1 - n.d / R) * 0.5) * boost);
      g.beginPath();
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[n.j].x, pts[n.j].y);
      g.stroke();
    }
  }
}

// One light: its resting halo, and over that -- when it is `hot` of the way to being lit -- a
// hotter halo cut in by the piece's edge; then the core. Every light is the same size, so none
// looks nearer than it is.
function star(g, c, p, glow, rite, hot) {
  const r = 9 * glow;
  const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  halo.addColorStop(0, c.alpha(c.colors.accent, 0.5));
  halo.addColorStop(1, c.alpha(c.colors.accent, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, TAU);
  g.fill();
  if (hot > 0) disc(g, rite || STILL, p.x, p.y, r * 1.3, hot, c.alpha(c.colors.accent2, 0.28));
  g.fillStyle = c.alpha(c.colors.fg, 0.95);
  g.beginPath();
  g.arc(p.x, p.y, 2.2, 0, TAU);
  g.fill();
}

// A ring round a light, `sweep` of the way round from the top: it comes round in clicks.
function ring(g, c, x, y, a, r, sweep) {
  if (sweep <= 0) return;
  g.strokeStyle = c.alpha(c.colors.accent2, a);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, sweep) * TAU);
  g.stroke();
}

// The face words are set in, set only when it is not the one the canvas already holds: setting a
// canvas's font, even to the face it has, makes the browser bring the page's style up to date
// first, and the sky letters every light, so a picture sets it once for each size rather than once
// for each word. A canvas spells a face back in its own way (700 as 'bold', a size cut to a few
// places), so the canvas is asked whether it holds the face as it spelled it when it was first set
// here: a canvas resized back to its defaults, or restored to a face it saved, is never mistaken.
// Only a few dozen spellings are kept, so a feed of many cards does not gather them.
const spelled = new Map();
function font(g, size, weight) {
  const face = (weight || 500) + ' ' + Math.round(size) + 'px system-ui, sans-serif';
  if (g.font === (spelled.get(face) || face)) return;
  g.font = face;
  if (spelled.size >= 48) spelled.clear();
  spelled.set(face, g.font);
}

/* ---- the postcard: nearest to farthest ------------------------------------------------------ */

function shiftOf(rank, n) {
  return SHIFT_NEAR - rank * (SHIFT_NEAR - SHIFT_FAR) / Math.max(1, n - 1);
}

function postcardPlan(env) {
  const n = env.int(4, 6);
  const points = gather(env, n, 15, [30, 96, 10, 90]);
  let ranks = shuffled(env, range(n));
  for (let guard = 0; guard < 12 && ranks.every((r, i) => r === i); guard++) ranks = shuffled(env, range(n));
  if (ranks.every((r, i) => r === i)) ranks.reverse();
  return { kind: 'postcard', number: 101 + env.int(0, 898), points, ranks };
}

function carriedPostcard(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'postcard' || !okPoints(p.points, 4, 6)) return null;
  const n = p.points.length;
  if (!isPerm(p.ranks, n) || p.ranks.every((r, i) => r === i)) return null;
  if (!Number.isInteger(p.number) || p.number < 101 || p.number > 999) return null;
  return { kind: 'postcard', number: p.number, points: copyPoints(p.points), ranks: p.ranks.slice() };
}

// The lights nearest first: the order that solves the postcard.
function postcardOrder(plan) {
  return range(plan.points.length).sort((a, b) => plan.ranks[a] - plan.ranks[b]);
}

function postcardTitle(plan) {
  return 'postcard ' + plan.number + ': left eye, right eye';
}

function postcardLayout(w, h) {
  return { lefts: [w * 0.04, w * 0.52], width: w * 0.44, top: h * 0.15, height: h * 0.62 };
}

// The state the postcard is drawn from. Every moment is on the piece's own clock, and -1 is
// "from the start" (so a preview, and a light never touched, stand still). `rounds` counts the
// orders tapped out whole, the roll for each round's rings; `cleared` keeps, for each light of the
// last round, how far its ring had come round and whether its place was showing, so the round
// goes back from there.
function postcardState(n, t) {
  return {
    t, order: null, orderAt: -1, orders: 0, orderWas: '', hinted: [], hintAt: new Array(n).fill(-1),
    taps: [], tapAt: new Array(n).fill(-1), cleared: [], clearedAt: -1, rounds: 0,
    lit: -1, halo: Array.from({ length: n }, surface), doneAt: -1
  };
}

// The rings and places of a round of taps as they stand: light i's ring, how far round, and
// whether its place has been cut on.
function tapShown(s, rite, reduced, i) {
  const own = roll(rite, 0x51 + i, s.rounds);
  const tp = came(s, s.tapAt[i], 0.7, reduced);
  return { ring: own.ratchet(tp), said: !!own.flicker(tp) };
}

// The line under the views: the words that stood until a new order's words are cut over them at
// their moment, on the roll of that ordering -- once, so the line never blanks.
function orderShown(s, rite, reduced) {
  if (!s.order) return '';
  if (roll(rite, 0x0d, s.orders).flicker(came(s, s.orderAt, 0.9, reduced))) return 'nearest to farthest: ' + s.order.map((i) => LETTERS[i]).join('  ');
  return s.orderWas;
}

function postcardScene(g, w, h, c, plan, s, v) {
  const box = postcardLayout(w, h);
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const n = plan.points.length;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.04)));
  const glow = v.scale * Math.max(0.55, Math.min(1, box.width / 300));
  backdrop(g, w, h, c);
  dust(g, w, h, c, v);
  g.textBaseline = 'middle';
  box.lefts.forEach((left, pane) => {
    font(g, size);
    g.textAlign = 'center';
    g.fillStyle = c.alpha(c.colors.fg, 0.85);
    g.fillText(pane === 0 ? 'left eye' : 'right eye', left + box.width / 2, h * 0.085, box.width);
    g.fillStyle = c.alpha(c.colors.bg, 0.55);
    g.fillRect(left, box.top, box.width, box.height);
    g.strokeStyle = c.alpha(c.colors.muted, 0.7);
    g.lineWidth = 1;
    g.strokeRect(left, box.top, box.width, box.height);
    // Ticks along both edges, so a light's place can be read across the two views.
    g.strokeStyle = c.alpha(c.colors.muted, 0.3);
    g.beginPath();
    for (let k = 1; k < 10; k++) {
      const x = left + box.width * k / 10;
      const tick = k % 5 ? 5 : 9;
      g.moveTo(x, box.top);
      g.lineTo(x, box.top + tick);
      g.moveTo(x, box.top + box.height);
      g.lineTo(x, box.top + box.height - tick);
    }
    g.stroke();
    g.strokeStyle = c.alpha(c.colors.muted, 0.1);
    g.beginPath();
    for (let k = 1; k < 5; k++) {
      const x = left + box.width * k / 5;
      g.moveTo(x, box.top);
      g.lineTo(x, box.top + box.height);
    }
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(left, box.top, box.width, box.height);
    g.clip();
    // A light's place -- its number in the order tapped, or the place a hint names -- is set after
    // every light in the view is lettered, the places of one size together, so the canvas's font
    // is set once for each size rather than twice for each light.
    const places = [];
    plan.points.forEach((p, i) => {
      const shift = pane === 1 ? shiftOf(plan.ranks[i], n) : 0;
      const x = left + (p.x - shift) / 100 * box.width;
      const y = box.top + p.y / 100 * box.height;
      if (pane === 1 && s.doneAt >= 0) {
        // The finale: the shift itself, drawn as the line each light travelled, laid in treads
        // from where the left eye had it, each light on its own roll and a little after the last.
        const laid = roll(rite, 0x31 + i, 0).stair(came(s, s.doneAt + i * 0.15, 1.3, reduced));
        if (laid > 0) {
          const x0 = left + p.x / 100 * box.width;
          g.strokeStyle = c.alpha(c.colors.accent2, 0.7);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x0, y);
          g.lineTo(x0 + (x - x0) * laid, y);
          g.stroke();
        }
      }
      // The light last touched: its halo is cut in by the piece's edge, and the one touched before
      // it gives its halo back the same way, from wherever it had come to.
      const hot = level(s.halo[i], rite, 0x11 + i, s, HALO, reduced);
      star(g, c, { x, y }, glow, rite, hot);
      if (s.lit === i) {
        g.strokeStyle = c.alpha(c.colors.accent2, 0.65);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y + size * 0.6);
        g.lineTo(x, box.top + box.height);
        g.stroke();
      }
      font(g, size * 0.9, 600);
      g.textAlign = 'left';
      g.fillStyle = c.alpha(hot >= 0.5 ? c.colors.accent2 : c.colors.fg, 0.9);
      g.fillText(LETTERS[i], x + size * 0.55, y - size * 0.6);
      const tapped = s.taps.indexOf(i);
      const gone = s.cleared.findIndex((was) => was.light === i);
      if (tapped >= 0) {
        // A tapped light: its ring comes round in clicks and its place is cut on at its moment.
        const shown = tapShown(s, rite, reduced, i);
        ring(g, c, x, y, 0.8, size * 0.6, shown.ring);
        if (shown.said) places.push({ text: String(tapped + 1), x: x + size * 0.55, y: y + size * 0.55, size: size * 0.7 });
      } else if (gone >= 0 && s.clearedAt >= 0) {
        // The order complete: each ring goes back round the way it came from as far as it had
        // come, and each place that was showing is cut out at its moment -- one that had not yet
        // been cut on is never shown.
        const was = s.cleared[gone];
        const own = roll(rite, 0x91 + i, s.rounds);
        const cp = came(s, s.clearedAt, 0.7, reduced);
        if (cp < 1) {
          ring(g, c, x, y, 0.8, size * 0.6, was.ring * (1 - own.ratchet(cp)));
          if (was.said && !own.flicker(cp)) places.push({ text: String(gone + 1), x: x + size * 0.55, y: y + size * 0.55, size: size * 0.7 });
        }
      } else if (s.hinted.includes(i)) {
        const own = roll(rite, 0x71 + i, 0);
        const hp = came(s, s.hintAt[i], 1, reduced);
        ring(g, c, x, y, 0.9, size * 0.7, own.ratchet(hp));
        if (own.flicker(hp)) places.push({ text: PLACE[plan.ranks[i]], x: x + size * 0.55, y: y + size * 0.6, size: size * 0.75 });
      }
    });
    g.fillStyle = c.alpha(c.colors.accent2, 0.95);
    g.textAlign = 'left';
    for (const at of places.sort((a, b) => a.size - b.size)) {
      font(g, at.size);
      g.fillText(at.text, at.x, at.y);
    }
    g.restore();
  });
  font(g, size);
  g.textAlign = 'center';
  g.fillStyle = c.alpha(c.colors.fg, 0.8);
  if (s.lit >= 0) {
    const p = plan.points[s.lit];
    const shift = Math.round(shiftOf(plan.ranks[s.lit], n));
    g.fillStyle = c.alpha(c.colors.accent2, 0.95);
    g.fillText('light ' + LETTERS[s.lit] + ': left ' + p.x + ', right ' + (p.x - shift) + '; shift ' + shift, w / 2, h * 0.81, w * 0.94);
  }
  const line = orderShown(s, rite, reduced);
  if (line) g.fillText(line, w / 2, h * 0.86, w * 0.9);
  g.fillStyle = c.alpha(c.colors.muted, 0.85);
  g.fillText('the same lights; the nearer, the farther it shifts', w / 2, h * 0.94, w * 0.92);
}

function postcardPreview(g, w, h, env, plan) {
  postcardScene(g, w, h, env, plan, postcardState(plan.points.length, 0), dials(env));
}

function postcardPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.points.length;
  const v = dials(env);
  const answer = postcardOrder(plan);
  const s = postcardState(n, 0);
  s.order = range(n);
  const draw = (c) => drawn(s, c, () => postcardScene(c.g, c.w, c.h, c, plan, s, v));
  const inPlace = (order) => order.filter((item, i) => item === answer[i]).length;
  // A new order: the line keeps the words on it until the new ones are cut over them.
  function settle(order, c) {
    s.orderWas = orderShown(s, riteOf(c), c.reduced);
    s.order = order.slice();
    s.orderAt = s.t;
    s.orders += 1;
  }
  return {
    title: postcardTitle(plan),
    brief: 'A reading by two eyes. Two views of the same ' + WORDS[n] + ' lights, from a left eye and a right eye a step apart. The nearer a light is, the farther it shifts between the views; the farthest barely moves. Nothing else about them changes.',
    goal: 'Put the lights in order from nearest to farthest.',
    aspect: '4 / 3',
    checkLabel: 'check the postcard',
    steps: [
      { id: 'order', ask: 'the lights, nearest first: arrange them here, or tap them in that order', kind: 'order', items: range(n).map((i) => ({ label: 'light ' + LETTERS[i], value: i })) },
      { id: 'hint', ask: 'where one light stands', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: answer.slice() },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, n) ? value : s.order;
      const k = inPlace(order);
      return {
        solved: k === n,
        say: k === n ? 'every light in its place: the postcard has depth'
          : k === 0 ? 'none of them stands at its true depth yet' : WORDS[k] + ' of ' + WORDS[n] + ' at the right depth'
      };
    },
    start(c) {
      c.status('compare each light\'s place in the two views');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, n)) {
        settle(value, c);
        c.status('nearest to farthest: ' + s.order.map((i) => LETTERS[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? answer.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== answer.indexOf(i))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('light ' + LETTERS[next] + ' is the ' + PLACE[plan.ranks[next]]);
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will show at this difficulty; the rest is yours');
        } else {
          c.status('every light you have placed wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap the lights nearest first, in either view; the order on the rail follows.
      const box = postcardLayout(c.w, c.h);
      const pane = x * c.w < box.lefts[1] ? 0 : 1;
      let best = -1;
      let bd = Infinity;
      plan.points.forEach((p, i) => {
        const shift = pane === 1 ? shiftOf(plan.ranks[i], n) : 0;
        const d = Math.hypot(box.lefts[pane] + (p.x - shift) / 100 * box.width - x * c.w, box.top + p.y / 100 * box.height - y * c.h);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0 || bd > Math.min(c.w, c.h) * 0.08) return;
      const rite = riteOf(c);
      if (s.lit !== best) {
        // The halo moves to the light touched: the last one gives its halo back and this one's
        // comes, each from wherever it stood.
        if (s.lit >= 0) turnTo(s.halo[s.lit], false, rite, 0x11 + s.lit, s, HALO, c.reduced);
        turnTo(s.halo[best], true, rite, 0x11 + best, s, HALO, c.reduced);
        s.lit = best;
      }
      const measure = 'light ' + LETTERS[best] + ' shifts ' + Math.round(shiftOf(plan.ranks[best], n)) + ' marks between the views';
      if (s.taps.includes(best)) {
        c.status(measure + '; already in your order');
        draw(c);
        return;
      }
      s.taps.push(best);
      s.tapAt[best] = s.t;
      if (s.taps.length === n) {
        settle(s.taps, c);
        // The round is cleared from where each ring and place stood, on the next round's roll.
        s.cleared = s.taps.map((light) => Object.assign({ light }, tapShown(s, rite, c.reduced, light)));
        s.clearedAt = s.t;
        s.rounds += 1;
        s.taps = [];
        c.set('order', s.order.slice());
        c.status(measure + '; order set: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; check it');
      } else {
        c.status(measure + '; placed ' + PLACE[s.taps.length - 1] + '; tap the next');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      if (!settled(s, c)) draw(c);
      return !settled(s, c);
    },
    end(c) {
      c.status('sealed: postcard ' + plan.number + '. light ' + LETTERS[answer[0]] + ' is nearest and light ' + LETTERS[answer[n - 1]] + ' farthest; the lines show how far each one shifted');
    }
  };
}

/* ---- which sky is yours: turned, maybe flipped ---------------------------------------------- */

// One light turned clockwise by `turns` quarter turns, after a flip left for right if `mirror`.
function turnPoint(p, turns, mirror) {
  let x = mirror ? 100 - p.x : p.x;
  let y = p.y;
  for (let i = 0; i < turns; i++) {
    const nx = 100 - y;
    y = x;
    x = nx;
  }
  return { x, y };
}

function turned(points, turns, mirror) {
  return points.map((p) => turnPoint(p, turns, mirror));
}

// The farthest any light of A has to travel to reach a light of B: nought when A lies on B.
function setGap(A, B) {
  let worst = 0;
  for (const p of A) {
    let best = Infinity;
    for (const q of B) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
}

// Every way the pattern can lie: four turns, flipped or not.
function images(points) {
  const out = [];
  for (let m = 0; m < 2; m++) for (let t = 0; t < 4; t++) out.push({ turns: t, mirror: m === 1, pts: turned(points, t, m === 1) });
  return out;
}

function distinctImages(all) {
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) if (setGap(all[a].pts, all[b].pts) < 8) return false;
  }
  return true;
}

function spaced(pts, gap) {
  return pts.every((p, i) => pts.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) >= gap));
}

function whichPlan(env) {
  const n = env.int(5, 7);
  const number = 101 + env.int(0, 898);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const points = gather(env, n, 14, [8, 92, 8, 92]);
    const all = images(points);
    const distinct = distinctImages(all);
    const turns = env.int(1, 3);
    const mirror = env.chance(0.5);
    const which = env.int(0, 3);
    const skies = [];
    let ok = true;
    let decoys = 0;
    for (let k = 0; k < 4 && ok; k++) {
      if (k === which) {
        skies.push(turned(points, turns, mirror));
        continue;
      }
      // A decoy: a few lights nudged, then laid like the true sky (the first) or any way at all.
      let decoy = null;
      for (let tries = 0; tries < 24 && !decoy; tries++) {
        const moved = shuffled(env, range(n)).slice(0, n > 5 ? 3 : 2);
        const nudged = points.map((p, i) => {
          if (!moved.includes(i)) return { x: p.x, y: p.y };
          const a = env.rnd() * Math.PI * 2;
          const d = 10 + env.rnd() * 6;
          return { x: Math.round(Math.max(4, Math.min(96, p.x + Math.cos(a) * d))), y: Math.round(Math.max(4, Math.min(96, p.y + Math.sin(a) * d))) };
        });
        const pts = decoys === 0 ? turned(nudged, turns, mirror) : turned(nudged, env.int(0, 3), env.chance(0.5));
        if (spaced(pts, 7) && all.every((img) => setGap(pts, img.pts) >= 6)) decoy = pts;
        else if (tries === 23) {
          // The last try stands, unchecked, so a plan is always made; a plan this loop could not
          // check is one the piece still plays, and one the carried check will roll afresh.
          decoy = pts;
          ok = false;
        }
      }
      skies.push(decoy);
      decoys += 1;
    }
    last = { kind: 'which', number, points, turns, mirror, which, skies };
    if (ok && distinct) return last;
  }
  return last;
}

function carriedWhich(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'which' || !okPoints(p.points, 5, 7)) return null;
  const n = p.points.length;
  if (!Number.isInteger(p.number) || p.number < 101 || p.number > 999) return null;
  if (![1, 2, 3].includes(p.turns) || typeof p.mirror !== 'boolean' || ![0, 1, 2, 3].includes(p.which)) return null;
  if (!Array.isArray(p.skies) || p.skies.length !== 4 || !p.skies.every((sky) => okPoints(sky, n, n))) return null;
  const all = images(p.points);
  if (!distinctImages(all)) return null;
  const truth = turned(p.points, p.turns, p.mirror);
  if (setGap(p.skies[p.which], truth) > 0.5 || setGap(truth, p.skies[p.which]) > 0.5) return null;
  for (let k = 0; k < 4; k++) {
    if (k !== p.which && all.some((img) => setGap(p.skies[k], img.pts) < 6)) return null;
  }
  return { kind: 'which', number: p.number, points: copyPoints(p.points), turns: p.turns, mirror: p.mirror, which: p.which, skies: p.skies.map(copyPoints) };
}

function whichTitle(plan) {
  return 'sky ' + plan.number + ': which sigil is yours';
}

function turnsWord(turns) {
  return turns === 1 ? 'one quarter turn' : WORDS[turns] + ' quarter turns';
}

function whichLayout(w, h) {
  const side = Math.min(h * 0.7, w * 0.46);
  const left = w * 0.05;
  const top = h * 0.15;
  const x0 = left + side + w * 0.05;
  const room = w * 0.95 - x0;
  const gap = Math.max(6, room * 0.06);
  const small = Math.min((room - gap) / 2, (side - gap) / 2);
  const y0 = top + (side - (small * 2 + gap)) / 2;
  const cells = [];
  for (let k = 0; k < 4; k++) cells.push({ x: x0 + (k % 2) * (small + gap), y: y0 + Math.floor(k / 2) * (small + gap), side: small });
  return { side, left, top, cells };
}

// One sky in a square: its frame, its lights and the lines between them. opts.fill is a surface
// that has come `opts.fillK` of the way over the box, under the lights; opts.lit a second,
// brighter one that has come `opts.litK` of the way over that (the sky that turns out to be yours,
// which is the chosen one already, so it needs a surface of its own); opts.veil one that has come
// `opts.veilK` of the way over them (a decoy's dimming). Each is cut in by the piece's edge across
// the square and rests in two shades split by it -- by its area, never by alpha -- and as they all
// share the one edge, their splits lie on one line.
function skyBox(g, c, pts, x, y, side, v, opts) {
  const rite = opts.rite || STILL;
  g.fillStyle = c.alpha(c.colors.bg, 0.55);
  g.fillRect(x, y, side, side);
  if (opts.fill && opts.fillK > 0) {
    g.fillStyle = opts.fill;
    cover(g, rite, x, y, side, side, opts.fillK);
  }
  if (opts.lit && opts.litK > 0) {
    g.fillStyle = opts.lit;
    cover(g, rite, x, y, side, side, opts.litK);
  }
  g.strokeStyle = opts.border || c.alpha(c.colors.muted, 0.7);
  g.lineWidth = opts.width || 1;
  g.strokeRect(x, y, side, side);
  const at = pts.map((p) => ({ x: x + p.x / 100 * side, y: y + p.y / 100 * side }));
  const glow = v.scale * Math.max(0.45, Math.min(1, side / 260));
  links(g, side, c, at, 0.5, 1);
  at.forEach((p) => star(g, c, p, glow, rite, 0));
  if (opts.veil && opts.veilK > 0) {
    g.fillStyle = opts.veil;
    cover(g, rite, x, y, side, side, opts.veilK);
  }
  const size = Math.max(9, Math.min(16, Math.round(side * 0.11)));
  if (opts.label) {
    font(g, size, 600);
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = opts.border || c.alpha(c.colors.fg, 0.9);
    g.fillText(opts.label, x + size * 0.4, y + size * 0.3);
  }
  // The box's note for its lower corner -- 'decoy' over a sky the hint has ruled out -- is handed
  // to the caller's `notes`, which writes them all together (whichScene).
  if (opts.note) opts.notes.push({ text: opts.note, x: x + side - size * 0.4, y: y + side - size * 0.3, size: size * 0.85 });
}

// The state the four skies are drawn from; -1 is "from the start". Each sky's fill is a surface
// that comes when it is chosen and goes when another is.
function whichState(t) {
  return {
    t, choice: -1, chosen: [surface(), surface(), surface(), surface()], turns: 1, mirror: false,
    hinted: [], hintAt: [-1, -1, -1, -1], doneAt: -1, live: false, saidAt: -1, saids: 0, saidWas: '',
    previewFrom: null, previewTo: null, previewAt: -1, previewRoll: 0, previewAfter: false
  };
}

// The summary line's words for the settings as they stand.
function summaryWords(s) {
  return (s.choice >= 0 ? 'sky ' + SKIES[s.choice] : 'no sky yet') + ', ' + turnsWord(s.turns) + (s.mirror ? ', flipped first' : ', not flipped');
}

// The summary line: the words that stood until a new setting's words are cut over them at their
// moment, on the roll of that setting -- once, so the line never blanks; a setting that leaves the
// words as they were changes nothing.
function summaryShown(s, rite, reduced) {
  if (roll(rite, 0x5a1d, s.saids).flicker(came(s, s.saidAt, 0.8, reduced))) return summaryWords(s);
  return s.saidWas;
}

// A changed turn or flip moves the reference sky from wherever its last movement stood.
function previewSky(plan, rite, s, reduced) {
  if (!s.previewTo) return plan.points;
  const step = roll(rite, 0x435, s.previewRoll).stair(came(s, s.previewAt, 0.9, reduced));
  return s.previewTo.map((p, i) => ({
    x: s.previewFrom[i].x + (p.x - s.previewFrom[i].x) * step,
    y: s.previewFrom[i].y + (p.y - s.previewFrom[i].y) * step
  }));
}

// The visitor's own sky once the puzzle is solved: flipped left for right in treads, if it was
// flipped, then turned clockwise in the ratchet's even clicks to lie as the true sky lies.
function reference(plan, rite, s, reduced) {
  if (s.doneAt < 0 || s.previewAfter) return previewSky(plan, rite, s, reduced);
  const fp = plan.mirror ? roll(rite, 0xf11, 0).stair(came(s, s.doneAt, 1, reduced)) : 0;
  const tp = came(s, s.doneAt + (plan.mirror ? 1 : 0), 2.4, reduced);
  const ang = roll(rite, 0x7a7, 0).ratchet(tp) * plan.turns * Math.PI / 2;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return plan.points.map((p) => {
    const dx = (p.x - 50) * (1 - 2 * fp);
    const dy = p.y - 50;
    return { x: 50 + dx * cos - dy * sin, y: 50 + dx * sin + dy * cos };
  });
}

function whichScene(g, w, h, c, plan, s, v) {
  const lay = whichLayout(w, h);
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.04)));
  backdrop(g, w, h, c);
  dust(g, w, h, c, v);
  font(g, size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = c.alpha(c.colors.fg, 0.85);
  g.fillText(s.previewTo ? 'your sky, as turned' : 'your sky', lay.left + lay.side / 2, h * 0.085, lay.side);
  const c0 = lay.cells[0];
  const c1 = lay.cells[1];
  g.fillText('four skies', c0.x + (c1.x + c1.side - c0.x) / 2, h * 0.085, c1.x + c1.side - c0.x);
  skyBox(g, c, reference(plan, rite, s, reduced), lay.left, lay.top, lay.side, v, { rite, border: c.alpha(c.colors.accent, 0.8) });
  // The skies' notes are written after all four are labelled, so the canvas's font is set once for
  // the labels and once for the notes rather than twice for each sky.
  const notes = [];
  plan.skies.forEach((sky, i) => {
    const cell = lay.cells[i];
    // Chosen: the sky is cut in by the edge; the one chosen before it gives its fill back the
    // same way, the region shrinking from wherever it had come to.
    const chosenK = level(s.chosen[i], rite, 0x200 + i, s, CHOSEN, reduced);
    // A decoy: a veil is cut over it by the edge, and the word comes with its first tread.
    const hp = s.hinted.includes(i) ? came(s, s.hintAt[i], 1.1, reduced) : 0;
    const decoyK = hp > 0 ? roll(rite, 0x240 + i, 0).stair(hp) : 0;
    // Yours, once solved: a brighter surface of its own is cut in by the edge over the chosen
    // fill (the sky found is the sky chosen, so the chosen fill is already whole underneath).
    const fp = s.doneAt >= 0 && i === plan.which ? came(s, s.doneAt, 1.6, reduced) : 0;
    const foundK = fp > 0 ? roll(rite, 0x260 + i, 0).stair(fp) : 0;
    const found = foundK > 0;
    skyBox(g, c, sky, cell.x, cell.y, cell.side, v, {
      rite, label: SKIES[i],
      fill: c.alpha(c.colors.accent2, 0.1), fillK: chosenK,
      lit: c.alpha(c.colors.accent2, 0.18), litK: foundK,
      veil: c.alpha(c.colors.bg, 0.48), veilK: decoyK,
      note: decoyK > 0 ? 'decoy' : '', notes,
      border: found || chosenK > 0 ? c.colors.accent2 : undefined,
      width: found || chosenK >= 0.5 ? 2 : 1
    });
  });
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.fillStyle = c.alpha(c.colors.accent2, 0.9);
  for (const at of notes) {
    font(g, at.size);
    g.fillText(at.text, at.x, at.y);
  }
  font(g, size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (s.live) {
    g.fillStyle = c.alpha(c.colors.fg, 0.8);
    g.fillText(summaryShown(s, rite, reduced), w / 2, h * 0.9, w * 0.9);
  } else {
    g.fillStyle = c.alpha(c.colors.muted, 0.85);
    g.fillText('one of the four is your sky, turned; the others are near misses', w / 2, h * 0.9, w * 0.92);
  }
}

function whichPreview(g, w, h, env, plan) {
  whichScene(g, w, h, env, plan, whichState(0), dials(env));
}

function whichPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.points.length;
  const v = dials(env);
  const s = whichState(0);
  s.live = true;
  const draw = (c) => drawn(s, c, () => whichScene(c.g, c.w, c.h, c, plan, s, v));
  // A setting is about to change: the summary keeps the words on it until the new ones are cut
  // over them, on a fresh roll.
  const saying = (c) => {
    s.saidWas = summaryShown(s, riteOf(c), c.reduced);
    s.saidAt = s.t;
    s.saids += 1;
  };
  const preview = (c, from) => {
    s.previewFrom = from;
    s.previewTo = turned(plan.points, s.turns, s.mirror);
    s.previewAt = s.t;
    s.previewRoll += 1;
    s.previewAfter = !!c.done;
  };
  return {
    title: whichTitle(plan),
    brief: 'Your sigil, turned. One of the four small skies is your ' + WORDS[n] + ' lights, turned clockwise by one, two or three quarter turns -- and perhaps flipped left for right before it was turned. The other three are near misses: the same lights, with a few nudged out of place.',
    goal: 'Say which sky is yours, how many quarter turns it was given, and whether it was flipped.',
    aspect: '4 / 3',
    checkLabel: 'check the skies',
    steps: [
      { id: 'sky', ask: 'which sky is yours', kind: 'choice', options: range(4).map((k) => ({ label: 'sky ' + SKIES[k], value: k })) },
      { id: 'turns', ask: 'how far it was turned, clockwise', kind: 'number', min: 1, max: 3, step: 1, value: 1, unit: 'quarter turns' },
      { id: 'mirror', ask: 'flipped left for right before the turn', kind: 'toggle', label: 'it was flipped' },
      { id: 'hint', ask: 'one sky that is not yours', kind: 'press', count: 1, label: 'mark a decoy', optional: true }
    ],
    solution: { sky: plan.which, turns: plan.turns, mirror: plan.mirror },
    check(c) {
      const sky = Number(c.value('sky')) === plan.which;
      const turns = Number(c.value('turns')) === plan.turns;
      const mirror = !!c.value('mirror') === plan.mirror;
      if (sky && turns && mirror) return { solved: true, say: 'sky ' + SKIES[plan.which] + ' is yours: ' + turnsWord(plan.turns) + (plan.mirror ? ', flipped first' : '') };
      return {
        solved: false,
        say: [sky ? 'the sky holds' : 'that sky is not yours', turns ? 'the turn holds' : 'the turn is off', mirror ? 'the flip holds' : 'the flip is off'].join('; ')
      };
    },
    start(c) {
      c.status('four skies; one is yours, turned');
      draw(c);
    },
    apply(id, value, c) {
      const rite = riteOf(c);
      if (id === 'sky') {
        const k = Number(value);
        if ([0, 1, 2, 3].includes(k) && k !== s.choice) {
          // The sky chosen before gives its fill back and this one's comes, each from wherever
          // it stood.
          saying(c);
          if (s.choice >= 0) turnTo(s.chosen[s.choice], false, rite, 0x200 + s.choice, s, CHOSEN, c.reduced);
          turnTo(s.chosen[k], true, rite, 0x200 + k, s, CHOSEN, c.reduced);
          s.choice = k;
        }
        c.status('sky ' + SKIES[s.choice] + '; now how far it turned, and whether it was flipped');
      }
      if (id === 'turns') {
        const k = Math.round(Number(value));
        if (k >= 1 && k <= 3 && (k !== s.turns || !s.previewTo)) {
          const from = reference(plan, rite, s, !!c.reduced).map((p) => ({ x: p.x, y: p.y }));
          saying(c);
          s.turns = k;
          preview(c, from);
        }
        c.status(turnsWord(s.turns) + ' clockwise; compare the moving sky with A-D');
      }
      if (id === 'mirror' && (!!value !== s.mirror || !s.previewTo)) {
        const from = reference(plan, rite, s, !!c.reduced).map((p) => ({ x: p.x, y: p.y }));
        saying(c);
        s.mirror = !!value;
        preview(c, from);
      }
      if (id === 'mirror') c.status(s.mirror ? 'flipped first, then turned; compare with A-D' : 'not flipped; compare the turned sky with A-D');
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? range(4).find((k) => k !== plan.which && !s.hinted.includes(k)) : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('sky ' + SKIES[next] + ' is a decoy: a light or two of it is off');
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will mark at this difficulty; read the rest against your own');
        } else {
          c.status('every decoy is marked; the sky left is yours, and its turn is still to find');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const lay = whichLayout(c.w, c.h);
      const k = lay.cells.findIndex((cell) => x * c.w >= cell.x && x * c.w <= cell.x + cell.side && y * c.h >= cell.y && y * c.h <= cell.y + cell.side);
      if (k < 0) {
        c.status('set the turn or flip to move your sky, then compare its lights with A-D');
        return;
      }
      c.status('sky ' + SKIES[k] + (s.hinted.includes(k) ? ', a decoy' : '; compare its lights with your turned sky'));
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      if (!settled(s, c)) draw(c);
      return !settled(s, c);
    },
    end(c) {
      c.status('sky ' + SKIES[plan.which] + ' is yours, ' + turnsWord(plan.turns) + (plan.mirror ? ', flipped first' : '') + '; watch your sky turn to meet it');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the two this card is, and its plan, dealt once from the env's seeded stream and kept
// with that env. Every pass over one card -- the still picture, the spark and the piece it opens
// as -- asks here, so they are all the same card; dealing again on a later pass would hand the
// visitor another puzzle from the one they pressed (issue #92, and js/feed.js on what a card owes
// its module).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const postcard = env.chance(0.5);
    got = { postcard, plan: postcard ? postcardPlan(env) : whichPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'wish-constellation',
  needsSky: true,
  // The card is a still picture: its lights wait for nothing, so it has no animate and the feed
  // never animates it (it paints it again only for a new size or a new roll).
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.postcard) postcardPreview(g, w, h, env, d.plan);
    else whichPreview(g, w, h, env, d.plan);
  },
  spark(env) {
    const d = deal(env);
    if (d.postcard) {
      const plan = d.plan;
      return {
        title: postcardTitle(plan),
        quote: WORDS[plan.points.length] + ' lights, two eyes, one depth',
        text: 'A light shifts between the views by more the nearer it is. Put them in order, nearest to farthest.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => postcardPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: whichTitle(plan),
      quote: 'four skies; one is your sigil, turned',
      text: 'Your ' + WORDS[plan.points.length] + ' lights, turned and maybe flipped, among three near misses. Say which sky, how far it turned and whether it was flipped.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => whichPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const postcard = carriedPostcard(env);
    if (postcard) return postcardPiece(env, postcard);
    const which = carriedWhich(env);
    if (which) return whichPiece(env, which);
    const d = deal(env);
    return d.postcard ? postcardPiece(env, d.plan) : whichPiece(env, d.plan);
  }
};
