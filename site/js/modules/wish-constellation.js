/* The wish constellation: the visitor's stars, set as puzzles. As a card it is one of the two
   puzzles below painted small (paint, spark); as a piece it is that puzzle, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction, both drawn from where the visitor's stars sit -- their places, never
   their words -- and filled out with lights invented from the seed when the sky has too few, so a
   sky of one star still makes a whole puzzle:

     the postcard        Two views of the same lights, a left eye and a right eye a step apart. A
                         light shifts between the views by more the nearer it is, so the order of
                         the shifts is the order of the depths. Put the lights nearest to farthest.
                         A wrong check says how many stand in the right place and no more; a hint,
                         at a price, shows where one light stands.
     which sky is yours  Four small skies. One is the visitor's pattern turned clockwise by one,
                         two or three quarter turns, perhaps flipped left for right first; the other
                         three are near misses, the same lights with a few nudged. Say which sky,
                         how far it turned and whether it was flipped. A wrong check says which of
                         the three parts hold and no more; a hint marks one decoy.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the lights, their depths, the four skies -- and piece(env) opens on that rather than
   rolling another. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const PLACE = ['nearest', 'second nearest', 'third nearest', 'fourth nearest', 'fifth nearest', 'sixth nearest'];
const LETTERS = 'ABCDEFG';
const SKIES = 'ABCD';
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
// How far the nearest and the farthest light shift between the two views, in hundredths of a view.
const SHIFT_NEAR = 26;
const SHIFT_FAR = 4;

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
   js/stage.js, "The rite"): a few treads, always forward, and one clean edge -- the piece's slice
   or curve, its signature -- for any surface that changes. A light that is tapped or hinted gets
   its ring in the ratchet's even clicks and its word cut on at its moment; the light last touched
   has a halo cut in by the piece's edge, and the one touched before it gives its halo back the
   same way, the region shrinking; a sky that is chosen is cut in by the edge and the one chosen
   before it gives its fill back, a sky marked as a decoy is veiled by the edge, and the sky that
   turns out to be yours is lit by it; the visitor's own sky, once the puzzle is solved, flips in
   treads and turns in rite.ratchet's clicks to meet it; the postcard's finale draws each light's
   travel in treads. A surface that stays changed rests as two shades of its colour split by the
   edge through its middle, never a flat wash or a pattern. The lights themselves hold still: they
   wait for nothing, so they do not twinkle -- and on the postcard a light that varied in size
   could be read as a clue to its depth. Every change is read against the piece's own clock, s.t,
   which frame() advances: a change made at `since` has come came() of its way, which is 1 at once
   for a visitor who asked for less motion, and for whatever stood there from the start (since <
   0). Each light and each sky moves on a roll of its own (rite.at), so no two step together, and
   every roll keeps the piece's edge. */

// The rite of a piece handed none: everything stands where it ends, and a surface is cut by a
// plain upright slice from its left side.
const STILL = {
  ease: () => 1, stair: () => 1, ratchet: () => 1, turn: () => 1, flicker: () => 1,
  treads: 1, kind: 'slice', angle: 90,
  region: (g, x, y, w, h, k) => {
    if (k > 0) g.rect(x, y, w * Math.min(1, k), h);
  },
  paint: (g, x, y, w, h, k, style) => {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w * Math.min(1, k), h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

// The rite rolled afresh for one thing this module moves, kept with the rite it was rolled from so
// a frame rolls each one once rather than thirty times a second.
const OWN = new WeakMap();
function own(rite, n) {
  let kept = OWN.get(rite);
  if (!kept) {
    kept = new Map();
    OWN.set(rite, kept);
  }
  let r = kept.get(n);
  if (!r) {
    r = rite.at(n);
    kept.set(n, r);
  }
  return r;
}

function came(s, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (s.t - since) / span));
}

// How far a thing that is `on` has come up its stair since onAt, or back down it since offAt.
function level(rite, s, on, onAt, offAt, span, reduced) {
  if (on) return rite.stair(came(s, onAt, span, reduced));
  if (offAt == null || offAt < 0) return 0;
  return 1 - rite.stair(came(s, offAt, span, reduced));
}

// A surface `k` of the way to being there, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes or goes, and at rest it is two shades of one colour split
// by that edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A disc that is `k` of the way to being there: the cover of its bounding box, clipped to it.
function disc(g, rite, x, y, r, k, fill) {
  if (k <= 0) return;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.clip();
  g.fillStyle = fill;
  cover(g, rite, x - r, y - r, r * 2, r * 2, k);
  g.restore();
}

/* ---- shared arithmetic ---------------------------------------------------------------------- */

