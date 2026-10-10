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

  Every piece is a puzzle now, finished by a check that solves it and by nothing else, so every
  scenario that plays a piece out plays it the way a visitor who knows the answer would: the
  helper knobs worked, the answer knobs set to the module's own solution -- read by asking the
  module for the same piece the stage opened, with the same seed, configuration, card and sky --
  and then the check pressed. What the stage does with that press is the stage's own answer.

  The scenarios, each in a worker thread of its own so one stage is one page's worth of state:

    rounds            Play piece after piece through one stage, with the deal bringing a world
                      round again. Every round must solve and open the next: a world played
                      before has to play like the first time (the replay half of issue #60).
                      Nothing moves on by itself any more (issue #78), so each round waits out
                      six seconds -- long past the linger the stage used to depart on -- to see
                      that the piece it solved is still there, and then presses the way on in
                      the lower right, which is what opens the next.
    wrongThenRight    The puzzle half. Open a piece, work its helpers, set every answer wrong and
                      press check: the stage must say so, count the try, leave every knob live and
                      the piece unfinished, and light nothing. Then set the answers right and
                      check again: solved, on the second try, with the done chip saying so.
    afterDone         Play a piece to its finish and then go on playing with it. Done is not the
                      End (issue #86): six seconds after the ceremony the frames must still be
                      drawing, the knobs must still be enabled and settable again, a tap must still
                      reach the piece, nothing may have been torn down -- and the ceremony must have
                      played once through all of it. Also where the done mark's place in the tree is
                      read off: a mark inside the scene is a mark over the content.
    sliderUsed        Play every knob, and use the slider without moving it -- the visitor is
                      happy where it is. The stage must take the slider as set and offer the
                      check, and the check pressed must give a verdict.
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
    pressAnswered     The responsiveness axiom (issue #89). Press the scene where the press has
                      nothing to reach -- a module still loading, a tap knob still locked behind
                      another, a piece with no tap knob at all -- and report whether the stage
                      answered for the piece, and what it left behind. The press must be visibly
                      received and must cost nothing else: no knob set, no progress, no finish,
                      and nothing the piece can see. Then the same press with the gate open, where
                      the press is the piece's again and the stage must add nothing of its own;
                      the same press with less motion asked for; and a press on a piece that is
                      taken away under it, which may leave nothing behind.
    difficultyMoved   The difficulty, settable where it is a dependency (issue #93). Open a piece,
                      find the slider the stage asked the persona for at the foot of the rail, move
                      it to the fiercest setting, and report what the stage did: the piece has to be
                      dealt again at the same world and the same seed, it has to be the piece the
                      module makes at the new setting, and it has to still play to its end.
    carried           The alignment axiom (issue #80). Open a piece the way js/feed.js opens one
                      from a pressed card -- with the card's configuration and the content it was
                      showing -- and report what the stage did with them: what the heading said
                      while the module was still loading, what it said once the piece began, what
                      shape the scene was framed in, and what the piece saw on its env. Then the
                      same card on a world with no module at all, which is where the stage used to
                      fall back on the world's one line, and then a piece opened with no card at
                      all, which the stage has to configure from the seed instead.

  Every scenario reports what it observed and makes no judgements: StageTest in
  test_make_interesting.py makes the assertions, as ParticipateButtonTest does for the button.
*/

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { wrongFor, difficultyAt, MIDDLE_DIFFICULTY } from './piece_harness.mjs';

const SCENARIOS = ['rounds', 'wrongThenRight', 'afterDone', 'sliderUsed', 'sliderUntouched', 'holdFilled', 'teardown',
                   'carried', 'pressAnswered', 'difficultyMoved'];
const SCENARIO_TIMEOUT_MS = 20000;
const MISSING_WORLD = 'stage-harness-nowhere.html'; // a world with no module: the teardown and the card
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

// What the stage last gave the keyboard to. A browser has document.activeElement; this is the one
// thing the scenarios need out of it, which is whether a finished piece handed the way on the focus.
let focused = null;

function focusedId() {
  return focused ? focused.getAttribute('id') || '' : '';
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

  focus() {
    focused = this;
  }

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
  const inner = make('div', 'stage-inner', stage);
  const head = make('div', null, inner, 'stage-head');
  make('h1', 'stage-world', head).textContent = 'a world';
  make('h2', 'stage-title', head).textContent = 'what this world is for';
  make('p', 'stage-brief', head);
  const goal = make('p', 'stage-goal', head);
  goal.hidden = true;
  make('span', 'stage-goal-text', goal);
  const sbody = make('div', 'stage-body', inner);
  const scene = make('div', 'stage-scene', sbody);
  make('canvas', 'stage-canvas', scene).setAttribute('aria-label', 'the scene');
  const side = make('div', null, sbody, 'stage-side');
  make('div', 'stage-knobs', side);
  // The check and the score beside it, as _includes/stage.njk writes them: the one way a puzzle
  // is finished, dim until every knob is set.
  const checkRow = make('div', null, side, 'stage-check-row');
  make('button', 'stage-check', checkRow, 'btn-filled stage-check').disabled = true;
  const tries = make('p', 'stage-tries', checkRow);
  tries.hidden = true;
  make('p', 'stage-status', side);
  const wanted = make('p', 'stage-wanted', side);
  wanted.hidden = true;
  const foot = make('div', null, side, 'stage-foot');
  make('div', null, foot, 'stage-foot-actions');
  // The done mark reports from the end of the dots' row and never from over the scene (issue #86),
  // so it is written here, inside the rail, the way _includes/stage.njk writes it. Where it is in
  // the tree is one of the things look() reads back: a mark laid over the picture is the bug.
  const end = make('div', null, foot, 'stage-foot-end');
  const done = make('p', 'stage-done', end);
  done.hidden = true;
  make('span', 'stage-done-text', done).textContent = 'done';
  make('div', 'stage-progress', end);
  // The host the difficulty slider is rendered into, at the foot of the rail, as _includes/
  // stage.njk writes it: the setting every piece is dealt at, settable where it is a dependency
  // (issue #93). The stub persona below renders nothing into it and only records that it was
  // asked, because what is being read off here is what the stage does when the setting moves.
  make('div', 'stage-difficulty', side, 'stage-difficulty');
  // The way on, outside the inner the vanish transforms, and dim until the stage lights it.
  make('button', 'stage-next', stage, 'stage-next').disabled = true;

  const events = [];
  const modes = [];
  const drawn = { frames: 0 };
  // The one media query the stage keeps, and a scenario can turn it on part-way through: the stage
  // reads matchMedia once and keeps the list it was handed, so `matches` is a getter over a flag
  // here rather than a value, exactly as a browser's own list changes under a running page.
  const motion = { calm: false };
  // The persona's difficulty, as this page holds it: the middle of the dial until a scenario moves
  // it, `hosts` the elements the stage asked for the slider in, and `listeners` whatever the stage
  // registered through onDifficulty so a change reaches it however it was made.
  const tuned = { level: MIDDLE_DIFFICULTY.level, hosts: [], note: '', listeners: [], set: () => {} };
  const calmQuery = { get matches() { return motion.calm; }, addEventListener() {} };
  const win = {
    document: doc,
    innerHeight: 800,
    devicePixelRatio: 1,
    setTimeout: (fn, ms) => clock.set(fn, ms),
    clearTimeout: (id) => clock.clear(id),
    setInterval: (fn, ms) => clock.every(fn, ms),
    clearInterval: (id) => clock.clear(id),
    matchMedia: () => calmQuery,
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
      onSky: () => () => {},
      // The difficulty the persona keeps for the whole site, as js/stage.js reads it and hands it
      // to a piece on env.difficulty. A scenario moves it through `tuned.set(level)`, which is
      // what the real control does -- it writes the setting and tells everyone who follows it,
      // through onDifficulty, which is how a change made anywhere (the sheet, or the slider beside
      // the piece) reaches the stage -- and reads off what the stage did about it.
      difficulty: () => difficultyAt(tuned.level),
      onDifficulty(fn) {
        if (typeof fn === 'function') tuned.listeners.push(fn);
        return () => {};
      },
      tuner(host, options) {
        tuned.hosts.push(host && host.getAttribute ? host.getAttribute('id') || '' : '');
        tuned.note = (options && options.note) || '';
        tuned.set = (level) => {
          tuned.level = Math.max(1, Math.min(5, Math.round(Number(level)) || 3));
          const now = difficultyAt(tuned.level);
          for (const fn of tuned.listeners.slice()) fn(now, true);
          if (options && typeof options.onChange === 'function') options.onChange(now, true);
        };
        return () => {};
      }
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
  // Every animation frame the stage is given is counted, because a frame loop that is still
  // running is most of what "the piece is still live" means and there is nothing else to read it
  // off (issue #86). The id is the clock's own, so cancelAnimationFrame still reaches it.
  globalThis.requestAnimationFrame = (fn) => clock.set((now) => {
    drawn.frames += 1;
    fn(now);
  }, 16);
  globalThis.cancelAnimationFrame = (id) => clock.clear(id);
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    }
  };

  return { doc, win, stage, events, modes, frames: () => drawn.frames,
           calm: (on) => { motion.calm = !!on; }, tuned };
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
   drags it, 'use' presses it where it stands without moving it, 'leave' leaves it alone. `want`
   is what an answer knob is to be set to -- the module's own solution, or a wrong answer -- with
   `step` the knob as the piece declared it, which is where an option's value or an item's place
   is known; with no `want` the knob is worked any old way, as a helper is. */
async function setKnob(page, clock, knob, slider, want, step) {
  const kind = knob.dataset.kind;
  const fire = (node, type, extra) => node.dispatchEvent(Object.assign({ type }, extra || {}));
  const answer = want !== undefined && step;
  if (kind === 'choice') {
    const buttons = knob.querySelectorAll('button');
    const at = answer ? Math.max(0, step.options.findIndex((o) => o && o.value === want)) : 0;
    fire(buttons[at] || buttons[0], 'click');
    await clock.advance(120);
    return;
  }
  if (kind === 'toggle') {
    const button = knob.querySelector('button');
    fire(button, 'click');
    await clock.advance(120);
    if (answer && (button.getAttribute('aria-pressed') === 'true') !== !!want) {
      fire(button, 'click');
      await clock.advance(120);
    }
    return;
  }
  if (kind === 'range') {
    if (slider === 'leave') return;
    const input = knob.querySelector('input');
    if (answer) {
      input.value = String(want && typeof want === 'object' ? want.value : want);
      fire(input, 'input');
      fire(input, 'change');
    } else if (slider === 'move') {
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
  if (kind === 'number') {
    const input = knob.querySelector('input');
    if (answer) {
      input.value = String(want && typeof want === 'object' ? want.value : want);
      fire(input, 'change');
    } else {
      fire(knob.querySelectorAll('button')[1], 'click'); // one more, as a visitor would
    }
    await clock.advance(120);
    return;
  }
  if (kind === 'word') {
    const input = knob.querySelector('input');
    input.value = answer ? String(want) : 'A';
    fire(input, 'input');
    await clock.advance(120);
    return;
  }
  if (kind === 'order') {
    // The rows are rebuilt on every move, so the order is tracked here and each move is one press
    // of the up button on the row that has to rise: a selection sort, the way a visitor does it.
    const labels = () => knob.querySelectorAll('.knob-order-label').map((node) => node.textContent);
    const items = step ? step.items : [];
    const current = () => labels().map((label) => {
      const item = items.find((i) => String(i.label == null ? i.value : i.label) === label);
      return item ? item.value : label;
    });
    if (answer && Array.isArray(want)) {
      for (let t = 0; t < want.length; t++) {
        let at = current().indexOf(want[t]);
        for (let guard = 0; at > t && guard < 16; guard++) {
          const row = knob.querySelectorAll('.knob-order-item')[at];
          fire(row.querySelectorAll('button')[0], 'click');
          await clock.advance(60);
          at = current().indexOf(want[t]);
        }
      }
      if (current().every((v, i) => v === want[i]) && !isSet(knob)) {
        const keep = knob.querySelectorAll('button').find((b) => b.textContent === 'keep this order');
        if (keep) fire(keep, 'click');
      }
    } else {
      const rows = knob.querySelectorAll('.knob-order-item');
      const last = rows[rows.length - 1];
      if (last) fire(last.querySelectorAll('button')[0], 'click'); // the last one up a step
    }
    await clock.advance(120);
    return;
  }
  if (kind === 'pick') {
    const buttons = knob.querySelectorAll('.knob-pick button');
    const items = step ? step.items : [];
    if (answer && Array.isArray(want)) {
      for (const value of want) {
        const at = items.findIndex((i) => i && i.value === value);
        if (at >= 0 && buttons[at] && buttons[at].getAttribute('aria-pressed') !== 'true') {
          fire(buttons[at], 'click');
          await clock.advance(60);
        }
      }
    } else {
      const count = step && step.count ? Number(step.count) : 1;
      for (let i = 0; i < Math.max(1, count) && buttons[i]; i++) {
        fire(buttons[i], 'click');
        await clock.advance(60);
      }
    }
    await clock.advance(120);
    return;
  }
  if (kind === 'grid') {
    const cells = knob.querySelectorAll('.knob-cell');
    const states = step ? Math.max(2, Math.min(6, Number(step.states) || 2)) : 2;
    if (answer && Array.isArray(want)) {
      for (let i = 0; i < cells.length && i < want.length; i++) {
        const now = Number(cells[i].dataset.state) || 0;
        const presses = ((want[i] - now) % states + states) % states;
        for (let n = 0; n < presses; n++) {
          fire(cells[i], 'click');
          await clock.advance(40);
        }
      }
    } else if (cells[0]) {
      fire(cells[0], 'click');
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
    const box = canvas.getBoundingClientRect();
    const points = answer && want && Array.isArray(want.taps) ? want.taps : (answer && Array.isArray(want) ? want : null);
    if (points) {
      for (let i = 0; i < points.length && i < MAX_TAPS && !isSet(knob); i++) {
        fire(canvas, 'pointerdown', { clientX: box.left + Number(points[i].x) * box.width, clientY: box.top + Number(points[i].y) * box.height });
        await clock.advance(220);
      }
      return;
    }
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
async function playKnobs(page, clock, slider, answers) {
  const passes = knobsOn(page).length + 2;
  const a = answers || { values: {}, steps: {} };
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (const knob of knobsOn(page)) {
      if (isSet(knob) || isLocked(knob)) continue;
      const id = knob.dataset.id;
      await setKnob(page, clock, knob, slider, a.values[id], a.steps[id]);
      if (isSet(knob)) moved = true;
    }
    if (!moved) break;
  }
  // An optional knob -- a hint -- is one the check does not wait for, so it is not reported unset.
  return knobsOn(page).filter((knob) => !isSet(knob) && !(a.steps[knob.dataset.id] && a.steps[knob.dataset.id].optional === true)).map((knob) => knob.dataset.id);
}

/* The check, pressed, if the stage offers it. Reports whether it could be, and what the stage
   said; judges nothing. */
async function pressCheck(page, clock) {
  const button = page.doc.getElementById('stage-check');
  if (!button || button.disabled) return { pressed: false };
  button.dispatchEvent({ type: 'click' });
  await clock.advance(300);
  return { pressed: true };
}

// Whether `node` is inside `box`: the done mark laid over the scene is a mark over the content.
function within(node, box) {
  for (let at = node; at; at = at.parentNode) if (at === box) return true;
  return false;
}

function look(page) {
  const by = (id) => page.doc.getElementById(id);
  return {
    mode: page.stage.dataset.mode,
    verdict: page.stage.dataset.verdict || '',
    goal: by('stage-goal') && !by('stage-goal').hidden ? by('stage-goal-text').textContent : '',
    checkEnabled: !!(by('stage-check') && !by('stage-check').disabled),
    checkLabel: by('stage-check') ? by('stage-check').textContent : '',
    tries: by('stage-tries') && !by('stage-tries').hidden ? by('stage-tries').textContent : '',
    doneText: by('stage-done-text') ? by('stage-done-text').textContent : '',
    title: by('stage-title').textContent,
    status: by('stage-status').textContent,
    wanted: by('stage-wanted').hidden ? '' : by('stage-wanted').textContent,
    brief: by('stage-brief').textContent,
    world: by('stage-world').textContent,
    // `live` is whether every control on the knob is still enabled, which is what a finished piece
    // being still playable looks like from outside (issue #86). A knob with no control of its own
    // -- a wait, whose bar the piece fills -- is live vacuously.
    knobs: knobsOn(page).map((knob) => ({ id: knob.dataset.id, kind: knob.dataset.kind, set: isSet(knob),
                                          optional: knob.dataset.optional === 'true',
                                          live: knob.querySelectorAll('button, input').every((c) => !c.disabled) })),
    dots: by('stage-progress').querySelectorAll('.stage-dot').length,
    doneShown: !by('stage-done').hidden,
    doneOverScene: within(by('stage-done'), by('stage-scene')),
    nextLit: !by('stage-next').disabled,
    focused: focusedId(),
    sceneLabel: by('stage-canvas').getAttribute('aria-label'),
    aspect: by('stage-scene').css.get('--piece-aspect') || ''
  };
}

/* ---- the answer the piece knows ---------------------------------------------------------------- */

/* The same env js/stage.js makes for a piece, less the document -- the seeded source, the sky, the
   fallback colours, the configuration and the card -- so the module can be asked for the very piece
   the stage opened and its solution read off it. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function envFor(V, seed, world, stars, variant, card, difficulty) {
  const rnd = V.mulberry32(seed);
  return {
    seed,
    rnd,
    pick: (list) => list[Math.floor(rnd() * list.length)],
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
    hash,
    stars,
    points(w, h, pad) {
      const p = pad || 0;
      return stars.map((s) => ({ x: p + (s.x / 100) * (w - p * 2), y: p + (s.y / 100) * (h - p * 2), text: s.text }));
    },
    colors: { bg: '#0d1020', bg2: '#1c2a4e', accent: '#9fcbff', accent2: '#ffe7ab', fg: '#e6eaf5', muted: '#b7c0da' },
    mix: V.mix,
    alpha: V.alpha,
    reduced: false,
    world: { file: world.file, name: world.name, orientation: world.orientation },
    variant: variant || V.PLAIN,
    card: card || null,
    // The difficulty the stage will hand this piece (issue #93): the stub persona's, so the piece
    // the module is asked for is the very piece the stage opened. A card carries none, as in the
    // browser, which is why sparkOf() below is handed nothing.
    difficulty: difficulty || null,
    rite: V.rite(seed)
  };
}

// The card as the stage keeps it (cardOf there): the plain strings, and `of` untouched.
function cardOf(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const line = (value) => (typeof value === 'string' ? value : '');
  const out = {
    kind: line(spec.kind) || 'spark', overline: line(spec.overline), title: line(spec.title), quote: line(spec.quote),
    text: line(spec.text), mono: line(spec.mono), cite: line(spec.cite), aspect: line(spec.aspect), of: spec.of || null
  };
  return out.title || out.quote || out.text || out.mono ? out : null;
}

/* What the piece the stage opened for (file, seed) with these options knows: its solution and its
   knobs, as { values: { id: solution }, steps: { id: step } }, or empty if the module cannot be
   asked. Opened the way open() opens it: the configuration revived from the seed, the card the
   feed pressed or the one the configuration deals, the stub persona's sky. */
async function answersFor(stageDir, worlds, file, seed, options, difficulty) {
  const empty = { values: {}, steps: {}, piece: null };
  const world = worlds.find((w) => w.file === file);
  if (!world) return empty;
  try {
    const V = await import(pathToFileURL(path.join(stageDir, 'variant.js')).href);
    const mod = (await import(pathToFileURL(path.join(stageDir, 'modules', file.replace(/\.html$/, '') + '.js')).href)).default;
    if (!mod || typeof mod.piece !== 'function') return empty;
    const opts = options || {};
    const variant = V.revive(opts.variant, seed);
    const stars = STARS.map((star) => Object.assign({}, star));
    let card = cardOf(opts.card);
    if (!card && typeof mod.spark === 'function') {
      try {
        card = cardOf(mod.spark(envFor(V, seed, world, stars, variant, null)));
      } catch (e) {
        card = null;
      }
    }
    const piece = mod.piece(envFor(V, seed, world, stars, variant, card, difficulty || MIDDLE_DIFFICULTY));
    const steps = {};
    for (const step of piece.steps || []) if (step && step.id) steps[step.id] = step;
    const values = Object.assign({}, piece.solution || {});
    return { values, steps, piece };
  } catch (e) {
    return empty;
  }
}

/* The same, with every answer wrong: the piece harness's own idea of a wrong value. */
function wrongAnswers(answers) {
  const values = {};
  for (const id of Object.keys(answers.values)) {
    const step = answers.steps[id];
    values[id] = step ? wrongFor(step, answers.values[id]) : answers.values[id];
  }
  return { values, steps: answers.steps, piece: answers.piece };
}

/* ---- the scenarios ------------------------------------------------------------------------- */

async function load(stageDir, worlds, clock) {
  const page = makePage(worlds, clock);
  await import(pathToFileURL(path.join(stageDir, 'stage.js')).href);
  // The stage loads every module 1.5 seconds in, to learn which read the sky; let it.
  await clock.advance(2000);
  return page;
}

/* The way on, waited for and pressed -- which is the whole of how one piece is left for the next
   now (issue #78). The six seconds first: the stage used to depart on a linger of 1.2 of them, so a
   stage that moves on by itself is caught here rather than mistaken for a press that worked. Then
   what the ceremony left behind is read off -- whether the mark lit, and what has the keyboard --
   and the mark is pressed, the way a visitor presses it. Reports what it saw and judges none of it;
   a mark that never lit is not pressed and says so. */
async function pressOnward(page, clock, was) {
  const api = page.win.interestingStage;
  const button = page.doc.getElementById('stage-next');
  const elsewhere = () => {
    const now = api.current();
    return !!(now && was && (now.file !== was.file || now.seed !== was.seed));
  };
  await clock.advance(6000);
  const seen = { movedOnByItself: elsewhere(), lit: !button.disabled, focused: focusedId() };
  if (button.disabled) return Object.assign({ pressed: false, movedOn: seen.movedOnByItself }, seen);
  button.dispatchEvent({ type: 'click' });
  for (let i = 0; i < 100 && !elsewhere(); i++) await clock.advance(200);
  await clock.advance(700); // and the arrival settles, so the round ends on a piece that is live
  return Object.assign({ pressed: true, movedOn: elsewhere() }, seen);
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
    // Every round's piece is opened from its seed alone -- the first by open(), the rest by the
    // stub feed's deal, which carries no card -- so the stage configures each from the seed.
    const answers = await answersFor(stageDir, worlds, was.file, was.seed, {});
    const unset = await playKnobs(page, clock, 'move', answers);
    const offered = look(page);
    const check = await pressCheck(page, clock);
    const finished = look(page);
    const onward = await pressOnward(page, clock, was);
    report.push({
      playable: true,
      was,
      unset,
      checkOffered: offered.checkEnabled,
      checked: check.pressed,
      solved: finished.mode === 'done',
      tries: finished.tries,
      doneText: finished.doneText,
      modes: page.modes.slice(),
      wantedWhilePlaying: finished.wanted,
      litWhilePlaying: finished.nextLit,
      movedOnByItself: onward.movedOnByItself,
      litWhenFinished: onward.lit,
      focusedWhenFinished: onward.focused,
      pressed: onward.pressed,
      movedOn: onward.movedOn,
      now: api.current(),
      look: look(page)
    });
  }
  return { rounds: report, completes: page.events.filter((e) => e.type === 'stage:complete').length,
           opens: page.events.filter((e) => e.type === 'stage:open').length };
}

// The kinds of knob a visitor can work a second time: everything but the two the piece sets itself.
const RESETTABLE = ['choice', 'toggle', 'range', 'number', 'word', 'order', 'pick', 'grid', 'press', 'hold'];

/* A piece played to its finish, and then played on with. Done is not the End (issue #86): finishing
   reports completion and lights the way on, and takes nothing away. So this plays a piece out, sits
   on it for six seconds the way the rounds do, and then goes on using it -- a knob worked a second
   time, a tap on the scene -- reading off the stage at every step whether any of it still works.

   Nothing here judges; the readings are what the assertions are made from. `later` and
   `drawing` are a second apart with nobody touching anything, so a frame count that moved between
   them is the piece's own loop still drawing (the burst's frames are long spent by then). `afterKnob`
   and `afterTap` are the stage still carrying a visitor's gestures to a piece it has already
   finished. And `completes` says the ceremony played once for all of that: a finished piece being
   playable is not a piece that finishes over and over. */
async function afterDone(stageDir, worlds, deal, clock) {
  const page = await load(stageDir, worlds, clock);
  let dealt = 1;
  page.win.interestingFeed = {
    take: () => (dealt < deal.length ? deal[dealt++] : null),
    consume() {}
  };
  const api = page.win.interestingStage;
  const snap = () => Object.assign({
    frames: page.frames(),
    completes: page.events.filter((e) => e.type === 'stage:complete').length,
    opens: page.events.filter((e) => e.type === 'stage:open').length
  }, look(page));

  api.open(deal[0].file, deal[0].seed, { arriving: true });
  if (!(await waitForPiece(page, clock))) return { playable: false, world: '', seed: 0, look: look(page) };
  const was = api.current();
  page.events.length = 0;
  const answers = await answersFor(stageDir, worlds, was.file, was.seed, {});
  const unset = await playKnobs(page, clock, 'move', answers);
  const check = await pressCheck(page, clock);
  const out = { playable: true, world: was.file, seed: was.seed, unset, checked: check.pressed, atDone: snap() };

  // Six seconds of nobody doing anything, and then one more: the stage must not have packed up in
  // either of them, and the second is where the frames are counted.
  await clock.advance(6000);
  out.later = snap();
  await clock.advance(1000);
  out.drawing = snap();

  // A knob worked again, long after the piece was over. Which knob is the piece's to decide, so one
  // is looked for rather than assumed, and the scenario says when it found none to work.
  const again = knobsOn(page).find((knob) => RESETTABLE.indexOf(knob.dataset.kind) !== -1) || null;
  out.reworked = again ? again.dataset.id : '';
  out.reworkedKind = again ? again.dataset.kind : '';
  if (again) await setKnob(page, clock, again, 'move');
  await clock.advance(400);
  out.afterKnob = snap();

  // And the scene tapped, which is the other half of a toy: a piece with no tap() of its own hears
  // nothing, and the stage still has to carry the gesture as far as the piece.
  const canvas = page.doc.getElementById('stage-canvas');
  canvas.dispatchEvent({ type: 'pointerdown', clientX: 211, clientY: 133 });
  await clock.advance(400);
  out.afterTap = snap();

  // Nothing of the piece was torn down, and the way on is still the one thing that takes it away.
  out.running = clock.waiting;
  out.current = api.current();
  out.onward = await pressOnward(page, clock, was);
  return out;
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
  // Every other knob the way a visitor who knows the answer sets it; the slider as `how` says.
  const answers = await answersFor(stageDir, worlds, world, seed, {});
  for (const id of ranges) delete answers.values[id];
  const unset = await playKnobs(page, clock, how, answers);
  const offered = look(page);
  const check = await pressCheck(page, clock);
  const settled = look(page);
  await clock.advance(6000);
  return {
    playable: true,
    world,
    seed,
    ranges,
    unset,
    checkOffered: offered.checkEnabled,
    checked: check.pressed,
    // A verdict was given: the stage either solved the piece or said why not.
    judged: check.pressed && (settled.mode === 'done' || !!settled.tries),
    modes: page.modes.slice(),
    wanted: settled.wanted,
    finished: page.events.some((e) => e.type === 'stage:complete'),
    look: look(page)
  };
}

/* The knobs worked down until a hold is reachable: a hold is often behind a gate, so getting to one
   is playing the piece as far as it. Returns the hold's knob, or null if this piece has none a
   visitor can get to. Both the hold scenarios go through here. */
async function reachHold(page, clock, answers) {
  const a = answers || { values: {}, steps: {} };
  for (let pass = 0; pass < knobsOn(page).length + 2; pass++) {
    let moved = false;
    for (const knob of knobsOn(page)) {
      if (isSet(knob) || isLocked(knob)) continue;
      if (knob.dataset.kind === 'hold') return knob;
      await setKnob(page, clock, knob, 'move', a.values[knob.dataset.id], a.steps[knob.dataset.id]);
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
      const knob = await reachHold(page, clock, await answersFor(stageDir, worlds, file, at, {}));
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
    completes: page.events.filter((e) => e.type === 'stage:complete').length,
    checkEnabled: look(page).checkEnabled
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
  // Held on well past the fill. A finished piece stays on the stage until the way on is pressed,
  // so the knobs are there to be read whenever this looks.
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
  const knob = await reachHold(page, clock, await answersFor(stageDir, worlds, deal[0].file, deal[0].seed, {}));
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

/* ---- every press on the scene is answered --------------------------------------------------- */

const PRESS_AT = { clientX: 211, clientY: 133 }; // a point well inside the stub scene's 640x400 box

function marksOn(page) {
  return page.doc.getElementById('stage-scene').querySelectorAll('.stage-reject');
}

/* One press on the scene, and everything the stage did about it.

   The mark and the knobs are read the instant the press lands and not a tick later: the stage takes
   the mark away again a fifth of a second on, and anything a piece's own frame() does in between is
   the piece playing rather than the press. So what a press cost is the difference across the one
   synchronous gesture, and `gone` -- the mark not outstaying its welcome -- is what the clock is
   advanced for. Judgements are StageTest's and RealSiteTest's. */
async function pressScene(page, clock, where) {
  const canvas = page.doc.getElementById('stage-canvas');
  const scene = page.doc.getElementById('stage-scene');
  const before = marksOn(page).length;
  const finishes = () => page.events.filter((e) => e.type === 'stage:complete').length;
  const whichSet = () => look(page).knobs.filter((knob) => knob.set).map((knob) => knob.id);
  const was = { completes: finishes(), set: whichSet(), status: look(page).status };
  canvas.dispatchEvent(Object.assign({ type: 'pointerdown' }, where || PRESS_AT));
  const marks = marksOn(page);
  const mark = marks.length > before ? marks[marks.length - 1] : null;
  const seen = {
    answered: !!mark,
    // Where it was put, as the stage wrote it: a press is acknowledged at the point pressed, not
    // at the middle of the scene or in a corner of it.
    at: mark ? { left: mark.css.get('left') || '', top: mark.css.get('top') || '' } : null,
    still: !!(mark && mark.classList.contains('is-still')),
    inScene: !!(mark && within(mark, scene)),
    silent: !!(mark && mark.getAttribute('aria-hidden') === 'true' && mark.textContent === ''),
    set: whichSet(),
    setWas: was.set,
    finished: finishes() - was.completes
  };
  await clock.advance(400); // past the mark's own fifth of a second
  const now = look(page);
  return Object.assign(seen, {
    gone: marksOn(page).length === before,
    mode: now.mode,
    // The live line a frame or two later, which is where a piece that counts its taps says so.
    status: now.status,
    statusMoved: now.status !== was.status,
    dots: now.dots
  });
}

/* Press the scene where the press has nothing to reach, and read off whether the stage answered
   for the piece (issue #89). Unresponsiveness is uninteresting, and the stage used to be exactly
   that in four places: while a module loaded, while every tap knob was still locked, on a piece
   with no tap() of its own, and on a tap() that threw. The first three are pressed here. Which
   world has a locked tap knob, and which has no tap knob at all, is the seed's to decide, so each
   is looked for rather than assumed -- the way the slider and the hold are -- and the scenario
   says plainly when it found none rather than going quietly vacuous. */
async function pressAnswered(stageDir, worlds, deal, clock) {
  const nowhere = { file: MISSING_WORLD, name: 'nowhere', orientation: 'lost', mood: 'tender', what: 'No module lives here.' };
  const page = await load(stageDir, worlds.concat([nowhere]), clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  const tries = [deal[0].file].concat(worlds.map((world) => world.file));
  const out = { loading: null, locked: null, opened: null, noTapKnob: null, calm: null };

  // A module still loading: there is no piece on the stage at all, so nothing but the stage can
  // answer. open() is awaited by nobody here, which is what catches the stage in that state.
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  out.loadingMode = page.stage.dataset.mode;
  out.loading = await pressScene(page, clock);
  out.playable = await waitForPiece(page, clock);

  // A tap knob still locked behind another knob: the stage withholds the press from the piece
  // (tapsOpen()), so the stage is what has to answer it.
  for (const at of SEEDS) {
    for (const file of tries) {
      api.open(file, at, { arriving: true });
      if (!(await waitForPiece(page, clock))) continue;
      const knob = knobsOn(page).find((k) => k.dataset.kind === 'tap');
      if (!knob || !isLocked(knob)) continue;
      out.locked = Object.assign({ world: file, seed: at, knob: knob.dataset.id },
        await pressScene(page, clock));
      // And then the same press with the gate open, which is the piece's again: whatever the piece
      // makes of it, the stage adds nothing of its own on top of the piece's own answer.
      for (let pass = 0; pass < knobsOn(page).length + 2 && isLocked(knob); pass++) {
        let moved = false;
        for (const other of knobsOn(page)) {
          if (other === knob || isSet(other) || isLocked(other)) continue;
          await setKnob(page, clock, other, 'move');
          if (isSet(other)) moved = true;
        }
        if (!moved) break;
      }
      out.opened = Object.assign({ locked: isLocked(knob) }, await pressScene(page, clock));
      break;
    }
    if (out.locked) break;
  }

  // A piece with no tap knob at all. Whether its module writes a tap() anyway is the module's own
  // business and nothing out here can see it, so this reports what the stage did and judges none
  // of it: the pieces StageTest plays through here have no tap(), and a mark is the only answer
  // there is for them.
  for (const at of SEEDS) {
    for (const file of tries) {
      api.open(file, at, { arriving: true });
      if (!(await waitForPiece(page, clock))) continue;
      if (knobsOn(page).some((k) => k.dataset.kind === 'tap')) continue;
      out.noTapKnob = Object.assign({ world: file, seed: at }, await pressScene(page, clock));
      break;
    }
    if (out.noTapKnob) break;
  }

  // The same press with less motion asked for: the mark is held still rather than rippling open,
  // which is what the theme's crossfade and the ceremony's burst do with the same query. Read off
  // a press the stage is bound to answer, so what is being read is the motion and nothing else.
  page.calm(true);
  api.open(deal[0].file, deal[0].seed + 1, { arriving: true });
  out.calm = await pressScene(page, clock);
  page.calm(false);

  // And nothing of a press outlives the piece it landed on: a mark pressed out of a piece that is
  // taken away under it comes away with the piece, like every other part of it.
  api.open(deal[0].file, deal[0].seed + 2, { arriving: true });
  page.doc.getElementById('stage-canvas').dispatchEvent(Object.assign({ type: 'pointerdown' }, PRESS_AT));
  out.beforeClose = marksOn(page).length;
  api.open(MISSING_WORLD, 7, { push: false });
  out.afterClose = marksOn(page).length;
  await clock.advance(3000);
  out.waiting = clock.waiting;
  return out;
}

/* The card js/feed.js hands over, and the configuration it was wearing: the shape of what a pressed
   card carries to the stage (shown() and openFromCard() there, and variant.roll's seven dials). */
const PRESSED_CARD = {
  kind: 'spark',
  overline: 'one card of this world',
  title: 'the card that was pressed',
  quote: 'what the card was showing',
  text: 'the line under it',
  mono: '',
  cite: '',
  aspect: '4 / 3',
  of: { token: 'the card that was pressed' }
};
const PRESSED_VARIANT = { plain: false, trade: 0.86, lift: 0.62, wash: 0.31, density: 1.21, scale: 0.91, turn: 0.74, stretch: 1.14 };

/* A card pressed, and what the stage made of it. Every reading is the stage's own answer; StageTest
   and RealSiteTest make the assertions. */
async function carried(stageDir, worlds, deal, clock) {
  const nowhere = { file: MISSING_WORLD, name: 'nowhere', orientation: 'lost', mood: 'tender', what: 'No module lives here.' };
  const page = await load(stageDir, worlds.concat([nowhere]), clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  const world = worlds.find((w) => w.file === deal[0].file) || worlds[0];
  const card = JSON.parse(JSON.stringify(PRESSED_CARD));
  const out = { card, world: { file: world.file, name: world.name, what: world.what } };

  // open() writes the heading before it awaits the module, so this is what a visitor sees while
  // the world is still loading -- the moment the generic line used to be written.
  api.open(deal[0].file, deal[0].seed, { arriving: true, variant: PRESSED_VARIANT, card });
  out.loading = look(page);
  out.playable = await waitForPiece(page, clock);
  out.opened = look(page);

  // The same card on a world with no module: what the stage says when there is no piece to open.
  api.open(MISSING_WORLD, 97, { push: false, variant: PRESSED_VARIANT, card });
  out.missingLoading = look(page);
  await clock.advance(3000);
  out.missing = look(page);

  // And a piece nobody pressed: the stage has the seed and nothing else, so it configures the
  // piece from that and derives the card the configuration would have dealt.
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  out.barePlayable = await waitForPiece(page, clock);
  out.bare = look(page);
  return out;
}

/* A wrong answer checked, then the right one: the puzzle half of the stage. Every reading is the
   stage's own; StageTest and RealSiteTest make the assertions. */
async function wrongThenRight(stageDir, worlds, deal, clock) {
  const page = await load(stageDir, worlds, clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  if (!(await waitForPiece(page, clock))) return { playable: false, world: '', seed: 0, look: look(page) };
  const was = api.current();
  page.events.length = 0;
  const answers = await answersFor(stageDir, worlds, was.file, was.seed, {});
  const out = { playable: true, world: was.file, seed: was.seed, answers: Object.keys(answers.values), opened: look(page) };
  // Every answer wrong, and the check pressed.
  const unset = await playKnobs(page, clock, 'move', wrongAnswers(answers));
  out.unset = unset;
  out.beforeCheck = look(page);
  out.wrongChecked = (await pressCheck(page, clock)).pressed;
  out.afterWrong = Object.assign({
    completes: page.events.filter((e) => e.type === 'stage:complete').length,
    checks: page.events.filter((e) => e.type === 'stage:check').map((e) => e.detail)
  }, look(page));
  await clock.advance(2000);
  out.laterWrong = Object.assign({ completes: page.events.filter((e) => e.type === 'stage:complete').length }, look(page));
  // Then the right answer on the same knobs -- they are still live -- and the check again.
  for (const knob of knobsOn(page)) {
    const id = knob.dataset.id;
    if (answers.values[id] === undefined) continue;
    await setKnob(page, clock, knob, 'move', answers.values[id], answers.steps[id]);
  }
  out.rightChecked = (await pressCheck(page, clock)).pressed;
  out.afterRight = Object.assign({
    completes: page.events.filter((e) => e.type === 'stage:complete').length,
    checks: page.events.filter((e) => e.type === 'stage:check').map((e) => e.detail)
  }, look(page));
  out.onward = await pressOnward(page, clock, was);
  return out;
}

/* The difficulty, settable where it is a dependency (issue #93). Every piece this stage deals is
   made at the persona's difficulty, so the stage asks the persona for the one slider in the host
   _includes/stage.njk leaves at the foot of the rail, and moving it has to deal the piece again --
   the same world and the same seed, because the subject a visitor pressed is still the subject and
   only how hard it is asked has moved. Reports where the slider was asked for, what the piece was
   before and after, and whether the piece the stage then opened is the piece the module makes at
   the new setting; no judgements, as everywhere else here. */
async function difficultyMoved(stageDir, worlds, deal, clock) {
  const page = await load(stageDir, worlds, clock);
  page.win.interestingFeed = { take: () => null, consume() {} };
  const api = page.win.interestingStage;
  const out = { hosts: page.tuned.hosts.slice(), note: page.tuned.note, level: page.tuned.level };
  api.open(deal[0].file, deal[0].seed, { arriving: true });
  if (!(await waitForPiece(page, clock))) return Object.assign(out, { playable: false });
  out.playable = true;
  const was = api.current();
  out.was = was;
  out.before = look(page);
  // The piece as it opened, against the piece the module makes at the setting that stood: the
  // stage has to be handing it the persona's difficulty and not a guess of its own.
  const atFirst = await answersFor(stageDir, worlds, was.file, was.seed, {}, difficultyAt(out.level));
  out.firstMatchesModule = out.before.knobs.map((k) => k.id).join(',')
    === (atFirst.piece ? atFirst.piece.steps.map((s) => s.id).join(',') : '');
  page.events.length = 0;
  // The slider, moved to the fiercest setting the way the persona's own control moves it.
  page.tuned.set(5);
  out.moved = page.tuned.level;
  const dealt = await waitForPiece(page, clock);
  out.dealtAgain = dealt;
  out.now = api.current();
  out.after = look(page);
  out.opens = page.events.filter((e) => e.type === 'stage:open').length;
  const atFierce = await answersFor(stageDir, worlds, was.file, was.seed, {}, difficultyAt(5));
  out.afterMatchesModule = out.after.knobs.map((k) => k.id).join(',')
    === (atFierce.piece ? atFierce.piece.steps.map((s) => s.id).join(',') : '');
  // And the piece dealt at the new setting is still a piece that plays to its end.
  out.unset = await playKnobs(page, clock, 'move', atFierce);
  out.checkOffered = look(page).checkEnabled;
  out.checked = (await pressCheck(page, clock)).pressed;
  out.solved = look(page).mode === 'done';
  return out;
}

async function runScenario(name, stageDir, worlds, deal) {
  const clock = makeClock();
  if (name === 'rounds') return rounds(stageDir, worlds, deal, clock);
  if (name === 'wrongThenRight') return wrongThenRight(stageDir, worlds, deal, clock);
  if (name === 'afterDone') return afterDone(stageDir, worlds, deal, clock);
  if (name === 'sliderUsed') return slider(stageDir, worlds, deal, clock, 'use');
  if (name === 'sliderUntouched') return slider(stageDir, worlds, deal, clock, 'leave');
  if (name === 'holdFilled') return holdFilled(stageDir, worlds, deal, clock);
  if (name === 'teardown') return teardown(stageDir, worlds, deal, clock);
  if (name === 'carried') return carried(stageDir, worlds, deal, clock);
  if (name === 'pressAnswered') return pressAnswered(stageDir, worlds, deal, clock);
  if (name === 'difficultyMoved') return difficultyMoved(stageDir, worlds, deal, clock);
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
      workerData: { harness: 'stage', scenario, stageDir, worlds, deal },
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

if (!isMainThread && workerData && workerData.harness === 'stage') {
  workerMain().catch((err) => parentPort.postMessage({ ok: false, error: String((err && err.stack) || err) }));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The exit code is set rather than exited on: process.exit() can cut a report off mid-pipe
  // before stdout has drained, and the workers are already terminated, so the loop ends on its own.
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }, (err) => {
    process.stderr.write(String((err && err.stack) || err) + '\n');
    process.exitCode = 2;
  });
}
