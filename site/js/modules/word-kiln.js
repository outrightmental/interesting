/* The word kiln: letters go into the fire and a word comes out. As a card it is one of the two
   puzzles below (paint, spark); as a piece it is that puzzle, and the card it was opened from says
   which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction, both answered out of the kiln's own book of plain words:

     the anagram   Five to seven letters on tiles over the mouth of the kiln. Fired, they come out
                   as one common word. Any word in the book that uses exactly these tiles is
                   accepted; a wrong check says how many tiles stand where the kiln's own word has
                   them, or that the word is not in the book, and no more. The hints, at a price,
                   are the first letter and then the last.
     the ladder    A word ladder from one four-letter word to another in exactly three steps, one
                   letter changed at a step, every rung a word in the book. The two middle rungs
                   are the answer, and any pair that makes a true ladder is accepted. A wrong
                   check says which step fails and never which word would mend it. The hints, at
                   a price, are which letter one way up changes at each step.

   A card and the feature it opens as are one firing: the spark puts the whole plan on its spec
   as `of` -- the word and the order its tiles were dealt in, or the four rungs -- and piece(env)
   opens on that rather than rolling another. */

// The kiln's book: plain words of five, six and seven letters, the anagrams are drawn from and
// checked against. Lowercase, common, nobody's name.
const BOOK = ('angel angle baker brake break beard bread below elbow canoe ocean cause sauce charm march cheap '
  + 'peach cloud could crate react trace dusty study early layer earth heart horse shore least steal '
  + 'slate stale tales lemon melon night thing stone notes tones onset nerve never north thorn spare '
  + 'spear pears parse share shear smile miles limes swing wings paste tapes cabin dream field flame '
  + 'fruit glass globe grape guard honey house juice light magic money music pearl piano plant sugar '
  + 'sweet table teach tiger truck tulip voice water whale wheel witch world youth listen silent '
  + 'enlist tinsel garden danger gander rescue secure master stream forest foster softer silver '
  + 'sliver drawer reward redraw resist sister solemn remote basket bottle bridge candle carpet '
  + 'castle cheese cherry circle copper cradle dinner engine fabric finger hammer island jacket '
  + 'jungle kettle kitten ladder letter magnet marble market meadow mirror needle orange pebble '
  + 'pencil pepper pillow planet pocket potato puzzle rabbit ribbon rocket saddle sailor salmon '
  + 'school shadow spider spring string summer sunset temple ticket timber tongue tunnel turtle '
  + 'valley velvet violin walnut winter yellow allergy gallery largely altered related another '
  + 'balance blanket bracket cabinet captain chimney cottage country curtain diamond feather freedom '
  + 'harvest history holiday journey kingdom kitchen thicken lantern leather library machine mineral '
  + 'mustard notices section nothing octopus orchard painter pertain repaint pattern penguin picture '
  + 'pioneer plaster present serpent problem quarter rainbow satchel scatter shelter silence station '
  + 'strange teacher thunder trouble village vinegar whisper').split(' ');
// The rungs: four-letter words a ladder may stand on, well enough connected that a walk of three
// steps leaves any of them.
const RUNGS = ('bake ball band bare bear beat bend bent best bind bold bond bore cake call came cane cape care '
  + 'case cast cave cold cord core dare date deal dear dent dine fade fail fall fame fare fast fate '
  + 'file fill find fine fire fold fond food ford fore gale game gate gave gear gold good hail hall '
  + 'hare heal hear heat hide hill hire hold hole hood lace lake land lane last late lend line link '
  + 'made mail make male mane mare mast mate meal meat mend mile mill mind mine mold mole more nail '
  + 'name near neat nest nine pace page pail pale pane past pear pile pill pine pink pole pore race '
  + 'rage rail rake rare rate real rent rest rice ride rink ripe rise rode role rope rose safe sage '
  + 'sail sale same sand sane save seal seat send sent side sink sold sole sore tail take tale tall '
  + 'tame tape tear tend tent test tide tile till time tire vast vest vine wade wage wake wall wand '
  + 'wave wear went west wide will wind wine wink wire wise wood word wore work worm worn year').split(' ');
