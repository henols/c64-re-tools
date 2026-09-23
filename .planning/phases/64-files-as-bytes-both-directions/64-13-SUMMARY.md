---
phase: 64-files-as-bytes-both-directions
plan: 13
subsystem: broker
tags: [transfer, upload, publish-race, tdd, g-64-3, 0x8f]

# Dependency graph
requires:
  - phase: 64 (plans 64-01..64-12)
    provides: the staged-transfer protocol (stage_file/transfer, D-01/D-02/D-04) and the handle-only relay attach seam this plan's completion reply rides
provides:
  - "awaitTransferComplete() (broker-endpoint.ts) -- the client-side reader of the broker's transfer_complete/error completion reply, armed before the payload pipeline and awaited after"
  - "handleFileTransfer()'s upload branch (vice-broker.mts) sets socket.allowHalfOpen=true and writes one transfer_complete/error completion line after receivePayloadToFile() settles, via writeUploadCompletionReply()"
  - "receivePayloadToFile() (broker-transfer.mts) gains an optional beforePublish timing hook and a code/wireReason classification on its failure branch, so a caller can answer a path-free error line"
  - "defaultTransferFile() (stock-connect.ts) resolves an upload only once the broker's completion reply confirms the publish -- never on the client's own write finishing"
  - "AUTOSTART_CMD_FAILURE_TEXT/UNDUMP_CMD_FAILURE_TEXT/DUMP_CMD_FAILURE_TEXT (stock-machine.ts) -- per-command 0x8f text naming what VICE could not do with the file it was handed"
  - "convertWireError()'s ConvertWireErrorOptions.cmdFailureText (stock-handler.ts) -- an override applied only for CmdFailure, and the generic gloss no longer attributes 0x8f to a checkpoint-condition parse failure"
affects: [64-14]

