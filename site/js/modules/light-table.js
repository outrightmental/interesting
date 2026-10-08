/* Light through slits, crossed polarizing filters, or a pinhole camera. Each shape carries
   its subject from card to piece; a carried subject takes precedence over the seed's choice. */

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

function background(g, w, h, env) {
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
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
  background(g, w, h, env);

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

function slitPiece(env) {
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

const FILTER_PLACES = [
  { label: 'set it aside', value: 'aside' },
  { label: 'before both', value: 'before' },
  { label: 'between them', value: 'between' },
  { label: 'after both', value: 'after' }
];
const FILTER_BRIEF = 'Two crossed filters stop the light. Move a third filter, turn it, and compare all four placements to find out whether another barrier can brighten the screen.';

function dealsFilters(env) {
  return (env.seed >>> 0) % 3 === 2;
}

function filterPlan(env) {
  return {
    family: 'crossed-filters',
    number: env.int(101, 999),
    axis: env.int(0, 11) * 15,
    turn: env.pick([20, 30, 40, 50, 60, 70])
  };
}

function carriedFilters(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'crossed-filters'
      || !Number.isInteger(p.number) || p.number < 101 || p.number > 999
      || !Number.isInteger(p.axis) || p.axis < 0 || p.axis > 165 || p.axis % 15 !== 0
      || !Number.isInteger(p.turn) || p.turn < 0 || p.turn > 90) return null;
  return { family: p.family, number: p.number, axis: p.axis, turn: p.turn };
}

function filterTitle(p) {
  return 'filter set ' + p.number + ': the bright barrier';
}

function filterState(p) {
  return { place: 'aside', turn: p.turn, comparing: false, compared: false, phase: 0 };
}

// Unpolarized light loses half at the first ideal polarizer. Each subsequent one passes
// cos(angle difference)^2. In the middle this is 0.5*cos(turn)^2*sin(turn)^2, at most 1/8.
function filterTrain(turn, place) {
  const plates = [
    { id: 'first', x: 0.34, axis: 0 },
    { id: 'second', x: 0.66, axis: 90 }
  ];
  if (place !== 'aside') {
    const x = { before: 0.18, between: 0.5, after: 0.82 }[place];
    plates.push({ id: 'loose', x, axis: turn });
  }
  plates.sort((a, b) => a.x - b.x);
  let light = 1;
  let previous = null;
  for (const plate of plates) {
    light *= previous === null ? 0.5 : Math.cos((plate.axis - previous) * Math.PI / 180) ** 2;
    if (light < 1e-10) light = 0;
    plate.light = light;
    previous = plate.axis;
  }
  return { plates, light };
}

function percent(light) {
  if (light > 0 && light < 0.001) return (light * 100).toFixed(2) + '%';
  return Math.round(light * 1000) / 10 + '%';
}

function filterReading(s) {
  const where = s.place === 'aside' ? 'set aside' : s.place + ' the crossed pair';
  return 'Loose filter ' + where + ', turned ' + s.turn + ' degrees from the first. '
    + percent(filterTrain(s.turn, s.place).light) + ' of the incoming light reaches the screen.';
}

function comparisonReading(turn) {
  return 'At ' + turn + ' degrees: ' + FILTER_PLACES.map((place) =>
    place.value + ' ' + percent(filterTrain(turn, place.value).light)).join('; ') + '.';
}

function filterBeam(g, x1, x2, y, h, light, env, variant) {
  if (light === 0) {
    g.strokeStyle = env.alpha(env.colors.muted, 0.45);
    g.lineWidth = 1;
    g.setLineDash([3, 5]);
    g.beginPath();
    g.moveTo(x1, y);
    g.lineTo(x2, y);
    g.stroke();
    g.setLineDash([]);
    return;
  }
  const band = h * 0.048 * variant.scale;
  g.fillStyle = env.alpha(env.colors.accent2, 0.03 + light * 0.14);
  g.fillRect(x1, y - band / 2, x2 - x1, band);
  const rays = Math.max(3, Math.round(5 * variant.density));
  g.strokeStyle = env.alpha(env.colors.accent2, 0.12 + Math.sqrt(light) * 0.78);
  g.lineWidth = Math.max(0.7, Math.min(2, h * 0.006));
  g.beginPath();
  for (let i = 0; i < rays; i++) {
    const at = y + (i / (rays - 1) - 0.5) * band;
    g.moveTo(x1, at);
    g.lineTo(x2, at);
  }
  g.stroke();
}

function filterPlate(g, x, y, radius, axis, loose, env, variant) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.fillStyle = env.mix(c.bg, c.bg2, 0.7);
  g.fill();
  g.save();
  g.clip();
  g.rotate(axis * Math.PI / 180);
  g.strokeStyle = loose ? c.accent2 : c.accent;
  g.lineWidth = Math.max(1, radius * 0.055);
  const lines = Math.max(4, Math.round(7 * variant.density));
  g.beginPath();
  for (let i = 0; i <= lines; i++) {
    const at = (i / lines * 2 - 1) * radius;
    g.moveTo(at, -radius);
    g.lineTo(at, radius);
  }
  g.stroke();
  g.restore();
  g.strokeStyle = c.fg;
  g.lineWidth = Math.max(1, radius * 0.055);
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.stroke();
  if (loose) {
    g.strokeStyle = c.accent2;
    g.beginPath();
    g.arc(0, 0, radius * 1.13, 0, Math.PI * 2);
    g.moveTo(0, -radius * 1.13);
    g.lineTo(0, -radius * 1.35);
    g.stroke();
  }
  g.restore();
}