const IN_BOOK = new Set(BOOK);
const IN_RUNGS = new Set(RUNGS);
const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

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

function clean(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z]/g, '');
}

function sorted(word) {
  return word.split('').sort().join('');
}

function diff(a, b) {
  let d = 0;
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) d += 1;
  return d;
}

function neighbours(word) {
  return RUNGS.filter((w) => diff(w, word) === 1);
}

/* The motion of the rite (README: "Motion axiom"): nothing here moves along a formula. A curve is
   a polyline -- a hesitation, a surge, a stutter, a settle -- and riteCurve rolls one from a seed,
   so the tiles' fall into the kiln, their cooling into their slots and a ladder's rungs lighting
   each run their own way for every piece and the same way every time that piece is played.
   Rolled from the seed and never from env.rnd, so the puzzle a seed deals is untouched by it;
   `ease` is the one baked curve a preview falls back on. */
function along(stops) {
  return (t) => {
    if (!(t > 0)) return stops[0][1];
    if (t >= 1) return stops[stops.length - 1][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, y0] = stops[i - 1];
        const [t1, y1] = stops[i];
        return t1 > t0 ? y0 + (y1 - y0) * ((t - t0) / (t1 - t0)) : y1;
      }
    }
    return 1;
  };
}

// The kiln's movements run on env.rite (README: "Motion axiom"): the heat is a series of levels
// that flicker, never a sine; a tile fires by its area through the matte and cools in treads; a
// rung lights in treads. `frac` is where in a period a clock stands.
function frac(x) {
  return x - Math.floor(x);
}

function riteCurve(seed, over) {
  let a = (seed >>> 0) || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  const stops = [[0, 0]];
  let at = 0;
  const put = (t, y) => {
    at = Math.min(0.99, Math.max(at, t));
    stops.push([at, y]);
  };
  if (rnd() < 0.7) put(between(0.03, 0.14), between(0, 0.02)); // the hesitation
  const peak = between(0.45, 0.7);
  const high = over ? 1 + between(0.02, 0.1) : 1;
  put(at + (peak - at) * between(0.3, 0.55), high * between(0.45, 0.7)); // the surge
  if (rnd() < 0.6) put(at + between(0.02, 0.06), stops[stops.length - 1][1]); // the stutter
  put(peak, high);
  if (over) put(peak + (1 - peak) * between(0.3, 0.6), 1 - (high - 1) * 0.4); // the settle
  put(between(0.86, 0.96), over ? 1 : between(0.96, 1));
  stops.push([1, 1]);
  return along(stops);
}

const ease = along([[0, 0], [0.1, 0.02], [0.38, 0.64], [0.45, 0.58], [0.62, 1], [0.8, 0.97], [1, 1]]);

/* ---- the kiln's mouth and its ember -------------------------------------------------------- */

function kiln(g, w, h, env, heat, o) {
  const c = env.colors;
  const cx = o.cx;
  const cy = o.cy;
  const r = o.r;
  const lit = o.lit == null ? 1 : o.lit;
  const ground = g.createRadialGradient(cx, cy + r * 0.7, 0, cx, cy + r * 0.7, Math.max(w, h) * 0.8);
  ground.addColorStop(0, env.mix(c.bg, c.accent, 0.18 * (0.3 + 0.7 * lit)));
  ground.addColorStop(1, c.bg);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
  g.fillStyle = env.mix(c.bg, '#000', 0.4);
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = env.alpha(c.accent, 0.25 + 0.15 * lit);
  g.lineWidth = 2;
  g.stroke();
  const ember = g.createRadialGradient(cx, cy + r * 0.2, 0, cx, cy + r * 0.2, r * 0.8);
  ember.addColorStop(0, env.alpha(c.accent2, (0.55 + heat * 0.45) * lit));
  ember.addColorStop(0.4, env.alpha(c.accent, (0.35 + heat * 0.4) * lit));
  ember.addColorStop(1, env.alpha(c.accent, 0));
  g.fillStyle = ember;
  g.beginPath();
  g.ellipse(cx, cy, r * 0.95, r * 0.88, 0, 0, Math.PI * 2);
  g.fill();
}

