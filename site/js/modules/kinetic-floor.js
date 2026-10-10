/* The kinetic floor: heavy blocks, a lot of them, nothing breakable -- and on it, three things a
   visitor can work out before anything is allowed to move. As a card it is one of the three puzzles
   below (paint, spark); as a piece it is that puzzle, and the card it was opened from says which.
   See js/feed.js for what a module is and js/stage.js for what a piece is.

   Three puzzles, all deduction, each with something to tip at the end:

     will it cross      Four lanes of dominoes, each with one gap. A falling domino reaches across
                        a gap only when the gap is narrower than four fifths of its height. Every
                        lane writes its domino height and its gap width and draws both on one
                        grid; no lane sits within five per cent of the edge, so the arithmetic
                        settles it. Call each lane: stops, or crosses. A wrong check says how many
                        lanes are called right and no more; solved, the chains are tipped.
     the balance point  A weightless plank over a ruler from 0 to 20, with three or four blocks of
                        written mass standing on it at whole numbers. Find where one pivot
                        balances it (the blocks are chosen so the answer is a whole number) and
                        say which way it tips with the pivot at the middle. A clamp holds the
                        plank level until a check; a wrong check lets it tip, which is the whole
                        of the feedback.
     the counterweight  The pivot stays put. Choose one of three hanging weights and its whole-
                        number position to balance two or three fixed blocks. Only one weight
                        has an exact placement. A check measures the imbalance; a limited help
                        breaks the pulls into multiplications. The hanger remains movable after
                        solving, so another placement is another experiment.

   A card and the feature it opens as are one floor: the spark puts the whole plan on its spec as
   `of` -- the lanes, or the blocks and their places with any fixed pivot and weight rack -- and
   piece(env) opens on that rather than rolling another. Cards hold still until opened; their
   plans are cached per env so painting and opening cannot deal different floors. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const REACH = 0.8; // a falling domino crosses a gap narrower than this much of its height
const TIPS = [
  { label: 'tips to the left', value: 'left' },
  { label: 'tips to the right', value: 'right' },
  { label: 'stays level', value: 'level' }
];

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

/* ---- the rite: how this floor moves --------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"). Nothing on the floor moves along a formula or cuts without a rite:
   a domino falls in the stop-motion treads of its own stair laid over the rite's glitch of a
   curve (a stutter on the way down is the curve's own); a lane that has been called is SEALED --
   its band develops a texture through the matte, cell by cell in the piece's own pattern, in the
   colour of the call, and the word of the call blinks on; a lane the hint names has its answer
   blink on; the plank turns to its new tilt in the ratchet's clicks with backlash, never a glide,
   the pivot walks the ruler in treads, the clamp's jaws develop and dissolve by their area, a
   caption blinks on; and the light that comes over a tipped lane or a balanced plank develops
   through the matte with a flicker, never a wash. Every change is read against the piece's own
   clock, s.t, which frame() advances: a change made at `since` has come came() of its way, which
   is 1 at once for a visitor who asked for less motion and for whatever stood there from the
   start. Every trigger rolls a fresh rite (rite.at(k) with the count of that trigger in k), so a
   second call on a lane, a second check, a second move of the pivot composes a different stair,
   matte and flicker from the first. */

const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 0, flicker: () => 1, matte: () => true,
  series: (p, n) => Math.max(1, Math.floor(n || 1)), treads: 1, kind: 'none', cell: 4, at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

function clamp01(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

// The cells of a box the matte lets through at coverage k, filled in the current fillStyle: how a
// surface changes by its area. Cells are rite.cell px, coarser over a wide box so a frame stays
// cheap, on a grid fixed to the canvas so the pattern holds still while it grows. `inside` keeps
// the tiling to a shape within the box. At k >= 1 every cell is let through.
function develop(g, rite, x0, y0, bw, bh, k, inside, size) {
  if (k <= 0) return;
  const cell = size || Math.max(rite.cell, Math.ceil(Math.max(bw, bh) / 28));
  const cx0 = Math.floor(x0 / cell);
  const cy0 = Math.floor(y0 / cell);
  const cx1 = Math.ceil((x0 + bw) / cell);
  const cy1 = Math.ceil((y0 + bh) / cell);
  for (let cy = cy0; cy < cy1; cy++) {
    for (let cx = cx0; cx < cx1; cx++) {
      const px = cx * cell;
      const py = cy * cell;
      if (inside && !inside(px + cell / 2, py + cell / 2)) continue;
      if (k < 1 && !rite.matte(cx, cy, k)) continue;
      g.fillRect(px, py, cell, cell);
    }
  }
}

// The light that comes over the floor once something has moved: it develops through the matte
// from that moment, blinking on and dropping out the way the rite's flicker has it, and holds.
function daybreak(g, rite, env, w, h, p, strength) {
  const own = rite.at(0xdb);
  const k = own.stair(p);
  if (k <= 0 || !own.flicker(p)) return;
  g.fillStyle = env.alpha(env.colors.accent, strength || 0.08);
  develop(g, own, 0, 0, w, h, k, null, Math.max(rite.cell, Math.ceil(Math.min(w, h) / 30)));
}

/* ---- shared drawing ------------------------------------------------------------------------ */

function block(g, x, y, bw, bh, angle, fill, stroke) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = fill;
  g.fillRect(-bw / 2, -bh / 2, bw, bh);
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.strokeRect(-bw / 2 + 0.5, -bh / 2 + 0.5, bw - 1, bh - 1);
  }
  g.restore();
}

