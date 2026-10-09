/* The sky archive: a wheel of letters turned under the stars, and omens written against a sky.
   As a card it is a wheel, a square sky with five omen cards, or a numbered star chart
   (paint, spark); as a piece it is one of the three puzzles below, and the card it
   was opened from says which. See js/feed.js for what a module is and js/stage.js for what a
   piece is.

   Three puzzles, all deduction:

     the wheel of letters   Twenty-four letters round the rim, a notch apart, and three stars inside
                            the wheel, each pointing at one. The archive asks for a word of three
                            letters, and one turn of the wheel brings the three stars onto that
                            word's letters in order. Say how many notches, and which way. The stars
                            are placed from the word and the turn, and the same count the other way
                            round is made to read nothing. A wrong check says whether the count is
                            off, or fits one way round, and no more, though a gentle difficulty
                            takes a count a notch or two out; asking the archive which way it turns
                            costs a hint, and the fiercest setting does not offer to say it.
     which omens hold       A square sky of five to nine stars, a ring, a horizon band and a
                            hand's-width scale. Five claims are dealt from different omen families:
                            exactly two hold. Pick those two and locate the brightest star in one
                            of the four quadrants. The claims and a text reading of the chart are
                            available beside the picture. A wrong check measures both answers
                            without identifying a true claim; a closer reading costs a hint, and
                            a solve reads a line from the archive.

     the star's itinerary  Follow four or five cardinal steps through a numbered, three-by-three
                            star chart. Name the last star and add the brightness of every star
                            landed on. The route is generated within the chart; hints reveal
                            successive landings, and the complete trail remains playable.

   The sky a visitor brings may be one star or many: it is drawn behind the wheel for colour, and
   nothing of the puzzle depends on it. The plan is rolled from the seed, dealt once per card and
   kept with its env (a WeakMap), carried whole on the card's `of`, and rebuilt from that, so a
   card and the feature it opens as are one puzzle. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NOTCHES = 24;
const ASKED = ('ARK BAY CAT COW CUP DAY DEW DOG EAR ELM FIG FOX GEM HAT ICE INK JAR JUG KEY LID MAP MUD NET OAK OAR OWL PEN PIG RUG RYE SKY SUN '
  + 'TEA TIN URN VAT WAX YEW ZIP ORB FIR HEN BUD ELK EMU FLY GUM HUT IVY JAW KEG LOG MOP NIB OAT PEA RIB SAW TOY WEB YAK').split(' ');
const COMMON = new Set(('ACE ACT ADD AGE AGO AID AIM AIR ALE ALL AND ANT ANY APE APT ARC ARE ARK ARM ART ASH ASK ATE AWE AXE AYE BAD BAG BAN BAR '
  + 'BAT BAY BED BEE BEG BET BID BIG BIN BIT BOW BOX BOY BUD BUG BUN BUS BUT BUY BYE CAB CAN CAP CAR CAT COB COD COG COP COT COW COY CRY CUB '
  + 'CUD CUE CUP CUT DAB DAD DAM DAY DEN DEW DID DIE DIG DIM DIN DIP DOE DOG DOT DRY DUB DUE DUG DUO DYE EAR EAT EBB EEL EGG EGO ELF ELK ELM '
  + 'EMU END ERA ERR EVE EWE EYE FAD FAN FAR FAT FAX FED FEE FEW FIB FIG FIN FIR FIT FIX FLU FLY FOE FOG FOR FOX FRY FUN FUR GAG GAP GAS GEL '
  + 'GEM GET GIG GIN GOD GOT GUM GUN GUT GUY GYM HAD HAM HAS HAT HAY HEM HEN HER HEW HEY HID HIM HIP HIS HIT HOE HOG HOP HOT HOW HUB HUE HUG '
  + 'HUM HUT ICE ICY ILL IMP INK INN ION IRE IRK ITS IVY JAB JAM JAR JAW JAY JET JIG JOB JOG JOT JOY JUG KEG KEN KEY KID KIN KIT LAB LAD LAG '
  + 'LAP LAW LAY LED LEG LET LID LIE LIP LIT LOG LOT LOW MAD MAN MAP MAT MAY MEN MET MID MIX MOB MOP MOW MUD MUG NAB NAG NAP NET NEW NIB NIL '
  + 'NIP NIT NOD NOR NOT NOW NUN NUT OAK OAR OAT ODD ODE OFF OIL OLD ONE OPT ORB ORE OUR OUT OWE OWL OWN PAD PAN PAR PAT PAW PAY PEA PEG PEN '
  + 'PER PET PEW PIE PIG PIN PIT PLY POD POP POT PRY PUB PUG PUN PUP PUT RAG RAM RAN RAP RAT RAW RAY RED RIB RID RIG RIM RIP ROB ROD ROE ROT '
  + 'ROW RUB RUG RUM RUN RUT RYE SAD SAG SAP SAT SAW SAY SEA SET SEW SHE SHY SIN SIP SIR SIT SIX SKI SKY SLY SOB SOD SON SOW SOY SPA SPY SUB '
  + 'SUE SUM SUN TAB TAG TAN TAP TAR TAX TEA TEN THE THY TIE TIN TIP TOE TON TOP TOW TOY TRY TUB TUG TWO URN USE VAN VAT VET VIA VIE VOW WAD '
  + 'WAG WAR WAS WAX WAY WEB WED WET WHO WHY WIG WIN WIT WOE WON WRY YAK YAM YAP YES YET YEW YOU ZAP ZIP ZOO').split(' '));

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

/* ---- shared drawing ------------------------------------------------------------------------- */

function mod(n, m) {
  return ((n % m) + m) % m;
}

/* The movements of the archive run on env.rite (README: "Motion axiom"): nothing here moves along
   a formula, and nothing moves at rest. The wheel of a solved archive turns to its notch in the
   ratchet's even clicks and stops on it; the stars' glow comes up the stair of the solve; a picked
   omen or a marked quadrant is sealed behind the piece's one edge, its slice or its curve, in a
   few treads, and one unpicked goes back behind the same edge the way it came; the itinerary's
   trail is drawn out from the star it leaves in treads; a verdict, a ring or a name is cut on at
   one moment of its own roll and stays. The stars do not breathe: a swell and a settle repeated
   for as long as the page is open is a movement that goes back on itself, over the whole scene,
   redrawn every frame for nothing a visitor waits on, so a card of the archive is a still picture
   and a piece's sky holds still between the visitor's moves. */