// Embers over the mouth, laid by a fixed sequence: as many as the configuration asks, drifting
// where it says, and rising with the finale.
function embers(g, env, cx, cy, r, v, phase, lit) {
  const c = env.colors;
  const count = Math.round(18 * v.density);
  for (let i = 0; i < count; i++) {
    const x = cx + (((i * 0.6180339 + 0.13) % 1) - 0.5) * r * 2.2;
    const y = cy - r * 0.4 - ((i * 0.7548777 + v.turn + phase * 0.6) % 1) * r * 1.8;
    g.fillStyle = env.alpha(c.accent2, (0.12 + ((i * 0.41) % 1) * 0.35) * lit);
    g.beginPath();
    g.arc(x, y, (0.6 + ((i * 0.37) % 1)) * v.scale, 0, Math.PI * 2);
    g.fill();
  }
}

function font(g, size, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
}

function px(c, w, h, k, floor) {
  return Math.max(floor, Math.round(Math.min(w, h) * k));
}

function tile(g, env, x, y, size, letter, lit, tilt, own) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.rotate(tilt || 0);
  g.fillStyle = env.mix(c.bg2, c.accent2, 0.13);
  g.fillRect(-size / 2, -size * 0.6, size, size * 1.2);
  // The glow of a firing tile develops by its area, the cells its own matte lets through at the
  // coverage it has reached, never by a tint brightening.
  if (lit > 0 && own) {
    g.save();
    g.beginPath();
    g.rect(-size / 2, -size * 0.6, size, size * 1.2);
    g.clip();
    own.paint(g, -size / 2, -size * 0.6, size, size * 1.2, lit, env.mix(c.bg2, c.accent2, 0.63));
    g.restore();
  } else if (lit > 0) {
    // No roll to hand (no harness or stage is without one): the tint still moves in four treads.
    g.fillStyle = env.mix(c.bg2, c.accent2, 0.13 + (Math.ceil(lit * 4) / 4) * 0.5);
    g.fillRect(-size / 2, -size * 0.6, size, size * 1.2);
  }
  g.strokeStyle = lit > 0.5 ? c.accent2 : env.alpha(c.accent, 0.8);
  g.lineWidth = 1;
  g.strokeRect(-size / 2, -size * 0.6, size, size * 1.2);
  if (letter) {
    font(g, size * 0.78, '600');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = lit > 0.5 ? c.bg : c.fg;
    g.fillText(letter, 0, 0);
  }
  g.restore();
}

function slot(g, env, x, y, size, letter) {
  const c = env.colors;
  g.strokeStyle = env.alpha(c.muted, 0.6);
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(x - size / 2, y - size * 0.6, size, size * 1.2);
  g.setLineDash([]);
  if (letter) {
    font(g, size * 0.78, '600');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = c.fg;
    g.fillText(letter, x, y);
  }
}

function caption(g, env, w, h, text, y, tone, size) {
  font(g, size, '500');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = tone;
  g.fillText(text, w / 2, y);
}

/* ---- the anagram ---------------------------------------------------------------------------- */

function shuffled(word, env) {
  const t = word.split('');
  for (let i = t.length - 1; i > 0; i--) {
    const j = env.int(0, i);
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t.join('');
}

function anagramPlan(env) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const word = env.pick(BOOK);
    const tiles = shuffled(word, env);
    if (tiles !== word && !IN_BOOK.has(tiles)) return { kind: 'anagram', word, tiles };
  }
  return { kind: 'anagram', word: 'stone', tiles: 'tsnoe' };
}

function carriedAnagram(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'anagram' || typeof p.word !== 'string' || typeof p.tiles !== 'string') return null;
  const word = clean(p.word);
  const tiles = clean(p.tiles);
  if (!IN_BOOK.has(word) || tiles.length !== word.length || sorted(tiles) !== sorted(word) || IN_BOOK.has(tiles)) return null;
  return { kind: 'anagram', word, tiles };
}

