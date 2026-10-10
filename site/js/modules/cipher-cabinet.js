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
                       of its letters are right, and what the commonest letter reads at the
                       setting tried; a hint shows one letter of it.
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

/* How hard the visitor asked for their puzzles. The persona keeps one difficulty for the whole
   site (js/persona.js) and js/stage.js hands it to a piece on env.difficulty, 1 (gentle) to 5
   (fierce); a card's env carries none, so the middle of the dial stands in. A level buys `helps`
   -- how many things a piece will show when it is asked -- and `margin`, how far out a measured
   answer may be and still count. Read inside piece() only: the subject is the seed's. */
function asked(env) {
  const said = env && env.difficulty ? Number(env.difficulty.level) : NaN;
  const level = Number.isFinite(said) ? Math.max(1, Math.min(5, Math.round(said))) : 3;
  return { level, helps: 6 - level, margin: Math.max(0, 3 - level) };
}

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

/* ---- the rite: how this module moves ------------------------------------------------------- */

/* env.rite (ctx.rite inside a piece) is the piece's own roll of how it moves (js/variant.js;
   js/stage.js, "The rite"): one clean edge -- a slice at an angle, or a curve round a point of the
   box (a corner or the middle of a side), the piece's signature -- and the few treads every change
   climbs, always forward. Nothing in the cabinet moves along a formula, and nothing moves without a
   reason:

     at rest          the cabinet is waiting, so nothing in it moves: the ring holds one glow and
                      the dust lies where it settled. A card of the cabinet is a printed thing.
     a setting turned the wheel's inner alphabet clicks round the shortest way to the new setting in
                      rite.ratchet's even clicks, and everything the setting decides moves on those
                      same clicks: the setting's number and the ledger's readings are cut over at
                      the first, and the bar that comes to read E is lit click by click behind the
                      piece's edge while the one that stops reading E is cut away. The grille's key
                      clicks to its new view the same way, and with it the route, the four strips'
                      letters (cut over at the first click) and the mark behind the strip on the
                      board, which leaves one strip and comes over the next on the key's clicks. A
                      turn is one gesture: the thing turned and what it decides, on one stair.
     a thing said     -- the reading direction, a letter typed, the first word, a hint -- is cut
                      over to the new one at its roll's moment (rite.flicker), once, and stays.
     a cell shown     its letter: the cell's tint is cut in behind the edge up its own stair and
                      rests as two shades of its colour split by that edge through its middle
                      (cover, below), and the letter above it is cut on at the stair's first tread.
     a note solved    is cut in behind the edge up the stair: a band over the foot of the wheel, or
                      the foot of the board as the key lifts off it, with the note written in it
                      showing as the edge passes -- and the key goes the same way, the whole key
                      drawn through the part of it the edge still holds, shrinking tread by tread.

   Every change is read against the piece's own clock, which frame() advances: a change made at
   `since` has come came() of its way, which is 1 at once for a visitor who asked for less motion
   and for whatever stood there from the start (since < 0). A change made while another is under
   way moves from what is showing at that moment -- the alphabet a fraction of a letter round, a
   mark half come -- never from the setting it was heading for, so a turn sent back mid-way clicks
   back from where it stands, and a mark that was coming and is sent away shrinks from where it got
   to. What is showing is the scene's look (wheelLook, grilleLook): every value in the picture that
   a change moves, read off the clock. The scene draws from it, a change moves from it, and a frame
   whose look and size are the ones already on the canvas draws nothing (picture, below) -- so the
   cabinet draws once per tread while something moves, and not at all while nothing does. */

// The rite of a piece handed none (no env builder does this; a guard): every change already made,
// and a surface cut by a plain upright slice from its left side.
const STILL = {
  stair: () => 1, ratchet: () => 1, flicker: () => 1,
  region(g, x, y, w, h, k) {
    if (k > 0) g.rect(x, y, w * Math.min(1, k), h);
  },
  paint(g, x, y, w, h, k, style) {
    if (k <= 0) return;
    if (style != null) g.fillStyle = style;
    g.fillRect(x, y, w * Math.min(1, k), h);
  },
  at: () => STILL
};

function riteOf(env) {
  return env && env.rite ? env.rite : STILL;
}

