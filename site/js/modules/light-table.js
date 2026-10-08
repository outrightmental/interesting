/* The light table: a lamp, a pair of slits and a screen, or a lamp and three polarising filters,
   each read as a puzzle with its numbers on the table. As a card it is one of the two puzzles
   below, drawn as it stands (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece
   is.

   Two puzzles, both deduction with a little arithmetic:

     the slit spacing   Light of a stated wavelength passes two slits and lands on a screen a
                        stated distance away as fringes, drawn over a millimetre ruler. The
                        fringes are wavelength times distance over slit spacing apart, so the
                        spacing follows from the ruler. The wavelength, distance and spacing are
                        chosen so the fringe spacing is a whole number of millimetres. Say the
                        spacing, and what one named change would do to the fringes.
     the filter order   Three polarising filters at stated angles. The first passes half the
                        lamp's light whatever its angle; each one after passes cos squared of the
                        angle between it and the one before. Put them in the order that passes the
                        most light, and say what fraction gets through, to the nearest five per
                        cent. The angles are chosen so one middle filter beats the other two and
                        the rounding is never in doubt; the two orders with that filter in the
                        middle pass the same light, and the check accepts either.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the lamp, the distances, the angles -- and piece(env) opens on that rather than rolling
   another. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const LAMBDAS = [400, 450, 500, 550, 600, 650, 700];
const LENGTHS = [500, 600, 750, 800, 1000, 1200, 1500, 2000];
const CHANGES = [
  { what: 'moving the slits closer together', does: 'spread' },
  { what: 'moving the slits farther apart', does: 'pack' },
  { what: 'moving the screen farther away', does: 'spread' },
  { what: 'moving the screen closer', does: 'pack' },
  { what: 'using a longer wavelength', does: 'spread' },
  { what: 'using a shorter wavelength', does: 'pack' }
];
const EFFECTS = [
  { label: 'spreads them out', value: 'spread' },
  { label: 'packs them closer', value: 'pack' },
  { label: 'leaves them as they are', value: 'same' }
];
const ANGLES = [0, 30, 45, 60, 90, 120, 135, 150];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ---- shared drawing ------------------------------------------------------------------------- */

function background(g, w, h, env) {
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

// Dust on the table: a few marks whose phase is the configuration's turn and whose number is its
// density.
function dust(g, w, h, env, v) {
  g.fillStyle = env.alpha(env.colors.fg, 0.12);
  for (let i = 0, count = Math.max(6, Math.round(20 * v.density)); i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.3) % 1) * w, ((i * 0.7548777 + v.turn * 0.17) % 1) * h, 1, 1);
  }
}

function lamp(g, env, x, y, radius) {
  const glow = g.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, env.alpha(env.colors.accent2, 0.6));
  glow.addColorStop(1, env.alpha(env.colors.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  g.fillStyle = env.colors.fg;
  g.beginPath();
  g.arc(x, y, Math.max(2, radius * 0.09), 0, Math.PI * 2);
  g.fill();
}

function label(g, env, text, x, y, size, align, tone) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillStyle = tone || env.colors.fg;
  g.fillText(text, x, y);
}

/* ---- the slit spacing ----------------------------------------------------------------------- */

// The slit spacing in hundredths of a millimetre for a wavelength in nanometres, a distance in
// millimetres and a fringe spacing in millimetres: d = lambda L / dy, or null when it is not a
// whole number between 10 and 100.
function spacingOf(lambda, length, fringe) {
  const d = (lambda * length) / (fringe * 10000);
  return Number.isInteger(d) && d >= 10 && d <= 100 ? d : null;
}

function slitCombos() {
  const out = [];
  for (const lambda of LAMBDAS) {
    for (const length of LENGTHS) {
      for (let fringe = 1; fringe <= 6; fringe++) if (spacingOf(lambda, length, fringe) !== null) out.push({ lambda, length, fringe });
    }
  }
  return out;
}

