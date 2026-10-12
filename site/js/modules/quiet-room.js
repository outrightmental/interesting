/* The quiet room: a ring that breathes, a dim room of lamps, and a shelf with a few keepsakes on
   it. As a card it is the ring, caught still at one point of its breath (paint), or one of the
   four puzzles below (spark); as a piece it is one of those puzzles, and the card it was opened
   from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles, each read from what happens in the room:

     the dark room   Lights Out. A square of lamps, some lit; pressing one flips it and its four
                     neighbours. Put every lamp out. The room is made by pressing lamps in a dark
                     room, so every puzzle has a solution, and at three by three and four by four
                     the solution is unique. The scene is the control: tap a lamp to press it, and
                     the rail's grid keeps the record.
     the shelf       An ordering puzzle. Four or five keepsakes go on a shelf left to right, and a
                     few clues say how they stand -- left of, next to, at an end, two apart. The
                     clues are drawn from the true order and pruned until exactly one order fits
                     them all. A wrong check says how many stand in the right place and no more.
                     Tap two keepsakes to swap them, or a clue to read it. A hint names the clues
                     that establish a keepsake's place; all clues also stand in the piece's brief.
     the second look Two views of nine lamps, before and after someone pressed exactly two
                     switches. Find those switches and the row where most lamps changed. The
                     same neighbour-flipping rule applies; the views are on screen together.
     the turned pane One switch was pressed, but the after view was turned. Compare the two
                     panes to find the switch and the turn; some panes hold sixteen lamps.

   A card and the feature it opens as are one puzzle: the spark puts the whole puzzle on its spec
   as `of` -- the lamps that were pressed, the shelf's order and clues -- and piece(env) opens on
   that rather than rolling another. */

const KEEPSAKES = [
  'a brass key',
  'a folded note',
  'a smooth stone',
  'a spool of blue thread',
  'a ticket stub',
  'a tiny bell',
  'a sprig of rosemary',
  'a snapped pencil',
  'a blank matchbook',
  'a cracked shell',
  'a coin from nowhere',
  'a wooden bead'
];

const SHORT = {
  'a brass key': 'key',
  'a folded note': 'note',
  'a smooth stone': 'stone',
  'a spool of blue thread': 'thread',
  'a ticket stub': 'stub',
  'a tiny bell': 'bell',
  'a sprig of rosemary': 'rosemary',
  'a snapped pencil': 'pencil',
  'a blank matchbook': 'matchbook',
  'a cracked shell': 'shell',
  'a coin from nowhere': 'coin',
  'a wooden bead': 'bead'
};

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
const PLAIN = { density: 1, scale: 1, turn: 0 };

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
   js/stage.js, "The rite"). Nothing drawn here glides, and everything goes one way: a state that
   changes climbs rite.stair, a hold and then a few even treads; a keepsake that changes places
   travels in rite.ease's landing, the first tread the longest, and carries its name with it; a
   small mark that arrives -- a switch mark, a ring round a shown lamp, a caption's new words -- is
   cut on at the one moment rite.flicker rolls, and stays; a surface that becomes set -- a lamp lit,
   a switch marked, a slot shown, the dark over a solved room -- comes in by its AREA behind the
   piece's one edge (rite.paint: a slice at its angle or a curve from its corner, one path), and
   one taken back goes out behind the same edge, the region shrinking. The one thing that changes
   by its brightness is the light the lamps throw on the ceiling, and it steps to the new light on
   the stair's treads, never a slide. Every change is read against the piece's own clock, s.t,
   which frame() advances: a change made at `since` has come came() of its way, which is 1 at once
   for a visitor who asked for less motion, and for whatever stood there from the start
   (since < 0). Each lamp, slot or line moves on a roll of its own (rite.at, rolled once and kept):
   the same edge, with its own treads and its own moment. And the scene is drawn only while
   something on it is moving (tick): a room at rest is the picture already on the canvas, and
   frame() says so, so the stage asks for no frame until something moves it again. */

