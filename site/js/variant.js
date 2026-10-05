/*
  A card's variant: its randomized configuration, which is what makes the second appearance of a
  world in the feed a different card rather than a reprint of the first.

  js/feed.js deals endlessly -- every world comes round again and again as a visitor scrolls -- and
  a repeat used to differ only in whatever its module happened to do with a fresh seed. The palette
  was the world's one palette, the frame was the world's one aspect ratio, and nothing else about
  the card moved at all. This file is what else there is.

  It is arithmetic over a seed and nothing more: it reaches for no browser, imports nothing, and is
  tested on its own (.github/scripts/card_variant_harness.mjs drives it,
  CardVariantTest in .github/scripts/test_make_interesting.py makes the assertions).

      import { roll, PLAIN, recolor, aspect, light } from './variant.js';

      const v = roll(seed);                  // the variant: seven dials
      const seeds = recolor(moodSeeds, v);   // the card's four palette seeds, re-derived by it
      const ratio = aspect('4 / 5', v);      // the card's frame, stretched by it

  The seven dials, three of colour and four of composition (DIALS below holds the range of each):

      trade    how far the palette's two accents trade places
      lift     how far the card's ground rises from --bg toward --bg2
      wash     how far the lit corner --bg2 is pushed into the accent
      density  how much of itself a module draws
      scale    how large it draws it
      turn     where it starts: a phase, in turns
      stretch  how the card's frame is stretched from its world's aspect ratio

  PLAIN is the variant that changes nothing -- every dial at the value that leaves a card as it was.
  The card the template wrote for a world wears it (_includes/worlds.njk), so a world still leads
  with its own palette, its own frame and its module's plainest reading, and every card the feed
  deals afterwards is rolled.

  Colour follows the configuration, and only through the machinery the site already has. The three
  colour dials move --bg, --bg2, --accent and --accent2 -- the four seeds every M3 role is derived
  from (_sass/_tokens.scss) -- and they move them inside the palette the card's own world already
  wears (_sass/_mood.scss), so a card is still its world's colour and the feed is still a mosaic of
  moods. --fg and --muted are never touched, because they are what keeps text at 4.5:1 over every
  one of those palettes, and the ground a configuration lifts stops at the point where they would.
*/

/* ---- the seeded arithmetic ------------------------------------------------------------------ */

/* A tiny seeded source: the same seed always gives the same stream, which is what lets a card
   paint the same picture every time it is painted. */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---- colour --------------------------------------------------------------------------------- */

export function toRgb(value) {
  const v = String(value || '').trim();
  if (v[0] === '#') {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [160, 170, 200];
}

export function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}

