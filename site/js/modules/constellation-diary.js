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
                      side by side, and one star is not where it was. Name it, the way it
                      went, and how far. Coordinates make the distance readable; the
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
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes. Nothing drawn here moves along a
   formula, and nothing moves without a reason:

     a star coming out   in the showing has its halo cut in behind the piece's edge up its own
                         stair, and its ring cut on at its moment and widened a tread at a time;
                         resting again, it gives the halo back down the stair the way it came.
     a mark              -- a ring on a star tapped or named, a cross or a tick in the margin, a
                         line of the log -- is cut on at its roll's moment (rite.flicker) and stays;
                         one taken away is cut off at its moment, once, and never blinks back. A
                         mark that is not yet on when it is taken away never comes on, and one
                         still on when it is given back simply stays.
     a surface set       -- the band behind a line marked false, the half of the sky the watch
                         names, the halo of a star coming out or of the star that moved -- is cut
                         in by the edge (rite.paint: the part of its box the edge has passed, and a
                         second coat over the half behind the edge's middle) and rests in two
                         shades of its colour split by that edge through its middle: never a fade,
                         a flat wash or a pattern. A disc is a clip with its box painted inside.
                         Taken away, it goes back down its stair from wherever it had reached.
     a line drawn        across the sky or the page -- the order the stars came, the way the mover
                         went, a false line struck out -- reaches across in the stair's few treads.

   Between showings the stars hold still: nothing in them is waiting, so nothing twinkles. Every
   change is read against the piece's own clock, s.t, which frame() advances: a change made at
   `since` has come came() of its way, which is 1 at once for a visitor who asked for less motion
   and for whatever stood there from the start (since < 0). Each star, line or mark moves on a roll
   of its own (rite.at: the same edge, its own treads and moment), so no two step together.

   What a frame costs. The stage asks for a frame sixty times a second, and the diary has something
   new to show in very few of them. A piece notes how long each change it makes goes on moving
   (pace().stir) -- the showing of the sky is one -- and draws the change at once; after that a
   frame does nothing at all unless something is still moving or the canvas is not the one it last
   drew on (a new size, new colours). While something moves, a frame takes a note of the picture it
   would draw, which costs no pixels (sketch), and paints only when that note differs from the last
   picture drawn: a stair holds each tread for a good part of its span, so most of those frames
   have nothing new in them either. The sky's gradient, which never changes while a piece plays,
   is painted once for its size and colours onto a canvas of its own and laid down whole each time
   (plate). */

// The rite of a piece handed none: everything stands where it ends, and a surface is cut by a
// plain upright slice from its left side.
const STILL = {
  stair: () => 1, flicker: () => 1, treads: 1, kind: 'slice', angle: 90,
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

// The rite rolled afresh for one thing this module moves, kept with the rite it was rolled from so
// a frame rolls each one once rather than sixty times a second.
const OWN = new WeakMap();
function own(rite, n) {
  let kept = OWN.get(rite);
  if (!kept) {
    kept = new Map();
    OWN.set(rite, kept);
  }
  let r = kept.get(n);
  if (!r) {
    r = rite.at(n);
    kept.set(n, r);
  }
  return r;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// When a frame has anything new to draw (see "What a frame costs" above). stir(until) says a change
// has just been made that moves until the piece's clock reaches `until`. due() is whether this
// frame could show anything new at all: a change still moving, a change not yet shown, or a canvas
// that is not the one last drawn on. show() puts the picture `paint` makes on the canvas -- if it
// differs from the one already there (or `force`), and otherwise leaves the canvas alone.
function pace() {
  let key = null;
  let seenAt = -Infinity;
  let until = -Infinity;
  let shown = null;
  return {
    stir(at) {
      key = null;
      if (at > until) until = at;
    },
    due(s, c) {
      return key === null || seenAt < until || canvasKey(c) !== key;
    },
    show(s, c, paint, force) {
      const fresh = force || key === null || canvasKey(c) !== key;
      const note = sketch(c.g, paint);
      if (fresh || note !== shown) paint(c.g);
      key = canvasKey(c);
      seenAt = s.t;
      shown = note;
    }
  };
}

// What `paint` would put on the canvas, as a note of every call it makes and every setting it
// writes, taken against a stand-in that paints nothing (text is measured by the real context, so
// a line wraps as it will). Two equal notes are the same picture: a stair holds most of its span
// on one tread, and a frame on the same tread as the last one drawn has nothing new to show.
function sketch(real, paint) {
  const note = [];
  const gradient = (kind, args) => {
    note.push(kind, ...args);
    return { addColorStop: (at, color) => note.push(at, color) };
  };
  const pad = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'canvas') return real.canvas;
      if (k === 'measureText') {
        return (text) => {
          if (t.font) real.font = t.font;
          return real.measureText(text);
        };
      }
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...args) => gradient(k, args);
      return (...args) => note.push(k, ...args);
    },
    set(t, k, v) {
      t[k] = v;
      note.push(k, v);
      return true;
    }
  });
  paint(pad);
  return note.join('\u0001');
}

