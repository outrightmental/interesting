/* Loam: a cutaway of soil with roots finding their way round the stones. As a card it is one of
   the three puzzles below (paint, animate, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles, read off a drawing or followed through the ground:

     the core   A core cut from the bed and drawn to scale: four to six layers, each with its
                thickness in centimetres written beside it, one of them a band of stones, and a
                wavy line at a layer boundary where the water stands. Read how deep the water
                table is (the layers above it, added up) and how many layers a root passes
                through before it meets the stones. A wrong check says deeper or shallower,
                sooner or later, and no more; solved, a root goes down and the water rises to
                its line.
     the mix    Two bags of soil with their sand shares written on, and a bed that wants a share
                between them. Mixing a parts of A with 10 - a parts of B gives the mean of the
                two shares, weighted by the parts. Find a (the bed's share is chosen so a is a
                whole number) and say whether the blend drains faster or slower than bag A: a
                sandier soil drains faster. A wrong check says sandier or less sandy than the
                bed wants, and no more. Solved, the bed takes the blend and goes on taking
                whatever blend the visitor mixes next, each draining at its own pace.
     the route  A root enters a four-column bed. Each cell sends it down-left, straight down or
                down-right into the next layer. Follow it to its exit and count its left turns.
                A look halfway costs a hint; a wrong check says how many readings fit.

   A card and the feature it opens as are one bed: the spark puts the whole plan on its spec as
   `of` -- the layers, the band and the water line, or the two bags and the bed -- and piece(env)
   opens on that rather than rolling another. The plan is dealt once per env and kept (deal()), so
   a card's still picture, its motion and the piece opened from it are one bed; and a card's still
   picture is the picture its piece opens on. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const KINDS = ['topsoil', 'loam', 'silt', 'clay', 'sand', 'peat'];
const COLUMNS = ['A', 'B', 'C', 'D'];
const TAU = Math.PI * 2;
const LINES = [
  'The interesting part was always underground.',
  'Roots take the path of least resistance, so the stones matter.',
  'Planted over gravel, so it went sideways for a while first.',
  'Water finds its level, and then it stays there.'
];
const DRAINS = [
  { label: 'drains faster than A', value: 'faster' },
  { label: 'drains slower than A', value: 'slower' }
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

/* ---- the rite: how the ground moves --------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing in the ground moves along a formula, and nothing changes but
   behind one clean edge -- the piece's own slice or curve, the same edge for every surface of it
   -- in a few treads, always forward. A reading the visitor sets is SEALED on the drawing behind
   that edge: a mark where they say the water stands, the cell they tap in the bed, a bracket
   under the column they say the root leaves at; an unset one is taken back behind the same edge,
   the way it came. A mark is how far the edge has passed over it, and a press turns it round from
   wherever it stands, so a second press made before the first has landed never makes a mark jump
   to whole before it goes back, and never drops one half-way (marks(), choose()). The bracket
   down the layers they count is one bar, and a new count seals on or takes back only the layers
   that differ (recount()). A cup that changes bag takes its new soil over the old behind the
   edge (pour()).

   A solve is one gesture: one roll and one clock, so the whole picture steps on the same few
   moments. In the core the dark over the surface lifts and the day comes over the drawing behind
   the one edge, while the water rises to its line -- water finds its level, so its edge is a level
   one, climbing on those same treads -- and the root goes down as far as each tread takes it. In
   the bed the blend comes in wet behind that edge with the day, and once it lies there its water
   drains out by its level, falling in treads, slower the less sand there is; a blend mixed after
   the solve is laid over the soil lying there behind the same edge, on a roll of its own, and comes
   in wet and drains in its turn. In the route the root
   goes down through the rows a tread at a time under the same day. A ruled-out blend, a caption,
   a ring or a cup's letter is cut on at one moment and stays; old words go before new ones come.

   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion and for whatever stood there from the start, and a finale shows such a visitor where it
   ends. Every trigger rolls its own treads (roll() with the count of that trigger), so a second
   reading, a second tap, a second mix steps differently from the first while cutting along the
   same edge. And a frame redraws only while something is moving (framed()): a still drawing is
   left on the canvas as it stands and asks for no further frame, so nothing is computed that does
   not show.

   A core card, once it is on the screen, moves once: its water line's wave goes round one turn in
   the ratchet's even clicks and rests where it was painted, which is where the piece opens. Its
   first click comes with the card's first moving frame, so a card that moves is seen to move at
   once; between clicks nothing is drawn, and after the last the card says it is still. */

// The rite of a drawing handed none: every movement at its end and every surface whole.
const STILL = {
  stair: () => 1, flicker: () => 1, ratchet: () => 1, treads: 1,
  paint(g, x, y, w, h, k, style) {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w, h);
  },
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w, h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// How far a change made at `since` has come, over `span` seconds of the piece's clock. Anything
// still on its way marks the drawing busy, so the next frame draws it again.
function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  const p = Math.max(0, Math.min(1, (s.t - since) / span));
  if (p < 1) s.busy = true;
  return p;
}

// The rite rolled afresh for the n-th trigger of one kind of thing: a second press steps in other
// treads from the first, behind the same edge.
function roll(rite, base, n) {
  return rite.at(((base | 0) ^ (Math.imul((n | 0) + 1, 0x9e37) | 0)) >>> 0);
}

// One frame of a piece: the drawing is made again only when something on it is moving, when a
// trigger changed it, or when the scene was sized again (which clears the canvas); otherwise the
// picture already on the canvas is the picture. The frame answers whether anything is still moving
// once it is drawn: false when the drawing is at rest, which tells the stage to ask for no frame
// until a knob, a tap, a check, a new size or the scene coming back sets something going again --
// the only things that do, so the clock may stand still meanwhile.
function framed(s, c, draw) {
  const lost = !!(c.g && typeof c.g.isContextLost === 'function' && c.g.isContextLost());
  if (!s.dirty && !s.busy && !lost && s.on === c.g && s.w === c.w && s.h === c.h && s.dpr === c.dpr) return false;
  draw(c);
  return s.busy;
}

// Draws with the bookkeeping framed() reads: whatever is moving marks itself busy as it is drawn.
function drawn(s, c, paint) {
  s.busy = false;
  s.dirty = false;
  s.on = c.g;
  s.w = c.w;
  s.h = c.h;
  s.dpr = c.dpr;
  paint();
}

/* ---- marks: what a visitor sets, sealed on the drawing ------------------------------------- */

// A kind of mark (a reading, a tap, a column): its own salt for the rolls and its own length.
function marks(base, span) {
  return { base, span, n: 0, list: [] };
}

// How far the edge has passed over mark m now: from where it stood when its last trigger came,
// toward 1 while it is set and 0 once it is not, in that trigger's treads.
function cover(set, m, rite, s, reduced) {
  return m.from + (m.to - m.from) * roll(rite, set.base, m.n).stair(came(s, m.at, set.span, reduced));
}

// `key` becomes the one mark set (null for none): a mark heading the other way turns where it
// stands, on this trigger's roll, and a new one comes from nothing. False when it already was.
function choose(set, key, rite, s, reduced) {
  const was = set.list.find((m) => m.to === 1);
  if ((was ? was.key : null) === key) return false;
  set.n += 1;
  set.list = set.list.filter((m) => m.to === 1 || m.key === key || cover(set, m, rite, s, reduced) > 0);
  for (const m of set.list) {
    const to = m.key === key ? 1 : 0;
    if (m.to !== to) {
      m.from = cover(set, m, rite, s, reduced);
      m.to = to;
      m.at = s.t;
      m.n = set.n;
    }
  }
  if (key != null && !set.list.some((m) => m.key === key)) set.list.push({ key, from: 0, to: 1, at: s.t, n: set.n });
  return true;
}

