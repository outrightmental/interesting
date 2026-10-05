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

  Two small pieces of the shell live here as well, because the shell is markup and Sass and needs
  a hand with two things only a script can know: whether the page has scrolled under the top app
  bar (which then takes its tonal lift, .is-scrolled, as an M3 top app bar does), and how full
  each slider is (the M3 slider paints its active track in the primary colour up to the handle,
  which CSS can only do when --range-pct says where the handle is), and the aspect ratio of each
  world's stage (so the feature can size it by the height of the first screen).

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
  var root = document.documentElement.getAttribute('data-root') || '';
  var SKY = persona ? persona.key : 'constellation';

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

  // The top app bar lifts once the page has scrolled under it.
  function watchTopBar() {
    var bar = document.getElementById('top-bar');
    if (!bar) return;
    var scrolled = null;
    function check() {
      var now = (window.scrollY || document.documentElement.scrollTop || 0) > 8;
      if (now === scrolled) return;
      scrolled = now;
      bar.classList.toggle('is-scrolled', now);
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
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

  // A world's stage -- the canvas beside its panel -- fills the first screen, so it is sized by the
  // viewport's height as well as its column's width. CSS can hold both only if it knows the
  // stage's aspect ratio, which is read off the canvas's own width and height here.
  function stageRatios() {
    var stages = document.querySelectorAll('.layout > canvas, .top > canvas');
    for (var i = 0; i < stages.length; i++) {
      var w = Number(stages[i].getAttribute('width')) || stages[i].width;
      var h = Number(stages[i].getAttribute('height')) || stages[i].height;
      if (w > 0 && h > 0) stages[i].style.setProperty('--stage-ratio', (w / h).toFixed(4));
    }
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
    watchTopBar();
    watchRanges();
    stageRatios();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
