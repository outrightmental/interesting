/* The diary: the visitor's stars over a logbook, kept on the midnight watch. As a card it is one
   of the three puzzles below painted small (paint, spark); as a piece it is that puzzle, and the card
   it was opened from says which. See js/feed.js for what a module is and js/stage.js for what a
   piece is.

   Three puzzles, drawn from where the visitor's stars sit -- their places, never their words -- and
   filled out with stars invented from the seed when the sky has too few, so a sky of one star
   still makes a whole puzzle:

     call them back   A memory. Four to seven lettered stars come out one at a time, each for a
                      moment, and then rest. Put them in the order they came. A wrong check says
                      how many stand in the right place and no more; "show it again" replays the
                      sky at the price of a hint.
     the false lines  A deduction. The sky is drawn with its meridian and its horizon, the stars
                      lettered, and the logbook under it has five to seven lines about them -- which
                      is highest, how many lie west of the meridian, whether one is west of
                      another. Every line can be checked against the sky, and exactly two are
                      false. Find them. A wrong check says whether one of the two is right.
     the second watch A comparison. The first watch drew the sky and the second drew it again,
                      side by side, and one star is not where it was. Name it, and the way it
                      went. A wrong check says which of the two is right and no more; the
                      hint, at its price, names the half of the sky the mover is in.

   A card and the feature it opens as are one entry: the spark puts the whole plan on its spec as
   `of` -- the stars, the sequence, the lines -- and piece(env) opens on that rather than rolling
   another. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const LETTERS = 'ABCDEFG';
const PLAIN = { density: 1, scale: 1, turn: 0 };
const OPENER = 'night watch report, midnight:';
// The sky's timing: a pause, then each star for FLASH seconds out of every SLOT.
const LEAD = 1.2;
const FLASH = 0.6;
const SLOT = 0.95;

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

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing drawn here moves along a formula or cuts without a rite: a
   state that changes climbs rite.stair in uneven treads; a thing arriving -- a star coming out, a
   mark on the page, a line of the log -- blinks on with rite.flicker and leaves with one flicker
   back; a surface that becomes set -- a star's halo, the band behind a line marked false, the
   half of the sky the watch names -- develops by its AREA through rite.matte, cell by cell in
   the piece's own pattern, and never by a fade; a line drawn across the page comes in treads.
   Every change is read against the piece's own clock, s.t, which frame() advances: a change
   made at `since` has come came() of its way, which is 1 at once for a visitor who asked for
   less motion and for whatever stood there from the start (since < 0). Each star, line or mark
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

// The cells of a box that the matte lets through at coverage k, filled in the current fillStyle:
// how a surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame
// stays cheap, on a grid fixed to the canvas so the pattern holds still while it grows. `inside`
// keeps the tiling to a shape within the box. At k >= 1 every cell is let through, so a caller
// that wants a solid draws the shape itself instead.
function develop(g, rite, x0, y0, bw, bh, k, inside) {
  if (k <= 0) return;
  const cell = Math.max(rite.cell, Math.ceil(Math.max(bw, bh) / 28));
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

// A disc that is `k` of the way to being there: solid once it is, its cells before that.
function disc(g, rite, x, y, r, k, fill) {
  if (k <= 0) return;
  g.fillStyle = fill;
  if (k >= 1) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    return;
  }
  develop(g, rite, x - r, y - r, r * 2, r * 2, k, (px, py) => (px - x) * (px - x) + (py - y) * (py - y) <= r * r);
}

// A box that is `k` of the way to being there.
function box(g, rite, x0, y0, bw, bh, k, fill) {
  if (k <= 0) return;
  g.fillStyle = fill;
  if (k >= 1) g.fillRect(x0, y0, bw, bh);
  else develop(g, rite, x0, y0, bw, bh, k);
}

/* ---- shared arithmetic ---------------------------------------------------------------------- */

function dials(env) {
  const v = env && env.variant;
  const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
  return v && typeof v === 'object' ? { density: num(v.density, 1), scale: num(v.scale, 1), turn: num(v.turn, 0) } : PLAIN;
}