// What stands in for a rite on an env that carries none: every movement already at its end, and
// a surface painted whole.
const STILL = {
  ease: () => 1, stair: () => 1, flicker: () => 1,
  paint(g, x, y, w, h, k, style) {
    if (!(k > 0)) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w, h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The roll of one thing the piece moves -- a lamp, a slot, a keepsake -- rolled the first time it is
// asked for and kept: a rite and a seed always roll the same, so a frame looks it up rather than
// rolling it again.
const rolls = new WeakMap();
function rollFor(rite, seed) {
  let held = rolls.get(rite);
  if (!held) rolls.set(rite, (held = new Map()));
  let roll = held.get(seed);
  if (!roll) held.set(seed, (roll = rite.at(seed)));
  return roll;
}

// A change made now keeps the scene drawing for `span` seconds of the piece's clock: the length of
// the longest movement it starts.
function stir(s, span) {
  s.until = Math.max(s.until, s.t + span);
}

function sizeOf(c) {
  return c.w + 'x' + c.h + 'x' + c.dpr;
}

// One frame of a piece. The scene is drawn only while a movement on it is under way -- up to the
// first frame past its end, so the picture left standing is the landed one -- or when the stage has
// sized the canvas again, which clears it. What it answers is whether anything is still on its way
// once this frame is drawn: false when the room is at rest, which tells the stage to stop asking
// for frames until the visitor does something, the canvas is sized again or the scene comes back
// into view. The clock stands still while no frames come, and nothing here waits on it then: every
// movement starts from a press, a knob or the end, each of which wakes the frames again.
function tick(s, dt, c, draw) {
  const moving = s.t <= s.until;
  s.t += dt;
  if (moving || s.size !== sizeOf(c)) draw(c);
  return s.t <= s.until;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

function fract(x) {
  return x - Math.floor(x);
}

// A surface that is not a box -- a disc, a ring -- comes in the same way a box does: its outline
// is the clip, and the piece's edge is painted across the box round it at coverage k, in the
// current fillStyle. One path a frame, whatever the size.
function within(g, rite, outline, x, y, w, h, k) {
  if (k <= 0) return;
  g.save();
  g.beginPath();
  outline(g);
  g.clip();
  rite.paint(g, x, y, w, h, k);
  g.restore();
}

// A disc that is `k` of the way to being there: solid once it is, and before that the part of it
// the piece's edge has passed.
function disc(g, rite, x, y, r, k, fill) {
  if (k <= 0) return;
  g.fillStyle = fill;
  if (k >= 1) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    return;
  }
  within(g, rite, (p) => p.arc(x, y, r, 0, Math.PI * 2), x - r, y - r, r * 2, r * 2, k);
}

// The dark that comes over a solved scene: from the moment the piece was solved it crosses the
// room behind the piece's edge in the stair's treads, and holds.
function nightfall(g, rite, w, h, p, depth) {
  rite.paint(g, 0, 0, w, h, rite.stair(p), 'rgba(5, 3, 5, ' + depth + ')');
}

const capital = (text) => text[0].toUpperCase() + text.slice(1);

// A shuffle of 0 .. n-1 from the env's stream.
function shuffled(env, n) {
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(i);
  const out = [];
  while (rest.length) out.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  return out;
}

// An opening order that is not the answer, so the piece asks something.
function startFor(env, order) {
  const n = order.length;
  let start = order.slice();
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, n);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return start;
}

/* ---- the room ------------------------------------------------------------------------------ */

const TEETH = 24;

// How full the ring's breath is on this card. The configuration's turn says where in a breath the
// card was caught, and a breath fills up the rite's stair and empties down it -- a hold, then a few
// even treads, never a cosine -- so a card stands on one of the stair's treads.
function breath(v, rite) {
  const phase = fract(v.turn);
  return phase < 0.5 ? rite.stair(phase * 2) : 1 - rite.stair((phase - 0.5) * 2);
}

// The room as a card: the ring caught still at one point of its breath, at the size the
// configuration asks for. The ring's size, its glow and the light on the floor all read that one
// breath, so the picture is one gesture caught and not three; the dial round the ring stands
// evenly spaced, turned as far as the configuration turns it.
function room(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant || PLAIN;
  const rite = riteOf(env);
  const swell = breath(v, rite);
  const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.7);
  g.addColorStop(0, env.mix(c.bg, c.accent, 0.1));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // The ring at its fullest: what the floor and the dial round the ring are measured from, so the
  // ring is drawn inside them at whatever size its breath has reached.
  const full = Math.min(w, h) * 0.28 * (v.scale || 1);
  const r = Math.min(w, h) * (0.17 + swell * 0.11) * (v.scale || 1);
  // The floor catching the light: a disc under the ring in two shades split by the piece's one
  // edge, never a wash. The whole disc is laid in the lower shade, so its round edge reads against
  // the ground, and the part the edge has passed in the upper; the edge stands near the floor's
  // middle, so both shades always read, and further across it the fuller the breath. It is laid
  // before the glow, so the ring's light falls on it.
  const reach = full * 1.45;
  ctx.fillStyle = env.alpha(c.accent2, 0.08);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, reach, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = env.alpha(c.accent2, 0.2);
  within(ctx, rite, (p) => p.arc(w / 2, h / 2, reach, 0, Math.PI * 2),
    w / 2 - reach, h / 2 - reach, reach * 2, reach * 2, 0.34 + 0.32 * swell);
  // The ring's glow and its line, as bright as the breath is full.
  const glow = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r * 1.6);
  glow.addColorStop(0, env.alpha(c.accent, 0.28 + swell * 0.2));
  glow.addColorStop(0.7, env.alpha(c.accent, 0.06));
  glow.addColorStop(1, env.alpha(c.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = env.alpha(c.accent, 0.45 + swell * 0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  // The sparks round the ring: TEETH marks on a dial just outside the ring's fullest, evenly
  // spaced and turned by the configuration's turn, so no two cards hold the dial at one angle.
  ctx.strokeStyle = env.alpha(c.accent2, 0.5 + swell * 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < TEETH; i++) {
    const a = (v.turn + i / TEETH) * Math.PI * 2;
    ctx.moveTo(w / 2 + Math.cos(a) * full * 1.1, h / 2 + Math.sin(a) * full * 1.1);
    ctx.lineTo(w / 2 + Math.cos(a) * full * 1.2, h / 2 + Math.sin(a) * full * 1.2);
  }
  ctx.stroke();
}

// The dark ground of the room with no ring: what the puzzles are drawn on.
function floor(g, w, h, env) {
  const c = env.colors;
  const ground = g.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.8);
  ground.addColorStop(0, env.mix(c.bg, c.bg2, 0.55));
  ground.addColorStop(1, c.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

function caption(g, w, h, env, text, y, a, size) {
  if (!text || a <= 0) return;
  g.fillStyle = env.alpha(env.colors.fg, a);
  g.font = '500 ' + (size || Math.max(12, Math.round(Math.min(w, h) * 0.042))) + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, y);
}

/* ---- the dark room: lights out ------------------------------------------------------------- */

function neighbours(i, n) {
  const x = i % n;
  const y = Math.floor(i / n);
  const out = [i];
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  return out;
}

// The lamps a set of presses lights in a dark room: each press flips itself and its neighbours.
function litBy(presses, n) {
  const lamps = new Array(n * n).fill(0);
  for (const i of presses) for (const j of neighbours(i, n)) lamps[j] ^= 1;
  return lamps;
}

function lampsPlan(env) {
  const n = env.pick([3, 4, 4]);
  for (let attempt = 0; attempt < 12; attempt++) {
    const k = env.int(n, n + 2);
    const pool = [];
    for (let i = 0; i < n * n; i++) pool.push(i);
    const presses = [];
    while (presses.length < k && pool.length) presses.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
    presses.sort((a, b) => a - b);
    const lit = litBy(presses, n);
    if (lit.some(Boolean)) return { kind: 'lamps', n, presses };
  }
  return { kind: 'lamps', n, presses: [0] };
}

function carriedLamps(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'lamps') return null;
  const n = Number(p.n);
  if (![3, 4, 5].includes(n)) return null;
  if (!Array.isArray(p.presses) || !p.presses.length || p.presses.length > n * n) return null;
  const presses = p.presses.map(Number);
  if (!presses.every((i) => Number.isInteger(i) && i >= 0 && i < n * n)) return null;
  if (new Set(presses).size !== presses.length) return null;
  const sorted = presses.slice().sort((a, b) => a - b);
  if (!litBy(sorted, n).some(Boolean)) return null;
  return { kind: 'lamps', n, presses: sorted };
}

function lampsTitle(plan) {
  return 'the dark room: ' + plan.n + ' by ' + plan.n;
}

function lampsBrief(plan) {
  const count = litBy(plan.presses, plan.n).filter(Boolean).length;
  return 'A vigil to be put out. Press a lamp and it flips itself and the lamps above, below, left and right of it. '
    + (count === 1 ? 'One lamp is lit.' : capital(WORDS[count]) + ' lamps are lit.');
}

// Where the lamps sit in the scene: a square in the middle, `cell` wide each.
function lampGeometry(w, h, n) {
  const side = Math.min(w, h) * 0.74;
  return { side, cell: side / n, left: (w - side) / 2, top: h * 0.46 - side / 2 };
}

// The room's state as it opens: the lamps as given, nothing pressed, nothing shown, and every
// change timed against the piece's clock from here on (-1 is "there from the start"); nothing is
// moving (until) and nothing has been drawn yet (size).
function lampState(plan, lamps) {
  const N = plan.n * plan.n;
  return {
    lamps, presses: new Array(N).fill(0), hinted: [], t: 0, until: -1, size: '',
    changedAt: new Array(N).fill(-1), markAt: new Array(N).fill(-1), hintAt: new Array(N).fill(-1),
    countAt: -1, countWas: null, doneAt: -1
  };
}

function drawLamps(g, w, h, env, plan, s, variant) {
  const n = plan.n;
  const geo = lampGeometry(w, h, n);
  const lamps = s.lamps;
  const litCount = lamps.filter(Boolean).length;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  floor(g, w, h, env);
  nightfall(g, rite, w, h, s.doneAt >= 0 ? came(s, s.doneAt, 2.4, reduced) : 0, 0.85);
  const c = env.colors;
  // The lit lamps light the room: the more of them, the more of the ceiling shows. When the count
  // changes, the ceiling's light steps to its new brightness in the stair's treads: a change of
  // brightness in a few steps, never a slide.
  const ceiling = (count) => 0.06 + 0.1 * (count / (n * n));
  const was = s.countWas == null ? litCount : s.countWas;
  const lightNow = ceiling(was) + (ceiling(litCount) - ceiling(was)) * rite.stair(came(s, s.countAt, 0.7, reduced));
  if (litCount || was) {
    const wash = g.createRadialGradient(w / 2, geo.top + geo.side / 2, 0, w / 2, geo.top + geo.side / 2, geo.side);
    wash.addColorStop(0, env.alpha(c.accent2, lightNow));
    wash.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);
  }
  const v = variant || PLAIN;
  for (let i = 0; i < n * n; i++) {
    const x = geo.left + (i % n + 0.5) * geo.cell;
    const y = geo.top + (Math.floor(i / n) + 0.5) * geo.cell;
    const r = geo.cell * 0.3 * Math.min(1.1, Math.max(0.85, v.scale));
    const lit = !!lamps[i];
    const own = rollFor(rite, i + 1);
    // How far this lamp's light has come: a lamp lit fills behind the piece's edge in its stair's
    // treads, and its glow reaches out in the same treads; one put out goes the same way back, the
    // lit part shrinking behind the edge and the glow drawing in.
    const p = came(s, s.changedAt[i], 0.9, reduced);
    const k = lit ? own.stair(p) : 1 - own.stair(p);
    if (k > 0) {
      const reach = r * (1.2 + k);
      const glow = g.createRadialGradient(x, y, r * 0.3, x, y, reach);
      glow.addColorStop(0, env.alpha(c.accent2, 0.55));
      glow.addColorStop(1, env.alpha(c.accent2, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, reach, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = env.alpha(c.muted, 0.18);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    disc(g, rite, x, y, r, k, env.mix(c.accent2, c.fg, 0.35));
    const rim = k >= 0.5;
    g.strokeStyle = env.alpha(rim ? c.accent2 : c.muted, rim ? 0.9 : 0.45);
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    // A pressed lamp carries a small switch mark under it, so the record is on the scene too. It
    // is cut on at the lamp's own moment, and cut off once at that moment when the press is taken
    // back.
    const mp = came(s, s.markAt[i], 0.6, reduced);
    if (s.presses[i] ? own.flicker(mp) : (mp < 1 && !own.flicker(mp))) {
      g.fillStyle = env.alpha(c.accent, 0.95);
      g.beginPath();
      g.arc(x, y + r * 1.45, Math.max(2, geo.cell * 0.06), 0, Math.PI * 2);
      g.fill();
    }
    if (s.hinted.includes(i) && !s.presses[i]) {
      // The ring round a lamp the room has shown: it is cut on at the lamp's own moment and widens
      // in its stair's treads.
      const hp = came(s, s.hintAt[i], 1, reduced);
      if (own.flicker(hp)) {
        g.strokeStyle = env.alpha(c.accent, 0.95);
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.arc(x, y, r * (1.15 + 0.35 * own.stair(hp)), 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
    }
  }
  // The frame of the room's floor, drawn a little differently by the configuration.
  g.strokeStyle = env.alpha(c.muted, 0.25);
  g.lineWidth = 1;
  const inset = geo.cell * 0.1 * v.density;
  g.strokeRect(geo.left - inset, geo.top - inset, geo.side + inset * 2, geo.side + inset * 2);
  // The count under the room: the old words stand until the rite's moment and are cut over to the
  // new ones there, once, never through a blank.
  const counted = rite.flicker(came(s, s.countAt, 0.7, reduced)) ? litCount : was;
  const words = counted === 0 ? 'dark' : (counted === 1 ? 'one lamp lit' : WORDS[counted] + ' lamps lit');
  caption(g, w, h, env, words, h * 0.93, 0.8);
}

function lampsPreview(g, w, h, env, plan) {
  drawLamps(g, w, h, env, plan, lampState(plan, litBy(plan.presses, plan.n)), env.variant);
}

function lampsPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.n;
  const N = n * n;
  const lit0 = litBy(plan.presses, n);
  const solution = new Array(N).fill(0);
  for (const i of plan.presses) solution[i] = 1;
  const s = lampState(plan, lit0.slice());
  function burning(lamps) {
    return (lamps || s.lamps).filter(Boolean).length;
  }
  // The room as it stands, taken before a change so that every lamp, mark and count that the
  // change moves is timed from the moment it moved.
  function stood() {
    return { lamps: s.lamps.slice(), presses: s.presses.slice(), count: burning() };
  }
  // The lamps still lit once `presses` have been made in the room as it opened.
  function lampsAfter(presses) {
    const pressed = [];
    for (let i = 0; i < N; i++) if (presses[i]) pressed.push(i);
    const flipped = litBy(pressed, n);
    return lit0.map((on, i) => on ^ flipped[i]);
  }
  function relight(before) {
    s.lamps = lampsAfter(s.presses);
    for (let i = 0; i < N; i++) {
      if (before.lamps[i] !== s.lamps[i]) s.changedAt[i] = s.t;
      if (before.presses[i] !== s.presses[i]) s.markAt[i] = s.t;
    }
    const count = burning();
    if (count !== before.count) {
      s.countWas = before.count;
      s.countAt = s.t;
    }
    stir(s, 0.9); // a lamp's light, which outlasts its mark and the count
  }
  // The record as the rail holds it, which is what the check judges; the scene's own copy stands
  // in where the rail has nothing to say.
  function pressesNow(c) {
    const v = c.value('presses');
    return Array.isArray(v) && v.length === N ? v.map((on) => (on ? 1 : 0)) : s.presses;
  }
  function litLine(left) {
    return left === 0 ? 'the room looks dark' : left === 1 ? 'one lamp lit' : WORDS[left] + ' lamps lit';
  }
  function place(i) {
    return 'row ' + (Math.floor(i / n) + 1) + ', column ' + ((i % n) + 1);
  }
  const draw = (c) => {
    s.size = sizeOf(c);
    drawLamps(c.g, c.w, c.h, c, plan, s, env.variant);
  };
  return {
    title: lampsTitle(plan),
    brief: lampsBrief(plan),
    goal: 'Put every lamp out.',
    aspect: '1 / 1',
    checkLabel: 'check the room',
    steps: [
      { id: 'presses', ask: 'the lamps to press: tap them in the room, or mark them here', kind: 'grid', rows: n, cols: n, labels: ['left alone', 'pressed'] },
      { id: 'hint', ask: 'one lamp that needs pressing', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { presses: solution },
    check(c) {
      const left = burning(lampsAfter(pressesNow(c)));
      return {
        solved: left === 0,
        say: left === 0 ? 'every lamp is out; the room is dark' : (left === 1 ? 'one lamp still burns' : WORDS[left] + ' lamps still burn')
      };
    },
    start(c) {
      c.status('tap a lamp to press it');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'presses' && Array.isArray(value) && value.length === N) {
        const before = stood();
        s.presses = value.map((v) => (v ? 1 : 0));
        relight(before);
        const left = burning();
        c.status(litLine(left) + (left === 0 ? '; check it' : ''));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? solution.findIndex((on, i) => on && !s.presses[i] && !s.hinted.includes(i)) : -1;
        if (next >= 0) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          stir(s, 1);
          c.hint();
          c.status('the lamp at ' + place(next) + ' needs pressing');
        } else if (s.hinted.length >= helps) {
          c.status('that is all the room will show at this difficulty; the rest is yours');
        } else {
          c.status('every lamp that needs pressing is pressed; look for one pressed that should not be');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = lampGeometry(c.w, c.h, n);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      const row = Math.floor((y * c.h - geo.top) / geo.cell);
      if (col < 0 || col >= n || row < 0 || row >= n) {
        c.status('no lamp there; tap a lamp to press it');
        return;
      }
      const i = row * n + col;
      const before = stood();
      const next = s.presses.slice();
      next[i] = next[i] ? 0 : 1;
      s.presses = next;
      relight(before);
      c.set('presses', next);
      const left = burning();
      c.status((next[i] ? 'pressed ' : 'unpressed ') + place(i) + '; ' + litLine(left));
      draw(c);
    },
    frame(t, dt, c) {
      return tick(s, dt, c, draw);
    },
    end(c) {
      s.doneAt = s.t;
      stir(s, 2.4);
      c.status('the room is dark and the door is shut');
    }
  };
}

/* ---- the shelf: an order from clues -------------------------------------------------------- */

// A clue about where the keepsakes stand. `a` and `b` are item indices, `k` a slot (0-based).
function holds(clue, order) {
  const at = (item) => order.indexOf(item);
  const n = order.length;
  switch (clue.t) {
    case 'leftOf': return at(clue.a) < at(clue.b);
    case 'nextTo': return Math.abs(at(clue.a) - at(clue.b)) === 1;
    case 'apart': return Math.abs(at(clue.a) - at(clue.b)) === clue.d;
    case 'end': return at(clue.a) === 0 || at(clue.a) === n - 1;
    case 'notEnd': return at(clue.a) !== 0 && at(clue.a) !== n - 1;
    case 'slot': return at(clue.a) === clue.k;
    case 'notNext': return Math.abs(at(clue.a) - at(clue.b)) > 1;
    case 'between': return (at(clue.a) - at(clue.b)) * (at(clue.a) - at(clue.c)) < 0;
    default: return false;
  }
}

function clueText(clue, names) {
  const a = names[clue.a];
  const b = names[clue.b];
  switch (clue.t) {
    case 'leftOf': return 'the ' + a + ' stands somewhere left of the ' + b;
    case 'nextTo': return 'the ' + a + ' is next to the ' + b;
    case 'apart': return 'the ' + a + ' and the ' + b + ' are exactly ' + WORDS[clue.d] + ' places apart';
    case 'end': return 'the ' + a + ' is at one end';
    case 'notEnd': return 'the ' + a + ' is not at either end';
    case 'slot': return 'the ' + a + ' is ' + ORDINAL[clue.k] + ' from the left';
    case 'notNext': return 'the ' + a + ' is not next to the ' + b;
    case 'between': return 'the ' + a + ' stands somewhere between the ' + b + ' and the ' + names[clue.c];
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
    if (pa === 0 || pa === n - 1) out.push({ t: 'end', a });
    else out.push({ t: 'notEnd', a });
    out.push({ t: 'slot', a, k: pa });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const pb = order.indexOf(b);
      if (pa < pb) out.push({ t: 'leftOf', a, b });
      if (Math.abs(pa - pb) === 1 && a < b) out.push({ t: 'nextTo', a, b });
      if (Math.abs(pa - pb) >= 2 && a < b) out.push({ t: 'apart', a, b, d: Math.abs(pa - pb) });
      if (Math.abs(pa - pb) > 1 && a < b) out.push({ t: 'notNext', a, b });
      if (pb < pa) {
        for (let c = 0; c < n; c++) {
          if (order.indexOf(c) > pa) out.push({ t: 'between', a, b, c });
        }
      }
    }
  }
  return out;
}

// The weight a clue carries in the draw: the vaguer kinds first, so a puzzle leans on reasoning
// rather than on being told where a thing stands.
function clueWeight(clue) {
  return clue.t === 'slot' ? 1 : clue.t === 'end' || clue.t === 'notEnd' ? 3 : 4;
}

function shelfPlan(env) {
  const n = env.chance(0.4) ? 5 : 4;
  const pool = KEEPSAKES.slice();
  const items = [];
  while (items.length < n) items.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  const order = shuffled(env, n);
  const perms = permutations(n);
  const candidates = trueClues(order);
  let clues = [];
  // Draw clues, weighted, until exactly one order fits.
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
    const before = fits(clues, perms).length;
    const after = fits(clues.concat([clue]), perms).length;
    if (after < before) clues.push(clue);
  }
  // Prune: a clue that can go without letting a second order in goes.
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.slice(0, i).concat(clues.slice(i + 1));
    if (fits(without, perms).length === 1) clues = without;
  }
  return { kind: 'shelf', items, order, clues, start: startFor(env, order) };
}

function carriedShelf(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'shelf') return null;
  if (!Array.isArray(p.items) || p.items.length < 4 || p.items.length > 5) return null;
  const n = p.items.length;
  if (!p.items.every((name) => KEEPSAKES.includes(name)) || new Set(p.items).size !== n) return null;
  const isPerm = (list) => Array.isArray(list) && list.length === n && list.every((v) => Number.isInteger(v) && v >= 0 && v < n) && new Set(list).size === n;
  if (!isPerm(p.order) || !isPerm(p.start)) return null;
  if (p.start.every((v, i) => v === p.order[i])) return null;
  if (!Array.isArray(p.clues) || !p.clues.length || p.clues.length > 7) return null;
  const okClue = (c) => c && typeof c === 'object' && ['leftOf', 'nextTo', 'apart', 'end', 'notEnd', 'slot', 'notNext', 'between'].includes(c.t)
    && Number.isInteger(c.a) && c.a >= 0 && c.a < n
    && (['end', 'notEnd', 'slot'].includes(c.t) || (Number.isInteger(c.b) && c.b >= 0 && c.b < n && c.b !== c.a))
    && (c.t !== 'between' || (Number.isInteger(c.c) && c.c >= 0 && c.c < n && c.c !== c.a && c.c !== c.b))
    && (c.t !== 'apart' || (Number.isInteger(c.d) && c.d >= 2 && c.d < n))
    && (c.t !== 'slot' || (Number.isInteger(c.k) && c.k >= 0 && c.k < n));
  if (!p.clues.every(okClue)) return null;
  const clues = p.clues.map((c) => ({ t: c.t, a: c.a, b: c.b, c: c.c, d: c.d, k: c.k }));
  const only = fits(clues, permutations(n));
  if (only.length !== 1 || !only[0].every((v, i) => v === p.order[i])) return null;
  return { kind: 'shelf', items: p.items.slice(), order: p.order.slice(), clues, start: p.start.slice() };
}

function shelfTitle(plan) {
  return 'the shelf: ' + WORDS[plan.items.length] + ' keepsakes, one true order';
}

function shelfGeometry(w, h, n) {
  const span = w * 0.8;
  return { span, left: (w - span) / 2, cell: span / n, shelfY: h * 0.3 };
}

function shelfClues(plan, names) {
  return plan.clues.map((clue, i) => (i + 1) + '. ' + capital(clueText(clue, names)) + '.').join(' ');
}

// Remove any premise that is unnecessary to establish this item's position.
function shelfReason(plan, item) {
  const perms = permutations(plan.items.length);
  const slot = plan.order.indexOf(item);
  let proof = plan.clues.map((_, i) => i);
  for (let i = proof.length - 1; i >= 0; i--) {
    const rest = proof.slice(0, i).concat(proof.slice(i + 1));
    const possible = fits(rest.map((index) => plan.clues[index]), perms);
    if (possible.length && possible.every((order) => order.indexOf(item) === slot)) proof = rest;
  }
  return proof;
}

function drawKeepsake(g, x, y, r, name, env, variant) {
  g.save();
  g.translate(x, y);
  g.rotate((variant.turn || 0) * 0.14);
  g.scale(r, r);
  g.lineWidth = Math.max(0.13, 1.2 / r);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = env.colors.accent2;
  g.fillStyle = env.mix(env.colors.bg2, env.colors.accent, 0.28);
  g.beginPath();
  switch (SHORT[name]) {
    case 'key':
      g.arc(-0.6, -0.2, 0.45, 0, Math.PI * 2);
      g.moveTo(-0.15, -0.2); g.lineTo(1.15, -0.2);
      g.moveTo(0.65, -0.2); g.lineTo(0.65, 0.35);
      g.moveTo(1.05, -0.2); g.lineTo(1.05, 0.2);
      break;
    case 'note':
      g.rect(-0.95, -0.7, 1.9, 1.4);
      g.moveTo(-0.95, -0.7); g.lineTo(0, 0.1); g.lineTo(0.95, -0.7);
      break;
    case 'stone':
      g.ellipse(0, 0, 1.05, 0.67, -0.16, 0, Math.PI * 2);
      g.fill();
      g.moveTo(-0.6, -0.15); g.quadraticCurveTo(-0.2, -0.5, 0.35, -0.35);
      break;
    case 'thread':
      g.ellipse(0, -0.65, 0.7, 0.22, 0, 0, Math.PI * 2);
      g.moveTo(-0.7, -0.65); g.lineTo(-0.7, 0.65);
      g.moveTo(0.7, -0.65); g.lineTo(0.7, 0.65);
      g.moveTo(0.7, 0.65); g.ellipse(0, 0.65, 0.7, 0.22, 0, 0, Math.PI * 2);
      for (let i = -1; i <= 1; i++) {
        g.moveTo(-0.6, i * 0.3); g.lineTo(0.6, i * 0.3 + 0.12);
      }
      g.moveTo(0.7, 0.4); g.quadraticCurveTo(1.5, 0.4, 1.2, 0.9);
      break;
    case 'stub':
      g.moveTo(-1, -0.65); g.lineTo(0.85, -0.65); g.lineTo(0.6, -0.2);
      g.lineTo(0.95, 0.15); g.lineTo(0.7, 0.65); g.lineTo(-1, 0.65); g.closePath();
      g.moveTo(-0.55, -0.35); g.lineTo(-0.55, 0.35);
      g.moveTo(-0.2, -0.15); g.lineTo(0.35, -0.15);
      break;
    case 'bell':
      g.moveTo(-1, 0.55); g.quadraticCurveTo(-0.65, 0.2, -0.6, -0.35);
      g.bezierCurveTo(-0.55, -1, 0.55, -1, 0.6, -0.35);
      g.quadraticCurveTo(0.65, 0.2, 1, 0.55); g.closePath(); g.fill();
      g.moveTo(0.2, 0.8); g.arc(0, 0.8, 0.2, 0, Math.PI);
      g.moveTo(0, -0.85); g.lineTo(0, -1.15);
      break;
    case 'rosemary':
      g.moveTo(-0.4, 0.8); g.lineTo(0.4, -0.95);
      for (let i = 0; i < 4; i++) {
        const sx = -0.25 + i * 0.17;
        const sy = 0.45 - i * 0.37;
        g.moveTo(sx - 0.48, sy - 0.22); g.lineTo(sx, sy);
        g.lineTo(sx + 0.5, sy - 0.04);
      }
      break;
    case 'pencil':
      g.moveTo(-1.1, 0.1); g.lineTo(0.75, -0.45); g.lineTo(1.2, -0.28);
      g.lineTo(0.88, 0.03); g.lineTo(-0.97, 0.58); g.closePath();
      g.moveTo(0.75, -0.45); g.lineTo(0.88, 0.03);
      break;
    case 'matchbook':
      g.rect(-0.75, -0.85, 1.5, 1.7);
      g.moveTo(-0.75, 0.35); g.lineTo(0.75, 0.35);
      for (let i = -1; i <= 1; i++) {
        g.moveTo(i * 0.35, -0.45); g.lineTo(i * 0.35, 0.15);
      }
      break;
    case 'shell':
      g.arc(0, 0.6, 1.15, Math.PI, Math.PI * 2);
      g.lineTo(0, 0.8); g.closePath();
      for (let i = 1; i < 5; i++) {
        const a = Math.PI + i * Math.PI / 5;
        g.moveTo(0, 0.65); g.lineTo(Math.cos(a), 0.6 + Math.sin(a));
      }
      break;
    case 'coin':
      g.arc(0, 0, 0.85, 0, Math.PI * 2); g.fill();
      g.moveTo(0, -0.5); g.lineTo(0.35, 0); g.lineTo(0, 0.5);
      g.lineTo(-0.35, 0); g.closePath();
      break;
    case 'bead':
      g.arc(0, 0, 0.75, 0, Math.PI * 2); g.fill();
      g.moveTo(0.22, 0); g.arc(0, 0, 0.22, 0, Math.PI * 2);
      break;
  }
  g.stroke();
  g.restore();
}

// The shelf as it opens: the keepsakes in the opening order, each standing where it is (from = its
// own slot, so nothing is on its way), nothing shown, the clock at zero, nothing moving (until) and
// nothing drawn yet (size).
function shelfState(plan) {
  const n = plan.items.length;
  const from = new Array(n).fill(0).map((_, item) => plan.start.indexOf(item));
  return { order: plan.start.slice(), hinted: [], selected: null, selectedAt: -1, reasons: [], t: 0, until: -1, size: '', from, movedAt: new Array(n).fill(-1), hintAt: new Array(n).fill(-1), doneAt: -1 };
}

function shelfPosition(env, s, item) {
  const own = rollFor(riteOf(env), 0x3a7e + item);
  const p = came(s, s.movedAt[item], 0.9, !!env.reduced);
  return s.from[item] + (s.order.indexOf(item) - s.from[item]) * own.ease(p);
}

function drawShelf(g, w, h, env, plan, s, variant) {
  const n = plan.items.length;
  const names = plan.items.map((name) => SHORT[name] || name);
  const geo = shelfGeometry(w, h, n);
  const c = env.colors;
  const v = variant || PLAIN;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  floor(g, w, h, env);
  const doneP = s.doneAt >= 0 ? came(s, s.doneAt, 2.6, reduced) : 0;
  nightfall(g, rite, w, h, doneP, 0.8);
  // The lamp over the shelf.
  const lamp = g.createRadialGradient(w / 2, geo.shelfY - h * 0.2, 0, w / 2, geo.shelfY - h * 0.2, w * 0.55 * v.scale);
  lamp.addColorStop(0, env.alpha(c.accent2, 0.14));
  lamp.addColorStop(1, env.alpha(c.accent2, 0));
  g.fillStyle = lamp;
  g.fillRect(0, 0, w, h);
  // The shelf itself.
  g.fillStyle = env.alpha(c.bg2, 0.7);
  g.fillRect(geo.left - geo.cell * 0.1, geo.shelfY, geo.span + geo.cell * 0.2, h * 0.025);
  g.fillStyle = env.alpha(c.muted, 0.3);
  g.fillRect(geo.left - geo.cell * 0.1, geo.shelfY + h * 0.025, geo.span + geo.cell * 0.2, h * 0.008);
  const size = Math.max(10, Math.min(16, Math.round(geo.cell * 0.2)));
  const r = geo.cell * 0.14;
  const slotX = (slot) => geo.left + (slot + 0.5) * geo.cell;
  // What the room shows: the slot a shown keepsake belongs in fills behind the piece's edge in its
  // stair's treads, and its outline is cut on at the slot's own moment; a solved shelf lights
  // every slot the same way, each on a roll of its own.
  for (let slot = 0; slot < n; slot++) {
    const item = plan.order[slot];
    const own = rollFor(rite, 0x5e1f + slot);
    const shown = s.hinted.includes(item) ? came(s, s.hintAt[item], 1.1, reduced) : 0;
    const kept = s.doneAt >= 0 ? own.stair(doneP) : 0;
    const k = Math.max(shown > 0 ? own.stair(shown) : 0, kept);
    const hx = slotX(slot);
    own.paint(g, hx - geo.cell * 0.42, geo.shelfY - r * 4.2, geo.cell * 0.84, r * 4.1, k, env.alpha(c.accent2, 0.16));
    if (shown > 0 && own.flicker(shown)) {
      g.strokeStyle = env.alpha(c.accent2, 0.9);
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.strokeRect(hx - geo.cell * 0.42, geo.shelfY - r * 4.2, geo.cell * 0.84, r * 4.1);
      g.setLineDash([]);
    }
  }
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  for (let slot = 0; slot < n; slot++) {
    const item = s.order[slot];
    const own = rollFor(rite, 0x3a7e + item);
    // A keepsake moved to another slot travels there in its own roll's landing -- a few treads,
    // the first the longest way and each after it shorter, never a glide -- the way the engine's
    // FLIP moves a thing changing places, and its name travels over it in the same treads, so a
    // name never leaves the shelf while its keepsake is on the way.
    const x = slotX(shelfPosition(env, s, item));
    if (s.selected === item) {
      const chosen = came(s, s.selectedAt, 0.6, reduced);
      own.paint(g, x - geo.cell * 0.4, geo.shelfY - r * 4.2, geo.cell * 0.8, r * 4.1,
        own.stair(chosen), env.alpha(c.accent, 0.18));
      if (own.flicker(chosen)) {
        g.strokeStyle = c.accent;
        g.lineWidth = 2;
        g.strokeRect(x - geo.cell * 0.4, geo.shelfY - r * 4.2, geo.cell * 0.8, r * 4.1);
      }
    }
    // The keepsake: a small shape, one per item, with its name over it.
    drawKeepsake(g, x, geo.shelfY - r * 1.2, r, plan.items[item], env, v);
    g.fillStyle = env.alpha(c.fg, 0.9);
    g.fillText(names[item], x, geo.shelfY - r * 2.6);
    g.fillStyle = env.alpha(c.muted, 0.7);
    g.font = '500 ' + Math.max(9, size - 3) + 'px system-ui, sans-serif';
    g.textBaseline = 'top';
    g.fillText(ORDINAL[slot], slotX(slot), geo.shelfY + h * 0.04);
    g.font = '500 ' + size + 'px system-ui, sans-serif';
    g.textBaseline = 'bottom';
  }
  // The clues, under the shelf.
  const clueSize = Math.max(10, Math.min(15, Math.round(Math.min(w, h) * 0.034)));
  g.font = '500 ' + clueSize + 'px system-ui, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const x0 = w * 0.08;
  const line = h * 0.44 / plan.clues.length;
  plan.clues.forEach((clue, i) => {
    const y = h * 0.49 + i * line;
    if (s.reasons.includes(i)) {
      g.fillStyle = env.alpha(c.accent, 0.18);
      g.fillRect(x0 - 4, y - line * 0.44, w * 0.84 + 8, line * 0.88);
    }
    g.fillStyle = c.accent2;
    g.fillText(String(i + 1) + '.', x0, y);
    g.fillStyle = c.fg;
    const label = clueText(clue, names).replace(/\bthe /g, '').replace('stands somewhere ', '')
      .replace(' is ', ' ').replace(' are exactly ', ': ').replace('at either end', 'at an end');
    g.fillText(label, x0 + clueSize * 1.6, y, w * 0.84 - clueSize * 1.6);
  });
  g.fillStyle = env.alpha(c.muted, 0.12 * v.density);
  g.fillRect(0, h * 0.42, w, 1);
}

function shelfPreview(g, w, h, env, plan) {
  drawShelf(g, w, h, env, plan, shelfState(plan), env.variant);
}

function shelfPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.items.length;
  const names = plan.items.map((name) => SHORT[name] || name);
  const s = shelfState(plan);
  const draw = (c) => {
    s.size = sizeOf(c);
    drawShelf(c.g, c.w, c.h, c, plan, s, env.variant);
  };
  // The order as the rail holds it, which is what the check judges.
  function orderNow(c) {
    const v = c.value('order');
    return Array.isArray(v) && v.length === n ? v.map(Number) : s.order;
  }
  function rightPlaces(c) {
    const cur = orderNow(c);
    let right = 0;
    for (let i = 0; i < n; i++) if (cur[i] === plan.order[i]) right += 1;
    return right;
  }
  function arrange(next, c) {
    const before = s.order.slice();
    const positions = plan.items.map((_, item) => shelfPosition(c, s, item));
    s.order = next.map(Number);
    s.selected = null;
    for (let slot = 0; slot < n; slot++) {
      const item = s.order[slot];
      if (before.indexOf(item) !== slot) {
        s.from[item] = positions[item];
        s.movedAt[item] = s.t;
        stir(s, 0.9);
      }
    }
  }
  return {
    title: shelfTitle(plan),
    brief: 'Arrange ' + WORDS[n] + ' keepsakes from left to right so every clue fits. Tap two keepsakes to swap them, or use the order buttons. A between clue does not require neighbours. Exactly one order fits. '
      + shelfClues(plan, names),
    goal: 'Put the keepsakes in the one order every clue allows.',
    aspect: '4 / 3',
    checkLabel: 'check the shelf',
    steps: [
      { id: 'order', ask: 'the keepsakes, left to right', kind: 'order', items: plan.items.map((name, i) => ({ label: name, value: i })), value: plan.start.slice() },
      { id: 'hint', ask: 'where one keepsake belongs, and which clues prove it', kind: 'press', count: helps, label: 'explain one place', optional: true }
    ],
    solution: { order: plan.order.slice() },
    check(c) {
      const right = rightPlaces(c);
      return {
        solved: right === n,
        say: right === n ? 'every keepsake stands where the clues put it'
          : (right === 0 ? 'no keepsake stands where the clues put it yet' : WORDS[right] + ' of ' + WORDS[n] + ' stand where the clues put them')
      };
    },
    start(c) {
      c.status('tap two keepsakes to swap them; tap a numbered clue to read its full sentence');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === n) {
        arrange(value, c);
        c.status('left to right: ' + s.order.map((i) => names[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? plan.order.find((item) => !s.hinted.includes(item) && s.order.indexOf(item) !== plan.order.indexOf(item))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          s.reasons = shelfReason(plan, next);
          stir(s, 1.1);
          c.hint();
          c.status((s.reasons.length === 1 ? 'Clue ' : 'Clues ') + s.reasons.map((i) => i + 1).join(', ')
            + (s.reasons.length === 1 ? ' leaves' : ' leave') + ' only the ' + ORDINAL[plan.order.indexOf(next)]
            + ' place for the ' + names[next] + '. ' + s.reasons.map((i) => capital(clueText(plan.clues[i], names)) + '.').join(' '));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the shelf will show at this difficulty; the rest is yours');
        } else {
          c.status('every keepsake you have placed wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = shelfGeometry(c.w, c.h, n);
      if (y >= 0.44 && y <= 0.97) {
        const i = Math.max(0, Math.min(plan.clues.length - 1, Math.round((y - 0.49) / (0.44 / plan.clues.length))));
        c.status('Clue ' + (i + 1) + '. ' + capital(clueText(plan.clues[i], names)) + '.');
        return;
      }
      const px = x * c.w;
      const py = y * c.h;
      if (px < geo.left || px > geo.left + geo.span || py < geo.shelfY - geo.cell * 0.8 || py > geo.shelfY + c.h * 0.1) {
        c.status('tap two keepsakes to swap them, or tap a numbered clue to read it');
        return;
      }
      const at = (px - geo.left) / geo.cell - 0.5;
      const item = s.order.reduce((near, next) => Math.abs(shelfPosition(c, s, next) - at)
        <= Math.abs(shelfPosition(c, s, near) - at) ? next : near);
      if (s.selected === item) {
        s.selected = null;
        c.status('the ' + names[item] + ' is released; nothing moved');
      } else if (s.selected === null) {
        s.selected = item;
        s.selectedAt = s.t;
        stir(s, 0.6);
        c.status('the ' + names[item] + ' is selected; tap another keepsake to swap them, or this one to release it');
      } else {
        const first = s.selected;
        const next = s.order.slice();
        const a = next.indexOf(first);
        const b = next.indexOf(item);
        [next[a], next[b]] = [next[b], next[a]];
        arrange(next, c);
        c.set('order', next);
        c.status('swapped the ' + names[first] + ' and the ' + names[item] + '; left to right: '
          + next.map((i) => names[i]).join(', '));
      }
      draw(c);
    },
    frame(t, dt, c) {
      return tick(s, dt, c, draw);
    },
    end(c) {
      s.selected = null;
      s.doneAt = s.t;
      stir(s, 2.6);
      c.status(s.order.map((i) => names[i]).join(' - ') + ': every clue fits. The keepsakes are still yours to move.');
    }
  };
}

/* ---- the second look: two presses between two views ----------------------------------------- */

function changedRow(pressed) {
  const flipped = litBy(pressed, 3);
  const counts = [0, 1, 2].map((row) => flipped.slice(row * 3, row * 3 + 3).reduce((sum, lamp) => sum + lamp, 0));
  const most = Math.max(...counts);
  return counts.indexOf(most) === counts.lastIndexOf(most) ? counts.indexOf(most) : -1;
}

function secondLookPlan(env) {
  const before = new Array(9).fill(0);
  const available = Array.from({ length: 9 }, (_, i) => i);
  const lit = env.int(3, 6);
  for (let i = 0; i < lit; i++) before[available.splice(env.int(0, available.length - 1), 1)[0]] = 1;
  const pairs = [];
  for (let a = 0; a < 9; a++) {
    for (let b = a + 1; b < 9; b++) {
      if (changedRow([a, b]) !== -1) pairs.push([a, b]);
    }
  }
  return { kind: 'second-look', before, pressed: env.pick(pairs) };
}

function carriedSecondLook(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'second-look' || !Array.isArray(p.before) || p.before.length !== 9) return null;
  if (!p.before.every((lamp) => lamp === 0 || lamp === 1)) return null;
  const lit = p.before.filter(Boolean).length;
  if (lit < 3 || lit > 6) return null;
  if (!Array.isArray(p.pressed) || p.pressed.length !== 2 || !p.pressed.every((i) => Number.isInteger(i) && i >= 0 && i < 9)) return null;
  if (p.pressed[0] >= p.pressed[1] || changedRow(p.pressed) === -1) return null;
  return { kind: 'second-look', before: p.before.slice(), pressed: p.pressed.slice() };
}

function secondLookAfter(plan) {
  const flipped = litBy(plan.pressed, 3);
  return plan.before.map((lamp, i) => lamp ^ flipped[i]);
}

function secondLookRows(lamps) {
  return [0, 1, 2].map((row) => 'row ' + (row + 1) + ': '
    + lamps.slice(row * 3, row * 3 + 3).map((lamp) => lamp ? 'lit' : 'dark').join(', ')).join('; ');
}

function secondLookTitle(plan) {
  return 'the second look: ' + plan.before.filter(Boolean).length + ' lamps first';
}

function secondLookGeometry(w, h) {
  const side = Math.min(w * 0.39, h * 0.64);
  return { side, cell: side / 3, lefts: [w * 0.07, w * 0.54], top: h * 0.19 };
}

// The two views as they open: nothing marked, no row shown, nothing revealed, every mark that
// comes or goes timed against the piece's clock (-1 is "never"), nothing moving (until) and
// nothing drawn yet (size).
function secondLookState() {
  return { picked: [], hintRow: null, reveal: false, t: 0, until: -1, size: '', markAt: new Array(9).fill(-1), hintAt: -1, revealAt: -1 };
}

function drawSecondLook(g, w, h, env, plan, s, variant) {
  const c = env.colors;
  const v = variant || PLAIN;
  const geo = secondLookGeometry(w, h);
  const after = secondLookAfter(plan);
  const changed = litBy(plan.pressed, 3);
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const revealP = s.reveal ? came(s, s.revealAt, 2, reduced) : 0;
  floor(g, w, h, env);
  [plan.before, after].forEach((lamps, view) => {
    const left = geo.lefts[view];
    g.fillStyle = env.alpha(c.bg2, 0.35);
    g.fillRect(left, geo.top, geo.side, geo.side);
    g.strokeStyle = env.alpha(c.muted, 0.6);
    g.lineWidth = 1;
    g.strokeRect(left, geo.top, geo.side, geo.side);
    g.fillStyle = c.fg;
    g.font = '500 ' + Math.max(11, Math.round(geo.cell * 0.27)) + 'px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(view ? 'after' : 'before', left + geo.side / 2, geo.top * 0.58);
    if (view === 0 && s.hintRow !== null) {
      // The row the room has narrowed the search to: its band fills behind the piece's edge in
      // the stair's treads, and its outline is cut on at the row's own moment (below).
      const own = rollFor(rite, 0x40c);
      own.paint(g, left + 3, geo.top + s.hintRow * geo.cell + 3, geo.side - 6, geo.cell - 6,
        own.stair(came(s, s.hintAt, 1.1, reduced)), env.alpha(c.accent, 0.14));
    }
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const x = left + (i % 3 + 0.5) * geo.cell;
      const y = geo.top + (row + 0.5) * geo.cell;
      const r = geo.cell * 0.23 * v.scale;
      if (lamps[i]) {
        const glow = g.createRadialGradient(x, y, r * 0.3, x, y, r * 1.9);
        glow.addColorStop(0, env.alpha(c.accent2, 0.45));
        glow.addColorStop(1, env.alpha(c.accent2, 0));
        g.fillStyle = glow;
        g.beginPath();
        g.arc(x, y, r * 1.9, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = lamps[i] ? c.accent2 : env.alpha(c.muted, 0.28);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = env.alpha(lamps[i] ? c.accent2 : c.muted, lamps[i] ? 0.9 : 0.6);
      g.lineWidth = 1.5;
      g.stroke();
      // A marked switch (first view) or a revealed change (second view): the band round the lamp
      // fills behind the piece's edge in the stair's treads, and its line is cut on at the lamp's
      // own moment. A mark taken back goes the same way back: the band shrinks behind the edge
      // down the stair, and the line is cut off once at that moment.
      const own = rollFor(rite, 0x2b0 + i + view * 9);
      let k = 0;
      let on = false;
      if (view === 0) {
        const mp = came(s, s.markAt[i], 0.8, reduced);
        const marked = s.picked.includes(i);
        k = marked ? own.stair(mp) : (mp < 1 ? 1 - own.stair(mp) : 0);
        on = marked ? !!own.flicker(mp) : !own.flicker(mp);
      } else if (s.reveal && changed[i]) {
        k = own.stair(revealP);
        on = !!own.flicker(revealP);
      }
      if (k > 0) {
        const outer = r * 1.55;
        g.fillStyle = env.alpha(c.accent, 0.5);
        within(g, own, (p) => {
          p.arc(x, y, outer, 0, Math.PI * 2);
          p.moveTo(x + r * 1.2, y);
          p.arc(x, y, r * 1.2, 0, Math.PI * 2, true);
        }, x - outer, y - outer, outer * 2, outer * 2, k);
      }
      if (k > 0 && on) {
        g.strokeStyle = c.accent;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r * 1.4, 0, Math.PI * 2);
        g.stroke();
      }
    }
    if (view === 0 && s.hintRow !== null && rollFor(rite, 0x40c).flicker(came(s, s.hintAt, 1.1, reduced))) {
      g.strokeStyle = c.accent;
      g.lineWidth = 2;
      g.setLineDash([4, 4]);
      g.strokeRect(left + 3, geo.top + s.hintRow * geo.cell + 3, geo.side - 6, geo.cell - 6);
      g.setLineDash([]);
    }
    g.strokeStyle = env.alpha(c.muted, 0.2 + 0.1 * v.density);
    g.strokeRect(left - 3, geo.top - 3, geo.side + 6, geo.side + 6);
  });
  // The caption: the old words stand until the rite's moment after the changes are revealed, and
  // are cut over to the new ones there, once, never through a blank.
  caption(g, w, h, env, s.reveal && rite.flicker(revealP) ? 'changed lamps ringed' : 'each press flips its neighbours',
    h * 0.91, 0.9);
}

function secondLookPreview(g, w, h, env, plan) {
  drawSecondLook(g, w, h, env, plan, secondLookState(), env.variant);
}

function secondLookPiece(env, plan) {
  const helps = asked(env).helps;
  const after = secondLookAfter(plan);
  const row = changedRow(plan.pressed);
  const changed = litBy(plan.pressed, 3).filter(Boolean).length;
  const rows = ['top', 'middle', 'bottom'];
  const s = secondLookState();
  const draw = (c) => {
    s.size = sizeOf(c);
    drawSecondLook(c.g, c.w, c.h, c, plan, s, env.variant);
  };
  // The marks as they change: every switch marked or unmarked by `next` is timed from now.
  function mark(next) {
    for (let i = 0; i < 9; i++) if (s.picked.includes(i) !== next.includes(i)) s.markAt[i] = s.t;
    s.picked = next;
    stir(s, 0.8);
  }
  return {
    title: secondLookTitle(plan),
    brief: 'Two views of the same nine lamps. Someone pressed exactly two switches between the first and second view. Each press flips that lamp and its neighbours above, below, left and right; a lamp flipped twice stays as it was. Before: ' + secondLookRows(plan.before) + '. After: ' + secondLookRows(after) + '.',
    goal: 'Find the two switches pressed and the row where the most lamps changed.',
    aspect: '4 / 3',
    checkLabel: 'check both views',
    steps: [
      { id: 'switches', ask: 'the two switches pressed: choose here or tap them in the first view', kind: 'pick', count: 2,
        items: Array.from({ length: 9 }, (_, i) => ({ label: 'row ' + (Math.floor(i / 3) + 1) + ', column ' + (i % 3 + 1), value: i })) },
      { id: 'row', ask: 'row with the most changed lamps', kind: 'choice', options: rows.map((label, i) => ({ label, value: i })) },
      // One thing to say -- the row one switch is in -- so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'hint', ask: 'the row of one pressed switch', kind: 'press', count: 1, label: 'narrow the search', optional: true } : null
    ].filter(Boolean),
    solution: { switches: plan.pressed.slice(), row },
    check(c) {
      const chosen = c.value('switches');
      const valid = Array.isArray(chosen) && chosen.length === 2 && new Set(chosen).size === 2
        && chosen.every((i) => Number.isInteger(i) && i >= 0 && i < 9);
      const result = valid ? litBy(chosen, 3).map((flip, i) => plan.before[i] ^ flip) : plan.before;
      const matches = result.filter((lamp, i) => lamp === after[i]).length;
      const rowRight = c.value('row') === row;
      return { solved: valid && matches === 9 && rowRight,
        say: valid && matches === 9 && rowRight ? 'both views agree: ' + rows[row] + ' row changed most'
          : matches + ' of nine lamps match the second view; the row choice ' + (rowRight ? 'fits' : 'does not fit') };
    },
    start(c) {
      c.status('compare the lamps before and after the two presses');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'switches') {
        mark(Array.isArray(value) ? value.slice() : []);
        c.status(s.picked.length + ' of two switches marked');
      }
      if (id === 'row') c.status('you say the ' + rows[value] + ' row changed most');
      if (id === 'hint') {
        if (s.hintRow === null) {
          s.hintRow = Math.floor(plan.pressed[0] / 3);
          s.hintAt = s.t;
          stir(s, 1.1);
          c.hint();
        }
        c.status('one of the pressed switches is in the ' + rows[s.hintRow] + ' row');
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = secondLookGeometry(c.w, c.h);
      const px = x * c.w;
      const py = y * c.h;
      for (let view = 0; view < 2; view++) {
        const col = Math.floor((px - geo.lefts[view]) / geo.cell);
        const rowAt = Math.floor((py - geo.top) / geo.cell);
        if (col < 0 || col >= 3 || rowAt < 0 || rowAt >= 3) continue;
        const i = rowAt * 3 + col;
        if (view === 1) {
          c.status('row ' + (rowAt + 1) + ', column ' + (col + 1) + ': ' + (plan.before[i] ? 'lit' : 'dark')
            + ' before, ' + (after[i] ? 'lit' : 'dark') + ' after');
          return;
        }
        if (s.picked.includes(i)) {
          c.status('that switch is already marked; choose another');
          return;
        }
        const next = s.picked.slice();
        if (next.length === 2) next.shift();
        next.push(i);
        mark(next);
        if (s.picked.length === 2) c.set('switches', s.picked.slice().sort((a, b) => a - b));
        c.status(s.picked.length + ' of two switches marked in the first view');
        draw(c);
        return;
      }
      c.status('tap a lamp in the first view to mark a switch, or compare it with the second view');
    },
    frame(t, dt, c) {
      return tick(s, dt, c, draw);
    },
    end(c) {
      s.reveal = true;
      s.revealAt = s.t;
      stir(s, 2);
      c.status('two presses changed ' + changed + ' lamps; the ' + rows[row] + ' row changed most');
      draw(c);
    }
  };
}

/* ---- the turned pane: one press seen from another angle -------------------------------------- */

const PANE_TURNS = ['upright', '90 degrees clockwise', 'upside down', '90 degrees counterclockwise'];

function turnPane(lamps, n, turns) {
  let shown = lamps.slice();
  for (let turn = 0; turn < turns; turn++) {
    const next = new Array(n * n);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) next[col * n + n - 1 - row] = shown[row * n + col];
    }
    shown = next;
  }
  return shown;
}

function paneAfter(plan, pressed = plan.pressed, turn = plan.turn) {
  const flipped = litBy([pressed], plan.n);
  return turnPane(plan.before.map((lamp, i) => lamp ^ flipped[i]), plan.n, turn);
}

// Deal only pictures for which the two views identify one switch and one turn.
function paneOptions(before, n) {
  const seen = new Map();
  const options = [];
  for (let turn = 0; turn < 4; turn++) {
    for (let pressed = 0; pressed < n * n; pressed++) {
      const key = paneAfter({ n, before }, pressed, turn).join('');
      seen.set(key, (seen.get(key) || 0) + 1);
      options.push({ pressed, turn, key });
    }
  }
  return options.filter((option) => seen.get(option.key) === 1);
}

function panePlan(env) {
  const n = env.chance(0.5) ? 4 : 3;
  const N = n * n;
  for (let attempt = 0; attempt < 24; attempt++) {
    const before = new Array(N).fill(0);
    const count = env.int(Math.max(3, Math.floor(N / 3)), Math.min(N - 3, Math.ceil(N * 0.67)));
    for (const i of shuffled(env, N).slice(0, count)) before[i] = 1;
    const options = paneOptions(before, n);
    if (options.length) {
      const chosen = env.pick(options);
      return { kind: 'turned-pane', n, before, pressed: chosen.pressed, turn: chosen.turn };
    }
  }
  throw new Error('Could not deal a uniquely solvable turned pane.');
}

function carriedPane(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'turned-pane' || ![3, 4].includes(p.n)) return null;
  const N = p.n * p.n;
  if (!Array.isArray(p.before) || p.before.length !== N || !p.before.every((lamp) => lamp === 0 || lamp === 1)) return null;
  const lit = p.before.filter(Boolean).length;
  if (lit < 2 || lit > N - 2 || !Number.isInteger(p.pressed) || p.pressed < 0 || p.pressed >= N
    || !Number.isInteger(p.turn) || p.turn < 0 || p.turn >= 4) return null;
  if (!paneOptions(p.before, p.n).some((option) => option.pressed === p.pressed && option.turn === p.turn)) return null;
  return { kind: 'turned-pane', n: p.n, before: p.before.slice(), pressed: p.pressed, turn: p.turn };
}

function paneTitle(plan) {
  return 'the turned pane: ' + WORDS[plan.before.filter(Boolean).length] + ' lamps before';
}

function paneRows(lamps, n) {
  return Array.from({ length: n }, (_, row) => 'row ' + (row + 1) + ': '
    + lamps.slice(row * n, (row + 1) * n).map((lamp) => lamp ? 'lit' : 'dark').join(', ')).join('; ');
}

function paneGeometry(w, h, n) {
  const side = Math.min(w * 0.39, h * 0.54);
  return { side, cell: side / n, lefts: [w * 0.07, w * 0.54], top: h * 0.22 };
}

function paneState(n) {
  return { selected: new Array(n * n).fill(0), turn: null, hint: 0, hintAt: -1, colAt: -1,
    doneAt: -1, t: 0, until: -1, size: '' };
}

function drawPane(g, w, h, env, plan, s) {
  const n = plan.n;
  const geo = paneGeometry(w, h, n);
  const c = env.colors;
  const v = env.variant || PLAIN;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const seal = s.doneAt < 0 ? 0 : rite.stair(came(s, s.doneAt, 1.2, reduced));
  floor(g, w, h, env);
  [plan.before, paneAfter(plan)].forEach((lamps, view) => {
    const left = geo.lefts[view];
    g.fillStyle = env.alpha(c.bg2, 0.44);
    g.fillRect(left, geo.top, geo.side, geo.side);
    if (view === 1 && seal) rite.paint(g, left, geo.top, geo.side, geo.side, seal, env.alpha(c.accent2, 0.12));
    g.strokeStyle = env.alpha(c.muted, 0.6);
    g.lineWidth = 1 + v.density * 0.3;
    g.strokeRect(left, geo.top, geo.side, geo.side);
    if (view === 0 && s.hint >= 1) {
      rite.paint(g, left - 7, geo.top + Math.floor(plan.pressed / n) * geo.cell,
        4, geo.cell, rite.stair(came(s, s.hintAt, 0.8, reduced)), c.accent);
    }
    if (view === 0 && s.hint >= 3) {
      rite.paint(g, left + (plan.pressed % n) * geo.cell, geo.top + geo.side + 3,
        geo.cell, 4, rite.stair(came(s, s.colAt, 0.8, reduced)), c.accent);
    }
    for (let i = 0; i < n * n; i++) {
      const x = left + (i % n + 0.5) * geo.cell;
      const y = geo.top + (Math.floor(i / n) + 0.5) * geo.cell;
      const r = geo.cell * 0.25 * Math.min(1.1, Math.max(0.85, v.scale));
      if (lamps[i]) {
        const glow = g.createRadialGradient(x, y, r * 0.3, x, y, r * 1.8);
        glow.addColorStop(0, env.alpha(c.accent2, 0.3));
        glow.addColorStop(1, env.alpha(c.accent2, 0));
        g.fillStyle = glow;
        g.fillRect(x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
      }
      g.fillStyle = lamps[i] ? c.accent2 : env.alpha(c.muted, 0.38);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (view === 0 && (s.selected[i] || (seal && i === plan.pressed))) {
        g.strokeStyle = seal && i === plan.pressed ? c.accent2 : c.accent;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r * 1.42, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.fillStyle = c.fg;
    g.font = '500 ' + Math.max(11, Math.round(geo.cell * 0.3)) + 'px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(view ? 'after' : 'before', left + geo.side / 2, geo.top - h * 0.055);
  });
  caption(g, w, h, env, seal ? 'the panes agree' : 'one press, then one turn', h * 0.91, 0.9);
}

function panePreview(g, w, h, env, plan) {
  drawPane(g, w, h, env, plan, paneState(plan.n));
}

function panePiece(env, plan) {
  const n = plan.n;
  const N = n * n;
  const helps = asked(env).helps;
  const answer = new Array(N).fill(0);
  answer[plan.pressed] = 1;
  const s = paneState(n);
  const place = (i) => 'row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1);
  const draw = (c) => {
    s.size = sizeOf(c);
    drawPane(c.g, c.w, c.h, c, plan, s);
  };
  return {
    title: paneTitle(plan),
    brief: 'One switch was pressed between these views. It flips its own lamp and the lamps directly above, below, left and right. The after pane may be upright, turned 90 degrees in either direction, or upside down. Before: '
      + paneRows(plan.before, n) + '. After: ' + paneRows(paneAfter(plan), n) + '.',
    goal: 'Mark the one switch pressed and choose how the after pane was turned.',
    aspect: '4 / 3',
    checkLabel: 'check the panes',
    steps: [
      { id: 'switch', ask: 'the one switch pressed: tap it in the before pane or mark it here',
        kind: 'grid', rows: n, cols: n, labels: ['left alone', 'pressed'] },
      { id: 'turn', ask: 'how the after pane was turned', kind: 'choice',
        options: PANE_TURNS.map((label, value) => ({ label, value })) },
      { id: 'hint', ask: 'a clue about the switch or the turn', kind: 'press', count: helps,
        label: 'show a clue', optional: true }
    ],
    solution: { switch: answer, turn: plan.turn },
    check(c) {
      const marked = c.value('switch');
      const turn = c.value('turn');
      if (!Array.isArray(marked) || marked.length !== N || marked.filter(Boolean).length !== 1
        || !Number.isInteger(turn) || turn < 0 || turn >= 4) {
        return { solved: false, say: 'Mark exactly one switch and choose one turn to compare the panes.' };
      }
      const imagined = paneAfter(plan, marked.findIndex(Boolean), turn);
      const after = paneAfter(plan);
      const matches = imagined.filter((lamp, i) => lamp === after[i]).length;
      return { solved: matches === N,
        say: matches === N ? 'the two panes agree' : WORDS[matches] + ' of ' + WORDS[N] + ' lamps match the after pane' };
    },
    start(c) {
      c.status('compare the before pane with the turned after pane');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'switch' && Array.isArray(value) && value.length === N) {
        s.selected = value.map((cell) => cell ? 1 : 0);
        const marked = s.selected.filter(Boolean).length;
        c.status(marked === 1 ? place(s.selected.findIndex(Boolean)) + ' marked as the switch'
          : marked + ' switches marked; mark exactly one');
      }
      if (id === 'turn') {
        if (Number.isInteger(value) && value >= 0 && value < 4) {
          s.turn = value;
          c.status('after pane: ' + PANE_TURNS[value]);
        } else c.status('choose one of the four turns');
      }
      if (id === 'hint') {
        if (s.hint >= helps) c.status('no more clues at this difficulty');
        else {
          s.hint += 1;
          c.hint();
          if (s.hint === 1) {
            s.hintAt = s.t;
            stir(s, 0.8);
            c.status('the pressed switch is in row ' + (Math.floor(plan.pressed / n) + 1));
          } else if (s.hint === 2) {
            c.status('the after pane is ' + (plan.turn % 2 ? 'turned sideways' : 'upright or upside down'));
          } else if (s.hint === 3) {
            s.colAt = s.t;
            stir(s, 0.8);
            c.status('the pressed switch is in column ' + (plan.pressed % n + 1));
          } else if (s.hint === 4) c.status('the after pane is ' + PANE_TURNS[plan.turn]);
          else c.status('mark ' + place(plan.pressed) + ' in the before pane');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = paneGeometry(c.w, c.h, n);
      const px = x * c.w;
      const py = y * c.h;
      for (let view = 0; view < 2; view++) {
        const col = Math.floor((px - geo.lefts[view]) / geo.cell);
        const row = Math.floor((py - geo.top) / geo.cell);
        if (col < 0 || col >= n || row < 0 || row >= n) continue;
        const i = row * n + col;
        if (view === 1) {
          c.status('after pane, ' + place(i) + ': ' + (paneAfter(plan)[i] ? 'lit' : 'dark'));
          return;
        }
        const next = new Array(N).fill(0);
        next[i] = 1;
        s.selected = next;
        c.set('switch', next);
        c.status(place(i) + ' marked as the switch');
        draw(c);
        return;
      }
      c.status('tap a lamp in the before pane to mark a switch, or inspect the after pane');
    },
    frame(t, dt, c) {
      return tick(s, dt, c, draw);
    },
    end(c) {
      s.doneAt = s.t;
      stir(s, 1.2);
      c.status('the panes agree; the switch was at ' + place(plan.pressed));
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsLamps(env) {
  return env.chance(0.5);
}

function dealt(env) {
  const lamps = dealsLamps(env);
  const face = (Math.imul(env.seed >>> 0, 0x9e3779b1) >>> 29) & 3;
  return face === 3 ? 'second-look' : face === 0 ? 'turned-pane' : lamps ? 'lamps' : 'shelf';
}

const plans = new WeakMap();
function planFor(env) {
  let plan = plans.get(env);
  if (!plan) {
    plan = carriedLamps(env) || carriedShelf(env) || carriedSecondLook(env) || carriedPane(env);
    if (!plan) {
      const kind = dealt(env);
      plan = kind === 'lamps' ? lampsPlan(env) : kind === 'shelf' ? shelfPlan(env)
        : kind === 'second-look' ? secondLookPlan(env) : panePlan(env);
    }
    plans.set(env, plan);
  }
  return plan;
}

export default {
  id: 'quiet-room',
  needsSky: false,
  paint(ctx, w, h, env) {
    const plan = planFor(env);
    if (plan.kind === 'shelf') {
      shelfPreview(ctx, w, h, env, plan);
      return;
    }
    // The breath caught where the configuration caught it, at the size it asks for.
    room(ctx, w, h, env);
  },
  // The card is a still picture and says so, and the feed's loop lets it go. A breath that went on
  // for as long as the card is on screen would repaint the whole card about thirty times a second:
  // a surface far larger than any control, moving with nothing waiting on it, at a cost an idle
  // feed would pay on every frame.
  animate() {
    return false;
  },
  spark(env) {
    const plan = planFor(env);
    const kind = plan.kind;
    if (kind === 'lamps') {
      const count = litBy(plan.presses, plan.n).filter(Boolean).length;
      return {
        title: lampsTitle(plan),
        quote: (count === 1 ? 'one lamp burns' : WORDS[count] + ' lamps burn') + '; put every one out',
        text: 'A lamp pressed flips itself and its four neighbours. Find the presses that leave the room dark.',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => lampsPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (kind === 'second-look') {
      return {
        title: secondLookTitle(plan),
        quote: 'nine lamps, two views, two presses between them',
        text: 'Compare the lamps before and after. Find the two switches pressed and the row with the most changes.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => secondLookPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (kind === 'turned-pane') {
      return {
        title: paneTitle(plan),
        quote: WORDS[plan.before.filter(Boolean).length] + ' lamps before; one press, then a turn',
        text: 'Compare the two panes. Find the switch pressed and how the after view was turned.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => panePreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const names = plan.items.map((name) => SHORT[name] || name);
    return {
      title: shelfTitle(plan),
      quote: clueText(plan.clues[0], names),
      text: (plan.clues.length === 1 ? 'That is the one clue.' : capital(WORDS[plan.clues.length - 1]) + ' more clues wait under the shelf.')
        + ' Swap the keepsakes into the one order that fits. Ask for a hint to see which clues prove one place.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => shelfPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const plan = planFor(env);
    return plan.kind === 'lamps' ? lampsPiece(env, plan)
      : plan.kind === 'shelf' ? shelfPiece(env, plan)
        : plan.kind === 'second-look' ? secondLookPiece(env, plan) : panePiece(env, plan);
  }
};
