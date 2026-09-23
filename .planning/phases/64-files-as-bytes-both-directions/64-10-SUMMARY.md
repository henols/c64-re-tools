---
phase: 64-files-as-bytes-both-directions
plan: 10
subsystem: broker
tags: [broker-state-dir, npm-package-closure, machine-level-root, g-64-1]

# Dependency graph
requires:
  - phase: 64-08
    provides: attach/transfer dispatched ahead of the per-boot control-token gate, authenticated by their broker-minted handle alone
  - phase: 64-09
    provides: the client-side empty-token parameter deleted from every dial option and dependency type
provides:
  - "The broker and the client resolve broker.json through ONE shared resolver (broker-home.mts's brokerStateDir()) for every documented start route, closing G-64-1's secondary root cause"
  - "--repo-root no longer selects a state directory; it keeps anchoring the Ghidra runs handle and the once-per-process emulator-binary lookup"
  - "package.json's files array ships every module its shipped entry points import (broker-home.mts, broker-endpoint.ts, transfer-hash.mts, transfer-paths.ts, tool-location.mts), proven by a real npm pack + extract + import"
  - "The container interim limitation is recorded and owned by Phase 66 (RM-02)"
affects: [Phase 66 RM-02, any future work touching vice-broker-client.ts/vice-broker.mts/broker-home.mts]

# Actuals (#2632)
actuals:
  tokens: 16463
  tasks: 3
  commits: 4
  plan_head_before: 1c606a4abb0025b10f8256f7ba1129804136759f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A container-side .ts module can value-import a host-bound .mts sibling directly (unbuilt) when that sibling carries only node: imports -- vice-broker-client.ts importing broker-home.mts, matching stock-connect.ts's existing import of backend-detect.mts"
    - "Route-agreement tests: spawn the real emitted artifact for each documented start route under a scratch HOME, and compare its output path against the client's own answer computed in a fresh child node process under the identical env"

key-files:
  created:
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md
    - .planning/todos/pending/2026-09-23-container-clients-cannot-see-the-machine-level-broker-json.md
  modified:
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/vice-broker-launch.test.ts
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/broker-home.mts
    - src/mcp/vice/resources/broker-home.mjs
    - CLAUDE.md
    - .planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/evidence/phase58-declaration-provenance.md

key-decisions:
  - "--repo-root stops selecting a state directory; the client imports brokerStateDir() directly rather than recomputing a project-local answer -- the only option that makes every documented start route agree without violating BROKER-06"
  - "The container-client gap is recorded as an interim limitation with a documented remedy (VICE_BROKER_HOME/VICE_POOL_DIR per side), owned by Phase 66's RM-02, not chased as a translation bug inside hostpath.ts/containerpath.ts"
  - "A second, independent package-closure gap (tool-location.mts missing from files[], causing a real npm-installed vice-proxy.ts to crash on startup) was found by the same pack-and-import check and fixed in the same pass rather than deferred, since it defeats this task's own <done> criterion"

patterns-established:
  - "A same-machine client reads (never writes) through the broker's own directory resolver rather than recomputing an equivalent path -- one resolver, imported on both sides"

requirements-completed: [XFER-08]

