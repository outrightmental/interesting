/* The quiet room, as a card: a ring that breathes, and one thing to put down. See js/feed.js for
   what a module is. */

const BURDENS = [
  'the unread thing', 'the half-finished message', 'the thing you said in 2014',
  'the small debt of attention', 'the opinion you did not need to have',
  'the tab you are keeping open out of guilt', 'the plan that was never yours',
  'the correction nobody asked for', 'the reply you have drafted four times',
  'the list that has become a wall', 'the version of this you were going to be by now',
  'the argument you keep winning in the shower'
];

const WORDS = ['in — hold — out', 'nothing is required of you here', 'the door is shut and the room is lit low',
  'no score, no streak, no next thing', 'held, and then let go'];

function room(ctx, w, h, env, swell, dim) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.7);
  g.addColorStop(0, env.mix(c.bg, c.accent, 0.1));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = Math.min(w, h) * (0.17 + swell * 0.11) * v.scale;
  const glow = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r * 1.6);
  glow.addColorStop(0, env.alpha(c.accent, 0.28 + swell * 0.2));
  glow.addColorStop(0.7, env.alpha(c.accent, 0.06));
  glow.addColorStop(1, env.alpha(c.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = env.alpha(c.accent, 0.45 + swell * 0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  if (dim) {
    ctx.fillStyle = 'rgba(5, 3, 5, ' + dim + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

export default {
  id: 'quiet-room',
  paint(ctx, w, h, env) {
    room(ctx, w, h, env, 0.5, 0);
  },
  animate(ctx, w, h, env, t) {
    const phase = ((t % 12) / 12 + env.variant.turn) % 1;
    const swell = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    room(ctx, w, h, env, swell, 0);
  },
  spark(env) {
    if (env.chance(0.6)) {
      const dim = 0.1 + env.rnd() * 0.35;
      return {
        title: 'one thing to put down',
        quote: env.pick(BURDENS),
        text: 'Set it down here and leave it down. Nothing in the quiet room keeps score.',
        aspect: '5 / 3',
        paint: (ctx, w, h, e) => room(ctx, w, h, e, 0.3, dim)
      };
    }
    return {
      title: 'six out, six back',
      quote: env.pick(WORDS),
      text: 'A breath to follow, or not. The ring takes six seconds out and six back, and holds while you hold.'
    };
  }
};
