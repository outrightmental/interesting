/* The gravity well: one probe, one well, and the moons of a far planet. As a card it is one of the
   three puzzles below painted small (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles: an experiment, an orbit reading, and a meeting to find:

     the slingshot   A well in the field and a ring somewhere past it. Set the launch angle and
                     the speed, and every check is a flight: the probe is released from the left
                     edge, the well bends its path the same way every time, and the check says
                     whether the path went through the ring -- and if not, how many ring-widths
                     it missed by and on which side. The ring is placed on a flight the puzzle
                     flew first, so it can always be reached, and the far ends of both sliders
                     are checked at the making to miss it.
     the moons       Three to five moons on circular orbits round a planet, drawn to scale with a ruler
                     and a scale bar. A moon's period grows as its radius to the three halves, so
                     the outermost and the innermost orbit are in a whole-number step. Put the
                     moons in order of period and say how many laps the innermost makes while the
                     outermost makes one. A wrong check says how many moons stand in the right
                     place and whether the count is off by one or by more.
     the meeting     Two moons start on one line and orbit at different periods. Turn the system to
                     any tick, find the first time they meet again, and count the inner moon's
                     completed laps. The scene follows the visitor's time setting and remains
                     theirs to turn after the check.

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
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes. The aim swings to a new angle in the
   ratchet's even clicks and the speed line climbs a stair, the readout counting after them; a
   released probe flies its path again in the rite's landing treads, and the verdict and the
   nearest-approach mark are cut on at their moment; the moons of a solved sky ride their orbits
   in clicks, a lap at a time to keep Kepler's ratio, and the orbit dashes tick round with them. A
   surface that comes to stay -- the ring a probe has passed and the light over a solved field, a
   moon the hint names -- is cut in by the piece's edge (rite.paint, one path) in treads and rests
   as two shades of its colour split by that edge through its middle: never a fade, a flat wash or
   a pattern. Every change is read against the piece's own clock, s.t, which frame() advances: a
   change made at `since` has come came() of its way, which is 1 at once for a visitor who asked
   for less motion and for whatever stood there from the start. Each thing that moves has a roll of
   its own, and each TIME it moves it is rolled again (roll(): the thing's seed crossed with how
   many times it has moved), so the second swing of the aim clicks in another rhythm from the
   first and no turn of a wheel clicks like the one before -- every roll keeping the piece's edge.
   The dust stands still: nothing in it waits for anything, so nothing in it moves. */

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

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two
// triggers of one movement play alike while the same seed still plays the same piece. Kept with
// the rite it was rolled from, so a frame reuses a roll rather than making it afresh thirty times
// a second; a wheel on its hundredth turn has rolled a hundred, so the keeping is let go now and
// then.
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

// Turns made at x turns along: the whole ones, and the one under way in the ratchet's even clicks
// -- each whole turn on a roll of its own, so no turn of a wheel clicks like the one before.
function turns(rite, base, x) {
  const whole = Math.floor(x);
  return whole + roll(rite, base, whole).ratchet(x - whole);
}

// A surface that comes to stay, `k` of the way there, in the current fillStyle: the part of the
// box the piece's edge has passed, and over the half behind the edge's middle a second coat of the
// same colour. One edge moves while it comes, and at rest it is two shades of one colour split by
// that edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// The light that comes over a solved field, `k` of the way over it: cut in by the piece's edge on
// the roll it is handed, and resting in two shades.
function daybreak(g, own, env, w, h, k, strength) {
  if (k <= 0) return;
  g.fillStyle = env.alpha(env.colors.accent2, strength);
  cover(g, own, 0, 0, w, h, k);
}

/* ---- drawing shared by both ----------------------------------------------------------------- */

