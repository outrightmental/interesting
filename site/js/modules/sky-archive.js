/* The archive oracle: a rune wheel turned by the persona's stars, and an omen. As a card it is the
   wheel with one star's rune lit (paint, spark). As a piece it is the wheel wound and let go for
   an omen, a sigil struck and quenched, or a few stars read one by one; whichever it is, the
   reading is stamped into the archive at the end. See js/feed.js for what a module is and
   js/stage.js for what a piece is. */

const RUNES = [
  ['ᚠ', 'fehu', 'what you have, and could carry'],
  ['ᚢ', 'uruz', 'a strength you did not vote for'],
  ['ᚦ', 'thurisaz', 'the thorn that stops the hand'],
  ['ᚨ', 'ansuz', 'a message, slightly garbled'],
  ['ᚱ', 'raido', 'the road, and the going'],
  ['ᚲ', 'kenaz', 'a small light, cupped'],
  ['ᚷ', 'gebo', 'a gift with no receipt'],
  ['ᚹ', 'wunjo', 'the joy that is also relief'],
  ['ᚺ', 'hagalaz', 'hail: brief, and then over'],
  ['ᚾ', 'nauthiz', 'the need that organises everything'],
  ['ᛁ', 'isa', 'ice: wait'],
  ['ᛃ', 'jera', 'the harvest, in its own time'],
  ['ᛇ', 'eihwaz', 'the yew, and the long view'],
  ['ᛈ', 'perthro', 'the cup, the dice, the not knowing'],
  ['ᛉ', 'algiz', 'the elk: guard this'],
  ['ᛊ', 'sowilo', 'the sun, undeniably'],
  ['ᛏ', 'tiwaz', 'the arrow, aimed'],
  ['ᛒ', 'berkano', 'the birch: something begins'],
  ['ᛖ', 'ehwaz', 'the horse: trust the carrier'],
  ['ᛗ', 'mannaz', 'the self, among others'],
  ['ᛚ', 'laguz', 'water finding its level'],
  ['ᛜ', 'ingwaz', 'the seed, kept'],
  ['ᛞ', 'dagaz', 'first light: the turn'],
  ['ᛟ', 'othala', 'the home ground']
];

// The other alphabets the rim can be remixed through: same sky, different glyphs, each with a
// gloss so the wheel can still be read. The runes come eight at a time from the table above.
const ALPHABETS = [
  { label: 'runes', value: 'runes' },
  { label: 'the old sky', value: 'sky', set: [
    ['☉', '', 'the sun: say it plainly'],
    ['☾', '', 'the moon: not yet'],
    ['✦', '', 'a star: keep it'],
    ['⟁', '', 'the triangle: three things; pick one'],
    ['◌', '', 'the empty ring: leave room'],
    ['◉', '', 'the eye: watched, kindly'],
    ['✶', '', 'a spark: begin before you are ready'],
    ['⟡', '', 'the lozenge: small, and whole']
  ] },
  { label: 'shapes', value: 'shapes', set: [
    ['◈', '', 'a box in a box: unpack one'],
    ['◇', '', 'the open diamond: nothing to defend'],
    ['○', '', 'the circle: round again, gently'],
    ['✧', '', 'the pale star: the quiet version wins'],
    ['✷', '', 'the burst: all at once, then rest'],
    ['⟢', '', 'the left hook: look back once'],
    ['⟣', '', 'the right hook: then go'],
    ['⬡', '', 'the hexagon: it fits beside others']
  ] },
  { label: 'planets', value: 'planets', set: [
    ['☌', 'conjunction', 'two things that are one thing'],
    ['☍', 'opposition', 'the argument is the point'],
    ['☿', 'mercury', 'the message arrives garbled, and in time'],
    ['♁', 'earth', 'here, specifically'],
    ['♄', 'saturn', 'slowly, and it will hold'],
    ['♆', 'neptune', 'the fog is not lying to you'],
    ['♇', 'pluto', 'demoted; undeterred'],
    ['✹', 'a far sun', 'warmth from a long way off']
  ] }
];

