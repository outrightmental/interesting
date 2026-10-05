/*
  The shared helpers every page can call, loaded by _includes/layout.njk without `defer` so they
  exist while a page's own script runs, exactly as window.interestingState and
  window.interestingPersona do.

      window.interestingSite.unlock(host, options)   a part that needs something the browser does
                                                      not hold yet, rendered as powered down with
                                                      the one button that powers it (see below)
      window.interestingSite.root                     '' on every page but the 404, where the
                                                      site's root has to be spelled out
      window.interestingSite.seedSky(), .holdsSky(), .skyKey
                                                      the persona's own (js/persona.js), kept here
                                                      under the names pages used before it existed

  Pieces of the shell live here as well, because the shell is markup and Sass and needs a hand
  with the things only a script can know: the main nav -- the sparkles logo, the lightbox it opens
  and the constellation of options it branches out, which is the long section at the bottom of
  this file -- how full each slider is (the M3 slider paints its active track in the primary
  colour up to the handle, which CSS can only do when --range-pct says where the handle is), and
  the aspect ratio of each world's stage (so the feature can size it by the height of the first
  screen).

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

  /* ------------------------------------------------------------------------------------------- */
  /* The main nav: the sparkles logo in the upper left, and the constellation it opens.

     The markup is in _includes/layout.njk and the look is in _sass/_nav.scss. What is left for a
     script is the four things neither of those can do:

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
                 that own them have drawn their own buttons -- which this then hides, and presses
                 on the constellation's behalf. js/analytics.js and js/state.js are fixed files
                 (see FIXED_FILES in .github/scripts/make_interesting.py) and neither is edited
                 for any of it: the shell adopts what they drew instead.

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
    if (!nav) return;
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
     option. The files behind them are never edited: the constellation presses their buttons. */
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

  /* The state menu hands the focus back to its own button when it closes -- the one the shell has
     hidden, where a keyboard would land nowhere -- so the logo takes it instead, as soon as the
     panel is away. Nothing of the menu is touched to arrange it; this only watches. */
  function giveTheLogoTheFocusBack(panel) {
    if (!panel || !window.MutationObserver) return;
    var watch = new MutationObserver(function () {
      if (!panel.hidden) return;
      watch.disconnect();
      if (typeof nav.logo.focus === 'function') nav.logo.focus();
    });
    watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  }

  // The chips, the logo included, in the order a Tab walks them.
  function navFocusable() {
    var all = nav.host.querySelectorAll('summary, a[href], button:not([disabled])');
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
      stateLabel: document.getElementById('sparknav-state-label')
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
      // to the chip it is taking with it: both dialogs are the corner affordances' own, drawn
      // where their own files draw them, and the consent library hands the focus back to whatever
      // had it when its dialog opened.
      close(true);
      if (nav.cookiesCorner) nav.cookiesCorner.click();
    });

    nav.stateOpen.addEventListener('click', function () {
      close(true);
      if (!nav.stateCorner) return;
      giveTheLogoTheFocusBack(document.getElementById(STATE_PANEL));
      nav.stateCorner.click();
    });

    document.addEventListener('keydown', function (event) {
      if (!nav.host.open) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
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
    seedSky: seedSky,
    holdsSky: holdsSky,
    root: root,
    skyKey: SKY
  };

  function start() {
    retireOldKeys();
    buildNav();
    watchRanges();
    stageRatios();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
