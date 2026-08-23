---
phase: 17-project-identity-and-ledger-close
verified: 2026-08-23T12:00:00Z
status: human_needed
score: 20/21 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm whether CORE-01's must_have truth 3 (\"The verdict recorded in `## Core Value` is the option a human selected at this plan's `gate=\\\"blocking-human\\\"` checkpoint, not one an executor picked while unattended\") is satisfied by what actually happened."
    expected: "A human either (a) confirms that an attended delegation of the choice (\"you decide\") to the orchestrating session — a gate=\"blocking-human\" checkpoint rendered and answered 298 seconds later, comprehension not evidenced by any artifact and not claimed — satisfies the intent of this must-have and the sibling prohibition (\"MUST NOT let an executor choose ... unilaterally\"), or (b) determines that the literal wording (\"the option a human selected\") was not met and requires either a corrected must-have/prohibition wording for future phases, or treats this as an accepted, disclosed deviation via an override."
    why_human: "This is a judgment call about provenance and intent, not a mechanically checkable fact. The record (17-02-SUMMARY.md, PROJECT.md's Core Value entry, and REQUIREMENTS.md's CORE-01 closure note) is unusually transparent about the exact shape of what happened: the gate=\"blocking-human\" checkpoint was rendered and the operator answered 298 seconds later in free text 'you decide' rather than picking `restate` or `keep-dated` themselves; the orchestrating session then selected `keep-dated`. Attendance and delegation are on the record; comprehension is not evidenced by any artifact and is not claimed (corrected 2026-08-23 by plan 17-04, gap G-17-1). This satisfies the *anti-auto-approval* half of the prohibition (a human genuinely attended and responded; auto-mode's default-first-option resolution was bypassed) but does not satisfy the *literal* half of must_have truth 3 (a human did not personally select the option word). The project's own user memory records 'you decide' as a standing delegation preference for this user, which is relevant context but does not by itself resolve whether the plan's own stricter must-have wording was met."
  - test: "Read PROJECT.md's `## Core Value` entry end to end (task 2's harvested `<human-check>` from 17-02-PLAN.md, deferred to end-of-phase per `workflow.human_verify_mode: end-of-phase`) and confirm it reads as evidence weighed rather than a conclusion asserted."
    expected: "(a) names the verdict actually chosen at the checkpoint; (b) cites at least one piece of evidence by name rather than gesturing at 'the evidence'; (c) engages with the case against the verdict it reached; (d) the reversal condition is specific enough that a future reader could tell whether it has been met."
    why_human: "17-02-PLAN.md's task 2 `<verify>` block explicitly defers this check to a human at end-of-phase; it is the one check that reaches the 'weighed, not bookkeeping' half of CORE-01's criterion. The verifier's own direct reading of the entry (reproduced in full in this report below) found it satisfies all four sub-criteria, but the plan's own workflow contract requires this to be confirmed by a human rather than accepted on the verifier's reading alone."
---

# Phase 17: Project Identity and Ledger Close Verification Report

**Phase Goal:** PROJECT.md's Core Value is either restated to reflect what
v0.3.0 proved (that what a session learns outlives it) or carries a dated
confirmation that it should not be, with the evidence weighed either way. The
deferred-items ledger is then measured at the **true** close — after Phase 16
has discharged `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`,
the last pending todo any phase of this milestone removes — and is smaller
than the 19 items inherited.