// The dust: specks where the configuration put them, a few of them heavier, standing still.
function background(g, w, h, env, v) {
  const col = env.colors;
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  glow.addColorStop(0, col.bg2);
  glow.addColorStop(1, col.bg);
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  for (let i = 0, n = Math.max(12, Math.round(85 * v.density)); i < n; i++) {
    const x = ((i * 0.61803398875 + v.turn * 0.23) % 1) * w;
    const y = ((i * 0.754877666 + v.turn * 0.17) % 1) * h;
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
  background(g, w, h, env, v);
  const well = map.at(p.wx, p.wy);
  body(g, env, well.x, well.y, k * WELL_R, 4 * v.scale, true);
  // The ring. Once a probe has passed it, it is a set surface: from the moment the field was
  // solved its disc is cut in by the piece's edge and its rim thickens, in the same treads as the
  // light over the field and the glow along the path -- one gesture, on the roll of the flight
  // that passed, so a ring passed on the fourth try lights in other treads than one passed on the
  // first. Never a fade.
  const ring = map.at(p.rx, p.ry);
  const ringR = k * RING_R;
  const pass = s.flight && s.pass && s.pass.d <= RING_R;
  const lit = pass && s.doneAt != null ? came(s, s.doneAt, 2.4, reduced) : 0;
  const light = roll(rite, 0x21, s.flights);
  const shone = light.stair(lit);
  g.fillStyle = env.alpha(col.accent2, 0.06);
  g.beginPath();
  g.arc(ring.x, ring.y, ringR, 0, Math.PI * 2);
  g.fill();
  if (shone > 0) {
    g.save();
    g.beginPath();
    g.arc(ring.x, ring.y, ringR, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = env.alpha(col.accent2, 0.22);
    cover(g, light, ring.x - ringR, ring.y - ringR, ringR * 2, ringR * 2, shone);
    g.restore();
  }
  const rim = shone;
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
  // The last flight, replayed from its launch in the rite's landing treads: the longest leap off
  // the pad, each after it shorter, until the head stands at the end of the path.
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
    // A passed flight's path is set too: a broad glow along it, shown where the edge crossing the
    // field has passed -- the same edge, in the same treads, as the light over the field.
    if (shone > 0) {
      g.save();
      g.beginPath();
      light.region(g, 0, 0, w, h, shone);
      g.clip();
      g.strokeStyle = env.alpha(col.accent2, 0.3);
      g.lineWidth = Math.max(12, k * 0.036);
      g.beginPath();
      for (let i = 0; i < until; i++) {
        const at = map.at(pts[i].x, pts[i].y);
        if (i) g.lineTo(at.x, at.y);
        else g.moveTo(at.x, at.y);
      }
      g.stroke();
      g.restore();
    }
    const head = map.at(pts[until - 1].x, pts[until - 1].y);
    // The head, and its glow at a size that holds.
    g.fillStyle = env.alpha(col.accent2, 0.22);
    g.beginPath();
    g.arc(head.x, head.y, Math.max(6, k * 0.02 * v.scale), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.fg;
    g.beginPath();
    g.arc(head.x, head.y, Math.max(2.5, k * 0.007 * v.scale), 0, Math.PI * 2);
    g.fill();
    // Where it came nearest the ring, marked once the flight has landed: the line is laid from
    // the probe's nearest point toward the ring in the treads of that flight's roll, never drawn
    // whole at once.
    const landed = reduced ? 1 : Math.max(0, Math.min(1, (s.clock - REPLAY) / 0.8));
    const laid = landed > 0 && !pass && s.pass ? roll(rite, 0x3e, s.flights).stair(landed) : 0;
    if (laid > 0) {
      const near = map.at(pts[s.pass.i].x, pts[s.pass.i].y);
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
  daybreak(g, light, env, w, h, shone, 0.07);
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
  // The verdict is cut on at its moment when a flight is released, on that flight's own roll;
  // nothing is said before it.
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
// even clicks, always toward the mark; and the speed line, climbed to up a stair. Both are what the
// readout counts, and each setting rolls its own.
function angleShown(s, rite, reduced) {
  if (s.aimAt == null) return s.angle;
  return s.aimFrom + (s.angle - s.aimFrom) * roll(rite, 0xa1, s.aims).ratchet(came(s, s.aimAt, 0.9, reduced));
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
          // A replay is another flight of the same path, on a roll of its own.
          s.flights += 1;
          s.clock = c.reduced ? REPLAY + 1 : 0;
          s.fraction = c.reduced ? 1 : 0;
          c.hint();
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
        // The replay runs in the landing treads this flight rolled: a leap off the pad, each
        // leap after it shorter, never past the end of the path.
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
  const n = env.int(3, 5);
  const number = 100 + env.int(0, 899);
  const name = 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const k = env.int(n === 3 ? 2 : 4, 8);
    const inner = env.int(10, 16);
    const outer = Math.round(inner * Math.pow(k, 2 / 3));
    if (Math.round(Math.pow(outer / inner, 1.5)) !== k || outer - inner < 3 * (n - 1)) continue;
    const middle = env.int(inner + 3, outer - 3);
    const radii = n === 3 ? [inner, middle, outer]
      : Array.from({ length: n }, (_, i) => Math.round(inner + (outer - inner) * i / (n - 1)));
    const names = shuffled(env, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n);
    let listing = shuffled(env, radii);
    const ascending = (list) => list.every((r, i) => i === 0 || list[i - 1] < r);
    for (let guard = 0; guard < 8 && ascending(listing); guard++) listing = shuffled(env, radii);
    if (ascending(listing)) listing = radii.slice().reverse();
    const angles = Array.from({ length: n }, () => env.int(0, 359));
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
  if (!Array.isArray(p.radii) || p.radii.length < 3 || p.radii.length > 5 || !p.radii.every((r) => Number.isInteger(r) && r >= 8 && r <= 70)) return null;
  const n = p.radii.length;
  const sorted = p.radii.slice().sort((a, b) => a - b);
  if (sorted.some((r, i) => i > 0 && r - sorted[i - 1] < 3)) return null;
  if (Math.round(Math.pow(sorted[n - 1] / sorted[0], 1.5)) !== p.k) return null;
  if (p.radii.every((r, i) => i === 0 || p.radii[i - 1] < r)) return null;
  if (!Array.isArray(p.names) || p.names.length !== n || !p.names.every((i) => Number.isInteger(i) && i >= 0 && i < FIRST.length) || new Set(p.names).size !== n) return null;
  if (!Array.isArray(p.angles) || p.angles.length !== n || !p.angles.every((a) => Number.isInteger(a) && a >= 0 && a < 360)) return null;
  return { kind: 'moons', number: p.number, name: p.name, k: p.k, radii: p.radii.slice(), names: p.names.slice(), angles: p.angles.slice() };
}

function moonsTitle(p) {
  return 'the moons of ' + p.name;
}

// The moons shortest period first: the order that solves it.
function moonsOrder(p) {
  return p.radii.map((r, i) => i).sort((a, b) => p.radii[a] - p.radii[b]);
}

function moonsScene(g, w, h, env, p, s, v) {
  const col = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  background(g, w, h, env, v);
  const cx = w * 0.46;
  const cy = h * 0.5;
  const outer = Math.max(...p.radii);
  const R = Math.min(w * 0.3, h * 0.4);
  const u = R / outer;
  const size = Math.max(10, Math.min(16, Math.round(Math.min(w, h) * 0.04)));
  const lit = s.doneAt == null ? 0 : came(s, s.doneAt, 2.6, reduced);
  // The orbits: dashed, and once the moons are in motion the dashes tick round in even clicks,
  // every turn of them on a roll of its own.
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
  // The laps the visitor says: that many notches round the outermost orbit. A new count steps
  // from the last one, up or down, in at most five treads on a roll of its own -- a counter that
  // counts toward the number set, never back.
  if (s.lapsAt != null) {
    const lapRite = roll(rite, 0x1a, s.counts);
    const treads = Math.max(1, Math.min(5, Math.abs(s.laps - s.lapsFrom)));
    const shown = s.lapsFrom + Math.round(lapRite.stair(came(s, s.lapsAt, 1.1, reduced), treads) * (s.laps - s.lapsFrom));
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
  // The moons where they stand, named. In motion, each rides its orbit in the even clicks of a
  // ratchet of its own, one whole lap per period, so the laps still stand in Kepler's ratio
  // while no moon ever glides. A moon the hint names is a set surface: its halo is cut in by the
  // piece's edge in treads, and its colour and its reading come with the first of them.
  const order = moonsOrder(p);
  // The visitor's order, as a numeral by each moon: the numerals arrive one tread at a time in a
  // series on the roll of that setting, so the second ordering deals them in another rhythm.
  const placed = s.orderAt != null ? roll(rite, 0x60, s.orders).series(came(s, s.orderAt, 0.9, reduced), p.radii.length) : 0;
  p.radii.forEach((r, i) => {
    const period = 30 * Math.pow(r / outer, 1.5);
    const a = (p.angles[i] + (s.spin ? 360 * turns(rite, 0x30 + i, s.spin / period) : 0)) * Math.PI / 180;
    const x = cx + Math.cos(a) * r * u;
    const y = cy + Math.sin(a) * r * u;
    const rad = Math.max(3, u * 1.1) * v.scale;
    // Only the moon the latest hint named is still coming; one named before stands lit.
    const hot = s.hinted && s.hinted.includes(i);
    const hotRite = roll(rite, 0x40 + i, 0);
    const hk = !hot ? 0 : s.hinted[s.hinted.length - 1] === i ? hotRite.stair(came(s, s.hintedAt, 1.4, reduced)) : 1;
    const on = hk > 0;
    const halo = g.createRadialGradient(x, y, 0, x, y, rad * 3);
    halo.addColorStop(0, env.alpha(col.accent, 0.45));
    halo.addColorStop(1, env.alpha(col.accent, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, rad * 3, 0, Math.PI * 2);
    g.fill();
    if (on) {
      g.save();
      g.beginPath();
      g.arc(x, y, rad * 3, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = env.alpha(col.accent2, 0.26);
      cover(g, hotRite, x - rad * 3, y - rad * 3, rad * 6, rad * 6, hk);
      g.restore();
    }
    g.fillStyle = on ? col.accent2 : col.fg;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    font(g, size * 0.85, 600);
    g.textAlign = Math.cos(a) < 0 ? 'right' : 'left';
    g.textBaseline = 'middle';
    g.fillStyle = env.alpha(on ? col.accent2 : col.fg, 0.9);
    const rank = order.indexOf(i);
    const clue = rank === 0 ? 'shortest period' : rank === order.length - 1 ? 'longest period' : 'period rank ' + (rank + 1);
    g.fillText(FIRST[p.names[i]] + (on ? ', ' + clue : ''), x + (Math.cos(a) < 0 ? -1 : 1) * rad * 1.8, y - rad * 1.6);
    const place = s.order ? s.order.indexOf(i) : -1;
    if (place >= 0 && place < placed) {
      // The numeral sits in a small set surface of its own, which comes with it on its tread of
      // the series: two shades of one colour split by the piece's edge, never a flat chip.
      const nx = x + (Math.cos(a) < 0 ? -1 : 1) * rad * 1.8;
      const ny = y + rad * 1.9;
      const boxW = size * 1.1;
      g.fillStyle = env.alpha(col.accent2, 0.18);
      cover(g, rite, Math.cos(a) < 0 ? nx - boxW : nx, ny - size * 0.5, boxW, size, 1);
      font(g, size * 0.8, 700);
      g.textAlign = Math.cos(a) < 0 ? 'right' : 'left';
      g.fillStyle = col.accent2;
      g.fillText(String(place + 1), nx + (Math.cos(a) < 0 ? -size * 0.15 : size * 0.15), ny);
    }
  });
  // The light over a solved sky, on the roll of the check that solved it.
  if (lit > 0) {
    const light = roll(rite, 0xdb, s.checks);
    daybreak(g, light, env, w, h, light.stair(lit), 0.07);
  }
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
  // The footer reads the settings back; a new reading is cut on at its moment on the roll of
  // that change, the old words gone before it.
  const foot = s.order && s.footAt != null ? 'shortest period first: ' + s.order.map((i) => FIRST[p.names[i]]).join(', ') + ' · ' + s.laps + (s.laps === 1 ? ' lap' : ' laps') + ' of the innermost for one of the outermost'
    : WORDS[p.radii.length] + ' moons to scale; the inner one laps the outer a whole number of times';
  if (s.footAt == null || roll(rite, 0x0f, s.foots).flicker(came(s, s.footAt, 0.7, reduced))) g.fillText(foot, w / 2, h * 0.95, w * 0.92);
}

function moonsState() {
  return {
    spin: 0, hinted: [], hintedAt: null, order: null, laps: 1, t: 0, doneAt: null,
    orderAt: null, orders: 0, lapsAt: null, lapsFrom: 1, counts: 0, footAt: null, foots: 0, checks: 0
  };
}

function moonsPreview(g, w, h, env, p, spin = 0) {
  moonsScene(g, w, h, env, p, Object.assign(moonsState(), { spin }), dials(env));
}

function moonsPiece(env, p) {
  const v = dials(env);
  const helps = asked(env).helps;
  const answer = moonsOrder(p);
  const n = p.radii.length;
  const s = Object.assign(moonsState(), { order: p.radii.map((r, i) => i) });
  const draw = (c) => moonsScene(c.g, c.w, c.h, c, p, s, v);
  const names = p.names.map((i) => FIRST[i]);
  return {
    title: moonsTitle(p),
    brief: WORDS[n][0].toUpperCase() + WORDS[n].slice(1) + ' moons circle ' + p.name + '. Their orbit radii are ' + names.map((name, i) => name + ': ' + p.radii[i] + ' units').join('; ') + '. A larger radius means a longer period. For the lap count, divide the outer radius by the inner radius, raise that ratio to 1.5, and round to the nearest whole number. The ruler shows the same measurements.',
    goal: 'Put the moons in order of period, shortest first, and say how many laps the innermost makes while the outermost makes one.',
    aspect: '16 / 10',
    checkLabel: 'check the orbits',
    steps: [
      { id: 'order', ask: 'the moons, shortest period first', kind: 'order', items: names.map((name, i) => ({ label: 'the ' + name + ' moon', value: i })) },
      { id: 'laps', ask: 'laps of the innermost moon for one lap of the outermost', kind: 'number', min: 1, max: 9, step: 1, value: 1, unit: 'laps' },
      { id: 'hint', ask: 'one moon in period order', kind: 'press', count: 1, label: 'show a clue', optional: true }
    ].filter(Boolean),
    solution: { order: answer.slice(), laps: p.k },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, n) ? value : s.order;
      const right = order.filter((m, i) => m === answer[i]).length;
      const laps = Math.round(Number(c.value('laps')));
      const off = Math.abs(laps - p.k);
      s.checks += 1;
      if (right === n && off === 0) {
        return { solved: true, say: 'in step: the ' + names[answer[0]] + ' moon laps ' + WORDS[p.k] + ' times for one lap of the ' + names[answer[n - 1]] + ' moon' };
      }
      const parts = [right === n ? 'the order holds' : right === 0 ? 'no moon stands in the right place' : WORDS[right] + ' of ' + WORDS[n] + ' in the right place'];
      parts.push(off === 0 ? 'the count holds' : off === 1 ? 'the count is off by one' : 'the count is off by more than one');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('read the radii off the ruler');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, n)) {
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
        if (s.hinted.length < Math.min(helps, n)) {
          const rank = s.hinted.length;
          const moon = answer[rank];
          s.hinted.push(moon);
          s.hintedAt = s.t;
          c.hint();
          c.status('period place ' + (rank + 1) + ': the ' + names[moon] + ' moon, at radius ' + p.radii[moon] + '; smaller orbits have shorter periods');
        } else {
          c.status('all the orbit clues available at this difficulty are marked; use the radii for the remaining order and lap count');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const outer = Math.max(...p.radii);
      const u = Math.min(c.w * 0.3, c.h * 0.4) / outer;
      let nearest = -1;
      let distance = Infinity;
      const rite = riteOf(c);
      p.radii.forEach((r, i) => {
        const period = 30 * Math.pow(r / outer, 1.5);
        const a = (p.angles[i] + (s.spin ? 360 * turns(rite, 0x30 + i, s.spin / period) : 0)) * Math.PI / 180;
        const d = Math.hypot(x * c.w - (c.w * 0.46 + Math.cos(a) * r * u), y * c.h - (c.h * 0.5 + Math.sin(a) * r * u));
        if (d < distance) { distance = d; nearest = i; }
      });
      c.status(distance <= Math.max(22, Math.min(c.w, c.h) * 0.08)
        ? 'the ' + names[nearest] + ' moon: orbit radius ' + p.radii[nearest] + ' units'
        : 'tap a moon to read its radius, or use the measurements above');
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
      c.status('the moons are in motion: watch the ' + names[answer[0]] + ' moon lap the ' + names[answer[n - 1]] + ' moon ' + WORDS[p.k] + ' times; tap any moon to inspect it');
    }
  };
}

/* ---- the meeting --------------------------------------------------------------------------- */

const MEETING_PERIODS = [[2, 3], [3, 4], [4, 5], [4, 6], [6, 8], [6, 9], [8, 10], [8, 12], [9, 12]];

function meetingTick(p) {
  return p.inner * p.outer / (p.outer - p.inner);
}

function meetingLaps(p) {
  return p.outer / (p.outer - p.inner);
}

function meetingPlan(env) {
  const periods = env.pick(MEETING_PERIODS);
  return {
    kind: 'meeting', number: 100 + env.int(0, 899),
    name: 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND),
    inner: periods[0], outer: periods[1],
    names: shuffled(env, FIRST.map((_, i) => i)).slice(0, 2),
    angle: env.int(0, 359)
  };
}

function carriedMeeting(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'meeting' || !Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (typeof p.name !== 'string' || !p.name || p.name.length > 40) return null;
  if (!MEETING_PERIODS.some(([inner, outer]) => inner === p.inner && outer === p.outer)) return null;
  if (!Array.isArray(p.names) || p.names.length !== 2 || !p.names.every((i) => Number.isInteger(i) && i >= 0 && i < FIRST.length) || p.names[0] === p.names[1]) return null;
  if (!Number.isInteger(p.angle) || p.angle < 0 || p.angle >= 360) return null;
  return { kind: 'meeting', number: p.number, name: p.name, inner: p.inner, outer: p.outer,
    names: p.names.slice(), angle: p.angle };
}

function meetingTitle(p) {
  return 'orbit ' + p.number + ': the returning moons';
}

// The tick the moons stand at: from the one they stood at to the one set, in the ratchet's even
// clicks on the roll of that setting -- a different rhythm every time the tick is changed -- and
// the set tick itself once the turn has landed (and at once where less motion is asked for).
function meetingShown(s, rite, reduced) {
  if (s.tickAt == null || reduced) return s.tick;
  const p = came(s, s.tickAt, 0.9, reduced);
  if (p >= 1) return s.tick;
  return s.tickFrom + (s.tick - s.tickFrom) * roll(rite, 0x3e, s.sets).ratchet(p);
}

function meetingScene(g, w, h, env, p, s, v) {
  const col = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  background(g, w, h, env, v);
  const cx = w * 0.5;
  const cy = h * 0.52;
  const radius = Math.min(w * 0.31, h * 0.32) * v.scale;
  const radii = [radius * Math.pow(p.inner / p.outer, 2 / 3), radius];
  const shown = meetingShown(s, rite, reduced);
  const landed = shown === s.tick;
  const joined = landed && s.tick > 0 && s.tick % meetingTick(p) === 0;
  // The reunion: its glow widens in treads from the moment the turn landed, on the roll of that
  // setting, and its line comes with the first of them; once found (end), the line deepens up a
  // stair of its own.
  const since = s.tickAt == null ? 1 : came(s, s.tickAt + 0.9, 0.8, reduced);
  const met = joined ? roll(rite, 0x3f, s.sets).stair(since) : 0;
  const found = s.open ? roll(rite, 0x0f0, 0).stair(came(s, s.openAt, 1.1, reduced)) : 0;
  const size = Math.max(9, Math.min(16, Math.round(Math.min(w, h) * 0.043)));
  g.strokeStyle = env.alpha(col.accent, 0.45);
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  for (const r of radii) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);
  const start = p.angle * Math.PI / 180 + v.turn * 0.6;
  g.strokeStyle = env.alpha(col.muted, 0.35);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
  g.stroke();
  body(g, env, cx, cy, Math.max(4, radius * 0.095), 4, false);
  [p.inner, p.outer].forEach((period, i) => {
    const angle = start + 2 * Math.PI * shown / period;
    const x = cx + Math.cos(angle) * radii[i];
    const y = cy + Math.sin(angle) * radii[i];
    const r = Math.max(3, radius * 0.055);
    // The glow widens and brightens in the treads of the reunion's stair, never a swell.
    const glow = g.createRadialGradient(x, y, 0, x, y, r * (3 + 2 * met));
    glow.addColorStop(0, env.alpha(i ? col.accent : col.accent2, 0.45 + 0.35 * met));
    glow.addColorStop(1, env.alpha(col.accent, 0));
    g.fillStyle = glow;
    g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    g.fillStyle = i ? col.accent : col.accent2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  });
  if (met > 0) {
    g.strokeStyle = env.alpha(col.accent2, 0.7 + 0.3 * found);
    g.lineWidth = 1.5 + found;
    g.beginPath();
    const innerAngle = start + 2 * Math.PI * s.tick / p.inner;
    g.moveTo(cx + Math.cos(innerAngle) * radii[0], cy + Math.sin(innerAngle) * radii[0]);
    g.lineTo(cx + Math.cos(innerAngle) * radius, cy + Math.sin(innerAngle) * radius);
    g.stroke();
  }
  font(g, size);
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = col.fg;
  g.fillText(p.name, cx, h * 0.07, w * 0.88);
  g.textAlign = 'left';
  g.fillStyle = col.accent2;
  g.fillText(FIRST[p.names[0]] + ': ' + p.inner + ' ticks/lap', w * 0.04, h * 0.19, w * 0.45);
  g.textAlign = 'right';
  g.fillStyle = col.accent;
  g.fillText(FIRST[p.names[1]] + ': ' + p.outer + ' ticks/lap', w * 0.96, h * 0.19, w * 0.45);
  g.textAlign = 'center';
  g.fillStyle = env.alpha(col.fg, 0.9);
  // The reading is cut over to the new tick's words at its moment once the turn lands, on the
  // setting's roll; the clue is cut on at its moment when it is first asked for.
  if (landed && roll(rite, 0x2e, s.sets).flicker(s.tickAt == null ? 1 : came(s, s.tickAt + 0.9, 0.6, reduced))) {
    g.fillText(s.tick === 0 ? 'tick 0: together at the start'
      : 'tick ' + s.tick + (joined ? ': together again' : ': still apart'), cx, h * 0.86, w * 0.92);
  }
  if (s.hints && roll(rite, 0x7e, 0).flicker(came(s, s.hintAt, 0.8, reduced))) {
    g.fillStyle = env.alpha(col.accent2, 0.9);
    g.fillText('inner gains ' + (p.outer - p.inner) + '/' + (p.inner * p.outer) + ' lap each tick',
      cx, h * 0.95, w * 0.92);
  }
}

function meetingState() {
  return { tick: 0, tickFrom: 0, tickAt: null, sets: 0, hints: 0, hintAt: null, open: false, openAt: null, t: 0 };
}

function meetingPreview(g, w, h, env, p) {
  meetingScene(g, w, h, env, p, meetingState(), dials(env));
}

function meetingPiece(env, p) {
  const helps = asked(env).helps;
  const first = meetingTick(p);
  const laps = meetingLaps(p);
  const s = meetingState();
  const draw = (c) => meetingScene(c.g, c.w, c.h, c, p, s, dials(env));
  const clues = [
    'Each tick the inner gains ' + (p.outer - p.inner) + '/' + (p.inner * p.outer) + ' of a lap on the outer.',
    'At tick ' + p.inner + ', the inner has made one lap; the outer has not.',
    'At tick ' + (first / 2) + ', the inner is half a lap ahead.',
    'They are still apart at tick ' + (first - 1) + '.',
    'At their first reunion the inner has made ' + laps + ' full laps.'
  ];
  return {
    title: meetingTitle(p),
    brief: 'Two moons of ' + p.name + ' start on the same line at tick 0. The ' + FIRST[p.names[0]] + ' moon makes a full lap every ' + p.inner + ' ticks; the ' + FIRST[p.names[1]] + ' moon takes ' + p.outer + '. Set a tick to turn them. They meet again when the faster moon has gained one full lap on the slower one.',
    goal: 'Find the first tick after 0 when they line up again, and count the inner moon\'s full laps by then.',
    aspect: '16 / 10',
    checkLabel: 'check the meeting',
    steps: [
      { id: 'tick', ask: 'the first tick when the moons meet again', kind: 'number', min: 0, max: 40, step: 1, value: 0, unit: 'ticks' },
      { id: 'laps', ask: 'full laps of the inner moon by then', kind: 'number', min: 0, max: 9, step: 1, value: 0, unit: 'laps' },
      { id: 'hint', ask: 'one clue about the next meeting', kind: 'press', count: 1, label: 'show a clue', optional: true }
    ],
    solution: { tick: first, laps },
    check(c) {
      const tick = Number(c.value('tick'));
      const count = Number(c.value('laps'));
      if (tick === first && count === laps) {
        return { solved: true, say: 'together again at tick ' + first + ': the inner moon has made ' + laps + ' full laps' };
      }
      const position = tick === 0 ? 'they are together only at the start'
        : tick > 0 && tick % first === 0 ? 'they meet at this tick, but not for the first time'
          : 'they are apart at this tick';
      return { solved: false, say: position + '; the inner lap count is ' + (count === laps ? 'right' : 'off') };
    },
    start(c) {
      c.status('both moons start on one line; set a tick to turn them');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'tick' && Number.isFinite(Number(value))) {
        const next = Math.max(0, Math.min(40, Math.round(Number(value))));
        if (next !== s.tick) {
          // The moons set out from wherever they stand, on a fresh roll for this turn.
          s.tickFrom = meetingShown(s, riteOf(c), !!c.reduced);
          s.tick = next;
          s.tickAt = s.t;
          s.sets += 1;
        }
        c.status('tick ' + s.tick + ': ' + (s.tick === 0 ? 'together at the start'
          : s.tick % first === 0 ? 'on the same line again' : 'the moons are apart'));
      }
      if (id === 'laps' && Number.isFinite(Number(value))) {
        c.status('the inner moon has made ' + Math.round(Number(value)) + ' full laps, you say');
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          c.status(clues[s.hints]);
          s.hints++;
          if (s.hints === 1) s.hintAt = s.t;
          c.hint();
        } else c.status('that is all this orbit will show at this difficulty');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      c.status('the moons meet at tick ' + first + '. Change the tick to watch them part and return.');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsMoons(env) {
  return env.chance(0.5);
}

const plans = new WeakMap();
function deal(env) {
  let plan = plans.get(env);
  if (!plan) {
    plan = dealsMoons(env) ? (env.chance(0.5) ? moonsPlan(env) : meetingPlan(env)) : slingPlan(env);
    plans.set(env, plan);
  }
  return plan;
}

export default {
  id: 'gravity-well',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'moons') moonsPreview(g, w, h, env, plan);
    else if (plan.kind === 'meeting') meetingPreview(g, w, h, env, plan);
    else slingPreview(g, w, h, env, plan);
  },
  animate(g, w, h, env, t) {
    const plan = deal(env);
    if (plan.kind !== 'moons' || env.reduced) return false;
    moonsPreview(g, w, h, env, plan, Math.max(0, t) * 0.5);
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'moons') {
      const p = plan;
      return {
        title: moonsTitle(p),
        text: WORDS[p.radii.length][0].toUpperCase() + WORDS[p.radii.length].slice(1) + ' moons drawn to scale. Order them by period and count the inner moon\'s laps; after solving, watch the system turn and inspect any moon.',
        mono: 'period ∝ radius³ᐟ²',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => moonsPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    if (plan.kind === 'meeting') {
      const p = plan;
      return {
        title: meetingTitle(p),
        text: 'Two moons start together. Turn the system to find their first meeting and count the inner moon\'s full laps.',
        mono: FIRST[p.names[0]] + ' ' + p.inner + ' ticks/lap / ' + FIRST[p.names[1]] + ' ' + p.outer + ' ticks/lap',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => meetingPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = plan;
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
    const meeting = carriedMeeting(env);
    if (meeting) return meetingPiece(env, meeting);
    const plan = deal(env);
    return plan.kind === 'moons' ? moonsPiece(env, plan)
      : plan.kind === 'meeting' ? meetingPiece(env, plan) : slingPiece(env, plan);
  }
};
