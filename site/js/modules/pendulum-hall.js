/* The pendulum hall: a row of pendulums, each tuned to swing a touch faster than the one before,
   released together from the same side. As a card it is the rack mid-breath (paint, animate,
   spark); as a piece it is the rack tuned, predicted, released and watched through one full
   breath, in which the row splits into two opposite ranks or swings as one by arithmetic alone.
   See js/feed.js for the card contract and js/stage.js for the piece contract.

   A card and the feature it opens as are one rack: the spark puts its whole plan on its spec as
   `of`, and the piece opens that rack -- the same count of pendulums, the same tuning, the same
   swing -- so pressing rack 417 opens rack 417 and not another rack of this seed. */

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
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  const n = p.n;
  const barY = h * 0.12;
  const left = w * 0.09;
  const right = w * 0.91;
  const gap = n > 1 ? (right - left) / (n - 1) : 0;
  const Lmax = h * 0.68 * Math.min(1.08, v.scale);
  const Lmin = Lmax * 0.55;
  const amp = 0.14 + Math.max(0, Math.min(1, s.swing)) * 0.36;
  const size = Math.max(10, Math.min(18, Math.round(Math.min(w, h) * 0.042)));

  g.fillStyle = c.alpha(col.accent, 0.12);
  for (let i = 0, dots = Math.max(8, Math.round(22 * v.density)); i < dots; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.37) % 1) * w, ((i * 0.7548777) % 1) * h, 1.2, 1.2);
  }

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

export default {
  id: 'pendulum-hall',
  needsSky: false,
  paint(g, w, h, env) {
    preview(g, w, h, env, plan(env));
  },
  animate(g, w, h, env, t) {
    const p = plan(env);
    const v = env.variant || PLAIN;
    scene(g, w, h, env, p, { d: p.d, swing: p.swing / 100, released: true, time: (t * 0.5 + v.turn * p.breath) % p.breath }, v);
  },
  spark(env) {
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
    return rackPiece(env, carried(env) || plan(env));
  }
};
