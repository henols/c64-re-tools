---
phase: 02-stock-backend-connection
plan: 01
subsystem: testing
tags: [node-test, tdd, binary-monitor, fixtures, vice, test-gate]

# Dependency graph
requires:
  - phase: 01-corrected-ground-truth
    provides: docs/phase0-binmon-findings.md's corrected wire-protocol layout and docs/phase1-probe-results.md's recorded DISPLAY_GET geometry (dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8)
provides:
  - "npm run test:automated / test:manual: the phase's regression gate, terminating and green (a bare npm test hangs outside the devcontainer on 3 broker/proxy files)"
  - "test-gate.mjs's MANUAL_ONLY_TESTS + automatedTestFiles(), with a drift-guard test so a new test file cannot silently escape both lists"
  - "binmon-fixtures.ts: encodeResponseFrame() + 5 synthesize-only VERIF-02 case builders (JAM, unknown-type, duplicate-reply, desync-stream, chunkBytes) + loadCapturedFixture()'s MissingFixtureError contract"
  - "probe-binmon.mjs --capture <case>: bounded (MAX_CAPTURE_FRAMES=32), offline-self-tested fixture writer for display-get / event-interleaved / checkpoint-list, feeding binmon-fixtures.ts's loader"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of truth for automated-vs-manual test split (test-gate.mjs), enforced by a drift-guard test rather than a second list anywhere else"
    - "Response-frame encoder/synthetic-fixture module kept separate from the vendor's zod-carrying contracts.ts -- three wire constants hand-copied instead"
    - "Capture-mode raw-byte dump hooked downstream of an existing framing loop (onFrame callback) rather than a second wire parser"

key-files:
  created:
    - .claude/mcp/vice/test-gate.mjs
    - .claude/mcp/vice/test-gate.test.ts
    - .claude/mcp/vice/test-gate.d.mts
    - .claude/mcp/vice/binmon-fixtures.ts
    - .claude/mcp/vice/binmon-fixtures.test.ts
    - .claude/mcp/vice/fixtures/binmon/README.md
  modified:
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/probe-binmon.mjs

key-decisions:
  - "MANUAL_ONLY_TESTS is exactly vice-broker-launch.test.ts, vice-proxy.test.ts, broker-e2e.test.ts, per the folded todo's 2026-08-12 user disposition"
  - "binmon-fixtures.ts hand-copies VICE_STX/VICE_API_VERSION/VICE_BROADCAST_REQUEST_ID rather than importing the vendor's contracts.ts, keeping package.json's dependencies zod-free (D-16)"
  - "capturedFrom in --capture's sidecar is sourced from CAPTURE_BACKEND_KIND/VICE_BIN env vars with an honest host:port fallback, since neither the binary path nor stock/fork identity is observable from a bare TCP client"

patterns-established:
  - "Pattern 1: one MANUAL_ONLY_TESTS array is the only place a test file is excluded from the automated gate; a drift-guard test asserts on-disk-set == automated-set + manual-set with no overlap"
  - "Pattern 2: capture-mode / debug-dump hooks attach downstream of an existing, already-guarded parse loop (onFrame) instead of re-implementing framing a second time"

requirements-completed: []  # See "Requirements" note below -- VERIF-02/BACK-02/BROK-03 are multi-plan, phase-wide criteria; this plan builds the checking substrate, it does not itself satisfy them.

# Metrics
duration: ~26min
completed: 2026-08-13
---

# Phase 2 Plan 1: Wave 0 Validation Substrate Summary

**Narrowed `npm run test:automated` gate (21 pre-existing files + 2 new, 3 excluded per user disposition) plus `binmon-fixtures.ts`'s byte-exact response-frame encoder and `probe-binmon.mjs`'s bounded `--capture` mode.**

## Performance

