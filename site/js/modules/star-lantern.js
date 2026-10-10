/* The lantern ritual: lanterns hung under the persona's stars, and four puzzles set among them. As
   a card it is the puzzle the seed deals, drawn small (paint, spark); as a piece it is one of the
   four puzzles below, and the card it was opened from says which. See js/feed.js for what a module
   is and js/stage.js for what a piece is.

   Four puzzles, all deduction:

     the lighting order  Four or five lettered lanterns rise one after another, and a few clues
                         under the sky say how: before, right after, first, last, so many between,
                         not last. The clues are drawn from the true order and pruned until exactly
                         one order fits them all, never more than five. A wrong check says how many
                         stand in the right place and no more; a hint, at a price, names one
                         lantern's place.
     where it drifts     One lantern let go at the dotted column rises through four bands of wind,
                         each pushing it some columns left or right, drawn as arrows over a column
                         grid. Say how far it has drifted when it leaves the top, and which band
                         pushes hardest. A wrong check says only which way to look. Some seeds
                         are the long ascent, through five bands.
     the two witnesses   Two wind values are missing. Lantern A crosses every band; B starts above
                         the lower missing wind. Their arrival columns determine the upper wind
                         first, then the lower. Checks trace the visitor's proposed winds, never
                         hidden answers. Worked subtractions cost hints; the lit paths remain
                         available to experiment with after solving.

     the midnight crossing  Two lanterns rise through the same winds, one following every push
                            and the other mirroring it. Find the first band after which they meet
                            or exchange sides, and where the first lantern exits. Hints expose
                            successive positions; the lit paths can still be explored on a solve.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the order and its clues, or the four bands -- and piece(env) opens on that rather than
   rolling another. The sky may be one star or many; it only lights the picture, and the plan
   stands whatever the sky is now. */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
const COLS = 12; // columns either side of the release column, in the drift puzzle
const BANDS = 4;

const signed = (n) => (n > 0 ? '+' : '') + n;
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

/* ---- the rite: how the lanterns move -------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes. A lantern moved to another place
   travels there in the rite's landing treads, the longest step first, and the name under it is cut
   over to its new place as it lands; a lantern let go climbs each band in landing treads rolled
   for that band of that flight; a lantern that has arrived lifts into its ring up a stair; a
   mirrored pair goes on one band per hint in landing treads, and a solved crossing climbs the rest
   of the way up a stair. A chosen band, a looked-at band, a band marked as the first crossing, a
   hinted place are SEALED: cut in by the piece's edge (rite.paint, one path) up the stair of that
   choice, resting as two shades of the colour split by the edge through its middle, its frame
   drawn once the seal has come whole; each one chosen before is given back as the edge withdraws
   the way it came. A band sealed by a tap, on a piece whose edge is a curve, grows its curve from
   the point the tap landed on rather than from the piece's own corner. A wind the visitor sets
   swings its arrow in landing treads, and its readout is cut over from the old number to the new
   at the setting's moment; a mark over a guessed column travels in landing treads; a hint's mark
   and a worked answer are cut on at their moment and stay; "let go here" is cut out as the first
   lantern goes, and stays out. A journey the visitor moves on from -- a new flight, a wind changed
   under a traced pair -- is given back by the piece's edge across the picture, while the lantern
   is cut over once to where its new journey starts. A solved sky's lanterns brighten up a stair
   and the light over it is cut in by the edge and rests in two shades, never a wash.

   A change made while another is still under way sets out from what is SHOWING -- a lantern from
   the height it has reached, a seal from the part of its band it covers, an arrow from where it
   points, a readout from the number it reads -- never from either end of the movement it
   interrupts, so nothing jumps to a place it never reached and comes back.

   Between the visitor's moves the sky holds still: the lanterns hang, the sparks stand and the
   dotted columns lie where they are, because nothing in them is waiting for anything, and a card
   is a still picture. Every change is read against the piece's own clock, s.t, which frame()
   advances: a change made at `since` has come came() of its way, which is 1 at once for a visitor
   who asked for less motion and for whatever stood there from the start. Once every change has
   landed the scene is not drawn again until something changes (settled, below). Every trigger
   rolls the rite afresh (roll(): the thing's seed crossed with the count of that trigger), so a
   second move, a second check, a second tap steps in other treads from the first -- every roll
   keeping the piece's edge. */

// The rite of a piece handed none: everything stands where it ends, and a surface is cut by a
// plain upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 1, turn: () => 1, flicker: () => 1,
  series: (p, n) => Math.max(1, Math.floor(n || 1)), treads: 1, kind: 'slice', angle: 90,
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
// state, and every change in that picture had come the whole of its way when it was drawn. The sky
// at rest stands still, so drawing it again would spend a frame on nothing a visitor could see; a
// new size (the stage clears the canvas to resize it), the solve, or a new change draws again. A
// change made outside a draw clears s.drawn, so the next frame draws it.
function settled(s, c) {
  return s.drawn === sizeOf(c) && s.drawnAt > (s.until == null ? -Infinity : s.until);
}

// Draws the scene and notes when and at what size it was drawn.
function drawn(s, c, paint) {
  paint();
  s.drawn = sizeOf(c);
  s.drawnAt = s.t;
}

// The rite rolled afresh for the n-th trigger of one kind of thing: a second press steps in other
// treads from the first, on the same edge. Kept with the rite it was rolled from, so a frame reuses
// a roll rather than making it afresh thirty times a second; the keeping is let go now and then.
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

// A travel from `from` to `to`, by how far it has come, in the landing treads of the roll: the
// longest step first, each after it shorter, never a glide and never past the mark. The treads
// are summed, so the last can land a hair short of 1; it counts as landed.
function landing(own, p) {
  if (p >= 1) return 1;
  const e = own.ease(p);
  return e >= 1 - 1e-9 ? 1 : e;
}

function travel(own, from, to, p) {
  const e = landing(own, p);
  return e >= 1 ? to : from + (to - from) * e;
}

// A surface that comes to stay, `k` of the way there, in the current fillStyle: the part of the
// box the piece's edge has passed, and over the half behind the edge's middle a second coat of the
// same colour. One edge moves while it comes, and at rest it is two shades of one colour split by
// that edge through the middle of the box. One path per coat. A surface a tap set, on a piece
// whose edge is a curve, has its curve round the point the tap landed on (`point`, in fractions of
// the box): the press is the reason it is there.
function cover(g, own, x, y, w, h, k, point) {
  if (k <= 0 || w <= 0 || h <= 0) return;
  if (point && own.kind === 'curve') {
    pressed(g, x, y, w, h, k, point);
    pressed(g, x, y, w, h, Math.min(k, 0.5), point);
    return;
  }
  own.paint(g, x, y, w, h, k);
  own.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// The piece's curve grown from a press: the part of the box within `k` of the way from the point
// to the box's farthest corner. One arc, clipped to the box.
function pressed(g, x, y, w, h, k, point) {
  if (k >= 1) {
    g.fillRect(x, y, w, h);
    return;
  }
  const ox = x + point[0] * w;
  const oy = y + point[1] * h;
  const far = Math.max(Math.hypot(x - ox, y - oy), Math.hypot(x + w - ox, y - oy),
    Math.hypot(x - ox, y + h - oy), Math.hypot(x + w - ox, y + h - oy));
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.beginPath();
  g.arc(ox, oy, far * k, 0, TAU);
  g.fill();
  g.restore();
}

/* A seal is a surface the visitor sets and unsets -- a chosen band, a looked-at band, a band
   marked as the first crossing. Each is kept under its key in a puzzle's own `marks` as where its
   coverage stood when it last changed (`from`), which way it is going (`on`), when (`at`), on
   which roll (`n`), and the point a tap set it at, if one did (`point`). What shows is that
   coverage carried toward 1 or 0 up the stair of the change's roll: a seal set or unset while
   another change to it is under way sets out from what is showing, and every band given back keeps
   its own edge to the end, however quickly the next is chosen -- never a flash to whole first and
   never one dropped without an edge. */
const SEAL = 0.9; // seconds a seal takes to come whole or be given back

function sealOf(s, rite, base, mark, reduced) {
  if (!mark) return 0;
  const to = mark.on ? 1 : 0;
  const q = roll(rite, base, mark.n).stair(came(s, mark.at, SEAL, reduced));
  return q >= 1 ? to : mark.from + (to - mark.from) * q;
}

function reseal(s, marks, key, on, rite, base, reduced, point) {
  if (key == null) return;
  const was = marks[key];
  if (was && was.on === on) return;
  const from = sealOf(s, rite, base, was, reduced);
  s.seals += 1;
  // A seal that is still partly showing keeps the curve it was cut by; a fresh one takes the
  // press's point, or the piece's own corner when a knob set it.
  marks[key] = { from, on, at: s.t, n: s.seals, point: was && from > 0 ? was.point : (on && point) || null };
}

// One seal of a box, drawn as it shows now, in the current fillStyle; whether it has come whole.
function sealed(g, s, rite, base, mark, box, reduced) {
  const k = sealOf(s, rite, base, mark, reduced);
  if (k > 0) cover(g, rite, box.x, box.y, box.w, box.h, k, mark.point);
  return !!(mark && mark.on && k >= 1);
}

// Where a tap landed, in fractions of a box.
function within(px, py, box) {
  return [Math.max(0, Math.min(1, (px - box.x) / box.w)), Math.max(0, Math.min(1, (py - box.y) / box.h))];
}

// A journey given back: the picture of a path the visitor has moved on from, drawn by `paint`
// inside what the piece's edge still leaves of the whole scene, as that edge withdraws one way up
// the stair of the giving-back's own roll. Done ones are let go.
const GONE = 0.8; // seconds a journey takes to be given back

function giveBack(g, s, rite, w, h, reduced, paint) {
  s.gone = s.gone.filter((was) => came(s, was.at, GONE, reduced) < 1);
  for (const was of s.gone) {
    const own = roll(rite, 0x5a, was.n);
    const k = 1 - own.stair(came(s, was.at, GONE, reduced));
    if (k <= 0) continue;
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    g.beginPath();
    own.region(g, 0, 0, w, h, k);
    g.clip();
    paint(was);
    g.restore();
  }
}

function goneFrom(s, journey) {
  s.goes += 1;
  s.gone.push(Object.assign({ at: s.t, n: s.goes }, journey));
}

// Where the mark over a guessed column stands now, in columns, or null while it is not yet on: the
// first is cut on at its moment, and each after it travels from where the mark stood when it was
// set, in the landing treads of that setting's roll.
function markAt(s, rite, base, reduced) {
  if (s.guess == null) return null;
  const own = roll(rite, base, s.guesses);
  const p = came(s, s.guessAt, 0.8, reduced);
  if (s.guessFrom == null) return own.flicker(p) ? s.guess : null;
  return travel(own, s.guessFrom, s.guess, p);
}

// A column guessed: the mark sets off from where it shows now -- or, not on yet, is cut on afresh.
function guessed(s, next, rite, base, reduced) {
  if (next == null || next === s.guess) return;
  s.guessFrom = markAt(s, rite, base, reduced);
  s.guess = next;
  s.guessAt = s.t;
  s.guesses += 1;
}

// The light that comes over a solved sky, cut in by the piece's edge up a stair from the moment of
// the solve, and resting in two shades.
function daybreak(g, rite, env, w, h, p, strength) {
  const own = roll(rite, 0xdb, 0);
  g.fillStyle = env.alpha(env.colors.accent2, strength || 0.06);
  cover(g, own, 0, 0, w, h, own.stair(p));
}

/* ---- drawing shared by both ---------------------------------------------------------------- */

function sky(g, w, h, env) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg);
  grad.addColorStop(1, env.mix(c.bg, c.bg2, 0.35));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// The stars as they stand, as faint sparks in the upper sky, and a scatter more from the
