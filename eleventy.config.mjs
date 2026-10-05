/**
 * How /site is turned into the artifact that gets published. Run it with `npm run build`, which
 * calls build.mjs; this file is only the configuration.
 *
 * Two conventions, and nothing else:
 *
 *   - .html files are Nunjucks templates with optional YAML front matter. `layout: layout.njk`
 *     wraps the page in the shared shell in site/_includes, so the <head>, the stylesheet links,
 *     the header, the mood ribbon and the index of every world live in one place rather than
 *     in every page.
 *   - .scss files compile to .css at the same path. A file whose name starts with "_" is a
 *     partial: it is only ever @use'd by another file, never built on its own. The shared partials
 *     in site/_sass are what "common files" means -- one palette, one set of base rules, one
 *     readout mixin, @use'd by every stylesheet.
 *
 * Every other file type is copied through verbatim: never rendered, so a stray "{{" in a script
 * cannot break a build.
 *
 * Paths are preserved exactly: site/index.html becomes index.html, site/css/site.scss becomes
 * css/site.css. Eleventy would otherwise turn about.html into about/index.html, which would break
 * every relative link the site is written with.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import * as sass from "sass";

// The folder being built. build.mjs sets this when it builds a copy of the site somewhere else
// (the hourly AI's reachability check does exactly that); on its own, `npx eleventy` builds /site.
const SOURCE_DIR = process.env.SITE_SOURCE_DIR || "site";

// Where the shared files live, inside the source folder. Both are Eleventy conventions ("_" says
// "not a page"), and both are inside /site so the hourly AI can edit them like anything else.
const INCLUDES_DIR = "_includes"; // layouts and partials: layout.njk, worlds.njk
const SASS_DIR = "_sass"; // the common Sass partials, on every stylesheet's load path
// A third, Eleventy's own default and so not named here: "_data", whose worlds.json every template
// reads as `worlds` -- the one list of the site's pages. Like the other two it is never published.

// File types copied through untouched. Text only, which is every type /site is allowed to hold;
// make_interesting.py's ALLOWED_EXTENSIONS is the other half of that list.
const COPIED = ["css", "js", "mjs", "json", "md", "svg", "txt", "webmanifest", "xml"];

/** How a stylesheet is compiled, wherever it is compiled from. */
function sassOptions(fromDir) {
  return {
    // A stylesheet can `@use 'tokens'` and reach site/_sass/_tokens.scss from anywhere.
    loadPaths: [fromDir, path.join(SOURCE_DIR, SASS_DIR), SOURCE_DIR],
    style: "compressed",
  };
}

export default function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(["html", "njk", "scss", ...COPIED]);

  // `{{ 'error' | css }}` is the CSS of site/css/error.scss, for a page that has to carry its
  // styles inline instead of linking them. error.html is the one: CloudFront returns it for any
  // 404, at whatever path was asked for, so "css/site.css" next to it would be a guess. It still
  // compiles from the same partials as every other page, so it still shares the one palette.
  eleventyConfig.addFilter("css", (name) => {
    if (!name) return "";
    const file = path.join(SOURCE_DIR, "css", `${name}.scss`);
    return sass.compile(file, sassOptions(path.dirname(file))).css;
  });

  // Keep every output path identical to its source path. Without this Eleventy writes "pretty"
  // permalinks (about.html -> about/index.html), which would break the relative links the site is
  // built from. A .scss file lands next to its source as .css.
  eleventyConfig.addGlobalData(
    "permalink",
    () => (data) => `${data.page.filePathStem}.${data.page.outputFileExtension}`,
  );

  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",
    compile(input, inputPath) {
      // "_name.scss" is a partial: @use'd by other stylesheets, never a stylesheet itself.
      if (path.basename(inputPath).startsWith("_")) return;
      const compiled = sass.compileString(input, sassOptions(path.dirname(inputPath)));
      this.addDependencies(inputPath, compiled.loadedUrls);
      return () => compiled.css;
    },
  });

  for (const extension of COPIED) {
    eleventyConfig.addExtension(extension, {
      outputFileExtension: extension,
      // read: false keeps Eleventy from parsing the file at all, so a JSON document that opens
      // with "---" keeps its first line and a template-looking string in a script stays put.
      read: false,
      compile: (_unused, inputPath) => () => readFileSync(inputPath, "utf8"),
    });
  }

  return {
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dir: { input: SOURCE_DIR, includes: INCLUDES_DIR },
  };
}
