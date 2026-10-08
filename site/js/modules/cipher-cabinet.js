/* The cipher cabinet: notes from a house whose rooms move, locked two ways. As a card it is a
   locked note (paint, spark); as a piece it is one of the two puzzles below, and the card it was
   opened from says which. See js/feed.js for what a module is and js/stage.js for what a piece
   is.

   Two puzzles, both deduction:

     the letter wheel  A note shifted round the alphabet, and sometimes written backwards first.
                       The wheel shows which letter stands for which at the setting the visitor
                       chooses -- it never reads the note out -- and one word of the note is
                       underlined. A ledger beside it counts the line's commonest letters, so
                       the setting can be reasoned to rather than tried: the tallest bar nearly
                       always wants to read E. Find the setting and the direction that open the
                       note, and read that word through the wheel. A wrong check says how many
                       of its letters are right and no more; a hint shows one letter of it.
     the turning key   A six-by-six board of letters and a nine-hole key. At the right notch,
                       turned the right way, the key's four views read the note out in order,
                       nine letters at a time; at any other, they read nothing. Find the notch
                       and the turn, and read the note's first word. The hints, at a price, are
                       the notch and then the turn.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the case, the note, the key, the mirror, the holes -- and piece(env) opens on that
   rather than rolling another. */

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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/* ---- shared arithmetic ---------------------------------------------------------------------- */

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

function reversed(text) {
  return text.split('').reverse().join('');
}

