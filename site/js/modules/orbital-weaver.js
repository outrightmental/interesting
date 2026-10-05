/* The orbital weaver: the persona's stars mirrored into a slow mandala. As a card it is the
   weave, with a mantra woven from what the stars say (paint, spark); as a piece it is the loom
   itself: a symmetry dial, a spin, a weave to ripple by touch, and a geometry mantra that prints
   when the pattern closes. See js/feed.js for what a module is and js/stage.js for what a piece
   is. */

const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

const OPENERS = ['orbital mantra:', 'weave transmission:', 'midnight geometry note:', 'mandala field memo:'];
const LINES = [
  'start small; repetition turns sparks into structure.',
  'play first, refine second, repeat until it sings.',
  'momentum likes imperfect beginnings more than hesitation.',
  'a tiny brave move reshapes the whole pattern.',
  'commit to one clear action before the weave stops.',
  'turn the symmetry dial one notch and read the weave again.',
  'share one rough idea while it is still warm.',
  'protect ten focused minutes and build inside them.'
];

const SPINS = [
  { label: 'hovering', value: 0 },
  { label: 'slow', value: 0.24 },
  { label: 'quick', value: 0.7 },
  { label: 'widdershins', value: -0.35 }
];

const TONES = [
  { label: 'midnight tones', value: 'midnight' },
  { label: 'prism weave', value: 'prism' },
  { label: 'candlelight', value: 'candle' }
];
const TONE_WORDS = {
  midnight: 'back to midnight tones',
  prism: 'prism weave on: spectrum shifted',
  candle: 'candlelight: the threads go warm'
};

function spinWord(v) {
  if (!v) return 'spin paused: geometry is hovering';
  if (v < 0) return 'the weave turns against the clock';
  return v > 0.5 ? 'the weave is in a hurry' : 'spin resumed: the weave is in motion';
}

// A few of the stars' words, for a mantra.
function words(env, k) {
  const pool = env.stars.slice();
  const out = [];
  while (out.length < Math.min(k, pool.length)) {
    const i = Math.floor(env.rnd() * pool.length);
    out.push(pool.splice(i, 1)[0].text);
  }
  return out;
}

// The sky's geometry in the loom's terms: where its centre sits, how far it spreads, how bright.
function geometry(stars) {
  const n = stars.length || 1;
  let cx = 0;
  let cy = 0;
  for (const s of stars) {
    cx += s.x;
    cy += s.y;
  }
  cx /= n;
  cy /= n;
  let spread = 0;
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy);
  spread /= n;
  const zone = (cy < 50 ? 'north' : 'south') + '-' + (cx < 50 ? 'west' : 'east');
  const width = spread < 12 ? 'compact' : spread < 24 ? 'balanced' : 'expansive';
  const tone = stars.length < 6 ? 'quiet' : stars.length < 16 ? 'steady' : 'bright';
  return stars.length + ' shard' + (stars.length === 1 ? '' : 's') + ' · ' + width + ' spread · ' + zone + ' chamber · ' + tone + ' tone';
}

/* ---- the card ------------------------------------------------------------------------------ */

