---
phase: 64-files-as-bytes-both-directions
plan: 15
subsystem: broker
tags: [transfer, upload, path-disclosure, cr-01, g-64-5, tdd]

# Dependency graph
requires:
  - phase: 64 (plan 64-13)
    provides: receivePayloadToFile()'s beforePublish timing hook and the TransferResult code/wireReason classification, and writeUploadCompletionReply() -- the surface this plan closes a leak on
provides:
  - "formatPathFreeFault(summary, fault) (broker-transfer.mts) -- the one builder of wire text for a caught transfer fault: a fixed phrase plus at most a validated errno token, never Error.message"
  - "ReceivePayloadToFileResult (broker-transfer.mts) -- a stricter narrowing of TransferResult that makes code/wireReason mandatory on receivePayloadToFile()'s own failure branch"
  - "writeUploadCompletionReply() (vice-broker.mts) typed on ReceivePayloadToFileResult, with no fallback from wireReason to the full reason"
  - "the receive-pipeline catch classified by the transform's own OBSERVED byte count (bad_request naming the cap) vs. any other fault (internal via formatPathFreeFault())"
affects: [65]

# Actuals (#2632)
actuals:
  tokens: 15609
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "formatPathFreeFault(): the ONE builder of wire text for a caught transfer fault -- summary + optional ' (CODE)' (a validated errno token) + a fixed log hint. Never reads fault.message, never calls String(fault), never throws."
    - "ReceivePayloadToFileResult narrows TransferResult via Extract<> + an intersection so a receive failure MUST carry both code and wireReason -- npm run typecheck refuses an omission rather than the reply writer silently falling back to the full, path-bearing reason."
    - "Receive-side cap classification by OBSERVED byte count (transform.result().byteLength > capBytes), never by the caught error's class or text -- the same pipeline() rejection covers both the receiver's own cap enforcement and an unrelated stream fault, and only the observed count tells them apart."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-transfer.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-transfer.test.mts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/vice-broker-staging.test.ts
    - src/mcp/vice/resources/broker-transfer.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "formatPathFreeFault() carries an errno token (unlike its sibling broker-relay.mts's buildEmulatorUnreachableMessage(), which deliberately carries none) because upload-failure text never passes through stock-handler.ts's convertHandshakeError(), the ECONNREFUSED/EHOSTUNREACH/ENETUNREACH matcher that would otherwise misapply container-bind advice to a filesystem errno."
  - "ReceivePayloadToFileResult is declared with Extract<> plus an intersection, not a fresh object literal, so TransferResult's own shape (and broker-endpoint.ts's existing comment pointers at it) stays valid -- this type adds a constraint, it does not redefine the success branch."
  - "The receive-pipeline's cap refusal is classified by the transform's own observed count read AFTER the pipeline rejects, not by matching the caught error's message -- keeps the classification independent of the exact wording transfer-hash.mts's own Transform happens to throw."
  - "No injectable filesystem-root seam was added (D-17): every real-fault test places its fault either through its own beforePublish closure (a pure timing hook, no path in, nothing out) or through the destPath/fixture paths it already controls."

patterns-established:
  - "Path-free wire text, filter-not-scrub: never build client-facing text by scrubbing path-like substrings out of a caught error's message -- build it from a fixed phrase plus a value already known to be safe (a validated errno token, or numbers the receiver itself computed)."

requirements-completed: [XFER-06, XFER-08]

