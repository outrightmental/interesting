/* Loam: a cutaway of soil with roots finding their way round the stones. As a card it is the
   cutaway and a core sample (paint, spark); as a piece it is a bed to plant, water and watch until
   the shoots come up, or a bed with things in it already, turned over and cored. See js/feed.js
   for what a module is and js/stage.js for what a piece is. */

const LINES = [
  'Planted over gravel, so it went sideways for a while first.',
  'The interesting part was always underground.',
  'Roots take the path of least resistance, so the stones matter.',
  'Water it and the roots hurry; turn the soil and they start again.'
];

const NAMES = ['vetch', 'comfrey', 'chicory', 'yarrow', 'burdock', 'sorrel', 'tansy', 'mallow',
  'plantain', 'fescue', 'clover', 'dock'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const TILTHS = [
  { label: 'heavy, slow to drain', value: 12 },
  { label: 'balanced loam', value: 45 },
  { label: 'gritty, drains fast', value: 85 }
];
const TILTH_SAID = {
  12: 'Heavy, slow to drain. Few stones, and the roots take their time.',
  45: 'Balanced loam. The textbook stuff.',
  85: 'Gritty, drains fast. Stones everywhere, so the roots go round.'
};
const TURNED = [
  'Turned over. Everything that was down there is down there differently now.',
  'Turned again. The stones have moved; the roots start from nothing, which they do not mind.',
  'Turned a third time. The soil is getting used to it.'
];

/* ---- the card ------------------------------------------------------------------------------ */

function soil(ctx, w, h, env) {
  const c = env.colors;
  const top = h * (0.12 + env.rnd() * 0.08);
  ctx.fillStyle = env.mix(c.bg, c.bg2, 0.25);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = env.mix(c.bg, '#000', 0.35);
  ctx.fillRect(0, 0, w, top);
  // Grit, as flecks.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = env.alpha(c.accent, 0.05 + env.rnd() * 0.12);
    ctx.fillRect(env.rnd() * w, top + env.rnd() * (h - top), 1.5, 1.5);
  }
  // Stones.
  const stones = [];
  const count = env.int(4, 9);
  for (let i = 0; i < count; i++) {
    const s = { x: env.rnd() * w, y: top + h * 0.1 + env.rnd() * (h - top - h * 0.2), r: 4 + env.rnd() * Math.min(w, h) * 0.06 };
    stones.push(s);
    ctx.fillStyle = env.alpha(c.muted, 0.2);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r * 1.3, s.r * 0.8, env.rnd() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roots: wandering walks down from the surface, deflected by the stones, branching now and then.
  const systems = env.int(2, 4);
  ctx.lineCap = 'round';
  for (let s = 0; s < systems; s++) {
    const startX = w * (0.15 + env.rnd() * 0.7);
    const stems = [{ x: startX, y: top, width: 2.2, drift: 0 }];
    let steps = 0;
    while (stems.length && steps < 900) {
      steps++;
      const r = stems[Math.floor(env.rnd() * stems.length)];
      let nx = r.x + (env.rnd() - 0.5) * 4 + r.drift;
      let ny = r.y + 1.5 + env.rnd() * 2.5;
      for (const st of stones) {
        if (Math.hypot(nx - st.x, (ny - st.y) * 1.6) < st.r * 1.3) {
          r.drift = nx < st.x ? -1.4 : 1.4;
          nx = r.x + r.drift * 2;
          ny = r.y + 0.6;
        }
      }
      r.drift *= 0.9;
      ctx.strokeStyle = env.alpha(c.accent2, 0.55 + Math.min(0.4, r.width * 0.15));
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      r.x = nx;
      r.y = ny;
      r.width *= 0.995;
      if (env.rnd() < 0.045 && stems.length < 7 && r.width > 0.7) {
        stems.push({ x: r.x, y: r.y, width: r.width * 0.6, drift: (env.rnd() - 0.5) * 3 });
      }
      if (r.y > h - 4 || r.width < 0.4 || nx < 0 || nx > w) stems.splice(stems.indexOf(r), 1);
    }
    // The shoot above ground.
    ctx.strokeStyle = env.alpha(c.accent2, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, top);
    ctx.lineTo(startX + (env.rnd() - 0.5) * 6, top - 8 - env.rnd() * 10);
    ctx.stroke();
  }
}

/* ---- the bed: a living cutaway the pieces share -------------------------------------------- */

function listNames(env, n) {
  const pool = NAMES.slice();
  const out = [];
  while (out.length < n) out.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return out;
}

function join(names) {
  return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function tilthOf(grit) {
  return grit < 30 ? 'heavy, slow to drain' : grit < 65 ? 'balanced loam' : 'gritty, drains fast';
}

function fresh(grit) {
  return { grit, top: 0, stones: [], flecks: [], roots: [], tips: [], plants: [], moisture: 0.5, deepest: 0,
    said: 0, quiet: 0, flash: 0, splash: 0, rain: false, shoot: 0, dawn: 0, core: 0, coreX: 0, reading: null, t: 0 };
}

// A knob speaking marks the moment, so the soil's own remarks wait until the line has been read.
function say(s, c, text) {
  s.quiet = s.t;
  c.status(text);
}

// Depth in centimetres: the whole cutaway is forty of them.
function cm(s, y, h) {
  return Math.max(0, ((y - s.top) / (h - s.top)) * 40);
}

// More grit, more stones, and smaller ones; heavy clay has a few big ones. The flecks are laid
// once with the stones so the grit does not shimmer from frame to frame.
function layStones(s, w, h, rnd) {
  s.top = h * 0.14;
  const m = Math.min(w, h);
  const count = Math.max(3, Math.round((6 + s.grit * 0.26) * ((w * h) / 256000)));
  s.stones = [];
  for (let i = 0; i < count; i++) {
    s.stones.push({ x: w * 0.02 + rnd() * w * 0.96, y: s.top + h * 0.07 + rnd() * (h - s.top - h * 0.1),
      r: m * (0.012 + rnd() * 0.03) * (1.2 - s.grit / 200), tilt: rnd() * 0.8 - 0.4 });
  }
  s.flecks = [];
  for (let i = 0; i < 140; i++) s.flecks.push({ x: rnd() * w, y: s.top + rnd() * (h - s.top), a: 1 + Math.floor(rnd() * 3) });
}

function blocked(s, x, y) {
  for (const st of s.stones) {
    const dx = x - st.x;
    const dy = (y - st.y) * 1.25;
    if (dx * dx + dy * dy < st.r * st.r) return st;
  }
  return null;
}

function plant(s, x, name) {
  const k = s.plants.length;
  s.plants.push({ name, x, k });
  s.tips.push({ x, y: s.top, lx: x, ly: s.top, angle: Math.PI / 2, width: 3, life: 1, k });
}

// The roots grow: a tip steps, goes round a stone rather than through it (that is the whole
// character of a root), lays a segment every few pixels, thins, and now and then branches, more
// readily in wet soil. Returns the first stone met this frame, if any.
function grow(s, dt, w, h, c) {
  const soilH = h - s.top;
  const speed = soilH * 0.12 * (0.5 + Math.min(1.4, s.moisture)) * (0.7 + s.grit / 160) * (c.reduced ? 0.6 : 1);
  const seg = soilH * 0.012;
  const next = [];
  let hit = null;
  for (const tip of s.tips) {
    if (tip.life <= 0 || tip.width < 0.6 || tip.y > h - 4) continue;
    const step = speed * dt;
    const nx = tip.x + Math.cos(tip.angle) * step;
    const ny = tip.y + Math.sin(tip.angle) * step;
    const stone = blocked(s, nx, ny);
    if (stone) {
      if (blocked(s, tip.x, tip.y)) continue; // a stone laid over it since: that root ends there
      // Round it rather than through it, and the tip keeps its place in `next`: that is how a root
      // planted over gravel goes sideways for a long while before it finds a way down. It ages
      // while it does, so one walled in on every side gives up after half a second instead of
      // standing there alive and still for as long as the piece lasts.
      tip.stuck = (tip.stuck || 0) + 1;
      if (tip.stuck > 30) continue;
      tip.angle += (nx < stone.x ? -1 : 1) * 0.55;
      tip.life -= dt * 0.012;
      hit = hit || stone;
      next.push(tip);
      continue;
    }
    tip.stuck = 0;
    if (nx < 3 || nx > w - 3) tip.angle = Math.PI - tip.angle;
    else if (ny < s.top + 1) tip.angle = Math.PI / 2;
    else {
      tip.x = nx;
      tip.y = ny;
    }
    if (Math.hypot(tip.x - tip.lx, tip.y - tip.ly) >= seg) {
      if (s.roots.length < 4000) s.roots.push({ x1: tip.lx, y1: tip.ly, x2: tip.x, y2: tip.y, w: tip.width, k: tip.k });
      tip.lx = tip.x;
      tip.ly = tip.y;
      if (tip.y > s.deepest) s.deepest = tip.y;
    }
    tip.angle += (c.rnd() - 0.5) * 0.44 + (Math.PI / 2 - tip.angle) * 0.04;
    tip.width -= dt * 0.2;
    tip.life -= dt * 0.012;
    next.push(tip);
    if (tip.width > 1.1 && next.length < 48 && c.rnd() < dt * 1.4 * Math.min(1.4, s.moisture)) {
      next.push({ x: tip.x, y: tip.y, lx: tip.x, ly: tip.y, angle: tip.angle + (c.rnd() - 0.5) * 1.8,
        width: tip.width * 0.64, life: tip.life * 0.8, k: tip.k });
    }
  }
  s.tips = next;
  return hit;
}

// One frame of soil: the water drains (faster through grit), the rain tops it up, the roots grow,
// and the soil says something the first time a root meets a stone and the first time one is ten
// centimetres down, once whatever a knob said has had its moment.
function tick(s, dt, c) {
  dt = Math.min(0.1, dt);
  s.t += dt;
  s.moisture = Math.max(0.12, s.moisture - dt * (0.006 + (s.grit / 100) * 0.02));
  if (s.rain) s.moisture = Math.min(1.6, s.moisture + dt * 0.35);
  const hit = grow(s, dt, c.w, c.h, c);
  s.flash = Math.max(0, s.flash - dt * 2);
  s.splash = Math.max(0, s.splash - dt * 1.2);
  if (c.done || s.t - s.quiet < 2.5) return;
  if (hit && !(s.said & 1)) {
    s.said |= 1;
    say(s, c, 'Met a stone at ' + Math.round(cm(s, hit.y, c.h)) + ' cm and went sideways for a while first. ' + LINES[2]);
  } else if (!(s.said & 2) && cm(s, s.deepest, c.h) >= 10) {
    s.said |= 2;
    say(s, c, 'Ten centimetres down. ' + LINES[1]);
  }
}

function water(s, c) {
  s.moisture = Math.min(1.6, s.moisture + 0.45);
  s.splash = 1;
  const pct = Math.round(s.moisture * 60);
  say(s, c, pct > 90 ? 'Watered again. Field capacity was a while ago; this is a puddle.' : 'Watered. Moisture at ' + pct + ' per cent of field capacity.');
}

function reading(s, h) {
  const d = cm(s, s.deepest, h);
  const verdict = d < 4 ? 'Early. Nothing to judge yet, and nothing wrong with that.'
    : d < 16 ? 'Established. The system is wider than it is deep, which is normal.'
      : 'Deep. Whatever is up top is the smaller half of this.';
  return { d, verdict, lines: ['core sample', 'depth reached  ' + d.toFixed(1) + ' cm', 'living tips  ' + s.tips.length,
    'laid down  ' + s.roots.length + ' segments', 'tilth  ' + tilthOf(s.grit), 'moisture  ' + Math.round(s.moisture * 60) + '%'] };
}

// A core is taken under whichever thing's roots went deepest; the column is drawn up out of the
// ground and its reading printed beside it.
function takeCore(s, c) {
  const again = !!s.reading;
  s.reading = reading(s, c.h);
  let best = s.plants.length ? s.plants[0].x : c.w / 2;
  let deep = -1;
  for (const r of s.roots) {
    if (r.y2 > deep && s.plants[r.k]) {
      deep = r.y2;
      best = s.plants[r.k].x;
    }
  }
  const cw = Math.min(c.w, c.h) * 0.09;
  s.coreX = Math.max(cw, Math.min(c.w - cw, best));
  s.core = 0.001;
  say(s, c, again ? 'Another core. The first hole had already closed.' : 'Core taken. The hole closes itself.');
}

function bed(g, w, h, c, s) {
  const col = c.colors;
  const top = s.top;
  const m = Math.min(w, h);
  const wet = Math.min(1, s.moisture / 1.2);
  g.fillStyle = col.bg;
  g.fillRect(0, 0, w, h);
  // Nothing above the line but dark, and the rain when it rains; it lightens at the finish.
  g.fillStyle = 'rgba(0,0,0,' + (0.35 - Math.max(s.shoot, s.dawn) * 0.22) + ')';
  g.fillRect(0, 0, w, top);
  if (s.rain) {
    g.strokeStyle = c.alpha(col.accent, 0.35);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 60; i++) {
      const x = ((i * 0.618034) % 1) * w;
      const y = ((s.t * (c.reduced ? 40 : 300) + i * 53) % (top + 12)) - 12;
      g.moveTo(x, y);
      g.lineTo(x - m * 0.004, y + m * 0.03);
    }
    g.stroke();
  }
  const ground = g.createLinearGradient(0, top, 0, h);
  ground.addColorStop(0, c.mix(c.mix(col.bg2, col.accent2, 0.2), col.bg, 0.15 + wet * 0.45));
  ground.addColorStop(1, c.mix(col.bg, col.bg2, 0.3));
  g.fillStyle = ground;
  g.fillRect(0, top, w, h - top);
  for (let a = 1; a <= 3; a++) {
    g.fillStyle = c.alpha(col.accent, 0.05 * a);
    for (const f of s.flecks) if (f.a === a) g.fillRect(f.x, f.y, 1.5, 1.5);
  }
  if (s.splash > 0) {
    g.fillStyle = c.alpha(col.accent, s.splash * 0.18);
    g.fillRect(0, top, w, (h - top) * 0.35 * (1.3 - s.splash));
  }
  g.strokeStyle = c.alpha(col.accent2, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(w, top);
  g.stroke();
  g.fillStyle = c.alpha(col.muted, 0.32);
  for (const st of s.stones) {
    g.beginPath();
    g.ellipse(st.x, st.y, st.r * 1.25, st.r * 0.8, st.tilt, 0, Math.PI * 2);
    g.fill();
  }
  // The roots, one path per plant and thickness, so a frame is a few strokes and not thousands.
  g.lineCap = 'round';
  const paths = [];
  for (const r of s.roots) {
    const key = r.k * 4 + (r.w < 0.9 ? 0 : r.w < 1.5 ? 1 : r.w < 2.3 ? 2 : 3);
    (paths[key] || (paths[key] = [])).push(r);
  }
  paths.forEach((list, key) => {
    g.strokeStyle = c.alpha(c.mix(col.accent2, col.accent, ((key >> 2) % 3) * 0.3), 0.55 + wet * 0.35);
    g.lineWidth = [0.7, 1.2, 1.9, 2.8][key % 4];
    g.beginPath();
    for (const r of list) {
      g.moveTo(r.x1, r.y1);
      g.lineTo(r.x2, r.y2);
    }
    g.stroke();
  });
  g.fillStyle = c.alpha(col.fg, 0.7);
  for (const tip of s.tips) {
    g.beginPath();
    g.arc(tip.x, tip.y, 1.2, 0, Math.PI * 2);
    g.fill();
  }
  // A marker at the surface for each thing in the ground; the shoots come up at the finale.
  const size = Math.max(10, Math.round(m * 0.032));
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  const up = 1 - (1 - s.shoot) * (1 - s.shoot);
  const reach = Math.max(m * 0.04, top - size * 1.8); // as tall as the sky allows, the name still above it
  for (const p of s.plants) {
    const stem = m * 0.02 + up * (reach - m * 0.02);
    g.strokeStyle = c.alpha(c.mix(col.accent2, col.accent, 0.3 * up), 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(p.x, top);
    g.lineTo(p.x + Math.sin(p.k) * stem * 0.15, top - stem);
    g.stroke();
    if (up > 0.3) {
      g.fillStyle = c.alpha(c.mix(col.accent, col.accent2, 0.4), 0.9);
      for (const f of [0.55, 0.8]) {
        g.beginPath();
        g.ellipse(p.x + (f > 0.6 ? -1 : 1) * stem * 0.09, top - stem * f, stem * 0.1 * up, stem * 0.04 * up, (f > 0.6 ? -1 : 1) * 0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = c.alpha(col.fg, 0.55 + up * 0.35);
    g.fillText(p.name, Math.max(size * 2.6, Math.min(w - size * 2.6, p.x)), top - stem - size * 0.3);
  }
  if (s.flash > 0) {
    g.fillStyle = c.alpha(col.accent2, s.flash * 0.22);
    g.fillRect(0, top, w, h - top);
  }
  if (s.core > 0) coreSample(g, w, h, c, s);
}

function coreSample(g, w, h, c, s) {
  const col = c.colors;
  const m = Math.min(w, h);
  const lift = 1 - (1 - s.core) * (1 - s.core);
  const cw = m * 0.09;
  const soilH = h - s.top;
  const x = s.coreX;
  const left = x - cw / 2;
  // The hole, closing itself.
  g.fillStyle = 'rgba(0,0,0,' + (0.4 * lift * (1 - lift * 0.5)).toFixed(3) + ')';
  g.fillRect(left, s.top, cw, soilH);
  // The core, drawn up out of the ground with its stones and roots in it.
  const rise = lift * soilH * 0.6;
  const y0 = s.top - rise;
  g.save();
  g.beginPath();
  g.roundRect(left, y0, cw, soilH, cw * 0.25);
  g.clip();
  const grad = g.createLinearGradient(0, y0, 0, y0 + soilH);
  grad.addColorStop(0, c.mix(col.bg2, col.accent2, 0.3));
  grad.addColorStop(0.25, c.mix(col.bg2, col.accent2, 0.12));
  grad.addColorStop(1, col.bg2);
  g.fillStyle = grad;
  g.fillRect(left, y0, cw, soilH);
  g.fillStyle = c.alpha(col.muted, 0.5);
  for (const st of s.stones) {
    if (Math.abs(st.x - x) >= cw / 2 + st.r) continue;
    g.beginPath();
    g.ellipse(st.x, st.y - rise, st.r * 1.25, st.r * 0.8, st.tilt, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = c.alpha(col.accent2, 0.9);
  g.lineWidth = 1.4;
  g.beginPath();
  for (const r of s.roots) {
    if (Math.abs(r.x1 - x) >= cw / 2) continue;
    g.moveTo(r.x1, r.y1 - rise);
    g.lineTo(r.x2, r.y2 - rise);
  }
  g.stroke();
  g.restore();
  g.strokeStyle = c.alpha(col.fg, 0.6 * lift);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(left, y0, cw, soilH, cw * 0.25);
  g.stroke();
  // The reading, printed beside it on whichever side has the room.
  const size = Math.max(11, Math.round(m * 0.034));
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textBaseline = 'top';
  const toRight = x < w / 2;
  g.textAlign = toRight ? 'left' : 'right';
  const tx = toRight ? left + cw + size : left - size;
  g.fillStyle = c.alpha(col.fg, lift);
  s.reading.lines.forEach((line, i) => g.fillText(line, tx, Math.max(size * 0.6, y0) + i * size * 1.35));
}

/* ---- the pieces ------------------------------------------------------------------------------ */

// Sowing: set the grit, put a few named things in the ground, water them, and watch the roots find
// a way down; the shoots come up when they have.
function sow(env) {
  const n = env.int(2, 4);
  const names = listNames(env, n);
  const grit = env.int(15, 75);
  const waters = env.int(2, 4);
  const byName = env.chance(0.5);
  const s = fresh(grit);
  s.since = -1;
  return {
    title: byName ? 'plant ' + join(names) : WORDS[n] + ' things in the ground',
    brief: 'Set the grit, tap the soil to plant ' + join(names) + ', water them, and watch the roots find a way down; the shoots come up when they have.',
    aspect: '4 / 3',
    steps: [
      { id: 'grit', ask: 'the grit', kind: 'range', min: 0, max: 100, step: 1, value: grit, low: 'heavy clay', high: 'gravel' },
      { id: 'plant', ask: 'tap the soil to plant ' + WORDS[n], kind: 'tap', label: 'plant one for me' },
      { id: 'water', ask: 'water it ' + (waters === 2 ? 'twice' : WORDS[waters] + ' times'), kind: 'press', count: waters, label: 'water it' },
      { id: 'settle', ask: 'let the roots find a way down', kind: 'wait', after: 'plant' }
    ],
    start(c) {
      layStones(s, c.w, c.h, c.rnd);
      say(s, c, 'Bare soil, ' + (s.grit < 30 ? 'heavy and slow to drain' : 'well drained') + ', nothing in it yet.');
      bed(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'grit') {
        s.grit = Math.max(0, Math.min(100, Math.round(Number(value)))) || 0;
        layStones(s, c.w, c.h, c.rnd);
        say(s, c, 'Grit at ' + s.grit + '. The stones are somewhere else now.');
      }
      if (id === 'water') water(s, c);
    },
    tap(x, y, c) {
      if (s.plants.length >= n + 3) return;
      const px = Math.max(c.w * 0.04, Math.min(c.w * 0.96, x * c.w));
      const spare = NAMES.filter((x) => !s.plants.some((p) => p.name === x));
      const name = s.plants.length < n ? names[s.plants.length] : c.pick(spare.length ? spare : NAMES);
      plant(s, px, name);
      if (s.plants.length > n) {
        say(s, c, 'Planted ' + name + ' as well. Nobody said stop.');
        return;
      }
      c.progress('plant', s.plants.length / n);
      say(s, c, 'Planted ' + name + ' at ' + Math.round((px / c.w) * 100) + ' across. It will take its time.');
      if (s.plants.length === n) {
        c.satisfy('plant');
        s.since = 0;
      }
    },
    frame(t, dt, c) {
      tick(s, dt, c);
      if (s.since >= 0 && !s.settled) {
        s.since += dt;
        const depth = cm(s, s.deepest, c.h) / 20;
        const p = Math.max(s.since / 12, Math.min(1, depth) * Math.min(1, s.since / 5));
        c.progress('settle', Math.min(1, p));
        if (p >= 1) {
          s.settled = true;
          c.satisfy('settle');
        }
      }
      if (c.done) s.shoot = Math.min(1, s.shoot + dt / 1.2);
      bed(c.g, c.w, c.h, c, s);
    },
    end(c) {
      c.status('The shoots are up. ' + reading(s, c.h).verdict);
    }
  };
}

// Turning: a bed with things in it already, turned over a couple of times so they start again,
// rained on or not, and cored; the reading comes up with the core.
function turnOver(env) {
  const names = listNames(env, env.int(2, 3));
  const turns = env.int(2, 3);
  const holdMs = env.pick([1500, 2000, 2500]);
  const times = turns === 2 ? 'twice' : 'three times';
  const s = fresh(45);
  function replant(c) {
    s.roots = [];
    s.tips = [];
    s.plants = [];
    s.deepest = s.top;
    names.forEach((name, i) => plant(s, c.w * ((i + 0.5) / names.length) + (c.rnd() - 0.5) * c.w * 0.18, name));
  }
  return {
    title: 'turn the soil ' + times,
    brief: 'Pick the tilth, turn ' + join(names) + ' over ' + times + ' and watch them start again, let it rain or not, and hold to take a core sample; the reading comes up with it.',
    aspect: '4 / 3',
    steps: [
      { id: 'tilth', ask: 'the tilth', kind: 'choice', options: TILTHS },
      { id: 'turn', ask: 'turn the soil ' + times, kind: 'press', count: turns, label: 'turn the soil' },
      { id: 'rain', ask: 'let it rain', kind: 'toggle' },
      { id: 'sample', ask: 'take a core sample', kind: 'hold', ms: holdMs, label: 'hold to take a core', after: 'turn' }
    ],
    start(c) {
      layStones(s, c.w, c.h, c.rnd);
      replant(c);
      for (let i = 0; i < 120; i++) grow(s, 1 / 30, c.w, c.h, c);
      s.said = 3;
      const who = join(names);
      say(s, c, who[0].toUpperCase() + who.slice(1) + ' are in this soil already. ' + LINES[3]);
      bed(c.g, c.w, c.h, c, s);
    },
    apply(id, value, c) {
      if (id === 'tilth') {
        s.grit = Number(value) || 45;
        layStones(s, c.w, c.h, c.rnd);
        say(s, c, TILTH_SAID[s.grit] || tilthOf(s.grit));
      }
      if (id === 'turn') {
        layStones(s, c.w, c.h, c.rnd);
        replant(c);
        s.flash = 1;
        s.said = 0;
        say(s, c, TURNED[Math.min(TURNED.length - 1, Number(value) - 1)] || TURNED[0]);
      }
      if (id === 'rain') {
        s.rain = !!value;
        say(s, c, s.rain ? 'Rain. The soil darkens and the roots hurry.' : 'Rain stopped. The soil keeps what it caught, for a while.');
      }
      if (id === 'sample') takeCore(s, c);
    },
    frame(t, dt, c) {
      tick(s, dt, c);
      if (s.core > 0) s.core = Math.min(1, s.core + dt / 1.1);
      if (c.done) s.dawn = Math.min(1, s.dawn + dt / 1.2);
      bed(c.g, c.w, c.h, c, s);
    },
    end(c) {
      c.status('Core taken. ' + (s.reading ? s.reading.verdict : LINES[1]));
    }
  };
}

export default {
  id: 'loam',
  paint(ctx, w, h, env) {
    soil(ctx, w, h, env);
  },
  spark(env) {
    const a = env.int(6, 16);
    const b = a + env.int(10, 24);
    const stone = b + env.int(1, 9);
    const through = stone + env.int(3, 14);
    return {
      title: 'core sample',
      mono: 'topsoil   0–' + a + ' cm\nloam     ' + a + '–' + b + ' cm\nstones   at ' + stone + ' cm\nroots    found a way at ' + through + ' cm',
      text: env.pick(LINES),
      aspect: '4 / 5',
      paint: soil
    };
  },
  piece(env) {
    return env.chance(0.5) ? sow(env) : turnOver(env);
  }
};
