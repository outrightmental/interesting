#!/usr/bin/env node
/**
 * Run site/js/analytics.js and site/js/clickadu.js against a stub browser and report what they
 * fetched, what the consent banner was asked to say and where the ads landed, as JSON on stdout.
 *
 * The site's ads (issue #110) are a third party's code on a visitor's page, so whether they load is
 * worth testing rather than only holding in place: nothing of Clickadu's may be fetched without a
 * zone the deploy filled in, without the visitor's yes, or on a page that is not a world. Both
 * files are fixed (see ANALYTICS_FILES, ADS_FILES and FIXED_FILES in make_interesting.py), and both
 * touch the browser through `window` and `document` alone, which is what keeps the stub this small.
 * The consent banner is a stand-in too: the vendored library is not under test, only what this
 * site asks of it and does with its answer.
 *
 *   node ads_harness.mjs path/to/site/js/analytics.js path/to/site/js/clickadu.js
 *
 * Every scenario below gets a fresh context. AdvertisingTest in test_make_interesting.py makes
 * the assertions: the harness only observes.
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";

const ANALYTICS = readFileSync(process.argv[2], "utf8");
const CLICKADU = readFileSync(process.argv[3], "utf8");
const ORIGIN = "https://site.test/";

// What the deploy pastes in, in each part's own shape: a GA4 measurement ID and the address of
// each zone's code. The real substitution is deploy.yml's, and AdvertisingTest runs that too.
const DEPLOYED = {
  __GA_MEASUREMENT_ID__: "G-TEST1234",
  __CLICKADU_BANNER_SRC__: "https://ads.example/b/1111111",
  __CLICKADU_IN_PAGE_PUSH_SRC__: "//ads.example/p/2222222",
};

function deployed(source, parts) {
  let out = source;
  for (const name of parts) out = out.split(name).join(DEPLOYED[name]);
  return out;
}

/** A browser for one page: <html> with the shell's attributes, a head, and a body holding the
 *  feature a page is (#main-content) and the feed after it. A script appended anywhere is queued,
 *  as the browser runs an async script later rather than at once: the banner and clickadu.js are
 *  run from this site's own copies, and anything else is only recorded as fetched. */
