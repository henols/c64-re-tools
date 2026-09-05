#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof03-bank-boundary.mjs -- plan 38-02's named, repeatable PROOF-03 driver.
//
// WHAT IT IS FOR
// --------------
// PROOF-03 needs the point where a single forward-carried `$01` value stops
// being correct established BY OBSERVATION, in both directions, against the
// committed fixture that banks ROM in and out (`bank-path-dependent.a` /
// `.prg`, and its real committed Ghidra export). Phase 37's `37-06` measured
// this substance already, badged `AUTO-04`/`AUTO-05`, never `PROOF-03`. D-04
// settles that this phase RE-RUNS the measurement under its own evidence
// conventions rather than citing Phase 37 by reference -- this script is that
// re-run, so `evidence/proof03-bank-boundary.md`'s claim is reproducible by
// re-running a committed script, not by recalling a session, and is
// verifiable from this phase's own evidence directory alone.
//
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// -------------------------------------------------------
// Everything below that could have been re-authored is imported and invoked
// instead, because a second copy of any of it would make this measurement a
// measurement of the copy:
//
//   * the bit decode / region resolution -> `anno-bank.ts`'s
//     `decodeBankState()`, `resolveBankedRegion()`, `isBankConditionalAddress()`
//   * the reaching-values join / decline rule -> `anno-join.ts`'s
//     `runMemmapJoin()`
//   * the export parse -> `anno-import.ts`'s `parseGhidraExport()` /
//     `parseConstWrites()`, over the committed real export text -- the export
//     is never hand-parsed
//   * the store -> `anno-store.ts`'s `openStore()` / `putXref()` /
//     `closeStore()`
//   * the memory map -> `memmap-lookup.ts`'s `loadMemmap()`
//
// This file writes NO `$01` bit arithmetic of its own (masks, shifts, bit
// tests) -- every decode goes through `decodeBankState()`.
//
// WHY THE REAL EXPORT'S OWN `REFERENCES` SECTION IS NOT ENOUGH
// --------------------------------------------------------------
// The real captured export's `## REFERENCES` section only records
// `$0815 -> $0001 WRITE`, `$081c -> $0001 WRITE`, two unconditional CALLs to
// the shared `probe` subroutine at `$0825`, and one more write -- it never
// records an edge INTO `$D020` at all, because `probe`'s own internal
// `sta $d020` is not a call target the exporter's reference walk sees (the
// `.prg`-route capture's own internal-`jsr` limitation, already recorded
// against this same fixture in Phase 37's `37-06` transcripts). Reachability
// to the shared address is therefore authored directly via `putXref()`,
// mirroring `anno-bank.test.ts`'s own committed pattern for this exact
// fixture -- never a private re-implementation of xref discovery.
//
// NO CHILD PROCESS, ANYWHERE IN THIS FILE
// ----------------------------------------
// This script never imports Node's child-process module (T-38-01's own mitigation:
// SEAM-05's host-tool gate is neither narrowed nor disabled, because this
// script reaches no host binary at all). The mutated-module observation
// (`direction2`) is done entirely by WRITING a scratch tree and dynamically
// `import()`-ing from it IN-PROCESS -- exactly as `37-06` and
// `anno-bank.test.ts`'s own two planted-violation cases already do. One
// consequence: `git status --porcelain` cannot be shelled out to from here.
// The cleanliness claim is instead observed as a BYTE-IDENTITY check
// (`sha256` of `anno-join.ts` / `anno-bank.ts`, before vs. after the scratch
// work) -- strictly stronger than `git status --porcelain` (which reports
// only tracked changes, not byte-for-byte identity) and satisfies the same
// "observed, not merely asserted" requirement without a subprocess. The
// PLAN's own literal `git status --porcelain` transcript lines are appended
// separately, by the executor, when building `proof03-bank-boundary.md`.
//
// SCRATCH TREE, NEVER `/tmp`
// ---------------------------
// Every scratch directory (the mutated-module tree, and every ephemeral
// `.annostore` this driver opens) is built via `mkdtempSync` under
// `PROBE_DIR=$HOME/.cache/c64-re-tools/phase38`, never inside the checkout
// and never under `/tmp` (RAM-backed tmpfs on this host, emptied only on
// reboot, per `README.md`'s own convention 2), and torn down in a `finally`.
//
// DETERMINISM
// ------------
// No subcommand prints a timestamp, a random scratch-directory name, or
// anything else that varies run to run over unchanged inputs -- two runs of
// the same subcommand produce byte-identical stdout.
//
// SUBCOMMANDS
// ------------
//   direction1  -- the two-bank-states observation: does the SAME shared
//                  address annotate differently under the two recovered
//                  `$01` values?
//   direction2  -- the forward-carry observation: committed (declines) vs. a
//                  scratch-mutated forward-carry (annotates, confidently and
//                  wrongly).
//   branches    -- the four `constWrites` shapes this phase adds beyond
//                  `37-06`: absent, empty, agreeing-values, disagreeing-values.
// -----------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const FIXTURE_DIR = path.join(MCP_DIR, "fixtures", "ghidra");
const FIXTURE_A_PATH = path.join(FIXTURE_DIR, "bank-path-dependent.a");
const FIXTURE_PRG_PATH = path.join(FIXTURE_DIR, "bank-path-dependent.prg");
const EXPORT_PATH = path.join(FIXTURE_DIR, "export-bank-path-dependent.txt");

