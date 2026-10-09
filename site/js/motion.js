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
      --matte-fill, --matte-fill-size, --matte-kind
                        the texture a surface that stays changed (pressed, selected, set) is
                        filled with, in the colour of its text, and the kind of matte rolled

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
      m.reveal(el)                // the words of el arrive glyph by glyph, each through a sigil
      m.flip(list, change)        // run change(); every child of list that moved moves there
      m.rite(el, 'stamping')      // one passing rite on el, by the name of its class is-<name>
      m.wax(el) / m.wane(el)      // el under the pointer, and the pointer leaving it
      m.mattes()                  // the matte ladder and the fill, as the strings that were written
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

  function readTemper(doc) {
    var temper = { grain: DEFAULT_TEMPER.grain, tempo: DEFAULT_TEMPER.tempo, steps: DEFAULT_TEMPER.steps };
    if (!doc || typeof global.getComputedStyle !== 'function') return temper;
    var style;
    try {
      style = global.getComputedStyle(doc.documentElement);
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
    var span = until - this.t;
    var n = Math.max(1, bounces);
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
    'stage-develop': 'stair',
    'persona-beckon': 'pulse',
    'persona-flight': 'arrive',
    'persona-flight-ring': 'leave',
    'rite-turn': 'drift',
    'rite-shift': 'flicker',
    'matte-in': 'stair',
    'matte-out': 'stair',
    'rite-stamp': 'flicker',
    'rite-seal': 'stair',
    'rite-unseal': 'stair',
    'glyph-in': 'arrive',
    'glyph-sigil': 'flicker',
    'dialog-in': 'arrive',
    'knob-in': 'arrive',
    'seal-set': 'stair',
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
    'shell-unmake': 'leave'
  };

  function familyOf(name) {
    if (FAMILIES[name]) return name;
    if (SPELLS[name]) return SPELLS[name];
    if (/out|leave|gone|away|reject|unseal/.test(name)) return 'leave';
    if (/turn|spin|drift/.test(name)) return 'drift';
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
  function noiseMatte(rnd, coverage, seed, frequency, octaves, fractal) {
    var n = 10;
    var table = [];
    for (var i = 0; i < n; i++) table.push(i / (n - 1) < 1 - coverage ? 0 : 1);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">'
      + '<filter id="m" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
      + '<feTurbulence type="' + (fractal ? 'fractalNoise' : 'turbulence') + '" baseFrequency="' + frequency + '" numOctaves="' + octaves + '" seed="' + seed + '" stitchTiles="stitch"/>'
      + '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/>'
      + '<feComponentTransfer><feFuncA type="discrete" tableValues="' + table.join(' ') + '"/></feComponentTransfer>'
      + '</filter><rect width="96" height="96" filter="url(#m)"/></svg>';
    return svgURI(svg) + ' 0 0 / 96px 96px repeat';
  }

  // Shards: a scatter of rolled triangles over the tile, as many drawn as the coverage asks.
  function shardMatte(shards, coverage) {
    var count = Math.round(shards.length * coverage);
    var polys = '';
    for (var i = 0; i < count; i++) polys += '<polygon points="' + shards[i] + '"/>';
    if (coverage >= 1) polys = '<rect width="120" height="120"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' + polys + '</svg>';
    return svgURI(svg) + ' 0 0 / 120px 120px repeat';
  }

  function rollShards(rnd) {
    var shards = [];
    for (var i = 0; i < 26; i++) {
      var cx = rnd() * 120;
      var cy = rnd() * 120;
      var r = 14 + rnd() * 34;
      var a = rnd() * Math.PI * 2;
      var pts = [];
      for (var k = 0; k < 3; k++) {
        var ang = a + k * (Math.PI * 2 / 3) + (rnd() - 0.5) * 0.8;
        pts.push((cx + Math.cos(ang) * r).toFixed(1) + ',' + (cy + Math.sin(ang) * r).toFixed(1));
      }
      shards.push(pts.join(' '));
    }
    return shards;
  }

  function rollMattes(rnd, temper) {
    var g = temper.grain;
    var kind = temper.steps > 0.5 && rnd() < 0.5 ? (rnd() < 0.5 ? 'scan' : 'dither') : MATTE_KINDS[Math.floor(rnd() * MATTE_KINDS.length)];
    var ladder = [];
    var coverages = [0.1 + rnd() * 0.08, 0.26 + rnd() * 0.1, 0.46 + rnd() * 0.12, 0.7 + rnd() * 0.12, 1];
    var i;
    if (kind === 'noise' || kind === 'grain') {
      var seed = 1 + Math.floor(rnd() * 9999);
      var frequency = (kind === 'grain' ? 0.08 + rnd() * 0.12 : 0.012 + rnd() * 0.05).toFixed(4);
      var octaves = 1 + Math.floor(rnd() * 3);
      var fractal = rnd() < 0.5;
      for (i = 0; i < 5; i++) ladder.push(noiseMatte(rnd, coverages[i], seed, frequency, octaves, fractal));
    } else if (kind === 'shards') {
      var shards = rollShards(rnd);
      for (i = 0; i < 5; i++) ladder.push(shardMatte(shards, coverages[i]));
    } else if (kind === 'scan') {
      var angle = Math.round(rnd() < 0.6 ? (rnd() < 0.5 ? 0 : 90) : rnd() * 180);
      var period = 3 + Math.round(rnd() * 9);
      for (i = 0; i < 5; i++) {
        var band = Math.max(1, Math.round(period * coverages[i]));
        ladder.push(i === 4 ? 'linear-gradient(#000, #000)'
          : 'repeating-linear-gradient(' + angle + 'deg, #000 0 ' + band + 'px, transparent ' + band + 'px ' + period + 'px)');
      }
    } else if (kind === 'dither') {
      var cell = 4 + Math.round(rnd() * 6);
      for (i = 0; i < 5; i++) {
        var on = Math.max(2, Math.round(cell * Math.sqrt(coverages[i])));
        ladder.push(i === 4 ? 'linear-gradient(#000, #000)'
          : 'radial-gradient(#000 ' + (on / 2).toFixed(1) + 'px, transparent ' + (on / 2 + 0.5).toFixed(1) + 'px) 0 0 / ' + cell + 'px ' + cell + 'px repeat');
      }
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
    return { kind: kind, ladder: ladder, fill: fill, fillImage: image, fillSize: size, grain: g };
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
    var current = { curves: {}, spells: {}, durations: null, geometry: null };
    var inFlight = {}; // animation name -> how many are running
    var running = 0; // all of them, the ones that loop for ever aside
    var looping = { 'persona-beckon': true, 'rite-turn': true }; // the ones that never end
    var spellWanted = {}; // spells that finished while something else was still in flight
    var geometryWanted = false; // a roll asked for while something was in flight
    var bootAt = 0;
    var lastRoll = 0;
    var breathTimer = null;

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

    function rollSpell(name) {
      var rnd = mulberry32(entropy());
      var family = familyOf(name);
      var curve = makeCurve(family, temper, Math.floor(rnd() * 0x7fffffff));
      current.spells[name] = curve;
      write('--ease-' + name, cssOf(curve, family, rnd));
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
      write('--matte-kind', m.kind);
    }

    var TRANSITION_FAMILIES = ['shift', 'flicker', 'stair'];
    var ALL_FAMILIES = ['arrive', 'leave', 'shift', 'flicker', 'pulse', 'drift', 'wipe', 'stair'];

    function rollAll() {
      temper = readTemper(doc);
      rollFamilies(ALL_FAMILIES);
      for (var name in SPELLS) if (Object.prototype.hasOwnProperty.call(SPELLS, name)) rollSpell(name);
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
      if (at - lastQuick < 48) return;
      lastQuick = at;
      rollFamilies(TRANSITION_FAMILIES);
      if (!withGeometry) return;
      if (!running) {
        rollGeometryNow();
        rollMattesNow();
      } else geometryWanted = true;
    }

    function onPress() {
      rollQuick(true);
    }

    function onPass() {
      rollQuick(false);
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
        if (!running) rollGeometryNow();
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
      if (running) return;
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
    function breathe() {
      if (typeof global.setTimeout !== 'function') return;
      var wait = 12000 + Math.random() * 18000;
      breathTimer = global.setTimeout(function () {
        if (now() - lastRoll > 4000) {
          if (running) rollFamilies(TRANSITION_FAMILIES);
          else rollAll();
        }
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
        if (typeof global.clearTimeout === 'function' && shiftTimer) global.clearTimeout(shiftTimer);
        if (typeof global.setTimeout === 'function') {
          shiftTimer = global.setTimeout(function () {
            if (token === shiftToken) html.removeAttribute('data-shifting');
          }, (current.durations ? current.durations.shift : 640) + 80);
        }
      });
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
      waning: /out|wane/,
      stamping: /stamp|press/,
      sealing: /(?:^|-)seal|set/,
      unsealing: /unseal|unset/
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
        if (Object.prototype.hasOwnProperty.call(PASSING, kind)
          && el.classList.contains('is-' + kind) && PASSING[kind].test(name)) {
          endPass(el, kind);
        }
      }
    }

    function wax(el) {
      if (!el) return;
      endPass(el, 'waning');
      addClass(el, 'is-waxing');
    }

    function wane(el) {
      if (!el || !el.classList || !el.classList.contains('is-waxing')) return;
      dropClass(el, 'is-waxing');
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
        if (reduced()) continue;
        if (el.getAttribute('data-rite') === 'none') continue;
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
      var step = Math.max(8, (ms('stagger') || 44) * (opts.pace || 0.42));
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
          for (var c = 0; c < chars.length; c++) {
            var glyph = doc.createElement('span');
            glyph.className = 'glyph';
            glyph.textContent = chars[c];
            glyph.setAttribute('data-sigil', SIGILS.charAt(Math.floor(rnd() * SIGILS.length)));
            var delay = Math.round(k * step + (rnd() - 0.5) * step * (0.8 + temper.grain));
            delay = Math.max(0, delay);
            if (delay > last) last = delay;
            glyph.style.setProperty('--d', delay + 'ms');
            glyph.style.setProperty('--k', String(k));
            span.appendChild(glyph);
            k += 1;
          }
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
          if (!put && d.parent.appendChild) d.parent.appendChild(d.node);
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

    function flip(container, change, options) {
      var opts = options || {};
      var kids = container && container.children ? container.children : null;
      var before = [];
      var can = kids && !reduced() && typeof Element !== 'undefined' && Element.prototype
        && typeof Element.prototype.animate === 'function';
      if (can) {
        for (var i = 0; i < kids.length; i++) before.push([kids[i], kids[i].getBoundingClientRect()]);
      }
      if (typeof change === 'function') change();
      if (!can) return [];
      var out = [];
      for (var b = 0; b < before.length; b++) {
        var el = before[b][0];
        var was = before[b][1];
        if (el.parentNode !== container) continue;
        var is = el.getBoundingClientRect();
        var dx = was.left - is.left;
        var dy = was.top - is.top;
        var sx = is.width ? was.width / is.width : 1;
        var sy = is.height ? was.height / is.height : 1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
        var c = makeCurve(opts.family || 'drift', temper);
        var easing = supportsLinear ? c.toCSS() : 'steps(' + (4 + Math.round(temper.grain * 6)) + ', jump-end)';
        var when = ms('long') || 560;
        try {
          out.push(el.animate([
            { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ', ' + sy.toFixed(3) + ')', transformOrigin: '0 0' },
            { transform: 'none', transformOrigin: '0 0' }
          ], { duration: when * (0.8 + Math.random() * 0.5), easing: easing, delay: stagger(b) * 0.4, fill: 'backwards' }));
        } catch (e) {
          /* the browser could not read the curve: it is where it is */
        }
      }
      for (var k = 0; k < kids.length; k++) {
        var fresh = true;
        for (var q = 0; q < before.length; q++) if (before[q][0] === kids[k]) { fresh = false; break; }
        if (fresh) pass(kids[k], 'dealt');
      }
      return out;
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
      var started = now();
      var handle = 0;
      var stopped = false;
      function frame(t) {
        if (stopped) return;
        var elapsed = Math.max(0, t - started);
        var p = Math.min(1, elapsed / ms);
        step(p < 1 ? at(p) : 1, p);
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

    function scrollTo(top, options) {
      var opts = options || {};
      var from = typeof global.scrollY === 'number' ? global.scrollY : (global.pageYOffset || 0);
      var to = Math.max(0, Number(top) || 0);
      if (scrolling) scrolling();
      if (reduced() || typeof global.scrollTo !== 'function' || Math.abs(to - from) < 2) {
        if (typeof global.scrollTo === 'function') global.scrollTo(0, to);
        return;
      }
      var distance = Math.abs(to - from);
      var ms = opts.ms || clamp(260 + distance * 0.35, 320, 1100) * temper.tempo;
      scrolling = tween({
        ms: ms,
        family: 'scroll',
        step: function (y) { global.scrollTo(0, from + (to - from) * y); },
        done: function () { scrolling = null; }
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
      if (!d) return 0;
      return d[name] || 0;
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
      rite: rite,
      wax: wax,
      wane: wane,
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
