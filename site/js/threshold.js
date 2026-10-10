/* The mood flow asks a sideways question before suggesting a world. The threshold hosts the question in its stage, the persona's ask leads there from every other page, and the mood atlas shows where each reading leads. Readings live in the shared state document.
   Each host owns one live question: replacing it invalidates delayed handoffs and releases any borrowed focusability. */
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
      probe: 'soot-print', name: 'the covered print', kind: 'rubbing',
      ask: 'Rub the soot off any part of this print; what you uncover suggests a puzzle. Open one whenever you like, even if you leave the print covered.',
      motifs: [
        { label: 'a key', word: 'key', weights: { analytic: 3, restless: 2, verbal: 1 } },
        { label: 'a shell', word: 'shell', weights: { attentive: 3, cosmic: 2, brooding: 1, divinatory: 1 } },
        { label: 'a branch', word: 'branch', weights: { rooted: 3, tending: 2, tender: 1 } },
        { label: 'a wheel', word: 'wheel', weights: { geometric: 3, metrical: 2, ceremonial: 1, curious: 1 } }
      ],
      untouched: { divinatory: 3, tender: 2 },
      glimpse: { tender: 2, attentive: 1 },
      search: { curious: 2, verbal: 1 },
      whole: { ceremonial: 2, restless: 1, tempestuous: 1 }
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
    },
    {
      probe: 'cairn', name: 'the cairn', kind: 'cairn',
      ask: 'A flat place, and stones enough. Stack a cairn, each stone where you set it, and leave it standing when it is done.',
      label: 'set a stone', done: 'leave it standing',
      buckets: [
        { under: 3, weights: { tender: 3, brooding: 2, divinatory: 1 } },
        { under: 5, weights: { rooted: 3, tending: 2, tender: 1 } },
        { under: 7, weights: { analytic: 2, geometric: 2, metrical: 1, attentive: 1 } },
        { under: 10, weights: { ceremonial: 2, curious: 2, verbal: 1 } },
        { under: Infinity, weights: { restless: 3, cosmic: 2, tempestuous: 1 } }
      ],
      plumb: { geometric: 3, metrical: 2, analytic: 1 },
      daring: { restless: 2, tempestuous: 2, curious: 1 },
      sway: { attentive: 2, metrical: 1, divinatory: 1 },
      leaning: { rooted: 2, tender: 1, brooding: 1 }
    },
    {
      probe: 'compass', name: 'the unmarked compass', kind: 'compass',
      ask: 'A compass with no letters on it. Turn the needle to the way you would walk, then set out.',
      label: 'set out',
      points: [
        { bearing: 0, weights: { cosmic: 3, divinatory: 1, brooding: 1 } },
        { bearing: 45, weights: { analytic: 3, geometric: 2 } },
        { bearing: 90, weights: { restless: 3, tempestuous: 2, verbal: 1 } },
        { bearing: 135, weights: { curious: 3, verbal: 2 } },
        { bearing: 180, weights: { rooted: 3, tender: 2 } },
        { bearing: 225, weights: { tending: 3, ceremonial: 2 } },
        { bearing: 270, weights: { attentive: 3, brooding: 2, divinatory: 1 } },
        { bearing: 315, weights: { metrical: 3, geometric: 1, attentive: 1 } }
      ],
      untouched: { divinatory: 3, tender: 1, cosmic: 1 },
      nudged: { analytic: 2, attentive: 1, geometric: 1 },
      swung: { restless: 2, curious: 2, verbal: 1 },
      spun: { tempestuous: 2, ceremonial: 2, cosmic: 1 }
    }
  ];

  var ORIENTATION_BY_ID = {};
  for (var oi = 0; oi < ORIENTATIONS.length; oi++) ORIENTATION_BY_ID[ORIENTATIONS[oi].id] = ORIENTATIONS[oi];
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(calm && calm.matches); }

  /* ---- the rites of the threshold ---------------------------------------------------------
     Nothing here fades, glides or wears a pattern (README: "Motion axiom", the cut). A thing
     changes by one clean edge -- a slice at an angle, or a curve round a point -- stepping across
     it in a few treads that always go forward, and the edge is where it is for a reason the
     visitor gave: the side a question comes in from, the point a press landed, the way a hand
     rubbed. The engine (js/motion.js, window.interestingMotion) is optional everywhere: every use
     is guarded, and without it the stylesheet's baked stairs play and the flow keeps a clean stair
     of its own. What the engine gives when it is there: a beat rolled for the page, a stagger, the
     reveal that cuts a line of words in by one slice, each movement's treads and length written on
     the element that makes it (cut, arrive), the point a set control's two shades split round
     (seal), and a stepper for the canvases. */
  function engine() {
    var m = window.interestingMotion;
    return m && typeof m.ms === 'function' ? m : null;
  }
  // Stillness: the visitor asked for less motion, by either door.
  function stilled() {
    var m = engine();
    return reducedMotion() || !!(m && m.reduced);
  }
  var BEATS = { short: 170, medium: 340, long: 560, stagger: 44 };
  // The length of a rite, in ms: the engine's roll, or the stylesheet's bake; 0 when stilled.
  function beat(name) {
    if (stilled()) return 0;
    var m = engine();
    var v = 0;
    if (m) { try { v = m.ms(name); } catch (e) { v = 0; } }
    return v || BEATS[name] || 340;
  }
  function between(a, b) { return a + Math.random() * (b - a); }
  function unit(value) { return Math.max(0, Math.min(1, value)); }
  function seedOf() { return Math.floor(Math.random() * 0x7fffffff); }
  function staggerOf(k) {
    var m = engine();
    if (m && typeof m.stagger === 'function') { try { return m.stagger(k); } catch (e) { /* the bake */ } }
    return Math.max(0, Math.round(k * BEATS.stagger));
  }

  /* A stair for a movement only a script can make -- the night falling as the stars come out --
     rolled by the motion engine for that movement alone (README: "Motion axiom"). Where there is
     no engine the flow keeps a clean stair of its own: two to five treads at evenly spaced moments
     after a hold, always forward, shaped by the family -- an arrival's treads shrink as it lands, a
     leaving's grow as it goes, a stair or a ratchet steps evenly. Never a formula, never a slip. */
  function ownStair(family) {
    var n = 2 + Math.floor(Math.random() * 4);
    var first = between(0.16, 0.3);
    var last = between(0.84, 0.94);
    var moments = [];
    var rises = [];
    var total = 0;
    for (var i = 0; i < n; i++) {
      moments.push(first + (last - first) * (i / (n - 1)));
      var rise = family === 'arrive' ? Math.pow(0.55, i) : family === 'leave' ? Math.pow(1.6, i) : 1;
      rises.push(rise);
      total += rise;
    }
    return function (t) {
      if (t >= 1) return 1;
      var y = 0;
      for (var k = 0; k < n && moments[k] <= t; k++) y += rises[k] / total;
      return Math.min(1, y);
    };
  }
  function rite(family) {
    var motion = window.interestingMotion;
    if (motion && typeof motion.ease === 'function') {
      try { return motion.ease(family); } catch (e) { /* the flow's own stair stands */ }
    }
    return ownStair(family);
  }

  /* A movement in treads for a script: `step(k, n)` with the tread reached, 0 to n, then
     `done()` -- two to five treads, always forward. The engine's stepper when it is there; evenly
     spaced moments after a hold when it is not; the last tread at once when stilled. Hands back a
     function that stops it. */
  function series(opts) {
    var m = engine();
    var n = Math.max(2, Math.min(5, Math.round(opts.treads || (2 + Math.random() * 3))));
    var total = Math.max(0, Number(opts.ms) || 0);
    var step = typeof opts.step === 'function' ? opts.step : function () {};
    var done = typeof opts.done === 'function' ? opts.done : function () {};
    if (m && typeof m.stepper === 'function') {
      try { return m.stepper({ ms: total, treads: n, step: step, done: done }); } catch (e) { /* the flow's own */ }
    }
    if (!total || stilled() || typeof window.requestAnimationFrame !== 'function') {
      step(n, n);
      done();
      return function () {};
    }
    var first = between(0.16, 0.3);
    var last = between(0.86, 0.95);
    var started = performance.now();
    var stopped = false;
    var reached = 0;
    function frame(tm) {
      if (stopped) return;
      var p = unit((tm - started) / total);
      var k = reached;
      while (k < n && first + (last - first) * (k / (n - 1)) <= p) k += 1;
      if (k !== reached) { reached = k; step(k, n); }
      if (p < 1) window.requestAnimationFrame(frame);
      else { if (reached !== n) step(n, n); done(); }
    }
    step(0, n);
    window.requestAnimationFrame(frame);
    return function () { stopped = true; };
  }

  // Words arriving: written at once (textContent is never anything but the words), then cut in by
  // the engine's reveal -- one slice at the register's slant stepping across the line, a tread to a
  // word or two -- when the engine is there and the visitor has not asked for less.
  function say(node, text, pace) {
    if (!node) return;
    node.textContent = text;
    var m = engine();
    if (!text || stilled() || !m || typeof m.reveal !== 'function') return;
    try { m.reveal(node, { pace: pace || 0.42 }); } catch (e) { /* the words are there */ }
  }
  // The trace line is the scribe: the live region gets its plain write (assistive tech hears each
  // line once) and the glass twin under it shows the same words cut in. Only the part of the line
  // that changed is cut in (a count ticking over in a status line that is otherwise the same
  // words), and a line cut in whole is paced to land within one long beat however long it is, so a
  // run of presses never leaves the glass behind.
  function paceFor(text) {
    var n = text ? text.length : 0;
    var step = beat('stagger') || BEATS.stagger;
    if (!n || !step) return 0.3;
    return Math.min(0.3, beat('long') / (n * step));
  }
  function note(trace, text) {
    if (!trace) return;
    trace.textContent = text;
    var glass = trace.glass;
    if (!glass) return;
    if (typeof trace.undoGlass === 'function') { try { trace.undoGlass(); } catch (e) { /* the words stand */ } }
    trace.undoGlass = null;
    var was = glass.textContent || '';
    var next = text || '';
    var head = 0;
    while (head < was.length && head < next.length && was.charAt(head) === next.charAt(head)) head += 1;
    var tail = 0;
    while (tail < was.length - head && tail < next.length - head
      && was.charAt(was.length - 1 - tail) === next.charAt(next.length - 1 - tail)) tail += 1;
    var changed = next.slice(head, next.length - tail);
    var m = engine();
    if (!was || !next || changed.length > next.length * 0.6 || stilled() || !m || typeof m.reveal !== 'function'
      || typeof document.createTextNode !== 'function') {
      say(glass, next, paceFor(next));
      return;
    }
    glass.textContent = '';
    if (head) glass.appendChild(document.createTextNode(next.slice(0, head)));
    var part = el('span', 'probe-trace-change', changed);
    glass.appendChild(part);
    if (tail) glass.appendChild(document.createTextNode(next.slice(next.length - tail)));
    if (!changed) return;
    try { trace.undoGlass = m.reveal(part, { pace: paceFor(changed) }); } catch (e) { /* the words are there */ }
  }
  // A mark, a count or an arrow is stamped as it lands: data-tick alternates between two names so
  // the stylesheet's one-tread stamp restarts on every write.
  function tick(node) {
    if (!node || typeof node.setAttribute !== 'function') return;
    node.setAttribute('data-tick', node.getAttribute('data-tick') === 'a' ? 'b' : 'a');
  }
  // The meter: its marks stamped as they land, and only when they change -- a stroke of the hand
  // that adds no mark sets nothing down -- and a stamp still setting down is never begun again: a
  // quick hand's marks land under the one stamp, which goes all the way down and never flickers
  // back up mid-way; the next mark after it is stamped afresh. Cleared, it goes behind a slice
  // before its marks are taken (after `delay` ms, in the stair `seed` gives its group, where it
  // follows something else out), and is itself again after; a meter already going is left to go.
  // Hands back the length of its going, delay and all, or 0.
  function gauge(trace, text, delay, seed) {
    if (!trace || !trace.meter) return 0;
    var meter = trace.meter;
    var going = !!(meter.classList && meter.classList.contains('is-leaving'));
    if (text) {
      if (going) restore(meter);
      else if (meter.textContent === text) return 0;
      meter.textContent = text;
      var now = Date.now();
      if (!meter.stampedAt || now - meter.stampedAt >= beat('short')) {
        meter.stampedAt = now;
        tick(meter);
      }
      return 0;
    }
    if (!meter.textContent || going) return 0;
    return unmake(meter, function () { meter.textContent = ''; restore(meter); }, seed, delay);
  }
  // A tally that ratchets: one mark at a time, grouped in fives with a slash.
  function tally(n) {
    var out = '';
    for (var i = 1; i <= n; i++) out += (i % 5 === 0) ? '/' : '|';
    return out.replace(/(\|{4}\/)/g, '$1 ');
  }
  // One movement's treads and length, cut by the engine for this element and this trigger (m.cut:
  // --ease-<rite> and --motion-<rite> written on the element, and the slice's angle where one is
  // given). Hands back the length in ms, or 0 where there is no engine or the visitor asked for
  // stillness -- the stylesheet's baked stair plays then, or nothing does.
  function cutFor(node, riteName, options) {
    var m = engine();
    if (!m || typeof m.cut !== 'function' || stilled() || !node || !node.style) return 0;
    try { return m.cut(node, riteName, options || {}) || 0; } catch (e) { return 0; }
  }
  // Where a thing stands on the page: the centre of its box, read once for a group's order.
  function centreOf(node) {
    if (!node || typeof node.getBoundingClientRect !== 'function') return { x: 0, y: 0 };
    var box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  // How far along the way a slice at `angle` travels (0deg upward, 90deg rightward) a point lies:
  // the lower, the sooner the edge reaches it.
  function reach(p, angle) {
    var rad = angle * Math.PI / 180;
    return p.x * Math.sin(rad) - p.y * Math.cos(rad);
  }
  // A group's order, by a reason and never by a roll: each thing's measure (how far along the way
  // an edge travels, how far from the thing chosen), the least first, and things within `near` of
  // the same measure together, so the group goes as one edge crossing it. Hands back each thing's
  // step, 0 for the first.
  function stepsBy(measures, near) {
    var sorted = measures.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return a.v - b.v; });
    var out = new Array(measures.length);
    var step = -1;
    var first = -Infinity;
    sorted.forEach(function (e) {
      if (e.v - first > near) { step += 1; first = e.v; }
      out[e.i] = step;
    });
    return out;
  }
  // Each of `nodes`' step away from a point: the nearest first, those as near together.
  function stepsFrom(nodes, at) {
    return stepsBy(nodes.map(function (node) {
      var c = centreOf(node);
      return Math.hypot(c.x - at.x, c.y - at.y);
    }), 4);
  }
  // How long until what holds `node` has arrived: the longest finite movement still to run on it
  // or on what it stands in (the stage's ask, landing behind its slice as the question is put),
  // in ms, at most two long beats; 0 for a host already standing.
  function arriving(node) {
    var left = 0;
    for (var at = node; at && at.nodeType === 1 && at !== document.body; at = at.parentElement) {
      if (typeof at.getAnimations !== 'function') return 0;
      var running = [];
      try { running = at.getAnimations(); } catch (e) { running = []; }
      for (var i = 0; i < running.length; i++) {
        var effect = running[i].effect;
        if (!effect || typeof effect.getComputedTiming !== 'function' || running[i].playState === 'finished') continue;
        var t = effect.getComputedTiming();
        if (isFinite(t.endTime)) left = Math.max(left, t.endTime - (t.localTime || 0));
      }
    }
    return Math.max(0, Math.min(left, 2 * (beat('long') || BEATS.long)));
  }
  // Things dealt out: one after another (--d), all in one stair cut for the whole deal (one
  // seed), so the deal is one gesture. They come in behind the slice their question arrives by
  // (the --arrive-angle they inherit), in the order that slice reaches them -- those it reaches at
  // once together -- so the one edge is seen to sweep the set; and not while what holds them is
  // still arriving behind an edge of its own (the stage's ask lands as the question is put, a
  // moment after this is called): the deal follows that edge and never crosses it. Both are read
  // a frame later, when the host's arrival has begun; until then each waits behind its slice,
  // which has not yet moved, on its place in the page's order. data-dealt is what the stylesheet
  // plays the arrival on, and it stays, so nothing replays when a passing class comes off.
  function dealOut(nodes) {
    var dealt = nodes.filter(function (node) { return node && node.style && typeof node.setAttribute === 'function'; });
    if (!dealt.length) return;
    var seed = seedOf();
    dealt.forEach(function (node, k) {
      node.style.setProperty('--d', staggerOf(k) + 'ms');
      cutFor(node, 'develop', { seed: seed, duration: 'long' });
      node.setAttribute('data-dealt', 'true');
    });
    if (stilled() || typeof window.requestAnimationFrame !== 'function') return;
    window.requestAnimationFrame(function () {
      var live = dealt.filter(function (node) { return node.isConnected && !node.classList.contains('is-leaving'); });
      if (!live.length) return;
      var wait = arriving(live[0].parentElement);
      var angle = angleOf(window.getComputedStyle(live[0]), '--arrive-angle', 0);
      var steps = stepsBy(live.map(function (node) { return reach(centreOf(node), angle); }), 4);
      live.forEach(function (node, k) { node.style.setProperty('--d', Math.round(wait + staggerOf(steps[k])) + 'ms'); });
    });
  }
  // The length the engine cut for a movement on an element (--motion-<rite>, written inline), in
  // ms; 0 where none was written.
  function rolled(node, name) {
    if (!node || !node.style || typeof node.style.getPropertyValue !== 'function') return 0;
    var v = parseFloat(node.style.getPropertyValue(name));
    return isFinite(v) && v > 0 ? v : 0;
  }
  // One thing replacing another in the same place -- a landing of a question the one before it:
  // the new one is cut in by a slice from the side the roll gives it (data-dealt), and the old
  // one, left over its place as a ghost (`ghostClass`), is cut away by the same edge, its angle,
  // treads and length copied from the new one's, so the change is one edge; it is taken out of the
  // page once the edge has crossed. With no engine, or for a visitor who asked for less, the old
  // one simply goes.
  function replace(fresh, old, ghostClass) {
    if (!old) return;
    var m = engine();
    var length = 0;
    if (m && typeof m.arrive === 'function' && !stilled() && fresh && fresh.style) {
      try { m.arrive(fresh, { spell: 'develop', className: false }); } catch (e) { /* no edge */ }
      length = rolled(fresh, '--motion-develop');
    }
    if (!length || !old.style) {
      if (old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    fresh.setAttribute('data-dealt', 'true');
    ['--arrive-angle', '--ease-develop', '--motion-develop'].forEach(function (name) {
      old.style.setProperty(name, fresh.style.getPropertyValue(name));
    });
    old.classList.add(ghostClass);
    old.setAttribute('aria-hidden', 'true');
    old.setAttribute('inert', '');
    var gone = false;
    function drop() {
      if (gone) return;
      gone = true;
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    old.addEventListener('animationend', function (ev) {
      if (ev.target === old && !ev.pseudoElement && ev.animationName === 'cut-in') drop();
    });
    window.setTimeout(drop, length + 240);
  }
  // A thing leaving: behind a slice toward where it goes (is-leaving; cut.unmake in the
  // stylesheet), in treads cut for it -- or for its whole group, when the callers share a seed --
  // after `delay` ms (--d: a group goes one after another), then `fn` at the animation's own end
  // or, failing that, the clock's. Hands back the length in ms, delay and all, so a caller can wait
  // for the movement and not the clock. A node restored before the end (restore) keeps what it
  // has: the callback of a leave that was undone never runs.
  function unmake(node, fn, seed, delay) {
    if (node && node.unmakeToken) restore(node);
    if (!node || !node.classList) { if (fn) fn(); return 0; }
    var token = { hid: node.getAttribute('aria-hidden') !== 'true' };
    node.unmakeToken = token;
    node.classList.add('is-leaving');
    node.setAttribute('aria-hidden', 'true');
    if (node.style) node.style.pointerEvents = 'none';
    if (node.tagName === 'BUTTON') node.tabIndex = -1;
    // Stillness: the thing is simply gone (the stylesheet hides what is leaving), at once.
    var wait = beat('medium');
    if (!wait) { if (fn) fn(); return 0; }
    var after = Math.max(0, Math.round(delay || 0));
    if (node.style) node.style.setProperty('--d', after + 'ms');
    var length = (cutFor(node, 'unmake', { seed: seed, duration: 'medium' }) || wait) + after;
    var once = false;
    var timer = 0;
    function cancel() {
      once = true;
      if (timer && typeof window.clearTimeout === 'function') window.clearTimeout(timer);
      timer = 0;
      if (typeof node.removeEventListener === 'function') node.removeEventListener('animationend', ended);
      token.cancel = null;
    }
    function go() {
      if (once) return;
      cancel();
      if (node.unmakeToken !== token) return;
      if (fn) fn();
    }
    function ended(ev) {
      if (ev.target === node && !ev.pseudoElement && ev.animationName === 'cut-out') go();
    }
    token.cancel = cancel;
    node.addEventListener('animationend', ended);
    timer = window.setTimeout(go, length + wait + 240);
    return length;
  }
  // A thing that was leaving, kept after all (a meter written again, an order that takes a new
  // name): the leave is undone, and the next leave is cut anew.
  function restore(node) {
    if (!node || !node.classList) return;
    var token = node.unmakeToken;
    if (token && typeof token.cancel === 'function') token.cancel();
    node.unmakeToken = null;
    node.classList.remove('is-leaving');
    if (!token || token.hid) node.removeAttribute('aria-hidden');
    if (node.style) node.style.pointerEvents = '';
    if (node.tagName === 'BUTTON') node.tabIndex = 0;
  }
  // A control spent: inert at once (data-spent). What shows of it being spent waits `after` ms
  // (--spent-after: the reading's seal, so the seal is the one edge while it grows) and then
  // follows: its fill, where it shows one, is cut away by a slice in treads cut for this
  // retirement (--ease-unseal) -- or, for the big button, its fill's curve steps back to its point
  // (--fill-cut taken off) -- while its ground steps to the disabled grey along its own stair; only
  // then is it disabled, since a disabled control plays nothing. An input is spent the same way.
  function retire(button, after) {
    if (!button || button.disabled || button.getAttribute('data-spent') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    if (button.style && typeof button.style.removeProperty === 'function') button.style.removeProperty('--fill-cut');
    var wait = beat('medium');
    if (!wait || !button.style) { button.disabled = true; return; }
    var delay = Math.max(0, Math.round(after || 0));
    button.style.setProperty('--spent-after', delay + 'ms');
    var length = (cutFor(button, 'unseal', { duration: 'medium' }) || wait) + delay;
    button.setAttribute('data-spent', 'true');
    var once = false;
    function go() { if (once) return; once = true; button.disabled = true; }
    button.addEventListener('animationend', function (ev) {
      if (ev.target === button && ev.pseudoElement === '::before' && ev.animationName === 'cut-out') go();
    });
    window.setTimeout(go, length + 240);
  }
  // Where a set surface's two shades split: round the point it was pressed at a moment ago, which
  // the engine read from the press (m.seal writes --seal-x and --seal-y on it).
  function dress(node) {
    var m = engine();
    if (m && typeof m.seal === 'function') { try { m.seal(node); } catch (e) { /* the corner it has */ } }
  }

  /* ---- the cut on a canvas ----------------------------------------------------------------
     The threshold's canvases are not modules and are handed no env.rite, so they keep the cut
     here, as arithmetic and nothing more: one edge -- a slice at an angle (0deg sweeping upward,
     90deg rightward, as the page's --cut-angle reads) or a curve round a point -- and the part of
     a box it has passed at coverage k (0 to 1), added to the canvas's path as one polygon or one
     arc, never cells. `cutRegion` adds it to the path, to fill or to clip by; `paintCut` fills it,
     clipped to the box. A picture at rest is two shades split by one such edge, never grain. */
  function cutRegion(g, x, y, w, h, k, edge) {
    var c = unit(k);
    if (!g || c <= 0) return false;
    if (c >= 1) { g.rect(x, y, w, h); return true; }
    if (edge.kind === 'curve') {
      var far = Math.max(Math.hypot(x - edge.x, y - edge.y), Math.hypot(x + w - edge.x, y - edge.y),
        Math.hypot(x - edge.x, y + h - edge.y), Math.hypot(x + w - edge.x, y + h - edge.y));
      g.moveTo(edge.x + far * c, edge.y);
      g.arc(edge.x, edge.y, far * c, 0, Math.PI * 2);
      return true;
    }
    // The slice: how far along its direction a point of the box lies, 0 at the corner it starts
    // from and 1 at the corner it ends on; the box is cut where that reaches k.
    var rad = (edge.angle || 0) * Math.PI / 180;
    var dx = Math.sin(rad);
    var dy = -Math.cos(rad);
    var half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2 || 1;
    function reach(px, py) { return ((px - (x + w / 2)) * dx + (py - (y + h / 2)) * dy + half) / (2 * half); }
    var corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    var out = [];
    for (var i = 0; i < 4; i++) {
      var a = corners[i];
      var b = corners[(i + 1) % 4];
      var ra = reach(a[0], a[1]);
      var rb = reach(b[0], b[1]);
      if (ra <= c) out.push(a);
      if ((ra <= c) !== (rb <= c)) {
        var f = (c - ra) / (rb - ra);
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
    }
    if (out.length < 3) return false;
    g.moveTo(out[0][0], out[0][1]);
    for (var j = 1; j < out.length; j++) g.lineTo(out[j][0], out[j][1]);
    g.closePath();
    return true;
  }
  function paintCut(g, x, y, w, h, k, edge, style) {
    if (!g || unit(k) <= 0) return;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.beginPath();
    if (cutRegion(g, x, y, w, h, k, edge)) {
      g.fillStyle = style;
      g.fill();
    }
    g.restore();
  }
  // A picture sealed: a curve grows from the point its answer lives at -- the knocker, the top
  // stone, the needle's tip, the balance's pivot, the last star -- out to most of the picture and
  // no further, and inside it the picture takes a wash of the warm accent. At rest it is two shades
  // split by that one curve.
  var SEAL_REACH = 0.62;
  function sealWash(g, w, h, k, at, warm) {
    paintCut(g, 0, 0, w, h, unit(k) * SEAL_REACH, { kind: 'curve', x: at.x, y: at.y }, rgba(warm, 0.12));
  }
  // An angle the page writes -- the register's slice (--cut-angle, the default), the side a
  // question arrives from (--arrive-angle), the soot's split -- read once, in degrees.
  function angleOf(style, name, fallback) {
    var v = parseFloat(style && typeof style.getPropertyValue === 'function' ? style.getPropertyValue(name || '--cut-angle') : '');
    return isFinite(v) ? v : (fallback == null ? 112 : fallback);
  }
  // The direction a movement went, as a slice's angle (0deg upward, 90deg rightward), to the
  // nearest 15 degrees, as the engine quantizes a pointer's approach; null for no movement at all.
  function headingOf(dx, dy) {
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
    var deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    return ((Math.round(deg / 15) * 15) % 360 + 360) % 360;
  }
  /* A thing that follows a hand -- the compass's needle, the cairn's guide -- goes in clean stairs:
     one stair at a time, from where it stands toward where the hand is now, read again at every
     tread, so a hand that keeps moving is followed tread after tread and is never outrun, and a
     stair is never thrown away and begun again before its first tread lands. No tread goes back
     past the one before it: a hand that turns back is followed by the next stair, its own way.
     When a stair ends with the hand somewhere else, the next begins; nothing is drawn on a
     stair's first moment, when nothing has moved. `o` gives at() and to() (where the thing stands,
     where the hand has it), gap(a, b) (signed, from a to b), put(v) (stand it at v and draw it),
     ms() and treads() for each stair, and near (a gap too small to move for). Hands back go(),
     to follow, and halt(), to let the thing be. */
  function follow(o) {
    var live = 0; // the stair that may still move the thing; any other was halted
    var moving = false;
    var stop = null;
    function go() {
      if (moving) return;
      var from = o.at();
      var first = o.gap(from, o.to());
      if (Math.abs(first) < o.near) return;
      var way = first > 0 ? 1 : -1;
      var mine = ++live;
      moving = true;
      var halt = series({ ms: o.ms(), treads: o.treads(), step: function (k, n) {
        if (mine !== live || !k) return;
        var gap = o.gap(from, o.to());
        var next = from + gap * (k / n);
        if (gap * way <= 0 || (next - o.at()) * way <= 0) return;
        o.put(next);
      }, done: function () {
        if (mine !== live) return;
        moving = false;
        stop = null;
        go();
      } });
      if (mine === live && moving) stop = halt;
    }
    function halt() {
      live += 1;
      moving = false;
      if (stop) stop();
      stop = null;
    }
    return { go: go, halt: halt };
  }

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
  var mounts = new WeakMap();
  function mount(host, options) {
    if (!host) return null;
    var opts = options || {};
    var selector = host.id === 'persona-probe' ? document.getElementById('threshold-way') : null;
    var requested = opts.probe || (selector && selector.value);
    var probe = requested ? probeById(requested) : nextProbe();
    if (!probe) return null;
    var previous = mounts.get(host);
    if (previous) previous();
    var active = true;
    var lentFocus = false;
    function releaseFocus() {
      if (lentFocus && host.getAttribute('tabindex') === '-1') host.removeAttribute('tabindex');
      lentFocus = false;
    }
    mounts.set(host, function () {
      active = false;
      releaseFocus();
    });
    if (selector) selector.value = '';
    noteProbe(probe.probe);
    host.textContent = '';
    host.setAttribute('data-probe', probe.probe);
    host.removeAttribute('data-probe-state');
    var answer = {};
    var frame = el('div', 'probe');
    var ask = el('p', 'probe-ask');
    ask.id = 'probe-ask-' + probe.probe;
    ask.textContent = probe.ask;
    frame.appendChild(ask);
    frame.appendChild(el('p', 'probe-count', 'There is no right answer, and you can skip it.'));
    var body = el('div', 'probe-body');
    frame.appendChild(body);
    // The trace: one live line for assistive tech, and a glass twin over it where the words arrive.
    var lines = el('div', 'probe-trace-wrap');
    var trace = el('p', 'probe-trace probe-trace-live');
    trace.setAttribute('aria-live', 'polite');
    lines.appendChild(trace);
    var glass = el('p', 'probe-trace probe-trace-glass');
    glass.setAttribute('aria-hidden', 'true');
    lines.appendChild(glass);
    lines.setAttribute('data-glass', 'true');
    trace.glass = glass;
    frame.appendChild(lines);
    var meter = el('p', 'probe-trace probe-meter');
    meter.setAttribute('aria-hidden', 'true');
    frame.appendChild(meter);
    trace.meter = meter;
    var skip = el('button', 'probe-option probe-skip', 'skip the question');
    skip.type = 'button';
    var answered = false;
    function current() {
      return active && frame.parentNode === host;
    }
    skip.addEventListener('click', function () {
      if (answered || !current()) return;
      answered = true;
      // Focus leaves the frame before the frame is hidden from assistive tech: it rests on the
      // host (focusable for the length of the rite) until whoever asked moves it on.
      lentFocus = !host.hasAttribute('tabindex');
      if (lentFocus) host.setAttribute('tabindex', '-1');
      try { host.focus({ preventScroll: true }); } catch (e) { try { host.focus(); } catch (e2) { /* it stays */ } }
      // The question goes behind a slice before it goes; only then is the host cleared.
      unmake(frame, function () {
        if (!current()) { releaseFocus(); return; }
        if (frame.parentNode === host) host.removeChild(frame);
        if (!host.firstElementChild) host.textContent = '';
        releaseFocus();
        if (typeof opts.onSkip === 'function') opts.onSkip(probe);
      });
    });
    frame.appendChild(skip);
    host.appendChild(frame);
    // The question stands with its host, which arrives on its own as the question is put (the
    // stage's ask, behind a slice of its own: js/stage.js), so the frame and the ask's words come
    // in by that one edge and are cut by no second one; the options are dealt after it (dealOut).
    // The mechanism's own tint is the host's data-probe (the stylesheet).
    // Where the answer was given: the last press in the frame, as a point of it (a key's press is
    // the middle of the control it pressed), so the reading's seal grows from there.
    var pressed = null;
    function pressAt(x, y) {
      var box = frame.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pressed = { x: unit((x - box.left) / box.width) * 100, y: unit((y - box.top) / box.height) * 100 };
    }
    frame.addEventListener('pointerdown', function (ev) { pressAt(ev.clientX, ev.clientY); }, true);
    frame.addEventListener('keydown', function (ev) {
      if ((ev.key !== 'Enter' && ev.key !== ' ') || !ev.target || typeof ev.target.getBoundingClientRect !== 'function') return;
      var at = ev.target.getBoundingClientRect();
      pressAt(at.left + at.width / 2, at.top + at.height / 2);
    }, true);
    // The reading lands as ONE seal, and only then does what is done with go. A mechanism with a
    // picture or a panel of its own seals that, from the point its answer lives at -- the knocker,
    // the needle's tip, the top stone, the dial's thumb, the mark -- and hands the seal's length
    // here (`own`), and the frame draws no second one (data-seal='own'). Otherwise the frame's own
    // layer is the seal: two shades of the new primary split by a curve round the point the answer
    // was given (the last press in the frame), grown from there in treads cut for it. Once the seal
    // has grown, the glass, the meter and the skip go behind a slice, top to bottom, one after
    // another in one stair; the question is handed on when the last of them has gone. Hands back
    // the seal's length, so a mechanism can let its spent controls follow the seal as well.
    function finish(own) {
      if (answered || !current()) return 0;
      answered = true;
      var reading = record(answer);
      if (!current()) return 0;
      // The trace's last line was heard once already, so the live line is let go.
      trace.textContent = '';
      if (typeof trace.undoGlass === 'function') { try { trace.undoGlass(); } catch (e) { /* the words stand */ } }
      trace.undoGlass = null;
      var wait = beat('long');
      var sealLength;
      if (own != null) {
        frame.setAttribute('data-seal', 'own');
        sealLength = Math.max(0, Number(own) || 0);
      } else {
        if (pressed) {
          frame.style.setProperty('--read-x', pressed.x.toFixed(1) + '%');
          frame.style.setProperty('--read-y', pressed.y.toFixed(1) + '%');
        }
        sealLength = cutFor(frame, 'seal', { duration: 'long' }) || wait;
      }
      host.setAttribute('data-probe-state', 'read');
      var handed = false;
      function hand() { if (handed || !current()) return; handed = true; if (typeof opts.onAnswer === 'function') opts.onAnswer(reading, probe); }
      var after = wait ? sealLength : 0;
      var gone = seedOf();
      var k = 0;
      if (glass.textContent) unmake(glass, function () { glass.textContent = ''; restore(glass); }, gone, after + staggerOf(k++));
      if (gauge(trace, '', after + staggerOf(k), gone)) k += 1;
      unmake(skip, function () { skip.hidden = true; hand(); }, gone, after + staggerOf(k));
      return wait ? sealLength : 0;
    }
    var kinds = {
      choice: choiceProbe, sequence: sequenceProbe, tap: tapProbe, hold: holdProbe,
      place: placeProbe, draw: drawProbe, windows: windowsProbe, balance: balanceProbe,
      slider: sliderProbe, sky: skyProbe, keys: keysProbe, knock: knockProbe,
      rubbing: rubbingProbe, cairn: cairnProbe, compass: compassProbe
    };
    (kinds[probe.kind] || choiceProbe)(probe, body, trace, answer, finish);
    return probe;
  }
  function optionButton(label, detail) {
    var button = el('button', 'probe-option');
    button.type = 'button';
    button.appendChild(el('span', 'probe-option-label', label));
    if (detail) button.appendChild(el('span', 'probe-option-detail', detail));
    return button;
  }
  // Each landing (a line, its doors, its counter) is a landing of its own. The first deals its
  // doors one after another; each one after it replaces the last behind one slice, the last left
  // over its place as a ghost, sealed door and all, and cut away by the same edge. The last landing
  // is never wiped: its sealed door stands under the frame's read seal until the question is
  // handed on.
  function choiceProbe(probe, body, trace, answer, finish) {
    var steps = probe.steps || [{ ask: null, options: probe.options }];
    var index = 0;
    var landing = null;
    function step() {
      var old = landing;
      landing = el('div', 'probe-landing');
      var stage = steps[index];
      var taken = false;
      var line = null;
      if (stage.ask && steps.length > 1 && !probe.quick) {
        line = el('p', 'probe-step');
        landing.appendChild(line);
      }
      var group = el('div', 'probe-options');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'choices');
      var buttons = [];
      stage.options.forEach(function (option) {
        var button = optionButton(option.label, option.detail);
        button.addEventListener('click', function () {
          if (taken) return;
          taken = true;
          add(answer, option.weights, 1);
          index += 1;
          // The chosen thing is sealed (data-set: the engine grows its fill from the press, and its
          // label is set down a tread) and the rest go behind a slice, one after another in one
          // stair, out from the chosen one -- the nearest first -- as if the choice put them by;
          // only then does the next landing come.
          var others = buttons.filter(function (other) { return other !== button; });
          var away = stepsFrom(others, centreOf(button));
          button.setAttribute('data-set', 'true');
          var gone = seedOf();
          others.forEach(function (other, k) { unmake(other, null, gone, staggerOf(away[k])); });
          var wait = beat(probe.quick ? 'short' : 'long');
          function go() {
            if (index < steps.length) {
              note(trace, 'noted: ' + option.label);
              step();
            } else finish();
          }
          if (wait) window.setTimeout(go, wait); else go();
        });
        buttons.push(button);
        group.appendChild(button);
      });
      landing.appendChild(group);
      var counter = null;
      if (steps.length > 1) {
        counter = el('p', 'probe-count probe-counter', (probe.quick ? 'pair ' : '') + (index + 1) + ' of ' + steps.length);
        landing.appendChild(counter);
      }
      body.appendChild(landing);
      if (line) say(line, stage.ask);
      if (old && beat('medium')) replace(landing, old, 'probe-landing-ghost');
      else {
        if (old && old.parentNode === body) body.removeChild(old);
        dealOut(buttons);
      }
      if (counter) tick(counter);
      // Focus moves to the new landing before the old one is hidden from assistive tech.
      var first = group.querySelector('button');
      if (first && index > 0) first.focus();
    }
    step();
  }
  // An object is carried, not teleported: the pressed one seals, then goes behind a slice while
  // the rest close ranks in treads (the engine's flip), and its name goes into the chosen order,
  // cut in by the reveal, with its arrow stamped as it lands. Undo runs the same in reverse. The
  // reading is the `picked` array, never the DOM.
  function sequenceProbe(probe, body, trace, answer, finish) {
    var items = Array.isArray(probe.items) ? probe.items.slice() : [];
    var target = Math.max(1, Math.min(items.length, probe.take || items.length));
    var picked = [];
    var busy = false;
    function scoreAndFinish() {
      for (var i = 0; i < picked.length; i++) {
        if (picked[i].slots && picked[i].slots[i]) add(answer, picked[i].slots[i], 1);
      }
      finish();
    }
    var order = el('p', 'probe-step probe-order');
    order.hidden = true;
    var lead = el('span', 'probe-order-lead', 'chosen order: ');
    order.appendChild(lead);
    var names = el('span', 'probe-order-names');
    order.appendChild(names);
    body.appendChild(order);
    var group = el('div', 'probe-options');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'objects to place');
    var buttons = [];
    items.forEach(function (item, index) {
      var button = optionButton(item.label, item.detail);
      button.addEventListener('click', function () {
        if (busy || picked.indexOf(item) !== -1) return;
        pick(item, index);
      });
      buttons.push(button);
      group.appendChild(button);
    });
    body.appendChild(group);
    dealOut(buttons);
    var count = el('p', 'probe-count probe-counter', target + ' to place');
    body.appendChild(count);
    var controls = el('div', 'controls');
    var undo = el('button', 'probe-option probe-undo', 'undo last');
    undo.type = 'button';
    undo.disabled = true;
    undo.addEventListener('click', function () {
      if (!picked.length || busy) return;
      var item = picked.pop();
      note(trace, 'last object removed');
      takeName();
      bringBack(items.indexOf(item));
      refresh();
    });
    controls.appendChild(undo);
    var reset = el('button', 'probe-option probe-undo', 'start over');
    reset.type = 'button';
    reset.disabled = true;
    reset.addEventListener('click', function () {
      if (!picked.length || busy) return;
      var gone = picked.slice();
      picked = [];
      note(trace, 'order reset');
      takeAll();
      gone.forEach(function (item) { bringBack(items.indexOf(item)); });
      refresh();
    });
    controls.appendChild(reset);
    body.appendChild(controls);
    function shuffle(change) {
      var m = engine();
      if (m && typeof m.flip === 'function' && !stilled()) {
        try { m.flip(group, change, { family: 'arrive', dealt: false }); return; } catch (e) { /* plain */ }
      }
      change();
    }
    function refresh() {
      var left = target - picked.length;
      count.textContent = left > 0 ? left + ' to place' : 'reading order';
      tick(count);
      undo.disabled = picked.length === 0;
      reset.disabled = picked.length === 0;
    }
    // The names still standing in the order (not on their way out).
    function standing() {
      if (typeof names.querySelectorAll !== 'function') return names.childNodes.length;
      return names.querySelectorAll('.probe-order-name:not(.is-leaving)').length;
    }
    function putName(item) {
      // An order that was going (its last name taken) and takes a new name is kept after all.
      if (order.classList.contains('is-leaving')) { restore(order); names.textContent = ''; }
      if (standing()) {
        var arrow = el('span', 'probe-order-arrow', ' → ');
        arrow.setAttribute('aria-hidden', 'true');
        names.appendChild(arrow);
        tick(arrow);
      }
      var name = el('span', 'probe-order-name');
      names.appendChild(name);
      if (order.hidden) {
        order.hidden = false;
        say(lead, 'chosen order: ');
      }
      say(name, item.label);
    }
    // A name taken out of the order goes behind a slice with its arrow; the last one takes the
    // whole line with it, and only then is the line hidden.
    function takeName() {
      var list = typeof names.querySelectorAll === 'function' ? names.querySelectorAll('.probe-order-name:not(.is-leaving)') : names.childNodes;
      var name = list.length ? list[list.length - 1] : null;
      if (!name) return;
      var arrow = name.previousSibling;
      if (!(arrow && arrow.classList && arrow.classList.contains('probe-order-arrow') && !arrow.classList.contains('is-leaving'))) arrow = null;
      function drop() {
        if (name.parentNode === names) names.removeChild(name);
        if (arrow && arrow.parentNode === names) names.removeChild(arrow);
      }
      if (standing() === 1) {
        unmake(order, function () { drop(); names.textContent = ''; order.hidden = true; restore(order); });
        return;
      }
      if (arrow) unmake(arrow);
      unmake(name, drop);
    }
    function takeAll() {
      if (!standing()) return;
      unmake(order, function () { names.textContent = ''; order.hidden = true; restore(order); });
    }
    function pick(item, index) {
      busy = true;
      picked.push(item);
      var button = buttons[index];
      button.setAttribute('data-set', 'true');
      note(trace, 'placed: ' + item.label);
      var wait = beat('short');
      function go() {
        var leaving = unmake(button, function () {
          shuffle(function () { if (button.parentNode === group) group.removeChild(button); });
        });
        putName(item);
        refresh();
        if (picked.length < target) { busy = false; return; }
        // The reading lands once the last object has gone into the order, not on top of it; the
        // order stands meanwhile (busy), so nothing is taken out of it under the seal.
        if (leaving) window.setTimeout(scoreAndFinish, leaving); else scoreAndFinish();
      }
      if (wait) window.setTimeout(go, wait); else go();
    }
    function bringBack(index) {
      var button = buttons[index];
      if (!button) return;
      button.removeAttribute('data-set');
      restore(button);
      shuffle(function () {
        var next = null;
        for (var i = index + 1; i < buttons.length && !next; i++) {
          if (buttons[i].parentNode === group && !buttons[i].classList.contains('is-leaving')) next = buttons[i];
        }
        if (button.parentNode === group) group.removeChild(button);
        group.insertBefore(button, next);
      });
      dealOut([button]);
    }
  }
  function tapProbe(probe, body, trace, answer, finish) {
    var taps = [];
    var button = el('button', 'probe-big');
    button.type = 'button';
    button.textContent = probe.label + ' (5)';
    button.addEventListener('click', function () {
      if (taps.length >= 5) return;
      var now = Date.now();
      var gap = taps.length ? now - taps[taps.length - 1] : 0;
      taps.push(now);
      // Each tap leaves its mark: the fill steps a fifth further out from where the first tap
      // landed (--fill-cut), and the stamp's depth is the gap since the last -- short and sharp,
      // or wide.
      if (taps.length === 1) dress(button);
      button.style.setProperty('--fill-cut', Math.min(5, taps.length) * 20 + '%');
      button.style.setProperty('--stamp-scale', (gap ? 0.94 + unit((gap - 120) / 1400) * 0.12 : 0.97).toFixed(3));
      tick(button);
      var left = 5 - taps.length;
      button.textContent = left > 0 ? probe.label + ' (' + left + ')' : 'done';
      note(trace, left > 0 ? left + ' to go' : 'reading the interval');
      gauge(trace, tally(taps.length));
      if (taps.length < 5) return;
      var gaps = [];
      for (var i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      var mean = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
      var spread = 0;
      for (var j = 0; j < gaps.length; j++) spread += Math.abs(gaps[j] - mean);
      spread /= gaps.length;
      bucket(probe.buckets, mean, answer);
      add(answer, spread < mean * 0.22 ? probe.wobble.steady : probe.wobble.loose, 1);
      // Sealed first; the button's fill steps back and it greys once the seal has grown.
      retire(button, finish());
    });
    body.appendChild(button);
  }
  function holdProbe(probe, body, trace, answer, finish) {
    var started = 0;
    var ticker = null;
    var marks = 0;
    var button = el('button', 'probe-big');
    button.type = 'button';
    button.textContent = probe.label;
    // The hold is a vessel filling: every rolled while its fill steps outward from where it was
    // pressed by a fifth of what is left (--fill-cut), so it comes ever nearer full and never gets
    // there, and it never turns back. The tally beneath counts the whiles. None of it implies a
    // target: the length of the press is the whole answer.
    function advance() {
      ticker = window.setTimeout(function () {
        if (!started) return;
        marks += 1;
        button.style.setProperty('--fill-cut', ((1 - Math.pow(0.8, marks)) * 100).toFixed(1) + '%');
        gauge(trace, tally(marks));
        advance();
      }, between(160, 420));
    }
    function down() {
      if (started || button.disabled) return;
      started = Date.now();
      marks = 0;
      dress(button);
      button.classList.add('held');
      note(trace, 'holding');
      advance();
    }
    function up() {
      if (!started) return;
      var held = Date.now() - started;
      started = 0;
      window.clearTimeout(ticker);
      button.classList.remove('held');
      bucket(probe.buckets, held, answer);
      // Sealed first; the fill steps back to its point and the button greys once the seal has grown.
      retire(button, finish());
    }
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', function () {
      if (!started) return;
      started = 0;
      window.clearTimeout(ticker);
      // A let-go: the fill steps back to the point it grew from.
      button.classList.remove('held');
      button.style.removeProperty('--fill-cut');
      gauge(trace, '');
      note(trace, 'let go early; press again');
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
    function show() {
      mark.hidden = false;
      mark.style.left = cursor.x * 100 + '%';
      mark.style.top = cursor.y * 100 + '%';
    }
    // A mark already out, moved by a key, lands on its new place in a few shrinking treads (the
    // engine's flip in the arrive family, a translate the compositor draws), never along a glide;
    // the first showing is its set-down.
    function move() {
      var m = engine();
      if (!mark.hidden && m && typeof m.flip === 'function' && !stilled()) {
        try { m.flip(field, show, { items: [mark], family: 'arrive', dealt: false }); return; } catch (e) { /* it jumps */ }
      }
      show();
    }
    function place(x, y) {
      cursor.x = Math.min(1, Math.max(0, x));
      cursor.y = Math.min(1, Math.max(0, y));
      show();
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
      // The mark is set like a seal in wax (mark-set), and the field takes the impression: its
      // layer grows from the mark as a curve (--mark-x, --mark-y; data-set), in treads cut for it,
      // so it is closed, not merely tinted. That impression is the reading's one seal.
      field.style.setProperty('--mark-x', (cursor.x * 100).toFixed(1) + '%');
      field.style.setProperty('--mark-y', (cursor.y * 100).toFixed(1) + '%');
      var seal = cutFor(field, 'seal', { duration: 'long' }) || beat('long');
      field.setAttribute('data-set', 'true');
      finish(seal);
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
        move();
        note(trace, 'arrow keys move the mark, enter leaves it there');
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        place(cursor.x, cursor.y);
      }
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'tap or click anywhere in the field, or move the mark with the arrow keys and press enter'));
  }
  // The line is drawn as the hand moves, plainly, on paper that rests in two shades split by one
  // slice through its centre at the register's angle. When the hand lifts, the line SETS: a slice
  // in the line's own direction -- from where it began toward where it ended -- steps across the
  // pad in a few treads, and behind it the line is the second accent. The reading is `points`
  // alone.
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
    var style = window.getComputedStyle(body);
    var cool = rgbOf(style.getPropertyValue('--accent'), '#9fcbff');
    var warm = rgbOf(style.getPropertyValue('--accent2'), '#ffe7ab');
    var paper = rgbOf(style.getPropertyValue('--bg2'), '#1c2a4e');
    var fold = { kind: 'slice', angle: angleOf(style) };
    var settled = false; // the line is set, and the pad takes no more
    var set = 0; // how far the setting slice has stepped across the pad, 0 to 1
    var setEdge = null;
    function at(ev) {
      var box = pad.getBoundingClientRect();
      return { x: (ev.clientX - box.left) / box.width * pad.width,
        y: (ev.clientY - box.top) / box.height * pad.height };
    }
    function line(g, color, width) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      for (var i = 0; i < points.length; i++) { i ? g.lineTo(points[i].x, points[i].y) : g.moveTo(points[i].x, points[i].y); }
      g.stroke();
    }
    function paint() {
      if (!ctx) return;
      var w = pad.width;
      var h = pad.height;
      ctx.clearRect(0, 0, w, h);
      // The paper: two shades split by one slice through its centre.
      ctx.fillStyle = rgba(paper, 0.3);
      ctx.fillRect(0, 0, w, h);
      paintCut(ctx, 0, 0, w, h, 0.5, fold, rgba(paper, 0.25));
      if (!points.length) return;
      line(ctx, rgba(cool, 0.95), 2.4);
      if (set > 0 && setEdge) {
        // Behind the setting slice the line is warm.
        ctx.save();
        ctx.beginPath();
        if (cutRegion(ctx, 0, 0, w, h, set, setEdge)) {
          ctx.clip();
          line(ctx, rgba(warm, 0.95), 3);
        }
        ctx.restore();
      }
    }
    pad.addEventListener('pointerdown', function (ev) {
      if (settled) return;
      drawing = true;
      points = [at(ev)];
      pad.setPointerCapture(ev.pointerId);
    });
    pad.addEventListener('pointermove', function (ev) {
      if (!drawing) return;
      points.push(at(ev));
      paint();
      // A mark for every fourth point; gauge sets one down only when the tally has changed.
      gauge(trace, tally(Math.ceil(points.length / 4)));
    });
    pad.addEventListener('pointerup', function () {
      if (!drawing) return;
      drawing = false;
      score();
    });
    pad.addEventListener('keydown', function (ev) {
      if (settled) return;
      var moves = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
      if (moves[ev.key]) {
        ev.preventDefault();
        var last = points.length ? points[points.length - 1] : { x: 40, y: pad.height / 2 };
        points.push({ x: Math.min(pad.width, Math.max(0, last.x + moves[ev.key][0])),
          y: Math.min(pad.height, Math.max(0, last.y + moves[ev.key][1])) });
        paint();
        gauge(trace, tally(points.length));
        if (points.length === 1) note(trace, 'the arrow keys draw; enter finishes the line');
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        score();
      }
    });
    function score() {
      if (settled) return;
      if (points.length < 2) { note(trace, 'one line, any line'); return; }
      settled = true;
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
      // The line sets: a slice in the line's own direction steps across the pad, and behind it
      // the line is warm. A line that comes back to where it began has no direction of its own,
      // and sets at the register's angle. The setting is the reading's one seal.
      pad.style.cursor = 'default';
      var heading = headingOf(points[points.length - 1].x - points[0].x, points[points.length - 1].y - points[0].y);
      setEdge = { kind: 'slice', angle: heading === null ? fold.angle : heading };
      var seal = beat('long');
      series({ ms: seal, treads: 3 + Math.floor(Math.random() * 3), step: function (k, n) {
        if (!k) return;
        set = k / n;
        paint();
      } });
      finish(seal);
    }
    body.appendChild(pad);
    body.appendChild(el('p', 'probe-count', 'draw with a finger, a mouse, or the arrow keys'));
    paint();
  }
  // A lamp is lit behind a curtain: the pane's light grows out from the lamp as a curve -- the
  // window's one seal -- and a window put out shrinks back into it. On the third light the whole
  // facade reads: the nine panes are set down one tread each (pane-read), outward from the third
  // lamp, those as far from it together, as a curve from that lamp would reach them, before the
  // shape is scored.
  function windowsProbe(probe, body, trace, answer, finish) {
    var selected = [];
    var field = el('div', 'probe-windows');
    field.setAttribute('role', 'group');
    field.setAttribute('aria-label', 'Nine windows. Light three in any order.');
    var panes = [];
    var read = false;
    probe.windows.forEach(function (tile, index) {
      var button = el('button', 'probe-window');
      button.type = 'button';
      button.setAttribute('aria-label', tile.label + ' window');
      button.setAttribute('aria-pressed', 'false');
      var pane = el('span', 'probe-window-pane');
      pane.setAttribute('aria-hidden', 'true');
      // The lamp behind the pane: a layer of its own, lit in treads cut for that lighting
      // (--ease-seal) and put out in treads cut for that (--ease-unseal).
      var light = el('span', 'probe-window-light');
      pane.appendChild(light);
      button.appendChild(pane);
      panes.push(pane);
      button.addEventListener('click', function () {
        if (read) return;
        var at = selected.indexOf(index);
        if (at !== -1) {
          selected.splice(at, 1);
          cutFor(light, 'unseal', { duration: 'medium' });
          button.setAttribute('data-was-lit', 'true');
          button.setAttribute('aria-pressed', 'false');
        } else {
          selected.push(index);
          cutFor(light, 'seal', { duration: 'medium' });
          button.removeAttribute('data-was-lit');
          button.setAttribute('aria-pressed', 'true');
        }
        if (selected.length < 3) {
          note(trace, selected.length ? selected.length + ' lit; ' + (3 - selected.length) + ' to go.' : 'All windows dark again. Light any three.');
          return;
        }
        read = true;
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
        note(trace, 'three lit: the building reads');
        // The third lamp is lit before the facade reads: data-read waits for that lighting's
        // length, and the reading is handed on a long beat after the last pane is set down.
        var lighting = stilled() ? 0 : rolled(light, '--motion-seal') || beat('medium');
        function facade() {
          var rings = stepsBy(panes.map(function (p, i) {
            return Math.hypot(i % 3 - index % 3, Math.floor(i / 3) - Math.floor(index / 3));
          }), 0.01);
          panes.forEach(function (p, i) { p.style.setProperty('--d', staggerOf(rings[i]) + 'ms'); });
          field.setAttribute('data-read', 'true');
          var wait = beat('long');
          if (wait) window.setTimeout(finish, wait); else finish();
        }
        if (lighting) window.setTimeout(facade, lighting); else facade();
      });
      field.appendChild(button);
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'Tap a lit window to close it before lighting the third.'));
  }
  // The final division is the answer, not the order of presses. Undo never leaves a reading behind.
  // The balance settles in treads: a dropped weight falls from the spare row to halfway and into
  // its bowl, and the beam and the bowls step to their marks on the treads after, always forward
  // and never past them; a weight taken back lets them step back to theirs in three even treads.
  // 'leave them hanging' seals the picture from the pivot it hangs from -- the reading's one seal
  // -- and the beam is cut to the second accent; the spent controls grey once it has grown.
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
    var counters = [];
    probe.bowls.forEach(function (bowl, index) {
      var button = el('button', 'probe-option');
      button.type = 'button';
      button.appendChild(el('span', 'probe-option-label', bowl.label));
      // The count under each bowl is a counter, stamped (count-stamp) when it changes.
      var detail = el('span', 'probe-option-detail', bowl.place + ' bowl: ');
      var counter = el('span', 'probe-counter');
      detail.appendChild(counter);
      counters.push(counter);
      button.appendChild(detail);
      button.addEventListener('click', function () {
        if (submitted || placed.length >= probe.total) return;
        counts[index] += 1;
        placed.push(index);
        redraw({ drop: index });
      });
      buttons.push(button);
      details.push(detail);
      group.appendChild(button);
    });
    body.appendChild(group);
    dealOut(buttons);
    var controls = el('div', 'controls');
    var undo = el('button', 'btn-text', 'undo last weight');
    undo.type = 'button';
    undo.addEventListener('click', function () {
      if (submitted || !placed.length) return;
      counts[placed.pop()] -= 1;
      redraw({ lift: true });
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
      redraw({ seal: true });
      var sealing = finish(beat('medium'));
      buttons.concat([undo, leave]).forEach(function (button) { retire(button, sealing); });
    });
    controls.appendChild(undo);
    controls.appendChild(leave);
    body.appendChild(controls);

    var shown = { tilt: 0, depth: counts.map(function () { return 0; }), fall: null, sealed: 0 };
    var cancel = null;
    function tiltFor(c) { return (c[0] - c[2]) * picture.height * 0.012; }
    function paint() {
      if (!g) return;
      var style = window.getComputedStyle(body);
      var primary = style.getPropertyValue('--md-sys-color-primary').trim();
      var brass = style.getPropertyValue('--md-sys-color-tertiary').trim();
      var ink = style.getPropertyValue('--md-sys-color-on-surface').trim();
      var ground = style.getPropertyValue('--md-sys-color-surface-dim').trim();
      var warm = rgbOf(style.getPropertyValue('--accent2'), '#ffe7ab');
      var w = picture.width;
      var h = picture.height;
      var pivot = { x: w * 0.5, y: h * 0.2 };
      var tilt = shown.tilt;
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
      g.strokeStyle = shown.sealed ? rgba(warm, 1) : primary;
      g.lineWidth = shown.sealed ? 3 : 2;
      g.beginPath();
      g.moveTo(w * 0.08, beamY(w * 0.08));
      g.lineTo(w * 0.92, beamY(w * 0.92));
      g.stroke();
      counts.forEach(function (count, index) {
        var x = w * (0.18 + index * 0.32);
        var y = h * (0.64 + shown.depth[index] * 0.018);
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
        var inBowl = count - (shown.fall && shown.fall.index === index && shown.fall.k < 2 ? 1 : 0);
        for (var i = 0; i < inBowl; i++) {
          g.beginPath();
          g.arc(x + (i % 3 - 1) * radius * 3,
            y + bh - (Math.floor(i / 3) + 1) * radius * 2.5,
            radius, 0, Math.PI * 2);
          g.fill();
        }
        // The weight in flight: at the spare row, then halfway, then in its bowl.
        if (shown.fall && shown.fall.index === index && shown.fall.k < 2) {
          var fromY = h * 0.92;
          var toY = y + bh - radius * 2.5;
          g.beginPath();
          g.arc(shown.fall.k === 0 ? w / 2 : x, shown.fall.k === 0 ? fromY : (fromY + toY) / 2, radius, 0, Math.PI * 2);
          g.fill();
        }
      });
      g.fillStyle = brass;
      var spare = probe.total - placed.length + (shown.fall && shown.fall.k === 0 ? 1 : 0);
      for (var i = 0; i < spare; i++) {
        g.beginPath();
        g.arc(w / 2 + (i - (spare - 1) / 2) * h * 0.055, h * 0.92, h * 0.018, 0, Math.PI * 2);
        g.fill();
      }
      if (shown.sealed) sealWash(g, w, h, shown.sealed, pivot, warm);
    }
    function settle(how) {
      if (cancel) cancel();
      var fromTilt = shown.tilt;
      var toTilt = tiltFor(counts);
      var fromDepth = shown.depth.slice();
      var dropping = how.drop != null;
      shown.fall = dropping ? { index: how.drop, k: 0 } : null;
      cancel = series({ ms: beat(how.seal ? 'medium' : 'long'), treads: how.lift || how.seal ? 3 : 3 + Math.floor(Math.random() * 3), step: function (k, n) {
        if (shown.fall) shown.fall.k = k;
        // A dropped weight lands first (its fall takes the first tread), and the beam and the
        // bowls answer it on the treads after.
        var p = k >= n ? 1 : dropping ? Math.max(0, (k - 1) / Math.max(1, n - 1)) : k / n;
        shown.tilt = fromTilt + (toTilt - fromTilt) * p;
        for (var i = 0; i < counts.length; i++) shown.depth[i] = fromDepth[i] + (counts[i] - fromDepth[i]) * p;
        if (how.seal) shown.sealed = k / n;
        paint();
      }, done: function () { shown.fall = null; shown.tilt = toTilt; paint(); } });
    }
    function redraw(how) {
      var left = probe.total - placed.length;
      buttons.forEach(function (button, index) {
        var bowl = probe.bowls[index];
        var count = plural(counts[index], 'weight');
        if (counters[index].textContent !== count) {
          counters[index].textContent = count;
          tick(counters[index]);
        }
        button.setAttribute('aria-label', 'Give one weight to ' + bowl.label + '; ' + count + ' inside');
        if (!submitted) button.disabled = left === 0;
      });
      if (!submitted) {
        undo.disabled = placed.length === 0;
        leave.disabled = left !== 0;
      }
      note(trace, counts.map(function (count, index) {
        return probe.bowls[index].label + ': ' + count;
      }).join('; ') + '. ' + (left ? plural(left, 'weight') + ' left to place.'
        : 'All seven hang. Leave them here, or undo a weight to change the balance.'));
      gauge(trace, tally(placed.length));
      settle(how || {});
    }
    redraw();
  }
  // Seven keys, one lock. A first press on a key weighs it in the hand and reads its one line; a
  // second press on the same key tries it in the lock. The key tried is most of the answer, and
  // how many were weighed before trying is the rest. Nothing is hidden that matters: any key
  // turns, so the weighing is curiosity made visible, never a puzzle. Weighing cuts the detail in
  // by the reveal; turning turns the key about its bow in three or four even clicks (key-turn),
  // and it stays turned while the other six go behind a slice, one after another in one stair,
  // out from the turned key, the nearest first; only then are they disabled.
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
          var rest = buttons.filter(function (b) { return b !== button; });
          var away = stepsFrom(rest, centreOf(button));
          // The turn: three or four even clicks, as a lock's wards give under a key, cut for this
          // turn alone.
          button.style.setProperty('--key-turn', (8 + Math.random() * 6).toFixed(1) + 'deg');
          cutFor(button, 'key-turn', { treads: 3 + Math.floor(Math.random() * 2), duration: 'long' });
          button.setAttribute('data-turned', 'true');
          var shed = 0;
          var gone = seedOf();
          rest.forEach(function (other, k) {
            shed = Math.max(shed, unmake(other, null, gone, staggerOf(away[k])));
          });
          note(trace, key.label + ' turns in the lock');
          var wait = beat('long');
          // The turned key stays as it is, turned and filled, the mark of the answer, and is only
          // inert (the `done` guard ignores presses); the six are disabled once they have gone.
          function turned() {
            button.setAttribute('aria-disabled', 'true');
            finish();
          }
          function shedded() {
            for (var i = 0; i < buttons.length; i++) if (buttons[i] !== button) buttons[i].disabled = true;
          }
          if (wait) {
            window.setTimeout(turned, wait);
            window.setTimeout(shedded, Math.max(wait, shed + 40));
          } else { shedded(); turned(); }
          return;
        }
        held = index;
        if (weighed.indexOf(index) === -1) weighed.push(index);
        for (var j = 0; j < buttons.length; j++) buttons[j].setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        detail.hidden = false;
        say(detail, key.detail);
        note(trace, key.label + ': ' + key.detail + '. Press it again to try it in the lock.');
      });
      buttons.push(button);
      group.appendChild(button);
    });
    body.appendChild(group);
    dealOut(buttons);
    body.appendChild(el('p', 'probe-count', 'a first press weighs a key in your hand; a second press on the same key tries it in the lock'));
  }
  // The room answers the dial by area: ember and frost are two shades split by one edge, and the
  // dial moves the edge (data-warmth) in treads; the nearer end's word opens its tracking a step;
  // 'leave it there' seals the panel from the point the dial was left at, the reading's one seal.
  function sliderProbe(probe, body, trace, answer, finish) {
    var wrap = el('div', 'probe-dial');
    // The panel's seal: a layer of its own that grows from the dial's thumb at data-set, in the
    // treads the engine cuts for that seal on the panel, over the room at the share the dial gave it.
    var seal = el('span', 'probe-dial-seal');
    seal.setAttribute('aria-hidden', 'true');
    wrap.appendChild(seal);
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
    function room() {
      var v = Number(input.value);
      wrap.setAttribute('data-warmth', String(Math.round(v / 20)));
      wrap.setAttribute('data-lean', v < 40 ? 'cold' : v > 60 ? 'warm' : 'mid');
    }
    room();
    var sealed = null; // the value left there, once the dial is spent
    input.addEventListener('input', function () {
      if (sealed !== null) { input.value = sealed; return; }
      room();
      note(trace, 'the dial is somewhere it was not');
    });
    input.addEventListener('keydown', function (ev) { if (sealed !== null) ev.preventDefault(); });
    done.addEventListener('click', function () {
      if (done.disabled || done.getAttribute('aria-disabled') === 'true') return;
      var warmth = Number(input.value) / 100;
      add(answer, probe.cold, 1 - warmth);
      add(answer, probe.warm, warmth);
      // The panel is sealed from where its thumb was left -- the reading's one seal, in treads cut
      // for it -- and the dial and the button are spent like any control: inert at once, greyed
      // once the seal has grown, disabled only after that.
      sealed = input.value;
      var panel = wrap.getBoundingClientRect();
      var track = input.getBoundingClientRect();
      if (panel.width && panel.height) {
        wrap.style.setProperty('--dial-at', unit((track.left - panel.left + track.width * warmth) / panel.width) * 100 + '%');
        wrap.style.setProperty('--dial-y', unit((track.top - panel.top + track.height / 2) / panel.height) * 100 + '%');
      }
      var seal = cutFor(wrap, 'seal', { duration: 'long' }) || beat('long');
      wrap.setAttribute('data-set', 'true');
      var sealing = finish(seal);
      retire(input, sealing);
      retire(done, sealing);
    });
    body.appendChild(wrap);
    body.appendChild(done);
  }
  // The stars come out one at a time, faster as the dusk deepens, and the answer is how many
  // there are when the visitor says enough -- and how many of them they hurried out by hand. The
  // sky fills on its own if they wait, but it never answers on its own: the press is theirs.
  // A star does not fade in: it is cut out of the dark as a curve growing from its centre in a few
  // treads, and its line to the nearest star already out comes up with it, tread for tread. Night
  // falls by area: the sky rests in two shades, night above and dusk below, split by one slice
  // that steps down the sky as the stars come out. The stars a visitor hurried are warm, so their
  // hand shows, and 'enough' seals the sky from the last star out -- the reading's one seal. The
  // sky is drawn only when a tread lands: a star's own short stair is the only thing that waits on
  // the frames, and only while that star is coming out; there is no twinkle, and nothing comes out
  // while the sky is not on the page to be seen.
  function skyProbe(probe, body, trace, answer, finish) {
    var full = probe.full || 48;
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
    var sealed = 0; // how far the seal has grown from the last star, 0 to 1
    var timer = 0;
    // Night falls from the zenith: a slice sweeping down the sky, as far as a stair rolled for this
    // sky says for the share of the stars that are out -- never the whole sky, so the dusk keeps
    // the horizon.
    var nightfall = rite('stair');
    var NIGHT = { kind: 'slice', angle: 180 };
    // The stars keep no even pace: each comes after a pace rolled for it alone, with a hold every
    // few stars, the few rolled per sky.
    var holdEvery = 3 + Math.floor(Math.random() * 4);
    function pace(n) {
      var base = 160 + 900 * Math.pow(0.95, n);
      var hold = n && n % holdEvery === 0 ? between(300, 1100) : 0;
      return base * between(0.7, 1.4) + hold;
    }
    function count() {
      if (!trace.meter) return;
      var dots = '';
      for (var i = 0; i < stars.length; i++) dots += (i && i % 8 === 0 ? ' ' : '') + '·';
      gauge(trace, stars.length ? dots : 'none out yet');
    }
    // The star already out nearest to (x, y), near enough to be joined to it, or -1.
    function nearest(x, y) {
      var reach = 0.2;
      var best = reach * reach;
      var near = -1;
      for (var j = 0; j < stars.length; j++) {
        var dx = stars[j].x - x;
        var dy = (stars[j].y - y) * sky.height / sky.width;
        var d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; near = j; }
      }
      return near;
    }
    function appear(x, y, own) {
      var star = { x: x, y: y, r: 0.9 + Math.random() * 1.5, own: !!own, k: 0, link: nearest(x, y) };
      stars.push(star);
      series({ ms: beat('medium') * between(1, 1.6), treads: 2 + Math.floor(Math.random() * 3), step: function (k, n) {
        if (!k) return;
        star.k = k / n;
        paint();
      } });
      count();
      if (stars.length === 1) note(trace, 'the first one is out');
      if (stars.length >= full) {
        say(enough, 'that is all of them');
        retire(hurry);
        note(trace, 'the sky is full');
      }
    }
    function kindle(x, y) {
      if (stopped || stars.length >= full) return;
      appear(x, y, true);
      hurried += 1;
      if (stars.length < full) note(trace, hurried === 1 ? 'one hurried along' : hurried + ' hurried along');
    }
    function paint() {
      if (!g) return;
      var w = sky.width;
      var h = sky.height;
      var i;
      g.fillStyle = rgba(blend(blend(dusk, warm, 0.22), night, 0.5), 1);
      g.fillRect(0, 0, w, h);
      paintCut(g, 0, 0, w, h, nightfall(Math.min(1, stars.length / full)) * 0.85, NIGHT, rgba(night, 0.9));
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, h * 0.9, w, h * 0.1);
      g.lineWidth = 1;
      for (i = 0; i < stars.length; i++) {
        var a = stars[i];
        if (a.link < 0 || a.k <= 0) continue;
        // The line comes up with its star: so far, and no further, until the next tread.
        var b = stars[a.link];
        var near = Math.hypot((b.x - a.x) * w, (b.y - a.y) * h) / (w * 0.2);
        g.strokeStyle = rgba(sealed ? warm : cool, 0.1 + 0.22 * Math.max(0, 1 - near));
        g.beginPath();
        g.moveTo(a.x * w, a.y * h);
        g.lineTo(a.x * w + (b.x - a.x) * w * a.k, a.y * h + (b.y - a.y) * h * a.k);
        g.stroke();
      }
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (s.k <= 0) continue;
        // A star: two shades of its light split by one curve, a halo and its core, both cut out of
        // the dark from its centre as it comes out.
        var c = s.own ? warm : blend(cool, [255, 255, 255], 0.55);
        var x = s.x * w;
        var y = s.y * h;
        g.fillStyle = rgba(c, 0.22);
        g.beginPath();
        g.arc(x, y, s.r * 4 * s.k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rgba(c, 1);
        g.beginPath();
        g.arc(x, y, s.r * 1.5 * s.k, 0, Math.PI * 2);
        g.fill();
      }
      if (sealed) {
        var last = stars[stars.length - 1];
        sealWash(g, w, h, sealed, last ? { x: last.x * w, y: last.y * h } : { x: w / 2, y: h / 2 }, warm);
      }
    }
    // The next star, after its pace; nothing comes out while the page is set aside behind a
    // lightbox or the question is put away unanswered (a card pressed hides it), and it asks again
    // in a while; nothing at all once the sky has left the page.
    function next(delay) {
      if (stopped || stars.length >= full) return;
      timer = window.setTimeout(function () {
        timer = 0;
        if (stopped || !sky.isConnected) return;
        if (sky.closest('[data-lightbox-aside], [hidden]')) { next(500); return; }
        appear(0.04 + Math.random() * 0.92, 0.05 + Math.random() * 0.78, false);
        next(pace(stars.length));
      }, delay);
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
      if (timer) window.clearTimeout(timer);
      timer = 0;
      var n = stars.length;
      bucket(probe.buckets, n, answer);
      if (n >= full) add(answer, probe.filled, 1);
      if (!hurried) add(answer, probe.waited, 1);
      else add(answer, hurried * 2 > n ? probe.hurried : probe.kindled, 1);
      sky.style.cursor = 'default';
      // Sealed from the last star out, in treads; the lines between the stars cut warm. The two
      // controls grey once it has grown.
      var seal = beat('medium');
      series({ ms: seal, treads: 3, step: function (k, n2) { if (k) { sealed = k / n2; paint(); } } });
      var sealing = finish(seal);
      retire(enough, sealing);
      retire(hurry, sealing);
    });
    count();
    paint();
    next(500);
  }
  // A door, and however the visitor knocks on it. The count is most of the answer -- one knock, two,
  // three, a handful, a volley -- and for a longer knock its rhythm is the rest: even, swung,
  // quickening or slowing, and whether they knocked at once or stood a moment first. Each knock
  // leaves its tick on the strip above the door, spaced as it fell, so the knock is written where
  // it can be read back. No knock is wrong, and the door never answers on its own: saying the knock
  // is done is the visitor's press. A knock is a stamp and nothing more: the door is set back a hair
  // and the newest tick stands tall for one tread, then both are home -- no ring goes out from it.
  // 'that is my knock' seals the door from the knocker out, its panels cut warm: the reading's one
  // seal. The door is drawn only when a knock lands, when its tread ends, and on the seal's treads.
  function knockProbe(probe, body, trace, answer, finish) {
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
    var sealed = 0; // how far the seal has grown from the knocker, 0 to 1
    function pattern() {
      var out = '·';
      for (var i = 1; i < knocks.length; i++) {
        var gap = knocks[i].at - knocks[i - 1].at;
        out += (gap < 320 ? '' : gap < 900 ? ' ' : '   ') + '·';
      }
      return out;
    }
    function paint() {
      if (!g) return;
      var w = door.width;
      var h = door.height;
      var left = w * 0.31;
      var right = w * 0.69;
      var top = h * 0.16;
      var bottom = h * 0.94;
      var i;
      // The wall and the step: two shades split by the one line the door stands on.
      g.fillStyle = rgba(blend(night, dusk, 0.35), 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, bottom, w, h - bottom);
      // Under a fresh knock (one still on its tread) the door is set back a hair, once.
      var last = knocks[knocks.length - 1];
      var setBack = last && last.fresh ? 1.5 : 0;
      g.strokeStyle = rgba(cool, 0.35);
      g.lineWidth = 3;
      g.strokeRect(left - 5, top - 5, right - left + 10, bottom - top + 5);
      g.save();
      g.translate(0, setBack);
      g.fillStyle = rgba(blend(night, warm, 0.14), 1);
      g.fillRect(left, top, right - left, bottom - top);
      var inset = (right - left) * 0.14;
      g.strokeStyle = sealed ? rgba(warm, 0.8) : rgba(cool, 0.22);
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
      // The knock written down: one tick for each, spaced along the strip as they fell; the newest
      // is stamped -- taller for its tread, then its own height.
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
        for (i = 0; i < knocks.length; i++) {
          var x = w * 0.08 + (knocks[i].at - knocks[0].at) * scale;
          var fresh = i === knocks.length - 1 && knocks[i].fresh;
          g.lineWidth = fresh ? 3 : 2;
          g.beginPath();
          g.moveTo(x, fresh ? h * 0.03 : h * 0.05);
          g.lineTo(x, fresh ? h * 0.15 : h * 0.13);
          g.stroke();
        }
      }
      if (sealed) sealWash(g, w, h, sealed, { x: kx, y: ky }, warm);
    }
    function rap() {
      if (stopped) return;
      // The stamp: down for one tread, the length of a short beat, then home.
      var tread = beat('short');
      var knocked = { at: Date.now(), fresh: !!tread };
      knocks.push(knocked);
      if (tread) window.setTimeout(function () { knocked.fresh = false; paint(); }, tread);
      paint();
      done.disabled = false;
      note(trace, knocks.length === 1 ? 'one knock' : knocks.length + ' knocks');
      gauge(trace, pattern());
    }
    function sum(list) { return list.reduce(function (a, b) { return a + b; }, 0); }
    door.addEventListener('click', function () { rap(); });
    knock.addEventListener('click', function () { rap(); });
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
      door.style.cursor = 'default';
      // The door is sealed from the knocker out, in treads, and its panels cut warm; the two
      // controls grey once it has grown.
      var seal = beat('medium');
      series({ ms: seal, treads: 3, step: function (k, n2) { if (k) { sealed = k / n2; paint(); } } });
      var sealing = finish(seal);
      retire(knock, sealing);
      retire(done, sealing);
    });
    paint();
  }
  // A cairn is read when it is left standing, never while it rises: how many stones, and the
  // shape the stack took -- plumb, swaying, leaning, or daring. Each stone goes where the visitor
  // sets it: tap the ground either side of the stack, steer the next stone with the arrow keys and
  // place it with enter, or let the button set one square on. No cairn is wrong and nothing falls:
  // a stone set far out simply hangs there, which is its own kind of answer. A stone is set, not
  // drawn: it drops from above in a few treads, each shorter than the last, onto the place it was
  // given and nowhere else, and rests in two shades split by one edge through its middle, lit from
  // above; the guide for the next stone follows the arrow keys in stairs of two treads, never
  // begun again before a tread has landed (follow); 'leave it standing' seals the cairn from its
  // top stone out, the stones' highlights cut warm -- the reading's one seal.
  function cairnProbe(probe, body, trace, answer, finish) {
    var MAX = 14;
    var ground = el('canvas', 'probe-pad');
    ground.width = 600;
    ground.height = 320;
    ground.tabIndex = 0;
    ground.setAttribute('role', 'application');
    ground.setAttribute('aria-label', 'a flat place to stack stones: tap where the next stone goes, or steer it with the arrow keys and place it with enter');
    ground.style.cursor = 'pointer';
    ground.style.touchAction = 'manipulation';
    var g = ground.getContext('2d');
    ground.hidden = !g;
    body.appendChild(ground);
    var controls = el('div', 'controls');
    var set = el('button', 'probe-big', probe.label);
    set.type = 'button';
    var leave = el('button', 'btn-filled', probe.done);
    leave.type = 'button';
    leave.disabled = true;
    controls.appendChild(set);
    controls.appendChild(leave);
    body.appendChild(controls);
    body.appendChild(el('p', 'probe-count', 'as many stones as feel right: tap either side of the stack to set one off-centre, and say when it is done'));
    var style = window.getComputedStyle(body);
    var tone = function (name, fallback) { return rgbOf(style.getPropertyValue(name), fallback); };
    var night = tone('--bg', '#070a14');
    var dusk = tone('--bg2', '#1c2a4e');
    var cool = tone('--accent', '#9fcbff');
    var warm = tone('--accent2', '#ffe7ab');
    var stones = [];
    var cursor = 0;
    var shownCursor = 0;
    var done = false;
    var sealed = 0; // how far the seal has grown from the top stone, 0 to 1
    // The guide for the next stone follows the keys in stairs of two treads (follow).
    var guide = follow({
      at: function () { return shownCursor; },
      to: function () { return cursor; },
      gap: function (a, b) { return b - a; },
      put: function (v) { shownCursor = v; paint(); },
      ms: function () { return beat('short'); },
      treads: function () { return 2; },
      near: 0.001
    });
    function stoneW(i) { return Math.max(26, 86 - i * 4); }
    function topX() {
      var x = ground.width / 2;
      for (var i = 1; i < stones.length; i++) x += stones[i].off * stoneW(i - 1);
      return x;
    }
    function paint() {
      if (!g) return;
      var w = ground.width;
      var h = ground.height;
      // The air and the ground: two shades split by the one line the cairn stands on.
      g.fillStyle = rgba(blend(night, dusk, 0.35), 1);
      g.fillRect(0, 0, w, h);
      var floor = h * 0.88;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, floor, w, h - floor);
      g.lineCap = 'butt';
      g.strokeStyle = rgba(cool, 0.3);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, floor);
      g.lineTo(w, floor);
      g.stroke();
      var x = w / 2;
      var y = floor;
      g.lineCap = 'round';
      for (var i = 0; i < stones.length; i++) {
        var stone = stones[i];
        var sw = stoneW(i);
        var sh = Math.max(9, 19 - i);
        x += i ? stone.off * stoneW(i - 1) : 0;
        y -= sh + 1;
        var lift = stone.lift;
        var mid = y + sh / 2 - lift;
        var tone = blend(night, cool, 0.3 + (i % 3) * 0.07);
        g.strokeStyle = rgba(tone, 1);
        g.lineWidth = sh;
        g.beginPath();
        g.moveTo(x - sw / 2 + sh / 2, mid);
        g.lineTo(x + sw / 2 - sh / 2, mid);
        g.stroke();
        // The stone's face: two shades split by one edge through its middle, the upper lit.
        g.save();
        g.beginPath();
        g.rect(x - sw / 2, mid - sh / 2 - 1, sw, sh / 2 + 1);
        g.clip();
        g.strokeStyle = rgba(blend(tone, cool, 0.16), 1);
        g.beginPath();
        g.moveTo(x - sw / 2 + sh / 2, mid);
        g.lineTo(x + sw / 2 - sh / 2, mid);
        g.stroke();
        g.restore();
        g.strokeStyle = sealed ? rgba(warm, 0.6) : rgba(cool, 0.35);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x - sw / 2 + sh, y + 1 - lift);
        g.lineTo(x + sw / 2 - sh, y + 1 - lift);
        g.stroke();
      }
      // The guide: a hairline where the next stone would go.
      if (!done && stones.length < MAX) {
        var gw = stoneW(stones.length);
        var gx = x + (stones.length ? shownCursor * stoneW(stones.length - 1) : 0);
        g.strokeStyle = rgba(warm, 0.5);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(gx - gw / 2, y - 7);
        g.lineTo(gx + gw / 2, y - 7);
        g.stroke();
      }
      if (sealed) sealWash(g, w, h, sealed, { x: x, y: y }, warm);
    }
    function place(off) {
      if (done || stones.length >= MAX) return;
      var o = stones.length ? Math.max(-0.42, Math.min(0.42, off)) : 0;
      var stone = { off: o, lift: 0 };
      stones.push(stone);
      guide.halt();
      cursor = 0;
      shownCursor = 0;
      leave.disabled = false;
      note(trace, stones.length >= MAX ? 'that is all the stones there are'
        : plural(stones.length, 'stone') + (stones.length === 1 ? ', the base'
          : o > 0.08 ? ', set a little east' : o < -0.08 ? ', set a little west' : ', set square'));
      gauge(trace, stones.slice(1).map(function (s) {
        return s.off > 0.08 ? '↗' : s.off < -0.08 ? '↖' : '·';
      }).join(' '));
      // The drop: from above, onto its place, in treads that shrink as it lands.
      var from = 18 + Math.random() * 12;
      stone.lift = from;
      series({ ms: beat('medium'), treads: 2 + Math.floor(Math.random() * 3), step: function (k, n) {
        stone.lift = from * (1 - (1 - Math.pow(0.5, k)) / (1 - Math.pow(0.5, n)));
        paint();
      } });
    }
    ground.addEventListener('click', function (ev) {
      var box = ground.getBoundingClientRect();
      if (!box.width) return;
      var px = (ev.clientX - box.left) / box.width * ground.width;
      var base = stoneW(stones.length ? stones.length - 1 : 0);
      place((px - topX()) / base);
    });
    ground.addEventListener('keydown', function (ev) {
      if (done) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        cursor = Math.max(-0.42, Math.min(0.42, cursor + (ev.key === 'ArrowLeft' ? -0.14 : 0.14)));
        note(trace, cursor > 0.04 ? 'the next stone hangs east; enter sets it'
          : cursor < -0.04 ? 'the next stone hangs west; enter sets it' : 'the next stone sits square; enter sets it');
        guide.go();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        place(cursor);
      }
    });
    set.addEventListener('click', function () { place(0); });
    leave.addEventListener('click', function () {
      if (done || !stones.length) return;
      done = true;
      var n = stones.length;
      bucket(probe.buckets, n, answer);
      var offs = stones.slice(1).map(function (s) { return s.off; });
      if (offs.length >= 2) {
        var maxAbs = 0;
        var drift = 0;
        var turns = 0;
        for (var i = 0; i < offs.length; i++) {
          maxAbs = Math.max(maxAbs, Math.abs(offs[i]));
          drift += offs[i];
          if (i && offs[i] * offs[i - 1] < -0.003) turns += 1;
        }
        if (maxAbs < 0.08) add(answer, probe.plumb, 1);
        else if (maxAbs > 0.3 || Math.abs(drift) > 0.5) add(answer, probe.daring, 1);
        else if (turns * 2 >= offs.length) add(answer, probe.sway, 1);
        else add(answer, probe.leaning, 1);
      }
      ground.style.cursor = 'default';
      // The cairn is sealed from its top stone out, in treads; the stones' highlights cut warm.
      // The two controls grey once it has grown.
      var seal = beat('medium');
      series({ ms: seal, treads: 3, step: function (k, n2) { if (k) { sealed = k / n2; paint(); } } });
      var sealing = finish(seal);
      retire(set, sealing);
      retire(leave, sealing);
    });
    paint();
  }
  // A rubbing reads the final coverage, not the path or speed of the hand. Dragging and native
  // buttons uncover the same patches; no gesture history or drawing is kept with the reading.
  // The soot is one sheet over the print, two shades split by one slice through its centre, each
  // patch carrying its own part of it (--cell-at). A patch rubbed has its soot lifted behind a
  // slice from the side the hand came in by (--cut-angle, written from the rub's direction), so
  // the print shows as the edge crosses; 'start over' lays the sheet back by one slice at the
  // soot's own angle (--soot-angle), patch after patch in the order that slice reaches them --
  // those it reaches at once together -- all in one stair.
  function rubbingProbe(probe, body, trace, answer, finish) {
    var revealed = new Array(16).fill(false);
    var buttons = [];
    var pointer = null;
    var field = el('div', 'probe-rubbing');
    field.setAttribute('role', 'group');
    field.setAttribute('aria-label', 'Covered print. Arrow keys choose a patch; Enter or Space uncovers it.');
    var picture = el('canvas', 'probe-rubbing-picture');
    picture.width = 480;
    picture.height = 320;
    picture.setAttribute('aria-hidden', 'true');
    var g = picture.getContext('2d');
    picture.hidden = !g;
    field.appendChild(picture);

    function motifOf(index) {
      return Math.floor(index / 8) * 2 + Math.floor((index % 4) / 2);
    }
    function patchLabel(index) {
      return 'row ' + (Math.floor(index / 4) + 1) + ', column ' + (index % 4 + 1);
    }
    function count() {
      return revealed.filter(function (seen) { return seen; }).length;
    }
    function report(detail) {
      var n = count();
      reset.disabled = n === 0;
      note(trace, (g ? '' : 'The picture cannot be drawn here; uncovered patches name what they show. ')
        + (n ? n + ' of 16 patches uncovered.' : 'The print is still covered.')
        + (detail ? ' ' + detail : ''));
    }
    function uncover(index, heading) {
      if (index < 0 || index >= buttons.length) return;
      var motif = probe.motifs[motifOf(index)];
      if (!revealed[index]) {
        revealed[index] = true;
        buttons[index].removeAttribute('data-covering');
        buttons[index].style.setProperty('--d', '0ms');
        // The lift's treads, and its edge: square to the rub, from the side the hand came in by;
        // a press or a key leaves the angle the engine wrote for it (the pointer's approach, or the
        // register's).
        cutFor(buttons[index], 'lift', heading == null ? { family: 'leave', duration: 'medium' }
          : { family: 'leave', duration: 'medium', angle: heading });
        buttons[index].setAttribute('data-uncovered', 'true');
        buttons[index].setAttribute('aria-label', patchLabel(index) + ': ' + motif.label + ', uncovered');
        if (!g) buttons[index].textContent = motif.word;
        report('This patch shows part of ' + motif.label + '.');
      } else report('This patch already shows part of ' + motif.label + '.');
    }
    for (var i = 0; i < revealed.length; i++) {
      (function (index) {
        var button = el('button', 'probe-rub-cell');
        button.type = 'button';
        button.setAttribute('aria-label', 'uncover ' + patchLabel(index));
        button.style.setProperty('--cell-at', (index % 4 * 100 / 3).toFixed(3) + '% ' + (Math.floor(index / 4) * 100 / 3).toFixed(3) + '%');
        button.addEventListener('click', function () { uncover(index); });
        buttons.push(button);
        field.appendChild(button);
      })(i);
    }
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'Drag or tap to rub. With a keyboard, arrow keys choose a patch; Enter or Space rubs it.'));
    var controls = el('div', 'controls');
    var done = el('button', 'btn-filled', 'open a puzzle');
    done.type = 'button';
    var reset = el('button', 'btn-text', 'start over');
    reset.type = 'button';
    controls.appendChild(done);
    controls.appendChild(reset);
    body.appendChild(controls);

    function at(ev) {
      var box = field.getBoundingClientRect();
      if (!box.width || !box.height) return -1;
      var x = (ev.clientX - box.left) / box.width;
      var y = (ev.clientY - box.top) / box.height;
      if (!isFinite(x) || !isFinite(y) || x < 0 || x >= 1 || y < 0 || y >= 1) return -1;
      return Math.floor(y * 4) * 4 + Math.floor(x * 4);
    }
    var rubbed = null; // where the hand last was, for the direction it is going
    field.addEventListener('pointerdown', function (ev) {
      if (pointer !== null || ev.button !== 0) return;
      pointer = ev.pointerId;
      rubbed = { x: ev.clientX, y: ev.clientY };
      if (field.setPointerCapture) field.setPointerCapture(ev.pointerId);
      uncover(at(ev));
    });
    field.addEventListener('pointermove', function (ev) {
      if (pointer !== ev.pointerId) return;
      var heading = rubbed ? headingOf(ev.clientX - rubbed.x, ev.clientY - rubbed.y) : null;
      rubbed = { x: ev.clientX, y: ev.clientY };
      var index = at(ev);
      if (index >= 0 && !revealed[index]) uncover(index, heading);
    });
    function release(ev) {
      if (pointer === ev.pointerId) pointer = null;
    }
    field.addEventListener('pointerup', release);
    field.addEventListener('pointercancel', release);
    field.addEventListener('lostpointercapture', release);
    field.addEventListener('keydown', function (ev) {
      var index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
      var next;
      if (typeof moves[ev.key] === 'number') next = Math.max(0, Math.min(15, index + moves[ev.key]));
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = 15;
      else return;
      ev.preventDefault();
      buttons[next].focus();
    });
    reset.addEventListener('click', function () {
      var was = revealed.slice();
      revealed = new Array(16).fill(false);
      var covering = [];
      buttons.forEach(function (button, index) {
        if (was[index]) covering.push(button);
        button.removeAttribute('data-uncovered');
        button.setAttribute('aria-label', 'uncover ' + patchLabel(index));
        button.textContent = '';
      });
      // Each patch's place on the print (a 3:2 sheet in a four-by-four grid), along the soot's way.
      var soot = angleOf(window.getComputedStyle(field), '--soot-angle', 112);
      var turn = stepsBy(covering.map(function (button) {
        var i = buttons.indexOf(button);
        return reach({ x: (i % 4 + 0.5) * 1.5, y: Math.floor(i / 4) + 0.5 }, soot);
      }), 0.01);
      var laid = seedOf();
      covering.forEach(function (button, k) {
        button.style.setProperty('--d', staggerOf(turn[k]) + 'ms');
        cutFor(button, 'cover', { family: 'stair', duration: 'medium', seed: laid });
        button.setAttribute('data-covering', 'true');
      });
      report('You can rub a different part, or open a puzzle without uncovering any more.');
      buttons[0].focus();
    });
    done.addEventListener('click', function () {
      Object.keys(answer).forEach(function (id) { delete answer[id]; });
      var counts = probe.motifs.map(function () { return 0; });
      revealed.forEach(function (seen, index) {
        if (seen) counts[motifOf(index)] += 1;
      });
      var n = count();
      if (n) probe.motifs.forEach(function (motif, index) {
        add(answer, motif.weights, counts[index] / n);
      });
      add(answer, !n ? probe.untouched : n <= 4 ? probe.glimpse : n >= 12 ? probe.whole : probe.search, 1);
      // Sealed first; the two controls grey once the seal has grown.
      var sealing = finish();
      retire(done, sealing);
      retire(reset, sealing);
    });

    if (g) {
      var style = window.getComputedStyle(body);
      var ground = rgbOf(style.getPropertyValue('--bg'), '#070a14');
      var corner = rgbOf(style.getPropertyValue('--bg2'), '#1c2a4e');
      var cool = rgbOf(style.getPropertyValue('--accent'), '#9fcbff');
      var warm = rgbOf(style.getPropertyValue('--accent2'), '#ffe7ab');
      var ink = rgbOf(style.getPropertyValue('--fg'), '#e6eaf5');
      g.fillStyle = rgba(blend(ground, corner, 0.12), 1);
      g.fillRect(0, 0, picture.width, picture.height);
      probe.motifs.forEach(function (motif, index) {
        var x = index % 2 * 240 + 120;
        var y = Math.floor(index / 2) * 160 + 80;
        g.strokeStyle = rgba(cool, 0.24);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, 58, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = rgba(index % 2 ? warm : cool, 0.95);
        g.lineWidth = 2.5;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        if (index === 0) {
          g.arc(x - 22, y - 8, 18, 0, Math.PI * 2);
          g.moveTo(x - 4, y - 8);
          g.lineTo(x + 42, y - 8);
          g.moveTo(x + 22, y - 8);
          g.lineTo(x + 22, y + 10);
          g.moveTo(x + 37, y - 8);
          g.lineTo(x + 37, y + 4);
        } else if (index === 1) {
          for (var s = 0; s <= 72; s++) {
            var a = s / 72 * Math.PI * 6;
            var r = s / 72 * 38;
            var sx = x + Math.cos(a) * r;
            var sy = y - 5 + Math.sin(a) * r;
            if (s) g.lineTo(sx, sy);
            else g.moveTo(sx, sy);
          }
        } else if (index === 2) {
          g.moveTo(x, y + 34);
          g.lineTo(x, y - 40);
          for (var leaf = 0; leaf < 3; leaf++) {
            for (var side = -1; side <= 1; side += 2) {
              g.moveTo(x, y + 18 - leaf * 20);
              g.lineTo(x + side * (24 + leaf * 4), y - leaf * 20);
            }
          }
        } else {
          g.arc(x, y - 5, 35, 0, Math.PI * 2);
          for (var spoke = 0; spoke < 8; spoke++) {
            var angle = spoke / 8 * Math.PI * 2;
            g.moveTo(x, y - 5);
            g.lineTo(x + Math.cos(angle) * 35, y - 5 + Math.sin(angle) * 35);
          }
        }
        g.stroke();
        g.fillStyle = rgba(ink, 0.95);
        g.font = '500 15px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(motif.word, x, y + 68);
      });
    }
    report();
  }
  // A compass with no letters on it. The needle starts on a rolled bearing and the visitor turns
  // it to the way they would walk -- round the dial with a finger or a mouse, or by the arrow keys
  // -- then sets out. The bearing is most of the answer, blended between the two nearest of eight
  // unlettered points, and how far the needle travelled to get there is the rest: left as it lay,
  // nudged, swung round, or spun past a full turn. No bearing is wrong, and the compass never
  // answers on its own: setting out is the visitor's press. The needle follows the hand in stairs
  // of two to four even clicks, each read afresh toward where the hand is now, so it turns while
  // the hand turns, always forward and never a glide (follow); the face rests in two shades split
  // by one slice through the hub at the register's angle; the meter tallies each eighth of a turn;
  // and 'set out' seals the compass from the needle's tip -- the way the visitor chose -- out, in
  // treads, with the needle cut warm: the reading's one seal.
  function compassProbe(probe, body, trace, answer, finish) {
    var dial = el('canvas', 'probe-pad probe-compass');
    dial.width = 600;
    dial.height = 320;
    dial.tabIndex = 0;
    dial.setAttribute('role', 'application');
    dial.setAttribute('aria-label', 'an unmarked compass: drag round the dial to turn the needle, or turn it with the arrow keys, then press enter to set out');
    dial.style.cursor = 'grab';
    var g = dial.getContext('2d');
    dial.hidden = !g;
    body.appendChild(dial);
    var controls = el('div', 'controls');
    var go = el('button', 'btn-filled', probe.label);
    go.type = 'button';
    controls.appendChild(go);
    body.appendChild(controls);
    body.appendChild(el('p', 'probe-count', 'the needle starts somewhere random: turn it as far as you like, or not at all, and set out'));
    var style = window.getComputedStyle(body);
    var tone = function (name, fallback) { return rgbOf(style.getPropertyValue(name), fallback); };
    var night = tone('--bg', '#070a14');
    var dusk = tone('--bg2', '#1c2a4e');
    var cool = tone('--accent', '#9fcbff');
    var warm = tone('--accent2', '#ffe7ab');
    var start = Math.random() * 360;
    var bearing = start;
    var shown = start;
    var travelled = 0;
    var dragging = false;
    var set = false;
    var sealed = 0;
    var lastHour = null;
    var lastMarks = 0;
    var split = { kind: 'slice', angle: angleOf(style) };
    function wrap(a) { return ((a % 360) + 360) % 360; }
    // The needle after the hand: the shorter way round from where it points to the bearing.
    var needle = follow({
      at: function () { return shown; },
      to: function () { return bearing; },
      gap: function (a, b) { var d = wrap(b - a); return d > 180 ? d - 360 : d; },
      put: function (v) { shown = v; paint(); },
      ms: function () { return beat('short'); },
      treads: function () { return 2 + Math.floor(Math.random() * 3); },
      near: 0.5
    });
    function hourOf(b) { var hr = Math.round(wrap(b) / 30) % 12; return hr === 0 ? 12 : hr; }
    function point(a, r, cx, cy) { var rad = a * Math.PI / 180; return [cx + Math.sin(rad) * r, cy - Math.cos(rad) * r]; }
    function paint() {
      if (!g) return;
      var w = dial.width;
      var h = dial.height;
      var cx = w / 2;
      var cy = h * 0.52;
      var R = h * 0.4;
      var i;
      g.fillStyle = rgba(blend(night, dusk, 0.35), 1);
      g.fillRect(0, 0, w, h);
      // The face: a disc of the dusk in two shades, split by one slice through the hub.
      g.fillStyle = rgba(blend(night, dusk, 0.75), 1);
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.clip();
      paintCut(g, cx - R, cy - R, R * 2, R * 2, 0.5, split, rgba(dusk, 0.35));
      g.restore();
      g.lineCap = 'butt';
      g.lineWidth = 1.5;
      g.strokeStyle = rgba(cool, 0.45);
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = rgba(cool, 0.2);
      g.beginPath();
      g.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
      g.stroke();
      // Thirty-two ticks, the eight points longer and warm, and no letter on any of them.
      for (i = 0; i < 32; i++) {
        var major = i % 4 === 0;
        var t0 = point(i * 11.25, R * (major ? 0.84 : 0.92), cx, cy);
        var t1 = point(i * 11.25, R * 0.97, cx, cy);
        g.strokeStyle = rgba(major ? warm : cool, major ? 0.8 : 0.4);
        g.lineWidth = major ? 2 : 1;
        g.beginPath();
        g.moveTo(t0[0], t0[1]);
        g.lineTo(t1[0], t1[1]);
        g.stroke();
      }
      // The rose: an eight-pointed star of hairlines under the needle.
      g.strokeStyle = rgba(cool, 0.18);
      g.lineWidth = 1;
      g.beginPath();
      for (i = 0; i < 8; i++) {
        var s0 = point(i * 45, R * 0.66, cx, cy);
        var s1 = point((i + 3) * 45, R * 0.66, cx, cy);
        g.moveTo(s0[0], s0[1]);
        g.lineTo(s1[0], s1[1]);
      }
      g.stroke();
      // Where the needle lay at first: a faint hairline, so what was turned can be read back.
      var w0 = point(start, R * 0.5, cx, cy);
      var w1 = point(start, R * 0.78, cx, cy);
      g.strokeStyle = rgba(warm, 0.3);
      g.beginPath();
      g.moveTo(w0[0], w0[1]);
      g.lineTo(w1[0], w1[1]);
      g.stroke();
      // The needle: warm toward the way, cool behind, on a hub.
      var rad = shown * Math.PI / 180;
      var px = Math.cos(rad) * 7;
      var py = Math.sin(rad) * 7;
      var tip = point(shown, R * 0.78, cx, cy);
      var tail = point(shown + 180, R * 0.5, cx, cy);
      g.fillStyle = rgba(warm, sealed ? 1 : 0.92);
      g.beginPath();
      g.moveTo(tip[0], tip[1]);
      g.lineTo(cx + px, cy + py);
      g.lineTo(cx - px, cy - py);
      g.closePath();
      g.fill();
      g.fillStyle = rgba(cool, 0.7);
      g.beginPath();
      g.moveTo(tail[0], tail[1]);
      g.lineTo(cx + px, cy + py);
      g.lineTo(cx - px, cy - py);
      g.closePath();
      g.fill();
      g.fillStyle = rgba(night, 1);
      g.strokeStyle = rgba(warm, 0.9);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (sealed) sealWash(g, w, h, sealed, { x: tip[0], y: tip[1] }, warm);
    }
    function turn(to) {
      if (set) return;
      to = wrap(to);
      var delta = ((to - bearing + 540) % 360) - 180;
      if (Math.abs(delta) < 1.5) return;
      travelled += Math.abs(delta);
      bearing = to;
      var hour = hourOf(bearing);
      if (hour !== lastHour) {
        lastHour = hour;
        note(trace, 'the needle stands at ' + hour + " o'clock");
      }
      var marks = Math.min(40, Math.floor(travelled / 45));
      if (marks !== lastMarks) {
        lastMarks = marks;
        gauge(trace, marks ? tally(marks) : '');
      }
      needle.go();
    }
    function bearingAt(ev) {
      var box = dial.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      var x = (ev.clientX - box.left) / box.width * dial.width - dial.width / 2;
      var y = (ev.clientY - box.top) / box.height * dial.height - dial.height * 0.52;
      return Math.atan2(x, -y) * 180 / Math.PI;
    }
    function release() {
      if (!dragging) return;
      dragging = false;
      if (!set) dial.style.cursor = 'grab';
    }
    dial.addEventListener('pointerdown', function (ev) {
      if (set) return;
      dragging = true;
      try { dial.setPointerCapture(ev.pointerId); } catch (e) { /* the moves still read */ }
      dial.style.cursor = 'grabbing';
      var b = bearingAt(ev);
      if (b !== null) turn(b);
    });
    dial.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var b = bearingAt(ev);
      if (b !== null) turn(b);
    });
    dial.addEventListener('pointerup', release);
    dial.addEventListener('pointercancel', release);
    dial.addEventListener('keydown', function (ev) {
      if (set) return;
      var steps = { ArrowLeft: -15, ArrowRight: 15, ArrowUp: -15, ArrowDown: 15 };
      if (steps[ev.key] !== undefined) {
        ev.preventDefault();
        turn(bearing + steps[ev.key]);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setOut();
      }
    });
    function setOut() {
      if (set) return;
      set = true;
      dragging = false;
      var b = wrap(bearing);
      var i = Math.floor(b / 45) % 8;
      var j = (i + 1) % 8;
      var frac = (b - i * 45) / 45;
      add(answer, probe.points[i].weights, 1 - frac);
      add(answer, probe.points[j].weights, frac);
      add(answer, travelled < 1 ? probe.untouched : travelled < 60 ? probe.nudged : travelled < 300 ? probe.swung : probe.spun, 1);
      dial.style.cursor = 'default';
      dial.setAttribute('aria-disabled', 'true');
      dial.tabIndex = -1;
      // Sealed from the needle's tip out, in treads; the needle cuts warm. The button greys once
      // the seal has grown.
      var seal = beat('medium');
      series({ ms: seal, treads: 3, step: function (k, n2) { if (k) { sealed = k / n2; paint(); } } });
      retire(go, finish(seal));
    }
    go.addEventListener('click', setOut);
    paint();
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
