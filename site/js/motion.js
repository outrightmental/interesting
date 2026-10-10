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
                        ones, stair holds and then steps evenly, shift takes its first tread at
                        once (words already standing are never blank), flicker is two quick
                        treads, the ratchet turns a thing in a few even clicks, pulse is the
                        beat of the one loop left (the persona's beckon, a few times round and
                        then still) and drift a slow even stair -- each two to five treads
      --ease-<spell>    one per spell a stylesheet reads by name (SPELLS), cut from its family
      --motion-short, --motion-medium, --motion-long, --motion-slow, --motion-stagger,
      --motion-shift    the durations, rolled with a little jitter and scaled by the tempo
      --motion-<spell>  one length per spell, rolled beside its curve
      --arrive-x, --arrive-y, --arrive-angle, --leave-x, --leave-y, --leave-angle
                        where arriving content comes from, where leaving content goes, and the
                        angle of the slice each one moves behind (the direction of travel)
      --sky-x, --sky-y  the corner the page's sky opens from, rolled once for the visit
      --spark-extra     how far past a sixth the sparkles turn as the logo opens
      --ease-rite-shift, --motion-rite-shift
                        the one stair and the one length a change of mood is cut in by (shift)

  Per movement, on the element: --ease-<rite> and --motion-<rite> (its treads and its length) and
  the shape's own parameters -- --cut-angle for a slice, --cut-x and --cut-y for a curve,
  --seal-x and --seal-y where a set control's curve sits. The edge itself moves by --cut, a
  registered percentage the keyframes cut-in and cut-out step between 0% and 100%, and ink-in
  for a press's ink (_sass/_cut.scss).

  How a control changes. A control under a moving pointer or the focus waxes (is-waxing) and wanes
  when they leave (is-waning); a press stamps it (is-stamping), and the ink of a press nothing
  hovers goes back the way it came (is-uninking); one that becomes set is sealed (is-sealing) and
  one unset is unsealed (is-unsealing). This file puts the classes on, reading the pointer, the
  keyboard, the focus and every attribute a control is set by, writes that trigger's composition on
  the element before its class goes on, and takes each passing class off again when its animation
  ends; _sass/_controls.scss says what each looks like. It writes <html data-cut> as it starts: the
  stylesheets' :hover, :focus-visible and :active rules are the same rites for a page with no
  script, and they stand aside where the engine plays them (html:not([data-cut])), so a control is
  never cut in twice -- and a tap on a touch screen, whose :hover sticks, is a press and never a
  hover.

  How it reaches the scripts. window.interestingMotion is the same roll offered as functions:

      var m = window.interestingMotion;
      m.ease('arrive')            // a function t -> y: a stair rolled for this call alone
      m.curve('leave')            // { css, stops, at(t) }: the stair as CSS and as arithmetic
      m.tween({ ms, family, step(y, t), done, treads })
      m.stepper({ ms, treads, step(k, n), done })
      m.scrollTo(top) / m.scrollIntoView(el, { block: 'center' })
      m.ms('long') / m.stagger(k) / m.geometry()
      m.cut(el, rite, { family, base, angle, x, y, treads, length })
                                  // one movement's composition written on el; hands back its ms
      m.reveal(el, { seed, treads, length, curve })
                                  // the words of el revealed by one slice, a tread per word or
                                  // two; lines given one seed and one length are one gesture
      m.flip(list, change)        // run change(); every child that moved jumps there in treads
      m.rite(el, 'stamping')      // one passing rite on el, by the name of its class is-<name>
      m.wax(el) / m.wane(el)      // a control waxed or waned as a pointer or the focus would
      m.seal(el)                  // where a set control's curve sits (--seal-x, --seal-y): the
                                  // press a moment ago, or low at the left; the seal itself is
                                  // played when the attribute that sets it changes
      m.arrive(el, { seed, spell, className })
                                  // where el arrives from, its slice and its stair, written on it
      m.deal(el, { spells })      // pin the page's roll on el while it waits in its delay
      m.shift() / m.roll()        // the site changed its mood / roll the page again now
      m.reduced                   // true for a visitor who asked for less motion

  What it costs. The page's roll is written once, before the body is drawn. After that nothing is
  written on :root until the site changes its mood: a movement's composition is written on the
  element that makes it (a style recalculation of that element alone), and a spell that ends has
  its treads rolled afresh on the element that played it, so its next play differs. The
  temperament of each mood is taken off the stylesheet's own rules, once, so a change of mood is
  written in the same style pass as the change itself and restyles the page once. No interval, no
  frame loop at rest (the stepper, a tween and a scroll draw frames only while they move), no
  stylesheet written at run time, no image generated, no element wrapped around a letter.

  The temperament. Each mood of _sass/_mood.scss carries a temperament beside its palette and its
  typographic register: --motion-tempo, how long its movements take, --motion-steps, whether its
  stairs take a tread more, and --motion-grain, how uneven its treads are (0 even, 1 as uneven as
  each family's rule allows). Its register (_sass/_type.scss) carries the angle its slices cut at
  (--cut-angle) and the slant its words are revealed at (--reveal-angle).

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
  // behind the sheet), and the engine's own frames -- the stepper's, the tween's -- must not be
  // held with them, or nothing inside a lightbox would ever arrive.
  var nativeFrame = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
  var nativeCancel = typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
  function frameOf() {
    if (nativeFrame) return function (fn) { return nativeFrame.call(global, fn); };
    return typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
  }

  // Cancel through the same frame provider, not the shell's replacement for held page frames.
  function cancelOf() {
    if (nativeFrame) return nativeCancel ? function (handle) { nativeCancel.call(global, handle); } : null;
    return typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
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

  // The temperament a style declares: a computed style, or a rule of the stylesheet's own. Null
  // where it declares none of the three.
  function temperOf(style) {
    if (!style || typeof style.getPropertyValue !== 'function') return null;
    var grain = parseFloat(style.getPropertyValue('--motion-grain'));
    var tempo = parseFloat(style.getPropertyValue('--motion-tempo'));
    var steps = parseFloat(style.getPropertyValue('--motion-steps'));
    if (!isFinite(grain) && !isFinite(tempo) && !isFinite(steps)) return null;
    return {
      grain: isFinite(grain) ? clamp(grain, 0, 1) : DEFAULT_TEMPER.grain,
      tempo: isFinite(tempo) ? clamp(tempo, 0.4, 2.5) : DEFAULT_TEMPER.tempo,
      steps: isFinite(steps) ? clamp(steps, 0, 1) : DEFAULT_TEMPER.steps
    };
  }

  // The temperament an element wears, off its computed style: a read that makes the browser
  // bring the page's style up to date first, so it is the last resort (temperFor, rootTemper).
  function readTemper(doc, el) {
    var temper = { grain: DEFAULT_TEMPER.grain, tempo: DEFAULT_TEMPER.tempo, steps: DEFAULT_TEMPER.steps };
    if (!doc || typeof global.getComputedStyle !== 'function') return temper;
    var style;
    try {
      style = global.getComputedStyle(el || doc.documentElement);
    } catch (e) {
      return temper;
    }
    return temperOf(style) || temper;
  }

  /* ---- the stair ------------------------------------------------------------------------- */

  /* A curve is a list of stops, [t, y] with t from 0 to 1, rendered as linear() for the stylesheet
     and read as the value of the tread it is on for a script. Every curve here is a stair: it
     starts at (0, 0), holds, jumps to the next tread, holds, ... and lands on 1 a little before
     the end, so the last tread is seen. Two stops at one t are the jump; a jump at t = 0 is a
     first tread taken at once, with no hold before it (the shift's). */

  function Curve(stops) {
    this.stops = stops;
  }

  Curve.prototype.at = function (t) {
    var s = this.stops;
    if (t < 0) return s[0][1];
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

  // A stair from its treads: `moments` are where each jump falls (rising, in [0, 1)) and `rises`
  // how far each one goes (positive, summing to 1).
  function stairOf(moments, rises) {
    var stops = [[0, 0]];
    var y = 0;
    for (var i = 0; i < moments.length; i++) {
      var t = clamp(moments[i], 0, 0.999);
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

  // How many treads a movement takes: rolled from `lo` to `hi`, the temperament's extra tread on
  // top, and never more than five -- past five a stair reads as a ladder, not one gesture.
  function countOf(rnd, lo, hi, extra) {
    return Math.min(5, lo + Math.floor(rnd() * (hi - lo + 1)) + extra);
  }

  // A rolled departure from even, taken as far as the temperament's grain says: `even` at grain 0,
  // the whole of `rolled` at grain 1. Every rise stays positive and every moment after the one
  // before it, so however uneven, a stair still goes only forward.
  function toward(even, rolled, grain) {
    return even + (rolled - even) * grain;
  }

  /* The families: each is one simple rule, and the roll decides the count and the spacing. A
     temperament that steps (--motion-steps) takes a tread more, up to five; its grain
     (--motion-grain) says how far the uneven families depart from even treads. The even ones --
     the stair, the shift, the ratchet -- stay even whatever the grain: that is their rule. */
  var FAMILIES = {
    // A thing landing: the first tread is the longest way, each after it shorter, each held longer.
    arrive: function (rnd, extra, grain) {
      var n = countOf(rnd, 3, 4, extra);
      var rises = geometric(n, toward(1, between(rnd, 0.42, 0.62), grain));
      var moments = [];
      var gap = between(rnd, 0.08, 0.16);
      var t = gap;
      for (var i = 0; i < n; i++) {
        moments.push(t);
        gap *= toward(1, between(rnd, 1.25, 1.55), grain);
        t += gap;
      }
      var scale = between(rnd, 0.82, 0.92) / moments[n - 1];
      for (var j = 0; j < n; j++) moments[j] *= scale;
      return stairOf(moments, rises);
    },
    // A thing going: a hold, then treads that grow and come quicker.
    leave: function (rnd, extra, grain) {
      var n = countOf(rnd, 3, 4, extra);
      var rises = geometric(n, toward(1, between(rnd, 1.6, 2.3), grain));
      var first = between(rnd, 0.2, 0.36);
      var moments = [first];
      var shrink = [];
      var span = 0;
      var gap = 1;
      for (var i = 1; i < n; i++) {
        shrink.push(gap);
        span += gap;
        gap *= toward(1, between(rnd, 0.5, 0.75), grain);
      }
      // The gaps shrink by the rolled ratio and fill the room from the hold to the landing.
      var room = between(rnd, 0.86, 0.94) - first;
      for (var k = 0; k < shrink.length; k++) moments.push(moments[k] + room * shrink[k] / span);
      return stairOf(moments, rises);
    },
    // A state changing where it stands: a hold, then even treads.
    stair: function (rnd, extra) {
      var n = countOf(rnd, 3, 5, extra);
      return stairOf(spaced(n, between(rnd, 0.22, 0.38), between(rnd, 0.84, 0.94)), equal(n));
    },
    // The site changing its mood under words that already stand on the page: the first tread is
    // taken at once -- no hold, so for no tread are the words blank -- and the rest follow evenly.
    // Three or four even treads.
    shift: function (rnd, extra) {
      var n = countOf(rnd, 3, 4, extra);
      return stairOf(spaced(n, 0, between(rnd, 0.58, 0.76)), equal(n));
    },
    // The quick one: a press, a blink on -- two treads, the first a little more than half.
    flicker: function (rnd, extra, grain) {
      var a = toward(0.5, between(rnd, 0.55, 0.7), grain);
      return stairOf([between(rnd, 0.18, 0.36), between(rnd, 0.6, 0.82)], [a, 1 - a]);
    },
    // A loop's beat: even treads, evenly spaced.
    pulse: function (rnd, extra) {
      var n = countOf(rnd, 3, 5, extra);
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    },
    // A slow change: even treads, evenly spaced from the start.
    drift: function (rnd, extra) {
      var n = countOf(rnd, 3, 5, extra);
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    },
    // The veil: three or four even treads after a short hold.
    wipe: function (rnd, extra) {
      var n = countOf(rnd, 3, 4, extra);
      return stairOf(spaced(n, between(rnd, 0.14, 0.26), between(rnd, 0.82, 0.9)), equal(n));
    },
    // How a thing turns: a few even clicks, evenly spaced -- a key's, a dial's, never a slip.
    ratchet: function (rnd, extra) {
      var n = countOf(rnd, 2, 4, extra);
      return stairOf(spaced(n, 1 / (n + 1), n / (n + 1)), equal(n));
    }
  };

  /* The spells: the names a stylesheet reads a curve and a length of the page's own by
     (--ease-<spell> and --motion-<spell>, with a family behind them), and the family each is cut
     from. A name not listed takes the family its name suggests. A movement a script cuts for
     each play and a stylesheet times by a length of its own -- the key that turns (js/threshold.js),
     the mark that flies home to the persona (js/persona.js) -- is not one: the page's roll of it
     would never be seen. */
  var SPELLS = {
    'stage-in': 'arrive',
    'stage-unmake': 'leave',
    'persona-beckon': 'pulse'
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
    var grain = temper && isFinite(temper.grain) ? clamp(temper.grain, 0, 1) : DEFAULT_TEMPER.grain;
    return make(rnd, extra, grain);
  }

  // A browser without linear(): the same number of treads as steps(), the first of them taken at
  // once (jump-start) where the stair takes it at once.
  function stepsOf(curve) {
    var jumps = (curve.stops.length - 2) / 2;
    var first = curve.stops.length > 1 && curve.stops[1][0] <= 0;
    return 'steps(' + Math.max(2, Math.round(jumps)) + ', ' + (first ? 'jump-start' : 'jump-end') + ')';
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

  // The geometry of a movement, rolled. How far a card stands up under the pointer (--lift-y) and
  // how far a wrong answer's row is thrown aside (--shake-x) are not rolled: each is one small
  // distance, the same every time, and stands in the tokens (_sass/_tokens.scss).
  function rollGeometry(rnd) {
    var a = weighted(rnd, ARRIVALS);
    var l = weighted(rnd, LEAVES);
    var reach = 0.85 + rnd() * 0.3;
    return {
      arriveX: a.x * reach,
      arriveY: a.y * reach,
      arriveAngle: a.angle,
      leaveX: l.x * reach,
      leaveY: l.y * reach,
      leaveAngle: l.angle,
      skyX: 4 + rnd() * 30,
      skyY: -22 + rnd() * 20,
      sparkExtra: [30, 45, 60, 90][Math.floor(rnd() * 4)]
    };
  }

  // The durations, rolled round the lengths the tokens bake for a page with no script, so a page
  // with the engine moves about as long as one without it.
  function rollDurations(rnd, temper) {
    var tempo = temper.tempo;
    function one(base, spread) {
      return Math.round(base * tempo * (1 - spread + rnd() * spread * 2));
    }
    return {
      short: one(170, 0.15),
      medium: one(340, 0.15),
      long: one(560, 0.15),
      slow: one(1200, 0.2),
      stagger: one(44, 0.3),
      shift: one(640, 0.2)
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
    var current = { curves: {}, spells: {}, spellMs: {}, durations: null, geometry: null };
    var bootAt = 0;
    var tempers = {};
    var moodTempers = null; // each mood's temperament, off the stylesheet's own rules (moodTemper)
    var bareTemper = null; // the page's own, read as it loaded with no mood on it
    var temper = rootTemper();

    /* Each mood's temperament, as _sass/_mood.scss writes it on :root[data-featured=<mood>] (the
       register of _type.scss carries the three beside its faces): taken off the stylesheet's own
       rules, once, the first time a mood is asked for. A walk over the rules restyles nothing,
       where reading a mood off the page means the browser bringing the whole page's style up to
       date first, in the very task that changed the mood -- and then again once the new roll is
       written. Only the top level is walked: a temperament under a media query would not be the
       mood's own. A mood the walk did not find (a sheet the browser keeps from script) answers
       null, and the caller reads the page instead. */
    function moodTemper(mood) {
      if (!mood) return null;
      if (!moodTempers) {
        moodTempers = {};
        try {
          var sheets = doc.styleSheets || [];
          for (var i = 0; i < sheets.length; i++) {
            var rules = null;
            try {
              rules = sheets[i].cssRules;
            } catch (e) {
              rules = null; /* a sheet from elsewhere: nothing of ours is in it */
            }
            if (!rules) continue;
            for (var j = 0; j < rules.length; j++) {
              var selector = typeof rules[j].selectorText === 'string' ? rules[j].selectorText : '';
              if (selector.indexOf(':root[data-featured=') !== 0) continue;
              var named = /^:root\[data-featured=["']?([\w-]+)["']?\]$/.exec(selector);
              var found = named ? temperOf(rules[j].style) : null;
              if (found) moodTempers[named[1]] = found;
            }
          }
        } catch (e) {
          /* no table: every temperament is read off the page */
        }
      }
      return Object.prototype.hasOwnProperty.call(moodTempers, mood) ? moodTempers[mood] : null;
    }

    /* The page's temperament: the mood it wears -- the piece on the stage's, else the reading's,
       else the page's own world's, the precedence _sass/_mood.scss writes them in -- off the table
       above, with no read of the page's style. A page wearing no mood keeps the temperament it
       loaded with, read once as it loaded, before the body was drawn. */
    function rootTemper() {
      var mood = html && typeof html.getAttribute === 'function'
        ? html.getAttribute('data-featured') || html.getAttribute('data-mood') || html.getAttribute('data-world')
        : null;
      var known = moodTemper(mood);
      if (known) return known;
      if (!mood && bareTemper) return bareTemper;
      var read = readTemper(doc);
      if (!mood) bareTemper = read;
      return read;
    }

    /* The temperament an element moves by: its own mood's where it sits inside one (a card of
       another world in the feed), the page's otherwise. Every host of one mood wears the same
       temperament (_sass/_mood.scss writes it by the mood's name), so it is taken off the table
       of the stylesheet's rules, or read off the first such host and kept by that name until the
       site shifts: a batch of cuts in one task costs at most one read of the style. */
    function temperFor(el) {
      if (!el || typeof el.closest !== 'function') return temper;
      var host = null;
      try {
        host = el.closest('[data-mood]');
      } catch (e) {
        return temper;
      }
      if (!host || host === html) return temper;
      var mood = host.getAttribute('data-mood') || '';
      if (Object.prototype.hasOwnProperty.call(tempers, mood)) return tempers[mood];
      var t = moodTemper(mood) || readTemper(doc, host);
      tempers[mood] = t;
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

    var BASE_MS = { arrive: 500, leave: 320, stair: 320, shift: 640, flicker: 170, pulse: 2400, drift: 1200, wipe: 320, ratchet: 500 };
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

    /* A spell's curve and length, for the page (on :root); or, for one element whose animation
       has ended, its curve alone (inline). Never its length there: an animation that holds its
       end (fill: both) and is given a longer length is back in its active phase, and plays its
       end again. Hands back the length (0 for an element). */
    function spellOn(el, name, family, base) {
      var rnd = mulberry32(entropy());
      var fam = family || familyOf(name);
      var t = el ? temperFor(el) : temper;
      var curve = makeCurve(fam, t, Math.floor(rnd() * 0x7fffffff));
      if (el) {
        setInline(el, '--ease-' + name, cssOf(curve));
        return 0;
      }
      var length = Math.round((base || BASE_MS[fam] || 320) * t.tempo * (0.85 + rnd() * 0.3));
      current.spells[name] = curve;
      current.spellMs[name] = length;
      write('--ease-' + name, cssOf(curve));
      write('--motion-' + name, length + 'ms');
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
    }

    function rollGeometryNow() {
      var before = current.geometry;
      var g = rollGeometry(mulberry32(entropy()));
      current.geometry = g;
      write('--arrive-x', g.arriveX.toFixed(1) + 'px');
      write('--arrive-y', g.arriveY.toFixed(1) + 'px');
      write('--arrive-angle', g.arriveAngle + 'deg');
      write('--leave-x', g.leaveX.toFixed(1) + 'px');
      write('--leave-y', g.leaveY.toFixed(1) + 'px');
      write('--leave-angle', g.leaveAngle + 'deg');
      write('--spark-extra', g.sparkExtra + 'deg');
      // The page's sky (_sass/_panel.scss) keeps the corner it opened from for the whole visit: a
      // change of mood turns its colour, and a sky that leapt to another corner in the same moment
      // would be a second change on the one thing.
      if (before) {
        g.skyX = before.skyX;
        g.skyY = before.skyY;
        return;
      }
      write('--sky-x', g.skyX.toFixed(1) + '%');
      write('--sky-y', g.skyY.toFixed(1) + '%');
    }

    // Everything rolled, written on :root in one go: as the page loads, and when the site changes
    // its mood. Never on the end of an animation (that is the element's own, below). The
    // temperament is the new mood's, taken without asking the page for its style, so the writes
    // land in the same style pass as the change of mood: one restyle of the page, not two.
    function rollAll() {
      temper = rootTemper();
      tempers = {};
      rollFamilies();
      for (var name in SPELLS) {
        if (Object.prototype.hasOwnProperty.call(SPELLS, name)) spellOn(null, name);
      }
      rollDurationsNow();
      rollGeometryNow();
    }

    /* The keyframes whose treads are not their own: the edge's (cut-in, cut-out, ink-in), the way
       an arrival or a leaving moves (lift-in, lift-out), a press's set-down (rite-stamp in
       _sass/_controls.scss and _sass/_nav.scss, card-stamp in _sass/_feed.scss) and the stage
       head's slice on a change of mood (rite-shift in _sass/_mood.scss) are played in a rite's
       treads -- --ease-wax, --ease-develop, --ease-stamp, the shift's one stair on :root ... --
       which are cut with each movement (cut, shift). Treads under their own name would be read by
       nothing, and on the stage's head would stand in front of the next shift's. */
    var PLAYED_BY_A_RITE = /^(?:cut-in|cut-out|ink-in|lift-in|lift-out|underline-in|underline-out|rite-stamp|card-stamp|rite-shift)$/;

    /* A spell that ends has its treads rolled afresh on the element that played it -- the
       element's own style, recalculated alone -- so the next time it plays it plays another stair.
       A keyframes played in a rite's treads is left alone. */
    function onAnimationEnd(ev) {
      var name = ev && ev.animationName;
      var el = ev && ev.target;
      if (!name || !el || PLAYED_BY_A_RITE.test(name)) return;
      if (el === html || !el.style) return;
      spellOn(el, name);
    }

    /* ---- the cut: one movement's composition ---------------------------------------------- */

    /* The pieces a movement is composed of, chosen for this trigger: the family's stair with a
       rolled count and spacing of treads, a length rolled round its base, and the shape's
       parameters given by the reason for it (an angle for a slice, a point for a curve). Written
       on the element as --ease-<rite> and --motion-<rite> (and --cut-angle, --cut-x, --cut-y), and
       the length is handed back. `alias` writes the same treads under a second name, for a
       stylesheet that reads them by a spell of its own (an arrival's, arrive below). `treads`
       asks for an even stair of that many treads, two to five; `length` for exactly that many
       milliseconds, where the movement has to end with another (the veil's ghost with the last
       chip of the constellation). The composition is kept beside the element (lastCut), so a
       movement cut short can be read where it stood (the veil's, raiseGhost below). */
    var RITES = {
      wax: 'stair', wane: 'leave', stamp: 'flicker', ink: 'flicker', unink: 'flicker', seal: 'arrive',
      unseal: 'leave', develop: 'arrive', unmake: 'leave', reveal: 'stair', 'veil-out': 'wipe', veil: 'wipe'
    };

    var lastCut = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function cut(el, rite, options) {
      if (!el || !el.style || !rite) return 0;
      var opts = options || {};
      if (reduced() && !opts.always) return 0;
      var t = temperFor(el);
      var rnd = mulberry32(opts.seed == null ? entropy() : (opts.seed >>> 0));
      var family = opts.family || RITES[rite] || familyOf(rite);
      var curve;
      if (opts.treads) {
        var n = clamp(Math.round(opts.treads), 2, 5);
        curve = stairOf(spaced(n, between(rnd, 0.2, 0.34), between(rnd, 0.84, 0.92)), equal(n));
      } else {
        curve = makeCurve(family, t, Math.floor(rnd() * 0x7fffffff));
      }
      var base = opts.base || (current.durations && current.durations[opts.duration || 'medium']) || BASE_MS[family] || 320;
      var length = Math.round(base * (opts.base ? t.tempo : 1) * (0.85 + rnd() * 0.3));
      if (opts.length > 0) length = Math.round(opts.length);
      if (lastCut) lastCut.set(el, { rite: rite, curve: curve, length: length });
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

    /* ---- the state rites ------------------------------------------------------------------- */

    var PRESSABLE = 'a[href], button, input, select, textarea, summary, label, [role="button"], '
      + '[role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], '
      + '[role="menuitem"], [role="link"], [data-rite]';
    // The attributes a control is set by -- a chip pressed, a tab chosen, a knob set, a details
    // opened -- watched over the whole page so the seal plays whoever set it.
    var SET_ATTRS = ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'aria-expanded', 'open', 'data-set', 'data-selected', 'data-on', 'class'];
    var SET_CLASS = /(?:^|\s)(?:is-set|is-on|is-selected|is-active|is-chosen|is-current|is-open|is-lit|selected|active)(?:\s|$)/;
    /* What ends each passing rite: an animation named for it (`names`: a press's set-down, by
       whatever keyframes a stylesheet stamps with, or its ink), on whatever layer; or one matching
       `edge` on the one layer the rite is drawn on (`layer`: '' the element itself, '::before' a
       control's fill, '::after' its state layer). The edge's own keyframes are played by several
       rites on two layers at once -- a wax's cut-in on the state layer over a seal's on the fill,
       a wane's cut-out beside an unseal's -- so the layer is what says whose end it is; an arrival
       ends on the element itself (cut-in, lift-in, or an arrival of a stylesheet's own name),
       never on the ink of a press. Failing both, the clock. */
    var PASSING = {
      waning: { edge: /^cut-out$/, layer: '::after' },
      stamping: { names: /stamp|^ink-in$/ },
      uninking: { edge: /^cut-out$/, layer: '::after' },
      sealing: { edge: /^cut-in$/, layer: '::before' },
      unsealing: { edge: /^cut-out$/, layer: '::before' },
      dealt: { edge: /-in$/, layer: '' }
    };

    // Whether an animation (by its keyframes and the layer it plays on) is one a rite ends by.
    function endsRite(by, name, layer) {
      return !!(by && name && ((by.names && by.names.test(name)) || (by.edge && by.edge.test(name) && layer === by.layer)));
    }

    // How much later than its length a passing rite's animation may end: it starts on the frame
    // after its class goes on, and a busy page draws its frames late. The clock is the backstop
    // for an end that never comes, never the thing that ends a rite on time.
    var LATE = 250;

    var rites = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function riteState(el) {
      if (!rites) return null;
      var s = rites.get(el);
      if (!s) {
        s = { hover: false, focus: false, timers: {}, passes: {}, began: {}, from: {}, pressX: null, pressY: null, pressAt: 0 };
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

    // The rites that undo one another. A control is never both at once: the one begun ends the
    // other where it stands, so what shows is the gesture the visitor made last.
    var OPPOSED = { waxing: 'waning', waning: 'waxing', sealing: 'unsealing', unsealing: 'sealing', stamping: 'uninking' };

    // The moment the page's animations stand at. It holds still through a task (and its
    // microtasks) and moves on with each frame drawn, so a rite begun at the moment it still
    // reads has never been on screen.
    function frameNow() {
      var t = doc && doc.timeline ? doc.timeline.currentTime : null;
      return typeof t === 'number' ? t : null;
    }

    function began(el, kind) {
      var s = riteState(el);
      if (s) s.began[kind] = frameNow();
    }

    // Whether el carries a rite that began with no frame drawn since. Undone now, it was never
    // seen, and there is nothing to undo: the control is as it was before it, and stays so.
    function unseen(el, kind) {
      var s = rites && rites.get(el);
      var t = frameNow();
      return !!(s && t != null && s.began[kind] === t && el.classList && el.classList.contains('is-' + kind));
    }

    /* A rite that passes: the class goes on at once, so the very next frame drawn plays it, and
       comes off at the end of the animation it started or when the clock (`after`, the movement's
       own length where the caller knows it) says it must have ended, whichever is first. Passed
       again while it is still on -- a second press while the first still stamps -- it starts over
       where it stands: each animation the rite ends by, on the element or on one of its layers,
       is put back to its start and plays again in the treads just written (from the new press
       point, for a stamp). The class stays on throughout. Taking it off for a frame would not
       restart anything on a control held :active, whose rule plays the same stamp, and a seal
       taken off for a frame would show its fill whole for that frame. Nothing is left to a later
       frame, so a rite ended before it was drawn can never come back on; and each pass holds a
       token its clock must still match, so a clock left over from a rite started over or ended
       can never take a newer one off. */
    function pass(el, kind, after) {
      if (!el) return;
      var cls = 'is-' + kind;
      var s = riteState(el);
      if (OPPOSED[kind]) endPass(el, OPPOSED[kind]);
      var wait = after || ((ms('long') || 500) * 2 + 400);
      if (s && s.timers[kind] && typeof global.clearTimeout === 'function') global.clearTimeout(s.timers[kind]);
      if (el.classList && el.classList.contains(cls)) restart(el, PASSING[kind]);
      else {
        addClass(el, cls);
        began(el, kind);
      }
      // The moment this movement (or its start over) began, which its end is weighed against.
      if (s) s.from[kind] = frameNow();
      if (s && typeof global.setTimeout === 'function') {
        var token = {};
        s.passes[kind] = token;
        s.timers[kind] = global.setTimeout(function () {
          if (s.passes[kind] === token) endPass(el, kind);
        }, wait);
      }
    }

    // Each animation a rite ends by, on el itself or on its ::before or ::after, back to its
    // start. Asking for them works out el's style once, with the treads just written on it.
    function restart(el, by) {
      if (!by || typeof el.getAnimations !== 'function') return;
      var all;
      try {
        all = el.getAnimations({ subtree: true });
      } catch (e) {
        return;
      }
      for (var i = 0; i < all.length; i++) {
        var effect = all[i].effect;
        if (!effect || effect.target !== el) continue;
        if (endsRite(by, all[i].animationName, effect.pseudoElement || '')) all[i].currentTime = 0;
      }
    }

    function endPass(el, kind) {
      var s = rites && rites.get(el);
      var on = !!(el && el.classList && el.classList.contains('is-' + kind));
      if (s) {
        delete s.passes[kind];
        delete s.began[kind];
        delete s.from[kind];
        if (s.timers[kind] && typeof global.clearTimeout === 'function') global.clearTimeout(s.timers[kind]);
        s.timers[kind] = 0;
      }
      dropClass(el, 'is-' + kind);
      if (on && kind === 'stamping') inkOut(el);
    }

    /* A press is over. Under the pointer (or the focus) its ink gives way to the state layer the
       wax has cut in; with nothing on the control -- a tap on a touch screen, a key pressed on a
       control the pointer is not over -- the ink goes back the way it grew: the same curve,
       stepping in to the point the press landed (is-uninking), never switched off at once and
       never handed to a layer the control does not wear. */
    function inkOut(el) {
      if (reduced() || !el.classList || el.classList.contains('is-waxing')) return;
      var length = cut(el, 'unink', { base: 170 });
      pass(el, 'uninking', length && length + LATE);
    }

    // How much sooner than its own length an end may come and still be the movement playing now:
    // a frame's rounding, no more.
    var SLACK = 4;

    /* An animation's end ends the rite it belongs to, unless it is the end of an older movement.
       Undo a rite and begin it again within a frame or two -- unset and set, leave and come back
       and leave -- and the first movement's cancel is reported a frame after the second has
       started; press again as a stamp finishes and its end is reported after the stamp was put
       back to its start. Either, taken as the rite's, would take the class off the newer movement
       half-way. The moment the movement began says which it is, with no question put to the page:
       an end or a cancel that ran longer than the time since the movement began belongs to one
       before it, and an end that ran no longer is the movement's own. Only a cancel that could be
       either -- the movement before it was undone within a frame of starting -- and a page that
       keeps no clock of its animations ask the page what is still playing, which brings its style
       up to date. */
    function onRiteEnd(ev) {
      var el = ev && ev.target;
      var name = ev && ev.animationName;
      if (!el || !name || !el.classList) return;
      var layer = ev.pseudoElement || '';
      var older = null;
      for (var kind in PASSING) {
        if (!Object.prototype.hasOwnProperty.call(PASSING, kind) || !el.classList.contains('is-' + kind)) continue;
        if (!endsRite(PASSING[kind], name, layer)) continue;
        if (older === null) older = olderEnd(ev, el, kind, name, layer);
        if (!older) endPass(el, kind);
      }
    }

    function olderEnd(ev, el, kind, name, layer) {
      var s = rites && rites.get(el);
      var from = s ? s.from[kind] : null;
      var t = frameNow();
      var ran = typeof ev.elapsedTime === 'number' ? ev.elapsedTime * 1000 : NaN;
      if (typeof from === 'number' && t != null && isFinite(ran)) {
        if (t - from + SLACK < ran) return true;
        if (ev.type !== 'animationcancel') return false;
      }
      return stillPlaying(el, name, layer);
    }

    // Whether keyframes of this name are playing on this layer of el (its own, or a ::before or
    // ::after of it): the fallback where the page keeps no clock of its animations.
    function stillPlaying(el, name, layer) {
      if (typeof el.getAnimations !== 'function') return false;
      var all;
      try {
        all = layer ? el.getAnimations({ subtree: true }) : el.getAnimations();
      } catch (e) {
        return false;
      }
      for (var i = 0; i < all.length; i++) {
        var a = all[i];
        var effect = a.effect;
        if (!effect || effect.target !== el || (effect.pseudoElement || '') !== layer || a.animationName !== name) continue;
        if (a.playState === 'running' || a.playState === 'paused') return true;
      }
      return false;
    }

    /* The slice a pointer brings in: square to the side of the control the pointer crossed, and
       sweeping from that side across (0deg sweeps upward, 90deg rightward). The side is the one
       the pointer's own way in passes through: the line of its last step (from where it was to
       where it is now), traced back from where it is until it leaves the control's box. So a pill
       four times wider than tall entered from above is cut from above however near its end, one
       entered from beside it from beside it, and a rounded end entered on the slant from its
       corner -- the line is traced through the box, not only the part of it the pointer has
       already been over. A pointer with no last step to go by (the first anyone has seen of it)
       takes the side nearest to it in pixels. Only a way in within a few pixels of a corner
       tilts the slice toward the side beside it, in steps of 15 degrees, up to the diagonal at
       the corner itself. A key brings none: the register's own angle stands. */
    var CORNER = 6; // px
    var TOP = 180;
    var RIGHT = 270;
    var BOTTOM = 0;
    var LEFT = 90;
    function approach(el, ev, fromX, fromY) {
      if (!ev || typeof ev.clientX !== 'number' || typeof el.getBoundingClientRect !== 'function') return null;
      var box = el.getBoundingClientRect();
      var w = box.width;
      var h = box.height;
      if (!w || !h) return null;
      var x = clamp(ev.clientX - box.left, 0, w);
      var y = clamp(ev.clientY - box.top, 0, h);
      var dx = typeof fromX === 'number' ? ev.clientX - fromX : 0;
      var dy = typeof fromY === 'number' ? ev.clientY - fromY : 0;
      var side;
      var along; // where the way in meets that side, from the side's nearer end, in px
      var toward; // the side beside it at that end
      if (dx || dy) {
        // How far back along the step each side's line is; the nearest is the side crossed.
        var back = Infinity;
        if (dy > 0 && y / dy < back) { back = y / dy; side = TOP; }
        if (dy < 0 && (h - y) / -dy < back) { back = (h - y) / -dy; side = BOTTOM; }
        if (dx > 0 && x / dx < back) { back = x / dx; side = LEFT; }
        if (dx < 0 && (w - x) / -dx < back) { back = (w - x) / -dx; side = RIGHT; }
        var cx = clamp(x - dx * back, 0, w);
        var cy = clamp(y - dy * back, 0, h);
        if (side === TOP || side === BOTTOM) {
          along = Math.min(cx, w - cx);
          toward = cx < w / 2 ? LEFT : RIGHT;
        } else {
          along = Math.min(cy, h - cy);
          toward = cy < h / 2 ? TOP : BOTTOM;
        }
      } else {
        var sides = [[y, TOP], [w - x, RIGHT], [h - y, BOTTOM], [x, LEFT]];
        sides.sort(function (p, q) { return p[0] - q[0]; });
        side = sides[0][1];
        var beside = sides[1][1] === (side + 180) % 360 ? sides[2] : sides[1];
        along = beside[0];
        toward = beside[1];
      }
      var tilt = Math.round(clamp(1 - along / CORNER, 0, 1) * 3) * 15;
      var turn = ((toward - side + 540) % 360) - 180;
      return ((side + (turn > 0 ? tilt : -tilt)) % 360 + 360) % 360;
    }

    function wax(el, ev) {
      if (!el) return;
      // Waxed already (hovered, and now focused too): it stays as it is. Cut again partway, its
      // edge would turn and its treads change under it.
      var waxed = !!(el.classList && el.classList.contains('is-waxing'));
      // Turned back before it landed and met again on the way: it turns round once more, from
      // where its edge stands.
      if (waxed && turnRound(el, false)) return;
      if (!waxed) {
        var st = riteState(el);
        if (st) st.turning = null;
      }
      // The side the pointer crossed, read before anything is written: the box is measured in the
      // style the page already has, and the writes below land in one style pass after it.
      var angle = waxed || reduced() ? null : approach(el, ev, fromX, fromY);
      endPass(el, 'waning');
      endPass(el, 'uninking');
      if (waxed) return;
      // The treads first, then the class: whatever steps beside the slice in the class's own
      // style pass (a link's underline, the logo's name) reads this wax's stair, not the last.
      if (!reduced()) {
        if (angle == null && el.style && typeof el.style.removeProperty === 'function') el.style.removeProperty('--cut-angle');
        cut(el, 'wax', { angle: angle });
      }
      addClass(el, 'is-waxing');
      began(el, 'waxing');
    }

    // A wax undone before a frame drew it leaves nothing to cut back out. One undone before it
    // had landed goes back the way it came, from where its edge stands, down the same treads: the
    // one movement turned round, rather than the whole layer shown and a second edge cut from it.
    function wane(el) {
      if (!el || !el.classList || !el.classList.contains('is-waxing')) return;
      var never = unseen(el, 'waxing');
      if (!never && turnRound(el, true)) return;
      dropClass(el, 'is-waxing');
      if (never) return;
      var length = cut(el, 'wane');
      pass(el, 'waning', length && length + LATE);
    }

    // What a wax plays on the control and its layers: the slice, and a link's underline beside it.
    var WAXES = /^(?:cut-in|underline-in)$/;

    /* Turns a wax still in flight round: back (`back`) from where it stands, its class taken off
       when it is back at the start; or forward again, when the pointer returns before it is. A wax
       that has landed is not in flight, and is left to wane as it always does. Answers whether it
       turned anything. */
    function turnRound(el, back) {
      var s = riteState(el);
      if (!s) return false;
      if (!back) {
        var turning = s.turning;
        if (!turning) return false;
        s.turning = null;
        for (var i = 0; i < turning.length; i++) {
          try { turning[i].playbackRate = 1; turning[i].onfinish = null; } catch (e) { /* gone */ }
        }
        return true;
      }
      if (s.turning || typeof el.getAnimations !== 'function') return !!s.turning;
      var all;
      try {
        all = el.getAnimations({ subtree: true });
      } catch (e) {
        return false;
      }
      var flight = [];
      for (var j = 0; j < all.length; j++) {
        var a = all[j];
        if (!a.effect || a.effect.target !== el || !WAXES.test(a.animationName || '') || a.playState !== 'running') continue;
        flight.push(a);
      }
      if (!flight.length) return false;
      s.turning = flight;
      var left = flight.length;
      var home = function () {
        left -= 1;
        if (left > 0 || s.turning !== flight) return;
        s.turning = null;
        dropClass(el, 'is-waxing');
      };
      for (var k = 0; k < flight.length; k++) {
        try {
          flight[k].onfinish = home;
          flight[k].playbackRate = -1;
        } catch (e) {
          home();
        }
      }
      return true;
    }

    /* Only a pointer that moves is a hover. A finger is not one at all: a tap is a press, and a
       touch screen leaves the control it tapped :hover until something else is touched. And a
       page that moves under a pointer standing still -- a wheel, the engine's own scrollTo
       carrying the page up to the stage, a box laid out afresh -- passes control after control
       under it, and the browser reports each as entered and left though the visitor did nothing:
       an entry with the pointer where it already was is the page's movement, not the visitor's,
       and waxes nothing. The pointer's next move to a new place waxes what it is over. A control
       that was waxed before the page moved still wanes when the page carries it away from the
       pointer: that leaving is real, and it is the only one. */
    var still = true; // the pointer has come to be over something without moving there
    var pointerX = null;
    var pointerY = null;
    var fromX = null; // where it was before its last step: the line of its way in (approach, above)
    var fromY = null;

    // Whether the pointer is somewhere new, remembering where it is and where it was.
    function placed(ev) {
      var moved = ev.clientX !== pointerX || ev.clientY !== pointerY;
      if (moved) {
        fromX = pointerX;
        fromY = pointerY;
      }
      pointerX = ev.clientX;
      pointerY = ev.clientY;
      return moved;
    }

    function onMove(ev) {
      if (ev.pointerType === 'touch' || !placed(ev) || !still) return;
      still = false;
      hover(ev);
    }

    function onOver(ev) {
      if (ev.pointerType === 'touch') return;
      if (!placed(ev)) {
        still = true;
        return;
      }
      still = false;
      hover(ev);
    }

    function hover(ev) {
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
      if (ev.pointerType === 'touch') return;
      // Gone from the window: where it was is no start for its way back in, which may be anywhere.
      if (!ev.relatedTarget) pointerX = pointerY = null;
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
      // A key held down repeats itself; it is still the one press, and stamps once.
      if (ev.repeat) return;
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
      // The set-down and the ink are one gesture: one seed, so the two step in the same treads
      // over the same length and end together, and neither is cut short by the other's end.
      var seed = entropy();
      var length = cut(el, 'stamp', { base: 170, x: px, y: py, seed: seed });
      cut(el, 'ink', { base: 170, seed: seed });
      pass(el, 'stamping', length ? length + LATE : (ms('medium') || 320) + 400);
    }

    function isSet(el, attr) {
      if (attr === 'class') return SET_CLASS.test(typeof el.className === 'string' ? el.className : '');
      var v = el.getAttribute(attr);
      if (v == null || v === 'false') return false;
      if (attr === 'aria-expanded') return v === 'true';
      return true;
    }

    /* Where a set control's curve sits: round the point it was pressed at, if it was pressed a
       moment ago. A control set by anything else -- a tap in the scene, a hint, the page coming
       back as it was left -- has no press to show, so every one of them seals from the one point
       a hand starts a line of writing from, low at the left (18% 82%, the stylesheet's own), and
       controls set the same way rest alike. */
    function dress(el) {
      if (!el || !el.style) return;
      var s = riteState(el);
      var pressed = !!(s && s.pressAt && now() - s.pressAt < 1500);
      setInline(el, '--seal-x', (pressed ? s.pressX : 18) + '%');
      setInline(el, '--seal-y', (pressed ? s.pressY : 82) + '%');
    }

    // Whether an attribute's value, as a change record kept it, said the control was set.
    function wasSet(attr, value) {
      // The engine's own passing classes come and go in the class too; only a set class counts.
      if (attr === 'class') return SET_CLASS.test(value || '');
      return value != null && value !== 'false' && (attr !== 'aria-expanded' || value === 'true');
    }

    /* A control is sealed when it goes from unset to set, and unsealed the other way, judged
       from what it was before the whole batch of changes to what it is after them. A group that
       clears every option and then sets the chosen one leaves the option pressed again exactly
       as it was: two records, false then true, and no change a visitor could see, so nothing
       plays. Only the first record of an attribute on an element holds the value from before
       the batch; the rest are steps within it. A change undone in a later batch of the same
       task (a script that awaits between the two) is caught by the moment instead: the rite it
       began was never drawn, so it ends and nothing plays in its place. And a rite already
       playing is never begun again from here: the only way to reach it is a second attribute
       saying what the first said, and starting the seal over would put its fill back to nothing
       partway in. */
    function onSetChange(changes) {
      var seen = typeof global.Map === 'function' ? new global.Map() : null;
      for (var i = 0; i < changes.length; i++) {
        var c = changes[i];
        var el = c.target;
        var attr = c.attributeName;
        if (!el || !attr || !el.classList) continue;
        if (seen) {
          var attrs = seen.get(el);
          if (!attrs) {
            attrs = {};
            seen.set(el, attrs);
          }
          if (attrs[attr]) continue;
          attrs[attr] = true;
        }
        var was = wasSet(attr, c.oldValue);
        var is = isSet(el, attr);
        if (was === is) continue;
        if (el.getAttribute('data-rite') === 'none') continue;
        // A dialog's open is its own arrival, not a control becoming set.
        if (attr === 'open' && el.tagName === 'DIALOG') continue;
        // A seal and an unseal end each other, as a wax ends a wane: set and unset within one
        // moment is the one the visitor left it in. The one undone ends here even when nothing
        // is to play (a visitor who asked for less motion), so the two are never on together;
        // undone before a frame drew it, it leaves the control as it was, with nothing to play.
        var undone = is ? 'unsealing' : 'sealing';
        var never = unseen(el, undone);
        endPass(el, undone);
        if (never) continue;
        var kind = is ? 'sealing' : 'unsealing';
        if (el.classList.contains('is-' + kind)) continue;
        if (is) dress(el);
        if (reduced()) continue;
        var length = is ? cut(el, 'seal', { duration: 'long' }) : cut(el, 'unseal');
        pass(el, kind, length && length + LATE);
      }
    }

    function watchStates() {
      doc.addEventListener('pointerover', onOver, true);
      doc.addEventListener('pointerout', onOut, true);
      doc.addEventListener('pointermove', onMove, { capture: true, passive: true });
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
       steps across the element, a tread to each word (two to five of them, the words run together
       past five), each tread as wide as its words are long, so the edge comes to rest in the gaps.
       The element is never taken apart: no span, no sigil, one mask and one animation
       (_sass/_rite.scss, .is-revealing). A visitor who asked for less motion is shown the words.

       Several lines that are one thing -- a box's question and the line under it -- are one
       gesture when each is given the same `seed` and `length`: the same number of treads at the
       same moments over the same length, every line's edge resting in its own gaps. `treads`
       asks for that many (two to five); `curve` (a stair of this engine's, m.curve()) and
       `length` (ms) cut the line in exactly so, which is how a change of mood cuts every line on
       the page in one stair (shift). Hands back a function that ends the rite early. */

    var revealing = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    // A stair handed in: a Curve of this engine's, or the { stops } m.curve() hands out.
    function curveFrom(given) {
      if (!given) return null;
      if (given instanceof Curve) return given;
      var stops = given.stops;
      if (!stops || !stops.length || stops[0].length !== 2) return null;
      return new Curve(stops);
    }

    // The moments of a line's treads where its words break: the n - 1 gaps nearest to even
    // shares of its letters, or an even share itself where a word is too long to break at.
    function treadsOfWords(words, n) {
      var total = 0;
      for (var w = 0; w < words.length; w++) total += words[w].length + (w ? 1 : 0);
      var gaps = [];
      var acc = 0;
      for (var g = 0; g < words.length - 1; g++) {
        acc += words[g].length + (g ? 1 : 0);
        gaps.push((acc + 0.5) / total);
      }
      var rises = [];
      var last = 0;
      for (var k = 1; k < n; k++) {
        var aim = k / n;
        var best = null;
        for (var i = 0; i < gaps.length; i++) {
          if (gaps[i] <= last + 0.02 || gaps[i] >= 0.98) continue;
          if (best === null || Math.abs(gaps[i] - aim) < Math.abs(best - aim)) best = gaps[i];
        }
        var at = best !== null && Math.abs(best - aim) < 0.5 / n ? best : clamp(aim, last + 0.02, 0.98);
        rises.push(at - last);
        last = at;
      }
      rises.push(1 - last);
      return rises;
    }

    function reveal(el, options) {
      if (!el || !el.style || !el.classList) return function () {};
      var opts = options || {};
      var before = revealing && revealing.get(el);
      if (before) before();
      if (reduced() && !opts.always) return function () {};
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return function () {};
      var words = text.split(' ');
      var rnd = mulberry32(opts.seed == null ? entropy() : (opts.seed >>> 0));
      var curve = curveFrom(opts.curve);
      if (!curve) {
        // The count: asked for, or one for every line of a seed, or the line's own words.
        var n = opts.treads ? clamp(Math.round(opts.treads), 2, 5)
          : opts.seed != null ? 2 + Math.floor(rnd() * 3) : clamp(words.length, 2, 5);
        curve = stairOf(spaced(n, between(rnd, 0.06, 0.14), between(rnd, 0.84, 0.92)), treadsOfWords(words, n));
      }
      var t = temperFor(el);
      var length = opts.length > 0 ? Math.round(opts.length)
        : Math.round(clamp(text.length * 16, 220, 820) * t.tempo * (opts.pace ? clamp(opts.pace / 0.42, 0.5, 1.6) : 1));
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
       and under no pointer, that the stylesheet cuts away (.is-ghost, _sass/_lightbox.scss) and
       that goes when the animation ends. The ghost goes from where the veil had got to, not from
       the whole of it: the veil's coverage as it was hidden is written on the ghost as --cut-from
       (the keyframes' first stop), so a veil closed while it was still rising is taken back from
       there, and one closed before any of it was drawn leaves no ghost at all -- there is nothing
       to take away, and a ghost raised from the whole veil would be a blink of a dimmed page
       nobody asked for. Where the veil's going has a length to keep (data-leave-ms, written by
       js/site.js when the constellation's chips leave with it), the ghost takes exactly that
       long, so the veil and the last chip go together. Raised again before the ghost has gone,
       the veil takes its place back and the ghost goes at once. */

    var ghost = null;
    var ghostTimer = 0;
    var veilRise = null; // the veil's rising, once its start is reported: the animation, and when

    function dropGhost() {
      if (ghostTimer && typeof global.clearTimeout === 'function') global.clearTimeout(ghostTimer);
      ghostTimer = 0;
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    /* How far the veil had risen as it was hidden, 0 to 1. Read first, before anything brings
       the page's style up to date: the style the veil was hidden in has not been worked out yet,
       so its rising is still running and says how far it has played, where the veil's own --cut,
       read now, would be the hidden veil's -- nothing at all. The coverage is the rise's own stair
       at that moment: the treads js/site.js had the engine cut for this rising (lastCut), or the
       page's roll behind them. A rising whose start has not been reported has drawn nothing: the
       browser reports an animation's start before the frame after the one it started in, and
       that one frame drew the stair where it begins, held at nothing -- however long the frame
       took (a blur the size of the window can take a long one), so the time since the veil went
       up says nothing of how far it got. A rising that started before anything was watching is
       taken back whole. */
    function veilReached(veil) {
      if (!veilRise) return 0;
      var played = null;
      if (veilRise.anim) {
        try {
          played = veilRise.anim.currentTime;
        } catch (e) {
          played = null;
        }
      }
      var t = frameNow();
      if (typeof played !== 'number' && typeof veilRise.start === 'number' && t != null) played = t - veilRise.start;
      if (typeof played !== 'number') return 1;
      var made = lastCut && lastCut.get(veil);
      var curve = made && made.rite === 'veil' ? made.curve : current.curves.wipe;
      var length = made && made.rite === 'veil' ? made.length : ms('medium') || 340;
      if (!curve || !(length > 0)) return 1;
      return clamp(curve.at(played / length), 0, 1);
    }

    function raiseGhost(veil) {
      var reached = veilReached(veil);
      var leave = veil.getAttribute ? Number(veil.getAttribute('data-leave-ms')) : 0;
      if (veil.removeAttribute) veil.removeAttribute('data-leave-ms');
      veilRise = null;
      dropGhost();
      if (reduced() || !(reached > 0) || !veil.parentNode || typeof veil.cloneNode !== 'function') return;
      ghost = veil.cloneNode(false);
      ghost.removeAttribute('id');
      ghost.removeAttribute('hidden');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      ghost.className = (veil.className ? veil.className + ' ' : '') + 'is-ghost';
      ghost.style.pointerEvents = 'none';
      ghost.style.setProperty('--cut-from', Math.round(reached * 1000) / 10 + '%');
      var length = cut(ghost, 'veil-out', leave > 0 ? { length: leave } : null);
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
      // Up before anything watched it: its rising was never seen to start, and is taken back whole.
      if (shown) veilRise = { anim: null, start: null };
      // The veil's rising, caught as it starts: once per rising, at a moment its style is worked
      // out already, so the question costs nothing. A browser that cannot name the animation has
      // it reckoned from now, a frame late at most.
      veil.addEventListener('animationstart', function (ev) {
        if (ev.target !== veil || ev.pseudoElement) return;
        var rise = { anim: null, start: frameNow() };
        try {
          var all = typeof veil.getAnimations === 'function' ? veil.getAnimations() : [];
          for (var i = 0; i < all.length; i++) {
            if (all[i].animationName === ev.animationName) {
              rise.anim = all[i];
              rise.start = all[i].startTime;
              break;
            }
          }
        } catch (e) {
          /* reckoned from now */
        }
        veilRise = rise;
      });
      try {
        new global.MutationObserver(function () {
          var up = !veil.hidden;
          if (up) {
            dropGhost();
            if (!shown) veilRise = null;
          } else if (shown) raiseGhost(veil);
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

    /* Things changing places move from where they were to where they are in three to five held
       treads, the landing's (never a slide): flip(container, change) measures, runs change(), measures again and
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
       Two to five treads, as every movement here takes: `treads` asks for a number of them within
       that. Hands back a function that stops it. */
    function stepper(options) {
      var opts = options || {};
      var total = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = frameOf();
      var cancel = cancelOf();
      var rnd = mulberry32(entropy());
      var n = clamp(Math.round(opts.treads || (3 + Math.floor(rnd() * 3))), 2, 5);
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

    function geometryFor(seed, el) {
      return rollGeometry(mulberry32(seed == null ? entropy() : (seed >>> 0)));
    }

    /* An arrival of an element's own: where it comes from (a clear direction), the slice it comes
       in behind (the direction it travels) and its stair, from a seed, written on the element as
       the develop rite's treads -- and again under `spell`, for a stylesheet that reads the
       arrival by a name of its own (stage-in, avatar-in). Then the class the stylesheet plays
       (is-dealt, or the one given). Hands back a function that takes the inline roll off again. */
    function arrive(el, options) {
      if (!el || !el.style) return function () {};
      var opts = options || {};
      var seed = opts.seed == null ? entropy() : (opts.seed >>> 0);
      var rnd = mulberry32(seed);
      var g = rollGeometry(rnd);
      var spell = opts.spell && opts.spell !== 'develop' ? opts.spell : null;
      var names = ['--arrive-x', '--arrive-y', '--arrive-angle', '--ease-develop', '--motion-develop'];
      if (spell) names.push('--ease-' + spell, '--motion-' + spell);
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
       The roll is made again under it (the one :root write after the page loads), in the same
       style pass as the change itself. Then the change is cut in by ONE slice in ONE stair: a
       stair of the shift family, whose first tread is taken at once -- the words already standing
       on the page are never blank for a held tread -- rolled once for the whole shift, with one
       length, and written on :root as --ease-rite-shift and --motion-rite-shift for everything
       the stylesheets cut on a shift (the stage's head, _sass/_mood.scss; the wearers of
       type.rite($shift), _sass/_type.scss) and handed to every line cut here (reveal): a page's
       heading, a section's and a panel's title. The palette and the faces change at the slice's
       first tread, which is the shift's first frame, and the register's axes, size and spacing
       land at once under it: nothing of the shift steps on a stair of its own. Not the stage's
       title: the stage's head is cut whole, title and all, and a second edge on the same words
       would be two changes on one thing. Not as the page arrives (the reading lands a moment
       after the first paint), and not for less motion. */
    function shift() {
      rollAll();
      if (!html || typeof html.setAttribute !== 'function') return;
      var token = ++shiftToken;
      if (reduced() || now() - bootAt < 900) {
        html.removeAttribute('data-shifting');
        return;
      }
      var stair = makeCurve('shift', temper, entropy() & 0x7fffffff);
      var length = (current.durations && current.durations.shift) || BASE_MS.shift;
      write('--ease-rite-shift', cssOf(stair));
      write('--motion-rite-shift', length + 'ms');
      html.setAttribute('data-shifting', '');
      if (typeof doc.querySelectorAll === 'function') {
        try {
          var words = doc.querySelectorAll('.list-page-main > h1, .prose-main > h1, .section-title, .panel-title');
          for (var w = 0; w < words.length; w++) reveal(words[w], { curve: stair, length: length });
        } catch (e) {
          /* a page with none of them */
        }
      }
      if (typeof global.clearTimeout === 'function' && shiftTimer) global.clearTimeout(shiftTimer);
      if (typeof global.setTimeout === 'function') {
        shiftTimer = global.setTimeout(function () {
          if (token === shiftToken) html.removeAttribute('data-shifting');
        }, length + 80);
      }
    }

    function watch() {
      if (!doc || typeof doc.addEventListener !== 'function') return;
      doc.addEventListener('animationend', onAnimationEnd, true);
      watchStates();
      // The engine plays the hover, the focus and the press from here on: the stylesheets'
      // :hover, :focus-visible and :active rules for a page with no script stand aside.
      if (html && typeof html.setAttribute === 'function') html.setAttribute('data-cut', '');
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

    /* A tween: step(y, t) with y on the treads of a stair rolled for it (its family's, or an even
       one of `treads`, two to five) and t the plain progress, each frame for `ms`, then done().
       Hands back a function that stops it. */
    function tween(options) {
      var opts = options || {};
      var length = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = frameOf();
      var cancel = cancelOf();
      if (!raf || !length || (reduced() && !opts.always)) {
        step(1, 1);
        done();
        return function () {};
      }
      var at;
      if (opts.treads) {
        var rnd = mulberry32(entropy());
        var n = clamp(Math.round(opts.treads), 2, 5);
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
      var treads = opts.treads || clamp(Math.round(distance / 220), 3, 5);
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
      cut: cut,
      reveal: reveal,
      flip: flip,
      stepper: stepper,
      rite: rite,
      wax: wax,
      wane: wane,
      seal: dress,
      arrive: arrive,
      deal: deal,
      geometryFor: geometryFor,
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
      return rollGeometry(mulberry32(seed == null ? entropy() : seed));
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
