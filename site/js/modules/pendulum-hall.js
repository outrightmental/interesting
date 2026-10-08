/* Two shapes in the pendulum hall: a rack tuned to gather and scatter, and a pair whose
   spring can carry a swing between them. Cards carry their exact subject into the piece.
   Both share the hall's drawing ground; each piece owns its choices and elapsed time. */

const GUESSES = [
  { label: 'swing as one rank', value: 'together' },
  { label: 'split into two opposite ranks', value: 'ranks' },
  { label: 'scatter with no pattern', value: 'scatter' }
];
const TUNINGS = [
  { label: 'one beat apart', value: 1 },
  { label: 'two beats apart', value: 2 }
];
const PLAIN = { density: 1, scale: 1, turn: 0 };

// The plan is pure arithmetic on the seed, so a card's animate can rebuild it every frame without
// touching the seeded stream the piece draws from.
function plan(env) {
  const seed = env.seed >>> 0;
  const pick = (k, m) => (Math.imul(seed ^ (seed >>> k), 2654435761) >>> 0) % m;
  return {
    family: 'pendulum-rack',
    number: 100 + (seed % 900),
    n: 8 + pick(3, 5),
    base: 4 + pick(7, 3),
    d: pick(11, 2) ? 2 : 1,
    swing: 40 + pick(13, 46),
    breath: 7 + pick(17, 3)
  };
}

// The card this piece was opened from, read defensively: the rack it previewed, or null for a
// piece nobody pressed (js/stage.js hands the card over as env.card.of).
function carried(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'pendulum-rack'
      || !Number.isInteger(p.number) || p.number < 100 || p.number > 999
      || !Number.isInteger(p.n) || p.n < 8 || p.n > 12
      || !Number.isInteger(p.base) || p.base < 4 || p.base > 6
      || (p.d !== 1 && p.d !== 2)
      || !Number.isInteger(p.swing) || p.swing < 20 || p.swing > 100
      || !Number.isInteger(p.breath) || p.breath < 7 || p.breath > 9) return null;
  return { family: p.family, number: p.number, n: p.n, base: p.base, d: p.d, swing: p.swing, breath: p.breath };
}

function rackTitle(p) {
  return 'rack ' + p.number + ': ' + p.n + ' pendulums';
}

function hallBackground(g, w, h, c, v) {
  const col = c.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.alpha(col.accent, 0.12);
  for (let i = 0, dots = Math.max(8, Math.round(22 * v.density)); i < dots; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.37) % 1) * w, ((i * 0.7548777) % 1) * h, 1.2, 1.2);
  }
}

// Released from the side, so every pendulum starts at its full swing: cosine, not sine. At the
// half-breath, neighbours one beat apart sit half a swing apart (two opposite ranks) and two
// beats apart sit a whole swing apart (one rank again); at the full breath all come home.
function swingOf(p, s, i) {
  if (!s.released) return 1;
  return Math.cos(2 * Math.PI * (p.base + i * s.d) * (s.time / p.breath));
}

function scene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  hallBackground(g, w, h, c, v);

  const n = p.n;
  const barY = h * 0.12;
  const left = w * 0.09;
  const right = w * 0.91;
  const gap = n > 1 ? (right - left) / (n - 1) : 0;
  const Lmax = h * 0.68 * Math.min(1.08, v.scale);
  const Lmin = Lmax * 0.55;
  const amp = 0.14 + Math.max(0, Math.min(1, s.swing)) * 0.36;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.042)));

  g.strokeStyle = c.alpha(col.fg, 0.55);
  g.lineWidth = Math.max(2, h * 0.012);
  g.beginPath();
  g.moveTo(left - gap * 0.4, barY);
  g.lineTo(right + gap * 0.4, barY);
  g.stroke();

  g.strokeStyle = c.alpha(col.muted, 0.22);
  g.lineWidth = 1;
  g.setLineDash([2, 6]);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = left + i * gap;
    g.moveTo(x, barY);
    g.lineTo(x, barY + Lmax - (Lmax - Lmin) * (n > 1 ? i / (n - 1) : 0));
  }
  g.stroke();
  g.setLineDash([]);

  const bobs = [];
  for (let i = 0; i < n; i++) {
    const x = left + i * gap;
    const len = Lmax - (Lmax - Lmin) * (n > 1 ? i / (n - 1) : 0);
    const theta = amp * swingOf(p, s, i);
    bobs.push({ px: x, x: x + Math.sin(theta) * len, y: barY + Math.cos(theta) * len });
  }

  g.strokeStyle = c.alpha(col.accent2, 0.55);
  g.lineWidth = Math.max(1, Math.min(w, h) * 0.004 * v.density);
  g.beginPath();
  bobs.forEach((b, i) => (i ? g.lineTo(b.x, b.y) : g.moveTo(b.x, b.y)));
  g.stroke();

  const r = Math.max(3, Math.min(w, h) * 0.016 * Math.min(1.1, v.scale));
  bobs.forEach((b, i) => {
    g.strokeStyle = c.alpha(col.fg, 0.4);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(b.px, barY);
    g.lineTo(b.x, b.y);
    g.stroke();
    const tone = c.mix(col.accent, col.accent2, n > 1 ? i / (n - 1) : 0);
    g.fillStyle = c.alpha(tone, 0.25);
    g.beginPath();
    g.arc(b.x, b.y, r * 1.9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = tone;
    g.beginPath();
    g.arc(b.x, b.y, r, 0, Math.PI * 2);
    g.fill();
  });

  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = col.fg;
  const f = s.released ? Math.min(1, s.time / p.breath) : 0;
  const line = !s.released ? 'held at the side, ready'
    : f >= 1 ? 'one full breath: home together'
      : 'breath ' + Math.round(f * 100) + '% through';
  g.fillText(line, w / 2, h * 0.94, w * 0.9);
}

