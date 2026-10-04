/*
  The pulse in the site header, on every page: what the shared local-state document is already
  holding for this visitor, one step back to it, and one suggested onward trail.

  It used to count stars and point at one remembered world. The site now has a stronger through-line:
  once someone has a saved constellation, the pulse keeps an expedition route live across the linked
  sky worlds so they can keep moving through reinterpretations of the same material.

  Reads nothing itself: the saved state arrives through window.interestingState (js/state.js), which
  the layout loads first. Its classes are site-pulse*; every site-meta* name belongs to the meta
  menu js/state.js draws, which is not this site's to restyle.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var statusEl = document.getElementById('site-pulse-status');
  var trailEl = document.getElementById('site-pulse-trail');
  var linkEl = document.getElementById('site-pulse-link');
  var passportStatusEl = document.getElementById('constellation-passport-status');
  var passportNextEl = document.getElementById('constellation-passport-next');

  if (!statusEl || !linkEl || !store || typeof store.read !== 'function') {
    return;
  }
  if (!trailEl) {
    trailEl = { textContent: '' };
  }

  /* The names the shared document keeps, the page each one belongs to, and what to call the things
     under it. A page that starts keeping something new belongs here beside its name; a name this
     list does not know is simply not reported. "threshold" is left out on purpose: what the site
     has read about a visitor is the ribbon's to say, in the ribbon's own words. */
  var KEPT = [
    { key: 'constellation', href: 'wish-constellation.html', where: 'the wish constellation',
      one: 'star', many: 'stars' },
    { key: 'capsules', href: 'constellation-diary.html', where: 'the diary',
      one: 'entry', many: 'entries' },
    { key: 'omens', href: 'sky-archive.html', where: 'the archive oracle',
      one: 'omen', many: 'omens' },
    { key: 'apocrypha', href: 'apocrypha-desk.html', where: 'the apocrypha desk',
      one: 'specimen', many: 'specimens' },
    { key: 'kiln', href: 'word-kiln.html', where: 'the word kiln' },
    { key: 'loam', href: 'loam.html', where: 'loam' },
    { key: 'quiet-room', href: 'quiet-room.html', where: 'the quiet room' }
  ];

  // The linked worlds that reinterpret one saved constellation from different angles.
  var CIRCUIT = [
    { href: 'wish-constellation.html', where: 'the wish constellation' },
    { href: 'constellation-diary.html', where: 'the diary' },
    { href: 'constellation-echo.html', where: 'the echo chamber' },
    { href: 'constellation-weather.html', where: 'the weather lab' },
    { href: 'orbital-weaver.html', where: 'the orbital weaver' },
    { href: 'sky-archive.html', where: 'the archive oracle' },
    { href: 'star-lantern.html', where: 'the lantern ritual' },
    { href: 'wish-terrarium.html', where: 'the terrarium' }
  ];

  // Kept in the shared state document to track a visitor's cross-world relay progress.
  var RELAY = 'constellation-relay';

  // For visitors whose latest reading points into the sky cluster, keep that as a preferred branch.
  var ORIENTATION_WORLD = {
    cosmic: 'wish-constellation.html',
    brooding: 'constellation-diary.html',
    attentive: 'constellation-echo.html',
    tempestuous: 'constellation-weather.html',
    geometric: 'orbital-weaver.html',
    divinatory: 'sky-archive.html',
    ceremonial: 'star-lantern.html',
    tending: 'wish-terrarium.html'
  };

  var TRAIL_PROMPTS = [
    'Sky trail live: each world remixes the same stars into a different instrument.',
    'Expedition route: keep the same constellation and compare what each world hears in it.',
    'Constellation relay: move one star, then follow the route to watch every reading shift.',
    'Linked run: one saved sky can become weather, audio, ritual and archive in sequence.'
  ];

  var RELAY_TITLES = [
    'midnight cartographer',
    'weather listener',
    'orbital signal-keeper',
    'lantern surveyor',
    'archive runner',
    'echo gardener'
  ];

  // How many worlds the line names before it stops counting them out.
  var NAMED = 2;

  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  /* Something is there to go back to. A page keeps either a list of things or one settled object,
     so an empty list is nothing kept -- which is what a visitor who has opened a world and left it
     alone has. */
  function held(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return !!value && typeof value === 'object';
  }

  function phrase(kept, value) {
    var n = Array.isArray(value) ? value.length : 0;
    if (!kept.one || !n) {
      return 'what you left in ' + kept.where;
    }
    return n + ' ' + (n === 1 ? kept.one : kept.many) + ' in ' + kept.where;
  }

  function sentence(parts) {
    if (parts.length === 1) {
      return parts[0];
    }
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  function countStars(value) {
    if (!Array.isArray(value)) {
      return 0;
    }
    var count = 0;
    for (var i = 0; i < value.length; i++) {
      var star = value[i];
      if (!star || typeof star !== 'object') continue;
      if (typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string') {
        count += 1;
      }
    }
    return count;
  }

  function preferredWorldFromReading() {
    var saved = store.read('threshold', null);
    if (saved.status !== 'ok' || !saved.value || typeof saved.value !== 'object') {
      return null;
    }
    var id = saved.value.orientation;
    if (typeof id !== 'string') {
      return null;
    }
    return ORIENTATION_WORLD[id] || null;
  }

  function circuitIndex(href) {
    for (var i = 0; i < CIRCUIT.length; i++) {
      if (CIRCUIT[i].href === href) {
        return i;
      }
    }
    return -1;
  }

  function circuitLabel(href) {
    var idx = circuitIndex(href);
    return idx === -1 ? href : CIRCUIT[idx].where;
  }

  function circuitDestination(preferredHref) {
    var here = circuitIndex(currentFile);
    if (here !== -1) {
      return CIRCUIT[(here + 1) % CIRCUIT.length];
    }

    if (preferredHref) {
      var preferred = circuitIndex(preferredHref);
      if (preferred !== -1) {
        return CIRCUIT[preferred];
      }
    }

    return CIRCUIT[0];
  }

  function setPassport(status, next) {
    if (passportStatusEl) {
      passportStatusEl.textContent = status;
    }
    if (passportNextEl) {
      passportNextEl.textContent = next;
    }
  }

  function normalizeVisited(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      if (circuitIndex(list[i]) === -1) continue;
      if (out.indexOf(list[i]) !== -1) continue;
      out.push(list[i]);
    }
    return out;
  }

  function relayTitle(stars, loops) {
    return RELAY_TITLES[(stars + loops) % RELAY_TITLES.length];
  }

  var inCircuit = circuitIndex(currentFile) !== -1;

  // Track relay progress across constellation worlds in the one shared state document.
  var relayRead = store.read(RELAY, { visited: [], completed: 0 });
  var relayStatus = relayRead.status;
  var relayPersisted = true;
  var relay = { visited: [], completed: 0, reachedNow: false };

  if (relayStatus === 'ok' && relayRead.value && typeof relayRead.value === 'object') {
    relay.visited = normalizeVisited(relayRead.value.visited);
    relay.completed = typeof relayRead.value.completed === 'number' && relayRead.value.completed > 0
      ? Math.floor(relayRead.value.completed)
      : 0;
  }

  if (inCircuit && (relayStatus === 'ok' || relayStatus === 'missing')) {
    var before = relay.visited.length;
    if (relay.visited.indexOf(currentFile) === -1) {
      relay.visited.push(currentFile);
    }
    if (before < CIRCUIT.length && relay.visited.length === CIRCUIT.length) {
      relay.reachedNow = true;
      relay.completed += 1;
    }
    relayPersisted = store.set(RELAY, {
      visited: relay.visited,
      completed: relay.completed
    });
  }

  function relayStory(destination, stars) {
    if (!inCircuit) return '';

    if (relayStatus === 'unreadable') {
      return 'Relay memory is unreadable in this browser context.';
    }
    if (relayStatus === 'unavailable' || !relayPersisted) {
      return 'Relay marks are in memory only for this visit.';
    }

    var marked = relay.visited.length;
    if (!marked) {
      return 'No relay marks yet. Start from any sky world and keep moving.';
    }

    var names = relay.visited.map(circuitLabel).join(' -> ');
    if (marked >= CIRCUIT.length) {
      var title = relayTitle(stars, relay.completed || 1);
      return 'Relay complete: ' + names + '. Title unlocked: ' + title + '.';
    }

    var left = CIRCUIT.length - marked;
    var prompt = destination ? (' Next hop: ' + destination.where + '.') : '';
    return marked + ' of ' + CIRCUIT.length + ' relay worlds marked (' + names + '). '
      + left + ' left.' + prompt;
  }

  // 'unavailable' and 'unreadable' are the whole document's business rather than any one name's, so
  // the first read settles them and there is nothing to learn from reading the rest.
  var found = [];
  var trouble = null;

  for (var i = 0; i < KEPT.length; i++) {
    var saved = store.read(KEPT[i].key, null);
    if (saved.status === 'unavailable' || saved.status === 'unreadable') {
      trouble = saved.status;
      break;
    }
    if (held(saved.value)) {
      found.push({ kept: KEPT[i], value: saved.value });
    }
  }

  var constellation = store.read('constellation', []);
  if (!trouble && (constellation.status === 'unavailable' || constellation.status === 'unreadable')) {
    trouble = constellation.status;
  }
  var stars = constellation.status === 'ok' ? countStars(constellation.value) : 0;

  // Nothing to go back to leaves the link exactly as the layout wrote it, which is the one
  // destination that assumes nothing: the atlas of every orientation.
  if (trouble === 'unavailable') {
    statusEl.textContent = 'this browser stores nothing, so nothing you make here will be waiting.';
    trailEl.textContent = 'The site still works as a full map; it only cannot carry your trail forward.';
    if (inCircuit) {
      setPassport(
        'This browser keeps no lasting trail, so this relay resets when you leave.',
        'You can still roam every world in any order.'
      );
    }
    return;
  }
  if (trouble === 'unreadable') {
    statusEl.textContent = 'what this browser saved cannot be read. the state menu can clear it.';
    trailEl.textContent = 'After clearing, leave one trace in any world and the trail rebuilds from there.';
    if (inCircuit) {
      setPassport(
        'Saved sky data is unreadable in this browser right now.',
        'Clear state from the menu, place one star in the wish constellation, then continue through the circuit.'
      );
    }
    return;
  }

  if (!found.length) {
    statusEl.textContent = 'nothing kept in this browser yet.';
    trailEl.textContent = 'Start a trail by leaving one thing in any world, then follow what it opens.';
    if (inCircuit) {
      setPassport(
        'No saved stars are live in the relay yet.',
        'Start at the wish constellation, place one thought-star, then continue through the circuit.'
      );
    }
    return;
  }

  var named = [];
  for (i = 0; i < found.length && i < NAMED; i++) {
    named.push(phrase(found[i].kept, found[i].value));
  }
  var rest = found.length - named.length;
  if (rest) {
    named.push(rest === 1 ? 'one more world' : rest + ' more worlds');
  }
  statusEl.textContent = 'kept here: ' + sentence(named) + '.';

  if (stars > 0) {
    var preferred = preferredWorldFromReading();
    var destination = circuitDestination(preferred);
    linkEl.setAttribute('href', destination.href);
    linkEl.textContent = 'continue to ' + destination.where;

    var prompt = TRAIL_PROMPTS[(stars + found.length + currentFile.length) % TRAIL_PROMPTS.length];
    trailEl.textContent = prompt + ' ' + stars + ' star' + (stars === 1 ? ' is' : 's are') + ' live across the circuit.';

    if (inCircuit) {
      var relayLine = relayStory(destination, stars);
      setPassport(
        stars + ' saved star' + (stars === 1 ? ' is' : 's are') + ' live in this relay.',
        relayLine
      );
      if (relay.reachedNow) {
        trailEl.textContent = 'Relay completed across all eight constellation worlds. Move one star and run the whole circuit again for a different title.';
      }
    }
    return;
  }

  trailEl.textContent = 'Start a sky trail by placing one thought in the wish constellation; linked worlds will then reinterpret it.';

  if (inCircuit) {
    var fallbackDestination = circuitDestination(preferredWorldFromReading());
    setPassport(
      'The relay is waiting for its first saved sky.',
      relayStory(fallbackDestination, 0)
    );
  }

  for (i = 0; i < found.length; i++) {
    if (found[i].kept.href !== currentFile) {
      linkEl.setAttribute('href', found[i].kept.href);
      linkEl.textContent = 'back to ' + found[i].kept.where;
      return;
    }
  }
})();
