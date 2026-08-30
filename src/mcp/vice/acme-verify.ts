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

/** ACME's `--msvc` diagnostic shape, the same regex the sibling build driver
 * uses: `file(line) : Error (Zone <z>): message`. */
const MSVC = /^(.*?)\((\d+)\)\s*:\s*(Error|Warning|Serious error)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

/** ACME's own per-segment result line under `-v2`, on STDOUT. The hex extents
 * are NOT zero-padded (`0x801`, not `0x0801`), so the capture is
 * variable-width. */
const SEGMENT_LINE = /^Segment size is \d+ \(0x[0-9a-fA-F]+\) bytes \(0x([0-9a-fA-F]+) - 0x([0-9a-fA-F]+) exclusive\)\.\s*$/;

/** The aggregate line. Recorded, never trusted. */
const AGGREGATE_LINE = /^Saving \d+ \(0x[0-9a-fA-F]+\) bytes \(0x[0-9a-fA-F]+ - 0x[0-9a-fA-F]+ exclusive\)\.\s*$/;

/** ACME's non-`--msvc` error spelling, kept as a safety net in case a build
 * ever ignores `--msvc`: `Error - File dup.a, line 4 (Zone <untitled>): ...` */
const BARE_SEVERITY = /^(Serious error|Error)\b/;

type DiagnosticSeverity = "error" | "serious_error" | "warning" | "note";

interface ParsedDiagnostic {
  text: string;
  severity: DiagnosticSeverity;
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

function parseDiagnostics(stderrText: string): ParsedDiagnostic[] {
  const out: ParsedDiagnostic[] = [];
  for (const raw of stderrText.split("\n")) {
    const text = raw.trimEnd();
    if (!text.trim()) continue;
    const m = text.match(MSVC);
    if (m) {
      const severity = m[3]!.toLowerCase().replace(" ", "_") as DiagnosticSeverity;
      out.push({ text, severity });
      continue;
    }
    out.push({ text, severity: BARE_SEVERITY.test(text.trim()) ? "error" : "note" });
  }
  return out;
}

function isFatal(d: ParsedDiagnostic): boolean {
  return d.severity === "error" || d.severity === "serious_error";
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
 *   1. The spawn never ran (`r.error` set, or `r.status === null`) => `"skipped"`.
 *      Reached before any exit-status arithmetic exists.
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

    if (r.error !== undefined || r.status === null) {
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

    const stdoutLines = (r.stdout ?? "").split("\n").map((l) => l.trimEnd());
    const segmentMatches: { line: string; start: number; endExclusive: number }[] = [];
    const aggregateLines: string[] = [];
    for (const line of stdoutLines) {
      const seg = line.match(SEGMENT_LINE);
      if (seg) {
        segmentMatches.push({
          line,
          start: Number.parseInt(seg[1]!, 16),
          endExclusive: Number.parseInt(seg[2]!, 16),
        });
        continue;
      }
      if (AGGREGATE_LINE.test(line)) aggregateLines.push(line);
    }
    const acmeResultLines = segmentMatches.map((s) => s.line);

    const parsed = parseDiagnostics(r.stderr ?? "");
    const diagnostics = parsed.map((d) => d.text);

    const base = { exitStatus, acmeResultLines, aggregateLines, diagnostics, byteDiff: null } as const;

    // Rule 2: ACME's own errors win. Warnings never fail.
    const firstFatal = parsed.find(isFatal);
    if (firstFatal !== undefined) {
      return {
        ...base,
        outcome: "failed",
        reason: `ACME reported a fatal diagnostic: ${firstFatal.text}`,
      };
    }

    // Rule 3: competing authoritative aggregates. Refuse to guess.
    if (aggregateLines.length > 1) {
      return {
        ...base,
        outcome: "failed",
        reason:
          `ACME emitted ${aggregateLines.length} aggregate "Saving ..." lines that do not agree on one extent ` +
          `(${aggregateLines.map((l) => JSON.stringify(l)).join(", ")}). This module refuses to pick between competing ` +
          `authoritative lines, so the verdict is a refusal rather than a guess.`,
      };
    }

    // Rule 4: unanimity against the exporter's own blocks. Unconditional.
    const expected = options.expectedSegments;
    if (expected.length !== segmentMatches.length) {
      return {
        ...base,
        outcome: "failed",
        reason:
          `ACME's own per-segment result lines disagree with the exporter's blocks in COUNT: ` +
          `${expected.length} block(s) expected, ${segmentMatches.length} per-segment result line(s) parsed from stdout. ` +
          `The unanimity rule runs on every verdict, so this disagreement is never skipped.`,
      };
    }
    for (let i = 0; i < expected.length; i++) {
      const want = expected[i]!;
      const got = segmentMatches[i]!;
      if (want.start !== got.start || want.endExclusive !== got.endExclusive) {
        return {
          ...base,
          outcome: "failed",
          reason:
            `ACME's own per-segment result line ${i} disagrees with the exporter's block ${i}: ` +
            `expected ${hex(want.start)}..${hex(want.endExclusive)} (exclusive), ` +
            `ACME reported ${hex(got.start)}..${hex(got.endExclusive)} (exclusive). ` +
            `The FIRST mismatch drives the verdict.`,
        };
      }
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
