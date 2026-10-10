/* The weather lab: a synoptic map under the persona's stars, and two puzzles read off it. As a
   card it is the map the seed deals, drawn small (paint, spark); as a piece it is one of the two
   puzzles below, and the card it was opened from says which. See js/feed.js for what a module is
   and js/stage.js for what a piece is.

   Two puzzles, both deduction:

     when the front arrives  A station marked on a gridded map, a front some squares off on one
                             side, moving toward it at a stated speed, and a clock showing the
                             hour now. One square is ten kilometres, and the scale bar says so.
                             Say the hour the front reaches the station, past midnight if it must,
                             and which side it comes from. A wrong check says whether the hour
                             falls short or overshoots, and whether the side is right.
     the pressure map        Five stations (six on a crowded map) with their readings. The wind blows from the
                             highest toward the lowest. Name the station it blows toward, the way
                             it blows by the compass, and the difference in pressure between the
                             two. A wrong check says which part is off and no more.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the station, the front, the speed and the hour, or the five stations and their
   readings -- and piece(env) opens on that rather than rolling another. The sky may be one star
   or many; it only glints through the map, and the plan stands whatever the sky is now. */

const GC = 20; // squares across
const GR = 12; // squares down
const STRIP = 3.2; // the instrument strip under the map, in squares
const KM = 10; // kilometres in a square
const SIDES = ['north', 'east', 'south', 'west'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
const SPEEDS = [10, 20, 30, 40, 50, 60];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (hour) => (hour < 10 ? '0' : '') + hour + ':00';

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

/* ---- the rite: how the lab moves ----------------------------------------------------------- */

/* Nothing here glides, fades or sways (README: "Motion axiom", the cut; js/stage.js, "The rite").
   env.rite -- ctx.rite in a piece, the same object -- is the piece's own roll from its seed: its
   one edge, a slice at its angle or a curve from its corner, and the treads it steps in. A surface
   that comes onto the map -- the band along a named side, the halo round a named station, the
   slip's paper, the rain once the front is in, the light over a solved map -- comes by its AREA
   behind that one edge (rite.paint: one path, never cells), in a few treads, always forward, and
   one taken back goes out behind the same edge the way it came, the region shrinking; one caught
   part way by the next change turns from where it stands rather than jumping. A mark that stays on
   the map -- the band, the halo, the air behind the front, the solved light -- rests in two shades
   of its colour split by that edge (cover), never a flat tint; the slip is a sheet of paper laid
   over the map, plain as paper. A thing that travels -- the front to the station, the wind's arrow
   to the lowest reading, the slip down onto the map -- moves in rite.ease's landing, the first
   tread the longest; the hand on the dial turns in rite.ratchet's even clicks, a clock's; a word
   is cut on at rite.flicker's one moment, and a word that changes is cut straight from the old to
   the new at that moment, the old one standing until then, so its place is never blank between.
   Each surface set or unset steps on a roll of its own (rite.at, rolled once and kept), so a
   second naming steps in other treads than the first, along the same edge. Between changes
   nothing moves and nothing is drawn: the map waits for its forecast, and a frame with nothing new
   on it is let go (settled). */

// What stands in for a rite on an env that carries none: whatever has not begun stands where it
// was, whatever has begun is already at its end, and a surface is painted whole -- so a drawing
// holds rather than throws.
const begun = (t) => (t > 0 ? 1 : 0);
const STILL = {
  ease: begun, stair: begun, ratchet: begun, flicker: begun,
  paint(g, x, y, w, h, k, style) {
    if (!(k > 0)) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w, h);
  },
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w, h);
  },
  at() { return STILL; }
};

function riteOf(c) {
  return c && c.rite ? c.rite : STILL;
}

// The rolls the lab takes from a rite, one per seed, rolled the first time one is asked for and
// kept: a surface's treads are the same on every frame of its change, so they are worked out once
// rather than rolled again on every frame it is drawn.
const kept = new WeakMap();
function rolled(rite, seed) {
  let rolls = kept.get(rite);
  if (!rolls) {
    rolls = new Map();
    kept.set(rite, rolls);
  }
  let own = rolls.get(seed);
  if (!own) {
    own = rite.at(seed);
    rolls.set(seed, own);
  }
  return own;
}

// Where a thing that happened at `at` on the piece's clock stands in a rite `dur` seconds long:
// 0 before it, 1 once it is over, and 1 at once when less motion is asked for.
function prog(c, time, at, dur) {
  if (at == null || at < 0) return 0;
  if (c.reduced) return 1;
  return clamp((time - at) / dur, 0, 1);
}

// A mark is { on, at, n, from }: a surface set (on) or unset at `at`, the n-th of its kind, from
// the coverage it stood at then. Set, it climbs from there to whole on the stair of its own roll;
// unset, it goes back down from there the same way, the region shrinking the way it came. A mark
// caught part way by the next one turns from where it stands -- one way each time, never a jump to
// whole and back, never a fade.
function coverage(c, time, mark, dur) {
  if (!mark) return 0;
  const k = rolled(riteOf(c), 0x5e7 + (mark.n || 0)).stair(prog(c, time, mark.at, dur));
  return mark.on ? mark.from + (1 - mark.from) * k : mark.from * (1 - k);
}

// Sets (on) or unsets the surface `key` now, from wherever its last mark has it.
function remark(c, s, key, on, dur) {
  s.marks[key] = { on, at: s.t, n: s.rolls++, from: coverage(c, s.t, s.marks[key], dur) };
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and a second coat over the part it had passed by halfway. While it
// comes one edge moves; at rest it is two shades of one colour split by that edge through the
// middle of the box -- a slice through its centre, or the curve's arc halfway out. Two paths.
function cover(g, rite, x, y, w, h, k) {
  if (!(k > 0)) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A disc that is k of the way in: the disc is the clip, and the surface is covered across the
// square round it, one edge whatever its size.
function disc(g, rite, x, y, r, k, style) {
  if (!(k > 0) || r <= 0) return;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.clip();
  g.fillStyle = style;
  cover(g, rite, x - r, y - r, r * 2, r * 2, k);
  g.restore();
}

// The longest any change on the map takes to come the whole of its way, in seconds: the light
// over a solved map.
const LONGEST = 2.6;

function sizeOf(c) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1);
}

