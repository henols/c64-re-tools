#!/usr/bin/env node
// r2000-verify.ts -- the ONE place that interprets regenerator2000's
// `--verify` output.
//
// WHY PARSING IS REQUIRED AT ALL (D-10, the concrete incident): with ACME
// absent from PATH and ca65 present, a real `regenerator2000 0.9.20 --verify`
// run on this host printed
//
//   ✗ ACME — ACME not found in PATH (skipped)
//   ✓ All roundtrip verifications passed.
//   EXIT=0
//
// -- exit 0, and a summary line that reads as a full pass, while the one
// assembler this project actually cares about (`!cpu 6510`, ACME 0.97) never
// ran at all. Trusting the exit code here would let ACME be silently
// skipped and still report success. This is the WHAT-NOT-TO-DO for any
// future edit to this file: never derive `ok` from `status`, ever, no
// matter how tempting a bare zero-exit-status check looks. The verdict this
// module produces comes ONLY from parsing the per-assembler result lines
// and reading ACME's own line -- never from the process exit code, and
// never from the aggregate "All roundtrip verifications passed." summary
// line, which is itself the thing that lied in the transcript above.
//
// Both captured transcripts (the honest pass and this exact false-pass trap)
// are pinned verbatim as fixtures in r2000-verify.test.ts, so a future
// "simplification" back to an exit-code check fails a unit test immediately.
//
// WR-04 (10-REVIEW.md, fixed in plan 11-01): the verdict must also never
// trust just the FIRST ACME result line. `acmeVerdict()` used to select
// ACME's line with a bare array .find() over the first matching entry, so
// a transcript containing both a
// passing and a failing ACME line (a shape --verify has never printed as of
// 0.9.20, but one this defensive parser is explicitly meant to survive)
// reported `ok: true` from the first (passing) line while discarding the
// later failure -- exactly the "misleading success" this module exists to
// refuse. The fix requires UNANIMITY: every parsed ACME line must be `ok`,
// the first non-ok line (if any) drives the verdict, and if more than one
// ACME line is present after passing that check, the module refuses to
// guess which one is authoritative rather than picking one arbitrarily.
// Both the mixed-transcript case and the too-many-ACME-lines case are pinned
// verbatim as fixtures in r2000-verify.test.ts.
//
// Import nothing from `hostpath.ts`/`containerpath.ts` -- plan 10-01's
// absence assertion in `hostpath-consumers.test.ts` already names this file.

import { buildVerifyArgs, runR2000 } from "./r2000-launch.ts";

/** The three possible outcomes for a single per-assembler `--verify` result
 * line. `"skipped"` and `"ok"` are DIFFERENT outcomes and must never be
 * conflated -- a skipped assembler did not run, so it proves nothing, while
 * an `ok` assembler was actually invoked and its output byte-diffed. */
export type AssemblerOutcome = "ok" | "skipped" | "failed";

export interface VerifyLine {
  assembler: string;
  outcome: AssemblerOutcome;
  detail: string;
}

// Matches exactly a per-assembler result line, e.g.:
//   ✓ ACME — byte-identical (44 bytes)
//   ✗ 64tass — 64tass not found in PATH (skipped)
// Tolerates an em-dash (U+2014), en-dash (U+2013) or plain hyphen as the
// separator, since only the ACME verdict is load-bearing here and the exact
// glyph regenerator2000 prints is an upstream formatting detail, not
// something this parser should be brittle against. Deliberately does NOT
// match the aggregate "✓ All roundtrip verifications passed." summary line
// (no separator token present there) or the "EXIT=N" line some transcripts
// carry -- both are excluded from the returned array by construction, not
// by a special-cased skip: they simply never match this shape.
const VERIFY_LINE_PATTERN = /^[✓✗]\s+(.+?)\s+[—–-]\s+(.+)$/;

/**
 * Parses `regenerator2000 --verify`'s stdout into one `VerifyLine` per
 * per-assembler result line. The aggregate `✓ All roundtrip verifications
 * passed.` line is a summary, not an assembler line -- it never matches
 * `VERIFY_LINE_PATTERN` (no `—`/`-` separator), so it is excluded from the
 * result by construction rather than filtered out after the fact.
 */
