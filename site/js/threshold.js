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
    }
  ];

  var ORIENTATION_BY_ID = {};
  for (var oi = 0; oi < ORIENTATIONS.length; oi++) ORIENTATION_BY_ID[ORIENTATIONS[oi].id] = ORIENTATIONS[oi];
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(calm && calm.matches); }

  /* ---- the rites of the threshold ---------------------------------------------------------
     Nothing here fades, glides or cuts while a visitor watches (README: "Motion axiom"). The
     engine (js/motion.js, window.interestingMotion) is optional everywhere: every use is guarded,
     and without it the stylesheet's baked ladder plays and the flow keeps a glitch of a curve of
     its own. What the engine gives when it is there: a beat rolled for the page, a stagger, the
     glyph reveal for words, a composed arrival or leave of an element's own, a stepper in treads
     for the canvases, and the texture a sealed surface wears. */
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
  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  }
  function staggerOf(k) {
    var m = engine();
    if (m && typeof m.stagger === 'function') { try { return m.stagger(k); } catch (e) { /* the bake */ } }
    return Math.max(0, Math.round(k * BEATS.stagger + between(-14, 14)));
  }

  /* A curve for one movement of a mechanism -- a star coming out, a knock ringing -- rolled by
     the motion engine (js/motion.js) for that movement alone, so no two stars come out the same
     way and no knock rings like the last (README: "Motion axiom"). Where there is no engine the
     flow keeps a glitch of a curve of its own, a polyline and never a formula, because nothing
     on this site fades or grows along one -- and even that polyline is jittered per call, with a
     hold put in at a rolled place, so two stars never share it either. */
  var OWN_CURVE = [[0, 0], [0.12, 0.03], [0.4, 0.66], [0.48, 0.6], [0.66, 1.04], [0.84, 0.98], [1, 1]];
  function along(stops) {
    return function (t) {
      if (t <= 0) return stops[0][1];
      if (t >= 1) return stops[stops.length - 1][1];
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          var t0 = stops[i - 1][0];
          var y0 = stops[i - 1][1];
          return stops[i][0] > t0 ? y0 + (stops[i][1] - y0) * ((t - t0) / (stops[i][0] - t0)) : stops[i][1];
        }
      }
      return 1;
    };
  }
  function ownRoll() {
    var stops = OWN_CURVE.map(function (s, i) {
      if (i === 0 || i === OWN_CURVE.length - 1) return [s[0], s[1]];
      return [unit(s[0] + between(-0.04, 0.04)), s[1] + between(-0.06, 0.06)];
    });
    // A hold: the same y repeated a little later, at a rolled place.
    var at = 1 + Math.floor(Math.random() * (stops.length - 3));
    stops.splice(at + 1, 0, [Math.min(stops[at + 1][0] - 0.01, stops[at][0] + between(0.03, 0.1)), stops[at][1]]);
    stops.sort(function (a, b) { return a[0] - b[0]; });
    return stops;
  }
  function rite(family) {
    var motion = window.interestingMotion;
    if (motion && typeof motion.ease === 'function') {
      try { return motion.ease(family); } catch (e) { /* the flow's own curve stands */ }
    }
    var curve = along(ownRoll());
    if (family === 'stair' || family === 'ratchet') return treadsOf(curve, 3 + Math.floor(Math.random() * 4));
    return curve;
  }
  // A step series over a curve: the tread index 0..n, never a fraction between.
  function treadsOf(curve, n) {
    var steps = Math.max(2, Math.round(n || 4));
    return function (t) { return Math.round(unit(curve(t)) * steps) / steps; };
  }

  /* A movement in treads for a script: `step(k, n, slipping)` at uneven moments over `ms`, with
     a slip or two back by a tread, then `done()`. The engine's stepper when it is there; the
     flow's own uneven widths when it is not; the last tread at once when stilled. Hands back a
     function that stops it. */
  function series(opts) {
    var m = engine();
    var n = Math.max(2, Math.round(opts.treads || (3 + Math.random() * 4)));
    var total = Math.max(0, Number(opts.ms) || 0);
    var step = typeof opts.step === 'function' ? opts.step : function () {};
    var done = typeof opts.done === 'function' ? opts.done : function () {};
    if (m && typeof m.stepper === 'function') {
      try { return m.stepper({ ms: total, treads: n, step: step, done: done }); } catch (e) { /* the flow's own */ }
    }
    if (!total || stilled() || typeof window.requestAnimationFrame !== 'function') {
      step(n, n, false);
      done();
      return function () {};
    }
    var widths = [];
    var acc = 0;
    for (var i = 0; i < n; i++) { var w = between(0.4, 1.4); widths.push(w); acc += w; }
    var moments = [];
    var at = 0;
    for (var j = 0; j < n; j++) {
      at += widths[j] / acc;
      moments.push({ at: at, k: j + 1 });
      if (j > 0 && j < n - 1 && Math.random() < 0.25) {
        moments.push({ at: at + widths[j] / acc * 0.3, k: j, slip: true });
        moments.push({ at: at + widths[j] / acc * 0.55, k: j + 1 });
      }
    }
    moments.sort(function (a, b) { return a.at - b.at; });
    var started = performance.now();
    var stopped = false;
    var next = 0;
    var last = -1;
    function frame(tm) {
      if (stopped) return;
      var p = unit((tm - started) / total);
      while (next < moments.length && moments[next].at <= p) {
        if (moments[next].k !== last) { last = moments[next].k; step(last, n, !!moments[next].slip); }
        next += 1;
      }
      if (p < 1) window.requestAnimationFrame(frame);
      else { if (last !== n) step(n, n, false); done(); }
    }
    step(0, n, false);
    window.requestAnimationFrame(frame);
    return function () { stopped = true; };
  }

  // Words arriving: written at once (textContent is never anything but the words), then revealed
  // glyph by glyph through sigils when the engine is there and the visitor has not asked for less.
  function say(node, text, pace) {
    if (!node) return;
    node.textContent = text;
    var m = engine();
    if (!text || stilled() || !m || typeof m.reveal !== 'function') return;
    try { m.reveal(node, { pace: pace || 0.42 }); } catch (e) { /* the words are there */ }
  }
  // The trace line is the scribe: the live region gets its plain write (assistive tech hears each
  // line once) and the glass twin under it shows the same words arriving through sigils.
  function note(trace, text) {
    if (!trace) return;
    trace.textContent = text;
    if (trace.glass) say(trace.glass, text, 0.3);
  }
  // The meter (aria-hidden) takes its marks and stamps them: data-tick alternates so the
  // stylesheet's one-tread mark-stamp restarts on every write.
  function tick(node) {
    if (!node || typeof node.setAttribute !== 'function') return;
    node.setAttribute('data-tick', node.getAttribute('data-tick') === 'a' ? 'b' : 'a');
  }
  function gauge(trace, text) {
    if (!trace || !trace.meter) return;
    trace.meter.textContent = text;
    if (text) tick(trace.meter);
  }
  // A tally that ratchets: one mark at a time, grouped in fives with a slash.
  function tally(n) {
    var out = '';
    for (var i = 1; i <= n; i++) out += (i % 5 === 0) ? '/' : '|';
    return out.replace(/(\|{4}\/)/g, '$1 ');
  }
  // Things dealt out: each gets a delay of its own in a rolled order (--d, --k) and, with the
  // engine, a geometry, a ladder and a composition of its own; data-dealt is what the stylesheet
  // plays probe-in on, and it stays, so nothing replays when a passing class comes off.
  function dealOut(nodes, spell) {
    var order = shuffled(nodes);
    var m = engine();
    order.forEach(function (node, k) {
      if (!node || !node.style) return;
      node.style.setProperty('--d', staggerOf(k) + 'ms');
      node.style.setProperty('--k', String(k));
      if (m && typeof m.arrive === 'function' && !stilled()) {
        try { m.arrive(node, { spell: spell || 'probe-in', className: false, mattes: k % 2 === 1 }); } catch (e) { /* the page's roll */ }
      }
      node.setAttribute('data-dealt', 'true');
    });
  }
  // A thing leaving: down the ladder to the rolled leave corner (is-leaving, probe-out or the
  // composition the engine wrote), then `fn` at the animation's end or the clock's.
  function unmake(node, fn) {
    var wait = beat('medium');
    if (!node || !wait || !node.classList) { if (fn) fn(); return; }
    var m = engine();
    if (m && typeof m.composeOn === 'function' && !(node.style && node.style.getPropertyValue('--rite-unmake'))) {
      try { m.composeOn(node, 'unmake', 'probe-out', wait); } catch (e) { /* the stylesheet's own */ }
    }
    node.classList.add('is-leaving');
    node.setAttribute('aria-hidden', 'true');
    if (node.style) node.style.pointerEvents = 'none';
    if (node.tagName === 'BUTTON') node.tabIndex = -1;
    var once = false;
    function go() { if (once) return; once = true; if (fn) fn(); }
    node.addEventListener('animationend', function (ev) { if (ev.target === node) go(); });
    window.setTimeout(go, wait * 2 + 240);
  }
  // A control spent: its texture leaves down the ladder and its ground cuts to the disabled grey
  // (data-spent, rite-spent), and only then is it disabled -- a disabled control plays nothing.
  function retire(button) {
    if (!button || button.disabled) return;
    button.setAttribute('aria-disabled', 'true');
    var wait = beat('medium');
    if (!wait) { button.disabled = true; return; }
    button.setAttribute('data-spent', 'true');
    var once = false;
    function go() { if (once) return; once = true; button.disabled = true; }
    button.addEventListener('animationend', function (ev) { if (ev.target === button && /spent/.test(ev.animationName)) go(); });
    window.setTimeout(go, wait * 2 + 240);
  }
  // The texture a sealed surface wears, rolled for it alone when the engine is there.
  function dress(node) {
    var m = engine();
    if (m && typeof m.seal === 'function') { try { m.seal(node); } catch (e) { /* the page's fill */ } }
  }

  /* ---- a matte for a canvas ---------------------------------------------------------------
     A selection on a canvas changes by its AREA in a pattern, never by alpha: a field over cells,
     thresholded by coverage, in one of six kinds (noise, shards, scan lines, dither, iris, grain)
     -- the harness's own matte, kept here because the threshold's canvases are not modules and
     load no engine. `at(x, y, k)` says whether the cell at column x, row y is let through at
     coverage k; `paint` fills a rectangle's cells through it; `disc` a circle's. Seeded, so a
     star keeps its grain from frame to frame. */
  function prng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var MATTE_KINDS = ['noise', 'noise', 'shards', 'scan', 'dither', 'iris', 'grain'];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function matteField(seed, kindWanted) {
    var r = prng(seed == null ? Math.floor(Math.random() * 0x7fffffff) : seed);
    var kind = kindWanted || MATTE_KINDS[Math.floor(r() * MATTE_KINDS.length)];
    var salt = Math.floor(r() * 0x7fffffff);
    var block = 1 + Math.floor(r() * 3);
    var angle = r() * Math.PI;
    var period = 3 + Math.floor(r() * 6);
    var cx = 0.2 + r() * 0.6;
    var cy = 0.2 + r() * 0.6;
    var span = Math.round(10 + r() * 26);
    var cell = kind === 'grain' ? 2 : kind === 'dither' ? 3 : 2 + Math.floor(r() * 4);
    function field(x, y) {
      var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + salt) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function at(x, y, k) {
      var c = unit(k);
      if (c <= 0) return false;
      if (c >= 1) return true;
      var v;
      if (kind === 'noise') v = field(Math.floor(x / block), Math.floor(y / block)) * 0.7 + field(x, y) * 0.3;
      else if (kind === 'grain') v = field(x, y);
      else if (kind === 'shards') {
        var s = (x * Math.cos(angle) + y * Math.sin(angle)) / period;
        v = field(Math.floor(s), Math.floor((y * Math.cos(angle) - x * Math.sin(angle)) / (period * 3)));
      } else if (kind === 'scan') v = ((y % period) / period) * 0.8 + field(0, Math.floor(y / period)) * 0.2;
      else if (kind === 'dither') v = (BAYER[((y & 3) << 2) | (x & 3)] + field(x >> 2, y >> 2) * 0.9) / 16;
      else {
        var dx = (((x % span) + span) % span) / span - cx;
        var dy = (((y % span) + span) % span) / span - cy;
        v = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.72) * 0.85 + field(x, y) * 0.15;
      }
      return v < c;
    }
    function paint(g, x, y, w, h, k, style) {
      if (!g || k <= 0) return;
      g.fillStyle = style;
      var x0 = Math.floor(x / cell);
      var y0 = Math.floor(y / cell);
      var x1 = Math.ceil((x + w) / cell);
      var y1 = Math.ceil((y + h) / cell);
      if (k >= 1) { g.fillRect(x, y, w, h); return; }
      for (var cy2 = y0; cy2 < y1; cy2++) {
        for (var cx2 = x0; cx2 < x1; cx2++) {
          if (at(cx2, cy2, k)) g.fillRect(cx2 * cell, cy2 * cell, cell, cell);
        }
      }
    }
    function disc(g, x, y, radius, k, style) {
      if (!g || k <= 0 || radius <= 0) return;
      g.fillStyle = style;
      var c = Math.max(1, Math.min(cell, Math.ceil(radius / 2)));
      var x0 = Math.floor((x - radius) / c);
      var y0 = Math.floor((y - radius) / c);
      var x1 = Math.ceil((x + radius) / c);
      var y1 = Math.ceil((y + radius) / c);
      var r2 = radius * radius;
      for (var cy2 = y0; cy2 <= y1; cy2++) {
        for (var cx2 = x0; cx2 <= x1; cx2++) {
          var px = cx2 * c + c / 2 - x;
          var py = cy2 * c + c / 2 - y;
          if (px * px + py * py > r2) continue;
          if (k >= 1 || at(cx2, cy2, k)) g.fillRect(cx2 * c, cy2 * c, c, c);
        }
      }
    }
    // A mask canvas at coverage k, for clipping a drawing through the matte (destination-in).
    var masks = {};
    function mask(w, h, k) {
      var key = Math.round(unit(k) * 20);
      if (masks[key]) return masks[key];
      var off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      var og = off.getContext('2d');
      if (og) paint(og, 0, 0, w, h, key / 20, '#000');
      masks[key] = off;
      return off;
    }
    function clip(g, w, h, k) {
      if (!g || k >= 1) return;
      g.save();
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask(w, h, k), 0, 0);
      g.restore();
    }
    // A flicker series: on from a rolled moment with a few dropouts, cycling at a rolled period.
    function flicker() {
      var onAt = 0.05 + r() * 0.25;
      var drops = [];
      var n = Math.floor(r() * 4);
      for (var i = 0; i < n; i++) { var a = onAt + r() * (0.85 - onAt); drops.push([a, a + 0.01 + r() * 0.05]); }
      var period = 1400 + r() * 2600;
      var phase = r();
      return function (now) {
        var q = ((now / period + phase) % 1 + 1) % 1;
        if (q < onAt) return 0;
        for (var i = 0; i < drops.length; i++) if (q >= drops[i][0] && q < drops[i][1]) return 0;
        return 1;
      };
    }
    return { kind: kind, cell: cell, at: at, paint: paint, disc: disc, clip: clip, flicker: flicker, roll: r };
  }
  // A dash pattern of a movement's own: two to four rolled segments.
  function dashesOf(r) {
    var n = 2 + Math.floor(r() * 3);
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.round(2 + r() * 9));
    return out;
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
  function mount(host, options) {
    if (!host) return null;
    var opts = options || {};
    var selector = host.id === 'persona-probe' ? document.getElementById('threshold-way') : null;
    var requested = opts.probe || (selector && selector.value);
    var probe = requested ? probeById(requested) : nextProbe();
    if (!probe) return null;
    if (selector) selector.value = '';
    noteProbe(probe.probe);
    // A question already up is set aside, not deleted: its frame stays as a ghost that descends
    // the ladder to the rolled leave corner while the new one develops under it.
    var old = host.firstElementChild;
    var ghost = old && old.classList && old.classList.contains('probe') && !old.classList.contains('probe-ghost') && beat('medium') ? old : null;
    host.textContent = '';
    if (ghost) {
      ghost.classList.add('probe-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      try { if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) { /* it reads as it lies */ }
      host.appendChild(ghost);
      unmake(ghost, function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); });
    }
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
    skip.addEventListener('click', function () {
      if (answered) return;
      answered = true;
      // The question descends the ladder before it goes; only then is the host cleared.
      unmake(frame, function () {
        if (frame.parentNode === host) host.removeChild(frame);
        if (!host.firstElementChild) host.textContent = '';
        if (typeof opts.onSkip === 'function') opts.onSkip(probe);
      });
    });
    frame.appendChild(skip);
    host.appendChild(frame);
    // The frame develops from a geometry, a ladder and a composition of its own; the ask's words
    // arrive through sigils; and the mechanism's own tint is the host's data-probe (the stylesheet).
    var m = engine();
    if (m && typeof m.arrive === 'function' && !stilled()) {
      try { m.arrive(frame, { spell: 'probe-in', className: false, mattes: true }); } catch (e) { /* the page's roll */ }
    }
    say(ask, probe.ask, 0.3);
    function finish() {
      if (answered) return;
      answered = true;
      unmake(skip, function () { skip.hidden = true; });
      var reading = record(answer);
      trace.textContent = '';
      glass.textContent = '';
      // The reading lands as a seal: the frame takes the fill texture in the new primary, climbing
      // the ladder (probe-read), before the question is handed on.
      dress(frame);
      var wait = beat('long');
      if (m && typeof m.composeOn === 'function' && wait) { try { m.composeOn(frame, 'seal', 'probe-read', wait); } catch (e) { /* the stylesheet's */ } }
      host.setAttribute('data-probe-state', 'read');
      function hand() { if (typeof opts.onAnswer === 'function') opts.onAnswer(reading, probe); }
      if (wait) window.setTimeout(hand, wait); else hand();
    }
    var kinds = {
      choice: choiceProbe, sequence: sequenceProbe, tap: tapProbe, hold: holdProbe,
      place: placeProbe, draw: drawProbe, windows: windowsProbe, balance: balanceProbe,
      slider: sliderProbe, sky: skyProbe, keys: keysProbe, knock: knockProbe,
      rubbing: rubbingProbe, cairn: cairnProbe
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
  function choiceProbe(probe, body, trace, answer, finish) {
    var steps = probe.steps || [{ ask: null, options: probe.options }];
    var index = 0;
    function step() {
      body.textContent = '';
      var stage = steps[index];
      var taken = false;
      if (stage.ask && steps.length > 1 && !probe.quick) {
        var line = el('p', 'probe-step');
        body.appendChild(line);
        say(line, stage.ask);
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
          // The chosen thing is sealed (data-set: the engine's texture climbs onto it, the label
          // twitches) and the rest go down the ladder; only then does the next landing come.
          dress(button);
          button.setAttribute('data-set', 'true');
          buttons.forEach(function (other) { if (other !== button) unmake(other); });
          var wait = beat(probe.quick ? 'short' : 'long');
          function go() {
            if (index < steps.length) {
              note(trace, 'noted: ' + option.label);
              step();
            } else {
              body.textContent = '';
              finish();
            }
          }
          if (wait) window.setTimeout(go, wait); else go();
        });
        buttons.push(button);
        group.appendChild(button);
      });
      body.appendChild(group);
      dealOut(buttons);
      if (steps.length > 1) {
        var counter = el('p', 'probe-count probe-counter', (probe.quick ? 'pair ' : '') + (index + 1) + ' of ' + steps.length);
        body.appendChild(counter);
        tick(counter);
      }
      var first = group.querySelector('button');
      if (first && index > 0) first.focus();
    }
    step();
  }
  // An object is carried, not teleported: the pressed one seals, then leaves down the ladder
  // while the rest close ranks (FLIP), and its name travels into the chosen order where it is
  // revealed with its arrow stamped a tread later. Undo runs the same in reverse. The reading is
  // the `picked` array, never the DOM.
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
    order.appendChild(el('span', 'probe-order-lead', 'chosen order: '));
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
      while (names.firstChild) takeName();
      gone.forEach(function (item) { bringBack(items.indexOf(item)); });
      refresh();
    });
    controls.appendChild(reset);
    body.appendChild(controls);
    function shuffle(change) {
      var m = engine();
      if (m && typeof m.flip === 'function' && !stilled()) {
        try { m.flip(group, change, { family: 'drift', dealt: false }); return; } catch (e) { /* plain */ }
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
    function putName(item) {
      if (names.childNodes.length) {
        var arrow = el('span', 'probe-order-arrow', ' → ');
        arrow.setAttribute('aria-hidden', 'true');
        names.appendChild(arrow);
        tick(arrow);
      }
      var name = el('span', 'probe-order-name');
      names.appendChild(name);
      order.hidden = false;
      say(name, item.label);
    }
    function takeName() {
      var name = names.lastChild;
      if (!name) return;
      var arrow = name.previousSibling;
      names.removeChild(name);
      if (arrow && arrow.classList && arrow.classList.contains('probe-order-arrow')) names.removeChild(arrow);
      if (!names.firstChild) order.hidden = true;
    }
    function pick(item, index) {
      busy = true;
      picked.push(item);
      var button = buttons[index];
      dress(button);
      button.setAttribute('data-set', 'true');
      note(trace, 'placed: ' + item.label);
      var wait = beat('short');
      function go() {
        unmake(button, function () {
          shuffle(function () { if (button.parentNode === group) group.removeChild(button); });
        });
        putName(item);
        refresh();
        busy = false;
        if (picked.length >= target) scoreAndFinish();
      }
      if (wait) window.setTimeout(go, wait); else go();
    }
    function bringBack(index) {
      var button = buttons[index];
      if (!button) return;
      button.removeAttribute('data-set');
      button.classList.remove('is-leaving');
      button.removeAttribute('aria-hidden');
      button.style.pointerEvents = '';
      button.tabIndex = 0;
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
      // Each tap leaves its mark: the fill climbs one rung of the ladder per strike (data-rung),
      // and the stamp's size is the gap since the last -- short and sharp, or wide.
      if (taps.length === 1) dress(button);
      button.setAttribute('data-rung', String(Math.min(5, taps.length)));
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
      gauge(trace, '');
      retire(button);
      finish();
    });
    body.appendChild(button);
  }
  function holdProbe(probe, body, trace, answer, finish) {
    var started = 0;
    var ticker = null;
    var rung = 0;
    var marks = 0;
    var button = el('button', 'probe-big');
    button.type = 'button';
    button.textContent = probe.label;
    // The hold is a filling vessel: the fill texture advances a rung every rolled while, and past
    // the top the texture itself is re-rolled and the climb begins again, so a long hold keeps
    // turning over and never saturates into a solid. The tally beneath ratchets with it. None of
    // it implies a target: the length of the press is the whole answer.
    function advance() {
      ticker = window.setTimeout(function () {
        if (!started) return;
        rung += 1;
        if (rung > 5) { rung = 1; dress(button); }
        button.setAttribute('data-rung', String(rung));
        marks += 1;
        gauge(trace, tally(marks));
        advance();
      }, between(160, 420));
    }
    function down() {
      if (started || button.disabled) return;
      started = Date.now();
      rung = 0;
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
      gauge(trace, '');
      button.classList.remove('held');
      retire(button);
      bucket(probe.buckets, held, answer);
      finish();
    }
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', function () {
      if (!started) return;
      started = 0;
      window.clearTimeout(ticker);
      // A let-go: the fill drops in one cut.
      button.classList.remove('held');
      button.removeAttribute('data-rung');
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
      // The mark is set like a seal in wax (mark-set, mark-ring), and the field takes the
      // impression: sealed with the fill texture (data-set), it is closed, not merely tinted.
      dress(field);
      field.setAttribute('data-set', 'true');
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
        show();
        note(trace, 'arrow keys move the mark, enter leaves it there');
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        place(cursor.x, cursor.y);
      }
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'tap or click anywhere in the field, or move the mark with the arrow keys and press enter'));
  }
  // The line is laid as ink into grain: drawn, then clipped by a matte rolled for this pad, so it
  // is a rubbing and not a vector; when the hand lifts the line SETS, replayed from its start in
  // rolled treads with the grain's coverage climbing and the colour cutting to the second accent
  // on the last tread. The reading is `points` alone.
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
    var grain = matteField(null);
    var tooth = matteField(null, 'scan');
    var cover = between(0.55, 0.8);
    var set = null; // { k: coverage, warm: the last tread }
    var off = document.createElement('canvas');
    off.width = pad.width;
    off.height = pad.height;
    var og = off.getContext('2d');
    var ground = null;
    function at(ev) {
      var box = pad.getBoundingClientRect();
      return { x: (ev.clientX - box.left) / box.width * pad.width,
        y: (ev.clientY - box.top) / box.height * pad.height };
    }
    function paint() {
      if (!ctx) return;
      var w = pad.width;
      var h = pad.height;
      ctx.clearRect(0, 0, w, h);
      // The paper has tooth: a scan matte at low coverage, painted once.
      if (!ground) {
        ground = document.createElement('canvas');
        ground.width = w;
        ground.height = h;
        var gg = ground.getContext('2d');
        if (gg) tooth.paint(gg, 0, 0, w, h, 0.22, rgba(paper, 0.5));
      }
      ctx.drawImage(ground, 0, 0);
      if (!points.length) return;
      var shown = set ? Math.max(1, Math.round(points.length * Math.min(1, set.k))) : points.length;
      var g = og || ctx;
      if (og) og.clearRect(0, 0, w, h);
      g.strokeStyle = rgba(set && set.warm ? warm : cool, 0.95);
      g.lineWidth = set && set.warm ? 3 : 2.4;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      for (var i = 0; i < shown; i++) { i ? g.lineTo(points[i].x, points[i].y) : g.moveTo(points[i].x, points[i].y); }
      g.stroke();
      if (og) {
        // The older segments settle into the grain; the newest is drawn full while the hand moves.
        grain.clip(og, w, h, set ? Math.min(1, 0.3 + 0.7 * set.k) : cover);
        if (!set && points.length > 1) {
          var n = points.length;
          og.strokeStyle = rgba(cool, 0.95);
          og.lineWidth = 2.4;
          og.beginPath();
          og.moveTo(points[n - 2].x, points[n - 2].y);
          og.lineTo(points[n - 1].x, points[n - 1].y);
          og.stroke();
        }
        ctx.drawImage(off, 0, 0);
      }
    }
    pad.addEventListener('pointerdown', function (ev) {
      if (set) return;
      drawing = true;
      points = [at(ev)];
      pad.setPointerCapture(ev.pointerId);
    });
    pad.addEventListener('pointermove', function (ev) {
      if (!drawing) return;
      points.push(at(ev));
      paint();
      gauge(trace, tally(Math.ceil(points.length / 4)));
    });
    pad.addEventListener('pointerup', function () {
      if (!drawing) return;
      drawing = false;
      score();
    });
    pad.addEventListener('keydown', function (ev) {
      if (set) return;
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
      if (points.length < 2) { note(trace, 'one line, any line'); return; }
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
      // The line sets: replayed from its start, the grain filling, warm on the last tread.
      gauge(trace, '');
      pad.style.cursor = 'default';
      series({ ms: beat('long'), treads: 4 + Math.floor(Math.random() * 3), step: function (k, n) {
        set = { k: k / n, warm: k === n };
        paint();
      } });
      finish();
    }
    body.appendChild(pad);
    body.appendChild(el('p', 'probe-count', 'draw with a finger, a mouse, or the arrow keys'));
    paint();
  }
  // A lamp is lit behind a curtain: the pane's light climbs the ladder (pane-light), a window
  // going dark descends it (pane-dark), and on the third light the whole facade reads -- all nine
  // panes stamp one tread each in a rolled order (pane-read) before the shape is scored.
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
      button.appendChild(pane);
      panes.push(pane);
      button.addEventListener('click', function () {
        if (read) return;
        var at = selected.indexOf(index);
        if (at !== -1) {
          selected.splice(at, 1);
          button.setAttribute('data-was-lit', 'true');
          button.setAttribute('aria-pressed', 'false');
        } else {
          selected.push(index);
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
        shuffled(panes).forEach(function (p, k) { p.style.setProperty('--d', staggerOf(k) + 'ms'); });
        field.setAttribute('data-read', 'true');
        var wait = beat('long');
        if (wait) window.setTimeout(finish, wait); else finish();
      });
      field.appendChild(button);
    });
    body.appendChild(field);
    body.appendChild(el('p', 'probe-count', 'Tap a lit window to close it before lighting the third.'));
  }
  // The final division is the answer, not the order of presses. Undo never leaves a reading behind.
  // The balance settles as a ratchet: the beam and the bowls move toward their marks in rolled
  // treads with an overshoot past level and a slip back, the dropped weight falls from the spare
  // row in two cuts with a burst of dust drawn through a shards matte, and 'leave them hanging'
  // seals the picture under a scan matte with the beam cut to the second accent.
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
      finish();
    });
    controls.appendChild(undo);
    controls.appendChild(leave);
    body.appendChild(controls);

    var dust = matteField(null, 'shards');
    var veil = matteField(null, 'scan');
    var shown = { tilt: 0, depth: counts.map(function () { return 0; }), fall: null, dust: null, sealed: 0 };
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
        if (shown.dust && shown.dust.index === index) {
          dust.paint(g, x - bw / 2, y + bh * 0.4, bw, bh * 0.9, shown.dust.k, rgba(rgbOf(brass, '#ffe7ab'), 0.55));
        }
      });
      g.fillStyle = brass;
      var spare = probe.total - placed.length + (shown.fall && shown.fall.k === 0 ? 1 : 0);
      for (var i = 0; i < spare; i++) {
        g.beginPath();
        g.arc(w / 2 + (i - (spare - 1) / 2) * h * 0.055, h * 0.92, h * 0.018, 0, Math.PI * 2);
        g.fill();
      }
      if (shown.sealed) veil.paint(g, 0, 0, w, h, shown.sealed, rgbOf(ground, '#070a14').length ? rgba(rgbOf(ground, '#070a14'), 0.75) : ground);
    }
    function settle(how) {
      if (cancel) cancel();
      var fromTilt = shown.tilt;
      var toTilt = tiltFor(counts);
      var fromDepth = shown.depth.slice();
      var over = 1 + between(0.08, 0.22);
      shown.fall = how.drop != null ? { index: how.drop, k: 0 } : null;
      shown.dust = null;
      cancel = series({ ms: beat(how.seal ? 'medium' : 'long'), treads: how.lift ? 3 : 4 + Math.floor(Math.random() * 3), step: function (k, n, slipping) {
        if (shown.fall) shown.fall.k = k;
        if (how.drop != null && k === 2) shown.dust = { index: how.drop, k: 0.3 };
        else if (shown.dust) shown.dust.k = k === 3 ? 0.14 : 0;
        // The beam catches on its pivot: past level on the second-to-last tread, home on the last.
        var y = k >= n ? 1 : k === n - 1 ? over : k / n;
        if (slipping) y = Math.max(0, y - 0.12);
        var p = how.drop != null ? Math.max(0, (k - 1) / Math.max(1, n - 1)) : y;
        shown.tilt = fromTilt + (toTilt - fromTilt) * (how.drop != null ? (k >= n ? 1 : k === n - 1 ? over : p) : y);
        for (var i = 0; i < counts.length; i++) shown.depth[i] = fromDepth[i] + (counts[i] - fromDepth[i]) * (k >= n ? 1 : p);
        if (how.seal) shown.sealed = k >= n ? 0.42 : k >= 2 ? 0.22 : 0;
        paint();
      }, done: function () { shown.fall = null; shown.dust = null; shown.tilt = toTilt; paint(); } });
    }
    function redraw(how) {
      var left = probe.total - placed.length;
      buttons.forEach(function (button, index) {
        var bowl = probe.bowls[index];
        details[index].textContent = bowl.place + ' bowl: ' + plural(counts[index], 'weight');
        button.setAttribute('aria-label', 'Give one weight to ' + bowl.label + '; ' + plural(counts[index], 'weight') + ' inside');
        if (submitted) retire(button); else button.disabled = left === 0;
      });
      if (submitted) { retire(undo); retire(leave); } else {
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
  // turns, so the weighing is curiosity made visible, never a puzzle. Weighing reveals the detail
  // glyph by glyph; turning rotates the key in rolled treads (key-turn) while the other six shed
  // down the ladder, and only then are they disabled.
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
          button.style.setProperty('--key-turn', (10 + Math.random() * 10).toFixed(1) + 'deg');
          button.setAttribute('data-turned', 'true');
          shuffled(buttons.filter(function (b) { return b !== button; })).forEach(function (other, k) {
            other.style.setProperty('--d', staggerOf(k) + 'ms');
            unmake(other);
          });
          note(trace, key.label + ' turns in the lock');
          var wait = beat('long');
          function turned() {
            for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
            finish();
          }
          if (wait) window.setTimeout(turned, wait); else turned();
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
  // The room answers the dial by area: an ember texture and a frost texture, each masked at a rung
  // of the ladder proportional to its share (data-warmth), trade coverage in hard treads; the
  // nearer end's word opens its tracking a step; 'leave it there' seals the panel.
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
    dress(wrap);
    function room() {
      var v = Number(input.value);
      wrap.setAttribute('data-warmth', String(Math.round(v / 20)));
      wrap.setAttribute('data-lean', v < 40 ? 'cold' : v > 60 ? 'warm' : 'mid');
    }
    room();
    input.addEventListener('input', function () {
      room();
      tick(wrap);
      note(trace, 'the dial is somewhere it was not');
    });
    done.addEventListener('click', function () {
      if (done.disabled || done.getAttribute('aria-disabled') === 'true') return;
      var warmth = Number(input.value) / 100;
      add(answer, probe.cold, 1 - warmth);
      add(answer, probe.warm, warmth);
      input.disabled = true;
      wrap.setAttribute('data-set', 'true');
      retire(done);
      finish();
    });
    body.appendChild(wrap);
    body.appendChild(done);
  }
  // The stars come out one at a time, faster as the dusk deepens, and the answer is how many
  // there are when the visitor says enough -- and how many of them they hurried out by hand. The
  // sky fills on its own if they wait, but it never answers on its own: the press is theirs.
  // A star does not fade in, it resolves: a matte disc whose coverage climbs in rolled treads
  // with a flare on the last; it twinkles by a flicker series of holds and drops, never a sine;
  // the lines between stars come up as rolled dashes advancing in cuts; the stars a visitor
  // hurried are warm and shard-matted so their hand shows; 'enough' lays a glass over the night.
  function skyProbe(probe, body, trace, answer, finish) {
    var full = probe.full || 48;
    var still = stilled();
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
    var glass = 0; // the coverage of the glass laid over the night at 'enough'
    var due = 0;
    var veil = matteField(null, 'scan');
    function pace(n) { return 160 + 900 * Math.pow(0.95, n); }
    function count() {
      if (!trace.meter) return;
      var dots = '';
      for (var i = 0; i < stars.length; i++) dots += (i && i % 8 === 0 ? ' ' : '') + '·';
      gauge(trace, stars.length ? dots : 'none out yet');
    }
    var linkRise = treadsOf(rite('shift'), 3 + Math.floor(Math.random() * 3)); // how the lines between stars come up, rolled for this sky
    var linkDash = dashesOf(prng(Math.floor(Math.random() * 0x7fffffff)));
    function appear(x, y, own) {
      // Each star comes out along a curve rolled for it alone, through a matte of its own.
      var field = matteField(null, own ? 'shards' : null);
      var treads = 3 + Math.floor(Math.random() * 3);
      stars.push({ x: x, y: y, r: 0.9 + Math.random() * 1.5, born: performance.now(), own: !!own,
        rise: treadsOf(rite('arrive'), treads), treads: treads, life: 420 + Math.random() * 500,
        matte: field, twinkle: field.flicker() });
      count();
      if (stars.length === 1) note(trace, 'the first one is out');
      if (stars.length >= full) {
        enough.textContent = 'that is all of them';
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
        // The line advances in cuts along its dashes: so far, and no further, until the next tread.
        var up = still ? 1 : linkRise(Math.min(1, (now - Math.max(a.born, stars[near].born)) / 900));
        if (up <= 0) continue;
        g.strokeStyle = rgba(glass && stopped ? warm : cool, 0.1 + 0.22 * (1 - Math.sqrt(best) / reach));
        g.setLineDash(linkDash);
        g.beginPath();
        g.moveTo(a.x * w, a.y * h);
        g.lineTo(a.x * w + (stars[near].x - a.x) * w * up, a.y * h + (stars[near].y - a.y) * h * up);
        g.stroke();
        g.setLineDash([]);
      }
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        var age = (now - s.born) / s.life;
        var f = still ? 1 : s.rise(Math.min(1, age));
        var lit = still ? 1 : s.twinkle(now);
        var c = s.own ? warm : blend(cool, [255, 255, 255], 0.55);
        var x = s.x * w;
        var y = s.y * h;
        var flare = !still && age < 1 && f >= 1 ? 1.6 : 1;
        var r = s.r * (lit ? 1 : 0.7) * flare;
        if (f <= 0) continue;
        if (age >= 1 || f >= 1) {
          if (lit) s.matte.disc(g, x, y, r * 4, 0.1, rgba(c, 0.5));
          g.fillStyle = rgba(c, lit ? 1 : 0.8);
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        } else {
          // Resolving: the disc's area fills through its matte, tread by tread.
          s.matte.disc(g, x, y, r * 3, f, rgba(c, 0.9));
        }
      }
      if (glass) veil.paint(g, 0, 0, w, h, glass, rgba(night, 0.8));
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
      if (stopped && (still || glass >= 0.3)) return;
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
      retire(enough);
      retire(hurry);
      sky.style.cursor = 'default';
      gauge(trace, '');
      // A glass over the night: the scan matte settles in treads, the lines cut warm.
      series({ ms: beat('medium'), treads: 3, step: function (k, n2) { glass = k >= n2 ? 0.3 : k * 0.1; } });
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
  // saying the knock is done is the visitor's press. A knock rings as a ratchet and dies as shards:
  // the ring's radius advances in rolled cuts as a dashed circle and sheds through a shards matte
  // instead of dimming; the door's shudder is a film-reel jolt of rolled displacements with holds;
  // each tick on the strip stamps; 'that is my knock' seals the door.
  function knockProbe(probe, body, trace, answer, finish) {
    var still = stilled();
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
    var sealed = 0;
    var grain = matteField(null, 'grain');
    var RING_MS = 700;
    function pattern() {
      var out = '·';
      for (var i = 1; i < knocks.length; i++) {
        var gap = knocks[i].at - knocks[i - 1].at;
        out += (gap < 320 ? '' : gap < 900 ? ' ' : '   ') + '·';
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
      // The door shudders under a fresh knock, unless the visitor asked for stillness: a reel of
      // rolled displacements, each held until the next, never a sine.
      var shake = 0;
      if (!still) {
        for (i = 0; i < knocks.length; i++) {
          var age = now - knocks[i].born;
          var jolts = knocks[i].jolts;
          for (var q = 0; q < jolts.length; q++) {
            if (age < jolts[q][0]) { shake += jolts[q][1]; break; }
          }
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
      // Each knock rings out from where it landed in cuts, breaking up as it goes; with less motion
      // the ring is simply there.
      for (i = 0; i < knocks.length; i++) {
        var k = knocks[i];
        var life = (now - k.born) / RING_MS;
        if (life >= 1) continue;
        var rung = still ? 0.5 : k.ring(life); // how far this knock's ring has got, its own way
        var radius = still ? h * 0.08 : h * 0.03 + rung * h * 0.22;
        var keep = still ? 0.6 : 1 - rung; // what the shards matte still lets through
        g.strokeStyle = rgba(cool, 0.75);
        g.lineWidth = 2;
        var segs = 64;
        var dash = k.dash;
        for (var s = 0; s < segs; s++) {
          if (!dash[s % dash.length]) continue;
          var a0 = s / segs * Math.PI * 2;
          var a1 = (s + 1) / segs * Math.PI * 2;
          var mx = k.x + Math.cos((a0 + a1) / 2) * radius;
          var my = k.y + Math.sin((a0 + a1) / 2) * radius;
          if (!k.matte.at(Math.floor(mx / k.matte.cell), Math.floor(my / k.matte.cell), keep)) continue;
          g.beginPath();
          g.arc(k.x, k.y, radius, a0, a1);
          g.stroke();
        }
      }
      // The knock written down: one tick for each, spaced along the strip as they fell; the newest
      // stamps -- one frame wide and tall, then its own width.
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
          var fresh = !still && now - knocks[i].born < 90;
          g.lineWidth = fresh ? 3 : 2;
          g.beginPath();
          g.moveTo(x, fresh ? h * 0.03 : h * 0.05);
          g.lineTo(x, fresh ? h * 0.15 : h * 0.13);
          g.stroke();
        }
        if (sealed) grain.paint(g, w * 0.06, h * 0.02, w * 0.88, h * 0.14, sealed, rgba(night, 0.7));
      }
    }
    function frame(now) {
      running = false;
      if (!door.isConnected) return;
      paint(now);
      for (var i = 0; i < knocks.length; i++) {
        if (now - knocks[i].born < RING_MS) { kick(); return; }
      }
    }
    function kick() {
      if (running) return;
      running = true;
      window.requestAnimationFrame(frame);
    }
    function rap(fx, fy) {
      if (stopped) return;
      // Each knock rings out and shudders the door along a stair rolled for that knock alone: its
      // own tread count, dash pattern, shards matte and reel of jolts.
      var r = prng(Math.floor(Math.random() * 0x7fffffff));
      var jolts = [];
      var until = 0;
      var n = 3 + Math.floor(r() * 3);
      for (var i = 0; i < n; i++) {
        until += 30 + r() * 60;
        jolts.push([until, Math.round((i % 2 ? -1 : 1) * (3.5 - i * 0.7) * (0.7 + r() * 0.6) * 10) / 10]);
      }
      var dash = [];
      var dl = 6 + Math.floor(r() * 6);
      for (var d = 0; d < dl; d++) dash.push(r() < 0.65 ? 1 : 0);
      knocks.push({ at: Date.now(), born: performance.now(), x: fx * door.width, y: fy * door.height,
        ring: treadsOf(rite('leave'), 4 + Math.floor(r() * 4)), jolts: jolts, dash: dash,
        matte: matteField(Math.floor(r() * 0x7fffffff), 'shards') });
      done.disabled = false;
      note(trace, knocks.length === 1 ? 'one knock' : knocks.length + ' knocks');
      gauge(trace, pattern());
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
      retire(knock);
      retire(done);
      door.style.cursor = 'default';
      gauge(trace, '');
      // The door is sealed: its panels cut warm and a grain settles over the strip, in treads.
      series({ ms: beat('medium'), treads: 3, step: function (k, n2) { sealed = k >= n2 ? 0.3 : k * 0.1; paint(performance.now()); } });
      finish();
    });
    paint(performance.now());
  }
  // A cairn is read when it is left standing, never while it rises: how many stones, and the
  // shape the stack took -- plumb, swaying, leaning, or daring. Each stone goes where the visitor
  // sets it: tap the ground either side of the stack, steer the next stone with the arrow keys and
  // place it with enter, or let the button set one square on. No cairn is wrong and nothing falls:
  // a stone set far out simply hangs there, which is its own kind of answer. A stone is set, not
  // drawn: it drops from above in rolled treads, slips a hair sideways on the last cut (cosmetic,
  // never written into the reading), raises a one-frame dust matte, and wears a grain of its own;
  // the ghost's dashes are rolled per move and it ratchets to its offset in two cuts; 'leave it
  // standing' settles dusk over the cairn.
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
    var dusky = 0;
    var dustField = matteField(null, 'shards');
    var veil = matteField(null, 'scan');
    var ghostDash = [4, 5];
    var cancelCursor = null;
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
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgba(blend(night, dusk, 0.5), 1));
      grad.addColorStop(1, rgba(night, 1));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      if (dusky) veil.paint(g, 0, 0, w, h * 0.88, dusky, rgba(night, 0.8));
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
        var lift = stone.drop ? stone.drop.lift : 0;
        var slip = stone.drop ? stone.drop.slip : 0;
        var mid = y + sh / 2 - lift;
        var sx = x + slip;
        g.strokeStyle = rgba(blend(night, cool, 0.3 + (i % 3) * 0.07), 1);
        g.lineWidth = sh;
        g.beginPath();
        g.moveTo(sx - sw / 2 + sh / 2, mid);
        g.lineTo(sx + sw / 2 - sh / 2, mid);
        g.stroke();
        // The stone's face: a grain of its own, so no two stones wear the same texture.
        stone.face.paint(g, sx - sw / 2 + sh / 2, mid - sh / 2 + 1, sw - sh, sh - 2, stone.grain, rgba(night, 0.35));
        g.strokeStyle = dusky ? rgba(warm, 0.6) : rgba(cool, 0.35);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(sx - sw / 2 + sh, y + 1 - lift);
        g.lineTo(sx + sw / 2 - sh, y + 1 - lift);
        g.stroke();
        if (stone.drop && stone.drop.dust) {
          dustField.paint(g, sx - sw / 2 - 6, y + sh - 4, sw + 12, 10, stone.drop.dust, rgba(cool, 0.5));
        }
      }
      if (!done && stones.length < MAX) {
        var gw = stoneW(stones.length);
        var gx = x + (stones.length ? shownCursor * stoneW(stones.length - 1) : 0);
        g.setLineDash(ghostDash);
        g.strokeStyle = rgba(warm, 0.65);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(gx - gw / 2, y - 7);
        g.lineTo(gx + gw / 2, y - 7);
        g.stroke();
        g.setLineDash([]);
      }
    }
    function place(off) {
      if (done || stones.length >= MAX) return;
      var o = stones.length ? Math.max(-0.42, Math.min(0.42, off)) : 0;
      var stone = { off: o, face: matteField(null, Math.random() < 0.5 ? 'grain' : 'noise'), grain: between(0.25, 0.45), drop: null };
      stones.push(stone);
      cursor = 0;
      shownCursor = 0;
      leave.disabled = false;
      note(trace, stones.length >= MAX ? 'that is all the stones there are'
        : plural(stones.length, 'stone') + (stones.length === 1 ? ', the base'
          : o > 0.08 ? ', set a little east' : o < -0.08 ? ', set a little west' : ', set square'));
      gauge(trace, stones.slice(1).map(function (s) {
        return s.off > 0.08 ? '↗' : s.off < -0.08 ? '↖' : '·';
      }).join(' '));
      // The drop: from above, in treads, a slip on the last cut and a puff of dust that goes.
      var from = 18 + Math.random() * 12;
      var slip = (Math.random() < 0.5 ? -1 : 1) * between(1, 2.5);
      stone.drop = { lift: from, slip: 0, dust: 0 };
      series({ ms: beat('medium'), treads: 2 + Math.floor(Math.random() * 3), step: function (k, n) {
        if (k >= n) { stone.drop = { lift: 0, slip: slip, dust: 0.25 }; }
        else stone.drop = { lift: from * (1 - k / n), slip: 0, dust: 0 };
        paint();
      }, done: function () {
        stone.drop = { lift: 0, slip: slip, dust: 0 };
        paint();
      } });
    }
    function steer() {
      // The ghost ratchets to the new offset in two cuts, its dashes rolled for this move.
      ghostDash = dashesOf(prng(Math.floor(Math.random() * 0x7fffffff)));
      var from = shownCursor;
      var to = cursor;
      if (cancelCursor) cancelCursor();
      cancelCursor = series({ ms: beat('short'), treads: 2, step: function (k, n) {
        shownCursor = k >= n ? to : from + (to - from) * (k / n);
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
        steer();
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
      retire(set);
      retire(leave);
      ground.style.cursor = 'default';
      gauge(trace, '');
      // Dusk settles over the cairn in treads; the stones' highlights cut warm.
      series({ ms: beat('medium'), treads: 3, step: function (k, n2) { dusky = k >= n2 ? 0.3 : k * 0.1; paint(); } });
      finish();
    });
    paint();
  }
  // A rubbing reads the final coverage, not the path or speed of the hand. Dragging and native
  // buttons uncover the same patches; no gesture history or drawing is kept with the reading.
  // Soot lifts in blotches: an uncovered cell descends the matte ladder (soot-lift) so the print
  // shows through holes that spread; the soot itself is the rolled fill texture, each cell at a
  // phase of its own (--cell-shift) so no two tile alike; 'start over' covers the print again by
  // climbing the ladder (soot-cover), cell by cell in a rolled stagger.
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
    function uncover(index) {
      if (index < 0 || index >= buttons.length) return;
      var motif = probe.motifs[motifOf(index)];
      if (!revealed[index]) {
        revealed[index] = true;
        buttons[index].removeAttribute('data-covering');
        buttons[index].style.setProperty('--d', '0ms');
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
        button.style.setProperty('--cell-shift', Math.round(Math.random() * 100) + '% ' + Math.round(Math.random() * 100) + '%');
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
    field.addEventListener('pointerdown', function (ev) {
      if (pointer !== null || ev.button !== 0) return;
      pointer = ev.pointerId;
      if (field.setPointerCapture) field.setPointerCapture(ev.pointerId);
      uncover(at(ev));
    });
    field.addEventListener('pointermove', function (ev) {
      if (pointer !== ev.pointerId) return;
      var index = at(ev);
      if (index >= 0 && !revealed[index]) uncover(index);
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
      shuffled(covering).forEach(function (button, k) {
        button.style.setProperty('--d', staggerOf(k) + 'ms');
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
      retire(done);
      retire(reset);
      finish();
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
