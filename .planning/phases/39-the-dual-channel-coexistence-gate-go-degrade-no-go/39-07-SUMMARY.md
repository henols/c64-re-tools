---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 07
subsystem: testing
tags: [vice, text-monitor, fixtures, provenance, tdd, node-test]

requires:
  - phase: 39-06
    provides: "DISCONNECT_RECOVERY and TEXT_SINGLE_CLIENT live measurements, plus probe-harness.mjs/textmon-probe-client.mjs shared seams reused unmodified here"
provides:
  - "The first text-channel fixture batch: 12 payload+sidecar pairs under src/mcp/vice/fixtures/textmon/, captured live from both genuine stock VICE 3.9 and fork VICE 3.10"
  - "src/mcp/vice/textmon-fixtures.ts, a sibling fixture loader reimplementing binmon-fixtures.ts's five-key provenance contract without importing its frame-encoding surface"
  - "src/mcp/vice/textmon-fixtures.test.ts, one new corpus-free automated test proving the loader refuses an incomplete sidecar"
affects: [42-parse-phase, textmon-parser-design]

actuals_note: "chars/4 over the full diff, dominated by ~1.6MB-per-side captured memmapshow payloads (data captured live from the emulator, not authored) -- not comparable to the plan's 70000-token estimate, which anticipated the code/evidence work only"
actuals:
  tokens: 855722
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Fixture loader sibling pattern: a second loader (textmon-fixtures.ts) reimplements a shared provenance CONTRACT as its own frozen array rather than importing the analogous module, keeping each loader's own single-seam claim true"
    - "Settle-based reply framing: wait for a terminator match, then require the socket to go quiet for a fixed window before finalizing, resetting on further data -- correct for both double-prompt (entry+exit) framing and slow/large command outputs, where a first-match strategy truncates and misattributes"

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-fixture-batch.md
    - src/mcp/vice/fixtures/textmon/README.md
    - src/mcp/vice/fixtures/textmon/access-map-stock.txt (+ .json, and the fork/backtrace/cpu-history/flat-profile/register-decode/connect-banner siblings -- 12 pairs total)
    - src/mcp/vice/textmon-fixtures.ts
    - src/mcp/vice/textmon-fixtures.test.ts
  modified: []

key-decisions:
  - "FIXTURE_UNSUPPORTED: none -- every command in the set answered successfully on both binaries; no D-20 refusal fired in this batch, and this is stated as a real measured finding rather than assumed"
  - "chis 4 succeeded on genuine stock VICE 3.9 over the text channel with real per-entry cycle counts -- the binary-monitor CPUHISTORY_GET (0x86) >= 3.10 version floor does NOT apply to the text-monitor chis capability, confirmed live and never conflated in any fact line"
  - "FIXTURE_ENCODING: has-high-bytes -- VICE's flat-profiler report uses UTF-8 U+202F (narrow no-break space) as its thousands-group separator, confined to the flat-profile captures; every other command's bytes are pure 7-bit ASCII"
  - "connect-banner is 0 bytes on both binaries, reconfirming 39-03's own independent finding -- committed as the fixture itself, not smoothed into a non-empty placeholder"
  - "All five non-banner commands show FIXTURE_DIVERGENCE between stock and fork, described per-command in the evidence file and the fixture README as real-time timing artefacts (same idle-loop PC, cycle-count drift, live raster-beam sampling) rather than format or semantic differences -- neither capture is treated as canonical"

patterns-established:
  - "Settle-based capture for byte-exact fixture work: a first-terminator-match strategy is provably wrong for slow/large monitor replies on this launch shape; a quiet-window settle strategy is the corrected default for any future text-monitor capture script"

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "First text-channel fixture batch: 12 real payload+sidecar pairs captured from both stock and fork binaries, five-key provenance derived from resolved absolute path, committed under src/mcp/vice/fixtures/textmon/"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "the plan's own automated <verify> blocks re-run against the final committed tree: FIXTURE_PROVENANCE_OK pairs=12 binaries=2; BATCH_EVIDENCE_OK; NO_BINARY_LEAK_OK -- all three re-run and logged in 39-fixture-batch.md's own self-check section"
        status: pass
    human_judgment: false
  - id: D2
    description: "textmon-fixtures.ts: a sibling loader reimplementing the five-key provenance contract, refusing an absent/corrupt/incomplete sidecar with its own named MissingTextFixtureError, importing nothing from binmon-fixtures.ts's frame-encoding surface"
    requirement: "CHAN-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-fixtures.test.ts (11 tests, all pass)"
        status: pass
      - kind: other
        ref: "grep -acE '^[[:space:]]*import .*binmon-fixtures' textmon-fixtures.ts == 0; npm run typecheck exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The new test joins the automated set with zero MANUAL_ONLY_TESTS changes, and the gated suite adds no new failing file beyond the recorded baseline"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "automatedTestFiles() includes textmon-fixtures.test.ts; test-gate.mjs/test-gate.test.ts untouched (git status --porcelain empty); npm run test:automated: tests 3563 / pass 3549 / fail 3 in anno-import.test.ts + anno-register.test.ts only, matching the recorded baseline"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 07: Text-Channel Fixture Batch and Sibling Loader Summary

