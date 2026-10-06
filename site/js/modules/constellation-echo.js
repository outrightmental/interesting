/* The echo chamber: the persona's stars as drifting echoes. As a card it is the field and an
   echo weather bulletin (paint, spark); as a piece it is a chamber to pulse, echoes to hear one
   thought at a time, harmonics to shuffle, or one echo to ring, with the bulletin printing over
   the field at the end. See js/feed.js for what a module is and js/stage.js for what a piece is. */

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

const LOOKS = [
  { label: 'midnight tones', value: 'midnight' },
  { label: 'prism', value: 'prism' },
  { label: 'glass', value: 'glass' },
  { label: 'low hum', value: 'hum' }
];
const LOOK_WORDS = {
  midnight: 'midnight tones: the chamber as it usually sounds',
  prism: 'prism: the echoes refract, and the colours will not sit still',
  glass: 'glass: thin rings and clear tones',
  hum: 'low hum: the echoes sink back into the walls'
};
const PULSE_WORDS = [
  'centre pulse released; the echoes scatter and come back',
  'another pulse; the chamber rings',
  'the field is loud now, and the echoes are returning'
];
const SHUFFLE_WORDS = [
  'harmonics reshuffled: same stars, new behaviour',
  'reshuffled again; the field is louder',
  'once more; nothing is lost, only rearranged',
  'the chamber has lost count'
];

const PAD = 16;

function summarize(stars) {
  let cx = 0;
  let cy = 0;
  for (const s of stars) {
    cx += s.x;
    cy += s.y;
  }
  cx /= stars.length || 1;
  cy /= stars.length || 1;
  let spread = 0;
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy);
  spread /= stars.length || 1;
  return {
    zone: (cy < 50 ? 'north' : 'south') + '-' + (cx < 50 ? 'west' : 'east'),
    spread: spread < 12 ? 'compact' : spread < 24 ? 'balanced' : 'wide',
    density: stars.length < 5 ? 'quiet' : stars.length < 14 ? 'steady' : 'crowded'
  };
}

// The field: one echo per star in 0..1 coordinates, with a home it drifts around and returns to,
// a velocity pulses push on, and a tone that rises with the star (the old chamber's 180 to 660 hz).
function field(stars) {
  return stars.map((s, i) => ({
    hx: s.x / 100, hy: s.y / 100, x: s.x / 100, y: s.y / 100, vx: 0, vy: 0,
    phase: i * 1.7, energy: 0, size: 1 + (i % 4) * 0.35,
    tone: Math.round(180 + ((100 - s.y) / 100) * 480), text: s.text || '', heard: false
  }));
}

function at(p, w, h) {
  return { x: PAD + p.x * (w - PAD * 2), y: PAD + p.y * (h - PAD * 2) };
}

// A pulse from (x, y): a ring that spreads, and a push on every echo, strongest nearby.
function pulse(F, P, x, y, strength) {
  P.push({ x, y, r: 0, life: 1 });
  for (const e of F) {
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy) || 0.01;
    const push = Math.max(0.01, Math.min(0.1, 0.003 / d)) * strength;
    e.vx += (dx / d) * push;
    e.vy += (dy / d) * push;
    e.energy = Math.min(1.4, e.energy + 0.9 / (d * 6 + 1));
  }
}

