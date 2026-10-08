/* The lantern ritual: lanterns hung under the persona's stars, and two puzzles set among them. As
   a card it is the puzzle the seed deals, drawn small (paint, spark); as a piece it is one of the
   two puzzles below, and the card it was opened from says which. See js/feed.js for what a module
   is and js/stage.js for what a piece is.

   Two puzzles, both deduction:

     the lighting order  Four or five lettered lanterns rise one after another, and a few clues
                         under the sky say how: before, right after, first, last, so many between,
                         not last. The clues are drawn from the true order and pruned until exactly
                         one order fits them all, never more than five. A wrong check says how many
                         stand in the right place and no more; a hint, at a price, names one
                         lantern's place.
     where it drifts     One lantern let go at the dotted column rises through four bands of wind,
                         each pushing it some columns left or right, drawn as arrows over a column
                         grid. Say how far it has drifted when it leaves the top, and which band
                         pushes hardest. A wrong check says only which way to look.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the order and its clues, or the four bands -- and piece(env) opens on that rather than
   rolling another. The sky may be one star or many; it only lights the picture, and the plan
   stands whatever the sky is now. */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
const COLS = 12; // columns either side of the release column, in the drift puzzle
const BANDS = 4;

const signed = (n) => (n > 0 ? '+' : '') + n;
const capital = (text) => text[0].toUpperCase() + text.slice(1);

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

/* ---- drawing shared by both ---------------------------------------------------------------- */

function sky(g, w, h, env) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg);
  grad.addColorStop(1, c.bg2);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// The stars as they stand, as faint sparks in the upper sky, and a scatter more from the
// configuration, so a sky of one star is still a sky.
function sparks(g, w, h, env, v, depth) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.fg, 0.55);
  for (const p of env.points(w, h, 10)) {
    g.beginPath();
    g.arc(p.x, 6 + p.y * depth, 1.3 * v.scale, 0, TAU);
    g.fill();
  }
  const n = Math.max(4, Math.round(16 * v.density));
  g.fillStyle = env.alpha(c.fg, 0.25);
  for (let i = 0; i < n; i++) {
    const x = ((i * 0.6180339 + v.turn * 0.37) % 1) * w;
    const y = ((i * 0.7548777 + v.turn * 0.13) % 1) * h * depth;
    g.fillRect(x, y, 1, 1);
  }
}

// One lantern, `k` times the size it hangs at on the page, with a letter on it if it has one.
function lantern(g, env, x, y, glow, k, letter) {
  const c = env.colors;
  const lw = 12 * k;
  const lh = 16 * k;
  if (glow > 0) {
    const reach = 30 * glow * k;
    const halo = g.createRadialGradient(x, y, 0, x, y, reach);
    halo.addColorStop(0, env.alpha(c.accent2, Math.min(0.8, 0.25 + glow * 0.3)));
    halo.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  }
  g.strokeStyle = env.alpha(c.muted, 0.35);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y - lh / 2 - 12 * k);
  g.lineTo(x, y - lh / 2);
  g.stroke();
  g.fillStyle = c.accent2;
  g.beginPath();
  g.roundRect(x - lw / 2, y - lh / 2, lw, lh, 3 * k);
  g.fill();
  g.fillStyle = env.alpha(c.fg, 0.9);
  g.fillRect(x - lw / 2 - 1, y - lh / 2 - 2, lw + 2, 2);
  g.fillRect(x - lw / 2 - 1, y + lh / 2, lw + 2, 2);
  if (letter) {
    g.fillStyle = env.alpha(c.bg, 0.9);
    g.font = '700 ' + Math.max(8, Math.round(9 * k)) + 'px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, x, y + 0.5);
  }
}

