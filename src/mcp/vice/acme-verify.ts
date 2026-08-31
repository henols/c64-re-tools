#!/usr/bin/env node
// acme-verify.ts -- the ONE place this package spawns a real ACME and turns
// its behaviour into a three-outcome verdict (EXPORT-03).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The project has a recorded false pass to refuse. A verification route ran,
// exited zero, and printed an aggregate summary line that read as a full pass
// -- while the one assembler the project actually cares about never ran at
// all. Three separate mechanisms conspired: the exit status was treated as the
// verdict, an aggregate summary line was trusted over the per-item detail
// beneath it, and a spawn that failed before exec was folded into "nothing
// went wrong". Each of those is cheap to reintroduce and none of them shows up
// as a red test, because all three produce green runs.
//
// So the verdict here is built the other way round. It is a byte-diff of a
// file THIS RUN created against bytes the caller derived from the image, and
// nothing else is allowed to reach `outcome`. The exit status is recorded for
// a human to read and consulted by nothing. The aggregate line is recorded and
// trusted by nothing. A spawn that never ran gets its own outcome that is
// neither a pass nor a byte-level failure, because no claim about the bytes
// exists when no assembler ran.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Turning "here is ACME source text and here are the bytes it must produce"
// into `"ok" | "failed" | "skipped"`. Every consumer in this phase branches on
// that outcome; none of them re-derives a verdict of its own from the fields
// beside it.
//
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only oracle has no business in the published npm tarball), and it
// must never be imported by a shipped module -- only by `*.test.ts` files.
// That placement is exactly what lets it `import { ACME_BIN }` from
// `acme-gate.ts` instead of carrying a second copy of the env-var name:
// `acme-gate.ts` asserts its own absence from `files[]`, so a SHIPPED verify
// module could not import it and would have had to resolve `ACME_BIN` itself.
// `acme-gate.ts`'s own header forbids that second copy by name -- a rename on
// either side would turn CI's hard FAIL into a silent SKIP with both sides
// still green.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs. It is imported BY test files and must
// never be collected as one: importing a `.test.ts` module for its exports
// also re-runs every top-level `node:test` registration in it as an import
// side effect, silently duplicating that file's execution.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never derive `outcome` from `exitStatus`. Measured on ACME 0.97: `lda
//     #$00` and `lda #$01` both assemble and both exit 0 while their bytes
//     differ. The exit status cannot see a wrong byte, so it cannot be the
//     verdict even when it is zero.
//   - Never trust the aggregate `Saving N (0xN) bytes (0xA - 0xB exclusive).`
//     line. It is structurally the same object as the summary line that lied
//     in the recorded false pass: one line asserting a whole run passed, above
//     per-item detail nobody read. The per-segment lines are the unanimity
//     subject; the aggregate is recorded and never consulted.
//   - Never use a fixed output path across invocations. Measured: ACME leaves
//     a PRE-EXISTING output file completely untouched when it fails (exit 1,
//     error printed, yesterday's correct bytes still on disk). A verify path
//     that assembles to `build/export.prg` and diffs it would report a pass
//     against bytes this run never produced. Hence a fresh
//     `mkdtempSync` per invocation, plus the requirement that the output path
//     was absent BEFORE the spawn: "did THIS run create it" is the property.
//   - Never build the command line as a single shell-interpreted string, and
//     never swap `spawnSync`'s argv-array form for any shell-spawning or
//     string-command variant of the child-process API. `ACME_BIN` is
//     externally supplied and reaches a process launch here; the argv-array
//     form is what keeps that boundary safe (T-30-01). This is grepped
//     mechanically, so the guard cannot rot.
//   - Never treat an ACME stderr Warning as a failure. ACME 0.97 documents
//     warnings for buggy-but-legal constructs (`jmp ($xxff)`, unstable
//     ANE/LXA) and for a raw-number operand under `-Wtype-mismatch`, all of
//     which assemble to exactly the right bytes. Only `Error` and `Serious
//     error` are fatal here.
//   - Never re-derive the ACME binary name from the environment in this file.
//     It is IMPORTED from `acme-gate.ts`, the one home of that name.
//   - Never name a local `binPath`, `viceBin`, `VICE_BIN` or `x64sc`.
//     `spawn-seam.test.ts` scans for exactly those four tokens and asserts an
//     exactly-one-entry set. Test-only placement means that scan cannot see
//     this module today; the rule costs nothing and survives a later decision
//     to ship it.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE DOES NOT CHECK
// ---------------------------------------------------------------------------
// Addresses that no caller-supplied segment covers. The caller builds
// `expectedBytes` from the image over the ranges it exported, with `$00` in
// the gaps between them -- which is exactly what ACME `-f plain` emits for
// those gaps (measured), so padding is never a false disagreement. But an
// export makes no claim about bytes outside its own blocks, and neither does
// this module. It also makes no claim about whether the caller's
// `expectedBytes` was honestly derived from the image rather than from its own
// output text; that is the caller's discipline, and it is what keeps this a
// round trip instead of a self-check.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ACME_BIN } from "./acme-gate.ts";

