/* The weather lab: a synoptic map under the persona's stars, and two puzzles read off it. As a
   card it is the map the seed deals, drawn small (paint, spark); as a piece it is one of the two
   puzzles below, and the card it was opened from says which. See js/feed.js for what a module is
   and js/stage.js for what a piece is.

   Two puzzles, both deduction:

     when the front arrives  A station marked on a gridded map, a front some squares off on one
                             side, moving toward it at a stated speed, and a clock showing the
                             hour now. One square is ten kilometres, and the scale bar says so.
                             Say the hour the front reaches the station, past midnight if it must,
                             and which side it comes from. A wrong check says only that the hour
                             is off, or that the side is right.
     the pressure map        Five stations with their pressure readings. The wind blows from the
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
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
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
// glinting through, and a drift of haze from the configuration.
function ground(g, w, h, env, v, hour, t) {
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
    const x = ((i * 0.618 + 0.2 + v.turn * 0.31 + Math.sin((t || 0) * 0.2 + i) * 0.02) % 1) * w;
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

// A slip printed over the map once a puzzle is solved: it comes down from the top edge.
function slip(g, w, h, env, lines, rise, size) {
  if (!lines || rise <= 0) return;
  const c = env.colors;
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, g.measureText(l).width);
  const lh = size * 1.5;
  const pad = size;
  const bw = Math.min(w * 0.9, widest + pad * 2);
  const bh = lines.length * lh + pad * 2;
  const x = (w - bw) / 2;
  const y = -bh + rise * ((h - bh) / 2 + bh);
  g.fillStyle = env.alpha(c.bg, 0.92);
  g.strokeStyle = env.alpha(c.fg, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x, y, bw, bh, size * 0.5);
  g.fill();
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

function drawFront(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = ground(g, w, h, env, v, plan.now, s.t);
  const size = Math.max(8, Math.min(13, Math.round(geo.sq * 0.6)));
  const line = frontLine(plan, s.sweep);
  const [sc, sr] = plan.station;
  // The air the front brings, shaded behind it, and the front itself with its teeth toward the
  // station.
  const tone = c.accent;
  g.fillStyle = env.alpha(tone, 0.1);
  if (line.vertical) {
    const x = geo.x(line.at);
    if (line.dx > 0) g.fillRect(geo.left, geo.top, x - geo.left, geo.bottom - geo.top);
    else g.fillRect(x, geo.top, geo.right - x, geo.bottom - geo.top);
  } else {
    const y = geo.y(line.at);
    if (line.dy > 0) g.fillRect(geo.left, geo.top, geo.right - geo.left, y - geo.top);
    else g.fillRect(geo.left, y, geo.right - geo.left, geo.bottom - y);
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
  clock(g, env, geo.x(GC - 1.2), geo.strip, Math.min(geo.sq * 1.1, geo.sq * v.scale), plan.now, s.guess, size);
  if (s.side) write(g, 'from the ' + s.side + '?', sx, sy + geo.sq * 0.9, size, 'center', env.alpha(c.accent, 0.95));
  if (s.hinted) write(g, plan.squares * KM + ' km out', sx, sy + geo.sq * (s.side ? 1.6 : 0.9), size, 'center', c.accent2, '600');
  if (s.rain > 0) {
    g.strokeStyle = env.alpha(c.accent, 0.5 * s.rain);
    g.lineWidth = 1;
    g.beginPath();
    const n = Math.round(60 * s.rain);
    for (let i = 0; i < n; i++) {
      const x = ((i * 0.618034 + s.t * 0.05) % 1) * w;
      const y = ((i * 0.754877 + s.t * 0.4) % 1) * h;
      g.moveTo(x, y);
      g.lineTo(x + line.dx * geo.sq * 0.3, y + line.dy * geo.sq * 0.3 + geo.sq * 0.3);
    }
    g.stroke();
  }
  slip(g, w, h, env, s.lines, s.rise, size);
}

function frontPreview(g, w, h, env, plan, t) {
  drawFront(g, w, h, env, plan, { t: t || 0, sweep: 0, guess: null, side: '', hinted: false, rain: 0, lines: null, rise: 0 }, env.variant);
}

function frontPiece(env, plan) {
  const hours = frontHours(plan);
  const arrives = (plan.now + hours) % 24;
  const { helps, margin } = asked(env);
  const s = { t: 0, sweep: 0, guess: null, side: '', hinted: false, rain: 0, lines: null, rise: 0 };
  const draw = (c) => drawFront(c.g, c.w, c.h, c, plan, s, env.variant);
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
      if (!hourRight) parts.push('the hour is off');
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
        s.guess = Number.isFinite(n) ? clamp(n, 0, 23) : null;
        c.status('you say ' + fmt(s.guess));
      }
      if (id === 'side') {
        s.side = SIDES.includes(value) ? value : '';
        c.status('you say it comes from the ' + s.side);
      }
      if (id === 'hint') {
        if (!s.hinted) {
          s.hinted = true;
          c.hint();
          c.status('the front is ' + plan.squares * KM + ' km from the station');
        } else {
          c.status('the distance is shown; the speed and the clock are on the map');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.sweep = Math.min(1, s.sweep + dt * 0.25);
        if (s.sweep >= 1) s.rain = Math.min(1, s.rain + dt * 0.6);
        if (s.lines) s.rise = Math.min(1, s.rise + dt * 1.2);
      }
      draw(c);
    },
    end(c) {
      s.lines = ['front ledger', 'from the ' + plan.side + ', ' + plan.squares * KM + ' km at ' + plan.speed + ' km/h', 'arrived ' + fmt(arrives) + (plan.now + hours >= 24 ? ', past midnight' : '')];
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
  if (!p || p.kind !== 'pressure' || !Array.isArray(p.stations) || p.stations.length !== 5) return false;
  const st = p.stations;
  if (!st.every((q) => q && Number.isInteger(q.c) && Number.isInteger(q.r) && Number.isInteger(q.p)
    && q.c >= 2 && q.c <= GC - 2 && q.r >= 2 && q.r <= GR - 2 && q.p >= 980 && q.p <= 1040)) return false;
  if (new Set(st.map((q) => q.p)).size !== 5) return false;
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
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

function pressurePlan(env) {
  for (let guard = 0; guard < 200; guard++) {
    const stations = [];
    for (let i = 0; i < 5; i++) stations.push({ c: env.int(2, GC - 2), r: env.int(2, GR - 2), p: env.int(980, 1040) });
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

function pressureTitle() {
  return 'the pressure map: five stations';
}

function drawPressure(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = ground(g, w, h, env, v, 21, s.t);
  const size = Math.max(8, Math.min(13, Math.round(geo.sq * 0.6)));
  const st = plan.stations;
  const ranked = st.map((q, i) => i).sort((a, b) => st[a].p - st[b].p);
  // Each station with its reading, ringed the more the higher its pressure stands.
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
    station(g, env, x, y, geo.sq * 0.42 * v.scale, LETTERS[i], size);
    const below = q.r > GR - 4;
    write(g, q.p + ' hPa', x, y + (below ? -1 : 1) * geo.sq * 0.95, size, 'center', c.fg, '600');
    if (s.toward === i) write(g, 'toward here?', x, y + (below ? -1 : 1) * geo.sq * 0.95 + (below ? -1 : 1) * size * 1.2, size, 'center', env.alpha(c.accent, 0.95));
    if (s.hinted === i) write(g, 'the wind blows from here', x, y + (below ? -1 : 1) * geo.sq * 0.95 + (below ? -1 : 1) * size * 1.2, size, 'center', c.accent2, '600');
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
  const said = [];
  if (s.toward >= 0) said.push('toward ' + LETTERS[s.toward]);
  if (s.way) said.push('blowing ' + s.way);
  if (s.gap != null) said.push(s.gap + ' hPa between');
  write(g, said.length ? 'you say: ' + said.join(', ') : 'readings in hPa; the wind blows high to low', geo.x(0.2), cy, size, 'left', env.alpha(said.length ? c.accent : c.fg, 0.9));
  // The wind drawn in, once the puzzle is solved: from the highest to the lowest.
  if (s.blow > 0) {
    const a = st[highest(st)];
    const b = st[lowest(st)];
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.fillStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = Math.max(1.5, geo.sq * 0.1);
    const x1 = geo.x(a.c) + (geo.x(b.c) - geo.x(a.c)) * s.blow;
    const y1 = geo.y(a.r) + (geo.y(b.r) - geo.y(a.r)) * s.blow;
    arrow(g, geo.x(a.c), geo.y(a.r), x1, y1, geo.sq * 0.4);
  }
  slip(g, w, h, env, s.lines, s.rise, size);
}

function pressurePreview(g, w, h, env, plan, t) {
  drawPressure(g, w, h, env, plan, { t: t || 0, toward: -1, way: '', gap: null, hinted: -1, blow: 0, lines: null, rise: 0 }, env.variant);
}

function pressurePiece(env, plan) {
  const { helps, margin } = asked(env);
  const st = plan.stations;
  const hi = highest(st);
  const lo = lowest(st);
  const way = windWay(st);
  const gap = st[hi].p - st[lo].p;
  const s = { t: 0, toward: -1, way: '', gap: null, hinted: -1, blow: 0, lines: null, rise: 0 };
  const draw = (c) => drawPressure(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: pressureTitle(),
    brief: 'A reading taken from five stations, each reporting its pressure. The wind blows from the station reading highest toward the one reading lowest, and the compass in the corner has north at the top. Name the way it blows by whichever axis it mostly follows.',
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
      if (!wayRight) parts.push('the way is off');
      if (!gapRight) parts.push(n < gap ? 'the difference is larger than that' : 'the difference is smaller than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('five readings; the wind blows from the highest to the lowest');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'toward') {
        s.toward = Array.isArray(value) && value.length ? Number(value[0]) : -1;
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
      if (id === 'hint') {
        if (s.hinted < 0) {
          s.hinted = hi;
          c.hint();
          c.status('the wind blows from station ' + LETTERS[hi] + ', the highest reading');
        } else {
          c.status('the station it blows from is shown; the lowest reading is where it goes');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.blow = Math.min(1, s.blow + dt * 0.5);
        if (s.lines) s.rise = Math.min(1, s.rise + dt * 1.2);
      }
      draw(c);
    },
    end(c) {
      s.lines = ['wind ledger', 'from station ' + LETTERS[hi] + ' (' + st[hi].p + ' hPa) to station ' + LETTERS[lo] + ' (' + st[lo].p + ' hPa)', 'blowing ' + way + ', ' + gap + ' hPa between them'];
      c.status('the wind blows ' + way + ' from station ' + LETTERS[hi] + ' to station ' + LETTERS[lo] + ', ' + gap + ' hPa between them');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsFront(env) {
  return env.chance(0.55);
}

export default {
  id: 'constellation-weather',
  needsSky: true,
  paint(g, w, h, env) {
    if (dealsFront(env)) frontPreview(g, w, h, env, frontPlan(env), env.variant.turn * 6);
    else pressurePreview(g, w, h, env, pressurePlan(env), env.variant.turn * 6);
  },
  animate(g, w, h, env, t) {
    if (dealsFront(env)) frontPreview(g, w, h, env, frontPlan(env), t + env.variant.turn * 6);
    else pressurePreview(g, w, h, env, pressurePlan(env), t + env.variant.turn * 6);
  },
  spark(env) {
    if (!env.stars.length) return null;
    if (dealsFront(env)) {
      const plan = frontPlan(env);
      return {
        title: frontTitle(plan),
        mono: 'now ' + fmt(plan.now) + '\nfront: ' + plan.squares + ' squares out, ' + plan.speed + ' km/h\n1 square = ' + KM + ' km',
        text: 'An omen on the map: a front is coming in along the wind. Read the map and the dial, and say when it reaches the station, and from which side.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => frontPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 6),
        of: plan
      };
    }
    const plan = pressurePlan(env);
    return {
      title: pressureTitle(),
      mono: plan.stations.map((q, i) => LETTERS[i] + ': ' + q.p + ' hPa').join('\n'),
      text: 'Five stations, five readings. The wind blows from the highest to the lowest. Say where it goes, which way, and by how much.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => pressurePreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 6),
      of: plan
    };
  },
  piece(env) {
    const front = carriedFront(env);
    if (front) return frontPiece(env, front);
    const pressure = carriedPressure(env);
    if (pressure) return pressurePiece(env, pressure);
    return dealsFront(env) ? frontPiece(env, frontPlan(env)) : pressurePiece(env, pressurePlan(env));
  }
};
