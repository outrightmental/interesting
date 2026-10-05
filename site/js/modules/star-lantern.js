/* The lantern ritual, as a card: the persona's stars as lanterns, one of them lit. See js/feed.js
   for what a module is. */

function lanterns(ctx, w, h, env, litIndex, t) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.bg);
  g.addColorStop(1, c.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const pts = env.points(w, h, 18);
  pts.forEach((p, i) => {
    const bob = t ? Math.sin(t * 0.8 + i * 1.1 + v.turn * Math.PI * 2) * 3 : 0;
    const x = p.x;
    const y = p.y + bob;
    const lit = i === litIndex;
    const lw = 10 * v.scale;
    const lh = 14 * v.scale;
    if (lit) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 34 * v.scale);
      glow.addColorStop(0, env.alpha(c.accent2, 0.55));
      glow.addColorStop(1, env.alpha(c.accent2, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 34, y - 34, 68, 68);
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
  });
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
  }
};
