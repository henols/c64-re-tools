---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
plan: 04
subsystem: broker-control-plane
tags: [cli, entry-point, node-floor, machine-level-state, dispatch]

# Dependency graph
requires:
  - phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine (plan 02)
    provides: "broker-home.mts's machine-level root resolvers (brokerStateDir() and siblings), not yet wired into the broker process"
  - phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine (plan 03)
    provides: "vice-broker.mts's enumerated-bind-set startup path (startControlListenerOnHosts()), which this plan's stderr audit line sits alongside"
provides:
  - "src/mcp/vice/vice-cli.mjs: the package's single binary/main entry, a plain-JavaScript floor refusal that runs before any type-stripped import, and the `broker` subcommand dispatch"
  - "vice-broker.mts: a fourth, lowest-precedence state-directory fallback (brokerStateDir()) reached when no project argument is supplied, and an optional --repo-root"
affects: [phase-63-session-relay, phase-64-file-transfer, phase-65-skill-script-seam, phase-66-convergence]

# Actuals (#2632)
actuals:
  tokens: 13756
  tasks: 2
  commits: 3
plan_head_before: 903532e3335d3e2002df7cf1c031420db8d75d97

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A hand-authored, never-compiled plain-.mjs binary entry (matching the smoke.mjs/test-gate.mjs placement precedent) as the ONE place a floor check can run below the type-stripping floor -- the package's real .ts entry point cannot host it"
    - "A test-only, unambiguously-named env var escape hatch (VICE_CLI_TEST_SIMULATED_NODE_MAJOR) to drive a below-floor code path without installing a second interpreter, mirroring vice-proxy.ts's own VICE_TEST_ANNO_CLI_STDOUT_FILL_BYTES hatch"
    - "An ambient .d.mts declaration file (vice-cli.d.mts) so a strict, allowJs:false tsconfig can typecheck a .test.ts's static import of a plain-JS sibling -- mirrors test-gate.d.mts's existing precedent for the identical problem"
    - "A state-directory precedence chain extended with one new, LOWEST-priority step rather than reordered -- the three pre-existing steps are asserted to resolve to the exact same directory they always did"

key-files:
  created:
    - src/mcp/vice/vice-cli.mjs
    - src/mcp/vice/vice-cli.test.ts
    - src/mcp/vice/vice-cli.d.mts
  modified:
    - src/mcp/vice/package.json
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/vice-broker-launch.test.ts
    - src/mcp/vice/broker-e2e.test.ts
    - src/mcp/vice/repo-root.ts
    - docs/phase58-declaration-provenance.md

key-decisions:
  - "vice-cli.mjs's floor check reuses one exported resolveFloorMajor(manifestPath) for BOTH the real startup path and the test's fixture-manifest assertions -- rather than deriving the floor inline from an already-parsed package.json object -- so there is one source of truth for the derivation a test also exercises directly"
  - "The broker artifact's own main(argv) is called explicitly with the subcommand token already stripped, rather than mutating process.argv[1] to fake the artifact's own self-invocation check -- cleaner, and it matches vice-broker.mts's own exported main(argv) signature exactly"
  - "vice-cli.mjs's own bottom-of-file CLI guard (only calling main() when this file is the actual process entry point) mirrors vice-broker.mts's identical guard -- without it, vice-cli.test.ts's static import of the pure functions would re-run the floor check and dispatch against the TEST RUNNER's own argv as an unwanted side effect of loading the module"
  - "The four state-directory precedence cases could not be unit-tested by importing parseArgs() directly from vice-broker.mts in a .test.ts -- that file's sibling .mjs imports (./container-guard.mjs etc.) only exist beside the COMPILED artifact under resources/, not beside the .mts source, so a direct value import throws at module resolution. All four precedence cases are instead proven the same way every other real-behaviour test in this file already is: spawn the emitted artifact and observe where broker.json actually lands"
  - "The two-project case's 'two clients configured against two project directories' is proven as two independent control-plane sessions opened against the broker's own (machine-level) state directory, rather than by varying each session's own dial target -- there is deliberately no per-project discovery path any more under this phase's design (D-13's whole point), so nothing in this phase's shape supports a literally per-project dial target"

requirements-completed: [BROKER-01, BROKER-06]

