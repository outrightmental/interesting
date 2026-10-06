/* The weather lab: the persona's stars as pressure systems on a synoptic map. As a card it is
   the map, a front between the two farthest stars and a forecast (paint, spark); as a piece it
   is probes launched into the field and a bulletin printed over it, or a front named on those
   two stars, blown across the map and let pass. See js/feed.js for what a module is and
   js/stage.js for what a piece is.

   A card and the feature it opens as are one forecast: the spark puts the front it forecast, the
   way it was moving, the wind and the visibility on its spec as `of`, and the piece opens the map
   at that forecast -- the card's front first on the dial, its wind on the gauge. */

// The card this piece was opened from, in the lab's own terms: the forecast it printed, or null for
// a piece nobody pressed (js/stage.js hands the card over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  const kind = was && KINDS.find((k) => k.value === was.kind);
  if (!kind) return null;
  return {
    kind,
    moving: DIRS.indexOf(was.moving) >= 0 ? was.moving : '',
    wind: Math.max(0, WINDS.indexOf(was.wind)),
    vis: VIS.indexOf(was.vis) >= 0 ? was.vis : ''
  };
}

// The wind a card's own forecast implies, in knots: the five words the lab speaks of wind, read
// back as the gauge the piece opens on.
const KNOTS = [5, 10, 18, 26, 34];

const KINDS = [
  { label: 'a warm front', value: 'warm' },
  { label: 'a cold front', value: 'cold' },
  { label: 'an occluded front', value: 'occluded' },
  { label: 'a stationary front', value: 'stationary' },
  { label: 'a line of squalls', value: 'squalls' }
];
const FRONTS = KINDS.map((k) => k.label);
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const WINDS = ['calm at the centre', 'light and variable', 'backing slowly', 'fresh from the west', 'gusting at the edges'];
const VIS = ['good, then middling', 'poor in the gaps between stars', 'excellent above the cloud', 'moderate, with haze'];
const READINGS = ['storm-leaning trough', 'wandering seam', 'calm mid-band', 'glowing high-pressure pocket'];
const SHORT = ['trough', 'seam', 'mid-band', 'pocket'];
const BANDS = ['the midnight bands', 'first light over the field', 'morning haze', 'afternoon convection', 'the evening gradient', 'the late bands'];
const OPENERS = ['constellation synoptic:', 'midnight weather desk:', 'sky pattern bulletin:', 'starlit pressure report:'];
const INSIGHTS = [
  'A gentle front rewards tiny, consistent progress.',
  'Conditions favor playful drafts over perfect plans.',
  'Momentum improves when you start before certainty.',
  'Visibility increases after one brave unfinished step.'
];
const ADVISORIES = [
  'Carry one clear intention into the next hour.',
  'Protect a short focus window and build inside it.',
  'Share a rough version, then refine with feedback.',
  'If stalled, shrink the task until movement returns.'
];
const LORE = 'Printable, if you print it. Nothing here will come true.';
const LINES = [
  'Tap the map on its page to launch a probe.',
  'The front is your two farthest stars; everything else is weather.',
  LORE,
  'Pressure follows the stars. Move one and the map redraws.'
];
const NUM = ['two', 'three', 'four'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (h) => (h < 10 ? '0' : '') + h + ':00';
const region = (x, y) => (y < 50 ? 'north' : 'south') + '-' + (x < 50 ? 'west' : 'east');
const unit = (w, h) => Math.min(w, h) / 100;
const windOf = (kt) => WINDS[kt < 7 ? 0 : kt < 14 ? 1 : kt < 22 ? 2 : kt < 30 ? 3 : 4];

// Everything the scene draws from; a card draws it once, a piece carries it between frames.
function blank(hour, front) {
  return { t: 0, hour, wind: 0, still: 0, rain: false, drops: [], probes: [], flash: 0, front, off: 0, dir: 1, pair: null, clear: 0, veil: 0, lines: null, rise: 0, hint: false };
}

// The two farthest of a list of points, as indices.
function farthest(pts) {
  let a = 0;
  let b = Math.min(1, pts.length - 1);
  let far = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d > far) {
        far = d;
        a = i;
        b = j;
      }
    }
  }
  return [a, b];
}

