/* The orbital weaver: a midnight loom under the persona's sky, read as puzzles. A small motif is
   turned about the centre into a kaleidoscopic weave, or two screens of fine lines are laid over
   each other and show their difference as broad bands. As a card it is one of the two puzzles
   below, printed as it stands (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece
   is.

   Two puzzles, both deduction by looking:

     count the folds   A motif of three or four joined points is laid on the loom and turned about
                       the centre some number of times -- the folds -- and on some looms every copy
                       is laid down with its mirror image too, so the weave shows both hands. The
                       motif as laid once stands in the corner. Count the folds and say whether the
                       weave is mirrored. A wrong check says which of the two is off.
     the moiré         A screen of thin upright lines, its count written on it, and a second screen
                       with a hidden count laid over it; the overlap is drawn honestly, line by
                       line, and shows as many broad bands as the two counts differ by. Say the
                       second count and whether it is more or fewer. A wrong check says which of
                       the two is off.

   The sky colours the loom -- the stars are drawn behind it -- but never decides a puzzle: the
   plan is made from the seed, serialised whole on the card's `of`, and piece(env) opens on that
   rather than rolling another, whatever the sky is by then. One star or a hundred, the weave is
   the same weave. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const MIN_FOLDS = 3;
const MAX_FOLDS = 12;

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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): one clean edge -- a slice at an angle, or a curve round a point of the
   box (a corner or the middle of a side), the piece's signature -- and the few treads every change
   climbs, always forward. Nothing on the loom moves along a formula, and nothing moves without a
   reason:

     at rest          the loom is waiting, so nothing on it moves: the stars and the dust lie where
                      they are. A card of the loom is a printed thing: the weave as it stands.
     a weave solved   the loom turns once, by one arm's step, in rite.ratchet's even clicks, and
                      rests: every copy comes to lie where its neighbour lay, which is what a fold
                      is, so the lines lie as they did and only the tones, which alternate arm by
                      arm, say the loom has turned.
     a thing marked   -- the lit arm, the mirror-image copies once the loom has shown the hand of
                      the weave, the sigil's box on a loom of one hand, the mirror the visitor
                      says is there, the finer screen, the bands of a read print -- is cut in
                      behind the piece's edge up ONE stair (rite.paint: one path, never cells; a
                      shape that is not a box is a clip with one paint through it), and everything
                      that marks it -- a halo's width, a stroke's colour, a word under the sigil --
                      steps on that stair's treads and nowhere else; one taken back is cut away the
                      same way. A tint that marks a state rests as two shades of its colour split
                      by that edge through its middle (cover, below).
     a count set      arrives as ticks round the rim or under the print, stepping from the count
                      that was showing to the one set, up the rite's stair, one way, in a few treads.
     a thing said     -- a mark set on the rim, the direction the visitor says, an answer read out
                      -- is cut over at its roll's moment (rite.flicker), once, and stays.

   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion and for whatever stood there from the start. Each thing that moves has a roll of its
   own (rite.at): the same edge, with its own treads and its own moment -- and each TIME it moves
   it is rolled again (roll(): the thing's seed crossed with how many times it has moved), so a
   count set twice arrives in two rhythms. A change made while another is under way moves from
   what is showing at that moment, never from where the last one was heading: a mirror taken back
   half come shrinks from half, a count reset mid-way steps from the ticks drawn. What is showing
   is the scene's look (foldsLook, moireLook): every value in the picture that a change moves,
   read off the clock. The scene draws from it, a change moves from it, and a frame whose look
   and size are the ones already on the canvas draws nothing (picture, below) -- so the loom draws
   once per tread while something moves, and not at all while nothing does. */

// The rite of a piece handed none (no env builder does this; a guard): every change already made,
// and a surface cut by a plain upright slice from its left side.
const STILL = {
  stair: () => 1, ratchet: () => 1, flicker: () => 1,
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

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return clamp((s.t - since) / span, 0, 1);
}

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two
// triggers of one movement play alike while the same seed still plays the same piece.
function roll(rite, base, n) {
  return rite.at(((base | 0) ^ (Math.imul((n | 0) + 1, 0x9e37) | 0)) >>> 0);
}

// The one turn of a solved loom: how far through its arm's step it has come, in the ratchet's even
// clicks on a roll of its own, from the moment it began (`since`, on the piece's clock) -- and
// none at all until it has begun.
const SPIN = 3.6; // seconds the loom takes to turn one arm's step
function spun(rite, s, since, reduced) {
  if (since == null) return 0;
  return roll(rite, 0x70, 0).ratchet(came(s, since, SPIN, reduced));
}

// How many of `n` notches have arrived at p: up the rite's stair in at most its own few treads --
// a notch a tread when there are few of them, a few notches a tread when there are many, so a
// long count is still one short stair and never a ladder.
function notches(rite, p, n) {
  return Math.round(rite.stair(p, Math.min(n, rite.treads || 1)) * n);
}