// configuration, so a sky of one star is still a sky. They stand still: they wait for nothing.
function sparks(g, w, h, env, v, depth) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.fg, 0.55);
  for (const p of env.points(w, h, 10)) {
    g.beginPath();
    g.arc(p.x, 6 + p.y * depth, 1.3 * v.scale, 0, TAU);
    g.fill();
  }
  const n = Math.max(4, Math.round(16 * v.density));
  g.fillStyle = env.alpha(c.fg, 0.25);
  for (let i = 0; i < n; i++) {
    const x = ((i * 0.6180339 + v.turn * 0.37) % 1) * w;
    const y = ((i * 0.7548777 + v.turn * 0.13) % 1) * h * depth;
    g.fillRect(x, y, 1, 1);
  }
}

// One lantern, `k` times the size it hangs at on the page, with a letter on it if it has one.
function lantern(g, env, x, y, glow, k, letter) {
  const c = env.colors;
  const lw = 12 * k;
  const lh = 16 * k;
  if (glow > 0) {
    const reach = 30 * glow * k;
    const halo = g.createRadialGradient(x, y, 0, x, y, reach);
    halo.addColorStop(0, env.alpha(c.accent2, Math.min(0.8, 0.25 + glow * 0.3)));
    halo.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  }
  g.strokeStyle = env.alpha(c.muted, 0.35);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y - lh / 2 - 12 * k);
  g.lineTo(x, y - lh / 2);
  g.stroke();
  g.fillStyle = c.accent2;
  g.beginPath();
  g.roundRect(x - lw / 2, y - lh / 2, lw, lh, 3 * k);
  g.fill();
  g.fillStyle = env.alpha(c.fg, 0.9);
  g.fillRect(x - lw / 2 - 1, y - lh / 2 - 2, lw + 2, 2);
  g.fillRect(x - lw / 2 - 1, y + lh / 2, lw + 2, 2);
  if (letter) {
    g.fillStyle = env.alpha(c.bg, 0.9);
    g.font = '700 ' + Math.max(8, Math.round(9 * k)) + 'px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, x, y + 0.5);
  }
}

function write(g, text, x, y, size, align, tone, weight) {
  g.fillStyle = tone;
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function shuffled(env, n) {
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(i);
  const out = [];
  while (rest.length) out.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  return out;
}

/* ---- the lighting order -------------------------------------------------------------------- */

// `order` is the lanterns in the order they rise; a clue says something true about that order.
function holds(clue, order) {
  const at = (i) => order.indexOf(i);
  const n = order.length;
  switch (clue.t) {
    case 'before': return at(clue.a) < at(clue.b);
    case 'after': return at(clue.a) === at(clue.b) + 1;
    case 'first': return at(clue.a) === 0;
    case 'last': return at(clue.a) === n - 1;
    case 'between': return Math.abs(at(clue.a) - at(clue.b)) === clue.d + 1;
    case 'notLast': return at(clue.a) !== n - 1;
    case 'notFirst': return at(clue.a) !== 0;
    case 'slot': return at(clue.a) === clue.k;
    default: return false;
  }
}

function clueText(clue) {
  const a = LETTERS[clue.a];
  const b = LETTERS[clue.b];
  switch (clue.t) {
    case 'before': return a + ' rises before ' + b;
    case 'after': return a + ' rises right after ' + b;
    case 'first': return a + ' rises first';
    case 'last': return a + ' rises last';
    case 'between': return clue.d === 1 ? 'one lantern rises between ' + a + ' and ' + b : WORDS[clue.d] + ' lanterns rise between ' + a + ' and ' + b;
    case 'notLast': return a + ' does not rise last';
    case 'notFirst': return a + ' does not rise first';
    case 'slot': return a + ' rises ' + ORDINAL[clue.k];
    default: return '';
  }
}

function permutations(n) {
  const out = [];
  const used = new Array(n).fill(false);
  const cur = [];
  (function walk() {
    if (cur.length === n) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      walk();
      cur.pop();
      used[i] = false;
    }
  })();
  return out;
}

function fits(clues, perms) {
  return perms.filter((p) => clues.every((clue) => holds(clue, p)));
}

// Every true clue about `order`, which the plan draws from.
function trueClues(order) {
  const n = order.length;
  const out = [];
  for (let a = 0; a < n; a++) {
    const pa = order.indexOf(a);
    out.push(pa === 0 ? { t: 'first', a } : { t: 'notFirst', a });
    out.push(pa === n - 1 ? { t: 'last', a } : { t: 'notLast', a });
    out.push({ t: 'slot', a, k: pa });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const pb = order.indexOf(b);
      if (pa < pb) out.push({ t: 'before', a, b });
      if (pa === pb + 1) out.push({ t: 'after', a, b });
      if (pa - pb >= 2 && a < b) out.push({ t: 'between', a, b, d: pa - pb - 1 });
      if (pb - pa >= 2 && a < b) out.push({ t: 'between', a, b, d: pb - pa - 1 });
    }
  }
  return out;
}

// The weight a clue carries in the draw: the vaguer kinds first, so the puzzle leans on reasoning
// rather than on being told where a lantern goes.
function clueWeight(clue) {
  return clue.t === 'slot' ? 1 : clue.t === 'first' || clue.t === 'last' ? 2 : clue.t === 'notFirst' || clue.t === 'notLast' || clue.t === 'after' ? 3 : 4;
}

function orderPlan(env) {
  const n = env.chance(0.45) ? 5 : 4;
  const perms = permutations(n);
  let order = null;
  let clues = null;
  for (let attempt = 0; attempt < 10 && !clues; attempt++) {
    const draw = shuffled(env, n);
    const candidates = trueClues(draw);
    let chosen = [];
    for (let guard = 0; guard < 40 && candidates.length && fits(chosen, perms).length !== 1; guard++) {
      const total = candidates.reduce((sum, clue) => sum + clueWeight(clue), 0);
      let roll = env.rnd() * total;
      let at = 0;
      for (let i = 0; i < candidates.length; i++) {
        roll -= clueWeight(candidates[i]);
        if (roll <= 0) {
          at = i;
          break;
        }
      }
      const clue = candidates.splice(at, 1)[0];
      if (fits(chosen.concat([clue]), perms).length < fits(chosen, perms).length) chosen.push(clue);
    }
    // Prune: a clue that can go without letting a second order in goes.
    for (let i = chosen.length - 1; i >= 0; i--) {
      const without = chosen.slice(0, i).concat(chosen.slice(i + 1));
      if (fits(without, perms).length === 1) chosen = without;
    }
    if (chosen.length <= 5 && fits(chosen, perms).length === 1) {
      order = draw;
      clues = chosen;
    }
  }
  if (!clues) {
    // Plainer clues, when the draw kept coming out long: most places named, the last two ordered.
    order = shuffled(env, n);
    clues = [];
    for (let k = 0; k < n - 2; k++) clues.push({ t: 'slot', a: order[k], k });
    clues.push({ t: 'before', a: order[n - 2], b: order[n - 1] });
  }
  // An opening order that is not the answer, so the sky asks something.
  let start = order.slice();
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, n);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return { kind: 'order', n, order, clues, start };
}

