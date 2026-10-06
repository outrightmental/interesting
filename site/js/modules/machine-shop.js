/* The machine shop: elementary cellular automata on a bench. As a card it is a rule or two
   tapes one cell apart (paint, spark); as a piece it is a tape to choose, a rule to tune and a
   run button, or a controlled comparison whose last row the visitor predicts. Both shapes use
   the same wrapped tape and rule arithmetic. See js/feed.js for what a module is and
   js/stage.js for what a piece is.

   A card and the feature it opens as are one experiment: a spark puts the rule it ran, or the whole
   comparison it set up, on its spec as `of`, and the piece takes the bench from there -- so pressing
   rule 110 in the feed opens rule 110 on the bench, and pressing a comparison opens that comparison
   rather than another. The shape follows the card too: a comparison card never opens the bench. */

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

export default {
  id: 'machine-shop',
  needsSky: false,
  paint(ctx, w, h, env) {
    if (compares(env)) comparisonPreview(ctx, w, h, env, experiment(env));
    else run(ctx, w, h, env, pickRule(env), env.chance(0.3));
  },
  spark(env) {
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
    // The shape is the card's: a comparison card opens its comparison, a rule card opens its rule
    // on the bench, and a piece nobody pressed falls back to what the seed says.
    const was = pressed(env);
    if (was) return was.spec ? comparisonPiece(env, was.spec) : benchPiece(env, was);
    return compares(env) ? comparisonPiece(env) : benchPiece(env);
  }
};