function some(env, list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

function glow(g, c, x, y, r, color, a) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, c.alpha(color, a));
  grad.addColorStop(1, c.alpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function write(g, str, x, y, size, color, align, weight) {
  g.font = (weight || 500) + ' ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  g.fillStyle = color;
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

function wrap(g, str, size, maxW) {
  g.font = '500 ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  const lines = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && g.measureText(test).width > maxW) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// The archive's dark: a radial ground, and the visitor's own stars faint behind everything, for
// colour. A sky of one star, or none, draws the same puzzle.
function dark(g, w, h, c, v) {
  const col = c.colors;
  const bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, col.bg2);
  bg.addColorStop(1, col.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const stars = (c.stars || []).slice(0, 48);
  g.fillStyle = c.alpha(col.fg, 0.35);
  stars.forEach((s) => {
    g.beginPath();
    g.arc((s.x / 100) * w, (s.y / 100) * h, 1.2, 0, Math.PI * 2);
    g.fill();
  });
  // And a dust of fainter points of the archive's own, as many as the configuration asks for and
  // turned as far as it turns them: none of the puzzle is in it.
  g.fillStyle = c.alpha(col.accent, 0.22);
  for (let i = 0, count = Math.max(8, Math.round(26 * v.density)); i < count; i++) {
    g.fillRect(((i * 0.6180339 + v.turn * 0.37) % 1) * w, ((i * 0.7548777 + v.turn * 0.11) % 1) * h, 1, 1);
  }
}

function notches(n) {
  return (n <= 12 ? WORDS[n] : String(n)) + (n === 1 ? ' notch' : ' notches');
}

/* ---- the wheel of letters ------------------------------------------------------------------ */

function rimOf(dropped) {
  return ALPHABET.split('').filter((ch) => !dropped.includes(ch));
}

// The notches the three stars sit at: the word's letters, moved back along the turn that brings
// them forward again. A clockwise turn by t carries the letter at notch i to notch i + t, so a
// star at notch s then reads the letter that was at s - t.
function starNotches(p) {
  const rim = rimOf(p.dropped);
  return p.word.split('').map((ch) => mod(rim.indexOf(ch) + (p.cw ? p.t : -p.t), NOTCHES));
}

// What the three stars read after a turn of `n` notches, clockwise or not.
function reading(p, n, cw) {
  const rim = rimOf(p.dropped);
  return starNotches(p).map((s) => rim[mod(s + (cw ? -n : n), NOTCHES)]).join('');
}

function wheelPlan(env) {
  let last = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const word = env.pick(ASKED);
    const dropped = some(env, ALPHABET.split('').filter((ch) => !word.includes(ch)), 2).sort();
    let t = env.int(2, 21);
    if (t >= 12) t += 1;
    const cw = env.chance(0.5);
    const radii = [env.int(38, 70), env.int(38, 70), env.int(38, 70)];
    last = { kind: 'wheel', word, dropped, t, cw, radii };
    // The same count the other way round reads nothing anyone would take for the word.
    const other = reading(last, t, !cw);
    if (!COMMON.has(other) && !COMMON.has(reading(last, 0, true))) return last;
  }
  return last;
}

function carriedWheel(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'wheel') return null;
  if (typeof p.word !== 'string' || !/^[A-Z]{3}$/.test(p.word) || new Set(p.word).size !== 3) return null;
  if (!Array.isArray(p.dropped) || p.dropped.length !== 2 || !p.dropped.every((ch) => typeof ch === 'string' && ch.length === 1 && ALPHABET.includes(ch) && !p.word.includes(ch))) return null;
  if (p.dropped[0] === p.dropped[1]) return null;
  if (!Number.isInteger(p.t) || p.t < 2 || p.t > 22 || p.t === 12 || typeof p.cw !== 'boolean') return null;
  if (!Array.isArray(p.radii) || p.radii.length !== 3 || !p.radii.every((r) => Number.isInteger(r) && r >= 38 && r <= 70)) return null;
  const plan = { kind: 'wheel', word: p.word, dropped: p.dropped.slice().sort(), t: p.t, cw: p.cw, radii: p.radii.slice() };
  if (reading(plan, plan.t, plan.cw) !== plan.word || reading(plan, plan.t, !plan.cw) === plan.word) return null;
  return plan;
}

function wheelTitle(p) {
  return 'the wheel of letters: ' + p.word;
}

function wayWord(cw) {
  return cw ? 'clockwise' : 'counterclockwise';
}

// The wheel: the rim turned by `angle`, three stars pointing from the centre, the asked word.
function wheelScene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const cx = w / 2;
  const cy = h * 0.52;
  const R = Math.min(w, h) * 0.35 * v.scale;
  const rim = rimOf(p.dropped);
  const starsAt = starNotches(p);
  const angle = s.angle || 0;
  dark(g, w, h, c, v);
  const step = Math.PI * 2 / NOTCHES;
  const at = (notch, r, turn) => {
    const a = -Math.PI / 2 + notch * step + (turn || 0);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a };
  };
  // The rings and the notches.
  g.strokeStyle = c.alpha(col.accent, 0.45);
  g.lineWidth = 1;
  for (const r of [R, R * 0.78, R * 0.3]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = c.alpha(col.accent, 0.6);
  g.beginPath();
  for (let i = 0; i < NOTCHES; i++) {
    const a = at(i, R, 0);
    const b = at(i, R * 0.95, 0);
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
  }
  g.stroke();
  // The top notch, and which way is clockwise.
  g.fillStyle = c.alpha(col.accent2, 0.95);
  g.beginPath();
  g.moveTo(cx, cy - R - R * 0.16);
  g.lineTo(cx - R * 0.045, cy - R - R * 0.04);
  g.lineTo(cx + R * 0.045, cy - R - R * 0.04);
  g.closePath();
  g.fill();
  g.strokeStyle = c.alpha(col.muted, 0.8);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy, R * 1.08, -Math.PI / 2 + step * 1.2, -Math.PI / 2 + step * 3.6);
  g.stroke();
  const tip = at(3.6, R * 1.08, 0);
  g.fillStyle = c.alpha(col.muted, 0.9);
  g.beginPath();
  g.moveTo(tip.x + Math.cos(tip.a + Math.PI / 2) * R * 0.05, tip.y + Math.sin(tip.a + Math.PI / 2) * R * 0.05);
  g.lineTo(tip.x + Math.cos(tip.a) * R * 0.035, tip.y + Math.sin(tip.a) * R * 0.035);
  g.lineTo(tip.x - Math.cos(tip.a) * R * 0.035, tip.y - Math.sin(tip.a) * R * 0.035);
  g.closePath();
  g.fill();
  // The three stars, each on a spoke from the centre out to the rim. Their glow comes up the
  // stair of the solve's own roll as the wheel clicks round, and the letters they land on (and
  // the count written under the wheel) are cut on at one moment of that roll once it has clicked
  // home, and stay.
  const own = s.spin > 0 && c.rite ? c.rite.at(0x1ead + (s.spun || 0)) : null;
  const lit = s.spin >= 1;
  const litK = lit ? 1 : own ? own.stair(s.spin) : 0;
  const landed = s.landedAt == null || !s.t ? 1 : Math.min(1, (s.t - s.landedAt) / 1.2);
  const shine = !lit ? 0 : own ? own.flicker(landed) : 1;
  starsAt.forEach((n, k) => {
    const star = at(n, R * p.radii[k] / 100, 0);
    const edge = at(n, R * 0.95, 0);
    g.strokeStyle = c.alpha(col.accent2, 0.5);
    g.lineWidth = 1;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(edge.x, edge.y);
    g.stroke();
    g.setLineDash([]);
    glow(g, c, star.x, star.y, R * 0.12, col.accent2, 0.45 + 0.25 * litK);
    g.fillStyle = col.accent2;
    g.beginPath();
    g.arc(star.x, star.y, Math.max(2.5, R * 0.03), 0, Math.PI * 2);
    g.fill();
    write(g, String(k + 1), star.x + R * 0.07, star.y - R * 0.07, Math.max(9, R * 0.1), col.accent2, 'center', 700);
  });
  // The rim: twenty-four letters, turned as far as the wheel has been turned.
  const size = Math.max(10, R * 0.13);
  rim.forEach((ch, i) => {
    const q = at(i, R * 0.87, angle);
    const on = shine && starsAt.some((n, k) => rim[mod(n + (p.cw ? -p.t : p.t), NOTCHES)] === ch);
    if (on) glow(g, c, q.x, q.y, size * 1.4, col.accent2, 0.6);
    write(g, ch, q.x, q.y, size, on ? col.accent2 : c.alpha(col.fg, 0.9), 'center', 600);
  });
  // What the archive asks, under the wheel, and the letters left off the rim.
  const fs = Math.max(10, Math.min(16, Math.min(w, h) * 0.036));
  write(g, 'the archive asks for', cx, h * 0.045 + fs * 0.1, fs * 0.85, c.alpha(col.muted, 0.9), 'center', 500);
  write(g, p.word.split('').join('  '), cx, h * 0.045 + fs * 1.3, fs * 1.4, col.accent2, 'center', 700);
  write(g, 'no ' + p.dropped[0] + ', no ' + p.dropped[1] + ' on the rim', w * 0.03, h * 0.96, fs * 0.8, c.alpha(col.muted, 0.8), 'left', 500);
  write(g, 'clockwise', tip.x + R * 0.1, tip.y - R * 0.02, fs * 0.8, c.alpha(col.muted, 0.9), 'left', 500);
  const foot = lit ? (shine ? notches(p.t) + ' ' + wayWord(p.cw) : '') : s.told ? 'the archive says: ' + wayWord(p.cw) : 'the wheel is seized: say how it must turn';
  write(g, foot, w * 0.97, h * 0.96, fs * 0.8, lit || s.told ? col.accent2 : c.alpha(col.muted, 0.8), 'right', 500);
}