function filterScreen(g, x, y, w, h, light, env) {
  const c = env.colors;
  g.fillStyle = light > 0 ? env.mix(c.bg, c.accent2, Math.min(1, Math.sqrt(light) * 1.8)) : c.bg;
  g.fillRect(x, y, w, h);
  g.strokeStyle = c.muted;
  g.lineWidth = 1;
  g.strokeRect(x, y, w, h);
  if (light === 0) {
    g.strokeStyle = env.alpha(c.fg, 0.6);
    g.beginPath();
    g.moveTo(x + w * 0.25, y + h * 0.25);
    g.lineTo(x + w * 0.75, y + h * 0.75);
    g.moveTo(x + w * 0.75, y + h * 0.25);
    g.lineTo(x + w * 0.25, y + h * 0.75);
    g.stroke();
  }
}

function filterScene(g, w, h, env, p, s) {
  const c = env.colors;
  const v = env.variant || PLAIN;
  const train = filterTrain(s.turn, s.place);
  const y = h * 0.3;
  const radius = Math.min(w * 0.051, h * 0.095) * v.scale;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.038)));
  const axis = p.axis + v.turn * 180;
  g.save();
  background(g, w, h, env);
  let from = w * 0.045;
  let light = 1;
  for (const plate of train.plates) {
    filterBeam(g, from, plate.x * w, y, h, light, env, v);
    from = plate.x * w;
    light = plate.light;
  }
  filterBeam(g, from, w * 0.93, y, h, light, env, v);
  g.fillStyle = c.fg;
  g.beginPath();
  g.arc(w * 0.045, y, Math.max(2, radius * 0.22), 0, Math.PI * 2);
  g.fill();
  filterScreen(g, w * 0.93, y - h * 0.13, w * 0.025, h * 0.26, train.light, env);

  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = c.fg;
  g.textAlign = 'left';
  g.fillText('in: 100%', w * 0.04, h * 0.075);
  g.textAlign = 'right';
  g.fillText('screen: ' + percent(train.light), w * 0.96, h * 0.075);
  g.textAlign = 'center';
  for (const plate of train.plates) {
    filterPlate(g, plate.x * w, y, radius, axis + plate.axis, plate.id === 'loose', env, v);
    g.fillStyle = c.fg;
    g.fillText(plate.id, plate.x * w, y + radius + size * 1.25);
  }
  if (s.place === 'aside') {
    const spareY = h * 0.54;
    filterPlate(g, w * 0.5, spareY, radius, axis + s.turn, true, env, v);
    g.fillStyle = c.fg;
    g.fillText('loose: ' + s.turn + ' degrees', w * 0.5, spareY + radius + size * 1.25);
  } else {
    g.fillStyle = c.fg;
    g.fillText('loose: ' + s.turn + ' degrees from the first', w * 0.5, h * 0.62);
  }

  if (s.comparing) {
    const read = Math.floor(s.phase * FILTER_PLACES.length);
    FILTER_PLACES.forEach((place, i) => {
      const x = w * (0.06 + (i + 0.5) * 0.22);
      g.fillStyle = c.fg;
      g.fillText(place.value, x, h * 0.77);
      if (i < read) {
        const result = filterTrain(s.turn, place.value).light;
        filterScreen(g, x - w * 0.06, h * 0.81, w * 0.12, h * 0.06, result, env);
        g.fillStyle = c.fg;
        g.fillText(percent(result), x, h * 0.925);
      } else {
        g.fillStyle = c.muted;
        g.fillText('not read', x, h * 0.925);
      }
      if (place.value === s.place) {
        g.strokeStyle = c.accent2;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - w * 0.065, h * 0.975);
        g.lineTo(x + w * 0.065, h * 0.975);
        g.stroke();
      }
    });
  }
  g.restore();
}

