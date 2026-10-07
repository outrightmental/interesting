/* Paper cutouts and the shadows they cast. Each piece keeps its own light, marks and curtain.
   A third shape projects a carved cylinder: its circular end, square side and triangular cut
   belong to one solid. Shadows are convex hulls of its projected vertices, not swapped pictures.

   A card and the feature it opens as are one night at the theatre: the spark puts the cutouts it
   has cut and where its lamp stands on its spec as `of`, or carries the whole carved-solid plan,
   and the piece opens with that same subject and configuration. */

const FORMS = ['moth', 'owl', 'fish', 'hare'];
const PLACES = [
  'a door smaller than its key',
  'a sea with no horizon',
  'an extra room inside the wall',
  'a roof full of borrowed stars',
  'a window looking back at you',
  'a passage through the paper'
];
const PLAIN = { density: 1, scale: 1, turn: 0 };

function plan(env) {
  const pool = FORMS.slice();
  const options = [];
  while (options.length < 3) options.push(pool.splice(env.int(0, pool.length - 1), 1)[0]);
  return {
    options,
    lamp: env.int(20, 80),
    holes: env.int(2, 3),
    cues: env.int(2, 3),
    hold: env.pick([900, 1200, 1500]),
    place: env.int(0, PLACES.length - 1),
    angle: (env.rnd() - 0.5) * 0.18
  };
}

function isDuet(env) {
  return (env.seed & 1) === 1;
}

// The card this piece was opened from, in the theatre's own terms: the three cutouts it had cut
// and where its lamp stood, or null for a piece nobody pressed (js/stage.js hands the card over as
// env.card.of). Three is what a night is cut from: two of them pair off and the third is the
// choice, so a card that says anything else is no card this piece can be of.
function pressed(env) {
  const was = env.card && env.card.of;
  const list = was && Array.isArray(was.forms) ? was.forms : [];
  const forms = list.filter((form, i) => FORMS.indexOf(form) >= 0 && list.indexOf(form) === i);
  if (forms.length !== 3) return null;
  const lamp = Number(was.lamp);
  return { forms, lamp: isFinite(lamp) ? Math.max(0, Math.min(100, Math.round(lamp))) : 50 };
}

function outline(g, form) {
  g.beginPath();
  if (form === 'moth') {
    g.ellipse(0, 0, 0.13, 0.43, 0, 0, Math.PI * 2);
    g.moveTo(-0.1, -0.23);
    g.bezierCurveTo(-0.85, -0.8, -0.9, -0.04, -0.12, 0.12);
    g.closePath();
    g.moveTo(0.1, -0.23);
    g.bezierCurveTo(0.85, -0.8, 0.9, -0.04, 0.12, 0.12);
    g.closePath();
    g.moveTo(-0.1, 0.05);
    g.bezierCurveTo(-0.75, 0.02, -0.65, 0.73, -0.05, 0.35);
    g.closePath();
    g.moveTo(0.1, 0.05);
    g.bezierCurveTo(0.75, 0.02, 0.65, 0.73, 0.05, 0.35);
    g.closePath();
  } else if (form === 'owl') {
    g.ellipse(0, 0.02, 0.36, 0.48, 0, 0, Math.PI * 2);
    g.moveTo(-0.33, -0.27);
    g.lineTo(-0.34, -0.67);
    g.lineTo(-0.08, -0.42);
    g.closePath();
    g.moveTo(0.33, -0.27);
    g.lineTo(0.34, -0.67);
    g.lineTo(0.08, -0.42);
    g.closePath();
    g.ellipse(-0.36, 0.09, 0.13, 0.34, -0.25, 0, Math.PI * 2);
    g.ellipse(0.36, 0.09, 0.13, 0.34, 0.25, 0, Math.PI * 2);
  } else if (form === 'fish') {
    g.ellipse(0, 0, 0.5, 0.26, 0, 0, Math.PI * 2);
    g.moveTo(-0.35, 0);
    g.lineTo(-0.88, -0.43);
    g.lineTo(-0.76, 0);
    g.lineTo(-0.88, 0.43);
    g.closePath();
    g.moveTo(-0.05, -0.2);
    g.lineTo(-0.25, -0.5);
    g.lineTo(0.27, -0.2);
    g.closePath();
  } else {
    g.ellipse(-0.12, 0.2, 0.38, 0.24, 0, 0, Math.PI * 2);
    g.ellipse(0.23, -0.04, 0.21, 0.24, 0, 0, Math.PI * 2);
    g.ellipse(0.12, -0.46, 0.09, 0.35, -0.18, 0, Math.PI * 2);
    g.ellipse(0.36, -0.48, 0.09, 0.35, 0.14, 0, Math.PI * 2);
    g.ellipse(-0.35, 0.38, 0.2, 0.09, 0, 0, Math.PI * 2);
  }
}

