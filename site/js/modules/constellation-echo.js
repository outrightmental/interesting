/* The echo chamber: a night room where a pulse goes out and the stars answer. As a card it is one
   of the two puzzles below, drawn small (paint, animate, spark); as a piece it is that puzzle, and
   the card it was opened from says which. See js/feed.js for what a module is and js/stage.js for
   what a piece is.

   Two puzzles, both deduction, both solvable from what is drawn and nothing heard:

     the echo order    A marked point and four or five stars at clearly different distances from it
                       (each at least a fifth farther than the last). A pulse leaves the mark and
                       its echo comes back from each star after a time proportional to the star's
                       distance. Put the stars in the order their echoes return. Faint rings round
                       the mark make the distances judgeable; nothing is numbered. A wrong check
                       says how many stand in the right place and no more; a hint, at a price,
                       says where one star comes back.
     the midnight chord  Four voices with periods of 2, 3, 4 and 5 beats, each sounding on beat 0 and
                       every period after, over a strip of twelve beats. Some of them are sounding,
                       and the scene shows only the total per beat, as stacked blocks, and the four
                       voices' own beats. Say which voices are sounding and on which beat after
                       beat 0 they next all strike together. The chord is drawn from its answer and
                       checked for uniqueness against every other chord before it is dealt.

   The chamber reads the sky: the visitor's stars are the first candidates for the echo order's
   points, and extra points are invented from the seed when the sky is thin (one star is enough).
   Nothing depends on a star's text. A card and the feature it opens as are one puzzle: the spark
   puts the whole plan on its spec as `of` -- the mark and the stars, or the chord's voices -- and
   piece(env) opens on that rather than rolling another. */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen'];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const PERIODS = [2, 3, 4, 5];
const EVERY = { 2: 'every 2nd beat', 3: 'every 3rd beat', 4: 'every 4th beat', 5: 'every 5th beat' };
const BEATS = 12;
const PLAIN = { density: 1, scale: 1, turn: 0 };
const RATIO = 1.2;
const TAU = Math.PI * 2;

/* ---- shared ground ------------------------------------------------------------------------- */

