/*
  Shared relay signal deck for the constellation circuit pages.

  The relay already has passport marks, quests, honors, and a remixer. This deck adds one more
  federated thread: a rotating prompt that points to another world in the same circuit and nudges
  one small experiment before the jump.

  State key inside the shared interestingState document: "constellation-signals".
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-signals-status');
  var currentEl = document.getElementById('constellation-signals-current');
  var drawBtn = document.getElementById('constellation-signals-draw');
  var lockBtn = document.getElementById('constellation-signals-lock');
  var clearBtn = document.getElementById('constellation-signals-clear');
  var logEl = document.getElementById('constellation-signals-log');

  if (!statusEl || !currentEl || !drawBtn || !lockBtn || !clearBtn || !logEl) return;

  var KEY = 'constellation-signals';
  var SKY = 'constellation';
  var RELAY = 'constellation-relay';
  var LIMIT = 8;

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

  var STARTERS = [
    'Signal:',
    'Relay ping:',
    'Cross-world prompt:',
    'Field note:'
  ];

  var ACTIONS = [
    'remix',
    're-read',
    'pulse',
    'shuffle',
    'freeze',
    'kindle',
    'regrow',
    'spin'
  ];

  var OBJECTS = [
    'one saved star',
    'one pattern edge',
    'one stubborn angle',
    'one bright fragment',
    'one quiet corner',
    'one curious detail'
  ];

  var TURNS = [
    'Keep the move tiny and concrete.',
    'Compare what changes across two worlds.',
    'Print one reading before you jump again.',
    'Leave one trace for your next return.',
    'Let play lead and precision follow.'
  ];

  var ORIENTATION_BIAS = {
    cosmic: 0,
    brooding: 1,
    attentive: 2,
    tempestuous: 3,
    geometric: 4,
    divinatory: 5,
    ceremonial: 6,
    tending: 7
  };

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

  function hashText(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hashStars(stars) {
    if (!Array.isArray(stars) || !stars.length) return 0;
    var h = 2166136261;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!s || typeof s.x !== 'number' || typeof s.y !== 'number' || typeof s.text !== 'string') continue;
      h ^= Math.round(s.x * 10);
      h = Math.imul(h, 16777619);
      h ^= Math.round(s.y * 10);
      h = Math.imul(h, 16777619);
      h ^= hashText(s.text);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function normalizeLog(log) {
    var out = [];
    if (!Array.isArray(log)) return out;
    for (var i = 0; i < log.length; i++) {
      var item = log[i];
      if (!item || typeof item !== 'object') continue;
      if (typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.href !== 'string') continue;
      out.push({
        id: item.id,
        text: item.text,
        href: item.href,
        where: typeof item.where === 'string' ? item.where : item.href,
        stars: typeof item.stars === 'number' ? item.stars : 0
      });
      if (out.length >= LIMIT) break;
    }
    return out;
  }

  function normalizeCurrent(current) {
    if (!current || typeof current !== 'object') return null;
    if (typeof current.id !== 'string' || typeof current.text !== 'string' || typeof current.href !== 'string') return null;
    return {
      id: current.id,
      text: current.text,
      href: current.href,
      where: typeof current.where === 'string' ? current.where : current.href,
      stars: typeof current.stars === 'number' ? current.stars : 0
    };
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object') {
      return { locked: false, current: null, log: [] };
    }
    return {
      locked: !!value.locked,
      current: normalizeCurrent(value.current),
      log: normalizeLog(value.log)
    };
  }

  function orientationBias() {
    var saved = store.read('threshold', null);
    if (saved.status !== 'ok' || !saved.value || typeof saved.value !== 'object') return 0;
    var id = saved.value.orientation;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ORIENTATION_BIAS, id)) return 0;
    return ORIENTATION_BIAS[id];
  }

  function relayLoops() {
    var relay = store.read(RELAY, { completed: 0 });
    if (relay.status !== 'ok' || !relay.value || typeof relay.value !== 'object') return 0;
    if (typeof relay.value.completed !== 'number' || relay.value.completed < 1) return 0;
    return Math.floor(relay.value.completed);
  }

  function starsSnapshot() {
    var sky = store.read(SKY, []);
    return {
      status: sky.status,
      stars: sky.status === 'ok' ? countStars(sky.value) : 0,
      hash: sky.status === 'ok' ? hashStars(Array.isArray(sky.value) ? sky.value : []) : 0
    };
  }

  function worldByIndex(index) {
    return CIRCUIT[Math.abs(index) % CIRCUIT.length];
  }

  function pick(list, seed, salt) {
    return list[Math.abs(seed + salt * 31) % list.length];
  }

  function makeSignal(seed, stars, loops, bias) {
    var world = worldByIndex(seed + loops + bias);
    var text = pick(STARTERS, seed, 1)
      + ' '
      + pick(ACTIONS, seed, 2)
      + ' '
      + pick(OBJECTS, seed, 3)
      + ', then continue to '
      + world.where
      + '. '
      + pick(TURNS, seed, 4);

    return {
      id: world.href + '#' + String(Math.abs(seed % 100003)),
      text: text,
      href: world.href,
      where: world.where,
      stars: stars
    };
  }

  function persist() {
    return store.set(KEY, {
      locked: deck.locked,
      current: deck.current,
      log: deck.log
    });
  }

  function pushLog(signal) {
    if (!signal) return;
    deck.log = deck.log.filter(function (entry) {
      return entry.id !== signal.id;
    });
    deck.log.unshift(signal);
    if (deck.log.length > LIMIT) deck.log = deck.log.slice(0, LIMIT);
  }

  function generateSignal(force) {
    if (deck.locked && deck.current && !force) return deck.current;

    var snap = starsSnapshot();
    var loops = relayLoops();
    var bias = orientationBias();
    var seed = (snap.hash + snap.stars * 17 + loops * 43 + deck.log.length * 29 + (Date.now() % 1009) + bias * 11) >>> 0;
    var signal = makeSignal(seed, snap.stars, loops, bias);

    deck.current = signal;
    pushLog(signal);
    return signal;
  }

  function setLockButton() {
    lockBtn.textContent = deck.locked ? 'unlock signal' : 'lock signal';
    lockBtn.setAttribute('aria-pressed', deck.locked ? 'true' : 'false');
  }

  function renderLog() {
    while (logEl.firstChild) {
      logEl.removeChild(logEl.firstChild);
    }

    if (!deck.log.length) {
      var empty = document.createElement('li');
      empty.className = 'constellation-signals-empty';
      empty.textContent = 'No signals logged yet.';
      logEl.appendChild(empty);
      return;
    }

    for (var i = 0; i < deck.log.length; i++) {
      var item = document.createElement('li');
      item.textContent = deck.log[i].text;
      logEl.appendChild(item);
    }
  }

  function renderStatus(savedOk) {
    var snap = starsSnapshot();
    var loops = relayLoops();

    statusEl.classList.remove('good');

    if (snap.stars > 0) {
      statusEl.classList.add('good');
      statusEl.textContent = snap.stars + ' saved star' + (snap.stars === 1 ? '' : 's')
        + ' live in the relay'
        + (loops ? ' · loops completed ' + loops : '')
        + '. '
        + (savedOk ? 'Signal deck saved in this browser.' : 'Signal deck held in memory for this visit.');
      return;
    }

    if (snap.status === 'missing') {
      statusEl.textContent = 'No saved constellation yet. Place one star in the wish constellation to seed this deck.';
      return;
    }
    if (snap.status === 'unreadable') {
      statusEl.textContent = 'Saved constellation data is unreadable in this browser context.';
      return;
    }
    if (snap.status === 'unavailable') {
      statusEl.textContent = 'Storage is unavailable here. Signals can run in memory for this visit.';
      return;
    }

    statusEl.textContent = 'A sky file exists, but no readable stars were found yet.';
  }

  function renderCurrent() {
    if (!deck.current) {
      currentEl.textContent = 'Draw one signal to get a cross-world prompt.';
      return;
    }

    var jump = document.createElement('a');
    jump.className = 'action';
    jump.href = deck.current.href;
    jump.textContent = 'open ' + deck.current.where;

    currentEl.textContent = deck.current.text + ' ';
    currentEl.appendChild(jump);
  }

  function render(savedOk) {
    setLockButton();
    renderStatus(savedOk);
    renderCurrent();
    renderLog();
  }

  function drawSignal(force) {
    generateSignal(!!force);
    var savedOk = persist();
    render(savedOk);
  }

  function toggleLock() {
    deck.locked = !deck.locked;
    var savedOk = persist();
    render(savedOk);
  }

  function clearLog() {
    deck.log = [];
    if (!deck.locked) deck.current = null;
    var savedOk = persist();
    render(savedOk);
  }

  var read = store.read(KEY, { locked: false, current: null, log: [] });
  var deck = normalizeState(read.value);

  if (!deck.current) {
    generateSignal(true);
  } else {
    pushLog(deck.current);
  }

  drawBtn.addEventListener('click', function () {
    drawSignal(false);
  });

  lockBtn.addEventListener('click', toggleLock);
  clearBtn.addEventListener('click', clearLog);

  render(persist());
})();
