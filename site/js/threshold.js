/* The mood flow asks a sideways question before suggesting a world. The threshold hosts the question in its stage, the persona's ask leads there from every other page, and the mood atlas shows where each reading leads. Readings live in the shared state document. */
(function () {
  'use strict';

  var store = window.interestingState;
  var READING = 'threshold';
  var RECENT = 6;
  var HALF_LIFE_H = 30;
  var ANSWER_PULL = 3;
  var SIGNAL_PULL = 1;
  var ARRIVAL_GAP_MS = 30 * 60 * 1000;

  var ORIENTATIONS = [
    { id: 'tender', name: 'banked low', pull: 'wants less asked of it', world: 'quiet-room.html' },
    { id: 'restless', name: 'wound tight', pull: 'wants to shove something and watch it go', world: 'kinetic-floor.html' },
    { id: 'analytic', name: 'cold and clear', pull: 'wants a mechanism to take apart', world: 'machine-shop.html' },
    { id: 'rooted', name: 'low and slow', pull: 'wants something that grows downward', world: 'loam.html' },
    { id: 'verbal', name: 'full of half-sentences', pull: 'wants words put in the fire', world: 'word-kiln.html' },
    { id: 'curious', name: 'magpie', pull: 'wants a strange specimen in a drawer', world: 'apocrypha-desk.html' },
    { id: 'cosmic', name: 'looking up', pull: 'wants distance and scale', world: 'wish-constellation.html' },
    { id: 'ceremonial', name: 'wants a rite', pull: 'wants to light something on purpose', world: 'star-lantern.html' },
    { id: 'brooding', name: 'in the long look', pull: 'wants to re-read its own record', world: 'constellation-diary.html' },
    { id: 'tempestuous', name: 'weather coming', pull: 'wants pressure, front and squall', world: 'constellation-weather.html' },
    { id: 'attentive', name: 'ears first', pull: 'wants to listen to something decay', world: 'constellation-echo.html' },
    { id: 'tending', name: 'minding something', pull: 'wants a living thing to keep', world: 'wish-terrarium.html' },
    { id: 'divinatory', name: 'asking elsewhere', pull: 'wants an answer it did not author', world: 'sky-archive.html' },
    { id: 'geometric', name: 'after symmetry', pull: 'wants a pattern to close', world: 'orbital-weaver.html' },
    { id: 'metrical', name: 'counting in echoes', pull: 'wants a pulse to keep time with', world: 'pulse-loom.html' }
  ];

  var worldData = document.getElementById('site-worlds');
  var worldList = worldData ? JSON.parse(worldData.textContent) : [];
  ORIENTATIONS.forEach(function (orientation) {
    var world = worldList.find(function (entry) { return entry.file === orientation.world; });
    if (!world) throw new Error('Missing world in the shared list: ' + orientation.world);
    orientation.worldName = world.name;
  });

  var PROBES = [
    {
      probe: 'doorway', name: 'four doors', kind: 'choice',
      ask: 'Four doors, all unlocked. One of them is already ajar, and it is not the one you want.',
      options: [
        { label: 'the one with a draught under it', detail: 'cold air, and a sound like far-off traffic', weights: { cosmic: 3, restless: 2, tempestuous: 2 } },
        { label: 'the one that smells of wet soil', detail: 'something is growing on the other side', weights: { rooted: 3, tending: 2, tender: 1 } },
        { label: 'the one with a light under it', detail: 'someone left a lamp on and a page half-turned', weights: { verbal: 3, brooding: 2, curious: 1 } },
        { label: 'the one that hums', detail: 'a machine behind it, running without supervision', weights: { analytic: 3, geometric: 2, metrical: 2, attentive: 1 } }
      ]
    },
    {
      probe: 'pocket', name: 'one object for the pocket', kind: 'choice',
      ask: 'You are going out. One object fits in the pocket. The rest stay on the table.',
      options: [
        { label: 'a short crowbar', detail: 'nothing in particular to open yet', weights: { restless: 3, tempestuous: 2, analytic: 1 } },
        { label: 'a folding magnifier', detail: 'scratched, 10x, slightly loose', weights: { curious: 3, analytic: 2, attentive: 1 } },
        { label: 'a square of blanket', detail: 'cut from something older, kept for no reason', weights: { tender: 3, rooted: 2, tending: 1 } },
        { label: 'a pocket notebook', detail: 'two thirds used, the pencil lost', weights: { verbal: 3, brooding: 2, curious: 1 } },
        { label: 'a small brass bell', detail: 'it only rings when you mean it to', weights: { ceremonial: 3, attentive: 2, divinatory: 1 } }
      ]
    },
    {
      probe: 'window', name: 'the window', kind: 'choice',
      ask: 'There is one window in this room and you get to decide what is behind it.',
      options: [
        { label: 'a flat black sky, no cloud', detail: 'and whatever is up there, up there', weights: { cosmic: 3, brooding: 2, geometric: 1 } },
        { label: 'weather arriving sideways', detail: 'the glass is already wet', weights: { tempestuous: 3, restless: 2, attentive: 1 } },
        { label: 'a courtyard with one tree in it', detail: 'the tree is doing fine', weights: { rooted: 3, tending: 2, tender: 2 } },
        { label: 'a lit workshop across the way', detail: 'someone is still in there, making something', weights: { analytic: 3, verbal: 1, curious: 2 } }
      ]
    },
    {
      probe: 'stone', name: 'four stones', kind: 'choice',
      ask: 'Four stones on a shelf. Pick one up -- you will be carrying it for a while.',
      options: [
        { label: 'the heavy one', detail: 'river-smoothed, cold, two hands', weights: { rooted: 3, brooding: 2, tender: 1 } },
        { label: 'the sharp one', detail: 'freshly broken, one edge still bright', weights: { restless: 3, analytic: 2, tempestuous: 1 } },
        { label: 'the pierced one', detail: 'a hole worn clean through by water', weights: { divinatory: 3, curious: 2, ceremonial: 2 } },
        { label: 'the one with a fossil in it', detail: 'a coil, pressed flat, very old', weights: { curious: 3, brooding: 2, geometric: 1 } }
      ]
    },
    {
      probe: 'misfit', name: 'the odd one out', kind: 'choice',
      ask: 'Five things are on the table. Four of them belong together. Take away the one that does not.',
      options: [
        { label: 'a tuning fork', detail: 'because the others are silent', weights: { attentive: 3, metrical: 2, ceremonial: 1, analytic: 1 } },
        { label: 'a pressed leaf', detail: 'because the others were made', weights: { rooted: 3, tending: 2 } },
        { label: 'a six-sided die', detail: 'because the others are not asking anything', weights: { divinatory: 3, curious: 1, restless: 1 } },
        { label: 'a torn ticket stub', detail: 'because the others have no date on them', weights: { brooding: 3, verbal: 2 } },
        { label: 'a hexagonal nut', detail: 'because the others are not part of anything', weights: { analytic: 3, geometric: 2 } }
      ]
    },
    {
      probe: 'bench', name: 'the workbench', kind: 'sequence',
      ask: 'A workbench, four objects. Take three, in order: the one nearest the door first, the one nearest the window last.',
      take: 3,
      items: [
        { label: 'a warm mug', detail: 'still steaming', slots: [{ tender: 2, rooted: 1 }, { attentive: 1, verbal: 1 }, { ceremonial: 1, brooding: 1 }] },
        { label: 'a brass compass', detail: 'needle wandering, then settling', slots: [{ analytic: 2, geometric: 1 }, { curious: 2, divinatory: 1 }, { cosmic: 2, restless: 1 }] },
        { label: 'a hand bell', detail: 'wrapped in cloth', slots: [{ ceremonial: 2, attentive: 1 }, { divinatory: 2, verbal: 1 }, { tempestuous: 2, restless: 1 }] },
        { label: 'a packet of seeds', detail: 'label smudged', slots: [{ tending: 2, rooted: 2 }, { tender: 1, curious: 1 }, { cosmic: 1, brooding: 1 }] }
      ]
    },
    {
      probe: 'shelf-jars', name: 'the shelf of jars', kind: 'sequence',
      ask: 'Five jars on a shelf. Pull three forward, in order: the first is what you trust, the last is what you open first.',
      take: 3,
      items: [
        { label: 'the jar of nails', detail: 'sorted by length, labelled in pencil', slots: [{ analytic: 2, geometric: 1 }, { restless: 1, tempestuous: 1 }, { analytic: 1, verbal: 1 }] },
        { label: 'the jar of rainwater', detail: 'clear, with one willow leaf', slots: [{ attentive: 2, cosmic: 1 }, { divinatory: 2, brooding: 1 }, { attentive: 1, tender: 1 }] },
        { label: 'the jar of match stubs', detail: 'burnt ends and one unstruck head', slots: [{ ceremonial: 2, restless: 1 }, { tempestuous: 2, verbal: 1 }, { ceremonial: 1, curious: 1 }] },
        { label: 'the jar of sea glass', detail: 'frosted green and cloudy white', slots: [{ curious: 2, cosmic: 1 }, { brooding: 2, attentive: 1 }, { curious: 1, geometric: 1 }] },
        { label: 'the jar of seed pods', detail: 'light as paper, still rattling', slots: [{ rooted: 2, tending: 2 }, { tender: 2, rooted: 1 }, { tending: 1, divinatory: 1 }] }
      ]
    },
    {
      probe: 'stair', name: 'three landings', kind: 'choice',
      ask: 'Three landings, and no going back up. Pick a way down.',
      steps: [
        { ask: 'First landing. Two corridors.', options: [
          { label: 'the one that gets narrower', detail: 'and warmer', weights: { tender: 2, brooding: 2, rooted: 1 } },
          { label: 'the one that opens out', detail: 'and gets colder', weights: { cosmic: 2, restless: 2, tempestuous: 1 } }
        ] },
        { ask: 'Second landing. Something is on the floor.', options: [
          { label: 'step over it', detail: 'you have somewhere to be', weights: { restless: 2, analytic: 1, geometric: 1 } },
          { label: 'crouch down and look', detail: 'you did not have anywhere to be', weights: { curious: 2, attentive: 1, tending: 1 } }
        ] },
        { ask: 'Third landing. A door, and a window beside it.', options: [
          { label: 'the door', detail: 'it is a door, after all', weights: { ceremonial: 2, verbal: 1, analytic: 1 } },
          { label: 'the window', detail: 'it is only one floor down', weights: { divinatory: 2, cosmic: 1, restless: 1 } }
        ] }
      ]
    },
    {
      probe: 'volley', name: 'five quick pairs', kind: 'choice', quick: true,
      ask: 'Five pairs, no thinking. Whichever one you would rather have in the room.',
      steps: [
        { ask: 'one or the other', options: [
          { label: 'a kettle', weights: { tender: 2, rooted: 1 } },
          { label: 'a siren', weights: { tempestuous: 2, restless: 1 } }
        ] },
        { ask: 'one or the other', options: [
          { label: 'graph paper', weights: { geometric: 2, analytic: 1 } },
          { label: 'a blank envelope', weights: { verbal: 2, divinatory: 1 } }
        ] },
        { ask: 'one or the other', options: [
          { label: 'moss', weights: { rooted: 2, tending: 1 } },
          { label: 'mirror glass', weights: { geometric: 2, cosmic: 1 } }
        ] },
        { ask: 'one or the other', options: [
          { label: 'a long echo', weights: { attentive: 2, metrical: 1, brooding: 1 } },
          { label: 'a struck match', weights: { ceremonial: 2, curious: 1 } }
        ] },
        { ask: 'one or the other', options: [
          { label: 'a locked drawer', weights: { curious: 2, divinatory: 1 } },
          { label: 'an open hand', weights: { tender: 2, tending: 1 } }
        ] }
      ]
    },
    {
      probe: 'tempo', name: 'five taps', kind: 'tap',
      ask: 'Tap this five times, at whatever rate feels like the rate.', label: 'tap',
      buckets: [
        { under: 220, weights: { restless: 3, tempestuous: 2, verbal: 1 } },
        { under: 420, weights: { metrical: 3, analytic: 2, geometric: 2, curious: 2 } },
        { under: 800, weights: { attentive: 2, tending: 2, verbal: 1 } },
        { under: 1600, weights: { brooding: 2, rooted: 2, ceremonial: 1 } },
        { under: Infinity, weights: { tender: 3, cosmic: 2, brooding: 1 } }
      ],
      wobble: { steady: { metrical: 2, geometric: 2, analytic: 1 }, loose: { tempestuous: 2, curious: 1 } }
    },
    {
      probe: 'hold', name: 'press and hold', kind: 'hold',
      ask: 'Press this and keep pressing. Let go when it has been enough.', label: 'press and hold',
      buckets: [
        { under: 500, weights: { restless: 3, analytic: 1 } },
        { under: 1500, weights: { curious: 2, verbal: 2, geometric: 1 } },
        { under: 3500, weights: { attentive: 2, tending: 2, ceremonial: 1 } },
        { under: 7000, weights: { brooding: 2, rooted: 2, tender: 1 } },
        { under: Infinity, weights: { tender: 3, cosmic: 2, divinatory: 1 } }
      ]
    },
    {
      probe: 'placement', name: 'one mark', kind: 'place',
      ask: 'One mark, anywhere in the field. There is no wrong place and no second go.',
      corners: {
        topLeft: { cosmic: 3, brooding: 1 }, topRight: { tempestuous: 3, restless: 1 },
        bottomLeft: { rooted: 3, tender: 1 }, bottomRight: { analytic: 2, geometric: 2 }
      },
      centre: { divinatory: 2, attentive: 1 }, edge: { curious: 2, verbal: 1 }
    },
    {
      probe: 'stroke', name: 'one line', kind: 'draw',
      ask: 'Draw one line across this. Any line. Lift your hand when it is done.',
      short: { tender: 2, analytic: 1 }, long: { restless: 2, tempestuous: 1 },
      straight: { geometric: 3, analytic: 1 }, curved: { tending: 2, verbal: 2, attentive: 1 },
      jagged: { tempestuous: 3, restless: 1 }
    },
    {
      probe: 'lit-windows', name: 'the lit windows', kind: 'windows',
      ask: 'A building has nine dark windows. Light any three; the shape they make opens a world.',
      windows: [
        { label: 'upper left', weights: { cosmic: 3, brooding: 1 } },
        { label: 'upper middle', weights: { attentive: 3, metrical: 1 } },
        { label: 'upper right', weights: { tempestuous: 3, restless: 1 } },
        { label: 'middle left', weights: { verbal: 3, curious: 1 } },
        { label: 'centre', weights: { divinatory: 3, ceremonial: 1 } },
        { label: 'middle right', weights: { analytic: 3, geometric: 1 } },
        { label: 'lower left', weights: { rooted: 3, tender: 1 } },
        { label: 'lower middle', weights: { tending: 3, tender: 1 } },
        { label: 'lower right', weights: { restless: 3, geometric: 1 } }
      ]
    },
    {
      probe: 'hanging-bowls', name: 'the hanging balance', kind: 'balance',
      ask: 'Seven brass weights and three hanging bowls. Press a bowl to give it a weight; divide all seven, then leave them hanging.',
      total: 7,
      bowls: [
        { label: 'the key bowl', place: 'left', weights: { analytic: 3, geometric: 2, restless: 1, curious: 1 } },
        { label: 'the shell bowl', place: 'middle', weights: { attentive: 3, cosmic: 2, brooding: 1, divinatory: 1 } },
        { label: 'the seed bowl', place: 'right', weights: { tending: 3, rooted: 2, tender: 1, ceremonial: 1, verbal: 1 } }
      ],
      even: { geometric: 3, metrical: 2, tender: 1 },
      spare: { curious: 2, tempestuous: 1, verbal: 1 },
      gathered: { ceremonial: 2, divinatory: 2, restless: 1 }
    },
    {
      probe: 'dial', name: 'the dial', kind: 'slider',
      ask: 'Set the room. The dial does not say what it does.',
      low: 'frost on the inside of the glass', high: 'a kettle just off the boil',
      cold: { cosmic: 3, geometric: 2, analytic: 2, brooding: 1 },
      warm: { tender: 3, rooted: 2, tending: 2, ceremonial: 1 }
    },
    {
      probe: 'nightfall', name: 'the stars coming out', kind: 'sky',
      ask: 'The sky is going dark and the stars are coming out, one at a time. Say when there are enough.',
      label: 'enough', hurry: 'hurry one along', full: 48,
      buckets: [
        { under: 4, weights: { tender: 3, brooding: 2, rooted: 1 } },
        { under: 9, weights: { attentive: 3, divinatory: 2, geometric: 1 } },
        { under: 16, weights: { analytic: 2, verbal: 2, curious: 1, tending: 1 } },
        { under: 28, weights: { ceremonial: 2, cosmic: 2, metrical: 1, tending: 1 } },
        { under: Infinity, weights: { cosmic: 3, tempestuous: 2, restless: 1 } }
      ],
      filled: { brooding: 2, cosmic: 1, tender: 1 },
      waited: { attentive: 1, brooding: 1 },
      kindled: { ceremonial: 2, tending: 1, curious: 1 },
      hurried: { restless: 3, tempestuous: 1, verbal: 1 }
    },
    {
      probe: 'key-ring', name: 'seven keys', kind: 'keys',
      ask: 'A locked door, and seven keys on a ring. Any of them turns the lock. Weigh as many as you like in your hand; the one you try is the answer.',
      keys: [
        { label: 'the iron key', detail: 'heavy, cold, and older than the door', weights: { rooted: 3, tender: 1 } },
        { label: 'the clockwork key', detail: 'square-shanked, made for winding something', weights: { metrical: 3, analytic: 2, geometric: 1 } },
        { label: 'the glass key', detail: 'you can see the wards of the lock through it', weights: { divinatory: 3, cosmic: 1 } },
        { label: 'the bent key', detail: 'bent once and straightened; it still turns', weights: { restless: 3, tempestuous: 2 } },
        { label: 'the small bright key', detail: 'for a diary, or a music box', weights: { tender: 2, brooding: 2, verbal: 1 } },
        { label: 'the skeleton key', detail: 'opens many doors and belongs to none', weights: { curious: 3, cosmic: 2 } },
        { label: 'the wooden key', detail: 'carved from memory, to copy one that was lost', weights: { tending: 3, ceremonial: 2, verbal: 1 } }
      ],
      first: { restless: 2, divinatory: 1 },
      few: { attentive: 2, analytic: 1 },
      many: { brooding: 2, curious: 1 },
      all: { ceremonial: 2, metrical: 1 }
    },
    {
      probe: 'knock', name: 'the knock', kind: 'knock',
      ask: 'A door, and no one expecting you. Knock the way you would knock.',
      label: 'knock', done: 'that is my knock',
      buckets: [
        { under: 2, weights: { brooding: 3, tender: 2, divinatory: 1 } },
        { under: 3, weights: { analytic: 3, geometric: 2, attentive: 1 } },
        { under: 4, weights: { ceremonial: 3, metrical: 2, verbal: 1 } },
        { under: 6, weights: { curious: 2, tending: 2, rooted: 2, verbal: 1 } },
        { under: Infinity, weights: { restless: 3, tempestuous: 2, cosmic: 1 } }
      ],
      even: { metrical: 2, geometric: 1, analytic: 1 },
      swung: { curious: 2, verbal: 2, ceremonial: 1 },
      quickening: { tempestuous: 2, restless: 1, cosmic: 1 },
      slowing: { tender: 2, brooding: 1, rooted: 1 },
      waited: { attentive: 2, brooding: 1, divinatory: 1 },
      sudden: { restless: 2, tempestuous: 1, verbal: 1 }
    }
  ];

  var ORIENTATION_BY_ID = {};
  for (var oi = 0; oi < ORIENTATIONS.length; oi++) ORIENTATION_BY_ID[ORIENTATIONS[oi].id] = ORIENTATIONS[oi];
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(calm && calm.matches); }

  function load() {
    var blank = { visits: 0, last: null, drift: {}, recent: [], orientation: null };
    var parsed = store.get(READING, blank);
    if (!parsed || typeof parsed !== 'object') return blank;
    return {
      visits: typeof parsed.visits === 'number' ? parsed.visits : 0,
      last: typeof parsed.last === 'number' ? parsed.last : null,
      drift: parsed.drift && typeof parsed.drift === 'object' ? parsed.drift : {},
      recent: Array.isArray(parsed.recent) ? parsed.recent.slice(-RECENT) : [],
      orientation: ORIENTATION_BY_ID[parsed.orientation] ? parsed.orientation : null
    };
  }

  function save(next) { store.set(READING, next); }
  var state = load();
  // The one writer: everything the threshold keeps goes through here, so the shape of the
  // reading's record is written once.
  function persist() {
    save({ visits: state.visits, last: state.last, drift: state.drift,
      recent: state.recent, orientation: state.orientation });
  }
  var sinceLast = state.last ? Math.max(0, Date.now() - state.last) : null;
  function memoryPull() {
    if (sinceLast === null) return 0;
    return Math.pow(0.5, (sinceLast / 3600000) / HALF_LIFE_H);
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function sinceText() {
    if (sinceLast === null) return 'first arrival on this machine';
    var minutes = Math.round(sinceLast / 60000);
    if (minutes < 1) return 'last here a moment ago';
    if (minutes < 60) return 'last here ' + plural(minutes, 'minute') + ' ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return 'last here ' + plural(hours, 'hour') + ' ago';
    var days = Math.round(hours / 24);
    if (days < 14) return 'last here ' + plural(days, 'day') + ' ago';
    if (days < 70) return 'last here ' + plural(Math.round(days / 7), 'week') + ' ago';
    return 'last here ' + plural(Math.round(days / 30), 'month') + ' ago';
  }

  var PARTS = [
    { until: 5, part: 'the small hours', weights: { cosmic: 2, brooding: 2, tender: 1, divinatory: 1 } },
    { until: 8, part: 'first light', weights: { rooted: 2, tender: 2, tending: 1 } },
    { until: 12, part: 'the morning', weights: { analytic: 2, verbal: 2, geometric: 1 } },
    { until: 15, part: 'the middle of the day', weights: { restless: 2, curious: 2, analytic: 1 } },
    { until: 18, part: 'the afternoon', weights: { curious: 2, tending: 1, verbal: 1 } },
    { until: 21, part: 'dusk', weights: { ceremonial: 2, attentive: 2, brooding: 1 } },
    { until: 24, part: 'the night', weights: { cosmic: 2, tempestuous: 1, attentive: 1, ceremonial: 1 } }
  ];
  var REGIONS = {
    America: { restless: 1, verbal: 1 }, Europe: { brooding: 1, analytic: 1 },
    Africa: { rooted: 1, ceremonial: 1 }, Asia: { geometric: 1, attentive: 1 },
    Australia: { tempestuous: 1, curious: 1 }, Pacific: { cosmic: 1, tending: 1 },
    Atlantic: { tempestuous: 1, divinatory: 1 }, Indian: { tending: 1, divinatory: 1 },
    Antarctica: { cosmic: 2, tender: 1 }
  };

  function signals() {
    var now = new Date();
    var hour = now.getHours();
    var zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
    catch (e) { zone = ''; }
    var slot = PARTS[0];
    for (var i = 0; i < PARTS.length; i++) {
      if (hour < PARTS[i].until) { slot = PARTS[i]; break; }
    }
    return {
      hour: hour,
      clock: String(hour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      zone: zone, region: zone.split('/')[0] || '', offset: -now.getTimezoneOffset() / 60,
      part: slot.part, weights: slot.weights, visits: state.visits,
      sinceLast: sinceLast, sinceText: sinceText()
    };
  }
  function add(into, weights, factor) {
    for (var id in weights) {
      if (!Object.prototype.hasOwnProperty.call(weights, id) || !ORIENTATION_BY_ID[id]) continue;
      into[id] = (into[id] || 0) + weights[id] * factor;
    }
    return into;
  }
  function signalWeights(s) {
    var out = {};
    add(out, s.weights, 1);
    add(out, REGIONS[s.region] || {}, 1);
    if (Math.abs(s.offset) >= 7) add(out, { cosmic: 1, curious: 1 }, 1);
    if (sinceLast !== null && sinceLast > 14 * 86400000) add(out, { curious: 2, restless: 1 }, 1);
    return out;
  }
  function ranked(scores) {
    var list = ORIENTATIONS.filter(function (o) { return scores[o.id]; });
    list.sort(function (a, b) { return scores[b.id] - scores[a.id]; });
    return list;
  }
  function readingFor(answer) {
    var s = signals();
    var scores = {};
    add(scores, signalWeights(s), SIGNAL_PULL);
    add(scores, state.drift, memoryPull());
    if (answer) add(scores, answer, ANSWER_PULL);
    var order = ranked(scores);
    return {
      orientation: order[0] ? ORIENTATION_BY_ID[order[0].id] : null,
      alternates: order.slice(1, 4), scores: scores, signals: s,
      source: answer ? 'answer' : 'signals'
    };
  }
  function transmogrify(orientation) {
    var root = document.documentElement;
    if (orientation) root.setAttribute('data-mood', orientation.id);
    else root.removeAttribute('data-mood');
    try {
      window.dispatchEvent(new CustomEvent('threshold:reading', {
        detail: { orientation: orientation ? orientation.id : null }
      }));
    } catch (e) { /* Older browsers still receive the palette attribute. */ }
  }
  var lastAnswered = null;
  function record(answer) {
    var reading = readingFor(answer);
    var drift = {};
    add(drift, state.drift, memoryPull());
    if (answer) add(drift, answer, 1);
    state.drift = drift;
    state.orientation = reading.orientation ? reading.orientation.id : null;
    state.last = Date.now();
    persist();
    lastAnswered = reading.orientation ? reading : null;
    transmogrify(reading.orientation);
    return reading;
  }
  function noteProbe(id) {
    if (state.recent[state.recent.length - 1] === id) return;
    state.recent = state.recent.concat([id]).slice(-RECENT);
    persist();
  }
  function nextProbe() {
    var fresh = PROBES.filter(function (p) { return state.recent.indexOf(p.probe) === -1; });
    var pool = fresh.length ? fresh : PROBES.filter(function (p) {
      return p.probe !== state.recent[state.recent.length - 1];
    });
    if (!pool.length) pool = PROBES;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function probeById(id) {
    for (var i = 0; i < PROBES.length; i++) if (PROBES[i].probe === id) return PROBES[i];
    return null;
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  // A CSS colour as [r, g, b]: the palette seeds are hex, and anything else falls back.
  function rgbOf(value, fallback) {
    var v = String(value || '').trim();
    var m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) {
      var nums = v.match(/[\d.]+/g);
      if (nums && nums.length >= 3 && /^rgb/i.test(v)) return nums.slice(0, 3).map(Number);
      return rgbOf(fallback, '#9fcbff');
    }
    var hex = m[1];
    if (hex.length === 3) hex = hex.replace(/./g, function (c) { return c + c; });
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // And back again: a CSS rgba() from one of those, and the blend of two of them.
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, a).toFixed(3) + ')'; }
  function blend(a, b, t) {
    return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); });
  }
  function mount(host, options) {
    if (!host) return null;
    var opts = options || {};
    var selector = host.id === 'persona-probe' ? document.getElementById('threshold-way') : null;
    var requested = opts.probe || (selector && selector.value);
    var probe = requested ? probeById(requested) : nextProbe();
    if (!probe) return null;
    if (selector) selector.value = '';
    noteProbe(probe.probe);
    host.textContent = '';
    host.setAttribute('data-probe', probe.probe);
    var answer = {};
    var frame = el('div', 'probe');
    var ask = el('p', 'probe-ask', probe.ask);
    ask.id = 'probe-ask-' + probe.probe;
    frame.appendChild(ask);
    frame.appendChild(el('p', 'probe-count', 'There is no right answer, and you can skip it.'));
    var body = el('div', 'probe-body');
    frame.appendChild(body);
    var trace = el('p', 'probe-trace');
    trace.setAttribute('aria-live', 'polite');
    frame.appendChild(trace);
    var meter = el('p', 'probe-trace probe-meter');
    meter.setAttribute('aria-hidden', 'true');
    frame.appendChild(meter);
    trace.meter = meter;
    var skip = el('button', 'probe-option probe-skip', 'skip the question');
    skip.type = 'button';
    skip.addEventListener('click', function () {
      host.textContent = '';
      if (typeof opts.onSkip === 'function') opts.onSkip(probe);
    });
    frame.appendChild(skip);
    host.appendChild(frame);
    var answered = false;
    function finish() {
      if (answered) return;
      answered = true;
      skip.hidden = true;
      var reading = record(answer);
      trace.textContent = '';
      if (typeof opts.onAnswer === 'function') opts.onAnswer(reading, probe);
    }
    var kinds = {
      choice: choiceProbe, sequence: sequenceProbe, tap: tapProbe, hold: holdProbe,
      place: placeProbe, draw: drawProbe, windows: windowsProbe, balance: balanceProbe,
      slider: sliderProbe, sky: skyProbe, keys: keysProbe, knock: knockProbe
    };
    (kinds[probe.kind] || choiceProbe)(probe, body, trace, answer, finish);
    return probe;
  }
  function choiceProbe(probe, body, trace, answer, finish) {
    var steps = probe.steps || [{ ask: null, options: probe.options }];
    var index = 0;
    function step() {
      body.textContent = '';
      var stage = steps[index];
      if (stage.ask && steps.length > 1 && !probe.quick) body.appendChild(el('p', 'probe-step', stage.ask));
      var group = el('div', 'probe-options');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'choices');
      stage.options.forEach(function (option) {
        var button = el('button', 'probe-option');
        button.type = 'button';
        button.appendChild(el('span', 'probe-option-label', option.label));
        if (option.detail) button.appendChild(el('span', 'probe-option-detail', option.detail));
        button.addEventListener('click', function () {
          add(answer, option.weights, 1);
          index += 1;
          if (index < steps.length) {
            trace.textContent = 'noted: ' + option.label;
            step();
          } else {
            body.textContent = '';
            finish();
          }
        });
        group.appendChild(button);
      });
      body.appendChild(group);
      if (steps.length > 1) body.appendChild(el('p', 'probe-count',
        (probe.quick ? 'pair ' : '') + (index + 1) + ' of ' + steps.length));
      var first = group.querySelector('button');
      if (first && index > 0) first.focus();
    }
    step();
  }
  function sequenceProbe(probe, body, trace, answer, finish) {
    var items = Array.isArray(probe.items) ? probe.items.slice() : [];
    var target = Math.max(1, Math.min(items.length, probe.take || items.length));
    var picked = [];
    function remaining() { return items.filter(function (item) { return picked.indexOf(item) === -1; }); }
    function scoreAndFinish() {
      for (var i = 0; i < picked.length; i++) {
        if (picked[i].slots && picked[i].slots[i]) add(answer, picked[i].slots[i], 1);
      }
      finish();
    }
    function redraw() {
      body.textContent = '';
      if (picked.length) {
        body.appendChild(el('p', 'probe-step', 'chosen order: ' + picked.map(function (item) {
          return item.label;
        }).join(' → ')));
      }
      var options = remaining();
      if (picked.length < target && options.length) {
        var group = el('div', 'probe-options');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'objects to place');
        options.forEach(function (item) {
          var button = el('button', 'probe-option');
          button.type = 'button';
          button.appendChild(el('span', 'probe-option-label', item.label));
          if (item.detail) button.appendChild(el('span', 'probe-option-detail', item.detail));
          button.addEventListener('click', function () {
            picked.push(item);
            trace.textContent = 'placed: ' + item.label;
            if (picked.length >= target) scoreAndFinish();
            else redraw();
          });
          group.appendChild(button);
        });
        body.appendChild(group);
      }
      var left = target - picked.length;
      body.appendChild(el('p', 'probe-count', left > 0 ? left + ' to place' : 'reading order'));
      var controls = el('div', 'controls');
      var undo = el('button', 'probe-option probe-undo', 'undo last');
      undo.type = 'button';
      undo.disabled = picked.length === 0;
      undo.addEventListener('click', function () {
        if (!picked.length) return;
        picked.pop();
        trace.textContent = 'last object removed';
        redraw();
      });
      controls.appendChild(undo);
      var reset = el('button', 'probe-option probe-undo', 'start over');
      reset.type = 'button';
      reset.disabled = picked.length === 0;
      reset.addEventListener('click', function () {
        picked = [];
        trace.textContent = 'order reset';
        redraw();
      });
      controls.appendChild(reset);
      body.appendChild(controls);
    }
    redraw();
  }
  function tapProbe(probe, body, trace, answer, finish) {
    var taps = [];
    var button = el('button', 'probe-big');
    button.type = 'button';
    button.textContent = probe.label + ' (5)';
    button.addEventListener('click', function () {
      taps.push(Date.now());
      var left = 5 - taps.length;
      button.textContent = left > 0 ? probe.label + ' (' + left + ')' : 'done';
      trace.textContent = left > 0 ? left + ' to go' : 'reading the interval';
      if (taps.length < 5) return;
      var gaps = [];
      for (var i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      var mean = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
      var spread = 0;
      for (var j = 0; j < gaps.length; j++) spread += Math.abs(gaps[j] - mean);
      spread /= gaps.length;
      bucket(probe.buckets, mean, answer);
      add(answer, spread < mean * 0.22 ? probe.wobble.steady : probe.wobble.loose, 1);
      button.disabled = true;
      finish();
    });
    body.appendChild(button);
  }
  function holdProbe(probe, body, trace, answer, finish) {
    var started = 0;
    var ticker = null;
    var button = el('button', 'probe-big');
    button.type = 'button';
    button.textContent = probe.label;
    function down() {
      if (started) return;
      started = Date.now();
      button.classList.add('held');
      trace.textContent = 'holding';
      ticker = window.setInterval(function () {
        if (trace.meter) trace.meter.textContent = ((Date.now() - started) / 1000).toFixed(1) + 's';
      }, 100);
    }
    function up() {
      if (!started) return;
      var held = Date.now() - started;
      started = 0;
      window.clearInterval(ticker);
      if (trace.meter) trace.meter.textContent = '';
      button.classList.remove('held');
      button.disabled = true;
      bucket(probe.buckets, held, answer);
      finish();
    }
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', function () {
      if (!started) return;
      started = 0;
      window.clearInterval(ticker);
      button.classList.remove('held');
      if (trace.meter) trace.meter.textContent = '';
      trace.textContent = 'let go early; press again';
    });
    button.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); down(); }
    });
    button.addEventListener('keyup', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); up(); }
    });
    body.appendChild(button);
    body.appendChild(el('p', 'probe-count', 'the length of the press is the whole answer'));
  }
  function bucket(buckets, value, answer) {
    for (var i = 0; i < buckets.length; i++) {
      if (value < buckets[i].under) { add(answer, buckets[i].weights, 1); return; }
    }
    add(answer, buckets[buckets.length - 1].weights, 1);
  }
  function placeProbe(probe, body, trace, answer, finish) {
    var field = el('div', 'probe-field');
    field.setAttribute('role', 'application');
    field.setAttribute('aria-label', 'a field to place one mark in: the arrow keys move the mark, enter leaves it there');
    field.tabIndex = 0;
    var mark = el('span', 'probe-mark');
    mark.hidden = true;
    field.appendChild(mark);
    var cursor = { x: 0.5, y: 0.5 };
    var placed = false;
    function place(x, y) {
      cursor.x = Math.min(1, Math.max(0, x));
      cursor.y = Math.min(1, Math.max(0, y));
      mark.hidden = false;
      mark.style.left = cursor.x * 100 + '%';
      mark.style.top = cursor.y * 100 + '%';
      var c = probe.corners;
      add(answer, c.topLeft, (1 - cursor.x) * (1 - cursor.y));
      add(answer, c.topRight, cursor.x * (1 - cursor.y));
      add(answer, c.bottomLeft, (1 - cursor.x) * cursor.y);
      add(answer, c.bottomRight, cursor.x * cursor.y);
      var fromCentre = Math.max(Math.abs(cursor.x - 0.5), Math.abs(cursor.y - 0.5)) * 2;
      add(answer, fromCentre < 0.3 ? probe.centre : probe.edge, 1);
      field.setAttribute('aria-disabled', 'true');
      field.tabIndex = -1;
      placed = true;
      finish();
    }
    field.addEventListener('click', function (ev) {
      if (placed) return;
      var box = field.getBoundingClientRect();
      place((ev.clientX - box.left) / box.width, (ev.clientY - box.top) / box.height);
    });
    field.addEventListener('keydown', function (ev) {
      if (placed) return;
      var step = 0.08;
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        cursor.x = Math.min(1, Math.max(0, cursor.x + moves[ev.key][0]));
        cursor.y = Math.min(1, Math.max(0, cursor.y + moves[ev.key][1]));
        mark.hidden = false;
        mark.style.left = cursor.x * 100 + '%';
        mark.style.top = cursor.y * 100 + '%';
        trace.textContent = 'arrow keys move the mark, enter leaves it there';
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        place(cursor.x, cursor.y);
      }
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'tap or click anywhere in the field, or move the mark with the arrow keys and press enter'));
  }
  function drawProbe(probe, body, trace, answer, finish) {
    var pad = el('canvas', 'probe-pad');
    pad.width = 520;
    pad.height = 180;
    pad.tabIndex = 0;
    pad.setAttribute('role', 'application');
    pad.setAttribute('aria-label', 'a pad to draw one line on: the arrow keys draw, enter finishes');
    var ctx = pad.getContext('2d');
    var points = [];
    var drawing = false;
    function at(ev) {
      var box = pad.getBoundingClientRect();
      return { x: (ev.clientX - box.left) / box.width * pad.width,
        y: (ev.clientY - box.top) / box.height * pad.height };
    }
    function paint() {
      ctx.clearRect(0, 0, pad.width, pad.height);
      ctx.strokeStyle = 'rgba(214, 232, 255, 0.92)';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
    pad.addEventListener('pointerdown', function (ev) {
      drawing = true;
      points = [at(ev)];
      pad.setPointerCapture(ev.pointerId);
    });
    pad.addEventListener('pointermove', function (ev) {
      if (!drawing) return;
      points.push(at(ev));
      paint();
      if (trace.meter) trace.meter.textContent = points.length + ' samples';
    });
    pad.addEventListener('pointerup', function () {
      if (!drawing) return;
      drawing = false;
      score();
    });
    pad.addEventListener('keydown', function (ev) {
      var moves = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
      if (moves[ev.key]) {
        ev.preventDefault();
        var last = points.length ? points[points.length - 1] : { x: 40, y: pad.height / 2 };
        points.push({ x: Math.min(pad.width, Math.max(0, last.x + moves[ev.key][0])),
          y: Math.min(pad.height, Math.max(0, last.y + moves[ev.key][1])) });
        paint();
        if (trace.meter) trace.meter.textContent = points.length + ' samples';
        if (points.length === 1) trace.textContent = 'the arrow keys draw; enter finishes the line';
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        score();
      }
    });
    function score() {
      if (points.length < 2) { trace.textContent = 'one line, any line'; return; }
      var length = 0;
      var turn = 0;
      for (var i = 1; i < points.length; i++) {
        var dx = points[i].x - points[i - 1].x;
        var dy = points[i].y - points[i - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
        if (i > 1) {
          var px = points[i - 1].x - points[i - 2].x;
          var py = points[i - 1].y - points[i - 2].y;
          var cross = Math.abs(px * dy - py * dx);
          var scale = Math.sqrt(px * px + py * py) * Math.sqrt(dx * dx + dy * dy) || 1;
          turn += cross / scale;
        }
      }
      var span = Math.sqrt(Math.pow(points[points.length - 1].x - points[0].x, 2)
        + Math.pow(points[points.length - 1].y - points[0].y, 2));
      var wander = length / (span || 1);
      add(answer, length < pad.width * 0.4 ? probe.short : probe.long, 1);
      if (wander < 1.08) add(answer, probe.straight, 1);
      else if (turn / points.length > 0.35) add(answer, probe.jagged, 1);
      else add(answer, probe.curved, 1);
      finish();
    }
    body.appendChild(pad);
    body.appendChild(el('p', 'probe-count', 'draw with a finger, a mouse, or the arrow keys'));
  }
  function windowsProbe(probe, body, trace, answer, finish) {
    var selected = [];
    var field = el('div', 'probe-windows');
    field.setAttribute('role', 'group');
    field.setAttribute('aria-label', 'Nine windows. Light three in any order.');
    probe.windows.forEach(function (tile, index) {
      var button = el('button', 'probe-window');
      button.type = 'button';
      button.setAttribute('aria-label', tile.label + ' window');
      button.setAttribute('aria-pressed', 'false');
      var pane = el('span', 'probe-window-pane');
      pane.setAttribute('aria-hidden', 'true');
      button.appendChild(pane);
      button.addEventListener('click', function () {
        var at = selected.indexOf(index);
        if (at !== -1) {
          selected.splice(at, 1);
          button.setAttribute('aria-pressed', 'false');
        } else {
          selected.push(index);
          button.setAttribute('aria-pressed', 'true');
        }
        if (selected.length < 3) {
          trace.textContent = selected.length ? selected.length + ' lit; ' + (3 - selected.length) + ' to go.' : 'All windows dark again. Light any three.';
          return;
        }
        selected.forEach(function (i) { add(answer, probe.windows[i].weights, 1); });
        var xs = selected.map(function (i) { return i % 3; });
        var ys = selected.map(function (i) { return Math.floor(i / 3); });
        if (selected.indexOf(4) !== -1 &&
          ((selected.indexOf(0) !== -1 && selected.indexOf(8) !== -1) ||
           (selected.indexOf(2) !== -1 && selected.indexOf(6) !== -1))) {
          add(answer, { divinatory: 3, ceremonial: 2, cosmic: 1 }, 1);
        } else if (xs.every(function (x) { return x === xs[0]; })) {
          add(answer, { geometric: 3, analytic: 2, metrical: 1 }, 1);
        } else if (ys.every(function (y) { return y === ys[0]; })) {
          add(answer, { metrical: 3, attentive: 2, restless: 1 }, 1);
        } else if (Math.max.apply(null, xs) - Math.min.apply(null, xs) <= 1 &&
                   Math.max.apply(null, ys) - Math.min.apply(null, ys) <= 1) {
          add(answer, { tender: 3, tending: 2, rooted: 1 }, 1);
        } else if (xs.filter(function (x, i) { return xs.indexOf(x) === i; }).length === 3 &&
                   ys.filter(function (y, i) { return ys.indexOf(y) === i; }).length === 3) {
          add(answer, { curious: 3, verbal: 2, tempestuous: 1 }, 1);
        } else add(answer, { brooding: 2, cosmic: 1, curious: 1 }, 1);
        finish();
      });
      field.appendChild(button);
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'Tap a lit window to close it before lighting the third.'));
  }
  // The final division is the answer, not the order of presses. Undo never leaves a reading behind.
  function balanceProbe(probe, body, trace, answer, finish) {
    var counts = probe.bowls.map(function () { return 0; });
    var placed = [];
    var submitted = false;
    var picture = el('canvas', 'probe-pad');
    picture.width = 600;
    picture.height = 240;
    picture.setAttribute('aria-hidden', 'true');
    picture.style.cursor = 'default';
    picture.style.touchAction = 'auto';
    var g = picture.getContext('2d');
    picture.hidden = !g;
    body.appendChild(picture);
    var group = el('div', 'probe-options');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Give the seven weights to these bowls');
    var buttons = [];
    var details = [];
    probe.bowls.forEach(function (bowl, index) {
      var button = el('button', 'probe-option');
      button.type = 'button';
      button.appendChild(el('span', 'probe-option-label', bowl.label));
      var detail = el('span', 'probe-option-detail');
      button.appendChild(detail);
      button.addEventListener('click', function () {
        if (submitted || placed.length >= probe.total) return;
        counts[index] += 1;
        placed.push(index);
        redraw();
      });
      buttons.push(button);
      details.push(detail);
      group.appendChild(button);
    });
    body.appendChild(group);
    var controls = el('div', 'controls');
    var undo = el('button', 'btn-text', 'undo last weight');
    undo.type = 'button';
    undo.addEventListener('click', function () {
      if (submitted || !placed.length) return;
      counts[placed.pop()] -= 1;
      redraw();
    });
    var leave = el('button', 'btn-filled', 'leave them hanging');
    leave.type = 'button';
    leave.addEventListener('click', function () {
      if (submitted || placed.length !== probe.total) return;
      submitted = true;
      probe.bowls.forEach(function (bowl, index) {
        add(answer, bowl.weights, counts[index] / probe.total);
      });
      var most = Math.max.apply(null, counts);
      var least = Math.min.apply(null, counts);
      if (most - least <= 1) add(answer, probe.even, 1);
      else if (most === probe.total) add(answer, probe.gathered, 1);
      else if (least === 0) add(answer, probe.spare, 1);
      redraw();
      finish();
    });
    controls.appendChild(undo);
    controls.appendChild(leave);
    body.appendChild(controls);

    function paint() {
      if (!g) return;
      var style = window.getComputedStyle(body);
      var primary = style.getPropertyValue('--md-sys-color-primary').trim();
      var brass = style.getPropertyValue('--md-sys-color-tertiary').trim();
      var ink = style.getPropertyValue('--md-sys-color-on-surface').trim();
      var ground = style.getPropertyValue('--md-sys-color-surface-dim').trim();
      var w = picture.width;
      var h = picture.height;
      var tilt = (counts[0] - counts[2]) * h * 0.012;
      var beamY = function (x) { return h * 0.2 - (x - w / 2) / (w * 0.4) * tilt; };
      g.fillStyle = ground;
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = 2;
      g.strokeStyle = ink;
      g.beginPath();
      g.moveTo(w * 0.48, h * 0.07);
      g.lineTo(w * 0.5, h * 0.2);
      g.lineTo(w * 0.52, h * 0.07);
      g.stroke();
      g.strokeStyle = primary;
      g.beginPath();
      g.moveTo(w * 0.08, beamY(w * 0.08));
      g.lineTo(w * 0.92, beamY(w * 0.92));
      g.stroke();
      counts.forEach(function (count, index) {
        var x = w * (0.18 + index * 0.32);
        var y = h * (0.64 + count * 0.018);
        var bw = w * 0.18;
        var bh = h * 0.16;
        g.strokeStyle = ink;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, beamY(x));
        g.lineTo(x, y - h * 0.06);
        g.lineTo(x - bw / 2, y);
        g.moveTo(x, y - h * 0.06);
        g.lineTo(x + bw / 2, y);
        g.stroke();
        g.strokeStyle = primary;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(x - bw / 2, y);
        g.quadraticCurveTo(x, y + bh * 2, x + bw / 2, y);
        g.lineTo(x - bw / 2, y);
        g.stroke();
        g.fillStyle = brass;
        var radius = h * 0.018;
        for (var i = 0; i < count; i++) {
          g.beginPath();
          g.arc(x + (i % 3 - 1) * radius * 3,
            y + bh - (Math.floor(i / 3) + 1) * radius * 2.5,
            radius, 0, Math.PI * 2);
          g.fill();
        }
      });
      g.fillStyle = brass;
      for (var i = placed.length; i < probe.total; i++) {
        g.beginPath();
        g.arc(w / 2 + (i - placed.length - (probe.total - placed.length - 1) / 2) * h * 0.055,
          h * 0.92, h * 0.018, 0, Math.PI * 2);
        g.fill();
      }
    }
    function redraw() {
      var left = probe.total - placed.length;
      buttons.forEach(function (button, index) {
        var bowl = probe.bowls[index];
        details[index].textContent = bowl.place + ' bowl: ' + plural(counts[index], 'weight');
        button.setAttribute('aria-label', 'Give one weight to ' + bowl.label + '; ' + plural(counts[index], 'weight') + ' inside');
        button.disabled = submitted || left === 0;
      });
      undo.disabled = submitted || placed.length === 0;
      leave.disabled = submitted || left !== 0;
      trace.textContent = counts.map(function (count, index) {
        return probe.bowls[index].label + ': ' + count;
      }).join('; ') + '. ' + (left ? plural(left, 'weight') + ' left to place.'
        : 'All seven hang. Leave them here, or undo a weight to change the balance.');
      paint();
    }
    redraw();
  }
  // Seven keys, one lock. A first press on a key weighs it in the hand and reads its one line; a
  // second press on the same key tries it in the lock. The key tried is most of the answer, and
  // how many were weighed before trying is the rest. Nothing is hidden that matters: any key
  // turns, so the weighing is curiosity made visible, never a puzzle.
  function keysProbe(probe, body, trace, answer, finish) {
    var weighed = [];
    var held = -1;
    var done = false;
    var group = el('div', 'probe-options probe-keys');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'seven keys on a ring');
    var buttons = [];
    probe.keys.forEach(function (key, index) {
      var button = el('button', 'probe-option');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.appendChild(el('span', 'probe-option-label', key.label));
      var detail = el('span', 'probe-option-detail', key.detail);
      detail.hidden = true;
      button.appendChild(detail);
      button.addEventListener('click', function () {
        if (done) return;
        if (held === index) {
          done = true;
          add(answer, key.weights, 1);
          var others = weighed.length - 1;
          if (others === 0) add(answer, probe.first, 1);
          else if (others >= probe.keys.length - 1) add(answer, probe.all, 1);
          else if (others <= 2) add(answer, probe.few, 1);
          else add(answer, probe.many, 1);
          for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
          trace.textContent = key.label + ' turns in the lock';
          finish();
          return;
        }
        held = index;
        if (weighed.indexOf(index) === -1) weighed.push(index);
        for (var j = 0; j < buttons.length; j++) buttons[j].setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        detail.hidden = false;
        trace.textContent = key.label + ': ' + key.detail + '. Press it again to try it in the lock.';
      });
      buttons.push(button);
      group.appendChild(button);
    });
    body.appendChild(group);
    body.appendChild(el('p', 'probe-count', 'a first press weighs a key in your hand; a second press on the same key tries it in the lock'));
  }
  function sliderProbe(probe, body, trace, answer, finish) {
    var wrap = el('div', 'probe-dial');
    var input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = String(20 + Math.floor(Math.random() * 61));
    input.id = 'probe-dial-' + probe.probe;
    var label = el('label', 'probe-dial-label', 'the dial starts somewhere random; put it where the room should be');
    label.setAttribute('for', input.id);
    wrap.appendChild(label);
    wrap.appendChild(el('span', 'probe-dial-end', probe.low));
    wrap.appendChild(input);
    wrap.appendChild(el('span', 'probe-dial-end', probe.high));
    var done = el('button', 'probe-option probe-undo', 'leave it there');
    done.type = 'button';
    input.addEventListener('input', function () { trace.textContent = 'the dial is somewhere it was not'; });
    done.addEventListener('click', function () {
      var warmth = Number(input.value) / 100;
      add(answer, probe.cold, 1 - warmth);
      add(answer, probe.warm, warmth);
      input.disabled = true;
      done.disabled = true;
      finish();
    });
    body.appendChild(wrap);
    body.appendChild(done);
  }
  // The stars come out one at a time, faster as the dusk deepens, and the answer is how many
  // there are when the visitor says enough -- and how many of them they hurried out by hand. The
  // sky fills on its own if they wait, but it never answers on its own: the press is theirs.
  function skyProbe(probe, body, trace, answer, finish) {
    var full = probe.full || 48;
    var still = reducedMotion();
    var sky = el('canvas', 'probe-pad');
    sky.width = 600;
    sky.height = 220;
    sky.setAttribute('aria-hidden', 'true');
    sky.style.cursor = 'pointer';
    sky.style.touchAction = 'manipulation';
    var g = sky.getContext('2d');
    sky.hidden = !g;
    body.appendChild(sky);
    var controls = el('div', 'controls');
    var enough = el('button', 'probe-big', probe.label);
    enough.type = 'button';
    var hurry = el('button', 'probe-option probe-undo', probe.hurry);
    hurry.type = 'button';
    controls.appendChild(enough);
    controls.appendChild(hurry);
    body.appendChild(controls);
    body.appendChild(el('p', 'probe-count', 'there is no right number: tap the dark to hurry one along, or wait and the sky fills by itself'));
    var style = window.getComputedStyle(body);
    var tone = function (name, fallback) { return rgbOf(style.getPropertyValue(name), fallback); };
    var night = tone('--bg', '#070a14');
    var dusk = tone('--bg2', '#1c2a4e');
    var cool = tone('--accent', '#9fcbff');
    var warm = tone('--accent2', '#ffe7ab');
    var stars = [];
    var hurried = 0;
    var stopped = false;
    var due = 0;
    function pace(n) { return 160 + 900 * Math.pow(0.95, n); }
    function count() {
      if (!trace.meter) return;
      trace.meter.textContent = stars.length ? stars.length + (stars.length === 1 ? ' star' : ' stars') : 'none out yet';
    }
    function appear(x, y, own) {
      stars.push({ x: x, y: y, r: 0.9 + Math.random() * 1.5, phase: Math.random() * Math.PI * 2,
        born: performance.now(), own: !!own });
      count();
      if (stars.length === 1) trace.textContent = 'the first one is out';
      if (stars.length >= full) {
        enough.textContent = 'that is all of them';
        hurry.disabled = true;
        trace.textContent = 'the sky is full';
      }
    }
    function kindle(x, y) {
      if (stopped || stars.length >= full) return;
      appear(x, y, true);
      hurried += 1;
      if (stars.length < full) trace.textContent = hurried === 1 ? 'one hurried along' : hurried + ' hurried along';
    }
    function paint(now) {
      if (!g) return;
      var w = sky.width;
      var h = sky.height;
      var p = Math.min(1, stars.length / full);
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgba(blend(blend(dusk, warm, 0.22 * (1 - p)), night, 0.3 + p * 0.6), 1));
      grad.addColorStop(1, rgba(blend(night, dusk, 0.2 * (1 - p)), 1));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, h * 0.9, w, h * 0.1);
      var reach = w * 0.2;
      var i;
      var j;
      g.lineWidth = 1;
      for (i = 0; i < stars.length; i++) {
        var a = stars[i];
        var near = -1;
        var best = reach * reach;
        for (j = 0; j < stars.length; j++) {
          if (i === j) continue;
          var dx = (stars[j].x - a.x) * w;
          var dy = (stars[j].y - a.y) * h;
          var d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; near = j; }
        }
        if (near < 0) continue;
        var fade = still ? 1 : Math.min(1, (now - Math.max(a.born, stars[near].born)) / 900);
        g.strokeStyle = rgba(cool, (0.08 + 0.2 * (1 - Math.sqrt(best) / reach)) * fade);
        g.beginPath();
        g.moveTo(a.x * w, a.y * h);
        g.lineTo(stars[near].x * w, stars[near].y * h);
        g.stroke();
      }
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        var f = still ? 1 : Math.min(1, (now - s.born) / 700);
        var tw = still ? 0.85 : 0.7 + 0.3 * Math.sin(now / 480 + s.phase);
        var c = s.own ? warm : blend(cool, [255, 255, 255], 0.55);
        var x = s.x * w;
        var y = s.y * h;
        var r = s.r * (0.8 + 0.4 * tw) * (0.4 + 0.6 * f);
        g.fillStyle = rgba(c, 0.14 * f * tw);
        g.beginPath();
        g.arc(x, y, r * 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rgba(c, (0.6 + 0.4 * tw) * f);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    // One star a frame at most, so a tab that was hidden for a while does not dump the sky at once;
    // and nothing comes out while the page is set aside behind a lightbox.
    function frame(now) {
      if (!sky.isConnected) return;
      var aside = sky.closest('[data-lightbox-aside]');
      if (aside) due = 0;
      else if (!stopped && stars.length < full) {
        if (!due) due = now + 500;
        else if (now >= due) {
          appear(0.04 + Math.random() * 0.92, 0.05 + Math.random() * 0.78, false);
          due = now + pace(stars.length);
        }
      }
      paint(now);
      if (stopped && still) return;
      window.requestAnimationFrame(frame);
    }
    sky.addEventListener('click', function (ev) {
      var box = sky.getBoundingClientRect();
      if (!box.width || !box.height) return;
      kindle(Math.min(0.97, Math.max(0.03, (ev.clientX - box.left) / box.width)),
        Math.min(0.86, Math.max(0.04, (ev.clientY - box.top) / box.height)));
    });
    hurry.addEventListener('click', function () {
      kindle(0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.72);
    });
    enough.addEventListener('click', function () {
      if (stopped) return;
      stopped = true;
      var n = stars.length;
      bucket(probe.buckets, n, answer);
      if (n >= full) add(answer, probe.filled, 1);
      if (!hurried) add(answer, probe.waited, 1);
      else add(answer, hurried * 2 > n ? probe.hurried : probe.kindled, 1);
      enough.disabled = true;
      hurry.disabled = true;
      sky.style.cursor = 'default';
      if (trace.meter) trace.meter.textContent = '';
      finish();
    });
    count();
    window.requestAnimationFrame(frame);
  }
  // A door, and however the visitor knocks on it. The count is most of the answer -- one knock, two,
  // three, a handful, a volley -- and for a longer knock its rhythm is the rest: even, swung,
  // quickening or slowing, and whether they knocked at once or stood a moment first. Each knock
  // rings on the door and leaves its tick on the strip above it, spaced as it fell, so the knock is
  // written where it can be read back. No knock is wrong, and the door never answers on its own:
  // saying the knock is done is the visitor's press.
  function knockProbe(probe, body, trace, answer, finish) {
    var still = reducedMotion();
    var KNOCKER = { x: 0.5, y: 0.42 };
    var door = el('canvas', 'probe-pad');
    door.width = 600;
    door.height = 320;
    door.setAttribute('aria-hidden', 'true');
    door.style.cursor = 'pointer';
    door.style.touchAction = 'manipulation';
    var g = door.getContext('2d');
    door.hidden = !g;
    body.appendChild(door);
    var controls = el('div', 'controls');
    var knock = el('button', 'probe-big', probe.label);
    knock.type = 'button';
    var done = el('button', 'btn-filled', probe.done);
    done.type = 'button';
    done.disabled = true;
    controls.appendChild(knock);
    controls.appendChild(done);
    body.appendChild(controls);
    body.appendChild(el('p', 'probe-count', 'tap the door or press knock, once or as many times as you like, then say when the knock is done'));
    var style = window.getComputedStyle(body);
    var tone = function (name, fallback) { return rgbOf(style.getPropertyValue(name), fallback); };
    var night = tone('--bg', '#070a14');
    var dusk = tone('--bg2', '#1c2a4e');
    var cool = tone('--accent', '#9fcbff');
    var warm = tone('--accent2', '#ffe7ab');
    var arrived = Date.now();
    var knocks = [];
    var stopped = false;
    var running = false;
    function pattern() {
      var out = '\u00b7';
      for (var i = 1; i < knocks.length; i++) {
        var gap = knocks[i].at - knocks[i - 1].at;
        out += (gap < 320 ? '' : gap < 900 ? ' ' : '   ') + '\u00b7';
      }
      return out;
    }
    function paint(now) {
      if (!g) return;
      var w = door.width;
      var h = door.height;
      var left = w * 0.31;
      var right = w * 0.69;
      var top = h * 0.16;
      var bottom = h * 0.94;
      var i;
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgba(blend(night, dusk, 0.55), 1));
      grad.addColorStop(1, rgba(night, 1));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, bottom, w, h - bottom);
      // The door shudders under a fresh knock, unless the visitor asked for stillness.
      var shake = 0;
      if (!still) {
        for (i = 0; i < knocks.length; i++) {
          var age = (now - knocks[i].born) / 260;
          if (age < 1) shake += Math.sin(age * Math.PI * 3) * (1 - age) * 3;
        }
      }
      g.strokeStyle = rgba(cool, 0.35);
      g.lineWidth = 3;
      g.strokeRect(left - 5, top - 5, right - left + 10, bottom - top + 5);
      g.save();
      g.translate(shake, 0);
      g.fillStyle = rgba(blend(night, warm, 0.14), 1);
      g.fillRect(left, top, right - left, bottom - top);
      var inset = (right - left) * 0.14;
      g.strokeStyle = rgba(cool, 0.22);
      g.lineWidth = 1.5;
      g.strokeRect(left + inset, top + (bottom - top) * 0.07, right - left - inset * 2, (bottom - top) * 0.36);
      g.strokeRect(left + inset, top + (bottom - top) * 0.52, right - left - inset * 2, (bottom - top) * 0.4);
      var kx = KNOCKER.x * w;
      var ky = KNOCKER.y * h;
      g.strokeStyle = rgba(warm, 0.9);
      g.lineWidth = 4;
      g.beginPath();
      g.arc(kx, ky + h * 0.03, h * 0.045, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
      g.fillStyle = rgba(warm, 0.95);
      g.beginPath();
      g.arc(kx, ky, h * 0.014, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(night, 0.9);
      g.beginPath();
      g.arc(left + (right - left) * 0.78, top + (bottom - top) * 0.5, h * 0.012, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // Each knock rings out from where it landed; with less motion the ring is simply there.
      for (i = 0; i < knocks.length; i++) {
        var life = (now - knocks[i].born) / 700;
        if (life >= 1) continue;
        g.strokeStyle = rgba(cool, still ? 0.5 : (1 - life) * 0.6);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(knocks[i].x, knocks[i].y, still ? h * 0.08 : h * 0.03 + life * h * 0.22, 0, Math.PI * 2);
        g.stroke();
      }
      // The knock written down: one tick for each, spaced along the strip as they fell.
      if (knocks.length) {
        var span = knocks[knocks.length - 1].at - knocks[0].at;
        var scale = Math.min(0.11, (w * 0.84) / Math.max(1, span));
        g.strokeStyle = rgba(cool, 0.25);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(w * 0.08, h * 0.09);
        g.lineTo(w * 0.92, h * 0.09);
        g.stroke();
        g.strokeStyle = rgba(warm, 0.9);
        g.lineWidth = 2;
        for (i = 0; i < knocks.length; i++) {
          var x = w * 0.08 + (knocks[i].at - knocks[0].at) * scale;
          g.beginPath();
          g.moveTo(x, h * 0.05);
          g.lineTo(x, h * 0.13);
          g.stroke();
        }
      }
    }
    function frame(now) {
      running = false;
      if (!door.isConnected) return;
      paint(now);
      for (var i = 0; i < knocks.length; i++) {
        if (now - knocks[i].born < 700) { kick(); return; }
      }
    }
    function kick() {
      if (running) return;
      running = true;
      window.requestAnimationFrame(frame);
    }
    function rap(fx, fy) {
      if (stopped) return;
      knocks.push({ at: Date.now(), born: performance.now(), x: fx * door.width, y: fy * door.height });
      done.disabled = false;
      trace.textContent = knocks.length === 1 ? 'one knock' : knocks.length + ' knocks';
      if (trace.meter) trace.meter.textContent = pattern();
      kick();
    }
    function sum(list) { return list.reduce(function (a, b) { return a + b; }, 0); }
    door.addEventListener('click', function (ev) {
      var box = door.getBoundingClientRect();
      if (!box.width || !box.height) return;
      rap(Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
        Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)));
    });
    knock.addEventListener('click', function () { rap(KNOCKER.x, KNOCKER.y); });
    done.addEventListener('click', function () {
      if (stopped || !knocks.length) return;
      stopped = true;
      var n = knocks.length;
      bucket(probe.buckets, n, answer);
      var pause = knocks[0].at - arrived;
      if (pause > 6000) add(answer, probe.waited, 1);
      else if (pause < 1200) add(answer, probe.sudden, 1);
      if (n >= 3) {
        var gaps = [];
        for (var i = 1; i < n; i++) gaps.push(knocks[i].at - knocks[i - 1].at);
        var mean = sum(gaps) / gaps.length;
        var spread = 0;
        for (var j = 0; j < gaps.length; j++) spread += Math.abs(gaps[j] - mean);
        spread /= gaps.length * (mean || 1);
        var half = Math.floor(gaps.length / 2);
        var early = sum(gaps.slice(0, half)) / half;
        var late = sum(gaps.slice(gaps.length - half)) / half;
        if (spread < 0.2) add(answer, probe.even, 1);
        else if (late < early * 0.6) add(answer, probe.quickening, 1);
        else if (late > early * 1.6) add(answer, probe.slowing, 1);
        else add(answer, probe.swung, 1);
      }
      knock.disabled = true;
      done.disabled = true;
      door.style.cursor = 'default';
      if (trace.meter) trace.meter.textContent = '';
      finish();
    });
    paint(performance.now());
  }
  function describe(reading) {
    var o = reading && reading.orientation;
    if (!o || !reading.source || reading.source === 'signals') {
      return 'No reading yet. Answer one sideways question and the site suggests a world to begin in, or take any world you like.';
    }
    var line = o.name + ' — ' + o.pull + '. That opens onto ' + o.worldName + '.';
    if (reading.source === 'answer') return 'Read just now as ' + line;
    return 'Carried over from your last answer: ' + line;
  }
  function currentReading() {
    if (lastAnswered && state.orientation && lastAnswered.orientation.id === state.orientation) return lastAnswered;
    return state.orientation
      ? { orientation: ORIENTATION_BY_ID[state.orientation], source: 'memory', signals: signals() }
      : readingFor(null);
  }
  function arrival() {
    var threshold = document.documentElement.getAttribute('data-page') === 'index.html';
    var arrived = sinceLast === null || sinceLast > ARRIVAL_GAP_MS;
    return threshold && (arrived || !state.orientation);
  }
  state.visits += 1;
  state.last = Date.now();
  transmogrify(state.orientation ? ORIENTATION_BY_ID[state.orientation] : null);
  persist();
  var wayControl = document.getElementById('threshold-way');
  if (wayControl) PROBES.forEach(function (probe) {
    var option = document.createElement('option');
    option.value = probe.probe;
    option.textContent = probe.name;
    wayControl.appendChild(option);
  });
  window.threshold = {
    orientations: function () { return ORIENTATIONS.slice(); },
    orientation: function (id) { return ORIENTATION_BY_ID[id] || null; },
    probes: function () { return PROBES.map(function (p) {
      return { probe: p.probe, name: p.name || p.probe, kind: p.kind, ask: p.ask };
    }); },
    signals: signals, reading: currentReading, describe: describe, mount: mount,
    arrival: arrival,
    ask: function () { if (window.interestingPersona) window.interestingPersona.ask(); },
    reducedMotion: reducedMotion,
    forget: function () {
      state = { visits: 1, last: null, drift: {}, recent: [], orientation: null };
      lastAnswered = null;
      sinceLast = null;
      store.remove(READING);
      transmogrify(null);
    }
  };
})();
