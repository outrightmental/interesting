/* The kinetic floor: heavy blocks, a lot of them, nothing breakable -- and on it, three things a
   visitor can work out before anything is allowed to move. As a card it is one of the three puzzles
   below (paint, spark); as a piece it is that puzzle, and the card it was opened from says which.
   See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles, all deduction, each with something to tip at the end:

     will it cross      Four lanes of dominoes, each with one gap. A falling domino reaches across
                        a gap only when the gap is narrower than four fifths of its height. Every
                        lane writes its domino height and its gap width and draws both on one
                        grid; no lane sits within five per cent of the edge, so the arithmetic
                        settles it. Call each lane: stops, or crosses. A wrong check says how many
                        lanes are called right and no more; solved, the chains are tipped.
     the balance point  A weightless plank over a ruler from 0 to 20, with three or four blocks of
                        written mass standing on it at whole numbers. Find where one pivot
                        balances it (the blocks are chosen so the answer is a whole number) and
                        say which way it tips with the pivot at the middle. A clamp holds the
                        plank level until a check; a wrong check lets it tip, which is the whole
                        of the feedback.
     the counterweight  The pivot stays put. Choose one of three hanging weights and its whole-
                        number position to balance two or three fixed blocks. Only one weight
                        has an exact placement. A check measures the imbalance; a limited help
                        breaks the pulls into multiplications. The hanger remains movable after
                        solving, so another placement is another experiment.

   A card and the feature it opens as are one floor: the spark puts the whole plan on its spec as
   `of` -- the lanes, or the blocks and their places with any fixed pivot and weight rack -- and
   piece(env) opens on that rather than rolling another. Cards hold still until opened; their
   plans are cached per env so painting and opening cannot deal different floors. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const REACH = 0.8; // a falling domino crosses a gap narrower than this much of its height
const TIPS = [
  { label: 'tips to the left', value: 'left' },
  { label: 'tips to the right', value: 'right' },
  { label: 'stays level', value: 'level' }
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

/* ---- the rite: how this floor moves --------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes, never a fade, a flat wash or a pattern.
   A domino falls as a thing falls, in treads that grow longer as it goes (the rite's landing,
   played backwards), never along t * t. A lane that has been called is sealed: its band is cut in
   in the colour of the call -- round the point the lane was pressed at, on a piece whose edge is a
   curve, or round the call's own place when it was called from the rail -- and rests in two shades
   split by that edge. A call changed cuts the new colour in over whatever stood there, even a call
   still part way in, which stands wherever the new edge has not passed; the call's badge is cut in
   once and stays, and the word of the call replaces the word that stood there at one moment. A lane
   the hint names has its answer cut on at its moment. The plank turns to its new tilt on an even
   stair, the pivot and the counterweight's hanger walk the ruler in treads, the clamp's jaws are
   cut in by the edge when the clamp goes on and given back the same way, the region shrinking, when
   it comes off -- each from where the last had got to, if it was still under way -- and a new
   caption replaces the one that stood at one moment. The hanging block's fill is cut in by the edge
   with the first mass chosen and rests in two shades; a mass chosen after replaces the one that
   stood -- its number, its size and its mark on the rack together -- at one moment. The light that
   comes over a tipped floor or a balanced plank is cut in by the edge and rests in two shades.
   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less motion
   and for whatever stood there from the start. Every trigger rolls a fresh rite (rite.at(k) with
   the count of that trigger in k), so a second call on a lane, a second check, a second move of the
   pivot or the hanger steps in another rhythm from the first, every roll keeping the piece's edge.
   A frame with nothing new in it is not drawn at all (settled, below), and once nothing is on its
   way frame() answers false, so the stage asks for no frame until the visitor moves something
   again. */

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

// The roll for one trigger: the piece's rite crossed with the trigger's seed (rite.at). Kept with
// the rite it was rolled from, so a frame reuses the rolls it drew with last time rather than
// making a few dozen afresh; the keeping is let go now and then.
const ROLLS = new WeakMap();
function roll(rite, seed) {
  let kept = ROLLS.get(rite);
  if (!kept) {
    kept = new Map();
    ROLLS.set(rite, kept);
  }
  let own = kept.get(seed);
  if (!own) {
    if (kept.size > 128) kept.clear();
    own = rite.at(seed);
    kept.set(seed, own);
  }
  return own;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

function clamp01(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

// The part of a box the edge has passed at coverage k, added to g's path. Usually the piece's own
// edge across the box (rite.region). But on a piece whose edge is a curve, a surface that has a
// point of its own -- `from`: where it was pressed, or where its call is said -- is cut by a circle
// round that point instead, reaching `from.far` at k = 1. One path either way.
function passed(g, rite, x, y, w, h, k, from) {
  if (k <= 0) return;
  if (from && rite.kind === 'curve') {
    const r = from.far * Math.min(1, k);
    g.moveTo(from.x + r, from.y);
    g.arc(from.x, from.y, r, 0, Math.PI * 2);
    return;
  }
  rite.region(g, x, y, w, h, k);
}

// A point for passed(): (px, py) brought inside the box, so the curve starts on the side the box
// was pressed on, and reaches the box's farthest corner at the end.
function within(px, py, x, y, w, h) {
  const ox = Math.max(x, Math.min(x + w, px));
  const oy = Math.max(y, Math.min(y + h, py));
  const far = Math.max(Math.hypot(x - ox, y - oy), Math.hypot(x + w - ox, y - oy), Math.hypot(x - ox, y + h - oy), Math.hypot(x + w - ox, y + h - oy));
  return { x: ox, y: oy, far };
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes or goes, and at rest it is two shades of one colour split
// by that edge -- through the middle of the box, or round the surface's own point. One path per
// coat.
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

// Narrow g's clip to the part of the box the edge has NOT passed at k: what a later colour has
// not yet reached, where an earlier one still shows.
function outside(g, rite, x, y, w, h, k, from) {
  if (k <= 0) return;
  g.beginPath();
  g.rect(x, y, w, h);
  passed(g, rite, x, y, w, h, k, from);
  g.clip('evenodd');
}

// The light that comes over the floor once something has moved: cut in by the piece's edge from
// that moment, in treads, and resting in two shades.
function daybreak(g, rite, env, w, h, p, strength) {
  const own = roll(rite, 0xdb);
  const k = own.stair(p);
  if (k <= 0) return;
  g.fillStyle = env.alpha(env.colors.accent, strength || 0.08);
  cover(g, own, 0, 0, w, h, k);
}

function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1);
}

// Whether a frame has nothing to draw: the canvas holds the picture of `look` -- the size it was
// drawn at and the state as the piece was last told it (s.v counts the changes) -- and that picture
// was drawn after every change had come the whole of its way (`until`, on the piece's clock), or at
// once for a visitor who asked for less motion. The floor at rest stands still, so drawing it again
// would spend a frame on nothing a visitor could see; a new size (the stage clears the canvas to
// resize it) or a new change draws again. The stage asks for no frames while the scene is out of
// sight, and the piece's clock stops with them, so a change made then is still owed its picture
// when the scene comes back.
function settled(s, c, look, until) {
  return s.drawn === look && (!!c.reduced || s.drawnAt > until + 0.05);
}

// One frame: drawn unless it is settled, and answering whether anything is still on its way once
// it has been -- false when the floor is at rest, which tells the stage to stop asking for frames
// until a press, a knob, a check, a new size or the scene coming back into view. Every movement
// here starts from one of those, so nothing waits on a frame that will not come.
function paintFrame(s, c, look, until, draw) {
  if (!settled(s, c, look(c), until())) draw(c);
  return !settled(s, c, look(c), until());
}

// The moment, on the piece's clock, by which a change made at `since` and taking `span` seconds
// has come the whole of its way; -Infinity for one never made.
function over(since, span) {
  return since == null || since < 0 ? -Infinity : since + span;
}

/* ---- shared drawing ------------------------------------------------------------------------ */

function block(g, x, y, bw, bh, angle, fill, stroke) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = fill;
  g.fillRect(-bw / 2, -bh / 2, bw, bh);
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.strokeRect(-bw / 2 + 0.5, -bh / 2 + 0.5, bw - 1, bh - 1);
  }
  g.restore();
}

