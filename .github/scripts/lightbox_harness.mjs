#!/usr/bin/env node
/**
 * Run site/js/site.js and site/js/persona.js together against a stub browser and report what the
 * one shared lightbox did, as JSON on stdout.
 *
 * Issue #70: "the lightbox effect for the main nav (top left logo) is amazing!! the lightbox effect
 * for the persona should be identical; they should share a common lightbox component". There is one
 * component now -- window.interestingSite.lightbox() in js/site.js, painted by
 * _sass/_lightbox.scss -- and three things open through it: the constellation the sparkles logo
 * branches out, the persona sheet the avatar opens, and the shared "are you sure you want to
 * ______?" modal every destructive control is guarded by.
 *
 * "Identical" is four things a stub browser can watch, and all four are what nav_harness.mjs
 * already watches for the nav alone: the veil raised, every other child of <body> put aside,
 * <html data-lightbox> named, and the page's requestAnimationFrame loop held. So this loads both
 * files into one document -- which is how a page loads them -- and drives each caller in turn,
 * including the one case that only exists because they are shared: the question asked from inside
 * the sheet, where one lightbox opens over another and has to hand the first one back.
 *
 *   node lightbox_harness.mjs path/to/site/js/site.js path/to/site/js/persona.js
 *
 * LightboxTest in test_make_interesting.py makes every assertion below; the harness only observes.
 * The stub is deliberately the same shape as nav_harness.mjs's -- a tree that can be found by
 * simple selectors, attributes, events that bubble, and a frame loop that can be counted -- with
 * the handful of things the persona also touches: a canvas that draws nothing, a box for the sky,
 * and the timers the sheet uses.
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const [siteSource, personaSource] = process.argv.slice(2, 4)
  .map((path) => readFileSync(path, "utf8"));

/* ---- the stub browser ---------------------------------------------------------------------- */

/** One compound selector: a tag, #id, .class, [attr], [attr="value"] and :not([attr]). Anything
 *  with a combinator in it matches nothing, and a pseudo-class is ignored -- which is as much CSS
 *  as the two files ask of a document they are only ever reading back. */
