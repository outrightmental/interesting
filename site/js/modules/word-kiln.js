/* The word kiln: put a word in the fire and a coinage comes out, with a definition and a citation
   that never existed. As a card it is the kiln's mouth and one coinage (paint, spark); as a piece
   it is a word off the shelf, fired at a heat you set and left to cool, or a kiln-load of new
   words pulled out of the fire one tap at a time. See js/feed.js for what a module is and
   js/stage.js for what a piece is.

   A card and the feature it opens as are one coinage: the spark puts the word it coined on its
   spec as `of`, and the piece fires that word rather than another, so pressing a coinage in the
   feed opens the kiln on it. */

// The card this piece was opened from, in the kiln's own terms: { word, pos }, or null for a piece
// nobody pressed (js/stage.js hands it over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  return was && typeof was.word === 'string' && was.word ? was : null;
}

const HEADS = ['umb', 'thal', 'quer', 'mor', 'vell', 'glim', 'sorr', 'brack', 'fulm', 'nim', 'osk', 'twil',
  'harr', 'pell', 'dru', 'calv', 'wist', 'lorn', 'skell', 'murr'];
const MIDS = ['er', 'ow', 'ish', 'ine', 'ast', 'ul', 'en', 'ar', 'o', 'i'];
const TAILS = ['ment', 'ling', 'wick', 'ance', 'th', 'ry', 'some', 'fast', 'wise', 'hood', 'kin', 'age', 'ure'];
const POS = ['n.', 'n.', 'n.', 'v.', 'adj.'];

const DEFS = {
  'n.': [
    'the warmth left in a chair someone has just got up from',
    'the small debt owed to a tab left open',
    'the pause before a kettle makes up its mind',
    'a path familiar in one direction only',
    'the exact weight of a thing you meant to return',
    'the quiet after a door you did not hear close',
    'a word that arrives two stairs after the conversation',
    'the part of a map that is only true on paper',
    'the second, smaller surprise inside a surprise',
    'the courage particular to the first sentence'
  ],
  'v.': [
    'to lose a thought by reaching for it',
    'to tidy a room by moving the mess one room over',
    'to agree with someone slightly before they have finished',
    'to walk back for the thing, then forget the thing',
    'to warm a plan by talking about it instead of doing it',
    'to hold a note a beat longer than the song wants'
  ],
  'adj.': [
    'of a silence, friendly',
    'of a plan, ruined by being said aloud',
    'slightly too tall for the room it is in',
    'of a word, right in the mouth and wrong on the page',
    'glad in the manner of a dog with a found stick'
  ]
};

const AUTHORS = ['E. Varrow', 'H. Quillfeather', 'M. Oates-Lind', 'the Pemberly glossary', 'an anonymous marginal note',
  'T. Ashgrove', 'L. Marrowbone', 'the Second Kiln Circular'];
const WORKS = ['A Dictionary of Rooms', 'The Lesser Almanac', 'Notes Toward a Grammar of Weather',
  'Field Guide to the Unsaid', 'The Kiln Book, second firing', 'Glossary of a House at Night'];
const BOOKS = ['a dictionary of rooms', 'the lesser almanac', 'a grammar of weather', 'the field guide to the unsaid',
  'the kiln book, second firing', 'the glossary of a house at night'];

// The shelf by the door, and what the fire does to a word taken off it.
const SHELF = ['lantern', 'gravel', 'hinge', 'fathom', 'bramble', 'quarry', 'kettle', 'moss',
  'ledger', 'thistle', 'anvil', 'marrow', 'cipher', 'harbour', 'spindle', 'furrow'];
const PREFIX = ['un', 'mis', 'over', 'inter', 'sub', 'pre', 'counter', 'trans', 'fore', 'out'];
const SUFFIX = ['ward', 'some', 'ling', 'craft', 'wise', 'fast', 'let', 'ish', 'most', 'hood'];
const SENSE = ['the particular silence that follows', 'a small debt owed to', 'the habit of returning to',
  'the useful part of', 'the residue left by', 'a deliberate misreading of',
  'the hour at which one stops pretending about', 'the shape a room takes around'];
const FIELD = ['dialect', 'trade usage', 'obsolete', 'nautical', 'regional', 'cant', 'bookbinding', 'masonry',
  'falconry', 'printing'];
