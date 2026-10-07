/* The machine shop: elementary cellular automata on a bench. Cards and pieces share a rule,
   a comparison of two tapes one cell apart, or a picture scrambled by a reversible two-sheet
   machine. All three use the same wrapped tape and rule arithmetic. The reversible machine
   keeps two consecutive sheets, not a history; lifting its companion tests what that costs.
   See js/feed.js for the card contract and js/stage.js for the piece contract.

   A spark puts its exact subject on `of`. The piece follows that subject and its family before
   consulting the seed, so a comparison stays a comparison and a mixed picture opens at the
   very same mix. Every piece owns its choices, sheets and progress. */

// The card this piece was opened from, in the shop's own terms: { rule, noisy } for a rule card,
// { spec } for a comparison card, or null for a piece nobody pressed (js/stage.js, env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  if (!was) return null;
  if (was.spec && Array.isArray(was.spec.rules) && was.spec.initial) return was;
  return typeof was.rule === 'number' ? was : null;
}

const LIVELY = [30, 45, 54, 60, 73, 90, 105, 110, 124, 126, 137, 150, 182, 193];

const KNOWN = {
  0: 'Cannot be bothered.',
  30: 'Looks random. Is not. One live cell, and this.',
  45: 'Chaotic, left-leaning, and in no hurry.',
  54: 'Gliders in a lattice, if you wait for them.',
  60: 'Half a Sierpinski triangle, leaning on the wall.',
  73: 'Walls and wells: the live cells fence themselves in.',
  90: 'A Sierpinski triangle, every time, from one live cell.',
  105: 'A twin of 150 with the lights inverted.',
  110: 'Class four: this one can compute anything, given a long enough tape.',
  124: 'Rule 110 in a mirror.',
  126: 'A thicker Sierpinski, like 90 drawn with a marker.',
  150: 'Additive: two triangles interfering.',
  184: 'Traffic. The cells are cars, and they jam.',
  204: 'The identity: whatever you give it, forever.',
  255: 'Everything, at once, forever.'
};

const TAPES = [
  { label: 'one live cell', value: 'one' },
  { label: 'a noisy tape', value: 'noise' },
  { label: 'two cells apart', value: 'pair' }
];

function describe(rule) {
  if (KNOWN[rule]) return KNOWN[rule];
  let set = 0;
  for (let b = 0; b < 8; b++) if (rule & (1 << b)) set++;
  if (set <= 2) return 'A quiet rule: most neighbourhoods go dark.';
  if (set >= 6) return 'A busy rule: most neighbourhoods light up.';
  return 'A middling rule. Nudge it one bit and watch what changes.';
}

// The eight neighbourhoods and the bit each one gives, four to a row so the table fits a card
// two columns wide on a phone.
function bits(rule) {
  const rows = [];
  for (const group of [[7, 6, 5, 4], [3, 2, 1, 0]]) {
    rows.push(group.map((n) => n.toString(2).padStart(3, '0')).join(' '));
    rows.push(group.map((n) => ' ' + ((rule >> n) & 1) + ' ').join(' '));
  }
  return rows.join('\n');
}

function pickRule(env) {
  return env.chance(0.7) ? env.pick(LIVELY) : env.int(1, 254);
}

function firstRow(cols, tape, rnd) {
  const row = new Uint8Array(cols);
  if (tape === 'noise') for (let i = 0; i < cols; i++) row[i] = rnd() < 0.3 ? 1 : 0;
  else if (tape === 'pair') {
    row[Math.floor(cols * 0.35)] = 1;
    row[Math.floor(cols * 0.65)] = 1;
  } else row[cols >> 1] = 1;
  return row;
}

function nextRow(row, rule) {
  const cols = row.length;
  const next = new Uint8Array(cols);
  for (let x = 0; x < cols; x++) {
    const l = row[(x + cols - 1) % cols];
    const r = row[(x + 1) % cols];
    next[x] = (rule >> ((l << 2) | (row[x] << 1) | r)) & 1;
  }
  return next;
}

