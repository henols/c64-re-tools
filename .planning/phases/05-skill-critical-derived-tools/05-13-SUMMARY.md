---
phase: 05-skill-critical-derived-tools
plan: 13
subsystem: docs-and-traceability
tags: [gap-closure, requirements-traceability, wr-12, wr-13, doc-correctness]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-09's resolveRequiredBank()/io-bank fix for vice_vicii_get_state/vice_cia_get_state, 05-10's io/ram-bank fix + legend split for vice_sprite_get/vice_sprite_inspect, 05-11's WR-01/WR-08 fixes in stock-symbols.ts, and 05-12's confounded-joystick/invalid-BCD fixes in stock-cia.ts -- all four landed and asserted against their shipped field names, not predicted"
provides:
  - "docs/stock-vice-parity.md item 5 records the io/ram bank resolution, the reported bank/registerBank/dataBank fields, the refusal behaviour, the dated 2026-08-17 CPU-view hazard, and the VIC-bank-3 I/O-window note"
  - "docs/stock-vice-parity.md and observation-hazards.md both label the side-effect claim VERIFIED (wire body) / ASSUMED (emulator read path) -- the word 'provably' is gone from both files entirely"
  - "observation-hazards.md tells an agent to distrust a bank-less chip-state/sprite answer whenever $01 may not have been $37"
  - "REQUIREMENTS.md's DERIV-04/05/06 checkboxes, traceability rows and per-phase open count state the post-fix reality, with DERIV-05's premature Complete mark annotated rather than overwritten"
  - "vice_disk_read_sector reads CUT, not pending, in both stock-dispatch.ts's doc comment and the TRIMMED_TOOL_DECISIONS decision-id string that reaches the trimmed-tools test's own failure message"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VERIFIED/ASSUMED claim-splitting: a claim backed by a wire-body regression test is VERIFIED; a claim about the emulator's own unobserved behaviour is ASSUMED, never inherited as 'provably' from a live transcript"
    - "A premature requirement mark is annotated with a dated parenthetical naming what falsified it and what closed it for real, never quietly overwritten -- preserves the fact the document was wrong for a day"

key-files:
  created: []
  modified:
    - docs/stock-vice-parity.md
    - .claude/skills/c64-program-recon/references/observation-hazards.md
    - .planning/REQUIREMENTS.md
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "D-05-22 (from plan): downgrade the 'provably side-effect-free' prose to VERIFIED (sidefx:false on the wire, asserted by a regression test)/ASSUMED (the emulator's own MEM_GET read path honouring that flag, no probe recorded) rather than add a new live probe -- the honest label costs nothing and nothing's correctness currently depends on the stronger claim"
  - "D-05-23 (from plan): DERIV-05 stays [x] with an annotation naming its own premature history rather than flipping to [ ] and back -- preserves the fact the document was wrong for a day; DERIV-04 and DERIV-06 flip [ ] -> [x] with their own dated parentheticals citing the closing plans"
  - "D-05-24 (from plan): WR-13's fix is a one-line data-value change in stock-dispatch.test.ts's TRIMMED_TOOL_DECISIONS (the decision-id string reaches the test's own assertion failure message), not a comment -- distinct from the genuine comment-only edit in stock-dispatch.ts's deliberately-not-registered doc block"
  - "Two unrelated 'provably unrecoverable' occurrences (about vice_keyboard_restore, unrelated to the side-effect claim) were reworded to 'confirmed unrecoverable' to satisfy the plan's own file-wide grep -ci 'provably' -> 0 acceptance gate, without changing their meaning"
  - "The 'Open requirements per phase' Phase 5 count was recomputed to 0, not merely edited to remove DERIV-04/05/06 -- doing so surfaced a second stale number: DERIV-01 was already [x] Complete but still listed as 'open' in that line, fixed in the same edit per the plan's own instruction"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-17
---

# Phase 05 Plan 13: WR-12/WR-13 gap closure and REQUIREMENTS.md reconciliation Summary

