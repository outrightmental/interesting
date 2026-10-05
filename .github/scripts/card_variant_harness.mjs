#!/usr/bin/env node
/**
 * Run site/js/variant.js, and every world's feed module through it, and report what happened, as
 * JSON on stdout.
 *
 *   node card_variant_harness.mjs path/to/site/js/variant.js path/to/site/js/modules '{"tender": [...]}'
 *
 * A card in the feed carries a variant: the randomized configuration that is what makes the second
 * appearance of a world a different card and not a reprint of the first (issue #53). Two things about
 * it are worth testing rather than only reading:
 *
 *   - the configuration is arithmetic over a seed, with no browser in it at all, so it can simply be
 *     imported and rolled -- which is the whole reason it is its own file;
 *   - and what it is for is that a card looks different, which is measurable: paint the same world,
 *     from the same seed, in the same colours, under two configurations, and the drawing calls have
 *     to differ.
 *
 * The third argument is the fifteen mood palettes, read out of _sass/_mood.scss by the caller, so
 * the colour a configuration derives can be checked against the palette it was derived from rather
 * than against a copy of it kept here.
 *
 * CardVariantTest in test_make_interesting.py makes the assertions: the harness only observes.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const variantPath = process.argv[2];
const modulesDir = process.argv[3];
const palettes = JSON.parse(process.argv[4] || "{}");

const V = await import(pathToFileURL(variantPath).href);

/** A stand-in for a 2D canvas context that records what was drawn rather than drawing it.
 *
 *  Every call and every property a module sets lands in `log` as one short line, with numbers
 *  rounded so that two pictures differing only by sub-pixel float noise still read as the same
 *  picture. The log is the module's drawing, as data. */