function makeBrowser({ world = "cosmic", page = "quiet-room.html", main = true, body = true,
                       answer = null, analytics = ANALYTICS } = {}) {
  const queue = [];
  const fetched = [];
  const stylesheets = [];
  let consent = null;

  function makeElement(tag) {
    const listeners = {};
    const names = new Set();
    return {
      tagName: tag,
      attributes: {},
      children: [],
      parentNode: null,
      id: "",
      className: "",
      textContent: "",
      classList: {
        add(name) { names.add(name); },
        contains(name) { return names.has(name); },
      },
      listeners,
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
      hasAttribute(name) { return name in this.attributes; },
      addEventListener(type, handler) { (listeners[type] = listeners[type] || []).push(handler); },
      appendChild(child) { return this.insertBefore(child, null); },
      insertBefore(child, before) {
        child.parentNode = this;
        const at = before ? this.children.indexOf(before) : -1;
        if (at < 0) this.children.push(child);
        else this.children.splice(at, 0, child);
        added(child);
        return child;
      },
      get nextSibling() {
        const siblings = this.parentNode ? this.parentNode.children : [];
        return siblings[siblings.indexOf(this) + 1] || null;
      },
    };
  }

  function added(el) {
    if (el.tagName === "link") stylesheets.push(el.href);
    if (el.tagName === "script") {
      fetched.push(el.src);
      queue.push(el);
    }
  }

  function all(el, out = []) {
    for (const child of el.children) {
      out.push(child);
      all(child, out);
    }
    return out;
  }

  const html = makeElement("html");
  html.setAttribute("data-page", page);
  if (world) html.setAttribute("data-world", world);
  const head = makeElement("head");
  html.appendChild(head);
  const document = {
    documentElement: html,
    head,
    body: null,
    currentScript: null,
    listeners: {},
    createElement: makeElement,
    addEventListener(type, handler) { (this.listeners[type] = this.listeners[type] || []).push(handler); },
    getElementById(id) { return all(html).find((el) => el.id === id) || null; },
    getElementsByTagName(tag) { return all(html).filter((el) => el.tagName === tag); },
  };
  function addBody() {
    document.body = makeElement("body");
    html.appendChild(document.body);
    if (main) {
      const feature = makeElement("div");
      feature.id = "main-content";
      document.body.appendChild(feature);
    }
    const feed = makeElement("div");
    feed.className = "page";
    document.body.appendChild(feed);
  }
  if (body) addBody();

  const context = { document, console };
  context.window = context;
  vm.createContext(context);

  /* The consent banner as this site uses it: run() once with the whole configuration, and an
     answer the visitor has given (an array of categories) or not yet given (null). */
  const CookieConsent = {
    run(config) {
      consent = config;
      if (answer) config.onConsent();
    },
    acceptedCategory(name) { return !!answer && answer.includes(name); },
    showPreferences() {},
  };

  function run(source, script) {
    document.currentScript = script;
    vm.runInContext(source, context);
    document.currentScript = null;
  }

  function drain() {
    while (queue.length) {
      const el = queue.shift();
      if (el.src === `${ORIGIN}js/cookieconsent.umd.js`) {
        context.CookieConsent = CookieConsent;
        if (el.onload) el.onload();
      } else if (el.src === `${ORIGIN}js/clickadu.js`) {
        run(CLICKADU, el);
      }
    }
  }

  const self = makeElement("script");
  self.src = `${ORIGIN}js/analytics.js`;
  head.appendChild(self);
  queue.length = 0;
  fetched.length = 0;
  run(analytics, self);
  drain();

  return {
    document,
    context,
    drain,
    addBody,
    fire(type) { for (const handler of document.listeners[type] || []) handler(); },
    report() {
      const slot = document.getElementById("site-ad");
      const box = document.getElementById("site-ad-banner");
      const label = slot ? slot.children.find((el) => el.className === "site-ad-label") : null;
      const ownScript = (src) => src && src.startsWith(ORIGIN);
      return {
        fetched,
        thirdParty: fetched.filter((src) => !ownScript(src)),
        stylesheets,
        banner: consent && {
          categories: Object.keys(consent.categories),
          advertising: consent.categories.advertising || null,
          revision: consent.revision,
          accept: consent.language.translations.en.consentModal.acceptAllBtn,
          description: consent.language.translations.en.consentModal.description,
          revisionMessage: consent.language.translations.en.consentModal.revisionMessage,
          sections: consent.language.translations.en.preferencesModal.sections,
        },
        clickadu: (() => {
          const el = all(html).find((node) => node.src === `${ORIGIN}js/clickadu.js`);
          return el ? { attributes: el.attributes } : null;
        })(),
        slot: slot && {
          tag: slot.tagName,
          className: slot.className,
          label: slot.getAttribute("aria-label"),
          after: slot.parentNode.children[slot.parentNode.children.indexOf(slot) - 1]?.id ?? null,
          before: slot.nextSibling ? slot.nextSibling.className : null,
          parent: slot.parentNode.tagName,
          visibleLabel: label ? label.textContent : null,
          visibleLabelHidden: label ? label.getAttribute("aria-hidden") : null,
          bannerScripts: box ? box.children.filter((el) => el.tagName === "script").map((el) => el.src) : [],
        },
        slots: all(html).filter((el) => el.id === "site-ad").length,
        onTheBody: document.body
          ? document.body.children.filter((el) => el.tagName === "script").map((el) => el.src)
          : [],
        // The slot's own stylesheet, and not the consent button's beside it.
        adStyles: head.children.filter((el) => el.tagName === "style" && el.textContent.includes(".site-ad"))
          .map((el) => el.textContent).join("\n"),
      };
    },
  };
}

const ALL = ["necessary", "analytics", "advertising"];
const ZONES = ["__CLICKADU_BANNER_SRC__", "__CLICKADU_IN_PAGE_PUSH_SRC__"];
const EVERYTHING = ["__GA_MEASUREMENT_ID__", ...ZONES];

