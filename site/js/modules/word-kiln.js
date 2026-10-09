/* The word kiln: letters go into the fire and a word comes out. As a card it is one of the two
   puzzles below (paint, spark); as a piece it is that puzzle, and the card it was opened from says
   which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction, both answered out of the kiln's own book of plain words:

     the anagram   Five to seven letters on tiles over the mouth of the kiln. Fired, they come out
                   as one common word. Any word in the book that uses exactly these tiles is
                   accepted; a wrong check says how many tiles stand where the kiln's own word has
                   them, or that the word is not in the book, and no more. The hints, at a price,
                   are the first letter and then the last.
     the ladder    A word ladder between four-letter words in three or four steps, one letter
                   changed at each step, every rung a word in the book. The visitor supplies the
                   two or three middle rungs; any complete climb holds. A wrong check counts
                   valid words and single-letter steps without naming a missing rung. Hints, at
                   a price, mark which letter changes on one step at a time.

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

function tile(g, env, x, y, size, letter, lit, tilt) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.rotate(tilt || 0);
  g.fillStyle = env.mix(c.bg2, c.accent2, 0.13 + lit * 0.5);
  g.fillRect(-size / 2, -size * 0.6, size, size * 1.2);
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
  const cooled = s.phase > 0.4 ? (s.cool || ease)((s.phase - 0.4) / 0.6) : 0;
  kiln(g, w, h, env, s.heat, { cx, cy, r, lit: 1 - cooled * 0.7 });
  embers(g, env, cx, cy, r, v, s.phase, 1 - cooled * 0.8);
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
      const shown = (k === 0 && s.hints >= 1) || (k === n - 1 && s.hints >= 2);
      if (shown) {
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
      if (s.phase < 0.4) {
        const f = (s.fire || ease)(s.phase / 0.4);
        x += (cx + (i - (n - 1) / 2) * r * 0.3 - x) * f;
        y += (cy - y) * f;
        tilt = f * (i % 2 ? -1 : 1) * 1.2;
        lit = f;
      } else {
        const f = (s.cool || ease)((s.phase - 0.4) / 0.6);
        x = cx + (i - (n - 1) / 2) * r * 0.3 + (to - (cx + (i - (n - 1) / 2) * r * 0.3)) * f;
        y = cy + (slotY - cy) * f;
        tilt = (1 - f) * (i % 2 ? -1 : 1) * 1.2;
        lit = 1;
      }
    }
    tile(g, env, x, y, size, plan.tiles[i], lit, tilt);
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
      if (!c.reduced) s.heat = 0.5 + Math.sin(s.t * 3.1) * 0.05 + Math.sin(s.t * 7) * 0.04;
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
  const length = env.chance(0.4) ? 5 : 4;
  for (let attempt = 0; attempt < 80; attempt++) {
    const rungs = [env.pick(RUNGS)];
    while (rungs.length < length) {
      const next = neighbours(rungs[rungs.length - 1]).filter((word) => !rungs.includes(word));
      if (!next.length) break;
      rungs.push(env.pick(next));
    }
    if (rungs.length === length && diff(rungs[0], rungs[length - 1]) >= 2) {
      return { kind: 'ladder', rungs };
    }
  }
  return { kind: 'ladder', rungs: length === 5
    ? ['cold', 'cord', 'core', 'care', 'bare'] : ['cold', 'cord', 'core', 'care'] };
}

function validLadder(rungs) {
  if (!Array.isArray(rungs) || (rungs.length !== 4 && rungs.length !== 5)) return false;
  if (!rungs.every((w) => typeof w === 'string' && IN_RUNGS.has(w))) return false;
  if (new Set(rungs).size !== rungs.length) return false;
  for (let i = 0; i < rungs.length - 1; i++) if (diff(rungs[i], rungs[i + 1]) !== 1) return false;
  return true;
}

function carriedLadder(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'ladder' || !Array.isArray(p.rungs)) return null;
  const rungs = p.rungs.map((w) => clean(w));
  return validLadder(rungs) ? { kind: 'ladder', rungs } : null;
}

function ladderTitle(plan) {
  return 'the ladder: ' + plan.rungs[0] + ' to ' + plan.rungs[plan.rungs.length - 1]
    + (plan.rungs.length === 5 ? ' in four steps' : '');
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
  kiln(g, w, h, env, 0.6, { cx, cy: h * 0.92, r, lit: 0.6 + s.lit * 0.4 });
  embers(g, env, cx, h * 0.92, r, v, s.phase, 0.7 + s.lit * 0.3);
  const small = px(env, w, h, 0.036, 10);
  const n = plan.rungs.length;
  const size = Math.min((w * 0.5) / 4 / 1.1, h * (n === 5 ? 0.085 : 0.1) * v.scale);
  const railX = [cx - w * 0.3, cx + w * 0.3];
  g.strokeStyle = env.alpha(c.muted, 0.7);
  g.lineWidth = Math.max(2, m * 0.012);
  g.beginPath();
  for (const x of railX) {
    g.moveTo(x, h * 0.08);
    g.lineTo(x, h * 0.8);
  }
  g.stroke();
  // The rungs, bottom to top: the start, the visitor's middle rungs, the end.
  const words = [plan.rungs[0], s.first, s.second];
  if (n === 5) words.push(s.third);
  words.push(plan.rungs[n - 1]);
  for (let k = 0; k < n; k++) {
    const y = h * ((n === 5 ? 0.75 : 0.71) - k * (n === 5 ? 0.16 : 0.19));
    g.strokeStyle = env.alpha(c.muted, 0.7);
    g.lineWidth = Math.max(2, m * 0.01);
    g.beginPath();
    g.moveTo(railX[0], y);
    g.lineTo(railX[1], y);
    g.stroke();
    const lit = s.phase > 0 ? (s.climb || ease)((s.phase * (n + 0.3) - k) / 1.2) : 0;
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * size * 1.1;
      const letter = words[k][i] || '';
      if (k === 0 || k === n - 1 || s.phase > 0) {
        // At the finale the letter each step changed glows.
        const below = k > 0 ? words[k - 1] : null;
        const changed = s.phase > 0 && below && below.length === 4 && below[i] !== words[k][i];
        tile(g, env, x, y, size, letter, changed ? lit : lit * 0.4, 0);
      } else slot(g, env, x, y, size, letter);
      // A hint: the letter one way up changes at this step, marked on the rung below it.
      if (k < n - 1 && s.hints > k && s.phase === 0) {
        const at = changedAt(plan.rungs[k], plan.rungs[k + 1]);
        if (at === i) {
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
    const name = k === 0 ? 'start' : k === n - 1 ? 'end' : k === 1 ? 'first rung' : k === 2 ? 'second rung' : 'third rung';
    const fits = railX[0] - small * 0.6 - g.measureText(name).width >= small * 0.4;
    g.fillText(fits ? name : 'rung ' + k, railX[0] - small * 0.6, y);
  }
  caption(g, env, w, h, s.phase >= 1 ? 'one letter a step; the book holds every rung' : s.line, h * 0.86, env.alpha(c.muted, 0.9), small);
}

function ladderPreview(g, w, h, env, plan) {
  ladderScene(g, w, h, env, plan, { first: '', second: '', third: '', hints: 0, phase: 0, lit: 0,
    line: (plan.rungs.length - 1) + ' steps, one letter each' }, env.variant);
}

function ladderPiece(env, plan) {
  const n = plan.rungs.length;
  const helps = Math.min(n - 1, asked(env).helps);
  const a = plan.rungs[0];
  const b = plan.rungs[n - 1];
  // The rungs light along a curve rolled for this piece (see riteCurve).
  const s = { first: '', second: '', third: '', hints: 0, phase: 0, lit: 0, line: 'change one letter a step; every rung a word',
    climb: riteCurve((env.seed >>> 0) ^ 0x1add) };
  const draw = (c) => ladderScene(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: ladderTitle(plan),
    brief: 'A word ladder from ' + a + ' to ' + b + ' in exactly ' + (n - 1) + ' steps. Each step changes one letter and keeps the other three where they are. Every rung must be a word in the kiln\'s book; any complete climb will do.',
    goal: 'Fill the ' + (n === 5 ? 'three' : 'two') + ' middle rungs so each step changes one letter and every rung is a word.',
    aspect: '3 / 4',
    checkLabel: 'climb it',
    steps: [
      { id: 'first', ask: 'the first rung, one letter from ' + a, kind: 'word', length: 4, placeholder: '____', upper: false },
      { id: 'second', ask: n === 5 ? 'the second rung, between the others' : 'the second rung, one letter from ' + b, kind: 'word', length: 4, placeholder: '____', upper: false },
      ...(n === 5 ? [{ id: 'third', ask: 'the third rung, one letter from ' + b, kind: 'word', length: 4, placeholder: '____', upper: false }] : []),
      { id: 'hint', ask: 'which letter changes, one way up', kind: 'press', count: 1, label: 'show a step', optional: true }
    ],
    solution: n === 5 ? { first: plan.rungs[1], second: plan.rungs[2], third: plan.rungs[3] }
      : { first: plan.rungs[1], second: plan.rungs[2] },
    check(c) {
      const middle = [clean(c.value('first')), clean(c.value('second'))];
      if (n === 5) middle.push(clean(c.value('third')));
      const words = [a, ...middle, b];
      const inBook = middle.filter((word) => IN_RUNGS.has(word)).length;
      let singleSteps = 0;
      for (let i = 0; i < n - 1; i++) {
        if (words[i].length === 4 && words[i + 1].length === 4 && diff(words[i], words[i + 1]) === 1) singleSteps++;
      }
      const distinct = new Set(words).size === n;
      if (inBook === n - 2 && singleSteps === n - 1 && distinct) {
        return { solved: true, say: words.join(', ') + ': the ladder holds' };
      }
      return { solved: false, say: inBook + ' of ' + (n - 2) + ' middle rungs are in the book; '
        + singleSteps + ' of ' + (n - 1) + ' steps change one letter'
        + (distinct ? '' : '; a word repeats') };
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
      if (id === 'third') {
        s.third = clean(value).slice(0, 4);
        c.status(s.third ? 'third rung: ' + s.third : 'nothing on the third rung yet');
      }
      if (id === 'hint') {
        if (s.hints < helps) {
          const at = changedAt(plan.rungs[s.hints], plan.rungs[s.hints + 1]) + 1;
          s.hints += 1;
          c.hint();
          c.status('step ' + s.hints + ' changes letter ' + at);
        } else c.status('that is all the kiln will show at this difficulty; the words are yours');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) {
        s.phase = Math.min(1, s.phase + dt / (c.reduced ? 0.5 : 2.5));
        s.lit = Math.min(1, s.lit + dt);
      }
      draw(c);
    },
    end(c) {
      s.first = clean(c.value('first')) || plan.rungs[1];
      s.second = clean(c.value('second')) || plan.rungs[2];
      if (n === 5) s.third = clean(c.value('third')) || plan.rungs[3];
      c.status('the ladder holds: ' + [a, s.first, s.second, ...(n === 5 ? [s.third] : []), b].join(', ') + '. one letter a step, and every rung in the book.');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

const plans = new WeakMap();
function deal(env) {
  let plan = plans.get(env);
  if (!plan) {
    plan = env.chance(0.5) ? anagramPlan(env) : ladderPlan(env);
    plans.set(env, plan);
  }
  return plan;
}

export default {
  id: 'word-kiln',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'anagram') anagramPreview(g, w, h, env, plan);
    else ladderPreview(g, w, h, env, plan);
  },
  animate(g, w, h, env, t) {
    return false;
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
      mono: plan.rungs[0] + '\n' + Array(plan.rungs.length - 2).fill('____').join('\n') + '\n' + plan.rungs[plan.rungs.length - 1],
      text: (plan.rungs.length - 1) + ' steps, one letter changed at each, every rung a word in the kiln\'s book. Fill the middle rungs to complete the climb.',
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
