/* The kinetic floor: heavy blocks, a lot of them, nothing breakable. As a card it is a heap of
   blocks and the damage report (paint, spark); as a piece it is a floor to kick into a riot, a
   kicker to wind up and let fly, or a heap to let settle against whichever wall is down. See
   js/feed.js for what a module is and js/stage.js for what a piece is.

   A card and the feature it opens as are one floor: the spark puts the blocks it counted, and which
   way was down, on its spec as `of`, and the piece opens that floor -- the same heap, gravity where
   the card had it. */

// The card this piece was opened from, in the floor's own terms: how many blocks it counted, which
// way was down, and the damage report it printed, or null for a piece nobody pressed (js/stage.js
// hands the card over as env.card.of).
function pressed(env) {
  const was = env.card && env.card.of;
  const blocks = was ? Number(was.blocks) : NaN;
  if (!isFinite(blocks)) return null;
  const read = (value, fallback) => (isFinite(Number(value)) ? Number(value) : fallback);
  return {
    blocks: Math.max(6, Math.min(28, Math.round(blocks))),
    flipped: !!was.flipped,
    impacts: read(was.impacts, 0),
    fastest: read(was.fastest, 60)
  };
}

// The bounce a card's own damage report implies: the floor that recorded the fastest block is the
// springiest one, so a piece opens with its dial where the card's figures put it.
function bounceFrom(was, low, high) {
  const at = Math.round(((was.fastest - 60) / 1340) * 100);
  return Math.max(low, Math.min(high, at));
}

const LINES = [
  'Shove something. Nothing here is fragile.',
  'Flip the gravity and the whole heap thinks again.',
  'Heavy things, a lot of them, nothing breakable.',
  'Kick everything three times without stopping and see what happens.'
];

const STATES = ['all of them idle', 'two still rolling', 'settling', 'one on its edge, deciding', 'in a heap against the wall'];

const WEIGHTS = [
  { label: 'pebbles', value: 0.6 },
  { label: 'bricks', value: 1 },
  { label: 'anvils', value: 1.6 }
];

const DOWNS = [
  { label: 'the floor', value: 'd' },
  { label: 'the ceiling', value: 'u' },
  { label: 'the left wall', value: 'l' },
  { label: 'the right wall', value: 'r' }
];

const DIRS = { d: [0, 1], u: [0, -1], l: [-1, 0], r: [1, 0] };

const SHOVED = ['got one. shoved.', 'that one went.', 'heavy, but it moved.', 'shoved. nothing broke.', 'over it goes.'];

function block(ctx, x, y, bw, bh, angle, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2 + 0.5, -bh / 2 + 0.5, bw - 1, bh - 1);
  }
  ctx.restore();
}