function wheelPreview(g, w, h, env, p) {
  wheelScene(g, w, h, env, p, { angle: 0, spin: 0 }, env.variant);
}

function wheelPiece(env, p) {
  // The count is notches read off a rim, so it is a measured answer: the difficulty says how many
  // notches out it may be and still turn the lock.
  const { helps, margin } = asked(env);
  // The wheel turns to its notch in the even clicks of this piece's ratchet, rolled afresh for
  // the solve by rite.at, and stops on it: never a smooth turn, never past it and back.
  const s = { angle: 0, spin: 0, t: 0, told: false, spun: 0 };
  const draw = (c) => wheelScene(c.g, c.w, c.h, c, p, s, env.variant);
  return {
    title: wheelTitle(p),
    brief: 'The archive asks, and the wheel answers. Twenty-four letters round the rim, one notch apart, and three stars inside the wheel, each pointing along its spoke at one letter. The wheel is seized at the setting it kept since midnight. One turn of it, so many notches one way round, brings star 1, star 2 and star 3 onto the letters of the word the archive asks for, in order.',
    goal: 'Say how many notches the wheel must turn, and which way, to read the word.',
    aspect: '1 / 1',
    checkLabel: 'turn the wheel',
    steps: [
      { id: 'count', ask: 'how many notches', kind: 'number', min: 1, max: 23, step: 1, value: 1, unit: 'notches' },
      { id: 'way', ask: 'which way round', kind: 'choice', options: [
        { label: 'clockwise', value: 'cw' },
        { label: 'counterclockwise', value: 'ccw' }
      ] },
      // The archive has one thing to say here, so a fierce difficulty does not offer to say it.
      helps > 1 ? { id: 'ask', ask: 'which way the wheel turns', kind: 'press', count: 1, label: 'ask the archive', optional: true } : null
    ].filter(Boolean),
    solution: { count: p.t, way: p.cw ? 'cw' : 'ccw' },
    check(c) {
      const n = Number(c.value('count'));
      const cw = c.value('way') === 'cw';
      if (!Number.isInteger(n) || n < 1 || n > 23) return { solved: false, say: 'the count has to be one to twenty-three' };
      const read = reading(p, n, cw);
      if (read === p.word) return { solved: true, say: notches(n) + ' ' + wayWord(cw) + ': the stars read ' + p.word };
      // Within the margin the difficulty allows, the wheel is taken as turned to the setting that
      // reads: the stars are a notch or two wide of their letters and the lock still gives.
      if (cw === !!p.cw && Math.abs(n - p.t) <= margin) {
        return { solved: true, say: notches(p.t) + ' ' + wayWord(!!p.cw) + ': the stars read ' + p.word };
      }
      if (reading(p, n, !cw) === p.word) return { solved: false, say: 'the count fits one way round; the direction is off' };
      let land = 0;
      for (let k = 0; k < 3; k++) if (read[k] === p.word[k]) land += 1;
      return { solved: false, say: 'the count is off' + (land ? '; ' + WORDS[land] + (land === 1 ? ' star lands' : ' stars land') + ' on a right letter' : '') };
    },
    start(c) {
      c.status('the archive asks for ' + p.word + '; the wheel is seized');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'count') {
        const n = Number(value);
        c.status(Number.isInteger(n) && n >= 1 ? notches(n) + ', you say' : 'a count of notches');
      }
      if (id === 'way') c.status(value === 'cw' ? 'clockwise, you say' : 'counterclockwise, you say');
      if (id === 'ask') {
        if (!s.told) {
          s.told = true;
          c.hint();
        }
        c.status('the archive says the wheel turns ' + wayWord(p.cw) + '; the count is yours to find');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done) {
        if (!s.spun) s.spun = 1 + ((s.t * 1000) | 0) % 97;
        s.spin = c.reduced ? 1 : Math.min(1, s.spin + dt * 0.55);
        if (s.spin >= 1 && s.landedAt == null) s.landedAt = s.t;
        // A scene handed no rite is shown turned home.
        const click = c.rite ? c.rite.at(0x51a7 + s.spun).ratchet(s.spin) : 1;
        s.angle = click * p.t * (Math.PI * 2 / NOTCHES) * (p.cw ? 1 : -1);
      }
      draw(c);
    },
    end(c) {
      // Every solve is answered in the archive's own voice, as the omens' is: the line is the
      // plan's, so one wheel always reads the same and another wheel reads another.
      const line = READINGS[(p.t + p.word.charCodeAt(0) + (p.cw ? 1 : 0)) % READINGS.length];
      c.status('the wheel turns ' + notches(p.t) + ' ' + wayWord(p.cw) + ' and the stars read ' + p.word + '. the archive reads: ' + line);
    }
  };
}

/* ---- which omens hold ----------------------------------------------------------------------- */

const RING = { x: 0.5, y: 0.44, r: 0.2 };
const BAND = 0.8; // the horizon band's top edge, as a fraction of the sky's height
const HAND = 0.22; // a hand's width, as a fraction of the sky's width
const MARGIN = 0.035;
// What the archive reads once the omens are judged: one line, chosen by the sky, in the site's voice.
const READINGS = [
  'what you asked elsewhere was already answered here',
  'the sky kept its word; keep yours',
  'a small thing holds; let the large one go',
  'what is true of the stars is true of the asking',
  'the hand that measured is the hand that is read',
  'nothing moved while you looked, and that was the answer',
  'the brightest is not the nearest; the nearest is enough',
  'turn once more and you are back where you began; stop there',
  'the rim remembers every word it was ever asked for',
  'count again at midnight and the count will hold',
  'what the wheel gives, the horizon keeps',
  'ask less of the faintest star; it carries the most'
];