// The floor's ground: the same gradient the old rig lit. What lights it once something moves is
// daybreak(), by its area, never a brighter gradient.
function ground(g, w, h, env) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg2);
  grad.addColorStop(1, c.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function label(g, text, x, y, size, tone, align, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = tone;
  g.fillText(text, x, y);
}

// How wide `text` is set at `size`, in the face label() sets it in.
function wide(g, text, size, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  return g.measureText(text).width;
}

// A line of words centred at x within `room` pixels: whole on one line where it fits; else broken
// at the space nearest its middle onto two, the second under the first; and set smaller only if a
// line still runs over. Words are never cut off at the canvas's edge or run into what stands
// beside them.
function fitted(g, text, x, y, size, room, tone) {
  if (wide(g, text, size) <= room) {
    label(g, text, x, y, size, tone);
    return;
  }
  const mid = text.length / 2;
  let at = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  const lines = at < 0 ? [text] : [text.slice(0, at), text.slice(at + 1)];
  const widest = Math.max(...lines.map((line) => wide(g, line, size)));
  const set = widest > room ? Math.max(6, Math.floor(size * room / widest)) : size;
  lines.forEach((line, i) => label(g, line, x, y + (i - (lines.length - 1) / 2) * set * 1.15, set, tone));
}

// What stands at a lane's call once the chains have had their time: the count of what fell.
function fellWords(lane, n) {
  return n === lane.n ? 'all ' + n + ' fell' : n + ' of ' + lane.n + ' fell';
}

/* ---- will it cross: four lanes, four gaps --------------------------------------------------- */

function crosses(lane) {
  return lane.g < REACH * lane.h;
}

// How far apart the ordinary dominoes of a lane stand, centre to centre, in grid units: always
// well under the reach, so only the marked gap is ever in question.
function pitch(h) {
  return Math.max(2, Math.min(4, Math.round(h * 0.4)));
}

function lanesPlan(env) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const lanes = [];
    for (let i = 0; i < 4; i++) {
      const h = env.int(4, 10);
      const over = env.chance(0.5);
      // Well away from the edge, by more than five per cent either way: 0.74 of the height or under
      // crosses, 0.86 or over stops.
      const lo = over ? Math.max(1, Math.ceil(h * 0.3)) : Math.ceil(h * 0.86);
      const hi = over ? Math.floor(h * 0.74) : Math.floor(h * 1.3);
      const n = env.int(4, 6);
      lanes.push({ h, g: env.int(lo, hi), n, at: env.int(1, n - 3) });
    }
    if (lanes.some(crosses) && !lanes.every(crosses)) return { kind: 'lanes', lanes };
  }
  return { kind: 'lanes', lanes: [{ h: 8, g: 5, n: 5, at: 2 }, { h: 6, g: 6, n: 5, at: 1 }, { h: 10, g: 9, n: 6, at: 2 }, { h: 5, g: 3, n: 4, at: 1 }] };
}

function carriedLanes(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'lanes' || !Array.isArray(p.lanes) || p.lanes.length !== 4) return null;
  const lanes = [];
  for (const l of p.lanes) {
    if (!l || typeof l !== 'object') return null;
    const h = Number(l.h);
    const g = Number(l.g);
    const n = Number(l.n);
    const at = Number(l.at);
    if (![h, g, n, at].every(Number.isInteger)) return null;
    if (h < 3 || h > 12 || g < 1 || g > 16 || n < 4 || n > 7 || at < 1 || at > n - 3) return null;
    const ratio = g / h;
    if (ratio > 0.75 && ratio < 0.85) return null;
    lanes.push({ h, g, n, at });
  }
  if (!lanes.some(crosses) || lanes.every(crosses)) return null;
  return { kind: 'lanes', lanes };
}

// Where a lane's dominoes stand, in grid units: the left edge of each, and the whole span.
function laneLayout(lane) {
  const p = pitch(lane.h);
  const xs = [];
  let x = 0;
  for (let i = 0; i < lane.n; i++) {
    xs.push(x);
    x += i === lane.at ? 1 + lane.g : p;
  }
  return { xs, span: xs[lane.n - 1] + 1 };
}

function lanesGeometry(w, h, plan, v) {
  const top = h * 0.1;
  const band = h * 0.22;
  const spanMax = Math.max(...plan.lanes.map((l) => laneLayout(l).span));
  const fit = Math.min((w * 0.62) / spanMax, (band * 0.56) / 10);
  return { top, band, x0: w * 0.1, u: fit * Math.min(1.08, Math.max(0.92, v.scale)), spanMax };
}

// Domino i of lane k, `time` seconds after its first was tipped: the angle it has fallen to. A
// domino past a gap the push does not cross never moves; the one before such a gap leans as far
// as the next upright lets it. It falls as a thing falls, gathering pace: in its own roll's
// landing played backwards, so the first tread is the shortest and each after it longer, and
// never along t * t.
function fallAngle(lane, i, time, rite, k) {
  const over = crosses(lane);
  const step = 0.22;
  let start;
  if (i <= lane.at) start = i * step;
  else if (over) start = (lane.at + 1) * step + lane.g * 0.03 + (i - lane.at - 1) * step;
  else return 0;
  const f = clamp01((time - start) / 0.5);
  if (f <= 0) return 0;
  const own = roll(rite, 0x300 + (k || 0) * 16 + i);
  const fell = f >= 1 ? 1 : 1 - own.ease(1 - f);
  const rest = i === lane.at && !over ? (lane.g >= lane.h ? 1 : Math.asin(lane.g / lane.h) / (Math.PI / 2)) : 1;
  return fell * rest * Math.PI / 2;
}

function fallen(lane, time, rite, k) {
  let n = 0;
  for (let i = 0; i < lane.n; i++) if (fallAngle(lane, i, time, rite, k) > 0.01) n += 1;
  return n;
}

// The roll of the call standing on lane k: a fresh one for every call made on it.
function callRoll(s, rite, k) {
  return roll(rite, 0x100 + k * 64 + ((s.changes ? s.changes[k] : 0) % 64));
}

// How far the call standing on lane k has cut its colour in, 0 when none has been made.
function sealOf(s, rite, k, reduced) {
  const at = s.calledAt ? s.calledAt[k] : -1;
  if (at < 0) return 0;
  return callRoll(s, rite, k).stair(came(s, at, 0.9, reduced));
}

// The word standing at lane k's call: 1 crosses, 0 stops, -1 the '?' of no call. The call's own from
// its roll's moment, and until then the word that stood when it was made.
function wordShown(s, rite, k, reduced) {
  const at = s.calledAt ? s.calledAt[k] : -1;
  if (at < 0) return -1;
  return callRoll(s, rite, k).flicker(came(s, at, 0.9, reduced)) ? s.said[k] : s.wordWas[k];
}

