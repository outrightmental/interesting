/* The terrarium: plants under glass, grown from the persona's stars, and two puzzles kept there.
   As a card it is the puzzle the seed deals, drawn small through the glass (paint, spark); as a
   piece it is one of the two puzzles below, and the card it was opened from says which. See
   js/feed.js for what a module is and js/stage.js for what a piece is.

   Two puzzles, both deduction:

     who gets water   Five or six plants in a row, each tagged with one rule -- soil below 3, lamp
                      off, not twice running, if the left one is, vent open and soil below 4 --
                      and the glass shows the readings every rule is judged by: a soil meter under
                      each plant, the lamp, the vent, and a drop beside any plant watered last
                      time. Mark the plants that get water. A wrong check says how many of the
                      right plants are marked and how many marked should stay dry, and no more.
     the oldest stem  Four stems, each tagged with how many leaves it grows in a week, each with
                      its leaves drawn and counted. Age is leaves over rate, and the ages are
                      whole weeks, all different. Put the stems oldest to youngest and say how old
                      the oldest is.

   A card and the feature it opens as are one puzzle: the spark puts the whole plan on its spec as
   `of` -- the rules and readings, or the rates and leaf counts -- and piece(env) opens on that
   rather than rolling another. The sky may be one star or many; it lights the glass, and the plan
   stands whatever the sky is now. */

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const LETTERS = ['A', 'B', 'C', 'D'];
const RANKS = ['oldest', 'second', 'third', 'youngest'];
const PLAIN = { density: 1, scale: 1, turn: 0 };
const TAU = Math.PI * 2;
const RULES = {
  soil: { tag: 'soil below 3', rule: 'water it if its soil reads below 3' },
  lamp: { tag: 'lamp off', rule: 'water it only while the lamp is off' },
  twice: { tag: 'not twice running', rule: 'never water it two visits running, so not if it was watered last time' },
  left: { tag: 'if the left one is', rule: 'water it if the plant to its left is watered' },
  vent: { tag: 'vent open, soil below 4', rule: 'water it if the vent is open and its soil reads below 4' }
};
const RULE_IDS = ['soil', 'lamp', 'twice', 'left', 'vent'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/* ---- drawing shared by both ---------------------------------------------------------------- */

function write(g, text, x, y, size, align, tone, weight) {
  g.fillStyle = tone;
  g.font = (weight || '500') + ' ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
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

// The air in the glasshouse: brighter under a lamp that is on, dappled by the configuration, with
// the stars as they stand shining faintly through the top panes, and the soil along the bottom.
function glass(g, w, h, env, v, lit, t) {
  const c = env.colors;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, lit ? env.mix(c.bg2, c.fg, 0.16) : c.bg2);
  grad.addColorStop(1, env.mix(c.bg, c.accent, lit ? 0.04 : 0.09));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (lit) {
    const shaft = g.createRadialGradient(w / 2, h * 0.07, 0, w / 2, h * 0.07, h * 0.9);
    shaft.addColorStop(0, env.alpha(c.accent2, 0.16));
    shaft.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = shaft;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = env.alpha(c.fg, 0.4);
  for (const p of env.points(w, h, 10)) {
    g.beginPath();
    g.arc(p.x, 4 + p.y * 0.22, 1.2 * v.scale, 0, TAU);
    g.fill();
  }
  const n = Math.max(3, Math.round(7 * v.density));
  for (let i = 0; i < n; i++) {
    const x = ((i * 0.618 + 0.1 + v.turn * 0.23 + Math.sin((t || 0) * 0.3 + i) * 0.02) % 1) * w;
    const y = ((i * 0.38 + 0.05 + v.turn * 0.1) % 1) * h * 0.55;
    const r = Math.min(w, h) * (0.07 + (i % 3) * 0.03) * v.scale;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, env.alpha(c.accent2, 0.09));
    d.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = d;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const soilY = h * 0.64;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, soilY, w, h - soilY);
  const grit = Math.round(40 * v.density);
  for (let i = 0; i < grit; i++) {
    g.fillStyle = env.alpha(c.accent2, 0.1 + ((i * 7) % 5) * 0.03);
    g.fillRect(((i * 0.618034 + v.turn * 0.5) % 1) * w, soilY + ((i * 0.754877) % 1) * (h - soilY), 1.5, 1.5);
  }
}

// The glass itself: fog and its drips, the frame and glazing bars, and a shine.
function pane(g, w, h, env, fog, t) {
  const c = env.colors;
  if (fog > 0) {
    const f = g.createLinearGradient(0, 0, 0, h);
    f.addColorStop(0, env.alpha(c.fg, 0.24 * fog));
    f.addColorStop(0.6, env.alpha(c.fg, 0.08 * fog));
    f.addColorStop(1, env.alpha(c.fg, 0.03 * fog));
    g.fillStyle = f;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = env.alpha(c.fg, 0.35 * fog);
    g.lineWidth = 1.2;
    const n = Math.round(fog * 9);
    for (let i = 0; i < n; i++) {
      const x = ((i * 0.618034 + 0.07) % 1) * w;
      const y = ((t * (0.03 + (i % 3) * 0.02) + i * 0.37) % 1) * h * 0.7;
      g.beginPath();
      g.moveTo(x, Math.max(0, y - 18 * fog));
      g.lineTo(x, y);
      g.stroke();
    }
  }
  g.strokeStyle = env.alpha(c.fg, 0.35);
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  g.lineWidth = 1;
  g.strokeStyle = env.alpha(c.fg, 0.18);
  g.beginPath();
  for (let x = w / 3; x < w - 1; x += w / 3) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  g.moveTo(0, h * 0.3);
  g.lineTo(w, h * 0.3);
  g.stroke();
  const shine = g.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, env.alpha(c.fg, 0.08));
  shine.addColorStop(0.5, env.alpha(c.fg, 0));
  g.fillStyle = shine;
  g.fillRect(0, 0, w, h);
}

