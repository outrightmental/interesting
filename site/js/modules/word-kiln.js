/* The word kiln, as a card: the kiln's mouth, and a coinage with a definition and a citation that
   never existed. See js/feed.js for what a module is. */

const HEADS = ['umb', 'thal', 'quer', 'mor', 'vell', 'glim', 'sorr', 'brack', 'fulm', 'nim', 'osk', 'twil',
  'harr', 'pell', 'dru', 'calv', 'wist', 'lorn', 'skell', 'murr'];
const MIDS = ['er', 'ow', 'ish', 'ine', 'ast', 'ul', 'en', 'ar', 'o', 'i'];
const TAILS = ['ment', 'ling', 'wick', 'ance', 'th', 'ry', 'some', 'fast', 'wise', 'hood', 'kin', 'age', 'ure'];
const POS = ['n.', 'n.', 'n.', 'v.', 'adj.'];

const DEFS = {
  'n.': [
    'the warmth left in a chair someone has just got up from',
    'the small debt owed to a tab left open',
    'the pause before a kettle makes up its mind',
    'a path familiar in one direction only',
    'the exact weight of a thing you meant to return',
    'the quiet after a door you did not hear close',
    'a word that arrives two stairs after the conversation',
    'the part of a map that is only true on paper',
    'the second, smaller surprise inside a surprise',
    'the courage particular to the first sentence'
  ],
  'v.': [
    'to lose a thought by reaching for it',
    'to tidy a room by moving the mess one room over',
    'to agree with someone slightly before they have finished',
    'to walk back for the thing, then forget the thing',
    'to warm a plan by talking about it instead of doing it',
    'to hold a note a beat longer than the song wants'
  ],
  'adj.': [
    'of a silence, friendly',
    'of a plan, ruined by being said aloud',
    'slightly too tall for the room it is in',
    'of a word, right in the mouth and wrong on the page',
    'glad in the manner of a dog with a found stick'
  ]
};

const AUTHORS = ['E. Varrow', 'H. Quillfeather', 'M. Oates-Lind', 'the Pemberly glossary', 'an anonymous marginal note',
  'T. Ashgrove', 'L. Marrowbone', 'the Second Kiln Circular'];
const WORKS = ['A Dictionary of Rooms', 'The Lesser Almanac', 'Notes Toward a Grammar of Weather',
  'Field Guide to the Unsaid', 'The Kiln Book, second firing', 'Glossary of a House at Night'];

function coin(env) {
  let word = env.pick(HEADS) + env.pick(MIDS) + env.pick(TAILS);
  if (env.chance(0.3)) word = env.pick(HEADS) + env.pick(TAILS);
  return word.replace(/(.)\1\1/g, '$1$1');
}

function kiln(ctx, w, h, env, heat) {
  const c = env.colors;
  const g = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, Math.max(w, h) * 0.8);
  g.addColorStop(0, env.mix(c.bg, c.accent, 0.18));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = Math.min(w, h) * 0.26;
  const cx = w / 2;
  const cy = h * 0.52;
  // The mouth.
  ctx.fillStyle = env.mix(c.bg, '#000', 0.4);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = env.alpha(c.accent, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  // The ember.
  const e = ctx.createRadialGradient(cx, cy + r * 0.2, 0, cx, cy + r * 0.2, r * 0.8);
  e.addColorStop(0, env.alpha(c.accent2, 0.55 + heat * 0.45));
  e.addColorStop(0.4, env.alpha(c.accent, 0.35 + heat * 0.4));
  e.addColorStop(1, env.alpha(c.accent, 0));
  ctx.fillStyle = e;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.95, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sparks rising.
  for (let i = 0; i < 6 + heat * 10; i++) {
    ctx.fillStyle = env.alpha(c.accent2, 0.2 + env.rnd() * 0.6);
    ctx.beginPath();
    ctx.arc(cx + (env.rnd() - 0.5) * r * 1.4, cy - r * 0.6 - env.rnd() * h * 0.35, 0.8 + env.rnd() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default {
  id: 'word-kiln',
  paint(ctx, w, h, env) {
    kiln(ctx, w, h, env, env.rnd());
  },
  spark(env) {
    const pos = env.pick(POS);
    const word = coin(env);
    return {
      title: word,
      text: '(' + pos + ') ' + env.pick(DEFS[pos]) + '.',
      cite: '— ' + env.pick(AUTHORS) + ', ' + env.pick(WORKS) + ', p. ' + env.int(3, 412)
        + '. Neither the word nor the book exists.'
    };
  }
};