// Every mark of a kind at its coverage now, each one paint in the box box(key) gives it.
function sealMarks(g, set, rite, s, reduced, box, style) {
  for (const m of set.list) {
    const k = cover(set, m, rite, s, reduced);
    const b = k > 0 ? box(m.key) : null;
    if (b) roll(rite, set.base, m.n).paint(g, b.x, b.y, b.w, b.h, k, style);
  }
}

// The mark of a kind that is set now, once its trigger's moment has come: what a ring is cut on for.
function markedNow(set, rite, s, reduced) {
  const m = set.list.find((x) => x.to === 1);
  return m && roll(rite, set.base, m.n).flicker(came(s, m.at, set.span, reduced)) === 1 ? m.key : null;
}

// The bracket down the counted layers, as runs of layers [lo, hi), each with its own coverage. A
// new count leaves alone the runs that already say it, splits a whole run where the count now
// ends (nothing moves there), turns round the runs that no longer belong, and seals on the layers
// nothing is yet bringing on. A run caught half-way and cut by the count goes back as it is, and
// the part of it still wanted is sealed again over it, so nothing jumps.
function recount(bar, count, rite, s, reduced) {
  if (bar.said === count) return false;
  bar.said = count;
  bar.n += 1;
  const k = (r) => r.from + (r.to - r.from) * roll(rite, bar.base, r.n).stair(came(s, r.at, bar.span, reduced));
  // What has landed is settled first: runs gone to nothing are let go, and the runs wholly on are
  // one run wherever they meet, so a change after them moves one edge, not one per run.
  const whole = [];
  const runs = [];
  for (const r of bar.runs) {
    const c = k(r);
    if (r.to === 0 && c <= 0) continue;
    if (r.to === 1 && c >= 1) whole.push([r.lo, r.hi]);
    else runs.push(r);
  }
  whole.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < whole.length; i++) {
    const lo = whole[i][0];
    let hi = whole[i][1];
    while (i + 1 < whole.length && whole[i + 1][0] <= hi) hi = Math.max(hi, whole[++i][1]);
    // A whole run the count now ends inside is split there: nothing of it moves at the split.
    if (lo < count && count < hi) runs.push({ lo, hi: count, from: 1, to: 1, at: -1, n: 0 }, { lo: count, hi, from: 1, to: 1, at: -1, n: 0 });
    else runs.push({ lo, hi, from: 1, to: 1, at: -1, n: 0 });
  }
  for (const r of runs) {
    const to = r.hi <= count ? 1 : 0;
    if (r.to !== to) {
      r.from = k(r);
      r.to = to;
      r.at = s.t;
      r.n = bar.n;
    }
  }
  let reached = 0;
  for (const r of runs.filter((x) => x.to === 1).sort((a, b) => a.lo - b.lo)) {
    if (r.lo > reached) runs.push({ lo: reached, hi: r.lo, from: 0, to: 1, at: s.t, n: bar.n });
    reached = Math.max(reached, r.hi);
  }
  if (reached < count) runs.push({ lo: reached, hi: count, from: 0, to: 1, at: s.t, n: bar.n });
  bar.runs = runs;
  return true;
}

// The light that comes over a solved bed: behind the finale's edge, on its treads, and then it
// holds.
function daybreak(g, fin, env, w, h, k, strength) {
  if (k > 0) fin.paint(g, 0, 0, w, h, k, env.alpha(env.colors.accent2, strength || 0.1));
}

const FINALE = 2.4; // seconds from a solve to the end of its finale

// How far a finale has come: one roll and one clock for the whole solve, 0 before it.
function finale(s, fin, reduced) {
  return s.doneAt != null && s.doneAt >= 0 ? fin.stair(came(s, s.doneAt, FINALE, reduced)) : 0;
}

/* ---- shared drawing ------------------------------------------------------------------------ */

function font(g, size, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
}

function write(g, text, x, y, size, tone, align, weight) {
  font(g, size, weight);
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = tone;
  g.fillText(text, x, y);
}

// The ground and the dark above it, as the old cutaway laid them. The dark lifts off a solved
// bed by its area: where the finale's edge has passed over the whole drawing (the same edge the
// day comes behind), the dark band is lifted, on the finale's treads, never a wash.
function sky(g, w, h, env, top, k, fin) {
  const c = env.colors;
  const ground = env.mix(c.bg, c.bg2, 0.25);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, w, top);
  if (k > 0) {
    g.save();
    g.beginPath();
    g.rect(0, 0, w, top);
    g.clip();
    (fin || STILL).paint(g, 0, 0, w, h, k, env.alpha(ground, 0.57));
    g.restore();
  }
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(w, top);
  g.stroke();
}

// The tone of a soil by its sand share: dark loam at none, pale grit at all of it.
function soilTone(env, share) {
  const c = env.colors;
  return env.mix(env.mix(c.bg2, c.accent2, 0.35), env.mix(c.fg, c.accent2, 0.45), share / 100);
}

// Grit, as flecks, laid by a fixed sequence so it never shimmers from frame to frame.
function flecks(g, env, x, y, w, h, count, salt, a) {
  g.fillStyle = env.alpha(env.colors.accent, a);
  for (let i = 0; i < count; i++) {
    const fx = x + ((i * 0.6180339 + salt * 0.37) % 1) * w;
    const fy = y + ((i * 0.7548777 + salt * 0.19) % 1) * h;
    g.fillRect(fx, fy, 1.5, 1.5);
  }
}

function stone(g, env, x, y, r, tilt, a) {
  g.fillStyle = env.alpha(env.colors.muted, a);
  g.beginPath();
  g.ellipse(x, y, r * 1.3, r * 0.8, tilt, 0, Math.PI * 2);
  g.fill();
}

/* ---- the core: layers, a band of stones, a water line -------------------------------------- */

function corePlan(env) {
  const n = env.int(4, 6);
  const layers = [];
  const kinds = [];
  for (let i = 0; i < n; i++) {
    layers.push(env.int(6, 28));
    kinds.push(i === 0 ? 0 : env.int(1, KINDS.length - 1));
  }
  return { kind: 'core', layers, kinds, band: env.int(1, n - 2), water: env.int(1, n - 1) };
}

function carriedCore(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'core' || !Array.isArray(p.layers) || !Array.isArray(p.kinds)) return null;
  const n = p.layers.length;
  if (n < 4 || n > 6 || p.kinds.length !== n) return null;
  const layers = p.layers.map(Number);
  const kinds = p.kinds.map(Number);
  if (!layers.every((t) => Number.isInteger(t) && t >= 3 && t <= 40)) return null;
  if (!kinds.every((k) => Number.isInteger(k) && k >= 0 && k < KINDS.length)) return null;
  const band = Number(p.band);
  const water = Number(p.water);
  if (!Number.isInteger(band) || band < 1 || band > n - 2) return null;
  if (!Number.isInteger(water) || water < 1 || water > n - 1) return null;
  return { kind: 'core', layers, kinds, band, water };
}

function totalOf(plan) {
  return plan.layers.reduce((sum, t) => sum + t, 0);
}

