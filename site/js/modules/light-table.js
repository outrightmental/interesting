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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing drawn on the table moves along a formula or cuts without a
   rite: the wavefronts leaving the slits advance in rite.ratchet's clicks, the lamp breathes on
   rite.stair, the dust blinks on rite.flicker; a filter turned to a new place turns in clicks;
   a thing arriving -- an answer read, a guess written, a filter named -- blinks on with
   rite.flicker; and a surface that becomes set -- the beam once the order is found, the screen
   lit, the chip behind a named filter, the guess's bar, the light over a solved table -- develops
   by its AREA through rite.matte, cell by cell in the piece's own pattern, and never by a fade.
   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion, and for whatever stood there from the start (since < 0). Each band, plate or speck
   moves on a roll of its own (rite.at), so no two step together. */

const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 0, flicker: () => 1, matte: () => true,
  treads: 1, kind: 'none', cell: 4, at: () => STILL
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

// The cells of a box that the matte lets through at coverage k, filled in the current fillStyle:
// how a surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame
// stays cheap, on a grid fixed to the canvas so the pattern holds still while it grows. `inside`
// keeps the tiling to a shape within the box. At k >= 1 every cell is let through.
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

// Up the stair and back down it over one period, entered at the configuration's turn: the lamp's
// breath, never a cosine.
function breath(rite, t, period, turn, n) {
  const phase = fract(t / period + turn);
  return phase < 0.5 ? rite.stair(phase * 2, n) : 1 - rite.stair((phase - 0.5) * 2, n);
}