**Verified:** 2026-08-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `.planning/todos/pending/` holds 0 `.md` files, strictly below the frozen 19-item v0.3.0 baseline | ✓ VERIFIED | `find .planning/todos/pending -name '*.md' \| wc -l` → `0`. 0 < 19. |
| 2 | `docs-deferred-ledger.test.ts` expresses a zero-pending tree as passing, non-vacuity teeth intact | ✓ VERIFIED | `node --test docs-deferred-ledger.test.ts` → 6/6 pass (plan required 4; two more tests were added by the post-execution review-fix cycle — WR-01's real-data invariant and WR-02's substring-safety case — strictly strengthening, not replacing, the original four). |
| 3 | STATE.md's three count figures (`## Deferred Items` prose, its table row count, `### Pending Todos` prose) all read 0 and agree | ✓ VERIFIED | `## Deferred Items` paragraph reads "0 items — 0 pending todos, zero UAT gaps" with full arithmetic; table has 0 data rows (header/separator retained with an explanatory italic line); `### Pending Todos` opens "0 pending (0 files ... + 0 UAT-gap rows = 0)". All three agree. |
| 4 | No assertion in the fixed guard depends on `readdirSync` enumeration order | ✓ VERIFIED | `missingPendingStems`/`wronglyListedCompletedStems` are `Array.prototype.filter` over independent per-element predicates (`stemHasOwnTableCell`), compared against `[]`/membership, not order-sensitive. Read the full predicate code directly. |
| 5 | (backstop) Every STATE.md count figure states its arithmetic in the same sentence, not hand-typed | ✓ VERIFIED | Directly observed: "0 pending todo files in `.planning/todos/pending/` + 0 UAT-gap rows = 0" appears verbatim in the `## Deferred Items` paragraph and the analogous form in `### Pending Todos`. |
| 6 | STATE.md's `## Deferred Items` states plainly what the 0 figure excludes | ✓ VERIFIED | Paragraph names the `### Carried forward from earlier closes` table's four still-`Deferred` rows (`UP-01`/`UP-02`, `QUAL-01`, `QUAL-02`, `QUAL-03`) and the ~15 carried WR-class findings in `v0.2.0-MILESTONE-AUDIT.md`, stating both are unchanged by this measurement. |
| 7 | PROJECT.md's `## Core Value` carries an ISO date not present before this plan | ✓ VERIFIED | `2026-08-23` appears inside the new `**Kept as-is (CORE-01, decided 2026-08-23).**` marker. |
| 8 | `## Core Value` names, verbatim, specific evidence actually weighed | ✓ VERIFIED | Names `R2000-01`, Phase 11's "two-session sealed-question test," `R2000-10`, the symbol round trip (`R2000-14`/`R2000-15`), and the 17 curated `r2000_*` tools, by literal string. |
| 9 | The verdict recorded is the option **a human selected** at the `gate="blocking-human"` checkpoint, not one an executor picked while unattended | ⚠️ see Human Verification | Per 17-02-SUMMARY.md and PROJECT.md's own entry: the checkpoint was rendered and the operator answered 298 seconds later in free text ("you decide") rather than picking `restate`/`keep-dated` personally; the orchestrating session then selected `keep-dated`. Attendance and delegation are on the record; comprehension is not evidenced by any artifact and is not claimed (corrected 2026-08-23 by plan 17-04, gap `G-17-1`). The record is candid about this rather than smoothing it into "a human selected keep-dated." This satisfies the anti-auto-approval intent (attended, not silently defaulted) but not the must-have's literal wording (a human did not personally choose the word). Routed to human verification rather than silently passed or failed. |
| 10 | If keep-as-is, the entry names a concrete condition under which the question reopens | ✓ VERIFIED | "(a) a shipped skill or workflow demonstrably depends on cross-session recall ... checkable by emptying the annotation store" / "(b) a second milestone produces persistent-state evidence that is genuinely new." |
| 11 | The dated entry lives inside `## Core Value`, not `## Key Decisions`; `docs-fork-decision.test.ts` stays green and untouched | ✓ VERIFIED | Entry is inside `## Core Value` (confirmed by direct read). `node --test docs-fork-decision.test.ts` → 6/6 pass. `git log` shows no content edit to the FORK-01 Key Decisions row in this phase's commits. |
| 12 | (backstop) The entry reads as evidence weighed, engaging the case against the verdict reached | ✓ VERIFIED (direct read) — also harvested to Human Verification per plan's own deferred `<human-check>` | Entry contains an explicit "*Case against this verdict, carried rather than resolved*" paragraph naming the sealed-question test as "genuinely the strongest evidence this project has produced ... left unnamed ... for a third close running. That cost is real and is not explained away." |
| 13 | `grep -cE '^\| [A-Z]+-[0-9]+ \| [0-9.]+ \| Complete \|$' REQUIREMENTS.md` reports 16, up from 14; 0 non-Complete rows | ✓ VERIFIED | Ran live: `16` Complete rows, `16` total data rows. 0 open. |
| 14 | Both DEBT-04 and CORE-01 carry a closure-note blockquote naming the plan, outcome, and what pins it mechanically | ✓ VERIFIED | Both notes read in full (REQUIREMENTS.md lines ~196-235); DEBT-04 names `docs-deferred-ledger.test.ts` and plan 17-01 tasks 1/2; CORE-01 names `docs-core-value-decision.test.ts` and plan 17-02 task 3, and states the provenance precisely. |
| 15 | DEBT-04's closure note closes DEBT-01's forward reference, states 2→0, cites guard fix and STATE.md edit | ✓ VERIFIED | Note reads: "this closes DEBT-01's own forward reference ... 'Phase 17 measures DEBT-04 after Phase 16 discharges the payload-relocation todo (PKG-01)', and this is where that promise is discharged," plus the `2 → 0` arithmetic and both plan 17-01 tasks named. |
| 16 | `.planning/todos/pending/` still holds 0 `.md` files, re-checked at end rather than assumed | ✓ VERIFIED | Re-ran independently in this verification session (not reused from 17-01's or 17-03's own record): `0`. |
| 17 | The closure record names `/gsd-audit-milestone` as the backstop for any post-count finding | ✓ VERIFIED | `## Operator Next Steps` names it explicitly as "the backstop for any finding this phase's own post-execution review files after this count was taken," and — notably — the phase's own code review *did* file 4 findings after the count was taken, all of which were fixed rather than left as pending todos, so the backstop scenario named in the record did not need to be exercised for `.planning/todos/pending/` to stay accurate. |
| 18 | `cd src/mcp/vice && npm test` reports 0 failures across the full suite | ✓ VERIFIED | Ran independently: `2395 total, 2351 pass, 0 fail, 39 skipped, 5 todo, 24 suites`. Matches the SUMMARY's claimed baseline of 2391/2347 plus the 4 additional tests added by the review-fix cycle (2 in `docs-deferred-ledger.test.ts`, 1 in `audit-integrity.test.ts` for the registry-drift check, and `docs-core-value-decision.test.ts` growing from 5 to 6). |
| 19 | ROADMAP.md's Phase 17 section states a real plan count/list; Progress row reads Complete | ✓ VERIFIED | `**Plans**: 3/3 plans executed` with all three `.PLAN.md` filenames listed; Progress table row reads `3/3 \| Complete \| 2026-08-23`. |
| 20 | No `docs-*.test.ts` guard is red at the point the phase is recorded complete | ✓ VERIFIED | All six guards (`docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`, `docs-fork-decision`, `docs-linerefs`, `docs-review-disposition`) individually run: 6/6, 8/8, 6/6, 6/6, 3/3, 7/7 — all pass. |
| 21 | The Goal's false "touches no source" claim is corrected at source, not only contradicted in Notes | ✓ VERIFIED | `sed -n '/^\*\*Goal\*\*: PROJECT/,/^\*\*Depends on\*\*/p' ROADMAP.md \| grep -c 'touches no source'` → `0`; the correction appears inline in the Goal paragraph itself. |

