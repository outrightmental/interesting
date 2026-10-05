/*
  Shared relay logbook for the constellation circuit pages.

  Rendered through _includes/footer.njk on the eight constellation worlds, this panel lets a
  visitor capture a moment from any instrument and keep one cross-world narrative thread while
  they move through the relay.

  State key inside the shared interestingState document: "constellation-logbook".
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-logbook-status');
  var listEl = document.getElementById('constellation-logbook-list');
  var captureBtn = document.getElementById('constellation-logbook-capture');
  var highlightBtn = document.getElementById('constellation-logbook-highlight');
  var clearBtn = document.getElementById('constellation-logbook-clear');

  if (!statusEl || !listEl || !captureBtn || !highlightBtn || !clearBtn) return;

  var KEY = 'constellation-logbook';
  var SKY = 'constellation';
  var LIMIT = 18;
  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

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

  function countStars(value) {
    if (!Array.isArray(value)) return 0;
    var count = 0;
    for (var i = 0; i < value.length; i++) {
      var star = value[i];
      if (!star || typeof star !== 'object') continue;
      if (typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string') count += 1;
    }
    return count;
  }

  function whereFor(href) {
    for (var i = 0; i < CIRCUIT.length; i++) {
      if (CIRCUIT[i].href === href) return CIRCUIT[i].where;
    }
    return href;
  }

  function compact(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function clip(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + '…';
  }

  function stamp(ms) {
    var d = new Date(ms);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.id !== 'string' || typeof entry.href !== 'string' || typeof entry.text !== 'string') return null;
    return {
      id: entry.id,
      href: entry.href,
      where: typeof entry.where === 'string' ? entry.where : whereFor(entry.href),
      text: clip(compact(entry.text), 180),
      stars: typeof entry.stars === 'number' ? Math.max(0, Math.floor(entry.stars)) : 0,
      stamp: typeof entry.stamp === 'number' ? entry.stamp : Date.now()
    };
  }

  function normalize(value) {
    var out = { entries: [], highlight: null };
    if (!value || typeof value !== 'object') return out;

    if (Array.isArray(value.entries)) {
      for (var i = 0; i < value.entries.length; i++) {
        var entry = normalizeEntry(value.entries[i]);
        if (!entry) continue;
        out.entries.push(entry);
        if (out.entries.length >= LIMIT) break;
      }
    }

    if (typeof value.highlight === 'string') out.highlight = value.highlight;
    return out;
  }

  function starsNow() {
    var saved = store.read(SKY, []);
    if (saved.status !== 'ok') return 0;
    return countStars(saved.value);
  }

  function findSnapshotText() {
    var selectors = [
      '#reading',
      '#entry',
      '#report',
      '#omen',
      '#haiku-output',
      '#note',
      '#status',
      '.note',
      '.tagline'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var text = clip(compact(node.textContent || ''), 180);
      if (text.length >= 12) return text;
    }

    return 'No live readout found on this page, but the relay moved onward.';
  }

  function persist() {
    return store.set(KEY, {
      entries: logbook.entries,
      highlight: logbook.highlight
    });
  }

  function randomIndex(limit) {
    return Math.floor(Math.random() * limit);
  }

  function pickHighlight() {
    if (!logbook.entries.length) return null;
    if (logbook.entries.length === 1) return logbook.entries[0];

    var tries = 0;
    var picked = logbook.entries[randomIndex(logbook.entries.length)];
    while (picked && picked.id === logbook.highlight && tries < 8) {
      picked = logbook.entries[randomIndex(logbook.entries.length)];
      tries += 1;
    }
    return picked;
  }

  function setStatus(savedOk, forcedText, good) {
    if (typeof forcedText === 'string' && forcedText) {
      statusEl.textContent = forcedText;
      if (good) statusEl.classList.add('good');
      else statusEl.classList.remove('good');
      return;
    }

    var count = logbook.entries.length;
    var stars = starsNow();
    var line = count
      ? ('Logbook holds ' + count + ' captured moment' + (count === 1 ? '' : 's') + ' across the relay.')
      : 'Logbook is empty. Capture one moment from this world to start a cross-world trail.';

    var starsLine = stars
      ? (' Shared sky: ' + stars + ' star' + (stars === 1 ? '' : 's') + '.')
      : ' Shared sky is empty right now.';

    var memoryLine = savedOk
      ? ' Logbook saved in this browser.'
      : ' Logbook held in memory only for this visit.';

    statusEl.textContent = line + starsLine + memoryLine;
    if (count) statusEl.classList.add('good');
    else statusEl.classList.remove('good');
  }

  function renderList() {
    while (listEl.firstChild) {
      listEl.removeChild(listEl.firstChild);
    }

    if (!logbook.entries.length) {
      var empty = document.createElement('li');
      empty.className = 'constellation-logbook-empty';
      empty.textContent = 'No entries captured yet.';
      listEl.appendChild(empty);
      return;
    }

    for (var i = 0; i < logbook.entries.length; i++) {
      var entry = logbook.entries[i];
      var li = document.createElement('li');
      if (entry.href === currentFile) li.classList.add('constellation-logbook-entry-current');
      if (entry.id === logbook.highlight) li.classList.add('constellation-logbook-entry-highlight');

      var link = document.createElement('a');
      link.className = 'constellation-logbook-entry-link';
      link.href = entry.href;
      link.textContent = entry.where;

      var meta = document.createElement('span');
      meta.className = 'constellation-logbook-entry-meta';
      meta.textContent = stamp(entry.stamp) + ' · stars ' + entry.stars;

      var text = document.createElement('span');
      text.className = 'constellation-logbook-entry-text';
      text.textContent = entry.text;

      li.appendChild(link);
      li.appendChild(meta);
      li.appendChild(text);
      listEl.appendChild(li);
    }
  }

  function render(savedOk, forcedText, good) {
    renderList();
    setStatus(savedOk, forcedText, good);
  }

  function captureMoment() {
    var excerpt = findSnapshotText();
    var now = Date.now();

    var entry = {
      id: currentFile + '#' + String(now),
      href: currentFile,
      where: whereFor(currentFile),
      text: excerpt,
      stars: starsNow(),
      stamp: now
    };

    logbook.entries = [entry].concat(logbook.entries).slice(0, LIMIT);
    logbook.highlight = entry.id;
    var savedOk = persist();
    render(savedOk, 'Captured: ' + entry.where + ' · "' + entry.text + '"', true);
  }

  function highlightEntry() {
    if (!logbook.entries.length) {
      render(false, 'No entries to highlight yet. Capture one first.', false);
      return;
    }

    var picked = pickHighlight();
    if (!picked) {
      render(false, 'No entries to highlight yet. Capture one first.', false);
      return;
    }

    logbook.highlight = picked.id;
    var savedOk = persist();
    render(savedOk, 'Highlighted: ' + picked.where + ' · "' + picked.text + '"', true);
  }

  function clearLogbook() {
    logbook.entries = [];
    logbook.highlight = null;
    var savedOk = persist();
    render(savedOk, 'Logbook cleared. Capture a new moment from any relay world.', false);
  }

  var read = store.read(KEY, { entries: [], highlight: null });
  var readStatus = read.status;
  var logbook = normalize(read.value);

  if (readStatus === 'unreadable') {
    captureBtn.disabled = true;
    highlightBtn.disabled = true;
    clearBtn.disabled = true;
    render(false, 'Logbook memory is unreadable in this browser context. Clear state from the menu to restart.', false);
    return;
  }

  captureBtn.addEventListener('click', captureMoment);
  highlightBtn.addEventListener('click', highlightEntry);
  clearBtn.addEventListener('click', clearLogbook);

  var initialSaved = persist();
  render(initialSaved);
})();