coverage:
  - id: D1
    description: "All three of receivePayloadToFile()'s caught-fault branches (receive-pipeline, pre-publish hook, publish-rename) answer a REAL filesystem fault with path-free wireReason -- a fixed phrase plus at most (CODE) -- while reason keeps the full text including destPath for the broker's own stderr line"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "broker-transfer.test.mts#receivePayloadToFile real fs fault, publish rename: a rename whose directory vanished answers path-free wire text and keeps the full reason"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#receivePayloadToFile real fs fault, receive pipeline: a temp file that cannot be opened answers path-free wire text"
        status: pass
      - kind: unit
        ref: "broker-transfer.test.mts#receivePayloadToFile real fs fault, pre-publish hook: a hook failing on a real fs error answers path-free wire text"
        status: pass
      - kind: unit
        ref: "vice-broker-staging.test.ts#vice-broker-staging: real fs fault at the publish rename ... answers an error line with the errno code and no path under VICE_BROKER_HOME"
        status: pass
      - kind: unit
        ref: "vice-broker-staging.test.ts#vice-broker-staging: real fs fault in the pre-publish hook ... answers an error line with the errno code and no path under VICE_BROKER_HOME"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#vice_snapshot_load refusal on a real fs fault (CR-01, G-64-5): the staging directory vanishes before the rename, and neither the upload's wire reason nor the tool result names a broker-side path"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#vice_snapshot_load refusal (G-64-3, plan 64-13): a publish that fails before the rename refuses the load, sends no UNDUMP, and the result text names no path under the broker's own root"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatPathFreeFault() is a pure filter: a fault with no code, a non-string code, a code that could carry text or a path, an over-long code, a thrown non-Error value, or an object whose code getter throws contributes nothing beyond the fixed phrase, and the function never throws"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "broker-transfer.test.mts#formatPathFreeFault: path-free fault text carries only a validated errno token"
        status: pass
    human_judgment: false
  - id: D3
    description: "A receive refused mid-stream because the observed byte count passed the cap answers bad_request with wire text naming the cap, built from capBytes and the observed count and never from the caught error's message; a payload of exactly the cap is still accepted and published"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "broker-transfer.test.mts#receivePayloadToFile: cap names the limit on the wire, built from numbers and never from the caught error"
        status: pass
    human_judgment: false
  - id: D4
    description: "The completion reply can no longer fall back to the full reason: ReceivePayloadToFileResult requires code and wireReason on failure, and writeUploadCompletionReply() writes exactly those two fields -- npm run typecheck refuses a future omission"
    requirement: "XFER-06"
    verification:
      - kind: unit
        ref: "grep gate: 'wireReason ??' count is 0 in vice-broker.mts"
        status: pass
      - kind: other
        ref: "npm run typecheck (tsc --noEmit -p tsconfig.json), exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The transfer protocol's other client-facing failure texts, in both directions, are re-confirmed to carry no caught-error text and no broker-side path (the sweep, below), and the full-glob suite is green with no broker running"
    requirement: "XFER-08"
    verification:
      - kind: other
        ref: "npm run test:automated (4274 tests, 4265 pass, 0 fail, 9 skipped, exit 0); npm test (4449 tests, 4365 pass, 0 fail, 84 skipped, exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 74min
completed: 2026-09-24
status: complete
---

# Phase 64 Plan 15: CR-01's Path Leak Closed at the Source Summary

**`formatPathFreeFault()` becomes the one builder of wire text for a caught transfer fault -- a fixed phrase plus at most a validated errno token -- closing the three real-fault leaks CR-01 found and a fourth latent fallback, proven against real `renameSync`/`createWriteStream`/hook filesystem failures rather than the synthetic, already-path-free rejection the prior suite could not catch.**

## Performance

- **Duration:** 74 min
- **Started:** 2026-09-24T11:14:00Z
- **Completed:** 2026-09-24T12:28:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 source, 3 test, 2 rebuilt resources)

