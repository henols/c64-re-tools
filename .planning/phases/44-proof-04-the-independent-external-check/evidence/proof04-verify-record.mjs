#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof04-verify-record.mjs -- Phase 44, plan 44-03.
//
// WHAT IT IS FOR
// --------------
// A committed consistency gate for `proof04-false-positives.md`. It needs no
// emulator, no uncommitted artifact and no network. It reads the two run
// transcripts (`proof04-run-a-hit50.md`, `proof04-run-b-narrowed.md`) and the
// findings record, all resolved from paths relative to THIS module's own
// `import.meta.url` -- so the two transcript paths can never be pointed at a
// substituted pair of runs. The record's own path is the only overridable
// input, via `--record PATH`, which exists solely so this script's own
// non-vacuity proof can run the gate against an ALTERED COPY of the record
// without ever editing the committed file in place.
//
// WHAT IT ASSERTS
// ---------------
// Every number `proof04-false-positives.md` states is re-derived here from
// the two committed transcripts alone and must agree, or this script exits
// non-zero naming both the expected and the found value. See SCHEMA.md for
// the derivation rule this script encodes (never restates by hand, always
// recomputed the same way for a live run and for this gate).
//
// A file that cannot be read, or a run block that cannot be located inside
// it, is a FAIL naming the attempted path -- never silently treated as a
// pass.
// -----------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUN_A_PATH = path.join(HERE, "proof04-run-a-hit50.md");
const RUN_B_PATH = path.join(HERE, "proof04-run-b-narrowed.md");
const DEFAULT_RECORD_PATH = path.join(HERE, "proof04-false-positives.md");

const RUN_LABELS = ["run-a-hit50", "run-b-narrowed"];

// Outcome-line names this gate cross-checks between the record and each
// transcript. Restricted to SCHEMA.md section 7's declared vocabulary MINUS
// `ORACLE_VICE_VERSION` and `ORACLE_SPAWN_ARGV` -- both values are fully
// recorded once each in their own transcript (cited by path in the record's
// own "recorded outcome lines" section) and are deliberately not restated in
// the record, because both embed a version number or dotted IP-address
// octets shaped exactly like an unformatted percentage; no assertion below
// needs either field.
const ORACLE_NAMES = [
  "ORACLE_BROKER_STATE",
  "ORACLE_RELEASE_SHA256",
  "ORACLE_VICE_BINARY",
  "ORACLE_DEPTH_TARGET",
  "ORACLE_DEPTH_REACHED",
  "ORACLE_DEPTH_LABEL",
  "ORACLE_SHORT_RUN",
  "ORACLE_MAP_ENTRIES",
  "ORACLE_PARSE_REFUSAL",
  "ORACLE_SEED",
  "ORACLE_ARGV_DIGEST",
  "ORACLE_EXEC_OBSERVATIONS",
  "ORACLE_ARTIFACT_SHA256",
  "ORACLE_ARTIFACT_PATH",
];
const PROOF04_RUN_NAMES = [
  "PROOF04_LABEL",
  "PROOF04_POSITIVE_CLASS",
  "PROOF04_TIER",
  "PROOF04_FALSE_POSITIVES",
  "PROOF04_AGREEMENTS",
  "PROOF04_BLOCK_COVERED_NEVER_OBSERVED",
  "PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK",
  "PROOF04_OBSERVED_AT_UNDEFINED_BLOCK",
  "PROOF04_DENOMINATOR",
  "PROOF04_BLOCK_ADDRESSES_OBSERVED",
  "PROOF04_VERDICT",
  "PROOF04_ARTIFACT_SHA256",
  "PROOF04_ARTIFACT_PATH",
];
const RUN_LINE_NAMES = [...ORACLE_NAMES, ...PROOF04_RUN_NAMES];
const SHARED_LINE_NAMES = ["SUBJECT_ARTIFACT_SHA256", "PROOF04_PHASE_VERDICT"];
// Not part of SCHEMA.md's fixed vocabulary -- a derived convenience field this
// record itself introduces, used only by assertPercentageShape() to tie the
// stated false-positive percentage back to the SAME per-run bucket the other
// assertions read, so a corrupted denominator cannot pass one check while
// failing another silently.
const PCT_NAME = "PROOF04_FALSE_POSITIVE_PCT";

function parseArgs(argv) {
  let recordPath = DEFAULT_RECORD_PATH;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--record") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--record requires a path argument");
      }
      recordPath = path.resolve(value);
      i++;
    }
  }
  return { recordPath };
}

