/*
  The site's local state: one JSON document, one shared way in and out of it, and the small meta
  menu in the corner of every page that can export it, import someone else's, or throw it away.

  One line in the <head> of a page carries all of it:

      <script src='js/state.js'></script>

  Deliberately not deferred, unlike the analytics line next to it: a page's own <script> runs while
  the body is parsed, which is before any deferred script, so window.interestingState has to exist
  by then. The file is small and same-origin, so blocking on it costs a page nothing worth saving.

  ---------------------------------------------------------------------------------------------
  The document

      {
        "format": "interesting",
        "version": 1,
        "saved": "2026-10-03T12:00:00.000Z",
        "values": {
          "constellation": [ { "x": 50, "y": 50, "text": "a wish" } ],
          "capsules": [ ... ],
          "omens": [ ... ]
        }
      }

  Everything the site keeps in a visitor's browser is in "values", under one localStorage key
  ("interesting_state_v1"), so a visitor can carry the whole of their sky somewhere else in one
  copy-paste. The three names above are what the site stores today -- the home constellation every
  page reinterprets, the diary's capsules and the archive's omens -- and a page that wants to keep
  something new only has to pick a name and set it.

  The cookie-consent choice is not in here: that belongs to the consent banner, which keeps it
  itself (see js/analytics.js).

  ---------------------------------------------------------------------------------------------
  The shared mechanism

  No page of this site touches localStorage. Every read and write goes through:

      window.interestingState
        .persistent            false when this browser will store nothing, so the document lives in
                               memory and lasts only as long as the page
        .read(key, fallback)   { status: 'ok' | 'missing' | 'unreadable' | 'unavailable', value }.
                               Anything but 'ok' hands back `fallback`, so a caller can render
                               first and explain afterwards, in its own words
        .get(key, fallback)    the value, or `fallback` when it is missing or unreadable
        .set(key, value)       writes it under that one name, leaving every other name as the
                               browser has it; true if it reached the browser's store, false if it
                               could only be kept in memory
        .remove(key)
        .keys()                the names the document held when this page read it
        .toText()              the whole document as indented JSON: what the meta menu exports
        .replace(text)         replaces the whole document with an exported one -> { ok, note }
        .clear()               empties it -> { ok, note }

  Two fallbacks, as issue #31 asks for: an in-memory document when localStorage cannot be used at
  all, and the caller's default whenever a value is missing or the stored document is malformed. A
  reader is told which of those happened through `status`, because "you have not made a
  constellation yet" and "your constellation could not be read" are different things to say.

  A page reads the document once, at load, and reads it again before every change it makes: one
  document for the whole site is also one document for every tab of it, and a tab that wrote its
  copy back whole would quietly throw away what another tab had saved since. So a write settles one
  name and leaves the rest alone, which is what a key per page gave for free.

  The per-page keys the site used before this file existed are folded into the document the first
  time a visitor arrives with them, and then taken away.

  ---------------------------------------------------------------------------------------------
  Out of reach

  The hourly AI iteration may rewrite any page of this site, so the line above is an axiom of every
  run and this file is kept out of its reach: see STATE_SCRIPT, FIXED_FILES, check_state and
  pages_touching_storage in .github/scripts/make_interesting.py. The meta menu is the one thing on
  the site a visitor can rely on being where they left it.
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'interesting_state_v1';
  var FORMAT = 'interesting';
  var VERSION = 1;

  // The per-page keys the site kept before it had one document, and the name each became inside
  // it. A visitor who was here before keeps their sky; once carried over, the old key is removed.
  var EARLIER_KEYS = {
    'interesting_wish_constellation_v1': 'constellation',
    'interesting_constellation_capsules_v1': 'capsules',
    'interesting_sky_archive_omens_v1': 'omens'
  };

  // Roomy for any sky this site can make, small enough that a pasted mistake cannot hang the tab.
  var MAX_IMPORT_CHARS = 1000000;

  var store = openStore();
  var persistent = !!store;
  var document_ = null; // the document, once read: both the cache and the in-memory fallback
  var readable = true; // false once the stored document has turned out to be malformed

  /* The browser's localStorage, or null if it cannot be used. A write has to be attempted: Safari
     in private mode, and any browser with storage switched off, offer the object and then throw. */
  function openStore() {
    try {
      var local = window.localStorage;
      var probe = STORAGE_KEY + '.probe';
      local.setItem(probe, '1');
      local.removeItem(probe);
      return local;
    } catch (e) {
      return null;
    }
  }

  function emptyDocument() {
    return { format: FORMAT, version: VERSION, saved: null, values: {} };
  }

  /* The "values" object of a parsed document, or null if it is not one.

     A pasted document may be the whole envelope, which is what toText() writes, or only the values
     inside it, which is what someone who trimmed it by hand is likely to be holding. Both are
     accepted; anything that is not a plain object is not. */
  function valuesOf(parsed) {
    if (!isObject(parsed)) return null;
    if (isObject(parsed.values)) return parsed.values;
    if (parsed.format === FORMAT || 'values' in parsed) return null; // an envelope, but a broken one
    return parsed;
  }

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function currentDocument() {
    if (document_) return document_;
    document_ = emptyDocument();
    if (!store) return document_;
    var raw = null;
    try {
      raw = store.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    if (raw !== null) {
      var parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e2) {
        parsed = null;
      }
      var values = valuesOf(parsed);
      if (values) {
        document_.values = values;
        // Kept as it was written, so an exported document says when the sky it holds was saved.
        if (typeof parsed.saved === 'string') document_.saved = parsed.saved;
      } else {
        readable = false;
      }
    }
    return document_;
  }

  /* The document as the browser holds it now, rather than as this page first read it.

     One document for the whole site means two tabs of it share one document, and a page that wrote
     its own copy back whole would throw away whatever another tab had written since -- which a key
     per page could never do. So every change starts from a fresh read, and a write is last one
     wins by name and not by document. A browser that stores nothing has nothing to re-read: there
     the in-memory copy is all there is, and dropping it would be the only way to lose it. */
  function freshDocument() {
    if (store) document_ = null;
    return currentDocument();
  }

  function write(doc) {
    doc.format = FORMAT;
    doc.version = VERSION;
    doc.saved = new Date().toISOString();
    document_ = doc;
    readable = true;
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(doc));
      return true;
    } catch (e) {
      return false; // out of room, or storage was taken away mid-visit
    }
  }

  /* Fold the earlier per-page keys into the document, and take them away. Anything already under
     the new name wins: the document is the record now. */
  function carryEarlierKeysOver() {
    if (!store) return;
    var doc = currentDocument();
    var moved = false;
    for (var key in EARLIER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(EARLIER_KEYS, key)) continue;
      var raw = null;
      try {
        raw = store.getItem(key);
      } catch (e) {
        return;
      }
      if (raw === null) continue;
      var name = EARLIER_KEYS[key];
      if (!(name in doc.values)) {
        try {
          var value = JSON.parse(raw);
          if (value !== null && value !== undefined) doc.values[name] = value;
        } catch (e2) {
          // unreadable, so there is nothing to carry over; the old key still goes
        }
      }
      try {
        store.removeItem(key);
      } catch (e3) {
        return;
      }
      moved = true;
    }
    if (moved) write(doc);
  }

  function read(key, fallback) {
    var values = currentDocument().values;
    // Only what the document itself holds: a name is a name the site chose, not one it inherited
    // from Object.prototype, so read('valueOf') is missing rather than a function.
    var value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
    if (value !== undefined && value !== null) return { status: 'ok', value: value };
    return {
      status: !persistent ? 'unavailable' : (readable ? 'missing' : 'unreadable'),
      value: fallback === undefined ? null : fallback
    };
  }

  function set(key, value) {
    var doc = freshDocument();
    if (value === undefined) delete doc.values[key];
    else doc.values[key] = value;
    return write(doc);
  }

  function remove(key) {
    return set(key, undefined);
  }

  /* Exported fresh, not as this page read it: what a visitor copies out has to be their whole
     state, including anything another tab of the site has written while this one sat open. */
  function toText() {
    return JSON.stringify(freshDocument(), null, 2);
  }

  /* Replace the whole document with an exported one. Replace, never merge: a shared state is only
     worth sharing if the sky it opens is the sky it came from. */
  function replace(text) {
    var raw = String(text === null || text === undefined ? '' : text).trim();
    if (!raw) return { ok: false, note: 'Nothing to import: paste a state document in first.' };
    if (raw.length > MAX_IMPORT_CHARS) return { ok: false, note: 'That document is too large.' };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { ok: false, note: 'That is not valid JSON, so nothing was changed.' };
    }
    var values = valuesOf(parsed);
    if (!values) return { ok: false, note: 'That JSON is not a state document, so nothing was changed.' };
    var doc = emptyDocument();
    doc.values = values;
    if (!write(doc)) {
      return { ok: true, note: 'Imported for this page only: this browser would not store it.' };
    }
    return { ok: true, note: 'Imported. Everything on this site now reads that sky.' };
  }

  function clear() {
    document_ = emptyDocument();
    readable = true;
    if (!store) return { ok: true, note: 'Cleared. This browser was storing nothing anyway.' };
    try {
      store.removeItem(STORAGE_KEY);
      for (var key in EARLIER_KEYS) {
        if (Object.prototype.hasOwnProperty.call(EARLIER_KEYS, key)) store.removeItem(key);
      }
    } catch (e) {
      return { ok: false, note: 'The browser would not let go of it.' };
    }
    return { ok: true, note: 'Cleared. Nothing of yours is kept here now.' };
  }

  window.interestingState = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    persistent: persistent,
    read: read,
    get: function (key, fallback) {
      return read(key, fallback).value;
    },
    set: set,
    remove: remove,
    keys: function () {
      return Object.keys(currentDocument().values).sort();
    },
    toText: toText,
    replace: replace,
    clear: clear
  };

  carryEarlierKeysOver();

  /* ------------------------------------------------------------------------------------------- */
  /* The meta menu: one very small affordance in the corner of every page, opposite the consent
     banner's "cookies" button, that opens the whole document for copying, pasting over or
     clearing. Its styles live here rather than in a stylesheet for the same reason the consent
     button's do: every page of this site may be rewritten by the hourly AI run, and this must not
     be rewritten with them. Nothing in here moves, so there is no motion to answer for. */

  var MENU_CSS = [
    '.site-meta { position: fixed; right: 0.55rem; bottom: 0.5rem; z-index: 21; }',
    '.site-meta-open {',
    '  border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 999px;',
    '  background: rgba(10, 12, 22, 0.55); color: rgba(220, 227, 255, 0.6);',
    '  font: inherit; font-size: 0.72rem; line-height: 1; min-height: 2rem;',
    '  padding: 0.3rem 0.7rem; cursor: pointer; opacity: 0.55;',
    '}',
    '.site-meta-open:hover, .site-meta-open[aria-expanded="true"] { opacity: 1; }',
    '.site-meta-panel {',
    '  position: fixed; right: 0.55rem; bottom: 3rem;',
    '  box-sizing: border-box; width: min(23rem, calc(100vw - 1.1rem));',
    '  max-height: min(27rem, calc(100vh - 4.5rem)); overflow: auto;',
    '  padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 0.6rem;',
    '  background: rgba(7, 10, 20, 0.97); color: #eef4ff;',
    '  font: inherit; font-size: 0.78rem; line-height: 1.45;',
    '  box-shadow: 0 0.6rem 1.8rem rgba(0, 0, 0, 0.6);',
    '}',
    '.site-meta-panel[hidden] { display: none; }',
    '.site-meta-panel p { margin: 0 0 0.5rem; }',
    '.site-meta-panel label { display: block; margin: 0 0 0.3rem; color: #a9b7da; }',
    '.site-meta-panel textarea {',
    '  display: block; box-sizing: border-box; width: 100%; min-height: 8rem; resize: vertical;',
    '  padding: 0.45rem; border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 0.35rem;',
    '  background: rgba(0, 0, 0, 0.45); color: #eef4ff; font-size: 0.72rem;',
    '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
    '}',
    '.site-meta-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.55rem; }',
    '.site-meta-panel .site-meta-actions button {',
    '  flex: 1 1 auto; min-height: 44px; padding: 0.3rem 0.75rem;',
    '  border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 999px;',
    '  background: rgba(255, 255, 255, 0.07); color: #eef4ff; font: inherit; font-size: 0.74rem;',
    '  cursor: pointer; box-shadow: none;',
    '}',
    '.site-meta-panel .site-meta-note { margin: 0.5rem 0 0; color: #ffe7ab; min-height: 1.4em; }',
    /* Several pages take the browser's focus ring off their own controls, which would otherwise
       leave this menu unusable by keyboard. */
    '.site-meta-open:focus-visible, .site-meta-panel button:focus-visible,',
    '.site-meta-panel textarea:focus-visible {',
    '  outline: 2px solid #8db8ff; outline-offset: 2px;',
    '}'
  ].join('\n');

  function addStyle(css) {
    var el = window.document.createElement('style');
    el.textContent = css;
    window.document.head.appendChild(el);
  }

  function element(tag, properties, attributes) {
    var el = window.document.createElement(tag);
    var name;
    for (name in properties || {}) {
      if (Object.prototype.hasOwnProperty.call(properties, name)) el[name] = properties[name];
    }
    for (name in attributes || {}) {
      if (Object.prototype.hasOwnProperty.call(attributes, name)) {
        el.setAttribute(name, attributes[name]);
      }
    }
    return el;
  }

  function buildMenu() {
    addStyle(MENU_CSS);

    var open = element('button', { type: 'button', className: 'site-meta-open', textContent: 'state' }, {
      'aria-label': 'Your saved state: copy it, replace it or clear it',
      'aria-expanded': 'false',
      'aria-controls': 'site-meta-panel',
      'aria-haspopup': 'dialog'
    });

    var panel = element('div', { className: 'site-meta-panel', id: 'site-meta-panel', hidden: true }, {
      role: 'dialog',
      'aria-label': 'Your saved state'
    });

    var blurb = element('p', {
      textContent: 'Everything this site keeps in your browser, as one JSON document. Copy it to ' +
        'keep or to share; paste someone else\'s over it to walk through their sky.'
    });

    var label = element('label', {
      htmlFor: 'site-meta-json',
      textContent: 'Your state, as JSON'
    });
    var text = element('textarea', { id: 'site-meta-json', rows: 8, spellcheck: false }, {
      autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', wrap: 'off'
    });

    var note = element('p', { className: 'site-meta-note' }, { role: 'status', 'aria-live': 'polite' });

    var actions = element('div', { className: 'site-meta-actions' });
    var copy = element('button', { type: 'button', textContent: 'copy' });
    var paste = element('button', { type: 'button', textContent: 'replace mine' });
    var wipe = element('button', { type: 'button', textContent: 'clear' });
    var close = element('button', { type: 'button', textContent: 'close' });
    actions.appendChild(copy);
    actions.appendChild(paste);
    actions.appendChild(wipe);
    actions.appendChild(close);

    panel.appendChild(blurb);
    panel.appendChild(label);
    panel.appendChild(text);
    panel.appendChild(actions);
    panel.appendChild(note);

    var root = element('div', { className: 'site-meta' });
    root.appendChild(open);
    root.appendChild(panel);

    function say(message) {
      note.textContent = message;
    }

    function show() {
      text.value = toText();
      panel.hidden = false;
      open.setAttribute('aria-expanded', 'true');
      say(persistent ? '' : 'This browser stores nothing, so what follows lasts until you leave.');
      text.focus();
      text.setSelectionRange(0, 0);
    }

    function hide(moveFocus) {
      panel.hidden = true;
      open.setAttribute('aria-expanded', 'false');
      if (moveFocus) open.focus();
    }

    open.addEventListener('click', function () {
      if (panel.hidden) show();
      else hide(true);
    });

    copy.addEventListener('click', function () {
      text.focus();
      text.select();
      var clipboard = window.navigator && window.navigator.clipboard;
      if (clipboard && clipboard.writeText) {
        clipboard.writeText(text.value).then(function () {
          say('Copied. That text is your whole sky.');
        }, function () {
          say('The browser would not copy it; the text is selected, so copy it yourself.');
        });
        return;
      }
      say('The browser offers no clipboard; the text is selected, so copy it yourself.');
    });

    paste.addEventListener('click', function () {
      var outcome = replace(text.value);
      say(outcome.note);
      if (outcome.ok) window.setTimeout(reload, 900);
    });

    wipe.addEventListener('click', function () {
      if (!window.confirm('Clear everything this site has kept in your browser? This cannot be undone.')) {
        say('Nothing was cleared.');
        return;
      }
      var outcome = clear();
      say(outcome.note);
      text.value = toText();
      if (outcome.ok) window.setTimeout(reload, 900);
    });

    close.addEventListener('click', function () {
      hide(true);
    });

    /* Escape closes it, and a press anywhere else on the page does too, which is what a popup
       owes anyone who opened it by mistake. */
    window.document.addEventListener('keydown', function (event) {
      if (!panel.hidden && (event.key === 'Escape' || event.key === 'Esc')) hide(true);
    });
    window.document.addEventListener('pointerdown', function (event) {
      if (!panel.hidden && !root.contains(event.target)) hide(false);
    });

    window.document.body.appendChild(root);
  }

  /* The page reads the document it was given; the simplest honest way to show a sky that has just
     been replaced or cleared is to let every page load it again from the start. */
  function reload() {
    window.location.reload();
  }

  if (window.document.body) buildMenu();
  else window.document.addEventListener('DOMContentLoaded', buildMenu);
})();
