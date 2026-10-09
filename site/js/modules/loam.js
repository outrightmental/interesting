/* Loam: a cutaway of soil with roots finding their way round the stones. As a card it is one of
   the two puzzles below (paint, spark); as a piece it is that puzzle, and the card it was opened
   from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

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
                bed wants, and no more.
     the route  A root enters a four-column bed. Each cell sends it down-left, straight down or
                down-right into the next layer. Follow it to its exit and count its left turns.
                A look halfway costs a hint; a wrong check says how many readings fit.

   A card and the feature it opens as are one bed: the spark puts the whole plan on its spec as
   `of` -- the layers, the band and the water line, or the two bags and the bed -- and piece(env)
   opens on that rather than rolling another. */

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
   js/stage.js, "The rite"). Nothing in the ground moves along a formula or cuts without a rite.
   The water rises to its line in treads and its body develops through the matte; the root goes
   down the core and through the bed's rows in uneven treads; the water line's wave advances in
   the ratchet's clicks; the dark over the surface lifts by its area, cell by cell in the piece's
   own pattern, and never by a wash. A reading the visitor sets is SEALED on the drawing: a mark
   develops through the matte where they say the water stands, a bracket down the layers they
   count, a bracket under the column they say the root leaves at, the cell they tap in the bed;
   an unset one dissolves back down the same ladder. A cup that changes bag develops its new
   soil over the old through the matte; the blend takes the bed the same way, with a flicker; a
   ruled-out blend, a caption, a hint's answer blink on; and the light over a solved bed develops
   through the matte with a flicker, never a wash. Every change is read against the piece's own
   clock, s.t, which frame() advances: a change made at `since` has come came() of its way,
   which is 1 at once for a visitor who asked for less motion and for whatever stood there from
   the start. Every trigger rolls a fresh rite (rite.at(k) with the count of that trigger in k),
   so a second reading, a second tap, a second mix composes a different stair, matte and flicker
   from the first. */

const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 0, flicker: () => 1, matte: () => true,
  series: (p, n) => Math.max(1, Math.floor(n || 1)), treads: 1, kind: 'none', cell: 4, at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

function fract(x) {
  return x - Math.floor(x);
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The rite rolled afresh for the n-th trigger of one kind of thing: a second press composes
// another stair, matte and flicker from the first.
function roll(rite, base, n) {
  return rite.at(((base | 0) ^ (Math.imul((n | 0) + 1, 0x9e37) | 0)) >>> 0);
}

// The cells of a box the matte lets through at coverage k, filled in the current fillStyle: how a
// surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame stays
// cheap, on a grid fixed to the canvas so the pattern holds still while it grows. `inside` keeps
// the tiling to a shape within the box. At k >= 1 every cell is let through.
function develop(g, rite, x0, y0, bw, bh, k, inside, size) {
  if (k <= 0 || bw <= 0 || bh <= 0) return;
  const cell = size || Math.max(rite.cell, Math.ceil(Math.max(bw, bh) / 28));
  const cx0 = Math.floor(x0 / cell);
  const cy0 = Math.floor(y0 / cell);
  const cx1 = Math.ceil((x0 + bw) / cell);
  const cy1 = Math.ceil((y0 + bh) / cell);
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) {
      const px = cx * cell;
      const py = cy * cell;
      if (inside && !inside(px + cell / 2, py + cell / 2)) continue;
      if (k < 1 && !rite.matte(cx, cy, k)) continue;
      g.fillRect(px, py, cell, cell);
    }
  }
}

// A sealed mark: it develops through the matte while it is set (k climbs) and dissolves back
// down the ladder when it is unset (k falls), each on the roll of that set.
function sealed(g, rite, box, on, p, size) {
  const k = on ? rite.stair(p) : 1 - rite.stair(p);
  if (k <= 0) return;
  develop(g, rite, box.x, box.y, box.w, box.h, k, null, size);
}