/** Reads `filePath` as utf8, returning `{ ok: true, text }` on success or
 * `{ ok: false, attemptedPath }` on any read failure -- NEVER throws, and
 * NEVER treats a missing/unreadable file as an empty pass. */
function readFileSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return { ok: true, text };
  } catch {
    return { ok: false, attemptedPath: filePath };
  }
}

/**
 * readOutcomeLines(text) -- scans `text` line by line for clean "NAME value"
 * outcome lines. A line qualifies only if, after trimming leading/trailing
 * whitespace, it starts with one of the declared names immediately followed
 * by a single space (never inside a backtick-wrapped prose sentence, which
 * never begins a physical line with a bare name in either the transcripts or
 * the record by this phase's own writing convention).
 *
 * Returns `{ flat, shared, runs }`:
 *   - `flat`: Map<name, value> -- every qualifying line found anywhere in the
 *     text, "final occurrence wins" (a later line under the same name
 *     overwrites an earlier one), ignoring which run it might belong to.
 *     This is what a TRANSCRIPT file's own single run is checked against.
 *   - `shared`: Map<name, value> -- SHARED_LINE_NAMES lines only.
 *   - `runs`: Map<runLabel, Map<name, value>> -- a new bucket begins the
 *     instant a "PROOF04_LABEL <label>" line is seen, and every subsequent
 *     RUN_LINE_NAMES/PCT_NAME line attaches to that bucket until the next
 *     PROOF04_LABEL line switches it. This is what the RECORD (which states
 *     both runs in one file, PROOF04_LABEL first in each block by this
 *     record's own writing convention) is read through.
 */
function readOutcomeLines(text) {
  const flat = new Map();
  const shared = new Map();
  const runs = new Map();
  let currentRun = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const labelMatch = /^PROOF04_LABEL\s+(.+)$/.exec(line);
    if (labelMatch) {
      currentRun = labelMatch[1].trim();
      if (!runs.has(currentRun)) {
        runs.set(currentRun, new Map());
      }
      runs.get(currentRun).set("PROOF04_LABEL", currentRun);
      flat.set("PROOF04_LABEL", currentRun);
      continue;
    }
    let handled = false;
    for (const name of SHARED_LINE_NAMES) {
      if (line.startsWith(name + " ")) {
        const value = line.slice(name.length + 1).trim();
        shared.set(name, value);
        flat.set(name, value);
        handled = true;
        break;
      }
    }
    if (handled) continue;
    for (const name of RUN_LINE_NAMES) {
      if (line.startsWith(name + " ")) {
        const value = line.slice(name.length + 1).trim();
        flat.set(name, value);
        if (currentRun) {
          runs.get(currentRun).set(name, value);
        }
        handled = true;
        break;
      }
    }
    if (handled) continue;
    if (line.startsWith(PCT_NAME + " ")) {
      const value = line.slice(PCT_NAME.length + 1).trim();
      if (currentRun) {
        runs.get(currentRun).set(PCT_NAME, value);
      }
    }
  }
  return { flat, shared, runs };
}

function num(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new Error(`expected an integer, got: ${JSON.stringify(value)}`);
  }
  return n;
}

/** SCHEMA.md section 5: `frame-exact-region` iff ORACLE_DEPTH_REACHED <= 50,
 * `narrowed` above it. */
function expectedDepthLabel(depthReached) {
  return depthReached <= 50 ? "frame-exact-region" : "narrowed";
}

/** SCHEMA.md section 3, restricted (per this plan's own action text) to the
 * four inputs a static gate can read back from the record: depth reached,
 * parse refusal, denominator, and block-addresses-observed. */
function expectedVerdict({ depthReached, parseRefusal, denominator, blockAddressesObserved }) {
  if (depthReached === 0 || parseRefusal !== "none" || denominator === 0) {
    return "not-exercised";
  }
  if (blockAddressesObserved === 0) {
    return "unresolved";
  }
  return "resolved";
}

/** SCHEMA.md section 4: `resolved` iff at least one recorded run is
 * `resolved`; `unresolved` iff no run is `resolved` and at least one reached
 * the join (i.e. is not `not-exercised`); `not-exercised` iff no run reached
 * the join. */
function expectedPhaseVerdict(perRunVerdicts) {
  if (perRunVerdicts.some((v) => v === "resolved")) {
    return "resolved";
  }
  if (perRunVerdicts.some((v) => v !== "not-exercised")) {
    return "unresolved";
  }
  return "not-exercised";
}

