/*
  The way in: one prominent button, pinned to the bottom edge of every page, that sends a visitor
  to a new issue on this repository with the form already picked and the page they were on already
  filled in. Steering this site should be no harder than looking at it.

  One line in the <head> of a page carries it:

      <script src='js/participate.js' defer></script>

  Deferred, like the analytics and mood lines beside it: nothing on the page waits for this, and
  there is no API for a page to call. The button is drawn once the body is there and then sits
  still.

  ---------------------------------------------------------------------------------------------
  The cadre of meta-menus

  Three affordances are pinned to the edge of the viewport on every page of this site, and they are
  the only three:

      bottom-left     "cookies", the consent banner's way back to the choice   (js/analytics.js)
      bottom-centre   "steer the site", this one                               (this file)
      bottom-right    "state", the one local-state document, in and out        (js/state.js)

  They are a cadre of their own rather than part of the site's visual language: each injects its
  own styles instead of reading a stylesheet, each is fixed to the device boundary instead of
  placed in page content, and none of them is a page's to restyle. That is what makes them
  reliable -- each is something a visitor has to be able to find wherever they are, whatever the
  page around it has become.

  This one is the prominent member of the three. The other two are quiet on purpose: they answer a
  question a visitor only occasionally has. This one is an invitation, so it is full strength, it
  carries an icon that says what it does, and it is the only one of the three in the middle of the
  edge, where the eye lands. It reserves 9.5rem of the bottom edge for its two neighbours
  (max-width below), so the three never meet, even on a 320px screen.

  ---------------------------------------------------------------------------------------------
  What travels

  The link carries two things and nothing else: the name of the issue form to open, and the file
  name of the page the visitor pressed it on. Everything else is for the person to write.

  Nothing of the visitor goes with it -- not their constellation, not what the mood flow has read
  of them, not a single value out of the local-state document. The site's bargain is that what it
  keeps stays in the visitor's own browser and is sent nowhere (see js/state.js and the consent
  banner's wording), and a new-issue URL is a public page. The one exception is the page name,
  which is about the site rather than the person, and which saves them the trouble of describing
  where they were.

  ---------------------------------------------------------------------------------------------
  Responsive and accessible, like every other part of this site

  WCAG 2.2 level AA, and the parts a fixed affordance owns itself:

    - an accessible name that says where the link goes and that it opens a new tab, with the
      visible words inside it (2.5.3 Label in Name);
    - its own focus ring, because pages of this site are free to take the browser's away for their
      own controls and several do (2.4.7 Focus Visible);
    - a 44px target, and a label that never grows into either corner (2.5.8 Target Size);
    - no motion of any kind, so there is nothing to answer for when less of it is asked for;
    - rem units throughout, so a visitor who enlarges text enlarges the button and the room it
      leaves its neighbours together.

  ---------------------------------------------------------------------------------------------
  Out of reach

  The AI iteration may rewrite any page of this site, so this file is kept out of its reach, like
  the analytics files and the local-state store: see PARTICIPATE_SCRIPT, FIXED_FILES and
  check_participate in .github/scripts/make_interesting.py. A visitor's way of saying what this
  site should become cannot be something a run might quietly reword, move or drop -- it is the one
  affordance on the site that answers to the person reading it rather than to the model writing it.
*/
(function () {
  'use strict';

  // Where a visitor is sent. The query names one of the issue forms in .github/ISSUE_TEMPLATE/ by
  // its file name, which is how a link picks a form, so the page they land on is already shaped
  // around the question "what should this site become?" instead of being an empty box.
  var NEW_ISSUE = 'https://github.com/outrightmental/interesting/issues/new';
  var TEMPLATE = 'steer-the-site.yml';
  // The id of that form's "where you were" field. A new-issue link may fill in any field of a form
  // by its id, and this is the only one this link fills.
  var WHERE_FIELD = 'where';

  var LABEL = 'steer the site';
  var NAME = 'Steer the site: file an issue on GitHub saying what this site should do next. ' +
    'Opens in a new tab.';

  // A page of this site as a file name: lowercase, no folder, no query, nothing to escape. Only a
  // name shaped like this is carried into the link, so whatever a path turns out to hold -- a
  // search string, a sub-path a copy of the site is served under, a stray character -- cannot be.
  var PAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,59}$/;

  /* A speech balloon with a plus in it: the verb is input. Not decoration, so it is drawn at the
     label's size and sits beside words rather than instead of them. aria-hidden, because the link
     is named by its text and by NAME above; a second name here would only be read out twice. */
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M20 4H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3v3.4L11.4 17H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"' +
    ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<path d="M12 8v5M9.5 10.5h5" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ' stroke-linecap="round"/></svg>';

  /* The styles live here rather than in a stylesheet for the same reason the other two corner
     affordances' do: every page of this site may be rewritten by an AI run, and this must not be
     rewritten with them. Nothing in here moves, so there is no motion to answer for. */
  var STYLES = [
    '.site-steer {',
    '  position: fixed; left: 50%; bottom: 0.5rem; z-index: 19;',
    '  transform: translateX(-50%);',
    /* The two quiet affordances own the corners: 9.5rem of the bottom edge is theirs, and this
       label is clipped before it ever reaches one of them. */
    '  box-sizing: border-box; max-width: calc(100vw - 9.5rem);',
    '  display: inline-flex; align-items: center; gap: 0.42rem;',
    '  min-height: 44px; padding: 0.3rem 0.9rem;',
    '  border: 1px solid rgba(141, 184, 255, 0.5); border-radius: 999px;',
    '  background: rgba(13, 22, 48, 0.94); color: #eef4ff;',
    '  font: inherit; font-size: 0.82rem; font-weight: 600; line-height: 1.1;',
    '  text-decoration: none; white-space: nowrap;',
    '  box-shadow: 0 0.35rem 1.1rem rgba(0, 0, 0, 0.45);',
    '}',
    '.site-steer:hover, .site-steer:focus-visible {',
    '  background: rgba(27, 44, 86, 0.97); border-color: #8db8ff; color: #ffffff;',
    '}',
    '.site-steer-icon { display: flex; flex: 0 0 auto; }',
    '.site-steer-icon svg { display: block; width: 1.15rem; height: 1.15rem; }',
    '.site-steer-text { overflow: hidden; text-overflow: ellipsis; }',
    /* Several pages of this site take the browser's focus ring off their own controls, which would
       otherwise leave this link invisible to anyone arriving at it by keyboard. */
    '.site-steer:focus-visible { outline: 2px solid #8db8ff; outline-offset: 2px; }'
  ].join('\n');

  /* The page this is being pressed on, as a file name, or '' if it cannot be told.

     The shared shell writes it onto <html> as data-page, which is the one place it is stated
     plainly; the shell is a file a run may rewrite, so the browser's own path is read as a
     fallback, and anything that is not shaped like a page of this site is simply left out. */
  function pageName() {
    var html = window.document.documentElement;
    var named = (html && html.getAttribute && html.getAttribute('data-page')) || '';
    if (!PAGE_NAME.test(named)) {
      var path = (window.location && window.location.pathname) || '';
      named = path.slice(path.lastIndexOf('/') + 1);
    }
    return PAGE_NAME.test(named) ? named : '';
  }

  function destination() {
    var url = NEW_ISSUE + '?template=' + encodeURIComponent(TEMPLATE);
    var where = pageName();
    if (where) url += '&' + WHERE_FIELD + '=' + encodeURIComponent(where);
    return url;
  }

  function addStyle(css) {
    var el = window.document.createElement('style');
    el.textContent = css;
    window.document.head.appendChild(el);
  }

  function element(tag, properties, attributes) {
    var el = window.document.createElement(tag);
    var name;
    for (name in properties || {}) {
      if (Object.prototype.hasOwnProperty.call(properties, name)) el[name] = properties[name];
    }
    for (name in attributes || {}) {
      if (Object.prototype.hasOwnProperty.call(attributes, name)) {
        el.setAttribute(name, attributes[name]);
      }
    }
    return el;
  }

  function build() {
    addStyle(STYLES);

    /* A new tab, because engagement time is what this site is for: a visitor who files an issue
       has not finished with the page they were reading. The accessible name says so, and
       noopener/noreferrer mean the new tab gets nothing of this one -- not even which page of the
       site it came from, beyond the name this link states outright. */
    var link = element('a', {
      className: 'site-steer',
      href: destination(),
      target: '_blank',
      rel: 'noopener noreferrer'
    }, {
      'aria-label': NAME
    });
    link.appendChild(element('span', { className: 'site-steer-icon', innerHTML: ICON },
                             { 'aria-hidden': 'true' }));
    link.appendChild(element('span', { className: 'site-steer-text', textContent: LABEL }));

    window.document.body.appendChild(link);
  }

  if (window.document.body) build();
  else window.document.addEventListener('DOMContentLoaded', build);
})();