export function parseVerifyOutput(stdout: string): VerifyLine[] {
  const lines: VerifyLine[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const match = trimmed.match(VERIFY_LINE_PATTERN);
    if (!match) continue;
    const [, assemblerRaw, detailRaw] = match;
    const assembler = assemblerRaw!.trim();
    const detail = detailRaw!.trim();
    // A "(skipped)" suffix always means skipped, regardless of the leading
    // glyph. Anything else takes its outcome from the leading glyph: a
    // leading ✓ is "ok", any other non-skipped result line is "failed" --
    // this project has never observed a real ACME/ca65 failure transcript,
    // but a future one must not silently parse as "ok".
    const outcome: AssemblerOutcome = /\(skipped\)\s*$/i.test(detail)
      ? "skipped"
      : trimmed.startsWith("✓")
        ? "ok"
        : "failed";
    lines.push({ assembler, outcome, detail });
  }
  return lines;
}

/**
 * Derives the ACME-specific verdict from a parsed line set. `ok` only when
 * at least one ACME line exists, EVERY parsed ACME line has outcome `"ok"`
 * (unanimity -- WR-04), AND exactly one ACME line is present. A missing
 * ACME line, any ACME line with outcome `"skipped"` or `"failed"`, and more
 * than one `"ok"` ACME line each return `ok: false` with a distinct,
 * quotable reason -- never conflate "skipped" with "passed", never let a
 * passing line hide a later failing one, and never fall back to the summary
 * line (which this module never even parses as a VerifyLine, see
 * `parseVerifyOutput`).
 */
export function acmeVerdict(lines: VerifyLine[]): { ok: boolean; reason: string } {
  const acmeLines = lines.filter((l) => l.assembler.toLowerCase() === "acme");

  if (acmeLines.length === 0) {
    return {
      ok: false,
      reason:
        "no ACME line found in --verify output -- ACME was never invoked at all, which is a failure, " +
        "not an absence of evidence",
    };
  }

  // First non-ok line wins -- so a passing ACME line earlier in the
  // transcript can never hide a failing one later in it (WR-04).
  const bad = acmeLines.find((l) => l.outcome !== "ok");

  if (bad?.outcome === "skipped") {
    return {
      ok: false,
      reason:
        `ACME was skipped, not run -- "${bad.detail}". A skipped ACME is a failure, never a pass ` +
        `(D-10): --verify can print "✓ All roundtrip verifications passed." and exit 0 even when ` +
        `ACME never ran at all -- exactly the false pass observed live on this host with ACME absent ` +
        `and ca65 present.`,
    };
  }

  if (bad?.outcome === "failed") {
    return { ok: false, reason: `ACME reported a failure: "${bad.detail}"` };
  }

  // Every ACME line is ok at this point. Still refuse to guess which one is
  // authoritative if more than one was printed (WR-04) -- unanimous is not
  // the same as unambiguous.
  if (acmeLines.length > 1) {
    return {
      ok: false,
      reason: `--verify printed ${acmeLines.length} ACME result lines -- refusing to guess which one is the verdict`,
    };
  }

  return { ok: true, reason: `ACME reported: ${acmeLines[0]!.detail}` };
}

export interface VerifyProjectResult {
  ok: boolean;
  reason: string;
  lines: VerifyLine[];
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs `regenerator2000 --verify` against `projectPath` (via
 * `buildVerifyArgs()`/`runR2000()`, so the `--vice` scan applies here too),
 * parses stdout, and derives `ok` from `acmeVerdict()` -- deliberately NOT
 * from `status`. Returns the raw status and streams so a caller can print
 * them for diagnostics, but no code path in this function ever lets a zero
 * exit status alone make `ok` true. A warning on stderr is never treated as
 * a failure -- only the parsed ACME result line decides the verdict.
 */
export function verifyProject(projectPath: string): VerifyProjectResult {
  const argv = buildVerifyArgs({ projectPath });
  const { status, stdout, stderr } = runR2000(argv);
  const lines = parseVerifyOutput(stdout);
  const verdict = acmeVerdict(lines);
  return { ok: verdict.ok, reason: verdict.reason, lines, status, stdout, stderr };
}
