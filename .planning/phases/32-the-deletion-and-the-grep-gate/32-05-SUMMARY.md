---
phase: 32-the-deletion-and-the-grep-gate
plan: 05
subsystem: docs
tags: [census, provenance, grep-gate, nul-byte, counting-units, dated-records, evidence]

requires:
  - phase: 32-03
    provides: "CUT-06 part A — the 17 per-line r2000_ verdicts for .planning/PROJECT.md, the four-path ARCHITECTURE.md inventory, and the explicit :715 flag addressed to this plan"
  - phase: 32-01
    provides: "the grep -a NUL-byte finding, the audited-set reconciliation, and the recorded repo-root.test.ts worktree artifact"
provides:
  - "The CUT-06 sweep ledger: a declared, re-derivable 50-member swept set with exactly one verdict row per repo-relative path, each verdict derived from `git diff --exit-code d6bebb1 HEAD`"
  - "A measured resolution of Open Question 5: CONTEXT.md's 26 `r2000_` occurrences RECONCILES exactly as a case-insensitive occurrence count, overturning research's recorded disagreement"
  - "A measured disagreement with research's own 373/338 tree-wide totals (374/339 at 12a3a47, 376/341 at 345d5c4)"
  - "An explicit reasoned verdict for .planning/PROJECT.md:715, with the seven-zero measurement that makes it stale recorded rather than acted on"
  - "A reasoned, measured row for every excluded population — 311 phase artifacts, 10 research files, 27 other .planning sub-trees, 9 root documents, and the two non-folded todos"
  - "The 35-vs-37 clause-(a) cardinality finding: the plan's content-only census and the gate's own path+content predicate disagree by two files, both recorded"
affects: [32-06, 32-07, 32-08, 32-09]

actuals:
  tokens: 43000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Two-column verdict recording: a mechanically derived verdict (git diff exit code) kept separate from a `Changed by` attribution column, so a file changed for a non-CUT-06 reason is not mislabelled a correction"
    - "Publish-the-grid reconciliation: when a discussion-time figure does not match, measure BOTH counting units × BOTH case sensitivities × BOTH trees and publish all of them, rather than declaring a disagreement from two of the eight cells"
    - "Self-referential census disclosure: an evidence document that is itself inside the counted population states the count before and after its own commit, so neither figure reads as an error"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-document-sweep.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/32-05-SUMMARY.md
  modified: []

key-decisions:
  - "Recorded CONTEXT.md's 26 `r2000_` occurrences as RECONCILING, against the plan's explicit instruction to record it as DISAGREEING. Measurement beats prediction: `grep -aoi 'r2000_'` at the pre-sweep tree yields exactly 26 (23 lowercase + 3 uppercase R2000_ symbol names at PROJECT.md:748/751/753). Research tested two of the four counting definitions and not the third."
  - "Defined clause (a) with THREE measured sub-populations (35 content-only, 2 path-only, 4 shipped-untracked) rather than the single 35 the plan named, because the gate's own `subjectHits()` scans path AND text and therefore reaches 37 tracked files. Both cardinalities published under their own definition."
  - "Kept the verdict column strictly mechanical (`git diff --exit-code` exit code) and added a separate `Changed by` column. Three of the five `corrected` rows changed for reasons that are not CUT-06 corrections; collapsing the two would have implied corrections that did not happen."
  - "Resolved .planning/PROJECT.md:715 to KEEP on stronger ground than 32-03's tie-break — the sentence routes nobody — and recorded the measurement that makes it factually stale (0 `r2000_` occurrences across all seven playbooks) rather than either acting on it or omitting it."
  - "Derived the four shipped-twin verdicts by `cmp` against their `src/skills/**` sources rather than by `git diff`, because `installer/skills/` is gitignored and git is structurally silent on it."

patterns-established:
  - "Pattern: worktree re-anchoring is recorded, not just performed — the ledger's §0 states the resolved root, why the plan's hardcoded orchestrator path would have measured a different tree, and quotes every command as actually run"
  - "Pattern: an excluded population is a ROW with a measured size and a stated reason, never an absence (D-09 applied to scope boundaries, not just to files)"
  - "Pattern: every published count names its unit (LINES vs OCCURRENCES) and its case sensitivity; a bare number is treated as a defect"

