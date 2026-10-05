/* The machine shop: one elementary cellular automaton on a bench. As a card it is one rule run
   from one seed with its eight bits printed under it (paint, spark); as a piece it is a bench
   with a tape to choose, a rule to tune and a run button. See js/feed.js for what a module is
   and js/stage.js for what a piece is. */

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

function piece(env) {
  const rule = pickRule(env);
  const runs = env.int(2, 3);
  const perRun = env.pick([60, 90, 120]);
  const seedRnd = env.rnd;
  const s = { rule, tape: 'one', cols: 96, history: [], pending: 0, flash: 0, ran: 0 };
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

export default {
  id: 'machine-shop',
  paint(ctx, w, h, env) {
    run(ctx, w, h, env, pickRule(env), env.chance(0.3));
  },
  spark(env) {
    const rule = pickRule(env);
    const noisy = env.chance(0.35);
    return {
      title: 'rule ' + rule,
      mono: bits(rule),
      text: describe(rule) + (noisy ? ' Run here from a noisy seed.' : ' Run here from one live cell.'),
      aspect: '3 / 4',
      paint: (ctx, w, h, e) => run(ctx, w, h, e, rule, noisy)
    };
  },
  piece
};