function makeContext() {
  const log = [];
  const round = (n) => (typeof n === "number" ? (Number.isFinite(n) ? Math.round(n * 4) / 4 : "nan") : String(n));
  const record = (name) => (...args) => void log.push(name + "(" + args.map(round).join(",") + ")");
  const gradient = () => ({ addColorStop: (stop, color) => void log.push("stop(" + round(stop) + "," + color + ")") });
  const ctx = {
    log,
    canvas: { width: 0, height: 0 },
    createRadialGradient: (...a) => (record("radial")(...a), gradient()),
    createLinearGradient: (...a) => (record("linear")(...a), gradient()),
    measureText: (text) => ({ width: String(text).length * 6 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  for (const name of ["save", "restore", "translate", "rotate", "scale", "setTransform", "resetTransform",
    "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "ellipse", "rect", "roundRect",
    "quadraticCurveTo", "bezierCurveTo", "fill", "stroke", "clip", "fillRect", "strokeRect",
    "clearRect", "fillText", "strokeText", "setLineDash", "drawImage"]) {
    ctx[name] = record(name);
  }
  for (const name of ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "font",
    "textAlign", "textBaseline", "globalAlpha", "globalCompositeOperation", "shadowColor",
    "shadowBlur", "shadowOffsetX", "shadowOffsetY", "miterLimit", "filter"]) {
    let held;
    Object.defineProperty(ctx, name, {
      get: () => held,
      set(value) {
        held = value;
        log.push(name + "=" + String(value));
      },
    });
  }
  return ctx;
}

// A fixed sky, so a world that reads the persona's stars has something to read and reads the same
// thing under every configuration.
const SKY = [
  { x: 12, y: 18, text: "a wish" }, { x: 48, y: 24, text: "another" }, { x: 80, y: 31, text: "a third" },
  { x: 22, y: 55, text: "low and west" }, { x: 61, y: 49, text: "the middle one" },
  { x: 88, y: 72, text: "far corner" }, { x: 35, y: 81, text: "down here" },
  { x: 55, y: 66, text: "near the last" }, { x: 71, y: 12, text: "high and east" },
];

const COLORS = { bg: "#070a14", bg2: "#1c2a4e", accent: "#9fcbff", accent2: "#ffe7ab", fg: "#e6eaf5", muted: "#b7c0da" };

/** The env js/feed.js hands a module, built from the same helpers the real one uses. */
function makeEnv(seed, variant, colors) {
  const rnd = V.mulberry32(seed);
  return {
    seed,
    rnd,
    pick: (list) => list[Math.floor(rnd() * list.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    hash: V.hash,
    stars: SKY,
    points(w, h, pad) {
      const p = pad || 0;
      return SKY.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    colors: colors || COLORS,
    mix: V.mix,
    alpha: V.alpha,
    reduced: false,
    world: { file: "toy.html", name: "a world", orientation: "an orientation" },
    variant,
  };
}

/** Paint `mod` once and hand back the drawing as one string, or the error it threw. */
function draw(mod, seed, variant, how) {
  const ctx = makeContext();
  try {
    if (how === "animate") mod.animate(ctx, 320, 240, makeEnv(seed, variant), 4.5);
    else mod.paint(ctx, 320, 240, makeEnv(seed, variant));
  } catch (e) {
    return { threw: String(e && e.message ? e.message : e) };
  }
  return { drawing: ctx.log.join("\n"), calls: ctx.log.length };
}

/* ---- what the configuration itself does ------------------------------------------------------ */

const SEEDS = [];
for (let i = 0; i < 600; i++) SEEDS.push((Math.imul(i + 1, 2654435761) ^ 0x5f3a7c11) >>> 0);

const rolled = SEEDS.map((seed) => V.roll(seed));

const observed = {
  dials: Object.keys(V.DIALS),
  ranges: V.DIALS,
  plain: V.PLAIN,
  // Every dial of every rolled configuration, so the caller can see the range each one covers.
  rolls: rolled.map((v) => Object.fromEntries(Object.keys(V.DIALS).map((name) => [name, v[name]]))),
  // The same seed, twice: a card paints the same picture every time it is painted.
  repeatable: JSON.stringify(V.roll(SEEDS[3])) === JSON.stringify(V.roll(SEEDS[3])),
  distinct: new Set(rolled.map((v) => JSON.stringify(v))).size,
  // The frame: a world's own aspect ratio, stretched.
  frames: ["1 / 1", "4 / 5", "16 / 10", "3 / 4", "4 / 3", "5 / 4"].map((ratio) => ({
    ratio,
    plain: V.aspect(ratio, V.PLAIN),
    rolled: SEEDS.slice(0, 120).map((seed) => Number(V.aspect(ratio, V.roll(seed)))),
  })),
  aspectLimits: V.ASPECT_LIMITS,
  unreadableFrame: V.aspect("not a ratio", V.roll(SEEDS[0])),
  lights: SEEDS.slice(0, 40).map((seed) => V.light(V.roll(seed))),
  plainLight: V.light(V.PLAIN),
};

/* ---- what it does to colour ------------------------------------------------------------------ */

// Every mood's four seeds, re-derived under every rolled configuration. The caller checks the
// contrast that survives and how far the palette moved.
observed.colors = {};
for (const [mood, seeds] of Object.entries(palettes)) {
  const base = { bg: seeds[0], bg2: seeds[1], accent: seeds[2], accent2: seeds[3] };
  observed.colors[mood] = {
    base,
    plain: V.recolor(base, V.PLAIN),
    rolled: rolled.slice(0, 200).map((v) => V.recolor(base, v)),
  };
}

/* ---- what it does to a world's picture -------------------------------------------------------- */

// Three configurations that are each other's opposites, so a module that leans on any dial has to
// draw differently under them.
const CORNERS = {
  plain: V.PLAIN,
  low: { plain: false, trade: 0, lift: 0, wash: 0, density: V.DIALS.density[0], scale: V.DIALS.scale[0], turn: 0, stretch: V.DIALS.stretch[0] },
  high: { plain: false, trade: 1, lift: V.DIALS.lift[1], wash: V.DIALS.wash[1], density: V.DIALS.density[1], scale: V.DIALS.scale[1], turn: 0.97, stretch: V.DIALS.stretch[1] },
};

observed.modules = {};
for (const file of readdirSync(modulesDir).filter((name) => name.endsWith(".js")).sort()) {
  const mod = (await import(pathToFileURL(path.join(modulesDir, file)).href)).default;
  const seed = 0x51ced51c;
  const out = { id: mod && mod.id, needsSky: !!(mod && mod.needsSky), threw: [], drawings: {}, calls: {} };
  for (const [name, variant] of Object.entries(CORNERS)) {
    const painted = draw(mod, seed, variant, "paint");
    if (painted.threw) out.threw.push(name + " paint: " + painted.threw);
    else {
      out.drawings[name] = painted.drawing;
      out.calls[name] = painted.calls;
    }
    if (typeof mod.animate === "function") {
      const moved = draw(mod, seed, variant, "animate");
      if (moved.threw) out.threw.push(name + " animate: " + moved.threw);
      else out.drawings[name + ":animate"] = moved.drawing;
    }
  }
  // Every configuration a seed could roll, painted: nothing may throw anywhere in the ranges.
  for (const s of SEEDS.slice(0, 60)) {
    const painted = draw(mod, s, V.roll(s), "paint");
    if (painted.threw) out.threw.push("rolled " + s + ": " + painted.threw);
    try {
      const spec = mod.spark(makeEnv(s, V.roll(s)));
      if (spec && spec.paint) {
        const ctx = makeContext();
        spec.paint(ctx, 300, 200, makeEnv(s, V.roll(s)));
      }
    } catch (e) {
      out.threw.push("rolled " + s + " spark: " + String(e && e.message ? e.message : e));
    }
  }
  // How many different pictures sixty configurations of one world make, with the colours held still
  // so only the configuration is moving.
  out.variety = new Set(SEEDS.slice(0, 60).map((s) => draw(mod, seed, V.roll(s), "paint").drawing)).size;
  // And how many the seed alone used to make, which is what the configuration is added to.
  out.seedVariety = new Set(SEEDS.slice(0, 60).map((s) => draw(mod, s, V.PLAIN, "paint").drawing)).size;
  observed.modules[file] = out;
}

process.stdout.write(JSON.stringify(observed));
