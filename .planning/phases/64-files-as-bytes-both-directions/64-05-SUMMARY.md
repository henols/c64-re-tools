---
phase: 64-files-as-bytes-both-directions
plan: 05
subsystem: infra
tags: [broker, lifecycle, reap, config-scratch, staging, tmpfs, cleanup]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 03)
    provides: "broker-transfer.mts's staging directory layout (stageFileSlot/clearStagingForSession) under broker-home.mts's brokerStagingDir() -- this plan's sweepOrphanedStaging() reaps what that layout leaves behind at startup"
provides:
  - "broker-home.mts: brokerConfigScratchDir() -- a ninth per-kind directory resolver under the machine-level broker root"
  - "broker-launch.mts: spawnAndRecordInstance() creates the per-launch stock config-scratch directory under brokerConfigScratchDir() instead of the OS temp directory, and writes a pid-liveness record (ConfigScratchOwnerRecord) as a sibling JSON file beside it"
  - "broker-kill.mts: reapOrphanedConfigScratch() (live-pid-guarded) and sweepOrphanedStaging() (unconditional, no pid check) -- two new startup-only reap passes with deliberately opposite lifetime rules"
  - "vice-broker.mts: both new reaps wired into the existing unconditional startup-reap block, beside reapOrphanedInstances() and before the control listener binds"
affects: [64-06, 64-07]

actuals:
  tokens: 20665
  tasks: 3
  commits: 3
  plan_head_before: c158ddc76f6e50c0d22f343f47aeabe3fb7f3dab

tech-stack:
  added: []
  patterns:
    - "Duplicated-by-convention root derivation: broker-launch.mts cannot value-import broker-home.mts's own brokerConfigScratchDir() (it must stay importable unbuilt by its own test file, the same unbuilt-import constraint every other host-bound sibling reference in this file already respects), so it duplicates the VICE_BROKER_HOME/.c64-re-tools derivation locally -- the SAME established convention this codebase already uses for the .c64-re-tools literal in five other files, now six, tracked by repo-root.ts's own census gate (updated this plan: 10 -> 11 occurrences, 7 -> 8 files)."
    - "Sibling-record, never nested: the per-launch config-scratch directory's pid-liveness record is written as a sibling JSON file (<dir>.json) in the SAME parent as the directory it describes, never a file inside it -- the directory's own contents belong entirely to the spawned emulator's XDG_CONFIG_HOME use."
    - "Opposite lifetime rules, one module, two passes: reapOrphanedConfigScratch() (live-pid-guarded: never remove a directory whose owning process is still alive) and sweepOrphanedStaging() (unconditional: every staging session directory found at startup is by definition residue) sit in broker-kill.mts side by side, sharing the module and the startup-only cadence but never the removal rule."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-home.mts
    - src/mcp/vice/broker-home.test.ts
    - src/mcp/vice/broker-launch.mts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/broker-kill.mts
    - src/mcp/vice/broker-kill.test.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-broker-staging.test.ts
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/stock-broker-live.test.ts
    - src/mcp/vice/stock-live-broker-monitor.test.ts
    - src/mcp/vice/text-monitor-live.test.ts
    - src/mcp/vice/resources/broker-home.mjs
    - src/mcp/vice/resources/broker-launch.mjs
    - src/mcp/vice/resources/broker-kill.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "The pid-liveness record lives BESIDE the config-scratch directory (a sibling `<dir>.json`), never inside it -- the directory's own contents belong entirely to the spawned emulator's XDG_CONFIG_HOME use, and this repo's `beside` convention (established elsewhere: ldefs/slafile, host-tool.mts's vendor siblings) reads consistently as 'same parent, not nested'."
  - "reapOrphanedConfigScratch()'s found/removed counters count DIRECTORIES ENUMERATED and DIRECTORIES REMOVED respectively (not 'kill candidates' the way reapOrphanedInstances()'s found/killed pair does) -- the clearer, more literal reading for a removal-only pass with no kill step of its own."
  - "sweepOrphanedStaging() accepts an (unused) `isAlive` seam purely so a test can prove, by injecting a spy that must never fire, that the pass genuinely has no pid check -- an intentionally-unused parameter, documented as such, rather than silently omitting the seam and leaving 'no pid check' as an unverifiable claim."
  - "Task 3's 'run the startup path' verification is done through the SAME production root-resolution wiring vice-broker.mts itself calls (brokerConfigScratchDir()/brokerStagingDir(), no arguments, reading VICE_BROKER_HOME) against the real compiled artifacts, rather than invoking the full daemon's run() (which binds real sockets and is exercised elsewhere, e.g. broker-kill.test.ts's own e2e shutdown tests) -- this proves the roots this plan wires match the roots the staging/launch code actually uses, which is the load-bearing risk this task's own verification names."

