// r2000-verify.test.ts -- pins both captured `--verify` transcripts (the
// honest pass and D-10's exit-0 false-pass trap), plus a synthetic failed
// case and a no-ACME-line case, then proves the whole thing live under the
// D-11 availability gate.
//
// Unit half (tests 1-5) always runs, no binary needed -- pure string
// fixtures against `parseVerifyOutput()`/`acmeVerdict()`.
//
// Gated half (tests 6-7) mirrors D-11's shape exactly: `probeR2000()`, a
// module-scope `SKIP_REASON`, `{ skip: SKIP_REASON }` on each dependent
// test, and exactly ONE availability-gate test that always runs and asserts
// only when `VICE_REQUIRE_R2000` is set -- the same convention
// `r2000-cli.test.ts`'s own gated test already uses, itself mirroring
// `disasm-roundtrip.test.ts`'s `SKIP_REASON`/`{ skip }` pattern. Never a
// hand-rolled `if (!available) return`, which would report a false PASS
// rather than a SKIP.
//
// Do NOT add a VICE_REQUIRE_R2000 env var to .github/workflows/ci.yml. The
// asymmetry with VICE_REQUIRE_ACME is deliberate (D-11), not an oversight:
// `cargo install regenerator2000` measured 4m48s-5m39s on a fresh build, and
// a 5-minute Rust build on every merge contradicts "cheapest by far" -- the
// whole reason --verify was chosen for D-09 in the first place. CI gets a
// named SKIP here forever, by design, not by omission.
//
// This file's own live run is recorded because CI will never reproduce
// tests 6/7: see
// .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt
// for the actual, unedited stdout of both live runs plus their exit codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseVerifyOutput, acmeVerdict, verifyProject } from "./r2000-verify.ts";
import { synthesizeProject, flatImageOrigin } from "./r2000-project.ts";

// ---------------------------------------------------------------------------
// Fixture transcripts -- both captured verbatim (RESEARCH.md's D-09/D-10
// citations, and this plan's own live runs against a real regenerator2000
// 0.9.20 / ACME 0.97 on this host -- see evidence/10-verify-transcript.txt).
// ---------------------------------------------------------------------------

const HONEST_PASS_TRANSCRIPT =
  "Loaded: \"prg-fixture.regen2000proj\"\n" +
  "Assembler overridden to: ACME\n" +
  "\n" +
  "Roundtrip Export Verification\n" +
  "=============================\n" +
  "  ✗ 64tass — 64tass not found in PATH (skipped)\n" +
  "  ✓ ACME — byte-identical (3 bytes)\n" +
  "  ✓ ca65 — byte-identical (3 bytes)\n" +
  "  ✗ KickAssembler — KickAssembler not found in PATH (skipped)\n" +
  "\n" +
  "✓ All roundtrip verifications passed.\n";

// THE TRAP (D-10): ACME skipped, summary says all passed, EXIT=0 -- a false
// pass observed live on this host with ACME absent and ca65 present.
const TRAP_TRANSCRIPT =
  "✗ ACME — ACME not found in PATH (skipped)\n" + "✓ All roundtrip verifications passed.\n" + "EXIT=0\n";

test("parseVerifyOutput: the honest-pass transcript yields four assembler lines with the right outcomes", () => {
  const lines = parseVerifyOutput(HONEST_PASS_TRANSCRIPT);
  assert.equal(lines.length, 4);
  assert.deepEqual(
    lines.map((l) => [l.assembler, l.outcome]),
    [
      ["64tass", "skipped"],
      ["ACME", "ok"],
      ["ca65", "ok"],
      ["KickAssembler", "skipped"],
    ],
  );
  const verdict = acmeVerdict(lines);
  assert.equal(verdict.ok, true);
});

test(
  "acmeVerdict: THIS PINS A LIVE-OBSERVED FALSE PASS (D-10) -- ACME skipped, summary passed, EXIT=0 -- must be ok:false, never simplified back to an exit-code check",
  () => {
    const lines = parseVerifyOutput(TRAP_TRANSCRIPT);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.assembler, "ACME");
    assert.equal(lines[0]!.outcome, "skipped");

    const verdict = acmeVerdict(lines);
    assert.equal(verdict.ok, false, "a skipped ACME must never be reported as a pass, even though the transcript's own summary line and exit code both say success");
    assert.match(verdict.reason, /skipped/i);
  },
);

test("acmeVerdict: a synthetic failed-ACME line yields ok:false with a reason distinct from the skipped case", () => {
  const lines = parseVerifyOutput("✗ ACME — assembler exited with exit status: 1\n✗ Some roundtrip verifications failed.\n");
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.outcome, "failed");
  const verdict = acmeVerdict(lines);
  assert.equal(verdict.ok, false);
  assert.doesNotMatch(verdict.reason, /skipped/i, "a failed-ACME reason must not read as a skipped-ACME reason");
});

test("acmeVerdict: output with no ACME line at all yields ok:false -- absence is not success", () => {
  const lines = parseVerifyOutput(
    "✗ 64tass — 64tass not found in PATH (skipped)\n✓ All roundtrip verifications passed.\n",
  );
  assert.equal(lines.some((l) => l.assembler.toLowerCase() === "acme"), false);
  const verdict = acmeVerdict(lines);
  assert.equal(verdict.ok, false);
});