/** The three outcomes, and there are exactly three. `"skipped"` is NOT a
 * flavour of `"failed"` and is NOT a quiet `"ok"`: it means no assembler ran,
 * so no claim about the bytes exists. Consumers must branch on all three --
 * a skipped assembler must never be presented to a human as a pass on any
 * surface, not in a return value, not in a printed summary line, not in an
 * exit code. */
export type AcmeOutcome = "ok" | "failed" | "skipped";

/** What a spawn attempt turned out to be. Two values, and the distinction is
 * the whole content of the recorded false pass: `"unavailable"` means the
 * assembler NEVER RAN, `"ran"` means a process really executed and its result
 * -- whatever its exit status -- is a real observation about the source. */
export type SpawnClassification = "unavailable" | "ran";

/** The spawn fields a classifier may legitimately read. `signal` joined the
 * two originals on 2026-08-31 (30-REVIEW CR-03) because it is the ONE field
 * that separates "no process ever ran" from "a process ran and died", and it
 * was previously read nowhere in this module. A classifier still cannot reach
 * stdout, stderr or the output file. */
export interface SpawnShape {
  error?: unknown;
  status: number | null;
  signal?: NodeJS.Signals | null;
}

/** The shape of the classification decision, named so a test can drive the
 * SAME property predicate with a deliberately wrong implementation and watch it
 * report a pass. */
export type SpawnClassifier = (r: SpawnShape) => SpawnClassification;

/**
 * The ONE spawn classification in this module.
 *
 * A spawn is `"unavailable"` when it carries a spawn error OR has no exit
 * status at all -- both mean no process ever produced a result. Everything else
 * `"ran"`, including a non-zero exit: a process that ran and failed made a real
 * statement about the source, and the byte-diff is what judges it.
 *
 * MEASURED, ACME 0.97 on this host (RESEARCH.md Pitfall 2, four rows):
 * a working `acme` exits `0` with no error; the bare name `acme-does-not-exist`
 * yields no exit status at all with an `ENOENT` error; the absolute path
 * `/nonexistent/acme` yields the same shape; and a present-but-non-executable
 * file (`/etc/hostname`) yields no exit status with an `EACCES` error. The
 * historical rule took the exit status's TRUTHINESS as "nothing went wrong",
 * and for all three of the missing-binary rows that truthiness test evaluates
 * TRUE -- which is exactly how a missing assembler was scored as a pass. That
 * one recorded false pass is why this function exists and why nothing else in
 * this module decides availability.
 *
 * A PROCESS THAT RAN AND DIED IS `"ran"`, AND THAT IS 30-REVIEW CR-03's FIX
 * (2026-08-31). Both of the original disjuncts are satisfied by a run that
 * genuinely happened, so a CRASHED or TIMED-OUT ACME was scored
 * `"unavailable"` -> `"skipped"`, and the returned reason read `ACME never
 * ran: ...`. That statement was FALSE, and it is the exact category error
 * `SpawnClassification` and `AcmeOutcome` above are defined to prevent: a
 * crash or a hang is a real observation ABOUT THE SOURCE, not an absent
 * toolchain. A consumer that treats `"skipped"` as an environment condition
 * (which is the whole reason `"skipped"` exists as a third outcome) would
 * silently absorb a crashing assembler.
 *
 * MEASURED on this host, the two ran-and-died shapes:
 *
 *   spawnSync("/bin/sh", ["-c", "kill -SEGV $$"])
 *     -> status null, signal "SIGSEGV", error undefined
 *   spawnSync("/bin/sleep", ["5"], { timeout: 200 })
 *     -> status null, signal "SIGTERM", error ETIMEDOUT
 *
 * The crash row is caught by `signal`; the timeout row carries BOTH a signal
 * and an error, and is checked on `ETIMEDOUT` as well so the rule still reads
 * correctly if a future Node reports a timeout with no signal. Both then fall
 * through to the ordinary rules, where -- with no output file present -- rule
 * 5 already produces `"failed"` with an actionable message.
 *
 * ORDER MATTERS: the ran-and-died checks come FIRST, because the timeout row's
 * `error` would otherwise be consumed by the missing-binary disjunct below.
 */
export const classifySpawn: SpawnClassifier = (r) => {
  if (r.signal != null) return "ran";
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") return "ran";
  return r.error !== undefined || r.status === null ? "unavailable" : "ran";
};

/** A missing-binary spawn shape as MEASURED, not as imagined -- the three
 * missing-assembler rows of RESEARCH.md Pitfall 2's table, reproduced live on
 * this host against ACME 0.97. */
