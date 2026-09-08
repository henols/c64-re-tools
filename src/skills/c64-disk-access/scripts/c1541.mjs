#!/usr/bin/env node
// c1541 -> disk-image reader driver. Read-only: directory, block allocation
// map, a named file's sector chain, and a named file's raw bytes. No write,
// format, delete or any other mutating verb is reachable from this script --
// deliberately, per the plan's own D-03.
//
// Phase 40, plan 40-02 (PREP-01, D-01, D-02): reached ONLY through the
// host-tool execution seam -- the project owner's rule of 2026-08-28
// (.planning/seeds/host-tool-executor.md) is that this script runs
// container-side, `c1541` lives host-side, and there is no container PATH to
// find it on. This file never spawns c1541 itself; it constructs a TYPED
// request per capability (`c1541.bam`/`c1541.dir`/`c1541.entry`/
// `c1541.chain`/`c1541.read`) and reads the produced files back off the
// shared workspace tree, mirroring src/skills/acme-build/scripts/acme.mjs's
// own invokeSeam() shape verbatim.
//
// WHAT NOT TO DO:
//   - Never spawn the disk-image utility (`c1541`) directly from this
//     script, even as a "just this once" fallback. A direct call works on
//     the developer's own host and silently fails inside a container -- the
//     exact failure this seam exists to remove.
//   - Never fall back to reading the image bytes locally (re-parsing the
//     `.d64` in this script) when the seam refuses. A seam refusal is
//     reported as `{ ok: false, message }`; it is never retried by
//     re-implementing the read here.
import { readFileSync } from "node:fs";
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

/** The one place a subcommand name maps to its `host_tool` id. */
const VERB_TO_TOOL = {
  bam: "c1541.bam",
  dir: "c1541.dir",
  entry: "c1541.entry",
  chain: "c1541.chain",
  read: "c1541.read",
};

/** `entry`/`chain`/`read` all require a CBM name -- the seam itself refuses
 * a request missing `name` for these, but failing fast here gives a plain
 * usage message rather than a round-trip to the seam for a mistake this
 * script can already see. */
const VERBS_REQUIRING_NAME = new Set(["entry", "chain", "read"]);

/**
 * Runs one c1541 capability against `--image` (required), `--name`
 * (required for entry/chain/read, ignored for bam/dir), and `--out-dir`
 * (optional, defaults to the seam's own dirname(image) default exactly as
 * acme.build's own outDir default does). Prints the seam's response
 * verbatim as one line of JSON when `--json` is given -- the response IS
 * the reportable shape (`{ ok, tool, exitStatus, results, stderrTail }` /
 * `{ ok: false, message }`), so no reshaping happens here except for
 * `entry`, whose own listing file this script additionally parses for the
 * first track/sector (see augmentEntryResponse() below).
 */
async function runCapability(verb, argv) {
  const tool = VERB_TO_TOOL[verb];
  if (!tool) die(`unknown c1541 capability: ${verb}`);

  const o = parseOpts(argv);
  if (!o.image) die(`usage: ${verb} --image <path.d64> [--name <cbm-name>] [--out-dir <dir>] [--json]`);
  if (VERBS_REQUIRING_NAME.has(verb) && !o.name) {
    die(`usage: ${verb} --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]`);
  }

  const imageAbs = resolve(o.image);
  const outDirAbs = o.outDir ? resolve(o.outDir) : dirname(imageAbs);

  // Workspace-relative request construction (mirrors acme.mjs's own build()):
  // the root for THIS invocation is the smallest ancestor containing both
  // the image and the output directory.
  const repoRoot = commonAncestorDir(dirname(imageAbs), outDirAbs);
  const args = { image: toRel(repoRoot, imageAbs) };
  if (o.outDir) args.outDir = toRel(repoRoot, outDirAbs);
  if (o.name !== undefined) args.name = o.name;

  let response = await invokeSeam(tool, args, repoRoot);
  if (verb === "entry") response = augmentEntryResponse(response);
  report(response, o);
  process.exit(response.ok ? 0 : 1);
}

/** Reads `c1541.entry`'s own listing file back and parses its `T/S:
 * <t>/<s>, <n> blocks` line (MEASURED against the committed fixture,
 * fixtures/c1541/README.md) into numeric `firstTrack`/`firstSector` fields
 * on the response -- never a second copy of the classifier's own oracle;
 * this parses purely for DISPLAY, after the seam has already decided
 * ok/not-ok. A response the seam reported as a failure, or a listing this
 * parse cannot make sense of, is returned UNCHANGED -- never a thrown
 * error and never a fabricated track/sector pair. */
function augmentEntryResponse(response) {
  if (!response.ok) return response;
  const listingPath = response.results?.[0]?.path;
  if (!listingPath) return response;
  let text;
  try {
    text = readFileSync(listingPath, "utf8");
  } catch {
    return response;
  }
  const m = text.match(/T\/S:\s*(\d+)\/(\d+),\s*(\d+)\s*blocks/);
  if (!m) return response;
  return { ...response, firstTrack: Number(m[1]), firstSector: Number(m[2]) };
}

function report(response, { json }) {
  if (json) {
    console.log(JSON.stringify(response));
    return;
  }
  if (!response.ok) {
    console.error(`c1541 call FAILED: ${response.message}`);
    return;
  }
  for (const r of response.results ?? []) {
    console.log(`${r.path}  (${r.byteLength} bytes, sha256 ${r.sha256})`);
  }
  if (response.firstTrack !== undefined) {
    console.log(`first track/sector: ${response.firstTrack}/${response.firstSector}`);
  }
}

// ------------------------------------------------------------------ options

function parseOpts(argv) {
  const o = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--image") o.image = argv[++i];
    else if (a === "--name") o.name = argv[++i];
    else if (a === "--out-dir") o.outDir = argv[++i];
  }
  return o;
}

// --------------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const VERBS = {
  bam: (argv) => runCapability("bam", argv),
  dir: (argv) => runCapability("dir", argv),
  entry: (argv) => runCapability("entry", argv),
  chain: (argv) => runCapability("chain", argv),
  read: (argv) => runCapability("read", argv),
};
if (!cmd || !VERBS[cmd]) {
  console.log(`usage: node ${selfPath()} <command> [options]

  bam    --image <path.d64> [--out-dir <dir>] [--json]                  block allocation map
  dir    --image <path.d64> [--out-dir <dir>] [--json]                  directory listing
  entry  --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  one directory entry's raw fields
  chain  --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  a named file's sector chain
  read   --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  extract a named file's bytes

Read-only -- no -format/-write/-bwrite/-delete verb is reachable from this script.

options: --image PATH  --name CBM-NAME  --out-dir DIR  --json`);
  process.exit(cmd ? 1 : 0);
}
await VERBS[cmd](rest);
