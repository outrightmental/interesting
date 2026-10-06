/*
  The shared helpers every page can call, loaded by _includes/layout.njk without `defer` so they
  exist while a page's own script runs, exactly as window.interestingState and
  window.interestingPersona do.

      window.interestingSite.unlock(host, options)   a part that needs something the browser does
                                                      not hold yet, rendered as powered down with
                                                      the one button that powers it (see below)
      window.interestingSite.destructive(control, options)
                                                      a control that throws a visitor's saved state
                                                      away: the one warning treatment and the one
                                                      "are you sure?" modal (see below)
      window.interestingSite.areYouSure(options)      that modal on its own, for a control at the
                                                      threshold rather than above it
      window.interestingSite.root                     '' on every page but the 404, where the
                                                      site's root has to be spelled out
      window.interestingSite.seedSky(), .holdsSky(), .skyKey
                                                      the persona's own (js/persona.js), kept here
                                                      under the names pages used before it existed

  Pieces of the shell live here as well, because the shell is markup and Sass and needs a hand
  with the things only a script can know: the main nav -- the sparkles logo, the lightbox it opens
  and the constellation of options it branches out, which is the long section at the bottom of
  this file -- and how full each slider is (the M3 slider paints its active track in the primary
  colour up to the handle, which CSS can only do when --range-pct says where the handle is).

  Nothing in here keeps score, routes a visitor, or writes to the shared state document except
  the sky a visitor asks it to seed, which it does through the persona: the shell's job is to be
  understood in one reading and get out of the way. It draws nothing of its own on a page but the
  unlock box below, where a page asks for one.

  ---------------------------------------------------------------------------------------------
  Powered down, never broken

  Wherever a component depends on something the visitor has not done yet, its only announcement
  of that is the solution, in place. A world that reads the saved sky never says "set up your
  persona first": it presents as unpowered -- dimmed and inert, like the part of an adventure
  game whose generator is off -- and carries the one button that starts it, which does the
  prerequisite itself, in the background, writing to the persona exactly as the visitor's own
  action would. A quieter second choice may follow the button, never replace it: for the sky, a
  button that opens the persona sheet, where stars are placed by hand. The README section of the
  same name has the reasoning.

      var ready = window.interestingSite.unlock(document.querySelector('.layout'), {
        onReady: function (stars, how) { loadStars(); }   // now if a sky exists, else on press
      });

  options, all optional:
    key        the state name the part depends on; the persona's sky ('constellation') by default
    holds      function (value) -> boolean: is the value enough? By default: a non-empty array
               of { x, y, text } stars
    seed       function () -> value to write when the button is pressed; by default a small
               random sky from the persona
    onReady    function (value, how): called now with how 'saved' if the value is already there,
               after the press with 'seeded' (written to the browser) or 'memory' (written, but
               this browser keeps nothing between visits), and again with 'persona' every time
               the sky changes in the persona while the page is open -- a star placed in the
               sheet floating over a world reaches that world at once
    onPowerDown
               function (): called if the sky is emptied while the page is open, after the part
               has been powered down again, for a page that drew the stars somewhere of its own
    copy       { title, note, button } to override the words, for a prerequisite other than the sky
    elsewhere  the quiet second choice under the button: { text, open } opens the persona sheet on
               that section ('sky' or 'reading'); { href, text } is a link; null for none. For
               the sky it opens the persona by default

  It returns true when the part was ready at once, false when it rendered the unpowered state.
  The host keeps its children: they are dimmed by _sass/_unlock.scss and made inert, and the
  unlock box is put in front of the host, so the button is the first thing in reading order. The
  axiom applies when the prerequisite cannot be kept, too: a browser that stores nothing still
  gets the button, and the sky it seeds lasts for the page.

  ---------------------------------------------------------------------------------------------
  Caution before a destructive action

  Nothing on this site asks a visitor to confirm in its own words. A control that throws saved
  state away is a warning button, and pressing it opens the one modal that asks "are you sure you
  want to ______?" with the caller's words in the blank. Both halves are about consistency: the
  button is recognised as dangerous before it is read, and the question is the same question
  everywhere, naming the specific thing about to go rather than asking a generic "are you sure?".
  There is no separate arming affordance -- no checkbox, no toggle, no hold-to-arm press. The
  warning treatment plus the modal is the safety switch. The README section of the same name has
  the threshold and the reasoning; _sass/_controls.scss has the paint.

      window.interestingSite.destructive(document.getElementById('clear-history'), {
        what: 'clear your omen archive',
        detail: 'The ' + omens.length + ' omens the archive holds would go. Spinning makes more.',
        onConfirm: function () { clearHistory(); }
      });

  options:
    what       required: the blank in "are you sure you want to ______?", in the site's own voice
               and specific to this control -- "clear your constellation", not "do this"
    detail     one optional line under the question, for what is about to go and what it costs.
               A function is called at press time, so the line can count what is there now
    confirm    the confirm button's words; the control's own words by default, so a visitor
               presses the same thing twice
    onConfirm  what to do once they say yes
    onCancel   optional: a page that wants to say "kept as it was" in its own status line
    when       optional: is there anything to lose right now? When it returns false the press
               goes straight through without the question, because an empty drawer emptied again
               takes nothing away. The warning treatment stays on either way -- a control that
               changes its clothes is a control nobody learns

  It returns a function that releases the control again. areYouSure(options) is the modal alone,
  taking the same words plus `opener`, the control to return the focus to; it is for a control at
  the threshold rather than above it -- one that takes the whole of a saved thing away but puts
  something else in its place, which asks the same question without wearing the warning.

  The modal is one <dialog>, built the first time something asks and reused after that, so the
  browser supplies the backdrop, the focus trap and Escape. The focus starts on cancel and comes
  back to the control that opened it however the question is answered.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var persona = window.interestingPersona;
  var html = document.documentElement;
  var root = html.getAttribute('data-root') || '';
  var SKY = persona ? persona.key : 'constellation';

  // The nav is a constellation this script places and a cascade of plain links without it, so the
  // stylesheet has to know which. Said here, while the <head> is read and before the body is
  // drawn, so there is never a flash of the layout a visitor is not getting (see _sass/_nav.scss).
  html.setAttribute('data-nav', 'live');

  // The names the shell used to keep for games that are gone: relay marks, quests, honors,
  // signals, a switchboard, a logbook, a cipher, a remix snapshot, a trail and an arcade. Taken
  // out of a visitor's document once, so an exported state stays an honest account of what the
  // site keeps.
  var RETIRED_KEYS = [
    'constellation-relay', 'constellation-quests', 'constellation-signals',
    'constellation-switchboard', 'constellation-logbook', 'constellation-cipher',
    'constellation-remix-snapshot', 'trail-journal', 'wayfinding-arcade'
  ];

  function holdsSky(value) {
    if (persona) return persona.holds(value);
    return Array.isArray(value) && value.some(function (s) {
      return !!s && typeof s.x === 'number' && typeof s.y === 'number' && typeof s.text === 'string';
    });
  }

  function seedSky(count) {
    if (persona) return persona.seedSky(count);
    var list = [];
    for (var i = 0; i < (count || 7); i++) {
      list.push({ x: 20 + Math.random() * 60, y: 20 + Math.random() * 60, text: 'a wish' });
    }
    return list;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  var unlockCount = 0;

  function unlock(host, options) {
    var opts = options || {};
    var key = opts.key || SKY;
    var isSky = key === SKY;
    var holds = typeof opts.holds === 'function' ? opts.holds : holdsSky;
    var seed = typeof opts.seed === 'function' ? opts.seed : seedSky;
    var onReady = typeof opts.onReady === 'function' ? opts.onReady : function () {};
    var onPowerDown = typeof opts.onPowerDown === 'function' ? opts.onPowerDown : function () {};
    var copy = opts.copy || {};
    var elsewhere = 'elsewhere' in opts ? opts.elsewhere
      : (isSky ? { text: 'or place your own stars in your persona', open: 'sky' } : null);
    var powered = false;
    var box = null;

    function readValue() {
      return store ? store.read(key, null) : { status: 'unavailable', value: null };
    }

    function powerUp(value, how) {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = null;
      host.classList.remove('powered-down');
      host.removeAttribute('inert');
      host.removeAttribute('aria-hidden');
      var first = host.querySelector('button:not([disabled]), a[href], input, [tabindex]');
      if (first && typeof first.focus === 'function' && how !== 'persona') first.focus();
      powered = true;
      onReady(value, how);
    }

    function powerDown(status) {
      var title = copy.title || 'no sky yet';
      var note = copy.note;
      var button = copy.button || 'seed a sky to begin';
      if (!note) {
        if (status === 'unavailable') {
          note = 'This part reads the sky kept in this browser, and this browser keeps nothing between visits. A sky seeded here lasts until you leave.';
          button = copy.button || 'seed a sky for now';
        } else if (status === 'unreadable') {
          title = copy.title || 'the saved sky cannot be read';
          note = 'What this browser kept of the sky is not something this part can use. A fresh one replaces it.';
          button = copy.button || 'start a fresh sky';
        } else {
          note = 'This part reads the sky kept in this browser, and there is none yet.';
        }
      }

      unlockCount += 1;
      box = el('div', 'unlock');
      var heading = el('p', 'unlock-title', title);
      heading.id = 'unlock-title-' + unlockCount;
      box.setAttribute('role', 'group');
      box.setAttribute('aria-labelledby', heading.id);
      box.appendChild(heading);
      box.appendChild(el('p', 'unlock-note', note));
      var controls = el('div', 'controls');
      var go = el('button', 'unlock-go btn-filled', button);
      go.type = 'button';
      controls.appendChild(go);
      box.appendChild(controls);
      if (elsewhere && elsewhere.open && persona) {
        var more = el('button', 'unlock-else btn-text', elsewhere.text || 'or open your persona');
        more.type = 'button';
        more.addEventListener('click', function () {
          persona.open(elsewhere.open);
        });
        box.appendChild(more);
      } else if (elsewhere && elsewhere.href) {
        var link = el('a', 'unlock-else', elsewhere.text || elsewhere.href);
        link.href = elsewhere.href;
        box.appendChild(link);
      }

      host.parentNode.insertBefore(box, host);
      host.classList.add('powered-down');
      host.setAttribute('inert', '');
      host.setAttribute('aria-hidden', 'true');
      var wasPowered = powered;
      powered = false;
      if (wasPowered) onPowerDown();

      go.addEventListener('click', function () {
        var value = seed();
        if (isSky && persona) {
          // Written through the persona, which tells every listener -- this one included, below,
          // which is what powers the part up.
          persona.setStars(value, 'seeded');
          return;
        }
        var kept = store ? store.set(key, value) : false;
        powerUp(value, kept ? 'seeded' : 'memory');
      });
    }

    var read = readValue();
    if (read.status === 'ok' && holds(read.value)) {
      powered = true;
      onReady(read.value, 'saved');
    } else if (host && host.parentNode) {
      powerDown(read.status);
    } else {
      onReady(null, 'missing');
      return false;
    }

    // The sky follows the persona: placed, seeded or cleared in the sheet floating over this page,
    // or by a meteor the page itself caught, the part powers up, reloads, or powers down to match.
    if (isSky && persona) {
      persona.onSky(function (list, how, kept) {
        if (!host.parentNode) return;
        if (holds(list)) {
          if (!powered) powerUp(list, how === 'seeded' ? (kept ? 'seeded' : 'memory') : 'persona');
          else onReady(list, 'persona');
        } else if (powered) {
          powerDown(readValue().status);
        }
      });
    }
    return powered;
  }

  /* ---- caution before a destructive action ------------------------------------------------- */
  /* One warning treatment, one modal, one question -- see the header comment and the README
     section "Destructive-caution axiom". No page writes its own confirmation, and nothing on the
     site calls window.confirm: a browser dialog cannot say which of a visitor's things is about
     to go, and a question that reads differently on every page is not a safety switch. */

  var sure = null; // the one modal, built the first time something asks and reused after that
  var asking = null; // the question now on screen: who asked it, and what to do with the answer

  function buildAreYouSure() {
    var host = document.createElement('dialog');
    host.className = 'are-you-sure';
    var title = el('p', 'are-you-sure-title');
    title.id = 'are-you-sure-title';
    host.setAttribute('aria-labelledby', title.id);
    var note = el('p', 'are-you-sure-note');
    var actions = el('div', 'controls are-you-sure-actions');
    var go = el('button', 'warning are-you-sure-go');
    go.type = 'button';
    var no = el('button', 'are-you-sure-no', 'cancel');
    no.type = 'button';
    actions.appendChild(go);
    actions.appendChild(no);
    host.appendChild(title);
    host.appendChild(note);
    host.appendChild(actions);
    (document.body || document.documentElement).appendChild(host);

    go.addEventListener('click', function () { settle(true); });
    no.addEventListener('click', function () { settle(false); });
    // Escape: the browser raises 'cancel' first, and a dismissal means no.
    host.addEventListener('cancel', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      settle(false);
    });
    // Closed any other way the browser offers -- still no, and the caller still hears about it.
    host.addEventListener('close', function () { settle(false); });
    // A press on the backdrop, which is what a dialog owes anyone who opened it by mistake. The
    // dialog element is the target for the backdrop as well as its own padding, so the press has
    // to land outside the box itself.
    host.addEventListener('click', function (ev) {
      if (ev.target !== host) return;
      var box = host.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) {
        settle(false);
      }
    });
    // A browser without dialog.showModal() has no Escape of its own, so it is given one.
    document.addEventListener('keydown', function (ev) {
      if (asking && (ev.key === 'Escape' || ev.key === 'Esc')) settle(false);
    });
    return { host: host, title: title, note: note, go: go, no: no };
  }

  function settle(yes) {
    var answered = asking;
    asking = null; // first, so closing the dialog cannot send the answer twice
    if (!answered) return;
    if (sure.host.open && typeof sure.host.close === 'function') sure.host.close();
    else sure.host.removeAttribute('open');
    sure.host.classList.remove('are-you-sure-fallback');
    var back = answered.opener;
    if (back && typeof back.focus === 'function') back.focus();
    if (yes) answered.onConfirm();
    else answered.onCancel();
  }

  function areYouSure(options) {
    var opts = options || {};
    var onConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : function () {};
    var onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : function () {};
    var what = String(opts.what || '').trim() || 'throw this away';
    if (asking) settle(false); // one question at a time, and an unanswered one means no
    if (!sure) sure = buildAreYouSure();
    sure.title.textContent = 'are you sure you want to ' + what + '?';
    sure.note.textContent = opts.detail || '';
    sure.note.hidden = !opts.detail;
    sure.go.textContent = String(opts.confirm || '').trim() || ('yes, ' + what);
    asking = {
      onConfirm: onConfirm,
      onCancel: onCancel,
      opener: opts.opener || document.activeElement
    };
    // The nav's lightbox may have put this dialog aside with the rest of the body -- it is a child
    // of it, built the first time anything asks, which may well be before the menu was ever
    // opened -- and the state interface asks from inside that lightbox now (issue #66). A modal
    // dialog inerts the page by itself, so the marks come off here rather than being worked
    // around there: a question nobody can answer is worse than no question. aside() gives back
    // only what it took, so nothing of its bookkeeping is disturbed by this.
    sure.host.removeAttribute('inert');
    sure.host.removeAttribute('aria-hidden');
    if (typeof sure.host.showModal === 'function') {
      sure.host.showModal();
    } else {
      sure.host.setAttribute('open', '');
      sure.host.classList.add('are-you-sure-fallback');
    }
    // Cancel, not confirm: the one press a visitor who got here by mistake should be one key away
    // from is the one that changes nothing.
    sure.no.focus();
  }

  function destructive(control, options) {
    var opts = options || {};
    if (!control) return function () {};
    control.classList.add('warning');

    function pressed() {
      var when = typeof opts.when === 'function' ? opts.when : function () { return true; };
      if (!when()) {
        // Nothing of the visitor's is about to go, so there is nothing to ask: an empty drawer
        // emptied again takes nothing away, and the control says so in the page's own words.
        if (typeof opts.onConfirm === 'function') opts.onConfirm();
        return;
      }
      areYouSure({
        what: opts.what,
        detail: typeof opts.detail === 'function' ? opts.detail() : opts.detail,
        confirm: opts.confirm || (control.textContent || '').trim(),
        onConfirm: opts.onConfirm,
        onCancel: opts.onCancel,
        opener: control
      });
    }

    control.addEventListener('click', pressed);
    return function () {
      control.removeEventListener('click', pressed);
      control.classList.remove('warning');
    };
  }

  function retireOldKeys() {
    if (!store || typeof store.keys !== 'function') return;
    var kept = store.keys();
    for (var i = 0; i < RETIRED_KEYS.length; i++) {
      if (kept.indexOf(RETIRED_KEYS[i]) !== -1) store.remove(RETIRED_KEYS[i]);
    }
  }

  // Every slider says how full it is, so the M3 track can paint up to the handle.
  function fillRange(input) {
    var min = Number(input.min === '' ? 0 : input.min);
    var max = Number(input.max === '' ? 100 : input.max);
    var value = Number(input.value);
    var pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-pct', Math.max(0, Math.min(100, pct)).toFixed(2) + '%');
  }

  var fillPending = false;

  function fillAllRanges() {
    fillPending = false;
    var all = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < all.length; i++) fillRange(all[i]);
  }

  function fillSoon() {
    if (fillPending) return;
    fillPending = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(fillAllRanges);
    else fillAllRanges();
  }

  function watchRanges() {
    document.addEventListener('input', function (ev) {
      if (ev.target && ev.target.type === 'range') fillRange(ev.target);
    });
    // A button may move a slider without an input event (the 404 page's scan does), and a
    // mechanism may put a new one on the page: either way, everything is re-read on the next frame.
    document.addEventListener('click', fillSoon);
    if (window.MutationObserver) {
      new MutationObserver(fillSoon).observe(document.body, { childList: true, subtree: true });
    }
    fillAllRanges();
  }

  /* ------------------------------------------------------------------------------------------- */
  /* The main nav: the sparkles logo in the upper left, and the constellation it opens.

     The markup is in _includes/layout.njk and the look is in _sass/_nav.scss. What is left for a
     script is the five things neither of those can do:

       place()   where the stars go. Only something that can count the options knows that, and the
                 set changes with the visitor's state, so the geometry is worked out here and
                 handed to the stylesheet as --x, --y, --len and --a on each option: where the
                 chip sits, and the ray that reaches it from the logo's heart. The stars fall down
                 the left edge in even steps, each pushed out sideways by its own amount so the
                 set reads as a scatter rather than a list, and the second orbit takes a column of
                 its own as soon as there is room for one.
       aside()   the lightbox. The veil dims and blurs everything behind the constellation and
                 takes the press that closes it again (that much is markup and Sass); here every
                 other child of the body is made inert and hidden from a screen reader, so nothing
                 behind the veil can be reached by pointer or by keyboard while it is up.
       hold()    the page's motion. Every animated page on this site runs its own frame loop -- a
                 world's canvas, the feed's cards -- and CSS can pause an animation but not a
                 loop, so the loop is held: a frame asked for while the constellation is open is
                 kept and run when it closes. Nothing is dropped and no page has to know.
       shape()   the options that come and go. The world a reading opens onto is only there once
                 something has been read, and "cookies" and "state" are only there while the files
                 that own them have drawn their own buttons -- which this then hides, and answers
                 for on the constellation's behalf. js/analytics.js and js/state.js are fixed files
                 (see FIXED_FILES in .github/scripts/make_interesting.py) and neither is edited
                 for any of it: the shell adopts what they drew instead.
       stateModal()
                 the state interface, taking the lightbox over (issue #66). "state" is the one
                 option that is not a destination and not someone else's dialog: it is a thing to
                 do, here, with the whole screen. So the lightbox does not come down for it. The
                 constellation gives way, js/state.js's own panel is moved into the middle of the
                 veil that is already up, and closing the panel closes the lightbox with it and
                 gives the visitor back the page. Nothing the lightbox is made of -- the veil, the
                 held frame loop, the inert page, <html data-lightbox> -- is torn down and raised
                 again in between, which is what "zero jitter" asks for.

     Pressing the logo never navigates. The threshold is the home icon in the near orbit, which is
     what issue #54 asks for, and it is also what lets the logo be a <details> summary -- so the
     disclosure, the keyboard handling and the no-script fallback are the browser's own. */

  // The two buttons the fixed files pin to the corners, which the constellation adopts. Named
  // here, and nowhere else in the site's own files: the shell may find them, hide them and press
  // them, and nothing may restyle them or reproduce their words.
  var CORNER_COOKIES = '.site-consent-link'; // js/analytics.js draws it, bottom-left
  var CORNER_STATE = '.site-meta-open'; // js/state.js draws it, bottom-right
  var STATE_PANEL = 'site-meta-panel'; // and the panel that button opens, which it names

  var STAR_STEP = 56; // the drop from one star to the next, in CSS pixels
  var STAR_STEP_MIN = 48; // never closer than this, or two chips would touch
  var STAR_EDGE = 14; // how far the first column sits from the logo's left edge
  var STAR_COLUMN = 208; // the least a column may advance, before any chip has been measured
  var STAR_GUTTER = 24; // the clear space between one column of chips and the next
  var STAR_SPREAD = 26; // how far out sideways a star may be pushed by its place in the order
  // How far each star is pushed, by its place in the order: an irregular walk rather than a zigzag,
  // so a constellation looks scattered however many stars are in it.
  var STAR_SCATTER = [0, 0.78, 0.26, 1.12, 0.52, 1.3, 0.12, 0.94, 0.66, 1.18];
  var TWO_COLUMN_WIDTH = 600; // the narrowest viewport that gets a column per orbit
  var CADRE_WAIT_MS = 15000; // how long to watch for the corner buttons before giving up

  var nav = null;

  /* ---- the page's frame loop, held while the lightbox is up -------------------------------- */

  var frameHeld = false;
  var frameQueue = []; // [{ id, fn }], the frames asked for while the constellation is open
  var frameId = 0; // counts down, so a held handle can never be mistaken for a real one
  var nativeFrame = window.requestAnimationFrame;
  var nativeCancel = window.cancelAnimationFrame;
  // A safety valve: if something asks for frames in a way holding cannot survive, let go of them
  // all rather than grow without end.
  var MAX_HELD_FRAMES = 240;

  function flushFrames() {
    var waiting = frameQueue;
    frameQueue = [];
    var now = window.performance && window.performance.now
      ? window.performance.now() : new Date().getTime();
    for (var i = 0; i < waiting.length; i++) {
      try {
        waiting[i].fn(now);
      } catch (e) {
        /* a page's own loop, and not this one's to repair */
      }
    }
  }

  function hold(on) {
    if (!nativeFrame || on === frameHeld) return;
    frameHeld = on;
    if (!on) flushFrames();
  }

  // Installed on the first press of the logo, so a visitor who never opens it runs on untouched
  // globals, and a pass-through whenever nothing is being held.
  function installHold() {
    if (!nativeFrame || window.requestAnimationFrame !== nativeFrame) return;
    window.requestAnimationFrame = function (fn) {
      if (!frameHeld || typeof fn !== 'function') return nativeFrame.call(window, fn);
      if (frameQueue.length >= MAX_HELD_FRAMES) {
        hold(false);
        return nativeFrame.call(window, fn);
      }
      frameId -= 1;
      frameQueue.push({ id: frameId, fn: fn });
      return frameId;
    };
    window.cancelAnimationFrame = function (id) {
      if (id < 0) {
        for (var i = 0; i < frameQueue.length; i++) {
          if (frameQueue[i].id === id) {
            frameQueue.splice(i, 1);
            return;
          }
        }
        return;
      }
      if (nativeCancel) nativeCancel.call(window, id);
    };
  }

  /* ---- the lightbox ----------------------------------------------------------------------- */

  /* Everything but the constellation, put aside while it is open: inert, so no pointer and no
     Tab reaches it, and hidden from a screen reader, so the menu is all there is to read. Anything
     already inert or already hidden for its own reasons is left exactly as it is -- the consent
     library hides its own markup that way -- and only what this put aside is brought back. */
  function aside(on) {
    var kids = document.body ? document.body.children : [];
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node === nav.host) continue;
      if (on) {
        if (node.hasAttribute('inert') || node.hasAttribute('aria-hidden')) continue;
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('data-nav-aside', '');
      } else if (node.hasAttribute('data-nav-aside')) {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
        node.removeAttribute('data-nav-aside');
      }
    }
  }

  /* ---- where the stars go ----------------------------------------------------------------- */

  function shownOptions(orbit) {
    var all = orbit.querySelectorAll('.sparknav-option');
    var shown = [];
    for (var i = 0; i < all.length; i++) {
      if (!all[i].hidden) shown.push(all[i]);
    }
    return shown;
  }

  // One star: the chip at (x, y), and the ray from the logo's heart to the middle of its left edge.
  function star(option, x, y, mid, order) {
    var node = option.querySelector('.sparknav-node');
    var middle = y + ((node && node.offsetHeight) || STAR_STEP_MIN) / 2;
    var dx = x - mid;
    var dy = middle - mid;
    var style = option.style;
    style.setProperty('--x', Math.round(x) + 'px');
    style.setProperty('--y', Math.round(y) + 'px');
    style.setProperty('--mx', mid + 'px');
    style.setProperty('--my', mid + 'px');
    style.setProperty('--len', Math.round(Math.sqrt(dx * dx + dy * dy)) + 'px');
    style.setProperty('--a', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg');
    style.setProperty('--k', String(order));
    // Where the chip starts from when it branches out: most of the way back to the logo.
    style.setProperty('--fx', Math.round(-dx * 0.55) + 'px');
    style.setProperty('--fy', Math.round(-dy * 0.55) + 'px');
  }

  // The widest chip of an orbit, or 0 while the constellation has never been open: a chip that is
  // not rendered has no width, and the constants below stand in until one has been.
  function widestIn(options) {
    var widest = 0;
    for (var i = 0; i < options.length; i++) {
      var node = options[i].querySelector('.sparknav-node');
      if (node) widest = Math.max(widest, node.offsetWidth);
    }
    return widest;
  }

  function place() {
    // Nothing to place while the state interface has the lightbox: the constellation is not on
    // screen to be measured, and it is shaped again on the next press either way.
    if (!nav || nav.sky.hidden) return;
    var mid = Math.max(18, Math.round(nav.logo.offsetHeight / 2));
    var groups = [];
    var widths = [];
    var counted = 0;
    for (var g = 0; g < nav.orbits.length; g++) {
      var shown = shownOptions(nav.orbits[g]);
      if (shown.length) {
        groups.push(shown);
        widths.push(widestIn(shown));
        counted += shown.length;
      }
    }
    if (!groups.length) return;
    var top = mid + 22; // clear of the logo itself
    var room = Math.max(120, (window.innerHeight || 700) - top - 60);
    var wide = (window.innerWidth || 1024) >= TWO_COLUMN_WIDTH;
    // A column per orbit as soon as the screen is wide enough for one -- and also when one column
    // would not fit the viewport, where the columns are the only thing that makes it fit.
    var columns = groups.length > 1 && (wide || room < counted * STAR_STEP_MIN) ? groups.length : 1;
    // Where each column starts: after the widest chip of the one before it, so a long label
    // ("go to the apocrypha desk") cannot land on top of the column beside it.
    var lefts = [STAR_EDGE];
    for (g = 1; g < groups.length; g++) {
      lefts.push(lefts[g - 1]
        + Math.max(STAR_COLUMN, widths[g - 1] + STAR_SPREAD + STAR_GUTTER));
    }
    // And one column after all, if the last of them would run off the right-hand edge.
    var last = groups.length - 1;
    if (columns > 1 && widths[last]
        && lefts[last] + STAR_SPREAD + widths[last] + 16 > (window.innerWidth || 1024)) {
      columns = 1;
    }
    // The longest column decides the step, so every orbit falls at the same rhythm.
    var longest = counted;
    if (columns > 1) {
      longest = 0;
      for (g = 0; g < groups.length; g++) longest = Math.max(longest, groups[g].length);
    }
    var step = longest > 1
      ? Math.max(STAR_STEP_MIN, Math.min(STAR_STEP, room / (longest - 1))) : STAR_STEP;
    var order = 0;
    var y = top;
    var deepest = top;
    for (g = 0; g < groups.length; g++) {
      var x0 = STAR_EDGE;
      if (columns > 1) {
        x0 = lefts[g];
        y = top + (g % 2) * step * 0.45; // the columns interleave rather than line up
      }
      for (var i = 0; i < groups[g].length; i++, order++) {
        star(groups[g][i], x0 + STAR_SCATTER[order % STAR_SCATTER.length] * STAR_SPREAD,
          y + i * step, mid, order);
        deepest = Math.max(deepest, y + i * step);
      }
      if (columns === 1) y += groups[g].length * step; // the next orbit carries on below
    }
    // And if the lowest star would still be below the fold -- a very short viewport, or a very
    // long list of options -- the cascade is what fits: the stylesheet's other layout, a list
    // under the logo that scrolls, which is also what the markup is without a script at all.
    var fits = deepest + STAR_STEP_MIN + mid + 16 <= (window.innerHeight || 700);
    html.setAttribute('data-nav', fits ? 'live' : 'cascade');
  }

  /* ---- the options that come and go -------------------------------------------------------- */

  // What the mood flow has read of this visitor, or null: the same test js/persona.js makes.
  function readingWorld() {
    var flow = window.threshold;
    if (!flow || typeof flow.reading !== 'function') return null;
    var read = null;
    try {
      read = flow.reading();
    } catch (e) {
      return null;
    }
    if (!read || !read.orientation || !read.source || read.source === 'signals') return null;
    return read.orientation;
  }

  /* The two corner affordances, adopted. Each one is hidden where its own file pinned it and
     offered in the constellation instead, so there is still exactly one cookies dialog and one
     state menu on the site -- and the option is only there while the button is, which is why a
     copy of the site with no measurement id (and so no consent banner) simply has no cookies
     option. Neither file is edited for any of it: the constellation presses the consent banner's
     own button, and asks js/state.js for its own panel (see stateModal below). */
  function adopt() {
    nav.cookiesCorner = document.querySelector(CORNER_COOKIES);
    nav.stateCorner = document.querySelector(CORNER_STATE);
    if (nav.cookiesCorner) nav.cookiesCorner.hidden = true;
    if (nav.stateCorner) nav.stateCorner.hidden = true;
    nav.cookies.hidden = !nav.cookiesCorner;
    nav.state.hidden = !nav.stateCorner;
  }

  function shape() {
    if (!nav) return;
    var world = readingWorld();
    if (world && world.world && nav.readingGo) {
      var here = html.getAttribute('data-page') === world.world;
      nav.readingGo.href = root + world.world;
      // On the world itself the option says where the visitor is, rather than offering them a
      // trip to where they already are.
      nav.readingLabel.textContent = here ? world.worldName : 'go to ' + world.worldName;
      if (here) nav.readingGo.setAttribute('aria-current', 'page');
      else nav.readingGo.removeAttribute('aria-current');
      nav.reading.hidden = false;
    } else if (nav.reading) {
      nav.reading.hidden = true;
    }
    adopt();
    // How much of the visitor's own there is to carry away, which is the one thing about the state
    // worth saying before it is opened.
    if (nav.stateLabel) {
      var kept = store && typeof store.keys === 'function' ? store.keys().length : 0;
      nav.stateLabel.textContent = kept ? 'state · ' + kept + ' kept' : 'state';
    }
    place();
  }

  /* ---- opening and closing ---------------------------------------------------------------- */

  /* The lightbox, up and down. Idempotent on purpose, because two things call it: the <details>
     element's own toggle event, and close() below -- a browser fires `toggle` in a task of its
     own, which is a moment too late for anything that has to happen before the next line runs. */
  function lightbox(on) {
    nav.logo.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) {
      installHold();
      shape();
      aside(true);
      hold(true);
      html.setAttribute('data-lightbox', 'nav');
      // The branch starts over on every press: a browser that keeps a closed <details> rendered
      // would otherwise have run the animation once and left it there.
      nav.sky.classList.remove('is-branching');
      void nav.sky.offsetWidth;
      nav.sky.classList.add('is-branching');
    } else {
      // Whatever the lightbox was holding goes with it: the state interface back to its corner,
      // the constellation back on screen for the next press.
      stateModal(false);
      html.removeAttribute('data-lightbox');
      hold(false);
      aside(false);
      nav.sky.classList.remove('is-branching');
    }
  }

  /* Closing it, and giving the page straight back: the <details> closes, and the lightbox comes
     down now rather than in the task the toggle event is queued in -- an adopted dialog opening
     on the next line has to find the page live, not inert. */
  function close(focusLogo) {
    if (nav.host.open) nav.host.open = false;
    lightbox(false);
    if (focusLogo && typeof nav.logo.focus === 'function') nav.logo.focus();
  }

  /* ---- the state interface, taking the lightbox over -------------------------------------- */

  /* "state" is the one option in the constellation that is neither a destination nor somebody
     else's dialog: it is a thing to do, and issue #66 asks for it to have the screen while it is
     being done. So the lightbox stays exactly as it is -- veil up, page inert and still, frame
     loop held -- the constellation gives way, and js/state.js's own panel is moved into the middle
     of it. There is no way back to the constellation: closing the panel closes the lightbox, which
     is what "return to the site" means.

     The panel is the fixed file's, and asking for it is all that happens here (see "Presented
     somewhere else" in js/state.js). A store too old to offer one, or a shell written without the
     host to put it in, falls back to what the constellation did before: get out of the way and
     press the corner button -- which is what stateModal(true) saying false means. Taking it down
     tidies up either way, because an empty host left on screen is an invisible layer over the
     page. */
  var stateHosted = null; // the function that gives the panel back, while it is being hosted

  function hostedStateMenu() {
    var menu = store && store.menu;
    return menu && typeof menu.present === 'function' ? menu : null;
  }

  function stateModal(on) {
    if (on) {
      var menu = hostedStateMenu();
      if (!nav.modal || !menu) return false;
      // The host is on screen before the panel arrives in it, because nothing inside a hidden box
      // can take the focus and the panel puts the focus in its own text as it opens.
      nav.modal.hidden = false;
      var release = menu.present(nav.modal);
      if (!release) {
        nav.modal.hidden = true;
        return false;
      }
      stateHosted = release;
      // The attribute is set, never cleared and set again: every rule keyed on the lightbox being
      // up stays matched through the swap, so nothing behind the veil so much as blinks.
      html.setAttribute('data-lightbox', 'state');
      nav.sky.hidden = true;
      nav.sky.classList.remove('is-branching');
      whenThePanelCloses(menu.panel, function () {
        // However it closed -- its own "close", Escape, a press on the dimmed page around it --
        // the lightbox goes down with it and the visitor is back where they were.
        if (stateHosted) close(true);
      });
      return true;
    }
    if (stateHosted) {
      var giveItBack = stateHosted;
      stateHosted = null; // first, so the watcher above knows this close is not a visitor's
      giveItBack();
    }
    // Put away whether anything was being hosted or not: an empty host left on screen would be an
    // invisible layer over the page, swallowing every press on it.
    if (nav.modal) nav.modal.hidden = true;
    nav.sky.hidden = false;
  }

  /* The state interface closes itself, in all the ways a dialog can be closed, and hands the focus
     back to its own button -- the one the shell has hidden, where a keyboard would land nowhere.
     So the shell watches the panel's `hidden` attribute and answers for the closing. Nothing of
     the menu is touched to arrange it; this only watches. */
  function whenThePanelCloses(panel, then) {
    if (!panel || !window.MutationObserver) return;
    var watch = new MutationObserver(function () {
      if (!panel.hidden) return;
      watch.disconnect();
      then();
    });
    watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  }

  // The chips, the logo included, in the order a Tab walks them -- and the state interface's own
  // controls while it is the thing the lightbox is holding, its text box included, because a
  // keyboard trapped in a modal has to be able to reach all of it.
  function navFocusable() {
    var all = nav.host.querySelectorAll(
      'summary, a[href], button:not([disabled]), textarea:not([disabled])');
    var reachable = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].offsetWidth || all[i].offsetHeight) reachable.push(all[i]);
    }
    return reachable;
  }

  function keepFocusInside(event) {
    if (event.key !== 'Tab') return;
    var stars = navFocusable();
    if (!stars.length) return;
    var first = stars[0];
    var last = stars[stars.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function buildNav() {
    var host = document.getElementById('sparknav');
    if (!host) return;
    nav = {
      host: host,
      logo: document.getElementById('sparknav-logo'),
      veil: document.getElementById('sparknav-veil'),
      sky: host.querySelector('.sparknav-sky'),
      orbits: host.querySelectorAll('.sparknav-orbit'),
      reading: document.getElementById('sparknav-reading'),
      readingGo: document.getElementById('sparknav-reading-go'),
      readingLabel: document.getElementById('sparknav-reading-label'),
      cookies: document.getElementById('sparknav-cookies'),
      cookiesOpen: document.getElementById('sparknav-cookies-open'),
      state: document.getElementById('sparknav-state'),
      stateOpen: document.getElementById('sparknav-state-open'),
      stateLabel: document.getElementById('sparknav-state-label'),
      // Where the state interface is hosted, in the middle of the lightbox. Not required: a shell
      // written without it still has the corner menu to fall back on.
      modal: document.getElementById('sparknav-modal')
    };
    if (!nav.logo || !nav.sky || !nav.orbits.length || !nav.cookiesOpen || !nav.stateOpen) {
      nav = null;
      return;
    }

    nav.host.addEventListener('toggle', function () {
      lightbox(nav.host.open);
    });
    nav.logo.setAttribute('aria-expanded', nav.host.open ? 'true' : 'false');

    // A press on the veil is a press on the page behind it, which is a way of saying "not this".
    nav.veil.addEventListener('click', function () {
      close(true);
    });

    // A destination closes the menu on its way out, so a link to the page the visitor is already
    // on does not leave the constellation hanging open over it.
    nav.sky.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== nav.sky && node.tagName !== 'A') node = node.parentNode;
      if (node && node.tagName === 'A') close(false);
    });

    nav.cookiesOpen.addEventListener('click', function () {
      // The constellation gets out of the way first, and the focus goes to the logo rather than
      // to the chip it is taking with it: this dialog is the consent library's own, drawn where
      // its own file draws it, and that library hands the focus back to whatever had it when the
      // dialog opened. ("state" is the other way about -- see stateModal above -- because it is
      // this site's own interface rather than a vendored library's.)
      close(true);
      if (nav.cookiesCorner) nav.cookiesCorner.click();
    });

    nav.stateOpen.addEventListener('click', function () {
      // The lightbox is not dropped and raised again: it stays up, and the state interface takes
      // the constellation's place inside it (issue #66).
      if (stateModal(true)) return;
      // Nothing to host it with, so the corner menu, as it was before: out of the way first,
      // because a panel pinned to a live page has to find the page live.
      close(true);
      if (!nav.stateCorner) return;
      whenThePanelCloses(document.getElementById(STATE_PANEL), function () {
        if (typeof nav.logo.focus === 'function') nav.logo.focus();
      });
      nav.stateCorner.click();
    });

    // A press on the dimmed page around the state interface is a press on the page: the same
    // "not this" the veil takes, which the host covers while it is up.
    if (nav.modal) {
      nav.modal.addEventListener('click', function (event) {
        if (event.target === nav.modal) close(true);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (!nav.host.open) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        // A question floating over the lightbox answers Escape itself: dismissing "are you sure
        // you want to clear everything?" is not dismissing the interface that asked it.
        if (asking) return;
        close(true);
        return;
      }
      keepFocusInside(event);
    });

    // The set of options follows the state: a reading taken or forgotten anywhere on the page, and
    // the two corner buttons, which arrive whenever the files that draw them are ready.
    window.addEventListener('threshold:reading', shape);
    window.addEventListener('persona:sky', shape);
    window.addEventListener('resize', place);
    watchForCorners();
    shape();
  }

  /* The consent banner draws its button only once the library beside it has loaded, so the
     constellation cannot simply look once. It watches until both corner buttons have been adopted,
     and gives up after a while: on a copy of the site with no measurement id the cookies button
     never arrives at all, and nothing should wait for it forever. */
  function watchForCorners() {
    if (!window.MutationObserver || !document.body) return;
    var watch = new MutationObserver(function () {
      // Every page of this site mutates while it is read -- the feed deals cards without end --
      // so the work only happens when one of the two buttons has actually come or gone.
      if (document.querySelector(CORNER_COOKIES) === nav.cookiesCorner
          && document.querySelector(CORNER_STATE) === nav.stateCorner) return;
      shape();
      if (nav.host.open) aside(true); // a button drawn while the lightbox is up belongs behind it
      if (nav.cookiesCorner && nav.stateCorner) watch.disconnect();
    });
    watch.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () {
      watch.disconnect();
    }, CADRE_WAIT_MS);
  }

  window.interestingSite = {
    unlock: unlock,
    destructive: destructive,
    areYouSure: areYouSure,
    seedSky: seedSky,
    holdsSky: holdsSky,
    root: root,
    skyKey: SKY
  };

  function start() {
    retireOldKeys();
    buildNav();
    watchRanges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
