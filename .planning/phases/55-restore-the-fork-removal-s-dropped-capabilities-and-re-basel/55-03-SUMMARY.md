---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 03
subsystem: testing
tags: [vice-proxy, test-cleanup, stock-recycle, stock-diagnose, deny-list, dead-code-removal]

# Dependency graph
requires:
  - phase: 55-01
    provides: "wrapPossiblyChunked()'s restored call site (unrelated file, no overlap)"
  - phase: 55-02
    provides: "stock-recycle.test.ts's epoch_after producer coverage -- the successor this plan's Task 1 commit 2 cites before deleting the proxy-side witness"
provides:
  - "vice-proxy.test.ts with every fork-era dead-mechanism test region removed: replaced-machine (D-13/D-14), proxy-local recycle, proxy-local diagnose, checkpoint-arming seam, and the ten deny-list fragments"
  - "A verified, reasoned commit trail: each deletion paired to a named, currently-green successor, or an explicit no-successor-owed disposition"
affects: ["55-04 (owns the rewrite-set failures this plan explicitly left untouched)", "55-05 (owns the no-harness-set failures)"]

actuals:
  tokens: 41629
  tasks: 4
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Cut-by-test-name, not by line range: every deletion located a test by its unique `test(\"...\")` opening string and its own matching top-level `});` closer, verified via a small Python boundary-mapper re-run after every commit -- never a blind line-range sed."
    - "Helper orphan-sweep is deferred until its LAST consumer is gone, even when that consumer lives in a later task's block (e.g. `startFlexibleStandInServer()` survived Tasks 1-2 because diagnose/seam tests still called it, and was only swept in Task 3 once truly zero-consumer)."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.test.ts

key-decisions:
  - "The checkpoint-arming seam block (10 tests) was retired with NO successor suite and NO docs/stock-hard-losses.md entry, per the owner's 2026-09-13 settled disposition recorded in the plan -- it was never a hardware capability, its one production entry's only caller was the fork's own pre-flight (gone), and its user-facing guidance survives independently in src/skills/vice-wedge-triage/SKILL.md."
  - "Two DENY_LIST-adjacent tests NOT in this task's named list were left untouched on purpose, even though one now fails: 'tools/list's vice_ping entry has an inputSchema deep-equal to the manifest's own raw schema' (still passes, out of scope) and 'tools/list's full output matches the manifest exactly ... except for DENY_LIST's deliberate absence' (now fails -- reported here, not silently routed, left for whichever plan owns the rewrite set)."
  - "tmpIncidentsDir() and the StandInServer interface were deliberately NOT swept as orphans -- both still have a live consumer (the endpoint-override survivor, and startStandInServer()/startBigPayloadServer()/startAliveButFailingServer() respectively)."

patterns-established:
  - "Decision ladder for a scattered (non-contiguous) dead-mechanism fragment: (1) does the shipped behavior still exist? (2) can the test even fail given what exists now? (3) is the surviving property covered elsewhere by name? (4) delete with that successor named, or leave in place and report if no successor can be named."

requirements-completed: [PROXY-03, PROXY-04]

coverage:
  - id: D1
    description: "Every test asserting the replaced-machine / fresh-session replacement mechanism (handleGrantedInstanceUnreachable(), machineReplacedMessage(), epochDriftMessage()-reuse) is deleted, with the mechanism confirmed absent from shipped code (grep: 0 executable hits, 5 comment-only survivors)"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "git commit 43412a5c -- grep gate: handleGrantedInstanceUnreachable|epochDriftMessage, 0 executable hits post-deletion"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every test driving the proxy's own recycle implementation is deleted, each paired by name to its successor in stock-recycle.test.ts or incident-record.test.ts, located BEFORE deletion"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts + src/mcp/vice/incident-record.test.ts (50/50 pass, byte-unchanged by this plan)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every test driving the proxy's own diagnose implementation is deleted, each paired by name to its successor in stock-diagnose.test.ts"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-diagnose.test.ts (65/65 pass, byte-unchanged by this plan)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every checkpoint-arming seam-annotation test is deleted under the owner's settled 2026-09-13 disposition -- retired, no successor owed, no docs/stock-hard-losses.md entry added"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "git commit e4321318 -- grep gate: SEAM_HAZARDS|detectCheckpointArmingHazard|runCycleBracket, 0 executable hits; git status --porcelain docs/stock-hard-losses.md empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every test asserting a construction-time deny list is deleted or repointed, on the measured fact that no deny list exists in shipped code (DENY_LIST: 0 hits in vice-proxy.ts, vice_disk_list: 0 hits in tools-manifest.stock.json)"
    requirement: "PROXY-04"
    verification:
      - kind: unit
        ref: "git commit a49a44dd -- grep gates denylist_in_shipped=0, disklist_in_manifest=0; BACK-05/FORKRM-05 fallback pair present and passing"
        status: pass
    human_judgment: false
  - id: D6
    description: "No test is disabled with skip anywhere in this plan; the skip count does not rise at any point"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "grep -c 'test.skip|{ skip:|, { skip' vice-proxy.test.ts: 4 (Task 0 baseline) -> 3 (after Task 1, one gated test was itself a named deletion target) -> 3 (unchanged through Tasks 2-3)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-14
