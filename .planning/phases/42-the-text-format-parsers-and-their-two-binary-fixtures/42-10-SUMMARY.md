---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 10
subsystem: testing
tags: [text-monitor, io-registers, drift-detection, tdd, gap-closure]

requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: textmon-registers.ts's io parser, its planted-control test convention, and 42-VERIFICATION.md's CR-01 finding
provides:
  - "A required-keys completeness gate in decodeProseLines() that refuses incomplete-decoded-state by name (listing every absent field) rather than casting a possibly-incomplete object onto IoDecodedState"
  - "REQUIRED_IO_DECODED_KEYS, an exported, source-census-proven guard list of IoDecodedState's 19 required fields"
  - "Parser-level and handler-level (end-to-end) proof that a dropped, renamed, or emptied io decoded-prose block refuses rather than answers"
affects: [42-11, 42-12, 42-13, 42-14]

actuals:
  tokens: 4592
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Required-keys completeness gate: filter a REQUIRED_*_KEYS constant against an accumulated Partial<Record<...>> state object using `in`, refuse by name listing absent keys, before the unchecked cast that used to hide the gap"
    - "Interface-vs-constant census: read the owning module's own source with readFileSync, extract an interface's declared readonly field names by regex, and assert set-equality with the exported guard constant in both directions -- keeps the guard honest as the interface evolves, mechanically rather than by review"

key-files:
  created: []
  modified:
    - src/mcp/vice/textmon-registers.ts
    - src/mcp/vice/textmon-registers.test.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/textmon-seam.test.ts

key-decisions:
  - "New refusal code incomplete-decoded-state, not a reuse of unparseable-value -- the two report different drift shapes (a bad value on a present line vs. a field never observed at all) and collapsing them would make the refusal set lie about which drift shape occurred."
  - "The gate is unconditional and its one known transient consequence (a non-VIC-II chip section will now refuse incomplete-decoded-state with all 19 names instead of sprite-column-count, until 42-11's chip gate lands) is named rather than discovered -- no test in this plan pins that behaviour, since 42-11 replaces it deliberately."
  - "No handler edit was needed for this gap -- handleIoRegisters's existing parse-refusal branch already renders any refusal code by name; proven by a new handler-level test, not assumed."

requirements-completed: [PARSE-03, PARSE-04]

coverage:
  - id: D1
    description: "Task 1 (tracer): decodeProseLines() refuses incomplete-decoded-state naming the absent fields when a required io decoded-prose line is dropped, proven at both the parser and the handleIoRegisters tool-handler layer"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-registers.test.ts#planted control (CR-01): a decoded-prose block missing its Colors: line refuses with incomplete-decoded-state naming borderColor and backgroundColor -- paired with the real-capture discriminating control"
        status: pass
      - kind: unit
        ref: "text-tools.test.ts#handleIoRegisters: a decoded-prose block missing its Colors: line refuses end-to-end, naming incomplete-decoded-state and the two absent fields, never a serialized answer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: the remaining drift shapes (rename, empty block, single-field removal, two-field-removal ordering determinism), refusal-arm idempotency, and a source census proving REQUIRED_IO_DECODED_KEYS equals IoDecodedState's own declared field set"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-registers.test.ts#interface census: REQUIRED_IO_DECODED_KEYS equals IoDecodedState's own declared field set, read from this module's real source -- what stops a field added to the interface later from silently re-opening CR-01"
        status: pass
      - kind: unit
        ref: "textmon-registers.test.ts (5 additional planted-control/idempotency cases, all pass)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 10: io Required-Fields Completeness Gate (CR-01) Summary