coverage:
  - id: D1
    description: "The package has one binary/main entry, written in plain JavaScript, that refuses a below-floor interpreter by name (with the package name, observed version and required floor) before importing anything, then dispatches the broker subcommand to the compiled artifact and everything else to the proxy unchanged"
    requirement: "BROKER-02"
    verification:
      - kind: unit
        ref: "vice-cli.test.ts (15 tests: floor-arithmetic unit tests, fixture-manifest floor derivation, below-floor simulated-version spawn, broker-subcommand delegation via --check-container, byte-identical annotation delegation, manifest/packaging assertions, D-04 verdict-recorded-not-executed assertion)"
        status: pass
      - kind: other
        ref: "npm run typecheck (clean, via vice-cli.d.mts's ambient declarations); npm run test:automated (3974 tests, 1 pre-existing unrelated failure, unchanged from before this plan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A broker started with no project argument resolves its state under the machine-level root and starts (rather than refusing), the three pre-existing state-directory precedence steps are unchanged, and the resolved directory is reported on stderr"
    requirement: "BROKER-06"
    verification:
      - kind: unit
        ref: "vice-broker-launch.test.ts (precedence 1/2/3/D-13-fallback tests, plus the narrowed-not-removed usage-refusal tests for an unrecognised flag and a flag missing its value)"
        status: pass
      - kind: other
        ref: "grep gates: brokerStateDir present in both vice-broker.mts and resources/vice-broker.mjs; repo-root.ts's census-gate comment recomputed and passing (11 -> 10 occurrences)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One broker serves two unrelated project directories at once, with its own state inside neither; with zero live sessions the broker still answers the handshake and reports itself healthy"
    requirement: "BROKER-01"
    verification:
      - kind: unit
        ref: "broker-e2e.test.ts#D-13 two-project case (one broker, two independent openBrokerControl() handshakes, state-dir containment assertion) and #zero-session case (handshake + status with no acquire performed)"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-09-19
status: complete
---

# Phase 62 Plan 4: The Fixed Endpoint and the Broker That Owns the Machine Summary

