---
phase: 64-files-as-bytes-both-directions
plan: 04
subsystem: transport
tags: [file-transfer, staging, snapshot, tcp, byte-round-trip]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 01)
    provides: "transfer-hash.mts (streaming cap+digest Transform), broker-transfer.mts (header framing, sender/receiver), transfer-paths.ts (snapshotPathFor/snapshotMetaPathFor, containment validator)"
  - phase: 64-files-as-bytes-both-directions (plan 02)
    provides: "broker-control.mts stage_file/transfer ops, broker-endpoint.ts dialFileTransfer(), vice-broker-client.ts stageFile(), stock-connect.ts StockConnectBrokerControl.stageFile/StockConnectDeps.transferFile"
  - phase: 64-files-as-bytes-both-directions (plan 03)
    provides: "broker-transfer.mts staging model (stageFileSlot/resolveStagedFile/clearStagingForSession), vice-broker.mts handleStageFile()/handleFileTransfer() wired into the real broker"
provides:
  - "stock-machine.ts: handleSnapshotSave and handleSnapshotLoad migrated off withEmulatorSidePath() onto session.brokerControl.stageFile()/session.deps.transferFile() -- both results carry the broker-minted handle in place of the broker-side sentPath (D-15)"
  - "tools-manifest.stock.json: vice_snapshot_save/vice_snapshot_load outputSchema updated to require handle instead of sentPath, matching the real answer shape"
  - "stock-machine.test.ts: a byte-for-byte round-trip test proving the pair over disjoint client/broker roots, driven through a REAL control listener and REAL staged files"
affects: [64-05, 64-06, 64-07]

actuals:
  tokens: 15246
  tasks: 3
  commits: 3
  plan_head_before: 09c0cd3b866d3573fdcd45a3ecbae51e8cb978f5

tech-stack:
  added: []
  patterns:
    - "Stage-then-send, send-then-download: handleSnapshotSave stages a slot, sends DUMP with the broker-chosen filename, THEN downloads -- because the emulator must have finished writing before a download can read it. handleSnapshotLoad reverses the order (resolve-local, stage, upload, THEN send UNDUMP) for the same reason read the other way."
    - "sentPath -> handle is a same-shape, different-value field rename (D-15), applied consistently across the handler code, its tests, and the manifest's outputSchema in the same plan -- a manifest left stale after a result-shape change is a real conformance regression, not a cosmetic drift."

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-machine.ts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/text-connect.test.ts

key-decisions:
  - "The upload-completion race 64-03-SUMMARY.md raised by name is an ACCEPTED RISK, not a protocol change. handleSnapshotLoad's own doc comment records why: there is no transfer_complete confirmation frame on the wire for an upload (vice-broker.mts's handleFileTransfer() never writes one after receivePayloadToFile() settles), so transferFile()'s promise resolving does not guarantee the broker has finished verifying and publishing the bytes before the very next line's UNDUMP names the same file. Fixing this at the protocol level touches broker-control.mts's wire vocabulary, vice-broker.mts, broker-endpoint.ts and this module's own seam -- an architectural change outside this plan's declared scope (stock-machine.ts/stock-machine.test.ts only). The window is expected to be dwarfed in production by the real network round-trip the subsequent UNDUMP itself requires. This plan's own round-trip test reproduces the race reliably on a same-process loopback and resolves it by polling (bounded) for the staged bytes to appear rather than assuming zero latency -- proving the race is real and the bytes still arrive intact, matching this milestone's own R-63-04 precedent for a similarly accepted, explicitly-reasoned risk."
  - "defaultTransferFile() (stock-connect.ts) still does NOT import broker-transfer.mts, and the duplication is confirmed unavoidable, not merely unexamined. Re-measured (this plan is the first to put a real production caller -- handleSnapshotSave/handleSnapshotLoad -- on the seam defaultTransferFile() defaults): `node --input-type=module -e 'import(\"./broker-transfer.mts\")'` from an unbuilt src/mcp/vice/ now fails on `Cannot find module '.../broker-home.mjs'` (64-02 measured it failing on transfer-hash.mjs; 64-03 added more host-bound imports to broker-transfer.mts, so the specific missing module changed but the underlying cause -- a host-bound .mts module whose own relative imports only resolve once built into resources/ -- is identical). stock-connect.ts remains a plain, never-built, container-side .ts file per CLAUDE.md, so a single owning module reachable from both sides is still not available without either building stock-connect.ts too (out of scope) or extracting a build-free shared module that does not exist today. The two copies of the wire shape are recorded as an accepted, re-confirmed cost rather than left unexamined a second plan running."
  - "Task 1 and Task 2 are recorded as one combined commit rather than two." # see Deviations