function weave(ctx, w, h, env, spokes, t) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.46 * v.scale;
  const pts = env.stars.map((s) => ({ r: (Math.hypot(s.x - 50, s.y - 50) / 70) * R, a: Math.atan2(s.y - 50, s.x - 50) }));
  pts.sort((p, q) => p.a - q.a);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  for (let k = 0; k < spokes; k++) {
    const rot = (k / spokes) * Math.PI * 2 + t * 0.08 + v.turn * Math.PI * 2;
    for (const mirror of [1, -1]) {
      ctx.strokeStyle = env.alpha(k % 2 ? c.accent : c.accent2, 0.5);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const a = rot + p.a * mirror;
        const x = cx + Math.cos(a) * p.r;
        const y = cy + Math.sin(a) * p.r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      for (const p of pts) {
        const a = rot + p.a * mirror;
        ctx.fillStyle = env.alpha(c.fg, 0.85);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * p.r, cy + Math.sin(a) * p.r, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = env.alpha(c.accent, 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---- the loom ------------------------------------------------------------------------------ */

// The loom: each star a shard in polar form about the centre, with a phase of its own, and
// everything a piece turns: the spokes, the spin, the tones, how far the pattern has closed.
function loom(env, spokes) {
  const stars = env.stars.slice(0, 90);
  return {
    stars,
    spokes,
    t: 0,
    rot: 0,
    spin: 0,
    tone: 'midnight',
    close: 0,
    ripples: [],
    mantra: null,
    said: 0,
    shards: stars.map((st, i) => ({
      r: Math.max(0.08, Math.min(1, Math.hypot(st.x - 50, st.y - 50) / 70)),
      a: Math.atan2(st.y - 50, st.x - 50),
      size: 1.6 + (i % 4) * 0.7,
      phase: env.rnd() * Math.PI * 2,
      energy: 0
    })),
    words: words(env, 3),
    opener: env.pick(OPENERS),
    line: env.pick(LINES),
    geo: geometry(stars)
  };
}

// Where the weave sits: it shrinks and rises as the pattern closes, to leave room for the mantra.
function frameOf(s, w, h) {
  const m = Math.min(w, h);
  return { cx: w / 2, cy: h * (0.5 - 0.14 * s.close), R: m * (0.42 - 0.14 * s.close), k: m / 340 };
}

// One shard's place on one arm of the weave, pulsing while the pattern is open and pulled
// onto a common ring as it closes.
function place(s, sh, arm, mirror, f, calm) {
  const open = 1 - s.close;
  const pulse = Math.sin(s.t * 2.1 + sh.phase) * 7 * f.k * open * (calm ? 0.3 : 1);
  const wobble = Math.sin(s.t * 0.7 + sh.phase) * 0.05 * open;
  const a = s.rot + (arm / s.spokes) * Math.PI * 2 + mirror * (sh.a + wobble);
  const r = (sh.r * open + 0.78 * s.close) * f.R + pulse + sh.energy * 14 * f.k;
  return { x: f.cx + Math.cos(a) * r, y: f.cy + Math.sin(a) * r };
}

// A shard's colour in the chosen tones: pale by midnight, shimmering under the prism, warm by candle.
function shardTone(c, s, i) {
  const col = c.colors;
  if (s.tone === 'prism') return c.mix(col.accent, col.accent2, (Math.sin(s.t * 1.3 + i * 0.7) + 1) / 2);
  if (s.tone === 'candle') return c.mix(col.accent2, col.fg, 0.3);
  return col.fg;
}

function thread(c, s, arm, mirror) {
  const col = c.colors;
  if (s.tone === 'prism') {
    const u = (Math.sin(s.t * 0.9 + arm * 0.9 + (mirror < 0 ? 1.7 : 0)) + 1) / 2;
    return c.mix(c.mix(col.accent, col.accent2, u), col.fg, 0.3 * (1 - u));
  }
  if (s.tone === 'candle') return arm % 2 ? col.accent2 : c.mix(col.accent2, col.fg, 0.4);
  return arm % 2 ? col.accent : col.accent2;
}

function wrap(g, text, maxW) {
  const out = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const trial = line ? line + ' ' + word : word;
    if (line && g.measureText(trial).width > maxW) {
      out.push(line);
      line = word;
    } else line = trial;
  }
  if (line) out.push(line);
  return out;
}

// The words so far along the top while the pattern is open; the whole mantra under the weave
// once it has closed.
function print(g, w, h, c, s) {
  const m = Math.min(w, h);
  let fs = Math.max(11, Math.round(m * 0.034));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (!s.mantra) {
    if (!s.said) return;
    const text = s.words.slice(0, s.said).join(' · ');
    g.font = '500 ' + fs + 'px system-ui, sans-serif';
    const wide = g.measureText(text).width;
    if (wide > w * 0.9) {
      fs = Math.max(Math.round(m * 0.026), Math.floor((fs * w * 0.9) / wide));
      g.font = '500 ' + fs + 'px system-ui, sans-serif';
    }
    g.fillStyle = c.alpha(c.colors.fg, 0.8);
    wrap(g, text, w * 0.9).forEach((row, i) => g.fillText(row, w / 2, m * 0.05 + i * fs * 1.35));
    return;
  }
  g.font = '500 ' + fs + 'px system-ui, sans-serif';
  const rows = [];
  for (const line of s.mantra) for (const t of wrap(g, line.text, w * 0.9)) rows.push({ t, tone: line.tone });
  let lh = fs * 1.4;
  if (rows.length * lh > h * 0.3) {
    fs = (fs * h * 0.3) / (rows.length * lh);
    lh = fs * 1.4;
    g.font = '500 ' + fs + 'px system-ui, sans-serif';
  }
  const a = Math.min(1, s.close * 1.5);
  rows.forEach((row, i) => {
    g.fillStyle = c.alpha(row.tone, a);
    g.fillText(row.t, w / 2, h * 0.69 + i * lh);
  });
}

function draw(g, w, h, c, s) {
  const col = c.colors;
  const f = frameOf(s, w, h);
  const m = Math.min(w, h);
  const drift = c.reduced ? 0.3 : 1;
  const bg = g.createRadialGradient(f.cx, f.cy, 0, f.cx, f.cy, Math.max(w, h) * 0.7);
  bg.addColorStop(0, col.bg2);
  bg.addColorStop(1, col.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Dust, drifting.
  for (let i = 0; i < 46; i++) {
    g.fillStyle = c.alpha(col.muted, 0.08 + (i % 6) * 0.03);
    g.beginPath();
    g.arc((i * 129.3 + s.t * 10 * drift) % w, (i * 83.7 + s.t * 6 * drift) % h, f.k, 0, Math.PI * 2);
    g.fill();
  }
  // The arms: each a thread through every shard, mirrored, with the closing thread drawn in as
  // the pattern closes; then the shards themselves, glowing where a ripple has reached them.
  g.lineJoin = 'round';
  for (let arm = 0; arm < s.spokes; arm++) {
    for (const mirror of [1, -1]) {
      const pts = s.shards.map((sh) => place(s, sh, arm, mirror, f, c.reduced));
      g.lineWidth = 1 + s.close * 0.5;
      g.strokeStyle = c.alpha(thread(c, s, arm, mirror), 0.3 + s.close * 0.45);
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      if (s.close > 0 && pts.length > 2) {
        g.strokeStyle = c.alpha(col.accent2, s.close * 0.8);
        g.beginPath();
        g.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        g.lineTo(pts[0].x, pts[0].y);
        g.stroke();
      }
      pts.forEach((p, i) => {
        const sh = s.shards[i];
        if (sh.energy > 0.02) {
          g.fillStyle = c.alpha(col.accent2, 0.1 + sh.energy * 0.2);
          g.beginPath();
          g.arc(p.x, p.y, sh.size * (2.4 + sh.energy * 2.5) * f.k, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = sh.energy > 0.2 ? col.accent2 : c.alpha(shardTone(c, s, i), 0.92);
        g.beginPath();
        g.arc(p.x, p.y, (sh.size * 0.8 + sh.energy) * f.k, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  g.lineWidth = 1.35;
  for (const r of s.ripples) {
    g.strokeStyle = c.alpha(col.accent2, r.life * 0.5);
    g.beginPath();
    g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 1 + s.close;
  g.strokeStyle = c.alpha(col.accent, 0.25 + s.close * 0.6);
  g.beginPath();
  g.arc(f.cx, f.cy, f.R, 0, Math.PI * 2);
  g.stroke();
  if (s.close < 1) {
    g.fillStyle = c.alpha(col.muted, 0.75 * (1 - s.close));
    g.font = Math.max(10, Math.round(m * 0.03)) + 'px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('shards ' + s.shards.length + ' · spokes ' + s.spokes + (s.spin ? ' · spin on' : ' · spin off'), m * 0.03, h - m * 0.03);
  }
  print(g, w, h, c, s);
}

function tick(s, dt, c) {
  s.t += dt;
  s.rot += dt * s.spin * (c.reduced ? 0.4 : 1) * (1 - s.close);
  for (const sh of s.shards) sh.energy = Math.max(0, sh.energy - dt * 0.85);
  const k = Math.min(c.w, c.h) / 340;
  s.ripples = s.ripples.filter((r) => {
    r.r += dt * 170 * k;
    r.life -= dt * 0.75;
    return r.life > 0;
  });
}

// A ripple from a point: every shard takes energy by how near its nearest copy is. Returns the
// nearest shard.
function ripple(s, c, x, y) {
  const f = frameOf(s, c.w, c.h);
  s.ripples.push({ x, y, r: 2, life: 1 });
  let best = 0;
  let bestD = Infinity;
  s.shards.forEach((sh, i) => {
    let d = Infinity;
    for (let arm = 0; arm < s.spokes; arm++) {
      for (const mirror of [1, -1]) {
        const p = place(s, sh, arm, mirror, f, c.reduced);
        d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      }
    }
    sh.energy = Math.min(1.4, sh.energy + 0.9 / (1 + (d / f.k) * 0.03));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function tune(s, c, value) {
  s.spokes = Math.max(3, Math.min(12, Math.round(Number(value)) || 3));
  c.status('symmetry tuned to ' + s.spokes + ' spokes');
}

// The pattern closes and the mantra prints: the finale, from whichever knob brings it.
function finale(s, c, status) {
  if (!s.mantra) {
    s.mantra = [
      { text: s.opener, tone: c.colors.accent2 },
      { text: s.words.join(' · '), tone: c.colors.fg },
      { text: s.geo, tone: c.colors.muted },
      { text: s.line, tone: c.colors.fg }
    ];
    ripple(s, c, c.w / 2, c.h / 2);
  }
  s.close = Math.max(s.close, 0.001);
  c.status(status);
}

function open(s, c) {
  c.status(s.stars.length + ' shard' + (s.stars.length === 1 ? '' : 's') + ' on the loom');
  draw(c.g, c.w, c.h, c, s);
}

// The pattern closes as soon as the mantra is called for (print, or the hold let go), whether
// or not every other knob has been set yet; the finish is the visitor's own lever.
function run(s, dt, c) {
  tick(s, dt, c);
  if (c.done || s.mantra) s.close = Math.min(1, s.close + dt * 1.4);
  draw(c.g, c.w, c.h, c, s);
}

/* ---- the pieces ---------------------------------------------------------------------------- */

// A few ripples tapped into the weave, each one waking a star's words, then the mantra printed.
function ripples(env) {
  const count = env.int(3, 5);
  const spokes = env.int(4, 9);
  const turn = env.pick([0.24, 0.4, -0.3]);
  const s = loom(env, spokes);
  let sent = 0;
  const printed = 'a mantra, printed from your constellation geometry';
  return {
    title: NUMBERS[count] + ' ripples into the weave',
    brief: 'Tune the symmetry, start the spin if you like, tap the weave ' + NUMBERS[count] + ' times to ripple it, and print the mantra it has become.',
    aspect: '1 / 1',
    steps: [
      { id: 'spokes', ask: 'symmetry spokes', kind: 'range', min: 3, max: 12, step: 1, value: spokes, low: 'three', high: 'twelve' },
      { id: 'spin', ask: 'the spin', kind: 'toggle', label: 'spin the weave' },
      { id: 'ripple', ask: 'tap the weave ' + NUMBERS[count] + ' times', kind: 'tap', label: 'ripple it for me', after: 'spokes' },
      { id: 'print', ask: 'print the mantra', kind: 'press', count: 1, label: 'print mantra', after: 'ripple' }
    ],
    start: (c) => open(s, c),
    apply(id, value, c) {
      if (id === 'spokes') tune(s, c, value);
      if (id === 'spin') {
        s.spin = value ? turn : 0;
        c.status(spinWord(s.spin));
      }
      if (id === 'print') finale(s, c, printed);
    },
    tap(x, y, c) {
      const i = ripple(s, c, x * c.w, y * c.h);
      sent += 1;
      if (sent <= count) {
        s.said = Math.min(s.words.length, sent);
        c.progress('ripple', sent / count);
        c.status('ripple ' + sent + ' of ' + count + ' — the weave says: ' + s.stars[i].text);
        if (sent === count) c.satisfy('ripple');
      } else c.status(sent % 2 ? 'ripple emitted into the weave' : 'the weave shivers, and holds');
    },
    frame: (t, dt, c) => run(s, dt, c),
    end: (c) => finale(s, c, printed)
  };
}

// The symmetry dial turned up a notch at a time, then the weave held until the pattern closes.
function dial(env) {
  const base = env.int(3, 5);
  const notches = env.int(3, 6);
  const final = base + notches;
  const ms = env.pick([2000, 2500, 3000]);
  const s = loom(env, base);
  s.spin = 0.33;
  return {
    title: NUMBERS[final] + ' spokes and a mantra',
    brief: 'Choose the tones, turn the dial up to ' + NUMBERS[final] + ' spokes, set the spin, and hold the weave until the pattern closes and prints its mantra.',
    aspect: '1 / 1',
    steps: [
      { id: 'tones', ask: 'the tones', kind: 'choice', options: TONES },
      { id: 'dial', ask: 'turn the dial ' + NUMBERS[notches] + ' notches', kind: 'press', count: notches, label: 'one notch' },
      { id: 'spin', ask: 'the spin', kind: 'range', min: 0, max: 100, step: 1, value: 30, low: 'hovering', high: 'whirling' },
      { id: 'close', ask: 'hold until the pattern closes', kind: 'hold', ms, label: 'hold the weave', after: 'dial' }
    ],
    start: (c) => open(s, c),
    apply(id, value, c) {
      if (id === 'tones') {
        s.tone = String(value);
        c.status(TONE_WORDS[s.tone] || s.tone);
      }
      if (id === 'dial') {
        const n = Number(value) || 0;
        tune(s, c, base + n);
        s.said = Math.min(s.words.length, n);
        if (n >= notches) c.status('the dial is all the way round: ' + s.spokes + ' spokes');
      }
      if (id === 'spin') {
        const v = Math.max(0, Math.min(1, Number(value) / 100));
        s.spin = v * 1.1;
        c.status(v === 0 ? spinWord(0) : v < 0.4 ? 'a slow turn; the weave is in motion' : v < 0.75 ? 'the weave is in motion' : 'whirling');
      }
      if (id === 'close') finale(s, c, 'the pattern closes at ' + s.spokes + ' spokes');
    },
    tap(x, y, c) {
      ripple(s, c, x * c.w, y * c.h);
      c.status('ripple emitted into the weave');
    },
    frame: (t, dt, c) => run(s, dt, c),
    end: (c) => finale(s, c, 'closed at ' + s.spokes + ' spokes; the mantra is printed')
  };
}

// The loom left to wind down: tune it, then watch the pattern close and say its words.
function rest(env) {
  const spokes = env.int(3, 12);
  const secs = env.pick([6, 8, 10]);
  const title = env.pick(['the loom at rest', 'the weave winds down', 'let the pattern close']);
  const s = loom(env, spokes);
  s.spin = 0.24;
  let waited = -1;
  return {
    title,
    brief: 'Tune the symmetry, pick a spin, shift the spectrum if you like, and watch for ' + secs + ' seconds while the weave winds down, closes, and prints its mantra.',
    aspect: '1 / 1',
    steps: [
      { id: 'spokes', ask: 'symmetry spokes', kind: 'range', min: 3, max: 12, step: 1, value: spokes, low: 'three', high: 'twelve' },
      { id: 'prism', ask: 'the spectrum', kind: 'toggle', label: 'prism weave' },
      { id: 'spin', ask: 'the spin', kind: 'choice', options: SPINS },
      { id: 'close', ask: 'watch the pattern close', kind: 'wait', after: 'spokes' }
    ],
    start: (c) => open(s, c),
    apply(id, value, c) {
      if (id === 'spokes') {
        tune(s, c, value);
        if (waited < 0) waited = 0;
      }
      if (id === 'prism') {
        s.tone = value ? 'prism' : 'midnight';
        c.status(TONE_WORDS[s.tone]);
      }
      if (id === 'spin') {
        s.spin = Number(value) || 0;
        c.status(spinWord(s.spin));
      }
    },
    tap(x, y, c) {
      ripple(s, c, x * c.w, y * c.h);
      c.status('ripple emitted into the weave');
    },
    frame(t, dt, c) {
      if (waited >= 0 && waited < secs) {
        waited = Math.min(secs, waited + dt);
        const f = waited / secs;
        s.close = Math.max(s.close, f * f);
        const said = Math.min(s.words.length, Math.floor(f * (s.words.length + 1)));
        if (said > s.said) {
          s.said = said;
          c.status('the weave says: ' + s.words[said - 1]);
        }
        c.progress('close', f);
        if (waited >= secs) c.satisfy('close');
      }
      run(s, dt, c);
    },
    end: (c) => finale(s, c, 'the loom is at rest; the mantra is printed')
  };
}

function piece(env) {
  if (!env.stars || !env.stars.length) return null;
  if (env.chance(0.4)) return ripples(env);
  return env.chance(0.58) ? dial(env) : rest(env);
}

export default {
  id: 'orbital-weaver',
  needsSky: true,
  paint(ctx, w, h, env) {
    weave(ctx, w, h, env, Math.max(3, Math.round(env.int(4, 9) * env.variant.density)), 0);
  },
  animate(ctx, w, h, env, t) {
    const spokes = 4 + Math.floor(env.seed % 6);
    weave(ctx, w, h, env, spokes, t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const k = env.int(3, 12);
    return {
      title: 'a mantra',
      quote: words(env, 3).join(' · '),
      text: k + ' spokes of symmetry, ' + env.stars.length + ' star' + (env.stars.length === 1 ? '' : 's') + ' mirrored. Say it until the pattern closes.',
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => weave(ctx, w, h, e, k, 0)
    };
  },
  piece
};
