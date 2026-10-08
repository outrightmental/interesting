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

/* ---- drawing shared by both ----------------------------------------------------------------- */

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
  const map = fieldMap(w, h);
  const k = map.k;
  background(g, w, h, env, v);
  const well = map.at(p.wx, p.wy);
  body(g, env, well.x, well.y, k * WELL_R, 4 * v.scale, true);
  // The ring.
  const ring = map.at(p.rx, p.ry);
  const pass = s.flight && s.pass && s.pass.d <= RING_R;
  g.fillStyle = env.alpha(col.accent2, pass ? 0.18 + 0.1 * s.fade : 0.06);
  g.beginPath();
  g.arc(ring.x, ring.y, k * RING_R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = env.alpha(col.accent2, pass ? 1 : 0.85);
  g.lineWidth = Math.max(1.5, k * 0.006);
  g.beginPath();
  g.arc(ring.x, ring.y, k * RING_R, 0, Math.PI * 2);
  g.stroke();
  // The launch pad, with the angle marks round it and the aim as set.
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
  const aim = -s.angle * Math.PI / 180;
  const reach = k * (0.1 + s.speed / 100 * 0.22);
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
  // The last flight, replayed from its launch.
  if (s.flight) {
    const pts = s.flight.pts;
    const until = Math.max(2, Math.min(pts.length, Math.ceil(pts.length * s.fraction)));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = env.alpha(col.accent2, pass ? 0.95 : 0.8);
    g.lineWidth = Math.max(1.5, k * 0.006 * v.scale);
    g.beginPath();
    for (let i = 0; i < until; i++) {
      const at = map.at(pts[i].x, pts[i].y);
      if (i) g.lineTo(at.x, at.y);
      else g.moveTo(at.x, at.y);
    }
    g.stroke();
    const head = map.at(pts[until - 1].x, pts[until - 1].y);
    g.fillStyle = env.alpha(col.accent2, 0.22);
    g.beginPath();
    g.arc(head.x, head.y, Math.max(6, k * 0.02 * v.scale), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.fg;
    g.beginPath();
    g.arc(head.x, head.y, Math.max(2.5, k * 0.007 * v.scale), 0, Math.PI * 2);
    g.fill();
    if (s.fraction >= 1 && !pass && s.pass) {
      // Where it came nearest the ring, marked.
      const near = map.at(pts[s.pass.i].x, pts[s.pass.i].y);
      g.strokeStyle = env.alpha(col.accent, 0.7);
      g.lineWidth = 1;
      g.setLineDash([2, 4]);
      g.beginPath();
      g.moveTo(near.x, near.y);
      g.lineTo(ring.x, ring.y);
      g.stroke();
      g.setLineDash([]);
    }
  }
  const size = Math.max(10, Math.min(17, Math.round(Math.min(w, h) * 0.042)));
  font(g, size);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = env.alpha(col.fg, 0.85);
  g.fillText(p.name, w * 0.04, h * 0.07, w * 0.5);
  g.textAlign = 'right';
  g.fillStyle = env.alpha(col.accent2, 0.9);
  g.fillText((s.angle > 0 ? '+' : '') + s.angle + '° · speed ' + s.speed, w * 0.96, h * 0.07, w * 0.5);
  g.textAlign = 'center';
  g.fillStyle = env.alpha(col.muted, 0.85);
  g.fillText(s.flight ? s.verdict : 'the well bends every flight the same way; through the ring is the goal', w / 2, h * 0.94, w * 0.92);
}

function slingState(p) {
  return { angle: AIM.open, speed: PUSH.open, flight: null, pass: null, fraction: 0, clock: 0, verdict: '', fade: 0 };
}

function slingPreview(g, w, h, env, p) {
  slingScene(g, w, h, env, p, slingState(p), dials(env));
}

function widths(d) {
  return (d / (RING_R * 2)).toFixed(1);
}

function slingPiece(env, p) {
  const v = dials(env);
  const s = slingState(p);
  const draw = (c) => slingScene(c.g, c.w, c.h, c, p, s, v);
  const clampTo = (value, knob) => Math.max(knob.min, Math.min(knob.max, Math.round(Number(value)) || 0));
  return {
    title: slingTitle(p),
    brief: 'A probe leaves the pad at the left edge at the angle and the speed you set, and ' + p.name + ' bends its path the same way every time. Every check is a flight; the ring is where it has to pass.',
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
      s.clock = 0;
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
      if (id === 'angle') {
        s.angle = clampTo(value, AIM);
        c.status('aimed ' + (s.angle === 0 ? 'straight across' : Math.abs(s.angle) + ' degrees ' + (s.angle > 0 ? 'up' : 'down')));
      }
      if (id === 'speed') {
        s.speed = clampTo(value, PUSH);
        c.status('speed ' + s.speed + ' of 100');
      }
      if (id === 'again') {
        if (s.flight) {
          s.clock = 0;
          s.fraction = c.reduced ? 1 : 0;
          c.status('the last flight, again: ' + s.verdict);
        } else {
          c.status('nothing has flown yet; release the probe first');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.flight && s.fraction < 1) {
        s.clock += dt;
        s.fraction = c.reduced ? 1 : Math.min(1, s.clock / REPLAY);
      }
      if (c.done) s.fade = Math.min(1, s.fade + dt);
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
  background(g, w, h, env, v);
  const cx = w * 0.46;
  const cy = h * 0.5;
  const outer = Math.max(...p.radii);
  const R = Math.min(w * 0.3, h * 0.4);
  const u = R / outer;
  const size = Math.max(10, Math.min(16, Math.round(Math.min(w, h) * 0.04)));
  // The orbits.
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  p.radii.forEach((r) => {
    g.strokeStyle = env.alpha(col.accent, 0.45);
    g.beginPath();
    g.arc(cx, cy, r * u, 0, Math.PI * 2);
    g.stroke();
  });
  g.setLineDash([]);
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
  // The moons where they stand, named.
  const order = moonsOrder(p);
  p.radii.forEach((r, i) => {
    const a = (p.angles[i] + (s.spin ? s.spin * 360 / (30 * Math.pow(r / outer, 1.5)) : 0)) * Math.PI / 180;
    const x = cx + Math.cos(a) * r * u;
    const y = cy + Math.sin(a) * r * u;
    const rad = Math.max(3, u * 1.1) * v.scale;
    const hot = s.hinted && s.hinted.includes(i);
    const halo = g.createRadialGradient(x, y, 0, x, y, rad * 3);
    halo.addColorStop(0, env.alpha(hot ? col.accent2 : col.accent, 0.45));
    halo.addColorStop(1, env.alpha(col.accent, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, rad * 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hot ? col.accent2 : col.fg;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    font(g, size * 0.85, 600);
    g.textAlign = Math.cos(a) < 0 ? 'right' : 'left';
    g.textBaseline = 'middle';
    g.fillStyle = env.alpha(hot ? col.accent2 : col.fg, 0.9);
    g.fillText(FIRST[p.names[i]] + (hot ? ', ' + ['shortest', 'middle', 'longest'][order.indexOf(i)] + ' period' : ''), x + (Math.cos(a) < 0 ? -1 : 1) * rad * 1.8, y - rad * 1.6);
  });
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
  const foot = s.order ? 'shortest period first: ' + s.order.map((i) => FIRST[p.names[i]]).join(', ') + ' · ' + s.laps + (s.laps === 1 ? ' lap' : ' laps') + ' of the innermost for one of the outermost'
    : 'three moons to scale; the inner one laps the outer a whole number of times';
  g.fillText(foot, w / 2, h * 0.95, w * 0.92);
}

function moonsPreview(g, w, h, env, p) {
  moonsScene(g, w, h, env, p, { spin: 0, hinted: [], order: null, laps: 1 }, dials(env));
}

function moonsPiece(env, p) {
  const v = dials(env);
  const answer = moonsOrder(p);
  const s = { spin: 0, hinted: [], order: [0, 1, 2], laps: 1 };
  const draw = (c) => moonsScene(c.g, c.w, c.h, c, p, s, v);
  const names = p.names.map((i) => FIRST[i]);
  return {
    title: moonsTitle(p),
    brief: 'Three moons circle ' + p.name + ', drawn to scale: the ruler reads each orbit\'s radius and the bar is ten units. A moon\'s period grows as its radius to the three halves (the square of the period as the cube of the radius), and these three were chosen so that the innermost laps the outermost a whole number of times.',
    goal: 'Put the moons in order of period, shortest first, and say how many laps the innermost makes while the outermost makes one.',
    aspect: '16 / 10',
    checkLabel: 'check the orbits',
    steps: [
      { id: 'order', ask: 'the moons, shortest period first', kind: 'order', items: [0, 1, 2].map((i) => ({ label: 'the ' + names[i] + ' moon', value: i })) },
      { id: 'laps', ask: 'laps of the innermost moon for one lap of the outermost', kind: 'number', min: 1, max: 9, step: 1, value: 1, unit: 'laps' },
      { id: 'hint', ask: 'which moon has the shortest period', kind: 'press', count: 1, label: 'name it', optional: true }
    ],
    solution: { order: answer.slice(), laps: p.k },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, 3) ? value : s.order;
      const right = order.filter((m, i) => m === answer[i]).length;
      const laps = Math.round(Number(c.value('laps')));
      const off = Math.abs(laps - p.k);
      if (right === 3 && off === 0) {
        return { solved: true, say: 'in step: the ' + names[answer[0]] + ' moon laps ' + WORDS[p.k] + ' times for one lap of the ' + names[answer[2]] + ' moon' };
      }
      const parts = [right === 3 ? 'the order holds' : right === 0 ? 'no moon stands in the right place' : WORDS[right] + ' of three in the right place'];
      parts.push(off === 0 ? 'the count is right' : off === 1 ? 'the count is off by one' : 'the count is off by more than one');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('read the radii off the ruler');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, 3)) {
        s.order = value.slice();
        c.status('shortest period first: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'laps') {
        const n = Math.round(Number(value));
        if (n >= 1 && n <= 9) s.laps = n;
        c.status(s.laps + (s.laps === 1 ? ' lap' : ' laps') + ' of the innermost for one of the outermost');
      }
      if (id === 'hint') {
        if (!s.hinted.includes(answer[0])) {
          s.hinted.push(answer[0]);
          c.hint();
          c.status('the ' + names[answer[0]] + ' moon has the shortest period: it rides the innermost orbit');
        } else {
          c.status('the ' + names[answer[0]] + ' moon is marked already; the count follows from the two radii');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done && !c.reduced) s.spin += dt;
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