// A count stepping from the one that stood to the one set, one way: never a cut to zero and a
// fresh climb, and never a number that simply changes.
function counted(rite, p, from, to) {
  const diff = to - from;
  if (!diff) return to;
  return from + Math.sign(diff) * notches(rite, p, Math.abs(diff));
}

// A tint `k` of the way to marking its surface, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes, and at rest it is two shades of one colour split by that
// edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A coverage on its way from what was showing (`from`) to where it is going (`to`, 0 or 1), `step`
// of the way up the stair it climbs: one way, from wherever it stood.
function toward(from, to, step) {
  return step >= 1 ? to : from + (to - from) * step;
}

// The picture a frame would draw, as one string: the canvas's size and the scene's look. A frame
// whose picture is the one already drawn draws nothing -- the canvas holds it -- and a new size
// (the stage clears the canvas to resize it) or a new tread of any change draws again.
function picture(c, look) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1) + ' ' + JSON.stringify(look);
}

/* ---- shared drawing ------------------------------------------------------------------------- */

function night(g, w, h, env) {
  const c = env.colors;
  const bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bg.addColorStop(0, c.bg2);
  bg.addColorStop(1, c.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
}

// The persona's stars, faint behind the loom, and a little dust whose number is the
// configuration's density and whose place is its turn. The dust lies where it is: it neither
// drifts nor blinks, because nothing on the loom moves while it waits.
function sky(g, w, h, env, v) {
  const c = env.colors;
  for (const s of env.stars || []) {
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    g.fillStyle = env.alpha(c.fg, 0.28);
    g.beginPath();
    g.arc((x / 100) * w, (y / 100) * h, 1.2, 0, Math.PI * 2);
    g.fill();
  }
  const count = Math.max(10, Math.round(36 * v.density));
  for (let i = 0; i < count; i++) {
    g.fillStyle = env.alpha(c.muted, 0.06 + (i % 5) * 0.025);
    g.fillRect((i * 129.3 + v.turn * 97) % w, (i * 83.7 + v.turn * 41) % h, 1, 1);
  }
}

function label(g, env, text, x, y, size, align, tone) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillStyle = tone || env.colors.fg;
  g.fillText(text, x, y);
}

/* ---- count the folds ------------------------------------------------------------------------ */

// The motif: three or four points in polar form about the centre -- a radius in 0.22..0.95 of the
// loom and an angle in 0.12..0.92 of the half-sector an arm may use -- all to one side of the
// arm's axis, so the motif has a hand of its own, and spread enough to be read.
function motifOf(env) {
  const n = env.chance(0.5) ? 3 : 4;
  for (let attempt = 0; attempt < 120; attempt++) {
    const points = [];
    for (let i = 0; i < n; i++) points.push([Math.round((0.22 + env.rnd() * 0.73) * 100) / 100, Math.round((0.12 + env.rnd() * 0.8) * 100) / 100]);
    let apart = true;
    for (let i = 0; i < n && apart; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(points[i][0] - points[j][0]) < 0.1 || Math.abs(points[i][1] - points[j][1]) < 0.12) apart = false;
      }
    }
    // The thread must not just march outward or inward: a turn back makes it a shape.
    const zig = points.some((p, i) => i > 1 && (p[0] - points[i - 1][0]) * (points[i - 1][0] - points[i - 2][0]) < 0);
    if (apart && zig) return points;
  }
  return [[0.3, 0.2], [0.72, 0.85], [0.52, 0.45], [0.9, 0.3]].slice(0, n);
}

function foldsPlan(env) {
  return { kind: 'folds', number: env.int(100, 999), k: env.int(MIN_FOLDS, MAX_FOLDS), mirrored: env.chance(0.5), motif: motifOf(env) };
}

function carriedFolds(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'folds') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.k) || p.k < MIN_FOLDS || p.k > MAX_FOLDS) return null;
  if (typeof p.mirrored !== 'boolean') return null;
  if (!Array.isArray(p.motif) || p.motif.length < 3 || p.motif.length > 4) return null;
  const okPoint = (pt) => Array.isArray(pt) && pt.length === 2 && pt.every((v) => typeof v === 'number' && isFinite(v))
    && pt[0] >= 0.15 && pt[0] <= 1 && pt[1] >= 0.05 && pt[1] <= 1;
  if (!p.motif.every(okPoint)) return null;
  return { kind: 'folds', number: p.number, k: p.k, mirrored: p.mirrored, motif: p.motif.map((pt) => [pt[0], pt[1]]) };
}

function foldsTitle(plan) {
  return 'weave ' + plan.number + ': the folded sigil';
}

function loomGeometry(w, h, v) {
  const m = Math.min(w, h);
  return { cx: w / 2, cy: h / 2, R: m * 0.44 * clamp(v.scale, 0.86, 1.1), m };
}

// One copy of the motif: on arm `arm`, with its hand kept (sign 1) or mirrored (sign -1), about
// (cx, cy) at radius R, the first arm's axis at `base`.
function copyOf(plan, cx, cy, R, base, arm, sign) {
  const step = (Math.PI * 2) / plan.k;
  return plan.motif.map((pt) => {
    const angle = base + arm * step + sign * pt[1] * step * 0.42;
    return { x: cx + Math.cos(angle) * pt[0] * R, y: cy + Math.sin(angle) * pt[0] * R };
  });
}

