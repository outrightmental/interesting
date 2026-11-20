/**
 * Signal, the studio's own first-party, aggregate-only analytics, as this site's build carries it.
 *
 * Two parts, and they are kept apart (outrightmental/signal, docs/MVP.md, "Websites: depth and
 * people"):
 *
 *   - The ladder (ladder.mjs, a byte copy of sdk/web/ladder.mjs in outrightmental/signal): a column
 *     of 1x1 images in the page's own HTML, one every 200 px down it, which Signal's server counts
 *     with no script, no cookie and no id. It is the first thing inside <body>, and body is made
 *     `position: relative` so the ladder spans the page's height and clips to it.
 *   - The web client (site/js/signal.js, a byte copy of sdk/web/signal.js): journeys, one visitor
 *     across the studio's sites, only after a yes. Its own banner is off (`data-banner="off"`):
 *     the site's cookie banner asks, under a "journeys" category of its own, and js/analytics.js
 *     passes the answer on with Signal.consent(). Global Privacy Control is a no, whatever it says.
 *
 * Both are written by the build, not by /site, and only for a production host named on the
 * command line (`node build.mjs --signal-host makeitmoreinteresting.com`, which deploy.yml runs).
 * Every other build -- a local one, the hourly run's checks, a fork -- carries neither, so nothing
 * is ever counted from anywhere but the live site. Each host has its own stream and its own key,
 * and the build is made for one host at a time.
 *
 * The keys are public: they are in every page the deploy publishes, and they let a page count into
 * its stream and do nothing else.
 */

import { ladderHtml } from "./ladder.mjs";

/** Where the browser sends what the ladder and the client count. */
export const INGEST = "https://in.signal.outright.io";

/**
 * Each production host and its stream's public key. www.makeitmoreinteresting.com serves the same
 * build from the same distribution, so it counts into the apex's stream.
 *
 * interesting.outright.io is the site's old address. It has its own stream, but deploy.yml
 * publishes only to makeitmoreinteresting.com, so nothing builds for it today; a copy published
 * there would be built with `--signal-host interesting.outright.io`.
 */
export const STREAMS = Object.freeze({
  "makeitmoreinteresting.com": "makeitmoreinteresting-com.6b5672ee0cf370d104a6eaaa",
  "interesting.outright.io": "interesting-outright-io.9e45fc34dbc483e17789808e",
});

/**
 * The studio's own sites, by host: a link from this one to any of them carries the visitor across
 * (`#sx=` in its fragment), for a visitor who said yes on both.
 */
export const STUDIO = Object.freeze([
  "outrightmental.com", "nickcharneykaye.com", "fevertilt.com", "starharvester.com",
  "umlaut-hero.com", "conversationsimulator.com", "docs.conversationsimulator.com", "xjmusic.com",
  "docs.xjmusic.com", "podcast.xjmusic.com", "outright.io", "agendar.outright.io",
  "wetware.outright.io", "etymolution.com", "makeitmoreinteresting.com", "interesting.outright.io",
  "ascendinglark.com", "garden.ascendinglark.com",
]);

/** The script the transform writes, served from this site's own root. */
export const CLIENT_SRC = "/js/signal.js";

/** The page a visitor reads about it on: the site's own privacy page. */
export const PRIVACY = "/privacy.html";

/** The stream key for `host`, or an error naming the hosts there are. */
export function keyFor(host) {
  const key = STREAMS[String(host || "").toLowerCase()];
  if (!key) {
    throw new Error(`--signal-host ${host} is not a production host (${Object.keys(STREAMS).join(", ")})`);
  }
  return key;
}

const attr = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The client's script element, for the page's <head>. */
export function clientTag(key) {
  return `<script defer src="${CLIENT_SRC}" data-key="${attr(key)}" data-ingest="${INGEST}" ` +
    `data-studio="${STUDIO.join(" ")}" data-privacy="${PRIVACY}" data-banner="off"></script>`;
}

/** Makes body the ladder's positioned ancestor, so the ladder is the page's height. */
export const BODY_STYLE = "<style>body{position:relative}</style>";

/**
 * One built page with Signal written into it: the client and body's position before </head>, and
 * the ladder as the first thing inside <body>. `url` is the page's own address (Eleventy's
 * page.url, such as /quiet-room.html), which is the path the ladder counts it under. A page with
 * no <body> or no </head> is not a page, and is left alone.
 */
export function withSignal(html, { key, url }) {
  const body = /<body\b[^>]*>/i.exec(html);
  const head = html.search(/<\/head>/i);
  if (!body || head < 0 || head > body.index) return html;
  const at = body.index + body[0].length;
  const ladder = ladderHtml({ ingest: INGEST, key, path: url });
  return html.slice(0, head) + `${clientTag(key)}\n  ${BODY_STYLE}\n` + html.slice(head, at) + ladder + html.slice(at);
}
