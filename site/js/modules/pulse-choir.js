/* The pulse choir, as a card: the persona's stars as a small harmonic loop and one printed score.
   See js/feed.js for what a module is. */

function drawChoir(ctx, w, h, env, t) {
  var c = env.colors;
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg2);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  var pts = env.points(w, h, 14);
  var maxD = Math.min(w, h) * 0.3;
  var maxD2 = maxD * maxD;

  for (var a = 0; a < pts.length; a++) {
    for (var b = a + 1; b < pts.length; b++) {
      var dx = pts[b].x - pts[a].x;
      var dy = pts[b].y - pts[a].y;
      var d2 = dx * dx + dy * dy;
      if (d2 > maxD2) continue;
      var alpha = 0.08 + (1 - d2 / maxD2) * 0.3;
      ctx.strokeStyle = env.alpha(c.accent, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
  }

  for (var i = 0; i < pts.length; i++) {
    var pulse = 0.8 + Math.sin((t || 0) * 2 + i * 0.9) * 0.25;
    ctx.beginPath();
    ctx.fillStyle = env.alpha(c.accent2, 0.16);
    ctx.arc(pts[i].x, pts[i].y, 6 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = env.alpha(c.fg, 0.95);
    ctx.arc(pts[i].x, pts[i].y, 1.9 + pulse * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
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

export default {
  id: 'pulse-choir',
  needsSky: true,
  paint(ctx, w, h, env) {
    drawChoir(ctx, w, h, env, env.rnd() * 10);
  },
  animate(ctx, w, h, env, t) {
    drawChoir(ctx, w, h, env, t);
  },
  spark(env) {
    if (!env.stars.length) return null;
    var s = summary(env.stars);
    var zone = (s.cy < 50 ? 'north' : 'south') + '-' + (s.cx < 50 ? 'west' : 'east');
    var spreadWord = s.spread < 12 ? 'compact' : (s.spread < 24 ? 'balanced' : 'wide');
    return {
      title: 'pulse choir score',
      mono: env.stars.length + ' voices\nfield ' + zone + '\nspread ' + spreadWord,
      text: 'Your saved stars become a looping choir you can conduct by tempo and muting.',
      aspect: '4 / 3',
      paint: drawChoir
    };
  }
};