// One stem, `height` tall, with exactly `leaves` leaves along it, leaning with the breeze. Returns
// where its tip is.
function stem(g, env, x, soilY, height, leaves, t, k, phase, bend, glow, bloom) {
  const c = env.colors;
  const seg = 8;
  const pts = [];
  for (let j = 0; j <= seg; j++) {
    const r = j / seg;
    const sway = Math.sin(t * 0.9 + phase + r * 2.2) * bend * r * 7 * k + Math.sin(r * 3 + phase) * bend * 5 * k * r;
    pts.push([x + sway, soilY - r * height]);
  }
  const at = (r) => {
    const j = Math.min(seg - 1, Math.floor(r * seg));
    const f = r * seg - j;
    return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
  };
  g.strokeStyle = env.alpha(c.accent, 0.6 + glow * 0.35);
  g.lineWidth = (1.4 + glow * 0.8) * k;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  g.stroke();
  const size = clamp((0.8 * height) / Math.max(1, leaves) * 0.55, 1.6 * k, 5 * k);
  g.fillStyle = env.alpha(c.accent, 0.4 + glow * 0.35);
  for (let i = 0; i < leaves; i++) {
    const p = at(0.1 + (0.82 * (i + 0.5)) / leaves);
    const dir = i % 2 ? -1 : 1;
    g.beginPath();
    g.ellipse(p[0] + dir * size * 1.2, p[1], size * 1.5, size * 0.65, dir * 0.5, 0, TAU);
    g.fill();
  }
  const tip = pts[seg];
  g.fillStyle = env.alpha(c.accent2, 0.2 + glow * 0.3 + bloom * 0.15);
  g.beginPath();
  g.arc(tip[0], tip[1], (3.5 + glow * 4 + bloom * 6) * k, 0, TAU);
  g.fill();
  if (bloom > 0.02) {
    const br = 4.5 * k * bloom;
    g.fillStyle = env.alpha(c.accent2, 0.85 * bloom);
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU + t * 0.3;
      g.beginPath();
      g.ellipse(tip[0] + Math.cos(a) * br, tip[1] + Math.sin(a) * br, br, br * 0.55, a, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = env.alpha(c.fg, 0.95);
  g.beginPath();
  g.arc(tip[0], tip[1], (1.6 + bloom * 1.5) * k, 0, TAU);
  g.fill();
  return tip;
}

// A small drop, point down.
function drop(g, env, x, y, k, a) {
  g.fillStyle = env.alpha(env.colors.fg, a);
  g.beginPath();
  g.moveTo(x, y - 4 * k);
  g.quadraticCurveTo(x + 3.2 * k, y + 1.5 * k, x, y + 3.5 * k);
  g.quadraticCurveTo(x - 3.2 * k, y + 1.5 * k, x, y - 4 * k);
  g.fill();
}

// A lettered or numbered marker at the foot of a stem.
function badge(g, env, x, y, text, k, size) {
  const c = env.colors;
  g.fillStyle = env.alpha(c.bg, 0.9);
  g.strokeStyle = env.alpha(c.accent, 0.9);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, 6.5 * k, 0, TAU);
  g.fill();
  g.stroke();
  write(g, text, x, y + 0.5, size, 'center', c.fg, '600');
}

function shuffled(env, n) {
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(i);
  const out = [];
  while (rest.length) out.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  return out;
}

function startFor(env, order) {
  const n = order.length;
  let start = order.slice();
  for (let guard = 0; guard < 10 && start.every((v, i) => v === order[i]); guard++) start = shuffled(env, n);
  if (start.every((v, i) => v === order[i])) start = order.slice().reverse();
  return start;
}

/* ---- who gets water ------------------------------------------------------------------------ */

// Which plants the rules give water, judged left to right, so "if the left one is" has an answer.
function watered(plan) {
  const out = [];
  for (let i = 0; i < plan.n; i++) {
    const r = plan.rules[i];
    let yes = false;
    if (r === 'soil') yes = plan.soil[i] < 3;
    else if (r === 'lamp') yes = !plan.lamp;
    else if (r === 'twice') yes = !plan.last[i];
    else if (r === 'left') yes = i > 0 && out[i - 1];
    else if (r === 'vent') yes = !!plan.vent && plan.soil[i] < 4;
    out.push(yes);
  }
  return out;
}

function waterOk(p) {
  const n = Number(p && p.n);
  if (n !== 5 && n !== 6) return false;
  const list = (v, ok) => Array.isArray(v) && v.length === n && v.every(ok);
  if (!list(p.rules, (r, i) => RULE_IDS.includes(r) && !(i === 0 && r === 'left'))) return false;
  if (!list(p.soil, (v) => Number.isInteger(v) && v >= 1 && v <= 5)) return false;
  if (!list(p.last, (v) => v === 0 || v === 1)) return false;
  if ((p.lamp !== 0 && p.lamp !== 1) || (p.vent !== 0 && p.vent !== 1)) return false;
  const count = watered(p).filter(Boolean).length;
  return count >= 1 && count < n;
}

function waterPlan(env) {
  const n = env.chance(0.5) ? 6 : 5;
  for (let guard = 0; guard < 80; guard++) {
    const rules = [];
    const soil = [];
    const last = [];
    for (let i = 0; i < n; i++) {
      rules.push(env.pick(i === 0 ? RULE_IDS.filter((r) => r !== 'left') : RULE_IDS));
      soil.push(env.int(1, 5));
      last.push(env.chance(0.45) ? 1 : 0);
    }
    const plan = { kind: 'water', n, rules, soil, last, lamp: env.chance(0.5) ? 1 : 0, vent: env.chance(0.5) ? 1 : 0 };
    if (new Set(rules).size >= 3 && waterOk(plan)) return plan;
  }
  return { kind: 'water', n: 5, rules: ['soil', 'lamp', 'left', 'twice', 'vent'], soil: [2, 4, 3, 1, 3], last: [0, 1, 0, 1, 0], lamp: 1, vent: 1 };
}

function carriedWater(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'water' || !waterOk(p)) return null;
  return { kind: 'water', n: p.n, rules: p.rules.slice(), soil: p.soil.slice(), last: p.last.slice(), lamp: p.lamp, vent: p.vent };
}

