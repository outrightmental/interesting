/* Paper cutouts and the shadows they cast. Each piece keeps its own light, marks and curtain. */

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

function firstPiece(env, p) {
  const s = {
    form: p.options[0], lamp: p.lamp / 100, angle: p.angle,
    holes: [], cues: [], raised: false, final: 0, finalLine: ''
  };
  const draw = (c) => scene(c.g, c.w, c.h, c, s, PLAIN, false);
  return {
    title: 'the ' + p.options[0] + ' behind the curtain',
    brief: 'Choose a paper cutout, move the lamp, tap anywhere to pierce the shadow ' + p.holes + ' times, and raise the curtain to see what appears.',
    aspect: '4 / 3',
    steps: [
      { id: 'cutout', ask: 'the paper cutout', kind: 'choice', options: p.options.map((form) => ({ label: 'the ' + form, value: form })) },
      { id: 'lamp', ask: 'where the lamp stands', kind: 'range', min: 0, max: 100, step: 1, value: p.lamp, low: 'left', high: 'right' },
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

function secondPiece(env, p) {
  const pairings = [[p.options[0], p.options[1]], [p.options[0], p.options[2]], [p.options[1], p.options[2]]];
  const s = {
    pair: pairings[0], lamp: p.lamp / 100, overlap: 0.5, reverse: false,
    angle: p.angle, holes: [], cues: [], raised: false, final: 0, finalLine: ''
  };
  const draw = (c) => scene(c.g, c.w, c.h, c, s, PLAIN, true);
  return {
    title: 'two cutouts, one shadow',
    brief: 'Choose two paper figures, slide their shadows together, swap which stands forward, tap anywhere to place ' + p.cues + ' pools of light, and hold to raise the curtain.',
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

export default {
  id: 'shadow-theatre',
  needsSky: false,
  paint(g, w, h, env) {
    picture(g, w, h, env, plan(env), isDuet(env));
  },
  spark(env) {
    const p = plan(env);
    const duet = isDuet(env);
    return {
      title: 'the shadow theatre',
      text: duet
        ? 'Two cutouts share the light. Slide their shadows together and discover what they cast.'
        : 'Pierce a paper shadow, move the lamp and see what waits behind the curtain.',
      aspect: '4 / 3',
      paint: (g, w, h, cardEnv) => picture(g, w, h, cardEnv, p, duet)
    };
  },
  piece(env) {
    const p = plan(env);
    return isDuet(env) ? secondPiece(env, p) : firstPiece(env, p);
  }
};