function drawLanes(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = lanesGeometry(w, h, plan, v);
  const u = geo.u;
  const size = Math.max(10, Math.min(14, Math.round(Math.min(w, h) * 0.034)));
  const small = Math.max(9, size - 2);
  ground(g, w, h, env);
  // The light over a tipped floor: cut in by the edge from the moment of the tip. A visitor who
  // asked for less motion sees the chains already down.
  const tipped = s.time >= 0 && reduced ? Infinity : s.time;
  if (s.time >= 0) daybreak(g, rite, env, w, h, reduced ? 1 : clamp01(s.time / 1.6), 0.08);
  fitted(g, 'a falling domino crosses a gap narrower than four fifths of its height', w / 2, h * 0.05, small, w - small * 1.2, env.alpha(c.muted, 0.85));
  const every = v.density < 0.9 ? 2 : 1;
  // The call's column, right of the longest lane. Its badge is as wide as the widest words it can
  // sit under -- the call, or the count of what fell -- with a little room either side, so it
  // frames the words and not a few stray letters of them; the column stands at 0.87 of the width,
  // or further in where the badge or the shown answer under it would run off the edge, and the
  // words in it are set smaller only where the column is too narrow to hold them.
  const right = w - small * 0.4;
  const left = geo.x0 + (geo.spanMax + 1.5) * u;
  const counts = plan.lanes.map((lane, k) => wide(g, fellWords(lane, fallen(lane, Infinity, rite, k)), small));
  const badgeW = Math.max(wide(g, 'crosses', size), ...counts) + small * 1.2;
  const need = Math.max(badgeW, wide(g, 'shown: crosses', small));
  const shrink = Math.min(1, (right - left) / need);
  const callX = Math.min(w * 0.87, right - (need * shrink) / 2);
  const callSize = Math.max(6, size * shrink);
  const callSmall = Math.max(6, small * shrink);
  plan.lanes.forEach((lane, k) => {
    const lay = laneLayout(lane);
    const bandTop = geo.top + k * geo.band;
    const floorY = bandTop + geo.band * 0.74;
    const x0 = geo.x0;
    // A called lane is a sealed lane: its band is cut in in the colour of the call and rests in two
    // shades split by the edge -- a fresh roll for every call made on it, cut round the point it
    // was pressed at (or the call's own place) on a piece whose edge is a curve. A call changed cuts
    // its colour in over whatever stood there: every earlier call still showing (s.under, each
    // frozen where it had got to) stands wherever no later one has passed.
    const calledAt = s.calledAt ? s.calledAt[k] : -1;
    const tone = (call) => env.alpha(call ? c.accent : c.muted, 0.14);
    if (calledAt >= 0) {
      const bx = x0 - u;
      const by = bandTop + geo.band * 0.08;
      const bw = (geo.spanMax + 2) * u;
      const bh = geo.band * 0.82;
      const from = (pt) => within(pt ? pt.x * w : callX, pt ? pt.y * h : floorY - u * 2, bx, by, bw, bh);
      const live = sealOf(s, rite, k, reduced);
      const liveFrom = from(s.point[k]);
      const under = s.under[k];
      if (live < 1) {
        under.forEach((layer, i) => {
          g.save();
          for (let j = i + 1; j < under.length; j++) outside(g, rite, bx, by, bw, bh, under[j].k, from(under[j].point));
          outside(g, rite, bx, by, bw, bh, live, liveFrom);
          g.fillStyle = tone(layer.call);
          cover(g, rite, bx, by, bw, bh, layer.k, from(layer.point));
          g.restore();
        });
      }
      g.fillStyle = tone(s.said[k]);
      cover(g, rite, bx, by, bw, bh, live, liveFrom);
    }
    // The grid both measures are drawn to.
    g.strokeStyle = env.alpha(c.accent, 0.085 * v.density);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= geo.spanMax; i += every) {
      g.moveTo(x0 + i * u, floorY - 10 * u);
      g.lineTo(x0 + i * u, floorY);
    }
    for (let j = 0; j <= 10; j += every) {
      g.moveTo(x0, floorY - j * u);
      g.lineTo(x0 + geo.spanMax * u, floorY - j * u);
    }
    g.stroke();
    // The floor line.
    g.strokeStyle = env.alpha(c.muted, 0.6);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0 - u, floorY);
    g.lineTo(x0 + (geo.spanMax + 1) * u, floorY);
    g.stroke();
    // The dominoes, last to first, so the earlier ones lie over the later when they fall.
    const bw = u;
    for (let i = lane.n - 1; i >= 0; i--) {
      const angle = s.time >= 0 ? fallAngle(lane, i, tipped, rite, k) : 0;
      const x = x0 + (lay.xs[i] + 1) * u;
      const bh = lane.h * u;
      const cx = x - bw / 2 * Math.cos(angle) + bh / 2 * Math.sin(angle);
      const cy = floorY - bw / 2 * Math.sin(angle) - bh / 2 * Math.cos(angle);
      const marked = i === lane.at;
      block(g, cx, cy, bw, bh, angle, marked ? c.accent2 : env.mix(c.bg2, c.accent, 0.8), env.alpha(c.fg, 0.85));
      if (marked) {
        // The marked domino carries its fifths, so four fifths of its height can be laid against
        // the gap by eye.
        g.save();
        g.translate(x, floorY);
        g.rotate(angle);
        g.strokeStyle = c.bg;
        g.lineWidth = Math.max(1, u * 0.15);
        g.beginPath();
        for (let j = 1; j <= 4; j++) {
          g.moveTo(-bw * 0.85, -bh * j / 5);
          g.lineTo(-bw * 0.15, -bh * j / 5);
        }
        g.stroke();
        g.restore();
      }
    }
    // The measures, written: the height over the marked domino, the gap under its bracket.
    const mx = x0 + (lay.xs[lane.at] + 0.5) * u;
    label(g, 'height ' + lane.h, mx, Math.max(bandTop + small * 0.6, floorY - lane.h * u - small * 0.8), small, c.accent2);
    const gx0 = x0 + (lay.xs[lane.at] + 1) * u;
    const gx1 = x0 + lay.xs[lane.at + 1] * u;
    const y = floorY + u * 0.5;
    g.strokeStyle = c.accent2;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(gx0, y - u * 0.3);
    g.lineTo(gx0, y);
    g.lineTo(gx1, y);
    g.lineTo(gx1, y - u * 0.3);
    g.stroke();
    label(g, 'gap ' + lane.g, (gx0 + gx1) / 2, y + small * 0.8, small, c.accent2);
    // The push, waiting at the first domino; the lane's number; the call the visitor has made.
    if (s.time < 0) {
      const ax = x0 + Math.sin(v.turn * Math.PI * 2) * u * 0.3;
      const ay = floorY - lane.h * u * 0.6;
      g.strokeStyle = env.alpha(c.fg, 0.8);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(ax - u * 1.6, ay);
      g.lineTo(ax - u * 0.3, ay);
      g.moveTo(ax - u * 0.7, ay - u * 0.35);
      g.lineTo(ax - u * 0.3, ay);
      g.lineTo(ax - u * 0.7, ay + u * 0.35);
      g.stroke();
    }
    label(g, String(k + 1), w * 0.05, floorY - u * 2, size, env.alpha(c.fg, 0.9), 'center', '600');
    // What stands at the call: the count of what fell once the chains have had their time, cut on
    // in place of the word at its moment; else the word of the call, cut on in place of the '?' or
    // of the word that stood when the call was made. Nothing is taken away first: the thing before
    // stands until the moment the thing after is cut on, so the one replaces the other in a single
    // cut.
    const counted = s.time >= 0 && (reduced || s.time > 2.2) ? (reduced ? 1 : clamp01((s.time - 2.2) / 0.7)) : 0;
    const countOn = counted > 0 && roll(rite, 0x400 + k).flicker(counted);
    const badgeAt = s.badgeAt ? s.badgeAt[k] : -1;
    if (badgeAt >= 0) {
      // The call's badge under the word: cut in with the first call, round where that call was
      // made on a piece whose edge is a curve, and there from then on, whatever the call becomes.
      const bw = badgeW * shrink;
      const bh = callSize * 1.5;
      const bx = callX - bw / 2;
      const by = floorY - u * 2 - bh / 2;
      const own = roll(rite, 0x180 + k);
      const pt = s.badgePoint[k];
      g.fillStyle = env.alpha(c.accent2, 0.22);
      cover(g, rite, bx, by, bw, bh, own.stair(came(s, badgeAt, 0.9, reduced)),
        within(pt ? pt.x * w : callX, pt ? pt.y * h : floorY - u * 2, bx, by, bw, bh));
    }
    const word = wordShown(s, rite, k, reduced);
    if (countOn) {
      label(g, fellWords(lane, fallen(lane, tipped, rite, k)), callX, floorY - u * 2, callSmall, c.accent2);
    } else if (word >= 0) {
      label(g, word ? 'crosses' : 'stops', callX, floorY - u * 2, callSize, c.accent2);
    } else {
      label(g, '?', callX, floorY - u * 2, callSize, env.alpha(c.muted, 0.7));
    }
    if (s.hinted && s.hinted.includes(k)) {
      // The lane a hint names: its answer cut on at its moment.
      const hintAt = s.hintAt ? s.hintAt[k] : -1;
      if (roll(rite, 0x200 + k).flicker(came(s, hintAt, 0.8, reduced))) {
        label(g, crosses(lane) ? 'shown: crosses' : 'shown: stops', callX, floorY - u * 2 + callSize * 0.75 + callSmall * 0.8, callSmall, env.alpha(c.muted, 0.9));
      }
    }
  });
}

