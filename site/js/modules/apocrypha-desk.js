/* The apocrypha desk: a catalogue of objects that were never real, dealt one at a time. As a card
   it is a cabinet of four drawers with a card of clues beside it, a drawer of six specimens with a
   rule pinned to it, or a fan of five catalogue cards with the rule on a slip under them (paint,
   spark); as a piece it is one of the three puzzles below, and the card it was opened from says
   which. Nothing here is a real object, a real collection or a real claim about the world. See
   js/feed.js for what a module is and js/stage.js for what a piece is.

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

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): one clean edge -- a slice at an angle, or a curve grown from a corner
   or the middle of a side -- which is the piece's signature, and the few treads every change
   climbs, always forward. Nothing on the desk moves along a formula, and nothing moves without a
   reason to:

     a specimen moved  travels to the drawer it was put in on rite.ease, a landing: the first
                       tread the longest way, each after it shorter. Each specimen lands on a
                       roll of its own (rite.at), so no two step together, and one moved again on
                       its way sets off from where it stands, never from where it was going.
     a surface set     the drawer a hint names, the bed or the card a visitor picks, the forgery
                       or the odd one once it is found, the whole desk once it is solved: cut in
                       behind the piece's edge as its stair climbs, and resting in two shades of
                       its colour split by that edge through its middle. The one picked before it
                       gives its surface back down the same stair, the edge going back the way it
                       came, and a picked card lifts off the desk on that stair and settles back.
                       A pick changed on its way goes on from where it stands, one way.
     a word            a hint's label, the verdict, "filed": cut on at its moment (rite.flicker:
                       nothing before it, the whole word after) and held. What the visitor says,
                       and the dashed frame round what they picked, are replaced in one cut: the
                       old stands until the new one's moment, never nothing in between.

   A desk at rest does not move and is not drawn again. Every change is read against the piece's
   own clock, s.t, which frame() advances: a change made at `since` has come came() of its way,
   which is 1 at once for a visitor who asked for less motion and for whatever stood there from
   the start (since < 0), so less motion shows every end state. frame() draws only while something
   is on its way, or when the canvas has been sized again. Rolled from the seed and never from
   env.rnd, so the puzzle a seed deals is untouched by it. */

// The rite of a piece handed none: every change already made, and a surface cut by a plain
// upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, flicker: () => 1, treads: 1, kind: 'slice', angle: 90,
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

// One roll per thing the desk moves (rite.at, keyed), made once and kept: rolling it is a new
// stream and a dozen closures, which a frame has no need to make again.
const rolls = new WeakMap();
function roll(rite, key) {
  let kept = rolls.get(rite);
  if (!kept) rolls.set(rite, (kept = new Map()));
  let got = kept.get(key);
  if (!got) kept.set(key, (got = rite.at(key)));
  return got;
}

function came(now, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (now - since) / span));
}

// How much lighter the far shade of a set surface is: the same fraction the site's own set
// controls rest at (cut.shades in _sass/_cut.scss).
const FAR = 0.45;

// A surface `k` of the way to being set, in `color` at `a`: the edge's first half in the near
// shade and the band beyond it in the far one, each filled once and the two never over one
// another. While it comes or goes one edge moves across it; at rest it is two shades of one
// colour split by that edge through the middle of the box. Two fills, never cells.
function cover(g, env, rite, x, y, w, h, k, color, a) {
  const near = Math.min(k, 0.5);
  if (near <= 0) return;
  const curve = rite.kind === 'curve';
  if (curve) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
  }
  if (k > near) {
    g.beginPath();
    rite.region(g, x, y, w, h, k);
    rite.region(g, x, y, w, h, near);
    g.fillStyle = env.alpha(color, a * FAR);
    g.fill('evenodd');
  }
  g.beginPath();
  rite.region(g, x, y, w, h, near);
  g.fillStyle = env.alpha(color, a);
  g.fill();
  if (curve) g.restore();
}

