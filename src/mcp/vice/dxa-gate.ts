#!/usr/bin/env node
// dxa-gate.ts -- the ONE place the vendored dxa binary's TEST availability
// gate is implemented, mirroring acme-gate.ts's own SEAM-01 shape for a
// second, differently-shaped external dependency.
//
// WHY THIS FILE EXISTS: CI reached the Test step for the first time since
// Phase 34 and failed there -- seven tests silently depended on two host
// artifacts a clean runner cannot have, the gitignored built binary
// `src/mcp/vice/vendor/dxa/dxa` and a cached pinned source tarball under
// `$HOME/.cache/`. Six of those seven were made genuinely host-independent
// (a planted throwaway binary, a synthesised tarball) and keep running on
// CI. The seventh -- `host-tool.test.ts`'s "no cwd for a non-acme tool"
// case -- cannot be, because its own fixture plant races a sibling test
// file's identical plant across parallel `node --test` processes (see that
// file's own comment above the gated case). This module is what turns that
// one case's absence into a NAMED skip locally and a hard FAIL under an
// explicit require-variable, never a silent pass. The project's standing
// rule that a missing external tool is detected and refused by name, never
// installed, is what makes "gate it" the only acceptable answer here --
// never "make CI build dxa".
//
// THE CI DECISION, stated so the next reader does not "fix" it: unlike the
// ACME gate, which CI installs ACME for and then demands with
// VICE_REQUIRE_ACME=1, CI must NEVER set VICE_REQUIRE_DXA. CI cannot
// legitimately produce the vendored dxa binary -- building, fetching or
// vendoring it on a runner is prohibited by this project's own
// never-auto-install rule (see CLAUDE.md's Dependency bullet) -- so a skip
// from this gate is a NORMAL CI state, not a defect. The asymmetry with the
// ACME gate is the correct outcome of that constraint, not a gap to close.
// `.github/workflows/ci.yml` declares no dxa require-variable at any level,
// and this plan leaves that file byte-for-byte unchanged.
//
// UNLIKE acme-gate.ts, THERE IS NO PATH OVERRIDE. `findDxaBinary()`
// (host-tool.mts) probes a FIXED, project-vendored candidate list computed
// from the executing module's own directory -- there is deliberately no
// env-var override, a rule host-tool.mts's own header states explicitly.
// The only environment input this gate reads is the require-variable
// itself; the binary's location is never test-injectable.
//
// ONE PROBE, TWO READERS. This module calls `findDxaBinary()` exported from
// `host-tool.mts` -- the SAME function the production refusal path in
// `runHostTool()`'s `dxa.disassemble` branch calls -- so the gate and the
// shipped refusal can never disagree about whether the binary exists. A
// hand-copied `existsSync` here would be exactly the divergence the ACME
// seam exists to prevent (see acme-gate.ts's own header).
//
// This module is TEST-ONLY. It must never appear in package.json's
// `files[]` (a test-only helper has no business in the published npm
// tarball), and it must never be imported by a production module -- only by
// `*.test.ts` files. `dxa-gate.test.ts` asserts the `files[]` absence
// mechanically, on every suite run.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be
// collected as one. Importing a `.test.ts` module for its exports would
// also re-run every top-level `node:test` `test(...)` call that module
// registers as an import side effect, silently duplicating that file's test
// execution inside whatever file imports it.
//
// WHAT NOT TO DO:
//   - Never rename `VICE_REQUIRE_DXA`. It is read from `process.env` by
//     exact name, and a rename converts a maintainer's intended hard FAIL
//     into a silent SKIP while both sides stay green -- a gate that reports
//     green whether or not it works is worse than no gate at all.
//   - Never hand-copy `findDxaBinary()`'s `existsSync` probe here. Import
//     the real function -- one probe, so the gate and the shipped refusal
//     cannot disagree.
//   - Never widen this module into installing, building or fetching the
//     binary. Detect and refuse by name with the remedy; that is the whole
//     contract.
//   - Never turn the require-variable's refusal into a warning. Its entire
//     value is that it is a hard FAIL, not a softer signal.
//   - Never add an env-var override for the binary's own path. The
//     vendored path is fixed by design (host-tool.mts's own header states
//     this rule); the require-variable is the only environment input this
//     gate takes.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Reached through the COMPILED artifact, never the unbuilt `.mts` source
// directly: `host-tool.mts` value-imports two sibling host-bound modules
// (`ghidra-project.mjs`, `backend-detect.mjs`) by their compiled `.mjs`
// specifiers, which resolve only inside `resources/` -- exactly the same
// constraint `host-tool.test.ts`'s own header documents for itself (that
// file's own dynamic `await import(new URL(...))` cast is the precedent
// copied here, including `tsconfig.json`'s `resources` exclusion being why
// the cast is needed at all). This is still the ONE probe:
// `resources/host-tool.mjs` is `build.ts`'s committed, drift-checked
// (`resources-sync.test.ts`) compilation of the very same `findDxaBinary()`
// declaration at `host-tool.mts`, never a second hand-written copy. This
// module does NOT call `build()` itself -- every importing test file that
// needs a guaranteed-fresh artifact already calls `build()` before its own
// use of it, and `resources-sync.test.ts` is the one place drift between
// source and artifact is asserted; a second `build()` call here would only
// add a redundant `tsc` invocation per importer.
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  findDxaBinary: (here: string) => { path: string | null; tried: string[] };
};
const { findDxaBinary } = hostTool;

