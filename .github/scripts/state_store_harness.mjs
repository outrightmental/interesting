#!/usr/bin/env node
/**
 * Run site/js/state.js against a stub browser and report what it did, as JSON on stdout.
 *
 * The store and its meta menu are the one piece of behaviour on this site that every page depends
 * on and that no hourly run may rewrite (see STATE_SCRIPT and FIXED_FILES in make_interesting.py),
 * so it is worth testing rather than only type-checking. It touches the browser through `window`
 * and nothing else, which is what makes a stub this small enough: a handful of objects standing in
 * for localStorage and the DOM.
 *
 *   node state_store_harness.mjs path/to/site/js/state.js
 *
 * Every scenario below gets a fresh context and a fresh storage stub, and returns plain data.
 * LocalStateStoreTest in test_make_interesting.py makes the assertions: the harness only observes.
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(process.argv[2], "utf8");

/** A stand-in for localStorage. `broken: true` makes every call throw, as a browser with storage
 *  switched off does -- it offers the object and then refuses to use it. A stub can also be filled
 *  up part-way through a visit (`stub.full = true`), which is what a browser out of room does: it
 *  reads back happily and refuses every write. */
function makeStorage(initial = {}, { broken = false } = {}) {
  const items = new Map(Object.entries(initial));
  const refuse = () => {
    throw new Error("storage is not available");
  };
  const stub = {
    items,
    full: false,
    getItem: broken ? refuse : (key) => (items.has(key) ? items.get(key) : null),
    setItem: broken ? refuse : (key, value) => {
      if (stub.full) throw new Error("the quota has been exceeded");
      items.set(key, String(value));
    },
    removeItem: broken ? refuse : (key) => void items.delete(key),
  };
  return stub;
}

/** The handful of DOM an element needs to be built, named, nested and clicked. */
function makeElement(tag) {
  const el = {
    tagName: tag,
    attributes: {},
    children: [],
    listeners: {},
    focused: 0,
    selected: 0,
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
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
    contains(node) {
      return node === el || this.children.some((child) => child.contains(node));
    },
    focus() {
      this.focused += 1;
    },
    select() {
      this.selected += 1;
    },
    setSelectionRange() {},
  };
  return el;
}

function makeWindow(storage, { confirms = true } = {}) {
  const document = {
    head: makeElement("head"),
    body: makeElement("body"),
    listeners: {},
    createElement: makeElement,
    addEventListener(type, handler) {
      (this.listeners[type] = this.listeners[type] || []).push(handler);
    },
  };
  return {
    document,
    localStorage: storage,
    navigator: {},
    location: { reloads: 0, reload() { this.reloads += 1; } },
    confirmed: 0,
    confirm() {
      this.confirmed += 1;
      return confirms;
    },
    // The menu waits a moment before reloading so its last word can be read; the stub runs the
    // callback at once, because a test should not have to wait for a reload to be observable.
    setTimeout: (fn) => void fn(),
  };
}

function load(storage, options) {
  const window = makeWindow(storage, options);
  vm.runInNewContext(source, { window });
  return { window, state: window.interestingState };
}