function range(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
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

function okPoints(list, n0, n1) {
  return Array.isArray(list) && list.length >= n0 && list.length <= n1
    && list.every((p) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
}

function copyPoints(list) {
  return list.map((p) => ({ x: p.x, y: p.y }));
}

// n stars in a square of hundredths, each at least `gap` from the rest: the visitor's stars first,
// by where they sit, then stars invented from the seed when the sky has too few.
function gather(env, n, gap, box) {
  const pts = [];
  const far = (p) => pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= gap);
  const into = (x, y) => ({ x: Math.round(box[0] + x / 100 * (box[1] - box[0])), y: Math.round(box[2] + y / 100 * (box[3] - box[2])) });
  for (const s of (Array.isArray(env.stars) ? env.stars : [])) {
    if (pts.length >= n) break;
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = into(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    if (far(p)) pts.push(p);
  }
  for (let guard = 0; pts.length < n; guard++) {
    const p = into(env.rnd() * 100, env.rnd() * 100);
    if (far(p) || guard > 300) pts.push(p);
  }
  return pts;
}

/* ---- drawing -------------------------------------------------------------------------------- */

function skyTint(env) {
  return [env.colors.bg2, env.colors.bg];
}

function sky(g, w, split, tint) {
  const grad = g.createLinearGradient(0, 0, 0, split);
  grad.addColorStop(0, tint[0]);
  grad.addColorStop(1, tint[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, split);
}

function ring(g, x, y, r, color, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

// Lines between stars along a path, in the order given. `reach` draws only that fraction of the
// last segment, so a path can come in treads.
function path(g, pts, color, reach) {
  if (pts.length < 2) return;
  g.lineWidth = 1;
  g.strokeStyle = color;
  g.beginPath();
  pts.forEach((p, i) => {
    if (!i) g.moveTo(p.x, p.y);
    else if (i < pts.length - 1 || reach == null) g.lineTo(p.x, p.y);
    else {
      const q = pts[i - 1];
      g.lineTo(q.x + (p.x - q.x) * reach, q.y + (p.y - q.y) * reach);
    }
  });
  g.stroke();
}

// One star: a soft halo, a bright core, and a letter beside it. `glow` is how far it has come out,
// on a stair: the halo of a star that is out develops through the matte as far as the stair has
// it, over the resting halo, and never brightens by alpha.
function star(g, env, p, letter, scale, glow, size, rite) {
  const r = (2 + glow * 2.5) * scale;
  g.fillStyle = env.alpha(env.colors.accent, 0.2);
  g.beginPath();
  g.arc(p.x, p.y, 4.8 * scale, 0, Math.PI * 2);
  g.fill();
  if (glow > 0) disc(g, rite || STILL, p.x, p.y, r * (2.4 + glow * 2), glow, env.alpha(env.colors.accent2, 0.5));
  g.fillStyle = env.alpha(env.colors.fg, 0.95);
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.fill();
  if (letter) {
    g.font = '600 ' + Math.round(size) + 'px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = env.alpha(glow > 0 ? env.colors.accent2 : env.colors.fg, 0.9);
    g.fillText(letter, p.x + r + size * 0.35, p.y - size * 0.55);
  }
}

// The ruled page under the sky: `rows` rules and a margin line at `m`. Returns the rule spacing.
function page(g, w, h, split, env, ink, m, rows) {
  const c = env.colors;
  g.fillStyle = env.mix(c.bg, c.fg, 0.06);
  g.fillRect(0, split, w, h - split);
  const step = (h - split) / (rows + 1);
  g.lineWidth = 1;
  g.strokeStyle = env.alpha(ink, 0.25);
  for (let i = 1; i <= rows; i++) {
    g.beginPath();
    g.moveTo(m * 0.5, split + step * i);
    g.lineTo(w - m * 0.5, split + step * i);
    g.stroke();
  }
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.beginPath();
  g.moveTo(m, split);
  g.lineTo(m, h);
  g.stroke();
  return step;
}

// A line of handwriting on a rule, shrunk a little and then cut short if it would run off the page.
function write(g, text, x, y, maxW, size, color) {
  let s = size;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = '500 ' + s + 'px system-ui, sans-serif';
  while (s > 9 && g.measureText(text).width > maxW) {
    s -= 1;
    g.font = '500 ' + s + 'px system-ui, sans-serif';
  }
  let t = text;
  if (g.measureText(t).width > maxW) {
    while (t.length > 4 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t += '…';
  }
  g.fillStyle = color;
  g.fillText(t, x, y);
}

// The scene's measurements: where the sky gives way to the page (the configuration's turn moves
// it a little), the margin, the hand's size.
function frameOf(w, h, v) {
  const unit = Math.min(w, h);
  return { w, h, split: h * (0.52 + v.turn * 0.08), m: Math.max(18, unit * 0.08), unit, size: Math.max(10, Math.min(20, Math.round(unit * 0.034))) };
}

// Lines of handwriting on the page, one to a rule from the top; `color` may be a function of the
// row, and a row whose colour is null is left blank (a line that is blinking on).
function rows(g, fr, step, lines, color) {
  const size = Math.min(fr.size, step * 0.6);
  lines.forEach((line, i) => {
    const col = typeof color === 'function' ? color(i) : color;
    if (col) write(g, line, fr.m + size * 0.5, fr.split + step * (i + 1) - size * 0.3, fr.w - fr.m * 2 - size, size, col);
  });
}

// The stars as points in the sky above the page.
function placed(points, fr, top) {
  const pad = fr.m * 0.6;
  const y0 = top || pad;
  return points.map((p) => ({ x: pad + p.x / 100 * (fr.w - pad * 2), y: y0 + p.y / 100 * (fr.split - y0 - pad) }));
}

/* ---- call them back: a memory --------------------------------------------------------------- */

function recallPlan(env) {
  const n = env.chance(0.3) ? 7 : env.int(4, 6);
  const points = gather(env, n, 16, [8, 92, 10, 90]);
  let seq = shuffled(env, range(n));
  for (let guard = 0; guard < 12 && seq.every((v, i) => v === i); guard++) seq = shuffled(env, range(n));
  if (seq.every((v, i) => v === i)) seq.reverse();
  return { kind: 'recall', number: 1 + env.int(0, 398), points, seq };
}

function carriedRecall(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'recall' || !okPoints(p.points, 4, 7)) return null;
  const n = p.points.length;
  if (!isPerm(p.seq, n) || p.seq.every((v, i) => v === i)) return null;
  if (!Number.isInteger(p.number) || p.number < 1 || p.number > 399) return null;
  return { kind: 'recall', number: p.number, points: copyPoints(p.points), seq: p.seq.slice() };
}

function recallTitle(plan) {
  return 'entry ' + plan.number + ': call back ' + WORDS[plan.points.length];
}

// Which star is out at `tp` seconds into the showing, or -1, and how far into its moment it is
// (`into`, 0..1); which star is just resting again and how far it has gone (`leaving`, `gone`);
// and whether the showing is over.
function showing(plan, tp) {
  const none = { lit: -1, into: 0, leaving: -1, gone: 1, over: false };
  if (tp < LEAD) return none;
  const i = Math.floor((tp - LEAD) / SLOT);
  if (i >= plan.seq.length) return Object.assign({}, none, { over: true });
  const phase = tp - LEAD - i * SLOT;
  if (phase < FLASH) return { lit: plan.seq[i], into: phase / FLASH, leaving: -1, gone: 1, over: false };
  return { lit: -1, into: 0, leaving: plan.seq[i], gone: (phase - FLASH) / (SLOT - FLASH), over: false };
}

// The showing as it opens: the clock at zero, the showing from the start, nothing done, no order
// given and no star tapped (-1 is "never").
function recallState(n, t) {
  return { t: t || 0, from: 0, doneAt: -1, order: null, taps: [], tapAt: new Array(n).fill(-1), replays: 0 };
}

function recallScene(g, w, h, c, plan, s, v) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  sky(g, w, fr.split, skyTint(c));
  const pts = placed(plan.points, fr);
  const show = showing(plan, s.t - s.from);
  const doneP = came(s, s.doneAt, 2.5, reduced);
  const done = s.doneAt >= 0;
  if (done && rite.flicker(doneP)) {
    // The order they came, drawn from star to star in treads: a segment at a time, the last of
    // them reaching across as far as the stair has it.
    const seg = plan.points.length - 1;
    const far = rite.stair(doneP, seg) * seg;
    const whole = Math.min(seg, Math.floor(far));
    const line = plan.seq.slice(0, whole + 2).map((i) => pts[i]);
    path(g, line, c.alpha(gold, 0.6), whole >= seg ? null : rite.stair(far - whole, 3));
  }
  pts.forEach((p, i) => {
    const tapped = s.taps ? s.taps.indexOf(i) : -1;
    const own = rite.at(0x57a + i);
    // A star coming out develops through the matte and blinks on; one resting again goes back
    // down the stair, its halo taken back cell by cell.
    let glow = 0;
    if (show.lit === i) glow = reduced ? 1 : own.stair(Math.min(1, show.into * 2.5));
    else if (show.leaving === i) glow = reduced ? 0 : 1 - own.stair(show.gone);
    star(g, c, p, LETTERS[i], v.scale, glow, fr.size, rite);
    if (show.lit === i && (reduced || own.flicker(show.into))) ring(g, p.x, p.y, fr.unit * (0.035 + 0.015 * own.stair(show.into)), c.alpha(gold, 0.8), 1.5);
    // The ring and number of a star the visitor has tapped blink on and widen in treads; when the
    // order is given and the taps start over, each leaves with one flicker back.
    const tp = came(s, s.tapAt[i], 0.7, reduced);
    if (tapped >= 0 ? own.flicker(tp) : (tp < 1 && own.flicker(1 - tp))) {
      ring(g, p.x, p.y, fr.unit * (0.02 + 0.008 * own.stair(tp)), c.alpha(gold, 0.85), 1.2);
      if (tapped >= 0) {
        g.font = '500 ' + Math.round(fr.size * 0.8) + 'px system-ui, sans-serif';
        g.fillStyle = c.alpha(gold, 0.95);
        g.fillText(String(tapped + 1), p.x + fr.size * 0.5, p.y + fr.size * 0.6);
      }
    }
  });
  const step = page(g, w, h, fr.split, c, ink, fr.m, Math.max(3, Math.round(4 * v.density)));
  const lines = [OPENER + ' entry ' + plan.number];
  // The second line changes as the showing goes, and when it is written up: each change blinks on.
  const told = done && rite.flicker(doneP);
  const played = s.t - s.from;
  const sinceLine = played < LEAD ? played : show.over ? played - LEAD - plan.seq.length * SLOT : played - LEAD;
  const lineOn = reduced || rite.at(0x11e).flicker(Math.min(1, sinceLine / 0.5));
  if (told) lines.push('in the order they came: ' + plan.seq.map((i) => LETTERS[i]).join(', '));
  else lines.push(show.over ? 'they came out one at a time, and rested.' : played < LEAD ? 'the stars are coming out.' : 'one at a time.');
  if (s.order) lines.push('called back: ' + s.order.map((i) => LETTERS[i]).join(', '));
  rows(g, fr, step, lines, (i) => (i === 0 ? c.alpha(gold, 0.95) : i === 1 && !told && !lineOn ? null : c.alpha(c.colors.fg, 0.85)));
}

function recallPreview(g, w, h, env, plan, t) {
  recallScene(g, w, h, env, plan, recallState(plan.points.length, t), dials(env));
}

function recallPiece(env, plan) {
  const n = plan.points.length;
  const v = dials(env);
  const helps = asked(env).helps;
  const s = recallState(n, 0);
  s.order = range(n);
  const draw = (c) => recallScene(c.g, c.w, c.h, c, plan, s, v);
  const inPlace = (order) => order.filter((item, i) => item === plan.seq[i]).length;
  return {
    title: recallTitle(plan),
    brief: 'A vigil of memory. On the midnight watch, ' + WORDS[n] + ' stars come out one at a time, each for a moment, and then they rest. The sky plays once from the start.',
    goal: 'Put the stars in the order they came out.',
    aspect: '4 / 3',
    checkLabel: 'check the entry',
    steps: [
      { id: 'order', ask: 'the stars, first to last: arrange them here, or tap them in that order', kind: 'order', items: range(n).map((i) => ({ label: 'star ' + LETTERS[i], value: i })) },
      { id: 'again', ask: 'see the sky once more', kind: 'press', count: 1, label: 'show it again', optional: true }
    ],
    solution: { order: plan.seq.slice() },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, n) ? value : s.order;
      const k = inPlace(order);
      return {
        solved: k === n,
        say: k === n ? 'all ' + WORDS[n] + ' back, in the order they came'
          : k === 0 ? 'none of them is called back in its place yet' : WORDS[k] + ' of ' + WORDS[n] + ' called back in the right place'
      };
    },
    start(c) {
      c.status('watch the sky');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, n)) {
        s.order = value.slice();
        c.status('called back: ' + s.order.map((i) => LETTERS[i]).join(', '));
      }
      if (id === 'again') {
        // How many times the watch is replayed is what the dial buys: five at gentle, one at
        // fierce, and a sky that has run its allowance says so rather than quietly doing nothing.
        if (s.replays < helps) {
          s.replays += 1;
          s.from = s.t;
          c.hint();
          c.status('once more: watch the sky' + (s.replays >= helps ? ' (the last showing at this difficulty)' : ''));
        } else {
          c.status('the sky has shown itself as often as this difficulty allows; the order is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap the stars in the order they came; the order on the rail follows.
      const fr = frameOf(c.w, c.h, v);
      const pts = placed(plan.points, fr);
      let best = -1;
      let bd = Infinity;
      pts.forEach((p, i) => {
        const d = Math.hypot(p.x - x * c.w, p.y - y * c.h);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0 || bd > fr.unit * 0.09) return;
      if (s.taps.includes(best)) {
        c.status('star ' + LETTERS[best] + ' is already in your order; keep going');
        draw(c);
        return;
      }
      s.taps.push(best);
      s.tapAt[best] = s.t;
      if (s.taps.length === n) {
        s.order = s.taps.slice();
        s.taps = [];
        for (let i = 0; i < n; i++) s.tapAt[i] = s.t;
        c.set('order', s.order.slice());
        c.status('called back: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; check it');
      } else {
        c.status('star ' + LETTERS[best] + ' came ' + ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][s.taps.length - 1] + '; tap the next');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      draw(c);
    },
    end(c) {
      s.doneAt = s.t;
      c.status('entry ' + plan.number + ' written up: ' + plan.seq.map((i) => LETTERS[i]).join(', ') + ', in the order they came');
    }
  };
}

/* ---- the false lines: a deduction ----------------------------------------------------------- */

// Where things stand on the sky: higher is a smaller y; west is a smaller x; the meridian stands
// at x = M, where the plan put it so that every star keeps clear of it.
function byY(points) {
  return range(points.length).sort((a, b) => points[a].y - points[b].y);
}

function byX(points) {
  return range(points.length).sort((a, b) => points[a].x - points[b].x);
}

function westOf(points, i, M) {
  return points[i].x < M;
}

// The meridian nearest the middle of the sky that every star keeps five units clear of, or 0.
function meridianFor(P) {
  for (let step = 0; step <= 14; step++) {
    for (const M of [50 - step, 50 + step]) {
      if (P.every((p) => Math.abs(p.x - M) >= 5)) return M;
    }
  }
  return 0;
}

// Whether a claim holds on the sky, read strictly.
function holds(cl, P, M) {
  const ys = byY(P);
  const xs = byX(P);
  switch (cl.t) {
    case 'highest': return ys[0] === cl.a;
    case 'lowest': return ys[ys.length - 1] === cl.a;
    case 'count': return P.filter((p, i) => (cl.side === 'west') === westOf(P, i, M)).length === cl.k;
    case 'westOf': return P[cl.a].x < P[cl.b].x;
    case 'above': return P[cl.a].y < P[cl.b].y;
    case 'lowestSide': return (cl.side === 'west') === westOf(P, ys[ys.length - 1], M);
    case 'highestSide': return (cl.side === 'west') === westOf(P, ys[0], M);
    case 'nearest': return P.every((p, i) => i === cl.a || Math.abs(p.x - M) > Math.abs(P[cl.a].x - M));
    case 'side': return (westOf(P, cl.a, M) === westOf(P, cl.b, M)) === cl.same;
    case 'most': return (cl.dir === 'west' ? xs[0] : xs[xs.length - 1]) === cl.a;
    default: return false;
  }
}

function claimText(cl) {
  const A = LETTERS[cl.a];
  const B = LETTERS[cl.b];
  switch (cl.t) {
    case 'highest': return A + ' is the highest star';
    case 'lowest': return A + ' is the lowest star';
    case 'count': return (cl.k === 1 ? 'one star lies ' : WORDS[cl.k] + ' stars lie ') + cl.side + ' of the meridian';
    case 'westOf': return A + ' is west of ' + B;
    case 'above': return A + ' is higher than ' + B;
    case 'lowestSide': return 'the lowest star is in the ' + cl.side + ' half';
    case 'highestSide': return 'the highest star is in the ' + cl.side + ' half';
    case 'nearest': return A + ' is the star nearest the meridian';
    case 'side': return A + ' and ' + B + ' are on ' + (cl.same ? 'the same side' : 'opposite sides') + ' of the meridian';
    case 'most': return A + ' is the ' + (cl.dir === 'west' ? 'westernmost' : 'easternmost') + ' star';
    default: return '';
  }
}

// Every claim that holds on the sky by a margin wide enough to read off the drawing.
function trueClaims(P, M) {
  const n = P.length;
  const ys = byY(P);
  const xs = byX(P);
  const out = [];
  if (P[ys[1]].y - P[ys[0]].y >= 6) {
    out.push({ t: 'highest', a: ys[0] });
    out.push({ t: 'highestSide', side: westOf(P, ys[0], M) ? 'west' : 'east' });
  }
  if (P[ys[n - 1]].y - P[ys[n - 2]].y >= 6) {
    out.push({ t: 'lowest', a: ys[n - 1] });
    out.push({ t: 'lowestSide', side: westOf(P, ys[n - 1], M) ? 'west' : 'east' });
  }
  if (P[xs[1]].x - P[xs[0]].x >= 6) out.push({ t: 'most', dir: 'west', a: xs[0] });
  if (P[xs[n - 1]].x - P[xs[n - 2]].x >= 6) out.push({ t: 'most', dir: 'east', a: xs[n - 1] });
  const west = P.filter((p) => p.x < M).length;
  out.push({ t: 'count', side: 'west', k: west });
  out.push({ t: 'count', side: 'east', k: n - west });
  const near = range(n).sort((a, b) => Math.abs(P[a].x - M) - Math.abs(P[b].x - M));
  if (Math.abs(P[near[1]].x - M) - Math.abs(P[near[0]].x - M) >= 5) out.push({ t: 'nearest', a: near[0] });
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      if (P[b].x - P[a].x >= 7) out.push({ t: 'westOf', a, b });
      if (P[b].y - P[a].y >= 7) out.push({ t: 'above', a, b });
      if (a < b) out.push({ t: 'side', a, b, same: westOf(P, a, M) === westOf(P, b, M) });
    }
  }
  return out;
}

// The claim turned false: another star named, the count off by one, the two swapped, the side
// changed. Verified against the sky by the caller.
function negated(env, cl, n) {
  const other = (a) => (a + env.int(1, n - 1)) % n;
  switch (cl.t) {
    case 'highest':
    case 'lowest':
    case 'nearest': return { t: cl.t, a: other(cl.a) };
    case 'most': return { t: 'most', dir: cl.dir, a: other(cl.a) };
    case 'count': return { t: 'count', side: cl.side, k: cl.k === 0 ? 1 : cl.k === n ? n - 1 : cl.k + (env.chance(0.5) ? 1 : -1) };
    case 'westOf':
    case 'above': return { t: cl.t, a: cl.b, b: cl.a };
    case 'lowestSide':
    case 'highestSide': return { t: cl.t, side: cl.side === 'west' ? 'east' : 'west' };
    case 'side': return { t: 'side', a: cl.a, b: cl.b, same: !cl.same };
    default: return null;
  }
}

// A varied handful: no two claims of one kind, the pairwise kinds last.
function handful(env, claims, count) {
  const pool = shuffled(env, claims);
  const kinds = new Set();
  const out = [];
  for (const cl of pool) {
    const kind = cl.t + (cl.t === 'count' || cl.t === 'most' ? (cl.side || cl.dir) : '');
    if (kinds.has(kind)) continue;
    kinds.add(kind);
    out.push(cl);
    if (out.length === count) break;
  }
  return out;
}

// A sky that always yields a full handful of claims, for the rare seed whose own stars do not.
const SPARE_SKY = [{ x: 14, y: 22 }, { x: 38, y: 70 }, { x: 61, y: 12 }, { x: 80, y: 48 }, { x: 70, y: 84 }];

function linesPlan(env) {
  const number = 1 + env.int(0, 398);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = attempt < 30 ? env.int(4, 7) : 5;
    const points = attempt < 30 ? gather(env, n, 14, [6, 94, 8, 88]) : copyPoints(SPARE_SKY);
    const meridian = meridianFor(points);
    if (!meridian) continue;
    const truths = trueClaims(points, meridian);
    const count = env.chance(0.3) ? 7 : env.int(5, 6);
    const chosen = handful(env, truths, count);
    if (chosen.length < count) continue;
    const lies = shuffled(env, range(count)).slice(0, 2).sort((a, b) => a - b);
    const claims = chosen.map((cl, i) => (lies.includes(i) ? negated(env, cl, n) : cl));
    if (claims.some((cl) => !cl)) continue;
    const truth = claims.map((cl) => holds(cl, points, meridian));
    if (truth.filter((t) => !t).length !== 2 || lies.some((i) => truth[i])) continue;
    last = { kind: 'lines', number, points, meridian, claims, lies };
    return last;
  }
  return last;
}

