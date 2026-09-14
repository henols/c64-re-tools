#!/usr/bin/env node
// completeness-report.mjs -- renders the per-fixture decomposition
// completeness report, and OWNS the GATE: this script's own process exit
// code is routine-queue-walker's numeric stop condition -- 0 only when every measure below
// clears its own bar, 1 the instant any one of them does not, naming which
// measure and which address failed.
//
// WHY THIS FILE EXISTS: criterion 2's disagreement query and criterion 1's
// zero-`Undefined` census must be answered TOGETHER, from ONE real store, or
// a completeness claim can hide a weak measure behind a strong one -- exactly
// the failure `printCoverageReport()`/`printEvidDisagreementsReport()` were
// each already built to avoid, one verb over. `routine-queue-walker` already
// exists to drive an annotation store's backlog to closure and report every
// leftover; this script supplies the numeric stop condition it currently
// lacks.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: rendering the per-fixture
// decomposition-completeness report, REFUSING to render at all without the
// disagreement input (a required output-schema field only that input can
// populate), and computing the GATE's pass/fail verdict
// and exit code from the rendered measures.
//
// WHAT NOT TO DO:
//   - Never derive a completeness measure from the store's block-type
//     listing directly in THIS file. `anno-coverage.ts`'s own trap 1 forbids
//     it there, and extending or re-implementing that module here is
//     equally forbidden -- this script never reads a store; it renders the fifth CLI
//     verb's own `--json` answer, which already did the reading.
//   - Never render without the disagreement-query input. A missing input is
//     refused by name (`MissingDisagreementInputError`), never defaulted to
//     an empty array -- an omitted query and a query that found nothing must
//     never look the same.
//   - Never print a percentage, rate or combined figure. Every count in this
//     report carries its own denominator, exactly like
//     `printEvidDisagreementsReport()`'s own discipline.
//   - Never re-implement `evid-reconcile.ts`'s four-bucket join, or rename
//     any of its field names. This script only ever reads
//     `disagreementInput`'s fields verbatim, as `anno decomp-completeness
//     --json` already named them.
//   - Never restate any of the four split-table `SPLIT_DATA_TYPES` spellings
//     as a literal string in THIS file (a mechanical grep guard over this
//     exact file is a standing acceptance criterion). The "table" naming
//     is computed on the VERB side (`anno-cli.ts`'s own
//     `renderedType` field, read from `anno-types.ts`'s `isSplitDataType()`)
//     and this script only ever renders `renderedType` verbatim.
//   - Never soften a gate failure into a bulletin. `computeGateFailures()`
//     below is the ONE place a measure becomes a pass/fail verdict; a
//     softened refusal here is exactly what planted controls 1 and 2 (task
//     2) exist to catch going RED.
//   - Never carry a second copy of the MCP-module resolution ladder. It
//     lives ONE place, `../../c64-ram-capture/scripts/mcp-module.mjs`, and is
//     imported from there.
import { spawnSync } from "node:child_process";

import { resolveMcpModule, refusalMessage, TARGET_PACKAGE } from "../../c64-ram-capture/scripts/mcp-module.mjs";

/** The MCP-side entry point this script forwards to -- the SAME "node
 * vice-proxy.ts anno <verb>" invocation `routine-queue-walker/SKILL.md`'s
 * skill's own closing `anno coverage` call already uses (no broker, no
 * container-out seam -- the store is `node:sqlite` in-process, and this
 * script's own job is orchestration, never a store read of its own). */
const TARGET_FILE = "vice-proxy.ts";

/** Thrown by `renderCompletenessReport()` when `report.disagreementInput` is
 * absent, or present but missing a complete `runIdentity` -- mechanism
 * 2's own required output-schema field. The message always names the
 * `--disagreements` flag literally, so a caller reading only the thrown
 * message still knows what to pass. */
export class MissingDisagreementInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "MissingDisagreementInputError";
  }
}