// The canvas a picture was drawn on, as far as it matters to the picture: its size, its pixels and
// its colours. A canvas sized again is a cleared one.
function canvasKey(c) {
  const col = c.colors || {};
  const cv = c.canvas || (c.g && c.g.canvas) || {};
  return [c.w, c.h, c.dpr, cv.width, cv.height, col.bg, col.bg2, col.accent, col.accent2, col.fg, col.muted, c.reduced ? 1 : 0].join('|');
}

// A part of the picture that stands still while a piece plays -- the sky's gradient, the dearest
// thing drawn here -- painted by `paint` once for this size and these colours onto a canvas of its
// own, w by h from the top left, and laid down whole from then on. A card, painted once, has no
// `cache` and paints it straight; so does a page that has no such canvas to give.
function plate(cache, name, g, w, h, c, paint) {
  const Off = typeof OffscreenCanvas === 'function' ? OffscreenCanvas : null;
  if (!cache || !Off || typeof g.drawImage !== 'function') {
    paint(g);
    return;
  }
  const dpr = Number(c.dpr) > 0 ? Number(c.dpr) : 1;
  const key = canvasKey(c);
  let kept = cache[name];
  if (!kept || kept.key !== key) {
    const canvas = new Off(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)));
    const pg = canvas.getContext('2d');
    if (!pg) {
      paint(g);
      return;
    }
    pg.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(pg);
    kept = { key, canvas };
    cache[name] = kept;
  }
  g.drawImage(kept.canvas, 0, 0, w, h);
}

// A box that is `k` of the way to being there, in `fill`: the part of it the piece's edge has
// passed, and over the half behind the edge's middle a second coat of the same colour. One edge
// moves while it comes or goes, and at rest it is two shades of one colour split by that edge
// through the middle of the box. One path per coat.
function box(g, rite, x0, y0, bw, bh, k, fill) {
  if (k <= 0) return;
  g.fillStyle = fill;
  rite.paint(g, x0, y0, bw, bh, k);
  rite.paint(g, x0, y0, bw, bh, Math.min(k, 0.5));
}

