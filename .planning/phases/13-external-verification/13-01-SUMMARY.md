---
phase: 13-external-verification
plan: 01
subsystem: testing
tags: [binmon, binary-monitor, vice, fixtures, provenance, stock-protocol]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: the three synthetic VERIF-02 binmon fixtures and the D-19 override this plan resolves
  - phase: 07 (plan 07-12)
    provides: the CPUHISTORY_GET real-capture sidecar shape and buildSidecar()/CAPTURE_REQUIRES_VERSION machinery this plan reused unchanged
provides:
  - Three real, hardware-recorded binmon wire fixtures (display-get, event-interleaved, checkpoint-list) replacing spec-synthesized ones
  - A capture transcript answering the folded todo's six numbered acceptance steps
  - A single, non-mixed provenance narrative across binmon-fixtures.ts's header, its own test suite, and fixtures/binmon/README.md
  - Real-bytes-derived request-id coupling in stock-protocol.test.ts's correlat: tests
  - A confirmed (not corrected) CheckpointList terminator-frame parser reading
affects: [13-external-verification (remaining plans), any future plan touching fixtures/binmon/ or the stock binmon protocol client]

# Actuals (#2632)
actuals:
  tokens: 9500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real capture over synthetic fallback: dynamic binary resolution via `command -v x64sc`, kind derived from a `-mcpserver` count over `--help`, never hand-typed"
    - "One capture process per case (never `--capture all`) so each case's own BinMon.nextId sequence is reproducible and independently verifiable"

key-files:
  created:
    - .planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md
  modified:
    - .claude/mcp/vice/fixtures/binmon/display-get.bin
    - .claude/mcp/vice/fixtures/binmon/display-get.json
    - .claude/mcp/vice/fixtures/binmon/event-interleaved.bin
    - .claude/mcp/vice/fixtures/binmon/event-interleaved.json
    - .claude/mcp/vice/fixtures/binmon/checkpoint-list.bin
    - .claude/mcp/vice/fixtures/binmon/checkpoint-list.json
    - .claude/mcp/vice/fixtures/binmon/README.md
    - .claude/mcp/vice/binmon-fixtures.ts
    - .claude/mcp/vice/binmon-fixtures.test.ts
    - .claude/mcp/vice/stock-protocol.test.ts

key-decisions:
  - "Resolved the capture binary via `command -v x64sc` per D-13-01, which on this host resolves to the patched fork build (`/usr/local/bin/x64sc`, VICE 3.10) because it shadows genuine stock VICE earlier on $PATH -- captured against the fork, recorded truthfully as `fork:...`, rather than hardcoding a path to force a stock capture"
  - "checkpoint-list's terminator-frame reading (response_type 0x14, 4-byte u32LE count) is CONFIRMED against the real bytes -- stock-protocol.ts's CheckpointList branch was left untouched, per the plan's own instruction for the CONFIRMED case"
  - "event-interleaved's real order (reply first, then RESUMED/REGISTER_INFO/STOPPED) differs from the retired synthetic model but matches docs/phase1-probe-results.md line 248's recorded [RESUMED, REGISTER_INFO, STOPPED] order"
  - "Both correlat: test initialRequestId literals (4, 2) already matched the real embedded ids without change -- only a citing comment was added -- but checkpoint-list's events.length assertion (2 -> 8) did need correcting: real CHECKPOINT_SET calls trigger a RESUMED/REGISTER_INFO/STOPPED broadcast sequence the synthetic fixture never modeled"

requirements-completed: [EXTV-01]

coverage:
  - id: D1
    description: "Three VERIF-02 binmon fixtures (display-get, event-interleaved, checkpoint-list) are real captures from a dynamically resolved x64sc, with sidecars carrying exactly the five required keys and a truthful capturedFrom kind"
    requirement: EXTV-01
    verification:
      - kind: unit
        ref: "binmon-fixtures.test.ts#EXTV-01: the three re-recorded fixtures report synthetic: false, with a capturedFrom naming the kind and path of the binary that actually answered"
        status: pass
      - kind: other
        ref: "node -e 'loadCapturedFixture(c) for all three cases' (Task 1's own <verify> command)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No document, module header or test in the package still describes the three fixtures as synthetic while they are relied on as ground truth"
    requirement: EXTV-01
    verification:
      - kind: unit
        ref: "binmon-fixtures.test.ts#EXTV-01: binmon-fixtures.ts's own header states all six fixtures under fixtures/binmon/ are real captures"
        status: pass
      - kind: other
        ref: "grep -c 'NOT currently real captures' binmon-fixtures.test.ts == 0; README.md Source paths table has zero synthesized rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "stock-protocol.test.ts's request-id coupling is derived from the committed bytes and cited in a comment at each site"
    requirement: EXTV-01
    verification:
      - kind: unit
        ref: "stock-protocol.test.ts#correlat: the captured checkpoint-list fixture resolves exactly once... / correlat: the captured event-interleaved fixture resolves the command it contains..."
        status: pass
    human_judgment: false
  - id: D4
    description: "The checkpoint-list terminator-frame reading has a recorded CONFIRMED or CORRECTED outcome"
    requirement: EXTV-01
    verification:
      - kind: other
        ref: "13-CAPTURE-TRANSCRIPT.md Step 4 verdict: CONFIRMED (response_type 0x14, body_length 4, u32LE count=2 read directly from the real terminal frame)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run test:automated and npm test are both green at the end of this plan"
    requirement: EXTV-01
    verification:
      - kind: integration
        ref: "npm run test:automated (2069/2069 pass, 5 pre-existing todo)"
        status: pass
      - kind: integration
        ref: "npm test (2210/2210 pass, 30 pre-existing skipped, 5 pre-existing todo)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean); node probe-binmon.mjs --selftest (pass)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-21
