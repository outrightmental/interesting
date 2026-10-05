/* The lantern ritual: the persona's stars as lanterns. As a card, one of them is lit (paint,
   spark); as a piece, a few are kindled in an order the visitor chooses and let rise on a wind
   they set. See js/feed.js for what a module is and js/stage.js for what a piece is. */

const ORDERS = [
  { label: 'left to right', value: 'x' },
  { label: 'low to high', value: 'y' },
  { label: 'nearest first', value: 'near' }
];

// One lantern, `size` across as a multiple of the size it hangs at on the page: a card's own, from
// the configuration it was dealt, and one for the piece, where the lanterns are the ritual itself.
function lantern(ctx, env, x, y, lit, glow, size) {
  const c = env.colors;
  const k = size || 1;
  const lw = 10 * k;
  const lh = 14 * k;
  if (lit) {
    const reach = 34 * glow * k;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, reach);
    halo.addColorStop(0, env.alpha(c.accent2, 0.55));
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

function piece(env) {
  const n = env.stars.length;
  if (!n) return null;
  const need = Math.min(n, env.int(3, 5));
  const s = { order: 'near', lit: [], wind: 0.3, rise: 0, t: 0, last: null };
  function points(c) {
    return c.points(c.w, c.h, 18);
  }
  function nextIndex(pts, x, y) {
    const unlit = pts.map((p, i) => i).filter((i) => s.lit.indexOf(i) === -1);
    if (!unlit.length) return -1;
    if (s.order === 'x') return unlit.sort((a, b) => pts[a].x - pts[b].x)[0];
    if (s.order === 'y') return unlit.sort((a, b) => pts[b].y - pts[a].y)[0];
    return unlit.sort((a, b) => {
      const da = (pts[a].x - x) ** 2 + (pts[a].y - y) ** 2;
      const db = (pts[b].x - x) ** 2 + (pts[b].y - y) ** 2;
      return da - db;
    })[0];
  }
  return {
    title: need === n ? 'light every lantern' : 'light ' + need + ' lanterns',
    brief: 'Choose the order, tap the sky to kindle the lanterns one by one, set the wind, and hold to let them rise.',
    aspect: '16 / 10',
    steps: [
      { id: 'order', ask: 'which lights first', kind: 'choice', options: ORDERS },
      { id: 'kindle', ask: need === 1 ? 'tap the sky once' : 'tap the sky ' + need + ' times', kind: 'tap', label: 'kindle one for me', after: 'order' },
      { id: 'wind', ask: 'the wind', kind: 'range', min: 0, max: 100, step: 1, value: 30, low: 'still', high: 'gusting' },
      { id: 'release', ask: 'let them rise', kind: 'hold', ms: 1800, label: 'hold to release', after: 'kindle' }
    ],
    start(c) {
      sky(c.g, c.w, c.h, c);
      points(c).forEach((p) => lantern(c.g, c, p.x, p.y, false, 1));
    },
    apply(id, value, c) {
      if (id === 'order') s.order = String(value);
      if (id === 'wind') s.wind = Math.max(0, Math.min(1, Number(value) / 100));
      if (id === 'release') {
        s.rise = 0.001;
        c.status('rising');
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
      pts.forEach((p, i) => {
        const lit = s.lit.indexOf(i) !== -1;
        const bob = Math.sin(s.t * (0.6 + s.wind * 1.6) + i * 1.1) * (2 + s.wind * 9);
        const sway = Math.sin(s.t * (0.4 + s.wind) + i) * s.wind * 10;
        const up = lit && s.rise ? s.rise * s.rise * (c.h + 80) * (0.6 + (i % 3) * 0.2) : 0;
        lantern(c.g, c, p.x + sway, p.y + bob - up, lit, lit && s.rise ? 1 + s.rise : 1);
      });
    },
    end(c) {
      c.status(need === n ? 'all of them, up and away' : need + ' lanterns, up and away');
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
      paint: (ctx, w, h, e) => lanterns(ctx, w, h, e, i, 0)
    };
  },
  piece
};
