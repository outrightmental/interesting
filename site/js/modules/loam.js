/* Loam: a cutaway of soil with roots finding their way round the stones. As a card it is one of
   the two puzzles below (paint, spark); as a piece it is that puzzle, and the card it was opened
   from says which. See js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction, read off a drawing to scale:

     the core   A core cut from the bed and drawn to scale: four to six layers, each with its
                thickness in centimetres written beside it, one of them a band of stones, and a
                wavy line at a layer boundary where the water stands. Read how deep the water
                table is (the layers above it, added up) and how many layers a root passes
                through before it meets the stones. A wrong check says deeper or shallower,
                sooner or later, and no more; solved, a root goes down and the water rises to
                its line.
     the mix    Two bags of soil with their sand shares written on, and a bed that wants a share
                between them. Mixing a parts of A with 10 - a parts of B gives the mean of the
                two shares, weighted by the parts. Find a (the bed's share is chosen so a is a
                whole number) and say whether the blend drains faster or slower than bag A: a
                sandier soil drains faster. A wrong check says sandier or less sandy than the
                bed wants, and no more.

   A card and the feature it opens as are one bed: the spark puts the whole plan on its spec as
   `of` -- the layers, the band and the water line, or the two bags and the bed -- and piece(env)
   opens on that rather than rolling another. */

const PLAIN = { density: 1, scale: 1, turn: 0 };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const KINDS = ['topsoil', 'loam', 'silt', 'clay', 'sand', 'peat'];
const LINES = [
  'The interesting part was always underground.',
  'Roots take the path of least resistance, so the stones matter.',
  'Planted over gravel, so it went sideways for a while first.',
  'Water finds its level, and then it stays there.'
];
const DRAINS = [
  { label: 'drains faster than A', value: 'faster' },
  { label: 'drains slower than A', value: 'slower' }
];

/* ---- shared drawing ------------------------------------------------------------------------ */

function font(g, size, weight) {
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
}

function write(g, text, x, y, size, tone, align, weight) {
  font(g, size, weight);
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = tone;
  g.fillText(text, x, y);
}

// The ground and the dark above it, as the old cutaway laid them.
function sky(g, w, h, env, top, lift) {
  const c = env.colors;
  g.fillStyle = env.mix(c.bg, c.bg2, 0.25);
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,' + (0.35 - (lift || 0) * 0.2).toFixed(3) + ')';
  g.fillRect(0, 0, w, top);
  g.strokeStyle = env.alpha(c.accent2, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(w, top);
  g.stroke();
}

// The tone of a soil by its sand share: dark loam at none, pale grit at all of it.
function soilTone(env, share) {
  const c = env.colors;
  return env.mix(env.mix(c.bg2, c.accent2, 0.35), env.mix(c.fg, c.accent2, 0.45), share / 100);
}

// Grit, as flecks, laid by a fixed sequence so it never shimmers from frame to frame.
function flecks(g, env, x, y, w, h, count, salt, a) {
  g.fillStyle = env.alpha(env.colors.accent, a);
  for (let i = 0; i < count; i++) {
    const fx = x + ((i * 0.6180339 + salt * 0.37) % 1) * w;
    const fy = y + ((i * 0.7548777 + salt * 0.19) % 1) * h;
    g.fillRect(fx, fy, 1.5, 1.5);
  }
}

function stone(g, env, x, y, r, tilt, a) {
  g.fillStyle = env.alpha(env.colors.muted, a);
  g.beginPath();
  g.ellipse(x, y, r * 1.3, r * 0.8, tilt, 0, Math.PI * 2);
  g.fill();
}

/* ---- the core: layers, a band of stones, a water line -------------------------------------- */

function corePlan(env) {
  const n = env.int(4, 6);
  const layers = [];
  const kinds = [];
  for (let i = 0; i < n; i++) {
    layers.push(env.int(6, 28));
    kinds.push(i === 0 ? 0 : env.int(1, KINDS.length - 1));
  }
  return { kind: 'core', layers, kinds, band: env.int(1, n - 2), water: env.int(1, n - 1) };
}