// One copy of the motif as a shard: its points joined in order and closed, filled faintly and
// stroked, so the hand of the shape can be read.
function thread(g, pts, fill) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.stroke();
}

function beads(g, pts, r) {
  for (const p of pts) {
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
  }
}

// A shard marked, `k` of the way, in the current fillStyle: clipped to the shard, its bounding box
// covered behind the piece's edge -- one clip and one tint in two shades, never cells.
function coverShard(g, rite, pts, k) {
  if (k <= 0) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  g.save();
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.clip();
  cover(g, rite, x0, y0, x1 - x0, y1 - y0, k);
  g.restore();
}

// Where the loom's first arm points: the configuration's turn, and as much of one arm's step as
// its one turn has come (`turned`, 0 to 1).
function loomBase(plan, v, turned) {
  return v.turn * Math.PI * 2 + ((Math.PI * 2) / plan.k) * turned;
}

// What the loom shows at its clock's moment: every value in the picture a change moves (see the
// rite, above). The lit arm and the hand of the weave each climb one stair, and everything that
// marks them steps on its treads.
function foldsLook(plan, s, rite, reduced) {
  const got = (since, span) => came(s, since, span, reduced);
  return {
    turned: spun(rite, s, s.turnAt, reduced),
    lit: s.lit ? rite.at(0x11).stair(got(s.litAt, 1.6)) : 0,
    hand: s.handAt != null ? rite.at(0x1d).stair(got(s.handAt, 1.8)) : 0,
    ticks: s.ticks.map((tick) => roll(rite, 0xa1, tick.n).flicker(got(tick.at, 0.6))),
    count: s.guess ? counted(roll(rite, 0x9e, s.guesses), got(s.guessAt, 1.2), s.guessFrom, s.guess) : 0,
    mirror: toward(s.mirrorFrom, s.mirror ? 1 : 0, roll(rite, 0x3d, s.mirrors).stair(got(s.mirrorAt, 1.2))),
    open: s.open ? rite.at(0x0a).flicker(got(s.openAt, 1)) : 0
  };
}

