/*
  Google Analytics, Clickadu's ads and the cookie consent banner, shared by every page of the site.

  One line in the <head> of a page carries all of it:

      <script src='js/analytics.js' defer></script>

  This file brings the rest with it, loading its neighbours by paths worked out from its own URL
  (so a page in a sub-folder only needs the matching relative src):

      css/cookieconsent.css    the banner's styles
      js/cookieconsent.umd.js  the banner itself, vendored from the 3.1.0 release of
                               https://github.com/orestbida/cookieconsent (MIT), exactly as
                               published apart from the license header copied onto the CSS
      js/clickadu.js           the ads, which decides whether a page carries any and where

  Nothing is reported until a visitor accepts the analytics category: the Google tag is not even
  fetched before then, and rejecting it later switches measurement back off and lets the banner
  clear the cookies it set. Nothing is advertised until a visitor accepts the advertising category
  either: js/clickadu.js, and Clickadu's code with it, is not fetched before then, and rejecting it
  later reloads the page, which is the one way to take a third party's running code back off it.
  A small "cookies" button sits in the corner of every page so a choice can be changed at any time.

  No identifier is committed. The deploy workflow replaces the placeholders below on its way to S3:
  the GA_MEASUREMENT_ID repository secret, and CLICKADU_BANNER_SRC and CLICKADU_IN_PAGE_PUSH_SRC,
  the address of each Clickadu zone's code (see .github/workflows/deploy.yml, and infra/github.tf
  for where those secrets come from). A placeholder the deploy has not replaced switches its own
  part off, and the banner only asks about the parts that are on. In a fork, a local copy or any
  checkout the deploy has not been through, every placeholder stays and this whole file is off: no
  tag, no ads, no banner, no cookies, nothing to consent to.

  The AI iteration may rewrite any page of this site, so the line above is an axiom of every
  run and these four files are kept out of its reach: see ANALYTICS_SCRIPT, ADS_SCRIPT,
  FIXED_FILES and check_analytics in .github/scripts/make_interesting.py.
*/
(function () {
  'use strict';

  var MEASUREMENT_ID = '__GA_MEASUREMENT_ID__';
  // The src of the <script> Clickadu's "get code" gives for each zone, one zone a format. Banner
  // and in-page push are the only two formats the site serves (see js/clickadu.js).
  var AD_ZONES = {
    banner: '__CLICKADU_BANNER_SRC__',
    inPagePush: '__CLICKADU_IN_PAGE_PUSH_SRC__'
  };
  var CONSENT_SCRIPT = 'cookieconsent.umd.js';
  var CONSENT_STYLE = '../css/cookieconsent.css';
  var ADS_SCRIPT = 'clickadu.js';
  var CATEGORY = 'analytics';
  var AD_CATEGORY = 'advertising';

  var measured = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID);
  // A zone is on once the deploy has put an address where its placeholder was: the shape the
  // deploy checks the secret against, an https or protocol-relative URL.
  var zones = {};
  for (var format in AD_ZONES) {
    if (/^(https:)?\/\/[A-Za-z0-9.-]+\//.test(AD_ZONES[format])) zones[format] = AD_ZONES[format];
  }
  var advertised = !!(zones.banner || zones.inPagePush);

  // Nothing measured and nothing advertised means there is nothing to ask consent for either.
  if (!measured && !advertised) return;

  var base = scriptFolder();
  var tagLoaded = false;
  var adsServed = false;

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  /* The folder this script was loaded from, so its neighbours can be found from any page of the
     site, however deep, without hard-coding a path or a domain. */
  function scriptFolder() {
    var el = document.currentScript;
    if (!el) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0 && !el; i--) {
        if (/(^|\/)analytics\.js(\?|#|$)/.test(all[i].src || '')) el = all[i];
      }
    }
    return el && el.src ? el.src.replace(/[^/]*$/, '') : 'js/';
  }

  function loadScript(src, onload, attributes) {
    var el = document.createElement('script');
    el.src = src;
    el.async = true;
    if (onload) el.onload = onload;
    for (var name in attributes || {}) el.setAttribute(name, attributes[name]);
    document.head.appendChild(el);
  }

  function loadStylesheet(href) {
    var el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    document.head.appendChild(el);
  }

  function addStyle(css) {
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function enableAnalytics() {
    window['ga-disable-' + MEASUREMENT_ID] = false;
    if (tagLoaded) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    tagLoaded = true;
    // The three ad signals are Google's, for Google's own ads, and stay denied whatever a visitor
    // says about advertising: the Google tag serves no ads here, and Clickadu's are not Google's.
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID);
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);
  }

  function disableAnalytics() {
    // Both halves of the off switch: the flag the Google tag checks on every call, and the consent
    // signal, which matters when the tag was already fetched earlier in this visit.
    window['ga-disable-' + MEASUREMENT_ID] = true;
    if (tagLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  /* A puzzle left unsolved: the stage's way on pressed before the piece was solved (js/stage.js,
     'stage:incomplete', issue #109). It is counted as an incomplete attempt -- which world, which
     seed, how many checks and hints it had, whether it was touched at all -- and never as a
     finished piece, which the stage does not report here. Only once the tag is on and while
     measurement is: nothing is queued for a visitor who has not accepted, or who has withdrawn. */
  function countIncomplete(ev) {
    if (!tagLoaded || window['ga-disable-' + MEASUREMENT_ID]) return;
    var d = (ev && ev.detail) || {};
    gtag('event', 'puzzle_incomplete', {
      world: String(d.file || '').replace(/\.html$/, ''),
      seed: Number(d.seed) || 0,
      tries: Number(d.tries) || 0,
      hints: Number(d.hints) || 0,
      touched: d.touched ? 1 : 0
    });
  }

  /* Clickadu's ads, once a visitor has said yes to them. js/clickadu.js decides whether this page
     carries any, and where; it is handed the zones on its own script element, so this file stays
     the one place the deploy writes an identifier into. There is no off switch to match: the
     advertising category reloads the page when it is withdrawn (autoClear.reloadPage below), and
     the page comes back without this. */
  function serveAds() {
    if (adsServed) return;
    adsServed = true;
    var attributes = {};
    if (zones.banner) attributes['data-banner'] = zones.banner;
    if (zones.inPagePush) attributes['data-in-page-push'] = zones.inPagePush;
    loadScript(base + ADS_SCRIPT, null, attributes);
  }

  /* A small, quiet way back to the choice: withdrawing consent has to be as easy as giving it, and
     the banner is gone once answered. The styles live here rather than in a page, because every
     page of this site may be rewritten by an AI run. */
  function addPreferencesButton(cc) {
    addStyle([
      '.site-consent-link {',
      '  position: fixed; left: 0.55rem; bottom: 0.5rem; z-index: 20;',
      '  border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 999px;',
      '  background: rgba(10, 12, 22, 0.55); color: rgba(220, 227, 255, 0.6);',
      '  font: inherit; font-size: 0.72rem; line-height: 1; padding: 0.3rem 0.6rem;',
      '  cursor: pointer; opacity: 0.55;',
      '}',
      '.site-consent-link:hover, .site-consent-link:focus-visible { opacity: 1; }',
      /* Several pages switch the focus ring off for their own controls ("button:focus-visible {
         outline: none }"), which would otherwise leave the consent dialog unusable by keyboard. */
      '#cc-main button:focus-visible, .site-consent-link:focus-visible {',
      '  outline: 2px solid #8db8ff; outline-offset: 2px;',
      '}'
    ].join('\n'));

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-consent-link';
    button.textContent = 'cookies';
    button.setAttribute('aria-label', 'Change cookie preferences');
    button.setAttribute('aria-haspopup', 'dialog');
    // showPreferences() rather than the library's data-cc attribute: it binds those listeners while
    // it runs, and this button is added after that.
    button.addEventListener('click', function () {
      cc.showPreferences();
    });
    if (document.body) document.body.appendChild(button);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(button);
    });
  }

  /* What the banner says, which is only ever what this copy of the site does: a part the deploy
     left switched off is not mentioned, so the words cannot promise or confess anything that is
     not served. */
  function wording() {
    var accept = measured && advertised ? 'Accept both' : measured ? 'Accept analytics' : 'Accept ads';
    var description = measured && advertised
      ? 'This site counts visits with Google Analytics and shows ads from Clickadu on its worlds, ' +
        'and does nothing else with cookies. Neither is loaded unless you accept it.'
      : measured
        ? 'This site counts visits with Google Analytics, and measures nothing else. Those ' +
          'cookies are only set if you accept them.'
        : 'This site shows ads from Clickadu on its worlds, and measures nothing itself. They ' +
          'are only loaded if you accept them.';
    description += ' Either way, the toys on these pages keep your constellation in your own ' +
      'browser and send it nowhere.';
    // Said only to a visitor whose earlier answer was given before the site showed ads (see
    // revision in run below); the banner replaces it with nothing for everyone else.
    if (advertised) description += '{{revisionMessage}}';

    var sections = [
      {
        title: 'What this site keeps',
        description:
          'You can change this at any time with the "cookies" button in the corner of any page.'
      },
      {
        title: 'Strictly necessary',
        description:
          'Only your answer to this banner, kept in your browser so it is not asked again. ' +
          'Nothing leaves your device.',
        linkedCategory: 'necessary'
      }
    ];
    if (measured) {
      sections.push({
        title: 'Analytics',
        description:
          'Google Analytics 4, used to count visits and see where visitors stay engaged, so the ' +
          'iteration knows what to spend its attention on. Declining removes its cookies and ' +
          'stops the measurement.',
        linkedCategory: CATEGORY
      });
    }
    if (advertised) {
      var formats = [];
      if (zones.banner) formats.push('a banner under the puzzle');
      if (zones.inPagePush) formats.push('now and then a small notification-style card in a corner');
      sections.push({
        title: 'Advertising',
        description:
          'Ads from Clickadu, an ad network, on the worlds\' pages only: ' + formats.join(' and ') +
          '. Never a pop-up, a pop-under or an ad that covers the page, and none on the threshold, ' +
          'the mood atlas, the site map or the fine print. Clickadu chooses and counts the ads from ' +
          'its own servers and may set cookies of its own to do it (see ' +
          '<a href="https://www.clickadu.com/privacy" target="_blank" rel="noopener noreferrer">' +
          'its privacy policy</a>). Declining stops them loading and reloads the page without them.',
        linkedCategory: AD_CATEGORY
      });
    }

    return {
      consentModal: {
        title: 'A quiet word about cookies',
        description: description,
        revisionMessage: ' You answered before this site showed ads, so it asks again.',
        acceptAllBtn: accept,
        acceptNecessaryBtn: 'Decline',
        showPreferencesBtn: 'Let me choose'
      },
      preferencesModal: {
        title: 'Cookie preferences',
        acceptAllBtn: accept,
        acceptNecessaryBtn: 'Decline',
        savePreferencesBtn: 'Save my choice',
        closeIconLabel: 'Close',
        sections: sections
      }
    };
  }

  function run() {
    var cc = window.CookieConsent;
    if (!cc || !cc.run) return; // the banner did not load, so nothing is measured or advertised

    // A stored answer can name a category this copy of the site does not offer (one given before
    // the deploy switched a part off), so a part is only ever started when it is switched on.
    function applyConsent() {
      if (measured) {
        if (cc.acceptedCategory(CATEGORY)) enableAnalytics();
        else disableAnalytics();
      }
      if (advertised && cc.acceptedCategory(AD_CATEGORY)) serveAds();
    }

    var categories = { necessary: { enabled: true, readOnly: true } };
    if (measured) {
      categories[CATEGORY] = {
        autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }] }
      };
    }
    if (advertised) {
      // Clickadu's cookies are set on its own domain, where no page can clear them, so there are
      // none to list. What can be taken back is its running code: withdrawing consent reloads the
      // page, and the page comes back without it.
      categories[AD_CATEGORY] = {
        autoClear: { cookies: [], reloadPage: true }
      };
    }

    // The site is dark on every page; the banner ships a matching palette under this class.
    document.documentElement.classList.add('cc--darkmode');

    cc.run({
      // An answer given before the site showed ads was an answer to a banner that said it
      // measured nothing else, so it is asked again once there are ads; until then the answers
      // already given stand.
      revision: advertised ? 1 : 0,
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right', equalWeightButtons: true },
        preferencesModal: { layout: 'box', equalWeightButtons: true }
      },
      categories: categories,
      language: {
        default: 'en',
        translations: { en: wording() }
      },
      onConsent: applyConsent,
      onChange: applyConsent
    });

    addPreferencesButton(cc);
  }

  window.addEventListener('stage:incomplete', countIncomplete);
  loadStylesheet(base + CONSENT_STYLE);
  loadScript(base + CONSENT_SCRIPT, run);
})();
