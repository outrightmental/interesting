/* The sky archive: a wheel of letters turned under the stars, and omens written against a sky.
   As a card it is the wheel with three stars pointing at its rim, or a small sky with four omen
   cards under it (paint, spark); as a piece it is one of the two puzzles below, and the card it
   was opened from says which. See js/feed.js for what a module is and js/stage.js for what a
   piece is.

   Two puzzles, both deduction:

     the wheel of letters   Twenty-four letters round the rim, a notch apart, and three stars inside
                            the wheel, each pointing at one. The archive asks for a word of three
                            letters, and one turn of the wheel brings the three stars onto that
                            word's letters in order. Say how many notches, and which way. The stars
                            are placed from the word and the turn, and the same count the other way
                            round is made to read nothing. A wrong check says whether the count is
                            off, or fits one way round, and no more.
     which omens hold       A sky of five to seven stars, a ring, a horizon band and a hand's-width
                            scale, and four omens, each a claim that can be checked against the sky.
                            Pick the ones that hold. The sky is rolled until one to three of the
                            four hold and no star sits on an edge that would make a claim a matter
                            of opinion. A wrong check says how many of the picked hold, and no more.

   The sky a visitor brings may be one star or many: it is drawn behind the wheel for colour, and
   nothing of the puzzle depends on it. The plan is rolled from the seed, carried whole on the
   card's `of`, and rebuilt from that, so a card and the feature it opens as are one puzzle. */

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

/* ---- shared drawing ------------------------------------------------------------------------- */

function mod(n, m) {
  return ((n % m) + m) % m;
}

function ease(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

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
  const notches = starNotches(p);
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
  // The three stars, each on a spoke from the centre out to the rim.
  const lit = s.spin >= 1;
  notches.forEach((n, k) => {
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
    glow(g, c, star.x, star.y, R * 0.12, col.accent2, lit ? 0.7 : 0.45);
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
    const on = lit && notches.some((n, k) => rim[mod(n + (p.cw ? -p.t : p.t), NOTCHES)] === ch);
    if (on) glow(g, c, q.x, q.y, size * 1.4, col.accent2, 0.6);
    write(g, ch, q.x, q.y, size, on ? col.accent2 : c.alpha(col.fg, 0.9), 'center', 600);
  });
  // What the archive asks, under the wheel, and the letters left off the rim.
  const fs = Math.max(10, Math.min(16, Math.min(w, h) * 0.036));
  write(g, 'the archive asks for', cx, h * 0.045 + fs * 0.1, fs * 0.85, c.alpha(col.muted, 0.9), 'center', 500);
  write(g, p.word.split('').join('  '), cx, h * 0.045 + fs * 1.3, fs * 1.4, col.accent2, 'center', 700);
  write(g, 'no ' + p.dropped[0] + ', no ' + p.dropped[1] + ' on the rim', w * 0.03, h * 0.96, fs * 0.8, c.alpha(col.muted, 0.8), 'left', 500);
  write(g, 'clockwise', tip.x + R * 0.1, tip.y - R * 0.02, fs * 0.8, c.alpha(col.muted, 0.9), 'left', 500);
  write(g, s.spin >= 1 ? notches(p.t) + ' ' + wayWord(p.cw) : 'the wheel is seized: say how it must turn', w * 0.97, h * 0.96, fs * 0.8, s.spin >= 1 ? col.accent2 : c.alpha(col.muted, 0.8), 'right', 500);
}

function wheelPreview(g, w, h, env, p) {
  wheelScene(g, w, h, env, p, { angle: 0, spin: 0 }, env.variant);
}

