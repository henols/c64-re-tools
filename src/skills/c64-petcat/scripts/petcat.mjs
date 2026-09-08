#!/usr/bin/env node
// petcat -> BASIC detokenization + SYS-handover driver. One capability:
// decode a BASIC program's stub to readable text and resolve the numeric
// address it hands over to machine code, when that address is a literal.
//
// Phase 40, plan 40-03 (PREP-02, D-17, D-18): reached ONLY through the
// host-tool execution seam -- the project owner's rule of 2026-08-28
// (.planning/seeds/host-tool-executor.md) is that this script runs
// container-side, `petcat` lives host-side, and there is no container PATH
// to find it on. This file never spawns `petcat` itself; it constructs a
// TYPED request (`petcat.decode`) and reads the produced listing file back
// off the shared workspace tree, mirroring
// src/skills/c64-disk-access/scripts/c1541.mjs's own invokeSeam() shape
// verbatim.
//
// WHAT NOT TO DO:
//   - Never spawn the conversion binary (`petcat`) directly from this
//     script, even as a "just this once" fallback. A direct call works on
//     the developer's own host and silently fails inside a container -- the
//     exact failure this seam exists to remove.
//   - Never guess an entry point when the seam reports a null one. A
//     guessed address is spent on a disassembler downstream, and a wrong
//     one is expensive there -- report the decline and its reason exactly
//     as the seam gave them, never a fallback value.
import { dirname, relative, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { resolveMcpModule, refusalMessage } from "../../c64-ram-capture/scripts/mcp-module.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

/** The MCP-side module this script reaches -- never imported statically
 * (cross-package: this file ships in `@henols/c64-re-tools`, the seam client
 * ships in `@henols/vice-mcp`), only located via the ladder and invoked with
 * `process.execPath`, the interpreter already running this script, on an
 * in-tree module -- not an external host binary. */
const HOST_TOOL_CLIENT_FILE = "host-tool-client.ts";

/**
 * Invokes the host-tool execution seam for `tool`/`args`, rooted at
 * `repoRoot` for THIS invocation's workspace-relative path resolution.
 * Never rejects: a resolution failure, a spawn failure, or unparseable
 * output all resolve to `{ ok: false, message }` -- the same shape a tool's
 * own refusal uses, so a caller never needs a try/catch. Copied verbatim
 * from acme.mjs's own invokeSeam() -- see this file's own header for why a
 * shared import is not possible across the two npm packages.
 */
function invokeSeam(tool, args, repoRoot) {
  return new Promise((resolvePromise) => {
    const resolved = resolveMcpModule(HOST_TOOL_CLIENT_FILE);
    if (!resolved.ok) {
      resolvePromise({ ok: false, message: refusalMessage(HOST_TOOL_CLIENT_FILE, resolved.rungs) });
      return;
    }

    const cliArgs = [resolved.path, "run", "--tool", tool, "--args", JSON.stringify(args), "--repo-root", repoRoot];
    let child;
    try {
      child = spawn(process.execPath, cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolvePromise({ ok: false, message: e instanceof Error ? e.message : String(e) });
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => resolvePromise({ ok: false, message: err.message }));
    child.on("close", () => {
      const lines = stdout.split("\n").filter((line) => line.trim() !== "");
      const last = lines[lines.length - 1];
      if (last === undefined) {
        resolvePromise({ ok: false, message: `host-tool-client.ts produced no output${stderr ? ` (stderr: ${stderr})` : ""}` });
        return;
      }
      try {
        resolvePromise(JSON.parse(last));
      } catch {
        resolvePromise({ ok: false, message: `host-tool-client.ts produced non-JSON output: ${last}` });
      }
    });
  });
}

/** The smallest common ancestor directory of two absolute paths -- computed,
 * never a fixed guess, so the request's `--repo-root` for THIS invocation is
 * always exactly big enough to contain both the image and the output
 * directory, and no bigger. Copied verbatim from acme.mjs's own
 * commonAncestorDir() -- see this file's own header for why a shared import
 * is not possible. */
function commonAncestorDir(a, b) {
  const partsA = resolve(a).split(sep);
  const partsB = resolve(b).split(sep);
  const common = [];
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    if (partsA[i] === partsB[i]) common.push(partsA[i]);
    else break;
  }
  const joined = common.join(sep);
  return joined === "" ? sep : joined;
}

/** `path.relative()`, except the "same directory" case yields `"."` rather
 * than `""` -- the seam's `resolveWorkspacePath()` refuses an empty string,
 * but accepts `"."` as a no-op relative reference to its own root. */
function toRel(root, abs) {
  const r = relative(root, abs);
  return r === "" ? "." : r;
}

// How to refer to this script in hints, from wherever we were run.
function selfPath() {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

// ------------------------------------------------------------- capabilities

/**
 * Detokenizes `--image` (required) to readable BASIC text and resolves its
 * `SYS` handover point, when it has one. `--out-dir` is optional, defaulting
 * to the seam's own dirname(image) default exactly as acme.build's own
 * outDir default does. Prints the seam's response verbatim as one line of
 * JSON when `--json` is given -- the response IS the reportable shape
 * (`{ ok, tool, exitStatus, results, stderrTail, entrypoint,
 * entrypointReason }` / `{ ok: false, message }`), so no reshaping happens
 * here.
 */
async function runDecode(argv) {
  const o = parseOpts(argv);
  if (!o.image) die(`usage: decode --image <path.prg> [--out-dir <dir>] [--json]`);

  const imageAbs = resolve(o.image);
  const outDirAbs = o.outDir ? resolve(o.outDir) : dirname(imageAbs);

  // Workspace-relative request construction (mirrors acme.mjs's own build()):
  // the root for THIS invocation is the smallest ancestor containing both
  // the image and the output directory.
  const repoRoot = commonAncestorDir(dirname(imageAbs), outDirAbs);
  const args = { image: toRel(repoRoot, imageAbs) };
  if (o.outDir) args.outDir = toRel(repoRoot, outDirAbs);

  const response = await invokeSeam("petcat.decode", args, repoRoot);
  report(response, o);
  process.exit(response.ok ? 0 : 1);
}

function report(response, { json }) {
  if (json) {
    console.log(JSON.stringify(response));
    return;
  }
  if (!response.ok) {
    console.error(`petcat call FAILED: ${response.message}`);
    return;
  }
  // WHAT NOT TO DO (this file's own header): never guess an entry point --
  // print exactly what the seam reported, decline included.
  if (response.entrypoint !== null) {
    console.log(`entry point: ${response.entrypoint} (${response.entrypointReason})`);
  } else {
    console.log(`entry point not resolved: ${response.entrypointReason}`);
  }
  for (const r of response.results ?? []) {
    console.log(`${r.path}  (${r.byteLength} bytes, sha256 ${r.sha256})`);
  }
}

// ------------------------------------------------------------------ options

function parseOpts(argv) {
  const o = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--image") o.image = argv[++i];
    else if (a === "--out-dir") o.outDir = argv[++i];
  }
  return o;
}

// --------------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const VERBS = {
  decode: (argv) => runDecode(argv),
};
if (!cmd || !VERBS[cmd]) {
  console.log(`usage: node ${selfPath()} <command> [options]

  decode --image <path.prg> [--out-dir <dir>] [--json]   detokenize a BASIC program and resolve its SYS handover point

Never invokes petcat directly and never guesses an entry point -- a computed
SYS argument is reported as a named decline, never an address.

options: --image PATH  --out-dir DIR  --json`);
  process.exit(cmd ? 1 : 0);
}
await VERBS[cmd](rest);