// The card: the rule run from the top of the picture down. The configuration the card was dealt
// sets how large a cell is and which column the tape starts from, so the same rule runs as a
// different pattern.
function run(ctx, w, h, env, rule, noisy) {
  const c = env.colors;
  const v = env.variant;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const cols = Math.max(16, Math.round(w / (3 * v.scale)));
  const size = w / cols;
  const rows = Math.ceil(h / size);
  const first = firstRow(cols, noisy ? 'noise' : 'one', env.rnd);
  const shift = Math.round(v.turn * cols) % cols;
  let row = new Uint8Array(cols);
  for (let x = 0; x < cols; x++) row[x] = first[(x + shift) % cols];
  ctx.fillStyle = env.alpha(c.accent, 0.9);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (row[x]) ctx.fillRect(x * size, y * size, size + 0.3, size + 0.3);
    }
    row = nextRow(row, rule);
  }
}

// The bench: a tape of rows that scrolls up as the rule runs, drawn from the history kept in `s`.
function bench(g, w, h, c, s) {
  g.fillStyle = c.colors.bg;
  g.fillRect(0, 0, w, h);
  const size = w / s.cols;
  const rows = s.history.length;
  const top = h - rows * size;
  g.fillStyle = c.alpha(c.colors.accent, 0.9);
  for (let y = 0; y < rows; y++) {
    const row = s.history[y];
    for (let x = 0; x < s.cols; x++) {
      if (row[x]) g.fillRect(x * size, top + y * size, size + 0.3, size + 0.3);
    }
  }
  if (s.flash > 0) {
    g.fillStyle = c.alpha(c.colors.accent2, s.flash * 0.25);
    g.fillRect(0, 0, w, h);
  }
}

function benchPiece(env, was) {
  // The rule the card was showing, and the tape it was running: the bench opens on the card's own
  // experiment, and only rolls one of its own for a piece nobody pressed.
  const rule = was && typeof was.rule === 'number' ? was.rule : pickRule(env);
  const runs = env.int(2, 3);
  const perRun = env.pick([60, 90, 120]);
  const seedRnd = env.rnd;
  const s = { rule, tape: was && was.noisy ? 'noise' : 'one', cols: 96, history: [], pending: 0, flash: 0, ran: 0 };
  function reset(c) {
    s.cols = Math.max(32, Math.round((c.w || 400) / 4));
    s.history = [firstRow(s.cols, s.tape, seedRnd)];
    s.pending = Math.min(perRun, Math.ceil((c.h || 300) / ((c.w || 400) / s.cols)) >> 1);
  }
  return {
    title: 'rule ' + rule + ' on the bench',
    brief: describe(rule) + ' Pick a tape, tune the rule, and run it ' + (runs === 2 ? 'twice' : 'three times') + '; the bench is cleared when you are done.',
    aspect: '16 / 10',
    steps: [
      { id: 'tape', ask: 'the starting tape', kind: 'choice', options: TAPES },
      { id: 'rule', ask: 'the rule', kind: 'range', min: 1, max: 254, step: 1, value: rule, low: '1', high: '254' },
      { id: 'run', ask: 'run the tape', kind: 'press', count: runs, label: 'run', after: 'tape' }
    ],
    start(c) {
      reset(c);
      bench(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'tape') {
        s.tape = String(value);
        reset(c);
      }
      if (id === 'rule') {
        s.rule = Math.max(0, Math.min(255, Math.round(Number(value)))) || 0;
        c.status('rule ' + s.rule + ': ' + describe(s.rule));
      }
      if (id === 'run') {
        s.ran += 1;
        s.pending += perRun;
        s.flash = 1;
        c.status(s.ran < runs ? 'running' : 'the tape is through');
      }
    },
    frame(t, dt, c) {
      const size = c.w / s.cols;
      const keep = Math.ceil(c.h / size);
      const step = Math.min(s.pending, Math.max(1, Math.round(dt * 90)));
      for (let i = 0; i < step && s.pending > 0; i++) {
        s.history.push(nextRow(s.history[s.history.length - 1], s.rule));
        s.pending -= 1;
      }
      while (s.history.length > keep) s.history.shift();
      s.flash = Math.max(0, s.flash - dt * 2);
      if (c.done) s.pending = Math.max(s.pending, 1);
      bench(c.g, c.w, c.h, c, s);
    },
    end(c) {
      c.status('rule ' + s.rule + ', ' + bits(s.rule).split('\n')[1].replace(/\s+/g, ' ').trim() + ' ' + bits(s.rule).split('\n')[3].replace(/\s+/g, ' ').trim());
    }
  };
}