function waterDepth(plan) {
  let depth = 0;
  for (let i = 0; i < plan.water; i++) depth += plan.layers[i];
  return depth;
}

function coreTitle(plan) {
  return 'a reading of the core: ' + WORDS[plan.layers.length] + ' layers';
}

function coreGeometry(w, h, plan) {
  const top = h * 0.12;
  const bottom = h * 0.9;
  return { top, bottom, left: w * 0.24, right: w * 0.76, scale: (bottom - top) / totalOf(plan) };
}

function layerTone(env, k) {
  const c = env.colors;
  switch (k) {
    case 0: return env.mix(c.bg2, c.accent2, 0.3);
    case 1: return env.mix(env.mix(c.bg2, c.accent2, 0.2), c.bg, 0.25);
    case 2: return env.mix(c.bg2, c.muted, 0.3);
    case 3: return env.mix(c.bg2, c.accent, 0.22);
    case 4: return env.mix(c.bg2, c.fg, 0.3);
    default: return env.mix(c.bg, c.bg2, 0.6);
  }
}

// The live state of a core: the root once it is grown, the caption, the clock and the solve; the
// readings and the bracket (marks(), recount()); and `wave`, how far round its turn a card's water
// line has gone (animate), 0 in the piece, whose water line is still.
function coreBlank(caption) {
  return { root: null, caption, t: 0, doneAt: -1, wave: 0, reads: marks(0x2a, 0.8),
    bar: { base: 0x2b, span: 0.8, n: 0, runs: [], said: 0 } };
}

function drawCore(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = coreGeometry(w, h, plan);
  const m = Math.min(w, h);
  const size = Math.max(10, Math.min(14, Math.round(m * 0.036)));
  const small = Math.max(9, size - 2);
  // The finale: one roll and one clock, so the dark, the day, the water and the root all step on
  // the same moments.
  const fin = roll(rite, 0xf1, 0);
  const k = finale(s, fin, reduced);
  sky(g, w, h, env, geo.top, k, fin);
  write(g, 'surface', w * 0.5, geo.top - size * 0.9, small, env.alpha(c.muted, 0.9));
  const colW = geo.right - geo.left;
  let y = geo.top;
  const depth = waterDepth(plan);
  plan.layers.forEach((t, i) => {
    const lh = t * geo.scale;
    const stones = i === plan.band;
    g.fillStyle = stones ? env.mix(c.bg, c.bg2, 0.5) : layerTone(env, plan.kinds[i]);
    g.fillRect(geo.left, y, colW, lh);
    flecks(g, env, geo.left, y, colW, lh, Math.round((8 + t * 1.4) * v.density), i, 0.14);
    if (stones) {
      const count = Math.max(4, Math.round((5 + colW / 24) * v.density));
      for (let j = 0; j < count; j++) {
        const sx = geo.left + colW * 0.06 + ((j * 0.6180339 + 0.11) % 1) * colW * 0.88;
        const sy = y + lh * 0.2 + ((j * 0.7548777 + 0.41) % 1) * lh * 0.6;
        stone(g, env, sx, sy, Math.min(lh * 0.3, m * (0.012 + ((j * 0.37) % 1) * 0.02) * v.scale), ((j * 0.53) % 1) * 0.8 - 0.4, 0.5);
      }
    }
    g.strokeStyle = env.alpha(c.bg, 0.6);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(geo.left, y + lh);
    g.lineTo(geo.right, y + lh);
    g.stroke();
    // Its name to the left, its thickness to the right.
    write(g, stones ? 'stones' : KINDS[plan.kinds[i]], geo.left - size * 0.6, y + lh / 2, small, stones ? c.accent2 : env.alpha(c.fg, 0.85), 'right');
    write(g, t + ' cm', geo.right + size * 0.6, y + lh / 2, small, env.alpha(c.fg, 0.95), 'left');
    y += lh;
  });
  // The visitor's readings, sealed on the drawing: a mark where they say the water stands, coming
  // behind the piece's edge on the roll of that reading while the one said before goes back behind
  // the same edge from as far as it had come; and the bracket down the layers they count, one bar
  // whose changed part alone is sealed on or taken back. The bracket is laid in the solid its
  // translucent accent made over the bare ground beside the core, so where a run going and a run
  // coming cross for a moment the bar is still one colour.
  sealMarks(g, s.reads, rite, s, reduced, (read) => {
    const ry = geo.top + Math.max(0, Math.min(totalOf(plan), read)) * geo.scale;
    return { x: geo.left - size * 0.3, y: ry - 2, w: colW + size * 0.6, h: 4 };
  }, env.alpha(c.accent, 0.55));
  if (s.bar.runs.length) {
    const down = (count) => {
      let span = 0;
      for (let i = 0; i < Math.min(plan.layers.length, Math.max(0, count)); i++) span += plan.layers[i] * geo.scale;
      return geo.top + span;
    };
    const bar = s.bar;
    const tone = env.mix(env.mix(c.bg, c.bg2, 0.25), c.accent2, 0.7);
    // The runs wholly on are one stretch each where they meet, so the bar has no seams.
    const whole = [];
    g.fillStyle = tone;
    for (const r of bar.runs) {
      const got = r.from + (r.to - r.from) * roll(rite, bar.base, r.n).stair(came(s, r.at, bar.span, reduced));
      if (got >= 1) whole.push([r.lo, r.hi]);
      else if (got > 0) roll(rite, bar.base, r.n).paint(g, geo.left - 5, down(r.lo), 4, down(r.hi) - down(r.lo), got, tone);
    }
    whole.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < whole.length; i++) {
      let hi = whole[i][1];
      const lo = whole[i][0];
      while (i + 1 < whole.length && whole[i + 1][0] <= hi) hi = Math.max(hi, whole[++i][1]);
      g.fillStyle = tone;
      g.fillRect(geo.left - 5, down(lo), 4, down(hi) - down(lo));
    }
  }
  // The water, risen to its line at the finale: water finds its level, so its edge is a level one,
  // climbing from the foot of the core to the line on the finale's treads, never a wash.
  const wy = geo.top + depth * geo.scale;
  if (k > 0) {
    const from = geo.bottom - (geo.bottom - wy) * k;
    g.fillStyle = env.alpha(c.accent, 0.28);
    g.fillRect(geo.left, from, colW, geo.bottom - from);
  }
  // The water line, wavy, at a layer boundary, and still in the piece: the water comes to it, not
  // it to the water. On a card in motion its wave goes round once (s.wave) and rests as painted.
  g.strokeStyle = c.accent;
  g.lineWidth = 2;
  g.beginPath();
  const amp = Math.max(1.5, m * 0.006);
  for (let x = geo.left - size * 0.4; x <= geo.right + size * 0.4; x += 3) {
    const yy = wy + Math.sin((x / m) * 40 + (v.turn + (s.wave || 0) % 1) * TAU) * amp;
    if (x === geo.left - size * 0.4) g.moveTo(x, yy);
    else g.lineTo(x, yy);
  }
  g.stroke();
  write(g, 'water', geo.left + colW * 0.5, wy - small * 0.8, small, c.accent);
  // The column's edges.
  g.strokeStyle = env.alpha(c.fg, 0.35);
  g.lineWidth = 1;
  g.strokeRect(geo.left, geo.top, colW, geo.bottom - geo.top);
  // The root, at the finale: down from the surface and round the stones, and its shoot up out of
  // it, as far as each of the finale's treads takes them.
  if (s.root && k > 0) {
    const n = Math.max(2, Math.round(s.root.length * k));
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineCap = 'round';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(s.root[0].x, s.root[0].y);
    for (let i = 1; i < n; i++) g.lineTo(s.root[i].x, s.root[i].y);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.root[0].x, geo.top);
    g.lineTo(s.root[0].x + 3, geo.top - m * 0.04 * k);
    g.stroke();
  }
  daybreak(g, fin, env, w, h, k, 0.1);
  // The caption a solve writes goes at the solve, and the new one is cut on with the finale's
  // first tread.
  if (s.doneAt < 0 || k > 0) write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