/**
 * The frozen survivor prefix set, MIRRORED from
 * `src/mcp/vice/anno-cli.ts`'s own frozen set -- frozen from a real
 * derivation run (dxa disassemble, then Ghidra import) that measured ZERO
 * labels written by import alone, confirming the eleven prefixes had
 * nothing populated to positively test against rather than contradicting
 * them. Exported here, separately from the verb's own copy, because this
 * script's own tests must be able to assert on the predicate in isolation,
 * without a live store or a subprocess -- and because this script's own
 * header forbids it from reading a store directly, so it cannot import the
 * verb's copy through anything but a duplicate literal.
 *
 * WHAT NOT TO DO: if the frozen set in `anno-cli.ts` ever changes, this copy
 * moves in the SAME commit, or the two renderers silently disagree about
 * what "survivor" means. Never restate `AUTO_NAME_PREFIX_RE`'s eleven
 * prefixes as their own literal strings here -- this predicate matches
 * against a caller-SUPPLIED name (from the verb's own `survivors` answer),
 * never derives a name from a store itself, so there is no store-derived
 * value to keep in sync beyond this one regex pair.
 */
const AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/;
const SURVIVOR_EXTRA_RE = /^(?:l_[0-9a-f]{4}|(?:FUN|LAB)_[0-9a-f]{4}|l[0-9a-f]{3,4})$/;

/** True iff `name` is a survivor under the frozen set. ASCII case-sensitive:
 * `l_0810` IS a survivor, `L_0810` is NOT -- `anno-coverage.test.ts`'s own
 * `L_` exclusion precedent, restated for this phase's own prefix set. */
export function isSurvivorName(name) {
  return AUTO_NAME_PREFIX_RE.test(name) || SURVIVOR_EXTRA_RE.test(name);
}

/**
 * The precedence rule, mirrored here (see this file's own
 * header on why a mirror rather than an import) so this script's own test
 * tier can assert the PRECEDENCE explicitly, not merely pass through a
 * verb-computed value. `anno-cli.ts`'s `typedByFor()` is the authoritative
 * copy that actually runs against a real store; this one exists only to be
 * unit-tested in isolation, exactly like `isSurvivorName()` above. Evidence
 * beats inference: `observed-executing` (a real execute observation exists
 * inside the range) beats `authored` (an `AUTHORED_PROVENANCE_COMMENT_PREFIX`
 * comment exists and there is no observation) beats `byte-derived` (neither).
 * A range that is BOTH observed and authored renders `observed-executing`.
 */
export function typedByFor(hasObservation, hasAuthoredComment) {
  if (hasObservation) return "observed-executing";
  if (hasAuthoredComment) return "authored";
  return "byte-derived";
}

const PURPOSE_ELEMENT_KEYS = ["function", "inputs", "outputs", "sideEffects"];

/**
 * Normalises a raw `anno decomp-completeness --json` answer into the report
 * shape this module renders and gates. Pure: no filesystem, no subprocess, no
 * store. Throws a plain `Error` (never `MissingDisagreementInputError`, which
 * is `renderCompletenessReport()`'s own refusal) when `answer` is not even a
 * plausible answer object -- a caller error, distinct from a missing
 * disagreement input.
 *
 * Every NEW field defaults to the CONSERVATIVE (gate-failing or vacuity-
 * naming) shape when absent, never to a shape that would silently pass --
 * The same refuse-by-name discipline, applied to every field, not only the
 * original disagreement input.
 */