function lanesPreview(g, w, h, env, plan) {
  drawLanes(g, w, h, env, plan, { calls: null, touched: false, hinted: [], time: -1, t: 0 }, env.variant);
}

function lanesPiece(env, plan) {
  const helps = asked(env).helps;
  const truth = plan.lanes.map((l) => (crosses(l) ? 1 : 0));
  // calledAt, said and point: when the call standing on each lane was made, what it is and where it
  // was pressed (null from the rail); changes how many calls each lane has had; under the earlier
  // calls still showing beneath it, each frozen where it had got to; wordWas the word that stood
  // when it was made; badgeAt and badgePoint the first call's. tippedAt is when the chains were
  // tipped; v counts the changes, drawn and drawnAt the look of the last picture and when.
  const s = {
    calls: [0, 0, 0, 0], touched: false, hinted: [], time: -1, t: 0, tippedAt: -1,
    calledAt: [-1, -1, -1, -1], changes: [0, 0, 0, 0], said: [0, 0, 0, 0], point: [null, null, null, null],
    under: [[], [], [], []], wordWas: [-1, -1, -1, -1], badgeAt: [-1, -1, -1, -1], badgePoint: [null, null, null, null],
    hintAt: {}, v: 0, drawn: null, drawnAt: -1
  };
  const look = (c) => sizeOf(c) + '|' + s.v;
  const draw = (c) => {
    drawLanes(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = look(c);
    s.drawnAt = s.t;
  };
  // When the last change made comes the whole of its way: a call's band, word and badge in 0.9 s,
  // a hint's answer in 0.8, and a tip in 3 -- the last domino down by 2.3, the count by 2.9.
  function until() {
    let last = over(s.tippedAt, 3);
    for (let k = 0; k < 4; k++) last = Math.max(last, over(s.calledAt[k], 0.9), over(s.hintAt[k], 0.8));
    return last;
  }
  function right() {
    return truth.reduce((n, t, i) => n + (s.calls[i] === t ? 1 : 0), 0);
  }
  function callWords() {
    return s.calls.map((v, i) => 'lane ' + (i + 1) + ' ' + (v ? 'crosses' : 'stops')).join(', ');
  }
  // A call made on lane k, pressed at `point` (fractions of the scene) or from the rail (null): the
  // lane seals itself afresh in the colour of the call, on a roll of this call's own, over what
  // stood there -- the call before it frozen where it had got to (dropping everything under it once
  // it had landed), and the word that stood kept until the new one is cut on.
  function called(k, call, point, c) {
    const rite = riteOf(c);
    const reduced = !!c.reduced;
    if (s.calledAt[k] >= 0) {
      const now = sealOf(s, rite, k, reduced);
      s.wordWas[k] = wordShown(s, rite, k, reduced);
      if (now >= 1) s.under[k] = [];
      if (now > 0) s.under[k].push({ call: s.said[k], k: now, point: s.point[k] });
    } else {
      s.badgeAt[k] = s.t;
      s.badgePoint[k] = point;
    }
    s.said[k] = call;
    s.point[k] = point;
    s.calledAt[k] = s.t;
    s.changes[k] += 1;
    s.v += 1;
  }
  return {
    title: 'will it cross: four lanes in procession',
    brief: 'Four lanes of dominoes stand in procession, each with one gap. A falling domino reaches across a gap only when the gap is narrower than four fifths of its height. Every lane writes its domino height and its gap width, and both are drawn on the same grid. Tap a lane to change its call. ' + plan.lanes.map((l, i) => 'Lane ' + (i + 1) + ': height ' + l.h + ', gap ' + l.g).join('; ') + '.',
    goal: 'Call every lane: does the push stop at the gap, or cross it?',
    aspect: '4 / 5',
    checkLabel: 'check the lanes',
    steps: [
      { id: 'calls', ask: 'lanes 1 to 4: stops, or crosses', kind: 'grid', rows: 1, cols: 4, labels: ['stops', 'crosses'] },
      { id: 'hint', ask: 'one lane called for you', kind: 'press', count: 1, label: 'show one lane', optional: true }
    ],
    solution: { calls: truth },
    check(c) {
      const n = right();
      return {
        solved: n === 4,
        say: n === 4 ? 'every lane is called right; the chains go over' : (n === 0 ? 'no lane is called right; the push waits' : WORDS[n] + ' of four lanes called right; the push waits')
      };
    },
    start(c) {
      c.status('tap a lane to change its call');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'calls' && Array.isArray(value) && value.length === 4) {
        const next = value.map((v) => (v ? 1 : 0));
        for (let k = 0; k < 4; k++) if (s.calledAt[k] < 0 || next[k] !== s.calls[k]) called(k, next[k], null, c);
        s.calls = next;
        s.touched = true;
        c.status(callWords());
      }
      if (id === 'hint') {
        let k = -1;
        if (s.hinted.length < helps) {
          k = truth.findIndex((t, i) => !s.hinted.includes(i) && s.calls[i] !== t);
          if (k < 0) k = truth.findIndex((t, i) => !s.hinted.includes(i));
        }
        if (k >= 0) {
          s.hinted.push(k);
          s.hintAt[k] = s.t;
          s.v += 1;
          c.hint();
          c.status('lane ' + (k + 1) + (truth[k] ? ' crosses: its gap is under four fifths of its height' : ' stops: its gap is four fifths of its height or more'));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the floor will call at this difficulty; the numbers are on the lanes');
        } else c.status('every lane has been shown');
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = lanesGeometry(c.w, c.h, plan, env.variant || PLAIN);
      const k = Math.floor((y * c.h - geo.top) / geo.band);
      if (k < 0 || k > 3) {
        c.status('Tap one of the four numbered lanes to change its call.');
        return;
      }
      const next = s.calls.slice();
      next[k] = next[k] ? 0 : 1;
      s.calls = next;
      s.touched = true;
      called(k, next[k], { x, y }, c);
      c.set('calls', next.slice());
      c.status('lane ' + (k + 1) + (next[k] ? ' called to cross' : ' called to stop'));
      draw(c);
    },
    frame(t, dt, c) {
      const step = Math.max(0, dt);
      s.t += step;
      if (s.time >= 0) s.time += step;
      return paintFrame(s, c, look, until, draw);
    },
    end(c) {
      // A visitor who asked for less motion is shown the chains already down and counted
      // (drawLanes reads the tip at its end for them), so the clock need not be run ahead.
      s.time = 0;
      s.tippedAt = s.t;
      s.v += 1;
      const over = truth.filter(Boolean).length;
      c.status('tipped. ' + (over === 1 ? 'one lane goes over' : WORDS[over] + ' lanes go over') + ' and ' + (4 - over === 1 ? 'one stops' : WORDS[4 - over] + ' stop') + ' at the gap. nothing here was fragile.');
    }
  };
}

/* ---- the balance point: a plank, a ruler, a few blocks ------------------------------------- */

function centreOf(blocks) {
  const total = blocks.reduce((sum, b) => sum + b.m, 0);
  const moment = blocks.reduce((sum, b) => sum + b.m * b.x, 0);
  return moment / total;
}

function plankPlan(env) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const n = env.chance(0.5) ? 3 : 4;
    const blocks = [];
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      let x = env.int(1, 19);
      for (let guard = 0; guard < 10 && blocks.some((b) => Math.abs(b.x - x) < 2); guard++) x = env.int(1, 19);
      if (blocks.some((b) => Math.abs(b.x - x) < 2)) ok = false;
      blocks.push({ m: env.int(1, 6), x });
    }
    if (!ok) continue;
    const centre = centreOf(blocks);
    if (!Number.isInteger(centre) || centre === 10 || centre < 1 || centre > 19) continue;
    blocks.sort((a, b) => a.x - b.x);
    return { kind: 'plank', blocks };
  }
  return { kind: 'plank', blocks: [{ m: 2, x: 4 }, { m: 3, x: 10 }, { m: 1, x: 16 }] };
}