function okClaim(cl, n) {
  if (!cl || typeof cl !== 'object') return false;
  const star = (i) => Number.isInteger(i) && i >= 0 && i < n;
  switch (cl.t) {
    case 'highest':
    case 'lowest':
    case 'nearest': return star(cl.a);
    case 'most': return star(cl.a) && (cl.dir === 'west' || cl.dir === 'east');
    case 'count': return (cl.side === 'west' || cl.side === 'east') && Number.isInteger(cl.k) && cl.k >= 0 && cl.k <= n;
    case 'westOf':
    case 'above': return star(cl.a) && star(cl.b) && cl.a !== cl.b;
    case 'lowestSide':
    case 'highestSide': return cl.side === 'west' || cl.side === 'east';
    case 'side': return star(cl.a) && star(cl.b) && cl.a !== cl.b && typeof cl.same === 'boolean';
    default: return false;
  }
}

function carriedLines(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'lines' || !okPoints(p.points, 4, 7)) return null;
  const n = p.points.length;
  if (!Number.isInteger(p.number) || p.number < 1 || p.number > 399) return null;
  if (!Number.isInteger(p.meridian) || p.meridian < 36 || p.meridian > 64 || !p.points.every((q) => Math.abs(q.x - p.meridian) >= 5)) return null;
  if (!Array.isArray(p.claims) || p.claims.length < 5 || p.claims.length > 7 || !p.claims.every((cl) => okClaim(cl, n))) return null;
  const claims = p.claims.map((cl) => ({ t: cl.t, a: cl.a, b: cl.b, k: cl.k, side: cl.side, dir: cl.dir, same: cl.same }));
  const truth = claims.map((cl) => holds(cl, p.points, p.meridian));
  const lies = range(claims.length).filter((i) => !truth[i]);
  if (lies.length !== 2 || !Array.isArray(p.lies) || p.lies.length !== 2 || !lies.every((i, k) => p.lies[k] === i)) return null;
  return { kind: 'lines', number: p.number, points: copyPoints(p.points), meridian: p.meridian, claims, lies };
}