const FORECASTS = [
  { label: 'none', value: 'none' },
  { label: '1 to 4', value: 'few' },
  { label: '5 or more', value: 'many' }
];

// Select the same shape for the card and its piece without advancing the bench's random stream.
function compares(env) {
  return (env.seed & 1) === 1;
}

function experiment(env) {
  const rules = [env.pick([0, 184, 204]), env.pick([60, 90, 150]), env.pick([30, 45, 54, 110])];
  for (let i = rules.length - 1; i > 0; i--) {
    const j = env.int(0, i);
    [rules[i], rules[j]] = [rules[j], rules[i]];
  }
  const tape = env.pick(TAPES);
  const cols = env.pick([49, 57, 65]);
  const chunk = env.pick([5, 7, 9]);
  return {
    rules, cols, chunk, rows: chunk * 4, tape: tape.label,
    initial: firstRow(cols, tape.value, env.rnd),
    fault: env.int(0, cols - 1)
  };
}

function experimentTitle(spec) {
  return 'one cell apart, ' + spec.rows + ' rows later';
}

function differenceHistory(spec, rule, fault) {
  const upper = [spec.initial.slice()];
  const lower = [spec.initial.slice()];
  if (fault !== null) lower[0][fault] ^= 1;
  for (let row = 1; row <= spec.rows; row++) {
    upper.push(nextRow(upper[row - 1], rule));
    lower.push(nextRow(lower[row - 1], rule));
  }
  const counts = [];
  let changes = 0;
  let firstSame = null;
  for (let row = 0; row <= spec.rows; row++) {
    let count = 0;
    for (let x = 0; x < spec.cols; x++) count += upper[row][x] ^ lower[row][x];
    counts.push(count);
    changes += count;
    if (fault !== null && row > 0 && count === 0 && firstSame === null) firstSame = row;
  }
  return { upper, lower, counts, changes, firstSame };
}

function comparisonGeometry(w, h, scale) {
  const pad = Math.max(8, Math.min(w, h) * 0.04);
  const width = Math.max(1, Math.min(w - pad * 2, w * 0.86 * scale));
  const gap = Math.max(12, h * 0.05);
  const panel = Math.max(1, (h - pad * 2 - gap) / 2);
  const label = Math.max(20, Math.min(w, h) * 0.07);
  return { left: (w - width) / 2, width, pad, gap, panel, label, grid: Math.max(1, panel - label) };
}

