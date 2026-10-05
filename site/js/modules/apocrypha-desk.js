/* The apocrypha desk, as a card: a specimen that never existed, with its catalogue number, its
   provenance and an assessment. See js/feed.js for what a module is. */

const MATERIALS = ['brass', 'horn', 'bakelite', 'tin', 'bone', 'blue glass', 'wax', 'pewter', 'felt', 'cedar',
  'slate', 'ivory-coloured celluloid'];
const OBJECTS = ['key', 'compass', 'whistle', 'thimble', 'spoon', 'lens', 'bell', 'button', 'hinge', 'reel',
  'ticket punch', 'stamp', 'hourglass', 'tuning peg', 'latch'];
const QUALIFIERS = [
  'for a door that was never hung',
  'that points at the last place you were happy',
  'audible only to the person it is meant for',
  'worn smooth by a hand that is not on record',
  'from a railway with no stations',
  'made to measure a distance that was later abolished',
  'engraved with a date that did not occur',
  'that fits a lock in a house nobody can find',
  'for sealing letters that were never sent',
  'said to warm slightly when lied to'
];
const PROVENANCE = [
  'found in the lining of a coat, unlisted',
  'bought at a sale of effects, lot 41, no further detail',
  'left on a bench at a station in the fog',
  'passed down with the wrong story attached',
  'recovered from a drawer that was supposed to be empty',
  'sent anonymously, postage due',
  'traded for a smaller object of the same kind'
];
const VERDICTS = [
  'almost certainly never existed',
  'existed briefly, then was described out of existence',
  'exists only in this description',
  'a forgery of a thing that was itself a forgery',
  'authenticity unverifiable; charm considerable',
  'genuine, in the sense that this card is genuine'
];

function desk(ctx, w, h, env) {
  const c = env.colors;
  const v = env.variant;
  ctx.fillStyle = env.mix(c.bg, c.bg2, 0.3);
  ctx.fillRect(0, 0, w, h);
  // The desk's grain.
  for (let y = 0, grain = Math.max(4, Math.round(7 / v.scale)); y < h; y += grain) {
    ctx.fillStyle = env.alpha(c.bg2, 0.25 + env.rnd() * 0.2);
    ctx.fillRect(0, y, w, 1);
  }
  // An index card, slightly askew, ruled.
  const cw = Math.min(w * 0.92, w * 0.72 * v.scale);
  const ch = Math.min(h * 0.62, cw * 0.62);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(((env.rnd() - 0.5) + (v.turn - 0.5) * 0.8) * 0.14);
  ctx.fillStyle = env.mix(c.bg, c.fg, 0.08);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = env.alpha(c.accent, 0.35);
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = -ch / 2 + (ch / 6) * i;
    ctx.beginPath();
    ctx.moveTo(-cw / 2 + 10, y);
    ctx.lineTo(cw / 2 - 10, y);
    ctx.stroke();
  }
  ctx.strokeStyle = env.alpha(c.accent2, 0.7);
  ctx.beginPath();
  ctx.moveTo(-cw / 2 + 10, -ch / 2 + ch / 6);
  ctx.lineTo(cw / 2 - 10, -ch / 2 + ch / 6);
  ctx.stroke();
  // The specimen's silhouette: a few overlapping shapes.
  ctx.fillStyle = env.alpha(c.accent, 0.55);
  const sx = cw * 0.18;
  const sy = ch * 0.12;
  ctx.beginPath();
  ctx.arc(sx, sy, ch * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(sx - ch * 0.05, sy, ch * 0.1, ch * 0.3);
  ctx.fillRect(sx, sy + ch * 0.22, ch * 0.14, ch * 0.05);
  // The catalogue mark.
  ctx.fillStyle = env.alpha(c.accent2, 0.85);
  ctx.font = '600 ' + Math.max(9, ch * 0.09) + 'px ui-monospace, monospace';
  ctx.fillText('APC-' + env.int(1000, 9999), -cw / 2 + 12, -ch / 2 + ch / 6 - 5);
  ctx.restore();
}

export default {
  id: 'apocrypha-desk',
  paint(ctx, w, h, env) {
    desk(ctx, w, h, env);
  },
  spark(env) {
    const number = 'APC-' + env.int(1000, 9999) + '-' + env.pick('abcdefghk'.split(''));
    return {
      overline: number,
      title: 'a ' + env.pick(MATERIALS) + ' ' + env.pick(OBJECTS) + ' ' + env.pick(QUALIFIERS),
      text: 'provenance: ' + env.pick(PROVENANCE) + '.',
      cite: 'assessment: ' + env.pick(VERDICTS) + '.'
    };
  }
};
