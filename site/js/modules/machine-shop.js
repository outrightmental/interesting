/* The machine shop, as a card: one elementary cellular automaton, run from one seed, with its
   eight bits printed under it. See js/feed.js for what a module is. */

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

function describe(rule) {
  if (KNOWN[rule]) return KNOWN[rule];
  let set = 0;
  for (let b = 0; b < 8; b++) if (rule & (1 << b)) set++;
  if (set <= 2) return 'A quiet rule: most neighbourhoods go dark.';
  if (set >= 6) return 'A busy rule: most neighbourhoods light up.';
  return 'A middling rule. Drag the slider on its page and watch which bit you just flipped.';
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

function run(ctx, w, h, env, rule, noisy) {
  const c = env.colors;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const cols = Math.max(24, Math.round(w / 3));
  const size = w / cols;
  const rows = Math.ceil(h / size);
  let row = new Uint8Array(cols);
  if (noisy) for (let i = 0; i < cols; i++) row[i] = env.rnd() < 0.3 ? 1 : 0;
  else row[cols >> 1] = 1;
  ctx.fillStyle = env.alpha(c.accent, 0.9);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (row[x]) ctx.fillRect(x * size, y * size, size + 0.3, size + 0.3);
    }
    const next = new Uint8Array(cols);
    for (let x = 0; x < cols; x++) {
      const l = row[(x + cols - 1) % cols];
      const r = row[(x + 1) % cols];
      next[x] = (rule >> ((l << 2) | (row[x] << 1) | r)) & 1;
    }
    row = next;
  }
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
  }
};