function holeAt(form, point) {
  return {
    x: (point.x - 0.5) * 0.16,
    y: (form === 'hare' ? 0.18 : 0.02) + (point.y - 0.5) * 0.16
  };
}

function cutout(g, c, form, x, y, size, angle, fill, holes) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(size, size);
  outline(g, form);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = c.alpha(c.colors.accent2, 0.65);
  g.lineWidth = 0.008;
  g.stroke();
  for (const point of holes) {
    const hole = holeAt(form, point);
    const glow = g.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, 0.1);
    glow.addColorStop(0, c.alpha(c.colors.fg, 0.95));
    glow.addColorStop(0.3, c.alpha(c.colors.accent2, 0.7));
    glow.addColorStop(1, c.alpha(c.colors.accent2, 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(hole.x, hole.y, 0.1, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function inscription(g, w, h, c, text, strength) {
  if (!text || strength <= 0) return;
  const size = Math.max(10, Math.min(20, Math.round(Math.min(w, h) * 0.043)));
  g.font = '500 ' + size + 'px system-ui, sans-serif';
  const rows = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && g.measureText(next).width > w * 0.88) {
      rows.push(line);
      line = word;
    } else line = next;
  }
  if (line) rows.push(line);
  const height = rows.length * size * 1.35 + size;
  g.fillStyle = c.alpha(c.colors.bg, 0.92 * strength);
  g.fillRect(0, h - height, w, height);
  g.fillStyle = c.alpha(c.colors.fg, strength);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  rows.forEach((row, i) => g.fillText(row, w / 2, h - height + size + i * size * 1.35));
}

function scene(g, w, h, c, s, variant, duet) {
  const v = variant || PLAIN;
  const m = Math.min(w, h);
  const col = c.colors;
  const lastCue = s.cues.length ? s.cues[s.cues.length - 1] : null;
  const lampX = w * (0.2 + s.lamp * 0.6 + (lastCue ? (lastCue.x - 0.5) * 0.12 : 0));
  const lampY = h * 0.12;
  const background = g.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, col.bg2);
  background.addColorStop(1, col.bg);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  const light = g.createRadialGradient(lampX, lampY, 0, lampX, lampY, m * 1.4);
  light.addColorStop(0, c.alpha(col.accent2, 0.32));
  light.addColorStop(1, c.alpha(col.accent2, 0));
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.alpha(col.accent2, 0.07);
  g.beginPath();
  g.moveTo(lampX, lampY);
  g.lineTo(w * 0.04, h * 0.88);
  g.lineTo(w * 0.96, h * 0.88);
  g.closePath();
  g.fill();
  const folds = Math.max(4, Math.round(9 * v.density));
  g.strokeStyle = c.alpha(col.accent, 0.14);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < folds; i++) {
    const x = w * i / folds;
    g.moveTo(x, 0);
    g.quadraticCurveTo(x - w * 0.035, h * 0.45, x, h);
  }
  g.stroke();
  g.fillStyle = col.accent2;
  g.beginPath();
  g.arc(lampX, lampY, Math.max(3, m * 0.016), 0, Math.PI * 2);
  g.fill();
  const centre = w * (0.53 + (0.5 - s.lamp) * 0.15 + v.turn * 0.05);
  const size = m * (duet ? 0.36 : 0.42) * v.scale;
  if (duet) {
    const gap = m * (0.09 + (1 - s.overlap) * 0.52);
    const first = s.reverse ? s.pair[1] : s.pair[0];
    const second = s.reverse ? s.pair[0] : s.pair[1];
    cutout(g, c, first, centre - gap / 2, h * 0.51, size, s.angle, c.mix(col.bg, col.accent, 0.42), []);
    cutout(g, c, second, centre + gap / 2, h * 0.51, size, -s.angle, c.mix(col.bg, col.accent2, 0.42), []);
    for (const cue of s.cues) {
      g.strokeStyle = c.alpha(col.accent2, 0.7);
      g.beginPath();
      g.arc(cue.x * w, cue.y * h, Math.max(5, m * 0.04), 0, Math.PI * 2);
      g.stroke();
    }
  } else {
    cutout(g, c, s.form, centre, h * 0.52, size, s.angle, c.mix(col.bg, col.accent, 0.43), s.holes);
    cutout(g, c, s.form, w * 0.17, h * 0.76, m * 0.11, 0, c.mix(col.bg, col.accent2, 0.24), []);
    g.strokeStyle = c.alpha(col.accent2, 0.5);
    g.beginPath();
    g.moveTo(w * 0.17, h * 0.82);
    g.lineTo(w * 0.17, h);
    g.stroke();
  }
  const curtain = s.raised ? h * 0.055 : h * 0.18;
  g.fillStyle = c.mix(col.bg2, col.bg, 0.55);
  g.fillRect(0, 0, w, curtain);
  g.strokeStyle = c.alpha(col.accent2, 0.65);
  g.beginPath();
  g.moveTo(0, curtain);
  g.lineTo(w, curtain);
  g.stroke();
  inscription(g, w, h, c, s.finalLine, s.final);
}