requirements-completed: [XFER-07]
# XFER-07 was declared by 64-03 (already complete) and this plan -- both
# declaring plans have now finished, so requirements.ready-ids marks it
# complete during this plan's own update_requirements step.

coverage:
  - id: D1
    description: "A stock launch's per-launch config-scratch directory (XDG_CONFIG_HOME) lands under the machine-level broker root's config-scratch subdirectory, never the OS temp directory, with a sibling pid-liveness record carrying the child's pid and the emulator binary's own identity"
    requirement: XFER-07
    verification:
      - kind: unit
        ref: "broker-launch.test.ts#spawnAndRecordInstance (I-1 rider, extended by 64-05/D-08, via tryLaunchOne): a stock launch's injected spawn stub receives XDG_CONFIG_HOME under the fixture broker root's config-scratch subdirectory, never a direct child of the OS temp directory"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#spawnAndRecordInstance (64-05/D-08): the config-scratch parent directory is created when absent, and two stock launches in a row both succeed"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#spawnAndRecordInstance (64-05/D-08): the pid record beside the scratch directory carries both the child's pid and the emulator binary identity"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#structural (64-05/D-08): broker-launch.mts's 'Config-scratch lifetime' comment no longer claims this directory is never cleaned up, no longer claims it accumulates under the OS temp directory, and names broker-kill.mts as the reap's owner"
        status: pass
      - kind: unit
        ref: "broker-home.test.ts#brokerConfigScratchDir(): resolves a config-scratch subdirectory under the machine-level root, same precedence as brokerStagingDir()"
        status: pass
    human_judgment: false
  - id: D2
    description: "reapOrphanedConfigScratch() applies a mandatory live-pid-and-identity guard -- a directory owned by a live, matching process is never touched; an alive-but-mismatched (reused pid) or gone process is removed; an unreadable record is left alone and logged by name, never removed on a guess"
    requirement: XFER-07
    verification:
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch: a directory whose injected liveness reports the pid alive with a matching identity is left completely untouched"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch: a directory whose injected liveness reports the pid gone is removed"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch: a directory whose pid is alive but whose identity disagrees (a reused pid) is removed"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch: a directory with an absent or unparsable pid record is left in place and is named in the log"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch: a single throwing entry does not abort the pass -- the remaining entries are still processed"
        status: pass
    human_judgment: false
  - id: D3
    description: "sweepOrphanedStaging() removes every staging session directory it finds at startup, unconditionally and with no pid check at all -- proven by an injected liveness spy that must never fire"
    requirement: XFER-07
    verification:
      - kind: unit
        ref: "broker-kill.test.ts#sweepOrphanedStaging: removes every session directory it finds, and its injected liveness check is never called"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#sweepOrphanedStaging: a single throwing removal does not abort the sweep -- the remaining entries are still processed"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#reapOrphanedConfigScratch/sweepOrphanedStaging: both log found and removed as zero when the root is empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both new sweeps run in the real broker's own unconditional startup-reap block, beside reapOrphanedInstances() and before the control listener binds -- exercised against the real compiled artifacts through the same production root-resolution wiring the real broker uses"
    requirement: XFER-07
    verification:
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker startup reap (64-05, D-07/D-08): a fixture broker root's leftover staging directory is gone, and a config-scratch directory whose recorded process is alive is left in place"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#structural: the real broker's startup reap runs before its control listener accepts (source-order check, complementing the live end-to-end shutdown tests above)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two reap passes genuinely apply opposite lifetime rules to their respective kinds of scratch -- a code-shape property a test can only sample, not prove"
    verification: []
    human_judgment: true
    rationale: "The plan's own <human-check> names this explicitly: 'a code-shape property a test can only sample, not prove.' Read side by side during this plan's own execution: reapOrphanedConfigScratch() refuses to remove while isAlive()+identity-match both hold; sweepOrphanedStaging() has no such guard at all and removes unconditionally. Recorded here for the verifier to re-confirm rather than re-derive."
  - id: D6
    description: "No new repeating timer was introduced for either sweep, and the full pre-existing suite's failing-test set is unchanged"
    verification:
      - kind: other
        ref: "grep -c 'setInterval(' vice-broker.mts (comment-stripped): 2 before this plan, 2 after"
        status: pass
      - kind: integration
        ref: "npm test (full suite): 4390 tests, 4306 pass, 0 fail, 84 skipped -- failing set unchanged (empty) from the pre-plan baseline (4371/4287/0/84, per 64-03-SUMMARY.md)"
        status: pass
      - kind: other
        ref: "resources-sync.test.ts"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 5: A Crashed Broker's Leftovers Are Reaped, Never a Live Emulator's Configuration Summary

