// Serve a page at its address without the extension: /terms is answered with terms.html, the
// same way /terms.html is. A CloudFront Function on viewer-request (cloudfront.tf), so it runs
// before the cache and the origin and is written for the runtime's ES5.1-style JavaScript.
//
// The URI is rewritten, not redirected. The browser stays at /terms, which sits in the same
// folder as /terms.html, so every relative link the page is written with -- css/site.css,
// privacy.html -- resolves exactly as it does there. The .html address keeps working untouched:
// it is still what the nav, the sitemap and every cross-link name.
//
// It is the address's shape that is read, never a list of pages, so a page the hourly run adds
// gets its short address without anyone applying /infra. A request whose last segment has no dot
// is asked for as that name plus .html; anything with a dot (a stylesheet, a script, sitemap.xml,
// a page already asked for by its .html name) and anything ending in a slash (the root, which the
// distribution's default root object answers) is passed through as it came. The build publishes
// no file without an extension, so nothing in the bucket is shadowed; and a name no page has
// becomes a .html key the bucket does not hold, which the custom error response still answers
// with error.html, as a 404.
function handler(event) {
  var request = event.request;
  var name = request.uri.slice(request.uri.lastIndexOf('/') + 1);
  if (name !== '' && name.indexOf('.') === -1) {
    request.uri += '.html';
  }
  return request;
}