const OPENERS = ['oracle reading', 'sky archive result', 'wheel transmission', 'night relay'];
const COUNSEL = [
  'play first, polish second, publish third',
  'a small brave draft will unlock the next doorway',
  'a tiny experiment is already enough to begin',
  'your pattern favours momentum over perfection',
  'name the next step in seven words and do it',
  'let curiosity lead for ten uninterrupted minutes',
  'share one unfinished idea with someone kind',
  'keep one promise to yourself before midnight',
  'move one star and ask again'
];
const STRIKES = ['one strike, and the rings ring', 'twice; the glyphs take', 'three times; it holds its shape', 'four; it is nearly itself'];
const NUM = ['no', 'one', 'two', 'three', 'four', 'five'];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function runeFor(star) {
  return RUNES[hash(star.text + '|' + star.x + '|' + star.y) % RUNES.length];
}

// A star's place inside the wheel: its angle from the sky's centre, turned by `phase`, and its
// distance from it, so a sky keeps its shape however the wheel is turned.
function place(s, cx, cy, R, phase) {
  const a = Math.atan2(s.y - 50, s.x - 50) + phase;
  const d = Math.min(1, Math.hypot(s.x - 50, s.y - 50) / 70) * R * 0.72;
  return { a, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d };
}

// Which quarter of the archive a sky leans to once turned, and how tightly it is gathered.
function lean(stars, phase) {
  const n = stars.length || 1;
  const cos = Math.cos(phase);
  const sin = Math.sin(phase);
  const rot = stars.map((s) => ({ x: 50 + (s.x - 50) * cos - (s.y - 50) * sin, y: 50 + (s.x - 50) * sin + (s.y - 50) * cos }));
  let cx = 0;
  let cy = 0;
  rot.forEach((p) => { cx += p.x / n; cy += p.y / n; });
  let spread = 0;
  rot.forEach((p) => { spread += Math.hypot(p.x - cx, p.y - cy) / n; });
  return { zone: (cy < 50 ? 'north' : 'south') + (cx < 50 ? 'west' : 'east'), spread: spread < 12 ? 'tight' : spread < 24 ? 'balanced' : 'wide' };
}

// How many pairs of stars lie within `reach` of each other (as a fraction of the wheel's radius).
function bonds(stars, phase, reach) {
  const pts = stars.slice(0, 48).map((s) => place(s, 0, 0, 1, phase));
  let n = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) <= reach) n++;
  }
  return n;
}