function firstPiece(env, p, was) {
  // The cutouts on the bench and where the lamp stands: the card's, when a card was pressed, so
  // the feature opens as that very card rather than as another night this seed could have had.
  const options = was ? was.forms : p.options;
  const lamp = was ? was.lamp : p.lamp;
  const s = {
    form: options[0], lamp: lamp / 100, angle: p.angle,
    holes: [], cues: [], raised: false, final: 0, finalLine: ''
  };
  const draw = (c) => scene(c.g, c.w, c.h, c, s, PLAIN, false);
  return {
    title: 'the ' + options[0] + ' behind the curtain',
    brief: 'Choose a paper cutout, move the lamp, tap anywhere to pierce the shadow ' + p.holes + ' times, and raise the curtain to see what appears.',
    aspect: '4 / 3',
    steps: [
      { id: 'cutout', ask: 'the paper cutout', kind: 'choice', options: options.map((form) => ({ label: 'the ' + form, value: form })) },
      { id: 'lamp', ask: 'where the lamp stands', kind: 'range', min: 0, max: 100, step: 1, value: lamp, low: 'left', high: 'right' },
      { id: 'pierce', ask: 'pierce the shadow ' + p.holes + ' times', kind: 'tap', label: 'pierce it for me', after: 'cutout' },
      { id: 'curtain', ask: 'raise the curtain', kind: 'press', count: 1, label: 'raise the curtain' }
    ],
    start(c) {
      c.status('The lamp is on. Choose one of the paper cutouts.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'cutout') {
        s.form = String(value);
        c.status('The ' + s.form + ' is between the lamp and the screen.');
      }
      if (id === 'lamp') {
        s.lamp = Math.max(0, Math.min(1, Number(value) / 100));
        c.status('The lamp moves; the shadow slides across the screen.');
      }
      if (id === 'curtain') {
        s.raised = true;
        c.status('The curtain is raised. The paper still has choices left.');
      }
      draw(c);
    },
    tap(x, y, c) {
      if (s.holes.length >= p.holes) return;
      s.holes.push({ x, y });
      c.progress('pierce', s.holes.length / p.holes);
      c.status(s.holes.length + ' of ' + p.holes + ' pinholes let light through the ' + s.form + '.');
      if (s.holes.length >= p.holes) c.satisfy('pierce');
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) s.final = c.reduced ? 1 : Math.min(1, s.final + dt * 1.5);
      draw(c);
    },
    end(c) {
      const marks = s.holes.reduce((sum, point) => sum + Math.round((point.x + point.y) * 3), 0);
      s.finalLine = 'The ' + s.form + ' opens onto ' + PLACES[(p.place + Math.round(s.lamp * 7) + marks) % PLACES.length] + '.';
      c.status(s.finalLine);
      if (c.reduced) s.final = 1;
      draw(c);
    }
  };
}