function dials(env) {
  const v = env && env.variant;
  const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
  return v && typeof v === 'object' ? { density: num(v.density, 1), scale: num(v.scale, 1), turn: num(v.turn, 0) } : PLAIN;
}

function range(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
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

function isPerm(list, n) {
  return Array.isArray(list) && list.length === n && list.every((v) => Number.isInteger(v) && v >= 0 && v < n) && new Set(list).size === n;
}

function okPoints(list, n0, n1) {
  return Array.isArray(list) && list.length >= n0 && list.length <= n1
    && list.every((p) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
}

function copyPoints(list) {
  return list.map((p) => ({ x: p.x, y: p.y }));
}

// n lights in a square of hundredths, each at least `gap` from the rest: the visitor's stars first,
// by where they sit, then lights invented from the seed when the sky has too few.
function gather(env, n, gap, box) {
  const pts = [];
  const far = (p) => pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= gap);
  const into = (x, y) => ({ x: Math.round(box[0] + x / 100 * (box[1] - box[0])), y: Math.round(box[2] + y / 100 * (box[3] - box[2])) });
  for (const s of (Array.isArray(env.stars) ? env.stars : [])) {
    if (pts.length >= n) break;
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = into(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    if (far(p)) pts.push(p);
  }
  for (let guard = 0; pts.length < n; guard++) {
    const p = into(env.rnd() * 100, env.rnd() * 100);
    if (far(p) || guard > 300) pts.push(p);
  }
  return pts;
}

/* ---- drawing -------------------------------------------------------------------------------- */

function backdrop(g, w, h, c) {
  const grad = g.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 1.1);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// Motes behind everything: as many as the configuration asks for, where its turn puts them.
function dust(g, w, h, c, v) {
  g.fillStyle = c.alpha(c.colors.fg, 0.16);
  const count = Math.max(8, Math.round(36 * v.density));
  for (let i = 0; i < count; i++) {
    g.fillRect(((i * 0.618034 + v.turn * 0.37) % 1) * w, ((i * 0.754878 + v.turn * 0.19) % 1) * h, v.scale, v.scale);
  }
}

// Lines between lights: each joined to its two nearest within reach, brighter the nearer.
function links(g, side, c, pts, reach, boost) {
  const R = side * reach;
  g.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d < R) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const n of near.slice(0, 2)) {
      if (n.j < i) continue;
      g.strokeStyle = c.alpha(c.colors.accent, (0.18 + (1 - n.d / R) * 0.5) * boost);
      g.beginPath();
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[n.j].x, pts[n.j].y);
      g.stroke();
    }
  }
}

// One light: its resting halo, and over that -- when it is `hot` of the way to being lit -- a
// hotter halo cut in by the piece's edge; then the core. Every light is the same size, so none
// looks nearer than it is.
function star(g, c, p, glow, rite, hot) {
  const r = 9 * glow;
  const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  halo.addColorStop(0, c.alpha(c.colors.accent, 0.5));
  halo.addColorStop(1, c.alpha(c.colors.accent, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, TAU);
  g.fill();
  if (hot > 0) disc(g, rite || STILL, p.x, p.y, r * 1.3, hot, c.alpha(c.colors.accent2, 0.28));
  g.fillStyle = c.alpha(c.colors.fg, 0.95);
  g.beginPath();
  g.arc(p.x, p.y, 2.2, 0, TAU);
  g.fill();
}

// A ring round a light, `sweep` of the way round from the top: it comes round in clicks.
function ring(g, c, x, y, a, r, sweep) {
  if (sweep <= 0) return;
  g.strokeStyle = c.alpha(c.colors.accent2, a);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, sweep) * TAU);
  g.stroke();
}

function font(g, size, weight) {
  g.font = (weight || 500) + ' ' + Math.round(size) + 'px system-ui, sans-serif';
}

/* ---- the postcard: nearest to farthest ------------------------------------------------------ */

function shiftOf(rank, n) {
  return SHIFT_NEAR - rank * (SHIFT_NEAR - SHIFT_FAR) / Math.max(1, n - 1);
}

function postcardPlan(env) {
  const n = env.int(4, 6);
  const points = gather(env, n, 15, [30, 96, 10, 90]);
  let ranks = shuffled(env, range(n));
  for (let guard = 0; guard < 12 && ranks.every((r, i) => r === i); guard++) ranks = shuffled(env, range(n));
  if (ranks.every((r, i) => r === i)) ranks.reverse();
  return { kind: 'postcard', number: 101 + env.int(0, 898), points, ranks };
}

function carriedPostcard(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'postcard' || !okPoints(p.points, 4, 6)) return null;
  const n = p.points.length;
  if (!isPerm(p.ranks, n) || p.ranks.every((r, i) => r === i)) return null;
  if (!Number.isInteger(p.number) || p.number < 101 || p.number > 999) return null;
  return { kind: 'postcard', number: p.number, points: copyPoints(p.points), ranks: p.ranks.slice() };
}

