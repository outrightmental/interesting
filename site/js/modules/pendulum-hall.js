/* The pendulum hall: a rack that counts in beats, and a pair that lends a swing across a spring.
   As a card it is one of the two puzzles below, drawn small (paint, animate, spark); as a piece it
   is that puzzle, and the card it was opened from says which. See js/feed.js for what a module is
   and js/stage.js for what a piece is.

   Two puzzles, one deduction and one experiment:

     when they meet again  Three or four pendulums on one bar, each with its period written under
                           it and drawn as its length, starting together or on separate beats.
                           One whose period is P beats comes back through the
                           centre heading right every P beats. Name the first beat when all of
                           them come through together again, and say which of them are coming
                           through at a stated beat. A wrong check says how many come through
                           together at the beat you named, and how many of your picks are right.
     the spring            Two pendulums of the same length, joined by a spring whose stiffness the
                           visitor sets. Only the first is let go from the side; the spring hands
                           the swing across until the first hangs still and the second has all of
                           it. The scene asks for the crossing in a stated number of breaths. A
                           check runs the pair and says how long the crossing took and whether it
                           was too soon or too late; the run is replayed and logged on the ruler,
                           so each try is one more point on the curve.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the periods and the stated beat, or the breath, the target and the question -- and
   piece(env) opens on that rather than rolling another. */


const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ORDINAL = ['first', 'second', 'third', 'fourth'];
const TAU = Math.PI * 2;
// The spring pair's model: each pendulum alone swings once in OWN seconds. With the spring at
// stiffness k the two normal modes have w1 (together, the spring never stretched) and
// w2 = sqrt(w1^2 + 2 k C) (opposite); from a one-sided start the swing has crossed wholly to the
// other pendulum after half a beat of the two, pi / (w2 - w1).
const OWN = 2;
const W1 = TAU / OWN;
const COUPLE = 0.002;
const C = COUPLE * W1 * W1;
// Breath lengths and counts whose crossing time sits where the slider can hold it.
const TARGETS = [[2, 4], [2, 5], [3, 3], [3, 4], [3, 5], [4, 2], [4, 3], [4, 4]];
const THEN = [
  { label: 'sooner', value: 'sooner' },
  { label: 'later', value: 'later' },
  { label: 'at the same time', value: 'same' }
];
// The escapement: the pair's clock advances in clicks of the rite's ratchet, one tooth-set per
// TOOTH seconds of the replay, so the swing is handed across in steps and never glides.
const TOOTH = 0.5;

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

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcmOf(list) {
  return list.reduce((acc, p) => acc * p / gcd(acc, p), 1);
}

/* ---- the rite: how this hall moves ---------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing in the hall moves along a formula or cuts without a rite.
   The hall's clocks are escapements: the rack's beat and the pair's seconds advance in the
   ratchet's clicks with backlash, so a pendulum swings in steps -- its angle is still the
   physics of its period, read off a clock that ticks -- and the beat counter, the replay's dot
   on the ruler and the trace of the swing's reach all step with it. A picked pendulum is SEALED:
   a disc develops behind it through the matte, cell by cell in the piece's own pattern, and its
   ring blinks on; an unpicked one dissolves back down the same ladder. A hint's answer, a run's
   mark on the ruler and the caption blink on; the spring's stiffness readout counts to its new
   value in treads and the coils follow it; the light over a solved hall develops through the
   matte with a flicker, never a wash; and the dust blinks. Every change is read against the
   piece's own clock, s.t, which frame() advances: a change made at `since` has come came() of
   its way, which is 1 at once for a visitor who asked for less motion and for whatever stood
   there from the start. Every trigger rolls a fresh rite (rite.at(k) with the count of that
   trigger in k), so a second pick, a second run, a second move of the slider composes a different
   stair, matte and flicker from the first. */

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

// A clock read through the escapement: the whole units gone by, and the one under way in the
// ratchet's clicks. Every unit is a tick of its own roll (rite.at over the unit's number), so no
// two beats click alike: a different count of teeth, a different backlash, the same clock.
// Negative time is time before the start and stays as it is.
function escaped(rite, x) {
  if (!(x > 0)) return x;
  const unit = Math.floor(x);
  return unit + rite.at(0xe5c + unit).ratchet(fract(x));
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

// The light that comes over a solved hall: it develops through the matte from the moment of the
// solve, blinking on and dropping out the way the rite's flicker has it, and holds.
function daybreak(g, rite, c, w, h, p, strength) {
  const own = rite.at(0xdb);
  const k = own.stair(p);
  if (k <= 0 || !own.flicker(p)) return;
  g.fillStyle = c.alpha(c.colors.accent2, strength || 0.1);
  develop(g, own, 0, 0, w, h, k, null, Math.max(rite.cell, Math.ceil(Math.min(w, h) / 30)));
}

/* ---- drawing shared by both ----------------------------------------------------------------- */

// The dust: standing where the configuration put it, and every fifth speck blinking out the way
// the rite's flicker has it, on a roll of its own, so the hall is never quite still.
function hallBackground(g, w, h, c, v, t) {
  const col = c.colors;
  const rite = riteOf(c);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.alpha(col.accent, 0.12);
  for (let i = 0, dots = Math.max(8, Math.round(22 * v.density)); i < dots; i++) {
    if (i % 5 === 0 && !rite.at(0xd0 + (i % 11)).flicker(fract((t || 0) / 3.1 + i * 0.173))) continue;
    g.fillRect(((i * 0.6180339 + v.turn * 0.37) % 1) * w, ((i * 0.7548777) % 1) * h, 1.2, 1.2);
  }
}

function text(g, c, line, x, y, size, color, align, width) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color || c.colors.fg;
  if (width) g.fillText(line, x, y, width);
  else g.fillText(line, x, y);
}

