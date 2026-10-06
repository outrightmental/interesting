#!/usr/bin/env node
/*
  Run site/js/stage.js against a stub browser and report what the stage did, as JSON on stdout.

      node .github/scripts/stage_harness.mjs --stage <dir with stage.js and modules/>
                                             --worlds '<the #site-worlds JSON>'
                                             [--open world.html] [--deal world.html,world.html]
                                             [--pretty]

  The piece harness beside this one plays a module's piece the way the stage would; this one plays
  the stage itself. They answer different questions. A piece can be perfectly finishable and the
  stage still leave a visitor stuck -- which is what issue #60 was: a slider could not be set by
  anyone content with where it already stood, so a visitor who set every other knob, watched the
  finale run, and waited, waited on a piece that was never going to finish. It was reported on the
  lantern and it was never the lantern's: the same dead end was reachable in the quiet room and the
  machine shop. No law caught any of it, because no law had ever run js/stage.js.

  What the stub is: a document of the elements _includes/stage.njk writes, a window with a virtual
  clock (every timer, interval and animation frame the stage asks for is scheduled against it and
  stepped by hand, so a scenario is deterministic and takes no real time), a canvas context that
  records nothing, a persona with a sky of five stars, and a feed that deals the worlds it was
  told to. Nothing here is a browser; it is the handful of objects the stage touches.

  The scenarios, each in a worker thread of its own so one stage is one page's worth of state:

    rounds            Play piece after piece through one stage, with the deal bringing a world
                      round again. Every round must finish and open the next: a world played
                      before has to play like the first time (the replay half of issue #60).
    sliderUsed        Play every knob, and use the slider without moving it -- the visitor is
                      happy where it is. The piece must still finish.
    sliderUntouched   Play every knob but the slider, and never touch it. The piece must not
                      finish -- a knob nobody set is not set -- but the stage must say which knob
                      it is still waiting on, so this is a visitor who knows what to do next and
                      not one staring at a finished-looking toy.
    holdFilled        Work down a piece's knobs until a hold is reachable, press it, and never let
                      go. The bar fills and the stage must take the knob there and then -- holding
                      is the answer and the release is not part of it -- and the release, when it
                      finally comes, must change nothing (issue #74).
    teardown          Open a piece, work down its knobs until a hold is reachable, press that one
                      and keep pressing, then open a world whose module is not there. Nothing of
                      the first piece may be left on the stage and nothing of it may still be
                      running.

  Every scenario reports what it observed and makes no judgements: StageTest in
  test_make_interesting.py makes the assertions, as ParticipateButtonTest does for the button.
*/

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const SCENARIOS = ['rounds', 'sliderUsed', 'sliderUntouched', 'holdFilled', 'teardown'];
const SCENARIO_TIMEOUT_MS = 20000;
const MISSING_WORLD = 'stage-harness-nowhere.html'; // a world with no module, for the teardown
const SEEDS = [4242, 101, 99991, 7]; // tried in turn until a piece with the knob wanted turns up
const STARS = [
  { x: 18, y: 30, text: 'a window left open' },
  { x: 52, y: 22, text: 'the sound of a kettle' },
  { x: 71, y: 58, text: 'one more page' },
  { x: 35, y: 70, text: 'the long way home' },
  { x: 86, y: 26, text: 'a word I keep' }
];

/* ---- the virtual clock --------------------------------------------------------------------- */

/* Time only moves when a scenario moves it. The stage's own timers, the hold knob's ticker and
   the frame loop all run off this, so a 1.8-second hold costs nothing and the ceremony's linger
   is waited out exactly. Node's real timers are kept aside for one purpose: giving the event loop
   a turn, because open() awaits the module's import and no amount of virtual time resolves that. */
