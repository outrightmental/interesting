/* The terrarium, as a card: the persona's stars grown into plants under glass, and a greenhouse
   forecast. See js/feed.js for what a module is. */

const LIGHT = ['low and green', 'bright through the glass', 'dappled', 'thin, from the north'];
const WIND = ['none; the glass is shut', 'a draught from the vent', 'the fan, on low'];

function glasshouse(ctx, w, h, env, t) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const soilY = h * (0.76 + v.turn * 0.1);
  // The soil.
  ctx.fillStyle = env.mix(c.bg, '#000', 0.3);
  ctx.fillRect(0, soilY, w, h - soilY);
  for (let i = 0, grit = Math.round(60 * v.density); i < grit; i++) {
    ctx.fillStyle = env.alpha(c.accent2, 0.1 + env.rnd() * 0.15);
    ctx.fillRect(env.rnd() * w, soilY + env.rnd() * (h - soilY), 1.5, 1.5);
  }
  // The plants: one per star, as tall as the star is high.
  const stars = env.stars;
  stars.forEach((s, i) => {
    const x = 14 + (s.x / 100) * (w - 28);
    const height = ((100 - s.y) / 100) * (soilY - 16) * 0.85 + 10;
    const sway = t ? Math.sin(t * 0.9 + i + v.turn * Math.PI * 2) * 3 * v.scale : 0;
    ctx.strokeStyle = env.alpha(c.accent, 0.85);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, soilY);
    ctx.quadraticCurveTo(x + sway * 0.5, soilY - height * 0.6, x + sway, soilY - height);
    ctx.stroke();
    const leaves = 2 + Math.floor(height / 22);
    for (let l = 1; l <= leaves; l++) {
      const ly = soilY - (height * l) / (leaves + 1);
      const side = l % 2 ? 1 : -1;
      ctx.fillStyle = env.alpha(c.accent, 0.5 + (l / leaves) * 0.3);
      ctx.beginPath();
      ctx.ellipse(x + sway * (l / leaves) + side * 6 * v.scale, ly, 7 * v.scale, 3 * v.scale, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = env.alpha(c.accent2, 0.9);
    ctx.beginPath();
    ctx.arc(x + sway, soilY - height - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // The glass: a frame with its glazing bars, and a shine.
  ctx.strokeStyle = env.alpha(c.fg, 0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.lineWidth = 1;
  for (let bars = Math.max(2, Math.round(3 * v.density)), x = w / bars; x < w - 1; x += w / bars) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, h * 0.3);
  ctx.lineTo(w, h * 0.3);
  ctx.stroke();
  const shine = ctx.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, env.alpha(c.fg, 0.08));
  shine.addColorStop(0.5, env.alpha(c.fg, 0));
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, h);
}

export default {
  id: 'wish-terrarium',
  needsSky: true,
  paint(ctx, w, h, env) {
    glasshouse(ctx, w, h, env, 0);
  },
  animate(ctx, w, h, env, t) {
    glasshouse(ctx, w, h, env, t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    let tallest = env.stars[0];
    for (const s of env.stars) if (s.y < tallest.y) tallest = s;
    return {
      title: 'greenhouse forecast',
      mono: 'humidity: ' + env.int(55, 96) + '%\nlight: ' + env.pick(LIGHT) + '\nwind: ' + env.pick(WIND)
        + '\nthe tall one says: ' + tallest.text,
      text: env.stars.length + ' plant' + (env.stars.length === 1 ? '' : 's') + ' under glass, each grown from a star. Click one on its page to hear its thought.',
      aspect: '4 / 5',
      paint: (ctx, w, h, e) => glasshouse(ctx, w, h, e, 0)
    };
  }
};
