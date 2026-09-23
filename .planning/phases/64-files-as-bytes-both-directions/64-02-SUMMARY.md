---
phase: 64-files-as-bytes-both-directions
plan: 02
subsystem: transport
tags: [control-plane, tcp, file-transfer, handshake, stock-connect]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 01)
    provides: "transfer-hash.mts (streaming cap+digest Transform), broker-transfer.mts (header framing, sender/receiver), transfer-paths.ts (containment validator)"
provides:
  - "broker-control.mts: ControlRequestKind gains stage_file (twelfth, gated by ownsTarget()) and transfer (thirteenth, deliberately NOT gated -- T-63-01 precedent); StartControlListenerOptions.onStageFile/onFileTransfer (both OPTIONAL, since vice-broker.mts is not wired until plan 64-03); ControlResponse gains file_staged"
  - "broker-endpoint.ts: dialFileTransfer() and TRANSFER_TAG -- the one authoritative way to open a payload connection, reusing every dialMonitorRelay() primitive already in the file, zero new imports"
  - "vice-broker-client.ts: stageFile() on the control session, mirroring claimMonitor()'s shape"
  - "stock-connect.ts: StockConnectBrokerControl.stageFile, StockConnectDeps.transferFile (an injectable TransferFileFn), and a default transferFile implementation streaming through transfer-hash.mts's shared cap-and-digest Transform"
affects: [64-03, 64-04, 64-05, 64-06, 64-07]

actuals:
  tokens: 27903
  tasks: 3
  commits: 3
  plan_head_before: 12158a2631b6f98cc00e4419740ae763be2e33d1

tech-stack:
  added: []
  patterns:
    - "Ownership checked on the command connection, authority checked on the payload connection: stage_file is gated by the SAME ownsTarget() predicate monitor_claim/monitor_release/recycle/operation share; transfer is deliberately NOT gated, mirroring the attach arm's own T-63-01 precedent -- a brand-new connection presenting only a minted handle"
    - "Optional callback with a by-name refusal, not a crash: onStageFile/onFileTransfer are OPTIONAL on StartControlListenerOptions because their real wiring (vice-broker.mts) lands in a later plan; the dispatch arm checks for the callback's presence and answers 'internal' by name rather than calling undefined and taking the whole broker process down with it"
    - "A container-side .ts module must not import a host-bound .mts sibling that itself imports another host-bound .mts sibling by its compiled .mjs specifier -- that import only resolves once built into resources/. A leaf host-bound module with no such relative import (transfer-hash.mts) is safe to import directly from either side; a module with one (broker-transfer.mts) is not."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/broker-endpoint.test.ts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/vice-broker-client.test.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-connect.test.ts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/stock-recycle.test.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/text-tools.test.ts

key-decisions:
  - "onStageFile/onFileTransfer are OPTIONAL fields on StartControlListenerOptions, not required like onRelayAttach/onOperation were when Phase 63 shipped them -- because vice-broker.mts (the real production listener) is not updated to supply them until plan 64-03, and making them required would break every existing call site's typecheck. The dispatch arm refuses by name ('internal') when either is absent, matching this file's own MonitorClaimOutcome comment that a type contract is not a runtime guarantee at a wire boundary."
  - "The default StockConnectDeps.transferFile implementation does NOT import broker-transfer.mts's sendPayloadFromFile()/receivePayloadToFile(), despite mirroring their shape. MEASURED: `node --input-type=module -e 'import(\"./broker-transfer.mts\")'` throws `Cannot find module '.../transfer-hash.mjs'` when run unbuilt -- that module is .mts/host-bound and its own relative import of the compiled sibling only resolves once built into resources/. stock-connect.ts is a plain, never-built container-side .ts file (part of the shipped, buildless MCP server), so importing broker-transfer.mts would break it at runtime. transfer-hash.mts carries no such relative import (only node:crypto/node:stream) and is imported directly instead; the streaming shape (stat + digest pre-pass + streamed send/receive + atomic publish) mirrors broker-transfer.mts's own functions deliberately, without a second header line on the connection -- the byteLength/sha256 header this phase's payload needs is already carried by the transfer control op's own request/reply exchange."
  - "StockConnectDeps.transferFile is normalised ONCE, inside stockConnect() itself, and the resolved (never-undefined) value is what gets stored on the returned session's own deps field -- unlike dialMonitorSocket, which is resolved fresh, locally, on every call and never persisted. This is because plan 64-04's own stock-machine.ts handlers read session.deps.transferFile directly, long after stockConnect() has returned, with no local fallback available at that point."

