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
  var passportMeterEl = document.getElementById('constellation-passport-meter');
  var passportFillEl = document.getElementById('constellation-passport-fill');
  var passportCountEl = document.getElementById('constellation-passport-count');
  var passportNextLinkEl = document.getElementById('constellation-passport-next-link');
  var passportRandomBtn = document.getElementById('constellation-passport-random');
  var passportResetBtn = document.getElementById('constellation-passport-reset');
  var honorsStatusEl = document.getElementById('constellation-honors-status');
  var honorsListEl = document.getElementById('constellation-honors-list');
  var honorsPreviewBtn = document.getElementById('constellation-honors-preview');
  var honorsClearBtn = document.getElementById('constellation-honors-clear');

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

  var OFF_SKY = [
    { href: 'quiet-room.html', where: 'the quiet room' },
    { href: 'kinetic-floor.html', where: 'the kinetic floor' },
    { href: 'machine-shop.html', where: 'the machine shop' },
    { href: 'loam.html', where: 'loam' },
    { href: 'word-kiln.html', where: 'the word kiln' },
    { href: 'apocrypha-desk.html', where: 'the apocrypha desk' }
  ];

  var WAYFINDING = [
    { href: 'index.html', where: 'the threshold' },
    { href: 'moods.html', where: 'the mood atlas' },
    { href: 'sitemap.html', where: 'the site map' },
    { href: 'error.html', where: 'the observatory 404' }
  ];

  var ALL_WORLDS = OFF_SKY.concat(CIRCUIT, WAYFINDING);

  // Kept in the shared state document to track a visitor's cross-world relay progress.
  var RELAY = 'constellation-relay';
  var HONORS_LIMIT = 12;

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

  var RELAY_RANK = ['midnight', 'orbital', 'glasshouse', 'echo', 'weather', 'lantern', 'archive', 'signal'];
  var RELAY_ROLE = ['cartographer', 'listener', 'forger', 'keeper', 'weaver', 'runner', 'gardener', 'navigator'];

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

  function sanitizeTitles(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      if (typeof list[i] !== 'string') continue;
      var title = list[i].trim();
      if (!title) continue;
      if (out.indexOf(title) !== -1) continue;
      out.push(title);
      if (out.length >= HONORS_LIMIT) break;
    }
    return out;
  }

  function mintRelayTitle(stars, loops) {
    var count = Math.max(1, stars || 0);
    var rank = RELAY_RANK[(count + loops * 3) % RELAY_RANK.length];
    var role = RELAY_ROLE[(loops + count * 5) % RELAY_ROLE.length];
    return rank + ' ' + role + ' · loop ' + loops + ' · ' + count + ' star' + (count === 1 ? '' : 's');
  }

  function setPassportProgress(visitedCount, totalCount) {
    var ratio = totalCount ? (visitedCount / totalCount) : 0;
    var width = Math.max(0, Math.min(100, ratio * 100));

    if (passportMeterEl) {
      passportMeterEl.setAttribute('aria-valuenow', String(visitedCount));
      passportMeterEl.setAttribute('aria-valuemax', String(totalCount));
    }
    if (passportFillEl) {
      passportFillEl.style.width = width.toFixed(1) + '%';
    }
    if (passportCountEl) {
      passportCountEl.textContent = visitedCount + ' of ' + totalCount + ' relay worlds marked'
        + (relay.completed ? ' · loops completed ' + relay.completed + '.' : '.');
    }
  }

  function updatePassportProgress() {
    if (!inCircuit) return;

    var marked = relay.visited.length;
    setPassportProgress(marked, CIRCUIT.length);

    if (passportNextLinkEl) {
      var destination = circuitDestination(preferredWorldFromReading());
      passportNextLinkEl.href = destination.href;
      passportNextLinkEl.textContent = 'continue to ' + destination.where;
    }
  }

  function randomCircuitJump() {
    var options = CIRCUIT.filter(function (node) {
      return node.href !== currentFile;
    });
    if (!options.length) options = CIRCUIT.slice();
    var pick = options[Math.floor(Math.random() * options.length)];
    if (pick) window.location.href = pick.href;
  }

  function currentStoredStars() {
    var saved = store.read('constellation', []);
    if (saved.status !== 'ok') return 0;
    return countStars(saved.value);
  }

  function normalizeRelay(value) {
    var normalized = {
      visited: [],
      completed: 0,
      titles: [],
      reachedNow: false
    };

    if (!value || typeof value !== 'object') return normalized;

    normalized.visited = normalizeVisited(value.visited);
    normalized.completed = typeof value.completed === 'number' && value.completed > 0
      ? Math.floor(value.completed)
      : 0;
    normalized.titles = sanitizeTitles(value.titles);
    return normalized;
  }

  function saveRelay() {
    return store.set(RELAY, {
      visited: relay.visited,
      completed: relay.completed,
      titles: relay.titles
    });
  }

  function addRelayTitle(title) {
    if (!title) return;
    relay.titles = relay.titles.filter(function (item) { return item !== title; });
    relay.titles.unshift(title);
    if (relay.titles.length > HONORS_LIMIT) {
      relay.titles = relay.titles.slice(0, HONORS_LIMIT);
    }
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
      var latestHonor = relay.titles.length ? (' Latest honor: ' + relay.titles[0] + '.') : '';
      return 'Relay complete: ' + names + '.' + latestHonor;
    }

    var left = CIRCUIT.length - marked;
    var prompt = destination ? (' Next hop: ' + destination.where + '.') : '';
    return marked + ' of ' + CIRCUIT.length + ' relay worlds marked (' + names + '). '
      + left + ' left.' + prompt;
  }

  function disableHonorControls(disabled) {
    if (honorsPreviewBtn) honorsPreviewBtn.disabled = disabled;
    if (honorsClearBtn) honorsClearBtn.disabled = disabled;
  }

  function renderHonors(stars) {
    if (!honorsStatusEl || !honorsListEl) return;

    while (honorsListEl.firstChild) {
      honorsListEl.removeChild(honorsListEl.firstChild);
    }

    if (relayStatus === 'unreadable') {
      honorsStatusEl.textContent = 'Relay honor memory is unreadable in this browser context.';
      var unreadable = document.createElement('li');
      unreadable.className = 'constellation-honors-empty';
      unreadable.textContent = 'Clear state from the menu to start a fresh honor board.';
      honorsListEl.appendChild(unreadable);
      disableHonorControls(true);
      return;
    }

    disableHonorControls(false);

    if (!relay.titles.length) {
      var empty = document.createElement('li');
      empty.className = 'constellation-honors-empty';
      empty.textContent = 'No honors minted yet. Complete a full relay loop to earn one.';
      honorsListEl.appendChild(empty);
    } else {
      for (var i = 0; i < relay.titles.length; i++) {
        var item = document.createElement('li');
        item.textContent = relay.titles[i];
        honorsListEl.appendChild(item);
      }
    }

    var persistence = '';
    if (relayStatus === 'unavailable' || !relayPersisted) {
      persistence = ' This board is in memory only for this visit.';
    } else {
      persistence = ' Honors are saved in this browser.';
    }

    var previewLoop = relay.completed + 1;
    var preview = mintRelayTitle(stars, previewLoop);

    honorsStatusEl.textContent = relay.titles.length
      ? (relay.titles.length + ' honor' + (relay.titles.length === 1 ? '' : 's') + ' minted. Next preview: ' + preview + '.' + persistence)
      : ('Next honor preview: ' + preview + '.' + persistence);
  }

  function resetRelayMarks() {
    relay.visited = [];
    relay.reachedNow = false;

    relayPersisted = saveRelay();
    updatePassportProgress();

    var destination = circuitDestination(preferredWorldFromReading());
    if (relayPersisted) {
      setPassport(
        'Relay marks reset for this browser.',
        'Start from any sky world and leave a fresh trail. Suggested next hop: ' + destination.where + '.'
      );
    } else {
      setPassport(
        'Relay marks reset in memory for this visit.',
        'This browser cannot keep relay marks after you leave. Continue to ' + destination.where + ' now.'
      );
    }

    var stars = currentStoredStars();
    if (stars > 0) {
      trailEl.textContent = 'Relay reset complete. ' + stars + ' saved star'
        + (stars === 1 ? ' is' : 's are')
        + ' still live across the circuit.';
    } else {
      trailEl.textContent = 'Relay reset complete. Place one star in the wish constellation to start a fresh run.';
    }

    renderHonors(stars);
  }

  var inCircuit = circuitIndex(currentFile) !== -1;

  // Track relay progress across constellation worlds in the one shared state document.
  var relayRead = store.read(RELAY, { visited: [], completed: 0, titles: [] });
  var relayStatus = relayRead.status;
  var relayPersisted = true;
  var relay = normalizeRelay(relayRead.value);

  if (inCircuit && (relayStatus === 'ok' || relayStatus === 'missing')) {
    var before = relay.visited.length;
    if (relay.visited.indexOf(currentFile) === -1) {
      relay.visited.push(currentFile);
    }
    if (before < CIRCUIT.length && relay.visited.length === CIRCUIT.length) {
      relay.reachedNow = true;
      relay.completed += 1;
      addRelayTitle(mintRelayTitle(currentStoredStars(), relay.completed));
    }
    relayPersisted = saveRelay();
  }

  if (passportRandomBtn) {
    passportRandomBtn.addEventListener('click', randomCircuitJump);
  }
  if (passportResetBtn) {
    passportResetBtn.addEventListener('click', resetRelayMarks);
  }
  if (honorsPreviewBtn) {
    honorsPreviewBtn.addEventListener('click', function () {
      var stars = currentStoredStars();
      var preview = mintRelayTitle(stars, relay.completed + 1);
      if (honorsStatusEl) {
        honorsStatusEl.textContent = 'Next honor preview: ' + preview + '.';
      }
    });
  }
  if (honorsClearBtn) {
    honorsClearBtn.addEventListener('click', function () {
      relay.titles = [];
      relayPersisted = saveRelay();
      renderHonors(currentStoredStars());
      if (honorsStatusEl) {
        honorsStatusEl.textContent = 'Honor board cleared. Complete another loop to mint a new one.';
      }
    });
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
      updatePassportProgress();
    }
    renderHonors(stars);
    wireWayfindingJumps();
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
      updatePassportProgress();
    }
    renderHonors(stars);
    wireWayfindingJumps();
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
      updatePassportProgress();
    }
    renderHonors(stars);
    wireWayfindingJumps();
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
      updatePassportProgress();
      if (relay.reachedNow) {
        var honor = relay.titles.length ? relay.titles[0] : mintRelayTitle(stars, relay.completed || 1);
        trailEl.textContent = 'Relay completed across all eight constellation worlds. Honor minted: '
          + honor + '. Move one star and run the whole circuit again for a new one.';
      }
    }

    renderHonors(stars);
    wireWayfindingJumps();
    return;
  }

  trailEl.textContent = 'Start a sky trail by placing one thought in the wish constellation; linked worlds will then reinterpret it.';

  if (inCircuit) {
    var fallbackDestination = circuitDestination(preferredWorldFromReading());
    setPassport(
      'The relay is waiting for its first saved sky.',
      relayStory(fallbackDestination, 0)
    );
    updatePassportProgress();
  }

  for (i = 0; i < found.length; i++) {
    if (found[i].kept.href !== currentFile) {
      linkEl.setAttribute('href', found[i].kept.href);
      linkEl.textContent = 'back to ' + found[i].kept.where;
      renderHonors(stars);
      wireWayfindingJumps();
      return;
    }
  }

  renderHonors(stars);
  wireWayfindingJumps();

  function uniqueWorlds(list) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item.href !== 'string') continue;
      if (seen[item.href]) continue;
      seen[item.href] = true;
      out.push(item);
    }
    return out;
  }

  function worldPool(base, avoid) {
    var items = uniqueWorlds(base);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var href = items[i].href;
      if (href === currentFile) continue;
      if (avoid && href === avoid) continue;
      out.push(items[i]);
    }
    return out;
  }

  function randomPick(list) {
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function routeJump(mode) {
    var preferred = preferredWorldFromReading();
    var pool;

    if (mode === 'counter') {
      var preferredInCircuit = preferred && circuitIndex(preferred) !== -1;
      var preferredInOffSky = false;
      for (var i = 0; i < OFF_SKY.length; i++) {
        if (OFF_SKY[i].href === preferred) {
          preferredInOffSky = true;
          break;
        }
      }

      if (preferredInCircuit) {
        pool = worldPool(OFF_SKY.concat(WAYFINDING), preferred);
      } else if (preferredInOffSky) {
        pool = worldPool(CIRCUIT.concat(WAYFINDING), preferred);
      } else {
        pool = worldPool(ALL_WORLDS, preferred);
      }
    } else {
      pool = worldPool(ALL_WORLDS, null);
    }

    var pick = randomPick(pool);
    if (!pick) {
      pick = randomPick(worldPool(ALL_WORLDS, null));
    }
    if (pick) {
      return pick;
    }
    return { href: 'index.html', where: 'the threshold' };
  }

  function setWayfindingJumpNote(text) {
    var notes = document.querySelectorAll('[data-wayfinding-jump-note]');
    for (var i = 0; i < notes.length; i++) {
      notes[i].textContent = text;
    }
  }

  function wireWayfindingJumps() {
    var buttons = document.querySelectorAll('[data-wayfinding-jump]');
    if (!buttons.length) return;

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var mode = this.getAttribute('data-wayfinding-jump') || 'surprise';
        var picked = routeJump(mode);

        if (mode === 'counter') {
          setWayfindingJumpNote('Counter-jump selected: ' + picked.where + '.');
        } else {
          setWayfindingJumpNote('Surprise jump selected: ' + picked.where + '.');
        }

        window.location.href = picked.href;
      });
    }
  }
})();