const CITE = ['attested once, in a margin', 'recorded by a clerk who misheard it', 'in use among people who would deny it',
  'found on a crate, never since', 'spoken only indoors', 'last written down by someone leaving'];

const KINDS = [{ label: 'nouns', value: 'n.' }, { label: 'verbs', value: 'v.' }, { label: 'adjectives', value: 'adj.' }];
const HEAT = ['warm', 'hot', 'white'];
const FATE = ['the word comes out with a handle on it', 'the word comes out spliced to another',
  'higher heat breaks the word up more'];
const SHAPE = ['long words, in no hurry', 'shorter words, the tails burned off', 'two words fused into one'];
const TIMES = ['', 'once', 'twice', 'three times', 'four times'];
const NUM = ['', 'one', 'two', 'three', 'four', 'five'];

function tidy(word) {
  return word.replace(/(.)\1\1/g, '$1$1');
}

function reverse(text) {
  return text.split('').reverse().join('');
}

// The three heats of a 0..100 dial: warm, hot and white.
function band(heat) {
  return heat < 34 ? 0 : heat < 67 ? 1 : 2;
}

function coin(env) {
  let word = env.pick(HEADS) + env.pick(MIDS) + env.pick(TAILS);
  if (env.chance(0.3)) word = env.pick(HEADS) + env.pick(TAILS);
  return tidy(word);
}

// A new coinage at a heat: whole when warm, the tail burned off when hot, two heads fused at white.
function coinAt(env, b) {
  if (b === 0) return coin(env);
  if (b === 1) return tidy(env.pick(HEADS) + env.pick(TAILS));
  const head = env.pick(HEADS);
  let other = env.pick(HEADS);
  if (other === head) other = HEADS[(HEADS.indexOf(head) + 7) % HEADS.length];
  return tidy(head + other);
}

// What the fire does to a word off the shelf: an affix when warm, a splice when hot, a melt at white.
function forge(env, word, b) {
  if (b === 0) return env.chance(0.5) ? env.pick(PREFIX) + word : word + env.pick(SUFFIX);
  if (b === 1) {
    return tidy(env.chance(0.5)
      ? word.slice(0, Math.max(2, Math.ceil(word.length / 2))) + reverse(word).slice(0, 3)
      : word.slice(0, 3) + env.pick(SHELF).slice(-4));
  }
  const bare = word.replace(/[aeiou]/g, '');
  return tidy(env.chance(0.5) ? bare + 'a' + word.slice(-2) : reverse(word).slice(0, Math.ceil(word.length / 2)) + env.pick(TAILS));
}

/* The kiln's mouth and its ember. `o` is where it sits and how it is drawn: the piece places its
   own mouth and holds the sparks still, and a card passes the configuration it was dealt --
   `o.sparks` being how many of them rise. */
function kiln(ctx, w, h, env, heat, o) {
  const c = env.colors;
  const cx = o && o.cx != null ? o.cx : w / 2;
  const cy = o && o.cy != null ? o.cy : h * 0.52;
  const r = o && o.r ? o.r : Math.min(w, h) * 0.26;
  const lit = o && o.lit != null ? o.lit : 1;
  const g = ctx.createRadialGradient(cx, cy + r * 0.7, 0, cx, cy + r * 0.7, Math.max(w, h) * 0.8);
  g.addColorStop(0, env.mix(c.bg, c.accent, 0.18 * (0.3 + 0.7 * lit)));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // The mouth.
  ctx.fillStyle = env.mix(c.bg, '#000', 0.4);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = env.alpha(c.accent, 0.25 + 0.15 * lit);
  ctx.lineWidth = 2;
  ctx.stroke();
  // The ember.
  const e = ctx.createRadialGradient(cx, cy + r * 0.2, 0, cx, cy + r * 0.2, r * 0.8);
  e.addColorStop(0, env.alpha(c.accent2, (0.55 + heat * 0.45) * lit));
  e.addColorStop(0.4, env.alpha(c.accent, (0.35 + heat * 0.4) * lit));
  e.addColorStop(1, env.alpha(c.accent, 0));
  ctx.fillStyle = e;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.95, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o && o.still) return;
  // Sparks rising, for the card.
  const sparks = (6 + heat * 10) * (o && o.sparks ? o.sparks : 1);
  for (let i = 0; i < sparks; i++) {
    ctx.fillStyle = env.alpha(c.accent2, 0.2 + env.rnd() * 0.6);
    ctx.beginPath();
    ctx.arc(cx + (env.rnd() - 0.5) * r * 1.4, cy - r * 0.6 - env.rnd() * h * 0.35, 0.8 + env.rnd() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---- the piece's scene: a mouth on the left, a column on the right, sparks in between ------ */

function mouthOf(c) {
  return { cx: c.w * 0.27, cy: c.h * 0.44, r: Math.min(c.w, c.h) * 0.23 };
}

function px(c, k, floor) {
  return Math.max(floor, Math.round(Math.min(c.w, c.h) * k));
}

function font(g, size, style) {
  g.font = (style || '400') + ' ' + size + 'px system-ui, sans-serif';
}

function wrap(g, text, width, most) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && g.measureText(test).width > width) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  if (most && lines.length > most) {
    lines.length = most;
    lines[most - 1] = lines[most - 1].replace(/,?\s+\S*$/, '') + '…';
  }
  return lines;
}

