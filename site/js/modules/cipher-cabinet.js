const NOTES = [
  'THE BLUE ROOM HAS NO CORNERS',
  'THE STAIRS END WHERE THEY BEGIN',
  'SOMEONE FOLDED THE EAST HALL',
  'THE WINDOW IS FULL OF WEATHER',
  'DO NOT COUNT THE EMPTY CHAIRS',
  'A SMALL DOOR OPENS INTO RAIN',
  'THE CLOCK IS INSIDE THE WALL',
  'THE LOAM HID A SECOND KEY',
  'A STAR FELL INTO THE DRAWER',
  'THE LAMP CASTS TWO SHADOWS',
  'THE MAP HAS ROOM FOR ANOTHER ROOM',
  'THE HOUSE IS WIDER IN THE DARK',
  'THE FLOOR HID A SECOND FLOOR',
  'A LANTERN IS WAITING BELOW',
  'THE ROOF IS BELOW THE CELLAR',
  'THE LAST NOTE WAS WRITTEN FIRST',
  'THE GARDEN IS BEHIND THE MIRROR',
  'THE CABINET HOLDS A SMALLER HOUSE',
  'THREE DOORS OPEN ONTO ONE ROOM',
  'THE EXIT IS WHERE YOU STARTED'
];

const INVITATION = 'Decode a note from a house whose rooms move: turn the letter wheel, try both reading directions, tap for a one-letter hint, then lift the shutter to check it.';
const PLAIN = { density: 1, scale: 1, turn: 0 };

function plan(env) {
  const seed = env.seed >>> 0;
  return {
    case: seed.toString(36).toUpperCase().padStart(7, '0'),
    note: seed % NOTES.length,
    key: 1 + ((Math.imul(seed ^ (seed >>> 16), 17) >>> 0) % 25),
    mirror: ((seed ^ (seed >>> 7)) & 1) === 1
  };
}

function carried(env) {
  const p = env.card && env.card.of;
  if (!p || typeof p.case !== 'string' || !/^[0-9A-Z]{7}$/.test(p.case)
      || !Number.isInteger(p.note) || p.note < 0 || p.note >= NOTES.length
      || !Number.isInteger(p.key) || p.key < 1 || p.key > 25
      || typeof p.mirror !== 'boolean') return null;
  return { case: p.case, note: p.note, key: p.key, mirror: p.mirror };
}

function turn(text, amount) {
  const shift = ((amount % 26) + 26) % 26;
  let result = '';
  for (const character of text) {
    const letter = character.charCodeAt(0) - 65;
    result += letter >= 0 && letter < 26
      ? String.fromCharCode(65 + (letter + shift) % 26) : character;
  }
  return result;
}

function locked(p) {
  const text = p.mirror ? NOTES[p.note].split('').reverse().join('') : NOTES[p.note];
  return turn(text, p.key);
}

function reading(p, state) {
  const line = turn(locked(p), -state.shift);
  return state.reverse ? line.split('').reverse().join('') : line;
}

function blank() {
  return { shift: 0, reverse: false, pin: -1, shutter: false, reveal: false, open: 0, time: 0 };
}

function rows(text, limit) {
  const result = [''];
  for (const word of text.split(' ')) {
    const last = result.length - 1;
    if (!result[last]) result[last] = word;
    else if (result[last].length + word.length + 1 <= limit) result[last] += ' ' + word;
    else result.push(word);
  }
  return result;
}

function writeRows(g, text, x, y, width, size) {
  const limit = Math.max(8, Math.floor(width / (size * 0.68)));
  rows(text, limit).forEach((line, index) => {
    g.fillText(line, x, y + index * size * 1.16);
  });
}

function scene(g, w, h, c, p, state, variant, time) {
  const v = variant || PLAIN;
  const colors = c.colors;
  const received = locked(p);
  const size = Math.max(9, Math.min(18, Math.round(w * 0.047)));
  const small = Math.max(8, Math.round(size * 0.83));
  const middle = h * 0.49;
  const radius = Math.min(Math.min(w, h) * 0.18, Math.min(w, h) * 0.13 * v.scale);
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, colors.bg2);
  ground.addColorStop(1, colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);

  g.fillStyle = c.alpha(colors.accent, 0.12);
  for (let i = 0, count = Math.max(7, Math.round(18 * v.density)); i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.3) % 1) * w, ((i * 0.7548777) % 1) * h, 1, 1);
  }
  g.strokeStyle = c.alpha(colors.muted, 0.38);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w * 0.06, h * 0.14);
  g.lineTo(w * 0.94, h * 0.14);
  g.moveTo(w * 0.06, h * 0.72);
  g.lineTo(w * 0.94, h * 0.72);
  g.stroke();

  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.fillStyle = colors.accent2;
  g.fillText('RECEIVED / ' + p.case, w * 0.06, h * 0.09);
  g.textAlign = 'center';
  g.font = '600 ' + size + 'px ui-monospace, monospace';
  g.fillStyle = colors.fg;
  writeRows(g, received, w / 2, h * 0.21, w * 0.88, size);

  const glow = c.reduced ? 0.5 : (1 + Math.sin(time * 1.7)) / 2;
  g.strokeStyle = c.alpha(colors.accent2, 0.45 + glow * 0.3);
  g.lineWidth = Math.max(1, radius * 0.065);
  g.beginPath();
  g.arc(w / 2, middle, radius, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = c.alpha(colors.accent, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0, count = Math.max(12, Math.round(26 * v.density)); i < count; i++) {
    const angle = (i / count + v.turn) * Math.PI * 2;
    g.moveTo(w / 2 + Math.cos(angle) * radius * 1.12, middle + Math.sin(angle) * radius * 1.12);
    g.lineTo(w / 2 + Math.cos(angle) * radius * 1.3, middle + Math.sin(angle) * radius * 1.3);
  }
  g.stroke();
  g.font = '600 ' + size + 'px ui-monospace, monospace';
  g.fillStyle = colors.accent2;
  g.fillText(String(state.shift).padStart(2, '0'), w / 2, middle - size * 0.42);
  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.fillText(state.reverse ? '<<' : '>>', w / 2, middle + size * 0.53);

  if (!state.reveal && state.pin >= 0) {
    const unturned = turn(received, -p.key);
    g.fillStyle = colors.accent2;
    g.fillText('HINT ' + received[state.pin] + ' > ' + unturned[state.pin], w / 2, h * 0.65);
  }
  g.textAlign = 'left';
  g.fillStyle = colors.accent2;
  g.fillText(state.reveal ? 'THE NOTE' : 'YOUR READING', w * 0.06, h * 0.765);
  g.textAlign = 'center';
  g.font = '600 ' + size + 'px ui-monospace, monospace';
  g.fillStyle = state.reveal ? colors.accent2 : colors.fg;
  if (state.reveal) {
    g.fillStyle = c.alpha(colors.accent2, state.open * 0.12);
    g.fillRect(0, h * 0.73, w, h * 0.27);
    g.fillStyle = colors.accent2;
    g.save();
    g.globalAlpha = state.open;
  }
  writeRows(g, state.reveal ? NOTES[p.note] : reading(p, state), w / 2, h * 0.84, w * 0.88, size);
  if (state.reveal) g.restore();
}