// The floor's ground: the same gradient the old rig lit. What lights it once something moves is
// daybreak(), by its area, never a brighter gradient.
function ground(g, w, h, env) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg2);
  grad.addColorStop(1, c.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function label(g, text, x, y, size, tone, align, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = tone;
  g.fillText(text, x, y);
}

/* ---- will it cross: four lanes, four gaps --------------------------------------------------- */

function crosses(lane) {
  return lane.g < REACH * lane.h;
}

// How far apart the ordinary dominoes of a lane stand, centre to centre, in grid units: always
// well under the reach, so only the marked gap is ever in question.
function pitch(h) {
  return Math.max(2, Math.min(4, Math.round(h * 0.4)));
}

function lanesPlan(env) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const lanes = [];
    for (let i = 0; i < 4; i++) {
      const h = env.int(4, 10);
      const over = env.chance(0.5);
      // Well away from the edge, by more than five per cent either way: 0.74 of the height or under
      // crosses, 0.86 or over stops.
      const lo = over ? Math.max(1, Math.ceil(h * 0.3)) : Math.ceil(h * 0.86);
      const hi = over ? Math.floor(h * 0.74) : Math.floor(h * 1.3);
      const n = env.int(4, 6);
      lanes.push({ h, g: env.int(lo, hi), n, at: env.int(1, n - 3) });
    }
    if (lanes.some(crosses) && !lanes.every(crosses)) return { kind: 'lanes', lanes };
  }
  return { kind: 'lanes', lanes: [{ h: 8, g: 5, n: 5, at: 2 }, { h: 6, g: 6, n: 5, at: 1 }, { h: 10, g: 9, n: 6, at: 2 }, { h: 5, g: 3, n: 4, at: 1 }] };
}

function carriedLanes(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'lanes' || !Array.isArray(p.lanes) || p.lanes.length !== 4) return null;
  const lanes = [];
  for (const l of p.lanes) {
    if (!l || typeof l !== 'object') return null;
    const h = Number(l.h);
    const g = Number(l.g);
    const n = Number(l.n);
    const at = Number(l.at);
    if (![h, g, n, at].every(Number.isInteger)) return null;
    if (h < 3 || h > 12 || g < 1 || g > 16 || n < 4 || n > 7 || at < 1 || at > n - 3) return null;
    const ratio = g / h;
    if (ratio > 0.75 && ratio < 0.85) return null;
    lanes.push({ h, g, n, at });
  }
  if (!lanes.some(crosses) || lanes.every(crosses)) return null;
  return { kind: 'lanes', lanes };
}

// Where a lane's dominoes stand, in grid units: the left edge of each, and the whole span.
function laneLayout(lane) {
  const p = pitch(lane.h);
  const xs = [];
  let x = 0;
  for (let i = 0; i < lane.n; i++) {
    xs.push(x);
    x += i === lane.at ? 1 + lane.g : p;
  }
  return { xs, span: xs[lane.n - 1] + 1 };
}

function lanesGeometry(w, h, plan, v) {
  const top = h * 0.1;
  const band = h * 0.22;
  const spanMax = Math.max(...plan.lanes.map((l) => laneLayout(l).span));
  const fit = Math.min((w * 0.62) / spanMax, (band * 0.56) / 10);
  return { top, band, x0: w * 0.1, u: fit * Math.min(1.08, Math.max(0.92, v.scale)), spanMax };
}

// Domino i of lane k, `time` seconds after its first was tipped: the angle it has fallen to. A
// domino past a gap the push does not cross never moves; the one before such a gap leans as far
// as the next upright lets it. It falls in the stop-motion treads of its own stair laid over the
// rite's curve -- a stutter on the way down is the curve's own -- never along t * t.
function fallAngle(lane, i, time, rite, k) {
  const over = crosses(lane);
  const step = 0.22;
  let start;
  if (i <= lane.at) start = i * step;
  else if (over) start = (lane.at + 1) * step + lane.g * 0.03 + (i - lane.at - 1) * step;
  else return 0;
  const f = clamp01((time - start) / 0.5);
  if (f <= 0) return 0;
  const own = rite.at(0x300 + (k || 0) * 16 + i);
  const fell = f >= 1 ? 1 : own.stair(clamp01(own.ease(f)));
  const rest = i === lane.at && !over ? (lane.g >= lane.h ? 1 : Math.asin(lane.g / lane.h) / (Math.PI / 2)) : 1;
  return fell * rest * Math.PI / 2;
}

function fallen(lane, time, rite, k) {
  let n = 0;
  for (let i = 0; i < lane.n; i++) if (fallAngle(lane, i, time, rite, k) > 0.01) n += 1;
  return n;
}