status: complete
---

# Phase 13 Plan 01: Re-record the three VERIF-02 binmon fixtures from a real x64sc Summary

**`display-get`, `event-interleaved`, and `checkpoint-list` are now real hardware captures off a genuine (fork-build) `x64sc`, their provenance narrative unified across the module header, the test suite, and the README, and `stock-protocol.test.ts`'s request-id coupling re-derived from the committed bytes -- with the checkpoint-list terminator parser confirmed correct against real bytes rather than corrected.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-21 (session start, before first commit)
- **Completed:** 2026-08-21T23:17:17Z
- **Tasks:** 3/3
- **Files modified:** 11 (7 fixture files, 3 source/test files, 1 new transcript)

## Accomplishments

- Resolved the capture binary dynamically (`command -v x64sc`) and derived its kind from a live `-mcpserver` count over `--help` (5 -> fork), never hand-typed, mitigating the exact T-13-02 defect already present in two pre-existing `cpuhistory-get*` sidecars.
- Launched `x64sc -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502` and captured all three cases as three separate processes (never `--capture all`), so each case's request-id sequence started fresh and was independently decodable.
- Re-read all three sidecars from disk and confirmed each carries exactly the five required provenance keys, `synthetic: false`, and a truthful `capturedFrom` (`fork:/usr/local/bin/x64sc`) and `viceVersion` (`3.10.0.0`).
- Decoded every frame in all three `.bin` files byte-by-byte and wrote `13-CAPTURE-TRANSCRIPT.md`, answering the folded todo's six numbered steps: no case hit `MAX_CAPTURE_FRAMES`; `display-get`'s geometry matches the previously recorded probe reading field-for-field (`dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8`); `event-interleaved`'s real order matches `docs/phase1-probe-results.md` line 248 and differs from the retired synthetic model; `checkpoint-list`'s terminator frame (`0x14`, `body_length=4`, `u32LE` count `2`) **CONFIRMS** `stock-protocol.ts`'s `CheckpointList` parser.
- Rewrote the provenance narrative in all three places it is stated (`binmon-fixtures.ts`'s module header, `binmon-fixtures.test.ts`'s `WR-09`/`WR-10` tests, `fixtures/binmon/README.md`), and corrected the D-13-06 "genuine build" mislabel in the README's prose (without touching the two pre-existing `cpuhistory-get*` sidecar files themselves, whose known-wrong `capturedFrom` kind is a separately filed todo).
- Re-coupled `stock-protocol.test.ts`'s two `correlat:` tests to the real embedded request ids (both literals already matched, cited via a new comment) and fixed one real assertion that did need changing: `checkpoint-list`'s `events.length` (`2` -> `8`), because each real `CHECKPOINT_SET` call triggers a `RESUMED`/`REGISTER_INFO`/`STOPPED` broadcast sequence the retired synthetic fixture never modeled.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end real capture — launch, capture all three cases, decode the bytes** - `bfae419` (feat)
2. **Task 2: Rewrite the provenance narrative in all three places it is stated** - `f219e40` (docs)
3. **Task 3: Re-couple stock-protocol.test.ts to the real request ids, and correct the terminator parser if contradicted** - `e97ab78` (test)

## Files Created/Modified

- `.planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md` - new capture transcript answering the folded todo's six steps, plus a section documenting the `events.length` assertion change
- `.claude/mcp/vice/fixtures/binmon/display-get.{bin,json}` - real `DISPLAY_GET` capture, request id 2, geometry matching the prior probe reading exactly
- `.claude/mcp/vice/fixtures/binmon/event-interleaved.{bin,json}` - real `ADVANCE_INSTRUCTIONS` capture, 4 frames (reply first, then `RESUMED`/`REGISTER_INFO`/`STOPPED`)
- `.claude/mcp/vice/fixtures/binmon/checkpoint-list.{bin,json}` - real `CHECKPOINT_SET`x2 -> `CHECKPOINT_LIST` capture, 11 frames, confirming the terminator's 4-byte `u32LE` count shape
- `.claude/mcp/vice/fixtures/binmon/README.md` - provenance table and prose flipped to real-capture shape; D-13-06 fork-build mislabel corrected in prose
- `.claude/mcp/vice/binmon-fixtures.ts` - module header rewritten to state all six fixtures are real captures, with the historical synthetic override retained as an archaeology note
- `.claude/mcp/vice/binmon-fixtures.test.ts` - `WR-09` cases array flips three entries to `synthetic: false`; the two `WR-10` tests replaced with `EXTV-01` tests asserting the inverted, current premise
- `.claude/mcp/vice/stock-protocol.test.ts` - both `correlat:` tests now cite `13-CAPTURE-TRANSCRIPT.md` for their `initialRequestId` values; `checkpoint-list`'s `events.length` corrected from 2 to 8 with an explanatory comment