// The letters of a line, commonest first: what a code-breaker counts before touching the wheel.
function tally(text) {
  const counts = {};
  for (const ch of text) if (ch >= 'A' && ch <= 'Z') counts[ch] = (counts[ch] || 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((ch) => ({ letter: ch, count: counts[ch] }));
}

// The word of a note the wheel asks for: its longest, the first of them if two tie.
function keyWordOf(note) {
  let best = '';
  for (const word of note.split(' ')) if (word.length > best.length) best = word;
  return best;
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

// How many letters of `guess` stand where `word` has them: the one thing a wrong check says.
function lettersRight(guess, word) {
  const g = String(guess || '').toUpperCase().replace(/[^A-Z]/g, '');
  let right = 0;
  for (let i = 0; i < word.length && i < g.length; i++) if (g[i] === word[i]) right += 1;
  return right;
}

function cleaned(value) {
  return String(value == null ? '' : value).toUpperCase().replace(/[^A-Z]/g, '');
}

/* ---- the letter wheel ----------------------------------------------------------------------- */

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
  if (!p || p.family === 'turning-grille' || typeof p.case !== 'string' || !/^[0-9A-Z]{7}$/.test(p.case)
      || !Number.isInteger(p.note) || p.note < 0 || p.note >= NOTES.length
      || !Number.isInteger(p.key) || p.key < 1 || p.key > 25
      || typeof p.mirror !== 'boolean') return null;
  return { case: p.case, note: p.note, key: p.key, mirror: p.mirror };
}

// The note as it was received: written backwards if the house is in that mood, then shifted.
function locked(p) {
  const text = p.mirror ? reversed(NOTES[p.note]) : NOTES[p.note];
  return turn(text, p.key);
}

// Where the key word sits in the received line, as [first, last] character positions.
function keySpan(p) {
  const note = NOTES[p.note];
  const word = keyWordOf(note);
  const at = note.indexOf(word);
  if (!p.mirror) return [at, at + word.length - 1];
  const end = note.length - 1 - at;
  return [end - word.length + 1, end];
}

function blank() {
  return { shift: 0, reverse: false, guess: '', hints: [], reveal: false, open: 0, time: 0 };
}

function wheelTitle(p) {
  return 'letter ' + p.case + ': the wheel';
}

function wheelScene(g, w, h, c, p, state, variant, time) {
  const v = variant || PLAIN;
  const colors = c.colors;
  const received = locked(p);
  const note = NOTES[p.note];
  const word = keyWordOf(note);
  const span = keySpan(p);
  const m = Math.min(w, h);
  const roomy = h >= 300 && w >= 420; // a scene with room for a legend and a wider wheel
  const size = Math.max(9, Math.min(18, Math.round(m * 0.058)));
  const small = Math.max(8, Math.round(size * 0.8));
  const radius = Math.min(w * 0.19, h * (roomy ? 0.2 : 0.17)) * Math.min(1.1, Math.max(0.9, v.scale));
  const middle = h * (roomy ? 0.52 : 0.5);
  background(g, w, h, c);

  g.fillStyle = c.alpha(colors.accent, 0.12);
  for (let i = 0, count = Math.max(7, Math.round(18 * v.density)); i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.3) % 1) * w, ((i * 0.7548777) % 1) * h, 1, 1);
  }
  g.strokeStyle = c.alpha(colors.muted, 0.38);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(w * 0.06, h * 0.13);
  g.lineTo(w * 0.94, h * 0.13);
  g.moveTo(w * 0.06, h * 0.75);
  g.lineTo(w * 0.94, h * 0.75);
  g.stroke();

  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.fillStyle = colors.accent2;
  g.fillText('RECEIVED / ' + p.case, w * 0.06, h * 0.08);
  // The received line, the key word underlined letter by letter so it can be found again. The
  // lines take what room there is between the rule and the wheel.
  g.textAlign = 'center';
  g.font = '600 ' + size + 'px ui-monospace, monospace';
  const lines = rows(received, Math.max(8, Math.floor((w * 0.88) / (size * 0.66))));
  const lineStep = Math.min(size * 1.16, (middle - radius * 1.12 - h * 0.17) / Math.max(1, lines.length));
  let at = 0;
  lines.forEach((line, index) => {
    const y = h * 0.17 + size * 0.5 + index * lineStep;
    const width = g.measureText(line).width;
    const step = width / Math.max(1, line.length);
    const x0 = w / 2 - width / 2;
    for (let i = 0; i < line.length; i++) {
      const pos = at + i;
      const inWord = pos >= span[0] && pos <= span[1];
      g.fillStyle = inWord ? colors.accent2 : colors.fg;
      g.fillText(line[i], x0 + step * (i + 0.5), y);
      if (inWord) {
        g.fillStyle = c.alpha(colors.accent2, 0.7);
        g.fillRect(x0 + step * i + step * 0.12, y + size * 0.62, step * 0.76, Math.max(1, size * 0.08));
      }
    }
    at += line.length + 1;
  });

  // The wheel: the received alphabet round the outside, the plain alphabet round the inside,
  // turned by the shift the visitor has set. It shows which letter stands for which; it never
  // reads the note out.
  const glow = c.reduced ? 0.5 : (1 + Math.sin(time * 1.7)) / 2;
  g.strokeStyle = c.alpha(colors.accent2, 0.45 + glow * 0.3);
  g.lineWidth = Math.max(1, radius * 0.04);
  g.beginPath();
  g.arc(w / 2, middle, radius, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = c.alpha(colors.accent, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(w / 2, middle, radius * 0.7, 0, Math.PI * 2);
  g.stroke();
  const outerSize = Math.max(7, Math.round(radius * 0.16));
  const innerSize = Math.max(6, Math.round(radius * 0.13));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 - Math.PI / 2;
    g.font = '600 ' + outerSize + 'px ui-monospace, monospace';
    g.fillStyle = colors.fg;
    g.fillText(ALPHABET[i], w / 2 + Math.cos(a) * radius * 0.86, middle + Math.sin(a) * radius * 0.86);
    const plain = (i - state.shift + 26) % 26;
    g.font = '600 ' + innerSize + 'px ui-monospace, monospace';
    g.fillStyle = c.alpha(colors.accent2, 0.95);
    g.fillText(ALPHABET[plain], w / 2 + Math.cos(a) * radius * 0.56, middle + Math.sin(a) * radius * 0.56);
  }
  g.font = '600 ' + Math.max(8, Math.round(radius * 0.16)) + 'px ui-monospace, monospace';
  g.fillStyle = colors.accent2;
  g.fillText(String(state.shift).padStart(2, '0'), w / 2, middle - radius * 0.1);
  g.font = '500 ' + Math.max(7, Math.round(radius * 0.13)) + 'px ui-monospace, monospace';
  g.fillText(state.reverse ? '<<' : '>>', w / 2, middle + radius * 0.12);
  if (roomy) {
    // The letter ledger beside the wheel: the commonest letters of the received line, and what
    // each one stands for at this setting. The tallest bar nearly always wants to read E, which is
    // how the setting is found without trying all twenty-six. It draws only where it fits clear of
    // the ring: a stretched frame can leave no room, and a column across the letters would be
    // worse than none.
    g.font = '500 ' + small + 'px ui-monospace, monospace';
    const column = w / 2 - radius * 1.1 - w * 0.06;
    if (column > small * 6) {
      const ledger = tally(received).slice(0, Math.max(3, Math.min(5, Math.floor(radius * 2 / (small * 1.6)))));
      const barMax = Math.max(small, column - small * 3.2);
      const readsAt = w * 0.06 + small * 1.5 + barMax + small * 0.5;
      const rowGap = Math.min(small * 1.5, (radius * 2) / ledger.length);
      g.textAlign = 'left';
      g.fillStyle = c.alpha(colors.muted, 0.9);
      g.fillText('counted', w * 0.06, middle - (ledger.length / 2) * rowGap - small * 0.8);
      g.fillText('reads', readsAt, middle - (ledger.length / 2) * rowGap - small * 0.8);
      ledger.forEach((entry, i) => {
        const y = middle + (i - (ledger.length - 1) / 2) * rowGap;
        const len = barMax * entry.count / ledger[0].count;
        const reads = turn(entry.letter, -state.shift);
        const lit = reads === 'E';
        g.fillStyle = colors.fg;
        g.fillText(entry.letter, w * 0.06, y);
        g.fillStyle = c.alpha(lit ? colors.accent2 : colors.accent, lit ? 0.85 : 0.5);
        g.fillRect(w * 0.06 + small * 1.5, y - small * 0.2, len, small * 0.4);
        g.fillStyle = lit ? colors.accent2 : colors.fg;
        g.fillText(reads, readsAt, y);
      });
    }
    const way = state.reverse ? 'read right to left' : 'read left to right';
    if (w / 2 + radius * 1.1 + g.measureText(way).width < w * 0.94) {
      g.textAlign = 'right';
      g.fillStyle = c.alpha(colors.muted, 0.9);
      g.fillText(way, w * 0.94, middle);
    }
    g.textAlign = 'center';
  }

  // The word, as typed, letter by letter in the cells the note's word fills; hints above.
  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.textAlign = 'left';
  g.fillStyle = colors.accent2;
  g.fillText(state.reveal ? 'THE NOTE' : 'THE WORD, THROUGH THE WHEEL', w * 0.06, h * 0.79);
  g.textAlign = 'center';
  if (state.reveal) {
    g.fillStyle = c.alpha(colors.accent2, state.open * 0.12);
    g.fillRect(0, h * 0.76, w, h * 0.24);
    g.save();
    g.globalAlpha = state.open;
    g.font = '600 ' + size + 'px ui-monospace, monospace';
    g.fillStyle = colors.accent2;
    writeRows(g, note, w / 2, h * 0.88, w * 0.88, size);
    g.restore();
    return;
  }
  const cellH = Math.min(size * 1.3, h * 0.12);
  const cell = Math.min(cellH * 1.1, (w * 0.8) / word.length);
  const x0 = w / 2 - (cell * word.length) / 2;
  const top = h * 0.84;
  const guess = cleaned(state.guess);
  g.font = '600 ' + Math.round(cellH * 0.7) + 'px ui-monospace, monospace';
  for (let i = 0; i < word.length; i++) {
    const x = x0 + cell * i;
    g.strokeStyle = c.alpha(colors.muted, 0.6);
    g.lineWidth = 1;
    g.strokeRect(x + cell * 0.08, top, cell * 0.84, cellH);
    if (guess[i]) {
      g.fillStyle = colors.fg;
      g.fillText(guess[i], x + cell / 2, top + cellH * 0.52);
    }
    if (state.hints.includes(i)) {
      g.fillStyle = colors.accent2;
      g.font = '500 ' + small + 'px ui-monospace, monospace';
      g.fillText(word[i], x + cell / 2, top - small * 0.7);
      g.font = '600 ' + Math.round(cellH * 0.7) + 'px ui-monospace, monospace';
    }
  }
}