function carriedOrder(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'order') return null;
  const n = Number(p.n);
  if (n !== 4 && n !== 5) return null;
  const okIndex = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const isPerm = (list) => Array.isArray(list) && list.length === n && list.every(okIndex) && new Set(list).size === n;
  if (!isPerm(p.order) || !isPerm(p.start) || p.start.every((v, i) => v === p.order[i])) return null;
  if (!Array.isArray(p.clues) || !p.clues.length || p.clues.length > 5) return null;
  const okClue = (c) => c && typeof c === 'object' && ['before', 'after', 'first', 'last', 'between', 'notLast', 'notFirst', 'slot'].includes(c.t)
    && okIndex(c.a)
    && (!['before', 'after', 'between'].includes(c.t) || (okIndex(c.b) && c.b !== c.a))
    && (c.t !== 'between' || (Number.isInteger(c.d) && c.d >= 1 && c.d <= n - 2))
    && (c.t !== 'slot' || okIndex(c.k));
  if (!p.clues.every(okClue)) return null;
  const clues = p.clues.map((c) => ({ t: c.t, a: c.a, b: c.b, d: c.d, k: c.k }));
  const only = fits(clues, permutations(n));
  if (only.length !== 1 || !only[0].every((v, i) => v === p.order[i])) return null;
  return { kind: 'order', n, order: p.order.slice(), clues, start: p.start.slice() };
}

function orderTitle(plan) {
  return 'the lighting order: ' + WORDS[plan.n] + ' lanterns';
}

// Where the lanterns hang: one column each, left to right by letter, and a height for every rank.
function orderGeometry(w, h, n) {
  const span = w * 0.8;
  const top = h * 0.12;
  const bottom = h * 0.46;
  return { left: (w - span) / 2, span, cell: span / n, top, bottom, y: (rank) => top + ((bottom - top) * rank) / (n - 1) };
}

function orderBlank(plan) {
  const n = plan.n;
  return { order: plan.start.slice(), hinted: [], hintedAt: [], from: {}, moves: 0, lift: new Array(n).fill(0),
    glow: new Array(n).fill(0), t: 0, rose: 0, doneAt: -1, until: null, drawn: null, drawnAt: -Infinity };
}

// Where lantern i hangs now: its rank as it shows (a fraction while it travels, geo.y being even in
// rank) and the place its name says, which is the place it set off from until it has landed.
function hangs(s, rite, i, reduced) {
  const rank = s.order.indexOf(i);
  const from = s.from[i];
  if (!from) return { rank, name: rank };
  const e = landing(roll(rite, 0x100 + i, from.roll), came(s, from.at, 0.9, reduced));
  return e >= 1 ? { rank, name: rank } : { rank: from.rank + (rank - from.rank) * e, name: from.name };
}

function drawOrder(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const n = plan.n;
  const geo = orderGeometry(w, h, n);
  const k = Math.max(0.75, Math.min(2, Math.min(w, h) / 320)) * v.scale;
  const small = Math.max(9, Math.min(13, Math.round(Math.min(w, h) * 0.036)));
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.5);
  write(g, 'first to rise at the top', w / 2, h * 0.05, small, 'center', env.alpha(c.muted, 0.85));
  // A faint rail for each rank, so a height can be read as a place.
  g.strokeStyle = env.alpha(c.muted, 0.1 + 0.08 * v.density);
  g.lineWidth = 1;
  g.setLineDash([2, 5]);
  g.beginPath();
  for (let rank = 0; rank < n; rank++) {
    g.moveTo(geo.left, geo.y(rank));
    g.lineTo(geo.left + geo.span, geo.y(rank));
  }
  g.stroke();
  g.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const x = geo.left + (i + 0.5) * geo.cell;
    // A lantern moved to another place travels there in the landing treads of that move's roll,
    // and the name under it is cut over from the old place to the new as it lands.
    const hung = hangs(s, rite, i, reduced);
    const y = geo.y(hung.rank) - (s.lift[i] || 0);
    if (s.hinted.includes(i)) {
      // The hinted place is sealed: cut in by the piece's edge up the stair of that hint's roll,
      // resting in two shades, and its frame drawn once the seal has come whole.
      const at = s.hinted.indexOf(i);
      const hintRite = roll(rite, 0x200, at);
      const hintP = came(s, s.hintedAt[at], 0.8, reduced);
      const hy = geo.y(plan.order.indexOf(i));
      g.fillStyle = env.alpha(c.accent, 0.16);
      cover(g, hintRite, x - 11 * k, hy - 12 * k, 22 * k, 24 * k, hintRite.stair(hintP));
      if (hintRite.stair(hintP) >= 1) {
        g.strokeStyle = env.alpha(c.accent, 0.9);
        g.lineWidth = 1.5;
        g.setLineDash([3, 3]);
        g.strokeRect(x - 11 * k, hy - 12 * k, 22 * k, 24 * k);
        g.setLineDash([]);
      }
    }
    lantern(g, env, x, y, 0.5 + (s.glow[i] || 0), k, LETTERS[i]);
    write(g, ORDINAL[hung.name], x, geo.bottom + 24 * k, small, 'center', env.alpha(c.fg, 0.8));
  }
  // The clues, under the sky.
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.04)));
  const x0 = w * 0.08;
  g.fillStyle = env.alpha(c.muted, 0.2);
  g.fillRect(x0, h * 0.585, w * 0.84, 1);
  let y = h * 0.64;
  plan.clues.forEach((clue, i) => {
    write(g, String(i + 1) + '.', x0, y, size, 'left', env.alpha(c.accent2, 0.9));
    write(g, clueText(clue), x0 + size * 1.6, y, size, 'left', env.alpha(c.fg, 0.9));
    y += size * 1.5;
  });
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.06);
}

function orderPreview(g, w, h, env, plan) {
  drawOrder(g, w, h, env, plan, orderBlank(plan), env.variant);
}

function orderPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.n;
  const s = orderBlank(plan);
  const draw = (c) => drawn(s, c, () => drawOrder(c.g, c.w, c.h, c, plan, s, env.variant));
  const named = (list) => list.map((i) => LETTERS[i]).join(', ');
  function current(c) {
    const v = c.value('order');
    return Array.isArray(v) && v.length === n ? v.map(Number) : s.order;
  }
  // Every lantern whose place changed sets off from the height it shows now -- where it hangs, or
  // as far as it had come on a move still under way -- with the name it shows, on a roll of this
  // move's own.
  function rehang(next, c) {
    for (let i = 0; i < n; i++) {
      if (s.order.indexOf(i) === next.indexOf(i)) continue;
      const now = hangs(s, riteOf(c), i, c.reduced);
      s.from[i] = { rank: now.rank, name: now.name, at: s.t, roll: s.moves };
    }
    s.moves += 1;
    s.order = next;
  }
  return {
    title: orderTitle(plan),
    brief: 'Arrange ' + WORDS[n] + ' lanterns, first to rise at the top. Exactly one order fits these clues: '
      + plan.clues.map(clueText).join('; ') + '. Use the order controls, or tap a lantern to move it up one place; the first wraps to last.',
    goal: 'Put the lanterns in the one order the clues allow, first to rise at the top.',
    aspect: '1 / 1',
    checkLabel: 'check the order',
    steps: [
      { id: 'order', ask: 'the lanterns, first to rise at the top', kind: 'order', items: LETTERS.slice(0, n).map((letter, i) => ({ label: 'lantern ' + letter, value: i })), value: plan.start.slice() },
      { id: 'hint', ask: 'where one lantern rises', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: plan.order.slice() },
    check(c) {
      const cur = current(c);
      let right = 0;
      for (let i = 0; i < n; i++) if (cur[i] === plan.order[i]) right += 1;
      return {
        solved: right === n,
        say: right === n ? 'the order holds: ' + named(plan.order)
          : right === 0 ? 'none of them hangs in the right place yet' : WORDS[right] + ' of ' + WORDS[n] + ' lanterns in the right place'
      };
    },
    start(c) {
      c.status(WORDS[plan.clues.length] + ' clues under the sky; tap a lantern to move it up');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === n) {
        rehang(value.map(Number), c);
        c.status('first to last: ' + named(s.order));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.order.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== plan.order.indexOf(i))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintedAt.push(s.t);
          c.hint();
          c.status('lantern ' + LETTERS[next] + ' rises ' + ORDINAL[plan.order.indexOf(next)]);
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will show at this difficulty; the rest is yours');
        } else {
          c.status('every lantern out of place has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = orderGeometry(c.w, c.h, n);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= n || y * c.h > c.h * 0.58) {
        c.status('Tap a lantern above the clues to move it up one place.');
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
      rehang(next, c);
      c.set('order', next.slice());
      c.status('lantern ' + LETTERS[col] + ' now rises ' + ORDINAL[next.indexOf(col)]);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      let rising = false;
      if (c.done) {
        if (s.doneAt < 0) s.doneAt = s.t;
        rising = s.rose < 2;
        s.rose = c.reduced ? 2 : Math.min(2, s.rose + dt * 2);
        // The lanterns rise and brighten in treads, first to rise first, each on a roll of its own.
        for (let i = 0; i < n; i++) {
          const own = roll(riteOf(c), 0x300, i);
          const up = own.stair(Math.max(0, Math.min(1, s.rose - s.order.indexOf(i) * 0.12)));
          s.lift[i] = c.reduced ? 0 : up * 4 * Math.max(1, c.h / 320);
          s.glow[i] = up * 0.9;
        }
      }
      if (!rising && settled(s, c)) return;
      draw(c);
    },
    end(c) {
      if (s.doneAt < 0) s.doneAt = s.t;
      s.drawn = null;
      c.status(named(plan.order) + ': the order holds. The lights stay yours to rearrange.');
    }
  };
}

