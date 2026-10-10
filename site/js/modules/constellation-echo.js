/* The echo chamber: a night room where a pulse goes out and the stars answer. As a card it is one
   of the two puzzles below, drawn small and still (paint, spark); as a piece it is that puzzle, and
   the card it was opened from says which. See js/feed.js for what a module is and js/stage.js for
   what a piece is.

   Two puzzles, both deduction, both solvable from what is drawn and nothing heard:

     the echo order    A marked point and four or five stars at clearly different distances from it
                       (each at least a fifth farther than the last). A pulse leaves the mark and
                       its echo comes back from each star after a time proportional to the star's
                       distance. Put the stars in the order their echoes return. Faint rings round
                       the mark make the distances judgeable; nothing is numbered. A wrong check
                       says how many stand in the right place and no more; a hint, at a price,
                       says where one star comes back.
     the midnight chord  Four voices drawn from periods of 2, 3, 4, 5, 6 and 8 beats, each sounding
                       on beat 0 and every period after, over a strip of twelve beats. Some of them
                       are sounding. Stacked blocks show the totals per beat; hollow circles beside
                       them show the totals the visitor's chosen voices would make, so a deduction
                       can be tested against the clue; below stand the four voices' own beats. Say
                       which voices are sounding and on which beat after beat 0 they next all
                       strike together. The chord is drawn from its answer and checked for
                       uniqueness against every other chord of its four voices before it is dealt.

   The chamber reads the sky: the visitor's stars are the first candidates for the echo order's
   points, and extra points are invented from the seed when the sky is thin (one star is enough).
   Nothing depends on a star's text. A card and the feature it opens as are one puzzle: the spark
   puts the whole plan on its spec as `of` -- the mark and the stars, or the chord's voices and its
   four candidates -- and piece(env) opens on that rather than rolling another. */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const PERIODS = [2, 3, 4, 5];
const PERIOD_POOL = [2, 3, 4, 5, 6, 8];
const EVERY = { 2: 'every 2nd beat', 3: 'every 3rd beat', 4: 'every 4th beat', 5: 'every 5th beat', 6: 'every 6th beat', 8: 'every 8th beat' };
const BEATS = 12;
const PLAIN = { density: 1, scale: 1, turn: 0 };
const RATIO = 1.2;
const TAU = Math.PI * 2;

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

/* ---- shared ground ------------------------------------------------------------------------- */

function background(g, w, h, c) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// The chamber's dust: specks where the configuration puts them. They stand still: nothing in them
// waits for anything, so nothing in them moves.
function dust(g, w, h, c, v) {
  const count = Math.max(10, Math.round(36 * v.density));
  g.fillStyle = c.alpha(c.colors.muted, 0.14);
  for (let i = 0; i < count; i++) {
    g.fillRect((i * 127.3 + v.turn * 211) % w, (i * 79.7 + v.turn * 97) % h, 1.2, 1.2);
  }
}

// The visitor's own sky, faint, behind a scene that is not made of it.
function skyDots(g, w, h, c, v) {
  const pts = typeof c.points === 'function' ? c.points(w, h, 10) : [];
  g.fillStyle = c.alpha(c.colors.fg, 0.16);
  for (const p of pts) {
    g.beginPath();
    g.arc(p.x, p.y, Math.max(0.8, Math.min(w, h) * 0.004 * v.scale), 0, TAU);
    g.fill();
  }
}

// The face words are set in, set only when it is not the one the canvas already holds: setting a
// canvas's font, even to the face it has, makes the browser bring the page's style up to date
// first, and the chamber labels every star, beat and voice, so a picture sets it once for each size
// rather than once for each word. A canvas spells a face back in its own way (700 as 'bold', a size
// cut to a few places), so the canvas is asked whether it holds the face as it spelled it when it
// was first set here: a canvas resized back to its defaults, or restored to a face it saved, is
// never mistaken. Only a few dozen spellings are kept, so a feed of many cards does not gather
// them.
const spelled = new Map();
function face(g, font) {
  if (g.font === (spelled.get(font) || font)) return;
  g.font = font;
  if (spelled.size >= 48) spelled.clear();
  spelled.set(font, g.font);
}