function makeClock() {
  const realSetTimeout = setTimeout;
  const pending = new Map();
  let now = 0;
  let seq = 0;

  function schedule(fn, ms, every) {
    const id = ++seq;
    pending.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, every: every ? Math.max(1, Number(ms) || 1) : 0 });
    return id;
  }

  function due(until) {
    let found = null;
    for (const [id, timer] of pending) {
      if (timer.at > until) continue;
      if (!found || timer.at < found[1].at || (timer.at === found[1].at && id < found[0])) found = [id, timer];
    }
    return found;
  }

  return {
    get now() {
      return now;
    },
    get waiting() {
      return pending.size;
    },
    set: (fn, ms) => schedule(fn, ms, false),
    every: (fn, ms) => schedule(fn, ms, true),
    clear: (id) => pending.delete(id),
    settle: () => new Promise((resolve) => realSetTimeout(resolve, 0)),
    async advance(ms) {
      const until = now + Math.max(0, ms);
      let since = 0;
      for (;;) {
        const found = due(until);
        if (!found) break;
        const [id, timer] = found;
        now = timer.at;
        if (timer.every) timer.at = now + timer.every;
        else pending.delete(id);
        timer.fn(now);
        // A real turn of the event loop now and then, and at the end of every advance, because
        // open() awaits a dynamic import and nothing but the real loop resolves that. In between,
        // a microtask is enough: a second of animation frames does not need sixty real turns.
        if (++since >= 20) {
          since = 0;
          await this.settle();
        } else {
          await Promise.resolve();
        }
      }
      now = until;
      await this.settle();
    }
  };
}

/* ---- the document ------------------------------------------------------------------------- */

