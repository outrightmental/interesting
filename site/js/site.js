/*
  The shared helpers every page can call, loaded by _includes/layout.njk without `defer` so they
  exist while a page's own script runs, exactly as window.interestingState does.

      window.interestingSite.unlock(host, options)   a part that needs something the browser does
                                                      not hold yet, rendered as powered down with
                                                      the one button that powers it (see below)
      window.interestingSite.seedSky()                a small random sky, the shape the wish
                                                      constellation saves
      window.interestingSite.root                     '' on every page but the 404, where the
                                                      site's root has to be spelled out

  Nothing in here keeps score, routes a visitor, or writes to the shared state document except
  the sky a visitor asks it to seed: the shell's job is to be understood in one reading and get
  out of the way. What it draws on the page is the one "send me somewhere" button in the index of
  every world, and nothing else.

  ---------------------------------------------------------------------------------------------
  Powered down, never broken

  Wherever a component depends on something the visitor has not done yet, its only announcement
  of that is the solution, in place. A world that reads the saved sky never says "make one on the
  wish constellation page first": it presents as unpowered -- dimmed and inert, like the part of
  an adventure game whose generator is off -- and carries the one button that starts it, which
  does the prerequisite itself, in the background, writing to the shared document exactly as the
  visitor's own action would. A quieter link to the page where it usually happens may follow the
  button; it never replaces it. The README section of the same name has the reasoning.

      var ready = window.interestingSite.unlock(document.querySelector('.layout'), {
        onReady: function (stars, how) { loadStars(); }   // now if a sky exists, else on press
      });

  options, all optional:
    key        the state name the part depends on; 'constellation' (the sky) by default
    holds      function (value) -> boolean: is the value enough? By default: a non-empty array
               of { x, y, text } stars
    seed       function () -> value to write when the button is pressed; by default seedSky()
    onReady    function (value, how): called now with how 'saved' if the value is already there,
               or after the press with 'seeded' (written to the browser) or 'memory' (written,
               but this browser keeps nothing between visits)
    copy       { title, note, button } to override the words, for a prerequisite other than the sky
    elsewhere  { href, text } for the quiet second choice; null for none; the wish constellation
               by default

  It returns true when the part was ready at once, false when it rendered the unpowered state.
  The host keeps its children: they are dimmed by _sass/_unlock.scss and made inert, and the
  unlock box is put in front of the host, so the button is the first thing in reading order. The
  axiom applies when the prerequisite cannot be kept, too: a browser that stores nothing still
  gets the button, and the sky it seeds lasts for the page.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var root = document.documentElement.getAttribute('data-root') || '';
  var SKY = 'constellation';
  var MAX_STARS = 120;
  var SEED_COUNT = 7;

  // What a seeded star says when a world reads it out. Short, lowercase, the site's own voice.
  var SEED_THOUGHTS = [
    'a door left ajar', 'the kettle, just off the boil', 'rain arriving sideways',
    'a lamp in a window across the way', 'an unanswered letter, kept', 'moss on the north side',
    'a tune with the middle missing', 'the long way home', 'one more look up',
    'a stone kept for no reason', 'a page half-turned', 'a machine running with nobody watching',
    'the tree in the courtyard, doing fine', 'a name nearly said', 'the smell before rain'
  ];

  // The names the shell used to keep for games that are gone: relay marks, quests, honors,
  // signals, a switchboard, a logbook, a cipher, a remix snapshot and a trail. Taken out of a
  // visitor's document once, so an exported state stays an honest account of what the site keeps.
  var RETIRED_KEYS = [
    'constellation-relay', 'constellation-quests', 'constellation-signals',
    'constellation-switchboard', 'constellation-logbook', 'constellation-cipher',
    'constellation-remix-snapshot', 'trail-journal'
  ];

  function validStar(s) {
    return !!s && typeof s === 'object' && typeof s.x === 'number' && typeof s.y === 'number'
      && isFinite(s.x) && isFinite(s.y) && typeof s.text === 'string';
  }

  function holdsSky(value) {
    return Array.isArray(value) && value.some(validStar);
  }

  /* A fresh sky: `count` stars spread around the middle of the field rather than clumped, in the
     0-100 space every sky world reads (the wish constellation keeps them as vw and vh). */
  function seedSky(count) {
    var n = Math.max(1, Math.min(MAX_STARS, count || SEED_COUNT));
    var stars = [];
    var start = Math.floor(Math.random() * SEED_THOUGHTS.length);
    for (var i = 0; i < n; i++) {
      var angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      var radius = 14 + Math.random() * 24;
      stars.push({
        x: Number(Math.min(92, Math.max(8, 50 + Math.cos(angle) * radius)).toFixed(2)),
        y: Number(Math.min(86, Math.max(12, 48 + Math.sin(angle) * radius * 0.8)).toFixed(2)),
        text: SEED_THOUGHTS[(start + i) % SEED_THOUGHTS.length]
      });
    }
    return stars;
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
    var holds = typeof opts.holds === 'function' ? opts.holds : holdsSky;
    var seed = typeof opts.seed === 'function' ? opts.seed : seedSky;
    var onReady = typeof opts.onReady === 'function' ? opts.onReady : function () {};
    var read = store ? store.read(key, null) : { status: 'unavailable', value: null };

    if (read.status === 'ok' && holds(read.value)) {
      onReady(read.value, 'saved');
      return true;
    }
    if (!host || !host.parentNode) {
      onReady(null, 'missing');
      return false;
    }

    var copy = opts.copy || {};
    var title = copy.title || 'no sky yet';
    var note = copy.note;
    var button = copy.button || 'seed a sky to begin';
    if (!note) {
      if (read.status === 'unavailable') {
        note = 'This part reads the sky kept in this browser, and this browser keeps nothing between visits. A sky seeded here lasts until you leave.';
        button = copy.button || 'seed a sky for now';
      } else if (read.status === 'unreadable') {
        title = copy.title || 'the saved sky cannot be read';
        note = 'What this browser kept of the sky is not something this part can use. A fresh one replaces it.';
        button = copy.button || 'start a fresh sky';
      } else {
        note = 'This part reads the sky kept in this browser, and there is none yet.';
      }
    }
    var elsewhere = 'elsewhere' in opts ? opts.elsewhere
      : { href: root + 'wish-constellation.html', text: 'or place your own stars in the wish constellation' };

    unlockCount += 1;
    var box = el('div', 'unlock');
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
    if (elsewhere && elsewhere.href) {
      var link = el('a', 'unlock-else', elsewhere.text || elsewhere.href);
      link.href = elsewhere.href;
      box.appendChild(link);
    }

    host.parentNode.insertBefore(box, host);
    host.classList.add('powered-down');
    host.setAttribute('inert', '');
    host.setAttribute('aria-hidden', 'true');

    go.addEventListener('click', function () {
      var value = seed();
      var kept = store ? store.set(key, value) : false;
      if (box.parentNode) box.parentNode.removeChild(box);
      host.classList.remove('powered-down');
      host.removeAttribute('inert');
      host.removeAttribute('aria-hidden');
      var first = host.querySelector('button:not([disabled]), a[href], input, [tabindex]');
      if (first && typeof first.focus === 'function') first.focus();
      onReady(value, kept ? 'seeded' : 'memory');
    });
    return false;
  }

  /* The one random control on the site: the "send me somewhere" button in the index of every
     world, which picks any world but this one. It is hidden in the markup, because without
     scripting it would do nothing. */
  function wireRandom() {
    var button = document.getElementById('worlds-random');
    if (!button) return;
    var here = (window.location.pathname || '').split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.worlds .chips a[href]');
    var pool = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href !== here && href.split('/').pop() !== here && pool.indexOf(href) === -1) pool.push(href);
    }
    if (!pool.length) return;
    button.hidden = false;
    button.addEventListener('click', function () {
      window.location.href = pool[Math.floor(Math.random() * pool.length)];
    });
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
    wireRandom();
    retireOldKeys();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