requirements-completed: []

coverage:
  - id: D1
    description: "A declared, re-derivable swept set of 50 members with exactly one verdict row per repo-relative path, covering all 35 content-carrying tracked non-.planning files, the 2 the gate reaches by path, the 4 shipped installer twins, the 5 named living documents and all 7 skill playbooks"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "regex scan of the ledger's numbered rows: rowCount=50, uniquePaths=50, duplicatePaths=[], numbers contiguous 1..50, all seven src/skills/*/SKILL.md present"
        status: pass
      - kind: other
        ref: "byte-level census (latin1 Buffer read, NUL-safe): 35 content-matching tracked non-.planning files, 37 under the gate's path+content predicate, 4 shipped-only installer matches"
        status: pass
      - kind: other
        ref: "re-anchored plan task-1 <automated>: N=35, node scripts/check-no-regenerator2000.mjs exit 0, grep -c 'grep -a' == 19"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every verdict is derived from git diff --exit-code against the phase base commit d6bebb1, not narrated; 45 unchanged / 5 corrected, with the three that are not CUT-06 corrections attributed separately"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "git diff --exit-code d6bebb1 HEAD -- <path> run for all 46 git-visible swept members; 5 non-zero"
        status: pass
      - kind: other
        ref: "cmp src/skills/... installer/skills/... for all 4 gitignored twins — all byte-identical, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every discussion-time figure re-measured with its command and unit; the one that research recorded as disagreeing is shown to reconcile, and research's own tree-wide totals are shown not to"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "grep -aoi 'r2000_' on d6bebb1:.planning/PROJECT.md == 26; uniq -c breakdown 23 lowercase + 3 uppercase; grep -an 'R2000_' locates lines 748/751/753"
        status: pass
      - kind: other
        ref: "byte-level census at 12a3a47 (374/339), 345d5c4 (376/341), d6bebb1 (386/351), HEAD (391/356) — research's 373/338 reproduces at none"
        status: pass
      - kind: other
        ref: "re-anchored plan task-2 <automated>: r2000_ 16 lines / 22 occurrences, CLAUDE.md == 0, ARCHITECTURE.md paths == 4, ledger contains '23'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sweep is verdict-recording: no swept file was modified, the removal gate exits 0, and every one of the 37 clause-(a) occurrence counts equals its pre-sweep value"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs exit 0 — 406 files, 157 permanently exempt, 0 allow-listed; the 12 class totals reconcile to 157 against the per-file pins with no residual"
        status: pass
      - kind: other
        ref: "37 paths compared at d6bebb1 vs HEAD — 0 occurrence counts moved"
        status: pass
      - kind: other
        ref: "node scripts/audit-gate.mjs --json — allowed:true, redGuards:[], structuralErrors:[]"
        status: pass
      - kind: other
        ref: "git status --porcelain empty; git diff --name-only d6bebb1 HEAD touches only the evidence/ ledger"
        status: pass
    human_judgment: false
  - id: D5
    description: ".planning/PROJECT.md:715 given an explicit verdict with independent reasoning rather than inherited or reversed silently"
    requirement: "CUT-06"
    verification: []
    human_judgment: true
    rationale: "The verdict is an adjudication under D-08 about whether a present-tense sentence inside a dated block routes a reader at a deleted surface. No automation can decide it; the ledger records the reasoning, the counter-argument, the measurement that makes the sentence stale, and the additive remedy a later plan should apply."

duration: 34min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 05: The CUT-06 living-document sweep ledger Summary

**A declared, re-derivable 50-member swept set with one mechanically-derived verdict row per file — and three measured corrections to the phase's own published figures: CONTEXT.md's "26 `r2000_`" reconciles exactly as a case-insensitive count (research said it could not), research's own 373/338 tree-wide totals reproduce at no commit, and the gate's predicate reaches 37 tracked files where the plan's census reaches 35.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-08-31T17:05Z (anchored to the worktree base commit `19b2c5c`)
- **Completed:** 2026-08-31T17:39Z
- **Tasks:** 2
- **Files modified:** 1 created (the ledger), plus this SUMMARY. **No swept document was touched.**

## Accomplishments