function piece(env) {
  const p = carried(env) || plan(env);
  const state = blank();
  const received = locked(p);
  const draw = (c) => scene(c.g, c.w, c.h, c, p, state, env.variant, state.time);
  return {
    title: 'letter ' + p.case,
    brief: INVITATION,
    aspect: '4 / 3',
    steps: [
      { id: 'direction', ask: 'which way to read the line', kind: 'choice', options: [
        { label: 'left to right', value: 'forward' },
        { label: 'right to left', value: 'reverse' }
      ] },
      { id: 'wheel', ask: 'turn the letter wheel', kind: 'range', min: 0, max: 25, step: 1, value: 0, low: '0 turns', high: '25 turns' },
      { id: 'hint', ask: 'tap the note for one letter of help', kind: 'tap', label: 'show a letter for me' },
      { id: 'shutter', ask: 'lift the shutter', kind: 'press', count: 1, label: 'lift the shutter' }
    ],
    start(c) {
      c.status('The received line is ' + received + '. Turn the wheel, choose a direction, or tap for a one-letter hint.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'direction') {
        if (value !== 'forward' && value !== 'reverse') {
          c.status('Choose a reading direction.');
          return;
        }
        state.reverse = value === 'reverse';
        c.status('Reading ' + (state.reverse ? 'right to left' : 'left to right') + ': ' + reading(p, state) + '.');
      }
      if (id === 'wheel') {
        const position = Number(value);
        if (!Number.isFinite(position)) {
          c.status('Set the wheel between 0 and 25 turns.');
          return;
        }
        state.shift = Math.max(0, Math.min(25, Math.round(position)));
        c.status('At ' + state.shift + ' turns, the lower line reads ' + reading(p, state) + '.');
      }
      if (id === 'shutter') {
        state.shutter = true;
        c.status('The shutter is unlatched. Set any choices still waiting to read the note.');
      }
      draw(c);
    },
    tap(x, y, c) {
      if (c.done) return;
      const positions = [];
      for (let i = 0; i < received.length; i++) {
        if (received[i] >= 'A' && received[i] <= 'Z') positions.push(i);
      }
      state.pin = positions[Math.min(positions.length - 1, Math.floor(Math.max(0, Math.min(0.999, x)) * positions.length))];
      const letter = turn(received, -p.key)[state.pin];
      c.progress('hint', 1);
      c.status('Letter ' + (state.pin + 1) + ': ' + received[state.pin] + ' should read ' + letter + '. Match it with the wheel, then check the direction.');
      c.satisfy('hint');
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) state.time += dt;
      if (state.reveal) state.open = c.reduced ? 1 : Math.min(1, state.open + Math.max(0, dt) * 1.5);
      draw(c);
    },
    end(c) {
      state.reveal = true;
      if (c.reduced) state.open = 1;
      const found = state.shift === p.key && state.reverse === p.mirror;
      c.status('The note reads: ' + NOTES[p.note] + '. ' + (found ? 'You found the reading.'
        : 'It opens at ' + p.key + ' turns, read ' + (p.mirror ? 'right to left' : 'left to right') + '.'));
      draw(c);
    }
  };
}

export default {
  id: 'cipher-cabinet',
  needsSky: false,
  paint(g, w, h, env) {
    scene(g, w, h, env, plan(env), blank(), env.variant, 0);
  },
  animate(g, w, h, env, t) {
    scene(g, w, h, env, plan(env), blank(), env.variant, t);
  },
  spark(env) {
    const p = plan(env);
    return {
      title: 'letter ' + p.case,
      mono: locked(p),
      text: INVITATION,
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => scene(g, w, h, cardEnv, p, blank(), cardEnv.variant, 0),
      of: p
    };
  },
  piece
};
