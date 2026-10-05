/* The weather lab, as a card: the persona's stars as pressure systems, and a forecast. See
   js/feed.js for what a module is. */

const FRONTS = ['a warm front', 'a cold front', 'an occluded front', 'a stationary front', 'a line of squalls'];
const DIRS = ['north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north'];
const WINDS = ['light and variable', 'fresh from the west', 'gusting at the edges', 'calm at the centre', 'backing slowly'];
const VIS = ['good, then middling', 'poor in the gaps between stars', 'excellent above the cloud', 'moderate, with haze'];
const LINES = [
  'Click the map on its page to launch a probe.',
  'The front is your two farthest stars; everything else is weather.',
  'Printable, if you print it. Nothing here will come true.',
  'Pressure follows the stars. Move one and the map redraws.'
];

function map(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  const step = Math.max(14, Math.round(24 / v.scale));
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  // A faint graticule.
  ctx.strokeStyle = env.alpha(c.muted, 0.12);
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  const pts = env.points(w, h, 14);
  // Isobars round each system; the high ones are the stars that sit high.
  pts.forEach((p, i) => {
    const high = p.y < h / 2;
    const rings = Math.max(2, Math.round((3 + (i % 3)) * v.density));
    for (let r = 1; r <= rings; r++) {
      ctx.strokeStyle = env.alpha(high ? c.accent2 : c.accent, Math.max(0.04, 0.42 - r * (0.32 / rings)));
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 11 * v.scale, r * 8.5 * v.scale, (i * 0.7 + v.turn * Math.PI) % Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = env.alpha(c.fg, 0.9);
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText(high ? 'H' : 'L', p.x - 3.5, p.y + 4);
  });
  // The front: between the two farthest stars, with its teeth.
  if (pts.length >= 2) {
    let a = pts[0];
    let b = pts[1];
    let far = 0;
    for (const p of pts) for (const q of pts) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d > far) {
        far = d;
        a = p;
        b = q;
      }
    }
    ctx.strokeStyle = env.alpha(c.accent2, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const steps = Math.max(2, Math.floor(far / 22));
    const nx = -(b.y - a.y) / far;
    const ny = (b.x - a.x) / far;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      ctx.fillStyle = env.alpha(c.accent2, 0.8);
      ctx.beginPath();
      ctx.moveTo(x - ny * 4, y + nx * 4);
      ctx.lineTo(x + ny * 4, y - nx * 4);
      ctx.lineTo(x + nx * 7, y + ny * 7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export default {
  id: 'constellation-weather',
  needsSky: true,
  paint(ctx, w, h, env) {
    map(ctx, w, h, env);
  },
  spark(env) {
    const stars = env.stars;
    if (!stars.length) return null;
    let highs = 0;
    let cx = 0;
    for (const s of stars) {
      if (s.y < 50) highs++;
      cx += s.x;
    }
    cx /= stars.length;
    const where = cx < 40 ? 'west' : cx > 60 ? 'east' : 'middle';
    return {
      title: 'forecast',
      mono: 'pressure: ' + (highs > stars.length / 2 ? 'high' : 'low') + ' over the ' + where
        + '\nfront: ' + env.pick(FRONTS) + ', moving ' + env.pick(DIRS)
        + '\nwind: ' + env.pick(WINDS)
        + '\nvisibility: ' + env.pick(VIS),
      text: env.pick(LINES),
      aspect: '16 / 10',
      paint: map
    };
  }
};