// The latest moment anything was changed on the map, on the piece's clock: the times given and
// every mark's, or -1 when nothing has been.
function latest(s, times) {
  let last = -1;
  for (const at of times) if (at != null && at > last) last = at;
  for (const mark of Object.values(s.marks)) if (mark.at > last) last = mark.at;
  return last;
}

// Whether a frame has nothing to draw: the canvas holds the picture drawn at this size and at this
// step of the ceremony (`key`), and that picture was drawn once the latest change (made at `last`)
// had come the whole of its way -- at once, for a visitor who asked for less motion. A map at rest
// stands still, so drawing it again would spend a frame on nothing a visitor could see; a new size
// (the stage clears the canvas to resize it), a new step or a new change draws again. It is when
// the picture was drawn that is read, not the clock alone: the stage asks for no frames while the
// scene is out of sight, so a change cut off there is still owed its finished picture, and the
// first frame back draws it.
function settled(s, c, key, last) {
  if (s.drawn !== sizeOf(c) || s.drawnKey !== key) return false;
  return s.drawnAt >= (c.reduced || last < 0 ? last : last + LONGEST + 0.05);
}

// The one-square-deep band along a side of the map: the surface a named side is marked by.
function sideBand(geo, side) {
  const d = geo.sq;
  switch (side) {
    case 'north': return { x: geo.left, y: geo.top, w: geo.right - geo.left, h: d };
    case 'south': return { x: geo.left, y: geo.bottom - d, w: geo.right - geo.left, h: d };
    case 'west': return { x: geo.left, y: geo.top, w: d, h: geo.bottom - geo.top };
    default: return { x: geo.right - d, y: geo.top, w: d, h: geo.bottom - geo.top };
  }
}

/* ---- drawing shared by both ---------------------------------------------------------------- */

function write(g, text, x, y, size, align, tone, weight) {
  g.fillStyle = tone;
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// Where the grid sits: a margin for the numbers along the left, square squares, and the strip of
// instruments under the map (the scale bar, the clock or the compass).
function mapGeometry(w, h) {
  const padL = w * 0.05;
  const padT = h * 0.03;
  const sq = Math.min((w - padL - w * 0.02) / GC, (h - padT - h * 0.02) / (GR + STRIP));
  const bottom = padT + GR * sq;
  return { sq, x: (c) => padL + c * sq, y: (r) => padT + r * sq, left: padL, top: padT, right: padL + GC * sq, bottom, strip: bottom + sq * 2.05 };
}

// The map's ground: the sky at the hour, the squares and their numbers, the stars as they stand
// glinting through, and a drift of haze where the configuration lays it. None of it moves: it is
// the paper the weather is read off.
function ground(g, w, h, env, v, hour) {
  const c = env.colors;
  const geo = mapGeometry(w, h);
  const day = (1 + Math.cos(((hour - 12) / 12) * Math.PI)) / 2;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, env.mix(c.bg, c.accent2, day * 0.3));
  grad.addColorStop(1, env.mix(c.bg2, c.accent, day * 0.15));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = env.alpha(c.fg, 0.35);
  for (const p of env.points(w, h, 8)) {
    g.beginPath();
    g.arc(p.x, p.y, 1.2 * v.scale, 0, TAU);
    g.fill();
  }
  const haze = Math.max(2, Math.round(6 * v.density));
  for (let i = 0; i < haze; i++) {
    const x = ((i * 0.618 + 0.2 + v.turn * 0.31) % 1) * w;
    const y = ((i * 0.41 + 0.1 + v.turn * 0.17) % 1) * h;
    const r = Math.min(w, h) * (0.08 + (i % 3) * 0.04) * v.scale;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, env.alpha(c.fg, 0.05));
    d.addColorStop(1, env.alpha(c.fg, 0));
    g.fillStyle = d;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineWidth = 1;
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = env.alpha(c.muted, pass ? 0.3 : 0.12);
    g.beginPath();
    for (let col = 0; col <= GC; col++) {
      if ((col % 5 === 0) !== !!pass) continue;
      g.moveTo(geo.x(col), geo.top);
      g.lineTo(geo.x(col), geo.bottom);
    }
    for (let row = 0; row <= GR; row++) {
      if ((row % 5 === 0) !== !!pass) continue;
      g.moveTo(geo.left, geo.y(row));
      g.lineTo(geo.right, geo.y(row));
    }
    g.stroke();
  }
  const small = Math.max(7, Math.min(11, Math.round(geo.sq * 0.5)));
  for (let col = 0; col <= GC; col += 5) write(g, String(col), geo.x(col), geo.bottom + small * 0.9, small, 'center', env.alpha(c.muted, 0.8));
  for (let row = 5; row <= GR; row += 5) write(g, String(row), geo.left - small * 0.4, geo.y(row), small, 'right', env.alpha(c.muted, 0.8));
  return geo;
}

// The scale bar: exactly one square long, so the grid can be trusted.
function scaleBar(g, env, geo, x, y, size) {
  const c = env.colors;
  g.strokeStyle = env.alpha(c.fg, 0.9);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + geo.sq, y);
  g.moveTo(x, y - 3);
  g.lineTo(x, y + 3);
  g.moveTo(x + geo.sq, y - 3);
  g.lineTo(x + geo.sq, y + 3);
  g.stroke();
  write(g, '1 square = ' + KM + ' km', x + geo.sq + size * 0.5, y, size, 'left', env.alpha(c.fg, 0.9));
}

function arrow(g, x0, y0, x1, y1, head) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head);
  g.lineTo(x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head);
  g.closePath();
  g.fill();
}