function filterPreview(g, w, h, env, p) {
  filterScene(g, w, h, env, p, filterState(p));
}

function filterPiece(env, carriedPlan) {
  const p = carriedPlan || filterPlan(env);
  const s = filterState(p);
  const draw = (c) => filterScene(c.g, c.w, c.h, env, p, s);
  return {
    title: filterTitle(p),
    brief: FILTER_BRIEF,
    aspect: '4 / 3',
    steps: [
      { id: 'place', ask: 'where the loose filter goes', kind: 'choice', options: FILTER_PLACES },
      { id: 'turn', ask: 'turn the loose filter relative to the first', kind: 'range', min: 0, max: 90, step: 1, value: p.turn, low: '0 degrees', high: '90 degrees' },
      { id: 'compare', ask: 'compare all four placements', kind: 'press', count: 1, label: 'compare all four' },
      { id: 'read', ask: 'watch the four screens appear', kind: 'wait', after: 'compare' }
    ],
    start(c) {
      c.status('The fixed filters have lines at right angles. The double-rimmed one is yours to move. ' + filterReading(s));
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'place') {
        if (!FILTER_PLACES.some((place) => place.value === value)) {
          c.status('Choose one of the four places for the loose filter.');
          return;
        }
        s.place = value;
        c.status(filterReading(s));
      }
      if (id === 'turn') {
        const turn = Number(value);
        if (!Number.isFinite(turn)) {
          c.status('Set the loose filter between 0 and 90 degrees.');
          return;
        }
        s.turn = Math.max(0, Math.min(90, Math.round(turn)));
        c.status(filterReading(s) + (s.compared ? ' ' + comparisonReading(s.turn) : ''));
      }
      if (id === 'compare') {
        s.comparing = true;
        c.status(s.compared ? comparisonReading(s.turn) : 'Comparing the light in all four placements.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.comparing && !s.compared) {
        s.phase = c.reduced ? 1 : Math.min(1, s.phase + Math.max(0, dt) / 2.4);
        c.progress('read', s.phase);
        if (s.phase >= 1) {
          s.compared = true;
          c.status(comparisonReading(s.turn) + ' The screens follow any settings you still change.');
          c.satisfy('read');
        }
      }
      draw(c);
    },
    end(c) {
      s.comparing = true;
      s.compared = true;
      s.phase = 1;
      const middle = filterTrain(s.turn, 'between').light;
      c.status(filterReading(s) + ' ' + comparisonReading(s.turn) + ' '
        + (middle > 0 ? 'Only the middle placement passes light at this turn. '
          : 'This turn leaves all four screens dark. ')
        + 'Each filter passes light along its own lines. In the gap, the extra filter gives some light a direction the last filter can pass. At 45 degrees, 12.5% of the incoming light gets through; at 0 or 90 degrees, none does. Before or after the pair, the crossed filters still block it.');
      draw(c);
    }
  };
}