// A surface that is set and given back (a picked bed, a picked card's face and lift): where it
// stands at `now`, 0 to 1. It set off from `from` at `at` toward `to` and climbs or goes down
// `own`'s stair from wherever it stood when it was told -- one way, never back to an end it had
// not reached. `move` records a new telling.
function standing(m, now, span, reduced, own) {
  if (!m) return 0;
  if (reduced || m.at < 0) return m.to;
  return m.from + (m.to - m.from) * own.stair(came(now, m.at, span, reduced));
}
function move(m, to, now, span, reduced, own) {
  return { from: standing(m, now, span, reduced, own), to, at: now };
}

// A thing replaced by one cut (what the visitor says, the frame round what they picked): what it
// shows at `now` -- the new from its moment on, and until then whatever stood there when it was
// told, never nothing in between. `replace` records a new telling, on its own roll.
function showing(r, now, span, reduced) {
  if (!r) return null;
  return r.roll.flicker(came(now, r.at, span, reduced)) ? r.now : r.was;
}
function replace(r, value, now, span, reduced, roll) {
  return { was: showing(r, now, span, reduced), now: value, at: now, roll };
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
// A movement started now, `span` seconds long: the desk is drawn until it ends. Less motion shows
// every end state at once, so nothing is kept in flight for it.
function busy(s, c, span) {
  if (!c.reduced) s.until = Math.max(s.until, s.t + span);
}

// The wash that comes over a solved desk: cut in behind the piece's edge up its stair from the
// moment the piece was solved, and resting in two shades.
function wash(g, env, rite, w, h, p, color, a) {
  cover(g, env, rite, 0, 0, w, h, rite.stair(p), color, a);
}

const TRAVEL = 1.1; // seconds a specimen takes to change drawers
const SPAN = 0.7;   // seconds a pick, a hint or a word takes to arrive
const REVEAL = 1.8; // seconds a solved desk takes to be cut over

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

/* ---- the drawing: desk, card, specimen ----------------------------------------------------- */

// What the desk looks like for one piece: the tilt everything on it lies at. Cosmetic, and rolled
// from the seed rather than carried on the card.
function scenery(env) {
  return { tilt: (env.rnd() - 0.5) * 0.08 };
}

// The desk: one plain surface, nothing scattered on it, so what lies on it is the picture.
function deskTop(g, w, h, c) {
  g.fillStyle = c.mix(c.colors.bg, c.colors.bg2, 0.3);
  g.fillRect(0, 0, w, h);
}

// The shadow a thing on the desk casts: the same shape, a few pixels down and to the right, in
// one hard edge -- a shadow drawn, not a blur computed every frame.
const SHADOW = 'rgba(0,0,0,0.34)';

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

// The lines a plan's words wrap to on the desk, measured once for the size the desk was last drawn
// at and kept with the plan: the words do not change from frame to frame, so neither do their
// lines.
const measured = new WeakMap();
function linesFor(plan, w, h, make) {
  const got = measured.get(plan);
  if (got && got.w === w && got.h === h) return got.lines;
  const lines = make();
  measured.set(plan, { w, h, lines });
  return lines;
}

// An index card, ruled, with its centre at the origin: `age` yellows it, `rows` is how many rules
// it is ruled for (the first rule is the red one). The configuration's density says how closely a
// card the words do not fill is ruled -- the cabinet's card of clues and the five catalogue cards --
// as it says how closely a specimen in the drawer is marked.
function card(g, c, cw, ch, age, rows) {
  const k = c.colors;
  g.fillStyle = SHADOW;
  g.fillRect(-cw / 2 + 2, -ch / 2 + 4, cw, ch);
  g.fillStyle = c.mix(c.mix(k.bg, k.fg, 0.08), k.accent2, age * 0.14);
  g.fillRect(-cw / 2, -ch / 2, cw, ch);
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

// The specimen at the origin: its body in `fill`, with its shadow under it.
function specimen(g, c, kind, r, fill) {
  g.save();
  g.translate(1, 3);
  outline(g, kind, r);
  g.fillStyle = SHADOW;
  g.fill();
  g.restore();
  outline(g, kind, r);
  g.fillStyle = fill;
  g.fill();
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
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const got = (since, span) => came(s.t, since, span, reduced);
  deskTop(g, w, h, env);
  // The cabinet: four drawer fronts, top to bottom.
  g.fillStyle = env.mix(k.bg, k.bg2, 0.8);
  g.fillRect(geo.x - geo.cw * 0.04, geo.y - geo.slot * 0.12, geo.cw * 1.08, geo.ch + geo.slot * 0.24);
  const size = Math.max(9, Math.min(16, geo.slot * 0.26));
  for (let slot = 0; slot < 4; slot++) {
    const y = geo.y + slot * geo.slot;
    g.fillStyle = env.mix(k.bg2, k.accent2, 0.12 + slot * 0.03);
    g.fillRect(geo.x, y + geo.slot * 0.04, geo.cw, geo.slot * 0.92);
    g.fillStyle = env.alpha(k.fg, 0.08);
    g.fillRect(geo.x, y + geo.slot * 0.04, geo.cw, 1);
    g.fillStyle = env.alpha(k.accent2, 0.6);
    g.fillRect(geo.x + geo.cw * 0.78, y + geo.slot * 0.5 - 2, geo.cw * 0.12, 4);
    write(g, DRAWERS[slot], geo.x + geo.cw * 0.34, y + geo.slot * 0.68, size * 0.8, env.alpha(k.muted, 0.8), 'left', 500);
  }
  // A hinted specimen's drawer is a set surface: the mark's colour is cut across the drawer front
  // behind the piece's edge and rests there in two shades, and the dashed frame and its label are
  // cut on over it at their moment.
  for (let n = 0; n < s.hinted.length; n++) {
    const item = s.hinted[n];
    const slot = plan.order.indexOf(item);
    const y = geo.y + slot * geo.slot;
    const own = roll(rite, 0x4a + item);
    const hp = got(s.hintAt[n], SPAN);
    cover(g, env, own, geo.x, y + geo.slot * 0.04, geo.cw, geo.slot * 0.92, own.stair(hp), k.accent2, 0.22);
    if (own.flicker(hp)) {
      g.strokeStyle = env.alpha(k.accent2, 0.95);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(geo.x + 3, y + geo.slot * 0.08, geo.cw - 6, geo.slot * 0.84);
      g.setLineDash([]);
      write(g, 'the ' + names[item] + ' goes here', geo.x + geo.cw - 6, y + geo.slot * 0.88, size * 0.75, k.accent2, 'right', 600);
    }
  }
  // The specimens, each in the drawer it holds just now -- or on its way there from where it
  // stood when it was moved, landing in the treads of a roll of its own, so no two travel alike.
  for (let item = 0; item < 4; item++) {
    const slot = slotOf(s, item, rite, reduced);
    const y = geo.y + slot * geo.slot;
    g.save();
    g.translate(geo.x + geo.cw * 0.17, y + geo.slot * 0.5);
    specimen(g, env, SPECIMENS[plan.items[item]].kind, geo.slot * 0.3, env.alpha(k.accent, 0.6));
    g.restore();
    write(g, 'the ' + names[item], geo.x + geo.cw * 0.34, y + geo.slot * 0.42, size, k.fg, 'left', 600);
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
  const lines = linesFor(plan, w, h, () => {
    const out = [];
    plan.clues.forEach((clue, i) => wrap(g, clueText(clue, names), fs, cw - m * 2 - fs * 1.4).forEach((l, j) => out.push({ text: l, first: j === 0, n: i + 1 })));
    return out;
  });
  const rows = Math.max(Math.round(6 * v.density), lines.length + 2);
  card(g, env, cw, ch, 0.3, rows);
  const rh = ch / rows;
  const fsz = Math.min(fs, rh * 0.66);
  write(g, plan.number + ' / the drawer', -cw / 2 + m + 2, -ch / 2 + rh * 0.5, fsz, k.accent2, 'left', 700);
  lines.forEach((l, i) => {
    if (l.first) write(g, l.n + '.', -cw / 2 + m + 2, -ch / 2 + rh * (i + 1.5), fsz, k.accent2, 'left', 600);
    write(g, l.text, -cw / 2 + m + 2 + fsz * 1.3, -ch / 2 + rh * (i + 1.5), fsz, k.fg, 'left', 500);
  });
  g.restore();
  // Over a solved cabinet the lock's colour is cut across the desk behind the piece's edge and
  // rests in two shades, and "filed" is cut on over the cabinet: never a wash that fades in.
  if (s.solvedAt >= 0) {
    const sp = got(s.solvedAt, REVEAL);
    wash(g, env, rite, w, h, sp, k.accent2, 0.14);
    if (roll(rite, 0x7e).flicker(sp)) write(g, 'FILED', geo.x + geo.cw / 2, geo.y - geo.slot * 0.3, size, k.accent2, 'center', 700);
  }
}

// Where a specimen stands at s.t, in drawers from the top (fractional on its way): it set off
// from `from` -- where it stood when the order was last changed -- at orderAt, and lands in the
// drawer the order now gives it.
function slotOf(s, item, rite, reduced) {
  const to = s.order.indexOf(item);
  const from = s.from[item];
  const p = came(s.t, s.orderAt, TRAVEL, reduced);
  return p >= 1 || from == null ? to : from + (to - from) * roll(rite, 0x2d + item).ease(p);
}

// The cabinet before anyone has touched it. `from` is where each specimen set off from, `until`
// the end of the last movement in flight and `drawn` the last picture frame() drew.
function drawerBlank(plan) {
  return { order: plan.start.slice(), from: [0, 1, 2, 3].map((item) => plan.start.indexOf(item)), orderAt: -1, hinted: [], hintAt: [], solvedAt: -1, t: 0, until: -Infinity, drawn: null };
}

function drawerPreview(g, w, h, env, plan) {
  drawCabinet(g, w, h, env, plan, drawerBlank(plan), scenery(env), env.variant);
}

function drawerPiece(env, plan) {
  const names = plan.items.map((i) => SPECIMENS[i].name);
  const helps = asked(env).helps;
  const look = scenery(env);
  const s = drawerBlank(plan);
  const draw = (c) => {
    drawCabinet(c.g, c.w, c.h, c, plan, s, look, env.variant);
    seen(s, c);
  };
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
        const order = value.map(Number);
        if (order.some((item, i) => item !== s.order[i])) {
          // Each specimen sets off from where it stands now, on its way or not.
          s.from = [0, 1, 2, 3].map((item) => slotOf(s, item, riteOf(c), c.reduced));
          s.orderAt = s.t;
          s.order = order;
          busy(s, c, TRAVEL);
        }
        c.status('top to bottom: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.order.find((item) => !s.hinted.includes(item) && s.order.indexOf(item) !== plan.order.indexOf(item))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt.push(s.t);
          busy(s, c, SPAN);
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
    // The clock moves every frame; the desk is drawn only while something is on its way, or when
    // the canvas has been sized again. A desk at rest is not drawn at all.
    frame(t, dt, c) {
      if (!c.reduced) s.t += Math.max(0, Number(dt) || 0);
      if (due(s, c)) draw(c);
    },
    end(c) {
      s.solvedAt = s.t;
      busy(s, c, REVEAL);
      c.status(plan.number + ': ' + s.order.map((i) => names[i]).join(' over ') + '. filed; none of it exists');
      draw(c);
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

// A specimen of the six: its body, its marking clipped to it, its legs beneath. `density` (the
// configuration's) is how closely its stripes or spots are set: striped is striped either way.
function creature(g, c, spec, r, density) {
  const pitch = 1 / Math.max(0.7, Math.min(1.4, density || 1));
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
  g.save();
  g.translate(1, 2);
  bodyPath(g, spec.body, r);
  g.fillStyle = SHADOW;
  g.fill();
  g.restore();
  bodyPath(g, spec.body, r);
  g.fillStyle = c.mix(k.bg2, k.accent, 0.55);
  g.fill();
  if (spec.marking !== 'plain') {
    g.save();
    bodyPath(g, spec.body, r);
    g.clip();
    g.fillStyle = c.alpha(k.accent2, 0.85);
    if (spec.marking === 'striped') {
      for (let x = -r * 1.1; x <= r * 1.1; x += r * 0.4 * pitch) g.fillRect(x, -r * 1.3, r * 0.16, r * 2.6);
    } else {
      const step = r * 0.5 * pitch;
      for (let y = -r * 1.05; y <= r * 1.1; y += step) {
        for (let x = -r * 0.95; x <= r * 1; x += step) {
          g.beginPath();
          g.arc(x + (Math.round(y / step) % 2 ? step / 2 : 0), y, r * 0.11, 0, Math.PI * 2);
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
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const got = (since, span) => came(s.t, since, span, reduced);
  const revealP = got(s.solvedAt, REVEAL);
  const opened = s.reveal && rite.flicker(revealP);
  const framed = showing(s.framed, s.t, SPAN, reduced);
  deskTop(g, w, h, env);
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
    const own = roll(rite, 0x51 + i);
    const bx = cx - geo.cw * 0.44;
    const by = cy - geo.ch * 0.38;
    const bw = geo.cw * 0.88;
    const bh = geo.ch * 0.84;
    // The picked specimen's bed is a set surface: it is cut in behind the piece's edge and rests in
    // two shades, and the bed of the one picked before it is given back the way it came, each from
    // where it stands; the dashed frame moves to the new pick in one cut at its moment.
    cover(g, env, own, bx, by, bw, bh, standing(s.beds[i], s.t, SPAN, reduced, own), k.accent2, 0.2);
    // The one that breaks the rule, once the drawer is solved, is cut in in the lock's colour.
    if (s.reveal && i === plan.odd) cover(g, env, own, bx, by, bw, bh, own.stair(revealP), k.accent, 0.32);
    if (framed === i) {
      g.strokeStyle = env.alpha(k.accent2, 0.9);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(bx, by, bw, bh);
      g.setLineDash([]);
    }
    g.save();
    g.translate(cx, cy);
    creature(g, env, spec, r, v.density);
    g.restore();
    write(g, String(i + 1), cx, cy + geo.ch * 0.4, size, k.accent2, 'center', 700);
    // A specimen the drawer has vouched for: a rule of the lock's colour is drawn in under its
    // number behind the piece's edge, and "keeps" is cut on beside it.
    const vouched = s.vouched.indexOf(i);
    if (vouched >= 0) {
      const vp = got(s.vouchAt[vouched], SPAN);
      own.paint(g, cx - geo.cw * 0.3, cy + geo.ch * 0.33, geo.cw * 0.6, Math.max(3, geo.ch * 0.03), own.stair(vp), env.alpha(k.accent, 0.5));
      if (own.flicker(vp)) write(g, 'keeps', cx + size * 0.9, cy + geo.ch * 0.4, size * 0.75, env.alpha(k.fg, 0.8), 'left', 500);
    }
  });
  // The rule, pinned to the drawer on an index card.
  const cw = w * 0.76;
  const ch = h * 0.24;
  const fs = Math.max(9, Math.min(16, Math.min(w, h) * 0.036));
  g.save();
  g.translate(w / 2 + (v.turn - 0.5) * w * 0.02, h * 0.81);
  g.rotate(look.tilt * 0.6 + (v.turn - 0.5) * 0.04);
  card(g, env, cw, ch, 0.25, 3);
  const m = Math.min(10, cw * 0.06);
  write(g, plan.number + ' / the rule of this drawer', -cw / 2 + m + 2, -ch / 2 + ch / 6, fs * 0.85, k.accent2, 'left', 700);
  write(g, ruleText(plan.rule), -cw / 2 + m + 2, -ch / 2 + ch / 2, fs, k.fg, 'left', 600);
  // The card's last line: the verdict is cut on in place of what the visitor said, which was cut
  // on in place of the card's own line -- or of what they said before -- each at its moment.
  const sayVal = showing(s.said, s.t, SPAN, reduced);
  const feature = FEATURES.find((f) => f.value === sayVal);
  const said = feature ? 'the rule disputes ' + feature.label + ', you say' : null;
  const line = opened ? 'specimen ' + (plan.odd + 1) + ' does not: ' + describe(plan.specs[plan.odd]) : said || 'five of the six keep it; one does not';
  write(g, line, -cw / 2 + m + 2, -ch / 2 + ch * 5 / 6, fs * 0.85, opened ? k.accent : said ? k.fg : k.muted, 'left', 500);
  g.restore();
  if (s.reveal) wash(g, env, rite, w, h, revealP, k.accent2, 0.1);
}

// The drawer before anyone has touched it. `beds` holds each picked bed's movement, `framed` and
// `said` the frame round the pick and the visitor's words, each replaced in one cut; `until` is the
// end of the last movement in flight and `drawn` the last picture frame() drew.
function oddBlank() {
  return { pick: -1, beds: [], framed: null, picks: 0, choice: null, said: null, choices: 0, vouched: [], vouchAt: [], reveal: false, solvedAt: -1, t: 0, until: -Infinity, drawn: null };
}

function oddPreview(g, w, h, env, plan) {
  drawTray(g, w, h, env, plan, oddBlank(), scenery(env), env.variant);
}

function oddPiece(env, plan) {
  const look = scenery(env);
  const helps = asked(env).helps;
  const keepers = plan.specs.map((spec, i) => i).filter((i) => i !== plan.odd);
  const s = oddBlank();
  const draw = (c) => {
    drawTray(c.g, c.w, c.h, c, plan, s, look, env.variant);
    seen(s, c);
  };
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
        const pick = picked.length === 1 ? picked[0] : -1;
        if (pick !== s.pick) {
          // The bed given back and the bed picked each go from where they stand; the frame moves
          // over in one cut, on a roll for this pick.
          const rite = riteOf(c);
          for (const j of [s.pick, pick]) if (j >= 0) s.beds[j] = move(s.beds[j], j === pick ? 1 : 0, s.t, SPAN, c.reduced, roll(rite, 0x51 + j));
          s.picks += 1;
          s.framed = replace(s.framed, pick, s.t, SPAN, c.reduced, rite.at(0x3f00 + s.picks));
          s.pick = pick;
          busy(s, c, SPAN);
        }
        if (s.pick >= 0) c.status('specimen ' + (s.pick + 1) + ': ' + describe(plan.specs[s.pick]));
      }
      if (id === 'choice') {
        const f = FEATURES.find((o) => o.value === value);
        if (f) {
          if (f.value !== s.choice) {
            s.choices += 1;
            s.said = replace(s.said, f.value, s.t, SPAN, c.reduced, riteOf(c).at(0x1c00 + s.choices));
            busy(s, c, SPAN);
          }
          s.choice = f.value;
          c.status('the rule disputes ' + f.label + ', you say');
        }
      }
      if (id === 'hint') {
        const next = s.vouched.length < helps ? keepers.find((i) => !s.vouched.includes(i)) : undefined;
        if (next !== undefined) {
          s.vouched.push(next);
          s.vouchAt.push(s.t);
          busy(s, c, SPAN);
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
    // As at the cabinet: drawn only while something is on its way or the canvas is sized again.
    frame(t, dt, c) {
      if (!c.reduced) s.t += Math.max(0, Number(dt) || 0);
      if (due(s, c)) draw(c);
    },
    end(c) {
      s.reveal = true;
      s.solvedAt = s.t;
      busy(s, c, REVEAL);
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
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const got = (since, span) => came(s.t, since, span, reduced);
  const revealP = got(s.solvedAt, REVEAL);
  const opened = s.reveal && rite.flicker(revealP);
  const framed = showing(s.framed, s.t, SPAN, reduced);
  const foot = showing(s.foot, s.t, SPAN, reduced);
  deskTop(g, w, h, env);
  const cw = Math.min(w * 0.3, h * 0.42) * v.scale;
  const ch = cw * 0.62;
  const fs = Math.max(9, Math.min(18, cw * 0.14));
  const ruled = Math.max(3, Math.round(4 * v.density));
  // Five cards fanned across the desk, each with its number. The picked one lifts off the desk
  // on its stair's treads (and the one picked before it settles back down them, each from where it
  // stands), its face is cut in behind the piece's edge as a set surface and rests in two shades,
  // and the dashed frame moves to it in one cut at its moment.
  plan.numbers.forEach((number, i) => {
    const x = w * (0.16 + 0.17 * i) + (v.turn - 0.5) * w * 0.03;
    const y = h * (0.3 + (i % 2) * 0.18);
    const own = roll(rite, 0x61 + i);
    const lift = standing(s.lifts[i], s.t, SPAN, reduced, own);
    g.save();
    g.translate(x, y - ch * 0.12 * lift);
    g.rotate(look.tilt + (i - 2) * 0.06 + (v.turn - 0.5) * 0.05);
    card(g, env, cw, ch, 0.25, ruled);
    cover(g, env, own, -cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6, lift, k.accent2, 0.18);
    // The forgery, once it is found, is cut in in the lock's colour.
    if (s.reveal && i === plan.odd) cover(g, env, own, -cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6, own.stair(revealP), k.accent, 0.3);
    if (framed === i) {
      g.strokeStyle = env.alpha(k.accent2, 0.95);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(-cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6);
      g.setLineDash([]);
    }
    const m = Math.min(10, cw * 0.06);
    write(g, 'card ' + (i + 1), -cw / 2 + m + 2, -ch / 2 + ch / 8, fs * 0.65, env.alpha(k.muted, 0.9), 'left', 500);
    write(g, 'APC-' + number, -cw / 2 + m + 2, -ch / 2 + ch * 0.5, fs, opened && i === plan.odd ? k.accent : k.accent2, 'left', 700);
    // The card's foot: the verdict, cut on at its moment; before it, what the visitor says the
    // picked card should end in -- replaced in one cut when they say another digit or pick another
    // card, the old words standing until the new ones' moment -- or "keeps the rule" over a rule
    // drawn in behind the piece's edge on a card the desk has vouched for, cut on at its own.
    const vouched = s.vouched.indexOf(i);
    if (opened && i === plan.odd) {
      write(g, 'should end in ' + plan.digit, -cw / 2 + m + 2, -ch / 2 + ch * 0.8, fs * 0.65, k.accent, 'left', 600);
    } else if (foot && foot.card === i) {
      write(g, 'ends in ' + foot.digit + ', you say', -cw / 2 + m + 2, -ch / 2 + ch * 0.8, fs * 0.65, k.fg, 'left', 500);
    } else if (vouched >= 0) {
      const vp = got(s.vouchAt[vouched], SPAN);
      own.paint(g, -cw / 2 + m + 2, -ch / 2 + ch * 0.9, cw * 0.6, Math.max(2, ch * 0.03), own.stair(vp), env.alpha(k.accent, 0.5));
      if (own.flicker(vp)) write(g, 'keeps the rule', -cw / 2 + m + 2, -ch / 2 + ch * 0.8, fs * 0.65, env.alpha(k.fg, 0.85), 'left', 500);
    }
    g.restore();
  });
  // The rule, on a slip along the bottom of the desk.
  const sw = w * 0.84;
  const sh = h * 0.24;
  const rs = Math.max(9, Math.min(15, Math.min(w, h) * 0.034));
  const m = Math.min(10, sw * 0.06);
  const [rule, example] = linesFor(plan, w, h, () => [
    wrap(g, 'a true number ends in the last digit of the sum of its first three digits', rs, sw - m * 2 - 4),
    wrap(g, 'so 4172 is true: 4 + 1 + 7 = 12, and it ends in 2. one card on the desk is forged', rs, sw - m * 2 - 4)
  ]);
  const lines = [{ text: 'the rule of the desk', color: k.accent2, weight: 700 }];
  rule.forEach((l) => lines.push({ text: l, color: k.fg, weight: 500 }));
  example.forEach((l) => lines.push({ text: l, color: k.muted, weight: 500 }));
  const rows = lines.length;
  const rh = sh / rows;
  g.save();
  g.translate(w / 2, h * 0.86);
  g.rotate(-look.tilt * 0.5);
  card(g, env, sw, sh, 0.1, rows);
  lines.forEach((l, i) => write(g, l.text, -sw / 2 + m + 2, -sh / 2 + rh * (i + 0.5), Math.min(rs, rh * 0.66), l.color, 'left', l.weight));
  g.restore();
  if (s.reveal) wash(g, env, rite, w, h, revealP, k.accent2, 0.1);
}

// The fan before anyone has touched it. `lifts` holds each picked card's movement, `framed` and
// `foot` the frame round the pick and the visitor's words on it, each replaced in one cut; `until`
// is the end of the last movement in flight and `drawn` the last picture frame() drew.
function forgedBlank() {
  return { pick: -1, lifts: [], framed: null, picks: 0, digit: null, foot: null, says: 0, vouched: [], vouchAt: [], reveal: false, solvedAt: -1, t: 0, until: -Infinity, drawn: null };
}

function forgedPreview(g, w, h, env, plan) {
  drawFan(g, w, h, env, plan, forgedBlank(), scenery(env), env.variant);
}

function forgedPiece(env, plan) {
  const look = scenery(env);
  const helps = asked(env).helps;
  const trueCards = plan.numbers.map((n, i) => i).filter((i) => i !== plan.odd);
  const s = forgedBlank();
  const draw = (c) => {
    drawFan(c.g, c.w, c.h, c, plan, s, look, env.variant);
    seen(s, c);
  };
  // What the visitor says, on the card they picked, replaced in one cut on a roll for this saying.
  function say(c) {
    s.says += 1;
    const now = s.pick >= 0 && s.digit !== null ? { card: s.pick, digit: s.digit } : null;
    s.foot = replace(s.foot, now, s.t, SPAN, c.reduced, riteOf(c).at(0x1d00 + s.says));
    busy(s, c, SPAN);
  }
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
        const pick = picked.length === 1 ? picked[0] : -1;
        if (pick !== s.pick) {
          // The card put down and the card picked up each go from where they stand; the frame and
          // the words on the pick move over in one cut.
          const rite = riteOf(c);
          for (const j of [s.pick, pick]) if (j >= 0) s.lifts[j] = move(s.lifts[j], j === pick ? 1 : 0, s.t, SPAN, c.reduced, roll(rite, 0x61 + j));
          s.picks += 1;
          s.framed = replace(s.framed, pick, s.t, SPAN, c.reduced, rite.at(0x3f00 + s.picks));
          s.pick = pick;
          busy(s, c, SPAN);
          if (s.digit !== null) say(c);
        }
        if (s.pick >= 0) c.status('card ' + (s.pick + 1) + ', APC-' + plan.numbers[s.pick] + ', you say');
      }
      if (id === 'digit') {
        const digit = Number(value);
        if (Number.isFinite(digit) && digit !== s.digit) {
          s.digit = digit;
          say(c);
        }
        c.status('it should end in ' + Number(value) + ', you say');
      }
      if (id === 'hint') {
        const next = s.vouched.length < helps ? trueCards.find((i) => !s.vouched.includes(i)) : undefined;
        if (next !== undefined) {
          s.vouched.push(next);
          s.vouchAt.push(s.t);
          busy(s, c, SPAN);
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
    // As at the cabinet: drawn only while something is on its way or the canvas is sized again.
    frame(t, dt, c) {
      if (!c.reduced) s.t += Math.max(0, Number(dt) || 0);
      if (due(s, c)) draw(c);
    },
    end(c) {
      s.reveal = true;
      s.solvedAt = s.t;
      busy(s, c, REVEAL);
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
