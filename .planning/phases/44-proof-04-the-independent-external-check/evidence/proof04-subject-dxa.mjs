#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof04-subject-dxa.mjs -- Phase 44, plan 44-01. The SUBJECT producer.
//
// WHAT IT IS FOR
// --------------
// PROOF-04 needs an independent, external check of dxa's byte-derived
// classification of `BRUCE LEE   (DC)` -- the same corpus/entry PROOF-01
// measured. This script produces ONLY the subject side: dxa's own
// code/data/unclassified classification, written as a `BlockEntry[]`
// artifact. It never touches VICE, never touches the text-monitor protocol,
// and never touches the runtime evidence layer -- that is the ORACLE
// producer's exclusive domain (`proof04-oracle-memmap.mjs`), and Criterion 2
// requires the two to be structurally independent, not merely promised so.
//
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// -------------------------------------------------------
//   * disk-image read     -> the ONE `.d64` route: `c1541.dir` then
//                             `c1541.read`, over the host-tool seam
//                             (`resources/host-tool.mjs`'s `runHostTool()`).
//                             `anno-d64.ts` is GONE (Phase 40 plan 40-06
//                             deleted it) -- this script never names it.
//   * the dxa invocation   -> `dxa-run.ts`'s `runDxaDisassemble()`, which
//                             reaches dxa ONLY through the host-tool seam and
//                             never a direct spawn (SEAM-05's
//                             BANNED_COMMAND_SHAPES already names dxa).
//
// This script never calls a child process itself: the ONE process this
// measurement ever spawns is dxa itself, and that spawn belongs entirely to
// `runDxaDisassemble()`'s own host-tool seam.
//
// CORPUS AND ENTRY IDENTITY: NAME PLUS SHA256, ASSERTED BEFORE ANY BYTE IS
// READ FOR ANY OTHER PURPOSE -- mirrors `proof01-dxa-real-release.mjs`'s own
// convention (T-38-02 / T-44-01), applied to a second producer pair.
//
// SCRATCH WORKSPACE: `mkdtempSync` under `PROBE_DIR`, OUTSIDE the checkout
// and never `/tmp` (tmpfs on this host, emptied only on reboot), torn down
// in a `finally`.
//
// IMPORT BOUNDARY (Criterion 2), CLOSED
// --------------------------------------
// This module imports ONLY `node:` builtins, the compiled host-tool seam
// (`resources/host-tool.mjs`) and `dxa-run.ts`. It must NEVER import
// `text-protocol.ts`, `textmon-memmap.ts`, `evid-ingest.ts`,
// `probe-harness.mjs` or `evid-reconcile.ts` -- those name the oracle's and
// the join's exclusive domains -- and it must never name the oracle
// artifact's own basename (`oracle-memmap.json`) anywhere outside a comment.
// -----------------------------------------------------------------------------
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// --- shipped seams -----------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

// The host-tool seam is reached through its COMPILED resources artifact, not
// the host-bound `.mts` source -- mirrors `dxa-live.test.ts`'s own CORPUS
// case (a plain static import of the `.mts` source throws
// ERR_MODULE_NOT_FOUND at load time from outside `src/mcp/vice/`).
const hostToolModule = await import(pathToFileURL(path.join(MCP_DIR, "resources", "host-tool.mjs")).href);
const { runHostTool } = hostToolModule;
const { runDxaDisassemble } = await import(path.join(MCP_DIR, "dxa-run.ts"));

// --- fixed inputs (SCHEMA.md section 1) --------------------------------------

const ENTRY_NAME = "BRUCE LEE   (DC)";
const RELEASE_SHA256_EXPECTED = "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5";
const ENTRY_SHA256_EXPECTED = "331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4";
const ENTRY_BYTES_EXPECTED = 45074;
/** The extracted `.prg`'s own `10 SYS2073` BASIC line's `SYS` target,
 * established by Phase 35 -- never re-derived here. */
const ENTRYPOINT_HEX = "0819";