# Actuals (#2632)
actuals:
  tokens: 28160
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Completion-reply-gated resolution: a client-side operation that spans a payload pipeline plus a broker-side async continuation (verify-then-rename) must not resolve on the pipeline's own completion -- it arms a reader for the broker's own confirmation BEFORE starting the pipeline, and resolves only once that reader settles (mirrors the relay attach's own start-continuation pattern from plan 64-12, applied to a payload connection instead of a splice)."
    - "allowHalfOpen as a reply precondition: a server-accepted socket must set allowHalfOpen=true before the peer can possibly send its own FIN, whenever the server intends to write a reply AFTER the peer's write side closes -- otherwise the peer's FIN auto-ends the accepting socket's own writable side first (measured on Node v24.20.0)."
    - "Path-free wire text, full text in stderr: a TransferResult failure carries both `reason` (full, for the broker's own log) and an optional `wireReason` (path-free, for the client-visible reply) -- the two diverge only for the two fs-failure branches that embed destPath."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/broker-transfer.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-machine.ts
    - src/mcp/vice/stock-handler.ts
    - src/mcp/vice/stock-connect.test.ts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/transfer-disjoint-roots.test.ts
    - src/mcp/vice/vice-broker-staging.test.ts
    - src/mcp/vice/broker-endpoint.test.ts
    - src/mcp/vice/stock-handler.test.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/resources/broker-transfer.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "The completion reply's key set is pinned to exactly kind/byteLength/sha256 (transfer_complete) or kind/code/message (error) -- no broker-side path in either, verified by dedicated key-set and no-path-leak tests (T-64-G3-02)."
  - "awaitTransferComplete()'s error-line branch carries the broker's own wireReason message verbatim -- it is already vice:-prefixed by broker-transfer.mts's own convention, so the reader must not add a second prefix (found and fixed as a Task 2 deviation, see below)."
  - "The pre-publish timing hook (HandleFileTransferDeps.beforePublish) is a pure timing seam with no path argument and no return value -- it cannot become the injectable filesystem-root seam D-17 forbids, and the real broker's run() wiring supplies none."
  - "AUTOSTART_CMD_FAILURE_TEXT is shared verbatim by vice_autostart and vice_disk_attach (both send the identical AUTOSTART wire command, D-14's own approximation) rather than duplicated as two near-identical strings."

requirements-completed: [XFER-02, XFER-06, XFER-08]

coverage:
  - id: D1
    description: "An upload's TransferFileFn resolves ok only after the broker has verified the digest and renamed the staged file into place, proven against a publish that lands 300ms late"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "stock-connect.test.ts#stockConnect: publish lands late -- the production upload resolves only once the staged file is published (G-64-3, plan 64-13)"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#vice_snapshot_save/vice_snapshot_load round trip (publish lands late, G-64-3 plan 64-13)"
        status: pass
      - kind: unit
        ref: "transfer-disjoint-roots.test.ts#transfer-disjoint-roots: all four tools complete against a client and a broker that cannot see each other's filesystems..."
        status: pass
    human_judgment: false
  - id: D2
    description: "A broker-side refusal after the payload reaches the client as a path-free error line, the upload resolves ok:false, and the handler sends no AUTOSTART/UNDUMP"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#vice_snapshot_load refusal (G-64-3, plan 64-13): a publish that fails before the rename refuses the load, sends no UNDUMP, and the result text names no path under the broker's own root"
        status: pass
      - kind: unit
        ref: "vice-broker-staging.test.ts#an upload whose declared digest disagrees with its bytes leaves no file at the staged path"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#awaitTransferComplete: resolves ok:false carrying the broker's own message, verbatim, on an error line"
        status: pass
    human_judgment: false
  - id: D3
    description: "The completion reader resolves ok on a match, ok:false on a mismatch/error/close/timeout, and reads a line correctly while the client is mid-write"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#awaitTransferComplete (6 cases: match, mismatch, error, close-without-line, timeout, mid-write)"
        status: pass
    human_judgment: false
  - id: D4
    description: "0x8f says what it means for a file-carrying command; the generic gloss no longer attributes it to a checkpoint-condition parse failure"
    requirement: "XFER-02"
    verification:
      - kind: unit
        ref: "stock-handler.test.ts#convertWireError: CmdFailure's generic text keeps 'no further diagnostic' and no longer names a condition syntax error"
        status: pass
      - kind: unit
        ref: "stock-handler.test.ts#convertWireError: an override for CmdFailure applies only to CmdFailure -- every other wire error code's text is unchanged"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts (4 cases: vice_autostart, vice_disk_attach, vice_snapshot_save, vice_snapshot_load each answering 0x8f with their own exported constant)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full-glob suite is green with no broker running"
    verification:
      - kind: unit
        ref: "npm test (4441 tests, 4357 pass, 0 fail, 84 skipped, exit 0); npm run test:automated (4266 tests, 4257 pass, 0 fail, 9 skipped, exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 57min
completed: 2026-09-24
status: complete
---

# Phase 64 Plan 13: The Broker Reports a Completed Publish, and Every Consumer Waits For It Summary

**Closes G-64-3: vice_disk_attach/vice_snapshot_load/vice_autostart no longer race the broker's own verify-then-rename -- an upload resolves only after the broker writes `transfer_complete` on the transfer connection, and 0x8f now names what VICE could not do with the file instead of pointing at checkpoints.**

## Performance

- **Duration:** 57 min
- **Started:** 2026-09-23T22:10:00Z
- **Completed:** 2026-09-23T23:07:14Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments
- The broker's upload path (`handleFileTransfer()`, `vice-broker.mts`) now writes ONE completion reply line -- `transfer_complete` (observed byteLength/sha256) on success, a path-free `error` line on failure -- after `receivePayloadToFile()` settles, made deliverable by setting `socket.allowHalfOpen = true` before `transfer_ready` (measured: without it, a reply written after the client's own FIN is silently dropped on Node v24.20.0).
- The production client (`defaultTransferFile()`, `stock-connect.ts`) arms a new reader, `awaitTransferComplete()` (`broker-endpoint.ts`), before its payload pipeline and awaits it after -- an upload is reported done only once the broker says so, never on the client's own local write finishing. This closes the exact race `.planning/debug/vice-0x8f-disk-attach-snapshot-load.md` diagnosed at 37-67% failure on a same-host broker.
- Every consumer and stub that used to absorb this race with a bounded poll (`stock-machine.test.ts`, `transfer-disjoint-roots.test.ts`) now reads the staged file synchronously the instant the command arrives, against a broker whose publish is deliberately delayed 300ms by an injectable `beforePublish` timing hook (`HandleFileTransferDeps`) -- a pure timing seam, never the filesystem-root seam D-17 forbids.
- A broker-side publish failure (a rejected `beforePublish` hook, a digest mismatch, a receive/rename fault) now reaches the client as a path-free `error` line and refuses the calling tool without ever sending AUTOSTART/UNDUMP -- proven by a dedicated refusal test and by `vice-broker-staging.test.ts`'s digest-mismatch case.
- 0x8f's generic gloss (`stock-handler.ts`) no longer attributes every occurrence to a checkpoint-condition parse failure (the wording that steered plan 64-11's diagnosis at checkpoints when the real cause was a missing file); each of the four file-carrying tools now gets its own exported, truthful text via a new `ConvertWireErrorOptions.cmdFailureText` override, applied only for `CmdFailure`.

