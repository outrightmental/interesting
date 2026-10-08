/* The terrarium: the persona's stars grown into plants under glass. As a card it is the glasshouse
   and a greenhouse forecast (paint, spark); as a piece it is a watering round, a forecast read off
   the glass, or the whole bed regrown. See js/feed.js for what a module is and js/stage.js for
   what a piece is.

   A card and the feature it opens as are one glasshouse: the spark puts the forecast it printed on
   its spec as `of` -- its heading, its humidity, its light and its wind -- and the piece opens the
   glass at exactly that reading, under the heading the card was wearing. */

// The card this piece was opened from, in the glasshouse's own terms: the forecast it printed, or
// null for a piece nobody pressed (js/stage.js hands it over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  if (!was) return null;
  const humidity = Number(was.humidity);
  const light = LIGHT.indexOf(was.light);
  return {
    opener: typeof was.opener === 'string' ? was.opener : '',
    humidity: isFinite(humidity) ? Math.max(55, Math.min(96, Math.round(humidity))) : 0,
    light: light >= 0 ? light : -1,
    wind: WIND.indexOf(was.wind)
  };
}

// The light a card was printed under, offered first: the glass opens at the reading the card gave.
function lightsFrom(env, was, count) {
  const out = pickLights(env, count);
  if (!was || was.light < 0) return out;
  const at = out.findIndex((o) => o.value === was.light);
  if (at >= 0) out.unshift(out.splice(at, 1)[0]);
  else out.unshift({ label: LIGHT[was.light], value: was.light });
  return out.slice(0, Math.max(count, 3));
}

const LIGHT = ['low and green', 'bright through the glass', 'dappled', 'thin, from the north'];
const WIND = ['none; the glass is shut', 'a draught from the vent', 'the fan, on low'];
const OPENERS = ['greenhouse bulletin', 'soil telemetry', 'midnight horticulture note', 'terrarium weather report'];
const MIDS = ['Roots prefer tiny momentum over perfect timing.', 'The next bloom appears after one brave unfinished step.',
  'Your best growth pattern is playful, then precise.', 'A gentle routine will outgrow a dramatic sprint.'];
const CLOSERS = ['Water one small idea before sleep.', 'Prune one distraction, keep one promise.',
  'Share a rough sprout instead of waiting for a tree.', 'Move one star, then regrow this garden.'];
const ORDERS = [{ label: 'left to right', value: 'x' }, { label: 'shortest first', value: 'short' }, { label: 'tallest first', value: 'tall' }];
const SPREADS = [{ label: 'compact', value: 'compact' }, { label: 'balanced', value: 'balanced' }, { label: 'wild', value: 'wild' }];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const TAU = Math.PI * 2;

// A plant's geometry has a small generator of its own, from the star it grows from and a salt,
// so a stem looks the same every frame and a card needs no shared sequence to draw it.
function sprout(star, i, salt) {
  let s = (Math.round(star.x * 1000) ^ (Math.round(star.y * 1000) << 3) ^ Math.imul(i + 1, 2654435761) ^ Math.imul(salt, 40503)) >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { seg: 5 + Math.floor(rnd() * 5), bend: 0.35 + rnd() * 0.95, sway: 0.3 + rnd() * 1.2, phase: rnd() * TAU,
    thick: 1.1 + rnd() * 1.7, leaf: 2.4 + rnd() * 2.1, every: 2 + Math.floor(rnd() * 2),
    grow: 1, delay: 0, glow: 0, pulse: 0, wet: false, bloom: 0, bud: 0 };
}

function fresh(stars, salt) {
  return { t: 0, light: -1, wind: 0.4, fog: 0, moss: false, flash: 0, stamp: 0, stampText: '', needle: 0, gauge: false,
    drops: [], lines: [], tips: [], plants: stars.map((star, i) => sprout(star, i, salt)) };
}

function reading(stars) {
  const n = stars.length || 1;
  let cx = 0;
  let cy = 0;
  let spread = 0;
  for (const s of stars) {
    cx += s.x / n;
    cy += s.y / n;
  }
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy) / n;
  return {
    zone: (cy < 50 ? 'north' : 'south') + '-' + (cx < 50 ? 'west' : 'east'),
    spread: spread < 12 ? 'compact' : spread < 24 ? 'balanced' : 'wild',
    density: stars.length < 5 ? 'quiet' : stars.length < 14 ? 'steady' : 'lush'
  };
}

