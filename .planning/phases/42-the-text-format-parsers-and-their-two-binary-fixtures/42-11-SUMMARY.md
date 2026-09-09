---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 11
subsystem: testing
tags: [text-monitor, io-registers, chip-gate, gap-closure, tdd]

requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: textmon-registers.ts's io parser, its REQUIRED_IO_DECODED_KEYS completeness gate (42-10, CR-01), and 42-REVIEW.md's WR-02/IN-01 findings
provides:
  - "A chip gate in parseIoRegisters() that refuses a CIA1, CIA2 or SID section by its own name (unsupported-chip), stating its register dump read cleanly, rather than reporting it as a VIC-II section missing a sprite table"
  - "handleIoRegisters's parse-refusal branch renders unsupported-chip as the parser's own message under the tool name, with no parse-failure wrapper, while every other refusal code keeps the wrapper unchanged"
  - "vice_io_registers's published description discloses the VIC-II-only decode bound; inputSchema proven byte-unchanged by a machine-readable check"
  - "IN-01's discarded classifyTextCapabilityResponse('io', ...) call removed from handleIoRegisters; the invariant it implied stated in prose instead"
affects: [42-12, 42-13, 42-14]

actuals:
  tokens: 5100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Chip gate placement: refuse-by-chip-name check placed after the dump-row validation (so a drive-contaminated memspace still refuses unrecognised-memspace first) and before every layout check that would otherwise misread a legitimately different chip as a defect"
    - "Two-arm parse-refusal branch in a tool handler: one refusal code renders the parser's own message verbatim under the tool name (no wrapper), every other code keeps the shared wrapper -- so a legitimate external condition never reads as a defect in this project"

key-files:
  created: []
  modified:
    - src/mcp/vice/textmon-registers.ts
    - src/mcp/vice/textmon-registers.test.ts
    - src/mcp/vice/textmon-seam.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "Chip-conditional sprite/decoded-prose requirement (42-REVIEW.md's alternative (b)), not narrowing vice_io_registers's advertised address range (alternative (a)) -- this plan's own <plan_decisions> made that choice; executed exactly as specified, with no re-litigation."
  - "A two-section reply with one undecodable section refuses as a whole, carrying no value -- proven by the adjacency planted control, never a partial-section answer."
  - "The chip gate sits strictly after the dump-row validation and before the blank-separator check, so the memspace hazard (CLAUDE.md's documented default_memspace contamination) still outranks the chip gate -- proven by the precedence planted control."
  - "text-tools.test.ts's new malformed-dump-row control uses the real capture's \">C:\" dump-row marker; textmon-seam.test.ts's full-tree scan caught this as an undeclared literal consumer and was fixed by declaring the consumer, not by weakening the guard."

requirements-completed: [PARSE-02, PARSE-03]

coverage:
  - id: D1
    description: "Task 1: parseIoRegisters() refuses a CIA1/CIA2/SID chip section by name (unsupported-chip), stating the dump read cleanly and its base address, placed after the dump-row validation and before the blank-separator check so the memspace hazard still outranks it; a two-section reply with one undecodable section refuses as a whole"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-registers.test.ts#planted control (WR-02): CIA1 rename, SID rename, two-section adjacency, and memspace-precedence controls, each paired with the real-capture discriminating assertion -- all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: handleIoRegisters renders unsupported-chip as the parser's own message under the tool name with no parse-failure wrapper (every other code keeps the wrapper); vice_io_registers's published description discloses the VIC-II-only bound with inputSchema provably unchanged; IN-01's discarded classification call removed"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-tools.test.ts#handleIoRegisters (WR-02): a CIA1-renamed reply refuses end-to-end naming the chip and VIC-II, without the other codes' parse-failure wrapper phrasing -- pass"
      - kind: unit
        ref: "text-tools.test.ts#handleIoRegisters: a malformed dump row still refuses through the parse-failure wrapper, naming the code -- pass"
      - kind: other
        ref: "manifest check: python3 inline script over tools-manifest.stock.json -- min 0, max 65535, type integer, required [\"address\"], props [\"address\"], discloses_vicii true"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 11: The Chip Gate -- A Chip This Parser Does Not Model Is Refused By Its Own Name (WR-02, IN-01) Summary

