---
created: 2026-08-25
source: phase-19 code review (19-REVIEW.md), finding CR-02 — the one id
  docs-review-disposition.test.ts reported undispositioned in all five of the
  sources it accepts
severity: critical
resolves_phase: 19
---

# Phase 19 review, CR-02 — disposition

## Why this file exists

`docs-review-disposition.test.ts` (the self-applied AUDIT-01 guard) reported, standalone at
`HEAD` before this file was written:

```
finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
  19-REVIEW.md (19-absorbed-procedures-and-the-coverage-instrument): CR-02
```

One id, one phase. `CR-02` was fixed months of work ago in this milestone's own terms — plan
19-08 shipped against it and `19-REVIEW.md` records the outcome in place — and yet the id
appeared in **none** of the guard's five accepted disposition sources: no `*-SUMMARY.md` in the
phase directory named it, no `*-REVIEW-FIX.md` existed for the phase yet, no todo named it, and
the milestone audit's `tech_debt:` block does not carry it. That is AUDIT-01's own defect —
*"closed by silence, not by absence of a fix"* — recurring inside Phase 19, the phase whose
review found it. This file is the disposition, filed in the guard's source 3
(`.planning/todos/{pending,completed}/*.md` naming the id and identifiably about the phase).

It is filed under `completed/`, not `pending/`, because `CR-02` is **disposed, not deferred**. A
pending todo would additionally require a matching row in `STATE.md`'s `## Deferred Items`
section or `docs-deferred-ledger.test.ts`'s direction-A invariant turns red; nothing here is
outstanding work waiting on a decision.

The shape follows the established precedent for exactly this act:
`.planning/todos/completed/2026-08-21-phase-10-and-11-review-residual-dispositions.md`, which
disposed eleven ids the v0.3.0 audit found silent.

## CR-02: the split lo/hi table scan manufactures census coverage from ordinary data

**Checked against:** `19-REVIEW.md` § Critical Issues, the `CR-02` heading and its in-place
blockquote.

### What the finding was

The Class-3 split-table scan paired **any** two indexed `ld*` instructions occurring within
`SPLIT_TABLE_WINDOW` (8) decoded instructions, assumed their operands were the bases of an
adjacent lo/hi pointer table, assumed the table length was `hiBase - loBase`, reconstructed that
many 16-bit "targets" out of whatever bytes were there, and returned them in
`discoveredTargets` — which `buildCoverageReport()` passed straight in as `extraSeeds` to the
recursive-descent walk. Nothing tested that the two loads were related, that either base held
pointer data, or that the reconstructed values were plausible entry points. A two-table indexed
read loop (`lda screen,x` / `lda colour,x`) matched. The review's reproduction, against the
shipped code with a 64-byte program whose only real code was 7 bytes:

```
plain census    reached=7   tableEntry=0  referencedAsData=2  unreached=55
with the scan   reached=63  tableEntry=0  referencedAsData=0  unreached=1
```

56 bytes of ordinary data promoted to `reachedAsInstruction`, the headline measure — in direct
contradiction of the module's own trap 2.

### What was shipped against it

**Plan 19-08, commit `1706d8b`** (`fix(19-08): gate the split-table scan and seed the descent
only from proven targets [skip release]`) — confirmed present: `git cat-file -t 1706d8b` returns
`commit`, and `git log --oneline -1 1706d8b` returns the subject above. A second commit in the
same plan, **`9c9166d`** (`test(19-08): the negative controls the split-table scan never had
[skip release]`, likewise confirmed `commit`), carries the control set including the extension of
the class-3 positive-control fixture with a genuine dispatch consumer, rather than weakening the
gate to accommodate a fixture that had none.

**Checked against:** `19-08-SUMMARY.md` § Accomplishments (its "The gate", "The advisory class",
"The single seam" and header/schema subsections) and `19-REVIEW.md`'s `CR-02` blockquote, which
agree on all four of the following:

- **The Class-3 scan is gated** (`anno-coverage.ts:836-924`). A pairing is PROVEN only when it
  is not inside a Class-4 window, both loads use the same index register (compared via
  `indexRegisterOf()` on the decoded mode, not by mere membership in `INDEXED_LOAD_MODES`), a
  dispatch consumer is in evidence (`hasDispatchContext()`), every reconstructed target is
  strictly inside the image *and* decodes as a legal non-truncated instruction, and the lo/hi
  orientation is resolved from the pairing's own store construction. The `Math.min`/`Math.max`
  orientation fallback is gone entirely.
- **Ungated pairings move to the advisory sibling** `splitTableCandidates`, reported beside the
  proven classes and never summed into them: no contribution to `discoveredTargets`, none to
  `tableEntryAddresses`, `orientationResolved: false`, bases in encounter order with no lo/hi
  claim, and an empty `targets` list — because a byte-swapped value is not an address and is
  never printed as one.
- **`COVERAGE_SCHEMA_VERSION` was bumped 1 → 2**, with a version-history block recording what
  changed and that a human accepted it; the nine-entry top-level `COVERAGE_REPORT_KEYS` set is
  unchanged.
- **`provenDispatchTargets()`** (`anno-coverage.ts:954-969`) is the single exported seam every
  `extraSeeds:` assignment reads, and `classFromBytes()` (`:1276`) takes the proven array as a
  parameter instead of testing `discoveredTargets`.

The review's own re-verification records that CR-02's exact reproduction no longer fires: the
FP1/FP1b committed fixture pair now reports identical `reachedAsInstruction` (7 and 7).

### Narrowed, not closed — and where the residual went

`19-REVIEW.md`'s `CR-02` blockquote says so itself, in its own words:

> **The defect class is narrowed, not closed.** The gate accepts a zero-page *pointer
> construction* as proof of dispatch, so the same manufacturing still happens on the most
> ordinary indirect-data-read idiom in 6502 code. Tracked as the new **CR-04** rather than by
> reopening this id.

That sentence is quoted here rather than paraphrased so a reader can see the decision was
recorded **at review time**, not invented while dispositioning: the residual was deliberately
re-filed under a new id, and `CR-02` itself was correctly left as RESOLVED (NARROWED). Its id
continuity therefore matters — which is why the disposition lives in this file and not as an
edit to the review.

### Where CR-04 stands as of 2026-08-25

**`CR-04` is OUTSTANDING.** It is the finding plan 19-10 exists to discharge in the current
gap-closure run, and at the date of this record 19-10 has produced no SUMMARY and no commit. Its
disposition therefore does not exist yet and this record does not pretend otherwise: nothing here
should be read as a claim that `CR-04` is fixed. When 19-10 closes, its own SUMMARY is where
`CR-04`'s disposition lands (the guard's source 1), naming the id and the commit that fixed it.

Recorded plainly because a disposition that cites work still in flight is a prediction, not a
record — and a prediction in this position is exactly the repudiation risk this file exists to
avoid.

## Scope note

Writing this disposition modified **no other file**. `19-REVIEW.md` was read and not touched: it
is byte-unchanged, not regenerated, not renumbered, not annotated. That is deliberate and load-
bearing — `docs-review-disposition.test.ts` keys on the ids present in that file, so
regenerating it to make a guard green would orphan every finding id the guard tracks and destroy
the very record the guard exists to protect. A disposition is an account of what was done, not a
phrasing that satisfies a parser.

No id other than `CR-02` and `CR-04` is dispositioned here. The remaining Phase 19 findings whose
only current mention is `19-VERIFICATION.md`'s prose — a disposition by accident, which evaporates
the next time a re-verification rewrites that file — are the subject of the phase's own
`19-REVIEW-FIX.md` ledger and are deliberately left to it, so that two competing records of the
same dispositions never exist.
