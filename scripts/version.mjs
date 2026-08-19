#!/usr/bin/env node
// CLI over `.claude/mcp/vice/version.ts` -- the ONE implementation of this
// repo's version-resolution algorithm (D-5). This script is a thin wrapper:
// every rule decision (`pinned` / `no-published` / `prefix-differs` /
// `prefix-matches`) comes from `resolveVersion()` in the seam, imported
// below via a dynamic `import()` of the `.ts` module (Node's native
// type-stripping handles this directly on node >= 22.18 -- verified on node
// 22.22 during planning; see `version.ts`'s own header for why this module
// must never re-derive the algorithm here).
//
// SAFETY: this script may READ from npm (`npm view`, read-only) and WRITE
// local JSON files (the `stamp` subcommand, R-2's six derived-string
// locations). It must NEVER publish, tag, push, or invoke git in any form.
// There is no git or publish code path anywhere below, by design -- do not
// add one.
//
// Subcommands:
//   resolve [--published <v>] [--no-npm] [--json] [--github-output]
//   stamp <version>
//   check
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/scripts
const ROOT = dirname(HERE); // <root>
const SEAM_PATH = join(ROOT, ".claude", "mcp", "vice", "version.ts");
const PACKAGE_NAME = "@henols/vice-mcp";

const { DEV_PLACEHOLDER, resolveVersion, compareVersions, readTemplate } = await import(
  pathToFileURL(SEAM_PATH).href
);

// The ONE list of the six derived-string locations R-2 names. Both `stamp`
// and `check` drive off this single array so there is exactly one place
// that knows where they live.
const DERIVED_STRINGS = [
  { file: ".claude/mcp/vice/package.json", path: ["version"] },
  { file: "installer/package.json", path: ["version"] },
  { file: "installer/package.json", path: ["dependencies", "@henols/vice-mcp"] },
  { file: ".claude-plugin/plugin.json", path: ["version"] },
  { file: ".claude-plugin/marketplace.json", path: ["version"] },
  { file: ".claude-plugin/marketplace.json", path: ["plugins", 0, "version"] },
];

function readJson(relFile) {
  return JSON.parse(readFileSync(join(ROOT, relFile), "utf8"));
}