// The lights nearest first: the order that solves the postcard.
function postcardOrder(plan) {
  return range(plan.points.length).sort((a, b) => plan.ranks[a] - plan.ranks[b]);
}

function postcardTitle(plan) {
  return 'postcard ' + plan.number + ': left eye, right eye';
}

function postcardLayout(w, h) {
  return { lefts: [w * 0.04, w * 0.52], width: w * 0.44, top: h * 0.15, height: h * 0.62 };
}

// The state the postcard is drawn from. Every moment is on the piece's own clock, and -1 is
// "from the start" (so a preview, and a light never touched, stand still).
function postcardState(n, t) {
  return {
    t, order: null, orderAt: -1, hinted: [], hintAt: new Array(n).fill(-1),
    taps: [], tapAt: new Array(n).fill(-1), cleared: [], clearedAt: -1,
    lit: -1, litAt: -1, wasLit: -1, wasLitAt: -1, doneAt: -1
  };
}

function postcardScene(g, w, h, c, plan, s, v) {
  const box = postcardLayout(w, h);
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const n = plan.points.length;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.04)));
  const glow = v.scale * Math.max(0.55, Math.min(1, box.width / 300));
  backdrop(g, w, h, c);
  dust(g, w, h, c, v);
  g.textBaseline = 'middle';
  box.lefts.forEach((left, pane) => {
    font(g, size);
    g.textAlign = 'center';
    g.fillStyle = c.alpha(c.colors.fg, 0.85);
    g.fillText(pane === 0 ? 'left eye' : 'right eye', left + box.width / 2, h * 0.085, box.width);
    g.fillStyle = c.alpha(c.colors.bg, 0.55);
    g.fillRect(left, box.top, box.width, box.height);
    g.strokeStyle = c.alpha(c.colors.muted, 0.7);
    g.lineWidth = 1;
    g.strokeRect(left, box.top, box.width, box.height);
    // Ticks along both edges, so a light's place can be read across the two views.
    g.strokeStyle = c.alpha(c.colors.muted, 0.3);
    g.beginPath();
    for (let k = 1; k < 10; k++) {
      const x = left + box.width * k / 10;
      const tick = k % 5 ? 5 : 9;
      g.moveTo(x, box.top);
      g.lineTo(x, box.top + tick);
      g.moveTo(x, box.top + box.height);
      g.lineTo(x, box.top + box.height - tick);
    }
    g.stroke();
    g.strokeStyle = c.alpha(c.colors.muted, 0.1);
    g.beginPath();
    for (let k = 1; k < 5; k++) {
      const x = left + box.width * k / 5;
      g.moveTo(x, box.top);
      g.lineTo(x, box.top + box.height);
    }
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(left, box.top, box.width, box.height);
    g.clip();
    plan.points.forEach((p, i) => {
      const mine = own(rite, 0x11 + i);
      const shift = pane === 1 ? shiftOf(plan.ranks[i], n) : 0;
      const x = left + (p.x - shift) / 100 * box.width;
      const y = box.top + p.y / 100 * box.height;
      if (pane === 1 && s.doneAt >= 0) {
        // The finale: the shift itself, drawn as the line each light travelled, laid in treads
        // from where the left eye had it, each light on its own roll and a little after the last.
        const laid = mine.stair(came(s, s.doneAt + i * 0.15, 1.3, reduced));
        if (laid > 0) {
          const x0 = left + p.x / 100 * box.width;
          g.strokeStyle = c.alpha(c.colors.accent2, 0.7);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x0, y);
          g.lineTo(x0 + (x - x0) * laid, y);
          g.stroke();
        }
      }
      // The light last touched: its halo is cut in by the piece's edge, and the one touched before
      // it gives its halo back the same way.
      const hot = i === s.lit ? mine.stair(came(s, s.litAt, 0.6, reduced))
        : i === s.wasLit ? 1 - mine.stair(came(s, s.wasLitAt, 0.6, reduced)) : 0;
      star(g, c, { x, y }, glow, mine, hot);
      font(g, size * 0.9, 600);
      g.textAlign = 'left';
      g.fillStyle = c.alpha(hot >= 0.5 ? c.colors.accent2 : c.colors.fg, 0.9);
      g.fillText(LETTERS[i], x + size * 0.55, y - size * 0.6);
      const tapped = s.taps.indexOf(i);
      const gone = s.cleared.indexOf(i);
      if (tapped >= 0) {
        // A tapped light: its ring comes round in clicks and its place is cut on at its moment.
        const tp = came(s, s.tapAt[i], 0.7, reduced);
        ring(g, c, x, y, 0.8, size * 0.6, mine.ratchet(tp));
        if (mine.flicker(tp)) {
          font(g, size * 0.7);
          g.fillStyle = c.alpha(c.colors.accent2, 0.95);
          g.fillText(String(tapped + 1), x + size * 0.55, y + size * 0.55);
        }
      } else if (gone >= 0 && s.clearedAt >= 0) {
        // The order complete: the rings go back round the way they came, and each place is cut
        // out at its moment.
        const cp = came(s, s.clearedAt, 0.7, reduced);
        if (cp < 1) {
          ring(g, c, x, y, 0.8, size * 0.6, 1 - mine.ratchet(cp));
          if (!mine.flicker(cp)) {
            font(g, size * 0.7);
            g.fillStyle = c.alpha(c.colors.accent2, 0.95);
            g.fillText(String(gone + 1), x + size * 0.55, y + size * 0.55);
          }
        }
      } else if (s.hinted.includes(i)) {
        const hp = came(s, s.hintAt[i], 1, reduced);
        ring(g, c, x, y, 0.9, size * 0.7, mine.ratchet(hp));
        if (mine.flicker(hp)) {
          font(g, size * 0.75);
          g.fillStyle = c.alpha(c.colors.accent2, 0.95);
          g.fillText(PLACE[plan.ranks[i]], x + size * 0.55, y + size * 0.6);
        }
      }
    });
    g.restore();
  });
  font(g, size);
  g.textAlign = 'center';
  g.fillStyle = c.alpha(c.colors.fg, 0.8);
  if (s.order && own(rite, 0x0d).flicker(came(s, s.orderAt, 0.9, reduced))) {
    g.fillText('nearest to farthest: ' + s.order.map((i) => LETTERS[i]).join('  '), w / 2, h * 0.86, w * 0.9);
  }
  g.fillStyle = c.alpha(c.colors.muted, 0.85);
  g.fillText('the same lights; the nearer, the farther it shifts', w / 2, h * 0.94, w * 0.92);
}

