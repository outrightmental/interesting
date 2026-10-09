/* The apocrypha desk: a catalogue of objects that were never real, dealt one at a time. As a card
   it is a cabinet of four drawers with a card of clues beside it, or a drawer of six specimens
   with a rule pinned to it (paint, spark); as a piece it is one of the two puzzles below, and the
   card it was opened from says which. Nothing here is a real object, a real collection or a real
   claim about the world. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles, all deduction:

     the drawer       Four specimens go into four drawers, top to bottom, and a card of clues says
                      how: above, right below, not at the top, two drawers between. The clues are
                      drawn from the true order and pruned until exactly one order fits them (all
                      twenty-four orders are tried). A wrong check says how many stand in the
                      right drawer and no more; a hint, at a price, shows one specimen its drawer.
     the odd one out  Six specimens, each with a body, some legs and a marking, and one rule pinned
                      to the drawer that five of them keep. Find the one that breaks it and say
                      which of its features the rule disputes. The six are rolled until no rule of
                      the same family that four of them would witness singles out another one. A
                      wrong check says whether the specimen is right, and no more.
     the forged number
                      Five catalogue cards and the rule a true number keeps (its last digit is the
                      last digit of the sum of its first three). One card breaks it: find it and
                      say the digit it should end in. A wrong check says whether the card is right.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the specimens, the order, the clues; the six and the rule; the five numbers -- and
   piece(env) opens on that rather than rolling another. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const DRAWERS = ['top', 'second', 'third', 'bottom'];
const SPECIMENS = [
  { name: 'key', kind: 'key' },
  { name: 'bell', kind: 'bell' },
  { name: 'reel', kind: 'spool' },
  { name: 'hinge', kind: 'block' },
  { name: 'whistle', kind: 'tube' },
  { name: 'lens', kind: 'disc' }
];
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

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

/* ---- the drawing: desk, card, specimen ----------------------------------------------------- */

/* The motion of the rite (README: "Motion axiom"): nothing here moves along a formula. A curve is
   a polyline -- a hesitation, a surge, a stutter, a settle -- and riteCurve rolls one from a seed,
   so the fade that falls over a solved cabinet runs its own way for every piece and the same way
   every time that piece is played. Rolled from the seed and never from env.rnd, so the puzzle a
   seed deals is untouched by it; `ease` is the one baked curve a preview falls back on. */
function along(stops) {
  return (t) => {
    if (!(t > 0)) return stops[0][1];
    if (t >= 1) return stops[stops.length - 1][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, y0] = stops[i - 1];
        const [t1, y1] = stops[i];
        return t1 > t0 ? y0 + (y1 - y0) * ((t - t0) / (t1 - t0)) : y1;
      }
    }
    return 1;
  };
}

function riteCurve(seed, over) {
  let a = (seed >>> 0) || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  const stops = [[0, 0]];
  let at = 0;
  const put = (t, y) => {
    at = Math.min(0.99, Math.max(at, t));
    stops.push([at, y]);
  };
  if (rnd() < 0.7) put(between(0.03, 0.14), between(0, 0.02)); // the hesitation
  const peak = between(0.45, 0.7);
  const high = over ? 1 + between(0.02, 0.1) : 1;
  put(at + (peak - at) * between(0.3, 0.55), high * between(0.45, 0.7)); // the surge
  if (rnd() < 0.6) put(at + between(0.02, 0.06), stops[stops.length - 1][1]); // the stutter
  put(peak, high);
  if (over) put(peak + (1 - peak) * between(0.3, 0.6), 1 - (high - 1) * 0.4); // the settle
  put(between(0.86, 0.96), over ? 1 : between(0.96, 1));
  stops.push([1, 1]);
  return along(stops);
}

const ease = along([[0, 0], [0.1, 0.02], [0.38, 0.64], [0.45, 0.58], [0.62, 1], [0.8, 0.97], [1, 1]]);

function catalogue(env) {
  return env.pick(LETTERS.split('')) + env.pick(LETTERS.split('')) + '-' + env.int(1000, 9999);
}

