/*
  The motion of the rite (README: "Motion axiom"). Nothing on this site moves along a standard
  curve. No transition and no animation -- a fade, a slide, a wipe, a colour shifting, a ring
  opening, a chip branching out, the page scrolling -- is eased by `linear`, by `ease` and its
  three siblings, or by any cubic-bezier, and nothing in a script tweens along a polynomial it
  wrote itself. Every movement runs along a curve this file rolled a moment ago and will never
  roll again: a procedurally generated glitch of a curve, with a hesitation before it starts, a
  stutter in the middle, an overshoot it has to settle from, a flicker before it lands -- so every
  movement feels like part of a working rather than a widget settling into place, deliberate and
  never twice the same. Where a thing moves from, how far, which way a wipe travels and what tone a
  background passes through on its way to another are rolled here too, so the geometry of a
  movement is as much the roll's as its timing.

  How it reaches the stylesheets. CSS cannot roll a die, but it can read a custom property, and
  the `linear()` easing function can express any piecewise curve at all. So this file writes the
  curves onto :root as custom properties and _sass/_tokens.scss points every timing function at
  them -- with a baked procedural curve as each one's fallback, so a page with no script still
  moves along a glitch and never along a standard formula:

      --ease-arrive     a thing coming in: a fade and a slide into place, with overshoot
      --ease-leave      a thing going away: a flicker, a refusal, then the rush out
      --ease-shift      a state changing where it stands: colour, size, opacity, a bar filling
      --ease-flicker    the quick ones: a state layer, a dot lighting, a name fading in beside a mark
      --ease-pulse      one beat of a thing that breathes (the beckoning persona)
      --ease-drift      the slow turn of a ring: nearly even, with a catch now and then
      --ease-wipe       the veil: a lag, then the swallow, then a blink
      --ease-<spell>    one per @keyframes name (stage-in, card-in, lightbox-veil, ...), rolled
                        afresh every time that animation finishes, so the next time it plays it
                        plays differently; the family above is each one's fallback
      --motion-short, --motion-medium, --motion-long, --motion-slow, --motion-stagger,
      --motion-shift    the durations, rolled with a little jitter and scaled by the tempo
      --arrive-x, --arrive-y, --arrive-rot, --arrive-scale, --arrive-skew
      --leave-x, --leave-y, --leave-rot, --leave-scale
                        where arriving content comes from and where leaving content goes
      --wipe-from, --wipe-to
                        the shape the veil wipes in from, and the shape it ends on
      --state-from      the edge a control's state layer sweeps in from
      --shift-x, --shift-skew, --shift-blur
                        how far the rite's words are thrown as the site changes its modality
      --sky-x, --sky-y  where the page's own sky washes in from (main's gradient)
      --lift-y, --lift-rot, --spark-extra, --pop-over, --shake-x, --beckon-spread, --reject-grow,
      --ray-from        the small particulars of one movement each, named where they are used
      --matte-1 .. --matte-5
                        the matte ladder: five masks at rising coverage, procedurally generated
                        (a noise field thresholded, a scatter of shards, scan lines, a dither, an
                        iris, a grain), so a surface that changes changes by its area and never
                        by a fade -- a hover arrives tread by tread through them
      --matte-fill, --matte-fill-size, --matte-kind, --matte-top
                        the texture a surface that stays changed (pressed, selected, set) is
                        filled with, in the colour of its text; the kind of matte rolled (also
                        <html data-matte>); and the top of the ladder, the same texture as a
                        mask, so a surface that has arrived rests patterned and never flat
      --motion-<spell>  one length per @keyframes name, rolled beside its curve
      --ease-ratchet    how anything turns: teeth, a slip back, a hold, never an even rotation

  Every movement is composed anew on its trigger (the composer, below): a rite is a whole put
  together from pieces each chosen at random from a vocabulary -- an opening, a climb, a landing;
  a dip, a flash, a return; an approach, an overshoot, a hesitation -- with uneven treads, written
  as a @keyframes rule of its own and named on the element (--rite-wax, --rite-wane, --rite-stamp,
  --rite-ink, --rite-seal, --rite-unseal, --rite-develop, --rite-unmake, --rite-veil-out), so the
  same hover on the same button is never the same twice. The named keyframes in the stylesheets
  are what a page with no script plays.

  How a control changes (README: "Motion axiom"). Nothing fades. A control under the pointer or
  the focus waxes -- is-waxing, its changed surface arriving through the matte ladder -- and when
  they leave it wanes (is-waning); a press stamps it (is-stamping); one that becomes set is sealed
  (is-sealing) and one unset is unsealed (is-unsealing). This file puts the classes on, reading
  the pointer, the keyboard, the focus and every attribute a control is set by, and takes each
  passing one off again when its animation ends; _sass/_controls.scss says what each looks like.
  Words arriving are revealed glyph by glyph through a sigil (reveal, below); the veil leaves as
  a ghost that plays out (the ghost veil); things that change places move there (flip).

  How it reaches the scripts. window.interestingMotion is the same roll offered as functions, for
  the movements only a script can make: the theme's crossfade, the burst, a scroll, the mark that
  flies home to the persona.

      var m = window.interestingMotion;
      m.ease('arrive')            // a function t -> y along a curve rolled for this call alone
      m.curve('leave')            // { css, stops, at(t) }: the curve as CSS and as arithmetic
      m.tween({ ms: 400, family: 'shift', step: function (y, t) { ... }, done: function () {} })
      m.scrollTo(top)             // the page scrolls there along a rolled curve
      m.scrollIntoView(el, { block: 'center' })
      m.ms('long')                // the duration the stylesheet is using right now, in ms
      m.geometry()                // the rolled geometry, as numbers
      m.stagger(k)                // the k-th of a scatter's delay, with its own jitter, in ms
      m.shift()                   // the site is changing its modality: flicker the rite's words
      m.roll()                    // roll everything again now
      m.reveal(el, { scramble })  // the words of el arrive glyph by glyph, each through sigils
      m.flip(list, change)        // run change(); every child of list that moved jumps there in treads
      m.stepper({ ms, treads, step(k, n, slipping), done })
                                  // a movement in treads: step is called with each tread reached
      m.rite(el, 'stamping')      // one passing rite on el, by the name of its class is-<name>
      m.wax(el) / m.wane(el)      // el under the pointer, and the pointer leaving it
      m.seal(el)                  // dress el in a fill texture of its own (done on its own when set)
      m.compose('wax')            // a @keyframes rule composed from pieces, by name; m.composeOn(el,
                                  // kind, fallback, ms) writes it on el as --rite-<kind>
      m.arrive(el, { seed, spell, mattes })
                                  // a geometry, a curve and a ladder of el's own, written on it
      m.deal(el, { spells })      // pin the page's roll on el while it waits in its delay
      m.mattes()                  // the matte ladder and the fill, as the strings that were written
      m.geometryFor(seed, el) / m.ladderFor(seed, el) / m.temperFor(el)
                                  // a roll of an element's own, not written anywhere
      m.reduced                   // true for a visitor who asked for less motion

  When it rolls. Everything is rolled once as the <head> is read, so the first paint already
  moves along a curve of its own. After that: every transition that ends re-rolls the transition
  families for the next one (a running transition keeps the curve it started with, so nothing in
  flight is disturbed); every animation that ends re-rolls its own spell once no animation of that
  name is still running, and an animation that loops re-rolls its spell at each iteration; every
  press, key and focus re-rolls the quick families just before the movement it is about to cause;
  the geometry is re-rolled whenever nothing is in flight; a page left alone re-rolls itself every
  so often, so its next movement is never the one it rolled a minute ago; and when the site changes
  what it is wearing -- <html data-world>, data-mood or data-featured -- the temperament is read
  again and everything is rolled to it.

  The temperament. Each mood of _sass/_mood.scss carries a temperament beside its palette and its
  typographic register: --motion-grain, how glitchy its movements are (0 is nearly smooth, 1 is a
  flickering film reel); --motion-tempo, how long they take (1 is the scheme's own pace, less is
  quicker); and --motion-steps, whether its curves prefer the staircase of a typewriter to the
  swoop of a brush. A restless world stutters and snaps; a tender one hesitates and drifts; the
  curious one steps. So a movement is customised twice over: by the mood of what is on the screen,
  and by the roll.

  Less motion asked for. The stylesheets answer prefers-reduced-motion themselves (every
  transition and animation is turned off there) and this file does the same for the movements it
  makes: a tween lands on its end at once, a scroll jumps, and the shift is the change without the
  flicker. The curves are still rolled, because a visitor who turns the setting off mid-visit
  should find the site moving its own way at once.

  A browser without linear(). Older browsers know no piecewise curve, so there the curves are
  rolled as steps(n, jump-...) -- a stair with a rolled number of treads, which is the one
  non-standard easing such a browser can be given -- and <html data-motion='steps'> says so.

  Nothing here reaches for the browser's storage, keeps score, or writes to the shared state
  document. It is loaded by _includes/layout.njk without `defer`, so it has rolled before the
  body is drawn and before any other script asks it for a curve. It touches nothing a stub
  browser lacks without asking first: every script of the shell runs in one of the harnesses
  under .github/scripts, and none of them loads this file, so every caller treats
  window.interestingMotion as optional.
*/
(function (global) {
  'use strict';

  /* ---- a seeded stream ------------------------------------------------------------------- */

  // mulberry32, the same small generator js/variant.js deals cards with. Seeded from entropy for
  // every roll, because a movement is meant to differ every time; the stream is here so one roll
  // is one draw from one stream rather than a scatter of Math.random calls, which keeps a curve
  // reproducible for the tests of the maker below.
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

  /* ---- the curve maker ------------------------------------------------------------------- */

  /* A curve is a list of stops, [t, y] with t from 0 to 1, rendered as linear() for the
     stylesheet and sampled by straight lines between the stops for a script. Every family starts
     at (0, 0) and ends at (1, 1); what happens between is the roll's. Two stops at the same t are
     a hard cut, which linear() renders as a jump and a script as the later value -- the one true
     glitch, used sparingly and only where the grain is high. */

  function Curve(stops) {
    this.stops = stops;
  }

  Curve.prototype.at = function (t) {
    var s = this.stops;
    if (t <= 0) return s[0][1];
    if (t >= 1) return s[s.length - 1][1];
    for (var i = 1; i < s.length; i++) {
      if (t <= s[i][0]) {
        var a = s[i - 1];
        var b = s[i];
        var span = b[0] - a[0];
        if (span <= 0) return b[1];
        return a[1] + (b[1] - a[1]) * ((t - a[0]) / span);
      }
    }
    return s[s.length - 1][1];
  };

  Curve.prototype.toCSS = function () {
    var parts = [];
    var s = this.stops;
    for (var i = 0; i < s.length; i++) {
      var y = Math.round(s[i][1] * 1000) / 1000;
      var t = Math.round(s[i][0] * 1000) / 10;
      parts.push(i === 0 ? String(y) : i === s.length - 1 ? String(y) : y + ' ' + t + '%');
    }
    return 'linear(' + parts.join(', ') + ')';
  };

  /* The ingredients, each a small gesture the families are composed of. `put` keeps t in order
     and inside the unit interval, so a gesture written past the end is folded back rather than
     left dangling. */
  function Maker(rnd, temper) {
    this.rnd = rnd;
    this.grain = temper.grain;
    this.steps = temper.steps;
    this.stops = [[0, 0]];
    this.t = 0;
    this.y = 0;
  }

  Maker.prototype.between = function (lo, hi) {
    return lo + (hi - lo) * this.rnd();
  };

  Maker.prototype.chance = function (p) {
    return this.rnd() < p;
  };

  Maker.prototype.put = function (t, y) {
    t = clamp(t, this.t, 0.995);
    this.stops.push([t, y]);
    this.t = t;
    this.y = y;
    return this;
  };

  // A hold: the thing stays where it is for a moment.
  Maker.prototype.hold = function (d) {
    return this.put(this.t + d, this.y);
  };

  // A rise (or a fall) from here to (t, y) along a bent line sampled at a few points: `bend` above
  // 1 is a swoop that arrives fast and settles, below 1 one that leaves slowly and rushes in.
  Maker.prototype.sweep = function (t, y, bend, n) {
    var t0 = this.t;
    var y0 = this.y;
    // A target already behind the pen (a stutter can push it there) is moved ahead of it, so a
    // sweep is always a sweep and never a stack of cuts at one instant.
    t = Math.max(t, t0 + 0.015 * n);
    for (var i = 1; i <= n; i++) {
      var s = i / n;
      var f = bend >= 1 ? 1 - Math.pow(1 - s, bend) : Math.pow(s, 1 / bend);
      this.put(t0 + (t - t0) * s, y0 + (y - y0) * f);
    }
    return this;
  };

  // A stutter: a hold, and with the grain high enough a small slip back before it goes on.
  Maker.prototype.stutter = function () {
    var d = this.between(0.015, 0.05) * (0.5 + this.grain);
    this.hold(d);
    if (this.chance(this.grain * 0.8)) {
      var slip = this.between(0.02, 0.09) * this.grain;
      this.put(this.t + d * 0.4, this.y - slip);
      this.put(this.t + d * 0.6, this.y + slip * 0.3);
    }
    return this;
  };

  // A flicker: a blink to a value and back, in a few hundredths of the time.
  Maker.prototype.flicker = function (to) {
    var y = this.y;
    var d = this.between(0.008, 0.02);
    this.put(this.t + d, to);
    this.put(this.t + d, y);
    return this;
  };

  // A settle: bounces of shrinking size round a value, which is how an overshoot is paid back.
  Maker.prototype.settle = function (y, amplitude, bounces, until) {
    var n = Math.max(1, bounces);
    // The bounces need room: a settle asked for right at the pen is spread a little past it,
    // never stacked on one instant as a three-way flicker in a single frame.
    until = Math.max(until, this.t + 0.03 * n);
    var span = until - this.t;
    for (var i = 1; i <= n; i++) {
      var sign = i % 2 ? -1 : 1;
      var a = amplitude * Math.pow(0.38, i);
      this.put(this.t + span / (n + 1), y + sign * a);
    }
    return this.put(until, y);
  };

  // A staircase: the typewriter's way from here to (t, y) in n uneven treads with sloped risers.
  Maker.prototype.stair = function (t, y, n) {
    var t0 = this.t;
    var y0 = this.y;
    var cuts = [];
    for (var i = 0; i < n - 1; i++) cuts.push(this.rnd());
    cuts.sort();
    var rises = [];
    var total = 0;
    for (var j = 0; j < n; j++) {
      var r = 0.4 + this.rnd();
      rises.push(r);
      total += r;
    }
    var yy = y0;
    for (var k = 0; k < n; k++) {
      var tt = t0 + (t - t0) * (k < n - 1 ? cuts[k] : 1);
      var riser = Math.min(0.04, (t - t0) / (n * 3));
      this.put(Math.max(this.t, tt - riser), yy);
      yy = y0 + (y - y0) * (rises.slice(0, k + 1).reduce(function (a, b) { return a + b; }, 0) / total);
      this.put(tt, yy);
    }
    return this;
  };

  Maker.prototype.finish = function () {
    var last = this.stops[this.stops.length - 1];
    if (last[0] < 1 || last[1] !== 1) this.stops.push([1, 1]);
    return new Curve(this.stops);
  };

  /* The families. Each is written as the gesture it is, and the roll decides the particulars. */
  var FAMILIES = {
    // Coming in: a hesitation, the surge past the mark, the settle, sometimes a flicker as it lands.
    arrive: function (m) {
      var g = m.grain;
      if (m.chance(0.55 + g * 0.4)) {
        var h = m.between(0.03, 0.16) * (0.5 + g);
        m.put(h * 0.6, m.between(0, 0.015));
        m.put(h, 0);
      }
      var over = m.between(0.02, 0.12) * (0.4 + g);
      var peak = m.between(0.42, 0.7);
      if (m.steps > 0.5 && m.chance(0.7)) {
        m.stair(peak, 1 + over, 3 + Math.round(m.rnd() * 3));
      } else {
        var mid = m.t + (peak - m.t) * m.between(0.3, 0.6);
        m.sweep(mid, (1 + over) * m.between(0.45, 0.7), m.between(1.6, 2.6), 3);
        if (m.chance(g)) m.stutter();
        m.sweep(peak, 1 + over, m.between(2, 3.4), 3);
      }
      var bounces = 1 + Math.round(m.rnd() * (1 + g * 1.5));
      m.settle(1, over, bounces, m.between(0.88, 0.97));
      if (m.chance(g * 0.6)) m.flicker(1 - m.between(0.03, 0.1) * g);
      return m.finish();
    },
    // Going away: a flicker, a refusal to go, then the rush, with one catch on the way out.
    leave: function (m) {
      var g = m.grain;
      if (m.chance(0.5 + g * 0.4)) m.flicker(m.between(0.06, 0.2) * (0.5 + g));
      m.hold(m.between(0.03, 0.18) * (0.4 + g));
      var q = m.between(0.66, 0.9);
      if (m.steps > 0.5 && m.chance(0.7)) {
        m.stair(q, 0.92, 3 + Math.round(m.rnd() * 3));
      } else {
        m.sweep(m.t + (q - m.t) * m.between(0.4, 0.65), m.between(0.3, 0.55), m.between(0.45, 0.7), 3);
        if (m.chance(g)) m.stutter();
        m.sweep(q, 0.94, m.between(0.5, 0.8), 2);
      }
      if (m.chance(g * 0.5)) {
        // The last of it goes in one cut.
        m.hold(m.between(0.02, 0.05));
        m.put(m.t, 1);
      }
      return m.finish();
    },
    // Changing where it stands: a drift in uneven steps with sloped risers, and a small overshoot.
    shift: function (m) {
      var g = m.grain;
      var n = 2 + Math.round(m.rnd() * (2 + g * 4));
      var over = m.chance(0.5) ? m.between(0.01, 0.05) * (0.5 + g) : 0;
      var end = m.between(0.8, 0.95);
      if (m.steps > 0.5 || m.chance(g * 0.7)) m.stair(end, 1 + over, n);
      else {
        m.sweep(end * m.between(0.35, 0.55), m.between(0.5, 0.75), m.between(1.3, 2.4), 3);
        if (m.chance(g)) m.stutter();
        m.sweep(end, 1 + over, m.between(1.5, 2.8), 2);
      }
      if (over) m.settle(1, over, 1, 1);
      return m.finish();
    },
    // The quick ones: a blink on the way, a snap past, a short settle.
    flicker: function (m) {
      var g = m.grain;
      if (m.chance(0.4 + g * 0.5)) {
        m.put(m.between(0.08, 0.2), m.between(0.3, 0.7));
        m.put(m.t + m.between(0.03, 0.08), m.between(0, 0.15));
      }
      var over = m.between(0, 0.1) * (0.3 + g);
      m.sweep(m.between(0.45, 0.65), 1 + over, m.between(1.8, 3), 3);
      if (m.chance(g * 0.7)) m.flicker(m.between(0.75, 0.92));
      m.settle(1, over, 1, 1);
      return m.finish();
    },
    // One beat of a thing that breathes: uneven in and out, with a catch at the top sometimes.
    pulse: function (m) {
      var g = m.grain;
      m.sweep(m.between(0.3, 0.5), m.between(0.55, 0.8), m.between(0.7, 1.4), 3);
      if (m.chance(0.3 + g * 0.5)) m.stutter();
      m.sweep(m.between(0.8, 0.95), 1, m.between(1.2, 2.2), 2);
      return m.finish();
    },
    // The slow turn: nearly even, the speed wandering, and a catch now and then.
    drift: function (m) {
      var g = m.grain;
      var n = 8 + Math.round(m.rnd() * 8);
      var phase = m.rnd() * Math.PI * 2;
      var wobble = 0.015 + 0.05 * g;
      var last = 0;
      for (var i = 1; i < n; i++) {
        var t = i / n;
        var y = clamp(t + Math.sin(phase + t * Math.PI * m.between(2, 5)) * wobble, last + 0.004, 0.996);
        if (m.chance(g * 0.25)) {
          m.put(t - 0.5 / n, last);
        }
        m.put(t, y);
        last = y;
      }
      return m.finish();
    },
    // The veil: a lag before anything shows, the swallow, and a blink before it is wholly there.
    wipe: function (m) {
      var g = m.grain;
      m.put(m.between(0.06, 0.2), m.between(0, 0.05));
      if (m.steps > 0.5 && m.chance(0.6)) m.stair(m.between(0.5, 0.7), 0.9, 3 + Math.round(m.rnd() * 2));
      else {
        m.sweep(m.between(0.4, 0.6), m.between(0.82, 0.95), m.between(1.8, 3), 4);
        if (m.chance(g * 0.8)) m.stutter();
      }
      if (m.chance(0.5 + g * 0.5)) m.flicker(m.between(0.6, 0.85));
      m.sweep(m.between(0.85, 0.96), 1, m.between(1.2, 2), 2);
      return m.finish();
    },
    // A scroll: the page may not overshoot where it is going, so this arrives from below the mark
    // -- a hesitation, the surge, a stutter, and the last of the way in a slower reach.
    scroll: function (m) {
      var g = m.grain;
      if (m.chance(0.5)) m.hold(m.between(0.02, 0.1) * (0.5 + g));
      m.sweep(m.between(0.35, 0.55), m.between(0.6, 0.8), m.between(1.6, 2.6), 3);
      if (m.chance(g)) m.stutter();
      m.sweep(m.between(0.75, 0.9), m.between(0.94, 0.985), m.between(1.5, 2.5), 2);
      return m.finish();
    },
    // A stair: the step series itself. A change that is not allowed to glide -- a colour, an
    // opacity, a bar filling, a surface changing -- climbs in a rolled number of uneven treads with
    // sloped risers, a hold on the way up where the grain allows, and lands with a slip and a
    // snap. Never a fade: a fade is one riser with no treads, and this has three to nine.
    stair: function (m) {
      var g = m.grain;
      var n = 3 + Math.round(m.rnd() * (3 + g * 3));
      if (m.chance(0.5 + g * 0.4)) m.hold(m.between(0.02, 0.1));
      m.stair(m.between(0.82, 0.96), m.chance(g * 0.6) ? 1 + m.between(0.02, 0.06) : 1, n);
      if (m.y > 1) m.settle(1, m.y - 1, 1, 1);
      return m.finish();
    },
    // A ratchet: how anything turns -- a ring, a wheel, a dial, a whole scene. Many teeth, each a
    // click forward, a slip of a part of a tooth back, and a hold, so a turn is never even and a
    // ring is never seen to glide. The teeth are uneven and the slips are the grain's.
    ratchet: function (m) {
      var g = m.grain;
      var teeth = 18 + Math.round(m.rnd() * (30 + g * 40));
      var widths = [];
      var total = 0;
      for (var i = 0; i < teeth; i++) {
        var w = m.between(0.5, 1.5);
        widths.push(w);
        total += w;
      }
      var t = 0;
      var y = 0;
      for (var k = 0; k < teeth; k++) {
        var dt = widths[k] / total;
        var dy = 1 / teeth;
        var rise = dt * m.between(0.12, 0.3);
        // the click
        m.put(clamp(t + rise, 0.001, 0.999), clamp(y + dy * (1 + (m.chance(g * 0.5) ? m.between(0.1, 0.35) : 0)), 0, 1));
        // the slip back, where the grain allows it
        if (m.chance(0.3 + g * 0.5)) m.put(clamp(t + rise + dt * m.between(0.08, 0.2), 0.001, 0.999), clamp(y + dy * (1 - m.between(0.15, 0.4)), 0, 1));
        t += dt;
        y += dy;
        // the hold until the next tooth
        if (k < teeth - 1) m.put(clamp(t, 0.001, 0.999), clamp(y, 0, 1));
      }
      return m.finish();
    }
  };

  /* The spells: every @keyframes name the stylesheets animate, and the family each one is cut
     from. A name not listed here is still rolled once it has played, from the family its name
     suggests or from `arrive` where it suggests nothing. */
  var SPELLS = {
    'stage-in': 'arrive',
    'card-in': 'arrive',
    'card-out': 'leave',
    'card-develop': 'stair',
    'sparknav-branch': 'arrive',
    'sparknav-ray': 'arrive',
    'sparknav-modal': 'arrive',
    'lightbox-veil': 'wipe',
    'lightbox-veil-out': 'wipe',
    'stage-pop': 'arrive',
    'stage-no': 'flicker',
    'stage-reject': 'leave',
    'persona-beckon': 'pulse',
    'persona-flight': 'arrive',
    'persona-flight-ring': 'leave',
    'rite-turn': 'ratchet',
    'rite-shift': 'stair',
    'matte-in': 'stair',
    'matte-out': 'stair',
    'rite-stamp': 'flicker',
    'rite-seal': 'stair',
    'rite-unseal': 'stair',
    'glyph-in': 'arrive',
    'glyph-sigil': 'flicker',
    'dialog-in': 'arrive',
    'card-lift': 'stair',
    'card-settle': 'stair',
    'card-wax': 'stair',
    'card-wane': 'stair',
    'card-stamp': 'flicker',
    'card-crack': 'flicker',
    'card-focus': 'stair',
    'card-seal': 'stair',
    'card-unseal': 'stair',
    'card-unmake': 'leave',
    'card-taken': 'leave',
    'badge-in': 'arrive',
    'badge-out': 'leave',
    'badge-beckon': 'pulse',
    'skip-drop': 'arrive',
    'logo-frost': 'stair',
    'logo-thaw': 'stair',
    'logo-stamp': 'flicker',
    'spark-ratchet': 'stair',
    'name-print': 'stair',
    'current-wink': 'flicker',
    'sparknav-cascade': 'arrive',
    'sparknav-unmake': 'leave',
    'sparknav-ray-out': 'leave',
    'cast-ring': 'stair',
    'cast-ring-dashed': 'stair',
    'chip-stamp': 'flicker',
    'chip-wax': 'stair',
    'chip-wane': 'stair',
    'shell-unmake': 'leave',
    'portrait-twinkle': 'flicker',
    'beckon-label': 'flicker',
    'ring-wait': 'drift',
    'glyph-unmake': 'leave',
    'ring-cast': 'stair',
    'portrait-cast': 'stair',
    'persona-name': 'stair',
    'persona-name-out': 'stair',
    'portrait-ask': 'stair',
    'portrait-stamp': 'flicker',
    'sheet-in': 'arrive',
    'sheet-part-in': 'stair',
    'sheet-out': 'leave',
    'sky-ring-cast': 'stair',
    'sky-ring-click': 'flicker',
    'canvas-flicker': 'flicker',
    'part-in': 'arrive',
    'part-unmake': 'leave',
    'thread-stamp': 'flicker',
    'star-wax': 'stair',
    'star-wane': 'stair',
    'star-select': 'stair',
    'star-unselect': 'stair',
    'star-focus': 'stair',
    'star-lift': 'flicker',
    'star-drop': 'stair',
    'star-develop': 'arrive',
    'star-unmake': 'leave',
    'end-seal': 'stair',
    'stamp-ink': 'flicker',
    'field-wax': 'stair',
    'glyph-word': 'arrive',
    'glyph-sigil-2': 'flicker',
    'stage-unmake': 'leave',
    'stage-no-b': 'flicker',
    'head-in': 'stair',
    'line-develop': 'stair',
    'line-said': 'stair',
    'line-said-b': 'stair',
    'cursor-blink': 'flicker',
    'cursor-blink-b': 'flicker',
    'sigil-cast': 'stair',
    'sigil-scatter': 'leave',
    'seal-stamp': 'stair',
    'seal-light': 'stair',
    'seal-strike': 'leave',
    'plate-veil': 'stair',
    'plate-tick': 'drift',
    'plate-unveil': 'leave',
    'plate-develop': 'stair',
    'plate-reexpose': 'stair',
    'plate-twitch': 'flicker',
    'tube-warm': 'stair',
    'knob-stamp': 'stair',
    'knob-seal': 'stair',
    'knob-unmake': 'leave',
    'ward-tear': 'stair',
    'hold-wind': 'drift',
    'hold-refuse': 'flicker',
    'reel-land': 'flicker',
    'notch-punch': 'flicker',
    'count-ratchet': 'stair',
    'row-swap': 'stair',
    'cell-flip': 'flicker',
    'cell-flip-b': 'flicker',
    'check-strike': 'stair',
    'check-refuse': 'flicker',
    'check-refuse-b': 'flicker',
    'ink-dry': 'stair',
    'lamp-light': 'stair',
    'caret-step': 'stair',
    'ask-in': 'stair',
    'veil-tear': 'stair',
    'veil-tear-b': 'stair',
    'avatar-in': 'arrive',
    'sky-stamp': 'flicker',
    'thread-unmake': 'leave',
    'reading-seal': 'stair',
    'sky-wax': 'stair',
    'probe-in': 'arrive',
    'probe-out': 'leave',
    'probe-read': 'stair',
    'count-tick': 'flicker',
    'count-tick-b': 'flicker',
    'mark-stamp': 'flicker',
    'mark-stamp-b': 'flicker',
    'tap-stamp': 'flicker',
    'tap-stamp-b': 'flicker',
    'mark-set': 'arrive',
    'mark-ring': 'stair',
    'field-seal': 'stair',
    'pane-light': 'stair',
    'pane-dark': 'stair',
    'pane-read': 'flicker',
    'soot-lift': 'stair',
    'soot-cover': 'stair',
    'room-turn': 'stair',
    'room-turn-b': 'stair',
    'dial-seal': 'stair',
    'key-turn': 'ratchet',
    'rite-spent': 'stair',
    'power-down': 'stair'
  };

  function familyOf(name) {
    if (FAMILIES[name]) return name;
    if (SPELLS[name]) return SPELLS[name];
    if (/out|leave|gone|away|reject|unseal/.test(name)) return 'leave';
    if (/turn|spin|ratchet|wheel|dial/.test(name)) return 'ratchet';
    if (/drift/.test(name)) return 'drift';
    if (/beckon|breath|pulse/.test(name)) return 'pulse';
    if (/veil|wipe/.test(name)) return 'wipe';
    if (/matte|seal|stair|step|develop/.test(name)) return 'stair';
    return 'arrive';
  }

  /* ---- the mattes ------------------------------------------------------------------------- */

  /* A matte is how a surface changes without fading (README: "Motion axiom"): a procedurally
     generated mask that reveals or fills a surface in blotches, shards, scanlines, dither or an
     iris, and never as a flat solid. Each roll makes a ladder of five -- the same matte at rising
     coverage, from a few specks to the whole -- as values the `mask` shorthand takes, and the
     stylesheets step through the ladder in keyframes (mask is not interpolable, so a keyframe
     switch is a hard tread: the step series the ladder is for). A sixth value is a fill texture,
     for a surface that stays changed -- a selected button, a set knob -- so that what it wears is
     a generated pattern over its colour and not a solid.

     The noise and the shards are small SVGs written as data: URIs; the scanlines, the dither and
     the iris are gradients a browser can draw without them. All of them are black where the
     surface shows and transparent where it does not, which is what mask-mode: alpha reads. */

  var MATTE_KINDS = ['noise', 'noise', 'shards', 'scan', 'dither', 'iris', 'grain'];

  function svgURI(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%22/g, "'") + '")';
  }

  // Noise thresholded at a coverage: feTurbulence, read as a single channel, cut by a discrete
  // alpha table so that the covered fraction rises with the coverage asked for.
  // The channel feTurbulence gives is not spread evenly over 0..1 -- fractalNoise sits in a bell
  // around 0.5 and turbulence crowds toward 0 -- so it is stretched first (a linear transfer with
  // the slope and intercept that spread each kind over the whole range), and then cut: a table
  // of many steps, 1 above the threshold and 0 below, so that the covered fraction really rises
  // with the coverage asked for, rung by rung, instead of the first two rungs coming out empty
  // and the last two solid.
  function noiseMatte(rnd, coverage, seed, frequency, octaves, fractal) {
    var n = 40;
    var table = [];
    for (var i = 0; i < n; i++) table.push(i / (n - 1) < 1 - coverage ? 0 : 1);
    var slope = fractal ? 3.2 : 2.2;
    var intercept = fractal ? -1.1 : -0.05;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">'
      + '<filter id="m" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="' + (fractal ? 'fractalNoise' : 'turbulence') + '" baseFrequency="' + frequency + '" numOctaves="' + octaves + '" seed="' + seed + '" stitchTiles="stitch"/>'
      + '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/>'
      + '<feComponentTransfer><feFuncA type="linear" slope="' + slope + '" intercept="' + intercept + '"/></feComponentTransfer>'
      + '<feComponentTransfer><feFuncA type="discrete" tableValues="' + table.join(' ') + '"/></feComponentTransfer>'
      + '</filter><rect width="96" height="96" filter="url(#m)"/></svg>';
    return svgURI(svg) + ' 0 0 / 96px 96px repeat';
  }

  // Shards: a scatter of rolled triangles over the tile, the smallest first, as many drawn as
  // the coverage asks. A shard that crosses the tile's edge is drawn again on the far side, so
  // the tile repeats without a seam.
  function shardMatte(shards, coverage) {
    var count = Math.round(shards.length * coverage);
    var polys = '';
    for (var i = 0; i < count; i++) {
      var sh = shards[i];
      for (var w = 0; w < sh.wraps.length; w++) {
        var dx = sh.wraps[w][0];
        var dy = sh.wraps[w][1];
        var pts = [];
        for (var k = 0; k < 3; k++) pts.push((sh.pts[k][0] + dx).toFixed(1) + ',' + (sh.pts[k][1] + dy).toFixed(1));
        polys += '<polygon points="' + pts.join(' ') + '"/>';
      }
    }
    if (coverage >= 1) polys = '<rect width="120" height="120"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' + polys + '</svg>';
    return svgURI(svg) + ' 0 0 / 120px 120px repeat';
  }

  function rollShards(rnd) {
    var shards = [];
    for (var i = 0; i < 26; i++) {
      var cx = rnd() * 120;
      var cy = rnd() * 120;
      var r = 12 + rnd() * 30;
      var a = rnd() * Math.PI * 2;
      var pts = [];
      var minX = 999, maxX = -999, minY = 999, maxY = -999;
      for (var k = 0; k < 3; k++) {
        var ang = a + k * (Math.PI * 2 / 3) + (rnd() - 0.5) * 0.8;
        var x = cx + Math.cos(ang) * r;
        var y = cy + Math.sin(ang) * r;
        pts.push([x, y]);
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      // The copies that keep it whole across the tile's edges.
      var xs = [0];
      var ys = [0];
      if (minX < 0) xs.push(120); if (maxX > 120) xs.push(-120);
      if (minY < 0) ys.push(120); if (maxY > 120) ys.push(-120);
      var wraps = [];
      for (var xi = 0; xi < xs.length; xi++) for (var yi = 0; yi < ys.length; yi++) wraps.push([xs[xi], ys[yi]]);
      var area = Math.abs((pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[2][0] - pts[0][0]) * (pts[1][1] - pts[0][1])) / 2;
      shards.push({ pts: pts, wraps: wraps, area: area });
    }
    shards.sort(function (a, b) { return a.area - b.area; });
    return shards;
  }

  // A dither: a 4x4 Bayer tile as sixteen cells, lit in Bayer order, so each rung of the ladder
  // lights the next few cells and no two rungs are the same.
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function ditherMatte(cell, coverage) {
    var lit = Math.round(16 * coverage);
    if (lit >= 16) return 'linear-gradient(#000, #000)';
    var rects = '';
    for (var i = 0; i < 16; i++) {
      if (BAYER[i] < lit) rects += '<rect x="' + (i % 4) * cell + '" y="' + Math.floor(i / 4) * cell + '" width="' + cell + '" height="' + cell + '"/>';
    }
    var size = cell * 4;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">' + rects + '</svg>';
    return svgURI(svg) + ' 0 0 / ' + size + 'px ' + size + 'px repeat';
  }

  function rollMattes(rnd, temper) {
    var g = temper.grain;
    var kind = temper.steps > 0.5 && rnd() < 0.5 ? (rnd() < 0.5 ? 'scan' : 'dither') : MATTE_KINDS[Math.floor(rnd() * MATTE_KINDS.length)];
    var ladder = [];
    var coverages = [0.1 + rnd() * 0.08, 0.26 + rnd() * 0.1, 0.46 + rnd() * 0.12, 0.7 + rnd() * 0.12, 1];
    var i;
    if (kind === 'noise' || kind === 'grain') {
      // Several features to a tile (a frequency of 0.03 is three across 96px), and a few
      // octaves, so the channel has a histogram to cut rather than one blob that is all above
      // or all below the line; fractalNoise, whose bell the stretch above is tuned to.
      var seed = 1 + Math.floor(rnd() * 9999);
      var frequency = (kind === 'grain' ? 0.09 + rnd() * 0.12 : 0.028 + rnd() * 0.05).toFixed(4);
      var octaves = 2 + Math.floor(rnd() * 3);
      var fractal = true;
      for (i = 0; i < 5; i++) ladder.push(noiseMatte(rnd, coverages[i], seed, frequency, octaves, fractal));
    } else if (kind === 'shards') {
      var shards = rollShards(rnd);
      for (i = 0; i < 5; i++) ladder.push(shardMatte(shards, coverages[i]));
    } else if (kind === 'scan') {
      // Lines wide enough that every rung is its own: the band grows a rung at a time, and from
      // the third rung a second set of lines crosses the first.
      var angle = Math.round(rnd() < 0.6 ? (rnd() < 0.5 ? 0 : 90) : rnd() * 180);
      var period = 8 + Math.round(rnd() * 8);
      for (i = 0; i < 5; i++) {
        var band = Math.max(1, Math.round(period * coverages[i] * (i >= 2 ? 0.75 : 1)));
        var lines = 'repeating-linear-gradient(' + angle + 'deg, #000 0 ' + band + 'px, transparent ' + band + 'px ' + period + 'px)';
        if (i >= 2) {
          var cross = Math.max(1, Math.round(period * coverages[i] * 0.5));
          lines += ', repeating-linear-gradient(' + (angle + 90) + 'deg, #000 0 ' + cross + 'px, transparent ' + cross + 'px ' + (period + 3) + 'px)';
        }
        ladder.push(i === 4 ? 'linear-gradient(#000, #000)' : lines);
      }
    } else if (kind === 'dither') {
      var cell = 2 + Math.round(rnd() * 4);
      for (i = 0; i < 5; i++) ladder.push(ditherMatte(cell, coverages[i]));
    } else {
      var ix = Math.round(rnd() * 100);
      var iy = Math.round(rnd() * 100);
      for (i = 0; i < 5; i++) {
        var radius = Math.round(coverages[i] * 150);
        ladder.push(i === 4 ? 'linear-gradient(#000, #000)'
          : 'radial-gradient(circle at ' + ix + '% ' + iy + '%, #000 ' + radius + '%, transparent ' + (radius + 1) + '%)');
      }
    }
    // The fill texture a changed surface wears: a hatch, scanlines, a stipple, a moire of two
    // hatches or rings, in currentColor so it takes the surface's own ink.
    var fills = ['hatch', 'scan', 'stipple', 'moire', 'rings'];
    var fill = fills[Math.floor(rnd() * fills.length)];
    var image;
    var size = 'auto';
    var fa = Math.round(rnd() * 180);
    var fp = 3 + Math.round(rnd() * 5);
    var fw = Math.max(1, Math.round(fp * (0.25 + rnd() * 0.35)));
    if (fill === 'hatch') {
      image = 'repeating-linear-gradient(' + fa + 'deg, currentColor 0 ' + fw + 'px, transparent ' + fw + 'px ' + fp + 'px)';
    } else if (fill === 'scan') {
      image = 'repeating-linear-gradient(' + (rnd() < 0.5 ? 0 : 90) + 'deg, currentColor 0 1px, transparent 1px ' + fp + 'px)';
    } else if (fill === 'stipple') {
      var dot = 1 + rnd() * 1.4;
      image = 'radial-gradient(currentColor ' + dot.toFixed(1) + 'px, transparent ' + (dot + 0.6).toFixed(1) + 'px)';
      size = (fp + 2) + 'px ' + (fp + 2) + 'px';
    } else if (fill === 'moire') {
      image = 'repeating-linear-gradient(' + fa + 'deg, currentColor 0 1px, transparent 1px ' + fp + 'px), '
        + 'repeating-linear-gradient(' + (fa + 60 + Math.round(rnd() * 60)) + 'deg, currentColor 0 1px, transparent 1px ' + (fp + 1) + 'px)';
    } else {
      image = 'repeating-radial-gradient(circle at ' + Math.round(rnd() * 100) + '% ' + Math.round(rnd() * 100) + '%, currentColor 0 1px, transparent 1px ' + (fp + 2) + 'px)';
    }
    // The top of the ladder: the same texture in black, as a mask, so a surface that has arrived
    // through the ladder rests patterned rather than as a flat tint. Dense enough to read as the
    // surface, open enough to read as a pattern.
    var topImage = image.replace(/currentColor/g, '#000');
    var top = topImage + (size === 'auto' ? '' : ' 0 0 / ' + size) + ', linear-gradient(#000, #000)';
    return { kind: kind, ladder: ladder, fill: fill, fillImage: image, fillSize: size, top: top, grain: g };
  }

  function makeCurve(family, temper, seed) {
    var rnd = mulberry32(seed == null ? entropy() : seed);
    var maker = new Maker(rnd, temper || DEFAULT_TEMPER);
    var make = FAMILIES[familyOf(family)];
    return make(maker);
  }

  /* A browser without linear() gets a stair instead: a rolled number of treads and a rolled place
     for the jump, which is as far from a standard curve as such a browser can be taken. */
  function makeStair(family, temper, rnd) {
    var g = (temper || DEFAULT_TEMPER).grain;
    var n = 3 + Math.round(rnd() * (3 + g * 5));
    var jumps = ['jump-start', 'jump-end', 'jump-both', 'jump-none'];
    var jump = family === 'leave' ? 'jump-start' : family === 'arrive' ? 'jump-end' : jumps[Math.floor(rnd() * jumps.length)];
    return 'steps(' + n + ', ' + jump + ')';
  }

  /* ---- the geometry ---------------------------------------------------------------------- */

  var WIPES = [
    // [from, to]: the shape the veil opens from, and the shape it ends on. The two of a pair are
    // of one kind, because a browser can only wipe between shapes it can interpolate.
    ['inset(0 0 100% 0)', 'inset(0)'],
    ['inset(100% 0 0 0)', 'inset(0)'],
    ['inset(0 100% 0 0)', 'inset(0)'],
    ['inset(0 0 0 100%)', 'inset(0)'],
    ['inset(50% 50% 50% 50%)', 'inset(0)'],
    ['inset(0 50% 0 50%)', 'inset(0)'],
    ['inset(50% 0 50% 0)', 'inset(0)'],
    ['inset(0 0 100% 0 round 40%)', 'inset(0 round 0)'],
    ['circle(0% at 12% 8%)', 'circle(150% at 12% 8%)'],
    ['circle(0% at 88% 10%)', 'circle(150% at 88% 10%)'],
    ['circle(0% at 50% 50%)', 'circle(100% at 50% 50%)'],
    ['circle(0% at 50% 100%)', 'circle(150% at 50% 100%)'],
    ['ellipse(0% 60% at 50% 50%)', 'ellipse(110% 110% at 50% 50%)'],
    ['polygon(0 0, 100% 0, 100% 0, 0 0)', 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'],
    ['polygon(0 0, 0 0, 0 100%, 0 100%)', 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'],
    ['polygon(50% 0, 50% 0, 50% 100%, 50% 100%)', 'polygon(-30% 0, 130% 0, 130% 100%, -30% 100%)']
  ];

  var STATE_FROM = [
    'inset(0 100% 0 0)', 'inset(0 0 0 100%)', 'inset(100% 0 0 0)', 'inset(0 0 100% 0)',
    'inset(0 50% 0 50%)', 'inset(50% 0 50% 0)', 'inset(50%)', 'inset(0 100% 0 0 round 50%)'
  ];

  function rollGeometry(rnd, temper) {
    var g = temper.grain;
    var side = rnd();
    // Arrivals come mostly from below, now and then from a side, rarely from above or from
    // nowhere in particular, and always a little further the glitchier the temperament.
    var reach = 18 + rnd() * 34 * (0.6 + g);
    var arriveX = 0;
    var arriveY = reach;
    if (side < 0.18) { arriveX = (rnd() < 0.5 ? -1 : 1) * reach; arriveY = (rnd() - 0.5) * 12; }
    else if (side < 0.28) { arriveY = -reach * 0.6; }
    else if (side < 0.36) { arriveX = (rnd() - 0.5) * reach; arriveY = reach * 0.5; }
    var leaveX = (rnd() - 0.5) * 14 * g;
    var leaveY = -(14 + rnd() * 20);
    if (rnd() < 0.2) { leaveY = -leaveY * 0.7; }
    var wipe = WIPES[Math.floor(rnd() * WIPES.length)];
    var skyX = 4 + rnd() * 30;
    var skyY = -22 + rnd() * 20;
    return {
      arriveX: arriveX,
      arriveY: arriveY,
      arriveRot: (rnd() - 0.5) * 5 * (0.3 + g),
      arriveScale: 0.9 + rnd() * 0.14,
      arriveSkew: (rnd() - 0.5) * 6 * g,
      leaveX: leaveX,
      leaveY: leaveY,
      leaveRot: (rnd() - 0.5) * 6 * (0.3 + g),
      leaveScale: 0.86 + rnd() * 0.1,
      wipeFrom: wipe[0],
      wipeTo: wipe[1],
      stateFrom: STATE_FROM[Math.floor(rnd() * STATE_FROM.length)],
      shiftX: (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 6) * (0.4 + g),
      shiftSkew: (rnd() - 0.5) * 12 * (0.3 + g),
      shiftBlur: 2 + rnd() * 6,
      skyX: skyX,
      skyY: skyY,
      liftY: -(1 + rnd() * 3),
      liftRot: (rnd() - 0.5) * 1.6 * (0.3 + g),
      sparkExtra: (rnd() - 0.5) * 70,
      popOver: 1.04 + rnd() * 0.18 * (0.5 + g),
      shakeX: 3 + rnd() * 6,
      beckonSpread: 5 + rnd() * 7,
      rejectGrow: 0.85 + rnd() * 0.5,
      rayFrom: 0.05 + rnd() * 0.45
    };
  }

  function rollDurations(rnd, temper) {
    var tempo = temper.tempo;
    function one(base, spread) {
      return Math.round(base * tempo * (1 - spread + rnd() * spread * 2));
    }
    return {
      short: one(170, 0.22),
      medium: one(340, 0.22),
      long: one(560, 0.2),
      slow: one(1200, 0.25),
      stagger: one(44, 0.45),
      shift: one(640, 0.25),
      turn: one(120000, 0.3)
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
    var inFlight = {}; // animation name -> how many are running
    var running = 0; // all of them, the ones that loop for ever aside
    var looping = { 'persona-beckon': true, 'rite-turn': true }; // the ones that never end
    var spellWanted = {}; // spells that finished while something else was still in flight
    var geometryWanted = false; // a roll asked for while something was in flight
    var bootAt = 0;
    var lastRoll = 0;
    var breathTimer = null;
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

    function cssOf(curve, family, rnd) {
      return supportsLinear ? curve.toCSS() : makeStair(family, temper, rnd);
    }

    function rollFamilies(names) {
      var rnd = mulberry32(entropy());
      for (var i = 0; i < names.length; i++) {
        var family = names[i];
        var curve = makeCurve(family, temper, Math.floor(rnd() * 0x7fffffff));
        current.curves[family] = curve;
        write('--ease-' + family, cssOf(curve, family, rnd));
      }
    }

    // A spell's own length beside its curve: --motion-<name>, from its family's base, rolled a
    // quarter either way and scaled by the tempo, so a rite that plays twice is never the same
    // length twice. A stylesheet reads it as var(--motion-<name>, var(--motion-long)).
    var SPELL_MS = { arrive: 560, leave: 340, shift: 340, flicker: 170, pulse: 2400, drift: 120000, wipe: 340, stair: 340, ratchet: 120000, scroll: 600 };
    function rollSpell(name) {
      if (composedSet[name]) return;
      var rnd = mulberry32(entropy());
      var family = familyOf(name);
      var curve = makeCurve(family, temper, Math.floor(rnd() * 0x7fffffff));
      current.spells[name] = curve;
      write('--ease-' + name, cssOf(curve, family, rnd));
      var base = SPELL_MS[family] || 340;
      var length = Math.round(base * temper.tempo * (0.75 + rnd() * 0.5));
      current.spellMs[name] = length;
      write('--motion-' + name, length + 'ms');
    }

    function rollDurationsNow() {
      var rnd = mulberry32(entropy());
      var d = rollDurations(rnd, temper);
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
      var rnd = mulberry32(entropy());
      var g = rollGeometry(rnd, temper);
      current.geometry = g;
      write('--arrive-x', g.arriveX.toFixed(1) + 'px');
      write('--arrive-y', g.arriveY.toFixed(1) + 'px');
      write('--arrive-rot', g.arriveRot.toFixed(2) + 'deg');
      write('--arrive-scale', g.arriveScale.toFixed(3));
      write('--arrive-skew', g.arriveSkew.toFixed(2) + 'deg');
      write('--leave-x', g.leaveX.toFixed(1) + 'px');
      write('--leave-y', g.leaveY.toFixed(1) + 'px');
      write('--leave-rot', g.leaveRot.toFixed(2) + 'deg');
      write('--leave-scale', g.leaveScale.toFixed(3));
      write('--wipe-from', g.wipeFrom);
      write('--wipe-to', g.wipeTo);
      write('--state-from', g.stateFrom);
      write('--shift-x', g.shiftX.toFixed(1) + 'px');
      write('--shift-skew', g.shiftSkew.toFixed(2) + 'deg');
      write('--shift-blur', g.shiftBlur.toFixed(1) + 'px');
      write('--lift-y', g.liftY.toFixed(1) + 'px');
      write('--lift-rot', g.liftRot.toFixed(2) + 'deg');
      write('--spark-extra', g.sparkExtra.toFixed(1) + 'deg');
      write('--pop-over', g.popOver.toFixed(3));
      write('--shake-x', g.shakeX.toFixed(1) + 'px');
      write('--beckon-spread', g.beckonSpread.toFixed(1) + 'px');
      write('--reject-grow', g.rejectGrow.toFixed(3));
      write('--ray-from', g.rayFrom.toFixed(3));
      geometryWanted = false;
    }

    // Where the page's sky washes in from: rolled only on a full roll -- as the page arrives, as
    // the site changes what it is wearing, and now and then on a page left alone -- never on a
    // press, so the background drifts the way weather does and not the way a cursor does. main's
    // gradient transitions the two (_panel.scss), so each roll is a slow wash and never a cut.
    function rollSkyNow() {
      var g = current.geometry;
      if (!g) return;
      write('--sky-x', g.skyX.toFixed(1) + '%');
      write('--sky-y', g.skyY.toFixed(1) + '%');
    }

    // The matte ladder and the fill texture (see "the mattes" above), rolled with the geometry:
    // --matte-1 to --matte-5 at rising coverage, --matte-fill and --matte-fill-size for a surface
    // that stays changed, and --matte-kind for a stylesheet that wants to know.
    function rollMattesNow() {
      var rnd = mulberry32(entropy());
      var m = rollMattes(rnd, temper);
      current.mattes = m;
      for (var i = 0; i < m.ladder.length; i++) write('--matte-' + (i + 1), m.ladder[i]);
      write('--matte-fill', m.fillImage);
      write('--matte-fill-size', m.fillSize);
      write('--matte-top', m.top);
      write('--matte-kind', m.kind);
      // Said on <html> too, so a stylesheet can dress a kind: html[data-matte='scan'] ...
      if (html && typeof html.setAttribute === 'function') html.setAttribute('data-matte', m.kind);
    }

    var TRANSITION_FAMILIES = ['shift', 'flicker', 'stair'];
    var ALL_FAMILIES = ['arrive', 'leave', 'shift', 'flicker', 'pulse', 'drift', 'wipe', 'stair', 'ratchet'];

    /* Whether anything that ends is in flight. document.getAnimations is the truth where the
       browser has it -- it counts an animation still in its delay, and forgets one that was
       cancelled without a word (an element removed or hidden mid-flight, which older browsers
       never report) -- and the hand-kept counter is the fallback. A looping animation never
       counts, because it never ends. */
    function busy() {
      if (typeof doc.getAnimations === 'function') {
        try {
          var all = doc.getAnimations();
          for (var i = 0; i < all.length; i++) {
            var a = all[i];
            if (!a || a.playState !== 'running' || !a.effect || typeof a.effect.getTiming !== 'function') continue;
            var timing = a.effect.getTiming();
            if (timing.iterations === Infinity) continue;
            if (a.animationName && looping[a.animationName]) continue;
            return true;
          }
          running = 0;
          return false;
        } catch (e) {
          /* the counter, then */
        }
      }
      return running > 0;
    }

    // Everything rolled again -- but a spell with an animation in flight keeps its curve until
    // that animation ends (a curve changed under a running animation is a jump along it), and is
    // marked wanted, so the next end re-rolls it; a looping one is re-rolled at its next turn.
    function rollAll() {
      temper = readTemper(doc);
      if (temperOf) temperOf = new global.WeakMap();
      rollFamilies(ALL_FAMILIES);
      for (var name in SPELLS) {
        if (!Object.prototype.hasOwnProperty.call(SPELLS, name)) continue;
        if (inFlight[name] || looping[name]) spellWanted[name] = true;
        else rollSpell(name);
      }
      rollDurationsNow();
      rollGeometryNow();
      rollMattesNow();
      rollSkyNow();
      lastRoll = now();
    }

    function now() {
      return global.performance && typeof global.performance.now === 'function'
        ? global.performance.now() : Date.now();
    }

    // The quick families, just before the movement a gesture is about to cause. Throttled, because
    // a pointer moving over a row of chips fires more events than any curve could be seen in. A
    // press rolls the geometry with them (the arrival it is about to cause comes from somewhere
    // new); a pointer merely passing over things does not, because a card lifted under it would
    // twitch to every new lift the roll gave it.
    var lastQuick = 0;
    function rollQuick(withGeometry) {
      var at = now();
      if (at - lastQuick < 96) return;
      lastQuick = at;
      rollFamilies(TRANSITION_FAMILIES);
      if (!withGeometry) return;
      if (!busy()) {
        rollGeometryNow();
        rollMattesNow();
      } else geometryWanted = true;
    }

    // A field being typed into is not a press, nor is a focus the browser would not show: only
    // a pointer, an activation key, a Tab, or a visible focus rolls the quick families.
    function onPress(ev) {
      if (ev && ev.type === 'keydown') {
        var el = ev.target;
        if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Tab') return;
        if (el && (el.tagName === 'TEXTAREA' || el.isContentEditable
          || (el.tagName === 'INPUT' && !/^(?:button|submit|reset|checkbox|radio|range|color|file)$/i.test(el.type || '')))) return;
      }
      if (ev && ev.type === 'focusin') {
        try {
          if (ev.target && typeof ev.target.matches === 'function' && !ev.target.matches(':focus-visible')) return;
        } catch (e) {
          /* every focus shows, then */
        }
      }
      rollQuick(true);
    }

    function onPass() {
      rollQuick(false);
    }

    // A geometry asked for while something was in flight is rolled once the flight is over.
    var settleTimer = 0;
    function settleLater() {
      if (settleTimer || typeof global.setTimeout !== 'function') return;
      settleTimer = global.setTimeout(function () {
        settleTimer = 0;
        if (!geometryWanted) return;
        if (busy()) {
          settleLater();
          return;
        }
        rollGeometryNow();
        rollMattesNow();
      }, 120);
    }

    /* ---- what the page tells it ------------------------------------------------------------ */

    var transitionRoll = 0;
    function onTransitionEnd() {
      if (transitionRoll) return;
      var raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
      if (!raf) {
        rollFamilies(TRANSITION_FAMILIES);
        return;
      }
      transitionRoll = raf(function () {
        transitionRoll = 0;
        rollFamilies(TRANSITION_FAMILIES);
        rollFamilies(['arrive', 'leave']);
        if (!busy()) rollGeometryNow();
        else {
          geometryWanted = true;
          settleLater();
        }
      });
    }

    function onAnimationStart(ev) {
      var name = ev && ev.animationName;
      if (!name || looping[name]) return;
      inFlight[name] = (inFlight[name] || 0) + 1;
      running += 1;
    }

    /* An animation that ends re-rolls its spell -- but only once nothing else is in flight,
       because a curve a running animation reads is a curve that animation would jump along if it
       changed under it: the chips of the constellation branch out one after another and share a
       spell, so the first to land waits for the last. The geometry is re-rolled the same way. */
    function onAnimationEnd(ev) {
      var name = ev && ev.animationName;
      if (!name || looping[name]) return;
      if (inFlight[name]) {
        inFlight[name] -= 1;
        running = Math.max(0, running - 1);
      }
      spellWanted[name] = true;
      if (busy()) {
        settleLater();
        return;
      }
      for (var spell in spellWanted) {
        if (Object.prototype.hasOwnProperty.call(spellWanted, spell) && !inFlight[spell]) {
          rollSpell(spell);
          delete spellWanted[spell];
        }
      }
      rollGeometryNow();
      rollMattesNow();
    }

    // One that loops re-rolls its own spell at the turn of every loop, which is the one moment a
    // new curve cannot be seen as a jump; and from then on it is known never to end.
    function onAnimationIteration(ev) {
      var name = ev && ev.animationName;
      if (!name) return;
      if (!looping[name]) {
        looping[name] = true;
        if (inFlight[name]) {
          running = Math.max(0, running - inFlight[name]);
          inFlight[name] = 0;
        }
      }
      rollSpell(name);
    }

    function watch() {
      if (!doc || typeof doc.addEventListener !== 'function') return;
      doc.addEventListener('transitionend', onTransitionEnd, true);
      doc.addEventListener('transitioncancel', onTransitionEnd, true);
      doc.addEventListener('animationstart', onAnimationStart, true);
      doc.addEventListener('animationend', onAnimationEnd, true);
      doc.addEventListener('animationcancel', onAnimationEnd, true);
      doc.addEventListener('animationiteration', onAnimationIteration, true);
      doc.addEventListener('pointerdown', onPress, true);
      doc.addEventListener('keydown', onPress, true);
      doc.addEventListener('focusin', onPress, true);
      doc.addEventListener('pointerover', onPass, true);
      watchStates();
      watchVeil();
      // The site changing what it wears: the temperament is read again and everything rolled to
      // it, and the rite's words flicker through the change (see shift below).
      if (typeof global.MutationObserver === 'function' && html) {
        try {
          new global.MutationObserver(function (changes) {
            for (var i = 0; i < changes.length; i++) {
              var attr = changes[i].attributeName;
              if (attr === 'data-mood' || attr === 'data-featured' || attr === 'data-world') {
                shift();
                return;
              }
            }
          }).observe(html, { attributes: true, attributeFilter: ['data-mood', 'data-featured', 'data-world'] });
        } catch (e) {
          /* a browser whose observer takes no filter still rolls on every other occasion */
        }
      }
      breathe();
    }

    // A page left alone rolls itself again every so often, at a rolled interval, so its next
    // movement is never the one it rolled a minute ago; nothing in flight is touched.
    var breaths = 0;
    function breathe() {
      if (typeof global.setTimeout !== 'function') return;
      // The wait is the maker's: a stair curve sampled at a rolled point, stretched as the page
      // is left alone longer, so an idle page breathes slower and slower (up to a minute and a
      // half) and a page touched again breathes quickly once more.
      var rnd = mulberry32(entropy());
      var curve = makeCurve('stair', temper, Math.floor(rnd() * 0x7fffffff));
      var wait = (12000 + curve.at(rnd()) * 18000) * Math.min(3, 1 + breaths * 0.5);
      breathTimer = global.setTimeout(function () {
        if (now() - lastRoll > 4000) {
          breaths += 1;
          if (busy()) rollFamilies(TRANSITION_FAMILIES);
          else rollAll();
        } else breaths = 0;
        breathe();
      }, wait);
    }

    /* ---- the shift of modality -------------------------------------------------------------- */

    var shiftTimer = null;
    var shiftToken = 0;

    /* The site is changing what it is wearing: a new palette, a new typographic register, a new
       temperament. The words of the rite are thrown and blurred for a moment and land in the new
       face (_sass/_mood.scss, @keyframes rite-shift), and the whole roll is made again under the
       new temperament, so the first movement in the new modality is already the new modality's.
       A visitor who asked for less motion gets the change and not the throw. */
    function shift() {
      temper = readTemper(doc);
      rollAll();
      if (!html || typeof html.setAttribute !== 'function') return;
      var token = ++shiftToken;
      // The reading lands on <html> as the page arrives, a moment after the first paint: that is
      // the site putting its skin on, not changing it, so the roll is made and the words are
      // left alone. A visitor who asked for less motion gets the change and not the throw.
      if (reduced() || now() - bootAt < 900) {
        html.removeAttribute('data-shifting');
        return;
      }
      // Taken off and put back, so a shift during a shift starts the flicker over.
      html.removeAttribute('data-shifting');
      var raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : function (fn) { fn(); };
      raf(function () {
        if (token !== shiftToken) return;
        html.setAttribute('data-shifting', '');
        // The words of the rite are cut through their sigils into the new face, a few of them:
        // the stage's head, a page's heading, the section and panel titles.
        if (typeof doc.querySelectorAll === 'function') {
          try {
            var words = doc.querySelectorAll('.stage-title, .list-page-main > h1, .prose-main > h1, .section-title, .panel-title');
            for (var w = 0; w < words.length && w < 6; w++) reveal(words[w], { scramble: 1, pace: 0.3 });
          } catch (e) {
            /* a page with none of them */
          }
        }
        if (typeof global.clearTimeout === 'function' && shiftTimer) global.clearTimeout(shiftTimer);
        if (typeof global.setTimeout === 'function') {
          shiftTimer = global.setTimeout(function () {
            if (token === shiftToken) html.removeAttribute('data-shifting');
          }, (current.durations ? current.durations.shift : 640) + 80);
        }
      });
    }

    /* ---- the composer ---------------------------------------------------------------------- */

    /* Every movement is composed anew each time it is triggered. A rite is not one rolled curve
       laid over a fixed sequence of keyframes: it is a whole put together, on the trigger, from
       pieces each chosen at random from a vocabulary -- an opening (a cut in from the rolled
       edge, a blink, nothing), a climb up the matte ladder (steady, with a slip back, in a leap,
       with a stutter, with a flicker out, doubled), a landing (the patterned top, the flat rung
       then the top, an overshoot past it), a dip (how deep, which way, with what flash), a return
       (straight, over the mark, a double bounce), an approach (straight, hesitating, past the
       mark, skewed in) -- with the width of every tread uneven and its own. The composition is
       written as an @keyframes rule of its own into a stylesheet of the engine's, and its name
       is written on the element (--rite-wax, --rite-wane, --rite-stamp, --rite-ink, --rite-seal,
       --rite-unseal, --rite-develop, --rite-unmake, --rite-veil-out), where the stylesheet reads
       it as `animation: var(--rite-wax, matte-in) ...`, the named keyframes being only what a page
       with no script plays. So the same hover on the same button is never the same twice, and
       two buttons hovered together wax two different ways. The rules are recycled: the oldest go
       as new ones come, long after anything could still be playing them. */

    var COMPOSED_CAP = 240;
    var composedSheet = null;
    var composedNames = [];
    var composedCount = 0;
    var composedSet = {};

    function composedSheetReady() {
      if (composedSheet) return composedSheet;
      if (!doc.createElement || !doc.head || typeof doc.head.appendChild !== 'function') return null;
      try {
        var style = doc.createElement('style');
        style.setAttribute('data-interesting-rites', '');
        doc.head.appendChild(style);
        composedSheet = style.sheet || null;
      } catch (e) {
        composedSheet = null;
      }
      return composedSheet;
    }

    // The frames of a composition: states, each a set of declarations, held one after another
    // over treads of uneven width -- each state written as a held pair, so nothing between two
    // states is ever interpolated. The widths come from the roll; `weights` may stretch some.
    function framesOf(states, rnd, weights) {
      var widths = [];
      var total = 0;
      for (var i = 0; i < states.length; i++) {
        var w = (0.45 + rnd() * 1.1) * (weights && weights[i] ? weights[i] : 1);
        widths.push(w);
        total += w;
      }
      var out = '';
      var at = 0;
      for (var k = 0; k < states.length; k++) {
        var from = at;
        at += widths[k] / total;
        var to = k === states.length - 1 ? 1 : at;
        var decl = states[k];
        var body = '';
        for (var prop in decl) if (Object.prototype.hasOwnProperty.call(decl, prop)) body += prop + ': ' + decl[prop] + '; ';
        var a = (from * 100).toFixed(1);
        var b = k === states.length - 1 ? '100' : Math.max(from * 100, to * 100 - 0.1).toFixed(1);
        out += (a === b ? a : a + '%, ' + b) + '% { ' + body + '} ';
      }
      return out;
    }

    function masked(rung) {
      var v = rung === 'top' ? 'var(--matte-top)' : rung === 'none' ? 'none' : rung === 'off' ? 'none' : 'var(--matte-' + rung + ')';
      return { mask: v, '-webkit-mask': v };
    }

    function merge(a, b) {
      var out = {};
      var k;
      for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
      for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
      return out;
    }

    function pick(rnd, list) {
      return list[Math.floor(rnd() * list.length)];
    }

    /* The vocabulary. Each kind is a list of pieces to choose from, and each piece a function of
       the roll that gives back states; a composition is one piece from each slot, in order. */
    var VOCABULARY = {
      // The state layer arriving under the pointer.
      wax: {
        opening: [
          function () { return []; },
          function (rnd) { return [merge(masked(1), { 'clip-path': 'var(--state-from, inset(0 50% 0 50%))', opacity: '0.12' })]; },
          function () { return [merge(masked('off'), { opacity: '0' })]; }
        ],
        climb: [
          function () { return [masked(1), masked(2), masked(3), masked(4), masked(5)]; },
          function () { return [masked(1), masked(2), masked(3), masked(2), masked(4), masked(5)]; },
          function () { return [masked(1), masked(3), masked(5)]; },
          function () { return [masked(1), { 'mask-position': 'calc(var(--matte-shift-x, 0px) + 11px) var(--matte-shift-y, 0px)', '-webkit-mask-position': 'calc(var(--matte-shift-x, 0px) + 11px) var(--matte-shift-y, 0px)' }, masked(2), masked(3), masked(4), masked(5)]; },
          function () { return [masked(1), masked(2), masked(3), merge(masked(3), { opacity: '0' }), masked(4), masked(5)]; },
          function () { return [masked(1), masked(2), masked(1), masked(2), masked(3), masked(4), masked(5)]; },
          function () { return [masked(2), masked(4), masked(3), masked(5)]; }
        ],
        landing: [
          function () { return [masked('top')]; },
          function () { return [masked('none'), masked('top')]; },
          function () { return [masked('top'), merge(masked('top'), { opacity: '0.2' }), masked('top')]; }
        ]
      },
      // The state layer leaving.
      wane: {
        opening: [
          function () { return [masked('top')]; },
          function () { return [masked('top'), masked('none'), masked('top')]; }
        ],
        climb: [
          function () { return [masked(5), masked(4), masked(3), masked(2), masked(1)]; },
          function () { return [masked(5), masked(3), masked(4), masked(2), masked(1)]; },
          function () { return [masked(4), masked(2), masked(1)]; },
          function () { return [masked(5), masked(4), merge(masked(4), { opacity: '0' }), masked(3), masked(1)]; }
        ],
        landing: [
          function () { return [merge(masked(1), { opacity: '0' })]; },
          function () { return [merge(masked('off'), { opacity: '0' })]; }
        ]
      },
      // The ink of a press, spreading from where the press landed.
      ink: {
        opening: [
          function () { return []; },
          function () { return [merge(masked(2), { 'clip-path': 'var(--state-from, inset(0 50% 0 50%))' })]; }
        ],
        climb: [
          function () { return [merge(masked(2), { 'clip-path': 'inset(0)' }), merge(masked(4), { 'clip-path': 'inset(0)' }), merge(masked('top'), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(1), { 'clip-path': 'inset(0)' }), merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked(5), { 'clip-path': 'inset(0)' }), merge(masked('top'), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked('top'), { 'clip-path': 'inset(0)' }), merge(masked(2), { 'clip-path': 'inset(0)' }), merge(masked('top'), { 'clip-path': 'inset(0)' })]; }
        ],
        landing: [
          function () { return [merge(masked(3), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(2), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked('top'), { 'clip-path': 'inset(0)', opacity: '0.14' })]; }
        ]
      },
      // The control itself under a press.
      stamp: {
        opening: [
          function () { return []; },
          function () { return [{ transform: 'none', filter: 'brightness(1.12)' }]; }
        ],
        climb: [
          function (rnd) {
            var depth = pick(rnd, ['0.985', '0.97', '0.955']);
            var sink = pick(rnd, ['0', '1px', '2px']);
            var skew = pick(rnd, ['0deg', '0deg', '0.8deg', '-0.8deg', '1.4deg']);
            var flash = pick(rnd, ['contrast(1.25) brightness(1.08)', 'brightness(1.18)', 'contrast(1.4)', 'none']);
            var t = 'translateY(' + sink + ') scale(' + depth + ') skewX(' + skew + ')';
            return [{ transform: t, filter: flash }, { transform: t, filter: flash }];
          },
          function (rnd) {
            var depth = pick(rnd, ['0.975', '0.96']);
            return [{ transform: 'scale(' + depth + ')', filter: 'contrast(1.3)' }, { transform: 'scale(' + depth + ') translateY(1px)', filter: 'contrast(1.3)' }, { transform: 'scale(' + depth + ')', filter: 'none' }];
          }
        ],
        landing: [
          function () { return [{ transform: 'none', filter: 'none' }]; },
          function () { return [{ transform: 'scale(var(--pop-over, 1.012))', filter: 'none' }, { transform: 'none', filter: 'none' }]; },
          function () { return [{ transform: 'scale(1.01)', filter: 'none' }, { transform: 'scale(0.995)', filter: 'none' }, { transform: 'none', filter: 'none' }]; }
        ]
      },
      // The fill texture arriving on a control that becomes set.
      seal: {
        opening: [
          function () { return [merge(masked(1), { 'clip-path': 'var(--state-from, inset(0 100% 0 0))' })]; },
          function () { return [merge(masked(2), { 'clip-path': 'var(--state-from, inset(0 100% 0 0))' }), merge(masked(1), { 'clip-path': 'inset(0)' })]; },
          function () { return []; }
        ],
        climb: [
          function () { return [merge(masked(2), { 'clip-path': 'inset(0)' }), merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked(4), { 'clip-path': 'inset(0)' }), merge(masked(5), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(2), { 'clip-path': 'inset(0)' }), merge(masked(4), { 'clip-path': 'inset(0)' }), merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked(5), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked(5), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked(2), { 'clip-path': 'inset(0)' }), merge(masked(3), { 'clip-path': 'inset(0)' }), merge(masked('off'), { 'clip-path': 'inset(0)', opacity: '0' }), merge(masked(4), { 'clip-path': 'inset(0)' }), merge(masked(5), { 'clip-path': 'inset(0)' })]; }
        ],
        landing: [
          function () { return [merge(masked('none'), { 'clip-path': 'inset(0)' })]; },
          function () { return [merge(masked('top'), { 'clip-path': 'inset(0)' }), merge(masked('none'), { 'clip-path': 'inset(0)' })]; }
        ]
      },
      // The texture leaving.
      unseal: {
        opening: [
          function () { return [masked('none')]; },
          function () { return [masked('none'), masked(5), masked('none')]; }
        ],
        climb: [
          function () { return [masked(4), masked(3), masked(2)]; },
          function () { return [masked(4), masked(2), masked(3), masked(1)]; },
          function () { return [masked(3), masked(1)]; }
        ],
        landing: [
          function () { return [merge(masked(1), { opacity: '0' })]; }
        ]
      },
      // A thing arriving: from the rolled geometry, through the ladder.
      develop: {
        opening: [
          function () { return [merge(masked('off'), { opacity: '0', transform: 'translate(var(--arrive-x, 0px), var(--arrive-y, 24px)) rotate(var(--arrive-rot, 0deg)) scale(var(--arrive-scale, 0.94)) skewX(var(--arrive-skew, 0deg))' })]; },
          function () { return []; }
        ],
        climb: [
          function () {
            return [
              merge(masked(1), { opacity: '1', transform: 'translate(var(--arrive-x, 0px), var(--arrive-y, 24px)) rotate(var(--arrive-rot, 0deg)) scale(var(--arrive-scale, 0.94)) skewX(var(--arrive-skew, 0deg))' }),
              merge(masked(2), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * 0.6), calc(var(--arrive-y, 24px) * 0.6)) rotate(calc(var(--arrive-rot, 0deg) * 0.6)) scale(calc(var(--arrive-scale, 0.94) + (1 - var(--arrive-scale, 0.94)) * 0.4))' }),
              merge(masked(3), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * 0.25), calc(var(--arrive-y, 24px) * 0.25)) rotate(calc(var(--arrive-rot, 0deg) * 0.25)) scale(1)' }),
              merge(masked(4), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * -0.08), calc(var(--arrive-y, 24px) * -0.08)) scale(var(--pop-over, 1.012))' }),
              merge(masked(5), { opacity: '1', transform: 'none' })
            ];
          },
          function () {
            return [
              merge(masked(1), { opacity: '1', transform: 'translate(var(--arrive-x, 0px), var(--arrive-y, 24px)) scale(var(--arrive-scale, 0.94))' }),
              merge(masked(1), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * 0.7), calc(var(--arrive-y, 24px) * 0.7)) scale(var(--arrive-scale, 0.94))' }),
              merge(masked(3), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * 0.7), calc(var(--arrive-y, 24px) * 0.7)) rotate(var(--arrive-rot, 0deg)) scale(var(--arrive-scale, 0.94))' }),
              merge(masked(2), { opacity: '1', transform: 'translate(calc(var(--arrive-x, 0px) * 0.2), calc(var(--arrive-y, 24px) * 0.2)) scale(1)' }),
              merge(masked(4), { opacity: '1', transform: 'none' }),
              merge(masked(5), { opacity: '1', transform: 'none' })
            ];
          },
          function () {
            return [
              merge(masked(2), { opacity: '1', transform: 'translate(var(--arrive-x, 0px), var(--arrive-y, 24px)) skewX(var(--arrive-skew, 0deg))' }),
              merge(masked(4), { opacity: '1', transform: 'translate(0px, calc(var(--arrive-y, 24px) * -0.15)) skewX(calc(var(--arrive-skew, 0deg) * -0.5)) scale(var(--pop-over, 1.012))' }),
              merge(masked(3), { opacity: '1', transform: 'translate(0px, calc(var(--arrive-y, 24px) * 0.05))' }),
              merge(masked(5), { opacity: '1', transform: 'none' })
            ];
          }
        ],
        landing: [
          function () { return [merge(masked('none'), { opacity: '1', transform: 'none' })]; },
          function () { return [merge(masked('top'), { opacity: '1', transform: 'none' }), merge(masked('none'), { opacity: '1', transform: 'none' })]; },
          function () { return [merge(masked('none'), { opacity: '1', transform: 'scale(1.004)' }), merge(masked('none'), { opacity: '1', transform: 'none' })]; }
        ]
      },
      // A thing leaving: down the ladder, to the rolled geometry, with a refusal.
      unmake: {
        opening: [
          function () { return [merge(masked('none'), { opacity: '1', transform: 'none' })]; },
          function () { return [merge(masked('none'), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * -0.3), calc(var(--leave-y, -20px) * -0.3))' }), merge(masked('none'), { opacity: '1', transform: 'none' })]; }
        ],
        climb: [
          function () {
            return [
              merge(masked(5), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.2), calc(var(--leave-y, -20px) * 0.2)) rotate(calc(var(--leave-rot, 0deg) * 0.3))' }),
              merge(masked(4), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.5), calc(var(--leave-y, -20px) * 0.5)) rotate(calc(var(--leave-rot, 0deg) * 0.6)) scale(calc(1 - (1 - var(--leave-scale, 0.9)) * 0.5))' }),
              merge(masked(5), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.4), calc(var(--leave-y, -20px) * 0.4)) rotate(calc(var(--leave-rot, 0deg) * 0.5))' }),
              merge(masked(2), { opacity: '1', transform: 'translate(var(--leave-x, 0px), var(--leave-y, -20px)) rotate(var(--leave-rot, 0deg)) scale(var(--leave-scale, 0.9))' })
            ];
          },
          function () {
            return [
              merge(masked(4), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.3), calc(var(--leave-y, -20px) * 0.3))' }),
              merge(masked(2), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.7), calc(var(--leave-y, -20px) * 0.7)) scale(var(--leave-scale, 0.9))' }),
              merge(masked(3), { opacity: '1', transform: 'translate(calc(var(--leave-x, 0px) * 0.7), calc(var(--leave-y, -20px) * 0.7)) scale(var(--leave-scale, 0.9))' }),
              merge(masked(1), { opacity: '1', transform: 'translate(var(--leave-x, 0px), var(--leave-y, -20px)) rotate(var(--leave-rot, 0deg)) scale(var(--leave-scale, 0.9))' })
            ];
          }
        ],
        landing: [
          function () { return [merge(masked(1), { opacity: '0', transform: 'translate(var(--leave-x, 0px), var(--leave-y, -20px)) rotate(var(--leave-rot, 0deg)) scale(var(--leave-scale, 0.9))' })]; },
          function () { return [merge(masked('off'), { opacity: '0', transform: 'translate(var(--leave-x, 0px), var(--leave-y, -20px)) scale(var(--leave-scale, 0.9))' })]; }
        ]
      },
      // The veil's ghost leaving.
      'veil-out': {
        opening: [
          function () { return [merge(masked(5), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' })]; },
          function () { return [merge(masked(5), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' }), merge(masked('none'), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' })]; }
        ],
        climb: [
          function () { return [merge(masked(4), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' }), merge(masked(3), { opacity: '1' }), merge(masked(2), { opacity: '1' }), merge(masked(1), { opacity: '1' })]; },
          function () { return [merge(masked(3), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' }), merge(masked(4), { opacity: '1' }), merge(masked(2), { opacity: '1' }), merge(masked(1), { opacity: '1' })]; },
          function () { return [merge(masked(4), { opacity: '1', 'clip-path': 'var(--wipe-to, inset(0))' }), merge(masked(2), { opacity: '1' }), merge(masked('off'), { opacity: '0' }), merge(masked(2), { opacity: '1' }), merge(masked(1), { opacity: '1' })]; }
        ],
        landing: [
          function () { return [merge(masked(1), { opacity: '0', 'clip-path': 'var(--wipe-from, inset(0 0 100% 0))' })]; }
        ]
      }
    };

    /* One composition: a piece from each slot of the kind's vocabulary, a width for every tread,
       written as a rule of its own. Hands back the name, or null where there is no sheet to write
       to (a stub browser, a visitor who asked for less motion), in which case the stylesheet's
       own keyframes play. */
    function compose(kind, options) {
      var opts = options || {};
      var voc = VOCABULARY[kind];
      if (!voc || reduced()) return null;
      var sheet = composedSheetReady();
      if (!sheet || typeof sheet.insertRule !== 'function') return null;
      var rnd = mulberry32(opts.seed == null ? entropy() : (opts.seed >>> 0));
      var states = [];
      var slots = ['opening', 'climb', 'landing'];
      for (var s = 0; s < slots.length; s++) {
        var piece = pick(rnd, voc[slots[s]]);
        var got = piece(rnd);
        for (var i = 0; i < got.length; i++) states.push(got[i]);
      }
      if (states.length < 2) states.push(states[0]);
      composedCount += 1;
      var name = 'rite-' + kind + '-' + composedCount.toString(36) + Math.floor(rnd() * 46656).toString(36);
      var rule = '@keyframes ' + name + ' { ' + framesOf(states, rnd) + '}';
      try {
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {
        return null;
      }
      composedNames.push(name);
      composedSet[name] = true;
      while (composedNames.length > COMPOSED_CAP) {
        var old = composedNames.shift();
        delete composedSet[old];
        try {
          for (var r = 0; r < sheet.cssRules.length; r++) {
            if (sheet.cssRules[r].name === old) {
              sheet.deleteRule(r);
              break;
            }
          }
        } catch (e2) {
          /* it stays until the page goes */
        }
      }
      return name;
    }

    // A composition written on an element: --rite-<kind> names it, --motion-<fallback> is its
    // length rolled for this trigger alone. Hands back the name.
    function composeOn(el, kind, fallback, baseMs, options) {
      if (!el || !el.style) return null;
      var name = compose(kind, options);
      var rnd = mulberry32(entropy());
      var t = temperFor(el);
      var length = Math.round((baseMs || 340) * t.tempo * (0.7 + rnd() * 0.6));
      setInline(el, '--motion-' + fallback, length + 'ms');
      if (name) setInline(el, '--rite-' + kind, name);
      return name;
    }

    /* ---- the state rites ------------------------------------------------------------------- */

    /* A control does not fade. Under the pointer it waxes: its changed surface arrives through the
       matte ladder, tread by tread (is-waxing, @keyframes matte-in), and when the pointer leaves it
       wanes the same way back (is-waning, matte-out). A press stamps it (is-stamping, rite-stamp).
       A control that becomes set is sealed (is-sealing, rite-seal) and one that is unset again is
       unsealed (is-unsealing, rite-unseal). The classes are this file's and the keyframes are the
       stylesheet's (_sass/_controls.scss), so what each rite looks like is the stylesheet's to say
       and when it plays is this file's; a module that paints its own controls plays its own rites
       on its canvas (env.rite, js/variant.js). Every passing class is taken off again when the
       animation it started ends, or after the rolled duration if no animation was there to end,
       so a stylesheet that has no rite for an element leaves no class behind on it. */

    var PRESSABLE = 'a[href], button, input, select, textarea, summary, label, [role="button"], '
      + '[role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], '
      + '[role="menuitem"], [role="link"], [data-rite]';
    // The attributes a control is set by -- a chip pressed, a tab chosen, a knob set, a details
    // opened -- watched over the whole page so the seal plays whoever set it.
    var SET_ATTRS = ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'aria-expanded', 'open', 'data-set', 'data-selected', 'data-on', 'class'];
    var SET_CLASS = /(?:^|\s)(?:is-set|is-on|is-selected|is-active|is-chosen|is-current|is-open|is-lit|selected|active)(?:\s|$)/;
    // What ends each passing rite: the animation whose name says so, or the clock.
    var PASSING = {
      waning: /wane|thaw|matte-out|settle/,
      stamping: /stamp|press|ink/,
      sealing: /(?:^|-)seal(?!ed)|-set$/,
      unsealing: /unseal|unset/,
      dealt: /develop|dealt|-in$/
    };
    // The names known to end a rite, before the regexes above are tried.
    var ENDS = {
      waning: { 'matte-out': 1, 'card-wane': 1, 'chip-wane': 1, 'logo-thaw': 1, 'card-settle': 1 },
      stamping: { 'rite-stamp': 1, 'stamp-ink': 1, 'card-stamp': 1, 'chip-stamp': 1, 'logo-stamp': 1 },
      sealing: { 'rite-seal': 1, 'card-seal': 1 },
      unsealing: { 'rite-unseal': 1, 'card-unseal': 1 },
      dealt: { 'card-develop': 1, 'card-in': 1, 'badge-in': 1 }
    };

    var rites = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function riteState(el) {
      if (!rites) return null;
      var s = rites.get(el);
      if (!s) {
        s = { hover: false, focus: false, timers: {} };
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
      // The clock is the fallback, so it is generous: the animation's end is what takes the class
      // off, and a class that lingers on a still element does nothing.
      var wait = after || ((ms('long') || 560) * 2 + 400);
      if (s && s.timers[kind] && typeof global.clearTimeout === 'function') global.clearTimeout(s.timers[kind]);
      dropClass(el, cls);
      // Off and on again on the next frame, so a rite that is restarted restarts.
      var raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : function (fn) { fn(); };
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

    // A passing rite's animation ending takes its class off; the clock is only for the element
    // the stylesheet gave no animation to.
    function onRiteEnd(ev) {
      var el = ev && ev.target;
      var name = ev && ev.animationName;
      if (!el || !name || !el.classList) return;
      for (var kind in PASSING) {
        if (!Object.prototype.hasOwnProperty.call(PASSING, kind) || !el.classList.contains('is-' + kind)) continue;
        if (ENDS[kind][name] || PASSING[kind].test(name)) endPass(el, kind);
      }
    }

    // A number of an element's own, from where it sits and what it says, so two chips in a row
    // never wax through the same blotches: the matte is shifted by it and its curve rolled by it.
    function seedOf(el) {
      var text = (el.id || '') + '|' + (el.className || '') + '|' + (el.textContent || '').slice(0, 40);
      var h = 2166136261;
      for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
      var kids = el.parentNode && el.parentNode.children ? el.parentNode.children : null;
      var k = 0;
      if (kids) for (var j = 0; j < kids.length; j++) if (kids[j] === el) { k = j; break; }
      return ((h ^ Math.imul(k + 1, 2654435761)) >>> 0);
    }

    function setInline(el, name, value) {
      if (el && el.style && typeof el.style.setProperty === 'function') el.style.setProperty(name, value);
    }

    // The matte shifted to the element's own phase, and its own curve for the climb, written on
    // the element: everything else is the page's roll, so the cost is two inline properties.
    function wax(el) {
      if (!el) return;
      endPass(el, 'waning');
      if (!reduced()) {
        var rnd = mulberry32(seedOf(el) ^ (entropy() & 0xff));
        var t = temperFor(el);
        var sx = Math.round(rnd() * 96);
        var sy = Math.round(rnd() * 96);
        setInline(el, '--matte-shift', sx + 'px ' + sy + 'px');
        setInline(el, '--matte-shift-x', sx + 'px');
        setInline(el, '--matte-shift-y', sy + 'px');
        setInline(el, '--ease-matte-in', cssOf(makeCurve('stair', t, Math.floor(rnd() * 0x7fffffff)), 'stair', rnd));
        composeOn(el, 'wax', 'matte-in', 340);
      }
      addClass(el, 'is-waxing');
    }

    function wane(el) {
      if (!el || !el.classList || !el.classList.contains('is-waxing')) return;
      dropClass(el, 'is-waxing');
      composeOn(el, 'wane', 'matte-out', 340);
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
      wax(el);
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

    // Focus waxes a control only when the focus is one the browser would show (a key brought it
    // there), so a control pressed with the pointer is not left lit after the pointer has gone.
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
      wax(el);
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
      // A key pressed into a field is a word, not a press.
      if (ev.type === 'keydown' && (el.tagName === 'TEXTAREA' || el.isContentEditable
        || (el.tagName === 'INPUT' && !/^(?:button|submit|reset|checkbox|radio|range|color|file)$/i.test(el.type || '')))) return;
      // Where the press landed, as the point the ink spreads from (the middle for a key).
      var px = 50;
      var py = 50;
      if (ev.type !== 'keydown' && typeof el.getBoundingClientRect === 'function' && typeof ev.clientX === 'number') {
        var box = el.getBoundingClientRect();
        if (box.width && box.height) {
          px = clamp(Math.round((ev.clientX - box.left) / box.width * 100), 0, 100);
          py = clamp(Math.round((ev.clientY - box.top) / box.height * 100), 0, 100);
        }
      }
      setInline(el, '--stamp-x', px + '%');
      setInline(el, '--stamp-y', py + '%');
      if (!reduced()) {
        composeOn(el, 'stamp', 'rite-stamp', 170);
        composeOn(el, 'ink', 'stamp-ink', 170);
      }
      pass(el, 'stamping', (ms('medium') || 340) + 400);
    }

    // Set or unset: read off the attribute that changed, so a control set by any script seals.
    function isSet(el, attr) {
      if (attr === 'class') return SET_CLASS.test(el.className || '');
      var v = el.getAttribute(attr);
      if (v == null || v === 'false') return false;
      if (attr === 'aria-expanded') return v === 'true';
      return true;
    }

    function onSetChange(changes) {
      for (var i = 0; i < changes.length; i++) {
        var c = changes[i];
        var el = c.target;
        var attr = c.attributeName;
        if (!el || !attr || !el.classList) continue;
        var was = attr === 'class'
          ? SET_CLASS.test(c.oldValue || '')
          : (c.oldValue != null && c.oldValue !== 'false' && (attr !== 'aria-expanded' || c.oldValue === 'true'));
        var is = isSet(el, attr);
        if (was === is) continue;
        if (el.getAttribute('data-rite') === 'none') continue;
        if (is) dress(el);
        if (reduced()) continue;
        if (is) composeOn(el, 'seal', 'rite-seal', 560);
        else composeOn(el, 'unseal', 'rite-unseal', 340);
        pass(el, is ? 'sealing' : 'unsealing');
      }
    }

    // The texture a control that becomes set wears: rolled for it alone, from its own seed and
    // its own temperament, so no two set controls on a page wear the same hatch at the same
    // angle. Written inline, where the stylesheet's var(--matte-fill) finds it first.
    function dress(el) {
      if (!el || !el.style) return;
      var m = rollMattes(mulberry32(seedOf(el)), temperFor(el));
      setInline(el, '--matte-fill', m.fillImage);
      setInline(el, '--matte-fill-size', m.fillSize);
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

    /* ---- the glyph rite -------------------------------------------------------------------- */

    /* Words do not appear: they are revealed. For the length of the rite each character of the
       element is wrapped in a span.glyph that carries a sigil in its place (data-sigil, which the
       stylesheet shows through ::before) and its own delay (--d), and each word in a span.glyph-word
       so no word breaks in the middle; the stylesheet (_sass/_rite.scss, @keyframes glyph-in and
       glyph-sigil) shows the sigil and then the letter, in a stair. When the last has landed the
       spans are taken out and the text put back, so the element is afterwards exactly what it was,
       and textContent is never anything but the words. A visitor who asked for less motion is
       shown the words. Hands back a function that ends the rite early. */

    var SIGILS = '§¶†‡•¤±÷×¬~^*#%&@=?!/|<>:;.';
    var CURVE_POOL = 4;
    var GLYPH_LIMIT = 160;
    var revealing = typeof global.WeakMap === 'function' ? new global.WeakMap() : null;

    function textNodesOf(el) {
      var out = [];
      if (!doc.createTreeWalker || typeof global.NodeFilter === 'undefined') {
        var kids = el.childNodes;
        for (var i = 0; i < kids.length; i++) if (kids[i].nodeType === 3) out.push(kids[i]);
        return out;
      }
      var walker = doc.createTreeWalker(el, global.NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (/\S/.test(node.nodeValue)) out.push(node);
      }
      return out;
    }

    function reveal(el, options) {
      if (!el || !el.childNodes || !doc.createElement) return function () {};
      var opts = options || {};
      var undoBefore = revealing && revealing.get(el);
      if (undoBefore) undoBefore();
      if (reduced() && !opts.always) return function () {};
      var rnd = mulberry32(entropy());
      var t = temperFor(el);
      var step = Math.max(8, (ms('stagger') || 44) * (opts.pace || 0.42));
      // A pool of curves rolled for this reveal, dealt round the glyphs: each glyph climbs one of
      // four stairs of this line's own, rather than all of them the page's one.
      var pool = [];
      for (var q = 0; q < CURVE_POOL; q++) pool.push(cssOf(makeCurve('stair', t, Math.floor(rnd() * 0x7fffffff)), 'stair', rnd));
      var scramble = opts.scramble == null ? 1 : opts.scramble;
      var nodes = textNodesOf(el);
      var done = [];
      var k = 0;
      var last = 0;
      for (var n = 0; n < nodes.length && k < GLYPH_LIMIT; n++) {
        var node = nodes[n];
        var text = node.nodeValue;
        var parent = node.parentNode;
        if (!parent) continue;
        var frag = doc.createDocumentFragment();
        var words = text.split(/(\s+)/);
        for (var w = 0; w < words.length; w++) {
          var word = words[w];
          if (!word) continue;
          if (/^\s+$/.test(word) || k >= GLYPH_LIMIT) {
            frag.appendChild(doc.createTextNode(word));
            continue;
          }
          var span = doc.createElement('span');
          span.className = 'glyph-word';
          var chars = typeof Array.from === 'function' ? Array.from(word) : word.split('');
          var wordDelay = -1;
          for (var c = 0; c < chars.length; c++) {
            var glyph = doc.createElement('span');
            glyph.className = 'glyph';
            glyph.textContent = chars[c];
            glyph.setAttribute('data-sigil', SIGILS.charAt(Math.floor(rnd() * SIGILS.length)));
            if (scramble > 0) glyph.setAttribute('data-sigil-2', SIGILS.charAt(Math.floor(rnd() * SIGILS.length)));
            var delay = Math.round(k * step + (rnd() - 0.5) * step * (0.8 + t.grain));
            delay = Math.max(0, delay);
            if (delay > last) last = delay;
            if (wordDelay < 0 || delay < wordDelay) wordDelay = delay;
            glyph.style.setProperty('--d', delay + 'ms');
            glyph.style.setProperty('--k', String(k));
            glyph.style.setProperty('--ease-glyph-in', pool[k % CURVE_POOL]);
            span.appendChild(glyph);
            k += 1;
          }
          // The word drops into place as its first glyph lands (a glyph is inline, so it keeps
          // the line's kerning, and the word is what moves).
          span.style.setProperty('--wd', Math.max(0, wordDelay) + 'ms');
          span.style.setProperty('--ease-glyph-word', pool[(k + 1) % CURVE_POOL]);
          frag.appendChild(span);
        }
        var pieces = [];
        for (var f = 0; f < frag.childNodes.length; f++) pieces.push(frag.childNodes[f]);
        parent.replaceChild(frag, node);
        done.push({ parent: parent, node: node, pieces: pieces });
      }
      if (!k) return function () {};
      addClass(el, 'is-revealing');
      var ended = false;
      var timer = 0;
      function undo() {
        if (ended) return;
        ended = true;
        if (timer && typeof global.clearTimeout === 'function') global.clearTimeout(timer);
        if (revealing) revealing['delete'](el);
        dropClass(el, 'is-revealing');
        // Each text node goes back where its first piece is, and the pieces go.
        for (var i = 0; i < done.length; i++) {
          var d = done[i];
          var put = false;
          for (var j = 0; j < d.pieces.length; j++) {
            var piece = d.pieces[j];
            if (piece.parentNode !== d.parent) continue;
            if (!put) {
              d.parent.replaceChild(d.node, piece);
              put = true;
            } else d.parent.removeChild(piece);
          }
          // No piece left means the element was rewritten under the rite: the words there now
          // are the newer ones, and the old node is not put back.
        }
        if (typeof opts.done === 'function') opts.done();
      }
      if (revealing) revealing.set(el, undo);
      var total = last + (ms('long') || 560) + (opts.after || 200);
      if (typeof global.setTimeout === 'function') timer = global.setTimeout(undo, total);
      else undo();
      return undo;
    }

    /* ---- the ghost veil -------------------------------------------------------------------- */

    /* The veil (#lightbox-veil, js/site.js) is hidden the instant what was behind it is put
       away, because the script that lowers it has the page to give back and no time to spend. So
       a ghost of it is left in its place for one more movement: a clone with no id and no name,
       aria-hidden and under no pointer, that the stylesheet plays out (@keyframes
       lightbox-veil-out) and that goes when the animation ends. Raised again before the ghost has
       gone, the veil takes its place back and the ghost goes at once. */

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
      // The ghost keeps the roll it was born with: the shapes, the ladder and the curve are
      // pinned on it, so a roll made while it plays out cannot jump it.
      composeOn(ghost, 'veil-out', 'lightbox-veil-out', 340);
      var pin = ['--wipe-from', '--wipe-to', '--matte-1', '--matte-2', '--matte-3', '--matte-4', '--matte-5', '--matte-top', '--ease-lightbox-veil-out', '--motion-medium'];
      try {
        var computed = global.getComputedStyle(veil);
        for (var i = 0; i < pin.length; i++) {
          var v = computed.getPropertyValue(pin[i]);
          if (v) ghost.style.setProperty(pin[i], v);
        }
      } catch (e) {
        /* it reads the page's roll as it goes */
      }
      veil.parentNode.insertBefore(ghost, veil.nextSibling);
      var mine = ghost;
      mine.addEventListener('animationend', function () { if (ghost === mine) dropGhost(); });
      mine.addEventListener('animationcancel', function () { if (ghost === mine) dropGhost(); });
      if (typeof global.setTimeout === 'function') {
        ghostTimer = global.setTimeout(function () { if (ghost === mine) dropGhost(); }, (ms('long') || 560) * 3 + 600);
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

    /* Things changing places -- the feed dealing a card into a row, a list reordered -- move from
       where they were to where they are, each along a curve of its own, instead of being there.
       Measure, change, measure, move: `flip(container, change)` runs `change()` between two
       measurements of the container's children and sends every child that moved from its old place
       to its new one by the Web Animations API, along a drift curve rolled for it (a stair where
       the browser has no linear()). A child that is new gets the class is-dealt for the stylesheet
       to arrive. A visitor who asked for less motion gets the change. Hands back the animations. */

    /* The treads of a stair curve as keyframe offsets: [t, y] pairs with each tread held to the
       moment of the next, so a movement written from them moves in cuts, never a glide. */
    function treadsOf(curve) {
      var stops = curve.stops;
      var out = [];
      var lastY = 0;
      for (var i = 0; i < stops.length; i++) {
        var t = clamp(stops[i][0], 0, 1);
        var y = stops[i][1];
        if (i > 0 && Math.abs(y - lastY) < 0.02) continue;
        if (out.length) out.push([Math.max(out[out.length - 1][0], t - 0.0005), lastY]);
        out.push([t, y]);
        lastY = y;
      }
      if (!out.length || out[out.length - 1][0] < 1) out.push([1, 1]);
      out[0][0] = 0;
      return out;
    }

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
      for (var b = 0; b < before.length; b++) {
        var el = before[b][0];
        var was = before[b][1];
        if (!el.isConnected && el.ownerDocument && typeof el.isConnected === 'boolean') continue;
        var is = el.getBoundingClientRect();
        if (!is.width && !is.height) continue;
        var dx = was.left - is.left;
        var dy = was.top - is.top;
        var sx = is.width ? was.width / is.width : 1;
        var sy = is.height ? was.height / is.height : 1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
        // From where it was to where it is, in the treads of a stair rolled for it: each tread a
        // held pair of keyframes, so the card jumps its way home and never slides.
        var t = temperFor(el);
        var curve = makeCurve(opts.family || 'stair', t, Math.floor(rnd() * 0x7fffffff));
        var treads = treadsOf(curve);
        var frames = [];
        for (var k = 0; k < treads.length; k++) {
          var y = treads[k][1];
          var tx = dx * (1 - y);
          var ty = dy * (1 - y);
          var ssx = 1 + (sx - 1) * (1 - y);
          var ssy = 1 + (sy - 1) * (1 - y);
          frames.push({
            offset: treads[k][0],
            transform: 'translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px) scale(' + ssx.toFixed(3) + ', ' + ssy.toFixed(3) + ')',
            transformOrigin: '0 0'
          });
        }
        var when = (ms('long') || 560) * (0.8 + rnd() * 0.5);
        try {
          out.push(el.animate(frames, { duration: when, easing: supportsLinear ? 'linear(0, 1)' : 'steps(1, jump-end)', delay: stagger(b) * 0.4, fill: 'backwards' }));
        } catch (e) {
          /* the browser could not read the frames: it is where it is */
        }
      }
      // What is new develops -- unless it is waiting to be seen (a card still rolled up, or one
      // hidden), which develops when its own watcher says so.
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

    /* A movement a script makes in treads: `step(k, n)` is called with the tread reached, 0 to n,
       at the moments a stair rolled for this call puts them -- uneven, with a hold here and a slip
       back there where the grain allows -- and never with a fraction in between; then `done()`.
       What the stage's crossfade, a scroll and a counter move by. Hands back a function that stops
       it. A visitor who asked for less motion gets the last tread at once. */
    function stepper(options) {
      var opts = options || {};
      var total = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
      var cancel = typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
      var rnd = mulberry32(entropy());
      var g = temper.grain;
      var n = Math.max(2, Math.round(opts.treads || (3 + rnd() * (3 + g * 5))));
      if (!raf || !total || (reduced() && !opts.always)) {
        step(n, n, false);
        done();
        return function () {};
      }
      // The moments of the treads: uneven widths, a hold, and a slip or two back by one tread.
      var moments = [];
      var acc = 0;
      var widths = [];
      for (var i = 0; i < n; i++) {
        var w = rnd() * (0.6 + g) + 0.4;
        widths.push(w);
        acc += w;
      }
      var at = 0;
      for (var j = 0; j < n; j++) {
        at += widths[j] / acc;
        moments.push({ at: at, k: j + 1 });
        if (j > 0 && j < n - 1 && rnd() < g * 0.35) {
          moments.push({ at: at + widths[j] / acc * 0.3, k: j, slip: true });
          moments.push({ at: at + widths[j] / acc * 0.55, k: j + 1 });
        }
      }
      moments.sort(function (a, b) { return a.at - b.at; });
      var started = now();
      var handle = 0;
      var stopped = false;
      var next = 0;
      var last = -1;
      function frame(tm) {
        if (stopped) return;
        var p = Math.min(1, Math.max(0, tm - started) / total);
        while (next < moments.length && moments[next].at <= p) {
          if (moments[next].k !== last) {
            last = moments[next].k;
            step(last, n, !!moments[next].slip);
          }
          next += 1;
        }
        if (p < 1) handle = raf(frame);
        else {
          if (last !== n) step(n, n, false);
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

    /* ---- what a script asks for: the rites ------------------------------------------------- */

    // A passing rite on an element, asked for by name: stamp, seal, unseal, wane, or any other the
    // stylesheet has a class is-<name> for.
    function rite(el, name, after) {
      if (!el || !name) return;
      if (name === 'wax') return wax(el);
      if (name === 'wane') return wane(el);
      pass(el, name, after);
    }

    function mattes() {
      return current.mattes;
    }

    // A geometry of an element's own, rolled from a seed and not written on :root.
    function geometryFor(seed, el) {
      return rollGeometry(mulberry32(seed == null ? entropy() : (seed >>> 0)), el ? temperFor(el) : temper);
    }

    // A ladder of an element's own: the five mattes and the fill, rolled from a seed.
    function ladderFor(seed, el) {
      return rollMattes(mulberry32(seed == null ? entropy() : (seed >>> 0)), el ? temperFor(el) : temper);
    }

    /* An arrival of an element's own: its geometry (where it comes from, how far, at what tilt),
       its curve for the named spell and, asked for, its own matte ladder are rolled from a seed
       and written on the element, so a batch of cards dealt together arrives from as many
       directions as there are cards. Then the class the stylesheet plays (is-dealt, or the one
       given). Hands back a function that takes the inline roll off again. */
    function arrive(el, options) {
      if (!el || !el.style) return function () {};
      var opts = options || {};
      var seed = opts.seed == null ? entropy() : (opts.seed >>> 0);
      var rnd = mulberry32(seed);
      var t = temperFor(el);
      var g = rollGeometry(rnd, t);
      var names = [];
      function put(name, value) { setInline(el, name, value); names.push(name); }
      put('--arrive-x', g.arriveX.toFixed(1) + 'px');
      put('--arrive-y', g.arriveY.toFixed(1) + 'px');
      put('--arrive-rot', g.arriveRot.toFixed(2) + 'deg');
      put('--arrive-scale', g.arriveScale.toFixed(3));
      put('--arrive-skew', g.arriveSkew.toFixed(2) + 'deg');
      put('--lift-y', g.liftY.toFixed(1) + 'px');
      put('--lift-rot', g.liftRot.toFixed(2) + 'deg');
      put('--pop-over', g.popOver.toFixed(3));
      var spell = opts.spell || 'card-in';
      put('--ease-' + spell, cssOf(makeCurve(familyOf(spell), t, Math.floor(rnd() * 0x7fffffff)), familyOf(spell), rnd));
      if (opts.mattes) {
        var m = rollMattes(rnd, t);
        for (var i = 0; i < m.ladder.length; i++) put('--matte-' + (i + 1), m.ladder[i]);
        put('--matte-top', m.top);
      }
      // The arrival itself, composed for this element alone, and the leaving it may need later.
      composeOn(el, 'develop', spell, SPELL_MS[familyOf(spell)] || 560, { seed: Math.floor(rnd() * 0x7fffffff) });
      composeOn(el, 'unmake', 'card-out', 340, { seed: Math.floor(rnd() * 0x7fffffff) });
      names.push('--rite-develop', '--rite-unmake', '--motion-' + spell, '--motion-card-out');
      if (opts.className !== false) pass(el, opts.className || 'dealt');
      return function () {
        for (var n = 0; n < names.length; n++) if (el.style && typeof el.style.removeProperty === 'function') el.style.removeProperty(names[n]);
      };
    }

    /* The page's roll, pinned on an element: a thing drawn at its from-keyframe while it waits in
       its delay would move to every new roll made before it starts; pinned, it keeps the roll it
       was dealt. Hands back a function that unpins. */
    function deal(el, options) {
      if (!el || !el.style || typeof global.getComputedStyle !== 'function') return function () {};
      var opts = options || {};
      var names = ['--arrive-x', '--arrive-y', '--arrive-rot', '--arrive-scale', '--arrive-skew',
        '--matte-1', '--matte-2', '--matte-3', '--matte-4', '--matte-5', '--matte-top'];
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

    /* ---- what a script asks for ------------------------------------------------------------ */

    function curve(family) {
      var c = makeCurve(family || 'arrive', temper);
      return { css: c.toCSS(), stops: c.stops, at: function (t) { return c.at(t); } };
    }

    function ease(family) {
      var c = makeCurve(family || 'arrive', temper);
      return function (t) { return c.at(clamp(t, 0, 1)); };
    }

    /* A tween: `step(y, t)` with y the eased progress (which may overshoot) and t the plain one,
       about sixty times a second for `ms`, then `done()`. Hands back a function that stops it. A
       visitor who asked for less motion gets one step at the end and done. */
    function tween(options) {
      var opts = options || {};
      var ms = Math.max(0, Number(opts.ms) || 0);
      var step = typeof opts.step === 'function' ? opts.step : function () {};
      var done = typeof opts.done === 'function' ? opts.done : function () {};
      var raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null;
      var cancel = typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null;
      if (!raf || !ms || (reduced() && !opts.always)) {
        step(1, 1);
        done();
        return function () {};
      }
      var at = ease(opts.family);
      // Asked for treads, the eased progress is stepped onto that many, so even a tween is a
      // stair of its own rather than a glide.
      var treads = opts.treads ? Math.max(2, Math.round(opts.treads)) : 0;
      var started = now();
      var handle = 0;
      var stopped = false;
      function frame(t) {
        if (stopped) return;
        var elapsed = Math.max(0, t - started);
        var p = Math.min(1, elapsed / ms);
        var y = p < 1 ? at(p) : 1;
        if (treads && p < 1) y = Math.floor(clamp(y, 0, 1) * treads) / treads;
        step(y, p);
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

    /* The page scrolls in treads: a stair of jumps rolled for this scroll alone, with a slip back
       where the grain allows, and never a glide -- the browser's own smoothing is refused
       everywhere (README: "Motion axiom"). A wheel, a touch or a key while it is going stops it,
       so the page never fights the visitor. The horizontal position is kept. */
    var scrollStop = null;
    function stopScrolling() {
      if (scrolling) scrolling();
      scrolling = null;
      if (scrollStop) scrollStop();
      scrollStop = null;
    }

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
      var ms = opts.ms || clamp(260 + distance * 0.35, 320, 1100) * temper.tempo;
      var treads = opts.treads || clamp(Math.round(distance / 140), 4, 12);
      var interrupt = ['wheel', 'touchstart', 'keydown'];
      function halt() { stopScrolling(); }
      if (typeof doc.addEventListener === 'function') {
        for (var i = 0; i < interrupt.length; i++) doc.addEventListener(interrupt[i], halt, { passive: true, capture: true });
        scrollStop = function () {
          for (var j = 0; j < interrupt.length; j++) doc.removeEventListener(interrupt[j], halt, { passive: true, capture: true });
        };
      }
      scrolling = stepper({
        ms: ms,
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
      var jitter = (Math.random() - 0.5) * step * (0.6 + temper.grain);
      return Math.max(0, Math.round((Number(k) || 0) * step + jitter));
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
      treads: function (curve) { return treadsOf(curve && curve.stops ? curve : makeCurve('stair', temper)); },
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

  // The pure half, for a test or a build step that wants a curve without a page: the stops and
  // the CSS of a family under a temperament, from a seed.
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
    },
    mattes: function (temper, seed) {
      return rollMattes(mulberry32(seed == null ? entropy() : seed), temper || DEFAULT_TEMPER);
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
