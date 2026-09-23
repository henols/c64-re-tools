---
phase: 64-files-as-bytes-both-directions
plan: 03
subsystem: transport
tags: [staging, broker, tcp, file-transfer, session-lifecycle]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 01)
    provides: "broker-transfer.mts (header framing, sender/receiver, cap-and-digest Transform)"
  - phase: 64-files-as-bytes-both-directions (plan 02)
    provides: "broker-control.mts's stage_file/transfer dispatch arms and onStageFile/onFileTransfer (optional, until this plan wires them)"
provides:
  - "broker-transfer.mts: stageFileSlot()/resolveStagedFile()/markTransferInFlight()/clearTransferInFlight()/clearStagingForSession() -- the broker's own staging directory layout and handle minting"
  - "vice-broker.mts: handleStageFile()/handleFileTransfer() -- the real production callbacks wired into startControlListenerOnHosts(), plus clearStagingForSession() wired into handleRelease()"
  - "sendPayloadFromFile()'s new optional `kind` override, letting a download reply declare kind:\"transfer_payload\" instead of the default \"file\""
affects: [64-04, 64-05, 64-06, 64-07]

actuals:
  tokens: 21301
  tasks: 3
  commits: 3
  plan_head_before: bfc74646a191bc716649f107db51edc599918913

tech-stack:
  added: []
  patterns:
    - "Refuse-not-rewrite duplicated locally: refuseUnsafeSegment() in broker-transfer.mts is a small, deliberately duplicated copy of transfer-paths.ts's own ordered-checks shape, NOT an import of it -- transfer-paths.ts transitively imports repo-root.ts, and a host-bound module importing that would repeat the exact mistake broker-home.mts's own header warns against."
    - "Synchronous orchestrator, asynchronous byte movement: handleFileTransfer() mirrors handleRelayAttach()'s shape -- it returns a discriminated FileTransferOutcome synchronously (the wire contract broker-control.mts's dispatch arm requires), then drives the actual streaming send/receive asynchronously, unawaited, after returning."
    - "In-flight guard checked before the download-existence check: an in-flight upload's staged file legitimately does not exist yet either (receivePayloadToFile() only renames on completion), so ordering the checks in-flight-first gives a competing transfer the more specific, correct refusal reason."

key-files:
  created:
    - src/mcp/vice/vice-broker-staging.test.ts
  modified:
    - src/mcp/vice/broker-transfer.mts
    - src/mcp/vice/broker-transfer.test.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/broker-transfer.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/text-connect.test.ts

key-decisions:
  - "clearStagingForSession() is wired into handleRelease() only -- NOT into handleRecycleForRealBroker(). handleRelease() is the single function broker-control.mts's own onRelease callback invokes BOTH on an explicit release request AND on the control connection's own close event (including a client's SIGKILL), which is the literal 'session's connection closes' trigger XFER-07 and this plan's own must_haves name. A recycle keeps the SAME grant/session alive across the kill-and-relaunch (the control connection never closes), so clearing staging there would delete files out from under a session that has not, in fact, closed -- contradicting the plan's own must_haves wording even though the plan's prose loosely names \"release, recycle and relay-death\" together as reaching a shared teardown. Verified: a test asserts staging is gone after a simulated connection close (handleRelease's own close-triggered path), and no test or acceptance criterion in this plan asks for staging to survive or vanish across a recycle."
  - "sendPayloadFromFile() gained an optional `kind` parameter (default \"file\", unchanged for every pre-existing caller) rather than adding a second send function, so a download reply can declare kind:\"transfer_payload\" -- the literal dialFileTransfer() (broker-endpoint.ts, plan 64-02) checks for -- while reusing the exact same stat-then-digest-then-stream implementation broker-transfer.test.mts's own pre-existing tests already prove correct."
  - "The upload reply (\"transfer_ready\") is written as a plain JSON line in vice-broker.mts, never via writeTransferHeader() -- that function's TransferHeader type requires byteLength/sha256, fields this reply does not carry (the client already declared them on the transfer request itself)."

requirements-completed: [XFER-04]
# XFER-04 is declared by 64-02 (already complete) and this plan -- both
# declaring plans have now finished, so requirements.ready-ids marked it
# complete during this plan's own update_requirements step. XFER-07 is
# declared by this plan AND 64-05 (not yet executed) -- the shared-ID gate
# (#2388) correctly withholds it until 64-05 finishes.