// A twenty-four hour dial: 0 at the top is midnight, 12 at the bottom is noon. One hand for the
// hour now, and a fainter one for the hour the visitor has named, if they have; the hour now is
// written beside it.
function clock(g, env, x, y, r, hour, guess, size) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.bg, 0.75);
  g.strokeStyle = env.alpha(c.fg, 0.6);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.stroke();
  g.strokeStyle = env.alpha(c.fg, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU - Math.PI / 2;
    const inner = i % 6 === 0 ? 0.74 : 0.86;
    g.moveTo(x + Math.cos(a) * r * inner, y + Math.sin(a) * r * inner);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.stroke();
  const hand = (hr, tone, width, len) => {
    const a = (hr / 24) * TAU - Math.PI / 2;
    g.strokeStyle = tone;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r * len, y + Math.sin(a) * r * len);
    g.stroke();
  };
  if (guess != null) hand(guess, env.alpha(c.accent, 0.8), 1.5, 0.6);
  hand(hour, c.accent2, 2, 0.7);
  g.fillStyle = c.accent2;
  g.beginPath();
  g.arc(x, y, 2, 0, TAU);
  g.fill();
  const digit = Math.max(6, Math.round(size * 0.7));
  write(g, '0', x, y - r * 0.55, digit, 'center', env.alpha(c.fg, 0.8));
  write(g, '12', x, y + r * 0.55, digit, 'center', env.alpha(c.fg, 0.8));
  write(g, 'now ' + fmt(hour), x - r - size * 0.5, y, size, 'right', c.accent2, '600');
}

// A slip printed over the map once a puzzle is solved. It arrives the way anything arrives here:
// it travels down from the top edge in the piece's landing, the first tread the longest, and its
// paper is cut in behind the piece's edge in those same treads, so it comes by its area as it
// comes down. Its rule and its words are cut on once it is down.
function slip(g, w, h, env, lines, rise, size) {
  if (!lines || rise <= 0) return;
  const c = env.colors;
  const rite = riteOf(env);
  const down = rite.ease(rise);
  if (down <= 0) return;
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, g.measureText(l).width);
  const lh = size * 1.5;
  const pad = size;
  const bw = Math.min(w * 0.9, widest + pad * 2);
  const bh = lines.length * lh + pad * 2;
  const x = (w - bw) / 2;
  const y = -bh + down * ((h - bh) / 2 + bh);
  rite.paint(g, x, y, bw, bh, down, env.alpha(c.bg, 0.94));
  if (down < 1) return;
  g.strokeStyle = env.alpha(c.fg, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x, y, bw, bh, size * 0.5);
  g.stroke();
  lines.forEach((l, i) => write(g, l, x + pad, y + pad + lh * (i + 0.5), size, 'left', env.alpha(i === 0 ? c.accent2 : c.fg, 0.92)));
}

function station(g, env, x, y, r, letter, size) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.bg, 0.85);
  g.strokeStyle = c.accent2;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.stroke();
  if (letter) write(g, letter, x, y + 0.5, size, 'center', c.fg, '700');
  else {
    g.fillStyle = c.accent2;
    g.beginPath();
    g.arc(x, y, r * 0.35, 0, TAU);
    g.fill();
  }
}

/* ---- when the front arrives ---------------------------------------------------------------- */

function frontHours(plan) {
  return (plan.squares * KM) / plan.speed;
}

function frontOk(p) {
  if (!p || p.kind !== 'front' || !SIDES.includes(p.side)) return false;
  if (!Array.isArray(p.station) || p.station.length !== 2 || !p.station.every(Number.isInteger)) return false;
  const [c, r] = p.station;
  const d = p.squares;
  if (!Number.isInteger(d) || d < 3 || d > 12 || !SPEEDS.includes(p.speed) || (d * KM) % p.speed !== 0) return false;
  if (!Number.isInteger(p.now) || p.now < 0 || p.now > 23) return false;
  if (c < 2 || c > GC - 2 || r < 2 || r > GR - 2) return false;
  const line = p.side === 'north' ? r - d : p.side === 'south' ? r + d : p.side === 'west' ? c - d : c + d;
  const limit = p.side === 'north' || p.side === 'south' ? GR : GC;
  return line >= 1 && line <= limit - 1;
}

function frontPlan(env) {
  for (let guard = 0; guard < 80; guard++) {
    const side = env.pick(SIDES);
    const vertical = side === 'north' || side === 'south';
    const squares = env.int(3, vertical ? GR - 3 : 12);
    const speeds = SPEEDS.filter((v) => (squares * KM) % v === 0);
    const speed = env.pick(speeds);
    const c = vertical ? env.int(3, GC - 3) : side === 'west' ? env.int(squares + 1, GC - 2) : env.int(2, GC - 1 - squares);
    const r = !vertical ? env.int(3, GR - 3) : side === 'north' ? env.int(squares + 1, GR - 2) : env.int(2, GR - 1 - squares);
    const plan = { kind: 'front', station: [c, r], side, squares, speed, now: env.int(0, 23) };
    if (frontOk(plan)) return plan;
  }
  return { kind: 'front', station: [10, 9], side: 'north', squares: 6, speed: 20, now: 21 };
}

function carriedFront(env) {
  const p = env.card && env.card.of;
  if (!frontOk(p)) return null;
  return { kind: 'front', station: p.station.slice(), side: p.side, squares: p.squares, speed: p.speed, now: p.now };
}

function frontTitle(plan) {
  return 'when the front arrives: ' + plan.speed + ' km/h';
}

// The front line's row or column, and the unit step of the wind (from the front toward the
// station), in squares.
function frontLine(plan, sweep) {
  const [c, r] = plan.station;
  const d = plan.squares * (1 - (sweep || 0));
  switch (plan.side) {
    case 'north': return { vertical: false, at: r - d, dx: 0, dy: 1 };
    case 'south': return { vertical: false, at: r + d, dx: 0, dy: -1 };
    case 'west': return { vertical: true, at: c - d, dx: 1, dy: 0 };
    default: return { vertical: true, at: c + d, dx: -1, dy: 0 };
  }
}

// Where the guess hand stands on the piece's clock: turning from where it was (guessFrom, an hour
// that may be fractional when the hand was caught mid-turn) to the hour named, the shorter way
// round, in the ratchet's even clicks; null when no hour has been named.
function guessHand(env, plan, s) {
  if (s.guess == null) return null;
  const from = s.guessFrom == null ? plan.now : s.guessFrom;
  const diff = ((((s.guess - from + 12) % 24) + 24) % 24) - 12;
  return from + diff * riteOf(env).ratchet(prog(env, s.t, s.guessAt == null ? 0 : s.guessAt, 1.2));
}

// The side the station's word names on the map: a side named is cut on at the flicker's one
// moment, and a side renamed is cut straight from the old word to the new at that moment, the old
// one standing until then (sideWas), so the place is never blank between.
function sideShown(env, s) {
  if (s.sideAt == null || riteOf(env).flicker(prog(env, s.t, s.sideAt, 1))) return s.side;
  return s.sideWas;
}