coverage:
  - id: D1
    description: "vice-broker-client.ts's brokerRootDir() and vice-broker.mts's parseArgs() resolve the SAME state directory for every documented start route, with nothing configured on either side"
    requirement: XFER-08
    verification:
      - kind: integration
        ref: "vice-broker-launch.test.ts#route agreement: no project argument (npx broker / systemd unit / launchd agent) -- broker and client resolve the SAME broker.json under a scratch HOME, no override (G-64-1)"
        status: pass
      - kind: integration
        ref: "vice-broker-launch.test.ts#route agreement: --repo-root <project> (vice-launcher.sh) -- broker and client STILL resolve the SAME machine-level broker.json, and nothing is created under the project (G-64-1)"
        status: pass
      - kind: integration
        ref: "vice-broker-launch.test.ts#route agreement, VICE_BROKER_HOME variant: the no-argument route and the client agree on <VICE_BROKER_HOME>/supervisor/broker.json (G-64-1)"
        status: pass
      - kind: integration
        ref: "vice-broker-launch.test.ts#route agreement, VICE_BROKER_HOME variant: the --repo-root route and the client STILL agree on <VICE_BROKER_HOME>/supervisor/broker.json, and nothing is created under the project (G-64-1)"
        status: pass
      - kind: integration
        ref: "vice-broker-launch.test.ts#precedence 3 INVERTED (Phase 64, plan 64-10, G-64-1): --repo-root alone (no --state-dir, no VICE_POOL_DIR) no longer selects a project-relative directory -- broker.json lands under the machine-level root instead, and nothing is created under the project"
        status: pass
    human_judgment: false
  - id: D2
    description: "The test suite cannot reach the developer's real ~/.c64-re-tools -- startProxy() defaults VICE_BROKER_HOME to a per-file scratch directory"
    verification:
      - kind: unit
        ref: "vice-proxy.test.ts#harness isolation: startProxy()'s default VICE_BROKER_HOME wins over a stale broker.json planted at HOME's own .c64-re-tools -- no proxy this suite spawns can read a real machine-level root unless a test names its own override (G-64-1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The published package ships every module its shipped entry points import (npm pack + extract + import proof)"
    verification:
      - kind: other
        ref: "npm pack + tar extract + node --input-type=module import of stock-dispatch.ts/vice-broker-client.ts, plus node vice-proxy.ts < /dev/null, from the extracted tarball"
        status: pass
    human_judgment: false
  - id: D4
    description: "The decision, the route census, the overrides, and the container interim limitation (owned by Phase 66 RM-02) are recorded in writing"
    requirement: XFER-08
    verification: []
    human_judgment: true
    rationale: "A documentation-completeness judgment (does the evidence file/todo/CLAUDE.md correction tell a coherent, accurate story) is not something an automated check proves; a human reviewer confirms the narrative is accurate and complete."

duration: 75min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 10: Broker/client machine-level state-directory agreement Summary

**`--repo-root` stops selecting a broker state directory; the client now imports `broker-home.mts`'s `brokerStateDir()` directly, so every documented start route — `npx -y @henols/vice-mcp broker`, the systemd unit, the launchd agent, and `vice-launcher.sh`'s own `--repo-root` pin — agrees on where `broker.json` lives, closing G-64-1's secondary root cause; along the way, a real `npm pack` + import proved (and fixed) two independent package-closure gaps that would have crashed a real `npm install` on startup.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3
- **Files modified:** 11 (2 created)

## Accomplishments

- `vice-broker-client.ts`'s `brokerRootDir()` no longer derives a project-local directory via `repo-root.ts`'s `supervisorDir()` — it imports `broker-home.mts`'s `brokerStateDir()` directly (a value import; that module carries only `node:` imports, so it loads unbuilt from this container-side caller exactly as `stock-connect.ts`'s import of `backend-detect.mts` does).
- `vice-broker.mts`'s `parseArgs()` resolves the state directory as the explicit `--state-dir` when given, otherwise `brokerStateDir()` — the SAME resolver, regardless of `--repo-root`. `--repo-root` keeps its other two meanings (the Ghidra runs handle, the once-per-process emulator-binary lookup); `vice-launcher.sh` itself is unchanged.
- `repo-root.ts`'s literal-occurrence census comment is corrected (11 → 10 occurrences, still across 8 files) to match `parseArgs()` no longer joining the literal a second time.
- `vice-broker-launch.test.ts` gains four real-broker route-agreement tests (no-argument route and `--repo-root` route, each with and without `VICE_BROKER_HOME`) plus an inverted precedence-3 test, all under a scratch `HOME`, comparing the broker's own written path against the client's own answer computed in a fresh child `node` process.
- `vice-proxy.test.ts`'s `startProxy()` now defaults `VICE_BROKER_HOME` to a per-file scratch directory; a new deterministic isolation test plants a stale `broker.json` under a fake `HOME` and proves the default wins over it.
- `package.json`'s `files` array gains five modules the shipped entry points already imported (or now import) but the array omitted: `broker-home.mts` (this plan's own new import), `broker-endpoint.ts`, `transfer-hash.mts`, `transfer-paths.ts` (a pre-existing omission measured at planning), and `tool-location.mts` (a SECOND, independent closure gap this task's own pack-and-import check surfaced — `backend-detect.mts`'s `toolLocationSeam()` requires it as a fallback, and a real `npm install` would have crashed `vice-proxy.ts` on startup without it).
- `broker-home.mts`'s header is corrected: same-machine clients now READ (never write) through this module.
- `CLAUDE.md`'s `.c64-re-tools/` bullet is corrected: broker state no longer lives under any project's tree under any start route.
- The full decision, route census, override table, and container interim limitation are recorded in `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md`; the container gap is owned by a new pending todo naming Phase 66 (RM-02).

## Task Commits

