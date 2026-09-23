---
phase: 64-files-as-bytes-both-directions
plan: 08
subsystem: broker
tags: [broker-control, vice-proxy, security, gap-closure, G-64-1]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    provides: "the relay/attach and monitor_claim primitives this plan re-authenticates"
provides:
  - "attach and transfer dispatched ahead of the per-boot control-token gate, authenticated by their broker-minted handle alone"
  - "resolveEndpointPort() -- the one default-port resolver for every fixed-endpoint dial, honouring VICE_BROKER_CONTROL_PORT"
  - "the G-64-1 regression suite: a real vice-proxy.ts over stdio, against a real control listener, proving the binary relay, both transfer directions and the text relay all succeed"
  - "the T-63-01/T-63-05 reversal recorded as Phase 64 evidence, with the replacement mitigation and residual risk itemised"
affects: [64-09, 64-10, 64-11, phase-66]

actuals:
  tokens: 29425
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "handle-only pre-gate dispatch: an op minted only over an already-authenticated session can itself skip the per-boot token check"

key-files:
  created:
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md
    - .planning/phases/64-files-as-bytes-both-directions/deferred-items.md
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/broker-endpoint.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/vice-proxy.test.ts
    - .planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-SECURITY.md
    - .planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md

key-decisions:
  - "Route (b) — handle-only authority — not route (a) threading the per-boot token through client deps, per owner decision 5 (REQUIREMENTS.md: the token is dropped, no phase may plan a credential)"
  - "Moved only the dispatch POSITION of attach/transfer, never the handle checks themselves (still owned by vice-broker.mts's handleRelayAttach()/handleFileTransfer())"
  - "Left the now-dead client-side empty-token parameters (StockDispatchDeps.controlToken etc.) in place — plan 64-09's job, not this plan's"

requirements-completed: [XFER-04, XFER-08]

coverage:
  - id: D1
    description: "attach dispatched ahead of the per-boot token gate, authenticated by its broker-minted handle alone, proven through a real vice-proxy.ts over stdio"
    requirement: XFER-04
    verification:
      - kind: integration
        ref: "vice-proxy.test.ts#G-64-1 tracer: vice_ping through the real proxy reaches a handle-authenticated relay attach, end to end"
        status: pass
      - kind: integration
        ref: "broker-endpoint.test.ts#dialBrokerEndpoint with no port option reaches a hello-answering listener on the port named by VICE_BROKER_CONTROL_PORT"
        status: pass
    human_judgment: false
  - id: D2
    description: "transfer dispatched ahead of the token gate, both directions proven through the real proxy with no broker-side path in either result"
    requirement: XFER-08
    verification:
      - kind: integration
        ref: "vice-proxy.test.ts#G-64-1 transfer: vice_snapshot_save then vice_snapshot_load complete through the real proxy in both directions, with no broker-side path in either result"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#transfer: a wrong token, and a request with no token field at all, both still reach onFileTransfer -- G-64-1 route (b), the token is neither required nor read for this op"
        status: pass
    human_judgment: false
  - id: D3
    description: "every other control op (including the second-attach refusal) is still refused correctly, and a pre-gate refusal never unlocks a gated op"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#attach: a channel already attached is refused by the REAL handleRelayAttach(), reached with no token at all"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#after a refused attach and a refused transfer on one connection, a token-less status line on that SAME connection is still answered unauthorized -- a pre-gate refusal never unlocks a gated op"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#stage_file: unauthorized when the token is wrong, before the callback is ever invoked"
        status: pass
    human_judgment: false
  - id: D4
    description: "the text channel also completes through the real proxy, authenticated by its own handle"
    verification:
      - kind: integration
        ref: "vice-proxy.test.ts#G-64-1 text: vice_warp_set completes through the real proxy over the text relay, authenticated by its own handle"
        status: pass
    human_judgment: false
  - id: D5
    description: "the T-63-01/T-63-05 reversal is recorded as Phase 64 evidence, with the replacement mitigation and residual risk"
    requirement: XFER-04
    verification: []
    human_judgment: true
    rationale: "Whether the written record is complete/legible for a future reviewer is a judgment call, not something a test asserts"

duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 08: G-64-1 handle-only authority for attach/transfer Summary

**Closed UAT gap G-64-1's primary cause by moving `broker-control.mts`'s `attach` and `transfer` dispatch ahead of the per-boot control-token gate, authenticated instead by the broker-minted handle each mints over an already-token-gated session — proven end to end by a real `vice-proxy.ts` over stdio against a real control listener, on the binary relay, both transfer directions and the text relay.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 9 (2 created)

## Accomplishments

