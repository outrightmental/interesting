/* The apocrypha desk: a catalogue of objects that were never real, dealt one at a time. As a card
   it is one specimen with its catalogue number, provenance and assessment (paint, spark); as a
   piece it is the desk itself: a specimen to name, wear, lie to and stamp into the drawer, or a
   drawer of specimens to cross-reference and file together. Nothing here is a real object, a real
   collection or a real claim about the world. See js/feed.js for what a module is and js/stage.js
   for what a piece is. */

const MATERIALS = ['brass', 'horn', 'bakelite', 'tin', 'bone', 'blue glass', 'wax', 'pewter', 'felt', 'cedar',
  'slate', 'ivory-coloured celluloid'];
const OBJECTS = ['key', 'compass', 'whistle', 'thimble', 'spoon', 'lens', 'bell', 'button', 'hinge', 'reel',
  'ticket punch', 'stamp', 'hourglass', 'tuning peg', 'latch'];
const QUALIFIERS = [
  'for a door that was never hung',
  'that points at the last place you were happy',
  'audible only to the person it is meant for',
  'worn smooth by a hand that is not on record',
  'from a railway with no stations',
  'made to measure a distance that was later abolished',
  'engraved with a date that did not occur',
  'that fits a lock in a house nobody can find',
  'for sealing letters that were never sent',
  'said to warm slightly when lied to'
];
const PROVENANCE = [
  'found in the lining of a coat, unlisted',
  'bought at a sale of effects, lot 41, no further detail',
  'left on a bench at a station in the fog',
  'passed down with the wrong story attached',
  'recovered from a drawer that was supposed to be empty',
  'sent anonymously, postage due',
  'traded for a smaller object of the same kind'
];
const VERDICTS = [
  'almost certainly never existed',
  'existed briefly, then was described out of existence',
  'exists only in this description',
  'a forgery of a thing that was itself a forgery',
  'authenticity unverifiable; charm considerable',
  'genuine, in the sense that this card is genuine'
];
const PLACES = ['a house clearance', 'the back of a theatre', 'a flooded archive', 'a shipbreaker’s yard',
  'a disused telephone exchange', 'a bequest', 'the gap behind a bookcase', 'a lot bought unseen',
  'a skip outside a surveyor’s office'];
const LINKS = [
  { label: 'the same hand', text: 'were accessioned on the same afternoon by the same hand' },
  { label: 'a shared serial', text: 'share a serial sequence that belongs to neither of them' },
  { label: 'the same paragraph', text: 'are described in the same paragraph of a catalogue nobody has produced' },
  { label: 'they fit together', text: 'fit together, which neither of them should' },
  { label: 'both withdrawn once', text: 'were both withdrawn once and both reinstated without comment' },
  { label: 'the same scratch', text: 'carry the same scratch in the same place' }
];
const WEAR = [
  'shows no wear at all, which is the strangest thing about it',
  'light wear, consistent with being looked at and put back',
  'the wear pattern suggests constant use by someone left-handed',
  'worn smooth by a hand that is not on record'
];
const LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';
// Which silhouette each object is drawn as; anything unlisted is a disc.
const KINDS = { key: 'key', latch: 'key', whistle: 'tube', 'tuning peg': 'tube', spoon: 'tube', bell: 'bell',
  reel: 'spool', thimble: 'spool', hourglass: 'spool', hinge: 'block', stamp: 'block', 'ticket punch': 'block' };

/* ---- the drawing: desk, drawer, card, specimen ---------------------------------------------- */