function slitPlan(env) {
  const combos = slitCombos();
  const pick = combos[env.int(0, combos.length - 1)];
  return { kind: 'slits', number: env.int(100, 999), lambda: pick.lambda, length: pick.length, fringe: pick.fringe, ask: env.int(0, CHANGES.length - 1) };
}

function carriedSlits(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'slits') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!LAMBDAS.includes(p.lambda) || !LENGTHS.includes(p.length)) return null;
  if (!Number.isInteger(p.fringe) || p.fringe < 1 || p.fringe > 6 || spacingOf(p.lambda, p.length, p.fringe) === null) return null;
  if (!Number.isInteger(p.ask) || p.ask < 0 || p.ask >= CHANGES.length) return null;
  return { kind: 'slits', number: p.number, lambda: p.lambda, length: p.length, fringe: p.fringe, ask: p.ask };
}

function slitTitle(plan) {
  return 'lamp ' + plan.number + ': the slit spacing';
}

// The ruler's reach either side of the middle, in millimetres: four fringes.
function reachOf(plan) {
  return plan.fringe * 4;
}

function slitGeometry(w, h) {
  return {
    sourceX: w * 0.1, maskX: w * 0.36, screenX: w * 0.7, screenW: w * 0.075,
    rulerX: w * 0.79, top: h * 0.1, bottom: h * 0.88, middle: h * 0.49
  };
}

