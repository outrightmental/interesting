/* The orbital weaver: a midnight loom under the persona's sky, read as puzzles. A small motif is
   turned about the centre into a kaleidoscopic weave, or two screens of fine lines are laid over
   each other and show their difference as broad bands. As a card it is one of the two puzzles
   below, drawn as it stands (paint, animate, spark); as a piece it is that puzzle, and the card it
   was opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece
   is.

   Two puzzles, both deduction by looking:

     count the folds   A motif of three or four joined points is laid on the loom and turned about
                       the centre some number of times -- the folds -- and on some looms every copy
                       is laid down with its mirror image too, so the weave shows both hands. The
                       motif as laid once stands in the corner. Count the folds and say whether the
                       weave is mirrored. A wrong check says which of the two is off.
     the moiré         A screen of thin upright lines, its count written on it, and a second screen
                       with a hidden count laid over it; the overlap is drawn honestly, line by
                       line, and shows as many broad bands as the two counts differ by. Say the
                       second count and whether it is more or fewer. A wrong check says which of
                       the two is off.

   The sky colours the loom -- the stars are drawn behind it -- but never decides a puzzle: the
   plan is made from the seed, serialised whole on the card's `of`, and piece(env) opens on that
   rather than rolling another, whatever the sky is by then. One star or a hundred, the weave is
   the same weave. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const MIN_FOLDS = 3;
const MAX_FOLDS = 12;

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
   js/stage.js, "The rite"). Nothing on the loom moves along a formula or cuts without a rite:
   the loom turns in the ratchet's clicks, one arm's step at a time, never a smooth rotation; the
   dust drifts in treads and blinks on rite.flicker; a lit arm, a mirrored copy the visitor says
   is there, and the bands of a read print all develop by their AREA through the matte, cell by
   cell in the piece's own pattern, and never by a fade; a count the visitor sets arrives as a
   series of ticks round the rim or under the print; an answer read out blinks on. Every change
   is read against the piece's own clock, s.t, which frame() advances: a change made at `since`
   has come came() of its way, which is 1 at once for a visitor who asked for less motion and
   for whatever stood there from the start. Each thing that moves has a roll of its own
   (rite.at), so no two step together. */

const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 0, flicker: () => 1, matte: () => true,
  series: (p, n) => Math.max(1, Math.floor(n || 1)), treads: 1, kind: 'none', cell: 4, at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return clamp((s.t - since) / span, 0, 1);
}

function fract(x) {
  return x - Math.floor(x);
}

// Turns made at x turns along: the whole ones, and the one under way in the ratchet's clicks.
function turns(rite, x) {
  return Math.floor(x) + rite.ratchet(fract(x));
}

// The tread reached at p, 0 to n, on the rite's own uneven stair: a count arriving in a series.
function series(rite, p, n) {
  if (typeof rite.series === 'function') return rite.series(p, n);
  return Math.round(rite.stair(p, n) * n);
}

// The cells of a box the matte lets through at coverage k, filled in the current fillStyle: how a
// surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame stays
// cheap, on a grid fixed to the canvas so the pattern holds still while it grows. At k >= 1 every
// cell is let through. Clip first to keep it to a shape.
function develop(g, rite, x0, y0, bw, bh, k, size) {
  if (k <= 0) return;
  const cell = size || Math.max(rite.cell, Math.ceil(Math.max(bw, bh) / 28));
  const cx0 = Math.floor(x0 / cell);
  const cy0 = Math.floor(y0 / cell);
  const cx1 = Math.ceil((x0 + bw) / cell);
  const cy1 = Math.ceil((y0 + bh) / cell);
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) {
      if (k < 1 && !rite.matte(cx, cy, k)) continue;
      g.fillRect(cx * cell, cy * cell, cell, cell);
    }
  }
}

/* ---- shared drawing ------------------------------------------------------------------------- */