**Per-launch stock config-scratch directories move off this host's unaged tmpfs onto the machine-level broker root, and two new startup-only sweeps in `broker-kill.mts` -- one live-pid-guarded, one unconditional -- clean up what a crashed broker left behind without ever touching a still-running emulator's own configuration.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-23T12:48Z (approx., continuing from 64-04)
- **Completed:** 2026-09-23T13:19Z
- **Tasks:** 3
- **Files modified:** 17 (13 source/test + 4 regenerated build artifacts)

## Accomplishments

- `broker-launch.mts`'s `spawnAndRecordInstance()` now creates a stock launch's `XDG_CONFIG_HOME` scratch directory under `broker-home.mts`'s new `brokerConfigScratchDir()` root (a ninth per-kind directory resolver, mirroring `brokerStagingDir()`) instead of the OS temp directory -- stopping the RAM leak this host's unaged tmpfs suffered (4,779 leaked directories measured after 7 days' uptime). A pid-liveness record (`ConfigScratchOwnerRecord`: pid + the emulator binary's own resolved identity) is written atomically (temp-then-rename) as a SIBLING JSON file beside each scratch directory, never inside it.
- The "Scratch-dir lifetime" comment above the creation site is rewritten in this same change: it no longer claims the directory is never cleaned up or that these accumulate under the OS temp directory, and now names `broker-kill.mts` as the reap's owner.
- `broker-launch.mts` cannot value-import `broker-home.mts` (it must stay importable unbuilt by its own test file), so it duplicates the root derivation locally -- the same established convention this codebase already uses for the `.c64-re-tools` literal elsewhere. `repo-root.ts`'s own census-gate comment is updated to account for this seventh -> eighth file, tenth -> eleventh occurrence.
- `broker-kill.mts` gains two new startup-only reap passes, side by side with the existing `reapOrphanedInstances()`: `reapOrphanedConfigScratch()` (MANDATORY live-pid-and-identity guard -- a directory owned by a live, matching process is never touched; alive-but-mismatched or gone is removed; an unreadable record is left alone and logged by name) and `sweepOrphanedStaging()` (NO pid check at all -- every staging session directory found at startup is, by definition, residue a crashed broker left, and is removed unconditionally). A module comment states the rule a future reader must not collapse: these two kinds share a module and a root but never a lifetime rule.
- `vice-broker.mts` calls both new sweeps in its existing unconditional startup-reap block, beside `reapOrphanedInstances()` and before the control listener binds -- the existing reap's own ordering and unconditional nature are unchanged.
- `vice-broker-staging.test.ts` (plan 64-03's own fixture file) gains a startup-integration case exercising the same production root-resolution wiring (`brokerConfigScratchDir()`/`brokerStagingDir()`, no arguments, reading `VICE_BROKER_HOME`) against the real compiled artifacts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the per-launch emulator config scratch under the broker root, and rewrite the comment that says nobody cleans it** - `20411764` (feat)
2. **Task 2: Two reap passes in one module, two opposite lifetime rules** - `06ca2f04` (feat)
3. **Task 3: Call both sweeps at broker startup, before the listener binds** - `e87522e6` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/mcp/vice/broker-home.mts` - new `brokerConfigScratchDir()` per-kind resolver
- `src/mcp/vice/broker-home.test.ts` - export-count/two-project-isolation tests extended, new resolver's own test added
- `src/mcp/vice/broker-launch.mts` - config-scratch relocation, pid-record writer, rewritten lifetime comment
- `src/mcp/vice/broker-launch.test.ts` - fixture-based rewrite of the I-1 rider test, new parent-creation/pid-record/comment-content tests
- `src/mcp/vice/broker-kill.mts` - `reapOrphanedConfigScratch()`, `sweepOrphanedStaging()`, their options/result types
- `src/mcp/vice/broker-kill.test.ts` - new test section for both reaps; `VICE_BROKER_HOME` added to the file's own real-broker-subprocess fixture
- `src/mcp/vice/vice-broker.mts` - both new sweeps wired into the startup-reap block
- `src/mcp/vice/vice-broker-staging.test.ts` - new startup-integration case
- `src/mcp/vice/repo-root.ts` - census-gate comment updated (10 -> 11 occurrences, 7 -> 8 files)
- `src/mcp/vice/vice-broker-acquire.test.ts`, `src/mcp/vice/stock-broker-live.test.ts`, `src/mcp/vice/stock-live-broker-monitor.test.ts`, `src/mcp/vice/text-monitor-live.test.ts` - deviation fixes (see below)
- `src/mcp/vice/resources/broker-home.mjs`, `resources/broker-launch.mjs`, `resources/broker-kill.mjs`, `resources/vice-broker.mjs` - regenerated build artifacts

## Decisions Made

See `key-decisions` in the frontmatter for the full reasoning on: sibling-not-nested pid records, the found/removed counter semantics, the intentionally-unused `isAlive` seam on `sweepOrphanedStaging()`, and Task 3's verification approach (real wiring functions against real compiled artifacts, not the full daemon).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Four test files that spawn a real broker or exercise the real cold-launch path without `VICE_BROKER_HOME` set would have written into a real `~/.c64-re-tools`**
- **Found during:** Task 1 (implementing the config-scratch relocation) and confirmed by the full-suite run in Task 3
- **Issue:** `vice-broker-acquire.test.ts`'s "handleAcquire cold acquire" test (runs unconditionally, no skip gate) and three "live" harness files (`stock-broker-live.test.ts`, `stock-live-broker-monitor.test.ts`, `text-monitor-live.test.ts`, all default-skipped without `VICE_LIVE_STOCK_BIN` set) each spawn a real broker (or exercise `handleAcquire()`'s real stock cold-launch path) with no `VICE_BROKER_HOME` override. Once the config-scratch root moved off the OS temp directory to the machine-level broker root, these would have silently created directories under the real developer's `~/.c64-re-tools/config-scratch/` during a test run -- exactly the kind of leak this plan exists to stop, just relocated rather than eliminated.
- **Fix:** Each now sets `VICE_BROKER_HOME` to its own existing `mkdtempSync` fixture directory (already torn down in each file's own `finally`/harness teardown), confining the real broker's config-scratch use to the test's own sandbox. `vice-broker-acquire.test.ts`'s one assertion that hardcoded the old `tmpdir()`-relative location was updated to assert against the fixture's own `config-scratch` subdirectory instead; `stock-broker-live.test.ts`'s equivalent live-only assertion was updated the same way.
- **Files modified:** `src/mcp/vice/vice-broker-acquire.test.ts`, `src/mcp/vice/stock-broker-live.test.ts`, `src/mcp/vice/stock-live-broker-monitor.test.ts`, `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** `vice-broker-acquire.test.ts` (unconditional, runs in every environment) re-run green (47/47); the three live-harness files self-skip in this sandbox (no `VICE_LIVE_STOCK_BIN` set) but were fixed for correctness on any host where they do run.
- **Committed in:** `20411764` (Task 1 commit)

**2. [Rule 3 - Blocking] `repo-root.ts`'s ".c64-re-tools" literal census-gate comment went stale the moment `broker-launch.mts` gained a new occurrence of the literal**
- **Found during:** Task 3's full-suite run (`repo-root.test.ts`'s own census gate failed, naming the exact drift)
- **Issue:** `repo-root.ts`'s `toolsDir()` doc comment claims an exact count and file list of every non-comment `.c64-re-tools` occurrence in the codebase, machine-checked by `repo-root.test.ts`. This plan's Task 1 added a new occurrence (in `resolveConfigScratchRoot()`'s duplicated derivation), which the comment did not yet know about.
- **Fix:** Updated the count (10 -> 11) and file count (7 -> 8), and added a bullet naming `broker-launch.mts`'s new occurrence, matching every other duplicated consumer's own documented convention.
- **Files modified:** `src/mcp/vice/repo-root.ts`
- **Verification:** `repo-root.test.ts` re-run green (9/9), including both the census gate and its planted-violation control.
- **Committed in:** `20411764` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 -- bug/leak prevention across four collateral test files, 1 Rule 3 -- a blocking structural-gate failure this plan's own change caused).
**Impact on plan:** Both fixes are direct, necessary consequences of relocating the config-scratch directory (this plan's own stated deliverable); neither is scope creep.

## Issues Encountered

None beyond the deviations above.

## Verifying the `inFlight` guard stayed a synchronous check-and-set

`broker-launch.mts`'s single-owner `inFlight` boolean (declared at module scope, checked/set inside `tryLaunchOne()`) was not touched by this plan at all -- this plan's changes are entirely inside `spawnAndRecordInstance()`, which `tryLaunchOne()` calls only AFTER its own synchronous guard check-and-set has already completed with no `await` in between. Verified by reading `tryLaunchOne()`'s full body after the edits (unchanged) and by `broker-launch.test.ts`'s own pre-existing concurrency race test (`isLaunchInFlight()`-based), which still passes.

## Human-check confirmation (opposite lifetime rules)

Read `reapOrphanedConfigScratch()` and `sweepOrphanedStaging()` side by side in `broker-kill.mts`: the former refuses to remove a directory whenever its injected `isAlive` reports true AND the identity check agrees (a mandatory guard, no override path); the latter has no `isAlive`/liveness parameter it actually consults at all (the one it accepts exists solely so a test can prove it is never called) and removes every enumerated entry unconditionally. The two do not share a removal rule.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `XFER-07` (declared by 64-03 and this plan, both now complete) is ready to mark complete via `requirements.ready-ids`.
- Plans 64-06 and 64-07 are unaffected by this plan's scope (config-scratch/staging lifecycle) and can proceed independently.
- The spawn-site census (`grep -aln 'spawnFn(\|spawn(' *.mts | grep -v '\.test\.'`) still lists `tool-location.mts`, `host-tool.mts` and `broker-launch.mts` -- unchanged from before this plan. This is the grep's own imprecision (it matches the literal substring `spawn(` anywhere, including non-emulator external-tool spawns in the other two files) and is pre-existing, not introduced by this plan; the emulator-spawn set itself is still exactly one member (`broker-launch.mts`), still argv-array only.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All key files (`broker-home.mts`, `broker-launch.mts`, `broker-kill.mts`, `vice-broker.mts`,
`vice-broker-staging.test.ts`, and this SUMMARY itself) verified present on disk; all 3 task
commits (`20411764`, `06ca2f04`, `e87522e6`) verified present in `git log`.