function bar(g, c, w, barY, m) {
  g.strokeStyle = c.alpha(c.colors.fg, 0.55);
  g.lineWidth = Math.max(2, m * 0.012);
  g.beginPath();
  g.moveTo(w * 0.08, barY);
  g.lineTo(w * 0.92, barY);
  g.stroke();
}

function bob(g, c, pivot, barY, length, theta, radius, tone) {
  const x = pivot + Math.sin(theta) * length;
  const y = barY + Math.cos(theta) * length;
  g.strokeStyle = c.alpha(c.colors.fg, 0.6);
  g.lineWidth = Math.max(1, radius * 0.2);
  g.beginPath();
  g.moveTo(pivot, barY);
  g.lineTo(x, y);
  g.stroke();
  g.fillStyle = c.alpha(tone, 0.2);
  g.beginPath();
  g.arc(x, y, radius * 1.9, 0, TAU);
  g.fill();
  g.fillStyle = tone;
  g.beginPath();
  g.arc(x, y, radius, 0, TAU);
  g.fill();
  return { x, y };
}

/* ---- when they meet again ------------------------------------------------------------------ */

function rackPlan(env) {
  const n = env.chance(0.5) ? 4 : 3;
  const pool = [2, 3, 4, 5, 6];
  const periods = [];
  while (periods.length < n) periods.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  const meet = lcmOf(periods);
  const anchor = env.chance(0.5) ? env.int(2, meet - 1) : 0;
  const starts = periods.map((p) => anchor % p);
  // The stated beat: one on which some of them, not none and not all, come through the centre.
  const beats = [];
  for (let t = 2; t <= Math.min(60, meet - 1); t++) {
    const through = throughAt(periods, t, starts).length;
    if (through > 0 && through < n) beats.push(t);
  }
  if (!beats.length) throw new Error('The rack has no partial crossing beat.');
  return { kind: 'rack', number: 100 + env.int(0, 899), periods, starts, at: env.pick(beats) };
}

function carriedRack(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'rack' || !Array.isArray(p.periods) || p.periods.length < 3 || p.periods.length > 4) return null;
  const periods = p.periods.map(Number);
  if (!periods.every((q) => Number.isInteger(q) && q >= 2 && q <= 6) || new Set(periods).size !== periods.length) return null;
  const number = Number(p.number);
  const at = Number(p.at);
  if (!Number.isInteger(number) || number < 100 || number > 999 || !Number.isInteger(at) || at < 1 || at > 60) return null;
  const starts = p.starts === undefined ? periods.map(() => 0)
    : Array.isArray(p.starts) && p.starts.length === periods.length ? p.starts.slice() : null;
  if (!starts || !starts.every((s, i) => Number.isInteger(s) && s >= 0 && s < periods[i])) return null;
  const through = throughAt(periods, at, starts).length;
  if (through === 0 || through === periods.length) return null;
  if (lcmOf(periods) > 60 || !rackMeet({ periods, starts })) return null;
  return { kind: 'rack', number, periods, starts, at };
}

function rackTitle(plan) {
  return 'rack ' + plan.number + ': ' + (plan.starts && plan.starts.some((s) => s > 0) ? 'the staggered start' : 'when they meet again');
}

function throughAt(periods, beat, starts) {
  return periods.map((p, i) => i).filter((i) => {
    const start = starts ? starts[i] : 0;
    return beat >= start && (beat - start) % periods[i] === 0;
  });
}

function rackMeet(plan) {
  for (let beat = 1; beat <= 60; beat++) {
    if (throughAt(plan.periods, beat, plan.starts).length === plan.periods.length) return beat;
  }
  return 0;
}

// A pendulum hangs still until its start beat, then crosses the centre heading right.
function rackAngle(period, beat, start = 0) {
  return beat < start ? 0 : Math.sin(TAU * (beat - start) / period);
}