// The ceremony's steps as they are drawn -- the square the front stands on, the rain's tread and
// the slip's -- which is all of it that changes the picture between two frames.
function frontKey(env, plan, s) {
  const rite = riteOf(env);
  return Math.round(rite.ease(s.sweep) * plan.squares) + '|' + rite.stair(s.rain) + '|' + rite.ease(s.rise);
}

function drawFront(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const marks = s.marks || {};
  const geo = ground(g, w, h, env, v, plan.now);
  const size = Math.max(8, Math.min(13, Math.round(geo.sq * 0.6)));
  // Once the forecast is logged the front comes in to the station in the piece's landing, the
  // first tread the longest, and every tread ends on a line of the grid: the map counts in
  // squares, so the front never stands between two.
  const line = frontLine(plan, Math.round(rite.ease(s.sweep) * plan.squares) / plan.squares);
  const [sc, sr] = plan.station;
  // The air the front brings: the map behind the front in two shades of its tone, split by the
  // piece's edge halfway across -- a surface at rest is never a flat tint and never a texture --
  // and the front itself with its teeth toward the station.
  const tone = c.accent;
  let air;
  if (line.vertical) {
    const x = geo.x(line.at);
    air = line.dx > 0 ? { x: geo.left, y: geo.top, w: x - geo.left, h: geo.bottom - geo.top }
      : { x, y: geo.top, w: geo.right - x, h: geo.bottom - geo.top };
  } else {
    const y = geo.y(line.at);
    air = line.dy > 0 ? { x: geo.left, y: geo.top, w: geo.right - geo.left, h: y - geo.top }
      : { x: geo.left, y, w: geo.right - geo.left, h: geo.bottom - y };
  }
  if (air.w > 0 && air.h > 0) {
    g.fillStyle = env.alpha(tone, 0.12);
    cover(g, rite, air.x, air.y, air.w, air.h, 1);
  }
  // The side the visitor names is marked by its area: a band along that edge of the map comes in
  // behind the piece's edge and rests in two shades, and the band of a side no longer named goes
  // back out the way it came.
  for (const side of SIDES) {
    const k = coverage(env, s.t, marks['side' + side], 1.2);
    if (k <= 0) continue;
    const band = sideBand(geo, side);
    g.fillStyle = env.alpha(c.accent, 0.24);
    cover(g, rite, band.x, band.y, band.w, band.h, k);
  }
  g.strokeStyle = env.alpha(tone, 0.9);
  g.lineWidth = Math.max(1.5, geo.sq * 0.12);
  g.beginPath();
  if (line.vertical) {
    g.moveTo(geo.x(line.at), geo.top);
    g.lineTo(geo.x(line.at), geo.bottom);
  } else {
    g.moveTo(geo.left, geo.y(line.at));
    g.lineTo(geo.right, geo.y(line.at));
  }
  g.stroke();
  const tooth = geo.sq * 0.45;
  g.fillStyle = env.alpha(tone, 0.9);
  const along = line.vertical ? GR : GC;
  for (let k = 1; k < along; k += 2) {
    const px = line.vertical ? geo.x(line.at) : geo.x(k);
    const py = line.vertical ? geo.y(k) : geo.y(line.at);
    g.beginPath();
    g.moveTo(px - line.dy * tooth * 0.6, py - line.dx * tooth * 0.6);
    g.lineTo(px + line.dy * tooth * 0.6, py + line.dx * tooth * 0.6);
    g.lineTo(px + line.dx * tooth, py + line.dy * tooth);
    g.closePath();
    g.fill();
  }
  // The wind: arrows from the front toward the station, as many as the configuration asks.
  const arrows = Math.max(3, Math.round(5 * v.density));
  g.strokeStyle = env.alpha(c.fg, 0.7);
  g.fillStyle = env.alpha(c.fg, 0.7);
  g.lineWidth = 1.2;
  for (let i = 0; i < arrows; i++) {
    const f = (i + 0.5) / arrows;
    const base = line.vertical ? geo.y(f * GR) : geo.x(f * GC);
    const x0 = line.vertical ? geo.x(line.at) + line.dx * geo.sq * 0.9 : base;
    const y0 = line.vertical ? base : geo.y(line.at) + line.dy * geo.sq * 0.9;
    arrow(g, x0, y0, x0 + line.dx * geo.sq * 1.2, y0 + line.dy * geo.sq * 1.2, geo.sq * 0.25);
  }
  // The station, and the instruments under the map: the scale bar, the speed, and the clock.
  const sx = geo.x(sc);
  const sy = geo.y(sr);
  station(g, env, sx, sy, geo.sq * 0.35 * v.scale, '', size);
  write(g, 'the station', sx + geo.sq * 0.55 * v.scale * (sc > GC * 0.7 ? -1 : 1), sy - geo.sq * 0.5, size, sc > GC * 0.7 ? 'right' : 'left', c.accent2, '600');
  scaleBar(g, env, geo, geo.x(0.2), geo.strip, size);
  write(g, 'moving at ' + plan.speed + ' km/h', geo.x(11), geo.strip, size, 'center', c.fg, '600');
  // The hand for the hour the visitor names turns from where it stood in the ratchet's even
  // clicks, the shorter way round the dial.
  clock(g, env, geo.x(GC - 1.2), geo.strip, Math.min(geo.sq * 1.1, geo.sq * v.scale), plan.now, guessHand(env, plan, s), size);
  // What the visitor has said, and what a hint showed, is cut on at the flicker's one moment: a
  // word arrives, it never fades in, and once there it is never blanked. The hint's word stands
  // under the side's word, so it steps down to make room in the very frame the side's word is cut
  // on -- one cut, never a gap and never the two words on one line.
  const side = sideShown(env, s);
  if (side) write(g, 'from the ' + side + '?', sx, sy + geo.sq * 0.9, size, 'center', env.alpha(c.accent, 0.95));
  if (s.hinted && rite.flicker(prog(env, s.t, s.hintAt == null ? 0 : s.hintAt, 1.2))) write(g, plan.squares * KM + ' km out', sx, sy + geo.sq * (side ? 1.6 : 0.9), size, 'center', c.accent2, '600');
  // The rain once the front is in: it comes over the map behind the piece's edge in the stair's
  // treads, falling and leaning with an east or west wind, and then it stands -- weather marked on
  // the map, not a film of it, and kept off the instruments under it.
  const wet = s.rain > 0 ? rite.stair(s.rain) : 0;
  if (wet > 0) {
    const mw = geo.right - geo.left;
    const mh = geo.bottom - geo.top;
    g.save();
    g.beginPath();
    rite.region(g, geo.left, geo.top, mw, mh, wet);
    g.clip();
    g.strokeStyle = env.alpha(c.accent, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 60; i++) {
      const x = geo.left + ((i * 0.618034) % 1) * mw;
      const y = geo.top + ((i * 0.754877) % 1) * mh;
      g.moveTo(x, y);
      g.lineTo(x + line.dx * geo.sq * 0.3, y + geo.sq * 0.45);
    }
    g.stroke();
    g.restore();
  }
  // The solved light: the map takes the ledger's colour by its area, behind the piece's edge in
  // the stair's treads, and rests in two shades.
  const washed = prog(env, s.t, s.doneAt, 2.6);
  if (washed > 0) {
    g.fillStyle = env.alpha(c.accent2, 0.1);
    cover(g, rite, geo.left, geo.top, geo.right - geo.left, geo.bottom - geo.top, rite.stair(washed));
  }
  slip(g, w, h, env, s.lines, s.rise, size);
}

