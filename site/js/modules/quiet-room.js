/* The quiet room: a ring that breathes, a dimmer, and one thing to put down. As a card it is the
   ring (paint, spark); as a piece it is a few breaths at your pace, one thing set down and
   left down, or a rain-fogged window you clear and settle. See js/feed.js for what a module is
   and js/stage.js for what a piece is. */

const BURDENS = [
  'the unread thing', 'the half-finished message', 'the thing you said in 2014',
  'the small debt of attention', 'the opinion you did not need to have',
  'the tab you are keeping open out of guilt', 'the plan that was never yours',
  'the correction nobody asked for', 'the reply you have drafted four times',
  'the list that has become a wall', 'the version of this you were going to be by now',
  'the argument you keep winning in the shower'
];

const WORDS = ['in - hold - out', 'nothing is required of you here', 'the door is shut and the room is lit low',
  'no score, no streak, no next thing', 'held, and then let go'];

const PACES = [{ label: 'quick', value: 6 }, { label: 'slow', value: 8 }, { label: 'slower', value: 10 }];
const PANES = [
  { label: 'clear glass', value: 'clear' },
  { label: 'rain streaks', value: 'rain' },
  { label: 'fogged glass', value: 'fog' }
];

const KEEPSAKES = [
  'a brass key',
  'a folded note',
  'a smooth stone',
  'a spool of blue thread',
  'a ticket stub',
  'a tiny bell',
  'a dry sprig of rosemary',
  'a snapped pencil',
  'a blank matchbook',
  'a shell with a crack in it',
  'a coin from nowhere',
  'a wooden bead'
];

const LIGHTS = [
  { label: 'lamp low', value: 0.68 },
  { label: 'half light', value: 0.46 },
  { label: 'just enough to see', value: 0.28 }
];

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
      c.status(s.chosen + ' - down, and left down');
    }
  };
}

