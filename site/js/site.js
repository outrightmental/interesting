(function () {
  var state = window.interestingState;
  var statusEl = document.getElementById('site-pulse-status');
  var linkEl = document.getElementById('site-pulse-link');

  if (!statusEl || !linkEl || !state || typeof state.read !== 'function') {
    return;
  }

  var currentPath = window.location.pathname || '';
  var currentFile = currentPath.split('/').pop() || 'index.html';

  var destinations = [
    {
      href: 'constellation-diary.html',
      label: 'continue: constellation diary',
      desc: 'open constellation diary'
    },
    {
      href: 'constellation-echo.html',
      label: 'continue: echo chamber',
      desc: 'open constellation echo chamber'
    },
    {
      href: 'constellation-weather.html',
      label: 'continue: weather lab',
      desc: 'open constellation weather lab'
    },
    {
      href: 'orbital-weaver.html',
      label: 'continue: orbital weaver',
      desc: 'open orbital weaver'
    },
    {
      href: 'sky-archive.html',
      label: 'continue: sky archive oracle',
      desc: 'open sky archive oracle'
    },
    {
      href: 'star-lantern.html',
      label: 'continue: star lantern ritual',
      desc: 'open star lantern ritual'
    },
    {
      href: 'wish-terrarium.html',
      label: 'continue: wish terrarium',
      desc: 'open wish terrarium'
    },
    {
      href: 'sitemap.html',
      label: 'continue: site map',
      desc: 'open site map'
    }
  ];

  function countStars(value) {
    var list = Array.isArray(value) ? value : [];
    var total = 0;

    for (var i = 0; i < list.length; i++) {
      var star = list[i];
      if (!star || typeof star.x !== 'number' || typeof star.y !== 'number' || typeof star.text !== 'string') {
        continue;
      }
      total += 1;
    }

    return total;
  }

  function hashStars(value) {
    var list = Array.isArray(value) ? value : [];
    var hash = 2166136261;

    for (var i = 0; i < list.length; i++) {
      var star = list[i];
      if (!star || typeof star.x !== 'number' || typeof star.y !== 'number' || typeof star.text !== 'string') {
        continue;
      }

      var sx = Math.round(star.x * 10);
      var sy = Math.round(star.y * 10);

      hash ^= sx;
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      hash ^= sy;
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);

      for (var c = 0; c < star.text.length; c++) {
        hash ^= star.text.charCodeAt(c);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
    }

    return hash >>> 0;
  }

  function setLink(href, text, label) {
    linkEl.setAttribute('href', href);
    linkEl.textContent = text;
    linkEl.setAttribute('aria-label', label);
  }

  var saved = state.read('constellation', []);
  var stars = Array.isArray(saved.value) ? saved.value : [];
  var starCount = countStars(stars);

  if (!starCount) {
    if (saved.status === 'missing' || saved.status === 'ok') {
      statusEl.textContent = 'sky pulse: no saved stars yet. place a few on home, then return to any lab.';
    } else if (saved.status === 'unreadable') {
      statusEl.textContent = 'sky pulse: saved constellation is unreadable. rebuild your sky on home.';
    } else {
      statusEl.textContent = 'sky pulse: shared memory is unavailable in this browser context.';
    }

    setLink('index.html', 'open home constellation', 'open home constellation');
    return;
  }

  statusEl.textContent = 'sky pulse: ' + starCount + ' saved star' + (starCount === 1 ? '' : 's') + ' detected across the site.';

  var hash = hashStars(stars);
  var candidates = [];

  for (var i = 0; i < destinations.length; i++) {
    if (destinations[i].href === currentFile) {
      continue;
    }
    candidates.push(destinations[i]);
  }

  if (!candidates.length) {
    setLink('index.html', 'open home constellation', 'open home constellation');
    return;
  }

  var pick = candidates[hash % candidates.length];
  setLink(pick.href, pick.label, pick.desc);
})();