// The live state of a front: t is the piece's clock; sweep, rain and rise are the ceremony's
// progresses, each stepped onto the rite's treads when drawn; marks holds 'side<name>'
// { on, at, n, from } for a side named or un-named, and rolls counts them; guessFrom/guessAt,
// sideAt (with sideWas, the word that stood before), hintAt and doneAt are when the hour was named,
// the side named, the hint shown and the piece solved; drawn, drawnKey and drawnAt are the size,
// the ceremony's step and the moment of the picture on the canvas (settled). A card is the blank
// state and no more.
function frontBlank() {
  return { t: 0, sweep: 0, guess: null, side: '', sideWas: '', hinted: false, rain: 0, lines: null, rise: 0,
    marks: {}, rolls: 0, guessFrom: null, guessAt: null, sideAt: null, hintAt: null, doneAt: null,
    drawn: null, drawnKey: null, drawnAt: -1 };
}

function frontPreview(g, w, h, env, plan) {
  drawFront(g, w, h, env, plan, frontBlank(), env.variant);
}

function frontPiece(env, plan) {
  const hours = frontHours(plan);
  const arrives = (plan.now + hours) % 24;
  const { helps, margin } = asked(env);
  const s = frontBlank();
  const draw = (c) => {
    drawFront(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnKey = frontKey(c, plan, s);
    s.drawnAt = s.t;
  };
  return {
    title: frontTitle(plan),
    brief: 'The station keeps its vigil. A front is coming in toward the station along the wind, at the speed written beside it. One square of the grid is ten kilometres; the scale bar says so. The dial goes the whole day round, 0 at the top being midnight, and its hand stands at the hour now.',
    goal: 'Say the hour the front reaches the station, and which side it comes from.',
    aspect: '4 / 3',
    checkLabel: 'log the forecast',
    steps: [
      { id: 'hour', ask: 'the hour it arrives, on the 24-hour dial', kind: 'number', min: 0, max: 23, step: 1, value: 0, unit: 'h' },
      { id: 'side', ask: 'the side it comes from', kind: 'choice', options: SIDES.map((side) => ({ label: 'from the ' + side, value: side })) },
      // The station has one thing to say, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'hint', ask: 'how far out it is', kind: 'press', count: 1, label: 'show me', optional: true } : null
    ].filter(Boolean),
    solution: { hour: arrives, side: plan.side },
    check(c) {
      const hour = Math.round(Number(c.value('hour')));
      // The hour is read off a dial, so it is a measured answer: the difficulty says how many
      // hours out a reading may be and still be logged (none from the middle of the dial up).
      const hourRight = Math.abs(hour - arrives) <= margin;
      const sideRight = c.value('side') === plan.side;
      if (hourRight && sideRight) return { solved: true, say: 'entered in the ledger: the front arrives from the ' + plan.side + ' at ' + fmt(arrives) };
      const parts = [];
      if (!hourRight) {
        const waited = Number.isFinite(hour) ? ((hour - plan.now) % 24 + 24) % 24 : NaN;
        if (!Number.isFinite(waited)) parts.push('the hour is off');
        else parts.push(waited < hours ? 'the hour is off: the front needs more time than that' : 'the hour is off: the front is in before then');
      }
      parts.push(sideRight ? 'the side is right' : 'the side is off');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('now ' + fmt(plan.now) + '; the front is moving at ' + plan.speed + ' km/h');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'hour') {
        const n = Math.round(Number(value));
        // The hand sets out from where it stands now, even if caught mid-ratchet.
        const standing = guessHand(c, plan, s);
        s.guessFrom = standing == null ? plan.now : ((standing % 24) + 24) % 24;
        s.guess = Number.isFinite(n) ? clamp(n, 0, 23) : null;
        s.guessAt = s.t;
        c.status('you say ' + fmt(s.guess));
      }
      if (id === 'side') {
        const next = SIDES.includes(value) ? value : '';
        if (next !== s.side) {
          // The band of the side no longer named goes out and the new one comes in, each from
          // where it stands; the word is cut from the one standing now to the new one.
          s.sideWas = sideShown(c, s);
          if (s.side) remark(c, s, 'side' + s.side, false, 1.2);
          if (next) remark(c, s, 'side' + next, true, 1.2);
          s.side = next;
          s.sideAt = s.t;
        }
        c.status('you say it comes from the ' + s.side);
      }
      if (id === 'hint') {
        if (!s.hinted) {
          s.hinted = true;
          s.hintAt = s.t;
          c.hint();
          c.status('the front is ' + plan.squares * KM + ' km from the station');
        } else {
          c.status('the distance is shown; the speed and the clock are on the map');
        }
      }
      draw(c);
    },
    // Once solved, the ceremony plays in order -- the front comes in, then the rain, while the
    // ledger's slip comes down -- and each part rests at its end. Less motion is shown where they
    // all end at once. A frame is drawn only when it has something new on it: a step of the
    // ceremony, or a change still coming its way; otherwise the map stands as it was drawn.
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.sweep = c.reduced ? 1 : Math.min(1, s.sweep + dt * 0.25);
        if (s.sweep >= 1) s.rain = c.reduced ? 1 : Math.min(1, s.rain + dt * 0.6);
        if (s.lines) s.rise = c.reduced ? 1 : Math.min(1, s.rise + dt * 1.2);
      }
      if (settled(s, c, frontKey(c, plan, s), latest(s, [s.guessAt, s.sideAt, s.hintAt, s.doneAt]))) return;
      draw(c);
    },
    end(c) {
      s.lines = ['front ledger', 'from the ' + plan.side + ', ' + plan.squares * KM + ' km at ' + plan.speed + ' km/h', 'arrived ' + fmt(arrives) + (plan.now + hours >= 24 ? ', past midnight' : '')];
      s.doneAt = s.t;
      c.status('the front comes in from the ' + plan.side + ' and reaches the station at ' + fmt(arrives));
    }
  };
}

