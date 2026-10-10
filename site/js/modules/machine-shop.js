/* The machine shop: elementary cellular automata on a bench, read as puzzles. Every tape is a row
   of cells that wraps round at its ends, and every cell of the next row is set by the three cells
   above it -- itself and its two neighbours -- according to one of the 256 rules. As a card it is
   one of the two puzzles below, drawn as it stands (paint, spark); as a piece it is that puzzle,
   and the card it was opened from says which. See js/feed.js for what a module is and js/stage.js
   for what a piece is.

   Two puzzles, both deduction:

     the next row       A hidden rule ran a tape for four rows. Every one of the eight patterns of
                        three appears somewhere in the first three rows, so the rule can be read
                        off the rows entirely; write row five. The scene is the control: tap a
                        cell of row five to light it. A wrong check says how many cells are right.
                        Some seeds are the long recital: three rows shown, rows four and five to
                        write.
     the changed cell   Two tapes ran one stated rule from one first row, except that one cell of
                        the second tape's first row was flipped. The first rows are hidden and the
                        next few shown. The flip reaches exactly the three cells under it in row
                        one, so the difference has an apex; find its column, and count the cells
                        that differ in the last row. A wrong check says which of the two is off.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the rule, the first row, the flip -- and piece(env) opens on that rather than rolling
   another. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PLAIN = { density: 1, scale: 1, turn: 0 };
// The rules the changed cell is run under: ones whose flip usually reaches all three cells under
// it. 105 and 150 always do (every cell is the parity of the three above), so they are rarer.
const APEX_RULES = [30, 45, 54, 73, 126, 182];
const APEX_PARITY = [105, 150];

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

/* ---- the tape arithmetic -------------------------------------------------------------------- */

function hoodOf(row, x) {
  const n = row.length;
  return (row[(x + n - 1) % n] << 2) | (row[x] << 1) | row[(x + 1) % n];
}

function nextRow(row, rule) {
  const out = new Array(row.length);
  for (let x = 0; x < row.length; x++) out[x] = (rule >> hoodOf(row, x)) & 1;
  return out;
}

// rows[0] is `start`; rows[r] is r steps on.
function runRows(start, rule, count) {
  const rows = [start.slice()];
  for (let r = 1; r <= count; r++) rows.push(nextRow(rows[r - 1], rule));
  return rows;
}

// A plan's five rows, run once and kept with the plan: a plan never changes, so a frame reads its
// rows rather than running the rule again.
const ran = new WeakMap();
function rowsOf(plan) {
  let rows = ran.get(plan);
  if (!rows) ran.set(plan, (rows = runRows(plan.start, plan.rule, 4)));
  return rows;
}

function randomRow(env, n) {
  const row = [];
  for (let i = 0; i < n; i++) row.push(env.chance(0.5) ? 1 : 0);
  return row;
}

function differing(a, b) {
  const out = [];
  for (let x = 0; x < a.length; x++) if (a[x] !== b[x]) out.push(x);
  return out;
}

function isBits(list, n) {
  return Array.isArray(list) && list.length === n && list.every((v) => v === 0 || v === 1);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ---- the rite: how the bench moves ---------------------------------------------------------- */

/* Nothing on the bench fades, glides or moves along a formula (README: "Motion axiom"). The
   piece's rite (env.rite; js/variant.js) is one clean edge -- a slice at an angle, or a curve
   grown from a corner or the middle of a side -- which is the piece's signature, and the few
   treads every change climbs, always forward. Each thing on the bench moves for a reason:

     a cell lit        the visitor's: it is cut in as its stair climbs and rests in two shades of
                       the light's colour split by its edge. A cell lit by a press on the bench is
                       cut by a curve grown from the point it was pressed at; one lit from the
                       knobs, by the piece's own edge. Put out, it goes back down the same stair,
                       the edge going back the way it came. Pressed again on its way, it goes on
                       from where it stands, with the edge it has. Its outline steps between its
                       two tones on that stair.
     a mark shown      a hinted cell's dot, a marked difference's outline, the apex: cut on at its
                       moment (rite.flicker: nothing before it, the whole mark after) and held. A
                       hinted dot then grows to its size on its stair.
     the lens moved    it stays on the cell it was on until its moment, and is then cut over to
                       the cell last tapped in one cut: never gone in between.
     a surface set     a marked difference, the flipped column once it is found, the solved rows:
                       cut in behind the edge and resting in two shades, as a lit cell does.
     the solved table  read out pattern by pattern, 111 down to 000: each "?" gives way to its
                       answer at its own moment, a lit answer cut in behind the edge.

   Every cell and mark steps on a roll of its own (rite.at, the same edge with its own treads), and
   a cell pressed twice steps differently the second time, so no two step together. Every change
   is read against the piece's own clock, recorded in frame(t); a visitor who asked for less
   motion, and whatever stood there from the start, sees every end state at once. A bench at rest
   does not move and is not drawn again: frame() draws only while something is on its way, or
   when the canvas has been sized again. */

// The rite of a piece handed none: every change already made, and a surface cut by a plain
// upright slice from its left side.
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

// One roll per thing the bench moves (rite.at, keyed), made once and kept: rolling it is a new
// stream and a dozen closures, which a frame has no need to make again.
const rolls = new WeakMap();
function roll(rite, key) {
  let kept = rolls.get(rite);
  if (!kept) rolls.set(rite, (kept = new Map()));
  let got = kept.get(key);
  if (!got) kept.set(key, (got = rite.at(key)));
  return got;
}

// How far through its rite a thing is, `now` seconds in, that began at `since`: 1 when it has
// been there all along (or less motion was asked for), 0 before it begins.
function came(now, since, span, reduced) {
  if (reduced || since == null || since < 0 || now == null) return 1;
  return Math.max(0, Math.min(1, (now - since) / span));
}

// How much lighter the far shade of a set surface is: the same fraction the site's own set
// controls rest at (cut.shades in _sass/_cut.scss).
const FAR = 0.45;

// A surface `k` of the way to being set, in `color` at `a`, behind `edge` (the piece's rite, or a
// curve round a press): the edge's first half in the near shade and the band beyond it in the far
// one, each filled once and the two never over one another. While it comes or goes one edge moves
// across it; at rest it is two shades of one colour split by that edge through the middle of the
// box. Two fills, never cells.
function cover(g, env, edge, x, y, w, h, k, color, a) {
  const near = Math.min(k, 0.5);
  if (near <= 0) return;
  const curve = edge.kind === 'curve';
  if (curve) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
  }
  if (k > near) {
    g.beginPath();
    edge.region(g, x, y, w, h, k);
    edge.region(g, x, y, w, h, near);
    g.fillStyle = env.alpha(color, a * FAR);
    g.fill('evenodd');
  }
  g.beginPath();
  edge.region(g, x, y, w, h, near);
  g.fillStyle = env.alpha(color, a);
  g.fill();
  if (curve) g.restore();
}

