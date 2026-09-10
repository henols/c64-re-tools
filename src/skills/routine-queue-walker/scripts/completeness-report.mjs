#!/usr/bin/env node
// completeness-report.mjs -- renders the per-fixture decomposition
// completeness report for Phase 45 (D-04, D-06, D-07, D-08, D-09, D-10).
//
// WHY THIS FILE EXISTS: criterion 2's disagreement query and criterion 1's
// zero-`Undefined` census must be answered TOGETHER, from ONE real store, or
// a completeness claim can hide a weak measure behind a strong one -- exactly
// the failure `printCoverageReport()`/`printEvidDisagreementsReport()` were
// each already built to avoid, one verb over. `routine-queue-walker` already
// exists to drive an annotation store's backlog to closure and report every
// leftover; this script supplies the numeric stop condition it currently
// lacks (D-08).
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: rendering the per-fixture
// decomposition-completeness report, and REFUSING to render at all without
// the disagreement input (D-09 mechanism 2 -- a required output-schema field
// only that input can populate).
//
// WHAT NOT TO DO:
//   - Never derive a completeness measure from the store's block-type
//     listing directly in THIS file. `anno-coverage.ts`'s own trap 1 forbids
//     it there, and D-05 forbids extending or re-implementing that module
//     here -- this script never reads a store; it renders the fifth CLI
//     verb's own `--json` answer, which already did the reading.
//   - Never render without the disagreement-query input. A missing input is
//     refused by name (`MissingDisagreementInputError`), never defaulted to
//     an empty array -- an omitted query and a query that found nothing must
//     never look the same (D-09).
//   - Never print a percentage, rate or combined figure. Every count in this
//     report carries its own denominator, exactly like
//     `printEvidDisagreementsReport()`'s own discipline.
//   - Never re-implement `evid-reconcile.ts`'s four-bucket join, or rename
//     any of its field names. This script only ever reads
//     `disagreementInput`'s fields verbatim, as `anno decomp-completeness
//     --json` already named them.
//   - Never carry a second copy of the MCP-module resolution ladder. It
//     lives ONE place, `../../c64-ram-capture/scripts/mcp-module.mjs`, and is
//     imported from there.
import { spawnSync } from "node:child_process";

import { resolveMcpModule, refusalMessage, TARGET_PACKAGE } from "../../c64-ram-capture/scripts/mcp-module.mjs";

/** The MCP-side entry point this script forwards to -- the SAME "node
 * vice-proxy.ts anno <verb>" invocation `routine-queue-walker/SKILL.md`'s
 * own Phase 5 `anno coverage` call already uses (D-06: no broker, no
 * container-out seam -- the store is `node:sqlite` in-process, and this
 * script's own job is orchestration, never a store read of its own). */
const TARGET_FILE = "vice-proxy.ts";

/** Thrown by `renderCompletenessReport()` when `report.disagreementInput` is
 * absent, or present but missing a complete `runIdentity` -- D-09 mechanism
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
 * The frozen survivor prefix set (phase 45 plan 45-01 task 2), MIRRORED from
 * `src/mcp/vice/anno-cli.ts`'s own frozen set -- see
 * docs/phase45-wave0-measurements.md for the MEASURED label population this
 * was frozen against. Exported here, separately from the verb's own copy,
 * because this script's own tests must be able to assert on the predicate in
 * isolation, without a live store or a subprocess -- and because this
 * script's own header forbids it from reading a store directly, so it
 * cannot import the verb's copy through anything but a duplicate literal.
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
 * Normalises a raw `anno decomp-completeness --json` answer into the report
 * shape this module renders. Pure: no filesystem, no subprocess, no store.
 * Throws a plain `Error` (never `MissingDisagreementInputError`, which is
 * `renderCompletenessReport()`'s own refusal) when `answer` is not even a
 * plausible answer object -- a caller error, distinct from a missing
 * disagreement input.
 */
