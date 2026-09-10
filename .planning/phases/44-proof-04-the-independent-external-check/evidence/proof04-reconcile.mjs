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
  const out = { subject: null, oracle: null, label: "reconcile", out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--subject" && argv[i + 1]) out.subject = path.resolve(argv[++i]);
    else if (argv[i] === "--oracle" && argv[i + 1]) out.oracle = path.resolve(argv[++i]);
    else if (argv[i] === "--label" && argv[i + 1]) out.label = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out.out = path.resolve(argv[++i]);
  }
  return out;
}

async function main() {
  const { subject, oracle, label, out } = parseArgs(process.argv.slice(2));

  if (!subject || !oracle) {
    console.error("usage: node proof04-reconcile.mjs --subject PATH --oracle PATH [--label L] [--out PATH]");
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
