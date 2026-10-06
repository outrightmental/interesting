/* Two repeating beat patterns become threads; a photographed wheel can seem to reverse.
   Cards carry the exact plan their piece opens with. Both scenes share their card's composition
   dials, and every piece keeps its own choices and progress. */
const TAU = Math.PI * 2;
const GUESSES = [
  { label: 'fewer than six', value: 'few' },
  { label: 'six to eleven', value: 'middle' },
  { label: 'twelve or more', value: 'many' }
];
const DIRECTIONS = [
  { label: 'clockwise', value: 'forward' },
  { label: 'backwards', value: 'backward' },
  { label: 'standing still', value: 'still' },
  { label: 'either way', value: 'either' }
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

function scene(g, w, h, c, p, weft, shift, progress, marks, finished, variant) {
  const v = variant || c.variant || { density: 1, scale: 1, turn: 0 };
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

function weavingPiece(env, carriedPlan) {
  const p = carriedPlan || plan(env);
  const s = { weft: 0, shift: p.shift, guess: '', marks: [], elapsed: 0, finished: false };
  const duration = 3 + p.warp * 0.28;
  const current = () => p.wefts[s.weft];
  const pins = () => s.marks.map((mark) => Math.min(current().beats - 1, Math.floor(mark.x * current().beats)));
  const draw = (c) => scene(c.g, c.w, c.h, c, p, current(), s.shift,
    c.reduced && s.marks.length === 2 ? 1 : s.marks.length === 2 ? s.elapsed / duration : 0.22,
    s.marks, c.done, env.variant);
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

function isStrobe(env) {
  return env.seed % 3 === 0;
}

function strobePlan(env) {
  const pool = [8, 9, 10, 12, 14, 16];
  const teeth = [];
  while (teeth.length < 3) teeth.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  const pictures = Math.max(6, Math.min(20, teeth[0] + env.pick([-2, -1, 0, 1, 2])));
  return {
    family: 'strobe', teeth, pictures,
    samples: env.int(12, 16), interval: env.pick([0.3, 0.34, 0.38])
  };
}

function carriedStrobe(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'strobe' || !Array.isArray(p.teeth) || p.teeth.length !== 3
      || !p.teeth.every((n) => Number.isInteger(n) && n >= 8 && n <= 16)
      || new Set(p.teeth).size !== 3
      || !Number.isInteger(p.pictures) || p.pictures < 6 || p.pictures > 20
      || !Number.isInteger(p.samples) || p.samples < 12 || p.samples > 16
      || !Number.isFinite(p.interval) || p.interval < 0.3 || p.interval > 0.38) return null;
  return p;
}

function strobeTitle(p) {
  return p.teeth[0] + ' teeth, ' + p.pictures + ' pictures per turn';
}

// Identical teeth hide whole tooth gaps. The remaining shortest jump is the apparent motion;
// at half a gap, neither direction is more justified by the pictures.
function apparent(teeth, pictures) {
  const gaps = teeth / pictures;
  const whole = Math.round(gaps);
  const slip = gaps - whole;
  const direction = Math.abs(slip) < 0.000001 ? 'still'
    : Math.abs(Math.abs(slip) - 0.5) < 0.000001 ? 'either'
      : slip < 0 ? 'backward' : 'forward';
  return { whole, slip, direction };
}

function directionName(direction) {
  return DIRECTIONS.find((d) => d.value === direction).label;
}

function wheel(g, c, x, y, r, teeth, angle, color, strength) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.strokeStyle = c.alpha(color, strength);
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.beginPath();
  g.arc(0, 0, r * 0.88, 0, TAU);
  g.moveTo(r * 0.17, 0);
  g.arc(0, 0, r * 0.17, 0, TAU);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    g.moveTo(cos * r * 0.17, sin * r * 0.17);
    g.lineTo(cos * r * 0.88, sin * r * 0.88);
  }
  g.stroke();
  g.fillStyle = c.alpha(color, strength);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU;
    g.save();
    g.rotate(a);
    g.fillRect(r * 0.83, -r * 0.035, r * 0.17, r * 0.07);
    g.restore();
  }
  g.restore();
}

function rotationArrow(g, c, x, y, r, backward, color) {
  const sign = backward ? -1 : 1;
  const start = -Math.PI * 0.86;
  const span = Math.PI * 1.15;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, r * 0.017);
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (start + span * i / 24) * sign;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.stroke();
  const a = (start + span) * sign;
  const px = x + Math.cos(a) * r;
  const py = y + Math.sin(a) * r;
  const tx = -Math.sin(a) * sign;
  const ty = Math.cos(a) * sign;
  const size = Math.max(3, r * 0.12);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(px, py);
  g.lineTo(px - tx * size + Math.cos(a) * size * 0.5, py - ty * size + Math.sin(a) * size * 0.5);
  g.lineTo(px - tx * size - Math.cos(a) * size * 0.5, py - ty * size - Math.sin(a) * size * 0.5);
  g.closePath();
  g.fill();
}