/* ---- where it drifts ----------------------------------------------------------------------- */

function driftTotal(bands) {
  return bands.reduce((a, b) => a + b, 0);
}

// The band that pushes hardest, counted from one; the plan keeps it unique.
function strongest(bands) {
  let best = 0;
  for (let i = 1; i < bands.length; i++) if (Math.abs(bands[i]) > Math.abs(bands[best])) best = i;
  return best + 1;
}

// Where the lantern is after each band: the release column, then one running sum per band.
function positions(bands) {
  const out = [0];
  for (const b of bands) out.push(out[out.length - 1] + b);
  return out;
}

function driftOk(bands) {
  if (!Array.isArray(bands) || (bands.length !== BANDS && bands.length !== BANDS + 1)) return false;
  if (!bands.every((d) => Number.isInteger(d) && d >= -4 && d <= 4)) return false;
  const abs = bands.map(Math.abs);
  const top = Math.max.apply(null, abs);
  if (top < 2 || abs.filter((a) => a === top).length !== 1 || abs.filter((a) => a === 0).length > 1) return false;
  const sum = driftTotal(bands);
  return sum !== 0 && sum >= -COLS && sum <= COLS;
}

// Most seeds rise through four bands; some through five, the long ascent.
function driftPlan(env) {
  const n = env.chance(0.35) ? BANDS + 1 : BANDS;
  for (let guard = 0; guard < 200; guard++) {
    const bands = [];
    for (let i = 0; i < n; i++) bands.push(env.int(-4, 4));
    if (driftOk(bands)) return { kind: 'drift', bands };
  }
  return { kind: 'drift', bands: [2, -1, 4, -2] };
}

function carriedDrift(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'drift' || !driftOk(p.bands)) return null;
  return { kind: 'drift', bands: p.bands.slice() };
}

function driftTitle(plan) {
  return plan.bands.length > BANDS ? 'the long ascent: five bands of wind' : 'where it drifts: four bands of wind';
}

function driftGeometry(w, h, n) {
  const span = w * 0.84;
  const left = (w - span) / 2;
  const cell = span / (COLS * 2 + 1);
  const top = h * 0.12;
  const bottom = h * 0.74;
  return { left, span, cell, top, bottom, band: (bottom - top) / (n || BANDS), x: (col) => left + (col + COLS + 0.5) * cell };
}

function arrow(g, x0, x1, y, head) {
  const dir = x1 > x0 ? 1 : -1;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y);
  g.lineTo(x1 - dir * head, y - head * 0.6);
  g.lineTo(x1 - dir * head, y + head * 0.6);
  g.closePath();
  g.fill();
}

// A climb of f bands, read through the rite: every band crossed is taken in landing treads rolled
// for that band of that flight, the longest step first and each after it shorter, so the lantern
// climbs in held steps, never floats up evenly, and never drops back.
function climbed(rite, base, flight, f, count) {
  if (f <= 0) return 0;
  if (f >= count) return count;
  const b = Math.floor(f);
  return Math.min(count, b + roll(rite, base + b, flight).ease(f - b));
}

// `band` is the band named as pushing hardest and `named` its seals (reseal()), `guess` the column
// said and `guessFrom` where its mark set off from, `flight` how many bands the lantern has climbed
// on its `launches`-th flight, `freedAt` when the first flight went (the moment "let go here" is
// cut out for good), and `gone` the flights given back to the edge (giveBack()).
function driftBlank() {
  return { band: 0, named: {}, seals: 0, guess: null, guessFrom: null, guessAt: -1, guesses: 0,
    hinted: [], hintAt: [], flight: 0, launches: 0, freedAt: -1, gone: [], goes: 0, t: 0, launched: false,
    doneAt: -1, until: null, drawn: null, drawnAt: -Infinity };
}

// A flight's lit path, as far as it has climbed (climbed(), in landing treads per band), and where
// its head is.
function driftPath(g, env, geo, pos, nb, rite, launches, flight) {
  const f = climbed(rite, 0x60, launches, Math.min(flight, nb), nb);
  const b = Math.min(nb - 1, Math.floor(f));
  const col = f >= nb ? pos[nb] : pos[b] + (pos[b + 1] - pos[b]) * (f - b);
  const head = { x: geo.x(col), y: geo.bottom - f * geo.band };
  g.strokeStyle = env.alpha(env.colors.accent2, 0.5);
  g.lineWidth = 1;
  g.setLineDash([2, 3]);
  g.beginPath();
  g.moveTo(geo.x(0), geo.bottom + geo.band * 0.42);
  for (let j = 1; j <= b; j++) g.lineTo(geo.x(pos[j]), geo.bottom - j * geo.band);
  g.lineTo(head.x, head.y);
  g.stroke();
  g.setLineDash([]);
  return head;
}

function drawDrift(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const nb = plan.bands.length;
  const geo = driftGeometry(w, h, nb);
  const k = Math.max(0.6, Math.min(1.6, Math.min(w, h) / 320)) * v.scale;
  const small = Math.max(8, Math.min(13, Math.round(Math.min(w, h) * 0.034)));
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.11);
  // The column grid, and the release column dotted up through every band.
  g.strokeStyle = env.alpha(c.muted, 0.1 + 0.06 * v.density);
  g.lineWidth = 1;
  g.beginPath();
  for (let col = 0; col <= COLS * 2 + 1; col++) {
    const x = geo.left + col * geo.cell;
    g.moveTo(x, geo.top);
    g.lineTo(x, geo.bottom + geo.band * 0.85);
  }
  g.stroke();
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.setLineDash([3, 4]);
  g.beginPath();
  g.moveTo(geo.x(0), geo.top - 4);
  g.lineTo(geo.x(0), geo.bottom + geo.band * 0.85);
  g.stroke();
  g.setLineDash([]);
  for (let col = -COLS; col <= COLS; col += 4) {
    write(g, signed(col), geo.x(col), h * 0.955, small, 'center', env.alpha(col === 0 ? c.accent2 : c.muted, 0.85));
  }
  // The bands, bottom to top: a strip, its number, and its push drawn from the dotted column. The
  // band the visitor names is sealed: cut in by the piece's edge up the stair of that naming's
  // roll, resting in two shades, its edge lit once the seal has come whole; every band named
  // before is given back as the same edge withdraws, each from what it showed.
  const pos = positions(plan.bands);
  for (let b = 0; b < nb; b++) {
    const y0 = geo.bottom - (b + 1) * geo.band;
    const d = plan.bands[b];
    g.fillStyle = env.alpha(b % 2 ? c.accent : c.accent2, 0.05);
    g.fillRect(geo.left, y0, geo.span, geo.band);
    g.fillStyle = env.alpha(c.accent2, 0.08);
    const lit = sealed(g, s, rite, 0x20, s.named[b + 1], { x: geo.left, y: y0, w: geo.span, h: geo.band }, reduced);
    g.strokeStyle = env.alpha(lit ? c.accent2 : c.muted, lit ? 0.7 : 0.3);
    g.strokeRect(geo.left, y0, geo.span, geo.band);
    write(g, 'band ' + (b + 1), geo.left + 4, y0 + small * 0.9, small, 'left', env.alpha(c.muted, 0.9));
    write(g, d === 0 ? 'still' : signed(d) + (Math.abs(d) === 1 ? ' column' : ' columns'), geo.left + geo.span - 4, y0 + small * 0.9, small, 'right', env.alpha(c.accent2, 0.95));
    const ym = y0 + geo.band * 0.62;
    if (d) {
      g.strokeStyle = env.alpha(c.fg, 0.85);
      g.fillStyle = env.alpha(c.fg, 0.85);
      g.lineWidth = Math.max(1.2, 1.5 * k);
      arrow(g, geo.x(0), geo.x(d), ym, Math.max(4, 5 * k));
    } else {
      g.strokeStyle = env.alpha(c.fg, 0.6);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(geo.x(0), ym, 3 * k, 0, TAU);
      g.stroke();
    }
    // A shown position is cut on at its moment, on the roll of that hint, and stays.
    const shown = s.hinted.indexOf(b + 1);
    if (shown >= 0 && roll(rite, 0x30, b).flicker(came(s, s.hintAt[shown], 0.8, reduced))) {
      g.fillStyle = env.alpha(c.accent, 0.95);
      g.beginPath();
      g.arc(geo.x(pos[b + 1]), y0, 3 * k, 0, TAU);
      g.fill();
      write(g, 'at ' + signed(pos[b + 1]), geo.x(pos[b + 1]), y0 - small * 0.8, small, 'center', env.alpha(c.accent, 0.95));
    }
  }
  // A flight the visitor has replayed: its old path is given back to the piece's edge while the
  // new one climbs.
  giveBack(g, s, rite, w, h, reduced, (was) => driftPath(g, env, geo, pos, nb, rite, was.launches, was.flight));
  // The lantern: hanging still under the first band, or in flight once it has been let go,
  // climbing each band in landing treads rolled for that band of that flight.
  let lx = geo.x(0);
  let ly = geo.bottom + geo.band * 0.42;
  const launchRite = roll(rite, 0x50, s.launches);
  if (s.flight > 0) {
    const head = driftPath(g, env, geo, pos, nb, rite, s.launches, s.flight);
    lx = head.x;
    ly = head.y;
  }
  // "let go here" is cut out at the first launch's moment, as the lantern goes, and stays out.
  if (!(s.freedAt >= 0 && roll(rite, 0x50, 0).flicker(came(s, s.freedAt, 0.6, reduced)))) {
    write(g, 'let go here', geo.x(0) + 10 * k, geo.bottom + geo.band * 0.42, small, 'left', env.alpha(c.muted, 0.9));
  }
  lantern(g, env, lx, ly, 0.7 + launchRite.stair(Math.min(1, s.flight)) * 0.5, k, '');
  // The answer as set: a hollow mark over the column the visitor says it leaves at (markAt()),
  // never taken away to be put back.
  const gx = markAt(s, rite, 0x70, reduced);
  if (gx != null) {
    g.strokeStyle = env.alpha(c.accent, 0.9);
    g.lineWidth = 1.5;
    g.setLineDash([3, 3]);
    g.strokeRect(geo.x(gx) - 6 * k, geo.top - 10 * k, 12 * k, 8 * k);
    g.setLineDash([]);
  }
  write(g, 'where it leaves the top', w / 2, h * 0.045, small, 'center', env.alpha(c.muted, 0.85));
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.06);
}

