/* Two ways to recover a note from the moving house: a letter wheel, or a rotating stencil.
   The stencil chooses one square from each four-square rotation orbit, so its four views
   uncover the whole board exactly once. Cards carry their exact key and note into the piece;
   changing a reading route reinterprets the copied strips without losing any progress. */

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

function background(g, w, h, env) {
  const ground = g.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, env.colors.bg2);
  ground.addColorStop(1, env.colors.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
}

function scene(g, w, h, c, p, state, variant, time) {
  const v = variant || PLAIN;
  const colors = c.colors;
  const received = locked(p);
  const size = Math.max(9, Math.min(18, Math.round(w * 0.047)));
  const small = Math.max(8, Math.round(size * 0.83));
  const middle = h * 0.49;
  const radius = Math.min(Math.min(w, h) * 0.18, Math.min(w, h) * 0.13 * v.scale);
  background(g, w, h, c);

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

function wheelPiece(env) {
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

const SIDE = 6;
const SQUARES = SIDE * SIDE;
const HOLES = SQUARES / 4;
const QUARTER = Math.PI / 2;
const NOTCHES = [
  { label: 'top notch', value: 0 },
  { label: 'right notch', value: 1 },
  { label: 'bottom notch', value: 2 },
  { label: 'left notch', value: 3 }
];
const TURNING_BRIEF = 'Recover a hidden note with a nine-hole key: choose its starting notch and turning direction, tap for a letter of help, copy the four views, then unseal the note to compare. Any route works; your copies follow changes you make to it.';

function dealsGrille(env) {
  return (env.seed >>> 0) % 3 === 1;
}

function quarter(value) {
  return ((value % 4) + 4) % 4;
}

function rotated(index, amount) {
  let x = index % SIDE;
  let y = Math.floor(index / SIDE);
  for (let i = 0, turns = quarter(amount); i < turns; i++) {
    [x, y] = [SIDE - 1 - y, x];
  }
  return y * SIDE + x;
}

function orbit(index) {
  return Math.min(index, rotated(index, 1), rotated(index, 2), rotated(index, 3));
}

function openings(p, amount) {
  return p.holes.map((index) => rotated(index, amount)).sort((a, b) => a - b);
}

function grillePlan(env) {
  const holes = [];
  const used = new Set();
  for (let index = 0; index < SQUARES; index++) {
    const group = orbit(index);
    if (used.has(group)) continue;
    used.add(group);
    holes.push(rotated(group, env.int(0, 3)));
  }
  return {
    family: 'turning-grille',
    case: (env.seed >>> 0).toString(36).toUpperCase().padStart(7, '0'),
    note: env.int(0, NOTES.length - 1),
    start: env.int(0, 3),
    direction: env.chance(0.5) ? 1 : -1,
    holes
  };
}

function carriedGrille(env) {
  const p = env.card && env.card.of;
  if (!p || p.family !== 'turning-grille'
      || typeof p.case !== 'string' || !/^[0-9A-Z]{7}$/.test(p.case)
      || !Number.isInteger(p.note) || p.note < 0 || p.note >= NOTES.length
      || NOTES[p.note].length > SQUARES
      || !Number.isInteger(p.start) || p.start < 0 || p.start > 3
      || (p.direction !== 1 && p.direction !== -1)
      || !Array.isArray(p.holes) || p.holes.length !== HOLES
      || !p.holes.every((index) => Number.isInteger(index) && index >= 0 && index < SQUARES)
      || new Set(p.holes.map(orbit)).size !== HOLES) return null;
  return {
    family: p.family, case: p.case, note: p.note,
    start: p.start, direction: p.direction, holes: p.holes.slice()
  };
}

function grilleTitle(p) {
  return 'letter ' + p.case + ': the turning key';
}

function grilleBoard(p) {
  const board = Array(SQUARES).fill(' ');
  const message = NOTES[p.note].padEnd(SQUARES, ' ');
  for (let view = 0; view < 4; view++) {
    openings(p, p.start + p.direction * view).forEach((index, hole) => {
      board[index] = message[view * HOLES + hole];
    });
  }
  return board;
}

function grilleBlank() {
  return { corner: 0, direction: 1, copied: 0, hint: -1, angle: 0, reveal: false, open: 0 };
}

function currentQuarter(s) {
  return quarter(s.corner + s.direction * Math.min(s.copied, 3));
}

function strips(p, board, s) {
  const result = [];
  for (let view = 0; view < s.copied; view++) {
    result.push(openings(p, s.corner + s.direction * view).map((index) => board[index]).join(''));
  }
  return result;
}

function copiedReading(p, board, s) {
  if (!s.copied) return 'No strips have been copied yet.';
  const text = strips(p, board, s).join('').replace(/\s+/g, ' ').trim();
  return 'Copied so far: ' + (text ? '"' + text + '".' : 'spaces only.');
}

function turningWord(direction) {
  return direction === 1 ? 'clockwise' : 'counterclockwise';
}

function grilleScene(g, w, h, c, p, board, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const side = Math.min(w * 0.82, h * 0.64, Math.min(w * 0.78, h * 0.59) * v.scale);
  const cell = side / SIDE;
  const cx = w * (0.49 + v.turn * 0.02);
  const cy = h * (0.385 + v.turn * 0.03);
  const left = cx - side / 2;
  const top = cy - side / 2;
  const size = Math.max(9, Math.min(22, cell * 0.48));
  const small = Math.max(9, Math.min(17, m * 0.037));
  background(g, w, h, c);
  g.save();

  g.fillStyle = c.alpha(col.accent, 0.15);
  for (let i = 0, count = Math.max(8, Math.round(28 * v.density)); i < count; i++) {
    const x = ((i * 0.6180339 + v.turn * 0.4) % 1) * w;
    const y = ((i * 0.7548777 + v.turn * 0.1) % 1) * h;
    g.fillRect(x, y, Math.max(1, v.scale), Math.max(1, v.scale));
  }

  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = col.accent2;
  g.fillText(s.reveal ? 'ONE KEY / FOUR VIEWS' : 'KEY / ' + p.case, w / 2, h * 0.045);

  g.font = '600 ' + size + 'px ui-monospace, monospace';
  for (let index = 0; index < SQUARES; index++) {
    const x = left + index % SIDE * cell;
    const y = top + Math.floor(index / SIDE) * cell;
    g.fillStyle = c.mix(col.bg, col.bg2, index % 2 ? 0.4 : 0.55);
    g.fillRect(x, y, cell, cell);
    g.strokeStyle = c.alpha(col.muted, 0.45);
    g.lineWidth = 1;
    g.strokeRect(x, y, cell, cell);
    if (board[index] === ' ') {
      g.fillStyle = col.muted;
      g.beginPath();
      g.arc(x + cell / 2, y + cell / 2, Math.max(1, cell * 0.035), 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = col.fg;
      g.fillText(board[index], x + cell / 2, y + cell / 2);
    }
  }

  // The holes are actual holes in one rotating mask; the board underneath never turns.
  g.save();
  g.translate(cx, cy);
  g.rotate(s.angle);
  g.globalAlpha = s.reveal ? 1 - s.open : 1;
  g.beginPath();
  g.rect(-side / 2, -side / 2, side, side);
  const inset = cell * 0.09;
  for (const index of p.holes) {
    g.rect(-side / 2 + index % SIDE * cell + inset,
      -side / 2 + Math.floor(index / SIDE) * cell + inset,
      cell - inset * 2, cell - inset * 2);
  }
  g.fillStyle = c.mix(col.bg, col.bg2, 0.3);
  g.fill('evenodd');
  g.strokeStyle = col.accent;
  g.lineWidth = Math.max(1, cell * 0.035);
  g.strokeRect(-side / 2, -side / 2, side, side);
  for (const index of p.holes) {
    g.strokeRect(-side / 2 + index % SIDE * cell + inset,
      -side / 2 + Math.floor(index / SIDE) * cell + inset,
      cell - inset * 2, cell - inset * 2);
  }
  g.restore();

  const notchRadius = side * 0.55;
  g.strokeStyle = col.muted;
  g.lineWidth = 1.5;
  g.beginPath();
  for (let notch = 0; notch < 4; notch++) {
    const a = (notch - 1) * QUARTER;
    g.moveTo(cx + Math.cos(a) * notchRadius, cy + Math.sin(a) * notchRadius);
    g.lineTo(cx + Math.cos(a) * (notchRadius + cell * 0.12), cy + Math.sin(a) * (notchRadius + cell * 0.12));
  }
  g.stroke();
  const a = s.angle - QUARTER;
  const px = cx + Math.cos(a) * notchRadius;
  const py = cy + Math.sin(a) * notchRadius;
  const pointer = Math.max(3, cell * 0.16);
  g.fillStyle = col.accent2;
  g.beginPath();
  g.moveTo(px - Math.cos(a) * pointer, py - Math.sin(a) * pointer);
  g.lineTo(px + Math.cos(a) * pointer - Math.sin(a) * pointer, py + Math.sin(a) * pointer + Math.cos(a) * pointer);
  g.lineTo(px + Math.cos(a) * pointer + Math.sin(a) * pointer, py + Math.sin(a) * pointer - Math.cos(a) * pointer);
  g.closePath();
  g.fill();

  if (s.hint >= 0 && !s.reveal) {
    const x = left + (s.hint % SIDE + 0.5) * cell;
    const y = top + (Math.floor(s.hint / SIDE) + 0.5) * cell;
    g.strokeStyle = col.accent2;
    g.lineWidth = Math.max(1.5, cell * 0.055);
    g.setLineDash([3, 3]);
    g.beginPath();
    g.arc(x, y, cell * 0.4, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.textAlign = 'left';
  g.fillStyle = col.fg;
  if (!s.reveal) {
    const copied = strips(p, board, s);
    for (let view = 0; view < 4; view++) {
      g.fillStyle = view < s.copied ? col.fg : col.muted;
      g.fillText((view + 1) + '  ' + (copied[view] === undefined ? 'not copied' : copied[view].replace(/ /g, '.')),
        w * 0.08, h * (0.765 + view * 0.059));
    }
  } else {
    g.fillStyle = col.accent2;
    g.fillText('THE NOTE', w * 0.08, h * 0.765);
    g.save();
    g.globalAlpha = s.open;
    g.textAlign = 'center';
    g.fillStyle = col.fg;
    writeRows(g, NOTES[p.note], w / 2, h * 0.845, w * 0.84, small);
    g.restore();
  }
  g.restore();
}

function grillePreview(g, w, h, env, p) {
  grilleScene(g, w, h, env, p, grilleBoard(p), grilleBlank(), env.variant);
}

function grillePiece(env, carriedPlan) {
  const p = carriedPlan || grillePlan(env);
  const board = grilleBoard(p);
  const s = grilleBlank();
  const draw = (c) => grilleScene(c.g, c.w, c.h, c, p, board, s, env.variant);
  return {
    title: grilleTitle(p),
    brief: TURNING_BRIEF,
    aspect: '1 / 1',
    steps: [
      { id: 'corner', ask: 'where the key starts', kind: 'choice', options: NOTCHES },
      { id: 'direction', ask: 'which way the key turns', kind: 'choice', options: [
        { label: 'clockwise', value: 1 },
        { label: 'counterclockwise', value: -1 }
      ] },
      { id: 'hint', ask: 'tap anywhere for one letter of help', kind: 'tap', label: 'show a hole for me', after: 'corner' },
      { id: 'copy', ask: 'copy the four views', kind: 'press', count: 4, label: 'copy and turn' },
      { id: 'seal', ask: 'unseal the house note', kind: 'press', count: 1, label: 'unseal the note', after: 'copy' }
    ],
    start(c) {
      c.status('Thirty-six squares, nine holes. Read each view left to right, then down; a dot is a space. The gold pointer marks the key notch. Choose a starting notch and a direction, then copy four views.');
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'corner') {
        const corner = Number(value);
        if (!Number.isInteger(corner) || corner < 0 || corner > 3) {
          c.status('Choose one of the four starting notches.');
          return;
        }
        s.corner = corner;
        c.status('The key starts at the ' + NOTCHES[s.corner].label + '. ' + copiedReading(p, board, s));
      }
      if (id === 'direction') {
        const direction = Number(value);
        if (direction !== 1 && direction !== -1) {
          c.status('Choose clockwise or counterclockwise.');
          return;
        }
        s.direction = direction;
        c.status('The key turns ' + turningWord(s.direction) + '. ' + copiedReading(p, board, s));
      }
      if (id === 'copy') {
        const count = Number(value);
        if (!Number.isInteger(count) || count < 1) {
          c.status('Press copy and turn to copy a view.');
          return;
        }
        s.copied = Math.min(4, Math.max(s.copied, count));
        c.status('View ' + s.copied + ' of four copied. ' + copiedReading(p, board, s)
          + (s.copied < 4 ? ' The key turns to the ' + NOTCHES[currentQuarter(s)].label + '.'
            : ' All four strips are here. You can still change the route before unsealing the note.'));
      }
      if (id === 'seal') {
        c.status('The seal is loosened. Set any remaining choices to compare your reading with the house note.');
      }
      if (c.reduced) s.angle = currentQuarter(s) * QUARTER;
      draw(c);
    },
    tap(x, y, c) {
      if (c.done) return;
      const first = openings(p, p.start);
      let chosen = 0;
      let nearest = Infinity;
      first.forEach((index, hole) => {
        const dx = (index % SIDE + 0.5) / SIDE - x;
        const dy = (Math.floor(index / SIDE) + 0.5) / SIDE - y;
        const distance = dx * dx + dy * dy;
        if (distance < nearest) {
          nearest = distance;
          chosen = hole;
        }
      });
      s.hint = first[chosen];
      const letter = board[s.hint];
      c.progress('hint', 1);
      c.status('A clue: the house note starts at the ' + NOTCHES[p.start].label
        + '. In that first view, row ' + (Math.floor(s.hint / SIDE) + 1)
        + ', column ' + (s.hint % SIDE + 1) + ' gives '
        + (letter === ' ' ? 'a space' : 'the letter ' + letter)
        + ', opening ' + (chosen + 1) + ' of nine. Try both turning directions to read what follows.');
      c.satisfy('hint');
      draw(c);
    },
    frame(t, dt, c) {
      const target = currentQuarter(s) * QUARTER;
      const difference = ((target - s.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      s.angle = c.reduced ? target : s.angle + difference * Math.min(1, Math.max(0, dt) * 12);
      if (Math.abs(difference) < 0.0001) s.angle = target;
      if (s.reveal) s.open = c.reduced ? 1 : Math.min(1, s.open + Math.max(0, dt) * 1.5);
      draw(c);
    },
    end(c) {
      s.reveal = true;
      if (c.reduced) s.open = 1;
      const found = s.corner === p.start && s.direction === p.direction;
      c.status('The note reads: ' + NOTES[p.note] + '. '
        + (found ? 'You found its route. ' : 'It starts at the ' + NOTCHES[p.start].label + ' and turns ' + turningWord(p.direction) + '. ')
        + 'One key exposes every square exactly once across four views. The letters never moved; only the holes did.');
      draw(c);
    }
  };
}

export default {
  id: 'cipher-cabinet',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsGrille(env)) grillePreview(g, w, h, env, grillePlan(env));
    else scene(g, w, h, env, plan(env), blank(), env.variant, 0);
  },
  animate(g, w, h, env, t) {
    if (dealsGrille(env)) return;
    scene(g, w, h, env, plan(env), blank(), env.variant, t);
  },
  spark(env) {
    if (dealsGrille(env)) {
      const p = grillePlan(env);
      return {
        title: grilleTitle(p),
        text: TURNING_BRIEF,
        mono: '36 squares / 9 holes / 4 views',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => grillePreview(g, w, h, cardEnv, p),
        of: p
      };
    }
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
  piece(env) {
    const grille = carriedGrille(env);
    if (grille) return grillePiece(env, grille);
    if (carried(env)) return wheelPiece(env);
    return dealsGrille(env) ? grillePiece(env) : wheelPiece(env);
  }
};