function night(g, w, h, env) {
  const c = env.colors;
  const bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bg.addColorStop(0, c.bg2);
  bg.addColorStop(1, c.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
}

// The persona's stars, faint behind the loom, and a little dust whose number is the
// configuration's density and whose drift is its turn. The dust drifts in treads -- a step along
// every period, up the rite's stair -- and every fourth speck blinks out on a roll of its own.
function sky(g, w, h, env, v, t, rite) {
  const c = env.colors;
  for (const s of env.stars || []) {
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    g.fillStyle = env.alpha(c.fg, 0.28);
    g.beginPath();
    g.arc((x / 100) * w, (y / 100) * h, 1.2, 0, Math.PI * 2);
    g.fill();
  }
  const count = Math.max(10, Math.round(36 * v.density));
  const period = 2.2;
  const drift = (Math.floor(t / period) + rite.at(0xd5).stair(fract(t / period))) * period;
  for (let i = 0; i < count; i++) {
    if (i % 4 === 0 && !rite.at(0xd0 + (i % 11)).flicker(fract(t / 3.4 + i * 0.09))) continue;
    g.fillStyle = env.alpha(c.muted, 0.06 + (i % 5) * 0.025);
    g.fillRect((i * 129.3 + v.turn * 97 + drift * 9) % w, (i * 83.7 + v.turn * 41 + drift * 5) % h, 1, 1);
  }
}

function label(g, env, text, x, y, size, align, tone) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillStyle = tone || env.colors.fg;
  g.fillText(text, x, y);
}

/* ---- count the folds ------------------------------------------------------------------------ */

// The motif: three or four points in polar form about the centre -- a radius in 0.22..0.95 of the
// loom and an angle in 0.12..0.92 of the half-sector an arm may use -- all to one side of the
// arm's axis, so the motif has a hand of its own, and spread enough to be read.
function motifOf(env) {
  const n = env.chance(0.5) ? 3 : 4;
  for (let attempt = 0; attempt < 120; attempt++) {
    const points = [];
    for (let i = 0; i < n; i++) points.push([Math.round((0.22 + env.rnd() * 0.73) * 100) / 100, Math.round((0.12 + env.rnd() * 0.8) * 100) / 100]);
    let apart = true;
    for (let i = 0; i < n && apart; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(points[i][0] - points[j][0]) < 0.1 || Math.abs(points[i][1] - points[j][1]) < 0.12) apart = false;
      }
    }
    // The thread must not just march outward or inward: a turn back makes it a shape.
    const zig = points.some((p, i) => i > 1 && (p[0] - points[i - 1][0]) * (points[i - 1][0] - points[i - 2][0]) < 0);
    if (apart && zig) return points;
  }
  return [[0.3, 0.2], [0.72, 0.85], [0.52, 0.45], [0.9, 0.3]].slice(0, n);
}

function foldsPlan(env) {
  return { kind: 'folds', number: env.int(100, 999), k: env.int(MIN_FOLDS, MAX_FOLDS), mirrored: env.chance(0.5), motif: motifOf(env) };
}

function carriedFolds(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'folds') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.k) || p.k < MIN_FOLDS || p.k > MAX_FOLDS) return null;
  if (typeof p.mirrored !== 'boolean') return null;
  if (!Array.isArray(p.motif) || p.motif.length < 3 || p.motif.length > 4) return null;
  const okPoint = (pt) => Array.isArray(pt) && pt.length === 2 && pt.every((v) => typeof v === 'number' && isFinite(v))
    && pt[0] >= 0.15 && pt[0] <= 1 && pt[1] >= 0.05 && pt[1] <= 1;
  if (!p.motif.every(okPoint)) return null;
  return { kind: 'folds', number: p.number, k: p.k, mirrored: p.mirrored, motif: p.motif.map((pt) => [pt[0], pt[1]]) };
}

function foldsTitle(plan) {
  return 'weave ' + plan.number + ': the folded sigil';
}

