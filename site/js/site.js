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

  Nothing in here keeps score, routes a visitor, or writes to the shared state document except the
  sky a visitor asks it to seed, which it does through the persona: the shell's job is to be
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
      var go = el('button', 'unlock-go', button);
      go.type = 'button';
      controls.appendChild(go);
      box.appendChild(controls);
      if (elsewhere && elsewhere.open && persona) {
        var more = el('button', 'unlock-else', elsewhere.text || 'or open your persona');
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

  window.interestingSite = {
    unlock: unlock,
    seedSky: seedSky,
    holdsSky: holdsSky,
    root: root,
    skyKey: SKY
  };

  function start() {
    retireOldKeys();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
