/* The diary: the persona's stars over a logbook. As a card it is the sky over a ruled page with
   one mark per star (paint, spark). As a piece it is one of two things: an entry written a line
   at a time from where the stars sit and sealed with the whole sky pressed into the wax, or the
   stars called back one by one in the order they came and written up under a watch of the
   visitor's choosing. See js/feed.js for what a module is and js/stage.js for what a piece is.

   A card and the feature it opens as are one entry: the spark puts its number and the star it was
   written from on its spec as `of`, and the piece carries the number onto the page it writes and
   opens from the same star. */

// The card this piece was opened from, in the logbook's own terms: the entry number it was and the
// star it was written from, or null for a piece nobody pressed (js/stage.js, env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  const number = was ? Number(was.entry) : NaN;
  if (!isFinite(number)) return null;
  return { entry: Math.max(1, Math.round(number)), star: typeof was.star === 'string' ? was.star : '' };
}

const INKS = [
  { label: 'night', value: 'accent' },
  { label: 'candle', value: 'accent2' },
  { label: 'pale', value: 'fg' },
  { label: 'faded', value: 'muted' }
];

const WATCHES = [
  { label: 'at dusk', value: 'dusk' },
  { label: 'at midnight', value: 'midnight' },
  { label: 'in the small hours', value: 'small' },
  { label: 'at first light', value: 'dawn' }
];

const OPENERS = { dusk: 'drift entry:', midnight: 'night watch report:', small: 'observatory memo:', dawn: 'logbook note:' };

const FIRST = ['velvet', 'copper', 'echo', 'saffron', 'silver', 'midnight', 'lumen', 'quiet'];
const SECOND = ['harbor', 'signal', 'bridge', 'garden', 'archive', 'compass', 'choir', 'voyage'];

const MIDDLES = [
  'the pattern keeps choosing motion over certainty.',
  'small lights negotiated a map out of static.',
  'the sky preferred curiosity to caution.',
  'the constellation leaned toward unfinished courage.'
];

const CLOSERS = [
  'next: move one star and test a new story.',
  'recommendation: protect one hour for playful drafting.',
  'next action: begin before your inner critic wakes.',
  'forecast: momentum improving with each tiny attempt.'
];

function where(s) {
  const ns = s.y < 35 ? 'high' : s.y > 65 ? 'low' : 'midway';
  const ew = s.x < 35 ? 'in the west' : s.x > 65 ? 'in the east' : 'near the middle';
  return ns + ' ' + ew;
}