// `s`: whether the answer is in (the spacing written on the mask).
function drawSlits(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = slitGeometry(w, h);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const reach = reachOf(plan);
  const screenH = geo.bottom - geo.top;
  const perMm = screenH / (reach * 2);
  background(g, w, h, env);
  dust(g, w, h, env, v);
  // The lamp and its wavelength.
  const sourceX = geo.sourceX + (v.turn - 0.5) * w * 0.03;
  lamp(g, env, sourceX, geo.middle, Math.min(w, h) * 0.11 * v.scale);
  label(g, env, plan.lambda + ' nm', sourceX, geo.middle + Math.min(w, h) * 0.12, size, 'center', c.accent2);
  // The mask with its two slits, and the arcs that leave them.
  const gap = Math.max(6, h * 0.05);
  const openings = [geo.middle - gap / 2, geo.middle + gap / 2];
  const ringStep = Math.max(8, (geo.screenX - geo.maskX) / (6 * v.density) / v.scale);
  for (const y of openings) {
    g.strokeStyle = env.alpha(c.accent2, 0.3);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sourceX, geo.middle);
    g.lineTo(geo.maskX, y);
    g.stroke();
    for (let r = ringStep; r < geo.screenX - geo.maskX; r += ringStep) {
      g.strokeStyle = env.alpha(c.accent, 0.08 + 0.08 * (1 - r / (geo.screenX - geo.maskX)));
      g.beginPath();
      g.arc(geo.maskX, y, r, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
  }
  const slitH = Math.max(2, h * 0.012);
  g.fillStyle = c.accent2;
  g.fillRect(geo.maskX - 2, geo.top, 4, openings[0] - slitH / 2 - geo.top);
  g.fillRect(geo.maskX - 2, openings[0] + slitH / 2, 4, gap - slitH);
  g.fillRect(geo.maskX - 2, openings[1] + slitH / 2, 4, geo.bottom - openings[1] - slitH / 2);
  label(g, env, 'd ' + (s.open ? (plan.spacing / 100).toFixed(2) + ' mm' : '?'), geo.maskX, geo.top - size * 0.9, size, 'center', c.accent2);
  // The distance to the screen.
  const dimY = geo.bottom + size * 0.9;
  g.strokeStyle = env.alpha(c.muted, 0.7);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(geo.maskX, dimY);
  g.lineTo(geo.screenX, dimY);
  g.moveTo(geo.maskX, dimY - 4);
  g.lineTo(geo.maskX, dimY + 4);
  g.moveTo(geo.screenX, dimY - 4);
  g.lineTo(geo.screenX, dimY + 4);
  g.stroke();
  label(g, env, 'L ' + plan.length + ' mm', (geo.maskX + geo.screenX) / 2, dimY + size * 0.9, size, 'center', c.accent2);
  // The screen: the fringes as the slits make them, cos squared of the height over the fringe
  // spacing, under a soft envelope.
  g.fillStyle = env.mix(c.bg, c.bg2, 0.5);
  g.fillRect(geo.screenX, geo.top, geo.screenW, screenH);
  const slices = 180;
  const sliceH = screenH / slices;
  for (let i = 0; i < slices; i++) {
    const mm = ((i + 0.5) / slices - 0.5) * reach * 2;
    const envelope = Math.exp(-0.9 * (mm / reach) ** 2);
    const value = envelope * Math.cos((Math.PI * mm) / plan.fringe) ** 2;
    g.fillStyle = env.alpha(c.accent2, 0.03 + value * 0.75);
    g.fillRect(geo.screenX, geo.top + i * sliceH, geo.screenW, sliceH + 0.5);
  }
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(geo.screenX, geo.top, geo.screenW, screenH);
  // The ruler: a tick every millimetre, longer every five and ten, numbered where there is room.
  const every = reach <= 4 ? 1 : reach <= 16 ? 5 : 10;
  g.strokeStyle = env.alpha(c.fg, 0.8);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(geo.rulerX, geo.top);
  g.lineTo(geo.rulerX, geo.bottom);
  g.stroke();
  const tickSize = Math.max(8, Math.min(13, Math.round(size * 0.85)));
  for (let mm = -reach; mm <= reach; mm++) {
    const y = geo.middle - mm * perMm;
    const len = mm % 10 === 0 ? w * 0.03 : mm % 5 === 0 ? w * 0.02 : w * 0.011;
    g.beginPath();
    g.moveTo(geo.rulerX, y);
    g.lineTo(geo.rulerX + len, y);
    g.stroke();
    if (mm % every === 0) label(g, env, String(mm), geo.rulerX + w * 0.04, y, tickSize, 'left', env.alpha(c.fg, 0.9));
  }
  label(g, env, 'mm', geo.rulerX + w * 0.02, geo.top - size * 0.9, size, 'left', env.alpha(c.muted, 0.9));
}

function slitPreview(g, w, h, env, plan) {
  drawSlits(g, w, h, env, Object.assign({ spacing: spacingOf(plan.lambda, plan.length, plan.fringe) }, plan), { open: false }, env.variant);
}

function slitPiece(env, plan) {
  const spacing = spacingOf(plan.lambda, plan.length, plan.fringe);
  const full = Object.assign({ spacing }, plan);
  const change = CHANGES[plan.ask];
  const s = { open: false };
  const draw = (c) => drawSlits(c.g, c.w, c.h, c, full, s, env.variant);
  return {
    title: slitTitle(plan),
    brief: 'Light of wavelength ' + plan.lambda + ' nm passes two slits and lands on a screen ' + plan.length + ' mm away as bright and dark fringes. Neighbouring bright fringes are a wavelength times the distance, over the slit spacing, apart; the ruler beside the screen is in millimetres.',
    goal: 'Find the slit spacing, and say what ' + change.what + ' would do to the fringes.',
    aspect: '4 / 3',
    checkLabel: 'check the table',
    steps: [
      { id: 'spacing', ask: 'the slit spacing, in hundredths of a millimetre', kind: 'number', min: 10, max: 100, step: 1, unit: '/100 mm' },
      { id: 'change', ask: 'what ' + change.what + ' does to the fringes', kind: 'choice', options: EFFECTS }
    ],
    solution: { spacing, change: change.does },
    check(c) {
      const guess = Number(c.value('spacing'));
      const spacingRight = guess === spacing;
      const changeRight = c.value('change') === change.does;
      if (spacingRight && changeRight) return { solved: true, say: 'the slits are ' + (spacing / 100).toFixed(2) + ' mm apart, and ' + change.what + ' ' + EFFECTS.find((e) => e.value === change.does).label.replace('them', 'the fringes') };
      const near = Number.isFinite(guess) && Math.abs(guess - spacing) <= spacing * 0.1;
      const spacingWord = spacingRight ? 'the spacing is right' : near ? 'the spacing is close but not on the mark' : 'the spacing is off';
      const changeWord = changeRight ? 'the prediction is right' : 'the prediction is off';
      return { solved: false, say: spacingWord + '; ' + changeWord };
    },
    start(c) {
      c.status('read the fringe spacing off the ruler');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'spacing') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) c.status('slits ' + (clamp(n, 10, 100) / 100).toFixed(2) + ' mm apart, you say');
      }
      if (id === 'change') {
        const effect = EFFECTS.find((e) => e.value === value);
        if (effect) c.status(change.what + ' ' + effect.label.replace('them', 'the fringes') + ', you say');
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.open = true;
      c.status((spacing / 100).toFixed(2) + ' mm between the slits: ' + plan.lambda + ' nm times ' + plan.length + ' mm over ' + plan.fringe + ' mm');
      draw(c);
    }
  };
}