// The stars as pressure systems, the high ones highs. They drift with the hour and the wind.
function systems(e, w, h, hour, t, wind, still) {
  const amp = e.reduced ? 0 : 2.5 * unit(w, h) * (1 - still);
  return e.points(w, h, 14).slice(0, 40).map((p, i) => {
    const d = (i % 2 ? 1 : -1) * (0.15 + (i % 7) * 0.03) * (1 + wind * 4);
    return {
      i, text: p.text, high: p.y < h / 2, power: 0.6 + (1 - p.y / h) * 1.2,
      x: p.x + Math.sin(hour * 0.28 + i * 0.9 + t * d) * amp,
      y: p.y + Math.cos(hour * 0.24 + i * 0.7 + t * d * 0.8) * amp * 0.8
    };
  });
}

// The pressure at a point: the highs push it up, the lows pull it down.
function field(sys, x, y, s2) {
  let v = 0;
  for (const q of sys) v += (q.high ? 1 : -1) * q.power * Math.exp(-((x - q.x) ** 2 + (y - q.y) ** 2) / s2);
  return v;
}

function graticule(g, w, h, e) {
  const step = Math.max(14, Math.round(Math.min(w, h) / 14));
  g.strokeStyle = e.alpha(e.colors.muted, 0.12);
  g.lineWidth = 1;
  g.beginPath();
  for (let x = step; x < w; x += step) {
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
  }
  for (let y = step; y < h; y += step) {
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
  }
  g.stroke();
}

// The field as a coarse grid: warm where the pressure is high, cool where it is low.
function pressure(g, w, h, e, sys, gain) {
  const cols = 26;
  const rows = Math.max(6, Math.round((cols * h) / w));
  const cw = w / cols;
  const rh = h / rows;
  const s2 = (28 * unit(w, h)) ** 2;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const v = field(sys, (gx + 0.5) * cw, (gy + 0.5) * rh, s2);
      g.fillStyle = e.alpha(v > 0 ? e.colors.accent2 : e.colors.accent, Math.min(0.4, Math.abs(v) * gain));
      g.fillRect(gx * cw, gy * rh, cw + 1, rh + 1);
    }
  }
}