1. **Task 1: Tracer — one real broker per documented route writes broker.json exactly where the client looks** — `6c8eb825` (feat)
2. **Task 2: The suite stays out of the real home, and the tarball ships what it imports** — `3819c5de` (fix)
3. **Task 3: The decision on record, and the stale instruction corrected** — `b9846f7b` (docs)
4. **Deviation fix (citation-ledger line-shift, discovered post-Task-2 during full-suite verification)** — `d0ee0337` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/vice-broker-client.ts` — `brokerRootDir()` delegates to `broker-home.mts`'s `brokerStateDir()`
- `src/mcp/vice/vice-broker.mts` — `parseArgs()`'s state-dir resolution collapses to `stateDir ?? brokerStateDir()`; `run()`'s comment corrected
- `src/mcp/vice/resources/vice-broker.mjs` — regenerated (`npm run build`)
- `src/mcp/vice/repo-root.ts` — `toolsDir()`'s census comment corrected (11→10 occurrences)
- `src/mcp/vice/vice-broker-launch.test.ts` — four route-agreement tests, one inverted precedence test, one `clientBrokerJsonPath()` helper
- `src/mcp/vice/vice-proxy.test.ts` — `startProxy()`'s default `VICE_BROKER_HOME`, one new isolation test
- `src/mcp/vice/package.json` — `files[]` gains five modules
- `src/mcp/vice/broker-home.mts` — header ownership paragraph corrected
- `src/mcp/vice/resources/broker-home.mjs` — regenerated (`npm run build`)
- `CLAUDE.md` — the `.c64-re-tools/` bullet's `supervisor/` entry corrected
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md` — new, the full decision record
- `.planning/todos/pending/2026-09-23-container-clients-cannot-see-the-machine-level-broker-json.md` — new, owned by Phase 66
- `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/evidence/phase58-declaration-provenance.md` — citation ledger repointed past the package.json line shift (deviation fix)
- `.planning/phases/64-files-as-bytes-both-directions/deferred-items.md` — two pre-existing test-isolation findings recorded

## Decisions Made