function drawRack(g, w, h, c, plan, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const n = plan.periods.length;
  const m = Math.min(w, h);
  const size = Math.max(9, Math.min(17, Math.round(m * 0.045)));
  const small = Math.max(8, Math.round(size * 0.85));
  hallBackground(g, w, h, c, v, s.t);
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, c, w, h, came(s, s.doneAt, 2.4, reduced), 0.1);
  // The rack's clock, read through the escapement: beats in the ratchet's clicks.
  const beat = s.beat < 0 ? -1 : escaped(rite, s.beat);
  const barY = h * 0.1;
  const Lmax = h * 0.52 * Math.min(1.08, Math.max(0.88, v.scale));
  const amp = 0.42;
  bar(g, c, w, barY, m);
  const pivots = plan.periods.map((p, i) => w * (0.2 + 0.6 * (n > 1 ? i / (n - 1) : 0.5)));
  const r = Math.max(3, m * 0.018 * Math.min(1.1, v.scale));
  plan.periods.forEach((p, i) => {
    const length = Lmax * (0.42 + 0.58 * (p - 2) / 4);
    const tone = c.mix(col.accent, col.accent2, n > 1 ? i / (n - 1) : 0);
    // The centre line, the way home; dashed.
    g.strokeStyle = c.alpha(col.muted, 0.3);
    g.lineWidth = 1;
    g.setLineDash([2, 5]);
    g.beginPath();
    g.moveTo(pivots[i], barY);
    g.lineTo(pivots[i], barY + length + r * 2.5);
    g.stroke();
    g.setLineDash([]);
    const start = plan.starts ? plan.starts[i] : 0;
    const theta = beat < 0 ? 0 : amp * rackAngle(p, beat, start);
    // A picked pendulum is sealed: a disc develops behind it through the matte by its area, on
    // the roll of that pick, and its ring blinks on; unpicked, it dissolves back down.
    const pick = s.picks ? s.picks[i] : null;
    if (pick) {
      const own = rite.at(0x100 + i * 64 + (pick.roll % 64));
      const went = own.stair(came(s, pick.at, 0.9, reduced));
      const k = pick.on ? went : 1 - went;
      if (k > 0) {
        const hx = pivots[i] + Math.sin(theta) * length;
        const hy = barY + Math.cos(theta) * length;
        const halo = r * 3.1;
        g.fillStyle = c.alpha(col.accent2, 0.28);
        develop(g, own, hx - halo, hy - halo, halo * 2, halo * 2, k,
          (px, py) => (px - hx) * (px - hx) + (py - hy) * (py - hy) <= halo * halo, Math.max(rite.cell, Math.ceil(halo / 7)));
      }
    }
    const at = bob(g, c, pivots[i], barY, length, theta, r, tone);
    // The ring blinks on with the pick; unpicked, it holds a moment, refuses once or twice in the
    // flicker's dropouts, and is gone -- never a cut.
    const ringOn = pick && (pick.on
      ? rite.at(0x100 + i * 64 + (pick.roll % 64)).flicker(came(s, pick.at, 0.9, reduced))
      : !rite.at(0x100 + i * 64 + (pick.roll % 64)).flicker(came(s, pick.at, 0.9, reduced)));
    if (ringOn) {
      g.strokeStyle = col.accent2;
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(at.x, at.y, r * 2.6, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
    text(g, c, p + ' beats', pivots[i], barY + length + r * 4.2, small, c.alpha(col.fg, 0.9));
    text(g, c, 'starts at ' + start, pivots[i], barY + length + r * 4.2 + small * 1.4, small, col.accent2);
    // A hint's answer blinks on under the bar.
    if (s.shown[i] && rite.at(0x200 + i).flicker(came(s, s.shownAt ? s.shownAt[i] : -1, 0.8, reduced))) {
      text(g, c, s.shown[i], pivots[i], barY + small * 1.3, small, col.accent);
    }
  });
  // The ruler of beats along the foot, the stated beat marked, the replay's beat on it.
  const left = w * 0.08;
  const right = w * 0.92;
  const rulerY = h * 0.91;
  g.strokeStyle = c.alpha(col.muted, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(left, rulerY);
  g.lineTo(right, rulerY);
  for (let t = 0; t <= 60; t += 1) {
    const x = left + (right - left) * t / 60;
    g.moveTo(x, rulerY);
    g.lineTo(x, rulerY - (t % 10 === 0 ? size * 0.5 : t % 5 === 0 ? size * 0.3 : size * 0.15));
  }
  g.stroke();
  for (let t = 0; t <= 60; t += 10) text(g, c, String(t), left + (right - left) * t / 60, rulerY + small * 0.9, small, c.alpha(col.fg, 0.7));
  const ax = left + (right - left) * plan.at / 60;
  g.fillStyle = col.accent2;
  g.beginPath();
  g.moveTo(ax, rulerY - size * 0.7);
  g.lineTo(ax - size * 0.3, rulerY - size * 1.2);
  g.lineTo(ax + size * 0.3, rulerY - size * 1.2);
  g.closePath();
  g.fill();
  text(g, c, 'beat ' + plan.at, ax, rulerY - size * 1.9, small, col.accent2);
  if (beat >= 0) {
    const bx = left + (right - left) * Math.min(60, beat) / 60;
    g.fillStyle = col.fg;
    g.beginPath();
    g.arc(bx, rulerY, Math.max(2, size * 0.2), 0, TAU);
    g.fill();
    text(g, c, 'beat ' + Math.max(0, Math.floor(beat)), w / 2, h * 0.805, small, c.alpha(col.fg, 0.85));
  } else text(g, c, plan.starts && plan.starts.some((s) => s > 0) ? 'different start beats; all starts head right' : 'all through the centre at beat 0, heading right', w / 2, h * 0.805, small, c.alpha(col.fg, 0.75), 'center', w * 0.9);
}

function rackBlank() {
  return { beat: -1, picked: [], shown: {}, shownAt: {}, picks: {}, rolls: 0, to: -1, loop: false, t: 0, doneAt: -1 };
}

function rackPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  const s = rackBlank();
  s.beat = v.turn * 12;
  drawRack(g, w, h, env, plan, s, v);
}

function rackPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.periods.length;
  const starts = plan.starts || plan.periods.map(() => 0);
  const meet = rackMeet(plan);
  const through = throughAt(plan.periods, plan.at, starts);
  const s = rackBlank();
  const pace = 0.35;
  const draw = (c) => drawRack(c.g, c.w, c.h, c, plan, s, env.variant || PLAIN);
  const name = (i) => 'the ' + plan.periods[i] + '-beat pendulum';
  return {
    title: rackTitle(plan),
    brief: 'Find a shared crossing among ' + WORDS[n] + ' pendulums. From left to right: ' + plan.periods.map((p, i) => ORDINAL[i] + ', period ' + p + ', starts at beat ' + starts[i]).join('; ') + '. Each hangs still until its start beat, then crosses the centre heading right, and repeats that crossing every period. Add its period to its start beat to list later crossings. Changing the meeting-beat control shows the rack at that beat; no waiting is needed.',
    goal: 'Name the first beat when all of them come through the centre heading right together, and pick the ones that do at beat ' + plan.at + '.',
    aspect: '16 / 10',
    checkLabel: 'count it out',
    steps: [
      { id: 'meet', ask: 'the first beat when all of them come through heading right together', kind: 'number', min: 1, max: 60, step: 1, unit: 'beat' },
      { id: 'which', ask: 'the ones coming through heading right at beat ' + plan.at, kind: 'pick', count: through.length, items: plan.periods.map((p, i) => ({ label: ORDINAL[i] + ', period ' + p + ', starts at ' + starts[i], value: i })) },
      { id: 'hint', ask: 'one pendulum at beat ' + plan.at, kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { meet, which: through.slice() },
    check(c) {
      const beat = Math.round(Number(c.value('meet')));
      const chosen = Array.isArray(c.value('which')) ? c.value('which').map(Number) : [];
      const right = chosen.filter((i) => through.includes(i)).length;
      const extra = chosen.length - right;
      const pickRight = extra === 0 && right === through.length;
      const meetRight = beat === meet;
      s.to = Number.isFinite(beat) ? Math.max(0, Math.min(60, beat)) : 0;
      s.beat = 0;
      if (meetRight && pickRight) return { solved: true, say: 'the vigil holds: all through together at beat ' + meet + '; ' + through.map(name).join(' and ') + ' at beat ' + plan.at };
      const parts = [];
      if (!meetRight) {
        const together = Number.isFinite(beat) && beat >= 1 ? throughAt(plan.periods, beat, starts).length : 0;
        parts.push(together === n ? 'at beat ' + beat + ' they do all come through, but not for the first time'
          : 'at beat ' + beat + ' only ' + WORDS[together] + ' of the ' + WORDS[n] + ' come through heading right');
      }
      if (!pickRight) {
        parts.push(right === 0 ? 'none of your picks is through the centre at beat ' + plan.at
          : WORDS[right] + ' of your picks ' + (right === 1 ? 'is' : 'are') + ' right' + (extra ? ', ' + WORDS[extra] + ' ' + (extra === 1 ? 'is' : 'are') + ' not' : ', and ' + WORDS[through.length - right] + ' missing'));
      }
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('rack ' + plan.number + ': periods ' + plan.periods.join(', ') + '; start beats ' + starts.join(', ') + '; tap a pendulum to pick it for beat ' + plan.at + ', or the ruler to show any beat');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'meet') {
        const beat = Math.round(Number(value));
        if (Number.isFinite(beat) && beat >= 1 && beat <= 60) {
          s.to = -1;
          s.beat = beat;
          c.status('showing beat ' + beat + '; a centred bob may be heading left or still waiting to start, so use the periods and start beats to check heading right');
        } else c.status('choose a meeting beat from 1 to 60');
      }
      if (id === 'which' && Array.isArray(value)) {
        const next = value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n);
        // Every pendulum whose pick changed seals or unseals itself afresh, on a roll of its own.
        for (let i = 0; i < n; i++) {
          const on = next.includes(i);
          if (on !== s.picked.includes(i)) s.picks[i] = { on, at: s.t, roll: s.rolls++ };
        }
        s.picked = next;
        c.status(s.picked.length ? 'at beat ' + plan.at + ': ' + s.picked.map(name).join(', ') : 'none picked for beat ' + plan.at);
      }
      if (id === 'hint') {
        const given = plan.periods.filter((p, i) => s.shown[i]).length;
        const next = given < helps ? plan.periods.findIndex((p, i) => !s.shown[i]) : -1;
        if (next >= 0) {
          const yes = through.includes(next);
          s.shown[next] = yes ? 'through at ' + plan.at : 'not at ' + plan.at;
          s.shownAt[next] = s.t;
          c.hint();
          c.status('at beat ' + plan.at + ' ' + name(next) + (yes ? ' is coming through the centre heading right' : ' is not'));
        } else if (given >= helps) {
          c.status('that is all the hall will show at this difficulty; the periods are on the rack');
        } else {
          c.status('every pendulum at beat ' + plan.at + ' has been shown; the meeting beat is yours');
        }
      }
      draw(c);
    },
    // The scene is the control: tap a pendulum to pick it for the stated beat (and again to let
    // it go), or tap the ruler along the foot to show the rack at that beat and set it as the
    // meeting beat.
    tap(x, y, c) {
      const v = env.variant || PLAIN;
      const px = x * c.w;
      const py = y * c.h;
      const left = c.w * 0.08;
      const right = c.w * 0.92;
      if (Math.abs(py - c.h * 0.91) < c.h * 0.09) {
        const beat = Math.max(1, Math.min(60, Math.round((px - left) / (right - left) * 60)));
        s.to = -1;
        s.beat = beat;
        c.set('meet', beat);
        c.status('beat ' + beat + ' shown and set as the meeting beat; a centred bob may be heading left or still waiting to start');
        draw(c);
        return;
      }
      const Lmax = c.h * 0.52 * Math.min(1.08, Math.max(0.88, v.scale));
      const spacing = c.w * 0.6 / Math.max(1, n - 1);
      let hit = -1;
      plan.periods.forEach((p, i) => {
        const pivot = c.w * (0.2 + 0.6 * (n > 1 ? i / (n - 1) : 0.5));
        if (Math.abs(px - pivot) < spacing * 0.45 && py >= c.h * 0.1 && py <= c.h * 0.1 + Lmax + c.h * 0.08) hit = i;
      });
      if (hit < 0) {
        c.status('tap a pendulum to pick it for beat ' + plan.at + ', or the ruler to show a beat');
        return;
      }
      const on = !s.picked.includes(hit);
      s.picks[hit] = { on, at: s.t, roll: s.rolls++ };
      s.picked = on ? s.picked.concat([hit]).sort((a, b) => a - b) : s.picked.filter((i) => i !== hit);
      c.set('which', s.picked.slice());
      c.status(name(hit) + (on ? ' picked' : ' let go') + ' for beat ' + plan.at + (s.picked.length ? ': ' + s.picked.map(name).join(', ') : ''));
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      if (s.to >= 0) {
        if (c.reduced) s.beat = s.to;
        else {
          s.beat = Math.min(s.to, s.beat + Math.max(0, dt) / pace);
          if (c.done && s.beat >= s.to) s.beat = 0;
        }
      }
      draw(c);
    },
    end(c) {
      s.to = meet;
      s.beat = 0;
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status('first shared crossing: beat ' + meet + '; it repeats every ' + lcmOf(plan.periods) + ' beats. Change the meeting beat to inspect the rack at another point');
      draw(c);
    }
  };
}

