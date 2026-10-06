#!/usr/bin/env node
/**
 * Run site/js/site.js against a stub browser and report what the main nav did, as JSON on stdout.
 *
 * The nav is the whole of this site's navigation now (issue #54): the sparkles logo in the upper
 * left, the lightbox it opens, and the constellation of options it branches out -- including the
 * three affordances it adopts from js/participate.js, js/analytics.js and js/state.js, which are
 * fixed files the shell may hide and press but never edit (issue #64). All of that is behaviour
 * rather than markup, so it is worth testing rather than only reading, the way the local-state
 * store and the new-issue link beside it are.
 *
 * The lightbox the logo opens is no longer the nav's own: it is the one component the persona sheet
 * and the shared "are you sure?" modal open through as well (issue #70). What this harness watches
 * is the nav as one of its three callers -- the veil up, the page put aside, the frame loop held,
 * the page given back. lightbox_harness.mjs drives the component itself, with all three callers in
 * one document.
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
     something hidden is either, which is how the nav tells a shown option from a put-away one.

     One wrinkle, and it is the real one. The hidden attribute works through the UA stylesheet's
     `display: none`, so an element whose own file gives it a `display` in an author stylesheet
     ignores the attribute entirely -- which is exactly the shape of the three affordances the
     shell adopts: `.site-steer` is `display: inline-flex`. `ownDisplay` says an element is one of
     those, and only an inline `display: none` puts one away (see putAway in js/site.js). */
  get offsetHeight() {
    return this.laidOut() ? this.height : 0;
  }

  get offsetWidth() {
    return this.laidOut() ? this.width : 0;
  }

  laidOut() {
    for (let node = this; node; node = node.parentNode) {
      if (node.properties.display === "none") return false;
      if (node.hidden && !node.ownDisplay) return false;
    }
    return true;
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
    this.children.push(child);
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
  // The one veil the shell writes for the shared lightbox, hidden until something raises it.
  body.appendChild(make("div", { class: "lightbox-veil", id: "lightbox-veil", hidden: "" }));
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
  option(far, { id: "sparknav-participate", tag: "button", nodeId: "sparknav-participate-open",
                label: "change this site", hidden: true });
  option(far, { id: "sparknav-cookies", tag: "button", nodeId: "sparknav-cookies-open",
                label: "cookies", hidden: true });
  option(far, { id: "sparknav-state", tag: "button", nodeId: "sparknav-state-open",
                labelId: "sparknav-state-label", label: "state", hidden: true });
  option(far, { label: "privacy", href: "privacy.html" });
  option(far, { label: "terms", href: "terms.html" });
  sky.appendChild(near);
  sky.appendChild(far);
  host.appendChild(sky);
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

/** Everything the fixed files pin over the page, by the selectors js/site.js finds them with. */
const PINNED = {
  cookies: ".site-consent-link", // js/analytics.js, bottom-left
  state: ".site-meta-open", // js/state.js, bottom-right
  steer: ".site-steer", // js/participate.js, the middle of the bottom edge
};

/** Those three, drawn after the page has loaded, as their own deferred files draw them. */
function drawCorners(context, { cookies = true, state = true, steer = true } = {}) {
  if (cookies) {
    context.document.body.appendChild(
      make("button", { class: "site-consent-link", "aria-label": "Change cookie preferences" }, CHIP));
  }
  if (state) {
    const root = make("div", { class: "site-meta" });
    root.appendChild(make("button", { class: "site-meta-open", "aria-expanded": "false" }, CHIP));
    root.appendChild(make("div", { class: "site-meta-panel", id: "site-meta-panel",
                                   role: "dialog", hidden: "" }));
    context.document.body.appendChild(root);
  }
  if (steer) {
    const link = make("a", {
      class: "site-steer", href: "https://github.com/outrightmental/interesting/issues/new",
      target: "_blank", rel: "noopener noreferrer", "aria-label": "Steer the site",
    }, CHIP);
    link.ownDisplay = true; // js/participate.js gives it `display: inline-flex`
    context.document.body.appendChild(link);
  }
  for (const el of context.document.documentElement.descendants()) {
    el.ownerDocument = context.document;
  }
  mutated(context);
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

/** Everything the lightbox has to do at once: the attribute, the veil, what is put aside, what is
 *  left alone, what is left in front, and whether the page's frame loop is running. */
function lightbox(context) {
  const html = context.document.documentElement;
  const aside = {};
  for (const child of context.document.body.children) {
    aside[child.getAttribute("id") || child.className] = {
      inert: child.hasAttribute("inert"),
      ariaHidden: child.getAttribute("aria-hidden"),
      marked: child.hasAttribute("data-lightbox-aside"),
      front: child.hasAttribute("data-lightbox-front"),
    };
  }
  return {
    lightbox: html.getAttribute("data-lightbox"),
    nav: html.getAttribute("data-nav"),
    veil: !id(context, "lightbox-veil").hidden,
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
      participate: id(context, "sparknav-participate").hidden,
      cookies: id(context, "sparknav-cookies").hidden,
      state: id(context, "sparknav-state").hidden,
    };
  },

  /* The three pinned affordances arrive late -- every one of them is drawn by a deferred script,
     and the consent banner's only once the library beside it has loaded -- and are adopted: hidden
     where their own files put them, offered in the orbit instead, and the state option says how
     much there is to carry away. */
  whenTheCornersArrive() {
    const context = load({ kept: ["constellation", "omens", "capsules"] });
    const before = {
      participate: id(context, "sparknav-participate").hidden,
      cookies: id(context, "sparknav-cookies").hidden,
      state: id(context, "sparknav-state").hidden,
    };
    drawCorners(context);
    const put = (selector) => {
      const el = context.document.querySelector(selector);
      return el.hidden && el.properties.display === "none";
    };
    const corners = {
      cookies: put(".site-consent-link"),
      state: put(".site-meta-open"),
      steer: put(".site-steer"),
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

  /* The regression issue #64 is about. At rest the only chrome floating over a page is the
     sparkles logo in the top left and the persona in the top right: everything the fixed files
     pinned over the page is hidden where they pinned it, the shell adds nothing of its own to the
     body, and the constellation is what carries all three instead. (Which of the things the body
     holds is fixed-positioned is the stylesheet's business, so NavTest reads that off the Sass;
     this is the half a stub browser can see.) */
  whatFloatsAtRest() {
    const context = load({ kept: ["constellation"] });
    const bodyBefore = context.document.body.children.length;
    drawCorners(context);
    const pinned = {};
    for (const [name, selector] of Object.entries(PINNED)) {
      const el = context.document.querySelector(selector);
      // Both halves of being put away: the attribute, and the one declaration that outranks the
      // `display` the control's own file gave it (see putAway in js/site.js).
      pinned[name] = { drawn: !!el, laidOut: !!el && el.laidOut(),
                       display: (el && el.properties.display) || null };
    }
    return {
      pinned,
      // Three elements arrived, every one of them a fixed file's own: the shell drew none.
      addedToTheBody: context.document.body.children.length - bodyBefore - 3,
      options: constellation(context).map((star) => star.label),
      lightbox: context.document.documentElement.getAttribute("data-lightbox"),
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
      participate: id(context, "sparknav-participate").hidden,
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
    const raised = lightbox(veiled).veil;
    id(veiled, "lightbox-veil").click();
    return {
      escape: { open: id(escape, "sparknav").open, lightbox: lightbox(escape).lightbox,
                focused: id(escape, "sparknav-logo").focused },
      veil: { raised, open: id(veiled, "sparknav").open, lightbox: lightbox(veiled).lightbox,
              down: !lightbox(veiled).veil, focused: id(veiled, "sparknav-logo").focused },
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

  /* The three adopted options press the controls their own files drew, rather than doing any of
     it themselves: one new-issue link, one cookies dialog and one state menu on the site, wherever
     they are opened from. */
  whenAnAdoptedOptionIsPressed() {
    const context = load();
    drawCorners(context);
    toggle(context, true);
    id(context, "sparknav-participate-open").click();
    const steer = {
      corner: context.document.querySelector(".site-steer").clicks,
      href: context.document.querySelector(".site-steer").getAttribute("href"),
      target: context.document.querySelector(".site-steer").getAttribute("target"),
      open: id(context, "sparknav").open,
      // The link was put aside with the rest of the page while the lightbox was up, so the press
      // has to find it live again -- an inert element answers no click at all.
      inert: context.document.querySelector(".site-steer").hasAttribute("inert"),
    };
    toggle(context, true);
    id(context, "sparknav-cookies-open").click();
    const cookies = {
      corner: context.document.querySelector(".site-consent-link").clicks,
      open: id(context, "sparknav").open,
    };
    toggle(context, true);
    id(context, "sparknav-state-open").click();
    const state = {
      corner: context.document.querySelector(".site-meta-open").clicks,
      open: id(context, "sparknav").open,
      focusedLogo: id(context, "sparknav-logo").focused,
    };
    /* And what happens when that menu closes again: it hands the focus back to its own button,
       which the shell has hidden, so the logo takes it instead. */
    const panel = context.document.querySelector(".site-meta-panel");
    panel.hidden = false;
    mutated(context);
    const whileOpen = id(context, "sparknav-logo").focused;
    panel.hidden = true;
    mutated(context);
    return {
      steer,
      cookies,
      state,
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