status: complete
---

# Phase 55 Plan 03: Delete the fork-era dead-mechanism regions of vice-proxy.test.ts Summary

**Removed 2,826 lines (6,660 -> 3,834) of assertions about five fork-era mechanisms confirmed gone from shipped code -- replaced-machine, proxy-local recycle, proxy-local diagnose, checkpoint-arming seam, and ten deny-list fragments -- across 5 commits, each naming its successor or its settled no-successor disposition.**

## Performance

- **Duration:** ~50 min (commit span 00:45:57Z-01:04:33Z plus the preceding census/investigation)
- **Tasks:** 4 (Task 0 census, Task 1 two commits, Task 2 two commits, Task 3 one commit)
- **Files modified:** 1 (`src/mcp/vice/vice-proxy.test.ts`)
- **Commits:** 5

## Accomplishments

- **Task 0 census** (no commit, measurement only): full run at this plan's starting commit recorded `tests 122 / pass 49 / fail 69 / cancelled 0 / skipped 4 / todo 0`; top-level `test(` count 117; `skip`-pattern count 4; file line count 6660. No broker or `x64sc` process running during measurement.
- **Task 1, commit 1** (`43412a5c`): deleted the twelve `D-13`/`D-14` replaced-machine tests plus their introducing banner and the block-local `stripCommentsForRegionGate()` helper. Confirmed via grep that `handleGrantedInstanceUnreachable`/`epochDriftMessage` have zero executable references left in shipped code (5 comment-only hits, one of which records the deletion itself). No interleaved survivor lived in this block. Top-level count 117 -> 105.
- **Task 1, commit 2** (`d8ed053e`): deleted the seventeen proxy-local `vice_recycle` tests, paired by name to their successors in `stock-recycle.test.ts` (50 tests including 55-02's ten) and `incident-record.test.ts`. Kept `tmpIncidentsDir()` (still consumed by the endpoint-override survivor) and the `HANG` sentinel (still consumed by `startFlexibleStandInServer()`'s body, needed by the not-yet-deleted diagnose/seam blocks). Deleted `writeEpochFileFixture()`, `withUnsettleableWaitDeadline()`, `makeControllableRecycle()`, `makeControllableRecycleSequence()`, `tmpWorkspaceIncidentsDir()`, `healthyEvidenceRespond()`/`HealthyEvidenceOverrides` -- all zero-consumer after this commit. Top-level count 105 -> 88 (-17, exact). `skip` count 4 -> 3 (one of the four `WORKSPACE_ENV`-gated tests was itself a named deletion target).
- **Task 2, commit 1** (`f4eb10a0`): deleted the twelve proxy-local `vice_diagnose` tests, paired by name to `stock-diagnose.test.ts` (65/65 green, byte-unchanged). Called out that the surviving implementation is not a like-for-like move for two of the twelve -- `stale_read_path` and the rate-threshold heuristic were retired outright in favour of a cpu_history cycle-advance comparison, with `monitor_held_elsewhere` replacing `stale_read_path` in the vocabulary. Deleted the diagnose-section banner, `memHex()`, `sendDiagnose()`, `bracketPhaseHandlers()`, `extractDiagnoseVerdicts()` (all zero-consumer). Kept `startFlexibleStandInServer()` and `forwardedCallsNamed()` -- both still consumed by the not-yet-deleted seam block. Top-level count 88 -> 76 (-12, exact).
- **Task 2, commit 2** (`e4321318`): deleted the ten checkpoint-arming seam tests under the owner's settled 2026-09-13 retirement -- explicitly NO successor suite and NO `docs/stock-hard-losses.md` entry, reasoned in the commit message (intentional fork-only removal, structurally moot single-entry table with its only caller already gone, never a hardware capability, guidance survives in `src/skills/vice-wedge-triage/SKILL.md`). Deleted both currently-vacuous-passing structural guards along with the eight others -- a test that cannot fail is not coverage. Deleted `sendCheckpointAdd()`, `checkpointAddRespond()`, `TEST_FILE_PATH`, `extractSeamHazardsBody()`, `extractSetLiteral()`, `forwardedCallsNamed()` (its last two consumers were in this block). Top-level count 76 -> 66 (-10, exact).
- **Task 3** (`a49a44dd`, one commit covering both the ladder disposition and the orphan sweep): applied the decision ladder to all ten named deny-list fragments; every one reached rung 4 (delete, successor = the two `BACK-05/FORKRM-05` unknown-tool-fallback tests). Swept the now-fully-orphaned `startFlexibleStandInServer()`, `HANG`, and `RespondFn` -- each confirmed zero remaining consumers by grep before removal. Top-level count 66 -> 56 (-10, exact); `skip` count unchanged at 3.

