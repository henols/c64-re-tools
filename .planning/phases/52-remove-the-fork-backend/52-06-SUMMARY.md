---
phase: 52-remove-the-fork-backend
plan: 06
subsystem: vice-mcp
tags: [refactor, fork-removal, backend-detection-collapse, test-migration]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 05)
    provides: "vice.ts deleted; tools-manifest.stock.json the only manifest; DENY_LIST gone"
provides:
  - "backend-detect.mts collapsed: probeBackend()/classifyHelpOutput() and their --help spawn deleted whole; the VICE_BACKEND override branch and resolvedBackend()'s unknown->fork fallback deleted; ViceBackend narrowed to the single literal \"stock\" (not deleted -- text-tools.ts/text-capability-probe.ts, out of this plan's scope, still import it); the on-disk cache survives for BACK-04 capability data with its own backend field dropped"
  - "vice-proxy.ts's broker/proxy backend cross-check deleted outright, by recorded checkpoint decision (answer A, 2026-09-12), with no lighter replacement; ACTIVE_BACKEND renamed RESOLVED_BINARY; its four backend-conditional call sites now pass \"stock\" directly"
  - "vice-broker.mts/broker-launch.mts/broker-control.mts: VICE_BACKEND handling and every fork string reference removed; broker-control.mts's dead profile-is-stock-only refusal deleted (unreachable once backend cannot disagree); vice-broker-client.ts's two backend === \"fork\" conditionals narrowed to the single value, hostState's backend field itself kept (text-tools.ts still reads it)"
  - "A decoupled LegacyViceBackend (\"fork\" | \"stock\") local type introduced in capability-registry.ts, stock-dispatch.ts and text-capability-probe.ts -- these are registry-shaped fork references this plan's own objective assigns to 52-07, not detection-shaped ones this plan collapses; decoupling keeps them compiling, unchanged in behaviour, without pre-empting 52-07's redesign"
  - "spawn-seam.test.ts's frozen shipped-module spawn set is empty (its only member, the --help probe, is gone), with the guard's two-directional set-equality assertion and argv-array property check both kept intact"
  - "Fork branches structurally removed (not skipped) from 14 test files: backend-detect.test.ts (rewritten -- two of three code paths gone, REAL HARDWARE fixture class and its fixtures/backend-detect/ transcripts deleted), broker-control.test.ts, broker-launch.test.ts, vice-broker-client.test.ts, vice-broker-acquire.test.ts, vice-broker-supervision.test.ts, host-tool.test.ts, host-tool-oracle.test.ts, host-tool-transport.test.ts, vice-proxy.test.ts, stock-a4-checkpoint-flood.test.ts, stock-broker-live.test.ts, stock-live-broker-monitor.test.ts, text-monitor-live.test.ts"
  - "A regression this plan's own Task 1 introduced into stock-dispatch.test.ts (a structural test asserting the now-deleted cross-check) discovered and reversed"
  - "npm run test:automated re-baselined: failure SET is exactly the documented 7-member floor plus the 3 members already deferred to plan 52-07, across four consecutive runs with no broker live"