- **`--repo-root` stops selecting a state directory.** Keeping the pin would leave the three machine-level start routes (none of which have a project argument) permanently disagreeing with their own client; no route without a project argument could ever be fixed by keeping a project-based pin. This resolution is the only one BROKER-06 permits.
- **The container interim limitation is recorded, not chased.** A devcontainer client resolving its own home rather than the host's has no translation fix (`containerPath()` throws outside the bind mount by design); the remedy is per-side `VICE_BROKER_HOME`/`VICE_POOL_DIR`, and the permanent fix is Phase 66's RM-02 deleting `broker.json` entirely.
- **The second closure gap (`tool-location.mts`) was fixed in the same pass, not deferred.** It is the SAME threat class (`T-64-G1-15`, DoS via missing shipped module) this task's own register entry names, and leaving it would have defeated the task's own `<done>` criterion — "a user who installs the package gets every module the client needs."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A second, independent package-closure gap: `tool-location.mts` missing from `package.json`'s `files[]`**
- **Found during:** Task 2's pack-and-import check, AFTER adding the four modules the plan's own action named
- **Issue:** `backend-detect.mts` (already shipped) lazily `require()`s `./tool-location.mts` as a fallback whenever it is not running from `resources/` (`toolLocationSeam()`'s two-candidate resolution). `vice-proxy.ts` calls `resolvedBackend()` at module top level, so a real `npm install` of the published package would crash `vice-proxy.ts` on startup with `MODULE_NOT_FOUND` before ever reaching the MCP handshake — proven live: `node vice-proxy.ts < /dev/null` from an extracted tarball exited 1 before the fix, exited 0 (printing `vice-proxy: ready, stock backend active ...`) after.
- **Fix:** Added `tool-location.mts` to `package.json`'s `files[]` array alongside the four modules the plan's own diff already required.
- **Files modified:** `src/mcp/vice/package.json`
- **Verification:** Re-ran the pack-and-import check from a fresh extracted tarball; `PROXY_EXIT=0`, `module_not_found=0`.
- **Committed in:** `3819c5de` (part of Task 2's commit)

**2. [Rule 3 - Blocking] Task 2's `package.json` edit shifted `phase58-citation-ledger.test.ts`'s pinned line range**
- **Found during:** Post-Task-3 full-suite verification (`npm run test:automated`)
- **Issue:** Adding five entries to `package.json`'s `files[]` array shifted every subsequent line by 5, moving `"engines": { "node": ">=24.0.0" }` from lines 103-104 to 108-109. `.planning/phases/58-.../evidence/phase58-declaration-provenance.md`'s own citation ledger pins that exact range, and the citation-ledger test (part of the automated gate) reddened on the drift.
- **Fix:** Repointed both the prose citation and the ledger's own JSON entry to `src/mcp/vice/package.json:108-109`; re-ran the file directly to confirm green.
- **Files modified:** `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/evidence/phase58-declaration-provenance.md`
- **Verification:** `node --test phase58-citation-ledger.test.ts` — 11/11 pass. Full `npm run test:automated` re-run afterward: 4241 tests, 4232 pass, 0 fail, 9 skipped (matches the orchestrator's measured baseline exactly).
- **Committed in:** `d0ee0337`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Both fixes were necessary for the plan's own acceptance criteria to hold (Task 2's pack-and-import check, and a clean automated-gate run). No scope creep — neither fix touched any file outside what the discovered defect required.

## Issues Encountered

**Pre-existing test-isolation gaps discovered during verification, recorded in `deferred-items.md` and NOT fixed (out of scope: neither call site is in this plan's `files_modified`, and both predate this plan's diff):**

1. Every pre-existing test in `vice-broker-launch.test.ts` that spawns a broker without setting `VICE_BROKER_HOME` already reaches `run()`'s unconditional `reapOrphanedConfigScratch()`/`sweepOrphanedStaging()` calls against the REAL machine-level root (Phase 64, plan 64-03's Task 3 introduced both call sites, untouched here).
2. Running the full `npm test` glob (which, unlike `test:automated`, includes `broker-e2e.test.ts` from `MANUAL_ONLY_TESTS`) left 14 real, harmless `vice-broker-vicerc-*.json` synthetic-fixture files under `~/.c64-re-tools/config-scratch/` after the run — `broker-launch.mts`'s `spawnAndRecordInstance()` mints a fresh leaf directory per launch under the same unconfigured root. Deleted by hand after confirming their origin (`{"pid":9001,"expectedIdentity":"/definitely/does/not/exist/x64sc"}` — no real emulator involved).

Both are recorded with full measurement detail in `.planning/phases/64-files-as-bytes-both-directions/deferred-items.md`. This plan's OWN new/modified tests (the four route-agreement tests, the inverted precedence-3 test, the `vice-proxy.test.ts` isolation test) all set `HOME`/`VICE_BROKER_HOME` to a fresh `mkdtempSync` directory and are confirmed not to touch the real root — verified by a `find ~/.c64-re-tools -type f | grep -v /incidents/ | wc -l` count before and after every test run this plan performed (steady at 2 throughout `test:automated` and this plan's own targeted file runs; the full-glob rise to 16 traced precisely to `broker-e2e.test.ts`, cleaned up, and confirmed unrelated to this plan's diff).

No incident-record leak from this plan's own tests: the pre-existing `broker-relay.test.ts`/`broker-relay-text.test.ts` leak (documented in `deferred-items.md` before this plan touched it) is unaffected; incidents count rose from 89 to 92 during the full-glob run, consistent with that pre-existing, already-disclosed leak.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 64 gap closure (G-64-1) is 10 of 11 plans complete; plan 64-11 remains. The convergence metric (real importers of `hostpath.ts`/`containerpath.ts`/`stock-paths.ts`) is unchanged by this plan (still 5, per `.planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md`). The container-client interim limitation is now owned in writing by Phase 66 (RM-02) via the new pending todo — Phase 66's planner will meet the case pre-documented rather than rediscover it.

## Self-Check: PASSED

- `[ -f src/mcp/vice/vice-broker-client.ts ]` — FOUND
- `[ -f .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md ]` — FOUND
- `[ -f .planning/todos/pending/2026-09-23-container-clients-cannot-see-the-machine-level-broker-json.md ]` — FOUND
- `git log --oneline --all --grep="64-10"` returns 4 commits (`6c8eb825`, `3819c5de`, `b9846f7b`, `d0ee0337`)
- `npm run typecheck` — exit 0
- `npm run build` — exit 0, resources regenerated
- `node --test --test-reporter=tap vice-broker-launch.test.ts repo-root.test.ts resources-sync.test.ts vice-broker-client.test.ts broker-home.test.ts vice-proxy.test.ts` — all green
- `npm run test:automated` — 4241 tests, 4232 pass, 0 fail, 9 skipped (matches orchestrator baseline exactly)
- `npm test` (full glob) — 4416 tests, 4332 pass, 0 fail, 84 skipped, exit 0
- Pack-and-import check from a real extracted tarball — clean import, `vice-proxy.ts` starts and exits cleanly, zero `ERR_MODULE_NOT_FOUND`/`MODULE_NOT_FOUND`

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*