const ANNO_BANK_PATH = path.join(MCP_DIR, "anno-bank.ts");
const ANNO_JOIN_PATH = path.join(MCP_DIR, "anno-join.ts");
const ANNO_STORE_PATH = path.join(MCP_DIR, "anno-store.ts");
const MEMMAP_LOOKUP_PATH = path.join(MCP_DIR, "memmap-lookup.ts");
const ANNO_GRAPHICS_PATH = path.join(MCP_DIR, "anno-graphics.ts");

/** Never inside the checkout, never `/tmp` (tmpfs on this host, emptied only
 * on reboot). */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase38");

/** MEASURED at plan time (`sha256sum` over the committed files) -- a drift
 * detector, never a security boundary. A mismatch refuses before anything
 * else is read. */
const EXPECTED_PRG_SHA256 = "5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078";
const EXPECTED_EXPORT_SHA256 = "d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882";

/** The shared program point both directions and the branch sweep exercise:
 * `probe`'s own `sta $d020` in `bank-path-dependent.a`, reached TWICE from two
 * different callers under two different `$01` values (`$34` at `$0815`,
 * `$33` at `$081c`). One address, two callers, two determinate bank states --
 * exactly the fixture this file exists to drive. */
const SHARED_ADDRESS = 0xd020;

// --- shipped seams (dynamic `import()` over `.ts`, Node's own type-stripping,
// exactly as `proof01-dxa-real-release.mjs` already does) -------------------
const { openStore, putXref, closeStore } = await import(ANNO_STORE_PATH);
const { parseGhidraExport, parseConstWrites } = await import(path.join(MCP_DIR, "anno-import.ts"));
const { runMemmapJoin } = await import(ANNO_JOIN_PATH);
const { loadMemmap } = await import(MEMMAP_LOOKUP_PATH);
const { decodeBankState, isBankConditionalAddress, resolveBankedRegion } = await import(ANNO_BANK_PATH);

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Asserts and prints the two fixture digests BEFORE any other measurement
 * line -- every subcommand's very first act. */
