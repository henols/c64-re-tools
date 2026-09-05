#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof01-dxa-real-release.mjs -- plan 38-01's named, repeatable PROOF-01
// driver.
//
// WHAT IT IS FOR
// --------------
// PROOF-01 needs dxa's data-recovery rate and false-positive count measured on
// a real cracked release, reported as numbers against a named binary, beside
// the fixture figures. This script takes that measurement end to end, so the
// number in `evidence/proof01-dxa-real-release.md` is reproducible by
// re-running a committed script rather than by recalling a session.
//
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// -------------------------------------------------------
// Everything below that could have been re-authored is imported and invoked
// instead, because a second copy of any of it would make this measurement a
// measurement of the copy:
//
//   * corpus directory read  -> `anno-d64.ts`'s `listEntries()`/`extractEntry()`
//   * the dxa invocation     -> `dxa-run.ts`'s `runDxaDisassemble()`, which
//                                reaches dxa ONLY through the Phase 34
//                                host-tool seam and never a direct spawn
//   * byte-derived ground truth -> `dxa-partition.ts`'s `partitionByteDerived()`
//   * the join and the report   -> `dxa-proof01-compare.ts`'s
//                                `compareByteDerivedRecovery()` /
//                                `renderProof01Report()`
//
// This script never calls a child process itself: the ONE process this
// measurement ever spawns is dxa itself, and that spawn belongs entirely to
// `runDxaDisassemble()`'s own host-tool seam (T-38-01).
//
// CORPUS IDENTITY: NAME PLUS SHA256, ASSERTED BEFORE ANY BYTE IS READ FOR ANY
// OTHER PURPOSE (T-38-02, mirrors `capture-pair.mjs`'s own convention).
//
// SCRATCH WORKSPACE: `mkdtempSync` under `PROBE_DIR`, OUTSIDE the checkout,
// torn down in a `finally` (RESEARCH.md Pitfall 2 / `D-36-12`'s convention).
// -----------------------------------------------------------------------------
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// --- shipped seams -----------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

const { listEntries, extractEntry } = await import(path.join(MCP_DIR, "anno-d64.ts"));
const { runDxaDisassemble } = await import(path.join(MCP_DIR, "dxa-run.ts"));
const { partitionByteDerived } = await import(path.join(MCP_DIR, "dxa-partition.ts"));
const { compareByteDerivedRecovery, renderProof01Report } = await import(
  path.join(MCP_DIR, "dxa-proof01-compare.ts")
);

// --- fixed inputs ------------------------------------------------------------

const RELEASE_ID = "danish";
const ENTRY_NAME = "BRUCE LEE   (DC)";
const RELEASE_SHA256_EXPECTED = "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5";
const ENTRY_SHA256_EXPECTED = "331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4";
/** The extracted `.prg`'s own `10 SYS2073` BASIC line's `SYS` target,
 * established by Phase 35 -- never re-derived here. */
const ENTRYPOINT_HEX = "0819";

/** Never inside the checkout, never `/tmp` (tmpfs on this host, emptied only
 * on reboot). */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase38");

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** README.md's corpus-resolution convention (5): `$C64_CORPUS_DIR` if set,
 * else the repo-relative Phase 23 corpus path. Fails loudly, naming BOTH
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
      `proof01-dxa-real-release.mjs: danish.d64 not found at either attempted path: ${attempted.join(", ")} -- ` +
        "the corpus is gitignored, operator-supplied material, absent from a fresh clone and from a git worktree. " +
        "Set $C64_CORPUS_DIR or place the file at the repo-relative Phase 23 corpus path.",
    );
  }
}

async function main() {
  // --- Step 1: resolve the corpus, assert identity before reading further ---
  const { path: corpusPath, bytes: imageBytes } = resolveCorpusPath();
  const imageSha256 = sha256Hex(imageBytes);
  if (imageSha256 !== RELEASE_SHA256_EXPECTED) {
    throw new Error(
      `proof01-dxa-real-release.mjs: ${corpusPath} digests to ${imageSha256}, expected ${RELEASE_SHA256_EXPECTED} -- refusing to proceed`,
    );
  }
  console.log(`$ sha256sum ${corpusPath}`);
  console.log(`${imageSha256}  ${corpusPath}`);

  // --- Step 2: list + extract the named entry, assert its identity too -----
  const entries = listEntries(new Uint8Array(imageBytes));
  console.log(`$ listEntries(${corpusPath})`);
  console.log(JSON.stringify(entries));

  const entryBytes = extractEntry(new Uint8Array(imageBytes), ENTRY_NAME);
  const entrySha256 = sha256Hex(entryBytes);
  if (entrySha256 !== ENTRY_SHA256_EXPECTED) {
    throw new Error(
      `proof01-dxa-real-release.mjs: extracted entry "${ENTRY_NAME}" digests to ${entrySha256}, expected ${ENTRY_SHA256_EXPECTED} -- refusing to proceed`,
    );
  }
  console.log(`$ extractEntry(${corpusPath}, "${ENTRY_NAME}")`);
  console.log(`sha256=${entrySha256} bytes=${entryBytes.length}`);

  // --- Step 3: scratch workspace, dxa through the shipped host-tool seam ---
  mkdirSync(PROBE_DIR, { recursive: true });
  const scratchDir = mkdtempSync(path.join(PROBE_DIR, "proof01-"));
  let dxaResult;
  try {
    const prgRelPath = "bl.prg";
    const entrypointsRelPath = "bl.entrypoints";
    writeFileSync(path.join(scratchDir, prgRelPath), entryBytes);
    writeFileSync(path.join(scratchDir, entrypointsRelPath), `${ENTRYPOINT_HEX}\n`);

    console.log(`$ runDxaDisassemble({ image: "${prgRelPath}", imageKind: "prg", entrypointsPath: "${entrypointsRelPath}" }, { repoRoot: "${scratchDir}" })`);
    dxaResult = await runDxaDisassemble(
      { image: prgRelPath, imageKind: "prg", entrypointsPath: entrypointsRelPath },
      { repoRoot: scratchDir },
    );
    console.log(
      `runDxaDisassemble: code=${dxaResult.map.code.size} data=${dxaResult.map.data.size} ` +
        `unclassified=${dxaResult.map.unclassified.size} covered=${dxaResult.map.covered.size}`,
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }

  // --- Step 4: independent byte-derived ground truth, over the SAME bytes --
  const groundTruth = partitionByteDerived({ bytes: new Uint8Array(entryBytes), isPrg: true });
  console.log(
    `$ partitionByteDerived({ bytes: <extracted ${ENTRY_NAME} .prg>, isPrg: true })`,
  );
  console.log(
    `partitionByteDerived: certainData=${groundTruth.certainData.size} certainCode=${groundTruth.certainCode.size} ` +
      `unknown=${groundTruth.unknown.size} stubOutcome="${groundTruth.stubOutcome}"`,
  );

  // --- Step 5: the join, and the outcome-line block -------------------------
  const comparison = compareByteDerivedRecovery({ listing: dxaResult.map, groundTruth });
  const report = renderProof01Report(comparison, {
    dxaCodeAddresses: dxaResult.map.code.size,
    dxaDataAddresses: dxaResult.map.data.size,
  });
  console.log("$ renderProof01Report(compareByteDerivedRecovery({ listing, groundTruth }), meta)");
  console.log(report);

  return {
    releaseId: RELEASE_ID,
    releaseSha256: imageSha256,
    entryName: ENTRY_NAME,
    entrySha256,
    entryBytes: entryBytes.length,
    report,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main();
}

export { main };
