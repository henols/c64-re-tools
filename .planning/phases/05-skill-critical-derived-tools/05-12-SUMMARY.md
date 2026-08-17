---
phase: 05-skill-critical-derived-tools
plan: 12
subsystem: vice-mcp-stock-backend
tags: [vice-binary-monitor, cia, gap-closure, wr-02, wr-03]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-09's resolveRequiredBank()/io-bank resolution in stock-cia.ts, left untouched by this plan"
provides:
  - "decodeCia()'s CIA1 joystick fields (portA.joystick2/portB.joystick1) carrying confounded:boolean plus confoundedReason, derived from the DDR byte already in the 16-byte register buffer -- WR-02"
  - "a per-chip notes:string[] on every decodeCia() answer, present and empty when there is nothing to say, matching stock-sprites.ts's own convention"
  - "fromBcd() returning null (never a fabricated decimal) on an invalid BCD nibble, with the tod object omitting the corresponding key and listing it in a new tod.invalidBcd:string[] -- WR-03"
  - "vice_cia_get_state's outputSchema declaring notes/confounded/confoundedReason/invalidBcd, with tod.required narrowed to [tenths,pm,rawHex,invalidBcd] so the conformance harness validates the real answer"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Omit-and-list for a field that is readable but not always interpretable: the tod object omits seconds/minutes/hours individually on invalid BCD and names the omission in tod.invalidBcd, rather than injecting a dynamic member into the fixed CIA_UNAVAILABLE_FIELDS registry (D-05-20)"
    - "Confounded-flag-plus-reason pairing for a reading whose truth depends on unmodeled shared state (DDR-driven keyboard scan vs. genuine joystick), machine-readable (confounded:boolean) and prose (confoundedReason/notes) side by side, reusing stock-sprites.ts's notes:string[] convention"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-cia.ts
    - .claude/mcp/vice/stock-cia.test.ts
    - .claude/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "The two tasks share decodeCia()'s per-chip notes:string[] array and its portADirectionRaw computation was moved up in the same function -- splitting the two tasks into per-task commits required temporarily reverting Task 2's fromBcd/tod changes, committing Task 1, then reapplying Task 2 on top, rather than a single combined commit, to preserve per-task atomicity despite the shared code path"
  - "CIA1_BYTES' pre-existing ddrA=0xff means that fixture is itself confounded under WR-02's new condition -- the two pre-existing joystick decode tests were updated from a bare deepEqual to individual field assertions plus explicit confounded:true checks, rather than left to fail or silently weakened"
  - "The pre-existing hours=0x8b fixture (whose masked low nibble was invalid BCD and only decoded to 11 by luck under the unvalidated formula) was replaced with 0x91, a genuine 11 PM; the literal string 0x8b was scrubbed from the test file entirely, including from prose comments, per the plan's own grep gate"

requirements-completed: [DERIV-05]

# Metrics
duration: ~40min
completed: 2026-08-17
---

# Phase 05 Plan 12: CIA confounded-joystick and invalid-BCD gap closure Summary

