/* The archive oracle, as a card: a rune wheel turned by the persona's stars, and an omen. See
   js/feed.js for what a module is. */

const RUNES = [
  ['ᚠ', 'fehu', 'what you have, and could carry'],
  ['ᚢ', 'uruz', 'a strength you did not vote for'],
  ['ᚦ', 'thurisaz', 'the thorn that stops the hand'],
  ['ᚨ', 'ansuz', 'a message, slightly garbled'],
  ['ᚱ', 'raido', 'the road, and the going'],
  ['ᚲ', 'kenaz', 'a small light, cupped'],
  ['ᚷ', 'gebo', 'a gift with no receipt'],
  ['ᚹ', 'wunjo', 'the joy that is also relief'],
  ['ᚺ', 'hagalaz', 'hail: brief, and then over'],
  ['ᚾ', 'nauthiz', 'the need that organises everything'],
  ['ᛁ', 'isa', 'ice: wait'],
  ['ᛃ', 'jera', 'the harvest, in its own time'],
  ['ᛇ', 'eihwaz', 'the yew, and the long view'],
  ['ᛈ', 'perthro', 'the cup, the dice, the not knowing'],
  ['ᛉ', 'algiz', 'the elk: guard this'],
  ['ᛊ', 'sowilo', 'the sun, undeniably'],
  ['ᛏ', 'tiwaz', 'the arrow, aimed'],
  ['ᛒ', 'berkano', 'the birch: something begins'],
  ['ᛖ', 'ehwaz', 'the horse: trust the carrier'],
  ['ᛗ', 'mannaz', 'the self, among others'],
  ['ᛚ', 'laguz', 'water finding its level'],
  ['ᛜ', 'ingwaz', 'the seed, kept'],
  ['ᛞ', 'dagaz', 'first light: the turn'],
  ['ᛟ', 'othala', 'the home ground']
];

function runeFor(env, star) {
  return RUNES[env.hash(star.text + '|' + star.x + '|' + star.y) % RUNES.length];
}

function wheel(ctx, w, h, env, lit) {
  const c = env.colors;
  const v = env.variant;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, c.bg2);
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.42 * v.scale;
  ctx.strokeStyle = env.alpha(c.accent, 0.4);
  ctx.lineWidth = 1;
  for (const r of [R, R * 0.78, R * 0.3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = Math.max(11, R * 0.16) + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  env.stars.forEach((s) => {
    const a = Math.atan2(s.y - 50, s.x - 50) + v.turn * Math.PI * 2;
    const rune = runeFor(env, s);
    const on = lit && rune[1] === lit[1];
    const rx = cx + Math.cos(a) * R * 0.89;
    const ry = cy + Math.sin(a) * R * 0.89;
    if (on) {
      const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, R * 0.18);
      glow.addColorStop(0, env.alpha(c.accent2, 0.6));
      glow.addColorStop(1, env.alpha(c.accent2, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(rx - R * 0.2, ry - R * 0.2, R * 0.4, R * 0.4);
    }
    ctx.fillStyle = on ? c.accent2 : env.alpha(c.fg, 0.8);
    ctx.fillText(rune[0], rx, ry);
    // The star itself, inside the wheel.
    const sr = (Math.hypot(s.x - 50, s.y - 50) / 70) * R * 0.72;
    ctx.fillStyle = env.alpha(c.fg, 0.9);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = env.alpha(c.accent, 0.2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
    ctx.stroke();
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

export default {
  id: 'sky-archive',
  needsSky: true,
  paint(ctx, w, h, env) {
    wheel(ctx, w, h, env, null);
  },
  spark(env) {
    if (!env.stars.length) return null;
    const star = env.pick(env.stars);
    const rune = runeFor(env, star);
    return {
      title: 'omen',
      quote: rune[0] + ' ' + rune[1] + ' — ' + rune[2],
      text: 'Drawn from the star that said "' + star.text + '". Spin the wheel on its page for the next.',
      aspect: '1 / 1',
      paint: (ctx, w, h, e) => wheel(ctx, w, h, e, rune)
    };
  }
};