**Twelve real payload+sidecar pairs captured live from genuine stock VICE 3.9 and fork VICE 3.10 over the text monitor, plus `textmon-fixtures.ts` -- a sibling loader that refuses an incomplete provenance sidecar, proven by one new corpus-free test; no command in the set was unsupported on either binary.**

## Performance

- **Duration:** ~40 min (including three live capture runs against real emulators: one voided on a connect race, one voided on a reply-framing bug found and fixed live, one authoritative)
- **Started:** ~2026-09-07T23:00:00Z
- **Completed:** 2026-09-07T23:29:01Z
- **Tasks:** 2
- **Files modified:** 4 authored files (`fixture-capture.mjs`, `39-fixture-batch.md`, `textmon-fixtures.ts`, `textmon-fixtures.test.ts`) + 1 README + 24 fixture payload/sidecar files (12 pairs)

## Accomplishments

- Captured the first text-channel fixture batch: `access-map`, `flat-profile`, `cpu-history`, `backtrace`, `register-decode`, `connect-banner` -- each from BOTH genuine unpatched stock VICE 3.9 (`/usr/bin/x64sc`) and the patched fork VICE 3.10 (`/usr/local/bin/x64sc`), 12 pairs total, `FIXTURE_BINARIES: 2`.
- Every sidecar carries the five required provenance keys (`capturedFrom`, `viceVersion`, `capturedAt`, `command`, `synthetic`), `synthetic: false`, and a `capturedFrom` naming the kind derived from the RESOLVED ABSOLUTE PATH (never operator-supplied) -- the same defect class the binmon fixture tree's own two-month mislabelling incident warns against.
- `FIXTURE_UNSUPPORTED: none` -- no command in the set was refused by either binary. In particular, `chis 4` succeeded on stock VICE 3.9 with real per-entry cycle counts, reconfirming `.planning/notes/text-monitor-channel-live-probe.md`'s own independent measurement: the binary-monitor `CPUHISTORY_GET` (0x86) `>= 3.10` version floor is about the wire opcode, not the CPU-history capability, and no finding in this batch conflates the two.
- `FIXTURE_ENCODING: has-high-bytes` -- measured, not assumed: VICE's flat-profiler report uses UTF-8 U+202F (narrow no-break space) as its thousands-group separator, confined to the `flat-profile` captures.
- `FIXTURE_DIVERGENCE` fired on all five non-banner commands; each is described per-command in `39-fixture-batch.md` and the fixture README as a real-time timing artefact (identical idle-loop PC range, drifting cycle counts, live-sampled raster-beam state) rather than a format or stock/fork semantic difference. Both captures stay committed; neither is treated as canonical.
- Implemented `textmon-fixtures.ts` through a full RED-GREEN TDD cycle: 11 tests written first and confirmed failing (`ERR_MODULE_NOT_FOUND`), then the loader implemented to make all 11 pass, importing nothing from `binmon-fixtures.ts`'s frame-encoding surface.
- `npm run typecheck` exits 0; `npm run test:automated` shows `fail 3` in exactly the two files (`anno-import.test.ts`, `anno-register.test.ts`) the recorded baseline already carries -- no new failing file introduced by this plan.

## Task Commits

1. **Task 1: Capture the parseable command outputs from both binaries, with provenance derived rather than declared** - `5411c5f2` (feat)
2. **Task 2: The sibling loader that refuses an incomplete sidecar, and the one test that proves it** - `a98037f1` (test, RED) + `3f12676d` (feat, GREEN)