function wheelPiece(env, p) {
  const s = { angle: 0, spin: 0 };
  const draw = (c) => wheelScene(c.g, c.w, c.h, c, p, s, env.variant);
  return {
    title: wheelTitle(p),
    brief: 'Twenty-four letters round the rim, one notch apart, and three stars inside the wheel, each pointing along its spoke at one letter. The wheel is seized at the setting it kept since midnight. One turn of it, so many notches one way round, brings star 1, star 2 and star 3 onto the letters of the word the archive asks for, in order.',
    goal: 'Say how many notches the wheel must turn, and which way, to read the word.',
    aspect: '1 / 1',
    checkLabel: 'turn the wheel',
    steps: [
      { id: 'count', ask: 'how many notches', kind: 'number', min: 1, max: 23, step: 1, value: 1, unit: 'notches' },
      { id: 'way', ask: 'which way round', kind: 'choice', options: [
        { label: 'clockwise', value: 'cw' },
        { label: 'counterclockwise', value: 'ccw' }
      ] }
    ],
    solution: { count: p.t, way: p.cw ? 'cw' : 'ccw' },
    check(c) {
      const n = Number(c.value('count'));
      const cw = c.value('way') === 'cw';
      if (!Number.isInteger(n) || n < 1 || n > 23) return { solved: false, say: 'the count has to be one to twenty-three' };
      const read = reading(p, n, cw);
      if (read === p.word) return { solved: true, say: notches(n) + ' ' + wayWord(cw) + ': the stars read ' + p.word };
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
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) {
        s.spin = c.reduced ? 1 : Math.min(1, s.spin + dt * 0.7);
        s.angle = ease(s.spin) * p.t * (Math.PI * 2 / NOTCHES) * (p.cw ? 1 : -1);
      }
      draw(c);
    },
    end(c) {
      c.status('the wheel turns ' + notches(p.t) + ' ' + wayWord(p.cw) + ' and the stars read ' + p.word + '; it is archived');
    }
  };
}

/* ---- which omens hold ----------------------------------------------------------------------- */

const RING = { x: 0.5, y: 0.44, r: 0.2 };
const BAND = 0.8; // the horizon band's top edge, as a fraction of the sky's height
const HAND = 0.22; // a hand's width, as a fraction of the sky's width
const MARGIN = 0.035;

// Each omen family has two readings, one the other's opposite; a sky gets one claim per family.
const FAMILIES = [
  [{ id: 'eastMore', text: 'more stars lie east of the meridian than west' }, { id: 'westMore', text: 'more stars lie west of the meridian than east' }],
  [{ id: 'inRing', text: 'a star lies inside the ring' }, { id: 'noneInRing', text: 'no star lies inside the ring' }],
  [{ id: 'brightClose', text: 'the two brightest lie within a hand\'s width of each other' }, { id: 'brightFar', text: 'the two brightest lie more than a hand\'s width apart' }],
  [{ id: 'noneInBand', text: 'no star touches the horizon band' }, { id: 'oneInBand', text: 'a star touches the horizon band' }],
  [{ id: 'brightestEast', text: 'the brightest star lies east of the meridian' }, { id: 'brightestWest', text: 'the brightest star lies west of the meridian' }],
  [{ id: 'faintestNorth', text: 'the faintest star lies north of the ring\'s centre line' }, { id: 'threeNorth', text: 'exactly three stars lie north of the ring\'s centre line' }]
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

// A sky the generator can always fall back on: three of its four omens hold, and nothing in it is
// on an edge (carriedOmens holds it to the same tests as any other).
const FALLBACK = {
  kind: 'omens',
  pts: [{ x: 0.2, y: 0.2, b: 9 }, { x: 0.75, y: 0.25, b: 7 }, { x: 0.56, y: 0.38, b: 5 }, { x: 0.3, y: 0.65, b: 3 }, { x: 0.8, y: 0.9, b: 1 }],
  claims: ['eastMore', 'inRing', 'brightFar', 'noneInBand'],
  truth: [0, 1, 2]
};

function omensPlan(env) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = env.int(5, 7);
    const levels = some(env, [1, 2, 3, 4, 5, 6, 7, 8, 9], n);
    const pts = [];
    for (let i = 0; i < n && pts.length === i; i++) {
      const q = starAt(env, pts);
      if (q) pts.push({ x: q.x, y: q.y, b: levels[i] });
    }
    if (pts.length !== n) continue;
    const claims = some(env, FAMILIES.map((pair, f) => f), 4).map((f) => FAMILIES[f][env.int(0, 1)].id);
    const truth = claims.map((id, i) => (claimHolds(id, pts) ? i : -1)).filter((i) => i >= 0);
    if (clearSky(pts) && truth.length >= 1 && truth.length <= 3) return { kind: 'omens', pts, claims, truth };
  }
  return { kind: 'omens', pts: FALLBACK.pts.map((q) => Object.assign({}, q)), claims: FALLBACK.claims.slice(), truth: FALLBACK.truth.slice() };
}