## Accomplishments
- `formatPathFreeFault(summary, fault)` (`broker-transfer.mts`) is now the ONE place wire text for a caught transfer fault is built: `summary` + an optional ` (CODE)` when `fault.code` is a string matching `WIRE_SAFE_ERROR_CODE_RE` (uppercase-letter-first, 2-64 chars of `[A-Z0-9_]`) + a fixed log hint. It never reads `fault.message`, never calls `String(fault)`, and never throws -- proven against a real `statSync` ENOENT and ten hostile non-code shapes (a numeric code, a path-shaped code, an embedded-space code, a lowercase code, an 80-character code, a thrown string, `null`, `undefined`, a throwing `code` getter).
- `ReceivePayloadToFileResult` narrows `TransferResult` (via `Extract<>` plus an intersection, so `TransferResult`'s own shape and existing comment pointers stay valid) so `receivePayloadToFile()`'s own failure branch MUST carry both `code` and `wireReason` -- `writeUploadCompletionReply()` (`vice-broker.mts`) is retyped on it and its nullish fallback to the full `reason` is removed. A future caught-fault branch that omits path-free wire text now fails `npm run typecheck` instead of leaking.
- All three of `receivePayloadToFile()`'s caught-fault branches -- the publish-rename catch (Task 1), the receive-pipeline catch and the pre-publish hook catch (Task 2) -- now build `wireReason` through `formatPathFreeFault()`, each proven against a REAL fault: a session directory removed between the digest verdict and the rename (ENOENT), a temp filename that exceeds `NAME_MAX` (ENAMETOOLONG), and a hook that itself hits a real missing file (ENOENT). `reason` keeps the full text, `destPath` included, for the broker's own stderr line only.
- The receive-pipeline's own cap refusal is now classified by the transform's OWN observed byte count (`transform.result().byteLength > capBytes`), never by the caught error's class or text -- the same `pipeline()` rejection previously covered both a genuine cap overflow and an unrelated stream fault, and only the observed count tells them apart. A cap refusal now answers `bad_request` naming the cap and the observed count (never a caught error's message); a payload of exactly the cap is still accepted and published.
- The raw `error` line on the transfer connection is pinned, for two independent real publish-side faults driven through the compiled `handleFileTransfer()` behind a real control listener, to exactly the keys `code`/`kind`/`message`, `code: "internal"`, and a `message` naming the errno code with no path under `VICE_BROKER_HOME`.
- The plan's own Sweep record table (16 rows) was re-confirmed by function name against the current tree: rows 2, 4 and 5 (the three caught-fault branches) and row 6 (the reply writer's fallback) are the only sites of the class, and all four are now fixed; every other row is unchanged and clean. See "Re-confirmed sweep" below.

## Task Commits

Each task followed the RED-GREEN cycle (TDD):

1. **Task 1: Tracer -- a real rename failure reaches the tool result with the errno code and no broker-side path**
   - `45b6822a` (test): RED -- `broker-transfer.test.mts` gained a real-rename-fault unit test and the `formatPathFreeFault` filter test; `stock-machine.test.ts` gained a real-fault variant of the round-trip refusal test. Both verified failing (`RED_EVIDENCE_OK` via `gsd_run check tdd-red-evidence`), with no source edit:
     - `broker-transfer.test.mts`: 28 tests, 26 pass, 2 fail (the two new tests) -- the rename test failed on `assert.match(wireReason, /\(ENOENT\)/)` because today's `wireReason` is the raw `Error.message` (`"vice: failed to publish the received file: ENOENT: no such file or directory, rename '<tmp>' -> '<dest>'"`, both fixture paths present); the filter test failed with `formatPathFreeFault is not a function`.
     - `stock-machine.test.ts`: 40 tests, 39 pass, 1 fail -- failed on `assert.ok(!resultText.includes(brokerHome), ...)` with the recorded actual text: `"vice_snapshot_load: uploading the snapshot failed (vice: failed to publish the received file: ENOENT: no such file or directory, rename '/tmp/vice-snapshot-realfault-broker-.../staging/req-64-15-t1-realfault/<handle>.tmp-...' -> '/tmp/.../staging/req-64-15-t1-realfault/<handle>')"`.
     - A test-authoring bug was found and fixed WHILE confirming GREEN, before this RED evidence was superseded: `formatPathFreeFault`'s filter test originally built an assertion message via `JSON.stringify(fault)` inside a loop whose last fixture is a throwing `code` getter -- the template literal evaluated eagerly on every iteration (pass or fail), so `JSON.stringify()` triggered the throw regardless of the assertion's own outcome. Fixed by indexing the fixture instead of stringifying it in the message.
   - `8bb0ea5e` (feat): GREEN -- `formatPathFreeFault()`, `ReceivePayloadToFileResult`, `WIRE_SAFE_ERROR_CODE_RE`, `PATH_FREE_FAULT_LOG_HINT` added to `broker-transfer.mts`; the publish-rename catch now calls `formatPathFreeFault()`; `writeUploadCompletionReply()` (`vice-broker.mts`) retyped on `ReceivePayloadToFileResult` with its nullish fallback removed. `resources/broker-transfer.mjs` and `resources/vice-broker.mjs` rebuilt.
   - Tracer feedback gate: `workflow.human_verify_mode` is `end-of-phase` (default), `_auto_chain_active`/`auto_advance` both `false`, and Task 1's own `<verify>` carries only `<automated>` entries -- re-ran the tracer's own `<verify>` end-to-end (build, typecheck, the six-file test run: 124/124 pass) per the row-3 precedence rule; passed, so execution continued straight to Task 2 with no synthesized checkpoint (`⚡ Tracer verified end-to-end -- expanding`).
