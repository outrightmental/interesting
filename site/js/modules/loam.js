/* Loam, as a card: a cutaway of soil with roots finding their way round the stones, and a core
   sample. See js/feed.js for what a module is. */

const LINES = [
  'Planted over gravel, so it went sideways for a while first.',
  'The interesting part was always underground.',
  'Roots take the path of least resistance, so the stones matter.',
  'Water it and the roots hurry; turn the soil and they start again.'
];

function soil(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  const top = h * (0.09 + v.turn * 0.1 + env.rnd() * 0.06);
  ctx.fillStyle = env.mix(c.bg, c.bg2, 0.25);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = env.mix(c.bg, '#000', 0.35);
  ctx.fillRect(0, 0, w, top);
  // Grit, as flecks.
  for (let i = 0, grit = Math.round(160 * v.density); i < grit; i++) {
    ctx.fillStyle = env.alpha(c.accent, 0.05 + env.rnd() * 0.12);
    ctx.fillRect(env.rnd() * w, top + env.rnd() * (h - top), 1.5, 1.5);
  }
  // Stones.
  const stones = [];
  const count = Math.max(2, Math.round(env.int(4, 9) * v.density));
  for (let i = 0; i < count; i++) {
    const s = { x: env.rnd() * w, y: top + h * 0.1 + env.rnd() * (h - top - h * 0.2), r: (4 + env.rnd() * Math.min(w, h) * 0.06) * v.scale };
    stones.push(s);
    ctx.fillStyle = env.alpha(c.muted, 0.2);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r * 1.3, s.r * 0.8, env.rnd() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roots: random walks down from the surface, deflected by the stones, branching now and then.
  const systems = Math.max(1, Math.round(env.int(2, 4) * v.density));
  ctx.lineCap = 'round';
  for (let s = 0; s < systems; s++) {
    const startX = w * (0.15 + env.rnd() * 0.7);
    const stems = [{ x: startX, y: top, width: 2.2, drift: 0 }];
    let steps = 0;
    while (stems.length && steps < 900) {
      steps++;
      const r = stems[Math.floor(env.rnd() * stems.length)];
      let nx = r.x + (env.rnd() - 0.5) * 4 + r.drift;
      let ny = r.y + 1.5 + env.rnd() * 2.5;
      for (const st of stones) {
        if (Math.hypot(nx - st.x, (ny - st.y) * 1.6) < st.r * 1.3) {
          r.drift = nx < st.x ? -1.4 : 1.4;
          nx = r.x + r.drift * 2;
          ny = r.y + 0.6;
        }
      }
      r.drift *= 0.9;
      ctx.strokeStyle = env.alpha(c.accent2, 0.55 + Math.min(0.4, r.width * 0.15));
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      r.x = nx;
      r.y = ny;
      r.width *= 0.995;
      if (env.rnd() < 0.045 && stems.length < 7 && r.width > 0.7) {
        stems.push({ x: r.x, y: r.y, width: r.width * 0.6, drift: (env.rnd() - 0.5) * 3 });
      }
      if (r.y > h - 4 || r.width < 0.4 || nx < 0 || nx > w) stems.splice(stems.indexOf(r), 1);
    }
    // The shoot above ground.
    ctx.strokeStyle = env.alpha(c.accent2, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, top);
    ctx.lineTo(startX + (env.rnd() - 0.5) * 6, top - 8 - env.rnd() * 10);
    ctx.stroke();
  }
}

export default {
  id: 'loam',
  paint(ctx, w, h, env) {
    soil(ctx, w, h, env);
  },
  spark(env) {
    const a = env.int(6, 16);
    const b = a + env.int(10, 24);
    const stone = b + env.int(1, 9);
    const through = stone + env.int(3, 14);
    return {
      title: 'core sample',
      mono: 'topsoil   0–' + a + ' cm\nloam     ' + a + '–' + b + ' cm\nstones   at ' + stone + ' cm\nroots    found a way at ' + through + ' cm',
      text: env.pick(LINES),
      aspect: '4 / 5',
      paint: soil
    };
  }
};