function carriedOmens(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'omens') return null;
  if (!Array.isArray(p.pts) || p.pts.length < 5 || p.pts.length > 7) return null;
  const okPt = (q) => q && typeof q === 'object' && Number.isFinite(q.x) && Number.isFinite(q.y) && q.x > 0 && q.x < 1 && q.y > 0 && q.y < 1 && Number.isInteger(q.b) && q.b >= 1 && q.b <= 9;
  if (!p.pts.every(okPt) || new Set(p.pts.map((q) => q.b)).size !== p.pts.length) return null;
  const pts = p.pts.map((q) => ({ x: q.x, y: q.y, b: q.b }));
  if (!Array.isArray(p.claims) || p.claims.length !== 4 || !p.claims.every((id) => CLAIMS[id])) return null;
  if (new Set(p.claims.map((id) => CLAIMS[id].family)).size !== 4) return null;
  const truth = p.claims.map((id, i) => (claimHolds(id, pts) ? i : -1)).filter((i) => i >= 0);
  if (truth.length < 1 || truth.length > 3 || !clearSky(pts)) return null;
  if (!Array.isArray(p.truth) || p.truth.length !== truth.length || !truth.every((i, k) => p.truth[k] === i)) return null;
  return { kind: 'omens', pts, claims: p.claims.slice(), truth };
}

function omensTitle(p) {
  return 'which omens hold: ' + WORDS[p.pts.length] + ' stars';
}

function skyFrame(w, h, v) {
  const sw = w * (0.8 + 0.1 * v.scale);
  const sh = h * (0.52 + 0.08 * v.scale);
  return { x: w / 2 - sw / 2 + (v.turn - 0.5) * w * 0.02, y: h * 0.03, sw, sh };
}

// The drawn sky: the stars by brightness, the ring, the meridian and the centre line, the horizon
// band, the hand's-width scale, and the four omens under it.
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
  g.lineTo(X(RING.x), Y(BAND));
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
  // The four omens, as cards under the sky; a picked one is marked, and the ones that hold are
  // shown once the puzzle is solved.
  const top = f.y + f.sh + h * 0.03;
  const gap = w * 0.015;
  const cw = (f.sw - gap * 3) / 4;
  const ch = h - top - h * 0.03;
  p.claims.forEach((id, i) => {
    const x = f.x + i * (cw + gap);
    const picked = s.picked.includes(i);
    const holds = s.reveal && p.truth.includes(i);
    g.fillStyle = c.alpha(col.bg, 0.6);
    g.beginPath();
    g.roundRect(x, top, cw, ch, fs * 0.5);
    g.fill();
    g.strokeStyle = picked ? c.alpha(col.accent2, 0.95) : c.alpha(col.muted, 0.4);
    g.lineWidth = picked ? 2 : 1;
    g.stroke();
    write(g, 'omen ' + (i + 1) + (holds ? ': holds' : s.reveal ? ': does not hold' : ''), x + fs * 0.6, top + fs, fs * 0.85, holds ? col.accent2 : s.reveal ? c.alpha(col.muted, 0.9) : col.accent2, 'left', 700);
    const lines = wrap(g, CLAIMS[id].text, fs * 0.9, cw - fs * 1.2);
    lines.slice(0, 4).forEach((line, k) => write(g, line, x + fs * 0.6, top + fs * 2.3 + k * fs * 1.2, fs * 0.9, c.alpha(col.fg, 0.9), 'left', 500));
  });
}

function omensPreview(g, w, h, env, p) {
  omensScene(g, w, h, env, p, { picked: [], reveal: false }, env.variant);
}