function postcardPreview(g, w, h, env, plan) {
  postcardScene(g, w, h, env, plan, postcardState(plan.points.length, 0), dials(env));
}

function postcardPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.points.length;
  const v = dials(env);
  const answer = postcardOrder(plan);
  const s = postcardState(n, 0);
  s.order = range(n);
  const draw = (c) => postcardScene(c.g, c.w, c.h, c, plan, s, v);
  const inPlace = (order) => order.filter((item, i) => item === answer[i]).length;
  function settle(order) {
    s.order = order.slice();
    s.orderAt = s.t;
  }
  return {
    title: postcardTitle(plan),
    brief: 'A reading by two eyes. Two views of the same ' + WORDS[n] + ' lights, from a left eye and a right eye a step apart. The nearer a light is, the farther it shifts between the views; the farthest barely moves. Nothing else about them changes.',
    goal: 'Put the lights in order from nearest to farthest.',
    aspect: '4 / 3',
    checkLabel: 'check the postcard',
    steps: [
      { id: 'order', ask: 'the lights, nearest first: arrange them here, or tap them in that order', kind: 'order', items: range(n).map((i) => ({ label: 'light ' + LETTERS[i], value: i })) },
      { id: 'hint', ask: 'where one light stands', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: answer.slice() },
    check(c) {
      const value = c.value('order');
      const order = isPerm(value, n) ? value : s.order;
      const k = inPlace(order);
      return {
        solved: k === n,
        say: k === n ? 'every light in its place: the postcard has depth'
          : k === 0 ? 'none of them stands at its true depth yet' : WORDS[k] + ' of ' + WORDS[n] + ' at the right depth'
      };
    },
    start(c) {
      c.status('compare each light\'s place in the two views');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && isPerm(value, n)) {
        settle(value);
        c.status('nearest to farthest: ' + s.order.map((i) => LETTERS[i]).join(', '));
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? answer.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== answer.indexOf(i))
          : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('light ' + LETTERS[next] + ' is the ' + PLACE[plan.ranks[next]]);
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will show at this difficulty; the rest is yours');
        } else {
          c.status('every light you have placed wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      // Tap the lights nearest first, in either view; the order on the rail follows.
      const box = postcardLayout(c.w, c.h);
      const pane = x * c.w < box.lefts[1] ? 0 : 1;
      let best = -1;
      let bd = Infinity;
      plan.points.forEach((p, i) => {
        const shift = pane === 1 ? shiftOf(plan.ranks[i], n) : 0;
        const d = Math.hypot(box.lefts[pane] + (p.x - shift) / 100 * box.width - x * c.w, box.top + p.y / 100 * box.height - y * c.h);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0 || bd > Math.min(c.w, c.h) * 0.08) return;
      if (s.lit !== best) {
        s.wasLit = s.lit;
        s.wasLitAt = s.t;
        s.lit = best;
        s.litAt = s.t;
      }
      if (s.taps.includes(best)) {
        c.status('light ' + LETTERS[best] + ' is already in your order; keep going');
        draw(c);
        return;
      }
      s.taps.push(best);
      s.tapAt[best] = s.t;
      if (s.taps.length === n) {
        settle(s.taps);
        s.cleared = s.taps;
        s.clearedAt = s.t;
        s.taps = [];
        c.set('order', s.order.slice());
        c.status('nearest to farthest: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; check it');
      } else {
        c.status('light ' + LETTERS[best] + ' is ' + PLACE[s.taps.length - 1] + '; tap the next');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      c.status('sealed: postcard ' + plan.number + '. light ' + LETTERS[answer[0]] + ' is nearest and light ' + LETTERS[answer[n - 1]] + ' farthest; the lines show how far each one shifted');
    }
  };
}

/* ---- which sky is yours: turned, maybe flipped ---------------------------------------------- */

// One light turned clockwise by `turns` quarter turns, after a flip left for right if `mirror`.
function turnPoint(p, turns, mirror) {
  let x = mirror ? 100 - p.x : p.x;
  let y = p.y;
  for (let i = 0; i < turns; i++) {
    const nx = 100 - y;
    y = x;
    x = nx;
  }
  return { x, y };
}

function turned(points, turns, mirror) {
  return points.map((p) => turnPoint(p, turns, mirror));
}

// The farthest any light of A has to travel to reach a light of B: nought when A lies on B.
function setGap(A, B) {
  let worst = 0;
  for (const p of A) {
    let best = Infinity;
    for (const q of B) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
}

// Every way the pattern can lie: four turns, flipped or not.
function images(points) {
  const out = [];
  for (let m = 0; m < 2; m++) for (let t = 0; t < 4; t++) out.push({ turns: t, mirror: m === 1, pts: turned(points, t, m === 1) });
  return out;
}

function distinctImages(all) {
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) if (setGap(all[a].pts, all[b].pts) < 8) return false;
  }
  return true;
}

function spaced(pts, gap) {
  return pts.every((p, i) => pts.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) >= gap));
}

