/* The pulse choir, as a card: the persona's stars as a small harmonic loop and one printed score.
   See js/feed.js for what a module is. */

function drawChoir(ctx, w, h, env, t) {
  var c = env.colors;
  var v = env.variant;
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c.bg2);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  var pts = env.points(w, h, 14);
  // How far a voice hears its neighbours, and so how much of the loop is strung together.
  var maxD = Math.min(w, h) * 0.3 * v.scale;
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

  // The harmonic halo every voice carries. A second one arrives as density rises, so the card the
  // template wrote is still the single halo this world leads with.
  var halos = Math.max(1, Math.round(1.4 * v.density));

  for (var i = 0; i < pts.length; i++) {
    // turn is where the loop starts, so a repeat catches the choir mid-phrase rather than at its
    // opening. It is read here rather than at the call sites so the printed score follows it too.
    var pulse = 0.8 + Math.sin((t || 0) * 2 + i * 0.9 + v.turn * Math.PI * 2) * 0.25;
    for (var r = 0; r < halos; r++) {
      ctx.beginPath();
      ctx.fillStyle = env.alpha(c.accent2, 0.16 / (r + 1));
      ctx.arc(pts[i].x, pts[i].y, (6 + r * 4) * pulse * v.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = env.alpha(c.fg, 0.95);
    ctx.arc(pts[i].x, pts[i].y, (1.9 + pulse * 0.8) * v.scale, 0, Math.PI * 2);
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
