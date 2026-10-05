#!/usr/bin/env node
/*
  The completion axiom's instrument: drive every world's piece to its end, without a browser.

      node .github/scripts/piece_harness.mjs --modules <built site>/js/modules [--seeds 1,2,3]
                                             [--json] [--out report.json] [--require-all]

  Every world on the site is a piece a visitor can finish: a small, procedurally generated item
  with a few knobs and a clear end, made by the world's module (js/modules/<world>.js) as
  piece(env) and run by js/stage.js, which documents the contract. The stage is the visitor's
  instrument; this is the law's. It loads each module from the folder it is given, asks it for
  a piece for each seed, and plays the piece the way the stage would, on a canvas that records
  nothing: it sets each knob in order (a choice at one of its options, a range at a point on it,
  a toggle flipped, a press pressed its count, a hold held for its time), taps the scene at
  seeded points for a tap knob, and runs frames for a wait knob -- and then it says whether the
  piece finished. Every seed is played with a sky of five stars; one seed is also played the way
  the stage plays a module that does not read the sky (with none) or one that does (with a
  single star), so a piece is held to the skies the stage can hand it.

  A module fails when:
    - piece(env) throws, or returns nothing, or returns something with no title or no steps;
    - a piece has fewer than MIN_STEPS knobs (a flow is more than one lever) or more than
      MAX_STEPS (a visitor has to be able to finish expediently), a knob of a kind the stage does
      not render, two knobs with one id, a choice with fewer than two or more than four options,
      a tap knob without tap(), or an `after` that names no earlier knob (the stage has to be
      able to render every knob);
    - the piece sets a knob itself (ctx.satisfy) before its visitor has set anything, or sets a
      knob that is not a tap or a wait: a piece is finished by the person playing it, never by
      itself on arrival;
    - the same seed does not make the same piece (same title, brief and knobs), because a piece
      is an address a visitor can come back to or send to someone;
    - every seed makes the same piece, because the river is of pieces that differ;
    - the piece does not finish within MAX_TAPS taps of its scene and MAX_SECONDS of simulated
      time once every knob is set, or start/apply/frame/tap/end throws;
    - it reaches for a clock or for Math.random: in here those throw, because a piece draws its
      randomness from the seeded rnd it is handed and its time from the frame clock, and
      anything else would make the same seed a different piece.
  A module that exports no piece() is reported as such and left to the caller to judge: the
  check in make_interesting.py requires one of every world the site lists.

  Each module is played in a worker thread of its own, with an empty environment and a limit of
  MODULE_TIMEOUT_MS of real time, so one module that never returns is reported alone and cannot
  hold the others up; a module is self-contained (it imports nothing but its own file) and
  never reaches for the document, the window or the browser's storage, none of which exist
  here, which is the law doing its job. The run itself is model-written code executed by the
  AI run: make_interesting.py starts it with a scrubbed environment and under Node's permission
  model (no file writes but the report, no child processes), so the most a rogue module can do
  is misreport itself -- this is a quality gate, not a security boundary, and the site's source
  is public anyway.

  Prints one line per module (or, with --json, one JSON document; with --out, writes it to that
  file as well) and exits 1 if any module with a piece fails -- or, with --require-all, if any
  module has no piece.
*/

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

export const MIN_STEPS = 2;
export const MAX_STEPS = 5;
export const MAX_TAPS = 12;
export const MAX_SECONDS = 45;
export const MODULE_TIMEOUT_MS = 20000;
const FRAME = 1 / 30;
const SETTLE = 0.5; // seconds of frames run after each knob, as a visitor pauses between them
const KINDS = ['choice', 'toggle', 'range', 'press', 'hold', 'tap', 'wait'];
const SEEDS = [11, 2027, 31337, 777777, 9000001, 123456789]; // spread out: near seeds make near first draws
const W = 800;
const H = 450;

