/* Three flights: a probe past one well, a close pair past two wells, or an ideal gravity
   assist past a uniformly moving well. Cards carry their exact subject into the piece.
   The assist uses a gravitational hyperbola, not a drawn bend: changing viewpoint changes
   only the coordinates, and its far-away speeds follow from the same trajectory. */

const FIRST = ['amber', 'opal', 'iron', 'cinder', 'glass', 'violet', 'salt', 'copper'];
const SECOND = ['harbor', 'eye', 'throat', 'island', 'gate', 'heart', 'anchor', 'mirror'];
const FLYBY_GUESSES = [
  { label: 'strikes the well', value: 'impact' },
  { label: 'escapes the field', value: 'escape' },
  { label: 'stays nearby', value: 'near' }
];
const PAIR_GUESSES = [
  { label: 'stay close', value: 'close' },
  { label: 'part ways', value: 'split' }
];
const BALANCES = [
  { label: 'upper well', value: 'upper' },
  { label: 'even pull', value: 'even' },
  { label: 'lower well', value: 'lower' }
];
const ASSIST_GUESSES = [
  { label: 'comes out faster', value: 'faster' },
  { label: 'comes out slower', value: 'slower' },
  { label: 'keeps its speed', value: 'same' }
];
const ASSIST_VIEWS = [
  { label: 'from the room', value: 'room' },
  { label: 'from the well', value: 'well' }
];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const DURATION = 4.5;
const ASSIST_BRIEF = 'Set the well moving toward the probe, with it, or not at all. Choose a viewpoint, predict the probe\'s far-away speed in the room, then release it. The probe never fires its engine.';

function plan(env) {
  return {
    family: (env.seed & 1) ? 'pair' : 'flyby',
    number: (env.seed >>> 0) % 997 + 1,
    name: 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND),
    cx: 0.53 + (env.rnd() - 0.5) * 0.13,
    cy: 0.5 + (env.rnd() - 0.5) * 0.11,
    sy: 0.65 + (env.rnd() - 0.5) * 0.22,
    mass: 0.044 + env.rnd() * 0.04,
    speed: env.int(35, 70),
    gap: 0.007 + env.rnd() * 0.014
  };
}

function carried(env) {
  const p = env.card && env.card.of;
  const between = (value, low, high) => typeof value === 'number' && Number.isFinite(value)
    && value >= low && value <= high;
  if (p && (p.family === 'flyby' || p.family === 'pair')
      && Number.isInteger(p.number) && between(p.number, 1, 997)
      && typeof p.name === 'string' && p.name.length > 0 && p.name.length < 80
      && between(p.cx, 0.45, 0.61) && between(p.cy, 0.44, 0.56)
      && between(p.sy, 0.53, 0.77) && between(p.mass, 0.044, 0.084)
      && Number.isInteger(p.speed) && between(p.speed, 35, 70)
      && between(p.gap, 0.007, 0.021)) return p;
  return null;
}

function title(p) {
  return p.family === 'pair'
    ? 'pair ' + p.number + ' at ' + p.name
    : 'flight ' + p.number + ' past ' + p.name;
}

function bodies(p, balance) {
  if (p.family === 'flyby') return [{ x: p.cx, y: p.cy, mass: p.mass }];
  return [
    { x: p.cx, y: p.cy - 0.17, mass: p.mass * (balance === 'upper' ? 1.65 : balance === 'lower' ? 0.6 : 1) },
    { x: p.cx, y: p.cy + 0.17, mass: p.mass * (balance === 'lower' ? 1.65 : balance === 'upper' ? 0.6 : 1) }
  ];
}