function nearest(F, x, y, unheardOnly) {
  let best = -1;
  let bestD = Infinity;
  F.forEach((e, i) => {
    const d = Math.hypot(e.x - x, e.y - y);
    if ((!unheardOnly || !e.heard) && d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return { i: best, d: bestD };
}

// One tick: the echoes wander as far as `drift` lets them, the pulses' pushes wear off, and a
// weak spring brings each echo back to its star; with `home` the spring is strong and the
// constellation re-forms.
function step(F, P, dt, drift, speed, home) {
  F.forEach((e, i) => {
    e.phase += dt * (0.6 + (i % 5) * 0.16);
    const k = home ? 7 : 0.6;
    const damp = home ? 4 : 0.5;
    e.vx += ((e.hx - e.x) * k - e.vx * damp) * dt;
    e.vy += ((e.hy - e.y) * k - e.vy * damp) * dt;
    e.x += (e.vx + Math.cos(e.phase) * 0.06 * drift) * dt;
    e.y += (e.vy + Math.sin(e.phase * 0.85) * 0.05 * drift) * dt;
    if (e.x < 0.02 || e.x > 0.98) e.vx *= -1;
    if (e.y < 0.02 || e.y > 0.98) e.vy *= -1;
    e.x = Math.max(0.02, Math.min(0.98, e.x));
    e.y = Math.max(0.02, Math.min(0.98, e.y));
    e.energy = Math.max(0, e.energy - dt * 0.8);
  });
  for (let i = P.length - 1; i >= 0; i--) {
    P[i].r += dt * speed;
    P[i].life -= dt * 0.72;
    if (P[i].life <= 0) P.splice(i, 1);
  }
}

function toneLook(hz) {
  return hz < 300 ? 'hum' : hz < 500 ? 'midnight' : 'glass';
}

function tint(c, look, i, t) {
  const col = c.colors;
  if (look === 'prism') return c.mix(col.accent, col.accent2, (Math.sin(i * 0.9 + t * 1.3) + 1) / 2);
  if (look === 'glass') return c.mix(col.accent, col.fg, 0.5);
  if (look === 'hum') return c.mix(col.accent, col.bg2, 0.35);
  return col.accent;
}

function word(g, m, c, text, x, y, a, size) {
  if (!text || a <= 0) return;
  g.fillStyle = c.alpha(c.colors.fg, a);
  g.font = '500 ' + Math.max(11, Math.round(m * size)) + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// One thought said beside its echo: wrapped to a readable width and kept inside the chamber,
// above the echo when it sits low and below it when it sits high.
function thought(g, w, h, c, text, p, a) {
  if (!text || a <= 0) return;
  const m = Math.min(w, h);
  const size = Math.max(11, Math.round(m * 0.034));
  const lead = size * 1.3;
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  const lines = wrap(g, text, Math.min(w - 16, m * 0.62));
  let width = 0;
  for (const l of lines) width = Math.max(width, g.measureText(l).width);
  const x = Math.max(8 + width / 2, Math.min(w - 8 - width / 2, p.x));
  const block = (lines.length - 1) * lead;
  let y = p.y > h * 0.5 ? p.y - m * 0.05 - block : p.y + m * 0.05;
  y = Math.max(8 + size / 2, Math.min(h - 8 - size / 2 - block, y));
  for (const l of lines) {
    word(g, m, c, l, x, y, a, 0.034);
    y += lead;
  }
}

function wrap(g, text, width) {
  const lines = [];
  let line = '';
  for (const t of String(text).split(' ')) {
    const next = line ? line + ' ' + t : t;
    if (line && g.measureText(next).width > width) {
      lines.push(line);
      line = t;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// The whole scene: the chamber and its specks, the links between near echoes, the echoes with
// their rings, the pulses, one thought said beside its echo and, once the field has been read,
// the bulletin printing over it.
function scene(g, w, h, c, F, P, look, t, s) {
  const col = c.colors;
  const m = Math.min(w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.alpha(col.muted, 0.14);
  const slide = c.reduced ? 0 : t;
  for (let i = 0; i < 36; i++) g.fillRect((i * 127.3 + slide * 6) % w, (i * 79.7 + slide * 3) % h, 1.2, 1.2);
  const pts = F.map((e) => at(e, w, h));
  const maxD = m * 0.3;
  const link = 1 + (s ? (s.print + s.read) * 1.3 : 0);
  g.lineWidth = 1;
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const d = Math.hypot(pts[b].x - pts[a].x, pts[b].y - pts[a].y);
      if (d > maxD) continue;
      g.strokeStyle = c.alpha(col.accent, Math.min(0.9, (0.08 + (1 - d / maxD) * 0.35) * link));
      g.beginPath();
      g.moveTo(pts[a].x, pts[a].y);
      g.lineTo(pts[b].x, pts[b].y);
      g.stroke();
    }
  }
  const rings = look === 'glass' ? 1 : look === 'prism' ? 4 : look === 'hum' ? 2 : 3;
  pts.forEach((p, i) => {
    const e = F[i];
    const beat = 0.6 + Math.sin(t * 2 + e.phase) * 0.3;
    const hue = tint(c, look, i, t);
    const base = m * 0.007 * e.size;
    g.fillStyle = c.alpha(hue, 0.12 + e.energy * 0.26);
    g.beginPath();
    g.arc(p.x, p.y, base * (2.4 + beat + e.energy * 2.8), 0, Math.PI * 2);
    g.fill();
    for (let r = 1; r <= rings; r++) {
      g.strokeStyle = c.alpha(hue, (0.3 - r * 0.06) * beat);
      g.beginPath();
      g.arc(p.x, p.y, base + r * base * 2.2 * (beat + e.energy), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = c.alpha(e.energy > 0.18 ? col.accent2 : col.fg, 0.95);
    g.beginPath();
    g.arc(p.x, p.y, base * 0.9 + e.energy * 1.5, 0, Math.PI * 2);
    g.fill();
  });
  g.lineWidth = 1.4;
  for (const p of P) {
    const q = at(p, w, h);
    g.strokeStyle = c.alpha(col.accent2, p.life * 0.5);
    g.beginPath();
    g.arc(q.x, q.y, p.r * m, 0, Math.PI * 2);
    g.stroke();
  }
  if (!s) return;
  if (s.said && s.said.life > 0) thought(g, w, h, c, F[s.said.i].text, pts[s.said.i], Math.min(0.9, s.said.life) * (1 - s.print));
  if (s.print > 0) {
    g.fillStyle = c.alpha(col.bg, 0.6 * s.print);
    g.fillRect(0, 0, w, h);
    const size = Math.max(11, Math.round(m * 0.042));
    const rows = [];
    s.lines.forEach((line, i) => {
      g.font = '500 ' + Math.max(11, Math.round(m * (i === 0 ? 0.052 : 0.042))) + 'px system-ui, sans-serif';
      wrap(g, line, w * 0.84).forEach((r) => rows.push({ text: r, head: i === 0 }));
    });
    let y = h / 2 - ((rows.length - 1) * size * 1.5) / 2;
    rows.forEach((r, i) => {
      word(g, m, c, r.text, w / 2, y, Math.max(0, Math.min(1, s.print * (rows.length + 1) - i)), r.head ? 0.052 : 0.042);
      y += size * 1.5;
    });
  }
}

// The card's field: the echoes drifting on the spot -- as many of them, and as far out from the
// middle of the chamber, as the configuration the card was dealt asks for.
function echoes(ctx, w, h, env, t) {
  const v = env.variant;
  const F = field(env.stars).slice(0, Math.max(1, Math.round(env.stars.length * v.density)));
  F.forEach((e, i) => {
    e.x = 0.5 + (e.x - 0.5) * v.scale + Math.sin(t * 0.5 + i * 1.7) * 0.012;
    e.y = 0.5 + (e.y - 0.5) * v.scale + Math.cos(t * 0.4 + i * 2.3) * 0.012;
    e.size *= v.scale;
  });
  scene(ctx, w, h, env, F, [], 'midnight', t, null);
}

// What every shape of piece shares: the field, its pulses, the bulletin to print, the frame, and
// a tap that pulses the field and hears the nearest echo.
function chamber(env) {
  const stars = env.stars;
  const wx = summarize(stars);
  const F = field(stars);
  const P = [];
  const s = {
    drift: 0.4, look: 'midnight', paused: false, speed: 0.45, print: 0, read: 0, said: null, home: false, t: 0,
    lines: [env.pick(OPENERS).replace(':', ''), (stars.length === 1 ? 'one echo, ' : stars.length + ' echoes, ') + wx.spread + ' spread', 'chamber ' + wx.zone + ', tone ' + wx.density, env.pick(MIDS), env.pick(CLOSERS)]
  };
  return {
    F, P, s, wx,
    run(t, dt, c) {
      s.t += dt;
      step(F, P, dt, s.paused ? 0 : s.drift * (c.reduced ? 0.4 : 1), s.speed, s.home);
      if (s.home) s.print = Math.min(1, s.print + dt * 1.4);
      s.read = Math.max(0, s.read - dt * 0.7);
      if (s.said) s.said.life -= dt;
      scene(c.g, c.w, c.h, c, F, P, s.look, s.t, s);
    },
    hear(x, y, unheardFirst) {
      pulse(F, P, x, y, 0.8);
      let near = unheardFirst ? nearest(F, x, y, true) : { i: -1 };
      if (near.i < 0) near = nearest(F, x, y, false);
      const e = F[near.i];
      const fresh = !e.heard;
      e.heard = true;
      e.energy = 1.2;
      s.said = { i: near.i, life: 3 };
      return { i: near.i, e, fresh, far: near.d > 0.14 };
    },
    end(c) {
      s.home = true;
      c.status(s.lines[s.lines.length - 1]);
    }
  };
}

// Hear the echoes: set the drift, tap close to each echo for its thought, pulse the centre, and
// hold to read the weather.
function listen(env) {
  const ch = chamber(env);
  const s = ch.s;
  const n = env.stars.length;
  const need = Math.min(n, env.int(3, 5));
  const presses = env.int(2, 3);
  const holdMs = env.pick([1500, 2000, 2500]);
  const from = env.pick([25, 45, 65]);
  const earsFirst = env.chance(0.5);
  s.drift = from / 100;
  let heard = 0;
  return {
    title: earsFirst ? (need === n ? 'every echo, ears first' : need + ' echoes, ears first') : (need === n ? 'hear every echo' : 'hear ' + need + ' echoes'),
    brief: 'Set how far the echoes wander, tap the field close to ' + (need === n ? 'each one to hear its thought' : need + ' of them to hear their thoughts') + ', pulse the chamber from the centre, and hold to read the echo weather; the bulletin prints when you are done.',
    aspect: '1 / 1',
    steps: [
      { id: 'drift', ask: 'how far the echoes wander', kind: 'range', min: 0, max: 100, step: 1, value: from, low: 'hovering', high: 'restless' },
      { id: 'listen', ask: 'tap the field close to ' + need + ' echoes', kind: 'tap', label: 'hear one for me' },
      { id: 'pulse', ask: 'pulse the chamber from the centre', kind: 'press', count: presses, label: 'pulse' },
      { id: 'weather', ask: 'hold to read the echo weather', kind: 'hold', ms: holdMs, label: 'hold to read', after: 'listen' }
    ],
    start(c) {
      ch.run(0, 0, c);
    },
    apply(id, value, c) {
      if (id === 'drift') {
        s.drift = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(s.drift < 0.15 ? 'the echoes hover in place' : s.drift < 0.6 ? 'the echoes wander' : 'the echoes are restless');
      }
      if (id === 'pulse') {
        pulse(ch.F, ch.P, 0.5, 0.5, 1.2);
        c.status(PULSE_WORDS[Math.min(PULSE_WORDS.length, Number(value) || 1) - 1]);
      }
      if (id === 'weather') {
        s.read = 1;
        c.status('reading the field');
      }
    },
    tap(x, y, c) {
      const got = ch.hear(x, y, true);
      if (got.fresh) heard += 1;
      c.progress('listen', Math.min(1, heard / need));
      c.status((got.far ? 'pulse into open space; the nearest echo answers: ' : '') + got.e.text + ' (' + got.e.tone + ' hz)');
      if (heard >= need) c.satisfy('listen');
    },
    frame: ch.run,
    end: ch.end
  };
}

// Shuffle the harmonics: choose how the chamber sounds, pause or free the drift, shuffle the
// field a few times and let it settle; the weather prints when it is still.
function shuffle(env) {
  const ch = chamber(env);
  const s = ch.s;
  const pool = LOOKS.slice();
  const options = [];
  while (options.length < 3) options.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  const count = env.int(2, 4);
  const settleFor = env.pick([4, 5, 6]);
  const times = count === 2 ? 'twice' : count + ' times';
  const title = env.pick(['shuffle the harmonics', 'same stars, new resonance', count + ' shuffles and a reading']);
  let shuffled = 0;
  let since = -1;
  let told = 0;
  return {
    title,
    brief: 'Choose the harmonics, pause or free the drift, shuffle the field ' + times + ' and let it settle; the echo weather prints once it is still.',
    aspect: '1 / 1',
    steps: [
      { id: 'harmonics', ask: 'the harmonics', kind: 'choice', options },
      { id: 'drift', ask: 'hold the echoes still, or let them wander', kind: 'toggle', label: 'pause drift' },
      { id: 'shuffle', ask: 'shuffle the harmonics ' + times, kind: 'press', count, label: 'shuffle', after: 'harmonics' },
      { id: 'settle', ask: 'let the field settle', kind: 'wait', after: 'shuffle' }
    ],
    start(c) {
      ch.run(0, 0, c);
    },
    apply(id, value, c) {
      if (id === 'harmonics') {
        s.look = String(value);
        pulse(ch.F, ch.P, 0.5, 0.5, 0.3);
        c.status(LOOK_WORDS[s.look] || s.look);
      }
      if (id === 'drift') {
        s.paused = !!value;
        c.status(s.paused ? 'drift paused; the echoes hover in place' : 'drift resumed; the echoes wander again');
      }
      if (id === 'shuffle') {
        shuffled = Number(value) || shuffled + 1;
        for (const e of ch.F) {
          e.vx = (c.rnd() - 0.5) * 0.3;
          e.vy = (c.rnd() - 0.5) * 0.25;
          e.phase = c.rnd() * Math.PI * 2;
          e.energy = Math.min(1.4, e.energy + 0.45);
        }
        pulse(ch.F, ch.P, 0.2 + c.rnd() * 0.6, 0.2 + c.rnd() * 0.6, 0.6);
        since = 0;
        told = 0;
        c.status(SHUFFLE_WORDS[Math.min(SHUFFLE_WORDS.length, shuffled) - 1]);
      }
    },
    tap(x, y, c) {
      const got = ch.hear(x, y, false);
      c.status(got.e.text + ' (' + got.e.tone + ' hz)');
    },
    frame(t, dt, c) {
      ch.run(t, dt, c);
      if (c.done || since < 0 || shuffled < count) return;
      since += dt;
      const f = Math.min(1, since / settleFor);
      c.progress('settle', f);
      if (f > 0.4 && told < 1) {
        told = 1;
        c.status('the field is settling');
      }
      if (f > 0.8 && told < 2) {
        told = 2;
        c.status('nearly still');
      }
      if (f >= 1) c.satisfy('settle');
    },
    end: ch.end
  };
}

// Ring one echo: tap the one you want to hear, set its tone, and ring it; its thought prints.
function ring(env) {
  const ch = chamber(env);
  const s = ch.s;
  const count = env.int(3, 5);
  const tone = env.pick([240, 360, 480]);
  const title = env.pick(['one echo, rung', 'ring one thought', 'one of them, ' + count + ' times']);
  let chosen = -1;
  let rung = 0;
  s.speed = 0.25 + (tone / 700) * 0.5;
  s.look = toneLook(tone);
  return {
    title,
    brief: 'Tap the echo you want to hear, set its tone, and ring it ' + count + ' times; its thought prints when the chamber is still again.',
    aspect: '1 / 1',
    steps: [
      { id: 'pick', ask: 'tap the echo you want to hear', kind: 'tap', label: 'pick one for me' },
      { id: 'tone', ask: 'its tone', kind: 'range', min: 160, max: 700, step: 10, value: tone, low: 'low', high: 'high' },
      { id: 'ring', ask: 'ring it ' + count + ' times', kind: 'press', count, label: 'ring', after: 'pick' }
    ],
    start(c) {
      ch.run(0, 0, c);
    },
    apply(id, value, c) {
      if (id === 'tone') {
        const hz = Math.round(Number(value) / 10) * 10 || tone;
        s.speed = 0.25 + (hz / 700) * 0.5;
        s.look = toneLook(hz);
        c.status(hz + ' hz: ' + (hz < 300 ? 'a low hum' : hz < 500 ? 'a middle tone' : 'glassy and quick'));
      }
      if (id === 'ring') {
        rung = Number(value) || rung + 1;
        const e = ch.F[Math.max(0, chosen)];
        pulse(ch.F, ch.P, e.x, e.y, 1.4);
        e.energy = 1.4;
        c.status(rung >= count ? e.text + ', rung ' + count + ' times' : rung === 1 ? e.text + ' rings; the others scatter' : rung === 2 ? 'rung again; the chamber knows the tune now' : 'and again; ' + e.text + ' is the loudest thing in here');
      }
    },
    tap(x, y, c) {
      const got = ch.hear(x, y, false);
      chosen = got.i;
      s.said.life = 4;
      s.lines = [got.e.text, 'an echo at ' + got.e.tone + ' hz, chamber ' + ch.wx.zone, 'The thought stays said.', s.lines[4]];
      c.progress('pick', 1);
      c.status((got.far ? 'from open space, the nearest echo answers: ' : 'chosen: ') + got.e.text);
      c.satisfy('pick');
    },
    frame: ch.run,
    end(c) {
      s.home = true;
      c.status(chosen < 0 ? s.lines[4] : ch.F[chosen].text + ' — said, and left said');
    }
  };
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
    const wx = summarize(stars);
    return {
      title: env.pick(OPENERS).replace(':', ''),
      mono: stars.length + ' echoes, ' + wx.spread + ' spread\nchamber ' + wx.zone + ', tone ' + wx.density,
      text: env.pick(MIDS) + ' ' + env.pick(CLOSERS),
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => echoes(ctx, w, h, e, e.rnd() * 10)
    };
  },
  piece(env) {
    if (!env.stars || !env.stars.length) return null;
    return env.chance(0.4) ? listen(env) : env.chance(0.58) ? shuffle(env) : ring(env);
  }
};
