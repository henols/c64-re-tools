---
phase: 02-stock-backend-connection
plan: 07
subsystem: infra
tags: [backend-detection, broker, stock-vice, binary-monitor, security]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "02-03's ViceBackend type and backend-parameterised buildViceArgs()/backendFromEnv() (this plan retires backendFromEnv() and moves ViceBackend to backend-detect.mts); 02-05's monitorClient ownership work in the same vice-broker.mts/broker-launch.mts files, read but not altered by this plan's own changes"
provides:
  - "backend-detect.mts: the ONE reader of VICE_BACKEND in the whole tree -- resolvedBackend() (override -> cache -> --help probe, in that order), classifyHelpOutput() (pure -mcpserver/-binarymonitor string classification), probeBackend() (argv-array, shell:false, 5s-timeout --help probe with a --help/-help/-? fallback ladder), and readCapabilityRecord()/writeCapabilityRecord() (BACK-04's per-binary capability cache, same file)"
  - "The on-disk .vice-supervisor/backend.json cache: version 1, keyed on { resolvedPath, mtimeMs, sizeBytes }, atomic tmp-sibling -> chmod 0600 -> rename writes, malformed/absent/wrong-shaped files treated as a miss never an error"
  - "vice-broker.mts's run() resolving the backend exactly once, after the startup reap and before the control listener binds, threading the result down exactly like plan 02-03's backendFromEnv() call used to"
affects: [02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detection cached identity is passed in by the caller, never re-derived: backend-detect.mts accepts supervisorDir as a plain string option and never imports repo-root.ts's supervisorDir() itself, because a host-bound .mts compiled by build.ts cannot value-import a .ts-extension source (tsc's nodenext + real emission rejects it -- verified empirically) -- the container-side caller (a future plan) and vice-broker.mts (via its own already-resolved args.stateDir) both supply the resolved string instead"
    - "Override-vs-detection split memoisation: the VICE_BACKEND override path is always answered fresh from the environment and never touches the module-level memo; only the probe/cache-derived path is memoised once-per-process, mirroring container-guard.mts's isInsideContainer() precedent but split on a different signal (override presence, not explicit-deps presence) since the real override value legitimately varies test-to-test while the detected-binary answer for a fixed process does not"
    - "A test-only reset export (resetResolvedBackendForTests()) clears the in-process memo and the D-06 one-time-note gate between test scenarios in the same file/process -- documented as never called by any real production code path"

key-files:
  created:
    - .claude/mcp/vice/backend-detect.mts
    - .claude/mcp/vice/backend-detect.test.ts
    - .claude/mcp/vice/resources/backend-detect.mjs
    - .planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md
  modified:
    - .claude/mcp/vice/build.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/tsconfig.build.json
    - .claude/mcp/vice/broker-launch.mts
    - .claude/mcp/vice/broker-launch.test.ts
    - .claude/mcp/vice/vice-broker.mts
    - .claude/mcp/vice/resources/broker-launch.mjs
    - .claude/mcp/vice/resources/vice-broker.mjs
    - .gitignore
    - .planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md

key-decisions:
  - "backend-detect.mts never imports repo-root.ts's supervisorDir() as a static value -- a host-bound .mts compiled by build.ts's tsconfig.build.json (allowImportingTsExtensions: false, real emission) cannot resolve a .ts-extension import at all (TS5097, reproduced empirically against install-resources.ts/repo-root.ts's own .ts-extension imports once pulled into the build graph). supervisorDir is instead a plain, caller-supplied string option; vice-broker.mts passes its own already-resolved args.stateDir (the SAME directory supervisorDir() would compute)."
  - "resolvedBackend()'s module-level memo is split from the VICE_BACKEND override path: an explicit override is always answered fresh (never memoised, never gated by the D-06 note), while the probe/cache-derived answer is memoised once per process -- this is what lets both 'the broker never probes twice' and 'a test process can freely alternate override scenarios' hold simultaneously without a second signal."
  - "readCapabilityRecord()/writeCapabilityRecord() never invent a backend verdict of their own -- writeCapabilityRecord() is a no-op when no matching resolvedBackend()-written record already exists for the resolved binary, since a --help probe cannot observe a version quad and this function must not fabricate the field it did not observe either."
  - "tsconfig.build.json's include list and .gitignore's deployed-artifact block both needed a matching entry for backend-detect -- neither was in the plan's own files_modified list, both required to make build.ts and host-scripts.test.ts's two-way parity gate pass (Rule 3, blocking)."

