#!/usr/bin/env node
// mcp-module.mjs -- the ONE resolution ladder a skill script uses to reach a
// module that lives in the OTHER package (`@henols/vice-mcp`'s `src/mcp/vice/`
// tree, as opposed to this file's own `@henols/c64-re-tools` skills tree).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Before this file existed, `vsf-slice.mjs`
// carried its own copy of this exact three-rung ladder (`ladder()` /
// `resolveTarget()`), and TWO MORE skill scripts (`acme.mjs`,
// `packer-finding.mjs`) were about to migrate onto the host-tool execution
// seam and were each going to need the identical lookup to reach
// the host-tool client. Three production consumers were about to carry
// three copies of one ladder -- so it is extracted here instead, and
// `vsf-slice.mjs` is rewritten to import it rather than keep its own.
//
// The underlying constraint this ladder exists to answer is
// `vsf-slice.mjs`'s own recorded finding: the MCP server ships as
// `@henols/vice-mcp`, whose `files[]` lists only `src/mcp/vice/` contents,
// while `src/skills/**` ships in a DIFFERENT package (`@henols/c64-re-tools`).
// A plain `import` from a skill script into the MCP tree resolves on NEITHER
// npm-installer route, so a skill script that needs an MCP-side module must
// LOCATE it on disk and invoke it as a subprocess (`process.execPath
// <resolved-path> ...argv`) -- never a static `import`.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
//   - the three-rung resolution order (`$VICE_MCP_DIR`, the in-repo relative
//     path, then `require.resolve()` against the published package) for
//     locating ANY named file inside `src/mcp/vice/` from a skill's own
//     `scripts/` directory;
//   - refusing BY NAME, listing every rung tried, when none resolves
//     (`refusalMessage()`);
//   - computing the in-repo hop count from `import.meta.url` rather than a
//     fixed `".."` count -- `hostpath.ts` and `containerpath.ts` both record
//     dropping a hard-coded four-level hop when they moved directories once
//     already, and this project has ALSO shipped a stale hardcoded snapshot
//     offset before (see `vsf-slice.mjs`'s own header) -- a fixed `".."`
//     count is a mistake this project keeps making, not a one-off.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never carry a second copy of these three rungs, their ordering, or
//     their refusal text anywhere else in this repository. A future
//     skill-side consumer of an MCP-side module imports `resolveMcpModule`
//     from HERE.
//   - Never let a resolution failure become a local re-implementation of
//     whatever was being resolved -- refuse by name instead. A silent
//     fallback that reimplements the target module's own logic is exactly
//     the divergence this ladder exists to prevent (see `vsf-slice.mjs`'s own
//     header on the stale-offset incident this project has already had).
//   - `process.execPath` spawned on a resolved `.ts`/`.mjs` file inside this
//     project's OWN tree reaches NO external host binary -- it is the
//     interpreter already running the calling script, pointed at an in-tree
//     module. This is NOT what the host-tool execution seam (`host-tool.mts`
//     / `host-tool-endpoint.mts`) exists for, and must never be confused with
//     it: the seam is for binaries that live on the HOST, outside any
//     container; this ladder is for locating a file inside this project's own
//     two npm packages.
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The package the MCP-side module ships in, for the npm-installer rung. */
export const TARGET_PACKAGE = "@henols/vice-mcp";

/**
 * Walks UP from `startDir` until a directory literally named `name` is
 * found, returning its absolute path -- or `null` if the filesystem root is
 * reached first without a match. This is what lets the in-repo hop count be
 * COMPUTED from `import.meta.url` instead of a fixed `".."` count: whichever
 * skill's `scripts/` directory this module is imported from, walking up to
 * the `skills/` ancestor and back down to `mcp/vice/` is the same operation.
 */
function findAncestorDir(startDir, name) {
  let dir = startDir;
  for (;;) {
    if (basename(dir) === name) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached the filesystem root, no match
    dir = parent;
  }
}