function glow(g, c, x, y, r, color, a) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, c.alpha(color, a));
  grad.addColorStop(1, c.alpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// The archive's stamp: a few lines in a dark plaque that rises from the bottom edge as `a` grows.
function plaque(g, w, h, c, lines, a) {
  const m = Math.min(w, h);
  const fs = Math.max(11, Math.round(m * 0.036));
  const lh = fs * 1.5;
  const ph = lh * lines.length + fs;
  const x = m * 0.05;
  const pw = w - x * 2;
  const y = h - (ph + m * 0.04) * a;
  g.fillStyle = 'rgba(0,0,0,' + (0.55 * a).toFixed(3) + ')';
  g.beginPath();
  g.roundRect(x, y, pw, ph, fs * 0.6);
  g.fill();
  g.strokeStyle = c.alpha(c.colors.accent2, 0.5 * a);
  g.lineWidth = 1;
  g.stroke();
  lines.forEach((line, i) => {
    let size = fs;
    g.font = (i ? '400 ' : '600 ') + size + 'px system-ui, sans-serif';
    while (size > 9 && g.measureText(line).width > pw - fs) {
      size -= 1;
      g.font = (i ? '400 ' : '600 ') + size + 'px system-ui, sans-serif';
    }
    g.fillStyle = c.alpha(i === lines.length - 1 ? c.colors.muted : c.colors.fg, a);
    g.fillText(line, w / 2, y + fs * 0.5 + lh * i + lh / 2);
  });
}

/* The wheel itself. `v` is what to show: glyphs (an alphabet on the rim) or, without one, each
   star's own rune at the star's angle; angle (the rim's turn), phase (the sky's turn), lit (rim
   indices, or star indices in rune mode), reach (bonds between near stars), joined (the lit stars
   joined in order), spokes, pointer, heat (the forge's warmth), flash, dim (a lamp turned down),
   rise (lit glyphs gather at the centre), shrink (the rings tighten), plaque and plaqueA. */
function scene(g, w, h, c, v) {
  const col = c.colors;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.42 * (1 - (v.shrink || 0) * 0.1);
  const heat = v.heat || 0;
  const rise = v.rise || 0;
  const ease = rise * rise * (3 - 2 * rise);
  const lit = v.lit || [];
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
  bg.addColorStop(0, c.mix(col.bg2, col.accent2, heat * 0.12));
  bg.addColorStop(1, col.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const warm = c.mix(col.accent, col.accent2, heat);
  g.strokeStyle = c.alpha(warm, (0.4 + heat * 0.3) * (1 - ease * 0.6));
  g.lineWidth = 1 + heat;
  for (const r of [R, R * 0.78, R * 0.3]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  const stars = c.stars.slice(0, 48);
  const pts = stars.map((s) => place(s, cx, cy, R, v.phase || 0));
  // Bonds: a line between any two stars within reach, fainter the further apart they are, drawn
  // in four shades so a crowded sky costs four strokes rather than hundreds.
  if (v.reach) {
    const maxD = v.reach * R;
    const shades = [[], [], [], []];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
        if (d <= maxD) shades[Math.min(3, Math.floor((1 - d / maxD) * 4))].push(i, j);
      }
    }
    g.lineWidth = 1;
    shades.forEach((pairs, k) => {
      if (!pairs.length) return;
      g.strokeStyle = c.alpha(warm, 0.12 + k * 0.12);
      g.beginPath();
      for (let p = 0; p < pairs.length; p += 2) {
        g.moveTo(pts[pairs[p]].x, pts[pairs[p]].y);
        g.lineTo(pts[pairs[p + 1]].x, pts[pairs[p + 1]].y);
      }
      g.stroke();
    });
  }
  if (v.joined && lit.length > 1) {
    g.strokeStyle = c.alpha(col.accent2, 0.7 * (1 - ease));
    g.lineWidth = 1.2;
    g.beginPath();
    lit.forEach((i, k) => {
      if (!pts[i]) return;
      if (k) g.lineTo(pts[i].x, pts[i].y);
      else g.moveTo(pts[i].x, pts[i].y);
    });
    g.stroke();
  }
  if (v.spokes) {
    g.strokeStyle = c.alpha(col.accent, 0.2);
    g.lineWidth = 1;
    pts.forEach((p) => {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(p.a) * R * 0.78, cy + Math.sin(p.a) * R * 0.78);
      g.stroke();
    });
  }
  pts.forEach((p, i) => {
    const on = !v.glyphs && lit.indexOf(i) !== -1;
    if (on) glow(g, c, p.x, p.y, R * 0.1, col.accent2, 0.5);
    g.fillStyle = on ? col.accent2 : c.alpha(col.fg, 0.9);
    g.beginPath();
    g.arc(p.x, p.y, on ? 2.6 : 1.6, 0, Math.PI * 2);
    g.fill();
  });
  // The rim: eight glyphs of an alphabet, or each star's own rune at the star's angle.
  const size = Math.max(12, R * 0.17);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const marks = v.glyphs
    ? v.glyphs.map((e, i) => ({ ch: e[0], a: (v.angle || 0) + (i / v.glyphs.length) * Math.PI * 2, on: lit.indexOf(i) !== -1 }))
    : stars.map((s, i) => ({ ch: runeFor(s)[0], a: pts[i].a, on: lit.indexOf(i) !== -1 }));
  const row = marks.filter((m) => m.on);
  marks.forEach((m) => {
    let x = cx + Math.cos(m.a) * R * 0.89;
    let y = cy + Math.sin(m.a) * R * 0.89;
    let fs = size;
    let a = 1;
    if (ease > 0 && m.on) {
      const k = row.indexOf(m);
      x += (cx + (k - (row.length - 1) / 2) * size * 2.4 - x) * ease;
      y += (cy - y) * ease;
      fs = size * (1 + ease * 1.2);
    } else if (ease > 0) a = 1 - ease * 0.8;
    if (m.on) glow(g, c, x, y, fs * 1.3, col.accent2, 0.6 * a);
    g.font = '600 ' + Math.round(fs) + 'px system-ui, sans-serif';
    g.fillStyle = m.on ? c.alpha(col.accent2, a) : c.alpha(c.mix(col.fg, col.accent2, heat), 0.8 * a);
    g.fillText(m.ch, x, y);
  });
  if (v.pointer) {
    g.fillStyle = c.alpha(col.accent2, 0.95);
    g.beginPath();
    g.moveTo(cx, cy - R - R * 0.15);
    g.lineTo(cx - R * 0.05, cy - R - R * 0.03);
    g.lineTo(cx + R * 0.05, cy - R - R * 0.03);
    g.closePath();
    g.fill();
  }
  if (v.flash) {
    g.fillStyle = c.alpha(col.accent2, v.flash * 0.22);
    g.fillRect(0, 0, w, h);
  }
  if (v.dim) {
    g.fillStyle = 'rgba(0,0,0,' + v.dim.toFixed(3) + ')';
    g.fillRect(0, 0, w, h);
  }
  if (v.plaque && v.plaqueA > 0) plaque(g, w, h, c, v.plaque, v.plaqueA);
  g.textAlign = 'start';
  g.textBaseline = 'alphabetic';
}

