---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 14
subsystem: testing
tags: [audit-01, review-disposition, planning-ledger, guard-cascade, gap-closure]

requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-REVIEW.md's finding set and CR-02's in-place RESOLVED (NARROWED) blockquote; plan 19-08's gate (commit 1706d8b) and its controls (9c9166d); 19-VERIFICATION.md's gap-2 record of the red tree"
provides:
  - "CR-02's evidence-bearing disposition in the AUDIT-01 guard's source 3 — .planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md, phase-scoped, citing only commits that already existed when it was written"
  - "A GREEN docs-review-disposition.test.ts (AUDIT-01): 7/7, was 6/7"
  - "A GREEN audit-integrity.test.ts including D-12-02 observed passing by name: 44/44"
  - "A measured, not inherited, seven-guard cascade census — all seven docs-*.test.ts guards named in D-12-02's message exit 0 standalone"
affects: [19-10, 19-11, 19-12, 19-13, phase-19-re-verification]

actuals:
  tokens: 8900
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A red planning guard is discharged by filing the missing record in a source the guard already reads — never by editing the ledger the guard parses"
    - "A wave-1 disposition cites only hashes that resolve under `git cat-file -t` at writing time, and names in-flight work as outstanding rather than predicting its commit"
    - "When a concurrent sibling plan is editing source, gate on the standalone guards that read no file the sibling touches, and state the scoping decision rather than leaving the absent full-suite run as a silent omission"

key-files:
  created:
    - .planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md
  modified: []

key-decisions:
  - "Filed under `.planning/todos/completed/` (guard source 3) rather than in a SUMMARY (source 1, which arrives only at plan close, after this plan's own verification step needs to observe the guard green) or in `19-REVIEW-FIX.md` (source 5, plan 19-13's deliverable — writing it here would put two plans on one file)."
  - "`completed/`, not `pending/`: CR-02 is disposed, not deferred. A pending todo would require a matching row in STATE.md's `## Deferred Items` section or `docs-deferred-ledger.test.ts` direction A turns red."
  - "The record names exactly two ids, `CR-02` and `CR-04`. An `IN-04` mention that leaked in while citing a 19-08-SUMMARY.md subsection heading was caught by a pre-commit id census and removed — widening the file would duplicate 19-13's ledger and create two competing records of the same dispositions."
  - "`CR-04` is recorded as OUTSTANDING with plan 19-10 named as the plan that will close it. 19-10 had no SUMMARY and no commit at this record's date, so describing it as fixed would have made the record a prediction."
  - "The full suite was deliberately NOT run as this plan's gate (see § Why no full-suite run)."

patterns-established:
  - "Pre-commit id census on a disposition document: `grep -Eo '\\b(WR|IN|CR)-[0-9]+\\b' | sort -u` must return exactly the intended id set, because every id named in a todos/ file silently becomes a disposition source for it."

requirements-completed: [COV-02, COV-01]

coverage:
  - id: D1
    description: "CR-02 — the one 19-REVIEW.md finding id undispositioned in all five sources docs-review-disposition.test.ts accepts — now carries a real, evidence-bearing disposition in guard source 3, and the guard passes standalone"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts#every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-12-02 cascade is resolved: no milestone audit declares a gated status while any docs guard is red, observed passing by name"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts#no milestone audit declares a gated status while any docs guard is red (D-12-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seven-guard cascade is re-measured rather than inherited from 19-VERIFICATION.md's spot-check: all seven docs guards named in D-12-02's message exit 0 standalone"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "node --test {docs-review-disposition,docs-core-value-decision,docs-dangling-refs,docs-deferred-ledger,docs-fork-decision,docs-linerefs,docs-anno-decisions}.test.ts — seven separate standalone runs, each exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Finding-id continuity preserved absolutely — 19-REVIEW.md byte-unchanged across the plan's whole commit range, no pending todo, no STATE.md row, no src/ edit"
    requirement: COV-02
    verification:
      - kind: other
        ref: "git diff --name-only c201da4^..HEAD — returns exactly one path, the new todo; the same range filtered to 19-REVIEW.md returns empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "The disposition is truthful about work still in flight — CR-04 named as outstanding, every cited hash resolving at writing time"
    requirement: COV-02
    verification:
      - kind: other
        ref: "git cat-file -t 1706d8b && git cat-file -t 9c9166d — both `commit`; grep of the record shows CR-04 only as OUTSTANDING"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 14: CR-02's Disposition and the Guard Cascade Summary