function linesTitle(plan) {
  return 'entry ' + plan.number + ': two false lines';
}

// The log as it opens: no line marked or vouched for, nothing struck out, and every mark that
// comes or goes timed against the piece's clock (-1 is "never").
function linesState(count) {
  return { t: 0, doneAt: -1, picked: [], vouched: [], markAt: new Array(count).fill(-1), vouchAt: new Array(count).fill(-1) };
}

function linesScene(g, w, h, c, plan, s, v) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const top = fr.size * 1.8;
  sky(g, w, fr.split, skyTint(c));
  // The meridian where the plan stands it, and the horizon where the page begins, west on the left.
  const pts = placed(plan.points, fr, top);
  const mx = fr.m * 0.6 + plan.meridian / 100 * (w - fr.m * 1.2);
  g.strokeStyle = c.alpha(c.colors.muted, 0.55);
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  g.beginPath();
  g.moveTo(mx, top * 0.4);
  g.lineTo(mx, fr.split);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = c.alpha(gold, 0.6);
  g.beginPath();
  g.moveTo(0, fr.split - 1);
  g.lineTo(w, fr.split - 1);
  g.stroke();
  g.font = '500 ' + Math.round(fr.size * 0.8) + 'px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = c.alpha(c.colors.muted, 0.9);
  g.textAlign = 'center';
  g.fillText('meridian', mx, top * 0.5);
  g.textBaseline = 'bottom';
  g.textAlign = 'left';
  g.fillText('W · horizon', fr.m * 0.4, fr.split - 3);
  g.textAlign = 'right';
  g.fillText('horizon · E', w - fr.m * 0.4, fr.split - 3);
  pts.forEach((p, i) => star(g, c, p, LETTERS[i], v.scale, 0, fr.size, rite));
  // The logbook: the entry, then the lines, numbered. A line marked false has a band develop
  // behind it through the matte and a cross blink on beside it; a vouched-for line gets its tick
  // the same way; a corrected log strikes its two false lines out in treads and turns them gold.
  const count = plan.claims.length;
  const step = page(g, w, h, fr.split, c, ink, fr.m, count + 1);
  const picked = s.picked || [];
  const vouched = s.vouched || [];
  const done = s.doneAt >= 0;
  const doneP = came(s, s.doneAt, 2.2, reduced);
  const size = Math.min(fr.size, step * 0.6);
  const bands = range(count).map((i) => {
    const own = rite.at(0xba4d + i);
    const mp = came(s, s.markAt[i], 0.8, reduced);
    const on = picked.includes(i);
    return { k: on ? own.stair(mp) : (mp < 1 ? 1 - own.stair(mp) : 0), cross: on ? own.flicker(mp) : (mp < 1 && own.flicker(1 - mp)), own };
  });
  bands.forEach((band, i) => {
    const y = fr.split + step * (i + 2) - size * 0.3;
    box(g, rite, fr.m + size * 0.2, y - size * 0.95, w - fr.m * 1.6 - size * 0.2, size * 1.25, band.k, c.alpha(gold, 0.14));
  });
  const lines = [OPENER + ' entry ' + plan.number + ', two lines false'].concat(plan.claims.map((cl, i) => (i + 1) + '. ' + claimText(cl)));
  rows(g, fr, step, lines, (i) => (i === 0 ? c.alpha(gold, 0.95)
    : done && plan.lies.includes(i - 1) && bands[i - 1].own.flicker(doneP) ? c.alpha(gold, 0.9)
      : c.alpha(c.colors.fg, bands[i - 1].k >= 1 && picked.includes(i - 1) ? 1 : 0.85)));
  g.font = '600 ' + Math.round(fr.size * 0.85) + 'px system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  for (let i = 0; i < count; i++) {
    const y = fr.split + step * (i + 2) - fr.size * 0.3;
    if (done && plan.lies.includes(i)) {
      const reach = bands[i].own.stair(doneP);
      if (reach > 0) {
        g.strokeStyle = c.alpha(gold, 0.9);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(fr.m + fr.size * 0.4, y - fr.size * 0.3);
        g.lineTo(fr.m + fr.size * 0.4 + (w - fr.m * 1.1 - fr.size * 0.4) * reach, y - fr.size * 0.3);
        g.stroke();
      }
    } else if (bands[i].cross) {
      g.fillStyle = c.alpha(gold, 0.95);
      g.fillText('×', fr.m - fr.size * 0.3, y);
    } else if (vouched.includes(i) && rite.at(0x7ec + i).flicker(came(s, s.vouchAt[i], 0.7, reduced))) {
      g.fillStyle = c.alpha(ink, 0.95);
      g.fillText('✓', fr.m - fr.size * 0.3, y);
    }
  }
}

