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
                         right, and no more; comparing the heights, as many times as the difficulty
                         allows, walks the similar triangles one step further each time.
     match the shadows   Four or six cutouts on the bench and as many shadows on the screen, each
                         scaled by a stated factor and leaned sideways by the lamp, numbered in a
                         shuffled order. A cast of six stands in two rows; the brief describes
                         every shadow's outline in words as well as the picture showing it. Say
                         which cutout made which shadow. A tap on a shadow inspects it: its outline,
                         its factor and its lean, in words. A wrong check says how many are matched;
                         a hint, at a price, names one.

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

// Each cutout's outline in words, in the order of CUTOUTS: what the brief says of every shadow on
// the screen, so the match can be made from the words as well as from the picture.
const OUTLINES = [
  'two teeth on the right of a long stem',
  'a wide skirt with a small clapper underneath',
  'a beak to the right and a tail to the left',
  'a peaked roof with a right-hand chimney',
  'two ears and a raised tail on the right',
  'a left handle and a right spout',
  'one sail to the right of a mast above a hull',
  'two tiers of branches above a trunk',
  'five pointed tips',
  'a crescent'
];

// A turned-over cast uses only outlines whose left and right can be distinguished.
const ASYMMETRIC = [0, 2, 3, 4, 5, 6];

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
   js/stage.js, "The rite"): one clean edge -- a slice at an angle or a curve round a corner, the
   piece's signature -- and the few treads every change climbs, always forward. Nothing in the
   theatre moves along a formula, and nothing moves without a reason:

     at rest         the house is waiting, so nothing in it moves: the lamp burns at one size and
                     the shadows on the screen hold their lean. A frame with nothing new in it is
                     not drawn at all (settled, below).
     a lamp struck   -- on a card that moves, the one movement it has -- catches from the flame
                     the still card shows to the one it burns with, in rite.ease's landing treads,
                     and burns at that size from then on (caught, below).
     a thing said    -- a distance read, a guess written, a name under a shadow -- is cut on at its
                     moment (rite.flicker) in place of what stood there, never blinking out between.
     a line moved    -- the height the wall would show from a wrong lamp -- travels to its new
                     place in rite.ease's landing treads, the first the longest, never a glide.
     a thing shown   -- the shadow the visitor predicts, the band a wrong lamp would add, the frame
                     round a hinted shadow or a shadow being inspected, the chip behind a matched
                     name, the wall and the screen lit over a solved night -- is cut in behind the
                     piece's edge as its stair climbs (rite.paint, one path; a frame through one
                     clip), never a fade and never cells, and rests as two shades of its colour
                     split by that edge through its middle. A new prediction is cut in over the
                     last by the same edge, so the wall gives one up as it takes the other, and a
                     newly inspected shadow's frame takes the screen as the last one's gives it up.
     a thing done    -- the prediction and the wrong lamp's marks, once the lamp is lit for good --
                     is cut away behind the same edge on a roll of its own, one way: drawn through
                     the part of its box the edge has not reached yet, until there is none.

   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion, and for whatever stood there from the start (since < 0). Each shadow, name or frame
   steps on a roll of its own, rolled again each time it moves (roll, below), so no two step
   together and no move steps like the one before it. */

// The rite of a piece handed none (no env builder does this; a guard): every change already made,
// and a surface cut by a plain upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, flicker: () => 1, treads: 1, kind: 'slice', angle: 90,
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w * Math.min(1, k), h);
  },
  paint(g, x, y, w, h, k, style) {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w * Math.min(1, k), h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two moves of
// one thing step alike while the same seed still plays the same piece, every roll keeping the
// piece's edge. Kept with the rite it was rolled from, so a frame reuses a roll rather than making
// it afresh thirty times a second.
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

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The longest any change in the theatre takes to come the whole of its way, in seconds.
const LONGEST = 2.2;

function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1);
}

// Whether a frame has nothing to draw: the canvas holds a picture drawn at this size, and that
// picture was drawn once the latest change (made at `last`) had come the whole of its way -- at
// once for a visitor who asked for less motion, and for a house with no change made yet (last <
// 0). The house at rest stands still, so drawing it again would spend a frame on nothing a
// visitor could see; a new size (the stage clears the canvas to resize it) or a new change draws
// again. It is when the picture was drawn that is read, not the clock alone: the stage asks for
// no frames while the scene is out of sight, so a change made then, or one the scroll cut off
// half way, is still owed its finished picture, and the first frame back draws it.
function settled(s, c, last, reduced) {
  if (s.drawn !== sizeOf(c)) return false;
  return s.drawnAt >= (reduced || last < 0 ? last : last + LONGEST + 0.05);
}