- **The swept set is declared with a predicate per clause, not asserted.** Three clauses — the removal
  gate's own scope predicate, the five named living documents ROADMAP criterion 2 reaches that the
  predicate cannot, and all seven skill playbooks whether or not they carry the literal. The exact
  command for each is in the ledger. Raw sum 53, three overlaps (the three playbooks that qualify under
  both clause (a) and clause (c)), **50 deduplicated rows** — verified mechanically: 50 rows, 50 unique
  paths, contiguously numbered, no path twice.

- **Clause (a) is 35 by content and 37 by the gate's own predicate, and both are recorded.** The plan's
  census command is content-only. `subjectHits()` scans *"BOTH the file's path and its text"*, so it
  additionally reaches `scripts/check-no-regenerator2000.mjs` and its `.d.mts` twin — two files whose
  **content carries zero occurrences** (the gate composes `SUBJECT_NEEDLE` precisely so its own source
  never carries the literal contiguously) and whose **path carries one each**. Both are pinned at 1 by
  `gate-self`, which is why the class reports 5 across five paths. The published 35 reconciles under
  the plan's definition; the 37 is what the gate actually counts. Both get rows.

- **The NUL trap is reproduced, named and used.** 35 with `-a`, 34 without; the vanishing file is
  `src/mcp/vice/anno-memmap-render.ts` (NUL at offset 15097, line 315). Demonstrated directly: a plain
  `grep -c` on that file exits 1 with no output — the file is *skipped*, not searched. Every count in
  the ledger uses `grep -a` or a byte-level `latin1` Buffer read, and the ledger says so and says why.