function drawComparison(g, w, h, c, spec, history, rule, fault, shown, scale) {
  const box = comparisonGeometry(w, h, scale);
  const last = Math.max(0, Math.min(spec.rows, Math.floor(shown)));
  const dx = box.width / spec.cols;
  const dy = box.grid / (spec.rows + 1);
  const inset = Math.min(0.7, dx * 0.1, dy * 0.1);
  const k = c.colors;
  g.save();
  g.fillStyle = k.bg;
  g.fillRect(0, 0, w, h);
  g.font = '500 ' + Math.max(11, Math.round(Math.min(w, h) * 0.034)) + 'px system-ui, sans-serif';
  g.textBaseline = 'top';
  for (let panel = 0; panel < 2; panel++) {
    const top = box.pad + panel * (box.panel + box.gap);
    const gridTop = top + box.label;
    const rows = panel ? history.lower : history.upper;
    g.fillStyle = k.fg;
    g.textAlign = 'left';
    const name = panel === 0 ? 'original' : fault === null
      ? (w < 250 ? 'copy' : 'matching copy')
      : (w < 250 ? 'changed' : 'one cell changed');
    g.fillText(name, box.left, top);
    g.textAlign = 'right';
    g.fillText(panel ? history.counts[last] + ' differ' : 'rule ' + rule, box.left + box.width, top);
    g.fillStyle = c.mix(k.bg, k.bg2, 0.25);
    g.fillRect(box.left, gridTop, box.width, box.grid);
    for (let row = 0; row <= last; row++) {
      const y = gridTop + row * dy;
      for (let x = 0; x < spec.cols; x++) {
        const left = box.left + x * dx;
        if (rows[row][x]) {
          g.fillStyle = c.alpha(k.accent, 0.9);
          g.fillRect(left + inset, y + inset, dx - inset, dy - inset);
        }
        if (panel && history.upper[row][x] !== history.lower[row][x]) {
          // A slash marks both gained and missing cells, independently of their colour.
          g.fillStyle = c.alpha(k.accent2, 0.25);
          g.fillRect(left, y, dx, dy);
          g.strokeStyle = k.accent2;
          g.lineWidth = Math.max(0.6, Math.min(1.5, dy * 0.2));
          g.beginPath();
          g.moveTo(left + inset, y + dy - inset);
          g.lineTo(left + dx - inset, y + inset);
          g.stroke();
        }
      }
    }
    g.strokeStyle = c.alpha(k.muted, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(box.left, gridTop + (last + 1) * dy);
    g.lineTo(box.left + box.width, gridTop + (last + 1) * dy);
    g.stroke();
    if (panel && fault !== null) {
      const x = box.left + (fault + 0.5) * dx;
      g.fillStyle = k.accent2;
      g.beginPath();
      g.moveTo(x, gridTop - 1);
      g.lineTo(x - 4, gridTop - 7);
      g.lineTo(x + 4, gridTop - 7);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

function comparisonPreview(g, w, h, env, spec) {
  const v = env.variant;
  const fault = (spec.fault + Math.round(v.turn * (spec.cols - 1))) % spec.cols;
  const history = differenceHistory(spec, spec.rules[0], fault);
  const shown = Math.max(spec.chunk, Math.min(spec.rows, Math.round(spec.rows * v.density)));
  drawComparison(g, w, h, env, spec, history, spec.rules[0], fault, shown, v.scale);
}

function comparisonPiece(env, carried) {
  // The comparison the card set up, cell for cell, or a fresh one for a piece nobody pressed.
  const spec = carried || experiment(env);
  let rule = spec.rules[0];
  let fault = null;
  let prediction = '';
  let bursts = 0;
  let target = spec.chunk;
  let shown = target;
  let history = differenceHistory(spec, rule, fault);

  function paint(c) {
    drawComparison(c.g, c.w, c.h, c, spec, history, rule, fault, shown, 1);
  }

  function readout(row) {
    if (fault === null) return 'At row ' + row + ', the tapes still match; no cell has been changed.';
    const n = history.counts[row];
    return 'At row ' + row + ', ' + n + ' of ' + spec.cols + ' cells differ.'
      + (n === 0 ? ' They became identical at row ' + history.firstSame + '.' : '');
  }

  // Recompute from the unchanged input, retaining the revealed depth. Changing a rule or a cell
  // after growing is the same experiment as changing it before growing; no knob loses its work.
  function rebuild() {
    history = differenceHistory(spec, rule, fault);
  }

  return {
    title: experimentTitle(spec),
    brief: 'Choose a rule for two matching tapes, tap to change one starting cell in the lower tape, make a prediction, and grow both in three bursts. Their edges join.',
    aspect: '4 / 3',
    steps: [
      { id: 'rule', ask: 'the rule both tapes obey', kind: 'choice', options: spec.rules.map((value) => ({ label: 'rule ' + value, value })) },
      { id: 'fault', ask: 'tap anywhere to choose the changed cell', kind: 'tap', label: 'change one cell for me' },
      { id: 'prediction', ask: 'how many cells will differ in row ' + spec.rows + '?', kind: 'choice', options: FORECASTS },
      { id: 'grow', ask: 'grow both tapes to row ' + spec.rows, kind: 'press', count: 3, label: 'grow ' + spec.chunk + ' rows' }
    ],
    start(c) {
      paint(c);
      c.status('Starting tape: ' + spec.tape + '. The first ' + spec.chunk + ' rows match. Slashed squares will mark differences in the lower tape.');
    },
    apply(id, value, c) {
      if (id === 'rule') {
        rule = Number(value);
        rebuild();
        c.status('Both tapes use rule ' + rule + '. ' + describe(rule) + ' ' + readout(Math.floor(shown)));
      }
      if (id === 'prediction') {
        prediction = FORECASTS.find((p) => p.value === value).label;
        c.status('You expect ' + prediction + ' cells to differ in row ' + spec.rows + '.');
      }
      if (id === 'grow') {
        bursts = Math.min(3, Math.max(bursts, Number(value)));
        target = (bursts + 1) * spec.chunk;
        if (c.reduced) shown = target;
        c.status(shown < target ? 'Growing both tapes to row ' + target + '.' : readout(target));
      }
      paint(c);
    },
    tap(x, y, c) {
      if (c.done) return;
      const box = comparisonGeometry(c.w, c.h, 1);
      fault = Math.max(0, Math.min(spec.cols - 1, Math.floor(((x * c.w - box.left) / box.width) * spec.cols)));
      rebuild();
      paint(c);
      c.progress('fault', 1);
      c.status('Starting cell ' + (fault + 1) + ' changed from ' + spec.initial[fault] + ' to ' + (1 - spec.initial[fault]) + '. ' + readout(Math.floor(shown)));
      c.satisfy('fault');
    },
    frame(t, dt, c) {
      if (shown < target) {
        shown = c.reduced ? target : Math.min(target, shown + dt * 20);
        if (shown === target && !c.done) c.status(readout(target));
      }
      paint(c);
    },
    end(c) {
      shown = target = spec.rows;
      paint(c);
      c.status(readout(spec.rows) + ' ' + history.changes + ' differing squares across the full history. You expected ' + prediction + ' cells in the last row.');
    }
  };
}

const INK_MARKS = ['key', 'moth', 'leaf', 'hourglass'];
const INK_RULES = [30, 45, 90, 110, 150];
const INK_SIZES = [21, 25, 29];
const INK_COMPANIONS = [
  { label: 'keep both sheets', value: 'keep' },
  { label: 'lift the companion away', value: 'lift' }
];
const INK_VIEW = { density: 1, scale: 1, turn: 0 };
const INK_BRIEF = 'Run a scrambled picture backwards: choose a rule and depth, keep or lift its companion sheet, then reverse the machine. The companion is the step before the picture.';

function dealsInk(env) {
  return (env.seed >>> 0) % 3 === 2;
}

function markImage(cols, mark, detail) {
  const image = [];
  for (let row = 0; row < cols; row++) {
    for (let column = 0; column < cols; column++) {
      const x = (column - (cols - 1) / 2) / (cols / 2);
      const y = (row - (cols - 1) / 2) / (cols / 2);
      let ink;
      if (mark === 'key') {
        const ring = Math.hypot(x, y + 0.38);
        ink = (ring < 0.34 && ring > 0.16)
          || (Math.abs(x) < 0.09 && y > -0.1 && y < 0.8)
          || (x > 0 && x < 0.28 + detail * 0.045
            && ((y > 0.33 && y < 0.48) || (y > 0.65 && y < 0.8)));
      } else if (mark === 'moth') {
        const upper = ((Math.abs(x) - 0.36) / 0.43) ** 2 + ((y + 0.22) / 0.37) ** 2 < 1;
        const lower = ((Math.abs(x) - 0.26) / 0.31) ** 2 + ((y - 0.3) / 0.33) ** 2 < 1;
        const eye = Math.hypot(Math.abs(x) - 0.4, y + 0.24) < 0.065 + detail * 0.02;
        ink = ((upper || lower) && !eye) || (Math.abs(x) < 0.07 && Math.abs(y) < 0.7);
      } else if (mark === 'leaf') {
        const blade = ((x + y * 0.28) / (0.4 + detail * 0.025)) ** 2 + (y / 0.8) ** 2 < 1;
        const vein = Math.abs(x + y * 0.28) < 0.035 && y > -0.5 && y < 0.53;
        ink = blade && !vein;
      } else {
        const edge = 0.08 + Math.abs(y) * (0.64 + detail * 0.025);
        ink = Math.abs(y) < 0.77 && (Math.abs(x) < edge
          || (Math.abs(y) > 0.65 && Math.abs(x) < 0.66));
      }
      image.push(ink ? 1 : 0);
    }
  }
  return image;
}

function inkPlan(env) {
  const mark = env.pick(INK_MARKS);
  const cols = env.pick(INK_SIZES);
  const pool = INK_RULES.slice();
  const rules = [];
  while (rules.length < 3) rules.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return {
    family: 'rewind', mark, cols, rules,
    number: env.int(100, 999),
    turns: env.pick([12, 16, 20, 24, 28, 32]),
    ink: markImage(cols, mark, env.int(0, 2))
  };
}

function carriedInk(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'rewind' || !INK_MARKS.includes(p.mark)
      || !Number.isInteger(p.number) || p.number < 100 || p.number > 999
      || !INK_SIZES.includes(p.cols)
      || !Number.isInteger(p.turns) || p.turns < 8 || p.turns > 40 || p.turns % 4 !== 0
      || !Array.isArray(p.rules) || p.rules.length !== 3
      || new Set(p.rules).size !== 3 || !p.rules.every((rule) => INK_RULES.includes(rule))
      || !Array.isArray(p.ink) || p.ink.length !== p.cols * p.cols
      || !p.ink.every((bit) => bit === 0 || bit === 1)) return null;
  return p;
}

function inkTitle(p) {
  return p.mark + ' ' + p.number + ', mixed ' + p.turns + ' turns';
}

// Read the square as one wrapped tape. Forward: (A, B) -> (F(A) XOR B, A).
// Backward: (A, B) -> (B, F(B) XOR A). Applying XOR twice cancels it exactly.
function inkStep(pair, rule, backwards) {
  const anchor = backwards ? pair.before : pair.now;
  const other = backwards ? pair.now : pair.before;
  const changed = nextRow(anchor, rule);
  for (let i = 0; i < changed.length; i++) changed[i] ^= other[i];
  return backwards ? { now: anchor, before: changed } : { now: changed, before: anchor };
}

function mixedInk(p, rule, turns) {
  let pair = { now: Uint8Array.from(p.ink), before: new Uint8Array(p.ink.length) };
  for (let i = 0; i < turns; i++) pair = inkStep(pair, rule, false);
  return pair;
}

function inkDifference(p, pair) {
  let count = 0;
  for (let i = 0; i < p.ink.length; i++) count += p.ink[i] ^ pair.now[i];
  return count;
}

function inkSheet(g, c, p, bits, x, y, side, color, original, variant) {
  const cell = side / p.cols;
  const inset = cell * Math.min(0.18, 0.07 / variant.density);
  g.save();
  g.translate(x, y);
  g.rotate(Math.floor(variant.turn * 4) * Math.PI / 2);
  g.fillStyle = c.colors.bg;
  g.fillRect(-side / 2, -side / 2, side, side);
  for (let i = 0; i < bits.length; i++) {
    const left = -side / 2 + (i % p.cols) * cell;
    const top = -side / 2 + Math.floor(i / p.cols) * cell;
    if (bits[i]) {
      g.fillStyle = color;
      g.fillRect(left + inset, top + inset, cell - inset * 2, cell - inset * 2);
    }
    if (original && bits[i] !== original[i]) {
      g.fillStyle = c.alpha(c.colors.accent2, 0.25);
      g.fillRect(left, top, cell, cell);
      g.strokeStyle = c.colors.accent2;
      g.lineWidth = Math.max(0.6, Math.min(1.5, cell * 0.2));
      g.beginPath();
      g.moveTo(left + cell * 0.2, top + cell * 0.8);
      g.lineTo(left + cell * 0.8, top + cell * 0.2);
      g.stroke();
    }
  }
  g.strokeStyle = c.alpha(c.colors.fg, 0.6);
  g.lineWidth = 1;
  g.strokeRect(-side / 2, -side / 2, side, side);
  g.restore();
}

function inkScene(g, w, h, c, p, s, variant) {
  const v = variant || INK_VIEW;
  const col = c.colors;
  const side = Math.min(w * 0.41, h * 0.57) * Math.min(1.05, v.scale);
  const y = h * 0.46;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.04)));
  g.save();
  const background = g.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, col.bg2);
  background.addColorStop(1, col.bg);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  inkSheet(g, c, p, s.pair.now, w * 0.255, y, side, col.accent,
    s.watched ? p.ink : null, v);
  inkSheet(g, c, p, s.watched ? p.ink : s.pair.before, w * 0.745, y, side,
    s.watched ? col.accent : col.accent2, null, v);

  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = col.fg;
  g.fillText(s.watched ? 'rewound ink' : 'ink', w * 0.255, h * 0.105, w * 0.43);
  g.fillText(s.watched ? 'starting mark' : 'companion', w * 0.745, h * 0.105, w * 0.43);
  g.fillStyle = col.accent2;
  const remaining = s.turns - s.back;
  const count = s.watched ? inkDifference(p, s.pair) : 0;
  const line = s.watched ? (count ? count + ' squares differ' : 'every square returned')
    : s.running ? 'rewinding: ' + remaining + ' turns left'
      : 'rule ' + s.rule + ', mixed ' + s.turns + ' turns';
  g.fillText(line, w / 2, h * 0.83, w * 0.9);
  g.fillStyle = col.fg;
  g.fillText(s.watched ? (count ? 'slashes mark the differences' : 'the same ' + p.mark + ', square for square')
    : s.companion === 'lift' ? 'the companion has been lifted away' : 'two sheets, no trail of earlier pictures',
  w / 2, h * 0.935, w * 0.9);
  g.restore();
}

