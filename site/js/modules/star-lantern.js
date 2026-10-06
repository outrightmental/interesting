/* The lantern ritual: the persona's stars as lanterns. As a card, one of them is lit (paint,
   spark); as a piece, a few are kindled in an order the visitor chooses and sent off by the rite
   the seed picked, or braided together and watched before release. See js/feed.js for what a
   module is and js/stage.js for what a piece is.

   The release is not the same twice: the seed chooses which orders are offered, which dial sits
   between the kindling and the finale, how long the finale is held, and where the lanterns go
   when they are let go. The knobs are a chain -- order, then kindling, then the dial, then the
   release -- so the finale is the last thing a visitor can reach and never the first.

   A card and the feature it opens as are one lantern night: the spark puts the lantern it lit on
   its spec as `of`, and the piece begins at that lantern -- pressing a kindled wish in the feed
   opens the rite that kindles it first. */

// Which lantern the card this piece was opened from had lit, in the sky as it stands now: the star
// that said the same thing, or the place it was at if the sky has moved under it. Null for a piece
// nobody pressed (js/stage.js hands the card over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  const stars = env.stars || [];
  if (!was || !stars.length) return null;
  let at = typeof was.star === 'string' && was.star ? stars.findIndex((st) => st.text === was.star) : -1;
  if (at < 0) {
    const i = Number(was.at);
    at = isFinite(i) ? Math.max(0, Math.min(stars.length - 1, Math.round(i))) : -1;
  }
  return at < 0 ? null : { at, text: stars[at].text || '' };
}

const ORDERS = [
  { label: 'left to right', value: 'x' },
  { label: 'low to high', value: 'y' },
  { label: 'nearest first', value: 'near' },
  { label: 'the longest wish first', value: 'long' }
];

// The dial between the kindling and the finale: one knob, two quite different things to set.
const DIALS = [
  { id: 'wind', ask: 'the wind', low: 'still', high: 'gusting', value: 30, brief: 'set the wind' },
  { id: 'glow', ask: 'how hard they burn', low: 'embers', high: 'blazing', value: 55, brief: 'set how hard they burn' }
];

// What letting go does, and what the piece is called for doing it.
const RITES = [
  {
    id: 'rise',
    going: 'rising',
    ask: 'let them rise',
    label: 'hold to release',
    brief: 'hold to let them rise',
    title: (need, all) => (need === all ? 'light every lantern and let it rise' : 'light ' + need + ' lanterns and let them rise'),
    close: (need, all) => (need === all ? 'all of them, up and away' : need + ' lanterns, up and away')
  },
  {
    id: 'drift',
    going: 'away downwind',
    ask: 'send them downwind',
    label: 'hold to let go',
    brief: 'hold to send them downwind',
    title: (need, all) => (need === all ? 'light every lantern and send it downwind' : 'send ' + need + ' lanterns downwind'),
    close: (need, all) => (need === all ? 'all of them, out over the dark' : need + ' lanterns, out over the dark')
  },
  {
    id: 'spiral',
    going: 'turning as they climb',
    ask: 'wind them up and away',
    label: 'hold until they lift',
    brief: 'hold until they spiral up',
    title: (need, all) => (need === all ? 'light every lantern and wind it up' : 'wind ' + need + ' lanterns up and away'),
    close: (need, all) => (need === all ? 'all of them, turning as they go' : need + ' lanterns, turning as they go')
  }
];

