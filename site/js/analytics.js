/*
  Google Analytics and the cookie consent banner, shared by every page of the site.

  One line in the <head> of a page carries all of it:

      <script src='js/analytics.js' defer></script>

  This file brings the rest with it, loading its two neighbours by paths worked out from its own
  URL (so a page in a sub-folder only needs the matching relative src):

      css/cookieconsent.css    the banner's styles
      js/cookieconsent.umd.js  the banner itself, vendored from the 3.1.0 release of
                               https://github.com/orestbida/cookieconsent (MIT), exactly as
                               published apart from the license header copied onto the CSS

  Nothing is reported until a visitor accepts the analytics category: the Google tag is not even
  fetched before then, and rejecting it later switches measurement back off and lets the banner
  clear the cookies it set. A small "cookies" button sits in the corner of every page so a choice
  can be changed at any time.

  The measurement ID is not committed. The deploy workflow replaces the placeholder below with the
  GA_MEASUREMENT_ID repository secret on its way to S3 (see .github/workflows/deploy.yml, and
  infra/github.tf for where that secret comes from). In a fork, a local copy or any checkout the
  deploy has not been through, the placeholder stays and switches this whole file off: no tag, no
  banner, no cookies, nothing to consent to.

  The hourly AI iteration may rewrite any page of this site, so the line above is an axiom of every
  run and these three files are kept out of its reach: see ANALYTICS_SCRIPT, FIXED_FILES and
  check_analytics in .github/scripts/make_interesting.py.
*/
(function () {
  'use strict';

  var MEASUREMENT_ID = '__GA_MEASUREMENT_ID__';
  var CONSENT_SCRIPT = 'cookieconsent.umd.js';
  var CONSENT_STYLE = '../css/cookieconsent.css';
  var CATEGORY = 'analytics';

  // No measurement ID means nothing is measured, so there is nothing to ask consent for either.
  if (!/^G-[A-Z0-9]+$/.test(MEASUREMENT_ID)) return;

  var base = scriptFolder();
  var tagLoaded = false;

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  /* The folder this script was loaded from, so its two neighbours can be found from any page of the
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

  function loadScript(src, onload) {
    var el = document.createElement('script');
    el.src = src;
    el.async = true;
    if (onload) el.onload = onload;
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

  /* A small, quiet way back to the choice: withdrawing consent has to be as easy as giving it, and
     the banner is gone once answered. The styles live here rather than in a page, because every
     page of this site may be rewritten by the hourly AI run. */
  function addPreferencesButton() {
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
    button.setAttribute('data-cc', 'show-preferencesModal');
    button.textContent = 'cookies';
    button.setAttribute('aria-label', 'Change cookie preferences');
    if (document.body) document.body.appendChild(button);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(button);
    });
  }

  function run() {
    var cc = window.CookieConsent;
    if (!cc || !cc.run) return; // the banner did not load, so nothing is measured

    function applyConsent() {
      if (cc.acceptedCategory(CATEGORY)) enableAnalytics();
      else disableAnalytics();
    }

    // The site is dark on every page; the banner ships a matching palette under this class.
    document.documentElement.classList.add('cc--darkmode');

    cc.run({
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right', equalWeightButtons: true },
        preferencesModal: { layout: 'box', equalWeightButtons: true }
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {
          autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }] }
        }
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'A quiet word about cookies',
              description:
                'This site counts visits with Google Analytics, and measures nothing else. Those ' +
                'cookies are only set if you accept them. Either way, the toys on these pages keep ' +
                'your constellation in your own browser and send it nowhere.',
              acceptAllBtn: 'Accept analytics',
              acceptNecessaryBtn: 'Decline',
              showPreferencesBtn: 'Let me choose'
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept analytics',
              acceptNecessaryBtn: 'Decline',
              savePreferencesBtn: 'Save my choice',
              closeIconLabel: 'Close',
              sections: [
                {
                  title: 'What this site keeps',
                  description:
                    'You can change this at any time with the "cookies" button in the corner of ' +
                    'any page.'
                },
                {
                  title: 'Strictly necessary',
                  description:
                    'Only your answer to this banner, kept in your browser so it is not asked ' +
                    'again. Nothing leaves your device.',
                  linkedCategory: 'necessary'
                },
                {
                  title: 'Analytics',
                  description:
                    'Google Analytics 4, used to count visits and see which pages the hourly ' +
                    'iteration should spend its attention on. Declining removes its cookies and ' +
                    'stops the measurement.',
                  linkedCategory: 'analytics'
                }
              ]
            }
          }
        }
      },
      onConsent: applyConsent,
      onChange: applyConsent
    });

    addPreferencesButton();
  }

  loadStylesheet(base + CONSENT_STYLE);
  loadScript(base + CONSENT_SCRIPT, run);
})();