// One frame: drawn unless it is settled, and answering whether anything is still on its way once
// it has been -- false when the house is at rest, which tells the stage to ask for no frame until
// a knob, a tap, a check, a new size or the scene coming back into view. The piece's clock is its
// own, advanced by the frames it is given and standing still while none come, so a change made
// after a rest is timed from where the clock stood and plays its whole way.
function step(s, c, last, draw) {
  if (!settled(s, c, last, !!c.reduced)) draw(c);
  return !settled(s, c, last, !!c.reduced);
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes, and at rest it is two shades of one colour split by that
// edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A surface standing `k` of the way there, in `fill`: the part of the box the piece's edge has
// passed, and two shades once it is all there. `shape`, if given, adds a path inside the box (a
// frame, say) that the surface is clipped to, filled even-odd.
function standing(g, own, x, y, bw, bh, k, fill, shape) {
  if (k <= 0) return;
  g.fillStyle = fill;
  if (shape) {
    g.save();
    g.beginPath();
    shape(g);
    g.clip('evenodd');
  }
  cover(g, own, x, y, bw, bh, k);
  if (shape) g.restore();
}

// A surface arriving, `p` of the way through its time, on the roll handed in: cut in behind the
// piece's edge as the roll's stair climbs, and two shades at rest. Gives back how far it has come.
function surface(g, own, x, y, bw, bh, p, fill, shape) {
  const k = own.stair(p);
  standing(g, own, x, y, bw, bh, k, fill, shape);
  return k;
}

// One drawing giving way to another behind the piece's edge, `k` of the way: `after` (if there is
// one) drawn whole through the part of the box the edge has passed, `before` (if there is one)
// through the rest. With no `after` it is a leaving: `before` cut away by the edge, one way. One
// edge between them and one clip each, never cells.
function wipe(g, own, x, y, w, h, k, before, after) {
  if (k < 1 && before) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    if (k > 0) own.region(g, x, y, w, h, k);
    g.clip('evenodd');
    before();
    g.restore();
  }
  if (k <= 0 || !after) return;
  if (k >= 1) {
    after();
    return;
  }
  g.save();
  g.beginPath();
  own.region(g, x, y, w, h, k);
  g.clip();
  after();
  g.restore();
}

// The lamp lit for good over a solved night: light comes over the whole house behind the piece's
// edge from the moment of the solve, and rests in two shades.
function daybreak(g, rite, c, w, h, p) {
  surface(g, rite, 0, 0, w, h, p, c.alpha(c.colors.accent2, 0.08));
}

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