const COLORS = { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' };
const STARS = [
  { x: 18, y: 30, text: 'a window left open' },
  { x: 52, y: 22, text: 'the sound of a kettle' },
  { x: 71, y: 58, text: 'one more page' },
  { x: 35, y: 70, text: 'the long way home' },
  { x: 86, y: 26, text: 'a word I keep' }
];
const ONE_STAR = [STARS[1]];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toRgb(value) {
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

function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}

function alpha(c, a) {
  const [r, g, b] = toRgb(c);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

// The same env js/stage.js makes, less the document.
export function makeEnv(seed, stars) {
  const rnd = mulberry32(seed);
  const list = stars || STARS;
  return {
    seed,
    rnd,
    pick: (items) => items[Math.floor(rnd() * items.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    stars: list,
    colors: Object.assign({}, COLORS),
    mix,
    alpha,
    reduced: false,
    world: { file: 'world.html', name: 'a world', orientation: 'an orientation' }
  };
}

// A 2D context that accepts anything and records nothing, with a real context's defaults.
function stubContext(canvas) {
  const state = {
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    miterLimit: 10, lineDashOffset: 0, font: '10px sans-serif', textAlign: 'start',
    textBaseline: 'alphabetic', direction: 'ltr', globalAlpha: 1, globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', letterSpacing: '0px', wordSpacing: '0px',
    fontKerning: 'auto', fontStretch: 'normal', fontVariantCaps: 'normal', textRendering: 'auto'
  };
  const gradient = () => ({ addColorStop() {} });
  const image = (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w | 0, height: h | 0, colorSpace: 'srgb' });
  const special = {
    canvas,
    measureText: (text) => ({ width: String(text || '').length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(text || '').length * 8, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({ setTransform() {} }),
    getImageData: (x, y, w, h) => image(w, h),
    createImageData: (w, h) => image(typeof w === 'object' ? w.width : w, typeof w === 'object' ? w.height : h),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getLineDash: () => [],
    getContextAttributes: () => ({ alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: false })
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in special) return special[prop];
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function signatureOf(piece) {
  const steps = (piece.steps || []).map((s) => ({
    id: s.id, ask: s.ask, kind: s.kind, after: s.after,
    options: Array.isArray(s.options) ? s.options.map((o) => [o.label, o.value]) : undefined,
    min: s.min, max: s.max, step: s.step, value: s.value, count: s.count, ms: s.ms, low: s.low, high: s.high, label: s.label
  }));
  return JSON.stringify({ title: piece.title, brief: piece.brief, aspect: piece.aspect, auto: piece.auto, steps });
}

function shapeProblems(piece) {
  const problems = [];
  if (!piece || typeof piece !== 'object') return ['piece() returned nothing'];
  if (typeof piece.title !== 'string' || !piece.title.trim()) problems.push('the piece has no title');
  if (!Array.isArray(piece.steps) || !piece.steps.length) problems.push('the piece has no knobs (steps)');
  else {
    if (piece.steps.length < MIN_STEPS) problems.push('the piece has ' + piece.steps.length + ' knob; a flow is at least ' + MIN_STEPS);
    if (piece.steps.length > MAX_STEPS) problems.push('the piece has ' + piece.steps.length + ' knobs; at most ' + MAX_STEPS + ' finish expediently');
    const seen = new Set();
    piece.steps.forEach((s, i) => {
      const at = 'knob ' + (i + 1);
      if (!s || typeof s !== 'object') return problems.push(at + ' is not an object');
      if (typeof s.id !== 'string' || !s.id) problems.push(at + ' has no id');
      else if (seen.has(s.id)) problems.push(at + ' repeats the id "' + s.id + '"');
      seen.add(s.id);
      if (KINDS.indexOf(s.kind) === -1) problems.push(at + ' has a kind the stage does not render: ' + JSON.stringify(s.kind));
      if (typeof s.ask !== 'string' || !s.ask.trim()) problems.push(at + ' has no ask');
      if (s.kind === 'choice' && (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4)) {
        problems.push(at + ' is a choice with ' + (Array.isArray(s.options) ? s.options.length : 'no') + ' options; two to four');
      }
      if (s.kind === 'tap' && typeof piece.tap !== 'function') problems.push(at + ' is a tap knob but the piece has no tap()');
      if (s.after != null) {
        const earlier = piece.steps.slice(0, i).some((e) => e && e.id === s.after);
        if (!earlier) problems.push(at + ' comes after "' + s.after + '", which is not an earlier knob');
      }
    });
  }
  return problems;
}

// Play one piece to its end, as the stage would. Returns { ok, problems, taps, seconds, title }.
export function play(mod, seed, options) {
  const opts = options || {};
  const stars = opts.stars || STARS;
  const out = { seed, stars: stars.length, ok: false, problems: [], taps: 0, seconds: 0, title: '', steps: 0, signature: '' };
  let piece;
  try {
    piece = mod.piece(makeEnv(seed, stars));
  } catch (err) {
    out.problems.push('piece() threw: ' + (err && err.message || err));
    return out;
  }
  const shape = shapeProblems(piece);
  if (shape.length) {
    out.problems.push(...shape);
    return out;
  }
  out.title = piece.title;
  out.steps = piece.steps.length;
  out.signature = signatureOf(piece);
  try {
    const again = mod.piece(makeEnv(seed, stars));
    if (signatureOf(again) !== out.signature) out.problems.push('the same seed does not make the same piece');
  } catch (err) {
    out.problems.push('piece() threw the second time: ' + (err && err.message || err));
  }
  if (out.problems.length) return out;

  const driver = mulberry32(seed ^ 0x5bd1e995);
  const canvas = { width: W, height: H, getContext: () => g };
  const g = stubContext(canvas);
  const state = new Map(piece.steps.map((s) => [s.id, { step: s, set: false, value: undefined }]));
  let completed = false;
  let ended = false;
  let touched = false; // has the visitor set a knob yet?
  let time = 0;
  const env = makeEnv(seed, stars);

  function allSet() {
    for (const s of state.values()) if (!s.set) return false;
    return true;
  }
  function finish() {
    if (completed) return;
    if (!touched) out.problems.push('the piece finished before any knob was set; a piece is finished by its visitor');
    completed = true;
    if (!ended && typeof piece.end === 'function') {
      ended = true;
      piece.end(ctx);
    }
  }
  function mark(id, value) {
    const s = state.get(id);
    if (!s) return;
    if (value !== undefined) s.value = value;
    if (!s.set) {
      s.set = true;
      if (allSet() && piece.auto !== false) finish();
    }
  }
  const ctx = {
    canvas, g, w: W, h: H, dpr: 1,
    colors: env.colors, rnd: env.rnd, pick: env.pick, int: env.int, chance: env.chance, stars,
    points(w, h, pad) {
      const p = pad || 0;
      return stars.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    mix, alpha, reduced: false,
    satisfy(id, value) {
      const s = state.get(id);
      if (!s) return;
      if (!touched) out.problems.push('the piece set knob "' + id + '" itself before the visitor had set anything');
      else if (s.step.kind !== 'tap' && s.step.kind !== 'wait') out.problems.push('the piece set knob "' + id + '" itself; only a tap or a wait knob is the piece\'s to set');
      mark(id, value);
    },
    progress() {},
    status() {},
    value(id) { const s = state.get(id); return s ? s.value : undefined; },
    get done() { return completed; },
    get elapsed() { return time; },
    complete() { finish(); }
  };
  function apply(id, value) {
    touched = true;
    const s = state.get(id);
    if (s) s.value = value;
    if (typeof piece.apply === 'function') piece.apply(id, value, ctx);
  }
  function frames(seconds) {
    const n = Math.max(1, Math.round(seconds / FRAME));
    for (let i = 0; i < n && time < MAX_SECONDS + 1; i++) {
      time += FRAME;
      if (typeof piece.frame === 'function') piece.frame(time, FRAME, ctx);
    }
  }
  function unlocked(s) {
    return !s.step.after || (state.get(s.step.after) || { set: true }).set;
  }

  try {
    // Where each slider starts is known to the piece from the first frame, as on the stage.
    for (const s of state.values()) {
      if (s.step.kind !== 'range') continue;
      const min = Number(s.step.min == null ? 0 : s.step.min);
      const max = Number(s.step.max == null ? 100 : s.step.max);
      s.value = s.step.value == null ? (min + max) / 2 : Number(s.step.value);
    }
    if (typeof piece.start === 'function') piece.start(ctx);
    frames(SETTLE);
    // Knobs in order, skipping locked ones until their gate opens; a pass that sets nothing ends it.
    let moved = true;
    while (!completed && moved && time < MAX_SECONDS) {
      moved = false;
      for (const s of state.values()) {
        if (s.set || !unlocked(s)) continue;
        const step = s.step;
        switch (step.kind) {
          case 'choice': {
            const option = step.options[Math.floor(driver() * step.options.length)];
            apply(step.id, option.value);
            mark(step.id, option.value);
            break;
          }
          case 'toggle': {
            const on = !step.value; // the first press flips it, as on the stage
            apply(step.id, on);
            mark(step.id, on);
            break;
          }
          case 'range': {
            const min = Number(step.min == null ? 0 : step.min);
            const max = Number(step.max == null ? 100 : step.max);
            const inc = Number(step.step == null ? 1 : step.step) || 1;
            const v = min + Math.round(((max - min) * driver()) / inc) * inc;
            apply(step.id, v);
            mark(step.id, v);
            break;
          }
          case 'press': {
            const count = Math.max(1, Math.min(12, Number(step.count) || 3));
            for (let n = 1; n <= count; n++) {
              apply(step.id, n);
              frames(0.1);
            }
            mark(step.id, count);
            break;
          }
          case 'hold': {
            const ms = Math.max(300, Math.min(8000, Number(step.ms) || 1500));
            frames(ms / 1000);
            apply(step.id, ms);
            mark(step.id, ms);
            break;
          }
          case 'tap':
            while (!s.set && !completed && out.taps < MAX_TAPS) {
              touched = true;
              piece.tap(0.1 + driver() * 0.8, 0.1 + driver() * 0.8, ctx);
              out.taps += 1;
              frames(0.2);
            }
            if (!s.set && !completed) {
              out.problems.push('knob "' + step.id + '" was not set by ' + MAX_TAPS + ' taps of the scene');
            }
            break;
          case 'wait':
            while (!s.set && !completed && time < MAX_SECONDS) frames(0.5);
            if (!s.set && !completed) {
              out.problems.push('knob "' + step.id + '" was not set by ' + MAX_SECONDS + ' seconds of frames');
            }
            break;
          default:
            break;
        }
        if (s.set || completed) moved = true;
        if (out.problems.length) break;
        frames(SETTLE);
      }
      if (out.problems.length) break;
    }
    if (!completed && !out.problems.length) {
      if (piece.auto === false) {
        while (!completed && time < MAX_SECONDS) frames(0.5);
        if (!completed) out.problems.push('every knob is set but the piece never called complete() within ' + MAX_SECONDS + ' seconds');
      } else {
        const stuck = Array.from(state.values()).filter((s) => !s.set).map((s) => s.step.id);
        out.problems.push('the piece did not finish; still unset: ' + stuck.join(', '));
      }
    }
    if (completed) frames(1);
  } catch (err) {
    out.problems.push('the piece threw while played: ' + (err && err.stack ? String(err.stack).split('\n').slice(0, 2).join(' ') : err));
  }
  out.seconds = Math.round(time * 10) / 10;
  out.ok = completed && !out.problems.length;
  return out;
}

// Judge one module, already imported: every seed with the five stars, and the first seed again
// with the sky the stage may hand it (none for a module that does not read the sky, one star for
// one that does).
export function judgeModule(mod, seeds) {
  const report = { hasPiece: false, ok: false, problems: [], runs: [] };
  if (!mod || typeof mod.piece !== 'function') {
    report.problems.push('the module exports no piece()');
    return report;
  }
  report.hasPiece = true;
  for (const seed of seeds) {
    const run = play(mod, seed);
    report.runs.push(run);
    for (const p of run.problems) report.problems.push('seed ' + seed + ': ' + p);
  }
  const signatures = new Set(report.runs.map((r) => r.signature).filter(Boolean));
  if (report.runs.every((r) => r.ok) && signatures.size < 2) {
    report.problems.push('every seed makes the same piece (' + JSON.stringify(report.runs[0].title) + '); the river is of pieces that differ');
  }
  const sky = mod.needsSky ? ONE_STAR : [];
  const skyRun = play(mod, seeds[0], { stars: sky });
  report.runs.push(skyRun);
  for (const p of skyRun.problems) report.problems.push('seed ' + seeds[0] + ' with ' + (sky.length ? 'one star' : 'no stars') + ': ' + p);
  report.ok = report.runs.every((r) => r.ok) && !report.problems.length;
  for (const r of report.runs) delete r.signature;
  return report;
}

// In the worker: nothing a piece may not use is left reachable, then the module is played.
async function workerMain() {
  const forbid = (name) => function () {
    throw new Error(name + ' is not for a piece: randomness comes from the seeded rnd and time from the frame clock the stage hands it');
  };
  Math.random = forbid('Math.random');
  Date.now = forbid('Date.now');
  globalThis.Date = forbid('Date');
  if (globalThis.performance) globalThis.performance.now = forbid('performance.now');
  for (const name of ['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
    try {
      globalThis[name] = forbid(name);
    } catch (e) {
      /* a read-only global stays as it is */
    }
  }
  const { file, seeds } = workerData;
  let mod = null;
  try {
    mod = (await import(pathToFileURL(file).href)).default || null;
  } catch (err) {
    parentPort.postMessage({ hasPiece: false, ok: false, problems: ['the module does not import: ' + (err && err.message || err)], runs: [] });
    return;
  }
  parentPort.postMessage(judgeModule(mod, seeds));
}

function judgeInWorker(file, seeds) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (report) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      resolve(report);
    };
    const worker = new Worker(new URL(import.meta.url), { workerData: { file, seeds }, env: {}, stdout: true, stderr: true });
    worker.stdout.on('data', () => {}); // a module's stray console output goes nowhere
    worker.stderr.on('data', () => {});
    const timer = setTimeout(() => {
      finish({ hasPiece: true, ok: false, problems: ['the module did not finish within ' + MODULE_TIMEOUT_MS / 1000 + ' seconds of real time'], runs: [] });
    }, MODULE_TIMEOUT_MS);
    worker.on('message', finish);
    worker.on('error', (err) => finish({ hasPiece: true, ok: false, problems: ['the module threw: ' + (err && err.message || err)], runs: [] }));
    worker.on('exit', (code) => finish({ hasPiece: true, ok: false, problems: ['the module ended the run (exit ' + code + ') before it was judged'], runs: [] }));
  });
}

export async function judge(dir, seeds) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js')).sort();
  const modules = [];
  for (const file of files) {
    const id = file.replace(/\.js$/, '');
    const report = await judgeInWorker(path.join(dir, file), seeds);
    modules.push(Object.assign({ id, file }, report));
  }
  return modules;
}

async function main(argv) {
  const args = { modules: '', seeds: SEEDS, json: false, out: '', requireAll: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--modules') args.modules = argv[++i] || '';
    else if (a === '--seeds') args.seeds = String(argv[++i] || '').split(',').map((s) => Number(s.trim()) >>> 0).filter(Boolean);
    else if (a === '--json') args.json = true;
    else if (a === '--out') args.out = argv[++i] || '';
    else if (a === '--require-all') args.requireAll = true;
  }
  if (!args.modules) {
    process.stderr.write('usage: piece_harness.mjs --modules <dir> [--seeds 1,2,3] [--json] [--out report.json] [--require-all]\n');
    return 2;
  }
  const modules = await judge(args.modules, args.seeds.length ? args.seeds : SEEDS);
  const failing = modules.filter((m) => m.hasPiece ? !m.ok : args.requireAll);
  const report = { ok: !failing.length, minSteps: MIN_STEPS, maxSteps: MAX_STEPS, maxTaps: MAX_TAPS, maxSeconds: MAX_SECONDS, modules };
  if (args.out) await writeFile(args.out, JSON.stringify(report) + '\n');
  if (args.json) {
    process.stdout.write(JSON.stringify(report) + '\n');
  } else {
    for (const m of modules) {
      const mark = m.hasPiece ? (m.ok ? 'ok  ' : 'FAIL') : 'none';
      const runs = m.runs.map((r) => (r.ok ? '' : '!') + JSON.stringify(r.title || '?') + ' (' + r.steps + ' knobs, ' + r.taps + ' taps, ' + r.seconds + 's' + (r.stars !== 5 ? ', ' + r.stars + ' stars' : '') + ')').join(', ');
      process.stdout.write(mark + '  ' + m.id + (runs ? ': ' + runs : '') + '\n');
      for (const p of m.problems) process.stdout.write('      - ' + p + '\n');
    }
  }
  return failing.length ? 1 : 0;
}

if (!isMainThread) {
  workerMain().catch((err) => {
    parentPort.postMessage({ hasPiece: true, ok: false, problems: ['the harness failed in the worker: ' + (err && err.message || err)], runs: [] });
  });
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    process.stderr.write(String(err && err.stack || err) + '\n');
    process.exit(2);
  });
}