function write(g, text, x, y, size, align, tone, weight) {
  g.fillStyle = tone;
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function shuffled(env, n) {
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(i);
  const out = [];
  while (rest.length) out.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  return out;
}

/* ---- the lighting order -------------------------------------------------------------------- */

// `order` is the lanterns in the order they rise; a clue says something true about that order.
function holds(clue, order) {
  const at = (i) => order.indexOf(i);
  const n = order.length;
  switch (clue.t) {
    case 'before': return at(clue.a) < at(clue.b);
    case 'after': return at(clue.a) === at(clue.b) + 1;
    case 'first': return at(clue.a) === 0;
    case 'last': return at(clue.a) === n - 1;
    case 'between': return Math.abs(at(clue.a) - at(clue.b)) === clue.d + 1;
    case 'notLast': return at(clue.a) !== n - 1;
    case 'notFirst': return at(clue.a) !== 0;
    case 'slot': return at(clue.a) === clue.k;
    default: return false;
  }
}

function clueText(clue) {
  const a = LETTERS[clue.a];
  const b = LETTERS[clue.b];
  switch (clue.t) {
    case 'before': return a + ' rises before ' + b;
    case 'after': return a + ' rises right after ' + b;
    case 'first': return a + ' rises first';
    case 'last': return a + ' rises last';
    case 'between': return clue.d === 1 ? 'one lantern rises between ' + a + ' and ' + b : WORDS[clue.d] + ' lanterns rise between ' + a + ' and ' + b;
    case 'notLast': return a + ' does not rise last';
    case 'notFirst': return a + ' does not rise first';
    case 'slot': return a + ' rises ' + ORDINAL[clue.k];
    default: return '';
  }
}

function permutations(n) {
  const out = [];
  const used = new Array(n).fill(false);
  const cur = [];
  (function walk() {
    if (cur.length === n) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      walk();
      cur.pop();
      used[i] = false;
    }
  })();
  return out;
}

function fits(clues, perms) {
  return perms.filter((p) => clues.every((clue) => holds(clue, p)));
}

// Every true clue about `order`, which the plan draws from.
function trueClues(order) {
  const n = order.length;
  const out = [];
  for (let a = 0; a < n; a++) {
    const pa = order.indexOf(a);
    out.push(pa === 0 ? { t: 'first', a } : { t: 'notFirst', a });
    out.push(pa === n - 1 ? { t: 'last', a } : { t: 'notLast', a });
    out.push({ t: 'slot', a, k: pa });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const pb = order.indexOf(b);
      if (pa < pb) out.push({ t: 'before', a, b });
      if (pa === pb + 1) out.push({ t: 'after', a, b });
      if (pa - pb >= 2 && a < b) out.push({ t: 'between', a, b, d: pa - pb - 1 });
      if (pb - pa >= 2 && a < b) out.push({ t: 'between', a, b, d: pb - pa - 1 });
    }
  }
  return out;
}

// The weight a clue carries in the draw: the vaguer kinds first, so the puzzle leans on reasoning
// rather than on being told where a lantern goes.
function clueWeight(clue) {
  return clue.t === 'slot' ? 1 : clue.t === 'first' || clue.t === 'last' ? 2 : clue.t === 'notFirst' || clue.t === 'notLast' || clue.t === 'after' ? 3 : 4;
}

function orderPlan(env) {
  const n = env.chance(0.45) ? 5 : 4;
  const perms = permutations(n);
  let order = null;
  let clues = null;
  for (let attempt = 0; attempt < 10 && !clues; attempt++) {
    const draw = shuffled(env, n);
    const candidates = trueClues(draw);
    let chosen = [];
    for (let guard = 0; guard < 40 && candidates.length && fits(chosen, perms).length !== 1; guard++) {
      const total = candidates.reduce((sum, clue) => sum + clueWeight(clue), 0);
      let roll = env.rnd() * total;
      let at = 0;
      for (let i = 0; i < candidates.length; i++) {
        roll -= clueWeight(candidates[i]);
        if (roll <= 0) {
          at = i;
          break;
        }
      }
      const clue = candidates.splice(at, 1)[0];
      if (fits(chosen.concat([clue]), perms).length < fits(chosen, perms).length) chosen.push(clue);
    }
    // Prune: a clue that can go without letting a second order in goes.
    for (let i = chosen.length - 1; i >= 0; i--) {
      const without = chosen.slice(0, i).concat(chosen.slice(i + 1));
      if (fits(without, perms).length === 1) chosen = without;
    }
    if (chosen.length <= 5 && fits(chosen, perms).length === 1) {
      order = draw;
      clues = chosen;
    }
  }
  if (!clues) {
    // Plainer clues, when the draw kept coming out long: most places named, the last two ordered.
    order = shuffled(env, n);
    clues = [];
    for (let k = 0; k < n - 2; k++) clues.push({ t: 'slot', a: order[k], k });
    clues.push({ t: 'before', a: order[n - 2], b: order[n - 1] });
  }
  // An opening order that is not the answer, so the sky asks something.
  let start = order.slice();
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, n);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return { kind: 'order', n, order, clues, start };
}

