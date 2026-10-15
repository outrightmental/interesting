/*
  Clickadu's ads, on the worlds' pages and nowhere else (issue #110).

  No page loads this file. js/analytics.js does, and only once a visitor has accepted the
  "advertising" category of its consent banner. It hands over the address of each zone's code on
  this file's own script element, because analytics.js is the one file the deploy writes an
  identifier into (see the comment at its head):

      data-banner         the src of the banner zone's code
      data-in-page-push   the src of the in-page push zone's code

  Two formats and only these two, so that an ad never stands between a visitor and the world they
  came for:

      banner        one slot, under the world's own stage and above the feed, reserved here
      in-page push  the small notification-style card Clickadu floats over a corner of the page

  No popunder, no interstitial, nothing that opens a window, takes over a click or covers the page.
  Which format a zone serves is fixed when the zone is created in Clickadu's dashboard, so this
  file cannot hold a zone to it; what it does hold is that these two zones are all it ever asks
  Clickadu for.

  Only on a world: a page the shared shell marks <html data-world>. The threshold (index.html) is
  the landing page and carries none, and neither do the mood atlas, the site map, the fine print or
  the error page. The site has no accounts; what comes nearest -- the persona sheet and the state
  menu -- opens as a modal dialog, which the browser draws in its top layer, above anything an ad
  floats, and the cookie dialog is drawn at the highest z-index a page has. The slot is never put
  inside any of them.

  The slot's styles live here rather than in a page or the shared Sass, like the consent button's,
  because every page and every stylesheet of this site may be rewritten by an AI run. This file is
  kept out of that run's reach with the rest of the consent machinery: see ADS_SCRIPT and
  FIXED_FILES in .github/scripts/make_interesting.py.
*/
(function () {
  'use strict';

  var SLOT_ID = 'site-ad';
  // The banner's own box. A zone that asks which element to fill is pointed at this id; one that
  // fills the element its script stands in finds itself here as well.
  var BANNER_ID = 'site-ad-banner';
  // The shape js/analytics.js and the deploy hold an address to: https or protocol-relative.
  var ADDRESS = /^(https:)?\/\/[A-Za-z0-9.-]+\//;

  /* The element this file was loaded by, which carries the zones. */
  function ownScript() {
    if (document.currentScript) return document.currentScript;
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/(^|\/)clickadu\.js(\?|#|$)/.test(all[i].src || '')) return all[i];
    }
    return null;
  }

  function zone(script, name) {
    var src = script.getAttribute(name);
    return src && ADDRESS.test(src) ? src : null;
  }

  function loadTag(src, parent) {
    var el = document.createElement('script');
    el.src = src;
    el.async = true;
    parent.appendChild(el);
  }

  function addStyle(css) {
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* The banner's slot: under the world's stage and above the feed, the full width of the column,
     and invisible until Clickadu has put something in it, so a zone with nothing to show leaves
     no empty labelled box behind. It is named as an advertisement to every visitor, a sighted one
     by the label and anyone else by the landmark. */
  function reserveSlot() {
    addStyle([
      '.site-ad {',
      '  width: min(var(--page-max, 1400px), 100%); margin: 0 auto;',
      '  text-align: center; overflow: hidden;',
      '}',
      '.site-ad-label { display: none; }',
      '.site-ad-banner { display: flex; justify-content: center; max-width: 100%; }',
      '.site-ad:has(.site-ad-banner > :not(script)) { padding: 1.25rem 0 0.5rem; }',
      '.site-ad:has(.site-ad-banner > :not(script)) .site-ad-label {',
      '  display: block; margin: 0 0 0.4rem;',
      '  font: inherit; font-size: 0.72rem; line-height: 1.2; letter-spacing: 0.06em;',
      '  color: var(--md-sys-color-on-surface-variant, rgba(220, 227, 255, 0.7));',
      '}'
    ].join('\n'));

    var slot = document.createElement('aside');
    slot.id = SLOT_ID;
    slot.className = 'site-ad';
    slot.setAttribute('aria-label', 'advertisement');
    var label = document.createElement('p');
    label.className = 'site-ad-label';
    label.setAttribute('aria-hidden', 'true'); // the landmark already says it
    label.textContent = 'advertisement';
    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'site-ad-banner';
    slot.appendChild(label);
    slot.appendChild(banner);

    // After the feature a page is, wherever the shell has put it; at the end of the page if the
    // shell has none.
    var feature = document.getElementById('main-content');
    if (feature && feature.parentNode) feature.parentNode.insertBefore(slot, feature.nextSibling);
    else document.body.appendChild(slot);
    return banner;
  }

  // Read while this file runs: currentScript is gone by the time a later event fires.
  var script = ownScript();

  function serve() {
    if (!script) return;
    if (!document.documentElement.hasAttribute('data-world')) return; // only a world's page
    if (window.siteAdsServed) return; // loaded twice: one set of ads a page
    window.siteAdsServed = true;

    var banner = zone(script, 'data-banner');
    var inPagePush = zone(script, 'data-in-page-push');
    if (banner) loadTag(banner, reserveSlot());
    if (inPagePush) loadTag(inPagePush, document.body);
  }

  if (document.body) serve();
  else document.addEventListener('DOMContentLoaded', serve);
})();