requirements-completed: []
# XFER-01, XFER-02 and XFER-04 are ALL declared by this plan's frontmatter but
# NONE are marked complete here -- every one has at least one sibling plan
# still open (XFER-01: 64-04/64-07; XFER-02: 64-04/64-06; XFER-04: 64-03), so
# the shared-ID gate (#2388) correctly withholds all three until their last
# declaring plan finishes.

coverage:
  - id: D1
    description: "The broker answers stage_file only for the connection holding the grant, mints an opaque handle plus a broker-side emulator_filename the request did not supply, and answers transfer on the strength of a minted handle alone, never consulting ownsTarget()"
    requirement: XFER-04
    verification:
      - kind: unit
        ref: "broker-control.test.ts#stage_file: a request from a non-owning connection is refused denied, and the onStageFile callback is never invoked"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#stage_file: a request from the owning connection is answered file_staged, with a handle and emulator_filename the request did not supply"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#transfer: ownsTarget() is never consulted -- a valid handle succeeds over a connection that holds no grant at all"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#transfer: a valid handle flips this connection out of line-reading mode BEFORE the callback runs -- a well-formed second JSON line afterwards is NOT dispatched"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#transfer: a callback refusal restores the connection's line reader -- a well-formed second request line afterwards IS dispatched"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#stage_file/transfer: unauthorized when the token is wrong, before either callback is ever invoked"
        status: pass
    human_judgment: false
  - id: D2
    description: "A client can dial a payload connection through the one module that owns dialling (dialFileTransfer()), presenting a handle and receiving either a go-ahead or a declared payload header, with payload bytes carried out as raw Buffers rather than string-decoded"
    requirement: XFER-04
    verification:
      - kind: integration
        ref: "broker-endpoint.test.ts#dialFileTransfer: a download's transfer_payload reply and its first payload bytes arriving in a SINGLE socket write resolve `pending` byte-identical to the payload sent, including bytes in 0x80..0xFF"
        status: pass
      - kind: integration
        ref: "broker-endpoint.test.ts#dialFileTransfer: races the same two candidates on the fixed control port, keeps the first to complete a hello, and destroys the loser"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#dialFileTransfer: the hello line this dial writes carries the value of TRANSFER_TAG"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#dialFileTransfer: every failure mode resolves rather than rejecting, and the returned reason is a non-empty string"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tool handler can reach broker-side staging and a payload transfer through the session it already holds (stageFile() on the control session, stageFile/transferFile on StockConnectBrokerControl/StockConnectDeps), with an injectable seam that lets every handler test run without a socket"
    requirement: XFER-01
    verification:
      - kind: unit
        ref: "vice-broker-client.test.ts#stage_file: stageFile() against a stub answering ok resolves a success outcome carrying the broker-minted handle and emulator_filename, and never opens a second socket"
        status: pass
      - kind: unit
        ref: "vice-broker-client.test.ts#stage_file: a success reply missing handle or emulator_filename is reported as a protocol failure, never a fabricated value"
        status: pass
    human_judgment: false
  - id: D4
    description: "vice-broker-client.ts's two legacy UTF-8 string framers are untouched, and no payload byte can reach them by construction (the transfer rides broker-endpoint.ts, which accumulates as a Buffer)"
    requirement: XFER-02
    verification:
      - kind: other
        ref: "git diff 12158a26 -- src/mcp/vice/vice-broker-client.ts, confirming the two `buffer += chunk.toString(\"utf8\")` lines are byte-identical to their pre-plan state"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full pre-existing suite's failing-test set is unchanged, and every regenerated build artifact this plan touches is committed and tracked"
    verification:
      - kind: integration
        ref: "npm test (full suite): 4355 tests, 4271 pass, 0 fail, 84 skipped"
        status: pass
      - kind: other
        ref: "resources-sync.test.ts"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 2: File-Transfer Control-Plane Wiring Summary