function secondPiece(env, p, was) {
  // As above: the card's three cutouts pair off, and its lamp is where this night starts.
  const options = was ? was.forms : p.options;
  const lamp = was ? was.lamp : p.lamp;
  const pairings = [[options[0], options[1]], [options[0], options[2]], [options[1], options[2]]];
  const s = {
    pair: pairings[0], lamp: lamp / 100, overlap: 0.5, reverse: false,
    angle: p.angle, holes: [], cues: [], raised: false, final: 0, finalLine: ''
  };
  const draw = (c) => scene(c.g, c.w, c.h, c, s, PLAIN, true);
  return {
    title: 'two cutouts, one shadow',
    brief: 'Choose two paper figures, slide their shadows together, swap which stands forward, tap anywhere to place ' + p.cues + ' pools of light, and hold to raise the curtain.'
      + (was ? ' The lamp stands at ' + lamp + ', where your card left it.' : ''),
    aspect: '4 / 3',
    steps: [
      { id: 'pair', ask: 'which two paper figures', kind: 'choice', options: pairings.map((pair, i) => ({ label: 'the ' + pair[0] + ' and the ' + pair[1], value: i })) },
      { id: 'overlap', ask: 'how far their shadows overlap', kind: 'range', min: 0, max: 100, step: 1, value: 50, low: 'apart', high: 'together' },
      { id: 'reverse', ask: 'which figure stands forward', kind: 'toggle', label: 'swap the figures' },
      { id: 'cue', ask: 'place ' + p.cues + ' pools of light', kind: 'tap', label: 'place a light for me', after: 'pair' },
      { id: 'curtain', ask: 'raise the curtain', kind: 'hold', ms: p.hold, label: 'hold to raise the curtain' }
    ],
    start(c) {
      c.status('Two cutouts wait under one lamp. Choose a pair.');
      draw(c);
    },
    apply(id, value, c) {
      if (id === 'pair') {
        s.pair = pairings[Number(value)];
        c.status('The ' + s.pair[0] + ' and the ' + s.pair[1] + ' share the screen.');
      }
      if (id === 'overlap') {
        s.overlap = Math.max(0, Math.min(1, Number(value) / 100));
        c.status(s.overlap > 0.7 ? 'The shadows nearly become one.' : 'There is room between the shadows.');
      }
      if (id === 'reverse') {
        s.reverse = !!value;
        c.status('The figures trade places in the beam.');
      }
      if (id === 'curtain') {
        s.raised = true;
        c.status('The curtain is raised over the two shadows.');
      }
      draw(c);
    },
    tap(x, y, c) {
      if (s.cues.length >= p.cues) return;
      s.cues.push({ x, y });
      c.progress('cue', s.cues.length / p.cues);
      c.status('Light ' + s.cues.length + ' of ' + p.cues + ' is on the screen.');
      if (s.cues.length >= p.cues) c.satisfy('cue');
      draw(c);
    },
    frame(t, dt, c) {
      if (c.done) s.final = c.reduced ? 1 : Math.min(1, s.final + dt * 1.5);
      draw(c);
    },
    end(c) {
      const marks = s.cues.reduce((sum, point) => sum + Math.round((point.x + point.y) * 3), 0);
      s.finalLine = 'The ' + s.pair[0] + ' and the ' + s.pair[1] + ' cast ' + PLACES[(p.place + Math.round(s.overlap * 7) + marks) % PLACES.length] + '.';
      c.status(s.finalLine);
      if (c.reduced) s.final = 1;
      draw(c);
    }
  };
}

function picture(g, w, h, env, p, duet) {
  const s = {
    form: p.options[0], pair: [p.options[0], p.options[1]],
    lamp: p.lamp / 100, overlap: 0.55, reverse: false,
    angle: p.angle, holes: [], cues: [], raised: false, final: 0, finalLine: ''
  };
  scene(g, w, h, env, s, env.variant || PLAIN, duet);
}