export function buildCompletenessReport(answer) {
  if (typeof answer !== "object" || answer === null) {
    throw new Error("buildCompletenessReport: expected a decomp-completeness --json answer object, got " + JSON.stringify(answer));
  }
  return {
    store: answer.store,
    fixture: answer.fixture,
    executionDisposition: answer.executionDisposition,
    notExecutedReason: answer.notExecutedReason ?? null,
    byteCensus: answer.byteCensus,
    survivors: Array.isArray(answer.survivors) ? answer.survivors : [],
    disagreementInput: answer.disagreementInput,
  };
}

/**
 * Renders `report` as text, copying `printEvidDisagreementsReport()`'s own
 * rendering discipline exactly: every measure under its own heading,
 * disagreements first, `denominator` beside every count, an explicit
 * sentence stating what absence does NOT prove, and never a percentage,
 * rate or combined figure.
 *
 * THROWS `MissingDisagreementInputError` -- D-09 mechanism 2 -- when
 * `report.disagreementInput` is absent, or present but its own
 * `runIdentity` is not a complete `{ imageSha256, argvDigest, seed }`
 * object. An empty `disagreements` ARRAY alone is not enough to refuse --
 * that is a real, non-vacuous "zero disagreements" answer; what is refused
 * is the ABSENCE of the input itself.
 */
export function renderCompletenessReport(report) {
  const input = report?.disagreementInput;
  const identity = input?.runIdentity;
  if (
    input === undefined ||
    input === null ||
    typeof identity !== "object" ||
    identity === null ||
    typeof identity.imageSha256 !== "string" ||
    typeof identity.argvDigest !== "string" ||
    typeof identity.seed !== "string"
  ) {
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
    lines.push("  EXECUTED: this fixture was run under Phase 33's reproducible-run protocol.");
  }
  lines.push("");

  const census = report.byteCensus ?? { byType: {}, undefinedCount: 0, denominator: 0 };
  lines.push(`  BYTE CENSUS (denominator ${census.denominator ?? 0})`);
  for (const [type, count] of Object.entries(census.byType ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    lines.push(`    ${type}: ${count} of ${census.denominator ?? 0}`);
  }
  lines.push(`    undefined: ${census.undefinedCount ?? 0} of ${census.denominator ?? 0}`);
  lines.push("");

  const survivors = report.survivors ?? [];
  lines.push(`  SURVIVORS (${survivors.length})`);
  if (survivors.length === 0) {
    lines.push("    none");
  } else {
    for (const s of survivors) {
      const addr = typeof s.address === "number" ? `$${s.address.toString(16).padStart(4, "0")}` : String(s.address);
      lines.push(`    ${addr}  ${s.name}`);
    }
  }
  lines.push("");

  lines.push(`  DISAGREEMENTS (${input.disagreementCount ?? 0} of ${input.denominator ?? 0})`);
  const disagreements = Array.isArray(input.disagreements) ? input.disagreements : [];
  if (disagreements.length === 0) {
    lines.push("    none");
  } else {
    for (const d of disagreements) {
      const addr = typeof d.address === "number" ? `$${d.address.toString(16).padStart(4, "0")}` : String(d.address);
      const banks = Array.isArray(d.sourceBanks) ? d.sourceBanks.join(",") : "";
      lines.push(`    ${addr}  byte-derived=${d.byteDerived}  runtime=${d.runtime}  banks=${banks}`);
    }
  }
  lines.push(`  AGREEMENT: ${input.agreementCount ?? 0} of ${input.denominator ?? 0}`);
  lines.push(
    `  NO OBSERVATION: ${input.blockCoveredNeverObservedCount ?? 0} of ${input.denominator ?? 0} -- an address never observed ` +
      "executing proves NOTHING about what it is; absence is not evidence for or against any classification.",
  );
  lines.push("");
  lines.push(
    "  Read every figure above against the others, never combined into one -- together they name what this " +
      "store's block table covers, never what the program actually is.",
  );
  return lines.join("\n");
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
 * never swallowed. */
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
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