// A disc that is `k` of the way to being there: the circle is a clip, and the box round it is cut
// in inside it.
function disc(g, rite, x, y, r, k, fill) {
  if (k <= 0) return;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  box(g, rite, x - r, y - r, r * 2, r * 2, k, fill);
  g.restore();
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
// on a stair: the halo of a star that is out is cut in behind the piece's edge as far as the stair
// has it, over the resting halo, and grows with it a tread at a time; it never brightens by alpha.
function star(g, env, p, letter, scale, glow, size, rite) {
  const r = (2 + glow * 2.5) * scale;
  g.fillStyle = env.alpha(env.colors.accent, 0.2);
  g.beginPath();
  g.arc(p.x, p.y, 4.8 * scale, 0, Math.PI * 2);
  g.fill();
  if (glow > 0) disc(g, rite || STILL, p.x, p.y, r * (2.4 + glow * 2), glow, env.alpha(env.colors.accent2, 0.38));
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
// row, and a row whose colour is null is left blank (a line not yet cut on).
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

// How long one showing of the sky runs, from its start to the line that says the stars rested.
function shown(plan) {
  return LEAD + SLOT * plan.seq.length + 0.6;
}

// How long a tap's ring takes to be cut on and widened, or to be cut off; and how long the entry
// takes to be written up once it is solved.
const TAP = 0.7;
const WRITTEN = 2.5;

// The showing as it opens: the clock at zero, the showing from the start, nothing done, no order
// given and no star tapped (-1 is "never"). For each star, ringWas, ringR and ringNo are the ring
// it wore when its tap last changed (whether it was on, how far it had widened, its number).
function recallState(n, t) {
  return {
    t: t || 0, from: 0, doneAt: -1, order: null, taps: [], tapAt: new Array(n).fill(-1), replays: 0,
    ringWas: new Array(n).fill(false), ringR: new Array(n).fill(0), ringNo: new Array(n).fill(0)
  };
}

// The ring star i wears for a tap: whether it is on, how far it has widened (0..1) and the number
// beside it. A star in the taps has its ring cut on at its moment -- or kept, if it still wore one
// when it was tapped -- and widened a tread at a time from where it was. When the order is given
// and the taps start over, a star keeps the ring it wore then, if it wore one, and that ring and
// its number are cut off once, at the star's own moment; a ring not yet on never comes on.
function tapRing(rite, s, i, reduced) {
  const its = own(rite, 0x57a + i);
  const tp = came(s, s.tapAt[i], TAP, reduced);
  const tapped = (s.taps || []).indexOf(i);
  const from = s.ringR[i];
  if (tapped >= 0) return { on: s.ringWas[i] || its.flicker(tp) === 1, r: from + (1 - from) * its.stair(tp), no: tapped + 1 };
  return { on: s.ringWas[i] && !its.flicker(tp), r: from, no: s.ringNo[i] };
}

// `plates` is the piece's cache of what stands still (plate); a card has none.
function recallScene(g, w, h, c, plan, s, v, plates) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  plate(plates, 'sky', g, w, fr.split, c, (pg) => sky(pg, w, fr.split, skyTint(c)));
  const pts = placed(plan.points, fr);
  const show = showing(plan, s.t - s.from);
  const doneP = came(s, s.doneAt, WRITTEN, reduced);
  const done = s.doneAt >= 0;
  // Written up, the order they came is drawn from star to star along the whole path in the stair's
  // few treads, each tread carrying it the same number of legs further (counted star to star, not
  // by length).
  const seg = plan.points.length - 1;
  const far = done ? rite.stair(doneP) * seg : 0;
  if (far > 0) {
    const whole = Math.min(seg, Math.floor(far + 1e-9));
    const line = plan.seq.slice(0, whole + 2).map((i) => pts[i]);
    path(g, line, c.alpha(gold, 0.6), whole >= seg ? null : far - whole);
  }
  pts.forEach((p, i) => {
    const its = own(rite, 0x57a + i);
    // A star coming out has its halo cut in up its stair and its ring cut on at its moment; one
    // resting again goes back down the stair, its halo given back the way it came.
    let glow = 0;
    if (show.lit === i) glow = reduced ? 1 : its.stair(Math.min(1, show.into * 2.5));
    else if (show.leaving === i) glow = reduced ? 0 : 1 - its.stair(show.gone);
    star(g, c, p, LETTERS[i], v.scale, glow, fr.size, rite);
    if (show.lit === i && (reduced || its.flicker(show.into))) ring(g, p.x, p.y, fr.unit * (0.035 + 0.015 * its.stair(show.into)), c.alpha(gold, 0.8), 1.5);
    // The ring and number of a star the visitor has tapped (tapRing).
    const worn = tapRing(rite, s, i, reduced);
    if (worn.on) {
      ring(g, p.x, p.y, fr.unit * (0.02 + 0.008 * worn.r), c.alpha(gold, 0.85), 1.2);
      if (worn.no > 0) {
        g.font = '500 ' + Math.round(fr.size * 0.8) + 'px system-ui, sans-serif';
        g.fillStyle = c.alpha(gold, 0.95);
        g.fillText(String(worn.no), p.x + fr.size * 0.5, p.y + fr.size * 0.6);
      }
    }
  });
  const step = page(g, w, h, fr.split, c, ink, fr.m, Math.max(3, Math.round(4 * v.density)));
  const lines = [OPENER + ' entry ' + plan.number];
  // The second line changes as the showing goes, and when it is written up: each change is cut on
  // at its moment.
  const told = done && rite.flicker(doneP);
  const played = s.t - s.from;
  const sinceLine = played < LEAD ? played : show.over ? played - LEAD - plan.seq.length * SLOT : played - LEAD;
  const lineOn = reduced || own(rite, 0x11e).flicker(Math.min(1, sinceLine / 0.5));
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
  const plates = {};
  const paced = pace();
  // The picture as it stands now. A change the piece has just made is drawn at once; a frame
  // draws only a picture that differs from the one on the canvas.
  const paint = (c) => (g) => recallScene(g, c.w, c.h, c, plan, s, v, plates);
  const draw = (c) => paced.show(s, c, paint(c), true);
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
      // The showing runs on the piece's clock whatever motion the visitor asked for: it is the
      // puzzle, not an ornament.
      paced.stir(s.from + shown(plan));
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
          paced.stir(s.from + shown(plan));
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
      if (best < 0 || bd > fr.unit * 0.09) {
        c.status('tap a lettered star to add it to your order, or arrange the stars with the controls');
        return;
      }
      if (s.taps.includes(best)) {
        c.status('star ' + LETTERS[best] + ' is already in your order; keep going');
        draw(c);
        return;
      }
      // The ring the star wears from now goes on from the one it wore (if a ring from the last
      // order was still on it) and, when this tap completes the order, every star keeps the ring
      // it wears at this moment and lets it go at its own moment: so the last star tapped, whose
      // ring has not yet come on, never wears one, and no ring blinks.
      const rite = riteOf(c);
      const before = tapRing(rite, s, best, c.reduced);
      s.ringWas[best] = before.on;
      s.ringR[best] = before.on ? before.r : 0;
      s.taps.push(best);
      s.tapAt[best] = s.t;
      paced.stir(s.t + (c.reduced ? 0 : TAP));
      if (s.taps.length === n) {
        s.order = s.taps.slice();
        for (let i = 0; i < n; i++) {
          const worn = tapRing(rite, s, i, c.reduced);
          s.ringWas[i] = worn.on;
          s.ringR[i] = worn.r;
          s.ringNo[i] = worn.no;
          s.tapAt[i] = s.t;
        }
        s.taps = [];
        c.set('order', s.order.slice());
        c.status('called back: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; check it');
      } else {
        c.status('star ' + LETTERS[best] + ' came ' + ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][s.taps.length - 1] + '; tap the next');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (paced.due(s, c)) paced.show(s, c, paint(c));
    },
    end(c) {
      s.doneAt = s.t;
      paced.stir(s.t + (c.reduced ? 0 : WRITTEN));
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
// comes or goes timed against the piece's clock (-1 is "never"). markFrom and crossWas are how far
// in a line's band stood, and whether its cross was on, when its mark last changed.
function linesState(count) {
  return {
    t: 0, doneAt: -1, picked: [], vouched: [], markAt: new Array(count).fill(-1), vouchAt: new Array(count).fill(-1),
    markFrom: new Array(count).fill(0), crossWas: new Array(count).fill(false)
  };
}

// How long a line's band takes to come in or go, a tick to be cut on, and the log to be corrected.
const BAND = 0.8;
const VOUCH = 0.7;
const CORRECTED = 2.2;

// Line i of the log as marked false: how far in the band behind it is (k), whether its cross is
// on, and the roll both move on. A line marked has its band cut in up the stair from where it
// stood and its cross cut on at its moment (or kept, if it still wore one); unmarked, the band
// goes back down the stair from where it stood and the cross, if it was on, is cut off at that
// moment -- so a line marked and unmarked again quickly neither jumps nor blinks.
function bandOf(rite, s, i, reduced) {
  const its = own(rite, 0xba4d + i);
  const p = came(s, s.markAt[i], BAND, reduced);
  const step = its.stair(p);
  const cut = its.flicker(p) === 1;
  const from = s.markFrom[i];
  if ((s.picked || []).includes(i)) return { k: from + (1 - from) * step, cross: s.crossWas[i] || cut, own: its };
  return { k: from * (1 - step), cross: s.crossWas[i] && !cut, own: its };
}

function linesScene(g, w, h, c, plan, s, v, plates) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const top = fr.size * 1.8;
  plate(plates, 'sky', g, w, fr.split, c, (pg) => sky(pg, w, fr.split, skyTint(c)));
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
  // The logbook: the entry, then the lines, numbered. A line marked false has a band cut in behind
  // it by the piece's edge, up the line's own stair, and a cross cut on beside it at the line's
  // moment; unmarked, the band goes back down the stair the way it came and the cross is cut off at
  // that moment. A vouched-for line has its tick cut on at its moment; a corrected log strikes its
  // two false lines out in treads and turns them gold at their moment.
  const count = plan.claims.length;
  const step = page(g, w, h, fr.split, c, ink, fr.m, count + 1);
  const picked = s.picked || [];
  const vouched = s.vouched || [];
  const done = s.doneAt >= 0;
  const doneP = came(s, s.doneAt, CORRECTED, reduced);
  const size = Math.min(fr.size, step * 0.6);
  const bands = range(count).map((i) => bandOf(rite, s, i, reduced));
  bands.forEach((band, i) => {
    const y = fr.split + step * (i + 2) - size * 0.3;
    box(g, band.own, fr.m + size * 0.2, y - size * 0.95, w - fr.m * 1.6 - size * 0.2, size * 1.25, band.k, c.alpha(gold, 0.1));
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
    } else if (vouched.includes(i) && own(rite, 0x7ec + i).flicker(came(s, s.vouchAt[i], VOUCH, reduced))) {
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
  const plates = {};
  const paced = pace();
  // The picture as it stands now. A change the piece has just made is drawn at once; a frame
  // draws only a picture that differs from the one on the canvas.
  const paint = (c) => (g) => linesScene(g, c.w, c.h, c, plan, s, v, plates);
  const draw = (c) => paced.show(s, c, paint(c), true);
  // The marks as they change: every line marked or unmarked by `next` is timed from now, and goes
  // on from where its band and its cross stood at this moment.
  function mark(next, c) {
    const rite = riteOf(c);
    for (let i = 0; i < count; i++) {
      if (s.picked.includes(i) === next.includes(i)) continue;
      const was = bandOf(rite, s, i, c.reduced);
      s.markFrom[i] = was.k;
      s.crossWas[i] = was.cross;
      s.markAt[i] = s.t;
    }
    s.picked = next;
    paced.stir(s.t + (c.reduced ? 0 : BAND));
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
      const solved = picked.length === 2 && new Set(picked).size === 2 && right === 2;
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
        mark(Array.isArray(value) ? value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < count) : [], c);
        c.status(s.picked.length ? 'marked false: ' + s.picked.map((i) => 'line ' + (i + 1)).join(' and ') : 'no line marked yet');
      }
      if (id === 'hint') {
        const next = s.vouched.length >= helps ? undefined
          : (range(count).find((i) => !plan.lies.includes(i) && !s.vouched.includes(i) && !s.picked.includes(i))
            || range(count).find((i) => !plan.lies.includes(i) && !s.vouched.includes(i)));
        if (next !== undefined) {
          s.vouched.push(next);
          s.vouchAt[next] = s.t;
          paced.stir(s.t + (c.reduced ? 0 : VOUCH));
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
      if (y * c.h < fr.split || i < 0 || i >= count) {
        c.status('tap a numbered line on the page to mark it false, or choose it with the controls');
        return;
      }
      const picked = s.picked.filter((k) => k !== i);
      if (picked.length === s.picked.length) {
        if (picked.length >= 2) picked.shift();
        picked.push(i);
      }
      mark(picked.sort((a, b) => a - b), c);
      // The rail takes the pick once it is a pair, as the pick knob itself would.
      if (s.picked.length === 2) c.set('lines', s.picked.slice());
      c.status(s.picked.length === 2 ? 'marked false: line ' + (s.picked[0] + 1) + ' and line ' + (s.picked[1] + 1) + '; check the log'
        : s.picked.length === 1 ? 'marked false: line ' + (s.picked[0] + 1) + '; one more' : 'no line marked');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (paced.due(s, c)) paced.show(s, c, paint(c));
    },
    end(c) {
      s.doneAt = s.t;
      paced.stir(s.t + (c.reduced ? 0 : CORRECTED));
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

function driftDistance(plan) {
  const from = plan.points[plan.star];
  return Math.abs(plan.to.x - from.x) + Math.abs(plan.to.y - from.y);
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
  return driftWay(plan) && driftDistance(plan) <= 30 ? plan : null;
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
// written up, and every change timed against the piece's clock (-1 is "never"). pickOn and pickR,
// wasOn and wasR, are the rings the star marked and the star marked before it wore when the mark
// last changed (whether on, and how far widened).
function driftState() {
  return { t: 0, doneAt: -1, picked: -1, was: -1, pickAt: -1, pickOn: false, pickR: 0, wasOn: false, wasR: 0, half: null, halfAt: -1, hints: 0 };
}

// How long the mover's ring takes to pass to another star, the named half to come in, and the
// watch to be written up.
const PICK = 0.7;
const HALF = 1.3;
const WATCHED = 2.4;

// The ring star i wears as the mover: whether it is on and how far it has widened (0..1). The star
// marked has its ring cut on at the mark's moment -- or kept, if it still wore one -- and widened a
// tread at a time from where it was; the star marked before it keeps the ring it wore, if it wore
// one, until that same moment, so the ring passes from one to the other in one cut, and a ring not
// yet on when the mark moved on never comes on.
function moverRing(rite, s, i, reduced) {
  if (i < 0) return { on: false, r: 0 };
  const its = own(rite, 0x91c);
  const p = came(s, s.pickAt, PICK, reduced);
  if (i === s.picked) return { on: s.pickOn || its.flicker(p) === 1, r: s.pickR + (1 - s.pickR) * its.stair(p) };
  if (i === s.was) return { on: s.wasOn && !its.flicker(p), r: s.wasR };
  return { on: false, r: 0 };
}

function driftScene(g, w, h, c, plan, s, v, plates) {
  const fr = frameOf(w, h, v);
  const ink = c.colors.accent;
  const gold = c.colors.accent2;
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const top = fr.size * 1.8;
  const pw = w / 2;
  const scale = v.scale * 0.85;
  const size = fr.size * 0.85;
  plate(plates, 'sky', g, w, fr.split, c, (pg) => sky(pg, w, fr.split, skyTint(c)));
  const named = own(rite, 0x4a1f);
  if (s.half) {
    // The half of the sky the watch names is cut in over both drawings by the piece's edge, up its
    // own stair, and rests in two shades.
    const k = named.stair(came(s, s.halfAt, HALF, reduced));
    for (const x0 of [0, pw]) box(g, named, x0 + (s.half === 'west' ? 0 : pw / 2), top * 0.4, pw / 2, fr.split - top * 0.4, k, c.alpha(gold, 0.05));
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
  const doneP = came(s, s.doneAt, WATCHED, reduced);
  const told = own(rite, 0xd0e);
  if (done) {
    // Written up: the place the star left is cut on at its moment, and the way it went is drawn
    // across in treads from there to where it stands now.
    const from = driftPanel(plan.points, pw, pw, fr)[plan.star];
    if (told.flicker(doneP)) ring(g, from.x, from.y, 3 * scale, c.alpha(gold, 0.6), 1);
    const reach = told.stair(doneP);
    if (reach > 0) path(g, [from, later[plan.star]], c.alpha(gold, 0.8), reach);
  }
  first.forEach((p, i) => star(g, c, p, LETTERS[i], scale, 0, size, rite));
  later.forEach((p, i) => star(g, c, p, LETTERS[i], scale, done && i === plan.star ? told.stair(doneP) : 0, size, rite));
  // The star marked as the mover wears a ring on both drawings, and the star marked before it
  // gives its ring up at the moment the new one comes on (moverRing).
  const wear = (i) => {
    const worn = moverRing(rite, s, i, reduced);
    if (!worn.on) return;
    const rr = fr.unit * (0.022 + 0.008 * worn.r);
    ring(g, first[i].x, first[i].y, rr, c.alpha(gold, 0.85), 1.2);
    ring(g, later[i].x, later[i].y, rr, c.alpha(gold, 0.85), 1.2);
  };
  const marked = s.picked >= 0 && s.picked < first.length;
  if (marked) wear(s.picked);
  if (s.was >= 0 && s.was < first.length && s.was !== s.picked) wear(s.was);
  const markOn = marked && moverRing(rite, s, s.picked, reduced).on;
  const step = page(g, w, h, fr.split, c, ink, fr.m, Math.max(5, Math.round(5 * v.density)));
  const lines = [OPENER + ' entry ' + plan.number + ', the second watch', 'coordinates: right, then down; each scale runs from 0 to 100.'];
  const written = done && told.flicker(doneP);
  lines.push(written ? 'star ' + LETTERS[plan.star] + ' drifted ' + driftWay(plan) + ' by ' + driftDistance(plan) + ' steps.' : 'one star moved straight. which, which way, and how far?');
  if (s.half) lines.push('in the first drawing, the mover is in the ' + s.half + ' half.');
  const halfOn = !s.half || named.flicker(came(s, s.halfAt, HALF, reduced));
  // The marked star's coordinates, read off the page, are cut on with its ring.
  if (marked) {
    const a = plan.points[s.picked];
    const b = driftSecond(plan)[s.picked];
    lines.push('star ' + LETTERS[s.picked] + ': first (' + a.x + ', ' + a.y + '); second (' + b.x + ', ' + b.y + ').');
  }
  const halfRow = s.half ? 3 : -1;
  const markRow = marked ? (s.half ? 4 : 3) : -1;
  rows(g, fr, step, lines, (i) => (i === 0 ? c.alpha(gold, 0.95) : (i === halfRow && !halfOn) || (i === markRow && !markOn) ? null : c.alpha(c.colors.fg, 0.85)));
}

function driftPreview(g, w, h, env, plan) {
  driftScene(g, w, h, env, plan, driftState(), dials(env));
}

function driftPiece(env, plan) {
  const n = plan.points.length;
  const v = dials(env);
  const { helps, margin } = asked(env);
  const way = driftWay(plan);
  const distance = driftDistance(plan);
  const second = driftSecond(plan);
  const s = driftState();
  const plates = {};
  const paced = pace();
  // The picture as it stands now. A change the piece has just made is drawn at once; a frame
  // draws only a picture that differs from the one on the canvas.
  const paint = (c) => (g) => driftScene(g, c.w, c.h, c, plan, s, v, plates);
  const draw = (c) => paced.show(s, c, paint(c), true);
  const wayOf = (value) => (WAYS.find((o) => o.value === value) || {}).label;
  // The mark moves to star i (or to none, -1): each of the two rings goes on from the one it wore.
  function pick(i, c) {
    if (i === s.picked) return;
    const rite = riteOf(c);
    const before = moverRing(rite, s, s.picked, c.reduced);
    const next = moverRing(rite, s, i, c.reduced);
    s.was = s.picked;
    s.wasOn = before.on;
    s.wasR = before.r;
    s.picked = i;
    s.pickOn = next.on;
    s.pickR = next.on ? next.r : 0;
    s.pickAt = s.t;
    paced.stir(s.t + (c.reduced ? 0 : PICK));
  }
  return {
    title: driftTitle(plan),
    brief: 'Compare two watches: the first drawing is on the left, the second on the right. One of the ' + WORDS[n] + ' stars moved straight; the rest stayed put. Each star\'s control lists its first and second coordinates: right, then down, on scales from 0 to 100. Choose a star to read those coordinates on the page too. Subtract the changed coordinate to measure the distance. ' + (margin ? 'Your distance may be ' + margin + ' steps out.' : 'The distance must be exact.'),
    goal: 'Name the star that moved, its direction, and how many coordinate steps it moved.',
    aspect: '4 / 3',
    checkLabel: 'compare the watches',
    steps: [
      { id: 'star', ask: 'the moving star; coordinates are first watch / second watch', kind: 'pick', count: 1, items: range(n).map((i) => ({ label: 'star ' + LETTERS[i] + ': (' + plan.points[i].x + ', ' + plan.points[i].y + ') / (' + second[i].x + ', ' + second[i].y + ')', value: i })) },
      { id: 'way', ask: 'the way it went', kind: 'choice', options: WAYS },
      { id: 'by', ask: 'how many coordinate steps it moved', kind: 'number', min: 1, max: 30, step: 1, value: 1, unit: 'steps' },
      { id: 'half', ask: 'one clue about the moving star', kind: 'press', count: 1, label: 'narrow it down', optional: true }
    ].filter(Boolean),
    solution: { star: [plan.star], way, by: { value: distance, near: margin } },
    check(c) {
      const picked = c.value('star');
      const i = Array.isArray(picked) && picked.length === 1 ? Number(picked[0]) : -1;
      const starRight = i === plan.star;
      const wayRight = c.value('way') === way;
      const by = Number(c.value('by'));
      const off = Math.abs(by - distance);
      const distanceRight = Number.isInteger(by) && by >= 1 && by <= 30 && off <= margin;
      if (starRight && wayRight && distanceRight) return { solved: true, say: 'star ' + LETTERS[plan.star] + ' moved ' + way + ' by ' + distance + ' steps; the two watches agree with your account' };
      const right = Number(starRight) + Number(wayRight) + Number(distanceRight);
      return { solved: false, say: WORDS[right] + ' of three details match; ' + (distanceRight ? 'the distance is within the allowed margin' : off === 1 ? 'the distance is off by one step' : 'the distance is outside the allowed margin') };
    },
    start(c) {
      c.status('read the second drawing against the first, star by star');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'star') {
        const i = Array.isArray(value) && value.length ? Number(value[0]) : -1;
        pick(Number.isInteger(i) && i >= 0 && i < n ? i : -1, c);
        if (s.picked >= 0) {
          const a = plan.points[s.picked];
          const b = second[s.picked];
          c.status('star ' + LETTERS[s.picked] + ': first (' + a.x + ', ' + a.y + '), second (' + b.x + ', ' + b.y + '); coordinates are right, then down');
        } else {
          c.status('no star marked yet');
        }
      }
      if (id === 'way') c.status('drifted ' + wayOf(value) + ', you say');
      if (id === 'by') c.status('distance ' + Number(value) + ' steps; compare the first and second coordinates');
      if (id === 'half') {
        if (s.hints >= helps) {
          c.status('all the clues available at this difficulty have been given; compare the coordinates for the rest');
        } else {
          s.hints += 1;
          c.hint();
          const from = plan.points[plan.star];
          if (s.hints === 1) {
            s.half = from.x < 50 ? 'west' : 'east';
            s.halfAt = s.t;
            paced.stir(s.t + (c.reduced ? 0 : HALF));
            c.status('in the first drawing, the moving star is in the ' + s.half + ' half');
          } else if (s.hints === 2) {
            c.status('in the first drawing, the moving star is in the ' + (from.y < 50 ? 'upper' : 'lower') + ' half');
          } else if (s.hints === 3) {
            c.status('the drift changes the ' + (from.x === plan.to.x ? 'down coordinate; compare heights' : 'right coordinate; compare left and right positions'));
          } else if (s.hints === 4) {
            c.status('compare star ' + LETTERS[plan.star] + ' in the two drawings');
          } else {
            c.status('the changed coordinate differs by ' + distance + ' steps');
          }
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap a star on either drawing to name it; the pick on the rail follows.
      const fr = frameOf(c.w, c.h, v);
      if (y * c.h > fr.split) {
        c.status('choose a star on either sky, or use its coordinate control');
        return;
      }
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
      if (best < 0 || bd > fr.unit * 0.09) {
        c.status('tap a lettered star, or choose its coordinate control');
        return;
      }
      pick(best, c);
      c.set('star', [best]);
      const a = plan.points[best];
      const b = second[best];
      c.status('star ' + LETTERS[best] + ': first (' + a.x + ', ' + a.y + '), second (' + b.x + ', ' + b.y + '); say its direction and distance');
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (paced.due(s, c)) paced.show(s, c, paint(c));
    },
    end(c) {
      s.doneAt = s.t;
      paced.stir(s.t + (c.reduced ? 0 : WATCHED));
      c.status('entry ' + plan.number + ' written up: star ' + LETTERS[plan.star] + ' moved ' + way + ' by ' + distance + ' steps; choose any other star to compare what stayed still');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the three entries a seed is dealt, from one roll so that paint, spark and piece agree.
function dealt(env) {
  const r = env.rnd();
  return r < 0.36 ? 'recall' : r < 0.7 ? 'lines' : 'drift';
}

const entries = new WeakMap();
function entry(env) {
  let plan = entries.get(env);
  if (!plan) {
    const kind = dealt(env);
    plan = kind === 'recall' ? recallPlan(env) : kind === 'lines' ? linesPlan(env) : driftPlan(env);
    entries.set(env, plan);
  }
  return plan;
}

export default {
  id: 'constellation-diary',
  needsSky: true,
  // The memory's card is painted at the start of its showing, which animate then plays; for a
  // visitor who asked for less motion, whose card is never animated, it is painted with the
  // showing over and the stars at rest, so the page says what became of them.
  paint(g, w, h, env) {
    const plan = entry(env);
    if (plan.kind === 'recall') recallPreview(g, w, h, env, plan, env.reduced ? shown(plan) : 0);
    else if (plan.kind === 'lines') linesPreview(g, w, h, env, plan);
    else driftPreview(g, w, h, env, plan);
  },
  // Only the memory's card moves, because its sky is the puzzle: the stars come out one at a time,
  // once, as they do in the piece, and the sky rests. t is counted from the card's first frame on
  // screen (js/feed.js), so the showing starts as it is seen. Once the last line is written the
  // card draws that resting sky and says nothing more moves, so the feed lets it go; the frame
  // that says so still draws, because a card met again after its showing is over has only the
  // start of it on its canvas. The other two entries wait for a reader and hold still from the
  // start.
  animate(g, w, h, env, t) {
    const plan = entry(env);
    if (plan.kind !== 'recall' || env.reduced) return false;
    const rest = shown(plan);
    recallPreview(g, w, h, env, plan, Math.min(Math.max(0, t), rest));
    if (t >= rest) return false;
  },
  spark(env) {
    const cached = entry(env);
    const kind = cached.kind;
    if (kind === 'drift') {
      const plan = cached;
      return {
        title: driftTitle(plan),
        quote: 'One of the ' + WORDS[plan.points.length] + ' stars is not where the first watch left it.',
        text: 'Two drawings of one sky, a watch apart. Find the moving star, its direction and its distance; compare the coordinates to write a complete account.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => driftPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (kind === 'recall') {
      const plan = cached;
      return {
        title: recallTitle(plan),
        quote: WORDS[plan.points.length][0].toUpperCase() + WORDS[plan.points.length].slice(1) + ' stars come out one at a time on the midnight watch.',
        text: 'Watch the sky once, then put the stars in the order they came.',
        aspect: '4 / 3',
        // A spark's picture is painted once and never animated: the showing is over in it, and
        // its second line says the stars came out and rested.
        paint: (g, w, h, cardEnv) => recallPreview(g, w, h, cardEnv, plan, shown(plan)),
        of: plan
      };
    }
    const plan = cached;
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
    const plan = entry(env);
    if (plan.kind === 'recall') return recallPiece(env, plan);
    if (plan.kind === 'lines') return linesPiece(env, plan);
    return driftPiece(env, plan);
  }
};