function carriedCore(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'core' || !Array.isArray(p.layers) || !Array.isArray(p.kinds)) return null;
  const n = p.layers.length;
  if (n < 4 || n > 6 || p.kinds.length !== n) return null;
  const layers = p.layers.map(Number);
  const kinds = p.kinds.map(Number);
  if (!layers.every((t) => Number.isInteger(t) && t >= 3 && t <= 40)) return null;
  if (!kinds.every((k) => Number.isInteger(k) && k >= 0 && k < KINDS.length)) return null;
  const band = Number(p.band);
  const water = Number(p.water);
  if (!Number.isInteger(band) || band < 1 || band > n - 2) return null;
  if (!Number.isInteger(water) || water < 1 || water > n - 1) return null;
  return { kind: 'core', layers, kinds, band, water };
}

function totalOf(plan) {
  return plan.layers.reduce((sum, t) => sum + t, 0);
}

function waterDepth(plan) {
  let depth = 0;
  for (let i = 0; i < plan.water; i++) depth += plan.layers[i];
  return depth;
}

function coreTitle(plan) {
  return 'the core: ' + WORDS[plan.layers.length] + ' layers';
}

function coreGeometry(w, h, plan) {
  const top = h * 0.12;
  const bottom = h * 0.9;
  return { top, bottom, left: w * 0.24, right: w * 0.76, scale: (bottom - top) / totalOf(plan) };
}

function layerTone(env, k) {
  const c = env.colors;
  switch (k) {
    case 0: return env.mix(c.bg2, c.accent2, 0.3);
    case 1: return env.mix(env.mix(c.bg2, c.accent2, 0.2), c.bg, 0.25);
    case 2: return env.mix(c.bg2, c.muted, 0.3);
    case 3: return env.mix(c.bg2, c.accent, 0.22);
    case 4: return env.mix(c.bg2, c.fg, 0.3);
    default: return env.mix(c.bg, c.bg2, 0.6);
  }
}