function ease(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function catalogue(env) {
  return env.pick(LETTERS.split('')) + env.pick(LETTERS.split('')) + '-' + env.int(1000, 9999) + '.' + env.int(10, 99);
}

function some(env, list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

// What the desk looks like for one piece: the grain's rows, the card's foxing, the specimen's
// scratches and the tilt everything lies at.
function scenery(env) {
  const rows = [];
  for (let i = 0; i < 64; i++) rows.push(0.25 + env.rnd() * 0.2);
  const spots = [];
  for (let i = 0; i < 14; i++) spots.push({ x: env.rnd(), y: env.rnd(), r: 1 + env.rnd() * 3 });
  const scratches = [];
  for (let i = 0; i < 16; i++) {
    const a = env.rnd() * Math.PI;
    scratches.push({ x: (env.rnd() - 0.5) * 1.6, y: (env.rnd() - 0.5) * 1.8, dx: Math.cos(a) * 0.5, dy: Math.sin(a) * 0.5 });
  }
  return { rows, spots, scratches, tilt: (env.rnd() - 0.5) * 0.12 };
}

function deskTop(g, w, h, c, rows) {
  g.fillStyle = c.mix(c.colors.bg, c.colors.bg2, 0.3);
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < rows.length; i++) {
    g.fillStyle = c.alpha(c.colors.bg2, rows[i]);
    g.fillRect(0, Math.round((i / rows.length) * h), w, 1);
  }
}

// The drawer front along the bottom of the desk; `open` (0..1) slides it out and shows the slot.
function drawer(g, w, h, c, open) {
  const k = c.colors;
  const top = h * 0.86;
  const drop = open * h * 0.07;
  if (open > 0) {
    g.fillStyle = c.alpha(k.bg, 0.85 * open);
    g.fillRect(w * 0.06, top - drop * 0.4, w * 0.88, drop * 1.4);
  }
  g.fillStyle = c.mix(k.bg, k.bg2, 0.55);
  g.fillRect(0, top + drop, w, h);
  g.fillStyle = c.alpha(k.fg, 0.08);
  g.fillRect(0, top + drop, w, 1);
  g.fillStyle = c.alpha(k.accent2, 0.55);
  g.fillRect(w / 2 - 18, top + drop + (h - top) * 0.5 - 2, 36, 4);
}

function write(g, str, x, y, size, color, align, weight) {
  g.font = (weight || 500) + ' ' + Math.max(9, Math.round(size)) + 'px system-ui, sans-serif';
  g.fillStyle = color;
  g.textAlign = align || 'left';
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

// An index card, ruled, with its centre at the origin: `age` yellows and foxes it, `lift` deepens
// its shadow, `rows` is how many rules it is ruled for (the first rule is the red one).
function card(g, c, cw, ch, age, spots, lift, rows) {
  const k = c.colors;
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 8 + lift * 14;
  g.shadowOffsetY = 3 + lift * 6;
  g.fillStyle = c.mix(c.mix(k.bg, k.fg, 0.08), k.accent2, age * 0.14);
  g.fillRect(-cw / 2, -ch / 2, cw, ch);
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  if (spots) {
    g.fillStyle = c.alpha(k.accent2, 0.16);
    const n = Math.round(age * spots.length);
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(-cw / 2 + spots[i].x * cw, -ch / 2 + spots[i].y * ch, spots[i].r * (0.6 + age), 0, Math.PI * 2);
      g.fill();
    }
  }
  const m = Math.min(10, cw * 0.06);
  const n = rows || 6;
  g.lineWidth = 1;
  for (let i = 1; i < n; i++) {
    const y = -ch / 2 + (ch / n) * i;
    g.strokeStyle = i === 1 ? c.alpha(k.accent2, 0.7) : c.alpha(k.accent, 0.35);
    g.beginPath();
    g.moveTo(-cw / 2 + m, y);
    g.lineTo(cw / 2 - m, y);
    g.stroke();
  }
}

function ring(g, x, y, r, hole) {
  g.moveTo(x + r, y);
  g.arc(x, y, r, 0, Math.PI * 2, !!hole);
}

// The specimen's silhouette as one path around the origin, `r` across; holes wind the other way.
function outline(g, kind, r) {
  g.beginPath();
  if (kind === 'key') {
    ring(g, 0, -r * 0.5, r * 0.42);
    ring(g, 0, -r * 0.5, r * 0.17, true);
    g.rect(-r * 0.1, -r * 0.15, r * 0.2, r * 1.1);
    g.rect(r * 0.1, r * 0.55, r * 0.33, r * 0.13);
    g.rect(r * 0.1, r * 0.8, r * 0.24, r * 0.13);
  } else if (kind === 'tube') {
    g.rect(-r * 0.2, -r * 0.95, r * 0.4, r * 1.8);
    g.rect(-r * 0.34, -r * 0.95, r * 0.68, r * 0.3);
    ring(g, 0, -r * 0.1, r * 0.09, true);
  } else if (kind === 'bell') {
    g.moveTo(-r * 0.75, r * 0.3);
    g.quadraticCurveTo(-r * 0.6, -r * 0.7, 0, -r * 0.75);
    g.quadraticCurveTo(r * 0.6, -r * 0.7, r * 0.75, r * 0.3);
    g.lineTo(r * 0.95, r * 0.5);
    g.lineTo(-r * 0.95, r * 0.5);
    g.closePath();
    g.rect(-r * 0.09, -r * 0.98, r * 0.18, r * 0.28);
  } else if (kind === 'spool') {
    g.rect(-r * 0.8, -r * 0.72, r * 1.6, r * 0.24);
    g.rect(-r * 0.8, r * 0.48, r * 1.6, r * 0.24);
    g.rect(-r * 0.36, -r * 0.5, r * 0.72, r * 1);
  } else if (kind === 'block') {
    g.rect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
    ring(g, -r * 0.5, 0, r * 0.1, true);
    ring(g, r * 0.5, 0, r * 0.1, true);
  } else {
    ring(g, 0, 0, r * 0.85);
    ring(g, 0, 0, r * 0.14, true);
  }
}

// What a material looks like in this palette; `warm` is how far it has warmed from being lied to.
function tone(c, material, warm) {
  const k = c.colors;
  const m = String(material || '');
  let base;
  if (!m) base = c.mix(k.bg2, k.muted, 0.3);
  else if (/glass/.test(m)) base = c.mix(k.accent, k.bg2, 0.25);
  else if (/brass|tin|pewter|steel|lead/.test(m)) base = c.mix(k.accent2, k.muted, 0.5);
  else if (/horn|bone|ivory/.test(m)) base = c.mix(k.fg, k.accent2, 0.4);
  else if (/cedar|oak|wood|cork/.test(m)) base = c.mix(k.bg2, k.accent2, 0.45);
  else if (/slate/.test(m)) base = c.mix(k.bg2, k.muted, 0.45);
  else base = c.mix(k.accent, k.accent2, 0.5);
  return warm ? c.mix(base, k.accent2, warm * 0.65) : base;
}

// The specimen at the origin: its glow if warmed, its body, and `n` of its scratches, clipped to it.
function specimen(g, c, kind, r, fill, scratches, n, warm) {
  const k = c.colors;
  if (warm > 0.01) {
    const glow = g.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
    glow.addColorStop(0, c.alpha(k.accent2, 0.5 * warm));
    glow.addColorStop(1, c.alpha(k.accent2, 0));
    g.fillStyle = glow;
    g.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
  }
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  outline(g, kind, r);
  g.fillStyle = fill;
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  g.strokeStyle = c.alpha(k.fg, 0.3);
  g.lineWidth = 1;
  g.stroke();
  if (n > 0 && scratches) {
    g.save();
    outline(g, kind, r);
    g.clip();
    g.strokeStyle = c.alpha(k.bg, 0.6);
    g.beginPath();
    for (let i = 0; i < n && i < scratches.length; i++) {
      const s = scratches[i];
      g.moveTo(s.x * r, s.y * r);
      g.lineTo((s.x + s.dx) * r, (s.y + s.dy) * r);
    }
    g.stroke();
    g.restore();
  }
}

// The card half: the desk, one card askew, a specimen's silhouette and its catalogue mark.
function desk(ctx, w, h, env) {
  const look = scenery(env);
  deskTop(ctx, w, h, env, look.rows);
  const cw = w * 0.72;
  const ch = Math.min(h * 0.62, cw * 0.62);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(look.tilt);
  card(ctx, env, cw, ch, 0.3, look.spots, 0, 6);
  ctx.save();
  ctx.translate(-cw * 0.32, ch * 0.12);
  specimen(ctx, env, KINDS[env.pick(OBJECTS)] || 'disc', ch * 0.17, env.alpha(env.colors.accent, 0.55), look.scratches, 5, 0);
  ctx.restore();
  write(ctx, 'APC-' + env.int(1000, 9999), -cw / 2 + 12, -ch / 2 + ch / 12, Math.max(9, ch * 0.09), env.alpha(env.colors.accent2, 0.85), 'left', 600);
  ctx.restore();
}

/* ---- piece one: accession a specimen -------------------------------------------------------- */

function accession(env) {
  const object = env.pick(OBJECTS);
  const qualifier = env.pick(QUALIFIERS);
  const options = some(env, MATERIALS, 3).map((m) => ({ label: m, value: m }));
  const count = env.int(2, 3);
  const number = catalogue(env);
  const place = env.pick(PLACES);
  const verdict = env.pick(VERDICTS);
  const look = scenery(env);
  const kind = KINDS[object] || 'disc';
  const times = count === 2 ? 'twice' : 'three times';
  const s = { material: '', wear: 0.3, lie: false, warm: 0, stamps: 0, pop: 0, file: 0, t: 0 };
  function printed() {
    return { number: s.stamps >= 1, place: s.stamps >= (count === 3 ? 2 : 1), verdict: s.stamps >= count };
  }
  function draw(c) {
    const g = c.g;
    const w = c.w;
    const h = c.h;
    const k = c.colors;
    const u = Math.min(w, h);
    const f = ease(s.file);
    deskTop(g, w, h, c, look.rows);
    drawer(g, w, h, c, Math.sin(f * Math.PI));
    // The specimen, on the left, warming if it is being lied to.
    const r = u * 0.16;
    const warm = s.warm * (1 - f);
    g.save();
    g.translate(w * 0.25 + f * w * 0.25, h * 0.44 + f * h * 0.5);
    g.rotate(look.tilt * 0.5 + (c.reduced ? 0 : Math.sin(s.t * 0.7) * 0.01) + s.pop * 0.03);
    g.scale(1 - f * 0.7, 1 - f * 0.7);
    g.globalAlpha = 1 - f;
    specimen(g, c, kind, r, tone(c, s.material, warm), look.scratches, Math.round(s.wear * look.scratches.length), warm);
    g.restore();
    // The card, on the right, printed a line at a time as the stamps land.
    const cw = w * 0.48;
    const ch = Math.min(h * 0.62, cw * 0.8);
    const m = Math.min(10, cw * 0.06);
    const fs = Math.max(9, Math.min(u * 0.034, ch / 6 * 0.62));
    const on = printed();
    const lines = [];
    const name = (s.material ? s.material + ' ' : 'a ') + object;
    wrap(g, name, fs, cw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: k.fg, weight: 600 }));
    wrap(g, qualifier, fs, cw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: c.alpha(k.fg, 0.8), weight: 500 }));
    if (on.place) wrap(g, 'came out of ' + place + '. no prior record.', fs, cw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: k.muted, weight: 500 }));
    if (on.verdict) wrap(g, 'assessment: ' + verdict, fs, cw - m * 2 - 4).forEach((l) => lines.push({ text: l, color: k.accent, weight: 700 }));
    const rows = Math.max(6, lines.length + 1);
    const rh = ch / rows;
    g.save();
    g.translate(w * 0.67 - f * w * 0.17, h * 0.45 + f * h * 0.5);
    g.rotate(look.tilt + s.pop * 0.02);
    g.scale(1 - f * 0.6, 1 - f * 0.6);
    g.globalAlpha = 1 - f;
    card(g, c, cw, ch, s.wear, look.spots, s.pop, rows);
    const size = Math.min(fs, rh * 0.62);
    if (on.number) {
      write(g, number, -cw / 2 + m + 4, -ch / 2 + rh * 0.5, size, k.accent2, 'left', 700);
      g.strokeStyle = c.alpha(k.accent2, 0.7);
      g.lineWidth = 1.5;
      g.strokeRect(-cw / 2 + m, -ch / 2 + rh * 0.12, g.measureText(number).width + 8, rh * 0.76);
    } else write(g, '— — —', -cw / 2 + m + 4, -ch / 2 + rh * 0.5, size, c.alpha(k.muted, 0.5), 'left', 500);
    lines.forEach((l, i) => write(g, l.text, -cw / 2 + m + 2, -ch / 2 + rh * (i + 1.5), size, l.color, 'left', l.weight));
    if (s.pop > 0) {
      g.fillStyle = c.alpha(k.accent2, s.pop * 0.18);
      g.fillRect(-cw / 2, -ch / 2, cw, ch);
    }
    g.restore();
    if (f > 0.5) {
      // What the desk keeps once the drawer has shut: the number, and the line about it.
      const a = clamp((f - 0.5) * 2.5);
      const big = Math.max(9, u * 0.04);
      write(g, number, w / 2, h * 0.36, big, c.alpha(k.accent2, a), 'center', 700);
      write(g, 'accessioned. the desk keeps no copy.', w / 2, h * 0.36 + big * 1.6, big * 0.8, c.alpha(k.fg, a * 0.85), 'center', 500);
    }
  }
  return {
    title: 'accession the ' + object,
    brief: 'A ' + object + ' ' + qualifier + ' is on the desk: say what it is made of and how worn it is, tell it a lie if you like, then stamp its card ' + times + ' to file it in the drawer.',
    aspect: '4 / 3',
    steps: [
      { id: 'material', ask: 'what it is made of', kind: 'choice', options },
      { id: 'wear', ask: 'how worn it is', kind: 'range', min: 0, max: 100, step: 1, value: 30, low: 'mint', high: 'ruined' },
      { id: 'lie', ask: 'tell it a lie', kind: 'toggle' },
      { id: 'stamp', ask: 'stamp the card ' + times, kind: 'press', count, label: 'stamp', after: 'material' }
    ],
    start(c) {
      c.status('specimen ' + number + ' is on the desk, as yet unnamed.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'material') {
        s.material = String(value);
        c.status('a ' + s.material + ' ' + object + ' ' + qualifier + '.');
      }
      if (id === 'wear') {
        s.wear = clamp(Number(value) / 100);
        c.status(WEAR[s.wear < 0.1 ? 0 : s.wear < 0.45 ? 1 : s.wear < 0.8 ? 2 : 3] + '.');
      }
      if (id === 'lie') {
        s.lie = !!value;
        c.status(s.lie ? 'it has warmed slightly.' : 'it has cooled. it believes you.');
      }
      if (id === 'stamp') {
        const before = printed();
        s.stamps = Math.min(count, Math.max(s.stamps + 1, Number(value) || 0));
        s.pop = 1;
        const now = printed();
        if (now.verdict && !before.verdict) c.status('assessment: ' + verdict + '.');
        else if (now.number && !before.number) c.status('numbered ' + number + (now.place ? ', out of ' + place + '. no prior record.' : '. specimen ' + number + ' is on the desk.'));
        else if (now.place && !before.place) c.status('provenance: came out of ' + place + '. no prior record.');
        else c.status('stamped again, for luck.');
      }
    },
    frame(t, dt, c) {
      s.t += dt;
      s.warm += ((s.lie ? 1 : 0) - s.warm) * Math.min(1, dt * 2);
      s.pop = Math.max(0, s.pop - dt * 3);
      if (c.done) s.file = Math.min(1, s.file + dt * (c.reduced ? 2 : 0.7));
      draw(c);
    },
    end(c) {
      c.status('accessioned ' + number + ': ' + verdict + '. filed in the drawer, which keeps no copy.');
    }
  };
}

