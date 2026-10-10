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
   The first preview's picture and words stay available for comparison while that world is being
   previewed in the open sheet. This is a temporary picture, never another saved or editable sky.

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

  /* ---- the rites the persona asks the engine for ------------------------------------------ */
  /* Nothing the persona writes or takes away is cut while a visitor is watching (README: "Motion
     axiom"): words a script writes are revealed glyph by glyph, what leaves is unmade or leaves a
     ghost that is, what arrives develops, and what this script draws on a canvas it draws in
     treads along a stair of its own. js/motion.js is optional throughout -- the stub browsers the
     harnesses run load none, and a visitor who asked for less motion gets everything at once -- so
     every rite is guarded, and every write below lands synchronously whether or not one plays:
     textContent is never anything but the words, hidden means hidden, and the list is the list. */
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
  // the sheet is up (js/site.js), and most of these rites are the sheet's. A style flush between
  // the class going and coming does the same work at once.
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
    el.classList.remove(cls);
    if (typeof el.getBoundingClientRect === 'function') el.getBoundingClientRect();
    el.classList.add(cls);
    var wait = after || riteMs('long', 560) * 2 + 400;
    if (timers) {
      timers[name] = window.setTimeout(function () {
        timers[name] = 0;
        el.classList.remove(cls);
      }, wait);
    }
  }
  // What arrives arrives by a composition of its own (README: "Motion axiom", the composer): the
  // engine rolls the element a geometry, a curve for the named spell and a fresh @keyframes rule
  // put together from pieces, and writes them inline (--arrive-*, --ease-<spell>, --rite-develop,
  // --motion-<spell>), which _sass/_persona.scss reads before its own keyframes. The class that
  // plays it is put on by the caller (rite, or the stylesheet's :not([hidden]) / [open]), never by
  // the engine, whose own pass waits a frame the lightbox may be holding.
  // With `mattes`, a matte ladder of the element's own as well (--matte-1..5, --matte-top, inline),
  // for the things a visitor sees arrive side by side -- the stars dealt together, the sheet --
  // so they climb as many ladders as there are of them, not the page's one.
  function arriveOn(el, spell, seed, mattes) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof m.arrive !== 'function') return;
    try { m.arrive(el, { spell: spell, seed: seed, className: false, mattes: !!mattes }); }
    catch (e) { console.error('The arrival could not be composed', e); }
  }
  // A star moved by an arrow key is nudged (is-nudged, _sass/_persona.scss star-nudge): a tread
  // past its new place along the key's way (--nudge-dx/-dy, the sign of the move) and one flicker
  // of its gleam, with the dip the engine composes for this one press (--rite-stamp, --motion-star-
  // nudge), so no two nudges are alike. Nothing here moves the star: placeElement has, at once.
  function nudge(el, move) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof el.style.setProperty !== 'function') return;
    el.style.setProperty('--nudge-dx', String(move[0] > 0 ? 1 : move[0] < 0 ? -1 : 0));
    el.style.setProperty('--nudge-dy', String(move[1] > 0 ? 1 : move[1] < 0 ? -1 : 0));
    if (typeof m.composeOn === 'function') {
      try { m.composeOn(el, 'stamp', 'star-nudge', riteMs('short', 170)); }
      catch (e) { console.error('The nudge could not be composed', e); }
    }
    rite(el, 'nudged', riteLength(el, 'star-nudge', riteMs('short', 170)) + 100);
  }
  // What leaves leaves by a composition of its own (--rite-unmake, --motion-<spell>), written on
  // the element -- or on the ghost of it -- that plays it.
  function leaveOn(el, spell, baseMs) {
    var m = engine();
    if (!el || !el.style || !m || calm() || typeof m.composeOn !== 'function') return;
    try { m.composeOn(el, 'unmake', spell, baseMs || riteMs('medium', 340)); }
    catch (e) { console.error('The leaving could not be composed', e); }
  }
  // How long a composed rite was given, read back off the element, so a class is never taken off
  // or a node hidden while the rite it plays is still running.
  function riteLength(el, spell, fallback) {
    var style = el && el.style;
    if (!style || typeof style.getPropertyValue !== 'function') return fallback;
    var n = parseFloat(style.getPropertyValue('--motion-' + spell));
    return isFinite(n) && n > 0 ? n : fallback;
  }
  // Words written to a line and revealed there. A line still revealing is put back whole first, so
  // a status rewritten mid-rite never carries the old glyphs into the new words; `quiet` writes
  // the words without the rite, for a line nobody can see at the moment.
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
    if (quiet || node.hidden || !m || typeof m.reveal !== 'function' || calm()) return;
    var undo = m.reveal(node);
    if (revealed && typeof undo === 'function') revealed.set(node, undo);
  }
  // A part of the sheet shown or hidden: shown at once (the stylesheet develops it through the
  // ladder, _sass/_persona.scss part-in), and unmade down the ladder (is-unmaking) before it is
  // hidden -- at once where nothing can play, so hidden is hidden synchronously in the stubs.
  var concealing = typeof WeakMap === 'function' ? new WeakMap() : null;
  function show(node) {
    if (!node) return;
    var pending = concealing && concealing.get(node);
    if (pending) {
      window.clearTimeout(pending);
      concealing['delete'](node);
    }
    if (node.classList) node.classList.remove('is-unmaking');
    // A part coming into view arrives by a composition of its own; one already in view keeps
    // the words it has.
    if (node.hidden) arriveOn(node, 'part-in');
    node.hidden = false;
  }
  function conceal(node) {
    if (!node || node.hidden) return;
    if (concealing && concealing.get(node)) return; // already on its way down the ladder
    var m = engine();
    if (!m || calm() || !node.classList || !concealing || typeof window.setTimeout !== 'function') {
      node.hidden = true;
      return;
    }
    leaveOn(node, 'part-unmake');
    node.classList.add('is-unmaking');
    concealing.set(node, window.setTimeout(function () {
      concealing['delete'](node);
      node.classList.remove('is-unmaking');
      node.hidden = true;
    }, riteLength(node, 'part-unmake', riteMs('medium', 340)) + 60));
  }
  // A ghost of a box that has to go at once -- the sheet, which must close for the focus to go
  // home and the veil to come down; the question in the card, whose words are the threshold's to
  // clear: a copy of it left exactly where it was, unmade there by the stylesheet (the class the
  // caller names), and taken out when the rite has ended. Under no pointer and hidden from a
  // screen reader, with every id stripped so the page keeps its one of each. `spell` names the
  // keyframes the stylesheet would play without a script, which is the length the composed
  // unmaking is written under.
  function ghostOf(host, className, layer, spell) {
    var m = engine();
    if (!m || calm() || !host || typeof host.getBoundingClientRect !== 'function' || !document.body
        || typeof host.innerHTML !== 'string' || typeof host.querySelectorAll !== 'function'
        || typeof window.setTimeout !== 'function') return null;
    var box = host.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    var ghost = document.createElement('div');
    ghost.className = className;
    ghost.innerHTML = host.innerHTML;
    var named = ghost.querySelectorAll('[id]');
    for (var i = 0; i < named.length; i++) named[i].removeAttribute('id');
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
    if (layer) style.setProperty('z-index', layer);
    if (spell) leaveOn(ghost, spell);
    document.body.appendChild(ghost);
    function gone() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }
    ghost.addEventListener('animationend', function (ev) { if (!ev || ev.target === ghost) gone(); });
    ghost.addEventListener('animationcancel', function (ev) { if (!ev || ev.target === ghost) gone(); });
    window.setTimeout(gone, riteMs('medium', 340) * 3 + 400);
    return ghost;
  }
  // The stair this script draws by: a small polyline of its own, rolled for every series -- as
  // many treads as the roll says, none the same width, one of them a flicker back -- so the lines
  // of a sky arrive in uneven cuts and never along a formula.
  function ownStair(treads) {
    var widths = [];
    var sum = 0;
    for (var i = 0; i < treads; i++) {
      var w = 0.45 + Math.random() * 1.15;
      widths.push(w);
      sum += w;
    }
    for (var j = 0; j < treads; j++) widths[j] /= sum;
    return { widths: widths, flickerAt: treads > 2 ? 1 + Math.floor(Math.random() * (treads - 2)) : -1 };
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
  var lastFigure = figureOf(stars());
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
    var saved = read();
    if (saved.status !== 'unreadable' && sameStars(clean(saved.value), list)) {
      return !!(store && saved.status === 'ok' && store.persistent !== false);
    }
    var kept = false;
    if (store) kept = list.length ? store.set(SKY, list) : store.remove(SKY);
    // Placed, moved, seeded, removed or cleared: the constellation was set, and if it was set in
    // the sheet it is handed over when the sheet closes (the hand-off, below).
    var figure = figureOf(list);
    if (sheet && sheet.host.open) {
      noteSet('sky', sheet.field);
      // A star landing or going strikes the sky: the ring clicks one tooth and the lines flicker
      // (_sass/_persona.scss, is-struck); a star moved or worded only redraws -- unless the move
      // has just made a figure, which is struck like a star landing.
      if ((how !== 'moved' && how !== 'worded') || (figure && figure !== lastFigure)) {
        rite(sheet.field, 'struck', riteMs('medium', 340) + 100);
      }
    }
    lastFigure = figure;
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
     star has in the deal (a star at -1 is already in the sky), `pass.stars` the fraction of the
     deal so far, so a star and the lines to it are drawn only once its place has come up;
     `pass.flicker` draws the tread with the lines thinned, the refusal before the next; and
     `pass.glint(i)` scales a star's dot, for the portrait's twinkle. */
  function drawSky(ctx, list, w, h, pad, dotRadius, lineWidth, route, pass) {
    var path = route || threadOf(list);
    var points = list.map(function (s) {
      return { x: pad + s.x / 100 * (w - pad * 2), y: pad + s.y / 100 * (h - pad * 2) };
    });
    var through = pass || null;
    function shown(index) {
      if (!through || !through.order || typeof through.stars !== 'number') return true;
      var at = through.order[index];
      return !(at >= 0) || at < through.stars * points.length;
    }
    var thin = through && through.flicker ? 0.45 : 1;
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
        ctx.globalAlpha = (0.14 + (1 - nearest[k].d2 / maxDistanceSq) * 0.5) * thin;
        ctx.strokeStyle = 'currentColor';
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
    }
    if (path.length > 1) {
      ctx.globalAlpha = 0.9 * thin;
      ctx.lineWidth = lineWidth * 2.8;
      ctx.strokeStyle = 'currentColor';
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
      var glint = through && typeof through.glint === 'function' ? through.glint(p) : 1;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(236, 244, 255, 0.96)';
      ctx.arc(points[p].x, points[p].y, dotRadius * starGleam(list[p].text) * glint
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
    // The first sky cast into an empty portrait is a rite of its own (_sass/_persona.scss,
    // is-casting): the waiting glyph unmade, the dashed ring ratcheting off, the sky developing.
    // (A sky already there as the page arrives only dawns: the drawn sky develops, nothing is
    // unmade, since no visitor watched it being cast.)
    if (list.length && card.drawnCount === 0) {
      rite(card.host, card.everDrawn ? 'casting' : 'dawning', riteMs('long', 560) + 200);
    }
    // A reading first read while a visitor watches seals a ring onto the portrait (is-read); one
    // carried in from an earlier page is simply worn.
    if (isRead && card.everDrawn && !card.readDrawn) rite(card.host, 'read', riteMs('medium', 340) + 200);
    card.readDrawn = isRead;
    card.everDrawn = true;
    card.host.setAttribute('data-state', askingInCard ? 'asking' : (!list.length && !isRead ? 'empty' : 'ready'));
    card.host.setAttribute('data-reading', !isRead ? 'none' : (r.source === 'answer' ? 'answered' : 'carried'));
    card.host.setAttribute('data-asking', askingInCard ? 'true' : 'false');
    card.host.setAttribute('data-sky', list.length ? 'set' : 'none');
    card.host.setAttribute('data-difficulty', difficulty().name);
    card.host.setAttribute('data-figure', figureOf(list) ? 'true' : 'false');
    // The corner is shown once it has read what it holds, and arrives by a composition of its own.
    if (card.open.hidden) arriveOn(card.open, 'avatar-in');
    card.open.hidden = false;
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
    if (card.portrait) {
      // A sky with more or fewer stars than the one drawn is cast star by star, in treads; a sky
      // of the same stars moved about is simply drawn again.
      var count = list.length;
      var changed = count !== card.drawnCount;
      card.drawnCount = count;
      if (changed && count) castPortrait(list, false);
      else {
        stopPortraitCast();
        paintPortrait(list, null);
      }
    }
    if (sheet && sheet.host.open) {
      if (!sameStars(serialize(), list)) renderField();
      renderReading();
      renderSkyAnswer();
    }
  }
  /* The portrait, drawn in treads. A sky cast into it arrives star by star in a rolled order along
     the script's own stair (ownStair), the lines following their stars, with one tread drawn thin
     as the refusal; a pointer or the focus arriving on the avatar twinkles it instead -- two or
     three redraws on uneven treads, each with a rolled gleam per star. One draw, at once, without
     the engine or for a visitor who asked for less motion. */
  var portraitCast = null;
  function stopPortraitCast() {
    if (!portraitCast) return;
    window.clearTimeout(portraitCast.timer);
    portraitCast = null;
  }
  function paintPortrait(list, pass) {
    if (!card || !card.portrait) return;
    var size = card.portraitSize;
    var ctx = sizeCanvas(card.portrait, size, size);
    if (ctx && list.length) drawSky(ctx, list, size, size, size * 0.15, size * 0.032, size * 0.018, null, pass);
  }
  function castPortrait(list, twinkling) {
    stopPortraitCast();
    var m = engine();
    if (!m || calm() || !list.length || typeof window.setTimeout !== 'function') {
      paintPortrait(list, null);
      return;
    }
    var treads = twinkling ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 4);
    var stair = ownStair(treads);
    var total = riteMs(twinkling ? 'medium' : 'long', 560) * (twinkling ? 1 : 1.3);
    var order = dealOrder(list.length);
    var cast = { at: 0, timer: 0 };
    portraitCast = cast;
    function glints() {
      var g = [];
      for (var i = 0; i < list.length; i++) g.push(0.6 + Math.random() * 1.1);
      return function (i) { return g[i]; };
    }
    function tread() {
      if (portraitCast !== cast) return;
      cast.at += 1;
      if (cast.at >= treads) {
        portraitCast = null;
        paintPortrait(list, null);
        return;
      }
      var f = cast.at === stair.flickerAt ? Math.max(0, cast.at - 1) / treads : cast.at / treads;
      paintPortrait(list, twinkling ? { glint: glints() }
        : { order: order, stars: f, flicker: cast.at === stair.flickerAt });
      cast.timer = window.setTimeout(tread, total * stair.widths[cast.at]);
    }
    paintPortrait(list, twinkling ? { glint: glints() } : { order: order, stars: 0 });
    cast.timer = window.setTimeout(tread, total * stair.widths[0]);
  }
  function askInCard() {
    var t = window.threshold;
    if (!card || !card.probe || !t || typeof t.mount !== 'function' || askingInCard) return;
    if (sheet && sheet.host.open) closeSheet();
    askingInCard = true;
    arriveOn(card.probe, 'part-in');
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
      // The question's words are the threshold's to clear, so what is unmade is a ghost of it,
      // left where the question was (_sass/_persona.scss, .persona-probe.is-unmaking).
      if (!card.probe.hidden) ghostOf(card.probe, 'persona-probe is-unmaking', '44', 'part-unmake');
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
    card.drawnCount = 0;
    card.readDrawn = false;
    card.open.addEventListener('click', function () { openSheet('sky', card.open); });
    // The portrait's sky twinkles as the pointer or the focus arrives on it.
    function twinkle() {
      var list = stars();
      if (list.length && engine() && !calm()) castPortrait(list, true);
    }
    card.open.addEventListener('pointerenter', twinkle);
    card.open.addEventListener('focus', twinkle);
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
      // The way home is bowed: a rolled offset off the straight line, to one side or the other,
      // which the middle treads of the flight read (_sass/_persona.scss, --persona-flight-ax/-ay).
      var dx = set.from.x - x;
      var dy = set.from.y - y;
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      var bow = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.22) * length;
      mark.style.setProperty('--persona-flight-ax', Math.round(-dy / length * bow) + 'px');
      mark.style.setProperty('--persona-flight-ay', Math.round(dx / length * bow) + 'px');
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
    if (!sheet || !sheet.answer || !sheet.answerRead) return;
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
    show(sheet.answer);
    if (!skyAnswerWanted || activeDrag) return;
    if (skyAnswerAt === skyAnswerIndex && skyAnswerStars && sameStars(skyAnswerStars, list)) return;
    var ticket = ++skyAnswerTicket;
    skyAnswerStars = list;
    skyAnswerAt = skyAnswerIndex;
    sheet.answerRead.disabled = true;
    say(sheet.answerLine, 'Making a preview from your stars.');
    feed.previewSky(skyAnswerIndex).then(function (sample) {
      if (ticket !== skyAnswerTicket || !sheet.host.open) return;
      skyAnswerSample = sample;
      sheet.answer.setAttribute('data-mood', sample.world.mood);
      ['bg', 'bg2', 'accent', 'accent2'].forEach(function (name) {
        sheet.answer.style.setProperty('--' + name, sample.colors[name]);
      });
      show(sheet.answerWorld);
      say(sheet.answerWorld, sample.world.name);
      show(sheet.answerTitle);
      say(sheet.answerTitle, sample.title);
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
  // The name under the field follows each move, including a drag.
  function renderName() {
    if (!sheet || !sheet.name) return;
    var list = serialize();
    var named = skyName(list);
    sheet.name.setAttribute('data-figure', figureOf(list) ? 'true' : 'false');
    if (named) {
      show(sheet.name);
      var near = nearFigure(list);
      say(sheet.name, '✦ ' + named + ' — ' + skyRead(list) + (near ? '. Close to a named shape: ' + near + '.' : ''));
    } else {
      conceal(sheet.name);
      if (sheet.name.hidden) say(sheet.name, '', true);
    }
  }
  function renderThread() {
    var path = threadOf(fieldStars, selected);
    for (var i = 0; i < fieldStars.length; i++) {
      var el = fieldStars[i].el;
      if (!el) continue;
      var place = path.indexOf(i);
      if (place < 0) {
        // A place taken away is unmade, not cut: the old number stays on the star for the rite
        // (data-thread-was, is-unthreaded, _sass/_persona.scss) while the badge goes down the ladder.
        var was = el.getAttribute('data-thread');
        if (was && engine() && !calm()) {
          el.setAttribute('data-thread-was', was);
          rite(el, 'unthreaded', riteMs('medium', 340) + 100);
        }
        el.removeAttribute('data-thread');
      } else el.setAttribute('data-thread', String(place + 1));
    }
    if (sheet && sheet.thread) {
      var words = path.length < 2 ? '' : path.map(function (index) {
        var text = fieldStars[index].text.trim();
        return text ? '“' + text + '”' : 'a star without words';
      }).join(' → ');
      if (words) {
        show(sheet.thread);
        say(sheet.thread, words);
      } else {
        conceal(sheet.thread);
        if (sheet.thread.hidden) say(sheet.thread, '', true);
      }
    }
    return path;
  }
  function namedLine() {
    var list = serialize();
    var named = skyName(list);
    if (!named) return '';
    if (figureOf(list)) return ' A figure with a name of its own: ' + named + '.';
    var near = nearFigure(list);
    return ' Your sky reads as ' + named + ' now.' + (near ? ' Close to a named shape: ' + near + '.' : '');
  }
  function paintField(pass) {
    if (!sheet || !sheet.field || !sheet.canvas) return;
    var box = sheet.field.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ctx = sizeCanvas(sheet.canvas, box.width, box.height);
    if (ctx) drawSky(ctx, fieldStars, box.width, box.height, 22, 0, 1.1, threadOf(fieldStars, selected), pass);
  }
  // The field redrawn: its name, its thread and the lines between its stars -- at the tread the
  // sky is at, if it is still being cast, so a star chosen or dragged mid-cast joins the cast
  // rather than cutting it short.
  function drawField() {
    renderName();
    renderThread();
    renderNeighbor();
    paintField(fieldCast ? fieldCast.pass : null);
  }
  /* The lines of the sky drawn in treads (README: "Motion axiom"): when the sheet opens its sky or
     a star is added, each star's lines arrive at the star's place in the deal (`order`, -1 for a
     star already in the sky), over as many uneven treads as the script's own stair rolls, one
     drawn thin as the refusal, and the last drawn whole. The stars themselves are buttons, dealt
     by the stylesheet to the same order (is-placed, --d). One draw without the engine. */
  var fieldCast = null;
  function stopFieldCast() {
    if (!fieldCast) return;
    window.clearTimeout(fieldCast.timer);
    fieldCast = null;
  }
  function castField(order) {
    stopFieldCast();
    var m = engine();
    if (!m || calm() || !sheet || !sheet.canvas || typeof window.setTimeout !== 'function') {
      paintField(null);
      return;
    }
    var treads = 5 + Math.floor(Math.random() * 5);
    var stair = ownStair(treads);
    var total = riteMs('long', 560) * 1.6;
    var cast = { at: 0, pass: { order: order, stars: 0 }, timer: 0 };
    fieldCast = cast;
    function tread() {
      if (fieldCast !== cast) return;
      cast.at += 1;
      if (cast.at >= treads) {
        fieldCast = null;
        paintField(null);
        return;
      }
      var f = cast.at === stair.flickerAt ? Math.max(0, cast.at - 1) / treads : cast.at / treads;
      cast.pass = { order: order, stars: f, flicker: cast.at === stair.flickerAt };
      paintField(cast.pass);
      cast.timer = window.setTimeout(tread, total * stair.widths[cast.at]);
    }
    paintField(cast.pass);
    cast.timer = window.setTimeout(tread, total * stair.widths[0]);
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
    if (sheet.remove) {
      if (index < 0) conceal(sheet.remove);
      else show(sheet.remove);
    }
    if (sheet.wordsForm) {
      if (index < 0) conceal(sheet.wordsForm);
      else show(sheet.wordsForm);
    }
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
    // The light is a child of the button, so the matte it waxes through masks the light alone and
    // the thread badge stays legible (_sass/_persona.scss, .persona-star-light). Nothing is read
    // from it: the button keeps its name, its press and its place.
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
    el.addEventListener('focus', function () { if (locate()) select(index); });
    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (Date.now() < suppressClickUntil || !locate()) return;
      select(index);
    });
    el.addEventListener('pointerdown', function (ev) {
      if (activeDrag || (typeof ev.button === 'number' && ev.button !== 0) || !locate()) return;
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
      if (!locate()) return;
      var step = ev.shiftKey ? 6 : 2;
      var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        star.x = Number(clamp(star.x + moves[ev.key][0], 1, 99).toFixed(2));
        star.y = Number(clamp(star.y + moves[ev.key][1], 1, 99).toFixed(2));
        placeElement(star);
        nudge(star.el, moves[ev.key]);
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
  /* A star taken out of the sky is unmade where it was: the button itself goes at once (the list
     is the list), and a ghost of it -- a copy with no name, no press and no place in the thread --
     is left in its place for the stylesheet to take down the ladder (_sass/_persona.scss,
     .persona-star-ghost), and taken out when the rite ends. */
  function unmakeStar(el) {
    var m = engine();
    if (!m || calm() || !el || typeof el.cloneNode !== 'function' || !el.parentNode
        || typeof el.parentNode.insertBefore !== 'function' || typeof window.setTimeout !== 'function') return;
    var ghost = el.cloneNode(true); // with the light inside it, which is what is seen to go
    ghost.className = 'persona-star persona-star-ghost';
    ghost.removeAttribute('id');
    ghost.removeAttribute('aria-pressed');
    ghost.removeAttribute('aria-label');
    ghost.removeAttribute('data-thread');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('tabindex', '-1');
    ghost.setAttribute('inert', '');
    leaveOn(ghost, 'star-unmake');
    el.parentNode.insertBefore(ghost, el);
    // The ghost's own rite ending takes it out -- not the light's inside it, whose end bubbles.
    function gone(ev) {
      if (ev && ev.target && ev.target !== ghost) return;
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }
    ghost.addEventListener('animationend', gone);
    ghost.addEventListener('animationcancel', gone);
    window.setTimeout(gone, riteMs('medium', 340) * 3 + 400);
  }
  /* The field drawn from the saved sky. A star that is where it was keeps its button (so it is not
     re-dealt every time another is added); one that is gone is unmade; the new ones are dealt in a
     rolled order, each developing through the ladder a rolled stagger after the last (is-placed,
     --d), with the lines of the sky cast to the same order. `dealAll` deals the whole sky again,
     as the sheet does when it opens. */
  function renderField(dealAll) {
    if (!sheet || !sheet.field) return;
    stopFieldCast();
    var old = fieldStars;
    activeDrag = null;
    var saved = read();
    var fresh = [];
    var order = [];
    // A star is the same star by what it is, not by its place in the list: one taken out shifts
    // every star after it by one, and those stay where they are rather than being unmade and dealt
    // again.
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
      // Each star's own arrival: its geometry, its curve, its composition, then the class.
      arriveOn(el, 'star-develop', null, true);
      rite(el, 'placed', riteLength(el, 'star-develop', riteMs('long', 560)) + wait + 200);
    }
    select(-1);
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
  function endDrag(pointerId) {
    if (!activeDrag || activeDrag.pointerId !== pointerId) return;
    var drag = activeDrag;
    activeDrag = null;
    var star = fieldStars[drag.index];
    if (star && star.el) {
      star.el.classList.remove('dragging');
      rite(star.el, 'dropped', riteMs('medium', 340) + 100);
      if (star.el.releasePointerCapture) {
        try { star.el.releasePointerCapture(pointerId); }
        catch (e) { console.error('Could not release the dragged star', e); }
      }
    }
    if (drag.moved) {
      suppressClickUntil = Date.now() + DRAG_SUPPRESS_MS;
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
        show(sheet.readingGo);
        sheet.readingGo.href = root + r.orientation.world;
        say(sheet.readingGo, r.orientation.worldName);
      } else conceal(sheet.readingGo);
    }
  }
  function renderSheet(dealAll) { renderField(dealAll); renderReading(); renderSkyAnswer(); }
  /* The sheet closing is a modal dialog closing: it has to close at once for the focus to go home
     and the veil to come down, so what is unmade is a ghost of it, left where the sheet was
     (_sass/_persona.scss, .persona-sheet.persona-ghost), with the sky's lines drawn again on the
     copy's blank canvas. Made before the dialog closes -- a shut dialog has no box to measure --
     from closeSheet and from the browser's own Escape (the dialog's cancel event). */
  var sheetGhost = null;
  function dropSheetGhost() {
    if (sheetGhost && sheetGhost.parentNode) sheetGhost.parentNode.removeChild(sheetGhost);
    sheetGhost = null;
  }
  function leaveSheetGhost() {
    if (!sheet || !sheet.host.open) return;
    dropSheetGhost();
    var ghost = ghostOf(sheet.host, 'persona-sheet persona-ghost', null, 'sheet-out');
    if (!ghost) return;
    sheetGhost = ghost;
    var copy = typeof ghost.querySelector === 'function' ? ghost.querySelector('.persona-sky-canvas') : null;
    if (copy && sheet.canvas && sheet.canvas.width && typeof copy.getContext === 'function') {
      copy.width = sheet.canvas.width;
      copy.height = sheet.canvas.height;
      var g = copy.getContext('2d');
      if (g) {
        try { g.drawImage(sheet.canvas, 0, 0); }
        catch (e) { /* a canvas that cannot be copied leaves the ghost's sky to its stars */ }
      }
    }
  }
  function openSheet(section, opener) {
    if (!sheet) return;
    stopAskingInCard();
    var fresh = !sheet.host.open;
    if (fresh) {
      openedBy = opener || document.activeElement || (card && card.open);
      // A fresh visit: only what is set from here on is handed over on the way out, and a mark
      // still in the air from the last visit is taken away rather than stilled behind the veil,
      // as is a ghost of the sheet still leaving.
      carried = null;
      sweep();
      dropSheetGhost();
      if (sheetBox) sheetBox.up();
      if (typeof sheet.host.showModal === 'function') {
        // The sheet is dealt by a composition of its own, rolled before it is shown so its first
        // frame is already the composition's (the fallback box keeps its own transform, so it is
        // dealt by the stylesheet's keyframes instead).
        arriveOn(sheet.host, 'sheet-in', null, true);
        sheet.host.showModal();
      } else { sheet.host.setAttribute('open', ''); sheet.host.classList.add('persona-sheet-fallback'); }
      sheetWasOpen = true;
      // The title is revealed as the sheet is dealt.
      var m = engine();
      if (sheet.title && m && typeof m.reveal === 'function' && !calm()) m.reveal(sheet.title);
    }
    renderSheet(fresh);
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
      leaveSheetGhost();
      if (typeof sheet.host.close === 'function') sheet.host.close();
      else sheet.host.removeAttribute('open');
    }
    onSheetClosed();
  }
  function onSheetClosed() {
    if (!sheet || sheet.host.open || !sheetWasOpen) return;
    sheetWasOpen = false;
    activeDrag = null;
    stopFieldCast();
    skyAnswerTicket += 1;
    skyAnswerStars = null;
    resetSkyComparison();
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
      title: document.getElementById('persona-sheet-title'),
      canvas: host.querySelector('.persona-sky-canvas'), drop: document.getElementById('persona-drop'),
      seed: document.getElementById('persona-seed'), remove: document.getElementById('persona-remove'),
      clear: document.getElementById('persona-clear'), status: document.getElementById('persona-sky-status'),
      name: document.getElementById('persona-sky-name'),
      thread: document.getElementById('persona-thread'),
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
    // The third setting, in its own section: the same control the stage puts beside a piece, so a
    // visitor meets one slider wherever they meet the setting.
    if (sheet.tune) tuner(sheet.tune, { label: 'difficulty' });
    var shell = window.interestingSite;
    if (shell && typeof shell.lightbox === 'function') {
      sheetBox = shell.lightbox({ name: 'persona', keep: host, onPress: closeSheet });
    }
    if (sheet.close) sheet.close.addEventListener('click', closeSheet);
    host.addEventListener('cancel', leaveSheetGhost); // Escape, which closes the dialog itself
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
      // The sky is stamped where the finger fell (_sass/_persona.scss, .persona-sky.is-stamping),
      // as the star lands there.
      if (sheet.field.style && typeof sheet.field.style.setProperty === 'function') {
        var box = sheet.field.getBoundingClientRect();
        if (box && box.width && box.height) {
          sheet.field.style.setProperty('--stamp-x', ((ev.clientX - box.left) / box.width * 100).toFixed(1) + '%');
          sheet.field.style.setProperty('--stamp-y', ((ev.clientY - box.top) / box.height * 100).toFixed(1) + '%');
        }
      }
      rite(sheet.field, 'stamping', riteMs('medium', 340) + 100);
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
