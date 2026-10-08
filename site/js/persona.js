/* The persona: one saved sky, one reading and one difficulty, configured in the sheet opened by
   the avatar.

   Three settings, kept under three names in the one local-state document (js/state.js) and shown
   as three sections of the one sheet:

     constellation   the sky a visitor places, which several worlds read, each its own way
     threshold       the reading the mood flow has taken, which suggests a world and dresses the
                     site (js/threshold.js keeps that one; this file only shows it)
     difficulty      how hard every puzzle on the site comes out, 1 (gentle) to 5 (fierce)

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
  function announce(list, how, kept) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](list.slice(), how, kept); }
      catch (e) { console.error('A sky listener failed', e); }
    }
    window.dispatchEvent(new CustomEvent('persona:sky', {
      detail: { stars: list.slice(), how: how, kept: kept }
    }));
    refresh();
  }
  function setStars(next, how) {
    var list = clean(next);
    var kept = false;
    if (store) kept = list.length ? store.set(SKY, list) : store.remove(SKY);
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
  function readDifficulty() {
    var saved = store ? store.read(DIFFICULTY, DEFAULT_LEVEL) : { status: 'unavailable', value: DEFAULT_LEVEL };
    var level = levelOf(saved.value);
    // A document holding something the dial cannot be set to reads as unset rather than as broken:
    // there is always a difficulty, so there is nothing to explain and nothing to repair.
    return { status: level ? saved.status : (saved.status === 'ok' ? 'unreadable' : saved.status),
      level: level || DEFAULT_LEVEL, set: !!level && saved.status === 'ok' };
  }
  /* The setting, as the stage hands it to a piece on env.difficulty and as the sheet shows it:
     { level, of, name, says }. Always a value -- the middle of the dial until a visitor moves it
     -- because nothing on this site waits on a difficulty to be set. */
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
    var kept = store ? store.set(DIFFICULTY, want) : false;
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
  function cssColour(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }
  function drawSky(ctx, list, w, h, pad, dotRadius, lineWidth) {
    var points = list.map(function (s) {
      return { x: pad + s.x / 100 * (w - pad * 2), y: pad + s.y / 100 * (h - pad * 2) };
    });
    var maxDistanceSq = Math.pow(Math.min(w, h) * 0.3, 2);
    var used = Object.create(null);
    var accent = cssColour('--accent', '#9fcbff');
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
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (var p = 0; p < points.length; p++) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(236, 244, 255, 0.96)';
      ctx.arc(points[p].x, points[p].y, dotRadius, 0, Math.PI * 2);
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
    if (list.length) return list.length + ' star' + (list.length === 1 ? '' : 's') + ' in your sky.';
    if (saved.status === 'unreadable') return 'What this browser kept of your sky cannot be read, so it starts fresh.';
    return 'No stars yet.';
  }
  function cardText(saved, list, r) {
    if (askingInCard) return ASKING_TEXT;
    if (!list.length && !readOf(r) && saved.status !== 'unreadable') {
      return 'No persona yet. Yours is a small sky of stars you place, one sideways question '
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
    if (card.label) card.label.textContent = label;
    else card.open.textContent = label;
    if (card.portrait) {
      var size = card.portraitSize;
      var ctx = sizeCanvas(card.portrait, size, size);
      if (ctx && list.length) drawSky(ctx, list, size, size, size * 0.15, size * 0.032, size * 0.018);
    }
    if (sheet && sheet.host.open) renderSheet();
  }
  function askInCard() {
    var t = window.threshold;
    if (!card || !card.probe || !t || typeof t.mount !== 'function' || askingInCard) return;
    if (sheet && sheet.host.open) closeSheet();
    askingInCard = true;
    card.probe.hidden = false;
    refresh();
    t.mount(card.probe, {
      onAnswer: function () { stopAskingInCard(); card.open.focus(); },
      onSkip: function () { stopAskingInCard(); card.open.focus(); }
    });
    var first = card.probe.querySelector('button, input, [tabindex]');
    if (first && typeof first.focus === 'function') first.focus();
  }
  function stopAskingInCard() {
    if (!askingInCard) return;
    askingInCard = false;
    if (card && card.probe) {
      card.probe.textContent = '';
      card.probe.hidden = true;
    }
    refresh();
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

  var fieldStars = [];
  var selected = -1;
  var activeDrag = null;
  var suppressClickUntil = 0;
  var openedBy = null;
  var moveTimer = null;
  var sheetBox = null;
  function sheetStatus(text) { if (sheet && sheet.status) sheet.status.textContent = text; }
  function fieldIntro(list) {
    if (!list.length) return 'No stars yet. Tap the sky to place the first, or seed a small sky and drag it into a shape.';
    return list.length + ' star' + (list.length === 1 ? '' : 's') + '. Tap the sky to add one, drag a star to move it, tap one to read its thought.';
  }
  function keptNote(kept) {
    return kept || !store || store.persistent ? '' : ' Kept for this page only: this browser stores nothing between visits.';
  }
  function placeElement(star) {
    if (!star.el) return;
    star.el.style.left = star.x + '%';
    star.el.style.top = star.y + '%';
  }
  function drawField() {
    if (!sheet || !sheet.field || !sheet.canvas) return;
    var box = sheet.field.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ctx = sizeCanvas(sheet.canvas, box.width, box.height);
    if (ctx) drawSky(ctx, fieldStars, box.width, box.height, 0, 0, 1.1);
  }
  function select(index) {
    selected = index;
    for (var i = 0; i < fieldStars.length; i++) {
      if (fieldStars[i].el) fieldStars[i].el.classList.toggle('selected', i === index);
    }
    if (sheet.remove) sheet.remove.hidden = index < 0;
    if (index >= 0) sheetStatus('✦ ' + fieldStars[index].text + ' (' + (index + 1) + ' of ' + fieldStars.length + ')');
  }
  function pointInField(clientX, clientY) {
    var box = sheet.field.getBoundingClientRect();
    return { x: clamp((clientX - box.left) / (box.width || 1) * 100, 1, 99),
      y: clamp((clientY - box.top) / (box.height || 1) * 100, 1, 99) };
  }
  function serialize() { return fieldStars.map(function (s) { return { x: s.x, y: s.y, text: s.text }; }); }
  function createStarElement(star, index) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'persona-star';
    el.setAttribute('aria-label', 'star: ' + star.text + '. Arrow keys move it, delete removes it.');
    star.el = el;
    placeElement(star);
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (Date.now() < suppressClickUntil) return;
      select(index);
    });
    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      activeDrag = { index: index, pointerId: ev.pointerId, moved: false };
      if (el.setPointerCapture) {
        try { el.setPointerCapture(ev.pointerId); }
        catch (e) { console.error('Could not hold the star while dragging', e); }
      }
      el.classList.add('dragging');
    });
    el.addEventListener('keydown', function (ev) {
      var step = ev.shiftKey ? 6 : 2;
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        star.x = Number(clamp(star.x + moves[ev.key][0], 1, 99).toFixed(2));
        star.y = Number(clamp(star.y + moves[ev.key][1], 1, 99).toFixed(2));
        placeElement(star);
        drawField();
        select(index);
        window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(function () {
          setStars(serialize(), 'moved');
          var again = fieldStars[index];
          if (again && again.el) again.el.focus();
        }, 300);
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
    drawField();
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
    sheetStatus('Removed the star that said: ' + gone + '. ' + fieldIntro(fieldStars) + keptNote(kept));
    var next = sheet.field.querySelector('.persona-star');
    if (next) next.focus();
    else if (sheet.drop) sheet.drop.focus();
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
      sheetStatus('Moved. ' + fieldIntro(fieldStars) + keptNote(kept));
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
    openedBy = opener || document.activeElement;
    stopAskingInCard();
    if (!sheet.host.open) {
      if (sheetBox) sheetBox.up();
      if (typeof sheet.host.showModal === 'function') sheet.host.showModal();
      else { sheet.host.setAttribute('open', ''); sheet.host.classList.add('persona-sheet-fallback'); }
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
    activeDrag = null;
    sheet.host.classList.remove('persona-sheet-fallback');
    if (sheetBox) sheetBox.down();
    refresh();
    var back = openedBy;
    openedBy = null;
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    else if (card && card.open) card.open.focus();
  }
  function buildSheet() {
    var host = document.getElementById('persona-sheet');
    if (!host) return;
    sheet = {
      host: host, close: document.getElementById('persona-close'), field: document.getElementById('persona-sky'),
      canvas: host.querySelector('.persona-sky-canvas'), drop: document.getElementById('persona-drop'),
      seed: document.getElementById('persona-seed'), remove: document.getElementById('persona-remove'),
      clear: document.getElementById('persona-clear'), status: document.getElementById('persona-sky-status'),
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
    sheet.field.addEventListener('click', function (ev) {
      if (Date.now() < suppressClickUntil) return;
      if (ev.target !== sheet.field && ev.target !== sheet.canvas) return;
      var point = pointInField(ev.clientX, ev.clientY);
      var words = thought();
      var kept = addStar({ x: point.x, y: point.y, text: words });
      sheetStatus('✦ ' + words + keptNote(kept));
      var last = sheet.field.querySelector('.persona-star:last-of-type');
      if (last) select(fieldStars.length - 1);
    });
    document.addEventListener('pointermove', function (ev) {
      if (!activeDrag || activeDrag.pointerId !== ev.pointerId) return;
      var star = fieldStars[activeDrag.index];
      if (!star) return;
      activeDrag.moved = true;
      var point = pointInField(ev.clientX, ev.clientY);
      star.x = Number(point.x.toFixed(2));
      star.y = Number(point.y.toFixed(2));
      placeElement(star);
      drawField();
    });
    document.addEventListener('pointerup', function (ev) { endDrag(ev.pointerId); });
    document.addEventListener('pointercancel', function (ev) { endDrag(ev.pointerId); });
    if (sheet.drop) sheet.drop.addEventListener('click', function () {
      var words = thought();
      var kept = addStar({ x: 50 + (Math.random() - 0.5) * 30,
        y: 50 + (Math.random() - 0.5) * 30, text: words });
      sheetStatus('✦ ' + words + ' Drag it where it belongs.' + keptNote(kept));
      select(fieldStars.length - 1);
    });
    function seedTheSky() {
      var kept = seed();
      sheetStatus('Seeded ' + fieldStars.length + ' stars. Drag them into a shape, or tap the sky for more.' + keptNote(kept));
      var first = sheet.field.querySelector('.persona-star');
      if (first) first.focus();
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
      if (!askingInCard) refresh();
      if (sheet && sheet.host.open) renderReading();
    });
    var t = window.threshold;
    if (t && typeof t.arrival === 'function' && t.arrival()) askInCard();
  }
  window.interestingPersona = {
    key: SKY, maxStars: MAX_STARS, stars: stars, read: read, holds: holds,
    seedSky: seedSky, thought: thought, setStars: setStars, addStar: addStar,
    seed: seed, clear: clear, onSky: onSky,
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