function measuredMissingBinarySpawn(code: string, syscallTarget: string): SpawnShape {
  const error = new Error(`spawnSync ${syscallTarget} ${code}`) as NodeJS.ErrnoException;
  error.code = code;
  return { error, status: null, signal: null };
}

/** The three measured missing-binary shapes, in the table's own order. */
const MEASURED_MISSING_BINARY_SPAWNS: readonly SpawnShape[] = Object.freeze([
  measuredMissingBinarySpawn("ENOENT", "acme-does-not-exist"),
  measuredMissingBinarySpawn("ENOENT", "/nonexistent/acme"),
  measuredMissingBinarySpawn("EACCES", "/etc/hostname"),
]);

/**
 * The two RAN-AND-DIED spawn shapes, as MEASURED on this host rather than as
 * imagined -- the sibling of `MEASURED_MISSING_BINARY_SPAWNS` above, added for
 * 30-REVIEW CR-03.
 *
 * These are the shapes `MEASURED_MISSING_BINARY_SPAWNS` could not see: it pins
 * only the three MISSING-BINARY rows, so `missingAssemblerIsNeverAPass()` was
 * green throughout the window in which a SIGSEGV'd ACME reported "ACME never
 * ran". Reproduced with `/bin/sh -c 'kill -SEGV $$'` and
 * `/bin/sleep 5` under a 200ms timeout; see `classifySpawn()`'s doc for the
 * measured field values.
 */
const MEASURED_RAN_AND_DIED_SPAWNS: readonly SpawnShape[] = Object.freeze([
  Object.freeze({ status: null, signal: "SIGSEGV" as NodeJS.Signals }),
  Object.freeze(
    (() => {
      const error = new Error("spawnSync /bin/sleep ETIMEDOUT") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";
      return { error, status: null, signal: "SIGTERM" as NodeJS.Signals };
    })(),
  ),
]);

/**
 * THE ONE PREDICATE: does `classify` refuse every measured missing-assembler
 * spawn shape?
 *
 * Both directions of the guard call THIS function -- the real check passes
 * `classifySpawn`, and the planted-violation control in `acme-verify.test.ts`
 * passes a locally-defined classifier implementing the historical
 * truthiness-of-exit-status rule. There is therefore exactly ONE definition of
 * the property "a missing assembler is never a pass", the way
 * `anno-cli-path-consumers.test.ts`'s `confinesAtLeast()` is the one definition
 * of "routes through the seam". A structural guard and its own proof that the
 * guard can bite must share the checked logic rather than each carry a copy:
 * two copies drift, and the copy that drifts is always the control, which then
 * silently stops being able to fail.
 */
export function missingAssemblerIsNeverAPass(classify: SpawnClassifier): boolean {
  return MEASURED_MISSING_BINARY_SPAWNS.every((shape) => classify(shape) === "unavailable");
}

/**
 * THE PAIRED PREDICATE: does `classify` recognise every measured ran-and-died
 * spawn shape as having RUN? (30-REVIEW CR-03.)
 *
 * `missingAssemblerIsNeverAPass()` above closes one direction -- an absent
 * assembler is never scored as a pass. This closes the other, which was open:
 * a CRASHED or TIMED-OUT assembler must never be scored as ABSENT. Both
 * failures are the same category error in opposite directions, and both are
 * expressed here as one predicate driven from both sides, for the same reason
 * stated above: two copies drift, and the copy that drifts is always the
 * control.
 *
 * A classifier that returned `"unavailable"` for these shapes reports "ACME
 * never ran" about a run that happened, which is the false statement
 * 30-REVIEW CR-03 reproduced against the committed code.
 */
export function deadAssemblerIsNeverASkip(classify: SpawnClassifier): boolean {
  return MEASURED_RAN_AND_DIED_SPAWNS.every((shape) => classify(shape) === "ran");
}

/** The verdict's actual basis: an octet-level comparison, never a string
 * comparison of decoded text. Every length and offset here is a BYTE count. */
export interface AcmeByteDiff {
  /** `true` only when both buffers have the same length and the same octets. */
  equal: boolean;
  /** Byte offset of the first differing octet, or -- when the buffers agree
   * over the shorter one's whole length but differ in length -- the shorter
   * length. `null` when they are equal. */
  firstDifferingOffset: number | null;
  /** Byte length of the caller's expected buffer. */
  expectedLength: number;
  /** Byte length of the file ACME wrote. */
  actualLength: number;
}

/** One assembled block, as the exporter emitted it. `endExclusive` is one past
 * the last byte -- ACME's `*` after a block sits there, and the annotation
 * store's own row shape uses an INCLUSIVE end, so the conversion is
 * `endExclusive = row.endInclusive + 1`. */
export interface AcmeExpectedSegment {
  start: number;
  endExclusive: number;
}

