#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof04-reconcile.mjs -- Phase 44, plan 44-01. The JOIN driver.
//
// WHAT IT IS FOR
// --------------
// Reads the SUBJECT artifact (`BlockEntry[]`, produced by
// `proof04-subject-dxa.mjs`) and the ORACLE artifact (`EvidExecRow[]`-shaped
// observations, produced by `proof04-oracle-memmap.mjs`) by path, and joins
// them through the ONE shipped function, `evid-reconcile.ts`'s
// `reconcileObservedExecution()` -- called exactly once, never re-derived by
// hand. This script never fetches either side itself beyond reading the two
// named JSON files; it never opens a store, a socket or a child process.
//
// THE VERDICT IS DERIVED STRICTLY FROM SCHEMA.md's COMMITTED RULE
// ------------------------------------------------------------------
// `deriveVerdict()` below is the ONE place that rule is encoded in code. It
// is called from both the live `main()` path and `--self-check`'s synthetic
// cases (added by plan 44-01's Task 2), so a self-check case exercises the
// SAME code path a live run does, never a copy of it.
//
// IMPORT BOUNDARY (Criterion 2), CLOSED
// --------------------------------------
// This module dynamic-imports ONLY `evid-reconcile.ts`. It reads two JSON
// artifacts by path and never imports the subject or oracle producer
// scripts, dxa-run.ts, dxa-partition.ts, block-class.ts, probe-harness.mjs,
// text-protocol.ts or textmon-memmap.ts.
// -----------------------------------------------------------------------------
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

const { reconcileObservedExecution } = await import(path.join(MCP_DIR, "evid-reconcile.ts"));

/** Reads and JSON-parses `filePath`, refusing BY NAME (naming the attempted
 * path) if the file is absent or unparseable -- never a silent empty
 * fallback. */