function loomGeometry(w, h, v) {
  const m = Math.min(w, h);
  return { cx: w / 2, cy: h / 2, R: m * 0.44 * clamp(v.scale, 0.86, 1.1), m };
}

// One copy of the motif: on arm `arm`, with its hand kept (sign 1) or mirrored (sign -1), about
// (cx, cy) at radius R, the first arm's axis at `base`.
function copyOf(plan, cx, cy, R, base, arm, sign) {
  const step = (Math.PI * 2) / plan.k;
  return plan.motif.map((pt) => {
    const angle = base + arm * step + sign * pt[1] * step * 0.42;
    return { x: cx + Math.cos(angle) * pt[0] * R, y: cy + Math.sin(angle) * pt[0] * R };
  });
}

// One copy of the motif as a shard: its points joined in order and closed, filled faintly and
// stroked, so the hand of the shape can be read.
function thread(g, pts, fill) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.stroke();
}

function beads(g, pts, r) {
  for (const p of pts) {
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
  }
}

// The area of a shard, developed through the matte at coverage k: clipped to the shard, so only
// its cells are let through.
function developShard(g, rite, pts, k, size) {
  if (k <= 0) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  g.save();
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.clip();
  develop(g, rite, x0, y0, x1 - x0, y1 - y0, k, size);
  g.restore();
}