## Decisions Made

- Captured against the fork build rather than forcing genuine stock: `command -v x64sc` resolves to `/usr/local/bin/x64sc` (the fork) on this host because it shadows stock earlier on `$PATH` — resolving dynamically and recording the truthful `fork:` kind was correct per D-13-01/D-13-02, and the plan's acceptance criteria explicitly accept either `fork` or `stock` as a truthful kind.
- Left `stock-protocol.ts` untouched: the `checkpoint-list` terminator reading is CONFIRMED against real bytes, and the plan's own instruction for the CONFIRMED case is to say so rather than edit the file to "note" the confirmation.
- Corrected one real test assertion (`events.length: 2 -> 8`) rather than loosening or working around it, per the plan's explicit rule that a real assertion failure against real bytes is evidence the re-record exists to surface, not a reason to skip re-recording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/test-drift] `checkpoint-list` correlat: test's `events.length` assertion was wrong against the real bytes**
- **Found during:** Task 3 (`node --test stock-protocol.test.ts`)
- **Issue:** The test asserted `events.length === 2`, matching only the retired synthetic fixture's two stray `CHECKPOINT_INFO` replies. The real capture also carries six broadcast `RESUMED`/`REGISTER_INFO`/`STOPPED` frames (three per `CHECKPOINT_SET` call) that `ViceMonitorClient#dispatch()`'s request-id-first demux also emits as `"event"`, for a real total of 8.
- **Fix:** Updated the assertion to `8` with an explanatory comment breaking down the count (2 stray `CHECKPOINT_INFO` + 6 broadcast frames), and recorded the discrepancy and its cause in `13-CAPTURE-TRANSCRIPT.md`.
- **Files modified:** `.claude/mcp/vice/stock-protocol.test.ts`, `.planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md`
- **Verification:** `node --test stock-protocol.test.ts binmon-fixtures.test.ts` 163/163 pass; `npm run test:automated` 2069/2069 pass; `npm test` 2210/2210 pass.
- **Committed in:** `e97ab78` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 test-drift correction against real hardware evidence, explicitly sanctioned by the plan's own instructions for this exact case).
**Impact on plan:** The fix is the plan's central purpose realized — a real assertion changed because real bytes differed from a synthetic model, and the change is fully documented rather than silently absorbed.

## Issues Encountered

None beyond the one documented deviation above, which is itself expected/sanctioned plan output (the plan explicitly anticipated that a `fixture:`/`correlat:` assertion might need correcting and required documenting, not avoiding, that outcome).

## User Setup Required

None - no external service configuration required. (A real `x64sc` binary and an X11 display were required and already present on this host, per the plan's `<precondition>` and the orchestrator's pre-dispatch verification.)

## Next Phase Readiness

- `EXTV-01` is fully discharged: all three re-recorded fixtures are real, hardware-recorded evidence, with a single non-mixed provenance narrative and a confirmed protocol-parser reading.
- The remaining plans in Phase 13 (`EXTV-02`/`EXTV-03`, per `13-PATTERNS.md`'s broader file scan) are unaffected by this plan's changes and can proceed independently — `backend-detect.test.ts`, the `[ASSUMED]` label sites, and the various docs listed in `13-PATTERNS.md`'s "Docs: exact current wording to change" section were deliberately left untouched here, as they are out of this plan's declared `files_modified` scope.
- `docs/phase2-backend-probe-evidence.md` §1 (the original D-19 override record) was deliberately left untouched: it is a historical decision record, not a currently-living claim about fixture state, and is not in this plan's `files_modified`. A later plan in this phase may still want to mark it "resolved" per `13-PATTERNS.md`'s note, but that is out of this plan's scope.
- No blockers.

## Self-Check: PASSED

- Created file exists: `.planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md` — confirmed present.
- All three fixture `.bin`/`.json` pairs exist on disk with `synthetic: false` and the required five keys — confirmed via `node -e` read-back.
- Commits `bfae419`, `f219e40`, `e97ab78` all found in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and green: `npx tsc --noEmit` clean; `npm run test:automated` 2069/2069; `npm test` 2210/2210; `node probe-binmon.mjs --selftest` PASS.
- All task-level `<acceptance_criteria>` re-verified via direct command execution (grep counts, header regex matches, sidecar key checks) as documented above and in `13-CAPTURE-TRANSCRIPT.md`.

---
*Phase: 13-external-verification*
*Completed: 2026-08-21*