function tallest(stars) {
  let t = stars[0];
  for (const s of stars) if (s.y < t.y) t = s;
  return t;
}

function pickLights(env, count) {
  const pool = LIGHT.map((label, value) => ({ label, value }));
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

/* ---- drawing ------------------------------------------------------------------------------- */

// The air in the glasshouse: its gradient by the light chosen, a shaft when it is bright,
// drifting dapples when it is dappled, and a green cast in moss mode.
function air(g, w, h, c, s) {
  const col = c.colors;
  const top = s.light === 1 ? c.mix(col.bg2, col.fg, 0.2) : s.light === 3 ? c.mix(col.bg2, col.accent, 0.15) : col.bg2;
  const base = c.mix(col.bg, col.accent, (s.moss ? 0.12 : 0) + (s.light === 0 ? 0.07 : 0));
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  if (s.light === 3) grad.addColorStop(0.3, base);
  grad.addColorStop(1, base);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (s.light === 1) {
    const shaft = g.createLinearGradient(w, 0, w * 0.3, h);
    shaft.addColorStop(0, c.alpha(col.fg, 0.14));
    shaft.addColorStop(1, c.alpha(col.fg, 0));
    g.fillStyle = shaft;
    g.fillRect(0, 0, w, h);
  }
  if (s.light === 2) {
    const drift = c.reduced ? 0 : s.t;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 0.618 + 0.1 + Math.sin(drift * 0.3 + i) * 0.04) % 1) * w;
      const y = ((i * 0.38 + 0.05 + Math.cos(drift * 0.25 + i * 1.7) * 0.03) % 1) * h * 0.8;
      const r = Math.min(w, h) * (0.08 + (i % 3) * 0.04);
      const d = g.createRadialGradient(x, y, 0, x, y, r);
      d.addColorStop(0, c.alpha(col.accent2, 0.11));
      d.addColorStop(1, c.alpha(col.accent2, 0));
      g.fillStyle = d;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // The soil: a black veil over the bed, with grit.
  const soilY = h * 0.82;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, soilY, w, h - soilY);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = c.alpha(col.accent2, 0.1 + ((i * 7) % 5) * 0.03);
    g.fillRect(((i * 0.618034) % 1) * w, soilY + ((i * 0.754877) % 1) * (h - soilY), 1.5, 1.5);
  }
}

