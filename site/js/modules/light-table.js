/* The light table: slits, polarising filters, or six coloured lamps whose light adds under a
   prism. Each puzzle puts its measurements on the table. As a card it is one of these three
   puzzles, drawn as it stands (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece
   is.

   Three puzzles, each deduction with a little arithmetic:

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
     the spectrum key Six lamps each show their red, green and blue strengths and their power.
                        Choose two whose light adds to the three bars of a target, then add
                        their power readings. Selecting lamps lights a comparison on the table.

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
   js/stage.js, "The rite"): one clean edge -- a slice at an angle or a curve round a corner, the
   piece's signature -- and the few treads every change climbs, always forward. Nothing on the
   table moves along a formula, and nothing moves without a reason:

     at rest         the table is waiting, so nothing on it moves: the lamp burns at one size, the
                     wavefronts lie where they leave the slits and the dust lies where it fell. A
                     frame with nothing new in it is not drawn at all (settled, below).
     a filter moved  turns to its new angle in rite.stair's even treads after a hold, and the
                     angle written under it is cut over to the new one at its moment (rite.flicker).
     a thing said    -- an answer read, a guess at the spacing written -- is cut on at its moment
                     in place of what stood there; a guess at the light raises or lowers its bar
                     in rite.stair's treads from where the last guess left it.
     a thing shown   -- the prediction's ghost screen, the guess bar's frame, the beam once the
                     order is found, the screen lit, the fringes burning brighter, the chip behind
                     a named filter, the light over a solved table -- is cut in behind the piece's
                     edge as its stair climbs: one path filled (rite.paint) or one clip drawn
                     through (rite.region), never a fade and never cells. A new prediction is cut
                     in over the old one by the same edge. A mark of state (the chip, the light
                     over the table) rests as two shades of its colour split by that edge through
                     its middle; a thing whose shade is a reading (the beam, the screen, the
                     fringes) rests at that shade.
     a thing done    -- the ghost screen and the guess bar once the table has its answer, the chip
                     where a named filter stood before it was moved -- is cut away behind the same
                     edge on a roll of its own, one way: drawn through the part of its box the
                     edge has not reached yet, until there is none.

   Every change is read against the piece's own clock, s.t, which frame() advances: a change made
   at `since` has come came() of its way, which is 1 at once for a visitor who asked for less
   motion, and for whatever stood there from the start (since < 0). Each band, plate or chip steps
   on a roll of its own, rolled again each time it moves (roll, below), so no two step together and
   no move steps like the one before it. */

// The rite of a piece handed none (no env builder does this; a guard): every change already made,
// so a plate turned to a new place is at that place, and a surface cut by a plain upright slice
// from its left side.
const STILL = {
  stair: () => 1, flicker: () => 1, treads: 1, kind: 'slice', angle: 90,
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w * Math.min(1, k), h);
  },
  paint(g, x, y, w, h, k, style) {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w * Math.min(1, k), h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The roll for the n-th time a thing moves: its own seed crossed with the count, so no two moves of
// one thing step alike while the same seed still plays the same piece, every roll keeping the
// piece's edge. Kept with the rite it was rolled from, so a frame reuses a roll rather than making
// it afresh thirty times a second.
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

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// The longest any change on the table takes to come the whole of its way, in seconds.
const LONGEST = 1.8;

function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1);
}

// Whether a frame has nothing to draw: the canvas holds a picture drawn at this size, and that
// picture was drawn once the latest change (made at `last`) had come the whole of its way -- at
// once for a visitor who asked for less motion, and for a table with no change made yet (last <
// 0). The table at rest stands still, so drawing it again would spend a frame on nothing a
// visitor could see; a new size (the stage clears the canvas to resize it) or a new change draws
// again. It is when the picture was drawn that is read, not the clock alone: the stage asks for
// no frames while the scene is out of sight, so a change made then, or one the scroll cut off
// half way, is still owed its finished picture, and the first frame back draws it.
function settled(s, c, last, reduced) {
  if (s.drawn !== sizeOf(c)) return false;
  return s.drawnAt >= (reduced || last < 0 ? last : last + LONGEST + 0.05);
}

// One frame: drawn unless it is settled, and answering whether anything is still on its way once
// it has been -- false when the table is at rest, which tells the stage to ask for no frame until a
// knob, a tap, a check, a new size or the scene coming back into view. The piece's clock is its
// own, advanced by the frames it is given and standing still while none come, so a change made
// after a rest is timed from where the clock stood and plays its whole way.
function step(s, c, last, draw) {
  if (!settled(s, c, last, !!c.reduced)) draw(c);
  return !settled(s, c, last, !!c.reduced);
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes, and at rest it is two shades of one colour split by that
// edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// One drawing giving way to another behind the piece's edge, `k` of the way: `after` (if there is
// one) drawn whole through the part of the box the edge has passed, `before` (if there is one)
// through the rest. With no `after` it is a leaving: `before` cut away by the edge, one way. One
// edge between them and one clip each, never cells.
function wipe(g, rite, x, y, w, h, k, before, after) {
  if (k < 1 && before) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    if (k > 0) rite.region(g, x, y, w, h, k);
    g.clip('evenodd');
    before();
    g.restore();
  }
  if (k <= 0 || !after) return;
  if (k >= 1) {
    after();
    return;
  }
  g.save();
  g.beginPath();
  rite.region(g, x, y, w, h, k);
  g.clip();
  after();
  g.restore();
}