const SOLID_VIEWS = [
  { value: 'above', label: 'overhead', shape: 'circle', direction: [0, 0, 1] },
  { value: 'left', label: 'from the left', shape: 'square', direction: [1, 0, 0] },
  { value: 'front', label: 'from the front', shape: 'triangle', direction: [0, -1, 0] }
];
const SOLID_GUESSES = [
  { label: 'a circle', value: 'circle' },
  { label: 'a square', value: 'square' },
  { label: 'a triangle', value: 'triangle' },
  { label: 'something in between', value: 'between' }
];

function dealsSolid(env) {
  return (env.seed >>> 0) % 3 === 0;
}

function solidPlan(env) {
  const view = env.pick(SOLID_VIEWS).value;
  const rest = SOLID_VIEWS.map((v) => v.value).filter((v) => v !== view);
  if (env.chance(0.5)) rest.reverse();
  return {
    family: 'carved-solid',
    number: env.int(100, 999),
    view,
    views: [view].concat(rest),
    facets: env.pick([32, 40, 48]),
    flipped: env.chance(0.5),
    camera: env.int(28, 62),
    duration: env.pick([2.4, 3.2, 4])
  };
}

function carriedSolid(env) {
  const p = env.card && env.card.of;
  const views = SOLID_VIEWS.map((v) => v.value);
  if (!p || p.family !== 'carved-solid'
      || !Number.isInteger(p.number) || p.number < 100 || p.number > 999
      || !views.includes(p.view)
      || !Array.isArray(p.views) || p.views.length !== 3
      || p.views[0] !== p.view || new Set(p.views).size !== 3
      || !p.views.every((v) => views.includes(v))
      || !Number.isInteger(p.facets) || p.facets < 24 || p.facets > 64 || p.facets % 4 !== 0
      || typeof p.flipped !== 'boolean'
      || !Number.isFinite(p.camera) || p.camera < 28 || p.camera > 62
      || !Number.isFinite(p.duration) || p.duration < 2 || p.duration > 5) return null;
  return p;
}

function solidTitle(p) {
  return 'solid ' + p.number + ': three different shadows';
}

// Intersect x*x + y*y <= 1 with 2*abs(x)-1 <= z <= 1. Projecting along z gives
// the circle, along y the triangle, and along x the square. Cardinal vertices stay exact.
function solidMesh(p, variant) {
  const n = 4 * Math.max(6, Math.min(20, Math.round(p.facets * variant.density / 4)));
  const top = [];
  const bottom = [];
  const sign = p.flipped ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a);
    top.push([x, y, sign]);
    bottom.push([x, y, sign * (2 * Math.abs(x) - 1)]);
  }
  const faces = [top];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([top[i], top[j], bottom[j], bottom[i]]);
  }
  const east = [];
  const west = [];
  for (let i = 3 * n / 4; i <= 5 * n / 4; i++) east.push(bottom[i % n]);
  for (let i = n / 4; i <= 3 * n / 4; i++) west.push(bottom[i]);
  faces.push(east, west);
  return { vertices: top.concat(bottom), faces };
}

function tiltSolid(point, degrees) {
  const a = degrees * Math.PI / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [point[0] * cos + point[2] * sin, point[1], point[2] * cos - point[0] * sin];
}

function shadowPoint(point, view) {
  if (view === 'above') return { x: point[0], y: -point[1] };
  if (view === 'left') return { x: point[1], y: -point[2] };
  return { x: point[0], y: -point[2] };
}

function shadowHull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = sorted.filter((p, i) => i === 0
    || Math.abs(p.x - sorted[i - 1].x) > 1e-9 || Math.abs(p.y - sorted[i - 1].y) > 1e-9);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower = [];
  const upper = [];
  for (const p of unique) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function solidNormal(face) {
  const a = face[0];
  let normal = null;
  for (let i = 1; i < face.length - 1; i++) {
    const u = face[i].map((v, k) => v - a[k]);
    const v = face[i + 1].map((v, k) => v - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n);
    if (length > 1e-9) {
      normal = n.map((value) => value / length);
      break;
    }
  }
  if (!normal) return null;
  const centre = [0, 1, 2].map((k) => face.reduce((sum, p) => sum + p[k], 0) / face.length);
  if (normal.reduce((sum, value, k) => sum + value * centre[k], 0) < 0) normal = normal.map((v) => -v);
  return { normal, centre };
}