**Recorded the io/ram banking hazard and downgraded an overstated "provably side-effect-free" claim to VERIFIED/ASSUMED in the parity ledger and the skill hazard reference (WR-12); reconciled `REQUIREMENTS.md`'s DERIV-04/05/06 marks with the four landed fix plans and settled the `vice_disk_read_sector` pending-vs-CUT disagreement between `stock-dispatch.ts` and its test (WR-13).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-17 (base reset to `3b226d1`)
- **Completed:** 2026-08-17
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- `docs/stock-vice-parity.md` item 5 now names which memory view each stock chip-state/sprite answer read: `BANKS_AVAILABLE`-resolved `io` for register reads, `ram` for VIC-fetched sprite data; the answer fields each tool actually reports (`bank:{id,name}` for VIC-II/CIA, `registerBank`/`dataBank` for sprites); the explicit refusal behaviour when a required bank is absent; the dated (2026-08-17) CPU-view hazard that made every pre-fix answer silently wrong rather than marked unavailable; and the VIC-bank-3 I/O-window note.
- Both the parity ledger and `.claude/skills/c64-program-recon/references/observation-hazards.md` replace "**provably** side-effect-free" with the accurate split: `sidefx:false` is **VERIFIED** on the wire body by a regression test; whether stock VICE's `MEM_GET` read path actually honours it for the four clear-on-read registers is **ASSUMED**, with no probe recorded in this repo. The hazards reference also gains agent-facing guidance: distrust a chip-state/sprite answer with no bank field whenever `$01` may not have been `$37`.
- Two unrelated "provably unrecoverable" occurrences describing `vice_keyboard_restore` (a different, pre-existing claim in the same file) were reworded to "confirmed unrecoverable" so the file-wide `grep -ci provably` gate the plan's own acceptance criteria requires holds at `0`.
- `REQUIREMENTS.md`: DERIV-04 and DERIV-06 flip `[ ]` Pending -> `[x]` Complete with dated parentheticals naming plans 05-11 and 05-10 respectively; DERIV-05 stays `[x]` and gains a parenthetical naming that its earlier mark was premature (falsified by `05-VERIFICATION.md`'s CR-01 finding) and genuinely complete only after 05-09 and 05-12. All three traceability rows move `Pending` -> `Complete (<plans>)`. The "Open requirements per phase" line drops Phase 5 to `0`, and in doing so surfaced and fixed a second stale number: `DERIV-01` was already `[x]` Complete but still listed as "open" in that line.
- `vice_disk_read_sector`'s `(Phase 5)` annotation is corrected to `CUT from scope 2026-08-17 -- no skill calls it` in both `stock-dispatch.ts`'s deliberately-not-registered doc comment (a genuine comment-only edit) and `stock-dispatch.test.ts`'s `TRIMMED_TOOL_DECISIONS` decision-id string (a one-line data-value change, since that string is interpolated into the trimmed-tools test's own assertion failure message) -- now agreeing with `docs/stock-vice-parity.md` item 6.

## Task Commits

1. **Task 1: Record the banking hazard and correct the side-effect claim in the parity ledger and the skill reference** - `271f26e` (docs)
2. **Task 2: Reconcile REQUIREMENTS.md with the post-fix reality and settle the vice_disk_read_sector comment** - `7bfae11` (docs)

_No plan-metadata commit yet -- this is a worktree-isolated executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `docs/stock-vice-parity.md` - item 5 gains the "Which memory view the answer read" paragraph (BANKS_AVAILABLE resolution, reported field names, refusal behaviour, dated hazard, I/O-window note) and its "DERIV-05 stock GAIN" paragraph is rewritten to the VERIFIED/ASSUMED split; two unrelated "provably" occurrences (item 7, keyboard-restore) reworded to "confirmed" to satisfy the file-wide zero-provably gate
- `.claude/skills/c64-program-recon/references/observation-hazards.md` - the stock paragraph in "3. Registers that clear when you read them" gains the VERIFIED/ASSUMED split and the bank-naming/no-bank-field-is-suspect guidance, appended to the existing paragraph rather than a new section
- `.planning/REQUIREMENTS.md` - DERIV-04/05/06 checklist lines, their traceability rows, the Coverage block's complete/open counts (33/14 -> 35/12), and the Open-requirements-per-phase line for Phase 5 (4 -> 0, also fixing the stale DERIV-01 double-count)
- `.claude/mcp/vice/stock-dispatch.ts` - one comment line in the deliberately-not-registered doc block: `vice_disk_read_sector (Phase 5)` -> `(CUT from scope 2026-08-17 -- no skill calls it; see ROADMAP.md ... and docs/stock-vice-parity.md item 6)`
- `.claude/mcp/vice/stock-dispatch.test.ts` - one data-literal line in `TRIMMED_TOOL_DECISIONS`: `["vice_disk_read_sector", "Phase 5"]` -> `["vice_disk_read_sector", "CUT from scope 2026-08-17 -- no skill calls it"]`; array membership (12 entries) and `DELIBERATELY_ABSENT_TOOL_NAMES` (8 entries) unchanged

## Decisions Made