export interface AcmeVerifyOptions {
  /** The ACME source text to assemble. It reaches ACME only as file contents,
   * never as part of a command line. */
  source: string;
  /** The bytes the assembly must produce, built by the CALLER from the image
   * -- never from `source`. Deriving these from the exported text would make
   * the whole verdict a self-check wearing an oracle's clothes, and this
   * project's record is that an internally-verified opcode table still shipped
   * fourteen wrong entries. */
  expectedBytes: Uint8Array;
  /** The blocks the exporter emitted, checked against ACME's OWN per-segment
   * result lines.
   *
   * REQUIRED, deliberately. An earlier draft made this optional and skipped
   * the unanimity rule when it was omitted, recording the skip in `reason`.
   * That is refused: every consumer branches on `outcome`, so a caller could
   * obtain `"ok"` from a verdict that never ran one of its rules. Recording a
   * shortfall in a string while the field a human reads says `"ok"` is
   * structurally the same failure as trusting the aggregate line -- a pass
   * that quietly covers less than it appears to. Making the option required
   * moves the property from RECORDED to IMPOSSIBLE: the compiler rejects a
   * call site that omits it. */
  expectedSegments: readonly AcmeExpectedSegment[];
  /** ACME's output format. `"plain"` (the default) emits raw bytes with no
   * load address and zero-fills the gaps between blocks, which is what
   * `expectedBytes` is built to match. */
  format?: "plain" | "cbm";
  /** TEST-ONLY seam, defaulting to the IMPORTED `ACME_BIN`. Its only purpose
   * is to make the `"skipped"` outcome reachable in-process, without a child
   * `node --test`.
   *
   * The bound this seam carries is ACCURATE, not absolute. Nothing put behind
   * it can reach `"ok"` without producing the exact `expectedBytes` AND
   * per-segment result lines agreeing with `expectedSegments`, because rules
   * 8, 9 and 10 run against it unchanged. That stops short of a guarantee, and
   * this sentence is where it says so: a stand-in that WROTE the expected
   * bytes and emitted matching per-segment lines would reach rule 10 and be
   * scored `"ok"`. So this seam is not a substitute for a real assembler and
   * must never be pointed at one that writes bytes. The only two values it is
   * given anywhere in this phase are a path under a temp directory that was
   * never created, and `/bin/true` -- neither of which writes an output
   * file. */
  acmeBin?: string;
}

export interface AcmeVerifyResult {
  /** The verdict. Derived from the byte-diff and the per-segment agreement,
   * and from nothing else. */
  outcome: AcmeOutcome;
  /** The child's exit status, RECORDED SO A HUMAN CAN READ WHAT HAPPENED AND
   * NEVER CONSULTED FOR THE VERDICT. Assigned once, read by nothing in this
   * module. `null` when the child never ran or was killed by a signal. */
  exitStatus: number | null;
  /** ACME's own per-segment result lines, verbatim from stdout under `-v2`:
   * `Segment size is N (0xN) bytes (0xA - 0xB exclusive).` These ARE the
   * unanimity subject. */
  acmeResultLines: string[];
  /** The aggregate `Saving ...` lines from stdout. RECORDED AND NEVER
   * TRUSTED. More than one of them is a disagreement this module refuses to
   * resolve by picking. */
  aggregateLines: string[];
  /** ACME's stderr diagnostics, verbatim. Warnings are present here and never
   * fail the verdict. */
  diagnostics: string[];
  /** The octet comparison, or `null` when nothing was assembled and therefore
   * nothing can be reported as compared. */
  byteDiff: AcmeByteDiff | null;
  /** Why the outcome is what it is, in words a human can act on. */
  reason: string;
}

/**
 * ACME's argv flags, frozen. Deliberately EXCLUDES the binary token, the `-o`
 * output path and the source path, so the flag list has one named subject that
 * a test can compare against `src/skills/acme-build/scripts/acme.mjs`'s own
 * `args` array.
 *
 * The two constructions are a deliberate second implementation of the same
 * invocation: `src/mcp/vice/**` and `src/skills/**` publish as separate npm
 * packages and cannot import each other, so a shared module is not reachable
 * without inventing a third package for one flag array. `acme-verify.test.ts`
 * reads both lists off disk and goes red on any divergence beyond three
 * declared ones.
 */
export const ACME_VERIFY_ARGV_FLAGS: readonly string[] = Object.freeze([
  "--cpu",
  "6510",
  // The value after `-f` is substituted per invocation from
  // `AcmeVerifyOptions.format`; `"plain"` is the default and is what
  // `expectedBytes` is built against.
  "-f",
  "plain",
  // LOAD-BEARING, not decorative: measured, this is the flag that makes ACME
  // emit the `!addr` marker in the `-l` symbol file, without which the
  // sibling build driver's own symbol parser matches zero lines. It also
  // catches a missing `#` on an immediate.
  "-Wtype-mismatch",
  // Overlapping segments become an Error instead of a Warning -- a store with
  // overlapping ranges would otherwise silently overwrite itself.
  "--strict-segments",
  // Machine-parseable diagnostics: `file(line) : Severity (Zone <z>): text`.
  "--msvc",
  // `-v2` in place of the build driver's `-v1`: v2 adds the PER-SEGMENT
  // result lines, which are the unanimity subject. v1 emits only the
  // aggregate `Saving ...` line, which this module refuses to trust.
  "-v2",
]);