// The edge of a cell lit by a press on the bench: a curve grown from the point it was pressed at
// (u, v, in fractions of the cell) out to the cell's farthest corner -- the press is the reason.
function pressedEdge(u, v) {
  return {
    kind: 'curve',
    region(g, x, y, w, h, k) {
      const c = clamp(k, 0, 1);
      if (c <= 0) return;
      if (c >= 1) {
        g.rect(x, y, w, h);
        return;
      }
      const ox = x + u * w;
      const oy = y + v * h;
      const far = Math.hypot(Math.max(u, 1 - u) * w, Math.max(v, 1 - v) * h);
      g.moveTo(ox + far * c, oy);
      g.arc(ox, oy, far * c, 0, Math.PI * 2);
    }
  };
}

// A thing replaced by one cut -- the lens moving to another cell -- at `now`: the new from its
// moment on, and until then whatever stood there when it was told, never nothing in between.
function showing(r, now, span, reduced) {
  if (!r) return null;
  return r.roll.flicker(came(now, r.at, span, reduced)) ? r.now : r.was;
}

// Whether frame() has anything to draw: a movement that ends after the last picture drawn, or a
// canvas sized again since (which clears it). `seen` records the picture just drawn.
function due(s, c) {
  const z = s.drawn;
  return !z || z.g !== c.g || z.w !== c.w || z.h !== c.h || z.dpr !== c.dpr || z.t < s.until;
}
function seen(s, c) {
  s.drawn = { g: c.g, w: c.w, h: c.h, dpr: c.dpr, t: s.t };
}
// A movement started now, `span` seconds long (`late` seconds from now): the bench is drawn until
// it ends. Less motion shows every end state at once, so nothing is kept in flight for it.
function busy(s, c, span, late) {
  if (!c.reduced) s.until = Math.max(s.until, s.t + (late || 0) + span);
}

const SPAN = 0.7;     // seconds a cell takes to light or go dark, a mark to arrive
const REVEAL = 1.8;   // seconds the solved bench takes to be cut over
const STAGGER = 0.14; // seconds between one row's marks and the next when the bench marks them all
const TICK = 0.45;    // seconds the card's lens reads one cell before it clicks on to the next

/* ---- shared drawing ------------------------------------------------------------------------- */

// The bench's ground, darkening across it from the side the configuration's turn names (the top
// left corner on a plain card): one quiet choice, drawn once a frame, with nothing scattered on it.
function background(g, w, h, env, v) {
  const a = ((v && v.turn) || 0) * Math.PI * 2;
  const dx = (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a);
  const dy = (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a);
  const ground = g.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

// One cell of a tape. `inset` leaves a line of the bench between cells.
function cell(g, env, x, y, size, lit, inset, tone) {
  const c = env.colors;
  g.fillStyle = lit ? (tone || env.alpha(c.accent, 0.92)) : env.alpha(c.muted, 0.1);
  g.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
}

// The eight patterns of three and what the rule makes of each, or a question mark where the rule
// is still to be read. Patterns run 111 down to 000, as the rule's binary digits do. `reveal`, if
// given, is how far the table has got filling itself in (0..1): it is read out pattern by
// pattern, left to right, each answer cut on in place of its question mark at a moment of its own
// roll, and a lit answer cut in behind the piece's edge on that roll's stair. The table is a
// legend, so an answer, once in, is as plain as the cells it stands for: one shade.
function ruleTable(g, env, x0, y, span, rule, v, reveal) {
  const c = env.colors;
  const rite = riteOf(env);
  const each = span / 8;
  const mini = Math.min(each / 4.2, span * 0.03);
  const inset = mini * clamp(0.1 / v.density, 0.05, 0.16);
  g.font = '500 ' + Math.max(8, Math.round(mini * 1.3)) + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const hood = 7 - i;
    const cx = x0 + each * (i + 0.5);
    for (let b = 0; b < 3; b++) {
      const bit = (hood >> (2 - b)) & 1;
      cell(g, env, cx + (b - 1.5) * mini, y, mini, bit, inset);
    }
    // This pattern's own moment within the reveal: the eight are read out in turn, not at once.
    let p = 1;
    let own = rite;
    if (rule !== null && reveal != null && reveal < 1) {
      own = roll(rite, 0x400 + i);
      p = clamp((reveal - i * 0.07) / (1 - 7 * 0.07), 0, 1);
    }
    if (rule === null || !own.flicker(p)) {
      g.fillStyle = env.alpha(c.accent2, 0.9);
      g.fillText('?', cx, y + mini * 2.1);
    } else {
      const out = (rule >> hood) & 1;
      cell(g, env, cx - mini / 2, y + mini * 1.5, mini, false, inset);
      if (out) {
        own.paint(g, cx - mini / 2 + inset, y + mini * 1.5 + inset, mini - inset * 2, mini - inset * 2, own.stair(p), env.alpha(c.accent2, 0.95));
      } else {
        g.strokeStyle = env.alpha(c.muted, 0.5);
        g.lineWidth = 1;
        g.strokeRect(cx - mini / 2 + inset, y + mini * 1.5 + inset, mini - inset * 2, mini - inset * 2);
      }
    }
  }
}

