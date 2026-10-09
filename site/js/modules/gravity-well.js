/* The gravity well: one probe, one well, and the moons of a far planet. As a card it is one of the
   two puzzles below painted small (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, one an experiment and one a deduction:

     the slingshot   A well in the field and a ring somewhere past it. Set the launch angle and
                     the speed, and every check is a flight: the probe is released from the left
                     edge, the well bends its path the same way every time, and the check says
                     whether the path went through the ring -- and if not, how many ring-widths
                     it missed by and on which side. The ring is placed on a flight the puzzle
                     flew first, so it can always be reached, and the far ends of both sliders
                     are checked at the making to miss it.
     the moons       Three moons on circular orbits round a planet, drawn to scale with a ruler
                     and a scale bar. A moon's period grows as its radius to the three halves, so
                     the outermost and the innermost orbit are in a whole-number step. Put the
                     moons in order of period and say how many laps the innermost makes while the
                     outermost makes one. A wrong check says how many moons stand in the right
                     place and whether the count is off by one or by more.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the well, the ring, the solution it was flown from; the radii, the step, the moons --
   and piece(env) opens on that rather than rolling another. */

const FIRST = ['amber', 'opal', 'iron', 'cinder', 'glass', 'violet', 'salt', 'copper'];
const SECOND = ['harbor', 'eye', 'throat', 'island', 'gate', 'heart', 'anchor', 'mirror'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const PLAIN = { density: 1, scale: 1, turn: 0 };

// The field the probe flies in: 1.6 wide and 1 high, the launch pad at its left edge.
const FIELD_W = 1.6;
const LAUNCH_X = 0.06;
const WELL_R = 0.045;
const RING_R = 0.045;
const SOFT = 0.002;
const DT = 0.02;
const STEPS = 520;
const AIM = { min: -60, max: 60, open: 0 };
const PUSH = { min: 20, max: 100, open: 60 };
// The tolerance each slider declares: every setting this close to the solution is flown at the
// making and has to pass the ring too, so the declared tolerance is an honest one.
const NEAR = { angle: 1, speed: 2 };
const REPLAY = 3.2;

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

function dials(env) {
  const v = env && env.variant;
  const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
  return v && typeof v === 'object' ? { density: num(v.density, 1), scale: num(v.scale, 1), turn: num(v.turn, 0) } : PLAIN;
}

function r3(x) {
  return Math.round(x * 1000) / 1000;
}

function between(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
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

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing in the field moves along a formula or cuts without a rite:
   the aim swings to a new angle in the ratchet's clicks and the speed line grows up a stair,
   with the readout counting after them; a released probe flies its path again along the
   rite's own glitch of a curve, the head's glow breathing on a stair, and the verdict and the
   nearest-approach mark blink on; the moons of a solved sky ride their orbits in clicks, a lap
   at a time to keep Kepler's ratio, the orbit dashes tick round with them; a moon the hint
   names, the ring a probe has passed and the light over a solved field all develop by their
   AREA through the matte, cell by cell in the piece's own pattern, and never by a fade; and the
   dust blinks on rite.flicker. Every change is read against the piece's own clock, s.t, which
   frame() advances: a change made at `since` has come came() of its way, which is 1 at once
   for a visitor who asked for less motion and for whatever stood there from the start. Each
   thing that moves has a roll of its own (rite.at), so no two step together -- and each TIME it
   moves it is rolled again (roll(): the thing's seed crossed with how many times it has moved),
   so the second swing of the aim composes a different stair, flicker and matte from the first,
   a wheel's every turn clicks differently, and a swing may slip a tooth past and fall back. */

const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 0, flicker: () => 1, matte: () => true,
  series: (p, n) => Math.max(1, Math.floor(n || 1)), treads: 1, kind: 'none', cell: 4, at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

function fract(x) {
  return x - Math.floor(x);
}

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two
// triggers of one movement play alike while the same seed still plays the same piece.
function roll(rite, base, n) {
  return rite.at(((base | 0) ^ (Math.imul((n | 0) + 1, 0x9e37) | 0)) >>> 0);
}

// Turns made at x turns along: the whole ones, and the one under way in the ratchet's clicks --
// each whole turn on a roll of its own, so no turn of a wheel clicks like the one before.
function turns(rite, base, x) {
  const whole = Math.floor(x);
  return whole + swing(roll(rite, base, whole), x - whole);
}

// A swing from 0 to 1 composed of the roll's pieces: the ratchet's clicks, and -- on a roll whose
// curve overshoots -- a slip one tooth past the mark near the end, fallen back from on the last
// tread. Never an even turn, and not the same swing twice.
function swing(own, p) {
  const q = p <= 0 ? 0 : p >= 1 ? 1 : p;
  const k = own.ratchet(q);
  const teeth = Math.max(2, own.treads || 2);
  const slips = typeof own.ease === 'function' && own.ease(0.9) > 1;
  if (slips && q >= 0.55 && q < 0.86 && k < 1) return Math.min(1, k + 1 / (teeth - 1));
  return k;
}

// Up the stair and back down it over one period: a breath, never a cosine.
function breath(rite, t, period, n) {
  const phase = fract(t / period);
  return phase < 0.5 ? rite.stair(phase * 2, n) : 1 - rite.stair((phase - 0.5) * 2, n);
}

// The cells of a box the matte lets through at coverage k, filled in the current fillStyle: how a
// surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame stays
// cheap, on a grid fixed to the canvas so the pattern holds still while it grows. `inside` keeps
// the tiling to a shape within the box. At k >= 1 every cell is let through.
function develop(g, rite, x0, y0, bw, bh, k, inside, size) {
  if (k <= 0) return;
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

// The light that comes over a solved field: it develops through the matte from the moment the
// piece was solved, blinking on and dropping out the way the rite's flicker has it, and holds;
// rolled by which check solved it, so a field solved on the third flight lights another way.
function daybreak(g, rite, env, w, h, p, strength, n) {
  const own = roll(rite, 0xdb, n || 0);
  const k = own.stair(p);
  if (k <= 0 || !own.flicker(p)) return;
  g.fillStyle = env.alpha(env.colors.accent2, strength || 0.12);
  develop(g, own, 0, 0, w, h, k, null, Math.max(rite.cell, Math.ceil(Math.min(w, h) / 30)));
}

/* ---- drawing shared by both ----------------------------------------------------------------- */

// The dust: standing where the configuration put it, and every seventh speck blinking out the
// way the rite's flicker has it -- on a roll of its own per speck and per blink, so the field is
// never quite still and no blink repeats.
function background(g, w, h, env, v, rite, t) {
  const col = env.colors;
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  glow.addColorStop(0, col.bg2);
  glow.addColorStop(1, col.bg);
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  for (let i = 0, n = Math.max(12, Math.round(85 * v.density)); i < n; i++) {
    const x = ((i * 0.61803398875 + v.turn * 0.23) % 1) * w;
    const y = ((i * 0.754877666 + v.turn * 0.17) % 1) * h;
    if (i % 7 === 0) {
      const phase = (t || 0) / 2.7 + i * 0.173;
      if (!roll(rite, 0xd0 + (i % 13), Math.floor(phase)).flicker(fract(phase))) continue;
    }
    g.fillStyle = env.alpha(col.fg, 0.12 + (i % 4) * 0.06);
    g.fillRect(x, y, i % 9 ? 1 : 1.7, i % 9 ? 1 : 1.7);
  }
}

// A body with a halo: the well, or the planet. `rings` draws the dashed field lines round it.
function body(g, env, x, y, radius, halo, rings) {
  const col = env.colors;
  const glow = g.createRadialGradient(x, y, radius * 0.3, x, y, radius * halo);
  glow.addColorStop(0, env.alpha(col.accent2, 0.34));
  glow.addColorStop(1, env.alpha(col.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(x - radius * halo, y - radius * halo, radius * halo * 2, radius * halo * 2);
  if (rings) {
    g.strokeStyle = env.alpha(col.accent, 0.3);
    g.lineWidth = 1;
    g.setLineDash([Math.max(2, radius * 0.16), Math.max(4, radius * 0.36)]);
    for (const ring of [2.2, 3.7]) {
      g.beginPath();
      g.arc(x, y, radius * ring, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
  }
  const surface = g.createRadialGradient(x - radius * 0.3, y - radius * 0.4, 0, x, y, radius);
  surface.addColorStop(0, col.fg);
  surface.addColorStop(0.22, col.accent2);
  surface.addColorStop(1, col.bg2);
  g.fillStyle = surface;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

function font(g, size, weight) {
  g.font = (weight || 500) + ' ' + Math.round(size) + 'px system-ui, sans-serif';
}

/* ---- the slingshot -------------------------------------------------------------------------- */

// One flight, the same every time: fixed steps, no clock. Positive angles aim up the screen.
function fly(p, angle, speed) {
  const rad = angle * Math.PI / 180;
  const v = 0.3 + speed / 100 * 0.6;
  let x = LAUNCH_X;
  let y = p.sy;
  let vx = v * Math.cos(rad);
  let vy = -v * Math.sin(rad);
  const pts = [{ x, y }];
  let closest = Infinity;
  let at = 0;
  let outcome = 'flew';
  for (let i = 1; i <= STEPS; i++) {
    const dx = p.wx - x;
    const dy = p.wy - y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    if (r < closest) {
      closest = r;
      at = i - 1;
    }
    if (r < WELL_R) {
      outcome = 'struck';
      break;
    }
    const pull = p.mass / Math.pow(r2 + SOFT, 1.5) * DT;
    vx += dx * pull;
    vy += dy * pull;
    x += vx * DT;
    y += vy * DT;
    pts.push({ x, y });
    if (x > FIELD_W + 0.06 || x < -0.06 || y < -0.06 || y > 1.06) {
      outcome = 'left';
      break;
    }
  }
  return { pts, closest, at, outcome };
}

// Where a flight came nearest the ring, and how near.
function nearestTo(pts, rx, ry) {
  let d = Infinity;
  let i0 = 0;
  pts.forEach((q, i) => {
    const dd = Math.hypot(q.x - rx, q.y - ry);
    if (dd < d) {
      d = dd;
      i0 = i;
    }
  });
  return { d, i: i0 };
}

function through(p, angle, speed) {
  return nearestTo(fly(p, angle, speed).pts, p.rx, p.ry).d <= RING_R;
}

function farEnd(value, knob) {
  return value > (knob.min + knob.max) / 2 ? knob.min : knob.max;
}

// Whether a plan is a fair puzzle: the solution and everything within the declared tolerance pass
// the ring; the far end of either slider, both far ends, and the sliders as they open all miss.
function slingHolds(p) {
  for (let da = -NEAR.angle; da <= NEAR.angle; da++) {
    for (let ds = -NEAR.speed; ds <= NEAR.speed; ds++) if (!through(p, p.angle + da, p.speed + ds)) return false;
  }
  const fa = farEnd(p.angle, AIM);
  const fs = farEnd(p.speed, PUSH);
  return !through(p, fa, p.speed) && !through(p, p.angle, fs) && !through(p, fa, fs) && !through(p, AIM.open, PUSH.open);
}

function slingPlan(env) {
  const number = 100 + env.int(0, 899);
  const name = 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND);
  let last = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const p = {
      kind: 'sling', number, name,
      sy: r3(0.28 + env.rnd() * 0.44), wx: r3(0.72 + env.rnd() * 0.22), wy: r3(0.38 + env.rnd() * 0.24),
      mass: r3(0.04 + env.rnd() * 0.04), angle: env.int(-40, 40), speed: env.int(30, 85), rx: 0, ry: 0
    };
    const flight = fly(p, p.angle, p.speed);
    if (flight.outcome === 'struck' || flight.closest < 0.08 || flight.closest > 0.32) continue;
    // The ring goes on the flown path after the closest approach, well inside the field.
    const spots = [];
    for (let i = flight.at + 12; i < flight.pts.length - 4; i += 3) {
      const q = flight.pts[i];
      if (q.x > 0.12 && q.x < FIELD_W - 0.1 && q.y > 0.08 && q.y < 0.92
          && Math.hypot(q.x - p.wx, q.y - p.wy) > 0.16 && Math.hypot(q.x - LAUNCH_X, q.y - p.sy) > 0.25) spots.push(q);
    }
    if (!spots.length) continue;
    const spot = spots[env.int(0, spots.length - 1)];
    p.rx = r3(spot.x);
    p.ry = r3(spot.y);
    last = p;
    if (slingHolds(p)) return p;
  }
  return last || { kind: 'sling', number, name, sy: 0.5, wx: 0.82, wy: 0.5, mass: 0.06, angle: 10, speed: 60, rx: 1.3, ry: 0.3 };
}

function carriedSling(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'sling' || !Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (typeof p.name !== 'string' || !p.name || p.name.length > 40) return null;
  if (!between(p.sy, 0.2, 0.8) || !between(p.wx, 0.6, 1.0) || !between(p.wy, 0.3, 0.7) || !between(p.mass, 0.03, 0.09)) return null;
  if (!Number.isInteger(p.angle) || p.angle < AIM.min + NEAR.angle || p.angle > AIM.max - NEAR.angle) return null;
  if (!Number.isInteger(p.speed) || p.speed < PUSH.min + NEAR.speed || p.speed > PUSH.max - NEAR.speed) return null;
  if (!between(p.rx, 0, FIELD_W) || !between(p.ry, 0, 1)) return null;
  const plan = { kind: 'sling', number: p.number, name: p.name, sy: p.sy, wx: p.wx, wy: p.wy, mass: p.mass, angle: p.angle, speed: p.speed, rx: p.rx, ry: p.ry };
  return slingHolds(plan) ? plan : null;
}

function slingTitle(p) {
  return 'flight ' + p.number + ' past ' + p.name + ': the ring';
}

// The field on the canvas, as large as fits, centred.
function fieldMap(w, h) {
  const k = Math.min(w / FIELD_W, h);
  const ox = (w - FIELD_W * k) / 2;
  const oy = (h - k) / 2;
  return { k, at: (x, y) => ({ x: ox + x * k, y: oy + y * k }) };
}

function slingScene(g, w, h, env, p, s, v) {
  const col = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const map = fieldMap(w, h);
  const k = map.k;
  background(g, w, h, env, v, rite, s.t);
  const well = map.at(p.wx, p.wy);
  body(g, env, well.x, well.y, k * WELL_R, 4 * v.scale, true);
  // The ring. Once a probe has passed it, it is a set surface: its disc develops through the
  // matte from the moment the field was solved, and its rim thickens up a stair, never a fade.
  const ring = map.at(p.rx, p.ry);
  const ringR = k * RING_R;
  const pass = s.flight && s.pass && s.pass.d <= RING_R;
  const lit = pass && s.doneAt != null ? came(s, s.doneAt, 2.4, reduced) : 0;
  // Every flight rolls the ring's rite afresh, so a ring passed on the fourth try lights in
  // another matte and another flicker than one passed on the first.
  const ringRite = roll(rite, 0x21, s.flights);
  g.fillStyle = env.alpha(col.accent2, 0.06);
  g.beginPath();
  g.arc(ring.x, ring.y, ringR, 0, Math.PI * 2);
  g.fill();
  if (lit > 0 && ringRite.flicker(lit)) {
    g.fillStyle = env.alpha(col.accent2, 0.36);
    develop(g, ringRite, ring.x - ringR, ring.y - ringR, ringR * 2, ringR * 2, ringRite.stair(lit),
      (px, py) => Math.hypot(px - ring.x, py - ring.y) <= ringR, Math.max(rite.cell, Math.ceil(ringR / 9)));
  }
  // The rim brightens and thickens up a stair as the ring is passed: no cut to a new alpha.
  const rim = ringRite.stair(lit, 4);
  g.strokeStyle = env.alpha(col.accent2, 0.85 + 0.15 * rim);
  g.lineWidth = Math.max(1.5, k * 0.006) * (1 + 1.4 * rim);
  g.beginPath();
  g.arc(ring.x, ring.y, ringR, 0, Math.PI * 2);
  g.stroke();
  // The launch pad, with the angle marks round it and the aim as set: a new angle is swung to in
  // the ratchet's clicks and a new speed climbed to up a stair, the readout counting after them.
  const pad = map.at(LAUNCH_X, p.sy);
  g.strokeStyle = env.alpha(col.muted, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  for (const deg of [-60, -30, 0, 30, 60]) {
    const a = -deg * Math.PI / 180;
    g.moveTo(pad.x + Math.cos(a) * k * 0.05, pad.y + Math.sin(a) * k * 0.05);
    g.lineTo(pad.x + Math.cos(a) * k * (deg % 60 ? 0.065 : 0.08), pad.y + Math.sin(a) * k * (deg % 60 ? 0.065 : 0.08));
  }
  g.stroke();
  const angleNow = angleShown(s, rite, reduced);
  const speedNow = speedShown(s, rite, reduced);
  const aim = -angleNow * Math.PI / 180;
  const reach = k * (0.1 + speedNow / 100 * 0.22);
  g.strokeStyle = env.alpha(col.fg, 0.45);
  g.setLineDash([3, 6]);
  g.beginPath();
  g.moveTo(pad.x, pad.y);
  g.lineTo(pad.x + Math.cos(aim) * reach, pad.y + Math.sin(aim) * reach);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = col.fg;
  g.beginPath();
  g.arc(pad.x, pad.y, Math.max(2.5, k * 0.008), 0, Math.PI * 2);
  g.fill();
  // The last flight, replayed from its launch along the rite's own curve: a hesitation off the
  // pad, a surge, a stutter and a settle, with the head's glow breathing on a stair.
  if (s.flight) {
    const pts = s.flight.pts;
    const until = Math.max(2, Math.min(pts.length, Math.ceil(pts.length * s.fraction)));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = env.alpha(col.accent2, 0.8 + 0.15 * rim);
    g.lineWidth = Math.max(1.5, k * 0.006 * v.scale);
    g.beginPath();
    for (let i = 0; i < until; i++) {
      const at = map.at(pts[i].x, pts[i].y);
      if (i) g.lineTo(at.x, at.y);
      else g.moveTo(at.x, at.y);
    }
    g.stroke();
    // A passed flight's path is set too: a glow develops along it through the matte, in cells.
    if (lit > 0 && ringRite.flicker(lit)) {
      const glowRite = roll(rite, 0x9f, s.flights);
      const kk = glowRite.stair(lit);
      const cell = Math.max(rite.cell, Math.ceil(k * 0.012));
      g.fillStyle = env.alpha(col.accent2, 0.3);
      for (let i = 0; i < until; i += 2) {
        const at = map.at(pts[i].x, pts[i].y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = Math.floor(at.x / cell) + dx;
            const cy = Math.floor(at.y / cell) + dy;
            if (kk < 1 && !glowRite.matte(cx, cy, kk)) continue;
            g.fillRect(cx * cell, cy * cell, cell, cell);
          }
        }
      }
    }
    const head = map.at(pts[until - 1].x, pts[until - 1].y);
    // The head's glow breathes on a stair, each breath on a roll of its own.
    g.fillStyle = env.alpha(col.accent2, 0.22);
    g.beginPath();
    g.arc(head.x, head.y, Math.max(6, k * 0.02 * v.scale) * (0.6 + 0.8 * breath(roll(rite, 0x4e, Math.floor(s.clock / 1.3)), s.clock, 1.3, 3)), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.fg;
    g.beginPath();
    g.arc(head.x, head.y, Math.max(2.5, k * 0.007 * v.scale), 0, Math.PI * 2);
    g.fill();
    // Where it came nearest the ring, marked once the flight has landed: the line is laid from
    // the probe's nearest point toward the ring in treads, blinking as it comes, never drawn whole.
    const landed = reduced ? 1 : Math.max(0, Math.min(1, (s.clock - REPLAY) / 0.8));
    const markRite = roll(rite, 0x3e, s.flights);
    if (landed > 0 && !pass && s.pass && markRite.flicker(landed)) {
      const near = map.at(pts[s.pass.i].x, pts[s.pass.i].y);
      const laid = markRite.stair(landed, 5);
      g.strokeStyle = env.alpha(col.accent, 0.7);
      g.lineWidth = 1;
      g.setLineDash([2, 4]);
      g.beginPath();
      g.moveTo(near.x, near.y);
      g.lineTo(near.x + (ring.x - near.x) * laid, near.y + (ring.y - near.y) * laid);
      g.stroke();
      g.setLineDash([]);
    }
  }
  // The light over a solved field.
  if (lit > 0) daybreak(g, rite, env, w, h, lit, 0.1, s.flights);
  const size = Math.max(10, Math.min(17, Math.round(Math.min(w, h) * 0.042)));
  font(g, size);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = env.alpha(col.fg, 0.85);
  g.fillText(p.name, w * 0.04, h * 0.07, w * 0.5);
  g.textAlign = 'right';
  g.fillStyle = env.alpha(col.accent2, 0.9);
  const angleRead = Math.round(angleNow);
  g.fillText((angleRead > 0 ? '+' : '') + angleRead + '° · speed ' + Math.round(speedNow), w * 0.96, h * 0.07, w * 0.5);
  g.textAlign = 'center';
  g.fillStyle = env.alpha(col.muted, 0.85);
  // The verdict blinks on when a flight is released, on that flight's own roll; nothing is said
  // while it is still off.
  const said = s.flight ? (reduced ? 1 : Math.max(0, Math.min(1, s.clock / 0.9))) : 0;
  if (!s.flight) g.fillText('the well bends every flight the same way; through the ring is the goal', w / 2, h * 0.94, w * 0.92);
  else if (roll(rite, 0x7e, s.flights).flicker(said)) g.fillText(s.verdict, w / 2, h * 0.94, w * 0.92);
}

function slingState(p) {
  return {
    angle: AIM.open, speed: PUSH.open, flight: null, pass: null, fraction: 0, clock: 0, verdict: '',
    t: 0, doneAt: null, aimFrom: AIM.open, aimAt: null, speedFrom: PUSH.open, speedAt: null,
    // How many times each thing has moved: the roll for its next movement.
    aims: 0, speeds: 0, flights: 0
  };
}

// The aim as it stands on the pad: swung from where it was to where it is set in the ratchet's
// clicks (with a slip past the mark on a roll that has one); and the speed line, climbed to up a
// stair. Both are what the readout counts, and each setting rolls its own swing.
function angleShown(s, rite, reduced) {
  if (s.aimAt == null) return s.angle;
  return s.aimFrom + (s.angle - s.aimFrom) * swing(roll(rite, 0xa1, s.aims), came(s, s.aimAt, 0.9, reduced));
}

function speedShown(s, rite, reduced) {
  if (s.speedAt == null) return s.speed;
  return s.speedFrom + (s.speed - s.speedFrom) * roll(rite, 0x5d, s.speeds).stair(came(s, s.speedAt, 0.9, reduced));
}

function slingPreview(g, w, h, env, p) {
  slingScene(g, w, h, env, p, slingState(p), dials(env));
}

function widths(d) {
  return (d / (RING_R * 2)).toFixed(1);
}

function slingPiece(env, p) {
  const v = dials(env);
  const helps = asked(env).helps;
  const s = slingState(p);
  // The ring is the verifier here -- a probe is through it or it is not -- so this puzzle has no
  // margin to widen and moves on the help alone: how many times the last flight may be replayed.
  let replays = 0;
  const draw = (c) => slingScene(c.g, c.w, c.h, c, p, s, v);
  const clampTo = (value, knob) => Math.max(knob.min, Math.min(knob.max, Math.round(Number(value)) || 0));
  return {
    title: slingTitle(p),
    brief: 'A casting past the well. A probe leaves the pad at the left edge at the angle and the speed you set, and ' + p.name + ' bends its path the same way every time. Every check is a flight; the ring is where it has to pass.',
    goal: 'Find an angle and a speed that carry the probe through the ring.',
    aspect: '16 / 10',
    checkLabel: 'release the probe',
    steps: [
      { id: 'angle', ask: 'the launch angle', kind: 'range', min: AIM.min, max: AIM.max, step: 1, value: AIM.open, low: 'down', high: 'up' },
      { id: 'speed', ask: 'the launch speed', kind: 'range', min: PUSH.min, max: PUSH.max, step: 1, value: PUSH.open, low: 'gentle', high: 'fast' },
      { id: 'again', ask: 'see the last flight again', kind: 'press', count: 1, label: 'watch it again', optional: true }
    ],
    solution: { angle: { value: p.angle, near: NEAR.angle }, speed: { value: p.speed, near: NEAR.speed } },
    check(c) {
      const angle = clampTo(c.value('angle'), AIM);
      const speed = clampTo(c.value('speed'), PUSH);
      const flight = fly(p, angle, speed);
      const pass = nearestTo(flight.pts, p.rx, p.ry);
      s.flight = flight;
      s.pass = pass;
      s.flights += 1;
      s.clock = c.reduced ? REPLAY + 1 : 0;
      s.fraction = c.reduced ? 1 : 0;
      const solved = pass.d <= RING_R;
      if (solved) s.verdict = 'through the ring at ' + (angle > 0 ? '+' : '') + angle + '°, speed ' + speed;
      else if (flight.outcome === 'struck') s.verdict = 'the probe struck ' + p.name + ' before it reached the ring';
      else {
        const side = flight.pts[pass.i].y < p.ry ? 'above' : 'below';
        s.verdict = 'missed: nearest ' + widths(pass.d) + ' ring-widths ' + side + ' the ring';
      }
      return { solved, say: s.verdict };
    },
    start(c) {
      c.status('set an angle and a speed, then release the probe');
      draw(c);
    },
    apply(id, value, c) {
      const rite = riteOf(c);
      if (id === 'angle') {
        // The aim swings from wherever it stands now, mid-click or settled, to the new angle.
        s.aimFrom = angleShown(s, rite, c.reduced);
        s.aimAt = s.t;
        s.aims += 1;
        s.angle = clampTo(value, AIM);
        c.status('aimed ' + (s.angle === 0 ? 'straight across' : Math.abs(s.angle) + ' degrees ' + (s.angle > 0 ? 'up' : 'down')));
      }
      if (id === 'speed') {
        s.speedFrom = speedShown(s, rite, c.reduced);
        s.speedAt = s.t;
        s.speeds += 1;
        s.speed = clampTo(value, PUSH);
        c.status('speed ' + s.speed + ' of 100');
      }
      if (id === 'again') {
        if (replays >= helps) {
          c.status('the flight has been replayed as often as this difficulty allows; release another');
        } else if (s.flight) {
          replays += 1;
          // A replay is another flight of the same path: it rolls its own curve and blinks.
          s.flights += 1;
          s.clock = c.reduced ? REPLAY + 1 : 0;
          s.fraction = c.reduced ? 1 : 0;
          c.status('the last flight, again: ' + s.verdict);
        } else {
          c.status('nothing has flown yet; release the probe first');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (s.flight && s.clock < REPLAY + 1) {
        s.clock += dt;
        // The replay runs along the curve this flight rolled -- a hesitation off the pad, a
        // surge, a stutter -- which may overshoot the end a little and settle: the head goes
        // past the last point and comes back, clamped to the path.
        s.fraction = c.reduced ? 1 : Math.max(0, Math.min(1, roll(riteOf(c), 0xf17, s.flights).ease(s.clock / REPLAY)));
      }
      if (c.done && s.doneAt == null) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      c.status('through the ring. the probe flew on past ' + p.name + ' with its engine off the whole way');
    }
  };
}

/* ---- the moons ------------------------------------------------------------------------------ */

function moonsPlan(env) {
  const number = 100 + env.int(0, 899);
  const name = 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const k = env.int(2, 8);
    const inner = env.int(10, 16);
    const outer = Math.round(inner * Math.pow(k, 2 / 3));
    if (Math.round(Math.pow(outer / inner, 1.5)) !== k || outer - inner < 6) continue;
    const middle = env.int(inner + 3, outer - 3);
    const names = shuffled(env, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    let listing = shuffled(env, [inner, middle, outer]);
    for (let guard = 0; guard < 8 && listing[0] < listing[1] && listing[1] < listing[2]; guard++) listing = shuffled(env, [inner, middle, outer]);
    if (listing[0] < listing[1] && listing[1] < listing[2]) listing = [outer, middle, inner];
    const angles = [env.int(0, 359), env.int(0, 359), env.int(0, 359)];
    last = { kind: 'moons', number, name, k, radii: listing, names, angles };
    return last;
  }
  return { kind: 'moons', number, name, k: 4, radii: [32, 12, 20], names: [0, 6, 3], angles: [40, 200, 300] };
}

function carriedMoons(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'moons' || !Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (typeof p.name !== 'string' || !p.name || p.name.length > 40) return null;
  if (!Number.isInteger(p.k) || p.k < 2 || p.k > 8) return null;
  if (!Array.isArray(p.radii) || p.radii.length !== 3 || !p.radii.every((r) => Number.isInteger(r) && r >= 8 && r <= 70)) return null;
  const sorted = p.radii.slice().sort((a, b) => a - b);
  if (sorted[0] >= sorted[1] || sorted[1] >= sorted[2]) return null;
  if (Math.round(Math.pow(sorted[2] / sorted[0], 1.5)) !== p.k) return null;
  if (p.radii[0] < p.radii[1] && p.radii[1] < p.radii[2]) return null;
  if (!Array.isArray(p.names) || p.names.length !== 3 || !p.names.every((i) => Number.isInteger(i) && i >= 0 && i < FIRST.length) || new Set(p.names).size !== 3) return null;
  if (!Array.isArray(p.angles) || p.angles.length !== 3 || !p.angles.every((a) => Number.isInteger(a) && a >= 0 && a < 360)) return null;
  return { kind: 'moons', number: p.number, name: p.name, k: p.k, radii: p.radii.slice(), names: p.names.slice(), angles: p.angles.slice() };
}

function moonsTitle(p) {
  return 'the moons of ' + p.name;
}

// The moons shortest period first: the order that solves it.
function moonsOrder(p) {
  return [0, 1, 2].sort((a, b) => p.radii[a] - p.radii[b]);
}

function moonsScene(g, w, h, env, p, s, v) {
  const col = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  background(g, w, h, env, v, rite, s.t);
  const cx = w * 0.46;
  const cy = h * 0.5;
  const outer = Math.max(...p.radii);
  const R = Math.min(w * 0.3, h * 0.4);
  const u = R / outer;
  const size = Math.max(10, Math.min(16, Math.round(Math.min(w, h) * 0.04)));
  const lit = s.doneAt == null ? 0 : came(s, s.doneAt, 2.6, reduced);
  // The orbits: dashed, and once the moons are in motion the dashes tick round in clicks, every
  // tick on a roll of its own.
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  g.lineDashOffset = s.spin ? -9 * turns(rite, 0x0b, s.spin / 1.6) : 0;
  p.radii.forEach((r) => {
    g.strokeStyle = env.alpha(col.accent, 0.45);
    g.beginPath();
    g.arc(cx, cy, r * u, 0, Math.PI * 2);
    g.stroke();
  });
  g.setLineDash([]);
  g.lineDashOffset = 0;
  // The laps the visitor says: that many notches round the outermost orbit, arriving one tread
  // at a time in a series -- a counter that counts, never a number that cuts -- and each new count
  // steps from the last one, up or down, on a roll of its own.
  if (s.lapsAt != null) {
    const lapRite = roll(rite, 0x1a, s.counts);
    const shown = s.lapsFrom + Math.round(lapRite.stair(came(s, s.lapsAt, 1.1, reduced), Math.max(1, Math.abs(s.laps - s.lapsFrom))) * (s.laps - s.lapsFrom));
    g.strokeStyle = env.alpha(col.accent2, 0.9);
    g.lineWidth = Math.max(1.5, u * 0.3);
    g.beginPath();
    for (let i = 0; i < shown; i++) {
      const a = -Math.PI / 2 + (i / Math.max(shown, 1)) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * (outer * u + size * 0.3), cy + Math.sin(a) * (outer * u + size * 0.3));
      g.lineTo(cx + Math.cos(a) * (outer * u + size * 0.8), cy + Math.sin(a) * (outer * u + size * 0.8));
    }
    g.stroke();
  }
  body(g, env, cx, cy, Math.max(4, u * 2.4) * v.scale, 4, false);
  // The ruler, out from the planet: a tick every two units, a number every ten, and each
  // orbit's crossing marked with its reading.
  const end = cx + outer * u * 1.1;
  g.strokeStyle = env.alpha(col.muted, 0.6);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(end, cy);
  for (let t = 2; t * u <= outer * u * 1.1; t += 2) {
    const tall = t % 10 === 0 ? size * 0.5 : size * 0.22;
    g.moveTo(cx + t * u, cy);
    g.lineTo(cx + t * u, cy + tall);
  }
  g.stroke();
  font(g, size * 0.72);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillStyle = env.alpha(col.muted, 0.9);
  for (let t = 10; t * u <= outer * u * 1.1; t += 10) g.fillText(String(t), cx + t * u, cy + size * 0.6);
  g.textBaseline = 'bottom';
  p.radii.forEach((r) => {
    g.strokeStyle = env.alpha(col.accent2, 0.9);
    g.beginPath();
    g.moveTo(cx + r * u, cy - size * 0.45);
    g.lineTo(cx + r * u, cy);
    g.stroke();
    g.fillStyle = env.alpha(col.accent2, 0.95);
    g.fillText(String(r), cx + r * u, cy - size * 0.5);
  });
  // The moons where they stand, named. In motion, each rides its orbit in the clicks of a
  // ratchet of its own, one whole lap per period, so the laps still stand in Kepler's ratio
  // while no moon ever glides. A moon the hint names is a set surface: its halo develops
  // through the matte and its reading blinks on.
  const order = moonsOrder(p);
  // The visitor's order, as a numeral by each moon: the numerals arrive one tread at a time in a
  // series on the roll of that setting, so the second ordering deals them in another rhythm.
  const placed = s.orderAt != null ? roll(rite, 0x60, s.orders).series(came(s, s.orderAt, 0.9, reduced), 3) : 0;
  p.radii.forEach((r, i) => {
    const period = 30 * Math.pow(r / outer, 1.5);
    const a = (p.angles[i] + (s.spin ? 360 * turns(rite, 0x30 + i, s.spin / period) : 0)) * Math.PI / 180;
    const x = cx + Math.cos(a) * r * u;
    const y = cy + Math.sin(a) * r * u;
    const rad = Math.max(3, u * 1.1) * v.scale;
    const hot = s.hinted && s.hinted.includes(i);
    const hotRite = rite.at(0x40 + i);
    const hp = hot ? came(s, s.hintedAt, 1.4, reduced) : 0;
    const on = hot && hotRite.flicker(hp);
    const halo = g.createRadialGradient(x, y, 0, x, y, rad * 3);
    halo.addColorStop(0, env.alpha(col.accent, 0.45));
    halo.addColorStop(1, env.alpha(col.accent, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, rad * 3, 0, Math.PI * 2);
    g.fill();
    if (on) {
      g.fillStyle = env.alpha(col.accent2, 0.42);
      develop(g, hotRite, x - rad * 3, y - rad * 3, rad * 6, rad * 6, hotRite.stair(hp),
        (px, py) => Math.hypot(px - x, py - y) <= rad * 3, Math.max(rite.cell, Math.ceil(rad / 2)));
    }
    g.fillStyle = on ? col.accent2 : col.fg;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    font(g, size * 0.85, 600);
    g.textAlign = Math.cos(a) < 0 ? 'right' : 'left';
    g.textBaseline = 'middle';
    g.fillStyle = env.alpha(on ? col.accent2 : col.fg, 0.9);
    g.fillText(FIRST[p.names[i]] + (on ? ', ' + ['shortest', 'middle', 'longest'][order.indexOf(i)] + ' period' : ''), x + (Math.cos(a) < 0 ? -1 : 1) * rad * 1.8, y - rad * 1.6);
    const place = s.order ? s.order.indexOf(i) : -1;
    if (place >= 0 && place < placed) {
      // The numeral sits in a small set surface of its own, developed through the matte.
      const nx = x + (Math.cos(a) < 0 ? -1 : 1) * rad * 1.8;
      const ny = y + rad * 1.9;
      const boxW = size * 1.1;
      g.fillStyle = env.alpha(col.accent2, 0.3);
      develop(g, roll(rite, 0x60, s.orders), Math.cos(a) < 0 ? nx - boxW : nx, ny - size * 0.5, boxW, size, came(s, s.orderAt, 0.9, reduced), null, Math.max(2, rite.cell));
      font(g, size * 0.8, 700);
      g.textAlign = Math.cos(a) < 0 ? 'right' : 'left';
      g.fillStyle = col.accent2;
      g.fillText(String(place + 1), nx + (Math.cos(a) < 0 ? -size * 0.15 : size * 0.15), ny);
    }
  });
  // The light over a solved sky.
  if (lit > 0) daybreak(g, rite, env, w, h, lit, 0.1, s.checks);
  // The scale bar, and the law.
  const bar = 10 * u;
  g.strokeStyle = env.alpha(col.fg, 0.8);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(w * 0.05, h * 0.9);
  g.lineTo(w * 0.05 + bar, h * 0.9);
  g.moveTo(w * 0.05, h * 0.9 - 4);
  g.lineTo(w * 0.05, h * 0.9 + 4);
  g.moveTo(w * 0.05 + bar, h * 0.9 - 4);
  g.lineTo(w * 0.05 + bar, h * 0.9 + 4);
  g.stroke();
  font(g, size * 0.8);
  g.textAlign = 'left';
  g.textBaseline = 'bottom';
  g.fillStyle = env.alpha(col.fg, 0.85);
  g.fillText('ten units', w * 0.05, h * 0.9 - 5);
  font(g, size);
  g.textBaseline = 'middle';
  g.fillText(moonsTitle(p), w * 0.04, h * 0.07, w * 0.6);
  g.textAlign = 'right';
  g.fillStyle = env.alpha(col.accent2, 0.9);
  g.fillText('period ∝ radius³ᐟ²', w * 0.96, h * 0.07, w * 0.4);
  g.textAlign = 'center';
  g.fillStyle = env.alpha(col.muted, 0.85);
  // The footer reads the settings back; a new reading blinks in on the roll of that change,
  // never cutting straight to the new words.
  const foot = s.order && s.footAt != null ? 'shortest period first: ' + s.order.map((i) => FIRST[p.names[i]]).join(', ') + ' · ' + s.laps + (s.laps === 1 ? ' lap' : ' laps') + ' of the innermost for one of the outermost'
    : 'three moons to scale; the inner one laps the outer a whole number of times';
  if (s.footAt == null || roll(rite, 0x0f, s.foots).flicker(came(s, s.footAt, 0.7, reduced))) g.fillText(foot, w / 2, h * 0.95, w * 0.92);
}

function moonsState() {
  return {
    spin: 0, hinted: [], hintedAt: null, order: null, laps: 1, t: 0, doneAt: null,
    orderAt: null, orders: 0, lapsAt: null, lapsFrom: 1, counts: 0, footAt: null, foots: 0, checks: 0
  };
}

function moonsPreview(g, w, h, env, p) {
  moonsScene(g, w, h, env, p, moonsState(), dials(env));
}

function moonsPiece(env, p) {
  const v = dials(env);
  const helps = asked(env).helps;
  const answer = moonsOrder(p);
  const s = Object.assign(moonsState(), { order: [0, 1, 2] });
  const draw = (c) => moonsScene(c.g, c.w, c.h, c, p, s, v);
  const names = p.names.map((i) => FIRST[i]);
  return {
    title: moonsTitle(p),
    brief: 'One law, read off a ruler. Three moons circle ' + p.name + ', drawn to scale: the ruler reads each orbit\'s radius and the bar is ten units. A moon\'s period grows as its radius to the three halves (the square of the period as the cube of the radius), and these three were chosen so that the innermost laps the outermost a whole number of times.',
    goal: 'Put the moons in order of period, shortest first, and say how many laps the innermost makes while the outermost makes one.',
    aspect: '16 / 10',
    checkLabel: 'check the orbits',
    steps: [
      { id: 'order', ask: 'the moons, shortest period first', kind: 'order', items: [0, 1, 2].map((i) => ({ label: 'the ' + names[i] + ' moon', value: i })) },
      { id: 'laps', ask: 'laps of the innermost moon for one lap of the outermost', kind: 'number', min: 1, max: 9, step: 1, value: 1, unit: 'laps' },
      // One thing to say, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'hint', ask: 'which moon has the shortest period', kind: 'press', count: 1, label: 'name it', optional: true } : null
    ].filter(Boolean),
    solution: { order: answer.slice(), laps: p.k },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, 3) ? value : s.order;
      const right = order.filter((m, i) => m === answer[i]).length;
      const laps = Math.round(Number(c.value('laps')));
      const off = Math.abs(laps - p.k);
      s.checks += 1;
      if (right === 3 && off === 0) {
        return { solved: true, say: 'in step: the ' + names[answer[0]] + ' moon laps ' + WORDS[p.k] + ' times for one lap of the ' + names[answer[2]] + ' moon' };
      }
      const parts = [right === 3 ? 'the order holds' : right === 0 ? 'no moon stands in the right place' : WORDS[right] + ' of three in the right place'];
      parts.push(off === 0 ? 'the count holds' : off === 1 ? 'the count is off by one' : 'the count is off by more than one');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('read the radii off the ruler');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, 3)) {
        s.order = value.slice();
        s.orderAt = s.t;
        s.orders += 1;
        s.footAt = s.t;
        s.foots += 1;
        c.status('shortest period first: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'laps') {
        const n = Math.round(Number(value));
        if (n >= 1 && n <= 9 && (s.lapsAt == null || n !== s.laps)) {
          // The notches step from the count that stood (none, the first time) to the one set.
          s.lapsFrom = s.lapsAt == null ? 0 : s.laps;
          s.laps = n;
          s.lapsAt = s.t;
          s.counts += 1;
          s.footAt = s.t;
          s.foots += 1;
        }
        c.status(s.laps + (s.laps === 1 ? ' lap' : ' laps') + ' of the innermost for one of the outermost');
      }
      if (id === 'hint') {
        if (!s.hinted.includes(answer[0])) {
          s.hinted.push(answer[0]);
          s.hintedAt = s.t;
          c.hint();
          c.status('the ' + names[answer[0]] + ' moon has the shortest period: it rides the innermost orbit');
        } else {
          c.status('the ' + names[answer[0]] + ' moon is marked already; the count follows from the two radii');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        if (s.doneAt == null) s.doneAt = s.t;
        if (!c.reduced) s.spin += dt;
      }
      draw(c);
    },
    end(c) {
      c.status('the moons are in motion: watch the ' + names[answer[0]] + ' moon lap the ' + names[answer[2]] + ' moon ' + WORDS[p.k] + ' times');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsMoons(env) {
  return env.chance(0.5);
}

export default {
  id: 'gravity-well',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsMoons(env)) moonsPreview(g, w, h, env, moonsPlan(env));
    else slingPreview(g, w, h, env, slingPlan(env));
  },
  spark(env) {
    if (dealsMoons(env)) {
      const p = moonsPlan(env);
      return {
        title: moonsTitle(p),
        text: 'Three moons drawn to scale. Order them by period and say how many laps the innermost makes for one of the outermost.',
        mono: 'period ∝ radius³ᐟ²',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => moonsPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = slingPlan(env);
    return {
      title: slingTitle(p),
      text: 'One well, one ring. Find the launch angle and speed that carry the probe through the ring; every check is a flight.',
      mono: 'angle ' + AIM.min + '..' + AIM.max + ' · speed ' + PUSH.min + '..' + PUSH.max,
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => slingPreview(g, w, h, cardEnv, p),
      of: p
    };
  },
  piece(env) {
    const sling = carriedSling(env);
    if (sling) return slingPiece(env, sling);
    const moons = carriedMoons(env);
    if (moons) return moonsPiece(env, moons);
    return dealsMoons(env) ? moonsPiece(env, moonsPlan(env)) : slingPiece(env, slingPlan(env));
  }
};