function some(env, list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
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

// What the desk looks like for one piece: the grain's rows, the card's foxing and the tilt
// everything lies at. Cosmetic, and rolled from the seed rather than carried on the card.
function scenery(env) {
  const rows = [];
  for (let i = 0; i < 64; i++) rows.push(0.25 + env.rnd() * 0.2);
  const spots = [];
  for (let i = 0; i < 14; i++) spots.push({ x: env.rnd(), y: env.rnd(), r: 1 + env.rnd() * 3 });
  return { rows, spots, tilt: (env.rnd() - 0.5) * 0.08 };
}

function deskTop(g, w, h, c, rows, density) {
  g.fillStyle = c.mix(c.colors.bg, c.colors.bg2, 0.3);
  g.fillRect(0, 0, w, h);
  const n = Math.max(8, Math.round(rows.length * (density || 1)));
  for (let i = 0; i < n; i++) {
    g.fillStyle = c.alpha(c.colors.bg2, rows[i % rows.length]);
    g.fillRect(0, Math.round((i / n) * h), w, 1);
  }
}

function write(g, str, x, y, size, color, align, weight) {
  g.font = (weight || 500) + ' ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  g.fillStyle = color;
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

function wrap(g, str, size, maxW) {
  g.font = '500 ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  const lines = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && g.measureText(test).width > maxW) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// An index card, ruled, with its centre at the origin: `age` yellows and foxes it, `rows` is how
// many rules it is ruled for (the first rule is the red one).
function card(g, c, cw, ch, age, spots, rows) {
  const k = c.colors;
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  g.fillStyle = c.mix(c.mix(k.bg, k.fg, 0.08), k.accent2, age * 0.14);
  g.fillRect(-cw / 2, -ch / 2, cw, ch);
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  if (spots) {
    g.fillStyle = c.alpha(k.accent2, 0.16);
    const n = Math.round(age * spots.length);
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(-cw / 2 + spots[i].x * cw, -ch / 2 + spots[i].y * ch, spots[i].r * (0.6 + age), 0, Math.PI * 2);
      g.fill();
    }
  }
  const m = Math.min(10, cw * 0.06);
  const n = rows || 6;
  g.lineWidth = 1;
  for (let i = 1; i < n; i++) {
    const y = -ch / 2 + (ch / n) * i;
    g.strokeStyle = i === 1 ? c.alpha(k.accent2, 0.7) : c.alpha(k.accent, 0.35);
    g.beginPath();
    g.moveTo(-cw / 2 + m, y);
    g.lineTo(cw / 2 - m, y);
    g.stroke();
  }
}

function ring(g, x, y, r, hole) {
  g.moveTo(x + r, y);
  g.arc(x, y, r, 0, Math.PI * 2, !!hole);
}

// A specimen's silhouette as one path around the origin, `r` across; holes wind the other way.
function outline(g, kind, r) {
  g.beginPath();
  if (kind === 'key') {
    ring(g, 0, -r * 0.5, r * 0.42);
    ring(g, 0, -r * 0.5, r * 0.17, true);
    g.rect(-r * 0.1, -r * 0.15, r * 0.2, r * 1.1);
    g.rect(r * 0.1, r * 0.55, r * 0.33, r * 0.13);
    g.rect(r * 0.1, r * 0.8, r * 0.24, r * 0.13);
  } else if (kind === 'tube') {
    g.rect(-r * 0.2, -r * 0.95, r * 0.4, r * 1.8);
    g.rect(-r * 0.34, -r * 0.95, r * 0.68, r * 0.3);
    ring(g, 0, -r * 0.1, r * 0.09, true);
  } else if (kind === 'bell') {
    g.moveTo(-r * 0.75, r * 0.3);
    g.quadraticCurveTo(-r * 0.6, -r * 0.7, 0, -r * 0.75);
    g.quadraticCurveTo(r * 0.6, -r * 0.7, r * 0.75, r * 0.3);
    g.lineTo(r * 0.95, r * 0.5);
    g.lineTo(-r * 0.95, r * 0.5);
    g.closePath();
    g.rect(-r * 0.09, -r * 0.98, r * 0.18, r * 0.28);
  } else if (kind === 'spool') {
    g.rect(-r * 0.8, -r * 0.72, r * 1.6, r * 0.24);
    g.rect(-r * 0.8, r * 0.48, r * 1.6, r * 0.24);
    g.rect(-r * 0.36, -r * 0.5, r * 0.72, r * 1);
  } else if (kind === 'block') {
    g.rect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
    ring(g, -r * 0.5, 0, r * 0.1, true);
    ring(g, r * 0.5, 0, r * 0.1, true);
  } else {
    ring(g, 0, 0, r * 0.85);
    ring(g, 0, 0, r * 0.14, true);
  }
}

// The specimen at the origin: its body in `fill`, with a soft shadow under it.
function specimen(g, c, kind, r, fill) {
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  outline(g, kind, r);
  g.fillStyle = fill;
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  g.strokeStyle = c.alpha(c.colors.fg, 0.3);
  g.lineWidth = 1;
  g.stroke();
}

/* ---- the drawer: an order from clues ------------------------------------------------------- */

// A clue about which drawer a specimen is in. `a` and `b` are item indices; `order` lists the
// items top to bottom, so a lower position number is a higher drawer.
function holds(clue, order) {
  const at = (item) => order.indexOf(item);
  const n = order.length;
  switch (clue.t) {
    case 'above': return at(clue.a) < at(clue.b);
    case 'notTop': return at(clue.a) !== 0;
    case 'notBottom': return at(clue.a) !== n - 1;
    case 'rightBelow': return at(clue.a) === at(clue.b) + 1;
    case 'between': return Math.abs(at(clue.a) - at(clue.b)) === clue.d;
    case 'next': return Math.abs(at(clue.a) - at(clue.b)) === 1;
    case 'notNext': return Math.abs(at(clue.a) - at(clue.b)) > 1;
    case 'end': return at(clue.a) === 0 || at(clue.a) === n - 1;
    case 'slot': return at(clue.a) === clue.k;
    default: return false;
  }
}

function clueText(clue, names) {
  const a = 'the ' + names[clue.a];
  const b = clue.b == null ? '' : 'the ' + names[clue.b];
  switch (clue.t) {
    case 'above': return a + ' is somewhere above ' + b;
    case 'notTop': return a + ' is not in the top drawer';
    case 'notBottom': return a + ' is not in the bottom drawer';
    case 'rightBelow': return a + ' is right below ' + b;
    case 'between': return (clue.d === 2 ? 'one drawer lies' : 'two drawers lie') + ' between ' + a + ' and ' + b;
    case 'next': return a + ' and ' + b + ' are in neighbouring drawers';
    case 'notNext': return a + ' and ' + b + ' are not in neighbouring drawers';
    case 'end': return a + ' is in the top drawer or the bottom one';
    case 'slot': return a + ' is in the ' + DRAWERS[clue.k] + ' drawer';
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
    if (pa !== 0) out.push({ t: 'notTop', a });
    if (pa !== n - 1) out.push({ t: 'notBottom', a });
    if (pa === 0 || pa === n - 1) out.push({ t: 'end', a });
    out.push({ t: 'slot', a, k: pa });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const pb = order.indexOf(b);
      if (pa < pb) out.push({ t: 'above', a, b });
      if (pa === pb + 1) out.push({ t: 'rightBelow', a, b });
      if (a < b && Math.abs(pa - pb) === 1) out.push({ t: 'next', a, b });
      if (a < b && Math.abs(pa - pb) >= 2) {
        out.push({ t: 'between', a, b, d: Math.abs(pa - pb) });
        out.push({ t: 'notNext', a, b });
      }
    }
  }
  return out;
}

// The weight a clue carries in the draw: the vaguer kinds first, so the puzzle leans on reasoning
// rather than on being told where a thing is.
function clueWeight(clue) {
  return clue.t === 'slot' ? 1 : clue.t === 'end' || clue.t === 'notTop' || clue.t === 'notBottom' ? 2 : 4;
}

// Clues for `order`, drawn by weight until exactly one order fits and pruned of any that can go.
function drawClues(env, order, perms) {
  const candidates = trueClues(order);
  let clues = [];
  for (let guard = 0; guard < 40 && fits(clues, perms).length !== 1 && candidates.length; guard++) {
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
    if (fits(clues.concat([clue]), perms).length < fits(clues, perms).length) clues.push(clue);
  }
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.slice(0, i).concat(clues.slice(i + 1));
    if (fits(without, perms).length === 1) clues = without;
  }
  return clues;
}

