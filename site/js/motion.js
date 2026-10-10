/*
  The motion of the rite (README: "Motion axiom"). Nothing on this site fades, glides or moves
  along a standard curve. No transition and no animation is eased by `linear`, by `ease` and its
  three siblings, or by any cubic-bezier, and nothing in a script tweens along a polynomial it
  wrote itself. Every movement is a stair: a few treads, always forward, rolled for that movement.

  The cut. A surface that changes does not fade: it changes by its area, along ONE clean edge
  chosen for a reason -- a slice (a straight edge at an angle) or a curve (a circle round a
  point) -- that steps across it in treads. A hover is a slice coming in from the side the pointer
  came from; a press is a curve growing from where the press landed; a set control rests as two
  shades split by a curve round its press point; an arrival is a slice from the side it arrives
  from, a leaving one toward where it goes; words are revealed by a slice at the register's slant.
  Nothing is a pattern, a noise, a scatter or a dither, and nothing slips back, stutters or
  overshoots: every choice is a clear one, made for a specific reason, and costs the browser one
  gradient (README: "Motion axiom", the cut).

  How it reaches the stylesheets. CSS cannot roll a die, but it can read a custom property, and
  `linear()` can express any stair at all. So this file writes the curves as custom properties --
  on :root once as the page loads (and again when the site changes its mood), and on an element
  for each movement it starts -- and _sass/_tokens.scss bakes a stair for every one of them, so a
  page with no script still moves in treads:

      --ease-arrive, --ease-leave, --ease-shift, --ease-flicker, --ease-pulse, --ease-drift,
      --ease-wipe, --ease-stair, --ease-ratchet
                        the families: arrive lands in shrinking treads, leave goes in growing
                        ones, stair holds and then steps evenly, flicker is one quick step, the
                        ratchet clicks evenly round, pulse and drift are the slow stairs of a loop
      --ease-<spell>    one per @keyframes name, cut from its family, so each plays its own stair
      --motion-short, --motion-medium, --motion-long, --motion-slow, --motion-stagger,
      --motion-shift, --motion-turn
                        the durations, rolled with a little jitter and scaled by the tempo
      --motion-<spell>  one length per @keyframes name, rolled beside its curve
      --arrive-x, --arrive-y, --arrive-angle, --leave-x, --leave-y, --leave-angle
                        where arriving content comes from, where leaving content goes, and the
                        angle of the slice each one moves behind (the direction of travel)
      --wipe-from, --wipe-to, --state-from, --sky-x, --sky-y, --lift-y, --spark-extra, --shake-x,
      --ray-from, ...   the small particulars of one movement each, named where they are used

  Per movement, on the element: --ease-<rite> and --motion-<rite> (its treads and its length) and
  the shape's own parameters -- --cut-angle for a slice, --cut-x and --cut-y for a curve,
  --seal-x and --seal-y where a set control's curve sits. The edge itself moves by --cut, a
  registered percentage the keyframes cut-in and cut-out step from 0% to 100% (_sass/_cut.scss).

  How a control changes. A control under the pointer or the focus waxes (is-waxing) and wanes when
  they leave (is-waning); a press stamps it (is-stamping); one that becomes set is sealed
  (is-sealing) and one unset is unsealed (is-unsealing). This file puts the classes on, reading the
  pointer, the keyboard, the focus and every attribute a control is set by, writes that trigger's
  composition on the element, and takes each passing class off again when its animation ends;
  _sass/_controls.scss says what each looks like.

  How it reaches the scripts. window.interestingMotion is the same roll offered as functions:

      var m = window.interestingMotion;
      m.ease('arrive')            // a function t -> y: a stair rolled for this call alone
      m.curve('leave')            // { css, stops, at(t) }: the stair as CSS and as arithmetic
      m.tween({ ms, family, step(y, t), done, treads })
      m.stepper({ ms, treads, step(k, n), done })
      m.scrollTo(top) / m.scrollIntoView(el, { block: 'center' })
      m.ms('long') / m.stagger(k) / m.geometry()
      m.cut(el, rite, { family, base, angle, x, y, treads })
                                  // one movement's composition written on el; hands back its ms
      m.reveal(el)                // the words of el revealed by one slice, a tread per word
      m.flip(list, change)        // run change(); every child that moved jumps there in treads
      m.rite(el, 'stamping')      // one passing rite on el, by the name of its class is-<name>
      m.wax(el) / m.wane(el) / m.seal(el)
      m.arrive(el, { seed, spell, className })
                                  // where el arrives from, its slice and its stair, written on it
      m.deal(el, { spells })      // pin the page's roll on el while it waits in its delay
      m.shift() / m.roll()        // the site changed its mood / roll the page again now
      m.reduced                   // true for a visitor who asked for less motion

  What it costs. The page's roll is written once, before the body is drawn. After that nothing is
  written on :root until the site changes its mood: a movement's composition is written on the
  element that makes it (a style recalculation of that element alone), and a spell that ends is
  rolled afresh on the element that played it, so its next play differs. No interval, no frame
  loop, no stylesheet written at run time, no image generated, no element wrapped around a letter.

  The temperament. Each mood of _sass/_mood.scss carries a temperament beside its palette and its
  typographic register: --motion-tempo, how long its movements take, and --motion-steps, whether
  its stairs take a tread more. Its register (_sass/_type.scss) carries the angle its slices cut
  at (--cut-angle) and the slant its words are revealed at (--reveal-angle).

  Less motion asked for. The stylesheets answer prefers-reduced-motion themselves, and this file
  does the same for the movements it makes: a tween lands on its end at once, a scroll jumps, a
  reveal shows the words, and no rite is written.

  A browser without linear() gets steps(n) -- a stair of the same number of treads.

  Nothing here reaches for the browser's storage, keeps score, or writes to the shared state
  document. It is loaded by _includes/layout.njk without `defer`, so it has rolled before the body
  is drawn and before any other script asks it for a curve. It touches nothing a stub browser
  lacks without asking first, and every caller treats window.interestingMotion as optional.
*/
(function (global) {
  'use strict';

  /* ---- the browser's own frame ----------------------------------------------------------- */

  // Taken when the engine loads. The shell holds the page's frames while a lightbox is up
  // (js/site.js puts a holding requestAnimationFrame in the window's place to still the pieces
  // behind the sheet), and the engine's own frames -- the passing classes, the stepper, the tween
  // -- must not be held with them, or nothing inside a lightbox would ever arrive.
  var nativeFrame = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
  function frameOf() {
    if (nativeFrame) return function (fn) { return nativeFrame.call(global, fn); };
    return typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
  }

  /* ---- a seeded stream ------------------------------------------------------------------- */

  // mulberry32, the same small generator js/variant.js deals cards with.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function entropy() {
    var now = typeof Date !== 'undefined' ? Date.now() : 0;
    return ((Math.random() * 0x7fffffff) ^ (now & 0x7fffffff)) >>> 0;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---- the temperament ------------------------------------------------------------------- */

  var DEFAULT_TEMPER = { grain: 0.45, tempo: 1, steps: 0 };

  function readTemper(doc, el) {
    var temper = { grain: DEFAULT_TEMPER.grain, tempo: DEFAULT_TEMPER.tempo, steps: DEFAULT_TEMPER.steps };
    if (!doc || typeof global.getComputedStyle !== 'function') return temper;
    var style;
    try {
      style = global.getComputedStyle(el || doc.documentElement);
    } catch (e) {
      return temper;
    }
    if (!style || typeof style.getPropertyValue !== 'function') return temper;
    var grain = parseFloat(style.getPropertyValue('--motion-grain'));
    var tempo = parseFloat(style.getPropertyValue('--motion-tempo'));
    var steps = parseFloat(style.getPropertyValue('--motion-steps'));
    if (isFinite(grain)) temper.grain = clamp(grain, 0, 1);
    if (isFinite(tempo)) temper.tempo = clamp(tempo, 0.4, 2.5);
    if (isFinite(steps)) temper.steps = clamp(steps, 0, 1);
    return temper;
  }

  /* ---- the stair ------------------------------------------------------------------------- */

  /* A curve is a list of stops, [t, y] with t from 0 to 1, rendered as linear() for the stylesheet
     and read as the value of the tread it is on for a script. Every curve here is a stair: it
     starts at (0, 0), holds, jumps to the next tread, holds, ... and lands on 1 a little before
     the end, so the last tread is seen. Two stops at one t are the jump. */

  function Curve(stops) {
    this.stops = stops;
  }

  Curve.prototype.at = function (t) {
    var s = this.stops;
    if (t <= 0) return s[0][1];
    if (t >= 1) return s[s.length - 1][1];
    var y = s[0][1];
    for (var i = 1; i < s.length; i++) {
      if (s[i][0] > t) break;
      y = s[i][1];
    }
    return y;
  };

  Curve.prototype.toCSS = function () {
    var parts = [];
    var s = this.stops;
    for (var i = 0; i < s.length; i++) {
      var y = Math.round(s[i][1] * 1000) / 1000;
      var t = Math.round(s[i][0] * 1000) / 10;
      parts.push(i === 0 || i === s.length - 1 ? String(y) : y + ' ' + t + '%');
    }
    return 'linear(' + parts.join(', ') + ')';
  };

  // A stair from its treads: `moments` are where each jump falls (rising, in (0, 1)) and `rises`
  // how far each one goes (positive, summing to 1).
  function stairOf(moments, rises) {
    var stops = [[0, 0]];
    var y = 0;
    for (var i = 0; i < moments.length; i++) {
      var t = clamp(moments[i], 0.001, 0.999);
      stops.push([t, y]);
      y = i === moments.length - 1 ? 1 : Math.min(1, y + rises[i]);
      stops.push([t, y]);
    }
    stops.push([1, 1]);
    return new Curve(stops);
  }

  function between(rnd, lo, hi) {
    return lo + (hi - lo) * rnd();
  }

  // Evenly spaced moments from `first` to `last`.
  function spaced(n, first, last) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(n === 1 ? last : first + (last - first) * (i / (n - 1)));
    return out;
  }

  function equal(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(1 / n);
    return out;
  }

  // Rises that shrink (or grow) by a ratio, normalized to 1.
  function geometric(n, ratio) {
    var out = [];
    var total = 0;
    for (var i = 0; i < n; i++) {
      var r = Math.pow(ratio, i);
      out.push(r);
      total += r;
    }
    for (var j = 0; j < n; j++) out[j] /= total;
    return out;
  }

  /* The families: each is one simple rule, and the roll decides the count and the spacing. A
     temperament that steps (--motion-steps) takes a tread more. */
  var FAMILIES = {
    // A thing landing: the first tread is the longest way, each after it shorter, each held longer.
    arrive: function (rnd, extra) {
      var n = 3 + Math.round(rnd()) + extra;
      var rises = geometric(n, between(rnd, 0.42, 0.62));
      var moments = [];
      var gap = between(rnd, 0.08, 0.16);
      var t = gap;
      for (var i = 0; i < n; i++) {
        moments.push(t);
        gap *= between(rnd, 1.25, 1.55);
        t += gap;
      }
      var scale = between(rnd, 0.82, 0.92) / moments[n - 1];
      for (var j = 0; j < n; j++) moments[j] *= scale;
      return stairOf(moments, rises);
    },
    // A thing going: a hold, then treads that grow and come quicker.
    leave: function (rnd, extra) {
      var n = 3 + Math.round(rnd()) + extra;
      var rises = geometric(n, between(rnd, 1.6, 2.3));
      var first = between(rnd, 0.2, 0.36);
      var moments = [first];
      var gap = (between(rnd, 0.86, 0.94) - first) * 0.45;
      for (var i = 1; i < n; i++) {
        moments.push(moments[i - 1] + gap);
        gap *= between(rnd, 0.5, 0.75);
      }
      return stairOf(moments, rises);
    },
    // A state changing where it stands: a hold, then even treads.
    stair: function (rnd, extra) {
      var n = 3 + Math.floor(rnd() * 3) + extra;
      return stairOf(spaced(n, between(rnd, 0.22, 0.38), between(rnd, 0.84, 0.94)), equal(n));
    },
    // A smaller change: two or three even treads.
    shift: function (rnd, extra) {
      var n = 2 + Math.round(rnd()) + extra;
      return stairOf(spaced(n, between(rnd, 0.2, 0.34), between(rnd, 0.7, 0.88)), equal(n));
    },
    // The quick one: a press, a blink on -- two treads, the first a little more than half.
    flicker: function (rnd) {
      var a = between(rnd, 0.55, 0.7);
      return stairOf([between(rnd, 0.18, 0.36), between(rnd, 0.6, 0.82)], [a, 1 - a]);
    },
    // A loop's beat: even treads, evenly spaced.
    pulse: function (rnd, extra) {
      var n = 3 + Math.floor(rnd() * 3) + extra;
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    },
    // The slow turn of a loop: many even treads.
    drift: function (rnd, extra) {
      var n = 6 + Math.floor(rnd() * 5) + extra;
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    },
    // The veil: three or four even treads after a short hold.
    wipe: function (rnd, extra) {
      var n = 3 + Math.round(rnd()) + extra;
      return stairOf(spaced(n, between(rnd, 0.14, 0.26), between(rnd, 0.82, 0.9)), equal(n));
    },
    // How anything turns: even clicks round, evenly spaced -- a clock's, never a slip.
    ratchet: function (rnd, extra) {
      var n = 12 + Math.floor(rnd() * 13) + extra * 4;
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    }
  };

  /* The spells: @keyframes names and the family each is cut from. A name not listed takes the
     family its name suggests. */
  var SPELLS = {
    'cut-in': 'stair',
    'cut-out': 'stair',
    'stage-in': 'arrive',
    'stage-unmake': 'leave',
    'card-in': 'arrive',
    'card-out': 'leave',
    'lightbox-veil': 'wipe',
    'lightbox-veil-out': 'wipe',
    'persona-beckon': 'pulse',
    'persona-flight': 'arrive',
    'rite-turn': 'ratchet',
    'key-turn': 'ratchet',
    'spark-ratchet': 'ratchet'
  };

  function familyOf(name) {
    if (FAMILIES[name]) return name;
    if (SPELLS[name]) return SPELLS[name];
    if (/wax|wane|seal|unseal|reveal|develop|unmake|stamp|ink/.test(name)) {
      if (/stamp|ink/.test(name)) return 'flicker';
      if (/unmake|out$|leave|gone|away|reject|unseal|wane/.test(name)) return 'leave';
      if (/develop|seal/.test(name)) return 'arrive';
      return 'stair';
    }
    if (/out$|-out-|leave|gone|away|reject|strike|unmake/.test(name)) return 'leave';
    if (/turn|spin|ratchet|wheel|dial|tick/.test(name)) return 'ratchet';
    if (/drift|wait/.test(name)) return 'drift';
    if (/beckon|breath|pulse|twinkle|blink/.test(name)) return 'pulse';
    if (/veil|wipe/.test(name)) return 'wipe';
    if (/stamp|press|punch|flick|no$|no-b|refuse|twitch/.test(name)) return 'flicker';
    if (/-in$|arrive|deal|land|cast|develop/.test(name)) return 'arrive';
    return 'stair';
  }

  function makeCurve(family, temper, seed) {
    var rnd = mulberry32(seed == null ? entropy() : seed);
    var make = FAMILIES[familyOf(family)] || FAMILIES.stair;
    var extra = temper && temper.steps > 0.5 ? 1 : 0;
    return make(rnd, extra);
  }

  // A browser without linear(): the same number of treads as steps().
  function stepsOf(curve) {
    var jumps = (curve.stops.length - 2) / 2;
    return 'steps(' + Math.max(2, Math.round(jumps)) + ', jump-end)';
  }

  /* ---- the geometry ---------------------------------------------------------------------- */

  // Where an arrival comes from: below, mostly; a side now and then; above rarely. Each is a clear
  // direction, and the slice it moves behind is the direction it travels (0deg is up).
  var ARRIVALS = [
    { x: 0, y: 22, angle: 0, w: 5 },
    { x: -22, y: 0, angle: 90, w: 2 },
    { x: 22, y: 0, angle: 270, w: 2 },
    { x: 0, y: -18, angle: 180, w: 1 }
  ];
  var LEAVES = [
    { x: 0, y: -16, angle: 0, w: 5 },
    { x: 18, y: 0, angle: 90, w: 2 },
    { x: -18, y: 0, angle: 270, w: 2 },
    { x: 0, y: 16, angle: 180, w: 1 }
  ];
  var WIPES = [
    ['inset(0 0 100% 0)', 'inset(0)'],
    ['inset(100% 0 0 0)', 'inset(0)'],
    ['inset(0 100% 0 0)', 'inset(0)'],
    ['inset(0 0 0 100%)', 'inset(0)']
  ];
  var STATE_FROM = ['inset(0 100% 0 0)', 'inset(0 0 0 100%)', 'inset(100% 0 0 0)', 'inset(0 0 100% 0)'];

  function weighted(rnd, list) {
    var total = 0;
    for (var i = 0; i < list.length; i++) total += list[i].w;
    var r = rnd() * total;
    for (var j = 0; j < list.length; j++) {
      r -= list[j].w;
      if (r <= 0) return list[j];
    }
    return list[0];
  }

  function rollGeometry(rnd, temper) {
    var a = weighted(rnd, ARRIVALS);
    var l = weighted(rnd, LEAVES);
    var reach = 0.85 + rnd() * 0.3;
    var wipe = WIPES[Math.floor(rnd() * WIPES.length)];
    return {
      arriveX: a.x * reach,
      arriveY: a.y * reach,
      arriveAngle: a.angle,
      // Kept at rest, for the stylesheets that still name them: nothing tilts, skews or overshoots.
      arriveRot: 0,
      arriveScale: 1,
      arriveSkew: 0,
      leaveX: l.x * reach,
      leaveY: l.y * reach,
      leaveAngle: l.angle,
      leaveRot: 0,
      leaveScale: 1,
      wipeFrom: wipe[0],
      wipeTo: wipe[1],
      stateFrom: STATE_FROM[Math.floor(rnd() * STATE_FROM.length)],
      shiftX: 0,
      shiftSkew: 0,
      shiftBlur: 0,
      skyX: 4 + rnd() * 30,
      skyY: -22 + rnd() * 20,
      liftY: -2,
      liftRot: 0,
      sparkExtra: [30, 45, 60, 90][Math.floor(rnd() * 4)],
      popOver: 1,
      shakeX: 3,
      beckonSpread: 6,
      rejectGrow: 1,
      rayFrom: 0.2
    };
  }

  function rollDurations(rnd, temper) {
    var tempo = temper.tempo;
    function one(base, spread) {
      return Math.round(base * tempo * (1 - spread + rnd() * spread * 2));
    }
    return {
      short: one(170, 0.15),
      medium: one(320, 0.15),
      long: one(500, 0.15),
      slow: one(1200, 0.2),
      stagger: one(44, 0.3),
      shift: one(560, 0.2),
      turn: one(120000, 0.25)
    };
  }

  /* ---- the engine ------------------------------------------------------------------------- */

  function engine(doc) {
    var html = doc && doc.documentElement;
    var style = html && html.style;
    var canWrite = !!(style && typeof style.setProperty === 'function');
    var calm = typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var supportsLinear = true;
    try {
      if (global.CSS && typeof global.CSS.supports === 'function') {
        supportsLinear = global.CSS.supports('animation-timing-function', 'linear(0, 0.5 50%, 1)');
      }
    } catch (e) {
      supportsLinear = true;
    }
    var temper = readTemper(doc);
    var current = { curves: {}, spells: {}, spellMs: {}, durations: null, geometry: null };
    var looping = { 'persona-beckon': true, 'rite-turn': true };
    var bootAt = 0;
    var temperOf = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    // The temperament an element moves by: its own mood's where it sits inside one (a card of
    // another world in the feed), the page's otherwise. Cached until the site shifts.
    function temperFor(el) {
      if (!el || typeof el.closest !== 'function') return temper;
      var host = null;
      try {
        host = el.closest('[data-mood], [data-world], [data-featured]');
      } catch (e) {
        return temper;
      }
      if (!host || host === html) return temper;
      if (temperOf && temperOf.has(host)) return temperOf.get(host);
      var t = readTemper(doc, host);
      if (temperOf) temperOf.set(host, t);
      return t;
    }

    function reduced() {
      return !!(calm && calm.matches);
    }

    function write(name, value) {
      if (canWrite) style.setProperty(name, value);
    }

    function setInline(el, name, value) {
      if (el && el.style && typeof el.style.setProperty === 'function') el.style.setProperty(name, value);
    }

    function cssOf(curve) {
      return supportsLinear ? curve.toCSS() : stepsOf(curve);
    }

    function now() {
      return global.performance && typeof global.performance.now === 'function'
        ? global.performance.now() : Date.now();
    }

    /* ---- the page's roll, once ----------------------------------------------------------- */

    var BASE_MS = { arrive: 500, leave: 320, stair: 320, shift: 240, flicker: 170, pulse: 2400, drift: 120000, wipe: 320, ratchet: 120000 };
    var ALL_FAMILIES = ['arrive', 'leave', 'shift', 'flicker', 'pulse', 'drift', 'wipe', 'stair', 'ratchet'];

    function rollFamilies() {
      var rnd = mulberry32(entropy());
      for (var i = 0; i < ALL_FAMILIES.length; i++) {
        var family = ALL_FAMILIES[i];
        var curve = makeCurve(family, temper, Math.floor(rnd() * 0x7fffffff));
        current.curves[family] = curve;
        write('--ease-' + family, cssOf(curve));
      }
    }

    // A spell's curve and length, for the page (on :root) or for one element (inline).
    function spellOn(el, name, family, base) {
      var rnd = mulberry32(entropy());
      var fam = family || familyOf(name);
      var t = el ? temperFor(el) : temper;
      var curve = makeCurve(fam, t, Math.floor(rnd() * 0x7fffffff));
      var length = Math.round((base || BASE_MS[fam] || 320) * t.tempo * (0.85 + rnd() * 0.3));
      if (el) {
        setInline(el, '--ease-' + name, cssOf(curve));
        setInline(el, '--motion-' + name, length + 'ms');
      } else {
        current.spells[name] = curve;
        current.spellMs[name] = length;
        write('--ease-' + name, cssOf(curve));
        write('--motion-' + name, length + 'ms');
      }
      return length;
    }

    function rollDurationsNow() {
      var d = rollDurations(mulberry32(entropy()), temper);
      current.durations = d;
      write('--motion-short', d.short + 'ms');
      write('--motion-medium', d.medium + 'ms');
      write('--motion-long', d.long + 'ms');
      write('--motion-slow', d.slow + 'ms');
      write('--motion-stagger', d.stagger + 'ms');
      write('--motion-shift', d.shift + 'ms');
      write('--motion-turn', d.turn + 'ms');
    }

    function rollGeometryNow() {
      var g = rollGeometry(mulberry32(entropy()), temper);
      current.geometry = g;
      write('--arrive-x', g.arriveX.toFixed(1) + 'px');
      write('--arrive-y', g.arriveY.toFixed(1) + 'px');
      write('--arrive-angle', g.arriveAngle + 'deg');
      write('--arrive-rot', '0deg');
      write('--arrive-scale', '1');
      write('--arrive-skew', '0deg');
      write('--leave-x', g.leaveX.toFixed(1) + 'px');
      write('--leave-y', g.leaveY.toFixed(1) + 'px');
      write('--leave-angle', g.leaveAngle + 'deg');
      write('--leave-rot', '0deg');
      write('--leave-scale', '1');
      write('--wipe-from', g.wipeFrom);
      write('--wipe-to', g.wipeTo);
      write('--state-from', g.stateFrom);
      write('--shift-x', '0px');
      write('--shift-skew', '0deg');
      write('--shift-blur', '0px');
      write('--lift-y', g.liftY + 'px');
      write('--lift-rot', '0deg');
      write('--spark-extra', g.sparkExtra + 'deg');
      write('--pop-over', '1');
      write('--shake-x', g.shakeX + 'px');
      write('--beckon-spread', g.beckonSpread + 'px');
      write('--reject-grow', '1');
      write('--ray-from', String(g.rayFrom));
      write('--sky-x', g.skyX.toFixed(1) + '%');
      write('--sky-y', g.skyY.toFixed(1) + '%');
    }

    // Everything rolled, written on :root in one go: as the page loads, and when the site changes
    // its mood. Never on the end of an animation (that is the element's own, below).
    function rollAll() {
      temper = readTemper(doc);
      if (temperOf) temperOf = new global.WeakMap();
      rollFamilies();
      for (var name in SPELLS) {
        if (Object.prototype.hasOwnProperty.call(SPELLS, name)) spellOn(null, name);
      }
      rollDurationsNow();
      rollGeometryNow();
    }

    /* A spell that ends is rolled afresh on the element that played it -- the element's own
       style, recalculated alone -- so the next time it plays it plays another stair. A loop is
       left alone. */
    function onAnimationEnd(ev) {
      var name = ev && ev.animationName;
      var el = ev && ev.target;
      if (!name || !el || looping[name] || /^(cut|lift)-(in|out)$/.test(name)) return;
      if (el === html || !el.style) return;
      spellOn(el, name);
    }

    /* ---- the cut: one movement's composition ---------------------------------------------- */

    /* The pieces a movement is composed of, chosen for this trigger: the family's stair with a
       rolled count and spacing of treads, a length rolled round its base, and the shape's
       parameters given by the reason for it (an angle for a slice, a point for a curve). Written
       on the element as --ease-<rite> and --motion-<rite> (and --cut-angle, --cut-x, --cut-y), and
       the length is handed back. `alias` writes the same treads under a second name, for a
       stylesheet that reads the spell by its keyframes' name. */
    var RITES = {
      wax: 'stair', wane: 'leave', stamp: 'flicker', ink: 'flicker', seal: 'arrive', unseal: 'leave',
      develop: 'arrive', unmake: 'leave', reveal: 'stair', 'veil-out': 'wipe', veil: 'wipe'
    };

    function cut(el, rite, options) {
      if (!el || !el.style || !rite) return 0;
      var opts = options || {};
      if (reduced() && !opts.always) return 0;
      var t = temperFor(el);
      var rnd = mulberry32(opts.seed == null ? entropy() : (opts.seed >>> 0));
      var family = opts.family || RITES[rite] || familyOf(rite);
      var curve;
      if (opts.treads) {
        var n = Math.max(2, Math.round(opts.treads));
        curve = stairOf(spaced(n, between(rnd, 0.2, 0.34), between(rnd, 0.84, 0.92)), equal(n));
      } else {
        curve = makeCurve(family, t, Math.floor(rnd() * 0x7fffffff));
      }
      var base = opts.base || (current.durations && current.durations[opts.duration || 'medium']) || BASE_MS[family] || 320;
      var length = Math.round(base * (opts.base ? t.tempo : 1) * (0.85 + rnd() * 0.3));
      var css = cssOf(curve);
      setInline(el, '--ease-' + rite, css);
      setInline(el, '--motion-' + rite, length + 'ms');
      if (opts.alias) {
        setInline(el, '--ease-' + opts.alias, css);
        setInline(el, '--motion-' + opts.alias, length + 'ms');
      }
      if (opts.angle != null) setInline(el, '--cut-angle', Math.round(opts.angle) + 'deg');
      if (opts.x != null) setInline(el, '--cut-x', Math.round(opts.x) + '%');
      if (opts.y != null) setInline(el, '--cut-y', Math.round(opts.y) + '%');
      return length;
    }

    // The older name, kept for a script not yet moved to cut(): the kind maps onto a rite and the
    // fallback keyframes' own name is written beside it. Nothing is written into a stylesheet.
    function composeOn(el, kind, fallback, baseMs, options) {
      var opts = options || {};
      cut(el, kind, { base: baseMs, alias: fallback, seed: opts.seed });
      return null;
    }

    function compose() {
      return null;
    }

    /* ---- the state rites ------------------------------------------------------------------- */

    var PRESSABLE = 'a[href], button, input, select, textarea, summary, label, [role="button"], '
      + '[role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], '
      + '[role="menuitem"], [role="link"], [data-rite]';
    // The attributes a control is set by -- a chip pressed, a tab chosen, a knob set, a details
    // opened -- watched over the whole page so the seal plays whoever set it.
    var SET_ATTRS = ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'aria-expanded', 'open', 'data-set', 'data-selected', 'data-on', 'class'];
    var SET_CLASS = /(?:^|\s)(?:is-set|is-on|is-selected|is-active|is-chosen|is-current|is-open|is-lit|selected|active)(?:\s|$)/;
    // What ends each passing rite: the animation whose name says so, or the clock.
    var PASSING = {
      waning: /wane|thaw|cut-out|matte-out|settle/,
      stamping: /stamp|press|ink|cut-in/,
      sealing: /(?:^|-)seal(?!ed)|-set$|cut-in/,
      unsealing: /unseal|unset|cut-out/,
      dealt: /develop|dealt|-in$/
    };

    var rites = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function riteState(el) {
      if (!rites) return null;
      var s = rites.get(el);
      if (!s) {
        s = { hover: false, focus: false, timers: {}, pressX: null, pressY: null, pressAt: 0 };
        rites.set(el, s);
      }
      return s;
    }

    function pressable(target) {
      if (!target || typeof target.closest !== 'function') return null;
      var el = target.closest(PRESSABLE);
      if (!el) return null;
      if (el.getAttribute('data-rite') === 'none' || el.hasAttribute('disabled') || el.hasAttribute('inert')) return null;
      return el;
    }

    function addClass(el, name) {
      if (el && el.classList) el.classList.add(name);
    }

    function dropClass(el, name) {
      if (el && el.classList) el.classList.remove(name);
    }

    // A rite that passes: the class goes on, and comes off at the end of the animation it started
    // or when the clock says it must have ended, whichever is first. Starting one that is already
    // playing restarts it, so a second press is a second stamp.
    function pass(el, kind, after) {
      if (!el) return;
      var cls = 'is-' + kind;
      var s = riteState(el);
      var wait = after || ((ms('long') || 500) * 2 + 400);
      if (s && s.timers[kind] && typeof global.clearTimeout === 'function') global.clearTimeout(s.timers[kind]);
      dropClass(el, cls);
      var raf = frameOf() || function (fn) { fn(); };
      raf(function () {
        addClass(el, cls);
        if (s && typeof global.setTimeout === 'function') {
          s.timers[kind] = global.setTimeout(function () {
            s.timers[kind] = 0;
            dropClass(el, cls);
          }, wait);
        }
      });
    }

    function endPass(el, kind) {
      var s = rites && rites.get(el);
      if (s && s.timers[kind] && typeof global.clearTimeout === 'function') {
        global.clearTimeout(s.timers[kind]);
        s.timers[kind] = 0;
      }
      dropClass(el, 'is-' + kind);
    }

    function onRiteEnd(ev) {
      var el = ev && ev.target;
      var name = ev && ev.animationName;
      if (!el || !name || !el.classList) return;
      for (var kind in PASSING) {
        if (!Object.prototype.hasOwnProperty.call(PASSING, kind) || !el.classList.contains('is-' + kind)) continue;
        if (PASSING[kind].test(name)) endPass(el, kind);
      }
    }

    // A number of an element's own, from where it sits and what it says.
    function seedOf(el) {
      var text = (el.id || '') + '|' + (typeof el.className === 'string' ? el.className : '') + '|' + (el.textContent || '').slice(0, 40);
      var h = 2166136261;
      for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
      var kids = el.parentNode && el.parentNode.children ? el.parentNode.children : null;
      var k = 0;
      if (kids) for (var j = 0; j < kids.length; j++) if (kids[j] === el) { k = j; break; }
      return ((h ^ Math.imul(k + 1, 2654435761)) >>> 0);
    }

    // The slice a pointer brings in: perpendicular to its approach, from the side it came in by,
    // to the nearest 15 degrees (0deg sweeps upward, 90deg rightward). A key brings none: the
    // register's own angle stands.
    function approach(el, ev) {
      if (!ev || typeof ev.clientX !== 'number' || typeof el.getBoundingClientRect !== 'function') return null;
      var box = el.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      var dx = box.left + box.width / 2 - ev.clientX;
      var dy = box.top + box.height / 2 - ev.clientY;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
      var deg = Math.atan2(dx, -dy) * 180 / Math.PI;
      return ((Math.round(deg / 15) * 15) % 360 + 360) % 360;
    }

    function wax(el, ev) {
      if (!el) return;
      endPass(el, 'waning');
      if (!reduced()) {
        var angle = approach(el, ev);
        if (angle == null && el.style && typeof el.style.removeProperty === 'function') el.style.removeProperty('--cut-angle');
        cut(el, 'wax', { angle: angle, alias: 'matte-in' });
      }
      addClass(el, 'is-waxing');
    }

    function wane(el) {
      if (!el || !el.classList || !el.classList.contains('is-waxing')) return;
      dropClass(el, 'is-waxing');
      cut(el, 'wane', { alias: 'matte-out' });
      pass(el, 'waning');
    }

    function onOver(ev) {
      var el = pressable(ev.target);
      if (!el) return;
      var s = riteState(el);
      if (s) {
        if (s.hover) return;
        s.hover = true;
      }
      wax(el, ev);
    }

    function onOut(ev) {
      var el = pressable(ev.target);
      if (!el) return;
      var to = ev.relatedTarget;
      if (to && typeof el.contains === 'function' && el.contains(to)) return;
      var s = riteState(el);
      if (s) {
        s.hover = false;
        if (s.focus) return;
      }
      wane(el);
    }

    // Focus waxes a control only when the focus is one the browser would show.
    function onFocusIn(ev) {
      var el = pressable(ev.target);
      if (!el) return;
      var visible = true;
      try {
        if (typeof el.matches === 'function') visible = el.matches(':focus-visible');
      } catch (e) {
        /* a browser without :focus-visible shows every focus */
      }
      if (!visible) return;
      var s = riteState(el);
      if (s) s.focus = true;
      wax(el, null);
    }

    function onFocusOut(ev) {
      var el = pressable(ev.target);
      if (!el) return;
      var s = riteState(el);
      if (s) {
        s.focus = false;
        if (s.hover) return;
      }
      wane(el);
    }

    function onStamp(ev) {
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      var el = pressable(ev.target);
      if (!el) return;
      if (ev.type === 'keydown' && (el.tagName === 'TEXTAREA' || el.isContentEditable
        || (el.tagName === 'INPUT' && !/^(?:button|submit|reset|checkbox|radio|range|color|file)$/i.test(el.type || '')))) return;
      // Where the press landed: the point the ink grows from (the middle for a key).
      var px = 50;
      var py = 50;
      if (ev.type !== 'keydown' && typeof el.getBoundingClientRect === 'function' && typeof ev.clientX === 'number') {
        var box = el.getBoundingClientRect();
        if (box.width && box.height) {
          px = clamp(Math.round((ev.clientX - box.left) / box.width * 100), 0, 100);
          py = clamp(Math.round((ev.clientY - box.top) / box.height * 100), 0, 100);
        }
      }
      var s = riteState(el);
      if (s) {
        s.pressX = px;
        s.pressY = py;
        s.pressAt = now();
      }
      setInline(el, '--stamp-x', px + '%');
      setInline(el, '--stamp-y', py + '%');
      if (!reduced()) {
        cut(el, 'stamp', { alias: 'rite-stamp', base: 170, x: px, y: py });
        cut(el, 'ink', { base: 170 });
      }
      pass(el, 'stamping', (ms('medium') || 320) + 400);
    }

    function isSet(el, attr) {
      if (attr === 'class') return SET_CLASS.test(typeof el.className === 'string' ? el.className : '');
      var v = el.getAttribute(attr);
      if (v == null || v === 'false') return false;
      if (attr === 'aria-expanded') return v === 'true';
      return true;
    }

    // Where a set control's curve sits: round the point it was pressed at, if it was pressed a
    // moment ago; otherwise a corner of its own (from its seed), so the two shades it rests in
    // are its own and not every control's.
    var CORNERS = [[18, 82], [82, 82], [18, 18], [82, 18], [50, 100], [0, 50]];
    function dress(el) {
      if (!el || !el.style) return;
      var s = riteState(el);
      var x;
      var y;
      if (s && s.pressAt && now() - s.pressAt < 1500) {
        x = s.pressX;
        y = s.pressY;
      } else {
        var c = CORNERS[seedOf(el) % CORNERS.length];
        x = c[0];
        y = c[1];
      }
      setInline(el, '--seal-x', x + '%');
      setInline(el, '--seal-y', y + '%');
    }

    function onSetChange(changes) {
      for (var i = 0; i < changes.length; i++) {
        var c = changes[i];
        var el = c.target;
        var attr = c.attributeName;
        if (!el || !attr || !el.classList) continue;
        var was;
        if (attr === 'class') {
          // The engine's own passing classes come and go here too; only a set class counts.
          var old = c.oldValue || '';
          was = SET_CLASS.test(old);
          if (was === isSet(el, attr)) continue;
        } else {
          was = c.oldValue != null && c.oldValue !== 'false' && (attr !== 'aria-expanded' || c.oldValue === 'true');
        }
        var is = isSet(el, attr);
        if (was === is) continue;
        if (el.getAttribute('data-rite') === 'none') continue;
        // A dialog's open is its own arrival, not a control becoming set.
        if (attr === 'open' && el.tagName === 'DIALOG') continue;
        if (is) dress(el);
        if (reduced()) continue;
        if (is) cut(el, 'seal', { duration: 'long' });
        else cut(el, 'unseal');
        // A seal and an unseal end each other, as a wax ends a wane: set and unset within one
        // moment is the one the visitor left it in.
        endPass(el, is ? 'unsealing' : 'sealing');
        pass(el, is ? 'sealing' : 'unsealing');
      }
    }

    function watchStates() {
      doc.addEventListener('pointerover', onOver, true);
      doc.addEventListener('pointerout', onOut, true);
      doc.addEventListener('focusin', onFocusIn, true);
      doc.addEventListener('focusout', onFocusOut, true);
      doc.addEventListener('pointerdown', onStamp, true);
      doc.addEventListener('keydown', onStamp, true);
      doc.addEventListener('animationend', onRiteEnd, true);
      doc.addEventListener('animationcancel', onRiteEnd, true);
      if (typeof global.MutationObserver === 'function' && doc.documentElement) {
        try {
          new global.MutationObserver(onSetChange).observe(doc.documentElement, {
            attributes: true, attributeOldValue: true, subtree: true, attributeFilter: SET_ATTRS
          });
        } catch (e) {
          /* a browser whose observer takes no filter: controls set without a seal */
        }
      }
    }

    /* ---- the reveal ------------------------------------------------------------------------ */

    /* Words do not appear: they are cut in. One slice at the register's slant (--reveal-angle)
       steps across the element, a tread to each word (two to six of them, the words run together
       past six), each tread as wide as its words are long, so the edge comes to rest in the gaps.
       The element is never taken apart: no span, no sigil, one mask and one animation
       (_sass/_rite.scss, .is-revealing). A visitor who asked for less motion is shown the words.
       Hands back a function that ends the rite early. */

    var revealing = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function reveal(el, options) {
      if (!el || !el.style || !el.classList) return function () {};
      var opts = options || {};
      var before = revealing && revealing.get(el);
      if (before) before();
      if (reduced() && !opts.always) return function () {};
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return function () {};
      var words = text.split(' ');
      var n = clamp(words.length, 2, 6);
      // Group the words into n treads, as even in letters as the words allow.
      var total = text.length;
      var cuts = [];
      var acc = 0;
      var next = 1;
      for (var w = 0; w < words.length && cuts.length < n - 1; w++) {
        acc += words[w].length + 1;
        if (acc / total >= next / n) {
          cuts.push(acc / total);
          next += 1;
        }
      }
      while (cuts.length < n - 1) cuts.push((cuts.length + 1) / n);
      var rises = [];
      var last = 0;
      for (var c = 0; c < cuts.length; c++) {
        rises.push(Math.max(0.01, cuts[c] - last));
        last = cuts[c];
      }
      rises.push(Math.max(0.01, 1 - last));
      var rnd = mulberry32(entropy());
      var curve = stairOf(spaced(n, between(rnd, 0.06, 0.14), between(rnd, 0.84, 0.92)), rises);
      var t = temperFor(el);
      var length = Math.round(clamp(total * 16, 220, 820) * t.tempo * (opts.pace ? clamp(opts.pace / 0.42, 0.5, 1.6) : 1));
      var anim = null;
      var ended = false;
      var timer = 0;
      function undo() {
        if (ended) return;
        ended = true;
        if (timer && typeof global.clearTimeout === 'function') global.clearTimeout(timer);
        if (revealing) revealing['delete'](el);
        if (anim && typeof anim.cancel === 'function') {
          try { anim.cancel(); } catch (e) { /* gone with the element */ }
        }
        dropClass(el, 'is-revealing');
        if (typeof opts.done === 'function') opts.done();
      }
      // The mask is the stylesheet's (.is-revealing); the edge is stepped here, by the Web
      // Animations API, so it plays beside whatever the element already plays and never instead.
      addClass(el, 'is-revealing');
      if (typeof el.animate === 'function') {
        try {
          anim = el.animate([{ '--cut': '0%' }, { '--cut': '100%' }], { duration: length, easing: cssOf(curve), fill: 'both' });
          anim.onfinish = undo;
        } catch (e) {
          anim = null;
        }
      }
      if (revealing) revealing.set(el, undo);
      if (!anim) {
        if (typeof global.setTimeout === 'function') timer = global.setTimeout(undo, length + (opts.after || 200));
        else undo();
      }
      return undo;
    }

    /* ---- the ghost veil -------------------------------------------------------------------- */

    /* The veil (#lightbox-veil, js/site.js) is hidden the instant what was behind it is put away.
       So a ghost of it is left in its place for one more movement: a clone with no id, aria-hidden
       and under no pointer, that the stylesheet cuts away (@keyframes cut-out on .is-ghost) and
       that goes when the animation ends. Raised again before the ghost has gone, the veil takes
       its place back and the ghost goes at once. */

    var ghost = null;
    var ghostTimer = 0;

    function dropGhost() {
      if (ghostTimer && typeof global.clearTimeout === 'function') global.clearTimeout(ghostTimer);
      ghostTimer = 0;
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    function raiseGhost(veil) {
      dropGhost();
      if (reduced() || !veil.parentNode || typeof veil.cloneNode !== 'function') return;
      ghost = veil.cloneNode(false);
      ghost.removeAttribute('id');
      ghost.removeAttribute('hidden');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      ghost.className = (veil.className ? veil.className + ' ' : '') + 'is-ghost';
      ghost.style.pointerEvents = 'none';
      var length = cut(ghost, 'veil-out', { alias: 'lightbox-veil-out' });
      veil.parentNode.insertBefore(ghost, veil.nextSibling);
      var mine = ghost;
      mine.addEventListener('animationend', function () { if (ghost === mine) dropGhost(); });
      mine.addEventListener('animationcancel', function () { if (ghost === mine) dropGhost(); });
      if (typeof global.setTimeout === 'function') {
        ghostTimer = global.setTimeout(function () { if (ghost === mine) dropGhost(); }, (length || 400) * 2 + 400);
      }
    }

    function watchVeil() {
      if (typeof global.MutationObserver !== 'function' || typeof doc.getElementById !== 'function') return;
      var veil = doc.getElementById('lightbox-veil');
      if (!veil) {
        if (typeof doc.addEventListener === 'function' && doc.readyState === 'loading') {
          doc.addEventListener('DOMContentLoaded', watchVeil, { once: true });
        }
        return;
      }
      var shown = !veil.hidden;
      try {
        new global.MutationObserver(function () {
          var up = !veil.hidden;
          if (up) dropGhost();
          else if (shown) raiseGhost(veil);
          shown = up;
        }).observe(veil, { attributes: true, attributeFilter: ['hidden'] });
      } catch (e) {
        /* the veil goes the way it came */
      }
    }

    /* ---- FLIP ------------------------------------------------------------------------------ */

    // The treads of a stair as keyframe offsets: [t, y] pairs with each tread held to the next.
    function treadsOf(curve) {
      var stops = curve.stops;
      var out = [[0, 0]];
      for (var i = 1; i < stops.length; i++) {
        var t = clamp(stops[i][0], 0, 1);
        var y = stops[i][1];
        var prev = out[out.length - 1];
        if (y === prev[1]) continue;
        out.push([Math.max(prev[0], t - 0.0005), prev[1]]);
        out.push([t, y]);
      }
      if (out[out.length - 1][0] < 1) out.push([1, 1]);
      return out;
    }

    /* Things changing places move from where they were to where they are in three or four held
       treads (never a slide): flip(container, change) measures, runs change(), measures again and
       moves each child that moved by the Web Animations API. A new child gets is-dealt. */
    function flip(container, change, options) {
      var opts = options || {};
      var items = opts.items ? Array.prototype.slice.call(opts.items) : null;
      var kids = container && container.children ? container.children : null;
      if (!items && kids) items = Array.prototype.slice.call(kids);
      var before = [];
      var can = items && !reduced() && typeof Element !== 'undefined' && Element.prototype
        && typeof Element.prototype.animate === 'function';
      if (can) {
        for (var i = 0; i < items.length; i++) {
          if (typeof items[i].getBoundingClientRect === 'function') before.push([items[i], items[i].getBoundingClientRect()]);
        }
      }
      if (typeof change === 'function') change();
      if (!can) return [];
      var out = [];
      var rnd = mulberry32(entropy());
      var moved = [];
      for (var b = 0; b < before.length; b++) {
        var el = before[b][0];
        if (typeof el.isConnected === 'boolean' && !el.isConnected) continue;
        var is = el.getBoundingClientRect();
        if (!is.width && !is.height) continue;
        var dx = before[b][1].left - is.left;
        var dy = before[b][1].top - is.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        moved.push([el, dx, dy]);
      }
      // One stair for the whole move, so everything that moves steps together: one gesture.
      var treads = treadsOf(makeCurve(opts.family || 'arrive', temper, Math.floor(rnd() * 0x7fffffff)));
      var when = (ms('long') || 500) * (0.85 + rnd() * 0.3);
      for (var m = 0; m < moved.length; m++) {
        var frames = [];
        for (var k = 0; k < treads.length; k++) {
          var y = treads[k][1];
          frames.push({ offset: treads[k][0], transform: 'translate(' + (moved[m][1] * (1 - y)).toFixed(1) + 'px, ' + (moved[m][2] * (1 - y)).toFixed(1) + 'px)' });
        }
        try {
          out.push(moved[m][0].animate(frames, { duration: when, easing: supportsLinear ? 'linear(0, 1)' : 'steps(1, jump-end)', fill: 'backwards' }));
        } catch (e) {
          /* the browser could not read the frames: it is where it is */
        }
      }
      if (kids && opts.dealt !== false) {
        for (var n = 0; n < kids.length; n++) {
          var kid = kids[n];
          var fresh = true;
          for (var q = 0; q < before.length; q++) if (before[q][0] === kid) { fresh = false; break; }
          if (!fresh || kid.hidden || (kid.classList && kid.classList.contains('card-rolled'))) continue;
          pass(kid, 'dealt');
        }
      }
      return out;
    }

    /* ---- the stepper ----------------------------------------------------------------------- */

    /* A movement a script makes in treads: step(k, n) with the tread reached, 0 to n, at the
       moments a stair rolled for this call puts them, never a fraction in between; then done().
       Hands back a function that stops it. */
    function stepper(options) {
      var opts = options || {};
      var total = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = frameOf();
      var cancel = typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
      var rnd = mulberry32(entropy());
      var n = Math.max(2, Math.round(opts.treads || (3 + Math.floor(rnd() * 3))));
      if (!raf || !total || (reduced() && !opts.always)) {
        step(n, n, false);
        done();
        return function () {};
      }
      var moments = spaced(n, between(rnd, 0.16, 0.3), between(rnd, 0.86, 0.95));
      var started = now();
      var handle = 0;
      var stopped = false;
      var reached = 0;
      function frame(tm) {
        if (stopped) return;
        var p = Math.min(1, Math.max(0, tm - started) / total);
        var k = reached;
        while (k < n && moments[k] <= p) k += 1;
        if (k !== reached) {
          reached = k;
          step(k, n, false);
        }
        if (p < 1) handle = raf(frame);
        else {
          if (reached !== n) step(n, n, false);
          done();
        }
      }
      step(0, n, false);
      handle = raf(frame);
      return function () {
        stopped = true;
        if (cancel && handle) cancel(handle);
      };
    }

    /* ---- what a script asks for ------------------------------------------------------------ */

    function rite(el, name, after) {
      if (!el || !name) return;
      if (name === 'wax') return wax(el, null);
      if (name === 'wane') return wane(el);
      pass(el, name, after);
    }

    // The slice the page cuts at, as numbers: what a script drawing its own surfaces matches.
    function mattes() {
      var angle = 112;
      try {
        var v = parseFloat(global.getComputedStyle(html).getPropertyValue('--cut-angle'));
        if (isFinite(v)) angle = v;
      } catch (e) {
        /* the default */
      }
      return { kind: 'slice', angle: angle };
    }

    function geometryFor(seed, el) {
      return rollGeometry(mulberry32(seed == null ? entropy() : (seed >>> 0)), el ? temperFor(el) : temper);
    }

    function ladderFor() {
      return mattes();
    }

    /* An arrival of an element's own: where it comes from (a clear direction), the slice it comes
       in behind (the direction it travels) and its stair, from a seed, written on the element.
       Then the class the stylesheet plays (is-dealt, or the one given). Hands back a function that
       takes the inline roll off again. */
    function arrive(el, options) {
      if (!el || !el.style) return function () {};
      var opts = options || {};
      var seed = opts.seed == null ? entropy() : (opts.seed >>> 0);
      var rnd = mulberry32(seed);
      var g = rollGeometry(rnd, temperFor(el));
      var spell = opts.spell || 'card-in';
      var names = ['--arrive-x', '--arrive-y', '--arrive-angle', '--ease-' + spell, '--motion-' + spell, '--ease-develop', '--motion-develop'];
      setInline(el, '--arrive-x', g.arriveX.toFixed(1) + 'px');
      setInline(el, '--arrive-y', g.arriveY.toFixed(1) + 'px');
      setInline(el, '--arrive-angle', g.arriveAngle + 'deg');
      cut(el, 'develop', { alias: spell, seed: Math.floor(rnd() * 0x7fffffff), duration: 'long' });
      if (opts.className !== false) pass(el, opts.className || 'dealt');
      return function () {
        for (var n = 0; n < names.length; n++) if (el.style && typeof el.style.removeProperty === 'function') el.style.removeProperty(names[n]);
      };
    }

    // The page's roll, pinned on an element while it waits in its delay. Hands back the unpin.
    function deal(el, options) {
      if (!el || !el.style || typeof global.getComputedStyle !== 'function') return function () {};
      var opts = options || {};
      var names = ['--arrive-x', '--arrive-y', '--arrive-angle'];
      var spells = opts.spells || [];
      for (var i = 0; i < spells.length; i++) names.push('--ease-' + spells[i]);
      var pinned = [];
      try {
        var computed = global.getComputedStyle(el);
        for (var n = 0; n < names.length; n++) {
          var v = computed.getPropertyValue(names[n]);
          if (v) {
            el.style.setProperty(names[n], v);
            pinned.push(names[n]);
          }
        }
      } catch (e) {
        /* nothing pinned: it reads the page's roll */
      }
      return function () {
        for (var k = 0; k < pinned.length; k++) if (el.style && typeof el.style.removeProperty === 'function') el.style.removeProperty(pinned[k]);
      };
    }

    /* ---- the shift of mood ----------------------------------------------------------------- */

    var shiftTimer = null;
    var shiftToken = 0;

    /* The site is changing what it is wearing: a new palette, a new register, a new temperament.
       The roll is made again under it (the one :root write after the page loads), and the words
       that carry the page are cut into the new face by a slice (reveal). Not as the page arrives
       (the reading lands a moment after the first paint), and not for less motion. */
    function shift() {
      rollAll();
      if (!html || typeof html.setAttribute !== 'function') return;
      var token = ++shiftToken;
      if (reduced() || now() - bootAt < 900) {
        html.removeAttribute('data-shifting');
        return;
      }
      html.setAttribute('data-shifting', '');
      if (typeof doc.querySelectorAll === 'function') {
        try {
          var words = doc.querySelectorAll('.stage-title, .list-page-main > h1, .prose-main > h1, .section-title, .panel-title');
          for (var w = 0; w < words.length && w < 4; w++) reveal(words[w]);
        } catch (e) {
          /* a page with none of them */
        }
      }
      if (typeof global.clearTimeout === 'function' && shiftTimer) global.clearTimeout(shiftTimer);
      if (typeof global.setTimeout === 'function') {
        shiftTimer = global.setTimeout(function () {
          if (token === shiftToken) html.removeAttribute('data-shifting');
        }, (current.durations ? current.durations.shift : 560) + 80);
      }
    }

    function watch() {
      if (!doc || typeof doc.addEventListener !== 'function') return;
      doc.addEventListener('animationend', onAnimationEnd, true);
      watchStates();
      watchVeil();
      if (typeof global.MutationObserver === 'function' && html) {
        try {
          new global.MutationObserver(function (changes) {
            for (var i = 0; i < changes.length; i++) {
              var attr = changes[i].attributeName;
              // Only a mood that really changed shifts the page: a script writing the same mood
              // again costs nothing.
              if (changes[i].oldValue === html.getAttribute(attr)) continue;
              if (attr === 'data-mood' || attr === 'data-featured' || attr === 'data-world') {
                shift();
                return;
              }
            }
          }).observe(html, { attributes: true, attributeOldValue: true, attributeFilter: ['data-mood', 'data-featured', 'data-world'] });
        } catch (e) {
          /* a browser whose observer takes no filter keeps the roll it loaded with */
        }
      }
    }

    /* ---- curves, tweens and scrolls for a script ------------------------------------------- */

    function curve(family) {
      var c = makeCurve(family || 'arrive', temper);
      return { css: cssOf(c), stops: c.stops, at: function (t) { return c.at(t); } };
    }

    function ease(family) {
      var c = makeCurve(family || 'arrive', temper);
      return function (t) { return c.at(clamp(t, 0, 1)); };
    }

    /* A tween: step(y, t) with y on the treads of a stair rolled for it and t the plain progress,
       each frame for `ms`, then done(). Hands back a function that stops it. */
    function tween(options) {
      var opts = options || {};
      var length = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = frameOf();
      var cancel = typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
      if (!raf || !length || (reduced() && !opts.always)) {
        step(1, 1);
        done();
        return function () {};
      }
      var at;
      if (opts.treads) {
        var rnd = mulberry32(entropy());
        var n = Math.max(2, Math.round(opts.treads));
        var c = stairOf(spaced(n, between(rnd, 0.16, 0.3), between(rnd, 0.84, 0.94)), equal(n));
        at = function (t) { return c.at(t); };
      } else at = ease(opts.family);
      var started = now();
      var handle = 0;
      var stopped = false;
      var lastY = -1;
      function frame(t) {
        if (stopped) return;
        var p = Math.min(1, Math.max(0, t - started) / length);
        var y = p < 1 ? at(p) : 1;
        // Only a new tread is a step: a frame on the same tread asks for nothing to be drawn.
        if (y !== lastY || p >= 1) {
          lastY = y;
          step(y, p);
        }
        if (p < 1) handle = raf(frame);
        else done();
      }
      handle = raf(frame);
      return function () {
        stopped = true;
        if (cancel && handle) cancel(handle);
      };
    }

    var scrolling = null;
    var scrollStop = null;
    function stopScrolling() {
      if (scrolling) scrolling();
      scrolling = null;
      if (scrollStop) scrollStop();
      scrollStop = null;
    }

    /* The page scrolls in a few even treads, never a glide; a wheel, a touch or a key stops it. */
    function scrollTo(top, options) {
      var opts = options || {};
      var from = typeof global.scrollY === 'number' ? global.scrollY : (global.pageYOffset || 0);
      var left = typeof global.scrollX === 'number' ? global.scrollX : (global.pageXOffset || 0);
      var to = Math.max(0, Number(top) || 0);
      stopScrolling();
      if (reduced() || typeof global.scrollTo !== 'function' || Math.abs(to - from) < 2) {
        if (typeof global.scrollTo === 'function') global.scrollTo(left, to);
        return;
      }
      var distance = Math.abs(to - from);
      var length = opts.ms || clamp(240 + distance * 0.3, 280, 900) * temper.tempo;
      var treads = opts.treads || clamp(Math.round(distance / 220), 3, 6);
      var interrupt = ['wheel', 'touchstart', 'keydown'];
      function halt() { stopScrolling(); }
      if (typeof doc.addEventListener === 'function') {
        for (var i = 0; i < interrupt.length; i++) doc.addEventListener(interrupt[i], halt, { passive: true, capture: true });
        scrollStop = function () {
          for (var j = 0; j < interrupt.length; j++) doc.removeEventListener(interrupt[j], halt, { passive: true, capture: true });
        };
      }
      scrolling = stepper({
        ms: length,
        treads: treads,
        step: function (k, n) { global.scrollTo(left, from + (to - from) * (k / n)); },
        done: function () { stopScrolling(); }
      });
    }

    function scrollIntoView(node, options) {
      if (!node || typeof node.getBoundingClientRect !== 'function') return;
      var opts = options || {};
      var box = node.getBoundingClientRect();
      var viewH = global.innerHeight || (html && html.clientHeight) || 0;
      var from = typeof global.scrollY === 'number' ? global.scrollY : (global.pageYOffset || 0);
      var offset;
      if (opts.block === 'center') offset = box.top + box.height / 2 - viewH / 2;
      else if (opts.block === 'end') offset = box.bottom - viewH;
      else offset = box.top;
      scrollTo(from + offset, opts);
    }

    function ms(name) {
      var d = current.durations;
      if (d && d[name]) return d[name];
      return current.spellMs[name] || 0;
    }

    function stagger(k) {
      var step = ms('stagger') || 44;
      return Math.max(0, Math.round((Number(k) || 0) * step));
    }

    function geometry() {
      return current.geometry;
    }

    return {
      curve: curve,
      ease: ease,
      tween: tween,
      scrollTo: scrollTo,
      scrollIntoView: scrollIntoView,
      ms: ms,
      stagger: stagger,
      geometry: geometry,
      mattes: mattes,
      cut: cut,
      reveal: reveal,
      flip: flip,
      stepper: stepper,
      rite: rite,
      wax: wax,
      wane: wane,
      seal: dress,
      compose: compose,
      composeOn: composeOn,
      arrive: arrive,
      deal: deal,
      geometryFor: geometryFor,
      ladderFor: ladderFor,
      temperFor: temperFor,
      treads: function (c) { return treadsOf(c && c.stops ? c : makeCurve('stair', temper)); },
      shift: shift,
      roll: rollAll,
      families: ALL_FAMILIES.slice(),
      spells: SPELLS,
      get reduced() { return reduced(); },
      get temper() { return temper; },
      get stepped() { return !supportsLinear; },
      start: function () {
        bootAt = now();
        if (html && typeof html.setAttribute === 'function') {
          html.setAttribute('data-motion', supportsLinear ? 'rolled' : 'steps');
        }
        rollAll();
        watch();
      }
    };
  }

  /* ---- the maker, offered on its own ------------------------------------------------------ */

  // The pure half, for a test or a build step that wants a stair without a page.
  var maker = {
    curve: function (family, temper, seed) {
      var c = makeCurve(family, temper || DEFAULT_TEMPER, seed);
      return { css: c.toCSS(), stops: c.stops, at: function (t) { return c.at(t); } };
    },
    families: Object.keys(FAMILIES),
    spells: SPELLS,
    familyOf: familyOf,
    geometry: function (temper, seed) {
      return rollGeometry(mulberry32(seed == null ? entropy() : seed), temper || DEFAULT_TEMPER);
    },
    durations: function (temper, seed) {
      return rollDurations(mulberry32(seed == null ? entropy() : seed), temper || DEFAULT_TEMPER);
    }
  };

  if (typeof document !== 'undefined' && document && document.documentElement) {
    var live = engine(document);
    live.maker = maker;
    global.interestingMotion = live;
    live.start();
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = maker;
  } else {
    global.interestingMotion = { maker: maker };
  }
})(typeof window !== 'undefined' ? window : this);
