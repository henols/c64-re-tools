---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 05
subsystem: testing
tags: [vice-proxy, tracer, never-throw, never-cache, path-confinement, endpoint-override, ladder, test-rewrite]

# Dependency graph
requires:
  - phase: 55-04
    provides: "vice-proxy.test.ts with 9 of 16 rewrite-set failures re-pointed at post-fork-removal reality, leaving exactly the 7 no-harness-set failures for this plan"
provides:
  - "vice-proxy.test.ts with all 7 remaining failures resolved: 4 rewritten against the proven proxy-local anno_* route or against today's real fixed-message behavior, 3 retired with named, confirmed-green successors"
  - "A working tracer again: the file's leading test proves one real tool call round-trips end to end through the stdio surface with no emulator, no broker and no stand-in server"
  - "A verified reconciliation of the whole file against Plan 55-03's origin census, with zero unaccounted differences"
affects: ["55-06 (owns this file's header/gate/manual-only ledger prose, left byte-identical here)"]

actuals:
  tokens: 10940
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "When a fixed-port/VICE_MCP_URL-based diagnostic mechanism is confirmed deleted source (not merely stale), decompose the retired test's distinct claims and locate a per-claim successor rather than a single 1:1 replacement -- extends 55-04's same pattern to a case where the successors are BOTH a broker-side sibling in the same file AND a unit-level suite (stock-handler.test.ts) covering a narrower, more precise modern restatement of the old claim."
    - "A test whose only need for a broker/HTTP fixture was to reach ONE dependent assertion (a final success case) can drop the whole fixture and switch to the proven proxy-local anno_* route (seedAnnoWorkspace()) for just that assertion, leaving the fixture-free cases untouched."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.test.ts

key-decisions:
  - "The tracer's own name is kept ('one real tool call round-trips end to end') because it stays true against the anno_get_symbols route; only its comment's stated scope changed, naming stock-broker-live.test.ts as the suite that proves the broker-mediated route this tracer deliberately does not."
  - "'path translation: a lexical .. cannot escape the workspace...' is renamed to 'path confinement...', dropping 'translates' -- anno store paths never cross a host/container translation seam (anno-types.ts's own header comment states this), so keeping that word would misdescribe the surviving route."
  - "'fixed-port unreachable is unchanged...' is retired in favor of THIS SAME PLAN's own rewritten 'with an explicit endpoint override set, the control listener receives no connection at all' -- both tests' surviving claims (a fixed-port override gets its own message, never the broker's, and never contacts the broker) collapsed into one property once the fork-era '01.1 triple' vocabulary was confirmed deleted source."
  - "'three states...' decomposes into TWO successors, not one: never-started/dead-or-hung (same vocabulary, broker.json-driven) -> 'broker three states...' in this file; alive-but-failed (a reachable session's own operation fails, reported distinctly) -> stock-handler.test.ts's convertWireError() coverage, a narrower and more precise modern restatement (typed per-protocol-error-code text, not the fork's free-form JSON-RPC error string)."
  - "No binary-monitor stand-in was built. All seven resolved at rung 1 (no success needed), rung 2 (proven proxy-local route), or rung 3/6 (a sibling -- in this file or in stock-handler.test.ts -- is now the whole surviving property). spawn() call count in the file is unchanged (6) confirming rung 5 was never reached."

patterns-established: []

requirements-completed: [PROXY-05]

coverage:
  - id: D1
    description: "The file's leading tracer proves one real tool call (anno_get_symbols over a seeded store) round-trips end to end through stdio framing, the tools/call override, the registry, a real runner and the result-shape check, with no emulator, no broker and no stand-in server; its own comment states this boundary and names stock-broker-live.test.ts as the suite proving the excluded broker-mediated route"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#tracer: one real tool call round-trips end to end"
        status: pass
    human_judgment: false
  - id: D2
    description: "never-throw's hostile-input case 6 (the one dependent-on-success assertion) is proven against the proxy-local anno route instead of the dead VICE_MCP_URL/HTTP stand-in; cases 1-5 (no success needed) are unchanged"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#never-throw: malformed and hostile input is answered, not fatal"
        status: pass
    human_judgment: false
  - id: D3
    description: "A lexical .. cannot escape the anno store's workspace confinement, and one that resolves back inside is still accepted and answered with the seeded content -- proven live through the spawned proxy against anno_get_symbols's store argument"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#path confinement: a lexical .. cannot escape the workspace, and one that resolves back inside is still accepted"
        status: pass
    human_judgment: false
  - id: D4
    description: "An explicit VICE_MCP_URL endpoint override never contacts the broker control listener, and produces today's real fixed refusal message rather than the now-impossible isError:false outcome"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#with an explicit endpoint override set, the control listener receives no connection at all"
        status: pass
    human_judgment: false
  - id: D5
    description: "Three tests whose subject is confirmed-deleted source (the VICE_MCP_URL-based host-unreachable classification mechanism) are retired with named, confirmed-green successors: never-cache -> broker never-cache; three-states -> broker three states + stock-handler.test.ts convertWireError coverage; fixed-port-unreachable -> this plan's own rewritten endpoint-override test"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart / #broker three states: each broker-absent shape gets its own message and fix; src/mcp/vice/stock-handler.test.ts#convertWireError family (17/17 pass)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole file is reconciled against Plan 55-03's origin census with zero unaccounted differences, orphans are swept with grep evidence, and the file ends clean: 56 tests / 53 pass / 0 fail / 3 skipped, npm run test:automated unmoved at 4417/0/9"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "node --test vice-proxy.test.ts: tests 56, pass 53, fail 0, cancelled 0, skipped 3 (no broker/x64sc process present); npm run test:automated: 4417/0/9"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-09-14