// The card: a still heap of blocks, one of them mid-air because something was just thrown.
function floor(ctx, w, h, env, flipped) {
  const c = env.colors;
  const v = env.variant;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const floorY = flipped ? h * 0.1 : h * 0.9;
  ctx.strokeStyle = env.alpha(c.muted, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(w, floorY + 0.5);
  ctx.stroke();
  const piles = Math.max(2, Math.round(env.int(3, 6) * v.density));
  const slot = w / piles;
  for (let p = 0; p < piles; p++) {
    let level = floorY;
    const count = env.int(1, 4);
    for (let i = 0; i < count; i++) {
      const bw = slot * (0.35 + env.rnd() * 0.5);
      const bh = Math.min(h * 0.26, (14 + env.rnd() * h * 0.16) * v.scale);
      const x = p * slot + (slot - bw) * (0.2 + env.rnd() * 0.6);
      const y = flipped ? level : level - bh;
      const tilt = (env.rnd() - 0.5) * 0.08;
      block(ctx, x + bw / 2, y + bh / 2, bw, bh, tilt, env.alpha(c.accent, 0.22 + env.rnd() * 0.5), env.alpha(c.fg, 0.35));
      level = flipped ? level + bh + 1 : level - bh - 1;
    }
  }
  if (env.chance(0.7)) {
    const bw = slot * 0.4;
    const bh = 12 + env.rnd() * 12;
    block(ctx, w * (0.2 + env.rnd() * 0.6), h * (flipped ? 0.65 : 0.35), bw, bh, env.rnd() * Math.PI, env.alpha(c.accent2, 0.7), null);
  }
}

/* The rig: the live floor a piece plays on. Blocks fall toward whichever wall is down, bounce
   off the walls with the bounce they are given, shoulder each other out of the way, and keep a
   tally of the damage. Everything is in CSS pixels on ctx, scaled by `unit` so a phone and a
   desk feel the same. */
function rig(c) {
  const s = {
    blocks: [], down: 'd', e: 0.75, size: 1, gravity: 1, walls: true,
    impacts: 0, travelled: 0, fastest: 0, riot: false, aim: null, flash: 0, t: 0, fade: 0
  };
  const W = () => c.w || 400;
  const H = () => c.h || 250;
  const unit = () => Math.min(W(), H()) / 360;

  function spawn(n, x, y) {
    for (let i = 0; i < n; i++) {
      const size = (16 + c.rnd() * 26) * unit() * s.size;
      s.blocks.push({
        x: x == null ? size + c.rnd() * Math.max(1, W() - size * 2) : x,
        y: y == null ? size + c.rnd() * Math.max(1, H() * 0.6 - size) : y,
        w: size, h: size * (0.7 + c.rnd() * 0.6),
        vx: x == null ? (c.rnd() - 0.5) * 120 * unit() : 0, vy: 0,
        spin: (c.rnd() - 0.5) * 2.8, angle: c.rnd() * Math.PI, tone: c.rnd()
      });
    }
    if (s.blocks.length > 60) s.blocks.splice(0, s.blocks.length - 60);
  }

  // Heavier blocks are bigger and move less for the same kick.
  function weigh(size) {
    const k = size / s.size;
    s.size = size;
    for (const b of s.blocks) {
      b.w *= k;
      b.h *= k;
    }
  }

  // A kick along `angle` from the direction opposite gravity: 0 is straight up, left is negative.
  function kick(angle, power) {
    const [gx, gy] = DIRS[s.down];
    const u = unit();
    for (const b of s.blocks) {
      const p = power * (0.6 + c.rnd() * 0.6) * u / s.size;
      b.vx += (-gx * Math.cos(angle) + gy * Math.sin(angle)) * p + (c.rnd() - 0.5) * 160 * u;
      b.vy += (-gy * Math.cos(angle) - gx * Math.sin(angle)) * p + (c.rnd() - 0.5) * 60 * u;
      b.spin += (c.rnd() - 0.5) * 8 / s.size;
    }
    s.flash = 1;
  }

  // Everything hops a little against gravity, which is how a new bounce shows itself at once.
  function hop(power) {
    const [gx, gy] = DIRS[s.down];
    const u = unit();
    for (const b of s.blocks) {
      b.vx = -gx * power * u + (c.rnd() - 0.5) * 80 * u;
      b.vy = -gy * power * u + (c.rnd() - 0.5) * 80 * u;
    }
  }

  // The nearest block to a point is flung away from it; with `reach`, only one that close.
  // Returns the block, or null if none.
  function shove(px, py, reach) {
    let best = null;
    let bd = Infinity;
    for (const b of s.blocks) {
      const d = (b.x - px) ** 2 + (b.y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best || (reach && bd > reach * reach)) return null;
    const [gx, gy] = DIRS[s.down];
    const d = Math.sqrt(bd) || 1;
    const u = unit();
    const p = 520 * u / s.size;
    best.vx += ((best.x - px) / d) * p - gx * 200 * u;
    best.vy += ((best.y - py) / d) * p - gy * 200 * u;
    best.spin += (c.rnd() - 0.5) * 10 / s.size;
    s.flash = 0.5;
    return best;
  }

  function step(dt) {
    dt = Math.min(0.04, dt);
    s.t += dt;
    s.flash = Math.max(0, s.flash - dt * 2);
    if (c.done) s.fade = Math.min(1, s.fade + dt * 2.5);
    // The report is a tally, not a ticker: once the piece is finished the numbers stand still.
    const tally = !c.done;
    const u = unit();
    const G = (c.reduced ? 0.35 : 1) * 900 * u * s.gravity;
    const [gx, gy] = DIRS[s.down];
    const bl = s.blocks;
    const w = W();
    const h = H();
    const hit = (b, side, v) => {
      if (tally && v > 30 * u) s.impacts += 1;
      if (side === s.down) {
        if (side === 'd' || side === 'u') b.vx *= 0.94;
        else b.vy *= 0.94;
        b.spin *= 0.9;
      }
    };
    for (const b of bl) {
      b.vx += gx * G * dt;
      b.vy += gy * G * dt;
      b.vx *= 1 - dt * 0.03;
      b.vy *= 1 - dt * 0.03;
      b.spin *= 1 - dt * 0.8;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (tally) {
        s.travelled += speed * dt;
        if (speed > s.fastest) s.fastest = speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      if (!s.walls) continue;
      const hw = b.w / 2;
      const hh = b.h / 2;
      if (b.x < hw) { b.x = hw; hit(b, 'l', -b.vx); b.vx = Math.abs(b.vx) * s.e; }
      if (b.x > w - hw) { b.x = w - hw; hit(b, 'r', b.vx); b.vx = -Math.abs(b.vx) * s.e; }
      if (b.y < hh) { b.y = hh; hit(b, 'u', -b.vy); b.vy = Math.abs(b.vy) * s.e; }
      if (b.y > h - hh) { b.y = h - hh; hit(b, 'd', b.vy); b.vy = -Math.abs(b.vy) * s.e; }
    }
    // Blocks shoulder each other apart, so a heap is a heap and not one spot.
    for (let i = 0; i < bl.length; i++) {
      for (let j = i + 1; j < bl.length; j++) {
        const a = bl[i];
        const b = bl[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r = (a.w + a.h + b.w + b.h) * 0.22;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const push = (r - d) * 0.5;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const k = -vn * (1 + s.e) * 0.5;
          a.vx -= nx * k; a.vy -= ny * k;
          b.vx += nx * k; b.vy += ny * k;
          a.spin += vn * 0.002; b.spin -= vn * 0.002;
          if (tally && -vn > 90 * u) s.impacts += 1;
        }
      }
    }
  }

  function calm() {
    let top = 0;
    for (const b of s.blocks) top = Math.max(top, Math.sqrt(b.vx * b.vx + b.vy * b.vy));
    return top / unit();
  }

  function draw() {
    const g = c.g;
    const col = c.colors;
    const w = W();
    const h = H();
    const u = unit();
    const lit = s.riot ? 0.18 : s.flash * 0.08;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, c.mix(col.bg2, col.accent, lit));
    grad.addColorStop(1, c.mix(col.bg, col.accent, lit * 0.5));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const gap = Math.max(28, w / 16);
    g.strokeStyle = c.alpha(col.accent, s.riot ? 0.3 : 0.12);
    g.lineWidth = 1;
    for (let x = gap; x < w; x += gap) {
      g.beginPath();
      g.moveTo(Math.round(x) + 0.5, 0);
      g.lineTo(Math.round(x) + 0.5, h);
      g.stroke();
    }
    // The wall that is down gets the floor line.
    g.strokeStyle = c.alpha(col.muted, 0.6);
    g.lineWidth = 2;
    g.beginPath();
    if (s.down === 'd') { g.moveTo(0, h - 1); g.lineTo(w, h - 1); }
    else if (s.down === 'u') { g.moveTo(0, 1); g.lineTo(w, 1); }
    else if (s.down === 'l') { g.moveTo(1, 0); g.lineTo(1, h); }
    else { g.moveTo(w - 1, 0); g.lineTo(w - 1, h); }
    g.stroke();
    s.blocks.forEach((b, i) => {
      const tone = s.riot ? (1 + Math.sin(s.t * 4 + i * 0.7 + s.impacts * 0.01)) / 2 : b.tone * 0.5;
      block(g, b.x, b.y, b.w, b.h, b.angle, c.alpha(c.mix(col.accent, col.accent2, tone), s.riot ? 0.92 : 0.62 + b.tone * 0.3), c.alpha(col.fg, 0.4));
    });
    if (s.aim !== null) {
      g.save();
      g.translate(w / 2, h - 10 * u);
      g.rotate(s.aim);
      g.strokeStyle = c.alpha(col.accent2, 0.9);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -36 * u);
      g.moveTo(-7 * u, -28 * u);
      g.lineTo(0, -36 * u);
      g.lineTo(7 * u, -28 * u);
      g.stroke();
      g.restore();
    }
    if (s.fade > 0) report(g, w, h, u, s.fade);
  }

  // The damage report, printed over the floor when a piece is finished.
  function report(g, w, h, u, a) {
    const col = c.colors;
    const lines = [
      'impacts: ' + s.impacts,
      'fastest block: ' + Math.round(s.fastest) + ' px/s',
      'total distance shoved: ' + (s.travelled / 100).toFixed(1) + ' m'
    ];
    const size = Math.max(13, Math.round(Math.min(w, h) * 0.055));
    const small = Math.max(11, Math.round(size * 0.8));
    const pad = size * 1.1;
    const body = '600 ' + size + 'px system-ui, sans-serif';
    // The box is as wide as its longest line, so the numbers never run past its edge on a phone.
    g.font = body;
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, g.measureText(line).width);
    const bw = Math.min(w - 32, Math.max(size * 12, widest + pad * 2));
    const bh = pad * 2 + size * 1.5 * (lines.length + 1);
    g.fillStyle = c.alpha(col.bg, 0.82 * a);
    g.fillRect((w - bw) / 2, (h - bh) / 2, bw, bh);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '500 ' + small + 'px system-ui, sans-serif';
    g.fillStyle = c.alpha(col.muted, a);
    g.fillText(s.riot ? 'the damage report. riot mode.' : 'the damage report', w / 2, (h - bh) / 2 + pad + size * 0.6);
    g.font = body;
    g.fillStyle = c.alpha(col.fg, a);
    lines.forEach((line, i) => g.fillText(line, w / 2, (h - bh) / 2 + pad + size * 1.5 * (i + 1) + size * 0.6));
  }

  return { s, spawn, weigh, kick, hop, shove, step, calm, draw, unit };
}