// The light that comes over a solved bed: it develops through the matte from the moment of the
// solve, blinking on and dropping out the way the rite's flicker has it, and holds.
function daybreak(g, rite, env, w, h, p, strength) {
  const own = roll(rite, 0xdb, 0);
  const k = own.stair(p);
  if (k <= 0 || !own.flicker(p)) return;
  g.fillStyle = env.alpha(env.colors.accent2, strength || 0.1);
  develop(g, own, 0, 0, w, h, k, null, Math.max(rite.cell, Math.ceil(Math.min(w, h) / 30)));
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
// bed by its area: cells of the day develop through the matte over it, on a stair, never a wash.
function sky(g, w, h, env, top, lift, rite) {
  const c = env.colors;
  const ground = env.mix(c.bg, c.bg2, 0.25);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, w, top);
  if (lift > 0) {
    const own = roll(rite || STILL, 0xa1, 0);
    g.fillStyle = env.alpha(ground, 0.57);
    develop(g, own, 0, 0, w, top, own.stair(lift), null, Math.max((rite || STILL).cell, Math.ceil(w / 40)));
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

function coreBlank(caption) {
  return { fill: 0, grow: 0, lift: 0, root: null, ripple: 0, caption, captionAt: -1, t: 0, doneAt: -1,
    read: null, readAt: -1, reads: 0, counted: null, countedAt: -1, counts: 0 };
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
  sky(g, w, h, env, geo.top, s.lift, rite);
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
  // The visitor's readings, sealed on the drawing: a mark where they say the water stands and a
  // bracket down the layers they count, each developing through the matte on the roll of that
  // reading.
  if (s.read != null && s.readAt >= 0) {
    const own = roll(rite, 0x2a, s.reads);
    const ry = geo.top + Math.max(0, Math.min(totalOf(plan), s.read)) * geo.scale;
    g.fillStyle = env.alpha(c.accent, 0.55);
    sealed(g, own, { x: geo.left - size * 0.3, y: ry - 2, w: colW + size * 0.6, h: 4 }, true, came(s, s.readAt, 0.8, reduced), Math.max(2, rite.cell));
  }
  if (s.counted != null && s.countedAt >= 0) {
    const own = roll(rite, 0x2b, s.counts);
    let span = 0;
    for (let i = 0; i < Math.min(plan.layers.length, Math.max(0, s.counted)); i++) span += plan.layers[i] * geo.scale;
    g.fillStyle = env.alpha(c.accent2, 0.7);
    sealed(g, own, { x: geo.left - 5, y: geo.top, w: 4, h: span }, true, came(s, s.countedAt, 0.8, reduced), Math.max(2, rite.cell));
  }
  // The water, risen to its line at the finale: its level climbs in treads and its body
  // develops through the matte as it comes, never a wash.
  const wy = geo.top + depth * geo.scale;
  if (s.fill > 0) {
    const own = roll(rite, 0xf1, 0);
    const kf = own.stair(s.fill);
    const from = geo.bottom - (geo.bottom - wy) * kf;
    g.fillStyle = env.alpha(c.accent, 0.28);
    develop(g, own, geo.left, from, colW, geo.bottom - from, 0.35 + 0.65 * kf, null, Math.max(rite.cell, Math.ceil(colW / 30)));
  }
  // The water line, wavy, at a layer boundary; its wave advances in the ratchet's clicks, half a
  // turn per cycle, on a fresh roll every cycle.
  const cycle = (s.ripple || 0) / 1.4;
  const phase = (Math.floor(cycle) + roll(rite, 0x77, Math.floor(cycle)).ratchet(fract(cycle))) * Math.PI;
  g.strokeStyle = c.accent;
  g.lineWidth = 2;
  g.beginPath();
  const amp = Math.max(1.5, m * 0.006);
  for (let x = geo.left - size * 0.4; x <= geo.right + size * 0.4; x += 3) {
    const yy = wy + Math.sin((x / m) * 40 + v.turn * TAU + phase) * amp;
    if (x === geo.left - size * 0.4) g.moveTo(x, yy);
    else g.lineTo(x, yy);
  }
  g.stroke();
  write(g, 'water', geo.left + colW * 0.5, wy - small * 0.8, small, c.accent);
  // The column's edges.
  g.strokeStyle = env.alpha(c.fg, 0.35);
  g.lineWidth = 1;
  g.strokeRect(geo.left, geo.top, colW, geo.bottom - geo.top);
  // The root, at the finale: down from the surface and round the stones, in uneven treads.
  if (s.root && s.grow > 0) {
    const own = roll(rite, 0x90, 0);
    const went = own.stair(s.grow);
    const n = Math.max(2, Math.round(s.root.length * went));
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineCap = 'round';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(s.root[0].x, s.root[0].y);
    for (let i = 1; i < n; i++) g.lineTo(s.root[i].x, s.root[i].y);
    g.stroke();
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.root[0].x, geo.top);
    g.lineTo(s.root[0].x + 3, geo.top - m * 0.04 * own.stair(Math.min(1, s.grow * 2)));
    g.stroke();
  }
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.1);
  // The caption blinks on when it changes.
  if (roll(rite, 0xca, 0).flicker(came(s, s.captionAt, 0.8, reduced))) write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

function corePreview(g, w, h, env, plan) {
  drawCore(g, w, h, env, plan, coreBlank('how deep is the water? how many layers to the stones?'), env.variant);
}

function corePiece(env, plan) {
  // The water table is read off a drawn scale, so it is a measured answer: the difficulty says
  // how many centimetres out a reading may be. The layer count is a count, so it is exact.
  const margin = asked(env).margin;
  const n = plan.layers.length;
  const total = totalOf(plan);
  const depth = waterDepth(plan);
  const s = coreBlank('drawn to scale; the thicknesses are written');
  const draw = (c) => drawCore(c.g, c.w, c.h, c, plan, s, env.variant);
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
        // The mark develops afresh where the reading now stands, on a roll of this reading's own.
        s.read = Number.isFinite(read) ? read : null;
        s.readAt = s.t;
        s.reads += 1;
        c.status('water at ' + read + ' cm, you say');
      }
      if (id === 'layers') {
        const counted = Math.round(Number(value));
        s.counted = Number.isFinite(counted) ? counted : null;
        s.countedAt = s.t;
        s.counts += 1;
        c.status(counted + ' layers to the stones, you say');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done) {
        if (s.doneAt < 0) s.doneAt = s.t;
        s.fill = Math.min(1, s.fill + dt * 0.5);
        s.grow = Math.min(1, s.grow + dt * 0.35);
        s.lift = Math.min(1, s.lift + dt * 0.5);
        if (!c.reduced) s.ripple += dt;
      }
      draw(c);
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
      s.captionAt = s.t;
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status('Read right. The root meets the stones and goes sideways for a while first. ' + LINES[1]);
    }
  };
}