- **Duration:** ~26 min (first commit 00:49:58, last commit 00:56:58 CEST)
- **Started:** 2026-08-13T00:49:00+02:00 (approx.)
- **Completed:** 2026-08-13T00:56:58+02:00
- **Tasks:** 3 completed / 3 planned
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- `npm run test:automated` now exists, terminates, and is green modulo one
  pre-existing environment artifact unrelated to this plan (see "Issues
  Encountered"). `npm run test:manual` runs the 3 excluded files on demand.
- `binmon-fixtures.ts` makes 5 of VERIF-02's 8 cases obtainable byte-exactly
  with no emulator, plus a `loadCapturedFixture()` contract the not-yet-
  captured 3 real cases will load through in plan 02-02.
- `probe-binmon.mjs --capture` is a working, bounded, offline-self-tested
  fixture writer ready to run against a real `x64sc -binarymonitor` build.

## Task Commits

Each task was committed atomically:

1. **Task 1: Narrowed automated test gate with a drift guard** - `c3f2b1a` (feat)
2. **Task 1 fix: ambient types for test-gate.mjs** - `ef0c6e3` (fix, deviation)
3. **Task 2: Binmon fixture encoder, synthetic case builders, captured-fixture loader** - `255dc77` (test, RED) → `ea8b2b5` (feat, GREEN)
4. **Task 3: Bounded `--capture` mode on `probe-binmon.mjs`** - `f9a2bbf` (feat)

_Task 2 was TDD (`tdd="true"`): RED commit `255dc77` (module-not-found failure,
binmon-fixtures.ts did not exist), GREEN commit `ea8b2b5` (all 11 tests pass).
No REFACTOR commit was needed -- the GREEN implementation needed no cleanup._

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

## Files Created/Modified

- `.claude/mcp/vice/test-gate.mjs` - `MANUAL_ONLY_TESTS`, `automatedTestFiles()`, and the `node --test` spawn-and-relay CLI entry point
- `.claude/mcp/vice/test-gate.test.ts` - drift guard: manual-list contents, automated+manual == on-disk set with no overlap, every manual entry exists on disk
- `.claude/mcp/vice/test-gate.d.mts` - ambient types for the plain-JS `test-gate.mjs` so the `.ts` test's static import typechecks under strict mode
- `.claude/mcp/vice/binmon-fixtures.ts` - `encodeResponseFrame()`, 5 synthetic VERIF-02 case builders, `chunkBytes()`, `loadCapturedFixture()` + `MissingFixtureError`
- `.claude/mcp/vice/binmon-fixtures.test.ts` - 11 tests covering every behavior in the plan's `<behavior>` block
- `.claude/mcp/vice/fixtures/binmon/README.md` - provenance table (3 cases, all `PENDING (plan 02-02)`), frozen-vs-living-capture framing
- `.claude/mcp/vice/package.json` - additive `test:automated` / `test:manual` scripts; `test` script byte-identical; no dependency change
- `.claude/mcp/vice/probe-binmon.mjs` - `CHECKPOINT_LIST` (0x14) added to `CMD`; `MAX_CAPTURE_FRAMES`/`CAPTURE_CASES` constants; `BinMon.onFrame` hook (fires downstream of the existing `_onData()` framing loop); `connectSocket()` extracted and shared between `main()` and the new capture path; `--capture <case>`/`--capture-out <dir>` CLI branch, validated before any socket connect; `captureDisplayGetCase`/`captureEventInterleavedCase`/`captureCheckpointListCase`; `writeAtomic()` tmp-sibling-then-rename writer; `selftest()` extended with 3 offline checks for the new capture machinery

## Decisions Made

- Kept `binmon-fixtures.ts`'s wire constants hand-copied rather than importing
  the vendor's `contracts.ts`, per the plan's explicit D-16 instruction --
  verified `package.json`'s `dependencies` block is unchanged (no `zod`).
- `probe-binmon.mjs`'s capture-mode sidecar's `capturedFrom` field is built
  from `CAPTURE_BACKEND_KIND`/`VICE_BIN` env vars with a `host:port` fallback,
  since a raw TCP client to the binary monitor cannot itself observe the
  emulator's resolved binary path or stock-vs-fork identity -- this is a
  reasonable interpretation of the plan's "resolved binary path plus stock or
  fork" spec given that constraint, not a shortcut around it.
- Did not run `requirements mark-complete` for VERIF-02/BACK-02/BROK-03 (see
  "Requirements" note below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned missing `node_modules` before verification**
- **Found during:** Task 1 verification (`npm run test:automated`)
- **Issue:** This worktree had no `node_modules` at all (`ls node_modules | wc -l` → 0), so every test file that shells out to `tsc` (via `build.ts`'s `execFileSync`) failed with `spawnSync .../node_modules/.bin/tsc ENOENT`. The `SessionStart` hook (`scripts/ensure-mcp-deps.sh`) that normally provisions this had evidently not run for this worktree.
- **Fix:** Ran `npm ci --no-audit --no-fund` in `.claude/mcp/vice` (the exact command the hook itself runs, gated on the same committed lockfile). No source change; `node_modules/` remains gitignored and uncommitted.
- **Verification:** Re-ran `npm run test:automated`; the `ENOENT` failures disappeared entirely.
- **Committed in:** N/A (no file changes -- environment-only)

**2. [Rule 1 - Bug] Added `test-gate.d.mts` so `npm run typecheck` passes**
- **Found during:** Task 2 verification (`npm run typecheck`, run before this plan's own final verification block)
- **Issue:** `test-gate.test.ts`'s static `import { MANUAL_ONLY_TESTS, automatedTestFiles } from "./test-gate.mjs"` had no declaration file, so `tsc --noEmit` failed with `TS7016`/`TS7006` under this package's strict tsconfig (`noImplicitAny`). No existing `.ts` test file in this package statically imports a plain-JS `.mjs` sibling, so there was no precedent to follow directly.
- **Fix:** Added `test-gate.d.mts` (ambient `declare const`/`declare function` matching TypeScript's `.mjs` → `.d.mts` declaration-file resolution convention) alongside `test-gate.mjs`. No change to `test-gate.mjs`'s runtime behavior.
- **Files modified:** `.claude/mcp/vice/test-gate.d.mts` (new)
- **Verification:** `npm run typecheck` exits 0 with no errors.
- **Committed in:** `ef0c6e3`

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 bug/typecheck).
**Impact on plan:** Both were necessary to make the plan's own verification
commands (`npm run test:automated`, `npm run typecheck`) actually runnable
and green. No scope creep -- neither touched runtime behavior.

## Issues Encountered

- **One pre-existing test failure is a worktree-path artifact, not a
  regression from this plan.** `repo-root.test.ts`'s "path agreement... the
  agreed path is not under .claude" assertion fails inside this specific
  worktree because the worktree itself is checked out at
  `.../c64-re-tools/.claude/worktrees/agent-.../`, which contains a literal
  `.claude` path segment before the repo root -- an artifact of nested
  worktree-based parallel execution, not of `repo-root.ts`'s logic. Confirmed
  by running the identical, unmodified `repo-root.test.ts` from the main
  repo checkout (not nested under `.claude/worktrees/`), where it passes.
  Out of scope per this plan's scope boundary (pre-existing, unrelated file,
  not touched by any of this plan's 3 tasks); not auto-fixed. `npm run
  test:automated` is 312/313 passing (5 `todo`) in this worktree as a result,
  and would be 313/313 in a non-nested checkout.

## Requirements

The plan's frontmatter lists `requirements: [VERIF-02, BACK-02, BROK-03]`.
`ROADMAP.md`'s "Standing Constraints" and `STATE.md`'s accumulated context
both describe these as phase-wide criteria checked across all of Phase 2's
plans (e.g. BACK-02's "no regression in any tool" and VERIF-02's "protocol
client behaviour is unit-tested" both depend on `stock-protocol.ts`, which
does not exist until a later plan). This plan's own objective states it
builds "the Wave 0 validation substrate this phase's every other plan is
checked against" -- the enabling mechanism, not the completed criterion.
`requirements mark-complete` was deliberately not run for these three IDs;
they should be marked once the plan(s) that actually satisfy them land.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npm run test:automated` is ready to be every later plan in this phase's
  regression gate.
- `binmon-fixtures.ts` and `probe-binmon.mjs --capture` are ready for plan
  02-02 to run `--capture all` against a real `x64sc -binarymonitor` build
  and commit the three real `fixtures/binmon/*.bin` + `.json` pairs,
  replacing the `PENDING (plan 02-02)` rows in `fixtures/binmon/README.md`.
- No blockers. The one worktree-path test artifact noted above should
  self-resolve once this worktree's commits land in the main checkout.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/test-gate.mjs`
- FOUND: `.claude/mcp/vice/test-gate.test.ts`
- FOUND: `.claude/mcp/vice/test-gate.d.mts`
- FOUND: `.claude/mcp/vice/binmon-fixtures.ts`
- FOUND: `.claude/mcp/vice/binmon-fixtures.test.ts`
- FOUND: `.claude/mcp/vice/fixtures/binmon/README.md`
- FOUND commit `c3f2b1a` (feat: test gate)
- FOUND commit `255dc77` (test: RED, binmon-fixtures)
- FOUND commit `ef0c6e3` (fix: test-gate.d.mts)
- FOUND commit `ea8b2b5` (feat: GREEN, binmon-fixtures)
- FOUND commit `f9a2bbf` (feat: probe-binmon --capture)
