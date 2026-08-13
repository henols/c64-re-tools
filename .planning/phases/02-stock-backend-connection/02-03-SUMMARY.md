---
phase: 02-stock-backend-connection
plan: 03
subsystem: infra
tags: [broker, launch, process-supervision, security, stock-vice, binary-monitor]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "02-01's narrowed npm run test:automated gate, used as this plan's own regression gate"
provides:
  - "buildViceArgs()/backendFromEnv(): a backend-parameterised broker launch argv builder (fork byte-identical, stock's -binarymonitor/-binarymonitoraddress with a loopback-default bind), and the ONE VICE_BACKEND reader in the broker"
  - "reapOrphanedInstances() driven entirely by the broker's own on-disk allocation record (epoch.json pid + vice_bin per instance directory), with the argv-substring identity heuristic deleted outright"
affects: [02-07, 02-04, 02-05, 02-06, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backend selection resolved exactly once at process startup (backendFromEnv(), called from vice-broker.mts's run()) and threaded down through every real launch call site as a plain value -- never re-read per launch"
    - "Kill-target identity for an unconditional startup reap comes from the broker's own on-disk allocation record (epoch.json), never from scanning the host process table or matching substrings in another process's argv"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/broker-launch.mts
    - .claude/mcp/vice/broker-launch.test.ts
    - .claude/mcp/vice/vice-broker.mts
    - .claude/mcp/vice/broker-kill.mts
    - .claude/mcp/vice/broker-kill.test.ts
    - .claude/mcp/vice/broker-control.test.ts
    - .claude/mcp/vice/vice-broker-launch.test.ts
    - .claude/mcp/vice/resources/broker-launch.mjs
    - .claude/mcp/vice/resources/broker-kill.mjs
    - .claude/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "backend/binmonHost are optional on every internal Deps interface (TryLaunchDeps, AcquirePortAndLaunchDeps, MaintainWarmFloorDeps, SuperviseChildDeps, HandleAcquireDeps), defaulting to \"fork\" when omitted -- every pre-Phase-2 test in this tree that never mentions backend keeps exercising the exact byte-identical fork argv it always has, with no test rewrite required beyond the two real launch call sites in vice-broker.mts"
  - "reapOrphanedInstances()'s found/killed semantics changed meaning: found now counts instance directories that yielded a usable pid (not host processes matched by argv), consistent with the reap no longer listing host processes at all"
  - "Deleted resolveViceBinForReap() alongside discoverBandProcesses()/argsNamePortAtOrAbove() -- once both call sites were gone it was fully dead code, and per-instance vice_bin from epoch.json is now the only identity source the reap ever consults"

patterns-established:
  - "Pattern: a Deps interface field threaded through multiple call layers (backend, binmonHost) stays optional at every internal layer and is defaulted once, at the layer closest to the field's own definition (spawnAndRecordInstance's buildViceArgs call), so every existing caller at every other layer is unaffected by construction"

requirements-completed: [BROK-01, BROK-03]

# Metrics
duration: ~11min
completed: 2026-08-13
---

# Phase 2 Plan 3: Backend-Selected Launch and Allocation-Record-Driven Reap Summary

**`buildViceArgs()` now builds either backend's launch argv from one decision point (fork byte-identical, stock's `-binarymonitor`/`-binarymonitoraddress` with a loopback default), and the startup reap now kills only pids the broker's own `epoch.json` records launching -- the argv-substring heuristic that could SIGTERM unrelated host processes is deleted outright.**

## Performance

- **Duration:** ~11 min (first commit 10:46:45 CEST, last task commit 10:56:58 CEST)
- **Started:** 2026-08-13T10:46:45+02:00
- **Completed:** 2026-08-13T10:56:58+02:00
- **Tasks:** 2 completed / 2 planned
- **Files modified:** 10 (0 created, 10 modified)

## Accomplishments

- `buildViceArgs(port, { backend, ... })` builds either backend's launch
  argv from one decision point: `"fork"` returns the exact pre-Phase-2
  `-mcpserver` shape, byte-identical; `"stock"` returns
  `-binarymonitor -binarymonitoraddress ip4://<host>:<port>` with a
  loopback-default bind and a one-time stderr note when widened away from
  it. `backendFromEnv()` is now the sole reader of `VICE_BACKEND` in the
  broker, resolved once at startup in `vice-broker.mts`'s `run()` and
  threaded as a plain value through both real launch call sites
  (`handleAcquire`'s cold arm, `maintainWarmFloorForRealBroker`'s warm arm)
  -- never re-read per launch.
- `reapOrphanedInstances()`'s kill half is rewritten to enumerate on-disk
  instance directories and read each one's own `epoch.json` for `pid` and
  `vice_bin`, calling `verifiedKill()` with that per-instance identity.
  `discoverBandProcesses()`/`argsNamePortAtOrAbove()` and the
  `listProcesses`/`defaultListProcesses` plumbing that existed only to
  serve them are deleted outright -- closing the folded todo
  (`.planning/todos/pending/2026-08-12-broker-orphan-reap-substring-identity-match.md`)
  where a plain substring match over any host process's full argv, gated
  only by "some integer >= basePort appears somewhere," was observed
  killing two unrelated orchestrator shell processes on a developer's host.
- Every pre-existing broker guarantee this plan touches still passes its
  own test unmodified in behavior: `inFlight`'s synchronous check-and-set
  (no `await` between), crash supervision (`superviseChild`/backoff/give-up),
  the unconditional-reap-before-listener-bind source-order check, and
  incident-record-before-kill.

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend-selected launch argv (BROK-01, D-12)** - `ff2ba13` (feat)
2. **Task 2: Reap from the broker's own allocation record (BROK-03, D-14/D-15)** - `19535f8` (fix)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

_Both tasks were `tdd="true"` in the plan; in practice each landed as a
single commit adding both the new tests and the implementation together
(no separate RED-only commit), since the added behavior was additive to an
existing, already-green test file rather than a fresh module -- verified
green immediately (`node --test broker-launch.test.ts` / `broker-kill.test.ts`)
before each commit._

## Files Created/Modified

- `.claude/mcp/vice/broker-launch.mts` - `ViceBackend` type, backend-parameterised `buildViceArgs()`, `backendFromEnv()`, `backend`/`binmonHost` threaded (optional, fork-default) through `TryLaunchDeps`/`AcquirePortAndLaunchDeps`/`MaintainWarmFloorDeps`/`SuperviseChildDeps`
- `.claude/mcp/vice/broker-launch.test.ts` - new `buildViceArgs`/`backendFromEnv` test section (6 tests): fork byte-identical, `VICE_ARGS` override for both backends, stock loopback default, stock override, one-time widened-bind stderr note, `backendFromEnv()`'s exact-string matching
- `.claude/mcp/vice/vice-broker.mts` - resolves `backend` once via `backendFromEnv()` in `run()`, threads it into `handleAcquire`'s `HandleAcquireDeps.backend` and `maintainWarmFloorForRealBroker`'s new third parameter
- `.claude/mcp/vice/broker-kill.mts` - deletes `discoverBandProcesses()`, `argsNamePortAtOrAbove()`, `resolveViceBinForReap()`, `ProcessListEntry`/`ProcessListingProbe`/`defaultListProcesses`/`DiscoverBandProcessesOptions`; rewrites `reapOrphanedInstances()`'s kill half to read each instance directory's own `epoch.json`
- `.claude/mcp/vice/broker-kill.test.ts` - replaces the deleted-function tests with 7 tests against the new allocation-record-driven reap, including a `listProcesses`-shaped decoy proving it is never invoked
- `.claude/mcp/vice/broker-control.test.ts` - updated one structural test's region end-marker string to `maintainWarmFloorForRealBroker`'s new 3-parameter signature
- `.claude/mcp/vice/vice-broker-launch.test.ts` - updated a stale comment describing the now-retired substring-match hazard
- `.claude/mcp/vice/resources/broker-launch.mjs`, `.claude/mcp/vice/resources/broker-kill.mjs`, `.claude/mcp/vice/resources/vice-broker.mjs` - rebuilt via `node build.ts`

## Decisions Made

- `backend`/`binmonHost` are optional at every internal `Deps` interface
  layer, defaulting to `"fork"` only inside `spawnAndRecordInstance()`
  (the one place `buildViceArgs()` is actually called) -- this meant zero
  pre-existing tests in `broker-launch.test.ts` needed rewriting; only the
  two real call sites in `vice-broker.mts` (which now explicitly resolve
  and pass `backend`) changed behavior.
- `reapOrphanedInstances()`'s `found` count now means "instance directories
  that yielded a usable pid," not "host processes matched by an argv scan"
  -- a necessary semantic shift given the reap no longer lists host
  processes at all; every existing test asserting `found`/`killed` was
  re-derived against the new semantics rather than merely re-pointed at
  new fixtures.
- Deleted `resolveViceBinForReap()` alongside the two functions it only
  ever served, rather than leaving it as dead code -- it had no other
  caller once `discoverBandProcesses()`'s call site was gone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned missing `node_modules` before verification**
- **Found during:** pre-Task-1 setup
- **Issue:** This worktree had no `node_modules` at all, so `node build.ts`/`tsc` would fail with `ENOENT` (the same environment gap 02-01's own SUMMARY documented for its own worktree).
- **Fix:** Ran `npm ci --no-audit --no-fund` in `.claude/mcp/vice`. No source change; `node_modules/` remains gitignored.
- **Committed in:** N/A (environment-only)

**2. [Rule 1 - Bug] Fixed a structural test's end-marker string after `maintainWarmFloorForRealBroker()`'s signature grew a third parameter**
- **Found during:** Task 1 typecheck/test run
- **Issue:** `broker-control.test.ts`'s `extractSourceRegion()`-based structural gate matched an exact literal string for `maintainWarmFloorForRealBroker`'s old 2-parameter signature as its region end-marker; adding the required `backend: ViceBackend` parameter (per this task's own instruction to thread `backend` down to both real launch call sites) made that literal stop matching, failing the test.
- **Fix:** Updated the literal end-marker string in `broker-control.test.ts` to the new 3-parameter signature. No behavioral change to what the structural gate checks.
- **Files modified:** `.claude/mcp/vice/broker-control.test.ts`
- **Verification:** `node --test broker-control.test.ts` passes.
- **Committed in:** `ff2ba13` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed a second structural test's region end-marker after deleting `ProcessListEntry`**
- **Found during:** Task 2 test run
- **Issue:** `broker-kill.test.ts`'s own D-10/D-11 structural gate used `"export interface ProcessListEntry"` as the end-marker for `startupBanner()`'s exempted region; deleting that interface (per this task's own instruction) made the marker unfindable, failing the gate's own setup assertion.
- **Fix:** Updated the end-marker to `"function resolveBasePortForReap"`, the next stable declaration after `startupBanner()` in the new source.
- **Files modified:** `.claude/mcp/vice/broker-kill.test.ts`
- **Verification:** `node --test broker-kill.test.ts` passes (all 35 tests).
- **Committed in:** `19535f8` (Task 2 commit)

**4. [Rule 1 - Bug] Updated three stale comments naming the deleted `discoverBandProcesses()` by name**
- **Found during:** Task 2, acceptance-criteria self-check (`grep -rn 'discoverBandProcesses'` was required to return 0 tree-wide, not just in `broker-kill.mts`)
- **Issue:** `broker-kill.mts`'s own new section header, `broker-kill.test.ts`'s new section header, and `vice-broker-launch.test.ts`'s pre-existing rationale comment for using a unique stub binary path all named `discoverBandProcesses()` literally while describing the mechanism this task retires -- leaving them would both fail the plan's own acceptance grep and document removed code as if still current.
- **Fix:** Reworded all three comments to describe the retired mechanism without naming the deleted function, and rewrote `vice-broker-launch.test.ts`'s comment to state the hazard is now closed (per D-15) while keeping the unique-path practice as standing hygiene.
- **Files modified:** `.claude/mcp/vice/broker-kill.mts`, `.claude/mcp/vice/broker-kill.test.ts`, `.claude/mcp/vice/vice-broker-launch.test.ts`
- **Verification:** `grep -rn 'discoverBandProcesses' .claude/mcp/vice --include=*.ts --include=*.mts --include=*.mjs` returns 0 lines tree-wide.
- **Committed in:** `19535f8` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking/environment, 3 bug/stale-reference).
**Impact on plan:** All four were necessary to make the plan's own acceptance criteria and pre-existing structural gates pass; none touched runtime behavior beyond what the plan itself specified.

## Issues Encountered

- **One pre-existing test failure is a worktree-path artifact, not a
  regression from this plan** -- identical to the one 02-01's own SUMMARY
  documented: `repo-root.test.ts`'s "path agreement... the agreed path is
  not under .claude" assertion fails inside this specific nested worktree
  checkout (`.../c64-re-tools/.claude/worktrees/agent-.../`) because that
  path itself contains a literal `.claude` segment before the repo root.
  Confirmed unmodified (`git status --short repo-root.test.ts` empty) and
  out of scope (neither task touches that file). `npm run test:automated`
  is 314/315 passing (5 `todo`) in this worktree as a result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-07 (backend detection, D-01) is expected to replace
  `backendFromEnv()`'s body with `backend-detect.mts`'s cached detection
  verdict -- `backendFromEnv()`'s own doc comment states this explicitly
  and forbids a second `VICE_BACKEND` reader appearing before then.
- The stock binary-monitor launch shape (`-binarymonitor
  -binarymonitoraddress ip4://<host>:<port>`) is implemented and unit-tested
  against argv construction only. **Live verification against a real stock
  `x64sc -binarymonitor` process is deferred** -- this environment has no
  stock VICE binary available, per this plan's explicit environment
  constraint. The documented `-binarymonitor`/`-binarymonitoraddress`
  surface (docs/phase1-probe-results.md) is assumed correct and will be
  confirmed empirically in a later phase once a real build is reachable.
- No blockers. The one worktree-path test artifact noted above is expected
  to self-resolve once this worktree's commits land in the main checkout
  (as 02-01's identical artifact did).

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/broker-launch.mts`
- FOUND: `.claude/mcp/vice/broker-kill.mts`
- FOUND: `.claude/mcp/vice/resources/broker-launch.mjs`
- FOUND: `.claude/mcp/vice/resources/broker-kill.mjs`
- FOUND commit `ff2ba13` (feat: backend-selected broker launch argv)
- FOUND commit `19535f8` (fix: reap from the broker's own allocation record)