function trace(p, state, offset) {
  const wells = bodies(p, state.balance);
  const start = { x: 0.1, y: p.sy + offset };
  let dx = state.aim.x - start.x;
  let dy = state.aim.y + offset - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) { dx = 1; dy = 0; }
  else { dx /= length; dy /= length; }
  const speed = 0.2 + state.speed * 0.0055;
  let x = start.x;
  let y = start.y;
  let vx = dx * speed;
  let vy = dy * speed;
  let closest = Infinity;
  let outcome = 'near';
  const points = [{ x, y }];
  for (let i = 0; i < 340; i++) {
    let ax = 0;
    let ay = 0;
    for (const well of wells) {
      const wx = well.x - x;
      const wy = well.y - y;
      const r2 = wx * wx + wy * wy;
      closest = Math.min(closest, Math.sqrt(r2));
      if (r2 < 0.0022) {
        outcome = 'impact';
        break;
      }
      const pull = well.mass / Math.pow(r2 + 0.003, 1.5);
      ax += wx * pull;
      ay += wy * pull;
    }
    if (outcome === 'impact') break;
    vx += ax * 0.028;
    vy += ay * 0.028;
    x += vx * 0.028;
    y += vy * 0.028;
    points.push({ x, y });
    if (x < -0.28 || x > 1.28 || y < -0.28 || y > 1.28) {
      outcome = 'escape';
      break;
    }
  }
  return { points, closest, outcome, last: points[points.length - 1] };
}

function paths(p, state) {
  return p.family === 'pair'
    ? [trace(p, state, -p.gap / 2), trace(p, state, p.gap / 2)]
    : [trace(p, state, 0)];
}

function point(w, h, x, y) {
  const size = Math.min(w, h);
  return { x: w / 2 + (x - 0.5) * size, y: h / 2 + (y - 0.5) * size };
}

function background(g, w, h, env, variant) {
  const col = env.colors;
  const v = variant || env.variant || PLAIN;
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  glow.addColorStop(0, col.bg2);
  glow.addColorStop(1, col.bg);
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  for (let i = 0, n = Math.round(85 * v.density); i < n; i++) {
    const x = ((i * 0.61803398875 + v.turn * 0.23) % 1) * w;
    const y = ((i * 0.754877666 + v.turn * 0.17) % 1) * h;
    g.fillStyle = env.alpha(col.fg, 0.12 + (i % 4) * 0.06);
    g.fillRect(x, y, i % 9 ? 1 : 1.7, i % 9 ? 1 : 1.7);
  }
}