**Plan metadata:** commit follows this SUMMARY (see below).

_Task 2 is `type="auto" tdd="true"` -- RED/GREEN commits are both present; no REFACTOR commit was needed (the GREEN implementation needed no cleanup)._

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs` - the capture script: drives both binaries over the text channel, derives provenance from resolved absolute path, writes payload+sidecar pairs
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-fixture-batch.md` - the transcript: precondition checks, two voided runs with their reasons, the authoritative run, per-command divergence descriptions, encoding/unsupported findings, and every batch fact line
- `src/mcp/vice/fixtures/textmon/README.md` - the per-capture provenance table, framing/divergence/encoding/unsupported-command sections, and the regenerate-never-hand-edit discipline
- `src/mcp/vice/fixtures/textmon/*.txt` + `*.json` (12 pairs) - the committed captures
- `src/mcp/vice/textmon-fixtures.ts` - the sibling fixture loader
- `src/mcp/vice/textmon-fixtures.test.ts` - the one new corpus-free automated test

## Decisions Made

- **Do not use `sendAndAwaitPrompt()` (the throwaway text client's own crude framing) for fixture capture.** Found live: the stock text monitor frames every reply as an immediate PC-echo prompt, THEN the command's real output, THEN a final exit prompt; for a slow command (`memmapshow`, ~1.6MB) these arrive as separate TCP segments, and a first-match strategy truncates the capture and misattributes the rest to the NEXT command sent. Fixed locally in `fixture-capture.mjs` with a settle-based reply helper (wait for a match, then require quiet for a fixed window) rather than modifying `textmon-probe-client.mjs` itself (a throwaway per D-13, and its own header already documents this class of hazard as out of scope).
- **`FIXTURE_UNSUPPORTED: none` is stated as a genuine finding, not a gap.** The dispatch-time expectation that `chis` would be refused on stock 3.9 (reasoning from the binary-monitor's `CPUHISTORY_GET` version floor) was checked against both the plan's own text and the phase's prior research note, both of which already measured `chis` succeeding over the text channel on stock 3.9 -- confirmed again live in this batch. No fact line in this plan states or implies the version-floor framing applies to the text-monitor capability.
- **`textmon-fixtures.ts` keeps its own copy of `REQUIRED_PROVENANCE_KEYS`**, not an import from `binmon-fixtures.ts`, per D-18 -- the contract is shared, the module is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `fixture-capture.mjs`'s first draft used `connectTextMonitor()` directly (a single-shot connect, no retry), and lost the race against the emulator's own socket bind**
- **Found during:** Task 1, first live run
- **Issue:** `ECONNREFUSED` -- `x64sc` binds its monitor sockets some time after `execve()` returns, not the instant it returns, exactly as `probe-harness.mjs`'s own `connectWithRetry()` doc comment already establishes for the binary port.
- **Fix:** Added a local `connectTextMonitorWithRetry()` helper, reproducing the identical retry shape every prior plan in this phase already uses locally for the text port (e.g. `text-single-client-probe.mjs`).
- **Files modified:** `fixture-capture.mjs`
- **Verification:** Second run connected successfully in ~150ms on both binaries.
- **Committed in:** `5411c5f2` (Task 1 commit; the first, voided run is recorded in `39-fixture-batch.md` with its reason)

**2. [Rule 1 - Bug] `fixture-capture.mjs`'s second draft misattributed `memmapshow`'s real ~1.6MB output to the NEXT command's own capture, truncating `access-map` to 10 bytes**
- **Found during:** Task 1, second live run
- **Issue:** The stock text monitor frames every reply in three parts (entry-echo prompt, command output, exit prompt); for a slow command like `memmapshow` these arrive as separate TCP segments, and the throwaway client's own `sendAndAwaitPrompt()` (first-match-wins framing, explicitly out-of-scope by its own file header for this hazard) resolved on the entry-echo alone. The socket, paused once the listener was removed, buffered the real reply until the NEXT command's own listener attached.
- **Fix:** Added a local `sendAndAwaitSettledReply()` helper: wait for the terminator to match, then require the socket to go quiet for a fixed window (800ms) before finalizing, resetting on further data. Confirmed correct in a standalone reproduction before committing, then re-verified in the authoritative run (every capture begins and ends with its OWN command's prompt, no cross-command bleed).
- **Files modified:** `fixture-capture.mjs`
- **Verification:** Authoritative run's `access-map` captures are 1,624,557 bytes on both binaries, matching `memmapshow`'s real dump size; every other case's captured bytes begin and end with a single, correctly-attributed prompt.
- **Committed in:** `5411c5f2` (Task 1 commit; the second voided run is recorded in `39-fixture-batch.md` with its reason, and the 12 fixtures it wrote were overwritten by the authoritative run before this commit)

---

**Total deviations:** 2 auto-fixed (1 blocking connect race, 1 correctness bug in the capture framing).
**Impact on plan:** Both were necessary for correctness -- an unfixed capture script would have committed a truncated `access-map` fixture and an inflated `flat-profile` fixture carrying someone else's data as the specification the next phase's parsers are built against. No scope creep: both fixes are local to `fixture-capture.mjs`, a file this plan owns outright; neither modifies a shared seam (`probe-harness.mjs`, `textmon-probe-client.mjs`) or `binmon-fixtures.ts`.

## Issues Encountered

None beyond the two deviations above, both resolved before the authoritative run and before any fixture was committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 41/42's parsers can now be built directly against `src/mcp/vice/fixtures/textmon/`'s six real, two-binary-confirmed capture shapes (`memmapshow`, `prof flat N`, `chis N`, `bt`, `io $d020`, and the confirmed-empty connect banner) via `textmon-fixtures.ts`'s `loadTextFixture()`/`listTextFixtures()`.
- The reply-framing finding (entry-echo, output, exit-prompt, with slow commands splitting across TCP segments) is new, load-bearing background for `CHAN-03`'s reliable-framing design -- a length-prefixed or otherwise unambiguous framing scheme will need to account for this three-part shape explicitly, not just a single terminator match.
- `FIXTURE_UNSUPPORTED: none` means this batch alone does not exercise `textmon-fixtures.ts`'s `-unsupported-<kind>` naming convention end-to-end against a REAL refused capture; the loader's refusal-handling contract is still fully covered by `textmon-fixtures.test.ts`'s synthetic negative cases, but a future capture against a build that genuinely refuses one of these commands would be the first live confirmation of that naming shape.
- No blockers. All seven of the phase's gate inputs were already measured before this plan (39-03 through 39-06); this plan added no new gate input, only the fixture batch and its loader per its own scope boundary.

## Self-Check: PASSED

- All 4 authored files + README + 24 fixture files verified present on disk (`[ -f ]`): `fixture-capture.mjs`, `39-fixture-batch.md`, `src/mcp/vice/fixtures/textmon/README.md`, all 12 `.txt`/`.json` pairs, `textmon-fixtures.ts`, `textmon-fixtures.test.ts`.
- Commits `5411c5f2`, `a98037f1`, `3f12676d` verified present in `git log --oneline --all`.
- Task 1's three `<verify>` blocks re-run post-commit: `FIXTURE_PROVENANCE_OK pairs=12 binaries=2`, `BATCH_EVIDENCE_OK`, `NO_BINARY_LEAK_OK` -- all passed.
- Task 2's four `<verify>` blocks re-run post-commit: `node --test textmon-fixtures.test.ts` reports `fail 0`; `npm run typecheck` exits 0; `LOADER_SEAM_OK`; `npm run test:automated` shows `fail 3` in `anno-import.test.ts` + `anno-register.test.ts` only -- all passed.
- TDD gate sequence confirmed: `git log --oneline --grep="^test(39-07)"` finds `a98037f1`; `git log --oneline --grep="^feat(39-07)"` finds both `5411c5f2` and `3f12676d`, with the RED commit preceding the GREEN commit in git order.
- Ordering: all three commits land after `acf05b4c` (39-06's last commit) in git order; `05c2c069` remains the sole original evidence-tree commit, never amended.
- Host left clean: `systemctl --user is-active vice-broker` reads `inactive`, `pgrep -x x64sc` returns no match.
- `git status --porcelain src/mcp/vice/fixtures/binmon` returns empty -- the existing binary fixture tree is untouched.

## TDD Gate Compliance

Task 2 (`tdd="true"`) gate sequence: RED (`a98037f1`, `test(39-07): add failing test...`) precedes GREEN (`3f12676d`, `feat(39-07): implement textmon-fixtures.ts...`) in git log order. No REFACTOR commit -- not required; the GREEN implementation needed no follow-up cleanup. Both required gates present; no violation to flag.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