// Each omen family has two readings, one the other's opposite; a sky gets one claim per family.
const FAMILIES = [
  [{ id: 'eastMore', text: 'more stars lie east of the meridian than west' }, { id: 'westMore', text: 'more stars lie west of the meridian than east' }],
  [{ id: 'inRing', text: 'a star lies inside the ring' }, { id: 'noneInRing', text: 'no star lies inside the ring' }],
  [{ id: 'brightClose', text: 'the two brightest lie within a hand\'s width of each other' }, { id: 'brightFar', text: 'the two brightest lie more than a hand\'s width apart' }],
  [{ id: 'noneInBand', text: 'no star touches the horizon band' }, { id: 'oneInBand', text: 'a star touches the horizon band' }],
  [{ id: 'brightestEast', text: 'the brightest star lies east of the meridian' }, { id: 'brightestWest', text: 'the brightest star lies west of the meridian' }],
  [{ id: 'faintestNorth', text: 'the faintest star lies north of the ring\'s centre line' }, { id: 'threeNorth', text: 'exactly three stars lie north of the ring\'s centre line' }],
  [{ id: 'faintInRing', text: 'the faintest star lies inside the ring' }, { id: 'faintOutRing', text: 'the faintest star lies outside the ring' }],
  [{ id: 'brightSameSide', text: 'the two brightest lie on the same side of the meridian' }, { id: 'brightSplit', text: 'the two brightest lie on opposite sides of the meridian' }]
];
const CLAIMS = {};
FAMILIES.forEach((pair, f) => pair.forEach((claim) => { CLAIMS[claim.id] = Object.assign({ family: f }, claim); }));

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function byBrightness(pts) {
  return pts.slice().sort((a, b) => b.b - a.b);
}

function claimHolds(id, pts) {
  const east = pts.filter((p) => p.x > RING.x).length;
  const west = pts.length - east;
  const bright = byBrightness(pts);
  switch (id) {
    case 'eastMore': return east > west;
    case 'westMore': return west > east;
    case 'inRing': return pts.some((p) => dist(p, RING) < RING.r);
    case 'noneInRing': return !pts.some((p) => dist(p, RING) < RING.r);
    case 'brightClose': return dist(bright[0], bright[1]) < HAND;
    case 'brightFar': return dist(bright[0], bright[1]) > HAND;
    case 'noneInBand': return !pts.some((p) => p.y > BAND);
    case 'oneInBand': return pts.some((p) => p.y > BAND);
    case 'brightestEast': return bright[0].x > RING.x;
    case 'brightestWest': return bright[0].x < RING.x;
    case 'faintestNorth': return bright[bright.length - 1].y < RING.y;
    case 'threeNorth': return pts.filter((p) => p.y < RING.y).length === 3;
    case 'faintInRing': return dist(bright[bright.length - 1], RING) < RING.r;
    case 'faintOutRing': return dist(bright[bright.length - 1], RING) > RING.r;
    case 'brightSameSide': return (bright[0].x > RING.x) === (bright[1].x > RING.x);
    case 'brightSplit': return (bright[0].x > RING.x) !== (bright[1].x > RING.x);
    default: return false;
  }
}

// No star on an edge: a claim is clearly true or clearly false, or the sky is rolled again.
function clearSky(pts) {
  const bright = byBrightness(pts);
  for (const p of pts) {
    if (Math.abs(p.x - RING.x) < MARGIN || Math.abs(p.y - RING.y) < MARGIN) return false;
    if (Math.abs(dist(p, RING) - RING.r) < MARGIN || Math.abs(p.y - BAND) < MARGIN) return false;
  }
  if (Math.abs(dist(bright[0], bright[1]) - HAND) < MARGIN * 1.5) return false;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (dist(pts[i], pts[j]) < 0.07) return false;
  return true;
}

// One star, placed away from every edge a claim is measured against and from the stars before it.
function starAt(env, pts) {
  for (let tries = 0; tries < 40; tries++) {
    const q = { x: Math.round((0.08 + env.rnd() * 0.84) * 1000) / 1000, y: Math.round((0.08 + env.rnd() * 0.84) * 1000) / 1000 };
    if (Math.abs(q.x - RING.x) < MARGIN || Math.abs(q.y - RING.y) < MARGIN) continue;
    if (Math.abs(dist(q, RING) - RING.r) < MARGIN || Math.abs(q.y - BAND) < MARGIN) continue;
    if (pts.some((o) => dist(o, q) < 0.07)) continue;
    return q;
  }
  return null;
}

// A sky the generator can always fall back on: two of its five omens hold, and nothing in it is
// on an edge (carriedOmens holds it to the same tests as any other).
const FALLBACK = {
  kind: 'omens',
  pts: [{ x: 0.2, y: 0.2, b: 9 }, { x: 0.75, y: 0.25, b: 7 }, { x: 0.56, y: 0.38, b: 5 }, { x: 0.3, y: 0.65, b: 3 }, { x: 0.8, y: 0.9, b: 1 }],
  claims: ['eastMore', 'noneInRing', 'brightFar', 'noneInBand', 'faintInRing'],
  truth: [0, 2]
};

function omensPlan(env) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = env.chance(0.3) ? env.int(8, 9) : env.int(5, 7);
    const levels = some(env, [1, 2, 3, 4, 5, 6, 7, 8, 9], n);
    const pts = [];
    for (let i = 0; i < n && pts.length === i; i++) {
      const q = starAt(env, pts);
      if (q) pts.push({ x: q.x, y: q.y, b: levels[i] });
    }
    if (pts.length !== n || !clearSky(pts)) continue;
    const families = some(env, FAMILIES.map((pair, f) => f), 5);
    const eligible = families.filter((f) => FAMILIES[f].some((claim) => claimHolds(claim.id, pts)));
    if (eligible.length < 2 || families.some((f) => FAMILIES[f].every((claim) => claimHolds(claim.id, pts)))) continue;
    const trueFamilies = new Set(some(env, eligible, 2));
    const claims = families.map((f) => env.pick(FAMILIES[f].filter((claim) => claimHolds(claim.id, pts) === trueFamilies.has(f))).id);
    const truth = claims.map((id, i) => (claimHolds(id, pts) ? i : -1)).filter((i) => i >= 0);
    return { kind: 'omens', pts, claims, truth };
  }
  return { kind: 'omens', pts: FALLBACK.pts.map((q) => Object.assign({}, q)), claims: FALLBACK.claims.slice(), truth: FALLBACK.truth.slice() };
}

function carriedOmens(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'omens') return null;
  if (!Array.isArray(p.pts) || p.pts.length < 5 || p.pts.length > 9) return null;
  const okPt = (q) => q && typeof q === 'object' && Number.isFinite(q.x) && Number.isFinite(q.y) && q.x > 0 && q.x < 1 && q.y > 0 && q.y < 1 && Number.isInteger(q.b) && q.b >= 1 && q.b <= 9;
  if (!p.pts.every(okPt) || new Set(p.pts.map((q) => q.b)).size !== p.pts.length) return null;
  const pts = p.pts.map((q) => ({ x: q.x, y: q.y, b: q.b }));
  if (!Array.isArray(p.claims) || p.claims.length !== 5 || !p.claims.every((id) => CLAIMS[id])) return null;
  if (new Set(p.claims.map((id) => CLAIMS[id].family)).size !== 5) return null;
  const truth = p.claims.map((id, i) => (claimHolds(id, pts) ? i : -1)).filter((i) => i >= 0);
  if (truth.length !== 2 || !clearSky(pts)) return null;
  if (!Array.isArray(p.truth) || p.truth.length !== truth.length || !truth.every((i, k) => p.truth[k] === i)) return null;
  return { kind: 'omens', pts, claims: p.claims.slice(), truth };
}