- Followed D-05-22, D-05-23 and D-05-24 exactly as specified in the plan (see key-decisions above).
- Extended the plan's file-wide `grep -ci provably -> 0` gate to two occurrences the plan's `<action>` section did not explicitly name (both describing `vice_keyboard_restore`'s unrecoverability, unrelated to the side-effect claim this plan targets) -- the acceptance criterion is literally file-wide, not scoped to item 5, so both had to be reworded for the gate to pass. Meaning preserved; "provably" replaced with "confirmed."
- Recomputed the Phase 5 "Open requirements per phase" count to `0` rather than mechanically dropping only DERIV-04/05/06 from the list, per the plan's own instruction to recompute rather than edit the list alone -- this surfaced and fixed the second stale number (DERIV-01 double-counted as open).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two unrelated "provably" occurrences in `docs/stock-vice-parity.md` (item 7, describing `vice_keyboard_restore`) would have failed the plan's own file-wide `grep -ci provably docs/stock-vice-parity.md` -> `0` acceptance criterion**
- **Found during:** Task 1, verifying the acceptance criteria after the item-5 edit
- **Issue:** The plan's `<action>` section only names item 5's "provably side-effect-free" claim for correction, but its `<acceptance_criteria>` and `<verify>` blocks assert zero occurrences of "provably" anywhere in the file. A separate, unrelated pair of sentences about `vice_keyboard_restore`'s unrecoverability also used "provably," which would have left the gate failing.
- **Fix:** Reworded both occurrences from "provably unrecoverable" to "confirmed unrecoverable," preserving the sentence's meaning (a fact established via `scripts/check-skill-tool-coverage.mjs`'s extraction, not a probabilistic claim) without touching the surrounding CR-01/keyboard-restore content this plan does not otherwise scope.
- **Files modified:** `docs/stock-vice-parity.md`
- **Verification:** `grep -ci provably docs/stock-vice-parity.md` returns `0`.
- **Committed in:** `271f26e` (Task 1 commit)

**2. [Rule 1 - Bug] `grep -c 'I/O window' docs/stock-vice-parity.md` initially returned `0` because the phrase was split by a Markdown bold-marker/line-wrap boundary (`**I/O\n   window**`)**
- **Found during:** Task 1, verifying the acceptance criteria
- **Issue:** The first draft of the new hazard paragraph wrapped the bold span across a line break exactly between "I/O" and "window," so the literal three-character-plus-space string `I/O window` never appeared contiguously and the acceptance grep failed.
- **Fix:** Reflowed the sentence so `**I/O window**` sits together on one line.
- **Files modified:** `docs/stock-vice-parity.md`
- **Verification:** `grep -c 'I/O window' docs/stock-vice-parity.md` returns `1`.
- **Committed in:** `271f26e` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both discovered by literally running the plan's own acceptance-criteria greps rather than assuming the prose satisfied them)
**Impact on plan:** No scope creep -- both fixes are wording-only corrections inside the same two files and same task the plan already targets, made to satisfy the plan's own stated, literal acceptance gates.

## Issues Encountered

- This worktree's `.claude/mcp/vice/node_modules` was not provisioned (empty directory) when first attempting `npm run test:automated` -- the `SessionStart` hook that normally runs `npm ci` had not fired for this worktree, producing 29 unrelated failures (broker/singleton/installed-tree tests failing on missing dependencies, not on this plan's doc/comment-only changes). Ran `npm ci` manually; the suite then reported the documented baseline exactly: 1385 pass / 1 fail (pre-existing, unrelated `repo-root.test.ts` worktree-path assertion) / 5 todo / 1391 total. No code change; not a deviation from this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-12 and WR-13 (the two verification gaps from `05-VERIFICATION.md` and `05-REVIEW.md` that no code plan closed) are closed.
- `REQUIREMENTS.md`'s DERIV-04/05/06 checklist, traceability table and Phase 5 open count now agree with each other and with the four landed fix plans (05-09..05-12); the earlier premature DERIV-05 mark is annotated, not erased.
- All baseline gates confirmed unmoved: stock manifest 34 tools, fork manifest 62 tools, `package.json` `files[]` 44, `STOCK_DERIVED_TOOLS` size 9 (untouched), `node scripts/check-skill-tool-coverage.mjs` exit 0, `cd .claude/mcp/vice && npm run typecheck` clean.
- `npm run test:automated`: 1385 pass / 1 fail (pre-existing, unrelated) / 5 todo / 1391 total -- unchanged from the 05-12 baseline, confirming this plan's edits added no test and broke none.
- `git diff -- .claude/mcp/vice/` between this plan's base (`3b226d1`) and its final commit shows only comment-line and one data-literal-line changes in `stock-dispatch.ts`/`stock-dispatch.test.ts` -- no handler, schema, manifest, `files[]`, dispatch-table or test-membership change, as the plan requires.
- This is the last plan in Phase 05 per its own `wave: 8`/gap-closure framing; no further Phase 05 plans are outstanding.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*