// The core as a card shows it, with its water line's wave `wave` of the way round its one turn.
function corePreview(g, w, h, env, plan, wave = 0) {
  const s = coreBlank('how deep is the water? how many layers to the stones?');
  s.wave = wave;
  drawCore(g, w, h, env, plan, s, env.variant);
}

const RIPPLE = 2.4; // seconds a core card's wave takes to go round, and so how long the card moves

// How far round its one turn a core card's wave has gone t seconds into its motion: 0 to 1, in the
// ratchet's even clicks, one per tread of the roll. The clock is read one click ahead, so the
// ratchet's opening hold is spent before the card is seen: the first click lands on the first
// moving frame, and the last (the wave whole round, as painted) a click before the run is over.
function rippled(rite, t) {
  if (!(t > 0)) return 0;
  const clicks = Math.max(1, Math.round(rite.treads) || 1);
  return rite.ratchet(Math.min(1, (t / RIPPLE) * (clicks / (clicks + 1)) + 1 / (clicks + 1)));
}

function corePiece(env, plan) {
  // The water table is read off a drawn scale, so it is a measured answer: the difficulty says
  // how many centimetres out a reading may be. The layer count is a count, so it is exact.
  const margin = asked(env).margin;
  const n = plan.layers.length;
  const total = totalOf(plan);
  const depth = waterDepth(plan);
  const s = coreBlank('drawn to scale; the thicknesses are written');
  const draw = (c) => drawn(s, c, () => drawCore(c.g, c.w, c.h, c, plan, s, env.variant));
  return {
    title: coreTitle(plan),
    brief: 'A reading of the ground. A core from the bed, drawn to scale: ' + WORDS[n] + ' layers, each with its thickness in centimetres written beside it. One layer is a band of stones. The wavy line is where the water stands. The band is a layer of its own and is not one a root passes through.',
    goal: 'Read how deep the water table stands and how many layers a root passes through before it meets the stones.',
    aspect: '4 / 5',
    checkLabel: 'read the core',
    steps: [
      { id: 'water', ask: 'the water table, below the surface', kind: 'number', min: 0, max: total, step: 1, unit: 'cm' },
      { id: 'layers', ask: 'layers a root passes through before the stones', kind: 'number', min: 0, max: n, step: 1, unit: 'layers' }
    ],
    solution: { water: depth, layers: plan.band },
    check(c) {
      const water = Math.round(Number(c.value('water')));
      const layers = Math.round(Number(c.value('layers')));
      const waterRight = Math.abs(water - depth) <= margin;
      const layersRight = layers === plan.band;
      if (waterRight && layersRight) {
        return { solved: true, say: 'the core reads true: water at ' + depth + ' cm, stones under ' + WORDS[plan.band] + ' layer' + (plan.band === 1 ? '' : 's') };
      }
      const parts = [];
      if (!waterRight) parts.push(water < depth ? 'the water stands deeper than that' : 'the water stands shallower than that');
      else parts.push('the water is read right');
      if (!layersRight) parts.push(layers < plan.band ? 'a root goes through more layers than that before the stones' : 'a root meets the stones sooner than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(LINES[0]);
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'water') {
        const read = Math.round(Number(value));
        // The mark is sealed where the reading now stands, and the one before is taken back from
        // as far as it had come, on a roll of this reading's own. The same reading again changes
        // nothing.
        choose(s.reads, Number.isFinite(read) ? read : null, riteOf(c), s, !!c.reduced);
        c.status('water at ' + read + ' cm, you say');
      }
      if (id === 'layers') {
        const counted = Math.round(Number(value));
        // The bracket takes on or gives back only the layers the new count differs by.
        recount(s.bar, Number.isFinite(counted) ? Math.max(0, Math.min(n, counted)) : 0, riteOf(c), s, !!c.reduced);
        c.status(counted + ' layers to the stones, you say');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) {
        s.doneAt = s.t;
        s.dirty = true;
      }
      // The finale runs on the piece's clock; a visitor who asked for less motion is shown where
      // it ends: the water at its line, the root grown, the dark lifted.
      return framed(s, c, draw);
    },
    end(c) {
      // The root: down to the band, then sideways along it, because that is what roots do.
      const geo = coreGeometry(c.w, c.h, plan);
      let bandTop = geo.top;
      for (let i = 0; i < plan.band; i++) bandTop += plan.layers[i] * geo.scale;
      const path = [];
      let x = c.w * (0.42 + c.rnd() * 0.16);
      let y = geo.top;
      const step = Math.max(3, geo.scale * 2);
      while (y < bandTop - step) {
        path.push({ x, y });
        x += (c.rnd() - 0.5) * step * 1.2;
        y += step * (0.7 + c.rnd() * 0.6);
      }
      const drift = x < c.w / 2 ? -1 : 1;
      for (let i = 0; i < 14; i++) {
        path.push({ x, y });
        x += drift * step * (0.8 + c.rnd() * 0.6);
        y += (c.rnd() - 0.3) * step * 0.5;
        if (x < geo.left + 4 || x > geo.right - 4) break;
      }
      s.root = path;
      s.caption = 'water at ' + depth + ' cm; the root went sideways at the stones';
      if (s.doneAt < 0) s.doneAt = s.t;
      s.dirty = true;
      c.status('Read right. The root meets the stones and goes sideways for a while first. ' + LINES[1]);
    }
  };
}

/* ---- the mix: two bags and a bed ----------------------------------------------------------- */

function shareOf(a, b, parts) {
  return (parts * a + (10 - parts) * b) / 10;
}

function mixPlan(env) {
  const a = env.int(1, 9) * 10;
  const bags = Array.from({ length: 9 }, (_, i) => (i + 1) * 10)
    .filter((share) => Math.abs(share - a) >= 30);
  return { kind: 'mix', a, b: env.pick(bags), parts: env.int(1, 9) };
}

function carriedMix(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'mix') return null;
  const a = Number(p.a);
  const b = Number(p.b);
  const parts = Number(p.parts);
  if (![a, b, parts].every(Number.isInteger)) return null;
  if (a < 5 || a > 95 || b < 5 || b > 95 || Math.abs(a - b) < 20) return null;
  if (parts < 1 || parts > 9 || !Number.isInteger(shareOf(a, b, parts))) return null;
  return { kind: 'mix', a, b, parts };
}

function mixTitle(plan) {
  return 'the blend for the bed: ' + plan.a + ' and ' + plan.b + ' per cent sand';
}