function linesPreview(g, w, h, env, plan) {
  linesScene(g, w, h, env, plan, linesState(plan.claims.length), dials(env));
}

function linesPiece(env, plan) {
  const n = plan.points.length;
  const count = plan.claims.length;
  const v = dials(env);
  const helps = asked(env).helps;
  const s = linesState(count);
  const draw = (c) => linesScene(c.g, c.w, c.h, c, plan, s, v);
  // The marks as they change: every line marked or unmarked by `next` is timed from now.
  function mark(next) {
    for (let i = 0; i < count; i++) if (s.picked.includes(i) !== next.includes(i)) s.markAt[i] = s.t;
    s.picked = next;
  }
  return {
    title: linesTitle(plan),
    brief: 'A ledger to correct. The sky is drawn with its meridian and its horizon, west on the left, and the logbook under it says ' + WORDS[count] + ' things about the ' + WORDS[n] + ' stars. Every line can be checked against the drawing. Exactly two are false.',
    goal: 'Find the two false lines.',
    aspect: '4 / 3',
    checkLabel: 'check the log',
    steps: [
      { id: 'lines', ask: 'the two false lines: choose them here, or tap them on the page', kind: 'pick', count: 2, items: plan.claims.map((cl, i) => ({ label: (i + 1) + '. ' + claimText(cl), value: i })) },
      { id: 'hint', ask: 'one line that holds', kind: 'press', count: 1, label: 'vouch for one', optional: true }
    ],
    solution: { lines: plan.lies.slice() },
    check(c) {
      const value = c.value('lines');
      const picked = Array.isArray(value) ? value.map(Number) : [];
      const right = picked.filter((i) => plan.lies.includes(i)).length;
      const solved = picked.length === 2 && right === 2;
      return {
        solved,
        say: solved ? 'both false lines found; the log is corrected' : right === 1 ? 'one of the two is right' : 'neither of those is a false line'
      };
    },
    start(c) {
      c.status('read each line against the sky');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'lines') {
        mark(Array.isArray(value) ? value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < count) : []);
        c.status(s.picked.length ? 'marked false: ' + s.picked.map((i) => 'line ' + (i + 1)).join(' and ') : 'no line marked yet');
      }
      if (id === 'hint') {
        const next = s.vouched.length >= helps ? undefined
          : (range(count).find((i) => !plan.lies.includes(i) && !s.vouched.includes(i) && !s.picked.includes(i))
            || range(count).find((i) => !plan.lies.includes(i) && !s.vouched.includes(i)));
        if (next !== undefined) {
          s.vouched.push(next);
          s.vouchAt[next] = s.t;
          c.hint();
          c.status('line ' + (next + 1) + ' holds: ' + claimText(plan.claims[next]));
        } else if (s.vouched.length >= helps) {
          c.status('that is all the diary will vouch for at this difficulty; read the rest against the sky');
        } else {
          c.status('every true line has been vouched for; the two left are the false ones');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap a line on the page to mark it false (or unmark it); the pick on the rail follows.
      const fr = frameOf(c.w, c.h, v);
      const step = (c.h - fr.split) / (count + 2);
      const i = Math.floor((y * c.h - fr.split) / step) - 1;
      if (y * c.h < fr.split || i < 0 || i >= count) return;
      const picked = s.picked.filter((k) => k !== i);
      if (picked.length === s.picked.length) {
        if (picked.length >= 2) picked.shift();
        picked.push(i);
      }
      mark(picked.sort((a, b) => a - b));
      // The rail takes the pick once it is a pair, as the pick knob itself would.
      if (s.picked.length === 2) c.set('lines', s.picked.slice());
      c.status(s.picked.length === 2 ? 'marked false: line ' + (s.picked[0] + 1) + ' and line ' + (s.picked[1] + 1) + '; check the log'
        : s.picked.length === 1 ? 'marked false: line ' + (s.picked[0] + 1) + '; one more' : 'no line marked');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      draw(c);
    },
    end(c) {
      s.doneAt = s.t;
      c.status('struck out: line ' + (plan.lies[0] + 1) + ' and line ' + (plan.lies[1] + 1) + '. the rest of the entry stands');
    }
  };
}