2. **Task 2: The receive-pipeline and pre-publish branches go path-free, the cap refusal keeps naming the limit, and the raw wire line is pinned**
   - `d1da4790` (test): RED -- three new `broker-transfer.test.mts` tests (pipeline ENAMETOOLONG, hook ENOENT, cap boundary pair), two new `vice-broker-staging.test.ts` tests (real-fault rename and hook, driven through a widened `startStagingListenerForState()` that now takes an optional `getDeps()`), and `stock-machine.test.ts`'s existing refusal test converted from a synthetic rejection to a real `readFileSync` ENOENT. Verified failing (`RED_EVIDENCE_OK` x5, all against Task 1's already-fixed tree, with no Task 2 source edit):
     - `broker-transfer.test.mts`: 31 tests, 28 pass, 3 fail -- the pipeline test failed on the `(ENAMETOOLONG)` regex against the raw message; the hook test failed on the `(ENOENT)` regex against the raw message; the cap test failed with `code: 'internal'` where `'bad_request'` was expected (today's pipeline catch has no cap-vs-fault classification at all).
     - `vice-broker-staging.test.ts` + `stock-machine.test.ts` (run together): 49 tests, 47 pass, 2 fail -- the converted `stock-machine.test.ts` refusal test failed on the path-exclusion assertion with the actual text `"...ENOENT: no such file or directory, open '/tmp/.../staging/req-64-13-t2-refusal/no-such-file'"`; the new `vice-broker-staging.test.ts` HOOK test failed on the `(ENOENT)` regex with the same shape. The new RENAME test in the same file PASSED at first run (47/49, not one of the 2 failures) -- exactly as expected, since Task 1 already fixed the rename branch.
   - `9874cbf0` (feat): GREEN -- the receive-pipeline catch now reads `transform.result().byteLength` and returns `bad_request` (wire text built only from `capBytes` and the observed count) when it exceeds `capBytes`, else `internal` via `formatPathFreeFault()`; the pre-publish hook catch now also calls `formatPathFreeFault()`. `resources/broker-transfer.mjs` rebuilt (`vice-broker.mts` untouched this task, so `resources/vice-broker.mjs` did not change).

**Plan metadata:** (this commit)

_TDD tasks each carry two commits (test -> feat); neither needed a REFACTOR commit -- both implementations were already minimal after GREEN._

## Files Created/Modified
- `src/mcp/vice/broker-transfer.mts` - `formatPathFreeFault()`, `ReceivePayloadToFileResult`, `WIRE_SAFE_ERROR_CODE_RE`, `PATH_FREE_FAULT_LOG_HINT`; all three caught-fault branches of `receivePayloadToFile()` rewritten; the receive-pipeline catch gains observed-count cap classification
- `src/mcp/vice/vice-broker.mts` - `writeUploadCompletionReply()` retyped on `ReceivePayloadToFileResult`, fallback removed
- `src/mcp/vice/broker-transfer.test.mts` - five new real-fault/filter/cap tests
- `src/mcp/vice/stock-machine.test.ts` - one new real-fault test, one existing test converted from synthetic to real fault
- `src/mcp/vice/vice-broker-staging.test.ts` - `startStagingListenerForState()` gains an optional `getDeps()`; two new real-fault tests
- `src/mcp/vice/resources/broker-transfer.mjs`, `src/mcp/vice/resources/vice-broker.mjs` - rebuilt

## Decisions Made
See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `formatPathFreeFault` filter test's own assertion message triggered its throwing-getter fixture unconditionally**
- **Found during:** Task 1, confirming GREEN for `broker-transfer.test.mts`
- **Issue:** The filter test's loop built each assertion's failure message with `` `...${JSON.stringify(fault)}...` ``. Template-literal arguments evaluate eagerly regardless of whether the assertion passes, so on the iteration whose fixture is `Object.defineProperty({}, "code", { get() { throw ... } })`, `JSON.stringify()` invoked the getter and threw -- turning a passing case into a test failure.
- **Fix:** Replaced the stringified fixture in the message with its array index (`noParenFaults[${index}]`), which never touches the fixture's own properties.
- **Files modified:** `src/mcp/vice/broker-transfer.test.mts`
- **Verification:** the fixed test passes in the Task 1 GREEN run (124/124).
- **Committed in:** `8bb0ea5e` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Two new real-fault tests leaked a listening socket on their own (expected) RED failure, hanging the whole test process**
- **Found during:** Task 1 and Task 2, first RED runs of `broker-transfer.test.mts`
- **Issue:** Two new tests called `server.close()` only at the end of a passing `try` block, matching several pre-existing tests' own style in this file. Because these specific tests are EXPECTED to fail their assertions against the unfixed tree (RED), the thrown `AssertionError` skipped `server.close()` entirely, leaving a listening socket open -- which keeps a Node process alive indefinitely once every test has otherwise finished (observed live: the process sat idle for 8+ minutes past the last reported test result).
- **Fix:** Wrapped each socket/server's lifecycle in its own `try`/`finally`, matching Task 1's own rename-fault test (fixed first, then the pattern was reused for Task 2's cap-boundary test).
- **Files modified:** `src/mcp/vice/broker-transfer.test.mts`
- **Verification:** both RED runs completed cleanly (exit 1, no hang) after the fix, with the expected `not ok` count and no leftover process.
- **Committed in:** `45b6822a` (Task 1 RED commit) and `d1da4790` (Task 2 RED commit) respectively -- each fix landed in the same RED commit as the test it belongs to, since it was found and fixed before that commit was made.

---

**Total deviations:** 2 auto-fixed (2 bugs in newly-authored test code, neither in production source).
**Impact on plan:** Both fixes were necessary to get an honest, non-hanging RED signal; neither changes what any test asserts about `broker-transfer.mts`/`vice-broker.mts`'s own behavior. No scope creep.

## TDD Gate Compliance

Both tasks carry `tdd="true"` (Task 1 is also `type="tracer"`). Each has a `test(64-15): RED` commit followed by a `feat(64-15): GREEN` commit, in order; neither needed a REFACTOR commit. RED evidence was verified via `gsd_run check tdd-red-evidence` for every RED-phase test (5 records, all `RED_EVIDENCE_OK`):

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | ✓ (`RED_EVIDENCE_OK` x3: rename unit test, filter test, stock-machine real-fault test) | ✓ | — | Pass |
| 2 | ✓ (`RED_EVIDENCE_OK` x5: pipeline, hook, cap, stock-machine converted test, vice-broker-staging hook test) | ✓ | — | Pass |

## Re-confirmed sweep

Re-read against the current tree by function name (planner's original table: `64-15-PLAN.md`, "Sweep record"). Only rows 2, 4, 5 and 6 changed; every other row is unchanged from the planner's own verdict.

| # | Site (current file:line) | Verdict |
|---|------|---------|
| 1 | `broker-transfer.mts` declared-length refusals, `receivePayloadToFile()` :438-443 | clean, no caught error (unchanged) |
| 2 | `broker-transfer.mts` receive-pipeline catch, `receivePayloadToFile()` :465-491 | **FIXED (Task 2):** classified by observed count; `formatPathFreeFault()` on the non-cap path |
| 3 | `broker-transfer.mts` `verifyObserved()` refusal :495-498 | clean, no caught error, no broker path (unchanged) |
| 4 | `broker-transfer.mts` pre-publish hook catch :505-514 | **FIXED (Task 2):** `formatPathFreeFault()` |
| 5 | `broker-transfer.mts` publish-rename catch :519-528 | **FIXED (Task 1):** `formatPathFreeFault()` |
| 6 | `vice-broker.mts` `writeUploadCompletionReply()` :1192-1206 | **FIXED (Task 1):** no fallback; typed on `ReceivePayloadToFileResult` |
| 7 | `vice-broker.mts` `handleFileTransfer()` refusals :1207-1231, `broker-control.mts` `transfer` arm :1433-1479 | clean, fixed texts (unchanged) |
| 8 | `broker-control.mts` `transfer` arm validation (same range as row 7) | clean, fixed texts (unchanged) |
| 9 | `broker-control.mts` `stage_file` arm :1730-1763, `vice-broker.mts` `handleStageFile()` :1090 | clean; `emulator_filename` remains a by-design relay value, not caught-error text (unchanged) |
| 10 | `vice-broker.mts` download branch :1268 (`sendPayloadFromFile`) | clean on the wire, stderr-only (unchanged) |
| 11 | `broker-endpoint.ts` `performTransfer()` error-line branch :952 area | conduit for rows 7-8 (unchanged) |
| 12 | `broker-endpoint.ts` `awaitTransferComplete()` error-line branch :1199, :1253 (`obj.message`) | conduit for rows 1-6, fixed at source (unchanged) |
| 13 | `broker-endpoint.ts` client-authored texts | clean (unchanged) |
| 14 | `stock-connect.ts` `defaultTransferFile()` :488, forwarding at :520/:543/:550/:562 | conduit, not changed |
| 15 | `vice-broker-client.ts` `stageFile()` :1386 | clean, fixed code tokens (unchanged) |
| 16 | `stock-machine.ts` upload/download failure returns (`handleAutostart` :165, `handleDiskAttach` :332, `handleSnapshotSave` :453, `handleSnapshotLoad` :580) | conduit (unchanged) |

Result unchanged from the planner's own count: the three CR-01 branches (rows 2, 4, 5) and the one latent fallback (row 6) were the only sites of the class, and all four are now fixed. No new site was found. No client-side scrubber was added anywhere.

## Known residuals (flagged, not fixed by this plan)

Per the plan's own "Known residuals outside this gap" section -- named again here so it stays visible past this SUMMARY's own scope:

- **NEW, found by the planner's sweep, not this plan's to fix.** `receivePayloadToFile()` still creates its staging directory with `mkdirSync(dirname(destPath), { recursive: true })` at broker-transfer.mts (now line ~439), outside every `try`. `handleFileTransfer()`'s upload branch attaches only a fulfilment handler to the returned promise, so a `mkdirSync` failure there is an unhandled rejection -- MEASURED by the planner on Node v24.20.0 to end the broker process with exit 1. Reachable only when the grant's session directory has vanished and cannot be recreated (the path from `resolveStagedFile()` to that `mkdirSync` is synchronous, so the session-close sweep cannot land between them). **This plan did not fix it and does not claim to cover it** -- recorded as a todo in `.planning/WINDOWS.md` per the executor's own broken-windows ledger contract.
- WR-01 (64-REVIEW.md): `broker-relay.mts`'s `dialEmulatorLeg()` has no timeout on each connect attempt. Not this plan's.
- IN-01 (64-REVIEW.md): a microtask window in `broker-control.mts`'s attach `.then()` can leak a connected emulator socket. Not this plan's.
- Carried-forward review warnings (VICE_BROKER_CONTROL_PORT validation inconsistency, six synchronous dispatch callbacks in `broker-control.mts` with no try/catch, a stale doc comment in `broker-home.mts`) -- unchanged by this plan.
- `64-UAT.md`'s G-64-3 and G-64-4 entries still read `status: failed` from earlier rounds; plans 64-12 to 64-14 closed both and VERIFICATION truths 6-7 verified them. Not this plan's to touch.
- `CR-01` at `text-protocol.ts:850` (carried in `STATE.md` by decision) is a DIFFERENT item from this plan's own G-64-5/CR-01. Not touched by this plan.

## Issues Encountered
None beyond the two test-authoring bugs already documented under "Deviations from Plan" (both found and fixed while confirming GREEN, neither reaching a committed broken state).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-64-5 is closed: `64-VERIFICATION.md`'s `gaps:` entry (CR-01) is resolved -- all three caught-fault branches of `receivePayloadToFile()` and the reply writer's fallback now build client-facing text exclusively from a fixed phrase, `formatPathFreeFault()`, or broker-computed numbers, proven against real filesystem faults rather than a synthetic, path-free rejection.
- Both of the gap's `missing:` lines are delivered: "at most an errno code" (via `formatPathFreeFault()` and `WIRE_SAFE_ERROR_CODE_RE`) and a real-rename/real-open failure test whose wire reply and tool result are proven path-free (`broker-transfer.test.mts`, `stock-machine.test.ts`, `vice-broker-staging.test.ts`).
- Full-suite baseline (measured before this plan's first edit): `npm run test:automated` 4266/4257/0/9, exit 0; `npm test` 4441/4357/0/84, exit 0. After this plan: `npm run test:automated` 4274/4265/0/9, exit 0 (+8 tests, all new, zero regressions); `npm test` 4449/4365/0/84, exit 0 on a clean re-run (a first run surfaced one unrelated, transient `anno-tools.test.ts` failure in a module this plan never touched -- `ENOTEMPTY` on its own `/tmp` fixture cleanup -- which passed alone and passed on the immediate re-run of the full suite, confirming it was not a regression from this plan).
- No live broker was started or left running by this plan; `systemctl --user list-units 'vice-broker*' --state=active --no-legend` printed nothing before every test run.
- This plan's per-plan gap-closure round (G-64-5) is complete. Phase 64 verification is next.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 4 task commits (`45b6822a`, `8bb0ea5e`, `d1da4790`, `9874cbf0`) found in `git log --oneline --all`.
- All 7 key-files found on disk.
- Plan-level `<verification>` re-run: a real rename failure reaches the tool result with `(ENOENT)` and no broker-side path, no UNDUMP sent (Task 1); all three caught-fault branches answer real faults with path-free wire text, `reason` stays full (Tasks 1-2); the raw `error` line's key set and content are pinned for both publish-side real faults (Task 2); the cap refusal still names the limit from numbers at the boundary pair (Task 2); the reply writer cannot fall back to the full reason and typecheck enforces it (Task 1); the sweep is re-confirmed above and the full-glob suite is green with no broker running (Task 2).