requirements-completed: []
# XFER-01, XFER-02, XFER-05 and XFER-08 are ALL declared by this plan's
# frontmatter but NONE are marked complete here -- every one has at least
# one sibling plan still open (XFER-01: 64-07; XFER-02: 64-06; XFER-05:
# 64-07; XFER-08: 64-06 and 64-07), so the shared-ID gate (#2388) correctly
# withholds all four until their last declaring plan finishes.

coverage:
  - id: D1
    description: "handleSnapshotSave stages a slot, sends DUMP with the broker-chosen emulator filename in the request body, downloads the staged bytes into the client's own snapshots directory only after DUMP succeeds, and the result carries the local path and the broker-minted handle -- never a broker-side path"
    requirement: XFER-01
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotSave: records a Dump body whose filename equals the staging reply's emulator filename, and the result carries that handle -- never the staged path"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotSave: a refused staging request produces an error result and zero sends"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotSave: a failed download produces an error result, leaves no file at the snapshot path, an empty snapshots directory, and no sidecar"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotSave: a failing DUMP writes no sidecar and dials no transfer connection"
        status: pass
    human_judgment: false
  - id: D2
    description: "handleSnapshotLoad resolves and checks the local .vsf FIRST (unchanged missing-file refusal listing available basenames), then stages a slot, uploads the local file's bytes, and only then sends UNDUMP with the broker-chosen filename -- the result carries the handle, programCounter and sidecar metadata, never a broker-side path"
    requirement: XFER-02
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotLoad: a missing file refuses with a message listing the .vsf names present, records zero sends and never stages or transfers"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotLoad: a successful load records an Undump body whose filename equals the staging reply's emulator filename, uploads the local file, and reports programCounter -- never the staged path in the result"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotLoad: a refused staging request produces an error result and sends no UNDUMP"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleSnapshotLoad: a refused upload produces an error result and sends no UNDUMP"
        status: pass
    human_judgment: false
  - id: D3
    description: "The result's broker-side field is the opaque handle, never sentPath (D-15) -- a test enumerates every key of the result object and asserts no value equals or contains the staged path or staging directory, for both handlers"
    requirement: XFER-08
    verification:
      - kind: unit
        ref: "stock-machine.test.ts's assertNoStagedPathLeak() helper, applied in both handleSnapshotSave's and handleSnapshotLoad's own success-case tests"
        status: pass
      - kind: other
        ref: "tools-manifest.stock.json's vice_snapshot_save/vice_snapshot_load outputSchema requires handle, not sentPath -- checked by stock-dispatch.test.ts's conformance harness against the real dispatchStock() answer"
        status: pass
    human_judgment: false
  - id: D4
    description: "A save followed by a load moves a 76800-byte buffer spanning every value 0x00..0xFF from the emulator-side staged file to the client's snapshots directory and back again, byte-identical, across two disjoint client/broker roots that cannot see each other, and the broker's staging directory is gone once the session's connection closes"
    requirement: XFER-05
    verification:
      - kind: integration
        ref: "stock-machine.test.ts#vice_snapshot_save/vice_snapshot_load round trip: the same bytes make the whole journey across two roots that cannot see each other, and the staging directory is gone when the session is"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full pre-existing suite's failing-test set is unchanged (0 fail), the conformance harness for both migrated tools passes, typecheck is clean, and no untracked scratch directory was left"
    verification:
      - kind: integration
        ref: "npm test (full suite): 4376 tests, 4292 pass, 0 fail, 84 skipped -- improvement over the 64-03 baseline (4371/4287/0/84), consistent with this plan's own added coverage"
        status: pass
      - kind: other
        ref: "npm run typecheck: clean"
        status: pass
      - kind: other
        ref: "git status --porcelain after this plan's commits: no untracked fixture/scratch directory"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 4: Files as Bytes, Both Directions -- Snapshot Pair Migration Summary