function preview(g, w, h, env, p) {
  const v = env.variant || PLAIN;
  scene(g, w, h, env, p, { d: p.d, swing: p.swing / 100, released: v.turn > 0.03, time: v.turn * p.breath }, v);
}

function rackPiece(env, p) {
  const s = { d: p.d, swing: p.swing / 100, guess: '', released: false, time: 0, said: 0, watched: false };
  const draw = (c) => scene(c.g, c.w, c.h, c, p, s, env.variant || PLAIN);
  return {
    title: rackTitle(p),
    brief: 'A row of ' + p.n + ' pendulums, each tuned to swing a touch faster than the one before. Tune how far apart the neighbours run, set the swing, predict what the row does at half-breath, then release them together and watch one full breath. Any prediction works; the tuning alone makes and unmakes the pattern.',
    aspect: '16 / 10',
    steps: [
      { id: 'step', ask: 'how the neighbours are tuned', kind: 'choice', options: TUNINGS },
      { id: 'swing', ask: 'how wide they swing', kind: 'range', min: 20, max: 100, step: 1, value: p.swing, low: 'a whisper', high: 'full tilt' },
      { id: 'guess', ask: 'at half-breath, the row will…?', kind: 'choice', options: GUESSES },
      { id: 'release', ask: 'release them together', kind: 'press', count: 1, label: 'release the rack' },
      { id: 'watch', ask: 'watch one full breath', kind: 'wait', after: 'release' }
    ],
    start(c) {
      c.status('Rack ' + p.number + ': ' + p.n + ' pendulums hang from one bar, held aside at full swing. The slowest counts ' + p.base + ' swings to a breath; each neighbour counts a little more.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'step') {
        const d = Number(value);
        if (d !== 1 && d !== 2) {
          c.status('Tune the neighbours one or two beats apart.');
          return;
        }
        s.d = d;
        c.status('Neighbours ' + (d === 1 ? 'one beat' : 'two beats') + ' apart: the slowest counts ' + p.base + ' to a breath, the fastest ' + (p.base + (p.n - 1) * d) + '. The half-breath pattern follows from that and nothing else.');
      }
      if (id === 'swing') {
        const k = Number(value);
        if (!Number.isFinite(k)) {
          c.status('Set the swing between 20 and 100.');
          return;
        }
        s.swing = Math.max(20, Math.min(100, Math.round(k))) / 100;
        c.status(s.swing < 0.4 ? 'A whisper of a swing. The pattern is the same at any width.' : s.swing > 0.8 ? 'Full tilt. The pattern is the same at any width.' : 'A steady swing.');
      }
      if (id === 'guess') {
        const pick = GUESSES.find((o) => o.value === value);
        if (!pick) {
          c.status('Choose what the row will do at half-breath.');
          return;
        }
        s.guess = pick.value;
        c.status('Your prediction: at half-breath the row will ' + pick.label + '. You can retune before and after releasing.');
      }
      if (id === 'release' && !s.released) {
        s.released = true;
        s.time = 0;
        s.said = 0;
        c.status(c.reduced ? 'Released. The breath appears without movement.' : 'Released together. Watch the wave run down the row.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.released && !c.done) {
        s.time = c.reduced ? p.breath : Math.min(p.breath, s.time + Math.max(0, dt));
        const f = s.time / p.breath;
        if (!s.watched) c.progress('watch', f);
        if (s.said < 1 && f >= 0.22 && f < 0.5) {
          s.said = 1;
          c.status('A wave is running down the row.');
        }
        if (s.said < 2 && f >= 0.5 && f < 1) {
          s.said = 2;
          c.status(s.d === 2 ? 'Half-breath: the whole row swings as one rank again.' : 'Half-breath: the row has split into two opposite ranks.');
        }
        if (f >= 1 && !s.watched) {
          s.watched = true;
          c.satisfy('watch');
          c.status('One full breath: every pendulum came home together. Choices still waiting can change the finding.');
        }
      }
      draw(c);
    },
    end(c) {
      s.released = true;
      s.watched = true;
      s.time = p.breath;
      draw(c);
      const correct = s.d === 2 ? 'together' : 'ranks';
      const chosen = GUESSES.find((o) => o.value === s.guess);
      c.status('At half-breath the row ' + (s.d === 2
        ? 'swung as one rank: two beats apart puts neighbours a whole swing apart, which is no gap at all.'
        : 'split into two opposite ranks: one beat apart puts neighbours half a swing apart.')
        + ' ' + (s.guess === correct ? 'You called it.' : 'You predicted it would ' + (chosen ? chosen.label : 'do something else') + '.')
        + ' Nothing held them in step but the tuning, and at the full breath every count came back to one.');
    }
  };
}

const LINKS = [
  { label: 'join them with a spring', value: 'joined' },
  { label: 'leave them separate', value: 'separate' }
];
const STARTS = [
  { label: 'only the first, from the side', value: 'one' },
  { label: 'both, from the same side', value: 'together' },
  { label: 'both, from opposite sides', value: 'opposite' }
];
const TRADE_GUESSES = [
  { label: 'the swing travels out and back', value: 'trade' },
  { label: 'each keeps its own swing', value: 'keep' },
  { label: 'both come to a stop', value: 'stop' }
];
const TRADE_BRIEF = 'Join two pendulums with a spring or leave them separate, choose how they start, predict whether the swing changes hands, then release them. Changing a setting redraws the same release while a choice waits. Any prediction works.';

function dealsTrade(env) {
  return (env.seed >>> 0) % 3 === 1;
}

function tradePlan(env) {
  const rack = plan(env);
  const seed = env.seed >>> 0;
  return {
    family: 'swing-pair',
    number: rack.number,
    base: rack.base - 2,
    swing: rack.swing,
    breath: rack.breath + 2,
    first: (seed >>> 4) & 1,
    link: seed & 8 ? 'separate' : 'joined',
    pattern: ['one', 'one', 'one', 'together', 'opposite'][seed % 5]
  };
}

function carriedTrade(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'swing-pair'
      || !Number.isInteger(p.number) || p.number < 100 || p.number > 999
      || !Number.isInteger(p.base) || p.base < 2 || p.base > 4
      || !Number.isInteger(p.swing) || p.swing < 40 || p.swing > 85
      || !Number.isInteger(p.breath) || p.breath < 9 || p.breath > 11
      || (p.first !== 0 && p.first !== 1)
      || !LINKS.some((o) => o.value === p.link)
      || !STARTS.some((o) => o.value === p.pattern)) return null;
  return {
    family: p.family, number: p.number, base: p.base, swing: p.swing,
    breath: p.breath, first: p.first, link: p.link, pattern: p.pattern
  };
}