const SIMPLE = /([.#]?[\w-]+|\[[\w-]+\]|:not\(\[[\w-]+\]\))/g;

function matches(node, simple) {
  for (const part of simple.match(SIMPLE) || []) {
    if (part[0] === '.') {
      if (!node.classList.contains(part.slice(1))) return false;
    } else if (part[0] === '#') {
      if (node.getAttribute('id') !== part.slice(1)) return false;
    } else if (part.slice(0, 5) === ':not(') {
      const name = part.slice(6, -2);
      if (node[name] || node.hasAttribute(name)) return false;
    } else if (part[0] === '[') {
      const name = part.slice(1, -1);
      if (!node[name] && !node.hasAttribute(name)) return false;
    } else if (node.tagName !== part.toUpperCase()) {
      return false;
    }
  }
  return true;
}

// A 2D context that accepts anything and records nothing, as in the piece harness.
function stubContext(canvas) {
  const state = { canvas };
  const gradient = () => ({ addColorStop() {} });
  const special = {
    canvas,
    measureText: (text) => ({ width: String(text || '').length * 8 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({ setTransform() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => []
  };
  return new Proxy(state, {
    get: (target, prop) => (prop in special ? special[prop] : (prop in target ? target[prop] : () => {})),
    set: (target, prop, value) => ((target[prop] = value), true)
  });
}

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.dataset = {};
    this.handlers = new Map();
    this.css = new Map(); // the custom properties the stage sets, which a scenario reads back
    this.classes = new Set();
    this.words = '';
    this.hidden = false;
    this.disabled = false;
    this.box = { width: 640, height: 400, top: 0, left: 0, bottom: 400, right: 640 };
    const self = this;
    this.classList = {
      add: (...names) => names.forEach((name) => self.classes.add(name)),
      remove: (...names) => names.forEach((name) => self.classes.delete(name)),
      toggle: (name, on) => {
        const want = on === undefined ? !self.classes.has(name) : !!on;
        if (want) self.classes.add(name);
        else self.classes.delete(name);
      },
      contains: (name) => self.classes.has(name)
    };
    this.style = {
      setProperty: (name, value) => self.css.set(name, String(value)),
      removeProperty: (name) => self.css.delete(name),
      getPropertyValue: (name) => self.css.get(name) || ''
    };
  }

  get className() {
    return Array.from(this.classes).join(' ');
  }

  set className(value) {
    this.classes = new Set(String(value == null ? '' : value).split(/\s+/).filter(Boolean));
  }

  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join('') : this.words;
  }

  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.words = value == null ? '' : String(value);
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
    if (name.slice(0, 5) === 'data-') this.dataset[name.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = String(value);
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const at = this.children.indexOf(before);
    this.children.splice(at < 0 ? this.children.length : at, 0, child);
    return child;
  }

  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  get all() {
    const out = [];
    for (const child of this.children) {
      out.push(child);
      out.push(...child.all);
    }
    return out;
  }

  querySelectorAll(selector) {
    const parts = String(selector).split(',').map((s) => s.trim()).filter(Boolean);
    return this.all.filter((node) => parts.some((part) => matches(node, part)));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this.handlers.get(type) || [];
    const at = list.indexOf(fn);
    if (at >= 0) list.splice(at, 1);
  }

  dispatchEvent(event) {
    const ev = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, event);
    for (const fn of (this.handlers.get(ev.type) || []).slice()) fn(ev);
    return true;
  }

  focus() {}

  getBoundingClientRect() {
    return this.box;
  }

  scrollIntoView() {}

  getContext() {
    if (!this.ctx) this.ctx = stubContext(this);
    return this.ctx;
  }
}

/* The stage as _includes/stage.njk writes it, with the globals js/stage.js reads. */
function makePage(worlds, clock) {
  const html = new Node('html');
  html.setAttribute('data-root', '');
  const doc = {
    documentElement: html,
    title: 'a world · interesting',
    hidden: false,
    readyState: 'complete',
    createElement: (tag) => new Node(tag),
    getElementById: (id) => html.all.find((node) => node.getAttribute('id') === id) || null,
    addEventListener() {}
  };

  const make = (tag, id, parent, className) => {
    const node = new Node(tag);
    if (id) node.setAttribute('id', id);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  };

  const body = make('body', null, html);
  make('script', 'site-worlds', body).textContent = JSON.stringify(worlds);

  const stage = make('main', 'stage', body, 'stage');
  stage.setAttribute('data-mode', 'idle');
  make('canvas', 'stage-burst', stage);
  const inner = make('div', 'stage-inner', stage);
  const head = make('div', null, inner, 'stage-head');
  make('h1', 'stage-world', head).textContent = 'a world';
  make('h2', 'stage-title', head).textContent = 'what this world is for';
  make('p', 'stage-brief', head);
  const sbody = make('div', 'stage-body', inner);
  const scene = make('div', 'stage-scene', sbody);
  make('canvas', 'stage-canvas', scene).setAttribute('aria-label', 'the scene');
  const done = make('div', 'stage-done', scene);
  done.hidden = true;
  make('p', 'stage-done-text', done).textContent = 'done';
  const side = make('div', null, sbody, 'stage-side');
  make('div', 'stage-knobs', side);
  make('p', 'stage-status', side);
  const wanted = make('p', 'stage-wanted', side);
  wanted.hidden = true;
  const foot = make('div', null, side, 'stage-foot');
  const actions = make('div', null, foot, 'stage-foot-actions');
  make('button', 'stage-skip', actions).hidden = true;
  make('div', 'stage-progress', foot);

  const events = [];
  const modes = [];
  const win = {
    document: doc,
    innerHeight: 800,
    devicePixelRatio: 1,
    setTimeout: (fn, ms) => clock.set(fn, ms),
    clearTimeout: (id) => clock.clear(id),
    setInterval: (fn, ms) => clock.every(fn, ms),
    clearInterval: (id) => clock.clear(id),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    scrollTo() {},
    handlers: new Map(),
    addEventListener(type, fn) {
      if (!win.handlers.has(type)) win.handlers.set(type, []);
      win.handlers.get(type).push(fn);
    },
    removeEventListener() {},
    dispatchEvent(event) {
      events.push({ type: event.type, detail: event.detail || null, at: clock.now });
      for (const fn of (win.handlers.get(event.type) || []).slice()) fn(event);
      return true;
    },
    MutationObserver: class {
      observe() {}
    },
    interestingPersona: {
      stars: () => STARS.map((star) => Object.assign({}, star)),
      onSky: () => () => {}
    }
  };

  // The mode is the stage's one visible state machine, so every change it makes is kept.
  const raw = stage.dataset;
  stage.dataset = new Proxy(raw, {
    set(target, key, value) {
      if (key === 'mode') modes.push(String(value));
      target[key] = value;
      return true;
    }
  });

  globalThis.window = win;
  globalThis.document = doc;
  globalThis.history = { pushState() {}, replaceState() {} };
  globalThis.location = { hash: '' };
  globalThis.performance = { now: () => clock.now };
  globalThis.requestAnimationFrame = (fn) => clock.set(fn, 16);
  globalThis.cancelAnimationFrame = (id) => clock.clear(id);
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    }
  };

  return { doc, win, stage, events, modes };
}