// One stem, from the soil to its tip, leaning on the wind. Returns where its tip is.
function stem(g, c, s, p, i, x, soilY, full, breeze, k) {
  const col = c.colors;
  const height = full * p.grow * (1 + (p.wet ? 0.1 : 0));
  if (height < 1) return [x, soilY];
  const tint = s.moss ? c.mix(col.accent, col.accent2, 0.5 + 0.5 * Math.sin(s.t * 2 + i * 1.3)) : col.accent;
  const pts = [];
  for (let j = 0; j <= p.seg; j++) {
    const r = j / p.seg;
    const sway = Math.sin(s.t * (0.8 + p.sway) + p.phase + r * 2.4) * p.bend * breeze * r * 22 * k
      + Math.sin(s.t * 12 + i) * p.pulse * 2.5 * r * k;
    pts.push([x + sway, soilY - r * height]);
  }
  g.strokeStyle = c.alpha(tint, Math.min(1, 0.55 + p.glow * 0.35 + (p.wet ? 0.1 : 0)));
  g.lineWidth = (p.thick + p.pulse * 0.8) * k;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  g.stroke();
  for (let j = 1; j < pts.length - 1; j++) {
    if (j % p.every) continue;
    const dir = j % 2 ? -1 : 1;
    const lw = p.leaf * k * (1 + p.pulse * 0.4) * (0.5 + 0.5 * p.grow);
    g.fillStyle = c.alpha(tint, 0.35 + p.glow * 0.35);
    g.beginPath();
    g.ellipse(pts[j][0] + dir * lw, pts[j][1], lw * 1.6, lw * 0.7, dir * 0.6 + Math.sin(s.t * 1.2 + j) * 0.14, 0, TAU);
    g.fill();
  }
  const tip = pts[pts.length - 1];
  const halo = (3.6 + p.pulse * 7.5 + p.bloom * 6) * k;
  g.fillStyle = c.alpha(col.accent2, 0.18 + p.glow * 0.3 + p.bloom * 0.15);
  g.beginPath();
  g.arc(tip[0], tip[1], halo, 0, TAU);
  g.fill();
  if (p.bloom > 0.02) {
    const br = 4.5 * k * p.bloom;
    g.fillStyle = c.alpha(col.accent2, 0.85 * p.bloom);
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU + s.t * 0.3;
      g.beginPath();
      g.ellipse(tip[0] + Math.cos(a) * br, tip[1] + Math.sin(a) * br, br, br * 0.55, a, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = c.alpha(p.pulse > 0.2 ? col.accent2 : col.fg, 0.95);
  g.beginPath();
  g.arc(tip[0], tip[1], (1.6 + p.pulse * 1.1 + p.bloom * 1.5) * k, 0, TAU);
  g.fill();
  return tip;
}

// The glass itself: fog and its drips, the frame and glazing bars, a shine, and any flash.
function pane(g, w, h, c, s) {
  const col = c.colors;
  if (s.fog > 0) {
    const f = g.createLinearGradient(0, 0, 0, h);
    f.addColorStop(0, c.alpha(col.fg, 0.24 * s.fog));
    f.addColorStop(0.6, c.alpha(col.fg, 0.08 * s.fog));
    f.addColorStop(1, c.alpha(col.fg, 0.03 * s.fog));
    g.fillStyle = f;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = c.alpha(col.fg, 0.35 * s.fog);
    g.lineWidth = 1.2;
    const n = Math.round(s.fog * 9);
    for (let i = 0; i < n; i++) {
      const x = ((i * 0.618034 + 0.07) % 1) * w;
      const y = ((s.t * (0.03 + (i % 3) * 0.02) + i * 0.37) % 1) * h * 0.7;
      g.beginPath();
      g.moveTo(x, Math.max(0, y - 18 * s.fog));
      g.lineTo(x, y);
      g.stroke();
    }
  }
  g.strokeStyle = c.alpha(col.fg, 0.35);
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  g.lineWidth = 1;
  g.beginPath();
  for (let x = w / 3; x < w - 1; x += w / 3) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  g.moveTo(0, h * 0.3);
  g.lineTo(w, h * 0.3);
  g.stroke();
  const shine = g.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, c.alpha(col.fg, 0.08));
  shine.addColorStop(0.5, c.alpha(col.fg, 0));
  g.fillStyle = shine;
  g.fillRect(0, 0, w, h);
  if (s.flash > 0) {
    g.fillStyle = c.alpha(col.accent2, s.flash * 0.18);
    g.fillRect(0, 0, w, h);
  }
}

function wrap(g, text, max) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && g.measureText(test).width > max) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// A label taped to the glass, for the forecast as it is read.
function label(g, w, h, c, lines) {
  if (!lines.length) return;
  const size = Math.max(11, Math.round(Math.min(w, h) * 0.042));
  const pad = size * 0.8;
  const lh = size * 1.3;
  const bw = w * 0.64;
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  const rows = [];
  lines.forEach((l, i) => wrap(g, l, bw - pad * 2).forEach((r) => rows.push([r, i === 0])));
  g.fillStyle = c.alpha(c.colors.bg, 0.62);
  g.beginPath();
  g.roundRect(pad, pad, bw, rows.length * lh + pad * 2, size * 0.4);
  g.fill();
  g.strokeStyle = c.alpha(c.colors.fg, 0.2);
  g.lineWidth = 1;
  g.stroke();
  rows.forEach((r, i) => {
    g.fillStyle = r[1] ? c.colors.accent2 : c.alpha(c.colors.fg, 0.85);
    g.fillText(r[0], pad * 2, pad * 2 + i * lh);
  });
}