function carriedOrder(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'order') return null;
  const n = Number(p.n);
  if (n !== 4 && n !== 5) return null;
  const okIndex = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const isPerm = (list) => Array.isArray(list) && list.length === n && list.every(okIndex) && new Set(list).size === n;
  if (!isPerm(p.order) || !isPerm(p.start) || p.start.every((v, i) => v === p.order[i])) return null;
  if (!Array.isArray(p.clues) || !p.clues.length || p.clues.length > 5) return null;
  const okClue = (c) => c && typeof c === 'object' && ['before', 'after', 'first', 'last', 'between', 'notLast', 'notFirst', 'slot'].includes(c.t)
    && okIndex(c.a)
    && (!['before', 'after', 'between'].includes(c.t) || (okIndex(c.b) && c.b !== c.a))
    && (c.t !== 'between' || (Number.isInteger(c.d) && c.d >= 1 && c.d <= n - 2))
    && (c.t !== 'slot' || okIndex(c.k));
  if (!p.clues.every(okClue)) return null;
  const clues = p.clues.map((c) => ({ t: c.t, a: c.a, b: c.b, d: c.d, k: c.k }));
  const only = fits(clues, permutations(n));
  if (only.length !== 1 || !only[0].every((v, i) => v === p.order[i])) return null;
  return { kind: 'order', n, order: p.order.slice(), clues, start: p.start.slice() };
}

function orderTitle(plan) {
  return 'the lighting order: ' + WORDS[plan.n] + ' lanterns';
}

// Where the lanterns hang: one column each, left to right by letter, and a height for every rank.
function orderGeometry(w, h, n) {
  const span = w * 0.8;
  const top = h * 0.12;
  const bottom = h * 0.46;
  return { left: (w - span) / 2, span, cell: span / n, top, bottom, y: (rank) => top + ((bottom - top) * rank) / (n - 1) };
}

function drawOrder(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const n = plan.n;
  const geo = orderGeometry(w, h, n);
  const k = Math.max(0.75, Math.min(2, Math.min(w, h) / 320)) * v.scale;
  const small = Math.max(9, Math.min(13, Math.round(Math.min(w, h) * 0.036)));
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.5);
  write(g, 'first to rise at the top', w / 2, h * 0.05, small, 'center', env.alpha(c.muted, 0.85));
  // A faint rail for each rank, so a height can be read as a place.
  g.strokeStyle = env.alpha(c.muted, 0.1 + 0.08 * v.density);
  g.lineWidth = 1;
  g.setLineDash([2, 5]);
  g.beginPath();
  for (let rank = 0; rank < n; rank++) {
    g.moveTo(geo.left, geo.y(rank));
    g.lineTo(geo.left + geo.span, geo.y(rank));
  }
  g.stroke();
  g.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const rank = s.order.indexOf(i);
    const x = geo.left + (i + 0.5) * geo.cell;
    const bob = Math.sin(s.t * 0.9 + i * 1.1 + v.turn * TAU) * 2.5 * k;
    const y = geo.y(rank) + bob - (s.lift[i] || 0);
    if (s.hinted.includes(i)) {
      const hy = geo.y(plan.order.indexOf(i));
      g.strokeStyle = env.alpha(c.accent, 0.9);
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.strokeRect(x - 11 * k, hy - 12 * k, 22 * k, 24 * k);
      g.setLineDash([]);
    }
    lantern(g, env, x, y, 0.5 + (s.glow[i] || 0), k, LETTERS[i]);
    write(g, ORDINAL[rank], x, geo.bottom + 24 * k, small, 'center', env.alpha(c.fg, 0.8));
  }
  // The clues, under the sky.
  const size = Math.max(9, Math.min(15, Math.round(Math.min(w, h) * 0.04)));
  const x0 = w * 0.08;
  g.fillStyle = env.alpha(c.muted, 0.2);
  g.fillRect(x0, h * 0.585, w * 0.84, 1);
  let y = h * 0.64;
  plan.clues.forEach((clue, i) => {
    write(g, String(i + 1) + '.', x0, y, size, 'left', env.alpha(c.accent2, 0.9));
    write(g, clueText(clue), x0 + size * 1.6, y, size, 'left', env.alpha(c.fg, 0.9));
    y += size * 1.5;
  });
}

