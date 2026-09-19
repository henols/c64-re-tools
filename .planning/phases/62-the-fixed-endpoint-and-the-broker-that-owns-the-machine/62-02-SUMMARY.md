---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
plan: 02
subsystem: broker-control-plane
tags: [filesystem, env-vars, machine-level-state, host-bound, comments]

# Dependency graph
requires: []
provides:
  - "src/mcp/vice/broker-home.mts: the machine-level broker root (VICE_BROKER_HOME, D-13) and six derived resolvers plus ensureBrokerDir()"
  - "Three client-side comment sites (vice-broker-client.ts, vice-errors.ts, vice-proxy.ts) restated to the v2.0.0 enumerated-bridge bind rule (D-09, D-11)"
affects: [62-03, 62-04, phase-66-convergence]

# Actuals (#2632)
actuals:
  tokens: 8544
  tasks: 2
  commits: 2
plan_head_before: 3ced6be343fecbb26aa18260ac57704617371d61

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable {env, homedir} options object on every resolver in a host-bound module -- the project's standing injection convention, applied where the suite has no mocking library"
    - "A derived resolver's default anchors to the machine root directly (not to a sibling resolver's own overridden result), keeping each of the four legacy directory variables independently testable"

key-files:
  created:
    - src/mcp/vice/broker-home.mts
    - src/mcp/vice/broker-home.test.ts
    - src/mcp/vice/resources/broker-home.mjs
  modified:
    - src/mcp/vice/build.ts
    - src/mcp/vice/tsconfig.build.json
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/vice-errors.ts
    - src/mcp/vice/vice-proxy.ts

key-decisions:
  - "brokerEpochFile()'s default anchors to the machine root's own default supervisor path, never to brokerStateDir()'s own (possibly overridden) result -- keeps each of the four legacy variables' effects independent of one another, matching the plan's own 'four separate assertions' acceptance criterion"
  - "brokerStateDir() honours VICE_SUPERVISOR_DIR as a second, lower-priority alias for the same directory VICE_POOL_DIR wins for -- reconciles CLAUDE.md/D-14's four-variable count with the fact that no production module in this tree currently reads VICE_SUPERVISOR_DIR (verified by search); this module has no consumer yet (plan 62-04 wires the broker process to it), so the alias changes no existing runtime behaviour"
  - "Added broker-home.mts to tsconfig.build.json's include list and updated repo-root.ts's toolsDir() census comment (10->11 occurrences, 6->7 files) -- both required for the build and the census gate to pass, neither named in the plan's own files_modified list"

requirements-completed: [BROKER-06]

coverage:
  - id: D1
    description: "A broker-owned machine-level root exists one level above every project, with six derived directory resolvers and an idempotent, race-safe directory creator"
    requirement: "BROKER-06"
    verification:
      - kind: unit
        ref: "broker-home.test.ts (18 tests: exact export set, no-env default, relative/absolute/empty VICE_BROKER_HOME, all four legacy-variable precedence cases, two-project isolation over six resolved paths, ensureBrokerDir idempotence, per-kind runs dir, HOST_BOUND_ARTIFACTS membership)"
        status: pass
      - kind: unit
        ref: "resources-sync.test.ts, build-atomic.test.ts (build() emits broker-home.mjs byte-identical to source, atomic write path unaffected)"
        status: pass
      - kind: unit
        ref: "repo-root.test.ts (census gate: toolsDir()'s comment and the real tree agree on 11 occurrences across 7 files, including this plan's new file)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three client-side comment sites (dial-resolution header, mcpHost() header, connectivity-failure diagnostic) no longer teach that the broker binds the wildcard address; all three state the enumerated-bridge rule instead, and the wildcard-bind classifier's own code/comment is untouched"
    requirement: "BROKER-06"
    verification:
      - kind: other
        ref: "grep-based structural gates: zero occurrences of the three stale phrases, exactly 2 wildcard-address occurrences remaining in vice-broker-client.ts (the classifier's own), 'enumerated bridge' present in all three files, diff scoped to exactly 3 files with every changed line a comment marker"
        status: pass
      - kind: unit
        ref: "npm run typecheck (clean); npm run test:automated (3949 tests, 1 pre-existing unrelated failure, unchanged from before this task)"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-09-19
status: complete
---

# Phase 62 Plan 2: The Fixed Endpoint and the Broker That Owns the Machine Summary

**A new host-bound `broker-home.mts` resolving `VICE_BROKER_HOME` (default `~/.c64-re-tools`) plus six derived broker-owned directories, and three client-side comments rewritten from the retired wildcard-bind rule to the v2.0.0 enumerated-bridge rule.**

## Performance

