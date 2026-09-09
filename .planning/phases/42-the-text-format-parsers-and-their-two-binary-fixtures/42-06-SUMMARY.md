---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 06
subsystem: documentation
tags: [vice, drift-citations, evidence-record, requirements, roadmap, claude-md]

# Dependency graph
requires:
  - phase: 42
    provides: "plan 42-01's real fixture captures and the 39,937-occurrence uninitialized-read correction; plan 42-05's already-shipped text-capability-probe.ts and its own build-guard implementation, which this plan's correction had to agree with"
provides:
  - "docs/phase42-text-format-drift-citations.md -- this phase's own citation record: every drift claim with its file, line, raw quoted line, source tree, and an honest source-traced/measured label"
  - "Corrected drift attributions in ROADMAP.md, REQUIREMENTS.md and CLAUDE.md: chis's cycle-column change re-attributed 3.0 -> 3.5-3.6, memmapshow's access-class addition re-attributed 3.5 -> 3.9-3.10, the mc/ms glyph inversion at 3.4 confirmed unchanged, and the build-guard claim corrected from 'each command has its own guard' to the actual two-share-one/two-have-none/one-degrades-differently shape"
affects: [42-07, 42-08, 42-09]

# Actuals (#2632)
actuals:
  tokens: 9800
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent re-verification of a research document's own citations before landing them in normative docs -- every file-and-line citation in this plan was re-read directly from the two host-local VICE source/NEWS trees with sed -n/grep -n during this plan's own execution, not copied from 42-RESEARCH.md's prose, and this caught two of that document's own line-number errors (see Deviations)"

key-files:
  created:
    - docs/phase42-text-format-drift-citations.md
  modified:
    - CLAUDE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Every citation in the evidence record was independently re-verified against the raw source trees during this plan, rather than trusted from 42-RESEARCH.md's own line numbers -- this caught two wrong citations in the research document itself: the chis cycle-column NEWS lines it cited (1185/780/334) were each a section-HEADER line, not the content line (corrected to 1393/1060/462); and its claim that the mon_memmap.c FEATURE_CPUMEMHISTORY conditional 'clos[es] at line 330' was wrong -- line 330 closes an unrelated nested `#if 0` dead-code block, and the actual top-level conditional's disabled branch runs from the #else at line 422 to the #endif at line 459"
  - "The shared disabled-stub string is quoted exactly once in the evidence record (inside the mon_memmap_stub() function body excerpt), with every other reference to it pointing back at that one quotation rather than re-typing the literal -- satisfying the plan's own 'quotes the shared string exactly once' acceptance criterion literally, not just in spirit"
  - "The corrected build-guard clause in all three normative documents states explicitly that PARSE-04's per-command-probing, cached-per-binary operative requirement is UNCHANGED by the correction, and that this evidence record's finding agrees with plan 42-05's already-shipped text-capability-probe.ts implementation -- the two were derived independently (this plan from re-read C source, 42-05 from its own implementation work) and cross-checked to agree rather than one citing the other as authority"

requirements-completed: [PARSE-03, PARSE-04]

