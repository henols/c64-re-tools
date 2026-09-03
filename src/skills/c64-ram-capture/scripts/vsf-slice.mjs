#!/usr/bin/env node
// Slice a flat 64K RAM image out of a VICE `.vsf` snapshot, with no
// transcription step anywhere.
//
// A WRAPPER, DELIBERATELY EMPTY OF LAYOUT KNOWLEDGE. Not one snapshot byte
// offset, module name or body length appears in this file. Every such fact
// lives in `src/mcp/vice/vsf-slice.ts`, which this script resolves and
// invokes. If you came here looking for the layout, you are in the wrong
// file, and that is the design.
//
// WHY IT INVOKES THE OTHER PACKAGE'S MODULE INSTEAD OF CARRYING A COPY.
// `src/mcp/vice/anno-d64.ts`'s header records the cross-package constraint as
// something measured rather than assumed: the MCP server ships as
// `@henols/vice-mcp`, whose `files[]` lists only `src/mcp/vice/` contents,
// while `src/skills/**` ships in the other package (`@henols/c64-re-tools`).
// A plain `import` from a skill script into the MCP tree resolves on neither
// npm-installer route, and `scripts/check-npm-packages.mjs`'s transitive
// closure walk over `files[]` would fail the pack the moment a reachable
// module sat outside the listed set.
//
// That leaves two answers, and this file takes the second:
//
//   (a) a self-contained skill-side script carrying its own copy of the
//       layout -- the `d64-parse.mjs` / `anno-d64.ts` precedent, which is two
//       independent copies of the sector-chain walk.
//   (b) a CLI entry point on the MCP-side module, which the skill invokes.
//
// (b), because the two cases are not alike. `d64-parse.mjs`'s duplicate is of
// a STABLE, PUBLISHED disk format that has not changed in forty years. The
// `.vsf` layout is version-sensitive: a second magic block moved the first
// module offset, the memory module's body length differs between two module
// minors that are both in the wild, and this project already had ONE stale
// copy of those numbers -- a prototype carrying a first-module offset that
// predates that second magic block, which survived only through a
// byte-by-byte rescan fallback that can lock onto a false module name inside
// 64 KB of RAM data. The real values, and their derivations, are in
// `vsf-slice.ts` where they belong. A second copy of the one
// authoritative reading of a version-sensitive format is precisely the
// divergence hazard the single-seam convention exists to remove. Recorded
// here as a decision so the next reader sees a choice rather than an
// oversight.
//
// IT SPAWNS `node` ON AN IN-TREE MODULE, AND NOTHING ELSE. `process.execPath`
// is the interpreter already running this script, and the target is a
// JavaScript/TypeScript file inside one of this project's own two packages.
// No external host binary is reached, so the host-tool execution seam is not
// involved here and must not be pre-empted -- that seam is for binaries that
// live on the host outside any container, which this is not.
//
// WHAT NOT TO DO:
//   - Never add a fallback that slices the snapshot here. If no rung of the
//     resolution ladder resolves, this script exits non-zero naming every
//     path it tried. A local re-implementation would turn a resolution
//     failure into a WRONG IMAGE, which is the one outcome the whole slicing
//     route exists to avoid.
//   - Never rewrite, prefix or summarise the target module's stderr. It is
//     inherited straight through, so a refusal reaches you in the words of
//     the code that refused.
//   - Never copy a snapshot byte offset, a module body length or a module
//     name into this file, not even in a comment as documentation, and not
//     even into the usage text. The next person to update the layout will
//     update `vsf-slice.ts` and will not know to look here. Its colocated
//     test asserts the absence mechanically, so this is a red gate rather
//     than a promise. (The `$D000-$DFFF` range in the usage below is a C64
//     address range and a fact about the memory-read route, not a snapshot
//     layout constant.)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The MCP-side module's file name, in one place. */
const TARGET_FILE = "vsf-slice.ts";

/** The package the MCP-side module ships in, for the npm-installer rung. */
const TARGET_PACKAGE = "@henols/vice-mcp";