## Task Commits

Each task followed the RED-GREEN cycle (TDD):

1. **Task 1: Tracer -- the production upload resolves only after the broker's publish**
   - `213171f6` (test): RED -- pre-publish hook threaded through `receivePayloadToFile()`/`handleFileTransfer()`, plus `stock-connect.test.ts`'s new real-listener regression test. Verified failing: the upload resolved after 6ms, well before the hook's 300ms delay elapsed (verdict `RED_EVIDENCE_OK`).
   - `737c11bd` (feat): GREEN -- `awaitTransferComplete()`, `writeUploadCompletionReply()`, `socket.allowHalfOpen`, the client-side arm-before/await-after wiring.
   - Tracer feedback gate: re-ran Task 1's own `<verify>` end-to-end (build, typecheck, the four-file test run) -- passed, expanded to Task 2 with no checkpoint (`workflow.human_verify_mode: end-of-phase`, tracer `<verify>` carries only `<automated>`).
2. **Task 2: Every upload consumer and stub stops absorbing the race**
   - `06460319` (test): RED/proof -- `stock-machine.test.ts`/`transfer-disjoint-roots.test.ts` gained the pre-publish hook and synchronous stub reads; a new refusal test; `vice-broker-staging.test.ts` now reads the completion/error line; six new `broker-endpoint.test.ts` unit tests drive `awaitTransferComplete()` directly. One of these -- the verbatim-message assertion -- is a genuine RED against Task 1's own code (a double-prefixed `"vice: vice: ..."` bug); every other new assertion passed immediately, since Task 1 already implemented and proved the underlying behavior (see TDD Gate Compliance below).
   - `a4667a77` (feat): GREEN -- fixed the double-prefix bug in `awaitTransferComplete()`'s error branch; replaced the three ACCEPTED RISK doc comments in `stock-machine.ts` with a statement of the guarantee they now rely on.