function anagramTitle(plan) {
  return 'the anagram: ' + WORDS[plan.tiles.length] + ' tiles, one firing';
}

// Which slot of the fired word each tile goes to: the first unused tile with that letter.
function slotsFor(tiles, word) {
  const used = new Array(tiles.length).fill(false);
  const slots = new Array(tiles.length).fill(0);
  for (let k = 0; k < word.length; k++) {
    for (let i = 0; i < tiles.length; i++) {
      if (!used[i] && tiles[i] === word[k]) {
        used[i] = true;
        slots[i] = k;
        break;
      }
    }
  }
  return slots;
}

function anagramScene(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const n = plan.tiles.length;
  const cx = w / 2;
  const cy = h * 0.72;
  const r = Math.min(w, h) * 0.2 * v.scale;
  const cooledRaw = s.phase > 0.4 ? (s.cool || ease)((s.phase - 0.4) / 0.6) : 0;
  // The kiln goes dark in treads as the tiles cool, never a dimming.
  const cooled = env.rite ? env.rite.at(0xc001).stair(cooledRaw) : cooledRaw;
  kiln(g, w, h, env, s.heat, { cx, cy, r, lit: 1 - cooled * 0.7 });
  // The embers rise with the finale in treads of the kiln's own roll, never a drift.
  embers(g, env, cx, cy, r, v, env.rite ? env.rite.at(0xe3be).stair(s.phase, 9) : s.phase, 1 - cooled * 0.8);
  const size = Math.min(h * 0.13 * v.scale, (w * 0.84) / n / 1.15);
  const rackY = h * 0.2;
  const slotY = h * 0.44;
  const small = px(env, w, h, 0.036, 10);
  const place = (k, y) => cx + (k - (n - 1) / 2) * size * 1.15;
  caption(g, env, w, h, s.phase > 0 ? 'fired' : 'in the kiln', rackY - size * 1.0, env.alpha(c.muted, 0.9), small);
  if (s.phase === 0) {
    // The slots the word is typed into, and the hints over them.
    for (let k = 0; k < n; k++) {
      slot(g, env, place(k, slotY), slotY, size * 0.8, s.guess[k] || '');
      const which = k === 0 ? 1 : k === n - 1 ? 2 : 0;
      const shown = which > 0 && s.hints >= which;
      // A shown letter blinks on, a flicker of its own roll, from the moment it was asked for.
      const askedAt = shown && s.hintAt ? s.hintAt[which] : null;
      const age = askedAt == null || !s.t || env.reduced ? 1 : Math.min(1, (s.t - askedAt) / 0.9);
      if (shown && (env.rite ? env.rite.at(0x4171 + which).flicker(age) : 1)) {
        font(g, small, '500');
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = c.accent2;
        g.fillText(plan.word[k], place(k, slotY), slotY - size * 0.8);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    let x = place(i, rackY);
    let y = rackY;
    let tilt = 0;
    let lit = 0;
    if (s.phase > 0) {
      const to = s.slots ? place(s.slots[i], slotY) : x;
      // Each tile has a roll of its own: it drops into the kiln along its own glitch of a curve
      // (a travel, which may hesitate and overshoot) and lights by its area through its own
      // matte in treads; it climbs out to its slot in clicks.
      const own = env.rite ? env.rite.at(0x7e11 + i * 5) : null;
      if (s.phase < 0.4) {
        const f = own ? own.ease(s.phase / 0.4) : (s.fire || ease)(s.phase / 0.4);
        x += (cx + (i - (n - 1) / 2) * r * 0.3 - x) * f;
        y += (cy - y) * f;
        // It tumbles as it falls in clicks (the roll's ratchet), never an even turn.
        tilt = (own ? own.turn(s.phase / 0.4) : f) * (i % 2 ? -1 : 1) * 1.2;
        lit = own ? own.stair(s.phase / 0.4) : f;
      } else {
        const f = own ? own.ratchet((s.phase - 0.4) / 0.6) : (s.cool || ease)((s.phase - 0.4) / 0.6);
        x = cx + (i - (n - 1) / 2) * r * 0.3 + (to - (cx + (i - (n - 1) / 2) * r * 0.3)) * f;
        y = cy + (slotY - cy) * f;
        tilt = (1 - f) * (i % 2 ? -1 : 1) * 1.2;
        lit = 1;
      }
    }
    tile(g, env, x, y, size, plan.tiles[i], lit, tilt, env.rite ? env.rite.at(0x7e11 + i * 5) : null);
  }
  caption(g, env, w, h, s.phase >= 1 ? 'it is a kiln, not a dictionary' : s.line, h * 0.95, env.alpha(c.muted, 0.9), small);
}

function anagramPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  anagramScene(g, w, h, env, plan, { heat: 0.4 + v.turn * 0.4, phase: 0, guess: '', hints: 0, slots: null, line: 'one common word; the book decides' }, v);
}

function anagramPiece(env, plan) {
  const helps = Math.min(2, asked(env).helps);
  const n = plan.tiles.length;
  // The firing and the cooling each run along a curve rolled for this piece (see riteCurve).
  const s = { heat: 0.5, phase: 0, guess: '', hints: 0, slots: null, fired: '', line: 'tap nothing; type the word and check it', t: 0,
    fire: riteCurve((env.seed >>> 0) ^ 0x7e11), cool: riteCurve((env.seed >>> 0) ^ 0xc001) };
  const draw = (c) => anagramScene(c.g, c.w, c.h, c, plan, s, env.variant);
  function right(typed) {
    let count = 0;
    for (let i = 0; i < n && i < typed.length; i++) if (typed[i] === plan.word[i]) count += 1;
    return count;
  }
  return {
    title: anagramTitle(plan),
    brief: 'A small firing. ' + WORDS[n][0].toUpperCase() + WORDS[n].slice(1) + ' tiles sit over the mouth of the kiln; fired, they come out as one common word, and the kiln keeps a book of plain words to check it against. Any word in the book that uses exactly these tiles will do.',
    goal: 'Find the word these tiles fire into.',
    aspect: '4 / 3',
    checkLabel: 'fire it',
    steps: [
      { id: 'word', ask: 'the word the tiles fire into', kind: 'word', length: n, placeholder: '_'.repeat(n), upper: false },
      { id: 'hint', ask: 'the first letter, then the last', kind: 'press', count: 1, label: 'show a letter', optional: true }
    ],
    solution: { word: plan.word },
    check(c) {
      const typed = clean(c.value('word'));
      if (typed.length !== n || sorted(typed) !== sorted(plan.tiles)) {
        return { solved: false, say: typed.length !== n ? 'the kiln holds ' + WORDS[n] + ' tiles, no more and no fewer' : 'those are not the tiles laid in the kiln' };
      }
      if (!IN_BOOK.has(typed)) {
        const k = right(typed);
        return { solved: false, say: 'the kiln\'s book holds no such word; ' + (k === 0 ? 'no tile stands in the right place' : k === 1 ? 'one tile stands in the right place' : WORDS[k] + ' tiles stand in the right place') };
      }
      return { solved: true, say: 'fired: ' + typed + (typed === plan.word ? '' : '. the kiln had ' + plan.word + ' in mind, and both are in the book') };
    },
    start(c) {
      c.status(WORDS[n] + ' tiles in the kiln');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'word') {
        s.guess = clean(value).slice(0, n);
        c.status(s.guess ? s.guess + ', not yet fired' : 'nothing typed yet');
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          s.hints += 1;
          s.hintAt = s.hintAt || {};
          s.hintAt[s.hints] = s.t;
          c.hint();
          c.status(s.hints === 1 ? 'the word starts with ' + plan.word[0] : 'and it ends with ' + plan.word[n - 1]);
        } else if (helps < 2) {
          c.status('that is all the kiln will show at this difficulty; the rest is yours');
        } else c.status('both ends are shown; the middle is yours');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (!c.reduced && c.rite) {
        const slow = c.rite.at(0x4ea7);
        const quick = c.rite.at(0x4ea8);
        s.heat = 0.46 + 0.08 * slow.stair(frac(s.t / 2.6)) + 0.04 * quick.flicker(frac(s.t / 0.7));
      }
      if (c.done) s.phase = Math.min(1, s.phase + dt / (c.reduced ? 0.5 : 3.2));
      draw(c);
    },
    end(c) {
      s.fired = clean(c.value('word')) || plan.word;
      if (sorted(s.fired) !== sorted(plan.tiles)) s.fired = plan.word;
      s.slots = slotsFor(plan.tiles, s.fired);
      c.status('fired: ' + s.fired + '. it is a kiln, not a dictionary.');
    }
  };
}