function wheelPiece(env) {
  const p = carried(env) || plan(env);
  const state = blank();
  const note = NOTES[p.note];
  const word = keyWordOf(note);
  const received = locked(p);
  const draw = (c) => wheelScene(c.g, c.w, c.h, c, p, state, env.variant, state.time);
  return {
    title: wheelTitle(p),
    brief: 'A working of the wheel. The note was shifted some way round the alphabet, and the house sometimes writes a line backwards first. The wheel shows which letter stands for which at the setting you choose; it never reads the note for you. The bars beside it count the line\'s commonest letters, and the tallest nearly always wants to read E. One word of the note is underlined.',
    goal: 'Find the wheel setting and the reading direction, and read the underlined word.',
    aspect: '4 / 3',
    checkLabel: 'try the lock',
    steps: [
      { id: 'wheel', ask: 'how far the wheel is turned', kind: 'number', min: 0, max: 25, step: 1, value: 0, unit: 'turns' },
      { id: 'direction', ask: 'which way the house wrote the line', kind: 'choice', options: [
        { label: 'left to right', value: 'forward' },
        { label: 'right to left', value: 'reverse' }
      ] },
      { id: 'word', ask: 'the underlined word, decoded', kind: 'word', length: word.length, placeholder: '_'.repeat(word.length) },
      { id: 'hint', ask: 'one letter of the word', kind: 'press', count: 1, label: 'show a letter', optional: true }
    ],
    solution: { wheel: p.key, direction: p.mirror ? 'reverse' : 'forward', word },
    check(c) {
      const shiftRight = Number(c.value('wheel')) === p.key;
      const wayRight = (c.value('direction') === 'reverse') === p.mirror;
      const typed = cleaned(c.value('word'));
      const wordRight = typed === word;
      if (shiftRight && wayRight && wordRight) return { solved: true, say: 'the lock turns: ' + note };
      const right = lettersRight(typed, word);
      const parts = [];
      if (!wordRight) parts.push(right === 0 ? 'no letter of the word is in its place' : (right === 1 ? 'one letter of the word is right' : WORDS[Math.min(right, 10)] + ' letters of the word are right'));
      if (!shiftRight && !wayRight) parts.push('the wheel and the direction are both off');
      else if (!shiftRight) parts.push('the wheel is not at the setting that opens it');
      else if (!wayRight) parts.push('the line is read the wrong way round');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('received: ' + received + '; the tallest bar beside the wheel nearly always wants to read E');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'wheel') {
        const position = Number(value);
        state.shift = Number.isFinite(position) ? Math.max(0, Math.min(25, Math.round(position))) : 0;
        c.status('at ' + state.shift + ' turns the outside letter A stands for ' + ALPHABET[(26 - state.shift) % 26]);
      }
      if (id === 'direction') {
        state.reverse = value === 'reverse';
        c.status('reading ' + (state.reverse ? 'right to left' : 'left to right'));
      }
      if (id === 'word') {
        state.guess = cleaned(value);
      }
      if (id === 'hint') {
        const next = [];
        for (let i = 0; i < word.length; i++) if (!state.hints.includes(i)) next.push(i);
        if (next.length) {
          const i = next[Math.floor(next.length / 2)];
          state.hints.push(i);
          c.hint();
          c.status('letter ' + (i + 1) + ' of the word is ' + word[i]);
        } else {
          c.status('every letter of the word is shown; the wheel setting follows from any one of them');
        }
      }
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
      c.status('the note reads: ' + note);
      draw(c);
    }
  };
}

