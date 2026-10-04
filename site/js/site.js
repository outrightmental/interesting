/*
  The pulse in the site header, on every page: what the shared local-state document is already
  holding for this visitor, and one step back to it.

  It used to count the stars saved on the home page and then rotate a visitor through the sky pages.
  The constellation is not on the home page any more, and the site no longer assumes anyone wants
  the sky (issue #30), so this line never guesses at what a visitor likes: the step it offers points
  only at work they made themselves, and while they have made none it points at the mood atlas,
  where every orientation is laid out and none is the default. Where to go *next* is the mood
  ribbon's business, and follows the reading js/threshold.js takes.

  Reads nothing itself: the saved state arrives through window.interestingState (js/state.js), which
  the layout loads first. Its classes are site-pulse*; every site-meta* name belongs to the meta
  menu js/state.js draws, which is not this site's to restyle.
*/
(function () {
  'use strict';

  var store = window.interestingState;
  var statusEl = document.getElementById('site-pulse-status');
  var linkEl = document.getElementById('site-pulse-link');

  if (!statusEl || !linkEl || !store || typeof store.read !== 'function') {
    return;
  }

  /* The names the shared document keeps, the page each one belongs to, and what to call the things
     under it. A page that starts keeping something new belongs here beside its name; a name this
     list does not know is simply not reported. "threshold" is left out on purpose: what the site
     has read about a visitor is the ribbon's to say, in the ribbon's own words. */
  var KEPT = [
    { key: 'constellation', href: 'wish-constellation.html', where: 'the wish constellation',
      one: 'star', many: 'stars' },
    { key: 'capsules', href: 'constellation-diary.html', where: 'the diary',
      one: 'entry', many: 'entries' },
    { key: 'omens', href: 'sky-archive.html', where: 'the archive oracle',
      one: 'omen', many: 'omens' },
    { key: 'apocrypha', href: 'apocrypha-desk.html', where: 'the apocrypha desk',
      one: 'specimen', many: 'specimens' },
    { key: 'kiln', href: 'word-kiln.html', where: 'the word kiln' },
    { key: 'loam', href: 'loam.html', where: 'loam' },
    { key: 'quiet-room', href: 'quiet-room.html', where: 'the quiet room' }
  ];

  // How many worlds the line names before it stops counting them out.
  var NAMED = 2;

  var currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';

  /* Something is there to go back to. A page keeps either a list of things or one settled object,
     so an empty list is nothing kept -- which is what a visitor who has opened a world and left it
     alone has. */
  function held(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return !!value && typeof value === 'object';
  }

  function phrase(kept, value) {
    var n = Array.isArray(value) ? value.length : 0;
    if (!kept.one || !n) {
      return 'what you left in ' + kept.where;
    }
    return n + ' ' + (n === 1 ? kept.one : kept.many) + ' in ' + kept.where;
  }

  function sentence(parts) {
    if (parts.length === 1) {
      return parts[0];
    }
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  // 'unavailable' and 'unreadable' are the whole document's business rather than any one name's, so
  // the first read settles them and there is nothing to learn from reading the rest.
  var found = [];
  var trouble = null;

  for (var i = 0; i < KEPT.length; i++) {
    var saved = store.read(KEPT[i].key, null);
    if (saved.status === 'unavailable' || saved.status === 'unreadable') {
      trouble = saved.status;
      break;
    }
    if (held(saved.value)) {
      found.push({ kept: KEPT[i], value: saved.value });
    }
  }

  // Nothing to go back to leaves the link exactly as the layout wrote it, which is the one
  // destination that assumes nothing: the atlas of every orientation.
  if (trouble === 'unavailable') {
    statusEl.textContent = 'this browser stores nothing, so nothing you make here will be waiting.';
    return;
  }
  if (trouble === 'unreadable') {
    statusEl.textContent = 'what this browser saved cannot be read. the state menu can clear it.';
    return;
  }
  if (!found.length) {
    statusEl.textContent = 'nothing kept in this browser yet.';
    return;
  }

  var named = [];
  for (i = 0; i < found.length && i < NAMED; i++) {
    named.push(phrase(found[i].kept, found[i].value));
  }
  var rest = found.length - named.length;
  if (rest) {
    named.push(rest === 1 ? 'one more world' : rest + ' more worlds');
  }
  statusEl.textContent = 'kept here: ' + sentence(named) + '.';

  for (i = 0; i < found.length; i++) {
    if (found[i].kept.href !== currentFile) {
      linkEl.setAttribute('href', found[i].kept.href);
      linkEl.textContent = 'back to ' + found[i].kept.where;
      return;
    }
  }
})();
