---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 01
subsystem: broker
tags: [tool-location, backend-detect, vice-broker, broker-launch, tools.json]

# Dependency graph
requires:
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "tool-location.mts's resolveTool()/resolveOnPath() seam and its ResolveToolDeps/ResolveToolResult shapes"
provides:
  - "resolvedBackend() resolves the emulator binary through the tool-location seam when no explicit override is injected"
  - "vice-broker.mts threads one resolved viceBin down through HandleAcquireDeps, acquirePortAndLaunch(), superviseDepsFor() and onHostState"
  - "broker-launch.mts is a pure consumer of deps.viceBin, with no environment-variable fallback of its own"
  - "vice-proxy.ts's module-level resolvedBackend() call passes toolsDir/projectRoot so vice_ping agrees with the broker"
  - "Three regenerated, committed host-bound artifacts: resources/backend-detect.mjs, resources/vice-broker.mjs, resources/broker-launch.mjs"
affects: [61-the-prerequisite-doctor-and-its-capability-map]

# Actuals (#2632)
actuals:
  tokens: 14322
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy dual-path require() (node:module createRequire) for a host-bound module's own VALUE dependency on another host-bound sibling, when the importing module must also stay safely importable unbuilt by container-side production code -- tries the compiled resources/ sibling first, falls back to the unbuilt source sibling, resolved at the call site rather than at parse time"
    - "typeof-import type-only re-export (import type { fn } from './x.mjs'; type FnType = typeof fn;) to get a real call-signature type from a sibling that cannot be statically value-imported"

key-files:
  created: []
  modified:
    - src/mcp/vice/backend-detect.mts
    - src/mcp/vice/broker-launch.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/resources/backend-detect.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-launch.mjs

key-decisions:
  - "backend-detect.mts loads the tool-location seam through node:module's createRequire() (existsSync-gated: compiled resources/tool-location.mjs sibling first, else the unbuilt tool-location.mts sibling) rather than a static ESM import, because this file ships two ways -- unbuilt beside vice-proxy.ts (a real production entry point with no build step) and compiled beside vice-broker.mjs -- and a static \"./tool-location.mjs\" specifier resolves in only the second form; a static import would have crashed vice-proxy.ts at startup the instant this file gained the seam dependency."
  - "superviseDepsFor() (vice-broker.mts) gained a viceBin parameter not named anywhere in the plan's own action text, because narrowing broker-launch.mts's fallback to deps.viceBin ?? \"x64sc\" (removing the process.env.VICE_BIN fallback) would otherwise have made a crash-respawned instance silently spawn the bare \"x64sc\" literal instead of the same binary a tools.json entry or VICE_BIN resolved for the launch it replaces."
  - "The Task 1 acceptance criterion \"backend-detect.test.ts passes with no case modified\" is satisfied literally, at zero diff -- the file needed no changes at all, because the seam load is deferred (createRequire, not a static import) past every one of its existing test cases, all of which inject viceBin/resolveBinPath and never reach the seam-calling branch."

requirements-completed: [LOC-01, LOC-02, LOC-03]

coverage:
  - id: D1
    description: "A tools.json entry for x64sc is the exact string the real spawn call receives, with no emulator env var set"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "vice-broker-acquire.test.ts#Plan 60-01 Test 1 (LOC-01 tracer): a bare-string x64sc entry in tools.json is the exact string the real spawn call receives, with no emulator env var set"
        status: pass
    human_judgment: false
  - id: D2
    description: "The emulator env var wins over a present tools.json entry, both at the seam and at the real spawn call"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "vice-broker-acquire.test.ts#Plan 60-01 Test 2: the emulator env var wins over a present tools.json entry, both at the seam and at the real spawn call"
        status: pass
    human_judgment: false
  - id: D3
    description: "With no tools.json file present at all, resolution -- and the real spawn call -- are exactly what they are today"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "vice-broker-acquire.test.ts#Plan 60-01 Test 3: with no tools.json file present at all, resolution -- and the real spawn call -- are exactly what they are today"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two resolutions of x64sc in one process agree on path/layer/mechanism, and the environment candidate is tried before any $PATH candidate"
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "vice-broker-acquire.test.ts#Plan 60-01 Test 4: two resolutions of x64sc in one process agree on path/layer/mechanism, and the environment candidate is tried before any $PATH candidate"
        status: pass
    human_judgment: false
  - id: D5
    description: "No seam call and no emulator-environment-variable read remain in backend-detect.mts or broker-launch.mts; no seam call sits inside broker-launch.mts's inFlight guard region"
    requirement: "LOC-02"
    verification:
      - kind: other
        ref: "grep -acE 'env[.]VICE_BIN' backend-detect.mts broker-launch.mts vice-broker.mts vice-proxy.ts -> 0,0,0,0; awk-scoped grep for resolveTool( inside the inFlight region -> 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The three host-bound artifacts are regenerated from current sources, committed, and resources-sync.test.ts is green against them"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "resources-sync.test.ts (2/2 pass)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Production entry point (vice-proxy.ts) still starts up correctly, unbuilt, after backend-detect.mts gained the seam dependency"
    requirement: "LOC-01"
    verification:
      - kind: other
        ref: "manual: node -e 'import(\"./vice-proxy.ts\")' -- printed the ready banner with a real resolved binary path, no throw"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 01: The Seam Wired Into the Code That Ships Summary

