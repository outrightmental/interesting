/*
  Shared relay switchboard for the constellation circuit pages.

  This panel is rendered through _includes/footer.njk across all constellation worlds and gives one
  federated lane system: previous/next world links plus a generated relay card that points to a
  target world and a tiny action to try there.

  This version extends that card into a persistent three-step relay chain. As visitors move through
  constellation worlds, the chain marks progress automatically, then mints a new chain when the
  current one is complete.

  State key inside the shared interestingState document: "constellation-switchboard".
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-switchboard-status');
  var cardEl = document.getElementById('constellation-switchboard-card');
  var prevEl = document.getElementById('constellation-switchboard-prev');
  var nextEl = document.getElementById('constellation-switchboard-next');
  var drawBtn = document.getElementById('constellation-switchboard-draw');
  var followEl = document.getElementById('constellation-switchboard-follow');

  if (!statusEl || !cardEl || !prevEl || !nextEl || !drawBtn || !followEl) return;

  var KEY = 'constellation-switchboard';
  var RELAY = 'constellation-relay';
  var SKY = 'constellation';

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

  var MOVES = [
    'remix one saved star before you leave',
    'capture one fresh line from this instrument',
    'switch one control and compare the new output',
    'mark one tiny observation in the readout',
    'nudge one parameter and rerun the reading',
    'follow one odd signal and keep its result',
    'try one playful variant before polishing',
    'freeze one frame and inspect what changed'
  ];

  var BRIDGES = [
    'Carry this output forward and reinterpret it there.',
    'Keep the same sky and test the shift in perspective.',
    'Run one pass there, then draw another card.',
    'Treat this as one relay leg, not a final stop.',
    'Use the same stars and look for a new answer.'
  ];

  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  function indexOf(href) {
    for (var i = 0; i < CIRCUIT.length; i++) {
      if (CIRCUIT[i].href === href) return i;
    }
    return -1;
  }

  function whereFor(href) {
    var idx = indexOf(href);
    return idx === -1 ? href : CIRCUIT[idx].where;
  }

  function countStars(value) {
    if (!Array.isArray(value)) return 0;
    var total = 0;
    for (var i = 0; i < value.length; i++) {
      var star = value[i];
      if (!star || typeof star !== 'object') continue;
      if (typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string') total += 1;
    }
    return total;
  }

  function relayCounts() {
    var read = store.read(RELAY, { visited: [], completed: 0 });
    if (read.status !== 'ok' || !read.value || typeof read.value !== 'object') {
      return { visited: 0, loops: 0 };
    }
    var visited = Array.isArray(read.value.visited) ? read.value.visited.length : 0;
    var loops = typeof read.value.completed === 'number' && read.value.completed > 0 ? Math.floor(read.value.completed) : 0;
    return { visited: visited, loops: loops };
  }

  function starsCount() {
    var read = store.read(SKY, []);
    if (read.status !== 'ok') return 0;
    return countStars(read.value);
  }

  function normalizeCard(value) {
    if (!value || typeof value !== 'object') return null;
    if (typeof value.href !== 'string' || typeof value.text !== 'string') return null;
    return { href: value.href, text: value.text };
  }

  function normalizeSteps(steps) {
    var out = [];
    if (!Array.isArray(steps)) return out;
    for (var i = 0; i < steps.length; i++) {
      if (typeof steps[i] !== 'string') continue;
      if (indexOf(steps[i]) === -1) continue;
      if (out.indexOf(steps[i]) !== -1) continue;
      out.push(steps[i]);
      if (out.length >= 3) break;
    }
    return out;
  }

  function normalizeChain(value) {
    var out = {
      id: '',
      steps: [],
      cursor: 0,
      completed: 0,
      lastMark: ''
    };

    if (!value || typeof value !== 'object') return out;

    if (typeof value.id === 'string') out.id = value.id;
    out.steps = normalizeSteps(value.steps);

    if (typeof value.cursor === 'number' && value.cursor > 0) {
      out.cursor = Math.floor(value.cursor);
    }

    if (typeof value.completed === 'number' && value.completed > 0) {
      out.completed = Math.floor(value.completed);
    }

    if (typeof value.lastMark === 'string') out.lastMark = value.lastMark;

    if (out.steps.length) {
      out.cursor = Math.max(0, Math.min(out.cursor, out.steps.length));
    } else {
      out.cursor = 0;
    }

    return out;
  }

  function normalize(value) {
    var out = {
      card: null,
      chain: normalizeChain(null)
    };
    if (!value || typeof value !== 'object') return out;
    out.card = normalizeCard(value.card);
    out.chain = normalizeChain(value.chain);
    return out;
  }

  function pick(list, seed, salt) {
    return list[Math.abs(seed + salt * 29) % list.length];
  }

  function laneLinks() {
    var here = indexOf(currentFile);
    if (here === -1) {
      return {
        prev: CIRCUIT[CIRCUIT.length - 1],
        next: CIRCUIT[0]
      };
    }
    return {
      prev: CIRCUIT[(here + CIRCUIT.length - 1) % CIRCUIT.length],
      next: CIRCUIT[(here + 1) % CIRCUIT.length]
    };
  }

  function fallbackCard() {
    var lanes = laneLinks();
    return {
      href: lanes.next.href,
      text: 'Move card: continue to ' + lanes.next.where + ' and run one reading there.'
    };
  }

  function chainToken(chain) {
    return currentFile + '#' + chain.id + '#' + chain.cursor;
  }

  function nextStep(chain) {
    if (!chain || !chain.steps.length) return null;
    if (chain.cursor >= chain.steps.length) return null;
    return chain.steps[chain.cursor];
  }

  function nextStepLabel(chain) {
    var href = nextStep(chain);
    return href ? whereFor(href) : null;
  }

  function chainProgress(chain) {
    if (!chain || !chain.steps.length) return '0/3';
    return Math.min(chain.cursor, chain.steps.length) + '/' + chain.steps.length;
  }

  function makeSeed(offset) {
    var counts = relayCounts();
    var stars = starsCount();
    var here = indexOf(currentFile);
    var extra = typeof offset === 'number' ? offset : 0;
    return ((Date.now() % 100003)
      + counts.visited * 17
      + counts.loops * 31
      + stars * 13
      + Math.max(0, here) * 7
      + deck.chain.completed * 19
      + extra) >>> 0;
  }

  function buildChain(seed) {
    var lanes = laneLinks();
    var available = CIRCUIT.map(function (node) { return node.href; }).filter(function (href) {
      return href !== currentFile;
    });

    var chain = {
      id: 'chain-' + String(Math.abs(seed % 100000)),
      steps: [],
      cursor: 0,
      completed: deck.chain.completed || 0,
      lastMark: ''
    };

    function pushStep(href) {
      if (!href) return;
      if (href === currentFile) return;
      if (chain.steps.indexOf(href) !== -1) return;
      chain.steps.push(href);
    }

    pushStep(lanes.next.href);

    var spin = seed >>> 0;
    while (chain.steps.length < 3 && available.length) {
      spin = (Math.imul(spin, 1664525) + 1013904223) >>> 0;
      var idx = spin % available.length;
      pushStep(available[idx]);
      available.splice(idx, 1);
    }

    while (chain.steps.length < 3) {
      pushStep(CIRCUIT[chain.steps.length % CIRCUIT.length].href);
      if (chain.steps.length >= CIRCUIT.length) break;
    }

    return chain;
  }

  function makeCardFromChain(chain, seed) {
    var stepHref = nextStep(chain);
    var move = pick(MOVES, seed, 1);
    var bridge = pick(BRIDGES, seed, 2);
    var labels = chain.steps.map(function (href) {
      return whereFor(href);
    });
    var route = labels.join(' -> ');

    if (!stepHref) {
      var lanes = laneLinks();
      return {
        href: lanes.next.href,
        text: 'Relay chain complete. Draw a new card to mint the next three-step route.'
      };
    }

    return {
      href: stepHref,
      text: 'Relay chain ' + chainProgress(chain) + ': ' + route + '. Next move: ' + move + ', then continue to ' + whereFor(stepHref) + '. ' + bridge
    };
  }

  function ensureChain(offset) {
    if (deck.chain.steps.length >= 3) return;
    var seed = makeSeed(offset || 0);
    deck.chain = buildChain(seed);
    deck.card = makeCardFromChain(deck.chain, seed);
  }

  function persist() {
    return store.set(KEY, {
      card: deck.card,
      chain: {
        id: deck.chain.id,
        steps: deck.chain.steps,
        cursor: deck.chain.cursor,
        completed: deck.chain.completed,
        lastMark: deck.chain.lastMark
      }
    });
  }

  function applyLanes() {
    var lanes = laneLinks();
    prevEl.href = lanes.prev.href;
    prevEl.textContent = 'previous: ' + lanes.prev.where;
    nextEl.href = lanes.next.href;
    nextEl.textContent = 'next: ' + lanes.next.where;
  }

  function applyCard() {
    var card = deck.card || fallbackCard();
    cardEl.textContent = card.text;

    var href = card.href;
    if (!href) {
      var lanes = laneLinks();
      href = lanes.next.href;
    }

    followEl.href = href;

    var target = indexOf(href);
    followEl.textContent = target === -1 ? 'follow card' : ('follow card to ' + CIRCUIT[target].where);
    followEl.setAttribute('aria-disabled', 'false');
  }

  function syncChainProgress() {
    var note = '';
    ensureChain(7);

    var target = nextStep(deck.chain);
    if (!target) return note;

    if (target === currentFile) {
      var token = chainToken(deck.chain);
      if (deck.chain.lastMark !== token) {
        deck.chain.lastMark = token;
        deck.chain.cursor += 1;

        if (deck.chain.cursor >= deck.chain.steps.length) {
          deck.chain.completed += 1;
          note = 'Relay chain complete. New chain minted.';
          deck.chain = buildChain(makeSeed(97 + deck.chain.completed * 11));
        } else {
          note = 'Relay chain advanced to ' + chainProgress(deck.chain) + '.';
        }
      }
    }

    deck.card = makeCardFromChain(deck.chain, makeSeed(3));
    return note;
  }

  function render(savedOk, note) {
    ensureChain(1);
    applyLanes();
    applyCard();

    var counts = relayCounts();
    var stars = starsCount();
    var nextLabel = nextStepLabel(deck.chain);
    var progress = chainProgress(deck.chain);
    var memoryLine = savedOk ? 'Switchboard saved in this browser.' : 'Switchboard held in memory for this visit.';

    var chainLine = 'Chain ' + progress + ' · completed chains ' + deck.chain.completed + '.';
    if (nextLabel) {
      chainLine += ' Next: ' + nextLabel + '.';
    }

    var lead = note ? (note + ' ') : '';

    if (stars > 0) {
      statusEl.classList.add('good');
      statusEl.textContent = lead + 'Relay lanes live: ' + counts.visited + ' of ' + CIRCUIT.length
        + ' marked, loops ' + counts.loops + ', stars ' + stars + '. '
        + chainLine + ' ' + memoryLine;
      return;
    }

    statusEl.classList.remove('good');
    statusEl.textContent = lead + 'Relay lanes are ready. Place one star in the wish constellation to seed stronger cards. '
      + chainLine + ' ' + memoryLine;
  }

  function drawCard() {
    var seed = makeSeed(211 + deck.chain.completed * 13 + deck.chain.cursor * 5);
    deck.chain = buildChain(seed);
    deck.card = makeCardFromChain(deck.chain, seed);
    render(persist(), 'New relay chain drawn.');
  }

  drawBtn.addEventListener('click', drawCard);

  var read = store.read(KEY, { card: null, chain: null });
  var deck = normalize(read.value);

  ensureChain(0);
  if (!deck.card) {
    deck.card = makeCardFromChain(deck.chain, makeSeed(5));
  }

  var note = syncChainProgress();
  render(persist(), note);
})();