function burst(c, s, m, n, speed) {
  for (let i = 0; i < n && s.sparks.length < 160; i++) {
    const a = c.rnd() * Math.PI * 2;
    const v = m.r * (0.4 + c.rnd() * speed);
    s.sparks.push({ x: m.cx + (c.rnd() - 0.5) * m.r, y: m.cy - m.r * 0.1 + c.rnd() * m.r * 0.3,
      vx: Math.cos(a) * v * 0.6, vy: -Math.abs(Math.sin(a)) * v - m.r * 0.5, life: 0.6 + c.rnd() * 1.1, age: 0,
      size: 0.8 + c.rnd() * 1.5 });
  }
}

function sparks(g, c, s, dt, m, rate) {
  s.acc = Math.min(3, s.acc + dt * rate);
  while (s.acc >= 1 && s.sparks.length < 160) {
    s.acc -= 1;
    s.sparks.push({ x: m.cx + (c.rnd() - 0.5) * m.r * 1.2, y: m.cy - m.r * 0.2 + c.rnd() * m.r * 0.5,
      vx: (c.rnd() - 0.5) * m.r * 0.3, vy: -(m.r * 0.6 + c.rnd() * m.r * 1.2), life: 0.7 + c.rnd() * 1.2, age: 0,
      size: 0.7 + c.rnd() * 1.3 });
  }
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.age += dt;
    if (p.age >= p.life) {
      s.sparks.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy *= 1 - dt * 0.5;
    const a = 1 - p.age / p.life;
    g.fillStyle = c.alpha(c.colors.accent2, 0.1 + a * 0.7);
    g.beginPath();
    g.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
    g.fill();
  }
}

// The kiln, its sparks, the flash of a firing and the word under the mouth; the column is the
// shape's own.
function scene(c, s, dt, t, lit, label, labelTone) {
  const g = c.g;
  const m = mouthOf(c);
  const flicker = c.reduced ? 0 : Math.sin(t * 7) * 0.04 + Math.sin(t * 3.1) * 0.03;
  kiln(g, c.w, c.h, c, Math.max(0, Math.min(1, s.heat + flicker)), { cx: m.cx, cy: m.cy, r: m.r, lit, still: true });
  sparks(g, c, s, dt, m, lit * (3 + s.heat * 25) * (c.reduced ? 0.3 : 1));
  if (s.flash > 0) {
    g.fillStyle = c.alpha(c.colors.accent2, s.flash * 0.18);
    g.fillRect(0, 0, c.w, c.h);
  }
  font(g, px(c, 0.055, 13), '500');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = c.mix(c.colors.accent2, c.colors.muted, labelTone);
  g.fillText(label, m.cx, m.cy + m.r * 0.92 + px(c, 0.07, 16));
  return m;
}

// A line or two stamped along the foot of the scene (lines split on a newline).
function stamp(c, text, a) {
  if (a <= 0) return;
  const g = c.g;
  const size = px(c, 0.034, 10);
  const lines = String(text).split('\n');
  font(g, size, 'italic 400');
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = c.alpha(c.colors.muted, Math.min(1, a));
  lines.forEach((line, i) => g.fillText(line, c.w / 2, c.h * 0.95 - (lines.length - 1 - i) * size * 1.3));
}