// `s`: how long the loom has been turning (spun, in seconds), whether one arm is lit (a hint)
// and since when, the visitor's count and whether they say it is mirrored (and since when),
// whether the answer is out (and since when); and the piece's clock, t.
function drawFolds(g, w, h, env, plan, s, variant, t) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = loomGeometry(w, h, v);
  const step = (Math.PI * 2) / plan.k;
  // The loom turns one arm's step every few seconds, in the ratchet's clicks, never evenly.
  const rot = s.spun ? step * turns(rite.at(0x70), s.spun / 3.6) : 0;
  const base = v.turn * Math.PI * 2 + rot;
  const size = Math.max(9, Math.min(15, Math.round(geo.m * 0.036)));
  const bead = Math.max(1.4, geo.m * 0.006);
  const cell = Math.max(rite.cell, Math.ceil(geo.m / 90));
  night(g, w, h, env);
  sky(g, w, h, env, v, t || 0, rite);
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1, geo.m * 0.003);
  // The lit arm is a set surface: its shards develop through the matte from the moment the
  // hint was asked, their halo thickens up a stair and their stroke blinks to the foreground.
  const litRite = rite.at(0x11);
  const litP = s.lit ? came(s, s.litAt, 1.6, reduced) : 0;
  const litK = s.lit ? litRite.stair(litP) : 0;
  const litOn = s.lit && litRite.flicker(litP);
  for (let arm = 0; arm < plan.k; arm++) {
    const tone = arm % 2 ? c.accent : c.accent2;
    const lit = s.lit && arm === 0;
    for (const sign of plan.mirrored ? [1, -1] : [1]) {
      const pts = copyOf(plan, geo.cx, geo.cy, geo.R, base, arm, sign);
      if (lit && litOn && litK > 0) {
        g.strokeStyle = env.alpha(c.fg, 0.35);
        g.lineWidth = Math.max(4, geo.m * 0.016) * litRite.stair(litP, 4);
        thread(g, pts, null);
        g.lineWidth = Math.max(1, geo.m * 0.003);
      }
      const fore = lit && litOn;
      g.strokeStyle = env.alpha(fore ? c.fg : tone, fore ? 1 : 0.8);
      thread(g, pts, env.alpha(tone, 0.14));
      if (lit && litK > 0) {
        g.fillStyle = env.alpha(c.fg, 0.4);
        developShard(g, litRite, pts, litK, cell);
      }
      g.fillStyle = env.alpha(fore ? c.fg : tone, 0.95);
      beads(g, pts, bead);
    }
  }
  g.strokeStyle = env.alpha(c.accent, 0.22);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(geo.cx, geo.cy, geo.R, 0, Math.PI * 2);
  g.stroke();
  // The visitor's count, as ticks round the rim: they arrive one tread at a time, a series.
  if (s.guess) {
    const n = series(rite.at(0x9e), came(s, s.guessAt, 1.2, reduced), s.guess);
    g.strokeStyle = env.alpha(c.accent2, 0.85);
    g.lineWidth = Math.max(1.5, geo.m * 0.004);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = base + i * ((Math.PI * 2) / s.guess);
      g.moveTo(geo.cx + Math.cos(a) * geo.R * 1.01, geo.cy + Math.sin(a) * geo.R * 1.01);
      g.lineTo(geo.cx + Math.cos(a) * geo.R * 1.07, geo.cy + Math.sin(a) * geo.R * 1.07);
    }
    g.stroke();
  }
  // The motif as laid once, in the corner, its axis pointing up.
  const box = geo.m * 0.2;
  const bx = geo.m * 0.03;
  const by = h - box - geo.m * 0.03;
  g.fillStyle = env.alpha(c.bg, 0.55);
  g.fillRect(bx, by, box, box);
  g.strokeStyle = env.alpha(c.muted, 0.4);
  g.strokeRect(bx, by, box, box);
  const key = copyOf(plan, bx + box * 0.5, by + box * 0.56, box * 0.46, -Math.PI / 2, 0, 1);
  // The mirror the visitor says is there: the key's mirror image develops into the corner
  // through the matte when they say so, and leaves back down the stair when they take it back.
  const mirrorRite = rite.at(0x3d);
  const mirrorP = mirrorRite.stair(came(s, s.mirrorAt, 1.2, reduced));
  const mirrorK = s.mirror ? mirrorP : 1 - mirrorP;
  if (mirrorK > 0) {
    const twin = copyOf(plan, bx + box * 0.5, by + box * 0.56, box * 0.46, -Math.PI / 2, 0, -1);
    g.fillStyle = env.alpha(c.accent2, 0.45);
    developShard(g, mirrorRite, twin, mirrorK, Math.max(2, Math.min(cell, 3)));
    g.strokeStyle = env.alpha(c.accent2, 0.5);
    g.lineWidth = 1;
    g.setLineDash([2, 3]);
    thread(g, twin, null);
    g.setLineDash([]);
  }
  g.strokeStyle = env.alpha(c.fg, 0.9);
  g.lineWidth = 1;
  thread(g, key, env.alpha(c.fg, 0.14));
  g.fillStyle = c.fg;
  beads(g, key, bead);
  label(g, env, 'the sigil', bx + box * 0.5, by + box * 0.1, Math.max(8, size - 2), 'center', env.alpha(c.muted, 0.9));
  // The answer blinks on.
  if (s.open && rite.at(0x0a).flicker(came(s, s.openAt, 1, reduced))) {
    label(g, env, WORDS[plan.k] + ' folds' + (plan.mirrored ? ', mirrored' : ', one hand'), w - geo.m * 0.03, h - geo.m * 0.04, size, 'right', c.accent2);
  }
}

function foldsStill() {
  return { spun: 0, lit: false, litAt: null, open: false, openAt: null, t: 0, guess: null, guessAt: null, mirror: false, mirrorAt: null };
}

function foldsPreview(g, w, h, env, plan, t) {
  drawFolds(g, w, h, env, plan, foldsStill(), env.variant, t || 0);
}