function tradeTitle(p) {
  return 'pair ' + p.number + ': a swing to lend';
}

function tradeState(p) {
  return {
    link: p.link, pattern: p.pattern, guess: '', released: false,
    time: 0, halfway: false, watched: false
  };
}

function leading(options, value) {
  return options.filter((o) => o.value === value).concat(options.filter((o) => o.value !== value));
}

// Exact normal modes of two identical linear pendulums with a spring: the same-side mode
// is unchanged, the opposite-side mode is faster. Their phase gap is pi at half-breath,
// giving a complete handover from an isolated start, and 2*pi at the return.
function tradeMotion(p, s, time) {
  const f = s.released ? Math.max(0, time) / p.breath : 0;
  const slow = 4 * Math.PI * p.base * f;
  const fast = slow + (s.link === 'joined' ? 2 * Math.PI * f : 0);
  if (s.pattern === 'together') {
    const q = Math.cos(slow);
    return { first: q, second: q, firstReach: 1, secondReach: 1 };
  }
  if (s.pattern === 'opposite') {
    const q = Math.cos(fast);
    return { first: q, second: -q, firstReach: 1, secondReach: 1 };
  }
  if (s.link === 'separate') {
    return { first: Math.cos(slow), second: 0, firstReach: 1, secondReach: 0 };
  }
  return {
    first: (Math.cos(slow) + Math.cos(fast)) / 2,
    second: (Math.cos(slow) - Math.cos(fast)) / 2,
    firstReach: Math.abs(Math.cos(Math.PI * f)),
    secondReach: Math.abs(Math.sin(Math.PI * f))
  };
}