**Closed WR-02 -- `parseIoRegisters()`'s sprite-table and decoded-prose requirements are now VIC-II-only; a CIA1, CIA2 or SID address (every one inside `vice_io_registers`'s own advertised 0-65535 range) is refused by the chip's own name with its dump reported as having read cleanly, never as a malformed VIC-II reply -- and IN-01's discarded classification call is gone.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-09T18:20:00Z
- **Completed:** 2026-09-09T19:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `VIC_II_CHIP_NAME` (`"VIC-II"`) and the new `IoRegistersRefusalCode` member `"unsupported-chip"` to `textmon-registers.ts`. `parseIoRegisters()` now refuses any non-VIC-II chip section immediately after the dump-row validation and before the blank-separator check -- the placement proven by a planted control showing the memspace hazard (CLAUDE.md's documented `default_memspace` contamination) still outranks the new gate.
- Four new parser-level planted controls in `textmon-registers.test.ts`: a CIA1-renamed header, a SID-renamed header, a two-section (VIC-II + CIA1) adjacency case proving the whole reply refuses with no partial value, and a memspace-precedence case -- each paired with the discriminating assertion that both real captures (stock, fork) still parse `ok: true` with one `VIC-II` section.
- `handleIoRegisters`'s parse-refusal branch in `text-tools.ts` now has two arms: `unsupported-chip` renders the parser's own message verbatim under the `vice_io_registers:` prefix with no additional wrapper; every other code keeps the existing `io's response could not be parsed (...)` wrapper unchanged.
- Removed IN-01's discarded `classifyTextCapabilityResponse("io", response)` call and its `void classification;` companion. The explanatory comment above it survives and gained the stated invariant: for this verb the classifier can return only `capable` or `indeterminate`, never `missing`.
- `vice_io_registers`'s published `description` in `tools-manifest.stock.json` gained one sentence disclosing the VIC-II-only decode bound. `inputSchema` is unchanged, proven by a machine-readable check (`address` keeps `minimum: 0`, `maximum: 65535`, `type: "integer"`; `required` is still exactly `["address"]`; no property added or removed).
- Two new handler-level tests in `text-tools.test.ts`: a CIA1-renamed reply asserting `isError: true` naming both the chip and `VIC-II`, with the other codes' wrapper phrasing absent; and a malformed-dump-row case asserting the wrapper phrasing IS present and the code named, proving the special case is scoped to `unsupported-chip` alone.
- `textmon-seam.test.ts`'s "IO registers" `FORMAT_OWNERS` line-number citation refreshed (`236/242` -> `252/258`) after Task 1's insertions moved `DUMP_ROW_PREFIX_RE`/`DUMP_ROW_RE` down; and `text-tools.test.ts` declared as a literal consumer of the `">C:"` marker -- caught live by the seam guard's own full-tree scan when Task 2's malformed-dump-row control landed, fixed by declaring the consumer rather than weakening the guard.

## Task Commits

1. **Task 1: The chip gate -- a chip this parser does not model is refused by its own name** - `ccb519c6` (feat) -- `VIC_II_CHIP_NAME`, `unsupported-chip`, the gate itself, four planted controls, the seam-citation refresh.
2. **Task 2: The tool stops dressing a chip fact as a parse failure, and stops computing an answer it throws away** - `6c15f288` (feat) -- the two-arm handler branch, IN-01's removal, the manifest description, two handler tests, the seam-guard literal-consumer declaration.

**Plan metadata:** committed separately below (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `src/mcp/vice/textmon-registers.ts` - `VIC_II_CHIP_NAME` constant, `unsupported-chip` refusal code, the chip gate itself, updated header/interface doc comments (including a new "WHAT NOT TO DO" entry).
- `src/mcp/vice/textmon-registers.test.ts` - 4 new planted-control tests (CIA1, SID, two-section adjacency, memspace precedence), each paired with the real-capture discriminating assertion.
- `src/mcp/vice/textmon-seam.test.ts` - refreshed the "IO registers" line-number citation comment; declared `text-tools.test.ts` as a literal consumer of `">C:"`.
- `src/mcp/vice/text-tools.ts` - two-arm parse-refusal branch in `handleIoRegisters`; removed the discarded `classifyTextCapabilityResponse` call, extended the surviving comment.
- `src/mcp/vice/text-tools.test.ts` - 2 new handler-level tests (CIA1 refusal, scoped-wrapper malformed-dump-row control); no new import added.
- `src/mcp/vice/tools-manifest.stock.json` - one appended sentence in `vice_io_registers`'s `description`; `inputSchema`/`outputSchema` untouched.

## Decisions Made

- **Chip-conditional requirement, not a narrowed schema** -- the plan's own `<plan_decisions>` settled this (alternative (b) over (a)) before execution began; executed exactly as specified.
- **Refuse the whole reply, never a partial section** -- proven live by the two-section adjacency control: the concatenated (VIC-II + CIA1) payload returns `ok: false` naming `CIA1`, with no `value` key present at all.
- **Gate placement is load-bearing** -- after the dump-row validation (memspace hazard outranks the chip gate), before the blank-separator/prose/sprite checks (so a CIA/SID section is never misread as a VIC-II layout defect). Both boundary conditions are proven by dedicated planted controls, not asserted by comment alone.
- **Seam-guard finding fixed by declaring, not suppressing** -- Task 2's malformed-dump-row test mutates a real capture carrying the `">C:"` marker; `textmon-seam.test.ts`'s own full-tree scan correctly flagged the file as an undeclared literal consumer. Fixed by adding the declaration with a reason, exactly the guard's intended failure mode working as designed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `textmon-seam.test.ts` full-tree scan flagged `text-tools.test.ts` as an undeclared literal consumer of the `"IO registers"` format's `">C:"` marker**
- **Found during:** Task 2 (after adding the malformed-dump-row scoped-wrapper test, which mutates a real capture containing `">C:"` dump rows)
- **Issue:** `textmon-seam.test.ts`'s "IO registers" `FORMAT_OWNERS` entry's `literalConsumers` list did not include `text-tools.test.ts`, so the guard's real full-tree scan (not a fixture) reported a genuine violation: `text-tools.test.ts contains the IO registers literal ">C:" but is not a declared literal consumer`.
- **Fix:** Added a `literalConsumers` entry for `text-tools.test.ts` with a reason citing this plan's malformed-dump-row control.
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` returns to `pass 33 / fail 0`.
- **Committed in:** `6c15f288` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The seam guard did exactly what it exists to do -- caught an undeclared consumer of tracked raw-text knowledge the instant this plan introduced one. No scope creep; the fix is a one-line declaration with a reason, not a change to the guard's behavior.

## Issues Encountered

An intermittent 4th failure (`audit-root-args.test.ts:982`) appeared in one `npm run test:automated` run during this plan's Task 2 gate measurement, alongside the expected `anno-import.test.ts`/`anno-register.test.ts` floor. Per this plan's own project-level constraint (the documented `zz-scratch` ENOENT race), the file was re-run alone and passed cleanly (`58 pass / 0 fail`), confirming the race rather than a regression from this plan's changes. A subsequent full-suite re-run settled back at exactly 3 failures (`anno-import.test.ts`, `anno-register.test.ts`), matching the documented floor with no other file affected -- see Evidence below for both readings.

## User Setup Required

None - no external service configuration required.

## Evidence (per plan's `<output>` instructions)

**Verbatim `unsupported-chip` refusal message, the CIA1 control (parser level, `parseIoRegisters()` on the real `register-decode-stock` capture with its header renamed `VIC-II:` -> `CIA1:`):**

```json
{
  "ok": false,
  "refusal": {
    "code": "unsupported-chip",
    "message": "io: chip \"CIA1\" is not supported -- its register dump read cleanly (64 bytes at $d000), but only \"VIC-II\" sections carry the decoded display state and sprite table this parser models -- dial an address covered by the VIC-II chip for a decoded answer",
    "line": "CIA1:",
    "lineNumber": 1
  }
}
```

**Verbatim user-facing text `handleIoRegisters({ address: 0xdc00 })` returned for the same drifted reply (handler level, real `withStubTextServer`/`makeDeps` harness, same shape as the committed test):**

```
vice_io_registers: io: chip "CIA1" is not supported -- its register dump read cleanly (64 bytes at $d000), but only "VIC-II" sections carry the decoded display state and sprite table this parser models -- dial an address covered by the VIC-II chip for a decoded answer
```

**Machine-readable manifest check's printed output, proving `vice_io_registers`'s `inputSchema` is unchanged and the bound is disclosed:**

```json
{"min": 0, "max": 65535, "type": "integer", "required": ["address"], "props": ["address"], "discloses_vicii": true}
```

**`npm run test:automated` figure at plan end, first reading (the intermittent race described above):**

```
tests 3927 | suites 24 | pass 3912 | fail 4 | cancelled 0 | skipped 6
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts`, `audit-root-args.test.ts` (line 982, the documented `zz-scratch` race). `audit-root-args.test.ts` re-run alone: `pass 58 / fail 0`.

**`npm run test:automated` figure, second reading (immediately re-run, environment reconfirmed clean via `pgrep -af '[v]ice-broker|[x]64sc'` printing nothing beforehand):**

```
tests 3927 | suites 24 | pass 3911 | fail 3 | cancelled 0 | skipped 8
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- exactly the documented pre-existing 3-failure floor, no new failing file introduced by this plan.

**`pgrep -af '[v]ice-broker|[x]64sc'` output immediately before every gate measurement above, verbatim:** empty (no process line printed); exit code 1, confirmed before Task 2 began and again before each of the two `test:automated` runs.

## Next Phase Readiness

- WR-02 is closed. `must_haves.truths` are all satisfied by real code: the chip gate refuses by name, states the positive dump-read-cleanly fact, refuses the whole reply on a two-section case, renders without the shared wrapper, and the published `inputSchema` is provably unchanged with the bound disclosed in the description. IN-01 is also closed (folded in per this plan's own decision).
- Both committed real captures (`register-decode-stock`, `register-decode-fork`) still parse `ok: true` with exactly one `VIC-II` section -- reconfirmed by every planted control's paired discriminating assertion and by the full `textmon-registers.test.ts` run (34/34 pass).
- Next: 42-12, 42-13, 42-14 per the existing gap-closure sequence (IN-02, in `textmon-profile.ts`, is documentation-only and addressed by 42-12 per this plan's own `<plan_decisions>`).
- No blockers.

## Self-Check: PASSED

All key files confirmed present on disk (`textmon-registers.ts`, `textmon-registers.test.ts`, `textmon-seam.test.ts`, `text-tools.ts`, `text-tools.test.ts`, `tools-manifest.stock.json`, this SUMMARY). All three commit hashes (`ccb519c6`, `6c15f288`, `307edbc0`) confirmed present in `git log --oneline --all`.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
