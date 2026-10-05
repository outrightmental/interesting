/* The echo chamber, as a card: the persona's stars as drifting echoes, and an echo weather
   bulletin. See js/feed.js for what a module is. */

const OPENERS = ['echo weather bulletin:', 'resonance report:', 'night acoustics memo:', 'field monitor:'];
const MIDS = [
  'The chamber favours momentum over perfection.',
  'Small experiments are amplifying quickly in here.',
  'The pattern suggests a brave draft is ready to leave the dock.',
  'Playful focus is currently louder than hesitation.'
];
const CLOSERS = [
  'Send one tiny signal before midnight.',
  'Pulse the field twice and read again.',
  'Name the next action in six words and do it.',
  'Share one unfinished idea with someone kind.'
];

function echoes(ctx, w, h, env, t) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const base = env.points(w, h, 16);
  const pts = base.map((p, i) => ({
    x: p.x + Math.sin(t * 0.5 + i * 1.7) * 6,
    y: p.y + Math.cos(t * 0.4 + i * 2.3) * 5
  }));
  const maxD = Math.min(w, h) * 0.3 * v.scale;
  ctx.lineWidth = 1;
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const d = Math.hypot(pts[b].x - pts[a].x, pts[b].y - pts[a].y);
      if (d > maxD) continue;
      ctx.strokeStyle = env.alpha(c.accent, 0.08 + (1 - d / maxD) * 0.35);
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
  }
  pts.forEach((p, i) => {
    const pulse = 0.6 + Math.sin(t * 2 + i) * 0.3;
    for (let r = 1, rings = Math.max(1, Math.round(3 * v.density)); r <= rings; r++) {
      ctx.strokeStyle = env.alpha(c.accent, Math.max(0.03, 0.3 - r * (0.24 / rings)) * pulse);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (4 + r * 5 * pulse) * v.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = env.alpha(c.fg, 0.95);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

export default {
  id: 'constellation-echo',
  needsSky: true,
  paint(ctx, w, h, env) {
    echoes(ctx, w, h, env, env.variant.turn * 12 + env.rnd() * 10);
  },
  animate(ctx, w, h, env, t) {
    echoes(ctx, w, h, env, t + env.variant.turn * 12);
  },
  spark(env) {
    const stars = env.stars;
    if (!stars.length) return null;
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
    const zone = (cy < 50 ? 'north' : 'south') + '-' + (cx < 50 ? 'west' : 'east');
    const spreadWord = spread < 12 ? 'compact' : spread < 24 ? 'balanced' : 'wide';
    const density = stars.length < 5 ? 'quiet' : stars.length < 14 ? 'steady' : 'crowded';
    return {
      title: env.pick(OPENERS).replace(':', ''),
      mono: stars.length + ' echoes, ' + spreadWord + ' spread\nchamber ' + zone + ', tone ' + density,
      text: env.pick(MIDS) + ' ' + env.pick(CLOSERS),
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => echoes(ctx, w, h, e, e.rnd() * 10)
    };
  }
};