function bag(g, env, x, y, r, share, name, tilt, density, size) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = soilTone(env, share);
  g.beginPath();
  g.roundRect(-r, -r * 0.8, r * 2, r * 1.7, r * 0.3);
  g.fill();
  flecks(g, env, -r * 0.9, -r * 0.7, r * 1.8, r * 1.5, Math.round((6 + share * 0.5) * density), share, 0.35);
  g.strokeStyle = env.alpha(c.fg, 0.45);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(-r, -r * 0.8, r * 2, r * 1.7, r * 0.3);
  g.stroke();
  // The tied neck.
  g.fillStyle = env.alpha(c.muted, 0.6);
  g.beginPath();
  g.ellipse(0, -r * 0.82, r * 0.45, r * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  write(g, name, 0, 0, Math.round(r * 0.8), c.bg, 'center', '600');
  g.restore();
  write(g, share + '% sand', x, y + r * 1.15 + size * 0.8, size, env.alpha(c.fg, 0.95));
}

function mixBlank(parts, caption) {
  // Each cup rests on one soil (`under`) with the soils being laid over it, or taken back off it,
  // behind the piece's edge (`over`): a layer wholly laid becomes what the cup rests on. `blend` is
  // the share of the soil the bed was last given (-1 before the solve), and `relaid` the blends
  // laid over the solved one as the visitor goes on mixing, each { share, at, n }, the n-th of
  // `blends`; `captionAt` is when the caption one of them wrote was cut on.
  const cups = Array.from({ length: 10 }, (_, i) => ({ under: cupOf(parts, i), over: [], at: -1, n: 0 }));
  return { parts, partsAt: -1, sets: 0, cups, blend: -1, relaid: [], blends: 0, ruled: [], ruledAt: [], caption,
    captionAt: -1, t: 0, doneAt: -1 };
}

// What a cup holds: null before a is set, else bag A for the first `parts` cups and bag B after.
function cupOf(parts, i) {
  return parts == null ? null : i < parts ? 'A' : 'B';
}

const POUR = 0.9; // seconds a cup takes to change its soil
const BLEND = 1.2; // seconds a blend mixed after the solve takes to be laid over the bed

function laid(o, rite, s, reduced) {
  return o.from + (o.to - o.from) * roll(rite, 0x10, o.n).stair(came(s, o.at, POUR, reduced));
}

// A set of a: every cup whose bag changes takes the new soil from where it stands now, on this
// set's roll. A layer still coming that the cup no longer wants goes back behind the edge as far
// as it had come; one going back that is wanted again comes on again from there; and a soil the
// cup neither rests on nor is getting is laid over whatever is showing. So a quick second set
// never makes a cup jump to its last soil before it changes again.
function pour(s, parts, rite, reduced) {
  s.sets += 1;
  s.cups.forEach((cup, i) => {
    const want = cupOf(parts, i);
    let over = [];
    for (const o of cup.over) {
      const c = laid(o, rite, s, reduced);
      if (o.to === 1 && c >= 1) {
        cup.under = o.bag;
        over = [];
      } else if (!(o.to === 0 && c <= 0)) over.push(o);
    }
    cup.over = over;
    const heading = over.filter((o) => o.to === 1);
    const now = heading.length ? heading[heading.length - 1].bag : cup.under;
    if (now === want) return;
    const turn = (o, to) => {
      if (o.to === to) return;
      o.from = laid(o, rite, s, reduced);
      o.to = to;
      o.at = s.t;
      o.n = s.sets;
    };
    const keep = cup.under === want ? -1 : over.map((o) => o.bag).lastIndexOf(want);
    if (cup.under === want || keep >= 0) over.forEach((o, j) => turn(o, j === keep ? 1 : j > keep ? 0 : o.to));
    else over.push({ bag: want, from: 0, to: 1, at: s.t, n: s.sets });
    cup.at = s.t;
    cup.n = s.sets;
  });
}

