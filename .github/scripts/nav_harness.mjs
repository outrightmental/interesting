#!/usr/bin/env node
/**
 * Run site/js/site.js against a stub browser and report what the main nav did, as JSON on stdout.
 *
 * The nav is the whole of this site's navigation now (issue #54): the sparkles logo in the upper
 * left, the lightbox it opens, and the constellation of options it branches out -- including the
 * two corner affordances it adopts from js/analytics.js and js/state.js, which are fixed files
 * the shell may hide and press but never edit. All of that is behaviour rather than markup, so it
 * is worth testing rather than only reading, the way the local-state store and the "steer the
 * site" button beside it are.
 *
 *   node nav_harness.mjs path/to/site/js/site.js
 *
 * The stub is the handful of DOM the nav touches: a tree of elements that can be found by simple
 * selectors, attributes, a style object that remembers custom properties, events that bubble, and
 * the two sizes a layout needs (every chip is 44px tall, as the stylesheet's min-height says). It
 * builds the same element tree _includes/layout.njk writes; NavTest in test_make_interesting.py
 * checks that the shell still writes those ids, and makes every assertion below. The harness only
 * observes.
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(process.argv[2], "utf8");

/* ---- the stub browser ---------------------------------------------------------------------- */

/** One compound selector, as much of CSS as the nav asks for: a tag, #id, .class, [attr],
 *  [attr="value"] and :not([attr]). Anything with a combinator in it matches nothing, which is
 *  what the two selectors outside the nav (a world's stage, the unlock box's first control) want
 *  from a stub that is not laying anything out. */
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
    this.writes = []; // every attribute write this element has seen, in order
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
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

  get firstElementChild() {
    return this.children[0] || null;
  }

  /* A link's href reflects its attribute, as it does in a browser (without the resolving to an
     absolute URL, which nothing here looks at). */
  get href() {
    return this.getAttribute("href");
  }

  set href(value) {
    this.setAttribute("href", value);
  }

  /* <details open> reflects too, and changing it fires `toggle` -- in a browser as a queued task,
     and here at once, which is the one way this stub is tidier than the real thing. */
  get open() {
    return this.hasAttribute("open");
  }

  set open(value) {
    if (!!value === this.open) return;
    if (value) this.setAttribute("open", "");
    else this.removeAttribute("open");
    dispatch(this, { type: "toggle" });
  }

  /* A box only where the page would have one: nothing hidden is laid out, and nothing inside
     something hidden is either, which is how the nav tells a shown option from a put-away one. */
  get offsetHeight() {
    return this.laidOut() ? this.height : 0;
  }

  get offsetWidth() {
    return this.laidOut() ? this.width : 0;
  }

  laidOut() {
    for (let node = this; node; node = node.parentNode) if (node.hidden) return false;
    return true;
  }

  /* Every write is kept, in order, with null for a removal: it is the only way to see what did
     *not* happen in between two states -- the lightbox going down and up again while the state
     interface takes the constellation's place, say, which is the flicker issue #66 forbids. */
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    this.writes.push({ name, value: String(value) });
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    this.writes.push({ name, value: null });
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  /* A node has one parent, so appending something that already has one moves it -- which is how
     the state interface gets from the corner js/state.js built it in to the middle of the
     lightbox and back again. */
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at !== -1) this.children.splice(at, 1);
    child.parentNode = null;
    return child;
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

  click() {
    this.clicks += 1;
    dispatch(this, { type: "click" });
  }
}

