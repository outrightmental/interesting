/*
  The persona: the one thing a visitor configures on this site, and the card every page shows it on.

  One line in the <head> of a page carries all of it, written once in _includes/layout.njk:

      <script src='js/persona.js'></script>

  Not deferred, like js/state.js and js/site.js before it: a page's own <script> runs while the body
  is parsed, and a world under the sky reads the persona's stars from there. The card and the sheet
  are built on DOMContentLoaded, which is after every deferred script has run, so the orientation
  panel can lean on js/threshold.js.

  ---------------------------------------------------------------------------------------------
  What a persona is

  Two things, and every world reads from them: a small sky of stars the visitor places, which the
  eight worlds under the sky each reinterpret, and the reading the mood flow has taken of them,
  which is what the site offers a world from. The sky used to be placed on the wish constellation
  page and nowhere else, which made one world of eighteen the configuration screen for the rest.
  It is a persona now: configured in one place, shown in one place, and read everywhere.

  Anyone who has opened a role-playing game knows the shape. Under the header on every page sits the
  card -- a portrait of the sky, one line on where things stand, and one button -- and a visitor with
  no persona yet sees that card unlit and that button beckoning, because setting one up is the first
  thing to do. The button opens the sheet, a dialog floating over whatever page is open, with two
  sections: the constellation, where stars are placed, dragged and read, and the orientation, where
  the site asks its sideways question and says what it read. A world open underneath follows every
  change as it is made (see onSky below and window.interestingSite.unlock in js/site.js).

  The card is also where the mood flow is visible. The threshold asks on arrival in the card itself,
  inline, so the question is never a dialog in the way; on every other page the question is one
  press away inside the sheet, which asks of its own accord when nothing has been read yet.

  ---------------------------------------------------------------------------------------------
  What a page can call

      window.interestingPersona
        .key                 'constellation': the name the sky is kept under in the shared store
        .maxStars            how many stars a sky holds (120)
        .stars()             the saved sky, cleaned: [{ x, y, text }] in a 0-100 space, or []
        .read()              { status, value } straight from the store, for a page that wants to
                             say why there is nothing ('missing', 'unreadable', 'unavailable')
        .holds(value)        is this value a sky? a non-empty array with at least one valid star
        .seedSky(count)      a fresh small random sky, as a value: nothing is written
        .thought()           one random thought, the words a placed star carries
        .setStars(stars, how)  write a whole sky; true if the browser kept it
        .addStar(star)       add one; the oldest goes when the sky is full
        .seed()              write a seeded sky over whatever is there
        .clear()             forget the sky
        .onSky(fn)           fn(stars, how, kept) after every change, from this page or the sheet;
                             how is 'seeded', 'placed', 'added', 'moved', 'removed' or 'cleared'.
                             Returns a function that unsubscribes. The same news is dispatched on
                             window as a 'persona:sky' CustomEvent, detail { stars, how, kept }
        .open(section)       open the sheet, on 'sky' (default) or 'reading'
        .close()
        .ask()               put the sideways question in the card, where the threshold asks
        .refresh()           redraw the card; called for you after every change and reading

  Nothing here reaches for the browser's storage: every read and write goes through
  window.interestingState, like everything else the site remembers, so a persona exports and travels
  with the rest of a visitor's state through the menu in the corner.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var root = document.documentElement.getAttribute('data-root') || '';
  var SKY = 'constellation';
  var MAX_STARS = 120;
  var SEED_COUNT = 7;
  var DRAG_SUPPRESS_MS = 250;

  // What a star says when a world reads it out. Short, lowercase, the site's own voice: a placed
  // star and a seeded one draw from the same list, so a sky reads the same however it was made.
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

  // What the card says while its question is open: what the question is for, and that nothing
  // depends on it.
  var ASKING_TEXT = 'Before it offers anything, this site asks one sideways question. Whatever '
    + 'you answer picks a world to suggest; every world stays open below either way.';

  /* ---- the sky ---------------------------------------------------------------------------- */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function validStar(s) {
    return !!s && typeof s === 'object' && typeof s.x === 'number' && typeof s.y === 'number'
      && isFinite(s.x) && isFinite(s.y) && typeof s.text === 'string';
  }

  function cleanStar(s) {
    return {
      x: Number(clamp(s.x, 1, 99).toFixed(2)),
      y: Number(clamp(s.y, 1, 99).toFixed(2)),
      text: String(s.text).slice(0, 160)
    };
  }

  function clean(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(validStar).slice(0, MAX_STARS).map(cleanStar);
  }

  function holds(value) {
    return Array.isArray(value) && value.some(validStar);
  }

  function thought() {
    return THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
  }

  /* A fresh sky: `count` stars spread around the middle of the field rather than clumped, in the
     0-100 space every sky world reads. */
  function seedSky(count) {
    var n = Math.max(1, Math.min(MAX_STARS, count || SEED_COUNT));
    var list = [];
    var start = Math.floor(Math.random() * THOUGHTS.length);
    for (var i = 0; i < n; i++) {
      var angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      var radius = 14 + Math.random() * 24;
      list.push({
        x: Number(clamp(50 + Math.cos(angle) * radius, 8, 92).toFixed(2)),
        y: Number(clamp(48 + Math.sin(angle) * radius * 0.8, 12, 86).toFixed(2)),
        text: THOUGHTS[(start + i) % THOUGHTS.length]
      });
    }
    return list;
  }

  function read() {
    return store ? store.read(SKY, []) : { status: 'unavailable', value: [] };
  }

  function stars() {
    return clean(read().value);
  }

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
      try {
        listeners[i](list.slice(), how, kept);
      } catch (e) {
        /* one page's listener failing is that page's problem, not the next listener's */
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('persona:sky', { detail: { stars: list.slice(), how: how, kept: kept } }));
    } catch (e) {
      /* older browsers get the listeners and nothing else */
    }
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

  function seed() {
    return setStars(seedSky(), 'seeded');
  }

  function clear() {
    return setStars([], 'cleared');
  }

  /* ---- drawing ---------------------------------------------------------------------------- */

  function cssColour(name, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* Stars and the links between near ones, in a box of `w` by `h` CSS pixels, with `pad` kept
     clear at the edges. The portrait and the sheet's sky are the same drawing at two sizes. */
  function drawSky(ctx, list, w, h, pad, dotRadius, lineWidth) {
    var points = list.map(function (s) {
      return { x: pad + (s.x / 100) * (w - pad * 2), y: pad + (s.y / 100) * (h - pad * 2) };
    });
    var maxDistance = Math.min(w, h) * 0.3;
    var maxDistanceSq = maxDistance * maxDistance;
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

  /* ---- the card --------------------------------------------------------------------------- */

  var card = null; // the elements of the card, once found
  var sheet = null; // the elements of the sheet, once found
  var askingInCard = false;

  function reading() {
    var t = window.threshold;
    if (!t || typeof t.reading !== 'function') return null;
    try {
      return t.reading();
    } catch (e) {
      return null;
    }
  }

  function readOf(r) {
    return !!(r && r.orientation && r.source && r.source !== 'signals');
  }

  function describeReading(r) {
    var t = window.threshold;
    if (!t || typeof t.describe !== 'function') return '';
    return t.describe(r);
  }

  function keptClause() {
    return store && store.persistent === false
      ? ' This browser keeps nothing between visits, so your persona lasts for this page.'
      : '';
  }

  function describeSky(saved, list) {
    if (list.length) return list.length + ' star' + (list.length === 1 ? '' : 's') + ' in your sky.';
    if (saved.status === 'unreadable') return 'What this browser kept of your sky cannot be read, so it starts fresh.';
    return 'No stars yet.';
  }

  /* The card's one sentence. With nothing placed and nothing read it explains what a persona is,
     once, where a visitor first meets the word; after that it says where things stand. */
  function cardText(saved, list, r) {
    if (askingInCard) return ASKING_TEXT;
    if (!list.length && !readOf(r) && saved.status !== 'unreadable') {
      return 'No persona yet. Yours is a small sky of stars you place and one sideways question '
        + 'you answer: the worlds under the sky each read the stars their own way, and the answer '
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

    card.text.textContent = cardText(saved, list, r);
    card.host.setAttribute('data-state', askingInCard ? 'asking' : (!list.length && !isRead ? 'empty' : 'ready'));
    card.host.setAttribute('data-reading', !isRead ? 'none' : (r.source === 'answer' ? 'answered' : 'carried'));
    card.host.setAttribute('data-asking', askingInCard ? 'true' : 'false');
    card.host.setAttribute('data-sky', list.length ? 'set' : 'none');
    card.actions.hidden = askingInCard;
    card.open.hidden = false;
    card.open.textContent = list.length || isRead ? 'open persona' : 'set up persona';
    if (isRead && !askingInCard) {
      card.go.hidden = false;
      card.go.href = root + r.orientation.world;
      card.go.textContent = 'go to ' + r.orientation.worldName;
    } else {
      card.go.hidden = true;
    }

    if (card.portrait) {
      var ctx = sizeCanvas(card.portrait, 56, 56);
      if (ctx && list.length) drawSky(ctx, list, 56, 56, 8, 1.7, 0.9);
    }

    if (sheet && sheet.host.open) renderSheet();
  }

  /* The sideways question, asked in the card: on arrival at the threshold, and whenever a page
     asks for it. The card's own controls step aside until it is answered or skipped. */
  function askInCard() {
    var t = window.threshold;
    if (!card || !card.probe || !t || typeof t.mount !== 'function' || askingInCard) return;
    if (sheet && sheet.host.open) closeSheet();
    askingInCard = true;
    card.probe.hidden = false;
    refresh();
    t.mount(card.probe, {
      onAnswer: function () {
        stopAskingInCard();
        if (!card.go.hidden) card.go.focus();
        else card.open.focus();
      },
      onSkip: function () {
        stopAskingInCard();
        card.open.focus();
      }
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
      host: host,
      text: document.getElementById('persona-text'),
      actions: host.querySelector('.persona-actions'),
      open: document.getElementById('persona-open'),
      go: document.getElementById('persona-go'),
      probe: document.getElementById('persona-probe'),
      portrait: document.getElementById('persona-portrait')
    };
    if (!card.text || !card.open || !card.go || !card.actions) {
      card = null;
      return;
    }
    card.open.addEventListener('click', function () {
      openSheet(card.open.textContent === 'set up persona' ? 'sky' : 'sky', card.open);
    });
    // Live only from here on: the sentence written as the page loads is the page's, not news.
    card.text.setAttribute('aria-live', 'polite');
    refresh();
  }

  /* ---- the sheet -------------------------------------------------------------------------- */

  var fieldStars = []; // the sky as the sheet shows it: the saved stars, each with its element
  var selected = -1;
  var activeDrag = null;
  var suppressClickUntil = 0;
  var openedBy = null;
  var askingInSheet = false;
  var moveTimer = null;

  function sheetStatus(text) {
    if (sheet && sheet.status) sheet.status.textContent = text;
  }

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
    if (!ctx) return;
    drawSky(ctx, fieldStars, box.width, box.height, 0, 0, 1.1);
  }

  function select(index) {
    selected = index;
    for (var i = 0; i < fieldStars.length; i++) {
      if (fieldStars[i].el) fieldStars[i].el.classList.toggle('selected', i === index);
    }
    if (sheet.remove) sheet.remove.hidden = index < 0;
    if (index >= 0) {
      sheetStatus('✦ ' + fieldStars[index].text + ' (' + (index + 1) + ' of ' + fieldStars.length + ')');
    }
  }

  function pointInField(clientX, clientY) {
    var box = sheet.field.getBoundingClientRect();
    return {
      x: clamp(((clientX - box.left) / (box.width || 1)) * 100, 1, 99),
      y: clamp(((clientY - box.top) / (box.height || 1)) * 100, 1, 99)
    };
  }

  function serialize() {
    return fieldStars.map(function (s) { return { x: s.x, y: s.y, text: s.text }; });
  }

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
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* a pointer that cannot be captured still drags, less smoothly */
        }
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
        // One write for a run of key presses, so holding an arrow is not a hundred writes. The
        // write redraws the sky from the store, so focus goes to the new button at the same place.
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
    for (var i = 0; i < fieldStars.length; i++) {
      if (fieldStars[i].el) fieldStars[i].el.remove();
    }
    activeDrag = null;
    var saved = read();
    fieldStars = clean(saved.value).map(function (s) {
      return { x: s.x, y: s.y, text: s.text, el: null };
    });
    for (var j = 0; j < fieldStars.length; j++) createStarElement(fieldStars[j], j);
    select(-1);
    drawField();
    if (saved.status === 'unreadable') {
      sheetStatus('What this browser kept of your sky cannot be read, so it starts fresh. Tap the sky to place a star.');
    } else {
      sheetStatus(fieldIntro(fieldStars) + keptNote(true));
    }
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
        try {
          star.el.releasePointerCapture(pointerId);
        } catch (e) {
          /* already released */
        }
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
    var t = window.threshold;
    sheet.reading.textContent = describeReading(r) + keptClause();
    if (sheet.ask) {
      sheet.ask.textContent = isRead ? 'ask another way' : 'ask me';
      sheet.ask.hidden = askingInSheet || !t;
    }
    if (sheet.forget) sheet.forget.hidden = askingInSheet || !isRead;
    if (sheet.readingGo) {
      if (isRead && !askingInSheet) {
        sheet.readingGo.hidden = false;
        sheet.readingGo.href = root + r.orientation.world;
        sheet.readingGo.textContent = 'go to ' + r.orientation.worldName;
      } else {
        sheet.readingGo.hidden = true;
      }
    }
  }

  function askInSheet(focusFirst) {
    var t = window.threshold;
    if (!sheet || !sheet.probe || !t || typeof t.mount !== 'function' || askingInSheet) return;
    stopAskingInCard();
    askingInSheet = true;
    sheet.probe.hidden = false;
    renderReading();
    t.mount(sheet.probe, {
      onAnswer: function () {
        stopAskingInSheet();
        if (sheet.readingGo && !sheet.readingGo.hidden) sheet.readingGo.focus();
        else if (sheet.ask) sheet.ask.focus();
      },
      onSkip: function () {
        stopAskingInSheet();
        if (sheet.ask) sheet.ask.focus();
      }
    });
    if (focusFirst) {
      var first = sheet.probe.querySelector('button, input, [tabindex]');
      if (first && typeof first.focus === 'function') first.focus();
    }
  }

  function stopAskingInSheet() {
    askingInSheet = false;
    if (sheet && sheet.probe) {
      sheet.probe.textContent = '';
      sheet.probe.hidden = true;
    }
    renderReading();
  }

  function renderSheet() {
    renderField();
    renderReading();
  }

  function openSheet(section, opener) {
    if (!sheet) return;
    openedBy = opener || document.activeElement;
    stopAskingInCard();
    if (!sheet.host.open) {
      if (typeof sheet.host.showModal === 'function') {
        sheet.host.showModal();
      } else {
        sheet.host.setAttribute('open', '');
        sheet.host.classList.add('persona-sheet-fallback');
      }
    }
    renderSheet();
    // The sheet asks of its own accord when nothing has been read yet: setting up a persona is
    // placing a sky and answering one question, and the question should not need finding.
    if (!readOf(reading())) askInSheet(section === 'reading');
    var target = section === 'reading'
      ? (askingInSheet ? sheet.probe.querySelector('button, input, [tabindex]') : sheet.ask)
      : (sheet.field.querySelector('.persona-star') || sheet.drop);
    if (target && typeof target.focus === 'function') target.focus();
    try {
      sheet.host.scrollTop = 0;
    } catch (e) {
      /* nothing to scroll */
    }
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
    if (askingInSheet) stopAskingInSheet();
    activeDrag = null;
    sheet.host.classList.remove('persona-sheet-fallback');
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
      host: host,
      close: document.getElementById('persona-close'),
      field: document.getElementById('persona-sky'),
      canvas: host.querySelector('.persona-sky-canvas'),
      drop: document.getElementById('persona-drop'),
      seed: document.getElementById('persona-seed'),
      remove: document.getElementById('persona-remove'),
      clear: document.getElementById('persona-clear'),
      status: document.getElementById('persona-sky-status'),
      reading: document.getElementById('persona-reading'),
      ask: document.getElementById('persona-ask'),
      forget: document.getElementById('persona-forget'),
      readingGo: document.getElementById('persona-reading-go'),
      probe: document.getElementById('persona-sheet-probe')
    };
    if (!sheet.field) {
      sheet = null;
      return;
    }

    if (sheet.close) sheet.close.addEventListener('click', closeSheet);
    host.addEventListener('close', onSheetClosed);
    host.addEventListener('cancel', function () {
      /* Escape: the browser closes it, and 'close' follows */
    });
    // A press on the backdrop closes it, which is what a dialog owes anyone who opened it by
    // mistake. The dialog element is the target for the backdrop as well as its own padding, so
    // the press has to be outside the box itself.
    host.addEventListener('click', function (ev) {
      if (ev.target !== host) return;
      var box = host.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) {
        closeSheet();
      }
    });

    // A tap on the open sky places a star where the finger is.
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

    if (sheet.drop) {
      sheet.drop.addEventListener('click', function () {
        var words = thought();
        var kept = addStar({
          x: 50 + (Math.random() - 0.5) * 30,
          y: 50 + (Math.random() - 0.5) * 30,
          text: words
        });
        sheetStatus('✦ ' + words + ' Drag it where it belongs.' + keptNote(kept));
        select(fieldStars.length - 1);
      });
    }
    if (sheet.seed) {
      sheet.seed.addEventListener('click', function () {
        if (fieldStars.length && !window.confirm('Seed a fresh sky? The ' + fieldStars.length
          + ' star' + (fieldStars.length === 1 ? '' : 's') + ' you have will go.')) {
          sheetStatus('Kept as it was.');
          return;
        }
        var kept = seed();
        sheetStatus('Seeded ' + fieldStars.length + ' stars. Drag them into a shape, or tap the sky for more.' + keptNote(kept));
        var first = sheet.field.querySelector('.persona-star');
        if (first) first.focus();
      });
    }
    if (sheet.remove) {
      sheet.remove.addEventListener('click', function () {
        if (selected >= 0) removeStar(selected);
      });
    }
    if (sheet.clear) {
      sheet.clear.addEventListener('click', function () {
        if (!fieldStars.length) {
          sheetStatus('The sky is already empty.');
          return;
        }
        if (!window.confirm('Clear every star from your sky? Every world under the sky will read nothing until you place more.')) {
          sheetStatus('Kept as it was.');
          return;
        }
        var kept = clear();
        sheetStatus('Cleared. ' + fieldIntro(fieldStars) + keptNote(kept));
        if (sheet.drop) sheet.drop.focus();
      });
    }
    if (sheet.ask) sheet.ask.addEventListener('click', function () { askInSheet(true); });
    if (sheet.forget) {
      sheet.forget.addEventListener('click', function () {
        var t = window.threshold;
        if (t && typeof t.forget === 'function') t.forget();
        renderReading();
        refresh();
        if (sheet.reading) sheet.reading.textContent = 'The reading is forgotten. Your stars stay.';
        if (sheet.ask) sheet.ask.focus();
      });
    }

    window.addEventListener('resize', function () {
      if (sheet.host.open) drawField();
    });
  }

  /* ---- start ------------------------------------------------------------------------------ */

  function start() {
    buildCard();
    buildSheet();
    // A reading taken anywhere -- the sheet, the card, the mood atlas -- is the card's to report.
    window.addEventListener('threshold:reading', function () {
      if (!askingInCard) refresh();
      if (sheet && sheet.host.open && !askingInSheet) renderReading();
    });
    // The threshold asks unprompted, in the card: on arrival, and whenever nothing has been read
    // yet, because asking is what that page is for. Every other page keeps the question one press
    // away, inside the sheet.
    var t = window.threshold;
    if (t && typeof t.arrival === 'function' && t.arrival()) askInCard();
  }

  window.interestingPersona = {
    key: SKY,
    maxStars: MAX_STARS,
    stars: stars,
    read: read,
    holds: holds,
    seedSky: seedSky,
    thought: thought,
    setStars: setStars,
    addStar: addStar,
    seed: seed,
    clear: clear,
    onSky: onSky,
    open: function (section) { openSheet(section || 'sky', null); },
    close: closeSheet,
    ask: askInCard,
    refresh: refresh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