// `s`: the marks the visitor set on the rim and the count they say (the ticks under the look's
// count); `look`: what the loom shows now (foldsLook, above).
function drawFolds(g, w, h, env, plan, s, look, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const geo = loomGeometry(w, h, v);
  const base = loomBase(plan, v, look.turned);
  const size = Math.max(9, Math.min(15, Math.round(geo.m * 0.036)));
  const bead = Math.max(1.4, geo.m * 0.006);
  night(g, w, h, env);
  sky(g, w, h, env, v);
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1, geo.m * 0.003);
  // The lit arm is marked up one stair from the moment the hint was asked: at each tread its shards
  // are cut further in behind the piece's edge and its halo is as much thicker, and from the first
  // its stroke and beads are the foreground's.
  // The hand of the weave, once the loom has shown it, up a stair of its own: on a mirrored loom
  // every mirror-image copy is marked, a tint cut in behind the piece's edge; on a loom of one hand
  // the sigil's box in the corner is marked instead (below), and the word under the sigil is cut
  // on at the first tread.
  for (let arm = 0; arm < plan.k; arm++) {
    const tone = arm % 2 ? c.accent : c.accent2;
    const lit = arm === 0 && look.lit > 0;
    for (const sign of plan.mirrored ? [1, -1] : [1]) {
      const pts = copyOf(plan, geo.cx, geo.cy, geo.R, base, arm, sign);
      if (lit) {
        g.strokeStyle = env.alpha(c.fg, 0.35);
        g.lineWidth = Math.max(4, geo.m * 0.016) * look.lit;
        thread(g, pts, null);
        g.lineWidth = Math.max(1, geo.m * 0.003);
      }
      g.strokeStyle = env.alpha(lit ? c.fg : tone, lit ? 1 : 0.8);
      thread(g, pts, env.alpha(tone, 0.14));
      if (lit) {
        g.fillStyle = env.alpha(c.fg, 0.4);
        coverShard(g, rite, pts, look.lit);
      }
      if (sign < 0 && look.hand > 0) {
        g.fillStyle = env.alpha(c.accent2, 0.38);
        coverShard(g, rite, pts, look.hand);
      }
      g.fillStyle = env.alpha(lit ? c.fg : tone, 0.95);
      beads(g, pts, bead);
    }
  }
  g.strokeStyle = env.alpha(c.accent, 0.22);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(geo.cx, geo.cy, geo.R, 0, Math.PI * 2);
  g.stroke();
  // The marks the visitor set on the rim themselves, one per tap, each cut on at its own moment
  // where it was set and turning with the loom; failing those, the count from the knob, as even
  // ticks round the rim that step from the count that was showing to the one set in a few treads,
  // one way, on the roll of that setting.
  if (s.ticks.length) {
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = Math.max(1.5, geo.m * 0.005);
    g.beginPath();
    for (let i = 0; i < s.ticks.length; i++) {
      if (!look.ticks[i]) continue;
      const a = base + s.ticks[i].rel;
      g.moveTo(geo.cx + Math.cos(a) * geo.R * 0.98, geo.cy + Math.sin(a) * geo.R * 0.98);
      g.lineTo(geo.cx + Math.cos(a) * geo.R * 1.08, geo.cy + Math.sin(a) * geo.R * 1.08);
    }
    g.stroke();
  } else if (s.guess) {
    g.strokeStyle = env.alpha(c.accent2, 0.85);
    g.lineWidth = Math.max(1.5, geo.m * 0.004);
    g.beginPath();
    for (let i = 0; i < look.count; i++) {
      const a = base + i * ((Math.PI * 2) / s.guess);
      g.moveTo(geo.cx + Math.cos(a) * geo.R * 1.01, geo.cy + Math.sin(a) * geo.R * 1.01);
      g.lineTo(geo.cx + Math.cos(a) * geo.R * 1.07, geo.cy + Math.sin(a) * geo.R * 1.07);
    }
    g.stroke();
  }
  // The motif as laid once, in the corner, its axis pointing up.
  const box = geo.m * 0.2;
  const bx = geo.m * 0.03;
  const by = h - box - geo.m * 0.03;
  g.fillStyle = env.alpha(c.bg, 0.55);
  g.fillRect(bx, by, box, box);
  if (!plan.mirrored && look.hand > 0) {
    // One hand: the sigil's box is marked, its tint cut in behind the edge, resting in two shades.
    g.fillStyle = env.alpha(c.accent, 0.22);
    cover(g, rite, bx, by, box, box, look.hand);
  }
  g.strokeStyle = env.alpha(c.muted, 0.4);
  g.strokeRect(bx, by, box, box);
  const key = copyOf(plan, bx + box * 0.5, by + box * 0.56, box * 0.46, -Math.PI / 2, 0, 1);
  // The mirror the visitor says is there: the key's mirror image is cut into the corner behind the
  // piece's edge when they say so, and cut away the same way when they take it back -- each flip
  // of the toggle on a roll of its own, from as much of it as was showing.
  if (look.mirror > 0) {
    const twin = copyOf(plan, bx + box * 0.5, by + box * 0.56, box * 0.46, -Math.PI / 2, 0, -1);
    g.fillStyle = env.alpha(c.accent2, 0.45);
    coverShard(g, rite, twin, look.mirror);
    g.strokeStyle = env.alpha(c.accent2, 0.5);
    g.lineWidth = 1;
    g.setLineDash([2, 3]);
    thread(g, twin, null);
    g.setLineDash([]);
  }
  g.strokeStyle = env.alpha(c.fg, 0.9);
  g.lineWidth = 1;
  thread(g, key, env.alpha(c.fg, 0.14));
  g.fillStyle = c.fg;
  beads(g, key, bead);
  label(g, env, 'the sigil', bx + box * 0.5, by + box * 0.1, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  // What the loom has said of the hand is cut on under the sigil at the hand's first tread.
  if (look.hand > 0) label(g, env, plan.mirrored ? 'both hands' : 'one hand', bx + box * 0.5, by + box * 0.92, Math.max(8, size - 2), 'center', env.alpha(c.accent2, 0.95));
  // The answer is cut on at its moment.
  if (look.open) {
    label(g, env, WORDS[plan.k] + ' folds' + (plan.mirrored ? ', mirrored' : ', one hand'), w - geo.m * 0.03, h - geo.m * 0.04, size, 'right', c.accent2);
  }
}

function foldsStill() {
  return {
    turnAt: null, lit: false, litAt: null, open: false, openAt: null, t: 0, guess: null, guessAt: null, mirror: false, mirrorAt: null,
    // How many times each thing has moved (the roll for its next movement); what was showing when
    // it last moved, which it moves from (the count of ticks, the cover of the mirror twin); when
    // the loom showed the hand of the weave; and the picture last drawn (picture, above).
    guesses: 0, guessFrom: 0, mirrors: 0, mirrorFrom: 0, handAt: null, ticks: [], drawn: null
  };
}

function foldsPreview(g, w, h, env, plan) {
  const s = foldsStill();
  drawFolds(g, w, h, env, plan, s, foldsLook(plan, s, riteOf(env), true), env.variant);
}