function label(g, env, text, x, y, size, align, tone) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillStyle = tone || env.colors.fg;
  g.fillText(text, x, y);
}

/* ---- the next row --------------------------------------------------------------------------- */

// Every pattern the hidden rows are made from is one the shown rows already showed with its
// outcome. `depth` is how many rows are hidden at the bottom: one (row five) or two (four and five).
function readable(rows, width, depth) {
  const shown = 5 - (depth || 1);
  const seen = new Set();
  for (let r = 0; r < shown - 1; r++) for (let x = 0; x < width; x++) seen.add(hoodOf(rows[r], x));
  let all = true;
  for (let r = shown - 1; r < 4; r++) for (let x = 0; x < width; x++) if (!seen.has(hoodOf(rows[r], x))) all = false;
  return { all, complete: seen.size === 8 };
}

// The stage's grid knob is ten cells wide at most, so this tape is nine or ten cells.
function nextPlan(env) {
  const number = env.int(100, 999);
  const width = env.int(9, 10);
  const depth = env.chance(0.3) ? 2 : 1;
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rule = env.int(1, 254);
    const start = randomRow(env, width);
    const rows = runRows(start, rule, 4);
    const moves = rows.some((row, i) => i > 0 && differing(row, rows[i - 1]).length);
    if (!rows[4].some(Boolean) || !moves) continue;
    const read = readable(rows, width, depth);
    if (read.complete) return { kind: 'next', number, width, depth, rule, start };
    if (read.all && !fallback) fallback = { kind: 'next', number, width, depth, rule, start };
  }
  return fallback || { kind: 'next', number, width, rule: 30, start: new Array(width).fill(0).map((v, i) => (i === 3 ? 1 : 0)) };
}

function carriedNext(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'next') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.width) || p.width < 9 || p.width > 10) return null;
  if (!Number.isInteger(p.rule) || p.rule < 0 || p.rule > 255) return null;
  if (!isBits(p.start, p.width)) return null;
  const depth = p.depth === 2 ? 2 : 1;
  const rows = runRows(p.start, p.rule, 4);
  if (!rows[4].some(Boolean) || !readable(rows, p.width, depth).all) return null;
  return { kind: 'next', number: p.number, width: p.width, depth, rule: p.rule, start: p.start.slice() };
}

const ROWNAME = ['one', 'two', 'three', 'four', 'five'];

function count(n) {
  return n <= 12 ? WORDS[n] : String(n);
}

function nextTitle(plan) {
  return plan.depth === 2 ? 'tape ' + plan.number + ': the long recital' : 'tape ' + plan.number + ': recite the next row';
}

function nextGeometry(w, h, width, v) {
  const scale = clamp(v.scale, 0.88, 1.08);
  const labelW = Math.max(14, Math.min(w, h) * 0.06);
  const size = Math.min((w * 0.86 - labelW) / width, (h * 0.56) / 5.6) * scale;
  return { size, left: (w - size * width + labelW) / 2, top: h * 0.1, gap: size * 0.6, labelW };
}