function orderPreview(g, w, h, env, plan, t) {
  const n = plan.n;
  drawOrder(g, w, h, env, plan, { order: plan.start.slice(), hinted: [], lift: new Array(n).fill(0), glow: new Array(n).fill(0), t: t || 0 }, env.variant);
}

function orderPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.n;
  const s = { order: plan.start.slice(), hinted: [], lift: new Array(n).fill(0), glow: new Array(n).fill(0), t: 0, gone: 0 };
  const draw = (c) => drawOrder(c.g, c.w, c.h, c, plan, s, env.variant);
  const named = (list) => list.map((i) => LETTERS[i]).join(', ');
  function current(c) {
    const v = c.value('order');
    return Array.isArray(v) && v.length === n ? v.map(Number) : s.order;
  }
  return {
    title: orderTitle(plan),
    brief: 'The rite of the rising. ' + capital(WORDS[n]) + ' lettered lanterns rise one after another, and the ' + WORDS[plan.clues.length]
      + ' clues under the sky say how. Exactly one order fits them all. Set the order on the rail, or tap a lantern to move it up one place.',
    goal: 'Put the lanterns in the one order the clues allow, first to rise at the top.',
    aspect: '1 / 1',
    checkLabel: 'check the order',
    steps: [
      { id: 'order', ask: 'the lanterns, first to rise at the top', kind: 'order', items: LETTERS.slice(0, n).map((letter, i) => ({ label: 'lantern ' + letter, value: i })), value: plan.start.slice() },
      { id: 'hint', ask: 'where one lantern rises', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: plan.order.slice() },
    check(c) {
      const cur = current(c);
      let right = 0;
      for (let i = 0; i < n; i++) if (cur[i] === plan.order[i]) right += 1;
      return {
        solved: right === n,
        say: right === n ? 'the order holds: ' + named(plan.order)
          : right === 0 ? 'none of them hangs in the right place yet' : WORDS[right] + ' of ' + WORDS[n] + ' lanterns in the right place'
      };
    },
    start(c) {
      c.status(WORDS[plan.clues.length] + ' clues under the sky; tap a lantern to move it up');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === n) {
        s.order = value.map(Number);
        c.status('first to last: ' + named(s.order));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.order.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== plan.order.indexOf(i))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('lantern ' + LETTERS[next] + ' rises ' + ORDINAL[plan.order.indexOf(next)]);
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will show at this difficulty; the rest is yours');
        } else {
          c.status('every lantern out of place has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = orderGeometry(c.w, c.h, n);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= n || y * c.h > c.h * 0.58) return;
      const rank = s.order.indexOf(col);
      const next = s.order.slice();
      if (rank === 0) {
        next.splice(0, 1);
        next.push(col);
      } else {
        next[rank] = next[rank - 1];
        next[rank - 1] = col;
      }
      s.order = next;
      c.set('order', next.slice());
      c.status('lantern ' + LETTERS[col] + ' now rises ' + ORDINAL[next.indexOf(col)]);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.gone += dt;
        for (let i = 0; i < n; i++) {
          const up = Math.max(0, s.gone - plan.order.indexOf(i) * 0.9);
          s.lift[i] = up * 22 * Math.max(1, c.h / 320);
          s.glow[i] = Math.min(0.9, up);
        }
      }
      draw(c);
    },
    end(c) {
      c.status(named(plan.order) + ': up and away, in that order');
    }
  };
}

/* ---- where it drifts ----------------------------------------------------------------------- */

function driftTotal(bands) {
  return bands.reduce((a, b) => a + b, 0);
}

// The band that pushes hardest, counted from one; the plan keeps it unique.
function strongest(bands) {
  let best = 0;
  for (let i = 1; i < bands.length; i++) if (Math.abs(bands[i]) > Math.abs(bands[best])) best = i;
  return best + 1;
}