function foldsPiece(env, plan) {
  const helps = asked(env).helps;
  // What the loom has to show, in the order it shows it: a lit arm, and then the hand of the
  // weave. The difficulty says how many of them it will show (a fold count is a count, so there
  // is no margin to widen here).
  const shows = [
    'one arm is lit: everything on it is one fold',
    'the weave ' + (plan.mirrored ? 'shows both hands: every copy is laid with its mirror image' : 'is all of one hand: no copy is mirrored')
  ];
  const s = Object.assign(foldsStill(), { shown: 0 });
  const draw = (c) => drawFolds(c.g, c.w, c.h, c, plan, s, env.variant, s.t);
  return {
    title: foldsTitle(plan),
    brief: 'A working of the loom. A sigil of ' + WORDS[plan.motif.length] + ' joined points is laid on the midnight loom and turned about the centre a number of times: the folds. On some looms every copy is laid down with its mirror image as well, so the weave shows both hands. The sigil, as laid once, stands in the corner.',
    goal: 'Count the folds, and say whether the weave is mirrored.',
    aspect: '1 / 1',
    checkLabel: 'check the weave',
    steps: [
      { id: 'folds', ask: 'how many times the sigil is turned about the centre', kind: 'number', min: 2, max: MAX_FOLDS, step: 1, unit: 'folds' },
      { id: 'mirror', ask: 'is every copy laid with its mirror image?', kind: 'toggle', label: 'mirrored' },
      { id: 'hint', ask: 'one arm, lit', kind: 'press', count: 1, label: 'light one arm', optional: true }
    ],
    solution: { folds: plan.k, mirror: plan.mirrored },
    check(c) {
      const foldsRight = Number(c.value('folds')) === plan.k;
      const mirrorRight = !!c.value('mirror') === plan.mirrored;
      if (foldsRight && mirrorRight) return { solved: true, say: 'the weave closes: ' + WORDS[plan.k] + ' folds, ' + (plan.mirrored ? 'each with its mirror image' : 'all of one hand') };
      if (!foldsRight && !mirrorRight) return { solved: false, say: 'the loom does not close: the fold count and the mirror are both off' };
      return { solved: false, say: foldsRight ? 'the fold count is right; the mirror is off' : 'the mirror is right; the fold count is off' };
    },
    start(c) {
      c.status('the loom is still; the sigil waits in the corner');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'folds') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) {
          const guess = clamp(n, 2, MAX_FOLDS);
          if (guess !== s.guess) {
            s.guess = guess;
            s.guessAt = s.t;
          }
          c.status(guess + ' folds, you say');
        }
      }
      if (id === 'mirror') {
        if (!!value !== s.mirror) {
          s.mirror = !!value;
          s.mirrorAt = s.t;
        }
        c.status(value ? 'mirrored, you say' : 'one hand, you say');
      }
      if (id === 'hint') {
        if (s.shown < Math.min(shows.length, helps)) {
          c.status(shows[s.shown]);
          s.shown += 1;
          if (!s.lit) s.litAt = s.t;
          s.lit = true;
          c.hint();
        } else if (s.shown >= helps) {
          c.status('that is all the loom will show at this difficulty; the rest is counting');
        } else {
          c.status('the loom has shown what it has; the rest is counting');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      // Less motion asked for: the clock stands, and every change came() at once.
      if (!c.reduced) s.t += dt;
      if (c.done && !c.reduced) s.spun += dt;
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      c.status('the weave turns: ' + WORDS[plan.k] + ' folds' + (plan.mirrored ? ', mirrored' : ''));
      draw(c);
    }
  };
}

/* ---- the moiré ------------------------------------------------------------------------------ */

function moirePlan(env) {
  const first = env.int(8, 24);
  const apart = env.int(1, 6);
  const more = env.chance(0.5) || first - apart < 6;
  return { kind: 'moire', number: env.int(100, 999), first, second: more ? first + apart : first - apart };
}

function carriedMoire(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'moire') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.first) || p.first < 8 || p.first > 24) return null;
  if (!Number.isInteger(p.second) || p.second < 6 || p.second > 30) return null;
  const apart = Math.abs(p.first - p.second);
  if (apart < 1 || apart > 6) return null;
  return { kind: 'moire', number: p.number, first: p.first, second: p.second };
}