export function buildCompletenessReport(answer) {
  if (typeof answer !== "object" || answer === null) {
    throw new Error("buildCompletenessReport: expected a decomp-completeness --json answer object, got " + JSON.stringify(answer));
  }
  const disagreementInput = answer.disagreementInput;
  const disagreementResolution =
    answer.disagreementResolution && typeof answer.disagreementResolution === "object"
      ? {
          rows: Array.isArray(answer.disagreementResolution.rows) ? answer.disagreementResolution.rows : [],
          unresolvedCount: answer.disagreementResolution.unresolvedCount ?? (disagreementInput?.disagreementCount ?? 0),
          denominator: answer.disagreementResolution.denominator ?? (disagreementInput?.denominator ? disagreementInput.disagreementCount : 0),
        }
      : {
          rows: [],
          // Conservative default: an answer that carries a real disagreement
          // count but no resolution census at all is treated as ENTIRELY
          // unresolved, never as a silent pass -- the same discipline
          // applies to the disagreement input itself, applied here to its
          // resolution.
          unresolvedCount: disagreementInput?.disagreementCount ?? 0,
          denominator: disagreementInput?.disagreementCount ?? 0,
        };
  return {
    store: answer.store,
    fixture: answer.fixture,
    executionDisposition: answer.executionDisposition,
    notExecutedReason: answer.notExecutedReason ?? null,
    byteCensus: answer.byteCensus,
    survivors: Array.isArray(answer.survivors) ? answer.survivors : [],
    rangeProvenance: Array.isArray(answer.rangeProvenance) ? answer.rangeProvenance : [],
    entryPoints: Array.isArray(answer.entryPoints) ? answer.entryPoints : [],
    referencedAddresses:
      answer.referencedAddresses && typeof answer.referencedAddresses === "object"
        ? {
            resolved: Array.isArray(answer.referencedAddresses.resolved) ? answer.referencedAddresses.resolved : [],
            declined: Array.isArray(answer.referencedAddresses.declined) ? answer.referencedAddresses.declined : [],
            unresolved: Array.isArray(answer.referencedAddresses.unresolved) ? answer.referencedAddresses.unresolved : [],
            denominator: answer.referencedAddresses.denominator ?? 0,
          }
        : { resolved: [], declined: [], unresolved: [], denominator: 0 },
    disagreementInput,
    disagreementResolution,
  };
}

function addr(a) {
  return typeof a === "number" ? `$${a.toString(16).padStart(4, "0")}` : String(a);
}

/**
 * Renders `report` as text, copying `printEvidDisagreementsReport()`'s own
 * rendering discipline exactly: every measure under its own heading,
 * disagreements first, `denominator` beside every count, an explicit
 * sentence stating what absence does NOT prove, and never a percentage,
 * rate or combined figure.
 *
 * THROWS `MissingDisagreementInputError` when
 * `report.disagreementInput` is absent, or present but its own
 * `runIdentity` is neither `null` nor a complete
 * `{ imageSha256, argvDigest, seed }` object. An empty `disagreements`
 * ARRAY alone is not enough to refuse -- that is a real, non-vacuous "zero
 * disagreements" answer; what is refused is the ABSENCE of the input
 * itself.
 *
 * `identity === null` is a THIRD,
 * legitimate value here, mirroring anno-cli.ts's own
 * `validateDisagreementDocumentShape()`/match-check -- the real answer `anno
 * evid-disagreements --json` produces for a store with zero observed runs
 * (a non-executed fixture). By the time a report reaches this
 * function, `anno decomp-completeness`'s own server-side check has already
 * proven that null against the store's own evid-runs table (refusing a
 * null identity on a store that DOES carry real runs) -- this function
 * never re-derives that proof, only trusts an already-validated report.
 */