function drawLanes(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = lanesGeometry(w, h, plan, v);
  const u = geo.u;
  const size = Math.max(10, Math.min(14, Math.round(Math.min(w, h) * 0.034)));
  const small = Math.max(9, size - 2);
  ground(g, w, h, env);
  // The light over a tipped floor: develops through the matte from the moment of the tip.
  if (s.time >= 0) daybreak(g, rite, env, w, h, reduced ? 1 : clamp01(s.time / 1.6), 0.08);
  label(g, 'a falling domino crosses a gap narrower than four fifths of its height', w / 2, h * 0.05, small, env.alpha(c.muted, 0.85));
  const every = v.density < 0.9 ? 2 : 1;
  plan.lanes.forEach((lane, k) => {
    const lay = laneLayout(lane);
    const bandTop = geo.top + k * geo.band;
    const floorY = bandTop + geo.band * 0.74;
    const x0 = geo.x0;
    // A called lane is a sealed lane: its band develops a texture through the matte, in the
    // colour of the call, by its area -- a fresh roll for every call made on it.
    const calledAt = s.calledAt ? s.calledAt[k] : -1;
    const callRite = rite.at(0x100 + k * 64 + ((s.changes ? s.changes[k] : 0) % 64));
    const sealed = calledAt >= 0 ? callRite.stair(came(s, calledAt, 0.9, reduced)) : 0;
    if (sealed > 0) {
      g.fillStyle = env.alpha(s.calls && s.calls[k] ? c.accent : c.muted, 0.14);
      develop(g, callRite, x0 - u, bandTop + geo.band * 0.08, (geo.spanMax + 2) * u, geo.band * 0.82, sealed, null,
        Math.max(rite.cell, Math.ceil(geo.band / 14)));
    }
    // The grid both measures are drawn to.
    g.strokeStyle = env.alpha(c.accent, 0.085 * v.density);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= geo.spanMax; i += every) {
      g.moveTo(x0 + i * u, floorY - 10 * u);
      g.lineTo(x0 + i * u, floorY);
    }
    for (let j = 0; j <= 10; j += every) {
      g.moveTo(x0, floorY - j * u);
      g.lineTo(x0 + geo.spanMax * u, floorY - j * u);
    }
    g.stroke();
    // The floor line.
    g.strokeStyle = env.alpha(c.muted, 0.6);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0 - u, floorY);
    g.lineTo(x0 + (geo.spanMax + 1) * u, floorY);
    g.stroke();
    // The dominoes, last to first, so the earlier ones lie over the later when they fall.
    const bw = u;
    for (let i = lane.n - 1; i >= 0; i--) {
      const angle = s.time >= 0 ? fallAngle(lane, i, s.time, rite, k) : 0;
      const x = x0 + (lay.xs[i] + 1) * u;
      const bh = lane.h * u;
      const cx = x - bw / 2 * Math.cos(angle) + bh / 2 * Math.sin(angle);
      const cy = floorY - bw / 2 * Math.sin(angle) - bh / 2 * Math.cos(angle);
      const marked = i === lane.at;
      block(g, cx, cy, bw, bh, angle, marked ? c.accent2 : env.mix(c.bg2, c.accent, 0.8), env.alpha(c.fg, 0.85));
      if (marked) {
        g.save();
        g.translate(x, floorY);
        g.rotate(angle);
        g.strokeStyle = c.bg;
        g.lineWidth = Math.max(1, u * 0.15);
        g.beginPath();
        for (let j = 1; j <= 4; j++) {
          g.moveTo(-bw * 0.85, -bh * j / 5);
          g.lineTo(-bw * 0.15, -bh * j / 5);
        }
        g.stroke();
        g.restore();
      }
    }
    // The measures, written: the height over the marked domino, the gap under its bracket.
    const mx = x0 + (lay.xs[lane.at] + 0.5) * u;
    label(g, 'height ' + lane.h, mx, Math.max(bandTop + small * 0.6, floorY - lane.h * u - small * 0.8), small, c.accent2);
    const gx0 = x0 + (lay.xs[lane.at] + 1) * u;
    const gx1 = x0 + lay.xs[lane.at + 1] * u;
    const y = floorY + u * 0.5;
    g.strokeStyle = c.accent2;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(gx0, y - u * 0.3);
    g.lineTo(gx0, y);
    g.lineTo(gx1, y);
    g.lineTo(gx1, y - u * 0.3);
    g.stroke();
    label(g, 'gap ' + lane.g, (gx0 + gx1) / 2, y + small * 0.8, small, c.accent2);
    // The push, waiting at the first domino; the lane's number; the call the visitor has made.
    if (s.time < 0) {
      const ax = x0 + Math.sin(v.turn * Math.PI * 2) * u * 0.3;
      const ay = floorY - lane.h * u * 0.6;
      g.strokeStyle = env.alpha(c.fg, 0.8);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(ax - u * 1.6, ay);
      g.lineTo(ax - u * 0.3, ay);
      g.moveTo(ax - u * 0.7, ay - u * 0.35);
      g.lineTo(ax - u * 0.3, ay);
      g.lineTo(ax - u * 0.7, ay + u * 0.35);
      g.stroke();
    }
    label(g, String(k + 1), w * 0.05, floorY - u * 2, size, env.alpha(c.fg, 0.9), 'center', '600');
    const callX = w * 0.87;
    // What stands at the call: the count of what fell once the chains have had their time, which
    // blinks on in place of the word; else the word of the call, which blinks on in place of the
    // '?'. Nothing here cuts out: the thing before shows wherever the flicker of the thing after
    // is off, so the one replaces the other in the flicker's dropouts.
    const counted = s.time >= 0 && s.time > 2.2 ? (reduced ? 1 : clamp01((s.time - 2.2) / 0.7)) : 0;
    const countOn = counted > 0 && rite.at(0x400 + k).flicker(counted);
    const wordOn = calledAt >= 0 && callRite.flicker(came(s, calledAt, 0.9, reduced));
    if (calledAt >= 0) {
      // The call's badge develops by its area under the word.
      const bx = callX - u * 2.4;
      const by = floorY - u * 3.1;
      g.fillStyle = env.alpha(c.accent2, 0.22);
      develop(g, callRite, bx, by, u * 4.8, u * 2.2, sealed, null, Math.max(rite.cell, Math.ceil(u / 2)));
    }
    if (countOn) {
      const n = fallen(lane, s.time, rite, k);
      label(g, n === lane.n ? 'all ' + n + ' fell' : n + ' of ' + lane.n + ' fell', callX, floorY - u * 2, small, c.accent2);
    } else if (wordOn) {
      label(g, s.calls[k] ? 'crosses' : 'stops', callX, floorY - u * 2, size, c.accent2);
    } else {
      label(g, '?', callX, floorY - u * 2, size, env.alpha(c.muted, 0.7));
    }
    if (s.hinted && s.hinted.includes(k)) {
      const hintAt = s.hintAt ? s.hintAt[k] : -1;
      if (rite.at(0x200 + k).flicker(came(s, hintAt, 0.8, reduced))) {
        label(g, crosses(lane) ? 'shown: crosses' : 'shown: stops', callX, floorY - u * 2 + small * 1.4, small, env.alpha(c.muted, 0.9));
      }
    }
  });
}

function lanesPreview(g, w, h, env, plan) {
  drawLanes(g, w, h, env, plan, { calls: null, touched: false, hinted: [], time: -1, t: 0 }, env.variant);
}