function carriedPlank(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'plank' || !Array.isArray(p.blocks) || p.blocks.length < 3 || p.blocks.length > 4) return null;
  const blocks = [];
  for (const b of p.blocks) {
    if (!b || typeof b !== 'object') return null;
    const m = Number(b.m);
    const x = Number(b.x);
    if (!Number.isInteger(m) || !Number.isInteger(x) || m < 1 || m > 6 || x < 0 || x > 20) return null;
    if (blocks.some((o) => Math.abs(o.x - x) < 2)) return null;
    blocks.push({ m, x });
  }
  const centre = centreOf(blocks);
  if (!Number.isInteger(centre) || centre === 10 || centre < 1 || centre > 19) return null;
  blocks.sort((a, b) => a.x - b.x);
  return { kind: 'plank', blocks };
}

function plankTitle(plan) {
  return 'the weighing: ' + WORDS[plan.blocks.length] + ' blocks, one pivot';
}

function fixedPull(plan, pivot) {
  return plan.blocks.reduce((sum, b) => sum + b.m * (b.x - pivot), 0);
}

function counterAnswers(plan) {
  const pull = fixedPull(plan, plan.pivot);
  return plan.weights.map((weight) => ({ weight, position: plan.pivot - pull / weight }))
    .filter((a) => Number.isInteger(a.position) && a.position >= 0 && a.position <= 20);
}

function counterweightPlan(env) {
  for (let attempt = 0; attempt < 240; attempt++) {
    const pivot = env.int(5, 15);
    const weight = env.int(2, 6);
    const position = env.int(1, 19);
    if (Math.abs(position - pivot) < 3 || Math.abs(position - 10) < 3) continue;
    const pull = weight * (position - pivot);
    // Decoy masses cannot divide this pull: only the chosen mass has a whole-number placement.
    const others = [2, 3, 4, 5, 6].filter((m) => m !== weight && pull % m !== 0);
    if (others.length < 2) continue;
    const n = env.chance(0.5) ? 2 : 3;
    const blocks = [];
    for (let i = 0; i < n - 1; i++) blocks.push({ m: env.int(1, 6), x: env.int(1, 19) });
    const m = env.int(1, 6);
    const x = pivot + (-pull - fixedPull({ blocks }, pivot)) / m;
    if (!Number.isInteger(x) || x < 1 || x > 19) continue;
    blocks.push({ m, x });
    blocks.sort((a, b) => a.x - b.x);
    if (blocks.some((b, i) => i > 0 && b.x - blocks[i - 1].x < 2)) continue;
    const weights = [weight];
    while (weights.length < 3) weights.push(others.splice(env.int(0, others.length - 1), 1)[0]);
    weights.sort((a, b) => a - b);
    return { kind: 'counterweight', blocks, pivot, weights };
  }
  return { kind: 'counterweight', blocks: [{ m: 2, x: 4 }, { m: 3, x: 19 }], pivot: 10, weights: [2, 4, 5] };
}

function carriedCounterweight(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'counterweight' || !Array.isArray(p.blocks) || p.blocks.length < 2 || p.blocks.length > 3) return null;
  const pivot = Number(p.pivot);
  if (!Number.isInteger(pivot) || pivot < 5 || pivot > 15 || !Array.isArray(p.weights) || p.weights.length !== 3) return null;
  const weights = p.weights.map(Number);
  if (weights.some((m) => !Number.isInteger(m) || m < 2 || m > 6) || new Set(weights).size !== 3) return null;
  const blocks = [];
  for (const b of p.blocks) {
    if (!b || typeof b !== 'object') return null;
    const m = Number(b.m);
    const x = Number(b.x);
    if (!Number.isInteger(m) || !Number.isInteger(x) || m < 1 || m > 6 || x < 0 || x > 20) return null;
    if (blocks.some((other) => Math.abs(other.x - x) < 2)) return null;
    blocks.push({ m, x });
  }
  blocks.sort((a, b) => a.x - b.x);
  weights.sort((a, b) => a - b);
  const plan = { kind: 'counterweight', blocks, pivot, weights };
  const answers = counterAnswers(plan);
  return answers.length === 1 && Math.abs(answers[0].position - 10) > 2 ? plan : null;
}

function blockClues(plan) {
  return plan.blocks.map((b) => 'mass ' + b.m + ' at ' + b.x).join('; ');
}

function counterweightTitle(plan) {
  return 'the counterweight: ' + WORDS[plan.blocks.length] + ' loads, pivot ' + plan.pivot;
}

function counterweightBrief(plan) {
  return 'Balance the weightless plank on its fixed pivot at ' + plan.pivot + ' by hanging one weight below it. Fixed blocks: ' + blockClues(plan)
    + '. Available hanging masses: ' + plan.weights.join(', ')
    + '. A block pulls with its mass times its distance from the pivot; equal left and right totals balance. Choose a mass and a whole-number mark from 0 to 20. Only one mass balances exactly. Set its mark with the number field or tap below the plank.';
}

// The counterweight's card, and its piece before anything is chosen: the hanger waits at the
// middle of the ruler with a '?' on it, the pivot where it stays.
function counterweightPreview(g, w, h, env, plan) {
  drawPlank(g, w, h, env, plan, {
    pivot: plan.pivot, position: 10, weight: 0, angle: 0, clamped: true,
    caption: 'hang one weight; make the pulls equal', t: 0
  }, env.variant);
}

function plankGeometry(w, h) {
  return { left: w * 0.1, u: (w * 0.8) / 20, rulerY: h * 0.72, plankY: h * 0.5, thick: Math.max(3, h * 0.03) };
}

// Where the pivot is drawn: walking from where it was to where the knob has it, in treads.
function pivotShown(s, rite, reduced) {
  if (s.pivotFrom == null || s.pivotAt == null || s.pivotAt < 0) return s.pivot;
  return s.pivotFrom + (s.pivot - s.pivotFrom) * roll(rite, 0x400 + (s.sets || 0)).stair(came(s, s.pivotAt, 0.8, reduced));
}

// Where the counterweight's hanger is drawn: walking the ruler from where it was to the mark the
// knob or a tap has it at, in treads, as the pivot does.
function hangerShown(s, rite, reduced) {
  if (s.positionFrom == null || s.positionAt == null || s.positionAt < 0) return s.position;
  return s.positionFrom + (s.position - s.positionFrom) * roll(rite, 0x700 + (s.moves || 0)).stair(came(s, s.positionAt, 0.6, reduced));
}

// The mass hanging now (0 for none, the '?'): the newest chosen from its roll's moment, and until
// then the one that stood when it was chosen. Its number, its size on the hanger and its mark on the
// rack are all this one mass, so a new choice replaces the old in one cut.
function weightShown(s, rite, reduced) {
  if (s.weightAt == null || s.weightAt < 0) return s.weight || 0;
  return roll(rite, 0x800 + (s.weightsSet || 0)).flicker(came(s, s.weightAt, 0.7, reduced)) ? s.weight : s.weightWas;
}