status: complete
---

# Phase 55 Plan 05: Resolve vice-proxy.test.ts's seven no-harness-set failures Summary

**Climbed the plan's ladder for all seven remaining failures: 4 rewritten against the proven proxy-local `anno_get_symbols` route or today's real fixed VICE_MCP_URL-refusal message, 3 retired with named, confirmed-green successors -- zero tests skipped, zero stand-ins built, file ends at 56/53/0/3.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3 (each one commit)
- **Files modified:** 1 (`src/mcp/vice/vice-proxy.test.ts`)
- **Commits:** 3

## Accomplishments

- **Task 1** (`2f06b1a0`): rewrote the file's leading tracer. MEASURED that `VICE_MCP_URL` forwarding to an HTTP stand-in is dead -- `ensureStockSession()` now refuses outright, unconditionally, the instant the env var is set, because the stock backend must claim the monitor socket through a broker-managed instance before dialling anything. Replaced the old `vice_ping`-via-`startStandInServer()` shape with one real `anno_get_symbols` call against a seeded `project.annostore` (`seedAnnoWorkspace(1)`, reused from Plan 55-01, no second helper added). The test's own comment states its boundary explicitly and names `stock-broker-live.test.ts` as the manual-only suite proving the broker-mediated route this tracer deliberately excludes. Name kept -- still true that one real tool call round-trips end to end.
- **Task 2** (`df0ad368`): applied the ladder to the remaining six.
  - **Rung 1 (no success needed):** `never-throw: malformed and hostile input is answered, not fatal` -- only its final case (a valid call after five hostile inputs) needed success; dropped the VICE_MCP_URL stand-in for the whole test and proved that case against `anno_get_symbols`. `with an explicit endpoint override set, the control listener receives no connection at all` -- its own name states the real point (never contacts the broker); replaced the now-impossible `isError:false` assertion with today's fixed refusal message, kept `acquireCount===0` unchanged.
  - **Rung 2 (proven proxy-local route):** `path translation: a lexical .. cannot escape the workspace...` -- rewired onto `anno_get_symbols`'s `store` argument, which `resolveWorkspacePath()`/`storePathWithinWorkspace()` still confines with the identical both-directions shape (refuse what escapes, accept what resolves back inside). Renamed to `path confinement...`, dropping "translates" since anno store paths never cross a host/container translation seam.
  - **Rung 3/6 (sibling now the whole surviving property) -- retired with named, confirmed-green successors:**
    - `never-cache: host down then up succeeds without a restart` -> `broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart` (this file, confirmed passing before retirement).
    - `three states: each unreachable shape gets its own message and fix` -> decomposed into two successors: `broker three states: each broker-absent shape gets its own message and fix` (never-started/dead-or-hung, same vocabulary, now broker.json-driven, confirmed passing) plus `stock-handler.test.ts`'s `convertWireError()` family (alive-but-failed's modern equivalent: a real per-protocol-error-code conversion into distinct, non-generic text; 17/17 passing, confirmed before retirement).
    - `fixed-port unreachable is unchanged...` -> this same plan's own rewritten `with an explicit endpoint override set, the control listener receives no connection at all` -- both tests' surviving claims collapsed into one property once the "01.1 triple" vocabulary was confirmed deleted source (per `vice-proxy.ts`'s own comment above `ONLY_ROUTE_NOTE`).
  - No stand-in was built (rung 5 never reached for any of the six).
- **Task 3** (`036dcf8a`): reconciled the whole file against Plan 55-03's Task 0 origin census (see Reconciliation below), swept two now-orphaned helpers (`reserveFreePort()`, `startBigPayloadServer()`, both confirmed zero-consumer by grep), verified no import lost its last consumer, and re-measured the four end-state numbers from a clean run with no broker/x64sc process present. File header, WORKSPACE_ENV gate comment and manual-only disposition confirmed byte-identical to 55-04's end commit (left for Plan 55-06).

## Verdict Table (all seven, plus nothing handed forward from 55-04)

| Test | Rung | Disposition | Successor / new form |
|---|---|---|---|
| `tracer: one real tool call round-trips end to end` | 2 | rewritten | `anno_get_symbols` over `seedAnnoWorkspace()` (same file) |
| `never-throw: malformed and hostile input is answered, not fatal` | 1 | rewritten (case 6 only) | `anno_get_symbols` over `seedAnnoWorkspace()` (same file) |
| `never-cache: host down then up succeeds without a restart` | 3 | retired | `broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart` (same file) |
| `three states: each unreachable shape gets its own message and fix` | 3/6 | retired (decomposed) | `broker three states: each broker-absent shape gets its own message and fix` (same file) + `stock-handler.test.ts` convertWireError family |
| `path translation: a lexical .. cannot escape the workspace, and one that resolves back inside still translates` | 2 | rewritten + renamed | `anno_get_symbols`'s `store` argument via `resolveWorkspacePath()` (same file, renamed "path confinement...") |
| `with an explicit endpoint override set, the control listener receives no connection at all` | 1 | rewritten | today's fixed VICE_MCP_URL refusal message (same file, same test) |
| `fixed-port unreachable is unchanged: no lease held still produces the 01.1 never-started message naming the surviving launcher` | 3/6 | retired | `with an explicit endpoint override set, the control listener receives no connection at all` (this plan's own rewritten sibling, same file) |

Nothing was handed forward from Plan 55-04's SUMMARY beyond these seven -- confirmed by re-reading its "Next Phase Readiness" section, which names exactly these seven and nothing else.

## Reconciliation Against Plan 55-03's Origin Census

| Stage | tests | pass | fail | skipped | top-level `test(` | lines |
|---|---|---|---|---|---|---|
| Origin (55-03 Task 0) | 122 | 49 | 69 | 4 | 117 | 6660 |
| After 55-03 (5 deletion commits, -61 tests) | 61 | 42 | 16 | 3 | 56 | 3834 |
| After 55-04 (2 retired, 7 re-pointed) | 59 | 49 | 7 | 3 | (59, per its own SUMMARY wording) | 3891 |
| After 55-05 Task 1 (tracer rewritten) | 59 | 50 | 6 | 3 | -- | -- |
| After 55-05 Task 2 (4 rewritten, 3 retired) | 56 | 53 | 0 | 3 | -- | -- |

The Task 1 row is derived arithmetic (isolated tracer re-run confirmed pass, full-file re-run was not taken at that exact checkpoint), not a separately measured full-file run; the Task 2 and final rows are directly measured (full-file `node --test` runs, shown below).
| After 55-05 Task 3 (orphan sweep, no test-count change) | 56 | 53 | 0 | 3 | 51 | 3685 |

Every test absent now that was present at the 55-03 origin appears in exactly one of: a 55-03 deletion list (61 tests), a 55-04 retirement verdict (2 epoch-drift tests) or re-pointing (7, unchanged count), or this plan's Task 2 verdict table (3 retired, 4 rewritten in place). **Zero unaccounted differences.** Every test present and failing after this plan is exactly zero -- no "deliberately-left uncovered property" entries are owed.

The 51-vs-56 gap (top-level `test(`-at-column-0 grep vs. runtime `tests` count) is the `ENDING_TRIGGERS` for-loop's indented `test()` call generating 5 runtime tests from 1 source line that does not match a column-0 `^test(` grep -- the same known discrepancy Plan 55-03's own Task 0 census methodology recorded (117 grep vs. 122 runtime at the origin, same 5-test gap).

## Task Commits

1. **Task 1: Make the file's leading tracer a real end-to-end round trip again** - `2f06b1a0` (test)
2. **Task 2: Apply the ladder to the remaining six singles** - `df0ad368` (test)
3. **Task 3: Reconcile the file against its own accounting, sweep orphans** - `036dcf8a` (test)

**Plan metadata:** (recorded separately by the orchestrator, per this plan's constraint against committing docs artifacts from this agent)

## Files Created/Modified

- `src/mcp/vice/vice-proxy.test.ts` - tracer rewritten (Task 1); six remaining singles resolved by ladder rung, 4 rewritten in place and 3 retired with named successors (Task 2); reconciliation, orphan sweep (`reserveFreePort()`, `startBigPayloadServer()` removed, both zero-consumer) (Task 3). 3891 -> 3685 lines net.

## Decisions Made

- The tracer keeps its own name (still true against the new route); only its comment's stated scope changed.
- `path translation...` renamed to `path confinement...`, dropping "translates" -- the surviving route (anno store confinement) never crosses a host/container translation seam, and keeping the old word would misdescribe it.
- `fixed-port unreachable is unchanged...` is retired against THIS SAME PLAN's own rewritten `with an explicit endpoint override set...` rather than kept as a near-duplicate assertion -- both tests' surviving claims collapsed into one property once the fork-era "01.1 triple" vocabulary was confirmed deleted source.
- `three states...` decomposes into two successors rather than one, since its three original claims split across two different surviving mechanisms (broker.json liveness classification vs. per-protocol-error-code conversion) with no single test covering both.
- No binary-monitor stand-in was built anywhere in this plan -- all seven resolved at rungs 1-3/6. `spawn()` call count in the file is unchanged (6, confirmed against `git show HEAD~3` before any edit), confirming rung 5 was never reached.

## Deviations from Plan

**None of Rules 1-4** were triggered -- this plan is pure test re-pointing/retirement with no source-code changes.

One measured discrepancy worth stating explicitly, per the standing instruction to follow the measurement over the plan's own framing when they diverge: the plan's `read_first` for Task 2 named `anno-confinement.test.ts` as "the candidate successor for the path-translation case," which reads as pointing toward retirement (rung 6). MEASURED that a live rewrite (rung 2) was actually reachable -- `anno_get_symbols`'s `store` argument is confined by the exact same underlying function (`storePathWithinWorkspace()`) that `anno-confinement.test.ts`'s own test 18 exercises directly, reachable through this file's own proven proxy-local route with `CLAUDE_PROJECT_DIR` set. Per the ladder's own ordering (exhaust lower rungs before retiring), I rewrote the test at rung 2 instead of retiring it at rung 6, keeping the property live at the integration layer through a real spawned proxy. `anno-confinement.test.ts`'s test 18 is cited in the rewritten test's own comment as the underlying function's unit-level coverage, not as its successor.

## Issues Encountered

None. Every `node --test` run (isolated single-test via `--test-name-pattern`, the three port-target sibling suites, and the full file) completed within its own budget; the ~2m full-file run matched the execution notes' stated budget. No stray `x64sc` or broker process at any point (`pgrep -c x64sc` = 0 before and after every measurement); the three long-lived `vice-proxy.ts` processes present throughout are Claude Code's own MCP servers and were left untouched. One recurring, harmless artifact was observed and is NOT a defect: running this file with `node --test --test-name-pattern '...'` in isolation always prints `after() force-closed 0 leaked server(s) and killed 1 leaked child(ren)` -- confirmed (by running an already-passing, untouched test the same way) to be a pre-existing race between a test's own `child.kill("SIGKILL")` and the child's asynchronous `exit` event under an isolated single-test run, unrelated to any change in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vice-proxy.test.ts` is fully green: 56 tests, 53 pass, 0 fail, 3 skipped (the 3 skips are the pre-existing `WORKSPACE_ENV`-gated tests, unchanged, explicitly out of this plan's scope per the file's own header note on that idiom).
- The file's header comment, the `WORKSPACE_ENV` gate comment, and the manual-only disposition are byte-identical to Plan 55-04's end commit (confirmed by `diff`), ready for Plan 55-06's ledger rewrite to describe truthfully.
- `stock-dispatch.test.ts`, `vice-proxy-ping.test.ts`, `anno-confinement.test.ts`: 160/160 passing, byte-unchanged by this plan.
- `stock-handler.test.ts`: 17/17 passing, byte-unchanged by this plan (read only, to locate a successor).
- `npm run test:automated`: 4417 tests, 0 failures, 9 skipped -- unmoved.
- No broker or stray `x64sc` process running at handoff (`pgrep -c x64sc` = 0).

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.test.ts`
- FOUND commit: `2f06b1a0` (Task 1 -- tracer rewrite)
- FOUND commit: `df0ad368` (Task 2 -- six remaining singles)
- FOUND commit: `036dcf8a` (Task 3 -- reconciliation, orphan sweep)

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-14*