// Isobars round a system, stretched and laid flat as the wind rises, and its letter.
function isobars(g, e, q, u, wind, fade) {
  const rings = 3 + (q.i % 3);
  const tilt = ((q.i * 0.7) % Math.PI) * (1 - wind);
  g.lineWidth = 1;
  for (let r = 1; r <= rings; r++) {
    g.strokeStyle = e.alpha(q.high ? e.colors.accent2 : e.colors.accent, (0.42 - r * 0.08) * fade);
    g.beginPath();
    g.ellipse(q.x, q.y, r * 2.4 * u * (1 + wind * 0.8), r * 1.9 * u, tilt, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = e.alpha(e.colors.fg, 0.9);
  g.font = '600 ' + Math.max(9, Math.round(2.6 * u)) + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(q.high ? 'H' : 'L', q.x, q.y);
}

// The front, with the teeth of its kind: a segment between the two systems while it sits on them
// (off 0), unfurling to a line across the whole map as it sets off, with the air it brought shaded
// behind. One star alone gets a front lying east-west through it.
function front(g, w, h, e, a, b, kind, off, dir, u) {
  const c = e.colors;
  const tone = (k) => (k === 'warm' ? c.accent2 : k === 'cold' ? c.accent : k === 'squalls' ? c.fg : e.mix(c.accent, c.accent2, 0.5));
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const tx = len ? (b.x - a.x) / len : 1;
  const ty = len ? (b.y - a.y) / len : 0;
  const nx = -ty * dir;
  const ny = tx * dir;
  const mx = (a.x + b.x) / 2 + nx * off;
  const my = (a.y + b.y) / 2 + ny * off;
  const R = Math.hypot(w, h);
  const reach = off ? len / 2 + (R - len / 2) * Math.min(1, off / (6 * u)) : Math.max(len / 2, u);
  if (off) {
    g.save();
    g.translate(mx, my);
    g.rotate(Math.atan2(ny, nx));
    g.fillStyle = e.alpha(tone(kind), 0.1);
    g.fillRect(-R, -reach, R, 2 * reach);
    g.restore();
  }
  g.strokeStyle = e.alpha(tone(kind), 0.8);
  g.lineWidth = Math.max(1.5, u * 0.45);
  g.beginPath();
  g.moveTo(mx - tx * reach, my - ty * reach);
  g.lineTo(mx + tx * reach, my + ty * reach);
  g.stroke();
  const gap = Math.max(10, 4.9 * u);
  const tooth = 1.55 * u;
  const n = Math.floor((reach - (off ? 0 : gap * 0.5)) / gap);
  for (let k = -n; k <= n; k++) {
    const x = mx + tx * k * gap;
    const y = my + ty * k * gap;
    if (x < -tooth || x > w + tooth || y < -tooth || y > h + tooth) continue;
    const odd = (k + n) % 2;
    const shape = kind === 'occluded' || kind === 'stationary' ? (odd ? 'cold' : 'warm') : kind;
    const side = kind === 'stationary' && odd ? -1 : 1;
    g.fillStyle = e.alpha(tone(shape), 0.85);
    g.beginPath();
    if (shape === 'warm') {
      const phi = Math.atan2(ny * side, nx * side);
      g.arc(x, y, tooth * 0.65, phi - Math.PI / 2, phi + Math.PI / 2);
      g.fill();
    } else if (shape === 'cold') {
      g.moveTo(x - tx * tooth * 0.6, y - ty * tooth * 0.6);
      g.lineTo(x + tx * tooth * 0.6, y + ty * tooth * 0.6);
      g.lineTo(x + nx * side * tooth * 1.1, y + ny * side * tooth * 1.1);
      g.fill();
    } else {
      g.moveTo(x - nx * tooth * 0.7, y - ny * tooth * 0.7);
      g.lineTo(x + nx * tooth * 0.7, y + ny * tooth * 0.7);
      g.stroke();
    }
  }
}

// The probes with their rings, each tied to the system it read, and the rain.
function markers(g, e, s, sys, u) {
  const c = e.colors;
  for (const p of s.probes) {
    const q = sys[p.near];
    g.strokeStyle = e.alpha(c.accent2, 0.35);
    g.lineWidth = 1;
    if (q) {
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
      g.stroke();
    }
    g.fillStyle = e.alpha(c.accent2, 0.9);
    g.beginPath();
    g.arc(p.x, p.y, 0.8 * u, 0, Math.PI * 2);
    g.fill();
    if (p.life > 0) {
      g.strokeStyle = e.alpha(c.accent2, p.life * 0.65);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(p.x, p.y, (1 - p.life) * 6 * u, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (s.drops.length) {
    const len = 2.2 * u;
    const lean = -(0.2 + s.wind * 0.7) * len;
    g.strokeStyle = e.alpha(c.accent, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    for (const d of s.drops) {
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + lean, d.y + len);
    }
    g.stroke();
  }
}

// A bulletin printed over the map: a slip that comes down from the top edge as its lines print.
function slip(g, w, h, e, lines, rise, u) {
  if (!lines || rise <= 0) return;
  const font = (px) => '500 ' + px + 'px system-ui, sans-serif';
  let size = Math.max(10, Math.round(3 * u));
  g.font = font(size);
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, g.measureText(l).width);
  if (widest > w * 0.86) {
    size = Math.max(9, Math.floor((size * w * 0.86) / widest));
    g.font = font(size);
    widest = w * 0.86;
  }
  const lh = size * 1.5;
  const pad = size;
  const bw = widest + pad * 2;
  const bh = lines.length * lh + pad * 2;
  const x = (w - bw) / 2;
  const y = -bh + rise * ((h - bh) / 2 + bh);
  g.fillStyle = e.alpha(e.colors.bg, 0.9);
  g.strokeStyle = e.alpha(e.colors.fg, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x, y, bw, bh, size * 0.5);
  g.fill();
  g.stroke();
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  lines.slice(0, Math.ceil(rise * lines.length)).forEach((l, i) => {
    g.fillStyle = e.alpha(i === 0 ? e.colors.accent2 : i === lines.length - 1 ? e.colors.muted : e.colors.fg, 0.92);
    g.fillText(l, x + pad, y + pad + lh * (i + 0.5));
  });
}

// The whole map, back to front. The stage never clears the canvas, so this paints all of it.
function scene(g, w, h, e, s) {
  const u = unit(w, h);
  const c = e.colors;
  const day = (1 + Math.cos(((s.hour - 12) / 12) * Math.PI)) / 2;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, e.mix(c.bg, c.accent2, day * 0.3 + s.clear * 0.08));
  grad.addColorStop(1, e.mix(c.bg2, c.accent, day * 0.15));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  graticule(g, w, h, e);
  const sys = systems(e, w, h, s.hour, s.t, s.wind, s.still);
  if (!s.pair) s.pair = farthest(sys);
  const fade = 1 - s.clear * 0.75;
  pressure(g, w, h, e, sys, (s.rain ? 0.22 : 0.3) * fade);
  for (const q of sys) isobars(g, e, q, u, s.wind, fade);
  const a = sys[s.pair[0]];
  const b = sys[s.pair[1]];
  if (s.front) front(g, w, h, e, a, b, s.front, s.off, s.dir, u);
  else if (sys.length > 1 && s.hint) {
    g.strokeStyle = e.alpha(c.fg, 0.3);
    g.lineWidth = 1;
    g.setLineDash([2 * u, 2 * u]);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
    g.setLineDash([]);
  }
  markers(g, e, s, sys, u);
  if (s.veil > 0) {
    g.fillStyle = e.alpha(c.bg, s.veil);
    g.fillRect(0, 0, w, h);
  }
  slip(g, w, h, e, s.lines, s.rise, u);
  if (s.flash > 0) {
    g.fillStyle = e.alpha(c.accent2, s.flash * 0.18);
    g.fillRect(0, 0, w, h);
  }
  return sys;
}

// One frame's worth of time: rings fade, rain falls and leans with the wind, the slip prints.
function tick(s, dt, w, h, e) {
  const u = unit(w, h);
  s.t += dt;
  s.flash = Math.max(0, s.flash - dt * 1.8);
  for (const p of s.probes) p.life = Math.max(0, p.life - dt * 1.4);
  if (s.rain && s.drops.length < w / 7) {
    for (let i = 0; i < 4; i++) s.drops.push({ x: e.rnd() * w, y: -2 * u - e.rnd() * 14 * u, vy: (36 + e.rnd() * 26) * u });
  }
  const lean = -(0.2 + s.wind * 0.7);
  for (let i = s.drops.length - 1; i >= 0; i--) {
    const d = s.drops[i];
    d.y += d.vy * dt;
    d.x += d.vy * dt * lean;
    if (d.y > h + 3 * u) s.drops.splice(i, 1);
  }
  if (s.lines) s.rise = Math.min(1, s.rise + dt * 1.4);
  if (s.clear) s.clear = Math.min(1, s.clear + dt * 0.8);
}

// The card: the field as it stands, at the hour and in the wind the configuration `v` the card was
// dealt chose, so a repeat is a different map of the same stars.
function map(g, w, h, e, kind, v) {
  const state = blank(2 + Math.round(v.turn * 20), kind || 'cold');
  state.wind = clamp((v.density - 0.7) * 1.6, 0, 1);
  state.t = v.turn * 6;
  scene(g, w, h, e, state);
}

// The forecast, composed from the geometry of the stars and whatever the knobs say now.
function bulletin(c, s) {
  const st = c.stars;
  const n = st.length || 1;
  let cx = 0;
  let cy = 0;
  for (const q of st) {
    cx += q.x / n;
    cy += q.y / n;
  }
  let spread = 0;
  for (const q of st) spread += Math.hypot(q.x - cx, q.y - cy) / n;
  const rain = s.rain ? 98 : clamp(Math.round(spread * 2.4 + st.length * 1.7 + (s.hour > 17 ? 8 : 0) - 15), 5, 98);
  const kt = clamp(Math.round(4 + spread * 0.9 + s.gust), 3, 36);
  return [
    s.opener,
    'time ' + fmt(s.hour) + ' · region ' + region(cx, cy) + ' · field ' + (st.length < 6 ? 'quiet' : st.length < 16 ? 'steady' : 'busy'),
    st.length + ' system' + (st.length === 1 ? '' : 's') + ' with ' + (spread < 12 ? 'compact' : spread < 24 ? 'balanced' : 'expansive') + ' spread',
    'wind ' + kt + ' kt · rain chance ' + rain + '%' + (s.rain ? ' (it is raining)' : ''),
    s.probes.length ? 'probes: ' + s.probes.map((p) => SHORT[p.reading]).join(', ') : 'no probes launched',
    s.insight,
    s.advisory,
    LORE
  ];
}

// Probes into the field at an hour of your choosing, and a forecast printed from what they read.
function probing(env) {
  const was = pressed(env);
  const need = env.int(2, 4);
  const hour = env.int(0, 23);
  const word = NUM[need - 2];
  // The gust the card's own wind implies, so the field a visitor lands on is the field it read.
  const gust = was ? clamp(Math.round(KNOTS[was.wind] / 3.4), 0, 10) : env.int(0, 10);
  const s = Object.assign(blank(hour, null), { gust, opener: env.pick(OPENERS), insight: env.pick(INSIGHTS), advisory: env.pick(ADVISORIES), launched: 0 });
  const compose = () => {
    if (s.lines && s.c) s.lines = bulletin(s.c, s);
  };
  return {
    title: env.chance(0.5) ? word + ' probes into the field' : word + ' probes and a forecast',
    brief: 'Set the hour, tap the map to launch ' + word + ' probes into the microclimates round your stars, call the rain or hold it off, and print the forecast; the bulletin prints itself over the map.'
      + (was ? ' Your card had ' + was.kind.label + (was.moving ? ' moving ' + was.moving : '') + '.' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'hour', ask: 'the forecast hour', kind: 'range', min: 0, max: 23, step: 1, value: hour, low: '00:00', high: '23:00' },
      { id: 'probe', ask: 'tap the map to launch ' + word + ' probes', kind: 'tap', label: 'launch one for me', after: 'hour' },
      { id: 'rain', ask: 'the precipitation', kind: 'toggle', label: 'rain mode' },
      { id: 'print', ask: 'print the forecast', kind: 'press', count: 1, label: 'print it', after: 'probe' }
    ],
    start(c) {
      s.c = c;
      scene(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      s.c = c;
      if (id === 'hour') {
        s.hour = clamp(Math.round(Number(value)) || 0, 0, 23);
        c.status(fmt(s.hour) + ' — ' + BANDS[Math.min(5, Math.floor((s.hour + 1) / 4))]);
      }
      if (id === 'rain') {
        s.rain = !!value;
        c.status(s.rain ? 'Rain mode engaged. Pressure bands are precipitating.' : 'Rain mode paused. Clouds are holding.');
      }
      if (id === 'print') {
        s.lines = s.lines || [];
        s.rise = 0;
        s.flash = 1;
        c.status('Forecast printed from your current constellation geometry.');
      }
      compose();
    },
    tap(x, y, c) {
      const px = x * c.w;
      const py = y * c.h;
      const sys = systems(c, c.w, c.h, s.hour, s.t, 0, 0);
      let near = 0;
      let best = Infinity;
      sys.forEach((q, i) => {
        const d = (q.x - px) ** 2 + (q.y - py) ** 2;
        if (d < best) {
          best = d;
          near = i;
        }
      });
      const v = field(sys, px, py, (28 * unit(c.w, c.h)) ** 2);
      const reading = v > 0.65 ? 3 : v > 0.2 ? 2 : v > -0.2 ? 1 : 0;
      const kt = clamp(Math.round(6 + Math.abs(v) * 18 + (s.hour % 5)), 4, 32);
      s.probes.push({ x: px, y: py, near, life: 1, reading });
      s.flash = Math.max(s.flash, 0.8);
      s.launched += 1;
      c.progress('probe', Math.min(1, s.launched / need));
      c.status('probe ' + s.launched + ': ' + READINGS[reading] + ', wind ' + kt + ' kt — nearest memo: “' + (sys[near] ? sys[near].text : 'no nearby thought') + '”');
      if (s.launched >= need) c.satisfy('probe');
      compose();
    },
    frame(t, dt, c) {
      tick(s, dt, c.w, c.h, c);
      if (c.done) s.veil = Math.min(0.45, s.veil + dt * 0.5);
      scene(c.g, c.w, c.h, c, s);
    },
    end(c) {
      s.c = c;
      if (!s.lines) {
        s.lines = [];
        s.rise = 0;
      }
      compose();
      s.flash = 1;
      c.status(LORE);
    }
  };
}

// The line the front travels: where it sits now, which way it goes, how far until it is off the map.
function course(c, s) {
  const pts = c.points(c.w, c.h, 14);
  const a = pts[s.pair[0]];
  const b = pts[s.pair[1]];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = len ? (-(b.y - a.y) / len) * s.dir : 0;
  const ny = len ? ((b.x - a.x) / len) * s.dir : s.dir;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  let far = 0;
  for (const [x, y] of [[0, 0], [c.w, 0], [0, c.h], [c.w, c.h]]) far = Math.max(far, (x - mx) * nx + (y - my) * ny);
  return { mx, my, nx, ny, far: far + 4 * unit(c.w, c.h) };
}

// A front named on the two farthest stars, blown across the map by a wind you set, and let pass.
function passing(env) {
  const was = pressed(env);
  const stars = env.stars.slice(0, 40);
  const pair = farthest(stars.map((q) => ({ x: q.x * 1.6, y: q.y })));
  const a = stars[pair[0]];
  const b = stars[pair[1]];
  const dir = env.chance(0.5) ? 1 : -1;
  const dx = -(b.y - a.y) * dir;
  const dy = (b.x - a.x) * 1.6 * dir;
  const idx = ((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) % 8) + 8) % 8;
  const pool = KINDS.slice();
  const options = [];
  const count = env.int(3, 4);
  while (options.length < count) options.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  // The front the card forecast is the first one offered, and the wind and visibility are its own.
  if (was) {
    const at = options.findIndex((k) => k.value === was.kind.value);
    if (at >= 0) options.unshift(options.splice(at, 1)[0]);
    else options.unshift(was.kind);
    options.length = Math.min(options.length, 4);
  }
  const ms = env.pick([1500, 2000, 2500]);
  const kt = was ? clamp(KNOTS[was.wind], 6, 30) : env.int(6, 30);
  const vis = was && was.vis ? was.vis : env.pick(VIS);
  const s = Object.assign(blank(env.pick([0, 2, 21, 23]), null), { dir, pair, kt, sweep: 0, passed: false, where: '', hint: true });
  const span = a === b ? 'over “' + a.text + '”' : 'between “' + a.text + '” and “' + b.text + '”';
  return {
    // The front the card forecast, named in the title: pressing a warm front opens a warm front.
    title: (was ? was.kind.label : 'a front') + ' out of the ' + DIRS[(idx + 4) % 8],
    brief: 'Name the front that forms ' + (a === b ? 'over your star' : 'between your two farthest stars') + ', set the wind, and watch it cross the map toward the ' + DIRS[idx] + '; once it has passed, hold the barometer steady and the air settles behind it.'
      + (was ? ' Your card called it ' + was.kind.label + ', and it is first on the dial.' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'front', ask: 'what kind of front', kind: 'choice', options },
      { id: 'wind', ask: 'the wind', kind: 'range', min: 3, max: 36, step: 1, value: kt, low: 'calm', high: 'gale' },
      { id: 'pass', ask: 'watch it cross the map', kind: 'wait', after: 'front' },
      { id: 'steady', ask: 'steady the barometer', kind: 'hold', ms, label: 'hold the barometer', after: 'pass' }
    ],
    start(c) {
      s.wind = (kt - 3) / 33;
      scene(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'front') {
        s.front = String(value);
        s.rain = !s.passed && s.front !== 'warm' && s.front !== 'stationary';
        const k = KINDS.find((o) => o.value === s.front) || KINDS[1];
        c.status(k.label + ' forms ' + span + (s.rain ? ', and it is raining' : ''));
      }
      if (id === 'wind') {
        s.kt = clamp(Math.round(Number(value)) || 3, 3, 36);
        s.wind = (s.kt - 3) / 33;
        c.status('wind ' + s.kt + ' kt, ' + windOf(s.kt));
      }
      if (id === 'steady') {
        s.clear = s.clear || 0.001;
        c.status('the glass is steady');
      }
    },
    frame(t, dt, c) {
      tick(s, dt, c.w, c.h, c);
      if (s.front && !s.passed) {
        s.sweep = Math.min(1, s.sweep + dt / (8 - s.wind * 5.5));
        c.progress('pass', s.sweep);
        const line = course(c, s);
        s.off = s.sweep * line.far;
        const where = region(((line.mx + line.nx * s.off) / c.w) * 100, ((line.my + line.ny * s.off) / c.h) * 100);
        if (s.sweep > 0.15 && s.sweep < 1 && where !== s.where) {
          s.where = where;
          c.status('the front is over the ' + where);
        }
        if (s.sweep >= 1) {
          s.passed = true;
          s.rain = false;
          c.satisfy('pass');
          c.status('the front has passed; visibility ' + vis);
        }
      }
      s.still = s.clear;
      scene(c.g, c.w, c.h, c, s);
    },
    end(c) {
      s.clear = s.clear || 0.001;
      s.lines = ['the front has passed', 'behind it: ' + windOf(s.kt) + ' · visibility ' + vis, LORE];
      s.rise = 0;
      s.flash = 1;
      c.status('behind the front: ' + windOf(s.kt) + '; visibility ' + vis);
    }
  };
}

export default {
  id: 'constellation-weather',
  needsSky: true,
  paint(ctx, w, h, env) {
    map(ctx, w, h, env, env.pick(KINDS).value, env.variant);
  },
  spark(env) {
    const stars = env.stars;
    if (!stars.length) return null;
    let highs = 0;
    let cx = 0;
    for (const s of stars) {
      if (s.y < 50) highs++;
      cx += s.x;
    }
    cx /= stars.length;
    const where = cx < 40 ? 'west' : cx > 60 ? 'east' : 'middle';
    const kind = env.pick(KINDS);
    const moving = env.pick(DIRS);
    const wind = env.pick(WINDS);
    const vis = env.pick(VIS);
    return {
      title: 'forecast',
      mono: 'pressure: ' + (highs > stars.length / 2 ? 'high' : 'low') + ' over the ' + where
        + '\nfront: ' + kind.label + ', moving ' + moving
        + '\nwind: ' + wind
        + '\nvisibility: ' + vis,
      text: env.pick(LINES),
      aspect: '16 / 10',
      paint: (ctx, w, h, e) => map(ctx, w, h, e, kind.value, e.variant),
      // What this card is of, for the piece it opens as: the forecast it printed.
      of: { kind: kind.value, moving, wind, vis }
    };
  },
  piece(env) {
    if (!env.stars.length) return null;
    return env.chance(0.5) ? probing(env) : passing(env);
  }
};