function omensPiece(env, p) {
  const s = { picked: [], reveal: false };
  const draw = (c) => omensScene(c.g, c.w, c.h, c, p, s, env.variant);
  return {
    title: omensTitle(p),
    brief: 'The archive drew this sky at midnight and wrote four omens against it. Each omen is a claim about the stars as drawn: the ring, the meridian through its centre, the horizon band and the hand\'s width marked at the corner are the measure, and a larger star is a brighter one. Some of the omens hold; the rest do not.',
    goal: 'Pick every omen that holds, and none that does not.',
    aspect: '4 / 3',
    checkLabel: 'read the omens',
    steps: [
      { id: 'hold', ask: 'the omens that hold', kind: 'pick', items: p.claims.map((id, i) => ({ label: 'omen ' + (i + 1), value: i })) },
      { id: 'second', ask: 'a second look at the sky', kind: 'press', count: 1, label: 'look again', optional: true }
    ],
    solution: { hold: p.truth.slice() },
    check(c) {
      const picked = Array.isArray(c.value('hold')) ? c.value('hold').map(Number) : [];
      const right = picked.filter((i) => p.truth.includes(i)).length;
      const wrong = picked.length - right;
      const missed = p.truth.length - right;
      if (!wrong && !missed) return { solved: true, say: WORDS[p.truth.length] + ' of the four hold, and those are the ones' };
      const parts = [];
      if (!picked.length) parts.push('nothing is picked');
      else parts.push((right === 0 ? 'none' : WORDS[right]) + ' of the ' + (picked.length === 1 ? 'one' : WORDS[picked.length]) + ' picked ' + (right === 1 ? 'holds' : 'hold'));
      if (wrong) parts.push(WORDS[wrong] + (wrong === 1 ? ' does not' : ' do not'));
      if (missed) parts.push(WORDS[missed] + ' that ' + (missed === 1 ? 'holds is' : 'hold are') + ' missing');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(WORDS[p.pts.length] + ' stars, four omens');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'hold') {
        s.picked = Array.isArray(value) ? value.map(Number) : [];
        c.status(s.picked.length ? 'picked: ' + s.picked.map((i) => 'omen ' + (i + 1)).join(', ') : 'nothing picked yet');
      }
      if (id === 'second') c.status('the sky holds still; the ring, the band and the hand\'s width are the measure');
      draw(c);
    },
    frame(t, dt, c) {
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('the omens that hold: ' + p.truth.map((i) => 'omen ' + (i + 1)).join(', ') + '; archived');
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsWheel(env) {
  return env.chance(0.5);
}

export default {
  id: 'sky-archive',
  needsSky: true,
  paint(g, w, h, env) {
    if (dealsWheel(env)) {
      // The card's rim is turned as far as the configuration turns it, so a repeat is the same
      // wheel seen at another setting.
      wheelScene(g, w, h, env, wheelPlan(env), { angle: env.variant.turn * Math.PI * 2, spin: 0 }, env.variant);
    } else omensPreview(g, w, h, env, omensPlan(env));
  },
  spark(env) {
    if (dealsWheel(env)) {
      const p = wheelPlan(env);
      return {
        title: wheelTitle(p),
        quote: 'the archive asks for ' + p.word,
        text: 'Three stars point at the rim of twenty-four letters. One turn brings them onto the word in order: how many notches, and which way?',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => wheelPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = omensPlan(env);
    return {
      title: omensTitle(p),
      quote: CLAIMS[p.claims[0]].text,
      text: 'One of four omens written against a sky of ' + WORDS[p.pts.length] + ' stars. Some hold; pick the ones that do.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => omensPreview(g, w, h, cardEnv, p),
      of: p
    };
  },
  piece(env) {
    const wheel = carriedWheel(env);
    if (wheel) return wheelPiece(env, wheel);
    const omens = carriedOmens(env);
    if (omens) return omensPiece(env, omens);
    return dealsWheel(env) ? wheelPiece(env, wheelPlan(env)) : omensPiece(env, omensPlan(env));
  }
};