function moireTitle(plan) {
  return 'print ' + plan.number + ': the moiré seal';
}

function moireBoxes(w, h, v) {
  const pad = w * 0.06;
  const width = (w - pad * 2) * clamp(v.scale, 0.86, 1);
  const x = (w - width) / 2;
  return {
    pad,
    alone: { x, y: h * 0.12, w: width, h: h * 0.15 },
    both: { x, y: h * 0.38, w: width, h: h * 0.5 }
  };
}

// The lines of one screen across a box: `n` of them, evenly spaced, slid along by `phase` of the
// width and wrapped, each a crisp bar a little under half a pitch wide, so that where the two
// screens' bars fall together the print opens and where they interleave it closes -- which is
// the whole of the moiré.
function screenLines(g, box, n, offset, phase, color) {
  const pitch = box.w / n;
  const bar = Math.max(1, Math.round(pitch * 0.42));
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const u = ((((i + offset) / n + phase) % 1) + 1) % 1;
    const x = Math.round(box.x + u * box.w - bar / 2);
    g.fillRect(x, box.y, bar, box.h);
  }
}

// `s`: whether the bands are marked (the answer is out) and since when; the visitor's count and
// direction and since when; and the piece's clock, t.
function drawMoire(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const boxes = moireBoxes(w, h, v);
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const phase = v.turn / plan.first;
  const strength = clamp(0.5 * v.density, 0.42, 0.62);
  const firstTone = env.alpha(env.mix(c.accent, c.fg, 0.35), strength);
  const secondTone = env.alpha(c.accent2, strength);
  night(g, w, h, env);
  for (const box of [boxes.alone, boxes.both]) {
    g.fillStyle = env.alpha(c.bg, 0.7);
    g.fillRect(box.x, box.y, box.w, box.h);
  }
  screenLines(g, boxes.alone, plan.first, 0.5, phase, firstTone);
  screenLines(g, boxes.both, plan.first, 0.5, phase, firstTone);
  // The second screen sits half a pitch along, which centres its bands in the print.
  screenLines(g, boxes.both, plan.second, 1, phase, secondTone);
  // The bands, once the print is read: each develops through the matte from the moment the
  // answer came out, its core at full coverage and its shoulders at half, blinking on the way the
  // rite's flicker has it, and holds -- never a wash.
  const bandRite = rite.at(0x6a);
  const openP = s.open ? came(s, s.openAt, 1.8, reduced) : 0;
  const bandK = s.open ? bandRite.stair(openP) : 0;
  if (bandK > 0 && bandRite.flicker(openP)) {
    const apart = Math.abs(plan.first - plan.second);
    const cell = Math.max(rite.cell, Math.ceil(boxes.both.h / 40));
    g.fillStyle = env.alpha(c.accent2, 0.2);
    g.save();
    g.beginPath();
    g.rect(boxes.both.x, boxes.both.y, boxes.both.w, boxes.both.h);
    g.clip();
    for (let j = 0; j < apart; j++) {
      const x = boxes.both.x + ((j + 0.5) / apart) * boxes.both.w;
      const span = boxes.both.w / apart;
      develop(g, bandRite, x - span / 2, boxes.both.y, span, boxes.both.h, bandK * 0.3, cell);
      develop(g, bandRite, x - span / 4, boxes.both.y, span / 2, boxes.both.h, bandK, cell);
    }
    g.restore();
  }
  g.strokeStyle = env.alpha(c.muted, 0.45);
  g.lineWidth = 1;
  for (const box of [boxes.alone, boxes.both]) {
    g.beginPath();
    g.moveTo(box.x, box.y);
    g.lineTo(box.x + box.w, box.y);
    g.moveTo(box.x, box.y + box.h);
    g.lineTo(box.x + box.w, box.y + box.h);
    g.stroke();
  }
  // The visitor's count, as ticks under the print, arriving one tread at a time: a series.
  if (s.guess) {
    const n = series(rite.at(0x9e), came(s, s.guessAt, 1.2, reduced), s.guess);
    g.strokeStyle = env.alpha(c.accent2, 0.85);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = Math.round(boxes.both.x + ((i + 0.5) / s.guess) * boxes.both.w) + 0.5;
      g.moveTo(x, boxes.both.y + boxes.both.h + 3);
      g.lineTo(x, boxes.both.y + boxes.both.h + 3 + size * 0.5);
    }
    g.stroke();
  }
  label(g, env, 'the first screen alone: ' + plan.first + ' lines', boxes.alone.x, boxes.alone.y - size * 0.9, size, 'left', env.mix(c.accent, c.fg, 0.35));
  label(g, env, 'the second screen', boxes.both.x, boxes.both.y - size * 0.9, size, 'left', c.accent2);
  label(g, env, ' laid over the first', boxes.both.x + g.measureText('the second screen').width, boxes.both.y - size * 0.9, size, 'left', env.alpha(c.fg, 0.9));
  // The direction the visitor says, blinking on beside the print's title.
  if (s.which && rite.at(0x5c).flicker(came(s, s.whichAt, 0.9, reduced))) {
    label(g, env, s.which === 'more' ? 'more, you say' : 'fewer, you say', boxes.both.x + boxes.both.w, boxes.both.y - size * 0.9, size, 'right', env.alpha(c.accent2, 0.9));
  }
  // The answer blinks on.
  if (s.open && rite.at(0x0a).flicker(came(s, s.openAt, 1, reduced))) {
    const apart = Math.abs(plan.first - plan.second);
    label(g, env, WORDS[apart] + (apart === 1 ? ' band: ' : ' bands: ') + plan.second + ' lines on the second screen', w - boxes.pad, h * 0.95, size, 'right', c.accent2);
  }
}

