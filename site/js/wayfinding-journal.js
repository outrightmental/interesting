/*
  Shared wayfinding trail journal.

  Rendered through _includes/wayfinding.njk on pages that show the world index, this keeps one
  cross-world breadcrumb thread in the shared state document so visitors can rewind, branch, and
  continue exploring as one coherent experience.

  State key: "trail-journal" in window.interestingState.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  if (!store || typeof store.read !== 'function' || typeof store.set !== 'function') return;

  var hosts = Array.prototype.slice.call(document.querySelectorAll('[data-wayfinding-journal]'));
  if (!hosts.length) return;

  var KEY = 'trail-journal';
  var LIMIT = 18;
  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  function collectLabels() {
    var labels = Object.create(null);
    var links = document.querySelectorAll('a[href$=".html"], a[href$=".xml"]');

    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.indexOf('://') !== -1 || href.charAt(0) === '#') continue;
      if (href.indexOf('?') !== -1 || href.indexOf('#') !== -1) continue;
      if (!labels[href]) {
        labels[href] = links[i].textContent ? links[i].textContent.trim() : href;
      }
    }

    return labels;
  }

  function normalize(value) {
    var out = { path: [], branches: 0 };
    if (!value || typeof value !== 'object') return out;

    if (Array.isArray(value.path)) {
      for (var i = 0; i < value.path.length; i++) {
        if (typeof value.path[i] !== 'string') continue;
        if (value.path[i].indexOf('.html') === -1 && value.path[i].indexOf('.xml') === -1) continue;
        out.path.push(value.path[i]);
        if (out.path.length >= LIMIT) break;
      }
    }

    if (typeof value.branches === 'number' && value.branches > 0) {
      out.branches = Math.floor(value.branches);
    }

    return out;
  }

  function save() {
    return store.set(KEY, {
      path: trail.path.slice(-LIMIT),
      branches: trail.branches
    });
  }

  function noteVisit(href) {
    if (!href) return;
    if (!trail.path.length || trail.path[trail.path.length - 1] !== href) {
      trail.path.push(href);
      if (trail.path.length > LIMIT) trail.path = trail.path.slice(-LIMIT);
    }
  }

  function labelFor(href, labels) {
    if (!href) return 'the threshold';
    if (labels[href]) return labels[href];
    return href.replace('.html', '').replace('.xml', '').replace(/-/g, ' ');
  }

  function knownTargets(labels) {
    var keys = Object.keys(labels);
    var out = [];

    for (var i = 0; i < keys.length; i++) {
      var href = keys[i];
      if (href === currentFile) continue;
      if (href === 'sitemap.xml') continue;
      if (href.indexOf('.html') === -1) continue;
      out.push(href);
    }

    return out;
  }

  function orientationWorld() {
    var api = window.threshold;
    if (!api || typeof api.reading !== 'function') return null;

    var reading = api.reading();
    if (!reading || !reading.orientation || typeof reading.orientation.world !== 'string') return null;
    return reading.orientation.world;
  }

  function chooseBranch(labels) {
    var pool = knownTargets(labels);
    if (!pool.length) return 'index.html';

    var preferred = orientationWorld();
    if (preferred) {
      var filtered = pool.filter(function (href) { return href !== preferred; });
      if (filtered.length) pool = filtered;
    }

    var unseen = pool.filter(function (href) { return trail.path.indexOf(href) === -1; });
    if (unseen.length) pool = unseen;

    return pool[Math.floor(Math.random() * pool.length)] || 'index.html';
  }

  function setDisabled(host, disabled) {
    var back = host.querySelector('[data-wayfinding-journal-back]');
    var branch = host.querySelector('[data-wayfinding-journal-branch]');
    var clear = host.querySelector('[data-wayfinding-journal-clear]');

    if (branch) branch.disabled = disabled;
    if (clear) clear.disabled = disabled;
    if (back) {
      back.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (disabled) back.setAttribute('href', 'index.html');
    }
  }

  function render() {
    var labels = collectLabels();
    var persistedLine = persisted
      ? 'Trail saved in this browser.'
      : 'Trail held in memory only for this visit.';

    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var statusEl = host.querySelector('[data-wayfinding-journal-status]');
      var listEl = host.querySelector('[data-wayfinding-journal-list]');
      var backEl = host.querySelector('[data-wayfinding-journal-back]');
      var branchBtn = host.querySelector('[data-wayfinding-journal-branch]');
      var clearBtn = host.querySelector('[data-wayfinding-journal-clear]');

      if (!statusEl || !listEl || !backEl || !branchBtn || !clearBtn) continue;

      while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild);
      }

      if (readStatus === 'unreadable') {
        setDisabled(host, true);
        statusEl.textContent = 'Trail memory is unreadable in this browser context.';
        var unreadable = document.createElement('li');
        unreadable.className = 'current';
        unreadable.textContent = 'Clear state from the menu to start a fresh trail.';
        listEl.appendChild(unreadable);
        continue;
      }

      if (readStatus === 'unavailable') {
        setDisabled(host, true);
        statusEl.textContent = 'Storage is unavailable here. Trail controls work only in memory on this page.';
        var unavailable = document.createElement('li');
        unavailable.className = 'current';
        unavailable.textContent = 'Use surprise jump or counter-jump for this visit.';
        listEl.appendChild(unavailable);
        continue;
      }

      setDisabled(host, false);

      var length = trail.path.length;
      statusEl.textContent = 'Trail length ' + length + ' · branches ' + trail.branches + '. ' + persistedLine;

      var recent = trail.path.slice(Math.max(0, length - 5));
      if (!recent.length) recent = [currentFile];

      for (var r = 0; r < recent.length; r++) {
        var href = recent[r];
        var li = document.createElement('li');
        if (href === currentFile) {
          var current = document.createElement('span');
          current.className = 'current';
          current.textContent = labelFor(href, labels) + ' (you are here)';
          li.appendChild(current);
        } else {
          var link = document.createElement('a');
          link.href = href;
          link.textContent = labelFor(href, labels);
          li.appendChild(link);
        }
        listEl.appendChild(li);
      }

      var previous = length > 1 ? trail.path[length - 2] : 'index.html';
      backEl.href = previous;
      backEl.textContent = 'rewind to ' + labelFor(previous, labels);

      if (!branchBtn.hasAttribute('data-bound')) {
        branchBtn.setAttribute('data-bound', 'true');
        branchBtn.addEventListener('click', function () {
          trail.branches += 1;
          persisted = save();
          var destination = chooseBranch(collectLabels());
          window.location.href = destination;
        });
      }

      if (!clearBtn.hasAttribute('data-bound')) {
        clearBtn.setAttribute('data-bound', 'true');
        clearBtn.addEventListener('click', function () {
          trail.path = [currentFile];
          trail.branches = 0;
          persisted = save();
          render();
        });
      }
    }
  }

  var read = store.read(KEY, { path: [], branches: 0 });
  var readStatus = read.status;
  var trail = normalize(read.value);
  var persisted = false;

  if (readStatus === 'ok' || readStatus === 'missing') {
    noteVisit(currentFile);
    persisted = save();
  }

  render();
})();