/* ---- the spring ---------------------------------------------------------------------------- */

function crossTime(k) {
  const w2 = Math.sqrt(W1 * W1 + 2 * Math.max(0, k) * C);
  return Math.PI / (w2 - W1);
}

// The stiffness that crosses in `target` seconds, with the slider's slack either way, or null
// when the target is not one the slider can hold with both its ends missing.
function springSolution(breath, breaths) {
  const target = breath * breaths;
  const tol = 0.1 * target;
  const ok = [];
  for (let k = 1; k <= 100; k++) if (Math.abs(crossTime(k) - target) <= tol) ok.push(k);
  if (!ok.length || ok[0] <= 1 || ok[ok.length - 1] >= 100) return null;
  const r = 1 + OWN / (2 * target);
  let value = Math.round((r * r - 1) / (2 * COUPLE));
  value = Math.max(ok[0], Math.min(ok[ok.length - 1], value));
  const near = Math.min(value - ok[0], ok[ok.length - 1] - value);
  if (near < 1) return null;
  return { target, tol, value, near };
}

function springPlan(env) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const pair = env.pick(TARGETS);
    if (!springSolution(pair[0], pair[1])) continue;
    return { kind: 'spring', number: 100 + env.int(0, 899), breath: pair[0], breaths: pair[1], ask: env.chance(0.5) ? 'stiffer' : 'softer', open: env.int(4, 18) };
  }
  return { kind: 'spring', number: 500, breath: 3, breaths: 3, ask: 'stiffer', open: 10 };
}