function drawerPlan(env) {
  const n = 4;
  const items = some(env, [0, 1, 2, 3, 4, 5], n);
  const order = shuffled(env, [0, 1, 2, 3]);
  const perms = permutations(n);
  let clues = null;
  // At most five clues: a card has only so many lines, so a draw that needs more is drawn again.
  for (let attempt = 0; attempt < 12 && !clues; attempt++) {
    const drawn = drawClues(env, order, perms);
    if (drawn.length <= 5 && fits(drawn, perms).length === 1) clues = drawn;
  }
  if (!clues) clues = [0, 1, 2].map((a) => ({ t: 'slot', a, k: order.indexOf(a) }));
  // An opening order that is not the answer, so the cabinet asks something.
  let start = shuffled(env, order);
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, order);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return { kind: 'drawer', number: catalogue(env), items, order, clues, start };
}

function carriedDrawer(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'drawer') return null;
  const n = 4;
  if (!Array.isArray(p.items) || p.items.length !== n) return null;
  if (!p.items.every((i) => Number.isInteger(i) && i >= 0 && i < SPECIMENS.length) || new Set(p.items).size !== n) return null;
  const isPerm = (list) => Array.isArray(list) && list.length === n && list.every((v) => Number.isInteger(v) && v >= 0 && v < n) && new Set(list).size === n;
  if (!isPerm(p.order) || !isPerm(p.start) || p.start.every((v, i) => v === p.order[i])) return null;
  if (!Array.isArray(p.clues) || !p.clues.length || p.clues.length > 5) return null;
  const pair = ['above', 'rightBelow', 'between', 'next', 'notNext'];
  const okClue = (c) => c && typeof c === 'object' && ['above', 'notTop', 'notBottom', 'rightBelow', 'between', 'next', 'notNext', 'end', 'slot'].includes(c.t)
    && Number.isInteger(c.a) && c.a >= 0 && c.a < n
    && (!pair.includes(c.t) || (Number.isInteger(c.b) && c.b >= 0 && c.b < n && c.b !== c.a))
    && (c.t !== 'between' || (Number.isInteger(c.d) && c.d >= 2 && c.d < n))
    && (c.t !== 'slot' || (Number.isInteger(c.k) && c.k >= 0 && c.k < n));
  if (!p.clues.every(okClue)) return null;
  const clues = p.clues.map((c) => ({ t: c.t, a: c.a, b: c.b, d: c.d, k: c.k }));
  const only = fits(clues, permutations(n));
  if (only.length !== 1 || !only[0].every((v, i) => v === p.order[i])) return null;
  const number = typeof p.number === 'string' && /^[A-Z]{2}-\d{4}$/.test(p.number) ? p.number : 'XX-0000';
  return { kind: 'drawer', number, items: p.items.slice(), order: p.order.slice(), clues, start: p.start.slice() };
}

function drawerTitle(plan) {
  return 'the drawer: four specimens, ' + WORDS[plan.clues.length] + (plan.clues.length === 1 ? ' clue' : ' clues');
}

function drawerGeometry(w, h, scale) {
  const cw = Math.min(w * 0.4, h * 0.56) * scale;
  const ch = h * 0.72 * scale;
  return { x: w * 0.06, y: h * 0.5 - ch / 2, cw, ch, slot: ch / 4 };
}