/** Never inside the checkout, never `/tmp` (tmpfs on this host, emptied only
 * on reboot). */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase44");

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** README.md's corpus-resolution convention: `$C64_CORPUS_DIR` if set, else
 * the repo-relative Phase 23 corpus path. Fails loudly, naming BOTH
 * attempted absolute paths, when neither holds the file. */
function resolveCorpusPath() {
  const envDir = process.env.C64_CORPUS_DIR;
  const candidateEnv = envDir ? path.resolve(envDir, "danish.d64") : null;
  const candidateRepo = path.join(
    REPO_ROOT,
    ".planning",
    "phases",
    "23-the-real-release-gate-go-degrade-no-go",
    "evidence",
    "corpus",
    "danish.d64",
  );

  const attempted = [];
  if (candidateEnv) {
    attempted.push(candidateEnv);
    try {
      return { path: candidateEnv, bytes: readFileSync(candidateEnv) };
    } catch {
      // fall through to the repo-relative candidate
    }
  }
  attempted.push(candidateRepo);
  try {
    return { path: candidateRepo, bytes: readFileSync(candidateRepo) };
  } catch {
    throw new Error(
      `proof04-subject-dxa.mjs: danish.d64 not found at either attempted path: ${attempted.join(", ")} -- ` +
        "the corpus is gitignored, operator-supplied material, absent from a fresh clone and from a git worktree. " +
        "Set $C64_CORPUS_DIR or place the file at the repo-relative Phase 23 corpus path.",
    );
  }
}

/** The smallest common ancestor directory of two absolute paths -- computed,
 * never a fixed guess (T-44-05). Duplicated from `dxa-live.test.ts`'s own
 * copy per this project's established convention: this file must never
 * reach into a sibling test file or a skill script. */
function commonAncestorDir(a, b) {
  const partsA = path.resolve(a).split(path.sep);
  const partsB = path.resolve(b).split(path.sep);
  const common = [];
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    if (partsA[i] === partsB[i]) common.push(partsA[i]);
    else break;
  }
  const joined = common.join(path.sep);
  return joined === "" ? path.sep : joined;
}

/** `path.relative()`, except the "same directory" case yields `"."` rather
 * than `""` -- `resolveWorkspacePath()` (host-tool.mts) refuses an empty
 * string but accepts `"."` as a no-op relative reference to its own root. */
function toRel(root, abs) {
  const r = path.relative(root, abs);
  return r === "" ? "." : r;
}

/** Extracts the named entry's raw bytes through the ONE `.d64` route:
 * `c1541.dir` then `c1541.read`, over the host-tool seam. Refuses BY NAME on
 * either response's `ok: false`, quoting the seam's own message -- never a
 * hand-rolled parse and never a direct shell-out to `c1541`.
 *
 * `c1541 -read`'s own `name` argument must match the directory listing's OWN
 * spelling byte-for-byte -- `c1541 -dir` prints CBM PETSCII names in
 * LOWERCASE display form, and `-read` matches against that same lowercase
 * spelling, not the uppercase form this script's own `SUBJECT_ENTRY_NAME`
 * outcome line uses (which mirrors PROOF-01's own naming convention). This
 * function therefore parses the listing's own quoted name -- the SAME
 * extraction `dxa-live.test.ts`'s own `extractCorpusProgram()` uses -- and
 * passes THAT to `c1541.read`, never the caller's display-form constant. */