function omensTitle(p) {
  return 'which omens hold: ' + WORDS[p.pts.length] + ' stars';
}

function skyFrame(w, h, v) {
  const side = Math.min(w * (0.8 + 0.08 * v.scale), h * (0.49 + 0.03 * v.scale));
  return { x: w / 2 - side / 2 + (v.turn - 0.5) * w * 0.02, y: h * 0.025, sw: side, sh: side };
}

// The drawn sky: the stars by brightness, the ring, the meridian and the centre line, the horizon
// band, the hand's-width scale, and the five omens under it.
function omensScene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const f = skyFrame(w, h, v);
  const fs = Math.max(9, Math.min(14, Math.min(w, h) * 0.03));
  dark(g, w, h, c, v);
  const X = (x) => f.x + x * f.sw;
  const Y = (y) => f.y + y * f.sh;
  g.fillStyle = c.alpha(col.bg, 0.55);
  g.fillRect(f.x, f.y, f.sw, f.sh);
  g.strokeStyle = c.alpha(col.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(f.x, f.y, f.sw, f.sh);
  // The quadrant marked for the brightest star is sealed behind the piece's edge on the roll of
  // that mark, and the one marked before goes back behind the same edge the way it came.
  if (s.quadrant || s.quadrantPrev) {
    const field = c.rite ? c.rite.at(0x4a17 + (s.marks || 0)) : null;
    const age = c.reduced || s.quadrantAt == null ? 1 : Math.min(1, Math.max(0, (s.t - s.quadrantAt) / 0.8));
    const k = field ? field.stair(age) : 1;
    const quarter = (name, cover) => {
      if (!name || cover <= 0) return;
      const left = name.endsWith('west') ? 0 : RING.x;
      const top = name.startsWith('north') ? 0 : RING.y;
      const height = name.startsWith('north') ? RING.y : 1 - RING.y;
      if (field) field.paint(g, X(left), Y(top), f.sw * RING.x, f.sh * height, cover, c.alpha(col.accent2, 0.14));
      else {
        g.fillStyle = c.alpha(col.accent2, 0.14);
        g.fillRect(X(left), Y(top), f.sw * RING.x, f.sh * height);
      }
    };
    quarter(s.quadrant, k);
    if (s.quadrantPrev !== s.quadrant) quarter(s.quadrantPrev, 1 - k);
  }
  // The horizon band.
  g.fillStyle = c.alpha(col.accent, 0.14);
  g.fillRect(f.x, Y(BAND), f.sw, f.sh * (1 - BAND));
  g.strokeStyle = c.alpha(col.accent, 0.6);
  g.beginPath();
  g.moveTo(f.x, Y(BAND));
  g.lineTo(f.x + f.sw, Y(BAND));
  g.stroke();
  write(g, 'the horizon band', X(0.5), Y(BAND) + f.sh * (1 - BAND) / 2, fs * 0.85, c.alpha(col.accent, 0.9), 'center', 500);
  // The meridian and the centre line, and the ring.
  g.strokeStyle = c.alpha(col.muted, 0.4);
  g.setLineDash([3, 5]);
  g.beginPath();
  g.moveTo(X(RING.x), f.y);
  g.lineTo(X(RING.x), f.y + f.sh);
  g.moveTo(f.x, Y(RING.y));
  g.lineTo(f.x + f.sw, Y(RING.y));
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = c.alpha(col.accent2, 0.75);
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(X(RING.x), Y(RING.y), RING.r * f.sw, RING.r * f.sh, 0, 0, Math.PI * 2);
  g.stroke();
  write(g, 'west', f.x + fs * 1.6, Y(RING.y) - fs * 0.8, fs * 0.8, c.alpha(col.muted, 0.8), 'center', 500);
  write(g, 'east', f.x + f.sw - fs * 1.6, Y(RING.y) - fs * 0.8, fs * 0.8, c.alpha(col.muted, 0.8), 'center', 500);
  write(g, 'north', X(RING.x) + fs * 1.8, f.y + fs * 0.8, fs * 0.8, c.alpha(col.muted, 0.8), 'center', 500);
  write(g, 'south', X(RING.x) + fs * 1.8, Y(0.7), fs * 0.8, c.alpha(col.muted, 0.8), 'center', 500);
  write(g, 'the ring', X(RING.x), Y(RING.y) + RING.r * f.sh + fs * 0.9, fs * 0.8, c.alpha(col.accent2, 0.8), 'center', 500);
  // A hand's width, as a scale.
  const hx = f.x + f.sw * 0.04;
  const hy = f.y + f.sh * 0.06;
  g.strokeStyle = c.alpha(col.fg, 0.8);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(hx + HAND * f.sw, hy);
  g.moveTo(hx, hy - 4);
  g.lineTo(hx, hy + 4);
  g.moveTo(hx + HAND * f.sw, hy - 4);
  g.lineTo(hx + HAND * f.sw, hy + 4);
  g.stroke();
  write(g, 'a hand\'s width', hx + HAND * f.sw / 2, hy + fs * 0.9, fs * 0.8, c.alpha(col.fg, 0.8), 'center', 500);
  // The stars, brighter ones larger.
  const unit = Math.min(f.sw, f.sh);
  p.pts.forEach((q) => {
    const r = unit * (0.006 + q.b * 0.0024);
    glow(g, c, X(q.x), Y(q.y), r * 5, col.accent2, 0.25 + q.b * 0.05);
    g.fillStyle = c.mix(col.fg, col.accent2, q.b / 9);
    g.beginPath();
    g.arc(X(q.x), Y(q.y), r, 0, Math.PI * 2);
    g.fill();
  });
  // The hint, once asked for: the two brightest, ringed and named.
  if (s.marked) {
    // The rings are cut on at one moment of the piece's own rite and widen a tread at a time;
    // each name is cut on at a moment of its own roll.
    const age = s.markedAt == null || !s.t ? 1 : Math.min(1, (s.t - s.markedAt) / 1.1);
    const own = c.rite ? c.rite.at(0x2b1d) : null;
    const on = own ? own.flicker(age) : 1;
    const grow = own ? own.stair(age) : 1;
    g.strokeStyle = c.alpha(col.accent2, 0.9);
    g.lineWidth = 1.2;
    g.setLineDash([3, 3]);
    byBrightness(p.pts).slice(0, 2).forEach((q, k) => {
      if (!on) return;
      g.beginPath();
      g.arc(X(q.x), Y(q.y), unit * (0.03 + 0.02 * grow), 0, Math.PI * 2);
      g.stroke();
      if (own ? own.at(k + 1).flicker(age) : 1) write(g, k ? 'second brightest' : 'brightest', X(q.x), Y(q.y) - unit * 0.07, fs * 0.75, col.accent2, 'center', 500);
    });
    g.setLineDash([]);
  }
  // Five claims sit in two readable columns; the last uses the width of both.
  const top = f.y + f.sh + h * 0.02;
  const gap = w * 0.015;
  const rowWidth = w * 0.9;
  const half = (rowWidth - gap) / 2;
  const rowHeight = (h - top - h * 0.025 - gap * 2) / 3;
  p.claims.forEach((id, i) => {
    const x = (w - rowWidth) / 2 + (i % 2) * (half + gap);
    const y = top + Math.floor(i / 2) * (rowHeight + gap);
    const cw = i === 4 ? rowWidth : half;
    const ch = rowHeight;
    const picked = s.picked.includes(i);
    const settled = s.reveal || (s.read || []).includes(i);
    const holds = settled && p.truth.includes(i);
    g.fillStyle = c.alpha(col.bg, 0.6);
    g.beginPath();
    g.roundRect(x, y, cw, ch, fs * 0.5);
    g.fill();
    // A picked omen is sealed: the accent comes over its card behind the piece's edge, on this
    // pick's own roll, in treads -- and goes back behind the same edge when it is unpicked.
    const pickedAt = s.pickedAt && s.pickedAt[i];
    const since = pickedAt == null || !s.t ? 1 : Math.min(1, (s.t - pickedAt) / 1.3);
    // The roll is the pick's own, kept from the moment it was made, so a later pick on another
    // card does not swap this one's treads under it mid-seal.
    const own = c.rite ? c.rite.at(0x0ae0 + i * 3 + ((s.pickRoll && s.pickRoll[i]) || 0)) : null;
    const cover = own ? own.stair(since) : 1;
    const edge = picked ? cover : 1 - cover; // how far the card is sealed, in treads
    if (own && (picked || since < 1)) {
      g.save();
      g.beginPath();
      g.roundRect(x, y, cw, ch, fs * 0.5);
      g.clip();
      own.paint(g, x, y, cw, ch, picked ? cover : 1 - cover, c.alpha(col.accent2, 0.16));
      g.restore();
    }
    // The border thickens and takes the accent in the same treads as the seal. Its outline is
    // traced again, because the seal's edge left its own path on the context.
    g.strokeStyle = c.alpha(c.mix(col.muted, col.accent2, edge), 0.4 + 0.55 * edge);
    g.lineWidth = 1 + edge;
    g.beginPath();
    g.roundRect(x, y, cw, ch, fs * 0.5);
    g.stroke();
    // The verdict is cut on at one moment of its own roll, after the archive read the omen or
    // the puzzle was solved, and stays.
    const saidAt = s.reveal ? s.revealAt : s.readAt ? s.readAt[i] : null;
    const said = saidAt == null || !s.t ? 1 : Math.min(1, (s.t - saidAt) / 1.0);
    const spoken = settled && (own ? own.at(0x5a1d + i).flicker(said) : 1);
    write(g, 'omen ' + (i + 1), x + fs * 0.6, y + fs, fs * 0.85, col.accent2, 'left', 700);
    if (ch < fs * 5) {
      if (spoken || picked) write(g, spoken ? (holds ? 'holds' : 'does not hold') : 'picked', x + cw / 2, y + ch * 0.7, fs * 0.8, spoken && holds ? col.accent2 : c.alpha(col.fg, 0.9), 'center', 500);
    } else {
      if (spoken) write(g, holds ? 'holds' : 'does not hold', x + cw - fs * 0.6, y + fs, fs * 0.75, holds ? col.accent2 : c.alpha(col.muted, 0.9), 'right', 500);
      const lines = wrap(g, CLAIMS[id].text, fs * 0.9, cw - fs * 1.2);
      lines.slice(0, 3).forEach((line, k) => write(g, line, x + fs * 0.6, y + fs * 2.2 + k * fs * 1.15, fs * 0.9, c.alpha(col.fg, 0.9), 'left', 500));
    }
  });
}