function wellAt(g, env, x, y, radius) {
  const col = env.colors;
  const halo = g.createRadialGradient(x, y, radius * 0.3, x, y, radius * 5);
  halo.addColorStop(0, env.alpha(col.accent2, 0.34));
  halo.addColorStop(1, env.alpha(col.accent2, 0));
  g.fillStyle = halo;
  g.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10);
  g.strokeStyle = env.alpha(col.accent, 0.3);
  g.lineWidth = 1;
  g.setLineDash([Math.max(2, radius * 0.16), Math.max(4, radius * 0.36)]);
  for (const ring of [2.2, 3.7]) {
    g.beginPath();
    g.arc(x, y, radius * ring, 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);
  const surface = g.createRadialGradient(x - radius * 0.3, y - radius * 0.4, 0, x, y, radius);
  surface.addColorStop(0, col.fg);
  surface.addColorStop(0.22, col.accent2);
  surface.addColorStop(1, col.bg2);
  g.fillStyle = surface;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

function draw(g, w, h, env, p, state, routes, fraction, finished) {
  const col = env.colors;
  const v = env.variant || PLAIN;
  const size = Math.min(w, h);
  background(g, w, h, env, v);

  for (const well of bodies(p, state.balance)) {
    const at = point(w, h, well.x, well.y);
    wellAt(g, env, at.x, at.y, size * 0.05 * v.scale);
  }

  const launch = point(w, h, 0.1, p.sy);
  if (!state.fired) {
    const target = point(w, h, state.aim.x, state.aim.y);
    g.strokeStyle = env.alpha(col.fg, 0.38);
    g.lineWidth = 1;
    g.setLineDash([3, 6]);
    g.beginPath();
    g.moveTo(launch.x, launch.y);
    g.lineTo(target.x, target.y);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = col.accent2;
    g.beginPath();
    g.arc(target.x, target.y, Math.max(6, size * 0.018), 0, Math.PI * 2);
    g.stroke();
  }

  routes.forEach((route, index) => {
    const color = index ? col.accent : col.accent2;
    const until = Math.max(2, Math.min(route.points.length, Math.ceil(route.points.length * fraction)));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (index) g.setLineDash([Math.max(3, size * 0.012), Math.max(3, size * 0.01)]);
    g.beginPath();
    for (let i = 0; i < until; i++) {
      const at = point(w, h, route.points[i].x, route.points[i].y);
      if (i) g.lineTo(at.x, at.y);
      else g.moveTo(at.x, at.y);
    }
    g.strokeStyle = env.alpha(color, finished ? 0.88 : state.fired ? 0.75 : 0.42);
    g.lineWidth = Math.max(1.5, size * (index ? 0.006 : 0.008) * v.scale);
    g.stroke();
    g.setLineDash([]);
    const last = route.points[until - 1];
    const at = point(w, h, last.x, last.y);
    g.fillStyle = env.alpha(color, 0.22);
    g.beginPath();
    g.arc(at.x, at.y, Math.max(7, size * 0.023 * v.scale), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.fg;
    g.beginPath();
    g.arc(at.x, at.y, Math.max(2.5, size * 0.008 * v.scale), 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = col.fg;
  g.beginPath();
  g.arc(launch.x, launch.y, Math.max(2, size * 0.007), 0, Math.PI * 2);
  g.fill();
}

function preview(g, w, h, env, p) {
  const state = { aim: { x: p.cx, y: p.cy - 0.12 }, speed: p.speed, balance: 'even', fired: false };
  draw(g, w, h, env, p, state, paths(p, state), 0.27, false);
}

function finding(p, state, routes) {
  const prediction = state.guess;
  if (p.family === 'pair') {
    const a = routes[0];
    const b = routes[1];
    const distance = Math.hypot(a.last.x - b.last.x, a.last.y - b.last.y);
    const split = a.outcome !== b.outcome || distance > 0.16;
    const result = split ? 'split' : 'close';
    return 'The two paths ' + (split ? 'parted' : 'stayed close') + ', ending '
      + Math.round(distance * 100) + ' marks apart. You predicted they would '
      + (prediction === 'split' ? 'part ways' : 'stay close') + '. '
      + (prediction === result ? 'You called it.' : 'Try another aim on the next pair.');
  }
  const route = routes[0];
  const result = route.outcome;
  const said = result === 'impact' ? 'The probe struck ' + p.name + '.'
    : result === 'escape' ? 'The probe escaped the field.'
      : 'The probe stayed near ' + p.name + ' for the whole flight.';
  return said + ' Its closest pass was ' + Math.round(route.closest * 100)
    + ' marks from a well. You predicted it would '
    + (FLYBY_GUESSES.find((guess) => guess.value === prediction) || FLYBY_GUESSES[0]).label + '. '
    + (prediction === result ? 'You called it.' : 'A small change in aim can change the ending.');
}

function launchPiece(env, carriedPlan) {
  const p = carriedPlan || carried(env) || plan(env);
  const pair = p.family === 'pair';
  const state = {
    aim: { x: p.cx, y: p.cy - 0.12 }, speed: p.speed, balance: 'even', guess: '',
    fired: false, time: 0, watched: false, halfway: false
  };
  let routes = paths(p, state);
  const show = (c) => draw(c.g, c.w, c.h, env, p, state, routes,
    c.done ? 1 : state.fired ? Math.min(1, state.time / DURATION) : 0.27, c.done);
  const recalculate = (c) => {
    routes = paths(p, state);
    if (state.fired && !state.watched) {
      state.time = 0;
      state.halfway = false;
      c.progress('watch', 0);
    }
    show(c);
  };
  const steps = pair ? [
    { id: 'balance', ask: 'which well pulls harder?', kind: 'choice', options: BALANCES },
    { id: 'aim', ask: 'tap anywhere to aim two probes a hair apart', kind: 'tap', label: 'aim the pair for me' },
    { id: 'guess', ask: 'will their paths stay close?', kind: 'choice', options: PAIR_GUESSES },
    { id: 'fire', ask: 'release the pair', kind: 'press', count: 1, label: 'release both', after: 'aim' },
    { id: 'watch', ask: 'watch both paths unfold', kind: 'wait', after: 'fire' }
  ] : [
    { id: 'aim', ask: 'tap anywhere to aim the probe', kind: 'tap', label: 'aim the probe for me' },
    { id: 'speed', ask: 'launch speed', kind: 'range', min: 0, max: 100, step: 1, value: p.speed, low: 'gentle', high: 'fast' },
    { id: 'guess', ask: 'where will the probe go?', kind: 'choice', options: FLYBY_GUESSES },
    { id: 'fire', ask: 'release the probe', kind: 'press', count: 1, label: 'release probe', after: 'aim' },
    { id: 'watch', ask: 'watch the flight unfold', kind: 'wait', after: 'fire' }
  ];
  return {
    title: title(p),
    brief: pair
      ? 'Choose which well pulls harder, tap anywhere to aim two probes a hair apart, predict whether their paths split, then release them and watch.'
      : 'Tap anywhere to aim a probe past ' + p.name + ', set its speed, predict where it goes, then release it and watch.',
    aspect: '16 / 10',
    steps,
    start(c) {
      c.status('The pale line shows the aim. Tap anywhere in the scene, or use the aim button.');
      show(c);
    },
    apply(id, value, c) {
      if (id === 'balance') {
        state.balance = BALANCES.some((option) => option.value === value) ? value : 'even';
        recalculate(c);
        c.status((BALANCES.find((option) => option.value === state.balance) || BALANCES[1]).label + ' pulls harder.');
      }
      if (id === 'speed') {
        state.speed = Math.max(0, Math.min(100, Number(value)));
        recalculate(c);
        c.status('Launch speed set to ' + Math.round(state.speed) + ' out of 100.');
      }
      if (id === 'guess') {
        state.guess = String(value);
        c.status('Prediction set. You can change it until the flight ends.');
      }
      if (id === 'fire') {
        state.fired = true;
        state.time = 0;
        state.halfway = false;
        c.status(pair ? 'Both probes are moving.' : 'The probe is moving.');
        show(c);
      }
    },
    tap(x, y, c) {
      if (c.done) return;
      const size = Math.min(c.w, c.h);
      state.aim = {
        x: Math.max(0, Math.min(1, 0.5 + (x - 0.5) * c.w / size)),
        y: Math.max(0, Math.min(1, 0.5 + (y - 0.5) * c.h / size))
      };
      recalculate(c);
      c.progress('aim', 1);
      c.status('Aim set. The short trails hint at the bend; release to see the rest.');
      c.satisfy('aim');
    },
    frame(t, dt, c) {
      if (state.fired && !state.watched) {
        state.time = Math.min(DURATION, state.time + (c.reduced ? DURATION : Math.max(0, dt)));
        c.progress('watch', state.time / DURATION);
        if (!state.halfway && state.time >= DURATION / 2 && state.time < DURATION) {
          state.halfway = true;
          c.status(pair ? 'The two paths are bending. Their endings are still ahead.' : 'The probe is rounding the well. Its ending is still ahead.');
        }
        if (state.time >= DURATION) {
          state.watched = true;
          c.satisfy('watch');
          if (!c.done) c.status('The paths have finished. Set any choice still waiting to reveal the finding.');
        }
      }
      show(c);
    },
    end(c) {
      state.time = DURATION;
      c.status(finding(p, state, routes));
      show(c);
    }
  };
}

function dealsAssist(env) {
  return (env.seed >>> 0) % 3 === 2;
}

function assistPlan(env) {
  return {
    family: 'assist',
    number: (env.seed >>> 0) % 997 + 1,
    name: 'the ' + env.pick(FIRST) + ' ' + env.pick(SECOND),
    speed: 0.46 + env.rnd() * 0.24,
    mass: 0.012 + env.rnd() * 0.01,
    offset: 0.14 + env.rnd() * 0.22,
    side: env.chance(0.5) ? 1 : -1,
    travel: env.pick([-80, -55, -30, 30, 55, 80]),
    duration: env.pick([3.6, 4.2, 4.8])
  };
}

function carriedAssist(env) {
  const p = env.card && env.card.of;
  const between = (value, low, high) => typeof value === 'number' && Number.isFinite(value)
    && value >= low && value <= high;
  if (!p || p.family !== 'assist'
      || !Number.isInteger(p.number) || !between(p.number, 1, 997)
      || typeof p.name !== 'string' || !p.name.length || p.name.length >= 80
      || !between(p.speed, 0.46, 0.7) || !between(p.mass, 0.012, 0.022)
      || !between(p.offset, 0.14, 0.36) || (p.side !== 1 && p.side !== -1)
      || !Number.isInteger(p.travel) || !between(p.travel, -100, 100)
      || !between(p.duration, 3.6, 4.8)) return null;
  return {
    family: p.family, number: p.number, name: p.name, speed: p.speed,
    mass: p.mass, offset: p.offset, side: p.side, travel: p.travel, duration: p.duration
  };
}

function assistTitle(p) {
  return 'assist ' + p.number + ' at ' + p.name;
}

function rate(value) {
  return (value * 100).toFixed(2);
}

function motionName(velocity) {
  return velocity < 0 ? 'toward the probe' : velocity > 0 ? 'with the probe' : 'standing still';
}

function assistState(p) {
  return { travel: p.travel, view: 'room', guess: '', fired: false, time: 0, watched: false, halfway: false };
}

function assistOrbit(p, travel) {
  const velocity = p.speed * 0.3 * travel / 100;
  const relative = p.speed - velocity;
  const a = p.mass / (relative * relative);
  const k = p.offset / a;
  const e = Math.hypot(1, k);
  const clock = Math.sqrt(a * a * a / p.mass);
  const limit = Math.acosh((1.35 / a + 1) / e);
  const halfTime = clock * (e * Math.sinh(limit) - limit);
  const points = [];

  // Inbound velocity is horizontal. Rotating its far-away relative velocity by the
  // hyperbola's deflection preserves its magnitude; adding the well's velocity need not.
  const turn = 2 * Math.atan(1 / k);
  const outX = velocity + relative * Math.cos(turn);
  const outY = -p.side * relative * Math.sin(turn);
  for (let i = 0; i <= 240; i++) {
    const time = (i / 240 * 2 - 1) * halfTime;
    let low = -limit;
    let high = limit;
    for (let iteration = 0; iteration < 28; iteration++) {
      const middle = (low + high) / 2;
      const at = clock * (e * Math.sinh(middle) - middle);
      if (at < time) low = middle;
      else high = middle;
    }
    const H = (low + high) / 2;
    const sh = Math.sinh(H);
    const ch = Math.cosh(H);
    const rx = a * (e - ch + k * k * sh) / e;
    const ry = p.side * a * k * (e - ch - sh) / e;
    const timeSlope = clock * (e * ch - 1);
    const ux = a * (-sh + k * k * ch) / e / timeSlope;
    const uy = -p.side * a * k * (sh + ch) / e / timeSlope;
    points.push({ rx, ry, x: rx + velocity * time, y: ry, well: velocity * time, ux, uy });
  }
  return { points, velocity, relative, speedOut: Math.hypot(outX, outY) };
}

function assistMap(w, h, orbit, view) {
  let left = Infinity;
  let right = -Infinity;
  let top = 0;
  let bottom = 0;
  for (const p of orbit.points) {
    const x = view === 'well' ? p.rx : p.x;
    const well = view === 'well' ? 0 : p.well;
    left = Math.min(left, x, well);
    right = Math.max(right, x, well);
    top = Math.min(top, p.ry);
    bottom = Math.max(bottom, p.ry);
  }
  const scale = Math.min(w * 0.88 / (right - left + 0.18), h * 0.59 / (bottom - top + 0.18));
  return {
    scale,
    at(x, y) {
      return { x: w / 2 + (x - (left + right) / 2) * scale,
        y: h * 0.435 + (y - (top + bottom) / 2) * scale };
    }
  };
}

function arrow(g, env, at, dx, dy, length, color) {
  const magnitude = Math.hypot(dx, dy);
  if (!magnitude) return;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const end = { x: at.x + ux * length, y: at.y + uy * length };
  const head = Math.max(3, length * 0.22);
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(at.x, at.y);
  g.lineTo(end.x, end.y);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(end.x, end.y);
  g.lineTo(end.x - ux * head - uy * head * 0.55, end.y - uy * head + ux * head * 0.55);
  g.lineTo(end.x - ux * head + uy * head * 0.55, end.y - uy * head - ux * head * 0.55);
  g.closePath();
  g.fill();
}

function assistScene(g, w, h, env, p, state, orbit, variant) {
  const v = variant || PLAIN;
  const col = env.colors;
  const m = Math.min(w, h);
  const map = assistMap(w, h, orbit, state.view);
  const fraction = state.watched ? 1 : state.fired ? Math.min(1, state.time / p.duration) : 0;
  const index = Math.min(orbit.points.length - 1, Math.round(fraction * (orbit.points.length - 1)));
  const until = state.fired ? index + 1 : Math.round(orbit.points.length * 0.13);
  const location = (point) => map.at(state.view === 'well' ? point.rx : point.x, point.ry);
  g.save();
  background(g, w, h, env, v);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (state.view === 'room' && orbit.velocity !== 0) {
    const start = map.at(orbit.points[0].well, 0);
    const finish = map.at(orbit.points[orbit.points.length - 1].well, 0);
    g.strokeStyle = env.alpha(col.accent, 0.42);
    g.lineWidth = 1;
    g.setLineDash([3, 6]);
    g.beginPath();
    g.moveTo(start.x, start.y);
    g.lineTo(finish.x, finish.y);
    g.stroke();
    g.setLineDash([]);
  }

  g.strokeStyle = env.alpha(col.accent2, state.fired ? 0.85 : 0.4);
  g.lineWidth = Math.max(1.4, m * 0.006 * v.scale);
  g.beginPath();
  for (let i = 0; i < until; i++) {
    const at = location(orbit.points[i]);
    if (i) g.lineTo(at.x, at.y);
    else g.moveTo(at.x, at.y);
  }
  g.stroke();
  const spacing = Math.max(3, Math.round(12 / v.density));
  g.fillStyle = env.alpha(col.accent2, 0.55);
  for (let i = 0; i < until; i += spacing) {
    const at = location(orbit.points[i]);
    g.beginPath();
    g.arc(at.x, at.y, Math.max(1, m * 0.004 * v.scale), 0, Math.PI * 2);
    g.fill();
  }

  const current = orbit.points[index];
  const well = map.at(state.view === 'well' ? 0 : current.well, 0);
  wellAt(g, env, well.x, well.y, Math.max(2, map.scale * 0.016 * v.scale));
  if (state.view === 'room' && orbit.velocity !== 0) {
    arrow(g, env, well, orbit.velocity, 0, m * 0.095, col.accent);
  }
  const probe = location(current);
  arrow(g, env, probe, current.ux + (state.view === 'room' ? orbit.velocity : 0),
    current.uy, m * 0.075 * v.scale, col.accent2);
  g.fillStyle = env.alpha(col.accent2, 0.24);
  g.beginPath();
  g.arc(probe.x, probe.y, Math.max(6, m * 0.025 * v.scale), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = col.fg;
  g.beginPath();
  g.arc(probe.x, probe.y, Math.max(2, m * 0.008 * v.scale), 0, Math.PI * 2);
  g.fill();

  const size = Math.max(10, Math.min(18, Math.round(m * 0.043)));
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = col.fg;
  g.fillText(state.view === 'well' ? 'travelling with the well' : 'watching from the room', w * 0.05, h * 0.065, w * 0.9);
  g.fillStyle = col.accent;
  g.fillText('well: ' + motionName(orbit.velocity), w * 0.05, h * 0.13, w * 0.9);
  g.fillStyle = env.alpha(col.bg, 0.88);
  g.fillRect(0, h * 0.79, w, h * 0.21);
  g.fillStyle = col.fg;
  const after = state.watched ? rate(orbit.speedOut) : '?';
  g.fillText('room, far before / after: ' + rate(p.speed) + ' / ' + after,
    w * 0.05, h * 0.85, w * 0.9);
  g.fillStyle = col.accent2;
  g.fillText('well, far before / after: ' + rate(orbit.relative) + ' / '
    + (state.watched ? rate(orbit.relative) : '?'), w * 0.05, h * 0.935, w * 0.9);
  g.restore();
}

function assistPreview(g, w, h, env, p) {
  const state = assistState(p);
  assistScene(g, w, h, env, p, state, assistOrbit(p, state.travel), env.variant);
}

function assistFinding(p, state, orbit) {
  const difference = orbit.speedOut - p.speed;
  const result = Math.abs(difference) < 1e-9 ? 'same' : difference > 0 ? 'faster' : 'slower';
  const prediction = ASSIST_GUESSES.find((guess) => guess.value === state.guess);
  const change = result === 'same' ? 'the same speed' : result;
  return 'Far from ' + p.name + ', the probe enters at ' + rate(p.speed)
    + ' and leaves at ' + rate(orbit.speedOut) + ' marks a second in the room: ' + change + '. '
    + (state.guess === result ? 'You called it. ' : 'You predicted it ' + (prediction ? prediction.label : 'would leave differently') + '. ')
    + 'Travelling with the well, it enters and leaves at ' + rate(orbit.relative) + ' marks a second. '
    + (result === 'same' ? 'A still well turns the path without changing its far-away speed. Move the next well to see it trade speed.'
      : 'The moving well trades energy with the probe. Change the direction of the next well to reverse the trade.')
    + ' The probe never fired its engine.';
}

function assistPiece(env, carriedPlan) {
  const p = carriedPlan || assistPlan(env);
  const state = assistState(p);
  let orbit = assistOrbit(p, state.travel);
  const draw = (c) => assistScene(c.g, c.w, c.h, c, p, state, orbit, env.variant);
  return {
    title: assistTitle(p),
    brief: ASSIST_BRIEF,
    aspect: '16 / 10',
    steps: [
      { id: 'motion', ask: 'how the well moves; the middle holds it still', kind: 'range', min: -100, max: 100, step: 5, value: p.travel, low: 'toward', high: 'with it' },
      { id: 'view', ask: 'where to watch the same flight from', kind: 'choice', options: ASSIST_VIEWS },
      { id: 'guess', ask: 'far away in the room, will the probe be faster?', kind: 'choice', options: ASSIST_GUESSES },
      { id: 'release', ask: 'release the probe, with its engine off', kind: 'press', count: 1, label: 'release probe' },
      { id: 'watch', ask: 'watch the flyby', kind: 'wait', after: 'release' }
    ],
    start(c) {
      c.status('The probe starts at ' + rate(p.speed) + ' marks a second in the room. Its approach passes '
        + (p.offset * 100).toFixed(1) + ' marks ' + (p.side === 1 ? 'below' : 'above')
        + ' the well\'s line. The gold arrow is the probe; the blue arrow is the well. Set motion, viewpoint and prediction, then release.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'motion') {
        const travel = Number(value);
        if (!Number.isFinite(travel)) {
          c.status('Set the well\'s motion between the two ends; the middle holds it still.');
          return;
        }
        state.travel = Math.max(-100, Math.min(100, travel));
        orbit = assistOrbit(p, state.travel);
        if (state.fired && !state.watched) {
          state.time = 0;
          state.halfway = false;
          c.progress('watch', 0);
        }
        c.status('The well is ' + motionName(orbit.velocity)
          + (orbit.velocity ? ' at ' + rate(Math.abs(orbit.velocity)) + ' marks a second' : '')
          + '. The probe still starts at ' + rate(p.speed) + ' in the room.'
          + (state.watched ? ' The finished path and both readouts now show this setting.'
            : state.fired ? ' The flight starts again with this motion.' : ' Release it to see the trade.'));
      }
      if (id === 'view') {
        if (!ASSIST_VIEWS.some((view) => view.value === value)) {
          c.status('Choose the room or the travelling well as your viewpoint.');
          return;
        }
        state.view = value;
        c.status(value === 'well'
          ? 'Travelling with the well, it stands still in the picture. This is the same flight; the room\'s before-and-after speeds remain below it.'
          : 'From the room, the well can move as the probe passes. This is the same flight, seen from the other place.');
      }
      if (id === 'guess') {
        const prediction = ASSIST_GUESSES.find((guess) => guess.value === value);
        if (!prediction) {
          c.status('Predict faster, slower, or the same far-away speed in the room.');
          return;
        }
        state.guess = value;
        c.status('You predict the probe ' + prediction.label + ' in the room. Any prediction works.');
      }
      if (id === 'release') {
        if (state.fired) {
          c.status('This probe is already released. You can still change the motion and viewpoint while a choice waits.');
          return;
        }
        state.fired = true;
        state.time = 0;
        c.status(c.reduced ? 'The flyby will appear without movement.'
          : 'Engine off. The probe and the well are moving; you can switch viewpoints during the flight.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (state.fired && !state.watched) {
        state.time = c.reduced ? p.duration : Math.min(p.duration, state.time + Math.max(0, dt));
        c.progress('watch', state.time / p.duration);
        if (!state.halfway && state.time >= p.duration / 2 && state.time < p.duration) {
          state.halfway = true;
          c.status('The probe is rounding the well, without firing its engine. Both viewpoints follow this one flight.');
        }
        if (state.time >= p.duration) {
          state.watched = true;
          c.satisfy('watch');
          if (!c.done) c.status('The flyby is over. Room speeds: ' + rate(p.speed) + ' before, '
            + rate(orbit.speedOut) + ' after. With the well: ' + rate(orbit.relative)
            + ' before and after. Any choices still waiting can change the view or the finding.');
        }
      }
      draw(c);
    },
    end(c) {
      state.fired = true;
      state.watched = true;
      state.time = p.duration;
      c.status(assistFinding(p, state, orbit));
      draw(c);
    }
  };
}

export default {
  id: 'gravity-well',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsAssist(env)) assistPreview(g, w, h, env, assistPlan(env));
    else preview(g, w, h, env, plan(env));
  },
  spark(env) {
    if (dealsAssist(env)) {
      const p = assistPlan(env);
      const velocity = p.speed * 0.3 * p.travel / 100;
      return {
        title: assistTitle(p),
        text: ASSIST_BRIEF,
        mono: 'well: ' + motionName(velocity) + '\nprobe: ' + rate(p.speed)
          + ' marks a second\napproach offset: ' + (p.offset * 100).toFixed(1) + ' marks',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => assistPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = plan(env);
    return {
      title: title(p),
      text: p.family === 'pair'
        ? 'Two probes leave almost together. Choose which well pulls harder and see whether their paths part.'
        : 'One probe, one well. Aim, predict whether it strikes, escapes or stays, and watch the bend.',
      aspect: '16 / 10',
      paint: (g, w, h, e) => preview(g, w, h, e, p),
      of: p
    };
  },
  piece(env) {
    const assist = carriedAssist(env);
    if (assist) return assistPiece(env, assist);
    const flight = carried(env);
    if (flight) return launchPiece(env, flight);
    return dealsAssist(env) ? assistPiece(env) : launchPiece(env);
  }
};