function drawCore(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = coreGeometry(w, h, plan);
  const m = Math.min(w, h);
  const size = Math.max(10, Math.min(14, Math.round(m * 0.036)));
  const small = Math.max(9, size - 2);
  sky(g, w, h, env, geo.top, s.lift);
  write(g, 'surface', w * 0.5, geo.top - size * 0.9, small, env.alpha(c.muted, 0.9));
  const colW = geo.right - geo.left;
  let y = geo.top;
  const depth = waterDepth(plan);
  plan.layers.forEach((t, i) => {
    const lh = t * geo.scale;
    const stones = i === plan.band;
    g.fillStyle = stones ? env.mix(c.bg, c.bg2, 0.5) : layerTone(env, plan.kinds[i]);
    g.fillRect(geo.left, y, colW, lh);
    flecks(g, env, geo.left, y, colW, lh, Math.round((8 + t * 1.4) * v.density), i, 0.14);
    if (stones) {
      const count = Math.max(4, Math.round((5 + colW / 24) * v.density));
      for (let j = 0; j < count; j++) {
        const sx = geo.left + colW * 0.06 + ((j * 0.6180339 + 0.11) % 1) * colW * 0.88;
        const sy = y + lh * 0.2 + ((j * 0.7548777 + 0.41) % 1) * lh * 0.6;
        stone(g, env, sx, sy, Math.min(lh * 0.3, m * (0.012 + ((j * 0.37) % 1) * 0.02) * v.scale), ((j * 0.53) % 1) * 0.8 - 0.4, 0.5);
      }
    }
    g.strokeStyle = env.alpha(c.bg, 0.6);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(geo.left, y + lh);
    g.lineTo(geo.right, y + lh);
    g.stroke();
    // Its name to the left, its thickness to the right.
    write(g, stones ? 'stones' : KINDS[plan.kinds[i]], geo.left - size * 0.6, y + lh / 2, small, stones ? c.accent2 : env.alpha(c.fg, 0.85), 'right');
    write(g, t + ' cm', geo.right + size * 0.6, y + lh / 2, small, env.alpha(c.fg, 0.95), 'left');
    y += lh;
  });
  // The water, risen to its line at the finale.
  const wy = geo.top + depth * geo.scale;
  if (s.fill > 0) {
    const from = geo.bottom - (geo.bottom - wy) * s.fill;
    g.fillStyle = env.alpha(c.accent, 0.28);
    g.fillRect(geo.left, from, colW, geo.bottom - from);
  }
  // The water line, wavy, at a layer boundary.
  g.strokeStyle = c.accent;
  g.lineWidth = 2;
  g.beginPath();
  const amp = Math.max(1.5, m * 0.006);
  for (let x = geo.left - size * 0.4; x <= geo.right + size * 0.4; x += 3) {
    const yy = wy + Math.sin((x / m) * 40 + v.turn * Math.PI * 2 + (s.ripple || 0)) * amp;
    if (x === geo.left - size * 0.4) g.moveTo(x, yy);
    else g.lineTo(x, yy);
  }
  g.stroke();
  write(g, 'water', geo.left + colW * 0.5, wy - small * 0.8, small, c.accent);
  // The column's edges.
  g.strokeStyle = env.alpha(c.fg, 0.35);
  g.lineWidth = 1;
  g.strokeRect(geo.left, geo.top, colW, geo.bottom - geo.top);
  // The root, at the finale: down from the surface and round the stones.
  if (s.root && s.grow > 0) {
    const n = Math.max(2, Math.round(s.root.length * s.grow));
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineCap = 'round';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(s.root[0].x, s.root[0].y);
    for (let i = 1; i < n; i++) g.lineTo(s.root[i].x, s.root[i].y);
    g.stroke();
    g.strokeStyle = env.alpha(c.accent2, 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.root[0].x, geo.top);
    g.lineTo(s.root[0].x + 3, geo.top - m * 0.04 * Math.min(1, s.grow * 2));
    g.stroke();
  }
  write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

function corePreview(g, w, h, env, plan) {
  drawCore(g, w, h, env, plan, { fill: 0, grow: 0, lift: 0, root: null, caption: 'how deep is the water? how many layers to the stones?' }, env.variant);
}

function corePiece(env, plan) {
  const n = plan.layers.length;
  const total = totalOf(plan);
  const depth = waterDepth(plan);
  const s = { fill: 0, grow: 0, lift: 0, root: null, ripple: 0, caption: 'drawn to scale; the thicknesses are written' };
  const draw = (c) => drawCore(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: coreTitle(plan),
    brief: 'A core from the bed, drawn to scale: ' + WORDS[n] + ' layers, each with its thickness in centimetres written beside it. One layer is a band of stones. The wavy line is where the water stands. The band is a layer of its own and is not one a root passes through.',
    goal: 'Read how deep the water table stands and how many layers a root passes through before it meets the stones.',
    aspect: '4 / 5',
    checkLabel: 'read the core',
    steps: [
      { id: 'water', ask: 'the water table, below the surface', kind: 'number', min: 0, max: total, step: 1, unit: 'cm' },
      { id: 'layers', ask: 'layers a root passes through before the stones', kind: 'number', min: 0, max: n, step: 1, unit: 'layers' }
    ],
    solution: { water: depth, layers: plan.band },
    check(c) {
      const water = Math.round(Number(c.value('water')));
      const layers = Math.round(Number(c.value('layers')));
      const waterRight = water === depth;
      const layersRight = layers === plan.band;
      if (waterRight && layersRight) {
        return { solved: true, say: 'the core reads true: water at ' + depth + ' cm, stones under ' + WORDS[plan.band] + ' layer' + (plan.band === 1 ? '' : 's') };
      }
      const parts = [];
      if (!waterRight) parts.push(water < depth ? 'the water stands deeper than that' : 'the water stands shallower than that');
      else parts.push('the water is read right');
      if (!layersRight) parts.push(layers < plan.band ? 'a root goes through more layers than that before the stones' : 'a root meets the stones sooner than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status(LINES[0]);
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'water') c.status('water at ' + Math.round(Number(value)) + ' cm, you say');
      if (id === 'layers') c.status(Math.round(Number(value)) + ' layers to the stones, you say');
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) {
        s.fill = Math.min(1, s.fill + dt * 0.5);
        s.grow = Math.min(1, s.grow + dt * 0.35);
        s.lift = Math.min(1, s.lift + dt * 0.5);
        if (!c.reduced) s.ripple += dt * 2;
      }
      draw(c);
    },
    end(c) {
      // The root: down to the band, then sideways along it, because that is what roots do.
      const geo = coreGeometry(c.w, c.h, plan);
      let bandTop = geo.top;
      for (let i = 0; i < plan.band; i++) bandTop += plan.layers[i] * geo.scale;
      const path = [];
      let x = c.w * (0.42 + c.rnd() * 0.16);
      let y = geo.top;
      const step = Math.max(3, geo.scale * 2);
      while (y < bandTop - step) {
        path.push({ x, y });
        x += (c.rnd() - 0.5) * step * 1.2;
        y += step * (0.7 + c.rnd() * 0.6);
      }
      const drift = x < c.w / 2 ? -1 : 1;
      for (let i = 0; i < 14; i++) {
        path.push({ x, y });
        x += drift * step * (0.8 + c.rnd() * 0.6);
        y += (c.rnd() - 0.3) * step * 0.5;
        if (x < geo.left + 4 || x > geo.right - 4) break;
      }
      s.root = path;
      s.caption = 'water at ' + depth + ' cm; the root went sideways at the stones';
      c.status('Read right. The root meets the stones and goes sideways for a while first. ' + LINES[1]);
    }
  };
}