/* ---- the second watch: a comparison --------------------------------------------------------- */

// The first watch drew the sky; the second drew it again, and one star is not where it was. The
// move is along one of the four ways and far enough to read, and no star lands on another.
const WAYS = [
  { label: 'north, higher', value: 'north' },
  { label: 'south, lower', value: 'south' },
  { label: 'east, to the right', value: 'east' },
  { label: 'west, to the left', value: 'west' }
];
const MOVE = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const capital = (text) => text[0].toUpperCase() + text.slice(1);

function driftOk(points, star, to) {
  if (!to || !Number.isInteger(to.x) || !Number.isInteger(to.y) || to.x < 4 || to.x > 96 || to.y < 4 || to.y > 96) return false;
  return points.every((p, i) => i === star || Math.hypot(p.x - to.x, p.y - to.y) >= 10);
}

// The way the star went, or null when it went no way the log would write.
function driftWay(plan) {
  const p = plan.points[plan.star];
  const dx = plan.to.x - p.x;
  const dy = plan.to.y - p.y;
  if ((dx === 0) === (dy === 0) || Math.abs(dx) + Math.abs(dy) < 8) return null;
  return dx > 0 ? 'east' : dx < 0 ? 'west' : dy < 0 ? 'north' : 'south';
}

function driftPlan(env) {
  const number = 1 + env.int(0, 398);
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = env.int(5, 7);
    const points = gather(env, n, 16, [10, 90, 12, 88]);
    const star = env.int(0, n - 1);
    const way = WAYS[env.int(0, 3)].value;
    const by = env.int(14, 22);
    const to = { x: points[star].x + MOVE[way][0] * by, y: points[star].y + MOVE[way][1] * by };
    if (driftOk(points, star, to)) return { kind: 'drift', number, points, star, to };
  }
  return { kind: 'drift', number, points: copyPoints(SPARE_SKY), star: 0, to: { x: 32, y: 22 } };
}