coverage:
  - id: D1
    description: "The broker mints an unguessable handle, chooses the staging path itself, supersedes a slot on reuse (deleting the previous file), and can drop a whole session's staging in one recursive delete -- with no client-supplied text anywhere in the path"
    requirement: XFER-04
    verification:
      - kind: unit
        ref: "broker-transfer.test.mts#stageFileSlot: two calls with the same grant and slot return different handles; the first handle stops resolving and its file is gone"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#stageFileSlot: two calls with the same grant and DIFFERENT slots both resolve, and neither deletes the other's file"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#stageFileSlot: two calls with different grant ids land in different session directories"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#stageFileSlot: a slot \"../escape\"/\"a/b\"/\"a\\b\"/\"foo\\u0000bar\" is refused before any directory is created (4 parametrised cases)"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#clearStagingForSession: removes the session directory recursively and is a no-op on a second call"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#markTransferInFlight/clearTransferInFlight: a handle already in flight is refused; succeeds again after clearing"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#resolveStagedFile: refuses an unknown handle, never revealing a staging path"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real client can stage a slot, upload bytes into it and download them back over a real broker control listener, byte-for-byte, for a buffer spanning every value 0x00..0xFF"
    requirement: XFER-04
    verification:
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: a full upload-then-download round trip is byte-for-byte identical for a buffer spanning every value 0x00..0xFF"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every refusal path is answered correctly and safely: an unknown handle, a digest mismatch (leaving no published file), a download for a not-yet-uploaded handle (never a zero-byte payload), and a second transfer racing an in-flight handle (refused while the first completes)"
    verification:
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: a transfer presenting an unknown handle receives an error frame and no file appears anywhere under VICE_BROKER_HOME"
        status: pass
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: an upload whose declared digest disagrees with its bytes leaves no file at the staged path"
        status: pass
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: a download for a handle whose staged file does not exist yet is refused by name, never a zero-byte payload"
        status: pass
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: a second transfer on an in-flight handle is refused while the first completes successfully"
        status: pass
    human_judgment: false
  - id: D4
    description: "A session's entire staging directory is removed when its connection closes -- including a simulated SIGKILL (bare connection close, no explicit release request)"
    requirement: XFER-07
    verification:
      - kind: integration
        ref: "vice-broker-staging.test.ts#vice-broker-staging: after the session-close path runs for a grant, the session's staging directory no longer exists"
        status: pass
    human_judgment: false
  - id: D5
    description: "No code path deletes a staged file on an AUTOSTART/DUMP/UNDUMP reply -- a reply confirms acceptance, not completion (D-05); this plan adds no such handler and the diff was read to confirm clearStagingForSession()'s only two call sites are both inside handleRelease()"
    verification:
      - kind: manual_procedural
        ref: "git diff review of bc1997a8..eac6efb3 -- src/mcp/vice/broker-transfer.mts src/mcp/vice/vice-broker.mts, confirming clearStagingForSession()'s only callers are handleRelease()'s two branches"
        status: pass
    human_judgment: true
    rationale: "The plan's own <human-check> names this as 'the one rule in this plan that a test cannot prove absent, because it is the absence of a call rather than the presence of one' -- confirmed by direct diff inspection during this plan's own execution, but recorded here for the verifier to re-confirm rather than re-derive."
  - id: D6
    description: "The full pre-existing suite's failing-test set is unchanged, every regenerated build artifact is committed and tracked, and no untracked scratch directory was left anywhere in the repository"
    verification:
      - kind: integration
        ref: "npm test (full suite): 4371 tests, 4287 pass, 0 fail, 84 skipped -- failing set unchanged (empty) from the pre-plan baseline (4355/4271/0/84)"
        status: pass
      - kind: other
        ref: "resources-sync.test.ts"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 3: The Broker's Own Staging Model Summary

**The broker mints the handle and chooses the path for every staged upload/download -- superseding a slot on reuse, refusing a second transfer racing one handle, and dropping a whole session's staging in one delete when its connection closes -- wired into the real broker and proven end-to-end over a real control listener with a byte-for-byte 0x00..0xFF round trip.**

## Performance

- **Duration:** 50 min
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 7

## Accomplishments