- `broker-control.mts`'s `handleLine()` dispatches `attach` and `transfer` immediately after `hello`, before `tokensMatch()` runs — every handle check itself (length-checked `timingSafeEqual`, second-attach refusal, unknown-handle refusal, in-flight guard) is untouched, only the dispatch position moved.
- `broker-endpoint.ts` gained `resolveEndpointPort()`, the one default-port resolver every fixed-endpoint dial (`dialBrokerEndpoint()`, `dialMonitorRelay()`, `dialFileTransfer()`) now uses, honouring `VICE_BROKER_CONTROL_PORT` — closing the latent "relay always dials 19510" defect the G-64-1 diagnosis recorded.
- A new regression suite in `vice-proxy.test.ts` (`G-64-1 tracer`/`G-64-1 transfer`/`G-64-1 text`) drives the REAL `vice-proxy.ts` over stdio against a REAL `startControlListener()`, with the REAL `handleMonitorClaim()`/`handleRelayAttach()`/`handleStageFile()`/`handleFileTransfer()` from the compiled artifact — the exact production path the pre-existing proxy tests never exercised (they either discarded the result or injected a relay stub), and reads every result instead of discarding it.
- `broker-control.test.ts` gained direct coverage for the new dispatch order: `transfer` reached with a wrong token or no token at all, a refused `attach`+`transfer` never unlocking a token-less `status` on the same connection, and the real second-attach refusal reached with no token presented.
- `63-SECURITY.md` and the pending todo that first traced this defect both now point at `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md`, the full reversal record.

## Task Commits

1. **Task 1: Tracer — vice_ping through the real proxy reaches a handle-authenticated relay attach, end to end** - `2c1afbf1` (feat) — includes `attach`'s dispatch move, `resolveEndpointPort()`, and the G-64-1 tracer/transfer/text test suite + shared fixture in `vice-proxy.test.ts` (see Deviations for why Tasks 1–3's `vice-proxy.test.ts` work landed in one commit)
2. **Task 2: transfer joins attach ahead of the gate, proven at the wire and through the real proxy in both directions** - `1b746135` (test) — `broker-control.mts`'s `transfer` dispatch move was included in commit `2c1afbf1` alongside `attach` (see Deviations); this commit covers the `broker-control.test.ts`/`text-connect.test.ts` test-side work
3. **Task 3: The text channel through the real proxy, and the T-63-01 reversal on record** - `9d3a5110` (docs) — evidence file, `63-SECURITY.md` Superseded note, pending todo Resolution section (the `G-64-1 text` test itself is in commit `2c1afbf1`, see Deviations)

_Note: commit boundaries were consolidated relative to the plan's per-task file lists — see Deviations below._

## Files Created/Modified