function came(now, since, span, reduced) {
  if (reduced || since == null || since < 0) return 1;
  return Math.max(0, Math.min(1, (now - since) / span));
}

// A tint `k` of the way to marking its surface, in the current fillStyle: the part of the box the
// piece's edge has passed, and over the half behind the edge's middle a second coat of the same
// colour. One edge moves while it comes, and at rest it is two shades of one colour split by that
// edge through the middle of the box. One path per coat.
function cover(g, rite, x, y, w, h, k) {
  if (k <= 0) return;
  rite.paint(g, x, y, w, h, k);
  rite.paint(g, x, y, w, h, Math.min(k, 0.5));
}

// A coverage on its way from what was showing (`from`) to where it is going (`to`, 0 or 1), `step`
// of the way up the stair it climbs: one way, from wherever it stood.
function toward(from, to, step) {
  return step >= 1 ? to : from + (to - from) * step;
}

const TURN = 0.9;   // seconds a wheel or a key takes to click round to its next setting
const SPAN = 0.7;   // seconds a letter, a direction or a hint takes to arrive
const REVEAL = 1.6; // seconds a solved note takes to be cut in, the longest change in the cabinet

// The picture a frame would draw, as one string: the canvas's size and the scene's look. A frame
// whose picture is the one already drawn draws nothing -- the canvas holds it -- and a new size
// (the stage clears the canvas to resize it) or a new tread of any change draws again.
function picture(c, look) {
  return c.w + 'x' + c.h + '@' + (c.dpr || 1) + ' ' + JSON.stringify(look);
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

// The wheel's state. Each change keeps the moment it was made on the piece's own clock (-1: there
// from the start) and what was showing at that moment, which is what it moves from: the offset the
// inner alphabet stood at (turnFrom, a fraction of a letter if it was sent again mid-turn) and the
// way round from there to the setting (turnWay), the number shown, each counted letter's reading
// and the cover of its bar (readsFrom, barsFrom, by letter), the direction shown, and the letters
// shown in the word's cells. `drawn` is the picture last drawn (picture, above).
function blank() {
  return {
    shift: 0, shiftAt: -1, turnFrom: 0, turnWay: 0, numberFrom: 0, readsFrom: {}, barsFrom: {},
    reverse: false, reverseFrom: false, reverseAt: -1,
    guess: '', typedFrom: [], guessAt: -1, hints: [], hintAt: [],
    reveal: false, solvedAt: -1, time: 0, drawn: null
  };
}

const LEDGER = 5; // the most bars the ledger beside the wheel counts

// The signed way round the alphabet from one offset to another, the shortest: -13 up to 13.
function shortest(difference) {
  return ((difference % 26) + 26 + 13) % 26 - 13;
}

// What the wheel shows at its clock's moment: every value in the picture a change moves (see the
// rite, above). The turn is one stair: the inner alphabet's offset climbs the ratchet's clicks, the
// number and the readings are cut over at the first, and each bar's light climbs the same clicks
// from what it showed to whether it now reads E.
function wheelLook(p, state, rite, reduced) {
  const got = (since, span) => came(state.time, since, span, reduced);
  const turnP = got(state.shiftAt, TURN);
  const click = turnP >= 1 ? 1 : rite.ratchet(turnP);
  const ledger = tally(locked(p)).slice(0, LEDGER).map((entry) => {
    const reads = turn(entry.letter, -state.shift);
    const lit = reads === 'E' ? 1 : 0;
    const from = entry.letter in state.barsFrom ? state.barsFrom[entry.letter] : lit;
    return {
      letter: entry.letter,
      count: entry.count,
      reads: click > 0 ? reads : state.readsFrom[entry.letter] || reads,
      k: toward(from, lit, click)
    };
  });
  const word = keyWordOf(NOTES[p.note]);
  const guessP = got(state.guessAt, SPAN);
  const typed = [];
  const shown = [];
  for (let i = 0; i < word.length; i++) {
    // A typed letter is cut on at its cell's moment; one that was already showing stands.
    const own = rite.at(0x600 + i);
    const now = state.guess[i] || '';
    const was = state.typedFrom[i] || '';
    typed.push(now === was || own.flicker(guessP) ? now : was);
    const hinted = state.hints.indexOf(i);
    shown.push(hinted >= 0 ? own.stair(got(state.hintAt[hinted], SPAN)) : 0);
  }
  return {
    offset: click >= 1 ? state.shift : state.turnFrom + state.turnWay * click,
    number: click > 0 ? state.shift : state.numberFrom,
    ledger,
    reverse: rite.at(0x2c).flicker(got(state.reverseAt, SPAN)) ? state.reverse : state.reverseFrom,
    typed,
    shown,
    revealK: state.reveal ? rite.stair(got(state.solvedAt, REVEAL)) : 0
  };
}

function wheelTitle(p) {
  return 'letter ' + p.case + ': the wheel';
}

function wheelScene(g, w, h, c, p, look, variant) {
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
  const rite = riteOf(c);
  background(g, w, h, c);

  // The dust of the house, where it settled: as many motes as the configuration asks, laid where
  // its turn puts them. They neither drift nor blink -- nothing in the cabinet moves while it waits.
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
  // reads the note out. The ring holds one glow. The inner alphabet stands at the look's offset,
  // which clicks round to a new setting the shortest way, and the setting's number in the middle
  // is cut over to the new one at the first click.
  g.strokeStyle = c.alpha(colors.accent2, 0.6);
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
    const b = ((i + look.offset) / 26) * Math.PI * 2 - Math.PI / 2;
    g.font = '600 ' + innerSize + 'px ui-monospace, monospace';
    g.fillStyle = c.alpha(colors.accent2, 0.95);
    g.fillText(ALPHABET[i], w / 2 + Math.cos(b) * radius * 0.56, middle + Math.sin(b) * radius * 0.56);
  }
  g.font = '600 ' + Math.max(8, Math.round(radius * 0.16)) + 'px ui-monospace, monospace';
  g.fillStyle = colors.accent2;
  g.fillText(String(look.number).padStart(2, '0'), w / 2, middle - radius * 0.1);
  g.font = '500 ' + Math.max(7, Math.round(radius * 0.13)) + 'px ui-monospace, monospace';
  g.fillText(look.reverse ? '<<' : '>>', w / 2, middle + radius * 0.12);
  if (roomy) {
    // The letter ledger beside the wheel: the commonest letters of the received line, and what
    // each one stands for at this setting. The tallest bar nearly always wants to read E, which is
    // how the setting is found without trying all twenty-six. It draws only where it fits clear of
    // the ring: a stretched frame can leave no room, and a column across the letters would be
    // worse than none.
    g.font = '500 ' + small + 'px ui-monospace, monospace';
    const column = w / 2 - radius * 1.1 - w * 0.06;
    if (column > small * 6) {
      const ledger = look.ledger.slice(0, Math.max(3, Math.min(LEDGER, Math.floor(radius * 2 / (small * 1.6)))));
      const barMax = Math.max(small, column - small * 3.2);
      const readsAt = w * 0.06 + small * 1.5 + barMax + small * 0.5;
      const rowGap = Math.min(small * 1.5, (radius * 2) / ledger.length);
      g.textAlign = 'left';
      g.fillStyle = c.alpha(colors.muted, 0.9);
      g.fillText('counted', w * 0.06, middle - (ledger.length / 2) * rowGap - small * 0.8);
      g.fillText('reads', readsAt, middle - (ledger.length / 2) * rowGap - small * 0.8);
      // A bar that reads E is lit whole -- it shows a reading, not a state -- and the light comes
      // over it behind the piece's edge on the wheel's clicks, and leaves the bar that stops
      // reading E the same way; the letter each bar reads is cut over at the wheel's first click.
      ledger.forEach((entry, i) => {
        const y = middle + (i - (ledger.length - 1) / 2) * rowGap;
        const len = barMax * entry.count / ledger[0].count;
        g.fillStyle = colors.fg;
        g.fillText(entry.letter, w * 0.06, y);
        g.fillStyle = c.alpha(colors.accent, 0.5);
        g.fillRect(w * 0.06 + small * 1.5, y - small * 0.2, len, small * 0.4);
        rite.paint(g, w * 0.06 + small * 1.5, y - small * 0.2, len, small * 0.4, entry.k, c.alpha(colors.accent2, 0.9));
        g.fillStyle = entry.reads === 'E' ? colors.accent2 : colors.fg;
        g.fillText(entry.reads, readsAt, y);
      });
    }
    const way = look.reverse ? 'read right to left' : 'read left to right';
    if (w / 2 + radius * 1.1 + g.measureText(way).width < w * 0.94) {
      g.textAlign = 'right';
      g.fillStyle = c.alpha(colors.muted, 0.9);
      g.fillText(way, w * 0.94, middle);
    }
    g.textAlign = 'center';
  }

  // The word, as typed, letter by letter in the cells the note's word fills; hints above. A solved
  // note takes the foot of the scene at the reveal's first tread: a band of the lock's colour is
  // cut in across it behind the piece's edge up the stair, resting in two shades, and the note is
  // written in the band, showing as far as the edge has passed -- never a wash.
  const opened = look.revealK > 0;
  g.font = '500 ' + small + 'px ui-monospace, monospace';
  g.textAlign = 'left';
  g.fillStyle = colors.accent2;
  g.fillText(opened ? 'THE NOTE' : 'THE WORD, THROUGH THE WHEEL', w * 0.06, h * 0.79);
  g.textAlign = 'center';
  if (opened) {
    g.fillStyle = c.alpha(colors.accent2, 0.16);
    cover(g, rite, 0, h * 0.76, w, h * 0.24, look.revealK);
    g.save();
    g.beginPath();
    rite.region(g, 0, h * 0.76, w, h * 0.24, look.revealK);
    g.clip();
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
  g.font = '600 ' + Math.round(cellH * 0.7) + 'px ui-monospace, monospace';
  for (let i = 0; i < word.length; i++) {
    const x = x0 + cell * i;
    // A cell that has been shown its letter is marked: its tint is cut in behind the edge up its
    // stair and rests in two shades, and the letter above it is cut on at the stair's first tread.
    if (look.shown[i] > 0) {
      g.fillStyle = c.alpha(colors.accent2, 0.22);
      cover(g, rite, x + cell * 0.08, top, cell * 0.84, cellH, look.shown[i]);
      g.fillStyle = colors.accent2;
      g.font = '500 ' + small + 'px ui-monospace, monospace';
      g.fillText(word[i], x + cell / 2, top - small * 0.7);
      g.font = '600 ' + Math.round(cellH * 0.7) + 'px ui-monospace, monospace';
    }
    g.strokeStyle = c.alpha(colors.muted, 0.6);
    g.lineWidth = 1;
    g.strokeRect(x + cell * 0.08, top, cell * 0.84, cellH);
    if (look.typed[i]) {
      g.fillStyle = colors.fg;
      g.fillText(look.typed[i], x + cell / 2, top + cellH * 0.52);
    }
  }
}

// The wheel as a card shows it: as it stands before anything is turned.
function wheelPreview(g, w, h, env, p) {
  wheelScene(g, w, h, env, p, wheelLook(p, blank(), riteOf(env), true), env.variant);
}

function wheelPiece(env) {
  const p = carried(env) || plan(env);
  const helps = asked(env).helps;
  const state = blank();
  const note = NOTES[p.note];
  const word = keyWordOf(note);
  const received = locked(p);
  const look = (c) => wheelLook(p, state, riteOf(c), !!c.reduced);
  // The scene as it stands, drawn unless (`always` aside) the canvas already holds that picture.
  const draw = (c, always) => {
    const now = look(c);
    const drawn = picture(c, now);
    if (!always && drawn === state.drawn) return;
    wheelScene(c.g, c.w, c.h, c, p, now, env.variant);
    state.drawn = drawn;
  };
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
      if (!shiftRight) {
        const at = Math.round(Number(c.value('wheel')));
        const tallest = tally(received)[0];
        const reads = Number.isFinite(at) ? turn(tallest.letter, -at) : '?';
        parts.push('the wheel is off: at that setting the line\'s commonest letter, ' + tallest.letter + ', reads ' + reads + (reads === 'E' ? ' — the house counted against its habit this once, so weigh the next bar' : ' rather than the E the house favours'));
        if (!wayRight) parts.push('the direction is off too');
      } else if (!wayRight) parts.push('the line is read the wrong way round');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('received: ' + received + '; the tallest bar beside the wheel nearly always wants to read E');
      draw(c, true);
    },
    apply(id, value, c) {
      // What the wheel shows now, before anything moves it: every change below moves from here.
      const shown = look(c);
      if (id === 'wheel') {
        const position = Number(value);
        const shift = Number.isFinite(position) ? Math.max(0, Math.min(25, Math.round(position))) : 0;
        if (shift !== state.shift) {
          state.turnFrom = shown.offset;
          state.turnWay = shortest(shift - shown.offset);
          state.numberFrom = shown.number;
          state.readsFrom = {};
          state.barsFrom = {};
          for (const bar of shown.ledger) {
            state.readsFrom[bar.letter] = bar.reads;
            state.barsFrom[bar.letter] = bar.k;
          }
          state.shiftAt = state.time;
          state.shift = shift;
        }
        c.status('at ' + state.shift + ' turns the outside letter A stands for ' + ALPHABET[(26 - state.shift) % 26]);
      }
      if (id === 'direction') {
        const reverse = value === 'reverse';
        if (reverse !== state.reverse) {
          state.reverseFrom = shown.reverse;
          state.reverseAt = state.time;
        }
        state.reverse = reverse;
        c.status('reading ' + (state.reverse ? 'right to left' : 'left to right'));
      }
      if (id === 'word') {
        const guess = cleaned(value);
        if (guess !== state.guess) {
          state.typedFrom = shown.typed;
          state.guessAt = state.time;
          state.guess = guess;
        }
      }
      if (id === 'hint') {
        const next = [];
        if (state.hints.length < helps) {
          for (let i = 0; i < word.length; i++) if (!state.hints.includes(i)) next.push(i);
        }
        if (next.length) {
          const i = next[Math.floor(next.length / 2)];
          state.hints.push(i);
          state.hintAt.push(state.time);
          c.hint();
          c.status('letter ' + (i + 1) + ' of the word is ' + word[i]);
        } else if (state.hints.length >= helps) {
          c.status('that is all the cabinet will show at this difficulty; the wheel setting follows from any one letter');
        } else {
          c.status('every letter of the word is shown; the wheel setting follows from any one of them');
        }
      }
      draw(c, true);
    },
    frame(t, dt, c) {
      if (!c.reduced) state.time += Math.max(0, Number(dt) || 0);
      draw(c);
    },
    end(c) {
      state.reveal = true;
      state.solvedAt = state.time;
      c.status('the note reads: ' + note);
      draw(c, true);
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

// The key's state. Each change keeps the moment it was made on the piece's own clock, s.t (-1:
// there from the start), and what was showing at that moment, which is what it moves from: the
// angle the key stood at (`from`), the route line, the four strips' letters and the cover of the
// mark behind each strip (routeFrom, stripsFrom, marksFrom), the first word shown, and how many
// hints were shown. `drawn` is the picture last drawn (picture, above).
function grilleBlank() {
  return {
    corner: 0, direction: 1, view: 0, from: 0, turnAt: -1,
    routeFrom: '', stripsFrom: ['', '', '', ''], marksFrom: [1, 0, 0, 0],
    guess: '', guessFrom: '', guessAt: -1, hints: 0, hintsFrom: 0, hintAt: -1,
    reveal: false, solvedAt: -1, t: 0, drawn: null
  };
}

function strip(p, board, corner, direction, view) {
  return openings(p, corner + direction * view).map((index) => board[index]).join('');
}

function turningWord(direction) {
  return direction === 1 ? 'clockwise' : 'counterclockwise';
}

function routeLine(s) {
  return 'from the ' + NOTCHES[s.corner].label + ', ' + turningWord(s.direction);
}

// What the key shows at its clock's moment: every value in the picture a change moves (see the
// rite, above). A turn is one stair: the key's angle climbs the ratchet's clicks from where it
// stood to its notch and view, the shortest way round -- never a smooth turn -- the route and the
// strips' letters are cut over at the first click, and the mark leaves the strip it stood behind
// and comes over the one on the board on the same clicks.
function grilleLook(p, board, s, rite, reduced) {
  const got = (since, span) => came(s.t, since, span, reduced);
  const turnP = got(s.turnAt, TURN);
  const click = turnP >= 1 ? 1 : rite.ratchet(turnP);
  const goal = quarter(s.corner + s.direction * s.view) * QUARTER;
  const difference = ((goal - s.from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const strips = [];
  const marks = [];
  for (let view = 0; view < 4; view++) {
    strips.push(click > 0 ? strip(p, board, s.corner, s.direction, view) : s.stripsFrom[view]);
    marks.push(toward(s.marksFrom[view], view === s.view ? 1 : 0, click));
  }
  return {
    angle: click >= 1 ? goal : s.from + difference * click,
    route: click > 0 ? routeLine(s) : s.routeFrom,
    strips,
    marks,
    hints: rite.at(0x3b).flicker(got(s.hintAt, SPAN)) ? s.hints : s.hintsFrom,
    guess: rite.at(0x3c).flicker(got(s.guessAt, SPAN)) ? s.guess : s.guessFrom,
    revealK: s.reveal ? rite.stair(got(s.solvedAt, REVEAL)) : 0
  };
}

function grilleScene(g, w, h, c, p, board, look, variant) {
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
  const rite = riteOf(c);
  const angle = look.angle;
  const opened = look.revealK > 0;
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
  g.fillText(opened ? 'ONE KEY / FOUR VIEWS' : 'KEY / ' + p.case, w / 2, h * 0.045);

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

  // The holes are actual holes in one rotating mask; the board underneath never turns. Over a
  // solved board the key lifts off behind the piece's edge: the whole key, its surface, its holes
  // and its outline, is drawn through the part of it the edge still holds -- in the key's own
  // frame, so the edge turns with the key -- and that part shrinks back the way the edge came,
  // tread by tread down the reveal's stair, never by alpha.
  const inset = cell * 0.09;
  const keep = 1 - look.revealK;
  if (keep > 0) {
    const line = Math.max(1, cell * 0.035);
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    if (keep < 1) {
      g.beginPath();
      rite.region(g, -side / 2 - line, -side / 2 - line, side + line * 2, side + line * 2, keep);
      g.clip();
    }
    g.fillStyle = c.mix(col.bg, col.bg2, 0.3);
    g.beginPath();
    g.rect(-side / 2, -side / 2, side, side);
    for (const index of p.holes) {
      g.rect(-side / 2 + index % SIDE * cell + inset,
        -side / 2 + Math.floor(index / SIDE) * cell + inset,
        cell - inset * 2, cell - inset * 2);
    }
    g.fill('evenodd');
    g.strokeStyle = col.accent;
    g.lineWidth = line;
    g.strokeRect(-side / 2, -side / 2, side, side);
    for (const index of p.holes) {
      g.strokeRect(-side / 2 + index % SIDE * cell + inset,
        -side / 2 + Math.floor(index / SIDE) * cell + inset,
        cell - inset * 2, cell - inset * 2);
    }
    g.restore();
  }

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
  const a = angle - QUARTER;
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
  if (!opened) {
    // The four views along the route the visitor has set, the one on the board marked: the mark is
    // a tint cut in behind the strip by the piece's edge, resting in two shades, and it leaves the
    // strip it stood behind the same way, both on the key's clicks; a strip's letters take the
    // mark's colour while its mark covers half of it or more.
    for (let view = 0; view < 4; view++) {
      const text = (view + 1) + '  ' + look.strips[view];
      const y = h * (0.72 + view * 0.052);
      const k = look.marks[view];
      if (k > 0) {
        g.fillStyle = c.alpha(col.accent2, 0.2);
        cover(g, rite, w * 0.08 - small * 0.4, y - small * 0.62, g.measureText(text).width + small * 0.8, small * 1.24, k);
      }
      g.fillStyle = k >= 0.5 ? col.accent2 : col.fg;
      g.fillText(text, w * 0.08, y);
    }
    const hint = look.hints >= 1
      ? ' / hint: it starts at the ' + NOTCHES[p.start].label + (look.hints >= 2 ? ', ' + turningWord(p.direction) : '')
      : '';
    g.fillStyle = col.muted;
    g.fillText(look.route + hint, w * 0.08, h * 0.935);
    g.textAlign = 'right';
    g.fillStyle = col.accent2;
    g.fillText('first word: ' + (cleaned(look.guess) || '_'), w * 0.92, h * 0.935);
  } else {
    // The note is cut in under the lifting key, behind the same edge up the same stair: the foot
    // of the board, with the note written in it, shows as far as the edge has passed.
    g.save();
    g.beginPath();
    rite.region(g, 0, h * 0.68, w, h * 0.32, look.revealK);
    g.clip();
    g.fillStyle = col.accent2;
    g.fillText('THE NOTE', w * 0.08, h * 0.74);
    g.textAlign = 'center';
    g.fillStyle = col.fg;
    const limit = Math.max(8, Math.floor((w * 0.84) / (small * 0.68)));
    rows(NOTES[p.note], limit).forEach((line, index) => {
      g.fillText(line, w / 2, h * 0.82 + index * small * 1.16);
    });
    g.restore();
  }
  g.restore();
}

function grillePreview(g, w, h, env, p) {
  const board = grilleBoard(p);
  grilleScene(g, w, h, env, p, board, grilleLook(p, board, grilleBlank(), riteOf(env), true), env.variant);
}

function grillePiece(env, carriedPlan) {
  const p = carriedPlan || grillePlan(env);
  const helps = Math.min(2, asked(env).helps);
  const board = grilleBoard(p);
  const s = grilleBlank();
  const note = NOTES[p.note];
  const first = note.split(' ')[0];
  const look = (c) => grilleLook(p, board, s, riteOf(c), !!c.reduced);
  // The scene as it stands, drawn unless (`always` aside) the canvas already holds that picture.
  const draw = (c, always) => {
    const now = look(c);
    const drawn = picture(c, now);
    if (!always && drawn === s.drawn) return;
    grilleScene(c.g, c.w, c.h, c, p, board, now, env.variant);
    s.drawn = drawn;
  };
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
      draw(c, true);
    },
    apply(id, value, c) {
      // What the key shows now, before anything moves it: every change below moves from here.
      const shown = look(c);
      const goalWas = quarter(s.corner + s.direction * s.view);
      const routeWas = routeLine(s);
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
      if (id === 'word') {
        const guess = cleaned(value);
        if (guess !== s.guess) {
          s.guessFrom = shown.guess;
          s.guessAt = s.t;
          s.guess = guess;
        }
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          s.hintsFrom = shown.hints;
          s.hints += 1;
          s.hintAt = s.t;
          c.hint();
          c.status(s.hints === 1 ? 'the key starts at the ' + NOTCHES[p.start].label : 'and it turns ' + turningWord(p.direction));
        } else if (helps < 2) {
          c.status('that is all the cabinet will show at this difficulty; read the four views and type the first word');
        } else {
          c.status('both hints are shown; read the four views and type the first word');
        }
      }
      // A new notch, turn or view sends the key turning, from the angle it showed, and the route,
      // the strips and the mark with it.
      if (quarter(s.corner + s.direction * s.view) !== goalWas || routeLine(s) !== routeWas) {
        s.from = shown.angle;
        s.turnAt = s.t;
        s.routeFrom = shown.route;
        s.stripsFrom = shown.strips;
        s.marksFrom = shown.marks;
      }
      draw(c, true);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += Math.max(0, Number(dt) || 0);
      draw(c);
    },
    end(c) {
      s.reveal = true;
      s.solvedAt = s.t;
      c.status('the note reads: ' + note + '. One key exposes every square exactly once across four views.');
      draw(c, true);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

export default {
  id: 'cipher-cabinet',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsGrille(env)) grillePreview(g, w, h, env, grillePlan(env));
    else wheelPreview(g, w, h, env, plan(env));
  },
  animate() {
    // A card of the cabinet is a printed thing, the wheel as much as the grille: a locked note
    // waits to be opened and nothing on it moves until it is, so the loop lets it go at once
    // (js/feed.js has the contract animate is held to).
    return false;
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
      paint: (g, w, h, cardEnv) => wheelPreview(g, w, h, cardEnv, p),
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