/* ---- the mix: two bags and a bed ----------------------------------------------------------- */

function shareOf(a, b, parts) {
  return (parts * a + (10 - parts) * b) / 10;
}

function mixPlan(env) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const a = env.int(2, 18) * 5;
    const b = env.int(2, 18) * 5;
    if (Math.abs(a - b) < 30) continue;
    const parts = env.int(1, 9);
    if (!Number.isInteger(shareOf(a, b, parts))) continue;
    return { kind: 'mix', a, b, parts };
  }
  return { kind: 'mix', a: 20, b: 80, parts: 6 };
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
  return { parts, partsPrev: null, partsAt: -1, sets: 0, blend: -1, drained: 0, lift: 0, ruled: [], ruledAt: [],
    caption, captionAt: -1, t: 0, doneAt: -1 };
}

// What a cup holds: null before a is set, else bag A for the first `parts` cups and bag B after.
function cupOf(parts, i) {
  return parts == null ? null : i < parts ? 'A' : 'B';
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
  sky(g, w, h, env, h * 0.62, s.lift, rite);
  const r = m * 0.13 * Math.min(1.1, Math.max(0.9, v.scale));
  const tilt = (v.turn - 0.5) * 0.12;
  bag(g, env, w * 0.27, h * 0.17, r, plan.a, 'A', tilt, v.density, small);
  bag(g, env, w * 0.73, h * 0.17, r, plan.b, 'B', -tilt, v.density, small);
  write(g, 'a parts of A with 10 - a parts of B', w / 2, h * 0.38, small, env.alpha(c.muted, 0.95));
  // Ten cups, the first `parts` of them from bag A. A cup that changed bag at the last set
  // develops its new soil over the old through the matte, on the roll of that set, and its
  // letter blinks on.
  const cupW = (w * 0.76) / 10;
  const cupH = m * 0.05;
  const cy = h * 0.45;
  const setRite = roll(rite, 0x10, s.sets);
  const setP = came(s, s.partsAt, 0.9, reduced);
  const tone = (bagName) => (bagName == null ? env.alpha(c.muted, 0.12) : soilTone(env, bagName === 'A' ? plan.a : plan.b));
  for (let i = 0; i < 10; i++) {
    const x = w * 0.12 + i * cupW;
    const now = cupOf(s.parts, i);
    const before = s.partsAt >= 0 ? cupOf(s.partsPrev, i) : now;
    const changed = before !== now && setP < 1;
    g.fillStyle = tone(changed ? before : now);
    g.fillRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    if (changed) {
      g.fillStyle = tone(now);
      develop(g, setRite, x + cupW * 0.08, cy, cupW * 0.84, cupH, setRite.stair(setP), null, Math.max(2, rite.cell));
    }
    g.strokeStyle = env.alpha(c.fg, 0.4);
    g.lineWidth = 1;
    g.strokeRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    if (now != null && (!changed || setRite.flicker(setP))) {
      write(g, now, x + cupW / 2, cy + cupH / 2, Math.max(8, Math.round(cupH * 0.55)), c.bg, 'center', '600');
    }
  }
  // The count under the cups blinks on with the set that changed it, never cutting to new words.
  if (setRite.flicker(setP)) write(g, s.parts == null ? 'how many of the ten from A?' : 'a = ' + s.parts, w / 2, cy + cupH + small * 1.1, small, env.alpha(c.fg, 0.9));
  // The blends the shed has ruled out, as ticks along a = 0..10 that blink on when they are
  // struck.
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
  // The bed, which wants its share and takes the blend at the finale: the blend develops over
  // the bare bed through the matte, with a flicker, and the water drains through it in treads.
  const bx = w * 0.14;
  const by = h * 0.62;
  const bw = w * 0.72;
  const bh = h * 0.28;
  write(g, 'the bed wants ' + target + '% sand', w / 2, by - small * 1.1, size, c.accent2);
  const bedRite = roll(rite, 0xbe, 0);
  const bedP = s.blend >= 0 ? came(s, s.doneAt, 1.2, reduced) : 0;
  const bedK = s.blend >= 0 ? bedRite.stair(bedP) * bedRite.flicker(bedP) : 0;
  if (bedK < 1) {
    g.fillStyle = env.mix(c.bg, c.bg2, 0.6);
    g.fillRect(bx, by, bw, bh);
    flecks(g, env, bx, by, bw, bh, Math.round(16 * v.density), 7, 0.12);
    write(g, '?', w / 2, by + bh / 2, size * 2, env.alpha(c.muted, 0.5), 'center', '600');
  }
  if (bedK > 0) {
    g.fillStyle = soilTone(env, s.blend);
    develop(g, bedRite, bx, by, bw, bh, bedK, null, Math.max(rite.cell, Math.ceil(bw / 36)));
    if (bedK >= 1) {
      flecks(g, env, bx, by, bw, bh, Math.round((20 + s.blend * 0.8) * v.density), 7, 0.3);
      // The water, draining through it: faster the sandier it is, its level falling in treads
      // and its body thinning through the matte as it goes.
      const drainRite = roll(rite, 0xd2, 0);
      const level = Math.max(0, 1 - drainRite.stair(s.drained));
      g.fillStyle = env.alpha(c.accent, 0.3);
      develop(g, drainRite, bx, by, bw, bh * 0.5 * level, 0.3 + 0.7 * level, null, Math.max(rite.cell, Math.ceil(bw / 36)));
    }
  }
  g.strokeStyle = env.alpha(c.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(bx, by, bw, bh);
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.1);
  if (roll(rite, 0xca, 0).flicker(came(s, s.captionAt, 0.8, reduced))) write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

function mixPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  drawMix(g, w, h, env, plan, mixBlank(Math.round(v.turn * 10), 'a sandier soil drains faster'), v);
}