function driftPreview(g, w, h, env, plan) {
  drawDrift(g, w, h, env, plan, driftBlank(), env.variant);
}

function driftPiece(env, plan) {
  const helps = asked(env).helps;
  const nb = plan.bands.length;
  const total = driftTotal(plan.bands);
  const hard = strongest(plan.bands);
  const pos = positions(plan.bands);
  const s = driftBlank();
  const draw = (c) => drawn(s, c, () => drawDrift(c.g, c.w, c.h, c, plan, s, env.variant));
  const leaves = (n) => 'column ' + signed(n) + ', ' + WORDS[Math.abs(n)] + (Math.abs(n) === 1 ? ' column ' : ' columns ') + (n < 0 ? 'left' : 'right') + ' of where it was let go';
  return {
    title: driftTitle(plan),
    brief: 'Add the winds to follow a lantern released at column 0. Read bands from bottom to top; negative pushes left and positive pushes right. Winds in columns: '
      + plan.bands.map((wind, i) => 'band ' + (i + 1) + ': ' + signed(wind)).join('; ')
      + '. The strongest band has the largest push, ignoring its sign.',
    goal: 'Say how many columns it has drifted when it leaves the top, and which band pushes hardest.',
    aspect: '4 / 3',
    checkLabel: 'let it go',
    steps: [
      { id: 'drift', ask: 'its drift when it leaves the top, in columns (left is negative)', kind: 'number', min: -COLS, max: COLS, step: 1, value: 0, unit: 'columns' },
      { id: 'band', ask: 'the band that pushes hardest', kind: 'number', min: 1, max: nb, step: 1, value: 1 },
      // One press, one band shown, and the difficulty says how many bands the wind will show.
      { id: 'hint', ask: 'where it is after the next band', kind: 'press', count: Math.max(1, Math.min(nb - 1, helps)), label: 'show me', optional: true }
    ],
    solution: { drift: total, band: hard },
    check(c) {
      const guess = Math.round(Number(c.value('drift')));
      const band = Math.round(Number(c.value('band')));
      const driftRight = guess === total;
      const bandRight = band === hard;
      // A wrong check changes nothing on the sky: a path already lit is the true one, and stays.
      if (driftRight && bandRight) {
        // Every flight is its own: a fresh roll for its climb and its glow. A flight that already
        // climbed is given back to the piece's edge, and the lantern is cut over once to the
        // release column to climb again.
        if (s.flight > 0) goneFrom(s, { launches: s.launches, flight: s.flight });
        s.launched = true;
        s.launches += 1;
        if (s.freedAt < 0) s.freedAt = s.t;
        s.flight = c.reduced ? nb : 0;
        draw(c);
        return { solved: true, say: 'it leaves the top at ' + leaves(total) + '; band ' + hard + ' pushed hardest' };
      }
      const parts = [];
      if (!driftRight) parts.push(guess < total ? 'it leaves the top further right than that' : 'it leaves the top further left than that');
      parts.push(bandRight ? 'the band is right' : 'band ' + band + ' is not the one that pushes hardest');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(WORDS[nb] + ' bands, one lantern, the grid to count on');
      draw(c);
    },
    apply(id, value, c) {
      // A knob turned leaves the sky as it is: the path a solved flight lit is the true one, so a
      // change of answer does not take it away.
      const rite = riteOf(c);
      if (id === 'drift') {
        const n = Math.round(Number(value));
        // The mark sets off from where it shows, on a roll of this setting's own.
        if (Number.isFinite(n)) guessed(s, Math.max(-COLS, Math.min(COLS, n)), rite, 0x70, c.reduced);
        c.status('you say it leaves at ' + signed(s.guess));
      }
      if (id === 'band') {
        const n = Math.round(Number(value));
        const next = Number.isFinite(n) ? Math.max(1, Math.min(nb, n)) : 0;
        if (next !== s.band) {
          // The band named before is given back while this one seals, each from what it shows.
          reseal(s, s.named, s.band > 0 ? s.band : null, false, rite, 0x20, c.reduced);
          reseal(s, s.named, next > 0 ? next : null, true, rite, 0x20, c.reduced);
          s.band = next;
        }
        c.status('you say band ' + s.band + ' pushes hardest');
      }
      if (id === 'hint') {
        const next = s.hinted.length + 1;
        if (s.hinted.length < Math.min(nb - 1, helps)) {
          s.hinted.push(next);
          s.hintAt.push(s.t);
          c.hint();
          c.status('after band ' + next + ' it is at ' + signed(pos[next]));
        } else {
          c.status('No hints left at this difficulty. The shown positions stay marked on the grid.');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      const climbing = s.launched && s.flight < nb;
      if (climbing) s.flight = c.reduced ? nb : Math.min(nb, s.flight + dt * nb * 1.2);
      if (!climbing && settled(s, c)) return;
      draw(c);
    },
    end(c) {
      if (s.doneAt < 0) s.doneAt = s.t;
      s.drawn = null;
      c.status('It arrives at ' + signed(total) + '. The path stays lit; press check again to replay the ascent.');
    }
  };
}

/* ---- the two witnesses ---------------------------------------------------------------------- */

const WIND_IDS = ['lower-wind', 'upper-wind'];

function witnessPlan(env, base) {
  const split = env.int(1, base.bands.length - 1);
  return { kind: 'witness', bands: base.bands.slice(), split,
    lower: env.int(0, split - 1), upper: env.int(split, base.bands.length - 1) };
}

function carriedWitness(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'witness' || !driftOk(p.bands)) return null;
  if (![p.split, p.lower, p.upper].every(Number.isInteger)
      || p.split < 1 || p.split >= p.bands.length
      || p.lower < 0 || p.lower >= p.split
      || p.upper < p.split || p.upper >= p.bands.length) return null;
  return { kind: 'witness', bands: p.bands.slice(), split: p.split, lower: p.lower, upper: p.upper };
}

function witnessTitle(p) {
  return 'the two witnesses: ' + WORDS[p.bands.length] + ' winds';
}

function witnessClues(p) {
  const winds = p.bands.map((wind, i) => 'band ' + (i + 1) + ': '
    + (i === p.lower || i === p.upper ? 'missing' : signed(wind))).join('; ');
  return 'Winds, bottom to top: ' + winds + '. A starts at column 0 below band 1 and arrives at '
    + signed(driftTotal(p.bands)) + '. B starts at column 0 below band ' + (p.split + 1)
    + ' and arrives at ' + signed(driftTotal(p.bands.slice(p.split))) + '.';
}

function witnessGeometry(w, h, n) {
  return { left: w * 0.08, span: w * 0.84, top: h * 0.24, bottom: h * 0.77,
    band: h * 0.53 / n, x: (col) => w * (0.5 + col * 0.023) };
}

// `winds` are the two missing winds as set, each swung from `windFrom` (where its arrow pointed
// when it was set) and read as `windWas` until its setting's moment; `look` is the band looked at
// and `looked` its seals (reseal()); `run` the winds of the pair last traced, `runs` how many have
// been traced and `flight` how far up this one has climbed (0..1); `gone` the traced pairs given
// back to the edge (giveBack()).
function witnessBlank() {
  return { winds: [0, 0], windFrom: [0, 0], windWas: [0, 0], windAt: [-1, -1], windSets: [0, 0], hints: 0, hintAt: [],
    run: null, runs: 0, flight: 0, look: -1, looked: {}, seals: 0, gone: [], goes: 0, t: 0, doneAt: -1,
    until: null, drawn: null, drawnAt: -Infinity };
}

// The arrow of a wind the visitor sets, in columns: swung from where it pointed when it was set to
// the new push, in the landing treads of that setting's roll.
function windShown(s, rite, at, reduced) {
  return travel(roll(rite, 0x80 + at, s.windSets[at]), s.windFrom[at], s.winds[at], came(s, s.windAt[at], 0.9, reduced));
}

// The number its readout shows: the one it read until the setting's moment, and the new one from
// that moment on -- one cut over, never a gap.
function windRead(s, rite, at, reduced) {
  return roll(rite, 0x80 + at, s.windSets[at]).flicker(came(s, s.windAt[at], 0.9, reduced)) ? s.winds[at] : s.windWas[at];
}

// The two lanterns' paths of one traced pair, as far as they have climbed: A from below band 1, B
// from below its own band, each band in landing treads rolled for that band of that run. Hands back
// each lantern's head: its column, how many bands it has climbed, and the height it has reached.
function witnessPaths(g, env, geo, plan, rite, run, runs, flight) {
  const c = env.colors;
  const nb = plan.bands.length;
  const heads = [];
  for (let i = 0; i < 2; i++) {
    const start = i ? plan.split : 0;
    const count = nb - start;
    const pos = positions(run.slice(start));
    const f = climbed(rite, 0xa0 + i * 8, runs, flight * count, count);
    const b = Math.min(count - 1, Math.floor(f));
    const col = f >= count ? pos[count] : pos[b] + (pos[b + 1] - pos[b]) * (f - b);
    const boundary = geo.bottom - (start + f) * geo.band;
    g.strokeStyle = env.alpha(i ? c.accent : c.accent2, 0.8);
    g.lineWidth = 1.5;
    g.setLineDash(i ? [3, 3] : []);
    g.beginPath();
    g.moveTo(geo.x(0), geo.bottom - start * geo.band);
    for (let j = 1; j <= Math.min(count, Math.floor(f)); j++) {
      g.lineTo(geo.x(pos[j]), geo.bottom - (start + j) * geo.band);
    }
    g.lineTo(geo.x(col), boundary);
    g.stroke();
    g.setLineDash([]);
    heads.push({ col, f, boundary });
  }
  return heads;
}

function drawWitness(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const nb = plan.bands.length;
  const geo = witnessGeometry(w, h, nb);
  const size = Math.max(9, Math.min(14, Math.round(Math.min(w, h) * 0.043)));
  const k = Math.max(0.55, Math.min(1.5, Math.min(w, h) / 300)) * v.scale;
  const arrivals = [driftTotal(plan.bands), driftTotal(plan.bands.slice(plan.split))];
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.18);
  write(g, 'A arrives ' + signed(arrivals[0]), w * 0.27, h * 0.06, size, 'center', c.fg);
  write(g, 'B arrives ' + signed(arrivals[1]), w * 0.73, h * 0.06, size, 'center', c.fg);
  g.strokeStyle = env.alpha(c.muted, 0.25);
  g.lineWidth = 1;
  g.setLineDash([2, 4]);
  g.beginPath();
  g.moveTo(geo.x(0), geo.top);
  g.lineTo(geo.x(0), geo.bottom);
  g.stroke();
  g.setLineDash([]);
  for (let b = 0; b < nb; b++) {
    const y = geo.bottom - (b + 1) * geo.band;
    const missing = b === plan.lower ? 0 : b === plan.upper ? 1 : -1;
    // A wind the visitor set swings its arrow in the landing treads of that setting's roll, from
    // where it pointed; its readout keeps the number it read until the setting's moment and is cut
    // over to the new one then.
    const wind = missing < 0 ? plan.bands[b] : windShown(s, rite, missing, reduced);
    g.fillStyle = env.alpha(b % 2 ? c.accent : c.accent2, 0.045);
    g.fillRect(geo.left, y, geo.span, geo.band);
    // The band being looked at is sealed: cut in by the piece's edge up the stair of that look's
    // roll -- round the point it was tapped at, on a piece whose edge is a curve -- and resting in
    // two shades; every band looked at before is given back as the edge withdraws.
    g.fillStyle = env.alpha(b % 2 ? c.accent : c.accent2, 0.07);
    sealed(g, s, rite, 0x70, s.looked[b], { x: geo.left, y, w: geo.span, h: geo.band }, reduced);
    g.strokeStyle = env.alpha(c.muted, 0.3);
    g.strokeRect(geo.left, y, geo.span, geo.band);
    write(g, 'band ' + (b + 1), geo.left + 4, y + size * 0.8, size, 'left', c.fg);
    write(g, missing < 0 ? signed(wind) : '? / set ' + signed(windRead(s, rite, missing, reduced)),
      geo.left + geo.span - 4, y + size * 0.8, size, 'right', c.accent2);
    g.strokeStyle = missing < 0 ? c.fg : c.accent;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 1.5;
    g.setLineDash(missing < 0 ? [] : [2, 3]);
    if (Math.abs(wind) >= 0.05) arrow(g, geo.x(0), geo.x(wind), y + geo.band * 0.68, 4 * k);
    else {
      g.beginPath();
      g.arc(geo.x(0), y + geo.band * 0.68, 2 * k, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);
    // A worked subtraction's answer is cut on at its moment, on the roll of that hint, and stays.
    const told = missing === 1 && s.hints >= 2 ? 1 : missing === 0 && s.hints >= 4 ? 3 : -1;
    if (told >= 0 && roll(rite, 0x90, told).flicker(came(s, s.hintAt[told], 0.8, reduced))) {
      write(g, 'shown ' + signed(plan.bands[b]), w / 2, y + size * 0.8, size, 'center', c.accent2);
    }
  }
  // A traced pair the visitor has moved on from -- a wind changed, a new check -- leaves its paths
  // to the piece's edge; the pair traced now climbs from its starts.
  giveBack(g, s, rite, w, h, reduced, (was) => witnessPaths(g, env, geo, plan, rite, was.run, was.runs, was.flight));
  const heads = s.run ? witnessPaths(g, env, geo, plan, rite, s.run, s.runs, s.flight) : null;
  for (let i = 0; i < 2; i++) {
    const start = i ? plan.split : 0;
    const count = nb - start;
    const lift = (i ? 22 : 8) * k;
    g.strokeStyle = env.alpha(i ? c.accent : c.accent2, 0.8);
    g.lineWidth = 1.5;
    g.setLineDash(i ? [3, 3] : []);
    g.beginPath();
    g.arc(geo.x(arrivals[i]), geo.top - lift, 10 * k, 0, TAU);
    g.stroke();
    g.setLineDash([]);
    // The lantern stands at its start until a pair is traced, then climbs with its path; the lift
    // into the ring at the top comes up a stair.
    const head = heads ? heads[i] : { col: 0, f: 0, boundary: geo.bottom - start * geo.band };
    const runRite = roll(rite, 0xc0 + i, s.runs);
    const rise = runRite.stair(Math.max(0, Math.min(1, (s.flight - 0.7) / 0.3)));
    const y = head.boundary + geo.band * 0.32 * (1 - head.f / count) - lift * rise;
    lantern(g, env, geo.x(head.col), y, 0.7 + runRite.stair(s.flight) * 0.5, k, i ? 'B' : 'A');
  }
  write(g, 'A starts below band 1', w / 2, h * 0.88, size, 'center', c.fg);
  write(g, 'B starts below band ' + (plan.split + 1), w / 2, h * 0.95, size, 'center', c.fg);
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.06);
}

