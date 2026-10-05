/*
  Shared relay switchboard for the constellation circuit pages.

  This panel is rendered through _includes/footer.njk across all constellation worlds and gives one
  federated lane system: previous/next world links plus one generated move card that points to a
  target world and a tiny action to try there.

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

  function normalize(value) {
    var out = {
      card: null
    };
    if (!value || typeof value !== 'object') return out;
    if (value.card && typeof value.card === 'object') {
      if (typeof value.card.href === 'string' && typeof value.card.text === 'string') {
        out.card = {
          href: value.card.href,
          text: value.card.text
        };
      }
    }
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

  function makeCard() {
    var lanes = laneLinks();
    var counts = relayCounts();
    var stars = starsCount();
    var here = indexOf(currentFile);
    var base = (Date.now() % 100003) + (counts.visited * 17) + (counts.loops * 31) + (stars * 13) + Math.max(0, here) * 7;

    var target = CIRCUIT[Math.abs(base) % CIRCUIT.length];
    if (target.href === currentFile) target = lanes.next;

    var move = pick(MOVES, base, 1);
    var bridge = pick(BRIDGES, base, 2);
    return {
      href: target.href,
      text: 'Move card: ' + move + ', then continue to ' + target.where + '. ' + bridge
    };
  }

  function persist() {
    return store.set(KEY, {
      card: deck.card
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
    followEl.href = card.href;

    var target = indexOf(card.href);
    followEl.textContent = target === -1 ? 'follow card' : ('follow card to ' + CIRCUIT[target].where);
    followEl.setAttribute('aria-disabled', 'false');
  }

  function render(savedOk) {
    applyLanes();
    applyCard();

    var counts = relayCounts();
    var stars = starsCount();
    var storageLine = savedOk ? 'Switchboard saved in this browser.' : 'Switchboard held in memory for this visit.';

    if (stars > 0) {
      statusEl.classList.add('good');
      statusEl.textContent = 'Relay lanes live: ' + counts.visited + ' of ' + CIRCUIT.length
        + ' marked, loops ' + counts.loops + ', stars ' + stars + '. ' + storageLine;
      return;
    }

    statusEl.classList.remove('good');
    statusEl.textContent = 'Relay lanes are ready. Place one star in the wish constellation to seed stronger cards. ' + storageLine;
  }

  function drawCard() {
    deck.card = makeCard();
    render(persist());
  }

  drawBtn.addEventListener('click', drawCard);

  var read = store.read(KEY, { card: null });
  var deck = normalize(read.value);
  if (!deck.card) deck.card = fallbackCard();

  render(persist());
})();