- **Verdicts are derived, not narrated — and honestly split.** `unchanged` ⇔
  `git diff --exit-code d6bebb1 HEAD -- <path>` exits 0. Result: **45 unchanged, 5 corrected**. But only
  **3** of the 5 are `CUT-06` pointer repairs (`PROJECT.md` and `ARCHITECTURE.md` by plan 32-03, and the
  gate's own stale header). `.planning/ROADMAP.md` changed only through orchestrator progress
  bookkeeping — three checkboxes, the plan count, and the phase progress row; its criterion-2 prose is
  byte-identical — and `scripts/check-skill-fork-honesty.mjs` changed because plan 32-02 gave it a
  contained `--root`. A separate *Changed by* column carries that distinction, so the mechanical verdict
  stays checkable without implying corrections that did not happen.

- **Open Question 5 is resolved by measurement, in the opposite direction to the prediction.** See
  Deviations. `26` is the **case-insensitive occurrence count** at the pre-sweep tree: 23 lowercase
  `r2000_` plus 3 uppercase `R2000_` (`R2000_TOOL_DEFINITIONS`, `CURATED_R2000_TOOLS`,
  `R2000_MODULE_FLOOR`, at `PROJECT.md:748/751/753`). Case-insensitivity is the removal gate's own
  native matching mode (`new RegExp(SUBJECT_NEEDLE, "gi")`), so this is the more idiomatic count, not a
  sloppy one. All four cells of the (case × unit) grid are published for both trees.

- **Research's own tree-wide totals do not reproduce, and that is recorded too.** `32-RESEARCH.md`
  published 373 tracked files carrying the literal and derived 338 for `.planning/` by subtraction.
  Re-measured: **374 / 339** at `12a3a47` (last commit before the research commit) and **376 / 341** at
  `345d5c4` (the research commit itself). Neither reproduces. Hypotheses stated as unconfirmed, and the
  measured figures are the ones §B.1 uses.

- **`.planning/PROJECT.md:715` given an explicit, independently reasoned verdict.** Plan 32-03 flagged
  it by name for this plan. Verdict `keep`, on stronger ground than 32-03's tie-break: the sentence
  **routes nobody** — it names no tool to call, no package to install, no command to run. The ledger
  also records the measurement that makes it factually stale (`grep -aco 'r2000_' src/skills/*/SKILL.md`
  → **seven zeros**), the three structural reasons keeping it is correct anyway (its scope marker two
  lines below; the surrounding sentences only parse pre-deletion; it is the recorded motivation for
  phases 29 and 31), and the **additive** remedy a later plan should use instead of a rewrite. Neither
  silently inherited nor silently reversed.

- **Every excluded population is a reasoned row with a measured size.** 311 phase artifacts, 10 research
  files (with `.planning/research/ARCHITECTURE.md` named individually, verdict *unchanged — research
  archive, dated by construction*, and `git diff --exit-code d6bebb1 HEAD` exit 0 re-confirmed), 27
  files across `milestones/`, `quick/`, `todos/`, `notes/` and `seeds/`, a measured **zero** for
  `codebase/`, the nine `.planning/` root documents split 4 swept / 5 excluded, and the two
  reviewed-but-not-folded todos at **0 occurrences each** — the mechanical form of CONTEXT.md's
  "adjacent to `CUT-06`'s subject, not inside it".

- **Proved the sweep changed nothing.** Gate exit 0 (406 files, 157 permanently exempt, 0 allow-listed);
  the twelve exemption-class totals reconcile to 157 against the per-file pins with **no residual**;
  all 37 clause-(a) occurrence counts identical to their pre-sweep values; `git status --porcelain`
  empty; `audit-gate.mjs --json` `allowed: true`, `redGuards: []`.

## Task Commits

1. **Task 1: Define the swept set, re-measure every count, write one verdict row per file** — `ab14671` (docs)
2. **Task 2: Reconcile the discussion-time numbers and record the out-of-scope declarations** — `c9eb2a5` (docs)

**Plan metadata:** the `docs(32-05): complete` commit carrying this file.

## Files Created/Modified

- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-document-sweep.md` — **created**,
  1048 lines. Sections: §0 worktree re-anchoring, counting units and the NUL proof; §1 the swept-set
  declaration with per-clause commands and the dedup arithmetic; §2 the 50-row verdict table; §3 the
  `r2000_` roll-up and the `:715` adjudication; §4 the shipped-twin duplication and the
  `sync-skills.mjs` obligation; §5 `D-11` confirmed; §6 the proof nothing moved; §A the six-figure
  reconciliation; §B the excluded populations; §7 how to re-derive; §8 the recorded deviation.
- **No swept document was modified.** `git diff --name-only 19b2c5c HEAD` lists the ledger and nothing
  else.

## Decisions Made

1. **Verdict column mechanical, attribution column separate.** Keeping `corrected` strictly equal to
   "the bytes moved" makes it checkable by anyone with the two commits; folding "was it a `CUT-06`
   correction" into the same cell would have made it a judgement nobody could re-derive. Three of five
   `corrected` rows are not corrections and say so.
2. **Publish 35 *and* 37 rather than picking one.** The plan's acceptance criterion names 35, and 35 is
   right under the content-only definition it uses. But the gate — the thing the swept set is supposed
   to mirror — counts 37. Suppressing either number would have left the next reader unable to reconcile
   the ledger with the gate's own output.
3. **`:715` keeps, on the routing test rather than the dating test.** The stronger argument is that the
   sentence cannot mis-route anyone, not that it sits in a dated block (which is true but is the weaker,
   more contestable ground 32-03 used). The staleness is recorded as a measured fact so the next reader
   inherits the evidence, not just the verdict.
4. **Shipped twins verdicted by `cmp`, not `git diff`.** `installer/skills/` is gitignored
   (`.gitignore:43`), so `git diff --exit-code` returns 0 for reasons that have nothing to do with the
   file's content. Deriving their verdict from their generated-from source is the only derivation that
   means anything.
5. **The ledger discloses that it is inside its own counted population.** Committing it moves the
   `.planning` matching count 356 → 357. §A7 measures before the commit, §B.1 after, and both say which
   — so neither reads as an arithmetic error to a later auditor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan instructed the ledger to publish a disagreement that does not exist**

- **Found during:** Task 2 (reconciling the discussion-time numbers)
- **Issue:** `32-05-PLAN.md` task 2 instructed: *"`.planning/PROJECT.md` has 26 `r2000_` occurrences" —
  **DISAGREES.** Measured 17 lines and 23 occurrences; neither counting definition yields 26. State the
  delta of 3 … treat 23 as the working figure"*, and the plan's `must_haves.truths` restates the same
  expectation. This came from `32-RESEARCH.md` §5.1, which tested two counting definitions
  (case-sensitive lines, case-sensitive occurrences) and stopped there. Writing the ledger as instructed
  would have published a false discrepancy into the phase record — the same class of unreproducible
  figure that `CUT-06` and `D-09` exist to eliminate, in the opposite direction.
- **Fix:** Measured all four cells of the grid. `git show d6bebb1:.planning/PROJECT.md | grep -aoi
  'r2000_' | wc -l` → **26**, exactly CONTEXT.md's figure. The breakdown
  (`… | sort | uniq -c` → `23 r2000_`, `3 R2000_`) and the three uppercase sites
  (`grep -an 'R2000_' .planning/PROJECT.md` → lines 748, 751, 753) account for the delta of 3 precisely.
  Research's own leading hypothesis is therefore **confirmed**, not unconfirmed. Section A3 records the
  verdict as **reconciles**, publishes all four measurements for both trees, keeps 23 as the working
  figure *for prose adjudication* (the three uppercase tokens are code-identifier names, not tool-call
  routes, so excluding them from 32-03's line-by-line adjudication was correct), and names 26 as the
  figure that reconciles the census. Section 8 of the ledger records the plan-vs-measurement conflict
  explicitly so the disagreement with the plan text is itself on the record.
- **Files modified:** the ledger only.
- **Verification:** four `grep` invocations quoted verbatim in §A3 with their output; anyone can re-run
  them.
- **Committed in:** `c9eb2a5`

**2. [Rule 2 - Missing Critical] Clause (a) as written under-counts the gate's own scope by two files**

- **Found during:** Task 1 (deriving the swept set)
- **Issue:** The plan defines clause (a) as *"every TRACKED file outside the `.planning/` prefix whose
  bytes contain the contiguous subject literal — **the removal gate's own scope predicate**"*. Those two
  descriptions are not the same predicate. `subjectHits()` scans the path **and** the text, so it reaches
  37 tracked files; the content-only census reaches 35. Writing 35 rows and calling it "the gate's own
  predicate" would have left two files the gate actively counts and pins with **no row at all** — the
  exact "we never looked" gap `D-09` exists to close, in the two files most embarrassing to miss (the
  gate itself and its type declaration).
- **Fix:** Split clause (a) into measured sub-clauses (a1) 35 content-carrying, (a2) 2 path-only,
  (a3) 4 shipped-untracked; gave all of them rows; stated both cardinalities with the definition each
  belongs to; and confirmed by measurement that the two (a2) files carry **zero** content occurrences
  (`grep -ac 'regenerator2000' scripts/check-no-regenerator2000.mjs` → 0). The plan's published 35 and
  its `test "$N" -eq 35` assertion are preserved intact and both still hold.
- **Files modified:** the ledger only.
- **Verification:** `git ls-files | grep -v '^\.planning/' | grep -i 'regenerator2000'` returns three
  paths, one of which is already in (a1); `35 + 2 = 37`.
- **Committed in:** `ab14671`

---

**Total deviations:** 2 auto-fixed (1 bug — a false figure the plan would have published; 1 missing
critical — two files the swept set would have omitted).
**Impact on plan:** Both are corrections *to the plan's own inputs*, discovered by doing exactly what the
plan demanded ("no number is copied … without being re-run"). Neither widens scope: the deliverable is
still one evidence document, no swept file was edited, and every acceptance criterion the plan states is
still satisfied — including the `N -eq 35` assertion, which the sub-clause split preserves rather than
replaces.

## Issues Encountered

- **The plan's `<automated>` commands hardcode the orchestrator's checkout path.** Every one was
  re-anchored to `git rev-parse --show-toplevel` before running; the ledger's §0 records the resolved
  root and quotes each command as actually run. Running them as written would have measured the main
  checkout, which does not contain this phase's worktree commits.
- **No `node_modules/` in the fresh worktree.** `npm ci --no-audit --no-fund --prefix src/mcp/vice` from
  the committed lockfile resolved it in 6s (237 packages, nothing new). Predicted by plan 32-01.
- **One `test:automated` failure — the known worktree artifact, not a regression.**
  `repo-root.test.ts:249` asserts `!supervisorDir().includes(".claude")`, and a GSD worktree root *is*
  `<repo>/.claude/worktrees/agent-*`. **2941 tests / 2934 pass / 1 fail / 1 skipped / 5 todo.** Identical
  to plan 32-03's run. Recorded in this phase's `deferred-items.md` § 1. This plan touches no source file
  at all, so it cannot have caused it; the assertion was not loosened and the test was not skipped. No
  broker was running, so the BACK-05 artifact does not apply. **The expected floor in the main checkout
  is 0.** The plan's task-2 acceptance criterion asking for "exits 0 with 0 failures" is therefore **not
  met in the worktree**, and is reported as unmet rather than worked around.
- **Running the gate regenerates `installer/skills/`** as a side effect: `packFiles()` shells out to
  `npm pack --dry-run`, whose `prepack` hook runs `sync-skills.mjs`. The directory is gitignored so the
  tree stays clean, but it means the four clause-(a3) paths do not exist on disk until something has
  invoked the gate. Recorded in ledger §4.

## Known Stubs

None. This plan created one evidence document. It wrote no code, no placeholder value, no unwired
component, and modified no file in the population it measures.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change at a trust boundary.

The plan's own register dispositioned `T-32-18` … `T-32-21` as `mitigate`, and each was executed rather
than assumed:

- **T-32-18** (repudiation — published figures): every number carries its command and its unit; nothing
  was carried over from CONTEXT.md or RESEARCH.md un-re-run, which is precisely how both deviations were
  found.
- **T-32-19** (NUL-tainted file dropped): every count uses `grep -a` or a byte-level read; the ledger
  names the file, the offset, the line and the 34-vs-35 consequence, and demonstrates the skip.
- **T-32-20** (tampering — a moved pin): no swept file modified; gate exit 0; all 37 clause-(a) counts
  compared against `d6bebb1` and 0 moved.
- **T-32-21** (repudiation — a silent exclusion): Section B gives every excluded population a measured
  size and a stated reason, including a measured **zero** for `.planning/codebase/**`.

`T-32-SC` (`accept`): this plan invoked no package manager to install anything. `npm ci` from the
committed lockfile was run to make the existing test suite executable; it resolved no new package.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **`CUT-06`'s `D-09` obligation is discharged for the record half.** Every file in a declared,
  re-derivable set carries a verdict; every excluded population carries a reason with a measured size.
- **Plan 32-08 has a corrected input.** Any figure it inherits for `.planning/PROJECT.md`'s `r2000_`
  count must state its case sensitivity: 23 case-sensitive occurrences (17 lines) at the pre-sweep tree,
  22 / 16 at HEAD, 26 / 20 case-insensitive at the pre-sweep tree. `32-RESEARCH.md` §5.1's ❌ row and
  Open Question 5's recommendation are superseded by ledger §A3.
- **Plans 32-06/07/09 inherit the 37-file gate scope**, not 35, if they reason about what the removal
  gate covers. The two extra files are `scripts/check-no-regenerator2000.mjs` and its `.d.mts`.
- **`.planning/PROJECT.md:715` is left with a recommended additive remedy**, not an open question. Any
  later plan taking it should append a dated clause rather than rewrite the sentence.
- **No blockers.** `.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately not modified — the
  orchestrator owns those writes after the wave merges. `.planning/REQUIREMENTS.md` likewise untouched:
  `CUT-06` is declared by six plans in this phase and may not read `Complete` until the last one
  summarises (the same shared-ID gate plan 32-03 recorded).

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

- Both claimed files exist on disk: `evidence/32-document-sweep.md` (61693 bytes, 1048 lines) and this
  SUMMARY (26164 bytes).
- All three claimed commits resolve in `git log --oneline --all`: `ab14671`, `c9eb2a5`, `4ddf4ca`.
- `git diff --name-only 19b2c5c HEAD` lists exactly those two paths and nothing else — no swept
  document, no `STATE.md`, no `ROADMAP.md`, no `REQUIREMENTS.md`.
- Both tasks' `<acceptance_criteria>` were re-run after the final content commit. All pass except the
  task-2 clause requiring `npm run test:automated` to exit 0 with 0 failures, which is **unmet in the
  worktree** for the recorded `repo-root.test.ts:249` artifact and is reported as unmet above rather
  than worked around.
- Ledger row integrity verified mechanically: 50 numbered rows, 50 unique paths, no duplicate, numbers
  contiguous 1..50, all seven `src/skills/*/SKILL.md` playbooks present.