function matcher(selector) {
  const part = selector.trim();
  if (!part || /[>+~\s]/.test(part)) return () => false;
  const tag = (part.match(/^[a-z][a-z0-9]*/i) || [""])[0].toUpperCase();
  const id = (part.match(/#([\w-]+)/) || [])[1];
  const classes = (part.match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
  const attrs = [...part.matchAll(/(?<!:not\()\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
  const without = [...part.matchAll(/:not\(\[([\w-]+)\]\)/g)].map((m) => m[1]);
  return (el) => {
    if (tag && el.tagName !== tag) return false;
    if (id && el.getAttribute("id") !== id) return false;
    if (classes.some((c) => !el.classList.contains(c))) return false;
    if (without.some((name) => el.hasAttribute(name))) return false;
    return attrs.every(([, name, value]) =>
      el.hasAttribute(name) && (value === undefined || el.getAttribute(name) === value));
  };
}

function matchers(selector) {
  return selector.split(",").map(matcher);
}

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.textContent = "";
    this.clicks = 0;
    this.focused = 0;
    this.width = 0;
    this.height = 0;
    const el = this;
    this.classList = {
      contains: (name) => (el.attributes.class || "").split(/\s+/).includes(name),
      add(name) {
        if (!this.contains(name)) el.attributes.class = ((el.attributes.class || "") + " " + name).trim();
      },
      remove(name) {
        el.attributes.class = (el.attributes.class || "")
          .split(/\s+/).filter((part) => part && part !== name).join(" ");
      },
      toggle(name, on) {
        if (on) this.add(name);
        else this.remove(name);
      },
    };
    this.properties = {};
    this.style = {
      setProperty: (name, value) => {
        el.properties[name] = String(value);
      },
      removeProperty: (name) => {
        delete el.properties[name];
      },
    };
  }

  get className() {
    return this.attributes.class || "";
  }

  set className(value) {
    this.attributes.class = String(value);
  }

  get hidden() {
    return this.hasAttribute("hidden");
  }

  set hidden(value) {
    if (value) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }

  /* <details open> and <dialog open> both reflect; changing it fires `toggle`, which is what the
     nav leans on. The two dialogs here are opened by attribute instead, because this stub has no
     showModal() -- which is itself worth exercising: it is the path a browser without one takes. */
  get open() {
    return this.hasAttribute("open");
  }

  set open(value) {
    if (!!value === this.open) return;
    if (value) this.setAttribute("open", "");
    else this.removeAttribute("open");
    dispatch(this, { type: "toggle" });
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height,
             right: this.width, bottom: this.height };
  }

  /* A canvas that measures but never paints: getContext returns null, which every drawing path in
     js/persona.js already has to answer for. */
  getContext() {
    return null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const at = this.parentNode.children.indexOf(this);
    if (at !== -1) this.parentNode.children.splice(at, 1);
    this.parentNode = null;
  }

  descendants() {
    const all = [];
    for (const child of this.children) all.push(child, ...child.descendants());
    return all;
  }

  querySelectorAll(selector) {
    const tests = matchers(selector);
    return this.descendants().filter((el) => tests.some((test) => test(el)));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }

  focus() {
    this.focused += 1;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  click(event = {}) {
    this.clicks += 1;
    dispatch(this, Object.assign({ type: "click", clientX: 0, clientY: 0 }, event));
  }
}

/** An event, walking up from its target the way a real one bubbles. */
function dispatch(target, event) {
  const detail = Object.assign({ target, defaultPrevented: false }, event);
  detail.preventDefault = () => {
    detail.defaultPrevented = true;
  };
  detail.stopPropagation = () => {
    detail.stopped = true;
  };
  for (let node = target; node; node = node.parentNode) {
    for (const handler of (node.listeners[detail.type] || []).slice()) handler.call(node, detail);
    if (detail.stopped) break;
  }
  return detail;
}

function make(tag, attributes = {}, { width = 0, height = 0 } = {}) {
  const el = new Element(tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.width = width;
  el.height = height;
  return el;
}

const CHIP = { width: 150, height: 44 }; // the min-height every control carries in the Sass

/** The page the shared shell writes, as much of it as the two files read: the skip link, the one
 *  veil, the logo and its constellation, the persona avatar, the page's content and feed, and the
 *  persona sheet written last. The same tree _includes/layout.njk writes; LightboxTest checks that
 *  the shell still writes these ids. */
function makeDocument() {
  const html = make("html", { "data-page": "quiet-room.html" });
  const head = make("head");
  const body = make("body");
  html.appendChild(head);
  html.appendChild(body);

  body.appendChild(make("a", { class: "skip-link", href: "#main-content" }, CHIP));
  body.appendChild(make("div", { class: "lightbox-veil", id: "lightbox-veil", hidden: "" }));

  // The logo and its constellation.
  const nav = make("details", { class: "sparknav", id: "sparknav" });
  const logo = make("summary", { class: "sparknav-logo", id: "sparknav-logo" },
                    { width: 44, height: 44 });
  nav.appendChild(logo);
  const sky = make("nav", { class: "sparknav-sky", "aria-label": "Site" });
  const near = make("ul", { class: "sparknav-orbit sparknav-near", id: "sparknav-near" });
  const far = make("ul", { class: "sparknav-orbit sparknav-far", id: "sparknav-far" });
  const option = (orbit, { id, tag = "a", nodeId, label, labelId, hidden } = {}) => {
    const li = make("li", Object.assign({ class: "sparknav-option" }, id ? { id } : {}));
    if (hidden) li.hidden = true;
    li.appendChild(make("span", { class: "sparknav-ray", "aria-hidden": "true" }));
    const node = make(tag, Object.assign({ class: "sparknav-node" }, nodeId ? { id: nodeId } : {},
      tag === "a" ? { href: "index.html" } : { type: "button" }), CHIP);
    const text = make("span", Object.assign({ class: "sparknav-label" },
                                            labelId ? { id: labelId } : {}));
    text.textContent = label || "";
    node.appendChild(text);
    li.appendChild(node);
    orbit.appendChild(li);
    return li;
  };
  option(near, { label: "the threshold" });
  option(near, { label: "the mood atlas" });
  option(near, { id: "sparknav-reading", nodeId: "sparknav-reading-go",
                 labelId: "sparknav-reading-label", label: "your world", hidden: true });
  option(far, { id: "sparknav-participate", tag: "button", nodeId: "sparknav-participate-open",
                label: "change this site", hidden: true });
  option(far, { id: "sparknav-cookies", tag: "button", nodeId: "sparknav-cookies-open",
                label: "cookies", hidden: true });
  option(far, { id: "sparknav-state", tag: "button", nodeId: "sparknav-state-open",
                labelId: "sparknav-state-label", label: "state", hidden: true });
  option(far, { label: "privacy" });
  sky.appendChild(near);
  sky.appendChild(far);
  nav.appendChild(sky);
  body.appendChild(nav);

  // The persona avatar, floating opposite the logo.
  const card = make("div", { class: "persona", id: "persona", "data-state": "empty",
                             "data-sky": "none", "data-reading": "none", "data-asking": "false" });
  card.appendChild(make("p", { class: "persona-text visually-hidden", id: "persona-text" }));
  const avatar = make("button", { type: "button", class: "persona-avatar", id: "persona-open",
                                  "aria-haspopup": "dialog", "aria-controls": "persona-sheet",
                                  hidden: "" }, CHIP);
  const portrait = make("span", { class: "persona-portrait", "aria-hidden": "true" });
  portrait.appendChild(make("canvas", { id: "persona-portrait", width: "40", height: "40" }));
  avatar.appendChild(portrait);
  avatar.appendChild(make("span", { class: "persona-label" }));
  card.appendChild(avatar);
  body.appendChild(card);

  body.appendChild(make("div", { id: "main-content", tabindex: "-1" }));
  body.appendChild(make("div", { class: "page" }));

  // The persona sheet, written last so its headings follow the page's own.
  const sheet = make("dialog", { class: "persona-sheet", id: "persona-sheet",
                                 "aria-labelledby": "persona-sheet-title" });
  const headRow = make("div", { class: "persona-sheet-head" });
  headRow.appendChild(make("h2", { class: "persona-sheet-title", id: "persona-sheet-title" }));
  headRow.appendChild(make("button", { type: "button", class: "persona-close btn-text",
                                       id: "persona-close" }, CHIP));
  sheet.appendChild(headRow);
  const skySection = make("section", { class: "persona-section" });
  const field = make("div", { class: "persona-sky", id: "persona-sky" },
                     { width: 400, height: 200 });
  field.appendChild(make("canvas", { class: "persona-sky-canvas", "aria-hidden": "true" }));
  skySection.appendChild(field);
  const controls = make("div", { class: "controls" });
  for (const [id, cls] of [["persona-drop", ""], ["persona-seed", ""],
                           ["persona-remove", ""], ["persona-clear", "warning"]]) {
    const button = make("button", Object.assign({ id, type: "button" }, cls ? { class: cls } : {}),
                        CHIP);
    button.textContent = id.replace("persona-", "");
    controls.appendChild(button);
  }
  skySection.appendChild(controls);
  skySection.appendChild(make("p", { class: "panel-status", id: "persona-sky-status",
                                     "aria-live": "polite" }));
  sheet.appendChild(skySection);
  const readingSection = make("section", { class: "persona-section" });
  readingSection.appendChild(make("p", { class: "panel-status", id: "persona-reading" }));
  readingSection.appendChild(make("button", { id: "persona-ask", type: "button" }, CHIP));
  readingSection.appendChild(make("button", { id: "persona-forget", type: "button",
                                              class: "warning", hidden: "" }, CHIP));
  readingSection.appendChild(make("a", { class: "action", id: "persona-reading-go",
                                         href: "moods.html", hidden: "" }, CHIP));
  readingSection.appendChild(make("div", { class: "persona-probe", id: "persona-sheet-probe",
                                           hidden: "" }));
  sheet.appendChild(readingSection);
  body.appendChild(sheet);

  const document_ = {
    documentElement: html,
    head,
    body,
    // "loading", so the two files register on DOMContentLoaded and ready() below fires it once
    // both have been evaluated -- which is the order a browser gives them, and the order that
    // matters: js/persona.js builds its sheet on DOMContentLoaded and asks js/site.js for a
    // lightbox there, and window.interestingSite exists by then because it is assigned while the
    // <head> is read.
    readyState: "loading",
    activeElement: null,
    listeners: {},
    createElement: (tag) => {
      const el = make(tag);
      el.ownerDocument = document_;
      return el;
    },
    getElementById: (id) => html.descendants().find((el) => el.getAttribute("id") === id) || null,
    querySelector: (selector) => html.querySelector(selector),
    querySelectorAll: (selector) => html.querySelectorAll(selector),
    contains: (node) => node === html || html.descendants().includes(node),
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
  };
  for (const el of [html, ...html.descendants()]) el.ownerDocument = document_;
  return document_;
}

/** Both files in one context, in the order _includes/layout.njk loads them: the persona first,
 *  because js/site.js reads its sky, and the two of them before anything presses anything. */
function load({ stars = [], kept = [] } = {}) {
  const document_ = makeDocument();
  const frames = { ran: 0 };
  const observers = [];
  const timers = [];
  let sky = stars.slice();
  const window_ = {
    document: document_,
    innerWidth: 1280,
    innerHeight: 900,
    devicePixelRatio: 1,
    listeners: {},
    interestingState: {
      keys: () => kept.slice(),
      read: () => ({ status: "ok", value: sky.slice() }),
      get: () => sky.slice(),
      set: (key, value) => {
        sky = value.slice();
        return true;
      },
      remove: () => {
        sky = [];
        return true;
      },
      persistent: true,
    },
    performance: { now: () => 1000 },
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
    dispatchEvent() {
      return true;
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    clearInterval() {},
    requestAnimationFrame(fn) {
      frames.ran += 1;
      if (typeof fn === "function") fn(1000);
      return frames.ran;
    },
    cancelAnimationFrame() {},
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.stopped = false;
        observers.push(this);
      }

      observe(target) {
        this.watching = target;
      }

      disconnect() {
        this.stopped = true;
      }
    },
  };
  const globals = {
    window: window_,
    document: document_,
    setTimeout: window_.setTimeout,
    clearTimeout: window_.clearTimeout,
    performance: window_.performance,
    requestAnimationFrame: window_.requestAnimationFrame,
    MutationObserver: window_.MutationObserver,
  };
  const context = vm.createContext(globals);
  // The persona before the shared helpers, as the shell loads them: js/site.js reads the sky.
  vm.runInContext(personaSource, context);
  vm.runInContext(siteSource, context);
  ready(document_);
  return { window: window_, document: document_, frames, observers, timers };
}

/** The document finished parsing: both files build their halves of the shell here. */
function ready(document_) {
  document_.readyState = "complete";
  for (const handler of (document_.listeners.DOMContentLoaded || []).slice()) {
    handler({ type: "DOMContentLoaded" });
  }
}

/* ---- driving it --------------------------------------------------------------------------- */

function id(context, name) {
  return context.document.getElementById(name);
}

/** A frame the page asks for now: 1 if it ran, 0 if the lightbox held it. Counted through
 *  window.requestAnimationFrame, which is the property the component replaces. */
function askForAFrame(context) {
  const ran = [];
  context.window.requestAnimationFrame((now) => ran.push(now));
  return ran.length;
}

/** What the one lightbox has done to the page: the veil, the name, and every child of <body> by
 *  whether it was put behind or left in front. */
function look(context) {
  const html = context.document.documentElement;
  const veil = id(context, "lightbox-veil");
  const body = {};
  for (const child of context.document.body.children) {
    // By id where there is one, and by first class otherwise -- the shared modal is script-built
    // and has no id, and its class changes while it is up in a browser with no showModal().
    body[child.getAttribute("id") || child.className.split(/\s+/)[0]] = {
      inert: child.hasAttribute("inert"),
      ariaHidden: child.getAttribute("aria-hidden"),
      marked: child.hasAttribute("data-lightbox-aside"),
      front: child.hasAttribute("data-lightbox-front"),
    };
  }
  return {
    name: html.getAttribute("data-lightbox"),
    veil: !veil.hidden,
    veilId: veil.getAttribute("id"),
    body,
  };
}

function openTheLogo(context, open) {
  id(context, "sparknav").open = open;
}

function openTheSheet(context) {
  id(context, "persona-open").click();
}

const STARS = [{ x: 30, y: 40, text: "a door left ajar" }, { x: 60, y: 55, text: "the long way home" }];

const scenarios = {
  /* A page at rest: nothing is raised, the veil is down, and nothing of the body is put aside --
     the lightbox is a component the shell carries, not a state it starts in. */
  atRest() {
    const context = load({ stars: STARS });
    return { look: look(context), frameRan: askForAFrame(context) };
  },

  /* The sparkles logo, which is the lightbox the issue calls amazing: the veil up, everything else
     on the page put behind it, the constellation left in front, and the page's frame loop held. */
  whenTheLogoOpens() {
    const context = load({ stars: STARS, kept: ["constellation"] });
    openTheLogo(context, true);
    const open = { look: look(context), frameRan: askForAFrame(context) };
    openTheLogo(context, false);
    return { open, closed: { look: look(context), frameRan: askForAFrame(context) } };
  },

  /* The persona sheet, which issue #70 says should be identical -- and is, because it is the same
     component: the same veil element, the same put-aside page (the logo among it now), the same
     held frame loop. Only the name on <html data-lightbox> says which one is up. */
  whenTheSheetOpens() {
    const context = load({ stars: STARS });
    openTheSheet(context);
    const open = {
      look: look(context),
      frameRan: askForAFrame(context),
      sheetOpen: id(context, "persona-sheet").open,
    };
    id(context, "persona-close").click();
    return {
      open,
      closed: { look: look(context), frameRan: askForAFrame(context),
                sheetOpen: id(context, "persona-sheet").open },
    };
  },

  /* The two of them side by side, which is the whole of the issue: whatever a visitor presses, the
     page goes under the same veil, the same way. */
  theSameLightboxEitherWay() {
    const navSide = load({ stars: STARS });
    openTheLogo(navSide, true);
    const personaSide = load({ stars: STARS });
    openTheSheet(personaSide);
    const strip = (seen) => ({
      veil: seen.veil,
      veilId: seen.veilId,
      behind: Object.entries(seen.body)
        .filter(([, state]) => state.marked).map(([name]) => name).sort(),
      front: Object.entries(seen.body)
        .filter(([, state]) => state.front).map(([name]) => name),
    });
    return { nav: strip(look(navSide)), persona: strip(look(personaSide)) };
  },

  /* The shared question, asked from inside the sheet: one lightbox over another. The veil never
     drops, the frame loop stays held, the sheet goes behind while the question is up, and the
     question handing back leaves the sheet exactly as it was. */
  whenTheQuestionIsAskedOverTheSheet() {
    const context = load({ stars: STARS });
    openTheSheet(context);
    const sheetUp = look(context);
    id(context, "persona-seed").click(); // a placed sky, so it asks before it seeds
    const asked = { look: look(context), frameRan: askForAFrame(context),
                    question: context.document.querySelector(".are-you-sure-title").textContent };
    context.document.querySelector(".are-you-sure-no").click(); // "cancel", which means no
    const answered = { look: look(context), frameRan: askForAFrame(context),
                       status: id(context, "persona-sky-status").textContent };
    id(context, "persona-close").click();
    return { sheetUp, asked, answered, closed: look(context) };
  },

  /* The same question asked from a page's own control, where it is the only lightbox up: the veil
     is still the veil, and answering gives the whole page back. */
  whenTheQuestionIsAskedFromAPage() {
    const context = load({ stars: STARS });
    const opener = id(context, "main-content");
    let said = null;
    context.window.interestingSite.areYouSure({
      what: "clear your omen archive",
      opener,
      onConfirm: () => {
        said = "yes";
      },
      onCancel: () => {
        said = "no";
      },
    });
    const asked = { look: look(context), frameRan: askForAFrame(context) };
    context.document.querySelector(".are-you-sure-go").click();
    return {
      asked,
      said,
      answered: { look: look(context), frameRan: askForAFrame(context) },
      // The focus comes back to the control that asked, which was inert a moment ago.
      focused: opener.focused,
    };
  },

  /* A press on the veil is a press on the page behind it, and the component routes it to whatever
     is on top -- the one thing that knows how to put itself away. */
  whenTheVeilIsPressed() {
    const navSide = load({ stars: STARS });
    openTheLogo(navSide, true);
    id(navSide, "lightbox-veil").click();
    const personaSide = load({ stars: STARS });
    openTheSheet(personaSide);
    id(personaSide, "lightbox-veil").click();
    return {
      nav: { open: id(navSide, "sparknav").open, look: look(navSide) },
      persona: { open: id(personaSide, "persona-sheet").open, look: look(personaSide) },
    };
  },

  /* Something drawn while a lightbox is up belongs behind it: each of the three affordances the
     constellation adopts arrives from a deferred script, and one may arrive while the sheet is
     open, where the nav is not watching anything. */
  whenSomethingArrivesLate() {
    const context = load({ stars: STARS });
    openTheSheet(context);
    const late = make("button", { class: "site-consent-link" }, CHIP);
    context.document.body.appendChild(late);
    late.ownerDocument = context.document;
    for (const observer of context.observers) {
      if (!observer.stopped) observer.callback([], observer);
    }
    return { inert: late.hasAttribute("inert"), ariaHidden: late.getAttribute("aria-hidden"),
             look: look(context) };
  },

  /* A js/site.js that offers the destructive component but no lightbox -- an older copy, or one a
     run has half rewritten -- still gets its sheet opened: a sheet with no veil behind it is still
     a sheet, and the persona does not go down with the thing it was only borrowing a veil from. */
  withoutTheSharedComponent() {
    const document_ = makeDocument();
    const window_ = {
      document: document_,
      innerWidth: 1280,
      innerHeight: 900,
      devicePixelRatio: 1,
      listeners: {},
      interestingState: { keys: () => [], read: () => ({ status: "ok", value: STARS.slice() }),
                          get: () => STARS.slice(), set: () => true, remove: () => true,
                          persistent: true },
      interestingSite: { destructive: () => () => {}, areYouSure: () => {} },
      addEventListener() {},
      dispatchEvent() {
        return true;
      },
      setTimeout: () => 0,
      clearTimeout() {},
      requestAnimationFrame: (fn) => {
        if (typeof fn === "function") fn(1000);
        return 1;
      },
    };
    vm.runInNewContext(personaSource, { window: window_, document: document_,
                                        setTimeout: window_.setTimeout });
    ready(document_);
    document_.getElementById("persona-open").click();
    const sheet = document_.getElementById("persona-sheet");
    const opened = sheet.open;
    document_.getElementById("persona-close").click();
    return { opened, closed: !sheet.open,
             veil: !document_.getElementById("lightbox-veil").hidden,
             lightbox: document_.documentElement.getAttribute("data-lightbox") };
  },
};

const results = {};
for (const [name, scenario] of Object.entries(scenarios)) {
  try {
    results[name] = { ok: true, result: scenario() };
  } catch (err) {
    results[name] = { ok: false, error: String((err && err.stack) || err) };
  }
}
process.stdout.write(JSON.stringify(results, null, 1));
