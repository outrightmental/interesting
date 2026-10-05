/*
  Shared exploration arcade for all pages that render wayfinding.

  This is a persistent challenge loop that keeps one coherent cross-page thread alive: deal a
  challenge, follow it to another world, mark it complete, and bank sparks for remixed routes.

  State key: "wayfinding-arcade" in window.interestingState.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var hosts = Array.prototype.slice.call(document.querySelectorAll('[data-wayfinding-arcade]'));
  if (!hosts.length) return;

  var KEY = 'wayfinding-arcade';
  var LIMIT = 8;
  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  var WORLDS = [
    { href: 'index.html', label: 'the threshold', cluster: 'wayfinding' },
    { href: 'moods.html', label: 'the mood atlas', cluster: 'wayfinding' },
    { href: 'sitemap.html', label: 'the site map', cluster: 'wayfinding' },
    { href: 'error.html', label: 'the observatory 404', cluster: 'wayfinding' },
    { href: 'quiet-room.html', label: 'the quiet room', cluster: 'off-sky' },
    { href: 'kinetic-floor.html', label: 'the kinetic floor', cluster: 'off-sky' },
    { href: 'machine-shop.html', label: 'the machine shop', cluster: 'off-sky' },
    { href: 'loam.html', label: 'loam', cluster: 'off-sky' },
    { href: 'word-kiln.html', label: 'the word kiln', cluster: 'off-sky' },
    { href: 'apocrypha-desk.html', label: 'the apocrypha desk', cluster: 'off-sky' },
    { href: 'wish-constellation.html', label: 'the wish constellation', cluster: 'sky' },
    { href: 'constellation-diary.html', label: 'the diary', cluster: 'sky' },
    { href: 'constellation-echo.html', label: 'the echo chamber', cluster: 'sky' },
    { href: 'constellation-weather.html', label: 'the weather lab', cluster: 'sky' },
    { href: 'orbital-weaver.html', label: 'the orbital weaver', cluster: 'sky' },
    { href: 'sky-archive.html', label: 'the archive oracle', cluster: 'sky' },
    { href: 'star-lantern.html', label: 'the lantern ritual', cluster: 'sky' },
    { href: 'wish-terrarium.html', label: 'the terrarium', cluster: 'sky' }
  ];

  var ORIENTATION_WORLD = {
    tender: 'quiet-room.html',
    restless: 'kinetic-floor.html',
    analytic: 'machine-shop.html',
    rooted: 'loam.html',
    verbal: 'word-kiln.html',
    curious: 'apocrypha-desk.html',
    cosmic: 'wish-constellation.html',
    ceremonial: 'star-lantern.html',
    brooding: 'constellation-diary.html',
    tempestuous: 'constellation-weather.html',
    attentive: 'constellation-echo.html',
    tending: 'wish-terrarium.html',
    divinatory: 'sky-archive.html',
    geometric: 'orbital-weaver.html'
  };

  var ACTIONS = [
    'capture one odd detail',
    'push one setting to an extreme',
    'freeze one frame and inspect it',
    'rerun one reading after one tiny shift',
    'follow one surprising branch',
    'keep one output and reinterpret it',
    'remix one element before you leave',
    'test one playful variant'
  ];

  var BRIDGES = [
    'Keep the move small and concrete.',
    'Do it once, then compare it in another world.',
    'Treat this as one leg in a longer route.',
    'Leave a trace for your next return.',
    'Use momentum first, polish later.'
  ];

  function byHref(href) {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].href === href) return WORLDS[i];
    }
    return null;
  }

  function labelFor(href) {
    var node = byHref(href);
    return node ? node.label : href;
  }

  function randomPick(list) {
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)] || null;
  }

  function pick(list, seed, salt) {
    return list[Math.abs(seed + salt * 31) % list.length];
  }

  function hashText(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function orientationWorld() {
    var saved = store.read('threshold', null);
    if (saved.status !== 'ok' || !saved.value || typeof saved.value !== 'object') return null;
    var id = saved.value.orientation;
    if (typeof id !== 'string') return null;
    return ORIENTATION_WORLD[id] || null;
  }

  function starsCount() {
    var saved = store.read('constellation', []);
    if (saved.status !== 'ok' || !Array.isArray(saved.value)) return 0;
    var count = 0;
    for (var i = 0; i < saved.value.length; i++) {
      var star = saved.value[i];
      if (!star || typeof star !== 'object') continue;
      if (typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string') count += 1;
    }
    return count;
  }

  function normalizeChallenge(value) {
    if (!value || typeof value !== 'object') return null;
    if (typeof value.id !== 'string' || typeof value.href !== 'string' || typeof value.text !== 'string') return null;
    return {
      id: value.id,
      href: value.href,
      text: value.text
    };
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
      last: '',
      streak: 0,
      best: 0,
      sparks: 0,
      completed: 0,
      challenge: null,
      log: []
    };

    if (!value || typeof value !== 'object') return safe;

    if (typeof value.last === 'string') safe.last = value.last;
    if (typeof value.streak === 'number' && value.streak > 0) safe.streak = Math.floor(value.streak);
    if (typeof value.best === 'number' && value.best > 0) safe.best = Math.floor(value.best);
    if (typeof value.sparks === 'number' && value.sparks > 0) safe.sparks = Math.floor(value.sparks);
    if (typeof value.completed === 'number' && value.completed > 0) safe.completed = Math.floor(value.completed);
    safe.challenge = normalizeChallenge(value.challenge);
    safe.log = normalizeLog(value.log);

    if (safe.best < safe.streak) safe.best = safe.streak;
    return safe;
  }

  function pushLog(line) {
    if (typeof line !== 'string' || !line.trim()) return;
    arcade.log.unshift(line.trim());
    if (arcade.log.length > LIMIT) arcade.log = arcade.log.slice(0, LIMIT);
  }

  function challengePool() {
    return WORLDS.filter(function (world) {
      return world.href !== currentFile;
    });
  }

  function findContrastingTarget(targetHref) {
    var here = byHref(currentFile);
    var target = byHref(targetHref);
    var pool = challengePool();
    if (!pool.length) return null;

    if (target) {
      var contrast = pool.filter(function (world) {
        return world.cluster !== target.cluster;
      });
      if (contrast.length) return randomPick(contrast);
    }

    if (here) {
      var away = pool.filter(function (world) {
        return world.cluster !== here.cluster;
      });
      if (away.length) return randomPick(away);
    }

    return randomPick(pool);
  }

  function buildChallenge(offset) {
    var stars = starsCount();
    var preferred = orientationWorld();
    var trail = store.read('trail-journal', { branches: 0 });
    var branches = (trail.status === 'ok' && trail.value && typeof trail.value.branches === 'number')
      ? Math.max(0, Math.floor(trail.value.branches))
      : 0;
    var seed = (hashText(currentFile)
      + arcade.completed * 17
      + arcade.sparks * 29
      + arcade.streak * 13
      + stars * 19
      + branches * 11
      + (Date.now() % 997)
      + (typeof offset === 'number' ? offset : 0)) >>> 0;

    var pool = challengePool();
    if (!pool.length) {
      pool = [{ href: 'index.html', label: 'the threshold', cluster: 'wayfinding' }];
    }

    var target = null;
    if (preferred && preferred !== currentFile && seed % 3 !== 0) {
      target = byHref(preferred);
    }
    if (!target) {
      target = pool[Math.abs(seed) % pool.length];
    }
    if (!target) target = pool[0];

    var action = pick(ACTIONS, seed, 2);
    var bridge = pick(BRIDGES, seed, 3);
    var text = 'In ' + target.label + ', ' + action + '. ' + bridge;

    return {
      id: target.href + '#' + String(Math.abs(seed % 100003)),
      href: target.href,
      text: text
    };
  }

  function persist() {
    return store.set(KEY, {
      last: arcade.last,
      streak: arcade.streak,
      best: arcade.best,
      sparks: arcade.sparks,
      completed: arcade.completed,
      challenge: arcade.challenge,
      log: arcade.log
    });
  }

  function disableHost(host, text) {
    var statusEl = host.querySelector('[data-wayfinding-arcade-status]');
    var challengeEl = host.querySelector('[data-wayfinding-arcade-challenge]');
    var scoreEl = host.querySelector('[data-wayfinding-arcade-score]');
    var linkEl = host.querySelector('[data-wayfinding-arcade-link]');
    var dealBtn = host.querySelector('[data-wayfinding-arcade-deal]');
    var completeBtn = host.querySelector('[data-wayfinding-arcade-complete]');
    var spendBtn = host.querySelector('[data-wayfinding-arcade-spend]');

    if (statusEl) {
      statusEl.classList.remove('good');
      statusEl.textContent = text;
    }
    if (challengeEl) challengeEl.textContent = 'Arcade controls are unavailable in this browser context.';
    if (scoreEl) scoreEl.textContent = 'Streak 0 · best 0 · sparks 0.';

    if (linkEl) {
      linkEl.href = 'index.html';
      linkEl.textContent = 'open challenge world';
      linkEl.setAttribute('aria-disabled', 'true');
    }

    if (dealBtn) dealBtn.disabled = true;
    if (completeBtn) completeBtn.disabled = true;
    if (spendBtn) spendBtn.disabled = true;
  }

  function render(message, saved) {
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var statusEl = host.querySelector('[data-wayfinding-arcade-status]');
      var challengeEl = host.querySelector('[data-wayfinding-arcade-challenge]');
      var scoreEl = host.querySelector('[data-wayfinding-arcade-score]');
      var linkEl = host.querySelector('[data-wayfinding-arcade-link]');
      var dealBtn = host.querySelector('[data-wayfinding-arcade-deal]');
      var completeBtn = host.querySelector('[data-wayfinding-arcade-complete]');
      var spendBtn = host.querySelector('[data-wayfinding-arcade-spend]');
      var logEl = host.querySelector('[data-wayfinding-arcade-log]');

      if (!statusEl || !challengeEl || !scoreEl || !linkEl || !dealBtn || !completeBtn || !spendBtn || !logEl) continue;

      var memoryLine = (readStatus === 'unavailable' || !saved)
        ? 'Arcade progress is in memory only for this visit.'
        : 'Arcade progress is saved in this browser.';

      var lead = message ? (message + ' ') : '';
      statusEl.textContent = lead + 'Route streak ' + arcade.streak + ', best ' + arcade.best + ', clears ' + arcade.completed + '. ' + memoryLine;
      if (arcade.streak > 0 || arcade.completed > 0) statusEl.classList.add('good');
      else statusEl.classList.remove('good');

      if (!arcade.challenge) {
        arcade.challenge = buildChallenge(7);
      }

      challengeEl.textContent = 'Challenge: ' + arcade.challenge.text;
      scoreEl.textContent = 'Streak ' + arcade.streak + ' · best ' + arcade.best + ' · sparks ' + arcade.sparks + '.';

      linkEl.href = arcade.challenge.href;
      linkEl.textContent = 'open ' + labelFor(arcade.challenge.href);
      linkEl.setAttribute('aria-disabled', 'false');

      while (logEl.firstChild) {
        logEl.removeChild(logEl.firstChild);
      }

      if (!arcade.log.length) {
        var empty = document.createElement('li');
        empty.className = 'wayfinding-arcade-empty';
        empty.textContent = 'No clears logged yet. Mark one challenge complete to seed this board.';
        logEl.appendChild(empty);
      } else {
        for (var j = 0; j < arcade.log.length; j++) {
          var row = document.createElement('li');
          row.textContent = arcade.log[j];
          logEl.appendChild(row);
        }
      }

      if (!host.hasAttribute('data-wayfinding-arcade-bound')) {
        host.setAttribute('data-wayfinding-arcade-bound', 'true');

        dealBtn.addEventListener('click', function () {
          arcade.challenge = buildChallenge(Math.floor(Math.random() * 131) + 19);
          var kept = persist();
          render('New challenge dealt.', kept);
        });

        completeBtn.addEventListener('click', function () {
          if (!arcade.challenge) arcade.challenge = buildChallenge(23);
          arcade.completed += 1;
          arcade.sparks += 1;
          arcade.streak += 1;
          if (arcade.streak > arcade.best) arcade.best = arcade.streak;
          pushLog('Cleared: ' + arcade.challenge.text);
          arcade.challenge = buildChallenge(arcade.completed * 17 + arcade.sparks * 11 + 29);
          var kept = persist();
          render('Challenge marked complete. One spark added.', kept);
        });

        spendBtn.addEventListener('click', function () {
          if (arcade.sparks < 1) {
            render('No sparks to spend yet. Clear one challenge first.', persist());
            return;
          }

          arcade.sparks -= 1;
          var reroute = findContrastingTarget(arcade.challenge ? arcade.challenge.href : '');
          if (reroute) {
            var actionSeed = hashText(reroute.href + '#' + arcade.completed + '#' + arcade.sparks);
            var action = pick(ACTIONS, actionSeed, 4);
            var bridge = pick(BRIDGES, actionSeed, 5);
            arcade.challenge = {
              id: reroute.href + '#spark-' + String(Math.abs(actionSeed % 100003)),
              href: reroute.href,
              text: 'Spark route: in ' + reroute.label + ', ' + action + '. ' + bridge
            };
            pushLog('Spark route: jump to ' + reroute.label + '.');
            var kept = persist();
            render('Spark spent. Route remixed.', kept);
            return;
          }

          var keptFallback = persist();
          render('Spark spent, but no reroute was available.', keptFallback);
        });
      }
    }
  }

  var read = store.read(KEY, {
    last: '',
    streak: 0,
    best: 0,
    sparks: 0,
    completed: 0,
    challenge: null,
    log: []
  });
  var readStatus = read.status;
  var arcade = normalize(read.value);

  if (readStatus === 'unreadable') {
    for (var i = 0; i < hosts.length; i++) {
      disableHost(hosts[i], 'Arcade memory is unreadable in this browser context. Clear state from the menu to restart it.');
    }
    return;
  }

  if (readStatus === 'ok' || readStatus === 'missing' || readStatus === 'unavailable') {
    if (arcade.last !== currentFile) {
      arcade.streak = arcade.last ? (arcade.streak + 1) : Math.max(1, arcade.streak || 1);
      arcade.last = currentFile;
      if (arcade.streak > arcade.best) arcade.best = arcade.streak;
    }

    if (!arcade.challenge) {
      arcade.challenge = buildChallenge(5);
    }

    var saved = persist();
    render('', saved);
  }
})();