**Two new control-plane ops (`stage_file`, `transfer`) on the wire, `dialFileTransfer()` as the one authoritative payload-connection dial, and the client-side `stageFile()`/`transferFile` seams `stock-machine.ts` will use in later plans -- with `onStageFile`/`onFileTransfer` deliberately optional until plan 64-03 wires the real broker.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-23T10:16:21Z
- **Completed:** 2026-09-23T11:02:26Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `broker-control.mts`: `ControlRequestKind` gains `stage_file` (twelfth member, gated by the same `ownsTarget()` predicate `monitor_claim`/`monitor_release`/`recycle`/`operation` already share) and `transfer` (thirteenth member, deliberately NOT gated -- the `attach` arm's own T-63-01 precedent, since a transfer connection is brand new and its handle is the only authority it can present). Both dispatch arms sit after the token gate. `StartControlListenerOptions` gains `onStageFile`/`onFileTransfer`, both OPTIONAL -- vice-broker.mts is not wired until plan 64-03, so the dispatch arm refuses `internal` by name rather than calling an undefined callback. `ControlResponse` gains `file_staged`.
- `broker-endpoint.ts`: `dialFileTransfer()` and `TRANSFER_TAG`, reusing every primitive `dialMonitorRelay()` already defines in the same file (`DIAL_CANDIDATES`, `dialOneCandidate()`, `classifyHelloReply()`, `describeDialFailure()`) -- zero new imports. Races the same two-candidate hello handshake, then writes one `transfer` request line and reads the reply with a byte-level terminator search, proven against a fake broker that writes the download reply and its first payload bytes (spanning the full 0x00-0xFF range) in a single socket write.
- `vice-broker-client.ts`: `stageFile()` on the control session, mirroring `claimMonitor()`'s shape exactly -- same `sendAndAwaitLine()` path, same session, same token; a missing `handle`/`emulator_filename` on a success reply is a protocol failure, never fabricated.
- `stock-connect.ts`: `StockConnectBrokerControl.stageFile`, `StockConnectDeps.transferFile` (an injectable `TransferFileFn`), and a default `transferFile` implementation that dials via `dialFileTransfer()` and streams the payload through `transfer-hash.mts`'s shared cap-and-digest `Transform` -- normalised once inside `stockConnect()` so `session.deps.transferFile` is always a concrete function by the time a later plan's handler reads it directly.
- Six pre-existing test files with hand-rolled `StockConnectBrokerControl` fixtures (`broker-relay.test.ts`, `stock-connect.test.ts`, `stock-recycle.test.ts`, `text-connect.test.ts`, `text-tools.test.ts`) gained a one-line `stageFile` stub each, since `stageFile` became a required interface member.

## Task Commits

Each task was committed atomically:

1. **Task 1: Two new dispatch arms -- ownership on the grant connection, handle-only on the payload connection** - `3089d9ac` (feat)
2. **Task 2: dialFileTransfer() -- the one authoritative way to open a payload connection** - `a0007524` (feat)
3. **Task 3: stageFile() on the control session, and the two seams stock-machine.ts will use** - `713beaf0` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/mcp/vice/broker-control.mts` - `stage_file`/`transfer` dispatch arms, `StageFileOutcome`/`FileTransferRequest`/`FileTransferOutcome` types, `onStageFile`/`onFileTransfer` (optional), `file_staged` reply kind
- `src/mcp/vice/broker-control.test.ts` - 19 new cases covering every row of task 1's behavior block, plus 4 pre-existing structural tests updated for the 13-member union
- `src/mcp/vice/resources/broker-control.mjs` - regenerated build artifact
- `src/mcp/vice/broker-endpoint.ts` - `dialFileTransfer()`, `TRANSFER_TAG`, `performTransfer()`, the `DialFileTransferOptions`/`DialFileTransferResult` types
- `src/mcp/vice/broker-endpoint.test.ts` - 7 new cases, including the load-bearing same-TCP-segment byte-identical proof
- `src/mcp/vice/vice-broker-client.ts` - `stageFile()`, `StageFileOptions`/`StageFileOutcome` types, `BrokerControlSession.stageFile`
- `src/mcp/vice/vice-broker-client.test.ts` - 5 new cases covering every row of task 3's `stageFile()` behavior block
- `src/mcp/vice/stock-connect.ts` - `StockConnectBrokerControl.stageFile`, `StockConnectDeps.transferFile`, `TransferFileFn`/`TransferFileRequest`/`TransferFileResult` types, `defaultTransferFile()`, `discardSink()`, normalised `deps` in `stockConnect()`
- `src/mcp/vice/stock-connect.test.ts` - two hand-rolled fixtures gained a `stageFile` stub
- `src/mcp/vice/broker-relay.test.ts`, `stock-recycle.test.ts`, `text-connect.test.ts`, `text-tools.test.ts` - one `stageFile` stub each (deviation, see below)

## Decisions Made

- **`onStageFile`/`onFileTransfer` are OPTIONAL, not required, on `StartControlListenerOptions`.** Unlike `onRelayAttach`/`onOperation` (made required the same plan vice-broker.mts was updated to supply them), `vice-broker.mts`'s own wiring is plan 64-03's job. Making the two new callbacks required today would break every existing call site's typecheck for a module this plan does not touch. The dispatch arm checks for the callback's presence and answers `internal` by name.
- **The default `transferFile` implementation reimplements broker-transfer.mts's send/receive shape rather than importing it.** See the deviation below for the measured reason.
- **`stockConnect()` normalises `deps.transferFile` once, persisting the resolved function on the returned session.** Plan 64-04's own handlers read `session.deps.transferFile` directly with no local fallback, unlike `dialMonitorSocket`, which is resolved fresh on every call inside `stockConnect()` itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `onStageFile`/`onFileTransfer` made OPTIONAL rather than required**
- **Found during:** Task 1
- **Issue:** The plan's wire_vocabulary and task text did not specify optionality. Adding the two callbacks as REQUIRED fields (matching `onRelayAttach`/`onOperation`'s own precedent) would have broken `vice-broker.mts`'s existing `startControlListenerOnHosts()` call site's typecheck, since that module is not updated to supply them until plan 64-03 (confirmed by reading 64-03-PLAN.md's own task 2, which wires them in).
- **Fix:** Declared both fields optional (`onStageFile?`, `onFileTransfer?`). The dispatch arm checks for the callback's presence and answers `internal` by name before ever calling an undefined function.
- **Files modified:** `src/mcp/vice/broker-control.mts`
- **Verification:** `npm run typecheck` clean against the untouched `vice-broker.mts`; a dedicated test proves the not-wired refusal in both `broker-control.test.ts` and `vice-broker-client.test.ts`.
- **Committed in:** `3089d9ac` (Task 1 commit)

**2. [Rule 3 - Blocking] `defaultTransferFile()` does not import `broker-transfer.mts` directly**
- **Found during:** Task 3
- **Issue:** The plan's task 3 action text says the default implementation "drives broker-transfer.mts's send or receive half over the returned socket." `broker-transfer.mts` is `.mts`/host-bound and its own `import ... from "./transfer-hash.mjs"` specifier only resolves once built into `resources/`. MEASURED: `node --input-type=module -e 'import("./broker-transfer.mts")'`, run from `src/mcp/vice/` (unbuilt), throws `Cannot find module '.../transfer-hash.mjs'`. `stock-connect.ts` is a plain, never-built container-side `.ts` file (part of the shipped, buildless MCP server per CLAUDE.md), so importing `broker-transfer.mts` -- even just for its two exported functions -- would break this module at runtime the instant either function's own module-load path executed.
- **Fix:** Implemented the streaming shape directly in `stock-connect.ts`, importing only `transfer-hash.mts` (which carries no such relative import, only `node:crypto`/`node:stream`, and is therefore safe from either side of the host/container boundary). The implementation mirrors `broker-transfer.mts`'s own send/receive functions in structure (stat + digest pre-pass, streamed send/receive through the shared cap-and-digest `Transform`, atomic temp-write-then-`renameSync` publish on download) but does not write a second header line on the connection -- the `byteLength`/`sha256` this phase's payload needs are already carried by the `transfer` control op's own request/reply exchange, so a second header would duplicate rather than add framing.
- **Files modified:** `src/mcp/vice/stock-connect.ts`
- **Verification:** `npm run typecheck` clean; the injectable `transferFile` seam is proven never-called-when-overridden by this plan's own task 3 acceptance criteria (the default implementation itself has no dedicated end-to-end test in this plan -- see Known Stubs below).
- **Committed in:** `713beaf0` (Task 3 commit)

**3. [Rule 3 - Blocking] Six pre-existing test files needed a `stageFile` stub added to their hand-rolled `StockConnectBrokerControl` fixtures**
- **Found during:** Task 3, post-typecheck
- **Issue:** Adding `stageFile` as a required member of `StockConnectBrokerControl`/`BrokerControlSession` broke every hand-rolled fixture object in `broker-relay.test.ts`, `stock-connect.test.ts` (three sites), `stock-recycle.test.ts`, `text-connect.test.ts` and `text-tools.test.ts` that implements the interface without going through the real `vice-broker-client.ts` session factory.
- **Fix:** Added a one-line `stageFile` stub to each fixture, throwing (or refusing) since none of those suites exercises `stageFile` itself -- matching the existing convention each file already uses for `noteOperation` in the same fixtures.
- **Files modified:** `src/mcp/vice/broker-relay.test.ts`, `src/mcp/vice/stock-connect.test.ts`, `src/mcp/vice/stock-recycle.test.ts`, `src/mcp/vice/text-connect.test.ts`, `src/mcp/vice/text-tools.test.ts`
- **Verification:** `npm run typecheck` clean; full suite unchanged failing-test set (0 fail).
- **Committed in:** `713beaf0` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 -- blocking issues discovered during implementation and verification, none changing the plan's intended design).
**Impact on plan:** All three fixes were necessary for the plan's own stated deliverables (a clean typecheck, a working default implementation, a green full suite) to actually hold. No scope creep.

## Known Stubs

- **`defaultTransferFile()` (`stock-connect.ts`) has no dedicated end-to-end test in this plan.** It is exercised only indirectly (typecheck, and by the injectable-seam tests proving `deps.transferFile` is read/overridden correctly). Its own upload/download streaming logic is untested against a real `dialFileTransfer()` handshake in this plan, because no production caller exists yet -- `stock-machine.ts`'s four handlers are migrated onto this seam in plan 64-04, and `vice-broker.mts`'s own `onFileTransfer` implementation (which this default's request must ultimately round-trip against) is not wired until plan 64-03. A passing test here would be evidence the plumbing typechecks, not evidence a real transfer crossed a real broker. This is intentional and not a defect -- flagged here per this plan's Known Stubs contract so the verifier does not need to rediscover it, and so plan 64-04's own end-to-end test is understood as the first real exercise of this code path.

## Issues Encountered

- **Two test-file hangs during Task 2/Task 3 test authoring** (not a defect in the implementation, a defect in the FIRST draft of the tests): a `dialFileTransfer()` race test whose `onFileTransfer` stub never wrote a reply line (the callback owns every reply on success, per this plan's own design -- a bare `{ok:true}` silently waits out the reply timer), and three `stageFile()` tests that never called `session.release()`, leaving a live client socket that kept the test process alive past all tests completing. Both were root-caused via `--test-name-pattern` bisection and fixed before committing; no production code was affected.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 64-03 can now wire `onStageFile`/`onFileTransfer` into `vice-broker.mts`'s `startControlListenerOnHosts()` options object -- the callback signatures, the dispatch-arm gating (ownership vs. handle-only), and the optional-until-wired refusal path are all proven here.
- Plan 64-04 can migrate `stock-machine.ts`'s `vice_autostart`/`vice_disk_attach` handlers onto `session.brokerControl.stageFile` and `session.deps.transferFile` -- both seams exist, typecheck, and are injectable for handler tests that must run without a socket. The default `transferFile` implementation's own real-world behavior is unproven until then (see Known Stubs).
- `XFER-01`, `XFER-02` and `XFER-04` (all three declared by this plan) remain open in `REQUIREMENTS.md` pending sibling plans 64-03/64-04/64-06/64-07 -- the shared-ID gate (#2388) correctly withholds them until every declaring plan finishes.
- Full suite: 4355 tests, 4271 pass, 0 fail, 84 skipped -- an improvement over the pre-plan baseline (4332 tests, 4248 pass, 0 fail, 84 skipped), consistent with this plan's own added test coverage.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 13 modified files verified present on disk; all 3 task commits (3089d9ac, a0007524, 713beaf0) verified present in git log.