/** Everything in the stub storage, parsed where it is JSON, so a scenario can show its whole shelf. */
function shelf(storage) {
  const out = {};
  for (const [key, value] of storage.items) {
    try {
      out[key] = JSON.parse(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** The meta menu as the stub saw it built: the affordance, the panel and the controls inside it. */
function menuOf(window) {
  const root = window.document.body.children[0];
  if (!root) return null;
  const [open, panel] = root.children;
  const actions = panel.children.find((child) => child.className === "site-meta-actions");
  const buttons = {};
  for (const button of actions ? actions.children : []) buttons[button.textContent] = button;
  const field = panel.children.find((child) => child.tagName === "textarea");
  const label = panel.children.find((child) => child.tagName === "label");
  const note = panel.children.find((child) => child.className === "site-meta-note");
  return { root, open, panel, buttons, field, label, note };
}

function click(element) {
  for (const handler of element.listeners.click || []) handler();
}

function press(window, key) {
  for (const handler of window.document.listeners.keydown || []) handler({ key });
}

function described(menu) {
  return {
    openTag: menu.open.tagName,
    openType: menu.open.type,
    openText: menu.open.textContent,
    openLabel: menu.open.getAttribute("aria-label"),
    openExpanded: menu.open.getAttribute("aria-expanded"),
    openControls: menu.open.getAttribute("aria-controls"),
    panelId: menu.panel.id,
    panelRole: menu.panel.getAttribute("role"),
    panelLabel: menu.panel.getAttribute("aria-label"),
    panelHidden: menu.panel.hidden,
    labelFor: menu.label ? menu.label.htmlFor : null,
    fieldId: menu.field ? menu.field.id : null,
    buttons: Object.keys(menu.buttons),
    note: menu.note ? menu.note.textContent : null,
    noteLive: menu.note ? menu.note.getAttribute("aria-live") : null,
  };
}

const SKY = [{ x: 10, y: 20, text: "a wish" }];
const scenarios = {
  /* An empty browser: one document, nothing in it, and nothing written until something is. */
  fresh() {
    const storage = makeStorage();
    const { state } = load(storage);
    return {
      keys: state.keys(),
      persistent: state.persistent,
      storageKey: state.storageKey,
      document: JSON.parse(state.toText()),
      indented: state.toText().includes("\n  "),
      shelf: shelf(storage),
      missing: state.read("constellation", []),
      // A name the document does not hold is missing even when Object.prototype does hold it.
      inherited: state.read("valueOf", []),
    };
  },

  /* A write goes into the one document, under the one key, and comes back out of it. */
  roundTrip() {
    const storage = makeStorage();
    const first = load(storage).state;
    const wrote = first.set("constellation", SKY);
    const second = load(storage).state;
    return {
      wrote,
      shelf: shelf(storage),
      keys: second.keys(),
      read: second.read("constellation", []),
      get: second.get("constellation", []),
      saved: typeof JSON.parse(storage.items.get(first.storageKey)).saved,
    };
  },

  /* Two tabs of the site, open at once, each keeping its own name. One document for the whole
     site is one document for every tab of it, so a write has to settle one name and leave the
     rest as the browser has them -- which is what a key per page gave for free. */
  twoTabs() {
    const storage = makeStorage();
    const home = load(storage).state; // the home page, which keeps the constellation
    const archive = load(storage).state; // the archive, open in another tab, which keeps omens
    archive.set("omens", [{ text: "an omen", time: 1 }]);
    home.set("constellation", SKY);
    const exported = JSON.parse(home.toText()).values;
    return {
      shelf: shelf(storage),
      reloaded: load(storage).state.keys(),
      exported,
      homeStillReads: home.read("constellation", []),
    };
  },

  /* A browser that will not store anything: the document lives in memory for this page only. */
  withoutStorage() {
    const storage = makeStorage({}, { broken: true });
    const { state } = load(storage);
    const missing = state.read("constellation", []);
    const wrote = state.set("constellation", SKY);
    return {
      persistent: state.persistent,
      missing,
      wrote,
      afterWriting: state.read("constellation", []),
      shelf: shelf(storage),
      reloaded: load(makeStorage({}, { broken: true })).state.read("constellation", []),
    };
  },

  /* A browser that offered to store and then runs out of room part-way through a visit. The write
     is refused, the page is told so, and what it kept has to stay kept for as long as the page is
     open -- a later read, or the meta menu asking for the whole document, must not quietly roll it
     back to what the browser managed to save. */
  storageFillsUp() {
    const storage = makeStorage();
    const { state } = load(storage);
    state.set("omens", [{ text: "saved in time", time: 1 }]);
    storage.full = true;
    const wrote = state.set("constellation", SKY);
    const afterWriting = state.read("constellation", []);
    const exported = JSON.parse(state.toText()).values;
    return {
      wrote,
      afterWriting,
      exported,
      afterExporting: state.read("constellation", []),
      // The other name is still the one the browser has: a failed write loses nothing else.
      omens: state.get("omens", []),
      shelf: shelf(storage),
      // Once the browser takes a write again, the document is the browser's once more.
      roomAgain: (() => {
        storage.full = false;
        return { wrote: state.set("capsules", [{ title: "later" }]), shelf: shelf(storage) };
      })(),
    };
  },

  /* A document that cannot be parsed, or that is not one: the caller gets its fallback, and is
     told the difference between "you have not saved anything" and "what you saved is lost". */
  malformed() {
    const results = {};
    for (const [name, raw] of Object.entries({
      truncated: '{"format":"interesting","values":{"constel',
      notAnObject: '"a string"',
      emptyEnvelope: '{"format":"interesting","version":1,"values":"oops"}',
      bareValues: '{"constellation":[{"x":1,"y":2,"text":"loose"}]}',
    })) {
      const storage = makeStorage({ interesting_state_v1: raw });
      const { state } = load(storage);
      results[name] = { read: state.read("constellation", []), keys: state.keys() };
    }
    return results;
  },

  /* The per-page keys the site kept before it had one document are folded in and taken away. */
  carriesEarlierKeysOver() {
    const storage = makeStorage({
      interesting_wish_constellation_v1: JSON.stringify(SKY),
      interesting_constellation_capsules_v1: JSON.stringify([{ title: "first" }]),
      interesting_sky_archive_omens_v1: JSON.stringify([{ text: "an omen", time: 1 }]),
      cc_cookie: '{"categories":["necessary"]}',
    });
    const { state } = load(storage);
    return {
      keys: state.keys(),
      values: JSON.parse(state.toText()).values,
      shelf: shelf(storage),
      again: load(storage).state.keys(),
    };
  },

  /* A visitor who has both: the document wins, and the old key still goes. */
  earlierKeyDoesNotOverwrite() {
    const storage = makeStorage({
      interesting_state_v1: JSON.stringify({
        format: "interesting",
        version: 1,
        values: { constellation: [{ x: 1, y: 1, text: "newer" }] },
      }),
      interesting_wish_constellation_v1: JSON.stringify(SKY),
    });
    const { state } = load(storage);
    return { value: state.get("constellation", []), shelf: shelf(storage) };
  },

  /* Export, then import somewhere else: the whole sky travels in one piece of text. */
  exportThenImport() {
    const theirs = makeStorage();
    load(theirs).state.set("constellation", SKY);
    const text = load(theirs).state.toText();

    const mine = makeStorage();
    const first = load(mine).state;
    first.set("constellation", [{ x: 99, y: 99, text: "mine" }]);
    first.set("omens", [{ text: "mine", time: 2 }]);
    const outcome = load(mine).state.replace(text);
    const after = load(mine).state;
    return {
      text,
      outcome,
      keys: after.keys(),
      constellation: after.get("constellation", []),
      omens: after.read("omens", []),
    };
  },

  /* What import refuses, and what it accepts from someone who trimmed the envelope off by hand. */
  importEdges() {
    const results = {};
    for (const [name, text] of Object.entries({
      blank: "   ",
      notJson: "not json at all",
      anArray: "[1, 2, 3]",
      brokenEnvelope: '{"format":"interesting","values":42}',
      envelope: JSON.stringify({ format: "interesting", version: 1, values: { omens: [1] } }),
      bareValues: JSON.stringify({ omens: [2] }),
      tooBig: `{"omens":[${"0,".repeat(600000)}0]}`,
    })) {
      const storage = makeStorage();
      const { state } = load(storage);
      state.set("constellation", SKY);
      results[name] = { outcome: state.replace(text), keys: state.keys() };
    }
    return results;
  },

  /* Clearing takes the site's own state and nothing else: the consent answer is the banner's. */
  clearing() {
    const storage = makeStorage({
      cc_cookie: '{"categories":["necessary"]}',
      interesting_wish_constellation_v1: JSON.stringify(SKY),
    });
    const { state } = load(storage);
    state.set("omens", [{ text: "an omen", time: 1 }]);
    const outcome = state.clear();
    return {
      outcome,
      keys: state.keys(),
      shelf: shelf(storage),
      reloaded: load(storage).state.keys(),
      removed: state.remove("omens"),
    };
  },

  /* The meta menu: one small affordance per page, named, keyboard-operable, closed to begin with. */
  menu() {
    const storage = makeStorage();
    const { window, state } = load(storage);
    state.set("constellation", SKY);
    const menu = menuOf(window);
    const shut = described(menu);

    click(menu.open);
    const opened = described(menu);
    const filled = menu.field.value;

    press(window, "Escape");
    const escaped = { panelHidden: menu.panel.hidden, openExpanded: menu.open.getAttribute("aria-expanded") };

    click(menu.open);
    click(menu.buttons.close);
    const closed = { panelHidden: menu.panel.hidden, openFocused: menu.open.focused > 0 };

    return {
      affordances: window.document.body.children.length,
      rootClass: menu.root.className,
      shut,
      opened,
      filled,
      filledParses: JSON.parse(filled).values.constellation,
      escaped,
      closed,
      styles: window.document.head.children.map((child) => child.textContent).join("\n"),
      documentListeners: Object.keys(window.document.listeners).sort(),
    };
  },

  /* The three operations a visitor reaches the menu for, driven through its own buttons. */
  menuActions() {
    const storage = makeStorage();
    const { window, state } = load(storage);
    state.set("constellation", SKY);
    const menu = menuOf(window);
    click(menu.open);

    click(menu.buttons.copy);
    const copied = { note: menu.note.textContent, selected: menu.field.selected > 0 };

    menu.field.value = JSON.stringify({ omens: [{ text: "theirs", time: 3 }] });
    click(menu.buttons["replace mine"]);
    const imported = {
      note: menu.note.textContent,
      keys: state.keys(),
      reloads: window.location.reloads,
    };

    menu.field.value = "not json";
    click(menu.buttons["replace mine"]);
    const refused = { note: menu.note.textContent, keys: state.keys(), reloads: window.location.reloads };

    click(menu.buttons.clear);
    const cleared = {
      note: menu.note.textContent,
      confirmed: window.confirmed,
      keys: state.keys(),
      shelf: shelf(storage),
    };
    return { copied, imported, refused, cleared };
  },

  /* A visitor who says no to the confirmation keeps everything. */
  clearingIsConfirmed() {
    const storage = makeStorage();
    const { window, state } = load(storage, { confirms: false });
    state.set("constellation", SKY);
    const menu = menuOf(window);
    click(menu.open);
    click(menu.buttons.clear);
    return { note: menu.note.textContent, keys: state.keys(), confirmed: window.confirmed };
  },

  /* A page in a browser that stores nothing is told so, the moment it opens the menu. */
  menuWithoutStorage() {
    const { window } = load(makeStorage({}, { broken: true }));
    const menu = menuOf(window);
    click(menu.open);
    return { note: menu.note.textContent };
  },
};

const results = {};
for (const [name, scenario] of Object.entries(scenarios)) results[name] = scenario();
process.stdout.write(JSON.stringify(results, null, 1));