function solidCamera(yaw) {
  const a = yaw;
  const elevation = Math.PI * 0.19;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  return {
    direction: [sa * ce, ca * ce, se],
    project(p) {
      const depth = p[0] * sa + p[1] * ca;
      return { x: p[0] * ca - p[1] * sa, y: depth * se - p[2] * ce, depth: depth * ce + p[2] * se };
    }
  };
}

function solidPath(g, points) {
  g.beginPath();
  points.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
  g.closePath();
}

function solidObject(g, w, h, c, p, s, mesh, variant) {
  const col = c.colors;
  const camera = solidCamera(p.camera * Math.PI / 180 + variant.turn * Math.PI * 2);
  const lamp = SOLID_VIEWS.find((v) => v.value === s.view);
  const cx = w * 0.22;
  const cy = h * 0.47;
  const size = Math.min(w * 0.4, h * 0.72) * 0.23 * variant.scale;
  const project = (point) => {
    const at = camera.project(point);
    return { x: cx + at.x * size, y: cy + at.y * size, depth: at.depth };
  };
  const faces = mesh.faces.map((face) => {
    const tilted = face.map((point) => tiltSolid(point, s.tilt));
    const surface = solidNormal(tilted);
    if (!surface) return null;
    const facing = surface.normal.reduce((sum, v, k) => sum + v * camera.direction[k], 0);
    if (facing <= 1e-9) return null;
    return {
      points: tilted.map(project),
      depth: camera.project(surface.centre).depth,
      light: Math.max(0, surface.normal.reduce((sum, v, k) => sum + v * lamp.direction[k], 0))
    };
  }).filter(Boolean).sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    solidPath(g, face.points);
    g.fillStyle = c.mix(col.bg2, col.accent, 0.18 + face.light * 0.58);
    g.fill();
    g.strokeStyle = c.alpha(col.fg, 0.32);
    g.lineWidth = Math.max(0.6, variant.density);
    g.stroke();
  }
  const source = project(lamp.direction.map((v) => v * 2.3));
  source.x = Math.max(w * 0.035, Math.min(w * 0.405, source.x));
  source.y = Math.max(h * 0.22, Math.min(h * 0.73, source.y));
  g.strokeStyle = c.alpha(col.accent2, 0.65);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(source.x, source.y);
  g.lineTo(source.x + (cx - source.x) * 0.58, source.y + (cy - source.y) * 0.58);
  g.stroke();
  g.fillStyle = col.accent2;
  g.beginPath();
  g.arc(source.x, source.y, Math.max(2, Math.min(w, h) * 0.012), 0, Math.PI * 2);
  g.fill();
}

function traceShadow(g, points, fraction) {
  const lengths = points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - p.x, next.y - p.y);
  });
  let left = lengths.reduce((sum, n) => sum + n, 0) * fraction;
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length && left > 0; i++) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    const f = Math.min(1, left / (lengths[i] || 1));
    g.lineTo(p.x + (next.x - p.x) * f, p.y + (next.y - p.y) * f);
    left -= lengths[i];
  }
  g.stroke();
}