function printFixtureDigests() {
  const prgBytes = readFileSync(FIXTURE_PRG_PATH);
  const exportText = readFileSync(EXPORT_PATH, "utf8");
  const prgSha = sha256Hex(prgBytes);
  const exportSha = sha256Hex(Buffer.from(exportText, "utf8"));

  if (prgSha !== EXPECTED_PRG_SHA256) {
    throw new Error(
      `proof03-bank-boundary: ${FIXTURE_PRG_PATH} digests to ${prgSha}, expected ${EXPECTED_PRG_SHA256} -- refusing to proceed`,
    );
  }
  if (exportSha !== EXPECTED_EXPORT_SHA256) {
    throw new Error(
      `proof03-bank-boundary: ${EXPORT_PATH} digests to ${exportSha}, expected ${EXPECTED_EXPORT_SHA256} -- refusing to proceed`,
    );
  }

  console.log(`PROOF03_FIXTURE: ${path.relative(REPO_ROOT, FIXTURE_A_PATH)}`);
  console.log(`PROOF03_FIXTURE_PRG_SHA256: ${prgSha}`);
  console.log(`PROOF03_EXPORT_SHA256: ${exportSha}`);
}

/** Parses the committed real export via the shipped importer, never by hand.
 * Refuses if the real capture no longer carries at least two facts -- the
 * whole measurement depends on it carrying (at least) the `$34`/`$33` pair. */
function realConstWrites() {
  const text = readFileSync(EXPORT_PATH, "utf8");
  const doc = parseGhidraExport(text);
  const facts = parseConstWrites(doc);
  if (facts.length < 2) {
    throw new Error(
      "proof03-bank-boundary: expected the real captured export to carry at least two const-write facts -- has the fixture drifted?",
    );
  }
  return facts;
}

/** Every ephemeral `.annostore` this driver opens lives under `PROBE_DIR`,
 * never `/tmp`, torn down in a `finally`. Nothing this function prints is
 * ever included in a subcommand's stdout (the directory name is random per
 * run) -- keeping every subcommand's own output deterministic. */