// The light that comes over a solved table: cut in behind the piece's edge on its stair from the
// moment the piece was solved, and resting in two shades.
function daybreak(g, rite, env, w, h, p) {
  const k = rite.stair(p);
  if (k <= 0) return;
  g.fillStyle = env.alpha(env.colors.accent2, 0.09);
  cover(g, rite, 0, 0, w, h, k);
}

/* ---- shared drawing ------------------------------------------------------------------------- */

function background(g, w, h, env) {
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

// Dust on the table: a few specks where the configuration's turn put them, as many as its density
// asks. They lie still: nothing in them waits for anything, so nothing in them moves.
function dust(g, w, h, env, v) {
  g.fillStyle = env.alpha(env.colors.fg, 0.12);
  for (let i = 0, count = Math.max(6, Math.round(20 * v.density)); i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.3) % 1) * w, ((i * 0.7548777 + v.turn * 0.17) % 1) * h, 1, 1);
  }
}

// The lamp: its glow and its flame. It burns at one size, as a lamp lit on purpose does.
function lamp(g, env, x, y, radius) {
  const r = radius;
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
// every change timed against the piece's clock from here on (-1 is "there from the start"). `was`
// is what stood before the latest change -- the guess the mask said, the prediction on the ghost
// screen -- shown until the new one is cut in over it, and the counts roll each move afresh.
function slitState() {
  return {
    open: false, t: 0, openAt: -1, guess: null, guessWas: null, guessAt: -1, guesses: 0,
    effect: null, effectWas: null, effectAt: -1, effects: 0, measured: 0, measuredAt: -1, drawn: null, drawnAt: -1
  };
}

// The guess the mask says it has: the new one once its moment has come, the one before it until
// then, so a guess is cut over to the next and never blinks out between them.
function saidGuess(s, rite, reduced) {
  if (s.guessAt < 0) return s.guess;
  return roll(rite, 0x9e5, s.guesses).flicker(came(s, s.guessAt, 0.9, reduced)) ? s.guess : s.guessWas;
}

// How far the latest prediction has been cut in over the ghost screen, 0 to 1.
function effectCut(s, rite, reduced) {
  return roll(rite, 0x3c7, s.effects).stair(came(s, s.effectAt, 1.4, reduced));
}

// How many stops the fringes' gradient takes: eight or more to every fringe even when a
// prediction packs them, which is finer than the eye parts on a strip this narrow.
const FRINGE_STOPS = 120;

// The gradients already made, kept per canvas by what they were made for: the real screen's
// fringes never change at a size and a ghost's only when its prediction does, so a frame that
// draws them again reuses the gradient rather than working out its stops afresh.
const STRIPS = new WeakMap();

// The fringes a spacing makes, down a strip: cos squared of the height over the fringe spacing,
// under a soft envelope, painted as one gradient down the strip -- one fill, however many fringes.
function fringes(g, env, x, top, width, height, reach, fringe, strength) {
  const c = env.colors;
  const key = top + '|' + height + '|' + reach + '|' + fringe + '|' + strength + '|' + c.accent2;
  let kept = STRIPS.get(g);
  if (!kept) {
    kept = new Map();
    STRIPS.set(g, kept);
  }
  let strip = kept.get(key);
  if (!strip) {
    const value = (mm) => Math.exp(-0.9 * (mm / reach) ** 2) * Math.cos((Math.PI * mm) / fringe) ** 2;
    strip = g.createLinearGradient(0, top, 0, top + height);
    for (let i = 0; i <= FRINGE_STOPS; i++) {
      const mm = (i / FRINGE_STOPS - 0.5) * reach * 2;
      strip.addColorStop(i / FRINGE_STOPS, env.alpha(c.accent2, 0.03 + value(mm) * strength));
    }
    if (kept.size > 11) kept.clear();
    kept.set(key, strip);
  }
  g.fillStyle = strip;
  g.fillRect(x, top, width, height);
}

// `s`: whether the answer is in (the spacing written on the mask), the guess and the prediction
// the visitor has made, and the clock.
function drawSlits(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = slitGeometry(w, h);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const reach = reachOf(plan);
  const screenH = geo.bottom - geo.top;
  const perMm = screenH / (reach * 2);
  const openP = s.open ? came(s, s.openAt, 1.8, reduced) : 0;
  background(g, w, h, env);
  dust(g, w, h, env, v);
  // The lamp and its wavelength.
  const sourceX = geo.sourceX + (v.turn - 0.5) * w * 0.03;
  lamp(g, env, sourceX, geo.middle, Math.min(w, h) * 0.11 * v.scale);
  label(g, env, plan.lambda + ' nm', sourceX, geo.middle + Math.min(w, h) * 0.12, size, 'center', c.accent2);
  // The mask with its two slits, and the wavefronts that leave them: a ring every ringStep, the
  // first set off from the slit by the configuration's turn, lying where they fall.
  const gap = Math.max(6, h * 0.05);
  const openings = [geo.middle - gap / 2, geo.middle + gap / 2];
  const ringStep = Math.max(8, (geo.screenX - geo.maskX) / (6 * v.density) / v.scale);
  openings.forEach((y) => {
    g.strokeStyle = env.alpha(c.accent2, 0.3);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sourceX, geo.middle);
    g.lineTo(geo.maskX, y);
    g.stroke();
    for (let r = v.turn * ringStep; r < geo.screenX - geo.maskX; r += ringStep) {
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
  // What the mask says of its spacing: the answer is cut on at its moment once it is read; before
  // that, the visitor's guess as a question of its own, each new guess cut over the last at its
  // moment, and a question mark until there is one.
  const answered = s.open && rite.flicker(openP);
  const guessed = answered ? null : saidGuess(s, rite, reduced);
  const said = answered ? (plan.spacing / 100).toFixed(2) + ' mm' : guessed !== null ? (clamp(guessed, 10, 100) / 100).toFixed(2) + ' mm?' : '?';
  label(g, env, 'd ' + said, geo.maskX, geo.top - size * 0.9, size, 'center', guessed !== null ? c.accent : c.accent2);
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
  fringes(g, env, geo.screenX, geo.top, geo.screenW, screenH, reach, plan.fringe, 0.75);
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(geo.screenX, geo.top, geo.screenW, screenH);
  // The prediction: a ghost of a screen in a frame beside the real one, the fringes as the visitor
  // says the change would leave them -- spread, packed or the same -- cut in, frame and all, behind
  // the piece's edge from the moment the choice was made, and cut in over the last one by the same
  // edge when the choice changes, so it is never empty between them. Its word is cut over at the
  // edge's first tread. Once the table is read true the prediction has had its answer: the ghost is
  // cut away behind an edge of its own, and its word goes at that edge's first tread.
  if (s.effect !== null) {
    const ghostW = geo.screenW * 0.5;
    const ghostX = geo.screenX - ghostW - w * 0.018;
    const ghost = (effect) => () => {
      const factor = effect === 'spread' ? 1.4 : effect === 'pack' ? 0.7 : 1;
      g.fillStyle = env.alpha(env.mix(c.bg, c.bg2, 0.5), 0.6);
      g.fillRect(ghostX, geo.top, ghostW, screenH);
      fringes(g, env, ghostX, geo.top, ghostW, screenH, reach, plan.fringe * factor, 0.45);
      g.strokeStyle = env.alpha(c.accent, 0.55);
      g.lineWidth = 1;
      g.strokeRect(ghostX, geo.top, ghostW, screenH);
    };
    // The box the edges cross, a pixel over the frame so its line goes with the screen it frames.
    const bx = ghostX - 1;
    const by = geo.top - 1;
    const bw = ghostW + 2;
    const bh = screenH + 2;
    const k = effectCut(s, rite, reduced);
    const standing = () => wipe(g, roll(rite, 0x3c7, s.effects), bx, by, bw, bh, k, s.effectWas === null ? null : ghost(s.effectWas), ghost(s.effect));
    const away = roll(rite, 0x3c8, 0);
    const gone = s.open ? away.stair(openP) : 0;
    if (gone > 0) wipe(g, away, bx, by, bw, bh, gone, standing, null);
    else standing();
    const shown = k > 0 ? s.effect : s.effectWas;
    if (shown !== null && gone <= 0) label(g, env, shown === 'same' ? 'as is' : shown, ghostX + ghostW / 2, geo.top - size * 0.9, Math.max(8, size - 2), 'center', c.accent);
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
  // The reading asked of the ruler: a bracket from the middle bright fringe to the next, drawn out
  // along the screen in the stair's treads from the moment it was asked, and named once it lands.
  if (s.measured > 0) {
    const k = roll(rite, 0x6e1, 0).stair(came(s, s.measuredAt, 1.1, reduced));
    if (k > 0) {
      const mx = geo.screenX - w * 0.006;
      const y1 = geo.middle - plan.fringe * perMm;
      g.strokeStyle = env.alpha(c.accent2, 0.9);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(mx - w * 0.006, geo.middle);
      g.lineTo(mx, geo.middle);
      g.lineTo(mx, geo.middle + (y1 - geo.middle) * k);
      if (k >= 1) g.lineTo(mx - w * 0.006, y1);
      g.stroke();
      if (k >= 1) label(g, env, plan.fringe + ' mm', geo.screenX + geo.screenW / 2, y1 - size * 0.8, Math.max(8, size - 2), 'center', c.accent2);
    }
  }
  // The table read true: the light comes over it behind the piece's edge, and the fringes burn
  // brighter behind an edge of their own, both on their stairs.
  if (s.open) {
    daybreak(g, rite, env, w, h, openP);
    const own = roll(rite, 0x7a2, 0);
    wipe(g, own, geo.screenX, geo.top, geo.screenW, screenH, own.stair(openP), null,
      () => fringes(g, env, geo.screenX, geo.top, geo.screenW, screenH, reach, plan.fringe, 0.5));
  }
}

function slitPreview(g, w, h, env, plan) {
  drawSlits(g, w, h, env, Object.assign({ spacing: spacingOf(plan.lambda, plan.length, plan.fringe) }, plan), slitState(), env.variant);
}

function slitPiece(env, plan) {
  // The spacing is read off a ruler, so it is a measured answer: the difficulty says how many
  // hundredths of a millimetre out it may be and still be on the mark.
  const { helps, margin } = asked(env);
  const spacing = spacingOf(plan.lambda, plan.length, plan.fringe);
  const full = Object.assign({ spacing }, plan);
  const change = CHANGES[plan.ask];
  const s = slitState();
  const draw = (c) => {
    drawSlits(c.g, c.w, c.h, c, full, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnAt = s.t;
  };
  return {
    title: slitTitle(plan),
    brief: 'A lamp lit on purpose: light of wavelength ' + plan.lambda + ' nm passes two slits and lands on a screen ' + plan.length + ' mm away as bright and dark fringes. Neighbouring bright fringes are a wavelength times the distance, over the slit spacing, apart; the ruler beside the screen is in millimetres.',
    goal: 'Find the slit spacing, and say what ' + change.what + ' would do to the fringes.',
    aspect: '4 / 3',
    checkLabel: 'check the table',
    steps: [
      { id: 'spacing', ask: 'the slit spacing, in hundredths of a millimetre', kind: 'number', min: 10, max: 100, step: 1, unit: '/100 mm' },
      { id: 'change', ask: 'what ' + change.what + ' does to the fringes', kind: 'choice', options: EFFECTS },
      // A reading off the ruler, at a price: first the fringe spacing itself, then what the spacing
      // the visitor has guessed would throw on the screen, never the answer.
      { id: 'measure', ask: 'a reading off the ruler', kind: 'press', count: helps, label: 'measure for me', optional: true }
    ],
    solution: { spacing, change: change.does },
    check(c) {
      const guess = Number(c.value('spacing'));
      const spacingRight = Math.abs(guess - spacing) <= margin;
      const changeRight = c.value('change') === change.does;
      if (spacingRight && changeRight) return { solved: true, say: 'the table reads true: the slits are ' + (spacing / 100).toFixed(2) + ' mm apart, and ' + change.what + ' ' + EFFECTS.find((e) => e.value === change.does).label.replace('them', 'the fringes') };
      const near = Number.isFinite(guess) && Math.abs(guess - spacing) <= spacing * 0.1;
      const spacingWord = spacingRight ? 'the spacing is right'
        : near ? 'the spacing is close but not on the mark'
        : !Number.isFinite(guess) ? 'the spacing is off'
        : guess > spacing ? 'the spacing is off: slits that far apart would pack the fringes tighter than the ruler shows'
        : 'the spacing is off: slits that close together would spread the fringes wider than the ruler shows';
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
            // The new guess is cut over whatever the mask says now.
            s.guessWas = saidGuess(s, riteOf(c), !!c.reduced);
            s.guess = n;
            s.guessAt = s.t;
            s.guesses += 1;
          }
        }
      }
      if (id === 'measure') {
        if (s.measured >= helps) c.status('the ruler has said all it will at this difficulty; the rest is yours to read');
        else if (s.measured === 0) {
          s.measured = 1;
          s.measuredAt = s.t;
          c.hint();
          c.status('the ruler reads: neighbouring bright fringes fall ' + plan.fringe + ' mm apart');
        } else if (s.guess === null) c.status('set a spacing first, and the ruler will say what fringes slits that far apart would throw');
        else {
          s.measured += 1;
          c.hint();
          const d = clamp(s.guess, 10, 100);
          const would = Math.round((plan.lambda * plan.length) / (d * 10000) * 100) / 100;
          c.status('slits ' + (d / 100).toFixed(2) + ' mm apart would throw fringes ' + would + ' mm apart; the ruler shows ' + plan.fringe + ' mm');
        }
      }
      if (id === 'change') {
        const effect = EFFECTS.find((e) => e.value === value);
        if (effect) {
          c.status(change.what + ' ' + effect.label.replace('them', 'the fringes') + ', you say');
          if (s.effect !== effect.value) {
            // The new prediction is cut in over whichever the ghost screen shows now.
            s.effectWas = effectCut(s, riteOf(c), !!c.reduced) > 0 ? s.effect : s.effectWas;
            s.effect = effect.value;
            s.effectAt = s.t;
            s.effects += 1;
          }
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      return step(s, c, Math.max(s.openAt, s.guessAt, s.effectAt, s.measuredAt), draw);
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
// change timed against the piece's clock from here on (-1 is "there from the start"); the counts
// roll each move afresh. `namedSlot` is the place the named filter's chip stands in, and
// `chipsGone` the places it has been carried away from, each cut away from where it stood
// (`slot`, as far in as it had come, `had`, on the roll of its count, `n`, from the time `at`).
// `barAt` is when the first guess brought the guess bar's frame in.
function filterState(order) {
  return {
    order: order.slice(), from: order.slice(), orderAt: -1, orders: 0,
    named: null, namedSlot: -1, namedAt: -1, namings: 0, chipsGone: [],
    open: false, openAt: -1, guess: null, guessFrom: 0, guessAt: -1, guesses: 0, barAt: -1,
    t: 0, drawn: null, drawnAt: -1
  };
}

// The box of the chip behind the angle written under a plate at (x, y): x, y, width, height.
function chipBox(x, y, radius, size) {
  const chipW = size * 3.2;
  const chipH = size * 1.5;
  return [x - chipW / 2, y + radius + size * 1.1 - chipH / 2, chipW, chipH];
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
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const y = h * 0.36;
  const radius = Math.min(w * 0.07, h * 0.12) * v.scale;
  const best = bestOf(plan.angles);
  const light = s.open && best ? best.exact / 100 : null;
  const openP = s.open ? came(s, s.openAt, 1.8, reduced) : 0;
  const orderP = came(s, s.orderAt, 1.3, reduced);
  const namedP = s.named !== null ? came(s, s.namedAt, 1.1, reduced) : 0;
  background(g, w, h, env);
  dust(g, w, h, env, v);
  label(g, env, 'filter set ' + plan.number, w * 0.5, h * 0.07, size, 'center', c.accent2);
  // The beam, lamp to screen: the same faint band everywhere until the answer is in; then each
  // stretch is cut in to its own strength behind the piece's edge, on a roll of its own, and
  // rests at that strength, because how bright it is is how much light the filters pass.
  const band = h * 0.07;
  const stops = [w * 0.07, w * 0.3, w * 0.5, w * 0.7, w * 0.9];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = env.alpha(c.accent2, 0.08);
    g.fillRect(stops[i], y - band / 2, stops[i + 1] - stops[i], band);
    if (light === null) continue;
    const strength = i === 0 ? 1 : i === 1 ? 0.5 : i === 2 ? 0.5 * cos2(s.order[0] - s.order[1]) : light;
    const own = roll(rite, 0xb3a + i, 0);
    own.paint(g, stops[i], y - band / 2, stops[i + 1] - stops[i], band, own.stair(openP), env.alpha(c.accent2, 0.04 + strength * 0.3));
  }
  lamp(g, env, w * 0.07, y, Math.min(w, h) * 0.1 * v.scale);
  const chipTone = env.alpha(c.accent2, 0.13);
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + i * 0.2);
    // A filter put in a new place turns to its angle in the stair's even treads after a hold, on a
    // roll of its own for this move, and the angle written under it is cut over to the new one at
    // its moment. The chip behind a named filter is cut in behind the piece's edge where the
    // filter stands and rests in two shades; when the filter is carried to another place, the
    // chip is cut away from the old one behind an edge of its own as it is cut in at the new. The
    // plate's ring and angle are lit while any of a chip is behind them.
    const plate = roll(rite, 0xf11 + i, s.orders);
    const angle = s.from[i] + turnBetween(s.from[i], s.order[i]) * plate.stair(orderP);
    const written = plate.flicker(orderP) ? s.order[i] : s.from[i];
    const box = chipBox(x, y, radius, size);
    const own = roll(rite, 0xc4e + i, s.namings);
    const chip = s.namedSlot === i ? own.stair(namedP) : 0;
    const leaving = s.chipsGone.filter((gone) => gone.slot === i && gone.had > 0)
      .map((gone) => ({ gone, k: roll(rite, 0xd5f + i, gone.n).stair(came(s, gone.at, 1.1, reduced)) }))
      .filter((left) => left.k < 1);
    const lit = chip > 0 || leaving.length > 0;
    filterPlate(g, env, x, y, radius, angle, v, lit ? c.accent2 : c.fg);
    leaving.forEach((left) => {
      wipe(g, roll(rite, 0xd5f + i, left.gone.n), box[0], box[1], box[2], box[3], left.k, () => {
        g.fillStyle = chipTone;
        cover(g, roll(rite, 0xc4e + i, left.gone.n), box[0], box[1], box[2], box[3], left.gone.had);
      }, null);
    });
    if (chip > 0) {
      g.fillStyle = chipTone;
      cover(g, own, box[0], box[1], box[2], box[3], chip);
    }
    label(g, env, Math.round(written) + '°', x, y + radius + size * 1.1, size, 'center', lit ? c.accent2 : c.fg);
  }
  // The screen: unread until the order is found; then the light is cut onto it behind the
  // piece's edge, and it rests at the shade of the light that reaches it.
  const screenX = w * 0.9;
  const screenH = h * 0.24;
  g.fillStyle = env.mix(c.bg, c.bg2, 0.5);
  g.fillRect(screenX, y - screenH / 2, w * 0.03, screenH);
  const screenOwn = roll(rite, 0x5c2, 0);
  const screenK = light === null ? 0 : screenOwn.stair(openP);
  const screenOn = screenK > 0;
  if (screenOn) screenOwn.paint(g, screenX, y - screenH / 2, w * 0.03, screenH, screenK, env.mix(c.bg, c.accent2, Math.min(1, Math.sqrt(light) * 1.4)));
  g.strokeStyle = env.alpha(c.fg, 0.65);
  g.lineWidth = 1.2;
  g.strokeRect(screenX, y - screenH / 2, w * 0.03, screenH);
  label(g, env, screenOn ? Math.round(light * 1000) / 10 + '%' : '?', screenX + w * 0.015, y + screenH / 2 + size, size, 'center', c.accent2);
  // The visitor's guess at the light: a bar in a frame beside the screen, to the height of the
  // guess, which climbs or drops the stair from where the last guess left it -- from nothing, the
  // first time -- on a roll of its own for each guess. The first guess brings the frame in with
  // it, behind the piece's edge on that guess's own stair. Once the screen is lit the guess has
  // had its answer, and the bar and its frame are cut away behind an edge of their own.
  if (s.guess !== null) {
    const to = clamp(s.guess, 0, 100) / 100;
    const at = s.guessFrom + (to - s.guessFrom) * roll(rite, 0x2d9, s.guesses).stair(came(s, s.guessAt, 0.9, reduced));
    const barW = w * 0.012;
    const barX = screenX + w * 0.03 + w * 0.008;
    const barH = screenH * at;
    const bar = () => {
      if (barH > 0) {
        g.fillStyle = env.alpha(c.accent, 0.75);
        g.fillRect(barX, y + screenH / 2 - barH, barW, barH);
      }
      g.strokeStyle = env.alpha(c.accent, 0.5);
      g.lineWidth = 1;
      g.strokeRect(barX, y - screenH / 2, barW, screenH);
    };
    // The box the edges cross, a pixel over the frame so its line goes with the bar.
    const bx = barX - 1;
    const by = y - screenH / 2 - 1;
    const bw = barW + 2;
    const bh = screenH + 2;
    const first = roll(rite, 0x2d9, 1);
    const standing = () => wipe(g, first, bx, by, bw, bh, first.stair(came(s, s.barAt, 0.9, reduced)), null, bar);
    const away = roll(rite, 0x2da, 0);
    const gone = light === null ? 0 : away.stair(openP);
    if (gone > 0) wipe(g, away, bx, by, bw, bh, gone, standing, null);
    else standing();
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
  // The screen lit: the light comes over the table behind the piece's edge.
  if (s.open) daybreak(g, rite, env, w, h, openP);
}

function filterPreview(g, w, h, env, plan) {
  drawFilters(g, w, h, env, plan, filterState(plan.start), env.variant);
}

function filterPiece(env, plan) {
  const { helps, margin } = asked(env);
  const best = bestOf(plan.angles);
  const s = filterState(plan.start);
  const draw = (c) => {
    drawFilters(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnAt = s.t;
  };
  // The order on the table changes: every plate turns from where it stands now to its new angle,
  // on a fresh roll.
  const reorder = (order, c) => {
    const rite = riteOf(c);
    const reduced = !!c.reduced;
    const p = came(s, s.orderAt, 1.3, reduced);
    s.from = s.order.map((to, i) => s.from[i] + turnBetween(s.from[i], to) * roll(rite, 0xf11 + i, s.orders).stair(p));
    s.order = order.slice();
    s.orderAt = s.t;
    s.orders += 1;
    // A named filter carried to another place: its chip is cut away from the place it leaves, as
    // far in as it had come, and cut in afresh where the filter now stands. One that stays where
    // it was keeps its chip.
    const slot = s.named === null ? -1 : s.order.indexOf(s.named);
    if (slot !== s.namedSlot) {
      const had = roll(rite, 0xc4e + s.namedSlot, s.namings).stair(came(s, s.namedAt, 1.1, reduced));
      s.chipsGone = s.chipsGone.filter((gone) => came(s, gone.at, 1.1, reduced) < 1);
      s.chipsGone.push({ slot: s.namedSlot, had, n: s.namings, at: s.t });
      s.namedSlot = slot;
      s.namedAt = s.t;
      s.namings += 1;
    }
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
      const stood = isOrder(order, plan.angles) && !orderRight ? Math.round(passes(order)) : null;
      const standing = stood === null ? '' : '; as they stand, the filters pass about ' + stood + '%';
      if (!orderRight && !passRight) return { solved: false, say: 'the screen stays dark: the order and the percentage are both off' + standing };
      return { solved: false, say: orderRight ? 'the order is right; the percentage is off' : 'the percentage is right; the order is off' + standing };
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
            // The bar moves on from wherever it stands now; the first guess brings its frame.
            const p = came(s, s.guessAt, 0.9, !!c.reduced);
            const was = s.guess === null ? 0 : clamp(s.guess, 0, 100) / 100;
            s.guessFrom = s.guessFrom + (was - s.guessFrom) * roll(riteOf(c), 0x2d9, s.guesses).stair(p);
            if (s.guess === null) s.barAt = s.t;
            s.guess = n;
            s.guessAt = s.t;
            s.guesses += 1;
          }
        }
      }
      if (id === 'hint') {
        if (s.named === null) {
          s.named = best.middle;
          s.namedSlot = s.order.indexOf(best.middle);
          s.namedAt = s.t;
          s.namings += 1;
          c.hint();
          c.status('the ' + best.middle + '° filter goes in the middle');
        } else {
          c.status('the middle one is named; the ends can go either way round');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      return step(s, c, Math.max(s.openAt, s.orderAt, s.namedAt, s.guessAt), draw);
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

/* ---- the spectrum key ----------------------------------------------------------------------- */

const SPECTRUM_LAMPS = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 1, 0], [0, 2, 1], [1, 0, 2]
];
const SPECTRUM_COLORS = ['#ff9d86', '#b5f4ad', '#a9c8ff'];
const LAMP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];

function spectrumSum(plan, names) {
  const sum = [0, 0, 0];
  for (const name of names) {
    const lamp = plan.lamps[LAMP_NAMES.indexOf(name)];
    if (lamp) for (let channel = 0; channel < 3; channel++) sum[channel] += lamp.bars[channel];
  }
  return sum;
}

function spectrumPlan(env) {
  const turn = env.int(0, 2);
  const lamps = SPECTRUM_LAMPS.map((bars) => ({
    bars: bars.map((_, channel) => bars[(channel + turn) % 3]),
    watts: env.int(2, 9)
  }));
  for (let i = lamps.length - 1; i > 0; i--) {
    const j = env.int(0, i);
    [lamps[i], lamps[j]] = [lamps[j], lamps[i]];
  }
  const first = env.int(0, 5);
  const other = env.int(0, 4);
  const second = other >= first ? other + 1 : other;
  return {
    kind: 'spectrum', number: env.int(100, 999), lamps,
    pair: [LAMP_NAMES[first], LAMP_NAMES[second]].sort()
  };
}

function carriedSpectrum(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'spectrum' || !Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Array.isArray(p.lamps) || p.lamps.length !== 6 || !p.lamps.every((lamp) =>
    lamp && Array.isArray(lamp.bars) && lamp.bars.length === 3 &&
    lamp.bars.every((n) => Number.isInteger(n) && n >= 0 && n <= 2) &&
    Number.isInteger(lamp.watts) && lamp.watts >= 2 && lamp.watts <= 9)) return null;
  if (!Array.isArray(p.pair) || p.pair.length !== 2 || p.pair[0] === p.pair[1] ||
    !p.pair.every((name) => LAMP_NAMES.includes(name))) return null;
  const lamps = p.lamps.map((lamp) => ({ bars: lamp.bars.slice(), watts: lamp.watts }));
  const plan = { kind: 'spectrum', number: p.number, lamps, pair: p.pair.slice() };
  const sums = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    sums.push(spectrumSum(plan, [LAMP_NAMES[i], LAMP_NAMES[j]]).join('/'));
  }
  return new Set(sums).size === sums.length ? plan : null;
}

function spectrumTitle(plan) {
  return 'lamp ' + plan.number + ': the spectrum key';
}

function spectrumState() {
  return {
    selected: [], from: [], changedAt: -1, moves: 0, looks: 0, lookAt: -1,
    open: false, openAt: -1, t: 0, drawn: null, drawnAt: -1
  };
}

function spectrumBars(g, env, x, y, width, height, bars, size) {
  const c = env.colors;
  g.fillStyle = env.mix(c.bg, c.bg2, 0.7);
  g.fillRect(x, y, width, height);
  for (let channel = 0; channel < 3; channel++) {
    const bx = x + channel * width / 3 + 2;
    const bw = width / 3 - 4;
    const value = bars ? bars[channel] : 0;
    if (value) {
      g.fillStyle = env.mix(c.bg, SPECTRUM_COLORS[channel], 0.85);
      g.fillRect(bx, y + height * (1 - value / 4), bw, height * value / 4);
    }
    label(g, env, ['R', 'G', 'B'][channel] + (bars ? value : '?'), bx + bw / 2,
      y + height + size * 0.9, size, 'center', c.fg);
  }
  g.strokeStyle = env.alpha(c.fg, 0.5);
  g.lineWidth = 1;
  g.strokeRect(x, y, width, height);
}

function drawSpectrum(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const target = spectrumSum(plan, plan.pair);
  const left = w * 0.06;
  const right = w * 0.54;
  const chartY = h * 0.25;
  const chartW = w * 0.4;
  const chartH = h * 0.19;
  background(g, w, h, env);
  dust(g, w, h, env, v);
  lamp(g, env, w * (0.5 + (v.turn - 0.5) * 0.08), h * 0.1, Math.min(w, h) * 0.085 * v.scale);
  label(g, env, 'light through the prism', w * 0.5, h * 0.16, size, 'center', c.accent2);
  label(g, env, 'target', left + chartW / 2, chartY - size, size, 'center', c.accent2);
  label(g, env, 'your lamps', right + chartW / 2, chartY - size, size, 'center', c.accent2);
  spectrumBars(g, env, left, chartY, chartW, chartH, target, size);
  const before = s.from.length ? spectrumSum(plan, s.from) : null;
  const after = s.selected.length ? spectrumSum(plan, s.selected) : null;
  const own = roll(rite, 0x81c, s.moves);
  wipe(g, own, right - 1, chartY - 1, chartW + 2, chartH + size * 1.6,
    own.stair(came(s, s.changedAt, 1.2, !!env.reduced)),
    () => spectrumBars(g, env, right, chartY, chartW, chartH, before, size),
    () => spectrumBars(g, env, right, chartY, chartW, chartH, after, size));
  if (s.looks) {
    const highest = target.indexOf(Math.max(...target));
    const x = left + highest * chartW / 3 + 2;
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.strokeRect(x, chartY - 2, chartW / 3 - 4, chartH + 4);
  }
  label(g, env, 'R / G / B     power in W', w * 0.5, h * 0.57, size, 'center', c.accent2);
  plan.lamps.forEach((source, i) => {
    const x = w * (0.04 + (i % 3) * 0.32);
    const y = h * (0.64 + Math.floor(i / 3) * 0.17);
    const cw = w * 0.28;
    const ch = h * 0.14;
    g.fillStyle = env.mix(c.bg, c.bg2, 0.65);
    g.fillRect(x, y, cw, ch);
    if (s.selected.includes(LAMP_NAMES[i])) {
      g.fillStyle = env.alpha(c.accent2, 0.12);
      own.paint(g, x, y, cw, ch, own.stair(came(s, s.changedAt, 1.2, !!env.reduced)));
    }
    g.strokeStyle = env.alpha(c.accent, 0.6);
    g.lineWidth = 1;
    g.strokeRect(x, y, cw, ch);
    label(g, env, LAMP_NAMES[i] + '  ' + source.watts + ' W', x + cw / 2, y + ch * 0.33,
      size, 'center', c.accent2);
    label(g, env, 'R' + source.bars[0] + ' G' + source.bars[1] + ' B' + source.bars[2],
      x + cw / 2, y + ch * 0.76, size, 'center', c.fg);
  });
  if (s.open) daybreak(g, rite, env, w, h, came(s, s.openAt, 1.8, !!env.reduced));
}

function spectrumPreview(g, w, h, env, plan) {
  drawSpectrum(g, w, h, env, plan, spectrumState(), env.variant);
}

function spectrumPiece(env, plan) {
  const helps = asked(env).helps;
  const target = spectrumSum(plan, plan.pair);
  const power = plan.pair.reduce((total, name) => total + plan.lamps[LAMP_NAMES.indexOf(name)].watts, 0);
  const s = spectrumState();
  const draw = (c) => {
    drawSpectrum(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnAt = s.t;
  };
  const hints = [
    'Compare one channel at a time. The target bars are sums, not either lamp alone.',
    'Start with the tallest target bar: find two lamp numbers that add to it.',
    'A zero on one lamp leaves that channel entirely to its partner.',
    'Check all three colour totals before you add the watts.',
    'Once the bars match, add only the two selected watt labels.'
  ];
  return {
    title: spectrumTitle(plan),
    brief: 'Six lamps shine through a prism. Each shows red, green and blue strengths (R/G/B) and its power in watts. Two lamps add channel by channel. The target is R' + target[0] + ' G' + target[1] + ' B' + target[2] + '. The lamps are ' + plan.lamps.map((lamp, i) => LAMP_NAMES[i] + ': R' + lamp.bars[0] + ' G' + lamp.bars[1] + ' B' + lamp.bars[2] + ', ' + lamp.watts + ' W').join('; ') + '.',
    goal: 'Choose two lamps whose red, green and blue totals match the target, then enter their combined power.',
    aspect: '4 / 3',
    checkLabel: 'check the table',
    steps: [
      { id: 'pair', ask: 'the two lamps to light', kind: 'pick', count: 2,
        items: LAMP_NAMES.map((name) => ({ label: 'lamp ' + name, value: name })) },
      { id: 'power', ask: 'their combined power, in watts', kind: 'number', min: 4, max: 18, step: 1, unit: 'W' },
      { id: 'hint', ask: 'take a closer look at the prism', kind: 'press', count: helps,
        label: 'look again', optional: true }
    ],
    solution: { pair: plan.pair.slice(), power },
    check(c) {
      const chosen = c.value('pair');
      const valid = Array.isArray(chosen) && chosen.length === 2 && new Set(chosen).size === 2 &&
        chosen.every((name) => LAMP_NAMES.includes(name));
      const pairRight = valid && plan.pair.every((name) => chosen.includes(name));
      const powerRight = Number(c.value('power')) === power;
      if (pairRight && powerRight) return { solved: true, say: 'the three colours meet in the prism; the two lamps use ' + power + ' W together' };
      const sum = valid ? spectrumSum(plan, chosen) : [0, 0, 0];
      const matching = sum.filter((value, i) => value === target[i]).length;
      const labelsAgree = valid && chosen.reduce((total, name) => total + plan.lamps[LAMP_NAMES.indexOf(name)].watts, 0) === Number(c.value('power'));
      return { solved: false, say: matching + ' of 3 colour bars match the target; the power entry ' + (labelsAgree ? 'matches' : 'does not match') + ' the two lamp labels' };
    },
    start(c) {
      c.status('the target is lit; choose two lamps to compare with it');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'pair' && Array.isArray(value) && value.every((name) => LAMP_NAMES.includes(name))) {
        const rite = riteOf(c);
        const showing = roll(rite, 0x81c, s.moves).stair(came(s, s.changedAt, 1.2, !!c.reduced));
        s.from = (showing >= 0.5 ? s.selected : s.from).slice();
        s.selected = value.slice();
        s.changedAt = s.t;
        s.moves += 1;
        c.status(s.selected.length + ' lamps lighting the comparison');
        draw(c);
      }
      if (id === 'power' && Number.isFinite(Number(value))) {
        c.status(Number(value) + ' W for the two lamps, you say');
      }
      if (id === 'hint' && s.looks < helps) {
        c.hint();
        s.looks += 1;
        s.lookAt = s.t;
        c.status(hints[s.looks - 1]);
        draw(c);
      }
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      return step(s, c, Math.max(s.changedAt, s.lookAt, s.openAt), draw);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      c.status('the target and your two lamps carry the same three colours');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle a seed is dealt, from the seed alone so that paint, spark and piece agree.
function dealsFilters(env) {
  return (((Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0) >>> 3) & 1) === 1;
}

const PLANS = new WeakMap();
function planFor(env) {
  let plan = PLANS.get(env);
  if (plan) return plan;
  const hash = Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0;
  plan = hash % 3 === 0 ? spectrumPlan(env) : dealsFilters(env) ? filterPlan(env) : slitPlan(env);
  PLANS.set(env, plan);
  return plan;
}

export default {
  id: 'light-table',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = planFor(env);
    if (plan.kind === 'spectrum') spectrumPreview(g, w, h, env, plan);
    else if (plan.kind === 'filters') filterPreview(g, w, h, env, plan);
    else slitPreview(g, w, h, env, plan);
  },
  animate(g, w, h, env, t) {
    return false;
  },
  spark(env) {
    const plan = planFor(env);
    if (plan.kind === 'spectrum') {
      const target = spectrumSum(plan, plan.pair);
      return {
        title: spectrumTitle(plan),
        text: 'Six coloured lamps, one target in the prism. Find the pair whose light adds up, then add their power readings.',
        mono: 'R' + target[0] + ' / G' + target[1] + ' / B' + target[2],
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => spectrumPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    if (plan.kind === 'filters') {
      return {
        title: filterTitle(plan),
        text: 'Three polarising filters, one lamp, one screen. Find the order that passes the most light, and how much that is.',
        mono: plan.angles.map((a) => a + '°').join(' / '),
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => filterPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
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
    const spectrum = carriedSpectrum(env);
    if (spectrum) return spectrumPiece(env, spectrum);
    const plan = planFor(env);
    if (plan.kind === 'spectrum') return spectrumPiece(env, plan);
    return plan.kind === 'filters' ? filterPiece(env, plan) : slitPiece(env, plan);
  }
};