function carriedSpring(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'spring') return null;
  const number = Number(p.number);
  const breath = Number(p.breath);
  const breaths = Number(p.breaths);
  const open = Number(p.open);
  if (!Number.isInteger(number) || number < 100 || number > 999) return null;
  if (!TARGETS.some((pair) => pair[0] === breath && pair[1] === breaths)) return null;
  if (p.ask !== 'stiffer' && p.ask !== 'softer') return null;
  if (!Number.isInteger(open) || open < 1 || open > 100) return null;
  const sol = springSolution(breath, breaths);
  if (!sol || Math.abs(crossTime(open) - sol.target) <= sol.tol) return null;
  return { kind: 'spring', number, breath, breaths, ask: p.ask, open };
}

function springTitle(plan) {
  return 'pair ' + plan.number + ': cross in ' + WORDS[plan.breaths] + ' breaths';
}

// Where the two swings are `time` seconds after the first is let go, as fractions of the start.
function springMotion(k, time) {
  const w2 = Math.sqrt(W1 * W1 + 2 * Math.max(0, k) * C);
  return {
    first: (Math.cos(W1 * time) + Math.cos(w2 * time)) / 2,
    second: (Math.cos(W1 * time) - Math.cos(w2 * time)) / 2,
    firstReach: Math.abs(Math.cos((w2 - W1) * time / 2)),
    secondReach: Math.abs(Math.sin((w2 - W1) * time / 2))
  };
}