function withTempStore(fn) {
  mkdirSync(PROBE_DIR, { recursive: true });
  const dir = mkdtempSync(path.join(PROBE_DIR, "proof03-store-"));
  try {
    const handle = openStore(path.join(dir, "proj.annostore"), { workspaceRoot: dir });
    try {
      return fn(handle);
    } finally {
      closeStore(handle);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Wires ONE const-write fact's own store address to reach `SHARED_ADDRESS`
 * via `putXref()` (the real export's own `REFERENCES` section cannot prove
 * this edge -- see the header), runs the committed `runMemmapJoin()`, and
 * returns the resulting label at `SHARED_ADDRESS`, if any. */
function labelForSingleValueRun(storeAddress, facts, entries) {
  return withTempStore((handle) => {
    putXref(handle, { fromAddress: storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts },
      entries,
    );
    return decisions.find((d) => d.address === SHARED_ADDRESS)?.label;
  });
}

// -----------------------------------------------------------------------------
// direction1 -- the two-bank-states observation.
// -----------------------------------------------------------------------------
async function direction1() {
  printFixtureDigests();

  const facts = realConstWrites();
  const flip34 = facts.find((f) => f.value === 0x34);
  const flip33 = facts.find((f) => f.value === 0x33);
  if (!flip34 || !flip33) {
    throw new Error(
      "proof03-bank-boundary: expected the real captured export to carry both the $34 and $33 const-write facts -- has the fixture drifted?",
    );
  }

  console.log("CONST_WRITES (sorted ascending by storeAddress):");
  for (const f of [...facts].sort((a, b) => a.storeAddress - b.storeAddress)) {
    console.log(
      `  storeAddress=$${f.storeAddress.toString(16)} targetAddress=$${f.targetAddress.toString(16)} value=$${f.value.toString(16)}`,
    );
  }

  const decoded34 = decodeBankState(0x34);
  const decoded33 = decodeBankState(0x33);
  console.log(
    `DECODE_BANK_STATE_0x34: raw=$${decoded34.raw.toString(16)} ioRange=${decoded34.ioRange} basicRange=${decoded34.basicRange} kernalRange=${decoded34.kernalRange}`,
  );
  console.log(
    `DECODE_BANK_STATE_0x33: raw=$${decoded33.raw.toString(16)} ioRange=${decoded33.ioRange} basicRange=${decoded33.basicRange} kernalRange=${decoded33.kernalRange}`,
  );

  console.log(
    `IS_BANK_CONDITIONAL_ADDRESS($${SHARED_ADDRESS.toString(16)}): ${isBankConditionalAddress(SHARED_ADDRESS)}`,
  );
  console.log(`RESOLVE_BANKED_REGION_UNDER_0x34: ${resolveBankedRegion(SHARED_ADDRESS, decoded34)}`);
  console.log(`RESOLVE_BANKED_REGION_UNDER_0x33: ${resolveBankedRegion(SHARED_ADDRESS, decoded33)}`);

  const entries = loadMemmap();
  const label34 = labelForSingleValueRun(flip34.storeAddress, facts, entries);
  const label33 = labelForSingleValueRun(flip33.storeAddress, facts, entries);

  console.log(`DIRECTION1_LABEL_UNDER_0x34: ${label34 ?? "(undecided)"}`);
  console.log(`DIRECTION1_LABEL_UNDER_0x33: ${label33 ?? "(undecided)"}`);

  let verdict;
  if (label34 === undefined || label33 === undefined) verdict = "not-found";
  else verdict = label34 === label33 ? "identical" : "differ";

  console.log(`PROOF03_TWO_BANK_STATES: ${verdict}`);
}

// -----------------------------------------------------------------------------
// direction2 -- the forward-carry observation: committed (declines) vs. a
// scratch-mutated forward-carry (annotates, confidently and wrongly).
// -----------------------------------------------------------------------------

/** The decline branch's committed text (the "several values resolving to
 * different regions" case) -- copied character-for-character from
 * `anno-join.ts` at plan time, the SAME text `anno-bank.test.ts`'s own
 * planted-violation case replaces. */
const FIXED_DECLINE_BLOCK = [
  "      if (uniqueRegions.size > 1) {",
  "        declined += 1;",
  '        const named = uniqueValues.map((value, i) => `$${value.toString(16)}(${regionsByValue[i]})`).join(", ");',
  "        decisions.push({",
  "          address,",
  '          outcome: "declined",',
  '          reason: `$${address.toString(16)} is reached under disagreeing processor-port values: ${named}`,',
  "        });",
  "        continue;",
  "      }",
].join("\n");

/** The forward-carry replacement: takes the FIRST (ascending) reaching value
 * and annotates with its own region, exactly as an implementation that
 * carried a single bank value forward past a disagreement would. */
const FORWARD_CARRIED_DECLINE_BLOCK = [
  "      if (uniqueRegions.size > 1) {",
  '        const region = regionsByValue[0]! as Exclude<BankedRegion, "not_applicable">;',
  '        annotateUnderRegion(region, `$${uniqueValues[0]!.toString(16)}`);',
  "        continue;",
  "      }",
].join("\n");

async function direction2() {
  printFixtureDigests();

  const facts = realConstWrites();
  const flip34 = facts.find((f) => f.value === 0x34);
  const flip33 = facts.find((f) => f.value === 0x33);
  if (!flip34 || !flip33) {
    throw new Error(
      "proof03-bank-boundary: expected the real captured export to carry both the $34 and $33 const-write facts -- has the fixture drifted?",
    );
  }
  const entries = loadMemmap();

  // ---- THE COMMITTED MODULE (statically imported, unmutated): both facts
  // wired to reach the SAME address -- the disagreeing-values case. ----
  const committed = withTempStore((handle) => {
    putXref(handle, { fromAddress: flip34.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: flip33.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts },
      entries,
    );
    return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
  });
  console.log(`DIRECTION2_COMMITTED_OUTCOME: ${committed.decision?.outcome ?? "(none)"}`);
  if (committed.decision?.reason) console.log(`DIRECTION2_COMMITTED_REASON: ${committed.decision.reason}`);
  if (committed.decision?.label) console.log(`DIRECTION2_COMMITTED_LABEL: ${committed.decision.label}`);
  console.log(`DIRECTION2_COMMITTED_DECLINED_COUNT: ${committed.declined}`);

  // ---- Cleanliness check, BEFORE: this driver imports no child-process
  // module, so `git status --porcelain` cannot be shelled out to from here.
  // A byte-identity check over both protected files is the
  // in-process equivalent (see header). ----
  const joinBefore = readFileSync(ANNO_JOIN_PATH, "utf8");
  const bankBefore = readFileSync(ANNO_BANK_PATH, "utf8");
  const joinBeforeSha = sha256Hex(Buffer.from(joinBefore, "utf8"));
  const bankBeforeSha = sha256Hex(Buffer.from(bankBefore, "utf8"));
  console.log(`ANNO_JOIN_TS_SHA256_BEFORE: ${joinBeforeSha}`);
  console.log(`ANNO_BANK_TS_SHA256_BEFORE: ${bankBeforeSha}`);

  if (!joinBefore.includes(FIXED_DECLINE_BLOCK)) {
    throw new Error(
      "proof03-bank-boundary: expected the committed anno-join.ts to still carry the decline branch's committed text -- has the source drifted?",
    );
  }
  // A FUNCTION replacer, deliberately -- not a plain string. `String.replace()`
  // treats `$$` in a STRING replacement as a special pattern collapsing to a
  // single literal `$` (MDN's `$$` substitution rule), and
  // `FORWARD_CARRIED_DECLINE_BLOCK` itself legitimately contains `` `$${...}` ``
  // (a literal `$` immediately followed by a template interpolation) --
  // exactly the sequence that rule silently eats. A function replacer's
  // return value is inserted verbatim, with no `$`-pattern substitution at
  // all, so the mutated source keeps its own literal `$` intact.
  const mutatedJoinSource = joinBefore.replace(FIXED_DECLINE_BLOCK, () => FORWARD_CARRIED_DECLINE_BLOCK);
  if (mutatedJoinSource.includes(FIXED_DECLINE_BLOCK)) {
    throw new Error("proof03-bank-boundary: expected the committed decline text to be gone from the mutated source");
  }

  // ---- THE SCRATCH TREE: the mutated anno-join.ts, plus re-export shims for
  // its siblings forwarding to the REAL, unmutated files -- none of them need
  // mutating for this control, only resolving. Built under PROBE_DIR, never
  // `/tmp`, torn down in a `finally`. ----
  mkdirSync(PROBE_DIR, { recursive: true });
  const scratchDir = mkdtempSync(path.join(PROBE_DIR, "proof03-direction2-"));
  let mutated;
  try {
    writeFileSync(path.join(scratchDir, "anno-join.ts"), mutatedJoinSource, "utf8");
    writeFileSync(path.join(scratchDir, "anno-bank.ts"), `export * from ${JSON.stringify(ANNO_BANK_PATH)};\n`, "utf8");
    writeFileSync(path.join(scratchDir, "anno-store.ts"), `export * from ${JSON.stringify(ANNO_STORE_PATH)};\n`, "utf8");
    writeFileSync(
      path.join(scratchDir, "memmap-lookup.ts"),
      `export * from ${JSON.stringify(MEMMAP_LOOKUP_PATH)};\n`,
      "utf8",
    );
    writeFileSync(
      path.join(scratchDir, "anno-graphics.ts"),
      `export * from ${JSON.stringify(ANNO_GRAPHICS_PATH)};\n`,
      "utf8",
    );

    const modulePath = path.join(scratchDir, "anno-join.ts");
    // Cache-busting query, never printed -- keeps this subcommand's own
    // stdout deterministic across runs.
    const mutatedModule = await import(`${modulePath}?scratch=${Date.now()}-${Math.random()}`);

    mutated = withTempStore((handle) => {
      putXref(handle, { fromAddress: flip34.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
      putXref(handle, { fromAddress: flip33.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
      const { counts, decisions } = mutatedModule.runMemmapJoin(
        handle,
        { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts },
        entries,
      );
      return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
    });
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }

  console.log(`DIRECTION2_MUTATED_OUTCOME: ${mutated.decision?.outcome ?? "(none)"}`);
  if (mutated.decision?.reason) console.log(`DIRECTION2_MUTATED_REASON: ${mutated.decision.reason}`);
  if (mutated.decision?.label) console.log(`DIRECTION2_MUTATED_LABEL: ${mutated.decision.label}`);
  console.log(`DIRECTION2_MUTATED_DECLINED_COUNT: ${mutated.declined}`);

  // ---- Cleanliness check, AFTER: the scratch tree is already torn down;
  // re-hash the REAL files and compare. ----
  const joinAfter = readFileSync(ANNO_JOIN_PATH, "utf8");
  const bankAfter = readFileSync(ANNO_BANK_PATH, "utf8");
  const joinAfterSha = sha256Hex(Buffer.from(joinAfter, "utf8"));
  const bankAfterSha = sha256Hex(Buffer.from(bankAfter, "utf8"));
  console.log(`ANNO_JOIN_TS_SHA256_AFTER: ${joinAfterSha}`);
  console.log(`ANNO_BANK_TS_SHA256_AFTER: ${bankAfterSha}`);
  const unchanged = joinBeforeSha === joinAfterSha && bankBeforeSha === bankAfterSha;
  console.log(`ANNO_JOIN_AND_ANNO_BANK_UNCHANGED: ${unchanged ? "yes" : "no"}`);
  if (!unchanged) {
    throw new Error(
      "proof03-bank-boundary: the committed anno-join.ts/anno-bank.ts changed during this run -- the mutation must have leaked outside the scratch tree.",
    );
  }

  if (committed.decision?.outcome === "declined" && mutated.decision?.outcome === "annotated") {
    console.log(`PROOF03_FORWARD_CARRY_WRONG_AT: $${SHARED_ADDRESS.toString(16)}`);
  } else {
    console.log(
      `PROOF03_FORWARD_CARRY_WRONG_AT: none-observed (committed=${committed.decision?.outcome}, mutated=${mutated.decision?.outcome})`,
    );
  }
}

// -----------------------------------------------------------------------------
// branches -- the four `constWrites` shapes: absent, empty, agreeing-values,
// disagreeing-values. `37-06` covered only the disagreeing case; this
// subcommand is what Phase 38 adds.
// -----------------------------------------------------------------------------
async function branches() {
  printFixtureDigests();

  const facts = realConstWrites();
  const flip34 = facts.find((f) => f.value === 0x34);
  const flip33 = facts.find((f) => f.value === 0x33);
  if (!flip34 || !flip33) {
    throw new Error(
      "proof03-bank-boundary: expected the real captured export to carry both the $34 and $33 const-write facts -- has the fixture drifted?",
    );
  }
  const entries = loadMemmap();

  // (a) ABSENT: `constWrites` omitted entirely (`undefined`) -- the bank-state
  // machinery is a complete no-op, so the address resolves through the
  // ORDINARY unconstrained path.
  const absent = withTempStore((handle) => {
    putXref(handle, { fromAddress: flip34.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30 }, entries);
    return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
  });
  console.log(`PROOF03_CONSTWRITES_ABSENT_BRANCH: ${absent.decision?.outcome ?? "(none)"}`);
  if (absent.decision?.reason) console.log(`  reason: ${absent.decision.reason}`);
  if (absent.decision?.label) console.log(`  label: ${absent.decision.label}`);

  // (b) EMPTY: `constWrites: []` -- activated with zero facts, so no recovered
  // value can reach the address; it must decline, never default.
  const empty = withTempStore((handle) => {
    putXref(handle, { fromAddress: flip34.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: [] },
      entries,
    );
    return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
  });
  console.log(`PROOF03_CONSTWRITES_EMPTY_BRANCH: ${empty.decision?.outcome ?? "(none)"}`);
  if (empty.decision?.reason) console.log(`  reason: ${empty.decision.reason}`);

  // (c) AGREEING VALUES: two DISTINCT facts carrying the SAME `$01` value,
  // both wired to reach the address. The real capture has only one fact per
  // distinct value, so this case uses synthetic store addresses -- the SAME
  // shape `anno-bank.test.ts`'s own committed "agreeing" case uses -- while
  // still driving the real, shipped `runMemmapJoin()`.
  const agreeingFacts = [
    { storeAddress: 0x1000, targetAddress: 0x0001, value: 0x34 },
    { storeAddress: 0x2000, targetAddress: 0x0001, value: 0x34 },
  ];
  const agreeing = withTempStore((handle) => {
    putXref(handle, { fromAddress: 0x1000, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: 0x2000, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: agreeingFacts },
      entries,
    );
    return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
  });
  console.log(`PROOF03_AGREEING_VALUES_BRANCH: ${agreeing.decision?.outcome ?? "(none)"}`);
  if (agreeing.decision?.reason) console.log(`  reason: ${agreeing.decision.reason}`);
  if (agreeing.decision?.label) console.log(`  label: ${agreeing.decision.label}`);

  // (d) DISAGREEING VALUES: the real captured export's own two facts ($34,
  // $33), both wired to reach the SAME address.
  const disagreeing = withTempStore((handle) => {
    putXref(handle, { fromAddress: flip34.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: flip33.storeAddress, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts },
      entries,
    );
    return { decision: decisions.find((d) => d.address === SHARED_ADDRESS), declined: counts.declined };
  });
  console.log(`PROOF03_DISAGREEING_VALUES_BRANCH: ${disagreeing.decision?.outcome ?? "(none)"}`);
  if (disagreeing.decision?.reason) console.log(`  reason: ${disagreeing.decision.reason}`);

  // ---- ORDERING: decisions[] is address-ascending regardless of insertion
  // order (proven here by inserting DESCENDING), and a decline reason names
  // disagreeing values in ascending numeric order (already visible in the
  // disagreeing-branch reason line above, printed again here by name). ----
  const orderingAddresses = withTempStore((handle) => {
    // Inserted in DESCENDING address order on purpose.
    putXref(handle, { fromAddress: 0x3000, toAddress: 0xd030, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: 0x3000, toAddress: SHARED_ADDRESS, accessKind: "COMPUTED_JUMP" });
    const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30 }, entries);
    return decisions.map((d) => d.address);
  });
  console.log(
    `ORDERING_DECISIONS_ADDRESSES (inserted $d030 then $d020): ${orderingAddresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
  );
  const isAscending = orderingAddresses.every((a, i) => i === 0 || orderingAddresses[i - 1] <= a);
  console.log(`ORDERING_DECISIONS_ASCENDING: ${isAscending ? "yes" : "no"}`);
  console.log(
    `ORDERING_DECLINE_REASON_VALUES_ASCENDING: ${disagreeing.decision?.reason ?? "(none)"}`,
  );

  console.log(
    `PROOF03_ORDERING: decisions[] is address-ascending regardless of insertion order (${isAscending ? "confirmed" : "NOT confirmed"} above); a decline reason lists disagreeing values in ascending numeric order (see ORDERING_DECLINE_REASON_VALUES_ASCENDING above)`,
  );
}

// -----------------------------------------------------------------------------
// CLI dispatch.
// -----------------------------------------------------------------------------
const SUBCOMMANDS = { direction1, direction2, branches };

async function main(argv) {
  const cmd = argv[2];
  const fn = SUBCOMMANDS[cmd];
  if (!fn) {
    console.error(`usage: node proof03-bank-boundary.mjs <${Object.keys(SUBCOMMANDS).join("|")}>`);
    process.exitCode = 1;
    return;
  }
  await fn();
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main(process.argv);
}

export { branches, direction1, direction2 };