function background(g, w, h, c) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.colors.bg2);
  grad.addColorStop(1, c.colors.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// The chamber's dust: specks that drift with time and sit where the configuration puts them.
function dust(g, w, h, c, v, t) {
  const count = Math.max(10, Math.round(36 * v.density));
  g.fillStyle = c.alpha(c.colors.muted, 0.14);
  for (let i = 0; i < count; i++) {
    g.fillRect((i * 127.3 + v.turn * 211 + t * 6) % w, (i * 79.7 + v.turn * 97 + t * 3) % h, 1.2, 1.2);
  }
}

// The visitor's own sky, faint, behind a scene that is not made of it.
function skyDots(g, w, h, c, v) {
  const pts = typeof c.points === 'function' ? c.points(w, h, 10) : [];
  g.fillStyle = c.alpha(c.colors.fg, 0.16);
  for (const p of pts) {
    g.beginPath();
    g.arc(p.x, p.y, Math.max(0.8, Math.min(w, h) * 0.004 * v.scale), 0, TAU);
    g.fill();
  }
}

function caption(g, w, c, text, x, y, a, size, align) {
  if (!text || a <= 0) return;
  g.fillStyle = c.alpha(c.colors.fg, a);
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcmOf(list) {
  return list.reduce((acc, p) => acc * p / gcd(acc, p), 1);
}

/* ---- the echo order ------------------------------------------------------------------------ */

// Whether a point can join the stars: not too near the mark, not too far, clear of the others,
// and at a distance from the mark that differs from every other star's by the ratio.
function fitsEcho(p, source, chosen) {
  const d = dist(p, source);
  if (d < 0.1 || d > 0.62) return false;
  for (const q of chosen) {
    if (dist(p, q) < 0.09) return false;
    const dq = dist(q, source);
    if (Math.max(d, dq) < RATIO * Math.min(d, dq)) return false;
  }
  return true;
}

function byDistance(plan) {
  return plan.stars.map((s, i) => i).sort((a, b) => dist(plan.stars[a], plan.source) - dist(plan.stars[b], plan.source));
}

function isIdentity(list) {
  return list.every((v, i) => v === i);
}

function echoPlan(env) {
  const n = env.chance(0.5) ? 5 : 4;
  const source = { x: round3(0.3 + env.rnd() * 0.4), y: round3(0.32 + env.rnd() * 0.36) };
  const candidates = [];
  for (const s of (env.stars || [])) {
    const x = Number(s && s.x);
    const y = Number(s && s.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    candidates.push({ x: round3(clamp(x / 100, 0.08, 0.92)), y: round3(clamp(y / 100, 0.1, 0.9)), sky: 1 });
  }
  for (let i = 0; i < 30; i++) candidates.push({ x: round3(0.08 + env.rnd() * 0.84), y: round3(0.1 + env.rnd() * 0.8), sky: 0 });
  let chosen = [];
  for (const p of candidates) {
    if (chosen.length >= n) break;
    if (fitsEcho(p, source, chosen)) chosen.push(p);
  }
  if (chosen.length < 4) {
    // A sky and a seed that would not settle: a fixed spiral that always does.
    source.x = 0.5;
    source.y = 0.5;
    chosen = [];
    for (let i = 0; i < n; i++) {
      const r = 0.12 * Math.pow(1.25, i);
      const a = i * 2.4;
      chosen.push({ x: round3(0.5 + Math.cos(a) * r), y: round3(0.5 + Math.sin(a) * r), sky: 0 });
    }
  }
  // The letters: a shuffle of the stars that is not already the answer.
  let stars = chosen.slice();
  for (let guard = 0; guard < 10 && isIdentity(byDistance({ source, stars })); guard++) {
    stars = [];
    const rest = chosen.slice();
    while (rest.length) stars.push(rest.splice(env.int(0, rest.length - 1), 1)[0]);
  }
  if (isIdentity(byDistance({ source, stars }))) stars.reverse();
  return { kind: 'echo', source, stars };
}

function carriedEcho(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'echo' || !p.source || !Array.isArray(p.stars)) return null;
  const inFrame = (q) => q && typeof q === 'object' && isFinite(Number(q.x)) && isFinite(Number(q.y))
    && Number(q.x) >= 0 && Number(q.x) <= 1 && Number(q.y) >= 0 && Number(q.y) <= 1;
  if (!inFrame(p.source) || p.stars.length < 4 || p.stars.length > 5 || !p.stars.every(inFrame)) return null;
  const source = { x: Number(p.source.x), y: Number(p.source.y) };
  const stars = p.stars.map((s) => ({ x: Number(s.x), y: Number(s.y), sky: s.sky ? 1 : 0 }));
  for (let i = 0; i < stars.length; i++) {
    const di = dist(stars[i], source);
    if (di < 0.05) return null;
    for (let j = i + 1; j < stars.length; j++) {
      const dj = dist(stars[j], source);
      if (Math.max(di, dj) < 1.1 * Math.min(di, dj)) return null;
    }
  }
  const plan = { kind: 'echo', source, stars };
  if (isIdentity(byDistance(plan))) return null;
  return plan;
}

function echoTitle(plan) {
  return 'the echo order: ' + WORDS[plan.stars.length] + ' stars';
}

function echoGeometry(w, h) {
  const side = Math.min(w, h);
  return { side, x0: (w - side) / 2, y0: (h - side) / 2 };
}

// The scene. `s` is the live state: the visitor's order, the stars shown by hints, taps made on
// the scene, the breath of the mark before a solve and the pulse that plays after one.
function drawEcho(g, w, h, c, plan, s, variant, t) {
  const v = variant || PLAIN;
  const col = c.colors;
  const geo = echoGeometry(w, h);
  const at = (p) => ({ x: geo.x0 + p.x * geo.side, y: geo.y0 + p.y * geo.side });
  const S = at(plan.source);
  const order = byDistance(plan);
  const far = dist(plan.stars[order[order.length - 1]], plan.source);
  const size = Math.max(10, Math.round(geo.side * 0.045));
  background(g, w, h, c);
  dust(g, w, h, c, v, c.reduced ? 0 : t);
  skyDots(g, w, h, c, v);
  // The rings: one every twentieth of the room, out past the farthest star, unnumbered.
  const step = 0.05;
  g.lineWidth = 1;
  for (let r = step; r <= far + step; r += step) {
    g.strokeStyle = c.alpha(col.muted, 0.08 + 0.07 * v.density);
    g.beginPath();
    g.arc(S.x, S.y, r * geo.side, 0, TAU);
    g.stroke();
  }
  // The pulse: a breath inside the first ring before a solve, the whole run after one.
  const reach = s.pulse >= 0 ? s.pulse : -1;
  if (reach >= 0) {
    g.strokeStyle = c.alpha(col.accent2, 0.55);
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(S.x, S.y, reach * geo.side, 0, TAU);
    g.stroke();
  } else {
    const breath = c.reduced ? 0.5 : (t % 3) / 3;
    g.strokeStyle = c.alpha(col.accent2, 0.4 * (1 - breath));
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(S.x, S.y, (0.015 + 0.075 * breath) * geo.side * v.scale, 0, TAU);
    g.stroke();
  }
  // The mark the pulse leaves from.
  const mr = Math.max(3, geo.side * 0.014 * v.scale);
  const glow = g.createRadialGradient(S.x, S.y, mr * 0.4, S.x, S.y, mr * 4);
  glow.addColorStop(0, c.alpha(col.accent2, 0.5));
  glow.addColorStop(1, c.alpha(col.accent2, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(S.x, S.y, mr * 4, 0, TAU);
  g.fill();
  g.fillStyle = col.accent2;
  g.beginPath();
  g.arc(S.x, S.y, mr, 0, TAU);
  g.fill();
  g.strokeStyle = c.alpha(col.accent2, 0.9);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(S.x, S.y, mr * 2.2, 0, TAU);
  g.stroke();
  // The stars, lettered; a star the pulse has reached is lit, and its echo rings back.
  g.font = '600 ' + size + 'px system-ui, sans-serif';
  g.textBaseline = 'middle';
  plan.stars.forEach((star, i) => {
    const p = at(star);
    const d = dist(star, plan.source);
    const lit = reach >= 0 && reach >= d;
    const r = Math.max(2.5, geo.side * (0.011 + (star.sky ? 0.003 : 0)) * v.scale);
    if (lit) {
      const back = Math.min(1, (reach - d) / 0.08);
      g.strokeStyle = c.alpha(col.accent2, 0.6 * (1 - back * 0.5));
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(p.x, p.y, r + back * geo.side * 0.05, 0, TAU);
      g.stroke();
      g.fillStyle = c.alpha(col.accent2, 0.35);
      g.beginPath();
      g.arc(p.x, p.y, r * 2.6, 0, TAU);
      g.fill();
    }
    g.fillStyle = lit ? col.accent2 : c.alpha(col.fg, 0.95);
    g.beginPath();
    g.arc(p.x, p.y, r, 0, TAU);
    g.fill();
    g.strokeStyle = c.alpha(col.accent, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(p.x, p.y, r * 2, 0, TAU);
    g.stroke();
    const lx = p.x + (p.x > S.x ? 1 : -1) * r * 3.2;
    g.fillStyle = c.alpha(col.fg, 0.92);
    g.textAlign = p.x > S.x ? 'left' : 'right';
    g.fillText(LETTERS[i], lx, p.y - r * 2.2);
    if (s.hinted.includes(i)) {
      g.strokeStyle = c.alpha(col.accent2, 0.9);
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(p.x, p.y, r * 3.4, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = col.accent2;
      g.fillText(ORDINAL[order.indexOf(i)], lx, p.y + r * 2.4);
    }
    const tapped = s.taps.indexOf(i);
    if (tapped >= 0) {
      g.fillStyle = col.accent;
      g.fillText(String(tapped + 1), lx, p.y + r * 2.4);
    }
  });
  // The order as it stands, written along the foot of the room.
  const line = s.order ? s.order.map((i) => LETTERS[i]).join('  ') : '';
  caption(g, w, c, line, w / 2, geo.y0 + geo.side * 0.955, 0.85, size);
}

function echoBlank(plan) {
  return { order: null, hinted: [], taps: [], pulse: -1, played: 0 };
}

function echoPreview(g, w, h, env, plan, t) {
  drawEcho(g, w, h, env, plan, echoBlank(plan), env.variant, t || 0);
}

function echoPiece(env, plan) {
  const n = plan.stars.length;
  const order = byDistance(plan);
  const far = dist(plan.stars[order[order.length - 1]], plan.source);
  const s = echoBlank(plan);
  s.order = plan.stars.map((star, i) => i);
  let time = 0;
  const draw = (c) => drawEcho(c.g, c.w, c.h, c, plan, s, env.variant, time);
  function rightPlaces() {
    let right = 0;
    for (let i = 0; i < n; i++) if (s.order[i] === order[i]) right += 1;
    return right;
  }
  return {
    title: echoTitle(plan),
    brief: 'A pulse leaves the bright mark and every star sends an echo back; the farther the star, the later its echo. '
      + 'The rings round the mark are evenly spaced. Tap the stars in order on the scene, or arrange them on the rail.',
    goal: 'Put the stars in the order their echoes come back.',
    aspect: '1 / 1',
    checkLabel: 'send the pulse',
    steps: [
      { id: 'order', ask: 'the stars, first echo back to last', kind: 'order', items: plan.stars.map((star, i) => ({ label: 'star ' + LETTERS[i], value: i })) },
      { id: 'hint', ask: 'where one star comes back', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { order: order.slice() },
    check(c) {
      const right = rightPlaces();
      return {
        solved: right === n,
        say: right === n ? 'every echo comes back in the order you set'
          : (right === 0 ? 'none of them stands in the right place yet' : WORDS[right] + ' of ' + WORDS[n] + ' in the right place')
      };
    },
    start(c) {
      c.status('the mark, and ' + WORDS[n] + ' stars; tap them first echo to last');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'order' && Array.isArray(value) && value.length === n) {
        s.order = value.map(Number);
        s.taps = [];
        c.status('first back to last: ' + s.order.map((i) => LETTERS[i]).join(', '));
      }
      if (id === 'hint') {
        const next = order.find((i) => !s.hinted.includes(i) && s.order.indexOf(i) !== order.indexOf(i));
        if (next !== undefined) {
          s.hinted.push(next);
          c.hint();
          c.status('star ' + LETTERS[next] + ' comes back ' + ORDINAL[order.indexOf(next)]);
        } else {
          c.status('every star you have placed wrongly has been shown; the rest is yours');
        }
      }
      draw(c);
    },
    tap(x, y, c) {
      const geo = echoGeometry(c.w, c.h);
      const px = x * c.w;
      const py = y * c.h;
      let best = -1;
      let bestD = geo.side * 0.07;
      plan.stars.forEach((star, i) => {
        const d = Math.hypot(geo.x0 + star.x * geo.side - px, geo.y0 + star.y * geo.side - py);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) {
        s.taps = [];
        c.status('tap a star to make it the next echo back');
        draw(c);
        return;
      }
      if (s.taps.includes(best)) s.taps = s.taps.slice(0, s.taps.indexOf(best));
      s.taps.push(best);
      if (s.taps.length === n) {
        s.order = s.taps.slice();
        c.set('order', s.taps.slice());
        s.taps = [];
        c.status('first back to last: ' + s.order.map((i) => LETTERS[i]).join(', ') + '; send the pulse');
      } else {
        c.status('star ' + LETTERS[best] + ' comes back ' + ORDINAL[s.taps.length - 1] + '; ' + WORDS[n - s.taps.length] + ' more to tap');
      }
      draw(c);
    },
    frame(t, dt, c) {
      time += Math.max(0, dt);
      if (c.done) {
        s.played = (s.played + Math.max(0, dt) * 0.12) % (far + 0.3);
        s.pulse = s.played;
      }
      draw(c);
    },
    end(c) {
      s.pulse = 0;
      s.played = 0;
      c.status('the echoes come back ' + order.map((i) => LETTERS[i]).join(', ') + '; the pulse keeps going out');
      draw(c);
    }
  };
}

/* ---- the midnight chord -------------------------------------------------------------------- */

// The total per beat when `voices` (periods) sound: each on beat 0 and every period after.
function sumsOf(voices) {
  const bars = new Array(BEATS).fill(0);
  for (const p of voices) for (let b = 0; b < BEATS; b += p) bars[b] += 1;
  return bars;
}

// Whether no other set of voices makes the same bars: every non-empty subset is tried.
function uniqueChord(voices) {
  const want = sumsOf(voices).join('');
  let hits = 0;
  for (let mask = 1; mask < 16; mask++) {
    const subset = PERIODS.filter((p, i) => mask & (1 << i));
    if (sumsOf(subset).join('') === want) hits += 1;
  }
  return hits === 1;
}

function chordPlan(env) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const count = env.int(1, 3);
    const pool = PERIODS.slice();
    const voices = [];
    while (voices.length < count) voices.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
    voices.sort((a, b) => a - b);
    if (uniqueChord(voices)) return { kind: 'chord', voices };
  }
  return { kind: 'chord', voices: [2, 3] };
}

function carriedChord(env) {
  const p = env.card && env.card.of;
  if (!p || p.kind !== 'chord' || !Array.isArray(p.voices) || p.voices.length < 1 || p.voices.length > 3) return null;
  const voices = p.voices.map(Number);
  if (!voices.every((v) => PERIODS.includes(v)) || new Set(voices).size !== voices.length) return null;
  voices.sort((a, b) => a - b);
  if (!uniqueChord(voices)) return null;
  return { kind: 'chord', voices };
}

function chordTitle(plan) {
  const strikes = sumsOf(plan.voices).reduce((a, b) => a + b, 0);
  return 'the midnight chord: ' + WORDS[strikes] + ' strikes';
}

function chordGeometry(w, h) {
  const left = w * 0.3;
  const right = w * 0.95;
  return { left, right, col: (right - left) / BEATS, stripTop: h * 0.1, stripBottom: h * 0.5, rowTop: h * 0.6, rowGap: h * 0.095 };
}

// The scene: the strip of totals as stacked blocks, then the four voices' own beats.
function drawChord(g, w, h, c, plan, s, variant, t) {
  const v = variant || PLAIN;
  const col = c.colors;
  const geo = chordGeometry(w, h);
  const bars = sumsOf(plan.voices);
  const size = Math.max(9, Math.round(Math.min(w, h) * 0.04));
  const small = Math.max(8, Math.round(size * 0.85));
  background(g, w, h, c);
  dust(g, w, h, c, v, c.reduced ? 0 : t);
  skyDots(g, w, h, c, v);
  const unit = (geo.stripBottom - geo.stripTop) / 4.6;
  // The guides at one to four, so a stack can be read exactly.
  g.lineWidth = 1;
  for (let level = 1; level <= 4; level++) {
    g.strokeStyle = c.alpha(col.muted, 0.1 + 0.08 * v.density);
    g.beginPath();
    g.moveTo(geo.left, geo.stripBottom - level * unit);
    g.lineTo(geo.right, geo.stripBottom - level * unit);
    g.stroke();
  }
  caption(g, w, c, 'total', geo.left - size * 0.6, geo.stripBottom - 2 * unit, 0.7, small, 'right');
  const glow = c.reduced ? 0.5 : (1 + Math.sin(t * 1.5 + v.turn * TAU)) / 2;
  const bw = geo.col * 0.6 * Math.min(1.15, Math.max(0.8, v.scale));
  for (let b = 0; b < BEATS; b++) {
    const x = geo.left + (b + 0.5) * geo.col;
    for (let k = 0; k < bars[b]; k++) {
      const y = geo.stripBottom - (k + 1) * unit;
      g.fillStyle = c.alpha(col.accent, 0.55 + glow * 0.25);
      g.fillRect(x - bw / 2, y + unit * 0.08, bw, unit * 0.84);
      g.strokeStyle = c.alpha(col.accent2, 0.5);
      g.strokeRect(x - bw / 2, y + unit * 0.08, bw, unit * 0.84);
    }
    caption(g, w, c, String(b), x, geo.stripBottom + size * 0.8, 0.7, small);
  }
  g.strokeStyle = c.alpha(col.muted, 0.4);
  g.beginPath();
  g.moveTo(geo.left, geo.stripBottom);
  g.lineTo(geo.right, geo.stripBottom);
  g.stroke();
  // The voices: each on its own row, its beats hollow until it is picked, lit when it is found.
  PERIODS.forEach((p, row) => {
    const y = geo.rowTop + row * geo.rowGap;
    const picked = s.picked.includes(p);
    const shown = s.shown[p];
    const sounding = plan.voices.includes(p);
    const tone = s.reveal && sounding ? col.accent2 : picked ? col.accent : col.muted;
    caption(g, w, c, EVERY[p], geo.left - size * 0.6, y, 0.85, small, 'right');
    g.lineWidth = 1.2;
    for (let b = 0; b < BEATS; b += p) {
      const x = geo.left + (b + 0.5) * geo.col;
      const r = Math.max(2, geo.col * 0.2 * Math.min(1.15, Math.max(0.8, v.scale)));
      if (picked || (s.reveal && sounding)) {
        g.fillStyle = c.alpha(tone, 0.9);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      } else {
        g.strokeStyle = c.alpha(tone, 0.7);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.stroke();
      }
    }
    if (shown) {
      const x = geo.right + size * 0.3;
      g.fillStyle = col.accent2;
      g.font = '600 ' + small + 'px system-ui, sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(shown === 'on' ? 'sounds' : 'silent', x, y);
    }
  });
  g.fillStyle = c.alpha(col.muted, 0.2);
  g.fillRect(geo.left, geo.rowTop - geo.rowGap * 0.6, geo.right - geo.left, 1);
}

function chordBlank() {
  return { picked: [], shown: {}, reveal: false };
}

function chordPreview(g, w, h, env, plan, t) {
  drawChord(g, w, h, env, plan, chordBlank(), env.variant, t || 0);
}

function chordPiece(env, plan) {
  const voices = plan.voices;
  const meet = lcmOf(voices);
  const s = chordBlank();
  let time = 0;
  const draw = (c) => drawChord(c.g, c.w, c.h, c, plan, s, env.variant, time);
  const named = (list) => list.map((p) => EVERY[p]).join(', ');
  // The hints go through the voices in a seeded order, one per press.
  const reveal = [];
  const pool = PERIODS.slice();
  while (pool.length) reveal.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return {
    title: chordTitle(plan),
    brief: 'Four voices sound in the midnight chamber, each on beat 0 and every period after: one every 2nd beat, one every 3rd, one every 4th, one every 5th. '
      + 'Some of them are sounding. The strip shows only the total of voices per beat, as stacked blocks.',
    goal: 'Say which voices are sounding, and on which beat after beat 0 they next all strike together.',
    aspect: '4 / 3',
    checkLabel: 'check the chord',
    steps: [
      { id: 'voices', ask: 'the voices that are sounding', kind: 'pick', items: PERIODS.map((p) => ({ label: EVERY[p], value: p })) },
      { id: 'meet', ask: 'the first beat after 0 on which every sounding voice strikes at once', kind: 'number', min: 2, max: 60, step: 1, unit: 'beat' },
      { id: 'hint', ask: 'whether one voice is sounding', kind: 'press', count: 1, label: 'show me one', optional: true }
    ],
    solution: { voices: voices.slice(), meet },
    check(c) {
      const chosen = Array.isArray(c.value('voices')) ? c.value('voices').map(Number) : [];
      const right = chosen.filter((p) => voices.includes(p)).length;
      const extra = chosen.length - right;
      const missing = voices.length - right;
      const pickRight = extra === 0 && missing === 0;
      const meetRight = Number(c.value('meet')) === meet;
      if (pickRight && meetRight) return { solved: true, say: 'the chord is ' + named(voices) + ', together again on beat ' + meet };
      const parts = [];
      if (!pickRight) {
        if (right === 0) parts.push('none of the voices you picked is sounding');
        else parts.push(WORDS[right] + ' of your picks ' + (right === 1 ? 'is' : 'are') + ' sounding' + (extra ? ', ' + WORDS[extra] + ' ' + (extra === 1 ? 'is' : 'are') + ' not' : ''));
        if (!extra && missing) parts.push('a voice is still missing');
      }
      if (!meetRight) parts.push('the meeting beat is off');
      return { solved: false, say: parts.join('; ') };
    },
    start(c) {
      c.status('twelve beats, four voices, one chord');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'voices' && Array.isArray(value)) {
        s.picked = value.map(Number).filter((p) => PERIODS.includes(p));
        c.status(s.picked.length ? 'picked: ' + named(s.picked) : 'no voice picked');
      }
      if (id === 'meet') {
        const b = Number(value);
        if (Number.isFinite(b)) c.status('together again on beat ' + Math.round(b) + ', you say');
      }
      if (id === 'hint') {
        const next = reveal.find((p) => !s.shown[p]);
        if (next !== undefined) {
          s.shown[next] = voices.includes(next) ? 'on' : 'off';
          c.hint();
          c.status('the voice on ' + EVERY[next] + ' is ' + (s.shown[next] === 'on' ? 'sounding' : 'silent'));
        } else {
          c.status('every voice has been shown; the meeting beat is yours to work out');
        }
      }
      draw(c);
    },
    frame(t, dt, c) {
      time += Math.max(0, dt);
      draw(c);
    },
    end(c) {
      s.reveal = true;
      c.status('the chord was ' + named(voices) + '; it strikes whole again on beat ' + meet);
      draw(c);
    }
  };
}

/* ---- the module ----------------------------------------------------------------------------- */

function dealsEcho(env) {
  return env.chance(0.5);
}

export default {
  id: 'constellation-echo',
  needsSky: true,
  paint(g, w, h, env) {
    if (dealsEcho(env)) echoPreview(g, w, h, env, echoPlan(env), env.variant.turn * 3);
    else chordPreview(g, w, h, env, chordPlan(env), env.variant.turn * 4);
  },
  animate(g, w, h, env, t) {
    if (dealsEcho(env)) echoPreview(g, w, h, env, echoPlan(env), t + env.variant.turn * 3);
    else chordPreview(g, w, h, env, chordPlan(env), t + env.variant.turn * 4);
  },
  spark(env) {
    if (dealsEcho(env)) {
      const plan = echoPlan(env);
      const order = byDistance(plan);
      return {
        title: echoTitle(plan),
        quote: 'a pulse leaves the mark; star ' + LETTERS[order[0]] + ' answers first, or does it?',
        text: 'Every star sends an echo back, the farther the later. Put the ' + WORDS[plan.stars.length] + ' stars in the order their echoes return.',
        aspect: '1 / 1',
        paint: (g, w, h, cardEnv) => echoPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 3),
        of: plan
      };
    }
    const plan = chordPlan(env);
    return {
      title: chordTitle(plan),
      mono: 'beat   ' + sumsOf(plan.voices).map((n, i) => String(i).padStart(2, ' ')).join('') + '\ntotal  ' + sumsOf(plan.voices).map((n) => String(n).padStart(2, ' ')).join(''),
      text: 'Four voices on periods of 2, 3, 4 and 5 beats; some are sounding. From the totals alone, say which, and when they next all strike together.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => chordPreview(g, w, h, cardEnv, plan, cardEnv.variant.turn * 4),
      of: plan
    };
  },
  piece(env) {
    const echo = carriedEcho(env);
    if (echo) return echoPiece(env, echo);
    const chord = carriedChord(env);
    if (chord) return chordPiece(env, chord);
    return dealsEcho(env) ? echoPiece(env, echoPlan(env)) : chordPiece(env, chordPlan(env));
  }
};