/* ---- the ladder ------------------------------------------------------------------------------ */

function ladderPlan(env) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const a = env.pick(RUNGS);
    const n1 = neighbours(a);
    if (!n1.length) continue;
    const w1 = env.pick(n1);
    const n2 = neighbours(w1).filter((w) => w !== a);
    if (!n2.length) continue;
    const w2 = env.pick(n2);
    const n3 = neighbours(w2).filter((w) => w !== a && w !== w1);
    if (!n3.length) continue;
    const b = env.pick(n3);
    // A real climb, if one is to be had: the two ends more than a step apart.
    if (diff(a, b) < 2 && attempt < 40) continue;
    return { kind: 'ladder', rungs: [a, w1, w2, b] };
  }
  return { kind: 'ladder', rungs: ['cold', 'cord', 'core', 'care'] };
}

function validLadder(rungs) {
  if (!Array.isArray(rungs) || rungs.length !== 4) return false;
  if (!rungs.every((w) => typeof w === 'string' && IN_RUNGS.has(w))) return false;
  if (new Set(rungs).size !== 4) return false;
  for (let i = 0; i < 3; i++) if (diff(rungs[i], rungs[i + 1]) !== 1) return false;
  return true;
}

function carriedLadder(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'ladder' || !Array.isArray(p.rungs)) return null;
  const rungs = p.rungs.map((w) => clean(w));
  return validLadder(rungs) ? { kind: 'ladder', rungs } : null;
}

