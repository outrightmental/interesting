/*
  Shared constellation remixer for the sky circuit pages.

  Rendered through _includes/footer.njk, this gives every constellation world one federated way to
  mutate the same saved sky, so each page can become the launch point for cross-world remixes.

  State keys inside the shared interestingState document:
    - constellation                 the shared sky used by the circuit worlds
    - constellation-remix-snapshot  one-step undo for the remixer actions
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var statusEl = document.getElementById('constellation-remixer-status');
  var shiftBtn = document.getElementById('constellation-remixer-shift');
  var sparkBtn = document.getElementById('constellation-remixer-spark');
  var undoBtn = document.getElementById('constellation-remixer-undo');

  if (!statusEl || !shiftBtn || !sparkBtn || !undoBtn) return;

  var SKY = 'constellation';
  var SNAPSHOT = 'constellation-remix-snapshot';
  var MAX_STARS = 160;

  var SPARK_TEXT = [
    'A side trail can still reach the summit.',
    'Try the odd move and inspect what follows.',
    'One playful mutation can open five doors.',
    'Small changes travel farther than expected.',
    'Leave one bright clue for your next self.',
    'Rearrange one point and read the whole sky again.',
    'Curious detours produce usable maps.',
    'The pattern shifts when one point moves.'
  ];

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function countStars(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function cloneStars(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (star) {
      return star && typeof star.x === 'number' && typeof star.y === 'number' && typeof star.text === 'string';
    }).map(function (star) {
      return {
        x: Number(clamp(star.x, 0, 100).toFixed(2)),
        y: Number(clamp(star.y, 0, 100).toFixed(2)),
        text: star.text
      };
    });
  }

  function randomText(seed) {
    return SPARK_TEXT[Math.abs(seed) % SPARK_TEXT.length];
  }

  function describeStorage(persisted) {
    return persisted ? 'Saved for your next visit.' : 'Kept in memory only for this visit.';
  }

  function setStatus(message, good) {
    statusEl.textContent = message;
    if (good) statusEl.classList.add('good');
    else statusEl.classList.remove('good');
  }

  function saveSnapshot(stars) {
    store.set(SNAPSHOT, {
      stars: cloneStars(stars),
      at: Date.now()
    });
  }

  function loadSnapshot() {
    var saved = store.read(SNAPSHOT, null);
    if (saved.status !== 'ok' || !saved.value || typeof saved.value !== 'object') return null;
    var stars = cloneStars(saved.value.stars).slice(0, MAX_STARS);
    if (!stars.length) return null;
    return stars;
  }

  function loadSky() {
    var saved = store.read(SKY, []);
    var stars = cloneStars(saved.value).slice(0, MAX_STARS);
    return { status: saved.status, stars: stars };
  }

  function saveSky(stars) {
    return store.set(SKY, cloneStars(stars).slice(0, MAX_STARS));
  }

  function centroid(stars) {
    var cx = 0;
    var cy = 0;
    for (var i = 0; i < stars.length; i++) {
      cx += stars[i].x;
      cy += stars[i].y;
    }
    return {
      x: cx / stars.length,
      y: cy / stars.length
    };
  }

  function remixOne() {
    var loaded = loadSky();
    var stars = loaded.stars;

    if (!stars.length) {
      if (loaded.status === 'missing') {
        setStatus('No saved constellation yet. Place stars in the wish constellation first.', false);
      } else if (loaded.status === 'unreadable') {
        setStatus('Saved constellation data is unreadable. Clear state, then build a fresh sky.', false);
      } else if (loaded.status === 'unavailable') {
        setStatus('Storage is unavailable here, so there is no saved sky to remix yet.', false);
      } else {
        setStatus('A sky file exists, but no readable stars were found.', false);
      }
      return;
    }

    saveSnapshot(stars);

    var center = centroid(stars);
    var index = (Date.now() + stars.length * 19) % stars.length;
    var chosen = stars[index];
    var angle = ((Date.now() % 360) * Math.PI) / 180;
    var step = 2.5 + ((index % 7) * 0.65);

    chosen.x = Number(clamp(chosen.x + Math.cos(angle) * step + (chosen.x - center.x) * 0.03, 2, 98).toFixed(2));
    chosen.y = Number(clamp(chosen.y + Math.sin(angle) * step + (chosen.y - center.y) * 0.03, 2, 98).toFixed(2));

    if ((Date.now() + index) % 3 === 0) {
      chosen.text = randomText(index + stars.length + Math.floor(chosen.x * 10));
    }

    var persisted = saveSky(stars);
    setStatus('Remixed one star out of ' + stars.length + '. ' + describeStorage(persisted), true);
  }

  function seedSparks() {
    var loaded = loadSky();
    var stars = loaded.stars;

    saveSnapshot(stars);

    var baseX = stars.length ? centroid(stars).x : 50;
    var baseY = stars.length ? centroid(stars).y : 50;
    var seed = Date.now() + stars.length * 31;

    for (var i = 0; i < 3; i++) {
      stars.push({
        x: Number(clamp(baseX + Math.cos(seed * 0.0013 + i * 2.1) * (10 + i * 3), 2, 98).toFixed(2)),
        y: Number(clamp(baseY + Math.sin(seed * 0.0011 + i * 1.7) * (8 + i * 2.5), 2, 98).toFixed(2)),
        text: randomText(seed + i * 17)
      });
    }

    if (stars.length > MAX_STARS) {
      stars = stars.slice(stars.length - MAX_STARS);
    }

    var persisted = saveSky(stars);
    setStatus('Seeded three sparks. Shared sky now holds ' + stars.length + ' stars. ' + describeStorage(persisted), true);
  }

  function undoRemix() {
    var snapshot = loadSnapshot();
    if (!snapshot) {
      setStatus('No remix snapshot to restore yet.', false);
      return;
    }

    var persisted = saveSky(snapshot);
    setStatus('Last remix restored. Sky now holds ' + countStars(snapshot) + ' stars. ' + describeStorage(persisted), true);
  }

  function initStatus() {
    var loaded = loadSky();
    if (loaded.stars.length) {
      setStatus('Shared sky loaded: ' + loaded.stars.length + ' stars ready to remix.', true);
      return;
    }
    if (loaded.status === 'missing') {
      setStatus('No saved constellation yet. Seed your first stars in the wish constellation.', false);
      return;
    }
    if (loaded.status === 'unreadable') {
      setStatus('Saved constellation data is unreadable in this browser context.', false);
      return;
    }
    if (loaded.status === 'unavailable') {
      setStatus('Storage is unavailable here. Remixes can still run in memory for this visit.', false);
      return;
    }
    setStatus('A sky file exists, but no readable stars were found.', false);
  }

  shiftBtn.addEventListener('click', remixOne);
  sparkBtn.addEventListener('click', seedSparks);
  undoBtn.addEventListener('click', undoRemix);

  initStatus();
})();