/** For every RUN_LINE_NAMES value the record states for a given run, assert
 * it equals that run's TRANSCRIPT value (transcripts parsed flat, since each
 * transcript file is exactly one run). Also asserts the shared
 * SUBJECT_ARTIFACT_SHA256 the record states equals both transcripts' own
 * value. Returns `{ ok, details }`. */
function assertRunAgreement(record, transcriptsByLabel) {
  const details = [];
  let ok = true;
  for (const label of RUN_LABELS) {
    const recordRun = record.runs.get(label);
    const transcript = transcriptsByLabel.get(label);
    if (!recordRun) {
      ok = false;
      details.push(`record has no run block for ${label}`);
      continue;
    }
    if (!transcript) {
      ok = false;
      details.push(`no transcript loaded for ${label}`);
      continue;
    }
    for (const name of RUN_LINE_NAMES) {
      if (!recordRun.has(name)) continue; // only check names the record actually states
      const recordValue = recordRun.get(name);
      if (!transcript.flat.has(name)) {
        ok = false;
        details.push(`${label}: record states ${name}=${recordValue} but transcript has no ${name} line`);
        continue;
      }
      const transcriptValue = transcript.flat.get(name);
      if (recordValue !== transcriptValue) {
        ok = false;
        details.push(`${label}: ${name} expected(transcript)=${transcriptValue} found(record)=${recordValue}`);
      }
    }
  }
  // Shared SUBJECT_ARTIFACT_SHA256: record's shared value vs both transcripts.
  const recordShared = record.shared.get("SUBJECT_ARTIFACT_SHA256");
  for (const label of RUN_LABELS) {
    const transcript = transcriptsByLabel.get(label);
    if (!transcript) continue;
    const transcriptValue = transcript.flat.get("SUBJECT_ARTIFACT_SHA256");
    if (recordShared !== undefined && transcriptValue !== undefined && recordShared !== transcriptValue) {
      ok = false;
      details.push(
        `SUBJECT_ARTIFACT_SHA256: record=${recordShared} does not match ${label} transcript=${transcriptValue}`,
      );
    }
  }
  return { ok, details };
}

/** Both transcripts must cite the SAME SUBJECT_ARTIFACT_SHA256, read directly
 * from the two transcript files (never from the record). */
function assertSubjectDigestShared(transcriptsByLabel) {
  const a = transcriptsByLabel.get("run-a-hit50")?.flat.get("SUBJECT_ARTIFACT_SHA256");
  const b = transcriptsByLabel.get("run-b-narrowed")?.flat.get("SUBJECT_ARTIFACT_SHA256");
  if (!a || !b) {
    return { ok: false, details: [`missing SUBJECT_ARTIFACT_SHA256 in one or both transcripts (a=${a}, b=${b})`] };
  }
  if (a !== b) {
    return { ok: false, details: [`run-a-hit50 SUBJECT_ARTIFACT_SHA256=${a} != run-b-narrowed=${b}`] };
  }
  return { ok: true, details: [`both transcripts cite ${a}`] };
}

/** The four block-covered buckets per run sum exactly to that run's
 * PROOF04_DENOMINATOR, and PROOF04_BLOCK_ADDRESSES_OBSERVED equals
 * FALSE_POSITIVES + AGREEMENTS -- both re-derived here, never trusted from
 * either transcript's own PROOF04_BUCKET_IDENTITY_OK line. */
function assertBucketIdentity(record) {
  const details = [];
  let ok = true;
  for (const label of RUN_LABELS) {
    const run = record.runs.get(label);
    if (!run) {
      ok = false;
      details.push(`no run block for ${label}`);
      continue;
    }
    const fp = num(run.get("PROOF04_FALSE_POSITIVES"));
    const agree = num(run.get("PROOF04_AGREEMENTS"));
    const neverObserved = num(run.get("PROOF04_BLOCK_COVERED_NEVER_OBSERVED"));
    const undefinedBlock = num(run.get("PROOF04_OBSERVED_AT_UNDEFINED_BLOCK"));
    const denominator = num(run.get("PROOF04_DENOMINATOR"));
    const blockAddressesObserved = num(run.get("PROOF04_BLOCK_ADDRESSES_OBSERVED"));
    const sum = fp + agree + neverObserved + undefinedBlock;
    if (sum !== denominator) {
      ok = false;
      details.push(`${label}: bucket sum ${fp}+${agree}+${neverObserved}+${undefinedBlock}=${sum} expected(denominator)=${denominator}`);
    }
    const combined = fp + agree;
    if (combined !== blockAddressesObserved) {
      ok = false;
      details.push(`${label}: FALSE_POSITIVES+AGREEMENTS=${combined} expected(BLOCK_ADDRESSES_OBSERVED)=${blockAddressesObserved}`);
    }
  }
  return { ok, details };
}