function setBounce(r, value, c) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  r.s.e = 0.25 + (v / 100) * 0.7;
  r.hop(200 + v * 2.6);
  c.status(v < 15 ? 'bounce ' + v + '. they land like sacks.' : v > 85 ? 'bounce ' + v + '. everything is rubber now.' : 'bounce set to ' + v + '.');
}

function summary(r) {
  return r.s.impacts + ' impacts, fastest block ' + Math.round(r.s.fastest) + ' px/s, ' + (r.s.travelled / 100).toFixed(1) + ' m shoved';
}

// Shape one: the riot. Drop a few, turn the gravity over if you must, kick everything three times
// without stopping, and the floor stops being polite.
function riot(env) {
  const was = pressed(env);
  const kicks = env.chance(0.7) ? 3 : 4;
  const word = kicks === 3 ? 'three' : 'four';
  const drops = env.int(3, 6);
  // The floor the card counted, gravity where the card had it.
  const start = was ? was.blocks : env.int(6, 14);
  const bounce = was ? bounceFrom(was, 35, 90) : env.int(35, 90);
  const title = env.pick(['kick everything ' + word + ' times', word + ' kicks without stopping']);
  let r = null;
  let dropped = 0;
  let streak = 0;
  let lastKick = -10;
  const ready = (c) => {
    if (r) return r;
    r = rig(c);
    r.s.e = 0.25 + (bounce / 100) * 0.7;
    if (was && was.flipped) r.s.down = 'u';
    r.spawn(start);
    return r;
  };
  return {
    title,
    brief: 'Set the bounce, drop ' + drops + ' blocks where you tap, turn the gravity over if you must, and kick everything ' + word + ' times without stopping; nothing here is fragile, and the damage is tallied when the riot is called.'
      + (was ? ' It opens on the ' + start + ' blocks your card counted' + (was.flipped ? ', gravity already over.' : '.') : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'bounce', ask: 'the bounce', kind: 'range', min: 0, max: 100, step: 1, value: bounce, low: 'lead', high: 'rubber' },
      { id: 'drop', ask: 'tap the floor to drop ' + drops + ' blocks', kind: 'tap', label: 'drop one for me' },
      { id: 'flip', ask: 'turn the gravity over', kind: 'toggle', label: 'flip the gravity' },
      { id: 'kick', ask: 'kick everything ' + word + ' times, no stopping', kind: 'press', count: kicks, label: 'kick everything', after: 'drop' }
    ],
    start(c) {
      ready(c).draw();
      c.status(start + ' blocks, all of them idle.' + (c.reduced ? ' the floor runs slow and heavy.' : ''));
    },
    apply(id, value, c) {
      ready(c);
      if (id === 'bounce') setBounce(r, value, c);
      if (id === 'flip') {
        r.s.down = value ? 'u' : 'd';
        c.status(value ? 'gravity is up now. deal with it.' : 'gravity is down again.');
      }
      if (id === 'kick') {
        streak = r.s.t - lastKick < 2.5 ? streak + 1 : 1;
        lastKick = r.s.t;
        r.kick(0, c.reduced ? 360 : 560);
        if (streak >= 3 && !r.s.riot) {
          r.s.riot = true;
          c.status('three in a row. riot mode. nothing here was fragile anyway.');
        } else if (r.s.riot) c.status('riot mode. the floor has stopped being polite.');
        else if (streak === 1 && value > 1) c.status('you stopped. the floor noticed. that counts as one.');
        else c.status(streak === 2 ? 'two in a row. everything is airborne.' : 'kicked. everything is airborne.');
      }
    },
    tap(x, y, c) {
      ready(c);
      const px = x * c.w;
      const py = y * c.h;
      const under = r.shove(px, py, 30 * r.unit());
      r.spawn(1, px, py);
      dropped += 1;
      c.progress('drop', Math.min(1, dropped / drops));
      c.status(under ? 'dropped one on another. it objected.' : dropped < drops ? 'nothing there, so the floor made one.' : r.s.blocks.length + ' blocks on the floor.');
      if (dropped >= drops) c.satisfy('drop');
    },
    frame(t, dt, c) {
      ready(c).step(dt);
      r.draw();
    },
    end(c) {
      ready(c);
      r.s.riot = true;
      r.s.gravity = 0;
      r.kick(0, 700);
      c.status('riot mode. ' + summary(r) + '.');
    }
  };
}