function whichPlan(env) {
  const n = env.int(5, 7);
  const number = 101 + env.int(0, 898);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const points = gather(env, n, 14, [8, 92, 8, 92]);
    const all = images(points);
    const distinct = distinctImages(all);
    const turns = env.int(1, 3);
    const mirror = env.chance(0.5);
    const which = env.int(0, 3);
    const skies = [];
    let ok = true;
    let decoys = 0;
    for (let k = 0; k < 4 && ok; k++) {
      if (k === which) {
        skies.push(turned(points, turns, mirror));
        continue;
      }
      // A decoy: a few lights nudged, then laid like the true sky (the first) or any way at all.
      let decoy = null;
      for (let tries = 0; tries < 24 && !decoy; tries++) {
        const moved = shuffled(env, range(n)).slice(0, n > 5 ? 3 : 2);
        const nudged = points.map((p, i) => {
          if (!moved.includes(i)) return { x: p.x, y: p.y };
          const a = env.rnd() * Math.PI * 2;
          const d = 10 + env.rnd() * 6;
          return { x: Math.round(Math.max(4, Math.min(96, p.x + Math.cos(a) * d))), y: Math.round(Math.max(4, Math.min(96, p.y + Math.sin(a) * d))) };
        });
        const pts = decoys === 0 ? turned(nudged, turns, mirror) : turned(nudged, env.int(0, 3), env.chance(0.5));
        if (spaced(pts, 7) && all.every((img) => setGap(pts, img.pts) >= 6)) decoy = pts;
        else if (tries === 23) {
          // The last try stands, unchecked, so a plan is always made; a plan this loop could not
          // check is one the piece still plays, and one the carried check will roll afresh.
          decoy = pts;
          ok = false;
        }
      }
      skies.push(decoy);
      decoys += 1;
    }
    last = { kind: 'which', number, points, turns, mirror, which, skies };
    if (ok && distinct) return last;
  }
  return last;
}

function carriedWhich(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'which' || !okPoints(p.points, 5, 7)) return null;
  const n = p.points.length;
  if (!Number.isInteger(p.number) || p.number < 101 || p.number > 999) return null;
  if (![1, 2, 3].includes(p.turns) || typeof p.mirror !== 'boolean' || ![0, 1, 2, 3].includes(p.which)) return null;
  if (!Array.isArray(p.skies) || p.skies.length !== 4 || !p.skies.every((sky) => okPoints(sky, n, n))) return null;
  const all = images(p.points);
  if (!distinctImages(all)) return null;
  const truth = turned(p.points, p.turns, p.mirror);
  if (setGap(p.skies[p.which], truth) > 0.5 || setGap(truth, p.skies[p.which]) > 0.5) return null;
  for (let k = 0; k < 4; k++) {
    if (k !== p.which && all.some((img) => setGap(p.skies[k], img.pts) < 6)) return null;
  }
  return { kind: 'which', number: p.number, points: copyPoints(p.points), turns: p.turns, mirror: p.mirror, which: p.which, skies: p.skies.map(copyPoints) };
}