function waterTitle(plan) {
  return 'who gets water: ' + WORDS[plan.n] + ' plants';
}

function waterGeometry(w, h, n) {
  const span = w * 0.9;
  return { left: (w - span) / 2, cell: span / n, soilY: h * 0.64 };
}

function drawWater(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const n = plan.n;
  const geo = waterGeometry(w, h, n);
  const k = clamp(Math.min(w, h) / 340, 0.6, 1.8) * v.scale;
  const small = Math.max(8, Math.min(12, Math.round(Math.min(w, h) * 0.032)));
  const tiny = Math.max(7, Math.min(11, Math.round(geo.cell * 0.16)));
  glass(g, w, h, env, v, !!plan.lamp, s.t);
  // The lamp, on its cord, and the vent in the top corner.
  const lx = w * 0.5;
  const ly = h * 0.075;
  g.strokeStyle = env.alpha(c.muted, 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(lx, 0);
  g.lineTo(lx, ly - 7 * k);
  g.stroke();
  if (plan.lamp) {
    const halo = g.createRadialGradient(lx, ly, 0, lx, ly, 30 * k);
    halo.addColorStop(0, env.alpha(c.accent2, 0.55));
    halo.addColorStop(1, env.alpha(c.accent2, 0));
    g.fillStyle = halo;
    g.fillRect(lx - 30 * k, ly - 30 * k, 60 * k, 60 * k);
    g.fillStyle = c.accent2;
  } else {
    g.fillStyle = env.alpha(c.muted, 0.25);
  }
  g.beginPath();
  g.arc(lx, ly, 7 * k, 0, TAU);
  g.fill();
  g.strokeStyle = env.alpha(c.fg, 0.6);
  g.stroke();
  write(g, 'lamp ' + (plan.lamp ? 'on' : 'off'), lx + 12 * k, ly, small, 'left', env.alpha(c.fg, 0.9));
  const vx = w * 0.9;
  const vy = h * 0.075;
  g.strokeStyle = env.alpha(c.fg, 0.7);
  g.strokeRect(vx - 11 * k, vy - 7 * k, 22 * k, 14 * k);
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = vy - 4 * k + i * 4 * k;
    g.moveTo(vx - 8 * k, plan.vent ? y + 2 * k : y);
    g.lineTo(vx + 8 * k, plan.vent ? y - 2 * k : y);
  }
  g.stroke();
  write(g, 'vent ' + (plan.vent ? 'open' : 'shut'), vx - 14 * k, vy, small, 'right', env.alpha(c.fg, 0.9));
  // The plants, each with its number, its meter, its mark and its tag.
  const got = watered(plan);
  for (let i = 0; i < n; i++) {
    const x = geo.left + (i + 0.5) * geo.cell;
    const height = (geo.soilY - h * 0.16) * (0.55 + 0.09 * ((i * 3 + plan.soil[i]) % 5));
    const leaves = 4 + ((i * 5 + plan.soil[i]) % 4);
    const chosen = s.chosen.includes(i);
    const tip = stem(g, env, x, geo.soilY, height, leaves, s.t, k, i * 1.3 + v.turn * TAU, 0.5 + (i % 3) * 0.3, chosen ? 0.7 : 0, s.bloom[i] || 0);
    if (chosen) {
      for (let j = 0; j < 3; j++) drop(g, env, x + (j - 1) * 5 * k, tip[1] - (14 + ((s.t * 30 + j * 7 + i * 5) % 18)) * k, k * 0.8, 0.8);
      g.strokeStyle = env.alpha(c.accent2, 0.8);
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, geo.soilY, 11 * k, 3.5 * k, 0, 0, TAU);
      g.stroke();
    }
    if (s.hinted.includes(i)) write(g, got[i] ? 'water it' : 'leave it dry', x, tip[1] - 12 * k, small, 'center', c.accent2, '600');
    badge(g, env, x, geo.soilY, String(i + 1), k, small);
    const my = geo.soilY + h * 0.065;
    const bw = Math.min(geo.cell * 0.11, 9 * k);
    const gap = bw * 0.3;
    const x0 = x - (5 * bw + 4 * gap) / 2;
    for (let j = 0; j < 5; j++) {
      g.fillStyle = j < plan.soil[i] ? c.accent2 : env.alpha(c.muted, 0.25);
      g.fillRect(x0 + j * (bw + gap), my - bw / 2, bw, bw);
    }
    write(g, 'soil ' + plan.soil[i], x, my + bw * 0.5 + tiny * 0.8, tiny, 'center', env.alpha(c.fg, 0.9));
    if (plan.last[i]) {
      drop(g, env, x - tiny * 1.6, geo.soilY + h * 0.165, k * 0.9, 0.9);
      write(g, 'last time', x - tiny * 0.9, geo.soilY + h * 0.165, tiny, 'left', env.alpha(c.fg, 0.8));
    }
    g.font = '500 ' + tiny + 'px system-ui, sans-serif';
    const lines = [];
    for (const part of RULES[plan.rules[i]].tag.split(', ')) for (const line of wrap(g, part, geo.cell * 0.95)) lines.push(line);
    lines.forEach((line, j) => write(g, line, x, geo.soilY + h * 0.225 + j * tiny * 1.25, tiny, 'center', env.alpha(c.accent2, 0.95)));
  }
  pane(g, w, h, env, s.fog, s.t);
}