// Shape two: the kicker. Choose the stuff, aim, shove a few by hand, then wind up and let fly.
function kicker(env) {
  const was = pressed(env);
  const shoves = env.int(4, 7);
  const start = was ? was.blocks : env.int(8, 16);
  // The kicker points where the card's impacts were: its own tally, read as an angle.
  const aim = was ? Math.max(-45, Math.min(45, Math.round(was.impacts - 70))) : env.int(-45, 45);
  const ms = env.pick([1200, 1600, 2200]);
  const title = env.pick(['shove ' + shoves + ' blocks, then let fly', shoves + ' shoves, a wind-up and a kicker']);
  let r = null;
  let shoved = 0;
  const ready = (c) => {
    if (r) return r;
    r = rig(c);
    r.s.aim = aim * Math.PI / 180;
    r.spawn(start);
    return r;
  };
  return {
    title,
    brief: 'Choose what the blocks are made of, aim the kicker, shove ' + shoves + ' of them by hand, then hold to wind the kicker up and let go; everything on the floor leaves it.'
      + (was ? ' The ' + start + ' blocks your card counted are already on it.' : ''),
    aspect: '16 / 10',
    steps: [
      { id: 'weight', ask: 'what the blocks are made of', kind: 'choice', options: WEIGHTS },
      { id: 'aim', ask: 'where the kicker points', kind: 'range', min: -60, max: 60, step: 1, value: aim, low: 'left', high: 'right' },
      { id: 'shove', ask: 'shove ' + shoves + ' blocks', kind: 'tap', label: 'shove one for me' },
      { id: 'wind', ask: 'wind up the kicker and let go', kind: 'hold', ms, label: 'hold to wind up', after: 'aim' }
    ],
    start(c) {
      ready(c).draw();
      c.status(start + ' blocks, all of them idle. the kicker is aimed at ' + aim + ' degrees.');
    },
    apply(id, value, c) {
      ready(c);
      if (id === 'weight') {
        const size = Number(value) || 1;
        r.weigh(size);
        r.hop(160);
        c.status(size < 1 ? 'pebbles. they will go anywhere.' : size > 1 ? 'anvils. good luck.' : 'bricks. the honest block.');
      }
      if (id === 'aim') {
        const deg = Math.round(Number(value) || 0);
        r.s.aim = deg * Math.PI / 180;
        c.status('kicker aimed at ' + deg + ' degrees' + (Math.abs(deg) > 50 ? '. that is nearly sideways.' : '.'));
      }
      if (id === 'wind') {
        const held = Math.max(300, Number(value) || ms);
        r.kick(r.s.aim, Math.min(1400, 300 + held * 0.45) * (c.reduced ? 0.6 : 1));
        c.status('wound for ' + (held / 1000).toFixed(1) + ' seconds and let fly. everything is airborne.');
      }
    },
    tap(x, y, c) {
      if (!ready(c).shove(x * c.w, y * c.h)) return;
      shoved += 1;
      c.progress('shove', Math.min(1, shoved / shoves));
      c.status(shoved >= shoves ? shoved + ' shoved. the rest is the kicker\'s problem.' : SHOVED[shoved % SHOVED.length]);
      if (shoved >= shoves) c.satisfy('shove');
    },
    frame(t, dt, c) {
      ready(c).step(dt);
      r.draw();
    },
    end(c) {
      ready(c);
      r.s.walls = false;
      r.s.gravity = 0;
      r.kick(r.s.aim, 900);
      c.status('let fly. ' + r.s.blocks.length + ' blocks off the floor; ' + summary(r) + '.');
    }
  };
}