function whichTitle(plan) {
  return 'sky ' + plan.number + ': which sigil is yours';
}

function turnsWord(turns) {
  return turns === 1 ? 'one quarter turn' : WORDS[turns] + ' quarter turns';
}

function whichLayout(w, h) {
  const side = Math.min(h * 0.7, w * 0.46);
  const left = w * 0.05;
  const top = h * 0.15;
  const x0 = left + side + w * 0.05;
  const room = w * 0.95 - x0;
  const gap = Math.max(6, room * 0.06);
  const small = Math.min((room - gap) / 2, (side - gap) / 2);
  const y0 = top + (side - (small * 2 + gap)) / 2;
  const cells = [];
  for (let k = 0; k < 4; k++) cells.push({ x: x0 + (k % 2) * (small + gap), y: y0 + Math.floor(k / 2) * (small + gap), side: small });
  return { side, left, top, cells };
}

// One sky in a square: its frame, its lights and the lines between them. opts.fill is a surface
// that has come `opts.fillK` of the way over the box, under the lights; opts.lit a second,
// brighter one that has come `opts.litK` of the way over that (the sky that turns out to be yours,
// which is the chosen one already, so it needs a surface of its own); opts.veil one that has come
// `opts.veilK` of the way over them (a decoy's dimming). Each is cut in by the piece's edge across
// the square and rests in two shades split by it -- by its area, never by alpha -- and as they all
// share the one edge, their splits lie on one line.
function skyBox(g, c, pts, x, y, side, v, opts) {
  const rite = opts.rite || STILL;
  g.fillStyle = c.alpha(c.colors.bg, 0.55);
  g.fillRect(x, y, side, side);
  if (opts.fill && opts.fillK > 0) {
    g.fillStyle = opts.fill;
    cover(g, rite, x, y, side, side, opts.fillK);
  }
  if (opts.lit && opts.litK > 0) {
    g.fillStyle = opts.lit;
    cover(g, rite, x, y, side, side, opts.litK);
  }
  g.strokeStyle = opts.border || c.alpha(c.colors.muted, 0.7);
  g.lineWidth = opts.width || 1;
  g.strokeRect(x, y, side, side);
  const at = pts.map((p) => ({ x: x + p.x / 100 * side, y: y + p.y / 100 * side }));
  const glow = v.scale * Math.max(0.45, Math.min(1, side / 260));
  links(g, side, c, at, 0.5, 1);
  at.forEach((p) => star(g, c, p, glow, rite, 0));
  if (opts.veil && opts.veilK > 0) {
    g.fillStyle = opts.veil;
    cover(g, rite, x, y, side, side, opts.veilK);
  }
  const size = Math.max(9, Math.min(16, Math.round(side * 0.11)));
  if (opts.label) {
    font(g, size, 600);
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = opts.border || c.alpha(c.colors.fg, 0.9);
    g.fillText(opts.label, x + size * 0.4, y + size * 0.3);
  }
  if (opts.note) {
    font(g, size * 0.85);
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillStyle = c.alpha(c.colors.accent2, 0.9);
    g.fillText(opts.note, x + side - size * 0.4, y + side - size * 0.3);
  }
}

// The state the four skies are drawn from; -1 is "from the start".
function whichState(t) {
  return {
    t, choice: -1, choiceAt: -1, wasChoice: -1, wasChoiceAt: -1, turns: 1, mirror: false,
    hinted: [], hintAt: [-1, -1, -1, -1], doneAt: -1, live: false, saidAt: -1
  };
}

// The visitor's own sky once the puzzle is solved: flipped left for right in treads, if it was
// flipped, then turned clockwise in the ratchet's even clicks to lie as the true sky lies.
function reference(plan, rite, s, reduced) {
  if (s.doneAt < 0) return plan.points;
  const fp = plan.mirror ? own(rite, 0xf11).stair(came(s, s.doneAt, 1, reduced)) : 0;
  const tp = came(s, s.doneAt + (plan.mirror ? 1 : 0), 2.4, reduced);
  const ang = own(rite, 0x7a7).ratchet(tp) * plan.turns * Math.PI / 2;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return plan.points.map((p) => {
    const dx = (p.x - 50) * (1 - 2 * fp);
    const dy = p.y - 50;
    return { x: 50 + dx * cos - dy * sin, y: 50 + dx * sin + dy * cos };
  });
}