/* ---- the filter order ----------------------------------------------------------------------- */

function cos2(degrees) {
  return Math.cos((degrees * Math.PI) / 180) ** 2;
}

// What passes three filters in the given order: half at the first, cos squared of each turn after.
function passes(order) {
  return 50 * cos2(order[0] - order[1]) * cos2(order[1] - order[2]);
}

// The filter that belongs in the middle, the order that puts it there, and the percentage to the
// nearest five -- or null when two middles tie, or the true value sits within one of a rounding
// boundary.
function bestOf(angles) {
  const trials = angles.map((middle) => {
    const ends = angles.filter((a) => a !== middle);
    return { middle, order: [ends[0], middle, ends[1]], exact: passes([ends[0], middle, ends[1]]) };
  }).sort((p, q) => q.exact - p.exact);
  if (trials[0].exact - trials[1].exact < 0.5) return null;
  const best = trials[0];
  const rounded = Math.round(best.exact / 5) * 5;
  if (Math.abs((best.exact % 5) - 2.5) < 1 || rounded < 5) return null;
  return { middle: best.middle, order: best.order, exact: best.exact, percent: rounded };
}

function isOrder(list, angles) {
  return Array.isArray(list) && list.length === 3 && angles.every((a) => list.includes(a)) && new Set(list).size === 3;
}

function filterPlan(env) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pool = ANGLES.slice();
    const angles = [];
    while (angles.length < 3) angles.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
    angles.sort((p, q) => p - q);
    const best = bestOf(angles);
    if (!best) continue;
    // An opening order that is not an answer, so the table asks something.
    const starts = [];
    for (const a of angles) for (const b of angles) for (const c of angles) if (a !== b && b !== c && a !== c && b !== best.middle) starts.push([a, b, c]);
    return { kind: 'filters', number: env.int(100, 999), angles, start: starts[env.int(0, starts.length - 1)] };
  }
  return { kind: 'filters', number: env.int(100, 999), angles: [0, 30, 45], start: [30, 0, 45] };
}

function carriedFilters(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'filters') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Array.isArray(p.angles) || p.angles.length !== 3 || !p.angles.every((a) => ANGLES.includes(a)) || new Set(p.angles).size !== 3) return null;
  const angles = p.angles.slice().sort((a, b) => a - b);
  const best = bestOf(angles);
  if (!best || !isOrder(p.start, angles) || p.start[1] === best.middle) return null;
  return { kind: 'filters', number: p.number, angles, start: p.start.slice() };
}

function filterTitle(plan) {
  return 'filter set ' + plan.number + ': ' + plan.angles.join(', ') + ' degrees';
}