coverage:
  - id: D1
    description: "Every drift citation this phase's defence rests on is quotable -- file, line, raw text, tree, and an honest label, with the one genuinely measured claim carrying its binaries and date"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "grep -ac source-traced docs/phase42-text-format-drift-citations.md -- 8 occurrences (>= 4 required)"
        status: pass
      - kind: unit
        ref: "grep -acE '^- +\\*\\*|:[0-9]+' docs/phase42-text-format-drift-citations.md -- 43 file-and-line-bearing lines (>= 12 required)"
        status: pass
      - kind: unit
        ref: "node --test docs-dangling-refs.test.ts docs-linerefs.test.ts -- 21/21 pass, both before and after this plan's edits"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two of the three version attributions corrected to what the NEWS files actually say; the third confirmed with two independent tree citations; nothing deleted or weakened"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "grep -aq 'do not share a single guard' CLAUDE.md / REQUIREMENTS.md -- both return non-zero (clause absent, as required)"
        status: pass
      - kind: unit
        ref: "grep -aq '3.0 widened' / '3.5 added a' across ROADMAP.md and REQUIREMENTS.md -- all four return non-zero (all absent, as required)"
        status: pass
      - kind: unit
        ref: "grep -acE '^- \\[ \\] \\*\\*PARSE-0[34]\\*\\*' REQUIREMENTS.md -- exactly 2, ids and unchecked boxes intact"
        status: pass
    human_judgment: false
  - id: D3
    description: "The build-guard correction (two-share-one, two-have-none, one-degrades-differently) is stated in all three normative documents and agrees with plan 42-05's already-implemented text-capability-probe.ts, with PARSE-04's per-command probing stated as unaffected"
    requirement: "PARSE-04"
    verification:
      - kind: manual_procedural
        ref: "Cross-read of 42-05-SUMMARY.md's Decisions Made section (io's two degradation strings as a render-time distinction, not a build-capability outcome) against this plan's own source re-verification of monitor.c:1983/1986/1998 -- both independently reach the identical conclusion"
        status: pass
    human_judgment: false
  - id: D4
    description: "git diff --stat shows no file outside this plan's four, no deletion over 30 lines per file, and the ROADMAP Progress table / plan checkboxes / Plans counter are untouched"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "git diff --stat -- CLAUDE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md -- 3 files, 6 insertions/6 deletions total, each file a single-line replacement or two"
        status: pass
      - kind: unit
        ref: "git diff -- .planning/ROADMAP.md -- exactly 3 changed lines (success criteria 4/5, one Notes entry); no Progress-table or checkbox line present in the diff"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 06: The Drift Citations Corrected and Made Quotable Summary