function ladderTitle(plan) {
  return 'the ladder: ' + plan.rungs[0] + ' to ' + plan.rungs[3];
}

function changedAt(a, b) {
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return i;
  return -1;
}

function ladderScene(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const m = Math.min(w, h);
  const cx = w / 2;
  const r = m * 0.24 * v.scale;
  const litStep = env.rite ? env.rite.at(0x11ad).stair(s.lit) : s.lit;
  kiln(g, w, h, env, 0.6, { cx, cy: h * 0.92, r, lit: 0.6 + litStep * 0.4 });
  embers(g, env, cx, h * 0.92, r, v, env.rite ? env.rite.at(0xe3be).stair(s.phase, 9) : s.phase, 0.7 + litStep * 0.3);
  const small = px(env, w, h, 0.036, 10);
  const size = Math.min((w * 0.5) / 4 / 1.1, h * 0.1 * v.scale);
  const railX = [cx - w * 0.3, cx + w * 0.3];
  g.strokeStyle = env.alpha(c.muted, 0.7);
  g.lineWidth = Math.max(2, m * 0.012);
  g.beginPath();
  for (const x of railX) {
    g.moveTo(x, h * 0.08);
    g.lineTo(x, h * 0.8);
  }
  g.stroke();
  // The rungs, bottom to top: the start, the two the visitor fills, the end.
  const words = [plan.rungs[0], s.first, s.second, plan.rungs[3]];
  const fixed = [true, false, false, true];
  for (let k = 0; k < 4; k++) {
    const y = h * (0.71 - k * 0.19);
    g.strokeStyle = env.alpha(c.muted, 0.7);
    g.lineWidth = Math.max(2, m * 0.01);
    g.beginPath();
    g.moveTo(railX[0], y);
    g.lineTo(railX[1], y);
    g.stroke();
    // Each rung lights on a roll of its own, in treads, as the climb reaches it.
    const rung = env.rite ? env.rite.at(0x1add + k * 11) : null;
    const reach = Math.max(0, Math.min(1, (s.phase * 4 - k) / 1.2));
    const lit = s.phase > 0 ? (rung ? rung.stair(reach) : (s.climb || ease)(reach)) : 0;
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * size * 1.1;
      const letter = words[k][i] || '';
      if (fixed[k] || s.phase > 0) {
        // At the finale the letter each step changed glows.
        const below = k > 0 ? words[k - 1] : null;
        const changed = s.phase > 0 && below && below.length === 4 && below[i] !== words[k][i];
        tile(g, env, x, y, size, letter, changed ? lit : lit * 0.4, 0, rung ? rung.at(i + 1) : null);
      } else slot(g, env, x, y, size, letter);
      // A hint: the letter one way up changes at this step, marked on the rung below it.
      if (k < 3 && s.hints > k && s.phase === 0) {
        const at = changedAt(plan.rungs[k], plan.rungs[k + 1]);
        // The mark blinks on, a flicker of the rung's own roll, from the moment it was asked for.
        const askedAt = s.hintAt ? s.hintAt[k + 1] : null;
        const age = askedAt == null || !s.t || env.reduced ? 1 : Math.min(1, (s.t - askedAt) / 0.9);
        if (at === i && (rung ? rung.at(0x4171).flicker(age) : 1)) {
          g.fillStyle = c.accent2;
          g.beginPath();
          g.moveTo(x, y - size * 0.75);
          g.lineTo(x - size * 0.18, y - size * 0.95);
          g.lineTo(x + size * 0.18, y - size * 0.95);
          g.closePath();
          g.fill();
        }
      }
    }
    font(g, small, '500');
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = env.alpha(c.muted, 0.9);
    // The rung's name beside the rail, or the short form where a narrow scene leaves it no room.
    const name = k === 0 ? 'start' : k === 3 ? 'end' : k === 1 ? 'first rung' : 'second rung';
    const fits = railX[0] - small * 0.6 - g.measureText(name).width >= small * 0.4;
    g.fillText(fits ? name : (k === 1 ? 'rung 1' : k === 2 ? 'rung 2' : name), railX[0] - small * 0.6, y);
  }
  caption(g, env, w, h, s.phase >= 1 ? 'one letter a step; the book holds every rung' : s.line, h * 0.86, env.alpha(c.muted, 0.9), small);
}

