/* The pulse choir: the persona's stars as voices in a looping choir. As a card it is the choir
   field with one printed score (paint, spark); as a piece it is a choir to conduct -- a tempo, a
   few voices muted by touch, a reshuffle, and a run of bars, or a score printed from the whole
   sky. See js/feed.js for what a module is and js/stage.js for what a piece is. */

var WAVES = ['sine', 'triangle', 'saw', 'square'];
var SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19];
var NOTES = ['A', 'C', 'D', 'E', 'G', 'A', 'C', 'D', 'E'];

// The choir field. `reach` is how far a voice hears its neighbours, as a multiple of the distance
// the choir is written at: a card's own, from the configuration it was dealt, and one for the
// piece, where the field is the choir itself.
function field(ctx, w, h, env, voices, t, flash, reach) {
  var c = env.colors;
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg2);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // A drift of faint motes behind the voices.
  for (var k = 0; k < 36; k++) {
    var sx = (k * 129.1 + t * 9) % w;
    var sy = (k * 81.4 + t * 6) % h;
    ctx.beginPath();
    ctx.fillStyle = env.alpha(c.fg, 0.05 + (k % 5) * 0.02);
    ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  var maxD = Math.min(w, h) * 0.3 * (reach || 1);
  var maxD2 = maxD * maxD;
  for (var a = 0; a < voices.length; a++) {
    for (var b = a + 1; b < voices.length; b++) {
      var dx = voices[b].x - voices[a].x;
      var dy = voices[b].y - voices[a].y;
      var d2 = dx * dx + dy * dy;
      if (d2 > maxD2) continue;
      var quiet = voices[a].muted || voices[b].muted;
      ctx.strokeStyle = env.alpha(c.accent, (0.08 + (1 - d2 / maxD2) * 0.3) * (quiet ? 0.4 : 1));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(voices[a].x, voices[a].y);
      ctx.lineTo(voices[b].x, voices[b].y);
      ctx.stroke();
    }
  }
  for (var i = 0; i < voices.length; i++) {
    var v = voices[i];
    var glow = 5 + v.pulse * 12;
    ctx.beginPath();
    ctx.fillStyle = v.muted ? env.alpha(c.muted, 0.12 + v.pulse * 0.16) : env.alpha(c.accent2, 0.16 + v.pulse * 0.2);
    ctx.arc(v.x, v.y, glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = v.muted ? env.alpha(c.muted, 0.9) : env.alpha(c.fg, 0.96);
    ctx.arc(v.x, v.y, 2.2 + v.pulse * 1.2, 0, Math.PI * 2);
    ctx.fill();
    if (v.muted) {
      ctx.strokeStyle = env.alpha(c.muted, 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(v.x - 5, v.y - 5);
      ctx.lineTo(v.x + 5, v.y + 5);
      ctx.stroke();
    }
  }
  if (flash > 0) {
    ctx.fillStyle = env.alpha(c.accent2, flash * 0.18);
    ctx.fillRect(0, 0, w, h);
  }
}

// The card's picture: every star a voice, pulsing in turn. The configuration the card was dealt says
// how many of them are singing, how hard they pulse and how far each hears its neighbours, and
// where in the loop the card caught the choir.
function drawChoir(ctx, w, h, env, t) {
  var cfg = env.variant;
  var at = (t || 0) + cfg.turn * 6;
  var pts = env.points(w, h, 14);
  var singing = Math.max(1, Math.round(pts.length * cfg.density));
  var voices = pts.map(function (p, i) {
    return { x: p.x, y: p.y, muted: i >= singing, pulse: Math.max(0, Math.sin(at * 2 + i * 0.9)) * 0.4 * cfg.scale };
  });
  field(ctx, w, h, env, voices, at, 0, cfg.scale);
}

function summary(stars) {
  var cx = 0;
  var cy = 0;
  for (var i = 0; i < stars.length; i++) {
    cx += stars[i].x;
    cy += stars[i].y;
  }
  cx /= stars.length || 1;
  cy /= stars.length || 1;
  var spread = 0;
  for (var j = 0; j < stars.length; j++) {
    spread += Math.hypot(stars[j].x - cx, stars[j].y - cy);
  }
  spread /= stars.length || 1;
  return { cx: cx, cy: cy, spread: spread };
}

function zoneOf(s) {
  return (s.cy < 50 ? 'north' : 'south') + '-' + (s.cx < 50 ? 'west' : 'east');
}

function spreadWord(s) {
  return s.spread < 12 ? 'compact' : (s.spread < 24 ? 'balanced' : 'wide');
}

function noteOf(star) {
  var degree = Math.max(0, Math.min(SCALE.length - 1, Math.floor((star.x / 100) * SCALE.length)));
  var lift = Math.floor((100 - star.y) / 34);
  return NOTES[degree] + (2 + lift);
}

// Small text on the field, in the piece's own palette.
function label(ctx, w, h, env, lines, y, size, align) {
  ctx.fillStyle = env.alpha(env.colors.fg, 0.92);
  ctx.font = '500 ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], align === 'center' ? w / 2 : 12, y + i * size * 1.35);
}

// What a piece keeps of the choir: the voices, their sway and the beat.
function choir(c, env) {
  var pts = c.points(c.w, c.h, 14);
  return pts.map(function (p, i) {
    return {
      star: c.stars[i], home: p, x: p.x, y: p.y, index: i,
      phase: (i * 0.73) % (Math.PI * 2), sway: 0.5 + ((i % 7) * 0.11), pulse: 0, muted: false,
      wave: WAVES[i % 4], note: noteOf(c.stars[i])
    };
  });
}

function advance(s, c, dt, t) {
  for (var i = 0; i < s.voices.length; i++) {
    var v = s.voices[i];
    if (!c.reduced) v.phase += dt * (0.8 + v.sway * 0.35);
    var swayX = c.reduced ? 0 : Math.cos(t * 0.9 + v.phase) * (2 + v.sway * 1.8);
    var swayY = c.reduced ? 0 : Math.sin(t * 0.7 + v.phase) * (1.5 + v.sway * 1.2);
    v.x = v.home.x + swayX;
    v.y = v.home.y + swayY;
    v.pulse = Math.max(0, v.pulse - dt * 1.8);
  }
  s.flash = Math.max(0, s.flash - dt * 1.8);
  if (!s.running) return;
  s.beatAt += dt;
  var interval = 60 / s.tempo;
  while (s.beatAt >= interval) {
    s.beatAt -= interval;
    var lane = s.step % 4;
    var sounded = 0;
    for (var j = 0; j < s.voices.length; j++) {
      var voice = s.voices[j];
      if (voice.muted) continue;
      if (j % 4 === lane || j === (s.step % s.voices.length)) {
        voice.pulse = 1;
        sounded++;
      }
    }
    if (sounded) s.flash = 0.55;
    s.step += 1;
    if (s.step % 4 === 0) s.bars += 1;
  }
}

function nearest(s, x, y) {
  var near = null;
  var best = Infinity;
  for (var i = 0; i < s.voices.length; i++) {
    var dx = x - s.voices[i].x;
    var dy = y - s.voices[i].y;
    if (dx * dx + dy * dy < best) {
      best = dx * dx + dy * dy;
      near = s.voices[i];
    }
  }
  return near;
}

function reshuffle(s, c) {
  for (var i = 0; i < s.voices.length; i++) {
    s.voices[i].phase = c.rnd() * Math.PI * 2;
    s.voices[i].sway = 0.4 + c.rnd() * 1.1;
    s.voices[i].pulse = 0.5;
  }
  s.flash = 0.8;
}

function scoreLines(s, c) {
  var muted = 0;
  for (var i = 0; i < s.voices.length; i++) if (s.voices[i].muted) muted++;
  var sum = summary(c.stars);
  var lines = ['pulse choir score', 'tempo ' + Math.round(s.tempo) + ' · voices ' + s.voices.length + ' · muted ' + muted,
    'field ' + zoneOf(sum) + ' · spread ' + spreadWord(sum)];
  var motif = s.voices.slice(0, 5);
  for (var j = 0; j < motif.length; j++) {
    var v = motif[j];
    var text = v.star.text.length > 34 ? v.star.text.slice(0, 33) + '…' : v.star.text;
    lines.push((j + 1) + '. ' + v.note + ' ' + v.wave + (v.muted ? ' [muted]' : '') + ' — ' + text);
  }
  return lines;
}

// Conduct: set the tempo, mute a few voices by touch, reshuffle once or twice, and let the
// choir run a few bars; the score of what it became is printed at the end.
function conduct(env) {
  var n = env.stars.length;
  var toMute = Math.min(n, env.int(1, 3));
  var shuffles = env.int(1, 2);
  var bars = env.int(2, 3);
  var s = { voices: [], tempo: 92, running: false, beatAt: 0, step: 0, bars: 0, flash: 0, muted: 0, done: false, print: 0, t: 0 };
  return {
    title: 'conduct ' + (bars === 2 ? 'two' : 'three') + ' bars',
    brief: 'Set the tempo, tap ' + (toMute === 1 ? 'one voice' : toMute + ' voices') + ' to mute them, reshuffle the phrasing, and let the choir run ' + (bars === 2 ? 'two' : 'three') + ' bars; its score is printed when it has.',
    aspect: '4 / 3',
    steps: [
      { id: 'tempo', ask: 'the tempo', kind: 'range', min: 48, max: 160, step: 1, value: 92, low: 'slow', high: 'quick' },
      { id: 'mute', ask: 'tap ' + (toMute === 1 ? 'one voice' : toMute + ' voices') + ' to mute them', kind: 'tap', label: 'mute one for me' },
      { id: 'shuffle', ask: 'reshuffle the phrasing', kind: 'press', count: shuffles, label: 'reshuffle' },
      { id: 'run', ask: 'let it run ' + (bars === 2 ? 'two' : 'three') + ' bars', kind: 'wait', after: 'tempo' }
    ],
    start: function (c) {
      s.voices = choir(c, env);
      field(c.g, c.w, c.h, c, s.voices, 0, 0);
      c.status(n + (n === 1 ? ' voice' : ' voices') + ', waiting on a tempo');
    },
    apply: function (id, value, c) {
      if (id === 'tempo') {
        s.tempo = Math.max(48, Math.min(160, Number(value) || 92));
        if (!s.running) {
          s.running = true;
          s.bars = 0;
          s.step = 0;
        }
        c.status('tempo ' + Math.round(s.tempo) + ' bpm; the choir is running');
      }
      if (id === 'shuffle') {
        reshuffle(s, c);
        c.status('voices reshuffled. same stars, fresh phrasing.');
      }
    },
    tap: function (x, y, c) {
      if (s.done || s.muted >= toMute) return;
      var near = nearest(s, x * c.w, y * c.h);
      if (!near) return;
      if (near.muted) {
        for (var i = 0; i < s.voices.length; i++) if (!s.voices[i].muted) { near = s.voices[i]; break; }
        if (near.muted) return;
      }
      near.muted = true;
      near.pulse = 1;
      s.muted += 1;
      c.progress('mute', s.muted / toMute);
      c.status('muted: ' + near.star.text);
      if (s.muted >= toMute) c.satisfy('mute');
    },
    frame: function (t, dt, c) {
      s.t = t;
      if (!s.voices.length) s.voices = choir(c, env);
      advance(s, c, dt, t);
      if (s.running && !s.done) {
        c.progress('run', Math.min(1, s.bars / bars));
        if (s.bars >= bars) {
          s.done = true;
          c.satisfy('run');
        }
      }
      if (c.done) s.print = Math.min(1, s.print + dt * 1.4);
      field(c.g, c.w, c.h, c, s.voices, t, s.flash);
      var size = Math.max(11, Math.round(Math.min(c.w, c.h) * 0.032));
      label(c.g, c.w, c.h, c, ['tempo ' + Math.round(s.tempo) + ' · bar ' + Math.min(bars, s.bars + (s.running ? 1 : 0)) + ' of ' + bars + ' · step ' + ((s.step % 16) + 1)], 10, size);
      if (s.print > 0) {
        c.g.fillStyle = c.alpha(c.colors.bg, 0.78 * s.print);
        c.g.fillRect(0, c.h * 0.42, c.w, c.h * 0.58);
        c.g.globalAlpha = s.print;
        label(c.g, c.w, c.h, c, scoreLines(s, c), c.h * 0.46, size, 'left');
        c.g.globalAlpha = 1;
      }
    },
    end: function (c) {
      s.running = false;
      c.status('score printed: ' + s.voices.length + ' voices, ' + s.muted + ' muted, ' + Math.round(s.tempo) + ' bpm');
    }
  };
}

// Print: choose which voices sing, set the tempo, start the loop with a hold, and print the
// score of the whole sky.
function printScore(env) {
  var n = env.stars.length;
  var picks = [
    { label: 'every voice', value: 'all' },
    { label: 'the high ones', value: 'high' },
    { label: 'the low ones', value: 'low' },
    { label: 'every other one', value: 'odd' }
  ];
  var options = [];
  while (options.length < 3) {
    var i = env.int(0, picks.length - 1);
    options.push(picks[i]);
    picks.splice(i, 1);
  }
  var holdMs = env.pick([1500, 2000]);
  var s = { voices: [], tempo: 92, running: false, beatAt: 0, step: 0, bars: 0, flash: 0, printed: false, print: 0, pick: '' };
  function applyPick(c) {
    for (var i = 0; i < s.voices.length; i++) {
      var v = s.voices[i];
      v.muted = s.pick === 'high' ? v.star.y > 50 : s.pick === 'low' ? v.star.y <= 50 : s.pick === 'odd' ? i % 2 === 1 : false;
    }
    if (s.voices.length === 1) s.voices[0].muted = false;
  }
  return {
    title: n === 1 ? 'one voice, one score' : 'a score for ' + n + ' voices',
    brief: 'Choose which voices sing and how fast, hold to start the loop, and print the score of your sky.',
    aspect: '4 / 3',
    steps: [
      { id: 'who', ask: 'which voices sing', kind: 'choice', options: options },
      { id: 'tempo', ask: 'the tempo', kind: 'range', min: 48, max: 160, step: 1, value: 92, low: 'slow', high: 'quick' },
      { id: 'start', ask: 'start the loop', kind: 'hold', ms: holdMs, label: 'hold to start', after: 'who' },
      { id: 'print', ask: 'print the score', kind: 'press', count: 1, label: 'print score', after: 'start' }
    ],
    start: function (c) {
      s.voices = choir(c, env);
      field(c.g, c.w, c.h, c, s.voices, 0, 0);
      c.status(n + (n === 1 ? ' voice' : ' voices') + ' in the field');
    },
    apply: function (id, value, c) {
      if (id === 'who') {
        s.pick = String(value);
        applyPick(c);
        var singing = 0;
        for (var i = 0; i < s.voices.length; i++) if (!s.voices[i].muted) singing++;
        c.status(singing + (singing === 1 ? ' voice sings' : ' voices sing'));
      }
      if (id === 'tempo') {
        s.tempo = Math.max(48, Math.min(160, Number(value) || 92));
        c.status('tempo ' + Math.round(s.tempo) + ' bpm');
      }
      if (id === 'start') {
        s.running = true;
        s.beatAt = 0;
        c.status('choir running');
      }
      if (id === 'print') {
        s.printed = true;
        s.flash = 0.8;
      }
    },
    frame: function (t, dt, c) {
      if (!s.voices.length) s.voices = choir(c, env);
      advance(s, c, dt, t);
      if (s.printed) s.print = Math.min(1, s.print + dt * 1.4);
      field(c.g, c.w, c.h, c, s.voices, t, s.flash);
      var size = Math.max(11, Math.round(Math.min(c.w, c.h) * 0.032));
      label(c.g, c.w, c.h, c, ['tempo ' + Math.round(s.tempo) + ' · ' + (s.running ? 'step ' + ((s.step % 16) + 1) : 'waiting')], 10, size);
      if (s.print > 0) {
        c.g.fillStyle = c.alpha(c.colors.bg, 0.78 * s.print);
        c.g.fillRect(0, c.h * 0.42, c.w, c.h * 0.58);
        c.g.globalAlpha = s.print;
        label(c.g, c.w, c.h, c, scoreLines(s, c), c.h * 0.46, size, 'left');
        c.g.globalAlpha = 1;
      }
    },
    end: function (c) {
      var sum = summary(c.stars);
      c.status('score printed: field ' + zoneOf(sum) + ', spread ' + spreadWord(sum));
    }
  };
}

export default {
  id: 'pulse-choir',
  needsSky: true,
  paint: function (ctx, w, h, env) {
    drawChoir(ctx, w, h, env, env.rnd() * 10);
  },
  animate: function (ctx, w, h, env, t) {
    drawChoir(ctx, w, h, env, t);
  },
  spark: function (env) {
    if (!env.stars.length) return null;
    var s = summary(env.stars);
    return {
      title: 'pulse choir score',
      mono: env.stars.length + ' voices\nfield ' + zoneOf(s) + '\nspread ' + spreadWord(s),
      text: 'Your saved stars become a looping choir you can conduct by tempo and muting.',
      aspect: '4 / 3',
      paint: drawChoir
    };
  },
  piece: function (env) {
    if (!env.stars.length) return null;
    return env.chance(0.55) ? conduct(env) : printScore(env);
  }
};