**`vice_snapshot_save`/`vice_snapshot_load` migrated off the shared-filesystem path onto the broker's own file-transfer protocol -- both results carry a broker-minted handle in place of `sentPath` (D-15), and the pair round-trips a 76800-byte, full-byte-range payload byte for byte across two disjoint client/broker roots.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-23T11:51:00Z (approximate -- see Issues Encountered)
- **Completed:** 2026-09-23T12:46:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `handleSnapshotSave` stages a broker slot first (a refusal sends no DUMP at all), sends DUMP with the broker-CHOSEN emulator filename relayed verbatim into the request body, and only after DUMP succeeds downloads the staged bytes into the client's own snapshots directory via `session.deps.transferFile` -- the metadata sidecar is written only after that download succeeds, keeping its existing report-never-throw posture for a sidecar write failure.
- `handleSnapshotLoad` reverses the order for the same reason read the other way: resolve the local `.vsf` and perform the existing missing-file refusal FIRST (before any staging request or transfer connection), then stage a slot, upload the local file's bytes, and only then send UNDUMP with the broker-chosen filename.
- Both handlers' results replace the broker-side `sentPath` field with the broker-minted `handle` (D-15) -- a test enumerates every key of each successful result and asserts none of them equals or contains the staged path or staging directory. The module header's WHAT NOT TO DO list is rewritten to state what is now true (never build a broker-side path in these two handlers; never fall back to `withEmulatorSidePath()` when a stage or transfer call fails) rather than the now-false claim that every filename in this file routes through one translation wrapper.
- `handleSnapshotLoad`'s own doc comment records, by name and in detail, the accepted upload-completion race this plan's own round-trip test reproduced reliably on a same-process loopback -- see Decisions below.
- `stock-machine.test.ts` gains recording `stageFile`/`transferFile` stubs (`makeSnapshotSession()`) and a case for every row of both handlers' behavior blocks, plus a round-trip test driving a REAL control listener and REAL staged files (mirroring `vice-broker-staging.test.ts`'s own fixture) that proves a 76800-byte payload spanning every value 0x00..0xFF survives the whole journey -- client file to staged file to client file -- across two `mkdtempSync` roots that cannot see each other, and that the broker's staging directory for the grant is gone once its connection closes.
- Two deviations surfaced and were fixed during full-suite verification (see below): `stock-dispatch.test.ts`'s conformance harness needed a `stageFile`/`transferFile` stub, and `tools-manifest.stock.json`'s `outputSchema` for both tools still required the now-removed `sentPath` field.

## Task Commits

Each task was committed atomically (Task 1 and Task 2 are recorded as one combined commit; see Deviations):