function witnessPreview(g, w, h, env, plan) {
  drawWitness(g, w, h, env, plan, witnessBlank(), env.variant);
}

function witnessPiece(env, plan) {
  const helps = Math.min(4, asked(env).helps);
  const missing = [plan.lower, plan.upper];
  const arrivals = [driftTotal(plan.bands), driftTotal(plan.bands.slice(plan.split))];
  const visibleUpper = arrivals[1] - plan.bands[plan.upper];
  const remaining = arrivals[0] - plan.bands[plan.lower];
  const hints = [
    'B misses the lower unknown wind. The visible winds above its start add to ' + signed(visibleUpper)
      + '; subtract that from its arrival, ' + signed(arrivals[1]) + '.',
    'Band ' + (plan.upper + 1) + ': ' + signed(arrivals[1]) + ' - (' + signed(visibleUpper)
      + ') = ' + signed(plan.bands[plan.upper]) + '.',
    'For A, the visible winds plus the recovered upper wind add to ' + signed(remaining)
      + '. Subtract this from its arrival, ' + signed(arrivals[0]) + '.',
    'Band ' + (plan.lower + 1) + ': ' + signed(arrivals[0]) + ' - (' + signed(remaining)
      + ') = ' + signed(plan.bands[plan.lower]) + '.'
  ];
  const s = witnessBlank();
  const draw = (c) => drawn(s, c, () => drawWitness(c.g, c.w, c.h, c, plan, s, env.variant));
  const valid = (n) => Number.isInteger(n) && n >= -4 && n <= 4;
  // A wind set: its arrow sets off from where it points now and its readout from the number it
  // reads now, on a roll of this setting's own. Whether it changed.
  function setWind(at, wind, c) {
    if (wind === s.winds[at]) return false;
    const rite = riteOf(c);
    s.windFrom[at] = windShown(s, rite, at, c.reduced);
    s.windWas[at] = windRead(s, rite, at, c.reduced);
    s.winds[at] = wind;
    s.windAt[at] = s.t;
    s.windSets[at] += 1;
    return true;
  }
  // The pair traced before is given back to the piece's edge, and both lanterns are cut over once
  // to where their next journey starts.
  function moveOn() {
    if (s.run && s.flight > 0) goneFrom(s, { run: s.run, runs: s.runs, flight: s.flight });
    s.run = null;
    s.flight = 0;
  }
  // The band looked at seals and the one looked at before is given back, each from what it shows,
  // on a roll of this look's own; a tap's seal grows round the point it landed on.
  function look(next, c, point) {
    if (next === s.look) return;
    const rite = riteOf(c);
    reseal(s, s.looked, s.look >= 0 ? s.look : null, false, rite, 0x70, c.reduced);
    reseal(s, s.looked, next >= 0 ? next : null, true, rite, 0x70, c.reduced, point);
    s.look = next;
  }
  return {
    title: witnessTitle(plan),
    brief: 'Recover two missing winds from two lantern journeys. Each band adds its push in columns: negative is left, positive is right. Both lanterns cross every band above their start. '
      + witnessClues(plan) + ' Tap a band to read it.',
    goal: 'Set both missing winds so A and B reach their stated arrival columns.',
    aspect: '1 / 1',
    checkLabel: 'check the journeys',
    steps: WIND_IDS.map((id, i) => ({ id, ask: 'band ' + (missing[i] + 1) + ': the missing wind',
      kind: 'number', min: -4, max: 4, step: 1, value: 0, unit: 'columns' })).concat([
      { id: 'hint', ask: 'a worked subtraction (up to ' + helps + ' hints)', kind: 'press',
        count: 1, label: 'show a hint', optional: true }
    ]),
    solution: { 'lower-wind': plan.bands[plan.lower], 'upper-wind': plan.bands[plan.upper] },
    check(c) {
      const winds = WIND_IDS.map((id) => Number(c.value(id)));
      if (!winds.every(valid)) return { solved: false, say: 'Set both winds to whole numbers from -4 to +4.' };
      const trial = plan.bands.slice();
      missing.forEach((band, i) => { trial[band] = winds[i]; });
      const right = Number(driftTotal(trial) === arrivals[0])
        + Number(driftTotal(trial.slice(plan.split)) === arrivals[1]);
      winds.forEach((wind, i) => setWind(i, wind, c));
      // Every run is its own: a fresh roll for the climb, the lift and the glow.
      moveOn();
      s.run = trial;
      s.runs += 1;
      s.flight = c.reduced ? 1 : 0;
      draw(c);
      return { solved: right === 2, say: right === 2
        ? 'Both lanterns reach their arrival columns. The two missing winds are recovered.'
        : capital(WORDS[right]) + ' of two arrival columns matched. The paths show the winds you set.' };
    },
    start(c) {
      c.status('Two starting heights, two arrival columns. Find the two missing winds.');
      draw(c);
    },
    apply(id, value, c) {
      const at = WIND_IDS.indexOf(id);
      if (at >= 0) {
        const wind = Number(value);
        if (!valid(wind)) {
          c.status('Use a whole number from -4 to +4 for a missing wind.');
          return;
        }
        // The paths traced were of the winds as they stood: a wind changed gives them back.
        if (setWind(at, wind, c)) moveOn();
        look(missing[at], c, null);
        c.status('Band ' + (missing[at] + 1) + ' set to ' + signed(wind) + '. Check to trace both journeys.');
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          c.hint();
          c.status(hints[s.hints]);
          s.hintAt[s.hints] = s.t;
          s.hints += 1;
        } else c.status('No hints left at this difficulty. ' + hints[s.hints - 1]);
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = witnessGeometry(c.w, c.h, plan.bands.length);
      const band = Math.floor((geo.bottom - y * c.h) / geo.band);
      const next = x * c.w < geo.left || x * c.w > geo.left + geo.span || band < 0 || band >= plan.bands.length ? -1 : band;
      const box = { x: geo.left, y: geo.bottom - (band + 1) * geo.band, w: geo.span, h: geo.band };
      look(next, c, next >= 0 ? within(x * c.w, y * c.h, box) : null);
      if (next < 0) {
        c.status(witnessClues(plan));
      } else {
        const at = missing.indexOf(band);
        c.status('Band ' + (band + 1) + (at < 0 ? ' pushes ' + signed(plan.bands[band]) + ' columns.'
          : ' is missing. You have set ' + signed(s.winds[at]) + '; use its number control to change it.'));
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      const climbing = !!s.run && s.flight < 1;
      if (climbing) s.flight = c.reduced ? 1 : Math.min(1, s.flight + dt * 1.2);
      if (!climbing && settled(s, c)) return;
      draw(c);
    },
    end(c) {
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status('Both witnesses agree. Change a wind and check again to send them on a different journey.');
      draw(c);
    }
  };
}

/* ---- the midnight crossing ----------------------------------------------------------------- */

function mirrorFirst(bands, gap) {
  let travelled = 0;
  for (let i = 0; i < bands.length; i++) {
    travelled += bands[i];
    if (travelled >= gap) return i + 1;
  }
  return 0;
}

function mirrorOk(p) {
  if (!p || !Number.isInteger(p.gap) || p.gap < 2 || p.gap > 4
      || !Array.isArray(p.bands) || (p.bands.length !== BANDS && p.bands.length !== BANDS + 1)
      || !p.bands.every((d) => Number.isInteger(d) && d >= -3 && d <= 3)
      || !p.bands.some((d) => d > 0) || !p.bands.some((d) => d < 0)) return false;
  let travelled = 0;
  for (const wind of p.bands) {
    travelled += wind;
    if (Math.abs(travelled - p.gap) > COLS) return false;
  }
  return mirrorFirst(p.bands, p.gap) > 0 && travelled !== p.gap;
}

function mirrorPlan(env) {
  const n = env.chance(0.35) ? BANDS + 1 : BANDS;
  const gap = env.int(2, 4);
  for (let attempt = 0; attempt < 200; attempt++) {
    const bands = Array.from({ length: n }, () => env.int(-3, 3));
    const plan = { kind: 'mirror', gap, bands };
    if (mirrorOk(plan)) return plan;
  }
  return { kind: 'mirror', gap: 2, bands: n === BANDS ? [1, -1, 3, 1] : [1, -1, 3, -1, 1] };
}

function carriedMirror(env) {
  const p = env.card && env.card.of;
  return p && p.kind === 'mirror' && mirrorOk(p)
    ? { kind: 'mirror', gap: p.gap, bands: p.bands.slice() } : null;
}

function mirrorTitle(p) {
  return 'the midnight crossing: ' + WORDS[p.bands.length] + ' winds';
}

// `focus` is the band marked as the first crossing and `marked` its seals (reseal()), `guess` the
// exit column marked (`guessFrom` where its mark set off from), `hints` how many bands are shown
// and `hintAt` when the latest was, and `flight` how many bands of the journey a solved sky shows,
// climbing from `flightFrom`, the part of the journey showing when it was solved.
function mirrorBlank() {
  return { t: 0, focus: 0, marked: {}, seals: 0, guess: null, guessFrom: null, guessAt: -1, guesses: 0,
    hints: 0, hintAt: -1, doneAt: -1, flight: 0, flightFrom: 0, until: null, drawn: null, drawnAt: -Infinity };
}

// How many bands of the journey are shown, as a fraction: on a solved sky the replay's climb, and
// before it the bands the hints have shown, the latest travelled in its hint's landing treads.
function reachOf(s, rite, nb, reduced) {
  if (s.doneAt >= 0) return Math.min(nb, s.flight);
  if (!s.hints) return 0;
  return Math.min(nb, s.hints - 1 + landing(roll(rite, 0x4b, s.hints), came(s, s.hintAt, 0.8, reduced)));
}

function drawMirror(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const nb = plan.bands.length;
  const geo = driftGeometry(w, h, nb);
  const k = Math.max(0.65, Math.min(1.6, Math.min(w, h) / 320)) * v.scale;
  const small = Math.max(9, Math.min(13, Math.round(Math.min(w, h) * 0.035)));
  const reduced = !!env.reduced;
  const pos = positions(plan.bands);
  const reach = reachOf(s, rite, nb, reduced);
  const whole = Math.floor(reach);
  const part = reach - whole;
  const boundary = (i) => geo.bottom - i * geo.band;
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.1);
  write(g, 'A follows the wind · B mirrors it', w / 2, h * 0.05, small, 'center', c.fg);
  g.strokeStyle = env.alpha(c.muted, 0.3);
  g.lineWidth = 1;
  g.setLineDash([2, 5]);
  g.beginPath();
  g.moveTo(geo.x(0), geo.top);
  g.lineTo(geo.x(0), geo.bottom + geo.band * 0.5);
  g.stroke();
  g.setLineDash([]);
  // The band marked as the first crossing is sealed: cut in by the piece's edge up the stair of
  // that marking's roll -- round the point it was tapped at, on a piece whose edge is a curve --
  // resting in two shades, its edge lit once the seal has come whole; every band marked before is
  // given back as the same edge withdraws, each from what it showed.
  for (let b = 0; b < nb; b++) {
    const y = boundary(b + 1);
    const wind = plan.bands[b];
    g.fillStyle = env.alpha(b % 2 ? c.accent : c.accent2, 0.06);
    g.fillRect(geo.left, y, geo.span, geo.band);
    g.fillStyle = env.alpha(c.accent2, 0.08);
    const lit = sealed(g, s, rite, 0x4c, s.marked[b + 1], { x: geo.left, y, w: geo.span, h: geo.band }, reduced);
    g.strokeStyle = env.alpha(lit ? c.accent2 : c.muted, lit ? 0.9 : 0.35);
    g.lineWidth = lit ? 2 : 1;
    g.strokeRect(geo.left, y, geo.span, geo.band);
    write(g, 'band ' + (b + 1), geo.left + 4, y + small, small, 'left', c.fg);
    write(g, 'wind ' + signed(wind), geo.left + geo.span - 4, y + small, small, 'right', c.accent2);
    if (wind) {
      g.strokeStyle = c.accent;
      g.fillStyle = c.accent;
      g.lineWidth = 1.5;
      arrow(g, geo.x(0), geo.x(wind), y + geo.band * 0.68, 4 * k);
    } else {
      g.strokeStyle = c.accent;
      g.beginPath();
      g.arc(geo.x(0), y + geo.band * 0.68, 3 * k, 0, TAU);
      g.stroke();
    }
  }
  // The two journeys, drawn as far as they are shown: each lantern hangs below the chart until a
  // band is shown and then stands on the path's end, every step of it forward.
  for (let lamp = 0; lamp < 2; lamp++) {
    const side = lamp ? -1 : 1;
    const xAt = (i) => geo.x(side * (pos[i] - plan.gap));
    const at = (i) => (i ? { x: xAt(i), y: boundary(i) } : { x: xAt(0), y: geo.bottom });
    const from = at(whole);
    const to = whole < nb ? at(whole + 1) : from;
    const head = reach > 0 ? { x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part }
      : { x: xAt(0), y: geo.bottom + geo.band * 0.4 };
    g.strokeStyle = env.alpha(lamp ? c.accent : c.accent2, 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(xAt(0), geo.bottom + geo.band * 0.4);
    g.lineTo(xAt(0), geo.bottom);
    for (let i = 1; i <= whole; i++) g.lineTo(xAt(i), boundary(i));
    if (part > 0) g.lineTo(head.x, head.y);
    g.stroke();
    lantern(g, env, head.x, head.y, 0.8, k, lamp ? 'B' : 'A');
  }
  // The exit column as marked (markAt()): the first mark is cut on at its moment; after that it
  // travels from where it stood in the landing treads of that marking's roll.
  const gx = markAt(s, rite, 0x4d, reduced);
  if (gx != null) {
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.setLineDash([3, 3]);
    g.strokeRect(geo.x(gx) - 5 * k, geo.top - 10 * k, 10 * k, 8 * k);
    g.setLineDash([]);
  }
  write(g, 'A starts at ' + signed(-plan.gap) + ' · B at ' + signed(plan.gap), w / 2, h * 0.93, small, 'center', c.fg);
  if (s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.06);
}

function mirrorPreview(g, w, h, env, plan) {
  drawMirror(g, w, h, env, plan, mirrorBlank(), env.variant);
}

function mirrorPiece(env, plan) {
  const { helps } = asked(env);
  const nb = plan.bands.length;
  const first = mirrorFirst(plan.bands, plan.gap);
  const exit = -plan.gap + driftTotal(plan.bands);
  const pos = positions(plan.bands);
  const s = mirrorBlank();
  const draw = (c) => drawn(s, c, () => drawMirror(c.g, c.w, c.h, c, plan, s, env.variant));
  // A band marked as the first crossing seals, and the one marked before is given back, each from
  // what it shows, on a roll of this marking's own; a tap's seal grows round the point it landed on.
  function mark(band, c, point) {
    if (!Number.isFinite(band) || band === s.focus) return;
    const rite = riteOf(c);
    reseal(s, s.marked, s.focus > 0 ? s.focus : null, false, rite, 0x4c, c.reduced);
    reseal(s, s.marked, band > 0 ? band : null, true, rite, 0x4c, c.reduced, point);
    s.focus = band;
  }
  return {
    title: mirrorTitle(plan),
    brief: 'A begins at column ' + signed(-plan.gap) + ' and B at ' + signed(plan.gap)
      + '. Both rise through the same winds, bottom to top. A follows each wind; B moves the same distance in the OPPOSITE direction. Compare their columns after each band: which is the FIRST band after which A is level with or right of B? Where does A leave the top? Winds: '
      + plan.bands.map((wind, i) => 'band ' + (i + 1) + ': ' + signed(wind)).join('; ')
      + '. Tap a band to mark it as the first crossing.',
    goal: 'Mark the first band after which A is level with or right of B, and A\'s exit column.',
    aspect: '4 / 3',
    checkLabel: 'check the crossing',
    steps: [
      { id: 'cross', ask: 'first crossing band, counted from the bottom', kind: 'number', min: 1, max: nb, step: 1, value: 1 },
      { id: 'exit', ask: 'A\'s exit column (left is negative)', kind: 'number', min: -COLS, max: COLS, step: 1, value: 0 },
      { id: 'hint', ask: 'show where both lanterns are after the next band', kind: 'press', count: 1, label: 'show a band', optional: true }
    ],
    solution: { cross: first, exit },
    check(c) {
      const crossingMatches = Number(c.value('cross')) === first;
      const exitMatches = Number(c.value('exit')) === exit;
      return { solved: crossingMatches && exitMatches, say: crossingMatches && exitMatches
        ? 'A reaches or passes B after band ' + first + ' and leaves at column ' + signed(exit)
        : 'the first crossing band ' + (crossingMatches ? 'matches' : 'does not match')
          + '; A\'s exit column ' + (exitMatches ? 'matches' : 'does not match') };
    },
    start(c) {
      c.status('A follows each wind; B mirrors it. Compare their columns after each band.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'cross') {
        mark(Number(value), c, null);
        c.status('Band ' + value + ' marked as the first crossing.');
      }
      if (id === 'exit') {
        const next = Number(value);
        // The mark sets off from where it shows, on a roll of this marking's own.
        if (Number.isFinite(next)) guessed(s, next, riteOf(c), 0x4d, c.reduced);
        c.status('You marked column ' + signed(s.guess) + ' for A\'s exit.');
      }
      if (id === 'hint') {
        if (s.hints < helps && s.hints < nb) {
          s.hints += 1;
          s.hintAt = s.t;
          c.hint();
          const a = pos[s.hints] - plan.gap;
          c.status('After band ' + s.hints + ', A is at ' + signed(a) + ' and B is at ' + signed(-a) + '.');
        } else c.status('No more bands can be shown at this difficulty; the visible paths stay on the chart.');
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = driftGeometry(c.w, c.h, nb);
      const band = Math.floor((geo.bottom - y * c.h) / geo.band);
      if (x * c.w >= geo.left && x * c.w <= geo.left + geo.span && band >= 0 && band < nb) {
        const box = { x: geo.left, y: geo.bottom - (band + 1) * geo.band, w: geo.span, h: geo.band };
        mark(band + 1, c, within(x * c.w, y * c.h, box));
        c.set('cross', band + 1);
        c.status('Band ' + (band + 1) + ' pushes A ' + signed(plan.bands[band]) + ' columns and B the opposite way; marked as the first crossing.');
      } else c.status('Tap a numbered wind band to mark the first crossing.');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (s.doneAt >= 0) {
        // The solved sky shows the rest of both journeys, up a stair from the part already shown.
        const own = roll(riteOf(c), 0x4a, 0);
        s.flight = s.flightFrom + (nb - s.flightFrom) * own.stair(came(s, s.doneAt, 2.2, c.reduced));
      }
      if (settled(s, c)) return;
      draw(c);
    },
    end(c) {
      // The climb sets out from as far as the journeys show now, a hint's step under way included.
      s.flightFrom = reachOf(s, riteOf(c), nb, c.reduced);
      s.doneAt = s.t;
      s.flight = c.reduced ? nb : s.flightFrom;
      c.status('A first reaches or passes B after band ' + first + ' and leaves at ' + signed(exit) + '. Tap a band or change either answer to keep exploring.');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the four puzzles this card is, and its plan, dealt once from the env's seeded stream and
// kept with that env. Every pass over one card -- the still picture, the spark and the piece it
// opens as -- asks here, so they are all the same card; dealing again on another pass would re-roll
// the whole puzzle (issue #92).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    if (env.chance(0.22)) got = { order: false, plan: mirrorPlan(env) };
    else {
      const order = env.chance(0.55);
      const plan = order ? orderPlan(env) : driftPlan(env);
      got = { order, plan: !order && env.chance(0.5) ? witnessPlan(env, plan) : plan };
    }
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'star-lantern',
  needsSky: true,
  // The card is a still picture, whichever puzzle it deals: its lanterns hang and its sparks stand
  // until a visitor moves something, and on a card nobody can, so it has no animate and the feed
  // never repaints it.
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.plan.kind === 'mirror') mirrorPreview(g, w, h, env, d.plan);
    else if (d.plan.kind === 'witness') witnessPreview(g, w, h, env, d.plan);
    else if (d.order) orderPreview(g, w, h, env, d.plan);
    else driftPreview(g, w, h, env, d.plan);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const { order, plan } = deal(env);
    if (plan.kind === 'mirror') return {
      title: mirrorTitle(plan),
      quote: 'A follows the wind; B mirrors it',
      mono: plan.bands.map((wind, i) => 'band ' + (i + 1) + ': ' + signed(wind)).join(' / '),
      text: 'Follow both lanterns. Find their first crossing and the column where A leaves the top.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => mirrorPreview(g, w, h, cardEnv, plan),
      of: plan
    };
    if (plan.kind === 'witness') {
      return {
        title: witnessTitle(plan),
        text: 'Two lanterns remember what the wind forgot. Recover two missing pushes from their starting heights and arrival columns.',
        mono: witnessClues(plan),
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => witnessPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (order) {
      return {
        title: orderTitle(plan),
        quote: clueText(plan.clues[0]),
        text: (plan.clues.length === 1 ? 'That is the one clue.' : capital(WORDS[plan.clues.length - 1]) + ' more clues wait under the sky.')
          + ' Find the one order the ' + WORDS[plan.n] + ' lanterns rise in.',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => orderPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    return {
      title: driftTitle(plan),
      mono: plan.bands.map((d, i) => 'band ' + (i + 1) + ': ' + (d === 0 ? 'still' : signed(d))).join('\n'),
      text: 'One lantern, lit and let go as an offering to ' + WORDS[plan.bands.length] + ' bands of wind. Say where it leaves the top, and which band pushes it hardest.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => driftPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const mirror = carriedMirror(env);
    if (mirror) return mirrorPiece(env, mirror);
    const witness = carriedWitness(env);
    if (witness) return witnessPiece(env, witness);
    const order = carriedOrder(env);
    if (order) return orderPiece(env, order);
    const drift = carriedDrift(env);
    if (drift) return driftPiece(env, drift);
    const d = deal(env);
    if (d.plan.kind === 'mirror') return mirrorPiece(env, d.plan);
    if (d.plan.kind === 'witness') return witnessPiece(env, d.plan);
    return d.order ? orderPiece(env, d.plan) : driftPiece(env, d.plan);
  }
};