**A phase's own citation record with every drift claim independently re-verified against two host-local VICE source/NEWS trees (catching two wrong line numbers in the phase's own research document along the way), landing corrected version attributions and a corrected build-guard claim into ROADMAP.md, REQUIREMENTS.md and CLAUDE.md without deleting or weakening anything.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-09T13:42:00Z (approx, first Read call)
- **Completed:** 2026-09-09T14:02:06Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `docs/phase42-text-format-drift-citations.md` (316 lines): six blocks — the `chis` cycle-column change (corrected to VICE 3.5/3.6), the `memmapshow` access-class addition (corrected to VICE 3.9/3.10), the `mc`/`ms` glyph inversion at 3.4 (confirmed, two independent tree citations), the build guards (corrected to two-share-one/two-have-none/one-degrades-differently), the one genuinely measured claim (no command in the fixture batch refused, on either of two named binaries, dated), and the skill-placement finding (naming `c64-program-recon` and `vice-wedge-triage`, and why neither's text changes here)
- Every citation independently re-verified against the raw files during this plan's own execution — not copied from `42-RESEARCH.md`'s prose — which caught two of that document's own wrong line-number citations (see Deviations)
- Three normative documents corrected in place: `.planning/ROADMAP.md` (Phase 42 success criteria 4 and 5, plus the Note that asked for this re-check), `.planning/REQUIREMENTS.md` (`PARSE-03`'s and `PARSE-04`'s parentheticals), `CLAUDE.md` (the `CPUHISTORY_GET` dependency constraint's guard-sharing clause) — every correction narrows or re-attributes, never deletes, and cites the evidence record

## Task Commits

1. **Task 1: The evidence record — every citation with its raw line, its tree and its label** - `746960e3` (docs)
2. **Task 2: The three normative documents corrected, with nothing deleted and nothing weakened** - `c9eae707` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `docs/phase42-text-format-drift-citations.md` - The evidence record: six blocks, every citation independently re-verified this plan, raw text quoted for each
- `CLAUDE.md` - The `CPUHISTORY_GET` dependency constraint's guard-sharing clause corrected; the opcode version floor and its existing scoping clause untouched
- `.planning/ROADMAP.md` - Phase 42 success criteria 4 and 5 corrected; the Note that asked for the re-check now records that it happened; Progress table, plan checkboxes and Plans counter untouched
- `.planning/REQUIREMENTS.md` - `PARSE-03` and `PARSE-04` parentheticals corrected; ids, checkbox states and operative requirements unchanged

## Decisions Made

- **Independently re-verified every citation rather than trusting `42-RESEARCH.md`'s own line numbers.** This caught two real errors in the research document (see Deviations) before they could have propagated into shipped documentation a second time — the exact failure mode this plan exists to close.
- **The shared disabled-stub string is quoted exactly once**, inside the `mon_memmap_stub()` function-body excerpt; every other reference to it points back at that one quotation instead of re-typing the literal, satisfying the acceptance criterion's "exactly once" wording literally rather than approximately.
- **The build-guard correction is cross-checked against plan `42-05`'s already-shipped `text-capability-probe.ts`** rather than asserted in isolation — `42-05`'s own implementation-time decision (`io`'s two degradation strings are a render-time distinction, not a build-capability outcome) was reached independently from this plan's own source re-verification, and both agree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `42-RESEARCH.md`'s own `chis` cycle-column citations pointed at NEWS section headers, not the content lines**

- **Found during:** Task 1, independently re-verifying the research document's citations against the raw `vice-3.8/NEWS` file before writing them into the evidence record
- **Issue:** The research document cited the three `chis` cycle-column events at `NEWS:1185`, `NEWS:780`, and `NEWS:334`. Directly reading those three lines showed each is a section-HEADER line (`* Changes in Vice 3.5` / `3.6` / `3.7`), not the actual content line describing the change. `grep -n "chis\|cycle"` scoped to each section's own line range located the real content lines at 1393 (3.5, first appearance), 1060 (3.6, 12-digit widening), and 462 (3.7, the correctness fix).
- **Fix:** Cited the correct content lines (1393/1060/462) in the evidence record, with the section-header lines (1185/780/334) cited separately as the section boundary that locates them — and documented the correction explicitly in the evidence record itself so a future reader sees the discrepancy, not just this SUMMARY.
- **Files modified:** `docs/phase42-text-format-drift-citations.md` (caught before the first write of the file reached its final form; no separate remediation commit needed)
- **Verification:** `sed -n '1393p;1060p;462p' NEWS` in the vice-3.8 tree, re-run after writing the record, confirms all three lines read exactly as quoted.
- **Committed in:** `746960e3` (Task 1 commit; the fix predates the commit)

**2. [Rule 1 - Bug] `42-RESEARCH.md`'s claim that the `mon_memmap.c` `FEATURE_CPUMEMHISTORY` conditional "clos[es] at line 330" was wrong — line 330 closes an unrelated nested block**

- **Found during:** Task 1, independently re-verifying the build-guard citations against `mon_memmap.c` before writing the build-guards block
- **Issue:** `grep -n "^#if\|^#else\|^#endif" mon_memmap.c` showed the file's actual conditional structure: `#ifdef FEATURE_CPUMEMHISTORY` opens at line 52; a NESTED `#if 0` (dead code, unrelated) opens at line 323 and closes at line 330; the top-level conditional's own `#else` branch (the disabled-build stub implementation) opens at line 422 and the whole conditional closes at line 459. The research document's "closing at line 330" citation pointed at the nested block's `#endif`, not the top-level conditional's.
- **Fix:** Cited the correct structure in the evidence record — conditional opens at 52, disabled branch spans 422–459 — and documented the correction explicitly, naming which line was misattributed and why (a nested `#if 0` block inside the enabled branch, not the top-level conditional's own close).
- **Files modified:** `docs/phase42-text-format-drift-citations.md`
- **Verification:** `grep -n "^#if\|^#else\|^#endif" mon_memmap.c` in the vice-3.8 tree, re-run after writing the record, confirms the five-line structure exactly as cited.
- **Committed in:** `746960e3` (Task 1 commit)

**3. [Rule 1 - Bug] An in-progress editing artifact ("WAIT: corrected path below") leaked into the first `Write` of the evidence record**

- **Found during:** Task 1, the mandatory NUL-byte/content self-check immediately after the initial `Write` call
- **Issue:** While drafting the glyph-inversion block, a self-correction of a typo'd path (`/home/henrio/...` vs `/home/henrik/...`) was left inline as visible prose ("— WAIT: corrected path below. ...") instead of being cleanly resolved before the file was written.
- **Fix:** Removed the artifact with a follow-up `Edit`, leaving a single clean citation sentence.
- **Files modified:** `docs/phase42-text-format-drift-citations.md`
- **Verification:** `grep -n "WAIT" docs/phase42-text-format-drift-citations.md` returns no match after the fix.
- **Committed in:** `746960e3` (Task 1 commit; the fix predates the commit — caught before any commit was made)

---

**Total deviations:** 3 auto-fixed (all Rule 1, all caught and fixed before the Task 1 commit — none reached a shipped state uncorrected).
**Impact on plan:** All three are corrections to citation accuracy, exactly the class of error this plan's independent-re-verification discipline exists to catch. No scope creep; no acceptance criterion weakened.

## Issues Encountered

None beyond the deviations documented above.

## Measured Automated-Gate Baseline (plan's own requirement)

This plan is documentation-only (zero source or test files touched), so the baseline measured
at plan start and the baseline after both commits are the same measurement, run once after both
task commits landed:

`cd src/mcp/vice && npm run test:automated` — **exit 1, 3851 tests, 3836 pass, 4 fail**:
- `anno-import.test.ts` — 1 failure (documented floor)
- `anno-register.test.ts` — 2 failures (documented floor)
- `audit-root-args.test.ts` — 1 failure (the documented intermittent flake; project note records this test "passes in isolation" and appears 0–2 times depending on scratch-file timing)

This is exactly the documented floor (3, `anno-register`/`anno-import`) plus the documented
intermittent `audit-root-args` flake within its known 0–2 range — no new failing file, no
failure count exceeding the documented ceiling. Running on the main tree (sequential mode, not
a worktree), so none of the worktree-path artifacts (`repo-root.test.ts`, `dxa-seam.test.ts`)
that inflate the count in parallel-executor worktrees apply here.

## Diff Stat (plan's own requirement)

```
 .planning/REQUIREMENTS.md | 4 ++--
 .planning/ROADMAP.md      | 6 +++---
 CLAUDE.md                 | 2 +-
 3 files changed, 6 insertions(+), 6 deletions(-)
```

No file outside this plan's declared four; no single-file deletion anywhere near the 30-line
gate. `git diff` on `.planning/ROADMAP.md` shows exactly the three intended lines (success
criteria 4 and 5, one Notes entry) — the Progress table, every plan checkbox, and the `Plans`
counter line are absent from the diff, confirmed untouched.

## Corrected Claims, Before and After

| Claim | Before | After | Evidence record block |
|---|---|---|---|
| `chis` cycle-column change | "3.0 widened" | 3.5 (first appearance) + 3.6 (12-digit widening), with 3.7's cycle-value fix named separately as a fix, not a further widening | Block 1 |
| `memmapshow` access-class addition | "3.5 added a" | 3.9/3.10 (fork NEWS only; the only 3.8-tree mention is the feature's unrelated 2.0-era birth) | Block 2 |
| `mc`/`ms` glyph inversion | 3.4 | 3.4 — CONFIRMED unchanged, now with two independent tree citations | Block 3 |
| Build guards | "each command has its own guard" | two-share-one (`memmapshow`/`chis`), two-have-none (`bt`/`prof flat`), one-degrades-differently (`io`) — PARSE-04's per-command probing stated as unaffected | Block 4 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The evidence record and all three corrected normative documents are committed and ready for plans `42-07`/`42-08`/`42-09` (Wave 3/4) to build on without inheriting the two wrong version attributions or the refuted guard-sharing claim.
- No blockers for the next plan in this wave (`42-07`).
- This plan's own division-of-ownership boundary was respected: the ROADMAP's `Plans` counter, plan checkboxes and Progress-table row for Phase 42 were left untouched, as instructed — they belong to the orchestrator, not this plan.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `docs/phase42-text-format-drift-citations.md`
- FOUND: `CLAUDE.md` (modified)
- FOUND: `.planning/ROADMAP.md` (modified)
- FOUND: `.planning/REQUIREMENTS.md` (modified)
- FOUND commit: `746960e3` (Task 1)
- FOUND commit: `c9eae707` (Task 2)
- Re-ran all `<acceptance_criteria>` across both tasks: PASS
- Re-ran the plan-level `<verification>` block (both citations present, both refuted clauses absent, both refuted attributions absent, `docs-linerefs.test.ts`/`docs-dangling-refs.test.ts` 21/21 pass, `npm run test:automated` at the documented baseline, `git diff --stat` names only this plan's four files): PASS