function heatLine(b, notes) {
  return 'heat ' + (b + 1) + ', ' + HEAT[b] + ': ' + notes[b];
}

/* ---- one word off the shelf, fired and left to cool ---------------------------------------- */

function fired(env) {
  const was = pressed(env);
  const pool = SHELF.slice();
  const options = [];
  while (options.length < 3) {
    const i = env.int(0, pool.length - 1);
    options.push({ label: pool[i], value: pool[i] });
    pool.splice(i, 1);
  }
  // The coinage the card was showing goes on the shelf, first and already named in the title: a
  // visitor who pressed a word is here to put that word back in the fire.
  if (was) options.unshift({ label: was.word, value: was.word });
  const count = env.int(2, 4);
  const heat0 = env.pick([20, 50, 80]);
  // Every coinage this piece can hand back, so the same address fires the same words.
  const forged = options.map((o) => [0, 1, 2].map((b) => {
    const list = [];
    for (let n = 0; n < count; n++) {
      let made = forge(env, o.value, b);
      if (made === o.value || list.indexOf(made) !== -1) made = forge(env, o.value, b);
      list.push(made);
    }
    return list;
  }));
  const fields = [];
  const senses = [];
  const cites = [];
  for (let n = 0; n < count; n++) {
    fields.push(env.pick(FIELD));
    senses.push(env.pick(SENSE));
    cites.push(env.pick(CITE));
  }
  const s = { word: '', wi: 0, heat: heat0 / 100, fired: 0, entry: null, log: [], cool: -1, coolFor: 4, drop: 1,
    flash: 0, fin: 0, sparks: [], acc: 0 };
  const names = options.map((o) => o.value);
  const piece = {
    title: was ? was.word + ' back into the fire'
      : names[0] + ', ' + names[1] + ' or ' + names[2] + ': into the fire',
    brief: (was ? 'Your coinage is on the shelf with three plainer words. Take one, set the heat and fire it '
      : 'Take a word off the shelf, set the heat and fire it ')
      + TIMES[count] + '; what comes out is a coinage with a definition and a citation that never existed, and you let it cool.',
    aspect: '4 / 3',
    steps: [
      { id: 'word', ask: 'a word to fire', kind: 'choice', options },
      { id: 'heat', ask: 'the heat', kind: 'range', min: 0, max: 100, step: 1, value: heat0, low: 'warm', high: 'white' },
      { id: 'fire', ask: 'fire it ' + TIMES[count], kind: 'press', count, label: 'fire it', after: 'word' },
      { id: 'cool', ask: 'let it cool', kind: 'wait', after: 'fire' }
    ],
    start(c) {
      c.status('the kiln is still warm from the last firing');
      piece.frame(0, 0, c);
    },
    apply(id, value, c) {
      if (id === 'word') {
        s.word = String(value);
        s.wi = Math.max(0, names.indexOf(s.word));
        s.drop = 1;
        c.status('"' + s.word + '" is off the shelf and waiting by the door');
      }
      if (id === 'heat') {
        s.heat = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(heatLine(band(Number(value)), FATE));
      }
      if (id === 'fire' && !c.done) {
        if (!s.word) s.word = names[0];
        const b = band(s.heat * 100);
        const n = (Math.max(1, Number(value) || 1) - 1) % count;
        if (s.entry) s.log.unshift(s.entry.made);
        s.log.length = Math.min(s.log.length, 3);
        s.entry = { made: forged[s.wi][b][n], field: fields[n], sense: senses[n], cite: cites[n], heat: b + 1, word: s.word };
        s.fired += 1;
        s.flash = 1;
        s.drop = 0.001;
        s.coolFor = 3 + b;
        s.cool = s.fired >= count ? 0 : -1;
        burst(c, s, mouthOf(c), 18 + b * 10, 1.2 + b * 0.5);
        c.status('"' + s.word + '" went in and "' + s.entry.made + '" came out' + (s.cool >= 0 ? '. let it cool.' : ''));
      }
    },
    frame(t, dt, c) {
      s.flash = Math.max(0, s.flash - dt * 2.5);
      if (s.drop < 1) s.drop = Math.min(1, s.drop + dt * 2);
      if (s.cool >= 0 && s.cool < 1 && !c.done) {
        s.cool = Math.min(1, s.cool + dt / s.coolFor);
        c.progress('cool', s.cool);
        if (s.cool >= 1) {
          c.status('"' + s.entry.made + '" has cooled and set');
          c.satisfy('cool');
        }
      }
      if (c.done) s.fin = Math.min(1, s.fin + dt);
      const cooled = s.cool < 0 ? 0 : s.cool;
      const lit = (1 - cooled * 0.9) * (1 - s.fin * 0.8);
      const label = s.fin > 0.5 ? 'cold' : s.entry ? s.entry.made : 'warm';
      const m = scene(c, s, dt, t, lit, label, Math.max(cooled, s.fin));
      const g = c.g;
      // The word by the door, dropping into the mouth when fired.
      if (s.word) {
        const y = m.cy - m.r * 1.3 + (s.drop < 1 ? s.drop * m.r * 1.1 : 0);
        font(g, px(c, 0.05, 12), '500');
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = c.alpha(c.colors.fg, s.drop < 1 ? 1 - s.drop : s.entry ? 0.55 : 1);
        g.fillText(s.word, m.cx, y);
      }
      // The column: the entry as it stands, printing as it cools.
      const x0 = c.w * 0.5;
      const width = c.w * 0.46;
      let y = c.h * 0.14;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      if (!s.entry) {
        font(g, px(c, 0.042, 11), 'italic 400');
        g.fillStyle = c.alpha(c.colors.muted, 0.8);
        g.fillText('nothing fired yet', x0, y + px(c, 0.042, 11));
        return;
      }
      const big = px(c, 0.075, 16);
      const small = px(c, 0.038, 10);
      y += big;
      font(g, big, '600');
      g.fillStyle = c.mix(c.colors.accent2, c.colors.fg, cooled);
      g.fillText(s.entry.made, x0, y);
      y += small * 1.6;
      font(g, small, '400');
      g.fillStyle = c.alpha(c.colors.muted, 0.9);
      g.fillText('[' + s.entry.field + ', heat ' + s.entry.heat + ']', x0, y);
      if (cooled > 0.3) {
        y += small * 1.9;
        font(g, px(c, 0.044, 11), '400');
        g.fillStyle = c.alpha(c.colors.fg, Math.min(1, (cooled - 0.3) * 4));
        for (const line of wrap(g, 'n. ' + s.entry.sense + ' ' + s.entry.word + '.', width, 3)) {
          g.fillText(line, x0, y);
          y += px(c, 0.044, 11) * 1.35;
        }
      }
      if (cooled > 0.65) {
        y += small * 0.6;
        font(g, small, 'italic 400');
        g.fillStyle = c.alpha(c.colors.muted, Math.min(1, (cooled - 0.65) * 4));
        for (const line of wrap(g, s.entry.cite + '.', width, 2)) {
          g.fillText(line, x0, y);
          y += small * 1.35;
        }
      }
      if (s.log.length) {
        y += small * 1.4;
        font(g, small, '400');
        g.fillStyle = c.alpha(c.colors.muted, 0.55);
        g.fillText(wrap(g, 'earlier: ' + s.log.join(', '), width, 1)[0], x0, y);
      }
      stamp(c, 'it is a kiln, not a dictionary', s.fin * 1.5);
    },
    end(c) {
      c.status('cooled, swept and shelved: "' + (s.entry ? s.entry.made : s.word) + '". it is a kiln, not a dictionary.');
      s.fin = Math.max(s.fin, 0.01);
      piece.frame(0, 0, c);
    }
  };
  return piece;
}

