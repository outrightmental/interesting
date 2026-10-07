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
const DURATION = 4.5;

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
  return plan(env);
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

function draw(g, w, h, env, p, state, routes, fraction, finished) {
  const col = env.colors;
  const v = env.variant || { density: 1, scale: 1, turn: 0 };
  const size = Math.min(w, h);
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

  for (const well of bodies(p, state.balance)) {
    const at = point(w, h, well.x, well.y);
    const radius = size * 0.05 * v.scale;
    const halo = g.createRadialGradient(at.x, at.y, radius * 0.3, at.x, at.y, radius * 5);
    halo.addColorStop(0, env.alpha(col.accent2, 0.34));
    halo.addColorStop(1, env.alpha(col.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(at.x - radius * 5, at.y - radius * 5, radius * 10, radius * 10);
    g.strokeStyle = env.alpha(col.accent, 0.3);
    g.lineWidth = 1;
    g.setLineDash([Math.max(2, size * 0.008), Math.max(4, size * 0.018)]);
    for (const ring of [2.2, 3.7]) {
      g.beginPath();
      g.arc(at.x, at.y, radius * ring, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    const surface = g.createRadialGradient(at.x - radius * 0.3, at.y - radius * 0.4, 0, at.x, at.y, radius);
    surface.addColorStop(0, col.fg);
    surface.addColorStop(0.22, col.accent2);
    surface.addColorStop(1, col.bg2);
    g.fillStyle = surface;
    g.beginPath();
    g.arc(at.x, at.y, radius, 0, Math.PI * 2);
    g.fill();
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

function piece(env) {
  const p = carried(env);
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

export default {
  id: 'gravity-well',
  needsSky: false,
  paint(g, w, h, env) {
    preview(g, w, h, env, plan(env));
  },
  spark(env) {
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
  piece
};
