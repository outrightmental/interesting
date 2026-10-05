/*
  The mood flow: this site asks before it offers.

  One line in the <head> of a page carries all of it, written once in _includes/layout.njk:

      <script src='js/threshold.js' defer></script>

  Not everyone likes stars. The target of interest is the whole population, so no page may put
  particular content in front of a visitor on the assumption that they want it. This file is how
  the site finds out first (issue #30):

    - ORIENTATIONS is the set of mental orientations the site distinguishes between, and the world
      each one opens onto. Several are the sky pages this site grew up as; the rest are not sky at
      all. Nothing here is the default.
    - PROBES is the library of query mechanisms. None of them asks a visitor to report their own
      state: they ask about a door, a stone, a pocket, a tempo, a stroke, a dial. A visitor gets a
      different one on every arrival -- the last few are remembered precisely so they are not
      repeated -- and adding a new mechanism to this array is the most interesting change anyone
      can make to this file.
    - The clock and the time zone are read as well, so an arrival in the small hours from the far
      side of the world starts from a different place than one at midday.
    - What is learned is only partly remembered: the drift below decays with the time since the
      last visit, and the fresh answer always outweighs it. Every arrival at the threshold is
      queried again; every other page invites, one press away.

  Every page carries the ribbon this file builds, so the flow is ongoing rather than a gate at the
  front door. On the threshold (index.html) the ribbon asks on arrival; on every other page it
  invites, one press away, so a visitor who followed a link to a world meets that world first.
  Any page can ask again, in a new way, and the whole site re-skins itself around the answer
  through the data-mood attribute (see _sass/_mood.scss). The mood atlas (moods.html) runs any
  mechanism on demand, shows the clock and the gap since the last visit, and can forget.

  What is remembered is kept in the site's one local-state document, under "threshold", through
  window.interestingState -- like every page of this site, this file never reaches for the
  browser's storage itself, so a visitor can export and carry their reading away with the rest of
  their state (see js/state.js, and pages_touching_storage in make_interesting.py).

  The AI iteration may rewrite any page of this site, so the line above is an axiom of every run:
  see MOOD_SCRIPT, PROBE_DECLARATION and check_mood in .github/scripts/make_interesting.py. This
  file is protected -- it may be rewritten, never deleted -- because every page leans on it.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  // '' everywhere but the 404 page, which is served at any missing path and names the site's
  // root so the links this file writes still lead somewhere (see siteRoot in layout.njk).
  var root = document.documentElement.getAttribute('data-root') || '';
  var READING = 'threshold'; // this file's one name inside the shared local-state document
  var RECENT = 6; // how many mechanisms back still counts as "the same way twice"
  var HALF_LIFE_H = 30; // a remembered reading fades to half its pull in this many hours
  var ANSWER_PULL = 3; // the fresh answer outweighs memory and signal, on every arrival
  var SIGNAL_PULL = 1;
  // A gap this long before a page view makes it a fresh arrival, which is what the ribbon asks
  // on. Clicking from one page to the next is the same arrival; coming back later is a new one.
  var ARRIVAL_GAP_MS = 30 * 60 * 1000;

  /* The orientations the site distinguishes between, and the world each opens onto. The list is
     meant to grow: a new world belongs here beside its page, and nothing else has to change. */
  var ORIENTATIONS = [
    { id: 'tender', name: 'banked low', pull: 'wants less asked of it',
      world: 'quiet-room.html', worldName: 'the quiet room' },
    { id: 'restless', name: 'wound tight', pull: 'wants to shove something and watch it go',
      world: 'kinetic-floor.html', worldName: 'the kinetic floor' },
    { id: 'analytic', name: 'cold and clear', pull: 'wants a mechanism to take apart',
      world: 'machine-shop.html', worldName: 'the machine shop' },
    { id: 'rooted', name: 'low and slow', pull: 'wants something that grows downward',
      world: 'loam.html', worldName: 'loam' },
    { id: 'verbal', name: 'full of half-sentences', pull: 'wants words put in the fire',
      world: 'word-kiln.html', worldName: 'the word kiln' },
    { id: 'curious', name: 'magpie', pull: 'wants a strange specimen in a drawer',
      world: 'apocrypha-desk.html', worldName: 'the apocrypha desk' },
    { id: 'cosmic', name: 'looking up', pull: 'wants distance and scale',
      world: 'wish-constellation.html', worldName: 'the wish constellation' },
    { id: 'ceremonial', name: 'wants a rite', pull: 'wants to light something on purpose',
      world: 'star-lantern.html', worldName: 'the lantern ritual' },
    { id: 'brooding', name: 'in the long look', pull: 'wants to re-read its own record',
      world: 'constellation-diary.html', worldName: 'the diary' },
    { id: 'tempestuous', name: 'weather coming', pull: 'wants pressure, front and squall',
      world: 'constellation-weather.html', worldName: 'the weather lab' },
    { id: 'attentive', name: 'ears first', pull: 'wants to listen to something decay',
      world: 'constellation-echo.html', worldName: 'the echo chamber' },
    { id: 'tending', name: 'minding something', pull: 'wants a living thing to keep',
      world: 'wish-terrarium.html', worldName: 'the terrarium' },
    { id: 'divinatory', name: 'asking elsewhere', pull: 'wants an answer it did not author',
      world: 'sky-archive.html', worldName: 'the archive oracle' },
    { id: 'geometric', name: 'after symmetry', pull: 'wants a pattern to close',
      world: 'orbital-weaver.html', worldName: 'the orbital weaver' }
  ];

  /* The query mechanisms. Each carries a `probe` id, which is the handle the framework counts,
     and a `name`, which is what the mood atlas shows a visitor instead of the id
     (see PROBE_DECLARATION in .github/scripts/make_interesting.py): the site is held to keeping a
     wide library of them, and a run that invents another is doing the most interesting work there
     is to do here. The rule every one of them obeys: ask about the world, never about the self. */
  var PROBES = [
    {
      probe: 'doorway', name: 'four doors', kind: 'choice',
      ask: 'Four doors, all unlocked. One of them is already ajar, and it is not the one you want.',
      options: [
        { label: 'the one with a draught under it', detail: 'cold air, and a sound like far-off traffic',
          weights: { cosmic: 3, restless: 2, tempestuous: 2 } },
        { label: 'the one that smells of wet soil', detail: 'something is growing on the other side',
          weights: { rooted: 3, tending: 2, tender: 1 } },
        { label: 'the one with a light under it', detail: 'someone left a lamp on and a page half-turned',
          weights: { verbal: 3, brooding: 2, curious: 1 } },
        { label: 'the one that hums', detail: 'a machine behind it, running without supervision',
          weights: { analytic: 3, geometric: 2, attentive: 1 } }
      ]
    },
    {
      probe: 'pocket', name: 'one object for the pocket', kind: 'choice',
      ask: 'You are going out. One object fits in the pocket. The rest stay on the table.',
      options: [
        { label: 'a short crowbar', detail: 'nothing in particular to open yet',
          weights: { restless: 3, tempestuous: 2, analytic: 1 } },
        { label: 'a folding magnifier', detail: 'scratched, 10x, slightly loose',
          weights: { curious: 3, analytic: 2, attentive: 1 } },
        { label: 'a square of blanket', detail: 'cut from something older, kept for no reason',
          weights: { tender: 3, rooted: 2, tending: 1 } },
        { label: 'a pocket notebook', detail: 'two thirds used, the pencil lost',
          weights: { verbal: 3, brooding: 2, curious: 1 } },
        { label: 'a small brass bell', detail: 'it only rings when you mean it to',
          weights: { ceremonial: 3, attentive: 2, divinatory: 1 } }
      ]
    },
    {
      probe: 'window', name: 'the window', kind: 'choice',
      ask: 'There is one window in this room and you get to decide what is behind it.',
      options: [
        { label: 'a flat black sky, no cloud', detail: 'and whatever is up there, up there',
          weights: { cosmic: 3, brooding: 2, geometric: 1 } },
        { label: 'weather arriving sideways', detail: 'the glass is already wet',
          weights: { tempestuous: 3, restless: 2, attentive: 1 } },
        { label: 'a courtyard with one tree in it', detail: 'the tree is doing fine',
          weights: { rooted: 3, tending: 2, tender: 2 } },
        { label: 'a lit workshop across the way', detail: 'someone is still in there, making something',
          weights: { analytic: 3, verbal: 1, curious: 2 } }
      ]
    },
    {
      probe: 'stone', name: 'four stones', kind: 'choice',
      ask: 'Four stones on a shelf. Pick one up -- you will be carrying it for a while.',
      options: [
        { label: 'the heavy one', detail: 'river-smoothed, cold, two hands',
          weights: { rooted: 3, brooding: 2, tender: 1 } },
        { label: 'the sharp one', detail: 'freshly broken, one edge still bright',
          weights: { restless: 3, analytic: 2, tempestuous: 1 } },
        { label: 'the pierced one', detail: 'a hole worn clean through by water',
          weights: { divinatory: 3, curious: 2, ceremonial: 2 } },
        { label: 'the one with a fossil in it', detail: 'a coil, pressed flat, very old',
          weights: { curious: 3, brooding: 2, geometric: 1 } }
      ]
    },
    {
      probe: 'misfit', name: 'the odd one out', kind: 'choice',
      ask: 'Five things are on the table. Four of them belong together. Take away the one that does not.',
      options: [
        { label: 'a tuning fork', detail: 'because the others are silent',
          weights: { attentive: 3, ceremonial: 1, analytic: 1 } },
        { label: 'a pressed leaf', detail: 'because the others were made',
          weights: { rooted: 3, tending: 2 } },
        { label: 'a six-sided die', detail: 'because the others are not asking anything',
          weights: { divinatory: 3, curious: 1, restless: 1 } },
        { label: 'a torn ticket stub', detail: 'because the others have no date on them',
          weights: { brooding: 3, verbal: 2 } },
        { label: 'a hexagonal nut', detail: 'because the others are not part of anything',
          weights: { analytic: 3, geometric: 2 } }
      ]
    },
    {
      probe: 'bench', name: 'the workbench', kind: 'sequence',
      ask: 'A workbench, four objects. Take three, in order: the one nearest the door first, the one nearest the window last.',
      take: 3,
      items: [
        {
          label: 'a warm mug',
          detail: 'still steaming',
          slots: [
            { tender: 2, rooted: 1 },
            { attentive: 1, verbal: 1 },
            { ceremonial: 1, brooding: 1 }
          ]
        },
        {
          label: 'a brass compass',
          detail: 'needle wandering, then settling',
          slots: [
            { analytic: 2, geometric: 1 },
            { curious: 2, divinatory: 1 },
            { cosmic: 2, restless: 1 }
          ]
        },
        {
          label: 'a hand bell',
          detail: 'wrapped in cloth',
          slots: [
            { ceremonial: 2, attentive: 1 },
            { divinatory: 2, verbal: 1 },
            { tempestuous: 2, restless: 1 }
          ]
        },
        {
          label: 'a packet of seeds',
          detail: 'label smudged',
          slots: [
            { tending: 2, rooted: 2 },
            { tender: 1, curious: 1 },
            { cosmic: 1, brooding: 1 }
          ]
        }
      ]
    },
    {
      probe: 'stair', name: 'three landings', kind: 'choice',
      ask: 'Three landings, and no going back up. Pick a way down.',
      steps: [
        { ask: 'First landing. Two corridors.', options: [
          { label: 'the one that gets narrower', detail: 'and warmer',
            weights: { tender: 2, brooding: 2, rooted: 1 } },
          { label: 'the one that opens out', detail: 'and gets colder',
            weights: { cosmic: 2, restless: 2, tempestuous: 1 } }
        ] },
        { ask: 'Second landing. Something is on the floor.', options: [
          { label: 'step over it', detail: 'you have somewhere to be',
            weights: { restless: 2, analytic: 1, geometric: 1 } },
          { label: 'crouch down and look', detail: 'you did not have anywhere to be',
            weights: { curious: 2, attentive: 1, tending: 1 } }
        ] },
        { ask: 'Third landing. A door, and a window beside it.', options: [
          { label: 'the door', detail: 'it is a door, after all',
            weights: { ceremonial: 2, verbal: 1, analytic: 1 } },
          { label: 'the window', detail: 'it is only one floor down',
            weights: { divinatory: 2, cosmic: 1, restless: 1 } }
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
          { label: 'a long echo', weights: { attentive: 2, brooding: 1 } },
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
      ask: 'Tap this five times, at whatever rate feels like the rate.',
      label: 'tap',
      buckets: [
        { under: 220, weights: { restless: 3, tempestuous: 2, verbal: 1 } },
        { under: 420, weights: { analytic: 2, geometric: 2, curious: 2 } },
        { under: 800, weights: { attentive: 2, tending: 2, verbal: 1 } },
        { under: 1600, weights: { brooding: 2, rooted: 2, ceremonial: 1 } },
        { under: Infinity, weights: { tender: 3, cosmic: 2, brooding: 1 } }
      ],
      wobble: { steady: { geometric: 2, analytic: 1 }, loose: { tempestuous: 2, curious: 1 } }
    },
    {
      probe: 'hold', name: 'press and hold', kind: 'hold',
      ask: 'Press this and keep pressing. Let go when it has been enough.',
      label: 'press and hold',
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
        topLeft: { cosmic: 3, brooding: 1 },
        topRight: { tempestuous: 3, restless: 1 },
        bottomLeft: { rooted: 3, tender: 1 },
        bottomRight: { analytic: 2, geometric: 2 }
      },
      centre: { divinatory: 2, attentive: 1 },
      edge: { curious: 2, verbal: 1 }
    },
    {
      probe: 'stroke', name: 'one line', kind: 'draw',
      ask: 'Draw one line across this. Any line. Lift your hand when it is done.',
      short: { tender: 2, analytic: 1 },
      long: { restless: 2, tempestuous: 1 },
      straight: { geometric: 3, analytic: 1 },
      curved: { tending: 2, verbal: 2, attentive: 1 },
      jagged: { tempestuous: 3, restless: 1 }
    },
    {
      probe: 'dial', name: 'the dial', kind: 'slider',
      ask: 'Set the room. The dial does not say what it does.',
      low: 'frost on the inside of the glass',
      high: 'a kettle just off the boil',
      cold: { cosmic: 3, geometric: 2, analytic: 2, brooding: 1 },
      warm: { tender: 3, rooted: 2, tending: 2, ceremonial: 1 }
    }
  ];

  var ORIENTATION_BY_ID = {};
  for (var oi = 0; oi < ORIENTATIONS.length; oi++) ORIENTATION_BY_ID[ORIENTATIONS[oi].id] = ORIENTATIONS[oi];

  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function reducedMotion() {
    return !!(calm && calm.matches);
  }

  /* ---- what is partly remembered -------------------------------------------------------- */

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

  function save(next) {
    // false means the browser would store nothing, so this reading lasts only as long as the page:
    // a visitor with storage switched off still gets queried, just never remembered.
    store.set(READING, next);
  }

  var state = load();
  var sinceLast = state.last ? Math.max(0, Date.now() - state.last) : null;

  /* How much of the remembered drift survives this arrival: half of it per HALF_LIFE_H. Partly
     remembered, never wholly -- and a fresh answer outweighs whatever is left of it. */
  function memoryPull() {
    if (sinceLast === null) return 0;
    return Math.pow(0.5, (sinceLast / 3600000) / HALF_LIFE_H);
  }

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

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* ---- the signals that are not a question ---------------------------------------------- */

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
    America: { restless: 1, verbal: 1 },
    Europe: { brooding: 1, analytic: 1 },
    Africa: { rooted: 1, ceremonial: 1 },
    Asia: { geometric: 1, attentive: 1 },
    Australia: { tempestuous: 1, curious: 1 },
    Pacific: { cosmic: 1, tending: 1 },
    Atlantic: { tempestuous: 1, divinatory: 1 },
    Indian: { tending: 1, divinatory: 1 },
    Antarctica: { cosmic: 2, tender: 1 }
  };

  function signals() {
    var now = new Date();
    var hour = now.getHours();
    var zone = '';
    try {
      zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    } catch (e) {
      zone = '';
    }
    var offset = -now.getTimezoneOffset() / 60;
    var slot = PARTS[0];
    for (var i = 0; i < PARTS.length; i++) {
      if (hour < PARTS[i].until) { slot = PARTS[i]; break; }
    }
    return {
      hour: hour,
      clock: String(hour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      zone: zone,
      region: zone.split('/')[0] || '',
      offset: offset,
      part: slot.part,
      weights: slot.weights,
      visits: state.visits,
      sinceLast: sinceLast,
      sinceText: sinceText()
    };
  }

  function signalWeights(s) {
    var out = {};
    add(out, s.weights, 1);
    add(out, REGIONS[s.region] || {}, 1);
    // Far from the prime meridian, with the arithmetic that implies: a long way around from where
    // this site's clock thinks it is.
    if (Math.abs(s.offset) >= 7) add(out, { cosmic: 1, curious: 1 }, 1);
    // A return after a long gap is treated as a visitor worth re-reading from scratch.
    if (sinceLast !== null && sinceLast > 14 * 86400000) add(out, { curious: 2, restless: 1 }, 1);
    return out;
  }

  /* ---- scoring --------------------------------------------------------------------------- */

  function add(into, weights, factor) {
    for (var id in weights) {
      if (!Object.prototype.hasOwnProperty.call(weights, id) || !ORIENTATION_BY_ID[id]) continue;
      into[id] = (into[id] || 0) + weights[id] * factor;
    }
    return into;
  }

  function strongest(scores) {
    var best = null;
    for (var i = 0; i < ORIENTATIONS.length; i++) {
      var id = ORIENTATIONS[i].id;
      if (scores[id] && (best === null || scores[id] > scores[best])) best = id;
    }
    return best;
  }

  function ranked(scores) {
    var list = ORIENTATIONS.filter(function (o) { return scores[o.id]; });
    list.sort(function (a, b) { return scores[b.id] - scores[a.id]; });
    return list;
  }

  /* The reading: the fresh answer first, then whatever the clock and the zone suggest, then what
     is left of the last visit. `answer` may be null, which is what a visitor who has not been
     queried yet looks like. */
  function readingFor(answer) {
    var s = signals();
    var scores = {};
    add(scores, signalWeights(s), SIGNAL_PULL);
    add(scores, state.drift, memoryPull());
    if (answer) add(scores, answer, ANSWER_PULL);
    var order = ranked(scores);
    return {
      orientation: order[0] ? ORIENTATION_BY_ID[order[0].id] : null,
      alternates: order.slice(1, 4),
      scores: scores,
      signals: s,
      // Where the reading came from, which is worth saying out loud: a reading taken from the
      // clock alone is a guess the site has not earned yet, and should not be dressed up as one.
      source: answer ? 'answer' : 'signals'
    };
  }

  /* ---- the site re-skins itself ---------------------------------------------------------- */

  function transmogrify(orientation) {
    var root = document.documentElement;
    if (orientation) {
      root.setAttribute('data-mood', orientation.id);
    } else {
      root.removeAttribute('data-mood');
    }
    root.setAttribute('data-visit', state.visits > 1 ? 'returning' : 'first');
    var detail = { orientation: orientation ? orientation.id : null };
    try {
      window.dispatchEvent(new CustomEvent('threshold:reading', { detail: detail }));
    } catch (e) {
      /* older browsers get the attribute and nothing else, which is most of the effect */
    }
  }

  // The answer given on this page, if any, so every part of the page reports it as "read just now"
  // rather than as a reading carried over from memory.
  var lastAnswered = null;

  function record(answer) {
    var reading = readingFor(answer);
    var drift = {};
    add(drift, state.drift, memoryPull());
    if (answer) add(drift, answer, 1);
    state.drift = drift;
    state.orientation = reading.orientation ? reading.orientation.id : null;
    state.last = Date.now();
    save({ visits: state.visits, last: state.last, drift: state.drift,
           recent: state.recent, orientation: state.orientation });
    lastAnswered = reading.orientation ? reading : null;
    transmogrify(reading.orientation);
    return reading;
  }

  /* A mechanism counts as used the moment it is put in front of someone, answered or not. That is
     what makes "never the same way twice" true of a visitor who ignores the question as well as
     one who answers it. */
  function noteProbe(id) {
    if (state.recent[state.recent.length - 1] === id) return;
    state.recent = state.recent.concat([id]).slice(-RECENT);
    save({ visits: state.visits, last: state.last, drift: state.drift,
           recent: state.recent, orientation: state.orientation });
  }

  /* ---- choosing a mechanism -------------------------------------------------------------- */

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

  /* ---- rendering a query ----------------------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function mount(host, options) {
    if (!host) return null;
    var opts = options || {};
    var probe = opts.probe ? probeById(opts.probe) : nextProbe();
    if (!probe) return null;
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
    // Values that tick -- the seconds of a press, the samples of a line -- are shown here and not
    // in the live trace, so a screen reader is not read a stopwatch.
    var meter = el('p', 'probe-trace probe-meter');
    meter.setAttribute('aria-hidden', 'true');
    frame.appendChild(meter);
    trace.meter = meter;
    // Every mechanism can be declined. Skipping records nothing: the question still counts as
    // asked, so it is not asked the same way next time, and the reading is whatever it was.
    var skip = el('button', 'probe-option probe-skip', 'skip this');
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
      place: placeProbe, draw: drawProbe, slider: sliderProbe
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
      if (steps.length > 1) {
        body.appendChild(el('p', 'probe-count', (probe.quick ? 'pair ' : '') + (index + 1) + ' of ' + steps.length));
      }
      var first = group.querySelector('button');
      if (first && index > 0) first.focus();
    }
    step();
  }

  function sequenceProbe(probe, body, trace, answer, finish) {
    var items = Array.isArray(probe.items) ? probe.items.slice() : [];
    var target = Math.max(1, Math.min(items.length, probe.take || items.length));
    var picked = [];

    function remaining() {
      return items.filter(function (item) {
        return picked.indexOf(item) === -1;
      });
    }

    function scoreAndFinish() {
      for (var i = 0; i < picked.length; i++) {
        var item = picked[i];
        if (!item.slots || !item.slots[i]) continue;
        add(answer, item.slots[i], 1);
      }
      finish();
    }

    function redraw() {
      body.textContent = '';

      if (picked.length) {
        var order = picked.map(function (item) { return item.label; }).join(' \u2192 ');
        body.appendChild(el('p', 'probe-step', 'bench order: ' + order));
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
            if (picked.length >= target) {
              scoreAndFinish();
              return;
            }
            redraw();
          });
          group.appendChild(button);
        });

        body.appendChild(group);
      }

      var left = target - picked.length;
      body.appendChild(el('p', 'probe-count', left > 0 ? (left + ' to place') : 'reading order'));

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
        trace.textContent = 'order cleared';
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
    // A finger that drifts into a scroll cancels the press: stop counting and say so, rather
    // than leaving a timer running under a button that will never finish.
    button.addEventListener('pointercancel', function () {
      if (!started) return;
      started = 0;
      window.clearInterval(ticker);
      button.classList.remove('held');
      if (trace.meter) trace.meter.textContent = '';
      trace.textContent = 'let go early; press again';
    });
    // A keyboard holds too: keydown repeats while the key is down, keyup ends it.
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
    // application: a screen reader in browse mode passes the arrow keys through to the field.
    field.setAttribute('role', 'application');
    field.setAttribute('aria-label', 'a field to place one mark in: the arrow keys move the mark, enter leaves it there');
    field.tabIndex = 0;
    var mark = el('span', 'probe-mark');
    mark.hidden = true;
    field.appendChild(mark);
    var cursor = { x: 0.5, y: 0.5 };
    function place(x, y) {
      cursor.x = Math.min(1, Math.max(0, x));
      cursor.y = Math.min(1, Math.max(0, y));
      mark.hidden = false;
      mark.style.left = (cursor.x * 100) + '%';
      mark.style.top = (cursor.y * 100) + '%';
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
    var placed = false;
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
        mark.style.left = (cursor.x * 100) + '%';
        mark.style.top = (cursor.y * 100) + '%';
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
    // application, like the placement field, so the arrow keys reach the pad in browse mode too.
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
    // A keyboard draws too: each arrow adds a stroke in that direction, enter lifts the hand.
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
          var scale = (Math.sqrt(px * px + py * py) * Math.sqrt(dx * dx + dy * dy)) || 1;
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

  function sliderProbe(probe, body, trace, answer, finish) {
    var wrap = el('div', 'probe-dial');
    var input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = String(20 + Math.floor(Math.random() * 61)); // never starts in the same place
    input.id = 'probe-dial-' + probe.probe;
    var label = el('label', 'probe-dial-label', 'the dial starts somewhere random; put it where the room should be');
    label.setAttribute('for', input.id);
    wrap.appendChild(label);
    wrap.appendChild(el('span', 'probe-dial-end', probe.low));
    wrap.appendChild(input);
    wrap.appendChild(el('span', 'probe-dial-end', probe.high));
    var done = el('button', 'probe-option probe-undo', 'leave it there');
    done.type = 'button';
    input.addEventListener('input', function () {
      trace.textContent = 'the dial is somewhere it was not';
    });
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

  /* ---- the ribbon every page carries ----------------------------------------------------- */

  /* What the ribbon says about a reading, in words a stranger can use. A reading the visitor
     gave, or one carried over from an earlier answer, is said; the clock's own guess is not
     dressed up as a reading, because a site that asks before it offers does not offer first. */
  function describe(reading) {
    var o = reading && reading.orientation;
    var kept = store.persistent === false
      ? ' This browser keeps nothing, so the reading lasts for this page.'
      : '';
    if (!o || !reading.source || reading.source === 'signals') {
      return 'Nothing read yet. Answer one sideways question and the site suggests a world to '
        + 'start in, or take any world below.' + kept;
    }
    var line = o.name + ' — ' + o.pull + '. That opens onto ' + o.worldName + '.';
    if (reading.source === 'answer') return 'Read just now as ' + line + kept;
    return 'Carried over from your last answer: ' + line + kept;
  }

  function currentReading() {
    if (lastAnswered && state.orientation && lastAnswered.orientation.id === state.orientation) {
      return lastAnswered;
    }
    return state.orientation
      ? { orientation: ORIENTATION_BY_ID[state.orientation], source: 'memory', signals: signals() }
      : readingFor(null);
  }

  var askRibbon = null; // set by ribbon(), so moods.html can ask through the ribbon too

  // What the ribbon says while its question is open: what the question is for, and that nothing
  // depends on it.
  var ASKING_TEXT = 'Before it offers anything, this site asks one sideways question. Whatever '
    + 'you answer picks a world to suggest; every world stays open below either way.';

  function ribbon() {
    var host = document.getElementById('mood-ribbon');
    if (!host) return;
    var text = document.getElementById('mood-ribbon-text');
    var actions = host.querySelector('.mood-ribbon-actions');
    var ask = document.getElementById('mood-ribbon-ask');
    var go = document.getElementById('mood-ribbon-go');
    var probeHost = document.getElementById('mood-probe');
    var asking = false;

    /* The ribbon has five states, named on the element so the stylesheet can colour them:
       quiet (nothing read), answered (read just now), carried (an earlier answer), asking (the
       question is open) and the no-script default the layout writes. */
    function show(reading) {
      var r = reading || currentReading();
      var read = !!(r && r.orientation && r.source && r.source !== 'signals');
      // While the question is open the sentence frames it; the question carries its own skip, so
      // the ribbon's two controls step aside until it is answered or skipped.
      if (text) text.textContent = asking ? ASKING_TEXT : describe(r);
      if (actions) actions.hidden = asking;
      if (go) {
        if (read && !asking) {
          go.hidden = false;
          go.href = root + r.orientation.world;
          go.textContent = 'go to ' + r.orientation.worldName;
        } else {
          go.hidden = true;
        }
      }
      if (ask) {
        ask.hidden = false;
        ask.textContent = read ? 'ask another way' : 'ask me';
        ask.setAttribute('aria-expanded', asking ? 'true' : 'false');
      }
      host.setAttribute('data-asking', asking ? 'true' : 'false');
      host.setAttribute('data-state', asking ? 'asking' : (!read ? 'quiet' : (r.source === 'answer' ? 'answered' : 'carried')));
    }

    function close() {
      if (probeHost) {
        probeHost.textContent = '';
        probeHost.hidden = true;
      }
      asking = false;
      show();
    }

    function query() {
      if (!probeHost || asking) return;
      asking = true;
      probeHost.hidden = false;
      show();
      mount(probeHost, {
        onAnswer: function (reading) {
          probeHost.textContent = '';
          probeHost.hidden = true;
          asking = false;
          show(reading);
          if (go && !go.hidden) go.focus();
          else if (ask) ask.focus();
        },
        onSkip: function () {
          close();
          if (ask) ask.focus();
        }
      });
    }

    if (ask) {
      ask.addEventListener('click', function () {
        if (asking) {
          close();
          return;
        }
        query();
        // The ask button steps aside while the question is open, so focus moves into the
        // question: its first control, or the field or pad it asks for.
        var first = probeHost && probeHost.querySelector('button, input, [tabindex]');
        if (first && typeof first.focus === 'function') first.focus();
      });
    }

    // A reading taken anywhere else on the page -- the mood atlas runs mechanisms of its own, and
    // can forget -- is the ribbon's to report too.
    window.addEventListener('threshold:reading', function () {
      if (!asking) show();
    });

    askRibbon = query;
    show();
    // Live only from here on: the sentence written as the page loads is the page's, not news, and a
    // screen reader should hear the ribbon when it changes, not on every page a visitor opens.
    if (text) text.setAttribute('aria-live', 'polite');

    // The threshold asks unprompted: on arrival (a first visit, or a return after
    // ARRIVAL_GAP_MS), and whenever nothing has been read yet, because asking is what that page
    // is for. Every other page invites instead -- the question is one press away -- so a visitor
    // who followed a link to a world meets the world first.
    //
    // "Arrival" is read off the gap the shared document already records rather than a session
    // key of its own, because no page of this site touches the browser's storage directly.
    var threshold = document.documentElement.getAttribute('data-page') === 'index.html';
    var arrived = sinceLast === null || sinceLast > ARRIVAL_GAP_MS;
    if (threshold && (arrived || !state.orientation)) query();
  }

  /* ---- start ------------------------------------------------------------------------------ */

  state.visits += 1;
  // sinceLast already holds the gap before this arrival, so the stored timestamp can move to now:
  // what the next visit wants to know is how long it has been since this one.
  state.last = Date.now();
  transmogrify(state.orientation ? ORIENTATION_BY_ID[state.orientation] : null);
  save({ visits: state.visits, last: state.last, drift: state.drift,
         recent: state.recent, orientation: state.orientation });

  window.threshold = {
    orientations: function () { return ORIENTATIONS.slice(); },
    orientation: function (id) { return ORIENTATION_BY_ID[id] || null; },
    probes: function () {
      return PROBES.map(function (p) {
        return { probe: p.probe, name: p.name || p.probe, kind: p.kind, ask: p.ask };
      });
    },
    signals: signals,
    reading: currentReading,
    describe: describe,
    mount: mount,
    ask: function () { if (askRibbon) askRibbon(); },
    reducedMotion: reducedMotion,
    forget: function () {
      state = { visits: 1, last: null, drift: {}, recent: [], orientation: null };
      lastAnswered = null;
      sinceLast = null;
      store.remove(READING);
      transmogrify(null);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ribbon);
  } else {
    ribbon();
  }
})();