// Where the lantern is after each band: the release column, then one running sum per band.
function positions(bands) {
  const out = [0];
  for (const b of bands) out.push(out[out.length - 1] + b);
  return out;
}

function driftOk(bands) {
  if (!Array.isArray(bands) || bands.length !== BANDS) return false;
  if (!bands.every((d) => Number.isInteger(d) && d >= -4 && d <= 4)) return false;
  const abs = bands.map(Math.abs);
  const top = Math.max.apply(null, abs);
  if (top < 2 || abs.filter((a) => a === top).length !== 1 || abs.filter((a) => a === 0).length > 1) return false;
  const sum = driftTotal(bands);
  return sum !== 0 && sum >= -COLS && sum <= COLS;
}

function driftPlan(env) {
  for (let guard = 0; guard < 200; guard++) {
    const bands = [];
    for (let i = 0; i < BANDS; i++) bands.push(env.int(-4, 4));
    if (driftOk(bands)) return { kind: 'drift', bands };
  }
  return { kind: 'drift', bands: [2, -1, 4, -2] };
}

function carriedDrift(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'drift' || !driftOk(p.bands)) return null;
  return { kind: 'drift', bands: p.bands.slice() };
}

function driftTitle() {
  return 'where it drifts: ' + WORDS[BANDS] + ' bands of wind';
}

function driftGeometry(w, h) {
  const span = w * 0.84;
  const left = (w - span) / 2;
  const cell = span / (COLS * 2 + 1);
  const top = h * 0.12;
  const bottom = h * 0.74;
  return { left, span, cell, top, bottom, band: (bottom - top) / BANDS, x: (col) => left + (col + COLS + 0.5) * cell };
}

function arrow(g, x0, x1, y, head) {
  const dir = x1 > x0 ? 1 : -1;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y);
  g.lineTo(x1 - dir * head, y - head * 0.6);
  g.lineTo(x1 - dir * head, y + head * 0.6);
  g.closePath();
  g.fill();
}