/* ---- playing the stage --------------------------------------------------------------------- */

const MAX_TAPS = 12;

function knobsOn(page) {
  return page.doc.getElementById('stage-knobs').children;
}

function isSet(knob) {
  return knob.classList.contains('is-set');
}

function isLocked(knob) {
  return knob.classList.contains('is-locked');
}

/* One knob, worked the way a visitor would work it -- through the stage's own control, which is
   the whole point of this harness. Whether the stage then marks the knob set is the stage's
   answer and the caller reads it off the knob. `slider` says what to do with a range knob: 'move'
   drags it, 'use' presses it where it stands without moving it, 'leave' leaves it alone. */
async function setKnob(page, clock, knob, slider) {
  const kind = knob.dataset.kind;
  const fire = (node, type, extra) => node.dispatchEvent(Object.assign({ type }, extra || {}));
  if (kind === 'choice' || kind === 'toggle') {
    fire(knob.querySelector('button'), 'click');
    await clock.advance(120);
    return;
  }
  if (kind === 'range') {
    if (slider === 'leave') return;
    const input = knob.querySelector('input');
    if (slider === 'move') {
      const min = Number(input.min);
      const max = Number(input.max);
      input.value = String(Math.round(min + (max - min) * 0.75));
      fire(input, 'input');
      fire(input, 'change');
    } else {
      // Pressed and let go where it already stood: no 'change' event, because nothing changed.
      fire(input, 'pointerdown');
      fire(input, 'pointerup');
    }
    await clock.advance(120);
    return;
  }
  if (kind === 'press') {
    const button = knob.querySelector('button');
    for (let i = 0; i < 12 && !isSet(knob); i++) {
      fire(button, 'click');
      await clock.advance(80);
    }
    return;
  }
  if (kind === 'hold') {
    const button = knob.querySelector('button');
    fire(button, 'pointerdown');
    // The bar sets the knob the moment it fills, so keep holding until the stage says it is set --
    // and never wait forever. The let-go after that is a visitor taking their finger off a knob
    // that is already set, which has to change nothing at all (issue #74).
    for (let i = 0; i < 400 && !isSet(knob); i++) await clock.advance(50);
    fire(button, 'pointerup');
    await clock.advance(120);
    return;
  }
  if (kind === 'tap') {
    const canvas = page.doc.getElementById('stage-canvas');
    for (let i = 0; i < MAX_TAPS && !isSet(knob); i++) {
      fire(canvas, 'pointerdown', { clientX: 60 + i * 37, clientY: 50 + i * 29 });
      await clock.advance(220);
    }
    return;
  }
  if (kind === 'wait') {
    for (let i = 0; i < 120 && !isSet(knob); i++) await clock.advance(500);
    return;
  }
}

// Wait for a piece to be on the stage and playable.
async function waitForPiece(page, clock) {
  for (let i = 0; i < 100; i++) {
    const mode = page.stage.dataset.mode;
    if (knobsOn(page).length && (mode === 'live' || mode === 'arriving')) return true;
    await clock.advance(200);
  }
  return false;
}

/* Set every knob the piece has, in the order the stage lays them out, skipping the ones still
   locked until their gate opens -- the way the stage's own documentation says a visitor meets
   them. A pass that sets nothing ends it, and the passes are bounded: a knob the visitor works
   and the stage does not mark set is exactly what this harness is here to report, not to wait on.
   Returns what was left unset. */
