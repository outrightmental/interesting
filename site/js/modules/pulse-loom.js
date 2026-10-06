/* Two repeating beat patterns become threads. A card carries the exact patterns and offset its
   piece opens with; the visitor's pins add beats before the woven loop is revealed. */
const TAU = Math.PI * 2;
const GUESSES = [
  { label: 'fewer than six', value: 'few' },
  { label: 'six to eleven', value: 'middle' },
  { label: 'twelve or more', value: 'many' }
];

function mask(env, length) {
  const bits = Array.from({ length }, (_, i) => i === 0 || env.rnd() < 0.48 ? 1 : 0);
  bits[env.int(1, length - 1)] = 1;
  return bits;
}

function plan(env) {
  const warp = env.int(3, 6);
  const lengths = [3, 4, 5, 6, 7].filter((n) => n !== warp);
  const wefts = [];
  while (wefts.length < 3) {
    const at = env.int(0, lengths.length - 1);
    const beats = lengths.splice(at, 1)[0];
    wefts.push({ beats, mask: mask(env, beats) });
  }
  return { warp, warpMask: mask(env, warp), wefts, shift: env.int(0, 6) };
}

function carried(env) {
  const p = env.card && env.card.of;
  const validMask = (bits, size) => Array.isArray(bits) && bits.length === size
    && bits.every((bit) => bit === 0 || bit === 1);
  if (!p || !Number.isInteger(p.warp) || p.warp < 3 || p.warp > 6
      || !validMask(p.warpMask, p.warp) || !Array.isArray(p.wefts) || p.wefts.length !== 3
      || !p.wefts.every((w) => w && Number.isInteger(w.beats) && w.beats >= 3
        && w.beats <= 7 && w.beats !== p.warp && validMask(w.mask, w.beats))
      || new Set(p.wefts.map((w) => w.beats)).size !== 3
      || !Number.isInteger(p.shift) || p.shift < 0 || p.shift > 6) return null;
  return p;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function loopLength(a, b) {
  return a * b / gcd(a, b);
}

function crossingCount(p, weft, shift, pins) {
  let total = 0;
  for (let i = 0, n = loopLength(p.warp, weft.beats); i < n; i++) {
    const at = (i + shift) % weft.beats;
    if (p.warpMask[i % p.warp] && (weft.mask[at] || pins.includes(at))) total++;
  }
  return total;
}

function category(n) {
  return n < 6 ? 'few' : n < 12 ? 'middle' : 'many';
}

function thread(g, c, from, to, color, strength, width) {
  g.strokeStyle = c.alpha(color, strength);
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(from.x, from.y);
  g.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2, to.x, to.y);
  g.stroke();
}

function scene(g, w, h, c, p, weft, shift, progress, marks, finished) {
  const v = c.variant || { density: 1, scale: 1, turn: 0 };
  const r = Math.min(w, h) * 0.37 * v.scale;
  const cx = w / 2;
  const cy = h / 2;
  const turn = v.turn * TAU - Math.PI / 2;
  const outer = r * 0.92;
  const inner = r * 0.58;
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.72);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.lineWidth = Math.max(1, r * 0.005);
  g.strokeStyle = c.alpha(c.colors.muted, 0.58);
  for (const radius of [outer, inner]) {
    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < p.warp; i++) {
    const a = turn + i / p.warp * TAU;
    const x = cx + Math.cos(a) * outer;
    const y = cy + Math.sin(a) * outer;
    g.fillStyle = p.warpMask[i] ? c.colors.accent : c.alpha(c.colors.muted, 0.65);
    g.beginPath();
    g.arc(x, y, Math.max(2, r * (p.warpMask[i] ? 0.018 : 0.011)), 0, TAU);
    g.fill();
  }
  for (let i = 0; i < weft.beats; i++) {
    const a = turn + i / weft.beats * TAU;
    const x = cx + Math.cos(a) * inner;
    const y = cy + Math.sin(a) * inner;
    g.fillStyle = weft.mask[i] ? c.colors.accent2 : c.alpha(c.colors.muted, 0.65);
    g.beginPath();
    g.arc(x, y, Math.max(2, r * (weft.mask[i] ? 0.019 : 0.011)), 0, TAU);
    g.fill();
  }

  const pins = marks.map((mark) => Math.min(weft.beats - 1, Math.floor(mark.x * weft.beats)));
  const length = loopLength(p.warp, weft.beats);
  const shown = Math.round(length * Math.max(0, Math.min(1, progress)));
  for (let i = 0; i < length; i++) {
    const at = (i + shift) % weft.beats;
    const a = turn + i / p.warp * TAU;
    const b = turn + (i + shift) / weft.beats * TAU;
    const from = { x: cx + Math.cos(a) * outer, y: cy + Math.sin(a) * outer };
    const to = { x: cx + Math.cos(b) * inner, y: cy + Math.sin(b) * inner };
    const warpOn = !!p.warpMask[i % p.warp];
    const weftOn = !!(weft.mask[at] || pins.includes(at));
    if (!warpOn && !weftOn) continue;
    const lit = i < shown;
    const crossing = warpOn && weftOn;
    const color = crossing ? c.colors.accent2 : warpOn ? c.colors.accent : c.colors.muted;
    thread(g, c, from, to, color, lit ? 0.7 : 0.12, Math.max(0.8, r * (crossing ? 0.009 : 0.005) * v.density));
    if (crossing && lit) {
      g.fillStyle = c.alpha(c.colors.fg, finished ? 0.95 : 0.78);
      g.beginPath();
      g.arc((from.x + to.x) / 2, (from.y + to.y) / 2, Math.max(1.3, r * 0.009 * v.scale), 0, TAU);
      g.fill();
    }
  }
  marks.forEach((mark, i) => {
    const slot = pins[i];
    const a = turn + slot / weft.beats * TAU;
    const x = cx + Math.cos(a) * inner;
    const y = cy + Math.sin(a) * inner;
    g.strokeStyle = c.alpha(c.colors.accent2, 0.65);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, Math.max(5, r * 0.04), 0, TAU);
    g.stroke();
  });
}