**CIA1 joystick reads now flag `confounded:true` with a prose reason when the DDR shows a driven keyboard column, and CIA TOD registers holding non-BCD bytes are reported via a new `tod.invalidBcd` list instead of an invented decimal, closing the two remaining criterion-3 "plausible-looking value" defects in `stock-cia.ts`.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-17 (session start, not separately timestamped)
- **Completed:** 2026-08-17T23:17:09+02:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- WR-02: `decodeCia()` moves the port A DDR byte read (`portADirectionRaw`) up before the port A/B decode and derives `keyboardColumnDriven = chip === 1 && portADirectionRaw !== 0x00`. CIA1's `joystick2`/`joystick1` now carry `confounded:boolean` plus, when true, a `confoundedReason` naming `$DC00`/`$DC01`'s dual role, the DDRA hex value and output-pin count, and what to do about it. The five direction booleans are unchanged -- annotated, never altered.
- A new per-chip `notes:string[]` (matching `stock-sprites.ts`'s own convention) carries the same substance in prose, present and empty when there is nothing to say.
- WR-03: `fromBcd()` now returns `null`, never a fabricated decimal (e.g. `fromBcd(0x9f)` no longer returns `105`), when either BCD nibble exceeds 9. The `tod` object omits `seconds`/`minutes`/`hours` individually on an invalid byte and lists the omitted names in a new, always-present `tod.invalidBcd:string[]`; `tod.rawHex` remains always present. Each omission pushes a note naming the register address (`$DC09`/`$DC0A`/`$DC0B` or `$DD09`/`$DD0A`/`$DD0B`) and the raw hex byte.
- `tools-manifest.stock.json`'s `vice_cia_get_state` entry declares `notes`, `confounded`/`confoundedReason` (on both joystick objects) and `tod.invalidBcd`, narrowing `tod.required` to `["tenths","pm","rawHex","invalidBcd"]` -- `seconds`/`minutes`/`hours` stay declared as `type:"number"` but are now conditional per D-05-20.
- Replaced the pre-existing CIA1 fixture's coincidence hours byte (`0x8b`, whose masked low nibble was itself invalid BCD and only decoded to 11 by luck under the old unvalidated formula) with `0x91`, a genuine 11 PM, and added a `0x12` fixture to exercise a different tens digit. All baseline gates confirmed unmoved: stock manifest 34 tools, fork manifest 62, `package.json` `files[]` 44, `node scripts/check-skill-tool-coverage.mjs` exit 0.

## Task Commits

Both tasks were committed atomically. Because both tasks modify `decodeCia()`'s shared `notes:string[]` array and Task 1's `portADirectionRaw` relocation sits directly above Task 2's `tod` rebuild, a clean split required temporarily reverting Task 2's changes (`fromBcd`, `tod.invalidBcd`, the manifest's `tod.required` narrowing, and the WR-03 test additions) before Task 1's commit, then reapplying them for Task 2's commit -- see Deviations below.

1. **Task 1: Mark CIA1 joystick fields confounded when the DDR shows a driven keyboard column** - `795981d` (fix)
2. **Task 2: Refuse to invent a TOD value from a non-BCD byte, and fix the fixture that hid it** - `9b2a267` (fix)

_No plan-metadata commit yet -- this is a worktree-isolated executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `.claude/mcp/vice/stock-cia.ts` - `decodeCia()` computes `portADirectionRaw`/`keyboardColumnDriven` before the port A/B decode, adds `confounded`/`confoundedReason` to CIA1's joystick objects and a per-chip `notes:string[]`; `fromBcd()` returns `null` on an invalid nibble; the `tod` object omits invalid fields and adds `invalidBcd`, pushing a note per omission
- `.claude/mcp/vice/stock-cia.test.ts` - updates the two pre-existing CIA1 joystick decode tests (now confounded, since the fixture's `ddrA=0xff`), adds a WR-02 test group (not-confounded/confounded/partial-DDR/CIA2-never-confounded fixtures), replaces the `0x8b` hours byte with `0x91`, and adds a WR-03 test group (valid tens-digit fixtures, invalid-nibble omission cases, a two-invalid-bytes ordering case, and a range-sanity sweep over both chips' fixtures)
- `.claude/mcp/vice/tools-manifest.stock.json` - `vice_cia_get_state`'s `cias.items` gains `notes`; `joystick2`/`joystick1` gain `confounded`/`confoundedReason`; `tod` gains `invalidBcd` and its `required` is narrowed to `["tenths","pm","rawHex","invalidBcd"]`

## Decisions Made

- Split the shared-code-path Task 1/Task 2 edits into two atomic commits by staging a temporary Task-1-only revert of Task 2's changes, verifying it independently (typecheck + full `stock-cia.test.ts`/`stock-dispatch.test.ts` passing, T1 gate script green), committing, then restoring the full target state for Task 2's commit and re-verifying. This preserved per-task atomicity and independent verifiability despite `decodeCia()`'s tight coupling between the two fixes.
- Kept `confoundedReason`'s address references hardcoded to `$DC00`/`$DC01` (rather than parameterised by `basePrefix`) since `confoundedReason` only ever appears on CIA1 (chip 2 has no joystick fields), matching the plan's own required wording.
- Updated rather than replaced the two pre-existing CIA1 joystick decode tests (`fire pressed`/`up pressed`) to assert `confounded:true` explicitly, since `CIA1_BYTES`' own `ddrA=0xff` makes that fixture confounded by WR-02's condition -- documented in a fixture comment so a future reader does not mistake it for an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `CIA1_BYTES`' pre-existing `ddrA=0xff` broke the two pre-existing joystick `deepEqual` assertions once WR-02 landed**
- **Found during:** Task 1, first test run after adding `confounded`/`confoundedReason` to the joystick objects
- **Issue:** The shared `CIA1_BYTES` fixture (used across most of this file's decode tests) has `bytes[0x02] = 0xff` (all port A pins outputs), which is exactly WR-02's confounded condition. The two existing tests (`"CIA1 portA.joystick2 is active-low decoded..."` and `"CIA1 portB.joystick1.up is true..."`) used `assert.deepEqual(...)` against a plain `{up,down,left,right,fire}` object, which fails as soon as `confounded`/`confoundedReason` are added to the real answer.
- **Fix:** Converted both tests from a single `deepEqual` to individual field assertions (`up`/`down`/`left`/`right`/`fire`) plus explicit `confounded === true` (and a non-empty-string check on `confoundedReason` for the portA case), with a comment explaining why this fixture is confounded by construction.
- **Files modified:** `.claude/mcp/vice/stock-cia.test.ts`
- **Verification:** `node --test stock-cia.test.ts stock-dispatch.test.ts` -- all cases pass.
- **Committed in:** `795981d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, discovered while running the test suite after the Task 1 edit)
**Impact on plan:** Necessary for the existing test suite to remain green after WR-02's fix; no scope creep -- the fix is confined to two pre-existing assertions in the file this plan already modifies.

## Issues Encountered

- One pre-existing, unrelated test failure surfaces in `npm run test:automated`: `repo-root.test.ts`'s "path agreement ... the agreed path is not under .claude" fails because this worktree's own path (`.claude/worktrees/agent-.../`) contains a `.claude` segment -- the same known, previously-logged environmental issue documented in 05-09's own SUMMARY.md. Unrelated to this plan's changes and not fixed here. Baseline: 1360 pass / 1 fail before 05-09; 1385 pass / 1 fail after this plan (pass count rose by the cases this plan added, 0 new failures).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-02 and WR-03 are closed for `vice_cia_get_state`. WR-05, WR-07, WR-09, WR-10 and the remaining WR-11 items remain out of scope, as this plan's own scope-discipline section specifies.
- All baseline gates confirmed unmoved: stock manifest 34 tools, fork manifest 62 tools, `package.json` `files[]` 44, `STOCK_DERIVED_TOOLS` size 9 (untouched by this plan), `node scripts/check-skill-tool-coverage.mjs` exit 0.
- `npm run test:automated`: 1385 pass / 1 fail (pre-existing, unrelated) / 5 todo / 1391 total.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*