function drawDrift(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = driftGeometry(w, h);
  const k = Math.max(0.6, Math.min(1.6, Math.min(w, h) / 320)) * v.scale;
  const small = Math.max(8, Math.min(13, Math.round(Math.min(w, h) * 0.034)));
  sky(g, w, h, env);
  sparks(g, w, h, env, v, 0.11);
  // The column grid, and the release column dotted up through every band.
  g.strokeStyle = env.alpha(c.muted, 0.1 + 0.06 * v.density);
  g.lineWidth = 1;
  g.beginPath();
  for (let col = 0; col <= COLS * 2 + 1; col++) {
    const x = geo.left + col * geo.cell;
    g.moveTo(x, geo.top);
    g.lineTo(x, geo.bottom + geo.band * 0.85);
  }
  g.stroke();
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.setLineDash([3, 4]);
  g.beginPath();
  g.moveTo(geo.x(0), geo.top - 4);
  g.lineTo(geo.x(0), geo.bottom + geo.band * 0.85);
  g.stroke();
  g.setLineDash([]);
  for (let col = -COLS; col <= COLS; col += 4) {
    write(g, signed(col), geo.x(col), h * 0.955, small, 'center', env.alpha(col === 0 ? c.accent2 : c.muted, 0.85));
  }
  // The bands, bottom to top: a strip, its number, and its push drawn from the dotted column.
  const pos = positions(plan.bands);
  for (let b = 0; b < BANDS; b++) {
    const y0 = geo.bottom - (b + 1) * geo.band;
    const d = plan.bands[b];
    const chosen = s.band === b + 1;
    g.fillStyle = env.alpha(b % 2 ? c.accent : c.accent2, 0.05 + (chosen ? 0.08 : 0));
    g.fillRect(geo.left, y0, geo.span, geo.band);
    g.strokeStyle = env.alpha(chosen ? c.accent2 : c.muted, chosen ? 0.7 : 0.3);
    g.strokeRect(geo.left, y0, geo.span, geo.band);
    write(g, 'band ' + (b + 1), geo.left + 4, y0 + small * 0.9, small, 'left', env.alpha(c.muted, 0.9));
    write(g, d === 0 ? 'still' : signed(d) + (Math.abs(d) === 1 ? ' column' : ' columns'), geo.left + geo.span - 4, y0 + small * 0.9, small, 'right', env.alpha(c.accent2, 0.95));
    const ym = y0 + geo.band * 0.62;
    if (d) {
      g.strokeStyle = env.alpha(c.fg, 0.85);
      g.fillStyle = env.alpha(c.fg, 0.85);
      g.lineWidth = Math.max(1.2, 1.5 * k);
      arrow(g, geo.x(0), geo.x(d), ym, Math.max(4, 5 * k));
    } else {
      g.strokeStyle = env.alpha(c.fg, 0.6);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(geo.x(0), ym, 3 * k, 0, TAU);
      g.stroke();
    }
    if (s.hinted.includes(b + 1)) {
      g.fillStyle = env.alpha(c.accent, 0.95);
      g.beginPath();
      g.arc(geo.x(pos[b + 1]), y0, 3 * k, 0, TAU);
      g.fill();
      write(g, 'at ' + signed(pos[b + 1]), geo.x(pos[b + 1]), y0 - small * 0.8, small, 'center', env.alpha(c.accent, 0.95));
    }
  }
  // The lantern: waiting under the first band, or in flight once it has been let go.
  const bob = Math.sin(s.t * 1.1 + v.turn * TAU) * 2 * k;
  let lx = geo.x(0);
  let ly = geo.bottom + geo.band * 0.42;
  if (s.flight > 0) {
    const f = Math.min(s.flight, BANDS + 1.2);
    const b = Math.min(BANDS - 1, Math.floor(f));
    const col = f >= BANDS ? pos[BANDS] : pos[b] + (pos[b + 1] - pos[b]) * (f - b);
    lx = geo.x(col);
    ly = geo.bottom - f * geo.band;
    g.strokeStyle = env.alpha(c.accent2, 0.5);
    g.lineWidth = 1;
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(geo.x(0), geo.bottom + geo.band * 0.42);
    for (let j = 1; j <= b; j++) g.lineTo(geo.x(pos[j]), geo.bottom - j * geo.band);
    g.lineTo(lx, ly);
    g.stroke();
    g.setLineDash([]);
  } else {
    write(g, 'let go here', lx + 10 * k, ly, small, 'left', env.alpha(c.muted, 0.9));
  }
  lantern(g, env, lx, ly + bob, 0.7 + Math.min(1, s.flight) * 0.5, k, '');
  // The answer as set: a hollow mark over the column the visitor says it leaves at.
  if (s.guess != null) {
    const gx = geo.x(s.guess);
    g.strokeStyle = env.alpha(c.accent, 0.9);
    g.lineWidth = 1.5;
    g.setLineDash([3, 3]);
    g.strokeRect(gx - 6 * k, geo.top - 10 * k, 12 * k, 8 * k);
    g.setLineDash([]);
  }
  write(g, 'where it leaves the top', w / 2, h * 0.045, small, 'center', env.alpha(c.muted, 0.85));
}

function driftPreview(g, w, h, env, plan, t) {
  drawDrift(g, w, h, env, plan, { band: 0, guess: null, hinted: [], flight: 0, t: t || 0 }, env.variant);
}