- **Duration:** 19 min (approximate)
- **Started:** 2026-09-19T14:53:00Z (approximate)
- **Completed:** 2026-09-19T15:11:51Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments
- `src/mcp/vice/broker-home.mts`: `brokerHome()` resolves the machine-level root from `VICE_BROKER_HOME` (absolute override, relative-made-absolute, or empty-string-as-unset) else `<home>/.c64-re-tools`, never throwing.
- Six derived resolvers -- `brokerStateDir`, `brokerIncidentsDir`, `brokerEpochFile`, `brokerStagingDir`, `brokerRunsDir(kind)` -- each honouring its own pre-existing legacy variable first (three of the four wired variables map onto three distinct resolvers; `VICE_SUPERVISOR_DIR` aliases `VICE_POOL_DIR`'s resolver -- see Decisions) and `ensureBrokerDir()`, a single recursive, already-exists-tolerant `mkdirSync` so two concurrent creations both succeed.
- `resources/broker-home.mjs` compiled and committed alongside its `.mts` source in the same commit; `build.ts`'s `HOST_BOUND_ARTIFACTS` and `tsconfig.build.json`'s `include` both updated so the artifact is actually emitted.
- Two-project isolation proven directly: with an injected home directory outside two distinct `mkdtemp` project roots, none of the six resolvers' paths falls inside either root.
- Three client-side comment sites (`vice-broker-client.ts`'s dial-resolution header, `vice-errors.ts`'s `mcpHost()` header, `vice-proxy.ts`'s connectivity-failure diagnostic header) rewritten from the retired "broker binds 0.0.0.0, never 127.0.0.1" rule to the v2.0.0 rule: loopback plus enumerated bridge-gateway addresses from an interface-name allowlist, never the wildcard address -- with a new sentence in the first site recording that the narrowing IS the access-control mechanism now that the per-boot token is dropped. The wildcard-bind classifier's own code and its correctness comment (2 remaining `0.0.0.0` occurrences in `vice-broker-client.ts`) are untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: One machine-level root the broker owns, and every directory derived from it** - `1fb36125` (tracer -- mislabelled, should have been `feat`; see Deviations)
2. **Task 2: Stop three client-side comments teaching the reversed bind rule** - `93ba77d3` (docs)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/mcp/vice/broker-home.mts` - the machine-level root, six derived resolvers, `ensureBrokerDir()`
- `src/mcp/vice/broker-home.test.ts` - 18 tests covering every `<behavior>` case plus export-set and HOST_BOUND_ARTIFACTS checks
- `src/mcp/vice/resources/broker-home.mjs` - regenerated compiled copy
- `src/mcp/vice/build.ts` - `HOST_BOUND_ARTIFACTS` gains `broker-home.mjs`
- `src/mcp/vice/tsconfig.build.json` - `include` gains `broker-home.mts` (deviation, see below)
- `src/mcp/vice/repo-root.ts` - `toolsDir()`'s census comment updated to 11 occurrences / 7 files (deviation, see below)
- `src/mcp/vice/vice-broker-client.ts` - dial-resolution header restated to the enumerated-bridge rule
- `src/mcp/vice/vice-errors.ts` - `mcpHost()`'s header restated to the enumerated-bridge rule
- `src/mcp/vice/vice-proxy.ts` - connectivity-failure diagnostic header restated generically

## Decisions Made
- **`brokerEpochFile()`'s default is anchored to the machine root's own default supervisor path, not to `brokerStateDir()`'s live (possibly overridden) result.** The plan's action text describes the default as "inside the resolved state directory", which read literally would chain `VICE_POOL_DIR`'s override into `brokerEpochFile()`'s default too -- breaking the plan's own acceptance criterion that setting one legacy variable leaves "the other three... resolving from the machine-level root". Anchoring to a private `defaultStateDir()` helper instead keeps all four legacy variables' effects mutually independent, mirroring the existing codebase's own precedent (`vice-errors.ts`'s `EPOCH_FILE` already defaults from the un-overridden `supervisorDir()`, not from a `VICE_POOL_DIR`-aware wrapper).
- **`brokerStateDir()` also honours `VICE_SUPERVISOR_DIR`.** CLAUDE.md and D-14 both name four pre-existing directory variables (`VICE_POOL_DIR`, `VICE_SUPERVISOR_DIR`, `VICE_INCIDENTS_DIR`, `VICE_EPOCH_FILE`), and the plan's acceptance criteria call for "four separate assertions", but the plan's own `<action>` text wires only three (pool, incidents, epoch) with no legacy variable named for the fourth. A codebase-wide search confirmed no production module currently reads `process.env.VICE_SUPERVISOR_DIR` -- it exists in comments only. Since this module has no consumer yet (plan 62-04 wires the broker process to it), adding `VICE_SUPERVISOR_DIR` as a second, lower-priority alias for the same directory `VICE_POOL_DIR` wins for reconciles both texts without changing any existing runtime behaviour.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsconfig.build.json` needed `broker-home.mts` added to its `include` list**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` names only `HOST_BOUND_ARTIFACTS` in `build.ts` as needing the new artifact; `build.ts`'s own header states that `tsconfig.build.json`'s `include` list "IS the definition of host-bound". Without adding `broker-home.mts` there, `tsc -p tsconfig.build.json` would never compile it and `build()`'s emitted-set assertion would fail with a "missing" artifact.
- **Fix:** Added `"broker-home.mts"` to `tsconfig.build.json`'s `include` array.
- **Files modified:** `src/mcp/vice/tsconfig.build.json`
- **Verification:** `npm run build` succeeds and emits `resources/broker-home.mjs`.
- **Committed in:** `1fb36125` (Task 1 commit)

**2. [Rule 1 - Bug] `repo-root.ts`'s census comment would go stale**
- **Found during:** Task 1
- **Issue:** `repo-root.test.ts` runs a structural "census gate" asserting that `repo-root.ts`'s own doc comment names the EXACT count and file list of every non-comment occurrence of the literal `".c64-re-tools"` across the codebase. `broker-home.mts` necessarily joins this literal directly (it is host-bound and cannot import `repo-root.ts`, per that file's own convention for the five files already doing this), adding an 11th occurrence in a 7th file -- which the pre-existing comment (claiming 10 occurrences across 6 files) would then disagree with, failing the gate.
- **Fix:** Updated the comment's claimed count (10->11) and file list (added a `broker-home.mts` bullet naming its one occurrence), matching the existing bullet format the census gate's regex parses.
- **Files modified:** `src/mcp/vice/repo-root.ts`
- **Verification:** `node --test repo-root.test.ts` -- all 9 tests pass, including the census gate and its planted-violation control.
- **Committed in:** `1fb36125` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking build-config gap, 1 structural-test staleness), both direct, necessary consequences of adding a new host-bound module that joins an existing literal-and-census convention. No scope creep -- neither touches any file outside what the new module's own existence requires.

## Issues Encountered

- **Task 1's commit was mislabelled `tracer(62-02): ...` instead of `feat(62-02): ...`.** The task's frontmatter type is `type="auto" tdd="true"`, not `type="tracer"` -- the wrong label was carried over by mistake while drafting the commit message from the previous plan's (62-01, which genuinely had a tracer task) SUMMARY. The commit's content is correct and complete; only the semantic type word is wrong. Not amended, per this project's standing "always create new commits, never amend" policy -- disclosed here instead. No downstream tooling in this repo greps commit-type prefixes outside the TDD-gate check below, which does not apply.
- `npm run test:automated` (the full suite, 3949 tests) reproduces the same single pre-existing failure plan 62-01's own SUMMARY already logged: `phase58-citation-ledger.test.ts`'s citation-anchor drift in `.planning/PROJECT.md` (line 2083, an anchor no longer found in its cited range). Confirmed unrelated to this plan -- `.planning/PROJECT.md` carries no changes from this plan and the failure is byte-identical to the one already recorded in `deferred-items.md`. One additional test, `anno-durability.test.ts`, failed on a single full-suite run under system load but passed cleanly both in isolation and on a repeat full-suite run immediately after -- a pre-existing timing-sensitive flake in a module this plan's comment-only Task 2 changes cannot affect (it imports only `ViceError` from `vice-errors.ts`, and that file's diff is comment-only), not investigated further per this executor's scope boundary.

## TDD Gate Compliance

Task 1 carries `tdd="true"`, but `workflow.tdd_mode` is `false` in `.planning/config.json` and this plan's own frontmatter `type` is `execute` (not `tdd`) -- the strict RED/GREEN/REFACTOR gate enforcement described in `gsd-core/references/tdd.md` is scoped to `type: tdd` plans under `tdd_mode: true`, neither of which applies here. The task's test file (`broker-home.test.ts`, covering every `<behavior>` case) and its implementation (`broker-home.mts`) were nonetheless developed together and verified passing before commit, but landed as a single `tracer(62-02)` commit rather than separate `test(62-02)`/`feat(62-02)` commits -- disclosed here per the gate-enforcement reference's own instruction to flag a missing separate RED commit, even though the gate itself is not active for this run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `broker-home.mts` is ready to be wired into the actual broker process by plan 62-04, which will slot its resolvers in as the fourth, lowest-precedence step below `vice-broker.mts`'s existing `--state-dir`/`VICE_POOL_DIR`/repo-relative-default chain.
- The two remaining D-11 comment sites (`broker-control.mts`'s header and its compiled copy) are plan 62-03's work, untouched here.
- The `phase58-citation-ledger.test.ts` failure remains open in `deferred-items.md` (logged by plan 62-01) for whichever phase or hygiene pass owns `.planning/PROJECT.md`'s citation ledger.
- `VICE_SUPERVISOR_DIR`'s status as a documented-but-previously-unwired variable (see Decisions) is worth a note for whoever plans Phase 66's removal of the four legacy variables (D-14, currently unowned work) -- this plan gives it a real, if secondary, effect for the first time.

---
*Phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine*
*Completed: 2026-09-19*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`1fb36125`, `93ba77d3`) verified present in `git log`.