function carriedDrift(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'drift' || !okPoints(p.points, 5, 7)) return null;
  if (!Number.isInteger(p.number) || p.number < 1 || p.number > 399) return null;
  if (!Number.isInteger(p.star) || p.star < 0 || p.star >= p.points.length || !driftOk(p.points, p.star, p.to)) return null;
  const plan = { kind: 'drift', number: p.number, points: copyPoints(p.points), star: p.star, to: { x: p.to.x, y: p.to.y } };
  return driftWay(plan) ? plan : null;
}

function driftTitle(plan) {
  return 'entry ' + plan.number + ': the second watch';
}

function driftSecond(plan) {
  const q = copyPoints(plan.points);
  q[plan.star] = { x: plan.to.x, y: plan.to.y };
  return q;
}

// The two drawings side by side in the sky: the first watch on the left, the second on the right.
function driftPanel(points, x0, pw, fr) {
  const top = fr.size * 1.8;
  const pad = fr.m * 0.45;
  return points.map((p) => ({ x: x0 + pad + p.x / 100 * (pw - pad * 2), y: top + p.y / 100 * (fr.split - top - pad) }));
}

// The watches as they open: no star marked (and none marked before it), no half named, nothing
// written up, and every change timed against the piece's clock (-1 is "never").
function driftState() {
  return { t: 0, doneAt: -1, picked: -1, was: -1, pickAt: -1, half: null, halfAt: -1 };
}

function driftScene(g, w, h, c, plan, s, v) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const top = fr.size * 1.8;
  const pw = w / 2;
  const scale = v.scale * 0.85;
  const size = fr.size * 0.85;
  sky(g, w, fr.split, skyTint(c));
  if (s.half) {
    // The half of the sky the watch names develops over both drawings through the matte.
    const k = rite.at(0x4a1f).stair(came(s, s.halfAt, 1.3, reduced));
    for (const x0 of [0, pw]) box(g, rite, x0 + (s.half === 'west' ? 0 : pw / 2), top * 0.4, pw / 2, fr.split - top * 0.4, k, c.alpha(gold, 0.07));
  }
  g.strokeStyle = c.alpha(c.colors.muted, 0.55);
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  g.beginPath();
  g.moveTo(pw, top * 0.4);
  g.lineTo(pw, fr.split);
  g.stroke();
  g.setLineDash([]);
  g.font = '500 ' + Math.round(fr.size * 0.8) + 'px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = c.alpha(c.colors.muted, 0.9);
  g.fillText('first watch', pw * 0.5, top * 0.5);
  g.fillText('second watch', pw * 1.5, top * 0.5);
  const first = driftPanel(plan.points, 0, pw, fr);
  const later = driftPanel(driftSecond(plan), pw, pw, fr);
  const done = s.doneAt >= 0;
  const doneP = came(s, s.doneAt, 2.4, reduced);
  const told = rite.at(0xd0e);
  if (done) {
    // Written up: the place the star left blinks on, and the way it went is drawn across in
    // treads from there to where it stands now.
    const from = driftPanel(plan.points, pw, pw, fr)[plan.star];
    if (told.flicker(doneP)) ring(g, from.x, from.y, 3 * scale, c.alpha(gold, 0.6), 1);
    const reach = told.stair(doneP);
    if (reach > 0) path(g, [from, later[plan.star]], c.alpha(gold, 0.8), reach);
  }
  first.forEach((p, i) => star(g, c, p, LETTERS[i], scale, 0, size, rite));
  later.forEach((p, i) => star(g, c, p, LETTERS[i], scale, done && i === plan.star ? told.stair(doneP) : 0, size, rite));
  // The star marked as the mover wears a ring on both drawings; it blinks on and widens in treads,
  // and the ring on a star marked before it leaves with one flicker back.
  const pp = came(s, s.pickAt, 0.7, reduced);
  const own = rite.at(0x91c);
  const wear = (i, rr) => {
    ring(g, first[i].x, first[i].y, rr, c.alpha(gold, 0.85), 1.2);
    ring(g, later[i].x, later[i].y, rr, c.alpha(gold, 0.85), 1.2);
  };
  if (s.picked >= 0 && s.picked < first.length && own.flicker(pp)) wear(s.picked, fr.unit * (0.022 + 0.008 * own.stair(pp)));
  if (s.was >= 0 && s.was < first.length && s.was !== s.picked && pp < 1 && own.flicker(1 - pp)) wear(s.was, fr.unit * 0.03);
  const step = page(g, w, h, fr.split, c, ink, fr.m, Math.max(4, Math.round(4 * v.density)));
  const lines = [OPENER + ' entry ' + plan.number + ', the second watch', 'the sky as the first watch drew it, and as it stands now.'];
  const written = done && told.flicker(doneP);
  lines.push(written ? 'star ' + LETTERS[plan.star] + ' has drifted ' + driftWay(plan) + ' since the first watch.' : 'one star has drifted. which, and which way?');
  if (s.half) lines.push('the one that moved is in the ' + s.half + ' half.');
  const halfOn = !s.half || rite.at(0x4a1f).flicker(came(s, s.halfAt, 1.3, reduced));
  rows(g, fr, step, lines, (i) => (i === 0 ? c.alpha(gold, 0.95) : i === 3 && !halfOn ? null : c.alpha(c.colors.fg, 0.85)));
}