async function playKnobs(page, clock, slider) {
  const passes = knobsOn(page).length + 2;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (const knob of knobsOn(page)) {
      if (isSet(knob) || isLocked(knob)) continue;
      await setKnob(page, clock, knob, slider);
      if (isSet(knob)) moved = true;
    }
    if (!moved) break;
  }
  return knobsOn(page).filter((knob) => !isSet(knob)).map((knob) => knob.dataset.id);
}

function look(page) {
  const by = (id) => page.doc.getElementById(id);
  return {
    mode: page.stage.dataset.mode,
    title: by('stage-title').textContent,
    status: by('stage-status').textContent,
    wanted: by('stage-wanted').hidden ? '' : by('stage-wanted').textContent,
    knobs: knobsOn(page).map((knob) => ({ id: knob.dataset.id, kind: knob.dataset.kind, set: isSet(knob) })),
    dots: by('stage-progress').querySelectorAll('.stage-dot').length,
    doneShown: !by('stage-done').hidden,
    skipShown: !by('stage-skip').hidden,
    sceneLabel: by('stage-canvas').getAttribute('aria-label'),
    aspect: by('stage-scene').css.get('--piece-aspect') || ''
  };
}

/* ---- the scenarios ------------------------------------------------------------------------- */

async function load(stageDir, worlds, clock) {
  const page = makePage(worlds, clock);
  await import(pathToFileURL(path.join(stageDir, 'stage.js')).href);
  // The stage loads every module 1.5 seconds in, to learn which read the sky; let it.
  await clock.advance(2000);
  return page;
}

// Piece after piece through one stage, with the deal bringing a world round again.
async function rounds(stageDir, worlds, deal, clock) {
  const page = await load(stageDir, worlds, clock);
  let dealt = 0;
  page.win.interestingFeed = {
    take: () => (dealt < deal.length ? deal[dealt++] : null),
    consume() {}
  };
  const api = page.win.interestingStage;
  const report = [];
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  dealt = 1;
  for (let i = 0; i < deal.length; i++) {
    if (!(await waitForPiece(page, clock))) {
      report.push({ playable: false, was: api.current(), look: look(page) });
      break;
    }
    const was = api.current();
    page.modes.length = 0;
    const unset = await playKnobs(page, clock, 'move');
    const finished = look(page);
    await clock.advance(6000); // the ceremony lingers, vanishes and opens the next
    const now = api.current();
    report.push({
      playable: true,
      was,
      unset,
      modes: page.modes.slice(),
      wantedWhilePlaying: finished.wanted,
      movedOn: !!(now && was && (now.file !== was.file || now.seed !== was.seed)),
      now,
      look: look(page)
    });
  }
  return { rounds: report, completes: page.events.filter((e) => e.type === 'stage:complete').length,
           opens: page.events.filter((e) => e.type === 'stage:open').length };
}