function caption(g, w, c, text, x, y, a, size, align) {
  if (!text || a <= 0) return;
  g.fillStyle = c.alpha(c.colors.fg, a);
  face(g, '500 ' + size + 'px system-ui, sans-serif');
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/* ---- the rite: how the chamber moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece, the same object) is the piece's own roll of how it moves
   (js/variant.js; js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the
   piece's slice or curve, its signature -- for any surface that changes, never a fade, a flat wash
   or a pattern.

   In the echo order a star chosen on the scene has its halo cut in, and given back the same way,
   the region shrinking, when the choice is undone. On a piece whose edge is a curve the halo grows
   round the point the visitor pressed, so the two shades it rests in are split round that point; on
   a piece whose edge is a slice it is cut at the piece's angle. A hint's ring steps out in treads
   and its word is cut on at its moment; the order written at the foot of the room, and the number a
   chosen star wears, are replaced at one moment, the old standing until the new is cut on. Solved,
   the room takes the pulse's colour by its area and the pulse goes out once: one tread for each
   star, landing on them in the order their echoes come back, so the run is the answer said in
   steps, and then it rests on the farthest. A star the ring lands on lights -- its glow cut in by
   the ring's own curve round the mark (or the piece's slice), its echo ring stepping out in the
   same treads -- and stays lit. Before a solve the only thing that moves of itself is the mark's
   breath, a ring no larger than a control stepping out from the mark's own ring and released, for
   the first few laps the room is open (BREATHS), because the mark is waiting to be sent: that is
   long enough to say where the pulse will leave from, and then the mark holds its own ring and the
   room is still, so a room left waiting costs nothing. The dust and the sky stand still.

   In the midnight chord a picked voice's row has a band cut in, from the row's name (the name the
   rail's item shares) on a piece whose edge is a curve, and given back the same way when it is
   unpicked; its beats turn full or hollow at one moment. The hollow circles of the visitor's own
   totals are replaced at one moment of a new pick, the old standing until the new are cut on. A
   voice a hint has named has its word cut on at its moment. Solved, the strip and the sounding rows
   take the voices' colour by their area. The blocks stand: they are the puzzle.

   Every change is read against the piece's own clock: prog() says how far it has come, which is 1
   at once for a visitor who asked for less motion. Each thing that moves has a roll of its own
   (roll(), rite.at underneath), so no two step alike and every one cuts the way the piece does, and
   a change made while another is still under way goes on from where that one stood, one way. A
   frame with nothing new in it is not drawn at all (settled, below), and once nothing is on its
   way frame() says the room is at rest (it returns false) and the stage asks for no more frames
   until the visitor acts, the scene is sized again or it comes back into view. */

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

function riteOf(c) {
  return c && c.rite ? c.rite : STILL;
}

// The roll a thing moves on: the piece's rite crossed with the thing's own seed. Kept with the rite
// it came from, so a frame reuses a roll rather than making it afresh; a choice made and undone over
// and over makes a new seed each time, so the keeping is let go now and then.
const ROLLS = new WeakMap();
function roll(rite, seed) {
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

function fract(x) {
  return x - Math.floor(x);
}

// Where a thing that happened at `at` on the piece's clock stands in a rite `dur` seconds long:
// 0 before it, 1 once it is over, and 1 at once when less motion is asked for.
function prog(c, time, at, dur) {
  if (at == null || at < 0) return 0;
  if (c.reduced) return 1;
  return clamp((time - at) / dur, 0, 1);
}

/* A mark is a surface set (on) or unset at `at`, for the n-th time, on a roll of its own (seed
   base + n), over `dur` seconds: { on, at, n, base, dur, was, token, before, point }. Its coverage
   steps from `was` -- what stood on the screen when it was made -- to 1 when it is set and to 0 when
   it is unset, so a choice undone half way in shrinks from where it had got to, never from whole.
   Its token (a star's number in the taps, whether a voice's beats are full) is cut on at one moment
   of its roll, and until then the token that stood there when it was made (`before`) stands.
   `point` is where it was pressed, when it was. */
function ownRoll(rite, mark) {
  return roll(rite, mark.base + (mark.n % 64));
}

function shownCover(c, rite, time, mark) {
  if (!mark) return 0;
  const k = ownRoll(rite, mark).stair(prog(c, time, mark.at, mark.dur));
  return mark.was + ((mark.on ? 1 : 0) - mark.was) * k;
}

function shownToken(c, rite, time, mark) {
  if (!mark) return null;
  return ownRoll(rite, mark).flicker(prog(c, time, mark.at, mark.dur)) ? mark.token : mark.before;
}

// A surface set (on) or unset at `time`, after `mark`. A surface that is part way through a change
// keeps the point it is changing round; only a clear one takes a new press point.
function remark(c, rite, time, mark, on, base, dur, token, point) {
  const was = shownCover(c, rite, time, mark);
  return {
    on, at: time, n: mark ? mark.n + 1 : 0, base, dur, token,
    was,
    before: shownToken(c, rite, time, mark),
    point: was > 0 && mark ? mark.point : point
  };
}

// The part of a box the edge has passed at coverage k, added to g's path. Usually the piece's own
// edge across the box (rite.region). But on a piece whose edge is a curve, a surface that has a
// point of its own -- `from`: where it was pressed, or where what changes it comes from -- is cut by
// a circle round that point instead, from `from.near` (the nearest the surface comes to it) at k = 0
// to `from.far` (the farthest) at 1. One path either way.
function passed(g, rite, x, y, w, h, k, from) {
  if (k <= 0) return;
  if (from && rite.kind === 'curve') {
    const r = from.near + (from.far - from.near) * Math.min(1, k);
    g.moveTo(from.x + r, from.y);
    g.arc(from.x, from.y, r, 0, TAU);
    return;
  }
  rite.region(g, x, y, w, h, k);
}

// A point for passed(): (px, py) brought inside the box, so the curve starts on the side it was
// pressed on, reaching the box's farthest corner at the end.
function within(px, py, x, y, w, h) {
  const ox = clamp(px, x, x + w);
  const oy = clamp(py, y, y + h);
  const far = Math.max(Math.hypot(x - ox, y - oy), Math.hypot(x + w - ox, y - oy), Math.hypot(x - ox, y + h - oy), Math.hypot(x + w - ox, y + h - oy));
  return { x: ox, y: oy, near: 0, far };
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the edge
// has passed, and over the half behind the edge's middle a second coat of the same colour. One edge
// moves while it comes or goes, and at rest it is two shades of one colour split by that edge --
// through the middle of the box, or round the surface's own point. One path per coat.
function cover(g, rite, x, y, w, h, k, from) {
  if (k <= 0 || w <= 0 || h <= 0) return;
  if (!from || rite.kind !== 'curve') {
    rite.paint(g, x, y, w, h, k);
    rite.paint(g, x, y, w, h, Math.min(k, 0.5));
    return;
  }
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.beginPath();
  passed(g, rite, x, y, w, h, k, from);
  g.fill();
  g.beginPath();
  passed(g, rite, x, y, w, h, Math.min(k, 0.5), from);
  g.fill();
  g.restore();
}

// The same for a disc round (cx, cy): the cover of its bounding box, clipped to it.
function disc(g, rite, cx, cy, r, k, from) {
  if (k <= 0 || r <= 0) return;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.clip();
  cover(g, rite, cx - r, cy - r, r * 2, r * 2, k, from);
  g.restore();
}

// How many laps the mark breathes when the room opens, three seconds each, before it holds still.
const BREATHS = 3;

// The mark's breath before a solve at `t`: how far its ring has stepped out from the mark's own
// ring, on a stair of its own for each three-second lap -- or -1 when there is no ring to draw: at
// the start of a lap it lies on the mark's own ring, on its last tread it has been released, and
// after the BREATHS laps there is no breath at all.
function breath(rite, t) {
  if (t >= BREATHS * 3) return -1;
  const out = roll(rite, 0xb000 + (Math.floor(t / 3) % 64)).stair(fract(t / 3));
  return out > 0 && out < 1 ? out : -1;
}

function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1);
}

// Whether a frame has nothing to draw: the canvas holds the picture of `look` -- the size it was
// drawn at, the state as the piece was last told it (s.v counts the changes), and where anything
// that moves of itself has stepped to -- and that picture was drawn after every change had come the
// whole of its way (`until`, on the piece's clock), or at once for a visitor who asked for less
// motion. A room at rest stands still, so drawing it again would spend a frame on nothing a visitor
// could see; a new size (the stage clears the canvas to resize it), a new change or a new tread
// draws again. The stage asks for no frames while the scene is out of sight, and the piece's clock
// stops with them, so a change made then is still owed its picture when the scene comes back.
function settled(s, c, look, until) {
  return s.drawn === look && (!!c.reduced || s.drawnAt > until + 0.05);
}

function lcmOf(list) {
  return list.reduce((acc, p) => acc * p / gcd(acc, p), 1);
}

/* ---- the echo order ------------------------------------------------------------------------ */

// Whether a point can join the stars: not too near the mark, not too far, clear of the others,
// and at a distance from the mark that differs from every other star's by the ratio.
function fitsEcho(p, source, chosen) {
  const d = dist(p, source);
  if (d < 0.1 || d > 0.62) return false;
  for (const q of chosen) {
    if (dist(p, q) < 0.09) return false;
    const dq = dist(q, source);
    if (Math.max(d, dq) < RATIO * Math.min(d, dq)) return false;
  }
  return true;
}

function byDistance(plan) {
  return plan.stars.map((s, i) => i).sort((a, b) => dist(plan.stars[a], plan.source) - dist(plan.stars[b], plan.source));
}

function isIdentity(list) {
  return list.every((v, i) => v === i);
}

function echoPlan(env) {
  const n = env.chance(0.5) ? 5 : 4;
  const source = { x: round3(0.3 + env.rnd() * 0.4), y: round3(0.32 + env.rnd() * 0.36) };
  const candidates = [];
  for (const s of (env.stars || [])) {
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    candidates.push({ x: round3(clamp(x / 100, 0.08, 0.92)), y: round3(clamp(y / 100, 0.1, 0.9)), sky: 1 });
  }
  for (let i = 0; i < 30; i++) candidates.push({ x: round3(0.08 + env.rnd() * 0.84), y: round3(0.1 + env.rnd() * 0.8), sky: 0 });
  let chosen = [];
  for (const p of candidates) {
    if (chosen.length >= n) break;
    if (fitsEcho(p, source, chosen)) chosen.push(p);
  }
  if (chosen.length < 4) {
    // A sky and a seed that would not settle: a fixed spiral that always does.
    source.x = 0.5;
    source.y = 0.5;
    chosen = [];
    for (let i = 0; i < n; i++) {
      const r = 0.12 * Math.pow(1.25, i);
      const a = i * 2.4;
      chosen.push({ x: round3(0.5 + Math.cos(a) * r), y: round3(0.5 + Math.sin(a) * r), sky: 0 });
    }
  }
  // The letters: a shuffle of the stars that is not already the answer.
  let stars = chosen.slice();
  for (let guard = 0; guard < 10 && isIdentity(byDistance({ source, stars })); guard++) {
    stars = [];
    const rest = chosen.slice();
    while (rest.length) stars.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  }
  if (isIdentity(byDistance({ source, stars }))) stars.reverse();
  return { kind: 'echo', source, stars };
}

function carriedEcho(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'echo' || !p.source || !Array.isArray(p.stars)) return null;
  const inFrame = (q) => q && typeof q === 'object' && isFinite(Number(q.x)) && isFinite(Number(q.y))
    && Number(q.x) >= 0 && Number(q.x) <= 1 && Number(q.y) >= 0 && Number(q.y) <= 1;
  if (!inFrame(p.source) || p.stars.length < 4 || p.stars.length > 5 || !p.stars.every(inFrame)) return null;
  const source = { x: Number(p.source.x), y: Number(p.source.y) };
  const stars = p.stars.map((s) => ({ x: Number(s.x), y: Number(s.y), sky: s.sky ? 1 : 0 }));
  for (let i = 0; i < stars.length; i++) {
    const di = dist(stars[i], source);
    if (di < 0.05) return null;
    for (let j = i + 1; j < stars.length; j++) {
      const dj = dist(stars[j], source);
      if (Math.max(di, dj) < 1.1 * Math.min(di, dj)) return null;
    }
  }
  const plan = { kind: 'echo', source, stars };
  if (isIdentity(byDistance(plan))) return null;
  return plan;
}