// A rain-fogged window watched and settled: pick the pane, set the wind, trace the glass, wipe,
// and let the room close around it.
function windowWatch(env) {
  const taps = env.int(2, 4);
  const wipes = env.int(1, 2);
  const s = { pane: 'clear', gust: 0.35, traced: 0, wiped: 0, t: 0, fog: 0.22, release: 0, rings: [] };

  function draw(c) {
    room(c.g, c.w, c.h, c, 0.28 + (c.reduced ? 0 : Math.sin(s.t * 0.8) * 0.05), 0.08 + s.release * 0.78);
    const g = c.g;
    const w = c.w;
    const h = c.h;
    const left = w * 0.16;
    const top = h * 0.18;
    const ww = w * 0.68;
    const hh = h * 0.52;

    g.fillStyle = 'rgba(0, 0, 0, 0.24)';
    g.fillRect(left, top, ww, hh);
    g.strokeStyle = c.alpha(c.colors.fg, 0.44);
    g.lineWidth = 2;
    g.strokeRect(left, top, ww, hh);

    const rain = s.pane === 'rain' ? 22 : s.pane === 'fog' ? 14 : 8;
    const drift = (0.2 + s.gust * 0.8) * (c.reduced ? 0.2 : 1);
    for (let i = 0; i < rain; i++) {
      const x = left + (((i * 0.6180339 + s.t * drift * (0.12 + (i % 3) * 0.05)) % 1) * ww);
      const y = top + (((i * 0.241 + s.t * (0.28 + s.gust * 0.42)) % 1) * hh);
      const len = hh * (0.03 + (i % 5) * 0.01);
      g.strokeStyle = c.alpha(c.colors.accent2, 0.16 + (i % 4) * 0.07);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 2 - s.gust * 8, y + len);
      g.stroke();
    }

    const fog = Math.max(0, Math.min(1, s.fog));
    if (s.pane === 'fog' || fog > 0) {
      g.fillStyle = 'rgba(220, 236, 255, ' + (0.08 + fog * 0.26) + ')';
      g.fillRect(left, top, ww, hh);
    }

    for (let i = s.rings.length - 1; i >= 0; i--) {
      const r = s.rings[i];
      r.a -= 0.03;
      if (r.a <= 0) {
        s.rings.splice(i, 1);
        continue;
      }
      g.strokeStyle = c.alpha(c.colors.accent2, r.a * 0.8);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(r.x, r.y, 5 + (1 - r.a) * 26, 0, Math.PI * 2);
      g.stroke();
    }

    if (s.release > 0) {
      caption(g, w, h, c, 'the pane clears, and the room settles', s.release * 0.9);
    }
  }

  return {
    title: 'the window watch',
    brief: 'Pick the pane and the wind, trace the glass ' + (taps === 1 ? 'once' : taps + ' times') + ', wipe it ' + (wipes === 1 ? 'once' : 'twice') + ', and let the room settle around what clears.',
    aspect: '16 / 9',
    steps: [
      { id: 'pane', ask: 'the pane', kind: 'choice', options: PANES },
      { id: 'wind', ask: 'the wind at the frame', kind: 'range', min: 0, max: 100, step: 1, value: 35, low: 'still', high: 'gusting' },
      { id: 'trace', ask: 'trace the glass ' + (taps === 1 ? 'once' : taps + ' times'), kind: 'tap', label: 'trace one for me', after: 'pane' },
      { id: 'wipe', ask: 'wipe it ' + (wipes === 1 ? 'once' : 'twice'), kind: 'press', count: wipes, label: 'wipe', after: 'trace' }
    ],
    start(c) {
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'pane') {
        s.pane = String(value);
        if (s.pane === 'clear') {
          s.fog = 0.05;
          c.status('clear pane: almost nothing between you and the night');
        } else if (s.pane === 'rain') {
          s.fog = 0.14;
          c.status('rain streaks: the room answers in lines');
        } else {
          s.fog = 0.34;
          c.status('fogged glass: draw a path through it');
        }
      }
      if (id === 'wind') {
        s.gust = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(s.gust < 0.25 ? 'still frame, slow drips' : s.gust < 0.65 ? 'a small draught along the pane' : 'the frame hums with gusts');
      }
      if (id === 'wipe') {
        s.wiped = Number(value) || s.wiped + 1;
        s.fog = Math.max(0, s.fog - 0.18);
        c.status(s.wiped >= wipes ? 'wiped clean enough' : 'wiped once; a little more');
      }
    },
    tap(x, y, c) {
      if (c.done) return;
      s.traced += 1;
      s.rings.push({ x: x * c.w, y: y * c.h, a: 1 });
      s.fog = Math.max(0, s.fog - 0.08);
      c.progress('trace', Math.min(1, s.traced / taps));
      c.status(s.traced >= taps ? 'enough traced; you can wipe and settle it' : (taps - s.traced) + ' more to trace');
      if (s.traced >= taps) c.satisfy('trace');
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) s.release = Math.min(1, s.release + dt * 1.1);
      draw(c);
    },
    end(c) {
      c.status('the pane is settled, and the room is quiet again');
    }
  };
}