async function extractEntryOverSeam(corpusCopyPath, outDir, expectedEntryName) {
  const root = commonAncestorDir(corpusCopyPath, outDir);
  const baseArgs = { image: toRel(root, corpusCopyPath), outDir: toRel(root, outDir) };

  const dirResp = await runHostTool({ tool: "c1541.dir", args: baseArgs }, { repoRoot: root });
  if (!dirResp.ok) {
    throw new Error(`proof04-subject-dxa.mjs: c1541.dir refused: ${dirResp.message}`);
  }
  const listingPath = dirResp.results[0]?.path;
  if (!listingPath) {
    throw new Error("proof04-subject-dxa.mjs: c1541.dir reported no listing output");
  }
  const listingText = readFileSync(listingPath, "utf8");
  const entryMatch = listingText.match(/^\s*\d+\s+"([^"]*)"\s+\*?(?:prg|seq|usr|rel|del)\b/im);
  if (!entryMatch) {
    throw new Error("proof04-subject-dxa.mjs: the corpus image's directory listing has no entries");
  }
  const rawEntryName = entryMatch[1].replace(/\s+$/, "");
  if (rawEntryName.toUpperCase() !== expectedEntryName.toUpperCase()) {
    throw new Error(
      `proof04-subject-dxa.mjs: directory listing's entry "${rawEntryName}" does not match the expected entry "${expectedEntryName}" (case-insensitive) -- refusing`,
    );
  }

  const readResp = await runHostTool({ tool: "c1541.read", args: { ...baseArgs, name: rawEntryName } }, { repoRoot: root });
  if (!readResp.ok) {
    throw new Error(`proof04-subject-dxa.mjs: c1541.read refused: ${readResp.message}`);
  }
  const readPath = readResp.results[0]?.path;
  if (!readPath) {
    throw new Error("proof04-subject-dxa.mjs: c1541.read reported no output file");
  }
  return new Uint8Array(readFileSync(readPath));
}

/** Merges a sorted-ascending array of distinct integer addresses into
 * inclusive `[start, end]` runs. */
function mergeIntoRuns(addressesAscending) {
  const runs = [];
  for (const address of addressesAscending) {
    const last = runs[runs.length - 1];
    if (last && address === last.end + 1) {
      last.end = address;
    } else {
      runs.push({ start: address, end: address });
    }
  }
  return runs;
}

/** Converts `DxaRunResult.map`'s three address sets into `BlockEntry[]` in
 * memory (D-P1) -- no `.annostore` file is created or read anywhere in this
 * script. Asserts the emitted runs neither overlap nor duplicate an address. */
function blocksFromDxaMap(map) {
  const groups = [
    { addresses: [...map.code].sort((a, b) => a - b), type: "code" },
    { addresses: [...map.data].sort((a, b) => a - b), type: "data" },
    { addresses: [...map.unclassified.keys()].sort((a, b) => a - b), type: "undefined" },
  ];

  const blocks = [];
  const seen = new Set();
  for (const { addresses, type } of groups) {
    for (const run of mergeIntoRuns(addresses)) {
      for (let a = run.start; a <= run.end; a++) {
        if (seen.has(a)) {
          throw new Error(`proof04-subject-dxa.mjs: address $${a.toString(16)} appears in more than one dxa classification group`);
        }
        seen.add(a);
      }
      blocks.push({ start_address: run.start, end_address: run.end, type });
    }
  }
  blocks.sort((a, b) => a.start_address - b.start_address);
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].start_address <= blocks[i - 1].end_address) {
      throw new Error(
        `proof04-subject-dxa.mjs: emitted blocks overlap: [${blocks[i - 1].start_address},${blocks[i - 1].end_address}] and [${blocks[i].start_address},${blocks[i].end_address}]`,
      );
    }
  }
  return blocks;
}

function parseArgs(argv) {
  const out = { out: path.join(PROBE_DIR, "subject", "subject-dxa.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out.out = path.resolve(argv[++i]);
    }
  }
  return out;
}

