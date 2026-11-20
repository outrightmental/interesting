/**
 * The depth ladder: the backbone of a web page's signals, in HTML alone.
 *
 * A page carries one 1×1 image for every 200 px down it. The first loads with
 * the page: that is the view. The rest are `loading="lazy"`, so the browser
 * itself asks for each one as the reader scrolls toward it. One more sits at
 * the foot of the page: the reader reached the end. The server
 * (src/server/depth.mjs) adds one to a counter for each request and keeps
 * nothing else, so what the studio knows about how far its pages are read
 * comes from its own servers, from every browser, with or without script.
 * The web client (signal.js) is enrichment on top: journeys after a yes. It
 * sends no depth on a page that has a ladder.
 *
 * Where it goes: as the first child of an element that is the height of the
 * page and is positioned (`body { position: relative }` is the usual way).
 * The ladder fills that element's height and clips to it, so a rung past the
 * end of a short page is never in view and never asked for.
 *
 * What a browser does with `loading="lazy"` is its own: Chrome asks for an
 * image some way before it is in view (about 1,250 px on a fast connection,
 * 2,500 px on a slow one), Firefox and Safari closer. So a rung counts readers
 * who came near it. Compare a page with itself over time, and pages with each
 * other: that is what the ladder is for.
 *
 * sdk/web/hugo/signal-depth.html is the same ladder as a Hugo partial.
 */

export const BAND_PX = 200;
export const RUNGS = 47;

/** A page's path as Signal keeps it (src/server/identity.mjs pathOf). */
export function ladderPath(pathname) {
  let text = String(pathname || '/').toLowerCase().split(/[?#]/)[0].replace(/\/{2,}/g, '/').replace(/\/index\.html?$/, '/');
  if (text.length > 1) text = text.replace(/\/$/, '');
  return text;
}

const attr = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * The ladder's HTML for one page.
 *
 * @param {{ ingest?: string, key: string, path: string, rungs?: number }} options
 */
export function ladderHtml({ ingest = 'https://in.signal.outright.io', key, path, rungs = RUNGS }) {
  const base = `${ingest.replace(/\/+$/, '')}/v1/d?k=${encodeURIComponent(key)}&p=${encodeURIComponent(ladderPath(path))}`;
  const img = (query, style, lazy) => `<img src="${attr(`${base}&${query}`)}" alt="" width="1" height="1"${lazy ? ' loading="lazy"' : ''} decoding="async" referrerpolicy="no-referrer" style="${style}">`;
  const rung = (at) => img(`b=${at}-${at}`, `position:absolute;left:0;top:${at * BAND_PX}px`, at > 0);
  return [
    '<div data-signal-depth aria-hidden="true" style="position:absolute;top:0;bottom:0;left:0;width:1px;overflow:hidden;pointer-events:none;opacity:0">',
    ...Array.from({ length: rungs + 1 }, (_, at) => rung(at)),
    img('e=1', 'position:absolute;left:0;bottom:0', true),
    '</div>',
  ].join('');
}
