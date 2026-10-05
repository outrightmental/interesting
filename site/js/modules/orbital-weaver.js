/* The orbital weaver, as a card: the persona's stars mirrored into a mandala, and a mantra woven
   from what they say. See js/feed.js for what a module is. */

function weave(ctx, w, h, env, spokes, t) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.46 * v.scale;
  const pts = env.stars.map((s) => ({ r: (Math.hypot(s.x - 50, s.y - 50) / 70) * R, a: Math.atan2(s.y - 50, s.x - 50) }));
  pts.sort((p, q) => p.a - q.a);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  for (let k = 0; k < spokes; k++) {
    const rot = (k / spokes) * Math.PI * 2 + t * 0.08 + v.turn * Math.PI * 2;
    for (const mirror of [1, -1]) {
      ctx.strokeStyle = env.alpha(k % 2 ? c.accent : c.accent2, 0.5);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const a = rot + p.a * mirror;
        const x = cx + Math.cos(a) * p.r;
        const y = cy + Math.sin(a) * p.r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      for (const p of pts) {
        const a = rot + p.a * mirror;
        ctx.fillStyle = env.alpha(c.fg, 0.85);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * p.r, cy + Math.sin(a) * p.r, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = env.alpha(c.accent, 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}

export default {
  id: 'orbital-weaver',
  needsSky: true,
  paint(ctx, w, h, env) {
    weave(ctx, w, h, env, Math.max(3, Math.round(env.int(4, 9) * env.variant.density)), 0);
  },
  animate(ctx, w, h, env, t) {
    const spokes = 4 + Math.floor(env.seed % 6);
    weave(ctx, w, h, env, spokes, t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const k = env.int(3, 12);
    const words = [];
    const pool = env.stars.slice();
    while (words.length < Math.min(3, pool.length)) {
      const i = Math.floor(env.rnd() * pool.length);
      words.push(pool.splice(i, 1)[0].text);
    }
    return {
      title: 'a mantra',
      quote: words.join(' · '),
      text: k + ' spokes of symmetry, ' + env.stars.length + ' star' + (env.stars.length === 1 ? '' : 's') + ' mirrored. Say it until the pattern closes.',
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => weave(ctx, w, h, e, k, 0)
    };
  }
};