// A hygrometer in the corner: its needle sits where the humidity is, and jumps at a reading.
function gauge(g, w, h, c, s) {
  const r = Math.min(w, h) * 0.08;
  const x = w - r * 1.7;
  const y = r * 1.7;
  g.strokeStyle = c.alpha(c.colors.fg, 0.4);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(x, y, r, Math.PI * 0.75, Math.PI * 2.25);
  g.stroke();
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI * (0.75 + 1.5 * (i / 4));
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.stroke();
  }
  const a = Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, s.needle)));
  g.strokeStyle = c.colors.accent2;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
  g.stroke();
  g.fillStyle = c.colors.accent2;
  g.beginPath();
  g.arc(x, y, 2.5, 0, TAU);
  g.fill();
}

// The stamp a finished forecast gets, pressed on at an angle.
function stampAt(g, w, h, c, text, k) {
  const r = Math.min(w, h) * 0.14 * (1.5 - 0.5 * k);
  g.save();
  g.translate(w * 0.8, h * 0.56);
  g.rotate(-0.25);
  g.strokeStyle = c.alpha(c.colors.accent2, 0.85 * k);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.stroke();
  g.lineWidth = 1;
  g.beginPath();
  g.arc(0, 0, r * 0.84, 0, TAU);
  g.stroke();
  g.fillStyle = c.alpha(c.colors.accent2, 0.9 * k);
  g.font = '700 ' + Math.max(10, Math.round(r * 0.36)) + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 0);
  g.restore();
}

function scene(g, w, h, c, s) {
  const soilY = h * 0.82;
  const k = Math.max(0.7, Math.min(2, Math.min(w, h) / 340));
  const breeze = s.wind * (0.6 + Math.sin(s.t * 0.6) * 0.3) * (c.reduced ? 0.3 : 1);
  air(g, w, h, c, s);
  s.tips = c.stars.map((star, i) => {
    const p = s.plants[i] || (s.plants[i] = sprout(star, i, 0));
    return stem(g, c, s, p, i, 14 + (star.x / 100) * (w - 28), soilY, ((100 - star.y) / 100) * (soilY - 16) * 0.85 + 10, breeze, k);
  });
  g.fillStyle = c.alpha(c.colors.fg, 0.85);
  for (const d of s.drops) {
    g.beginPath();
    g.ellipse(d.x, d.y, 2 * k, 3.2 * k, 0, 0, TAU);
    g.fill();
  }
  pane(g, w, h, c, s);
  label(g, w, h, c, s.lines);
  if (s.gauge) gauge(g, w, h, c, s);
  if (s.stamp > 0) stampAt(g, w, h, c, s.stampText, s.stamp);
}

// What moves between frames: the wind's clock, the flash, each stem's growth, glow and bloom, and
// the drops on their way down.
function tick(s, dt) {
  s.t += dt;
  s.flash = Math.max(0, s.flash - dt * 1.7);
  for (const p of s.plants) {
    p.pulse = Math.max(0, p.pulse - dt * 1.6);
    p.glow = Math.max(0, p.glow - dt * 0.9);
    if (p.delay > 0) p.delay -= dt;
    else p.grow = Math.min(1, p.grow + dt / 1.6);
    p.bloom += (p.bud - p.bloom) * Math.min(1, dt * 2);
  }
  s.drops = s.drops.filter((d) => {
    d.y += dt * d.speed;
    if (d.y < d.ty) return true;
    const p = s.plants[d.i];
    p.pulse = 1;
    p.glow = 1;
    return false;
  });
}

// The card: the terrarium as it stands, in the light and on the vent the configuration the card was
// dealt chose, with as much fog on the glass as it asks for -- so a repeat is the same stems under
// different weather.
function glasshouse(ctx, w, h, env, t) {
  const v = env.variant;
  const s = fresh(env.stars, 7);
  s.t = t + v.turn * 6;
  s.wind = 0.15 + v.turn * 0.55;
  s.light = Math.round(v.turn * 3);
  s.fog = Math.max(0, (v.density - 1) * 0.55);
  for (const p of s.plants) p.grow = v.scale;
  scene(ctx, w, h, env, s);
}

/* ---- the pieces ---------------------------------------------------------------------------- */

