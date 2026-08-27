#!/usr/bin/env node
// acme-gate.ts -- the ONE place the ACME cross-assembler availability gate is
// implemented (SEAM-01).
//
// WHY THIS FILE EXISTS: `disasm-roundtrip.test.ts` established the
// `ACME_BIN`/`VICE_REQUIRE_ACME` convention, `r2000-cli.test.ts` hand-copied
// it for its criterion-3 acceptance test, and a validation audit then needed a
// THIRD copy for a fixture-reproducibility check. Three hand-copied
// availability probes is exactly how a gate silently diverges: one copy gets
// its 10s timeout changed, another its banner regex loosened, and nobody
// notices until two ACME-gated test files behave differently on the same
// machine for no documented reason. Every ACME-gated test file imports this
// single implementation instead of copying it.
//
// This half previously lived at the bottom of `r2000-test-gate.ts`, sharing a
// file with the regenerator2000 gate. It stands under its own name now
// because that filename's `r2000-` prefix makes the ACME gate collateral
// damage of any prefix-driven cleanup of the regenerator2000 surface -- and
// that loss is SILENT: with the gate gone, a missing ACME degrades from a hard
// FAIL back into a named SKIP, and CI reports green either way. The
// regenerator2000 gate keeps its own module; there is deliberately no
// re-export bridging the two (see WHAT NOT TO DO).
//
// Unlike the regenerator2000 gate, `.github/workflows/ci.yml` DOES install
// ACME and DOES set `VICE_REQUIRE_ACME=1` for its Test step, so a skip from
// this gate is a local-only state -- never a CI state. CI binds the env-var
// NAMES only; it never names this module's path, which is why moving the code
// needed no workflow edit.
//
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts` files.
// `acme-gate.test.ts` asserts the `files[]` absence mechanically, on every
// suite run.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be collected
// as one. It is a plain `.ts` module for the same reason
// `fork-deleted-tools.ts` is: importing a `.test.ts` module for its exports
// would also re-run every top-level `node:test` `test(...)` call that module
// registers as an import side effect, silently duplicating that file's test
// execution inside whatever file imports it.
//
// WHAT NOT TO DO:
//   - Never rename `ACME_BIN` or `VICE_REQUIRE_ACME`. Both are read from
//     `process.env` by exact name and CI binds those exact names. A rename on
//     either side converts CI's hard FAIL into a silent SKIP, and both sides
//     stay green -- a gate that reports green whether or not it works is
//     worse than no gate at all.
//   - Never re-export these five symbols from the module they left. A shim
//     would leave the deletion hazard fully intact (a prefix-driven deletion
//     would still break four test files), which is precisely the failure this
//     seam exists to remove.
//   - Never build the probe's command line as a single shell-interpreted
//     string, and never swap `spawnSync`'s argv-array form for any
//     shell-spawning or string-command variant of the child-process API.
//     `ACME_BIN` is externally supplied and reaches a process launch here;
//     the argv-array form is what keeps that boundary safe. `acme-gate.ts`
//     is grepped mechanically for exactly this, so the guard cannot rot.
//   - Never weaken `probeAcme()`'s bounded timeout or its never-throw
//     contract. A spawn error means "not available", not a test failure, and
//     an unbounded probe can hang a whole suite on a wedged binary.
//   - Never import this tree's host/container path-translation modules here.
//     Their consumer set is a closed, mechanically asserted list of named
//     modules, and an availability probe has no reason to join it.
import { spawnSync } from "node:child_process";

/** Overridable ACME binary name, matching disasm-roundtrip.test.ts's own
 * original convention exactly. */
export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";

/** Spawns `${ACME_BIN} --version`, falling back to `--help` (ACME 0.97
 * prints its banner to either depending on build), and checks the combined
 * output for the literal (case-insensitive) substring "acme". Never throws:
 * a spawn error is "not available", not a test failure. */
export function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8", timeout: 10_000 });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

/** Probed once at module load, shared by every importing test file. */
export const ACME_AVAILABLE: boolean = probeAcme();

/**
 * A `{ skip }`-ready reason naming the caller's file, or `false` when real
 * ACME is available. Never a hand-rolled `if (!available) return`, which
 * would report a false PASS rather than a SKIP.
 * CI DOES install ACME and DOES set `VICE_REQUIRE_ACME=1`
 * (`.github/workflows/ci.yml`), so a skip here means a local run without
 * ACME on PATH -- never a CI state.
 */
export function acmeSkipReasonFor(testFileName: string): string | false {
  if (ACME_AVAILABLE) return false;
  return (
    `${testFileName}'s ACME-dependent tests are skipped -- no real ACME was found at ` +
    `ACME_BIN="${ACME_BIN}". Install ACME (verified against release 0.97 "Zem") or set ACME_BIN to an ` +
    `absolute path. CI installs ACME and sets VICE_REQUIRE_ACME=1, so this SKIP is a local-only state.`
  );
}

/**
 * Implements the never-skipped `VICE_REQUIRE_ACME` hard-FAIL assertion.
 * Registered as exactly one never-skipped test per importing file, so a
 * maintainer (or CI) who sets `VICE_REQUIRE_ACME` gets a hard FAIL rather
 * than a silent SKIP when ACME is actually missing. When the variable is
 * unset this is a no-op, so its presence never affects a normal run.
 */
export function assertAcmeRequiredIfEnvSet(assertLib: typeof import("node:assert/strict")): void {
  if (process.env.VICE_REQUIRE_ACME) {
    assertLib.ok(
      ACME_AVAILABLE,
      `VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="${ACME_BIN}" -- a maintainer (and ` +
        `CI, which sets this) expects a hard FAIL, never a SKIP, when the binary is actually missing.`
    );
  }
}
