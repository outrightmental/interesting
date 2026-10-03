#!/usr/bin/env node
/**
 * Build /site into the artifact that gets published.
 *
 * Everything a person (or the hourly AI) edits lives in /site. Nothing in there is published as it
 * stands: this script turns it into a folder of plain files -- the templates rendered, the Sass
 * compiled, everything else copied -- and that folder is what the deploy syncs to S3. The pipeline
 * itself is configured in eleventy.config.mjs.
 *
 *   npm run build                            # build ./site into a throwaway temp folder
 *   node build.mjs --out path/to/folder      # build into a folder of your choosing
 *   node build.mjs --source path/to/site     # build a copy of the site somewhere else
 *   node build.mjs --quiet                   # print only the output folder
 *
 * The last line of stdout is always the output folder, so a caller can read it without parsing
 * anything else. The folder is emptied first, so a page a run deleted stops being built.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Eleventy from "@11ty/eleventy";

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(REPO_ROOT, "eleventy.config.mjs");

function parseArgs(argv) {
  const options = { source: path.join(REPO_ROOT, "site"), out: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--quiet" || arg === "-q") {
      options.quiet = true;
    } else if (arg === "--source" || arg === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} needs a path`);
      options[arg === "--out" ? "out" : "source"] = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

async function build({ source, out, quiet }) {
  const sourceDir = path.resolve(source);
  // "generated into a temp folder": by default the build goes somewhere throwaway, outside the
  // repository, so there is never a built copy of the site to commit by accident.
  const outDir = out ? path.resolve(out) : mkdtempSync(path.join(tmpdir(), "interesting-site-"));
  rmSync(outDir, { recursive: true, force: true }); // a deleted page must not survive in the output

  // Eleventy works out an output path by taking the input folder off the front of each input path,
  // which it can only do when the input folder is a plain name it recognises in those paths. Run
  // from the folder above the source and name it with one segment, so site/index.html becomes
  // index.html and not site/index.html -- whichever folder the source actually lives in.
  process.chdir(path.dirname(sourceDir));
  const input = path.basename(sourceDir);
  process.env.SITE_SOURCE_DIR = input; // eleventy.config.mjs needs it for the Sass load paths
  const eleventy = new Eleventy(input, outDir, {
    quietMode: true,
    configPath: CONFIG_PATH,
  });
  if (quiet) eleventy.disableLogger();
  await eleventy.write();

  console.log(outDir); // always last: a caller reads the output folder from here
}

try {
  await build(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(`Build failed: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
}