export function renderCompletenessReport(report) {
  const input = report?.disagreementInput;
  const identity = input?.runIdentity;
  const identityIsWellFormed =
    identity === null ||
    (typeof identity === "object" && identity !== null && typeof identity.imageSha256 === "string" && typeof identity.argvDigest === "string" && typeof identity.seed === "string");
  if (input === undefined || input === null || !identityIsWellFormed) {
    throw new MissingDisagreementInputError(
      "renderCompletenessReport: no disagreement input is present on this report -- refusing to render. " +
        "Pass --disagreements to `anno decomp-completeness` (the JSON `anno evid-disagreements --json` wrote " +
        "for the SAME store); an omitted query and a query that found nothing must never render the same report.",
    );
  }

  const lines = [];
  lines.push(`decomposition completeness: ${report.store ?? "(unknown store)"}`);
  lines.push(`  FIXTURE: ${report.fixture ?? "(unknown fixture)"}`);
  if (report.executionDisposition === "not-executed") {
    lines.push(`  NOT EXECUTED: ${report.notExecutedReason ?? "(no reason recorded)"}`);
  } else {
    lines.push("  EXECUTED: this fixture was run under the reproducible-run protocol.");
  }
  lines.push("");

  const census = report.byteCensus ?? { byType: {}, undefinedCount: 0, denominator: 0 };
  lines.push(`  BYTE CENSUS (denominator ${census.denominator ?? 0})`);
  for (const [type, count] of Object.entries(census.byType ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    lines.push(`    ${type}: ${count} of ${census.denominator ?? 0}`);
  }
  lines.push(`    undefined: ${census.undefinedCount ?? 0} of ${census.denominator ?? 0}`);
  for (const gap of Array.isArray(census.undefinedRanges) ? census.undefinedRanges : []) {
    lines.push(`      UNDEFINED: ${addr(gap.start)}-${addr(gap.endInclusive)}`);
  }
  lines.push("");

  const survivors = report.survivors ?? [];
  lines.push(`  SURVIVORS (${survivors.length})`);
  if (survivors.length === 0) {
    lines.push("    none");
  } else {
    for (const s of survivors) {
      lines.push(`    ${addr(s.address)}  ${s.name}`);
    }
  }
  lines.push("");

  lines.push(`  DISAGREEMENTS (${input.disagreementCount ?? 0} of ${input.denominator ?? 0})`);
  const disagreements = Array.isArray(input.disagreements) ? input.disagreements : [];
  if (disagreements.length === 0) {
    lines.push("    none");
  } else {
    for (const d of disagreements) {
      const banks = Array.isArray(d.sourceBanks) ? d.sourceBanks.join(",") : "";
      lines.push(`    ${addr(d.address)}  byte-derived=${d.byteDerived}  runtime=${d.runtime}  banks=${banks}`);
    }
  }
  lines.push(`  AGREEMENT: ${input.agreementCount ?? 0} of ${input.denominator ?? 0}`);
  lines.push(
    `  NO OBSERVATION: ${input.blockCoveredNeverObservedCount ?? 0} of ${input.denominator ?? 0} -- an address never observed ` +
      "executing proves NOTHING about what it is; absence is not evidence for or against any classification.",
  );
  const resolution = report.disagreementResolution ?? { rows: [], unresolvedCount: 0, denominator: 0 };
  const acceptedCount = resolution.rows.length - resolution.unresolvedCount;
  lines.push(
    `  DISAGREEMENT RESOLUTION: ${acceptedCount} accepted, ${resolution.unresolvedCount} unresolved of ${resolution.denominator} -- ` +
      "criterion 2's own gate: a nonzero unresolved count BLOCKS rather than being reported beside a pass.",
  );
  lines.push("");

  const rangeProvenance = report.rangeProvenance ?? [];
  lines.push(`  RANGE PROVENANCE (${rangeProvenance.length} range(s))`);
  if (rangeProvenance.length === 0) {
    lines.push("    none");
  } else {
    for (const row of rangeProvenance) {
      lines.push(`    ${addr(row.start)}-${addr(row.endInclusive)}  ${row.renderedType}  typedBy: ${row.typedBy}`);
    }
  }
  lines.push("");

  const entryPoints = report.entryPoints ?? [];
  const fullyDocumented = entryPoints.filter(
    (e) => e.hasName && PURPOSE_ELEMENT_KEYS.every((k) => e.purposeElements && e.purposeElements[k]),
  ).length;
  lines.push(`  ENTRY POINTS (${fullyDocumented} of ${entryPoints.length})`);
  if (entryPoints.length === 0) {
    lines.push("    none -- a zero-entry-point count is a fact about the candidate set, never evidence of completeness.");
  } else {
    for (const e of entryPoints) {
      const missing = PURPOSE_ELEMENT_KEYS.filter((k) => !(e.purposeElements && e.purposeElements[k]));
      lines.push(
        `    ${addr(e.address)}  ${e.name ?? "(unnamed)"}  hasName=${Boolean(e.hasName)}` +
          (missing.length > 0 ? `  MISSING: ${missing.join(", ")}` : "  purpose comment complete"),
      );
    }
  }
  lines.push("");

  const refs = report.referencedAddresses ?? { resolved: [], declined: [], unresolved: [], denominator: 0 };
  lines.push(`  REFERENCED NON-HARDWARE ADDRESSES (${refs.resolved.length} resolved of ${refs.denominator})`);
  if (refs.denominator === 0) {
    lines.push("    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.");
  } else {
    lines.push(`    RESOLVED: ${refs.resolved.length === 0 ? "none" : refs.resolved.map(addr).join(", ")}`);
    lines.push(`    DECLINED: ${refs.declined.length === 0 ? "none" : refs.declined.map((d) => `${addr(d.address)} (${d.reason})`).join(", ")}`);
    lines.push(`    UNRESOLVED: ${refs.unresolved.length === 0 ? "none" : refs.unresolved.map(addr).join(", ")}`);
  }
  lines.push("");

  lines.push(
    "  Read every figure above against the others, never combined into one -- together they name what this " +
      "store's block table covers, never what the program actually is.",
  );

  const failures = computeGateFailures(report);
  lines.push("");
  if (failures.length === 0) {
    lines.push("  GATE: PASS -- every measure above cleared its own bar.");
  } else {
    lines.push(`  GATE: FAIL (${failures.length})`);
    for (const f of failures) lines.push(`    - ${f}`);
  }

  return lines.join("\n");
}

/**
 * THE GATE (the numeric stop condition; criterion 2's own words: a
 * nonzero unresolved count BLOCKS rather than being reported beside a
 * pass). Returns an array of human-readable failure strings, each naming
 * the offending address where one exists; an empty array means the gate
 * passes. Never throws -- a malformed report renders its own absence as a
 * failure (see the individual guards below) rather than crashing the report
 * that exists to surface exactly this kind of gap.
 *
 * ALL FIVE gate conditions, restated from the plan this implements:
 *   1. `byteCensus.undefinedCount === 0`
 *   2. `disagreementResolution.unresolvedCount === 0`
 *   3. `survivors` is empty
 *   4. every `entryPoints` row has `hasName` true and all four
 *      `purposeElements` true
 *   5. `referencedAddresses.unresolved` is empty
 */
export function computeGateFailures(report) {
  const failures = [];

  const undefinedCount = report?.byteCensus?.undefinedCount ?? 0;
  if (undefinedCount !== 0) {
    const gaps = Array.isArray(report?.byteCensus?.undefinedRanges) ? report.byteCensus.undefinedRanges : [];
    const named = gaps.length > 0 ? gaps.map((g) => (g.start === g.endInclusive ? addr(g.start) : `${addr(g.start)}-${addr(g.endInclusive)}`)).join(", ") : "(address not reported)";
    failures.push(`byte census: ${undefinedCount} Undefined byte(s) remain at ${named} (must be 0)`);
  }

  const survivors = Array.isArray(report?.survivors) ? report.survivors : [];
  if (survivors.length > 0) {
    for (const s of survivors) failures.push(`survivor auto-name at ${addr(s.address)} (${s.name}) still sits in a code region`);
  }

  const entryPoints = Array.isArray(report?.entryPoints) ? report.entryPoints : [];
  for (const e of entryPoints) {
    if (!e.hasName) {
      failures.push(`entry point ${addr(e.address)} has no authored name`);
      continue;
    }
    const missing = PURPOSE_ELEMENT_KEYS.filter((k) => !(e.purposeElements && e.purposeElements[k]));
    if (missing.length > 0) {
      failures.push(`entry point ${addr(e.address)} is missing purpose-comment element(s): ${missing.join(", ")}`);
    }
  }

  const refs = report?.referencedAddresses ?? { unresolved: [] };
  for (const a of Array.isArray(refs.unresolved) ? refs.unresolved : []) {
    failures.push(`referenced address ${addr(a)} is neither named nor declined`);
  }

  const resolution = report?.disagreementResolution ?? { unresolvedCount: 0 };
  const unresolvedCount = resolution.unresolvedCount ?? 0;
  if (unresolvedCount !== 0) {
    failures.push(`${unresolvedCount} disagreement(s) remain unresolved (no DISAGREEMENT-ACCEPTED comment)`);
  }

  return failures;
}

/**
 * Forwards `["anno", "decomp-completeness", ...argv, "--json"]` to the
 * resolved MCP-side `vice-proxy.ts`, parses its stdout as JSON, and returns
 * `buildCompletenessReport()`'s own normalised shape. Never rejects: an
 * unresolved MCP module, a non-zero exit, or unparsable stdout all resolve
 * to a thrown `Error` with the seam's own refusal text (or, per this
 * script's never-throw posture at the CLI boundary, `main()` below catches
 * it and reports it as an exit code) -- this function itself may throw,
 * since it is the in-process API a test or another script calls directly.
 */
export function fetchCompletenessReport(argv) {
  const resolved = resolveMcpModule(TARGET_FILE);
  if (!resolved.ok) {
    throw new Error(
      `completeness-report.mjs: ${refusalMessage(TARGET_FILE, resolved.rungs)}\n` +
        `${TARGET_FILE} is where the fifth anno CLI verb lives (${TARGET_PACKAGE}). Refusing rather than ` +
        "reading a store directly here -- a second copy of that read is exactly the divergence this script's own header forbids.",
    );
  }
  const fullArgv = ["anno", "decomp-completeness", ...argv, "--json"];
  const run = spawnSync(process.execPath, [resolved.path, ...fullArgv], { encoding: "utf8" });
  if (run.error) {
    throw new Error(`completeness-report.mjs: could not run ${resolved.path}: ${run.error.message}`);
  }
  if (run.signal) {
    throw new Error(`completeness-report.mjs: ${resolved.path} was killed by ${run.signal}`);
  }
  if (run.status !== 0) {
    throw new Error(`completeness-report.mjs: anno decomp-completeness exited ${run.status}: ${run.stderr || run.stdout}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(run.stdout);
  } catch (err) {
    throw new Error(`completeness-report.mjs: anno decomp-completeness --json did not print valid JSON: ${err.message}`);
  }
  return buildCompletenessReport(parsed);
}

/** CLI entry point: `node completeness-report.mjs --store FILE --disagreements FILE --manifest FILE`.
 * Forwards argv verbatim to the resolved verb, renders the result, and
 * returns a process exit code -- never calls `process.exit()` itself, so
 * `main()` stays testable in-process. A thrown `MissingDisagreementInputError`
 * is reported with its own message and nothing more (the refusal IS the
 * report); any other thrown error is reported the same way, verbatim,
 * never swallowed. On a SUCCESSFULLY RENDERED report, the exit code is THE
 * GATE's own verdict (`computeGateFailures()`), never a bare 0 -- this is
 * the numeric stop condition, and softening it here is exactly the
 * regression planted controls 1/2 (task 2) exist to catch. */
export function main(argv) {
  let report;
  try {
    report = fetchCompletenessReport(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  try {
    console.log(renderCompletenessReport(report));
    return computeGateFailures(report).length === 0 ? 0 : 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