function omensPreview(g, w, h, env, p) {
  omensScene(g, w, h, env, p, { picked: [], reveal: false }, env.variant);
}

function omensPiece(env, p) {
  const helps = asked(env).helps;
  const brightest = byBrightness(p.pts)[0];
  const quadrant = (brightest.y < RING.y ? 'north' : 'south') + (brightest.x < RING.x ? 'west' : 'east');
  const positions = p.pts.map((q, i) => (i + 1) + ' (' + Math.round(q.x * 100) + ', ' + Math.round(q.y * 100) + ', ' + q.b + ')').join('; ');
  const s = { picked: [], reveal: false, marked: false, read: [], t: 0 };
  const draw = (c) => omensScene(c.g, c.w, c.h, c, p, s, env.variant);
  return {
    title: omensTitle(p),
    brief: 'Five claims are written beneath this square sky; exactly two hold. The dashed lines divide east from west and north from south. The ring is centred at (50, 44) with radius 20 on a 0-100 grid; the shaded horizon band begins at 80 south. The bar measures 22 units in any direction, and larger stars are brighter. For a text reading, each star is listed as (east, south, brightness): ' + positions + '.',
    goal: 'Pick the two omens that hold and mark the quadrant containing the brightest star.',
    aspect: '3 / 4',
    checkLabel: 'read the omens',
    steps: [
      { id: 'hold', ask: 'which two omens hold', kind: 'pick', count: 2, items: p.claims.map((id, i) => ({ label: 'omen ' + (i + 1) + ': ' + CLAIMS[id].text, value: i })) },
      { id: 'quadrant', ask: 'where is the brightest star', kind: 'choice', options: [
        { label: 'northwest', value: 'northwest' }, { label: 'northeast', value: 'northeast' },
        { label: 'southwest', value: 'southwest' }, { label: 'southeast', value: 'southeast' }
      ] },
      { id: 'second', ask: 'a closer look at the two brightest, then an omen', kind: 'press', count: 1, label: 'read the sky to me', optional: true }
    ],
    solution: { hold: p.truth.slice(), quadrant },
    check(c) {
      const picked = Array.isArray(c.value('hold')) ? [...new Set(c.value('hold').map(Number))] : [];
      const right = picked.filter((i) => p.truth.includes(i)).length;
      const placed = c.value('quadrant') === quadrant;
      if (picked.length === 2 && right === 2 && placed) return { solved: true, say: 'both picked omens hold; the brightest star is in the marked quadrant' };
      return { solved: false, say: (right === 0 ? 'none' : WORDS[right]) + ' of your ' + (picked.length === 1 ? 'one' : WORDS[picked.length] || String(picked.length)) + ' picked omens hold; the brightest star is ' + (placed ? 'in' : 'outside') + ' the marked quadrant' };
    },
    start(c) {
      c.status(WORDS[p.pts.length] + ' stars, five omens; two hold');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'hold') {
        const was = s.picked;
        s.picked = Array.isArray(value) ? value.map(Number) : [];
        // Every omen whose pick changed starts its seal (or its unsealing) now, on a fresh roll.
        s.pickedAt = s.pickedAt || {};
        s.pickRoll = s.pickRoll || {};
        s.picks = (s.picks || 0) + 1;
        p.claims.forEach((id2, i) => {
          if (was.includes(i) !== s.picked.includes(i)) {
            s.pickedAt[i] = s.t;
            s.pickRoll[i] = s.picks;
          }
        });
        c.status(s.picked.length ? 'picked: ' + s.picked.map((i) => 'omen ' + (i + 1)).join(', ') : 'nothing picked yet');
      }
      if (id === 'quadrant') {
        if (value !== s.quadrant) {
          // The quadrant marked before goes while this one seals, on a roll of this mark's own.
          s.quadrantPrev = s.quadrant;
          s.quadrant = value;
          s.quadrantAt = s.t;
          s.marks = (s.marks || 0) + 1;
        }
        c.status('marked the ' + value + ' quadrant for the brightest star');
      }
      if (id === 'second') {
        // One knob, spent down the difficulty's allowance: the first turn of it rings the two
        // brightest, and every turn after that reads one omen against the archive's own sky --
        // the ones called wrongly first. At the fiercest setting the ring is the whole allowance.
        const spent = (s.marked ? 1 : 0) + s.read.length;
        const unread = p.claims.map((id2, i) => i).filter((i) => !s.read.includes(i));
        const miscalled = unread.filter((i) => s.picked.includes(i) !== p.truth.includes(i));
        if (!s.marked) {
          s.marked = true;
          s.markedAt = s.t;
          c.hint();
          c.status('the two brightest are ringed; the ring, the band and the hand\'s width are the measure');
        } else if (spent >= helps) {
          c.status('that is all the archive will read at this difficulty; the ring, the band and the hand\'s width are the measure');
        } else if (unread.length) {
          const next = miscalled.length ? miscalled[0] : unread[0];
          s.read.push(next);
          s.readAt = s.readAt || {};
          s.readAt[next] = s.t;
          c.hint();
          c.status('omen ' + (next + 1) + (p.truth.includes(next) ? ' holds against the sky' : ' does not hold'));
        } else {
          c.status('every omen has been read; the ones that hold are the ones to pick');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      draw(c);
    },
    end(c) {
      s.reveal = true;
      s.revealAt = s.t;
      const line = READINGS[(p.truth.length * 3 + p.truth[0] + p.pts.length) % READINGS.length];
      c.status('the omens that hold: ' + p.truth.map((i) => 'omen ' + (i + 1)).join(', ') + '; the brightest star is ' + quadrant + '. the archive reads: ' + line);
      draw(c);
    }
  };
}

/* ---- the star's itinerary ------------------------------------------------------------------- */

const DIRECTIONS = ['N', 'E', 'S', 'W'];

function routeStep(at, direction) {
  const row = Math.floor(at / 3);
  const col = at % 3;
  if (direction === 'N' && row > 0) return at - 3;
  if (direction === 'E' && col < 2) return at + 1;
  if (direction === 'S' && row < 2) return at + 3;
  if (direction === 'W' && col > 0) return at - 1;
  return null;
}

function routeWalk(p) {
  const trail = [p.start];
  for (const direction of p.moves) {
    const next = routeStep(trail[trail.length - 1], direction);
    if (next === null) return null;
    trail.push(next);
  }
  return trail;
}

function routePlan(env) {
  const lights = some(env, [1, 2, 3, 4, 5, 6, 7, 8, 9], 9);
  const trail = [env.int(0, 8)];
  const moves = [];
  const length = env.chance(0.35) ? 5 : 4;
  while (moves.length < length) {
    const at = trail[trail.length - 1];
    const possible = DIRECTIONS.filter((d) => routeStep(at, d) !== null);
    const onward = possible.filter((d) => routeStep(at, d) !== trail[trail.length - 2]);
    const direction = env.pick(onward.length ? onward : possible);
    moves.push(direction);
    trail.push(routeStep(at, direction));
  }
  return { kind: 'route', lights, start: trail[0], moves };
}

function carriedRoute(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'route' || !Array.isArray(p.lights) || p.lights.length !== 9) return null;
  if (!p.lights.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) || new Set(p.lights).size !== 9) return null;
  if (!Number.isInteger(p.start) || p.start < 0 || p.start > 8) return null;
  if (!Array.isArray(p.moves) || (p.moves.length !== 4 && p.moves.length !== 5)
      || !p.moves.every((d) => DIRECTIONS.includes(d)) || !routeWalk(p)) return null;
  return { kind: 'route', lights: p.lights.slice(), start: p.start, moves: p.moves.slice() };
}