affects: [52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 168000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Decoupled legacy type for registry-shaped data: when a detection-scoped type (ViceBackend) narrows to a single literal, a module whose data is a PERMANENT historical fact keyed by the old two-member shape (capability-registry.ts's providedBy, stock-dispatch.ts's manifest/definition selector, text-capability-probe.ts's identity/cache key) gets its OWN local `LegacyViceBackend = \"fork\" | \"stock\"` type instead of importing the narrowed one -- decoupling a runtime-detection concept from a static historical-classification concept that happened to share a type by accident, so collapsing detection does not force an unplanned redesign of the registry."
    - "Default-value changes cascade through fixture defaults: spawnAndRecordInstance()'s `deps.backend ?? \"fork\"` becoming `?? \"stock\"` (required once ViceBackend excludes \"fork\") silently broke ~20 pre-existing tests across broker-launch.test.ts and vice-broker-acquire.test.ts that implicitly relied on the OLD default needing no remoteMonitorPort. Fixed by threading explicit `backend: \"stock\"` + a working `allocateRemoteMonitorPort`/`remoteMonitorPort` fixture through every affected call site, discovered by running the full file after each edit rather than assuming the type-check surface was the whole blast radius."
  key-files:
    created: []
    modified:
      - src/mcp/vice/backend-detect.mts
      - src/mcp/vice/backend-detect.test.ts
      - src/mcp/vice/vice-broker.mts
      - src/mcp/vice/broker-launch.mts
      - src/mcp/vice/broker-launch.test.ts
      - src/mcp/vice/broker-control.mts
      - src/mcp/vice/broker-control.test.ts
      - src/mcp/vice/vice-broker-client.ts
      - src/mcp/vice/vice-broker-client.test.ts
      - src/mcp/vice/vice-broker-acquire.test.ts
      - src/mcp/vice/vice-broker-supervision.test.ts
      - src/mcp/vice/vice-proxy.ts
      - src/mcp/vice/vice-proxy.test.ts
      - src/mcp/vice/spawn-seam.test.ts
      - src/mcp/vice/capability-registry.ts
      - src/mcp/vice/capability-registry.test.ts
      - src/mcp/vice/stock-dispatch.ts
      - src/mcp/vice/stock-dispatch.test.ts
      - src/mcp/vice/text-capability-probe.ts
      - src/mcp/vice/host-tool.test.ts
      - src/mcp/vice/host-tool-oracle.test.ts
      - src/mcp/vice/host-tool-transport.test.ts
      - src/mcp/vice/stock-a4-checkpoint-flood.test.ts
      - src/mcp/vice/stock-broker-live.test.ts
      - src/mcp/vice/stock-live-broker-monitor.test.ts
      - src/mcp/vice/text-monitor-live.test.ts
      - src/mcp/vice/resources/backend-detect.mjs
      - src/mcp/vice/resources/vice-broker.mjs
      - src/mcp/vice/resources/broker-launch.mjs
      - src/mcp/vice/resources/broker-control.mjs
    deleted:
      - src/mcp/vice/fixtures/backend-detect/README.md
      - src/mcp/vice/fixtures/backend-detect/fork-help-transcript.json
      - src/mcp/vice/fixtures/backend-detect/fork-help-transcript.txt
      - src/mcp/vice/fixtures/backend-detect/stock-help-transcript.json
      - src/mcp/vice/fixtures/backend-detect/stock-help-transcript.txt

key-decisions:
  - "Checkpoint answered A (2026-09-12): proceed with the cross-check deleted outright and the frozen spawn set emptied while its guard is kept -- recorded verbatim below."
  - "ViceBackend narrowed to the single literal \"stock\" rather than deleted, because text-capability-probe.ts and stock-connect.ts (out of this plan's scope) still import it as a type; deleting it would have forced 52-07's work early as an unplanned side effect."
  - "capability-registry.ts/stock-dispatch.ts/text-capability-probe.ts each got a local, decoupled LegacyViceBackend type instead of having ViceBackend's narrowing cascade into their ~26+ \"fork\"-valued registry entries and fork-specific selection logic -- a minimal, non-substantive fix that keeps them compiling unchanged, leaving the actual registry redesign to 52-07."
  - "The dead fork-argv-producing code paths left inside buildViceArgs()/probeReady()/spawnAndRecordInstance() (broker-launch.mts) were NOT deleted -- only their literal \"fork\" string mentions and defaults were fixed. Deleting the actual dead branches was judged out of Task 1's explicit, machine-checked scope and higher-risk than the plan's own \"leave the control-plane protocol and the inFlight launch guard exactly as they are\" constraint justified; documented here as a known residual for whichever later plan wants full cleanup."
  - "stock-dispatch.test.ts's one WR-04 structural test was deleted -- not because 52-07 is being pre-empted, but because Task 1's own cross-check deletion made that ONE assertion mechanically false; reversing a self-caused regression, not a registry-content decision. No other stock-dispatch.test.ts content was touched."

requirements-completed: []

coverage:
  - id: D1
    description: "backend-detect.mts collapsed: probeBackend()/classifyHelpOutput() and the VICE_BACKEND override deleted; ViceBackend narrowed to \"stock\"; on-disk cache survives for BACK-04"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "node --test backend-detect.test.ts (21/21 pass)"
        status: pass
      - kind: other
        ref: "grep -rac 'VICE_BACKEND'/'probeBackend' across backend-detect.mts, vice-broker.mts, broker-launch.mts, broker-control.mts, vice-proxy.ts, resources/*.mjs -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "vice-proxy.ts's broker/proxy backend cross-check deleted outright by recorded decision, no lighter replacement; falsifiable precondition (vice_ping's resolvedBinaryPath still reports an unresolved binary) confirmed in source before deletion"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -ac 'ACTIVE_BACKEND'/'hostState.backend' vice-proxy.ts -> 0, 0; RESOLVED_BINARY.binPath/binPathResolved still feed dispatchStockFor() and the ready log line"
        status: pass
    human_judgment: false
  - id: D3
    description: "spawn-seam.test.ts's frozen shipped-module spawn set is empty with its two-directional guard and argv-array property check intact"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "node --test spawn-seam.test.ts (12/12 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fork-conditional branches structurally removed (not skipped) from 14 test files, all passing, and a self-caused regression in stock-dispatch.test.ts reversed"
    requirement: FORKRM-07
    verification:
      - kind: unit
        ref: "node --test over the nine broker/host-tool files (364/364 pass) plus the five manual-only files (parse/skip correctly, no live broker)"
        status: pass
      - kind: other
        ref: "grep -ac '\"fork\"'/'VICE_BACKEND'/'test.skip'/'it.skip' across all 14 files -> 0 for every file"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run test:automated re-baselined: failure SET is the documented 7-member floor plus the 3 members deferred to plan 52-07, with no new regression, across four consecutive runs with no live broker"
    requirement: FORKRM-07
    verification:
      - kind: other
        ref: "four consecutive npm run test:automated runs, failure SET compared by name each time; one transient zz-scratch race (unrelated, environmental) observed once and resolved by removing the stray gitignored directory"
        status: pass
    human_judgment: false

duration: ~3h
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 06: Collapse Backend Detection and Structurally Remove Fork Test Branches Summary

**`ViceBackend` narrows from a two-member union to the single literal `"stock"`, the broker/proxy cross-check and every `--help` probe/override are deleted outright, and 14 test files' fork-conditional branches are structurally removed rather than skipped -- with a self-caused test regression discovered and reversed along the way.**

## Checkpoint Decision (recorded verbatim)

**Decision:** Remove backend detection entirely on both sides of the container boundary (`VICE_BACKEND`, `probeBackend` and its `--help` discriminator, `resolvedBackend`'s fork branch and unknown-verdict fallback), and delete the broker/proxy cross-check outright with no lighter replacement?

**Answer:** **A** — Proceed. The cross-check is deleted; the residual unresolved-binary signal is confirmed to reach the operator via `vice_ping`'s `resolvedBinaryPath` before deletion, and the frozen spawn set is emptied while its two-directional guard is kept.

**Answered by:** The human project owner, via a blocking-human decision gate presented by the orchestrator, which quoted the plan's own options A/B/C verbatim and explicitly surfaced that emptying the frozen spawn set — rather than deleting its guard — was part of what was being confirmed.

**Date:** 2026-09-12. No file was modified before this answer was recorded.

**Falsifiable precondition (Task 1, confirmed before deleting the cross-check):** `resolvedBackend()`'s binary-resolution path was read in source before any deletion. `binPathFields()` returns `{ binPath: resolvedPath, binPathResolved: true }` when resolution succeeds and `{ binPath: viceBin, binPathResolved: false }` when it fails — an unresolved binary is never silently dropped. `RESOLVED_BINARY.binPath`/`.binPathResolved` (renamed from `ACTIVE_BACKEND`) still feed `vice_ping`'s `resolvedBinaryPath` field via `dispatchStockFor()`'s deps object, and the ready-log line. The broker's own launch failure is reported by name independently (`vice-broker: second (-remotemonitor) port allocation failed...`, `spawnAndRecordInstance`'s own thrown errors). The precondition held; the deletion proceeded.

## Performance

- **Duration:** ~3h
- **Completed:** 2026-09-12
- **Tasks:** 3 (plus the pre-answered checkpoint)
- **Files modified:** 29 (24 modified test/source files across three commits, plus 4 regenerated `resources/*.mjs`, plus 5 deleted fixture files)

## Accomplishments

- Collapsed `backend-detect.mts` to identity resolution plus BACK-04 capability caching only: `probeBackend()`, `classifyHelpOutput()`, the `--help` fallback ladder, the `VICE_BACKEND` override branch, and the `verdict === "unknown"` → `"fork"` fallback are all deleted. `resolvedBackend()` now always returns `backend: "stock"`, resolves the binary's identity, and (re)initialises the on-disk cache record only when the identity changed — no more probing, no more logging of a one-time "detected backend" note.
- `ViceBackend` narrowed from `"fork" | "stock"` to the single literal `"stock"` — kept as a type (not deleted) because `text-capability-probe.ts` and `stock-connect.ts` (both out of this plan's scope) still import it.
- Deleted `vice-proxy.ts`'s broker/proxy backend cross-check block outright (the `session.hostState()` call, the mismatch refusal, the "could not read the broker's own backend verdict" log line) with no lighter replacement, per the answered checkpoint. Renamed `ACTIVE_BACKEND` to `RESOLVED_BINARY`; its four remaining call sites (manifest path selection, `dispatchStockFor()`'s deps, the two synthetic tool registrations, the capability-refusal lookup, the ready log line) now pass the literal `"stock"` where a backend value is needed, rather than reading a backend-shaped object's `.backend` field.
- Removed `VICE_BACKEND` handling and every `"fork"` string reference from `vice-broker.mts`, `broker-launch.mts` and `broker-control.mts`; deleted `broker-control.mts`'s dead profile-is-stock-only refusal (the condition it refused — a broker resolving to a non-stock backend — can no longer occur). `vice-broker-client.ts`'s two `backend === "fork"` conditionals narrowed to the single value; its `hostState.backend` field itself survives (still a real consumer in `text-tools.ts`, out of this plan's scope) with its type narrowed from `"fork" | "stock" | null"` to `ViceBackend | null`.
- Introduced a decoupled, non-exported `LegacyViceBackend = "fork" | "stock"` local type in `capability-registry.ts`, `stock-dispatch.ts` and `text-capability-probe.ts` — discovered necessary when narrowing `ViceBackend` cascaded into ~26 `providedBy: "fork"` registry-entry type errors and `resolveAdvertisedToolDefinition()`'s dead-but-still-typed fork branch in files this plan's own objective explicitly assigns to 52-07 ("registry-shaped, not detection-shaped"). The decoupling keeps all three files compiling with zero behavioural change, so 52-07 inherits a real design decision to make rather than a type-error-driven one already made for it.
- `spawn-seam.test.ts`'s frozen shipped-module spawn set (`EXPECTED_EMULATOR_SPAWN_SITES`) is now `{}` — its only member (`backend-detect.mts`'s `--help` probe) is gone — with the set-equality assertion still failing in both directions and the argv-array safe-form check unchanged. The two tests that asserted the real spawn site's exact call shape are replaced with a pair proving `backend-detect.mts`'s real current source is spawn-free, and that a seeded synthetic spawn in that same real source is still discovered.
- Structurally removed fork-conditional branches (deleted whole, or narrowed to the surviving case, never `test.skip()`/`if (false)`) from 14 test files: rewrote `backend-detect.test.ts` around the two surviving code paths (identity cache, once-per-process memoisation, BACK-04 round trip) and deleted its REAL HARDWARE (EXTV-02) fixture class along with the now-orphaned `fixtures/backend-detect/` transcripts; `broker-control.test.ts` lost three profile-refusal-on-fork tests; `broker-launch.test.ts` lost five whole-argv fork byte-identity tests; `vice-broker-client.test.ts`, `host-tool.test.ts`, `host-tool-transport.test.ts` had fork fixtures narrowed to stock; `vice-broker-acquire.test.ts` lost its fork half of a paired stock/fork test; `vice-proxy.test.ts` lost one whole capability test and had its remaining fork/`VICE_BACKEND` scaffolding removed, its committed-manifest reads repointed to `tools-manifest.stock.json`; the four live-broker test files had their now-inert `VICE_BACKEND: "stock"` launch scaffolding removed.
- **Discovered and fixed a regression this plan's own Task 1 introduced**, found by running the full automated suite as Task 3's own action requires: `spawnAndRecordInstance()`'s default changed from `deps.backend ?? "fork"` to `?? "stock"` (required, since `"fork"` is no longer a valid `ViceBackend` literal) — but `"stock"` requires a `remoteMonitorPort`, which ~20 pre-existing tests across `broker-launch.test.ts` and `vice-broker-acquire.test.ts` never supplied, having implicitly relied on the old fork default needing nothing. Fixed by threading explicit `backend: "stock"` plus a working `allocateRemoteMonitorPort`/`remoteMonitorPort` fixture through every affected call site. Also deleted `stock-dispatch.test.ts`'s one structural test asserting the now-deleted `ensureBrokerLease()` cross-check — a second self-caused regression, reversed as the one edit to that otherwise-52-07-owned file.
- Re-baselined `npm run test:automated`: the failure SET across four consecutive runs (no broker live) is exactly the documented 7-member persistent floor plus the 3 members already deferred to plan 52-07 (`mechanical completeness: the registry's name set equals the manifest-derived divergence set`, `tool-support-table.test.mjs`, `--root naming the repository root itself is accepted and writes identical bytes`), with no new, unexplained member. One transient `zz-scratch` race (a stray, gitignored `installer/skills/acme-build/zz-scratch-*` leftover from an earlier local run, unrelated to this plan) surfaced once and vanished once the stray directory was removed — matching this project's documented flake pattern, not a regression.

## Task Commits

1. **Task 1: Collapse backend-detect.mts and delete the broker/proxy cross-check** — `d54d98a1` (feat)
2. **Task 2: Structurally remove fork branches from the nine broker and host-tool test files** — `446f1e51` (test)
3. **Task 3: Clear the fork references from the manual-only test files and re-baseline the gate** — `3840094f` (test)

## Files Created/Modified

See `key-files` in frontmatter for the full list. Highlights:
- `src/mcp/vice/backend-detect.mts` — collapsed to identity resolution + BACK-04 capability cache only
- `src/mcp/vice/vice-proxy.ts` — cross-check deleted; `ACTIVE_BACKEND` renamed `RESOLVED_BINARY`
- `src/mcp/vice/capability-registry.ts`, `stock-dispatch.ts`, `text-capability-probe.ts` — decoupled `LegacyViceBackend` local type
- `src/mcp/vice/spawn-seam.test.ts` — frozen spawn set emptied, guard kept
- `src/mcp/vice/backend-detect.test.ts` — rewritten around the two surviving code paths
- Deleted: `src/mcp/vice/fixtures/backend-detect/*` (README + 4 transcript files)

## Decisions Made

See `key-decisions` in frontmatter for the full record. In short: `ViceBackend` narrowed rather than deleted (out-of-scope consumers still import it); registry-shaped modules got a decoupled `LegacyViceBackend` type rather than having the narrowing cascade into their content; dead fork-argv code paths in `broker-launch.mts` were left in place (only their literal string mentions fixed) as a deliberate, documented scope boundary; `stock-dispatch.test.ts`'s one broken structural test was deleted as a self-caused-regression reversal, not a registry redesign.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `capability-registry.ts`/`stock-dispatch.ts`/`text-capability-probe.ts` broke typecheck once `ViceBackend` narrowed**
- **Found during:** Task 1, first `npm run typecheck` after the narrowing edit
- **Issue:** These three files import `ViceBackend` and either assign it the literal `"fork"` (capability-registry.ts's ~26 registry entries) or compare against it (`stock-dispatch.ts`'s `resolveAdvertisedToolDefinition()`), both now type errors once `ViceBackend` excludes `"fork"`. All three are explicitly named "registry-shaped, not detection-shaped" by this plan's own objective and assigned to 52-07.
- **Fix:** Declared a local, non-exported `LegacyViceBackend = "fork" | "stock"` type in each of the three files, decoupled from `backend-detect.mts`'s narrowed `ViceBackend`, and repointed the affected fields/parameters to it. Zero behavioural change; all three files compile and their existing tests (where applicable) pass unchanged.
- **Files modified:** `src/mcp/vice/capability-registry.ts`, `src/mcp/vice/stock-dispatch.ts`, `src/mcp/vice/text-capability-probe.ts`
- **Verification:** `npm run typecheck` exits 0; `node --test capability-registry.test.ts text-capability-probe.test.ts` pass (pre-existing failures in those files, deferred to 52-07, unaffected)
- **Committed in:** `d54d98a1` (Task 1 commit)

**2. [Rule 1 - Bug] `spawnAndRecordInstance()`'s default-value change broke ~20 pre-existing tests**
- **Found during:** Task 2, first `node --test broker-launch.test.ts` run after Task 1's edits
- **Issue:** `deps.backend ?? "fork"` had to become `?? "stock"` (Task 1, required since `"fork"` is no longer a valid literal). Stock requires `remoteMonitorPort`; ~20 tests across `broker-launch.test.ts` and `vice-broker-acquire.test.ts` never supplied one, having relied on the old fork default needing nothing.
- **Fix:** Threaded explicit `backend: "stock"` plus a working `allocateRemoteMonitorPort`/`remoteMonitorPort` fixture through every affected call site (`superviseChild()`'s 4th positional arg; `acquirePortAndLaunch()`'s/`tryLaunchOne()`'s deps fields).
- **Files modified:** `src/mcp/vice/broker-launch.test.ts`, `src/mcp/vice/vice-broker-acquire.test.ts`
- **Verification:** `node --test broker-launch.test.ts` (74/74 pass); `node --test vice-broker-acquire.test.ts` (25/25 pass)
- **Committed in:** `446f1e51` (Task 2 commit)

**3. [Rule 1 - Bug] `host-tool.test.ts`/`host-tool-oracle.test.ts`'s `withFakeC1541()`/`withFakeHostTools()` relied on the now-deleted VICE_BACKEND override's memo-bypass property**
- **Found during:** Task 2, reading both helpers' own header comments before editing
- **Issue:** Both helpers set `VICE_BACKEND=fork` purely to exploit `resolvedBackend()`'s old "override path never touches the memo" property, letting them redirect `VICE_BIN` per-call without the module-level memo poisoning later calls. That override path is deleted; every call now hits the same memoised path.
- **Fix:** Both helpers now call `resetResolvedBackendForTests()` directly (imported from `backend-detect.mts`) before setting `VICE_BIN` and again in their `finally` block, forcing a fresh resolution that honours the just-set `VICE_BIN` without leaking it forward.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/host-tool-oracle.test.ts`
- **Verification:** `node --test host-tool.test.ts` (104/104 pass); `node --test host-tool-oracle.test.ts` (13/13 pass)
- **Committed in:** `446f1e51` (Task 2 commit)

**4. [Rule 1 - Bug] `stock-dispatch.test.ts`'s WR-04 structural test asserted the now-deleted cross-check**
- **Found during:** Task 3, the full `npm run test:automated` run this task's own action requires
- **Issue:** `test("structure/proxy (WR-04): ensureBrokerLease() compares the broker's own backend verdict against ACTIVE_BACKEND...")` read `vice-proxy.ts`'s source text for `session.hostState()`, `hostState.backend !== null`, and `ACTIVE_BACKEND` — all deleted by this plan's own Task 1. A genuine, self-caused regression, not a pre-existing 52-07-owned failure.
- **Fix:** Deleted the test whole, with a comment explaining it reverses a self-caused regression rather than pre-empting 52-07's registry redesign. No other content in the file was touched.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `npm run test:automated` no longer lists this test in its failure set; four consecutive runs confirmed
- **Committed in:** `3840094f` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking-compile fix required by the plan's own narrowing, 2 real test regressions this plan's own Task 1 caused and Task 2/3 discovered and reversed, 1 stale-helper fix). **Impact on plan:** All four are direct, necessary consequences of executing Tasks 1-3 as written — none is scope creep beyond what "collapse backend detection and structurally remove fork test branches" entails.

## Issues Encountered

None beyond the deviations documented above, all resolved within this plan's own scope.

## Known Stubs

None. This plan is entirely removal, decoupling, and test-content rewriting — no new code path was stubbed.

## Threat Flags

None beyond what this plan's own `<threat_model>` already discloses (T-52-18 through T-52-22, T-52-SC) — no new surface introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `backend-detect.mts`, `vice-proxy.ts`, `vice-broker.mts`, `broker-launch.mts`, `broker-control.mts`, `vice-broker-client.ts` all have zero `VICE_BACKEND`/`probeBackend`/`ACTIVE_BACKEND` references; `ViceBackend` is a single-literal type; `resources/*.mjs` are regenerated and in sync.
- `spawn-seam.test.ts`'s frozen set is empty with its guard intact — a future spawn site cannot appear unguarded.
- Plan 52-07 inherits `stock-dispatch.test.ts`, `capability-registry.test.ts`, `text-capability-probe.test.ts` and `text-tools.test.ts`'s own registry-shaped fork references untouched (beyond this plan's one regression-reversal edit to `stock-dispatch.test.ts`), plus the decision of what to do with the `LegacyViceBackend` decoupling this plan introduced as a stopgap — 52-07 may choose to redesign the registry entirely (e.g., drop `providedBy` given there is nothing left to provide the alternative), fold `LegacyViceBackend` into a differently-shaped type, or leave the decoupling as documented here.
- A known residual, NOT fixed by this plan and left for whoever next touches `broker-launch.mts`: `buildViceArgs()`'s fork-argv-producing tail (the trailing `return ["-mcpserver", ...]`), `probeReady()`'s HTTP-probe else-branch, and `spawnAndRecordInstance()`'s XDG_CONFIG_HOME `if (backend === "stock")` guard's implicit else are all now dead code (unreachable, since `backend` can only ever be `"stock"`), deliberately left in place rather than deleted — judged out of Task 1's explicit, machine-checked scope and lower-risk than restructuring a crash-supervision-adjacent, heavily-tested function. Task 2 already removed the fork-specific tests that exercised these branches, so they are untested as well as dead.
- `CLAUDE.md`'s Architecture bullet describing the frozen spawn set (if it names `probeBackend()` by name as the one member) is now stale — flagged for plan 52-09, which owns `CLAUDE.md`/`PROJECT.md` Constraints edits (`docs-constraints-sync.test.ts` requires the two lists byte-identical, so they must move together).
- `FORKRM-01`/`FORKRM-07` remain `Pending` in `.planning/REQUIREMENTS.md` — declared by sibling plans still in flight (52-07 through 52-10); the shared-ID gate correctly withholds `Complete` until all declaring plans have a SUMMARY (`requirements.ready-ids` confirmed 0/2 ready at this plan's close).
- No blockers.

## Self-Check: PASSED

- `test ! -e src/mcp/vice/fixtures/backend-detect`: exits 0 (directory absent).
- All three commit hashes verified present: `git log --oneline --all | grep -E 'd54d98a1|446f1e51|3840094f'` returns all three.
- `npm run typecheck` exits 0 (re-confirmed as the final action before writing this SUMMARY).
- `node --test` over all 14 touched test files plus `spawn-seam.test.ts`/`resources-sync.test.ts`: all pass (backend-detect.test.ts 21/21, broker-control.test.ts 62/62, broker-launch.test.ts 74/74, vice-broker-client.test.ts 45/45, vice-broker-acquire.test.ts 25/25, vice-broker-supervision.test.ts 5/5, host-tool.test.ts 104/104, host-tool-oracle.test.ts 13/13, host-tool-transport.test.ts 8/8, spawn-seam.test.ts + resources-sync.test.ts 12/12).
- `npm run test:automated` failure SET: confirmed across four consecutive runs, exactly the documented 7-member floor + 3 deferred members, zero new unexplained members.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