/** The flag whose following token carries the output format. */
const FORMAT_FLAG = "-f";

/** ACME's `--msvc` diagnostic shape, the SAME regex the sibling build driver
 * carries at `src/skills/acme-build/scripts/acme.mjs`:
 * `file(line) : Error (Zone <z>): message`.
 *
 * This is a DELIBERATE second implementation of one shape, for exactly the
 * reason `ACME_VERIFY_ARGV_FLAGS` is (see plan 30-01's assumption-delta
 * decision): `src/mcp/vice/**` and `src/skills/**` publish as separate npm
 * packages that cannot import each other, so a shared module is not reachable
 * without inventing a third package for one regex. The accepted cost is that
 * the two can drift; the argv-agreement test in `acme-verify.test.ts` is the
 * pattern for holding two such constructions together. */
const MSVC = /^(.*?)\((\d+)\)\s*:\s*(Error|Warning|Serious error)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

/** ACME's non-`--msvc` diagnostic spelling, kept as a safety net in case a
 * build ever ignores `--msvc`, measured verbatim:
 * `Error - File dup.a, line 4 (Zone <untitled>): Symbol already defined.` */
const BARE_DIAGNOSTIC = /^(Serious error|Error|Warning) - File (.*?), line (\d+)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

/** The last-resort severity sniff: any stderr line OPENING with one of ACME's
 * three severity words, in a shape neither regex above recognises. Such a line
 * still carries its severity, and dropping it would silently downgrade a real
 * error into "no diagnostics were reported". `Serious error` is listed first so
 * the alternation cannot match its `Error` suffix by itself. */
const BARE_SEVERITY = /^(Serious error|Error|Warning)\b/;

/** ACME's own per-segment result line under `-v2`, on STDOUT. The hex extents
 * are NOT zero-padded (`0x801`, not `0x0801`), so the capture is
 * variable-width. The leading decimal is the byte SIZE, captured because it is
 * ACME's own statement of how much it emitted. */
const SEGMENT_LINE = /^Segment size is (\d+) \(0x[0-9a-fA-F]+\) bytes \(0x([0-9a-fA-F]+) - 0x([0-9a-fA-F]+) exclusive\)\.\s*$/;

/** The aggregate line. Recorded, never trusted. */
const AGGREGATE_LINE = /^Saving \d+ \(0x[0-9a-fA-F]+\) bytes \(0x[0-9a-fA-F]+ - 0x[0-9a-fA-F]+ exclusive\)\.\s*$/;

/** One of ACME's OWN per-segment result lines, parsed. `endExclusive` is one
 * past the last byte, exactly as ACME prints it. */
export interface AcmeSegmentLine {
  /** First address the segment covers. */
  start: number;
  /** One past the last address the segment covers. */
  endExclusive: number;
  /** The byte count ACME itself printed, RECORDED rather than recomputed from
   * the extents: a disagreement between the two is ACME contradicting itself
   * and belongs in the evidence, not silently normalised away. */
  size: number;
  /** The line verbatim, so a human reads what ACME actually printed. */
  raw: string;
}

/** One of ACME's diagnostics, parsed. Severity carries ACME's OWN three
 * spellings rather than a normalised lowercase form, so a reader of this record
 * sees the word ACME printed. */
export interface AcmeDiagnostic {
  /** The source file ACME named, or `""` when the line's shape did not carry
   * one (the last-resort severity sniff). */
  file: string;
  /** The 1-based source line ACME named, or `0` when the shape carried none. */
  line: number;
  severity: "Error" | "Warning" | "Serious error";
  /** ACME's zone, e.g. `Zone <untitled>`, or `""` when absent. */
  zone: string;
  /** The diagnostic text after the final colon, or the whole line under the
   * last-resort sniff. */
  message: string;
  /** The line verbatim. */
  raw: string;
}

/**
 * VERDICT RULE 1 of five: ACME's OWN per-segment result lines are READ OFF
 * STDOUT, never inferred from anything this module already believes.
 *
 * These lines are the unanimity subject. Under `-v2` ACME prints one per block
 * it emitted, stating where the block starts and where it ends -- its own
 * account of what it did, independent of the exporter's account of what it
 * asked for. Comparing two independent accounts is the only reason the
 * unanimity rule means anything; deriving one from the other would make it a
 * self-check.
 *
 * Measured (RESEARCH.md Pitfall 10): these are on STDOUT, while every
 * diagnostic is on STDERR. A verdict that reads only one stream is blind to
 * half the evidence.
 */