function waterPreview(g, w, h, env, plan, t) {
  drawWater(g, w, h, env, plan, { chosen: [], hinted: [], bloom: [], fog: 0, t: t || 0 }, env.variant);
}

function waterPiece(env, plan) {
  const n = plan.n;
  const got = watered(plan);
  const answer = [];
  for (let i = 0; i < n; i++) if (got[i]) answer.push(i);
  const s = { chosen: [], hinted: [], bloom: new Array(n).fill(0), fog: 0, t: 0 };
  const draw = (c) => drawWater(c.g, c.w, c.h, c, plan, s, env.variant);
  const kinds = RULE_IDS.filter((r) => plan.rules.includes(r));
  function chosenNow(c) {
    const v = c.value('water');
    return Array.isArray(v) ? v.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n) : s.chosen;
  }
  return {
    title: waterTitle(plan),
    brief: capital(WORDS[n]) + ' plants wait under glass at midnight, each tagged with one rule, and the glass shows what the rules are judged by: a soil meter under every plant, the lamp, the vent, and a drop beside any plant watered last time. The tags: '
      + kinds.map((r) => RULES[r].tag + ' (' + RULES[r].rule + ')').join('; ') + '. Judge them left to right.',
    goal: 'Mark every plant that gets water, and none that stays dry.',
    aspect: '16 / 10',
    checkLabel: 'water them',
    steps: [
      { id: 'water', ask: 'the plants to water: tap them under the glass, or mark them here', kind: 'pick', items: plan.rules.map((r, i) => ({ label: 'plant ' + (i + 1) + ' (' + RULES[r].tag + ')', value: i })) },
      { id: 'hint', ask: 'one plant judged', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { water: answer },
    check(c) {
      const chosen = chosenNow(c);
      const right = chosen.filter((i) => got[i]).length;
      const dry = chosen.filter((i) => !got[i]).length;
      const solved = right === answer.length && dry === 0;
      let say;
      if (solved) say = (answer.length === 1 ? 'one plant drinks' : WORDS[answer.length] + ' plants drink') + ', and the rest stay dry';
      else if (!right) say = 'none of the right plants yet' + (dry ? ', and ' + WORDS[dry] + ' that should stay dry' : '');
      else say = WORDS[right] + ' of the right plants' + (dry ? ', and ' + WORDS[dry] + ' that should stay dry' : '');
      return { solved, say };
    },
    start(c) {
      c.status('tap a plant to mark it for water');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'water' && Array.isArray(value)) {
        s.chosen = value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n).sort((a, b) => a - b);
        c.status(s.chosen.length ? 'marked: ' + s.chosen.map((i) => 'plant ' + (i + 1)).join(', ') : 'nothing marked');
      }
      if (id === 'hint') {
        const next = plan.rules.map((r, i) => i).find((i) => !s.hinted.includes(i) && s.chosen.includes(i) !== got[i]);
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('plant ' + (next + 1) + (got[next] ? ' gets water' : ' stays dry'));
        } else {
          c.status('every plant you have judged wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = waterGeometry(c.w, c.h, n);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= n) return;
      const next = s.chosen.includes(col) ? s.chosen.filter((i) => i !== col) : s.chosen.concat([col]).sort((a, b) => a - b);
      s.chosen = next;
      c.set('water', next.slice());
      c.status('plant ' + (col + 1) + (next.includes(col) ? ' marked for water' : ' left dry'));
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.fog = Math.min(1, s.fog + dt * 0.5);
        for (const i of answer) s.bloom[i] = Math.min(1, s.bloom[i] + dt * 0.8);
      }
      draw(c);
    },
    end(c) {
      c.status('watered: ' + answer.map((i) => 'plant ' + (i + 1)).join(', ') + '; the glass fogs over and the rest stay dry');
    }
  };
}