const CAMERA_SUBJECTS = ['arrow', 'candle', 'house'];
const CAMERA_GUESSES = [
  { label: 'upright', value: 'upright' },
  { label: 'upside down', value: 'inverted' },
  { label: 'sideways', value: 'sideways' }
];

function dealsCamera(env) {
  return (env.seed >>> 0) % 3 === 1;
}

function cameraPlan(env) {
  return {
    family: 'pinhole-camera', number: env.int(101, 999),
    subject: env.pick(CAMERA_SUBJECTS), aperture: env.int(4, 18),
    distance: env.int(42, 78), hole: env.int(44, 56) / 100
  };
}

function carriedCamera(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'pinhole-camera'
      || !Number.isInteger(p.number) || p.number < 101 || p.number > 999
      || !CAMERA_SUBJECTS.includes(p.subject)
      || !Number.isInteger(p.aperture) || p.aperture < 2 || p.aperture > 24
      || !Number.isInteger(p.distance) || p.distance < 35 || p.distance > 90
      || typeof p.hole !== 'number' || !Number.isFinite(p.hole)
      || p.hole < 0.43 || p.hole > 0.57) return null;
  return { family: p.family, number: p.number, subject: p.subject,
    aperture: p.aperture, distance: p.distance, hole: p.hole };
}

function cameraTitle(p) {
  return 'camera ' + p.number + ': the ' + p.subject;
}