// One lantern, `size` across as a multiple of the size it hangs at on the page: a card's own, from
// the configuration it was dealt, and one for the piece, where the lanterns are the ritual itself.
// The halo answers to `glow`, so a dial that sets how hard they burn has something to show for it.
function lantern(ctx, env, x, y, lit, glow, size) {
  const c = env.colors;
  const k = size || 1;
  const lw = 10 * k;
  const lh = 14 * k;
  if (lit) {
    const reach = 34 * glow * k;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, reach);
    halo.addColorStop(0, env.alpha(c.accent2, Math.min(0.85, 0.3 + glow * 0.25)));
    halo.addColorStop(1, env.alpha(c.accent2, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
  }
  // The string.
  ctx.strokeStyle = env.alpha(c.muted, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - lh / 2 - 14);
  ctx.lineTo(x, y - lh / 2);
  ctx.stroke();
  // The lantern.
  ctx.fillStyle = lit ? c.accent2 : env.alpha(c.accent, 0.35);
  ctx.beginPath();
  ctx.roundRect(x - lw / 2, y - lh / 2, lw, lh, 3);
  ctx.fill();
  ctx.fillStyle = env.alpha(c.fg, lit ? 0.9 : 0.4);
  ctx.fillRect(x - lw / 2 - 1, y - lh / 2 - 2, lw + 2, 2);
  ctx.fillRect(x - lw / 2 - 1, y + lh / 2, lw + 2, 2);
}

function sky(ctx, w, h, env) {
  const c = env.colors;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.bg);
  g.addColorStop(1, c.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The card: the sky, and a lantern at every star, hanging as large and as high as the configuration
// the card was dealt asks for.
function lanterns(ctx, w, h, env, litIndex, t) {
  const v = env.variant;
  sky(ctx, w, h, env);
  env.points(w, h, 18).forEach((p, i) => {
    const bob = Math.sin((t || 0) * 0.8 + i * 1.1 + v.turn * Math.PI * 2) * 3;
    lantern(ctx, env, p.x, p.y + bob, i === litIndex, 1, v.scale);
  });
}

// Which lantern is next, for every order both shapes can offer.
function nextByOrder(pts, lit, order, x, y, first) {
  const unlit = pts.map((p, i) => i).filter((i) => lit.indexOf(i) === -1);
  if (!unlit.length) return -1;
  // The lantern the card had lit goes first, while it is still unlit; after that this order is
  // the nearest one, which is where the rite carries on from.
  if (order === 'card' && first >= 0 && unlit.indexOf(first) !== -1) return first;
  if (order === 'x') return unlit.sort((a, b) => pts[a].x - pts[b].x)[0];
  if (order === 'y') return unlit.sort((a, b) => pts[b].y - pts[a].y)[0];
  if (order === 'long') return unlit.sort((a, b) => String(pts[b].text || '').length - String(pts[a].text || '').length)[0];
  return unlit.sort((a, b) => {
    const da = (pts[a].x - x) ** 2 + (pts[a].y - y) ** 2;
    const db = (pts[b].x - x) ** 2 + (pts[b].y - y) ** 2;
    return da - db;
  })[0];
}

// Where a lantern has got to, once it has been let go: the rite decides.
function flight(rite, s, i, h) {
  if (!s.rise) return { dx: 0, dy: 0 };
  const r = s.rise;
  const far = (h + 80) * (0.6 + (i % 3) * 0.2);
  if (rite === 'drift') return { dx: r * (50 + s.wind * 280) * (1 + (i % 2) * 0.4), dy: -r * far * 0.7 };
  if (rite === 'spiral') return { dx: Math.sin(r * 7 + i * 1.7) * (20 + s.wind * 40) * r, dy: -r * r * far };
  return { dx: 0, dy: -r * r * far };
}

// Shape one: kindle a few and send them off by the rite the seed picked.
function releasePiece(env) {
  const was = pressed(env);
  const n = env.stars.length;
  const need = Math.min(n, env.int(3, 5));
  const rite = env.pick(RITES);
  const dial = env.pick(DIALS);
  const hold = env.int(1200, 2400);
  // Two or three of the orders, in a seeded order of their own: which ways in are offered is part
  // of what makes one lantern night different from the next.
  const pool = ORDERS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(env.rnd() * (i + 1));
    const held = pool[i];
    pool[i] = pool[j];
    pool[j] = held;
  }
  const orders = pool.slice(0, env.int(2, 3));
  // The lantern the card had lit is the first way in, when this piece was opened from a card.
  if (was) orders.unshift({ label: 'the one on your card', value: 'card' });
  const s = { order: orders[0].value, lit: [], wind: 0.3, glow: 0.55, rise: 0, t: 0, last: null };
  function points(c) {
    return c.points(c.w, c.h, 18);
  }
  function nextIndex(pts, x, y) {
    return nextByOrder(pts, s.lit, s.order, x, y, was ? was.at : -1);
  }
  return {
    title: rite.title(need, n),
    brief: 'Choose the order, tap the sky to kindle each lantern, ' + dial.brief + ', and ' + rite.brief + '.'
      + (was && was.text ? ' The one your card lit said "' + was.text + '".' : ''),
    aspect: '16 / 10',
    // A chain, on purpose: the release is the rite's last gesture, so it waits on the dial, which
    // waits on the kindling, which waits on the order. No knob of this piece can be reached
    // before the one the brief puts in front of it, and none is left behind when the finale runs.
    steps: [
      { id: 'order', ask: 'which lights first', kind: 'choice', options: orders },
      { id: 'kindle', ask: need === 1 ? 'tap the sky once' : 'tap the sky ' + need + ' times', kind: 'tap', label: 'kindle one for me', after: 'order' },
      { id: dial.id, ask: dial.ask, kind: 'range', min: 0, max: 100, step: 1, value: dial.value, low: dial.low, high: dial.high, after: 'kindle' },
      { id: 'release', ask: rite.ask, kind: 'hold', ms: hold, label: rite.label, after: dial.id }
    ],
    start(c) {
      sky(c.g, c.w, c.h, c);
      points(c).forEach((p) => lantern(c.g, c, p.x, p.y, false, 0.3 + s.glow * 0.9));
    },
    apply(id, value, c) {
      if (id === 'order') s.order = String(value);
      if (id === 'wind') s.wind = Math.max(0, Math.min(1, Number(value) / 100));
      if (id === 'glow') s.glow = Math.max(0, Math.min(1, Number(value) / 100));
      if (id === 'release') {
        s.rise = 0.001;
        c.status(rite.going);
      }
    },
    tap(x, y, c) {
      if (s.lit.length >= need || s.rise) return;
      const pts = points(c);
      const i = nextIndex(pts, x * c.w, y * c.h);
      if (i < 0) return;
      s.lit.push(i);
      s.last = pts[i].text || '';
      c.progress('kindle', s.lit.length / need);
      c.status(s.last ? 'lit: ' + s.last : s.lit.length + ' lit');
      if (s.lit.length >= need) c.satisfy('kindle');
    },
    frame(t, dt, c) {
      s.t += dt;
      if (s.rise) s.rise = Math.min(1, s.rise + dt * 0.5);
      sky(c.g, c.w, c.h, c);
      const pts = points(c);
      const burn = 0.3 + s.glow * 0.9;
      pts.forEach((p, i) => {
        const lit = s.lit.indexOf(i) !== -1;
        const bob = Math.sin(s.t * (0.6 + s.wind * 1.6) + i * 1.1) * (2 + s.wind * 9);
        const sway = Math.sin(s.t * (0.4 + s.wind) + i) * s.wind * 10;
        const gone = lit ? flight(rite.id, s, i, c.h) : { dx: 0, dy: 0 };
        lantern(c.g, c, p.x + sway + gone.dx, p.y + bob + gone.dy, lit, lit && s.rise ? burn * (1 + s.rise) : burn);
      });
    },
    end(c) {
      c.status(rite.close(need, n));
    }
  };
}

// Shape two: light by sequence, watch the lit set braid itself, then release.
function braidPiece(env) {
  const was = pressed(env);
  const n = env.stars.length;
  const need = Math.min(n, env.int(3, 5));
  const settleFor = env.pick([3, 4, 5]);
  // A braid begins at the lantern the card had lit, and spreads from there by nearness.
  const s = { order: was ? 'near' : 'x', lit: [], wind: 0.28, weave: 0, rise: 0, t: 0,
    pivot: was ? was.at : null };

  function points(c) {
    return c.points(c.w, c.h, 18);
  }

  function choose(pts, c) {
    if (s.order === 'near') {
      const base = s.pivot == null ? { x: c.w * 0.5, y: c.h * 0.72 } : pts[s.pivot];
      return nextByOrder(pts, s.lit, 'near', base.x, base.y);
    }
    return nextByOrder(pts, s.lit, s.order, 0, 0);
  }

  function drawLinks(c, pts) {
    if (!s.lit.length) return;
    const g = c.g;
    const k = Math.min(c.w, c.h);
    g.lineWidth = Math.max(1, k * 0.004);
    for (let i = 1; i < s.lit.length; i++) {
      const a = pts[s.lit[i - 1]];
      const b = pts[s.lit[i]];
      const pulse = 0.5 + Math.sin(s.t * 2 + i * 0.8) * 0.25;
      g.strokeStyle = c.alpha(c.colors.accent2, (0.32 + s.weave * 0.5) * pulse);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
  }

  return {
    title: need === n ? 'braid every lantern' : 'braid ' + need + ' lanterns',
    brief: 'Choose the lighting order, set the wind, light the next lantern each press, then watch the lit set braid itself before they rise.'
      + (was && was.text ? ' It is anchored on the one your card lit, which said "' + was.text + '".' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'order', ask: 'which lantern anchors first', kind: 'choice', options: ORDERS },
      { id: 'wind', ask: 'the wind', kind: 'range', min: 0, max: 100, step: 1, value: 28, low: 'still', high: 'gusting' },
      { id: 'light', ask: 'light the next lantern ' + need + ' times', kind: 'press', count: need, label: 'light next', after: 'order' },
      { id: 'braid', ask: 'watch them braid', kind: 'wait', after: 'light' }
    ],
    start(c) {
      sky(c.g, c.w, c.h, c);
      points(c).forEach((p) => lantern(c.g, c, p.x, p.y, false, 1));
    },
    apply(id, value, c) {
      if (id === 'order') {
        s.order = String(value);
        c.status('order set to ' + (ORDERS.find((o) => o.value === s.order) || ORDERS[0]).label);
      }
      if (id === 'wind') {
        s.wind = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(s.wind < 0.2 ? 'wind low' : s.wind < 0.6 ? 'wind moving' : 'wind up');
      }
      if (id === 'light') {
        const pts = points(c);
        const next = choose(pts, c);
        if (next < 0) return;
        s.lit.push(next);
        s.pivot = next;
        const p = pts[next];
        c.status(p.text ? 'lit: ' + p.text : s.lit.length + ' lit');
      }
    },
    frame(t, dt, c) {
      s.t += dt;
      if (!c.done && s.lit.length >= need) {
        s.weave = Math.min(1, s.weave + dt / settleFor);
        c.progress('braid', s.weave);
        if (s.weave >= 1) {
          c.status('braid complete');
          c.satisfy('braid');
        }
      }
      if (c.done) s.rise = Math.min(1, s.rise + dt * 0.45);

      sky(c.g, c.w, c.h, c);
      const pts = points(c);
      drawLinks(c, pts);
      pts.forEach((p, i) => {
        const lit = s.lit.indexOf(i) !== -1;
        const wobble = Math.sin(s.t * (0.55 + s.wind * 1.5) + i * 1.2) * (1.6 + s.wind * 7);
        const drift = Math.sin(s.t * (0.35 + s.wind) + i * 0.9) * s.wind * 9;
        const lift = lit ? s.weave * (0.25 + (i % 3) * 0.12) : 0;
        const rise = lit ? s.rise * s.rise * (c.h + 70) * (0.55 + (i % 4) * 0.14) : 0;
        lantern(c.g, c, p.x + drift, p.y + wobble - lift * 12 - rise, lit, lit ? 1 + s.weave * 0.6 : 1);
      });
    },
    end(c) {
      c.status(need === n ? 'every lantern braided, then released' : need + ' lanterns braided, then released');
    }
  };
}

export default {
  id: 'star-lantern',
  needsSky: true,
  paint(ctx, w, h, env) {
    lanterns(ctx, w, h, env, env.int(0, Math.max(0, env.stars.length - 1)), 0);
  },
  animate(ctx, w, h, env, t) {
    lanterns(ctx, w, h, env, env.seed % Math.max(1, env.stars.length), t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const i = env.int(0, env.stars.length - 1);
    return {
      title: 'kindle this one',
      quote: env.stars[i].text,
      text: 'One lantern at a time. This one is lit; the other ' + (env.stars.length - 1) + ' wait for you.',
      aspect: '3 / 4',
      paint: (ctx, w, h, e) => lanterns(ctx, w, h, e, i, 0),
      // What this card is of, for the piece it opens as: the lantern it has lit.
      of: { star: env.stars[i].text, at: i }
    };
  },
  piece(env) {
    if (env.chance(0.52)) return releasePiece(env);
    return braidPiece(env);
  }
};