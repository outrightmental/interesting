const SLITS = [
  { label: 'both slits open', value: 'two' },
  { label: 'cover one slit', value: 'one' }
];
const GUESSES = [
  { label: 'bright and dark lanes', value: 'lanes' },
  { label: 'one broad patch', value: 'patch' },
  { label: 'marks scattered evenly', value: 'even' }
];
const PLAIN = { density: 1, scale: 1, turn: 0 };

function plan(env) {
  return {
    family: 'light-table',
    number: env.int(101, 999),
    wavelength: env.int(430, 680),
    gap: env.int(28, 72)
  };
}

function carried(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'light-table'
      || !Number.isInteger(p.number) || p.number < 101 || p.number > 999
      || !Number.isInteger(p.wavelength) || p.wavelength < 430 || p.wavelength > 680
      || !Number.isInteger(p.gap) || p.gap < 28 || p.gap > 72) return null;
  return p;
}

function title(p) {
  return 'lamp ' + p.number + ': ' + p.wavelength + ' nm';
}

function setup(env) {
  const subject = plan(env);
  const marks = Array.from({ length: 480 }, () => ({
    u: env.rnd(), x: env.rnd(), jitter: env.rnd()
  }));
  return { subject, marks };
}

function profile(p, state, variant) {
  const values = [];
  const cumulative = [];
  const spread = 0.44 + (p.wavelength - 430) / 250 * 0.14;
  const lanes = (2.6 + (state.gap - 28) / 44 * 2.4)
    * 550 / p.wavelength * variant.scale;
  let total = 0;
  for (let i = 0; i < 160; i++) {
    const z = (i + 0.5) / 80 - 1;
    const envelope = Math.exp(-2.4 * (z / spread) ** 2);
    const interference = state.slits === 'one' ? 1
      : 0.02 + 0.98 * Math.cos(Math.PI * lanes * z) ** 2;
    const value = envelope * interference;
    values.push(value);
    total += value;
    cumulative.push(total);
  }
  return { values, cumulative, total };
}