// Three keepsakes set onto a shelf, latched, and left to settle.
function shelfRitual(env) {
  const pool = KEEPSAKES.slice();
  const picks = [];
  while (picks.length < 4) {
    const i = env.int(0, pool.length - 1);
    picks.push(pool[i]);
    pool.splice(i, 1);
  }
  const keep = env.int(2, 3);
  const holdMs = env.pick([1400, 1800, 2200]);
  const settleFor = env.pick([3.5, 4.5, 5.5]);
  const s = {
    dim: 0.52,
    t: 0,
    slots: [{ x: 0.24, item: null }, { x: 0.5, item: null }, { x: 0.76, item: null }],
    queue: picks.slice(),
    latched: false,
    settled: 0,
    release: 0,
    glow: 0,
    lightWord: 'lamp low'
  };

  function listPlaced() {
    return s.slots.filter((q) => q.item).map((q) => q.item);
  }

  function nextSlot(px) {
    const open = s.slots.filter((q) => !q.item);
    if (!open.length) return null;
    let best = open[0];
    let bd = Math.abs(open[0].x - px);
    for (const q of open) {
      const d = Math.abs(q.x - px);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  function draw(c) {
    room(c.g, c.w, c.h, c, 0.2 + Math.sin(s.t * 0.6) * 0.03, s.dim + s.release * 0.35);
    const g = c.g;
    const w = c.w;
    const h = c.h;
    const shelfY = h * 0.62;
    const shelfH = h * 0.12;

    g.fillStyle = c.alpha(c.colors.bg2, 0.55);
    g.fillRect(w * 0.14, shelfY - shelfH * 0.65, w * 0.72, shelfH * 0.58);
    g.fillStyle = c.alpha(c.colors.muted, 0.34);
    g.fillRect(w * 0.14, shelfY, w * 0.72, shelfH * 0.1);

    for (let i = 0; i < s.slots.length; i++) {
      const slot = s.slots[i];
      const x = w * slot.x;
      const y = shelfY - shelfH * 0.22;
      g.strokeStyle = c.alpha(c.colors.accent, 0.22);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y + shelfH * 0.06, Math.min(w, h) * 0.03, 0, Math.PI * 2);
      g.stroke();

      if (!slot.item) continue;
      const lit = 0.35 + s.glow * 0.45;
      g.fillStyle = c.alpha(c.colors.accent2, lit * 0.16);
      g.beginPath();
      g.ellipse(x, y - shelfH * 0.05, Math.min(w, h) * 0.055, Math.min(w, h) * 0.03, 0, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = c.alpha(c.colors.fg, 0.92);
      g.font = '500 ' + Math.max(11, Math.round(Math.min(w, h) * 0.03)) + 'px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(slot.item, x, y - shelfH * 0.1);
    }

    const latchX = w * 0.86;
    const latchY = shelfY - shelfH * 0.27;
    g.strokeStyle = c.alpha(c.colors.accent2, 0.7 + s.glow * 0.2);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(latchX - 16, latchY);
    g.lineTo(latchX + (s.latched ? 9 : 2), latchY);
    g.stroke();
    g.beginPath();
    g.arc(latchX + 11, latchY, 5.5, 0, Math.PI * 2);
    g.stroke();

    if (s.settled > 0) {
      g.fillStyle = c.alpha(c.colors.fg, Math.min(0.9, s.settled));
      g.font = '500 ' + Math.max(12, Math.round(Math.min(w, h) * 0.042)) + 'px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('kept, then left still', w / 2, h * 0.85);
    }
  }

  return {
    title: 'the shelf ritual',
    brief: 'Set the lamp, tap the shelf to place ' + (keep === 2 ? 'two keepsakes' : 'three keepsakes') + ', hold to latch it, then let the room settle around what stays.',
    aspect: '16 / 9',
    steps: [
      { id: 'light', ask: 'the lamp', kind: 'choice', options: LIGHTS },
      { id: 'place', ask: 'tap the shelf to place ' + (keep === 2 ? 'two keepsakes' : 'three keepsakes'), kind: 'tap', label: 'place one for me', after: 'light' },
      { id: 'latch', ask: 'latch the shelf', kind: 'hold', ms: holdMs, label: 'hold to latch', after: 'place' },
      { id: 'settle', ask: 'let the room settle', kind: 'wait', after: 'latch' }
    ],
    start(c) {
      draw(c);
      c.status('the shelf is empty');
    },
    apply(id, value, c) {
      if (id === 'light') {
        s.dim = Math.max(0.2, Math.min(0.85, Number(value) || 0.52));
        const match = LIGHTS.find((x) => x.value === Number(value));
        s.lightWord = match ? match.label : 'lamp low';
        c.status(s.lightWord);
      }
      if (id === 'latch') {
        s.latched = true;
        s.glow = 1;
        c.status('latched. now leave it still.');
      }
    },
    tap(x, y, c) {
      if (c.done || s.latched) return;
      const slot = nextSlot(x);
      if (!slot || !s.queue.length) return;
      slot.item = s.queue.shift();
      s.glow = 1;
      const placed = listPlaced();
      c.progress('place', Math.min(1, placed.length / keep));
      c.status('placed: ' + slot.item);
      if (placed.length >= keep) c.satisfy('place');
    },
    frame(t, dt, c) {
      s.t += dt;
      s.glow = Math.max(0, s.glow - dt * 1.6);
      if (s.latched && !c.done) {
        s.settled = Math.min(settleFor, s.settled + dt);
        c.progress('settle', Math.min(1, s.settled / settleFor));
        if (s.settled >= settleFor) c.satisfy('settle');
      }
      if (c.done) s.release = Math.min(1, s.release + dt * 0.9);
      draw(c);
    },
    end(c) {
      const placed = listPlaced();
      c.status((placed.length ? placed.join(' - ') : 'nothing') + ' kept, latched, and left still');
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
    const roll = env.rnd();
    if (roll < 0.27) return breaths(env);
    if (roll < 0.54) return putDown(env);
    if (roll < 0.78) return windowWatch(env);
    return shelfRitual(env);
  }
};