// `s` is the scene's state: the visitor's row five, the cells a hint has shown, whether the rule
// is out (solved).
function drawNext(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const geo = nextGeometry(w, h, plan.width, v);
  const rows = rowsOf(plan);
  const inset = geo.size * clamp(0.09 / v.density, 0.05, 0.14);
  const small = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  background(g, w, h, env, v);
  const depth = plan.depth || 1;
  const shown = 5 - depth;
  const y0 = geo.top + shown * geo.size + geo.gap;
  // The rows the rule is shown making.
  for (let r = 0; r < shown; r++) {
    const y = geo.top + r * geo.size;
    label(g, env, String(r + 1), geo.left - geo.labelW * 0.5, y + geo.size / 2, small, 'center', env.alpha(c.muted, 0.9));
    for (let x = 0; x < plan.width; x++) cell(g, env, geo.left + x * geo.size, y, geo.size, rows[r][x], inset);
  }
  // The hidden rows: the visitor's, outlined, lit where they have lit them. A cell they light is
  // cut in on a roll of its own (another roll each time it is pressed) -- by a curve from the
  // point they pressed, or by the piece's edge from the knobs -- and rests in two shades; one they
  // put out goes back down the same stair, the way it came. Its outline steps between the two
  // tones on that stair.
  const openP = s.open ? came(s.t, s.openAt, REVEAL, env.reduced) : 0;
  const box = geo.size - inset * 2;
  for (let k = 0; k < depth; k++) {
    const y5 = y0 + k * geo.size;
    label(g, env, String(shown + k + 1), geo.left - geo.labelW * 0.5, y5 + geo.size / 2, small, 'center', c.accent2);
    for (let x = 0; x < plan.width; x++) {
      const x0 = geo.left + x * geo.size;
      const i = k * plan.width + x;
      const on = cellLevel(s, i, env.reduced);
      const m = s.cells[i];
      cell(g, env, x0, y5, geo.size, false, inset);
      if (on > 0) cover(g, env, (m && m.edge) || rite, x0 + inset, y5 + inset, box, box, on, c.accent2, 0.95);
      g.strokeStyle = env.alpha(env.mix(c.muted, c.accent2, on), 0.55 + 0.35 * on);
      g.lineWidth = 1;
      g.strokeRect(x0 + inset, y5 + inset, box, box);
      const hinted = s.shown.indexOf(i);
      if (hinted >= 0) {
        // A hinted cell: a small mark beside it -- above the first hidden row, under the second --
        // lit or dark as the rule has it. It is cut on at its moment at half its size, grows the
        // rest of the way on its stair, and holds.
        const mark = roll(rite, 0x300 + i);
        const mp = came(s.t, s.shownAt && s.shownAt[hinted], SPAN, env.reduced);
        if (!mark.flicker(mp)) continue;
        const grow = 0.5 + 0.5 * mark.stair(mp);
        const want = rows[shown + k][x];
        const my = k === 0 ? y5 - geo.gap / 2 : y5 + geo.size + Math.max(3, geo.size * 0.18);
        g.fillStyle = want ? c.accent2 : env.alpha(c.muted, 0.7);
        g.beginPath();
        g.arc(x0 + geo.size / 2, my, Math.max(1.5, geo.size * 0.08 * grow), 0, Math.PI * 2);
        g.fill();
        if (!want) {
          g.strokeStyle = env.alpha(c.muted, 0.9);
          g.beginPath();
          g.arc(x0 + geo.size / 2, my, Math.max(2.5, geo.size * 0.13 * grow), 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
  }
  // The solved rows are set: the light's colour is cut across them behind the piece's edge and
  // rests there in two shades.
  if (s.open) {
    const solved = roll(rite, 0x7f);
    cover(g, env, solved, geo.left, y0, geo.size * plan.width, geo.size * depth, solved.stair(openP), c.accent2, 0.18);
  }
  // The frame of the bench, and the table of patterns under it.
  g.strokeStyle = env.alpha(c.muted, 0.25);
  g.lineWidth = 1;
  g.strokeRect(geo.left - inset, geo.top - inset, geo.size * plan.width + inset * 2, geo.size * shown + inset * 2);
  const tableY = y0 + depth * geo.size + Math.max(h * 0.06, geo.size * 0.7);
  ruleTable(g, env, w * 0.06, tableY, w * 0.88, s.open ? plan.rule : null, v, s.open ? openP : null);
  // The lens: the three cells one row above a cell, bracketed, the cell under them pointed at,
  // and their pattern of three marked in the table -- what to look up to set that cell. A card's
  // lens walks the shown rows a cell at a click; the piece's moves to the cell last tapped in one
  // cut at its moment, staying where it was until then, and holds.
  const lens = showing(s.lens, s.t, SPAN, env.reduced);
  if (lens) {
    const r = clamp(Math.floor(lens.r), 0, 3);
    const vals = r < shown ? rows[r] : s.row.slice((r - shown) * plan.width, (r - shown + 1) * plan.width);
    const col = clamp(Math.floor(lens.u), 0, plan.width - 1);
    if (vals.length === plan.width) {
      const yR = r < shown ? geo.top + r * geo.size : y0 + (r - shown) * geo.size;
      const yB = r + 1 < shown ? geo.top + (r + 1) * geo.size : y0 + (r + 1 - shown) * geo.size;
      const cx = geo.left + col * geo.size;
      g.strokeStyle = c.accent2;
      g.lineWidth = Math.max(1.5, geo.size * 0.1);
      for (let d = -1; d <= 1; d++) {
        const x = (col + d + plan.width) % plan.width;
        g.strokeRect(geo.left + x * geo.size + inset * 0.4, yR + inset * 0.4, geo.size - inset * 0.8, geo.size - inset * 0.8);
      }
      g.fillStyle = c.accent2;
      g.beginPath();
      g.moveTo(cx + geo.size / 2, yB + geo.size * 0.12);
      g.lineTo(cx + geo.size * 0.3, yB + geo.size * 0.42);
      g.lineTo(cx + geo.size * 0.7, yB + geo.size * 0.42);
      g.closePath();
      g.fill();
      const each = w * 0.88 / 8;
      const gx = w * 0.06 + each * (7 - hoodOf(vals, col) + 0.5);
      const tip = Math.max(3, geo.size * 0.15);
      g.beginPath();
      g.moveTo(gx, tableY - tip * 0.8);
      g.lineTo(gx - tip, tableY - tip * 2.2);
      g.lineTo(gx + tip, tableY - tip * 2.2);
      g.closePath();
      g.fill();
    }
  }
  // The caption changes its words by a cut at its moment, never by a crossfade.
  const named = s.open && roll(rite, 0x7e).flicker(openP);
  label(g, env, named ? 'rule ' + plan.rule : 'the rule, pattern by pattern', w * 0.5, Math.min(h * 0.97, tableY + geo.size * 1.9), small, 'center', env.alpha(c.muted, 0.85));
}

// Where cell i of the hidden rows stands at s.t, 0 (dark) to 1 (lit): it set off from where it
// stood when it was last pressed and climbs or goes down its own stair to where that press sent
// it, one way and never from an end it had not reached. A cell never pressed stands as the row has
// it.
function cellLevel(s, i, reduced) {
  const m = s.cells[i];
  if (!m) return s.row[i] ? 1 : 0;
  if (reduced) return m.to;
  return m.from + (m.to - m.from) * m.own.stair(came(s.t, m.at, SPAN, reduced));
}

// The scene's state before anyone has touched it: no cell lit, nothing shown, the rule unread,
// and no clock yet (a card is drawn once and stands). `cells` holds each pressed cell's movement,
// `until` the end of the last movement in flight and `drawn` the last picture frame() drew.
function nextBlank(plan) {
  return { row: new Array(plan.width * (plan.depth || 1)).fill(0), shown: [], shownAt: [], cells: [], flips: [], taps: 0, open: false, openAt: null, t: 0, lens: null, until: -Infinity, drawn: null };
}

function nextPreview(g, w, h, env, plan, lens) {
  const s = nextBlank(plan);
  s.lens = lens ? { was: null, now: lens, at: null, roll: STILL } : null;
  drawNext(g, w, h, env, plan, s, env.variant);
}

function nextPiece(env, plan) {
  const helps = asked(env).helps;
  const width = plan.width;
  const depth = plan.depth || 1;
  const shown = 5 - depth;
  const cells = width * depth;
  const rows = rowsOf(plan);
  const answer = rows.slice(shown).reduce((all, row) => all.concat(row), []);
  const s = nextBlank(plan);
  const rowName = (i) => ROWNAME[shown + Math.floor(i / width)];
  const draw = (c) => {
    drawNext(c.g, c.w, c.h, c, plan, s, env.variant);
    seen(s, c);
  };
  // A row written: every cell that changed starts its rite now, on a fresh roll of its own, from
  // wherever it stands. A cell setting off from dark is cut by a curve from the point it was
  // pressed at (`press`, from tap), or by the piece's own edge when a knob set it; one already on
  // its way keeps the edge it has, so a change of mind goes on with the same cut.
  function write(next, c, press) {
    const rite = riteOf(c);
    for (let i = 0; i < cells; i++) {
      const to = next[i] ? 1 : 0;
      if (to === (s.row[i] ? 1 : 0)) continue;
      const from = cellLevel(s, i, c.reduced);
      const was = s.cells[i];
      s.flips[i] = (s.flips[i] || 0) + 1;
      s.cells[i] = {
        from, to, at: s.t,
        own: rite.at(0x100 + i * 0x20 + s.flips[i]),
        edge: from > 0 && was ? was.edge : press && press.i === i ? pressedEdge(press.u, press.v) : null
      };
      busy(s, c, SPAN);
    }
    s.row = next.map((v) => (v ? 1 : 0));
  }
  function right() {
    let n = 0;
    for (let i = 0; i < cells; i++) if ((s.row[i] ? 1 : 0) === answer[i]) n += 1;
    return n;
  }
  return {
    title: nextTitle(plan),
    brief: 'The automaton keeps one liturgy: each cell of a row is set by the three cells above it, itself and its two neighbours, and the tape wraps round at its ends. ' + (depth === 2
      ? 'One hidden rule made rows two and three, and every one of the eight patterns of three appears somewhere in rows one and two, so the rule can be read off the bench and run on twice.'
      : 'One hidden rule made rows two, three and four, and every one of the eight patterns of three appears somewhere in rows one to three, so the rule can be read off the bench.'),
    goal: depth === 2 ? 'Write rows four and five.' : 'Write row five.',
    aspect: '4 / 3',
    checkLabel: depth === 2 ? 'check the rows' : 'check the row',
    steps: [
      { id: 'row', ask: depth === 2 ? 'rows four and five: tap their cells on the bench, or mark them here' : 'row five: tap its cells on the bench, or mark them here', kind: 'grid', rows: depth, cols: width, states: 2, labels: ['dark', 'lit'] },
      { id: 'hint', ask: depth === 2 ? 'one hidden cell' : 'one cell of row five', kind: 'press', count: 1, label: 'show one cell', optional: true }
    ],
    solution: { row: answer },
    check(c) {
      const n = right();
      if (n === cells) return { solved: true, say: 'the tape accepts ' + (depth === 2 ? 'rows four and five' : 'row five') + '; the rule was ' + plan.rule };
      return { solved: false, say: (n === 1 ? 'one cell' : count(n) + ' cells') + ' of ' + count(cells) + ' ' + (n === 1 ? 'is' : 'are') + ' right' };
    },
    start(c) {
      c.status(depth === 2 ? 'two rows hidden: tap a cell of row four or five to light it, and the bench brackets the three cells above it' : 'tap a cell of row five to light it, and the bench brackets the three cells above it');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'row' && Array.isArray(value) && value.length === cells) {
        write(value, c, null);
        const lit = s.row.filter(Boolean).length;
        c.status((depth === 2 ? 'the hidden rows: ' : 'row five: ') + (lit === 1 ? 'one cell lit' : count(lit) + ' cells lit'));
      }
      if (id === 'hint') {
        const next = [];
        if (s.shown.length < helps) {
          for (let i = 0; i < cells; i++) if (!s.shown.includes(i)) next.push(i);
        }
        if (next.length) {
          const i = next[Math.floor(next.length / 2)];
          s.shown.push(i);
          s.shownAt.push(s.t);
          busy(s, c, SPAN);
          c.hint();
          c.status('cell ' + ((i % width) + 1) + ' of row ' + rowName(i) + ' is ' + (answer[i] ? 'lit' : 'dark'));
        } else if (s.shown.length >= helps) {
          c.status('that is all the bench will show at this difficulty; run the rule yourself');
        } else {
          c.status('every hidden cell is marked on the bench');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = nextGeometry(c.w, c.h, width, env.variant || PLAIN);
      const y0 = geo.top + shown * geo.size + geo.gap;
      const col = Math.floor((x * c.w - geo.left) / geo.size);
      const rel = (y * c.h - y0) / geo.size;
      if (col < 0 || col >= width || rel < -0.4 || rel > depth + 0.4) {
        c.status((depth === 2 ? 'rows four and five are' : 'row five is') + ' outlined; tap a cell there');
        return;
      }
      const row = clamp(Math.floor(rel), 0, depth - 1);
      const i = row * width + col;
      const next = s.row.slice();
      next[i] = next[i] ? 0 : 1;
      // Where in the cell the press landed, in fractions of it: the point its curve grows from.
      const u = clamp((x * c.w - (geo.left + col * geo.size)) / geo.size, 0, 1);
      const v = clamp((y * c.h - (y0 + row * geo.size)) / geo.size, 0, 1);
      write(next, c, { i, u, v });
      // The lens moves to the tapped cell, its three parents bracketed and their pattern marked:
      // it stays where it was until its moment and is then cut over, on a roll for this tap.
      s.taps += 1;
      s.lens = { was: showing(s.lens, s.t, SPAN, c.reduced), now: { r: shown - 1 + row, u: col }, at: s.t, roll: riteOf(c).at(0x5c0 + s.taps) };
      busy(s, c, SPAN);
      c.set('row', next.slice());
      c.status('cell ' + (col + 1) + ' of row ' + rowName(i) + ' ' + (next[i] ? 'lit' : 'dark') + '; its three parents are bracketed above and their pattern is marked in the table');
      draw(c);
    },
    // The clock moves every frame; the bench is drawn only while something is on its way, or
    // when the canvas has been sized again. A bench at rest is not drawn at all.
    frame(t, dt, c) {
      s.t = t;
      if (due(s, c)) draw(c);
    },
    end(c) {
      s.open = true;
      s.openAt = s.t;
      busy(s, c, REVEAL);
      c.status('rule ' + plan.rule + ': the table under the bench is filled in');
      draw(c);
    }
  };
}

/* ---- the changed cell ----------------------------------------------------------------------- */

// The two tapes' rows and where they differ, row by row.
function apexHistory(plan) {
  const flipped = plan.start.slice();
  flipped[plan.flip] ^= 1;
  const a = runRows(plan.start, plan.rule, plan.rows);
  const b = runRows(flipped, plan.rule, plan.rows);
  return { a, b, diffs: a.map((row, r) => differing(row, b[r])) };
}

// The same, run once for a plan the bench draws and kept with it.
const histories = new WeakMap();
function historyOf(plan) {
  let hist = histories.get(plan);
  if (!hist) histories.set(plan, (hist = apexHistory(plan)));
  return hist;
}

// The flip reaches exactly the three cells under it in row one, so the apex can be read.
function apexSound(plan) {
  const hist = apexHistory(plan);
  const n = plan.width;
  const want = [(plan.flip + n - 1) % n, plan.flip, (plan.flip + 1) % n].sort((p, q) => p - q);
  const first = hist.diffs[1];
  const cone = first.length === 3 && first.every((x, i) => x === want[i]);
  return cone && hist.diffs[plan.rows].length >= 1;
}

function apexPlan(env) {
  const number = env.int(100, 999);
  const width = env.int(10, 12);
  const rows = env.int(4, 7);
  let plan = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rule = env.chance(0.18) ? env.pick(APEX_PARITY) : env.pick(APEX_RULES);
    plan = { kind: 'apex', number, width, rows, rule, start: randomRow(env, width), flip: env.int(0, width - 1) };
    if (apexSound(plan)) return plan;
  }
  return plan;
}

function carriedApex(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'apex') return null;
  if (!Number.isInteger(p.number) || p.number < 100 || p.number > 999) return null;
  if (!Number.isInteger(p.width) || p.width < 10 || p.width > 12) return null;
  if (!Number.isInteger(p.rows) || p.rows < 4 || p.rows > 7) return null;
  if (!Number.isInteger(p.rule) || p.rule < 0 || p.rule > 255) return null;
  if (!Number.isInteger(p.flip) || p.flip < 0 || p.flip >= p.width) return null;
  if (!isBits(p.start, p.width)) return null;
  const plan = { kind: 'apex', number: p.number, width: p.width, rows: p.rows, rule: p.rule, start: p.start.slice(), flip: p.flip };
  return apexSound(plan) ? plan : null;
}

function apexTitle(plan) {
  return 'tape ' + plan.number + ': the changed cell';
}

function apexGeometry(w, h, plan, v) {
  const scale = clamp(v.scale, 0.88, 1.08);
  const gap = w * 0.06;
  const labelW = Math.max(12, Math.min(w, h) * 0.05);
  const size = Math.min((w * 0.9 - gap - labelW * 2) / (2 * plan.width), (h * 0.56) / (plan.rows + 1)) * scale;
  const tapeW = size * plan.width;
  const total = tapeW * 2 + gap + labelW * 2;
  const left1 = (w - total) / 2 + labelW;
  return { size, left: [left1, left1 + tapeW + gap + labelW], top: h * 0.3, labelW, tapeW };
}

// `s`: the rows whose differences are marked, whether the flip is pointed out (solved).
function drawApex(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const geo = apexGeometry(w, h, plan, v);
  const hist = historyOf(plan);
  const inset = geo.size * clamp(0.09 / v.density, 0.05, 0.14);
  const small = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  const box = geo.size - inset * 2;
  const pointedP = s.pointed ? came(s.t, s.pointedAt, REVEAL, env.reduced) : 0;
  background(g, w, h, env, v);
  label(g, env, 'rule ' + plan.rule, w * 0.5, h * 0.06, small + 2, 'center', c.accent2);
  ruleTable(g, env, w * 0.08, h * 0.1, w * 0.84, plan.rule, v);
  for (let tape = 0; tape < 2; tape++) {
    const left = geo.left[tape];
    const rows = tape ? hist.b : hist.a;
    label(g, env, tape ? 'the second tape' : 'the first tape', left + geo.tapeW / 2, geo.top - geo.size * 0.8, small, 'center');
    // The flipped column, once it is pointed out, is set: a wash down the whole column of both
    // tapes, cut in behind the piece's edge on a roll of the tape's own and resting in two shades.
    if (s.pointed) {
      const wash = roll(rite, 0x7c + tape);
      cover(g, env, wash, left + plan.flip * geo.size, geo.top, geo.size, geo.size * (plan.rows + 1), wash.stair(pointedP), c.accent2, 0.16);
    }
    // The hidden first row: an outline and nothing in it.
    g.setLineDash([3, 3]);
    g.strokeStyle = env.alpha(c.muted, 0.5);
    g.lineWidth = 1;
    g.strokeRect(left + inset, geo.top + inset, geo.tapeW - inset * 2, geo.size - inset * 2);
    g.setLineDash([]);
    if (tape === 0) label(g, env, '?', left - geo.labelW * 0.5, geo.top + geo.size / 2, small, 'center', env.alpha(c.muted, 0.9));
    for (let r = 1; r <= plan.rows; r++) {
      const y = geo.top + r * geo.size;
      if (tape === 0) label(g, env, String(r), left - geo.labelW * 0.5, y + geo.size / 2, small, 'center', env.alpha(c.muted, 0.9));
      // A marked row: each differing cell is set, a wash cut in behind the piece's edge and
      // resting in two shades, and its outline is cut on at its moment and holds, the row on a
      // roll of its own.
      const marked = tape === 1 ? s.marked.indexOf(r) : -1;
      const own = marked >= 0 ? roll(rite, 0x200 + r) : null;
      const mp = marked >= 0 ? came(s.t, s.markedAt && s.markedAt[marked], SPAN, env.reduced) : 0;
      for (let x = 0; x < plan.width; x++) {
        cell(g, env, left + x * geo.size, y, geo.size, rows[r][x], inset);
        if (own && hist.diffs[r].includes(x)) {
          cover(g, env, own, left + x * geo.size + inset, y + inset, box, box, own.stair(mp), c.accent2, rows[r][x] ? 0.3 : 0.45);
          if (own.flicker(mp)) {
            g.strokeStyle = c.accent2;
            g.lineWidth = Math.max(1, geo.size * 0.07);
            g.strokeRect(left + x * geo.size + inset, y + inset, box, box);
          }
        }
      }
    }
    g.strokeStyle = env.alpha(c.muted, 0.25);
    g.lineWidth = 1;
    g.strokeRect(left - inset, geo.top - inset, geo.tapeW + inset * 2, geo.size * (plan.rows + 1) + inset * 2);
    // Column numbers, every one on a wide bench and every other on a card.
    const every = geo.size > 16 ? 1 : 2;
    for (let x = 0; x < plan.width; x += every) {
      label(g, env, String(x + 1), left + (x + 0.5) * geo.size, geo.top + (plan.rows + 1) * geo.size + small * 0.9, Math.max(8, small - 2), 'center', env.alpha(c.muted, 0.8));
    }
    // The apex: it is cut on over the hidden row at its moment and holds.
    if (tape === 1 && s.pointed && roll(rite, 0x7e).flicker(pointedP)) {
      const x = left + (plan.flip + 0.5) * geo.size;
      g.fillStyle = c.accent2;
      g.beginPath();
      g.moveTo(x, geo.top + geo.size * 0.25);
      g.lineTo(x - geo.size * 0.22, geo.top + geo.size * 0.75);
      g.lineTo(x + geo.size * 0.22, geo.top + geo.size * 0.75);
      g.closePath();
      g.fill();
    }
  }
}

// The scene's state before anyone has touched it: no row marked, the flip not pointed out, and
// no clock yet (a card is drawn once and stands). `until` is the end of the last movement in
// flight and `drawn` the last picture frame() drew.
function apexBlank() {
  return { marked: [], markedAt: [], pointed: false, pointedAt: null, t: 0, until: -Infinity, drawn: null };
}

function apexPreview(g, w, h, env, plan) {
  drawApex(g, w, h, env, plan, apexBlank(), env.variant);
}

function apexPiece(env, plan) {
  const helps = asked(env).helps;
  const hist = historyOf(plan);
  const last = hist.diffs[plan.rows].length;
  const s = apexBlank();
  const draw = (c) => {
    drawApex(c.g, c.w, c.h, c, plan, s, env.variant);
    seen(s, c);
  };
  return {
    title: apexTitle(plan),
    brief: 'Two tapes, one rite: both ran rule ' + plan.rule + ', drawn at the top pattern by pattern, from one first row -- except that one cell of the second tape\'s first row was flipped. The first rows are hidden; the ' + WORDS[plan.rows] + ' rows after them are shown. A change in a row reaches only the cell under it and the two beside that in the next, and the tape wraps round.',
    goal: 'Find the column of the flipped cell, and count the cells that differ in row ' + plan.rows + '.',
    aspect: '16 / 10',
    checkLabel: 'check the tapes',
    steps: [
      { id: 'column', ask: 'the column of the flipped cell', kind: 'number', min: 1, max: plan.width, step: 1, unit: 'column' },
      { id: 'differ', ask: 'how many cells differ in row ' + plan.rows, kind: 'number', min: 0, max: plan.width, step: 1, unit: 'cells' },
      { id: 'hint', ask: 'the differences in one row, marked', kind: 'press', count: 1, label: 'mark one row', optional: true }
    ],
    solution: { column: plan.flip + 1, differ: last },
    check(c) {
      const colRight = Number(c.value('column')) === plan.flip + 1;
      const countRight = Number(c.value('differ')) === last;
      if (colRight && countRight) {
        return { solved: true, say: 'the flip is found: column ' + (plan.flip + 1) + ' was flipped, and ' + (last === 1 ? 'one cell differs' : WORDS[last] + ' cells differ') + ' in row ' + plan.rows };
      }
      if (!colRight && !countRight) return { solved: false, say: 'neither reading holds: the column and the count are both off' };
      return { solved: false, say: colRight ? 'the column is right; the count is off' : 'the count is right; the column is off' };
    },
    start(c) {
      c.status('compare the two tapes row by row');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'column') {
        const col = Math.round(Number(value));
        if (Number.isFinite(col)) c.status('the flipped cell, you say, is in column ' + clamp(col, 1, plan.width));
      }
      if (id === 'differ') {
        const n = Math.round(Number(value));
        if (Number.isFinite(n)) c.status(clamp(n, 0, plan.width) + ' of ' + plan.width + ' cells differ in row ' + plan.rows + ', you say');
      }
      if (id === 'hint') {
        // Rows between the first and the last, the middle one first.
        const order = [];
        const mid = Math.ceil(plan.rows / 2);
        for (let r = mid; r < plan.rows; r++) order.push(r);
        for (let r = mid - 1; r > 1; r--) order.push(r);
        const next = s.marked.length < helps ? order.find((r) => !s.marked.includes(r)) : undefined;
        if (next) {
          s.marked.push(next);
          s.markedAt.push(s.t);
          busy(s, c, SPAN);
          c.hint();
          const n = hist.diffs[next].length;
          c.status('row ' + next + ' is marked on the second tape: ' + (n === 1 ? 'one cell differs' : WORDS[n] + ' cells differ') + ' there');
        } else if (s.marked.length >= helps) {
          c.status('that is all the bench will mark at this difficulty; the rest is yours');
        } else {
          c.status('every row between the first and the last is marked; the rest is yours');
        }
      }
      draw(c);
    },
    // As on the next row: the clock moves every frame, the tapes are drawn only while something
    // is on its way or the canvas has been sized again.
    frame(t, dt, c) {
      s.t = t;
      if (due(s, c)) draw(c);
    },
    end(c) {
      s.pointed = true;
      s.pointedAt = s.t;
      busy(s, c, REVEAL);
      // The rows not yet marked come in one after another down the tape, each in its turn.
      let late = 0;
      for (let r = 1; r <= plan.rows; r++) {
        if (s.marked.includes(r)) continue;
        s.marked.push(r);
        s.markedAt.push(s.t + late * STAGGER);
        busy(s, c, SPAN, late * STAGGER);
        late += 1;
      }
      c.status('the flip in column ' + (plan.flip + 1) + ' spread to ' + (last === 1 ? 'one cell' : WORDS[last] + ' cells') + ' by row ' + plan.rows + '; every difference is marked');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which puzzle a seed is dealt, from the seed alone so that paint, spark and piece agree.
function dealsApex(env) {
  return (((Math.imul(env.seed >>> 0, 0x9E3779B1) >>> 0) >>> 3) & 1) === 1;
}

// The plan, dealt once from the env's seeded stream and kept with that env, so the still picture,
// every animated frame, the spark and the piece of one card are all the same tape.
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const apex = dealsApex(env);
    got = { apex, plan: apex ? apexPlan(env) : nextPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'machine-shop',
  needsSky: false,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.apex) apexPreview(g, w, h, env, d.plan);
    else {
      nextPreview(g, w, h, env, d.plan, { r: 0, u: 0 });
      d.drawn = { g, w, h, k: 0 };
    }
  },
  // The card in motion: the lens reads the shown rows once, a cell at a time, each pattern of
  // three against the table. It moves as a ratchet does: one click a cell, every click the same
  // length (TICK) and the same distance, always on to the next cell in reading order -- along a
  // row, then the next row from its first cell. Once every cell has been read, one more click puts
  // it back where paint left it, and the card rests there and says so (false), so the feed lets it
  // go: a card is read once, not forever. At t = 0 it stands where paint left it. Between two
  // clicks nothing on the card has changed and its canvas already holds the picture, so the canvas
  // last drawn on is drawn again only when the lens has clicked on: the same picture for the same
  // t, drawn a couple of times a second rather than thirty. Less motion, and the changed cell's two
  // tapes, do not move, and say so.
  animate(g, w, h, env, t) {
    const d = deal(env);
    if (d.apex || env.reduced) return false;
    const shown = 5 - (d.plan.depth || 1);
    const total = d.plan.width * (shown - 1);
    const click = Math.floor(Math.max(0, t) / TICK);
    const k = click >= total ? 0 : click;
    const last = d.drawn;
    if (!(last && last.g === g && last.w === w && last.h === h && last.k === k)) {
      const r = Math.floor(k / d.plan.width);
      nextPreview(g, w, h, env, d.plan, { r, u: k - r * d.plan.width });
      d.drawn = { g, w, h, k };
    }
    return click < total;
  },
  spark(env) {
    const d = deal(env);
    if (d.apex) {
      const plan = d.plan;
      return {
        title: apexTitle(plan),
        text: 'Two tapes, one rite: rule ' + plan.rule + ', one cell apart at the start. Find the column that was flipped and count what it changed by row ' + plan.rows + '.',
        mono: plan.width + ' cells / ' + plan.rows + ' rows shown',
        aspect: '16 / 10',
        paint: (ctx, cw, ch, cardEnv) => apexPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: nextTitle(plan),
      text: plan.depth === 2
        ? 'Three rows of one hidden rule, every pattern of three on show. Read the rule off the bench and run it on twice: recite rows four and five.'
        : 'Four rows of one hidden rule, every pattern of three on show. Read the rule off the bench and recite the fifth row.',
      mono: plan.width + ' cells / rule ?' + (plan.depth === 2 ? ' / two rows hidden' : ''),
      aspect: '4 / 3',
      paint: (ctx, cw, ch, cardEnv) => nextPreview(ctx, cw, ch, cardEnv, plan, { r: 0, u: 0 }),
      of: plan
    };
  },
  piece(env) {
    const apex = carriedApex(env);
    if (apex) return apexPiece(env, apex);
    const next = carriedNext(env);
    if (next) return nextPiece(env, next);
    const d = deal(env);
    return d.apex ? apexPiece(env, d.plan) : nextPiece(env, d.plan);
  }
};