function piece(env) {
  const p = carried(env) || plan(env);
  const s = { weft: 0, shift: p.shift, guess: '', marks: [], elapsed: 0, finished: false };
  const duration = 3 + p.warp * 0.28;
  const current = () => p.wefts[s.weft];
  const pins = () => s.marks.map((mark) => Math.min(current().beats - 1, Math.floor(mark.x * current().beats)));
  const draw = (c) => scene(c.g, c.w, c.h, c, p, current(), s.shift,
    c.reduced && s.marks.length === 2 ? 1 : s.marks.length === 2 ? s.elapsed / duration : 0.22,
    s.marks, c.done);
  return {
    title: p.warp + ' against ' + p.wefts[0].beats + ': a woven rhythm',
    brief: 'Choose the inner beat, shift it against the outer beat, predict how often both strike together, and tap twice to pin two beats. Watch the threads weave one complete loop.',
    aspect: '1 / 1',
    steps: [
      { id: 'weft', ask: 'the inner beat', kind: 'choice', options: p.wefts.map((w, i) => ({ label: w.beats + ' beats', value: i })) },
      { id: 'shift', ask: 'move the inner beat', kind: 'range', min: 0, max: 6, step: 1, value: p.shift, low: 'together', high: 'shifted' },
      { id: 'guess', ask: 'how many crossings in one loop?', kind: 'choice', options: GUESSES },
      { id: 'pin', ask: 'tap twice to pin two inner beats', kind: 'tap', label: 'pin one for me' },
      { id: 'weave', ask: 'watch the loop weave', kind: 'wait', after: 'pin' }
    ],
    start(c) {
      c.status('The outer beat has ' + p.warp + ' places. Two pins will start the loom.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'weft') {
        s.weft = Math.max(0, Math.min(2, Number(value)));
        c.status(p.warp + ' outer beats against ' + current().beats + ' inner beats.');
      }
      if (id === 'shift') {
        s.shift = Math.max(0, Math.min(6, Math.round(Number(value))));
        c.status('The inner beat is shifted ' + s.shift + ' places.');
      }
      if (id === 'guess') {
        s.guess = String(value);
        c.status('Prediction: ' + (GUESSES.find((g) => g.value === s.guess) || GUESSES[0]).label + ' crossings.');
      }
      draw(c);
    },
    tap(x, y, c) {
      if (c.done || s.marks.length >= 2) return;
      s.marks.push({ x: Math.max(0, Math.min(0.999, x)), y: Math.max(0, Math.min(1, y)) });
      c.progress('pin', s.marks.length / 2);
      c.status(s.marks.length === 1 ? 'One beat pinned. Tap anywhere to pin the second.' : 'Two beats pinned. The loom is weaving.');
      if (s.marks.length === 2) c.satisfy('pin');
      draw(c);
    },
    frame(t, dt, c) {
      if (s.marks.length === 2 && !s.finished) {
        s.elapsed = c.reduced ? duration : Math.min(duration, s.elapsed + dt);
        c.progress('weave', s.elapsed / duration);
        if (s.elapsed >= duration) {
          s.finished = true;
          c.satisfy('weave');
        }
      }
      draw(c);
    },
    end(c) {
      const count = crossingCount(p, current(), s.shift, pins());
      c.status(count + ' crossings in one loop. ' + (s.guess === category(count)
        ? 'You called it.' : 'You predicted ' + (GUESSES.find((g) => g.value === s.guess) || GUESSES[0]).label + '.'));
      draw(c);
    }
  };
}

export default {
  id: 'pulse-loom',
  needsSky: false,
  paint(g, w, h, env) {
    const p = plan(env);
    scene(g, w, h, env, p, p.wefts[0], p.shift, 0.55, [], false);
  },
  spark(env) {
    const p = plan(env);
    return {
      title: p.warp + ' against ' + p.wefts[0].beats,
      text: 'Two repeating beats meet in unexpected places. Pin two more beats, predict the crossings, and watch one loop weave itself.',
      mono: 'outer  ' + p.warpMask.join(' ') + '\ninner  ' + p.wefts[0].mask.join(' '),
      aspect: '1 / 1',
      paint: (g, w, h, e) => scene(g, w, h, e, p, p.wefts[0], p.shift, 0.55, [], false),
      of: p
    };
  },
  piece
};