1. **Tasks 1+2: handleSnapshotSave/handleSnapshotLoad migrated onto the file-transfer protocol** - `41b646f3` (feat)
2. **Deviation fix: conformance stub and manifest schema for the handle field** - `20993b6f` (fix)
3. **Task 3: the pair proves each other -- a byte-for-byte round trip over disjoint roots** - `4a79f173` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/mcp/vice/stock-machine.ts` - `handleSnapshotSave`/`handleSnapshotLoad` migrated off `withEmulatorSidePath()` onto `session.brokerControl.stageFile()`/`session.deps.transferFile()`; module header rewritten; import of `snapshotPathFor`/`snapshotMetaPathFor` moves to `transfer-paths.ts`
- `src/mcp/vice/stock-machine.test.ts` - recording `stageFile`/`transferFile` stubs, cases for every behavior-block row of both handlers, and the byte-for-byte round-trip test over disjoint roots
- `src/mcp/vice/stock-dispatch.test.ts` - `CONFORMANCE_BROKER_CONTROL` gains a `stageFile` stub; `buildConformanceSession()`'s `deps` gains a `transferFile` stub (deviation, see below)
- `src/mcp/vice/tools-manifest.stock.json` - `vice_snapshot_save`/`vice_snapshot_load`'s `outputSchema` now requires `handle`, not `sentPath` (deviation, see below)
- `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts` - allow-list `stock-machine.test.ts` in the `monitorClients` halting-path census guard, since its round-trip fixture constructs the same raw `InstanceRecord` literal every other allowed `*.test.ts` file already does

## Decisions Made

- **The upload-completion race is an accepted risk, decided deliberately, not left unexamined.** See `key-decisions` in the frontmatter for the full reasoning. `handleSnapshotLoad`'s own doc comment carries the same explanation in the shipped code, and this plan's own round-trip test resolves the race with a bounded poll rather than assuming zero latency -- proving the race is real (the DI-stub UNDUMP responder polls for the staged bytes to appear) and that the bytes still arrive intact.
- **`defaultTransferFile()`'s duplication of `broker-transfer.mts`'s wire shape is re-confirmed unavoidable, not merely unexamined a second time.** This plan is the first to put a real production caller on the seam `defaultTransferFile()` defaults. Re-measured: importing `broker-transfer.mts` unbuilt now fails on a *different* missing module (`broker-home.mjs`, not `transfer-hash.mjs`) because 64-03 added more host-bound imports to `broker-transfer.mts` -- but the underlying cause is identical (a host-bound `.mts` module whose own relative imports resolve only once built into `resources/`), and `stock-connect.ts` is still never built. No single owning module is reachable from both sides without an out-of-scope build-step change.
- **Tasks 1 and 2 are recorded as one combined commit rather than two.** See Deviations below for the reasoning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `stock-dispatch.test.ts`'s conformance harness lacked a `stageFile`/`transferFile` stub**
- **Found during:** full-suite verification, after committing both handlers' migration
- **Issue:** `CONFORMANCE_BROKER_CONTROL` (used by `vice_snapshot_save`/`vice_snapshot_load`'s conformance cases) only stubbed `claimMonitor`/`releaseMonitor`/`noteOperation`/`recycle`; `buildConformanceSession()`'s `deps` was `{}`. Neither handler previously called `stageFile`/`transferFile`, so this file was never touched by plans 64-01/64-02/64-03's own six-file stub-addition sweep. The instant this plan's handlers started calling them, both conformance cases threw `"session.brokerControl.stageFile is not a function"`.
- **Fix:** Added a `stageFile` stub to `CONFORMANCE_BROKER_CONTROL` and a `transferFile` stub to `buildConformanceSession()`'s `deps`, both always-succeed, matching the file's own existing stub convention.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` 123/123 pass.
- **Committed in:** `20993b6f` (deviation fix commit)