function lanesPiece(env, plan) {
  const helps = asked(env).helps;
  const truth = plan.lanes.map((l) => (crosses(l) ? 1 : 0));
  const s = { calls: [0, 0, 0, 0], touched: false, hinted: [], time: -1, t: 0, calledAt: [-1, -1, -1, -1], changes: [0, 0, 0, 0], hintAt: {} };
  const draw = (c) => drawLanes(c.g, c.w, c.h, c, plan, s, env.variant);
  function right() {
    return truth.reduce((n, t, i) => n + (s.calls[i] === t ? 1 : 0), 0);
  }
  function callWords() {
    return s.calls.map((v, i) => 'lane ' + (i + 1) + ' ' + (v ? 'crosses' : 'stops')).join(', ');
  }
  // A call made on lane k: the lane seals itself afresh, on a roll of this call's own.
  function called(k) {
    s.calledAt[k] = s.t;
    s.changes[k] += 1;
  }
  return {
    title: 'will it cross: four lanes in procession',
    brief: 'Four lanes of dominoes stand in procession, each with one gap. A falling domino reaches across a gap only when the gap is narrower than four fifths of its height. Every lane writes its domino height and its gap width, and both are drawn on the same grid. Tap a lane to change its call. ' + plan.lanes.map((l, i) => 'Lane ' + (i + 1) + ': height ' + l.h + ', gap ' + l.g).join('; ') + '.',
    goal: 'Call every lane: does the push stop at the gap, or cross it?',
    aspect: '4 / 5',
    checkLabel: 'check the lanes',
    steps: [
      { id: 'calls', ask: 'lanes 1 to 4: stops, or crosses', kind: 'grid', rows: 1, cols: 4, labels: ['stops', 'crosses'] },
      { id: 'hint', ask: 'one lane called for you', kind: 'press', count: 1, label: 'show one lane', optional: true }
    ],
    solution: { calls: truth },
    check(c) {
      const n = right();
      return {
        solved: n === 4,
        say: n === 4 ? 'every lane is called right; the chains go over' : (n === 0 ? 'no lane is called right; the push waits' : WORDS[n] + ' of four lanes called right; the push waits')
      };
    },
    start(c) {
      c.status('tap a lane to change its call');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'calls' && Array.isArray(value) && value.length === 4) {
        const next = value.map((v) => (v ? 1 : 0));
        for (let k = 0; k < 4; k++) if (s.calledAt[k] < 0 || next[k] !== s.calls[k]) called(k);
        s.calls = next;
        s.touched = true;
        c.status(callWords());
      }
      if (id === 'hint') {
        let k = -1;
        if (s.hinted.length < helps) {
          k = truth.findIndex((t, i) => !s.hinted.includes(i) && s.calls[i] !== t);
          if (k < 0) k = truth.findIndex((t, i) => !s.hinted.includes(i));
        }
        if (k >= 0) {
          s.hinted.push(k);
          s.hintAt[k] = s.t;
          c.hint();
          c.status('lane ' + (k + 1) + (truth[k] ? ' crosses: its gap is under four fifths of its height' : ' stops: its gap is four fifths of its height or more'));
        } else if (s.hinted.length >= helps) {
          c.status('that is all the floor will call at this difficulty; the numbers are on the lanes');
        } else c.status('every lane has been shown');
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = lanesGeometry(c.w, c.h, plan, env.variant || PLAIN);
      const k = Math.floor((y * c.h - geo.top) / geo.band);
      if (k < 0 || k > 3) {
        c.status('Tap one of the four numbered lanes to change its call.');
        return;
      }
      const next = s.calls.slice();
      next[k] = next[k] ? 0 : 1;
      s.calls = next;
      s.touched = true;
      called(k);
      c.set('calls', next.slice());
      c.status('lane ' + (k + 1) + (next[k] ? ' called to cross' : ' called to stop'));
      draw(c);
    },
    frame(t, dt, c) {
      const step = Math.max(0, dt);
      s.t += step;
      if (s.time >= 0) s.time = c.reduced ? 8 : s.time + step;
      draw(c);
    },
    end(c) {
      s.time = c.reduced ? 8 : 0;
      const over = truth.filter(Boolean).length;
      c.status('tipped. ' + (over === 1 ? 'one lane goes over' : WORDS[over] + ' lanes go over') + ' and ' + (4 - over === 1 ? 'one stops' : WORDS[4 - over] + ' stop') + ' at the gap. nothing here was fragile.');
    }
  };
}

/* ---- the balance point: a plank, a ruler, a few blocks ------------------------------------- */

function centreOf(blocks) {
  const total = blocks.reduce((sum, b) => sum + b.m, 0);
  const moment = blocks.reduce((sum, b) => sum + b.m * b.x, 0);
  return moment / total;
}

function plankPlan(env) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const n = env.chance(0.5) ? 3 : 4;
    const blocks = [];
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      let x = env.int(1, 19);
      for (let guard = 0; guard < 10 && blocks.some((b) => Math.abs(b.x - x) < 2); guard++) x = env.int(1, 19);
      if (blocks.some((b) => Math.abs(b.x - x) < 2)) ok = false;
      blocks.push({ m: env.int(1, 6), x });
    }
    if (!ok) continue;
    const centre = centreOf(blocks);
    if (!Number.isInteger(centre) || centre === 10 || centre < 1 || centre > 19) continue;
    blocks.sort((a, b) => a.x - b.x);
    return { kind: 'plank', blocks };
  }
  return { kind: 'plank', blocks: [{ m: 2, x: 4 }, { m: 3, x: 10 }, { m: 1, x: 16 }] };
}

function carriedPlank(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'plank' || !Array.isArray(p.blocks) || p.blocks.length < 3 || p.blocks.length > 4) return null;
  const blocks = [];
  for (const b of p.blocks) {
    if (!b || typeof b !== 'object') return null;
    const m = Number(b.m);
    const x = Number(b.x);
    if (!Number.isInteger(m) || !Number.isInteger(x) || m < 1 || m > 6 || x < 0 || x > 20) return null;
    if (blocks.some((o) => Math.abs(o.x - x) < 2)) return null;
    blocks.push({ m, x });
  }
  const centre = centreOf(blocks);
  if (!Number.isInteger(centre) || centre === 10 || centre < 1 || centre > 19) return null;
  blocks.sort((a, b) => a.x - b.x);
  return { kind: 'plank', blocks };
}

function plankTitle(plan) {
  return 'the weighing: ' + WORDS[plan.blocks.length] + ' blocks, one pivot';
}

function fixedPull(plan, pivot) {
  return plan.blocks.reduce((sum, b) => sum + b.m * (b.x - pivot), 0);
}