// A watering round: light and vent set, a few stems tapped and heard, and the glass misted shut.
function watering(env) {
  const was = pressed(env);
  const n = env.stars.length;
  const need = Math.min(n, env.int(3, 5));
  const lights = lightsFrom(env, was, 3);
  const ms = env.pick([1500, 2000, 2500]);
  const vent0 = was && was.wind >= 0 ? [10, 45, 80][was.wind] : env.pick([20, 35, 50]);
  const s = fresh(env.stars, env.int(1, 9999));
  s.wind = vent0 / 100;
  let misted = false;
  const wet = () => s.plants.filter((p) => p.wet).length;
  const one = need === 1;
  const drink = (k) => (WORDS[k] || k) + (k === 1 ? ' stem drinks' : ' stems drink');
  return {
    title: one ? 'water the one stem' : need === n ? 'water every stem' : 'water ' + WORDS[need] + ' stems',
    brief: 'Set the light and the vent, tap ' + (one ? 'the one stem to water it and hear what it remembers' : (need === n ? 'each stem' : WORDS[need] + ' stems') + ' to water them and hear what they remember')
      + ', then hold to mist the glass; the terrarium fogs over and ' + (n === 1 ? 'the stem drinks.' : 'the stems drink.')
      + (was && was.opener ? ' The glass is set as your ' + was.opener + ' left it.' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'light', ask: 'the light', kind: 'choice', options: lights },
      { id: 'vent', ask: 'the vent', kind: 'range', min: 0, max: 100, step: 1, value: vent0, low: 'shut', high: 'fan on low' },
      { id: 'water', ask: one ? 'tap the stem to water it' : 'tap ' + WORDS[need] + ' stems to water them', kind: 'tap', label: 'water one for me' },
      { id: 'mist', ask: 'mist the glass', kind: 'hold', ms, label: 'hold to mist', after: 'water' }
    ],
    start(c) {
      scene(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'light') {
        s.light = Number(value) || 0;
        c.status('light: ' + LIGHT[s.light]);
      }
      if (id === 'vent') {
        s.wind = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(s.wind < 0.1 ? 'wind: ' + WIND[0] + '. the terrarium holds its breath' : s.wind < 0.6 ? 'wind: ' + WIND[1] : 'wind: ' + WIND[2] + '. the stems sway again');
      }
      if (id === 'mist') {
        misted = true;
        s.flash = 1;
        c.status('misted: the glass fogs over and the drips start');
      }
    },
    tap(x, y, c) {
      if (c.done) return;
      const px = x * c.w;
      const py = y * c.h;
      let best = -1;
      let bd = Infinity;
      c.stars.forEach((star, i) => {
        if (s.plants[i].wet) return;
        const tip = s.tips[i] || [14 + (star.x / 100) * (c.w - 28), c.h * 0.5];
        const d = (tip[0] - px) ** 2 + ((tip[1] - py) * 0.4) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0) return;
      const tip = s.tips[best] || [px, py];
      s.plants[best].wet = true;
      s.drops.push({ x: tip[0], y: 0, ty: tip[1], i: best, speed: c.h * 1.8 });
      c.progress('water', Math.min(1, wet() / need));
      const memory = c.stars[best].text || 'a stem with nothing to say yet';
      s.lines = ['leaf memory', memory];
      c.status('leaf memory: ' + memory);
      if (wet() >= need) c.satisfy('water');
    },
    frame(t, dt, c) {
      tick(s, dt);
      if (misted) s.fog = Math.min(1, s.fog + dt * 0.8);
      if (c.done) for (const p of s.plants) if (p.wet) p.bud = 1;
      scene(c.g, c.w, c.h, c, s);
    },
    end(c) {
      c.status('misted and shut: ' + drink(wet()) + ', and the glass holds its breath');
    }
  };
}