- `src/mcp/vice/broker-control.mts` - `attach`/`transfer` dispatched ahead of the token gate; every touched comment rewritten to state the new rule and name G-64-1/owner decision 5
- `src/mcp/vice/resources/broker-control.mjs` - rebuilt artifact matching the source change
- `src/mcp/vice/broker-endpoint.ts` - new `resolveEndpointPort()`/`ResolveEndpointPortOptions`, used as the default at all three dial sites
- `src/mcp/vice/broker-endpoint.test.ts` - `resolveEndpointPort()` behavioural cases plus the no-`port`-option `dialBrokerEndpoint()` case
- `src/mcp/vice/broker-control.test.ts` - split the token-wrong stage_file/transfer test; added the refused-attach-then-transfer-then-status case and the real-handler second-attach case; extended the `monitorClients` structural allowlist
- `src/mcp/vice/text-connect.test.ts` - mirrored the same structural allowlist extension (the two files keep an identical copy of this guard by convention)
- `src/mcp/vice/vice-proxy.test.ts` - the G-64-1 tracer/transfer/text tests and their shared fixture (`g6408StartFixture()`, a real control listener + real binary/text stub emulators + real broker-side handlers)
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md` - the full reversal record
- `.planning/phases/64-files-as-bytes-both-directions/deferred-items.md` - the one out-of-scope finding (see Deviations)
- `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-SECURITY.md` - dated Superseded note appended below the threat register; historical T-63-01/T-63-05 rows left unedited
- `.planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md` - Resolution section appended, path unchanged

## Decisions Made

- Route (b) (handle-only authority) over route (a) (thread the token through) — binding per the orchestrator and owner decision 5; route (a) would have planned new production reliance on a credential Phase 66 deletes.
- The client-side empty-token parameters this defect traces through (`StockDispatchDeps.controlToken`, `defaultDialMonitorSocket()`/`defaultTransferFile()`'s `controlToken` plumbing) are left in place — dead weight, not a defect, now that the ops they targeted no longer read them. Removing them is plan 64-09's job, named explicitly in `files_modified`/`prohibitions` there, not this plan's.
- `broker-endpoint.ts`'s `dialBrokerEndpoint()`/`dialMonitorRelay()`/`dialFileTransfer()` all switched from `DEFAULT_CONTROL_PORT` to `resolveEndpointPort()` — a single shared resolver rather than three independent env reads, so the three dial sites cannot drift on how they interpret `VICE_BROKER_CONTROL_PORT`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `broker-control.test.ts`'s pre-existing "stage_file/transfer: unauthorized when the token is wrong" test broke immediately on the dispatch move**
- **Found during:** Task 1 verification (running `broker-control.test.ts` after moving `attach` pre-gate)
- **Issue:** The existing test asserted a `transfer` line with a wrong token is refused `unauthorized` — no longer true once `transfer` moved pre-gate (this is exactly Task 2's own planned split, encountered one task early because both `attach` and `transfer` were moved together for efficiency — see deviation 3 below)
- **Fix:** Split the test as Task 2's own action text specifies: `stage_file`'s half unchanged, `transfer`'s half rewritten to assert the callback IS reached with a wrong token / no token at all
- **Files modified:** `src/mcp/vice/broker-control.test.ts`
- **Verification:** `node --test broker-control.test.ts` — 125/125 pass before this fix's target test existed, then the full Task 2 suite (206 tests) green after
- **Committed in:** `1b746135`

**2. [Rule 3 - Blocking] `monitorClients` structural allowlist test failed once `vice-proxy.test.ts` gained a raw `InstanceRecord` literal**
- **Found during:** Task 1's own `broker-endpoint.test.ts broker-control.test.ts broker-relay.test.ts resources-sync.test.ts vice-proxy.test.ts` verify command
- **Issue:** `broker-control.test.ts`'s (and its mirror in `text-connect.test.ts`) "no halting-path module reads monitorClients" structural guard maintains a closed file allowlist; `vice-proxy.test.ts`'s new G-64-1 fixture constructs a raw `InstanceRecord` literal (satisfying the type's non-optional `monitorClients` field) and was not on the list
- **Fix:** Added `vice-proxy.test.ts` to both copies of the allowlist, with a comment matching the existing convention
- **Files modified:** `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts`
- **Verification:** the structural test passes; full re-run of the Task 1 verify set (275/275, 3 skipped) green
- **Committed in:** `1b746135`

**3. [Rule 1 - Bug] Two of Task 2's own new broker-control.test.ts/vice-proxy.test.ts tests leaked real incident records into `~/.c64-re-tools/incidents/` on first write**
- **Found during:** Manual verification after Task 1's tracer test passed — noticed a stray incident file at the real machine-level path
- **Issue:** The G-64-1 `vice-proxy.test.ts` fixture's `onRelayAttach` wiring, and `broker-control.test.ts`'s own new "second attach" test, both called the real `handleRelayAttach()` with no `deps.writeIncident` override. A relay-death teardown (fired when this suite's own `proxy.child.kill("SIGKILL")` / connection close tears the relay socket down) therefore fell back to the real, machine-level `brokerIncidentsDir()` — exactly the prohibition this plan's own frontmatter names by name ("never point any test at ... the real ~/.c64-re-tools")
- **Fix:** Added a fresh `mkdtempSync` `incidentsDir` to both fixtures and threaded `{ writeIncident: (record) => writeBrokerIncident(record, { dir: incidentsDir }) }` into every `handleRelayAttach()` call, mirroring `broker-relay.test.ts`'s own established default; cleaned up the leaked files from the real directory by hand
- **Files modified:** `src/mcp/vice/vice-proxy.test.ts`, `src/mcp/vice/broker-control.test.ts`
- **Verification:** re-ran both fixtures' tests and confirmed `~/.c64-re-tools/incidents/` file count is unchanged before/after (measured 83→83, and separately 82→82)
- **Committed in:** `2c1afbf1`, `1b746135`

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 bug). **Impact:** all three were necessary to keep the suite green and honour the plan's own no-real-machine-writes prohibition; no scope creep.

### Architectural / process deviation (not a Rule 1-3 auto-fix)

**Task commit boundaries consolidated.** The plan's own per-task `<files>` lists overlap heavily by design (Task 2/3's own read_first notes describe their tests as built "on top of Task 1's fixture"). For execution efficiency this plan implemented `attach`'s move (Task 1) and `transfer`'s move (Task 2) together in `broker-control.mts` in a single pass, and wrote all three `vice-proxy.test.ts` tests (tracer/transfer/text) together against one shared fixture (`g6408StartFixture()`), rather than writing and committing them in three separable passes. The resulting git history is 3 commits, one per task in the plan's own order, but each commit's file list does not exactly match that task's own `<files>` block — `broker-control.mts`'s `transfer` move and `vice-proxy.test.ts`'s `G-64-1 text` test both landed in commit `2c1afbf1` (Task 1) rather than commits `1b746135`/`9d3a5110` (Tasks 2/3). Every `<acceptance_criteria>` and `<verify>` line from all three tasks passes against the final tree; nothing named in the plan is missing. Flagged here rather than silently presented as a clean per-task history.

## Issues Encountered

**Pre-existing, out-of-scope incident-leak in unmodified files.** Running the full `npm test` glob (or `broker-relay.test.ts`/`broker-relay-text.test.ts` in isolation, neither touched by this plan) writes one real incident record to `~/.c64-re-tools/incidents/` per run. Confirmed independent of this plan's diff (reproduced against the pre-existing, unmodified files alone) and confirmed this plan's OWN new/modified tests do not contribute to it (verified zero-delta runs of the Task 1 and Task 2 verify file sets in isolation). Not fixed — out of scope (not in this plan's `files_modified`). Recorded in `.planning/phases/64-files-as-bytes-both-directions/deferred-items.md` and in the cross-phase `WINDOWS.md` ledger (`gsd_run windows append`, kind `deviation`).

**Two pre-existing untracked files under `docs/`** (`docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`) are present in the working tree per the orchestrator's own dispatch notes — not created, modified or touched by this plan. Excluded from this plan's own "nothing under docs/ was created or modified" acceptance criterion per that criterion's own stated carve-out.

## Verification (measured)

- `node --test broker-endpoint.test.ts broker-control.test.ts broker-relay.test.ts resources-sync.test.ts vice-proxy.test.ts text-connect.test.ts` → 288 tests, 285 pass, 0 fail, 3 skipped (the file's own pre-existing `WORKSPACE_ENV` gate), exit 0.
- `node --test broker-control.test.ts vice-proxy.test.ts resources-sync.test.ts transfer-disjoint-roots.test.ts vice-broker-staging.test.ts text-connect.test.ts` → 206 tests, 203 pass, 0 fail, 3 skipped, exit 0.
- `node --test vice-proxy.test.ts` (whole file, the CI full-glob-covered form) → 59 tests, 56 pass, 0 fail, 3 skipped, exit 0.
- `npm run typecheck` → exit 0, clean, run after every production edit.
- `npm run build` → exit 0; `resources-sync.test.ts` passes (compiled artifact matches source).
- Full glob `npm test` → 4408 tests, 4324 pass, 0 fail, 84 skipped, exit 0 (baseline before this plan: 4398/4314/0/84 — the +10 delta is exactly this plan's own new tests: 3 in `vice-proxy.test.ts`, 4 in `broker-endpoint.test.ts`, 3 net-new in `broker-control.test.ts`).
- No listener on port 19510 during or after any run (`ss -ltn | grep -c ':19510 '` → 0 throughout).
- No file landed under the real `~/.c64-re-tools/` from any test THIS plan wrote or modified (verified by isolated before/after file-count checks on every fixture this plan touches).

## RED failure text (Task 1, observed before the production change)

Running the `G-64-1 tracer:` test against the pre-fix tree failed first because the relay dial ignored the injected `VICE_BROKER_CONTROL_PORT` (dialling the fixed 19510 instead of the test's ephemeral listener port) — connection refused. Once `resolveEndpointPort()` was wired in to fix that, the SAME test then failed on the token gate with the exact G-64-1 text: `"vice_ping: stock handshake failed (vice: missing or invalid control token)."` — byte-identical to the diagnosis's own offline reproduction (`.planning/debug/vice-proxy-control-token-handshake.md`, Evidence 16:35). Moving `attach`'s dispatch ahead of the token gate made the test pass.

## Known Stubs

None — every G-64-1 test drives the real production code path (real `vice-proxy.ts`, real `broker-control.mts` listener, real `vice-broker.mts` handlers); only the emulator/text-monitor themselves are stubs, which is the plan's own documented environment constraint (no live VICE in this suite).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 64-09 and 64-10 build on this plan's work (64-09 removes the now-dead client-side empty-token parameters this plan left in place; 64-10 addresses the secondary broker.json state-dir cause). The phase is NOT complete — gap closure for G-64-1 continues with 64-09/64-10/64-11.

## Self-Check: PASSED

- `FOUND: src/mcp/vice/broker-endpoint.ts`
- `FOUND: src/mcp/vice/resources/broker-control.mjs`
- `FOUND: src/mcp/vice/broker-control.mts`
- `FOUND: src/mcp/vice/vice-proxy.test.ts`
- `FOUND: .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md`
- `FOUND: .planning/phases/64-files-as-bytes-both-directions/deferred-items.md`
- Commits `2c1afbf1`, `1b746135`, `9d3a5110` all present in `git log --oneline -3`

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*