/** An event, walking up from its target the way a real one bubbles. */
function dispatch(target, event) {
  const detail = Object.assign({ target, defaultPrevented: false }, event);
  detail.preventDefault = () => {
    detail.defaultPrevented = true;
  };
  for (let node = target; node; node = node.parentNode) {
    for (const handler of (node.listeners[detail.type] || []).slice()) handler.call(node, detail);
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

const CHIP = { width: 150, height: 44 }; // the min-height every option carries in _nav.scss

/** One option in an orbit: the ray, and the chip (a link, or a button that does something here). */
function option(orbit, { id, tag = "a", nodeId, label, labelId, href, hidden } = {}) {
  const li = make("li", Object.assign({ class: "sparknav-option" }, id ? { id } : {}));
  if (hidden) li.hidden = true;
  li.appendChild(make("span", { class: "sparknav-ray", "aria-hidden": "true" }));
  const node = make(tag, Object.assign({ class: "sparknav-node" },
    nodeId ? { id: nodeId } : {}, tag === "a" ? { href: href || "#" } : { type: "button" }), CHIP);
  node.appendChild(make("svg", { class: "icon" }));
  node.appendChild(make("span",
    Object.assign({ class: "sparknav-label" }, labelId ? { id: labelId } : {})));
  node.children[1].textContent = label || "";
  li.appendChild(node);
  orbit.appendChild(li);
  return li;
}

/** The page the shared shell writes, as much of it as the nav reads: the skip link, the logo and
 *  its constellation, the persona, the page's content and the feed. */
function makeDocument({ page = "quiet-room.html", viewport = { width: 1280, height: 900 },
                        nav = true } = {}) {
  const html = make("html", { "data-page": page });
  const head = make("head");
  const body = make("body");
  html.appendChild(head);
  html.appendChild(body);

  body.appendChild(make("a", { class: "skip-link", href: "#main-content" }, CHIP));
  if (!nav) {
    body.appendChild(make("div", { id: "main-content", tabindex: "-1" }));
    return finish(html, head, body, viewport);
  }
  const host = make("details", { class: "sparknav", id: "sparknav" });
  const logo = make("summary", { class: "sparknav-logo", id: "sparknav-logo",
                                 "aria-label": "interesting: the site menu" }, { width: 44, height: 44 });
  logo.appendChild(make("svg", { class: "icon sparknav-spark" }));
  logo.appendChild(make("span", { class: "sparknav-name" }));
  host.appendChild(logo);
  host.appendChild(make("div", { class: "sparknav-veil", id: "sparknav-veil" }));
  const sky = make("nav", { class: "sparknav-sky", "aria-label": "Site" });
  const near = make("ul", { class: "sparknav-orbit sparknav-near", id: "sparknav-near" });
  const far = make("ul", { class: "sparknav-orbit sparknav-far", id: "sparknav-far" });
  for (const [label, href] of [["the threshold", "index.html"], ["the mood atlas", "moods.html"],
                               ["site map", "sitemap.html"]]) {
    option(near, { label, href });
  }
  option(near, { id: "sparknav-reading", nodeId: "sparknav-reading-go",
                 labelId: "sparknav-reading-label", label: "your world", href: "moods.html",
                 hidden: true });
  option(far, { id: "sparknav-cookies", tag: "button", nodeId: "sparknav-cookies-open",
                label: "cookies", hidden: true });
  option(far, { id: "sparknav-state", tag: "button", nodeId: "sparknav-state-open",
                labelId: "sparknav-state-label", label: "state", hidden: true });
  option(far, { label: "privacy", href: "privacy.html" });
  option(far, { label: "terms", href: "terms.html" });
  sky.appendChild(near);
  sky.appendChild(far);
  host.appendChild(sky);
  // Where the shell holds the middle of the lightbox open for the state interface, empty until the
  // option is picked, exactly as _includes/layout.njk writes it.
  host.appendChild(make("div", { class: "sparknav-modal", id: "sparknav-modal", hidden: "" },
                        { width: 1000, height: 600 }));
  body.appendChild(host);

  body.appendChild(make("div", { class: "persona", id: "persona" }));
  body.appendChild(make("div", { id: "main-content", tabindex: "-1" }));
  body.appendChild(make("div", { class: "page" }));
  // The consent library's own markup, which hides itself from a screen reader while its dialog is
  // closed: the lightbox must leave anything already put away exactly as it found it.
  body.appendChild(make("div", { id: "cc-main", "aria-hidden": "true" }));

  return finish(html, head, body, viewport);
}

/** The document object itself, around a tree that is already built. */
function finish(html, head, body, viewport) {
  const document_ = {
    documentElement: html,
    head,
    body,
    readyState: "complete",
    activeElement: null,
    listeners: {},
    createElement: (tag) => make(tag),
    getElementById: (id) => html.descendants().find((el) => el.getAttribute("id") === id) || null,
    querySelector: (selector) => html.querySelector(selector),
    querySelectorAll: (selector) => html.querySelectorAll(selector),
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
  };
  for (const el of [html, ...html.descendants()]) el.ownerDocument = document_;
  document_.viewport = viewport;
  return document_;
}

function load(options = {}) {
  const document_ = makeDocument(options);
  const frames = { asked: [], ran: [], cancelled: [] };
  const observers = [];
  const timers = [];
  const window_ = {
    document: document_,
    innerWidth: document_.viewport.width,
    innerHeight: document_.viewport.height,
    listeners: {},
    interestingState: {
      keys: () => (options.kept || []).slice(),
      read: () => ({ status: "missing", value: null }),
      get: () => null,
      set: () => true,
      remove: () => true,
      persistent: true,
    },
    performance: { now: () => 1000 },
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    requestAnimationFrame(fn) {
      frames.asked.push(fn);
      return frames.asked.length;
    },
    cancelAnimationFrame(id) {
      frames.cancelled.push(id);
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.watching = null;
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
  if (options.reading) {
    window_.threshold = { reading: () => options.reading };
  }
  // Both spellings a browser offers, because the shell uses both: window.MutationObserver where
  // it checks whether there is one, and the bare global where it makes one.
  vm.runInNewContext(source, {
    window: window_,
    document: document_,
    setTimeout: window_.setTimeout,
    performance: window_.performance,
    requestAnimationFrame: window_.requestAnimationFrame,
    MutationObserver: window_.MutationObserver,
  });
  return { window: window_, document: document_, frames, observers, timers };
}

/* ---- driving it --------------------------------------------------------------------------- */

function id(context, name) {
  return context.document.getElementById(name);
}

function fireWindow(context, type) {
  for (const handler of (context.window.listeners[type] || []).slice()) handler({ type });
}

function fireDocument(context, type, event = {}) {
  const detail = Object.assign({ type, defaultPrevented: false }, event);
  detail.preventDefault = () => {
    detail.defaultPrevented = true;
  };
  for (const handler of (context.document.listeners[type] || []).slice()) handler(detail);
  return detail;
}

function mutated(context) {
  for (const observer of context.observers) {
    if (!observer.stopped) observer.callback([], observer);
  }
}

/** Open or close the logo the way a visitor's press does: the attribute changes, and the element
 *  fires `toggle` for it. */
function toggle(context, open) {
  id(context, "sparknav").open = open;
}

/** What js/state.js offers a shell that would rather host its panel than press its button:
 *  window.interestingState.menu, as "Presented somewhere else" in that file describes it. The
 *  panel is moved into the host, marked, filled and shown; the function that comes back closes it
 *  and puts it where it was built. LocalStateStoreTest holds the real one to this. */
function stateMenuStub(panel) {
  let home = null;
  const menu = {
    panel,
    openedOnScreen: null,
    present(host) {
      if (!host || typeof host.appendChild !== "function") return null;
      if (!home) home = panel.parentNode;
      host.appendChild(panel);
      panel.setAttribute("data-site-meta-presented", "");
      panel.setAttribute("aria-modal", "true");
      panel.hidden = false;
      // The real file puts the focus in the document's text as it opens, which only lands if the
      // host it was moved into is already on screen. Whether it was is worth reporting: a hidden
      // box takes no focus, and nothing would say so.
      const field = panel.querySelector("textarea");
      if (field) {
        menu.openedOnScreen = !!(field.offsetWidth || field.offsetHeight);
        field.focus();
      }
      return () => {
        panel.hidden = true;
        panel.removeAttribute("data-site-meta-presented");
        panel.removeAttribute("aria-modal");
        if (home) home.appendChild(panel);
        home = null;
      };
    },
  };
  return menu;
}

/** The two buttons the fixed files pin to the corners, drawn after the page has loaded. The state
 *  menu arrives with its panel and with the offer to be hosted elsewhere; `hosted: false` is the
 *  store that makes no such offer, which the constellation has to fall back from. */
function drawCorners(context, { cookies = true, state = true, hosted = true } = {}) {
  if (cookies) {
    context.document.body.appendChild(
      make("button", { class: "site-consent-link", "aria-label": "Change cookie preferences" }, CHIP));
  }
  if (state) {
    const root = make("div", { class: "site-meta" });
    root.appendChild(make("button", { class: "site-meta-open", "aria-expanded": "false" }, CHIP));
    // As much of the panel as a keyboard walks: the text box holding the document, and the four
    // controls under it.
    const panel = make("div", { class: "site-meta-panel", id: "site-meta-panel",
                                role: "dialog", hidden: "" });
    panel.appendChild(make("textarea", { id: "site-meta-json" }, { width: 400, height: 150 }));
    const actions = make("div", { class: "site-meta-actions" });
    for (const word of ["copy", "replace mine", "clear", "close"]) {
      const button = make("button", { type: "button" }, CHIP);
      button.textContent = word;
      actions.appendChild(button);
    }
    panel.appendChild(actions);
    root.appendChild(panel);
    context.document.body.appendChild(root);
    if (hosted) context.window.interestingState.menu = stateMenuStub(panel);
  }
  for (const el of context.document.documentElement.descendants()) {
    el.ownerDocument = context.document;
  }
  mutated(context);
}

/** The state interface as the shell left it: where it is, whether it is open, and what the
 *  lightbox around it is doing. */
function stateInterface(context) {
  const panel = context.document.querySelector(".site-meta-panel");
  const sky = id(context, "sparknav").querySelector(".sparknav-sky");
  const seen = lightbox(context);
  const veil = id(context, "sparknav-veil");
  return {
    lightbox: seen.lightbox,
    open: id(context, "sparknav").open,
    // Still the same veil, still where it was: it is never taken down and raised again.
    veil: !!veil && veil.parentNode === id(context, "sparknav"),
    sky: sky.hidden,
    branching: seen.branching,
    modal: id(context, "sparknav-modal").hidden,
    panelHidden: panel.hidden,
    panelHost: panel.parentNode ? panel.parentNode.getAttribute("id") || panel.parentNode.className : null,
    presented: panel.hasAttribute("data-site-meta-presented"),
    ariaModal: panel.getAttribute("aria-modal"),
    corner: context.document.querySelector(".site-meta-open").clicks,
    focusedLogo: id(context, "sparknav-logo").focused,
    aside: seen.aside,
  };
}

/** What one option looks like from the outside: whether it is in the orbit, and where. */
function described(li) {
  const node = li.querySelector(".sparknav-node");
  return {
    id: li.getAttribute("id"),
    hidden: li.hidden,
    tag: node.tagName.toLowerCase(),
    href: node.getAttribute("href"),
    label: node.querySelector(".sparknav-label").textContent,
    current: node.getAttribute("aria-current"),
    x: Number.parseFloat(li.properties["--x"]),
    y: Number.parseFloat(li.properties["--y"]),
    len: Number.parseFloat(li.properties["--len"]),
    angle: Number.parseFloat(li.properties["--a"]),
    order: Number.parseInt(li.properties["--k"], 10),
  };
}

function constellation(context) {
  return id(context, "sparknav").querySelectorAll(".sparknav-option")
    .map(described).filter((star) => !star.hidden);
}

/** Everything the lightbox has to do at once: the attribute, what is put aside, what is left
 *  alone, and whether the page's frame loop is running. */
function lightbox(context) {
  const html = context.document.documentElement;
  const aside = {};
  for (const child of context.document.body.children) {
    aside[child.getAttribute("id") || child.className] = {
      inert: child.hasAttribute("inert"),
      ariaHidden: child.getAttribute("aria-hidden"),
      marked: child.hasAttribute("data-nav-aside"),
    };
  }
  return {
    lightbox: html.getAttribute("data-lightbox"),
    nav: html.getAttribute("data-nav"),
    expanded: id(context, "sparknav-logo").getAttribute("aria-expanded"),
    branching: id(context, "sparknav").querySelector(".sparknav-sky").classList.contains("is-branching"),
    aside,
  };
}

const scenarios = {
  /* A page at rest: the document says the script is here, the logo is closed, and the options
     that depend on something are not in the orbit yet. */
  atRest() {
    const context = load();
    return {
      nav: context.document.documentElement.getAttribute("data-nav"),
      expanded: id(context, "sparknav-logo").getAttribute("aria-expanded"),
      lightbox: context.document.documentElement.getAttribute("data-lightbox"),
      options: constellation(context).map((star) => star.label),
      reading: id(context, "sparknav-reading").hidden,
      cookies: id(context, "sparknav-cookies").hidden,
      state: id(context, "sparknav-state").hidden,
    };
  },

  /* The two corner affordances arrive late -- the consent banner only draws its button once the
     library beside it has loaded -- and are adopted: hidden where they were pinned, offered in the
     orbit instead, and the state option says how much there is to carry away. */
  whenTheCornersArrive() {
    const context = load({ kept: ["constellation", "omens", "capsules"] });
    const before = {
      cookies: id(context, "sparknav-cookies").hidden,
      state: id(context, "sparknav-state").hidden,
    };
    drawCorners(context);
    const corners = {
      cookies: context.document.querySelector(".site-consent-link").hidden,
      state: context.document.querySelector(".site-meta-open").hidden,
      panel: context.document.querySelector(".site-meta-panel").hidden,
    };
    return {
      before,
      corners,
      options: constellation(context).map((star) => star.label),
      stateLabel: id(context, "sparknav-state-label").textContent,
      watching: context.observers.filter((observer) => !observer.stopped).length,
    };
  },

  /* A copy of the site with no measurement id never draws a consent button, so there is nothing to
     adopt and no cookies option -- rather than one that opens nothing. */
  withoutAConsentBanner() {
    const context = load();
    drawCorners(context, { cookies: false });
    return {
      options: constellation(context).map((star) => star.label),
      cookies: id(context, "sparknav-cookies").hidden,
      state: id(context, "sparknav-state").hidden,
    };
  },

  /* Nothing kept: the state option is still there -- someone else's sky can be pasted in -- and
     says nothing about a count. */
  withNothingKept() {
    const context = load({ kept: [] });
    drawCorners(context);
    return { stateLabel: id(context, "sparknav-state-label").textContent };
  },

  /* The world a reading opens onto is in the orbit, named for that world, once there is one. */
  onceSomethingIsRead() {
    const context = load({
      page: "index.html",
      reading: { source: "answer", orientation: { world: "quiet-room.html", worldName: "the quiet room" } },
    });
    // The same orientation guessed from the clock rather than answered is not a reading at all,
    // and a page whose mood flow never loaded has nothing to ask.
    const guessed = load({
      reading: { source: "signals", orientation: { world: "loam.html", worldName: "loam" } },
    });
    return {
      read: described(id(context, "sparknav-reading")),
      fromSignals: id(guessed, "sparknav-reading").hidden,
      withNoFlow: id(load(), "sparknav-reading").hidden,
    };
  },

  /* A reading taken while the page is open puts the option in the orbit, and forgetting it takes
     the option out again. */
  whenTheReadingChanges() {
    const context = load();
    const before = id(context, "sparknav-reading").hidden;
    context.window.threshold = {
      reading: () => ({ source: "answer",
                        orientation: { world: "loam.html", worldName: "loam" } }),
    };
    fireWindow(context, "threshold:reading");
    const after = described(id(context, "sparknav-reading"));
    context.window.threshold = { reading: () => null };
    fireWindow(context, "threshold:reading");
    return { before, after, forgotten: id(context, "sparknav-reading").hidden };
  },

  /* On the page the reading opens onto, the option says so rather than offering a trip to where
     the visitor already is. */
  onTheWorldItOpensOnto() {
    const context = load({
      page: "loam.html",
      reading: { source: "answer", orientation: { world: "loam.html", worldName: "loam" } },
    });
    return described(id(context, "sparknav-reading"));
  },

  /* Pressing the logo: the lightbox goes up, everything else on the page is put aside, the
     constellation branches, and the page's frame loop stops until it closes. */
  whenItOpens() {
    const context = load({ kept: ["constellation"] });
    drawCorners(context);
    const asked = [];
    context.window.requestAnimationFrame((now) => asked.push(now)); // a page's loop, before
    toggle(context, true);
    const held = [];
    context.window.requestAnimationFrame((now) => held.push(now)); // and while it is open
    return {
      open: lightbox(context),
      stars: constellation(context),
      ranWhileOpen: held.length,
      ranBefore: context.frames.asked.length,
    };
  },

  /* And closing again: the page comes back exactly as it was, the frames that were held are run,
     and what the consent library had already hidden was never touched. */
  whenItCloses() {
    const context = load();
    drawCorners(context);
    toggle(context, true);
    const held = [];
    context.window.requestAnimationFrame((now) => held.push(now));
    const whileOpen = { ran: held.length, aside: lightbox(context).aside };
    toggle(context, false);
    return {
      whileOpen,
      ranOnClose: held.length,
      closed: lightbox(context),
    };
  },

  /* Escape closes it and gives the logo the focus back, and so does a press on the veil. */
  whenItIsDismissed() {
    const escape = load();
    toggle(escape, true);
    fireDocument(escape, "keydown", { key: "Escape" });
    const veiled = load();
    toggle(veiled, true);
    id(veiled, "sparknav-veil").click();
    return {
      escape: { open: id(escape, "sparknav").open, lightbox: lightbox(escape).lightbox,
                focused: id(escape, "sparknav-logo").focused },
      veil: { open: id(veiled, "sparknav").open, lightbox: lightbox(veiled).lightbox },
    };
  },

  /* Tab stays inside the constellation while it is up: the page behind is inert, so the wrap at
     either end is what keeps a keyboard in the menu. */
  whenTabReachesTheEnd() {
    const context = load();
    drawCorners(context);
    toggle(context, true);
    const stars = id(context, "sparknav").querySelectorAll("a[href], button:not([disabled])");
    const last = stars[stars.length - 1];
    const logo = id(context, "sparknav-logo");
    context.document.activeElement = last;
    const forward = fireDocument(context, "keydown", { key: "Tab", shiftKey: false });
    const wrappedTo = context.document.activeElement === logo;
    context.document.activeElement = logo;
    const back = fireDocument(context, "keydown", { key: "Tab", shiftKey: true });
    const wrappedBack = context.document.activeElement === last;
    // And a Tab from anywhere but the two ends is the browser's to answer, not this one's.
    context.document.activeElement = stars[1];
    return {
      forward: { prevented: forward.defaultPrevented, toTheLogo: wrappedTo },
      back: { prevented: back.defaultPrevented, toTheLast: wrappedBack },
      middle: fireDocument(context, "keydown", { key: "Tab" }).defaultPrevented,
    };
  },

  /* A destination closes the menu on its way out, so a link to the page the visitor is already on
     does not leave the constellation hanging open over it. */
  whenADestinationIsTaken() {
    const context = load();
    toggle(context, true);
    id(context, "sparknav").querySelector(".sparknav-node").click();
    return { open: id(context, "sparknav").open, lightbox: lightbox(context).lightbox };
  },

  /* The two adopted options press the buttons their own files drew, rather than doing any of it
     themselves: one cookies dialog and one state menu on the site, wherever they are opened from. */
  whenAnAdoptedOptionIsPressed() {
    const context = load();
    drawCorners(context);
    toggle(context, true);
    id(context, "sparknav-cookies-open").click();
    const cookies = {
      corner: context.document.querySelector(".site-consent-link").clicks,
      open: id(context, "sparknav").open,
    };
    /* And the state interface, which is the same panel js/state.js built and never a copy of it,
       hosted in the lightbox rather than opened from the corner (issue #66). */
    toggle(context, true);
    id(context, "sparknav-state-open").click();
    return { cookies, state: stateInterface(context) };
  },

  /* The state interface takes the lightbox over: the constellation gives way to it and not one
     thing the lightbox is made of comes down in between (issue #66). Then it closes itself, the
     way its own "close" button does, and the lightbox goes with it. */
  whenTheStateInterfaceTakesOver() {
    const context = load({ kept: ["constellation"] });
    drawCorners(context);
    toggle(context, true);
    const held = [];
    context.window.requestAnimationFrame((now) => held.push(now)); // the page's loop, held
    const before = stateInterface(context);
    id(context, "sparknav-state-open").click();
    const taken = {
      ...stateInterface(context),
      ranWhileOpen: held.length,
      openedOnScreen: context.window.interestingState.menu.openedOnScreen,
    };

    const panel = context.document.querySelector(".site-meta-panel");
    panel.hidden = true; // what the panel's own "close" does, and nothing else of it is touched
    mutated(context);
    return {
      before,
      taken,
      closed: { ...stateInterface(context), ranOnClose: held.length },
      // What <html data-lightbox> was written across the whole of it: 'nav' when the logo was
      // pressed, 'state' when the interface took over, and gone when it closed. A null in the
      // middle of that would be the lightbox coming down and going up again, which is the
      // flicker issue #66 forbids.
      lightboxWrites: context.document.documentElement.writes
        .filter((write) => write.name === "data-lightbox").map((write) => write.value),
    };
  },

  /* Escape and a press on the dimmed page around it close the state interface, and with it the
     lightbox: there is no way back to the constellation. */
  whenTheStateInterfaceIsDismissed() {
    const escape = load();
    drawCorners(escape);
    toggle(escape, true);
    id(escape, "sparknav-state-open").click();
    fireDocument(escape, "keydown", { key: "Escape" });

    const pressed = load();
    drawCorners(pressed);
    toggle(pressed, true);
    id(pressed, "sparknav-state-open").click();
    id(pressed, "sparknav-modal").click(); // the host itself, which is the page around the panel

    /* A question floating over the state interface answers Escape itself: dismissing "are you
       sure you want to clear everything?" is not dismissing the interface that asked it. */
    const asking = load();
    drawCorners(asking);
    toggle(asking, true);
    id(asking, "sparknav-state-open").click();
    asking.window.interestingSite.areYouSure({
      what: "clear everything this site has kept in your browser",
      onConfirm: () => {},
    });
    fireDocument(asking, "keydown", { key: "Escape" });

    return {
      escape: stateInterface(escape),
      pressed: stateInterface(pressed),
      whileAsking: stateInterface(asking),
    };
  },

  /* The state interface's own "clear" asks the shared question, from inside the lightbox. That
     dialog is a child of the body, built the first time anything on the page asks, so the lightbox
     may well have put it aside before the menu was ever opened -- and a question nobody can
     answer is worse than no question. */
  whenTheStateInterfaceAsksAQuestion() {
    const context = load();
    drawCorners(context);
    // Something on the page asks first, which is what builds the dialog and leaves it there.
    context.window.interestingSite.areYouSure({ what: "clear your omens", onConfirm: () => {} });
    fireDocument(context, "keydown", { key: "Escape" });
    toggle(context, true);
    const putAside = lightbox(context).aside["are-you-sure"];
    id(context, "sparknav-state-open").click();
    context.window.interestingSite.areYouSure({
      what: "clear everything this site has kept in your browser",
      onConfirm: () => {},
    });
    const dialog = context.document.querySelector(".are-you-sure");
    return {
      putAside,
      question: {
        open: dialog.hasAttribute("open"),
        inert: dialog.hasAttribute("inert"),
        ariaHidden: dialog.getAttribute("aria-hidden"),
        focusedCancel: dialog.querySelector(".are-you-sure-no").focused,
      },
      // And the interface that asked it is still there behind the question, unmoved.
      stillUp: stateInterface(context),
    };
  },

  /* A keyboard stays inside the state interface while it is up, and reaches all of it: the text
     box holding the document is as much of the modal as the buttons under it. */
  whenTabReachesTheEndOfTheStateInterface() {
    const context = load();
    drawCorners(context);
    toggle(context, true);
    id(context, "sparknav-state-open").click();
    const inside = id(context, "sparknav")
      .querySelectorAll("summary, a[href], button:not([disabled]), textarea:not([disabled])")
      .filter((el) => el.offsetWidth || el.offsetHeight);
    const last = inside[inside.length - 1];
    const logo = id(context, "sparknav-logo");
    context.document.activeElement = last;
    const forward = fireDocument(context, "keydown", { key: "Tab" });
    const wrappedTo = context.document.activeElement === logo;
    return {
      reachable: inside.map((el) => el.tagName.toLowerCase() + (el.textContent ? ":" + el.textContent : "")),
      forward: { prevented: forward.defaultPrevented, toTheLogo: wrappedTo },
    };
  },

  /* A store too old to offer its panel, or a run that broke the asking: the option falls back to
     what it did before issue #66 -- the lightbox gets out of the way and the corner button is
     pressed -- and the logo still takes the focus back when that menu closes. */
  withoutAHostedStateInterface() {
    const context = load();
    drawCorners(context, { hosted: false });
    toggle(context, true);
    id(context, "sparknav-state-open").click();
    const fallen = stateInterface(context);
    const panel = context.document.querySelector(".site-meta-panel");
    panel.hidden = false; // the corner menu, opening where its own file pinned it
    mutated(context);
    const whileOpen = id(context, "sparknav-logo").focused;
    panel.hidden = true;
    mutated(context);
    return {
      fallen,
      focus: { whileOpen, afterClose: id(context, "sparknav-logo").focused },
    };
  },

  /* Where the stars land, on the three shapes of screen the site meets. Every chip is 44px tall,
     so two stars in a column may never be closer than that, and nothing may be placed off the
     left edge of the viewport. */
  whereTheStarsLand() {
    const shapes = {};
    for (const [name, viewport] of Object.entries({
      desktop: { width: 1440, height: 900 },
      phone: { width: 390, height: 780 },
      shortLandscape: { width: 740, height: 380 },
    })) {
      const context = load({ viewport, kept: ["constellation"] });
      drawCorners(context);
      toggle(context, true);
      shapes[name] = { viewport, stars: constellation(context) };
    }
    return shapes;
  },

  /* A viewport too short for a constellation of any shape: the stylesheet's other layout takes
     over -- a list under the logo that scrolls -- rather than leaving an option below the fold
     where nothing could reach it. */
  onAViewportTooShortForIt() {
    const context = load({ viewport: { width: 360, height: 300 } });
    drawCorners(context);
    toggle(context, true);
    const roomy = load({ viewport: { width: 360, height: 780 } });
    drawCorners(roomy);
    toggle(roomy, true);
    return {
      tooShort: context.document.documentElement.getAttribute("data-nav"),
      roomy: roomy.document.documentElement.getAttribute("data-nav"),
      stillOpen: id(context, "sparknav").open,
      stillALightbox: lightbox(context).lightbox,
    };
  },

  /* A page the shell wrote without the nav in it: nothing is built, nothing throws, and the rest
     of the shared helpers carry on -- which is what keeps a half-rewritten shell from taking the
     whole of js/site.js down with it. */
  withoutTheNav() {
    const context = load({ nav: false });
    fireWindow(context, "threshold:reading");
    fireWindow(context, "resize");
    fireWindow(context, "persona:sky");
    mutated(context);
    return {
      nav: context.document.documentElement.getAttribute("data-nav"),
      logo: id(context, "sparknav-logo"),
      lightbox: context.document.documentElement.getAttribute("data-lightbox"),
      observers: context.observers.length,
    };
  },
};

const results = {};
for (const [name, scenario] of Object.entries(scenarios)) results[name] = scenario();
process.stdout.write(JSON.stringify(results, null, 1));