function routeTitle(p) {
  return 'the star\'s itinerary: ' + WORDS[p.moves.length] + ' steps';
}

function routeBlank() {
  return { seen: 0, from: 0, shownAt: null, shows: 0, focus: -1, focusAt: null, focuses: 0, done: false, t: 0 };
}

function routeScene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const fs = Math.max(10, Math.min(14, Math.min(w, h) * 0.034));
  const radius = Math.min(w, h) * 0.037 * v.scale;
  const point = (i) => ({ x: w * (0.16 + (i % 3) * 0.34), y: h * (0.18 + Math.floor(i / 3) * 0.25) });
  const trail = routeWalk(p);
  // The trail, as far as it has been shown. Each landing a hint shows -- and at the solve, the rest
  // of the route -- is drawn out from the star it leaves in the stair's treads, on a roll of that
  // showing's own, and a star lights as the trail lands on it.
  const target = s.done ? p.moves.length : s.seen;
  const from = Math.min(s.from || 0, target);
  const own = c.rite && s.shownAt != null ? c.rite.at(0x7a11 + (s.shows || 0)) : null;
  const since = s.shownAt == null || !s.t ? 1 : Math.min(1, (s.t - s.shownAt) / 0.9);
  const shown = from + (target - from) * (own ? own.stair(since) : 1);
  const landed = Math.floor(shown + 1e-9);
  dark(g, w, h, c, v);
  write(g, 'start at star ' + (p.start + 1), w / 2, h * 0.055, fs, col.accent2, 'center', 600);
  g.strokeStyle = c.alpha(col.muted, 0.22);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = point(i);
    if (i % 3 < 2) {
      const b = point(i + 1);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
    if (i < 6) {
      const b = point(i + 3);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
  }
  g.stroke();
  if (shown > 0) {
    g.strokeStyle = col.accent2;
    g.lineWidth = Math.max(2, radius * 0.18);
    g.beginPath();
    const first = point(trail[0]);
    g.moveTo(first.x, first.y);
    for (let step = 1; step <= Math.ceil(shown - 1e-9); step++) {
      const a = point(trail[step - 1]);
      const b = point(trail[step]);
      const part = Math.min(1, shown - (step - 1));
      g.lineTo(a.x + (b.x - a.x) * part, a.y + (b.y - a.y) * part);
    }
    g.stroke();
  }
  // The star marked as the last is lit at once, as the press that marked it, and its ring widens
  // out of it a tread at a time on a roll of that mark's own.
  const ringRite = c.rite && s.focusAt != null ? c.rite.at(0x2f0c + (s.focuses || 0)) : null;
  const ringAge = s.focusAt == null || !s.t ? 1 : Math.min(1, (s.t - s.focusAt) / 0.7);
  const ringOut = ringRite ? ringRite.stair(ringAge) : 1;
  for (let i = 0; i < 9; i++) {
    const q = point(i);
    const r = radius * (0.75 + p.lights[i] * 0.045);
    const lit = i === p.start || i === s.focus || trail.slice(1, landed + 1).includes(i);
    glow(g, c, q.x, q.y, r * 2.3, lit ? col.accent2 : col.accent, 0.22 + (lit ? 0.18 : 0));
    g.fillStyle = lit ? col.accent2 : c.mix(col.accent, col.fg, p.lights[i] / 9);
    g.beginPath();
    g.arc(q.x, q.y, r, 0, Math.PI * 2);
    g.fill();
    write(g, String(i + 1), q.x, q.y, fs, col.bg, 'center', 700);
    write(g, String(p.lights[i]), q.x, q.y + r + fs * 1.15, fs, col.fg, 'center', 600);
    if (i === s.focus) {
      g.strokeStyle = col.accent2;
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(q.x, q.y, r * (1.15 + 0.4 * ringOut), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
  write(g, 'steps: ' + p.moves.join('  '), w / 2, h * 0.84, fs * 1.15, col.accent2, 'center', 700);
  write(g, 'brightness is below each star', w / 2, h * 0.93, fs, c.alpha(col.fg, 0.9), 'center', 500);
}

function routePreview(g, w, h, env, p) {
  routeScene(g, w, h, env, p, routeBlank(), env.variant);
}

function routePiece(env, p) {
  const helps = asked(env).helps;
  const trail = routeWalk(p);
  const end = trail[trail.length - 1] + 1;
  const sum = trail.slice(1).reduce((total, index) => total + p.lights[index], 0);
  const s = routeBlank();
  // A new star marked as the last one: its ring widens on a roll of this mark's own.
  const mark = (i) => {
    if (i === s.focus) return;
    s.focus = i;
    s.focusAt = s.t;
    s.focuses += 1;
  };
  const draw = (c) => routeScene(c.g, c.w, c.h, c, p, s, env.variant);
  return {
    title: routeTitle(p),
    brief: 'Stars 1 to 9 form three rows, numbered left to right. Each star\'s brightness is written below it. Start at star ' + (p.start + 1)
      + ' and follow ' + p.moves.join(', ') + ': N is up, E right, S down, W left. Add the brightness of each star you LAND ON, not the starting star; count a star again if you revisit it. For a text reading, brightness by star: '
      + p.lights.map((light, i) => (i + 1) + ': ' + light).join('; ') + '. Tap a star to choose it as your end star.',
    goal: 'Name the last star and add the brightness of every star landed on.',
    aspect: '1 / 1',
    checkLabel: 'read the route',
    steps: [
      { id: 'end', ask: 'which star is last (1 to 9)', kind: 'number', min: 1, max: 9, step: 1, value: 1 },
      { id: 'sum', ask: 'brightness added along the route', kind: 'number', min: 0, max: 45, step: 1, value: 0 },
      { id: 'hint', ask: 'show the next landing', kind: 'press', count: 1, label: 'show a step', optional: true }
    ],
    solution: { end, sum },
    check(c) {
      const lastMatches = Number(c.value('end')) === end;
      const sumMatches = Number(c.value('sum')) === sum;
      return { solved: lastMatches && sumMatches, say: lastMatches && sumMatches
        ? 'the route ends at star ' + end + ' and its landings add to ' + sum
        : 'the last star ' + (lastMatches ? 'matches' : 'does not match') + '; the brightness total ' + (sumMatches ? 'matches' : 'does not match') };
    },
    start(c) {
      c.status('Start at star ' + (p.start + 1) + '; follow the steps written under the chart.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'end') {
        mark(Number(value) - 1);
        c.status('Star ' + value + ' marked as the last star.');
      }
      if (id === 'sum') c.status('You counted ' + value + ' brightness across the landings.');
      if (id === 'hint') {
        if (s.seen < helps && s.seen < p.moves.length) {
          // The trail is drawn out from where it stands to the landing shown.
          s.from = s.seen;
          s.seen += 1;
          s.shownAt = s.t;
          s.shows += 1;
          c.hint();
          const at = trail[s.seen];
          c.status('After step ' + s.seen + ', the route reaches star ' + (at + 1) + ', brightness ' + p.lights[at] + '.');
        } else c.status('No more steps can be shown at this difficulty; those already shown stay on the chart.');
      }
      draw(c);
    },
    tap(x, y, c) {
      for (let i = 0; i < 9; i++) {
        if (Math.abs(x - (0.16 + (i % 3) * 0.34)) < 0.12
            && Math.abs(y - (0.18 + Math.floor(i / 3) * 0.25)) < 0.1) {
          mark(i);
          c.set('end', i + 1);
          c.status('Star ' + (i + 1) + ' has brightness ' + p.lights[i] + '; marked as the last star.');
          draw(c);
          return;
        }
      }
      c.status('Tap one of the numbered stars to mark it as the last star.');
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += Math.max(0, dt);
      draw(c);
    },
    end(c) {
      // The rest of the route is drawn out from the last landing shown.
      s.from = s.seen;
      s.done = true;
      s.shownAt = s.t;
      s.shows += 1;
      c.status('The route ends at star ' + end + '; its landings add to ' + sum + '. The chart stays open to read again.');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

// Which asking this card is, and its plan, dealt once from the env's seeded stream and kept with
// that env: every pass over one card -- the still picture and the spark -- asks here, so they are
// one card rather than a re-roll per pass.
const dealt = new WeakMap();
function deal(env) {
  let got = dealt.get(env);
  if (!got) {
    got = env.chance(0.26) ? routePlan(env) : env.chance(0.5) ? wheelPlan(env) : omensPlan(env);
    dealt.set(env, got);
  }
  return got;
}

export default {
  id: 'sky-archive',
  needsSky: true,
  paint(g, w, h, env) {
    const p = deal(env);
    if (p.kind === 'wheel') {
      // The card's rim is turned as far as the configuration turns it, so a repeat is the same
      // wheel seen at another setting.
      wheelScene(g, w, h, env, p, { angle: env.variant.turn * Math.PI * 2, spin: 0 }, env.variant);
    } else if (p.kind === 'route') routePreview(g, w, h, env, p);
    else omensPreview(g, w, h, env, p);
  },
  spark(env) {
    const p = deal(env);
    if (p.kind === 'wheel') {
      return {
        title: wheelTitle(p),
        quote: 'the archive asks for ' + p.word,
        text: 'Three stars point at the rim of twenty-four letters. One turn brings them onto the word in order: how many notches, and which way?',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => wheelPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    if (p.kind === 'route') return {
      title: routeTitle(p),
      quote: 'start at star ' + (p.start + 1) + '; ' + p.moves.join('  '),
      text: 'Follow the steps across the chart. Name the last star and add the brightness of the stars you land on.',
      aspect: '1 / 1',
      paint: (g, w, h, cardEnv) => routePreview(g, w, h, cardEnv, p),
      of: p
    };
    return {
      title: omensTitle(p),
      quote: CLAIMS[p.claims[0]].text,
      text: 'Five claims against a sky of ' + WORDS[p.pts.length] + ' stars. Pick the two that hold and locate the brightest star.',
      aspect: '3 / 4',
      paint: (g, w, h, cardEnv) => omensPreview(g, w, h, cardEnv, p),
      of: p
    };
  },
  piece(env) {
    const wheel = carriedWheel(env);
    if (wheel) return wheelPiece(env, wheel);
    const omens = carriedOmens(env);
    if (omens) return omensPiece(env, omens);
    const route = carriedRoute(env);
    if (route) return routePiece(env, route);
    const p = deal(env);
    return p.kind === 'wheel' ? wheelPiece(env, p) : p.kind === 'route' ? routePiece(env, p) : omensPiece(env, p);
  }
};