/* ---- the pressure map ---------------------------------------------------------------------- */

function highest(stations) {
  let best = 0;
  stations.forEach((q, i) => { if (q.p > stations[best].p) best = i; });
  return best;
}

function lowest(stations) {
  let best = 0;
  stations.forEach((q, i) => { if (q.p < stations[best].p) best = i; });
  return best;
}

// The way the wind blows, from the highest station toward the lowest, by the axis it mostly follows.
function windWay(stations) {
  const a = stations[highest(stations)];
  const b = stations[lowest(stations)];
  const dx = b.c - a.c;
  const dy = b.r - a.r;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

function pressureOk(p) {
  if (!p || p.kind !== 'pressure' || !Array.isArray(p.stations) || p.stations.length < 5 || p.stations.length > 6) return false;
  const st = p.stations;
  if (!st.every((q) => q && Number.isInteger(q.c) && Number.isInteger(q.r) && Number.isInteger(q.p)
    && q.c >= 2 && q.c <= GC - 2 && q.r >= 2 && q.r <= GR - 2 && q.p >= 980 && q.p <= 1040)) return false;
  if (new Set(st.map((q) => q.p)).size !== st.length) return false;
  for (let i = 0; i < st.length; i++) {
    for (let j = i + 1; j < st.length; j++) {
      if (Math.max(Math.abs(st[i].c - st[j].c), Math.abs(st[i].r - st[j].r)) < 3) return false;
    }
  }
  const a = st[highest(st)];
  const b = st[lowest(st)];
  const dx = Math.abs(b.c - a.c);
  const dy = Math.abs(b.r - a.r);
  if (!(dx >= 2 * dy + 1 || dy >= 2 * dx + 1)) return false;
  return a.p - b.p >= 8;
}

// Most maps read five stations; a crowded one reads six.
function pressurePlan(env) {
  const n = env.chance(0.35) ? 6 : 5;
  for (let guard = 0; guard < 300; guard++) {
    const stations = [];
    for (let i = 0; i < n; i++) stations.push({ c: env.int(2, GC - 2), r: env.int(2, GR - 2), p: env.int(980, 1040) });
    const plan = { kind: 'pressure', stations };
    if (pressureOk(plan)) return plan;
  }
  return { kind: 'pressure', stations: [{ c: 3, r: 4, p: 1024 }, { c: 15, r: 3, p: 1001 }, { c: 9, r: 8, p: 1012 }, { c: 4, r: 12, p: 1009 }, { c: 16, r: 11, p: 996 }] };
}

function carriedPressure(env) {
  const p = env.card && env.card.of;
  if (!pressureOk(p)) return null;
  return { kind: 'pressure', stations: p.stations.map((q) => ({ c: q.c, r: q.r, p: q.p })) };
}

function pressureTitle(plan) {
  return plan.stations.length === 6 ? 'the crowded map: six stations' : 'the pressure map: five stations';
}

// The legend under the map: what the visitor says, or what the map is when they have said nothing.
const QUIET = 'readings in hPa; the wind blows high to low';
function legendOf(s) {
  const said = [];
  if (s.toward >= 0) said.push('toward ' + LETTERS[s.toward]);
  if (s.way) said.push('blowing ' + s.way);
  if (s.gap != null) said.push(s.gap + ' hPa between');
  return said.length ? 'you say: ' + said.join(', ') : QUIET;
}

// The words as they stand on the map. A change of what the visitor says is cut on at the flicker's
// one moment, and until then the words that stood before stay (saidWas, towardWas): the legend is
// cut straight from the old line to the new, and 'toward here?' straight from the station it was
// under to the one now named -- never a blank between, never off and back on.
function legendShown(env, s) {
  if (s.saidAt == null || riteOf(env).flicker(prog(env, s.t, s.saidAt, 0.8))) return legendOf(s);
  return s.saidWas;
}

function towardShown(env, s) {
  if (s.towardAt == null || riteOf(env).flicker(prog(env, s.t, s.towardAt, 1))) return s.toward;
  return s.towardWas;
}

// The ceremony's steps as they are drawn -- the arrow's tread and the slip's.
function pressureKey(env, s) {
  const rite = riteOf(env);
  return rite.ease(s.blow) + '|' + rite.ease(s.rise);
}

function drawPressure(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = ground(g, w, h, env, v, 21);
  const size = Math.max(8, Math.min(13, Math.round(geo.sq * 0.6)));
  const st = plan.stations;
  const rite = riteOf(env);
  const marks = s.marks || {};
  const ranked = st.map((q, i) => i).sort((a, b) => st[a].p - st[b].p);
  // Each station with its reading, ringed the more the higher its pressure stands. The station
  // the visitor names is marked by its area -- a halo comes in behind the piece's edge and rests
  // in two shades, and the halo of one no longer named goes back out the way it came -- and the
  // one a hint shows has its halo cut in the same way, on a roll of its own.
  const toward = towardShown(env, s);
  st.forEach((q, i) => {
    const x = geo.x(q.c);
    const y = geo.y(q.r);
    const rings = 1 + ranked.indexOf(i);
    g.lineWidth = 1;
    for (let k = 1; k <= rings; k++) {
      g.strokeStyle = env.alpha(rings > 3 ? c.accent2 : c.accent, 0.4 - k * 0.06);
      g.beginPath();
      g.ellipse(x, y, geo.sq * (0.5 + k * 0.24) * v.scale, geo.sq * (0.4 + k * 0.19) * v.scale, (i * 0.7 + v.turn) % Math.PI, 0, TAU);
      g.stroke();
    }
    disc(g, rite, x, y, geo.sq * 0.95 * v.scale, coverage(env, s.t, marks['toward' + i], 1), env.alpha(c.accent, 0.3));
    const shown = s.hinted === i ? prog(env, s.t, s.hintAt == null ? 0 : s.hintAt, 1.3) : 0;
    if (shown > 0) disc(g, rite, x, y, geo.sq * 0.95 * v.scale, rolled(rite, 0x417).stair(shown), env.alpha(c.accent2, 0.3));
    station(g, env, x, y, geo.sq * 0.42 * v.scale, LETTERS[i], size);
    const below = q.r > GR - 4;
    write(g, q.p + ' hPa', x, y + (below ? -1 : 1) * geo.sq * 0.95, size, 'center', c.fg, '600');
    if (toward === i) write(g, 'toward here?', x, y + (below ? -1 : 1) * geo.sq * 0.95 + (below ? -1 : 1) * size * 1.2, size, 'center', env.alpha(c.accent, 0.95));
    if (s.hinted === i && rite.flicker(shown)) write(g, 'the wind blows from here', x, y + (below ? -1 : 1) * geo.sq * 0.95 + (below ? -1 : 1) * size * 1.2, size, 'center', c.accent2, '600');
  });
  // The compass rose under the map, so a way can be named, and the legend beside it.
  const cx = geo.x(GC - 1.2);
  const cy = geo.strip;
  const cr = Math.min(geo.sq * 0.8, geo.sq * 0.75 * v.scale);
  g.strokeStyle = env.alpha(c.fg, 0.6);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx, cy - cr);
  g.lineTo(cx, cy + cr);
  g.moveTo(cx - cr, cy);
  g.lineTo(cx + cr, cy);
  g.stroke();
  write(g, 'N', cx, cy - cr - size * 0.55, size, 'center', c.accent2, '700');
  write(g, 'S', cx, cy + cr + size * 0.55, size, 'center', env.alpha(c.fg, 0.8));
  write(g, 'E', cx + cr + size * 0.5, cy, size, 'center', env.alpha(c.fg, 0.8));
  write(g, 'W', cx - cr - size * 0.5, cy, size, 'center', env.alpha(c.fg, 0.8));
  // The legend, cut straight from the old line to the new when what the visitor says changes.
  const legend = legendShown(env, s);
  write(g, legend, geo.x(0.2), cy, size, 'left', env.alpha(legend === QUIET ? c.fg : c.accent, 0.9));
  // The wind drawn in, once the puzzle is solved: its arrow travels from the highest reading to
  // the lowest in the piece's landing, the first tread the longest, and rests there.
  if (s.blow > 0) {
    const a = st[highest(st)];
    const b = st[lowest(st)];
    const gone = rite.ease(s.blow);
    if (gone > 0) {
      g.strokeStyle = env.alpha(c.accent2, 0.9);
      g.fillStyle = env.alpha(c.accent2, 0.9);
      g.lineWidth = Math.max(1.5, geo.sq * 0.1);
      const x1 = geo.x(a.c) + (geo.x(b.c) - geo.x(a.c)) * gone;
      const y1 = geo.y(a.r) + (geo.y(b.r) - geo.y(a.r)) * gone;
      arrow(g, geo.x(a.c), geo.y(a.r), x1, y1, geo.sq * 0.4);
    }
  }
  // The solved light: the map takes the ledger's colour by its area, behind the piece's edge in
  // the stair's treads, and rests in two shades.
  const washed = prog(env, s.t, s.doneAt, 2.6);
  if (washed > 0) {
    g.fillStyle = env.alpha(c.accent2, 0.1);
    cover(g, rite, geo.left, geo.top, geo.right - geo.left, geo.bottom - geo.top, rite.stair(washed));
  }
  slip(g, w, h, env, s.lines, s.rise, size);
}