test("parseVerifyOutput: the summary line is never parsed as an assembler entry", () => {
  const lines = parseVerifyOutput("✓ All roundtrip verifications passed.\n");
  assert.equal(lines.length, 0, "the aggregate summary line must not be mistaken for a per-assembler result line");
});

test("parseVerifyOutput: a real ca65 failure (not skipped) parses as failed, and ACME's own ok verdict is unaffected -- proving D-10 in the opposite direction too", () => {
  // Reproduced from this plan's own live flat-64K run: ca65 genuinely failed
  // (ld65 memory-area overflow) while ACME succeeded, and the whole process
  // exited 1 -- yet the ACME verdict must still be ok:true, since acmeVerdict()
  // only ever looks at ACME's own line, never at ca65's outcome or the process
  // exit status.
  const transcript =
    "  ✗ 64tass — 64tass not found in PATH (skipped)\n" +
    "  ✓ ACME — byte-identical (65536 bytes)\n" +
    "  ✗ ca65 — assembler exited with exit status: 1\n" +
    "stdout: \n" +
    "stderr: ld65: Warning: (10): Segment 'CODE' overflows memory area 'MAIN' by 14337 bytes\n" +
    "ld65: Error: Cannot generate most of the files due to memory area overflow \n" +
    "\n" +
    "  ✗ KickAssembler — KickAssembler not found in PATH (skipped)\n" +
    "\n" +
    "✗ Some roundtrip verifications failed.\n";
  const lines = parseVerifyOutput(transcript);
  const ca65Line = lines.find((l) => l.assembler === "ca65");
  assert.ok(ca65Line);
  assert.equal(ca65Line!.outcome, "failed");
  const verdict = acmeVerdict(lines);
  assert.equal(verdict.ok, true, "ACME's own byte-identical result must decide the verdict, independent of ca65's failure or the process's own non-zero exit");
});

// ---------------------------------------------------------------------------
// Gated half -- needs a real regenerator2000. Mirrors D-11's shape exactly.
// ---------------------------------------------------------------------------

const R2000_BIN = process.env.R2000_BIN ?? "regenerator2000";

function probeR2000(): boolean {
  const r = spawnSync(R2000_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /regenerator2000/i.test(banner);
}

const R2000_AVAILABLE = probeR2000();

/** Computed exactly once. Never a hand-rolled early return -- see header
 * comment. */
const SKIP_REASON: string | false = R2000_AVAILABLE
  ? false
  : `r2000-verify.test.ts's regenerator2000-dependent tests are skipped -- no real regenerator2000 was ` +
    `found at R2000_BIN="${R2000_BIN}". Set R2000_BIN to an absolute path to a real "regenerator2000" ` +
    `binary, or install one (cargo install regenerator2000 -- verified against 0.9.20 during Phase 9/10 ` +
    `planning). D-11 deliberately keeps CI from setting VICE_REQUIRE_R2000, so this is an expected SKIP ` +
    `there -- never a CI failure.`;

test("regenerator2000 availability gate (D-11)", () => {
  if (process.env.VICE_REQUIRE_R2000) {
    assert.ok(
      R2000_AVAILABLE,
      `VICE_REQUIRE_R2000 is set but no real regenerator2000 was found at R2000_BIN="${R2000_BIN}" -- a ` +
        `maintainer who sets this variable expects a hard FAIL, never a SKIP, when the binary is actually missing.`,
    );
  }
});

function withTempProject<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "r2000-verify-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test(
  "gated: verifyProject() on a .prg-shaped illegal-opcode fixture reports ok:true with ACME byte-identical (R2000-06, .prg half)",
  { skip: SKIP_REASON, timeout: 30_000 },
  () => {
    withTempProject((dir) => {
      // lax zeropage ($A7 $02, an illegal opcode) then rts.
      const body = Uint8Array.from([0xa7, 0x02, 0x60]);
      const project = synthesizeProject(body, { origin: 0x0801 });
      const projectPath = join(dir, "prg-fixture.regen2000proj");
      writeFileSync(projectPath, project);

      const result = verifyProject(projectPath);
      assert.equal(result.ok, true, `expected ok:true, got reason: ${result.reason}\nstdout: ${result.stdout}`);
      const acmeLine = result.lines.find((l) => l.assembler.toLowerCase() === "acme");
      assert.ok(acmeLine, "expected an ACME line in the parsed output");
      assert.equal(acmeLine!.outcome, "ok");
      assert.match(acmeLine!.detail, /byte-identical/i);
    });
  },
);

test(
  "gated: verifyProject() on a flat 64K image reports ok:true with ACME byte-identical (R2000-06, flat-64K half)",
  { skip: SKIP_REASON, timeout: 30_000 },
  () => {
    withTempProject((dir) => {
      const flat = new Uint8Array(65536);
      flat.set([0xa7, 0x02, 0x60], 0x1000);
      const origin = flatImageOrigin(flat);
      const project = synthesizeProject(flat, { origin });
      const projectPath = join(dir, "flat64k-fixture.regen2000proj");
      writeFileSync(projectPath, project);

      const result = verifyProject(projectPath);
      assert.equal(result.ok, true, `expected ok:true, got reason: ${result.reason}\nstdout: ${result.stdout}`);
      const acmeLine = result.lines.find((l) => l.assembler.toLowerCase() === "acme");
      assert.ok(acmeLine, "expected an ACME line in the parsed output");
      assert.equal(acmeLine!.outcome, "ok");
      assert.match(acmeLine!.detail, /byte-identical/i);
    });
  },
);