function mixPiece(env, plan) {
  const target = shareOf(plan.a, plan.b, plan.parts);
  const drains = plan.b > plan.a ? 'faster' : 'slower';
  const helps = asked(env).helps;
  // The blends the shed will rule out for you, from the ends inward: one per press, as many as
  // the difficulty allows. A ruled-out blend is help, not the answer.
  const rulings = [0, 10, 1, 9, 2, 8, 3, 7, 4, 6, 5].filter((k) => k !== plan.parts);
  const s = mixBlank(null, 'a sandier soil drains faster');
  const draw = (c) => drawMix(c.g, c.w, c.h, c, plan, s, env.variant);
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
          // The cups that change bag develop their new soil, on a roll of this set's own.
          s.partsPrev = s.parts;
          s.parts = next;
          s.partsAt = s.t;
          s.sets += 1;
        }
        c.status(s.parts + ' of the ten from bag A, ' + (10 - s.parts) + ' from bag B');
      }
      if (id === 'drains') c.status('you say it drains ' + value + ' than bag A');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done) {
        if (s.doneAt < 0) s.doneAt = s.t;
        s.lift = Math.min(1, s.lift + dt * 0.5);
        // The water goes through in about four seconds at pure sand, slower the less sand there is.
        s.drained = Math.min(1, s.drained + dt * (0.08 + target / 100 * 0.22) * (c.reduced ? 3 : 1));
      }
      draw(c);
    },
    end(c) {
      s.blend = target;
      if (s.parts == null) {
        s.partsPrev = null;
        s.parts = plan.parts;
        s.partsAt = s.t;
        s.sets += 1;
      }
      s.caption = target + '% sand: it drains ' + drains + ' than bag A';
      s.captionAt = s.t;
      if (s.doneAt < 0) s.doneAt = s.t;
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
  return { path, inspect: -1, inspectPrev: -1, inspectAt: -1, taps: 0, hintRow: null, hintAt: -1, grow: 0,
    exit: -1, exitPrev: -1, exitAt: -1, exits: 0, t: 0, doneAt: -1 };
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
  sky(g, w, h, env, top, s.grow, rite);
  write(g, 'root enters at ' + COLUMNS[plan.start], w / 2, top * 0.48, size, c.accent2);
  for (let col = 0; col < 4; col++) write(g, COLUMNS[col], left + (col + 0.5) * cell, top - size * 0.55, size, c.fg);
  // The tapped cell is sealed: a fill develops through the matte inside it on the roll of that
  // tap and its ring blinks on; the cell tapped before dissolves back down the same ladder. The
  // hint's cell seals the same way, on a roll of its own.
  const tapRite = roll(rite, 0x40, s.taps);
  const tapP = came(s, s.inspectAt, 0.9, reduced);
  const hintRite = roll(rite, 0x50, 0);
  const hintP = came(s, s.hintAt, 0.9, reduced);
  const hintCell = s.hintRow !== null ? (s.hintRow + 1) * 4 + s.path[s.hintRow + 1] : -1;
  for (let row = 0; row < plan.n; row++) {
    write(g, String(row + 1), left - size * 0.8, top + (row + 0.5) * layer, size, c.muted, 'right');
    for (let col = 0; col < 4; col++) {
      const x = left + col * cell;
      const y = top + row * layer;
      const idx = row * 4 + col;
      const way = plan.arrows[idx];
      g.fillStyle = layerTone(env, row % (KINDS.length - 1) + 1);
      g.fillRect(x, y, cell, layer);
      flecks(g, env, x, y, cell, layer, Math.round(4 * v.density), idx, 0.17);
      stone(g, env, x + cell * 0.5, y + layer * 0.5, Math.min(cell, layer) * 0.22, v.turn, 0.32);
      const box = { x: x + 3, y: y + 3, w: cell - 6, h: layer - 6 };
      let ring = false;
      if (idx === s.inspect) {
        g.fillStyle = env.alpha(c.accent, 0.26);
        sealed(g, tapRite, box, true, tapP, Math.max(rite.cell, Math.ceil(cell / 14)));
        ring = tapRite.flicker(tapP) === 1;
      } else if (idx === s.inspectPrev) {
        g.fillStyle = env.alpha(c.accent, 0.26);
        sealed(g, tapRite, box, false, tapP, Math.max(rite.cell, Math.ceil(cell / 14)));
      }
      if (idx === hintCell) {
        g.fillStyle = env.alpha(c.accent, 0.26);
        sealed(g, hintRite, box, true, hintP, Math.max(rite.cell, Math.ceil(cell / 14)));
        ring = ring || hintRite.flicker(hintP) === 1;
      }
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
  // that choice; the one said before dissolves.
  if (s.exitAt >= 0) {
    const exitRite = roll(rite, 0x60, s.exits);
    const exitP = came(s, s.exitAt, 0.8, reduced);
    const bracket = (col, on) => {
      if (col < 0) return;
      g.fillStyle = env.alpha(c.accent, 0.85);
      sealed(g, exitRite, { x: left + col * cell + cell * 0.2, y: top + plan.n * layer + 3, w: cell * 0.6, h: 5 }, on, exitP, Math.max(2, rite.cell));
    };
    bracket(s.exit, true);
    if (s.exitPrev !== s.exit) bracket(s.exitPrev, false);
  }
  // The root, at the finale: row by row through the bed in uneven treads.
  if (s.grow > 0) {
    const rows = roll(rite, 0x90, 0).series(s.grow, plan.n);
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
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.4, reduced), 0.1);
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
  const draw = (c) => drawRoute(c.g, c.w, c.h, c, plan, s, env.variant);
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
        if (col !== s.exit) {
          // The bracket moves to the column now said, on a roll of this choice's own.
          s.exitPrev = s.exit;
          s.exit = col;
          s.exitAt = s.t;
          s.exits += 1;
        }
        c.status('you say the root leaves at ' + value);
      }
      if (id === 'lefts') c.status('you counted ' + value + ' left turns');
      if (id === 'hint') {
        if (s.hintRow === null) {
          s.hintRow = Math.floor(plan.n / 2) - 1;
          s.hintAt = s.t;
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
      // The cell tapped before dissolves while this one seals, on a roll of this tap's own.
      s.inspectPrev = s.inspect;
      s.inspect = row * 4 + col;
      s.inspectAt = s.t;
      s.taps += 1;
      c.status('row ' + (row + 1) + ', column ' + COLUMNS[col] + ': '
        + ['left', 'down', 'right'][plan.arrows[s.inspect] + 1]);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done) {
        if (s.doneAt < 0) s.doneAt = s.t;
        s.grow = c.reduced ? 1 : Math.min(1, s.grow + dt * 0.7);
      }
      draw(c);
    },
    end(c) {
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status('the root found its way to ' + exit + ' through ' + plan.n + ' layers');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function deal(env) {
  const roll = env.rnd();
  return roll < 0.34 ? corePlan(env) : roll < 0.68 ? mixPlan(env) : routePlan(env);
}

export default {
  id: 'loam',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'core') corePreview(g, w, h, env, plan);
    else if (plan.kind === 'mix') mixPreview(g, w, h, env, plan);
    else routePreview(g, w, h, env, plan);
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
