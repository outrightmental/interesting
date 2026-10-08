/* The persona: one saved sky and one reading, configured in the sheet opened by the avatar. */
(function () {
  'use strict';

  var store = window.interestingState;
  var root = document.documentElement.getAttribute('data-root') || '';
  var SKY = 'constellation';
  var MAX_STARS = 120;
  var SEED_COUNT = 7;
  var DRAG_SUPPRESS_MS = 250;
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
      return 'No persona yet. Yours is a small sky you place star by star and one sideways question '
        + 'you answer: several worlds read the stars, each its own way, and the answer '
        + 'picks a world to suggest. Set it up here, or take any world below.' + keptClause();
    }
    return describeSky(saved, list) + ' ' + describeReading(r) + keptClause();
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
      // A fresh visit: only what is set from here on is handed over on the way out, and a mark
      // still in the air from the last visit is taken away rather than stilled behind the veil.
      carried = null;
      sweep();
      if (sheetBox) sheetBox.up();
      if (typeof sheet.host.showModal === 'function') sheet.host.showModal();
      else { sheet.host.setAttribute('open', ''); sheet.host.classList.add('persona-sheet-fallback'); }
    }
    renderSheet();
    var target = section === 'reading' ? sheet.ask
      : (sheet.field.querySelector('.persona-star') || sheet.drop);
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
      reading: document.getElementById('persona-reading'), ask: document.getElementById('persona-ask'),
      forget: document.getElementById('persona-forget'), readingGo: document.getElementById('persona-reading-go')
    };
    if (!sheet.field) { sheet = null; return; }
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
    seed: seed, clear: clear, onSky: onSky,
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