**2. [Rule 1 - Bug] `tools-manifest.stock.json` still declared `sentPath` as a required output field for both migrated tools**
- **Found during:** the same full-suite verification pass
- **Issue:** D-15 replaces `sentPath` with `handle` in both handlers' real answers; the manifest's `outputSchema` was not updated in the same change, so the conformance harness's own schema check failed with `"$.sentPath: required property missing"` even after fixing deviation 1.
- **Fix:** Replaced the `sentPath` property (and its `required` entry) with `handle` in both `vice_snapshot_save`'s and `vice_snapshot_load`'s `outputSchema`. `vice_autostart`'s and `vice_disk_attach`'s own `sentPath` entries are UNCHANGED -- those two handlers are not migrated by this plan (plan 64-06's job).
- **Files modified:** `src/mcp/vice/tools-manifest.stock.json`
- **Verification:** `node --test stock-dispatch.test.ts` 123/123 pass; full suite 4376/4292/0 fail/84 skipped.
- **Committed in:** `20993b6f` (deviation fix commit)

### Procedural Deviation (not a Rule 1-4 fix)

**3. Tasks 1 and 2 are recorded as one combined commit (`41b646f3`) rather than two separate commits.**
- **Why:** Both handlers' complete migration (implementation and tests) was already present in this working tree, uncommitted, when this executor session began -- see Issues Encountered. Both handlers share the same file header, the same import statement, and mirror each other's structure exactly (save stages-then-sends-then-downloads; load resolves-then-stages-then-uploads-then-sends), so reconstructing a genuine, independently-verified "Task 1 only, Task 2 not yet done" intermediate state would have required either (a) temporarily reverting half of an already-correct, already-tested handler and re-applying it a commit later, which risks introducing an artificial and never-actually-run intermediate state, or (b) leaving the module header's forward-looking prose in a state that describes the still-unmigrated handler as migrated. Both options add risk without adding real traceability, since the two handlers were authored and tested together. Task 3 (the round-trip test, purely additive at the end of the test file) WAS cleanly separable and is its own commit.
- **Verified before combining:** the combined commit's own file state was independently re-run (`node --test stock-machine.test.ts stock-paths.test.ts transfer-paths.test.ts` = 69/69 pass; `npm run typecheck` clean) against a genuinely reconstructed intermediate test-file truncation (everything before the round-trip test section) before either commit was made, so the combined commit's own claim of a passing state is verified, not assumed.

---

**Total deviations:** 2 auto-fixed (both Rule 1 -- bugs surfaced by this plan's own migration, neither changing the plan's intended design), plus 1 disclosed procedural deviation (commit granularity).
**Impact on plan:** Both fixes were necessary for the plan's own stated deliverable (a green full suite, a conforming manifest) to actually hold. No scope creep -- `vice_autostart`/`vice_disk_attach`'s own `sentPath` fields are untouched, exactly as this plan's scope requires.

## Issues Encountered

- **This plan's own implementation and tests were already fully present in the working tree, uncommitted, when this executor session began.** `git log` showed no commit had ever touched `stock-machine.ts` since Phase 16 (the file's relocation), yet the working tree already contained the complete, correct migration for both handlers plus the round-trip test -- including the exact `sentPath` -> `handle` rename, the exact stage-then-send-then-download/resolve-then-stage-then-upload-then-send orderings, and (notably) `handleSnapshotLoad`'s own doc comment already recording the upload-completion-race decision this plan's `<prior_wave_context>` explicitly asked this executor to make. This executor verified the code directly against every acceptance criterion in the plan (rather than assuming it was correct because it looked complete), found it correct and passing, then committed it task-by-task per the plan's own structure -- fixing two real regressions (see Deviations) that the pre-existing uncommitted state had not yet been checked against a full-suite run. Because of this, "Started" above is an approximation of when this executor's own verification work began, not when the code was originally written.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 64-06 (migrating `handleAutostart`/`handleDiskAttach` off `withEmulatorSidePath()`) can now follow the exact same stage-then-send pattern this plan proved for `handleSnapshotSave`, and will need the same manifest-schema discipline this plan's own deviation 2 surfaced: update `tools-manifest.stock.json`'s `outputSchema` for both remaining tools in the SAME change that renames their result field, not as an afterthought.
- Plan 64-07 (the convergence-metric close-out and `XFER-01`/`XFER-05`/`XFER-08`'s remaining declaring plan) can rely on this plan's own round-trip test as the proof pattern for "no shared filesystem" (D-17) -- disjoint `mkdtempSync` roots, a real control listener, and an assertion that no B-side path appears in any tool result.
- `XFER-01`, `XFER-02`, `XFER-05` and `XFER-08` (all four declared by this plan) remain open in `REQUIREMENTS.md` pending sibling plans 64-06/64-07 -- the shared-ID gate (#2388) correctly withholds all four until every declaring plan finishes.
- `defaultTransferFile()` (`stock-connect.ts`) still has no dedicated end-to-end test of its own -- flagged again here and in `.planning/WINDOWS.md` (id recorded via `windows append`, kind `stub`) so a future plan does not need to rediscover it. The round-trip test proves the SHAPE of the seam via its own composed helper, not the production default implementation itself.
- Full suite: 4376 tests, 4292 pass, 0 fail, 84 skipped -- an improvement over the 64-03 baseline (4371/4287/0/84), consistent with this plan's own added coverage (5 net new tests, 0 new failures).

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 6 modified files verified present on disk; all 3 commits (`41b646f3`, `20993b6f`, `4a79f173`) verified present in `git log`.