function foldsPiece(env, plan) {
  const helps = asked(env).helps;
  // What the loom has to show, in the order it shows it: a lit arm, and then the hand of the
  // weave. The difficulty says how many of them it will show (a fold count is a count, so there
  // is no margin to widen here).
  const shows = [
    'one arm is lit: everything on it is one fold',
    'the weave ' + (plan.mirrored ? 'shows both hands: every copy is laid with its mirror image' : 'is all of one hand: no copy is mirrored')
  ];
  const s = Object.assign(foldsStill(), { shown: 0, ticksSet: 0 });
  const look = (c) => foldsLook(plan, s, riteOf(c), !!c.reduced);
  // The loom as it stands, drawn unless (`always` aside) the canvas already holds that picture.
  const draw = (c, always) => {
    const now = look(c);
    const drawn = picture(c, now);
    if (!always && drawn === s.drawn) return;
    drawFolds(c.g, c.w, c.h, c, plan, s, now, env.variant);
    s.drawn = drawn;
  };
  return {
    title: foldsTitle(plan),
    brief: 'A working of the loom. A sigil of ' + WORDS[plan.motif.length] + ' joined points is laid on the midnight loom and turned about the centre a number of times: the folds. On some looms every copy is laid down with its mirror image as well, so the weave shows both hands. The sigil, as laid once, stands in the corner.',
    goal: 'Count the folds, and say whether the weave is mirrored.',
    aspect: '1 / 1',
    checkLabel: 'check the weave',
    steps: [
      { id: 'folds', ask: 'how many times the sigil is turned about the centre', kind: 'number', min: 2, max: MAX_FOLDS, step: 1, unit: 'folds' },
      { id: 'mirror', ask: 'is every copy laid with its mirror image?', kind: 'toggle', label: 'mirrored' },
      { id: 'hint', ask: 'one arm, lit', kind: 'press', count: 1, label: 'light one arm', optional: true }
    ],
    solution: { folds: plan.k, mirror: plan.mirrored },
    check(c) {
      const foldsRight = Number(c.value('folds')) === plan.k;
      const mirrorRight = !!c.value('mirror') === plan.mirrored;
      if (foldsRight && mirrorRight) return { solved: true, say: 'the weave closes: ' + WORDS[plan.k] + ' folds, ' + (plan.mirrored ? 'each with its mirror image' : 'all of one hand') };
      if (!foldsRight && !mirrorRight) return { solved: false, say: 'the loom does not close: the fold count and the mirror are both off' };
      return { solved: false, say: foldsRight ? 'the fold count is right; the mirror is off' : 'the mirror is right; the fold count is off' };
    },
    start(c) {
      c.status('the loom is still; tap over each arm to mark it on the rim, and the marks count the folds');
      draw(c, true);
    },
    apply(id, value, c) {
      // What the loom shows now, before anything moves it: every change below moves from here.
      const shown = look(c);
      if (id === 'folds') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) {
          const guess = clamp(n, 2, MAX_FOLDS);
          if (guess !== s.guess) {
            // The ticks step from the count that was showing (none, the first time) to this one.
            s.guessFrom = shown.count;
            s.guess = guess;
            s.guessAt = s.t;
            s.guesses += 1;
          }
          c.status(guess + ' folds, you say');
        }
      }
      if (id === 'mirror') {
        if (!!value !== s.mirror) {
          s.mirrorFrom = shown.mirror;
          s.mirror = !!value;
          s.mirrorAt = s.t;
          s.mirrors += 1;
        }
        c.status(value ? 'mirrored, you say' : 'one hand, you say');
      }
      if (id === 'hint') {
        if (s.shown < Math.min(shows.length, helps)) {
          c.status(shows[s.shown]);
          s.shown += 1;
          if (s.shown === 1 && !s.lit) s.litAt = s.t;
          if (s.shown === 1) s.lit = true;
          if (s.shown === 2 && s.handAt == null) s.handAt = s.t;
          c.hint();
        } else if (s.shown >= helps) {
          c.status('that is all the loom will show at this difficulty; the rest is counting');
        } else {
          c.status('the loom has shown what it has; the rest is counting');
        }
      }
      draw(c, true);
    },
    // The rim is the counter: tap over an arm to set a mark there, tap a mark to take it off, and
    // the marks are the fold count.
    tap(x, y, c) {
      const v = env.variant || PLAIN;
      const geo = loomGeometry(c.w, c.h, v);
      const dx = x * c.w - geo.cx;
      const dy = y * c.h - geo.cy;
      if (Math.hypot(dx, dy) < geo.R * 0.3) {
        c.status('tap over an arm, nearer the rim, to mark it');
        return;
      }
      const rel = Math.atan2(dy, dx) - loomBase(plan, v, look(c).turned);
      const near = s.ticks.findIndex((tick) => {
        const d = Math.abs((((tick.rel - rel) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        return d < 0.2;
      });
      if (near >= 0) s.ticks.splice(near, 1);
      else s.ticks.push({ rel, at: s.t, n: ++s.ticksSet });
      const n = s.ticks.length;
      if (n >= 2 && n <= MAX_FOLDS) c.set('folds', n);
      c.status(n === 0 ? 'no marks on the rim'
        : n === 1 ? 'one mark on the rim; mark every arm once to count the folds'
          : n > MAX_FOLDS ? 'more marks than any loom has folds; tap a mark to take it off'
            : n + ' marks on the rim: ' + n + ' folds, you say');
      draw(c, true);
    },
    frame(t, dt, c) {
      // Less motion asked for: the clock stands, and every change came() at once.
      if (!c.reduced) s.t += dt;
      draw(c);
    },
    // Solved: the answer is cut on, and the loom turns once by one arm's step, so every copy comes
    // to lie where its neighbour lay -- which is what a fold is -- and rests.
    end(c) {
      s.open = true;
      s.openAt = s.t;
      if (s.turnAt == null) s.turnAt = s.t;
      c.status('the weave turns: ' + WORDS[plan.k] + ' folds' + (plan.mirrored ? ', mirrored' : ''));
      draw(c, true);
    }
  };
}

/* ---- the moiré ------------------------------------------------------------------------------ */

function moirePlan(env) {
  const first = env.int(8, 24);
  const apart = env.int(1, 6);
  const more = env.chance(0.5) || first - apart < 6;
  return { kind: 'moire', number: env.int(100, 999), first, second: more ? first + apart : first - apart };
}

function carriedMoire(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'moire') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.first) || p.first < 8 || p.first > 24) return null;
  if (!Number.isInteger(p.second) || p.second < 6 || p.second > 30) return null;
  const apart = Math.abs(p.first - p.second);
  if (apart < 1 || apart > 6) return null;
  return { kind: 'moire', number: p.number, first: p.first, second: p.second };
}