requirements-completed: [BACK-01, BACK-04]

# Metrics
duration: ~45min
completed: 2026-08-13
---

# Phase 2 Plan 7: VICE Backend Detection Summary

**backend-detect.mts resolves fork-vs-stock once per broker process (override -> on-disk cache keyed on resolvedPath+mtimeMs+sizeBytes -> a bounded --help probe), replacing plan 02-03's temporary backendFromEnv() as the tree's one VICE_BACKEND reader -- with live-binary detection left explicitly unverified per this environment's own constraint.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-13
- **Tasks:** 2 completed / 2 planned
- **Files modified:** 10 modified, 4 created (including 1 new todo; 1 pre-existing todo cross-linked)

## Accomplishments

- `backend-detect.mts` is now the ONE reader of `VICE_BACKEND` in the whole
  tree (grep-gated tree-wide to exactly one occurrence of
  `process.env.VICE_BACKEND`, inside this file). `resolvedBackend()` honours
  the override first (no spawn), then a cache hit (no spawn, keyed on
  `{ resolvedPath, mtimeMs, sizeBytes }` so a binary swapped in place is
  noticed), then a real `--help` probe on a miss, writing the cache and
  memoising the answer in-process so a long-running broker resolves once.
- `probeBackend()` spawns via `node:child_process`'s `spawnSync` with an
  argv array and `shell: false` only -- never a shell string, never
  interpolation -- bounded by a 5000ms timeout with kill-on-timeout, falling
  back `--help` -> `-help` -> `-?` only when a run exits non-zero with empty
  combined stdout+stderr. `classifyHelpOutput()` is a pure string matcher on
  the literal `-mcpserver`/`-binarymonitor` tokens (D-02), with fork winning
  when both appear.
- An indeterminate outcome (classification `"unknown"`, including any spawn
  failure or timeout, which `probeBackend()` already reduces to
  `"unknown"`) never throws: `resolvedBackend()` returns a defined
  `{ backend: "fork", source: "indeterminate", note }`, logs the note once,
  and writes no cache entry -- the broker degrades to the pre-Phase-2
  fork-only behaviour rather than crashing or hanging.