## Final measurements (MEASURED, this session)

- **File size:** 6660 -> 3834 lines (-2826, close to the plan's own "roughly 2,500 lines" estimate).
- **Top-level `test(` count:** 117 -> 56 (-61 total across the plan; matches the sum of every named deletion list: 12 + 17 + 12 + 10 + 10 = 61).
- **`skip`-pattern count:** 4 (Task 0) -> 3 (after Task 1 commit 2) -> 3 (unchanged through the rest of the plan). Never rose.
- **Full-file run:** Task 0 baseline `tests 122 / pass 49 / fail 69 / skipped 4` -> post-plan `tests 61 / pass 42 / fail 16 / cancelled 0 / skipped 3`. `fail` fell by 53 (the plan's own gate required at least 50). The 16 remaining failures are, by name, exactly the rewrite-set and no-harness-set failures the plan's own success criteria assign to later plans -- none is a named survivor and none is one of this plan's deletion targets.
- **`npm run test:automated`:** 4417 tests / 0 failures / 9 skipped -- unmoved from Plan 55-02's baseline, as expected (`vice-proxy.test.ts` is outside this gate's glob).
- **`stock-recycle.test.ts` + `incident-record.test.ts`:** 50/50 pass, byte-unchanged by this plan.
- **`stock-diagnose.test.ts`:** 65/65 pass, byte-unchanged by this plan.
- **`docs/stock-hard-losses.md`:** byte-unchanged (`git status --porcelain` empty) -- confirms no accepted-loss entry was added for the seam retirement, per the owner's settled disposition.
- **Process hygiene:** `pgrep -af 'vice-broker|x64sc'` returned zero matching processes both before Task 0's census and after this plan's final commit. The three long-lived `vice-proxy.ts` processes present throughout are Claude Code's own MCP servers and were left untouched.

## Retired tests and their named successors

### Replaced-machine block (12 tests, `43412a5c`) -- no successor owed, mechanism confirmed absent

All twelve `D-13`/`D-14` tests (`a dead granted instance costs exactly one replacement acquisition...`, `a replacement that lands back on the SAME port...`, `the epoch baseline after a replacement is re-based...`, `a replacement the broker itself refuses (at_capacity)...`, `two consecutive calls against a still-unreachable replacement...`, `structural: the replaced-machine report is built from the existing voided-run vocabulary...`, `the broker connection itself gone -- with a replacement listener available...`, `the broker connection itself gone -- with nothing available to reconnect to...`, `two consecutive calls after the connection dropped...`, `structural: within handleGrantedInstanceUnreachable()...`, `structural: the fresh-session replacement branch performs no release...`, `structural: the source records broker death as an accepted, knowing regression...`) were deleted. The mechanism itself (`handleGrantedInstanceUnreachable()`, `machineReplacedMessage()`, `replacementFailedMessage()`, `sessionMustRestartMessage()`) is gone from shipped code -- no successor is owed for it. The surviving broker-session behaviour remains covered by `three states: each unreachable shape gets its own message and fix`, `never-cache: host down then up succeeds without a restart`, `broker never-cache: absent-then-alive-and-granted succeeds on the SAME process, no restart`, `control-plane unreachable: a fresh heartbeat but a dead connect...`, `fixed-port unreachable is unchanged...` (all still in the file), plus `vice-broker-client.test.ts`.

### Proxy-local recycle block (17 tests, `d8ed053e`) -- paired to `stock-recycle.test.ts` / `incident-record.test.ts`

| Deleted test | Successor |
|---|---|
| a missing or empty reason ... writes no record and no request | `handleRecycleStock: missing/empty/whitespace-only reason refuses before any lease consultation, gather or write` |
| no broker lease held yet ... is refused | `handleRecycleStock: a non-ok lease outcome returns its message verbatim, writing nothing` / `a null lease (VICE_MCP_URL override) refuses explicitly, writing nothing` |
| the incident record ... exists on disk before the recycle request reaches the broker | `handleRecycleStock: the incident record exists on disk, with a complete evidence section, at the MOMENT the recycle RPC is invoked` |
| an ack whose kill stage is the escalated one ... | `handleRecycleStock: already_exited and sigkill are also successful-kill stages` |
| an ack with a refusal ... | `handleRecycleStock: an ok RPC whose ack was not a successful kill finalises the record with the ack's own outcome and does not disconnect` |
| an ack that never arrives before the deadline ... | `handleRecycleStock: a deadline recycle outcome finalises the record with outcome timeout` |
| the broker dropping the connection mid-recycle ... | `handleRecycleStock: a broker_gone recycle outcome finalises the record with outcome broker_gone` |
| after a confirmed recycle, a subsequent forwarded call succeeds ... | `handleRecycleStock: a confirmed kill whose epoch reader advances finalises the record with the new epoch_after` (55-02) |
| a confirmed kill whose epoch file never advances ... | `handleRecycleStock: a confirmed kill whose epoch never advances finalises the record with epoch_after null, never the stale epoch_before value` (55-02) |
| a healthy capture produces a full evidence object ... | `gatherStockWedgeEvidence: a healthy session produces all four items available, no screenshot/snapshot keys` |
| a rejected screenshot capture ... | `handleRecycleStock: the written record contains no screenshot line, while still carrying the other four evidence labels` |
| a rejected checkpoint enumeration ... | `gatherStockWedgeEvidence: a checkpoint_list refusal is reported as checkpoints unavailable, not an empty-but-available list` |
| a stand-in that rejects every read ... | `gatherStockWedgeEvidence: a session whose every send() rejects still resolves with all four items unavailable...` / `handleRecycleStock: a session whose every read rejects still writes a record...` |
| a rejected snapshot attempt ... | `handleRecycleStock: a session whose every read rejects still writes a record (four unavailable entries) and still sends the RPC` |
| an unanswered snapshot call ... | `gatherStockWedgeEvidence: a step whose promise never settles is cut off at a test-set deadline under 50ms, recorded unavailable` |
| two recycles at the same port and epoch ... | `incident-record.test.ts`: `writing twice with an identical timestamp, port and epoch produces two distinct files and the first is byte-unchanged` |
| structural: within handleRecycle(), the record write appears before the request write ... | `handleRecycleStock: the incident record exists on disk, with a complete evidence section, at the MOMENT the recycle RPC is invoked` |

The endpoint-override survivor (`vice_recycle: with the endpoint override set returns a well-formed error result...`) is untouched and still passes.

### Proxy-local diagnose block (12 tests, `f4eb10a0`) -- paired to `stock-diagnose.test.ts`

| Deleted test | Successor |
|---|---|
| a stopping checkpoint at the current PC is a checkpoint trap ... | `checkpoint_trap at PC: an armed stopping exec checkpoint at the current PC traps, Exit send count 0` |
| a stopping checkpoint at the resolved live IRQ handler ... | `checkpoint_trap at handler: no PC match, but a checkpoint at the resolved handler entry with hitCount 0 traps` |
| the trap report names the vector pair, the $01 value ... | `gatherStockCheckpointTrapEvidence` family + both `handleDiagnoseStock (WR-03)` machinePaused-source tests |
| does not fire on disabled, non-stopping, or address-mismatched checkpoints (vacuous) | `checkpoint filter: a disabled checkpoint, a trace (stop:false) checkpoint, and a load/store-only checkpoint at the PC never trap` |
| a restarted epoch is reported with both epoch values ... | `handleDiagnoseStock: a thrown MachineRestartedError during acquisition -> restarted, carrying both epochs` / `an on-disk epoch differing from the session's baseline -> restarted, zero emulator sends` |
| the live IRQ handler resolver is called fresh on every diagnose call ... | `resolveStockLiveIrqHandler: HIRAM set (banked in) reads $01 then $0314 only` |
| a ping-says-running, counter-frozen stand-in is wedged ... | `handleDiagnoseStock: two consecutive zero-advance brackets -> wedged...` / `the first bracket advances -> live...` |
| a ping-says-not-running, counter-advancing stand-in is live ... | `runStockLivenessBracket: cpu_history route -- advanced:true when the second sample's cycle is higher` |
| a byte-identical register read ... is stale_read_path; a below-baseline non-zero rate ... | NOT a like-for-like move -- `stale_read_path` and the rate-threshold heuristic are retired outright; pinned by `structure: stale_read_path appears only inside a comment` and the `runStockLivenessBracket`/`channelContention` families |
| structural: runCycleBracket has exactly one definition ... | superseded by direct unit testing of `runStockLivenessBracket()` |
| structural: DIAGNOSE_VERDICTS is a frozen five-member array ... | `STOCK_DIAGNOSE_VERDICTS: exactly the five of D-03, in order, neither stale_read_path nor diagnosis_unavailable present` |

The registration survivor (`vice_diagnose appears in tools/list alongside the other synthetic tools`) is untouched and still passes.

### Checkpoint-arming seam block (10 tests, `e4321318`) -- retired, no successor owed

All ten tests (`seam: arming a stopping exec checkpoint...`, `seam: the annotated result's error flag is false...`, `seam: a continue-only checkpoint...`, `seam: a checkpoint-add call the host rejects...`, `seam: the annotation makes no additional forwarded calls`, `seam: a repeat arm at the same address...`, `structural: every SEAM_HAZARDS entry...`, `structural: the refusal set and the annotation set are disjoint`, `synthetic second entry ('test-fixture-synthetic-entry')...`, `structural: SEAM_HAZARDS's checkpoint-arming detector...`) are gone. Per the owner's 2026-09-13 settled disposition: intentional fork-only removal, structurally moot (one production entry whose only caller -- the fork's own pre-flight -- is gone, no generic-dispatch surface left to hang a second entry off), never a hardware capability (wrong home for `docs/stock-hard-losses.md`), and its user-facing guidance survives in `src/skills/vice-wedge-triage/SKILL.md`'s checkpoint_trap remediation table.