// The lamp: its glow and its flame. It burns at one size, as a lamp lit on purpose does.
function lampDot(g, c, x, y, r) {
  const reach = r * 4;
  const glow = g.createRadialGradient(x, y, 0, x, y, reach);
  glow.addColorStop(0, c.alpha(c.colors.accent2, 0.6));
  glow.addColorStop(1, c.alpha(c.colors.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  g.fillStyle = c.colors.accent2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// The flame's radius in a house whose shorter side is m: the size it is struck at, and as much
// again as it has caught (`lit`, 0 just struck to 1 burning). Every piece, every card that does
// not move and every card for a visitor who asked for less motion shows it burning; only a card
// playing its one movement shows it short of that (caught, below).
function flame(m, struck, lit) {
  return struck + Math.max(3.2, m * 0.008) * Math.max(0, Math.min(1, lit));
}

/* A card that moves (js/feed.js) is the lamp being lit: its still picture is the flame just struck,
   and from its first frame on screen the flame catches -- in the landing treads of a roll of its
   own, the first the longest, each after it shorter -- until it burns at the size the piece opens
   on, and holds. That is the whole of the card's motion: nothing else on it moves, and once the
   flame burns the card says so and the loop lets it go. */
const CATCH = 2; // seconds the flame takes to catch, and so how long a card moves

// How far a card's flame has caught t seconds into its motion: 0 to 1, in the roll's landing
// treads. The clock is read a quarter of the way ahead, so the hold before the landing's first
// tread is spent before the card is seen: the flame takes on the first moving frame, and burns
// whole well before the run is over.
function caught(rite, t) {
  if (!(t > 0)) return 0;
  return roll(rite, 0x1a5, 0).ease(Math.min(1, 0.25 + t / CATCH));
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

// The lamp's state as a scene opens: nothing tried, nothing guessed, nothing revealed, and every
// change timed against the piece's clock from here on (-1 is "there from the start"). `was` is
// what stood before the latest change -- the guess the drawing said, the prediction on the wall --
// shown until the new one is cut on in its place, and the counts roll each move afresh.
function lampState() {
  return {
    tried: null, triedFrom: null, triedAt: -1, tries: 0, reveal: false, revealAt: -1,
    guess: null, guessWas: null, guessAt: -1, guesses: 0,
    change: null, changeWas: null, changeAt: -1, changes: 0, lit: 1, t: 0, drawn: null, drawnAt: -1
  };
}

// The guess the drawing says d is: the new one once its moment has come, the one before it until
// then, so a guess is cut over to the next and never blinks out between them.
function saidGuess(s, rite, reduced) {
  if (s.guessAt < 0) return s.guess;
  return roll(rite, 0x9e5, s.guesses).flicker(came(s, s.guessAt, 0.9, reduced)) ? s.guess : s.guessWas;
}

// How far the latest prediction on the wall has been cut in, 0 to 1.
function changeCut(s, rite, reduced) {
  return roll(rite, 0x6b2, s.changes).stair(came(s, s.changeAt, 1.3, reduced));
}

// The side view: floor, wall, the cutout standing on the floor, the shadow on the wall to scale,
// the lamp off to the left behind a break in the floor (its distance is the question).
function sideView(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const m = Math.min(w, h);
  const H = shadowHeight(p, p.d);
  const floor = h * 0.8;
  const wallX = w * 0.86;
  const lampX = w * 0.1 + (v.turn - 0.5) * w * 0.04;
  const revealP = s.reveal ? came(s, s.revealAt, 2, reduced) : 0;
  house(g, w, h, c, v, lampX, floor);
  // Scale: the taller of the shadow and the wider of the gap decide the span in pixels.
  const unit = Math.min((floor - h * 0.14) / H, (w * 0.46) / p.a) * Math.min(1, v.scale);
  const cutX = wallX - p.a * unit;
  const fs = Math.max(9, Math.min(15, m * 0.03));
  // The wall, and the shadow on it.
  g.fillStyle = c.mix(col.bg2, col.accent2, 0.55);
  g.fillRect(wallX, h * 0.06, w - wallX, floor - h * 0.06);
  // The lamp lit for good: the wall brightens behind the piece's edge from the moment of the solve.
  if (s.reveal) surface(g, roll(rite, 0x4a11, 0), wallX, h * 0.06, w - wallX, floor - h * 0.06, revealP, c.alpha(col.accent2, 0.17));
  g.fillStyle = c.alpha(col.bg, 0.92);
  g.fillRect(wallX, floor - H * unit, w - wallX, H * unit);
  // The visitor's prediction on the wall: grows, and a ghost of more shadow stands above the real
  // one; shrinks, and the wall is laid back over its top; the same, and a band holds the top edge
  // where it is -- each resting in two shades. It is cut in behind the piece's edge across the
  // reach either side of the shadow's top from the moment of the choice, and a new choice is cut
  // in over the one before by the same edge, which takes the old away as it brings the new. Once
  // the lamp is lit for good the prediction has had its answer, and is cut away behind an edge of
  // its own.
  if (s.change !== null) {
    const top = floor - H * unit;
    const reach = Math.min(Math.max(6, H * unit * 0.16), top - h * 0.06);
    const band = (choice) => () => {
      if (choice === 'grows') {
        g.fillStyle = c.alpha(col.bg, 0.33);
        cover(g, rite, wallX, top - reach, w - wallX, reach, 1);
      } else if (choice === 'shrinks') {
        g.fillStyle = c.alpha(c.mix(col.bg2, col.accent2, 0.55), 0.55);
        cover(g, rite, wallX, top, w - wallX, reach, 1);
      } else {
        g.fillStyle = c.alpha(col.accent2, 0.37);
        cover(g, rite, wallX, top - 2, w - wallX, 4, 1);
      }
    };
    const half = Math.max(reach, 2);
    const k = changeCut(s, rite, reduced);
    const standing = () => wipe(g, roll(rite, 0x6b2, s.changes), wallX, top - half, w - wallX, half * 2, k,
      s.changeWas === null ? null : band(s.changeWas), band(s.change));
    const away = roll(rite, 0x6b3, 0);
    const gone = s.reveal ? away.stair(revealP) : 0;
    if (gone > 0) wipe(g, away, wallX, top - half, w - wallX, half * 2, gone, standing, null);
    else standing();
  }
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
  lampDot(g, c, lampX, floor - 3, flame(m, Math.max(3, m * 0.012), s.lit));
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
  // What the drawing says of d: the answer is cut on at its moment once it is read, over a line
  // of the lamp's light cut in under it; before that, the visitor's guess as a question of its
  // own, each new guess cut over the last at its moment, and a question mark until there is one.
  const answered = s.reveal && rite.flicker(revealP);
  const guessed = answered ? null : saidGuess(s, rite, reduced);
  if (s.reveal) surface(g, roll(rite, 0x2f8, 0), lampX, floor + h * 0.06 - 2, cutX - lampX, 4, revealP, c.alpha(col.accent2, 0.55));
  const said = answered ? spans(p.d) : guessed !== null ? spans(Math.max(1, Math.round(guessed))) + '?' : '?';
  text(g, 'd = ' + said, (lampX + cutX) / 2, floor + h * 0.06 + fs, fs, answered ? col.accent2 : col.accent, 'center', 700);
  text(g, 'the wall', wallX + (w - wallX) / 2, h * 0.1, fs * 0.9, c.alpha(col.bg, 0.8), 'center', 600);
  if (s.tried != null) {
    // What the wall would show with the lamp where the visitor put it: a band, in two shades,
    // from the real shadow's top to the one it would throw, with a line along its top. The first
    // time, band and line are cut in together behind the piece's edge; after that, the line
    // travels from where the last try left it in the landing treads of a roll of its own, the
    // band with it. Once the lamp is lit for good they have had their answer, and are cut away
    // behind an edge of their own.
    const own = roll(rite, 0x7d3, s.tries);
    const pt = came(s, s.triedAt, 1.1, reduced);
    const first = s.triedFrom == null;
    const would = Math.min(shadowHeight(p, s.tried), 30);
    const from = first ? would : Math.min(s.triedFrom, 30);
    const at = from + (would - from) * own.ease(pt);
    // A lamp put close throws a shadow taller than the wall: the line stays on the wall.
    const onWall = (n) => Math.max(h * 0.06, Math.min(floor, floor - n * unit));
    const real = floor - H * unit;
    const top = onWall(at);
    const lo = Math.max(h * 0.06, Math.min(top, real));
    const hi = Math.max(top, real);
    const marks = () => {
      if (hi - lo > 1) {
        g.fillStyle = c.alpha(col.accent, 0.17);
        cover(g, rite, wallX, lo, w - wallX, hi - lo, 1);
      }
      g.strokeStyle = c.alpha(col.accent, 0.9);
      g.lineWidth = 1.5;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(wallX, top);
      g.lineTo(w, top);
      g.stroke();
      g.setLineDash([]);
    };
    // The box the edges cross: the wall over everything this try's marks stand on as the line
    // travels, from where it starts to where it stops and down to the real shadow's top, with
    // room for the line.
    const by = Math.min(onWall(from), onWall(would), real) - 3;
    const bh = Math.max(onWall(from), onWall(would), real) + 3 - by;
    const standing = first ? () => wipe(g, own, wallX, by, w - wallX, bh, own.stair(pt), null, marks) : marks;
    const away = roll(rite, 0x7d4, 0);
    const gone = s.reveal ? away.stair(revealP) : 0;
    if (gone > 0) wipe(g, away, wallX, by, w - wallX, bh, gone, standing, null);
    else standing();
  }
  if (s.reveal) daybreak(g, rite, c, w, h, revealP);
}

// The lamp as a card shows it, its flame `lit` of the way caught (burning, unless a card in motion
// says otherwise).
function lampPreview(g, w, h, env, p, lit = 1) {
  const s = lampState();
  s.lit = lit;
  sideView(g, w, h, env, p, s, env.variant);
}

function lampPiece(env, p) {
  // The distance is a length in spans off the drawing, so it is a measured answer: the difficulty
  // says how many spans out it may be and still light the lamp.
  const settings = asked(env);
  const margin = settings.margin;
  const H = shadowHeight(p, p.d);
  let helped = 0;
  const hints = [
    'The shadow is ' + (H - p.h) + ' spans taller than the cutout. That extra height comes from the gap to the wall.',
    'The two triangles match: extra shadow height times lamp distance equals cutout height times gap to the wall.',
    'Here, ' + (H - p.h) + ' times lamp distance equals ' + (p.h * p.a) + '.',
    'Divide ' + (p.h * p.a) + ' by ' + (H - p.h) + ' to find the distance behind the cutout.',
    'Check your distance by seeing whether it makes a shadow ' + H + ' spans tall.'
  ];
  const move = MOVES[p.move];
  const s = lampState();
  const draw = (c) => {
    sideView(c.g, c.w, c.h, c, p, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnAt = s.t;
  };
  const tenth = (n) => String(Math.round(n * 10) / 10);
  return {
    title: lampTitle(p),
    brief: 'One lamp, lit on purpose. Seen from the side: a paper cutout ' + spans(p.h) + ' tall stands ' + spans(p.a) + ' from the wall, and a lamp on the floor somewhere behind it throws its shadow onto the wall, ' + spans(H) + ' tall. Light runs straight, so the shadow stands to the cutout as the lamp\'s distance from the wall stands to its distance from the cutout.',
    goal: 'Say how far behind the cutout the lamp stands, and what the shadow does when ' + move.text + '.',
    aspect: '16 / 10',
    checkLabel: 'light the lamp',
    steps: [
      { id: 'distance', ask: 'the lamp\'s distance behind the cutout', kind: 'number', min: 1, max: 20, step: 1, value: 1, unit: 'spans' },
      { id: 'change', ask: 'the shadow, when ' + move.text, kind: 'choice', options: CHANGES },
      { id: 'hint', ask: 'help with the measurements', kind: 'press', count: 1, label: 'compare the heights', optional: true }
    ],
    solution: { distance: p.d, change: move.answer },
    check(c) {
      const d = Number(c.value('distance'));
      const distanceRight = Math.abs(d - p.d) <= margin;
      const changeRight = c.value('change') === move.answer;
      if (distanceRight && changeRight) return { solved: true, say: 'the lamp is ' + spans(p.d) + ' behind the cutout, and the shadow ' + move.answer };
      const parts = [];
      if (!distanceRight) {
        const tried = Number.isFinite(d) && d >= 1 ? d : null;
        if (tried !== s.tried) {
          // The line the wall would show moves on from where it stands now.
          const pt = came(s, s.triedAt, 1.1, !!c.reduced);
          const stood = s.tried == null ? null : shadowHeight(p, s.tried);
          const from = s.triedFrom == null || stood == null ? stood : s.triedFrom + (stood - s.triedFrom) * roll(riteOf(c), 0x7d3, s.tries).ease(pt);
          s.triedFrom = from;
          s.tried = tried;
          s.triedAt = s.t;
          s.tries += 1;
        }
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
        const guess = Number.isFinite(d) && d >= 1 ? d : null;
        if (guess !== s.guess) {
          // The new guess is cut over whatever the drawing says now.
          s.guessWas = saidGuess(s, riteOf(c), !!c.reduced);
          s.guess = guess;
          s.guessAt = s.t;
          s.guesses += 1;
        }
      }
      if (id === 'change') {
        const o = CHANGES.find((x) => x.value === value);
        if (o) {
          c.status('when ' + move.text + ', ' + o.label + ', you say');
          if (s.change !== o.value) {
            // The new prediction is cut in in place of whichever the wall shows now.
            s.changeWas = changeCut(s, riteOf(c), !!c.reduced) > 0 ? s.change : s.changeWas;
            s.change = o.value;
            s.changeAt = s.t;
            s.changes += 1;
          }
        }
      }
      if (id === 'hint') {
        if (helped < settings.helps) {
          c.status(hints[helped]);
          helped += 1;
          c.hint();
        } else c.status('No comparisons left at this difficulty; use the heights and the gap on the drawing.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      return step(s, c, Math.max(s.triedAt, s.revealAt, s.guessAt, s.changeAt), draw);
    },
    end(c) {
      s.reveal = true;
      s.revealAt = s.t;
      c.status('d = ' + spans(p.d) + ': ' + p.h + ' spans times ' + (p.d + p.a) + ' over ' + p.d + ' is ' + H + '. the lamp stays lit');
      draw(c);
    }
  };
}

/* ---- match the shadows ---------------------------------------------------------------------- */

function matchPlan(env) {
  const count = env.chance(0.5) ? 6 : 4;
  const turned = env.chance(0.5);
  const items = some(env, turned ? ASYMMETRIC : CUTOUTS.map((cut, i) => i), count);
  const shadows = shuffled(env, items.map((cut, i) => i)).map((cut) => ({
    cut,
    f: env.pick([15, 20, 25]),
    k: (env.chance(0.5) ? 1 : -1) * env.int(35, 70)
  }));
  const order = shadows.map((sh) => sh.cut);
  let start = shuffled(env, order);
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, order);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  const plan = { kind: 'match', items, shadows, start };
  if (turned) plan.flips = some(env, order.map((cut, i) => i), env.int(1, count - 1)).sort((a, b) => a - b);
  return plan;
}

function carriedMatch(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'match') return null;
  if (!Array.isArray(p.items) || ![4, 6].includes(p.items.length)) return null;
  const count = p.items.length;
  if (!p.items.every((i) => Number.isInteger(i) && i >= 0 && i < CUTOUTS.length) || new Set(p.items).size !== count) return null;
  if (!Array.isArray(p.shadows) || p.shadows.length !== count) return null;
  const okShadow = (sh) => sh && typeof sh === 'object' && Number.isInteger(sh.cut) && sh.cut >= 0 && sh.cut < count
    && [15, 20, 25].includes(sh.f) && Number.isInteger(sh.k) && Math.abs(sh.k) >= 35 && Math.abs(sh.k) <= 70;
  if (!p.shadows.every(okShadow) || new Set(p.shadows.map((sh) => sh.cut)).size !== count) return null;
  const shadows = p.shadows.map((sh) => ({ cut: sh.cut, f: sh.f, k: sh.k }));
  const order = shadows.map((sh) => sh.cut);
  if (!Array.isArray(p.start) || p.start.length !== count || !p.start.every((v) => Number.isInteger(v) && v >= 0 && v < count) || new Set(p.start).size !== count) return null;
  if (p.start.every((v, i) => v === order[i])) return null;
  if (p.flips !== undefined && (!Array.isArray(p.flips) || !p.flips.length || p.flips.length >= count
    || new Set(p.flips).size !== p.flips.length
    || !p.flips.every((n) => Number.isInteger(n) && n >= 0 && n < count && ASYMMETRIC.includes(p.items[shadows[n].cut])))) return null;
  return { kind: 'match', items: p.items.slice(), shadows, start: p.start.slice(),
    ...(p.flips ? { flips: p.flips.slice() } : {}) };
}

function matchTitle(p) {
  return (p.flips ? 'the turned cast: ' : 'match the shadows: ') + p.items.map((i) => CUTOUTS[i].name).join(', ');
}

function shadowOutline(p, n) {
  const outline = OUTLINES[p.items[p.shadows[n].cut]];
  return p.flips && p.flips.includes(n)
    ? outline.replace(/\b(left|right)\b/g, (side) => side === 'left' ? 'right' : 'left') : outline;
}

// The bench's state as a scene opens: the visitor's matching (none on a card), nothing hinted,
// nothing revealed, and every change timed against the piece's clock from here on (-1 is "there
// from the start"). `from` is the name each shadow showed before its latest change, and the
// counts roll each move afresh. `leaving` holds the inspection frames being given up, each as the
// screen showed it when it was handed over (handOver, below).
function matchState(order) {
  // Sized to the cast; a card has no matching to time, and is given room for the largest.
  const each = (v) => new Array(order ? order.length : 6).fill(v);
  return {
    order: order ? order.slice() : null, from: order ? order.slice() : null, movedAt: each(-1),
    reversed: [],
    moves: each(0), hinted: [], hintAt: each(-1), inspected: null, leaving: [], inspectAt: -1, inspects: 0,
    reveal: false, revealAt: -1, lit: 1, t: 0, drawn: null, drawnAt: -1
  };
}

// How far the frame of the shadow being inspected has been cut in, 0 to 1.
function inspection(s, rite, reduced) {
  return s.inspected === null ? 0 : roll(rite, 0x1e5, s.inspects).stair(came(s, s.inspectAt, 1.1, reduced));
}

// A new inspection hands the screen's frames over from where they stand. The frame being cut in
// is given up at the coverage it has reached (none, while its stair still holds: nothing of it was
// seen, so nothing of it is kept), and every frame already being given up keeps the part the last
// roll had not yet cut away. The new roll's edge then cuts each away from there, one way: a frame
// never grows back as it goes, nor vanishes at the tap. A frame `from` of the way in and `cut` of the
// way away shows the part of its box between the two. The parts kept never overlap -- a frame
// handed over is cut away up to where the frame after it had come -- so a shadow tapped again
// while its last frame leaves is filled by the new frame as the old one goes, and is never two
// frames thick.
function handOver(s, rite, reduced) {
  const k = inspection(s, rite, reduced);
  s.leaving = s.leaving.map((e) => ({ n: e.n, from: e.from, cut: Math.max(e.cut, k) })).filter((e) => e.cut < e.from);
  if (k > 0) s.leaving.push({ n: s.inspected, from: k, cut: 0 });
}

// The cutout whose name stands under shadow n: the new one once its moment has come, the one before
// it until then, so a name is cut over to the next and never blinks out between them.
function nameUnder(s, rite, n, reduced) {
  return roll(rite, 0x5ad + n, s.moves[n]).flicker(came(s, s.movedAt[n], 0.9, reduced)) ? s.order[n] : s.from[n];
}

// The bench of cutouts along the top, in one row or two, and the screen with their shadows along
// the bottom, in as many rows.
function bench(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const m = Math.min(w, h);
  const lampX = w * (0.1 + v.turn * 0.1);
  const revealP = s.reveal ? came(s, s.revealAt, 2.2, reduced) : 0;
  house(g, w, h, c, v, lampX, h * 0.12);
  lampDot(g, c, lampX, h * 0.12, flame(m, Math.max(3, m * 0.013), s.lit));
  const fs = Math.max(9, Math.min(14, m * 0.03));
  // Four cutouts stand in one row of four; six in two rows of three, the screen below them divided
  // the same way, so each shadow sits in the slot of the screen under the slot of the bench.
  const columns = p.items.length > 4 ? 3 : 4;
  const rows = Math.ceil(p.items.length / columns);
  const slot = w / columns; // each cutout's and each shadow's share of a row's width
  const benchY = h * (rows === 2 ? 0.26 : 0.32);
  const size = Math.min(slot * 0.62, h * (rows === 2 ? 0.13 : 0.24)) * Math.min(1, v.scale);
  // The bench: a shelf for each row, and the cutouts standing on them.
  g.fillStyle = c.mix(col.bg, col.bg2, 0.7);
  for (let row = 0; row < rows; row++) g.fillRect(0, benchY + row * h * 0.17, w, h * 0.012);
  p.items.forEach((cut, i) => {
    const x = (i % columns + 0.5) * slot;
    const y = benchY + Math.floor(i / columns) * h * 0.17;
    polygon(g, CUTOUTS[cut].points, (q) => ({ x: x + q[0] * size, y: y - (0.5 - q[1]) * size }));
    g.fillStyle = c.mix(col.bg, col.accent, 0.5);
    g.fill();
    g.strokeStyle = c.alpha(col.accent2, 0.75);
    g.lineWidth = 1;
    g.stroke();
    text(g, 'the ' + CUTOUTS[cut].name, x, y + h * 0.012 + fs, fs, col.fg, 'center', 600);
  });
  // The screen: lit paper, with the shadows numbered across each row. Every shadow has its cutout:
  // the screen brightens behind the piece's edge from the moment of the solve.
  const screenY = h * (rows === 2 ? 0.51 : 0.44);
  const screenH = h * (rows === 2 ? 0.42 : 0.5);
  g.fillStyle = c.mix(col.bg2, col.accent2, 0.6);
  g.fillRect(w * 0.02, screenY, w * 0.96, screenH);
  if (s.reveal) surface(g, roll(rite, 0x4a11, 0), w * 0.02, screenY, w * 0.96, screenH, revealP, c.alpha(col.accent2, 0.15));
  g.strokeStyle = c.alpha(col.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(w * 0.02, screenY, w * 0.96, screenH);
  p.shadows.forEach((sh, n) => {
    const column = n % columns;
    const rowH = screenH / rows;
    const rowY = screenY + Math.floor(n / columns) * rowH;
    const f = sh.f / 10;
    // The shadow leans by the lamp, and holds its lean: a lamp lit on purpose does not flicker.
    const k = sh.k / 100;
    const base = Math.min(slot * 0.22, rowH * 0.2) * Math.min(1, v.scale);
    // A point's x is pushed sideways by how high it stands.
    const facing = p.flips && p.flips.includes(n) ? -1 : 1;
    const map = (q) => ({ x: facing * q[0] * f * base + (0.5 - q[1]) * k * f * base, y: -(0.5 - q[1]) * f * base });
    const pts = CUTOUTS[p.items[sh.cut]].points.map(map);
    const minX = Math.min(...pts.map((q) => q.x));
    const maxX = Math.max(...pts.map((q) => q.x));
    const minY = Math.min(...pts.map((q) => q.y));
    const maxY = Math.max(...pts.map((q) => q.y));
    const cx = (column + 0.5) * slot - (minX + maxX) / 2;
    const cy = rowY + rowH * 0.45 - (minY + maxY) / 2;
    polygon(g, CUTOUTS[p.items[sh.cut]].points, (q) => {
      const r = map(q);
      return { x: cx + r.x, y: cy + r.y };
    });
    g.fillStyle = c.alpha(col.bg, 0.9);
    g.fill();
    text(g, String(n + 1), (column + 0.5) * slot, rowY + fs * 1.1, fs * 1.1, col.bg, 'center', 700);
    text(g, 'x ' + (f % 1 ? f.toFixed(1) : f) + (s.reversed.includes(n) ? '; reversed?' : ''), (column + 0.5) * slot, rowY + rowH - fs * 2.1, fs * 0.9, col.bg, 'center', 600);
    // The shadow being inspected: a thin frame round it, inside its slot, cut in behind the
    // piece's edge on the roll of this inspection through one clip (the frame's outline less its
    // inside), and resting in two shades. The frames handed over before it (handOver, above) are
    // cut away behind the same edge on the same roll, one way, each from what the screen showed
    // of it, so the screen takes one frame as it gives up the others and never holds two at rest.
    const going = s.leaving.filter((e) => e.n === n);
    if (s.inspected === n || going.length) {
      const own = roll(rite, 0x1e5, s.inspects);
      const ip = inspection(s, rite, reduced);
      const x0 = (column + 0.08) * slot - 1;
      const y0 = rowY + 1;
      const bw = slot * 0.84 + 2;
      const bh = rowH - 2;
      const fill = c.alpha(col.accent, 0.7);
      const ring = (q) => {
        q.rect(x0, y0, bw, bh);
        q.rect(x0 + 2, y0 + 2, bw - 4, bh - 4);
      };
      if (s.inspected === n) standing(g, own, x0, y0, bw, bh, ip, fill, ring);
      going.forEach((e) => {
        const away = Math.max(e.cut, ip);
        if (away < e.from) wipe(g, own, x0, y0, bw, bh, away, () => standing(g, own, x0, y0, bw, bh, e.from, fill, ring), null);
      });
    }
    // The visitor's matching, written under each shadow in its slot once it has been set: a name
    // that changes is cut over to the new one at its moment, on this shadow's own roll for the
    // move; a name proved right has a chip cut in behind it by the piece's edge, and is set bold
    // from the chip's first tread.
    if (s.order) {
      const shown = CUTOUTS[p.items[nameUnder(s, rite, n, reduced)]].name;
      const chipOn = s.reveal && s.order[n] === sh.cut
        && surface(g, roll(rite, 0x8c1 + n, 0), (column + 0.15) * slot, rowY + rowH - fs * 1.5, slot * 0.7, fs * 1.4, revealP, c.alpha(col.accent2, 0.13)) > 0;
      text(g, shown, (column + 0.5) * slot, rowY + rowH - fs * 0.8, fs * 0.9, col.bg, 'center', chipOn ? 700 : 600);
    }
    // A shadow a hint has named: a frame round its slot of the screen, cut in behind the piece's
    // edge through one clip (the slot's outline less its inside).
    if (s.hinted.includes(n)) {
      const hp = came(s, s.hintAt[n], 1.1, reduced);
      const x0 = (column + 0.06) * slot;
      const y0 = rowY + 3;
      const bw = slot * 0.88;
      const bh = rowH - 6;
      const edge = Math.max(4, m * 0.012);
      surface(g, roll(rite, 0x3e9 + n, 0), x0, y0, bw, bh, hp, c.alpha(col.accent, 0.6), (q) => {
        q.rect(x0, y0, bw, bh);
        q.rect(x0 + edge, y0 + edge, bw - edge * 2, bh - edge * 2);
      });
    }
  });
  if (s.reveal) daybreak(g, rite, c, w, h, revealP);
}

// The bench as a card shows it, its lamp's flame `lit` of the way caught (burning, unless a card
// in motion says otherwise).
function matchPreview(g, w, h, env, p, lit = 1) {
  const s = matchState(null);
  s.lit = lit;
  bench(g, w, h, env, p, s, env.variant);
}

function matchPiece(env, p) {
  const count = p.items.length;
  const helps = asked(env).helps;
  const names = p.items.map((i) => CUTOUTS[i].name);
  const solution = p.shadows.map((sh) => sh.cut);
  const s = matchState(p.start);
  const draw = (c) => {
    bench(c.g, c.w, c.h, c, p, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnAt = s.t;
  };
  function matched() {
    let n = 0;
    for (let i = 0; i < count; i++) if (s.order[i] === solution[i]) n += 1;
    return n;
  }
  return {
    title: matchTitle(p),
    brief: 'Match each numbered shadow to a cutout on the bench. Each is enlarged by the factor underneath and leaned sideways. '
      + (p.flips ? 'Exactly ' + p.flips.length + ' cutouts were also turned over: their shadows reverse left and right. Compare teeth, tails, handles and other side features with the fronts on the bench. Mark those shadows as reversed. ' : 'Each keeps its outline. ')
      + 'Read each row left to right, then down. Shadow outlines: ' + p.shadows.map((sh, i) => (i + 1) + ': ' + shadowOutline(p, i)).join('; ') + '.',
    goal: 'Match shadows 1 to ' + count + ' to their cutouts, using each cutout once' + (p.flips ? ', and mark the ' + p.flips.length + ' reversed shadows.' : '.'),
    aspect: count === 6 ? '4 / 5' : '4 / 3',
    checkLabel: 'check the screen',
    steps: [
      { id: 'order', ask: 'the cutouts, in the order of the shadows they made', kind: 'order', items: p.items.map((cut, at) => ({ label: 'the ' + CUTOUTS[cut].name, value: at })), value: p.start.slice() },
      ...(p.flips ? [{ id: 'reversed', ask: 'mark the ' + p.flips.length + ' shadows whose cutouts were turned over', kind: 'pick', count: p.flips.length, items: p.shadows.map((sh, n) => ({ label: 'shadow ' + (n + 1), value: n })) }] : []),
      { id: 'hint', ask: 'one shadow explained', kind: 'press', count: 1, label: 'explain one', optional: true }
    ],
    solution: { order: solution, ...(p.flips ? { reversed: p.flips.slice() } : {}) },
    check(c) {
      const n = matched();
      const turned = p.flips ? s.reversed.filter((i) => p.flips.includes(i)).length : 0;
      const extra = s.reversed.length - turned;
      const solved = n === count && (!p.flips || (turned === p.flips.length && extra === 0));
      const matching = n === 0 ? 'no shadow has its cutout yet' : WORDS[n] + ' of ' + WORDS[count] + ' shadows ' + (n === 1 ? 'has' : 'have') + ' the right cutout';
      return {
        solved,
        say: solved ? 'every shadow has its cutout' + (p.flips ? ', and every turned-over cutout is accounted for' : '')
          : matching + (p.flips ? '; ' + turned + ' of ' + p.flips.length + ' reversed shadows marked, ' + extra + ' marks on unreversed shadows' : '')
      };
    },
    start(c) {
      c.status(WORDS[count] + ' cutouts and ' + WORDS[count] + ' shadows; tap a shadow to inspect its outline');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === count) {
        const order = value.map(Number);
        // Every name that changes is cut over now, from the name that stands there, on a fresh roll.
        order.forEach((at, n) => {
          if (at === s.order[n]) return;
          s.from[n] = nameUnder(s, riteOf(c), n, !!c.reduced);
          s.movedAt[n] = s.t;
          s.moves[n] += 1;
        });
        s.order = order;
        c.status('shadows 1 to ' + count + ': ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'reversed' && p.flips && Array.isArray(value)) {
        s.reversed = [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < count))];
        c.status(s.reversed.length ? 'marked as reversed: ' + s.reversed.map((n) => 'shadow ' + (n + 1)).join(', ') : 'no shadows marked as reversed');
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? solution.map((cut, i) => i).find((n) => !s.hinted.includes(n) && (s.order[n] !== solution[n]
            || (p.flips && s.reversed.includes(n) !== p.flips.includes(n)))) : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('shadow ' + (next + 1) + ' was cast by the ' + names[solution[next]]
            + (p.flips ? (p.flips.includes(next) ? ', turned over: ' : ', not turned over: ') + shadowOutline(p, next) : ''));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the theatre will explain at this difficulty; compare the outlines with your choices');
        } else {
          c.status('every mismatch has been explained; compare the hints with your choices');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const columns = count > 4 ? 3 : 4;
      const rows = Math.ceil(count / columns);
      const screenY = rows === 2 ? 0.51 : 0.44;
      const screenH = rows === 2 ? 0.42 : 0.5;
      const column = Math.floor(x * columns);
      const row = Math.floor((y - screenY) / (screenH / rows));
      const n = row * columns + column;
      if (x < 0.02 || x > 0.98 || y < screenY || y >= screenY + screenH || n < 0 || n >= count) {
        c.status('Tap one of the numbered shadows on the screen to inspect it.');
        return;
      }
      if (s.inspected !== n) {
        // The new frame is cut in in place of whatever the screen shows now.
        handOver(s, riteOf(c), !!c.reduced);
        s.inspected = n;
        s.inspectAt = s.t;
        s.inspects += 1;
      }
      const sh = p.shadows[n];
      c.status('shadow ' + (n + 1) + ': ' + shadowOutline(p, n) + '; enlarged ' + (sh.f / 10) + ' times and leaning ' + (sh.k < 0 ? 'left' : 'right'));
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      return step(s, c, Math.max(s.revealAt, s.inspectAt, ...s.movedAt, ...s.hintAt), draw);
    },
    end(c) {
      s.reveal = true;
      s.revealAt = s.t;
      c.status('shadows 1 to ' + count + ': ' + solution.map((i) => names[i]).join(', ')
        + (p.flips ? '; reversed shadows: ' + p.flips.map((n) => n + 1).join(', ') : '') + '. the lamp stays lit');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

const plans = new WeakMap();
// What each card's canvas holds, by its env: the canvas, its size and how far the flame on it had
// caught, so a frame that would draw the same picture over itself draws nothing.
const shown = new WeakMap();
function deal(env) {
  let plan = plans.get(env);
  if (!plan) {
    plan = env.chance(0.5) ? lampPlan(env) : matchPlan(env);
    plans.set(env, plan);
  }
  return plan;
}

function dealsLamp(env) {
  return deal(env).kind === 'lamp';
}

// A card's picture, its flame `lit` of the way caught, noted as what its canvas now holds.
function preview(g, w, h, env, lit) {
  const p = deal(env);
  if (p.kind === 'lamp') lampPreview(g, w, h, env, p, lit);
  else matchPreview(g, w, h, env, p, lit);
  shown.set(env, { g, w, h, lit });
}

export default {
  id: 'shadow-theatre',
  needsSky: false,
  // The still card: the flame just struck, the first picture of the card's one movement -- or,
  // for a visitor who asked for less motion, whose card never moves, the lamp burning.
  paint(g, w, h, env) {
    preview(g, w, h, env, env.reduced ? 1 : 0);
  },
  // A card in motion: the flame catching (caught), read off t, at t = 0 the picture paint left.
  // Between two treads nothing on the card has changed and its canvas already holds the picture,
  // so a frame draws only when the flame has stepped on: the same picture for the same t, and
  // nothing drawn between treads. Once the run is over the flame burns and nothing on the card
  // moves, so it says so -- drawing the burning lamp first if a scroll took the card away before
  // its last tread, so the lamp is never left half caught.
  animate(g, w, h, env, t) {
    if (env.reduced) return false;
    const over = !(t < CATCH);
    const lit = over ? 1 : caught(riteOf(env), t);
    const last = shown.get(env);
    if (!(last && last.g === g && last.w === w && last.h === h && last.lit === lit)) preview(g, w, h, env, lit);
    return !over;
  },
  spark(env) {
    const p = deal(env);
    if (dealsLamp(env)) {
      return {
        title: lampTitle(p),
        mono: 'h = ' + p.h + ' / a = ' + p.a + ' / H = ' + shadowHeight(p, p.d) + ' / d = ?',
        text: 'A cutout ' + spans(p.h) + ' tall, ' + spans(p.a) + ' from the wall, and a lamp on the floor somewhere behind it. The shadow is ' + spans(shadowHeight(p, p.d)) + ' tall. How far back is the lamp?',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => lampPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    return {
      title: matchTitle(p),
      text: p.items.length + ' cutouts, ' + p.items.length + ' shadows, each grown and leaned by the lamp. '
        + (p.flips ? p.flips.length + ' cutouts were turned over. Match the cast and find the reversed shadows.' : 'Match their outlines rather than their sizes.')
        + (p.items.length === 6 ? ' This cast fills two rows.' : ''),
      aspect: p.items.length === 6 ? '4 / 5' : '4 / 3',
      paint: (g, w, h, cardEnv) => matchPreview(g, w, h, cardEnv, p),
      of: p
    };
  },
  piece(env) {
    const lamp = carriedLamp(env);
    if (lamp) return lampPiece(env, lamp);
    const match = carriedMatch(env);
    if (match) return matchPiece(env, match);
    const p = deal(env);
    return dealsLamp(env) ? lampPiece(env, p) : matchPiece(env, p);
  }
};