// The replay's seconds, read through the escapement in teeth of TOOTH seconds.
function replayTime(rite, t) {
  return escaped(rite, t / TOOTH) * TOOTH;
}

// The stiffness as drawn: counting from where it stood to where the slider has it, in treads.
function stiffnessShown(s, rite, reduced) {
  if (s.kFrom == null || s.kAt == null || s.kAt < 0) return s.k;
  return Math.round(s.kFrom + (s.k - s.kFrom) * rite.at(0x400 + (s.sets || 0)).stair(came(s, s.kAt, 0.8, reduced)));
}

function spring(g, c, a, b, radius, k, v) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const coils = Math.max(4, Math.round((5 + k / 7) * v.density));
  const width = Math.min(radius * 0.8, length * 0.03);
  g.strokeStyle = c.colors.accent;
  g.lineWidth = Math.max(1, radius * (0.1 + k / 500));
  g.beginPath();
  g.moveTo(a.x + ux * radius, a.y + uy * radius);
  for (let i = 0; i <= coils * 2; i++) {
    const along = radius + (length - radius * 2) * (0.12 + i / (coils * 2) * 0.76);
    const across = i === 0 || i === coils * 2 ? 0 : (i % 2 ? 1 : -1) * width;
    g.lineTo(a.x + ux * along - uy * across, a.y + uy * along + ux * across);
  }
  g.lineTo(b.x - ux * radius, b.y - uy * radius);
  g.stroke();
}

// The ruler of breaths along the foot: the target line, past runs as marks, and the swing sizes
// of the run being replayed traced over it. `now` is the replay's time as the escapement reads it.
function springRuler(g, w, h, c, plan, s, v, size, now) {
  const col = c.colors;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const left = w * 0.08;
  const right = w * 0.92;
  const top = h * 0.75;
  const bottom = h * 0.9;
  const span = (plan.breaths + 1.5) * plan.breath;
  const xOf = (t) => left + (right - left) * Math.min(1, t / span);
  g.strokeStyle = c.alpha(col.muted, 0.4);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(left, top);
  g.lineTo(left, bottom);
  g.lineTo(right, bottom);
  for (let b = 1; b * plan.breath <= span; b++) {
    g.moveTo(xOf(b * plan.breath), bottom);
    g.lineTo(xOf(b * plan.breath), bottom + size * 0.4);
  }
  g.stroke();
  for (let b = 1; b * plan.breath <= span; b++) {
    text(g, c, b === 1 ? 'one breath' : String(b), xOf(b * plan.breath), bottom + size * 1.1, Math.max(8, size * 0.85), c.alpha(col.fg, 0.7));
  }
  const tx = xOf(plan.breaths * plan.breath);
  g.strokeStyle = c.alpha(col.accent2, 0.9);
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(tx, top - size * 0.3);
  g.lineTo(tx, bottom);
  g.stroke();
  g.setLineDash([]);
  text(g, c, 'cross here', tx, top - size * 0.9, Math.max(8, size * 0.85), col.accent2);
  // Past runs: a mark at the crossing each stiffness made, blinking on when it was logged.
  for (const run of s.runs) {
    if (!rite.at(0x300 + run.k).flicker(came(s, run.at == null ? -1 : run.at, 0.9, reduced))) continue;
    const x = xOf(Math.min(span, run.tau));
    g.fillStyle = c.alpha(col.fg, 0.85);
    g.beginPath();
    g.moveTo(x, bottom);
    g.lineTo(x - size * 0.25, bottom + size * 0.45);
    g.lineTo(x + size * 0.25, bottom + size * 0.45);
    g.closePath();
    g.fill();
    text(g, c, (run.tau > span ? '>' : '') + run.k, x, top + size * 0.5, Math.max(8, size * 0.8), c.alpha(col.fg, 0.8));
  }
  if (s.replay) {
    const f = Math.min(span, now);
    const samples = Math.max(40, Math.round(90 * v.density));
    for (const [key, color, dashed] of [['firstReach', col.accent2, false], ['secondReach', col.accent, true]]) {
      g.strokeStyle = color;
      g.lineWidth = dashed ? 1.5 : 2.2;
      g.setLineDash(dashed ? [4, 3] : []);
      g.beginPath();
      const count = Math.ceil(samples * f / span);
      for (let i = 0; i <= count; i++) {
        const time = Math.min(f, i / samples * span);
        const reach = springMotion(s.replay.k, time)[key];
        if (i) g.lineTo(xOf(time), bottom - (bottom - top) * reach);
        else g.moveTo(xOf(time), bottom - (bottom - top) * reach);
      }
      g.stroke();
      g.setLineDash([]);
    }
  }
}

