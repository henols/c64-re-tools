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

// ---------------------------------------------------------------- audit
//
// Phase 40, plan 40-04 (PREP-01, D-06). Ports the fakery detector
// `src/skills/c64-ram-capture/scripts/d64-parse.mjs` carried at
// `parseDirectory()` (:124-193) onto this skill's own seam-reached
// capabilities, since `d64-parse.mjs` is deleted in 40-06 and `c1541`
// becomes the only `.d64` route (40-CONTEXT.md D-04). Composes THREE
// existing capabilities -- one `dir` call for names/block counts, one `bam`
// call for the per-sector allocation map, and one `entry` call PER NAME for
// that file's own claimed first track/sector and its directory sector's
// "next directory T/S" pointer -- rather than adding a seventh tool id.
//
// Same three named-reason signatures as the replaced parser, PLUS a
// genuinely SHARPER third signature (D-06): the per-SECTOR allocation map
// `c1541.bam` returns lets this check test the file's EXACT claimed first
// sector, not merely whether its whole track is free.
//   1. block count is 0
//   2. first track/sector is outside the image's own geometry
//   3. the first SECTOR the allocation map reports free -- the file cannot
//      really start there
//
// Plus the chain guard the replaced parser carried and `c1541` itself does
// not (40-RESEARCH.md Pitfall 7): a visited set over every "next directory
// T/S" pointer observed, seeded with the directory's own starting sector
// (18/1, the standard 1541 layout every other convention in this project
// already assumes), and a second visited set over every entry's own claimed
// first track/sector -- a repeat in EITHER produces a named `chain_error`.
//
// Composition detail worth recording: this audit's outer loop walks a
// FIXED, already-known list of names (`dir`'s own listing), never a raw
// track/sector-following walk the way the replaced parser did -- so unlike
// that parser, this walk cannot loop forever by construction, regardless of
// the chain guard. The chain guard here is therefore a DETECTION signal
// (does the disk's own metadata contain a cycle) rather than a hang
// preventer, and this audit deliberately keeps auditing every remaining
// name after the first chain_error is recorded, rather than aborting --
// otherwise a corrupt disk whose FIRST file happens to reveal the cycle
// would hide every later file's own independent flags, which is exactly the
// wrong trade for a detector whose job is finding every fabricated entry.

/** Strips ANSI colour escape codes -- `c1541`'s own captured output colours
 * "OPENCBM"/"Error" and the seam's refusal message quotes that text
 * verbatim, so an opaque entry-lookup failure reason would otherwise carry
 * raw escape bytes into a human-read report. */
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** The four sector-count zones of a standard 35-track 1541 image -- same
 * table `d64-parse.mjs` (:23-31) used, copied rather than imported since
 * that file is deleted in Phase 40 plan 40-06. */
export function sectorsPerTrack(track) {
  if (!Number.isInteger(track) || track < 1 || track > 35) return null;
  if (track <= 17) return 21;
  if (track <= 24) return 19;
  if (track <= 30) return 18;
  return 17;
}

/** The directory chain's own starting sector on a standard 1541 image --
 * `d64-parse.mjs`'s own default (`{ startTrack = 18, startSector = 1 }`,
 * :124). Seeded into the next-directory visited set BEFORE any entry is
 * read, so a next-directory pointer that refers back to this sector -- a
 * genuine self-reference, the shape this plan's own corrupt fixture plants
 * -- is caught on the very first entry that reports it. */
const DIRECTORY_START_TRACK = 18;
const DIRECTORY_START_SECTOR = 1;

/** Parses `c1541.dir`'s captured listing into `{ name, blocks }` pairs,
 * skipping the disk-header line (no recognised file-type word) and the
 * trailing "<N> blocks free." line. MEASURED against the committed
 * synthetic.d64/synthetic-corrupt.d64 fixtures. */
export function parseDirListing(stdout) {
  const entries = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+"([^"]*)"\s+\*?(prg|seq|usr|rel|del)\b/i);
    if (!m) continue;
    entries.push({ name: m[2].replace(/\s+$/, ""), blocks: Number(m[1]) });
  }
  return entries;
}

/** Parses `c1541.bam`'s captured allocation grid into `Map<track,
 * Set<allocatedSectorIndex>>`. Each row is a 1-2 digit track number
 * followed by at least two spaces, then a run of `*`/`.` characters (with
 * internal spacing purely for readability, stripped here) -- MEASURED
 * against the committed fixtures; the two header rows (column-index
 * scaffolding) never match this shape, since their own digits are not
 * followed by whitespace. */
export function parseBamAllocation(stdout) {
  const map = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,2})\s{2,}([*.\s]+)$/);
    if (!m) continue;
    const track = Number(m[1]);
    const cells = m[2].replace(/\s+/g, "");
    const allocated = new Set();
    for (let i = 0; i < cells.length; i++) if (cells[i] === "*") allocated.add(i);
    map.set(track, allocated);
  }
  return map;
}