function strobeText(g, text, x, y, width, size, color) {
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && g.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((row, i) => g.fillText(row, x, y + i * size * 1.2));
}

function strobeScene(g, w, h, c, p, s, variant) {
  const v = variant || c.variant || { density: 1, scale: 1, turn: 0 };
  const col = c.colors;
  const m = Math.min(w, h);
  const pad = w * 0.045;
  const panel = (w - pad * 3) / 2;
  const left = pad + panel / 2;
  const right = w - left;
  const cy = h * 0.4;
  const radius = Math.min(panel * 0.35, h * 0.23) * v.scale;
  const phase = v.turn * TAU;
  const size = Math.max(9, Math.min(18, m * 0.042));
  const result = apparent(s.teeth, s.pictures);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, col.bg2);
  grad.addColorStop(1, col.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.strokeStyle = c.alpha(col.muted, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w / 2, h * 0.16);
  g.lineTo(w / 2, h * 0.72);
  g.stroke();
  strobeText(g, 'real', left, h * 0.09, panel, size, col.fg);
  strobeText(g, 'pictures', right, h * 0.09, panel, size, col.fg);
  wheel(g, c, left, cy, radius, s.teeth, phase + s.time / p.interval / s.pictures * TAU, col.accent, 0.95);
  // Hold an actual sampled angle, not an invented reverse rotation. The matching teeth make
  // these clockwise snapshots look like small backward jumps without any light blinking.
  wheel(g, c, right, cy, radius, s.teeth, phase + s.index / s.pictures * TAU, col.accent2, 0.95);
  rotationArrow(g, c, left, cy, radius * 1.13, false, col.accent);
  if (s.revealed) {
    if (result.direction === 'forward' || result.direction === 'backward') {
      rotationArrow(g, c, right, cy, radius * 1.13, result.direction === 'backward', col.accent2);
    } else if (result.direction === 'either') {
      rotationArrow(g, c, right, cy, radius * 1.13, false, col.accent2);
      rotationArrow(g, c, right, cy, radius * 1.25, true, col.accent2);
    } else {
      g.strokeStyle = col.accent2;
      g.lineWidth = Math.max(1, radius * 0.025);
      g.beginPath();
      g.moveTo(right - radius * 0.05, cy - radius * 0.12);
      g.lineTo(right - radius * 0.05, cy + radius * 0.12);
      g.moveTo(right + radius * 0.05, cy - radius * 0.12);
      g.lineTo(right + radius * 0.05, cy + radius * 0.12);
      g.stroke();
    }
  }
  strobeText(g, 'clockwise', left, h * 0.7, panel, size, col.fg);
  const caption = s.revealed ? directionName(result.direction)
    : s.taken ? 'picture ' + s.taken + ' of ' + p.samples : 'one at a time';
  strobeText(g, caption, right, h * 0.7, panel, size, col.fg);

  const slots = Math.max(3, Math.min(6, Math.round(4 * v.density)));
  const gap = w * 0.018;
  const sw = (w - pad * 2 - gap * (slots - 1)) / slots;
  const top = h * 0.82;
  const sh = h * 0.105;
  const first = Math.max(0, s.index - slots + 1);
  for (let i = 0; i < slots; i++) {
    const x = pad + i * (sw + gap);
    const shot = first + i;
    const taken = s.taken > 0 && shot <= s.index;
    g.fillStyle = c.alpha(col.bg, 0.65);
    g.fillRect(x, top, sw, sh);
    g.strokeStyle = c.alpha(taken ? col.accent2 : col.muted, taken ? 0.65 : 0.3);
    g.lineWidth = 1;
    g.strokeRect(x, top, sw, sh);
    if (taken) {
      wheel(g, c, x + sw / 2, top + sh / 2, Math.min(sw, sh) * 0.39,
        s.teeth, phase + shot / s.pictures * TAU, col.accent2, 0.8);
    }
  }
}

function strobePreview(g, w, h, env, p) {
  strobeScene(g, w, h, env, p, {
    teeth: p.teeth[0], pictures: p.pictures, time: 0, index: 0, taken: 0, revealed: false
  }, env.variant);
}

function strobeFinding(teeth, pictures) {
  const r = apparent(teeth, pictures);
  const premise = 'The real wheel moved clockwise by 1/' + pictures + ' of a turn between pictures. ';
  if (r.direction === 'still') {
    return premise + 'That is exactly ' + r.whole + ' tooth gap' + (r.whole === 1 ? '' : 's')
      + ', so identical teeth land in identical places. The pictures stand still.';
  }
  if (r.direction === 'either') {
    return premise + 'The leftover jump is half a tooth gap. Either direction fits the pictures equally well.';
  }
  const fraction = (Math.abs(r.slip) * 100).toFixed(1).replace(/\.0$/, '');
  return premise + 'Ignore ' + r.whole + ' whole tooth gap' + (r.whole === 1 ? '' : 's')
    + ' and the pictures shift ' + fraction + '% of one gap '
    + (r.direction === 'backward' ? 'backwards' : 'clockwise') + '. The real wheel never reversed.';
}