/** Each run's ORACLE_DEPTH_LABEL is what SCHEMA.md's threshold rule yields for
 * that run's ORACLE_DEPTH_REACHED. */
function assertDepthLabelRule(record) {
  const details = [];
  let ok = true;
  for (const label of RUN_LABELS) {
    const run = record.runs.get(label);
    if (!run) {
      ok = false;
      details.push(`no run block for ${label}`);
      continue;
    }
    const reached = num(run.get("ORACLE_DEPTH_REACHED"));
    const expected = expectedDepthLabel(reached);
    const found = run.get("ORACLE_DEPTH_LABEL");
    if (expected !== found) {
      ok = false;
      details.push(`${label}: depth ${reached} expects label=${expected} found=${found}`);
    }
  }
  return { ok, details };
}

/** Each run's PROOF04_VERDICT is what SCHEMA.md's per-run rule yields from
 * that run's ORACLE_DEPTH_REACHED, ORACLE_PARSE_REFUSAL, PROOF04_DENOMINATOR
 * and PROOF04_BLOCK_ADDRESSES_OBSERVED. */
function assertVerdictRule(record) {
  const details = [];
  let ok = true;
  for (const label of RUN_LABELS) {
    const run = record.runs.get(label);
    if (!run) {
      ok = false;
      details.push(`no run block for ${label}`);
      continue;
    }
    const depthReached = num(run.get("ORACLE_DEPTH_REACHED"));
    const parseRefusal = run.get("ORACLE_PARSE_REFUSAL");
    const denominator = num(run.get("PROOF04_DENOMINATOR"));
    const blockAddressesObserved = num(run.get("PROOF04_BLOCK_ADDRESSES_OBSERVED"));
    const expected = expectedVerdict({ depthReached, parseRefusal, denominator, blockAddressesObserved });
    const found = run.get("PROOF04_VERDICT");
    if (expected !== found) {
      ok = false;
      details.push(`${label}: expected verdict=${expected} found=${found}`);
    }
  }
  return { ok, details };
}

/** The record's PROOF04_PHASE_VERDICT is what the roll-up rule yields from
 * the two per-run verdicts the record itself states. */
function assertRollUpRule(record) {
  const perRunVerdicts = RUN_LABELS.map((label) => record.runs.get(label)?.get("PROOF04_VERDICT")).filter(Boolean);
  if (perRunVerdicts.length !== RUN_LABELS.length) {
    return { ok: false, details: [`could not read a PROOF04_VERDICT for every run (found ${perRunVerdicts.length}/${RUN_LABELS.length})`] };
  }
  const expected = expectedPhaseVerdict(perRunVerdicts);
  const found = record.shared.get("PROOF04_PHASE_VERDICT");
  if (expected !== found) {
    return { ok: false, details: [`expected PROOF04_PHASE_VERDICT=${expected} found=${found} (from per-run verdicts ${perRunVerdicts.join(", ")})`] };
  }
  return { ok: true, details: [`PROOF04_PHASE_VERDICT=${found} matches roll-up of ${perRunVerdicts.join(", ")}`] };
}

/** Two parts:
 *  1. Generic shape+self-consistency scan over the WHOLE record text: every
 *     `NN.NN (n/d)`- or `NN.NN(n/d)`-shaped token must have exactly two
 *     decimal digits, and its own adjacent (n/d) pair, rounded to two places
 *     by standard rounding, must equal it. A zero denominator anywhere in
 *     such a pair is an immediate fail (a percentage must never be formed
 *     from one).
 *  2. For each run's own PROOF04_FALSE_POSITIVE_PCT line (a derived
 *     convenience field this record introduces, not part of SCHEMA.md's
 *     vocabulary), assert its own (n/d) pair equals THAT SAME RUN's
 *     PROOF04_FALSE_POSITIVES/PROOF04_DENOMINATOR values from the outcome-line
 *     bucket -- so a corrupted PROOF04_DENOMINATOR line breaks this
 *     assertion too, not only the bucket-identity and run-agreement ones. */