// How far the plank has turned: from the tilt it had to the tilt the last check earned, held and
// then turned on an even stair, a balance's settling into its notch, never an approach along a
// lerp.
function angleShown(s, rite, reduced) {
  if (s.angleFrom == null || s.angleAt == null || s.angleAt < 0) return s.angle;
  return s.angleFrom + (s.angle - s.angleFrom) * roll(rite, 0x300 + (s.checks || 0)).stair(came(s, s.angleAt, 1.3, reduced));
}

// How much of the clamp's jaws stands: from what stood when the clamp was last put on or let go to
// whole or nothing, on that clamping's own stair, so a clamp let go before its jaws were all in
// gives back only what had come.
function jawsShown(s, rite, reduced) {
  const to = s.clamped ? 1 : 0;
  if (s.clampAt == null || s.clampAt < 0) return to;
  const from = s.clampFrom == null ? 1 - to : s.clampFrom;
  return from + (to - from) * roll(rite, 0x500 + (s.clamps || 0)).stair(came(s, s.clampAt, 0.7, reduced));
}

// The caption under the plank: the newest from its roll's moment, and until then the one that
// stood when it was written.
function captionShown(s, rite, reduced) {
  if (s.captionAt == null || s.captionAt < 0) return s.caption;
  return roll(rite, 0x600 + (s.captions || 0)).flicker(came(s, s.captionAt, 0.7, reduced)) ? s.caption : s.captionWas;
}

function drawPlank(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = plankGeometry(w, h);
  const size = Math.max(10, Math.min(15, Math.round(Math.min(w, h) * 0.05)));
  const small = Math.max(9, Math.round(size * 0.8));
  ground(g, w, h, env);
  // The light over a balanced plank: cut in by the edge from the solve.
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.2, reduced), 0.08);
  // The ruler, 0 to 20.
  g.strokeStyle = env.alpha(c.muted, 0.7);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(geo.left - geo.u * 0.5, geo.rulerY);
  g.lineTo(geo.left + geo.u * 20.5, geo.rulerY);
  g.stroke();
  // The ruler's numbers: at every mark, or every other and the tall marks as the configuration
  // asks, where they fit side by side; on a ruler too short for that, every other, or at the tall
  // marks only (every five), or at 0, 10 and 20 -- never one number run into the next.
  const roomy = (n) => n * geo.u >= wide(g, '20', small) + small * 0.5;
  const every = [v.density < 0.9 ? 2 : 1, 2, 5, 10].find((n) => roomy(n)) || 10;
  g.fillStyle = env.alpha(c.accent, 0.06 * v.density);
  g.fillRect(geo.left - geo.u * 0.5, geo.rulerY, geo.u * 21, h * 0.04);
  for (let i = 0; i <= 20; i++) {
    const x = geo.left + i * geo.u;
    const tall = i % 5 === 0;
    g.strokeStyle = env.alpha(c.muted, tall ? 0.9 : 0.5);
    g.beginPath();
    g.moveTo(x, geo.rulerY);
    g.lineTo(x, geo.rulerY + (tall ? h * 0.035 : h * 0.02));
    g.stroke();
    if (i % every === 0 || (tall && roomy(1))) label(g, String(i), x, geo.rulerY + h * 0.035 + small * 0.8, small, env.alpha(c.fg, tall ? 0.95 : 0.6));
  }
  // The pivot, walking to where the knob has it, and the plank turned about it in treads by
  // whatever the last check earned.
  const px = geo.left + pivotShown(s, rite, reduced) * geo.u;
  const py = geo.plankY + geo.thick / 2;
  g.fillStyle = env.alpha(c.accent2, 0.9);
  g.beginPath();
  g.moveTo(px, py);
  g.lineTo(px - geo.u * 0.6, geo.rulerY);
  g.lineTo(px + geo.u * 0.6, geo.rulerY);
  g.closePath();
  g.fill();
  g.save();
  g.translate(px, py);
  g.rotate(angleShown(s, rite, reduced));
  g.translate(-px, -py);
  g.fillStyle = env.mix(c.bg2, c.accent, 0.6);
  g.fillRect(geo.left - geo.u * 0.3, geo.plankY - geo.thick / 2, geo.u * 20.6, geo.thick);
  g.strokeStyle = env.alpha(c.fg, 0.5);
  g.lineWidth = 1;
  g.strokeRect(geo.left - geo.u * 0.3, geo.plankY - geo.thick / 2, geo.u * 20.6, geo.thick);
  const grow = Math.min(1.1, Math.max(0.9, v.scale));
  // Where each block stands, written under it: 'at 7', or the bare number where blocks two marks
  // apart leave no room for the word between them, so one never runs into the next.
  const near = Math.min(...plan.blocks.slice(1).map((b, i) => b.x - plan.blocks[i].x)) * geo.u;
  const at = (x) => (wide(g, 'at 20', small) + small * 0.4 <= near ? 'at ' + x : String(x));
  for (const b of plan.blocks) {
    const side = geo.u * (0.8 + 0.36 * Math.sqrt(b.m)) * grow;
    const x = geo.left + b.x * geo.u;
    const y = geo.plankY - geo.thick / 2 - side / 2;
    block(g, x, y, side, side, 0, env.alpha(env.mix(c.accent, c.accent2, b.m / 6), 0.88), env.alpha(c.fg, 0.5));
    label(g, String(b.m), x, y, Math.max(9, Math.round(side * 0.5)), c.bg, 'center', '600');
    label(g, at(b.x), x, geo.plankY + geo.thick / 2 + small * 0.8, small, env.alpha(c.muted, 0.9));
  }
  // The counterweight's hanger, under the plank and turning with it: it walks the ruler to its mark
  // in treads, and carries the mass hanging now, a '?' until one is chosen. The first choice cuts
  // the block's fill in by the edge, and it rests in two shades; a mass chosen after that replaces
  // the one that stood -- its number and its size -- at its roll's moment.
  if (plan.kind === 'counterweight') {
    const hung = weightShown(s, rite, reduced);
    const x = geo.left + hangerShown(s, rite, reduced) * geo.u;
    const side = Math.min(h * 0.12, geo.u * (1 + 0.3 * Math.sqrt(hung || 3)) * grow);
    const top = geo.plankY + geo.thick / 2 + h * 0.04;
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, geo.plankY + geo.thick / 2);
    g.lineTo(x, top);
    g.stroke();
    block(g, x, top + side / 2, side, side, 0, c.bg, c.accent2);
    if (s.sealAt != null && s.sealAt >= 0) {
      const own = roll(rite, 0x880);
      g.fillStyle = env.alpha(c.accent2, 0.16);
      cover(g, own, x - side / 2, top, side, side, own.stair(came(s, s.sealAt, 0.9, reduced)));
    }
    label(g, hung ? String(hung) : '?', x, top + side / 2, size, c.fg, 'center', '600');
  }
  // The clamp's jaws: cut in by the edge when the clamp is put on, and given back the same way,
  // the region shrinking, when it is let go -- each from where the last had got to.
  const jaws = jawsShown(s, rite, reduced);
  if (jaws > 0) {
    g.fillStyle = env.alpha(c.muted, 0.9);
    const jawW = Math.max(2, geo.thick * 0.6);
    for (const x of [geo.left - geo.u * 0.3, geo.left + geo.u * 20.3]) {
      rite.paint(g, x - jawW / 2, geo.plankY - geo.thick * 1.6, jawW, geo.thick * 3.2, jaws);
    }
  }
  g.restore();
  // The counterweight's rack of masses over the plank, and the pivot that stays put. The mass
  // hanging now is marked under its place on the rack, the mark moving to a new choice at the same
  // moment its number is cut on under the plank.
  if (plan.kind === 'counterweight') {
    const hung = weightShown(s, rite, reduced);
    label(g, 'choose one hanging weight', w / 2, h * 0.055, small, c.fg);
    plan.weights.forEach((weight, i) => {
      const x = w * (0.2 + i * 0.3) + v.turn * geo.u;
      const side = h * 0.09 * grow;
      block(g, x, h * 0.17, side, side, 0, c.accent2, c.fg);
      label(g, String(weight), x, h * 0.17, small, c.bg, 'center', '600');
      if (hung === weight) {
        g.strokeStyle = c.accent2;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - side / 2, h * 0.24);
        g.lineTo(x + side / 2, h * 0.24);
        g.stroke();
      }
    });
    label(g, 'fixed pivot ' + plan.pivot, w / 2, h * 0.31, small, c.fg);
  }
  // The caption: a new one replaces the old at one moment, the old standing until it is cut on.
  const said = captionShown(s, rite, reduced);
  if (said) fitted(g, said, w / 2, h * 0.92, small, w - small * 1.2, env.alpha(c.muted, 0.9));
}

function plankPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  drawPlank(g, w, h, env, plan, { pivot: Math.round(v.turn * 20), angle: 0, clamped: true, caption: 'where does it balance?', t: 0 }, v);
}

function plankPiece(env, plan) {
  // The pivot is a place on a ruler, and so is the counterweight's mark, so each is a measured
  // answer: the difficulty says how many marks out it may be and still be called balanced. The
  // counterweight is the same plank with its pivot fixed and one more block, the hanging one, to
  // choose and to place (`moving`).
  const settings = asked(env);
  const margin = settings.margin;
  const moving = plan.kind === 'counterweight';
  const answer = moving ? counterAnswers(plan)[0] : null;
  const centre = moving ? plan.pivot : centreOf(plan.blocks);
  const tip = centre < 10 ? 'left' : centre > 10 ? 'right' : 'level';
  // weight is the mass chosen for the hanger (0 for none), weightWas the one that stood when it was
  // chosen, weightAt and weightsSet when and how many times; sealAt is when the first was chosen,
  // which cuts the hanging block's fill in. position is the hanger's mark, walked to from
  // positionFrom since positionAt (the moves-th move). helped counts the comparisons given. v
  // counts the changes, drawn and drawnAt the look of the last picture and when (settled).
  const s = {
    pivot: moving ? centre : 10, pivotFrom: moving ? centre : 10, pivotAt: -1, sets: 0,
    weight: 0, weightWas: 0, weightAt: -1, weightsSet: 0, sealAt: -1,
    position: 10, positionFrom: 10, positionAt: -1, moves: 0, helped: 0,
    angle: 0, angleFrom: 0, angleAt: -1, checks: 0,
    clamped: true, clampFrom: 1, clampAt: -1, clamps: 0,
    doneAt: -1, t: 0,
    caption: moving ? 'hang one weight; make the pulls equal' : 'the clamp holds it level until you check',
    captionWas: '', captionAt: -1, captions: 0,
    v: 0, drawn: null, drawnAt: -1
  };
  const look = (c) => sizeOf(c) + '|' + s.v;
  const draw = (c) => {
    drawPlank(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = look(c);
    s.drawnAt = s.t;
  };
  // When the last change made comes the whole of its way, on the piece's clock.
  function until() {
    return Math.max(over(s.pivotAt, 0.8), over(s.angleAt, 1.3), over(s.clampAt, 0.7), over(s.captionAt, 0.7), over(s.doneAt, 2.2),
      over(s.positionAt, 0.6), over(s.weightAt, 0.7), over(s.sealAt, 0.9));
  }
  const n = plan.blocks.length;
  // Every change of state is made at the clock and on a fresh roll of its own, from what stood on
  // the screen at that moment.
  function tilt(c, target) {
    const now = angleShown(s, riteOf(c), !!c.reduced);
    // A plank already standing still at that tilt does not turn, and is owed no frame.
    if (target === s.angle && Math.abs(now - target) < 1e-9) return;
    s.angleFrom = now;
    s.angle = target;
    s.angleAt = s.t;
    s.checks += 1;
    s.v += 1;
  }
  function clamp(c, on) {
    if (s.clamped === on) return;
    s.clampFrom = jawsShown(s, riteOf(c), !!c.reduced);
    s.clamped = on;
    s.clampAt = s.t;
    s.clamps += 1;
    s.v += 1;
  }
  function say(c, text) {
    if (text === s.caption) return;
    s.captionWas = captionShown(s, riteOf(c), !!c.reduced);
    s.caption = text;
    s.captionAt = s.t;
    s.captions += 1;
    s.v += 1;
  }
  // The hanger moved to a mark, from the knob or a tap below the plank: it walks there from where
  // it stands, on a roll of this move's own, and the clamp goes back on until the next check.
  function moveWeight(value, c) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0 || next > 20) {
      c.status('Use a whole-number mark from 0 to 20.');
      return;
    }
    if (next !== s.position) {
      s.positionFrom = hangerShown(s, riteOf(c), !!c.reduced);
      s.position = next;
      s.positionAt = s.t;
      s.moves += 1;
      s.v += 1;
    }
    clamp(c, true);
    tilt(c, 0);
    say(c, 'clamped; check to compare the pulls');
    c.status('Hanger at mark ' + s.position + (s.weight ? ', mass ' + s.weight : '; choose its mass') + '.');
  }
  const help = { id: 'hint', ask: 'compare the pulls (' + settings.helps + ' uses)', kind: 'press', count: 1, label: 'compare the pulls', optional: true };
  const leeway = margin ? ' Your setting allows ' + margin + (margin === 1 ? ' mark' : ' marks') + ' of leeway; exact balance still has one whole-number answer.' : '';
  return {
    title: moving ? counterweightTitle(plan) : plankTitle(plan),
    brief: moving ? counterweightBrief(plan) + leeway : 'A weighing. ' + WORDS[n][0].toUpperCase() + WORDS[n].slice(1) + ' blocks stand on a weightless plank over a ruler from 0 to 20, each with its mass written on it and its place under it. A plank balances on a pivot when the masses times their distances from it come to the same on both sides. A clamp holds it level until you check; a wrong check lets it tip. Blocks: ' + blockClues(plan) + '.' + leeway,
    goal: moving ? 'Choose the hanging mass and its whole-number mark to balance the plank on pivot ' + centre + '.' : 'Find the whole number where one pivot balances the plank, and say which way it tips with the pivot at 10.',
    aspect: '16 / 10',
    checkLabel: moving ? 'check the balance' : 'let go of the clamp',
    steps: moving ? [
      { id: 'weight', ask: 'choose one hanging mass', kind: 'choice', options: plan.weights.map((m) => ({ label: 'mass ' + m, value: String(m) })) },
      { id: 'position', ask: 'where to hang it', kind: 'number', min: 0, max: 20, step: 1, value: 10, unit: 'on the ruler' },
      help
    ] : [
      { id: 'pivot', ask: 'where one pivot balances it', kind: 'number', min: 0, max: 20, step: 1, value: 10, unit: 'on the ruler' },
      { id: 'tip', ask: 'with the pivot at 10, the plank', kind: 'choice', options: TIPS },
      help
    ],
    solution: moving ? { weight: String(answer.weight), position: { value: answer.position, near: margin } } : { pivot: { value: centre, near: margin }, tip },
    check(c) {
      if (moving) {
        const weight = Number(c.value('weight'));
        const position = Number(c.value('position'));
        if (!plan.weights.includes(weight) || !Number.isInteger(position) || position < 0 || position > 20) {
          return { solved: false, say: 'Choose a hanging mass and a whole-number mark from 0 to 20.' };
        }
        const pull = fixedPull(plan, centre) + weight * (position - centre);
        const solved = weight === answer.weight && Math.abs(position - answer.position) <= margin;
        clamp(c, false);
        tilt(c, Math.sign(pull) * 0.14);
        say(c, pull === 0 ? 'balanced; both sides pull equally' : (pull > 0 ? 'right' : 'left') + ' side pulls ' + Math.abs(pull) + ' more');
        return {
          solved,
          say: solved
            ? (pull === 0 ? 'Balanced. ' : 'Within the ' + margin + '-mark leeway. ') + 'Exact balance: mass ' + answer.weight + ' at mark ' + answer.position + '.'
            : 'The ' + (pull > 0 ? 'right' : 'left') + ' side pulls ' + Math.abs(pull) + ' more. Change the hanging mass or its mark and check again.'
        };
      }
      const p = Math.round(Number(c.value('pivot')));
      const pivotRight = Math.abs(p - centre) <= margin;
      const callRight = c.value('tip') === tip;
      clamp(c, false);
      if (pivotRight && callRight) {
        // Within the leeway but off the centre, the plank still shows which way it leans.
        tilt(c, Math.sign(centre - p) * 0.14);
        say(c, p === centre ? 'balanced at ' + centre : 'within the allowed leeway');
        return { solved: true, say: (p === centre ? 'the weighing holds' : 'within the ' + margin + '-mark leeway') + ': exact balance at ' + centre + '; with the pivot at 10 it ' + (tip === 'level' ? 'stays level' : 'tips to the ' + tip) };
      }
      const parts = [];
      if (!pivotRight) {
        tilt(c, (p < centre ? 1 : -1) * 0.14);
        parts.push('with the pivot at ' + p + ' the plank tips to the ' + (p < centre ? 'right' : 'left'));
      } else {
        tilt(c, Math.sign(centre - p) * 0.14);
        parts.push(p === centre ? 'the pivot is in the right place' : 'the pivot is within the allowed leeway');
      }
      if (!callRight) parts.push('the call for the pivot at 10 is wrong');
      say(c, p === centre ? 'level on its pivot' : 'tipping');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(moving ? 'Choose a hanging mass, then set its mark. The pivot stays at ' + centre + '.' : 'the clamp holds the plank level until you check');
      draw(c);
    },
    apply(id, value, c) {
      if (moving && id === 'weight') {
        const weight = Number(value);
        if (!plan.weights.includes(weight)) {
          c.status('Choose one of the three masses on the rack.');
          return;
        }
        if (weight !== s.weight) {
          // The mass that stood stays until this choice's moment, when the new one replaces it in
          // one cut; the first choice also cuts the hanging block's fill in.
          s.weightWas = weightShown(s, riteOf(c), !!c.reduced);
          s.weight = weight;
          s.weightAt = s.t;
          s.weightsSet += 1;
          if (s.sealAt < 0) s.sealAt = s.t;
          s.v += 1;
        }
        clamp(c, true);
        tilt(c, 0);
        say(c, 'clamped; check to compare the pulls');
        c.status('Hanging mass ' + weight + ' at mark ' + s.position + '.');
      }
      if (moving && id === 'position') moveWeight(value, c);
      if (id === 'hint') {
        if (s.helped >= settings.helps) {
          c.status('All comparisons used. Multiply each mass by its distance from the pivot; equal totals balance.');
        } else {
          s.helped += 1;
          c.hint();
          const pivot = moving ? centre : s.pivot;
          const blocks = plan.blocks.concat(moving && s.weight ? [{ m: s.weight, x: s.position }] : []);
          const pulls = blocks.map((b) => {
            const distance = Math.abs(b.x - pivot);
            return 'mass ' + b.m + ' at ' + b.x + ': ' + b.m + ' x ' + distance + ' = ' + (b.m * distance) + (b.x < pivot ? ' left' : b.x > pivot ? ' right' : ' on the pivot');
          });
          c.status('At pivot ' + pivot + ', ' + pulls.join('; ') + '. Equal left and right totals balance. '
            + (moving && !s.weight ? 'Choose a hanging mass to add its pull. ' : '') + (settings.helps - s.helped) + ' comparisons left.');
        }
      }
      if (id === 'pivot') {
        const p = Math.round(Number(value));
        const next = Number.isFinite(p) ? Math.max(0, Math.min(20, p)) : 10;
        if (next !== s.pivot) {
          s.pivotFrom = pivotShown(s, riteOf(c), !!c.reduced);
          s.pivot = next;
          s.pivotAt = s.t;
          s.sets += 1;
          s.v += 1;
        }
        clamp(c, true);
        tilt(c, 0);
        say(c, 'the clamp holds it level until you check');
        c.status('the pivot is at ' + s.pivot + ', clamped level');
      }
      if (id === 'tip') c.status('at 10, you say it ' + (value === 'level' ? 'stays level' : 'tips to the ' + value));
      draw(c);
    },
    tap(x, y, c) {
      if (!moving) {
        c.status('Set the pivot with its number field, then check the balance.');
        return;
      }
      if (y < 0.55) {
        c.status('Choose a mass with its button; tap below the plank to place the hanger on the ruler.');
        return;
      }
      const geo = plankGeometry(c.w, c.h);
      const position = Math.max(0, Math.min(20, Math.round((x * c.w - geo.left) / geo.u)));
      moveWeight(position, c);
      c.set('position', position);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) {
        s.doneAt = s.t;
        s.v += 1;
      }
      return paintFrame(s, c, look, until, draw);
    },
    end(c) {
      clamp(c, false);
      const pull = moving ? fixedPull(plan, centre) + s.weight * (s.position - centre) : centre - s.pivot;
      tilt(c, Math.sign(pull) * 0.14);
      if (s.doneAt < 0) s.doneAt = s.t;
      s.v += 1;
      c.status(moving
        ? 'Exact balance uses mass ' + answer.weight + ' at mark ' + answer.position + '. Change either setting and check again to see which side pulls harder.'
        : 'Exact balance is at ' + centre + '. The clamp is off; move the pivot and check again to see it tip.');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which floor this card or piece is, dealt once from the env's seeded stream (or taken whole from
// the card it was opened from) and kept with that env: the still picture and the piece opened from
// it ask here, so they are one floor.
const plans = new WeakMap();

function deal(env) {
  if (plans.has(env)) return plans.get(env);
  const makers = [lanesPlan, plankPlan, counterweightPlan];
  const plan = carriedLanes(env) || carriedPlank(env) || carriedCounterweight(env) || makers[env.int(0, 2)](env);
  plans.set(env, plan);
  return plan;
}

export default {
  id: 'kinetic-floor',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'lanes') lanesPreview(g, w, h, env, plan);
    else if (plan.kind === 'counterweight') counterweightPreview(g, w, h, env, plan);
    else plankPreview(g, w, h, env, plan);
  },
  // A floor card is a still picture: nothing on it moves until it is opened, so it says so at once
  // and the feed lets it go.
  animate(g, w, h, env, t) {
    return false;
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'counterweight') {
      return {
        title: counterweightTitle(plan),
        mono: 'fixed pivot ' + plan.pivot + '\n' + plan.blocks.map((b) => 'mass ' + b.m + '  at ' + b.x).join('\n') + '\nhanging masses: ' + plan.weights.join(', '),
        text: counterweightBrief(plan),
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => counterweightPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (plan.kind === 'lanes') {
      return {
        title: 'will it cross: four lanes in procession',
        mono: plan.lanes.map((l, i) => 'lane ' + (i + 1) + '  height ' + l.h + '  gap ' + l.g).join('\n'),
        text: 'Four lanes in procession. A falling domino crosses a gap narrower than four fifths of its height. Call each lane: stops, or crosses.',
        aspect: '4 / 5',
        paint: (g, w, h, cardEnv) => lanesPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    return {
      title: plankTitle(plan),
      mono: plan.blocks.map((b) => 'mass ' + b.m + '  at ' + b.x).join('\n'),
      text: 'A weighing on a weightless plank over a ruler from 0 to 20. Find where one pivot balances it, and which way it tips from the middle.',
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => plankPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const plan = deal(env);
    return plan.kind === 'lanes' ? lanesPiece(env, plan) : plankPiece(env, plan);
  }
};