**Score:** 20/21 truths verified (1 routed to human verification rather than mechanically resolved either way).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/docs-deferred-ledger.test.ts` | Non-vacuity test tolerating an empty pending tree | ✓ VERIFIED | 6/6 pass (4 original + 2 review-fix additions), all substantive, wired into `npm test`. |
| `.planning/STATE.md` | v0.4.0-close deferred-items ledger reading 0, derived | ✓ VERIFIED | Confirmed by direct read; matches guard's expectations exactly. |
| `.planning/PROJECT.md` | Dated CORE-01 verdict inside `## Core Value` | ✓ VERIFIED | Confirmed by direct read; substantive, not a stub. |
| `src/mcp/vice/docs-core-value-decision.test.ts` | Guard pinning the kept verdict, conditional on `keep-dated` branch | ✓ VERIFIED | File exists (verdict was `keep-dated`, so the guard was required); 6 tests (grew from the planned 5 via CR-01's fix adding `hasVerdictMarker`/test 2); demonstrated to bite on a planted flipped-verdict fixture reproducing the review's exact CR-01 attack. Excluded from `package.json` `files[]` (`grep -c` → 0) and confirmed absent from both published tarballs via `check-npm-packages.mjs`. |
| `.planning/REQUIREMENTS.md` | DEBT-04/CORE-01 ticked, Traceability closed | ✓ VERIFIED | 16/16 Complete rows; both checkboxes `[x]`; closure notes present. |
| `.planning/ROADMAP.md` | Phase 17's real plan list, outcome notes, Complete Progress row | ✓ VERIFIED | Confirmed by direct read; four transposed Phase 16/17 attributions fixed, fork-decision chain closed to its terminus. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `.planning/todos/pending/` | `.planning/STATE.md` | `docs-deferred-ledger.test.ts` derives Deferred Items in both directions | ✓ WIRED | Guard reads both directories and the STATE.md section live; 6/6 pass against the real, current empty tree. |
| `.planning/PROJECT.md` | `.planning/PROJECT.md` (Requirements → Validated) | Dated Core Value entry cites Phase 11 evidence already on record | ✓ WIRED | Entry cites `R2000-01`, `R2000-10`, `R2000-14`/`R2000-15` — all present in `## Requirements → Validated`, confirmed by grep. |
| `.planning/REQUIREMENTS.md` | `.planning/STATE.md` | DEBT-04's closure note cites the ledger count STATE.md derives and the guard pins | ✓ WIRED | Closure note names `docs-deferred-ledger.test.ts` and the specific plan/task that produced the count; count matches STATE.md exactly. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Ledger guard bites on real regression class (heading-boundary drift) even with pending empty | Read WR-01's fix (new unconditional real-data assertion checking a known constant substring) | Test present and green | ✓ PASS |
| Substring-collision false match cannot occur | Read WR-02's fix (`stemHasOwnTableCell` anchored to `\|\s*stem\s*\|`) plus its planted substring-collision test | Test present and green | ✓ PASS |
| Core Value guard actually anchors to the verdict, not to unanchored tokens | Read CR-01's fix (`VERDICT_RE`, `verdictWindow()`) and its planted flipped-verdict reproduction inside test 6 | Reproduces the review's exact attack string and asserts it is now rejected; re-ran `node --test docs-core-value-decision.test.ts` → 6/6 pass | ✓ PASS |
| Registry-drift between `audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` and disk-derived guard set is now caught | `node scripts/audit-gate.mjs --root <repo> --json` | `expectedGuardNames` (6 items) === `guardFiles` (6 items), `allowed: true`, `structuralErrors: []` | ✓ PASS |
| Full workspace suite is green | `cd src/mcp/vice && npm test` (run once, this session) | `2395 total, 2351 pass, 0 fail, 39 skipped, 5 todo, 24 suites` | ✓ PASS |
| Typecheck clean | `cd src/mcp/vice && npm run typecheck` | exit 0, no output | ✓ PASS |
| No published-tarball leakage of the new guard | `node scripts/check-npm-packages.mjs` | `check-npm-packages: OK` — 73 / 31 files respectively | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this project and none are referenced by this phase's PLAN/SUMMARY files. Step 7c: SKIPPED (no conventional or phase-declared probes for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| DEBT-04 | 17-01, 17-03 | Deferred-items ledger at v0.4.0 close is derived, guarded, and < 19 | ✓ SATISFIED | Count is 0, derived, guarded in both directions, closure note in REQUIREMENTS.md, Traceability row `Complete`. |
| CORE-01 | 17-02, 17-03 | Core Value either restated or carries a dated, evidence-weighed confirmation | ✓ SATISFIED (mechanically) / ⚠️ see Human Verification for the provenance-wording nuance | Dated `keep-dated` entry present, evidence named, reversal condition stated, pinned by a guard; provenance of the verdict itself (human-selected vs. human-attended-and-delegated) is the one item routed to human judgment. |

No orphaned requirements: `grep -n "Phase 17" .planning/REQUIREMENTS.md` surfaces only DEBT-04 and CORE-01, both declared in PLAN frontmatter (`17-01`: `[DEBT-04]`; `17-02`: `[CORE-01]`; `17-03`: `[DEBT-04, CORE-01]`).

### Anti-Patterns Found

None. Scanned every file this phase touched (`docs-deferred-ledger.test.ts`, `docs-core-value-decision.test.ts`, `audit-integrity.test.ts`, `scripts/audit-gate.mjs`, `PROJECT.md`, `STATE.md`, `REQUIREMENTS.md`, `ROADMAP.md`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and empty-stub patterns — zero matches. `npm run typecheck` clean.

### Post-Execution Code Review Disposition

A code review (`17-REVIEW.md`) filed against this phase's own three new/modified
guard files found 2 CRITICAL and 2 WARNING issues, all reproduced live against
the real tree (not merely reasoned about): CR-01 (the new Core Value guard's
predicates did not check the verdict itself — a synthetic section stating the
*opposite* conclusion passed all three checks), CR-02 (the pre-existing
`EXPECTED_DOCS_GUARD_NAMES` completeness registry in `scripts/audit-gate.mjs`
had never been extended for the 5th or 6th guard, so a named guard could
silently vanish with `allowed: true` reported), WR-01 (the ledger guard's
direction-A predicate was only exercised against synthetic data with the
pending tree empty), WR-02 (unanchored substring matching risked false
positive/negative stem collisions in both the ledger and Core Value guards).

All four were fixed (not merely dispositioned) per `17-REVIEW-FIX.md`, each
verified by reproducing the exact planted failure and confirming the fixed
guard now catches it, then reverting and confirming a clean tree. This
verification independently re-ran every fix's non-vacuity proof: `docs-core-value-decision.test.ts`
now 6/6 with the flipped-verdict reproduction present and passing;
`scripts/audit-gate.mjs --json` now reports a 6-item `expectedGuardNames`
matching the disk-derived `guardFiles`; `docs-deferred-ledger.test.ts` now 6/6
with both the real-data invariant and the substring-collision case present.
This is a genuine strengthening of the phase's own guards beyond what the
PLAN files originally specified, not a cosmetic disposition.

### Human Verification Required

### 1. CORE-01 verdict provenance — literal wording vs. attended delegation

**Test:** Read `17-02-SUMMARY.md`'s "Task 1 — Resolution Record" section and
`.planning/PROJECT.md`'s `*Provenance.*` paragraph inside `## Core Value`, and
decide whether "a human, stopped at a `gate="blocking-human"` checkpoint and
answering 298 seconds later in free text (`you decide`), explicitly delegates
the choice between two options to the orchestrating session, which then
selects one" satisfies 17-02-PLAN.md's must-have truth 3 ("The verdict
recorded ... is the option a human selected ..., not one an executor picked
while unattended") and its sibling prohibition ("MUST NOT let an executor
choose the restate-versus-keep verdict unilaterally").
**Expected:** Either (a) confirm this attended-and-delegated shape satisfies
the intent (the executor did not act "unilaterally" or "unattended" — the
primary session transcript shows the gate was rendered and a human answered it
298 seconds later in free text), or (b) determine the literal wording was not
met and record that explicitly (an override, a corrected must-have for future
phases, or an accepted-and-flagged deviation). This project's documented "you
decide" standing preference is NOT corroboration that the operator was
informed: a standing delegation is precisely what permits an uninformed answer,
so it cannot evidence comprehension. Attendance and delegation are evidenced by
transcript; comprehension is not evidenced by any artifact (corrected by plan
17-04, gap `G-17-1`).
**Why human:** This is a provenance/intent judgment call inherent to CORE-01's
own audit-integrity purpose — the exact kind of question this milestone's
guards cannot mechanically resolve (the plan's own `probe_coverage` section
flags CORE-01 as having "no data-shape axis at all" for this reason). The
project's own record is unusually candid about the distinction rather than
smoothing over it; that transparency itself is not disputed by this
verification. What remains open is only whether the disclosed shape satisfies
the plan's own stricter wording.

### 2. End-of-phase harvested human-check: does the Core Value entry read as evidence weighed?

**Test:** Read `.planning/PROJECT.md`'s `## Core Value` section end to end
(reproduced in full in this report's earlier `awk` output) and confirm: (a) it
names the verdict actually chosen; (b) it cites at least one piece of evidence
by name; (c) it engages the case against the verdict reached; (d) the reversal
condition is specific enough to tell whether it has been met.
**Expected:** All four sub-criteria hold. (This verifier's own reading found
all four satisfied — the entry names `keep-dated`, cites `R2000-01`/Phase
11's sealed-question test/the symbol round trip by name, contains an explicit
"Case against this verdict, carried rather than resolved" paragraph naming the
sealed-question test as this project's strongest evidence, and states two
concrete, checkable reversal triggers.)
**Why human:** 17-02-PLAN.md's task 2 `<verify>` block explicitly assigns this
check to a human ("An entry reading only 'Core Value confirmed, no change
needed' fails this check even though it would pass the automated one") and
defers it to end-of-phase per `workflow.human_verify_mode: end-of-phase`. It is
harvested here per this agent's Step 8 instructions rather than treated as
satisfied by the verifier's own read alone.

### Gaps Summary

No blocking gaps. All mechanically-checkable must-haves across all three
plans verified against the live codebase: the ledger guard and STATE.md ledger
both read the true 0 count with full derivation shown; the CORE-01 verdict is
dated, evidence-citing, guarded, and correctly scoped inside `## Core Value`;
REQUIREMENTS.md's Traceability table closes at 16/16 with evidence-citing
closure notes; ROADMAP.md's Phase 17 section (including its own previously
false "touches no source" claim) is corrected; the full `npm test` suite is
green (2395/2351/0 fail) and all six `docs-*.test.ts` guards are green; a
post-execution code review's four findings against this phase's own new guard
files were genuinely fixed (not dispositioned away) and independently
re-verified in this session. The one item routed to human judgment is a
provenance-wording nuance around the CORE-01 verdict's selection versus
delegation, which the project's own record discloses candidly rather than
concealing — routing it to a human for a final call is the correct outcome
given that candor, not evidence of a defect.

---

_Verified: 2026-08-23_
_Verifier: Claude (gsd-verifier)_