function echoTitle(plan) {
  return 'the echo order: ' + WORDS[plan.stars.length] + ' stars answer';
}

function echoGeometry(w, h) {
  const side = Math.min(w, h);
  return { side, x0: (w - side) / 2, y0: (h - side) / 2 };
}

// The scene. `s` is the live state: the visitor's order, the stars shown by hints, taps made on
// the scene, and the pulse's run after a solve.
function drawEcho(g, w, h, c, plan, s, variant, t) {
  const v = variant || PLAIN;
  const col = c.colors;
  const geo = echoGeometry(w, h);
  const at = (p) => ({ x: geo.x0 + p.x * geo.side, y: geo.y0 + p.y * geo.side });
  const S = at(plan.source);
  const order = byDistance(plan);
  const far = dist(plan.stars[order[order.length - 1]], plan.source);
  const size = Math.max(10, Math.round(geo.side * 0.045));
  background(g, w, h, c);
  dust(g, w, h, c, v);
  skyDots(g, w, h, c, v);
  // The rings: one every twentieth of the room, out past the farthest star, unnumbered.
  const step = 0.05;
  g.lineWidth = 1;
  for (let r = step; r <= far + step; r += step) {
    g.strokeStyle = c.alpha(col.muted, 0.08 + 0.07 * v.density);
    g.beginPath();
    g.arc(S.x, S.y, r * geo.side, 0, TAU);
    g.stroke();
  }
  const rite = riteOf(c);
  const marks = s.marks || {};
  // The solved room takes the pulse's colour by its area: cut in across the room -- round the mark
  // the pulse leaves from, on a piece whose edge is a curve -- and resting in two shades split by
  // that edge.
  const washed = prog(c, t, s.doneAt, 2.6);
  if (washed > 0) {
    const own = roll(rite, 0xa5);
    g.fillStyle = c.alpha(col.accent2, 0.1);
    cover(g, own, geo.x0, geo.y0, geo.side, geo.side, own.stair(washed), within(S.x, S.y, geo.x0, geo.y0, geo.side, geo.side));
  }
  // The mark the pulse leaves from.
  const mr = Math.max(3, geo.side * 0.014 * v.scale);
  // The pulse. After a solve it goes out once (see frame()): it stands on the star it last landed
  // on, and before its first tread it is not drawn. Before a solve the mark breathes: a ring
  // stepping out from the mark's own ring to the edge of its glow, dimming in the same treads, and
  // released on the last, for the first BREATHS laps the room is open -- no larger than a control,
  // and the only thing in the room that moves of itself, because the mark is waiting to be sent.
  // Less motion: no breath at all.
  const reach = s.pulse;
  if (reach > 0) {
    g.strokeStyle = c.alpha(col.accent2, 0.55);
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(S.x, S.y, reach * geo.side, 0, TAU);
    g.stroke();
  } else if (reach < 0 && !c.reduced) {
    const out = breath(rite, t);
    if (out > 0) {
      g.strokeStyle = c.alpha(col.accent2, 0.5 - 0.4 * out);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(S.x, S.y, mr * (2.2 + 1.8 * out), 0, TAU);
      g.stroke();
    }
  }
  const glow = g.createRadialGradient(S.x, S.y, mr * 0.4, S.x, S.y, mr * 4);
  glow.addColorStop(0, c.alpha(col.accent2, 0.5));
  glow.addColorStop(1, c.alpha(col.accent2, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(S.x, S.y, mr * 4, 0, TAU);
  g.fill();
  g.fillStyle = col.accent2;
  g.beginPath();
  g.arc(S.x, S.y, mr, 0, TAU);
  g.fill();
  g.strokeStyle = c.alpha(col.accent2, 0.9);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(S.x, S.y, mr * 2.2, 0, TAU);
  g.stroke();
  // The stars, lettered. A star the pulse has landed on is lit: its glow is cut in from the moment
  // the ring lands -- by the ring's own curve round the mark, passing over the star from the side
  // that faces it, on a piece whose edge is a curve -- and its echo ring steps out from it in the
  // same treads. The stars it landed on before stay lit.
  const landed = s.tread > 0 ? order[s.tread - 1] : -1;
  const since = c.reduced ? 1 : clamp(((s.played || 0) - (s.treadAt || 0)) / 0.5, 0, 1);
  face(g, '600 ' + size + 'px system-ui, sans-serif');
  g.textBaseline = 'middle';
  plan.stars.forEach((star, i) => {
    const p = at(star);
    const d = dist(star, plan.source);
    const r = Math.max(2.5, geo.side * (0.011 + (star.sky ? 0.003 : 0)) * v.scale);
    // The tap halo: a star chosen on the scene is marked by its area, the halo cut in round where
    // it was pressed when it is chosen and given back the same way when the choice is undone.
    const tap = marks['tap' + i];
    const halo = shownCover(c, rite, t, tap);
    if (halo > 0) {
      const R = r * 3.6;
      g.fillStyle = c.alpha(col.accent, 0.3);
      disc(g, rite, p.x, p.y, R, halo, tap.point ? pressedIn(p, R, tap.point.x * geo.side, tap.point.y * geo.side) : null);
    }
    const lit = reach > 0 && reach >= d - 1e-9;
    const shine = lit ? (i === landed ? roll(rite, 0xec00 + i).stair(since) : 1) : 0;
    if (shine > 0) {
      const Rg = r * 2.8;
      const dS = Math.hypot(p.x - S.x, p.y - S.y);
      g.fillStyle = c.alpha(col.accent2, 0.4);
      disc(g, rite, p.x, p.y, Rg, shine, { x: S.x, y: S.y, near: Math.max(0, dS - Rg), far: dS + Rg });
      g.strokeStyle = c.alpha(col.accent2, 0.6 - 0.3 * shine);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(p.x, p.y, r + shine * geo.side * 0.05, 0, TAU);
      g.stroke();
    }
    g.fillStyle = shine > 0 ? col.accent2 : c.alpha(col.fg, 0.95);
    g.beginPath();
    g.arc(p.x, p.y, r, 0, TAU);
    g.fill();
    g.strokeStyle = c.alpha(col.accent, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(p.x, p.y, r * 2, 0, TAU);
    g.stroke();
    const lx = p.x + (p.x > S.x ? 1 : -1) * r * 3.2;
    g.fillStyle = c.alpha(col.fg, 0.92);
    g.textAlign = p.x > S.x ? 'left' : 'right';
    g.fillText(LETTERS[i], lx, p.y - r * 2.2);
    if (s.hinted.includes(i)) {
      // A hint is cut on at its moment: its ring, which then steps out in treads, and its word.
      const hintRoll = roll(rite, 0x4100 + i);
      const shown = prog(c, t, marks['hint' + i] ? marks['hint' + i].at : 0, 1.4);
      if (hintRoll.flicker(shown)) {
        g.strokeStyle = c.alpha(col.accent2, 0.9);
        g.lineWidth = 1.5;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.arc(p.x, p.y, r * (2.2 + 1.2 * hintRoll.stair(shown)), 0, TAU);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = col.accent2;
        g.fillText(ORDINAL[order.indexOf(i)], lx, p.y + r * 2.4);
      }
    }
    // A star's place in the taps: cut on at its mark's moment, and kept until the moment of the
    // mark that undoes it.
    const place = shownToken(c, rite, t, tap);
    if (place != null && place >= 0) {
      g.fillStyle = col.accent;
      g.fillText(String(place + 1), lx, p.y + r * 2.4);
    }
  });
  // The order as it stands, written along the foot of the room. A new order replaces the old at
  // one moment: the old line stands until the new one is cut on.
  const shownOrder = orderShown(c, rite, t, s);
  const line = shownOrder ? shownOrder.map((i) => LETTERS[i]).join('  ') : '';
  if (line) caption(g, w, c, line, w / 2, geo.y0 + geo.side * 0.955, 0.85, size);
}

// Where a star's halo is cut round: the press, `dx`, `dy` from the star's centre, brought inside
// the halo's rim, and the curve reaching the far side of the halo at the end.
function pressedIn(p, R, dx, dy) {
  const d = Math.hypot(dx, dy);
  const f = d > R ? R / d : 1;
  return { x: p.x + dx * f, y: p.y + dy * f, near: 0, far: d * f + R };
}

// The order written at the foot of the room at `time`: the newest from its roll's moment, and
// until then the line that stood there when it was set.
function orderShown(c, rite, time, s) {
  if (s.orderAt == null) return s.order;
  return roll(rite, 0x0d00 + ((s.orders || 0) % 64)).flicker(prog(c, time, s.orderAt, 0.9)) ? s.order : s.orderWas;
}

// marks: the surfaces that are set or unset -- 'tap<i>' for a star chosen on the scene (a mark,
// above, whose token is the star's place in the taps), 'hint<i>' { on, at, dur } for one a hint
// has shown -- on the piece's clock; orderAt when the order was last set (orderWas the line that
// stood when it was, orders how many times), doneAt when the piece solved. After a solve, pulse is
// how far the ring has gone (-1 before one), played the time since, and tread the star it last
// landed on, treadAt when. v counts the changes the piece has been told of, drawn and drawnAt the
// look of the last picture and when it was drawn. A card has none of them.
function echoBlank(plan) {
  return {
    order: null, orderWas: null, orderAt: null, orders: 0, hinted: [], taps: [], marks: {},
    pulse: -1, played: 0, tread: 0, treadAt: 0, doneAt: null, v: 0, drawn: null, drawnAt: -1
  };
}

function echoPreview(g, w, h, env, plan, t) {
  drawEcho(g, w, h, env, plan, echoBlank(plan), env.variant, t || 0);
}

function echoPiece(env, plan) {
  const n = plan.stars.length;
  const helps = asked(env).helps;
  const order = byDistance(plan);
  const s = echoBlank(plan);
  s.order = plan.stars.map((star, i) => i);
  let time = 0;
  // What the picture shows: its size, the changes it was told of, the pulse's tread, and the
  // breath's while the mark waits (settled, above).
  const look = (c) => sizeOf(c) + '|' + s.v + '|' + s.tread + '|' + (s.pulse < 0 && !c.reduced ? breath(riteOf(c), time) : '');
  const draw = (c) => {
    drawEcho(c.g, c.w, c.h, c, plan, s, env.variant, time);
    s.drawn = look(c);
    s.drawnAt = time;
  };
  // The pulse after a solve goes out once: it holds at the mark, then steps out one tread for each
  // star, landing on them in the order their echoes come back -- four or five treads, the answer
  // said in steps -- and rests on the farthest.
  const reaches = order.map((i) => dist(plan.stars[i], plan.source));
  const run = 1 + n;
  // When the last change made comes the whole of its way, on the piece's clock.
  function until() {
    let last = -Infinity;
    for (const key in s.marks) last = Math.max(last, s.marks[key].at + s.marks[key].dur);
    if (s.orderAt != null) last = Math.max(last, s.orderAt + 0.9);
    if (s.doneAt != null) last = Math.max(last, s.doneAt + Math.max(2.6, run + 0.5));
    return last;
  }
  function rightPlaces() {
    let right = 0;
    for (let i = 0; i < n; i++) if (s.order[i] === order[i]) right += 1;
    return right;
  }
  // Which stars are chosen on the scene: a star newly in the taps is set (round where it was
  // pressed, if it was the one pressed), and the marks of those no longer in them come down.
  function markTaps(c, pressed) {
    const rite = riteOf(c);
    for (let i = 0; i < n; i++) {
      const on = s.taps.includes(i);
      const m = s.marks['tap' + i];
      if (on && !(m && m.on)) {
        const point = pressed && pressed.i === i ? pressed.point : null;
        s.marks['tap' + i] = remark(c, rite, time, m, true, 0x7a00 + i * 64, 0.9, s.taps.indexOf(i), point);
      } else if (!on && m && m.on) {
        s.marks['tap' + i] = remark(c, rite, time, m, false, 0x7a00 + i * 64, 0.9, null, m.point);
      }
    }
    s.v += 1;
  }
  // A new order for the line at the foot of the room; the same order again changes nothing.
  function setOrder(next, c) {
    if (s.order && next.length === s.order.length && next.every((v, i) => v === s.order[i])) return;
    s.orderWas = orderShown(c, riteOf(c), time, s);
    s.order = next;
    s.orderAt = time;
    s.orders += 1;
    s.v += 1;
  }
  return {
    title: echoTitle(plan),
    brief: 'A calling, answered in turn. A pulse leaves the bright mark and every star sends an echo back; the farther the star, the later its echo. '
      + 'The rings round the mark are evenly spaced. Tap the stars in order on the scene, or arrange them on the rail.',
    goal: 'Put the stars in the order their echoes come back.',
    aspect: '1 / 1',
    checkLabel: 'send the pulse',
    steps: [
      { id: 'order', ask: 'the stars, first echo back to last', kind: 'order', items: plan.stars.map((star, i) => ({ label: 'star ' + LETTERS[i], value: i })) },
      { id: 'hint', ask: 'where one star comes back', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: order.slice() },
    check(c) {
      const right = rightPlaces();
      return {
        solved: right === n,
        say: right === n ? 'every echo comes back in the order you set'
          : (right === 0 ? 'none of them answers in the right place yet' : WORDS[right] + ' of ' + WORDS[n] + ' answering in the right place')
      };
    },
    start(c) {
      c.status('the mark, and ' + WORDS[n] + ' stars; tap them first echo to last');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === n) {
        setOrder(value.map(Number), c);
        s.taps = [];
        markTaps(c);
        c.status('first back to last: ' + s.order.map((i) => LETTERS[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? order.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== order.indexOf(i))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.marks['hint' + next] = { on: true, at: time, dur: 1.4 };
          s.v += 1;
          c.hint();
          c.status('star ' + LETTERS[next] + ' comes back ' + ORDINAL[order.indexOf(next)]);
        } else if (s.hinted.length >= helps) {
          c.status('that is all the chamber will show at this difficulty; the rest is yours');
        } else {
          c.status('every star you have placed wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = echoGeometry(c.w, c.h);
      const px = x * c.w;
      const py = y * c.h;
      let best = -1;
      let bestD = geo.side * 0.07;
      plan.stars.forEach((star, i) => {
        const d = Math.hypot(geo.x0 + star.x * geo.side - px, geo.y0 + star.y * geo.side - py);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) {
        s.taps = [];
        markTaps(c);
        c.status('tap a star to make it the next echo back');
        draw(c);
        return;
      }
      // Where the press landed, from the star's centre, in fractions of the room's side.
      const star = plan.stars[best];
      const pressed = { i: best, point: { x: (px - geo.x0) / geo.side - star.x, y: (py - geo.y0) / geo.side - star.y } };
      if (s.taps.includes(best)) s.taps = s.taps.slice(0, s.taps.indexOf(best));
      s.taps.push(best);
      if (s.taps.length === n) {
        setOrder(s.taps.slice(), c);
        c.set('order', s.taps.slice());
        s.taps = [];
        c.status('first back to last: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; send the pulse');
      } else {
        c.status('star ' + LETTERS[best] + ' comes back ' + ORDINAL[s.taps.length - 1] + '; ' + WORDS[n - s.taps.length] + ' more to tap');
      }
      markTaps(c, pressed);
      draw(c);
    },
    frame(t, dt, c) {
      time += Math.max(0, dt);
      if (c.done) {
        // Where the pulse stands: the tread of its run it has reached, 0 at the mark to n on the
        // farthest star, where it rests. A visitor who asked for less motion sees the run's end.
        s.played += Math.max(0, dt);
        const tread = c.reduced ? n : roll(riteOf(c), 0x7e00).series(s.played / run, n);
        if (tread !== s.tread) {
          s.tread = tread;
          s.treadAt = s.played;
        }
        s.pulse = s.tread > 0 ? reaches[s.tread - 1] : 0;
      }
      if (!settled(s, c, look(c), until())) draw(c);
      // At rest (false) once the pulse has gone out and rested on the farthest star, the mark has
      // breathed its laps, and the picture on the canvas is the finished one.
      return (c.done && s.tread < n) || (s.pulse < 0 && !c.reduced && time < BREATHS * 3)
        || !settled(s, c, look(c), until());
    },
    end(c) {
      s.pulse = 0;
      s.played = 0;
      s.tread = 0;
      s.treadAt = 0;
      s.doneAt = time;
      s.v += 1;
      c.status('the echoes come back ' + order.map((i) => LETTERS[i]).join(', ') + '; the pulse went out to the farthest star and rests there');
      draw(c);
    }
  };
}

/* ---- the midnight chord -------------------------------------------------------------------- */

// The total per beat when `voices` (periods) sound: each on beat 0 and every period after.
function sumsOf(voices) {
  const bars = new Array(BEATS).fill(0);
  for (const p of voices) for (let b = 0; b < BEATS; b += p) bars[b] += 1;
  return bars;
}

// Whether no other set of voices makes the same bars: every non-empty subset is tried.
function uniqueChord(voices, periods = PERIODS) {
  const want = sumsOf(voices).join('');
  let hits = 0;
  for (let mask = 1; mask < (1 << periods.length); mask++) {
    const subset = periods.filter((p, i) => mask & (1 << i));
    if (sumsOf(subset).join('') === want) hits += 1;
  }
  return hits === 1;
}

function chordPlan(env) {
  const choices = PERIOD_POOL.slice();
  const periods = [];
  while (periods.length < 4) periods.push(choices.splice(env.int(0, choices.length - 1), 1)[0]);
  periods.sort((a, b) => a - b);
  for (let attempt = 0; attempt < 20; attempt++) {
    const count = env.int(1, 3);
    const pool = periods.slice();
    const voices = [];
    while (voices.length < count) voices.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
    voices.sort((a, b) => a - b);
    if (uniqueChord(voices, periods)) return { kind: 'chord', voices, periods };
  }
  return { kind: 'chord', voices: periods.slice(0, 2), periods };
}

function carriedChord(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'chord' || !Array.isArray(p.voices) || p.voices.length < 1 || p.voices.length > 3) return null;
  if (p.periods != null && !Array.isArray(p.periods)) return null;
  const periods = p.periods == null ? PERIODS.slice() : p.periods.map(Number);
  if (periods.length !== 4 || new Set(periods).size !== 4 || !periods.every((v) => PERIOD_POOL.includes(v))) return null;
  periods.sort((a, b) => a - b);
  const voices = p.voices.map(Number);
  if (!voices.every((v) => periods.includes(v)) || new Set(voices).size !== voices.length) return null;
  voices.sort((a, b) => a - b);
  if (!uniqueChord(voices, periods)) return null;
  return { kind: 'chord', voices, periods };
}

function chordTitle(plan) {
  const strikes = sumsOf(plan.voices).reduce((a, b) => a + b, 0);
  return 'the midnight chord: ' + WORDS[strikes] + ' strikes';
}

function chordGeometry(w, h) {
  const left = w * 0.3;
  const right = w * 0.95;
  return { left, right, col: (right - left) / BEATS, stripTop: h * 0.1, stripBottom: h * 0.5, rowTop: h * 0.6, rowGap: h * 0.095 };
}

// The scene: the strip of totals as stacked blocks, then the four voices' own beats.
function drawChord(g, w, h, c, plan, s, variant, t) {
  const v = variant || PLAIN;
  const col = c.colors;
  const geo = chordGeometry(w, h);
  const periods = plan.periods || PERIODS;
  const bars = sumsOf(plan.voices);
  const size = Math.max(9, Math.round(Math.min(w, h) * 0.04));
  const small = Math.max(8, Math.round(size * 0.85));
  background(g, w, h, c);
  dust(g, w, h, c, v);
  skyDots(g, w, h, c, v);
  const unit = (geo.stripBottom - geo.stripTop) / 4.6;
  // The guides at one to four, so a stack can be read exactly.
  g.lineWidth = 1;
  for (let level = 1; level <= 4; level++) {
    g.strokeStyle = c.alpha(col.muted, 0.1 + 0.08 * v.density);
    g.beginPath();
    g.moveTo(geo.left, geo.stripBottom - level * unit);
    g.lineTo(geo.right, geo.stripBottom - level * unit);
    g.stroke();
  }
  caption(g, w, c, 'total', geo.left - size * 0.6, geo.stripBottom - 2 * unit, 0.7, small, 'right');
  const rite = riteOf(c);
  const marks = s.marks || {};
  // The solved strip: once the chord is found the totals take the voices' colour by their area,
  // cut in by the piece's edge across the strip and resting in two shades split by it.
  const revealed = prog(c, t, s.revealAt, 2.2);
  if (revealed > 0) {
    const own = roll(rite, 0x5e);
    g.fillStyle = c.alpha(col.accent2, 0.12);
    cover(g, own, geo.left, geo.stripTop, geo.right - geo.left, geo.stripBottom - geo.stripTop, own.stair(revealed));
  }
  // The blocks: the totals, standing still. They are what the puzzle is read from, and nothing
  // in them waits for anything. Beside each stack a hollow circle stands at the total the
  // visitor's own picks would make on that beat, so a deduction can be tested against the clue;
  // there are none before the first pick, and a new pick replaces them at one moment (draftShown).
  const draft = draftShown(c, rite, t, s);
  if (draft) caption(g, w, c, 'circles: your totals', (geo.left + geo.right) / 2, geo.stripTop - size * 0.8, 1, small);
  const bw = geo.col * 0.6 * Math.min(1.15, Math.max(0.8, v.scale));
  for (let b = 0; b < BEATS; b++) {
    const x = geo.left + (b + 0.5) * geo.col;
    for (let k = 0; k < bars[b]; k++) {
      const y = geo.stripBottom - (k + 1) * unit;
      g.fillStyle = c.alpha(col.accent, 0.5);
      g.fillRect(x - bw / 2, y + unit * 0.08, bw, unit * 0.84);
      g.strokeStyle = c.alpha(col.accent2, 0.5);
      g.strokeRect(x - bw / 2, y + unit * 0.08, bw, unit * 0.84);
    }
    if (draft) {
      g.strokeStyle = col.fg;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, geo.stripBottom - draft[b] * unit, Math.min(3, geo.col * 0.22), 0, TAU);
      g.stroke();
      // Back to the blocks' width, so the circles are the only thing their cut changes.
      g.lineWidth = 1;
    }
    caption(g, w, c, String(b), x, geo.stripBottom + size * 0.8, 0.7, small);
  }
  g.strokeStyle = c.alpha(col.muted, 0.4);
  g.beginPath();
  g.moveTo(geo.left, geo.stripBottom);
  g.lineTo(geo.right, geo.stripBottom);
  g.stroke();
  // The voices: each on its own row, its beats hollow until it is picked, lit when it is found.
  // A picked row is a set surface: a band is cut in across it when it is picked -- from the row's
  // name, the name the rail's item shares, on a piece whose edge is a curve -- and given back the
  // same way, the region shrinking, when it is unpicked; at rest it is two shades split by the edge.
  // The rows are this chord's four candidates, in order of period. The words a hint has put over
  // a voice's name are written after every row is named, so the canvas's font is set once for the
  // names and once for those words rather than twice for each row.
  const said = [];
  periods.forEach((p, row) => {
    const y = geo.rowTop + row * geo.rowGap;
    const shown = s.shown[p];
    const sounding = plan.voices.includes(p);
    const found = s.reveal && sounding;
    const mark = marks['row' + p];
    const foundRoll = roll(rite, 0x7000 + p);
    const bandY = y - geo.rowGap * 0.32;
    const bandH = geo.rowGap * 0.64;
    // A picked row's beats turn full, and take its tone, at one moment of the pick; an unpicked
    // row's turn hollow at one moment of the unpick -- a single cut each way, and until it the
    // beats stay as they stood. A found row keeps whatever it had until the reveal's moment.
    const pickLit = !!shownToken(c, rite, t, mark);
    const revealOn = found && !!foundRoll.flicker(revealed);
    const tone = revealOn ? col.accent2 : pickLit ? col.accent : col.muted;
    const band = shownCover(c, rite, t, mark);
    if (band > 0) {
      g.fillStyle = c.alpha(col.accent, 0.16);
      cover(g, rite, geo.left, bandY, geo.right - geo.left, bandH, band, within(geo.left, y, geo.left, bandY, geo.right - geo.left, bandH));
    }
    if (found && revealed > 0) {
      g.fillStyle = c.alpha(col.accent2, 0.2);
      cover(g, foundRoll, geo.left, bandY, geo.right - geo.left, bandH, foundRoll.stair(revealed));
    }
    caption(g, w, c, EVERY[p], geo.left - size * 0.6, y, 0.85, small, 'right');
    g.lineWidth = 1.2;
    const full = revealOn || pickLit;
    for (let b = 0; b < BEATS; b += p) {
      const x = geo.left + (b + 0.5) * geo.col;
      const r = Math.max(2, geo.col * 0.2 * Math.min(1.15, Math.max(0.8, v.scale)));
      if (full) {
        g.fillStyle = c.alpha(tone, 0.9);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      } else {
        g.strokeStyle = c.alpha(tone, 0.7);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.stroke();
      }
    }
    // A voice a hint has named says so, over its name, cut on at its moment.
    if (shown && roll(rite, 0x5400 + p).flicker(prog(c, t, marks['shown' + p] ? marks['shown' + p].at : 0, 1.2))) {
      said.push({ text: shown === 'on' ? 'sounds' : 'silent', x: geo.left - size * 0.6, y: y - geo.rowGap * 0.34 });
    }
  });
  if (said.length) {
    g.fillStyle = col.accent2;
    face(g, '600 ' + small + 'px system-ui, sans-serif');
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const word of said) g.fillText(word.text, word.x, word.y);
  }
  g.fillStyle = c.alpha(col.muted, 0.2);
  g.fillRect(geo.left, geo.rowTop - geo.rowGap * 0.6, geo.right - geo.left, 1);
}

// The totals of the visitor's picks drawn at `time`: the newest from its roll's moment, and until
// then the ones that stood when the pick was made -- none before the first pick.
function draftShown(c, rite, time, s) {
  if (s.draftAt == null) return null;
  return roll(rite, 0x5d00 + ((s.drafts || 0) % 64)).flicker(prog(c, time, s.draftAt, 0.8)) ? s.draft : s.draftWas;
}

// marks: 'row<p>' for a voice picked or unpicked (a mark, above, whose token is whether its beats
// are full), 'shown<p>' { on, at, dur } for one a hint has named; draft the totals of the visitor's
// picks, draftAt when they were last set (draftWas the totals that stood when they were, drafts how
// many times); revealAt when the piece solved; v, drawn and drawnAt as in the echo order. A card
// has none of them.
function chordBlank() {
  return {
    picked: [], shown: {}, reveal: false, marks: {}, revealAt: null,
    draft: null, draftWas: null, draftAt: null, drafts: 0, v: 0, drawn: null, drawnAt: -1
  };
}

function chordPreview(g, w, h, env, plan) {
  drawChord(g, w, h, env, plan, chordBlank(), env.variant, 0);
}

function chordPiece(env, plan) {
  const helps = asked(env).helps;
  const periods = plan.periods || PERIODS;
  const voices = plan.voices;
  const meet = lcmOf(voices);
  const s = chordBlank();
  let time = 0;
  const look = (c) => sizeOf(c) + '|' + s.v;
  const draw = (c) => {
    drawChord(c.g, c.w, c.h, c, plan, s, env.variant, time);
    s.drawn = look(c);
    s.drawnAt = time;
  };
  // When the last change made comes the whole of its way, on the piece's clock.
  function until() {
    let last = -Infinity;
    for (const key in s.marks) last = Math.max(last, s.marks[key].at + s.marks[key].dur);
    if (s.draftAt != null) last = Math.max(last, s.draftAt + 0.8);
    if (s.revealAt != null) last = Math.max(last, s.revealAt + 2.2);
    return last;
  }
  const named = (list) => list.map((p) => EVERY[p]).join(', ');
  // On a period's first beat, only it and shorter periods can contribute.
  const reveal = periods.slice().sort((a, b) => a - b);
  return {
    title: chordTitle(plan),
    brief: 'Find which voices make the chord. The four candidates strike on beat 0 and then ' + named(periods) + '. Filled blocks show the clue; hollow circles show the totals of your selection. Totals for beats 0 to 11: ' + sumsOf(voices).join(', ') + '. The next shared beat may lie beyond the strip.',
    goal: 'Say which voices are sounding, and on which beat after beat 0 they next all strike together.',
    aspect: '4 / 3',
    checkLabel: 'check the chord',
    steps: [
      { id: 'voices', ask: 'the voices that are sounding', kind: 'pick', items: periods.map((p) => ({ label: EVERY[p], value: p })) },
      { id: 'meet', ask: 'the first beat after 0 on which every sounding voice strikes at once', kind: 'number', min: 2, max: 120, step: 1, unit: 'beat' },
      { id: 'hint', ask: 'whether one voice is sounding', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { voices: voices.slice(), meet },
    check(c) {
      const chosen = Array.isArray(c.value('voices')) ? c.value('voices').map(Number) : [];
      const right = chosen.filter((p) => voices.includes(p)).length;
      const extra = chosen.length - right;
      const missing = voices.length - right;
      const pickRight = extra === 0 && missing === 0 && new Set(chosen).size === chosen.length;
      const beat = Number(c.value('meet'));
      const meetRight = Number.isInteger(beat) && beat === meet;
      if (pickRight && meetRight) return { solved: true, say: 'the chord is ' + named(voices) + ', together again on beat ' + meet };
      const parts = [];
      if (!pickRight) {
        const wanted = sumsOf(voices);
        const draft = sumsOf(chosen.filter((p) => periods.includes(p)));
        const matching = wanted.filter((total, b) => total === draft[b]).length;
        parts.push(matching + ' of ' + BEATS + ' beat totals match your selection');
      }
      if (!meetRight) {
        if (!Number.isInteger(beat) || beat < 2 || beat > 120) parts.push('choose a whole beat from 2 to 120');
        else {
          const striking = voices.filter((p) => beat % p === 0).length;
          parts.push(striking === voices.length ? 'all sounding voices strike there, but they meet sooner'
            : striking + ' of ' + voices.length + ' sounding voices strike on that beat');
        }
      }
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('twelve beats, four possible voices; compare your selection with the filled blocks');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'voices' && Array.isArray(value)) {
        s.picked = value.map(Number).filter((p) => periods.includes(p));
        // The circles of the visitor's totals: the new ones are cut on at their moment, and the
        // ones on the screen now stand until then.
        s.draftWas = draftShown(c, riteOf(c), time, s);
        s.draft = sumsOf(s.picked);
        s.draftAt = time;
        s.drafts += 1;
        for (const p of periods) {
          const on = s.picked.includes(p);
          const m = s.marks['row' + p];
          if (on !== !!(m && m.on)) s.marks['row' + p] = remark(c, riteOf(c), time, m, on, 0x6000 + p * 64, 1.1, on, null);
        }
        s.v += 1;
        c.status(s.picked.length ? 'picked: ' + named(s.picked) : 'no voice picked');
      }
      if (id === 'meet') {
        const b = Number(value);
        if (Number.isFinite(b)) c.status('together again on beat ' + Math.round(b) + ', you say');
      }
      if (id === 'hint') {
        const given = reveal.filter((p) => s.shown[p]).length;
        const next = given < helps ? reveal.find((p) => !s.shown[p]) : undefined;
        if (next !== undefined) {
          s.shown[next] = voices.includes(next) ? 'on' : 'off';
          s.marks['shown' + next] = { on: true, at: time, dur: 1.2 };
          s.v += 1;
          c.hint();
          c.status('beat ' + next + ' has a total of ' + sumsOf(voices)[next] + '. Count the shorter periods already shown: the voice on ' + EVERY[next] + ' is ' + (s.shown[next] === 'on' ? 'sounding' : 'silent'));
        } else if (given >= helps) {
          c.status('that is all the chamber will show at this difficulty; read the rest off the strip');
        } else {
          c.status('every voice has been shown; the meeting beat is yours to work out');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      time += Math.max(0, dt);
      if (!settled(s, c, look(c), until())) draw(c);
      return !settled(s, c, look(c), until());
    },
    end(c) {
      s.reveal = true;
      s.revealAt = time;
      s.v += 1;
      c.status('the chord was ' + named(voices) + '; it strikes whole again on beat ' + meet);
      draw(c);
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
    const echo = env.chance(0.5);
    got = { echo, plan: echo ? echoPlan(env) : chordPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'constellation-echo',
  needsSky: true,
  // The card is a still picture: its mark waits for a pulse a card cannot send, and its stars
  // and blocks wait for nothing, so it has no animate and the feed never repaints it. Where the
  // mark's ring stands is the configuration's.
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.echo) echoPreview(g, w, h, env, d.plan, env.variant.turn * 3);
    else chordPreview(g, w, h, env, d.plan);
  },
  spark(env) {
    const d = deal(env);
    if (d.echo) {
      const plan = d.plan;
      const order = byDistance(plan);
      return {
        title: echoTitle(plan),
        quote: 'a pulse leaves the mark; star ' + LETTERS[order[0]] + ' answers first, or does it?',
        text: 'Every star sends an echo back, the farther the later. Put the ' + WORDS[plan.stars.length] + ' stars in the order their echoes return.',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => echoPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 3),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: chordTitle(plan),
      mono: 'beat   ' + sumsOf(plan.voices).map((n, i) => String(i).padStart(2, ' ')).join('') + '\ntotal  ' + sumsOf(plan.voices).map((n) => String(n).padStart(2, ' ')).join(''),
      text: 'Four voices on periods of ' + (plan.periods || PERIODS).join(', ') + ' beats; some are sounding. Compare your chosen voices with the totals, then find their next shared beat.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => chordPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const echo = carriedEcho(env);
    if (echo) return echoPiece(env, echo);
    const chord = carriedChord(env);
    if (chord) return chordPiece(env, chord);
    const d = deal(env);
    return d.echo ? echoPiece(env, d.plan) : chordPiece(env, d.plan);
  }
};
