/*
  Shared relay cipher console for the constellation circuit pages.

  Rendered through _includes/footer.njk across all eight constellation worlds, this mini-game
  creates one more coherent cross-world thread: crack rotating 3-dial ciphers generated from the
  shared sky and relay progress, then mint collectible relay tokens.

  State key inside the shared interestingState document: "constellation-cipher".
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-cipher-status');
  var briefEl = document.getElementById('constellation-cipher-brief');
  var logEl = document.getElementById('constellation-cipher-log');
  var dialA = document.getElementById('constellation-cipher-a');
  var dialB = document.getElementById('constellation-cipher-b');
  var dialC = document.getElementById('constellation-cipher-c');
  var checkBtn = document.getElementById('constellation-cipher-check');
  var hintBtn = document.getElementById('constellation-cipher-hint');
  var newBtn = document.getElementById('constellation-cipher-new');

  if (!statusEl || !briefEl || !logEl || !dialA || !dialB || !dialC || !checkBtn || !hintBtn || !newBtn) return;

  var KEY = 'constellation-cipher';
  var SKY = 'constellation';
  var RELAY = 'constellation-relay';
  var LIMIT = 6;

  var WORLDS = [
    'wish-constellation.html',
    'constellation-diary.html',
    'constellation-echo.html',
    'constellation-weather.html',
    'orbital-weaver.html',
    'sky-archive.html',
    'star-lantern.html',
    'wish-terrarium.html'
  ];

  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  function clampDigit(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    n = Math.round(n);
    if (n < 0) return 0;
    if (n > 9) return 9;
    return n;
  }

  function worldIndex() {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i] === currentFile) return i;
    }
    return 0;
  }

  function worldCode() {
    return String(worldIndex() + 1).padStart(2, '0');
  }

  function normalizeTarget(value) {
    if (!Array.isArray(value) || value.length < 3) return null;
    return [clampDigit(value[0]), clampDigit(value[1]), clampDigit(value[2])];
  }

  function normalizeLog(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      if (typeof list[i] !== 'string') continue;
      var line = list[i].trim();
      if (!line) continue;
      out.push(line);
      if (out.length >= LIMIT) break;
    }
    return out;
  }

  function normalize(value) {
    var safe = {
      target: null,
      solved: 0,
      seed: 0,
      log: []
    };

    if (!value || typeof value !== 'object') return safe;

    safe.target = normalizeTarget(value.target);
    safe.log = normalizeLog(value.log);

    if (typeof value.solved === 'number' && value.solved > 0) {
      safe.solved = Math.floor(value.solved);
    }

    if (typeof value.seed === 'number' && value.seed > 0) {
      safe.seed = Math.floor(value.seed) >>> 0;
    }

    return safe;
  }

  function countStars(list) {
    if (!Array.isArray(list)) return 0;
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      var star = list[i];
      if (!star || typeof star !== 'object') continue;
      if (typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string') count += 1;
    }
    return count;
  }

  function hashStars(list) {
    if (!Array.isArray(list) || !list.length) return 0;
    var h = 2166136261;
    for (var i = 0; i < list.length; i++) {
      var star = list[i];
      if (!star || typeof star.x !== 'number' || typeof star.y !== 'number' || typeof star.text !== 'string') continue;
      h ^= Math.round(star.x * 10);
      h = Math.imul(h, 16777619);
      h ^= Math.round(star.y * 10);
      h = Math.imul(h, 16777619);
      for (var c = 0; c < star.text.length; c++) {
        h ^= star.text.charCodeAt(c);
        h = Math.imul(h, 16777619);
      }
    }
    return h >>> 0;
  }

  function starsSnapshot() {
    var saved = store.read(SKY, []);
    var list = saved.status === 'ok' && Array.isArray(saved.value) ? saved.value : [];
    return {
      status: saved.status,
      count: saved.status === 'ok' ? countStars(list) : 0,
      hash: saved.status === 'ok' ? hashStars(list) : 0
    };
  }

  function relayLoops() {
    var relay = store.read(RELAY, { completed: 0 });
    if (relay.status !== 'ok' || !relay.value || typeof relay.value !== 'object') return 0;
    if (typeof relay.value.completed !== 'number' || relay.value.completed < 1) return 0;
    return Math.floor(relay.value.completed);
  }

  function sliderValues() {
    return [clampDigit(dialA.value), clampDigit(dialB.value), clampDigit(dialC.value)];
  }

  function setSliders(values) {
    dialA.value = String(clampDigit(values[0]));
    dialB.value = String(clampDigit(values[1]));
    dialC.value = String(clampDigit(values[2]));
  }

  function compare(values, target) {
    var out = { match: 0, near: 0 };
    for (var i = 0; i < 3; i++) {
      var diff = Math.abs(values[i] - target[i]);
      if (diff === 0) out.match += 1;
      else if (diff === 1) out.near += 1;
    }
    return out;
  }

  function hintFor(values, target) {
    var names = ['dial one', 'dial two', 'dial three'];
    var lines = [];
    for (var i = 0; i < 3; i++) {
      if (values[i] === target[i]) lines.push(names[i] + ' holds');
      else if (values[i] < target[i]) lines.push(names[i] + ' higher');
      else lines.push(names[i] + ' lower');
    }
    return 'Hint: ' + lines.join(', ') + '.';
  }

  function makeSeed(offset) {
    var snap = starsSnapshot();
    var loops = relayLoops();
    var bias = worldIndex() * 17;
    var time = Date.now() & 1023;
    var extra = typeof offset === 'number' ? offset : 0;
    return (snap.hash + snap.count * 37 + loops * 61 + data.solved * 29 + bias + time + extra) >>> 0;
  }

  function makeTarget(seed) {
    var a = clampDigit(seed % 10);
    var b = clampDigit(((seed >>> 4) + 3) % 10);
    var c = clampDigit(((seed >>> 8) + 7) % 10);
    if (a === b && b === c) c = (c + 4) % 10;
    return [a, b, c];
  }

  function pushLog(line) {
    if (typeof line !== 'string' || !line.trim()) return;
    data.log.unshift(line.trim());
    if (data.log.length > LIMIT) data.log = data.log.slice(0, LIMIT);
  }

  function persist() {
    return store.set(KEY, {
      target: data.target,
      solved: data.solved,
      seed: data.seed,
      log: data.log
    });
  }

  function tokenFor(target) {
    return 'token ' + worldCode() + '-' + target.join('') + '-' + String(data.solved).padStart(2, '0');
  }

  function setStatus(text, good) {
    statusEl.textContent = text;
    if (good) statusEl.classList.add('good');
    else statusEl.classList.remove('good');
  }

  function render(kept, line, good) {
    var snap = starsSnapshot();
    var loops = relayLoops();
    var memoryLine = kept ? 'Saved in this browser.' : 'Held in memory for this visit.';

    var base = 'Cipher deck: ' + data.solved + ' token' + (data.solved === 1 ? '' : 's') + ' minted';
    if (loops) base += ' · relay loops ' + loops;
    if (snap.count) {
      base += ' · shared sky ' + snap.count + ' star' + (snap.count === 1 ? '' : 's') + '.';
    } else if (snap.status === 'missing') {
      base += ' · shared sky has no stars yet.';
    } else if (snap.status === 'unreadable') {
      base += ' · shared sky is unreadable in this browser context.';
    } else if (snap.status === 'unavailable') {
      base += ' · shared sky storage is unavailable in this browser context.';
    } else {
      base += ' · shared sky has no readable stars yet.';
    }

    setStatus((line ? line + ' ' : '') + base + ' ' + memoryLine, !!good || data.solved > 0);

    var values = sliderValues();
    briefEl.textContent = 'Dial signature ' + values.join(' · ') + '. Align all three dials to mint one relay token.';

    if (data.log.length) {
      logEl.textContent = 'Recent tokens: ' + data.log.join(' · ');
    } else {
      logEl.textContent = 'No tokens minted yet.';
    }
  }

  function spinCipher(offset) {
    data.seed = makeSeed(offset);
    data.target = makeTarget(data.seed);

    setSliders([
      clampDigit((data.seed >>> 1) % 10),
      clampDigit((data.seed >>> 6) % 10),
      clampDigit((data.seed >>> 10) % 10)
    ]);
  }

  function disableAll() {
    dialA.disabled = true;
    dialB.disabled = true;
    dialC.disabled = true;
    checkBtn.disabled = true;
    hintBtn.disabled = true;
    newBtn.disabled = true;
  }

  var read = store.read(KEY, { target: null, solved: 0, seed: 0, log: [] });
  var readStatus = read.status;
  var data = normalize(read.value);

  if (readStatus === 'unreadable') {
    disableAll();
    setStatus('Cipher memory is unreadable in this browser context.', false);
    briefEl.textContent = 'Clear state from the menu to start a fresh cipher deck.';
    logEl.textContent = 'No relay cipher state is available.';
    return;
  }

  if (!data.target) {
    spinCipher(11);
  } else {
    setSliders([0, 0, 0]);
  }

  checkBtn.addEventListener('click', function () {
    var values = sliderValues();
    var score = compare(values, data.target);

    if (score.match === 3) {
      data.solved += 1;
      var token = tokenFor(data.target);
      pushLog(token);
      spinCipher(data.solved * 13 + data.log.length * 7 + 19);
      var keptSolved = persist();
      render(keptSolved, 'Cipher cracked. ' + token + ' minted. New cipher is live.', true);
      return;
    }

    var line = score.match + ' aligned';
    if (score.near) line += ', ' + score.near + ' near';
    line += '. ' + hintFor(values, data.target);

    var keptCheck = persist();
    render(keptCheck, line, score.match > 0);
  });

  hintBtn.addEventListener('click', function () {
    var values = sliderValues();
    var score = compare(values, data.target);
    var keptHint = persist();
    render(keptHint, hintFor(values, data.target), score.match > 0);
  });

  newBtn.addEventListener('click', function () {
    spinCipher(97 + data.solved * 5);
    var keptNew = persist();
    render(keptNew, 'New cipher spun.', false);
  });

  dialA.addEventListener('input', function () {
    render(persist(), '', false);
  });
  dialB.addEventListener('input', function () {
    render(persist(), '', false);
  });
  dialC.addEventListener('input', function () {
    render(persist(), '', false);
  });

  render(persist(), 'Cipher console ready.', false);
})();