function moireTitle(plan) {
  return 'print ' + plan.number + ': the moiré seal';
}

function moireBoxes(w, h, v) {
  const pad = w * 0.06;
  const width = (w - pad * 2) * clamp(v.scale, 0.86, 1);
  const x = (w - width) / 2;
  return {
    pad,
    alone: { x, y: h * 0.12, w: width, h: h * 0.15 },
    both: { x, y: h * 0.38, w: width, h: h * 0.5 }
  };
}

// The lines of one screen across a box: `n` of them, evenly spaced, slid along by `phase` of the
// width and wrapped, each a crisp bar a little under half a pitch wide, so that where the two
// screens' bars fall together the print opens and where they interleave it closes -- which is
// the whole of the moiré.
function screenLines(g, box, n, offset, phase, color) {
  const pitch = box.w / n;
  const bar = Math.max(1, Math.round(pitch * 0.42));
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const u = ((((i + offset) / n + phase) % 1) + 1) % 1;
    const x = Math.round(box.x + u * box.w - bar / 2);
    g.fillRect(x, box.y, bar, box.h);
  }
}

// What the print shows at its clock's moment: every value in the picture a change moves (see the
// rite, above).
function moireLook(plan, s, rite, reduced) {
  const got = (since, span) => came(s, since, span, reduced);
  return {
    finer: s.finerAt != null ? rite.at(0x7f).stair(got(s.finerAt, 1.6)) : 0,
    bands: s.open ? rite.at(0x6a).stair(got(s.openAt, 1.8)) : 0,
    count: s.guess ? counted(roll(rite, 0x9e, s.guesses), got(s.guessAt, 1.2), s.guessFrom, s.guess) : 0,
    brackets: s.bandsAt != null ? notches(rite.at(0x2b), got(s.bandsAt, 1.2), Math.abs(plan.first - plan.second)) : 0,
    which: roll(rite, 0x5c, s.whiches).flicker(got(s.whichAt, 0.9)) ? s.which : s.whichFrom,
    open: s.open ? rite.at(0x0a).flicker(got(s.openAt, 1)) : 0
  };
}