// One piece with a slider on it, played with the slider either used where it stands or never
// touched at all. Which world that is, is found rather than assumed: the deal first, then every
// world the site lists, so the law does not go quietly vacuous when the worlds are rewritten.
async function slider(stageDir, worlds, deal, clock, how) {
  const page = await load(stageDir, worlds, clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  const tries = [deal[0].file].concat(worlds.map((world) => world.file));
  let world = '';
  let seed = 0;
  let ranges = [];
  // A few seeds each, because which knobs a piece has is the seed's to decide: one seed per world
  // would let a site full of sliders report none.
  for (const at of SEEDS) {
    for (const file of tries) {
      api.open(file, at, { arriving: true });
      if (!(await waitForPiece(page, clock))) continue;
      ranges = knobsOn(page).filter((knob) => knob.dataset.kind === 'range').map((knob) => knob.dataset.id);
      if (ranges.length) {
        world = file;
        seed = at;
        break;
      }
    }
    if (world) break;
  }
  if (!world) return { playable: false, world: '', seed: 0, ranges: [], look: look(page) };
  page.events.length = 0;
  page.modes.length = 0;
  const unset = await playKnobs(page, clock, how);
  const settled = look(page);
  await clock.advance(6000);
  return {
    playable: true,
    world,
    seed,
    ranges,
    unset,
    modes: page.modes.slice(),
    wanted: settled.wanted,
    finished: page.events.some((e) => e.type === 'stage:complete'),
    look: look(page)
  };
}

/* The knobs worked down until a hold is reachable: a hold is often behind a gate, so getting to one
   is playing the piece as far as it. Returns the hold's knob, or null if this piece has none a
   visitor can get to. Both the hold scenarios go through here. */
async function reachHold(page, clock) {
  for (let pass = 0; pass < knobsOn(page).length + 2; pass++) {
    let moved = false;
    for (const knob of knobsOn(page)) {
      if (isSet(knob) || isLocked(knob)) continue;
      if (knob.dataset.kind === 'hold') return knob;
      await setKnob(page, clock, knob, 'move');
      if (isSet(knob)) moved = true;
    }
    if (!moved) break;
  }
  return null;
}

/* A hold pressed and never let go. Which world has a hold on it, and behind which gate, is the
   seed's to decide, so one is looked for rather than assumed -- the way the slider is -- and the
   scenario says so when it found none, rather than going quietly vacuous. */
async function holdFilled(stageDir, worlds, deal, clock) {
  const page = await load(stageDir, worlds, clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  const tries = [deal[0].file].concat(worlds.map((world) => world.file));
  for (const at of SEEDS) {
    for (const file of tries) {
      api.open(file, at, { arriving: true });
      if (!(await waitForPiece(page, clock))) continue;
      const knob = await reachHold(page, clock);
      if (knob) return keepHolding(page, clock, file, at, knob);
    }
  }
  return { playable: false, world: '', seed: 0, held: '', look: look(page) };
}

/* One hold, pressed and held: what the stage did while the bar filled, what it did going on past
   the fill, and what the release changed. The three have to read the same -- the knob set, the bar
   full, and nothing about letting go early -- because the fill is what sets the knob and the
   release is a finger coming off a knob already set.

   Held down with the keyboard, which is the way into a hold nothing else here takes: a space held
   has to fill the bar exactly as a finger does, and the keyup that eventually comes has to be as
   much of a no-op as the pointerup. setKnob's pointer hold is played by every other scenario. */
async function keepHolding(page, clock, world, seed, knob) {
  const button = knob.querySelector('button');
  const status = page.doc.getElementById('stage-status');
  const state = () => ({
    set: isSet(knob),
    pct: knob.css.get('--knob-pct') || '',
    status: status.textContent,
    completes: page.events.filter((e) => e.type === 'stage:complete').length
  });
  page.events.length = 0;
  button.dispatchEvent({ type: 'keydown', key: ' ' });
  // Time, and nothing else: no keyup, no pointerup, no second press. Whether the knob is set is
  // the stage's answer on its own account.
  let waited = 0;
  for (let i = 0; i < 400 && !isSet(knob); i++) {
    await clock.advance(50);
    waited += 50;
  }
  const filled = state();
  // Held on well past the fill, but inside the ceremony's linger, so the knobs a finished piece
  // started saying goodbye to are still there to be read.
  await clock.advance(300);
  const kept = state();
  button.dispatchEvent({ type: 'keyup', key: ' ' });
  await clock.advance(120);
  return { playable: true, world, seed, held: knob.dataset.id, waited, filled, kept, after: state() };
}

// A piece part-played, a hold still pressed down, and then a world with no module at all.
async function teardown(stageDir, worlds, deal, clock) {
  const nowhere = { file: MISSING_WORLD, name: 'nowhere', orientation: 'lost', mood: 'tender', what: 'No module lives here.' };
  const page = await load(stageDir, worlds.concat([nowhere]), clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  if (!(await waitForPiece(page, clock))) return { playable: false, look: look(page) };
  // Work down the knobs until a hold is reachable, and then press it and keep pressing: a hold
  // still down when the piece goes is the clearest thing a stage can leave running behind it.
  // Kept short of the fill, which would set the knob and leave the piece with nothing to tear down.
  const knob = await reachHold(page, clock);
  let held = '';
  if (knob) {
    knob.querySelector('button').dispatchEvent({ type: 'pointerdown' });
    await clock.advance(200);
    held = knob.dataset.id;
  }
  const playing = look(page);
  const whilePlaying = clock.waiting;
  api.open(MISSING_WORLD, 7, { push: false });
  await clock.advance(3000);
  return { playable: true, held, playing, whilePlaying, waiting: clock.waiting, current: api.current(), look: look(page) };
}

async function runScenario(name, stageDir, worlds, deal) {
  const clock = makeClock();
  if (name === 'rounds') return rounds(stageDir, worlds, deal, clock);
  if (name === 'sliderUsed') return slider(stageDir, worlds, deal, clock, 'use');
  if (name === 'sliderUntouched') return slider(stageDir, worlds, deal, clock, 'leave');
  if (name === 'holdFilled') return holdFilled(stageDir, worlds, deal, clock);
  if (name === 'teardown') return teardown(stageDir, worlds, deal, clock);
  throw new Error('no scenario named ' + name);
}

/* ---- the worker, and the run ---------------------------------------------------------------- */

async function workerMain() {
  const { scenario, stageDir, worlds, deal } = workerData;
  try {
    parentPort.postMessage({ ok: true, result: await runScenario(scenario, stageDir, worlds, deal) });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String((err && err.stack) || err) });
  }
}

function inWorker(scenario, stageDir, worlds, deal) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      resolve(message);
    };
    // The report is this run's stdout, and a module or a stage is model-written code that may say
    // something on its own account; piped away, a stray console.log cannot turn the report into
    // something its caller cannot parse. The environment is empty for the same reason as the piece
    // harness: the scenario needs nothing from it.
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { scenario, stageDir, worlds, deal },
      env: {},
      stdout: true,
      stderr: true
    });
    worker.stdout.on('data', () => {});
    worker.stderr.on('data', () => {});
    const timer = setTimeout(() => finish({ ok: false, error: 'the scenario did not finish within '
      + SCENARIO_TIMEOUT_MS / 1000 + ' seconds of real time' }), SCENARIO_TIMEOUT_MS);
    worker.on('message', finish);
    worker.on('error', (err) => finish({ ok: false, error: String((err && err.message) || err) }));
    worker.on('exit', (code) => finish({ ok: false, error: 'the scenario ended the run (exit ' + code + ')' }));
  });
}