// Shape three: the heap. Choose which way is down, set the bounce, let it all settle against
// that wall, then sweep.
function heap(env) {
  const was = pressed(env);
  // The heap the card counted, and the wall it was against: a visitor who pressed a heap of
  // nineteen blocks with the gravity over opens exactly that heap.
  const n = was ? was.blocks : env.int(14, 28);
  const skip = env.int(0, 3);
  const options = DOWNS.filter((d, i) => i !== skip);
  if (was && was.flipped) {
    const at = options.findIndex((d) => d.value === 'u');
    if (at >= 0) options.unshift(options.splice(at, 1)[0]);
  }
  const bounce = was ? bounceFrom(was, 20, 80) : env.int(20, 80);
  const title = env.pick(['a heap of ' + n + ' blocks', n + ' blocks and a new down']);
  let r = null;
  let turned = false;
  let since = 0;
  let best = 0;
  let settled = false;
  let said = false;
  const ready = (c) => {
    if (r) return r;
    r = rig(c);
    r.s.e = 0.25 + (bounce / 100) * 0.7;
    if (was && was.flipped) r.s.down = 'u';
    r.spawn(n);
    return r;
  };
  return {
    title,
    brief: 'Choose which way is down and how much the blocks bounce, let all ' + n + ' of them settle into a heap against that wall, then sweep the floor bare.',
    aspect: '16 / 10',
    steps: [
      { id: 'down', ask: 'which way is down', kind: 'choice', options },
      { id: 'bounce', ask: 'the bounce', kind: 'range', min: 0, max: 100, step: 1, value: bounce, low: 'lead', high: 'rubber' },
      { id: 'settle', ask: 'let them settle', kind: 'wait', after: 'down' },
      { id: 'sweep', ask: 'sweep the floor', kind: 'press', count: 1, label: 'sweep', after: 'settle' }
    ],
    start(c) {
      ready(c).draw();
      c.status(n + ' blocks, all of them idle. the floor is down, for now.');
    },
    apply(id, value, c) {
      ready(c);
      if (id === 'down') {
        r.s.down = String(value);
        r.kick(0, 420);
        turned = true;
        since = 0;
        best = 0;
        said = false;
        const name = (options.find((o) => o.value === value) || options[0]).label;
        c.status(value === 'd' ? 'the floor is down. the whole heap thinks again anyway.' : name + ' is down now. deal with it.');
      }
      if (id === 'bounce') setBounce(r, value, c);
      if (id === 'sweep') {
        r.s.walls = false;
        r.s.gravity = 0;
        r.kick(Math.PI / 2, 900);
        c.status('swept. the floor is bare.');
      }
    },
    frame(t, dt, c) {
      ready(c).step(dt);
      if (!settled && turned) {
        since += dt;
        const quiet = Math.max(0, Math.min(1, 1 - (r.calm() - 70) / 500));
        best = Math.max(best, Math.min(1, Math.max(since / 7, since > 1.5 ? quiet : 0)));
        c.progress('settle', best);
        if (best >= 1) {
          settled = true;
          c.satisfy('settle');
          c.status(quiet >= 1 ? 'in a heap against the wall. all of them idle.' : 'near enough a heap. one is still deciding.');
        } else if (!said && quiet < 0.5 && since > 1) {
          said = true;
          c.status('settling. ' + STATES[1] + '.');
        }
      }
      r.draw();
    },
    end(c) {
      ready(c);
      r.s.walls = false;
      r.s.gravity = 0;
      r.kick(Math.PI / 2, 900);
      c.status('swept. ' + summary(r) + '.');
    }
  };
}

function piece(env) {
  if (env.chance(0.4)) return riot(env);
  return env.chance(0.55) ? kicker(env) : heap(env);
}

export default {
  id: 'kinetic-floor',
  paint(ctx, w, h, env) {
    floor(ctx, w, h, env, env.chance(0.25));
  },
  spark(env) {
    const flipped = env.chance(0.3);
    const blocks = env.int(7, 24);
    const impacts = env.int(0, 140);
    const fastest = env.int(60, 1400);
    const metres = (impacts * (0.4 + env.rnd() * 1.2)).toFixed(1);
    return {
      title: blocks + ' blocks, ' + (flipped ? 'gravity turned over' : env.pick(STATES)),
      mono: 'impacts: ' + impacts + '\nfastest block: ' + fastest + ' px/s\ntotal distance shoved: ' + metres + ' m',
      text: env.pick(LINES),
      aspect: '16 / 10',
      paint: (ctx, w, h, e) => floor(ctx, w, h, e, flipped),
      // What this card is of, for the piece it opens as: its heap, which way was down, and the
      // damage report the piece opens its dials on.
      of: { blocks, flipped, impacts, fastest }
    };
  },
  piece
};