function filterPlate(g, env, x, y, radius, angle, v) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.fillStyle = env.mix(c.bg, c.bg2, 0.7);
  g.fill();
  g.save();
  g.clip();
  g.rotate((angle * Math.PI) / 180);
  g.strokeStyle = c.accent;
  g.lineWidth = Math.max(1, radius * 0.05);
  const lines = Math.max(4, Math.round(7 * v.density));
  g.beginPath();
  for (let i = 0; i <= lines; i++) {
    const at = ((i / lines) * 2 - 1) * radius;
    g.moveTo(at, -radius);
    g.lineTo(at, radius);
  }
  g.stroke();
  g.restore();
  g.strokeStyle = c.fg;
  g.lineWidth = Math.max(1, radius * 0.05);
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// `s`: the order on the table, the middle a hint has named, and the light once the answer is in.
function drawFilters(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const y = h * 0.36;
  const radius = Math.min(w * 0.07, h * 0.12) * v.scale;
  const best = bestOf(plan.angles);
  const light = s.open && best ? best.exact / 100 : null;
  background(g, w, h, env);
  dust(g, w, h, env, v);
  label(g, env, 'filter set ' + plan.number, w * 0.5, h * 0.07, size, 'center', c.accent2);
  // The beam, lamp to screen: the same faint band everywhere until the answer is in.
  const band = h * 0.07;
  const stops = [w * 0.07, w * 0.3, w * 0.5, w * 0.7, w * 0.9];
  let strength = 1;
  for (let i = 0; i < 4; i++) {
    if (light !== null) strength = i === 0 ? 1 : i === 1 ? 0.5 : i === 2 ? 0.5 * cos2(s.order[0] - s.order[1]) : light;
    g.fillStyle = env.alpha(c.accent2, light === null ? 0.08 : 0.04 + strength * 0.3);
    g.fillRect(stops[i], y - band / 2, stops[i + 1] - stops[i], band);
  }
  lamp(g, env, w * 0.07, y, Math.min(w, h) * 0.1 * v.scale);
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + i * 0.2);
    filterPlate(g, env, x, y, radius, s.order[i], v);
    label(g, env, s.order[i] + '°', x, y + radius + size * 1.1, size, 'center', s.named === s.order[i] ? c.accent2 : c.fg);
  }
  // The screen: unread until the order is found.
  const screenX = w * 0.9;
  const screenH = h * 0.24;
  g.fillStyle = light === null ? env.mix(c.bg, c.bg2, 0.5) : env.mix(c.bg, c.accent2, Math.min(1, Math.sqrt(light) * 1.4));
  g.fillRect(screenX, y - screenH / 2, w * 0.03, screenH);
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(screenX, y - screenH / 2, w * 0.03, screenH);
  label(g, env, light === null ? '?' : Math.round(light * 1000) / 10 + '%', screenX + w * 0.015, y + screenH / 2 + size, size, 'center', c.accent2);
  label(g, env, 'lamp side', w * 0.3, y - radius - size * 1.2, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  label(g, env, 'screen side', w * 0.7, y - radius - size * 1.2, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  // The table of cos squared, so the arithmetic is on the table.
  const rowY = h * 0.7;
  const tiny = Math.max(8, size - 1);
  label(g, env, 'the first filter passes half the lamp\'s light; each one after passes cos² of the turn from the one before', w * 0.5, rowY, tiny, 'center', env.alpha(c.fg, 0.9));
  const pairs = [[0, '1'], [15, '0.93'], [30, '0.75'], [45, '0.50'], [60, '0.25'], [75, '0.07'], [90, '0']];
  pairs.forEach((pair, i) => {
    const x = w * (0.08 + (i + 0.5) * 0.12);
    label(g, env, pair[0] + '°', x, rowY + tiny * 2, tiny, 'center', c.accent2);
    label(g, env, pair[1], x, rowY + tiny * 3.3, tiny, 'center', c.fg);
  });
  label(g, env, 'a turn past 90° reads as 180° less the turn: 120° as 60°, 135° as 45°, 150° as 30°', w * 0.5, rowY + tiny * 5, tiny, 'center', env.alpha(c.muted, 0.9));
}

function filterPreview(g, w, h, env, plan) {
  drawFilters(g, w, h, env, plan, { order: plan.start.slice(), named: null, open: false }, env.variant);
}

function filterPiece(env, plan) {
  const best = bestOf(plan.angles);
  const s = { order: plan.start.slice(), named: null, open: false };
  const draw = (c) => drawFilters(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: filterTitle(plan),
    brief: 'Three polarising filters, at ' + plan.angles.join(', ') + ' degrees. The first one the light meets passes half of it whatever its angle; each one after passes cos² of the angle between it and the one before, and the table under the lamp has the values.',
    goal: 'Put the filters in the order that passes the most light, and say how much gets through.',
    aspect: '4 / 3',
    checkLabel: 'check the table',
    steps: [
      { id: 'order', ask: 'the filters, lamp side first', kind: 'order', items: plan.angles.map((a) => ({ label: 'the ' + a + '° filter', value: a })), value: plan.start.slice() },
      { id: 'passes', ask: 'how much of the lamp\'s light gets through, to the nearest five per cent', kind: 'number', min: 0, max: 100, step: 5, unit: '%' },
      { id: 'hint', ask: 'which filter goes in the middle', kind: 'press', count: 1, label: 'name the middle one', optional: true }
    ],
    solution: { order: best.order.slice(), passes: best.percent },
    check(c) {
      const order = c.value('order');
      const orderRight = isOrder(order, plan.angles) && order[1] === best.middle;
      const passRight = Number(c.value('passes')) === best.percent;
      if (orderRight && passRight) return { solved: true, say: 'with the ' + best.middle + '° filter in the middle, ' + Math.round(best.exact * 10) / 10 + '% of the light reaches the screen' };
      if (!orderRight && !passRight) return { solved: false, say: 'the order and the percentage are both off' };
      return { solved: false, say: orderRight ? 'the order is right; the percentage is off' : 'the percentage is right; the order is off' };
    },
    start(c) {
      c.status('the screen stays unread until the order is found');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isOrder(value, plan.angles)) {
        s.order = value.slice();
        c.status('lamp, then ' + s.order.join('°, ') + '°, then the screen');
      }
      if (id === 'passes') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) c.status(clamp(n, 0, 100) + '% gets through, you say');
      }
      if (id === 'hint') {
        if (s.named === null) {
          s.named = best.middle;
          c.hint();
          c.status('the ' + best.middle + '° filter goes in the middle');
        } else {
          c.status('the middle one is named; the ends can go either way round');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.open = true;
      s.order = best.order.slice();
      c.status('half, times ' + cos2(best.order[0] - best.order[1]).toFixed(2) + ', times ' + cos2(best.order[1] - best.order[2]).toFixed(2) + ': ' + Math.round(best.exact * 10) / 10 + '% reaches the screen');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle a seed is dealt, from the seed alone so that paint, spark and piece agree.
function dealsFilters(env) {
  return (((Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0) >>> 3) & 1) === 1;
}

export default {
  id: 'light-table',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsFilters(env)) filterPreview(g, w, h, env, filterPlan(env));
    else slitPreview(g, w, h, env, slitPlan(env));
  },
  spark(env) {
    if (dealsFilters(env)) {
      const plan = filterPlan(env);
      return {
        title: filterTitle(plan),
        text: 'Three polarising filters and one lamp. Find the order that passes the most light, and how much that is.',
        mono: plan.angles.map((a) => a + '°').join(' / '),
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => filterPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = slitPlan(env);
    return {
      title: slitTitle(plan),
      text: 'Fringes on a screen, a ruler beside them, and the lamp and distance written on the table. Find how far apart the slits are.',
      mono: plan.lambda + ' nm / ' + plan.length + ' mm',
      aspect: '4 / 3',
      paint: (ctx, cw, ch, cardEnv) => slitPreview(ctx, cw, ch, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const filters = carriedFilters(env);
    if (filters) return filterPiece(env, filters);
    const slits = carriedSlits(env);
    if (slits) return slitPiece(env, slits);
    return dealsFilters(env) ? filterPiece(env, filterPlan(env)) : slitPiece(env, slitPlan(env));
  }
};