export async function play(stageDir, worlds, deal) {
  const out = {};
  for (const scenario of SCENARIOS) out[scenario] = await inWorker(scenario, stageDir, worlds, deal);
  return out;
}

async function main(argv) {
  const args = { stage: '', worlds: '', open: '', deal: '', pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stage') args.stage = argv[++i] || '';
    else if (a === '--worlds') args.worlds = argv[++i] || '';
    else if (a === '--open') args.open = argv[++i] || '';
    else if (a === '--deal') args.deal = argv[++i] || '';
    else if (a === '--pretty') args.pretty = true;
  }
  if (!args.stage || !args.worlds) {
    process.stderr.write('usage: stage_harness.mjs --stage <dir> --worlds <json> [--open world.html] [--deal a.html,b.html]\n');
    return 2;
  }
  const worlds = JSON.parse(args.worlds);
  const files = (args.deal ? args.deal.split(',') : []).map((f) => f.trim()).filter(Boolean);
  const first = args.open || files[0] || (worlds[0] && worlds[0].file);
  // A deal of one world is a world played, dealt again, and played again: the replay the law wants.
  const order = files.length ? files : [first, worlds[1] ? worlds[1].file : first, first];
  const deal = order.map((file, i) => ({ file, seed: 1000 + i * 7717, kind: 'world' }));
  const report = await play(path.resolve(args.stage), worlds, deal);
  process.stdout.write(JSON.stringify(report, null, args.pretty ? 2 : 0) + '\n');
  return Object.values(report).every((r) => r && r.ok) ? 0 : 1;
}

if (!isMainThread) {
  workerMain().catch((err) => parentPort.postMessage({ ok: false, error: String((err && err.stack) || err) }));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    process.stderr.write(String((err && err.stack) || err) + '\n');
    process.exit(2);
  });
}