function moireStill() {
  return { open: false, openAt: null, t: 0, guess: null, guessAt: null, which: null, whichAt: null };
}

function moirePreview(g, w, h, env, plan) {
  drawMoire(g, w, h, env, plan, moireStill(), env.variant);
}

function moirePiece(env, plan) {
  const more = plan.second > plan.first;
  const apart = Math.abs(plan.first - plan.second);
  const helps = asked(env).helps;
  const shows = [
    more ? 'the second screen\'s lines sit closer together than the first\'s' : 'the second screen\'s lines sit farther apart than the first\'s',
    'the print shows ' + WORDS[apart] + (apart === 1 ? ' broad band' : ' broad bands') + ' across it'
  ];
  const s = Object.assign(moireStill(), { shown: 0 });
  const draw = (c) => drawMoire(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: moireTitle(plan),
    brief: 'The seal is two screens of upright lines laid over each other: the first has ' + plan.first + ' lines across the width, the second a different count. Where their lines fall together and then apart, broad bands appear across the print, and there are as many bands as the two counts differ by.',
    goal: 'Say how many lines the second screen has, and whether that is more or fewer than the first.',
    aspect: '4 / 3',
    checkLabel: 'check the print',
    steps: [
      { id: 'second', ask: 'the lines on the second screen', kind: 'number', min: 4, max: 30, step: 1, unit: 'lines' },
      { id: 'which', ask: 'the second screen has', kind: 'choice', options: [
        { label: 'more lines than the first', value: 'more' },
        { label: 'fewer lines than the first', value: 'fewer' }
      ] },
      { id: 'hint', ask: 'which screen is the finer', kind: 'press', count: 1, label: 'tell me which is finer', optional: true }
    ],
    solution: { second: plan.second, which: more ? 'more' : 'fewer' },
    check(c) {
      const countRight = Number(c.value('second')) === plan.second;
      const whichRight = c.value('which') === (more ? 'more' : 'fewer');
      if (countRight && whichRight) return { solved: true, say: 'the seal reads: ' + plan.second + ' lines, ' + WORDS[apart] + (apart === 1 ? ' band' : ' bands') + ' across the print' };
      if (!countRight && !whichRight) return { solved: false, say: 'the seal does not read: the count and the direction are both off' };
      return { solved: false, say: countRight ? 'the count is right; the direction is off' : 'the direction is right; the count is off' };
    },
    start(c) {
      c.status('count the broad bands across the print');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'second') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) {
          const guess = clamp(n, 4, 30);
          if (guess !== s.guess) {
            s.guess = guess;
            s.guessAt = s.t;
          }
          c.status(guess + ' lines on the second screen, you say');
        }
      }
      if (id === 'which') {
        const which = value === 'more' ? 'more' : 'fewer';
        if (which !== s.which) {
          s.which = which;
          s.whichAt = s.t;
        }
        c.status(value === 'more' ? 'more lines than the first, you say' : 'fewer lines than the first, you say');
      }
      if (id === 'hint') {
        if (s.shown < Math.min(shows.length, helps)) {
          c.status(shows[s.shown]);
          s.shown += 1;
          c.hint();
        } else {
          c.status(s.shown >= helps
            ? 'that is all the press will show at this difficulty; count the bands yourself'
            : 'the press has shown what it has; count the bands and read the difference');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      c.status(WORDS[apart] + (apart === 1 ? ' band' : ' bands') + ' from ' + plan.first + ' lines against ' + plan.second + '; the bands are lit on the print');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle a seed is dealt, from the seed alone so that paint, spark and piece agree.
function dealsMoire(env) {
  return (((Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0) >>> 3) & 1) === 1;
}

// The plan, dealt once from the env's seeded stream and kept with that env. Which of the two this
// card is comes off the seed above and so is free to ask twice, but the plan is not: every pass
// over one card -- the still picture and then every animated frame -- has to get the same loom, and
// dealing per frame would re-thread it thirty times a second (issue #92; js/feed.js has the
// contract animate is held to).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const moire = dealsMoire(env);
    got = { moire, plan: moire ? moirePlan(env) : foldsPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'orbital-weaver',
  needsSky: true,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.moire) moirePreview(g, w, h, env, d.plan);
    else foldsPreview(g, w, h, env, d.plan, 0);
  },
  animate(g, w, h, env, t) {
    const d = deal(env);
    // The printed screens of the moire puzzle do not move: the still picture is the whole of it.
    if (d.moire) return false;
    // The card's loom turns in the ratchet's clicks, an arm's step every few seconds.
    drawFolds(g, w, h, env, d.plan, Object.assign(foldsStill(), { spun: t, t }), env.variant, t);
  },
  spark(env) {
    const d = deal(env);
    if (d.moire) {
      const plan = d.plan;
      return {
        title: moireTitle(plan),
        text: 'Two screens pressed as one seal: the first of ' + plan.first + ' thin lines, the second laid over it. The broad bands in the print say how far apart the two counts are.',
        mono: plan.first + ' lines / ?',
        aspect: '4 / 3',
        paint: (ctx, cw, ch, cardEnv) => moirePreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: foldsTitle(plan),
      text: 'One sigil turned about the centre of the midnight loom, perhaps with its mirror image. Count the folds, and say whether the weave is mirrored.',
      mono: WORDS[plan.motif.length] + ' points / ? folds',
      aspect: '1 / 1',
      paint: (ctx, cw, ch, cardEnv) => foldsPreview(ctx, cw, ch, cardEnv, plan, 0),
      of: plan
    };
  },
  piece(env) {
    const folds = carriedFolds(env);
    if (folds) return foldsPiece(env, folds);
    const moire = carriedMoire(env);
    if (moire) return moirePiece(env, moire);
    const d = deal(env);
    return d.moire ? moirePiece(env, d.plan) : foldsPiece(env, d.plan);
  }
};