function readArtifact(filePath, what) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`proof04-reconcile.mjs: could not read ${what} artifact at ${filePath}: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`proof04-reconcile.mjs: ${what} artifact at ${filePath} is not valid JSON: ${err.message}`);
  }
}

/**
 * SCHEMA.md section 3 (the derivation rule), encoded exactly once. Never
 * called anywhere but here -- both the live path below and `--self-check`'s
 * synthetic cases call this same function.
 *
 * `oracleDepthReached` and `oracleParseRefusal` are read from the ORACLE
 * artifact's own recorded fields (never re-measured here); `denominator` and
 * `blockAddressesObserved` are read from the join function's own return
 * fields.
 */
export function deriveVerdict({ oracleDepthReached, oracleParseRefusal, denominator, blockAddressesObserved }) {
  if (oracleDepthReached === 0 || oracleParseRefusal !== "none" || denominator === 0) {
    const causes = [];
    if (oracleDepthReached === 0) causes.push("ORACLE_DEPTH_REACHED is 0 -- the emulator never reached the anchor stop");
    if (oracleParseRefusal !== "none") causes.push(`ORACLE_PARSE_REFUSAL is "${oracleParseRefusal}", not "none"`);
    if (denominator === 0) causes.push("PROOF04_DENOMINATOR is 0");
    return { verdict: "not-exercised", cause: causes.join("; ") };
  }
  if (blockAddressesObserved === 0) {
    return { verdict: "unresolved", cause: `0 of ${denominator} block-covered addresses were observed executing` };
  }
  return { verdict: "resolved", cause: null };
}

/**
 * Runs the join exactly once and returns everything a caller (live `main()`
 * or `--self-check`) needs to print. `blocks`/`observations` are already-
 * parsed in-memory arrays; `oracleDepthReached`/`oracleParseRefusal` are the
 * two oracle-recorded fields the verdict rule reads.
 */
function reconcile({ blocks, observations, oracleDepthReached, oracleParseRefusal }) {
  const result = reconcileObservedExecution({ blocks, observations });
  const blockAddressesObserved = result.disagreementCount + result.agreementCount;
  const bucketSum =
    result.disagreementCount + result.agreementCount + result.blockCoveredNeverObservedCount + result.observedAtUndefinedBlockCount;
  const bucketIdentityOk = bucketSum === result.denominator;
  const { verdict, cause } = deriveVerdict({
    oracleDepthReached,
    oracleParseRefusal,
    denominator: result.denominator,
    blockAddressesObserved,
  });
  return { result, blockAddressesObserved, bucketIdentityOk, verdict, cause };
}

/** Prints the `PROOF04_*` outcome lines for one reconciliation. Never forms
 * a percentage anywhere -- every printed value is an integer or a token. */
function renderOutcomeLines({ label, result, blockAddressesObserved, bucketIdentityOk, verdict, cause }) {
  console.log(`PROOF04_LABEL ${label}`);
  console.log(`PROOF04_POSITIVE_CLASS ${result.positiveClass}`);
  console.log(`PROOF04_TIER ${result.tier}`);
  console.log(`PROOF04_FALSE_POSITIVES ${result.disagreementCount}`);
  console.log(`PROOF04_AGREEMENTS ${result.agreementCount}`);
  console.log(`PROOF04_BLOCK_COVERED_NEVER_OBSERVED ${result.blockCoveredNeverObservedCount}`);
  console.log(`PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK ${result.observedOutsideAnyBlockCount}`);
  console.log(`PROOF04_OBSERVED_AT_UNDEFINED_BLOCK ${result.observedAtUndefinedBlockCount}`);
  console.log(`PROOF04_DENOMINATOR ${result.denominator}`);
  console.log(`PROOF04_BLOCK_ADDRESSES_OBSERVED ${blockAddressesObserved}`);
  console.log(`PROOF04_BUCKET_IDENTITY_OK ${bucketIdentityOk}`);
  console.log(`PROOF04_VERDICT ${verdict}`);
  if (cause) console.log(`PROOF04_VERDICT_CAUSE ${cause}`);
  const head = result.disagreements
    .slice(0, 32)
    .map((d) => `$${d.address.toString(16)}`)
    .join(" ");
  console.log(`PROOF04_DISAGREEMENT_HEAD ${head}`);
}

function parseArgs(argv) {
  const out = { subject: null, oracle: null, label: "reconcile", out: null, selfCheck: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--subject" && argv[i + 1]) out.subject = path.resolve(argv[++i]);
    else if (argv[i] === "--oracle" && argv[i + 1]) out.oracle = path.resolve(argv[++i]);
    else if (argv[i] === "--label" && argv[i + 1]) out.label = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out.out = path.resolve(argv[++i]);
    else if (argv[i] === "--self-check") out.selfCheck = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// --self-check: four synthetic cases feeding the join function directly,
// each asserting the derived verdict and printed values against SCHEMA.md's
// committed rule. No case asserts any specific false-positive count against
// REAL data (the measurement has no known-good number) -- every input here
// is a small, hand-constructed literal.
// ---------------------------------------------------------------------------

/** Temporarily redirects `console.log` into an array of lines, restoring it
 * in a `finally` even if `fn` throws. */
function captureLines(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.join(" "));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

/** Runs one self-check case through the SAME `reconcile()`/`renderOutcomeLines()`
 * a live run uses, applies `checkFn` (which throws on failure), and prints
 * exactly one `SELFCHECK_<name> pass|fail` line. Returns whether it passed. */
function runSelfCheckCase(name, input, checkFn) {
  const outcome = reconcile(input);
  const lines = captureLines(() => renderOutcomeLines({ label: name, ...outcome }));
  let ok = true;
  let reason = "";
  try {
    checkFn({ outcome, lines, input });
  } catch (err) {
    ok = false;
    reason = err instanceof Error ? err.message : String(err);
  }
  console.log(`SELFCHECK_${name} ${ok ? "pass" : "fail"}`);
  if (!ok) console.log(`SELFCHECK_${name}_REASON ${reason}`);
  return ok;
}

/** Case: `empty-observations` -- a non-empty block set, zero observations.
 * Success Criterion 3's core failure mode, mechanically closed: the derived
 * verdict must be `unresolved`, never `resolved`, and the never-observed
 * population must equal the whole denominator -- never phrased as a class. */
function checkEmptyObservations() {
  return runSelfCheckCase(
    "empty-observations",
    {
      blocks: [{ start_address: 0x1000, end_address: 0x1005, type: "data" }],
      observations: [],
      oracleDepthReached: 10,
      oracleParseRefusal: "none",
    },
    ({ outcome }) => {
      assert.equal(outcome.blockAddressesObserved, 0, "PROOF04_BLOCK_ADDRESSES_OBSERVED must be 0");
      assert.equal(outcome.verdict, "unresolved", "verdict must be unresolved");
      assert.notEqual(outcome.verdict, "resolved", "verdict must never be resolved on zero observations");
      assert.equal(
        outcome.result.blockCoveredNeverObservedCount,
        outcome.result.denominator,
        "PROOF04_BLOCK_COVERED_NEVER_OBSERVED must equal the denominator",
      );
    },
  );
}

/** Case: `zero-denominator` -- an empty block set, non-empty observations.
 * The verdict must be `not-exercised`, never a percentage anywhere, and the
 * observations must not be silently dropped -- they surface under
 * `PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK`. */
function checkZeroDenominator() {
  return runSelfCheckCase(
    "zero-denominator",
    {
      blocks: [],
      observations: [
        { address: 0x2000, sourceBank: "ram" },
        { address: 0x2001, sourceBank: "rom" },
      ],
      oracleDepthReached: 10,
      oracleParseRefusal: "none",
    },
    ({ outcome, lines }) => {
      assert.equal(outcome.result.denominator, 0, "PROOF04_DENOMINATOR must be 0");
      assert.equal(outcome.verdict, "not-exercised", "verdict must be not-exercised on a zero denominator");
      assert.ok(
        !lines.some((line) => line.includes("%")),
        "no printed line may contain a % character",
      );
      assert.equal(
        outcome.result.observedOutsideAnyBlockCount,
        2,
        "PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK must carry the observation count",
      );
    },
  );
}

/** Case: `single-address` -- one one-address `data` block, one observation
 * at that address. The simplest possible `resolved` case. */
function checkSingleAddress() {
  return runSelfCheckCase(
    "single-address",
    {
      blocks: [{ start_address: 0x3000, end_address: 0x3000, type: "data" }],
      observations: [{ address: 0x3000, sourceBank: "ram" }],
      oracleDepthReached: 10,
      oracleParseRefusal: "none",
    },
    ({ outcome }) => {
      assert.equal(outcome.result.disagreementCount, 1, "PROOF04_FALSE_POSITIVES must be 1");
      assert.equal(outcome.result.denominator, 1, "PROOF04_DENOMINATOR must be 1");
      assert.equal(outcome.verdict, "resolved", "verdict must be resolved");
    },
  );
}

/** Case: `ordering-determinism` -- two adjacent, touching `data` ranges and a
 * deliberately shuffled observation array, including two observations at one
 * address in different source banks. Asserts ascending, de-duplicated
 * output and byte-identical re-runs. */
function checkOrderingDeterminism() {
  const blocks = [
    { start_address: 0x4000, end_address: 0x4002, type: "data" },
    { start_address: 0x4003, end_address: 0x4005, type: "data" },
  ];
  const observations = [
    { address: 0x4005, sourceBank: "io" },
    { address: 0x4000, sourceBank: "rom" },
    { address: 0x4005, sourceBank: "ram" },
    { address: 0x4002, sourceBank: "ram" },
  ];
  const input = { blocks, observations, oracleDepthReached: 10, oracleParseRefusal: "none" };
  return runSelfCheckCase("ordering-determinism", input, ({ outcome, lines }) => {
    const addresses = outcome.result.disagreements.map((d) => d.address);
    assert.deepEqual(
      addresses,
      [...addresses].sort((a, b) => a - b),
      "disagreement addresses must be strictly ascending",
    );
    for (const disagreement of outcome.result.disagreements) {
      assert.deepEqual(
        disagreement.sourceBanks,
        [...new Set(disagreement.sourceBanks)].sort(),
        "each row's sourceBanks must be de-duplicated and ascending",
      );
    }
    assert.equal(outcome.result.denominator, 6, "touching ranges must neither double-count nor merge away an address");

    // Determinism: re-run the SAME case and compare the rendered outcome-line
    // block byte for byte.
    const second = reconcile({
      blocks,
      observations,
      oracleDepthReached: 10,
      oracleParseRefusal: "none",
    });
    const secondLines = captureLines(() => renderOutcomeLines({ label: "ordering-determinism", ...second }));
    assert.deepEqual(lines, secondLines, "re-running the same case must produce a byte-identical outcome-line block");
  });
}

export function selfCheck() {
  const results = [checkEmptyObservations(), checkZeroDenominator(), checkSingleAddress(), checkOrderingDeterminism()];
  const allPass = results.every(Boolean);
  console.log(`SELFCHECK_RESULT ${allPass ? "pass" : "fail"}`);
  return allPass;
}

async function main() {
  const { subject, oracle, label, out, selfCheck: doSelfCheck } = parseArgs(process.argv.slice(2));

  if (doSelfCheck) {
    const ok = selfCheck();
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (!subject || !oracle) {
    console.error("usage: node proof04-reconcile.mjs --subject PATH --oracle PATH [--label L] [--out PATH] | --self-check");
    process.exitCode = 1;
    return;
  }

  const blocks = readArtifact(subject, "subject");
  const oracleArtifact = readArtifact(oracle, "oracle");
  const observations = oracleArtifact.observations ?? [];
  const oracleDepthReached = oracleArtifact.depthReached ?? 0;
  const oracleParseRefusal = oracleArtifact.parseRefusal ?? "none";

  const { result, blockAddressesObserved, bucketIdentityOk, verdict, cause } = reconcile({
    blocks,
    observations,
    oracleDepthReached,
    oracleParseRefusal,
  });

  renderOutcomeLines({ label, result, blockAddressesObserved, bucketIdentityOk, verdict, cause });

  if (out) {
    const payload = { label, ...result, blockAddressesObserved, bucketIdentityOk, verdict, cause };
    const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, bytes);
    console.log(`PROOF04_ARTIFACT_SHA256 ${createHash("sha256").update(bytes).digest("hex")}`);
    console.log(`PROOF04_ARTIFACT_PATH ${out}`);
  }
}

await main();