function driftPreview(g, w, h, env, plan) {
  driftScene(g, w, h, env, plan, driftState(), dials(env));
}

function driftPiece(env, plan) {
  const n = plan.points.length;
  const v = dials(env);
  const helps = asked(env).helps;
  const way = driftWay(plan);
  const s = driftState();
  const draw = (c) => driftScene(c.g, c.w, c.h, c, plan, s, v);
  const wayOf = (value) => (WAYS.find((o) => o.value === value) || {}).label;
  function pick(i) {
    if (i === s.picked) return;
    s.was = s.picked;
    s.picked = i;
    s.pickAt = s.t;
  }
  return {
    title: driftTitle(plan),
    brief: 'The first watch drew the sky on the left; the second drew it again before midnight, on the right. ' + capital(WORDS[n]) + ' stars, lettered the same in both. One of them has drifted since the first drawing; the rest have kept their places.',
    goal: 'Name the star that drifted, and the way it went.',
    aspect: '4 / 3',
    checkLabel: 'compare the watches',
    steps: [
      { id: 'star', ask: 'the star that drifted: choose it here, or tap it on either sky', kind: 'pick', count: 1, items: range(n).map((i) => ({ label: 'star ' + LETTERS[i], value: i })) },
      { id: 'way', ask: 'the way it went', kind: 'choice', options: WAYS },
      // The watch has one thing to say, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'half', ask: 'which half of the sky holds the one that moved', kind: 'press', count: 1, label: 'narrow it down', optional: true } : null
    ].filter(Boolean),
    solution: { star: [plan.star], way },
    check(c) {
      const picked = c.value('star');
      const i = Array.isArray(picked) && picked.length ? Number(picked[0]) : -1;
      const starRight = i === plan.star;
      const wayRight = c.value('way') === way;
      if (starRight && wayRight) return { solved: true, say: 'star ' + LETTERS[plan.star] + ' drifted ' + way + ' between the watches; the entry is written up' };
      if (!starRight && !wayRight) return { solved: false, say: 'that star kept its place, and the drift did not go that way' };
      return { solved: false, say: starRight ? 'that is the star, but the drift did not go that way' : 'the way is right, but that star kept its place' };
    },
    start(c) {
      c.status('read the second drawing against the first, star by star');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'star') {
        pick(Array.isArray(value) && value.length ? Number(value[0]) : -1);
        c.status(s.picked >= 0 ? 'star ' + LETTERS[s.picked] + ' marked as the one that drifted' : 'no star marked yet');
      }
      if (id === 'way') c.status('drifted ' + wayOf(value) + ', you say');
      if (id === 'half') {
        if (!s.half) {
          s.half = plan.points[plan.star].x < 50 ? 'west' : 'east';
          s.halfAt = s.t;
          c.hint();
          c.status('the one that moved is in the ' + s.half + ' half of the sky');
        } else {
          c.status('the half is named; the star is yours to find');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap a star on either drawing to name it; the pick on the rail follows.
      const fr = frameOf(c.w, c.h, v);
      if (y * c.h > fr.split) return;
      const pw = c.w / 2;
      const x0 = x * c.w < pw ? 0 : pw;
      const pts = driftPanel(x0 ? driftSecond(plan) : plan.points, x0, pw, fr);
      let best = -1;
      let bd = Infinity;
      pts.forEach((p, i) => {
        const d = Math.hypot(p.x - x * c.w, p.y - y * c.h);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0 || bd > fr.unit * 0.09) return;
      pick(best);
      c.set('star', [best]);
      c.status('star ' + LETTERS[best] + ' marked as the one that drifted; say the way it went');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      draw(c);
    },
    end(c) {
      s.doneAt = s.t;
      c.status('entry ' + plan.number + ' written up: star ' + LETTERS[plan.star] + ' drifted ' + way + ' between the watches; the rest held');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the three entries a seed is dealt, from one roll so that paint, spark and piece agree.
function dealt(env) {
  const r = env.rnd();
  return r < 0.36 ? 'recall' : r < 0.7 ? 'lines' : 'drift';
}

export default {
  id: 'constellation-diary',
  needsSky: true,
  paint(g, w, h, env) {
    const kind = dealt(env);
    if (kind === 'recall') recallPreview(g, w, h, env, recallPlan(env), 0);
    else if (kind === 'lines') linesPreview(g, w, h, env, linesPlan(env));
    else driftPreview(g, w, h, env, driftPlan(env));
  },
  spark(env) {
    const kind = dealt(env);
    if (kind === 'drift') {
      const plan = driftPlan(env);
      return {
        title: driftTitle(plan),
        quote: 'One of the ' + WORDS[plan.points.length] + ' stars is not where the first watch left it.',
        text: 'Two drawings of one sky, a watch apart. Find the star that drifted, and the way it went.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => driftPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (kind === 'recall') {
      const plan = recallPlan(env);
      return {
        title: recallTitle(plan),
        quote: WORDS[plan.points.length][0].toUpperCase() + WORDS[plan.points.length].slice(1) + ' stars come out one at a time on the midnight watch.',
        text: 'Watch the sky once, then put the stars in the order they came.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => recallPreview(g, w, h, cardEnv, plan, 0),
        of: plan
      };
    }
    const plan = linesPlan(env);
    return {
      title: linesTitle(plan),
      quote: claimText(plan.claims[0]) + '.',
      text: 'The logbook says ' + WORDS[plan.claims.length] + ' things about the sky, and two of them are false. Read each line against the stars.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => linesPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const recall = carriedRecall(env);
    if (recall) return recallPiece(env, recall);
    const lines = carriedLines(env);
    if (lines) return linesPiece(env, lines);
    const drift = carriedDrift(env);
    if (drift) return driftPiece(env, drift);
    const kind = dealt(env);
    if (kind === 'recall') return recallPiece(env, recallPlan(env));
    if (kind === 'lines') return linesPiece(env, linesPlan(env));
    return driftPiece(env, driftPlan(env));
  }
};