async function main() {
  const { out: outPath } = parseArgs(process.argv.slice(2));

  // --- Step 1: resolve the corpus, assert identity before reading further ---
  const { path: corpusPath, bytes: imageBytes } = resolveCorpusPath();
  const releaseSha256 = sha256Hex(imageBytes);
  if (releaseSha256 !== RELEASE_SHA256_EXPECTED) {
    console.error(
      `SUBJECT_REFUSAL corpus digest mismatch: expected ${RELEASE_SHA256_EXPECTED}, got ${releaseSha256} (${corpusPath})`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`SUBJECT_RELEASE_SHA256 ${releaseSha256}`);

  // --- Step 2: scratch workspace, corpus copied in so the seam root is the
  // scratch tree alone (T-44-05: computed, never a fixed guess) -----------
  mkdirSync(PROBE_DIR, { recursive: true });
  const scratchDir = mkdtempSync(path.join(PROBE_DIR, "subject-"));
  try {
    const corpusCopyPath = path.join(scratchDir, "corpus.d64");
    writeFileSync(corpusCopyPath, imageBytes);
    const outDir = path.join(scratchDir, "out");
    mkdirSync(outDir, { recursive: true });

    const entryBytes = await extractEntryOverSeam(corpusCopyPath, outDir, ENTRY_NAME);
    const entrySha256 = sha256Hex(entryBytes);
    console.log(`SUBJECT_ENTRY_NAME ${ENTRY_NAME}`);
    if (entrySha256 !== ENTRY_SHA256_EXPECTED || entryBytes.length !== ENTRY_BYTES_EXPECTED) {
      console.error(
        `SUBJECT_REFUSAL entry identity mismatch: expected sha256=${ENTRY_SHA256_EXPECTED} bytes=${ENTRY_BYTES_EXPECTED}, ` +
          `got sha256=${entrySha256} bytes=${entryBytes.length}`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(`SUBJECT_ENTRY_SHA256 ${entrySha256}`);
    console.log(`SUBJECT_ENTRY_BYTES ${entryBytes.length}`);

    // A `.prg`'s own first two bytes are its little-endian load address --
    // read directly rather than importing prg-image.ts (keeps this script's
    // import boundary minimal).
    const origin = entryBytes[0] | (entryBytes[1] << 8);
    console.log(`SUBJECT_ORIGIN $${origin.toString(16).padStart(4, "0")}`);

    // --- Step 3: feed dxa through the ONE seam -----------------------------
    writeFileSync(path.join(scratchDir, "release.prg"), entryBytes);
    writeFileSync(path.join(scratchDir, "release.entrypoints"), `${ENTRYPOINT_HEX}\n`);

    let dxaResult;
    try {
      dxaResult = await runDxaDisassemble(
        { image: "release.prg", imageKind: "prg", entrypointsPath: "release.entrypoints" },
        { repoRoot: scratchDir },
      );
    } catch (err) {
      // The seam's own refusal message already names the never-auto-install
      // remedy (`bash vendor/dxa/build.bash build`) when dxa itself is
      // absent -- print it verbatim and refuse, never attempt to build or
      // fetch anything.
      console.error(`SUBJECT_REFUSAL ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }

    console.log(`SUBJECT_DXA_CODE_ADDRESSES ${dxaResult.map.code.size}`);
    console.log(`SUBJECT_DXA_DATA_ADDRESSES ${dxaResult.map.data.size}`);
    console.log(`SUBJECT_DXA_UNCLASSIFIED_ADDRESSES ${dxaResult.map.unclassified.size}`);

    // --- Step 4: BlockEntry[] in memory (D-P1), write artifact -------------
    const blocks = blocksFromDxaMap(dxaResult.map);
    const coveredAddresses = new Set();
    for (const block of blocks) {
      for (let a = block.start_address; a <= block.end_address; a++) coveredAddresses.add(a);
    }

    const artifactBytes = Buffer.from(`${JSON.stringify(blocks, null, 2)}\n`, "utf8");
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, artifactBytes);
    const artifactSha256 = sha256Hex(artifactBytes);

    console.log(`SUBJECT_BLOCK_COUNT ${blocks.length}`);
    console.log(`SUBJECT_COVERED_ADDRESSES ${coveredAddresses.size}`);
    console.log(`SUBJECT_ARTIFACT_SHA256 ${artifactSha256}`);
    console.log(`SUBJECT_ARTIFACT_PATH ${outPath}`);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

await main();