// A forecast: humidity, light and wind set, three readings taken off the glass, and a stamp.
function forecast(env) {
  const was = pressed(env);
  const n = env.stars.length;
  // The heading the card was printed under is this forecast's own: a visitor who pressed a
  // greenhouse bulletin opens the bulletin, at the humidity and the light it was read at.
  const opener = was && was.opener ? was.opener : env.pick(OPENERS);
  const mid = env.pick(MIDS);
  const closer = env.pick(CLOSERS);
  const lights = lightsFrom(env, was, 3);
  const hum0 = was && was.humidity ? Math.max(58, Math.min(92, was.humidity)) : env.int(58, 92);
  const r = reading(env.stars);
  const s = fresh(env.stars, env.int(1, 9999));
  s.gauge = true;
  s.stampText = r.spread;
  const stats = n + ' plant' + (n === 1 ? '' : 's') + ', bed ' + r.zone + ', canopy ' + r.density + '.';
  let hum = hum0;
  let read = 0;
  let guess = '';
  let paused = false;
  let jolt = 0;
  const damp = () => (hum - 55) / 41;
  const SAID = ['', 'reading one: the shape of the bed', 'reading two: the weather under glass', 'reading three: what the roots advise'];
  return {
    title: opener,
    brief: 'Set the humidity and the light, pause the wind if you like, call the spread of the bed by eye, and take three readings; the glass prints a forecast from the shape of your sky and stamps it with the true spread.',
    aspect: '16 / 10',
    steps: [
      { id: 'humidity', ask: 'the humidity', kind: 'range', min: 55, max: 96, step: 1, value: hum0, low: 'dry', high: 'dripping' },
      { id: 'light', ask: 'the light', kind: 'choice', options: lights },
      { id: 'wind', ask: 'the wind', kind: 'toggle', label: 'pause the wind' },
      { id: 'guess', ask: 'how are the stems spread? look at the bed', kind: 'choice', options: SPREADS },
      { id: 'read', ask: 'take three readings', kind: 'press', count: 3, label: 'take a reading', after: 'humidity' }
    ],
    start(c) {
      s.fog = damp();
      s.needle = damp();
      scene(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'humidity') {
        hum = Math.round(Math.max(55, Math.min(96, Number(value) || 55)));
        c.status('humidity ' + hum + '%: ' + (hum < 65 ? 'the glass is clear' : hum < 80 ? 'the glass is sweating a little' : 'the glass is dripping'));
      }
      if (id === 'light') {
        s.light = Number(value) || 0;
        c.status('light: ' + LIGHT[s.light]);
      }
      if (id === 'wind') {
        paused = !!value;
        c.status(paused ? 'wind paused. the terrarium is holding its breath' : 'wind resumed. the stems sway again');
      }
      if (id === 'guess') {
        guess = String(value);
        c.status('your call: a ' + guess + ' spread. the stamp settles it');
      }
      if (id === 'read') {
        read = Math.min(3, Number(value) || 0);
        jolt = 1;
        s.flash = 0.7;
        for (const p of s.plants) p.pulse = Math.max(p.pulse, 0.6);
        c.status(SAID[read]);
      }
    },
    frame(t, dt, c) {
      tick(s, dt);
      jolt = Math.max(0, jolt - dt * 1.5);
      s.fog += (damp() - s.fog) * Math.min(1, dt * 3);
      s.wind += ((paused ? 0 : 0.4) - s.wind) * Math.min(1, dt * 3);
      s.needle += (damp() + Math.sin(s.t * 9) * jolt * 0.12 - s.needle) * Math.min(1, dt * 5);
      s.lines = [];
      if (read >= 1) s.lines.push(opener + ':', stats);
      if (read >= 2) s.lines.push('humidity ' + hum + '%; light ' + (LIGHT[s.light] || 'not yet chosen') + '; wind ' + (paused ? WIND[0] : WIND[2]) + '.');
      if (read >= 3) s.lines.push(mid, closer);
      if (c.done) s.stamp = Math.min(1, s.stamp + dt * 1.8);
      scene(c.g, c.w, c.h, c, s);
    },
    end(c) {
      for (const p of s.plants) p.bud = 1;
      const called = guess === r.spread;
      c.status('forecast stamped: a ' + r.spread + ' spread' + (called ? ', as you called it' : guess ? ', not the ' + guess + ' one you called' : '') + '. '
        + (r.spread === 'compact' ? 'the stems huddle together' : r.spread === 'wild' ? 'the stems scatter to the glass' : 'the stems keep an even distance'));
    }
  };
}