function solidScene(g, w, h, c, p, s, variant) {
  const v = variant || PLAIN;
  const col = c.colors;
  const m = Math.min(w, h);
  const mesh = solidMesh(p, v);
  const background = g.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, col.bg2);
  background.addColorStop(1, col.bg);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  solidObject(g, w, h, c, p, s, mesh, v);

  const wall = { x: w * 0.44, y: h * 0.2, w: w * 0.51, h: h * 0.59 };
  const size = Math.min(wall.w, wall.h) * 0.29 * v.scale;
  const hull = shadowHull(mesh.vertices.map((point) => shadowPoint(tiltSolid(point, s.tilt), s.view)));
  const points = hull.map((point) => ({
    x: wall.x + wall.w / 2 + point.x * size,
    y: wall.y + wall.h / 2 + point.y * size
  }));
  g.save();
  g.beginPath();
  g.rect(wall.x, wall.y, wall.w, wall.h);
  g.clip();
  g.fillStyle = c.mix(col.bg2, col.accent2, 0.7);
  g.fillRect(wall.x, wall.y, wall.w, wall.h);
  solidPath(g, points);
  g.fillStyle = col.bg;
  g.fill();
  if (s.raised) {
    g.strokeStyle = col.bg;
    g.lineWidth = Math.max(1.5, m * 0.009 * v.density);
    traceShadow(g, points, s.phase);
  }
  const peek = 0.14 + v.turn * 0.08;
  const open = s.raised ? peek + (1 - peek) * s.phase : peek;
  const edge = wall.y + wall.h * (1 - open);
  g.fillStyle = c.mix(col.bg2, col.bg, 0.42);
  g.fillRect(wall.x, wall.y, wall.w, edge - wall.y);
  const folds = Math.max(4, Math.round(8 * v.density));
  g.strokeStyle = c.alpha(col.accent, 0.25);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < folds; i++) {
    const x = wall.x + wall.w * i / folds;
    g.moveTo(x, wall.y);
    g.lineTo(x, edge);
  }
  g.stroke();
  g.strokeStyle = col.accent2;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(wall.x, edge);
  g.lineTo(wall.x + wall.w, edge);
  g.stroke();
  g.restore();
  g.strokeStyle = c.alpha(col.fg, 0.6);
  g.lineWidth = 1;
  g.strokeRect(wall.x, wall.y, wall.w, wall.h);
  const textSize = Math.max(10, Math.min(20, Math.round(m * 0.04)));
  g.font = '500 ' + textSize + 'px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = col.fg;
  g.fillText('the solid', w * 0.22, h * 0.12);
  g.fillText('its shadow', wall.x + wall.w / 2, h * 0.12);
  inscription(g, w, h, c, s.finished ? 'one solid: circle, square, triangle' : 'solid ' + p.number, 1);
}

function solidShape(s) {
  // Rotation about y only rotates the triangle within the front projection; the other
  // two silhouettes lose their exact circle or square as soon as the solid is tilted.
  if (s.view === 'front') return 'triangle';
  return Math.abs(s.tilt) < 0.001 ? SOLID_VIEWS.find((v) => v.value === s.view).shape : 'between';
}

function solidFinding(s) {
  const shape = solidShape(s);
  return shape === 'between' ? 'The tilted shadow has a rounded outline between the simple shapes.'
    : 'The shadow is a ' + shape + '.';
}

function solidSetting(s) {
  const lamp = SOLID_VIEWS.find((v) => v.value === s.view);
  return 'Lamp ' + lamp.label + '; tilt ' + s.tilt + ' degrees. ';
}

function solidPreview(g, w, h, env, p) {
  solidScene(g, w, h, env, p, {
    view: p.view, tilt: 0, raised: false, phase: 0, finished: false
  }, env.variant || PLAIN);
}