function ladderPreview(g, w, h, env, plan) {
  ladderScene(g, w, h, env, plan, { first: '', second: '', hints: 0, phase: 0, lit: 0, line: 'three steps, one letter each' }, env.variant);
}

function ladderPiece(env, plan) {
  const helps = Math.min(3, asked(env).helps);
  const a = plan.rungs[0];
  const b = plan.rungs[3];
  // The rungs light along a curve rolled for this piece (see riteCurve).
  const s = { first: '', second: '', hints: 0, phase: 0, lit: 0, t: 0, line: 'change one letter a step; every rung a word',
    climb: riteCurve((env.seed >>> 0) ^ 0x1add) };
  const draw = (c) => ladderScene(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: ladderTitle(plan),
    brief: 'A small climb, by the book. A word ladder from ' + a + ' to ' + b + ' in exactly three steps. Each step changes one letter and keeps the other three where they are, and every rung is a word in the kiln\'s book. Any two middle rungs that make a true ladder will do.',
    goal: 'Fill the two middle rungs so that each step changes one letter and every rung is a word.',
    aspect: '3 / 4',
    checkLabel: 'climb it',
    steps: [
      { id: 'first', ask: 'the first rung, one letter from ' + a, kind: 'word', length: 4, placeholder: '____', upper: false },
      { id: 'second', ask: 'the second rung, one letter from ' + b, kind: 'word', length: 4, placeholder: '____', upper: false },
      { id: 'hint', ask: 'which letter changes, one way up', kind: 'press', count: 1, label: 'show a step', optional: true }
    ],
    solution: { first: plan.rungs[1], second: plan.rungs[2] },
    check(c) {
      const f = clean(c.value('first'));
      const g2 = clean(c.value('second'));
      const problems = [];
      if (!IN_RUNGS.has(f)) problems.push('the first rung is not a word in the kiln\'s book');
      if (!IN_RUNGS.has(g2)) problems.push('the second rung is not a word in the kiln\'s book');
      if (f.length === 4 && diff(a, f) !== 1) problems.push('the first rung is not one letter from the start');
      if (f.length === 4 && g2.length === 4 && diff(f, g2) !== 1) problems.push('the two rungs are not one letter apart');
      if (g2.length === 4 && diff(g2, b) !== 1) problems.push('the second rung is not one letter from the end');
      if (new Set([a, f, g2, b]).size !== 4) problems.push('a rung repeats a word already on the ladder');
      if (problems.length) return { solved: false, say: problems.slice(0, 2).join('; ') };
      return { solved: true, say: a + ', ' + f + ', ' + g2 + ', ' + b + ': the ladder holds' };
    },
    start(c) {
      c.status(a + ' to ' + b + ' in three steps');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'first') {
        s.first = clean(value).slice(0, 4);
        c.status(s.first ? 'first rung: ' + s.first : 'nothing on the first rung yet');
      }
      if (id === 'second') {
        s.second = clean(value).slice(0, 4);
        c.status(s.second ? 'second rung: ' + s.second : 'nothing on the second rung yet');
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          const at = changedAt(plan.rungs[s.hints], plan.rungs[s.hints + 1]) + 1;
          s.hints += 1;
          s.hintAt = s.hintAt || {};
          s.hintAt[s.hints] = s.t;
          c.hint();
          c.status((s.hints === 1 ? 'one way up: the first step changes letter ' : s.hints === 2 ? 'then the second step changes letter ' : 'and the last step changes letter ') + at);
        } else if (s.hints >= helps) {
          c.status('that is all the kiln will show at this difficulty; the words are yours');
        } else c.status('every step has been shown; the words are yours');
      }
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.phase = Math.min(1, s.phase + dt / (c.reduced ? 0.5 : 2.5));
        s.lit = Math.min(1, s.lit + dt);
      }
      draw(c);
    },
    end(c) {
      s.first = clean(c.value('first')) || plan.rungs[1];
      s.second = clean(c.value('second')) || plan.rungs[2];
      c.status('the ladder holds: ' + [a, s.first, s.second, b].join(', ') + '. one letter a step, and every rung in the book.');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function deal(env) {
  return env.chance(0.5) ? anagramPlan(env) : ladderPlan(env);
}

export default {
  id: 'word-kiln',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'anagram') anagramPreview(g, w, h, env, plan);
    else ladderPreview(g, w, h, env, plan);
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'anagram') {
      return {
        title: anagramTitle(plan),
        mono: plan.tiles.split('').join('  '),
        text: WORDS[plan.tiles.length][0].toUpperCase() + WORDS[plan.tiles.length].slice(1) + ' letters laid in the kiln for one firing. They come out as one common word, and any word in the book that uses exactly these will do.',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => anagramPreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    return {
      title: ladderTitle(plan),
      mono: plan.rungs[0] + '\n____\n____\n' + plan.rungs[3],
      text: 'Three steps, one letter changed at each, every rung a word in the kiln\'s book. Fill the two middle rungs and the climb holds.',
      aspect: '3 / 4',
      paint: (g, w, h, cardEnv) => ladderPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const anagram = carriedAnagram(env);
    if (anagram) return anagramPiece(env, anagram);
    const ladder = carriedLadder(env);
    if (ladder) return ladderPiece(env, ladder);
    const plan = deal(env);
    return plan.kind === 'anagram' ? anagramPiece(env, plan) : ladderPiece(env, plan);
  }
};