function drawCabinet(g, w, h, env, plan, s, look, variant) {
  const v = variant || PLAIN;
  const k = env.colors;
  const names = plan.items.map((i) => SPECIMENS[i].name);
  const geo = drawerGeometry(w, h, v.scale);
  deskTop(g, w, h, env, look.rows, v.density);
  // The cabinet: four drawer fronts, top to bottom, with the specimen each holds just now.
  g.fillStyle = env.mix(k.bg, k.bg2, 0.8);
  g.fillRect(geo.x - geo.cw * 0.04, geo.y - geo.slot * 0.12, geo.cw * 1.08, geo.ch + geo.slot * 0.24);
  const size = Math.max(9, Math.min(16, geo.slot * 0.26));
  for (let slot = 0; slot < 4; slot++) {
    const y = geo.y + slot * geo.slot;
    const item = s.order[slot];
    g.fillStyle = env.mix(k.bg2, k.accent2, 0.12 + slot * 0.03);
    g.fillRect(geo.x, y + geo.slot * 0.04, geo.cw, geo.slot * 0.92);
    g.fillStyle = env.alpha(k.fg, 0.08);
    g.fillRect(geo.x, y + geo.slot * 0.04, geo.cw, 1);
    g.fillStyle = env.alpha(k.accent2, 0.6);
    g.fillRect(geo.x + geo.cw * 0.78, y + geo.slot * 0.5 - 2, geo.cw * 0.12, 4);
    g.save();
    g.translate(geo.x + geo.cw * 0.17, y + geo.slot * 0.5);
    specimen(g, env, SPECIMENS[plan.items[item]].kind, geo.slot * 0.3, env.alpha(k.accent, 0.6));
    g.restore();
    write(g, 'the ' + names[item], geo.x + geo.cw * 0.34, y + geo.slot * 0.42, size, k.fg, 'left', 600);
    write(g, DRAWERS[slot], geo.x + geo.cw * 0.34, y + geo.slot * 0.68, size * 0.8, env.alpha(k.muted, 0.8), 'left', 500);
  }
  // A hinted specimen gets a dashed mark on the drawer it belongs in.
  for (const item of s.hinted) {
    const slot = plan.order.indexOf(item);
    const y = geo.y + slot * geo.slot;
    g.strokeStyle = env.alpha(k.accent2, 0.95);
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    g.strokeRect(geo.x + 3, y + geo.slot * 0.08, geo.cw - 6, geo.slot * 0.84);
    g.setLineDash([]);
    write(g, 'the ' + names[item] + ' goes here', geo.x + geo.cw - 6, y + geo.slot * 0.88, size * 0.75, k.accent2, 'right', 600);
  }
  // The card of clues, beside the cabinet.
  const cx = w * 0.72 + (v.turn - 0.5) * w * 0.03;
  const cw = w * 0.46;
  const ch = Math.min(h * 0.64, cw * 0.72);
  const fs = Math.max(9, Math.min(15, Math.min(w, h) * 0.032));
  g.save();
  g.translate(cx, h * 0.5);
  g.rotate(look.tilt + (v.turn - 0.5) * 0.06);
  const m = Math.min(10, cw * 0.06);
  const lines = [];
  plan.clues.forEach((clue, i) => wrap(g, clueText(clue, names), fs, cw - m * 2 - fs * 1.4).forEach((l, j) => lines.push({ text: l, first: j === 0, n: i + 1 })));
  const rows = Math.max(6, lines.length + 2);
  card(g, env, cw, ch, 0.3, look.spots, rows);
  const rh = ch / rows;
  const fsz = Math.min(fs, rh * 0.66);
  write(g, plan.number + ' / the drawer', -cw / 2 + m + 2, -ch / 2 + rh * 0.5, fsz, k.accent2, 'left', 700);
  lines.forEach((l, i) => {
    if (l.first) write(g, l.n + '.', -cw / 2 + m + 2, -ch / 2 + rh * (i + 1.5), fsz, k.accent2, 'left', 600);
    write(g, l.text, -cw / 2 + m + 2 + fsz * 1.3, -ch / 2 + rh * (i + 1.5), fsz, k.fg, 'left', 500);
  });
  g.restore();
  if (s.fade > 0) {
    g.fillStyle = env.alpha(k.accent2, (s.cool || ease)(s.fade) * 0.1);
    g.fillRect(0, 0, w, h);
  }
}

function drawerPreview(g, w, h, env, plan) {
  drawCabinet(g, w, h, env, plan, { order: plan.start.slice(), hinted: [], fade: 0 }, scenery(env), env.variant);
}

function drawerPiece(env, plan) {
  const names = plan.items.map((i) => SPECIMENS[i].name);
  const helps = asked(env).helps;
  const look = scenery(env);
  // The fade over a solved cabinet runs along a curve rolled for this piece (see riteCurve).
  const s = { order: plan.start.slice(), hinted: [], fade: 0, cool: riteCurve((env.seed >>> 0) ^ 0x4f1d) };
  const draw = (c) => drawCabinet(c.g, c.w, c.h, c, plan, s, look, env.variant);
  function right() {
    let n = 0;
    for (let i = 0; i < 4; i++) if (s.order[i] === plan.order[i]) n += 1;
    return n;
  }
  return {
    title: drawerTitle(plan),
    brief: 'A filing, by the card. Four specimens go into the four drawers of the cabinet, top to bottom, and the card beside it says how. Exactly one arrangement fits every line on the card.',
    goal: 'Put each specimen in the one drawer the card allows.',
    aspect: '4 / 3',
    checkLabel: 'check the cabinet',
    steps: [
      { id: 'order', ask: 'the specimens, top drawer to bottom', kind: 'order', items: plan.items.map((i, at) => ({ label: 'the ' + SPECIMENS[i].name, value: at })), value: plan.start.slice() },
      { id: 'hint', ask: 'one specimen shown its drawer', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: plan.order.slice() },
    check(c) {
      const n = right();
      return {
        solved: n === 4,
        say: n === 4 ? 'every specimen is in the drawer the card allows'
          : (n === 0 ? 'none of the four is filed in the right drawer yet' : WORDS[n] + ' of four filed in the right drawer')
      };
    },
    start(c) {
      c.status(WORDS[plan.clues.length] + (plan.clues.length === 1 ? ' clue' : ' clues') + ' on the card');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === 4) {
        s.order = value.map(Number);
        c.status('top to bottom: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.order.find((item) => !s.hinted.includes(item) && s.order.indexOf(item) !== plan.order.indexOf(item))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('the ' + names[next] + ' belongs in the ' + DRAWERS[plan.order.indexOf(next)] + ' drawer');
        } else if (s.hinted.length >= helps) {
          c.status('that is all the cabinet will show at this difficulty; the rest is yours');
        } else {
          c.status('every specimen out of place has been shown its drawer; the rest is yours');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) s.fade = Math.min(1, s.fade + dt * 0.8);
      draw(c);
    },
    end(c) {
      c.status(plan.number + ': ' + s.order.map((i) => names[i]).join(' over ') + '. filed; none of it exists');
    }
  };
}

/* ---- the odd one out: one rule, six specimens ---------------------------------------------- */

const ATTRS = ['body', 'legs', 'marking'];
const VALUES = { body: ['round', 'long', 'square'], legs: [2, 4, 6], marking: ['striped', 'spotted', 'plain'] };
const FEATURES = [
  { label: 'its body', value: 'body' },
  { label: 'its legs', value: 'legs' },
  { label: 'its marking', value: 'marking' }
];

function subject(attr, val) {
  return attr === 'legs' ? WORDS[val] + '-legged one' : val + ' one';
}

function predicate(attr, val) {
  return attr === 'legs' ? 'has ' + WORDS[val] + ' legs' : 'is ' + val;
}

function ruleText(r) {
  return (r.neg ? 'no ' : 'every ') + subject(r.ifAttr, r.ifVal) + ' ' + predicate(r.thenAttr, r.thenVal);
}

function breaks(r, spec) {
  return spec[r.ifAttr] === r.ifVal && (r.neg ? spec[r.thenAttr] === r.thenVal : spec[r.thenAttr] !== r.thenVal);
}

function allRules() {
  const out = [];
  for (const ifAttr of ATTRS) {
    for (const ifVal of VALUES[ifAttr]) {
      for (const thenAttr of ATTRS) {
        if (thenAttr === ifAttr) continue;
        for (const thenVal of VALUES[thenAttr]) {
          out.push({ ifAttr, ifVal, thenAttr, thenVal, neg: false });
          out.push({ ifAttr, ifVal, thenAttr, thenVal, neg: true });
        }
      }
    }
  }
  return out;
}

function allSpecs() {
  const out = [];
  for (const body of VALUES.body) for (const legs of VALUES.legs) for (const marking of VALUES.marking) out.push({ body, legs, marking });
  return out;
}

function sameRule(a, b) {
  return a.ifAttr === b.ifAttr && a.ifVal === b.ifVal && a.thenAttr === b.thenAttr && a.thenVal === b.thenVal && a.neg === b.neg;
}

// Does the drawer single out exactly the specimen at `odd` under `rule`, and no other specimen
// under any rule of the family that four or more of the six would witness?
function oddHolds(rule, specs, odd) {
  const broke = specs.map((s, i) => (breaks(rule, s) ? i : -1)).filter((i) => i >= 0);
  if (broke.length !== 1 || broke[0] !== odd) return false;
  if (specs.filter((s) => s[rule.ifAttr] === rule.ifVal).length < 3) return false;
  for (const r of allRules()) {
    if (sameRule(r, rule)) continue;
    if (specs.filter((s) => s[r.ifAttr] === r.ifVal).length < 4) continue;
    const other = specs.map((s, i) => (breaks(r, s) ? i : -1)).filter((i) => i >= 0);
    if (other.length === 1 && other[0] !== odd) return false;
  }
  return true;
}

function oddPlan(env) {
  const rules = allRules();
  const all = allSpecs();
  let last = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const rule = rules[env.int(0, rules.length - 1)];
    const keepers = all.filter((s) => s[rule.ifAttr] === rule.ifVal && !breaks(rule, s));
    const others = all.filter((s) => s[rule.ifAttr] !== rule.ifVal);
    const breakers = all.filter((s) => breaks(rule, s));
    // Five that keep the rule, at least two of them of the kind the rule names, and the one that
    // breaks it slipped in among them.
    const hold = env.int(2, 3);
    const specs = shuffled(env, some(env, keepers, hold).concat(some(env, others, 5 - hold)));
    const odd = env.int(0, 5);
    specs.splice(odd, 0, env.pick(breakers));
    last = { kind: 'odd', number: catalogue(env), rule: Object.assign({}, rule), specs, odd };
    if (oddHolds(rule, specs, odd)) return last;
  }
  return last;
}