function tradeSpring(g, c, a, b, radius, v) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const coils = Math.max(6, Math.round(10 * v.density));
  const width = Math.min(radius * 0.8, length * 0.03);
  g.strokeStyle = c.colors.accent;
  g.lineWidth = Math.max(1, radius * 0.16);
  g.beginPath();
  g.moveTo(a.x + ux * radius, a.y + uy * radius);
  for (let i = 0; i <= coils * 2; i++) {
    const along = radius + (length - radius * 2) * (0.12 + i / (coils * 2) * 0.76);
    const across = i === 0 || i === coils * 2 ? 0 : (i % 2 ? 1 : -1) * width;
    g.lineTo(a.x + ux * along - uy * across, a.y + uy * along + ux * across);
  }
  g.lineTo(b.x - ux * radius, b.y - uy * radius);
  g.stroke();
}

function tradeGraph(g, w, h, c, p, s, v, size) {
  const col = c.colors;
  const left = w * 0.08;
  const right = w * 0.92;
  const top = h * 0.77;
  const bottom = h * 0.91;
  const f = s.released ? Math.min(1, s.time / p.breath) : 0;
  const samples = Math.max(32, Math.round(80 * v.density));
  g.strokeStyle = c.alpha(col.muted, 0.35);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(left, top);
  g.lineTo(left, bottom);
  g.lineTo(right, bottom);
  g.moveTo(w / 2, top);
  g.lineTo(w / 2, bottom);
  g.stroke();

  for (const [key, color, dashed] of [
    ['firstReach', col.accent2, false], ['secondReach', col.accent, true]
  ]) {
    g.strokeStyle = color;
    g.lineWidth = dashed ? 1.5 : 2.5;
    g.setLineDash(dashed ? [4, 3] : []);
    g.beginPath();
    const count = Math.ceil(samples * f);
    for (let i = 0; i <= count; i++) {
      const phase = Math.min(f, i / samples);
      const reach = tradeMotion(p, s, phase * p.breath)[key];
      const x = left + (right - left) * phase;
      const y = bottom - (bottom - top) * reach;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
    const reach = tradeMotion(p, s, f * p.breath)[key];
    g.fillStyle = color;
    g.beginPath();
    g.arc(left + (right - left) * f, bottom - (bottom - top) * reach,
      Math.max(2, size * 0.16), 0, Math.PI * 2);
    g.fill();
  }

  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.fillStyle = col.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('swing size', w / 2, h * 0.715, w * 0.8);
  g.textAlign = 'left';
  g.fillText('0', left, h * 0.97);
  g.textAlign = 'center';
  g.fillText('halfway', w / 2, h * 0.97, w * 0.35);
  g.textAlign = 'right';
  g.fillText(p.breath + ' s', right, h * 0.97);
}

function tradeScene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const size = Math.max(10, Math.min(18, Math.round(m * 0.04)));
  const barY = h * (0.12 + v.turn * 0.015);
  const length = Math.min(h * 0.42, w * 0.42) * Math.min(1.08, v.scale);
  const amplitude = 0.13 + p.swing / 100 * 0.08;
  const radius = Math.max(3, m * 0.026 * v.scale);
  const motion = tradeMotion(p, s, s.time);
  const values = p.first === 0 ? [motion.first, motion.second] : [motion.second, motion.first];
  const bobs = values.map((q, i) => ({
    pivot: w * (0.28 + i * 0.44),
    x: w * (0.28 + i * 0.44) + Math.sin(amplitude * q) * length,
    y: barY + Math.cos(amplitude * q) * length,
    first: i === p.first
  }));
  g.save();
  hallBackground(g, w, h, c, v);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = c.alpha(col.fg, 0.6);
  g.lineWidth = Math.max(2, m * 0.012);
  g.beginPath();
  g.moveTo(w * 0.1, barY);
  g.lineTo(w * 0.9, barY);
  g.stroke();

  g.strokeStyle = c.alpha(col.muted, 0.3);
  g.lineWidth = 1;
  g.setLineDash([2, 5]);
  for (const bob of bobs) {
    g.beginPath();
    g.moveTo(bob.pivot, barY);
    g.lineTo(bob.pivot, barY + length);
    g.stroke();
    g.beginPath();
    g.arc(bob.pivot, barY, length, Math.PI / 2 - amplitude, Math.PI / 2 + amplitude);
    g.stroke();
  }
  g.setLineDash([]);
  if (s.link === 'joined') tradeSpring(g, c, bobs[0], bobs[1], radius, v);

  for (const bob of bobs) {
    const color = bob.first ? col.accent2 : col.accent;
    g.strokeStyle = c.alpha(col.fg, 0.7);
    g.lineWidth = Math.max(1.2, m * 0.005);
    g.beginPath();
    g.moveTo(bob.pivot, barY);
    g.lineTo(bob.x, bob.y);
    g.stroke();
    g.fillStyle = c.alpha(color, 0.16);
    g.beginPath();
    g.arc(bob.x, bob.y, radius * 1.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(bob.x, bob.y, radius, 0, Math.PI * 2);
    g.fill();
    g.font = '500 ' + size + 'px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = col.fg;
    const reach = bob.first ? motion.firstReach : motion.secondReach;
    g.fillText((bob.first ? 'first' : 'second') + ': ' + Math.round(reach * 100) + '%',
      bob.pivot, h * 0.65, w * 0.42);
  }
  g.fillStyle = col.fg;
  g.fillText(s.link === 'joined' ? 'spring joined' : 'separate pendulums', w / 2, h * 0.055, w * 0.9);
  tradeGraph(g, w, h, c, p, s, v, size);
  g.restore();
}

function tradePreview(g, w, h, env, p) {
  tradeScene(g, w, h, env, p, tradeState(p), env.variant || PLAIN);
}

function tradeOutcome(s) {
  return s.link === 'joined' && s.pattern === 'one' ? 'trade' : 'keep';
}

function tradeFinding(s) {
  if (s.link === 'separate') {
    return s.pattern === 'one'
      ? 'The first kept its swing and the second stayed still. Without the spring, there was no way for motion to pass across.'
      : 'Both kept their original swing sizes. Without the spring, each moved on its own, even when their starts lined up.';
  }
  if (s.pattern === 'together') {
    return 'Both kept the same swing size. Moving together never stretched their spring, so it had nothing to pass between them.';
  }
  if (s.pattern === 'opposite') {
    return 'Both kept their swing size, but beat a little faster than they would apart. Opposite starts tug the spring on every swing.';
  }
  return 'Halfway, the first rested and the second had its whole swing. Then the swing came back. No extra push was added after release: the spring passed the motion along.';
}

function tradePiece(env, p) {
  const s = tradeState(p);
  const draw = (c) => tradeScene(c.g, c.w, c.h, c, p, s, env.variant || PLAIN);
  function setting(c) {
    const start = STARTS.find((o) => o.value === s.pattern);
    c.status((s.released ? 'The picture redraws the same release with this setting. ' : '')
      + (s.link === 'joined' ? 'Spring joined; ' : 'No spring; ')
      + start.label + '.' + (s.watched ? ' ' + tradeFinding(s) : ''));
  }
  return {
    title: tradeTitle(p),
    brief: TRADE_BRIEF,
    aspect: '16 / 10',
    steps: [
      { id: 'link', ask: 'can motion pass between them?', kind: 'choice', options: leading(LINKS, p.link) },
      { id: 'start', ask: 'which pendulums start from the side?', kind: 'choice', options: leading(STARTS, p.pattern) },
      { id: 'guess', ask: 'over one breath, what happens to the swing?', kind: 'choice', options: TRADE_GUESSES },
      { id: 'release', ask: 'let go, with no further pushes', kind: 'press', count: 1, label: 'release the pair' },
      { id: 'watch', ask: 'watch one breath, out and back', kind: 'wait', after: 'release' }
    ],
    start(c) {
      c.status('Two pendulums of the same length. The first is on the '
        + (p.first === 0 ? 'left' : 'right')
        + '. Choose their spring and starting positions, predict the swing, then release them. The solid line below follows the first; the dashed line follows the second.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'link') {
        if (!LINKS.some((o) => o.value === value)) {
          c.status('Join the spring or leave the two pendulums separate.');
          return;
        }
        s.link = value;
        setting(c);
      }
      if (id === 'start') {
        if (!STARTS.some((o) => o.value === value)) {
          c.status('Choose one pendulum, both together, or both from opposite sides.');
          return;
        }
        s.pattern = value;
        setting(c);
      }
      if (id === 'guess') {
        const prediction = TRADE_GUESSES.find((o) => o.value === value);
        if (!prediction) {
          c.status('Predict whether the swing travels, stays with each pendulum, or stops.');
          return;
        }
        s.guess = prediction.value;
        c.status('You predict ' + prediction.label + '. '
          + (s.watched ? tradeFinding(s) : 'Any prediction works.'));
      }
      if (id === 'release' && !s.released) {
        s.released = true;
        c.status(c.reduced
          ? 'The breath will appear without movement; the lines below keep the path of both swing sizes.'
          : 'Released, with no further pushes. Follow the two swing sizes below the pendulums.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.released && !s.watched) {
        s.time = c.reduced ? p.breath : Math.min(p.breath, s.time + Math.max(0, dt));
        const f = s.time / p.breath;
        c.progress('watch', f);
        if (!s.halfway && f >= 0.5 && f < 1) {
          s.halfway = true;
          c.status(tradeOutcome(s) === 'trade'
            ? 'At halfway, the first rested and the second took its swing. Watch the swing travel back.'
            : 'Halfway through: both have kept their original swing sizes. The next half follows the same starts.');
        }
        if (f >= 1) {
          s.watched = true;
          c.satisfy('watch');
          if (!c.done) c.status('One breath has played. ' + tradeFinding(s)
            + ' Any choices still waiting can change the finding.');
        }
      }
      draw(c);
    },
    end(c) {
      s.released = true;
      s.watched = true;
      s.time = p.breath;
      const prediction = TRADE_GUESSES.find((o) => o.value === s.guess);
      c.status(tradeFinding(s) + ' '
        + (s.guess === tradeOutcome(s) ? 'You called it.'
          : 'You predicted ' + (prediction ? prediction.label : 'another ending') + '.')
        + ' The lines show swing size, not the position of a bob. The drawing assumes small swings and no friction.');
      draw(c);
    }
  };
}

export default {
  id: 'pendulum-hall',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsTrade(env)) tradePreview(g, w, h, env, tradePlan(env));
    else preview(g, w, h, env, plan(env));
  },
  animate(g, w, h, env, t) {
    const v = env.variant || PLAIN;
    if (dealsTrade(env)) {
      const p = tradePlan(env);
      if (env.reduced) {
        tradePreview(g, w, h, env, p);
        return;
      }
      const s = tradeState(p);
      s.released = true;
      s.time = (t * 0.65 + v.turn * p.breath) % p.breath;
      tradeScene(g, w, h, env, p, s, v);
      return;
    }
    const p = plan(env);
    scene(g, w, h, env, p, { d: p.d, swing: p.swing / 100, released: true, time: (t * 0.5 + v.turn * p.breath) % p.breath }, v);
  },
  spark(env) {
    if (dealsTrade(env)) {
      const p = tradePlan(env);
      return {
        title: tradeTitle(p),
        text: TRADE_BRIEF,
        mono: 'spring  ' + (p.link === 'joined' ? 'joined' : 'set aside')
          + '\nstart   ' + STARTS.find((o) => o.value === p.pattern).label
          + '\nbreath  ' + p.breath + ' seconds',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => tradePreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = plan(env);
    return {
      title: rackTitle(p),
      text: 'Released together, tuned slightly apart: will the row split into two opposite ranks at half-breath, or swing as one? Predict it, then let them go.',
      mono: 'row of ' + p.n + '\nslowest  ' + p.base + ' swings a breath\nneighbours  ' + (p.d === 1 ? 'one beat' : 'two beats') + ' apart',
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => preview(g, w, h, cardEnv, p),
      // What this card is of, for the piece it opens as: the whole rack it previewed.
      of: p
    };
  },
  piece(env) {
    const pair = carriedTrade(env);
    if (pair) return tradePiece(env, pair);
    const rack = carried(env);
    if (rack) return rackPiece(env, rack);
    return dealsTrade(env) ? tradePiece(env, tradePlan(env)) : rackPiece(env, plan(env));
  }
};