/* ---- the oldest stem ----------------------------------------------------------------------- */

function ages(plan) {
  return plan.leaves.map((l, i) => l / plan.rates[i]);
}

function ageOrder(plan) {
  const a = ages(plan);
  return [0, 1, 2, 3].sort((p, q) => a[q] - a[p]);
}

function ageOk(p) {
  if (!p || p.kind !== 'age') return false;
  const list = (v, ok) => Array.isArray(v) && v.length === 4 && v.every(ok);
  if (!list(p.rates, (r) => Number.isInteger(r) && r >= 1 && r <= 4)) return false;
  if (!list(p.leaves, (l, i) => Number.isInteger(l) && l >= 3 && l <= 24 && l % p.rates[i] === 0)) return false;
  const a = ages(p);
  if (new Set(a).size !== 4) return false;
  const order = ageOrder(p);
  const byLeaves = [0, 1, 2, 3].sort((x, y) => p.leaves[y] - p.leaves[x]);
  if (order.every((v, i) => v === byLeaves[i])) return false;
  return list(p.start, (v) => Number.isInteger(v) && v >= 0 && v < 4) && new Set(p.start).size === 4 && !p.start.every((v, i) => v === order[i]);
}

function agePlan(env) {
  for (let guard = 0; guard < 80; guard++) {
    const rates = [];
    const leaves = [];
    for (let i = 0; i < 4; i++) {
      const r = env.int(1, 4);
      rates.push(r);
      leaves.push(r * env.int(Math.ceil(3 / r), Math.floor(24 / r)));
    }
    const plan = { kind: 'age', rates, leaves, start: [0, 1, 2, 3] };
    if (new Set(ages(plan)).size !== 4 || Math.max.apply(null, ages(plan)) < 4) continue;
    plan.start = startFor(env, ageOrder(plan));
    if (ageOk(plan)) return plan;
  }
  return { kind: 'age', rates: [2, 4, 1, 3], leaves: [16, 20, 6, 21], start: [0, 1, 2, 3] };
}