/**
 * The resolution ladder, in order, as `{ rung, path }` records — returned in
 * full (not short-circuited) so the refusal message can name every path
 * tried, which is the whole point of refusing rather than guessing.
 *
 *   1. `$VICE_MCP_DIR` — an explicit override, checked first so a caller can
 *      always point this script at a known-good tree.
 *   2. The in-repo relative path. The plugin distribution keeps both trees in
 *      one checkout, so this is the rung that resolves during development and
 *      in CI.
 *   3. `require.resolve()` against the published package, for the
 *      npm-installer route where the two packages are installed separately.
 */
function ladder() {
  const rungs = [];

  const override = process.env.VICE_MCP_DIR;
  rungs.push({
    rung: "VICE_MCP_DIR",
    path: override ? join(resolve(override), TARGET_FILE) : null,
    note: override ? null : "VICE_MCP_DIR is not set",
  });

  rungs.push({
    rung: "in-repo relative path",
    path: resolve(HERE, "..", "..", "..", "mcp", "vice", TARGET_FILE),
    note: null,
  });

  let resolved = null;
  let note = null;
  try {
    resolved = createRequire(import.meta.url).resolve(`${TARGET_PACKAGE}/${TARGET_FILE}`);
  } catch (err) {
    note = `${TARGET_PACKAGE} is not resolvable from here (${err.code ?? err.message})`;
  }
  rungs.push({ rung: `${TARGET_PACKAGE} package`, path: resolved, note });

  return rungs;
}

/** The first rung whose path exists on disk, or `null`. */
function resolveTarget(rungs) {
  for (const entry of rungs) {
    if (entry.path && existsSync(entry.path)) return entry;
  }
  return null;
}

/** Forwards argv to the MCP-side entry point with stdio inherited, so its
 * stdout and stderr reach the caller unmodified and its exit status is this
 * script's exit status. */
function forward(argv) {
  const rungs = ladder();
  const target = resolveTarget(rungs);

  if (!target) {
    const tried = rungs
      .map((r) => `  ${r.rung}: ${r.path ?? "(no path)"}${r.note ? ` -- ${r.note}` : ""}`)
      .join("\n");
    console.error(
      `vsf-slice.mjs: could not resolve ${TARGET_FILE}, which is where the .vsf layout lives.\n` +
        `Tried, in order:\n${tried}\n` +
        `Set VICE_MCP_DIR to the directory holding ${TARGET_FILE}. Refusing rather than slicing ` +
        `the snapshot here: a second copy of a version-sensitive byte layout is how a wrong image ` +
        `gets produced with no error.`,
    );
    return 1;
  }

  const run = spawnSync(process.execPath, [target.path, ...argv], { stdio: "inherit" });
  if (run.error) {
    console.error(`vsf-slice.mjs: could not run ${target.path}: ${run.error.message}`);
    return 1;
  }
  if (run.signal) {
    console.error(`vsf-slice.mjs: ${target.path} was killed by ${run.signal}`);
    return 1;
  }
  return run.status ?? 1;
}

// Both verbs forward identically. The table exists so an unknown verb is
// answered here, with this script's usage, rather than by a subprocess whose
// own usage names a file the caller did not run.
//
// Prototype-less, via Object.create(null) (33 review WR-04). A plain object
// literal inherits Object.prototype, so `commands["constructor"]` and
// `commands["toString"]` are truthy FUNCTIONS: an unknown verb that happens to
// be a prototype member passed the known-verb test and was then CALLED, so the
// documented usage was never printed and the failure surfaced as a confusing
// message from process.exit() about its argument type instead. Same idiom this
// file already uses for its flag bag, applied one level up.
const commands = Object.assign(Object.create(null), { slice: forward, digest: forward });

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.error(`usage: node vsf-slice.mjs <command>

  slice <snapshot.vsf> --out <image.bin> [--json]   write the flat 64K image
  digest <snapshot.vsf>                             sha256 of the sliced image, writing no file

Produces a flat 64K image by slicing the snapshot's memory module body. There
is no transcription step on this route, so the \`$D000-$DFFF\` volatility rule
that governs the memory-read route does NOT apply to an image produced this
way: the snapshot array is RAM under I/O, not the register read view.

The layout lives in ${TARGET_FILE} on the MCP side; this script resolves it via
VICE_MCP_DIR, the in-repo path, or ${TARGET_PACKAGE}, and refuses by name when
no rung resolves. A malformed snapshot is refused, never truncated.`);
  process.exit(cmd ? 1 : 0);
}

try {
  process.exit(commands[cmd]([cmd, ...rest]));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