function drawSpring(g, w, h, c, plan, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const m = Math.min(w, h);
  const size = Math.max(9, Math.min(17, Math.round(m * 0.04)));
  const barY = h * 0.1;
  const length = Math.min(h * 0.4, w * 0.4) * Math.min(1.08, Math.max(0.88, v.scale));
  const amplitude = 0.2;
  const radius = Math.max(3, m * 0.024 * v.scale);
  hallBackground(g, w, h, c, v, s.t);
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, c, w, h, came(s, s.doneAt, 2.4, reduced), 0.1);
  bar(g, c, w, barY, m);
  // The replay's clock, read through the escapement: the pair is handed its swing in clicks.
  const now = s.replay ? replayTime(rite, s.replay.t) : 0;
  const motion = s.replay ? springMotion(s.replay.k, now) : { first: 1, second: 0, firstReach: 1, secondReach: 0 };
  const pivots = [w * 0.3, w * 0.7];
  g.strokeStyle = c.alpha(col.muted, 0.3);
  g.lineWidth = 1;
  g.setLineDash([2, 5]);
  for (const pivot of pivots) {
    g.beginPath();
    g.moveTo(pivot, barY);
    g.lineTo(pivot, barY + length);
    g.stroke();
  }
  g.setLineDash([]);
  const k = stiffnessShown(s, rite, reduced);
  const a = { x: pivots[0] + Math.sin(amplitude * motion.first) * length, y: barY + Math.cos(amplitude * motion.first) * length };
  const b = { x: pivots[1] + Math.sin(amplitude * motion.second) * length, y: barY + Math.cos(amplitude * motion.second) * length };
  spring(g, c, a, b, radius, k, v);
  bob(g, c, pivots[0], barY, length, amplitude * motion.first, radius, col.accent2);
  bob(g, c, pivots[1], barY, length, amplitude * motion.second, radius, col.accent);
  text(g, c, 'first: ' + Math.round(motion.firstReach * 100) + '%', pivots[0], h * 0.62, size, c.alpha(col.fg, 0.9));
  text(g, c, 'second: ' + Math.round(motion.secondReach * 100) + '%', pivots[1], h * 0.62, size, c.alpha(col.fg, 0.9));
  text(g, c, 'spring at ' + k + ' of 100', w / 2, h * 0.055, size, c.alpha(col.fg, 0.9));
  text(g, c, 'one breath is ' + plan.breath + ' seconds; alone, each swings once in ' + OWN, w / 2, h * 0.655, Math.max(8, size * 0.85), c.alpha(col.muted, 0.95), 'center', w * 0.9);
  springRuler(g, w, h, c, plan, s, v, size, now);
}

function springBlank(plan) {
  return { k: plan.open, kFrom: plan.open, kAt: -1, sets: 0, runs: [], probes: [], replay: null, loop: false, t: 0, doneAt: -1 };
}

function springPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  const s = springBlank(plan);
  s.replay = { k: plan.open, t: v.turn * plan.breath * 2 };
  drawSpring(g, w, h, env, plan, s, v);
}