function solidPiece(env, carried) {
  const p = carried || solidPlan(env);
  const s = { view: p.view, tilt: 0, guess: '', raised: false, elapsed: 0, phase: 0, traced: false, finished: false };
  const draw = (c) => solidScene(c.g, c.w, c.h, c, p, s, env.variant || PLAIN);
  function setting(c) {
    c.status(solidSetting(s) + (s.traced ? solidFinding(s) : 'The curtain covers most of the shadow.'));
  }
  return {
    title: solidTitle(p),
    brief: 'Move the lamp, tilt this carved cylinder, predict its shadow and raise the curtain. You can try all three lamp positions before making your prediction; any prediction works, and the object never changes.',
    aspect: '4 / 3',
    steps: [
      { id: 'lamp', ask: 'where the light comes from', kind: 'choice', options: p.views.map((value) => ({ label: SOLID_VIEWS.find((v) => v.value === value).label, value })) },
      { id: 'tilt', ask: 'tilt the solid; zero is straight on', kind: 'range', min: -30, max: 30, step: 1, value: 0, low: '-30 degrees', high: '+30 degrees' },
      { id: 'guess', ask: 'what outline will this lamp reveal?', kind: 'choice', options: SOLID_GUESSES },
      { id: 'curtain', ask: 'raise the curtain', kind: 'press', count: 1, label: 'raise the curtain' },
      { id: 'trace', ask: 'watch the light draw the outline', kind: 'wait', after: 'curtain' }
    ],
    start(c) {
      c.status('Solid ' + p.number + ' has one round end and two sloping cuts at the other. The curtain leaves a sliver of its shadow. ' + solidSetting(s));
      draw(c);
    },
    apply(id, value, c) {
      if (c.done) return;
      if (id === 'lamp') {
        if (p.views.includes(value)) s.view = value;
        setting(c);
      }
      if (id === 'tilt') {
        const n = Number(value);
        if (Number.isFinite(n)) s.tilt = Math.max(-30, Math.min(30, Math.round(n)));
        setting(c);
      }
      if (id === 'guess') {
        const prediction = SOLID_GUESSES.find((g) => g.value === value);
        if (prediction) {
          s.guess = prediction.value;
          c.status('You predict ' + prediction.label + '. ' + (s.traced ? solidFinding(s) : 'The same solid is still behind the curtain.'));
        }
      }
      if (id === 'curtain' && !s.raised) {
        s.raised = true;
        c.status(c.reduced ? 'The curtain is raised without movement.' : 'The curtain is rising. The light is drawing this solid, not another one.');
      }
      draw(c);
    },
    frame(t, dt, c) {
      if (s.raised && !s.traced) {
        s.elapsed = c.reduced ? p.duration : Math.min(p.duration, s.elapsed + dt);
        s.phase = s.elapsed / p.duration;
        c.progress('trace', s.phase);
        if (s.elapsed >= p.duration) {
          s.traced = true;
          c.status(solidSetting(s) + solidFinding(s) + ' The lamp and tilt still work while you have choices left.');
          c.satisfy('trace');
        }
      }
      draw(c);
    },
    end(c) {
      s.raised = true;
      s.traced = true;
      s.phase = 1;
      s.finished = true;
      const prediction = SOLID_GUESSES.find((g) => g.value === s.guess);
      const verdict = s.guess === solidShape(s) ? 'You called it.' : 'You predicted ' + (prediction ? prediction.label : 'another outline') + '.';
      c.status(solidSetting(s) + solidFinding(s) + ' ' + verdict
        + ' One round end and two sloping cuts make all three straight-on shadows: circle, square and triangle. Tilting changes the outline; no object was swapped.');
      draw(c);
    }
  };
}

export default {
  id: 'shadow-theatre',
  needsSky: false,
  paint(g, w, h, env) {
    if (dealsSolid(env)) solidPreview(g, w, h, env, solidPlan(env));
    else picture(g, w, h, env, plan(env), isDuet(env));
  },
  spark(env) {
    if (dealsSolid(env)) {
      const p = solidPlan(env);
      return {
        title: solidTitle(p),
        text: 'This carved cylinder can cast a circle, a square and a triangle. Change the lamp, predict the outline and lift the curtain; the object never changes.',
        mono: 'lamp  ' + SOLID_VIEWS.find((v) => v.value === p.view).label + '\ntilt  0 degrees',
        aspect: '4 / 3',
        paint: (g, w, h, cardEnv) => solidPreview(g, w, h, cardEnv, p),
        of: p
      };
    }
    const p = plan(env);
    const duet = isDuet(env);
    return {
      // What a card says is what was cut for this night and where the lamp was set for it, so two
      // cards of this world read as two nights rather than as one world's standing line.
      title: duet ? 'the ' + p.options[0] + ' and the ' + p.options[1] : 'the ' + p.options[0] + ' behind the curtain',
      text: duet
        ? 'Two cutouts share the light. Slide their shadows together and discover what they cast.'
        : 'Pierce a paper shadow, move the lamp and see what waits behind the curtain.',
      mono: 'cutouts  ' + p.options.join(', ') + '\nlamp     ' + p.lamp + ' from the left',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => picture(g, w, h, cardEnv, p, duet),
      // What this card is of, for the feature it opens as: the cutouts it has cut and where its
      // lamp stands.
      of: { forms: p.options, lamp: p.lamp }
    };
  },
  piece(env) {
    const solid = carriedSolid(env);
    const was = pressed(env);
    if (solid || (!was && dealsSolid(env))) return solidPiece(env, solid);
    const p = plan(env);
    return isDuet(env) ? secondPiece(env, p, was) : firstPiece(env, p, was);
  }
};