3. **Task 3: 0x8f says what it means for a file-carrying command**
   - `7ef5aba2` (test): RED -- two new `stock-handler.test.ts` tests (generic gloss, override isolation) and four new `stock-machine.test.ts` tests (one per file-carrying tool), plus scaffolding: the three exported constants added to `stock-machine.ts` with no call site wired yet, so the test file could load and RED on the real assertion rather than crash on a missing export. All six RED (`RED_EVIDENCE_OK`).
   - `c3ac0296` (feat): GREEN -- `ConvertWireErrorOptions`/`cmdFailureText` in `stock-handler.ts`; the four `convertWireError()` call sites in `stock-machine.ts` wired to their own constant; a Rule-3 fix to two structural D-14 guards (see Deviations).

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/broker-endpoint.ts` - `awaitTransferComplete()`, `DEFAULT_TRANSFER_COMPLETE_TIMEOUT_MS`
- `src/mcp/vice/broker-transfer.mts` - `receivePayloadToFile()`'s `beforePublish` option and `code`/`wireReason` failure classification
- `src/mcp/vice/vice-broker.mts` - `handleFileTransfer()`'s upload branch (`allowHalfOpen`, `writeUploadCompletionReply()`), `HandleFileTransferDeps`
- `src/mcp/vice/stock-connect.ts` - `defaultTransferFile()` arms/awaits the completion reader
- `src/mcp/vice/stock-machine.ts` - three exported CmdFailure-text constants, four `convertWireError()` call sites wired, three doc comments rewritten
- `src/mcp/vice/stock-handler.ts` - `ConvertWireErrorOptions`, the CmdFailure gloss rewrite
- `src/mcp/vice/stock-connect.test.ts` - the "publish lands late" regression test (Task 1)
- `src/mcp/vice/stock-machine.test.ts` - pre-publish hook wiring, synchronous stub reads, the refusal test, four CmdFailure-text tests
- `src/mcp/vice/transfer-disjoint-roots.test.ts` - pre-publish hook wiring, synchronous stub reads (AUTOSTART x2 + UNDUMP)
- `src/mcp/vice/vice-broker-staging.test.ts` - completion/error-line reads replacing polling
- `src/mcp/vice/broker-endpoint.test.ts` - six new `awaitTransferComplete()` unit tests
- `src/mcp/vice/stock-handler.test.ts` - two new `convertWireError()` tests
- `src/mcp/vice/text-connect.test.ts`, `src/mcp/vice/broker-control.test.ts` - D-14 structural guard allow-list additions (Rule 3 fix)
- `src/mcp/vice/resources/broker-transfer.mjs`, `src/mcp/vice/resources/vice-broker.mjs` - regenerated

## Decisions Made
See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `awaitTransferComplete()` double-prefixed the broker's own error message**
- **Found during:** Task 2, writing `broker-endpoint.test.ts`'s "carrying the broker's own message, verbatim" test
- **Issue:** `broker-transfer.mts`'s `TransferResult.wireReason` is already `vice:`-prefixed by convention; Task 1's `awaitTransferComplete()` added a SECOND `vice:` prefix on the error-line branch, producing `"vice: vice: ..."`.
- **Fix:** The error-line branch now carries `obj.message` verbatim; only the unrecognisable-reply fallback (which has no message to carry) gets a `vice:` prefix.
- **Files modified:** `src/mcp/vice/broker-endpoint.ts`
- **Verification:** dedicated RED/GREEN cycle -- RED (`RED_EVIDENCE_OK`, the isolated test failing with the doubled prefix), GREEN (the same test passing verbatim).
- **Committed in:** `a4667a77` (Task 2's GREEN commit)

**2. [Rule 3 - Blocking] Two D-14 structural guards broke against Task 1's own new test fixture**
- **Found during:** Task 3, running the full-glob suite (`npm test`) after Task 3's GREEN change
- **Issue:** `text-connect.test.ts` and `broker-control.test.ts` each carry a structural test asserting that only a fixed allow-list of files may contain the `monitorClients` identifier (D-14, plan 41-03). Task 1's own `stock-connect.test.ts` regression test constructs a raw `InstanceRecord` fixture (like every other real-listener test file already on the allow-list) and was not itself added to either copy of the list.
- **Fix:** Added `stock-connect.test.ts` to both allow-lists, matching the existing precedent for `stock-machine.test.ts`/`transfer-disjoint-roots.test.ts`/`vice-broker-staging.test.ts`/`vice-proxy.test.ts`.
- **Files modified:** `src/mcp/vice/text-connect.test.ts`, `src/mcp/vice/broker-control.test.ts`
- **Verification:** full-glob `npm test` exits 0 (4441/4357/0/84).
- **Committed in:** `c3ac0296` (Task 3's GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking structural-guard fix).
**Impact on plan:** Both fixes were necessary for the plan's own `<verify>` gates to pass; neither touches behavior beyond what the plan specifies. No scope creep.

## TDD Gate Compliance

All three tasks carry `tdd="true"` (Task 1 is also `type="tracer"`). Every task has a `test(64-13): RED` commit followed by a `feat(64-13): GREEN` commit, in order; no REFACTOR commit was needed. RED evidence was verified via `gsd_run check tdd-red-evidence` for every task:

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | ✓ (`RED_EVIDENCE_OK`) | ✓ | — | Pass |
| 2 | ✓ (`RED_EVIDENCE_OK` for the double-prefix case) | ✓ | — | Pass |
| 3 | ✓ (`RED_EVIDENCE_OK` x6) | ✓ | — | Pass |

**Task 2's own RED phase needs a stated exception**, exactly the shape 64-12-SUMMARY's Task 3 already recorded. Of Task 2's roughly dozen new/modified assertions across four test files, only ONE -- the `awaitTransferComplete()` verbatim-message test -- exercised genuinely new logic and produced a clean assertion-level RED (the double-prefix bug above). Every other new assertion in Task 2 passed on its FIRST run, for one honest reason: Task 1 had already implemented and proved the underlying completion-reply protocol end to end (its own tracer test, `stock-connect.test.ts`), so generalizing that proof to the handler level (`stock-machine.test.ts`'s three callers, `transfer-disjoint-roots.test.ts`'s four-tool proof) and to the wire-level reader in isolation (`broker-endpoint.test.ts`) is regression-proofing an already-true claim, not driving new implementation. This was verified explicitly before trusting it: I deliberately reverted `broker-endpoint.ts` to its pre-fix (buggy) state and re-ran the full four-file suite, confirming EXACTLY one failure (the RED target) and zero others -- the "passes immediately" claim above is measured, not assumed.

Task 3's own scaffolding step (the three exported constants added to `stock-machine.ts` with no call site wired yet) follows the same precedent 64-12-SUMMARY documented for `DEFAULT_ATTACH_REPLY_TIMEOUT_MS`: an ESM named import of a non-existent export is a whole-file load crash, not a legitimate per-test RED, so the constants were added as minimal scaffolding (their final, already-reasoned text values) before the test file could load at all -- the four `stock-machine.test.ts` assertions then RED'd cleanly on the real behavior (the convertWireError() call sites not yet passing the override), confirmed by running the isolated file and observing exactly 4 failures out of 39 tests.

## Issues Encountered
- While authoring `stock-connect.test.ts`'s new test, an early draft closed the staging control connection right after `stage_file`, which triggers the broker's own `onRelease`/`clearStagingForSession()` and invalidates the handle before the transfer connection could present it -- fixed by keeping the control connection open through the whole upload, matching every other real-listener fixture in this codebase.
- A separate early draft of the refusal test (`stock-machine.test.ts`) omitted `control.close()` in its own `finally`, leaking an open control socket that kept the test process alive past a `not ok` failure during RED capture (never affecting the GREEN, passing state) -- fixed by closing it unconditionally.
- Both resolved during the same task's own authoring; neither reached a committed state.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-64-3 is closed. Plan 64-14 (live measurement of both G-64-3 and G-64-4 together) is next, per this plan's own frontmatter dependency.
- Full-suite baseline: `npm run test:automated` went from 4252/4243/0/9 (pre-dispatch, post-64-12) to 4266/4257/0/9 (post-64-13) -- +14 new tests, zero regressions. `npm test` (full-glob, including manual-only suites): 4441/4357/0/84, exit 0.
- No live broker was started or left running by this plan; `systemctl --user is-active vice-broker.service` reads `inactive` and no `x64sc`/`vice-broker` process is present.
- CR-01 (`text-protocol.ts` near line 850): not touched by this plan.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 6 task commits (`213171f6`, `737c11bd`, `06460319`, `a4667a77`, `7ef5aba2`, `c3ac0296`) found in `git log --oneline --all`.
- All 16 key-files found on disk.
- Plan-level `<verification>` re-run: the production upload resolves only after the broker's publish (proven against the 300ms-late hook, Task 1); every stub emulator opens the staged file synchronously with no polling in both handler-level suites (Task 2); broker-side refusals reach the client path-free and stop the command (Task 2); 0x8f text is truthful for all four file-carrying tools (Task 3); `npm test` and `npm run test:automated` both exit 0 with no broker running.