function cameraShape(g, env, subject, x, y, size, inverted, opacity) {
  if (opacity <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(inverted ? -size : size, inverted ? -size : size);
  g.fillStyle = env.alpha(env.colors.accent2, opacity);
  if (subject === 'arrow') {
    g.fillRect(-0.2, -0.15, 0.4, 1.05);
    g.beginPath();
    g.moveTo(-0.86, -0.1);
    g.lineTo(0, -0.98);
    g.lineTo(0.86, -0.1);
    g.closePath();
    g.fill();
  } else if (subject === 'candle') {
    g.fillRect(-0.28, -0.15, 0.56, 1.05);
    g.fillStyle = env.alpha(env.colors.fg, opacity);
    g.beginPath();
    g.ellipse(0, -0.65, 0.24, 0.33, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillRect(-0.66, -0.1, 1.32, 1);
    g.beginPath();
    g.moveTo(-0.9, -0.08);
    g.lineTo(0, -0.95);
    g.lineTo(0.9, -0.08);
    g.closePath();
    g.fill();
    g.fillStyle = env.alpha(env.colors.bg, opacity);
    g.fillRect(-0.17, 0.37, 0.34, 0.53);
  }
  g.restore();
}

function cameraScene(g, w, h, env, p, s) {
  const col = env.colors;
  const v = env.variant || PLAIN;
  const sourceX = w * 0.15;
  const sourceY = h * 0.49;
  const holeX = w * 0.43;
  const holeY = h * s.hole;
  const screenX = w * (0.68 + (s.distance - 35) / 55 * 0.09);
  const screenW = w * 0.96 - screenX;
  const screenMiddle = screenX + screenW / 2;
  const zoom = (screenMiddle - holeX) / (holeX - sourceX);
  const imageY = holeY + (holeY - sourceY) * zoom;
  const size = Math.min(w * 0.055, h * 0.09) * v.scale;
  const screenTop = h * 0.13;
  const screenH = h * 0.74;
  g.save();
  background(g, w, h, env);
  g.fillStyle = env.alpha(col.fg, 0.12);
  for (let i = 0, count = Math.round(18 * v.density); i < count; i++) {
    g.fillRect(((i * 0.618034 + v.turn * 0.3) % 1) * w,
      ((i * 0.754878 + v.turn * 0.17) % 1) * h, 1, 1);
  }

  g.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
  g.setLineDash(s.open ? [] : [3, 5]);
  for (const edge of [-0.9, 0.9]) {
    const fromY = sourceY + edge * size;
    g.strokeStyle = env.alpha(edge < 0 ? col.accent2 : col.accent, s.open ? 0.48 * s.exposure : 0.32);
    g.beginPath();
    g.moveTo(sourceX, fromY);
    g.lineTo(holeX, holeY);
    if (s.open) g.lineTo(screenMiddle, holeY + (holeY - fromY) * zoom);
    g.stroke();
  }
  g.setLineDash([]);

  g.fillStyle = env.mix(col.bg, col.bg2, s.open ? 0.7 : 0.35);
  g.fillRect(screenX, screenTop, screenW, screenH);
  if (s.open) {
    g.save();
    g.beginPath();
    g.rect(screenX, screenTop, screenW, screenH);
    g.clip();
    const halo = g.createRadialGradient(screenMiddle, imageY, 0, screenMiddle, imageY, screenW);
    halo.addColorStop(0, env.alpha(col.accent2, s.exposure * 0.22));
    halo.addColorStop(1, env.alpha(col.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(screenX, screenTop, screenW, screenH);
    const blur = (s.aperture - 2) / 22;
    const brightness = Math.min(0.95, (0.22 + s.aperture / 24 * 0.7) / (0.65 + zoom * 0.25));
    for (let i = -2; i <= 2; i++) {
      const shift = i * blur * size * 0.18;
      cameraShape(g, env, p.subject, screenMiddle + shift, imageY + shift * 0.7,
        size * zoom, true, s.exposure * brightness * 0.12);
    }
    cameraShape(g, env, p.subject, screenMiddle, imageY, size * zoom, true,
      s.exposure * brightness * (0.9 - blur * 0.35));
    g.restore();
  }
  g.strokeStyle = env.alpha(col.fg, 0.7);
  g.lineWidth = 1.5;
  g.strokeRect(screenX, screenTop, screenW, screenH);

  cameraShape(g, env, p.subject, sourceX, sourceY, size, false, 0.94);
  g.fillStyle = col.accent;
  g.fillRect(holeX - w * 0.009, h * 0.1, w * 0.018, h * 0.8);
  g.fillStyle = col.bg;
  g.beginPath();
  g.arc(holeX, holeY, Math.max(2, size * (0.13 + s.aperture / 24 * 0.25)), 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = s.placed ? col.accent2 : env.alpha(col.fg, 0.6);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(holeX, holeY, Math.max(4, size * 0.48), 0, Math.PI * 2);
  g.stroke();

  const fontSize = Math.max(10, Math.min(16, Math.round(Math.min(w, h) * 0.043)));
  g.font = '500 ' + fontSize + 'px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = col.fg;
  g.textAlign = 'center';
  g.fillText('source', sourceX, h * 0.91, w * 0.25);
  g.fillText('hole', holeX, h * 0.91, w * 0.2);
  g.fillText(s.open ? 'lit screen' : 'covered', screenMiddle, h * 0.91, screenW);
  g.restore();
}

function cameraPreview(g, w, h, env, p) {
  cameraScene(g, w, h, env, p, {
    aperture: p.aperture, distance: p.distance, hole: p.hole,
    placed: false, open: false, exposure: 0
  });
}

function cameraPiece(env, carriedPlan) {
  const p = carriedPlan || cameraPlan(env);
  const s = {
    aperture: p.aperture, distance: p.distance, hole: p.hole,
    placed: false, open: false, exposure: 0, guess: ''
  };
  const draw = (c) => cameraScene(c.g, c.w, c.h, env, p, s);
  return {
    title: cameraTitle(p),
    brief: 'Predict which way the ' + p.subject + ' will face, adjust the hole and screen, tap anywhere to place the hole, then open the shutter and watch the image appear.',
    aspect: '4 / 3',
    steps: [
      { id: 'guess', ask: 'which way will the image face?', kind: 'choice', options: CAMERA_GUESSES },
      { id: 'aperture', ask: 'the size of the hole', kind: 'range', min: 2, max: 24, step: 1, value: p.aperture, low: 'tiny', high: 'wide' },
      { id: 'distance', ask: 'how far back the screen sits', kind: 'range', min: 35, max: 90, step: 1, value: p.distance, low: 'near', high: 'far' },
      { id: 'hole', ask: 'tap anywhere to place the hole at that height', kind: 'tap', label: 'place the hole for me' },
      { id: 'open', ask: 'uncover the screen', kind: 'press', count: 1, label: 'open the shutter' }
    ],
    start(c) {
      c.status('The screen is covered. Light from the ' + p.subject + ' reaches the hole.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'guess') {
        s.guess = String(value);
        c.status('Prediction placed. The covered screen has not given anything away.');
      }
      if (id === 'aperture') {
        s.aperture = Math.max(2, Math.min(24, Math.round(Number(value))));
        c.status(s.aperture < 10 ? 'A small hole lets less light through.' : 'A larger hole lets more light through.');
      }
      if (id === 'distance') {
        s.distance = Math.max(35, Math.min(90, Math.round(Number(value))));
        c.status(s.distance < 60 ? 'The screen is closer to the hole.' : 'The screen is farther from the hole.');
      }
      if (id === 'open') {
        s.open = true;
        s.exposure = c.reduced ? 1 : 0.18;
        c.status('The screen is uncovered. The image is coming into view.');
      }
      draw(c);
    },
    tap(x, y, c) {
      if (c.done) return;
      s.hole = 0.43 + Math.max(0, Math.min(1, y)) * 0.14;
      s.placed = true;
      c.progress('hole', 1);
      c.status('Hole placed ' + (s.hole < 0.47 ? 'high' : s.hole > 0.53 ? 'low' : 'near the middle') + '.');
      c.satisfy('hole');
      draw(c);
    },
    frame(t, dt, c) {
      if (s.open) s.exposure = c.reduced ? 1 : Math.min(1, s.exposure + Math.max(0, dt) * 0.8);
      draw(c);
    },
    end(c) {
      s.open = true;
      s.exposure = c.reduced ? 1 : Math.max(s.exposure, 0.18);
      draw(c);
      c.status('The ' + p.subject + ' appears upside down: rays from its top and bottom cross at the hole. '
        + (s.guess === 'inverted' ? 'You called it. ' : 'You predicted ' + (CAMERA_GUESSES.find((guess) => guess.value === s.guess) || CAMERA_GUESSES[0]).label + '. ')
        + 'A wider hole brightens but softens the image; a farther screen makes it larger and dimmer.');
    }
  };
}

export default {
  id: 'light-table',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsFilters(env)) {
      filterPreview(g, w, h, env, filterPlan(env));
      return;
    }
    if (dealsCamera(env)) {
      cameraPreview(g, w, h, env, cameraPlan(env));
      return;
    }
    const made = setup(env);
    scene(g, w, h, env, made.subject,
      { slits: 'two', gap: made.subject.gap, shown: 0, preview: true, finished: false }, made.marks);
  },
  spark(env) {
    if (dealsFilters(env)) {
      const p = filterPlan(env);
      return {
        title: filterTitle(p),
        text: FILTER_BRIEF,
        mono: 'loose filter: ' + p.turn + ' degrees from the first',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => filterPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    if (dealsCamera(env)) {
      const p = cameraPlan(env);
      return {
        title: cameraTitle(p),
        text: 'One ' + p.subject + ', one hole, one covered screen. Predict what the light will draw, then uncover it.',
        mono: 'hole ' + p.aperture + '\nscreen ' + p.distance,
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => cameraPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
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
  piece(env) {
    const filters = carriedFilters(env);
    if (filters) return filterPiece(env, filters);
    const camera = carriedCamera(env);
    if (camera) return cameraPiece(env, camera);
    if (carried(env)) return slitPiece(env);
    if (dealsFilters(env)) return filterPiece(env);
    return dealsCamera(env) ? cameraPiece(env) : slitPiece(env);
  }
};
