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
   its clues. The sheet's optional puzzle preview borrows the feed's own modules and card
   configurations through interestingFeed.previewSky(), so changing a star reveals a real world's
   response rather than an imitation. Moving a star updates the preview when the move ends.
   A pending preview is invalidated as soon as its stars change, even during a drag.
   Closing the sheet keeps a move just as releasing the star does. Replacing the sky releases
   any drag before rendering, so a later pointer release cannot restore the previous sky.
   The first preview's picture and words stay available for comparison while that world is being
   previewed in the open sheet. This is a temporary picture, never another saved or editable sky.

   Named-shape buttons toggle hollow targets on the existing sky, never placing stars themselves.
   Each star keeps its target while it moves; targets are reassigned only when membership changes.
   The guide remains usable after the shape is found and keeps nothing between pages. The portrait
   fits the sky's 2:1 geometry without stretching it, so a found shape travels recognisably.

   The difficulty is advertised as specifically as the sky and settable from everywhere it is a
   dependency (issue #93), which is every piece on the site: `tuner(host)` below renders the one
   slider, the sheet puts it in its own section, and js/stage.js puts the same control on the
   stage beside the piece it is dealing. Only an effective level change notifies readers; choosing
   the default explicitly can still be saved without announcing a different difficulty. As with
   the sky, each subscriber receives an independent snapshot, and subscription changes apply to
   the next notification. Unlike the sky it always holds a value -- the middle of
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

  /* ---- the rites the persona asks the engine for ------------------------------------------ */
  /* Nothing the persona writes or takes away is switched while a visitor is watching (README:
     "Motion axiom", the cut): it changes by one clean edge -- a slice or a curve -- that steps
     across it in a few treads that only go forward, chosen for a reason. Words a script writes are
     cut in by the reveal's slice, what arrives comes in behind a slice from where it comes from,
     what leaves is cut away toward where it goes (or a ghost of it is), and a star appears as a
     curve growing from its own point. The edges are drawn by _sass/_persona.scss; this file asks
     js/motion.js for the treads of each one (cut, arrive), writes the reason where it is a place
     on the screen, and puts the passing classes on and off. js/motion.js is optional throughout --
     the stub browsers the harnesses run load none, and a visitor who asked for less motion gets
     everything at once -- so every rite is guarded, and every write below lands synchronously
     whether or not one plays: textContent is never anything but the words, hidden means hidden,
     and the list is the list. */
  function engine() {
    var m = window.interestingMotion;
    return m && typeof m.ms === 'function' ? m : null;
  }
  function calm() {
    var m = engine();
    return m ? !!m.reduced : stillness();
  }
  function riteMs(name, fallback) {
    var m = engine();
    return (m && m.ms(name)) || fallback;
  }
  // One passing rite on an element, by the name of its class is-<name>, taken off again after
  // `after` ms. Put on here rather than by the engine's own rite(), which waits a frame before the
  // class goes on so a restarted rite restarts: the shared lightbox holds the page's frames while
  // the sheet is up (js/site.js), and most of these rites are the sheet's. A rite already playing
  // is restarted by taking the class off and reading the box once, which makes the browser see the
  // gap; a class going on for the first time needs no such read, so a loop that deals many fresh
  // elements reads no layout at all.
  var passing = typeof WeakMap === 'function' ? new WeakMap() : null;
  function rite(el, name, after) {
    var m = engine();
    if (!el || !el.classList || !m || calm() || typeof window.setTimeout !== 'function') return;
    var cls = 'is-' + name;
    var timers = passing ? passing.get(el) : null;
    if (!timers && passing) {
      timers = {};
      passing.set(el, timers);
    }
    if (timers && timers[name]) window.clearTimeout(timers[name]);
    if (el.classList.contains(cls)) {
      el.classList.remove(cls);
      if (typeof el.getBoundingClientRect === 'function') el.getBoundingClientRect();
    }
    el.classList.add(cls);
    var wait = after || riteMs('long', 500) * 2 + 400;
    if (timers) {
      timers[name] = window.setTimeout(function () {
        timers[name] = 0;
        el.classList.remove(cls);
      }, wait);
    }
  }
  // One movement's treads and length, rolled for this trigger by the engine and written on the
  // element as --ease-<name> and --motion-<name>, which the stylesheet reads under the same name.
  // Hands back the length in ms, or 0 where nothing moves.
  function cutOn(el, name, options) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof m.cut !== 'function') return 0;
    try { return m.cut(el, name, options || {}) || 0; }
    catch (e) { console.error('The movement could not be rolled', e); return 0; }
  }
  // An arrival whose direction the engine rolls (m.arrive): where it comes from, the slice it comes
  // in behind and its treads, written on the element (and the treads again under `spell`, the name
  // the stylesheet reads). The class that plays it is the stylesheet's (:not([hidden]), [open]).
  function arriveOn(el, spell) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof m.arrive !== 'function') return;
    try { m.arrive(el, { spell: spell, className: false }); }
    catch (e) { console.error('The arrival could not be rolled', e); }
  }
  // How far a box steps as it arrives or leaves, in CSS pixels: the engine's own reach.
  var REACH = 18;
  // The way (dx, dy) points, as the angle of the slice a thing travelling that way moves behind:
  // the way a CSS gradient counts it, 0deg up and clockwise, as the engine writes its own.
  function angleOf(dx, dy) {
    return Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) + 'deg';
  }
  // The middle of a control on the screen, or null for one with no box to measure.
  function middleOf(node) {
    var box = node && typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
    return box && (box.width || box.height) ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
  }
  // An arrival from a control on the screen, for a box that comes out of the control that called it
  // up: the sheet, out of the avatar (or whatever opened it), toward the middle of the screen where
  // a dialog stands. It starts a step back toward the control (--arrive-x, --arrive-y) and comes in
  // behind a slice pointing the way it travels (--arrive-angle), in treads rolled for it under
  // `spell`. `start` is the control's middle (middleOf), measured by the caller before it wrote
  // anything, so this only writes; a control with no box leaves the page's own direction standing.
  function arriveFrom(el, spell, start) {
    if (!el || !el.style || !engine() || calm()) return 0;
    var names = ['--arrive-x', '--arrive-y', '--arrive-angle'];
    var dx = start ? (window.innerWidth || 0) / 2 - start.x : 0;
    var dy = start ? (window.innerHeight || 0) / 2 - start.y : 0;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) {
      el.style.setProperty(names[0], (-dx / d * REACH).toFixed(1) + 'px');
      el.style.setProperty(names[1], (-dy / d * REACH).toFixed(1) + 'px');
      el.style.setProperty(names[2], angleOf(dx, dy));
    } else {
      for (var i = 0; i < names.length; i++) el.style.removeProperty(names[i]);
    }
    return cutOn(el, spell, { duration: 'long' });
  }
  // Where a leaving box goes, when the reason it goes is a control on the screen -- the one the
  // focus is going home to: a step toward it (--leave-x, --leave-y) and the slice it goes behind
  // pointing the same way (--leave-angle). Without a place to go it keeps the page's own roll.
  function aimAt(el, box, toward) {
    var end = middleOf(toward);
    if (!end || !box || !el.style) return;
    var dx = end.x - (box.left + box.width / 2);
    var dy = end.y - (box.top + box.height / 2);
    var d = Math.sqrt(dx * dx + dy * dy);
    if (!(d >= 1)) return;
    el.style.setProperty('--leave-x', (dx / d * REACH).toFixed(1) + 'px');
    el.style.setProperty('--leave-y', (dy / d * REACH).toFixed(1) + 'px');
    el.style.setProperty('--leave-angle', angleOf(dx, dy));
  }
  // A star moved by an arrow key is already in its new place (placeElement has moved it, at once),
  // and steps there from the old one (is-nudged, _sass/_persona.scss star-nudge): --nudge-x/-y is
  // the way back to where it was, in pixels of the field, and the treads are rolled for this one
  // press, so no two nudges are alike. One read of the field's box per key, never in a loop.
  function nudge(el, dxPct, dyPct) {
    if (!el || !el.style || !engine() || calm() || !sheet || !sheet.field) return;
    var box = sheet.field.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    el.style.setProperty('--nudge-x', (-dxPct / 100 * Math.max(0, box.width - 44)).toFixed(1) + 'px');
    el.style.setProperty('--nudge-y', (-dyPct / 100 * Math.max(0, box.height - 44)).toFixed(1) + 'px');
    var length = cutOn(el, 'star-nudge', { family: 'arrive', duration: 'short' });
    rite(el, 'nudged', (length || riteMs('short', 170)) + 100);
  }
  // A leaving's treads, rolled for it and written on the element (or the ghost of it) that plays it
  // under `spell`, the name its stylesheet reads. Hands back the length.
  function leaveOn(el, spell) {
    return cutOn(el, spell, { family: 'leave', duration: 'medium' });
  }
  // A stair rolled for one movement whose length the stylesheet fixes (the hand-off's, which is
  // FLIGHT_MS long whatever the roll says), written on the element under the one name it reads:
  // the treads and nothing else, since a length written there would be read by nothing.
  function treadsOn(el, name, family) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof m.curve !== 'function') return;
    try { el.style.setProperty(name, m.curve(family).css); }
    catch (e) { console.error('The treads could not be rolled', e); }
  }
  // A passing rite given longer than it was first given (a part held back while what it pushes
  // steps aside, makeRoom), without being started again: its clock alone is set afresh, and the
  // wait it was held for goes with its class.
  function holdRite(el, name, after) {
    var timers = passing && el ? passing.get(el) : null;
    if (!timers || !timers[name] || !el.classList.contains('is-' + name)) return;
    window.clearTimeout(timers[name]);
    timers[name] = window.setTimeout(function () {
      timers[name] = 0;
      el.classList.remove('is-' + name);
      el.style.removeProperty('--part-wait');
    }, after);
  }
  // A passing rite taken off before its time: its clock stopped and its class gone.
  function endRite(el, name) {
    var timers = passing && el ? passing.get(el) : null;
    if (timers && timers[name]) {
      window.clearTimeout(timers[name]);
      timers[name] = 0;
    }
    if (el && el.classList) el.classList.remove('is-' + name);
  }
  // The sheet being opened: everything in it comes with the sheet's own one edge, so while it is
  // dealt nothing in it arrives or is revealed by an edge of its own (show and say, below).
  var dealing = false;
  // Words written to a line and revealed there. A line still being revealed is ended first, so a
  // status rewritten mid-reveal starts its own cut rather than finishing the last one's; `quiet`
  // writes the words without the reveal, for a line nobody can see at the moment or one arriving
  // with its words (show, below), whose arrival is the one edge they come by.
  var revealed = typeof WeakMap === 'function' ? new WeakMap() : null;
  function say(node, text, quiet) {
    if (!node) return;
    var before = revealed && revealed.get(node);
    if (before) {
      before();
      revealed['delete'](node);
    }
    if (node.textContent === text) return;
    node.textContent = text;
    var m = engine();
    if (quiet || dealing || node.hidden || !m || typeof m.reveal !== 'function' || calm()) return;
    var undo = m.reveal(node);
    if (revealed && typeof undo === 'function') revealed.set(node, undo);
  }
  // A part of the sheet shown or hidden: shown at once, and cut in behind a slice
  // (_sass/_persona.scss, is-arriving, part-in) if it was not in view -- hidden, or on its way out --
  // by a roll of its own; cut away (is-unmaking) before it is hidden, and at once where nothing can
  // play, so hidden is hidden synchronously in the stubs. show() hands back whether the part is
  // arriving, so words given to it now are written quietly and come with it: one edge on one stair,
  // not the arrival's slice with the reveal's stepping over it on another.
  var concealing = typeof WeakMap === 'function' ? new WeakMap() : null;
  function show(node) {
    if (!node) return false;
    var pending = concealing && concealing.get(node);
    var arriving = !!node.hidden || !!pending;
    if (pending) {
      window.clearTimeout(pending);
      concealing['delete'](node);
    }
    if (node.classList) node.classList.remove('is-unmaking');
    node.removeAttribute('inert'); // reachable again, by a key as by a press (conceal, below)
    node.hidden = false;
    if (arriving && !dealing && engine() && !calm()) {
      if (node.style) node.style.removeProperty('--part-wait'); // a wait is makeRoom's to give, each time
      arriveOn(node, 'part-in'); // where it comes from: a direction the engine rolls
      var length = cutOn(node, 'part-in', { family: 'arrive', duration: 'medium' });
      rite(node, 'arriving', (length || riteMs('medium', 320)) + 100);
    }
    return arriving;
  }
  // A part on its way out is out of reach from the moment it starts to go (inert): neither a key
  // nor a press lands on a control that is being cut away, and the sheet's own Tab (buildSheet)
  // passes over it. `keep` is for a line that holds its room whether or not it has anything to say
  // (the sky's name, with no sky to name): what it says is cut away the same way, and then the line
  // is emptied where it stands rather than hidden, so nothing under it moves. `room`, for a part
  // whose going lets what is under it up (makeRoom), is what the hiding is done through once the
  // cut has ended.
  function conceal(node, keep, room) {
    if (!node || node.hidden || (keep && !node.textContent)) return;
    if (concealing && concealing.get(node)) return; // already being cut away
    node.setAttribute('inert', '');
    endRite(node, 'arriving');
    function hide() {
      if (keep) {
        node.textContent = '';
        node.removeAttribute('inert'); // a line left standing, empty, and no longer leaving
      } else node.hidden = true;
    }
    function gone() {
      if (typeof room === 'function') room(hide);
      else hide();
    }
    var m = engine();
    // A sheet being opened arrives without it, by its own one edge.
    if (dealing || !m || calm() || !node.classList || !concealing || typeof window.setTimeout !== 'function') {
      gone();
      return;
    }
    var length = leaveOn(node, 'part-unmake');
    node.classList.add('is-unmaking');
    concealing.set(node, window.setTimeout(function () {
      concealing['delete'](node);
      node.classList.remove('is-unmaking');
      gone();
    }, (length || riteMs('medium', 320)) + 60));
  }
  // The passing rites a box may be caught in as it is copied (a star under the pointer, a part
  // arriving, a badge being stamped, a line being revealed, a card being dealt): its ghost leaves
  // as it stands, so none of them plays again in it. What was already on its way out (a part being
  // cut away, an answer not chosen, a ghost of its own) keeps its place in the copy and is not shown,
  // since its own leaving has no edge to step it there.
  var PASSING = /(^|\s)(?:is-(?:waxing|waning|stamping|sealing|unsealing|revealing|placed|nudged|unthreaded|arriving|dealt|landing|casting)|dragging)(?=\s|$)/;
  var PASSING_ALL = new RegExp(PASSING.source, 'g');
  var GOING = /(^|\s)(?:is-unmaking|is-leaving|probe-ghost|probe-landing-ghost|persona-star-ghost)(?=\s|$)/;
  // What of a box's own a ghost of it does not carry: who it is, whether it is shown, what it says
  // to a screen reader, how a key or the shell's lightbox reaches it.
  var UNCOPIED = /^(?:id|hidden|open|role|tabindex|inert|aria-[\w-]+|data-lightbox-[\w-]+)$/;
  function withoutPassing(cls) {
    return String(cls || '').replace(PASSING_ALL, ' ').replace(/\s+/g, ' ').trim();
  }
  // A copy's canvases are blank: each is drawn again from the one it is a copy of, in order, so a
  // ghost goes with the picture the box was showing (the sky, a preview, a question's own).
  function copyCanvases(from, to) {
    if (typeof from.querySelectorAll !== 'function' || typeof to.querySelectorAll !== 'function') return;
    var a = from.querySelectorAll('canvas');
    var b = to.querySelectorAll('canvas');
    for (var i = 0; i < a.length && i < b.length; i++) {
      if (!a[i].width || !a[i].height || typeof b[i].getContext !== 'function') continue;
      b[i].width = a[i].width;
      b[i].height = a[i].height;
      var g = b[i].getContext('2d');
      if (!g) continue;
      try { g.drawImage(a[i], 0, 0); }
      catch (e) { /* a picture that cannot be copied leaves that canvas of the ghost blank */ }
    }
  }
  // A ghost of a box that has to go at once -- the sheet, which must close for the focus to go
  // home and the veil to come down; the question in the card, whose words are the threshold's to
  // clear: a copy of it left exactly where it was, cut away there by the stylesheet (`extra`, the
  // class the caller adds to the box's own) toward `toward`, the control the focus or the answer
  // goes home to, and taken out when the cut has ended. A copy of the box itself, not of its words
  // alone: its own classes and data (a question's mechanism, its read state), so it is laid out and
  // painted as the box was, scrolled where the box was scrolled and showing what its canvases
  // showed -- a ghost that changed size, jumped or went blank as it left would be a switch. Under no
  // pointer and hidden from a screen reader, with every id stripped so the page keeps its one of
  // each. `spell` names the treads the stylesheet reads.
  function ghostOf(host, extra, layer, spell, toward) {
    var m = engine();
    if (!m || calm() || !host || typeof host.getBoundingClientRect !== 'function' || !document.body
        || typeof host.innerHTML !== 'string' || typeof host.querySelectorAll !== 'function'
        || typeof window.setTimeout !== 'function') return null;
    var box = host.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    var ghost = document.createElement('div');
    var own = host.attributes || [];
    for (var a = 0; a < own.length; a++) {
      if (!UNCOPIED.test(own[a].name)) ghost.setAttribute(own[a].name, own[a].value);
    }
    ghost.className = withoutPassing(host.getAttribute('class') + ' ' + extra);
    ghost.innerHTML = host.innerHTML;
    var named = ghost.querySelectorAll('[id]');
    for (var i = 0; i < named.length; i++) named[i].removeAttribute('id');
    var parts = ghost.querySelectorAll('*');
    for (var j = 0; j < parts.length; j++) {
      var part = parts[j];
      part.removeAttribute('data-dealt');
      var cls = part.getAttribute('class');
      if (!cls) continue;
      if (GOING.test(cls)) part.style.setProperty('visibility', 'hidden');
      if (PASSING.test(cls)) part.setAttribute('class', withoutPassing(cls));
    }
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    var style = ghost.style;
    style.setProperty('position', 'fixed');
    style.setProperty('top', box.top + 'px');
    style.setProperty('left', box.left + 'px');
    style.setProperty('width', box.width + 'px');
    style.setProperty('height', box.height + 'px');
    style.setProperty('margin', '0');
    style.setProperty('pointer-events', 'none');
    style.setProperty('animation-play-state', 'running'); // a ghost plays itself out under a veil
    if (layer) style.setProperty('z-index', layer);
    aimAt(ghost, box, toward);
    var length = spell ? leaveOn(ghost, spell) : 0;
    document.body.appendChild(ghost);
    if (host.scrollTop) ghost.scrollTop = host.scrollTop;
    copyCanvases(host, ghost);
    function gone() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }
    ghost.addEventListener('animationend', function (ev) { if (!ev || ev.target === ghost) gone(); });
    ghost.addEventListener('animationcancel', function (ev) { if (!ev || ev.target === ghost) gone(); });
    window.setTimeout(gone, Math.max(length, riteMs('medium', 320)) * 2 + 400);
    return ghost;
  }
  // The moments a stair the engine rolled steps at, and how far it has come at each: [[t, y], ...],
  // forward only, the last at y = 1. For what this script draws on a canvas in treads.
  function jumpsOf(curve) {
    var out = [];
    var stops = curve && curve.stops ? curve.stops : [];
    for (var i = 1; i < stops.length; i++) {
      if (stops[i][1] > stops[i - 1][1]) out.push([stops[i][0], stops[i][1]]);
    }
    return out;
  }
  // The order a sky's stars are dealt in: a rolled permutation of their places.
  function dealOrder(n) {
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = order[j];
      order[j] = order[k];
      order[k] = t;
    }
    return order;
  }

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
  /* Figures: a few arrangements have names of their own, found by moving stars into them -- two
     stars close together, three or more in a straight line, five or more in a ring, four or more
     mirrored left to right. Measured as the field is drawn (twice as wide as it is tall), so a
     ring on screen is a ring here. Pure arithmetic, like skyName. */
  function figureOf(list) {
    var t = skyTraits(list);
    if (!t || t.n < 2) return '';
    var i;
    if (t.n === 2) {
      var gx = (list[0].x - list[1].x) * 2;
      var gy = list[0].y - list[1].y;
      return gx * gx + gy * gy < 100 ? 'the twins' : '';
    }
    var xx = 0;
    var yy = 0;
    var xy = 0;
    var reach = [];
    var sum = 0;
    for (i = 0; i < t.n; i++) {
      var dx = (list[i].x - t.cx) * 2;
      var dy = list[i].y - t.cy;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
      var r = Math.sqrt(dx * dx + dy * dy);
      reach.push(r);
      sum += r;
    }
    var half = (xx + yy) / 2;
    var root = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) / 4 + xy * xy));
    var major = half + root;
    var minor = half - root;
    if (major > 100 * t.n && minor < major * 0.004) return t.n === 3 ? 'the belt' : 'the spear';
    if (t.n >= 5) {
      var mean = sum / t.n;
      var worst = 0;
      for (i = 0; i < t.n; i++) worst = Math.max(worst, Math.abs(reach[i] - mean));
      if (mean > 12 && worst < mean * 0.14) return 'the halo';
    }
    if (t.n >= 4) {
      var off = 0;
      var mirrored = true;
      for (i = 0; i < t.n && mirrored; i++) {
        var mx = 2 * t.cx - list[i].x;
        if (Math.abs(list[i].x - t.cx) * 2 > 6) off += 1;
        var found = false;
        for (var j = 0; j < t.n && !found; j++) {
          if (Math.abs((list[j].x - mx) * 2) < 6 && Math.abs(list[j].y - list[i].y) < 4) found = true;
        }
        mirrored = found;
      }
      if (mirrored && off >= 2) return 'the moth';
    }
    return '';
  }
  /* How near the sky is to a figure it does not make yet: the same measures as figureOf with
     looser tolerances, so a visitor moving stars toward a named shape is told, in plain words,
     what would complete it. Pure arithmetic, like figureOf. */
  function nearFigure(list) {
    var t = skyTraits(list);
    if (!t || t.n < 2 || figureOf(list)) return '';
    var i;
    var j;
    if (t.n === 2) {
      var gx = (list[0].x - list[1].x) * 2;
      var gy = list[0].y - list[1].y;
      return gx * gx + gy * gy < 400 ? 'twins, if these two stars were a little closer' : '';
    }
    var xx = 0;
    var yy = 0;
    var xy = 0;
    var reach = [];
    var sum = 0;
    for (i = 0; i < t.n; i++) {
      var dx = (list[i].x - t.cx) * 2;
      var dy = list[i].y - t.cy;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
      var r = Math.sqrt(dx * dx + dy * dy);
      reach.push(r);
      sum += r;
    }
    var half = (xx + yy) / 2;
    var skew = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) / 4 + xy * xy));
    var major = half + skew;
    var minor = half - skew;
    if (major > 100 * t.n && minor < major * 0.03) return 'a straight line, if every star lined up exactly';
    if (t.n >= 5) {
      var mean = sum / t.n;
      var worst = 0;
      for (i = 0; i < t.n; i++) worst = Math.max(worst, Math.abs(reach[i] - mean));
      if (mean > 12 && worst < mean * 0.3) return 'a ring, if every star sat the same distance from the middle';
    }
    if (t.n >= 4) {
      var off = 0;
      var matched = 0;
      for (i = 0; i < t.n; i++) {
        if (Math.abs(list[i].x - t.cx) * 2 > 6) off += 1;
        var mx = 2 * t.cx - list[i].x;
        for (j = 0; j < t.n; j++) {
          if (Math.abs((list[j].x - mx) * 2) < 16 && Math.abs(list[j].y - list[i].y) < 10) { matched += 1; break; }
        }
      }
      if (off >= 2 && matched === t.n) return 'a mirror image, if each star matched one opposite it, left to right';
    }
    return '';
  }
  function skyName(value) {
    var list = clean(value === undefined ? stars() : value);
    var t = skyTraits(list);
    if (!t) return '';
    if (t.n === 1) return 'the ' + SKY_NOUN.one[t.code % SKY_NOUN.one.length];
    var figure = figureOf(list);
    if (figure) return figure;
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
    return count + ', ' + knit + (where ? ', keeping to the ' + where : ', holding the middle of the sky')
      + (figureOf(list) ? ', a figure with a name of its own' : '');
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
    var drag = releaseDrag();
    var saved = read();
    if (saved.status !== 'unreadable' && sameStars(clean(saved.value), list)) {
      if (drag) refresh();
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
    var list = activeDrag ? serialize() : stars();
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
    var before = readDifficulty();
    if (before.set && before.level === want) {
      return !!(store && store.persistent !== false);
    }
    var kept = store ? store.set(DIFFICULTY, want) : false;
    var now = difficulty();
    if (sheet && sheet.host.open && before.level !== now.level) {
      noteSet('difficulty', sheet.tune && sheet.tune.querySelector('input'));
    }
    refresh();
    if (before.level === now.level) return kept;
    var subscribers = tuned.slice();
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](Object.assign({}, now), kept); }
      catch (e) { console.error('A difficulty listener failed', e); }
    }
    if (typeof window.CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('persona:difficulty', {
        detail: { difficulty: now, kept: kept }
      }));
    }
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
    var low = element('span', 'difficulty-end', LEVELS[0]);
    var high = element('span', 'difficulty-end', LEVELS[LEVELS.length - 1]);
    row.appendChild(label);
    row.appendChild(low);
    row.appendChild(input);
    row.appendChild(high);
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
      // The end word the handle has reached is sealed for a moment (_sass/_persona.scss, is-near).
      if (low.classList && typeof low.classList.toggle === 'function') {
        low.classList.toggle('is-near', at === 1);
        high.classList.toggle('is-near', at === LEVELS.length);
      }
      return at;
    }
    // The status line gets the real words at once (it is aria-live) and is revealed around them.
    function tell(level, kept) {
      var at = levelOf(level) || DEFAULT_LEVEL;
      say(status, 'Puzzles are set to ' + LEVELS[at - 1] + ': ' + LEVEL_SAYS[at - 1] + '.'
        + (kept === false ? ' Kept for this page only: this browser stores nothing between visits.' : ''));
    }
    paint(difficulty().level);
    tell(difficulty().level, store && store.persistent ? undefined : false);
    // Live while it is dragged, kept when it is let go: one write and one piece dealt again per
    // setting, not one per pixel the handle crosses.
    input.addEventListener('input', function () {
      var at = paint(input.value);
      tell(at, undefined);
    });
    function keep() {
      var at = levelOf(input.value) || DEFAULT_LEVEL;
      if (at === difficulty().level) { tell(at, store && store.persistent ? undefined : false); return; }
      var kept = setDifficulty(at);
      tell(at, kept);
      if (typeof opts.onChange === 'function') opts.onChange(difficulty(), kept);
    }
    input.addEventListener('change', keep);
    var release = onDifficulty(function (now, kept) {
      if (levelOf(input.value) === now.level) return; // this control's own change, already said
      paint(now.level);
      tell(now.level, kept);
    });
    return function () {
      release();
      if (host.contains(row)) host.textContent = '';
      host.classList.remove('difficulty');
    };
  }
  /* The sky, drawn whole -- or, with a `pass`, one tread of it: `pass.order` is the place each
     star has in the deal (a star at -1 is already in the sky), `pass.count` how many are being
     dealt and `pass.stars` the fraction of the deal so far, so a star and the lines to it are
     drawn only once its place has come up. Each tread draws more of the sky than the last and
     never less. The lines take the canvas's
     own CSS colour, read once a draw: Chromium resolves a context's 'currentColor' from the
     element's inline style alone and paints black for one set by a stylesheet, as these are. */
  function drawSky(ctx, list, w, h, pad, dotRadius, lineWidth, route, pass, guide) {
    var path = route || threadOf(list);
    var ink = skyInk(ctx);
    if (guide) drawFigureGuide(ctx, guide, w, h, pad, ink);
    var points = list.map(function (s) {
      return { x: pad + s.x / 100 * (w - pad * 2), y: pad + s.y / 100 * (h - pad * 2) };
    });
    var through = pass || null;
    function shown(index) {
      if (!through || !through.order || typeof through.stars !== 'number') return true;
      var at = through.order[index];
      return !(at >= 0) || at < through.stars * (through.count || points.length);
    }
    var maxDistanceSq = Math.pow(Math.min(w, h) * 0.3, 2);
    var used = Object.create(null);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    for (var i = 0; i < points.length; i++) {
      if (!shown(i)) continue;
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
        if (used[key] || !shown(nearest[k].j)) continue;
        used[key] = true;
        ctx.globalAlpha = 0.14 + (1 - nearest[k].d2 / maxDistanceSq) * 0.5;
        ctx.strokeStyle = ink;
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
    }
    if (path.length > 1) {
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = lineWidth * 2.8;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      var drawn = false;
      for (var r = 0; r < path.length; r++) {
        var point = points[path[r]];
        if (!shown(path[r])) { drawn = false; continue; }
        if (drawn) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
        drawn = true;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (var p = 0; p < points.length; p++) {
      if (!shown(p)) continue;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(236, 244, 255, 0.96)';
      ctx.arc(points[p].x, points[p].y, dotRadius * starGleam(list[p].text)
        * (path.indexOf(p) === -1 ? 1 : 1.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function skyInk(ctx) {
    var canvas = ctx.canvas;
    if (!canvas || typeof window.getComputedStyle !== 'function') return 'currentColor';
    return window.getComputedStyle(canvas).color || 'currentColor';
  }
  function sizeCanvas(canvas, w, h) {
    var dpr = window.devicePixelRatio || 1;
    var cw = Math.max(1, Math.round(w * dpr));
    var ch = Math.max(1, Math.round(h * dpr));
    // A backing store already the right size is cleared below, not made again.
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
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
    // While the sheet is open the portrait is behind the veil, where nobody sees it: it is neither
    // drawn nor cast there, however often the sky changes, and is drawn once as the sheet closes
    // (onSheetClosed calls this again).
    var behind = !!(sheet && sheet.host.open);
    // The first sky cast into an empty portrait while a visitor watches is a rite of its own
    // (castPortrait, below) -- for a sky placed in the sheet, as the sheet closes, held until the
    // mark carrying it home has landed (card.castAfter). A sky already there as the page arrives
    // comes with the corner's own arrival instead, since nobody watched it being cast.
    var cast = list.length && !behind && card.drawnCount === 0 && card.everDrawn ? castPortrait() : 0;
    // A reading first read while a visitor watches seals a ring onto the portrait (is-read); one
    // carried in from an earlier page is simply worn. Put on in the same frame data-asking goes
    // false below: the stylesheet's reading-seal is a name of its own, so the curve is cut afresh.
    if (isRead && card.everDrawn && !card.readDrawn) {
      rite(card.host, 'read', (cutOn(card.host, 'reading-seal', { family: 'arrive' }) || riteMs('medium', 320)) + 200);
    }
    // A sky that makes a named shape (figureOf) wears a solid ring inside the portrait, so the
    // corner says on every page that a figure was found (data-figure). Written as the portrait is
    // drawn, never behind the veil, so the ring is always round the sky the portrait shows; a ring
    // first worn while a visitor watches is sealed on (sealFigure), one carried in is simply worn.
    if (!behind) {
      var figure = figureOf(list);
      if (figure && card.everDrawn && !card.figureDrawn) sealFigure(cast);
      card.figureDrawn = !!figure;
      card.host.setAttribute('data-figure', figure ? 'true' : 'false');
      renderFigures(figure); // the sheet's marks, shut away with it, follow the saved sky
    }
    card.readDrawn = isRead;
    card.everDrawn = true;
    card.host.setAttribute('data-state', askingInCard ? 'asking' : (!list.length && !isRead ? 'empty' : 'ready'));
    card.host.setAttribute('data-reading', !isRead ? 'none' : (r.source === 'answer' ? 'answered' : 'carried'));
    card.host.setAttribute('data-asking', askingInCard ? 'true' : 'false');
    card.host.setAttribute('data-sky', list.length ? 'set' : 'none');
    card.host.setAttribute('data-difficulty', difficulty().name);
    // The corner is shown once it has read what it holds, and arrives behind a slice from the
    // right, the edge it is pinned to (_sass/_persona.scss, is-arriving), in treads rolled for it,
    // for as long as the arrival lasts and no longer.
    if (card.open.hidden) {
      card.open.hidden = false;
      var arrival = cutOn(card.open, 'avatar-in', { family: 'arrive', duration: 'long' });
      if (arrival) rite(card.open, 'arriving', arrival + 100);
    }
    var label = list.length || isRead ? 'open persona' : 'set up persona';
    var named = list.length ? skyName(list) : '';
    // The label is revealed only while it can be seen: beside the empty, beckoning avatar, or
    // printed beside the portrait under the pointer (is-waxing, js/motion.js).
    var shown = (!list.length && !isRead) || askingInCard
      || !!(card.open.classList && card.open.classList.contains('is-waxing'));
    if (card.label) say(card.label, named || label, !shown);
    else card.open.textContent = named || label;
    if (named) card.open.setAttribute('aria-label', label + ': ' + named);
    else card.open.removeAttribute('aria-label');
    if (card.portrait && !behind) {
      // Drawn whole, at once: what moves as the first sky is cast is the stylesheet's edge across
      // the portrait, not the drawing.
      card.drawnCount = list.length;
      paintPortrait(list);
    }
    if (behind) {
      // A star held in a drag is the visitor's until it is let go: the field is not dealt again
      // from what is saved under it.
      if (!activeDrag && !sameStars(serialize(), list)) renderField();
      renderReading();
      renderSkyAnswer();
    }
  }
  /* The portrait: the sky drawn small, whole, in one draw. What moves as the first sky is cast is
     the stylesheet's edge across it (_sass/_persona.scss, is-casting): one slice from the lower
     left cuts the drawn sky in and the waiting star away, in treads rolled for it and written on
     the corner for both to read (--ease-portrait-cast), after card.castAfter ms -- the mark's
     flight, when the sky came from the sheet, so the sky comes in when the mark carrying it has
     gone into the portrait and not on top of it. */
  function castPortrait() {
    var length = cutOn(card.host, 'portrait-cast', { duration: 'long' });
    if (!length) return 0;
    var after = card.castAfter || 0;
    card.host.style.setProperty('--portrait-cast-after', after + 'ms');
    rite(card.host, 'casting', length + after + 200);
    return length + after + 200;
  }
  /* The ring a named shape puts on the portrait, sealed on as the grammar seals what has been set:
     by one curve, from the portrait's lower left -- the side of the page the sky was shaped on, in
     the sheet below and to the left of this corner, and the way the mark carrying it comes home.
     After that mark has landed (card.castAfter), so the two say it one after the other; and for a
     first sky that is already a figure, after its cast (`cast`, the cast's whole length), since the
     ring is drawn on the layer the waiting star is cut away from and the stylesheet holds it off
     until is-casting has gone. The curve is on the ring only while it cuts (is-figured, taken off
     by its own end in buildCard, the clock the backstop): the ring a visitor wears stands unmasked. */
  function sealFigure(cast) {
    var length = cutOn(card.host, 'figure-seal', { family: 'arrive' });
    if (!length) return;
    var after = cast ? 0 : card.castAfter || 0;
    card.host.style.setProperty('--figure-seal-after', after + 'ms');
    rite(card.host, 'figured', (cast || after) + length * 2 + 400);
  }
  function paintPortrait(list) {
    if (!card || !card.portrait) return;
    var size = card.portraitSize;
    var ctx = sizeCanvas(card.portrait, size, size);
    if (!ctx || !list.length) return;
    var centre = skyTraits(list);
    var reach = 0;
    list.forEach(function (star) {
      var dx = (star.x - centre.cx) * 2;
      var dy = star.y - centre.cy;
      reach = Math.max(reach, Math.sqrt(dx * dx + dy * dy));
    });
    var scale = reach ? 46 / reach : 0;
    var miniature = list.map(function (star) {
      return { x: 50 + (star.x - centre.cx) * 2 * scale,
        y: 50 + (star.y - centre.cy) * scale, text: star.text };
    });
    drawSky(ctx, miniature, size, size, size * 0.15, size * 0.032, size * 0.018, threadOf(list), null);
  }
  // A question asked where the visitor cannot see it -- from the sheet, say, with the page scrolled
  // away from the threshold it is asked on -- is brought to them: the page steps to it by the
  // engine's own scroll (in its treads, or at once for a visitor who asked for less motion), the
  // question in the middle of the screen, or its first words near the top where the whole of it is
  // taller than the screen. Measured on the next frame, not as it is asked: the stage answers the
  // question's coming by putting away the piece it was showing above it (js/stage.js, render),
  // which moves the question up the page, and a scroll reckoned before that would carry the
  // visitor past it. One read; a question already in view moves nothing.
  function bringToView(node) {
    var tall = window.innerHeight || 0;
    if (!tall || !node || typeof node.getBoundingClientRect !== 'function' || !askingInCard) return;
    var box = node.getBoundingClientRect();
    if (!box || !box.height || (box.top >= 0 && box.top < tall * 0.6)) return;
    var by = box.height < tall ? box.top + box.height / 2 - tall / 2 : box.top - tall * 0.1;
    var to = (window.scrollY || window.pageYOffset || 0) + by;
    var m = engine();
    if (m && typeof m.scrollTo === 'function') m.scrollTo(to);
    else if (typeof window.scrollTo === 'function') window.scrollTo(0, Math.max(0, to));
  }
  // `arriving` is the question the threshold asks as the page arrives, which stands where the page
  // opens and is not scrolled to.
  function askInCard(arriving) {
    var t = window.threshold;
    if (!card || !card.probe || !t || typeof t.mount !== 'function' || askingInCard) return;
    if (sheet && sheet.host.open) closeSheet();
    askingInCard = true;
    // The question arrives with the stage's ask it stands in (js/stage.js lands it), so nothing is
    // rolled for it here. The ring the question puts on the portrait is struck in treads of its own,
    // by a curve that is on the ring for as long as it cuts and no longer (is-asked, put on in the
    // same task data-asking goes true, below).
    var strike = cutOn(card.host, 'portrait-ask', {});
    if (strike) rite(card.host, 'asked', strike * 2 + 400);
    card.probe.hidden = false;
    refresh();
    t.mount(card.probe, {
      onAnswer: function () { stopAskingInCard(true); card.open.focus(); },
      onSkip: function () { stopAskingInCard(true); card.open.focus(); }
    });
    // The focus goes to the question, not to an answer: onto the box that holds it, focusable for
    // that alone (tabindex -1, out of the tab order), so a screen reader is in the question and
    // the next Tab is its first answer. Put on an answer, a focus nobody gave from the keyboard
    // would be one the browser shows -- a ring, and the engine's wax -- and the first answer
    // would arrive looking already chosen. And without the browser's own scroll to it, as
    // js/threshold.js lends this box the focus: the box is tall, and the browser would put its
    // middle in the middle of the screen, scrolling a page that opens on the question down past
    // the question's own words. Where the page is scrolled away from it, bringToView brings it.
    if (typeof card.probe.focus === 'function') {
      card.probe.setAttribute('tabindex', '-1');
      card.probe.focus({ preventScroll: true });
      if (!arriving && typeof window.requestAnimationFrame === 'function') {
        var asked = card.probe;
        window.requestAnimationFrame(function () { bringToView(asked); });
      }
    }
  }
  // `closing` says the question is going away because it was finished, which is the persona closing
  // and the moment the hand-off below belongs to. Without it the question is only being put aside,
  // as openSheet does when the sheet opens over it, and nothing is being handed anywhere.
  function stopAskingInCard(closing) {
    if (!askingInCard) return;
    askingInCard = false;
    if (card && card.probe) {
      // The question's words are the threshold's to clear, so what is cut away is a ghost of it,
      // left where the question was (_sass/_persona.scss, .persona-probe.is-unmaking), going
      // toward the avatar the answer goes home to.
      if (!card.probe.hidden) ghostOf(card.probe, 'is-unmaking', '44', 'part-unmake', card.open);
      card.probe.textContent = '';
      card.probe.hidden = true;
      card.probe.removeAttribute('tabindex'); // focusable only while it holds a question
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
    card.drawnCount = 0;
    card.castAfter = 0;
    card.readDrawn = false;
    card.figureDrawn = false;
    card.open.addEventListener('click', function () { openSheet('sky', card.open); });
    // A ring's curve comes off the moment it has cut the ring in -- its own end, on the portrait's
    // ::before (the question's ring, the reading's) or its ::after (a named shape's ring) -- so the
    // ring a visitor wears stands unmasked; the clocks rite() keeps for is-asked, is-read and
    // is-figured are the backstop for a page too busy to draw the end.
    var seat = card.portrait && card.portrait.parentNode;
    if (seat && typeof seat.addEventListener === 'function') {
      seat.addEventListener('animationend', function (ev) {
        if (!ev || ev.target !== seat) return;
        if (ev.pseudoElement === '::before') endRite(card.host, ev.animationName === 'reading-seal' ? 'read' : 'asked');
        else if (ev.pseudoElement === '::after' && ev.animationName === 'figure-seal') endRite(card.host, 'figured');
      });
    }
    card.text.setAttribute('aria-live', 'polite');
    refresh();
  }

  /* ---- the hand-off: what was just set, going home to the avatar --------------------------- */

  /* A visitor sets something in the persona, the persona closes, and nothing says where the thing
     they just set now lives. So it is handed over on the way out: one small mark leaves the control
     that was set, flies across the page to the portrait in the corner, opens a ring around it as it
     lands and passes into it. That is the whole sentence the animation says -- "that thing you
     just configured lives there, in that menu" (issue #94) -- and it is said in the one place a
     visitor is looking at the moment they would otherwise lose it.

     Three decisions the issue left open, and the answers written here:
       Only when something was set. A close that changed nothing has nothing to point at, and a
       flourish on every close is one a visitor stops reading by the third time.
       One mark, for the last thing set. The sentence is singular, and two marks racing in would be
       noise rather than an answer.
       Each setting carries its own mark. The same flight, its own sign: the sky sends a star and
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
  var MARKS = { sky: '✦', reading: '◐' }; // the sign each setting sends home
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
     visitor just did in a menu they are watching close. A control set again and again (a star
     nudged key by key) is measured the first time, not at every press; where it stands as the
     sheet closes is read once more then (leaveSheetGhost), in case the sheet was scrolled since. */
  function noteSet(kind, node) {
    if (!MARKS[kind]) return;
    if (carried && carried.kind === kind && carried.node === node) return;
    carried = { kind: kind, node: node, from: leavesFrom(node) };
  }

  function sweep() {
    window.clearTimeout(flightTimer);
    flightTimer = null;
    if (flying) flying.remove();
    flying = null;
  }

  /* The persona is closing: whatever was set while it was open goes home to the portrait. Where it
     lands is read here, with the focus home, and not as the sheet closes: a focus brought home from
     the keyboard waxes the avatar, its name opens beside the portrait, and the corner, pinned at its
     right, grows to its left and takes the portrait with it. Read as the sheet closed, the flight
     would start that far to one side of the control it was set on. The page was restyled whole as
     the dialog closed (closeSheet), so what this read works out afresh is only what changed since:
     the avatar. */
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
      // The way home is the straight line from the control to the portrait: where it starts is
      // the whole of it (_sass/_persona.scss, persona-flight), and the slice it goes behind as it
      // lands points along that line, the way it came (--leave-angle). The treads it lands in, its
      // ring's and its going's are rolled for this flight alone; the lengths are the stylesheet's,
      // FLIGHT_MS whatever the roll says.
      var dx = Math.round(set.from.x - x);
      var dy = Math.round(set.from.y - y);
      mark.style.setProperty('--persona-flight-x', dx + 'px');
      mark.style.setProperty('--persona-flight-y', dy + 'px');
      if (dx || dy) mark.style.setProperty('--leave-angle', angleOf(-dx, -dy));
      treadsOn(mark, '--ease-persona-flight', 'arrive');
      treadsOn(mark, '--ease-persona-flight-ring', 'arrive');
      treadsOn(mark, '--ease-persona-sink', 'leave');
      // Gone when its own slice has cut it away; the clock below is the backstop.
      if (typeof mark.addEventListener === 'function') {
        mark.addEventListener('animationend', function (ev) {
          if (ev && ev.target === mark && !ev.pseudoElement && ev.animationName === 'cut-out' && flying === mark) sweep();
        });
      }
    }
    sweep();
    flying = mark;
    card.host.appendChild(mark);
    // A mark held still goes at STILL_MS. A flying one goes at the end of its own slice (above),
    // which ends with the flight's FLIGHT_MS on the animation's own clock; that clock starts with
    // the first frame the mark is drawn in, which on a busy close comes some way after this line,
    // so the backstop is given that room rather than racing the last tread and taking the mark
    // away by a switch.
    flightTimer = window.setTimeout(sweep, still ? STILL_MS : FLIGHT_MS * 2);
  }

  var fieldStars = [];
  var selected = -1;
  var activeDrag = null;
  var suppressClickUntil = 0;
  var openedBy = null;
  var sheetWasOpen = false;
  var sheetBox = null;
  function sheetStatus(text) { if (sheet && sheet.status) say(sheet.status, text); }
  var skyAnswerIndex = 0;
  var skyAnswerWanted = false;
  var skyAnswerTicket = 0;
  var skyAnswerStars = null;
  var skyAnswerAt = -1;
  var skyAnswerSample = null;
  var skyAnswerFirst = null;
  function resetSkyComparison() {
    skyAnswerFirst = null;
    if (!sheet || !sheet.comparison) return;
    sheet.comparison.open = false;
    conceal(sheet.comparison);
  }
  function rememberSkyAnswer(list, drawn) {
    if (!sheet || !sheet.comparison || !sheet.beforeCanvas || !sheet.beforePicture
        || skyAnswerFirst || !skyAnswerSample) return;
    skyAnswerFirst = list.map(cleanStar);
    say(sheet.beforeTitle, skyAnswerSample.title, true);
    var canvas = sheet.beforeCanvas;
    canvas.width = sheet.answerCanvas.width;
    canvas.height = sheet.answerCanvas.height;
    var ctx = drawn && canvas.width && canvas.height ? canvas.getContext('2d') : null;
    sheet.beforePicture.hidden = !ctx;
    if (ctx) {
      ctx.drawImage(sheet.answerCanvas, 0, 0);
      sheet.beforePicture.style.setProperty('aspect-ratio', skyAnswerSample.aspect);
    }
    say(sheet.beforeLine, (ctx ? '' : 'The first picture is unavailable here. ')
      + skyAnswerSample.line, true);
  }
  function renderSkyComparison(list) {
    if (!sheet || !sheet.comparison) return;
    if (!skyAnswerFirst || sameStars(skyAnswerFirst, list)) {
      conceal(sheet.comparison);
      return;
    }
    var samePlaces = skyAnswerFirst.length === list.length && skyAnswerFirst.every(function (star, i) {
      return star.x === list[i].x && star.y === list[i].y;
    });
    var sameWords = skyAnswerFirst.length === list.length && skyAnswerFirst.every(function (star, i) {
      return star.text === list[i].text;
    });
    var change = samePlaces ? 'Only the words have changed.'
      : sameWords ? 'Only the positions have changed.' : 'The stars or their words have changed.';
    say(sheet.beforeChange, change + ' This is the first preview; the current one is above. '
      + 'They may look alike: not every star affects every puzzle.', !sheet.comparison.open);
    show(sheet.comparison);
  }
  function drawSkyAnswer() {
    if (!sheet || !sheet.preview || !sheet.answerCanvas || !skyAnswerSample) return;
    show(sheet.preview);
    var box = sheet.preview.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ctx = sizeCanvas(sheet.answerCanvas, box.width, box.height);
    if (!ctx) {
      conceal(sheet.preview);
      say(sheet.answerLine, 'The picture cannot be drawn here. ' + skyAnswerSample.line);
      return;
    }
    try {
      skyAnswerSample.draw(ctx, box.width, box.height);
      return true;
    } catch (error) {
      conceal(sheet.preview);
      say(sheet.answerLine, 'This picture could not be drawn. ' + skyAnswerSample.line
        + ' You can preview another world.');
    }
  }
  function renderSkyAnswer() {
    if (!sheet || !sheet.host.open || !sheet.answer || !sheet.answerRead) return;
    var feed = window.interestingFeed;
    var list = stars();
    var off = !list.length || !feed || typeof feed.previewSky !== 'function';
    if (off) {
      conceal(sheet.answer);
      resetSkyComparison();
      skyAnswerTicket += 1;
      skyAnswerStars = null;
      skyAnswerSample = null;
      conceal(sheet.preview);
      conceal(sheet.answerWorld);
      conceal(sheet.answerTitle);
      say(sheet.answerLine, '', true);
      sheet.answerRead.disabled = false;
      return;
    }
    var answerArriving = show(sheet.answer);
    if (!skyAnswerWanted) return;
    // A star held in a drag: the preview waiting for the stars it was asked for is no longer the
    // sky's, so it is let go now (its ticket spent) rather than drawn when it comes, and a new one
    // is asked for when the move ends.
    if (activeDrag && activeDrag.moved) {
      skyAnswerTicket += 1;
      skyAnswerStars = null;
      return;
    }
    if (skyAnswerAt === skyAnswerIndex && skyAnswerStars && sameStars(skyAnswerStars, list)) return;
    var ticket = ++skyAnswerTicket;
    skyAnswerStars = list;
    skyAnswerAt = skyAnswerIndex;
    sheet.answerRead.disabled = true;
    say(sheet.answerLine, 'Making a preview from your stars.', answerArriving);
    feed.previewSky(skyAnswerIndex).then(function (sample) {
      if (ticket !== skyAnswerTicket || !sheet.host.open) return;
      skyAnswerSample = sample;
      sheet.answer.setAttribute('data-mood', sample.world.mood);
      ['bg', 'bg2', 'accent', 'accent2'].forEach(function (name) {
        sheet.answer.style.setProperty('--' + name, sample.colors[name]);
      });
      say(sheet.answerWorld, sample.world.name, show(sheet.answerWorld));
      say(sheet.answerTitle, sample.title, show(sheet.answerTitle));
      sheet.answerNote.textContent = 'Current preview. Move a star or change its words, then compare with the first preview. Press the preview button to try another world. Comparing does not change your stars.';
      sheet.preview.style.setProperty('aspect-ratio', sample.aspect);
      say(sheet.answerLine, sample.line);
      sheet.answerLabel.textContent = 'preview another world';
      sheet.answerRead.disabled = false;
      rememberSkyAnswer(list, drawSkyAnswer());
      renderSkyComparison(list);
    }).catch(function () {
      if (ticket !== skyAnswerTicket || !sheet.host.open) return;
      skyAnswerStars = null;
      skyAnswerSample = null;
      conceal(sheet.comparison);
      conceal(sheet.preview);
      conceal(sheet.answerWorld);
      conceal(sheet.answerTitle);
      say(sheet.answerLine, 'This preview could not be opened. Your sky is unchanged; you can try another world here or use the cards below.');
      sheet.answerLabel.textContent = 'preview another world';
      sheet.answerRead.disabled = false;
    });
  }
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
    say(sheet.neighbor, line);
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
  // The name under the field follows each move, including a drag. The line keeps its room while the
  // sky has no name (buildSheet shows it for good, and the stylesheet sizes it for a first star's
  // name), so the first star placed most often moves nothing under it: the name's words are cut
  // into a line already there, by the reveal's slice, and cut away from it when the sky is
  // cleared. A first name longer than the room kept for it -- a register that sets it wide, on a
  // narrow sheet -- pushes what is under it down, and that steps there (makeRoom) rather than
  // jumping; a name renamed later, by a drag, is left to take the room it takes. A sky close to a
  // named shape it does not make yet says so after its name, with what would complete it
  // (nearFigure), so a visitor moving stars toward one is told how near they are. That hint is a
  // sentence of its own, long enough to take the line onto another (two more, on a phone), and a
  // single arrow key brings it or takes it away -- most often as the same key finds or loses a
  // figure, whose name is set in the serif (data-figure), at a height and a width of its own. So
  // a line whose hint comes, goes or changes, or whose figure is found or lost, takes its new
  // words and its new face in the one change that steps what is under it there (makeRoom), as a
  // first name does, and never jumps it. Only then: a move that keeps both reads no layout for it.
  var nameHint = '';
  function renderName() {
    if (!sheet || !sheet.name) return;
    var list = serialize();
    var named = skyName(list);
    var figure = figureOf(list) ? 'true' : 'false';
    if (!named) {
      nameHint = '';
      // The serif goes once the words it set have been cut away, not under them as they go.
      conceal(sheet.name, true, function (hide) {
        makeRoom(function () {
          hide();
          sheet.name.setAttribute('data-figure', 'false');
        });
      });
      return;
    }
    var near = figure === 'true' || guiding ? '' : nearFigure(list);
    var hint = near ? '. Close to a named shape: ' + near + '.' : '';
    var line = '✦ ' + named + ' — ' + skyRead(list) + hint;
    var room = !sheet.name.textContent || hint !== nameHint || sheet.name.getAttribute('data-figure') !== figure;
    nameHint = hint;
    function write() {
      sheet.name.setAttribute('data-figure', figure);
      say(sheet.name, line, show(sheet.name));
    }
    if (room) makeRoom(write);
    else write();
  }
  /* The named shapes, as marks under the sky: the one the sky makes now is lit, and a press on any
     of them says in plain words how it is made and how near the sky is to it. What the sky is now,
     never a record of what it was. A mark is a control like any other: a press stamps it, and lit
     is a set state (data-set), which js/motion.js seals -- its fill grown as a curve and left
     standing in two shades -- and unseals by a slice when the sky stops making the shape
     (_sass/_persona.scss, _controls.scss). The marks are made once, with the sheet, each written
     as the saved sky stands before it is put in the page, so none is sealed as it is made; and
     while the sheet is shut they follow the saved sky (refresh), so a sheet opening onto a sky
     changed elsewhere has nothing to seal inside its own arrival. Nobody sees a mark change while
     the sheet is shut, so the engine passes that change over (markFigure): a seal begun on a
     hidden mark would wait for the sheet and play inside its arrival. */
  var FIGURES = [
    { name: 'the twins', rule: 'exactly two stars, side by side', min: 2, max: 2 },
    { name: 'the belt', rule: 'exactly three stars in a straight line', min: 3, max: 3 },
    { name: 'the spear', rule: 'four or more stars in a straight line', min: 4 },
    { name: 'the halo', rule: 'five or more stars, all the same distance from their middle', min: 5 },
    { name: 'the moth', rule: 'four or more stars, each matched by one opposite it, left to right', min: 4 }
  ];
  var guiding = null;
  function figureTargets(f, count) {
    var n = Math.max(f.min, Math.min(f.max || MAX_STARS, count));
    var points = [];
    var i;
    if (f.name === 'the moth') {
      var pairs = Math.floor(n / 2);
      for (i = 0; i < pairs; i++) {
        var offset = i % 2 ? 10 : 26;
        var y = 14 + i * 72 / (pairs - 1);
        points.push({ x: 50 - offset, y: y }, { x: 50 + offset, y: y });
      }
      if (n % 2) points.push({ x: 50, y: 50 });
    } else {
      for (i = 0; i < n; i++) {
        if (f.name === 'the halo') {
          var angle = i / n * Math.PI * 2 - Math.PI / 2;
          points.push({ x: 50 + Math.cos(angle) * 17, y: 50 + Math.sin(angle) * 34 });
        } else points.push({ x: f.name === 'the twins' ? 49 + i * 2 : 16 + i * 68 / (n - 1), y: 50 });
      }
    }
    return points;
  }
  function prepareFigureGuide() {
    if (!guiding) return;
    if (guiding.stars && guiding.stars.length === fieldStars.length
        && guiding.stars.every(function (star, i) { return star === fieldStars[i]; })) return;
    guiding.stars = fieldStars.slice();
    guiding.points = figureTargets(guiding.figure, fieldStars.length);
    var spare = guiding.points.slice();
    guiding.targets = fieldStars.map(function (star) {
      var nearest = -1;
      var distance = Infinity;
      for (var i = 0; i < spare.length; i++) {
        var dx = (spare[i].x - star.x) * 2;
        var dy = spare[i].y - star.y;
        var gap = dx * dx + dy * dy;
        if (gap < distance) { distance = gap; nearest = i; }
      }
      return nearest < 0 ? null : spare.splice(nearest, 1)[0];
    });
  }
  function guideMove(star, target) {
    var moves = [];
    function axis(gap, forward, backward) {
      if (Math.abs(gap) <= 1) return;
      var presses = Math.round(Math.abs(gap) / 2);
      moves.push(presses + ' ' + (gap > 0 ? forward : backward)
        + '-arrow ' + (presses === 1 ? 'press' : 'presses'));
    }
    axis(target.x - star.x, 'right', 'left');
    axis(target.y - star.y, 'down', 'up');
    return moves.length ? 'Move this star with about ' + moves.join(' and ')
      + ', or drag it to its hollow circle.'
      : 'This star is close to its hollow circle. Choose another star to move.';
  }
  function renderFigureGuide() {
    if (!sheet || !sheet.guide) return;
    for (var i = 0; i < fieldStars.length; i++) {
      var star = fieldStars[i].el;
      if (!star) continue;
      if (guiding) star.setAttribute('aria-describedby', 'persona-figure-guide');
      else star.removeAttribute('aria-describedby');
    }
    if (!guiding) { conceal(sheet.guide, false, makeRoom); return; }
    prepareFigureGuide();
    var f = guiding.figure;
    var count = fieldStars.length;
    var next;
    if (count < f.min) {
      var need = f.min - count;
      next = 'Add ' + need + ' more ' + (need === 1 ? 'star' : 'stars')
        + ' using drop a star. The hollow circles show where this shape can go.';
    } else if (f.max && count > f.max) {
      next = 'This shape needs exactly ' + f.max + ' stars. Remove ' + (count - f.max)
        + ' using remove this star, or choose another guide.';
    } else if (figureOf(fieldStars) === f.name) {
      next = 'Your sky makes it now. Close the sheet to carry the shape and its ring in your portrait, or keep shaping.';
    } else if (selected >= 0 && guiding.targets[selected]) {
      next = guideMove(fieldStars[selected], guiding.targets[selected]);
    } else {
      next = 'Choose a star to see its route to a hollow circle. Drag it there or use its arrow keys.';
    }
    var line = f.name + ': ' + next;
    function write() { say(sheet.guide, line, show(sheet.guide)); }
    if (sheet.guide.hidden) makeRoom(write, [sheet.guide]);
    else write();
  }
  function drawFigureGuide(ctx, guide, w, h, pad, ink) {
    function point(p) {
      return { x: pad + p.x / 100 * (w - pad * 2), y: pad + p.y / 100 * (h - pad * 2) };
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    guide.points.forEach(function (target) {
      var p = point(target);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    });
    var target = selected >= 0 && guide.targets[selected];
    if (target && fieldStars[selected]) {
      var from = point(fieldStars[selected]);
      var to = point(target);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(to.x, to.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function tellFigure(f) {
    guiding = guiding && guiding.figure === f ? null : { figure: f, stars: null, points: [], targets: [] };
    drawField();
    if (!guiding) sheetStatus(f.name + ' guide hidden. Your stars stay as they are.');
  }
  // One mark written as lit or not: only what has changed is written, so a drag that keeps the sky
  // in or out of a shape writes nothing here. A mark lit or unlit in a shut sheet is passed over
  // by the engine (data-rite='none') until the engine has heard of the change, which it does after
  // the task that made it -- so also when a sky is set and the sheet opened in one go -- and is
  // the engine's again at once, so a hover, a press or a pointer leaving it plays as on any
  // control.
  function markFigure(chip, f, on) {
    var words = (on ? '✦ ' : '✧ ') + f.name;
    var expanded = !!(guiding && guiding.figure === f);
    var label = f.name + ': ' + f.rule + (on ? '. Your sky makes this now.' : '')
      + (expanded ? '. Guide shown; press to hide it.' : '. Press for a guide.');
    if (on ? chip.getAttribute('data-set') !== 'true' : chip.hasAttribute('data-set')) {
      var unseen = chip.isConnected && !sheet.host.open && typeof Promise === 'function' && !chip.hasAttribute('data-rite');
      if (unseen) chip.setAttribute('data-rite', 'none');
      if (on) chip.setAttribute('data-set', 'true');
      else chip.removeAttribute('data-set');
      // Queued after the change, so after the engine is told of it.
      if (unseen) Promise.resolve().then(function () { chip.removeAttribute('data-rite'); });
    }
    if (chip.textContent !== words) chip.textContent = words;
    if (chip.getAttribute('aria-label') !== label) chip.setAttribute('aria-label', label);
    if (chip.getAttribute('aria-expanded') !== String(expanded)) chip.setAttribute('aria-expanded', String(expanded));
  }
  function buildFigures() {
    if (!sheet || !sheet.figures || sheet.figureChips) return;
    var made = figureOf(stars());
    sheet.figureChips = FIGURES.map(function (f) {
      var chip = element('button', 'persona-figure');
      chip.type = 'button';
      chip.setAttribute('aria-controls', 'persona-figure-guide');
      markFigure(chip, f, made === f.name);
      chip.addEventListener('click', function () { tellFigure(f); });
      sheet.figures.appendChild(chip);
      return chip;
    });
  }
  // `made` is the shape the sky makes ('' for none), where the caller has it; the field's own
  // stars otherwise.
  function renderFigures(made) {
    if (!sheet || !sheet.figureChips) return;
    if (made === undefined) made = figureOf(serialize());
    for (var i = 0; i < FIGURES.length; i++) markFigure(sheet.figureChips[i], FIGURES[i], made === FIGURES[i].name);
  }
  function renderThread() {
    var path = threadOf(fieldStars, selected);
    for (var i = 0; i < fieldStars.length; i++) {
      var el = fieldStars[i].el;
      if (!el) continue;
      var place = path.indexOf(i);
      if (place < 0) {
        // A place taken away goes as it came, not at once: the old number stays on the star
        // (data-thread-was, is-unthreaded, _sass/_persona.scss) while the badge goes back into its
        // centre. A badge still going is left to finish rather than started again, so this loop
        // over the sky never reads the layout.
        var was = el.getAttribute('data-thread');
        if (was && engine() && !calm() && !el.classList.contains('is-unthreaded')) {
          el.setAttribute('data-thread-was', was);
          rite(el, 'unthreaded', riteMs('medium', 320) + 100);
        }
        el.removeAttribute('data-thread');
      } else {
        // A place kept under a new number (another star chosen, a drag) is stamped again with it:
        // is-renumbered flips, and with it the name of the badge's animation, which is what starts
        // a stamp again (_sass/_persona.scss, thread-restamp). The digit never changes in place.
        var number = String(place + 1);
        var had = el.getAttribute('data-thread');
        if (had && had !== number && engine() && !calm()) {
          cutOn(el, 'thread-stamp', { family: 'flicker', alias: 'thread-restamp' });
          el.classList.toggle('is-renumbered');
        }
        el.setAttribute('data-thread', number);
      }
    }
    if (sheet && sheet.thread) {
      var words = path.length < 2 ? '' : path.map(function (index) {
        var text = fieldStars[index].text.trim();
        return text ? '“' + text + '”' : 'a star without words';
      }).join(' → ');
      var thread = sheet.thread;
      if (words && thread.hidden) makeRoom(function () { say(thread, words, show(thread)); }, [thread]);
      else if (words) say(thread, words, show(thread));
      else {
        conceal(thread, false, makeRoom);
        if (thread.hidden) say(thread, '', true);
      }
    }
    return path;
  }
  function namedLine() {
    var list = serialize();
    var named = skyName(list);
    if (!named) return '';
    if (figureOf(list)) return ' A figure with a name of its own: ' + named + '.';
    var near = guiding ? '' : nearFigure(list);
    return ' Your sky reads as ' + named + ' now.' + (near ? ' Close to a named shape: ' + near + '.' : '');
  }
  function paintField(pass, measured) {
    if (!sheet || !sheet.field || !sheet.canvas) return;
    var box = measured || sheet.field.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ctx = sizeCanvas(sheet.canvas, box.width, box.height);
    if (ctx) drawSky(ctx, fieldStars, box.width, box.height, 22, 0, 1.1, threadOf(fieldStars, selected), pass, guiding);
  }
  // The field redrawn: its name, its thread and the lines between its stars -- at the tread the
  // sky is at, if it is still being cast, so a star chosen or dragged mid-cast joins the cast
  // rather than cutting it short. `box` is the field's, where a drag has already measured it.
  function drawField(box) {
    renderName();
    renderFigures();
    renderThread();
    renderNeighbor();
    renderFigureGuide();
    paintField(fieldCast ? fieldCast.pass : null, box);
  }
  /* The lines of the sky drawn in treads (README: "Motion axiom"): when the sheet opens its sky or
     a star is added, each star's lines arrive at the star's place in the deal (`order`, -1 for a
     star already in the sky), on the treads of a landing stair the engine rolls for this one deal
     -- the first the longest way, each after it shorter -- each tread drawing more of the sky than
     the last, and the last drawing it whole. A tread is one draw, at the moment the stair steps,
     and nothing is drawn between. The stars themselves are buttons, dealt by the stylesheet to the
     same order (is-placed, --d). One draw without the engine. */
  var fieldCast = null;
  function stopFieldCast() {
    if (!fieldCast) return;
    window.clearTimeout(fieldCast.timer);
    fieldCast = null;
  }
  function castField(order) {
    stopFieldCast();
    var m = engine();
    var jumps = m && !calm() && typeof m.curve === 'function' ? jumpsOf(m.curve('arrive')) : [];
    if (!jumps.length || !sheet || !sheet.canvas || typeof window.setTimeout !== 'function') {
      paintField(null);
      return;
    }
    var count = 0;
    for (var i = 0; i < order.length; i++) if (order[i] >= 0) count += 1;
    var total = riteMs('long', 500) * 1.6;
    var cast = { pass: { order: order, count: count, stars: 0 }, timer: 0 };
    var at = 0;
    fieldCast = cast;
    function tread() {
      if (fieldCast !== cast) return;
      var jump = jumps[at];
      at += 1;
      if (at >= jumps.length || jump[1] >= 1) {
        fieldCast = null;
        paintField(null);
        return;
      }
      cast.pass = { order: order, count: count, stars: jump[1] };
      paintField(cast.pass);
      cast.timer = window.setTimeout(tread, total * (jumps[at][0] - jump[0]));
    }
    paintField(cast.pass);
    cast.timer = window.setTimeout(tread, total * jumps[0][0]);
  }
  /* The parts that come and go between the sky and what stands under it -- the thread, the words
     form, the remove button, a first name longer than the room the line keeps for it, and the
     hint after a name that a sky close to a named shape is given (renderName) -- push
     all of that (the marks of the named shapes, the sky's other controls, its status line, its
     preview, the sections after it) down as they come and let it up as they go. What they push
     steps there in the landing's treads, on one stair for all of it (the engine's flip), instead of
     jumping in the one frame the form appears, from under a pointer that was on 'drop a star' a
     moment before. Only what was shown before the change is stepped. What comes with it
     (`arrivals`) takes its room at once and waits there, cut away, until what it pushed has stepped
     aside, and is cut in only then: one movement after the other, and never the new part's words
     under the old controls passing over them. A step still under way when the next change comes
     (the name and then the form, for a star dropped on an empty sky) is measured where it stands
     and taken off as the next begins from there, so the two are one stair and never a step back.
     Not while the sheet is being opened, which arrives whole by its own one edge; and nothing
     moves for a visitor who asked for less motion. */
  var stepping = [];
  function makeRoom(change, arrivals) {
    var m = engine();
    if (dealing || !m || calm() || typeof m.flip !== 'function' || !sheet || !sheet.host.open) {
      change();
      return;
    }
    var parts = [sheet.guide, sheet.name, sheet.thread, sheet.figures, sheet.wordsForm, sheet.drop, sheet.seed, sheet.remove, sheet.clear, sheet.status, sheet.answer];
    var section = sheet.field.parentNode;
    for (var next = section ? section.nextElementSibling : null; next; next = next.nextElementSibling) parts.push(next);
    var items = parts.filter(function (part) { return part && !part.hidden; });
    var changed = false;
    try {
      stepping = m.flip(null, function () {
        changed = true;
        for (var i = 0; i < stepping.length; i++) stepping[i].cancel();
        stepping = [];
        change();
      }, { items: items, dealt: false }) || [];
    } catch (e) {
      console.error('The sheet could not step aside', e);
      if (!changed) change();
      return;
    }
    var wait = 0;
    for (var s = 0; s < stepping.length; s++) {
      var timing = stepping[s].effect && typeof stepping[s].effect.getTiming === 'function' ? stepping[s].effect.getTiming() : null;
      if (timing && Number(timing.duration) > wait) wait = Math.round(Number(timing.duration));
    }
    if (!wait || !arrivals) return;
    for (var a = 0; a < arrivals.length; a++) {
      var part = arrivals[a];
      if (!part || !part.classList || !part.classList.contains('is-arriving')) continue;
      part.style.setProperty('--part-wait', wait + 'ms');
      holdRite(part, 'arriving', wait + riteMs('medium', 320) * 2 + 100);
    }
  }
  function select(index) {
    var changed = selected !== index;
    selected = index;
    for (var i = 0; i < fieldStars.length; i++) {
      if (fieldStars[i].el) fieldStars[i].el.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    }
    if (index < 0) {
      conceal(sheet.remove, false, makeRoom);
      conceal(sheet.wordsForm, false, makeRoom);
    } else {
      var parts = function () {
        show(sheet.remove);
        show(sheet.wordsForm);
      };
      if ((sheet.remove && sheet.remove.hidden) || (sheet.wordsForm && sheet.wordsForm.hidden)) {
        makeRoom(parts, [sheet.remove, sheet.wordsForm]);
      } else parts();
    }
    if (index >= 0) {
      if (changed && sheet.words) sheet.words.value = fieldStars[index].text;
      sheetStatus('✦ ' + fieldStars[index].text + ' (' + (index + 1) + ' of ' + fieldStars.length + ')');
    }
    drawField();
  }
  // The focus put on a star, which chooses it as any focus on a star does. `place` says it is being
  // placed instead (a seeded sky's first): the focus goes to it, so the arrow keys move it, but it
  // is not chosen by that focus -- it is placed first, and chosen by the next press -- so it arrives
  // as its light alone, and not as its light, its seal, the words form and the remove button all at
  // once. Nothing else stays chosen while it holds the focus, either: the words form and the remove
  // button act on the chosen star, and a star the focus has left behind is not the one a visitor is
  // on.
  var placing = null;
  function focusStar(index, place) {
    var star = fieldStars[index];
    var target = star && star.el ? star.el : sheet.drop;
    if (!target) return;
    placing = place && star && star.el ? star.el : null;
    if (placing && selected >= 0) select(-1);
    try { target.focus(); }
    finally { placing = null; }
  }
  function pointInField(clientX, clientY, measured) {
    var box = measured || sheet.field.getBoundingClientRect();
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
    // The light is a child of the button, so the edges it is cut by -- its arrival, its state
    // layer's wax -- cut the light alone and the thread badge stays legible (_sass/_persona.scss,
    // .persona-star-light). Nothing is read from it: the button keeps its name, its press and its
    // place.
    var light = document.createElement('span');
    light.className = 'persona-star-light';
    light.setAttribute('aria-hidden', 'true');
    el.appendChild(light);
    star.el = el;
    placeElement(star);
    function locate() {
      index = fieldStars.indexOf(star);
      return index >= 0;
    }
    el.addEventListener('focus', function () { if (placing !== el && locate()) select(index); });
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (Date.now() < suppressClickUntil || !locate()) return;
      select(index);
    });
    el.addEventListener('pointerdown', function (ev) {
      if (activeDrag || (typeof ev.button === 'number' && ev.button !== 0) || !locate()) return;
      ev.preventDefault();
      ev.stopPropagation();
      // The field's box, read once for the drag: it does not move under a star being dragged.
      activeDrag = { index: index, pointerId: ev.pointerId, moved: false, box: sheet.field.getBoundingClientRect() };
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
      if (!locate()) return;
      var step = ev.shiftKey ? 6 : 2;
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        var fromX = star.x;
        var fromY = star.y;
        star.x = Number(clamp(star.x + moves[ev.key][0], 1, 99).toFixed(2));
        star.y = Number(clamp(star.y + moves[ev.key][1], 1, 99).toFixed(2));
        placeElement(star);
        nudge(star.el, star.x - fromX, star.y - fromY);
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
  /* A star taken out of the sky is cut away where it was: the button itself goes at once (the list
     is the list), and a ghost of it -- a copy with no name, no press and no place in the thread --
     is left in its place for the stylesheet to cut back into its point by a curve
     (_sass/_persona.scss, .persona-star-ghost), and taken out when the cut ends. */
  function unmakeStar(el) {
    var m = engine();
    if (!m || calm() || !el || typeof el.cloneNode !== 'function' || !el.parentNode
        || typeof el.parentNode.insertBefore !== 'function' || typeof window.setTimeout !== 'function') return;
    var ghost = el.cloneNode(true); // with the light inside it, which is what is seen to go
    ghost.className = 'persona-star persona-star-ghost';
    var light = ghost.querySelector ? ghost.querySelector('.persona-star-light') : null;
    if (light) light.className = 'persona-star-light';
    ghost.removeAttribute('id');
    ghost.removeAttribute('aria-pressed');
    ghost.removeAttribute('aria-label');
    ghost.removeAttribute('data-thread');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('tabindex', '-1');
    ghost.setAttribute('inert', '');
    var length = leaveOn(ghost, 'star-unmake');
    el.parentNode.insertBefore(ghost, el);
    // The ghost's own cut ending takes it out -- not a part's inside it, whose end bubbles.
    function gone(ev) {
      if (ev && ev.target && ev.target !== ghost) return;
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }
    ghost.addEventListener('animationend', gone);
    ghost.addEventListener('animationcancel', gone);
    window.setTimeout(gone, Math.max(length, riteMs('medium', 320)) * 2 + 400);
  }
  /* The field drawn from the saved sky. A star that is where it was keeps its button (so it is not
     re-dealt every time another is added); one that is gone is cut away; the new ones are dealt in
     a rolled order, each growing as a curve from its own point a rolled stagger after the last
     (is-placed, --d), with the lines of the sky cast to the same order. `dealAll` deals the whole
     sky again, as the sheet does when it opens. */
  function renderField(dealAll) {
    if (!sheet || !sheet.field) return;
    stopFieldCast();
    var old = fieldStars;
    // The chosen star stays chosen when the sky is drawn again around it (a star placed or taken
    // out elsewhere in it), so a press on the sky places a star and does nothing else besides.
    var chosen = !dealAll && selected >= 0 ? old[selected] : null;
    activeDrag = null;
    var saved = read();
    var fresh = [];
    var order = [];
    // A star is the same star by what it is, not by its place in the list: one taken out shifts
    // every star after it by one, and those stay where they are rather than being cut away and
    // dealt again.
    var keep = Object.create(null);
    if (!dealAll) {
      for (var o = 0; o < old.length; o++) {
        var it = old[o];
        if (!it || !it.el || it.el.parentNode !== sheet.field) continue;
        var key = it.x + '|' + it.y + '|' + it.text;
        (keep[key] = keep[key] || []).push(o);
      }
    }
    fieldStars = clean(saved.value).map(function (s, j) {
      var same = keep[s.x + '|' + s.y + '|' + s.text];
      var at = same && same.length ? same.shift() : -1;
      var was = at >= 0 ? old[at] : null;
      if (was) {
        old[at] = null;
        if (was.el.classList) was.el.classList.remove('dragging');
        order.push(-1);
        return was;
      }
      order.push(0);
      fresh.push(j);
      return { x: s.x, y: s.y, text: s.text, el: null };
    });
    for (var i = 0; i < old.length; i++) {
      if (!old[i] || !old[i].el) continue;
      if (!dealAll) unmakeStar(old[i].el);
      old[i].el.remove();
    }
    for (var j = 0; j < fieldStars.length; j++) if (!fieldStars[j].el) createStarElement(fieldStars[j], j);
    var deal = dealOrder(fresh.length);
    var m = engine();
    for (var k = 0; k < deal.length; k++) {
      var at = fresh[deal[k]];
      order[at] = k;
      var el = fieldStars[at].el;
      if (!m || calm() || !el || !el.style || typeof el.style.setProperty !== 'function') continue;
      var wait = deal.length > 1 && typeof m.stagger === 'function' ? Math.round(m.stagger(k)) : 0;
      el.style.setProperty('--d', wait + 'ms');
      // Each star's own treads, then the class: a fresh button, so nothing is read to start it.
      var length = cutOn(el, 'star-develop', { family: 'arrive', duration: 'long' });
      rite(el, 'placed', (length || riteMs('long', 500)) + wait + 200);
    }
    select(chosen ? fieldStars.indexOf(chosen) : -1);
    sheetStatus(saved.status === 'unreadable'
      ? 'What this browser kept of your sky cannot be read, so it starts fresh. Tap the sky to place a star.'
      : fieldIntro(fieldStars) + keptNote(true));
    if (fresh.length) castField(order);
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
  function releaseDrag() {
    if (!activeDrag) return null;
    var drag = activeDrag;
    activeDrag = null;
    var star = fieldStars[drag.index];
    if (star && star.el) {
      // Set down: the lift comes off, and the star comes back to its size in treads.
      star.el.classList.remove('dragging');
      if (star.el.releasePointerCapture) {
        try { star.el.releasePointerCapture(drag.pointerId); }
        catch (e) { console.error('Could not release the dragged star', e); }
      }
    }
    if (drag.moved) suppressClickUntil = Date.now() + DRAG_SUPPRESS_MS;
    return drag;
  }
  function endDrag(pointerId) {
    if (!activeDrag || activeDrag.pointerId !== pointerId) return;
    var drag = releaseDrag();
    if (drag.moved) {
      var kept = setStars(serialize(), 'moved');
      sheetStatus('Moved.' + namedLine() + keptNote(kept));
      renderSkyAnswer();
    }
  }
  function renderReading() {
    if (!sheet || !sheet.reading) return;
    var r = reading();
    var isRead = readOf(r);
    say(sheet.reading, describeReading(r) + keptClause());
    if (sheet.forget) {
      if (isRead) show(sheet.forget);
      else conceal(sheet.forget);
    }
    if (sheet.readingGo) {
      if (isRead) {
        var goArriving = show(sheet.readingGo);
        sheet.readingGo.href = root + r.orientation.world;
        say(sheet.readingGo, r.orientation.worldName, goArriving);
      } else conceal(sheet.readingGo);
    }
  }
  function renderSheet(dealAll) { renderField(dealAll); renderReading(); renderSkyAnswer(); }
  /* The sheet closing is a modal dialog closing: it has to close at once for the focus to go home
     and the veil to come down, so what is cut away is a ghost of it, left where the sheet was
     (_sass/_persona.scss, .persona-sheet.persona-ghost) and going toward the control the focus
     goes home to -- scrolled where the sheet was and showing its pictures (ghostOf). Made before
     the dialog closes -- a shut dialog has no box to measure -- by closeSheet, whichever way the
     sheet is closed; and the last moment, too, to read where a control that was set stands, for
     the mark the hand-off flies from it. Everything it reads it reads before it writes anything,
     the ghost included. */
  var sheetGhost = null;
  function dropSheetGhost() {
    if (sheetGhost && sheetGhost.parentNode) sheetGhost.parentNode.removeChild(sheetGhost);
    sheetGhost = null;
  }
  function leaveSheetGhost() {
    if (!sheet || !sheet.host.open) return;
    if (carried && carried.node && typeof sheet.host.contains === 'function' && sheet.host.contains(carried.node)) {
      carried.from = leavesFrom(carried.node);
    }
    dropSheetGhost();
    sheetGhost = ghostOf(sheet.host, 'persona-ghost', null, 'sheet-out', openedBy || (card && card.open));
  }
  function openSheet(section, opener) {
    if (!sheet) return;
    var fresh = !sheet.host.open;
    // Read before anything is written. The control the sheet comes out of is measured first, on the
    // page as the visitor left it: once the page is put aside (sheetBox.up, which makes every other
    // child of the body inert) the browser has to work out the style of the whole document again
    // before it can answer for one box, and it would do that here, inside the press, and again for
    // the dialog. Read now, it costs nothing; the one whole-document restyle the inert page needs
    // is the one showModal() does.
    var from = null;
    if (fresh) {
      openedBy = opener || document.activeElement || (card && card.open);
      from = middleOf(openedBy);
    }
    stopAskingInCard();
    if (fresh) {
      // A fresh visit: only what is set from here on is handed over on the way out, and a mark
      // still in the air from the last visit is taken away rather than stilled behind the veil,
      // as is a ghost of the sheet still leaving.
      carried = null;
      sweep();
      dropSheetGhost();
      if (sheetBox) sheetBox.up();
      // The sheet comes out of the control that opened it: the way and the treads are written
      // before it is shown, so its first frame is already the arrival's (is-arriving), and the
      // class comes off when the arrival is done.
      var arrival = arriveFrom(sheet.host, 'sheet-in', from);
      if (typeof sheet.host.showModal === 'function') sheet.host.showModal();
      else { sheet.host.setAttribute('open', ''); sheet.host.classList.add('persona-sheet-fallback'); }
      if (arrival) rite(sheet.host, 'arriving', arrival + 100);
      sheetWasOpen = true;
    }
    // Everything the sheet holds as it opens -- its title, its lines, the parts it shows -- comes
    // with the sheet's one edge, written into it quietly; only the sky is dealt into it, star by
    // star, as it was placed. The first star takes the focus as it is dealt and is not chosen by
    // it (placing, as focusStar says): placed first, chosen by the next press, so the sheet does
    // not open with a seal, a words form and a remove button arriving inside its own arrival. The
    // sheet is put back at its top before the focus is given, so a target further down is brought
    // into view by the focus and not scrolled away from again; and the focus goes only to a star
    // that is the sky's, never to the ghost of one being cut away (inert).
    dealing = fresh;
    try {
      renderSheet(fresh);
      sheet.host.scrollTop = 0;
      var skyTarget = sheet.field.querySelector('.persona-star:not([inert])') || sheet.drop;
      var target = section === 'reading' ? sheet.ask
        : section === 'difficulty' ? (sheet.tune && sheet.tune.querySelector('input'))
          : skyTarget;
      if (!target) target = skyTarget;
      if (target && typeof target.focus === 'function') {
        placing = fresh && target.classList && target.classList.contains('persona-star') ? target : null;
        try { target.focus(); }
        finally { placing = null; }
      }
    } finally { dealing = false; }
  }
  /* Closing reads first and then writes, all in the one task, so the page is restyled whole once
     and not once for each thing that changes. The ghost and the hand-off take what they need of
     the open sheet (leaveSheetGhost); then the page is given back (sheetBox.down) before the
     dialog closes, so the browser's own close of a modal dialog can hand the focus back to the
     control that had it when the sheet opened -- which it can only do once that control is no
     longer inert -- and the style it works out to do so is the one restyle the page needs. What
     is read after it (where the hand-off's mark lands) is worked out on top of that one. */
  function closeSheet() {
    if (!sheet) return;
    if (sheet.host.open) {
      if (activeDrag) endDrag(activeDrag.pointerId);
      leaveSheetGhost();
      if (sheetBox) sheetBox.down();
      if (typeof sheet.host.close === 'function') sheet.host.close();
      else sheet.host.removeAttribute('open');
    }
    onSheetClosed();
  }
  /* The focus going home, to the control that opened the sheet (or the avatar). Most often it is
     there already: the browser's close of a modal dialog takes it back to where it was. Where it is
     not -- a browser that does not focus the button it clicks, a sheet closed some other way -- it
     is handed back on the next frame, where the look the browser takes at the page to focus it is
     part of the restyle that frame does anyway, rather than a second one forced now. Unless the
     focus has gone somewhere by then (the question, asked from the sheet, takes it at once): it
     is only taken home from nowhere. */
  function focusHome(back) {
    var home = back && typeof back.focus === 'function' && document.contains(back) ? back : (card && card.open);
    if (!home || typeof home.focus !== 'function' || document.activeElement === home) return;
    if (typeof window.requestAnimationFrame !== 'function') { home.focus(); return; }
    window.requestAnimationFrame(function () {
      var now = document.activeElement;
      var adrift = !now || now === document.body || now === document.documentElement
        || (sheet && typeof sheet.host.contains === 'function' && sheet.host.contains(now));
      if (adrift && !(sheet && sheet.host.open) && document.contains(home)) home.focus();
    });
  }
  function onSheetClosed() {
    if (!sheet || sheet.host.open || !sheetWasOpen) return;
    sheetWasOpen = false;
    if (activeDrag) endDrag(activeDrag.pointerId);
    stopFieldCast();
    skyAnswerTicket += 1;
    skyAnswerStars = null;
    resetSkyComparison();
    sheet.host.classList.remove('persona-sheet-fallback');
    endRite(sheet.host, 'arriving');
    if (sheetBox) sheetBox.down();
    // The portrait comes out from behind the veil and is drawn again (refresh). A first sky placed
    // while the sheet was open is cast into it as it does, once the mark that carries it home has
    // landed, so the two say it one after the other and not on top of each other.
    if (card) card.castAfter = carried && !stillness() ? FLIGHT_MS : 0;
    refresh();
    if (card) card.castAfter = 0;
    var back = openedBy;
    openedBy = null;
    focusHome(back);
    // Last of all, and after the veil has gone: the mark crosses a page the visitor has back, and
    // nothing about the focus coming home waits on an animation.
    handOff();
  }
  function buildSheet() {
    var host = document.getElementById('persona-sheet');
    if (!host) return;
    sheet = {
      host: host, close: document.getElementById('persona-close'), field: document.getElementById('persona-sky'),
      title: document.getElementById('persona-sheet-title'),
      canvas: host.querySelector('.persona-sky-canvas'), drop: document.getElementById('persona-drop'),
      seed: document.getElementById('persona-seed'), remove: document.getElementById('persona-remove'),
      clear: document.getElementById('persona-clear'), status: document.getElementById('persona-sky-status'),
      name: document.getElementById('persona-sky-name'),
      guide: document.getElementById('persona-figure-guide'),
      thread: document.getElementById('persona-thread'),
      figures: document.getElementById('persona-figures'),
      wordsForm: document.getElementById('persona-star-words'),
      words: document.getElementById('persona-star-thought'),
      neighbor: document.getElementById('persona-star-neighbor'),
      answer: document.getElementById('persona-sky-answer'),
      answerRead: document.getElementById('persona-sky-read'),
      answerLabel: document.getElementById('persona-sky-read-label'),
      answerNote: document.getElementById('persona-sky-answer-note'),
      answerWorld: document.getElementById('persona-sky-answer-world'),
      answerTitle: document.getElementById('persona-sky-answer-title'),
      answerLine: document.getElementById('persona-sky-answer-line'),
      preview: document.getElementById('persona-sky-preview'),
      answerCanvas: document.getElementById('persona-sky-preview-canvas'),
      comparison: document.getElementById('persona-sky-comparison'),
      beforeChange: document.getElementById('persona-sky-before-change'),
      beforeTitle: document.getElementById('persona-sky-before-title'),
      beforePicture: document.getElementById('persona-sky-before-picture'),
      beforeCanvas: document.getElementById('persona-sky-before-canvas'),
      beforeLine: document.getElementById('persona-sky-before-line'),
      reading: document.getElementById('persona-reading'), ask: document.getElementById('persona-ask'),
      forget: document.getElementById('persona-forget'), readingGo: document.getElementById('persona-reading-go'),
      tune: document.getElementById('persona-difficulty')
    };
    if (!sheet.field) { sheet = null; return; }
    // The sky's name line holds its room from the start, empty until there is a sky to name
    // (renderName), so the first star does not push the controls under it down.
    if (sheet.name) sheet.name.hidden = false;
    buildFigures();
    // The third setting, in its own section: the same control the stage puts beside a piece, so a
    // visitor meets one slider wherever they meet the setting.
    if (sheet.tune) tuner(sheet.tune, { label: 'difficulty' });
    var shell = window.interestingSite;
    if (shell && typeof shell.lightbox === 'function') {
      sheetBox = shell.lightbox({ name: 'persona', keep: host, onPress: closeSheet });
    }
    if (sheet.close) sheet.close.addEventListener('click', closeSheet);
    // Escape, which closes the dialog itself: closed here instead, through the same reads and the same
    // order as the close button, and the browser's own close after it finds the dialog shut.
    host.addEventListener('cancel', closeSheet);
    // The first preview, opened under the line that opens it, arrives out of that line each time it
    // is opened: the class goes on as the line is pressed, before the browser opens the box.
    var compareLine = sheet.comparison && sheet.comparison.querySelector ? sheet.comparison.querySelector('summary') : null;
    var firstPreview = sheet.comparison && sheet.comparison.querySelector ? sheet.comparison.querySelector('.persona-sky-before') : null;
    if (compareLine && firstPreview) compareLine.addEventListener('click', function () {
      if (sheet.comparison.open) return;
      var length = cutOn(firstPreview, 'part-in', { family: 'arrive', duration: 'medium' });
      if (length) rite(firstPreview, 'arriving', length + 100);
    });
    if (sheet.answerRead) sheet.answerRead.addEventListener('click', function () {
      resetSkyComparison();
      if (skyAnswerWanted) skyAnswerIndex += 1;
      skyAnswerWanted = true;
      renderSkyAnswer();
    });
    window.addEventListener('feed:ready', function () {
      if (host.open) renderSkyAnswer();
    });
    host.addEventListener('close', onSheetClosed);
    host.addEventListener('click', function (ev) {
      if (ev.target !== host) return;
      var box = host.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) closeSheet();
    });
    document.addEventListener('keydown', function (ev) {
      var front = document.documentElement.getAttribute('data-lightbox');
      if (!host.open || typeof host.showModal === 'function'
          || (front && front !== 'persona')) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        closeSheet();
        return;
      }
      if (ev.key !== 'Tab') return;
      var controls = host.querySelectorAll(
        'summary, a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
      var reachable = [];
      for (var i = 0; i < controls.length; i++) {
        var control = controls[i];
        var tab = control.getAttribute('tabindex');
        if (control.disabled || (tab !== null && Number(tab) < 0)) continue;
        var visible = true;
        for (var parent = control; parent && parent !== host; parent = parent.parentNode) {
          if (parent.hidden || parent.hasAttribute('inert')
              || parent.getAttribute('aria-hidden') === 'true'
              || (parent.tagName === 'DETAILS' && !parent.open
                && control !== parent.querySelector('summary'))) {
            visible = false;
            break;
          }
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
      // The star lands where the finger fell, and it is the mark of the press: it grows there as a
      // curve from its own point (_sass/_persona.scss, is-placed), and nothing else is done to it
      // by the same press -- no focus, no choosing. A press on it chooses it.
      var point = pointInField(ev.clientX, ev.clientY);
      var words = thought();
      var kept = addStar({ x: point.x, y: point.y, text: words });
      sheetStatus('✦ ' + words + namedLine() + keptNote(kept));
    });
    // A star held in a drag moves in the field and nowhere else: its name, its thread and its
    // lines follow it, from the box measured as it was picked up, and the sky is written once, when
    // it is let go (endDrag) -- not once for every pixel it crosses, which would store the sky,
    // tell every reader of it and redraw the portrait behind the veil at each.
    document.addEventListener('pointermove', function (ev) {
      if (!activeDrag || activeDrag.pointerId !== ev.pointerId) return;
      var star = fieldStars[activeDrag.index];
      if (!star) return;
      var point = pointInField(ev.clientX, ev.clientY, activeDrag.box);
      var x = Number(point.x.toFixed(2));
      var y = Number(point.y.toFixed(2));
      if (star.x === x && star.y === y) return;
      if (!activeDrag.moved) {
        activeDrag.moved = true;
        renderSkyAnswer();
      }
      star.x = x;
      star.y = y;
      placeElement(star);
      drawField(activeDrag.box);
    });
    document.addEventListener('pointerup', function (ev) { endDrag(ev.pointerId); });
    document.addEventListener('pointercancel', function (ev) { endDrag(ev.pointerId); });
    // A star dropped is the one the visitor is on: the focus goes to it and chooses it, so its words
    // are the form's and 'remove this star' takes it out, whichever star was chosen before.
    if (sheet.drop) sheet.drop.addEventListener('click', function () {
      var words = thought();
      var kept = addStar({ x: 50 + (Math.random() - 0.5) * 30,
        y: 50 + (Math.random() - 0.5) * 30, text: words });
      focusStar(fieldStars.length - 1);
      sheetStatus('✦ ' + words + namedLine() + ' Drag it where it belongs.' + keptNote(kept));
    });
    function seedTheSky() {
      var kept = seed();
      focusStar(0, true);
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
        if (sheet.reading) say(sheet.reading, 'The reading is forgotten. Your stars stay.');
        if (sheet.ask) sheet.ask.focus();
      },
      onCancel: renderReading
    });
    window.addEventListener('resize', function () {
      if (!sheet.host.open) return;
      drawField();
      drawSkyAnswer();
    });
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
    if (t && typeof t.arrival === 'function' && t.arrival()) askInCard(true);
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
