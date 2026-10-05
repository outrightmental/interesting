/* The kinetic floor, as a card: a heap of heavy blocks, and the damage report. See js/feed.js for
   what a module is. */

const LINES = [
  'Shove something. Nothing here is fragile.',
  'Flip the gravity and the whole heap thinks again.',
  'Heavy things, a lot of them, nothing breakable.',
  'Kick everything three times without stopping and see what happens.'
];

const STATES = ['all of them idle', 'two still rolling', 'settling', 'one on its edge, deciding', 'in a heap against the wall'];

function floor(ctx, w, h, env, flipped) {
  const c = env.colors;
  const v = env.variant;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const floorY = flipped ? h * 0.1 : h * 0.9;
  ctx.strokeStyle = env.alpha(c.muted, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(w, floorY + 0.5);
  ctx.stroke();
  const piles = Math.max(2, Math.round(env.int(3, 6) * v.density));
  const slot = w / piles;
  for (let p = 0; p < piles; p++) {
    let level = floorY;
    const count = env.int(1, 4);
    for (let i = 0; i < count; i++) {
      const bw = slot * (0.35 + env.rnd() * 0.5);
      const bh = Math.min(h * 0.26, (14 + env.rnd() * h * 0.16) * v.scale);
      const x = p * slot + (slot - bw) * (0.2 + env.rnd() * 0.6);
      const y = flipped ? level : level - bh;
      const tilt = (env.rnd() - 0.5) * 0.08;
      ctx.save();
      ctx.translate(x + bw / 2, y + bh / 2);
      ctx.rotate(tilt);
      ctx.fillStyle = env.alpha(c.accent, 0.22 + env.rnd() * 0.5);
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.strokeStyle = env.alpha(c.fg, 0.35);
      ctx.strokeRect(-bw / 2 + 0.5, -bh / 2 + 0.5, bw - 1, bh - 1);
      ctx.restore();
      level = flipped ? level + bh + 1 : level - bh - 1;
    }
  }
  // One block mid-air, because something was just thrown.
  if (env.chance(0.7)) {
    const bw = slot * 0.4;
    const bh = 12 + env.rnd() * 12;
    ctx.save();
    ctx.translate(w * (0.2 + env.rnd() * 0.6), h * (flipped ? 0.65 : 0.35));
    ctx.rotate(env.rnd() * Math.PI);
    ctx.fillStyle = env.alpha(c.accent2, 0.7);
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }
}

export default {
  id: 'kinetic-floor',
  paint(ctx, w, h, env) {
    floor(ctx, w, h, env, env.chance(0.25));
  },
  spark(env) {
    const flipped = env.chance(0.3);
    const blocks = env.int(7, 24);
    const impacts = env.int(0, 140);
    const fastest = env.int(60, 1400);
    const metres = (impacts * (0.4 + env.rnd() * 1.2)).toFixed(1);
    return {
      title: blocks + ' blocks, ' + (flipped ? 'gravity turned over' : env.pick(STATES)),
      mono: 'impacts: ' + impacts + '\nfastest block: ' + fastest + ' px/s\ntotal distance shoved: ' + metres + ' m',
      text: env.pick(LINES),
      aspect: '16 / 10',
      paint: (ctx, w, h, e) => floor(ctx, w, h, e, flipped)
    };
  }
};