function inkPreview(g, w, h, env, p) {
  inkScene(g, w, h, env, p, {
    rule: p.rules[0], turns: p.turns, companion: 'keep', back: 0,
    running: false, watched: false, pair: mixedInk(p, p.rules[0], p.turns)
  }, env.variant || INK_VIEW);
}

function inkPiece(env, carried) {
  const p = carried || inkPlan(env);
  const s = {
    rule: p.rules[0], turns: p.turns, companion: 'keep', pair: null,
    back: 0, elapsed: 0, running: false, watched: false, halfway: false
  };
  const duration = () => 2.6 + s.turns * 0.075;
  const draw = (c) => inkScene(c.g, c.w, c.h, c, p, s, env.variant || INK_VIEW);
  function rewindTo(target) {
    while (s.back < target) {
      s.pair = inkStep(s.pair, s.rule, true);
      s.back += 1;
    }
  }
  function rebuild(c) {
    s.pair = mixedInk(p, s.rule, s.turns);
    if (s.companion === 'lift') s.pair.before = new Uint8Array(p.ink.length);
    s.back = 0;
    s.elapsed = 0;
    s.halfway = false;
    // A finished wait stays finished: late choices recompute the full result, not a new gate.
    if (s.watched) {
      rewindTo(s.turns);
      s.elapsed = duration();
    } else if (c && s.running) c.progress('rewind', 0);
  }
  function result() {
    const count = inkDifference(p, s.pair);
    return count === 0 ? 'Every square of the ' + p.mark + ' returned.'
      : count + ' of ' + p.ink.length + ' squares differ from the starting ' + p.mark + '.';
  }
  function setting(c, line) {
    rebuild(c);
    c.status(line + ' ' + (s.watched ? result()
      : s.running ? 'The rewind starts from this new mix.' : 'Run backwards to see what comes home.'));
    draw(c);
  }
  rebuild();
  return {
    title: inkTitle(p),
    brief: INK_BRIEF,
    aspect: '4 / 3',
    steps: [
      { id: 'rule', ask: 'the rule used to mix and unmix', kind: 'choice', options: p.rules.map((value) => ({ label: 'rule ' + value, value })) },
      { id: 'depth', ask: 'how many turns to mix', kind: 'range', min: 8, max: 40, step: 4, value: p.turns, low: '8 turns', high: '40 turns' },
      { id: 'companion', ask: 'what the machine gets to remember', kind: 'choice', options: INK_COMPANIONS },
      { id: 'reverse', ask: 'reverse the machine', kind: 'press', count: 1, label: 'run backwards' },
      { id: 'rewind', ask: 'watch the machine rewind', kind: 'wait', after: 'reverse' }
    ],
    start(c) {
      c.status('A ' + p.mark + ' was mixed ' + s.turns + ' turns with rule ' + s.rule
        + '. The left sheet is its scrambled ink; the right is the step before it. Keep both or lift the companion, then run backwards.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'rule') {
        const rule = Number(value);
        if (!p.rules.includes(rule)) {
          c.status('Choose one of the three rules for this mix.');
          return;
        }
        s.rule = rule;
        setting(c, 'The same ' + p.mark + ' is now mixed with rule ' + rule + '.');
      }
      if (id === 'depth') {
        const turns = Number(value);
        if (!Number.isFinite(turns)) {
          c.status('Set the mixing depth between 8 and 40 turns.');
          return;
        }
        s.turns = Math.max(8, Math.min(40, Math.round(turns / 4) * 4));
        setting(c, 'Mixed ' + s.turns + ' turns, starting from the same ' + p.mark + '.');
      }
      if (id === 'companion') {
        if (!INK_COMPANIONS.some((option) => option.value === value)) {
          c.status('Keep both sheets or lift the companion away.');
          return;
        }
        s.companion = value;
        setting(c, value === 'keep'
          ? 'Both sheets are in place. The companion holds the previous step.'
          : 'The companion is lifted away. A blank sheet takes its place.');
      }
      if (id === 'reverse') {
        if (s.running || s.watched) {
          c.status(s.watched ? result() : 'The machine is already running backwards.');
          return;
        }
        s.running = true;
        c.status(c.reduced ? 'The rewind will appear without movement.'
          : 'Running backwards. Each pair of sheets makes the pair before it; no earlier picture is fetched.');
        draw(c);
      }
    },
    frame(t, dt, c) {
      if (s.running && !s.watched) {
        const seconds = duration();
        s.elapsed = c.reduced ? seconds : Math.min(seconds, s.elapsed + Math.max(0, dt));
        const fraction = s.elapsed / seconds;
        rewindTo(fraction >= 1 ? s.turns : Math.floor(s.turns * fraction));
        c.progress('rewind', fraction);
        if (!s.halfway && fraction >= 0.5 && fraction < 1) {
          s.halfway = true;
          c.status('Halfway back. There are still only two sheets in the machine.');
        }
        if (fraction >= 1) {
          s.watched = true;
          s.running = false;
          c.status(result() + ' The right sheet now shows the starting mark for comparison. Any choices still waiting can change the result.');
          c.satisfy('rewind');
        }
      }
      draw(c);
    },
    end(c) {
      rewindTo(s.turns);
      s.running = false;
      s.watched = true;
      const count = inkDifference(p, s.pair);
      const explanation = s.companion === 'keep'
        ? 'Both sheets were enough: each backward step used only the two latest sheets, not a saved trail.'
        : count ? 'Lifting the companion lost information. The same rule ran backwards, but it could not recover the same picture.'
          : 'This mix still recovered the visible picture with a blank companion. That coincidence need not survive another rule or depth.';
      c.status(result() + ' ' + explanation + ' The right sheet shows the original for comparison.');
      draw(c);
    }
  };
}