function carriedAge(env) {
  const p = env.card && env.card.of;
  if (!ageOk(p)) return null;
  return { kind: 'age', rates: p.rates.slice(), leaves: p.leaves.slice(), start: p.start.slice() };
}

function ageTitle() {
  return 'the oldest stem: four under glass';
}

function ageGeometry(w, h) {
  const span = w * 0.84;
  return { left: (w - span) / 2, cell: span / 4, soilY: h * 0.64 };
}

function drawAge(g, w, h, env, plan, s, variant) {
  const v = variant || PLAIN;
  const c = env.colors;
  const geo = ageGeometry(w, h);
  const k = clamp(Math.min(w, h) / 340, 0.6, 1.8) * v.scale;
  const small = Math.max(8, Math.min(12, Math.round(Math.min(w, h) * 0.032)));
  const a = ages(plan);
  glass(g, w, h, env, v, true, s.t);
  write(g, 'oldest first, left to right as you set them', w / 2, h * 0.05, small, 'center', env.alpha(c.muted, 0.85));
  for (let i = 0; i < 4; i++) {
    const x = geo.left + (i + 0.5) * geo.cell;
    const height = (geo.soilY - h * 0.14) * (0.32 + (0.66 * plan.leaves[i]) / 24);
    const rank = s.order.indexOf(i);
    const tip = stem(g, env, x, geo.soilY, height, plan.leaves[i], s.t, k, i * 1.3 + v.turn * TAU, 0.4 + (i % 3) * 0.25, 0, s.bloom[i] || 0);
    write(g, plan.leaves[i] + ' leaves', x, tip[1] - 11 * k, small, 'center', env.alpha(c.fg, 0.9));
    if (s.hinted.includes(i)) write(g, a[i] + (a[i] === 1 ? ' week' : ' weeks'), x, tip[1] - 11 * k - small * 1.3, small, 'center', c.accent2, '600');
    badge(g, env, x, geo.soilY, LETTERS[i], k, small);
    write(g, plan.rates[i] + (plan.rates[i] === 1 ? ' leaf a week' : ' leaves a week'), x, geo.soilY + h * 0.07, small, 'center', env.alpha(c.accent2, 0.95));
    write(g, RANKS[rank], x, geo.soilY + h * 0.13, small, 'center', env.alpha(c.fg, 0.8));
  }
  pane(g, w, h, env, s.fog, s.t);
}