**`resolvedBackend()` now resolves `x64sc` through the tool-location seam (env -> tools.json -> $PATH), and the one resolved value is threaded down through the broker, its crash-respawn path, and the proxy -- with zero duplicated ordering left in any of the three rewired modules.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-18T13:07:48Z (approx., per STATE.md's own "Phase 60 execution started" note)
- **Completed:** 2026-09-18T13:43:37Z
- **Tasks:** 3
- **Files modified:** 8 (5 source, 3 regenerated host-bound artifacts)

## Accomplishments
- `backend-detect.mts`'s `resolvedBackend()` calls `tool-location.mts`'s `resolveTool("x64sc", ...)` when neither `viceBin` nor `resolveBinPath` is injected -- a `.c64-re-tools/tools.json` entry for `x64sc` now changes what the broker actually spawns, while an explicit override (every existing test, and any future caller that needs one) still bypasses the seam byte-for-byte.
- `defaultResolveBinPath()` collapses into a thin wrapper over the seam's own `resolveOnPath()` -- the first of Phase 59 D-02's three independent `$PATH`-walk copies to collapse.
- `vice-broker.mts` resolves the binary exactly once at startup (with an explicit `toolsDir`/`projectRoot`, not a guessed fallback), threads the same value through `HandleAcquireDeps.viceBin`, `acquirePortAndLaunch()`, `superviseDepsFor()` (a crash respawn was the one launch path the plan's own action text didn't name, and would otherwise have silently reverted to the bare `"x64sc"` literal), `makeLoggingSpawn()`'s log filename, and `onHostState`'s reported `viceBin` field. `resolveViceBinForHostState()` is deleted outright.
- `broker-launch.mts` drops its `process.env.VICE_BIN` fallback at both duplicated sites (`spawnAndRecordInstance()`, `launchSupervised()`) -- it is now a pure consumer of `deps.viceBin`, with the literal `"x64sc"` surviving only as a last-resort default for a caller that supplies neither.
- `vice-proxy.ts`'s module-level `resolvedBackend()` call now passes `{ toolsDir: toolsDir(), projectRoot: repoRoot() }`, so `vice_ping`'s `resolvedBinaryPath` agrees with the same seam resolution the broker uses.
- Four new end-to-end test cases in `vice-broker-acquire.test.ts` prove the tools.json path reaches a real (stubbed) spawn call, the environment variable still wins over the file, an absent file behaves exactly as before, and two resolutions in one process agree with the environment candidate tried before any `$PATH` candidate.
- Three host-bound artifacts regenerated and committed: `resources/backend-detect.mjs`, `resources/vice-broker.mjs`, `resources/broker-launch.mjs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: A tools.json path for x64sc reaches the real spawn call -- one path, every layer** - `2abb7ff6` (feat)
2. **Task 2: The three remaining emulator-binary reads become consumers of the once-resolved value** - `984e35ca` (feat)
3. **Task 3: Regenerate and commit the three host-bound artifacts, and prove the sync guard green** - `9dbc0644` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/backend-detect.mts` - `resolvedBackend()` gains the tool-location seam as an internal dependency, loaded lazily via `createRequire()`; `defaultResolveBinPath()` collapses onto `resolveOnPath()`; `ResolvedBackendDeps` gains `toolsDir`/`projectRoot`/`locate`.
- `src/mcp/vice/broker-launch.mts` - both `viceBin` resolution sites drop their environment-variable fallback; doc comments on `TryLaunchDeps.viceBin`/`AcquirePortAndLaunchDeps.viceBin` updated.
- `src/mcp/vice/vice-broker.mts` - `run()` resolves `viceBin` once with an explicit `toolsDir`/`projectRoot`; `HandleAcquireDeps.viceBin` added and threaded through `handleAcquire()`, `acquirePortAndLaunch()` and `superviseDepsFor()`; `makeLoggingSpawn()` takes `viceBin` as a second parameter; `onHostState` reports the same resolved value; `resolveViceBinForHostState()` deleted.
- `src/mcp/vice/vice-proxy.ts` - the module-level `resolvedBackend()` call passes `toolsDir`/`projectRoot`.
- `src/mcp/vice/vice-broker-acquire.test.ts` - four new Plan 60-01 test cases; the pre-existing BACK-02 composition test fixed to pass `viceBin` explicitly instead of relying on the now-removed `process.env.VICE_BIN` fallback.
- `src/mcp/vice/resources/backend-detect.mjs`, `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/resources/broker-launch.mjs` - regenerated by `build.ts` from the sources above.

## Decisions Made

- **Lazy `createRequire()` dual-path load instead of a static ESM import for the seam.** `backend-detect.mts` ships two ways: unbuilt, imported directly by `vice-proxy.ts` (a real production entry point with no build step, per this project's own "no build step at runtime" constraint) and by several test files; and compiled into `resources/` for `vice-broker.mts`. A static `import ... from "./tool-location.mjs"` resolves at parse time and only exists as a real sibling file in the SECOND form -- adding one would have made `vice-proxy.ts` throw `ERR_MODULE_NOT_FOUND` at startup the instant this plan landed (verified empirically: a bare `node vice-proxy.ts`-equivalent import crashes immediately on an unresolvable static specifier, even when the imported binding is never used). `toolLocationSeam()` instead calls `createRequire(import.meta.url)` and resolves at the CALL SITE: it tries `./tool-location.mjs` (the compiled sibling) first via an `existsSync` check, falling back to `./tool-location.mts` (the unbuilt sibling) -- the exact two-candidate, first-that-exists idiom `tool-location.mts`'s own `readDeclaration()` already uses for `prerequisites.json`. Verified working in both shipped forms (see Deviations below). The seam's own TYPES are still imported statically, but only via `import type` (fully erased at runtime, resolved for types only through tsc's ordinary NodeNext ".mjs"-maps-to-".mts" convention), so `typeof resolveTool`/`typeof resolveOnPath` stay available as real call-signature types with no runtime resolution attempt.
- **`superviseDepsFor()` gained a `viceBin` parameter the plan's action text never named.** Narrowing `broker-launch.mts`'s fallback to `deps.viceBin ?? "x64sc"` removes the environment-variable read the crash-respawn path (`launchSupervised()`, reached via `withCrashSupervision()`) used to rely on. `vice-broker.mts`'s own `superviseDepsFor()` builder never populated `SuperviseChildDeps.viceBin` (the field already existed on the interface, just unset) -- before this plan the environment fallback silently covered that gap. Left unfixed, a crash-respawned instance would spawn the bare `"x64sc"` literal instead of the resolved binary the launch it replaces used, which is exactly the four-way disagreement `LOC-02` exists to remove. Fixed by adding the parameter and threading the same `viceBin` local through the one real call site.
- **`vice-broker-acquire.test.ts`'s pre-existing BACK-02 composition test needed a fix, not just an addition.** It drove `handleAcquire()` directly and relied on setting `process.env.VICE_BIN` to steer the real spawn at a recorder script. With the environment fallback removed from `broker-launch.mts`, that test would silently spawn `"x64sc"` instead of the recorder script. Fixed by passing `viceBin: stockScript.scriptPath` explicitly through `HandleAcquireDeps`, and removed the now-dead `VICE_BIN` env save/restore.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A static value import of the tool-location seam would crash the production entry point**
- **Found during:** Task 1 (backend-detect.mts's own action text: "Import the seam as `./tool-location.mjs`")
- **Issue:** `backend-detect.mts` is imported UNBUILT, directly, by `vice-proxy.ts` (this project's real `bin`/`main` entry point, run via `node vice-proxy.ts` with no build step per this project's own "no build step at runtime" constraint) and by several test files (`host-tool.test.ts`, `vice-broker-supervision.test.ts`, `host-tool-oracle.test.ts`, `backend-detect.test.ts`). `tool-location.mjs` exists ONLY as a compiled artifact under `resources/`, never beside the unbuilt `.mts` source (confirmed by `tool-location.mts`'s own header: "This module ships two ways", and empirically: `node`'s native TypeScript support performs no `.js`-maps-to-`.ts`-style extension remapping at RUNTIME, only `tsc` does that for TYPES). A literal static `import ... from "./tool-location.mjs"` in `backend-detect.mts` would therefore throw `ERR_MODULE_NOT_FOUND` the instant `vice-proxy.ts` (or any of the four unbuilt-importing test files) loaded it -- a production-breaking regression, confirmed by direct reproduction in a scratch sandbox before touching the real file.
- **Fix:** `backend-detect.mts` loads the seam through `node:module`'s `createRequire()` inside a new `toolLocationSeam()` helper, resolved at the CALL SITE (not at parse time): it checks whether the compiled `resources/tool-location.mjs` sibling exists and requires it if so, else requires the unbuilt `tool-location.mts` sibling directly. The seam's TYPES (`ResolveToolDeps`, and `typeof resolveTool`/`typeof resolveOnPath` via an `import type`) are imported statically and safely, since `import type` is fully erased at runtime and never attempts resolution.
- **Files modified:** `src/mcp/vice/backend-detect.mts`
- **Verification:** `node -e 'import("./backend-detect.mts")'` and a full `node -e 'import("./vice-proxy.ts")'` smoke test both succeed unbuilt, resolving a real binary through the seam's `$PATH` layer; `backend-detect.test.ts` passes with a ZERO-line diff (not merely "no case modified" -- the file needed no change at all, exceeding the plan's own acceptance criterion); the compiled `resources/backend-detect.mjs` correctly resolves the `./tool-location.mjs` compiled sibling at runtime (proven by Task 3's own build + `resources-sync.test.ts`).
- **Committed in:** `2abb7ff6` (Task 1 commit)

**2. [Rule 2 - Missing Critical] A crash-respawned instance would silently lose the resolved binary**
- **Found during:** Task 1 (while narrowing `broker-launch.mts`'s `viceBin ?? process.env.VICE_BIN ?? "x64sc"` per the plan's own instruction)
- **Issue:** `vice-broker.mts`'s `superviseDepsFor()` builder -- the one production call site that feeds `SuperviseChildDeps` into a crash respawn via `withCrashSupervision()` -> `launchSupervised()` -- never populated `SuperviseChildDeps.viceBin` (the field already existed on the interface, unset). Before this plan, `launchSupervised()`'s own `process.env.VICE_BIN` fallback silently covered that gap; removing the fallback (as the plan explicitly instructs) without also fixing `superviseDepsFor()` would have made any crash-respawned instance spawn the bare `"x64sc"` literal instead of the SAME binary (a `tools.json` entry, or `VICE_BIN`) that resolved the launch it replaces -- exactly the "second opinion" `LOC-02` exists to remove, just relocated to the respawn path instead of the initial launch.
- **Fix:** Added a `viceBin` parameter to `superviseDepsFor()`, threaded from the `handleAcquire()`-scope `viceBin` local through its one real call site.
- **Files modified:** `src/mcp/vice/vice-broker.mts`
- **Verification:** `vice-broker-supervision.test.ts` (its own dedicated suite for this exact builder) passes unchanged, 5/5; `npm run typecheck` green.
- **Committed in:** `984e35ca` (Task 2 commit)

**3. [Rule 3 - Blocking] The regex-based grep checks in vice-broker.mts's own doc comments needed rewording**
- **Found during:** Task 2's own `<verify>` step (`grep -acE 'env[.]VICE_BIN'` over `vice-broker.mts`)
- **Issue:** Three of my own explanatory doc comments referenced the deleted fallback by writing the literal text `process.env.VICE_BIN`, which the plan's own verify grep (`env[.]VICE_BIN`) matches as a substring regardless of code-vs-comment context, causing the check to report a false positive.
- **Fix:** Reworded all three comments to describe "the emulator environment variable" in prose, without the literal `env.VICE_BIN` substring.
- **Files modified:** `src/mcp/vice/vice-broker.mts`
- **Verification:** `grep -acE 'env[.]VICE_BIN' vice-broker.mts` -> `0`.
- **Committed in:** `984e35ca` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/architectural workaround, 1 missing-critical fix, 1 blocking/cosmetic-check fix)
**Impact on plan:** Deviation 1 was necessary for the plan's own stated outcome to be achievable at all without breaking production -- the plan's literal "import the seam as `./tool-location.mjs`" instruction is architecturally incompatible with `backend-detect.mts`'s documented dual-shipping requirement, and the fix preserves the plan's intent (one seam implementation, no duplicated ordering) while avoiding the crash. Deviation 2 is a genuine correctness gap the plan's own action text did not enumerate (four call sites named, a fifth -- the crash-respawn builder -- was not). Deviation 3 is purely cosmetic (comment wording). No scope creep.

## Issues Encountered

None beyond the deviations above, all resolved during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolvedBackend()`, `vice-broker.mts` and `vice-proxy.ts` all now agree on one seam-resolved emulator binary; Phase 61's doctor (`DOCTOR-05`) can rely on this being the ONE place that decides, with no second opinion left to reconcile for `x64sc`.
- The `toolLocationSeam()` lazy-load pattern (createRequire, existsSync-gated dual candidate) is new to this codebase and not yet used anywhere else; if a future plan needs another host-bound module with the same dual-shipping constraint, this function is the precedent to follow or generalize.
- Plans 60-02..60-05 (DECL-03, and the other `LOC`/`DECL` requirements) are unaffected by anything in this plan and remain ready to execute independently.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*
