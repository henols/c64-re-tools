// acme-verify.test.ts
//
// WHY THIS FILE EXISTS: `acme-verify.ts` exists to refuse a specific recorded
// false pass -- an exit-zero assembler run whose aggregate summary line read as
// a full pass while the one assembler the project cares about never ran. A
// module that refuses that shape is worthless unless the refusal is observed on
// every suite run, because a verdict layer that silently degrades back into
// "ACME exited 0, so it passed" produces a green run too. This file is where
// the three outcomes are observed rather than asserted about.
//
// THE THIRD OUTCOME IS PROVED HERE, IN PROCESS, THROUGH THE `acmeBin` SEAM.
// `verifyAcmeAssembles()` takes an optional `acmeBin` whose only purpose is to
// make `"skipped"` reachable without a child `node --test`. Pointed at a path
// that was never created, `spawnSync` reports `ENOENT` and the verdict must be
// `"skipped"` -- never `"ok"` (the truthiness hole: `!r.status` is `true` for a
// spawn that never ran) and never silently folded into `"failed"`.
//
// TWO DIRECTIONS, NOT ONE. A control that only ever refuses is indistinguishable
// from one that refuses everything. So the same call is repeated against
// `/bin/true` -- a binary that spawns cleanly, prints nothing and writes nothing
// -- and must come back `"failed"`, not `"skipped"`. That single assertion
// carries two proofs at once: `"skipped"` is reachable only from a spawn that
// did NOT run, and the unanimity rule ran without being asked to (one expected
// segment against zero parsed result lines is rule 8 firing ahead of rule 9's
// absent output file, under the reason precedence `verifyAcmeAssembles()`
// documents).
//
// WHAT THIS FILE DOES NOT PROVE: the `ACME_BIN` *environment variable* boundary.
// `ACME_BIN` and `ACME_AVAILABLE` are module-load `const`s in `acme-gate.ts`, so
// only a child process can move them; that observation belongs to the mandatory-red
// harness in a later plan of this phase, not here. The `acmeBin` option is an
// in-process seam, deliberately NOT a second way to reach a real assembler.
//
// COST, STATED RATHER THAN SMUGGLED: as of this task, ONE child process per suite
// run (a `/bin/true` spawn), well under a tenth of a second, plus one spawn that
// fails before exec. A later task in this plan adds the end-to-end tracer, which
// spawns a real ACME and moves both numbers -- update this paragraph then rather
// than leaving it quietly wrong.
//
// This file is deliberately never added to `MANUAL_ONLY_TESTS`: `test-gate.mjs`'s
// `automatedTestFiles()` auto-discovers every on-disk `*.test.*`, and
// `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { verifyAcmeAssembles, type AcmeOutcome } from "./acme-verify.ts";

/** Computed exactly ONCE, by the shared `acme-gate.ts` seam. Every
 * ACME-dependent test in this file passes this through node:test's own
 * `{ skip }` option -- never a hand-rolled `if (!SKIP_REASON) return`, which
 * reports a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = acmeSkipReasonFor("acme-verify.test.ts");

test("ACME availability gate (never skipped)", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// A trivial one-segment subject, shared by the two seam tests below. Neither
// needs a real assembler: one never execs, the other execs a binary that emits
// nothing.
// ---------------------------------------------------------------------------

/** `lda #$00` / `rts` at $0801 -- three bytes, one segment, $0801..$0804. */
const TRIVIAL_SOURCE = ["!cpu 6510", "* = $0801", "\tlda #$00", "\trts", ""].join("\n");
const TRIVIAL_BYTES = new Uint8Array([0xa9, 0x00, 0x60]);
const TRIVIAL_SEGMENTS = [{ start: 0x0801, endExclusive: 0x0804 }] as const;