function counterAnswers(plan) {
  const pull = fixedPull(plan, plan.pivot);
  return plan.weights.map((weight) => ({ weight, position: plan.pivot - pull / weight }))
    .filter((a) => Number.isInteger(a.position) && a.position >= 0 && a.position <= 20);
}

function counterweightPlan(env) {
  for (let attempt = 0; attempt < 240; attempt++) {
    const pivot = env.int(5, 15);
    const weight = env.int(2, 6);
    const position = env.int(1, 19);
    if (Math.abs(position - pivot) < 3 || Math.abs(position - 10) < 3) continue;
    const pull = weight * (position - pivot);
    // Decoy masses cannot divide this pull: only the chosen mass has a whole-number placement.
    const others = [2, 3, 4, 5, 6].filter((m) => m !== weight && pull % m !== 0);
    if (others.length < 2) continue;
    const n = env.chance(0.5) ? 2 : 3;
    const blocks = [];
    for (let i = 0; i < n - 1; i++) blocks.push({ m: env.int(1, 6), x: env.int(1, 19) });
    const m = env.int(1, 6);
    const x = pivot + (-pull - fixedPull({ blocks }, pivot)) / m;
    if (!Number.isInteger(x) || x < 1 || x > 19) continue;
    blocks.push({ m, x });
    blocks.sort((a, b) => a.x - b.x);
    if (blocks.some((b, i) => i > 0 && b.x - blocks[i - 1].x < 2)) continue;
    const weights = [weight];
    while (weights.length < 3) weights.push(others.splice(env.int(0, others.length - 1), 1)[0]);
    weights.sort((a, b) => a - b);
    return { kind: 'counterweight', blocks, pivot, weights };
  }
  return { kind: 'counterweight', blocks: [{ m: 2, x: 4 }, { m: 3, x: 19 }], pivot: 10, weights: [2, 4, 5] };
}

function carriedCounterweight(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'counterweight' || !Array.isArray(p.blocks) || p.blocks.length < 2 || p.blocks.length > 3) return null;
  const pivot = Number(p.pivot);
  if (!Number.isInteger(pivot) || pivot < 5 || pivot > 15 || !Array.isArray(p.weights) || p.weights.length !== 3) return null;
  const weights = p.weights.map(Number);
  if (weights.some((m) => !Number.isInteger(m) || m < 2 || m > 6) || new Set(weights).size !== 3) return null;
  const blocks = [];
  for (const b of p.blocks) {
    if (!b || typeof b !== 'object') return null;
    const m = Number(b.m);
    const x = Number(b.x);
    if (!Number.isInteger(m) || !Number.isInteger(x) || m < 1 || m > 6 || x < 0 || x > 20) return null;
    if (blocks.some((other) => Math.abs(other.x - x) < 2)) return null;
    blocks.push({ m, x });
  }
  blocks.sort((a, b) => a.x - b.x);
  weights.sort((a, b) => a - b);
  const plan = { kind: 'counterweight', blocks, pivot, weights };
  const answers = counterAnswers(plan);
  return answers.length === 1 && Math.abs(answers[0].position - 10) > 2 ? plan : null;
}

function blockClues(plan) {
  return plan.blocks.map((b) => 'mass ' + b.m + ' at ' + b.x).join('; ');
}

function counterweightTitle(plan) {
  return 'the counterweight: ' + WORDS[plan.blocks.length] + ' loads, pivot ' + plan.pivot;
}

function counterweightBrief(plan) {
  return 'Balance the weightless plank on its fixed pivot at ' + plan.pivot + ' by hanging one weight below it. Fixed blocks: ' + blockClues(plan)
    + '. Available hanging masses: ' + plan.weights.join(', ')
    + '. A block pulls with its mass times its distance from the pivot; equal left and right totals balance. Choose a mass and a whole-number mark from 0 to 20. Only one mass balances exactly. Set its mark with the number field or tap below the plank.';
}

function hangerShown(s, rite, reduced) {
  if (s.positionAt == null || s.positionAt < 0) return s.position;
  return s.positionFrom + (s.position - s.positionFrom) * rite.at(0x700 + s.moves).stair(came(s, s.positionAt, 0.6, reduced));
}

function counterweightPreview(g, w, h, env, plan) {
  drawPlank(g, w, h, env, plan, {
    pivot: plan.pivot, position: 10, weight: 0, angle: 0, clamped: true,
    caption: 'hang one weight; make the pulls equal', t: 0
  }, env.variant);
}

function plankGeometry(w, h) {
  return { left: w * 0.1, u: (w * 0.8) / 20, rulerY: h * 0.72, plankY: h * 0.5, thick: Math.max(3, h * 0.03) };
}

// Where the pivot is drawn: walking from where it was to where the knob has it, in treads.
function pivotShown(s, rite, reduced) {
  if (s.pivotFrom == null || s.pivotAt == null || s.pivotAt < 0) return s.pivot;
  return s.pivotFrom + (s.pivot - s.pivotFrom) * rite.at(0x400 + (s.sets || 0)).stair(came(s, s.pivotAt, 0.8, reduced));
}

// How far the plank has turned: from the tilt it had to the tilt the last check earned, in the
// ratchet's clicks with backlash, never an approach along a lerp.
function angleShown(s, rite, reduced) {
  if (s.angleFrom == null || s.angleAt == null || s.angleAt < 0) return s.angle;
  return s.angleFrom + (s.angle - s.angleFrom) * rite.at(0x300 + (s.checks || 0)).ratchet(came(s, s.angleAt, 1.3, reduced));
}