function carriedOdd(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'odd' || !p.rule || typeof p.rule !== 'object') return null;
  const r = p.rule;
  if (!ATTRS.includes(r.ifAttr) || !ATTRS.includes(r.thenAttr) || r.ifAttr === r.thenAttr) return null;
  if (!VALUES[r.ifAttr].includes(r.ifVal) || !VALUES[r.thenAttr].includes(r.thenVal) || typeof r.neg !== 'boolean') return null;
  const rule = { ifAttr: r.ifAttr, ifVal: r.ifVal, thenAttr: r.thenAttr, thenVal: r.thenVal, neg: r.neg };
  if (!Array.isArray(p.specs) || p.specs.length !== 6) return null;
  const okSpec = (s) => s && typeof s === 'object' && ATTRS.every((a) => VALUES[a].includes(s[a]));
  if (!p.specs.every(okSpec)) return null;
  const specs = p.specs.map((s) => ({ body: s.body, legs: s.legs, marking: s.marking }));
  if (new Set(specs.map((s) => s.body + '|' + s.legs + '|' + s.marking)).size !== 6) return null;
  if (!Number.isInteger(p.odd) || p.odd < 0 || p.odd > 5) return null;
  const broke = specs.map((s, i) => (breaks(rule, s) ? i : -1)).filter((i) => i >= 0);
  if (broke.length !== 1 || broke[0] !== p.odd) return null;
  const number = typeof p.number === 'string' && /^[A-Z]{2}-\d{4}$/.test(p.number) ? p.number : 'XX-0000';
  return { kind: 'odd', number, rule, specs, odd: p.odd };
}

function oddTitle(plan) {
  return 'the odd one out: ' + ruleText(plan.rule);
}

function describe(spec) {
  return 'a ' + spec.marking + ', ' + spec.body + ' one with ' + WORDS[spec.legs] + ' legs';
}

// A specimen's body as a path around the origin, `r` across.
function bodyPath(g, body, r) {
  g.beginPath();
  if (body === 'round') g.arc(0, 0, r, 0, Math.PI * 2);
  else if (body === 'long') g.ellipse(0, 0, r * 0.55, r * 1.2, 0, 0, Math.PI * 2);
  else g.rect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8);
}

