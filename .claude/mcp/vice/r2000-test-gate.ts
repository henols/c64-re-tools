#!/usr/bin/env node
// r2000-test-gate.ts -- the ONE place the D-11 regenerator2000 availability
// gate is implemented.
//
// WHY THIS SEAM EXISTS (plan 11-01, R2000-10): Phase 11 adds four more
// live-regenerator2000 test files on top of the three that already existed
// after Phase 10 (r2000-project.test.ts, r2000-verify.test.ts,
// r2000-cli.test.ts). Six-plus hand-copied `probeR2000()`/`R2000_AVAILABLE`/
// `SKIP_REASON`/`VICE_REQUIRE_R2000` bodies is exactly how a gate silently
// diverges -- one copy gets its timeout changed, another its regex loosened,
// and nobody notices until a live run behaves differently between two test
// files for no documented reason. This module is the single implementation
// every new live-r2000 test file imports instead of copying.
//
// `VICE_REQUIRE_R2000` is DELIBERATELY NOT set in `.github/workflows/ci.yml`.
// A fresh `cargo install regenerator2000` measured 4m48s-5m39s during Phase
// 9/10 planning -- a 5-minute Rust build on every merge would contradict
// "cheapest by far", the whole reason `--verify` was chosen over launching
// regenerator2000's own (unusable, `--vice`-shaped) live-emulator mode in the
// first place. Absence of regenerator2000 in CI is therefore an EXPECTED
// SKIP, forever, by design -- never a failure. A maintainer who explicitly
// sets `VICE_REQUIRE_R2000` locally is asking for the opposite: a missing
// binary must hard-FAIL there, never silently SKIP.
//
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts`
// files. `r2000-verify.test.ts` asserts the `files[]` absence mechanically.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be
// collected as one.
import { spawnSync } from "node:child_process";

/** Overridable binary name, mirroring `r2000-launch.ts`'s own `R2000_BIN`
 * convention -- lets tests point at a name guaranteed not to exist on PATH
 * without needing regenerator2000 installed at all. */
export const R2000_BIN: string = process.env.R2000_BIN ?? "regenerator2000";

/** Spawns `${R2000_BIN} --version` with a 10s timeout and checks the
 * combined stdout+stderr for the literal (case-insensitive) substring
 * "regenerator2000" -- the same shape every hand-copied probe in this repo
 * already used before this module existed. Never throws: a spawn error
 * (e.g. ENOENT) is treated as "not available", not a test failure. */
export function probeR2000(): boolean {
  const r = spawnSync(R2000_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /regenerator2000/i.test(banner);
}

/** Evaluated exactly once, at module load, exactly like every hand-copied
 * copy before it -- so every test file importing this module shares one
 * probe result per test run instead of re-spawning the binary per file. */
export const R2000_AVAILABLE: boolean = probeR2000();

/**
 * Returns the established SKIP message with the caller's own filename
 * interpolated (so the message names the actual file whose tests are being
 * skipped), or `false` when a real regenerator2000 is available -- meant to
 * be passed directly as node:test's `{ skip }` option. Never a hand-rolled
 * `if (!available) return`, which would report a false PASS rather than a
 * SKIP.
 */
export function skipReasonFor(testFileName: string): string | false {
  if (R2000_AVAILABLE) return false;
  return (
    `${testFileName}'s regenerator2000-dependent tests are skipped -- no real regenerator2000 was ` +
    `found at R2000_BIN="${R2000_BIN}". Set R2000_BIN to an absolute path to a real "regenerator2000" ` +
    `binary, or install one (cargo install regenerator2000 -- verified against 0.9.20 during Phase ` +
    `9/10 planning). D-11 deliberately keeps CI from setting VICE_REQUIRE_R2000, so this is an ` +
    `expected SKIP there -- never a CI failure.`
  );
}

/**
 * Implements the never-skipped `VICE_REQUIRE_R2000` hard-FAIL assertion.
 * Callers register exactly one test per file that always runs (never
 * gated behind `{ skip }`) and calls this function as its whole body. When
 * `VICE_REQUIRE_R2000` is unset, this is a no-op -- the test passes trivially
 * so its presence never affects a normal run. When it IS set, a missing
 * regenerator2000 fails the assertion loudly: a maintainer who sets this
 * variable expects a hard FAIL, never a silent SKIP, when the binary is
 * actually missing.
 */
export function assertR2000RequiredIfEnvSet(assertLib: typeof import("node:assert/strict")): void {
  if (process.env.VICE_REQUIRE_R2000) {
    assertLib.ok(
      R2000_AVAILABLE,
      `VICE_REQUIRE_R2000 is set but no real regenerator2000 was found at R2000_BIN="${R2000_BIN}" -- a ` +
        `maintainer who sets this variable expects a hard FAIL, never a SKIP, when the binary is actually missing.`
    );
  }
}