// Computed once, at module load: HERE is .../src/skills/<skill>/scripts/, so
// walking up to the "skills" ancestor and taking ITS parent ("src") gives the
// root from which "mcp/vice" is a sibling of "skills" -- with no fixed hop
// count written down anywhere in this file.
const SKILLS_DIR = findAncestorDir(HERE, "skills");
const IN_REPO_MCP_VICE_DIR = SKILLS_DIR ? join(dirname(SKILLS_DIR), "mcp", "vice") : null;

/**
 * The resolution ladder for `fileName`, in order, as `{ rung, path, note }`
 * records -- returned IN FULL (never short-circuited), so a refusal message
 * can name every path tried, which is the whole point of refusing rather
 * than guessing:
 *
 *   1. `$VICE_MCP_DIR` -- an explicit override, checked first so a caller can
 *      always point this ladder at a known-good tree.
 *   2. The in-repo relative path (see `findAncestorDir()` above). The plugin
 *      distribution keeps both trees in one checkout, so this is the rung
 *      that resolves during development and in CI.
 *   3. `require.resolve()` against the published package, for the
 *      npm-installer route where the two packages are installed separately.
 */
function ladder(fileName) {
  const rungs = [];

  const override = process.env.VICE_MCP_DIR;
  rungs.push({
    rung: "VICE_MCP_DIR",
    path: override ? join(resolve(override), fileName) : null,
    note: override ? null : "VICE_MCP_DIR is not set",
  });

  rungs.push({
    rung: "in-repo relative path",
    path: IN_REPO_MCP_VICE_DIR ? join(IN_REPO_MCP_VICE_DIR, fileName) : null,
    note: IN_REPO_MCP_VICE_DIR ? null : `could not locate an ancestor "skills" directory from ${HERE}`,
  });

  let resolved = null;
  let note = null;
  try {
    resolved = createRequire(import.meta.url).resolve(`${TARGET_PACKAGE}/${fileName}`);
  } catch (err) {
    note = `${TARGET_PACKAGE} is not resolvable from here (${err.code ?? err.message})`;
  }
  rungs.push({ rung: `${TARGET_PACKAGE} package`, path: resolved, note });

  return rungs;
}

/**
 * Builds the refusal text naming every rung tried plus the instruction to
 * set `VICE_MCP_DIR` -- the ONE place this message is worded, so callers
 * that construct their own additional context around it (e.g.
 * `vsf-slice.mjs`'s own domain-specific rationale) do not restate it.
 */
export function refusalMessage(fileName, rungs) {
  const tried = rungs
    .map((r) => `  ${r.rung}: ${r.path ?? "(no path)"}${r.note ? ` -- ${r.note}` : ""}`)
    .join("\n");
  return (
    `could not resolve ${fileName}.\n` +
    `Tried, in order:\n${tried}\n` +
    `Set VICE_MCP_DIR to the directory holding ${fileName}, or install ${TARGET_PACKAGE} where this script can ` +
    `resolve it: use the Claude Code plugin, or run the npm installer with --vendor. ` +
    `Under npx alone nothing on this machine is resolvable.`
  );
}

/**
 * Resolves `fileName` (e.g. `"vsf-slice.ts"`, `"resources/host-tool-endpoint.mjs"`) against
 * the three-rung ladder above, with NO per-file special-casing -- every
 * caller gets the same three rungs in the same order.
 *
 * Returns `{ ok: true, rung, path }` for the first rung whose path exists on
 * disk, or `{ ok: false, rungs, message }` when none resolves -- `rungs`
 * carries the full attempt list (so a caller can build its own message from
 * the raw records instead of `refusalMessage()`, if it wants extra context),
 * and `message` is `refusalMessage(fileName, rungs)` already computed. Never
 * throws.
 */
export function resolveMcpModule(fileName) {
  const rungs = ladder(fileName);
  const hit = rungs.find((r) => r.path && existsSync(r.path));
  if (hit) return { ok: true, rung: hit.rung, path: hit.path };
  return { ok: false, rungs, message: refusalMessage(fileName, rungs) };
}

// ---------------------------------------------------------------------------
// The host-tool call every skill script makes. Host tools (acme, c1541,
// petcat, unp64) are reached ONLY through the compiled endpoint client,
// spawned with process.execPath -- never an external binary spawned here.
// Compiled `.mjs`, so it also runs from under node_modules.
// ---------------------------------------------------------------------------

