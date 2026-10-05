/* The diary, as a card: the persona's stars over a logbook, and an entry written from where one
   of them sits. See js/feed.js for what a module is. */

function where(s) {
  const ns = s.y < 35 ? 'high' : s.y > 65 ? 'low' : 'midway';
  const ew = s.x < 35 ? 'in the west' : s.x > 65 ? 'in the east' : 'near the middle';
  return ns + ' ' + ew;
}

function nearest(stars, star) {
  let best = null;
  let bd = Infinity;
  for (const o of stars) {
    if (o === star) continue;
    const d = Math.hypot(o.x - star.x, o.y - star.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function logbook(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  const split = h * (0.5 + v.turn * 0.16);
  const g = ctx.createLinearGradient(0, 0, 0, split);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, split);
  const pts = env.points(w, split, 10);
  ctx.lineWidth = 1;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = env.alpha(c.accent, 0.22);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  for (const p of pts) {
    ctx.fillStyle = env.alpha(c.fg, 0.95);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8 * v.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // The logbook page beneath: ruled, with one mark per star in the order they were placed.
  ctx.fillStyle = env.mix(c.bg, c.fg, 0.06);
  ctx.fillRect(0, split, w, h - split);
  const lines = Math.max(3, Math.round(5 * v.density));
  const step = (h - split) / (lines + 1);
  for (let i = 1; i <= lines; i++) {
    ctx.strokeStyle = env.alpha(c.accent, 0.25);
    ctx.beginPath();
    ctx.moveTo(14, split + step * i);
    ctx.lineTo(w - 14, split + step * i);
    ctx.stroke();
  }
  ctx.strokeStyle = env.alpha(c.accent2, 0.5);
  ctx.beginPath();
  ctx.moveTo(26, split);
  ctx.lineTo(26, h);
  ctx.stroke();
  const perLine = Math.ceil(pts.length / lines) || 1;
  pts.forEach((p, i) => {
    const row = Math.floor(i / perLine);
    const col = i % perLine;
    const len = 6 + ((p.text || '').length % 9) * 3;
    ctx.fillStyle = env.alpha(c.fg, 0.7);
    ctx.fillRect(34 + col * ((w - 50) / perLine), split + step * (row + 1) - 4, Math.min(len, (w - 50) / perLine - 6), 2);
  });
}

export default {
  id: 'constellation-diary',
  needsSky: true,
  paint(ctx, w, h, env) {
    logbook(ctx, w, h, env);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    const other = nearest(env.stars, star);
    const relation = other ? 'nearest the one that said "' + other.text + '"' : 'alone in the whole sky';
    return {
      title: 'entry ' + (env.hash(star.text + star.x) % 400 + 1),
      quote: 'The star that said "' + star.text + '" sits ' + where(star) + ', ' + relation + '.',
      text: 'Written from where it sits. Move it in your persona and the entry changes.',
      aspect: '4 / 3',
      paint: logbook
    };
  }
};