function assertPercentageShape(record, recordText) {
  const details = [];
  let ok = true;

  const tokenRe = /(\d+\.\d+)\s*\((\d+)\/(\d+)\)/g;
  let m;
  while ((m = tokenRe.exec(recordText)) !== null) {
    const [, decimalStr, nStr, dStr] = m;
    const decimalPlaces = decimalStr.split(".")[1]?.length ?? 0;
    if (decimalPlaces !== 2) {
      ok = false;
      details.push(`token ${decimalStr} (${nStr}/${dStr}) does not have exactly two decimal places`);
      continue;
    }
    const n = num(nStr);
    const d = num(dStr);
    if (d === 0) {
      ok = false;
      details.push(`token ${decimalStr} (${nStr}/${dStr}) forms a percentage from a zero denominator`);
      continue;
    }
    const expected = ((n / d) * 100).toFixed(2);
    if (expected !== decimalStr) {
      ok = false;
      details.push(`token ${decimalStr} (${nStr}/${dStr}) expected=${expected} found=${decimalStr}`);
    }
  }

  for (const label of RUN_LABELS) {
    const run = record.runs.get(label);
    if (!run) continue;
    const pctValue = run.get(PCT_NAME);
    if (pctValue === undefined) {
      ok = false;
      details.push(`${label}: no ${PCT_NAME} line found`);
      continue;
    }
    const pctMatch = /^(\d+\.\d+)\s*\((\d+)\/(\d+)\)$/.exec(pctValue);
    if (!pctMatch) {
      ok = false;
      details.push(`${label}: ${PCT_NAME} value ${JSON.stringify(pctValue)} does not parse as NN.NN(n/d)`);
      continue;
    }
    const [, , nStr, dStr] = pctMatch;
    const bucketFp = run.get("PROOF04_FALSE_POSITIVES");
    const bucketDenom = run.get("PROOF04_DENOMINATOR");
    if (nStr !== bucketFp) {
      ok = false;
      details.push(`${label}: ${PCT_NAME} numerator=${nStr} expected(PROOF04_FALSE_POSITIVES)=${bucketFp}`);
    }
    if (dStr !== bucketDenom) {
      ok = false;
      details.push(`${label}: ${PCT_NAME} denominator=${dStr} expected(PROOF04_DENOMINATOR)=${bucketDenom}`);
    }
  }

  return { ok, details };
}

function printResult(name, result) {
  const status = result.ok ? "pass" : "fail";
  console.log(`RECORDGATE_${name} ${status}`);
  if (!result.ok) {
    for (const line of result.details) {
      console.log(`RECORDGATE_${name}_DETAIL ${line}`);
    }
  } else if (result.details && result.details.length > 0) {
    for (const line of result.details) {
      console.log(`RECORDGATE_${name}_DETAIL ${line}`);
    }
  }
}

async function main() {
  const { recordPath } = parseArgs(process.argv.slice(2));

  const runAFile = readFileSafe(RUN_A_PATH);
  const runBFile = readFileSafe(RUN_B_PATH);
  const recordFile = readFileSafe(recordPath);

  const results = {};
  let overallOk = true;

  if (!runAFile.ok || !runBFile.ok || !recordFile.ok) {
    for (const [label, f] of [
      ["run-a-hit50 transcript", runAFile],
      ["run-b-narrowed transcript", runBFile],
      ["record", recordFile],
    ]) {
      if (!f.ok) {
        console.log(`RECORDGATE_FILE_READ fail: missing or unreadable ${label} at ${f.attemptedPath}`);
        overallOk = false;
      }
    }
    console.log("RECORDGATE_RESULT fail");
    process.exit(1);
  }

  const transcriptsByLabel = new Map([
    ["run-a-hit50", readOutcomeLines(runAFile.text)],
    ["run-b-narrowed", readOutcomeLines(runBFile.text)],
  ]);
  const record = readOutcomeLines(recordFile.text);

  results.RUN_AGREEMENT = assertRunAgreement(record, transcriptsByLabel);
  results.SUBJECT_DIGEST = assertSubjectDigestShared(transcriptsByLabel);
  results.BUCKET_IDENTITY = assertBucketIdentity(record);
  results.DEPTH_LABEL = assertDepthLabelRule(record);
  results.VERDICT_RULE = assertVerdictRule(record);
  results.ROLLUP = assertRollUpRule(record);
  results.PERCENTAGE_SHAPE = assertPercentageShape(record, recordFile.text);

  for (const [name, result] of Object.entries(results)) {
    printResult(name, result);
    if (!result.ok) overallOk = false;
  }

  console.log(`RECORDGATE_RESULT ${overallOk ? "pass" : "fail"}`);
  process.exit(overallOk ? 0 : 1);
}

main();