// The card's wheel: every star's rune on the rim, the stars inside, and one rune lit.
function wheel(ctx, w, h, env, lit) {
  const on = [];
  if (lit) env.stars.forEach((s, i) => { if (runeFor(s)[1] === lit[1]) on.push(i); });
  scene(ctx, w, h, env, { spokes: true, lit: on });
}

// Three of the four alphabets, in an order of their own, with eight runes drawn for the rune set.
function alphabets(env) {
  const pool = ALPHABETS.slice();
  const chosen = [];
  while (chosen.length < 3) chosen.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  const sets = {};
  chosen.forEach((a) => {
    if (a.set) sets[a.value] = a.set;
    else {
      const runes = RUNES.slice();
      sets[a.value] = [];
      while (sets[a.value].length < 8) sets[a.value].push(runes.splice(env.int(0, runes.length - 1), 1)[0]);
    }
  });
  return { options: chosen.map((a) => ({ label: a.label, value: a.value })), sets };
}

// The wheel wound and let go; the glyph it rests under is the omen.
function spin(env) {
  const { options, sets } = alphabets(env);
  const holdMs = env.pick([900, 1300, 1800]);
  const turn0 = env.int(0, 71) * 5;
  const opener = env.pick(OPENERS);
  const counsel = env.pick(COUNSEL);
  const title = env.pick(['spin for an omen', 'one spin, one omen', 'wind the wheel and ask']);
  const n = 8;
  const s = { glyphs: sets[options[0].value], angle: -Math.PI / 2, omega: 0, omega0: 1, phase: turn0 * Math.PI / 180, spun: false, rested: false, read: 0, flash: 0, rise: 0, plaque: null };
  function underPointer() {
    const step = Math.PI * 2 / n;
    return ((Math.round((-Math.PI / 2 - s.angle) / step) % n) + n) % n;
  }
  function omen(full) {
    const e = s.glyphs[s.read];
    const head = opener + ': ' + e[0] + (e[1] ? ' ' + e[1] : '');
    return full ? head + ' — ' + e[2] : head;
  }
  function view() {
    return { glyphs: s.glyphs, angle: s.angle, phase: s.phase, pointer: true, lit: s.rested ? [s.read] : [], flash: s.flash, rise: s.rise, plaque: s.plaque, plaqueA: s.rise };
  }
  return {
    title,
    brief: 'Pick the alphabet on the rim, turn the sky beneath it, then wind the wheel and let it go: the glyph it rests under is the omen, and the omen is stamped into the archive.',
    aspect: '1 / 1',
    steps: [
      { id: 'alphabet', ask: 'the alphabet on the rim', kind: 'choice', options },
      { id: 'turn', ask: 'turn the sky under the wheel', kind: 'range', min: 0, max: 355, step: 5, value: turn0, low: 'as it lies', high: 'nearly round' },
      { id: 'wind', ask: 'wind the wheel, then let go', kind: 'hold', ms: holdMs, label: 'hold to wind' },
      { id: 'rest', ask: 'let it come to rest', kind: 'wait', after: 'wind' }
    ],
    start(c) {
      scene(c.g, c.w, c.h, c, view());
    },
    apply(id, value, c) {
      if (id === 'alphabet') {
        s.glyphs = sets[value] || s.glyphs;
        c.status(s.rested ? omen(true) : 'same sky, different alphabet');
      }
      if (id === 'turn') {
        s.phase = (Number(value) || 0) * Math.PI / 180;
        const l = lean(c.stars, s.phase);
        c.status('a ' + l.spread + ' spread, leaning to the ' + l.zone + ' archive');
      }
      if (id === 'wind') {
        s.omega0 = s.omega = 6 + Math.min(4000, Number(value) || 0) / 4000 * 10;
        s.spun = true;
        s.rested = false;
        s.flash = 1;
        c.status('the wheel is spinning; the archive is listening');
      }
    },
    frame(t, dt, c) {
      if (s.omega > 0) {
        s.angle += s.omega * dt;
        s.omega *= Math.exp(-(c.reduced ? 3 : 1.2) * dt);
        if (s.omega < 0.25) {
          s.omega = 0;
          s.rested = true;
          s.read = underPointer();
          c.progress('rest', 1);
          c.status(omen(true));
          c.satisfy('rest');
        } else c.progress('rest', Math.max(0, Math.min(1, 1 - Math.log(s.omega / 0.25) / Math.log(s.omega0 / 0.25))));
      } else if (s.rested) {
        // Settle, so the read glyph sits square under the pointer.
        const target = -Math.PI / 2 - s.read * Math.PI * 2 / n;
        const d = ((target - s.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        s.angle += d * Math.min(1, dt * 4);
      } else if (!c.reduced) s.angle += dt * 0.2;
      s.flash = Math.max(0, s.flash - dt * 1.4);
      if (c.done) s.rise = Math.min(1, s.rise + dt * 1.5);
      scene(c.g, c.w, c.h, c, view());
    },
    end(c) {
      const l = lean(c.stars, s.phase);
      s.plaque = [omen(false), s.glyphs[s.read][2], counsel, c.stars.length + ' stars · ' + l.spread + ' spread · the ' + l.zone + ' archive'];
      c.status('omen archived; move a star and ask again');
    }
  };
}

// A sigil struck from the sky: each strike heats the wheel and lights more of the rim; quenched,
// it cools and holds.
function forge(env) {
  const { options, sets } = alphabets(env);
  const strikes = env.int(3, 5);
  const quenchMs = env.pick([1000, 1500]);
  const reach0 = env.pick([24, 34, 44]);
  const title = env.pick(['forge a sigil', 'strike a sigil from the sky', 'a sigil, struck and quenched']);
  const s = { glyphs: sets[options[0].value], set: options[0].label, angle: -Math.PI / 2, kick: 0, phase: 0, reach: reach0 / 100, struck: 0, heat: 0, flash: 0, quenched: false, cool: 0, shrink: 0, bonds: 0, plaque: null };
  function count(c) {
    return (s.bonds = bonds(c.stars, s.phase, s.reach));
  }
  function view(c) {
    const lit = [];
    const on = c.done ? 8 : Math.round(s.struck / strikes * 8);
    for (let i = 0; i < on; i++) lit.push(i);
    return { glyphs: s.glyphs, angle: s.angle, phase: s.phase, reach: s.reach, heat: s.heat * (1 - s.cool), flash: s.flash, shrink: s.shrink, lit, plaque: s.plaque, plaqueA: s.shrink };
  }
  return {
    title,
    brief: 'Pick the alphabet, set how far the stars reach for each other, strike the sigil ' + NUM[strikes] + ' times and quench it; it cools, and the archive keeps it.',
    aspect: '1 / 1',
    steps: [
      { id: 'alphabet', ask: 'the alphabet on the rim', kind: 'choice', options },
      { id: 'reach', ask: 'how far a star reaches', kind: 'range', min: 0, max: 70, step: 2, value: reach0, low: 'close kin', high: 'anyone' },
      { id: 'strike', ask: 'strike it ' + NUM[strikes] + ' times', kind: 'press', count: strikes, label: 'strike' },
      { id: 'quench', ask: 'quench it', kind: 'hold', ms: quenchMs, label: 'hold to quench', after: 'strike' }
    ],
    start(c) {
      count(c);
      scene(c.g, c.w, c.h, c, view(c));
    },
    apply(id, value, c) {
      if (id === 'alphabet') {
        s.glyphs = sets[value] || s.glyphs;
        s.set = (options.find((o) => o.value === value) || options[0]).label;
        c.status('same sky, different alphabet');
      }
      if (id === 'reach') {
        s.reach = Math.max(0, Number(value) || 0) / 100;
        const b = count(c);
        c.status(b ? b + (b === 1 ? ' bond' : ' bonds') + ' among ' + c.stars.length + ' stars' : 'no bonds; every star for itself');
      }
      if (id === 'strike') {
        s.struck = Number(value) || 0;
        s.heat = Math.min(1, s.heat + 0.35);
        s.flash = 1;
        s.kick += 3;
        s.phase += 0.15;
        count(c);
        c.status(s.struck >= strikes ? 'struck ' + NUM[strikes] + ' times and glowing; quench it' : STRIKES[s.struck - 1] || 'struck again');
      }
      if (id === 'quench') {
        s.quenched = true;
        c.status('it hisses, and holds');
      }
    },
    frame(t, dt, c) {
      s.angle += s.kick * dt;
      s.kick *= Math.exp(-3 * dt);
      if (s.quenched) s.cool = Math.min(1, s.cool + dt * 1.2);
      else s.heat = Math.max(0, s.heat - dt * 0.03);
      s.flash = Math.max(0, s.flash - dt * 1.6);
      if (c.done) s.shrink = Math.min(1, s.shrink + dt * 1.5);
      scene(c.g, c.w, c.h, c, view(c));
    },
    end(c) {
      s.plaque = ['sigil forged', s.glyphs.map((e) => e[0]).join('  '), c.stars.length + ' stars · ' + s.bonds + (s.bonds === 1 ? ' bond · ' : ' bonds · ') + s.set];
      c.status('sigil forged: ' + c.stars.length + ' stars encoded, ' + s.bonds + (s.bonds === 1 ? ' bond' : ' bonds'));
    }
  };
}

// A few stars read one by one: each tapped star gives up its rune, and the reading is stamped.
function read(env) {
  const n = env.stars.length;
  const need = Math.min(n, env.int(2, 4));
  const lamp0 = env.pick([45, 60, 75]);
  const s = { drawn: [], dim: (1 - lamp0 / 100) * 0.75, joined: false, phase: 0, flash: 0, rise: 0, plaque: null };
  function view() {
    return { lit: s.drawn, joined: s.joined, phase: s.phase, dim: s.dim * (1 - s.rise), flash: s.flash, rise: s.rise, plaque: s.plaque, plaqueA: s.rise };
  }
  return {
    title: need === 1 ? 'read the one star' : 'read ' + NUM[need] + ' stars',
    brief: 'Tap ' + NUM[need] + ' stars and each gives up its rune; set the lamp, join them if you like, and stamp the reading into the archive.',
    aspect: '1 / 1',
    steps: [
      { id: 'draw', ask: 'tap ' + NUM[need] + (need === 1 ? ' star' : ' stars'), kind: 'tap', label: 'draw one for me' },
      { id: 'lamp', ask: 'the lamp over the archive', kind: 'range', min: 5, max: 100, step: 1, value: lamp0, low: 'low', high: 'bright' },
      { id: 'join', ask: 'join the drawn stars', kind: 'toggle' },
      { id: 'stamp', ask: 'stamp the reading', kind: 'press', count: 1, label: 'stamp it', after: 'draw' }
    ],
    start(c) {
      scene(c.g, c.w, c.h, c, view());
    },
    apply(id, value, c) {
      if (id === 'lamp') {
        const v = Number(value) || 0;
        s.dim = (1 - v / 100) * 0.75;
        c.status(v < 35 ? 'the lamp is low; the runes keep their secrets' : v < 70 ? 'the lamp is half up' : 'the lamp is bright; nothing on the wheel hides');
      }
      if (id === 'join') {
        s.joined = !!value;
        c.status(s.joined ? (s.drawn.length > 1 ? 'the drawn stars are joined' : 'joined, once there are two') : 'each star on its own');
      }
      if (id === 'stamp') c.status('stamped');
    },
    tap(x, y, c) {
      if (s.drawn.length >= need) return;
      const cx = c.w / 2;
      const cy = c.h / 2;
      const R = Math.min(c.w, c.h) * 0.42;
      const px = x * c.w;
      const py = y * c.h;
      let best = -1;
      let bd = Infinity;
      c.stars.slice(0, 48).forEach((st, i) => {
        if (s.drawn.indexOf(i) !== -1) return;
        const p = place(st, cx, cy, R, s.phase);
        const d = Math.min(Math.hypot(px - p.x, py - p.y), Math.hypot(px - cx - Math.cos(p.a) * R * 0.89, py - cy - Math.sin(p.a) * R * 0.89));
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0) return;
      s.drawn.push(best);
      s.flash = 0.6;
      const r = runeFor(c.stars[best]);
      c.progress('draw', s.drawn.length / need);
      c.status(r[0] + ' ' + r[1] + ' — ' + r[2] + ', from the star that said "' + c.stars[best].text + '"');
      if (s.drawn.length >= need) c.satisfy('draw');
    },
    frame(t, dt, c) {
      if (!c.reduced) s.phase += dt * 0.04;
      s.flash = Math.max(0, s.flash - dt * 1.6);
      if (c.done) s.rise = Math.min(1, s.rise + dt * 1.5);
      scene(c.g, c.w, c.h, c, view());
    },
    end(c) {
      const runes = s.drawn.map((i) => runeFor(c.stars[i]));
      s.plaque = ['archived: ' + runes.map((r) => r[0]).join('  '), runes.map((r) => r[1]).join(' · '), NUM[need] + ' of ' + n + (n === 1 ? ' star read' : ' stars read')];
      c.status('the reading is archived: ' + runes.map((r) => r[1]).join(', '));
    }
  };
}

export default {
  id: 'sky-archive',
  needsSky: true,
  paint(ctx, w, h, env) {
    wheel(ctx, w, h, env, null);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    const rune = runeFor(star);
    return {
      title: 'omen',
      quote: rune[0] + ' ' + rune[1] + ' — ' + rune[2],
      text: 'Drawn from the star that said "' + star.text + '". Spin the wheel on its page for the next.',
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => wheel(ctx, w, h, e, rune)
    };
  },
  piece(env) {
    if (!env.stars.length) return null;
    const roll = env.rnd();
    return roll < 0.4 ? spin(env) : roll < 0.72 ? forge(env) : read(env);
  }
};