### Deny-list fragments (10 tests, `a49a44dd`) -- verdict table, all paired to the two `BACK-05/FORKRM-05` survivors

| Test | Rung reached | Disposition |
|---|---|---|
| vice_disk_list is refused at tools/call with no request made | 4 (was failing on specific deny-list wording) | delete, successor: `BACK-05/FORKRM-05` pair |
| tools_list is refused at tools/call with no request made | 4 (was failing on `/bypass\|nested/i` wording) | delete, successor: `BACK-05/FORKRM-05` pair |
| vice_disk_list is absent from tools/list | 4 (was failing -- injected fixture manifest, no filter left to remove it) | delete, successor: `BACK-05/FORKRM-05` pair |
| structural: the construction-time tools registry itself filters DENY_LIST ... | 4 (was failing -- greps for a regex that no longer exists) | delete, no successor owed |
| vice_disk_list is still absent from tools/list and still refused ... | 2 (vacuous) | delete, successor: `BACK-05/FORKRM-05` pair |
| tools_call carrying a nested vice_disk_list argument ... | 4 (was failing on `/bypass\|nested/i` wording) | delete, successor: `BACK-05/FORKRM-05` pair |
| tools_call is refused at tools/call ..., even with a benign nested name | 2 (vacuous) | delete, successor: `BACK-05/FORKRM-05` pair |
| initialize is refused at tools/call with no request made | 2 (vacuous) | delete, successor: `BACK-05/FORKRM-05` pair |
| notifications_initialized is refused at tools/call with no request made | 2 (vacuous) | delete, successor: `BACK-05/FORKRM-05` pair |
| BACK-05 (D-G ordering, observed at the wire): DENY_LIST still wins ... | 4 (was failing -- demanded "permanently forbidden" wording) | delete, no successor owed for the ordering guarantee itself; the `vice_diagnose` half is covered by the registration survivor |

