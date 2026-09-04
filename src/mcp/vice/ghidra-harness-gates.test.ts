#!/usr/bin/env node
// ghidra-harness-gates.test.ts
//
// Phase 36, plan 36-03 (GHID-01, gate 1's hermetic half): the exact-literal
// signal, and the proof that the naive form is unusable, over REAL captured
// `analyzeHeadless` run logs. Pure string logic -- no child process, no
// Ghidra installation, no filesystem write of any kind. Imports
// `classifyGhidraRunLog()` from `ghidra-run.ts` (plan 36-01's own module,
// landed there specifically so this plan could import it without editing
// that file -- plan 36-02 edits `ghidra-run.ts`'s sibling, `host-tool.mts`,
// in this SAME wave, and a second edit here would collide). This file adds
// NO production module of its own.
//
// FIXTURE PROVENANCE: both `fixtures/ghidra/runlog-*.txt` files are REAL
// captured `analyzeHeadless` run logs -- never hand-authored -- produced
// this session via the `ghidra.analyze` host tool against a real Ghidra
// 12.1.3 installation. See `fixtures/ghidra/README.md` for the exact
// commands, image sizes, exit statuses and dates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyGhidraRunLog } from "./ghidra-run.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures", "ghidra");

const BENIGN_LOG = readFileSync(join(FIXTURES_DIR, "runlog-benign-base0-conflict.txt"), "utf8");
const SCRIPT_ERROR_LOG = readFileSync(join(FIXTURES_DIR, "runlog-script-error.txt"), "utf8");

/** The MEASURED exit status each fixture's own run actually returned,
 * recorded in fixtures/ghidra/README.md -- both were 0. Read here ONLY to
 * prove the classifier's own signature carries no exit-status parameter;
 * never passed to classifyGhidraRunLog(). */
const BENIGN_EXIT_STATUS = 0;
const SCRIPT_ERROR_EXIT_STATUS = 0;

/** A minimum line-count floor for each fixture, so a truncated or emptied
 * fixture file fails HERE rather than making every case below pass
 * trivially over an (almost) empty string. */
const MIN_FIXTURE_LINES = 20;

test("ghidra-harness-gates NON-VACUITY: both real captured fixtures are non-empty and above a stated minimum line count", () => {
  for (const [name, text] of [
    ["runlog-benign-base0-conflict.txt", BENIGN_LOG],
    ["runlog-script-error.txt", SCRIPT_ERROR_LOG],
  ] as const) {
    assert.ok(text.length > 0, `${name} must be non-empty`);
    const lineCount = text.split("\n").length;
    assert.ok(
      lineCount >= MIN_FIXTURE_LINES,
      `${name} must carry at least ${MIN_FIXTURE_LINES} lines; got ${lineCount} -- a truncated fixture must fail here, not pass every case below trivially`,
    );
  }
});

test("ghidra-harness-gates EXACT LITERAL: the script-error fixture is classified as a thrown script", () => {
  const verdict = classifyGhidraRunLog(SCRIPT_ERROR_LOG);
  assert.equal(verdict.scriptThrew, true, "the script-error fixture's own \"ERROR REPORT SCRIPT ERROR:\" line must be detected");
});

test("ghidra-harness-gates EXACT LITERAL: the benign fixture is NOT classified as a thrown script", () => {
  const verdict = classifyGhidraRunLog(BENIGN_LOG);
  assert.equal(verdict.scriptThrew, false, "the benign fixture carries no \"ERROR REPORT SCRIPT ERROR:\" line and must not be misclassified as a throw");
});

test("ghidra-harness-gates FALSE-FIRE PROOF: a case-insensitive naive error-or-failure pattern MATCHES the benign fixture", () => {
  // This is the entire reason the harness uses the exact literal
  // "ERROR REPORT SCRIPT ERROR" rather than a loose "contains error/fail"
  // test: a naive case-insensitive pattern for the words "error" or "fail"
  // MATCHES the benign fixture's own conflict lines ("Failed to add
  // language defined memory block due to conflict: ..."), so a guard built
  // on that naive pattern would false-fire on every ordinary base-0/flat-64K
  // import and would eventually be switched off as noise. This case
  // asserts a POSITIVE match precisely to demonstrate that hazard, not to
  // prove the exact literal's absence (a case that only asserted absence
  // would prove nothing about WHY the exact literal is the signal).
  const naivePattern = /error|fail/i;
  assert.ok(
    naivePattern.test(BENIGN_LOG),
    "a naive case-insensitive error-or-failure pattern must MATCH the benign fixture -- this is why the exact literal \"ERROR REPORT SCRIPT ERROR\" is the signal, not a loose substring test",
  );
});

