/* The quiet room: a ring that breathes, a dimmer, and one thing to put down. As a card it is the
   ring (paint, spark); as a piece it is a few breaths at your pace, or one thing set down and
   left down. See js/feed.js for what a module is and js/stage.js for what a piece is. */

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

const PACES = [{ label: 'quick', value: 6 }, { label: 'slow', value: 8 }, { label: 'slower', value: 10 }];

// The room, out to `swell` and dimmed by `dim`. `scale` is how large the ring is drawn: the card's
// own, from the configuration it was dealt, and one for the piece, which is the room itself.
function room(ctx, w, h, env, swell, dim, scale) {
  const c = env.colors;
  const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.7);
  g.addColorStop(0, env.mix(c.bg, c.accent, 0.1));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = Math.min(w, h) * (0.17 + swell * 0.11) * (scale || 1);
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

// A line of small text under the ring, for the thing being put down.
function caption(ctx, w, h, env, text, a) {
  if (!text || a <= 0) return;
  ctx.fillStyle = env.alpha(env.colors.fg, a);
  ctx.font = '500 ' + Math.max(13, Math.round(Math.min(w, h) * 0.045)) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.86);
}

// A few breaths at a pace the visitor sets; the room goes dark when they are done.
function breaths(env) {
  const count = env.int(2, 3);
  const s = { pace: 0, dim: 0.4, phase: 0, done: 0, finished: false, fade: 0 };
  return {
    title: count + ' breaths at your pace',
    brief: 'Set the pace and the light, then follow the ring ' + (count === 2 ? 'twice' : 'three times') + '. The room goes dark on its own when you are done.',
    aspect: '16 / 9',
    steps: [
      { id: 'pace', ask: 'the pace of a breath', kind: 'choice', options: PACES },
      { id: 'dim', ask: 'how low the room is lit', kind: 'range', min: 0, max: 100, step: 1, value: 40, low: 'lit', high: 'dark' },
      { id: 'breathe', ask: 'follow ' + count + ' breaths', kind: 'wait', after: 'pace' }
    ],
    start(c) {
      room(c.g, c.w, c.h, c, 0.5, s.dim * 0.6);
    },
    apply(id, value) {
      if (id === 'pace') s.pace = Number(value) || 8;
      if (id === 'dim') s.dim = Math.max(0, Math.min(1, Number(value) / 100));
    },
    frame(t, dt, c) {
      if (s.pace && !s.finished) {
        s.phase += dt / s.pace;
        if (s.phase >= 1) {
          s.phase -= 1;
          s.done += 1;
          c.status(WORDS[s.done % WORDS.length]);
          if (s.done >= count) {
            s.finished = true;
            c.progress('breathe', 1);
            c.satisfy('breathe');
          }
        }
        if (!s.finished) c.progress('breathe', (s.done + s.phase) / count);
      }
      if (c.done) s.fade = Math.min(1, s.fade + dt * 1.2);
      const swell = s.pace ? (1 - Math.cos(s.phase * Math.PI * 2)) / 2 : 0.5;
      room(c.g, c.w, c.h, c, swell * (1 - s.fade), Math.min(0.96, s.dim * 0.6 + s.fade * 0.9));
    },
    end(c) {
      c.status('the room is dark and the door is shut');
    }
  };
}

// One thing chosen, held for a moment, and let go with a sigh; it stays down.
function putDown(env) {
  const pool = BURDENS.slice();
  const options = [];
  while (options.length < 3) {
    const i = env.int(0, pool.length - 1);
    options.push({ label: pool[i], value: pool[i] });
    pool.splice(i, 1);
  }
  const holdMs = env.pick([1500, 2000, 2500]);
  const s = { chosen: '', held: false, sighed: false, swell: 0.4, release: 0 };
  return {
    title: 'one thing to put down',
    brief: 'Choose what you are carrying, hold it for a moment, and let it go with one long sigh. It stays down.',
    aspect: '16 / 9',
    steps: [
      { id: 'weight', ask: 'what you are carrying', kind: 'choice', options },
      { id: 'hold', ask: 'hold it, then let it go', kind: 'hold', ms: holdMs, label: 'hold it', after: 'weight' },
      { id: 'sigh', ask: 'one long sigh', kind: 'press', count: 1, label: 'sigh', after: 'hold' }
    ],
    start(c) {
      room(c.g, c.w, c.h, c, s.swell, 0.1);
    },
    apply(id, value, c) {
      if (id === 'weight') {
        s.chosen = String(value);
        c.status('held: ' + s.chosen);
      }
      if (id === 'hold') {
        s.held = true;
        c.status('set down');
      }
      if (id === 'sigh') s.sighed = true;
    },
    frame(t, dt, c) {
      const target = s.sighed ? 0 : s.held ? 0.25 : s.chosen ? 0.7 : 0.4;
      s.swell += (target - s.swell) * Math.min(1, dt * 2);
      if (c.done) s.release = Math.min(1, s.release + dt * 0.9);
      room(c.g, c.w, c.h, c, s.swell, 0.1 + s.release * 0.8);
      caption(c.g, c.w, c.h, c, s.chosen, (s.held ? 0.35 : 0.8) * (1 - s.release));
    },
    end(c) {
      c.status(s.chosen + ' — down, and left down');
    }
  };
}

export default {
  id: 'quiet-room',
  paint(ctx, w, h, env) {
    // The breath caught where the configuration caught it, at the size it asks for.
    room(ctx, w, h, env, 0.32 + env.variant.turn * 0.36, 0, env.variant.scale);
  },
  animate(ctx, w, h, env, t) {
    const phase = ((t % 12) / 12 + env.variant.turn) % 1;
    const swell = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    room(ctx, w, h, env, swell, 0, env.variant.scale);
  },
  spark(env) {
    if (env.chance(0.6)) {
      const dim = 0.1 + env.rnd() * 0.35;
      return {
        title: 'one thing to put down',
        quote: env.pick(BURDENS),
        text: 'Set it down here and leave it down. Nothing in the quiet room keeps score.',
        aspect: '5 / 3',
        paint: (ctx, w, h, e) => room(ctx, w, h, e, 0.3, dim, e.variant.scale)
      };
    }
    return {
      title: 'six out, six back',
      quote: env.pick(WORDS),
      text: 'A breath to follow, or not. The ring takes six seconds out and six back, and holds while you hold.'
    };
  },
  piece(env) {
    return env.chance(0.5) ? breaths(env) : putDown(env);
  }
};