function binFor(cumulative, target) {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function scene(g, w, h, env, p, state, marks) {
  const c = env.colors;
  const v = env.variant || PLAIN;
  const maskX = w * 0.38;
  const screenX = w * 0.69;
  const screenW = w * 0.23;
  const screenTop = h * 0.11;
  const screenH = h * 0.78;
  const middle = h * 0.5;
  const sourceX = w * (0.13 + (v.turn - 0.5) * 0.035);
  const distribution = profile(p, state, v);
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, c.bg2);
  ground.addColorStop(1, c.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);

  g.fillStyle = env.mix(c.bg, c.bg2, 0.55);
  g.fillRect(screenX, screenTop, screenW, screenH);
  const rowH = screenH / distribution.values.length;
  for (let i = 0; i < distribution.values.length; i++) {
    const strength = state.preview ? 0.16 : state.finished ? 0.27
      : state.shown > 0 ? 0.10 : 0.025;
    g.fillStyle = env.alpha(c.accent, 0.02 + distribution.values[i] * strength);
    g.fillRect(screenX, screenTop + i * rowH, screenW, rowH + 0.5);
  }
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.5;
  g.strokeRect(screenX, screenTop, screenW, screenH);

  const visible = Math.min(marks.length, Math.floor(state.shown));
  const dot = Math.max(1.2, Math.min(w, h) * 0.005 * v.scale);
  g.fillStyle = c.accent2;
  for (let i = 0; i < visible; i++) {
    const mark = marks[i];
    const bin = binFor(distribution.cumulative, mark.u * distribution.total);
    const x = screenX + screenW * (0.08 + mark.x * 0.84);
    const y = screenTop + (bin + mark.jitter) * rowH;
    g.fillRect(x, y, dot, dot);
  }

  const offset = state.gap * h * 0.00125;
  const openings = state.slits === 'one' ? [middle] : [middle - offset, middle + offset];
  const ringStep = Math.max(12, Math.min(w, h) * 0.075 / v.scale);
  for (const y of openings) {
    g.strokeStyle = env.alpha(c.accent2, 0.30);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sourceX, middle);
    g.lineTo(maskX, y);
    g.stroke();
    for (let radius = ringStep; radius < screenX - maskX; radius += ringStep) {
      g.strokeStyle = env.alpha(c.accent, 0.10 + 0.06 * (1 - radius / (screenX - maskX)));
      g.beginPath();
      g.arc(maskX, y, radius, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
  }
  const openingH = Math.max(3, h * 0.025);
  let top = 0;
  g.fillStyle = c.accent2;
  for (const y of openings) {
    g.fillRect(maskX - 2, top, 4, y - openingH / 2 - top);
    top = y + openingH / 2;
  }
  g.fillRect(maskX - 2, top, 4, h - top);
  const glow = g.createRadialGradient(sourceX, middle, 0, sourceX, middle, Math.min(w, h) * 0.12);
  glow.addColorStop(0, env.alpha(c.accent2, 0.65));
  glow.addColorStop(1, env.alpha(c.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(sourceX - w * 0.1, middle - h * 0.12, w * 0.2, h * 0.24);
  g.fillStyle = c.fg;
  g.beginPath();
  g.arc(sourceX, middle, Math.max(2, Math.min(w, h) * 0.01), 0, Math.PI * 2);
  g.fill();
}

function piece(env) {
  const made = setup(env);
  const p = carried(env) || made.subject;
  const v = env.variant || PLAIN;
  const perBurst = Math.round(110 * v.density);
  const state = {
    slits: 'two', gap: p.gap, guess: '', shown: 0, target: 0,
    preview: false, finished: false, developed: false
  };
  const draw = (c) => scene(c.g, c.w, c.h, env, p, state, made.marks);
  return {
    title: title(p),
    brief: 'This lamp sends light through a narrow screen. Choose one or two slits, move the openings, predict the pattern, then send three bursts and watch individual marks become a picture.',
    aspect: '4 / 3',
    steps: [
      { id: 'slits', ask: 'which openings let light through?', kind: 'choice', options: SLITS },
      { id: 'gap', ask: 'the space between the openings', kind: 'range', min: 28, max: 72, step: 1, value: p.gap, low: 'close', high: 'far apart' },
      { id: 'guess', ask: 'what will gather on the detector?', kind: 'choice', options: GUESSES },
      { id: 'expose', ask: 'send three bursts of light', kind: 'press', count: 3, label: 'send a burst' },
      { id: 'develop', ask: 'watch the last marks land', kind: 'wait', after: 'expose' }
    ],
    start(c) {
      c.status('The ' + p.wavelength + ' nm lamp is ready. Choose the openings, then send three bursts.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'slits') {
        state.slits = value === 'one' ? 'one' : 'two';
        c.status(state.slits === 'one' ? 'One opening is covered.' : 'Both openings let light through.');
      }
      if (id === 'gap') {
        state.gap = Math.max(28, Math.min(72, Math.round(Number(value))));
        c.status('The openings have moved. The detector follows the new arrangement.');
      }
      if (id === 'guess') {
        state.guess = String(value);
        c.status('Prediction placed. Send a burst to see the marks arrive.');
      }
      if (id === 'expose') {
        state.target = Math.min(3, Number(value)) * perBurst;
        c.status('Burst ' + value + ' of 3: marks are arriving on the detector.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (state.shown < state.target) {
        state.shown = c.reduced ? state.target
          : Math.min(state.target, state.shown + Math.max(0, dt) * 240);
      }
      if (state.target === perBurst * 3 && !state.developed) {
        c.progress('develop', state.shown / state.target);
        if (state.shown >= state.target) {
          state.developed = true;
          c.satisfy('develop');
          if (!c.done) c.status('All three bursts have landed. Set any choices still waiting.');
        }
      }
      draw(c);
    },
    end(c) {
      state.finished = true;
      state.shown = state.target;
      draw(c);
      const result = state.slits === 'two' ? 'lanes' : 'patch';
      const finding = state.slits === 'two'
        ? 'Two openings made bright and dark lanes, though each mark landed alone. A wider gap brings the lanes closer together.'
        : 'With one opening covered, the dark lanes vanished: the marks gathered in a broad patch.';
      const predicted = GUESSES.find((guess) => guess.value === state.guess);
      c.status(finding + ' ' + (state.guess === result ? 'You called it.'
        : 'You predicted ' + (predicted ? predicted.label : 'another pattern') + '.'));
    }
  };
}

export default {
  id: 'light-table',
  needsSky: false,
  paint(g, w, h, env) {
    const made = setup(env);
    scene(g, w, h, env, made.subject,
      { slits: 'two', gap: made.subject.gap, shown: 0, preview: true, finished: false }, made.marks);
  },
  spark(env) {
    const p = plan(env);
    return {
      title: title(p),
      text: 'One lamp, two narrow openings and a magnified detector. Cover an opening, predict what will gather, then send the light through.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => {
        const made = setup(cardEnv);
        scene(g, w, h, cardEnv, p,
          { slits: 'two', gap: p.gap, shown: 0, preview: true, finished: false }, made.marks);
      },
      of: p
    };
  },
  piece
};