**A new plain-JavaScript `vice-cli.mjs` entry point that refuses a below-floor Node interpreter and dispatches `npx -y @henols/vice-mcp broker` to the compiled broker artifact, plus a fourth-precedence machine-level state-directory fallback in `vice-broker.mts` so a broker started with no project argument resolves under `~/.c64-re-tools/` and serves two unrelated projects from one process.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-19T15:53:26Z (approximate; first read of required context)
- **Completed:** 2026-09-19T16:24:22Z
- **Tasks:** 2
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments
- `src/mcp/vice/vice-cli.mjs`: the package's single binary and `main` entry, in plain JavaScript so its floor check can run below the type-stripping floor. Derives the required floor from `package.json`'s `engines.node` at runtime (never a duplicated literal), compares the running interpreter's own reported major version, and refuses by name — exit code 4, matching `resources/vice-launcher.sh`'s own floor-refusal code — before importing anything else in the package. Dispatches the third argv element: `broker` strips the subcommand token and dynamically imports `resources/vice-broker.mjs`, calling its exported `main(argv)` directly; everything else (`anno`, no subcommand) dynamically imports `vice-proxy.ts` with the argument vector untouched, which as a side effect gives the annotation route the same floor protection it lacked before.
- `package.json`'s `bin`/`main` retargeted to `vice-cli.mjs` (still exactly one binary key); `vice-cli.mjs` added to the published file list.
- `vice-broker.mts`'s `parseArgs()` gains a fourth, lowest-precedence state-directory step — `broker-home.mts`'s `brokerStateDir()` — reached only when no explicit `--state-dir`, no `VICE_POOL_DIR`, and no `--repo-root` apply. `--repo-root` is now optional; the usage refusal is narrowed to genuinely malformed invocations (an unrecognised token, or a flag missing its value) rather than firing merely because no project was named. The resolved state directory is now printed on stderr at startup, beside the bound-address line plan 62-03 added.
- One broker started with **no** project argument now starts and writes its discovery record under the machine-level root instead of printing the usage refusal, proven end-to-end against a real spawned artifact (never the developer's real home directory — `VICE_BROKER_HOME` points the fallback at a throwaway temp dir in every test).
- `broker-e2e.test.ts` gains the two-project case (one broker, two independent control-plane handshakes, state directory inside neither of two temporary "project" directories) and the zero-session case (a handshake still answers and reports healthy with no acquire ever performed).

## Task Commits

Each task was committed atomically:

1. **Task 1: One binary entry that refuses a below-floor interpreter, then dispatches** — `42b6a33b` (feat)
   - Follow-up fix (typecheck + dedupe, found during Task 2's plan-level `npm run typecheck` verification): `12884b46` (fix)
2. **Task 2: The broker owns its state at machine level, and one broker serves two projects** — `dd04aa19` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/mcp/vice/vice-cli.mjs` — the package's single binary/main entry: floor refusal, `broker` dispatch, proxy delegation
- `src/mcp/vice/vice-cli.d.mts` — ambient type declarations so `vice-cli.test.ts`'s static import typechecks under this package's strict, `allowJs:false` tsconfig
- `src/mcp/vice/vice-cli.test.ts` — 15 tests covering every `<behavior>` case, floor arithmetic, and manifest/packaging assertions
- `src/mcp/vice/package.json` — `bin`/`main` retargeted; `vice-cli.mjs` added to `files[]`
- `docs/phase58-declaration-provenance.md` — citation line numbers for `package.json`'s `engines.node` block updated (102-103 → 103-104) after `files[]` gained one entry
- `src/mcp/vice/vice-broker.mts` — fourth state-dir precedence step, optional `--repo-root`, narrowed usage refusal, stderr audit line
- `src/mcp/vice/resources/vice-broker.mjs` — regenerated compiled copy
- `src/mcp/vice/vice-broker-launch.test.ts` — replaced the retired "missing --repo-root refuses" test with its two actual halves, plus dedicated tests for all four state-dir precedence steps and the D-13 no-project fallback
- `src/mcp/vice/broker-e2e.test.ts` — two-project case and zero-session case; refactored the shared env-building logic into `buildBrokerEnv()` so a new `startBrokerWithArgv()` helper can spawn without `--repo-root`/`--state-dir`
- `src/mcp/vice/repo-root.ts` — `toolsDir()`'s census-gate comment recomputed (11 → 10 occurrences; one of `vice-broker.mts`'s two literal ternary branches now calls `brokerStateDir()` instead of joining the literal a second time)

## Decisions Made
- **`vice-cli.mjs`'s floor derivation is exercised through one exported function (`resolveFloorMajor`) used by both the real startup path and the tests**, rather than duplicating the manifest-parsing logic inline in `main()`.
- **The broker artifact's `main(argv)` is called explicitly with the subcommand token already stripped**, rather than rewriting `process.argv` to fake the artifact's own self-invocation check — cleaner, and matches the artifact's own exported signature.
- **`vice-cli.mjs` carries the same bottom-of-file "only run `main()` as the actual entry point" guard `vice-broker.mts` already uses** — without it, the test file's static import of the pure functions would re-run the floor check and dispatch against the test runner's own argv.
- **The four state-directory precedence cases are proven via real spawns of the emitted artifact, not by importing `parseArgs()` directly** — `vice-broker.mts`'s sibling `.mjs` imports only resolve beside the compiled artifact in `resources/`, so a direct value import from a `.test.ts` throws at module resolution.
- **The two-project case's "two clients configured against two project directories" is proven as two independent control-plane sessions against the broker's own machine-level state directory**, not by varying each session's dial target — there is deliberately no per-project discovery path under this phase's design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vice-cli.test.ts`'s static import of `vice-cli.mjs` failed `tsc --noEmit` under this package's `allowJs:false` strict tsconfig**
- **Found during:** Task 2 (running the plan-level `npm run typecheck` verification, after Task 1's own per-task `<verify>` — which never invokes `tsc` — had already passed and been committed)
- **Issue:** `import { ... } from "./vice-cli.mjs"` in a `.test.ts` file is flagged `TS7016: Could not find a declaration file for module` because TypeScript's `allowJs:false` refuses to read a plain `.mjs` file for typing, even under `noImplicitAny`-relaxing settings this project's `strict: true` does not have.
- **Fix:** Added `src/mcp/vice/vice-cli.d.mts`, an ambient declaration file for `vice-cli.mjs`'s exports, mirroring the pre-existing `test-gate.d.mts` precedent for the identical problem (`test-gate.mjs`/`test-gate.test.ts`). Also deduped `main()`'s floor derivation to call `resolveFloorMajor()` (the same function the declaration types) instead of re-deriving the floor inline.
- **Files modified:** `src/mcp/vice/vice-cli.d.mts` (new), `src/mcp/vice/vice-cli.mjs`
- **Verification:** `npm run typecheck` clean; `node --test vice-cli.test.ts` still 15/15 passing.
- **Committed in:** `12884b46` (separate follow-up commit, since Task 1's own commit had already landed when this was found)

**2. [Rule 1 - Bug] `repo-root.ts`'s census-gate comment went stale**
- **Found during:** Task 2 (full-suite regression pass)
- **Issue:** `repo-root.test.ts`'s census gate asserts `repo-root.ts`'s own doc comment names the EXACT count of every non-comment occurrence of the literal `".c64-re-tools"` across the codebase. The pre-existing comment counted `vice-broker.mts`'s `parseArgs()` ternary as contributing TWO occurrences (one per branch, both literal joins). This plan's fourth precedence step replaced the false branch's literal join with a call to `brokerStateDir()` — dropping that line to ONE literal occurrence and the codebase-wide total from 11 to 10.
- **Fix:** Updated the comment's claimed total (11 → 10) and the `vice-broker.mts` bullet's per-file breakdown (3 → 2), matching the census gate's own regex-parsed format.
- **Files modified:** `src/mcp/vice/repo-root.ts`
- **Verification:** `node --test repo-root.test.ts` — all 9 tests pass, including the census gate and its planted-violation control.
- **Committed in:** `dd04aa19` (Task 2 commit)

**3. [Rule 1 - Bug] `vice-broker-launch.test.ts`'s "missing --repo-root refuses" test would have hung the suite**
- **Found during:** Task 2 (running `vice-broker-launch.test.ts` after wiring the fourth precedence step)
- **Issue:** The pre-existing test spawned the broker SYNCHRONOUSLY (`spawnSync`, only valid for a code path that exits promptly) with no `--repo-root` and asserted a usage refusal. Once "no project was named" stopped being a refusal reason (this plan's own required behaviour change, D-13), that same invocation now starts a real, long-lived broker instead — `spawnSync` would block until its own internal timeout, and the resulting process would be left bound to a real port with no `VICE_BROKER_CONTROL_PORT=0` override.
- **Fix:** Replaced the single test with its two actual remaining halves — an unrecognised flag still refuses; a flag missing its value still refuses — plus a new async test proving the no-project case starts the broker under a `VICE_BROKER_HOME`-overridden temp directory (never the real home directory) rather than refusing.
- **Files modified:** `src/mcp/vice/vice-broker-launch.test.ts`
- **Verification:** `node --test vice-broker-launch.test.ts` — 20/20 pass; confirmed no orphaned `vice-broker.mjs` process and no listener left on port 19510 after the run.
- **Committed in:** `dd04aa19` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking typecheck gap, 2 direct/necessary bugs surfaced by this plan's own required behaviour changes). No scope creep — all three are direct consequences of code this plan's own tasks required.
**Impact on plan:** All three fixes were necessary for the plan's own new/changed code to leave the suite green and typecheck clean. None touches behaviour outside what this plan's tasks required.

## Issues Encountered

- `npm run test:automated` (the full suite, 3974 tests after this plan's additions — up from 62-03's own recorded 3959, an exact match against the 15 new `vice-cli.test.ts` tests) reproduces the same single pre-existing failure every prior plan in this phase has already logged: `phase58-citation-ledger.test.ts`'s citation-anchor drift in `.planning/PROJECT.md` (line 2083). Confirmed unrelated — `.planning/PROJECT.md` carries no changes from this plan. Not re-logged in `deferred-items.md` (already open there from plan 62-01).
- The project-specific dispatch notes quoted a different baseline ("4116 tests / 4034 pass / 1 fail / 81 skipped") than what this plan's own `npm run test:automated` run measured (3974/3964/1/9). This plan trusts the immediately-prior plan's own recorded SUMMARY figure (62-03: "3959 tests... reproduces the same single pre-existing failure") over the dispatch note, since 3959 + 15 new tests = 3974 exactly, and the pre-existing failure identity matches byte-for-byte across all four phase-62 plans' SUMMARYs. Flagged here rather than silently reconciled, in case the quoted 4116/81 figure describes a different scope (e.g. a full-repo run including `installer/`) that a later phase should account for.

## TDD Gate Compliance

Both tasks carry `tdd="true"`, but `workflow.tdd_mode` is `false` in `.planning/config.json` and this plan's own frontmatter `type` is `execute` (not `tdd`) — the strict RED/GREEN/REFACTOR gate enforcement in `gsd-core/references/tdd.md` is scoped to `type: tdd` plans under `tdd_mode: true`, neither of which applies here. Each task's test file and implementation were developed together and verified passing before commit, landing as single `feat(62-04)` commits rather than separate `test(62-04)`/`feat(62-04)` commits — disclosed per the gate-enforcement reference's own instruction to flag a missing separate RED commit, even though the gate itself is not active for this run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `npx -y @henols/vice-mcp broker` is now a real, working command — the fixed, path-free start command every refusal in plan 62-01 and every future service definition (plan 62-05) quotes.
- A broker started with no project argument is now the shape a systemd `--user` unit or launchd plist (plan 62-05) will actually invoke; its state lands under `~/.c64-re-tools/` (or `VICE_BROKER_HOME`), never inside whichever project happened to be current.
- `install-resources.ts` and `repo-root.ts`'s module-load deployment call are confirmed still present and untouched (D-04's verdict recorded, not executed) — Phase 66's deletion work is unaffected by anything in this plan.
- The `phase58-citation-ledger.test.ts` failure remains open in `deferred-items.md` for whichever phase or hygiene pass owns `.planning/PROJECT.md`'s citation ledger.
- BROKER-01 and BROKER-06 are both marked complete in `REQUIREMENTS.md` (the `requirements.ready-ids` shared-ID gate confirmed both are now fully satisfied — BROKER-06 was also declared by plan 62-02, which had left it unmarked pending this plan's completion).

---
*Phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine*
*Completed: 2026-09-19*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task/fix commit hashes (`42b6a33b`, `12884b46`, `dd04aa19`) verified present in `git log`.