export function parseAcmeResultLines(stdout: string): AcmeSegmentLine[] {
  const out: AcmeSegmentLine[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();
    const m = line.match(SEGMENT_LINE);
    if (m === null) continue;
    out.push({
      start: Number.parseInt(m[2]!, 16),
      endExclusive: Number.parseInt(m[3]!, 16),
      size: Number.parseInt(m[1]!, 10),
      raw: line,
    });
  }
  return out;
}

/**
 * VERDICT RULE 2 of five: the aggregate is RECORDED AND NEVER TRUSTED.
 *
 * `Saving N (0xN) bytes (0xA - 0xB exclusive).` is one line asserting something
 * about a whole run, sitting above per-item detail nobody read. That is
 * structurally the SAME OBJECT as the `All roundtrip verifications passed.`
 * line that lied in the carried false-pass trap, where it read as a full pass
 * while the one assembler that mattered never ran. This function's whole
 * contract is therefore to hand the lines to a human and to no rule: nothing in
 * the verdict consults its return value except rule 3, which uses only HOW MANY
 * there are and never what any of them says.
 */
export function parseAcmeAggregateLines(stdout: string): string[] {
  const out: string[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();
    if (AGGREGATE_LINE.test(line)) out.push(line);
  }
  return out;
}

/**
 * VERDICT RULE 3 of five: two authoritative lines that disagree are REFUSED,
 * never resolved by picking one.
 *
 * Returns a reason string when more than one aggregate line is present, and
 * `undefined` for zero or one. Picking -- the first, the last, the largest --
 * would mean this module inventing an answer ACME did not give, which is how a
 * verdict layer starts making claims of its own.
 */
export function refuseOnCompetingAggregates(aggregateLines: readonly string[]): string | undefined {
  if (aggregateLines.length <= 1) return undefined;
  return (
    `ACME emitted ${aggregateLines.length} aggregate "Saving ..." lines that do not agree on one extent ` +
    `(${aggregateLines.map((l) => JSON.stringify(l)).join(", ")}). This module refuses to pick between competing ` +
    `authoritative lines, so the verdict is a refusal rather than a guess.`
  );
}

/**
 * VERDICT RULE 4 of five: UNANIMITY against the exporter's own blocks, with the
 * FIRST disagreement driving the verdict.
 *
 * Returns a reason string naming the first index whose parsed extents differ
 * from the expected segment (or naming a COUNT disagreement, which is the
 * degenerate case of the same property), and `undefined` when every pair
 * agrees. It runs on every verdict: `expectedSegments` is a REQUIRED option
 * (D30-06), so there is no call site that can reach `"ok"` with this rule
 * unrun.
 *
 * A passing earlier line must never hide a later failing one, which is why this
 * walks every pair rather than stopping at the first agreement.
 */
export function firstResultLineDisagreement(
  parsed: readonly AcmeSegmentLine[],
  expected: readonly { start: number; endExclusive: number }[]
): string | undefined {
  if (expected.length !== parsed.length) {
    return (
      `ACME's own per-segment result lines disagree with the exporter's blocks in COUNT: ` +
      `${expected.length} block(s) expected, ${parsed.length} per-segment result line(s) parsed from stdout. ` +
      `The unanimity rule runs on every verdict, so this disagreement is never skipped.`
    );
  }
  for (let i = 0; i < expected.length; i++) {
    const want = expected[i]!;
    const got = parsed[i]!;
    if (want.start !== got.start || want.endExclusive !== got.endExclusive) {
      return (
        `ACME's own per-segment result line ${i} disagrees with the exporter's block ${i}: ` +
        `expected ${hex(want.start)}..${hex(want.endExclusive)} (exclusive), ` +
        `ACME reported ${hex(got.start)}..${hex(got.endExclusive)} (exclusive). ` +
        `The FIRST mismatch drives the verdict.`
      );
    }
  }
  return undefined;
}

/**
 * VERDICT RULE 5 of five: only `Error` and `Serious error` are fatal -- a
 * `Warning` NEVER fails the verdict.
 *
 * Measured on ACME 0.97: warnings are emitted for buggy-but-legal constructs
 * (`jmp ($xxff)`, unstable ANE/LXA) and for a raw-number operand under
 * `-Wtype-mismatch`, all of which assemble to exactly the right bytes. The
 * tracer's own `sta $d020` trips that last one and must still come back `"ok"`.
 * Treating a warning as fatal would make a byte-correct export fail; treating
 * an error as non-fatal would let a run that never produced bytes reach the
 * byte-diff.
 *
 * Three shapes are recognised, most specific first: ACME's `--msvc` form, its
 * default `Error - File f, line N (...)` form (a safety net in case a build
 * ever ignores `--msvc`), and a last-resort severity sniff for any line opening
 * with one of the three severity words. A line matching none of them carries no
 * severity and is not a diagnostic; `AcmeVerifyResult.diagnostics` records
 * every stderr line regardless, so nothing is lost to a human reader.
 */