// The bed regrown: an order to come up in, the moss if you dare, a few regrowings, and the wait
// while the new stems come up.
function regrow(env) {
  const was = pressed(env);
  const n = env.stars.length;
  const times = env.int(2, 4);
  const twice = times === 2 ? 'twice' : WORDS[times] + ' times';
  let salt = env.int(1, 9999);
  const s = fresh(env.stars, salt);
  s.wind = 0.45;
  let order = 'x';
  let grown = 0;
  let up = false;
  function replant(c, reseed) {
    if (reseed) s.plants = c.stars.map((star, i) => sprout(star, i, ++salt));
    const idx = c.stars.map((star, i) => i);
    if (order === 'x') idx.sort((a, b) => c.stars[a].x - c.stars[b].x);
    else if (order === 'short') idx.sort((a, b) => c.stars[b].y - c.stars[a].y);
    else idx.sort((a, b) => c.stars[a].y - c.stars[b].y);
    idx.forEach((i, rank) => {
      s.plants[i].grow = 0;
      s.plants[i].delay = (rank / Math.max(1, n - 1)) * 1.4;
    });
    up = false;
  }
  return {
    title: env.pick(['regrow the terrarium', 'same stars, new stems']),
    brief: 'Choose how the stems come up, regrow the bed ' + twice + ' from the same stars, switch the moss on if you dare, and watch the new stems come up and bloom.'
      + (was && was.opener ? ' The bed is the one your ' + was.opener + ' was read off.' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'order', ask: 'how they come up', kind: 'choice', options: ORDERS },
      { id: 'moss', ask: 'the secret moss', kind: 'toggle', label: 'neon moss' },
      { id: 'regrow', ask: 'regrow the bed ' + twice, kind: 'press', count: times, label: 'regrow', after: 'order' },
      { id: 'grow', ask: 'watch them come up', kind: 'wait', after: 'regrow' }
    ],
    start(c) {
      scene(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'order') {
        order = String(value);
        replant(c, false);
        c.status('they come up ' + (ORDERS.find((o) => o.value === order) || ORDERS[0]).label);
      }
      if (id === 'moss') {
        s.moss = !!value;
        s.flash = 1;
        c.status(s.moss ? 'secret moss: the greenhouse shifts into neon bloom' : 'the moss dims; midnight glass again');
      }
      if (id === 'regrow') {
        grown = Number(value) || 0;
        replant(c, true);
        s.flash = 1;
        c.status('regrown: same stars, new stems' + (grown < times ? ' (' + (times - grown) + ' to go)' : ''));
      }
    },
    frame(t, dt, c) {
      tick(s, dt);
      if (grown >= times && !up) {
        let sum = 0;
        for (const p of s.plants) sum += p.grow;
        c.progress('grow', sum / Math.max(1, n));
        if (sum >= n) {
          up = true;
          c.status('all up');
          c.satisfy('grow');
        }
      }
      if (c.done) {
        s.wind += (0 - s.wind) * Math.min(1, dt * 1.5);
        for (const p of s.plants) p.bud = 1;
      }
      scene(c.g, c.w, c.h, c, s);
    },
    end(c) {
      c.status((WORDS[n] || n) + ' stem' + (n === 1 ? '' : 's') + ' up and in bloom; the tall one says: ' + tallest(c.stars).text);
    }
  };
}

export default {
  id: 'wish-terrarium',
  needsSky: true,
  paint(ctx, w, h, env) {
    glasshouse(ctx, w, h, env, 0);
  },
  animate(ctx, w, h, env, t) {
    glasshouse(ctx, w, h, env, t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const opener = env.pick(OPENERS);
    const humidity = env.int(55, 96);
    const light = env.pick(LIGHT);
    const wind = env.pick(WIND);
    return {
      title: opener,
      mono: 'humidity: ' + humidity + '%\nlight: ' + light + '\nwind: ' + wind
        + '\nthe tall one says: ' + tallest(env.stars).text,
      text: env.stars.length + ' plant' + (env.stars.length === 1 ? '' : 's') + ' under glass, each grown from a star. Open it to water a stem and hear its thought.',
      aspect: '4 / 5',
      paint: (ctx, w, h, e) => glasshouse(ctx, w, h, e, 0),
      // What this card is of, for the piece it opens as: the reading it printed.
      of: { opener, humidity, light, wind }
    };
  },
  piece(env) {
    if (!env.stars.length) return null;
    const roll = env.rnd();
    return roll < 0.38 ? watering(env) : roll < 0.72 ? forecast(env) : regrow(env);
  }
};