/** Parses a SUCCESSFUL `c1541.entry` response's captured listing for the
 * file's own claimed first track/sector and blocks, plus its directory
 * sector's "Next directory T/S" pointer (a property of the SECTOR the entry
 * lives in, not of the file itself -- every entry sharing that sector
 * reports the same value). Returns `null` if the declared `T/S:` line is
 * absent (should not happen for an `ok:true` response, since the seam's own
 * classifier already required it -- defensive only). */
export function parseEntryFields(stdout) {
  const tsMatch = stdout.match(/T\/S:\s*(\d+)\/(\d+),\s*(\d+)\s*blocks/);
  if (!tsMatch) return null;
  const nextMatch = stdout.match(/Next directory T\/S:\s*(\d+)\/(\d+)/);
  return {
    firstTrack: Number(tsMatch[1]),
    firstSector: Number(tsMatch[2]),
    blocks: Number(tsMatch[3]),
    nextDirTrack: nextMatch ? Number(nextMatch[1]) : null,
    nextDirSector: nextMatch ? Number(nextMatch[2]) : null,
  };
}

/** Salvages a claimed first track/sector out of a REFUSED `c1541.entry`
 * response's own message, for the specific case MEASURED this plan (an
 * out-of-geometry first track/sector makes `c1541` itself fail to read the
 * file before it ever prints a `T/S:` line, so the seam's classifier
 * refuses with no usable stdout at all -- see fixtures/c1541/README.md).
 * The classifier's own refusal message carries a tail of the real captured
 * text, which for this failure mode names the exact track/sector `c1541`
 * tried and could not read. Returns `null` when the message carries no such
 * substring -- the caller then falls back to an opaque "entry lookup
 * failed" reason rather than fabricating a track/sector. */
export function salvageFirstTsFromRefusal(message) {
  const m = message.match(/Error reading T:(\d+)\s*S:(\d+)/);
  if (!m) return null;
  return { firstTrack: Number(m[1]), firstSector: Number(m[2]) };
}

/**
 * The pure detector core -- takes already-composed per-name records (each
 * either a resolved `{ name, blocks, firstTrack, firstSector, nextDirTrack,
 * nextDirSector }`, or `{ name, blocks, entryFailed: true, reason }` for a
 * name whose `c1541.entry` call itself could not be resolved) plus the BAM
 * allocation map, and applies the three named-reason signatures and the
 * chain guard. Never calls the seam itself -- fully unit-testable with
 * synthetic records, no `c1541` binary required.
 */
export function auditEntries(records, { bamAllocated }) {
  const visitedFirstTS = new Set([`${DIRECTORY_START_TRACK}/${DIRECTORY_START_SECTOR}`]);
  const visitedNextDir = new Set([`${DIRECTORY_START_TRACK}/${DIRECTORY_START_SECTOR}`]);
  let chainError = null;
  const entries = [];

  for (const r of records) {
    const reasons = [];
    let firstTrack = null;
    let firstSector = null;

    if (r.entryFailed) {
      if (r.salvagedFirstTrack !== undefined && r.salvagedFirstTrack !== null) {
        // A concise reason -- the "first track/sector ... outside the image"
        // reason below already names the salvaged value, so this only notes
        // WHY the entry lookup itself never printed a T/S: line, without
        // repeating the full raw transcript (ANSI colour codes and all).
        reasons.push("c1541 could not read this entry's own directory record at all -- see the geometry reason below");
        firstTrack = r.salvagedFirstTrack;
        firstSector = r.salvagedFirstSector;
      } else {
        reasons.push(`c1541 could not resolve this entry's directory record: ${stripAnsi(r.reason)}`);
      }
    } else {
      firstTrack = r.firstTrack;
      firstSector = r.firstSector;
    }

    if (r.blocks === 0) reasons.push("block count is 0");

    if (firstTrack !== null) {
      const spt = sectorsPerTrack(firstTrack);
      const inGeometry = spt !== null && firstSector !== null && firstSector >= 0 && firstSector < spt;
      if (!inGeometry) {
        reasons.push(`first track/sector ${firstTrack}/${firstSector} is outside the image`);
      } else {
        const allocated = bamAllocated.get(firstTrack);
        if (allocated && !allocated.has(firstSector)) {
          reasons.push(
            `first sector ${firstTrack}/${firstSector} is reported free by the allocation map -- the file cannot really start there`,
          );
        }
        const key = `${firstTrack}/${firstSector}`;
        if (visitedFirstTS.has(key) && chainError === null) {
          chainError = `two entries claim the same first track/sector ${key} -- a fabricated or corrupted directory record`;
        }
        visitedFirstTS.add(key);
      }
    }

    if (!r.entryFailed && r.nextDirTrack !== null && r.nextDirTrack !== 0) {
      const nextKey = `${r.nextDirTrack}/${r.nextDirSector}`;
      if (visitedNextDir.has(nextKey) && chainError === null) {
        chainError = `directory chain revisited ${nextKey} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`;
      }
      visitedNextDir.add(nextKey);
    }

    entries.push({
      name: r.name,
      blocks: r.blocks,
      first_track: firstTrack,
      first_sector: firstSector,
      suspicious: reasons.length > 0,
      suspicious_reasons: reasons,
    });
  }

  return { entries, chain_error: chainError };
}