test("ghidra-harness-gates EXIT STATUS CARRIES NO INFORMATION: the classifier's signature takes log text only", () => {
  // Both fixtures' own recorded process exit status was 0 (see
  // fixtures/ghidra/README.md) -- the script-error run threw and STILL
  // exited 0. classifyGhidraRunLog()'s own signature is (logText: string)
  // -- no exit-status parameter exists to derive a verdict from, even by
  // accident. Calling it with only the log text, for a fixture whose real
  // exit status was 0 either way, demonstrates the verdict comes from the
  // text alone.
  assert.equal(BENIGN_EXIT_STATUS, 0);
  assert.equal(SCRIPT_ERROR_EXIT_STATUS, 0);
  assert.equal(classifyGhidraRunLog.length, 1, "classifyGhidraRunLog() must take exactly one parameter (log text), never an exit status");

  const benignVerdict = classifyGhidraRunLog(BENIGN_LOG);
  const scriptErrorVerdict = classifyGhidraRunLog(SCRIPT_ERROR_LOG);
  assert.equal(benignVerdict.scriptThrew, false);
  assert.equal(scriptErrorVerdict.scriptThrew, true);
});

test("ghidra-harness-gates LANGUAGE LINE: parsed byte-exactly and case-sensitively from both fixtures", () => {
  const benignVerdict = classifyGhidraRunLog(BENIGN_LOG);
  const scriptErrorVerdict = classifyGhidraRunLog(SCRIPT_ERROR_LOG);

  assert.equal(benignVerdict.language.present, true);
  assert.equal(scriptErrorVerdict.language.present, true);
  if (benignVerdict.language.present) {
    assert.equal(benignVerdict.language.id, "6502:LE:16:default");
  }
  if (scriptErrorVerdict.language.present) {
    assert.equal(scriptErrorVerdict.language.id, "6502:LE:16:default");
  }
});

test("ghidra-harness-gates LANGUAGE LINE: a differently-cased id is reported as a mismatch, not silently equal", () => {
  const verdict = classifyGhidraRunLog(SCRIPT_ERROR_LOG);
  assert.equal(verdict.language.present, true);
  if (verdict.language.present) {
    // Byte-exact, case-sensitive: comparing the REAL parsed id against a
    // differently-cased string must read as a mismatch, never an
    // accidental case-insensitive equality.
    assert.notEqual(verdict.language.id, "6502:le:16:default");
    assert.equal(verdict.language.id === "6502:le:16:default", false);
  }
});

test("ghidra-harness-gates LANGUAGE LINE: a log with no language line at all is reported as a named absence, never an empty-string match", () => {
  const noLanguageLog = "INFO  Some unrelated line (SomeComponent)\nINFO  Another line (SomeOtherComponent)\n";
  const verdict = classifyGhidraRunLog(noLanguageLog);
  assert.equal(verdict.language.present, false, "a log with no \"Using Language/Compiler:\" line must report a named absence");
  // TypeScript narrows `language` to `{ present: false }` here; there is no
  // `id` field to compare against an empty string, which is exactly the
  // point -- a missing signal is not representable as an empty match.
});

test("ghidra-harness-gates CLASSIFICATION MISMATCH: expected and observed counts are parsed and a mismatch is reported with both numbers named", () => {
  // A hand-built log excerpt matching the classifier's own generic
  // "expected...NNN" / "observed...NNN" labelled-number extraction
  // (ghidra-run.ts's CLASSIFICATION_EXPECTED_PATTERN / _OBSERVED_PATTERN),
  // deliberately with two DIFFERENT numbers so the mismatch has something
  // real to report. This is independent of the two committed run-log
  // fixtures, whose own real classification numbers happen to agree with
  // their block totals (the block-total assertion is the NORMAL, matching
  // path; a caller-planted override is what the script-error fixture
  // exercises instead -- see fixtures/ghidra/README.md).
  const mismatchExcerpt =
    "GhidraStructExport.java> CLASSIFICATION_EXPECTED_FROM_BLOCKS: 572 (GhidraScript)\n" +
    "GhidraStructExport.java> CLASSIFICATION_OBSERVED: 1 (GhidraScript)\n";
  const verdict = classifyGhidraRunLog(mismatchExcerpt);
  assert.equal(verdict.classification.present, true, "the classifier must parse both labelled numbers out of this excerpt");
  if (verdict.classification.present) {
    assert.equal(verdict.classification.expected, 572);
    assert.equal(verdict.classification.observed, 1);
    assert.notEqual(
      verdict.classification.expected,
      verdict.classification.observed,
      "a mismatch must be reported as a mismatch, with both numbers named",
    );
  }
});

test("ghidra-harness-gates CLASSIFICATION: the two committed fixtures' own real classification lines parse, when present, with expected equal to observed", () => {
  // The real script-error fixture's own printed lines (see
  // fixtures/ghidra/README.md) show the block-total computation succeeding
  // (expected-from-blocks == observed) BEFORE the script threw against a
  // caller-planted override -- so this fixture's own EXPECTED_FROM_BLOCKS
  // and OBSERVED numbers agree with each other; the mismatch that actually
  // caused the throw is against the override value, not printed under
  // these two labels. Both is a real, both-classifier-answerable shape.
  const verdict = classifyGhidraRunLog(SCRIPT_ERROR_LOG);
  assert.equal(verdict.classification.present, true, "the real script-error fixture carries printed CLASSIFICATION_EXPECTED_FROM_BLOCKS/OBSERVED lines the classifier must parse");
  if (verdict.classification.present) {
    assert.equal(verdict.classification.expected, verdict.classification.observed);
    assert.equal(verdict.classification.expected, 572);
  }
});