function drawPlank(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const rite = riteOf(env);
  const reduced = !!env.reduced;
  const geo = plankGeometry(w, h);
  const size = Math.max(10, Math.min(15, Math.round(Math.min(w, h) * 0.05)));
  const small = Math.max(9, Math.round(size * 0.8));
  ground(g, w, h, env);
  // The light over a balanced plank: develops through the matte from the solve.
  if (s.doneAt != null && s.doneAt >= 0) daybreak(g, rite, env, w, h, came(s, s.doneAt, 2.2, reduced), 0.08);
  // The ruler, 0 to 20.
  g.strokeStyle = env.alpha(c.muted, 0.7);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(geo.left - geo.u * 0.5, geo.rulerY);
  g.lineTo(geo.left + geo.u * 20.5, geo.rulerY);
  g.stroke();
  const every = v.density < 0.9 ? 2 : 1;
  g.fillStyle = env.alpha(c.accent, 0.06 * v.density);
  g.fillRect(geo.left - geo.u * 0.5, geo.rulerY, geo.u * 21, h * 0.04);
  for (let i = 0; i <= 20; i++) {
    const x = geo.left + i * geo.u;
    const tall = i % 5 === 0;
    g.strokeStyle = env.alpha(c.muted, tall ? 0.9 : 0.5);
    g.beginPath();
    g.moveTo(x, geo.rulerY);
    g.lineTo(x, geo.rulerY + (tall ? h * 0.035 : h * 0.02));
    g.stroke();
    if (i % every === 0 || tall) label(g, String(i), x, geo.rulerY + h * 0.035 + small * 0.8, small, env.alpha(c.fg, tall ? 0.95 : 0.6));
  }
  // The pivot, walking to where the knob has it, and the plank turned about it in clicks by
  // whatever the last check earned.
  const px = geo.left + pivotShown(s, rite, reduced) * geo.u;
  const py = geo.plankY + geo.thick / 2;
  g.fillStyle = env.alpha(c.accent2, 0.9);
  g.beginPath();
  g.moveTo(px, py);
  g.lineTo(px - geo.u * 0.6, geo.rulerY);
  g.lineTo(px + geo.u * 0.6, geo.rulerY);
  g.closePath();
  g.fill();
  g.save();
  g.translate(px, py);
  g.rotate(angleShown(s, rite, reduced));
  g.translate(-px, -py);
  g.fillStyle = env.mix(c.bg2, c.accent, 0.6);
  g.fillRect(geo.left - geo.u * 0.3, geo.plankY - geo.thick / 2, geo.u * 20.6, geo.thick);
  g.strokeStyle = env.alpha(c.fg, 0.5);
  g.lineWidth = 1;
  g.strokeRect(geo.left - geo.u * 0.3, geo.plankY - geo.thick / 2, geo.u * 20.6, geo.thick);
  const grow = Math.min(1.1, Math.max(0.9, v.scale));
  for (const b of plan.blocks) {
    const side = geo.u * (0.8 + 0.36 * Math.sqrt(b.m)) * grow;
    const x = geo.left + b.x * geo.u;
    const y = geo.plankY - geo.thick / 2 - side / 2;
    block(g, x, y, side, side, 0, env.alpha(env.mix(c.accent, c.accent2, b.m / 6), 0.88), env.alpha(c.fg, 0.5));
    label(g, String(b.m), x, y, Math.max(9, Math.round(side * 0.5)), c.bg, 'center', '600');
    label(g, 'at ' + b.x, x, geo.plankY + geo.thick / 2 + small * 0.8, small, env.alpha(c.muted, 0.9));
  }
  if (plan.kind === 'counterweight') {
    const x = geo.left + hangerShown(s, rite, reduced) * geo.u;
    const side = Math.min(h * 0.12, geo.u * (1 + 0.3 * Math.sqrt(s.weight || 3)) * grow);
    const top = geo.plankY + geo.thick / 2 + h * 0.04;
    g.strokeStyle = c.accent2;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, geo.plankY + geo.thick / 2);
    g.lineTo(x, top);
    g.stroke();
    block(g, x, top + side / 2, side, side, 0, c.bg, c.accent2);
    const own = rite.at(0x800 + (s.weightsSet || 0));
    g.save();
    g.beginPath();
    g.rect(x - side / 2, top, side, side);
    g.clip();
    g.fillStyle = env.alpha(c.accent2, 0.16);
    develop(g, own, x - side / 2, top, side, side,
      s.weight ? own.stair(came(s, s.weightAt, 0.45, reduced)) : 0);
    g.restore();
    label(g, s.weight ? String(s.weight) : '?', x, top + side / 2, size, c.fg, 'center', '600');
  }
  // The clamp's jaws: they develop by their area when the clamp is put on and dissolve by it when
  // it is let go, through a matte rolled for that clamping, never a cut.
  const clampRite = rite.at(0x500 + (s.clamps || 0));
  const held = clampRite.stair(came(s, s.clampAt == null ? -1 : s.clampAt, 0.7, reduced));
  const jaws = s.clamped ? held : 1 - held;
  if (jaws > 0) {
    g.fillStyle = env.alpha(c.muted, 0.9);
    const jawW = Math.max(2, geo.thick * 0.6);
    for (const x of [geo.left - geo.u * 0.3, geo.left + geo.u * 20.3]) {
      develop(g, clampRite, x - jawW / 2, geo.plankY - geo.thick * 1.6, jawW, geo.thick * 3.2, jaws, null, Math.max(1, Math.min(rite.cell, Math.ceil(jawW / 2))));
    }
  }
  g.restore();
  if (plan.kind === 'counterweight') {
    label(g, 'choose one hanging weight', w / 2, h * 0.055, small, c.fg);
    plan.weights.forEach((weight, i) => {
      const x = w * (0.2 + i * 0.3) + v.turn * geo.u;
      const side = h * 0.09 * grow;
      block(g, x, h * 0.17, side, side, 0, c.accent2, c.fg);
      label(g, String(weight), x, h * 0.17, small, c.bg, 'center', '600');
      if (s.weight === weight) {
        g.strokeStyle = c.accent2;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - side / 2, h * 0.24);
        g.lineTo(x + side / 2, h * 0.24);
        g.stroke();
      }
    });
    label(g, 'fixed pivot ' + plan.pivot, w / 2, h * 0.31, small, c.fg);
  }
  // The caption blinks on each time it changes.
  if (rite.at(0x600 + (s.captions || 0)).flicker(came(s, s.captionAt == null ? -1 : s.captionAt, 0.7, reduced))) {
    label(g, s.caption, w / 2, h * 0.92, small, env.alpha(c.muted, 0.9));
  }
}

function plankPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  drawPlank(g, w, h, env, plan, { pivot: Math.round(v.turn * 20), angle: 0, clamped: true, caption: 'where does it balance?', t: 0 }, v);
}