function springPiece(env, plan) {
  const helps = asked(env).helps;
  // The crossing itself is the verifier -- the pair runs and the ruler says -- so this puzzle has
  // no margin to widen. What the difficulty buys is how many springs the hall will try for you,
  // each one marked on the ruler beside your own runs.
  const probes = [10, 30, 50, 70, 90];
  const sol = springSolution(plan.breath, plan.breaths);
  const then = plan.ask === 'stiffer' ? 'sooner' : 'later';
  const s = springBlank(plan);
  const span = (plan.breaths + 1.5) * plan.breath;
  const draw = (c) => drawSpring(c.g, c.w, c.h, c, plan, s, env.variant || PLAIN);
  const breathsOf = (tau) => (tau / plan.breath).toFixed(1);
  return {
    title: springTitle(plan),
    brief: 'The rite of the handed swing. Two pendulums of the same length, joined by a spring. Only the first is let go, from the side; the spring hands the swing across until the first hangs still and the second has all of it. '
      + 'A stiffer spring hands it across at a different pace. One breath is ' + plan.breath + ' seconds. Each check lets the pair go and leaves its mark on the ruler.',
    goal: 'Set the spring so the swing crosses to the second pendulum in ' + WORDS[plan.breaths] + ' breaths, and say what a ' + plan.ask + ' spring would do.',
    aspect: '16 / 10',
    checkLabel: 'let go',
    steps: [
      { id: 'spring', ask: 'how stiff the spring is', kind: 'range', min: 1, max: 100, step: 1, value: plan.open, low: 'soft', high: 'stiff' },
      { id: 'then', ask: 'with a ' + plan.ask + ' spring than that, the swing crosses', kind: 'choice', options: THEN },
      { id: 'hint', ask: 'one spring tried for you', kind: 'press', count: 1, label: 'try one for me', optional: true }
    ],
    solution: { spring: { value: sol.value, near: sol.near }, then },
    check(c) {
      const k = Math.max(1, Math.min(100, Math.round(Number(c.value('spring')) || plan.open)));
      const tau = crossTime(k);
      const onMark = Math.abs(tau - sol.target) <= sol.tol;
      const thenRight = c.value('then') === then;
      if (!s.runs.some((run) => run.k === k)) s.runs.push({ k, tau, at: s.t });
      s.replay = { k, t: 0 };
      s.loop = false;
      const took = 'crosses in ' + breathsOf(tau) + ' breaths';
      if (onMark && thenRight) return { solved: true, say: took + ': on the mark, the swing handed whole' };
      const parts = [onMark ? took + ': on the mark' : took + (tau < sol.target ? ', too soon' : ', too late')];
      if (!thenRight) parts.push('and the ' + plan.ask + ' spring would not do that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('pair ' + plan.number + ': cross in ' + WORDS[plan.breaths] + ' breaths of ' + plan.breath + ' seconds');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'hint') {
        const tried = s.probes;
        const next = tried.length < helps ? probes.find((k) => !s.runs.some((run) => run.k === k)) : undefined;
        if (next !== undefined) {
          const tau = crossTime(next);
          s.runs.push({ k: next, tau, at: s.t });
          s.probes.push(next);
          c.hint();
          c.status('a spring at ' + next + ' crosses in ' + breathsOf(tau) + ' breaths; its mark is on the ruler');
        } else if (tried.length >= helps) {
          c.status('that is all the hall will try at this difficulty; let go and read the ruler yourself');
        } else {
          c.status('the hall has tried every spring it offers; the rest is between the marks');
        }
      }
      if (id === 'spring') {
        const k = Number(value);
        if (Number.isFinite(k)) {
          const next = Math.max(1, Math.min(100, Math.round(k)));
          if (next !== s.k) {
            // The readout counts to the new stiffness in treads, on a roll of this move's own.
            s.kFrom = stiffnessShown(s, riteOf(c), !!c.reduced);
            s.k = next;
            s.kAt = s.t;
            s.sets += 1;
          }
        }
        c.status('spring at ' + s.k + (s.k < 20 ? ', soft' : s.k > 75 ? ', stiff' : '') + '; let go to see the crossing');
      }
      if (id === 'then') c.status('a ' + plan.ask + ' spring, you say, crosses ' + (value === 'same' ? 'at the same time' : value));
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      if (s.replay) {
        s.replay.t += Math.max(0, dt);
        if (s.replay.t > span) {
          if (s.loop) s.replay.t = 0;
          else s.replay.t = span;
        }
      }
      draw(c);
    },
    end(c) {
      s.loop = true;
      s.replay = { k: s.replay ? s.replay.k : sol.value, t: 0 };
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status('the swing crosses in ' + WORDS[plan.breaths] + ' breaths and comes back; the pair keeps trading it');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the two experiments this card is, and its plan, dealt once from the env's seeded stream
// and kept with that env. Every pass over one card -- the still picture and then every animated
// frame -- asks here, so they are all the same card; dealing per frame instead would re-roll the
// whole experiment thirty times a second (issue #92, and js/feed.js on what animate owes a card).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const spring = env.chance(0.4);
    got = { spring, plan: spring ? springPlan(env) : rackPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'pendulum-hall',
  needsSky: false,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.spring) springPreview(g, w, h, env, d.plan);
    else rackPreview(g, w, h, env, d.plan);
  },
  // A card in motion: the same clocks the piece keeps, read off t through the escapement, so the
  // card ticks the way the piece will. At t = 0 it is the still picture paint left behind.
  animate(g, w, h, env, t) {
    const v = env.variant || PLAIN;
    const d = deal(env);
    if (d.spring) {
      const plan = d.plan;
      const s = springBlank(plan);
      s.t = env.reduced ? 0 : t;
      s.replay = { k: plan.open, t: env.reduced ? v.turn * plan.breath * 2 : (t * 0.6 + v.turn * plan.breath * 2) % ((plan.breaths + 1.5) * plan.breath) };
      drawSpring(g, w, h, env, plan, s, v);
      return;
    }
    const plan = d.plan;
    const s = rackBlank();
    s.t = env.reduced ? 0 : t;
    s.beat = env.reduced ? v.turn * 12 : (t * 1.5 + v.turn * 12) % 60;
    drawRack(g, w, h, env, plan, s, v);
  },
  spark(env) {
    const d = deal(env);
    if (d.spring) {
      const plan = d.plan;
      return {
        title: springTitle(plan),
        text: 'Two pendulums, one spring, one swing to hand across. Set the spring so the swing crosses from the first to the second in ' + WORDS[plan.breaths] + ' breaths, then say what a ' + plan.ask + ' spring would do.',
        mono: 'breath   ' + plan.breath + ' seconds\ncross in ' + plan.breaths + ' breaths\nalone    one swing in ' + OWN + ' seconds',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => springPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: rackTitle(plan),
      text: plan.starts.some((s) => s > 0) ? 'The rack starts one pendulum after another. Use each start beat and period to find the first shared rightward crossing, then pick the ones crossing at beat ' + plan.at + '.' : 'A vigil in beats. Starting together at beat 0, when do they first cross heading right together again, and which cross at beat ' + plan.at + '?',
      mono: 'periods  ' + plan.periods.join(', ') + ' beats\nstarts   ' + plan.starts.join(', ') + '\nasked    beat ' + plan.at,
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => rackPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const pair = carriedSpring(env);
    if (pair) return springPiece(env, pair);
    const rack = carriedRack(env);
    if (rack) return rackPiece(env, rack);
    const d = deal(env);
    return d.spring ? springPiece(env, d.plan) : rackPiece(env, d.plan);
  }
};