// The light that comes over a solved table: it develops through the matte from the moment the
// piece was solved, blinking on and dropping out the way the rite's flicker has it, and holds.
function daybreak(g, rite, env, w, h, p) {
  const k = rite.stair(p);
  if (k <= 0 || !rite.flicker(p)) return;
  g.fillStyle = env.alpha(env.colors.accent2, 0.16);
  if (k >= 1) g.fillRect(0, 0, w, h);
  else develop(g, rite, 0, 0, w, h, k, null, Math.max(rite.cell, Math.ceil(Math.min(w, h) / 32)));
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
// density. Each speck blinks on a roll of its own, in its own period, so the dust never twinkles
// in step.
function dust(g, w, h, env, v, t) {
  const rite = riteOf(env);
  g.fillStyle = env.alpha(env.colors.fg, 0.12);
  for (let i = 0, count = Math.max(6, Math.round(20 * v.density)); i < count; i++) {
    const own = rite.at(0xd05 + i);
    if (!own.flicker(fract((t || 0) / (2.2 + (i % 5) * 0.7) + i * 0.37 + v.turn))) continue;
    g.fillRect(((i * 0.6180339 + v.turn * 0.3) % 1) * w, ((i * 0.7548777 + v.turn * 0.17) % 1) * h, 1, 1);
  }
}

// The lamp, its glow swollen by `swell` (0..1): one tread of the breath at a time.
function lamp(g, env, x, y, radius, swell) {
  const r = radius * (0.86 + 0.28 * (swell || 0));
  const glow = g.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, env.alpha(env.colors.accent2, 0.6));
  glow.addColorStop(1, env.alpha(env.colors.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = env.colors.fg;
  g.beginPath();
  g.arc(x, y, Math.max(2, radius * 0.09), 0, Math.PI * 2);
  g.fill();
}

// The largest size, down from `size`, at which `text` fits in `width`.
function fitted(g, size, text, width) {
  for (let at = size; at > 6; at--) {
    g.font = '500 ' + at + 'px system-ui, sans-serif';
    if (g.measureText(text).width <= width) return at;
  }
  return 6;
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
  return 'lamp ' + plan.number + ': the slit spacing, by its fringes';
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

// The slits' state as a scene opens: nothing answered, nothing predicted, nothing revealed, and
// every change timed against the piece's clock from here on (-1 is "there from the start").
function slitState() {
  return { open: false, t: 0, openAt: -1, guess: null, guessAt: -1, effect: null, effectAt: -1 };
}

// The fringes a spacing makes, slice by slice down a strip: cos squared of the height over the
// fringe spacing, under a soft envelope. `k` under 1 develops the strip through the matte in cells
// instead of slices -- how a prediction arrives.
function fringes(g, env, rite, x, top, width, height, reach, fringe, k, strength) {
  const c = env.colors;
  const value = (mm) => Math.exp(-0.9 * (mm / reach) ** 2) * Math.cos((Math.PI * mm) / fringe) ** 2;
  if (k >= 1) {
    const slices = 180;
    const sliceH = height / slices;
    for (let i = 0; i < slices; i++) {
      const mm = ((i + 0.5) / slices - 0.5) * reach * 2;
      g.fillStyle = env.alpha(c.accent2, 0.03 + value(mm) * strength);
      g.fillRect(x, top + i * sliceH, width, sliceH + 0.5);
    }
    return;
  }
  if (k <= 0) return;
  const cell = Math.max(rite.cell, Math.ceil(height / 60));
  const cx0 = Math.floor(x / cell);
  const cx1 = Math.ceil((x + width) / cell);
  const cy0 = Math.floor(top / cell);
  const cy1 = Math.ceil((top + height) / cell);
  for (let cy = cy0; cy < cy1; cy++) {
    const py = cy * cell;
    const mm = ((py + cell / 2 - top) / height - 0.5) * reach * 2;
    const a = 0.03 + value(mm) * strength;
    for (let cx = cx0; cx < cx1; cx++) {
      if (!rite.matte(cx, cy, k)) continue;
      g.fillStyle = env.alpha(c.accent2, a);
      g.fillRect(cx * cell, py, cell, cell);
    }
  }
}

// `s`: whether the answer is in (the spacing written on the mask), the guess and the prediction
// the visitor has made, and the clock.
function drawSlits(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const t = reduced ? 0 : s.t || 0; // less motion asked for: the lamp, the fronts and the dust hold still
  const geo = slitGeometry(w, h);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const reach = reachOf(plan);
  const screenH = geo.bottom - geo.top;
  const perMm = screenH / (reach * 2);
  const openP = s.open ? came(s, s.openAt, 1.8, reduced) : 0;
  background(g, w, h, env);
  dust(g, w, h, env, v, t);
  // The lamp and its wavelength: the glow breathes on the stair, six seconds to a breath.
  const sourceX = geo.sourceX + (v.turn - 0.5) * w * 0.03;
  lamp(g, env, sourceX, geo.middle, Math.min(w, h) * 0.11 * v.scale, breath(rite.at(0x1a4), t, 6, v.turn));
  label(g, env, plan.lambda + ' nm', sourceX, geo.middle + Math.min(w, h) * 0.12, size, 'center', c.accent2);
  // The mask with its two slits, and the wavefronts that leave them: a ring every ringStep,
  // advancing one step in the ratchet's clicks every 2.4 seconds, so a front always rests on a
  // tooth and the turn one period makes lands the fronts on themselves. Each slit on a roll of
  // its own.
  const gap = Math.max(6, h * 0.05);
  const openings = [geo.middle - gap / 2, geo.middle + gap / 2];
  const ringStep = Math.max(8, (geo.screenX - geo.maskX) / (6 * v.density) / v.scale);
  openings.forEach((y, slit) => {
    g.strokeStyle = env.alpha(c.accent2, 0.3);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sourceX, geo.middle);
    g.lineTo(geo.maskX, y);
    g.stroke();
    const advance = rite.at(0x5e1 + slit).ratchet(fract(t / 2.4 + v.turn)) * ringStep;
    for (let r = advance; r < geo.screenX - geo.maskX; r += ringStep) {
      if (r < 2) continue;
      g.strokeStyle = env.alpha(c.accent, 0.08 + 0.08 * (1 - r / (geo.screenX - geo.maskX)));
      g.beginPath();
      g.arc(geo.maskX, y, r, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
  });
  const slitH = Math.max(2, h * 0.012);
  g.fillStyle = c.accent2;
  g.fillRect(geo.maskX - 2, geo.top, 4, openings[0] - slitH / 2 - geo.top);
  g.fillRect(geo.maskX - 2, openings[0] + slitH / 2, 4, gap - slitH);
  g.fillRect(geo.maskX - 2, openings[1] + slitH / 2, 4, geo.bottom - openings[1] - slitH / 2);
  // What the mask says of its spacing: the answer blinks on once it is read; before that, the
  // visitor's guess blinks on as a question of its own, and a question mark holds otherwise.
  const answered = s.open && rite.flicker(openP);
  const guessP = s.guess !== null ? came(s, s.guessAt, 0.9, reduced) : 0;
  const guessing = !answered && s.guess !== null && rite.at(0x9e5).flicker(guessP);
  const said = answered ? (plan.spacing / 100).toFixed(2) + ' mm' : guessing ? (clamp(s.guess, 10, 100) / 100).toFixed(2) + ' mm?' : '?';
  label(g, env, 'd ' + said, geo.maskX, geo.top - size * 0.9, size, 'center', guessing ? c.accent : c.accent2);
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
  // The screen: the fringes as the slits make them.
  g.fillStyle = env.mix(c.bg, c.bg2, 0.5);
  g.fillRect(geo.screenX, geo.top, geo.screenW, screenH);
  fringes(g, env, rite, geo.screenX, geo.top, geo.screenW, screenH, reach, plan.fringe, 1, 0.75);
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(geo.screenX, geo.top, geo.screenW, screenH);
  // The prediction: a ghost of a screen beside the real one, the fringes as the visitor says the
  // change would leave them -- spread, packed or the same -- developing through the matte from
  // the moment the choice was made, and drawn afresh through it when the choice changes.
  if (s.effect !== null && !answered) {
    const factor = s.effect === 'spread' ? 1.4 : s.effect === 'pack' ? 0.7 : 1;
    const ghostW = geo.screenW * 0.5;
    const ghostX = geo.screenX - ghostW - w * 0.018;
    const own = rite.at(0x3c7);
    const k = own.stair(came(s, s.effectAt, 1.4, reduced));
    if (k > 0 && own.flicker(k)) {
      g.fillStyle = env.alpha(env.mix(c.bg, c.bg2, 0.5), 0.6);
      develop(g, rite, ghostX, geo.top, ghostW, screenH, k, null, Math.max(rite.cell, Math.ceil(screenH / 60)));
      fringes(g, env, rite, ghostX, geo.top, ghostW, screenH, reach, plan.fringe * factor, k, 0.45);
      if (k >= 1) {
        g.strokeStyle = env.alpha(c.accent, 0.55);
        g.lineWidth = 1;
        g.strokeRect(ghostX, geo.top, ghostW, screenH);
      }
      label(g, env, s.effect === 'same' ? 'as is' : s.effect, ghostX + ghostW / 2, geo.top - size * 0.9, Math.max(8, size - 2), 'center', c.accent);
    }
  }
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
  // The table read true: the light comes over it through the matte, and the fringes burn
  // brighter, cell by cell.
  if (s.open) {
    daybreak(g, rite, env, w, h, openP);
    const k = rite.at(0x7a2).stair(openP);
    if (k > 0 && rite.at(0x7a2).flicker(openP)) fringes(g, env, rite, geo.screenX, geo.top, geo.screenW, screenH, reach, plan.fringe, k, 0.5);
  }
}

function slitPreview(g, w, h, env, plan) {
  drawSlits(g, w, h, env, Object.assign({ spacing: spacingOf(plan.lambda, plan.length, plan.fringe) }, plan), slitState(), env.variant);
}

function slitPiece(env, plan) {
  // The spacing is read off a ruler, so it is a measured answer: the difficulty says how many
  // hundredths of a millimetre out it may be and still be on the mark.
  const margin = asked(env).margin;
  const spacing = spacingOf(plan.lambda, plan.length, plan.fringe);
  const full = Object.assign({ spacing }, plan);
  const change = CHANGES[plan.ask];
  const s = slitState();
  const draw = (c) => drawSlits(c.g, c.w, c.h, c, full, s, env.variant);
  return {
    title: slitTitle(plan),
    brief: 'A lamp lit on purpose: light of wavelength ' + plan.lambda + ' nm passes two slits and lands on a screen ' + plan.length + ' mm away as bright and dark fringes. Neighbouring bright fringes are a wavelength times the distance, over the slit spacing, apart; the ruler beside the screen is in millimetres.',
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
      const spacingRight = Math.abs(guess - spacing) <= margin;
      const changeRight = c.value('change') === change.does;
      if (spacingRight && changeRight) return { solved: true, say: 'the table reads true: the slits are ' + (spacing / 100).toFixed(2) + ' mm apart, and ' + change.what + ' ' + EFFECTS.find((e) => e.value === change.does).label.replace('them', 'the fringes') };
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
        if (Number.isFinite(n)) {
          c.status('slits ' + (clamp(n, 10, 100) / 100).toFixed(2) + ' mm apart, you say');
          if (s.guess !== n) {
            s.guess = n;
            s.guessAt = s.t;
          }
        }
      }
      if (id === 'change') {
        const effect = EFFECTS.find((e) => e.value === value);
        if (effect) {
          c.status(change.what + ' ' + effect.label.replace('them', 'the fringes') + ', you say');
          if (s.effect !== effect.value) {
            s.effect = effect.value;
            s.effectAt = s.t;
          }
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t = t;
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
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

// A plate drawn at `angle` degrees, its ring in `ring`.
function filterPlate(g, env, x, y, radius, angle, v, ring) {
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
  g.strokeStyle = ring || c.fg;
  g.lineWidth = Math.max(1, radius * 0.05);
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// The filters' state as a scene opens: the order as given, nothing named, nothing lit, and every
// change timed against the piece's clock from here on (-1 is "there from the start").
function filterState(order) {
  return {
    order: order.slice(), from: order.slice(), orderAt: -1, named: null, namedAt: -1,
    open: false, openAt: -1, guess: null, guessFrom: 0, guessAt: -1, t: 0
  };
}

// The short way round between two filter angles, as a signed turn: a polariser at 150 is 30 from
// one at 0.
function turnBetween(from, to) {
  return ((((to - from) % 180) + 270) % 180) - 90;
}

// `s`: the order on the table, the middle a hint has named, the light once the answer is in, the
// visitor's guess at it, and the clock.
function drawFilters(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const t = reduced ? 0 : s.t || 0; // less motion asked for: the lamp and the dust hold still
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const y = h * 0.36;
  const radius = Math.min(w * 0.07, h * 0.12) * v.scale;
  const best = bestOf(plan.angles);
  const light = s.open && best ? best.exact / 100 : null;
  const openP = s.open ? came(s, s.openAt, 1.8, reduced) : 0;
  const orderP = came(s, s.orderAt, 1.3, reduced);
  const namedP = s.named !== null ? came(s, s.namedAt, 1.1, reduced) : 0;
  background(g, w, h, env);
  dust(g, w, h, env, v, t);
  label(g, env, 'filter set ' + plan.number, w * 0.5, h * 0.07, size, 'center', c.accent2);
  // The beam, lamp to screen: the same faint band everywhere until the answer is in; then each
  // stretch develops to its own strength through the matte, on a roll of its own, blinking on.
  const band = h * 0.07;
  const stops = [w * 0.07, w * 0.3, w * 0.5, w * 0.7, w * 0.9];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = env.alpha(c.accent2, 0.08);
    g.fillRect(stops[i], y - band / 2, stops[i + 1] - stops[i], band);
    if (light === null) continue;
    const strength = i === 0 ? 1 : i === 1 ? 0.5 : i === 2 ? 0.5 * cos2(s.order[0] - s.order[1]) : light;
    const own = rite.at(0xb3a + i);
    const k = own.stair(openP);
    if (k <= 0 || !own.flicker(openP)) continue;
    g.fillStyle = env.alpha(c.accent2, 0.04 + strength * 0.3);
    if (k >= 1) g.fillRect(stops[i], y - band / 2, stops[i + 1] - stops[i], band);
    else develop(g, rite, stops[i], y - band / 2, stops[i + 1] - stops[i], band, k, null, Math.max(rite.cell, Math.ceil(band / 8)));
  }
  lamp(g, env, w * 0.07, y, Math.min(w, h) * 0.1 * v.scale, breath(rite.at(0x1a4), t, 6, v.turn));
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + i * 0.2);
    // A filter put in a new place turns to its angle in the ratchet's clicks, with the backlash,
    // on a roll of its own; the chip behind a named filter develops through the matte.
    const plate = rite.at(0xf11 + i);
    const angle = s.from[i] + turnBetween(s.from[i], s.order[i]) * plate.ratchet(orderP);
    // The angle written under a plate that is changing: the old one blinks out, the new blinks on.
    const written = plate.flicker(orderP) ? s.order[i] : plate.flicker(1 - orderP) ? s.from[i] : null;
    const named = s.named === s.order[i];
    const own = rite.at(0xc4e + i);
    const chip = named ? own.stair(namedP) : 0;
    const lit = named && chip > 0 && own.flicker(namedP);
    filterPlate(g, env, x, y, radius, angle, v, lit ? c.accent2 : c.fg);
    if (lit) {
      g.fillStyle = env.alpha(c.accent2, 0.22);
      const chipW = size * 3.2;
      const chipH = size * 1.5;
      if (chip >= 1) g.fillRect(x - chipW / 2, y + radius + size * 1.1 - chipH / 2, chipW, chipH);
      else develop(g, rite, x - chipW / 2, y + radius + size * 1.1 - chipH / 2, chipW, chipH, chip, null, rite.cell);
    }
    if (written !== null) label(g, env, Math.round(written) + '°', x, y + radius + size * 1.1, size, 'center', lit ? c.accent2 : c.fg);
  }
  // The screen: unread until the order is found; then the light comes onto it through the matte.
  const screenX = w * 0.9;
  const screenH = h * 0.24;
  g.fillStyle = env.mix(c.bg, c.bg2, 0.5);
  g.fillRect(screenX, y - screenH / 2, w * 0.03, screenH);
  const screenOwn = rite.at(0x5c2);
  const screenK = light === null ? 0 : screenOwn.stair(openP);
  const screenOn = screenK > 0 && screenOwn.flicker(openP);
  if (screenOn) {
    g.fillStyle = env.mix(c.bg, c.accent2, Math.min(1, Math.sqrt(light) * 1.4));
    if (screenK >= 1) g.fillRect(screenX, y - screenH / 2, w * 0.03, screenH);
    else develop(g, rite, screenX, y - screenH / 2, w * 0.03, screenH, screenK, null, rite.cell);
  }
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(screenX, y - screenH / 2, w * 0.03, screenH);
  label(g, env, screenOn ? Math.round(light * 1000) / 10 + '%' : '?', screenX + w * 0.015, y + screenH / 2 + size, size, 'center', c.accent2);
  // The visitor's guess at the light: a bar beside the screen to the height of it, which climbs
  // the stair from where the last guess stood and develops through the matte as it goes.
  if (s.guess !== null && !screenOn) {
    const own = rite.at(0x2d9);
    const p = came(s, s.guessAt, 0.9, reduced);
    const to = clamp(s.guess, 0, 100) / 100;
    const at = s.guessFrom + (to - s.guessFrom) * rite.stair(p);
    const barW = w * 0.012;
    const barX = screenX + w * 0.03 + w * 0.008;
    const barH = screenH * at;
    g.fillStyle = env.alpha(c.accent, 0.75);
    const k = own.stair(p);
    // The bar's frame blinks on with the first guess and holds; the bar itself develops inside it.
    if (own.flicker(p)) {
      if (barH > 0) {
        if (k >= 1) g.fillRect(barX, y + screenH / 2 - barH, barW, barH);
        else develop(g, rite, barX, y + screenH / 2 - barH, barW, barH, k, null, rite.cell);
      }
      g.strokeStyle = env.alpha(c.accent, 0.5);
      g.lineWidth = 1;
      g.strokeRect(barX, y - screenH / 2, barW, screenH);
    }
  }
  label(g, env, 'lamp side', w * 0.3, y - radius - size * 1.2, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  label(g, env, 'screen side', w * 0.7, y - radius - size * 1.2, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  // The table of cos squared, so the arithmetic is on the table.
  const rowY = h * 0.66;
  const tiny = fitted(g, Math.max(8, size - 1), 'each one after passes cos² of the turn from the one before', w * 0.9);
  label(g, env, 'the first filter passes half the lamp\'s light', w * 0.5, rowY, tiny, 'center', env.alpha(c.fg, 0.9));
  label(g, env, 'each one after passes cos² of the turn from the one before', w * 0.5, rowY + tiny * 1.4, tiny, 'center', env.alpha(c.fg, 0.9));
  const pairs = [[0, '1'], [15, '0.93'], [30, '0.75'], [45, '0.50'], [60, '0.25'], [75, '0.07'], [90, '0']];
  pairs.forEach((pair, i) => {
    const x = w * (0.08 + (i + 0.5) * 0.12);
    label(g, env, pair[0] + '°', x, rowY + tiny * 3.3, tiny, 'center', c.accent2);
    label(g, env, pair[1], x, rowY + tiny * 4.6, tiny, 'center', c.fg);
  });
  label(g, env, 'past 90°, read 180° less the turn: 120° as 60°, 135° as 45°, 150° as 30°', w * 0.5, rowY + tiny * 6.4, tiny, 'center', env.alpha(c.muted, 0.9));
  // The screen lit: the light comes over the table through the matte.
  if (s.open) daybreak(g, rite, env, w, h, openP);
}

function filterPreview(g, w, h, env, plan) {
  drawFilters(g, w, h, env, plan, filterState(plan.start), env.variant);
}

function filterPiece(env, plan) {
  const { helps, margin } = asked(env);
  const best = bestOf(plan.angles);
  const s = filterState(plan.start);
  const draw = (c) => drawFilters(c.g, c.w, c.h, c, plan, s, env.variant);
  // The order on the table changes: every plate turns from where it stands now to its new angle.
  const reorder = (order, c) => {
    const rite = riteOf(c);
    const p = came(s, s.orderAt, 1.3, !!c.reduced);
    s.from = s.order.map((to, i) => s.from[i] + turnBetween(s.from[i], to) * rite.at(0xf11 + i).ratchet(p));
    s.order = order.slice();
    s.orderAt = s.t;
    // A named filter carried to another place: its chip develops afresh where it now stands.
    if (s.named !== null) s.namedAt = s.t;
  };
  return {
    title: filterTitle(plan),
    brief: 'Three polarising filters, at ' + plan.angles.join(', ') + ' degrees, stand in a line between the lamp and the screen. The first one the light meets passes half of it whatever its angle; each one after passes cos² of the angle between it and the one before, and the table under the lamp has the values.',
    goal: 'Put the filters in the order that passes the most light, and say how much gets through.',
    aspect: '4 / 3',
    checkLabel: 'check the table',
    steps: [
      { id: 'order', ask: 'the filters, lamp side first', kind: 'order', items: plan.angles.map((a) => ({ label: 'the ' + a + '° filter', value: a })), value: plan.start.slice() },
      { id: 'passes', ask: 'how much of the lamp\'s light gets through, to the nearest five per cent', kind: 'number', min: 0, max: 100, step: 5, unit: '%' },
      // One thing to say, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'hint', ask: 'which filter goes in the middle', kind: 'press', count: 1, label: 'name the middle one', optional: true } : null
    ].filter(Boolean),
    solution: { order: best.order.slice(), passes: best.percent },
    check(c) {
      const order = c.value('order');
      const orderRight = isOrder(order, plan.angles) && order[1] === best.middle;
      // A reading to the nearest five per cent: the difficulty says how many of those steps out
      // it may be.
      const passRight = Math.abs(Number(c.value('passes')) - best.percent) <= margin * 5;
      if (orderRight && passRight) return { solved: true, say: 'the screen lights: with the ' + best.middle + '° filter in the middle, ' + Math.round(best.exact * 10) / 10 + '% of the light reaches the screen' };
      if (!orderRight && !passRight) return { solved: false, say: 'the screen stays dark: the order and the percentage are both off' };
      return { solved: false, say: orderRight ? 'the order is right; the percentage is off' : 'the percentage is right; the order is off' };
    },
    start(c) {
      c.status('the screen stays unread until the order is found');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isOrder(value, plan.angles)) {
        if (value.some((a, i) => a !== s.order[i])) reorder(value, c);
        c.status('lamp, then ' + s.order.join('°, ') + '°, then the screen');
      }
      if (id === 'passes') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) {
          c.status(clamp(n, 0, 100) + '% gets through, you say');
          if (s.guess !== n) {
            const p = came(s, s.guessAt, 0.9, !!c.reduced);
            const was = s.guess === null ? 0 : clamp(s.guess, 0, 100) / 100;
            s.guessFrom = s.guessFrom + (was - s.guessFrom) * riteOf(c).stair(p);
            s.guess = n;
            s.guessAt = s.t;
          }
        }
      }
      if (id === 'hint') {
        if (s.named === null) {
          s.named = best.middle;
          s.namedAt = s.t;
          c.hint();
          c.status('the ' + best.middle + '° filter goes in the middle');
        } else {
          c.status('the middle one is named; the ends can go either way round');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t = t;
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      if (best.order.some((a, i) => a !== s.order[i])) reorder(best.order, c);
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
        text: 'Three polarising filters, one lamp, one screen. Find the order that passes the most light, and how much that is.',
        mono: plan.angles.map((a) => a + '°').join(' / '),
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => filterPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = slitPlan(env);
    return {
      title: slitTitle(plan),
      text: 'A lamp lit on purpose: fringes on a screen, a ruler beside them, the wavelength and distance written on the table. Find how far apart the slits are.',
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