export function parseAcmeDiagnostics(stderr: string): AcmeDiagnostic[] {
  const out: AcmeDiagnostic[] = [];
  for (const rawLine of stderr.split("\n")) {
    const raw = rawLine.trimEnd();
    if (!raw.trim()) continue;

    const msvc = raw.match(MSVC);
    if (msvc !== null) {
      out.push({
        file: msvc[1]!,
        line: Number.parseInt(msvc[2]!, 10),
        severity: msvc[3] as AcmeDiagnostic["severity"],
        zone: msvc[4] ?? "",
        message: msvc[5]!,
        raw,
      });
      continue;
    }

    const bare = raw.match(BARE_DIAGNOSTIC);
    if (bare !== null) {
      out.push({
        file: bare[2]!,
        line: Number.parseInt(bare[3]!, 10),
        severity: bare[1] as AcmeDiagnostic["severity"],
        zone: bare[4] ?? "",
        message: bare[5]!,
        raw,
      });
      continue;
    }

    const sniff = raw.trim().match(BARE_SEVERITY);
    if (sniff !== null) {
      out.push({
        file: "",
        line: 0,
        severity: sniff[1] as AcmeDiagnostic["severity"],
        zone: "",
        message: raw.trim(),
        raw,
      });
    }
  }
  return out;
}

/** Whether a parsed diagnostic stops the verdict. Rule 5's other half, kept
 * beside it: exactly the two error spellings, and never `Warning`. */
function isFatal(d: AcmeDiagnostic): boolean {
  return d.severity !== "Warning";
}

/** Every non-empty stderr line, verbatim. This is what
 * `AcmeVerifyResult.diagnostics` records -- deliberately WIDER than
 * `parseAcmeDiagnostics()`'s structured subset, so a line whose shape this
 * module does not recognise still reaches the human reading the result. */
function stderrLines(stderr: string): string[] {
  const out: string[] = [];
  for (const rawLine of stderr.split("\n")) {
    const raw = rawLine.trimEnd();
    if (raw.trim()) out.push(raw);
  }
  return out;
}