- `vice-broker.mts`'s `run()` now calls `resolvedBackend()` exactly once,
  after the unconditional startup reap and before the control listener
  binds -- outside `broker-launch.mts`'s `inFlight` single-owner launch
  guard by construction (verified by reading `tryLaunchOne()`: no `await`
  between the check and the set, and no `resolvedBackend`/`probeBackend`
  call anywhere inside that guarded region). `backendFromEnv()` and its
  `ViceBackend` duplicate are deleted from `broker-launch.mts`, which now
  re-imports the type from `backend-detect.mjs` (type-only, preserving the
  file's "runs directly, unbuilt, under its own test file" property).
- `readCapabilityRecord()`/`writeCapabilityRecord()` give BACK-04's
  version-gated capability answers (a version quad, `CPUHISTORY_GET`
  availability) the same cache file, keyed the same way, ready for plan
  02-08's connect handshake to fill in once per binary rather than once per
  connect. A stored `versionQuad` that differs from a freshly observed one
  is reported `stale`.

## Task Commits

Each task was committed atomically:

1. **Task 1: backend-detect.mts -- probe, cache, override, one-time note (BACK-01, BACK-04, D-01/D-02/D-03)** - `7491431` (feat)
2. **Task 2: Resolve the backend once at broker startup, retire backendFromEnv() (D-01, D-03)** - `eac71bb` (feat)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

_Both tasks were `tdd="true"` in the plan; each landed as a single commit
adding tests and implementation together (verified green -- `node --test
backend-detect.test.ts resources-sync.test.ts build-atomic.test.ts` for task
1, `node --test backend-detect.test.ts broker-launch.test.ts
resources-sync.test.ts` for task 2 -- before each commit), since the added
behaviour either stood up a brand-new, already-tested module (task 1) or
extended existing green test files (task 2)._

## Files Created/Modified

- `.claude/mcp/vice/backend-detect.mts`, `.claude/mcp/vice/resources/backend-detect.mjs` - `classifyHelpOutput()`, `probeBackend()`, `resolvedBackend()`, `readCapabilityRecord()`/`writeCapabilityRecord()`, the atomic on-disk cache (tmp-sibling -> chmod 0600 -> rename), `resetResolvedBackendForTests()`
- `.claude/mcp/vice/backend-detect.test.ts` - 32 tests: classification (5, fixture strings labelled ASSUMED), probe fallback ladder (5), override precedence (3), cache hit/miss/malformed/absent (7), atomic write (2), indeterminate outcome (3), once-per-process memoisation and D-06 note (3), capability round-trip and staleness (4)
- `.claude/mcp/vice/build.ts` - `HOST_BOUND_ARTIFACTS` gains `backend-detect.mjs`
- `.claude/mcp/vice/tsconfig.build.json` - `include` gains `backend-detect.mts` (Rule 3 fix -- required for `build.ts` to compile it at all; not in the plan's own `files_modified`)
- `.claude/mcp/vice/package.json` - `files` gains `backend-detect.mts`, alongside `container-guard.mts`
- `.claude/mcp/vice/broker-launch.mts`, `.claude/mcp/vice/resources/broker-launch.mjs` - `ViceBackend` now a type-only re-import from `backend-detect.mjs`; `backendFromEnv()` deleted
- `.claude/mcp/vice/broker-launch.test.ts` - `backendFromEnv()` test removed (coverage moved to `backend-detect.test.ts`)
- `.claude/mcp/vice/vice-broker.mts`, `.claude/mcp/vice/resources/vice-broker.mjs` - value-imports `resolvedBackend`/`ViceBackend` from `backend-detect.mjs`; `run()` calls `resolvedBackend({ supervisorDir: args.stateDir })` once, after the reap and before the listener binds, and logs the resolved backend/source/binary path in the startup banner
- `.gitignore` - `/tools/backend-detect.mjs` added to the deployed-artifact block (Rule 3 fix -- `host-scripts.test.ts`'s two-way parity gate with `install-resources.ts`'s `resourceEntries()` requires it)
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md` - new todo tracking real-hardware confirmation of the `--help` discriminator (see Environment Constraint below)
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` - cross-linked to the new todo above

## Decisions Made

- `backend-detect.mts` never statically imports `repo-root.ts`'s
  `supervisorDir()` as a value. Verified empirically (a scratch `.mts` file
  added to `tsconfig.build.json`'s `include` and compiled) that
  `allowImportingTsExtensions: false` under real emission rejects a
  `.ts`-extension import outright (TS5097), and that `repo-root.ts`'s own
  transitive dependency (`install-resources.ts`) has the same problem --
  pulling either into the host-bound compile graph is a dead end. Instead,
  `supervisorDir` is a plain, caller-supplied string option on every public
  function; the container-side caller (a future plan) is expected to import
  `repoRoot.ts`'s `supervisorDir()` itself and pass the resolved string in,
  and `vice-broker.mts` passes its own already-resolved `args.stateDir`
  (proven identical to what `supervisorDir()` would compute, by reading
  `parseArgs()`'s own resolution). Omitting `supervisorDir` entirely
  degrades gracefully to probe-and-memoise-in-process only, never a thrown
  error or a guessed path.
- `resolvedBackend()`'s module-level memo only ever covers the
  probe/cache-derived answer -- the `VICE_BACKEND` override path is always
  read fresh and never populates or consults the memo, which is what lets
  the "resolves once per long-running process" guarantee and "a test
  process can freely alternate override scenarios in one file" both hold
  without a second signal (unlike `container-guard.mts`'s
  explicit-deps-bypasses-memo convention, which does not fit here since the
  real call site always supplies a `supervisorDir` deps value).
- `writeCapabilityRecord()` is a no-op, never a throw, when no matching
  `resolvedBackend()`-written record already exists for the resolved
  binary -- it can only extend an existing verdict, never fabricate one of
  its own, since a `--help` probe has no way to observe a version quad.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `backend-detect.mts` to `tsconfig.build.json`'s `include` list**
- **Found during:** Task 1, after writing `backend-detect.mts` and updating `build.ts`'s `HOST_BOUND_ARTIFACTS`
- **Issue:** `build.ts` reads `tsconfig.build.json` to decide which `.mts` sources `tsc` actually compiles; without adding the new file to that config's own `include` array, `node build.ts` would compile zero bytes of `backend-detect.mts` and then fail its own emitted-file-set assertion (`backend-detect.mjs` "missing"). Not listed in the plan's own `files_modified`.
- **Fix:** Added `"backend-detect.mts"` to `tsconfig.build.json`'s `include` array.
- **Files modified:** `.claude/mcp/vice/tsconfig.build.json`
- **Verification:** `node build.ts` succeeds, emitting 8 artifacts including `backend-detect.mjs` with the generated-file banner.
- **Committed in:** `7491431` (Task 1 commit)

**2. [Rule 3 - Blocking] Added `/tools/backend-detect.mjs` to `.gitignore`'s deployed-artifact block**
- **Found during:** Task 2, running the full `npm run test:automated` gate
- **Issue:** `host-scripts.test.ts`'s two-way parity check between `.gitignore` and `install-resources.ts`'s `resourceEntries()` (which walks `resources/` dynamically) failed: `.gitignore` was missing the line for the newly deployable `backend-detect.mjs`, which would show up as untracked noise in `git status` the first time the MCP installer deploys it into a consuming project's `tools/`.
- **Fix:** Added `/tools/backend-detect.mjs` to `.gitignore`'s deployed-path block, alphabetically ordered ahead of `broker-control.mjs`.
- **Files modified:** `.gitignore`
- **Verification:** `node --test host-scripts.test.ts` passes (4/4); `npm run test:automated` drops from 2 failures to the 1 pre-existing worktree-path artifact.
- **Committed in:** `eac71bb` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed the acceptance grep for `process.env.VICE_BACKEND` matching zero times instead of exactly once**
- **Found during:** Task 2, self-check against the plan's own acceptance criteria
- **Issue:** The first draft of `resolvedBackend()` read the override via a generic `env` local (`const env = deps.env ?? process.env; ... env.VICE_BACKEND`), which never produces the literal substring `process.env.VICE_BACKEND` the plan's own acceptance grep requires (exactly 1 occurrence tree-wide, inside `backend-detect.mts`).
- **Fix:** Rewrote the override read as `deps.env ? deps.env.VICE_BACKEND : process.env.VICE_BACKEND`, producing exactly one real occurrence of the literal substring; also removed a comment that had accidentally introduced a second (non-code) occurrence of the same substring.
- **Files modified:** `.claude/mcp/vice/backend-detect.mts`
- **Verification:** `grep -rn 'process.env.VICE_BACKEND' .claude/mcp/vice --include=*.ts --include=*.mts | grep -v '.test.' | wc -l` returns 1, in `backend-detect.mts`.
- **Committed in:** `7491431` (Task 1 commit -- caught and fixed before Task 1's own commit, since the code in question is Task 1's file; the acceptance criterion itself is listed under Task 2)

---

**Total deviations:** 3 auto-fixed (2 blocking/build-config, 1 bug/acceptance-mismatch). None touched runtime behaviour beyond what the plan itself specified; all three were necessary to make the plan's own build, test, and acceptance-grep commands pass.

## Environment Constraint Compliance (scope override, 2026-08-13)

**Live-binary backend detection is unverified in this environment**, per the
explicit user ruling for this plan: "we can't do tests with deciding what
vice is" -- build detection, test only the override and cache. No stock or
fork VICE binary is reachable here. Concretely:

- Every test in `backend-detect.test.ts` drives one of three tested
  surfaces: (a) the `VICE_BACKEND` override path, (b) the on-disk cache's
  read/write/invalidate/staleness lifecycle, and (c)
  `classifyHelpOutput()`'s pure string-parsing logic against fixture
  strings authored in the test file itself.
- Every fixture string fed to `classifyHelpOutput()` is explicitly labelled
  in-test as an ASSUMED shape (e.g. `"the ASSUMED fixture text contains
  -mcpserver"`), never presented as real captured `--help` output from
  either build.
- `probeBackend()`'s own spawn seam (`spawnHelp`) is injected with a stub in
  every test that reaches it; `node:child_process`'s real `spawnSync` is
  never invoked by any test in this tree.
- `docs/phase2-backend-probe-evidence.md` §2's OPEN verdict on the `--help`
  discriminator is left standing, unmodified and unresolved either way by
  this plan.
- A new follow-up todo,
  `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`,
  records exactly what a real-hardware run must confirm: that
  `probeBackend()` returns `"stock"` for a real stock binary and `"fork"`
  for a real fork binary (not `"unknown"` for either), what to do if either
  returns `"unknown"`, and how to upgrade the evidence doc's verdict once
  confirmed. The pre-existing sibling todo (binmon wire-protocol fixtures)
  is cross-linked to it.

**What real-hardware confirmation must still establish** (deferred, not
resolved by this plan): whether a real stock build's `--help`/`-help`/`-?`
output actually contains the literal `-binarymonitor` token (and omits
`-mcpserver`), whether a real fork build's output contains `-mcpserver`,
and whether stock's argument parser's exit-code behaviour matches what the
fallback ladder assumes. Until that confirmation happens, `resolvedBackend()`
against a REAL, unconfigured binary could return `"unknown"` (safe --
degrades to `"fork"`, logs a note, never crashes) or could misclassify if a
real build's `--help` output has an unanticipated shape neither previewed
here.

## Known Stubs

None. Every code path this plan adds is exercised by its own unit tests, all
using injected dependencies rather than hardcoded empty values. The
"indeterminate -> fork" degradation is a deliberate, documented, tested
fallback, not a stub.

## Threat Flags

None beyond the plan's own `<threat_model>`, which already covers every
trust boundary this plan's code touches (T-02-03: spawn safety; T-02-02:
cache poisoning; T-02-25: probe-inside-inFlight; T-02-26: detection-failure
DoS; T-02-27: cache file permissions).

## Issues Encountered

- Same pre-existing worktree-path test artifact prior plans in this phase
  (02-01, 02-03, 02-05) documented: `repo-root.test.ts`'s "path agreement...
  not under .claude" assertion fails inside this nested worktree checkout
  (`.../c64-re-tools/.claude/worktrees/agent-.../`), unrelated to and
  untouched by either of this plan's two tasks. `npm run test:automated` is
  397/403 passing (5 `todo`, 1 pre-existing worktree-path artifact) in this
  worktree.
- One transient failure in `build-atomic.test.ts`'s own "concurrent builds"
  test was observed once across several full-suite runs and did not
  reproduce on any subsequent run -- consistent with a timing-sensitive,
  pre-existing test (it spawns multiple real `tsc` processes concurrently)
  rather than a regression from this plan's changes; not investigated
  further per this plan's own scope boundary (out-of-scope pre-existing
  flake, not introduced by this plan's diffs).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-08's connect handshake can call `readCapabilityRecord()`/
  `writeCapabilityRecord()` against the same `.vice-supervisor/backend.json`
  cache to record BACK-04's version-gated capability answers (version quad,
  `CPUHISTORY_GET` availability) once per binary, keyed identically to the
  backend verdict this plan already writes there.
- `resolvedBackend()`'s `{ backend, source, binPath, note? }` return shape
  is ready for any caller that wants to report *why* a given backend was
  selected (override vs. cache vs. probe vs. indeterminate), not merely
  which one.
- **Live-binary verification is the standing blocker for closing the new
  follow-up todo**, not for this plan's own completion -- `resolvedBackend()`
  and `probeBackend()` are fully implemented, unit-tested (override + cache
  + classification), and wired into the broker's startup path; only the
  question "does a real build's `--help` actually say what
  `classifyHelpOutput()` assumes" remains open, tracked in
  `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`.
- No blockers to phase progress. The one worktree-path test artifact noted
  above is expected to self-resolve once this worktree's commits land in
  the main checkout, as the identical artifacts in 02-01, 02-03, and 02-05
  did.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/backend-detect.mts`
- FOUND: `.claude/mcp/vice/backend-detect.test.ts`
- FOUND: `.claude/mcp/vice/resources/backend-detect.mjs`
- FOUND: `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`
- FOUND commit `7491431` (feat: backend-detect.mts -- probe, cache, override, one-time note)
- FOUND commit `eac71bb` (feat: resolve the backend once at broker startup, retire backendFromEnv())