**Closed CR-01 -- `decodeProseLines()` no longer casts a possibly-incomplete object onto `IoDecodedState`; a dropped, renamed, or emptied required decoded-prose field now refuses `incomplete-decoded-state` by name, proven at the parser and the tool-handler layer, with a source census keeping the guard's key list honest.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-09T18:18:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `decodeProseLines()` in `textmon-registers.ts` gained a required-keys completeness gate immediately before its former unchecked `state as IoDecodedState` cast: it filters the new exported `REQUIRED_IO_DECODED_KEYS` (19 keys, `IoDecodedState`'s own declaration order) against the accumulated state via the `in` operator, and refuses `incomplete-decoded-state` naming every absent field, comma-separated, in declaration order, when any are missing.
- `IoRegistersRefusalCode` gained the ninth member `incomplete-decoded-state`; the module header's "THREE OUTCOMES" paragraph became "FOUR OUTCOMES" and a new "WHAT NOT TO DO" bullet forbids restoring the unchecked cast or defaulting an unobserved field.
- The tracer (Task 1) proved the fix end to end: a parser-level control (the real `register-decode-stock` capture with its `Colors:` line removed) and a handler-level control (`handleIoRegisters` dialed against the same drifted reply) both refuse by name, with no handler code change required -- `handleIoRegisters`'s existing parse-refusal branch already surfaces any refusal code.
- Task 2 covered the remaining drift shapes named in `42-VERIFICATION.md`'s Criterion 4 gap: a spelling-only rename (`Colors:` -> `Colours:`), an entirely empty decoded-prose block (all 19 names, counted not string-matched), a single-recogniser removal (`VC $`, naming exactly `vc`/`vcbase`/`vmli`/`phi1`), a two-field-removal ordering-determinism case (byte-identical messages across two parses, names in declaration order), refusal-arm idempotency, and the interface census that reads `IoDecodedState`'s declared fields off this module's real source and asserts set-equality with `REQUIRED_IO_DECODED_KEYS` in both directions.
- Corrected the now-stale `textmon-registers.ts:220/226` line-number citation in `textmon-seam.test.ts`'s "IO registers" `FORMAT_OWNERS` entry to `:236/242` (Task 1's new constant shifted `DUMP_ROW_PREFIX_RE`/`DUMP_ROW_RE` down) -- no consumer-set change.

## Task Commits

1. **Task 1: One drifted io reply, refused end to end** - `bcbd8149` (feat) -- the completeness gate, its refusal code, the parser-level and handler-level tracer proof.
2. **Task 2: The remaining drift shapes, the interface census, and determinism** - `7622e561` (test) -- rename/empty/second-recogniser/ordering/idempotency controls, the interface census, the seam-test citation fix.