// `s`: the count the visitor says (the ticks under the look's count); `look`: what the print shows
// now (moireLook, above).
function drawMoire(g, w, h, env, plan, s, look, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const boxes = moireBoxes(w, h, v);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const phase = v.turn / plan.first;
  const strength = clamp(0.5 * v.density, 0.42, 0.62);
  const firstTone = env.alpha(env.mix(c.accent, c.fg, 0.35), strength);
  const secondTone = env.alpha(c.accent2, strength);
  night(g, w, h, env);
  for (const box of [boxes.alone, boxes.both]) {
    g.fillStyle = env.alpha(c.bg, 0.7);
    g.fillRect(box.x, box.y, box.w, box.h);
  }
  screenLines(g, boxes.alone, plan.first, 0.5, phase, firstTone);
  screenLines(g, boxes.both, plan.first, 0.5, phase, firstTone);
  // The second screen sits half a pitch along, which centres its bands in the print.
  screenLines(g, boxes.both, plan.second, 1, phase, secondTone);
  // The finer screen, once the press has said which: its box is marked, a tint cut in behind the
  // piece's edge up its stair, resting in two shades.
  if (look.finer > 0) {
    const finer = plan.second > plan.first ? boxes.both : boxes.alone;
    g.fillStyle = plan.second > plan.first ? env.alpha(c.accent2, 0.16) : env.alpha(env.mix(c.accent, c.fg, 0.35), 0.16);
    cover(g, rite, finer.x, finer.y, finer.w, finer.h, look.finer);
  }
  // The bands, once the print is read: one edge crosses the print from the moment the answer came
  // out and lights every band's core it has passed, up its stair, and they hold -- never a wash.
  // The cores are one path, filled once through the part of the print the edge has passed.
  if (look.bands > 0) {
    const apart = Math.abs(plan.first - plan.second);
    const span = boxes.both.w / apart;
    g.save();
    g.beginPath();
    rite.region(g, boxes.both.x, boxes.both.y, boxes.both.w, boxes.both.h, look.bands);
    g.clip();
    g.fillStyle = env.alpha(c.accent2, 0.2);
    g.beginPath();
    for (let j = 0; j < apart; j++) {
      const x = boxes.both.x + ((j + 0.5) / apart) * boxes.both.w;
      g.rect(x - span / 4, boxes.both.y, span / 2, boxes.both.h);
    }
    g.fill();
    g.restore();
  }
  g.strokeStyle = env.alpha(c.muted, 0.45);
  g.lineWidth = 1;
  for (const box of [boxes.alone, boxes.both]) {
    g.beginPath();
    g.moveTo(box.x, box.y);
    g.lineTo(box.x + box.w, box.y);
    g.moveTo(box.x, box.y + box.h);
    g.lineTo(box.x + box.w, box.y + box.h);
    g.stroke();
  }
  // The visitor's count, as ticks under the print that step from the count that was showing to the
  // one set in a few treads, one way, on the roll of that setting.
  if (s.guess) {
    g.strokeStyle = env.alpha(c.accent2, 0.85);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < look.count; i++) {
      const x = Math.round(boxes.both.x + ((i + 0.5) / s.guess) * boxes.both.w) + 0.5;
      g.moveTo(x, boxes.both.y + boxes.both.h + 3);
      g.lineTo(x, boxes.both.y + boxes.both.h + 3 + size * 0.5);
    }
    g.stroke();
  }
  // The bands the press has counted out: that many brackets over the print, arriving up a stair of
  // a few treads.
  if (look.brackets > 0) {
    const apart = Math.abs(plan.first - plan.second);
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = Math.max(1.5, size * 0.12);
    g.beginPath();
    for (let j = 0; j < look.brackets; j++) {
      const x = boxes.both.x + ((j + 0.5) / apart) * boxes.both.w;
      const half = boxes.both.w / apart * 0.3;
      g.moveTo(x - half, boxes.both.y - 4);
      g.lineTo(x + half, boxes.both.y - 4);
    }
    g.stroke();
  }
  label(g, env, 'the first screen alone: ' + plan.first + ' lines', boxes.alone.x, boxes.alone.y - size * 0.9, size, 'left', env.mix(c.accent, c.fg, 0.35));
  label(g, env, 'the second screen', boxes.both.x, boxes.both.y - size * 0.9, size, 'left', c.accent2);
  label(g, env, ' laid over the first', boxes.both.x + g.measureText('the second screen').width, boxes.both.y - size * 0.9, size, 'left', env.alpha(c.fg, 0.9));
  // The direction the visitor says, beside the print's title: cut on at its moment, or cut over
  // from the one that was showing, each choice on a roll of its own.
  if (look.which) {
    label(g, env, look.which === 'more' ? 'more, you say' : 'fewer, you say', boxes.both.x + boxes.both.w, boxes.both.y - size * 0.9, size, 'right', env.alpha(c.accent2, 0.9));
  }
  // The answer is cut on at its moment.
  if (look.open) {
    const apart = Math.abs(plan.first - plan.second);
    label(g, env, WORDS[apart] + (apart === 1 ? ' band: ' : ' bands: ') + plan.second + ' lines on the second screen', w - boxes.pad, h * 0.95, size, 'right', c.accent2);
  }
}

function moireStill() {
  return {
    open: false, openAt: null, t: 0, guess: null, guessAt: null, which: null, whichAt: null,
    // How many times each thing has moved (the roll for its next movement); what was showing when
    // it last moved, which it moves from (the count of ticks, the direction said); when the press
    // showed which screen is finer and how many bands there are; and the picture last drawn
    // (picture, above).
    guesses: 0, guessFrom: 0, whiches: 0, whichFrom: null, finerAt: null, bandsAt: null, drawn: null
  };
}

function moirePreview(g, w, h, env, plan) {
  const s = moireStill();
  drawMoire(g, w, h, env, plan, s, moireLook(plan, s, riteOf(env), true), env.variant);
}