function writeJson(relFile, obj) {
  writeFileSync(join(ROOT, relFile), JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function getAtPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function setAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

function describeLocation(entry) {
  return `${entry.file} .${entry.path.map((p) => (typeof p === "number" ? `[${p}]` : p)).join(".")}`;
}

/** Read-only, best-effort: `npm view <pkg> version`. Returns null on any
 * failure (package unpublished, offline, npm not on PATH, etc) -- never
 * throws. This is the ONLY network-touching line in this script, and it
 * never mutates anything remote. */
function npmViewVersion(pkgName) {
  try {
    const out = execFileSync("npm", ["view", pkgName, "version"], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const opts = { published: undefined, noNpm: false, json: false, githubOutput: false, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--published") {
      opts.published = argv[++i];
    } else if (arg === "--no-npm") {
      opts.noNpm = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--github-output") {
      opts.githubOutput = true;
    } else {
      opts._.push(arg);
    }
  }
  return opts;
}

function cmdResolve(argv) {
  const opts = parseArgs(argv);

  let published;
  if (opts.published !== undefined) {
    published = opts.published;
  } else if (opts.noNpm) {
    published = null;
  } else {
    published = npmViewVersion(PACKAGE_NAME);
  }

  const template = readTemplate(ROOT);
  if (!template) {
    console.error(`version.mjs: no VERSION template found at ${join(ROOT, "VERSION")}`);
    process.exit(1);
  }

  let result;
  try {
    result = resolveVersion(template, published);
  } catch (err) {
    console.error(`version.mjs: resolve failed: ${err.message}`);
    process.exit(1);
  }

  // Guard (design's "built in, not bolted on" external check): unless
  // published is null, the resolved version must be strictly greater than
  // it. Catches a downward hand edit (e.g. "0.1.-" after 0.2.0 shipped)
  // loudly, here, instead of a 409 inside `npm publish`.
  //
  // Skip when result.rule === "no-published" rather than checking
  // `published !== null` directly (LOW-4): resolveVersion() itself already
  // decided an unparseable --published value degrades to "no-published"
  // semantics exactly like published === null (D-2 rule 4; see
  // version.test.ts's "an unparseable published string behaves as
  // no-published"). Checking the raw `published` variable instead would
  // diverge from that: a typo'd `--published dev` is non-null, so the old
  // guard ran compareVersions() anyway, which throws on unparseable input --
  // "resolve succeeded as no-published" would then incorrectly report as "the
  // CLI could not compare". Keying off result.rule keeps this guard
  // consistent with the seam's own null-vs-unparseable handling.
  if (result.rule !== "no-published") {
    let cmp;
    try {
      cmp = compareVersions(result.version, published);
    } catch (err) {
      console.error(`version.mjs: could not compare resolved "${result.version}" to published "${published}": ${err.message}`);
      process.exit(1);
    }
    if (!(cmp > 0)) {
      console.error(
        `version.mjs: resolved version ${result.version} is not strictly greater than published ${published} -- refusing (would fail npm publish with a 409, or silently republish an old line)`
      );
      process.exit(1);
    }
  }

  if (opts.githubOutput) {
    const outFile = process.env.GITHUB_OUTPUT;
    if (!outFile) {
      console.error("version.mjs: --github-output given but $GITHUB_OUTPUT is not set -- skipping file write");
    } else {
      appendFileSync(
        outFile,
        `version=${result.version}\npublished=${result.published ?? ""}\nrule=${result.rule}\n`,
        "utf8"
      );
    }
    console.log(`resolved ${result.version} (rule=${result.rule}, published=${result.published ?? "none"})`);
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result.version);
  }
}

function cmdStamp(argv) {
  const version = argv[0];
  if (!version) {
    console.error("version.mjs: stamp requires a version argument, e.g. `version.mjs stamp 0.0.0-dev`");
    process.exit(1);
  }

  // Group by file so a file with more than one derived string (both
  // installer/package.json entries) is read once and written once.
  const byFile = new Map();
  for (const entry of DERIVED_STRINGS) {
    if (!byFile.has(entry.file)) byFile.set(entry.file, []);
    byFile.get(entry.file).push(entry.path);
  }

  for (const [file, paths] of byFile) {
    const obj = readJson(file);
    for (const path of paths) {
      setAtPath(obj, path, version);
    }
    writeJson(file, obj);
  }

  console.log(`version.mjs: stamped ${version} into ${DERIVED_STRINGS.length} location(s) across ${byFile.size} file(s)`);
}

function cmdCheck() {
  const offenders = [];
  for (const entry of DERIVED_STRINGS) {
    const obj = readJson(entry.file);
    const value = getAtPath(obj, entry.path);
    if (value !== DEV_PLACEHOLDER) {
      offenders.push(`${describeLocation(entry)} = ${JSON.stringify(value)} (expected ${JSON.stringify(DEV_PLACEHOLDER)})`);
    }
  }
  if (offenders.length) {
    console.error("version.mjs: check FAILED -- the following derived strings are not the dev placeholder:");
    for (const o of offenders) console.error(`  - ${o}`);
    process.exit(1);
  }
  console.log(`version.mjs: check OK -- all ${DERIVED_STRINGS.length} derived strings equal ${DEV_PLACEHOLDER}`);
}

function main() {
  const [, , subcommand, ...rest] = process.argv;
  if (subcommand === "resolve") {
    cmdResolve(rest);
  } else if (subcommand === "stamp") {
    cmdStamp(rest);
  } else if (subcommand === "check") {
    cmdCheck();
  } else {
    console.error("usage: version.mjs <resolve|stamp|check> [options]");
    process.exit(2);
  }
}

main();