**Plan metadata:** committed separately below (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `src/mcp/vice/textmon-registers.ts` - the completeness gate, `REQUIRED_IO_DECODED_KEYS`, the new refusal code, and updated header comments.
- `src/mcp/vice/textmon-registers.test.ts` - 7 new test cases (1 in Task 1, 6 in Task 2: rename, empty-prose, second-recogniser, ordering determinism, refusal-arm idempotency, interface census).
- `src/mcp/vice/text-tools.test.ts` - 1 new handler-level test (`handleIoRegisters` refuses the drifted reply end to end); no new import added.
- `src/mcp/vice/textmon-seam.test.ts` - corrected the stale line-number citation in the "IO registers" `FORMAT_OWNERS` entry's comment.

## Decisions Made

- **New refusal code, not a reuse of `unparseable-value`** (recorded in `42-10-PLAN.md`'s own `<plan_decisions>`, executed as specified): `unparseable-value` is a per-line fact with a real offending line; `incomplete-decoded-state` is a per-block fact whose whole content is the set of names that never arrived. Collapsing them would make the closed refusal set lie about which drift shape occurred.
- **The gate is unconditional**, and the transient consequence for non-VIC-II chip sections (until 42-11's chip gate lands) is named rather than discovered or tested around -- no test in this plan pins that soon-to-change behaviour.
- **No handler edit needed** -- proven by the new `text-tools.test.ts` case, not assumed.

## Deviations from Plan

### Auto-fixed Issues

None -- the fix and its tests were built exactly as `42-10-PLAN.md` specified: no bugs, missing critical functionality, or blocking issues were discovered beyond what the plan itself already named (CR-01).

### Implementation clarification (not a rule violation)

Task 2's action text for the rename control ("Colors:" -> "Colours:") asked to "assert two things at once -- the renamed line is preserved verbatim in `unrecognisedLines` on no successful parse (the parse refuses), and the refusal is `incomplete-decoded-state`". On inspection, `IoRegistersParseResult`'s `ok: false` arm carries only `{ code, message, line, lineNumber }` -- it has no `unrecognisedLines` field; that field only exists on the `ok: true` arm's `IoRegisters.unrecognisedLines`. The internal `unrecognisedLines` array `decodeProseLines()` receives by reference IS pushed onto for the renamed line before the completeness check fires, but that mutation is not observable through `parseIoRegisters`'s return value on a refusal, so it cannot be asserted from the test. The test instead satisfies the plan's own binding acceptance criterion verbatim: it asserts `refusal.code === "incomplete-decoded-state"` and that the message names `borderColor` and `backgroundColor`, which is the externally-observable proof that the renamed line was NOT recognised (an `unparseable-value` refusal, which WOULD indicate recognition of a malformed `Colors:` line, did not fire instead).

---

**Total deviations:** 0 auto-fixed. One implementation clarification, documented above, with no code or test-coverage impact -- the plan's binding acceptance criterion for this case was satisfied exactly.
**Impact on plan:** None. No scope creep, no unmet acceptance criteria.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Evidence (per plan's `<output>` instructions)

**Verbatim refusal message, the `Colors:`-removed control (Task 1):**

```json
{
  "ok": false,
  "refusal": {
    "code": "incomplete-decoded-state",
    "message": "io: the decoded-prose block spanning lines 7-11 did not carry every required field -- absent: borderColor, backgroundColor -- never returned as a complete decode",
    "line": "",
    "lineNumber": 7
  }
}
```

**Two real line numbers written into the `textmon-seam.test.ts` citation:** `DUMP_ROW_PREFIX_RE` is now at line 236, `DUMP_ROW_RE` at line 242 (previously 220/226; Task 1's new `REQUIRED_IO_DECODED_KEYS` constant and its doc comment shifted both down).

**`pgrep -af '[v]ice-broker|[x]64sc'` output immediately before the `npm run test:automated` gate run (Task 2), verbatim:** empty (no process line printed); exit code 1 (grep found nothing), confirmed both before Task 2's work began and again immediately before the gate run below.

**`npm run test:automated` measured at plan end** (clean environment, confirmed via the pgrep line above):

```
tests 3921 | suites 24 | pass 3907 | fail 3 | cancelled 0 | skipped 6
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- both exactly the documented pre-existing 3-failure floor (`42-VERIFICATION.md`'s orchestrator addendum), no new failing file introduced by this plan.

**`npm run test:automated` at plan start:** not independently re-measured with a fresh command invocation before this plan's edits began (only the environment-cleanliness `pgrep` precondition was checked at that point, per the plan's own Task 2 precondition). The most recent prior measurement is `42-VERIFICATION.md`'s orchestrator addendum, taken the same day in a confirmed-clean environment: `anno-import.test.ts` (1), `anno-register.test.ts` (2) -- the same 3-failure floor this plan's end-of-plan measurement reproduces exactly, with the same two failing files. Disclosed here rather than silently assumed identical.

## Next Phase Readiness

- CR-01 is closed. Criterion 4 (PARSE-03) is now satisfied for `io`'s decoded-prose section specifically; the plan's own `must_haves.truths` are all satisfied by real code (completeness gate, exported guard, source census, deterministic ordered message, idempotency, no module-scope mutable state added).
- Next: 42-11 (the chip-gate plan this plan's own `<plan_decisions>` names as replacing the transient non-VIC-II-chip consequence), then 42-12, 42-13, 42-14 per the existing gap-closure sequence.
- No blockers.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