const scenarios = {
  /* The file as committed: every placeholder still in place, which is a fork, a local copy or any
     checkout the deploy has not run over. Nothing is fetched, not even the banner. */
  asCommitted() {
    return makeBrowser({ answer: ALL }).report();
  },

  /* Deployed with a measurement ID and no ad zone: today's site, word for word, with no
     advertising category and nothing of Clickadu's -- even for a visitor whose stored answer
     names advertising from some other copy of the site. */
  measuredOnly() {
    return makeBrowser({ analytics: deployed(ANALYTICS, ["__GA_MEASUREMENT_ID__"]), answer: ALL }).report();
  },

  /* Everything deployed, on a world, and every category accepted. */
  everythingAccepted() {
    return makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ALL }).report();
  },

  /* Everything deployed and analytics accepted, but advertising declined. */
  adsDeclined() {
    return makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ["necessary", "analytics"] }).report();
  },

  /* Everything deployed and no answer yet: the banner is up and nothing else is fetched. */
  notYetAnswered() {
    return makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: null }).report();
  },

  /* Advertising accepted on the threshold, the landing page: no data-world, so no ads. */
  notAWorld() {
    return makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ALL,
                         world: null, page: "index.html" }).report();
  },

  /* Ad zones and no measurement ID: the banner still asks, about ads alone, and no Google tag. */
  adsOnly() {
    return makeBrowser({ analytics: deployed(ANALYTICS, ZONES), answer: ALL }).report();
  },

  /* One zone and not the other: only that format is asked for, and only it is described. */
  bannerOnly() {
    return makeBrowser({ analytics: deployed(ANALYTICS, ["__GA_MEASUREMENT_ID__", "__CLICKADU_BANNER_SRC__"]),
                         answer: ALL }).report();
  },
  inPagePushOnly() {
    return makeBrowser({ analytics: deployed(ANALYTICS, ["__GA_MEASUREMENT_ID__", "__CLICKADU_IN_PAGE_PUSH_SRC__"]),
                         answer: ALL }).report();
  },

  /* A shell rewritten without #main-content: the slot goes at the end of the page instead. */
  withoutTheFeature() {
    return makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ALL, main: false }).report();
  },

  /* clickadu.js run a second time on the same page still makes one set of ads. */
  loadedTwice() {
    const browser = makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ALL });
    const again = browser.document.createElement("script");
    again.src = `${ORIGIN}js/clickadu.js`;
    again.setAttribute("data-banner", DEPLOYED.__CLICKADU_BANNER_SRC__);
    again.setAttribute("data-in-page-push", DEPLOYED.__CLICKADU_IN_PAGE_PUSH_SRC__);
    browser.document.head.appendChild(again);
    browser.drain();
    return browser.report();
  },

  /* clickadu.js run before the body exists waits for it, and still knows its zones once
     currentScript has gone. */
  beforeTheBody() {
    const browser = makeBrowser({ analytics: deployed(ANALYTICS, EVERYTHING), answer: ALL, body: false });
    const early = { listeners: Object.keys(browser.document.listeners).sort(),
                    thirdParty: browser.report().thirdParty };
    browser.addBody();
    browser.fire("DOMContentLoaded");
    return { early, then: browser.report() };
  },

  /* An address in the wrong shape is never fetched, however it reached the script element. */
  aStrangeAddress() {
    const browser = makeBrowser({ analytics: ANALYTICS, answer: null });
    const el = browser.document.createElement("script");
    el.src = `${ORIGIN}js/clickadu.js`;
    el.setAttribute("data-banner", "javascript:alert(1)");
    el.setAttribute("data-in-page-push", "http://ads.example/p/2222222");
    browser.document.head.appendChild(el);
    browser.drain();
    return browser.report();
  },
};

const results = {};
for (const [name, scenario] of Object.entries(scenarios)) results[name] = scenario();
process.stdout.write(JSON.stringify(results, null, 1));