function drawMix(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const m = Math.min(w, h);
  const size = Math.max(10, Math.min(14, Math.round(m * 0.036)));
  const small = Math.max(9, size - 2);
  const target = shareOf(plan.a, plan.b, plan.parts);
  // The finale: one roll and one clock, so the dark, the day and the blend come behind one edge
  // on the same moments, and the water drains after on that roll's treads.
  const fin = roll(rite, 0xbe, 0);
  const k = finale(s, fin, reduced);
  sky(g, w, h, env, h * 0.62, k, fin);
  const r = m * 0.13 * Math.min(1.1, Math.max(0.9, v.scale));
  const tilt = (v.turn - 0.5) * 0.12;
  bag(g, env, w * 0.27, h * 0.17, r, plan.a, 'A', tilt, v.density, small);
  bag(g, env, w * 0.73, h * 0.17, r, plan.b, 'B', -tilt, v.density, small);
  write(g, 'a parts of A with 10 - a parts of B', w / 2, h * 0.38, small, env.alpha(c.muted, 0.95));
  // Ten cups, the first `parts` of them from bag A. A cup that changed bag takes its new soil over
  // what it showed behind the piece's edge, on the roll of that set (pour()), and its letter goes
  // at the set and is cut on at that roll's moment.
  const cupW = (w * 0.76) / 10;
  const cupH = m * 0.05;
  const cy = h * 0.45;
  const tone = (bagName) => (bagName == null ? env.alpha(c.muted, 0.12) : soilTone(env, bagName === 'A' ? plan.a : plan.b));
  for (let i = 0; i < 10; i++) {
    const x = w * 0.12 + i * cupW;
    const cup = s.cups[i];
    const now = cupOf(s.parts, i);
    g.fillStyle = tone(cup.under);
    g.fillRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    for (const o of cup.over) {
      const got = laid(o, rite, s, reduced);
      if (got > 0) roll(rite, 0x10, o.n).paint(g, x + cupW * 0.08, cy, cupW * 0.84, cupH, got, tone(o.bag));
    }
    g.strokeStyle = env.alpha(c.fg, 0.4);
    g.lineWidth = 1;
    g.strokeRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    if (now != null && roll(rite, 0x10, cup.n).flicker(came(s, cup.at, POUR, reduced))) {
      write(g, now, x + cupW / 2, cy + cupH / 2, Math.max(8, Math.round(cupH * 0.55)), c.bg, 'center', '600');
    }
  }
  // The count under the cups goes with the set that changed it and is cut on again at that roll's
  // moment, so old words never turn straight into new ones.
  if (roll(rite, 0x10, s.sets).flicker(came(s, s.partsAt, POUR, reduced))) write(g, s.parts == null ? 'how many of the ten from A?' : 'a = ' + s.parts, w / 2, cy + cupH + small * 1.1, small, env.alpha(c.fg, 0.9));
  // The blends the shed has ruled out, as ticks along a = 0..10, each cut on at one moment of its
  // own roll once it is struck.
  if (s.ruled && s.ruled.length) {
    const ty = cy + cupH + small * 2.2;
    const tw = w * 0.5;
    for (const a of s.ruled) {
      const at = s.ruled.indexOf(a);
      if (!roll(rite, 0x30, at).flicker(came(s, s.ruledAt[at], 0.7, reduced))) continue;
      const tx = w * 0.25 + (a / 10) * tw;
      write(g, 'a=' + a, tx, ty, Math.max(8, small - 2), env.alpha(c.accent, 0.9));
      g.strokeStyle = env.alpha(c.accent, 0.9);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(tx - small * 0.9, ty);
      g.lineTo(tx + small * 0.9, ty);
      g.stroke();
    }
  }
  // The bed, which wants its share and takes the blend at the finale: the blend comes over the bare
  // bed behind the finale's edge, the one the day comes behind, and then the water drains out of it.
  // Once it is solved the visitor may go on mixing, and each blend they make is laid over the soil
  // lying there behind the same edge, on a roll of that blend's own across the bed. Each comes in
  // wet, its grit and its water with it, and once it lies there its water drains out by its level,
  // falling in treads: faster the sandier it is. Only what shows is drawn: the topmost soil that has
  // wholly landed (or the bare bed, before any has), and whatever is still coming over it.
  const bx = w * 0.14;
  const by = h * 0.62;
  const bw = w * 0.72;
  const bh = h * 0.28;
  write(g, 'the bed wants ' + target + '% sand', w / 2, by - small * 1.1, size, c.accent2);
  const layers = s.blend >= 0 ? [{ share: target, at: s.doneAt, n: 0 }].concat(s.relaid) : [];
  const rollOf = (layer) => (layer.n ? roll(rite, 0xbe, layer.n) : fin);
  const spanOf = (layer) => (layer.n ? BLEND : FINALE);
  const come = [];
  let base = -1;
  for (let i = layers.length - 1; i >= 0; i--) {
    come[i] = layers[i].n ? rollOf(layers[i]).stair(came(s, layers[i].at, BLEND, reduced)) : k;
    if (come[i] >= 1) {
      base = i;
      break;
    }
  }
  if (base < 0) {
    g.fillStyle = env.mix(c.bg, c.bg2, 0.6);
    g.fillRect(bx, by, bw, bh);
    flecks(g, env, bx, by, bw, bh, Math.round(16 * v.density), 7, 0.12);
    write(g, '?', w / 2, by + bh / 2, size * 2, env.alpha(c.muted, 0.5), 'center', '600');
  }
  for (let i = Math.max(0, base); i < layers.length; i++) {
    const layer = layers[i];
    if (!(come[i] > 0)) continue;
    // The bed is clipped to the part the edge has passed and the soaked soil is laid inside: the
    // solved blend's edge is the finale's, crossing the whole drawing with the day; a later
    // blend's crosses the bed alone.
    g.save();
    g.beginPath();
    g.rect(bx, by, bw, bh);
    g.clip();
    if (come[i] < 1) {
      g.beginPath();
      if (layer.n) rollOf(layer).region(g, bx, by, bw, bh, come[i]);
      else fin.region(g, 0, 0, w, h, come[i]);
      g.clip();
    }
    g.fillStyle = soilTone(env, layer.share);
    g.fillRect(bx, by, bw, bh);
    flecks(g, env, bx, by, bw, bh, Math.round((20 + layer.share * 0.8) * v.density), 7, 0.3);
    // The water keeps a level edge, so its level falls through the bed to the bed's foot on the
    // blend's own treads once the blend lies there, and is gone.
    const drain = came(s, layer.at + spanOf(layer), 1 / (0.08 + (layer.share / 100) * 0.22), reduced);
    const level = Math.max(0, 1 - rollOf(layer).stair(drain));
    if (level > 0) {
      g.fillStyle = env.alpha(c.accent, 0.3);
      g.fillRect(bx, by + bh * (1 - level), bw, bh * level);
    }
    g.restore();
  }
  g.strokeStyle = env.alpha(c.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(bx, by, bw, bh);
  daybreak(g, fin, env, w, h, k, 0.1);
  // The caption a solve writes goes at the solve, and the new one is cut on with the finale's
  // first tread; the one a later blend writes goes at that blend, and is cut on at its moment.
  const lastBlend = s.relaid.length ? s.relaid[s.relaid.length - 1] : null;
  if (lastBlend && s.captionAt >= 0 ? roll(rite, 0xbe, lastBlend.n).flicker(came(s, s.captionAt, BLEND, reduced))
    : s.doneAt < 0 || k > 0) write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

function mixPreview(g, w, h, env, plan) {
  drawMix(g, w, h, env, plan, mixBlank(null, 'a sandier soil drains faster'), env.variant);
}

function mixPiece(env, plan) {
  const target = shareOf(plan.a, plan.b, plan.parts);
  const drains = plan.b > plan.a ? 'faster' : 'slower';
  const helps = asked(env).helps;
  // The blends the shed will rule out for you, from the ends inward: one per press, as many as
  // the difficulty allows. A ruled-out blend is help, not the answer.
  const rulings = [0, 10, 1, 9, 2, 8, 3, 7, 4, 6, 5].filter((k) => k !== plan.parts);
  const s = mixBlank(null, 'a sandier soil drains faster');
  const draw = (c) => drawn(s, c, () => drawMix(c.g, c.w, c.h, c, plan, s, env.variant));
  return {
    title: mixTitle(plan),
    brief: 'An offering for the bed, from two bags of soil. Bag A is ' + plan.a + '% sand and bag B is ' + plan.b + '%; the bed wants ' + target + '%. Mixing a parts of A with 10 - a parts of B makes a soil whose sand share is the two shares averaged, weighted by the parts. A sandier soil drains faster.',
    goal: 'Find the parts of A in ten that give the bed the share it wants, and say whether that blend drains faster or slower than bag A.',
    aspect: '4 / 5',
    checkLabel: 'mix it',
    steps: [
      { id: 'parts', ask: 'parts of A, in ten', kind: 'number', min: 0, max: 10, step: 1, unit: 'of 10' },
      { id: 'drains', ask: 'against bag A, the blend', kind: 'choice', options: DRAINS },
      { id: 'hint', ask: 'one blend ruled out', kind: 'press', count: 1, label: 'rule one out', optional: true }
    ],
    solution: { parts: plan.parts, drains },
    check(c) {
      const p = Math.round(Number(c.value('parts')));
      const partsRight = p === plan.parts;
      const drainsRight = c.value('drains') === drains;
      if (partsRight && drainsRight) {
        return { solved: true, say: 'the bed takes it: a = ' + plan.parts + ', the blend is ' + target + '% sand, and it drains ' + drains + ' than bag A' };
      }
      const share = shareOf(plan.a, plan.b, Math.max(0, Math.min(10, p)));
      const parts = [];
      if (!partsRight) parts.push(share > target ? 'that blend is sandier than the bed wants' : 'that blend is less sandy than the bed wants');
      else parts.push('the parts are right');
      if (!drainsRight) parts.push('it drains the other way from what you said');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('bag A is ' + plan.a + '% sand, bag B is ' + plan.b + '%; the bed wants ' + target + '%');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'hint') {
        const next = s.ruled.length < helps ? rulings.find((k) => !s.ruled.includes(k)) : undefined;
        if (next !== undefined) {
          s.ruled.push(next);
          s.ruledAt.push(s.t);
          c.hint();
          c.status('a = ' + next + ' makes ' + shareOf(plan.a, plan.b, next) + '% sand, and the bed wants ' + target + '%');
        } else if (s.ruled.length >= helps) {
          c.status('that is all the shed will rule out at this difficulty; average the two shares yourself');
        } else {
          c.status('every other blend has been ruled out; the one left is the one the bed wants');
        }
      }
      if (id === 'parts') {
        const p = Math.round(Number(value));
        const next = Number.isFinite(p) ? Math.max(0, Math.min(10, p)) : 0;
        if (next !== s.parts) {
          // The cups that change bag take their new soil, on a roll of this set's own.
          s.parts = next;
          s.partsAt = s.t;
          pour(s, next, riteOf(c), !!c.reduced);
          if (c.done && s.blend >= 0) {
            // Solved, the bed goes on taking what is mixed: the new blend is laid over the soil
            // lying there, on a roll of its own, and drains at its own pace.
            s.blend = shareOf(plan.a, plan.b, next);
            s.blends += 1;
            s.relaid.push({ share: s.blend, at: s.t, n: s.blends });
            s.caption = s.blend + '% sand: ' + (s.blend === plan.a
              ? 'the blend and bag A drain at the same rate'
              : 'it drains ' + (s.blend > plan.a ? 'faster' : 'slower') + ' than bag A');
            s.captionAt = s.t;
          }
        }
        c.status(s.parts + ' of the ten from bag A, ' + (10 - s.parts) + ' from bag B');
      }
      if (id === 'drains') c.status('you say it drains ' + value + ' than bag A');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) {
        s.doneAt = s.t;
        s.dirty = true;
      }
      // The water goes through in about four seconds at pure sand, slower the less sand there is;
      // a visitor who asked for less motion is shown the bed drained and the dark lifted.
      return framed(s, c, draw);
    },
    end(c) {
      s.blend = target;
      if (s.parts == null) {
        s.parts = plan.parts;
        s.partsAt = s.t;
        pour(s, plan.parts, riteOf(c), !!c.reduced);
      }
      s.caption = target + '% sand: it drains ' + drains + ' than bag A';
      if (s.doneAt < 0) s.doneAt = s.t;
      s.dirty = true;
      c.status('Mixed and watered. ' + LINES[3]);
    }
  };
}