// A specimen of the six: its body, its marking clipped to it, its legs beneath.
function creature(g, c, spec, r) {
  const k = c.colors;
  const foot = spec.body === 'long' ? r * 1.2 : r * 0.9;
  g.strokeStyle = c.alpha(k.fg, 0.8);
  g.lineWidth = Math.max(1, r * 0.09);
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < spec.legs; i++) {
    const x = (i - (spec.legs - 1) / 2) * r * 0.42;
    g.moveTo(x, foot - r * 0.1);
    g.lineTo(x, foot + r * 0.5);
  }
  g.stroke();
  g.shadowColor = 'rgba(0,0,0,0.4)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  bodyPath(g, spec.body, r);
  g.fillStyle = c.mix(k.bg2, k.accent, 0.55);
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  if (spec.marking !== 'plain') {
    g.save();
    bodyPath(g, spec.body, r);
    g.clip();
    g.fillStyle = c.alpha(k.accent2, 0.85);
    if (spec.marking === 'striped') {
      for (let x = -r * 1.1; x <= r * 1.1; x += r * 0.4) g.fillRect(x, -r * 1.3, r * 0.16, r * 2.6);
    } else {
      for (let y = -r * 1.05; y <= r * 1.1; y += r * 0.5) {
        for (let x = -r * 0.95; x <= r * 1; x += r * 0.5) {
          g.beginPath();
          g.arc(x + (Math.round(y / (r * 0.5)) % 2 ? r * 0.25 : 0), y, r * 0.11, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }
  bodyPath(g, spec.body, r);
  g.strokeStyle = c.alpha(k.fg, 0.55);
  g.lineWidth = 1;
  g.stroke();
}

function trayGeometry(w, h, scale) {
  const tw = w * 0.86 * Math.min(1, scale);
  const th = h * 0.54 * Math.min(1, scale);
  return { x: w / 2 - tw / 2, y: h * 0.06, tw, th, cw: tw / 3, ch: th / 2 };
}

function drawTray(g, w, h, env, plan, s, look, variant) {
  const v = variant || PLAIN;
  const k = env.colors;
  const geo = trayGeometry(w, h, v.scale);
  deskTop(g, w, h, env, look.rows, v.density);
  // The drawer, pulled out and seen from above, with the six laid in it.
  g.fillStyle = env.mix(k.bg, k.bg2, 0.9);
  g.beginPath();
  g.roundRect(geo.x - 6, geo.y - 6, geo.tw + 12, geo.th + 12, 6);
  g.fill();
  g.fillStyle = env.mix(k.bg, k.bg2, 0.45);
  g.fillRect(geo.x, geo.y, geo.tw, geo.th);
  g.fillStyle = env.alpha(k.bg, 0.5);
  g.fillRect(geo.x, geo.y, geo.tw, geo.th * 0.06);
  const r = Math.min(geo.cw, geo.ch) * 0.19;
  const size = Math.max(9, Math.min(15, r * 0.55));
  plan.specs.forEach((spec, i) => {
    const cx = geo.x + (i % 3 + 0.5) * geo.cw + (v.turn - 0.5) * geo.cw * 0.06;
    const cy = geo.y + (Math.floor(i / 3) + 0.42) * geo.ch;
    if (s.pick === i) {
      g.strokeStyle = env.alpha(k.accent2, 0.9);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(cx - geo.cw * 0.44, cy - geo.ch * 0.38, geo.cw * 0.88, geo.ch * 0.84);
      g.setLineDash([]);
    }
    g.save();
    g.translate(cx, cy);
    creature(g, env, spec, r);
    g.restore();
    write(g, String(i + 1), cx, cy + geo.ch * 0.4, size, k.accent2, 'center', 700);
  });
  // The rule, pinned to the drawer on an index card.
  const cw = w * 0.76;
  const ch = h * 0.24;
  const fs = Math.max(9, Math.min(16, Math.min(w, h) * 0.036));
  g.save();
  g.translate(w / 2 + (v.turn - 0.5) * w * 0.02, h * 0.81);
  g.rotate(look.tilt * 0.6 + (v.turn - 0.5) * 0.04);
  card(g, env, cw, ch, 0.25, look.spots, 3);
  const m = Math.min(10, cw * 0.06);
  write(g, plan.number + ' / the rule of this drawer', -cw / 2 + m + 2, -ch / 2 + ch / 6, fs * 0.85, k.accent2, 'left', 700);
  write(g, ruleText(plan.rule), -cw / 2 + m + 2, -ch / 2 + ch / 2, fs, k.fg, 'left', 600);
  write(g, s.reveal ? 'specimen ' + (plan.odd + 1) + ' does not: ' + describe(plan.specs[plan.odd]) : 'five of the six keep it; one does not',
    -cw / 2 + m + 2, -ch / 2 + ch * 5 / 6, fs * 0.85, s.reveal ? k.accent : k.muted, 'left', 500);
  g.restore();
}

function oddPreview(g, w, h, env, plan) {
  drawTray(g, w, h, env, plan, { pick: -1, reveal: false }, scenery(env), env.variant);
}

function oddPiece(env, plan) {
  const look = scenery(env);
  const helps = asked(env).helps;
  const keepers = plan.specs.map((spec, i) => i).filter((i) => i !== plan.odd);
  const s = { pick: -1, reveal: false, vouched: [] };
  const draw = (c) => drawTray(c.g, c.w, c.h, c, plan, s, look, env.variant);
  const feature = FEATURES.find((f) => f.value === plan.rule.thenAttr);
  return {
    title: oddTitle(plan),
    brief: 'The drawer keeps one rule. Six specimens lie in it, each with a body, some legs and a marking, and the rule is pinned to it: it names a kind of specimen by one feature and says what that kind must, or must not, have. Five of the six keep the rule. One is of the kind it names and fails on the second feature.',
    goal: 'Find the one that breaks the rule, and name the feature it fails on.',
    aspect: '4 / 3',
    checkLabel: 'check the drawer',
    steps: [
      { id: 'pick', ask: 'the one that breaks the rule', kind: 'pick', count: 1, items: plan.specs.map((spec, i) => ({ label: 'specimen ' + (i + 1), value: i })) },
      { id: 'choice', ask: 'the feature it fails on', kind: 'choice', options: FEATURES },
      { id: 'hint', ask: 'one specimen vouched for', kind: 'press', count: 1, label: 'vouch for one', optional: true }
    ],
    solution: { pick: [plan.odd], choice: plan.rule.thenAttr },
    check(c) {
      const picked = Array.isArray(c.value('pick')) ? c.value('pick').map(Number) : [];
      const specRight = picked.length === 1 && picked[0] === plan.odd;
      const featureRight = c.value('choice') === plan.rule.thenAttr;
      if (specRight && featureRight) return { solved: true, say: 'specimen ' + (plan.odd + 1) + ' breaks the rule on ' + feature.label };
      if (specRight) return { solved: false, say: 'the specimen is right; the feature is off' };
      return { solved: false, say: picked.length === 1 ? 'specimen ' + (picked[0] + 1) + ' keeps the rule' : 'pick one specimen' };
    },
    start(c) {
      c.status('the rule: ' + ruleText(plan.rule));
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'pick') {
        const picked = Array.isArray(value) ? value.map(Number) : [];
        s.pick = picked.length === 1 ? picked[0] : -1;
        if (s.pick >= 0) c.status('specimen ' + (s.pick + 1) + ': ' + describe(plan.specs[s.pick]));
      }
      if (id === 'choice') {
        const f = FEATURES.find((o) => o.value === value);
        if (f) c.status('the rule disputes ' + f.label + ', you say');
      }
      if (id === 'hint') {
        const next = s.vouched.length < helps ? keepers.find((i) => !s.vouched.includes(i)) : undefined;
        if (next !== undefined) {
          s.vouched.push(next);
          c.hint();
          c.status('specimen ' + (next + 1) + ' keeps the rule: ' + describe(plan.specs[next]));
        } else if (s.vouched.length >= helps) {
          c.status('that is all the drawer will vouch for at this difficulty; read the rest against the rule');
        } else {
          c.status('every specimen but one has been vouched for; the one left is the one that breaks it');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('specimen ' + (plan.odd + 1) + ' is ' + describe(plan.specs[plan.odd]) + ', which the rule does not allow. filed; none of it exists');
      draw(c);
    }
  };
}

/* ---- the forged number: one check digit wrong ---------------------------------------------- */

function checkDigit(number) {
  return (Number(number[0]) + Number(number[1]) + Number(number[2])) % 10;
}

function forgedPlan(env) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const numbers = [];
    while (numbers.length < 5) {
      const head = String(env.int(100, 999));
      const number = head + checkDigit(head);
      if (!numbers.includes(number)) numbers.push(number);
    }
    const odd = env.int(0, 4);
    const digit = checkDigit(numbers[odd]);
    const wrong = (digit + env.int(1, 9)) % 10;
    const forged = numbers[odd].slice(0, 3) + wrong;
    if (numbers.includes(forged)) continue;
    numbers[odd] = forged;
    return { kind: 'forged', numbers, odd, digit };
  }
  return { kind: 'forged', numbers: ['1012', '2035', '3107', '4116', '5207'], odd: 2, digit: checkDigit('310') };
}

function carriedForged(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'forged') return null;
  if (!Array.isArray(p.numbers) || p.numbers.length !== 5 || !p.numbers.every((n) => typeof n === 'string' && /^[1-9]\d{3}$/.test(n))) return null;
  if (new Set(p.numbers).size !== 5 || !Number.isInteger(p.odd) || p.odd < 0 || p.odd > 4) return null;
  const broken = p.numbers.map((n, i) => (Number(n[3]) !== checkDigit(n) ? i : -1)).filter((i) => i >= 0);
  if (broken.length !== 1 || broken[0] !== p.odd || p.digit !== checkDigit(p.numbers[p.odd])) return null;
  return { kind: 'forged', numbers: p.numbers.slice(), odd: p.odd, digit: p.digit };
}

function forgedTitle(plan) {
  return 'the forged number: five cards, one wrong';
}

function drawFan(g, w, h, env, plan, s, look, variant) {
  const v = variant || PLAIN;
  const k = env.colors;
  deskTop(g, w, h, env, look.rows, v.density);
  const cw = Math.min(w * 0.3, h * 0.42) * v.scale;
  const ch = cw * 0.62;
  const fs = Math.max(9, Math.min(18, cw * 0.14));
  // Five cards fanned across the desk, each with its number, the picked one lifted.
  plan.numbers.forEach((number, i) => {
    const x = w * (0.16 + 0.17 * i) + (v.turn - 0.5) * w * 0.03;
    const y = h * (0.3 + (i % 2) * 0.18);
    g.save();
    g.translate(x, y);
    g.rotate(look.tilt + (i - 2) * 0.06 + (v.turn - 0.5) * 0.05);
    card(g, env, cw, ch, 0.25, i === 2 ? look.spots : null, 4);
    if (s.pick === i) {
      g.strokeStyle = env.alpha(k.accent2, 0.95);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(-cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6);
      g.setLineDash([]);
    }
    const m = Math.min(10, cw * 0.06);
    write(g, 'card ' + (i + 1), -cw / 2 + m + 2, -ch / 2 + ch / 8, fs * 0.65, env.alpha(k.muted, 0.9), 'left', 500);
    write(g, 'APC-' + number, -cw / 2 + m + 2, -ch / 2 + ch * 0.5, fs, s.reveal && i === plan.odd ? k.accent : k.accent2, 'left', 700);
    if (s.reveal && i === plan.odd) write(g, 'should end in ' + plan.digit, -cw / 2 + m + 2, -ch / 2 + ch * 0.8, fs * 0.65, k.accent, 'left', 600);
    g.restore();
  });
  // The rule, on a slip along the bottom of the desk.
  const sw = w * 0.84;
  const sh = h * 0.24;
  const rs = Math.max(9, Math.min(15, Math.min(w, h) * 0.034));
  const m = Math.min(10, sw * 0.06);
  const lines = [{ text: 'the rule of the desk', color: k.accent2, weight: 700 }];
  wrap(g, 'a true number ends in the last digit of the sum of its first three digits', rs, sw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: k.fg, weight: 500 }));
  wrap(g, 'so 4172 is true: 4 + 1 + 7 = 12, and it ends in 2. one card on the desk is forged', rs, sw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: k.muted, weight: 500 }));
  const rows = lines.length;
  const rh = sh / rows;
  g.save();
  g.translate(w / 2, h * 0.86);
  g.rotate(-look.tilt * 0.5);
  card(g, env, sw, sh, 0.1, null, rows);
  lines.forEach((l, i) => write(g, l.text, -sw / 2 + m + 2, -sh / 2 + rh * (i + 0.5), Math.min(rs, rh * 0.66), l.color, 'left', l.weight));
  g.restore();
}