/* ---- the turning key ------------------------------------------------------------------------ */

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
const TURNS = [
  { label: 'clockwise', value: 1 },
  { label: 'counterclockwise', value: -1 }
];

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

// The board: the note written through the key's four views, in order, from the right notch,
// turned the right way. The squares the note does not reach hold letters of their own, so a
// wrong route reads as letters too and not as blanks -- which is what makes the route a puzzle.
function grilleBoard(p) {
  const board = Array(SQUARES).fill(' ');
  const message = NOTES[p.note].replace(/ /g, '');
  let seed = 0;
  for (const ch of p.case) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  for (let view = 0; view < 4; view++) {
    openings(p, p.start + p.direction * view).forEach((index, hole) => {
      const at = view * HOLES + hole;
      if (at < message.length) board[index] = message[at];
      else {
        seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + at) >>> 0;
        board[index] = ALPHABET[seed % 26];
      }
    });
  }
  return board;
}

function grilleBlank() {
  return { corner: 0, direction: 1, view: 0, guess: '', hints: 0, angle: 0, reveal: false, open: 0 };
}

function strip(p, board, corner, direction, view) {
  return openings(p, corner + direction * view).map((index) => board[index]).join('');
}

function turningWord(direction) {
  return direction === 1 ? 'clockwise' : 'counterclockwise';
}