/** The candidate paths `findDxaBinary()` probes when called with THIS
 * module's own directory -- which is `src/mcp/vice/`, so the FIRST
 * candidate is the real vendored path `src/mcp/vice/vendor/dxa/dxa`, never
 * a test's planted fake under `resources/vendor/dxa/dxa` (which sits
 * outside this candidate list entirely). */
const DXA_PROBE = findDxaBinary(HERE);

/** The two paths this gate (and the production refusal) actually try. */
export const DXA_BINARY_CANDIDATES: readonly string[] = DXA_PROBE.tried;

/** Probed once at module load, shared by every importing test file. */
export const DXA_AVAILABLE: boolean = DXA_PROBE.path !== null;

/** The remedy every skip/refusal names -- kept as one constant so the gate
 * and its own test assert on the identical string. */
const REMEDY = "bash vendor/dxa/build.bash build";

/**
 * A `{ skip }`-ready reason naming the caller's file and both probed
 * candidate paths, or `false` when the real vendored binary is available.
 * Never a hand-rolled `if (!available) return`, which would report a false
 * PASS rather than a SKIP.
 */
export function dxaSkipReasonFor(testFileName: string): string | false {
  if (DXA_AVAILABLE) return false;
  return (
    `${testFileName}'s dxa-dependent test is skipped -- no real vendored dxa binary was found ` +
    `(tried: ${DXA_BINARY_CANDIDATES.join(", ")}). Run \`${REMEDY}\` to produce it. CI never sets ` +
    `VICE_REQUIRE_DXA (it cannot legitimately produce this binary), so this SKIP is a normal, expected CI state.`
  );
}

/**
 * The pure core: throws with the gate's own refusal wording when `available`
 * is false, otherwise a no-op. Exists separately from
 * `assertDxaRequiredIfEnvSet()` so both directions can be asserted
 * in-process against a synthetic `available` value, with no child process
 * needed -- unlike the ACME gate, this module has no env-overridable binary
 * path, so there is nothing here a module-load `const` could hide from an
 * in-process test.
 */
export function assertDxaRequired(available: boolean, assertLib: typeof import("node:assert/strict")): void {
  assertLib.ok(
    available,
    `VICE_REQUIRE_DXA is set but no real vendored dxa binary was found (tried: ${DXA_BINARY_CANDIDATES.join(", ")}) -- ` +
      `a maintainer who sets this variable expects a hard FAIL, never a SKIP, when the binary is actually missing. ` +
      `Run \`${REMEDY}\` to produce it.`
  );
}

/**
 * Reads `VICE_REQUIRE_DXA` from the ambient environment at CALL time and
 * delegates to the pure core with `DXA_AVAILABLE`. Registered as exactly one
 * never-skipped test per importing file, so a maintainer who sets this
 * variable gets a hard FAIL rather than a silent SKIP when the binary is
 * actually missing. When the variable is unset this is a no-op, so its
 * presence never affects a normal run.
 */
export function assertDxaRequiredIfEnvSet(assertLib: typeof import("node:assert/strict")): void {
  if (process.env.VICE_REQUIRE_DXA) {
    assertDxaRequired(DXA_AVAILABLE, assertLib);
  }
}