- `broker-transfer.mts` gains the staging surface: `stageFileSlot()` mints a 16-byte-hex handle (the same rendering `handleMonitorClaim()` already uses for a per-claim monitor handle) and a broker-chosen path under `<brokerStagingDir()>/<grantId>/`, refusing an unsafe grant id or slot (NUL byte, empty, `.`/`..`, any path separator) BEFORE any directory is created. A repeat stage of the same `(grantId, slot)` supersedes the previous entry: the old handle stops resolving and its file is unlinked (D-05). `resolveStagedFile()`, `markTransferInFlight()`/`clearTransferInFlight()` (a synchronous check-and-set pair, T-64-16) and `clearStagingForSession()` (one recursive delete of one directory, D-06) round out the module.
- `vice-broker.mts` gains `handleStageFile()` (mirrors `handleMonitorClaim()`'s shape) and `handleFileTransfer()` (mirrors `handleRelayAttach()`'s shape: returns synchronously, streams asynchronously) -- both wired into `startControlListenerOnHosts()`'s options object in the SAME block as `onRelayAttach`/`onOperation`, never a second listener. An upload writes a plain `transfer_ready` JSON line then calls `receivePayloadToFile()`; a download calls `sendPayloadFromFile()` with the new `kind: "transfer_payload"` override so `dialFileTransfer()`'s own reply classifier recognises it. The in-flight guard is taken BEFORE the download-existence check, so a transfer racing an in-flight upload sees "already in flight" rather than a coincidental "does not exist yet".
- `clearStagingForSession()` is wired into `handleRelease()` -- the one function `broker-control.mts`'s own `onRelease` callback invokes both on an explicit `release` request and on the control connection's own close event, so a client killed with `SIGKILL` (no goodbye, only a socket close) still loses its staging.
- `vice-broker-staging.test.ts`: a real `startControlListener()` bound to port zero, real transfer connections, and real files under a fresh `mkdtempSync` `VICE_BROKER_HOME` -- proving a full upload-then-download round trip byte-for-byte for a buffer spanning every value 0x00..0xFF, plus every refusal path (unknown handle, digest mismatch, download-before-upload, in-flight race, session-close cleanup).
- `broker-transfer.test.mts` gains 12 new unit cases for the staging surface itself (supersession, distinct slots, distinct grants, four unsafe-slot fixtures, session clear, in-flight guard, unknown-handle refusal).

## Task Commits

Each task was committed atomically:

1. **Task 1: The staging directory, the minted handle, and slot supersession** - `bc1997a8` (feat)
2. **Task 2: Wire the two callbacks into the real broker and stream a payload against a live listener** - `baf541c5` (feat)
3. **Task 3: Wave gate — full suite, typecheck, and no leaked scratch** - `eac6efb3` (fix; see Deviations below)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/mcp/vice/broker-transfer.mts` - staging directory layout, handle minting, slot supersession, session-close cleanup; `sendPayloadFromFile()`'s new `kind` override
- `src/mcp/vice/broker-transfer.test.mts` - 12 new unit cases for the staging surface
- `src/mcp/vice/vice-broker.mts` - `handleStageFile()`, `handleFileTransfer()`, wired into `startControlListenerOnHosts()`; `clearStagingForSession()` wired into both branches of `handleRelease()`
- `src/mcp/vice/vice-broker-staging.test.ts` - real-listener, real-socket, real-file end-to-end coverage of the wired broker
- `src/mcp/vice/resources/broker-transfer.mjs` / `resources/vice-broker.mjs` - regenerated build artifacts
- `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts` - allow-listed the new test file in the `monitorClients` halting-path census guard (deviation, see below)

## Decisions Made

- **`clearStagingForSession()` is wired into `handleRelease()` only, not into `handleRecycleForRealBroker()`.** See `key-decisions` in the frontmatter for the full reasoning -- a recycle keeps the same grant/session alive (the control connection never closes), so deleting staging there would falsify XFER-07's own "when a session's connection closes" wording even though the plan's own prose loosely names "release, recycle and relay-death" together.
- **`sendPayloadFromFile()` gained an optional `kind` parameter** (default `"file"`, unchanged for every existing caller) rather than a second send function, so a download reply can declare `kind: "transfer_payload"`.
- **The upload reply (`"transfer_ready"`) is a plain JSON line**, never routed through `writeTransferHeader()` -- that function's type requires `byteLength`/`sha256`, which this reply does not carry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Allow-listed `vice-broker-staging.test.ts` in the `monitorClients` halting-path census guard**
- **Found during:** Task 3 (wave-gate full-suite run)
- **Issue:** `text-connect.test.ts` and `broker-control.test.ts` each carry a structural test enumerating every tracked file and refusing any NEW file (outside an explicit allow-list) that references the `monitorClients` identifier. `vice-broker-staging.test.ts`'s own `makeGrantedInstance()` fixture constructs a raw `InstanceRecord` literal with `monitorClients: {}` -- the same non-optional field every other allowed `*.test.ts` fixture in this codebase already satisfies -- tripping both copies of the guard.
- **Fix:** Added `"vice-broker-staging.test.ts"` to both allow-lists, with a comment matching the existing convention (each copy notes it is "kept in sync with" the other file's own copy).
- **Files modified:** `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts`
- **Verification:** Full suite re-run: 4371 tests, 4287 pass, 0 fail, 84 skipped.
- **Committed in:** `eac6efb3` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 -- a blocking issue discovered during full-suite verification, not changing this plan's intended design).
**Impact on plan:** Necessary for the plan's own stated deliverable (a green full suite) to actually hold. No scope creep.

## TDD Gate Compliance

Both `type="auto" tdd="true"` tasks in this plan were executed with their test and implementation code written and verified together rather than as a strict RED-then-GREEN commit pair (`workflow.tdd_mode` is `false` in this project's config, so the automated gate-enforcement machinery is not active; this records the discipline gap anyway, per the reference's own unconditional guidance).

| Plan | Task | RED | GREEN | REFACTOR | Status |
|------|------|-----|-------|----------|--------|
| 64-03 | 1 (staging directory/handle/supersession) | Not captured as a separate commit | Combined with implementation in `bc1997a8` | N/A | Deviation disclosed; all acceptance criteria verified passing before commit |
| 64-03 | 2 (real broker wiring) | Not captured as a separate commit | Combined with implementation in `baf541c5` | N/A | Deviation disclosed; all acceptance criteria verified passing before commit |

Both tasks' full test suites were run and verified GREEN (all new assertions passing against the real implementation) before each commit -- the gap is procedural (no separate `test(64-03): ...` commit preceding the `feat(64-03): ...` commit demonstrating an intentional RED), not a gap in actual test coverage or verification rigor. `gsd_run check tdd-red-evidence` was not run for either task.

## Issues Encountered

- **A genuine, non-deterministic race discovered and fixed in this plan's OWN test file** (not a production defect): `vice-broker-staging.test.ts`'s first draft asserted the staged file's bytes immediately after observing the upload socket's `"close"` event. Empirically (isolated in a standalone repro script outside the test framework, ~50% failure rate on a 256-byte payload), the client can observe the transfer socket close BEFORE the broker's own `receivePayloadToFile()` continuation (digest verify, then atomic rename) has actually run -- `pipeline()`'s own internal stream-teardown and the socket's TCP-level close delivery to the client are not ordered against `receivePayloadToFile()`'s post-pipeline JS continuation in a single-process, same-event-loop repro. Root-caused via targeted `stderr` tracing (temporarily instrumented then fully reverted) proving the file legitimately did not exist yet at the moment of the client-observed close in the failing runs. **Fixed by polling** (`waitFor(() => existsSync(path), 2000)`) rather than assuming completion from the close event -- which is also the more architecturally honest test, since D-05's own theme ("a reply confirms acceptance, not completion") applies identically here: an upload's own socket closing is not itself a completion confirmation. See "Next Phase Readiness" below -- this is a latent property of the wire protocol itself (established in 64-01/64-02), not unique to this test's harness, and plan 64-04's own client-side sequencing should be aware of it.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 64-04 (migrating `stock-machine.ts`'s handlers onto `session.brokerControl.stageFile()` and `session.deps.transferFile()`) can now exercise a REAL broker on the other end -- `stage_file`/`transfer` are fully wired, tested end-to-end, and the staging model's every refusal path (unknown handle, digest mismatch, missing file, in-flight race, session close) is proven.
- **A latent race worth 64-04's own attention, not fixed here (out of this plan's scope):** an upload's own client-side completion (`defaultTransferFile()`'s own promise resolving, or a raw socket observing `"close"`) does NOT guarantee the broker has finished verifying and atomically publishing the file to `emulator_filename` -- there is no `transfer_complete` confirmation frame on the wire for an upload (the client's own pipeline finishing merely means all bytes were handed to the kernel send buffer). In production this window is almost certainly dwarfed by the real network round-trip a SUBSEQUENT monitor command (e.g. `AUTOSTART` naming the same `emulator_filename`) requires, but it is not a guarantee, and this plan's own test file reproduced the race reliably in a tight, same-process loopback repro. If 64-04's own handler chains an upload directly into a monitor command with no intervening delay, this is worth a deliberate look -- either accept the residual risk explicitly (matching this milestone's own R-63-04 precedent for a similar accepted risk) or add a bounded settle/confirm step.
- `XFER-04` (declared by 64-02 and this plan, both now complete) was marked complete via this plan's own `requirements.ready-ids` step. `XFER-07` (declared by this plan and 64-05, not yet executed) correctly remains open under the shared-ID gate (#2388) until 64-05 finishes.
- Full suite: 4371 tests, 4287 pass, 0 fail, 84 skipped -- an improvement over the pre-plan baseline (4355/4271/0/84), consistent with this plan's own added coverage (16 new tests, 0 new failures).

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All key files (`src/mcp/vice/vice-broker-staging.test.ts` and this SUMMARY itself)
verified present on disk; all 3 task commits (`bc1997a8`, `baf541c5`, `eac6efb3`)
verified present in `git log`.