/* ---- piece two: cross-reference the drawer -------------------------------------------------- */

function crossReference(env) {
  const n = env.int(4, 6);
  const need = env.int(2, 3);
  const links = some(env, LINKS, 3);
  const holdMs = env.pick([1200, 1600, 2000]);
  const look = scenery(env);
  const items = [];
  for (let i = 0; i < n; i++) {
    const cols = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const object = env.pick(OBJECTS);
    items.push({
      number: catalogue(env),
      name: env.pick(MATERIALS) + ' ' + object,
      kind: KINDS[object] || 'disc',
      gx: 0.1 + 0.8 * ((i % cols) + 0.5) / cols + (env.rnd() - 0.5) * 0.04,
      gy: 0.16 + 0.6 * (Math.floor(i / cols) + 0.5) / rows + (env.rnd() - 0.5) * 0.04,
      hx: 0.5 + (env.rnd() - 0.5) * 0.14,
      hy: 0.45 + (env.rnd() - 0.5) * 0.14,
      hr: (env.rnd() - 0.5) * 0.7,
      gr: (env.rnd() - 0.5) * 0.1
    });
  }
  const s = { spread: 0.5, link: links[0], picks: [], lift: 0, file: 0, t: 0 };
  function place(c, it) {
    const f = ease(s.file);
    const i = s.picks.indexOf(it);
    const gather = ease(Math.min(1, f * 2));
    const sink = ease(Math.max(0, f * 2 - 1));
    let x = (it.hx + (it.gx - it.hx) * s.spread) * c.w;
    let y = (it.hy + (it.gy - it.hy) * s.spread) * c.h;
    let rot = it.hr + (it.gr - it.hr) * s.spread;
    let a = 1;
    if (i >= 0) {
      x += (c.w * 0.5 + i * 6 - x) * gather;
      y += (c.h * 0.42 + i * 5 - y) * gather;
      rot *= 1 - gather;
      y += sink * c.h * 0.5;
      a = 1 - sink;
    } else {
      y += f * c.h;
      a = 1 - f;
    }
    return { x, y, rot, a };
  }
  function thread(g, c, a, b, style) {
    const k = c.colors;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = style === 2 ? k.muted : k.accent2;
    g.lineWidth = style === 3 ? 3 : 1.5;
    if (style === 1) g.setLineDash([8, 6]);
    if (style === 4) g.setLineDash([2, 7]);
    g.beginPath();
    if (style === 0) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      g.moveTo(a.x, a.y);
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const wob = Math.sin(t * Math.PI * 6 + s.t * 2) * 4;
        g.lineTo(a.x + dx * t - dy / len * wob, a.y + dy * t + dx / len * wob);
      }
    } else {
      g.moveTo(a.x, a.y);
      g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 18, b.x, b.y);
    }
    g.stroke();
    if (style === 2) {
      g.beginPath();
      g.moveTo(a.x, a.y + 4);
      g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 22, b.x, b.y + 4);
      g.stroke();
    }
    if (style === 5) {
      g.lineWidth = 2;
      for (const p of [a, b]) {
        g.beginPath();
        g.moveTo(p.x - 7, p.y - 5);
        g.lineTo(p.x + 7, p.y + 5);
        g.stroke();
      }
    }
    g.restore();
  }
  function draw(c) {
    const g = c.g;
    const w = c.w;
    const h = c.h;
    const k = c.colors;
    const u = Math.min(w, h);
    const f = ease(s.file);
    deskTop(g, w, h, c, look.rows);
    drawer(g, w, h, c, Math.sin(clamp((f - 0.3) / 0.7) * Math.PI));
    const cw = w * 0.22;
    const ch = cw * 0.64;
    const fs = Math.max(9, Math.min(u * 0.028, ch / 4 * 0.6));
    const order = items.filter((it) => s.picks.indexOf(it) === -1).concat(s.picks);
    const at = new Map(order.map((it) => [it, place(c, it)]));
    for (const it of order) {
      const p = at.get(it);
      const picked = s.picks.indexOf(it) !== -1;
      if (p.a <= 0.01) continue;
      g.save();
      g.globalAlpha = p.a;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      card(g, c, cw, ch, 0.2, null, picked ? s.lift : 0, 4);
      if (picked) {
        g.strokeStyle = c.alpha(k.accent2, 0.5 + s.lift * 0.4);
        g.lineWidth = 2;
        g.strokeRect(-cw / 2, -ch / 2, cw, ch);
      }
      write(g, it.number, -cw / 2 + 6, -ch / 2 + ch / 8, fs, k.accent2, 'left', 700);
      wrap(g, it.name, fs, cw - 12).slice(0, 2).forEach((l, i) => write(g, l, -cw / 2 + 6, -ch / 2 + ch * (i + 1.5) / 4, fs, k.fg, 'left', 500));
      g.save();
      g.translate(cw * 0.36, ch * 0.36);
      specimen(g, c, it.kind, ch * 0.12, c.alpha(k.accent, 0.5), null, 0, 0);
      g.restore();
      g.restore();
    }
    const style = LINKS.indexOf(s.link);
    g.globalAlpha = 1 - ease(Math.min(1, f * 2));
    for (let i = 1; i < s.picks.length; i++) thread(g, c, at.get(s.picks[i - 1]), at.get(s.picks[i]), style);
    g.globalAlpha = 1;
    if (f > 0.3) {
      // The finding, printed on the desk where the drawer was.
      const a = clamp((f - 0.3) * 2.5);
      const size = Math.max(9, u * 0.034);
      const names = s.picks.map((it) => it.number).join(' · ');
      write(g, names, w / 2, h * 0.2, size, c.alpha(k.accent2, a), 'center', 700);
      wrap(g, 'these ' + (s.picks.length === 2 ? 'two ' : 'three ') + s.link.text + '.', size, w * 0.8).forEach((l, i) => {
        write(g, l, w / 2, h * 0.2 + size * 1.5 * (i + 1), size, c.alpha(k.fg, a), 'center', 500);
      });
    }
  }
  return {
    title: need === 2 ? 'cross-reference the drawer' : 'three of a kind in the drawer',
    brief: 'The drawer holds ' + n + ' specimens with nothing in common: lay them out, choose what ties them, tap ' + (need === 2 ? 'two' : 'three') + ' of them, and hold to file them together.',
    aspect: '4 / 3',
    steps: [
      { id: 'spread', ask: 'how the drawer is laid out', kind: 'range', min: 0, max: 100, step: 1, value: 50, low: 'heaped', high: 'in rows' },
      { id: 'thread', ask: 'what ties them', kind: 'choice', options: links.map((l) => ({ label: l.label, value: LINKS.indexOf(l) })) },
      { id: 'pair', ask: 'tap ' + (need === 2 ? 'two' : 'three') + ' specimens', kind: 'tap', label: 'lift one for me', after: 'thread' },
      { id: 'file', ask: 'file them together', kind: 'hold', ms: holdMs, label: 'hold to file', after: 'pair' }
    ],
    start(c) {
      c.status('the drawer holds ' + n + '. nothing has been cross-referenced.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'spread') {
        s.spread = clamp(Number(value) / 100);
        c.status(s.spread < 0.3 ? 'heaped, as a drawer is.' : s.spread < 0.75 ? 'laid out, more or less.' : 'laid out in rows, which they resent.');
      }
      if (id === 'thread') {
        s.link = LINKS[Number(value)] || links[0];
        c.status('the claim: they ' + s.link.text + '.');
      }
      if (id === 'file') {
        s.file = Math.max(s.file, 0.001);
        c.status('filing.');
      }
    },
    tap(x, y, c) {
      if (s.picks.length >= need || s.file) return;
      let best = null;
      let bd = Infinity;
      for (const it of items) {
        if (s.picks.indexOf(it) !== -1) continue;
        const p = place(c, it);
        const d = (p.x - x * c.w) ** 2 + (p.y - y * c.h) ** 2;
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      if (!best) return;
      s.picks.push(best);
      s.lift = 1;
      c.progress('pair', s.picks.length / need);
      const names = s.picks.map((it) => it.number);
      if (s.picks.length === 1) c.status(names[0] + ' lifted. cross-referencing needs at least two specimens.');
      else if (s.picks.length < need) c.status(names.join(' against ') + '; one more.');
      else c.status(names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' ' + s.link.text + '.');
      if (s.picks.length >= need) c.satisfy('pair');
    },
    frame(t, dt, c) {
      s.t += dt;
      s.lift = Math.max(0.35, s.lift - dt * 1.5);
      if (c.done) s.file = Math.min(1, s.file + dt * (c.reduced ? 2 : 0.6));
      draw(c);
    },
    end(c) {
      const names = s.picks.map((it) => it.number);
      c.status(names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' ' + s.link.text + '. filed together; none of it exists.');
    }
  };
}

export default {
  id: 'apocrypha-desk',
  paint(ctx, w, h, env) {
    desk(ctx, w, h, env);
  },
  spark(env) {
    const number = 'APC-' + env.int(1000, 9999) + '-' + env.pick('abcdefghk'.split(''));
    return {
      overline: number,
      title: 'a ' + env.pick(MATERIALS) + ' ' + env.pick(OBJECTS) + ' ' + env.pick(QUALIFIERS),
      text: 'provenance: ' + env.pick(PROVENANCE) + '.',
      cite: 'assessment: ' + env.pick(VERDICTS) + '.'
    };
  },
  piece(env) {
    return env.chance(0.55) ? accession(env) : crossReference(env);
  }
};