function grilleScene(g, w, h, c, p, board, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const side = Math.min(w * 0.82, h * 0.6, Math.min(w * 0.78, h * 0.56) * v.scale);
  const cell = side / SIDE;
  const cx = w * (0.49 + v.turn * 0.02);
  const cy = h * (0.37 + v.turn * 0.02);
  const left = cx - side / 2;
  const top = cy - side / 2;
  const size = Math.max(9, Math.min(22, cell * 0.48));
  const small = Math.max(9, Math.min(16, m * 0.034));
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
    g.fillStyle = col.fg;
    g.fillText(board[index], x + cell / 2, y + cell / 2);
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

  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.textAlign = 'left';
  if (!s.reveal) {
    // The four views along the route the visitor has set, the one on the board marked.
    for (let view = 0; view < 4; view++) {
      g.fillStyle = view === s.view ? col.accent2 : col.fg;
      g.fillText((view + 1) + '  ' + strip(p, board, s.corner, s.direction, view), w * 0.08, h * (0.72 + view * 0.052));
    }
    g.fillStyle = col.muted;
    g.fillText('from the ' + NOTCHES[s.corner].label + ', ' + turningWord(s.direction)
      + (s.hints >= 1 ? ' / hint: it starts at the ' + NOTCHES[p.start].label : '')
      + (s.hints >= 2 ? ', ' + turningWord(p.direction) : ''), w * 0.08, h * 0.935);
    g.textAlign = 'right';
    g.fillStyle = col.accent2;
    g.fillText('first word: ' + (cleaned(s.guess) || '_'), w * 0.92, h * 0.935);
  } else {
    g.fillStyle = col.accent2;
    g.fillText('THE NOTE', w * 0.08, h * 0.74);
    g.save();
    g.globalAlpha = s.open;
    g.textAlign = 'center';
    g.fillStyle = col.fg;
    writeRows(g, NOTES[p.note], w / 2, h * 0.82, w * 0.84, small);
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
  const note = NOTES[p.note];
  const first = note.split(' ')[0];
  const draw = (c) => grilleScene(c.g, c.w, c.h, c, p, board, s, env.variant);
  return {
    title: grilleTitle(p),
    brief: 'One key, turned four ways. Thirty-six letters and a nine-hole key. From one notch, turned one way, the key\'s four views read the note out nine letters at a time, left to right and then down; from any other they read noise. The strips below the board follow the route you set.',
    goal: 'Find the starting notch and the turn, and read the note\'s first word.',
    aspect: '1 / 1',
    checkLabel: 'try the key',
    steps: [
      { id: 'corner', ask: 'where the key starts', kind: 'choice', options: NOTCHES },
      { id: 'direction', ask: 'which way the key turns', kind: 'choice', options: TURNS },
      { id: 'view', ask: 'turn the key to the next view', kind: 'press', count: 1, label: 'turn the key', optional: true },
      { id: 'word', ask: 'the note\'s first word', kind: 'word', length: first.length, placeholder: '_'.repeat(first.length) },
      { id: 'hint', ask: 'the notch, then the turn', kind: 'press', count: 1, label: 'show me', optional: true }
    ],
    solution: { corner: p.start, direction: p.direction, word: first },
    check(c) {
      const cornerRight = Number(c.value('corner')) === p.start;
      const wayRight = Number(c.value('direction')) === p.direction;
      const typed = cleaned(c.value('word'));
      const wordRight = typed === first;
      if (cornerRight && wayRight && wordRight) return { solved: true, say: 'the key fits: ' + note };
      const parts = [];
      if (!wordRight) {
        const right = lettersRight(typed, first);
        parts.push(right === 0 ? 'no letter of the first word is in its place' : (right === 1 ? 'one letter of the first word is right' : WORDS[Math.min(right, 10)] + ' letters of the first word are right'));
      }
      if (!cornerRight && !wayRight) parts.push('the notch and the turn are both off');
      else if (!cornerRight) parts.push('the key does not start there');
      else if (!wayRight) parts.push('the key turns the other way');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('four views from the ' + NOTCHES[s.corner].label + ', ' + turningWord(s.direction));
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'corner') {
        const corner = Number(value);
        if (Number.isInteger(corner) && corner >= 0 && corner <= 3) s.corner = corner;
        c.status('the key starts at the ' + NOTCHES[s.corner].label + '; view ' + (s.view + 1) + ' reads ' + strip(p, board, s.corner, s.direction, s.view));
      }
      if (id === 'direction') {
        const direction = Number(value);
        if (direction === 1 || direction === -1) s.direction = direction;
        c.status('the key turns ' + turningWord(s.direction) + '; view ' + (s.view + 1) + ' reads ' + strip(p, board, s.corner, s.direction, s.view));
      }
      if (id === 'view') {
        s.view = (s.view + 1) % 4;
        c.status('view ' + (s.view + 1) + ' of four reads ' + strip(p, board, s.corner, s.direction, s.view));
      }
      if (id === 'word') s.guess = cleaned(value);
      if (id === 'hint') {
        if (s.hints < 2) {
          s.hints += 1;
          c.hint();
          c.status(s.hints === 1 ? 'the key starts at the ' + NOTCHES[p.start].label : 'and it turns ' + turningWord(p.direction));
        } else {
          c.status('both hints are shown; read the four views and type the first word');
        }
      }
      if (c.reduced) s.angle = quarter(s.corner + s.direction * s.view) * QUARTER;
      draw(c);
    },
    frame(t, dt, c) {
      const goal = quarter(s.corner + s.direction * s.view) * QUARTER;
      const difference = ((goal - s.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      s.angle = c.reduced ? goal : s.angle + difference * Math.min(1, Math.max(0, dt) * 12);
      if (Math.abs(difference) < 0.0001) s.angle = goal;
      if (s.reveal) s.open = c.reduced ? 1 : Math.min(1, s.open + Math.max(0, dt) * 1.5);
      draw(c);
    },
    end(c) {
      s.reveal = true;
      if (c.reduced) s.open = 1;
      c.status('the note reads: ' + note + '. One key exposes every square exactly once across four views.');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

export default {
  id: 'cipher-cabinet',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsGrille(env)) grillePreview(g, w, h, env, grillePlan(env));
    else wheelScene(g, w, h, env, plan(env), blank(), env.variant, 0);
  },
  animate(g, w, h, env, t) {
    if (dealsGrille(env)) return;
    wheelScene(g, w, h, env, plan(env), blank(), env.variant, t);
  },
  spark(env) {
    if (dealsGrille(env)) {
      const p = grillePlan(env);
      return {
        title: grilleTitle(p),
        text: 'One notch and one turn read the note out through the key; every other route reads noise. Find the route and the note\'s first word.',
        mono: '36 squares / 9 holes / 4 views',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => grillePreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = plan(env);
    return {
      title: wheelTitle(p),
      mono: locked(p),
      text: 'A locked note, shifted round the alphabet and maybe written backwards first. Count its commonest letters to find the setting, then read the underlined word through the wheel.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => wheelScene(g, w, h, cardEnv, p, blank(), cardEnv.variant, 0),
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