/* ---- the route: follow a root through the layers -------------------------------------------- */

function routePlan(env) {
  const n = env.int(4, 6);
  const start = env.int(1, 3);
  const arrows = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < 4; col++) {
      const ways = col === 0 ? [0, 1] : col === 3 ? [-1, 0] : [-1, 0, 1];
      arrows.push(row === 0 && col === start ? -1 : env.pick(ways));
    }
  }
  return { kind: 'route', n, start, arrows };
}

function carriedRoute(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'route' || !Number.isInteger(p.n) || p.n < 4 || p.n > 6) return null;
  if (!Number.isInteger(p.start) || p.start < 1 || p.start > 3) return null;
  if (!Array.isArray(p.arrows) || p.arrows.length !== p.n * 4 || p.arrows[p.start] !== -1) return null;
  if (!p.arrows.every((way, i) => Number.isInteger(way) && way >= -1 && way <= 1 && i % 4 + way >= 0 && i % 4 + way < 4)) return null;
  return { kind: 'route', n: p.n, start: p.start, arrows: p.arrows.slice() };
}

function routePath(plan) {
  const path = [plan.start];
  for (let row = 0; row < plan.n; row++) path.push(path[row] + plan.arrows[row * 4 + path[row]]);
  return path;
}

function routeRows(plan) {
  return Array.from({ length: plan.n }, (_, row) => 'row ' + (row + 1) + ': '
    + plan.arrows.slice(row * 4, row * 4 + 4).map((way) => ['L', 'D', 'R'][way + 1]).join(' ')).join('; ');
}

function routeTitle(plan) {
  return 'the root path: ' + plan.n + ' layers';
}

function routeBlank(path) {
  return { path, taps: marks(0x40, 0.9), hints: marks(0x50, 0.9), hintRow: null, exits: marks(0x60, 0.8), t: 0, doneAt: -1 };
}

function drawRoute(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const top = h * 0.2;
  const left = w * 0.15;
  const cell = w * 0.7 / 4;
  const layer = h * 0.6 / plan.n;
  const size = Math.max(10, Math.min(15, Math.round(Math.min(w, h) * 0.035)));
  // The finale: one roll and one clock, so the dark, the day and the root step on the same moments.
  const fin = roll(rite, 0x90, 0);
  const k = finale(s, fin, reduced);
  sky(g, w, h, env, top, k, fin);
  write(g, 'root enters at ' + COLUMNS[plan.start], w / 2, top * 0.48, size, c.accent2);
  for (let col = 0; col < 4; col++) write(g, COLUMNS[col], left + (col + 0.5) * cell, top - size * 0.55, size, c.fg);
  // The tapped cell is sealed: the piece's edge passes over it on the roll of that tap and its ring
  // is cut on at that roll's moment; the cell tapped before goes back behind the same edge from as
  // far as it had come, and its ring goes with the tap. The hint's cell seals the same way, on a
  // roll of its own.
  const tapped = markedNow(s.taps, rite, s, reduced);
  const hinted = markedNow(s.hints, rite, s, reduced);
  const seal = env.alpha(c.accent, 0.26);
  const boxOf = (idx) => ({ x: left + (idx % 4) * cell + 3, y: top + Math.floor(idx / 4) * layer + 3, w: cell - 6, h: layer - 6 });
  for (let row = 0; row < plan.n; row++) {
    write(g, String(row + 1), left - size * 0.8, top + (row + 0.5) * layer, size, c.muted, 'right');
    for (let col = 0; col < 4; col++) {
      const x = left + col * cell;
      const y = top + row * layer;
      const idx = row * 4 + col;
      g.fillStyle = layerTone(env, row % (KINDS.length - 1) + 1);
      g.fillRect(x, y, cell, layer);
      flecks(g, env, x, y, cell, layer, Math.round(4 * v.density), idx, 0.17);
      stone(g, env, x + cell * 0.5, y + layer * 0.5, Math.min(cell, layer) * 0.22, v.turn, 0.32);
    }
  }
  sealMarks(g, s.taps, rite, s, reduced, boxOf, seal);
  sealMarks(g, s.hints, rite, s, reduced, boxOf, seal);
  for (let row = 0; row < plan.n; row++) {
    for (let col = 0; col < 4; col++) {
      const x = left + col * cell;
      const y = top + row * layer;
      const idx = row * 4 + col;
      const way = plan.arrows[idx];
      const ring = idx === tapped || idx === hinted;
      g.strokeStyle = env.alpha(c.fg, 0.45);
      g.lineWidth = 1;
      g.strokeRect(x, y, cell, layer);
      write(g, ['L', 'D', 'R'][way + 1], x + cell * 0.5, y + layer * 0.5,
        Math.max(12, Math.min(24, cell * 0.36 * v.scale)), c.accent2, 'center', '600');
      if (ring) {
        g.strokeStyle = c.accent;
        g.lineWidth = 2.5;
        g.strokeRect(x + 3, y + 3, cell - 6, layer - 6);
      }
    }
  }
  // The column the visitor says the root leaves at: a bracket under it, sealed on the roll of
  // that choice; the one said before goes back behind the same edge from as far as it had come.
  sealMarks(g, s.exits, rite, s, reduced,
    (col) => ({ x: left + col * cell + cell * 0.2, y: top + plan.n * layer + 3, w: cell * 0.6, h: 5 }), env.alpha(c.accent, 0.85));
  // The root, at the finale: through the bed a row or more per tread of the finale.
  if (k > 0) {
    const rows = Math.round(k * plan.n);
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(left + (s.path[0] + 0.72) * cell, top);
    for (let row = 0; row < rows; row++) {
      g.lineTo(left + (s.path[row + 1] + 0.72) * cell, top + (row + 1) * layer);
    }
    g.stroke();
  }
  daybreak(g, fin, env, w, h, k, 0.1);
  write(g, 'L: left   D: down   R: right', w / 2, h * 0.91, size, c.fg);
}