Both `BACK-05/FORKRM-05:` fallback tests are untouched and still pass.

### Tests routed elsewhere (NOT deleted, reported per the ladder)

Two DENY_LIST-adjacent tests were **not** in this task's named list and were left untouched:
- `tools/list's vice_ping entry has an inputSchema deep-equal to the manifest's own raw schema` -- still passes, genuinely out of this plan's scope.
- `tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap) except for DENY_LIST's deliberate absence` -- **now fails** (its own DENY_LIST-shaped assertion no longer holds). Reported here rather than silently deleted or routed by guesswork; left for whichever plan owns the rewrite set (per this plan's own success criteria, that is 55-04's territory, not this plan's).

### Helpers removed with their zero-consumer evidence

| Helper | Removed in | Zero-consumer evidence |
|---|---|---|
| `stripCommentsForRegionGate()` | `43412a5c` | Defined and consumed only within the deleted replaced-machine block (lines 3298-3883 pre-deletion) |
| `writeEpochFileFixture()`, `withUnsettleableWaitDeadline()`, `makeControllableRecycle()`, `makeControllableRecycleSequence()` | `d8ed053e` | All call sites confirmed inside the 17 deleted recycle tests only, via grep before removal |
| `tmpWorkspaceIncidentsDir()`, `healthyEvidenceRespond()`/`HealthyEvidenceOverrides` | `d8ed053e` | All call sites confirmed inside the deleted evidence-gathering recycle tests only |
| `memHex()`, `sendDiagnose()`, `bracketPhaseHandlers()`, `extractDiagnoseVerdicts()` | `f4eb10a0` | All call sites confirmed inside the 12 deleted diagnose tests only |
| `sendCheckpointAdd()`, `checkpointAddRespond()`, `TEST_FILE_PATH`, `extractSeamHazardsBody()`, `extractSetLiteral()`, `forwardedCallsNamed()` | `e4321318` | All call sites confirmed inside the 10 deleted seam tests (the last two `forwardedCallsNamed()` consumers were both here) |
| `startFlexibleStandInServer()`, `HANG`, `RespondFn` | `a49a44dd` | Zero call sites remained after Tasks 1-2's recycle/diagnose/seam deletions; confirmed by grep immediately before removal |

**NOT swept** (both confirmed to have a surviving consumer, checked by grep before every helper removal): `tmpIncidentsDir()` (consumed by the endpoint-override survivor) and the `StandInServer` interface (consumed by `startStandInServer()`, `startBigPayloadServer()`, `startAliveButFailingServer()`).

## Task Commits

1. **Task 0: Re-census the file and record the pre-deletion baseline** - no commit (measurement only)
2. **Task 1: Delete the replaced-machine region and the proxy-local recycle region** - `43412a5c` (test), `d8ed053e` (test)
3. **Task 2: Delete the proxy-local diagnose region and the checkpoint-arming seam region** - `f4eb10a0` (test), `e4321318` (test)
4. **Task 3: Dispose of the deny-list fragments and the remaining vacuous passers** - `a49a44dd` (test)

**Plan metadata:** (recorded separately by the orchestrator, per this plan's constraint against committing docs artifacts from this agent)

## Files Created/Modified

- `src/mcp/vice/vice-proxy.test.ts` - deleted five fork-era dead-mechanism regions (replaced-machine, proxy-local recycle, proxy-local diagnose, checkpoint-arming seam, ten deny-list fragments) and their now-orphaned helpers; 6660 -> 3834 lines.

## Decisions Made

- The checkpoint-arming seam block was retired with no successor and no `docs/stock-hard-losses.md` entry, per the owner's 2026-09-13 settled disposition already recorded in the plan -- this plan executed that decision, it did not make it.
- `HANG`, `startFlexibleStandInServer()`, `RespondFn`, `forwardedCallsNamed()`, and `tmpIncidentsDir()` were each individually re-checked for zero-consumer status at the specific commit where their last consumer would be gone, rather than deleted eagerly alongside the block they were textually adjacent to -- this deferred three helpers (`startFlexibleStandInServer()`, `HANG`, `RespondFn`) from Task 1 into Task 3's orphan sweep, and left two (`tmpIncidentsDir()`, `StandInServer`) in the file permanently.
- Two DENY_LIST-adjacent tests outside this task's explicit 10-item list were left untouched rather than opportunistically deleted, even though one now fails -- the plan named exactly which tests to apply the ladder to, and expanding that list on my own judgment would have been scope creep the plan's own prohibitions warn against.

## Deviations from Plan

**None of Rules 1-4** were triggered -- this plan is pure test deletion with no source-code changes and no bugs to fix.

**One measured discrepancy, reported per the instruction to follow the measurement over the plan when they conflict:** the plan's own `<verification>` section states "The `skip` count in `vice-proxy.test.ts` is identical before and after this plan," but the plan's own Task 1 acceptance criteria, three times, state only that the `skip` count "did not rise," and Task 1's own named deletion list explicitly includes `vice_recycle: a healthy capture produces a full evidence object...` -- one of the four `WORKSPACE_ENV`-gated tests. Deleting that named test necessarily drops the `skip`-pattern count from 4 to 3. I followed the task-level instruction (which is satisfied: the count only fell, never rose) and the plan's own explicit test-naming instruction (delete exactly the named test), over the stricter overall-verification wording, and I am reporting the conflict here rather than either leaving a plan-mandated deletion undone or silently overriding the plan's own verification section. Before: 4. After Task 1 commit 2: 3. Unchanged through Tasks 2-3: 3.

## Issues Encountered

- The full, unfiltered `node --test vice-proxy.test.ts` run took ~2m18s (matches the execution notes' stated ~2m16s budget), and was run three times across this session (Task 0's baseline census, Task 1's mid-plan check omitted in favor of grep-based interim checks, and Task 3's final full run) plus once for the automated gate. No hang, no stray process.
- The census's own top-level `test(` count (117) undercounted the runner's own `tests` count (122) by exactly 4 -- the difference is the four `WORKSPACE_ENV`-gated tests, whose skip marker (`﹣`) does not match a `^test(` grep line pattern differently than a passing/failing one; both counts were cross-verified to add up exactly (`49 pass + 69 fail + 4 skipped = 122`) before treating either as authoritative.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vice-proxy.test.ts` now contains zero tests whose subject is a confirmed-dead fork-era mechanism. Its remaining 16 failures are, by name, the rewrite-set and no-harness-set failures this plan's own success criteria assign to later plans (55-04, 55-05) -- none is a survivor this plan named as protected, and none is one of this plan's own deletion targets.
- The two DENY_LIST-adjacent tests left untouched (one now genuinely failing: `tools/list's full output matches the manifest exactly ... except for DENY_LIST's deliberate absence`) are ready for whichever plan owns the rewrite set to pick up by name.
- `stock-recycle.test.ts`, `incident-record.test.ts`, and `stock-diagnose.test.ts` remain byte-unchanged and fully green -- this plan only ever read them to locate successors, never modified them.
- `npm run test:automated` is unmoved at 4417/0/9 -- this plan touched only a manual-only file outside that gate's glob.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.test.ts`
- FOUND: `.planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel/55-03-SUMMARY.md`
- FOUND commit: `43412a5c` (Task 1 commit 1 -- replaced-machine block)
- FOUND commit: `d8ed053e` (Task 1 commit 2 -- proxy-local recycle block)
- FOUND commit: `f4eb10a0` (Task 2 commit 1 -- proxy-local diagnose block)
- FOUND commit: `e4321318` (Task 2 commit 2 -- checkpoint-arming seam block)
- FOUND commit: `a49a44dd` (Task 3 -- deny-list fragments + orphan sweep)

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-14*