/* ---- a kiln-load of new words, pulled one tap at a time and set with the door shut ----------- */

function kilnLoad(env) {
  const was = pressed(env);
  const need = env.int(3, 4);
  const heat0 = env.pick([20, 50, 80]);
  const bookIndex = env.int(0, BOOKS.length - 1);
  const author = env.pick(AUTHORS);
  const page = env.int(3, 412);
  const holdMs = env.pick([1500, 2000, 2500]);
  // Every word and meaning this piece can pull, by heat and by kind, so the same address makes
  // the same kiln-load.
  const words = [0, 1, 2].map((b) => {
    const list = [];
    for (let i = 0; i < need; i++) list.push(coinAt(env, b));
    return list;
  });
  // The coinage the card was showing is the first one out of this load, at any heat: the word a
  // visitor pressed is the word the kiln hands back first.
  if (was) for (const list of words) list[0] = was.word;
  const defs = {};
  for (const k of KINDS) {
    const pool = DEFS[k.value].slice();
    defs[k.value] = [];
    for (let i = 0; i < need; i++) defs[k.value].push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  }
  const s = { kind: '', heat: heat0 / 100, pulled: [], shut: false, flash: 0, fin: 0, sparks: [], acc: 0, ripple: null };
  function kindLabel() {
    const k = KINDS.find((x) => x.value === s.kind);
    return k ? k.label : 'words';
  }
  const piece = {
    title: was ? was.word + ' and ' + NUM[need - 1] + ' more for ' + BOOKS[bookIndex]
      : NUM[need] + ' words for ' + BOOKS[bookIndex],
    brief: (was ? 'Your coinage comes out first. Pick the kind of word and the heat, tap the fire '
      : 'Pick the kind of word and the heat, tap the fire ')
      + TIMES[need] + ' to pull a coinage out each time, and hold the door shut to set them; they cool on the shelf with their meanings.',
    aspect: '4 / 3',
    steps: [
      { id: 'kind', ask: 'what kind of word it makes', kind: 'choice', options: KINDS },
      { id: 'heat', ask: 'the heat', kind: 'range', min: 0, max: 100, step: 1, value: heat0, low: 'warm', high: 'white' },
      { id: 'pull', ask: 'tap the fire ' + TIMES[need], kind: 'tap', label: 'pull one for me', after: 'kind' },
      { id: 'shut', ask: 'hold the door shut to set them', kind: 'hold', ms: holdMs, label: 'hold the door', after: 'pull' }
    ],
    start(c) {
      c.status('the kiln is warm. tap the fire and see what comes out');
      piece.frame(0, 0, c);
    },
    apply(id, value, c) {
      if (id === 'kind') {
        s.kind = String(value);
        c.status('set to make ' + kindLabel() + ' at ' + HEAT[band(s.heat * 100)] + ' heat');
      }
      if (id === 'heat') {
        s.heat = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(heatLine(band(Number(value)), SHAPE));
      }
      if (id === 'shut' && !s.shut) {
        s.shut = true;
        s.flash = 1;
        burst(c, s, mouthOf(c), 40, 2.2);
        c.status('the door is shut and the fire has the last word');
      }
    },
    tap(x, y, c) {
      if (c.done || s.shut) return;
      s.ripple = { x: x * c.w, y: y * c.h, age: 0 };
      if (s.pulled.length >= need) {
        c.status('the shelf is full; shut the door');
        return;
      }
      if (!s.kind) s.kind = KINDS[0].value;
      const b = band(s.heat * 100);
      const i = s.pulled.length;
      const entry = { word: words[b][i], pos: s.kind, def: defs[s.kind][i], age: 0 };
      s.pulled.push(entry);
      s.flash = 0.8;
      burst(c, s, mouthOf(c), 14 + b * 8, 1 + b * 0.5);
      c.progress('pull', s.pulled.length / need);
      c.status('"' + entry.word + '" (' + entry.pos + ') ' + entry.def);
      if (s.pulled.length >= need) c.satisfy('pull');
    },
    frame(t, dt, c) {
      s.flash = Math.max(0, s.flash - dt * 2.5);
      for (const p of s.pulled) p.age += dt;
      if (s.ripple) s.ripple.age += dt;
      if (c.done) s.fin = Math.min(1, s.fin + dt * 0.9);
      const lit = s.shut ? Math.max(0.1, 1 - s.fin * 0.9) : 1;
      const last = s.pulled.length ? s.pulled[s.pulled.length - 1].word : 'warm';
      const m = scene(c, s, dt, t, lit, s.fin > 0.6 ? 'cold' : last, s.fin);
      const g = c.g;
      if (s.ripple && s.ripple.age < 0.6) {
        const a = 1 - s.ripple.age / 0.6;
        g.strokeStyle = c.alpha(c.colors.accent2, a * 0.6);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(s.ripple.x, s.ripple.y, m.r * 0.15 + (1 - a) * m.r * 0.4, 0, Math.PI * 2);
        g.stroke();
      }
      // The shelf: a heading, then one slot per word, with room under each for its meaning.
      const x0 = c.w * 0.5;
      const width = c.w * 0.46;
      const wordPx = px(c, 0.055, 13);
      const defPx = px(c, 0.04, 10);
      let y = c.h * 0.08;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      font(g, defPx, 'italic 400');
      g.fillStyle = c.alpha(c.colors.muted, 0.8);
      g.fillText(s.kind ? kindLabel() + ' at ' + HEAT[band(s.heat * 100)] + ' heat' : 'nothing pulled yet', x0, y + defPx);
      y += defPx * 2.2;
      g.strokeStyle = c.alpha(c.colors.muted, 0.35);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + width, y);
      g.stroke();
      // One slot per word, with two lines under each for its meaning, fitted above the stamp.
      const ideal = wordPx * 1.35 + defPx * 2.5 + defPx * 0.5;
      const room = c.h * 0.85 - y - wordPx * 1.2 - defPx * 2.5;
      const pitch = need > 1 ? Math.min(ideal, room / (need - 1)) : ideal;
      s.pulled.forEach((p, i) => {
        const k = Math.min(1, p.age * 1.6);
        const e = 1 - (1 - k) * (1 - k);
        const slotY = y + i * pitch + wordPx * 1.2;
        const wx = m.cx + (x0 - m.cx) * e;
        const wy = m.cy + (slotY - m.cy) * e;
        font(g, wordPx, '600');
        g.textAlign = e < 1 ? 'center' : 'left';
        g.fillStyle = c.mix(c.colors.accent2, c.colors.fg, s.fin);
        g.fillText(p.word, wx, wy);
        if (e >= 1) {
          font(g, defPx, 'italic 400');
          g.fillStyle = c.alpha(c.colors.muted, 0.8);
          g.fillText('(' + p.pos + ')', x0 + wordWidth(g, p.word, wordPx) + defPx * 0.5, wy);
          if (s.fin > 0) {
            font(g, defPx, '400');
            g.fillStyle = c.alpha(c.colors.fg, Math.min(1, s.fin * 1.5));
            let dy = wy + defPx * 1.3;
            for (const line of wrap(g, p.def, width, 2)) {
              g.fillText(line, x0, dy);
              dy += defPx * 1.2;
            }
          }
        }
      });
      stamp(c, 'cited by ' + author + ', p. ' + page + '.\nneither the words nor the book exist.', s.fin * 1.5);
    },
    end(c) {
      c.status(NUM[need] + ' words that were never in any dictionary, cooling on the shelf');
      s.fin = Math.max(s.fin, 0.01);
      piece.frame(0, 0, c);
    }
  };
  return piece;
}

// The width of a word in the word font, measured while another font is set.
function wordWidth(g, word, wordPx) {
  const keep = g.font;
  font(g, wordPx, '600');
  const width = g.measureText(word).width;
  g.font = keep;
  return width;
}

export default {
  id: 'word-kiln',
  paint(ctx, w, h, env) {
    const v = env.variant;
    // The mouth where the configuration put it, as wide as it asks, with as many sparks over it.
    kiln(ctx, w, h, env, env.rnd(), {
      cy: h * (0.44 + v.turn * 0.16),
      r: Math.min(w, h) * 0.26 * v.scale,
      sparks: v.density
    });
  },
  spark(env) {
    const pos = env.pick(POS);
    const word = coin(env);
    return {
      title: word,
      text: '(' + pos + ') ' + env.pick(DEFS[pos]) + '.',
      cite: '— ' + env.pick(AUTHORS) + ', ' + env.pick(WORKS) + ', p. ' + env.int(3, 412)
        + '. Neither the word nor the book exists.',
      // What this card is of, for the piece it opens as: the coinage itself.
      of: { word, pos }
    };
  },
  piece(env) {
    return env.chance(0.55) ? fired(env) : kilnLoad(env);
  }
};
