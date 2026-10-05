/* The wish constellation, as a card: the persona's stars as a live sky, and a reading from them.
   See js/feed.js for what a module is. */

const ORACLE = [
  'Move one star and ask again.',
  'Whatever is nearest the middle is the thing to do first.',
  'The gap between the two farthest stars is the size of the next small experiment.',
  'A sky this shape wants one more star, and not where you would put it.',
  'Read it as a map, then walk the other way.',
  'The dim ones are not less true.'
];

function shape(stars) {
  if (stars.length < 3) return 'barely a sky yet';
  let cx = 0;
  let cy = 0;
  for (const s of stars) {
    cx += s.x;
    cy += s.y;
  }
  cx /= stars.length;
  cy /= stars.length;
  let spread = 0;
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy);
  spread /= stars.length;
  const side = cx < 40 ? 'leaning west' : cx > 60 ? 'leaning east' : 'centred';
  return (spread < 14 ? 'close-knit' : spread < 26 ? 'loosely gathered' : 'scattered wide') + ', ' + side;
}

function sky(ctx, w, h, env, t) {
  const c = env.colors;
  const v = env.variant;
  const dawn = w * (0.1 + v.turn * 0.8);
  const g = ctx.createRadialGradient(dawn, h * 0.1, 0, dawn, h * 0.1, Math.max(w, h) * 1.1);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Dust.
  const dust = env.rnd;
  for (let i = 0, motes = Math.round(40 * v.density); i < motes; i++) {
    ctx.fillStyle = env.alpha(c.fg, 0.08 + dust() * 0.2);
    ctx.fillRect(dust() * w, dust() * h, 1, 1);
  }
  const pts = env.points(w, h, 12);
  ctx.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d < Math.min(w, h) * 0.34 * v.scale) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (const n of near.slice(0, 2)) {
      if (n.j < i) continue;
      ctx.strokeStyle = env.alpha(c.accent, 0.18 + (1 - n.d / (Math.min(w, h) * 0.34 * v.scale)) * 0.5);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[n.j].x, pts[n.j].y);
      ctx.stroke();
    }
  }
  pts.forEach((p, i) => {
    const tw = t ? 0.75 + 0.25 * Math.sin(t * 1.7 + i * 1.3) : 1;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9 * tw * v.scale);
    glow.addColorStop(0, env.alpha(c.accent, 0.5));
    glow.addColorStop(1, env.alpha(c.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 * tw * v.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = env.alpha(c.fg, 0.95);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6 + 0.6 * tw, 0, Math.PI * 2);
    ctx.fill();
  });
}

export default {
  id: 'wish-constellation',
  needsSky: true,
  paint(ctx, w, h, env) {
    sky(ctx, w, h, env, 0);
  },
  animate(ctx, w, h, env, t) {
    sky(ctx, w, h, env, t + env.variant.turn * 6);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    return {
      title: 'a reading from your sky',
      quote: 'the sky says: ' + star.text,
      text: env.stars.length + ' star' + (env.stars.length === 1 ? '' : 's') + ', ' + shape(env.stars) + '. ' + env.pick(ORACLE),
      aspect: '4 / 3',
      paint: (ctx, w, h, e) => sky(ctx, w, h, e, 0)
    };
  }
};
