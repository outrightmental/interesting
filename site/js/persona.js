/* The persona: one saved sky, one reading and one difficulty, configured in the sheet opened by
   the avatar.

   Three settings, kept under three names in the one local-state document (js/state.js) and shown
   as three sections of the one sheet:

     constellation   the sky a visitor places, which several worlds read, each its own way
     threshold       the reading the mood flow has taken, which suggests a world and dresses the
                     site (js/threshold.js keeps that one; this file only shows it)
     difficulty      how hard every puzzle on the site comes out, 1 (gentle) to 5 (fierce)

   A star's editable words give it a glint in both the portrait and the sheet. A short path
   through nearby thoughts makes those words readable together; choosing or moving a star changes
   the path. Sky cards follow the words without changing their seed; a puzzle already begun keeps
   its clues.

   The difficulty is advertised as specifically as the sky and settable from everywhere it is a
   dependency (issue #93), which is every piece on the site: `tuner(host)` below renders the one
   slider, the sheet puts it in its own section, and js/stage.js puts the same control on the
   stage beside the piece it is dealing. Unlike the sky it always holds a value -- the middle of
   the dial until a visitor moves it -- so nothing is ever powered down waiting for one: a piece
   is dealt at the setting that stands and the slider is offered in place.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var root = document.documentElement.getAttribute('data-root') || '';
  var SKY = 'constellation';
  var DIFFICULTY = 'difficulty';
  var MAX_STARS = 120;
  var SEED_COUNT = 7;
  var DRAG_SUPPRESS_MS = 250;
  // The dial, gentle to fierce, and the middle of it as the setting nobody has touched. A level
  // buys a piece 6 - level hints and a margin of 3 - level steps on a measured answer; the worlds'
  // modules read that off env.difficulty and js/stage.js documents it with the rest of the
  // contract. Five stops because a visitor can tell five apart and name them.
  var LEVELS = ['gentle', 'mild', 'fair', 'keen', 'fierce'];
  var DEFAULT_LEVEL = 3;
  var LEVEL_SAYS = [
    'five hints on a piece, and a measured answer may be two steps out',
    'four hints, and a measured answer may be one step out',
    'three hints, and a measured answer on the mark',
    'two hints, and a measured answer on the mark',
    'one hint, and a measured answer on the mark'
  ];
  var THOUGHTS = [
    'a door left ajar', 'the kettle, just off the boil', 'rain arriving sideways',
    'a lamp in a window across the way', 'an unanswered letter, kept', 'moss on the north side',
    'a tune with the middle missing', 'the long way home', 'one more look up',
    'a stone kept for no reason', 'a page half-turned', 'a machine running with nobody watching',
    'the tree in the courtyard, doing fine', 'a name nearly said', 'the smell before rain',
    'a small experiment, started anyway', 'the next draft, allowed to be playful',
    'a question that bends the room', 'room left for surprise', 'a quiet day, still progress',
    'the edge where ideas hatch', 'curiosity used as a compass', 'breathe, then build'
  ];
  var ASKING_TEXT = 'Before it offers anything, this site asks one sideways question. Whatever '
    + 'you answer picks a world to suggest; every world stays open below either way.';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function validStar(s) {
    return !!s && typeof s === 'object' && typeof s.x === 'number' && typeof s.y === 'number'
      && isFinite(s.x) && isFinite(s.y) && typeof s.text === 'string';
  }
  function cleanStar(s) {
    return { x: Number(clamp(s.x, 1, 99).toFixed(2)),
      y: Number(clamp(s.y, 1, 99).toFixed(2)), text: String(s.text).slice(0, 160) };
  }
  function clean(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(validStar).slice(0, MAX_STARS).map(cleanStar);
  }
  function holds(value) { return Array.isArray(value) && value.some(validStar); }
  function thought() { return THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)]; }
  function starGleam(text) {
    var code = 0;
    for (var i = 0; i < text.length; i++) code = (code * 31 + text.charCodeAt(i)) >>> 0;
    return 0.9 + (code % 4) * 0.15;
  }
  function seedSky(count) {
    var n = Math.max(1, Math.min(MAX_STARS, count || SEED_COUNT));
    var list = [];
    var start = Math.floor(Math.random() * THOUGHTS.length);
    for (var i = 0; i < n; i++) {
      var angle = i / n * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      var radius = 14 + Math.random() * 24;
      list.push({ x: Number(clamp(50 + Math.cos(angle) * radius, 8, 92).toFixed(2)),
        y: Number(clamp(48 + Math.sin(angle) * radius * 0.8, 12, 86).toFixed(2)),
        text: THOUGHTS[(start + i) % THOUGHTS.length] });
    }
    return list;
  }
  // What the persona reads an arrangement of stars as: a name and a one-line read, derived from
  // the geometry alone -- the count, the centre, the spread, the lean -- so moving one star can
  // rename the whole sky. Pure arithmetic on the list, nothing of the browser's, so it is safe
  // everywhere the refresh path runs.
  var SKY_ADJ = {
    high: ['high', 'risen', 'upper'],
    low: ['low', 'deep', 'harboured'],
    west: ['western', 'leaning', 'early'],
    east: ['eastern', 'turning', 'late'],
    mid: ['quiet', 'patient', 'even']
  };
  var SKY_NOUN = {
    one: ['lone star', 'first lamp', 'single wish'],
    two: ['gate of two', 'pair of lanterns', 'double knock'],
    knot: ['knot', 'ember', 'hive', 'clasp'],
    wide: ['river', 'bridge', 'shoreline', 'long road'],
    tall: ['stair', 'tower', 'rainfall', 'ladder'],
    scattered: ['archipelago', 'meadow', 'slow drift', 'orchard'],
    ring: ['crown', 'flock', 'garden', 'harbour']
  };
  function skyTraits(list) {
    var n = list.length;
    if (!n) return null;
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < n; i++) { cx += list[i].x; cy += list[i].y; }
    cx /= n;
    cy /= n;
    var sx = 0;
    var sy = 0;
    var spread = 0;
    var code = n;
    for (i = 0; i < n; i++) {
      var dx = list[i].x - cx;
      var dy = list[i].y - cy;
      sx += dx * dx;
      sy += dy * dy;
      spread += Math.sqrt(dx * dx + dy * dy);
      code = (code * 31 + Math.round(list[i].x / 7) * 53 + Math.round(list[i].y / 7)) >>> 0;
    }
    return { n: n, cx: cx, cy: cy, sx: Math.sqrt(sx / n), sy: Math.sqrt(sy / n),
      spread: spread / n, code: code };
  }
  function skyName(value) {
    var list = clean(value === undefined ? stars() : value);
    var t = skyTraits(list);
    if (!t) return '';
    if (t.n === 1) return 'the ' + SKY_NOUN.one[t.code % SKY_NOUN.one.length];
    var adj = t.cy < 40 ? SKY_ADJ.high : t.cy > 60 ? SKY_ADJ.low
      : t.cx < 40 ? SKY_ADJ.west : t.cx > 60 ? SKY_ADJ.east : SKY_ADJ.mid;
    var noun = t.n === 2 ? SKY_NOUN.two
      : t.spread < 15 ? SKY_NOUN.knot
        : t.sx > t.sy * 1.6 ? SKY_NOUN.wide
          : t.sy > t.sx * 1.6 ? SKY_NOUN.tall
            : t.spread > 30 ? SKY_NOUN.scattered : SKY_NOUN.ring;
    return 'the ' + adj[t.code % adj.length] + ' ' + noun[(t.code >>> 3) % noun.length];
  }
  function skyRead(value) {
    var list = clean(value === undefined ? stars() : value);
    var t = skyTraits(list);
    if (!t) return '';
    var count = t.n === 1 ? 'one star' : t.n + ' stars';
    var knit = t.spread < 15 ? 'close-knit' : t.spread > 30 ? 'flung wide' : 'evenly set';
    var ns = t.cy < 40 ? 'north' : t.cy > 60 ? 'south' : '';
    var ew = t.cx < 40 ? 'west' : t.cx > 60 ? 'east' : '';
    var where = ns && ew ? ns + '-' + ew : (ns || ew);
    return count + ', ' + knit + (where ? ', keeping to the ' + where : ', holding the middle of the sky');
  }
  function threadOf(list, start) {
    if (!list.length) return [];
    var at = start;
    if (!Number.isInteger(at) || at < 0 || at >= list.length) {
      var centre = skyTraits(list);
      var closest = Infinity;
      at = 0;
      for (var i = 0; i < list.length; i++) {
        var dx = (list[i].x - centre.cx) * 2;
        var dy = list[i].y - centre.cy;
        var distance = dx * dx + dy * dy;
        if (distance < closest) { closest = distance; at = i; }
      }
    }
    var path = [at];
    while (path.length < Math.min(3, list.length)) {
      var previous = list[path[path.length - 1]];
      var nearest = -1;
      var best = Infinity;
      for (var j = 0; j < list.length; j++) {
        if (path.indexOf(j) !== -1) continue;
        var x = (list[j].x - previous.x) * 2;
        var y = list[j].y - previous.y;
        var gap = x * x + y * y;
        if (gap < best) { best = gap; nearest = j; }
      }
      path.push(nearest);
    }
    return path;
  }
  function read() { return store ? store.read(SKY, []) : { status: 'unavailable', value: [] }; }
  function stars() { return clean(read().value); }
  var listeners = [];
  function onSky(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      for (var i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i] === fn) listeners.splice(i, 1);
      }
    };
  }
  function sameStars(a, b) {
    return a.length === b.length && a.every(function (star, i) {
      return star.x === b[i].x && star.y === b[i].y && star.text === b[i].text;
    });
  }
  function announce(list, how, kept) {
    refresh();
    // Readers receive independent snapshots; changing one must not change the saved sky.
    listeners.slice().forEach(function (fn) { fn(list.map(cleanStar), how, kept); });
    if (typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('persona:sky', {
        detail: { stars: list.map(cleanStar), how: how, kept: kept }
      }));
    }
  }
  function setStars(next, how) {
    if (!Array.isArray(next) || !next.every(validStar)) {
      throw new TypeError('A sky must be an array of stars.');
    }
    var list = clean(next);
    var saved = read();
    if (saved.status !== 'unreadable' && sameStars(clean(saved.value), list)) {
      return !!(store && saved.status === 'ok' && store.persistent !== false);
    }
    var kept = false;
    if (store) kept = list.length ? store.set(SKY, list) : store.remove(SKY);
    // Placed, moved, seeded, removed or cleared: the constellation was set, and if it was set in
    // the sheet it is handed over when the sheet closes (the hand-off, below).
    if (sheet && sheet.host.open) noteSet('sky', sheet.field);
    announce(list, how || 'placed', kept);
    return kept;
  }
  function addStar(star) {
    if (!validStar(star)) return false;
    var list = stars();
    if (list.length >= MAX_STARS) list.shift();
    list.push(cleanStar(star));
    return setStars(list, 'added');
  }
  function seed() { return setStars(seedSky(), 'seeded'); }
  function clear() { return setStars([], 'cleared'); }

  /* ---- the difficulty, and the one control that sets it ------------------------------------ */

  // A stored level, cleaned: an integer stop on the dial, or 0 for anything else.
  function levelOf(value) {
    var n = Math.round(Number(value));
    return isFinite(n) && n >= 1 && n <= LEVELS.length ? n : 0;
  }
  // The level the document holds, and whether the visitor has chosen it. Anything the dial cannot
  // be set to reads as unchosen rather than as broken -- unlike the sky, there is always a
  // difficulty, so there is nothing to explain to a visitor and nothing to repair.
  function readDifficulty() {
    var saved = store ? store.read(DIFFICULTY, DEFAULT_LEVEL) : { status: 'unavailable', value: DEFAULT_LEVEL };
    var level = saved.status === 'ok' ? levelOf(saved.value) : 0;
    return { level: level || DEFAULT_LEVEL, set: !!level };
  }
  /* The setting, as the stage hands it to a piece on env.difficulty and as the sheet shows it:
     { level, of, name, says, set }. Always a value -- the middle of the dial until a visitor moves
     it -- because nothing on this site waits on a difficulty to be set. */
  function difficulty() {
    var saved = readDifficulty();
    return { level: saved.level, of: LEVELS.length, name: LEVELS[saved.level - 1],
      says: LEVEL_SAYS[saved.level - 1], set: saved.set };
  }
  var tuned = [];
  function onDifficulty(fn) {
    if (typeof fn !== 'function') return function () {};
    tuned.push(fn);
    return function () {
      for (var i = tuned.length - 1; i >= 0; i--) {
        if (tuned[i] === fn) tuned.splice(i, 1);
      }
    };
  }
  function setDifficulty(level) {
    var want = levelOf(level) || DEFAULT_LEVEL;
    var before = difficulty().level;
    var kept = store ? store.set(DIFFICULTY, want) : false;
    if (sheet && sheet.host.open && before !== want) {
      noteSet('difficulty', sheet.tune && sheet.tune.querySelector('input'));
    }
    var now = difficulty();
    for (var i = 0; i < tuned.length; i++) {
      try { tuned[i](now, kept); }
      catch (e) { console.error('A difficulty listener failed', e); }
    }
    window.dispatchEvent(new CustomEvent('persona:difficulty', { detail: { difficulty: now, kept: kept } }));
    refresh();
    return kept;
  }
  function describeDifficulty() {
    var d = difficulty();
    return 'Puzzles are set to ' + d.name + ': ' + d.says + '.';
  }
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  var tunerCount = 0;
  /* The one difficulty control, rendered into `host` wherever a part depends on the setting: the
     sheet's own section, and the stage beside the piece it is dealing. The M3 slider the rest of
     the site uses (input[type=range] in a .row, _sass/_controls.scss), named by a real <label>,
     read out by name rather than by number (aria-valuetext) and operated by the keyboard the way
     every slider on this site is -- the browser's own arrows, Home and End.

     options, all optional: label (the words beside it), note (one line under it, for a host that
     has not said what the setting is), onChange(difficulty, kept) once a new level is kept.
     Hands back a function that takes the control away again. */
  function tuner(host, options) {
    if (!host || typeof host.appendChild !== 'function') return function () {};
    var opts = options || {};
    tunerCount += 1;
    var id = 'difficulty-' + tunerCount;
    host.textContent = '';
    host.classList.add('difficulty');
    var row = element('div', 'row difficulty-row');
    var label = element('label', 'difficulty-label', opts.label || 'difficulty');
    label.setAttribute('for', id);
    var input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.className = 'difficulty-slider';
    input.min = '1';
    input.max = String(LEVELS.length);
    input.step = '1';
    var status = element('p', 'panel-status difficulty-status');
    status.id = id + '-status';
    status.setAttribute('aria-live', 'polite');
    input.setAttribute('aria-describedby', status.id);
    row.appendChild(label);
    row.appendChild(element('span', 'difficulty-end', LEVELS[0]));
    row.appendChild(input);
    row.appendChild(element('span', 'difficulty-end', LEVELS[LEVELS.length - 1]));
    host.appendChild(row);
    if (opts.note) host.appendChild(element('p', 'panel-note difficulty-note', opts.note));
    host.appendChild(status);

    function paint(level) {
      var at = levelOf(level) || DEFAULT_LEVEL;
      input.value = String(at);
      input.setAttribute('aria-valuetext', LEVELS[at - 1]);
      // How full the track is: js/site.js keeps every slider on the site painted this way, and a
      // slider drawn by a script is painted here so it is right on its first frame.
      input.style.setProperty('--range-pct', ((at - 1) / (LEVELS.length - 1) * 100).toFixed(2) + '%');
      return at;
    }
    function say(level, kept) {
      var at = levelOf(level) || DEFAULT_LEVEL;
      status.textContent = 'Puzzles are set to ' + LEVELS[at - 1] + ': ' + LEVEL_SAYS[at - 1] + '.'
        + (kept === false ? ' Kept for this page only: this browser stores nothing between visits.' : '');
    }
    paint(difficulty().level);
    say(difficulty().level, store && store.persistent ? undefined : false);
    // Live while it is dragged, kept when it is let go: one write and one piece dealt again per
    // setting, not one per pixel the handle crosses.
    input.addEventListener('input', function () {
      var at = paint(input.value);
      say(at, undefined);
    });
    function keep() {
      var at = levelOf(input.value) || DEFAULT_LEVEL;
      if (at === difficulty().level) { say(at, store && store.persistent ? undefined : false); return; }
      var kept = setDifficulty(at);
      say(at, kept);
      if (typeof opts.onChange === 'function') opts.onChange(difficulty(), kept);
    }
    input.addEventListener('change', keep);
    var release = onDifficulty(function (now, kept) {
      if (levelOf(input.value) === now.level) return; // this control's own change, already said
      paint(now.level);
      say(now.level, kept);
    });
    return function () {
      release();
      if (host.contains(row)) host.textContent = '';
      host.classList.remove('difficulty');
    };
  }
  function drawSky(ctx, list, w, h, pad, dotRadius, lineWidth, route) {
    var path = route || threadOf(list);
    var points = list.map(function (s) {
      return { x: pad + s.x / 100 * (w - pad * 2), y: pad + s.y / 100 * (h - pad * 2) };
    });
    var maxDistanceSq = Math.pow(Math.min(w, h) * 0.3, 2);
    var used = Object.create(null);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    for (var i = 0; i < points.length; i++) {
      var nearest = [];
      for (var j = 0; j < points.length; j++) {
        if (i === j) continue;
        var dx = points[j].x - points[i].x;
        var dy = points[j].y - points[i].y;
        var d2 = dx * dx + dy * dy;
        if (d2 <= maxDistanceSq) nearest.push({ j: j, d2: d2 });
      }
      nearest.sort(function (a, b) { return a.d2 - b.d2; });
      for (var k = 0; k < Math.min(2, nearest.length); k++) {
        var a = Math.min(i, nearest[k].j);
        var b = Math.max(i, nearest[k].j);
        var key = a + '-' + b;
        if (used[key]) continue;
        used[key] = true;
        ctx.globalAlpha = 0.14 + (1 - nearest[k].d2 / maxDistanceSq) * 0.5;
        ctx.strokeStyle = 'currentColor';
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
    }
    if (path.length > 1) {
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = lineWidth * 2.8;
      ctx.strokeStyle = 'currentColor';
      ctx.beginPath();
      for (var r = 0; r < path.length; r++) {
        var point = points[path[r]];
        if (r) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (var p = 0; p < points.length; p++) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(236, 244, 255, 0.96)';
      ctx.arc(points[p].x, points[p].y, dotRadius * starGleam(list[p].text)
        * (path.indexOf(p) === -1 ? 1 : 1.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function sizeCanvas(canvas, w, h) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  var card = null;
  var sheet = null;
  var askingInCard = false;
  function reading() {
    var t = window.threshold;
    return t && typeof t.reading === 'function' ? t.reading() : null;
  }
  function readOf(r) { return !!(r && r.orientation && r.source && r.source !== 'signals'); }
  function describeReading(r) {
    var t = window.threshold;
    return t && typeof t.describe === 'function' ? t.describe(r) : '';
  }
  function keptClause() {
    return store && store.persistent === false
      ? ' This browser keeps nothing between visits, so your persona lasts for this page.' : '';
  }
  function describeSky(saved, list) {
    if (list.length) return 'Your sky reads as ' + skyName(list) + ': ' + skyRead(list) + '.';
    if (saved.status === 'unreadable') return 'What this browser kept of your sky cannot be read, so it starts fresh.';
    return 'No stars yet.';
  }
  function cardText(saved, list, r) {
    if (askingInCard) return ASKING_TEXT;
    if (!list.length && !readOf(r) && saved.status !== 'unreadable') {
      return 'No persona yet. Yours is a small sky you place star by star, one sideways question '
        + 'you answer, and the difficulty every puzzle on this site is dealt at: several worlds '
        + 'read the stars, each its own way, the answer picks a world to suggest, and the '
        + 'difficulty says how much a piece will show you. ' + describeDifficulty()
        + ' Set it up here, or take any world below.' + keptClause();
    }
    // Joined rather than concatenated: the reading says nothing at all until there is one, and
    // two sentences with an empty one between them used to read with a gap in the middle.
    return [describeSky(saved, list), describeReading(r), describeDifficulty()]
      .filter(function (part) { return !!part; }).join(' ') + keptClause();
  }
  function refresh() {
    if (!card) return;
    var saved = read();
    var list = clean(saved.value);
    var r = reading();
    var isRead = readOf(r);
    var sentence = cardText(saved, list, r);
    if (card.text.textContent !== sentence) card.text.textContent = sentence;
    card.host.setAttribute('data-state', askingInCard ? 'asking' : (!list.length && !isRead ? 'empty' : 'ready'));
    card.host.setAttribute('data-reading', !isRead ? 'none' : (r.source === 'answer' ? 'answered' : 'carried'));
    card.host.setAttribute('data-asking', askingInCard ? 'true' : 'false');
    card.host.setAttribute('data-sky', list.length ? 'set' : 'none');
    card.host.setAttribute('data-difficulty', difficulty().name);
    card.open.hidden = false;
    var label = list.length || isRead ? 'open persona' : 'set up persona';
    var named = list.length ? skyName(list) : '';
    if (card.label) card.label.textContent = named || label;
    else card.open.textContent = named || label;
    if (named) card.open.setAttribute('aria-label', label + ': ' + named);
    else card.open.removeAttribute('aria-label');
    if (card.portrait) {
      var size = card.portraitSize;
      var ctx = sizeCanvas(card.portrait, size, size);
      if (ctx && list.length) drawSky(ctx, list, size, size, size * 0.15, size * 0.032, size * 0.018);
    }
    if (sheet && sheet.host.open) {
      if (!sameStars(serialize(), list)) renderField();
      renderReading();
    }
  }
  function askInCard() {
    var t = window.threshold;
    if (!card || !card.probe || !t || typeof t.mount !== 'function' || askingInCard) return;
    if (sheet && sheet.host.open) closeSheet();
    askingInCard = true;
    card.probe.hidden = false;
    refresh();
    t.mount(card.probe, {
      onAnswer: function () { stopAskingInCard(true); card.open.focus(); },
      onSkip: function () { stopAskingInCard(true); card.open.focus(); }
    });
    var first = card.probe.querySelector('button, input, [tabindex]');
    if (first && typeof first.focus === 'function') first.focus();
  }
  // `closing` says the question is going away because it was finished, which is the persona closing
  // and the moment the hand-off below belongs to. Without it the question is only being put aside,
  // as openSheet does when the sheet opens over it, and nothing is being handed anywhere.
  function stopAskingInCard(closing) {
    if (!askingInCard) return;
    askingInCard = false;
    if (card && card.probe) {
      card.probe.textContent = '';
      card.probe.hidden = true;
    }
    refresh();
    if (closing) handOff();
  }
  function buildCard() {
    var host = document.getElementById('persona');
    if (!host) return;
    card = {
      host: host, text: document.getElementById('persona-text'),
      open: document.getElementById('persona-open'), label: host.querySelector('.persona-label'),
      probe: document.getElementById('persona-probe'), portrait: document.getElementById('persona-portrait')
    };
    if (!card.text || !card.open) { card = null; return; }
    card.portraitSize = card.portrait && Number(card.portrait.getAttribute('width')) || 40;
    card.open.addEventListener('click', function () { openSheet('sky', card.open); });
    card.text.setAttribute('aria-live', 'polite');
    refresh();
  }

  /* ---- the hand-off: what was just set, going home to the avatar --------------------------- */

  /* A visitor sets something in the persona, the persona closes, and nothing says where the thing
     they just set now lives. So it is handed over on the way out: one small mark leaves the control
     that was set, flies across the page to the portrait in the corner, sinks into it and blooms a
     ring around it as it lands. That is the whole sentence the animation says -- "that thing you
     just configured lives there, in that menu" (issue #94) -- and it is said in the one place a
     visitor is looking at the moment they would otherwise lose it.

     Three decisions the issue left open, and the answers written here:
       Only when something was set. A close that changed nothing has nothing to point at, and a
       flourish on every close is one a visitor stops reading by the third time.
       One mark, for the last thing set. The sentence is singular, and two marks racing in would be
       noise rather than an answer.
       Each setting carries its own mark. The same flight, its own glyph: the sky sends a star and
       the reading sends the half-lit disc the palette it dresses the site in is read off. A third
       setting -- the difficulty of issue #93 -- is one more line of MARKS and one more noteSet().

     Where it is drawn, and when. The mark is a child of the avatar's own corner (.persona), so it
     needs no layer of its own, it lands wherever the portrait happens to be at whatever size, and
     if a visitor opens the logo while it is still in the air it goes still with everything else
     behind the veil, which is the site's own law about the lightbox rather than an exception to it.
     It flies once the sheet is closed and the veil is down -- with the veil coming down and not
     against it -- so it crosses a page the visitor has back. It takes no press and says nothing to
     a screen reader: the one sentence beside the avatar already says where things stand, and this
     is the picture of it.

     A visitor who asked for less motion gets the result without the movement: the mark is laid on
     the portrait, held there, and taken away again. That is what the stage's own small mark does
     with the same query (.stage-reject and its is-still), and the class is written here off the
     query so the script and _sass/_persona.scss cannot fall out of step. */
  var MARKS = { sky: '✦', reading: '◐' }; // the glyph each setting sends home
  MARKS.difficulty = '◇';
  var FLIGHT_MS = 520; // the flight, as long as _sass/_persona.scss animates it for
  var STILL_MS = 260; // how long the mark is simply held on the portrait instead, with less motion
  var calmer = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var carried = null; // { kind, from }: what was set while the persona was open, and where from
  var flightTimer = null;
  var flying = null; // the one mark in the air, so a second close never leaves the first behind

  function stillness() { return !!(calmer && calmer.matches); }

  /* Where a mark leaves from: the middle of the control that was set, in the viewport, measured
     while it is still on screen. The sheet is shut by the time the mark flies and a shut dialog has
     no box to ask, so this is read when the setting is made and not when it is handed over. The
     middle of the screen for a control with no box to measure, so the flight is never a mark that
     merely appears on the portrait with nothing said about where it came from. */
  function leavesFrom(node) {
    var box = node && typeof node.getBoundingClientRect === 'function'
      ? node.getBoundingClientRect() : null;
    if (box && (box.width || box.height)) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    return { x: (window.innerWidth || 0) / 2, y: (window.innerHeight || 0) / 2 };
  }

  /* One of the persona's settings was just set, there. Only ever called while the persona is open:
     a star a world's own meteor adds, or a sky seeded to power a page up, is not something a
     visitor just did in a menu they are watching close. */
  function noteSet(kind, node) {
    if (!MARKS[kind]) return;
    carried = { kind: kind, from: leavesFrom(node) };
  }

  function sweep() {
    window.clearTimeout(flightTimer);
    flightTimer = null;
    if (flying) flying.remove();
    flying = null;
  }

  /* The persona is closing: whatever was set while it was open goes home to the portrait. */
  function handOff() {
    var set = carried;
    carried = null;
    if (!set || !card || !card.open || !card.portrait) return;
    var seat = card.portrait.parentNode || card.portrait; // the round frame the sky is drawn in
    var corner = card.host.getBoundingClientRect();
    var home = seat.getBoundingClientRect();
    var x = home.left + home.width / 2;
    var y = home.top + home.height / 2;
    var still = stillness();
    var mark = document.createElement('span');
    mark.className = 'persona-flight';
    mark.setAttribute('aria-hidden', 'true');
    mark.setAttribute('data-mark', set.kind);
    mark.textContent = MARKS[set.kind];
    // Placed where it lands rather than where it starts: the mark is the portrait's, and the whole
    // of the flight is one transform away from the place it belongs.
    mark.style.setProperty('left', Math.round(x - corner.left) + 'px');
    mark.style.setProperty('top', Math.round(y - corner.top) + 'px');
    if (still) mark.classList.add('is-still');
    else {
      mark.style.setProperty('--persona-flight-x', Math.round(set.from.x - x) + 'px');
      mark.style.setProperty('--persona-flight-y', Math.round(set.from.y - y) + 'px');
    }
    sweep();
    flying = mark;
    card.host.appendChild(mark);
    flightTimer = window.setTimeout(sweep, still ? STILL_MS : FLIGHT_MS);
  }

  var fieldStars = [];
  var selected = -1;
  var activeDrag = null;
  var suppressClickUntil = 0;
  var openedBy = null;
  var sheetWasOpen = false;
  var sheetBox = null;
  function sheetStatus(text) { if (sheet && sheet.status) sheet.status.textContent = text; }
  function fieldIntro(list) {
    if (!list.length) return 'No stars yet. Seed a small sky or drop a star to begin.';
    return list.length + ' star' + (list.length === 1 ? ' is' : 's are') + ' placed. The cards that read this sky follow your changes.';
  }
  function renderNeighbor() {
    if (!sheet || !sheet.neighbor || selected < 0 || !fieldStars[selected]) return;
    var path = threadOf(fieldStars, selected);
    var line = path.length < 2 ? 'Place another star to see which thought comes next.'
      : 'Next thought: "' + (fieldStars[path[1]].text || 'a star without words')
        + '". Move this star to change which thought comes next.';
    if (sheet.neighbor.textContent !== line) sheet.neighbor.textContent = line;
  }
  function keptNote(kept) {
    return kept || !store || store.persistent ? '' : ' Kept for this page only: this browser stores nothing between visits.';
  }
  function placeElement(star) {
    if (!star.el) return;
    star.el.style.left = 'calc(22px + ' + star.x + '% - ' + (star.x * 0.44).toFixed(2) + 'px)';
    star.el.style.top = 'calc(22px + ' + star.y + '% - ' + (star.y * 0.44).toFixed(2) + 'px)';
    star.el.style.setProperty('--star-gleam', String(starGleam(star.text)));
  }
  // The name under the field follows each move, including a drag.
  function renderName() {
    if (!sheet || !sheet.name) return;
    var list = serialize();
    var named = skyName(list);
    sheet.name.textContent = named ? '✦ ' + named + ' — ' + skyRead(list) : '';
    sheet.name.hidden = !named;
  }
  function renderThread() {
    var path = threadOf(fieldStars, selected);
    for (var i = 0; i < fieldStars.length; i++) {
      if (!fieldStars[i].el) continue;
      var place = path.indexOf(i);
      if (place < 0) fieldStars[i].el.removeAttribute('data-thread');
      else fieldStars[i].el.setAttribute('data-thread', String(place + 1));
    }
    if (sheet && sheet.thread) {
      var words = path.length < 2 ? '' : path.map(function (index) {
        var text = fieldStars[index].text.trim();
        return text ? '“' + text + '”' : 'a star without words';
      }).join(' → ');
      sheet.thread.hidden = !words;
      if (sheet.thread.textContent !== words) sheet.thread.textContent = words;
    }
    return path;
  }
  function namedLine() {
    var named = skyName(serialize());
    return named ? ' Your sky reads as ' + named + ' now.' : '';
  }
  function drawField() {
    renderName();
    var path = renderThread();
    renderNeighbor();
    if (!sheet || !sheet.field || !sheet.canvas) return;
    var box = sheet.field.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ctx = sizeCanvas(sheet.canvas, box.width, box.height);
    if (ctx) drawSky(ctx, fieldStars, box.width, box.height, 22, 0, 1.1, path);
  }
  function select(index) {
    var changed = selected !== index;
    selected = index;
    for (var i = 0; i < fieldStars.length; i++) {
      if (fieldStars[i].el) {
        fieldStars[i].el.classList.toggle('selected', i === index);
        fieldStars[i].el.setAttribute('aria-pressed', i === index ? 'true' : 'false');
      }
    }
    if (sheet.remove) sheet.remove.hidden = index < 0;
    if (sheet.wordsForm) sheet.wordsForm.hidden = index < 0;
    if (index >= 0) {
      if (changed && sheet.words) sheet.words.value = fieldStars[index].text;
      sheetStatus('✦ ' + fieldStars[index].text + ' (' + (index + 1) + ' of ' + fieldStars.length + ')');
    }
    drawField();
  }
  function focusStar(index) {
    var star = fieldStars[index];
    var target = star && star.el ? star.el : sheet.drop;
    if (target) target.focus();
  }
  function pointInField(clientX, clientY) {
    var box = sheet.field.getBoundingClientRect();
    return { x: clamp((clientX - box.left - 22) / Math.max(1, box.width - 44) * 100, 1, 99),
      y: clamp((clientY - box.top - 22) / Math.max(1, box.height - 44) * 100, 1, 99) };
  }
  function serialize() { return fieldStars.map(function (s) { return { x: s.x, y: s.y, text: s.text }; }); }
  function starLabel(star) { return 'star: ' + star.text + '. Arrow keys move it.'; }
  function createStarElement(star, index) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'persona-star';
    el.setAttribute('aria-label', starLabel(star));
    el.setAttribute('aria-pressed', 'false');
    star.el = el;
    placeElement(star);
    el.addEventListener('focus', function () { select(index); });
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (Date.now() < suppressClickUntil) return;
      select(index);
    });
    el.addEventListener('pointerdown', function (ev) {
      if (activeDrag || (typeof ev.button === 'number' && ev.button !== 0)) return;
      ev.preventDefault();
      ev.stopPropagation();
      activeDrag = { index: index, pointerId: ev.pointerId, moved: false };
      el.focus();
      select(index);
      if (el.setPointerCapture) {
        try { el.setPointerCapture(ev.pointerId); }
        catch (e) { console.error('Could not hold the star while dragging', e); }
      }
      el.classList.add('dragging');
    });
    el.addEventListener('lostpointercapture', function (ev) { endDrag(ev.pointerId); });
    el.addEventListener('keydown', function (ev) {
      var step = ev.shiftKey ? 6 : 2;
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        star.x = Number(clamp(star.x + moves[ev.key][0], 1, 99).toFixed(2));
        star.y = Number(clamp(star.y + moves[ev.key][1], 1, 99).toFixed(2));
        placeElement(star);
        var kept = setStars(serialize(), 'moved');
        drawField();
        select(index);
        sheetStatus('Moved.' + namedLine() + keptNote(kept));
      } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        removeStar(index);
      }
    });
    sheet.field.appendChild(el);
  }
  function renderField() {
    if (!sheet || !sheet.field) return;
    for (var i = 0; i < fieldStars.length; i++) if (fieldStars[i].el) fieldStars[i].el.remove();
    activeDrag = null;
    var saved = read();
    fieldStars = clean(saved.value).map(function (s) { return { x: s.x, y: s.y, text: s.text, el: null }; });
    for (var j = 0; j < fieldStars.length; j++) createStarElement(fieldStars[j], j);
    select(-1);
    sheetStatus(saved.status === 'unreadable'
      ? 'What this browser kept of your sky cannot be read, so it starts fresh. Tap the sky to place a star.'
      : fieldIntro(fieldStars) + keptNote(true));
  }
  function removeStar(index) {
    if (index < 0 || index >= fieldStars.length) return;
    var gone = fieldStars[index].text;
    var list = serialize();
    list.splice(index, 1);
    var kept = setStars(list, 'removed');
    focusStar(0);
    sheetStatus('Removed the star that said: ' + gone + '. ' + fieldIntro(fieldStars) + keptNote(kept));
  }
  function endDrag(pointerId) {
    if (!activeDrag || activeDrag.pointerId !== pointerId) return;
    var drag = activeDrag;
    activeDrag = null;
    var star = fieldStars[drag.index];
    if (star && star.el) {
      star.el.classList.remove('dragging');
      if (star.el.releasePointerCapture) {
        try { star.el.releasePointerCapture(pointerId); }
        catch (e) { console.error('Could not release the dragged star', e); }
      }
    }
    if (drag.moved) {
      suppressClickUntil = Date.now() + DRAG_SUPPRESS_MS;
      var kept = setStars(serialize(), 'moved');
      sheetStatus('Moved.' + namedLine() + keptNote(kept));
    }
  }
  function renderReading() {
    if (!sheet || !sheet.reading) return;
    var r = reading();
    var isRead = readOf(r);
    sheet.reading.textContent = describeReading(r) + keptClause();
    if (sheet.forget) sheet.forget.hidden = !isRead;
    if (sheet.readingGo) {
      if (isRead) {
        sheet.readingGo.hidden = false;
        sheet.readingGo.href = root + r.orientation.world;
        sheet.readingGo.textContent = r.orientation.worldName;
      } else sheet.readingGo.hidden = true;
    }
  }
  function renderSheet() { renderField(); renderReading(); }
  function openSheet(section, opener) {
    if (!sheet) return;
    stopAskingInCard();
    if (!sheet.host.open) {
      openedBy = opener || document.activeElement || (card && card.open);
      // A fresh visit: only what is set from here on is handed over on the way out, and a mark
      // still in the air from the last visit is taken away rather than stilled behind the veil.
      carried = null;
      sweep();
      if (sheetBox) sheetBox.up();
      if (typeof sheet.host.showModal === 'function') sheet.host.showModal();
      else { sheet.host.setAttribute('open', ''); sheet.host.classList.add('persona-sheet-fallback'); }
      sheetWasOpen = true;
    }
    renderSheet();
    var target = section === 'reading' ? sheet.ask
      : section === 'difficulty' ? (sheet.tune && sheet.tune.querySelector('input'))
        : (sheet.field.querySelector('.persona-star') || sheet.drop);
    if (!target) target = sheet.field.querySelector('.persona-star') || sheet.drop;
    if (target && typeof target.focus === 'function') target.focus();
    sheet.host.scrollTop = 0;
  }
  function closeSheet() {
    if (!sheet) return;
    if (sheet.host.open) {
      if (typeof sheet.host.close === 'function') sheet.host.close();
      else sheet.host.removeAttribute('open');
    }
    onSheetClosed();
  }
  function onSheetClosed() {
    if (!sheet || sheet.host.open || !sheetWasOpen) return;
    sheetWasOpen = false;
    activeDrag = null;
    sheet.host.classList.remove('persona-sheet-fallback');
    if (sheetBox) sheetBox.down();
    refresh();
    var back = openedBy;
    openedBy = null;
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    else if (card && card.open) card.open.focus();
    // Last of all, and after the veil has gone: the mark crosses a page the visitor has back, and
    // nothing about the focus coming home waits on an animation.
    handOff();
  }
  function buildSheet() {
    var host = document.getElementById('persona-sheet');
    if (!host) return;
    sheet = {
      host: host, close: document.getElementById('persona-close'), field: document.getElementById('persona-sky'),
      canvas: host.querySelector('.persona-sky-canvas'), drop: document.getElementById('persona-drop'),
      seed: document.getElementById('persona-seed'), remove: document.getElementById('persona-remove'),
      clear: document.getElementById('persona-clear'), status: document.getElementById('persona-sky-status'),
      name: document.getElementById('persona-sky-name'),
      thread: document.getElementById('persona-thread'),
      wordsForm: document.getElementById('persona-star-words'),
      words: document.getElementById('persona-star-thought'),
      neighbor: document.getElementById('persona-star-neighbor'),
      reading: document.getElementById('persona-reading'), ask: document.getElementById('persona-ask'),
      forget: document.getElementById('persona-forget'), readingGo: document.getElementById('persona-reading-go'),
      tune: document.getElementById('persona-difficulty')
    };
    if (!sheet.field) { sheet = null; return; }
    // The third setting, in its own section: the same control the stage puts beside a piece, so a
    // visitor meets one slider wherever they meet the setting.
    if (sheet.tune) tuner(sheet.tune, { label: 'difficulty' });
    var shell = window.interestingSite;
    if (shell && typeof shell.lightbox === 'function') {
      sheetBox = shell.lightbox({ name: 'persona', keep: host, onPress: closeSheet });
    }
    if (sheet.close) sheet.close.addEventListener('click', closeSheet);
    host.addEventListener('close', onSheetClosed);
    host.addEventListener('click', function (ev) {
      if (ev.target !== host) return;
      var box = host.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) closeSheet();
    });
    document.addEventListener('keydown', function (ev) {
      if (!host.open || typeof host.showModal === 'function'
          || document.documentElement.getAttribute('data-lightbox') === 'are-you-sure') return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        closeSheet();
        return;
      }
      if (ev.key !== 'Tab') return;
      var controls = host.querySelectorAll('button, a[href], input:not([disabled])');
      var reachable = [];
      for (var i = 0; i < controls.length; i++) {
        var control = controls[i];
        if (control.disabled) continue;
        var visible = true;
        for (var parent = control; parent && parent !== host; parent = parent.parentNode) {
          if (parent.hidden) { visible = false; break; }
        }
        if (visible) reachable.push(control);
      }
      if (!reachable.length) return;
      var first = reachable[0];
      var last = reachable[reachable.length - 1];
      if (reachable.indexOf(document.activeElement) === -1) {
        (ev.shiftKey ? last : first).focus();
        ev.preventDefault();
      } else if (ev.shiftKey && document.activeElement === first) {
        last.focus();
        ev.preventDefault();
      } else if (!ev.shiftKey && document.activeElement === last) {
        first.focus();
        ev.preventDefault();
      }
    });
    sheet.field.addEventListener('click', function (ev) {
      if (Date.now() < suppressClickUntil) return;
      if (ev.target !== sheet.field && ev.target !== sheet.canvas) return;
      var point = pointInField(ev.clientX, ev.clientY);
      var words = thought();
      var kept = addStar({ x: point.x, y: point.y, text: words });
      focusStar(fieldStars.length - 1);
      sheetStatus('✦ ' + words + namedLine() + keptNote(kept));
    });
    document.addEventListener('pointermove', function (ev) {
      if (!activeDrag || activeDrag.pointerId !== ev.pointerId) return;
      var star = fieldStars[activeDrag.index];
      if (!star) return;
      var point = pointInField(ev.clientX, ev.clientY);
      var x = Number(point.x.toFixed(2));
      var y = Number(point.y.toFixed(2));
      if (star.x === x && star.y === y) return;
      activeDrag.moved = true;
      star.x = x;
      star.y = y;
      placeElement(star);
      setStars(serialize(), 'moved');
      drawField();
    });
    document.addEventListener('pointerup', function (ev) { endDrag(ev.pointerId); });
    document.addEventListener('pointercancel', function (ev) { endDrag(ev.pointerId); });
    if (sheet.drop) sheet.drop.addEventListener('click', function () {
      var words = thought();
      var kept = addStar({ x: 50 + (Math.random() - 0.5) * 30,
        y: 50 + (Math.random() - 0.5) * 30, text: words });
      focusStar(fieldStars.length - 1);
      sheetStatus('✦ ' + words + namedLine() + ' Drag it where it belongs.' + keptNote(kept));
    });
    function seedTheSky() {
      var kept = seed();
      focusStar(0);
      sheetStatus('Seeded ' + fieldStars.length + ' stars.' + namedLine() + ' Drag them into a shape, or tap the sky for more.' + keptNote(kept));
    }
    if (sheet.seed) sheet.seed.addEventListener('click', function () {
      if (!fieldStars.length) { seedTheSky(); return; }
      window.interestingSite.areYouSure({
        what: 'seed a fresh sky over the one you have placed',
        detail: 'The ' + fieldStars.length + ' star' + (fieldStars.length === 1 ? '' : 's')
          + ' you placed would go, and ' + SEED_COUNT + ' new ones would take their place.',
        confirm: 'seed a fresh sky', opener: sheet.seed, onConfirm: seedTheSky,
        onCancel: function () { sheetStatus('Kept as it was.'); }
      });
    });
    if (sheet.wordsForm && sheet.words) sheet.wordsForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (selected < 0 || !fieldStars[selected]) {
        sheetStatus('Choose a star to give it words.');
        return;
      }
      var words = sheet.words.value.trim();
      if (!words) {
        sheetStatus('Write a thought before keeping it.');
        sheet.words.focus();
        return;
      }
      var star = fieldStars[selected];
      star.text = words.slice(0, 160);
      sheet.words.value = star.text;
      if (star.el) star.el.setAttribute('aria-label', starLabel(star));
      placeElement(star);
      var kept = setStars(serialize(), 'worded');
      drawField();
      sheetStatus('This star now carries: "' + star.text + '". The cards that read your sky follow these words.' + keptNote(kept));
    });
    if (sheet.remove) sheet.remove.addEventListener('click', function () {
      if (selected >= 0) removeStar(selected);
    });
    if (sheet.clear) window.interestingSite.destructive(sheet.clear, {
      what: 'clear your constellation',
      detail: function () {
        return 'The ' + fieldStars.length + ' star' + (fieldStars.length === 1 ? '' : 's')
          + ' you placed would go, and every world that reads it would read nothing until you place more.';
      },
      when: function () { return fieldStars.length > 0; },
      onConfirm: function () {
        if (!fieldStars.length) { sheetStatus('The sky is already empty.'); return; }
        var kept = clear();
        sheetStatus('Cleared. ' + fieldIntro(fieldStars) + keptNote(kept));
        if (sheet.drop) sheet.drop.focus();
      },
      onCancel: function () { sheetStatus('Kept as it was.'); }
    });
    if (sheet.ask) sheet.ask.addEventListener('click', function (ev) {
      if (!card || !card.probe) return;
      ev.preventDefault();
      closeSheet();
      askInCard();
    });
    if (sheet.forget) window.interestingSite.destructive(sheet.forget, {
      what: 'forget what this site has read about you',
      detail: 'The orientation it arrived at would go, and the palette the site is wearing with it. Your stars stay. It asks again whenever you like.',
      onConfirm: function () {
        var t = window.threshold;
        if (t && typeof t.forget === 'function') t.forget();
        renderReading();
        refresh();
        if (sheet.reading) sheet.reading.textContent = 'The reading is forgotten. Your stars stay.';
        if (sheet.ask) sheet.ask.focus();
      },
      onCancel: renderReading
    });
    window.addEventListener('resize', function () { if (sheet.host.open) drawField(); });
  }
  function start() {
    buildCard();
    buildSheet();
    window.addEventListener('threshold:reading', function () {
      // The reading is a setting of the persona like the sky is, so it is noted here while the
      // persona is still open and the control that set it still has a box to fly from: the question
      // in the card where it was answered, or the sheet's own line where it was forgotten.
      if (askingInCard) noteSet('reading', card ? card.probe : null);
      else if (sheet && sheet.host.open) noteSet('reading', sheet.reading);
      if (!askingInCard) refresh();
      if (sheet && sheet.host.open) renderReading();
    });
    var t = window.threshold;
    if (t && typeof t.arrival === 'function' && t.arrival()) askInCard();
  }
  window.interestingPersona = {
    key: SKY, maxStars: MAX_STARS, stars: stars, read: read, holds: holds,
    seedSky: seedSky, thought: thought, setStars: setStars, addStar: addStar,
    seed: seed, clear: clear, onSky: onSky, skyName: skyName, skyRead: skyRead,
    // The difficulty, under the one name the local-state document keeps it by: what it is, how it
    // is set, how to follow it, and the one control that sets it anywhere it is a dependency.
    difficultyKey: DIFFICULTY, levels: LEVELS.slice(), defaultLevel: DEFAULT_LEVEL,
    difficulty: difficulty, setDifficulty: setDifficulty, onDifficulty: onDifficulty,
    describeDifficulty: describeDifficulty, tuner: tuner,
    open: function (section) { openSheet(section || 'sky', null); },
    close: closeSheet,
    ask: function () {
      if (card && card.probe) askInCard();
      else window.location.assign(root + 'index.html');
    },
    refresh: refresh
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