function moirePiece(env, plan) {
  const more = plan.second > plan.first;
  const apart = Math.abs(plan.first - plan.second);
  const helps = asked(env).helps;
  const shows = [
    more ? 'the second screen\'s lines sit closer together than the first\'s' : 'the second screen\'s lines sit farther apart than the first\'s',
    'the print shows ' + WORDS[apart] + (apart === 1 ? ' broad band' : ' broad bands') + ' across it'
  ];
  const s = Object.assign(moireStill(), { shown: 0 });
  const look = (c) => moireLook(plan, s, riteOf(c), !!c.reduced);
  // The print as it stands, drawn unless (`always` aside) the canvas already holds that picture.
  const draw = (c, always) => {
    const now = look(c);
    const drawn = picture(c, now);
    if (!always && drawn === s.drawn) return;
    drawMoire(c.g, c.w, c.h, c, plan, s, now, env.variant);
    s.drawn = drawn;
  };
  return {
    title: moireTitle(plan),
    brief: 'The seal is two screens of upright lines laid over each other: the first has ' + plan.first + ' lines across the width, the second a different count. Where their lines fall together and then apart, broad bands appear across the print, and there are as many bands as the two counts differ by.',
    goal: 'Say how many lines the second screen has, and whether that is more or fewer than the first.',
    aspect: '4 / 3',
    checkLabel: 'check the print',
    steps: [
      { id: 'second', ask: 'the lines on the second screen', kind: 'number', min: 4, max: 30, step: 1, unit: 'lines' },
      { id: 'which', ask: 'the second screen has', kind: 'choice', options: [
        { label: 'more lines than the first', value: 'more' },
        { label: 'fewer lines than the first', value: 'fewer' }
      ] },
      { id: 'hint', ask: 'which screen is the finer', kind: 'press', count: 1, label: 'tell me which is finer', optional: true }
    ],
    solution: { second: plan.second, which: more ? 'more' : 'fewer' },
    check(c) {
      const countRight = Number(c.value('second')) === plan.second;
      const whichRight = c.value('which') === (more ? 'more' : 'fewer');
      if (countRight && whichRight) return { solved: true, say: 'the seal reads: ' + plan.second + ' lines, ' + WORDS[apart] + (apart === 1 ? ' band' : ' bands') + ' across the print' };
      if (!countRight && !whichRight) return { solved: false, say: 'the seal does not read: the count and the direction are both off' };
      return { solved: false, say: countRight ? 'the count is right; the direction is off' : 'the direction is right; the count is off' };
    },
    start(c) {
      c.status('count the broad bands across the print');
      draw(c, true);
    },
    apply(id, value, c) {
      // What the print shows now, before anything moves it: every change below moves from here.
      const shown = look(c);
      if (id === 'second') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) {
          const guess = clamp(n, 4, 30);
          if (guess !== s.guess) {
            // The ticks step from the count that was showing (none, the first time) to this one.
            s.guessFrom = shown.count;
            s.guess = guess;
            s.guessAt = s.t;
            s.guesses += 1;
          }
          c.status(guess + ' lines on the second screen, you say');
        }
      }
      if (id === 'which') {
        const which = value === 'more' ? 'more' : 'fewer';
        if (which !== s.which) {
          s.whichFrom = shown.which;
          s.which = which;
          s.whichAt = s.t;
          s.whiches += 1;
        }
        c.status(value === 'more' ? 'more lines than the first, you say' : 'fewer lines than the first, you say');
      }
      if (id === 'hint') {
        if (s.shown < Math.min(shows.length, helps)) {
          c.status(shows[s.shown]);
          s.shown += 1;
          if (s.shown === 1 && s.finerAt == null) s.finerAt = s.t;
          if (s.shown === 2 && s.bandsAt == null) s.bandsAt = s.t;
          c.hint();
        } else {
          c.status(s.shown >= helps
            ? 'that is all the press will show at this difficulty; count the bands yourself'
            : 'the press has shown what it has; count the bands and read the difference');
        }
      }
      draw(c, true);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      c.status(WORDS[apart] + (apart === 1 ? ' band' : ' bands') + ' from ' + plan.first + ' lines against ' + plan.second + '; the bands are lit on the print');
      draw(c, true);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle a seed is dealt, from the seed alone so that paint, spark and piece agree.
function dealsMoire(env) {
  return (((Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0) >>> 3) & 1) === 1;
}

// The plan, dealt once from the env's seeded stream and kept with that env. Which of the two this
// card is comes off the seed above and so is free to ask twice, but the plan is not: every pass
// over one env -- its still picture, its spark -- has to get the same loom, and dealing again would
// thread another from a stream already spent (issue #92).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const moire = dealsMoire(env);
    got = { moire, plan: moire ? moirePlan(env) : foldsPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'orbital-weaver',
  needsSky: true,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.moire) moirePreview(g, w, h, env, d.plan);
    else foldsPreview(g, w, h, env, d.plan);
  },
  animate() {
    // A card of the loom is a printed thing, the folds as much as the moire screens: the weave
    // waits to be counted, and the one turn a loom makes is the piece's, when it is solved, so the
    // loop lets the card go at once (js/feed.js has the contract animate is held to).
    return false;
  },
  spark(env) {
    const d = deal(env);
    if (d.moire) {
      const plan = d.plan;
      return {
        title: moireTitle(plan),
        text: 'Two screens pressed as one seal: the first of ' + plan.first + ' thin lines, the second laid over it. The broad bands in the print say how far apart the two counts are.',
        mono: plan.first + ' lines / ?',
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => moirePreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: foldsTitle(plan),
      text: 'One sigil turned about the centre of the midnight loom, perhaps with its mirror image. Count the folds, and say whether the weave is mirrored.',
      mono: WORDS[plan.motif.length] + ' points / ? folds',
      aspect: '1 / 1',
      paint: (ctx, cw, ch, cardEnv) => foldsPreview(ctx, cw, ch, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const folds = carriedFolds(env);
    if (folds) return foldsPiece(env, folds);
    const moire = carriedMoire(env);
    if (moire) return moirePiece(env, moire);
    const d = deal(env);
    return d.moire ? moirePiece(env, d.plan) : foldsPiece(env, d.plan);
  }
};
