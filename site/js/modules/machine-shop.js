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

/* ---- shared drawing ------------------------------------------------------------------------- */

function background(g, w, h, env) {
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

// The bench's faint grain: a few marks whose phase is the configuration's turn and whose number
// is its density.
function grain(g, w, h, env, v) {
  g.fillStyle = env.alpha(env.colors.accent, 0.12);
  for (let i = 0, count = Math.max(6, Math.round(22 * v.density)); i < count; i++) {
    const x = ((i * 0.6180339 + v.turn * 0.37) % 1) * w;
    const y = ((i * 0.7548777 + v.turn * 0.11) % 1) * h;
    g.fillRect(x, y, 1, 1);
  }
}

// One cell of a tape. `inset` leaves the grain of the bench between cells.
function cell(g, env, x, y, size, lit, inset, tone) {
  const c = env.colors;
  g.fillStyle = lit ? (tone || env.alpha(c.accent, 0.92)) : env.alpha(c.muted, 0.1);
  g.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
}

// The eight patterns of three and what the rule makes of each, or a question mark where the rule
// is still to be read. Patterns run 111 down to 000, as the rule's binary digits do.
function glyphTable(g, env, x0, y, span, rule, v) {
  const c = env.colors;
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
    if (rule === null) {
      g.fillStyle = env.alpha(c.accent2, 0.9);
      g.fillText('?', cx, y + mini * 2.1);
    } else {
      const out = (rule >> hood) & 1;
      cell(g, env, cx - mini / 2, y + mini * 1.5, mini, out, inset, env.alpha(c.accent2, 0.95));
      if (!out) {
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
  const geo = nextGeometry(w, h, plan.width, v);
  const rows = runRows(plan.start, plan.rule, 4);
  const inset = geo.size * clamp(0.09 / v.density, 0.05, 0.14);
  const small = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  background(g, w, h, env);
  grain(g, w, h, env, v);
  const depth = plan.depth || 1;
  const shown = 5 - depth;
  const y0 = geo.top + shown * geo.size + geo.gap;
  // The rows the rule is shown making.
  for (let r = 0; r < shown; r++) {
    const y = geo.top + r * geo.size;
    label(g, env, String(r + 1), geo.left - geo.labelW * 0.5, y + geo.size / 2, small, 'center', env.alpha(c.muted, 0.9));
    for (let x = 0; x < plan.width; x++) cell(g, env, geo.left + x * geo.size, y, geo.size, rows[r][x], inset);
  }
  // The hidden rows: the visitor's, outlined, lit where they have lit them.
  for (let k = 0; k < depth; k++) {
  const y5 = y0 + k * geo.size;
  label(g, env, String(shown + k + 1), geo.left - geo.labelW * 0.5, y5 + geo.size / 2, small, 'center', c.accent2);
  for (let x = 0; x < plan.width; x++) {
    const x0 = geo.left + x * geo.size;
    const i = k * plan.width + x;
    const lit = !!s.row[i];
    cell(g, env, x0, y5, geo.size, lit, inset, env.alpha(c.accent2, 0.95));
    g.strokeStyle = env.alpha(lit ? c.accent2 : c.muted, lit ? 0.9 : 0.55);
    g.lineWidth = 1;
    g.strokeRect(x0 + inset, y5 + inset, geo.size - inset * 2, geo.size - inset * 2);
    if (s.shown.includes(i)) {
      // A hinted cell: a small mark beside it -- above the first hidden row, under the second --
      // lit or dark as the rule has it.
      const want = rows[shown + k][x];
      const my = k === 0 ? y5 - geo.gap / 2 : y5 + geo.size + Math.max(3, geo.size * 0.18);
      g.fillStyle = want ? c.accent2 : env.alpha(c.muted, 0.7);
      g.beginPath();
      g.arc(x0 + geo.size / 2, my, Math.max(1.5, geo.size * 0.08), 0, Math.PI * 2);
      g.fill();
      if (!want) {
        g.strokeStyle = env.alpha(c.muted, 0.9);
        g.beginPath();
        g.arc(x0 + geo.size / 2, my, Math.max(2.5, geo.size * 0.13), 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  }
  // The frame of the bench, and the table of patterns under it.
  g.strokeStyle = env.alpha(c.muted, 0.25);
  g.lineWidth = 1;
  g.strokeRect(geo.left - inset, geo.top - inset, geo.size * plan.width + inset * 2, geo.size * shown + inset * 2);
  const tableY = y0 + depth * geo.size + Math.max(h * 0.06, geo.size * 0.7);
  glyphTable(g, env, w * 0.06, tableY, w * 0.88, s.open ? plan.rule : null, v);
  label(g, env, s.open ? 'rule ' + plan.rule : 'the rule, pattern by pattern', w * 0.5, Math.min(h * 0.97, tableY + geo.size * 1.9), small, 'center', env.alpha(c.muted, 0.85));
}

function nextPreview(g, w, h, env, plan) {
  drawNext(g, w, h, env, plan, { row: new Array(plan.width * (plan.depth || 1)).fill(0), shown: [], open: false }, env.variant);
}

function nextPiece(env, plan) {
  const width = plan.width;
  const depth = plan.depth || 1;
  const shown = 5 - depth;
  const cells = width * depth;
  const rows = runRows(plan.start, plan.rule, 4);
  const answer = rows.slice(shown).reduce((all, row) => all.concat(row), []);
  const s = { row: new Array(cells).fill(0), shown: [], open: false };
  const rowName = (i) => ROWNAME[shown + Math.floor(i / width)];
  const draw = (c) => drawNext(c.g, c.w, c.h, c, plan, s, env.variant);
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
      c.status(depth === 2 ? 'two rows hidden: tap a cell of row four or five to light it' : 'tap a cell of row five to light it');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'row' && Array.isArray(value) && value.length === cells) {
        s.row = value.map((v) => (v ? 1 : 0));
        const lit = s.row.filter(Boolean).length;
        c.status((depth === 2 ? 'the hidden rows: ' : 'row five: ') + (lit === 1 ? 'one cell lit' : count(lit) + ' cells lit'));
      }
      if (id === 'hint') {
        const next = [];
        for (let i = 0; i < cells; i++) if (!s.shown.includes(i)) next.push(i);
        if (next.length) {
          const i = next[Math.floor(next.length / 2)];
          s.shown.push(i);
          c.hint();
          c.status('cell ' + ((i % width) + 1) + ' of row ' + rowName(i) + ' is ' + (answer[i] ? 'lit' : 'dark'));
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
      const i = clamp(Math.floor(rel), 0, depth - 1) * width + col;
      const next = s.row.slice();
      next[i] = next[i] ? 0 : 1;
      s.row = next;
      c.set('row', next.slice());
      c.status('cell ' + (col + 1) + ' of row ' + rowName(i) + ' ' + (next[i] ? 'lit' : 'dark'));
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.open = true;
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
  const geo = apexGeometry(w, h, plan, v);
  const hist = apexHistory(plan);
  const inset = geo.size * clamp(0.09 / v.density, 0.05, 0.14);
  const small = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.036)));
  background(g, w, h, env);
  grain(g, w, h, env, v);
  label(g, env, 'rule ' + plan.rule, w * 0.5, h * 0.06, small + 2, 'center', c.accent2);
  glyphTable(g, env, w * 0.08, h * 0.1, w * 0.84, plan.rule, v);
  for (let tape = 0; tape < 2; tape++) {
    const left = geo.left[tape];
    const rows = tape ? hist.b : hist.a;
    label(g, env, tape ? 'the second tape' : 'the first tape', left + geo.tapeW / 2, geo.top - geo.size * 0.8, small, 'center');
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
      for (let x = 0; x < plan.width; x++) {
        cell(g, env, left + x * geo.size, y, geo.size, rows[r][x], inset);
        if (tape === 1 && s.marked.includes(r) && hist.diffs[r].includes(x)) {
          g.strokeStyle = c.accent2;
          g.lineWidth = Math.max(1, geo.size * 0.07);
          g.strokeRect(left + x * geo.size + inset, y + inset, geo.size - inset * 2, geo.size - inset * 2);
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
    if (tape === 1 && s.pointed) {
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

function apexPreview(g, w, h, env, plan) {
  drawApex(g, w, h, env, plan, { marked: [], pointed: false }, env.variant);
}

function apexPiece(env, plan) {
  const hist = apexHistory(plan);
  const last = hist.diffs[plan.rows].length;
  const s = { marked: [], pointed: false };
  const draw = (c) => drawApex(c.g, c.w, c.h, c, plan, s, env.variant);
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
        const next = order.find((r) => !s.marked.includes(r));
        if (next) {
          s.marked.push(next);
          c.hint();
          const n = hist.diffs[next].length;
          c.status('row ' + next + ' is marked on the second tape: ' + (n === 1 ? 'one cell differs' : WORDS[n] + ' cells differ') + ' there');
        } else {
          c.status('every row between the first and the last is marked; the rest is yours');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.pointed = true;
      for (let r = 1; r <= plan.rows; r++) if (!s.marked.includes(r)) s.marked.push(r);
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

export default {
  id: 'machine-shop',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsApex(env)) apexPreview(g, w, h, env, apexPlan(env));
    else nextPreview(g, w, h, env, nextPlan(env));
  },
  spark(env) {
    if (dealsApex(env)) {
      const plan = apexPlan(env);
      return {
        title: apexTitle(plan),
        text: 'Two tapes, one rite: rule ' + plan.rule + ', one cell apart at the start. Find the column that was flipped and count what it changed by row ' + plan.rows + '.',
        mono: plan.width + ' cells / ' + plan.rows + ' rows shown',
        aspect: '16 / 10',
        paint: (ctx, cw, ch, cardEnv) => apexPreview(ctx, cw, ch, cardEnv, plan),
        of: plan
      };
    }
    const plan = nextPlan(env);
    return {
      title: nextTitle(plan),
      text: plan.depth === 2
        ? 'Three rows of one hidden rule, every pattern of three on show. Read the rule off the bench and run it on twice: recite rows four and five.'
        : 'Four rows of one hidden rule, every pattern of three on show. Read the rule off the bench and recite the fifth row.',
      mono: plan.width + ' cells / rule ?' + (plan.depth === 2 ? ' / two rows hidden' : ''),
      aspect: '4 / 3',
      paint: (ctx, cw, ch, cardEnv) => nextPreview(ctx, cw, ch, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const apex = carriedApex(env);
    if (apex) return apexPiece(env, apex);
    const next = carriedNext(env);
    if (next) return nextPiece(env, next);
    return dealsApex(env) ? apexPiece(env, apexPlan(env)) : nextPiece(env, nextPlan(env));
  }
};