function strobePiece(env, carriedPlan) {
  const p = carriedPlan || strobePlan(env);
  const duration = (p.samples - 1) * p.interval;
  const s = {
    teeth: p.teeth[0], pictures: p.pictures, guess: '', time: 0,
    index: 0, taken: 0, running: false, waited: false, revealed: false, halfway: false
  };
  function draw(c) {
    strobeScene(c.g, c.w, c.h, c, p, s, env.variant);
  }
  function setExposure() {
    s.index = Math.min(p.samples - 1, Math.floor((s.time + 0.000001) / p.interval));
    s.taken = s.index + 1;
  }
  return {
    title: strobeTitle(p),
    brief: 'The real wheel only turns clockwise. Choose its teeth and the number of pictures taken during one turn, predict what the pictures will seem to do, and play the ' + p.samples + '-picture roll. No lights blink: each picture stays visible until the next. Any prediction works.',
    aspect: '4 / 3',
    steps: [
      { id: 'teeth', ask: 'how many identical teeth', kind: 'choice', options: p.teeth.map((n) => ({ label: n + ' teeth', value: n })) },
      { id: 'pictures', ask: 'pictures taken during one clockwise turn', kind: 'range', min: 6, max: 20, step: 1, value: p.pictures, low: '6 pictures', high: '20 pictures' },
      { id: 'prediction', ask: 'which way will the pictures seem to turn?', kind: 'choice', options: DIRECTIONS },
      { id: 'play', ask: 'play the picture roll', kind: 'press', count: 1, label: 'play the roll' },
      { id: 'watch', ask: 'watch ' + p.samples + ' pictures', kind: 'wait', after: 'play' }
    ],
    start(c) {
      c.status(s.teeth + ' identical teeth, ' + s.pictures + ' pictures per turn. The left wheel is real motion; the right wheel holds each picture.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'teeth') {
        s.teeth = p.teeth.includes(Number(value)) ? Number(value) : p.teeth[0];
        c.status(s.teeth + ' identical teeth. One tooth gap is 1/' + s.teeth + ' of a turn.');
      }
      if (id === 'pictures') {
        s.pictures = Math.max(6, Math.min(20, Math.round(Number(value))));
        c.status(s.pictures + ' pictures per turn. The wheel advances clockwise by 1/' + s.pictures + ' of a turn between pictures.');
      }
      if (id === 'prediction') {
        s.guess = String(value);
        c.status('You expect the pictures to look ' + directionName(s.guess) + '. You can still change your prediction.');
      }
      if (id === 'play') {
        s.running = true;
        s.time = 0;
        s.index = 0;
        s.taken = 1;
        s.halfway = false;
        c.status(c.reduced ? 'The picture roll will appear without movement.'
          : 'The real wheel goes clockwise. Follow the right wheel between pictures.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.running && !c.done) {
        s.time = c.reduced ? duration : Math.min(duration, s.time + dt);
        setExposure();
        if (!s.waited) c.progress('watch', s.time / duration);
        if (!s.halfway && s.time >= duration / 2 && s.time < duration) {
          s.halfway = true;
          c.status('Half the roll has played. Both views are of the same clockwise wheel.');
        }
        if (s.time >= duration) {
          s.running = false;
          c.status('The ' + p.samples + ' pictures are on the roll. Your remaining choices can still change the finding.');
          if (!s.waited) {
            s.waited = true;
            c.satisfy('watch');
          }
        }
      }
      draw(c);
    },
    end(c) {
      s.running = false;
      s.time = duration;
      s.revealed = true;
      setExposure();
      const result = apparent(s.teeth, s.pictures);
      c.status(strobeFinding(s.teeth, s.pictures) + ' '
        + (s.guess === result.direction ? 'You called it.' : 'You expected ' + directionName(s.guess) + '.'));
      draw(c);
    }
  };
}

export default {
  id: 'pulse-loom',
  needsSky: false,
  paint(g, w, h, env) {
    if (isStrobe(env)) {
      strobePreview(g, w, h, env, strobePlan(env));
      return;
    }
    const p = plan(env);
    scene(g, w, h, env, p, p.wefts[0], p.shift, 0.55, [], false);
  },
  spark(env) {
    if (isStrobe(env)) {
      const p = strobePlan(env);
      return {
        title: strobeTitle(p),
        text: 'The real wheel only turns clockwise. Can its pictures stand still or seem to turn backwards? Choose the teeth, predict the direction, and play the roll.',
        mono: 'one tooth gap  1/' + p.teeth[0] + ' of a turn\none picture    1/' + p.pictures + ' of a turn',
        aspect: '4 / 3',
        paint: (g, w, h, e) => strobePreview(g, w, h, e, p),
        of: p
      };
    }
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
  piece(env) {
    const photographed = carriedStrobe(env);
    if (photographed) return strobePiece(env, photographed);
    const woven = carried(env);
    if (woven) return weavingPiece(env, woven);
    return isStrobe(env) ? strobePiece(env) : weavingPiece(env);
  }
};
