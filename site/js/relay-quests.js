/*
  Shared quest loop for the constellation circuit pages.

  The relay already tracks where someone has been. This file adds an optional objective thread that
  spans all eight sky worlds so visitors can keep moving through one coherent expedition instead of
  treating each world as a separate stop.

  State key: "constellation-quests" in the shared interestingState document.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-quest-status');
  var objectiveEl = document.getElementById('constellation-quest-objective');
  var linkEl = document.getElementById('constellation-quest-link');
  var completeBtn = document.getElementById('constellation-quest-complete');
  var rerollBtn = document.getElementById('constellation-quest-reroll');

  if (!statusEl || !objectiveEl || !linkEl || !completeBtn || !rerollBtn) return;

  var KEY = 'constellation-quests';
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

  var QUESTS = {
    'wish-constellation.html': [
      'Place one new thought-star, then ask the sky what changed.',
      'Catch one meteor and keep its rare thought-star.',
      'Mint a constellation postcard with a new title.'
    ],
    'constellation-diary.html': [
      'Write one diary entry after shuffling the palette.',
      'Seal one time capsule from your current sky.',
      'Replay birth order, then read the latest thought line.'
    ],
    'constellation-echo.html': [
      'Emit two pulses in different regions and compare the readings.',
      'Select one echo, then print echo weather.',
      'Shuffle harmonics and capture one new atmosphere report.'
    ],
    'constellation-weather.html': [
      'Deploy one map probe, then generate a full forecast.',
      'Toggle rain mode and read the field at another hour.',
      'Change forecast hour, then print a second report to compare.'
    ],
    'orbital-weaver.html': [
      'Adjust symmetry spokes, then print a new mantra.',
      'Emit a ripple in the weave and read one mantra forecast.',
      'Shuffle the weave, then freeze spin and inspect the geometry.'
    ],
    'sky-archive.html': [
      'Spin the omen wheel and archive the new reading.',
      'Remix runes, then forge one downloadable sigil.',
      'Forge a sigil after a fresh spin and compare the title line.'
    ],
    'star-lantern.html': [
      'Kindle a random lantern, then ask for a mood reading.',
      'Toggle drift mode and select a glowing thought.',
      'Run a reading after reshaping your sky in the wish constellation.'
    ],
    'wish-terrarium.html': [
      'Regrow the terrarium and pick one plant memory.',
      'Pause wind, inspect one stem memory, then resume wind.',
      'Ask for a greenhouse forecast after a regrow pass.'
    ]
  };

  var lastMessage = '';
  var questState = {
    active: null,
    completed: 0,
    streak: 0
  };

  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  function circuitIndex(href) {
    for (var i = 0; i < CIRCUIT.length; i++) {
      if (CIRCUIT[i].href === href) return i;
    }
    return -1;
  }

  function circuitLabel(href) {
    var idx = circuitIndex(href);
    return idx === -1 ? href : CIRCUIT[idx].where;
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

  function countStars(value) {
    if (!Array.isArray(value)) return 0;
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

  function normalizeState(value) {
    if (!value || typeof value !== 'object') return { active: null, completed: 0, streak: 0 };
    var safe = {
      active: null,
      completed: typeof value.completed === 'number' && value.completed > 0 ? Math.floor(value.completed) : 0,
      streak: typeof value.streak === 'number' && value.streak > 0 ? Math.floor(value.streak) : 0
    };

    if (value.active && typeof value.active === 'object') {
      if (typeof value.active.id === 'string'
          && typeof value.active.href === 'string'
          && typeof value.active.text === 'string'
          && circuitIndex(value.active.href) !== -1) {
        safe.active = {
          id: value.active.id,
          href: value.active.href,
          text: value.active.text
        };
      }
    }

    return safe;
  }

  function poolFor(href) {
    return QUESTS[href] || QUESTS['wish-constellation.html'];
  }

  var starsRead = store.read('constellation', []);
  var stars = starsRead.status === 'ok' ? countStars(starsRead.value) : 0;

  var relayRead = store.read('constellation-relay', { visited: [], completed: 0 });
  var relayVisited = [];
  var relayLoops = 0;
  if (relayRead.status === 'ok' && relayRead.value && typeof relayRead.value === 'object') {
    relayVisited = normalizeVisited(relayRead.value.visited);
    relayLoops = typeof relayRead.value.completed === 'number' && relayRead.value.completed > 0
      ? Math.floor(relayRead.value.completed)
      : 0;
  }

  var questRead = store.read(KEY, { active: null, completed: 0, streak: 0 });
  questState = normalizeState(questRead.value);

  function isActiveValid() {
    return !!(questState.active
      && typeof questState.active.id === 'string'
      && typeof questState.active.href === 'string'
      && typeof questState.active.text === 'string'
      && circuitIndex(questState.active.href) !== -1);
  }

  function buildQuest(offset, avoidId) {
    var tries = 0;
    var made = null;

    while (tries < 12) {
      var base = (stars * 7)
        + (relayVisited.length * 5)
        + (relayLoops * 11)
        + (questState.completed * 13)
        + currentFile.length
        + offset
        + (tries * 17);

      var href;
      if (stars < 1) {
        href = 'wish-constellation.html';
      } else {
        href = CIRCUIT[Math.abs(base) % CIRCUIT.length].href;
      }

      var pool = poolFor(href);
      var taskIndex = Math.abs(base + tries * 3) % pool.length;
      made = {
        id: href + '#' + taskIndex + '-' + String(Math.abs(base % 97)),
        href: href,
        text: pool[taskIndex]
      };

      if (!avoidId || made.id !== avoidId) return made;
      tries += 1;
    }

    return made;
  }

  function persist() {
    return store.set(KEY, {
      active: questState.active,
      completed: questState.completed,
      streak: questState.streak
    });
  }

  function ensureQuest() {
    if (isActiveValid()) return;
    questState.active = buildQuest(0, null);
    persist();
  }

  function disableControls(disabled) {
    completeBtn.disabled = disabled;
    rerollBtn.disabled = disabled;
    linkEl.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (disabled) {
      linkEl.href = 'wish-constellation.html';
    }
  }

  function statusLead() {
    var completeWord = questState.completed === 1 ? 'quest' : 'quests';
    var streakLine = questState.streak > 0 ? (' · streak ' + questState.streak) : '';
    return 'Relay quest log: ' + questState.completed + ' ' + completeWord + ' completed' + streakLine + '.';
  }

  function storageLine(persisted) {
    if (questRead.status === 'unavailable') {
      return 'This browser keeps quest progress in memory only for this visit.';
    }
    if (!persisted) {
      return 'Quest progress is in memory only right now.';
    }
    if (questRead.status === 'missing') {
      return 'Quest loop started fresh in this browser.';
    }
    return 'Quest progress is saved in this browser.';
  }

  function render() {
    if (questRead.status === 'unreadable') {
      statusEl.textContent = 'Quest memory is unreadable in this browser context.';
      objectiveEl.textContent = 'Clear state from the menu, then return to any relay world to start fresh.';
      linkEl.href = 'wish-constellation.html';
      linkEl.textContent = 'open the wish constellation';
      disableControls(true);
      return;
    }

    ensureQuest();
    var persisted = persist();

    statusEl.textContent = statusLead() + ' ' + storageLine(persisted);

    var where = circuitLabel(questState.active.href);
    objectiveEl.textContent = 'Current objective: ' + questState.active.text
      + (stars > 0
        ? ' Complete it, then continue to another relay world.'
        : ' This one seeds your relay: once you place a star, every world can reinterpret it.');

    if (lastMessage) {
      objectiveEl.textContent = lastMessage + ' ' + objectiveEl.textContent;
    }

    linkEl.href = questState.active.href;
    linkEl.textContent = 'open ' + where;
    disableControls(false);
  }

  completeBtn.addEventListener('click', function () {
    ensureQuest();
    var completedText = questState.active ? questState.active.text : 'quest completed';
    var oldId = questState.active ? questState.active.id : null;

    questState.completed += 1;
    questState.streak += 1;
    questState.active = buildQuest(questState.completed + relayVisited.length + relayLoops + 1, oldId);

    persist();
    lastMessage = 'Completed: ' + completedText;
    render();
  });

  rerollBtn.addEventListener('click', function () {
    ensureQuest();
    var oldId = questState.active ? questState.active.id : null;
    questState.streak = 0;
    questState.active = buildQuest(questState.completed + relayVisited.length + 5, oldId);

    persist();
    lastMessage = 'Quest rerolled.';
    render();
  });

  render();
})();