function nearest(stars, star) {
  let best = null;
  let bd = Infinity;
  for (const o of stars) {
    if (o === star) continue;
    const d = Math.hypot(o.x - star.x, o.y - star.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

// The sky's own number: the same stars in the same places make the same entry title.
function hashStars(stars) {
  let h = 2166136261;
  for (const s of stars) {
    h = Math.imul(h ^ Math.round(s.x * 10), 16777619);
    h = Math.imul(h ^ Math.round(s.y * 10), 16777619);
    const t = String(s.text || '');
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function summary(stars) {
  const n = stars.length || 1;
  let cx = 0;
  let cy = 0;
  for (const s of stars) {
    cx += s.x;
    cy += s.y;
  }
  cx /= n;
  cy /= n;
  let spread = 0;
  for (const s of stars) spread += Math.hypot(s.x - cx, s.y - cy);
  return { cx, cy, spread: spread / n };
}

function spreadWord(spread) {
  return spread < 12 ? 'tight and intentional' : spread < 24 ? 'balanced and exploratory' : 'wide and adventurous';
}

function entryTitle(stars) {
  const h = hashStars(stars);
  const s = summary(stars);
  const region = (s.cy < 50 ? 'north' : 'south') + '-' + (s.cx < 50 ? 'west' : 'east');
  const shape = s.spread < 12 ? 'knot' : s.spread < 24 ? 'field' : 'trail';
  return FIRST[h % FIRST.length] + ' ' + SECOND[(h >>> 4) % SECOND.length] + ' of the ' + region + ' ' + shape;
}

function setDrift(s, value, c) {
  s.drift = Math.max(0, Math.min(1, Number(value) / 100)) || 0;
  const d = s.drift;
  c.status(d < 0.05 ? 'the sky holds still' : d < 0.4 ? 'a little drift, as skies do' : d < 0.75 ? 'the stars wander' : 'everything is on the move');
}

// Three of a list, in an order of the seed's choosing.
function three(env, list) {
  const pool = list.slice();
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

/* ---- drawing ------------------------------------------------------------------------------- */

function skyTint(env, watch) {
  const c = env.colors;
  if (watch === 'dusk') return [env.mix(c.bg2, c.accent2, 0.22), c.bg];
  if (watch === 'small') return [env.mix(c.bg2, c.accent, 0.14), env.mix(c.bg, c.accent, 0.05)];
  if (watch === 'dawn') return [env.mix(c.bg2, c.fg, 0.2), env.mix(c.bg, c.accent2, 0.1)];
  return [c.bg2, c.bg];
}

function sky(g, w, split, tint) {
  const grad = g.createLinearGradient(0, 0, 0, split);
  grad.addColorStop(0, tint[0]);
  grad.addColorStop(1, tint[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, split);
}

function ring(g, x, y, r, color, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

// Lines between stars: along the order they came ('path'), or between near neighbours, brighter
// the nearer they are ('near', within `reach`).
function links(g, pts, env, ink, mode, reach) {
  g.lineWidth = 1;
  if (mode === 'path') {
    if (pts.length < 2) return;
    g.strokeStyle = env.alpha(ink, 0.22);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    return;
  }
  const r2 = reach * reach;
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const d2 = (pts[b].x - pts[a].x) ** 2 + (pts[b].y - pts[a].y) ** 2;
      if (d2 > r2) continue;
      g.strokeStyle = env.alpha(ink, 0.1 + (1 - d2 / r2) * 0.5);
      g.beginPath();
      g.moveTo(pts[a].x, pts[a].y);
      g.lineTo(pts[b].x, pts[b].y);
      g.stroke();
    }
  }
}

function dots(g, pts, env, ink, scale) {
  pts.forEach((p, i) => {
    const r = (1.8 + (i % 3) * 0.7) * scale;
    g.fillStyle = env.alpha(ink, 0.22);
    g.beginPath();
    g.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = env.alpha(env.colors.fg, 0.95);
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
  });
}

// The ruled page under the sky: `rows` rules and a margin line at `m`. Returns the rule spacing.
function page(g, w, h, split, env, ink, m, rows) {
  const c = env.colors;
  g.fillStyle = env.mix(c.bg, c.fg, 0.06);
  g.fillRect(0, split, w, h - split);
  const step = (h - split) / (rows + 1);
  g.lineWidth = 1;
  g.strokeStyle = env.alpha(ink, 0.25);
  for (let i = 1; i <= rows; i++) {
    g.beginPath();
    g.moveTo(m * 0.5, split + step * i);
    g.lineTo(w - m * 0.5, split + step * i);
    g.stroke();
  }
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.beginPath();
  g.moveTo(m, split);
  g.lineTo(m, h);
  g.stroke();
  return step;
}

// One mark per star, in the order they were placed, as the card has always kept them.
function marks(g, w, split, step, pts, env, m, rows) {
  const perLine = Math.ceil(pts.length / rows) || 1;
  const cell = (w - m - 24) / perLine;
  g.fillStyle = env.alpha(env.colors.fg, 0.7);
  pts.forEach((p, i) => {
    const len = 6 + ((p.text || '').length % 9) * 3;
    g.fillRect(m + 8 + (i % perLine) * cell, split + step * (Math.floor(i / perLine) + 1) - 4, Math.min(len, cell - 6), 2);
  });
}

// A line of handwriting on a rule, shrunk a little and then cut short if it would run off the page.
function write(g, text, x, y, maxW, size, color) {
  let s = size;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = '500 ' + s + 'px system-ui, sans-serif';
  while (s > 9 && g.measureText(text).width > maxW) {
    s -= 1;
    g.font = '500 ' + s + 'px system-ui, sans-serif';
  }
  let t = text;
  if (g.measureText(t).width > maxW) {
    while (t.length > 4 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t += '…';
  }
  g.fillStyle = color;
  g.fillText(t, x, y);
}

// The scene's measurements: where the sky ends and the page begins, the margin, the hand's size.
function frameOf(c) {
  const unit = Math.min(c.w, c.h);
  return { w: c.w, h: c.h, split: c.h * 0.58, m: Math.max(18, unit * 0.08), unit, size: Math.max(10, Math.min(22, Math.round(unit * 0.036))) };
}

// Lines of handwriting on the page, one to a rule from the top; `color` may be a function of the row.
function rows(c, fr, step, lines, color) {
  lines.forEach((line, i) => {
    const col = typeof color === 'function' ? color(i) : color;
    write(c.g, line, fr.m + fr.size * 0.5, fr.split + step * (i + 1) - fr.size * 0.3, fr.w - fr.m * 2 - fr.size, fr.size, col);
  });
}

// The stars as points in the sky, wobbled by the drift. With less motion asked for, t stays
// where it is, so the drift spreads the sky instead of wandering it.
function placed(c, split, pad, drift, t) {
  const amp = Math.min(c.w, c.h) * 0.025 * drift;
  return c.points(c.w, split, pad).map((p, i) => ({
    x: p.x + Math.cos(t * 0.8 + i * 0.9) * amp * 0.9,
    y: p.y + Math.sin(t * 1.1 + i * 0.7) * amp,
    text: p.text
  }));
}

// A wax seal with the whole sky pressed into it.
function seal(g, c, x, y, r, glow) {
  const col = c.colors;
  const halo = g.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
  halo.addColorStop(0, c.alpha(col.accent2, 0.4 * glow));
  halo.addColorStop(1, c.alpha(col.accent2, 0));
  g.fillStyle = halo;
  g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  const wax = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  wax.addColorStop(0, c.mix(col.accent2, col.fg, 0.25));
  wax.addColorStop(1, c.mix(col.accent2, col.bg, 0.35));
  g.fillStyle = wax;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  ring(g, x, y, r * 0.82, c.alpha(col.bg, 0.5), 1);
  g.fillStyle = c.alpha(col.bg, 0.85);
  for (const s of c.stars) {
    g.beginPath();
    g.arc(x + (s.x / 100 - 0.5) * r * 1.2, y + (s.y / 100 - 0.5) * r * 1.2, Math.max(1, r * 0.06), 0, Math.PI * 2);
    g.fill();
  }
}

// The card: the sky over the page, with the birth-order path and one mark per star. The
// configuration the card was dealt sets where the sky gives way to the page, how large the stars
// are written and how many rules the page is ruled for.
function logbook(ctx, w, h, env) {
  const v = env.variant;
  const split = h * (0.5 + v.turn * 0.16);
  const ink = env.colors.accent;
  sky(ctx, w, split, skyTint(env, 'midnight'));
  const pts = env.points(w, split, 10);
  links(ctx, pts, env, ink, 'path', 0);
  dots(ctx, pts, env, ink, v.scale);
  const rows = Math.max(3, Math.round(5 * v.density));
  const step = page(ctx, w, h, split, env, ink, 26, rows);
  marks(ctx, w, split, step, pts, env, 26, rows);
}

/* ---- the pieces ---------------------------------------------------------------------------- */

// An entry written a line at a time from where the stars sit, then sealed; the sky goes into
// the wax when it is done.
function entry(env) {
  const was = pressed(env);
  const inks = three(env, INKS);
  const count = env.int(3, 4);
  const holdMs = env.pick([1500, 2000, 2500]);
  const drift0 = env.int(20, 60);
  const opener = env.pick([OPENERS.dawn, OPENERS.small, OPENERS.midnight, OPENERS.dusk]);
  const middle = env.pick(MIDDLES);
  const closer = env.pick(CLOSERS);
  const s = { ink: 'accent', drift: drift0 / 100, written: 0, sealed: false, t: 0, fade: 0, lines: null, title: '' };
  function lines(c) {
    if (!s.lines) {
      const sum = summary(c.stars);
      const n = c.stars.length;
      s.title = (was ? 'entry ' + was.entry + ', ' : '') + entryTitle(c.stars);
      const all = [
        opener + ' ' + s.title,
        n + (n === 1 ? ' star' : ' stars') + ', centred at ' + sum.cx.toFixed(0) + ' / ' + sum.cy.toFixed(0) + ', ' + spreadWord(sum.spread) + '.',
        middle,
        closer
      ];
      s.lines = count === 4 ? all : [all[0], all[1], all[3]];
    }
    return s.lines;
  }
  function draw(c) {
    const fr = frameOf(c);
    const { w, h, split, m } = fr;
    const ink = c.colors[s.ink] || c.colors.accent;
    const f = s.fade;
    const r = fr.unit * 0.075;
    const sx = w - m - r * 1.1;
    const sy = split + (h - split) * 0.6;
    sky(c.g, w, split, skyTint(c, 'midnight'));
    let pts = placed(c, split, m * 0.6, s.drift, s.t);
    const reach = Math.min(w, split) * 0.27 * (1 - f * 0.8) + 1;
    if (f > 0) {
      // The sky goes dark and the stars stream into the seal: drawn over the page, below, so
      // they can be seen to arrive, with the wax pressed on top of them.
      const k = f * f;
      pts = pts.map((p) => ({ x: p.x + (sx - p.x) * k, y: p.y + (sy - p.y) * k, text: p.text }));
      c.g.fillStyle = 'rgba(0, 0, 0, ' + (f * 0.6).toFixed(3) + ')';
      c.g.fillRect(0, 0, w, split);
    } else {
      links(c.g, pts, c, ink, 'near', reach);
      dots(c.g, pts, c, ink, 1);
    }
    const step = page(c.g, w, h, split, c, ink, m, 5);
    rows(c, fr, step, lines(c).slice(0, s.written), c.alpha(c.colors.fg, 0.85));
    if (f > 0) {
      links(c.g, pts, c, ink, 'near', reach);
      dots(c.g, pts, c, ink, 1 - f * 0.7);
    }
    if (s.sealed) seal(c.g, c, sx, sy, r, 0.5 + f * 0.5);
  }
  return {
    title: was ? 'entry ' + was.entry + ', in ' + (count === 4 ? 'four lines' : 'three lines')
      : count === 4 ? 'four lines in the logbook' : 'a three-line entry',
    brief: 'Choose the ink and how far the sky drifts, write the entry a line at a time, and hold to seal it; the stars go into the wax when you are done.'
      + (was && was.star ? ' It is the entry your card began, from the star that said "' + was.star + '".' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'ink', ask: 'the ink', kind: 'choice', options: inks },
      { id: 'drift', ask: 'time drift', kind: 'range', min: 0, max: 100, step: 1, value: drift0, low: 'still', high: 'wandering' },
      { id: 'write', ask: 'write the entry, a line at a time', kind: 'press', count, label: 'write a line', after: 'ink' },
      { id: 'seal', ask: 'seal it', kind: 'hold', ms: holdMs, label: 'hold to seal', after: 'write' }
    ],
    start(c) {
      lines(c);
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'ink') {
        s.ink = String(value);
        c.status('same stars, different ink');
      }
      if (id === 'drift') setDrift(s, value, c);
      if (id === 'write') {
        const L = lines(c);
        const n = Math.round(Number(value)) || 0;
        s.written = Math.max(0, Math.min(L.length, n));
        c.status(n > L.length ? 'that is the whole entry; the pen is capped' : s.written ? L[s.written - 1] : 'the pen is uncapped');
      }
      if (id === 'seal') {
        s.sealed = true;
        c.status('sealed: ' + s.title);
      }
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (c.done) s.fade = Math.min(1, s.fade + dt * (c.reduced ? 4 : 1.1));
      draw(c);
    },
    end(c) {
      c.status('sealed: ' + s.title + '. the sky is in the wax and the ink is dry; nothing else is kept.');
    }
  };
}

// The stars called back one by one in the order they came, under a watch of the visitor's
// choosing, with a hum under it if they like; the whole constellation lights when all are back.
function replay(env) {
  const was = pressed(env);
  const n = env.stars.length;
  const watches = three(env, WATCHES);
  const batch = Math.ceil(n / env.int(3, 5));
  const need = Math.ceil(n / batch);
  const drift0 = env.int(20, 60);
  const title = env.pick(['replay the birth order', 'the birth order, replayed', n <= 12 ? 'call back all ' + n : 'call them all back']);
  const s = { watch: 'midnight', drift: drift0 / 100, back: 0, hum: false, t: 0, gap: 0, beat: 0, pulses: [], ring: 0, fade: 0, title: '' };
  function label(v) {
    const w = WATCHES.find((o) => o.value === v);
    return w ? w.label : v;
  }
  function draw(c) {
    const fr = frameOf(c);
    const { w, h, split, m, unit } = fr;
    const ink = c.colors.accent;
    const gold = c.colors.accent2;
    const f = s.fade;
    sky(c.g, w, split, skyTint(c, s.watch));
    const all = placed(c, split, m * 0.6, s.drift * (1 - f), s.t);
    const pts = all.slice(0, s.back);
    links(c.g, pts, c, ink, 'path', 0);
    if (f > 0) links(c.g, pts, c, gold, 'near', Math.min(w, split) * 0.5 * f);
    dots(c.g, pts, c, ink, 1 + f * 0.3);
    if (s.ring > 0 && pts.length) {
      const p = pts[pts.length - 1];
      ring(c.g, p.x, p.y, unit * 0.02 + (1 - s.ring) * unit * 0.08, c.alpha(gold, s.ring * 0.8), 1.5);
    }
    // The next to come back waits with a ring around it, as it did on the old page.
    if (s.back < n) ring(c.g, all[s.back].x, all[s.back].y, unit * 0.028 + Math.sin(s.t * 8) * unit * 0.007, c.alpha(gold, 0.82), 1.6);
    for (const p of s.pulses) {
      if (p.age < 0 || !all[p.i]) continue;
      const age = c.reduced ? 0.4 : p.age;
      ring(c.g, all[p.i].x, all[p.i].y, (0.1 + age) * p.size * unit * 0.12, c.alpha(gold, (1 - p.age / 1.4) * 0.45), 1);
    }
    if (f > 0) {
      c.g.fillStyle = c.alpha(gold, f * 0.08);
      c.g.fillRect(0, 0, w, split);
    }
    const step = page(c.g, w, h, split, c, ink, m, 5);
    const texts = c.stars.slice(0, s.back).map((st) => st.text || '');
    const shown = f > 0 ? [OPENERS[s.watch] + ' ' + s.title].concat(texts.slice(-4)) : texts.slice(-5);
    rows(c, fr, step, shown, (i) => (f > 0 && i === 0 ? c.alpha(gold, 0.95) : c.alpha(c.colors.fg, 0.85)));
  }
  return {
    title: was ? title + ', from entry ' + was.entry : title,
    brief: 'Pick the watch, set the drift, let the sky hum if you like, and tap it to call each thought back in the order it came; the whole constellation lights when they are all back.'
      + (was && was.star ? ' Your card stopped at the one that said "' + was.star + '".' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'watch', ask: 'which watch to log it under', kind: 'choice', options: watches },
      { id: 'drift', ask: 'time drift', kind: 'range', min: 0, max: 100, step: 1, value: drift0, low: 'still', high: 'wandering' },
      { id: 'hum', ask: 'a hum under it', kind: 'toggle', label: 'let it hum' },
      { id: 'back', ask: need === n ? 'tap the sky once for each thought' : 'tap the sky ' + need + ' times', kind: 'tap', label: 'call one back for me', after: 'watch' }
    ],
    start(c) {
      s.title = entryTitle(c.stars);
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'watch') {
        s.watch = String(value);
        c.status('logged ' + label(s.watch));
      }
      if (id === 'drift') setDrift(s, value, c);
      if (id === 'hum') {
        s.hum = !!value;
        s.gap = 0;
        if (!s.hum) s.pulses = [];
        c.status(s.hum ? 'the constellation is humming' : 'the observatory is quiet again');
      }
    },
    tap(x, y, c) {
      if (s.back >= n || c.done) return;
      s.back = Math.min(n, s.back + batch);
      s.ring = 1;
      c.progress('back', s.back / n);
      c.status(s.back >= n ? 'all ' + n + ' back in the sky' : 'latest thought: ' + (c.stars[s.back - 1].text || ''));
      if (s.back >= n) c.satisfy('back');
    },
    frame(t, dt, c) {
      if (!c.reduced) s.t += dt;
      if (s.hum) {
        s.gap -= dt;
        if (s.gap <= 0) {
          // A chord of three from the stars that are back (from the whole sky, where they will be,
          // until the first are), highest first, as the old ambience went.
          s.gap = 1.25 + s.drift * 0.9;
          const k = s.back || n;
          const order = c.stars.slice(0, k).map((st, i) => i).sort((a, b) => c.stars[a].y - c.stars[b].y);
          s.pulses.push(
            { i: order[s.beat % k], age: 0, size: 1 },
            { i: order[(s.beat * 2 + 3) % k], age: -0.09, size: 0.6 },
            { i: order[(s.beat * 3 + 1) % k], age: -0.16, size: 1.4 }
          );
          s.beat += 1;
        }
      }
      for (const p of s.pulses) p.age += dt;
      s.pulses = s.pulses.filter((p) => p.age < 1.4);
      s.ring = Math.max(0, s.ring - dt * 1.5);
      if (c.done) s.fade = Math.min(1, s.fade + dt * (c.reduced ? 4 : 1.2));
      draw(c);
    },
    end(c) {
      c.status('all ' + n + ' back, in the order they came, and written up ' + label(s.watch) + ' as "' + s.title + '"');
    }
  };
}

export default {
  id: 'constellation-diary',
  needsSky: true,
  paint(ctx, w, h, env) {
    logbook(ctx, w, h, env);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    const other = nearest(env.stars, star);
    const relation = other ? 'nearest the one that said "' + other.text + '"' : 'alone in the whole sky';
    const number = env.hash(star.text + star.x) % 400 + 1;
    return {
      title: 'entry ' + number,
      quote: 'The star that said "' + star.text + '" sits ' + where(star) + ', ' + relation + '.',
      text: 'Written from where it sits. Move it in your persona and the entry changes.',
      aspect: '4 / 3',
      paint: logbook,
      // What this card is of, for the piece it opens as: its number, and the star it was written from.
      of: { entry: number, star: star.text }
    };
  },
  piece(env) {
    if (!env.stars || !env.stars.length) return null;
    return env.chance(0.5) ? entry(env) : replay(env);
  }
};
