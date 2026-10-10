/*
  The shared helpers every page can call, loaded by _includes/layout.njk without `defer` so they
  exist while a page's own script runs, exactly as window.interestingState and
  window.interestingPersona do.

      window.interestingSite.unlock(host, options)   a part that needs something the browser does
                                                      not hold yet, rendered as powered down with
                                                      the one button that powers it (see below)
      window.interestingSite.difficulty(host, options)
                                                      the persona's difficulty slider, rendered
                                                      wherever a part depends on the setting: the
                                                      persona's own (js/persona.js), offered here
                                                      beside unlock() because the two answer the
                                                      same axiom -- a dependency is settable where
                                                      it is met. It needs no powering down: the
                                                      setting always holds a value
      window.interestingSite.destructive(control, options)
                                                      a control that throws a visitor's saved state
                                                      away: the one warning treatment and the one
                                                      "are you sure?" modal (see below)
      window.interestingSite.areYouSure(options)      that modal on its own, for a control at the
                                                      threshold rather than above it
      window.interestingSite.lightbox(options)        the one lightbox everything that floats over
                                                      the whole page opens through: the veil, the
                                                      inert page, the held frame loop (see below)
      window.interestingSite.root                     '' on every page but the 404, where the
                                                      site's root has to be spelled out
      window.interestingSite.seedSky(), .holdsSky(), .skyKey
                                                      the persona's own (js/persona.js), kept here
                                                      under the names pages used before it existed

  Pieces of the shell live here as well, because the shell is markup and Sass and needs a hand
  with the things only a script can know: the main nav -- the sparkles logo, the constellation of
  options it branches out and the three pinned affordances that constellation adopts, which is the
  long section at the bottom of this file -- and how full each slider is (the M3 slider paints its
  active track in the primary colour up to the handle, which CSS can only do when --range-pct says
  where the handle is).

  Nothing in here keeps score, routes a visitor, or writes to the shared state document except
  the sky a visitor asks it to seed, which it does through the persona: the shell's job is to be
  understood in one reading and get out of the way. It draws nothing of its own on a page but the
  unlock box below, where a page asks for one.

  ---------------------------------------------------------------------------------------------
  Powered down, never broken

  Wherever a component depends on something the visitor has not done yet, its only announcement
  of that is the solution, in place. A world that reads the saved sky never says "set up your
  persona first": it presents as unpowered -- dimmed and inert, like the part of an adventure
  game whose generator is off -- and carries the one button that starts it, which does the
  prerequisite itself, in the background, writing to the persona exactly as the visitor's own
  action would. A quieter second choice may follow the button, never replace it: for the sky, a
  button that opens the persona sheet, where stars are placed by hand. The README section of the
  same name has the reasoning.

      var ready = window.interestingSite.unlock(document.querySelector('.layout'), {
        onReady: function (stars, how) { loadStars(); }   // now if a sky exists, else on press
      });

  options, all optional:
    key        the state name the part depends on; the persona's sky ('constellation') by default
    holds      function (value) -> boolean: is the value enough? By default: a non-empty array
               of { x, y, text } stars
    seed       function () -> value to write when the button is pressed; by default a small
               random sky from the persona
    onReady    function (value, how): called now with how 'saved' if the value is already there,
               after the press with 'seeded' (written to the browser) or 'memory' (written, but
               this browser keeps nothing between visits), and again with 'persona' every time
               the sky changes in the persona while the page is open -- a star placed in the
               sheet floating over a world reaches that world at once
    onPowerDown
               function (): called if the sky is emptied while the page is open, after the part
               has been powered down again, for a page that drew the stars somewhere of its own
    copy       { title, note, button } to override the words, for a prerequisite other than the sky
    elsewhere  the quiet second choice under the button: { text, open } opens the persona sheet on
               that section ('sky' or 'reading'); { href, text } is a link; null for none. For
               the sky it opens the persona by default

  It returns true when the part was ready at once, false when it rendered the unpowered state.
  The host keeps its children: they are dimmed by _sass/_unlock.scss and made inert, and the
  unlock box is put in front of the host, so the button is the first thing in reading order. The
  axiom applies when the prerequisite cannot be kept, too: a browser that stores nothing still
  gets the button, and the sky it seeds lasts for the page.

  The other half of the same axiom is a dependency that is already met: the persona's difficulty
  (issue #93) always holds a value, so a part that reads it is never powered down -- it is dealt
  at the setting that stands, and the slider that changes it is offered in place instead, through
  difficulty(host, options) above. Powering every puzzle on the site down behind a slider nobody
  had been asked to touch is the "never broken" half of the axiom broken, so the rule is: power
  down what is missing, offer what is merely set.

  ---------------------------------------------------------------------------------------------
  Caution before a destructive action

  Nothing on this site asks a visitor to confirm in its own words. A control that throws saved
  state away is a warning button, and pressing it opens the one modal that asks "are you sure you
  want to ______?" with the caller's words in the blank. Both halves are about consistency: the
  button is recognised as dangerous before it is read, and the question is the same question
  everywhere, naming the specific thing about to go rather than asking a generic "are you sure?".
  There is no separate arming affordance -- no checkbox, no toggle, no hold-to-arm press. The
  warning treatment plus the modal is the safety switch. The README section of the same name has
  the threshold and the reasoning; _sass/_controls.scss has the paint.

      window.interestingSite.destructive(document.getElementById('clear-history'), {
        what: 'clear your omen archive',
        detail: 'The ' + omens.length + ' omens the archive holds would go. Spinning makes more.',
        onConfirm: function () { clearHistory(); }
      });

  options:
    what       required: the blank in "are you sure you want to ______?", in the site's own voice
               and specific to this control -- "clear your constellation", not "do this"
    detail     one optional line under the question, for what is about to go and what it costs.
               A function is called at press time, so the line can count what is there now
    confirm    the confirm button's words; the control's own words by default, so a visitor
               presses the same thing twice
    onConfirm  what to do once they say yes
    onCancel   optional: a page that wants to say "kept as it was" in its own status line
    when       optional: is there anything to lose right now? When it returns false the press
               goes straight through without the question, because an empty drawer emptied again
               takes nothing away. The warning treatment stays on either way -- a control that
               changes its clothes is a control nobody learns

  It returns a function that releases the control again. areYouSure(options) is the modal alone,
  taking the same words plus `opener`, the control to return the focus to; it is for a control at
  the threshold rather than above it -- one that takes the whole of a saved thing away but puts
  something else in its place, which asks the same question without wearing the warning.

  The modal is one <dialog>, built the first time something asks and reused after that, so the
  browser supplies the focus trap and Escape. The focus starts on cancel and comes back to the
  control that opened it however the question is answered, and the page behind it goes under the
  shared lightbox below.

  ---------------------------------------------------------------------------------------------
  One lightbox, shared

  Everything on this site that floats over the whole page opens the same way, because it opens
  through the same component: the constellation the sparkles logo branches out, the persona sheet
  the avatar opens (js/persona.js), and the "are you sure?" modal above. Issue #70 asked for that
  in as many words -- the logo's lightbox was the effect the site wanted everywhere, and the
  persona's, a bare <dialog> with a flat backdrop, was weak -- so the nav's own veil, inert page
  and held frame loop were lifted out of the nav and made the one lightbox, here, where every
  other shared component of the shell already lives.

      var box = window.interestingSite.lightbox({
        name: 'persona',          // what <html data-lightbox> says while this one is up
        keep: sheetElement,       // the one child of <body> the veil leaves in front of it
        onPress: closeSheet       // a press on the veil, which is a way of saying "not this"
      });
      box.up();                   // the veil rises, from the control just pressed or focused
      box.up(null, control);      // the veil rises from `control`, the one that was pressed
      box.up('state');            // the same veil, now saying it holds something else
      box.down();                 // and the page comes back exactly as it was

  Raising one does four things, and a caller gets all four or none:
    the veil    one div the shell writes (#lightbox-veil), hidden until something raises it and
                painted by _sass/_lightbox.scss: the page dimmed, blurred and desaturated under
                it. It rises as a curve from the control that raised it -- the one a caller names
                (`from`), else the one a pointer has just pressed, else the one that has the
                focus -- whose place is read once and written on the veil as the curve's centre;
                it goes back into it the same way when the last box comes down. A press on it
                goes to whatever is on top, because the thing in front of the veil is the only
                thing that knows how to put itself away.
    aside       every other child of <body> is made inert and hidden from a screen reader, so
                nothing behind the veil can be reached by pointer or by keyboard. Anything already
                inert or already hidden for its own reasons is left exactly as it is -- the consent
                library hides its own markup that way -- and only what this put aside is brought
                back. Each one is marked data-lightbox-aside, which is also what the stylesheet
                pauses the CSS animations of; the one left in front is marked
                data-lightbox-front, which is what lifts it over the veil.
    hold        the page's motion. Every animated page here runs its own frame loop -- a world's
                canvas, the feed's cards -- and CSS can pause an animation but not a loop, so the
                loop is held: a frame asked for while a lightbox is up is kept and run when the
                last one comes down. Nothing is dropped and no page has to know.
    the state   <html data-lightbox='<name>'>, for the stylesheet. Written only when it changes,
                so a caller that renames its box while it is up -- the nav, handing the whole
                lightbox on to the state interface (issue #66) -- never clears it in between.

  They nest, because one of them opens over another: "seed a small sky" in the persona sheet asks
  the shared question, and the question has to leave the sheet in front of the veil and hand it
  back when it is answered. So the boxes are a stack and the top of it is what the page is
  arranged around -- up() and down() are idempotent, and up() on a box already up re-applies the
  arrangement, which is how something drawn while a lightbox is up gets put behind it, and how one
  caller renames its own box rather than dropping it and raising another.

  A native <dialog> opened with showModal() keeps its own backdrop press, focus trap and Escape:
  those are the browser's and better than anything this could write. What it does not have is the
  veil, and that is the whole of what it borrows. The nav is not a dialog, so it brings its own
  Escape and its own focus trap (see the bottom of this file).
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var persona = window.interestingPersona;
  var html = document.documentElement;
  var root = html.getAttribute('data-root') || '';
  var SKY = persona ? persona.key : 'constellation';

  // The nav is a constellation this script places and a cascade of plain links without it, so the
  // stylesheet has to know which. Said here, while the <head> is read and before the body is
  // drawn, so there is never a flash of the layout a visitor is not getting (see _sass/_nav.scss).
  html.setAttribute('data-nav', 'live');

  // The names the shell used to keep for games that are gone: relay marks, quests, honors,
  // signals, a switchboard, a logbook, a cipher, a remix snapshot, a trail and an arcade. Taken
  // out of a visitor's document once, so an exported state stays an honest account of what the
  // site keeps.
  var RETIRED_KEYS = [
    'constellation-relay', 'constellation-quests', 'constellation-signals',
    'constellation-switchboard', 'constellation-logbook', 'constellation-cipher',
    'constellation-remix-snapshot', 'trail-journal', 'wayfinding-arcade'
  ];

  function holdsSky(value) {
    if (persona) return persona.holds(value);
    return Array.isArray(value) && value.some(function (s) {
      return !!s && typeof s.x === 'number' && isFinite(s.x)
        && typeof s.y === 'number' && isFinite(s.y) && typeof s.text === 'string';
    });
  }

  function seedSky(count) {
    if (persona) return persona.seedSky(count);
    var list = [];
    for (var i = 0; i < (count || 7); i++) {
      list.push({ x: 20 + Math.random() * 60, y: 20 + Math.random() * 60, text: 'a wish' });
    }
    return list;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /* ---- the rites the shell asks the engine for ------------------------------------------- */
  /* Nothing the shell writes or takes away is cut while a visitor is watching (README: "Motion
     axiom", the cut). Words a script writes are revealed -- js/motion.js steps one slice across
     the line at the register's slant, a tread to a word or two, and never takes the line apart,
     so textContent is only ever the words -- and a thing the shell takes off the screen is unmade
     first (.shell-unmake, _sass/_lightbox.scss), or a ghost of it is left where it was when the
     thing itself has to go at once. Each movement's treads and length are rolled by the engine on
     the element that plays it, and the shape's reason is said here: where the veil rises from,
     where a leaving box goes. The engine is optional throughout: the stub browsers the harnesses
     run load none, and without it, or for a visitor who asked for less motion, everything happens
     at once and synchronously. */

  function engine() {
    var m = window.interestingMotion;
    return m && typeof m.ms === 'function' ? m : null;
  }

  function calm() {
    var m = engine();
    if (m) return !!m.reduced;
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function riteMs(name, fallback) {
    var m = engine();
    return (m && m.ms(name)) || fallback;
  }

  // One movement's treads and length, rolled for this trigger and written on the element that
  // plays it (--ease-<rite> and --motion-<rite>, and the shape's point or angle when `options`
  // gives one), which the stylesheet's cut-in or cut-out reads. Hands back the length in ms, or 0
  // where nothing moves: no engine, or a visitor who asked for stillness.
  function cutOn(node, rite, options) {
    var m = engine();
    if (!m || typeof m.cut !== 'function' || calm() || !node || !node.style) return 0;
    return m.cut(node, rite, options) || 0;
  }

  // An arrival of the engine's own (m.arrive): where it comes from, the slice it comes in behind
  // and its treads, rolled for this one and written on it as --arrive-x, --arrive-y,
  // --arrive-angle, --ease-develop and --motion-develop, which cut.develop reads. False where
  // nothing was written, and the stylesheet's own direction and baked stair play instead, or
  // nothing at all.
  function cutArrival(node) {
    var m = engine();
    if (!m || typeof m.arrive !== 'function' || calm() || !node || !node.style) return false;
    m.arrive(node, { spell: 'develop', className: false });
    return true;
  }

  // A leaving's treads, rolled for it (--ease-unmake and --motion-unmake, which cut.unmake reads).
  // Hands back its length, or 0 where nothing was written.
  function cutLeave(node) {
    return cutOn(node, 'unmake', { base: 340 });
  }

  // The direction of travel from (dx, dy) as the angle of the slice a thing moves behind: the way
  // a CSS gradient counts it, 0deg up and clockwise, which is how the engine's rolls are written.
  function angleOf(dx, dy) {
    return Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) + 'deg';
  }

  // How far a leaving box steps toward where it goes, in CSS pixels: the engine's own reach.
  var LEAVE_REACH = 18;

  // Where a leaving box goes, when the reason it goes is somewhere on the screen -- the control
  // the focus is going home to: a step toward it (--leave-x, --leave-y) and the slice it goes
  // behind pointing the same way (--leave-angle). Read once, as the leaving starts; without a
  // place to go it keeps the page's own roll.
  function aimAt(node, box, toward) {
    if (!toward || toward === document.body || typeof toward.getBoundingClientRect !== 'function'
        || !node.style || typeof node.style.setProperty !== 'function') return;
    var to = toward.getBoundingClientRect();
    if (!to || !(to.width || to.height)) return;
    var dx = to.left + to.width / 2 - (box.left + box.width / 2);
    var dy = to.top + to.height / 2 - (box.top + box.height / 2);
    var d = Math.sqrt(dx * dx + dy * dy);
    if (!(d >= 1)) return;
    node.style.setProperty('--leave-x', (dx / d * LEAVE_REACH).toFixed(1) + 'px');
    node.style.setProperty('--leave-y', (dy / d * LEAVE_REACH).toFixed(1) + 'px');
    node.style.setProperty('--leave-angle', angleOf(dx, dy));
  }

  // Words written to a line, and revealed there. A line still being revealed is ended first, so a
  // question asked over a question starts its own cut rather than finishing the last one's.
  var revealed = typeof WeakMap === 'function' ? new WeakMap() : null;

  function say(node, text, quiet) {
    if (!node) return;
    var before = revealed && revealed.get(node);
    if (before) {
      before();
      revealed['delete'](node);
    }
    if (text != null) node.textContent = text;
    var m = engine();
    if (quiet || !m || typeof m.reveal !== 'function' || calm()) return;
    var undo = m.reveal(node);
    if (revealed && typeof undo === 'function') revealed.set(node, undo);
  }

  // The words a box carries, written onto it once the box has landed rather than while it is still
  // coming: one edge at a time (README: "Motion axiom"), so the box's own slice crosses an empty
  // card and the register's slant then writes its words, and no word is cut in where the box is
  // not yet there to be seen. Each line is held unseen until `box` says its arrival has ended
  // (animationend on the box itself, never on what is inside it), and then revealed; `after` --
  // the length of that arrival as the caller rolled it, and a little more -- is only the fallback
  // for a browser that never says so, or a box whose arrival did not start again. Where nothing
  // moves they are simply there. Hands back the stop, for a box answered or taken away before it
  // has landed: its words stay as they are, and a ghost of it leaves as it stood.
  function sayOnLanding(box, lines, after) {
    var held = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] && lines[i].style && typeof lines[i].style.setProperty === 'function') held.push(lines[i]);
    }
    var moving = after > 0 && engine() && !calm() && typeof window.setTimeout === 'function';
    for (i = 0; i < held.length; i++) {
      if (moving) held[i].style.setProperty('visibility', 'hidden');
      else held[i].style.removeProperty('visibility');
    }
    if (!moving) {
      for (i = 0; i < held.length; i++) say(held[i], null, true);
      return function () {};
    }
    var listening = !!(box && typeof box.addEventListener === 'function');
    var timer = 0;
    function stop() {
      if (timer && typeof window.clearTimeout === 'function') window.clearTimeout(timer);
      timer = 0;
      if (listening) box.removeEventListener('animationend', land);
      listening = false;
    }
    function land(ev) {
      if (ev && ev.target !== box) return;
      stop();
      for (var j = 0; j < held.length; j++) {
        held[j].style.removeProperty('visibility');
        say(held[j]);
      }
    }
    if (listening) box.addEventListener('animationend', land);
    timer = window.setTimeout(function () { land(); }, after + 250);
    return stop;
  }

  // Can this be unmade before it goes: an engine to time it by, a visitor who did not ask for
  // stillness, and a browser with the clock and the classList the rite needs.
  function canUnmake(node) {
    return !!(node && node.classList && engine() && !calm()
      && typeof window.setTimeout === 'function' && typeof node.addEventListener === 'function');
  }

  // Unmade: it goes behind a slice pointing where it goes -- the side nearest its destination
  // first, as if it sank through a slot on that side -- while it steps that way, in growing
  // treads; then `then()`. At once where it cannot be unmade, so a caller's bookkeeping is the
  // same either way.
  function unmake(node, then) {
    if (!canUnmake(node)) {
      then();
      return;
    }
    var done = false;
    function finish(ev) {
      if (done || (ev && ev.target && ev.target !== node)) return;
      done = true;
      node.classList.remove('shell-unmake');
      then();
    }
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('inert', '');
    // Under a lightbox the page's aside is held still, and a .shell-unmake in it is the one thing
    // let play (_lightbox.scss), so what is leaving has gone when the page comes back.
    // The treads rolled for this leaving (--ease-unmake, read by .shell-unmake); the clock below
    // is only the fallback for a browser that never says the animation ended, so it waits for the
    // length the engine rolled.
    var length = cutLeave(node);
    node.classList.add('shell-unmake');
    node.addEventListener('animationend', finish);
    node.addEventListener('animationcancel', finish);
    window.setTimeout(finish, Math.max(riteMs('medium', 340), length) + 160);
  }

  // The passing rites a box may be caught in as it is copied (a button still under the pointer, a
  // line still being revealed): its ghost leaves as it stands, so none of them plays again in it.
  var PASSING = /(^|\s)is-(waxing|waning|stamping|sealing|unsealing|revealing)(?=\s|$)/g;

  // The few properties of a box's own layout its copy cannot take from its class alone: a dialog
  // lays its lines out as a grid only while it is [open], which a copy of it is not.
  var LAYOUT = ['display', 'row-gap', 'column-gap', 'align-content', 'align-items', 'justify-content',
    'justify-items', 'flex-direction', 'flex-wrap'];

  // Where a box stands and how it is laid out, read while it is on screen, for the ghost a box may
  // need after it has gone: its rect, its own layout and how far it was scrolled. Null for a box
  // that is not on screen.
  function standing(host) {
    if (!host || typeof host.getBoundingClientRect !== 'function') return null;
    var box = host.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    var seen = { left: box.left, top: box.top, width: box.width, height: box.height, layout: {}, scroll: host.scrollTop || 0 };
    var computed = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(host) : null;
    if (computed && typeof computed.getPropertyValue === 'function') {
      for (var i = 0; i < LAYOUT.length; i++) seen.layout[LAYOUT[i]] = computed.getPropertyValue(LAYOUT[i]);
    }
    return seen;
  }

  // A ghost of a box that has to go at once -- the "are you sure?" dialog, which must close
  // before the focus can go home to the control that opened it, and the state panel, which its
  // own store hides: a copy of it left exactly where it stood, unmade there toward `toward` (the
  // control the focus goes home to), and taken out when it has gone. The copy is the box's class
  // and data (what it is painted by), its own layout, and its contents node by node -- a copy of
  // a field keeps what a visitor typed in it, where its markup would not. It is lifted into the
  // top layer, over a sheet the question may have been asked from (a modal <dialog> is there, and
  // anything under it is not seen); a browser without popovers gets it as the highest layer of
  // the page. Under no pointer, hidden from a screen reader, and playing through whatever
  // lightbox is still up around it. `seen` is where the box was last seen standing, for one
  // already hidden by the time it goes.
  function ghostOf(host, seen, toward) {
    if (!canUnmake(host) || !document.body || !host.childNodes || !host.attributes) return;
    var at = standing(host) || seen;
    if (!at) return;
    var ghost = document.createElement('div');
    ghost.className = String(host.className || '').replace(/\b[\w-]+-fallback\b/g, '').replace(/\s+/g, ' ').trim() + ' shell-ghost';
    for (var a = 0; a < host.attributes.length; a++) {
      var name = host.attributes[a].name;
      if (name.indexOf('data-') === 0 && name !== ASIDE && name !== FRONT) ghost.setAttribute(name, host.attributes[a].value);
    }
    for (var c = 0; c < host.childNodes.length; c++) {
      if (typeof host.childNodes[c].cloneNode === 'function') ghost.appendChild(host.childNodes[c].cloneNode(true));
    }
    var named = ghost.querySelectorAll('[id]');
    for (var i = 0; i < named.length; i++) named[i].removeAttribute('id');
    var passing = ghost.querySelectorAll('[class*="is-"]');
    for (var j = 0; j < passing.length; j++) {
      passing[j].className = String(passing[j].className).replace(PASSING, ' ').replace(/\s+/g, ' ').trim();
    }
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    var style = ghost.style;
    style.setProperty('position', 'fixed');
    style.setProperty('top', at.top + 'px');
    style.setProperty('left', at.left + 'px');
    style.setProperty('right', 'auto');
    style.setProperty('bottom', 'auto');
    style.setProperty('box-sizing', 'border-box');
    style.setProperty('width', at.width + 'px');
    style.setProperty('height', at.height + 'px');
    style.setProperty('max-width', 'none');
    style.setProperty('max-height', 'none');
    style.setProperty('margin', '0');
    style.setProperty('overflow', 'hidden');
    style.setProperty('display', 'block');
    for (var k = 0; k < LAYOUT.length; k++) {
      var value = at.layout && at.layout[LAYOUT[k]];
      if (value && value !== 'none' && value !== 'normal') style.setProperty(LAYOUT[k], value);
    }
    style.setProperty('z-index', 'calc(var(--layer-front) + 1)');
    style.setProperty('pointer-events', 'none');
    style.setProperty('animation-play-state', 'running');
    aimAt(ghost, at, toward);
    var lifted = typeof ghost.showPopover === 'function';
    if (lifted) ghost.setAttribute('popover', 'manual');
    document.body.appendChild(ghost);
    if (lifted) {
      try {
        ghost.showPopover();
      } catch (e) {
        /* it stays the highest layer of the page */
      }
    }
    if (at.scroll) ghost.scrollTop = at.scroll;
    unmake(ghost, function () {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    });
  }

  var unlockCount = 0;

  function unlock(host, options) {
    var opts = options || {};
    var key = opts.key || SKY;
    var isSky = key === SKY;
    var holds = typeof opts.holds === 'function' ? opts.holds : holdsSky;
    var seed = typeof opts.seed === 'function' ? opts.seed : seedSky;
    var onReady = typeof opts.onReady === 'function' ? opts.onReady : function () {};
    var onPowerDown = typeof opts.onPowerDown === 'function' ? opts.onPowerDown : function () {};
    var copy = opts.copy || {};
    var elsewhere = 'elsewhere' in opts ? opts.elsewhere
      : (isSky ? { text: 'or place your own stars in your persona', open: 'sky' } : null);
    var powered = false;
    var box = null;
    var waking = null; // { value, how } while the box goes, before the part is told it is powered
    var unwritten = null; // the stop for the box's words, while they wait for the box to land

    function readValue() {
      if (isSky && persona) {
        return { status: persona.read().status, value: persona.stars() };
      }
      return store ? store.read(key, null) : { status: 'unavailable', value: null };
    }

    /* Power coming on is one thing after another, never one edge over another (README: "Motion
       axiom"): first the box goes back down into the machine it powers, and only once it has
       gone is the part told it is powered (wake, below). Where nothing can play, all of it is at
       once and synchronous, so a caller's bookkeeping is the same either way. */
    function powerUp(value, how) {
      powered = true;
      if (unwritten) unwritten();
      unwritten = null;
      var gone = box;
      box = null;
      waking = { value: value, how: how };
      // The part is live from the press -- reachable, and read aloud -- whatever is still moving.
      host.removeAttribute('inert');
      host.removeAttribute('aria-hidden');
      var first = host.querySelector('button:not([disabled]), a[href], input, [tabindex]');
      if (first && typeof first.focus === 'function' && how !== 'persona') first.focus();
      if (gone && gone.parentNode) {
        unmake(gone, function () {
          if (gone.parentNode) gone.parentNode.removeChild(gone);
          wake();
        });
      } else {
        wake();
      }
    }

    /* The part, told. A caller that takes the part away now -- the stage unmakes its gate and deals
       the piece in its place -- takes the dust sheet with it, as one thing. A part that stays has
       its sheet lifted back off it the way it came down (is-powering-up, _unlock.scss), in treads
       rolled for this lifting; at once where nothing can play. */
    function wake() {
      var was = waking;
      waking = null;
      if (!was || !powered) return; // powered down again while the box was going
      onReady(was.value, was.how);
      if (!host.parentNode || host.classList.contains('shell-unmake')) return;
      host.classList.remove('powered-down');
      var lift = cutOn(host, 'power-up', { family: 'leave' });
      if (lift && typeof window.setTimeout === 'function') {
        host.classList.add('is-powering-up');
        window.setTimeout(function () { host.classList.remove('is-powering-up'); }, lift + 200);
      }
    }

    function powerDown(status) {
      var title = copy.title || 'no sky yet';
      var note = copy.note;
      var button = copy.button || 'seed a sky to begin';
      if (!note) {
        if (status === 'unavailable') {
          note = 'This part reads the sky kept in this browser, and this browser keeps nothing between visits. A sky seeded here lasts until you leave.';
          button = copy.button || 'seed a sky for now';
        } else if (status === 'unreadable') {
          title = copy.title || 'the saved sky cannot be read';
          note = 'What this browser kept of the sky is not something this part can use. A fresh one replaces it.';
          button = copy.button || 'start a fresh sky';
        } else {
          note = 'This part reads the sky kept in this browser, and there is none yet.';
        }
      }

      unlockCount += 1;
      box = el('div', 'unlock');
      var heading = el('p', 'unlock-title', title);
      heading.id = 'unlock-title-' + unlockCount;
      box.setAttribute('role', 'group');
      box.setAttribute('aria-labelledby', heading.id);
      box.appendChild(heading);
      var line = el('p', 'unlock-note', note);
      box.appendChild(line);
      var controls = el('div', 'controls');
      // The button's words sit in a span of their own, so they can be revealed: the reveal is a
      // mask over the element it is given, and given the button it would cut the button in with
      // its words, fill and state layers and all.
      var go = el('button', 'unlock-go btn-filled');
      go.type = 'button';
      var goWord = el('span', 'unlock-word', button);
      go.appendChild(goWord);
      controls.appendChild(go);
      box.appendChild(controls);
      var more = null;
      if (elsewhere && elsewhere.open && persona) {
        more = el('button', 'unlock-else btn-text', elsewhere.text || 'or open your persona');
        more.type = 'button';
        more.addEventListener('click', function () {
          persona.open(elsewhere.open);
        });
        box.appendChild(more);
      } else if (elsewhere && elsewhere.href) {
        more = el('a', 'unlock-else', elsewhere.text || elsewhere.href);
        more.href = elsewhere.href;
        box.appendChild(more);
      }

      host.parentNode.insertBefore(box, host);
      host.setAttribute('data-unlock-host', '');
      // One thing after another (README: "Motion axiom"). First the dust sheet is drawn down over
      // the machine, which is the whole of its dimming, in treads rolled for it.
      if (unwritten) unwritten();
      var sheet = cutOn(host, 'power-down', { family: 'arrive' });
      host.classList.add('powered-down');
      host.setAttribute('inert', '');
      host.setAttribute('aria-hidden', 'true');
      // Then the box comes up out of the machine it powers (its direction is the stylesheet's,
      // _unlock.scss), waiting under its own edge until the sheet is down, in treads rolled for
      // this arrival; and once it has landed its words are written on it.
      if (sheet && box.style) box.style.setProperty('--unlock-wait', sheet + 'ms');
      var landing = cutOn(box, 'develop', { duration: 'long' });
      unwritten = sayOnLanding(box, [heading, line, goWord, more], sheet + landing);
      var heard = powered && !waking; // the caller was told it is powered, so it is told it is not
      waking = null;
      powered = false;
      if (heard) onPowerDown();

      go.addEventListener('click', function () {
        var value = seed();
        if (isSky && persona) {
          // Written through the persona, which tells every listener -- this one included, below,
          // which is what powers the part up.
          persona.setStars(value, 'seeded');
          return;
        }
        var kept = store ? store.set(key, value) : false;
        powerUp(value, kept ? 'seeded' : 'memory');
      });
    }

    var read = readValue();
    if (read.status === 'ok' && holds(read.value)) {
      powered = true;
      onReady(read.value, 'saved');
    } else if (host && host.parentNode) {
      powerDown(read.status);
    } else {
      onReady(null, 'missing');
      return false;
    }

    // The sky follows changes made in the sheet or through the persona API: the part powers up,
    // reloads, or powers down to match. A sky changed while the part is still waking is the one it
    // wakes to.
    if (isSky && persona) {
      var offSky = persona.onSky(function (list, how, kept) {
        if (!host.parentNode) { offSky(); return; }
        if (holds(list)) {
          if (!powered) powerUp(list, how === 'seeded' ? (kept ? 'seeded' : 'memory') : 'persona');
          else if (waking) waking.value = list;
          else onReady(list, 'persona');
        } else if (powered) {
          powerDown(readValue().status);
        }
      });
    }
    return powered;
  }

  /* ---- the lightbox ------------------------------------------------------------------------ */
  /* One veil, one component, three things that open through it -- see "One lightbox, shared" in
     the header comment and the README section "The lightbox". This used to be the nav's own, built
     by hand when the sparkles logo was pressed; issue #70 asked for the same effect everywhere, so
     it lives up here with the rest of the shell's shared components and the nav is one of its three
     callers. */

  var VEIL_ID = 'lightbox-veil';
  var ASIDE = 'data-lightbox-aside'; // what this put aside, and so what it may give back
  var FRONT = 'data-lightbox-front'; // the one child of <body> the veil leaves in front of it

  var veil = null; // the one veil, found the first time something is raised
  var raised = []; // the lightboxes up now, in the order they went up: the last of them is on top
  var watchingTheBody = false;

  /* ---- the page's frame loop, held while a lightbox is up ---------------------------------- */

  var frameHeld = false;
  var frameQueue = []; // [{ id, fn }], the frames asked for while a lightbox is up
  var frameId = 0; // counts down, so a held handle can never be mistaken for a real one
  var nativeFrame = window.requestAnimationFrame;
  var nativeCancel = window.cancelAnimationFrame;
  // A safety valve: if something asks for frames in a way holding cannot survive, let go of them
  // all rather than grow without end.
  var MAX_HELD_FRAMES = 240;

  function flushFrames() {
    var waiting = frameQueue;
    frameQueue = [];
    var now = window.performance && window.performance.now
      ? window.performance.now() : new Date().getTime();
    for (var i = 0; i < waiting.length; i++) {
      try {
        waiting[i].fn(now);
      } catch (e) {
        /* a page's own loop, and not this one's to repair */
      }
    }
  }

  function hold(on) {
    if (!nativeFrame || on === frameHeld) return;
    frameHeld = on;
    if (!on) flushFrames();
  }

  // Installed the first time anything is raised, so a visitor who never opens one runs on untouched
  // globals, and a pass-through whenever nothing is being held.
  function installHold() {
    if (!nativeFrame || window.requestAnimationFrame !== nativeFrame) return;
    window.requestAnimationFrame = function (fn) {
      if (!frameHeld || typeof fn !== 'function') return nativeFrame.call(window, fn);
      if (frameQueue.length >= MAX_HELD_FRAMES) {
        hold(false);
        return nativeFrame.call(window, fn);
      }
      frameId -= 1;
      frameQueue.push({ id: frameId, fn: fn });
      return frameId;
    };
    window.cancelAnimationFrame = function (id) {
      if (id < 0) {
        for (var i = 0; i < frameQueue.length; i++) {
          if (frameQueue[i].id === id) {
            frameQueue.splice(i, 1);
            return;
          }
        }
        return;
      }
      if (nativeCancel) nativeCancel.call(window, id);
    };
  }

  /* ---- the page, put aside ----------------------------------------------------------------- */

  /* Everything but what is open, put aside while it is: inert, so no pointer and no Tab reaches
     it, and hidden from a screen reader, so what is in front of the veil is all there is to read.
     Anything already inert or already hidden for its own reasons is left exactly as it is -- the
     consent library hides its own markup that way -- and only what this put aside is brought
     back. */
  function giveBack(node) {
    if (!node.hasAttribute(ASIDE)) return;
    node.removeAttribute('inert');
    node.removeAttribute('aria-hidden');
    node.removeAttribute(ASIDE);
  }

  function putBehind(node) {
    if (node.hasAttribute('inert') || node.hasAttribute('aria-hidden')) return;
    node.setAttribute('inert', '');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute(ASIDE, '');
  }

  function aside(keep) {
    var kids = document.body ? document.body.children : [];
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node === veil) continue; // the veil is the one thing in front that is not what is open
      if (keep && node === keep) {
        // What is open: live, and lifted over the veil. It may have been put behind by the
        // lightbox underneath this one, in which case it is given back first.
        giveBack(node);
        node.setAttribute(FRONT, '');
      } else {
        node.removeAttribute(FRONT);
        if (keep) putBehind(node);
        else giveBack(node);
      }
    }
  }

  /* The child of <body> an element sits in, which is the granularity the page is put aside at:
     a caller names the thing it opened and this finds the piece of the body that holds it. */
  function bodyChild(node) {
    var body = document.body;
    if (!body) return null;
    while (node && node.parentNode && node.parentNode !== body) node = node.parentNode;
    return node && node.parentNode === body ? node : null;
  }

  /* ---- up and down ------------------------------------------------------------------------- */

  /* The veil rises as a curve from the control that raised it (_sass/_lightbox.scss): the centre
     of that control, as a share of the viewport the veil covers, written on the veil as the
     curve's point with the treads rolled for this rising. Read once, as the veil goes up, and
     never again while it is: a box raised over another raises nothing, the veil is already there.
     And read first, before the page is put aside, so the one layout it costs is of a page nothing
     has been written to yet (arrange, below).

     The control is the one a caller names; else the one a pointer pressed a moment ago, unless a
     key has been pressed since -- a browser that does not focus a button it clicks (Safari) leaves
     the focus wherever a script last put it, which is not what raised anything; else the one that
     has the focus, which is what a keyboard raised it with. With no control to rise from it rises
     from the middle, as it does on a page with no engine. */
  var pressed = null; // the control a pointer last pressed, and when (notePress, below)
  var pressedAt = 0;

  function notePress(ev) {
    var target = ev && ev.target;
    if (!target || typeof target.closest !== 'function') return;
    pressed = target.closest('button, a[href], summary, [role="button"]');
    pressedAt = Date.now();
    seeState();
  }

  function noteKey(ev) {
    pressed = null;
    var key = ev && ev.key;
    if (key === 'Escape' || key === 'Esc' || key === 'Enter' || key === ' ') seeState();
  }

  // Where the veil rises from, as { x, y } in percent of the viewport, or null where nothing moves.
  function riseFrom(from) {
    if (!veil || !engine() || calm()) return null;
    var x = 50;
    var y = 50;
    var recent = pressed && pressed.isConnected !== false && Date.now() - pressedAt < 1000 ? pressed : null;
    var control = from || recent || document.activeElement;
    if (control === document.body || control === html) control = null;
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    if (control && w && h && typeof control.getBoundingClientRect === 'function') {
      var at = control.getBoundingClientRect();
      if (at && (at.width || at.height)) {
        x = Math.max(0, Math.min(100, (at.left + at.width / 2) / w * 100));
        y = Math.max(0, Math.min(100, (at.top + at.height / 2) / h * 100));
      }
    }
    return { x: x, y: y };
  }

  /* The page, arranged around the top of the stack: one lightbox, one over another, or none. Every
     change goes through here rather than through the callers, so a box that opens over another and
     closes again leaves the one underneath exactly as it was. */
  function arrange() {
    var top = raised.length ? raised[raised.length - 1] : null;
    if (!veil) veil = document.getElementById(VEIL_ID);
    if (top) {
      var point = veil && veil.hidden ? riseFrom(top.from) : null;
      installHold();
      aside(top.keep);
      hold(true);
      if (point) cutOn(veil, 'veil', point);
      if (veil) veil.hidden = false;
      // Written only when it says something new, never cleared and set again: a box renamed while
      // it is up (the state interface, below) leaves every rule keyed on a lightbox being up
      // matched throughout, which is what "zero jitter" asks for (issue #66).
      if (html.getAttribute('data-lightbox') !== top.name) {
        html.setAttribute('data-lightbox', top.name);
      }
    } else {
      html.removeAttribute('data-lightbox');
      if (veil) veil.hidden = true;
      hold(false);
      aside(null);
    }
  }

  /* Something drawn while a lightbox is up belongs behind it. Each of the three affordances the
     constellation adopts is drawn by a deferred script, and the consent banner's only once the
     library beside it has loaded, so a child of <body> may arrive at any moment -- including while
     the persona sheet is open, which is why this is the lightbox's business and not the nav's. */
  function watchTheBody() {
    if (watchingTheBody || !window.MutationObserver || !document.body) return;
    watchingTheBody = true;
    new MutationObserver(function () {
      if (raised.length) arrange();
    }).observe(document.body, { childList: true });
  }

  function lightbox(options) {
    var opts = options || {};
    var named = String(opts.name || 'lightbox'); // what it is called unless a caller says otherwise
    var box = {
      name: named,
      keep: null,
      from: null,
      onPress: typeof opts.onPress === 'function' ? opts.onPress : null
    };

    // up(name) renames the box as it raises it, which is how one caller hands the whole lightbox
    // on to something else of its own without dropping it: the nav raises 'nav' and then 'state'
    // over the same veil (issue #66). Raised with no name again it goes back to the one it was
    // built with, so the next press starts where the last one did. `from` is the control that
    // raised it, which the veil rises from if it is not up yet.
    function up(name, from) {
      box.name = name ? String(name) : named;
      box.from = from || null;
      // Resolved on every press rather than once: the sheet a caller names may be built, moved or
      // replaced long after it asked for its lightbox.
      box.keep = bodyChild(opts.keep || null);
      if (raised.indexOf(box) === -1) raised.push(box);
      watchTheBody();
      arrange();
    }

    function down() {
      var at = raised.indexOf(box);
      if (at !== -1) raised.splice(at, 1);
      arrange();
    }

    return { up: up, down: down, name: named };
  }

  /* A press on the veil is a press on the page behind it, which is a way of saying "not this". It
     goes to whatever is on top: the thing in front of the veil is the only thing that knows how to
     put itself away. Watched once, at the start, because the veil is the shell's own markup. */
  function watchTheVeil() {
    veil = document.getElementById(VEIL_ID);
    if (!veil) return;
    veil.hidden = true; // whatever the markup said: nothing is open yet
    veil.addEventListener('click', function () {
      var top = raised.length ? raised[raised.length - 1] : null;
      if (top && top.onPress) top.onPress();
    });
  }

  /* ---- caution before a destructive action ------------------------------------------------- */
  /* One warning treatment, one modal, one question -- see the header comment and the README
     section "Destructive-caution axiom". No page writes its own confirmation, and nothing on the
     site calls window.confirm: a browser dialog cannot say which of a visitor's things is about
     to go, and a question that reads differently on every page is not a safety switch. */

  var sure = null; // the one modal, built the first time something asks and reused after that
  var asking = null; // the question now on screen: who asked it, and what to do with the answer
  var sureBox = null; // the lightbox it is asked in, the same one the logo and the sheet open
  var sureUnwritten = null; // the stop for the question's words, while they wait for it to land

  function buildAreYouSure() {
    var host = document.createElement('dialog');
    host.className = 'are-you-sure';
    var title = el('p', 'are-you-sure-title');
    title.id = 'are-you-sure-title';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-labelledby', title.id);
    var note = el('p', 'are-you-sure-note');
    var actions = el('div', 'controls are-you-sure-actions');
    var go = el('button', 'warning are-you-sure-go');
    go.type = 'button';
    var goWord = el('span', 'are-you-sure-word'); // the words, revealable (see unlock)
    go.appendChild(goWord);
    var no = el('button', 'are-you-sure-no', 'cancel');
    no.type = 'button';
    actions.appendChild(go);
    actions.appendChild(no);
    host.appendChild(title);
    host.appendChild(note);
    host.appendChild(actions);
    (document.body || document.documentElement).appendChild(host);

    go.addEventListener('click', function () { settle(true); });
    no.addEventListener('click', function () { settle(false); });
    // Escape: the browser raises 'cancel' first, and a dismissal means no.
    host.addEventListener('cancel', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      settle(false);
    });
    // Closed any other way the browser offers -- still no, and the caller still hears about it.
    host.addEventListener('close', function () {
      if (!host.open) settle(false);
    });
    // A press on the backdrop, which is what a dialog owes anyone who opened it by mistake. The
    // dialog element is the target for the backdrop as well as its own padding, so the press has
    // to land outside the box itself. (The shared veil is behind the top layer, so while the
    // browser has showModal() it never sees this press; onPress below is for the browser that
    // has not, where the box is an ordinary element over the veil.)
    host.addEventListener('click', function (ev) {
      if (ev.target !== host) return;
      var box = host.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) {
        settle(false);
      }
    });
    // Without dialog.showModal(), both Escape and the focus loop belong to this question.
    document.addEventListener('keydown', function (ev) {
      if (!asking) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        settle(false);
        return;
      }
      if (ev.key === 'Tab' && typeof host.showModal !== 'function') {
        ev.preventDefault();
        var next = document.activeElement === go ? no
          : document.activeElement === no ? go : (ev.shiftKey ? no : go);
        next.focus();
      }
    });
    return { host: host, title: title, note: note, go: go, goWord: goWord, no: no };
  }

  function settle(yes) {
    var answered = asking;
    asking = null; // first, so closing the dialog cannot send the answer twice
    if (!answered) return;
    if (sureUnwritten) sureUnwritten();
    sureUnwritten = null;
    // The box has to close at once (a modal dialog holds the focus until it does), so what is
    // unmade is a ghost of it, left exactly where the question was and going back toward the
    // control it was asked from, which is where the focus goes.
    if (sure.host.open) ghostOf(sure.host, null, answered.opener);
    if (sure.host.open && typeof sure.host.close === 'function') sure.host.close();
    else sure.host.removeAttribute('open');
    sure.host.classList.remove('are-you-sure-fallback');
    // The lightbox comes down before the focus moves and before the answer is acted on: the control
    // the focus goes back to was behind the veil and inert a moment ago, and what onConfirm does
    // next has to find a live page -- the same reason the nav's close() does not wait for a task of
    // its own.
    if (sureBox) sureBox.down();
    var back = answered.opener;
    if (back && typeof back.focus === 'function') back.focus();
    if (yes) answered.onConfirm();
    else answered.onCancel();
  }

  function areYouSure(options) {
    var opts = options || {};
    var onConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : function () {};
    var onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : function () {};
    var what = String(opts.what || '').trim() || 'throw this away';
    if (asking) settle(false); // one question at a time, and an unanswered one means no
    if (!sure) {
      sure = buildAreYouSure();
      sureBox = lightbox({
        name: 'are-you-sure',
        keep: sure.host,
        onPress: function () { settle(false); }
      });
    }
    // The words are put in now and written on the box once it has landed (sayOnLanding): the box
    // arrives behind its own slice (.are-you-sure[open], _controls.scss), in treads rolled for
    // this question, and only then does the register's slant write the question on it.
    say(sure.title, 'are you sure you want to ' + what + '?', true);
    say(sure.note, opts.detail || '', true);
    sure.note.hidden = !opts.detail;
    say(sure.goWord, String(opts.confirm || '').trim() || ('yes, ' + what), true);
    var landing = cutOn(sure.host, 'dialog-in', { family: 'arrive' });
    var lines = opts.detail ? [sure.title, sure.note, sure.goWord] : [sure.title, sure.goWord];
    sureUnwritten = sayOnLanding(sure.host, lines, landing);
    asking = {
      onConfirm: onConfirm,
      onCancel: onCancel,
      opener: opts.opener || document.activeElement
    };
    // The page goes under the veil first, so the question is asked over a page that is already
    // dimmed, blurred, stilled and out of reach. Asked from inside the persona sheet, this is the
    // second lightbox up: the stack leaves the sheet in front of the veil until it is answered.
    // Raising it is also what wakes this dialog up: it is a child of the body, built the first
    // time anything asks, so a lightbox already up will have put it aside with the rest of the
    // page long before -- and the state interface asks from inside the logo's lightbox now
    // (issue #66). Naming it as the one thing to leave in front is what takes those marks off
    // again, here, where every other caller's would be taken off too. A question nobody can
    // answer is worse than no question. Asked from a page, the veil rises from the control that
    // asked.
    if (sureBox) sureBox.up(null, asking.opener);
    if (typeof sure.host.showModal === 'function') {
      sure.host.showModal();
    } else {
      sure.host.setAttribute('open', '');
      sure.host.classList.add('are-you-sure-fallback');
    }
    // Cancel, not confirm: the one press a visitor who got here by mistake should be one key away
    // from is the one that changes nothing.
    sure.no.focus();
  }

  function destructive(control, options) {
    var opts = options || {};
    if (!control) return function () {};
    control.classList.add('warning');

    function pressed() {
      var when = typeof opts.when === 'function' ? opts.when : function () { return true; };
      if (!when()) {
        // Nothing of the visitor's is about to go, so there is nothing to ask: an empty drawer
        // emptied again takes nothing away, and the control says so in the page's own words.
        if (typeof opts.onConfirm === 'function') opts.onConfirm();
        return;
      }
      areYouSure({
        what: opts.what,
        detail: typeof opts.detail === 'function' ? opts.detail() : opts.detail,
        confirm: opts.confirm || (control.textContent || '').trim(),
        onConfirm: opts.onConfirm,
        onCancel: opts.onCancel,
        opener: control
      });
    }

    control.addEventListener('click', pressed);
    return function () {
      control.removeEventListener('click', pressed);
      control.classList.remove('warning');
    };
  }

  function retireOldKeys() {
    if (!store || typeof store.keys !== 'function') return;
    var kept = store.keys();
    for (var i = 0; i < RETIRED_KEYS.length; i++) {
      if (kept.indexOf(RETIRED_KEYS[i]) !== -1) store.remove(RETIRED_KEYS[i]);
    }
  }

  // Every slider says how full it is, so the M3 track can paint up to the handle. Written only when
  // it changes: every slider is read again after any change to the page, and a write of the same
  // value would still ask the browser to restyle a slider that has not moved.
  function fillRange(input) {
    var min = Number(input.min === '' ? 0 : input.min);
    var max = Number(input.max === '' ? 100 : input.max);
    var value = Number(input.value);
    var pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    var fill = Math.max(0, Math.min(100, pct)).toFixed(2) + '%';
    if (typeof input.style.getPropertyValue === 'function' && input.style.getPropertyValue('--range-pct') === fill) return;
    input.style.setProperty('--range-pct', fill);
  }

  var fillPending = false;

  function fillAllRanges() {
    fillPending = false;
    var all = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < all.length; i++) fillRange(all[i]);
  }

  function fillSoon() {
    if (fillPending) return;
    fillPending = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(fillAllRanges);
    else fillAllRanges();
  }

  // A slider let go of settles: .is-settling for one short movement after the finger lifts or
  // the key comes up, which is what the stylesheet ratchets the fill on (never under the finger).
  var settling = typeof WeakMap === 'function' ? new WeakMap() : null;

  function settleRange(ev) {
    var input = ev && ev.target;
    if (!input || input.type !== 'range' || !input.classList || typeof window.setTimeout !== 'function') return;
    if (!engine() || calm()) return;
    input.classList.add('is-settling');
    var was = settling && settling.get(input);
    if (was && typeof window.clearTimeout === 'function') window.clearTimeout(was);
    var timer = window.setTimeout(function () {
      input.classList.remove('is-settling');
    }, riteMs('short', 170) + 80);
    if (settling) settling.set(input, timer);
  }

  function watchRanges() {
    document.addEventListener('input', function (ev) {
      if (ev.target && ev.target.type === 'range') fillRange(ev.target);
    });
    document.addEventListener('change', settleRange);
    document.addEventListener('pointerup', settleRange);
    document.addEventListener('keyup', settleRange);
    // A piece may move a slider without an input event (ctx.set, from a tap on the scene), and a
    // new piece puts new ones on the page: either way, everything is re-read on the next frame.
    document.addEventListener('click', fillSoon);
    if (window.MutationObserver) {
      new MutationObserver(fillSoon).observe(document.body, { childList: true, subtree: true });
    }
    fillAllRanges();
  }

  /* ------------------------------------------------------------------------------------------- */
  /* The main nav: the sparkles logo in the upper left, and the constellation it opens.

     The markup is in _includes/layout.njk and the look is in _sass/_nav.scss. What is left for a
     script is the four things neither of those can do:

       place()   where the stars go. Only something that can count the options knows that, and the
                 set changes with the visitor's state, so the geometry is worked out here and
                 handed to the stylesheet as --x, --y, --len and --a on each option: where the
                 chip sits, and the ray that reaches it from the logo's heart -- and --cut-angle,
                 the way the chip's edge runs, which is out along that ray. The stars fall down
                 the left edge in even steps, each pushed out sideways by its own amount so the
                 set reads as a scatter rather than a list, and the second orbit takes a column of
                 its own as soon as there is room for one.
       navBox    the lightbox, which is no longer the nav's own: the veil, the inert page and the
                 held frame loop are the shared component above, and the nav is one of its three
                 callers (issue #70). All this section does with it is raise it on every press,
                 rename it where it stands when the state interface takes it over, and take it
                 down again, naming the constellation as the one thing to leave in front of the
                 veil.
       shape()   the options that come and go. The world a reading opens onto is only there once
                 something has been read, and "change this site", "cookies" and "state" are only
                 there while the files that own them have drawn their own controls -- which this
                 then hides, and presses on the constellation's behalf. js/participate.js,
                 js/analytics.js and js/state.js are fixed files (see FIXED_FILES in
                 .github/scripts/make_interesting.py) and none of them is edited for any of it:
                 the shell adopts what they drew instead.
       stateModal()
                 the state interface, taking the lightbox over (issue #66). "state" is the one
                 option that is not a destination and not someone else's dialog: it is a thing to
                 do, here, with the whole screen. So the lightbox does not come down for it. The
                 constellation gives way, js/state.js's own panel is moved into the middle of the
                 veil that is already up, and closing the panel closes the lightbox with it and
                 gives the visitor back the page. Nothing the lightbox is made of -- the veil, the
                 held frame loop, the inert page, <html data-lightbox> -- is torn down and raised
                 again in between, which is what "zero jitter" asks for: the one box is renamed
                 rather than dropped.

     Pressing the logo never navigates. The threshold is the home icon in the near orbit, which is
     what issue #54 asks for, and it is also what lets the logo be a <details> summary -- so the
     disclosure, the keyboard handling and the no-script fallback are the browser's own. */

  // The three controls the fixed files pin over the page, every one of which the constellation
  // adopts (issue #64): nothing of this site's floats at an edge of the viewport but the logo and
  // the persona, so each of these is hidden where its own file put it and offered as an option
  // instead. Named here, and nowhere else in the site's own files: the shell may find them, hide
  // them, press them and -- for the state menu, which asks to be hosted rather than opened where
  // it was pinned (see stateModal below) -- borrow the panel one of them built, and nothing may
  // restyle them or reproduce their words.
  var CORNER_COOKIES = '.site-consent-link'; // js/analytics.js draws it, bottom-left
  var CORNER_STATE = '.site-meta-open'; // js/state.js draws it, bottom-right
  var CORNER_STEER = '.site-steer'; // js/participate.js draws it, bottom-centre
  var STATE_PANEL = 'site-meta-panel'; // and the panel that button opens, which it names

  var STAR_STEP = 56; // the drop from one star to the next, in CSS pixels
  var STAR_STEP_MIN = 48; // never closer than this, or two chips would touch
  var STAR_EDGE = 14; // how far the first column sits from the logo's left edge
  var STAR_COLUMN = 208; // the least a column may advance, before any chip has been measured
  var STAR_GUTTER = 24; // the clear space between one column of chips and the next
  var STAR_SPREAD = 26; // how far out sideways a star may be pushed by its place in the order
  // How far each star is pushed, by its place in the order: an irregular walk rather than a zigzag,
  // so a constellation looks scattered however many stars are in it.
  var STAR_SCATTER = [0, 0.78, 0.26, 1.12, 0.52, 1.3, 0.12, 0.94, 0.66, 1.18];
  var TWO_COLUMN_WIDTH = 600; // the narrowest viewport that gets a column per orbit

  var nav = null;
  var navBox = null; // the shared lightbox, raised on every press of the logo

  /* ---- where the stars go ----------------------------------------------------------------- */

  function shownOptions(orbit) {
    var all = orbit.querySelectorAll('.sparknav-option');
    var shown = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].hidden) continue;
      var node = all[i].querySelector('.sparknav-node');
      shown.push({
        element: all[i],
        width: node ? node.offsetWidth : 0,
        height: (node && node.offsetHeight) || STAR_STEP_MIN
      });
    }
    return shown;
  }

  // One star: the chip at (x, y), and the ray from the logo's heart to the middle of its left edge.
  function star(option, x, y, mid, order) {
    var middle = y + option.height / 2;
    var dx = x - mid;
    var dy = middle - mid;
    var style = option.element.style;
    style.setProperty('--x', Math.round(x) + 'px');
    style.setProperty('--y', Math.round(y) + 'px');
    style.setProperty('--mx', mid + 'px');
    style.setProperty('--my', mid + 'px');
    style.setProperty('--len', Math.round(Math.sqrt(dx * dx + dy * dy)) + 'px');
    style.setProperty('--a', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg');
    style.setProperty('--k', String(order));
    // Where the chip starts from when it branches out: most of the way back to the logo.
    style.setProperty('--fx', Math.round(-dx * 0.55) + 'px');
    style.setProperty('--fy', Math.round(-dy * 0.55) + 'px');
    // The way the chip's edge runs: out along its ray, away from the logo's heart, so a slice that
    // cuts the chip -- reached by the keyboard, set, unset -- travels the way the chip itself
    // branched out (README: "Motion axiom", the cut). A pointer still brings its own angle in.
    style.setProperty('--cut-angle', angleOf(dx, dy));
    // And a jitter of its own on top of its turn in the order (README: "Motion axiom"): the
    // motion engine rolls one for each star on every press, so the constellation is cast a little
    // differently every time; without the engine a star keeps to its turn and nothing more.
    style.setProperty('--jit', jitterFor(order) + 'ms');
  }

  // The motion engine's roll for the k-th star's delay, less the step the stylesheet already adds
  // for its place in the order: the stylesheet counts the steps, this is only the raggedness.
  function jitterFor(order) {
    var motion = window.interestingMotion;
    if (!motion || typeof motion.stagger !== 'function' || typeof motion.ms !== 'function') return 0;
    var step = motion.ms('stagger') || 0;
    return Math.max(-step, motion.stagger(order) - order * step);
  }

  // The widest chip of an orbit, or 0 while the constellation has never been open: a chip that is
  // not rendered has no width, and the constants below stand in until one has been.
  function widestIn(options) {
    var widest = 0;
    for (var i = 0; i < options.length; i++) {
      widest = Math.max(widest, options[i].width);
    }
    return widest;
  }

  function place() {
    // Nothing to place while the state interface has the lightbox: the constellation is not on
    // screen to be measured, and it is shaped again on the next press either way.
    if (!nav || nav.sky.hidden) return;
    // Measure the layout the stars will use, not a cascade left by a shorter viewport.
    if (html.getAttribute('data-nav') !== 'live') html.setAttribute('data-nav', 'live');
    var logoHeight = nav.logo.offsetHeight || STAR_STEP_MIN;
    var mid = Math.max(18, Math.round(logoHeight / 2));
    var groups = [];
    var widths = [];
    var tallest = 0;
    var counted = 0;
    for (var g = 0; g < nav.orbits.length; g++) {
      var shown = shownOptions(nav.orbits[g]);
      if (shown.length) {
        groups.push(shown);
        widths.push(widestIn(shown));
        for (var s = 0; s < shown.length; s++) tallest = Math.max(tallest, shown[s].height);
        counted += shown.length;
      }
    }
    if (!groups.length) return;
    var top = logoHeight + 8;
    // The viewport, read once: the same two figures decide the columns, the step and the fit.
    var viewportW = window.innerWidth || 1024;
    var viewportH = window.innerHeight || 700;
    var room = Math.max(120, viewportH - top - 60);
    var minStep = Math.max(STAR_STEP_MIN, tallest + 4);
    var wide = viewportW >= TWO_COLUMN_WIDTH;
    // A column per orbit as soon as the screen is wide enough for one -- and also when one column
    // would not fit the viewport, where the columns are the only thing that makes it fit.
    var columns = groups.length > 1 && (wide || room < counted * minStep) ? groups.length : 1;
    // Where each column starts: after the widest chip of the one before it, so a long label
    // ("go to the apocrypha desk") cannot land on top of the column beside it.
    var spread = Math.max.apply(null, STAR_SCATTER) * STAR_SPREAD;
    var lefts = [STAR_EDGE];
    for (g = 1; g < groups.length; g++) {
      lefts.push(lefts[g - 1]
        + Math.max(STAR_COLUMN, widths[g - 1] + spread + STAR_GUTTER));
    }
    // And one column after all, if the last of them would run off the right-hand edge.
    var last = groups.length - 1;
    if (columns > 1 && widths[last]
        && lefts[last] + spread + widths[last] + 16 > viewportW) {
      columns = 1;
    }
    // The longest column decides the step, so every orbit falls at the same rhythm.
    var longest = counted;
    if (columns > 1) {
      longest = 0;
      for (g = 0; g < groups.length; g++) longest = Math.max(longest, groups[g].length);
    }
    var step = longest > 1
      ? Math.max(minStep, Math.min(STAR_STEP, (room - tallest) / (longest - 1))) : STAR_STEP;
    var order = 0;
    var y = top;
    var deepest = top;
    for (g = 0; g < groups.length; g++) {
      var x0 = STAR_EDGE;
      if (columns > 1) {
        x0 = lefts[g];
        y = top + (g % 2) * step * 0.45; // the columns interleave rather than line up
      }
      for (var i = 0; i < groups[g].length; i++, order++) {
        star(groups[g][i], x0 + STAR_SCATTER[order % STAR_SCATTER.length] * STAR_SPREAD,
          y + i * step, mid, order);
        deepest = Math.max(deepest, y + i * step + groups[g][i].height);
      }
      if (columns === 1) y += groups[g].length * step; // the next orbit carries on below
    }
    // And if the lowest star would still be below the fold -- a very short viewport, or a very
    // long list of options -- the cascade is what fits: the stylesheet's other layout, a list
    // under the logo that scrolls, which is also what the markup is without a script at all.
    var fits = deepest + mid + 16 <= viewportH;
    html.setAttribute('data-nav', fits ? 'live' : 'cascade');
  }

  /* ---- the options that come and go -------------------------------------------------------- */

  // What the mood flow has read of this visitor, or null: the same test js/persona.js makes.
  function readingWorld() {
    var flow = window.threshold;
    if (!flow || typeof flow.reading !== 'function') return null;
    var read = flow.reading();
    if (!read || !read.orientation || !read.source || read.source === 'signals') return null;
    return read.orientation;
  }

  /* One of them, put away where its own file pinned it. The hidden attribute says what is meant,
     and the one inline declaration beside it is what makes it true: each of these files injects
     the styles for its own control, and a `display` of its own in an author stylesheet outranks
     the `display: none` the attribute leans on -- `.site-steer` sets `display: inline-flex`, so
     the attribute alone would leave it sitting on the bottom edge. Inline is the narrowest place
     to say it and the only one nothing can outrank; nothing else about how the control looks is
     touched, and it is left whole in every other way, which is what lets the constellation press
     it. */
  function putAway(control) {
    if (!control) return;
    control.hidden = true;
    if (control.style && control.style.setProperty) control.style.setProperty('display', 'none');
  }

  /* The three pinned affordances, adopted. Each one is put away where its own file pinned it and
     offered in the constellation instead, so there is still exactly one new-issue link, one
     cookies dialog and one state menu on the site -- and the option is only there while the
     control is, which is why a copy of the site with no measurement id (and so no consent banner)
     simply has no cookies option. The files behind them are never edited: the constellation
     presses what they drew. */
  function adopt() {
    nav.cookiesCorner = document.querySelector(CORNER_COOKIES);
    nav.stateCorner = document.querySelector(CORNER_STATE);
    nav.steerCorner = document.querySelector(CORNER_STEER);
    putAway(nav.cookiesCorner);
    putAway(nav.stateCorner);
    putAway(nav.steerCorner);
    nav.cookies.hidden = !nav.cookiesCorner;
    nav.state.hidden = !nav.stateCorner;
    nav.participate.hidden = !nav.steerCorner;
  }

  function shape() {
    if (!nav) return;
    // The stage's page name follows the address, including a piece waiting for a sky.
    var heading = document.getElementById('stage-world');
    var page = html.getAttribute('data-page');
    var world = readingWorld();
    if (world && world.world && nav.readingGo) {
      var here = heading ? heading.textContent === world.worldName : page === world.world;
      nav.readingGo.href = root + world.world;
      // On the world itself the option says where the visitor is, rather than offering them a
      // trip to where they already are.
      relabel(nav.readingLabel, here ? world.worldName : 'go to ' + world.worldName);
      // The whispered line under the suggestion: the reading it follows from, in the reading's
      // own words, so the option says why it is offered before it is pressed.
      if (nav.readingGloss) {
        relabel(nav.readingGloss, here ? 'where your reading led' : 'read as ' + world.name);
        nav.readingGloss.hidden = false;
      }
      if (here) nav.readingGo.setAttribute('aria-current', 'page');
      else nav.readingGo.removeAttribute('aria-current');
      nav.reading.hidden = false;
    } else if (nav.reading) {
      nav.reading.hidden = true;
    }
    adopt();
    var destinations = nav.sky.querySelectorAll('a[href]');
    for (var i = 0; i < destinations.length; i++) {
      var destination = destinations[i];
      if (destination === nav.readingGo) continue;
      var label = destination.querySelector('.sparknav-label');
      var current = heading && label ? label.textContent === heading.textContent
        : destination.getAttribute('href') === root + page;
      if (current) destination.setAttribute('aria-current', 'page');
      else destination.removeAttribute('aria-current');
    }
    // How much of the visitor's own there is to carry away, which is the one thing about the state
    // worth saying before it is opened.
    if (nav.stateLabel) {
      var kept = store && typeof store.keys === 'function' ? store.keys().length : 0;
      relabel(nav.stateLabel, kept ? 'state · ' + kept + ' kept' : 'state');
    }
    place();
    restoreNavFocus();
  }

  /* ---- opening and closing ---------------------------------------------------------------- */

  /* The constellation, out and away. Idempotent on purpose, because two things call it: the
     <details> element's own toggle event, and close() below -- a browser fires `toggle` in a task
     of its own, which is a moment too late for anything that has to happen before the next line
     runs. The lightbox is the shared one, so the veil, the inert page, the paused animations and
     the held frame loop are one call rather than four. */
  // A chip's words, revealed when they change while the constellation is on screen; written
  // plainly while it is away, where nobody is watching.
  function relabel(node, text) {
    if (!node || node.textContent === text) return;
    say(node, text, !nav.host.open);
  }

  function gcd(a, b) {
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  /* The order the chips develop in, cast afresh on every press: a stride through the set from a
     rolled start, one way or the other, so the constellation never comes out top to bottom twice
     running. --roll on each option is its turn, and the stylesheet counts the steps from it; a
     page with no engine, or a visitor who asked for less motion, keeps the plain order. */
  function deal() {
    var options = nav.sky.querySelectorAll('.sparknav-option');
    var shown = [];
    for (var i = 0; i < options.length; i++) if (!options[i].hidden) shown.push(options[i]);
    var n = shown.length;
    var start = 0;
    var stride = 1;
    if (n > 1 && engine() && !calm()) {
      var strides = [1, 2, 3, 5, 7];
      var fit = [];
      for (var s = 0; s < strides.length; s++) if (strides[s] < n && gcd(strides[s], n) === 1) fit.push(strides[s]);
      stride = fit[Math.floor(Math.random() * fit.length)] || 1;
      if (Math.random() < 0.5) stride = n - stride;
      start = Math.floor(Math.random() * n);
    }
    for (var k = 0; k < n; k++) {
      shown[k].style.setProperty('--roll', String((start + k * stride) % n));
    }
  }

  /* The constellation unmade (close below): each chip goes back toward the logo behind a slice
     pointing that way and the rays retract (.is-unmaking, _sass/_nav.scss), and only then does
     the <details> close. The lightbox, the inert page and aria-expanded are given back at once,
     before it, because the page behind has to be live for whatever the press was for. Without
     the engine, or for a visitor who asked for less motion, `then()` runs at once. */
  var unmaking = 0; // the clock on the unmaking under way, or 0

  function endUnmake() {
    if (!unmaking) return;
    if (typeof window.clearTimeout === 'function') window.clearTimeout(unmaking);
    unmaking = 0;
    nav.sky.classList.remove('is-unmaking');
    if (typeof nav.sky.removeAttribute === 'function') nav.sky.removeAttribute('inert');
  }

  function unmakeSky(then) {
    var count = 0;
    var options = nav.sky.querySelectorAll('.sparknav-option');
    for (var i = 0; i < options.length; i++) if (!options[i].hidden) count += 1;
    if (!count || !canUnmake(nav.sky)) {
      then();
      return;
    }
    endUnmake();
    // Each chip's leaving rolled anew for this close (--ease-unmake and --motion-unmake, which the
    // chip's cut.unmake reads), pointed back at the logo it branched from; the rings' and the
    // rays' leave is the stylesheet's own.
    var longest = 0;
    for (i = 0; i < options.length; i++) {
      if (options[i].hidden) continue;
      var node = typeof options[i].querySelector === 'function' ? options[i].querySelector('.sparknav-node') : null;
      if (!node) continue;
      aimAtLogo(node, options[i], 'leave', 0.72);
      longest = Math.max(longest, cutLeave(node));
    }
    // The rings go last (cast-ring-out, _sass/_nav.scss): as long as the longest leaving rolled
    // above and the last chip's turn in the order, so no chip is left after the circle it was cast
    // in has gone.
    if (nav.host.style && typeof nav.host.style.setProperty === 'function') {
      var rings = Math.max(riteMs('medium', 340), longest) + Math.ceil(count / 2) * riteMs('stagger', 44);
      nav.host.style.setProperty('--motion-cast-ring-out', rings + 'ms');
      nav.host.style.setProperty('--motion-cast-ring-dashed-out', Math.round(rings * 0.92) + 'ms');
    }
    nav.sky.classList.add('is-unmaking');
    // Out of reach while it goes: a chip being unmade is not in the tab order or the tree a
    // reader walks, as it is already out from under the pointer.
    if (typeof nav.sky.setAttribute === 'function') nav.sky.setAttribute('inert', '');
    // The <details> closes only when the last chip, the last ray and the rings have gone: the
    // longest leaving the engine rolled (or the stylesheet's own length), the last chip's turn in
    // the order, and a little.
    unmaking = window.setTimeout(function () {
      unmaking = 0;
      nav.sky.classList.remove('is-unmaking');
      if (typeof nav.sky.removeAttribute === 'function') nav.sky.removeAttribute('inert');
      then();
    }, Math.max(riteMs('medium', 340), longest) + Math.ceil(count / 2) * riteMs('stagger', 44) + 80);
  }

  /* A chip's own way, said by the shell rather than rolled: a star branches out of the logo and
     goes back into it (--fx/--fy, star() above), so what the engine writes for its arrival or its
     leaving (m.arrive, cutLeave) is pointed that way -- its --arrive-x/-y, the step back toward
     the logo it starts from, or its --leave-x/-y, the step toward the logo it goes by -- and the
     slice it moves behind points the way it travels along its ray (--arrive-angle out of the
     logo, --leave-angle back into it). The treads and the length stay the engine's roll. */
  function aimAtLogo(node, option, way, by) {
    if (!option.style || typeof option.style.getPropertyValue !== 'function'
        || !node.style || typeof node.style.setProperty !== 'function') return;
    var fx = parseFloat(option.style.getPropertyValue('--fx'));
    var fy = parseFloat(option.style.getPropertyValue('--fy'));
    if (!isFinite(fx) || !isFinite(fy)) return;
    node.style.setProperty('--' + way + '-x', Math.round(fx * by) + 'px');
    node.style.setProperty('--' + way + '-y', Math.round(fy * by) + 'px');
    if (fx || fy) {
      node.style.setProperty('--' + way + '-angle', way === 'arrive' ? angleOf(-fx, -fy) : angleOf(fx, fy));
    }
  }

  /* Each chip's arrival rolled anew on every press (m.arrive: --ease-develop and --motion-develop,
     read by the chip's cut.develop under .is-branching): its own treads and length, and the way
     out of the logo as its direction. Without the engine the stylesheet's baked stair plays, from
     the same place. */
  function cast() {
    var options = nav.sky.querySelectorAll('.sparknav-option');
    for (var i = 0; i < options.length; i++) {
      if (options[i].hidden) continue;
      var node = typeof options[i].querySelector === 'function' ? options[i].querySelector('.sparknav-node') : null;
      if (!node || !cutArrival(node)) continue;
      aimAtLogo(node, options[i], 'arrive', 1);
    }
  }

  /* ---- the visitor's own sky, behind the options -------------------------------------------- */

  /* What there is to discover in the space between the options: the stars a visitor has placed
     in their persona rest faintly behind the constellation while it is up, joined by the same
     hairline threads the persona draws between neighbours -- so pressing the logo opens the menu
     inside their own sky, and a sky changed in the sheet is the sky the next press opens onto.
     Decoration and nothing more: under no pointer, hidden from a screen reader, below every ray
     and chip (_sass/_nav.scss), and a visitor with no stars yet keeps the plain dark. Guarded
     throughout and wrapped whole: a browser without the persona, or without the DOM to draw in,
     simply has no motes and the constellation is exactly what it was.

     The sky is cast out of the logo, as the constellation is. Each mote comes out when the cast
     reaches it -- later the farther it is from the logo's heart (--d), so the last of them comes
     out DUST_SPREAD after the first -- and each thread is drawn out of the nearer of its two stars,
     toward the farther, once that star has landed. Each star keeps a size of its own (--ms), worked
     out from where it is, so a visitor's sky is the same sky on every press. */
  var DUST_SPREAD = 720; // ms, from the logo's heart to the farthest corner of the viewport

  function castDust() {
    try {
      if (!nav || !nav.sky) return;
      if (!nav.dust) {
        if (typeof document.createElement !== 'function' || typeof nav.sky.appendChild !== 'function') return;
        nav.dust = el('div', 'sparknav-dust');
        nav.dust.setAttribute('aria-hidden', 'true');
        nav.sky.appendChild(nav.dust);
      }
      nav.dust.textContent = '';
      var stars = persona && typeof persona.stars === 'function' ? persona.stars() : null;
      if (!stars || !stars.length) return;
      var vw = window.innerWidth || 1024;
      var vh = window.innerHeight || 700;
      // The logo's heart, read once for the whole cast; a page that cannot say where it is casts
      // from the corner the logo sits in.
      var hx = 0;
      var hy = 0;
      if (nav.logo && typeof nav.logo.getBoundingClientRect === 'function') {
        var mark = nav.logo.getBoundingClientRect();
        if (mark && (mark.width || mark.height)) {
          hx = mark.left + mark.width / 2;
          hy = mark.top + mark.height / 2;
        }
      }
      var far = Math.max(Math.sqrt(hx * hx + hy * hy), Math.sqrt((vw - hx) * (vw - hx) + hy * hy),
        Math.sqrt(hx * hx + (vh - hy) * (vh - hy)), Math.sqrt((vw - hx) * (vw - hx) + (vh - hy) * (vh - hy))) || 1;
      var points = [];
      for (var i = 0; i < stars.length && points.length < 28; i++) {
        var s = stars[i];
        if (!s || typeof s.x !== 'number' || !isFinite(s.x) || typeof s.y !== 'number' || !isFinite(s.y)) continue;
        var px = Math.min(98, Math.max(2, s.x)) / 100 * vw;
        var py = Math.min(96, Math.max(4, s.y)) / 100 * vh;
        var size = Math.sin(s.x * 12.9898 + s.y * 78.233) * 43758.5453;
        points.push({
          x: px,
          y: py,
          d: Math.round(Math.min(1, Math.sqrt((px - hx) * (px - hx) + (py - hy) * (py - hy)) / far) * DUST_SPREAD),
          ms: 0.7 + (size - Math.floor(size)) * 0.8
        });
      }
      var landed = riteMs('medium', 320); // a mote's landing (mote-in), before a thread leaves it
      // Each star reaches a thread toward its nearest neighbour, once per pair and only nearby,
      // which is what makes a scatter of motes read as the visitor's constellation.
      var reach = Math.min(vw, vh) * 0.36;
      var paired = {};
      for (i = 0; i < points.length; i++) {
        var near = -1;
        var best = reach * reach;
        for (var j = 0; j < points.length; j++) {
          if (i === j) continue;
          var dx = points[j].x - points[i].x;
          var dy = points[j].y - points[i].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; near = j; }
        }
        if (near === -1) continue;
        var key = Math.min(i, near) + ':' + Math.max(i, near);
        if (paired[key]) continue;
        paired[key] = true;
        var from = points[i].d <= points[near].d ? points[i] : points[near];
        var to = from === points[i] ? points[near] : points[i];
        var thread = el('span', 'sparknav-thread');
        thread.style.setProperty('--sx', from.x.toFixed(1) + 'px');
        thread.style.setProperty('--sy', from.y.toFixed(1) + 'px');
        thread.style.setProperty('--tlen', Math.round(Math.sqrt(best)) + 'px');
        thread.style.setProperty('--ta', (Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI).toFixed(2) + 'deg');
        thread.style.setProperty('--d', (from.d + landed) + 'ms');
        nav.dust.appendChild(thread);
      }
      for (i = 0; i < points.length; i++) {
        var mote = el('span', 'sparknav-mote');
        mote.style.setProperty('--sx', points[i].x.toFixed(1) + 'px');
        mote.style.setProperty('--sy', points[i].y.toFixed(1) + 'px');
        mote.style.setProperty('--d', points[i].d + 'ms');
        mote.style.setProperty('--ms', points[i].ms.toFixed(2));
        nav.dust.appendChild(mote);
      }
    } catch (e) {
      /* a browser without the room to draw a sky keeps the plain constellation */
    }
  }

  function branch(on) {
    nav.logo.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) {
      endUnmake(); // pressed again before the last close had finished: cast afresh
      shape();
      deal();
      cast();
      castDust();
      navBox.up(null, nav.logo); // the veil rises from the logo that was pressed
      // The branch starts over on every press: a browser that keeps a closed <details> rendered
      // would otherwise have run the animation once and left it there.
      nav.sky.classList.remove('is-branching');
      void nav.sky.offsetWidth;
      nav.sky.classList.add('is-branching');
    } else {
      // Whatever the lightbox was holding goes with it: the state interface back to its corner,
      // the constellation back on screen for the next press, and then the one box itself.
      stateModal(false);
      navBox.down();
      nav.sky.classList.remove('is-branching');
      if (!nav.host.open) endUnmake(); // closed by the browser itself: nothing left to unmake
    }
  }

  /* Closing it, and giving the page straight back: the <details> closes, and the lightbox comes
     down now rather than in the task the toggle event is queued in -- an adopted dialog opening
     on the next line has to find the page live, not inert. */
  function close(focusLogo) {
    // Only a constellation that is on screen is unmade: the state interface's close has nothing
    // of the sky to show, and a browser without the engine closes at once.
    var skyShown = nav.host.open && !nav.sky.hidden;
    branch(false);
    if (skyShown) {
      unmakeSky(function () {
        if (nav.host.open) nav.host.open = false;
      });
    } else if (nav.host.open) {
      nav.host.open = false;
    }
    if (focusLogo && typeof nav.logo.focus === 'function') nav.logo.focus();
  }

  /* ---- the state interface, taking the lightbox over -------------------------------------- */

  /* "state" is the one option in the constellation that is neither a destination nor somebody
     else's dialog: it is a thing to do, and issue #66 asks for it to have the screen while it is
     being done. So the lightbox stays exactly as it is -- veil up, page inert and still, frame
     loop held -- the constellation gives way, and js/state.js's own panel is moved into the middle
     of it. There is no way back to the constellation: closing the panel closes the lightbox, which
     is what "return to the site" means.

     The panel is the fixed file's, and asking for it is all that happens here (see "Presented
     somewhere else" in js/state.js). A store too old to offer one, or a shell written without the
     host to put it in, falls back to what the constellation did before: get out of the way and
     press the corner button -- which is what stateModal(true) saying false means. Taking it down
     tidies up either way, because an empty host left on screen is an invisible layer over the
     page. */
  var stateHosted = null; // the function that gives the panel back, while it is being hosted
  var stateSeen = null; // where the hosted panel was last seen standing, for its ghost

  function hostedStateMenu() {
    var menu = store && store.menu;
    return menu && typeof menu.present === 'function' ? menu : null;
  }

  /* Where the hosted panel stands, read while it is on screen (standing, above): once its arrival
     has landed, and again at every press and every key that can close it (Escape, or Enter and
     Space on its buttons) while it is up, before the press or the key reaches the panel. The
     store hides its panel before the shell hears that it closed, so the last of these is where
     the panel's ghost is left -- where the visitor last saw it, and never the step it arrived
     from. */
  function seeState() {
    if (!stateHosted) return;
    var menu = hostedStateMenu();
    if (!menu || !menu.panel || menu.panel.hidden) return;
    stateSeen = standing(menu.panel) || stateSeen;
  }

  function stateModal(on) {
    if (on) {
      var menu = hostedStateMenu();
      if (!nav.modal || !menu) return false;
      // The host is on screen before the panel arrives in it, because nothing inside a hidden box
      // can take the focus and the panel puts the focus in its own text as it opens. It develops
      // where the constellation was, in treads rolled for this taking-over (m.arrive: its
      // direction and --ease-develop, which .sparknav-modal's cut.develop reads).
      cutArrival(nav.modal);
      nav.modal.hidden = false;
      var release = menu.present(nav.modal);
      if (!release) {
        nav.modal.hidden = true;
        return false;
      }
      stateHosted = release;
      // Where the panel stands is read once it has landed and at each press or key (seeState),
      // never now, while its arrival is still a step away from where it will stand.
      stateSeen = null;
      // The same box, renamed where it stands: <html data-lightbox> goes from 'nav' straight to
      // 'state' without ever being removed, so every rule keyed on the lightbox being up stays
      // matched through the swap and nothing behind the veil so much as blinks.
      navBox.up('state');
      nav.sky.hidden = true;
      nav.sky.classList.remove('is-branching');
      whenThePanelCloses(menu.panel, function () {
        // However it closed -- its own "close", Escape, a press on the dimmed page around it --
        // the lightbox goes down with it and the visitor is back where they were.
        if (stateHosted) close(true);
      });
      return true;
    }
    if (stateHosted) {
      var giveItBack = stateHosted;
      stateHosted = null; // first, so the watcher above knows this close is not a visitor's
      // What the panel showed is unmade as a ghost of itself where it stood (the panel is the
      // store's and goes at once), going toward the logo, which is where the focus goes home;
      // nothing to ghost if it has already gone.
      var shown = hostedStateMenu();
      if (shown && shown.panel) ghostOf(shown.panel, stateSeen, nav.logo);
      stateSeen = null;
      giveItBack();
    }
    // Put away whether anything was being hosted or not: an empty host left on screen would be an
    // invisible layer over the page, swallowing every press on it.
    if (nav.modal) nav.modal.hidden = true;
    nav.sky.hidden = false;
  }

  /* The state interface closes itself, in all the ways a dialog can be closed, and hands the focus
     back to its own button -- the one the shell has hidden, where a keyboard would land nowhere.
     So the shell watches the panel's `hidden` attribute and answers for the closing. Nothing of
     the menu is touched to arrange it; this only watches. */
  function whenThePanelCloses(panel, then) {
    if (!panel || !window.MutationObserver) return;
    var watch = new MutationObserver(function () {
      if (!panel.hidden) return;
      watch.disconnect();
      then();
    });
    watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  }

  function navIsFront() {
    var top = raised.length ? raised[raised.length - 1] : null;
    return !!(nav && nav.host.open && !asking && top && top.keep === nav.host);
  }

  function visibleInNav(node) {
    if (!node || !(node.offsetWidth || node.offsetHeight)) return false;
    for (var parent = node; parent && parent !== nav.host; parent = parent.parentNode) {
      if (parent === document.body || parent.hidden || parent.hasAttribute('inert')
          || parent.getAttribute('aria-hidden') === 'true') return false;
    }
    return parent === nav.host;
  }

  // An option can disappear, and an adopted control can return focus to its hidden button.
  function restoreNavFocus() {
    if (!navIsFront() || visibleInNav(document.activeElement)) return;
    // A closing state panel returns focus through its close watcher instead.
    var menu = stateHosted ? hostedStateMenu() : null;
    if (menu && menu.panel && menu.panel.hidden) return;
    nav.logo.focus();
  }

  // The chips, the logo included, in the order a Tab walks them -- and the state interface's own
  // controls while it is the thing the lightbox is holding, its text box included, because a
  // keyboard trapped in a modal has to be able to reach all of it.
  function navFocusable() {
    var all = nav.host.querySelectorAll(
      'summary, a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
    var reachable = [];
    for (var i = 0; i < all.length; i++) {
      var tab = all[i].getAttribute('tabindex');
      if (all[i].disabled || (tab !== null && Number(tab) < 0)) continue;
      if (visibleInNav(all[i])) reachable.push(all[i]);
    }
    return reachable;
  }

  function keepFocusInside(event) {
    if (event.key !== 'Tab') return;
    var stars = navFocusable();
    if (!stars.length) return;
    var first = stars[0];
    var last = stars[stars.length - 1];
    if (stars.indexOf(document.activeElement) === -1) {
      (event.shiftKey ? last : first).focus();
      event.preventDefault();
    } else if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function buildNav() {
    var host = document.getElementById('sparknav');
    if (!host) return;
    nav = {
      host: host,
      logo: document.getElementById('sparknav-logo'),
      sky: host.querySelector('.sparknav-sky'),
      orbits: host.querySelectorAll('.sparknav-orbit'),
      reading: document.getElementById('sparknav-reading'),
      readingGo: document.getElementById('sparknav-reading-go'),
      readingLabel: document.getElementById('sparknav-reading-label'),
      readingGloss: document.getElementById('sparknav-reading-gloss'),
      participate: document.getElementById('sparknav-participate'),
      participateOpen: document.getElementById('sparknav-participate-open'),
      cookies: document.getElementById('sparknav-cookies'),
      cookiesOpen: document.getElementById('sparknav-cookies-open'),
      state: document.getElementById('sparknav-state'),
      stateOpen: document.getElementById('sparknav-state-open'),
      stateLabel: document.getElementById('sparknav-state-label'),
      // Where the state interface is hosted, in the middle of the lightbox. Not required: a shell
      // written without it still has the corner menu to fall back on.
      modal: document.getElementById('sparknav-modal')
    };
    if (!nav.logo || !nav.sky || !nav.orbits.length
        || !nav.participateOpen || !nav.cookiesOpen || !nav.stateOpen) {
      nav = null;
      return;
    }

    // The one lightbox the site shares, with the constellation as the thing it leaves in front of
    // the veil. The persona sheet and the shared question open through the same component, which is
    // what makes the three of them the same effect (issue #70).
    navBox = lightbox({
      name: 'nav',
      keep: nav.host,
      // A press on the veil is a press on the page behind it, which is a way of saying "not this".
      onPress: function () { close(true); }
    });

    nav.host.addEventListener('toggle', function () {
      branch(nav.host.open);
    });

    // The state interface's host has landed: where the panel stands now is where it stays.
    if (nav.modal && typeof nav.modal.addEventListener === 'function') {
      nav.modal.addEventListener('animationend', function (ev) {
        if (ev && ev.target === nav.modal) seeState();
      });
    }

    // Opening is the browser's own disclosure. Closing by the logo goes through close(), so the
    // constellation is unmade before the <details> closes rather than cut by it; pressed again
    // while it is still being unmade, the constellation is cast afresh.
    nav.logo.addEventListener('click', function (event) {
      if (!nav.host.open) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (unmaking) {
        endUnmake();
        nav.host.open = false;
        void nav.host.offsetWidth; // a style pass with [open] gone, so the rings and the spark restart
        nav.host.open = true;
        return;
      }
      close(false);
    });
    nav.logo.setAttribute('aria-expanded', nav.host.open ? 'true' : 'false');

    // A destination closes the menu on its way out, so a link to the page the visitor is already
    // on does not leave the constellation hanging open over it.
    nav.sky.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== nav.sky && node.tagName !== 'A') node = node.parentNode;
      if (node && node.tagName === 'A') close(false);
    });

    nav.cookiesOpen.addEventListener('click', function () {
      // The constellation gets out of the way first, and the focus goes to the logo rather than
      // to the chip it is taking with it: this dialog is the consent library's own, drawn where
      // its own file draws it, and that library hands the focus back to whatever had it when the
      // dialog opened. ("state" is the other way about -- see stateModal above -- because it is
      // this site's own interface rather than a vendored library's.)
      close(true);
      if (nav.cookiesCorner) nav.cookiesCorner.click();
    });

    nav.stateOpen.addEventListener('click', function () {
      function corner() {
        // Nothing to host it with, so the corner menu, as it was before: out of the way first,
        // because a panel pinned to a live page has to find the page live.
        close(true);
        if (!nav.stateCorner) return;
        nav.stateCorner.click();
        // Watched after the press, not before it: a store may only build its panel on the first
        // press, and a panel looked up before then is nothing -- the focus would never come home.
        whenThePanelCloses(document.getElementById(STATE_PANEL), function () {
          if (typeof nav.logo.focus === 'function') nav.logo.focus();
        });
      }
      // The lightbox is not dropped and raised again: it stays up, the constellation is unmade
      // (never taken away at once), and the state interface takes its place inside it (issue #66).
      if (hostedStateMenu() && nav.modal) {
        unmakeSky(function () {
          if (!stateModal(true)) corner();
        });
        return;
      }
      corner();
    });

    // A press on the dimmed page around the state interface is a press on the page: the same
    // "not this" the veil takes, which the host covers while it is up.
    if (nav.modal) {
      nav.modal.addEventListener('click', function (event) {
        if (event.target === nav.modal) close(true);
      });
    }

    /* The invitation, which is a link rather than a dialog: the constellation gets out of the way
       and then presses the one js/participate.js drew, so the destination, the new tab and the
       query that shapes the issue are all still that file's and nothing of them is reproduced
       here. The press carries the visitor's own activation with it, which is what lets the new tab
       open. */
    nav.participateOpen.addEventListener('click', function () {
      close(true);
      if (nav.steerCorner) nav.steerCorner.click();
    });

    document.addEventListener('keydown', function (event) {
      // A nested lightbox owns its keyboard until it hands the constellation back.
      if (!navIsFront()) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        close(true);
        return;
      }
      keepFocusInside(event);
    });
    document.addEventListener('focusin', restoreNavFocus);

    // The options follow the reading and adopted controls; page markers follow the stage too.
    window.addEventListener('threshold:reading', shape);
    window.addEventListener('persona:sky', shape);
    window.addEventListener('stage:open', shape);
    window.addEventListener('stage:home', shape);
    window.addEventListener('resize', place);
    watchForCorners();
    shape();
  }

  /* Deferred controls can arrive, be replaced or disappear for as long as the page stays open.
     Keep watching their presence, not a deadline: a late consent control still belongs in the
     constellation, and an option must disappear when the control it presses does. */
  function watchForCorners() {
    if (!window.MutationObserver || !document.body) return;
    var watch = new MutationObserver(function () {
      // Every page of this site mutates while it is read -- the feed deals cards without end --
      // so the work only happens when one of the three has actually come or gone.
      if (document.querySelector(CORNER_COOKIES) === nav.cookiesCorner
          && document.querySelector(CORNER_STATE) === nav.stateCorner
          && document.querySelector(CORNER_STEER) === nav.steerCorner) return;
      shape();
      // What to do about one of them drawn while a lightbox is up -- put it behind the veil -- is
      // the lightbox's own business, and watchTheBody above is where it is done.
    });
    watch.observe(document.body, { childList: true, subtree: true });
  }

  /* The persona's difficulty slider, wherever a part depends on it. The persona owns the setting
     and draws the control (js/persona.js); this is the shell offering it under the name a part
     already reaches for, beside unlock(). Unlike unlock() there is nothing to power down -- the
     setting always holds a value -- so this only renders, and hands back the release. */
  function difficulty(host, options) {
    if (!persona || typeof persona.tuner !== 'function') return function () {};
    return persona.tuner(host, options);
  }

  window.interestingSite = {
    unlock: unlock,
    unmake: unmake,
    difficulty: difficulty,
    destructive: destructive,
    areYouSure: areYouSure,
    lightbox: lightbox,
    seedSky: seedSky,
    holdsSky: holdsSky,
    root: root,
    skyKey: SKY,
    difficultyKey: 'difficulty'
  };

  // The skip link's words are revealed as it drops in, every time a keyboard reaches it.
  function watchTheSkipLink() {
    document.addEventListener('focusin', function (ev) {
      var target = ev && ev.target;
      if (target && target.classList && target.classList.contains('skip-link')) say(target);
    });
  }

  function start() {
    retireOldKeys();
    // Where a press lands, so the veil knows which control raised it (riseFrom, above), and that a
    // key has been pressed since: one cheap note per press or key, read only when a lightbox goes
    // up. The same moment is when a hosted state panel is last seen, before the press reaches it.
    document.addEventListener('pointerdown', notePress, { capture: true, passive: true });
    document.addEventListener('keydown', noteKey, { capture: true, passive: true });
    watchTheVeil();
    buildNav();
    watchRanges();
    watchTheSkipLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