function agePreview(g, w, h, env, plan, t) {
  drawAge(g, w, h, env, plan, { order: plan.start.slice(), hinted: [], bloom: [], fog: 0, t: t || 0 }, env.variant);
}

function agePiece(env, plan) {
  const order = ageOrder(plan);
  const a = ages(plan);
  const oldest = a[order[0]];
  const s = { order: plan.start.slice(), hinted: [], bloom: [0, 0, 0, 0], fog: 0, t: 0 };
  const draw = (c) => drawAge(c.g, c.w, c.h, c, plan, s, env.variant);
  const named = (list) => list.map((i) => LETTERS[i]).join(', ');
  function current(c) {
    const v = c.value('order');
    return Array.isArray(v) && v.length === 4 ? v.map(Number) : s.order;
  }
  return {
    title: ageTitle(),
    brief: 'Four stems under glass. Each tag gives how many leaves that stem grows in a week, and its leaves are drawn and counted. A stem that grows three leaves a week and carries twelve has grown for four weeks. Set the order on the rail, or tap a stem to move it up one place.',
    goal: 'Put the stems oldest to youngest, and say how many weeks the oldest has grown.',
    aspect: '16 / 10',
    checkLabel: 'check the bed',
    steps: [
      { id: 'order', ask: 'the stems, oldest first', kind: 'order', items: LETTERS.map((l, i) => ({ label: 'stem ' + l, value: i })), value: plan.start.slice() },
      { id: 'oldest', ask: 'how long the oldest has grown', kind: 'number', min: 1, max: 24, step: 1, value: 1, unit: 'weeks' },
      { id: 'hint', ask: 'one stem\'s age', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: order.slice(), oldest },
    check(c) {
      const cur = current(c);
      let right = 0;
      for (let i = 0; i < 4; i++) if (cur[i] === order[i]) right += 1;
      const weeks = Math.round(Number(c.value('oldest')));
      const ageRight = weeks === oldest;
      if (right === 4 && ageRight) return { solved: true, say: 'oldest to youngest: ' + named(order) + '; stem ' + LETTERS[order[0]] + ' has grown ' + oldest + ' weeks' };
      const parts = [];
      parts.push(right === 4 ? 'the order is right' : right === 0 ? 'none of the stems is in the right place yet' : WORDS[right] + ' of four in the right place');
      if (!ageRight) parts.push(weeks < oldest ? 'the oldest is older than that' : 'the oldest is younger than that');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('four tags, four counts; tap a stem to move it up');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === 4) {
        s.order = value.map(Number);
        c.status('oldest first: ' + named(s.order));
      }
      if (id === 'oldest') c.status('you say the oldest has grown ' + Math.round(Number(value)) + ' weeks');
      if (id === 'hint') {
        const next = order.find((i) => !s.hinted.includes(i));
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('stem ' + LETTERS[next] + ' has grown ' + a[next] + (a[next] === 1 ? ' week' : ' weeks'));
        } else {
          c.status('every stem\'s age is shown');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = ageGeometry(c.w, c.h);
      const col = Math.floor((x * c.w - geo.left) / geo.cell);
      if (col < 0 || col >= 4) return;
      const rank = s.order.indexOf(col);
      const next = s.order.slice();
      if (rank === 0) {
        next.splice(0, 1);
        next.push(col);
      } else {
        next[rank] = next[rank - 1];
        next[rank - 1] = col;
      }
      s.order = next;
      c.set('order', next.slice());
      c.status('stem ' + LETTERS[col] + ' is now ' + RANKS[next.indexOf(col)]);
      draw(c);
    },
    frame(t, dt, c) {
      s.t += dt;
      if (c.done) {
        s.fog = Math.min(0.5, s.fog + dt * 0.3);
        order.forEach((i, rank) => {
          s.bloom[i] = Math.min(1, s.bloom[i] + Math.max(0, dt * 0.9 - rank * 0.01));
        });
      }
      draw(c);
    },
    end(c) {
      c.status('stem ' + LETTERS[order[0]] + ' came up first, ' + oldest + ' weeks ago; the bed blooms oldest to youngest');
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsWater(env) {
  return env.chance(0.55);
}

export default {
  id: 'wish-terrarium',
  needsSky: true,
  paint(g, w, h, env) {
    if (dealsWater(env)) waterPreview(g, w, h, env, waterPlan(env), env.variant.turn * 5);
    else agePreview(g, w, h, env, agePlan(env), env.variant.turn * 5);
  },
  animate(g, w, h, env, t) {
    if (dealsWater(env)) waterPreview(g, w, h, env, waterPlan(env), t + env.variant.turn * 5);
    else agePreview(g, w, h, env, agePlan(env), t + env.variant.turn * 5);
  },
  spark(env) {
    if (!env.stars.length) return null;
    if (dealsWater(env)) {
      const plan = waterPlan(env);
      return {
        title: waterTitle(plan),
        mono: 'lamp ' + (plan.lamp ? 'on' : 'off') + ' / vent ' + (plan.vent ? 'open' : 'shut') + '\nsoil ' + plan.soil.join(' ') + '\ntags: ' + plan.rules.map((r) => RULES[r].tag).join('; '),
        text: 'A midnight round under glass. Every plant wears one rule; the readings say which of them drink. Mark them.',
        aspect: '16 / 10',
        paint: (g, w, h, cardEnv) => waterPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 5),
        of: plan
      };
    }
    const plan = agePlan(env);
    return {
      title: ageTitle(),
      mono: LETTERS.map((l, i) => l + ': ' + plan.leaves[i] + ' leaves, ' + plan.rates[i] + ' a week').join('\n'),
      text: 'Four stems, four rates of growth. Which came up first, and how many weeks ago?',
      aspect: '16 / 10',
      paint: (g, w, h, cardEnv) => agePreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 5),
      of: plan
    };
  },
  piece(env) {
    const water = carriedWater(env);
    if (water) return waterPiece(env, water);
    const age = carriedAge(env);
    if (age) return agePiece(env, age);
    return dealsWater(env) ? waterPiece(env, waterPlan(env)) : agePiece(env, agePlan(env));
  }
};