test("a spawn that never ran is `skipped`, never `ok` -- the ENOENT direction", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-skip-"));
  try {
    // Inside a directory that DOES exist, at a path that was never created:
    // `spawnSync` reports ENOENT with `status === null`, which is exactly the
    // `!r.status` truthiness hole the three-outcome verdict exists to close.
    const missingBinary = join(dir, "definitely-not-acme");
    assert.equal(existsSync(missingBinary), false, "the probe binary must not exist for this test to mean anything");

    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: missingBinary,
    });

    assert.equal(
      verdict.outcome,
      "skipped",
      `a spawn that never ran must be "skipped"; got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "ok",
      "a spawn that never ran must NEVER read as a pass -- that is the exact false-pass shape this module exists against"
    );
    assert.equal(verdict.byteDiff, null, "nothing was assembled, so nothing can be reported as compared");
    assert.ok(
      verdict.reason.includes(missingBinary),
      `the reason must name the binary that was attempted so a human can see WHICH assembler was missing; got ${JSON.stringify(verdict.reason)}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "a spawn that DID run but emitted nothing is `failed`, not `skipped` -- the paired direction",
  { skip: existsSync("/bin/true") ? false : "no /bin/true on this host" },
  () => {
    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: "/bin/true",
    });

    assert.equal(
      verdict.outcome,
      "failed",
      `/bin/true spawns cleanly, prints nothing and writes nothing -- that is a FAILED verification, not a skipped one; ` +
        `got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "skipped",
      "`skipped` must be reachable ONLY from a spawn that did not run; a clean exec that produced nothing is a real failure"
    );
    // Rule 8 (unanimity against the exporter's blocks) fires ahead of rule 9
    // (absent output file) under the documented reason precedence. Asserting
    // THIS reason rather than the absent-file one is what proves the unanimity
    // rule is unconditional: `expectedSegments` is a REQUIRED option and no
    // code path can skip it, so a verdict can never return `ok` with that rule
    // unrun (D30-06).
    assert.match(
      verdict.reason,
      /per-segment result line/i,
      `the reason must name the segment-count disagreement (1 expected block against 0 parsed result lines), which doubles as ` +
        `the proof that the unanimity rule ran unconditionally; got ${JSON.stringify(verdict.reason)}`
    );
    assert.match(
      verdict.reason,
      /\b1\b[\s\S]*\b0\b/,
      `the reason must state BOTH counts -- one expected block, zero parsed lines; got ${JSON.stringify(verdict.reason)}`
    );
    assert.equal(verdict.byteDiff, null, "no output file was read, so nothing can be reported as compared");
  }
);

// ---------------------------------------------------------------------------
// The arity of `AcmeOutcome` is proved by the COMPILER, not by a text grep.
// This switch is exhaustive with no `default` branch: adding a fourth member to
// the union leaves `outcome` un-narrowed at the assignment below, and
// `npm run typecheck` stops passing. A grep for the union's declaration would
// pass on a fourth member appended anywhere else.
// ---------------------------------------------------------------------------

function describeOutcome(outcome: AcmeOutcome): string {
  switch (outcome) {
    case "ok":
      return "the output file this run created is byte-identical to the expected bytes";
    case "failed":
      return "ACME ran and the result disagreed with the expected bytes or segments";
    case "skipped":
      return "ACME never ran, so no verdict about the bytes exists";
  }
  const exhaustive: never = outcome;
  return exhaustive;
}

test("AcmeOutcome has exactly three members (proved by the exhaustive switch above typechecking)", () => {
  assert.equal(describeOutcome("ok").length > 0, true);
  assert.equal(describeOutcome("failed").length > 0, true);
  assert.equal(describeOutcome("skipped").length > 0, true);
  assert.notEqual(
    describeOutcome("skipped"),
    describeOutcome("ok"),
    "`skipped` and `ok` must not describe the same thing -- a skipped assembler is not a pass on any surface"
  );
  assert.equal(SKIP_REASON === false || typeof SKIP_REASON === "string", true);
});