function whichScene(g, w, h, c, plan, s, v) {
  const lay = whichLayout(w, h);
  const rite = riteOf(c);
  const reduced = !!c.reduced;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.04)));
  backdrop(g, w, h, c);
  dust(g, w, h, c, v);
  font(g, size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = c.alpha(c.colors.fg, 0.85);
  g.fillText('your sky', lay.left + lay.side / 2, h * 0.085, lay.side);
  const c0 = lay.cells[0];
  const c1 = lay.cells[1];
  g.fillText('four skies', c0.x + (c1.x + c1.side - c0.x) / 2, h * 0.085, c1.x + c1.side - c0.x);
  skyBox(g, c, reference(plan, rite, s, reduced), lay.left, lay.top, lay.side, v, { rite, border: c.alpha(c.colors.accent, 0.8) });
  plan.skies.forEach((sky, i) => {
    const cell = lay.cells[i];
    const mine = own(rite, 0x200 + i);
    // Chosen: the sky is cut in by the edge; the one chosen before it gives its fill back the
    // same way, the region shrinking.
    const chosenK = level(mine, s, s.choice === i, s.choiceAt, s.wasChoice === i ? s.wasChoiceAt : -1, 0.8, reduced);
    // A decoy: a veil is cut over it by the edge, and the word comes with its first tread.
    const hp = s.hinted.includes(i) ? came(s, s.hintAt[i], 1.1, reduced) : 0;
    const decoyK = hp > 0 ? mine.stair(hp) : 0;
    // Yours, once solved: a brighter surface of its own is cut in by the edge over the chosen
    // fill (the sky found is the sky chosen, so the chosen fill is already whole underneath).
    const fp = s.doneAt >= 0 && i === plan.which ? came(s, s.doneAt, 1.6, reduced) : 0;
    const foundK = fp > 0 ? mine.stair(fp) : 0;
    const found = foundK > 0;
    skyBox(g, c, sky, cell.x, cell.y, cell.side, v, {
      rite, label: SKIES[i],
      fill: c.alpha(c.colors.accent2, 0.1), fillK: chosenK,
      lit: c.alpha(c.colors.accent2, 0.18), litK: foundK,
      veil: c.alpha(c.colors.bg, 0.48), veilK: decoyK,
      note: decoyK > 0 ? 'decoy' : '',
      border: found || chosenK > 0 ? c.colors.accent2 : undefined,
      width: found || chosenK >= 0.5 ? 2 : 1
    });
  });
  font(g, size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (s.live) {
    if (own(rite, 0x5a1d).flicker(came(s, s.saidAt, 0.8, reduced))) {
      g.fillStyle = c.alpha(c.colors.fg, 0.8);
      g.fillText((s.choice >= 0 ? 'sky ' + SKIES[s.choice] : 'no sky yet') + ', ' + turnsWord(s.turns) + (s.mirror ? ', flipped first' : ', not flipped'), w / 2, h * 0.9, w * 0.9);
    }
  } else {
    g.fillStyle = c.alpha(c.colors.muted, 0.85);
    g.fillText('one of the four is your sky, turned; the others are near misses', w / 2, h * 0.9, w * 0.92);
  }
}

function whichPreview(g, w, h, env, plan) {
  whichScene(g, w, h, env, plan, whichState(0), dials(env));
}

function whichPiece(env, plan) {
  const helps = asked(env).helps;
  const n = plan.points.length;
  const v = dials(env);
  const s = whichState(0);
  s.live = true;
  const draw = (c) => whichScene(c.g, c.w, c.h, c, plan, s, v);
  const said = () => { s.saidAt = s.t; };
  return {
    title: whichTitle(plan),
    brief: 'Your sigil, turned. One of the four small skies is your ' + WORDS[n] + ' lights, turned clockwise by one, two or three quarter turns -- and perhaps flipped left for right before it was turned. The other three are near misses: the same lights, with a few nudged out of place.',
    goal: 'Say which sky is yours, how many quarter turns it was given, and whether it was flipped.',
    aspect: '4 / 3',
    checkLabel: 'check the skies',
    steps: [
      { id: 'sky', ask: 'which sky is yours', kind: 'choice', options: range(4).map((k) => ({ label: 'sky ' + SKIES[k], value: k })) },
      { id: 'turns', ask: 'how far it was turned, clockwise', kind: 'number', min: 1, max: 3, step: 1, value: 1, unit: 'quarter turns' },
      { id: 'mirror', ask: 'flipped left for right before the turn', kind: 'toggle', label: 'it was flipped' },
      { id: 'hint', ask: 'one sky that is not yours', kind: 'press', count: 1, label: 'mark a decoy', optional: true }
    ],
    solution: { sky: plan.which, turns: plan.turns, mirror: plan.mirror },
    check(c) {
      const sky = Number(c.value('sky')) === plan.which;
      const turns = Number(c.value('turns')) === plan.turns;
      const mirror = !!c.value('mirror') === plan.mirror;
      if (sky && turns && mirror) return { solved: true, say: 'sky ' + SKIES[plan.which] + ' is yours: ' + turnsWord(plan.turns) + (plan.mirror ? ', flipped first' : '') };
      return {
        solved: false,
        say: [sky ? 'the sky holds' : 'that sky is not yours', turns ? 'the turn holds' : 'the turn is off', mirror ? 'the flip holds' : 'the flip is off'].join('; ')
      };
    },
    start(c) {
      c.status('four skies; one is yours, turned');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'sky') {
        const k = Number(value);
        if ([0, 1, 2, 3].includes(k) && k !== s.choice) {
          s.wasChoice = s.choice;
          s.wasChoiceAt = s.t;
          s.choice = k;
          s.choiceAt = s.t;
        }
        said();
        c.status('sky ' + SKIES[s.choice] + '; now how far it turned, and whether it was flipped');
      }
      if (id === 'turns') {
        const k = Math.round(Number(value));
        if (k >= 1 && k <= 3) s.turns = k;
        said();
        c.status(turnsWord(s.turns) + ' clockwise');
      }
      if (id === 'mirror') {
        s.mirror = !!value;
        said();
        c.status(s.mirror ? 'flipped left for right, then turned' : 'turned, never flipped');
      }
      if (id === 'hint') {
        const next = s.hinted.length < helps
          ? range(4).find((k) => k !== plan.which && !s.hinted.includes(k)) : undefined;
        if (next !== undefined) {
          s.hinted.push(next);
          s.hintAt[next] = s.t;
          c.hint();
          c.status('sky ' + SKIES[next] + ' is a decoy: a light or two of it is off');
        } else if (s.hinted.length >= helps) {
          c.status('that is all the sky will mark at this difficulty; read the rest against your own');
        } else {
          c.status('every decoy is marked; the sky left is yours, and its turn is still to find');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const lay = whichLayout(c.w, c.h);
      const k = lay.cells.findIndex((cell) => x * c.w >= cell.x && x * c.w <= cell.x + cell.side && y * c.h >= cell.y && y * c.h <= cell.y + cell.side);
      if (k < 0) return;
      c.status('sky ' + SKIES[k] + (s.hinted.includes(k) ? ', a decoy' : '; choose it on the rail if it is yours'));
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done && s.doneAt < 0) s.doneAt = s.t;
      draw(c);
    },
    end(c) {
      c.status('sky ' + SKIES[plan.which] + ' is yours, ' + turnsWord(plan.turns) + (plan.mirror ? ', flipped first' : '') + '; watch your sky turn to meet it');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which of the two this card is, and its plan, dealt once from the env's seeded stream and kept
// with that env. Every pass over one card -- the still picture, the spark and the piece it opens
// as -- asks here, so they are all the same card; dealing again on a later pass would hand the
// visitor another puzzle from the one they pressed (issue #92, and js/feed.js on what a card owes
// its module).
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    const postcard = env.chance(0.5);
    got = { postcard, plan: postcard ? postcardPlan(env) : whichPlan(env) };
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'wish-constellation',
  needsSky: true,
  // The card is a still picture: its lights wait for nothing, so it has no animate and the feed
  // never repaints it.
  paint(g, w, h, env) {
    const d = deal(env);
    if (d.postcard) postcardPreview(g, w, h, env, d.plan);
    else whichPreview(g, w, h, env, d.plan);
  },
  spark(env) {
    const d = deal(env);
    if (d.postcard) {
      const plan = d.plan;
      return {
        title: postcardTitle(plan),
        quote: WORDS[plan.points.length] + ' lights, two eyes, one depth',
        text: 'A light shifts between the views by more the nearer it is. Put them in order, nearest to farthest.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => postcardPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const plan = d.plan;
    return {
      title: whichTitle(plan),
      quote: 'four skies; one is your sigil, turned',
      text: 'Your ' + WORDS[plan.points.length] + ' lights, turned and maybe flipped, among three near misses. Say which sky, how far it turned and whether it was flipped.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => whichPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const postcard = carriedPostcard(env);
    if (postcard) return postcardPiece(env, postcard);
    const which = carriedWhich(env);
    if (which) return whichPiece(env, which);
    const d = deal(env);
    return d.postcard ? postcardPiece(env, d.plan) : whichPiece(env, d.plan);
  }
};