export function alpha(c, a) {
  const [r, g, b] = toRgb(c);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* Relative luminance, WCAG's: how bright a colour is to the eye, which is the one thing about a
   card's ground that must not drift if the text on it is to keep the contrast it had. */
export function luminance(color) {
  const [r, g, b] = toRgb(color).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* `color` pulled back toward black until its luminance is at or under `ceiling`, keeping the hue it
   had. Twelve halvings land within a thousandth of the answer, far finer than a byte per channel
   can show. */
export function dim(color, ceiling) {
  if (luminance(color) <= ceiling) return color;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    if (luminance(mix(color, '#000', t)) > ceiling) lo = t;
    else hi = t;
  }
  return mix(color, '#000', hi);
}

/* ---- the variant ---------------------------------------------------------------------------- */

// How bright a card's ground may get, as WCAG relative luminance. Every mood's own ground sits under
// this already (0.003 to 0.006), so the ceiling is not a colour but the headroom a configuration has
// above one: it is the brightest a ground can be while the surface tones _sass/_tokens.scss derives
// from it still hold --muted well clear of 4.5:1, over all fifteen palettes and with the accents
// either way round. CardVariantTest measures that rather than taking it on trust.
export const GROUND_CEILING = 0.008;

// Each dial and the range it is rolled in. `wash` stops short of 1 because past that the lit corner
// of a card stops reading as the same mood, and the composition dials stay near 1 because a card
// that drew a third of what it used to would read as empty rather than as different. `lift` runs
// its whole range: what bounds it is GROUND_CEILING, in recolor(), and not a cautious number here.
export const DIALS = {
  trade: [0, 1],
  lift: [0, 1],
  wash: [0, 0.45],
  density: [0.72, 1.32],
  scale: [0.86, 1.18],
  turn: [0, 1],
  stretch: [0.8, 1.25]
};

// The variant that changes nothing: the first card of a world wears it, and so does anything
// outside the feed that paints through the same machinery (a page's feature).
export const PLAIN = Object.freeze({
  plain: true, trade: 0, lift: 0, wash: 0, density: 1, scale: 1, turn: 0, stretch: 1
});

// Half way through `trade` the two accents meet in the middle, and a card with one accent instead
// of two has lost the contrast its palette is built on. So a card either keeps the order its mood
// is written in or turns it over, and the ground between is never visited.
const TRADE_HOLE = [0.3, 0.7];

export function roll(seed) {
  // Its own stream, offset from the seed a module paints from, so giving a card a variant does not
  // change what any seed already drew.
  const rnd = mulberry32(((seed >>> 0) ^ 0x9E3779B9) >>> 0);
  const dial = (name) => {
    const range = DIALS[name];
    return range[0] + rnd() * (range[1] - range[0]);
  };
  const trade = rnd() < 0.5 ? rnd() * TRADE_HOLE[0] : TRADE_HOLE[1] + rnd() * (1 - TRADE_HOLE[1]);
  return {
    seed: seed >>> 0,
    plain: false,
    trade,
    lift: dial('lift'),
    wash: dial('wash'),
    density: dial('density'),
    scale: dial('scale'),
    turn: dial('turn'),
    stretch: dial('stretch')
  };
}

/* The four palette seeds a variant gives a card, from the four its own world's mood gives it.

   --fg and --muted are deliberately not among them: they are what holds the text on a card at
   4.5:1, and no configuration gets to move them. What the text sits on does move -- every surface
   tier is derived from --bg (_sass/_tokens.scss) -- so `lift` carries the ground as far as its own
   lit corner and dim() holds it under GROUND_CEILING, the headroom every one of the fifteen
   palettes has before the text on a card stops clearing 4.5:1. The ground takes the colour of its
   corner and some of its light, and stops where the axiom does. */
export function recolor(base, v) {
  const accent = mix(base.accent, base.accent2, v.trade);
  const accent2 = mix(base.accent2, base.accent, v.trade);
  return {
    bg: dim(mix(base.bg, base.bg2, v.lift), Math.max(GROUND_CEILING, luminance(base.bg))),
    bg2: mix(base.bg2, accent, v.wash),
    accent,
    accent2
  };
}

/* An aspect ratio as a number: '4 / 5' is 0.8. Zero for anything unreadable, so a caller can
   leave the ratio alone rather than guess at one. */
export function ratioOf(aspect) {
  const parts = String(aspect == null ? '' : aspect).split('/');
  const w = parseFloat(parts[0]);
  const h = parts.length > 1 ? parseFloat(parts[1]) : 1;
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return 0;
  return w / h;
}

// How far from square a card's picture may be stretched, whatever its world's own ratio is: no
// card in the masonry becomes a letterbox or a column.
export const ASPECT_LIMITS = [0.6, 1.9];

/* The aspect ratio a card's picture is drawn in: its world's own, stretched by the variant. */
export function aspect(ratio, v) {
  const r = ratioOf(ratio);
  if (!r || !v || v.stretch === 1) return ratio;
  const out = Math.min(ASPECT_LIMITS[1], Math.max(ASPECT_LIMITS[0], r * v.stretch));
  return String(Math.round(out * 1000) / 1000);
}

/* Where the light falls on a card: the origin of the gradient behind its picture, carried across by
   the variant's phase. _sass/_feed.scss reads it as --card-light, and the plain variant gives back
   the top-left corner that sheet falls back to on its own. */
export function light(v) {
  return Math.round(30 + v.turn * 52) + '% ' + Math.round(20 + v.turn * 16) + '%';
}