/** Reads back the produced listing file for an `ok:true` seam response's
 * first result -- mirrors `augmentEntryResponse()`'s own read-back
 * convention above (display-purposed parsing over an already-decided
 * response, never a second oracle). Returns `""` if the file cannot be
 * read. */
function readSeamOutputText(response) {
  const path = response.results?.[0]?.path;
  if (!path) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** Composes `c1541.dir` + `c1541.bam` + one `c1541.entry` call per name into
 * the pure `auditEntries()` detector above. When ANY composed seam call
 * fails outright (`ok:false`), the whole audit fails with that call's own
 * refusal reported verbatim -- there is no byte-level fallback (D-05):
 * never read the image bytes locally when the seam is unreachable, because
 * a fallback that works on the developer's own host and silently fails
 * inside a container is the exact failure this seam exists to remove.
 */
async function runAudit(argv) {
  const o = parseOpts(argv);
  if (!o.image) die(`usage: audit --image <path.d64> [--out-dir <dir>] [--json]`);

  const imageAbs = resolve(o.image);
  const outDirAbs = o.outDir ? resolve(o.outDir) : dirname(imageAbs);
  const repoRoot = commonAncestorDir(dirname(imageAbs), outDirAbs);
  const baseArgs = { image: toRel(repoRoot, imageAbs) };
  if (o.outDir) baseArgs.outDir = toRel(repoRoot, outDirAbs);

  const dirResp = await invokeSeam("c1541.dir", baseArgs, repoRoot);
  if (!dirResp.ok) {
    report(dirResp, o);
    process.exit(1);
  }
  const names = parseDirListing(readSeamOutputText(dirResp));

  const bamResp = await invokeSeam("c1541.bam", baseArgs, repoRoot);
  if (!bamResp.ok) {
    report(bamResp, o);
    process.exit(1);
  }
  const bamAllocated = parseBamAllocation(readSeamOutputText(bamResp));

  const records = [];
  for (const { name, blocks } of names) {
    const entryResp = await invokeSeam("c1541.entry", { ...baseArgs, name }, repoRoot);
    if (entryResp.ok) {
      const fields = parseEntryFields(readSeamOutputText(entryResp));
      records.push(fields ? { name, blocks, ...fields } : { name, blocks, entryFailed: true, reason: "entry response carried no T/S: line" });
    } else {
      const salvaged = salvageFirstTsFromRefusal(entryResp.message);
      records.push({
        name,
        blocks,
        entryFailed: true,
        reason: entryResp.message,
        salvagedFirstTrack: salvaged?.firstTrack ?? null,
        salvagedFirstSector: salvaged?.firstSector ?? null,
      });
    }
  }

  const result = auditEntries(records, { bamAllocated });
  if (o.json) {
    console.log(JSON.stringify(result));
  } else {
    for (const e of result.entries) {
      const flag = e.suspicious ? ` SUSPICIOUS: ${e.suspicious_reasons.join("; ")}` : "";
      console.log(`"${e.name}" first=${e.first_track}/${e.first_sector} blocks=${e.blocks}${flag}`);
    }
    if (result.chain_error) console.log(`chain error: ${result.chain_error}`);
  }
  process.exit(0);
}

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
//
// Phase 40, plan 40-04 (Rule 3 fix, discovered mid-execution): the CLI
// dispatch below MUST be guarded to run only when this file is the actual
// entry point, not merely imported -- c1541.test.mjs (this plan) imports
// auditEntries()/parseDirListing()/etc. as a pure library, and an unguarded
// dispatch would run this section with the TEST RUNNER's own process.argv
// (no recognised command) on every import, printing the usage banner and
// calling process.exit(0) before a single test() call ever registers.
// Mirrors d64-parse.mjs's own entry-point guard (`resolve(process.argv[1])
// === fileURLToPath(import.meta.url)`) rather than inventing a second shape.

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const VERBS = {
    bam: (argv) => runCapability("bam", argv),
    dir: (argv) => runCapability("dir", argv),
    entry: (argv) => runCapability("entry", argv),
    chain: (argv) => runCapability("chain", argv),
    read: (argv) => runCapability("read", argv),
    audit: (argv) => runAudit(argv),
  };
  if (!cmd || !VERBS[cmd]) {
    console.log(`usage: node ${selfPath()} <command> [options]

  bam    --image <path.d64> [--out-dir <dir>] [--json]                  block allocation map
  dir    --image <path.d64> [--out-dir <dir>] [--json]                  directory listing
  entry  --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  one directory entry's raw fields
  chain  --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  a named file's sector chain
  read   --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]  extract a named file's bytes
  audit  --image <path.d64> [--out-dir <dir>] [--json]                  find fabricated/corrupted directory entries

Read-only -- no -format/-write/-bwrite/-delete verb is reachable from this script.

options: --image PATH  --name CBM-NAME  --out-dir DIR  --json`);
    process.exit(cmd ? 1 : 0);
  }
  await VERBS[cmd](rest);
}