function routePreview(g, w, h, env, plan) {
  drawRoute(g, w, h, env, plan, routeBlank(routePath(plan)), env.variant);
}

function routePiece(env, plan) {
  const helps = asked(env).helps;
  const path = routePath(plan);
  const exit = COLUMNS[path[plan.n]];
  const lefts = path.slice(0, plan.n).filter((col, row) => plan.arrows[row * 4 + col] === -1).length;
  const s = routeBlank(path);
  const draw = (c) => drawn(s, c, () => drawRoute(c.g, c.w, c.h, c, plan, s, env.variant));
  return {
    title: routeTitle(plan),
    brief: 'Follow the root from column ' + COLUMNS[plan.start] + ' through the rows from top to bottom. In each cell, L sends it one column left in the next row, D sends it straight down, and R sends it one column right. No arrow leaves the bed. Columns run A to D from left to right. ' + routeRows(plan) + '.',
    goal: 'Name the column where the root leaves the bed and count the L arrows on its path.',
    aspect: '4 / 5',
    checkLabel: 'check the path',
    steps: [
      { id: 'exit', ask: 'column where the root leaves', kind: 'choice', options: COLUMNS.map((label) => ({ label, value: label })) },
      { id: 'lefts', ask: 'left turns along the path', kind: 'number', min: 0, max: plan.n, step: 1, unit: 'turns' },
      // The bed has one thing to say, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'hint', ask: 'one point halfway along the path', kind: 'press', count: 1, label: 'look halfway', optional: true } : null
    ].filter(Boolean),
    solution: { exit, lefts },
    check(c) {
      const right = Number(c.value('exit') === exit) + Number(Number(c.value('lefts')) === lefts);
      return { solved: right === 2, say: right === 2
        ? 'the root leaves at ' + exit + ' after ' + lefts + ' left turn' + (lefts === 1 ? '' : 's')
        : right === 1 ? 'one of the two readings follows the arrows; check the other'
          : 'neither reading follows the arrows yet' };
    },
    start(c) {
      c.status('start at ' + COLUMNS[plan.start] + ' and follow one arrow per row');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'exit') {
        const col = COLUMNS.indexOf(String(value));
        // The bracket moves to the column now said, on a roll of this choice's own.
        choose(s.exits, col >= 0 ? col : null, riteOf(c), s, !!c.reduced);
        c.status('you say the root leaves at ' + value);
      }
      if (id === 'lefts') c.status('you counted ' + value + ' left turns');
      if (id === 'hint') {
        if (s.hintRow === null) {
          s.hintRow = Math.floor(plan.n / 2) - 1;
          choose(s.hints, (s.hintRow + 1) * 4 + path[s.hintRow + 1], riteOf(c), s, !!c.reduced);
          c.hint();
        }
        c.status('after row ' + (s.hintRow + 1) + ', the root enters column ' + COLUMNS[path[s.hintRow + 1]]);
      }
      draw(c);
    },
    tap(x, y, c) {
      const col = Math.floor((x * c.w - c.w * 0.15) / (c.w * 0.7 / 4));
      const row = Math.floor((y * c.h - c.h * 0.2) / (c.h * 0.6 / plan.n));
      if (col < 0 || col >= 4 || row < 0 || row >= plan.n) {
        c.status('tap an arrow in the bed to read it');
        return;
      }
      // The cell tapped before is unsealed while this one seals, on a roll of this tap's own. The
      // cell already sealed, tapped again, is read again and stays as it is: the stage answers
      // the press with its own mark.
      const idx = row * 4 + col;
      choose(s.taps, idx, riteOf(c), s, !!c.reduced);
      c.status('row ' + (row + 1) + ', column ' + COLUMNS[col] + ': '
        + ['left', 'down', 'right'][plan.arrows[idx] + 1]);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) {
        s.doneAt = s.t;
        s.dirty = true;
      }
      return framed(s, c, draw);
    },
    end(c) {
      if (s.doneAt < 0) s.doneAt = s.t;
      s.dirty = true;
      c.status('the root found its way to ' + exit + ' through ' + plan.n + ' layers');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle this card is, and its plan, dealt once from the env's seeded stream and kept with
// that env: the still picture and every frame of the card in motion ask here, so they are one bed
// (js/feed.js on what animate owes a card). The card's last picture, `shown`, is kept beside it,
// apart from the plan, which travels to the stage as the card's `of`.
const dealt = new WeakMap();
const shown = new WeakMap();
function deal(env) {
  let plan = dealt.get(env);
  if (!plan) {
    const roll = env.rnd();
    plan = roll < 0.34 ? corePlan(env) : roll < 0.68 ? mixPlan(env) : routePlan(env);
    dealt.set(env, plan);
  }
  return plan;
}

export default {
  id: 'loam',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'core') {
      corePreview(g, w, h, env, plan);
      shown.set(env, { g, w, h, wave: 0 });
    } else if (plan.kind === 'mix') mixPreview(g, w, h, env, plan);
    else routePreview(g, w, h, env, plan);
  },
  // A core card in motion: its water line's wave goes round once (rippled) and rests as it was
  // painted, so at t = 0 it is the still picture. The canvas is drawn again only when the wave has
  // clicked on; between clicks it already holds the picture. A mix or a route card, a card whose
  // turn is over, and every card for a visitor who asked for less motion are still, and say so.
  animate(g, w, h, env, t) {
    const plan = deal(env);
    if (plan.kind !== 'core' || env.reduced || !(t < RIPPLE)) return false;
    const wave = rippled(riteOf(env), t);
    const last = shown.get(env);
    if (last && last.g === g && last.w === w && last.h === h && last.wave === wave) return true;
    corePreview(g, w, h, env, plan, wave);
    shown.set(env, { g, w, h, wave });
    return true;
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'core') {
      return {
        title: coreTitle(plan),
        mono: plan.layers.map((t, i) => (i === plan.band ? 'stones' : KINDS[plan.kinds[i]]).padEnd(8) + ' ' + t + ' cm').join('\n'),
        text: 'A reading of the ground, drawn to scale. Say how deep the water stands, and how many layers a root passes through before the stones.',
        aspect: '4 / 5',
        paint: (g, w, h, cardEnv) => corePreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (plan.kind === 'route') {
      return {
        title: routeTitle(plan),
        mono: 'root enters at ' + COLUMNS[plan.start] + '\n' + routeRows(plan),
        text: 'Follow L, D and R through the bed. Name the exit column and count the left turns.',
        aspect: '4 / 5',
        paint: (g, w, h, cardEnv) => routePreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const target = shareOf(plan.a, plan.b, plan.parts);
    return {
      title: mixTitle(plan),
      mono: 'bag A    ' + plan.a + '% sand\nbag B    ' + plan.b + '% sand\nthe bed  ' + target + '%',
      text: 'An offering for the bed: a parts of A with 10 - a parts of B. Find a, and say whether the blend drains faster or slower than A.',
      aspect: '4 / 5',
      paint: (g, w, h, cardEnv) => mixPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const core = carriedCore(env);
    if (core) return corePiece(env, core);
    const mix = carriedMix(env);
    if (mix) return mixPiece(env, mix);
    const route = carriedRoute(env);
    if (route) return routePiece(env, route);
    const plan = deal(env);
    return plan.kind === 'core' ? corePiece(env, plan)
      : plan.kind === 'mix' ? mixPiece(env, plan) : routePiece(env, plan);
  }
};