function plankPiece(env, plan) {
  // The pivot is a place on a ruler, so it is a measured answer: the difficulty says how many
  // marks out it may be and still be called balanced.
  const settings = asked(env);
  const margin = settings.margin;
  const moving = plan.kind === 'counterweight';
  const answer = moving ? counterAnswers(plan)[0] : null;
  const centre = moving ? plan.pivot : centreOf(plan.blocks);
  const tip = centre < 10 ? 'left' : centre > 10 ? 'right' : 'level';
  const s = {
    pivot: moving ? centre : 10, pivotFrom: moving ? centre : 10, pivotAt: -1, sets: 0,
    weight: 0, weightAt: -1, weightsSet: 0,
    position: 10, positionFrom: 10, positionAt: -1, moves: 0, helped: 0,
    angle: 0, angleFrom: 0, angleAt: -1, checks: 0,
    clamped: true, clampAt: -1, clamps: 0,
    doneAt: -1, t: 0,
    caption: 'the clamp holds it level until you check', captionAt: -1, captions: 0
  };
  const draw = (c) => drawPlank(c.g, c.w, c.h, c, plan, s, env.variant);
  const n = plan.blocks.length;
  // Every change of state is made at the clock and on a fresh roll of its own.
  function tilt(c, target) {
    s.angleFrom = angleShown(s, riteOf(c), !!c.reduced);
    s.angle = target;
    s.angleAt = s.t;
    s.checks += 1;
  }
  function clamp(c, on) {
    if (s.clamped === on) return;
    s.clamped = on;
    s.clampAt = s.t;
    s.clamps += 1;
  }
  function say(text) {
    if (text === s.caption) return;
    s.caption = text;
    s.captionAt = s.t;
    s.captions += 1;
  }
  function moveWeight(value, c) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0 || next > 20) {
      c.status('Use a whole-number mark from 0 to 20.');
      return;
    }
    if (next !== s.position) {
      s.positionFrom = hangerShown(s, riteOf(c), !!c.reduced);
      s.position = next;
      s.positionAt = s.t;
      s.moves += 1;
    }
    clamp(c, true);
    tilt(c, 0);
    say('clamped; check to compare the pulls');
    c.status('Hanger at mark ' + s.position + (s.weight ? ', mass ' + s.weight : '; choose its mass') + '.');
  }
  const help = { id: 'hint', ask: 'compare the pulls (' + settings.helps + ' uses)', kind: 'press', count: 1, label: 'compare the pulls', optional: true };
  const leeway = margin ? ' Your setting allows ' + margin + (margin === 1 ? ' mark' : ' marks') + ' of leeway; exact balance still has one whole-number answer.' : '';
  return {
    title: moving ? counterweightTitle(plan) : plankTitle(plan),
    brief: moving ? counterweightBrief(plan) + leeway : 'A weighing. ' + WORDS[n][0].toUpperCase() + WORDS[n].slice(1) + ' blocks stand on a weightless plank over a ruler from 0 to 20, each with its mass written on it and its place under it. A plank balances on a pivot when the masses times their distances from it come to the same on both sides. A clamp holds it level until you check; a wrong check lets it tip. Blocks: ' + blockClues(plan) + '.' + leeway,
    goal: moving ? 'Choose the hanging mass and its whole-number mark to balance the plank on pivot ' + centre + '.' : 'Find the whole number where one pivot balances the plank, and say which way it tips with the pivot at 10.',
    aspect: '16 / 10',
    checkLabel: moving ? 'check the balance' : 'let go of the clamp',
    steps: moving ? [
      { id: 'weight', ask: 'choose one hanging mass', kind: 'choice', options: plan.weights.map((m) => ({ label: 'mass ' + m, value: String(m) })) },
      { id: 'position', ask: 'where to hang it', kind: 'number', min: 0, max: 20, step: 1, value: 10, unit: 'on the ruler' },
      help
    ] : [
      { id: 'pivot', ask: 'where one pivot balances it', kind: 'number', min: 0, max: 20, step: 1, value: 10, unit: 'on the ruler' },
      { id: 'tip', ask: 'with the pivot at 10, the plank', kind: 'choice', options: TIPS },
      help
    ],
    solution: moving ? { weight: String(answer.weight), position: { value: answer.position, near: margin } } : { pivot: { value: centre, near: margin }, tip },
    check(c) {
      if (moving) {
        const weight = Number(c.value('weight'));
        const position = Number(c.value('position'));
        if (!plan.weights.includes(weight) || !Number.isInteger(position) || position < 0 || position > 20) {
          return { solved: false, say: 'Choose a hanging mass and a whole-number mark from 0 to 20.' };
        }
        const pull = fixedPull(plan, centre) + weight * (position - centre);
        const solved = weight === answer.weight && Math.abs(position - answer.position) <= margin;
        clamp(c, false);
        tilt(c, Math.sign(pull) * 0.14);
        say(pull === 0 ? 'balanced; both sides pull equally' : (pull > 0 ? 'right' : 'left') + ' side pulls ' + Math.abs(pull) + ' more');
        return {
          solved,
          say: solved
            ? (pull === 0 ? 'Balanced. ' : 'Within the ' + margin + '-mark leeway. ') + 'Exact balance: mass ' + answer.weight + ' at mark ' + answer.position + '.'
            : 'The ' + (pull > 0 ? 'right' : 'left') + ' side pulls ' + Math.abs(pull) + ' more. Change the hanging mass or its mark and check again.'
        };
      }
      const p = Math.round(Number(c.value('pivot')));
      const pivotRight = Math.abs(p - centre) <= margin;
      const callRight = c.value('tip') === tip;
      clamp(c, false);
      if (pivotRight && callRight) {
        tilt(c, Math.sign(centre - p) * 0.14);
        say(p === centre ? 'balanced at ' + centre : 'within the allowed leeway');
        return { solved: true, say: (p === centre ? 'the weighing holds' : 'within the ' + margin + '-mark leeway') + ': exact balance at ' + centre + '; with the pivot at 10 it ' + (tip === 'level' ? 'stays level' : 'tips to the ' + tip) };
      }
      const parts = [];
      if (!pivotRight) {
        tilt(c, (p < centre ? 1 : -1) * 0.14);
        parts.push('with the pivot at ' + p + ' the plank tips to the ' + (p < centre ? 'right' : 'left'));
      } else {
        tilt(c, Math.sign(centre - p) * 0.14);
        parts.push(p === centre ? 'the pivot is in the right place' : 'the pivot is within the allowed leeway');
      }
      if (!callRight) parts.push('the call for the pivot at 10 is wrong');
      say(p === centre ? 'level on its pivot' : 'tipping');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      if (moving) say('hang one weight; make the pulls equal');
      c.status(moving ? 'Choose a hanging mass, then set its mark. The pivot stays at ' + centre + '.' : 'the clamp holds the plank level until you check');
      draw(c);
    },
    apply(id, value, c) {
      if (moving && id === 'weight') {
        const weight = Number(value);
        if (!plan.weights.includes(weight)) {
          c.status('Choose one of the three masses on the rack.');
          return;
        }
        s.weight = weight;
        s.weightAt = s.t;
        s.weightsSet += 1;
        clamp(c, true);
        tilt(c, 0);
        say('clamped; check to compare the pulls');
        c.status('Hanging mass ' + weight + ' at mark ' + s.position + '.');
      }
      if (moving && id === 'position') moveWeight(value, c);
      if (id === 'hint') {
        if (s.helped >= settings.helps) {
          c.status('All comparisons used. Multiply each mass by its distance from the pivot; equal totals balance.');
        } else {
          s.helped += 1;
          c.hint();
          const pivot = moving ? centre : s.pivot;
          const blocks = plan.blocks.concat(moving && s.weight ? [{ m: s.weight, x: s.position }] : []);
          const pulls = blocks.map((b) => {
            const distance = Math.abs(b.x - pivot);
            return 'mass ' + b.m + ' at ' + b.x + ': ' + b.m + ' x ' + distance + ' = ' + (b.m * distance) + (b.x < pivot ? ' left' : b.x > pivot ? ' right' : ' on the pivot');
          });
          c.status('At pivot ' + pivot + ', ' + pulls.join('; ') + '. Equal left and right totals balance. '
            + (moving && !s.weight ? 'Choose a hanging mass to add its pull. ' : '') + (settings.helps - s.helped) + ' comparisons left.');
        }
      }
      if (id === 'pivot') {
        const p = Math.round(Number(value));
        const next = Number.isFinite(p) ? Math.max(0, Math.min(20, p)) : 10;
        if (next !== s.pivot) {
          s.pivotFrom = pivotShown(s, riteOf(c), !!c.reduced);
          s.pivot = next;
          s.pivotAt = s.t;
          s.sets += 1;
        }
        clamp(c, true);
        tilt(c, 0);
        say('the clamp holds it level until you check');
        c.status('the pivot is at ' + s.pivot + ', clamped level');
      }
      if (id === 'tip') c.status('at 10, you say it ' + (value === 'level' ? 'stays level' : 'tips to the ' + value));
      draw(c);
    },
    tap(x, y, c) {
      if (!moving) {
        c.status('Set the pivot with its number field, then check the balance.');
        return;
      }
      if (y < 0.55) {
        c.status('Choose a mass with its button; tap below the plank to place the hanger on the ruler.');
        return;
      }
      const geo = plankGeometry(c.w, c.h);
      const position = Math.max(0, Math.min(20, Math.round((x * c.w - geo.left) / geo.u)));
      moveWeight(position, c);
      c.set('position', position);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += Math.max(0, dt);
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      clamp(c, false);
      const pull = moving ? fixedPull(plan, centre) + s.weight * (s.position - centre) : centre - s.pivot;
      tilt(c, Math.sign(pull) * 0.14);
      if (s.doneAt < 0) s.doneAt = s.t;
      c.status(moving
        ? 'Exact balance uses mass ' + answer.weight + ' at mark ' + answer.position + '. Change either setting and check again to see which side pulls harder.'
        : 'Exact balance is at ' + centre + '. The clamp is off; move the pivot and check again to see it tip.');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

const plans = new WeakMap();

function deal(env) {
  if (plans.has(env)) return plans.get(env);
  const makers = [lanesPlan, plankPlan, counterweightPlan];
  const plan = carriedLanes(env) || carriedPlank(env) || carriedCounterweight(env) || makers[env.int(0, 2)](env);
  plans.set(env, plan);
  return plan;
}

export default {
  id: 'kinetic-floor',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'lanes') lanesPreview(g, w, h, env, plan);
    else if (plan.kind === 'counterweight') counterweightPreview(g, w, h, env, plan);
    else plankPreview(g, w, h, env, plan);
  },
  animate(g, w, h, env, t) {
    return false;
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'counterweight') {
      return {
        title: counterweightTitle(plan),
        mono: 'fixed pivot ' + plan.pivot + '\n' + plan.blocks.map((b) => 'mass ' + b.m + '  at ' + b.x).join('\n') + '\nhanging masses: ' + plan.weights.join(', '),
        text: counterweightBrief(plan),
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => counterweightPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    if (plan.kind === 'lanes') {
      return {
        title: 'will it cross: four lanes in procession',
        mono: plan.lanes.map((l, i) => 'lane ' + (i + 1) + '  height ' + l.h + '  gap ' + l.g).join('\n'),
        text: 'Four lanes in procession. A falling domino crosses a gap narrower than four fifths of its height. Call each lane: stops, or crosses.',
        aspect: '4 / 5',
        paint: (g, w, h, cardEnv) => lanesPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    return {
      title: plankTitle(plan),
      mono: plan.blocks.map((b) => 'mass ' + b.m + '  at ' + b.x).join('\n'),
      text: 'A weighing on a weightless plank over a ruler from 0 to 20. Find where one pivot balances it, and which way it tips from the middle.',
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => plankPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const plan = deal(env);
    return plan.kind === 'lanes' ? lanesPiece(env, plan) : plankPiece(env, plan);
  }
};