// The live state of a pressure map: t is the piece's clock; blow and rise are the ceremony's
// progresses, each stepped onto the rite's treads when drawn; marks holds 'toward<i>'
// { on, at, n, from } for a station named or un-named, and rolls counts them; towardAt and saidAt
// (with towardWas and saidWas, what stood before) are when the station named and the legend last
// changed, and hintAt and doneAt when the hint was shown and the piece solved; drawn, drawnKey and
// drawnAt are the size, the ceremony's step and the moment of the picture on the canvas
// (settled). A card is the blank state and no more.
function pressureBlank() {
  return { t: 0, toward: -1, way: '', gap: null, hinted: -1, blow: 0, lines: null, rise: 0,
    marks: {}, rolls: 0, towardWas: -1, towardAt: null, saidWas: QUIET, saidAt: null, hintAt: null, doneAt: null,
    drawn: null, drawnKey: null, drawnAt: -1 };
}

function pressurePreview(g, w, h, env, plan) {
  drawPressure(g, w, h, env, plan, pressureBlank(), env.variant);
}

function pressurePiece(env, plan) {
  const { helps, margin } = asked(env);
  const st = plan.stations;
  const hi = highest(st);
  const lo = lowest(st);
  const way = windWay(st);
  const gap = st[hi].p - st[lo].p;
  const s = pressureBlank();
  const draw = (c) => {
    drawPressure(c.g, c.w, c.h, c, plan, s, env.variant);
    s.drawn = sizeOf(c);
    s.drawnKey = pressureKey(c, s);
    s.drawnAt = s.t;
  };
  return {
    title: pressureTitle(plan),
    brief: 'A reading taken from ' + COUNT[st.length] + ' stations, each reporting its pressure. The wind blows from the station reading highest toward the one reading lowest, and the compass in the corner has north at the top. Name the way it blows by whichever axis it mostly follows.',
    goal: 'Name the station the wind blows toward, the way it blows, and the pressure difference between the two.',
    aspect: '4 / 3',
    checkLabel: 'log the wind',
    steps: [
      { id: 'toward', ask: 'the station the wind blows toward', kind: 'pick', count: 1, items: st.map((q, i) => ({ label: 'station ' + LETTERS[i], value: i })) },
      { id: 'way', ask: 'the way it blows', kind: 'choice', options: SIDES.map((side) => ({ label: side, value: side })) },
      { id: 'gap', ask: 'the pressure difference between the two', kind: 'number', min: 1, max: 60, step: 1, value: 1, unit: 'hPa' },
      helps > 1 ? { id: 'hint', ask: 'the station it blows from', kind: 'press', count: 1, label: 'show me', optional: true } : null
    ].filter(Boolean),
    solution: { toward: [lo], way, gap },
    check(c) {
      const toward = c.value('toward');
      const towardRight = Array.isArray(toward) && toward.length === 1 && Number(toward[0]) === lo;
      const wayRight = c.value('way') === way;
      const n = Math.round(Number(c.value('gap')));
      // A difference read off five dials: the difficulty says how many hPa out it may be.
      const gapRight = Math.abs(n - gap) <= margin;
      if (towardRight && wayRight && gapRight) return { solved: true, say: 'entered in the ledger: ' + gap + ' hPa from station ' + LETTERS[hi] + ' to station ' + LETTERS[lo] + ', blowing ' + way };
      const parts = [];
      parts.push(towardRight ? 'the station is right' : 'the wind does not blow toward that station');
      if (!wayRight) {
        const saidWay = c.value('way');
        const axis = (s) => (s === 'north' || s === 'south' ? 'ns' : 'ew');
        parts.push(SIDES.includes(saidWay) && axis(saidWay) === axis(way)
          ? 'the axis is right, but the wind runs the other way along it'
          : 'the way is off: the wind follows the other axis');
      }
      if (!gapRight) parts.push(n < gap ? 'the difference is larger than that' : 'the difference is smaller than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(COUNT[st.length] + ' readings; the wind blows from the highest to the lowest');
      draw(c);
    },
    apply(id, value, c) {
      // The legend as it stands now: if what is said below changes it, it is cut from this line.
      const legend = legendShown(c, s);
      if (id === 'toward') {
        const next = Array.isArray(value) && value.length ? Number(value[0]) : -1;
        if (next !== s.toward) {
          // The halo of the station no longer named goes out and the new one comes in, each from
          // where it stands; the word is cut from the station it stands under now to the new one.
          s.towardWas = towardShown(c, s);
          if (s.toward >= 0) remark(c, s, 'toward' + s.toward, false, 1);
          if (next >= 0) remark(c, s, 'toward' + next, true, 1);
          s.toward = next;
          s.towardAt = s.t;
        }
        c.status(s.toward >= 0 ? 'you say it blows toward station ' + LETTERS[s.toward] : 'no station marked');
      }
      if (id === 'way') {
        s.way = SIDES.includes(value) ? value : '';
        c.status('you say it blows ' + s.way);
      }
      if (id === 'gap') {
        const n = Math.round(Number(value));
        s.gap = Number.isFinite(n) ? clamp(n, 1, 60) : null;
        c.status('you say the difference is ' + s.gap + ' hPa');
      }
      if (legendOf(s) !== legend) {
        s.saidWas = legend;
        s.saidAt = s.t;
      }
      if (id === 'hint') {
        if (s.hinted < 0) {
          s.hinted = hi;
          s.hintAt = s.t;
          c.hint();
          c.status('the wind blows from station ' + LETTERS[hi] + ', the highest reading');
        } else {
          c.status('the station it blows from is shown; the lowest reading is where it goes');
        }
      }
      draw(c);
    },
    // Once solved, the wind's arrow is drawn in while the ledger's slip comes down, and each rests
    // at its end; less motion is shown where they end at once. A frame is drawn only when it has
    // something new on it (settled), as on the front's map.
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.blow = c.reduced ? 1 : Math.min(1, s.blow + dt * 0.5);
        if (s.lines) s.rise = c.reduced ? 1 : Math.min(1, s.rise + dt * 1.2);
      }
      if (settled(s, c, pressureKey(c, s), latest(s, [s.towardAt, s.saidAt, s.hintAt, s.doneAt]))) return;
      draw(c);
    },
    end(c) {
      s.lines = ['wind ledger', 'from station ' + LETTERS[hi] + ' (' + st[hi].p + ' hPa) to station ' + LETTERS[lo] + ' (' + st[lo].p + ' hPa)', 'blowing ' + way + ', ' + gap + ' hPa between them'];
      s.doneAt = s.t;
      c.status('the wind blows ' + way + ' from station ' + LETTERS[hi] + ' to station ' + LETTERS[lo] + ', ' + gap + ' hPa between them');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the two this card is, and its plan, dealt once from the env's seeded stream and kept
// with that env. Every pass over one card -- paint, the spark's paint and piece() -- asks here, so
// they are all the same card; dealing on each pass instead would hand each a different puzzle
// (issue #92, and js/feed.js on what a module owes a card).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const front = env.chance(0.55);
    got = { front, plan: front ? frontPlan(env) : pressurePlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'constellation-weather',
  needsSky: true,
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.front) frontPreview(g, w, h, env, d.plan);
    else pressurePreview(g, w, h, env, d.plan);
  },
  // The card is the map waiting for its forecast, and nothing on a waiting map moves (see "the
  // rite" above): it says so, and the feed lets it go rather than redrawing a still map thirty
  // times a second.
  animate() {
    return false;
  },
  spark(env) {
    if (!env.stars.length) return null;
    const d = deal(env);
    if (d.front) {
      const plan = d.plan;
      return {
        title: frontTitle(plan),
        mono: 'now ' + fmt(plan.now) + '\nfront: ' + plan.squares + ' squares out, ' + plan.speed + ' km/h\n1 square = ' + KM + ' km',
        text: 'An omen on the map: a front is coming in along the wind. Read the map and the dial, and say when it reaches the station, and from which side.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => frontPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: pressureTitle(plan),
      mono: plan.stations.map((q, i) => LETTERS[i] + ': ' + q.p + ' hPa').join('\n'),
      text: (plan.stations.length === 6 ? 'Six stations, six readings.' : 'Five stations, five readings.') + ' The wind blows from the highest to the lowest. Say where it goes, which way, and by how much.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => pressurePreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const front = carriedFront(env);
    if (front) return frontPiece(env, front);
    const pressure = carriedPressure(env);
    if (pressure) return pressurePiece(env, pressure);
    const d = deal(env);
    return d.front ? frontPiece(env, d.plan) : pressurePiece(env, d.plan);
  }
};