export default {
  id: 'machine-shop',
  needsSky: false,
  paint(ctx, w, h, env) {
    if (dealsInk(env)) inkPreview(ctx, w, h, env, inkPlan(env));
    else if (compares(env)) comparisonPreview(ctx, w, h, env, experiment(env));
    else run(ctx, w, h, env, pickRule(env), env.chance(0.3));
  },
  spark(env) {
    if (dealsInk(env)) {
      const p = inkPlan(env);
      return {
        title: inkTitle(p),
        text: INK_BRIEF,
        mono: 'rule ' + p.rules[0] + '\n' + p.cols + ' by ' + p.cols + ' squares\ntwo sheets, ready to rewind',
        aspect: '4 / 3',
        paint: (ctx, w, h, e) => inkPreview(ctx, w, h, e, p),
        of: p
      };
    }
    if (compares(env)) {
      const spec = experiment(env);
      return {
        title: experimentTitle(spec),
        text: 'One starting cell changes in the lower copy. Will the tapes meet again, carry one scar, or grow into different patterns?',
        aspect: '4 / 3',
        paint: (ctx, w, h, e) => comparisonPreview(ctx, w, h, e, spec),
        // What this card is of, for the piece it opens as: the whole experiment, cell for cell.
        of: { spec }
      };
    }
    const rule = pickRule(env);
    const noisy = env.chance(0.35);
    return {
      title: 'rule ' + rule,
      mono: bits(rule),
      text: describe(rule) + (noisy ? ' Run here from a noisy seed.' : ' Run here from one live cell.'),
      aspect: '3 / 4',
      paint: (ctx, w, h, e) => run(ctx, w, h, e, rule, noisy),
      // What this card is of: the rule, and the tape it was running from.
      of: { rule, noisy }
    };
  },
  piece(env) {
    const ink = carriedInk(env);
    if (ink) return inkPiece(env, ink);
    const was = pressed(env);
    if (was) return was.spec ? comparisonPiece(env, was.spec) : benchPiece(env, was);
    if (dealsInk(env)) return inkPiece(env);
    return compares(env) ? comparisonPiece(env) : benchPiece(env);
  }
};