/* ---- the mix: two bags and a bed ----------------------------------------------------------- */

function shareOf(a, b, parts) {
  return (parts * a + (10 - parts) * b) / 10;
}

function mixPlan(env) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const a = env.int(2, 18) * 5;
    const b = env.int(2, 18) * 5;
    if (Math.abs(a - b) < 30) continue;
    const parts = env.int(1, 9);
    if (!Number.isInteger(shareOf(a, b, parts))) continue;
    return { kind: 'mix', a, b, parts };
  }
  return { kind: 'mix', a: 20, b: 80, parts: 6 };
}

function carriedMix(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'mix') return null;
  const a = Number(p.a);
  const b = Number(p.b);
  const parts = Number(p.parts);
  if (![a, b, parts].every(Number.isInteger)) return null;
  if (a < 5 || a > 95 || b < 5 || b > 95 || Math.abs(a - b) < 20) return null;
  if (parts < 1 || parts > 9 || !Number.isInteger(shareOf(a, b, parts))) return null;
  return { kind: 'mix', a, b, parts };
}

function mixTitle(plan) {
  return 'the mix: ' + plan.a + ' and ' + plan.b + ' per cent sand';
}

function bag(g, env, x, y, r, share, name, tilt, density, size) {
  const c = env.colors;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = soilTone(env, share);
  g.beginPath();
  g.roundRect(-r, -r * 0.8, r * 2, r * 1.7, r * 0.3);
  g.fill();
  flecks(g, env, -r * 0.9, -r * 0.7, r * 1.8, r * 1.5, Math.round((6 + share * 0.5) * density), share, 0.35);
  g.strokeStyle = env.alpha(c.fg, 0.45);
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(-r, -r * 0.8, r * 2, r * 1.7, r * 0.3);
  g.stroke();
  // The tied neck.
  g.fillStyle = env.alpha(c.muted, 0.6);
  g.beginPath();
  g.ellipse(0, -r * 0.82, r * 0.45, r * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  write(g, name, 0, 0, Math.round(r * 0.8), c.bg, 'center', '600');
  g.restore();
  write(g, share + '% sand', x, y + r * 1.15 + size * 0.8, size, env.alpha(c.fg, 0.95));
}

function drawMix(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const m = Math.min(w, h);
  const size = Math.max(10, Math.min(14, Math.round(m * 0.036)));
  const small = Math.max(9, size - 2);
  const target = shareOf(plan.a, plan.b, plan.parts);
  sky(g, w, h, env, h * 0.62, s.lift);
  const r = m * 0.13 * Math.min(1.1, Math.max(0.9, v.scale));
  const tilt = (v.turn - 0.5) * 0.12;
  bag(g, env, w * 0.27, h * 0.17, r, plan.a, 'A', tilt, v.density, small);
  bag(g, env, w * 0.73, h * 0.17, r, plan.b, 'B', -tilt, v.density, small);
  write(g, 'a parts of A with 10 - a parts of B', w / 2, h * 0.38, small, env.alpha(c.muted, 0.95));
  // Ten cups, the first `parts` of them from bag A.
  const cupW = (w * 0.76) / 10;
  const cupH = m * 0.05;
  const cy = h * 0.45;
  for (let i = 0; i < 10; i++) {
    const x = w * 0.12 + i * cupW;
    const fromA = s.parts != null && i < s.parts;
    g.fillStyle = s.parts == null ? env.alpha(c.muted, 0.12) : soilTone(env, fromA ? plan.a : plan.b);
    g.fillRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    g.strokeStyle = env.alpha(c.fg, 0.4);
    g.lineWidth = 1;
    g.strokeRect(x + cupW * 0.08, cy, cupW * 0.84, cupH);
    if (s.parts != null) write(g, fromA ? 'A' : 'B', x + cupW / 2, cy + cupH / 2, Math.max(8, Math.round(cupH * 0.55)), c.bg, 'center', '600');
  }
  write(g, s.parts == null ? 'how many of the ten from A?' : 'a = ' + s.parts, w / 2, cy + cupH + small * 1.1, small, env.alpha(c.fg, 0.9));
  // The bed, which wants its share and takes the blend at the finale.
  const bx = w * 0.14;
  const by = h * 0.62;
  const bw = w * 0.72;
  const bh = h * 0.28;
  write(g, 'the bed wants ' + target + '% sand', w / 2, by - small * 1.1, size, c.accent2);
  if (s.blend >= 0) {
    g.fillStyle = soilTone(env, s.blend);
    g.fillRect(bx, by, bw, bh);
    flecks(g, env, bx, by, bw, bh, Math.round((20 + s.blend * 0.8) * v.density), 7, 0.3);
    // The water, draining through it: faster the sandier it is.
    const level = Math.max(0, 1 - s.drained);
    g.fillStyle = env.alpha(c.accent, 0.3);
    g.fillRect(bx, by, bw, bh * 0.5 * level);
  } else {
    g.fillStyle = env.mix(c.bg, c.bg2, 0.6);
    g.fillRect(bx, by, bw, bh);
    flecks(g, env, bx, by, bw, bh, Math.round(16 * v.density), 7, 0.12);
    write(g, '?', w / 2, by + bh / 2, size * 2, env.alpha(c.muted, 0.5), 'center', '600');
  }
  g.strokeStyle = env.alpha(c.fg, 0.4);
  g.lineWidth = 1;
  g.strokeRect(bx, by, bw, bh);
  write(g, s.caption, w / 2, h * 0.955, small, env.alpha(c.muted, 0.9));
}

function mixPreview(g, w, h, env, plan) {
  const v = env.variant || PLAIN;
  drawMix(g, w, h, env, plan, { parts: Math.round(v.turn * 10), blend: -1, drained: 0, lift: 0, caption: 'a sandier soil drains faster' }, v);
}

function mixPiece(env, plan) {
  const target = shareOf(plan.a, plan.b, plan.parts);
  const drains = plan.b > plan.a ? 'faster' : 'slower';
  const s = { parts: null, blend: -1, drained: 0, lift: 0, caption: 'a sandier soil drains faster' };
  const draw = (c) => drawMix(c.g, c.w, c.h, c, plan, s, env.variant);
  return {
    title: mixTitle(plan),
    brief: 'Two bags of soil. Bag A is ' + plan.a + '% sand and bag B is ' + plan.b + '%; the bed wants ' + target + '%. Mixing a parts of A with 10 - a parts of B makes a soil whose sand share is the two shares averaged, weighted by the parts. A sandier soil drains faster.',
    goal: 'Find the parts of A in ten that give the bed the share it wants, and say whether that blend drains faster or slower than bag A.',
    aspect: '4 / 5',
    checkLabel: 'mix it',
    steps: [
      { id: 'parts', ask: 'parts of A, in ten', kind: 'number', min: 0, max: 10, step: 1, unit: 'of 10' },
      { id: 'drains', ask: 'against bag A, the blend', kind: 'choice', options: DRAINS }
    ],
    solution: { parts: plan.parts, drains },
    check(c) {
      const p = Math.round(Number(c.value('parts')));
      const partsRight = p === plan.parts;
      const drainsRight = c.value('drains') === drains;
      if (partsRight && drainsRight) {
        return { solved: true, say: 'a = ' + plan.parts + ': the blend is ' + target + '% sand, and it drains ' + drains + ' than bag A' };
      }
      const share = shareOf(plan.a, plan.b, Math.max(0, Math.min(10, p)));
      const parts = [];
      if (!partsRight) parts.push(share > target ? 'that blend is sandier than the bed wants' : 'that blend is less sandy than the bed wants');
      else parts.push('the parts are right');
      if (!drainsRight) parts.push('it drains the other way from what you said');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('bag A is ' + plan.a + '% sand, bag B is ' + plan.b + '%; the bed wants ' + target + '%');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'parts') {
        const p = Math.round(Number(value));
        s.parts = Number.isFinite(p) ? Math.max(0, Math.min(10, p)) : 0;
        c.status(s.parts + ' of the ten from bag A, ' + (10 - s.parts) + ' from bag B');
      }
      if (id === 'drains') c.status('you say it drains ' + value + ' than bag A');
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) {
        s.lift = Math.min(1, s.lift + dt * 0.5);
        // The water goes through in about four seconds at pure sand, slower the less sand there is.
        s.drained = Math.min(1, s.drained + dt * (0.08 + target / 100 * 0.22) * (c.reduced ? 3 : 1));
      }
      draw(c);
    },
    end(c) {
      s.blend = target;
      s.parts = s.parts == null ? plan.parts : s.parts;
      s.caption = target + '% sand: it drains ' + drains + ' than bag A';
      c.status('Mixed and watered. ' + LINES[3]);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function deal(env) {
  return env.chance(0.5) ? corePlan(env) : mixPlan(env);
}

export default {
  id: 'loam',
  needsSky: false,
  paint(g, w, h, env) {
    const plan = deal(env);
    if (plan.kind === 'core') corePreview(g, w, h, env, plan);
    else mixPreview(g, w, h, env, plan);
  },
  spark(env) {
    const plan = deal(env);
    if (plan.kind === 'core') {
      return {
        title: coreTitle(plan),
        mono: plan.layers.map((t, i) => (i === plan.band ? 'stones' : KINDS[plan.kinds[i]]).padEnd(8) + ' ' + t + ' cm').join('\n'),
        text: 'Drawn to scale. Read how deep the water stands, and how many layers a root passes through before the stones.',
        aspect: '4 / 5',
        paint: (g, w, h, cardEnv) => corePreview(g, w, h, cardEnv, plan),
        of: plan
      };
    }
    const target = shareOf(plan.a, plan.b, plan.parts);
    return {
      title: mixTitle(plan),
      mono: 'bag A    ' + plan.a + '% sand\nbag B    ' + plan.b + '% sand\nthe bed  ' + target + '%',
      text: 'Mix a parts of A with 10 - a parts of B. Find a, and say whether the blend drains faster or slower than A.',
      aspect: '4 / 5',
      paint: (g, w, h, cardEnv) => mixPreview(g, w, h, cardEnv, plan),
      of: plan
    };
  },
  piece(env) {
    const core = carriedCore(env);
    if (core) return corePiece(env, core);
    const mix = carriedMix(env);
    if (mix) return mixPiece(env, mix);
    const plan = deal(env);
    return plan.kind === 'core' ? corePiece(env, plan) : mixPiece(env, plan);
  }
};