function forgedPreview(g, w, h, env, plan) {
  drawFan(g, w, h, env, plan, { pick: -1, reveal: false }, scenery(env), env.variant);
}

function forgedPiece(env, plan) {
  const look = scenery(env);
  const helps = asked(env).helps;
  const trueCards = plan.numbers.map((n, i) => i).filter((i) => i !== plan.odd);
  const s = { pick: -1, reveal: false, vouched: [] };
  const draw = (c) => drawFan(c.g, c.w, c.h, c, plan, s, look, env.variant);
  return {
    title: forgedTitle(plan),
    brief: 'The seal is a sum. Five catalogue cards lie on the desk, each with a four-figure number, and the slip under them gives the rule a true number keeps: it ends in the last digit of the sum of its first three. Four of the cards keep it. One was written by someone who did not know the rule.',
    goal: 'Find the forged card, and say which digit it should end in.',
    aspect: '4 / 3',
    checkLabel: 'check the cards',
    steps: [
      { id: 'pick', ask: 'the forged card', kind: 'pick', count: 1, items: plan.numbers.map((n, i) => ({ label: 'card ' + (i + 1) + ': APC-' + n, value: i })) },
      { id: 'digit', ask: 'the digit it should end in', kind: 'number', min: 0, max: 9, step: 1, value: 0 },
      { id: 'hint', ask: 'one card vouched for', kind: 'press', count: 1, label: 'vouch for one', optional: true }
    ],
    solution: { pick: [plan.odd], digit: plan.digit },
    check(c) {
      const picked = Array.isArray(c.value('pick')) ? c.value('pick').map(Number) : [];
      const cardRight = picked.length === 1 && picked[0] === plan.odd;
      const digitRight = Number(c.value('digit')) === plan.digit;
      if (cardRight && digitRight) return { solved: true, say: 'APC-' + plan.numbers[plan.odd] + ' is the forgery; it should end in ' + plan.digit };
      if (cardRight) return { solved: false, say: 'the card is right; the digit is off' };
      return { solved: false, say: picked.length === 1 ? 'APC-' + plan.numbers[picked[0]] + ' keeps the rule' : 'pick one card' };
    },
    start(c) {
      c.status('five numbers, one rule, one forgery');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'pick') {
        const picked = Array.isArray(value) ? value.map(Number) : [];
        s.pick = picked.length === 1 ? picked[0] : -1;
        if (s.pick >= 0) c.status('card ' + (s.pick + 1) + ', APC-' + plan.numbers[s.pick] + ', you say');
      }
      if (id === 'digit') c.status('it should end in ' + Number(value) + ', you say');
      if (id === 'hint') {
        const next = s.vouched.length < helps ? trueCards.find((i) => !s.vouched.includes(i)) : undefined;
        if (next !== undefined) {
          s.vouched.push(next);
          c.hint();
          c.status('APC-' + plan.numbers[next] + ' keeps the rule: ' + plan.numbers[next].slice(0, 3).split('').join(' + ') + ' ends in ' + plan.numbers[next][3]);
        } else if (s.vouched.length >= helps) {
          c.status('that is all the desk will vouch for at this difficulty; add up the rest yourself');
        } else {
          c.status('every true card has been vouched for; the one left is the forgery');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('APC-' + plan.numbers[plan.odd] + ' should end in ' + plan.digit + '. struck from the catalogue, which never had it');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the three the seed deals: the drawer, the odd one out, or the forged number.
function deal(env) {
  const roll = env.rnd();
  return roll < 0.4 ? 'drawer' : roll < 0.75 ? 'odd' : 'forged';
}

export default {
  id: 'apocrypha-desk',
  needsSky: false,
  paint(g, w, h, env) {
    const kind = deal(env);
    if (kind === 'drawer') drawerPreview(g, w, h, env, drawerPlan(env));
    else if (kind === 'odd') oddPreview(g, w, h, env, oddPlan(env));
    else forgedPreview(g, w, h, env, forgedPlan(env));
  },
  spark(env) {
    const kind = deal(env);
    if (kind === 'forged') {
      const plan = forgedPlan(env);
      return {
        overline: 'APC-' + plan.numbers[0] + ' and four more',
        title: forgedTitle(plan),
        text: 'Five catalogue numbers, sealed by one rule. One card was written by someone who did not know it. Find it, and say the digit it should end in.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => forgedPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (kind === 'drawer') {
      const plan = drawerPlan(env);
      const names = plan.items.map((i) => SPECIMENS[i].name);
      return {
        overline: plan.number,
        title: drawerTitle(plan),
        quote: clueText(plan.clues[0], names),
        text: (plan.clues.length === 1 ? 'That is the one clue.' : WORDS[plan.clues.length - 1][0].toUpperCase() + WORDS[plan.clues.length - 1].slice(1) + ' more wait on the card.')
          + ' Put the four specimens in the one order of drawers that fits them all.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => drawerPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = oddPlan(env);
    return {
      overline: plan.number,
      title: oddTitle(plan),
      text: 'Six specimens in a drawer and one rule pinned to it. Five keep the rule; find the one that breaks it, and say which of its features the rule disputes.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => oddPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const drawer = carriedDrawer(env);
    if (drawer) return drawerPiece(env, drawer);
    const odd = carriedOdd(env);
    if (odd) return oddPiece(env, odd);
    const forged = carriedForged(env);
    if (forged) return forgedPiece(env, forged);
    const kind = deal(env);
    if (kind === 'drawer') return drawerPiece(env, drawerPlan(env));
    if (kind === 'odd') return oddPiece(env, oddPlan(env));
    return forgedPiece(env, forgedPlan(env));
  }
};