/** The endpoint client every host-tool call spawns. */
export const HOST_TOOL_CLIENT_FILE = "resources/host-tool-endpoint.mjs";

function clientCliArgs(clientPath, tool, args, toolsRoot, baseDir) {
  return [clientPath, "run", "--tool", tool, "--args", JSON.stringify(args), "--tools-root", toolsRoot, "--base-dir", baseDir];
}

function parseClientOutput(stdout, stderr) {
  const lines = String(stdout ?? "").split("\n").filter((line) => line.trim() !== "");
  const last = lines[lines.length - 1];
  if (last === undefined) return { ok: false, message: `host-tool-endpoint produced no output${stderr ? ` (stderr: ${stderr})` : ""}` };
  try {
    return JSON.parse(last);
  } catch {
    return { ok: false, message: `host-tool-endpoint produced non-JSON output: ${last}` };
  }
}

/** Moves every downloaded result out of `staging` into `destDir` under its
 * own name, rewriting each result's `path`. */
function settleResults(response, destDir) {
  if (!response.ok || !Array.isArray(response.results)) return response;
  const results = response.results.map((r) => {
    const target = join(destDir, basename(r.path));
    renameSync(r.path, target);
    return { ...r, path: target };
  });
  return { ...response, results };
}

/**
 * Runs `tool` with `args` through the broker's fixed endpoint. Relative paths
 * in `args` resolve against `baseDir`. Every result the tool declares is
 * downloaded into a staging directory inside `destDir` (same filesystem, so
 * the move is a rename) and then moved into `destDir` itself; the staging
 * directory is removed on every path. Never rejects: every failure resolves
 * `{ ok: false, message }`.
 */
export function invokeHostTool(tool, args, { destDir, baseDir = process.cwd() }) {
  return new Promise((resolvePromise) => {
    const resolved = resolveMcpModule(HOST_TOOL_CLIENT_FILE);
    if (!resolved.ok) {
      resolvePromise({ ok: false, message: refusalMessage(HOST_TOOL_CLIENT_FILE, resolved.rungs) });
      return;
    }
    let staging;
    try {
      mkdirSync(destDir, { recursive: true });
      staging = mkdtempSync(join(destDir, ".host-tool-"));
    } catch (e) {
      resolvePromise({ ok: false, message: `cannot prepare ${destDir}: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    const finish = (response) => {
      let settled;
      try {
        settled = settleResults(response, destDir);
      } catch (e) {
        settled = { ok: false, message: `cannot move results into ${destDir}: ${e instanceof Error ? e.message : String(e)}` };
      }
      rmSync(staging, { recursive: true, force: true });
      resolvePromise(settled);
    };
    let child;
    try {
      child = spawn(process.execPath, clientCliArgs(resolved.path, tool, args, staging, baseDir), { stdio: ["ignore", "pipe", "pipe"], shell: false });
    } catch (e) {
      finish({ ok: false, message: e instanceof Error ? e.message : String(e) });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => finish({ ok: false, message: err.message }));
    child.on("close", () => finish(parseClientOutput(stdout, stderr)));
  });
}

/**
 * The synchronous form of invokeHostTool(), for callers that must stay
 * synchronous. For tools whose answer is carried in the response itself
 * (e.g. `oracle.probe`/`oracle.run`'s `stdout` field): any downloaded file
 * lands in a temporary directory that is removed before this returns.
 * Never throws.
 */
export function invokeHostToolSync(tool, args, { baseDir = process.cwd(), timeoutMs } = {}) {
  const resolved = resolveMcpModule(HOST_TOOL_CLIENT_FILE);
  if (!resolved.ok) return { ok: false, message: refusalMessage(HOST_TOOL_CLIENT_FILE, resolved.rungs) };
  const staging = mkdtempSync(join(tmpdir(), "c64re-host-tool-"));
  try {
    const r = spawnSync(process.execPath, clientCliArgs(resolved.path, tool, args, staging, baseDir), {
      encoding: "utf8",
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
    });
    if (r.error && !r.stdout) return { ok: false, message: r.error.message };
    return parseClientOutput(r.stdout, r.stderr);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