function hex(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Builds the full argv. Always an ARRAY -- never a shell string (T-30-01). */
function buildArgv(format: "plain" | "cbm", outPath: string, srcPath: string): string[] {
  const flags = [...ACME_VERIFY_ARGV_FLAGS];
  const formatIndex = flags.indexOf(FORMAT_FLAG);
  if (formatIndex >= 0 && formatIndex + 1 < flags.length) flags[formatIndex + 1] = format;
  return [...flags, "-o", outPath, srcPath];
}

function compareBytes(expected: Buffer, actual: Buffer): AcmeByteDiff {
  const shared = Math.min(expected.length, actual.length);
  let firstDifferingOffset: number | null = null;
  for (let i = 0; i < shared; i++) {
    if (expected[i] !== actual[i]) {
      firstDifferingOffset = i;
      break;
    }
  }
  const equal = Buffer.compare(expected, actual) === 0;
  if (!equal && firstDifferingOffset === null) firstDifferingOffset = shared;
  return {
    equal,
    firstDifferingOffset: equal ? null : firstDifferingOffset,
    expectedLength: expected.length,
    actualLength: actual.length,
  };
}

/**
 * Assembles `options.source` with a real ACME and returns a three-outcome
 * verdict settled by a byte-diff.
 *
 * REASON PRECEDENCE -- the order the rules run, and therefore which refusal
 * wins when several apply:
 *
 *   1. `classifySpawn()` reports `"unavailable"` -- the spawn never ran =>
 *      `"skipped"`. Reached before any exit-status arithmetic exists.
 *   2. ACME reported an `Error` or `Serious error` => `"failed"`, quoting the
 *      FIRST such diagnostic verbatim. ACME's own words about why it stopped
 *      are more use to a human than the downstream consequence, which is why
 *      this wins over rule 4's absent output file.
 *   3. More than one aggregate `Saving ...` line => `"failed"`, naming the
 *      disagreement. The module refuses to pick between competing
 *      authoritative lines.
 *   4. ACME's per-segment result lines disagree with `expectedSegments` (in
 *      count, or in the start/exclusive-end of any pair) => `"failed"`, naming
 *      the FIRST mismatch. Runs unconditionally: `expectedSegments` is
 *      required, so there is no omitted case.
 *   5. No output file exists after the spawn => `"failed"`.
 *   6. The output file's bytes equal `expectedBytes` AND the path was absent
 *      before the spawn => `"ok"`. Anything else => `"failed"`, naming the
 *      first differing byte offset and both lengths.
 *
 * Every failing path leaves `byteDiff` `null` except rule 6's: nothing was
 * read, so nothing can be reported as compared.
 */
export function verifyAcmeAssembles(options: AcmeVerifyOptions): AcmeVerifyResult {
  const format = options.format ?? "plain";
  const assemblerBin = options.acmeBin ?? ACME_BIN;

  // A FRESH directory per invocation. This is what makes the verdict
  // reproducible and makes two concurrent invocations independent: no output
  // path is ever shared, so a second run cannot read a first run's bytes.
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-"));
  try {
    const srcPath = join(dir, "export.a");
    const outPath = join(dir, "export.bin");
    writeFileSync(srcPath, options.source, "utf8");

    // "Did THIS run create it" is the property, not "does a file exist".
    const absentBeforeSpawn = existsSync(outPath) === false;

    const r = spawnSync(assemblerBin, buildArgv(format, outPath, srcPath), {
      encoding: "utf8",
      timeout: 30_000,
    });

    // Assigned ONCE. Read by nothing below.
    const exitStatus: number | null = r.status;

    // Rule 1, through the ONE classifier. Nothing else in this module decides
    // availability, and nothing below reads the exit status for any purpose.
    if (classifySpawn(r) === "unavailable") {
      const code = r.error !== undefined ? ((r.error as NodeJS.ErrnoException).code ?? r.error.name) : "no exit status";
      return {
        outcome: "skipped",
        exitStatus,
        acmeResultLines: [],
        aggregateLines: [],
        diagnostics: [],
        byteDiff: null,
        reason:
          `ACME never ran: spawning ${JSON.stringify(assemblerBin)} failed with ${code}. ` +
          `No assembler ran, so no claim about the bytes exists -- this is "skipped", which is neither a pass nor a byte-level failure.`,
      };
    }

    // Every rule below is one of the five named pure helpers above, called in
    // the documented precedence order. The body decides NOTHING itself: each
    // rule has its own name, its own JSDoc stating which property it carries,
    // and its own test driving it directly with real ACME output.
    const stdout = r.stdout ?? "";
    const segmentLines = parseAcmeResultLines(stdout);
    const aggregateLines = parseAcmeAggregateLines(stdout);
    const acmeResultLines = segmentLines.map((s) => s.raw);

    const parsed = parseAcmeDiagnostics(r.stderr ?? "");
    const diagnostics = stderrLines(r.stderr ?? "");

    const expected = options.expectedSegments;
    const base = { exitStatus, acmeResultLines, aggregateLines, diagnostics, byteDiff: null } as const;

    // Rule 2 (verdict rule 5 of the five): ACME's own errors win. Warnings never fail.
    const firstFatal = parsed.find(isFatal);
    if (firstFatal !== undefined) {
      return {
        ...base,
        outcome: "failed",
        reason: `ACME reported a fatal diagnostic: ${firstFatal.raw}`,
      };
    }

    // Rule 3 (verdict rule 3 of the five): competing authoritative aggregates. Refuse to guess.
    const competing = refuseOnCompetingAggregates(aggregateLines);
    if (competing !== undefined) {
      return { ...base, outcome: "failed", reason: competing };
    }

    // Rule 4 (verdict rules 1 and 4 of the five): unanimity against the
    // exporter's own blocks, over ACME's own parsed result lines. Unconditional.
    const disagreement = firstResultLineDisagreement(segmentLines, expected);
    if (disagreement !== undefined) {
      return { ...base, outcome: "failed", reason: disagreement };
    }

    // Rule 5: no output file at all.
    if (existsSync(outPath) === false) {
      return {
        ...base,
        outcome: "failed",
        reason:
          `ACME produced no output file at ${JSON.stringify(outPath)}. ` +
          `A pre-existing output file is left UNTOUCHED by a failing ACME run, which is why this module ` +
          `assembles into a fresh directory every time and requires the path to have been absent before the spawn.`,
      };
    }

    // Rule 6: the byte-diff IS the verdict.
    const actual = readFileSync(outPath);
    const byteDiff = compareBytes(Buffer.from(options.expectedBytes), actual);
    if (byteDiff.equal && absentBeforeSpawn) {
      return {
        exitStatus,
        acmeResultLines,
        aggregateLines,
        diagnostics,
        byteDiff,
        outcome: "ok",
        reason:
          `the output file this run created is byte-identical to the expected bytes ` +
          `(${byteDiff.actualLength} byte(s) across ${expected.length} segment(s)).`,
      };
    }
    return {
      exitStatus,
      acmeResultLines,
      aggregateLines,
      diagnostics,
      byteDiff,
      outcome: "failed",
      reason: absentBeforeSpawn
        ? `assembled bytes differ from the expected bytes: first differing byte offset ${String(byteDiff.firstDifferingOffset)}, ` +
          `expected length ${byteDiff.expectedLength}, actual length ${byteDiff.actualLength}.`
        : `the output path was ALREADY PRESENT before the spawn, so these bytes cannot be attributed to this run ` +
          `(expected length ${byteDiff.expectedLength}, actual length ${byteDiff.actualLength}).`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
