#!/usr/bin/env node
/**
 * Run site/js/participate.js against a stub browser and report what it drew, as JSON on stdout.
 *
 * The button this file draws is a visitor's one standing way of saying what the site should
 * become, and no run may rewrite it (see PARTICIPATE_SCRIPT and FIXED_FILES in
 * make_interesting.py), so it is worth testing rather than only holding in place. Like the store
 * beside it, it touches the browser through `window` and nothing else, which is what makes a stub
 * this small enough: a handful of objects standing in for the document and the address bar.
 *
 *   node participate_harness.mjs path/to/site/js/participate.js
 *
 * Every scenario below gets a fresh context. ParticipateButtonTest in test_make_interesting.py
 * makes the assertions: the harness only observes.
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(process.argv[2], "utf8");

/** The handful of DOM an element needs to be made, named, nested and read back. */
function makeElement(tag) {
  return {
    tagName: tag,
    attributes: {},
    children: [],
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return name in this.attributes ? this.attributes[name] : null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

/** A page as the browser hands it over: an <html> with the shell's attributes, a head and a body.
 *  `page` is what the shared shell writes as data-page; null leaves the attribute off altogether,
 *  which is what a run that rewrote the shell without it would leave behind. `body: false` is the
 *  other starting point a script has to cope with -- loaded before the body is parsed. */
function makeWindow({ page = null, path = "/", body = true } = {}) {
  const html = makeElement("html");
  if (page !== null) html.setAttribute("data-page", page);
  const document = {
    documentElement: html,
    head: makeElement("head"),
    body: body ? makeElement("body") : null,
    listeners: {},
    createElement: makeElement,
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
  };
  return { document, location: { pathname: path } };
}

function load(options) {
  const window = makeWindow(options);
  vm.runInNewContext(source, { window });
  return window;
}

function fire(window, type) {
  for (const handler of window.document.listeners[type] || []) handler();
}

/** The affordance as the stub saw it built: the link, its icon and its words. */
function described(window) {
  const body = window.document.body;
  const link = body && body.children.length === 1 ? body.children[0] : null;
  if (!link) return { affordances: body ? body.children.length : 0 };
  const [icon, text] = link.children;
  return {
    affordances: body.children.length,
    tag: link.tagName,
    className: link.className,
    href: link.href,
    target: link.target,
    rel: link.rel,
    label: link.getAttribute("aria-label"),
    iconClass: icon ? icon.className : null,
    iconHidden: icon ? icon.getAttribute("aria-hidden") : null,
    iconMarkup: icon ? icon.innerHTML : null,
    textClass: text ? text.className : null,
    text: text ? text.textContent : null,
    styles: window.document.head.children.map((child) => child.textContent).join("\n"),
    listeners: Object.keys(window.document.listeners).sort(),
  };
}

const scenarios = {
  /* A page of the site, named by the shared shell: one link, named, in a new tab, carrying the
     form to open and the page it was pressed on and nothing else. */
  onAPage() {
    return described(load({ page: "quiet-room.html", path: "/quiet-room.html" }));
  },

  /* The shell is a file a run may rewrite, so the browser's own path is read when data-page has
     gone. A copy of the site served under a sub-path still names the page and not the path. */
  withoutTheShellsHint() {
    return {
      plain: described(load({ page: null, path: "/sky-archive.html" })).href,
      underASubPath: described(load({ page: null, path: "/interesting/loam.html" })).href,
      trailingName: described(load({ page: "", path: "/word-kiln.html" })).href,
    };
  },

  /* Nothing that is not shaped like a page of this site is carried into an issue: the root, a
     folder, a path with something unexpected in it. The link still works -- it just says nothing
     about where the visitor was. */
  whenThePageCannotBeTold() {
    const results = {};
    for (const [name, where] of Object.entries({
      root: { page: null, path: "/" },
      folder: { page: null, path: "/deep/" },
      strange: { page: null, path: "/Some Page.html" },
      traversal: { page: "../../etc/passwd", path: "/" },
      query: { page: "index.html?x=1", path: "/" },
      absurd: { page: null, path: "/" + "a".repeat(200) + ".html" },
    })) {
      results[name] = described(load(where)).href;
    }
    return results;
  },

  /* Loaded before the body is parsed: nothing is drawn until the document says it is there. */
  beforeTheBody() {
    const window = load({ page: "index.html", path: "/index.html", body: false });
    const early = { listeners: Object.keys(window.document.listeners).sort(),
                    styles: window.document.head.children.length };
    window.document.body = makeElement("body");
    fire(window, "DOMContentLoaded");
    return { early, then: described(window) };
  },
};

const results = {};
for (const [name, scenario] of Object.entries(scenarios)) results[name] = scenario();
process.stdout.write(JSON.stringify(results, null, 1));