**`CR-02` — the one `19-REVIEW.md` finding id undispositioned in all five sources the AUDIT-01 guard accepts — now carries an evidence-bearing disposition in `.planning/todos/completed/`, taking `docs-review-disposition.test.ts` from 6/7 to 7/7 and clearing the `D-12-02` cascade, with `19-REVIEW.md` byte-unchanged.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-25T07:04:00Z
- **Completed:** 2026-08-25T07:11:35Z
- **Tasks:** 2
- **Files modified:** 1 created, 0 modified

## Accomplishments

- Filed `CR-02`'s disposition in the guard's **source 3**, re-derived from the artifacts that own each claim (`19-REVIEW.md`'s own blockquote, `19-08-SUMMARY.md`, `git log`) rather than transcribed from the plan's prose.
- Took `docs-review-disposition.test.ts` (AUDIT-01) from **1 fail to 0**, and `audit-integrity.test.ts`'s `D-12-02` from cascading-red to green — the exact two failures `19-VERIFICATION.md` gap 2 recorded.
- **Re-measured** the seven-guard cascade instead of repeating the verification's three-of-six spot-check: all seven exit 0 standalone. No previously-green guard has turned red, so there was nothing to halt on.
- Preserved finding-id continuity absolutely: the plan's whole commit range touches exactly one file, and it is the new todo.

## Task Commits

1. **Task 1: File CR-02's disposition record in the source the guard actually reads** — `c201da4` (docs)
2. **Task 2: Observe the cascade resolved** — no commit; verification-only by design (`<files>` declares none).

**Plan metadata:** see the `docs(19-14)` commit accompanying this SUMMARY.

Every commit subject carries `[skip release]`. This plan does not perform the Phase 19 re-verification and therefore cannot lift 19-07's hold, whose stated lifting condition is *"Phase 19 re-verification returns no gaps."*

## Files Created/Modified

- `.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` — **created.** CR-02's disposition: what the finding was, what plan 19-08 shipped against it, that the class was narrowed rather than closed, where the residual went, and where `CR-04` stands today.

## The guard's verbatim pre-write failure text

Measured standalone at `HEAD` **before** the record was created (`cd src/mcp/vice && node --test docs-review-disposition.test.ts`, exit 1):

```
not ok 1 - every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)
  ---
  location: '/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/docs-review-disposition.test.ts:338:1'
  failureType: 'testCodeFailure'
  error: |-
    finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
      19-REVIEW.md (19-absorbed-procedures-and-the-coverage-instrument): CR-02
    + actual - expected

    + [
    +   {
    +     id: 'CR-02',
    +     phaseDir: '19-absorbed-procedures-and-the-coverage-instrument',
    +     phaseNum: '19',
    +     reviewFile: '19-REVIEW.md'
    +   }
    + ]
    - []
```

One id, one phase — narrower than `19-VERIFICATION.md` recorded. The five ids the verification named (`CR-04`, `WR-13`, `WR-14`, `WR-15`, `IN-05`) became "dispositioned" the moment `19-VERIFICATION.md` was itself committed, because the guard's **source 2** is the phase's own `*-VERIFICATION.md` and that file's `missing:` prose quotes each id by name. That is a disposition by accident; replacing those five with durable ones is plan 19-13's job and was **not** discharged here.

**Pre-write:** `# tests 7`, `# pass 6`, `# fail 1`, exit 1.
**Post-write:** `# tests 7`, `# pass 7`, `# fail 0`, exit 0.

## The seven guards D-12-02's message names, each run standalone

| Guard | exit | counts |
|---|---|---|
| `docs-review-disposition.test.ts` | **0** | `# tests 7 # pass 7 # fail 0` |
| `docs-core-value-decision.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-dangling-refs.test.ts` | **0** | `# tests 8 # pass 8 # fail 0` |
| `docs-deferred-ledger.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-fork-decision.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-linerefs.test.ts` | **0** | `# tests 3 # pass 3 # fail 0` |
| `docs-absorbed-decisions.test.ts` | **0** | `# tests 5 # pass 5 # fail 0` |

**Seven of seven green.** The verification's claim — that D-12-02's message named seven red guards while six passed standalone — is now confirmed by measuring all seven rather than three, and the seventh (the disposition guard) is green too. None of the six previously-green guards has regressed, so this plan had nothing to halt and report.

`audit-integrity.test.ts` standalone: **exit 0**, `# tests 44 # pass 44 # fail 0`, with the cascade subtest observed by name:

```
ok 4 - no milestone audit declares a gated status while any docs guard is red (D-12-02)
```

## Commit hashes cited in the record, each resolved

| Hash | `git cat-file -t` | Subject |
|---|---|---|
| `1706d8b` | `commit` | `fix(19-08): gate the split-table scan and seed the descent only from proven targets [skip release]` |
| `9c9166d` | `commit` | `test(19-08): the negative controls the split-table scan never had [skip release]` |

Both resolved **before** being written into the record. No hash in the record belongs to a plan still in flight; `CR-04`'s eventual fix commit is deliberately absent because plan 19-10 has produced neither a SUMMARY nor a commit as of this date.

## How both halves of `todoMentionsPhase()` were checked

The predicate (`docs-review-disposition.test.ts`, around line 190) is satisfied by *either* the content naming the phase's own review filename *or* a word-bounded `phase N` / `phase-N` token. Both were made to hold **independently**, so a future edit to either half cannot silently un-scope the record:

- **Half 1 — the literal `19-REVIEW.md`.** `grep -c "19-REVIEW\.md"` over the record returns **7** occurrences (frontmatter `source:` field plus six body citations).
- **Half 2 — the word-bounded phase token.** `grep -Eoi "\bphase[[:space:]-]*19\b"` — the guard's own regex, transliterated to POSIX classes — returns **4** matches: one `phase-19` (frontmatter `source:`) and three `Phase 19` (title, "Why this file exists", scope note).

Deleting either half entirely would leave the other standing, and the record would still be phase-scoped.

## Why no full-suite run

**The full suite was NOT run in this plan, deliberately.** This plan's wave-1 sibling **19-10** is concurrently editing `anno-coverage.ts`, `anno-coverage.test.ts`, the fixture generator and two new fixture directories. A full-suite run here would observe the tree mid-flight and report a failure belonging to neither plan — evidence about scheduling, not about correctness.

The gate used instead is the two named guards run standalone. Both read only `.planning/` documents (`19-REVIEW.md`, phase SUMMARYs/VERIFICATIONs, `.planning/todos/`, top-level milestone audits) plus `scripts/audit-gate.mjs`'s derived guard set — **no file 19-10 touches** — so their result is independent of 19-10's progress. The unconditional full-suite gate belongs to wave 2 onward.

Neither is `npm run test:automated` ever the evidence: it is `node test-gate.mjs`, which runs `automatedTestFiles()` — every `*.test.*` on disk **minus** the nine frozen `MANUAL_ONLY_TESTS` entries (`vice-broker-launch`, `vice-proxy`, `broker-e2e`, `stock-live`, `stock-live-triage`, `stock-live-broker-monitor`, `stock-broker-live`, `fork-live`, `stock-a4-checkpoint-flood`). The full suite is `npm test` = `node --test '*.test.*'`.

## The sentence wave 2 depends on

With `CR-02` discharged, the two failures `19-VERIFICATION.md` recorded are gone, and a downstream plan asserting a green full suite is now asserting something its own work can be responsible for — rather than failing for a cause outside its scope, or reaching for the planning documents to make the tree green, which is exactly the tampering `19-13`'s `T-19G-13-01` forbids.

## Decisions Made

- **Source 3, not source 1 or 5.** Source 1 (a plan SUMMARY) would work but arrives only at plan close — after this plan's own verification step needs to observe the guard green. Source 5 (`19-REVIEW-FIX.md`) is plan 19-13's deliverable; writing it here would put two plans on one file. Source 3 is this repository's established convention for the act, precedent `.planning/todos/completed/2026-08-21-phase-10-and-11-review-residual-dispositions.md`, whose shape the new record follows.
- **`completed/`, not `pending/`.** Read both direction tests of `docs-deferred-ledger.test.ts` before writing: direction A requires every **pending** stem to have its own table cell in `STATE.md`'s `## Deferred Items`; direction B requires no **completed** stem to appear there. A new completed todo, absent from `STATE.md`, satisfies both — and CR-02 is disposed, not deferred.
- **Exactly two ids named.** See the deviation below.
- **`CR-04` named as outstanding.** Recorded with plan 19-10 as the plan that will close it and with the explicit sentence that nothing in the record should be read as a claim that CR-04 is fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An `IN-04` id leaked into the disposition record, breaching its own scope fence**

- **Found during:** Task 1, by the pre-commit id census (before any commit existed).
- **Issue:** While citing `19-08-SUMMARY.md`'s accomplishment subsections, one was quoted by its literal heading — *"Header, schema, and IN-04"*. The plan forbids the record mentioning any id but `CR-02` and `CR-04`, and for a mechanical reason, not a stylistic one: the guard's `isDispositioned()` is a word-bounded match over the concatenated source text, so **every** id named in a `todos/` file silently becomes dispositioned by it. Left in, this record would have become a second, competing disposition source for `IN-04` — duplicating 19-13's ledger, which is the exact condition that made the original AUDIT-01 finding hard to resolve.
- **Fix:** Reworded the citation to name the subsection without its id ("its ... header/schema subsections"). Re-ran the census: `grep -Eo '\b(WR|IN|CR)-[0-9]+\b' | sort -u` now returns exactly `CR-02` and `CR-04`.
- **Files modified:** `.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md`
- **Verification:** id census returns the intended two-element set; guard still exits 0.
- **Committed in:** `c201da4` (fixed before the commit was created, so the defect never entered history)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** None on scope. The fix was caught by a check the plan itself mandated, before any commit. It generalises into a recorded pattern (§ patterns-established): a disposition document needs a pre-commit id census, because naming an id in one is not a neutral act.

## Issues Encountered

**One acceptance criterion was not literally satisfiable, and its intent was verified instead.** The plan requires `git status --porcelain .planning/STATE.md` to be empty. It is not — but not because of this plan. `.planning/STATE.md` carried an **uncommitted, pre-existing modification made by the execute-phase orchestrator's own phase-start write** (`last_activity_desc: Phase 19 execution started`, `Plan: 1 of 14`, `state_head` advanced to `a756b17`), present before this executor made any edit.

The criterion's actual intent — *this plan does not edit `STATE.md`, so no `## Deferred Items` row is needed* — holds and was verified in the meaningful form: `git diff --name-only c201da4^..HEAD` returns exactly one path, the new todo. `STATE.md` appears in no commit of this plan's production range. The orchestrator's own edit was deliberately left unstaged in Task 1 and is not this plan's to claim.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 2 is unblocked and now honest.** Plans 19-11 and 19-12 gate task completion on a green full suite; that gate is no longer failing for a cause none of them fixes.
- **Still outstanding, by design, and not this plan's work:**
  - `CR-04` — plan 19-10, in flight in this same wave. Its disposition lands in 19-10's SUMMARY.
  - The five accidental dispositions (`CR-04`, `WR-13`, `WR-14`, `WR-15`, `IN-05` named only in `19-VERIFICATION.md`'s prose) — plan 19-13's `19-REVIEW-FIX.md` ledger. They will evaporate the next time a re-verification rewrites that file, which is why 19-13 exists.
  - The `[skip release]` hold stands. Its lifting condition is *"Phase 19 re-verification returns no gaps"*, and this plan does not perform that re-verification.
- **A caution for whoever writes 19-13's ledger:** this record deliberately covers only `CR-02` and `CR-04`. Do not re-disposition either there; two records of one disposition is the defect class AUDIT-01 names.

## Self-Check: PASSED

- `.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` — FOUND on disk.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-14-SUMMARY.md` — FOUND on disk.
- Commit `c201da4` — FOUND (`docs(19-14): dispose 19-REVIEW.md CR-02 in the guard's source 3 [skip release]`).
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` empty for `c201da4` — no tracked file deleted.
- Plan-level verification items 1–8 all re-run and passing: both guards exit 0, `docs-deferred-ledger` exits 0, seven guards measured by name, `19-REVIEW.md` diff empty across the range, `src/` and `.planning/todos/pending/` clean, both cited hashes resolve, every commit subject carries `[skip release]`.
- `STATE.md` criterion: intent verified in the stated alternative form (see § Issues Encountered).

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