function driftPiece(env, plan) {
  const helps = asked(env).helps;
  const total = driftTotal(plan.bands);
  const hard = strongest(plan.bands);
  const pos = positions(plan.bands);
  const s = { band: 0, guess: null, hinted: [], flight: 0, t: 0 };
  const draw = (c) => drawDrift(c.g, c.w, c.h, c, plan, s, env.variant);
  const leaves = (n) => 'column ' + signed(n) + ', ' + WORDS[Math.abs(n)] + (Math.abs(n) === 1 ? ' column ' : ' columns ') + (n < 0 ? 'left' : 'right') + ' of where it was let go';
  return {
    title: driftTitle(),
    brief: 'An offering to the wind: one lantern is let go at the dotted column and rises through four bands of wind. Each band pushes it the number of columns its arrow shows, left when the number is negative and right when it is positive, and the grid is there to count on.',
    goal: 'Say how many columns it has drifted when it leaves the top, and which band pushes hardest.',
    aspect: '4 / 3',
    checkLabel: 'let it go',
    steps: [
      { id: 'drift', ask: 'its drift when it leaves the top, in columns (left is negative)', kind: 'number', min: -COLS, max: COLS, step: 1, value: 0, unit: 'columns' },
      { id: 'band', ask: 'the band that pushes hardest', kind: 'number', min: 1, max: BANDS, step: 1, value: 1 },
      // One press, one band shown, and the difficulty says how many bands the wind will show.
      { id: 'hint', ask: 'where it is after the next band', kind: 'press', count: Math.max(1, Math.min(BANDS - 1, helps)), label: 'show me', optional: true }
    ],
    solution: { drift: total, band: hard },
    check(c) {
      const guess = Math.round(Number(c.value('drift')));
      const band = Math.round(Number(c.value('band')));
      const driftRight = guess === total;
      const bandRight = band === hard;
      if (driftRight && bandRight) return { solved: true, say: 'it leaves the top at ' + leaves(total) + '; band ' + hard + ' pushed hardest' };
      const parts = [];
      if (!driftRight) parts.push(guess < total ? 'it leaves the top further right than that' : 'it leaves the top further left than that');
      parts.push(bandRight ? 'the band is right' : 'band ' + band + ' is not the one that pushes hardest');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('four bands, one lantern, the grid to count on');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'drift') {
        const n = Math.round(Number(value));
        s.guess = Number.isFinite(n) ? Math.max(-COLS, Math.min(COLS, n)) : null;
        c.status('you say it leaves at ' + signed(s.guess));
      }
      if (id === 'band') {
        const n = Math.round(Number(value));
        s.band = Number.isFinite(n) ? Math.max(1, Math.min(BANDS, n)) : 0;
        c.status('you say band ' + s.band + ' pushes hardest');
      }
      if (id === 'hint') {
        const next = Math.max(1, Math.min(BANDS - 1, Math.round(Number(value)) || 1));
        if (!s.hinted.includes(next)) {
          s.hinted.push(next);
          c.hint();
          c.status('after band ' + next + ' it is at ' + signed(pos[next]));
        } else {
          c.status('the last band is yours to add');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) s.flight = Math.min(BANDS + 3, s.flight + dt * 0.8);
      draw(c);
    },
    end(c) {
      c.status('let go: it rises through the four bands and leaves at ' + signed(total));
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsOrder(env) {
  return env.chance(0.55);
}

export default {
  id: 'star-lantern',
  needsSky: true,
  paint(g, w, h, env) {
    if (dealsOrder(env)) orderPreview(g, w, h, env, orderPlan(env), env.variant.turn * 4);
    else driftPreview(g, w, h, env, driftPlan(env), env.variant.turn * 4);
  },
  animate(g, w, h, env, t) {
    if (dealsOrder(env)) orderPreview(g, w, h, env, orderPlan(env), t + env.variant.turn * 4);
    else driftPreview(g, w, h, env, driftPlan(env), t + env.variant.turn * 4);
  },
  spark(env) {
    if (!env.stars.length) return null;
    if (dealsOrder(env)) {
      const plan = orderPlan(env);
      return {
        title: orderTitle(plan),
        quote: clueText(plan.clues[0]),
        text: (plan.clues.length === 1 ? 'That is the one clue.' : capital(WORDS[plan.clues.length - 1]) + ' more clues wait under the sky.')
          + ' Find the one order the ' + WORDS[plan.n] + ' lanterns rise in.',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => orderPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 4),
        of: plan
      };
    }
    const plan = driftPlan(env);
    return {
      title: driftTitle(),
      mono: plan.bands.map((d, i) => 'band ' + (i + 1) + ': ' + (d === 0 ? 'still' : signed(d))).join('\n'),
      text: 'One lantern, lit and let go as an offering to four bands of wind. Say where it leaves the top, and which band pushes it hardest.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => driftPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 4),
      of: plan
    };
  },
  piece(env) {
    const order = carriedOrder(env);
    if (order) return orderPiece(env, order);
    const drift = carriedDrift(env);
    if (drift) return driftPiece(env, drift);
    return dealsOrder(env) ? orderPiece(env, orderPlan(env)) : driftPiece(env, driftPlan(env));
  }
};
