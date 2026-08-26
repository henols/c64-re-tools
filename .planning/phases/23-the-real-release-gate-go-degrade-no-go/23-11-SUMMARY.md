---
phase: 23-the-real-release-gate-go-degrade-no-go
plan: 11
subsystem: planning
tags: [verdict, gate, traceability, roadmap, state, requirements, no-go, R1]

requires:
  - phase: 23-10
    provides: "docs/phase23-real-release-gate-findings.md carrying machine-readable `verdict: no-go` and `verdict_rule_applied: R1`, the rule reproduced verbatim, and the corpus/instrument identity this plan transcribes"
  - phase: 23-04
    provides: "evidence/criterion4-analyzer-audit.md — the only criterion measured, and the evidence PROOF-04's completion rests on"
  - phase: 23-01
    provides: "evidence/DECISION-RULE.md — R1's text, reproduced here as the pre-committed consequence rather than re-authored"
provides:
  - "Phase 24's ROADMAP `**Depends on**` line names `docs/phase23-real-release-gate-findings.md` and the `verdict` / `verdict_rule_applied` fields literally — with D-08 having declined a test guard deliberately, this pointer is the entire enforcement mechanism for the gate"
  - "R1's own consequence written BESIDE the success criteria of Phases 24, 25 and 26, every one of which is left byte-identical"
  - "STATE.md carrying the verdict, the fired rule, the firing input, the corpus identity, the instrument pins and the literal findings path — as a pointer, with no per-criterion value copied"
  - "An honest PROOF traceability: PROOF-04 and PROOF-05 Complete on named evidence; PROOF-01/02/03 Pending with the reason on the row"
  - "Proof that Phase 23 shipped zero product code: `git diff --name-only` from the phase base touches only `.planning/` and `docs/`"
  - "A full-suite regression gate at 2593 pass / 0 fail, plus the repaired Deferred Items row that had reddened it"
affects: [24-the-two-engines, 25-the-annotation-store-and-the-cutover, 26-automatic-annotation]

actuals:
  tokens: 11400
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A verdict is bound by pointer, never by copy: the tracking artifacts name the findings document and the field to read, and restate no criterion value"
    - "A scope amendment is written beside a downstream phase's success criteria as a Notes line, never over the criteria themselves"
    - "A traceability row that would assert an unperformed measurement stays Pending with the reason on the row; the plan's own verify is recorded unsatisfiable rather than satisfied"
    - "Filing a pending todo and adding its Deferred Items row are one action, not two — the same guard went red on the same cause two plans running"

key-files:
  created:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-11-SUMMARY.md
  modified:
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md
    - .planning/WINDOWS.md

key-decisions:
  - "The verdict is bound as a pointer, not a copy: no per-criterion outcome value is restated in ROADMAP.md or STATE.md, because a second copy is a second thing that can drift out of agreement with the findings document"
  - "PROOF-01/02/03 are recorded NOT met and left Pending with the reason on the row, against 23-11-PLAN.md's instruction to flip all five — that instruction was written before the verdict existed and assumed the criteria had been measured; they were not"
  - "R1 carries no pre-mapped per-requirement narrowing, so no DXA-*, GHID-*, OPC-*, STORE-*, CUT-* or AUTO-* requirement is narrowed by name; AUTO-04/AUTO-05 are unvalidated rather than narrowed"
  - "ROADMAP.md was hand-edited with scoped replacements and `roadmap.update-plan-progress` was deliberately not called, because the verb derives status from summaries-vs-plans and would have written `In Progress` over a phase that is complete with five plans deliberately not dispatched"
  - "The missing Deferred Items row for the back-05 todo was added (deviation): docs-deferred-ledger.test.ts direction A was red on it, on exactly the cause plan 23-10 had already answered once with commit 646d4d0"

patterns-established:
  - "Completeness is reported as 'N executed, M deliberately not dispatched, with the reason' wherever a plan count appears — never as a bare fraction that reads as failure, and never as N/N"
  - "A downstream phase's anticipated narrowing that the fired rule did not authorise is recorded as NOT triggered, naming which rule owned it and why it was never evaluated"

requirements-completed: [PROOF-04, PROOF-05]

coverage:
  - id: D1
    description: "Phase 24's ROADMAP entry names the verdict document by literal path and the `verdict` field a planner must read, in the `**Depends on**` line and again in the Notes"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "awk '/^### Phase 24:/,/^### Phase 25:/' .planning/ROADMAP.md | grep -qE '^\\*\\*Depends on\\*\\*:.*phase23-real-release-gate-findings\\.md' — plus 2 occurrences of the path inside the Phase 24 block"
        status: pass
    human_judgment: false
  - id: D2
    description: "R1's consequence is written beside the success criteria of Phases 24, 25 and 26, and every success criterion is left byte-identical"
    verification:
      - kind: other
        ref: "git diff -U0 7e01bd6 -- .planning/ROADMAP.md removes no line matching '^-  [0-9]+\\. '; each of Phases 23-26 still shows exactly 5 numbered criteria; git diff --numstat = 21 insertions / 14 deletions confined to Plans, Depends-on, Notes and the Progress row"
        status: pass
    human_judgment: false
  - id: D3
    description: "STATE.md carries the verdict, the fired rule, the firing input, the corpus identity (both releases with their file_sha256, and capture_sha256 recorded could-not-run), the instrument pins and the literal findings path — with no per-criterion outcome value copied"
    verification:
      - kind: other
        ref: "STATE.md § Decisions, four new [Phase 23] 23-11 entries; the plan's own automated check printed STATE-OK; the only C4_ value in the file is 23-04's pre-existing line, not one this plan added"
        status: pass
    human_judgment: true
    rationale: "That the pointer restates nothing a reader would otherwise have to reconcile against the findings document is a reading judgement, not a grep result — the mechanical check can only prove specific strings absent"
  - id: D4
    description: "PROOF-04 and PROOF-05 read Complete on named evidence; PROOF-01, PROOF-02 and PROOF-03 read Pending with the reason on the row and a bullet under each requirement naming what was never measured"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "grep -qE '^\\| PROOF-0[45] \\| Phase 23 \\| Complete \\|' and grep -qE '^\\| PROOF-0[123] \\| Phase 23 \\| Pending \\| not met' over .planning/REQUIREMENTS.md — both pass"
        status: pass
    human_judgment: true
    rationale: "Whether a requirement is HONESTLY complete is the judgement this plan exists to get right, and the plan it executes asked for the opposite answer; a human should confirm the two flips rest on evidence and the three non-flips on the absence of it"
  - id: D5
    description: "The five non-dispatched plans are named with their reason wherever completeness is reported — the milestone checklist, the Plans line, each plan line, STATE.md's Current Position, and the REQUIREMENTS closing note — and nothing reads 11/11"
    verification:
      - kind: other
        ref: "ROADMAP '**Plans**: 11 plans — **6 executed** … **5 deliberately NOT dispatched**'; each of 23-05..23-09 carries '**NOT dispatched**'; STATE Current Position states 'not 11/11, and not five failures'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 23 is proven to have shipped zero product code, and the full test suite is green"
    verification:
      - kind: other
        ref: "git diff --name-only d6cf1ba~1..HEAD | grep -vE '^(.planning/|docs/)' → 0 lines (57 paths, all .planning/ or docs/); agrees with evidence/README.md § Repo integrity plus 23-10-SUMMARY.md and the back-05 todo"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && npm test → # tests 2638  # pass 2593  # fail 0  # skipped 40  # todo 5"
        status: pass
    human_judgment: false

duration: 22 min
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 11: Bind the Verdict — Summary

**Phase 23's recorded `no-go` (rule `R1`) is now unavoidable for whoever plans Phase 24 — named in the `**Depends on**` line and Notes they read first, pointed at from STATE.md, with `R1`'s consequence written beside three phases' success criteria and none of them touched — and the PROOF traceability tells the truth: two requirements met, three recorded not met with their reason.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-26T15:36:00Z
- **Completed:** 2026-08-26T15:58:00Z
- **Tasks:** 3
- **Files modified:** 4 (`.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/WINDOWS.md`), 1 created

## Accomplishments

- **The gate is enforced where it will actually be read.** Phase 24's `**Depends on**` line now names `docs/phase23-real-release-gate-findings.md` and the `verdict` field literally, adds `verdict_rule_applied` as the field naming the rule, and states the recorded values (`no-go`, `R1`). Its existing "Verdict-gated" Notes line was **extended** with the same path rather than joined by a second competing instruction. Phases 25 and 26 got the same treatment on their own Verdict-gated lines. With D-08 having deliberately declined a test guard, these pointers *are* the enforcement mechanism.
- **`R1`'s consequence is written beside, never over.** One `Scope amendment` Notes line under each of Phases 24, 25 and 26, reproducing R1's own text — *"The milestone becomes: secure a corpus first, or re-scope v0.6.0 to a claim explicitly qualified as fixture-only"* — and stating plainly that `R1` carries **no** pre-mapped per-requirement narrowing. All fifteen downstream success criteria are byte-identical; the diff removes no numbered criterion line.
- **Phase 24's note names the single remaining obstacle**, so the re-scope decision can be taken on evidence: hex transcription is **solved** (extract the 64K from a VICE `.vsf` `C64MEM` module body, validated against 23-03's own transcript), and what remains is **one** thing — the fork's stopping exec checkpoint is not frame-exact, and snapshot-to-snapshot the two `danish` runs still diverge at **201 multi-bit addresses**. Both facts are recorded as explicitly *not* having changed the verdict.
- **STATE.md points, it does not copy.** Four new `### Decisions` entries carry the verdict, the fired rule, the firing input, both releases' `file_sha256` with `capture_sha256` recorded `could-not-run`, the dxa/Ghidra/VICE pins, and the literal findings path — and no per-criterion outcome value. Current Position reads Phase 23 complete and Phase 24 verdict-gated; Roadmap Evolution records that the v0.6.0 gate fired and what it returned.
- **The traceability is honest.** `PROOF-04` (the offline `analyzer.rs` audit, which needed no capture) and `PROOF-05` (the machine-readable verdict from pre-committed rules) read **Complete** with their evidence named. `PROOF-01`, `PROOF-02` and `PROOF-03` read **Pending** with the reason on the row — their criteria were never measured because no depacked flat-64K capture exists. No fourth status value was invented.
- **Zero product code, and a green suite.** `git diff --name-only` from the phase base lists 57 paths, every one under `.planning/` or `docs/`; the list agrees with `evidence/README.md` § *Repo integrity* plus exactly the two files added after that section was written. The full `npm test` — not the automated subset — is **2593 pass / 0 fail**, matching the broker-free reading the orchestrator recorded.

## Task Commits

1. **Task 1: Point Phase 24's entry at the verdict and write the amendments beside the criteria** — `edad925` (docs)
2. **Task 2: Record the verdict in STATE.md as a pointer, not a copy** — `973edb9` (docs)
3. **Task 3: Flip the PROOF traceability and prove the phase changed no product code** — `c9970ed` (docs)

**Plan metadata:** see the `docs(23-11): complete` commit.

## Files Created/Modified

- `.planning/ROADMAP.md` — Phase 23 ticked and its Plans line reconciled to 11 plans / 6 executed / 5 deliberately not dispatched; each non-dispatched plan line annotated; a verdict Notes line under Phase 23; Phase 24's `**Depends on**` line and Notes naming the findings path and the `verdict` field; one scope-amendment Notes line under each of Phases 24, 25 and 26; Progress row 23 → `6/11 | Complete | 2026-08-26`; the milestone roll-up recording that the gate fired.
- `.planning/STATE.md` — four `### Decisions` entries (the pointer, the no-narrowing fact, the honest traceability position, the single remaining blocker); one `### Roadmap Evolution` line; Current Position advanced with the handler-clobbered Status line repaired; the missing `back-05` Deferred Items row added and the surrounding count prose corrected.
- `.planning/REQUIREMENTS.md` — PROOF-04/05 ticked and Complete; PROOF-01/02/03 left Pending with a per-requirement `NOT met` bullet and a Notes cell; a Notes column added to the traceability table (all rows padded); a Phase 23 closing note recording 2 of 5 requirements met and 6 of 11 plans executed; footer dated.
- `.planning/WINDOWS.md` — two ledger entries: `unmet-truth` for PROOF-01/02/03, `unrun-verify` for this plan's Task 3 verify.

## Decisions Made

- **Bind by pointer, never by copy.** The prohibition was honoured strictly: no per-criterion outcome value was added to either tracking file. Where a draft entry had quoted criterion 4's value it was rewritten to cite the evidence file instead. The one criterion value that *does* appear in new text is `C0_CORPUS: partial`, because it is `R1`'s firing input and Task 2's action explicitly required it.
- **`roadmap.update-plan-progress` was deliberately not called.** It derives status from summaries-vs-plans on disk and would have written `In Progress` over a phase that is complete with five plans deliberately not dispatched. ROADMAP.md was hand-edited with scoped replacements instead — the plan's prohibition on hand-editing covers STATE.md's *frontmatter counters*, which were left entirely to the handlers.
- **STATE.md's frontmatter counters stay handler-derived, and the body says so.** `state.advance-plan` moved Plan 5 → 6 and clobbered the Status line (a known behaviour on this project); the Status line was repaired and now states explicitly that the counters read 6/11 plans and 0/4 phases because five plans were deliberately not dispatched — the phase is complete in fact while incomplete by plan count. No literal percentage is asserted anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] PROOF-01/02/03 recorded NOT met, against the plan's instruction to flip all five to Complete**

- **Found during:** Task 3
- **Issue:** `23-11-PLAN.md` Task 3 instructs "Flip PROOF-01 through PROOF-05 from `Pending` to `Complete`". That instruction was authored before the verdict existed and assumed all five criteria had been measured. They were not: `PROOF-01`, `PROOF-02` and `PROOF-03` each require the depacked flat-64K capture and the criteria measured on it; no capture exists, plans 23-05..23-09 were never dispatched, and the findings document records their criteria `could-not-run`. Marking them Complete would make the traceability table assert a measurement that was never taken — the one thing a traceability table exists to prevent. 23-10 had already reached the same conclusion from the other direction, leaving the file untouched when `requirements.ready-ids` returned 0/5 ready.
- **Fix:** `PROOF-04` and `PROOF-05` flipped to Complete with their evidence named. `PROOF-01/02/03` left `Pending` with `not met` and the reason in the new Notes cell, plus a bullet under each requirement naming exactly what was not measured. No fourth status value invented. A closing note under the table states 2 of 5 met.
- **Consequence for Task 3's own verify:** the automated check (`all five rows read Complete`) is **recorded failing and unsatisfiable** rather than satisfied — `NOT COMPLETE: PROOF-01`, exit 1. This follows the phase-wide, operator-confirmed precedent set by 23-02, 23-03 and 23-10: where a plan's verify disagrees with the facts, the evidence is not bent. A substituted check asserting the corrected shape (04/05 Complete, 01-03 Pending-with-reason, plus the repo-integrity clause) passes: `TRACEABILITY-OK-AS-CORRECTED`.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Committed in:** `c9970ed`

**2. [Rule 3 - Blocking] The findings document has no `### Scope amendments` section**

- **Found during:** Task 1
- **Issue:** Task 1 instructs "For each entry in the findings document's `### Scope amendments`, add a Notes line…". No such section exists in `docs/phase23-real-release-gate-findings.md` — its heading list runs `## Verdict`, `### What the milestone becomes instead`, `## Inputs that were never evaluated…`, and so on. `R1` is not one of the pre-mapped-narrowing rules (`R6` and `R7` are), so there was no per-requirement amendment list to carry.
- **Fix:** the amendment carried is `R1`'s own consequence, reproduced verbatim from `### What the milestone becomes instead`, as one Notes line under each of Phases 24, 25 and 26 — each also stating explicitly that `R1` carries no pre-mapped per-requirement narrowing, so no requirement is narrowed by name. Phase 26's note additionally records that the `AUTO-04`/`AUTO-05` narrowing its own prior note anticipated **was not triggered**, because it belonged to `R7`, which under first-match-wins was never evaluated.
- **Files modified:** `.planning/ROADMAP.md`
- **Committed in:** `edad925`

**3. [Rule 3 - Blocking] Missing Deferred Items row reddened `docs-deferred-ledger.test.ts`**

- **Found during:** Task 3 (the regression gate)
- **Issue:** the first full `npm test` came back `# fail 4`, and the failing identities were **not** the recorded flake set (`159`, `916`, `2408`, `2410`) — they were `docs-deferred-ledger.test.ts` direction A, its planted-violation control, and the `audit-integrity.test.ts` cascade that reddens on any red docs guard. Cause: commit `ffd6eac` filed `.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md` without adding the matching row to STATE.md's Deferred Items table, which direction A requires per pending todo file. Introduced before this plan started, and confirmed against `git show` on the pre-plan tree.
- **Fix:** added the row (`testing | 2026-08-26-back-05-… | minor | Pending`) and corrected the surrounding prose from "the four rows above … three on 2026-08-26" to five and four, with a sentence recording that the same guard went red on the same cause two plans running (23-10 answered it with commit `646d4d0`). Also corrected the stale "ledger below reads **0 open** pending todos" line, which the four earlier rows had already falsified, to `5 open`.
- **Verification:** `node --test docs-deferred-ledger.test.ts` → 6/6 pass; full `npm test` → `# pass 2593  # fail 0`.
- **Files modified:** `.planning/STATE.md`
- **Committed in:** `c9970ed`

---

**Total deviations:** 3 auto-fixed (1 correctness, 2 blocking)
**Impact on plan:** No scope creep. Deviation 1 changes the plan's *answer*, not its shape — the traceability was still closed on this plan's evidence, as designed, and the correction is what makes the closure honest. Deviations 2 and 3 were both instructions or gates that could not be satisfied as written; neither added work outside the three files this plan owns.

## Issues Encountered

- **The regression gate's failing set did not match the recorded one.** The orchestrator's note said the suite is green on a broker-free host, with a known flake set of `159`/`916`/`2408`/`2410`. The first run here failed on three entirely different, docs-guard-shaped tests. Comparing failing identity against the recorded set before assuming a self-inflicted regression — exactly as the orchestrator instructed — is what located the real cause in one step (deviation 3). After the fix, the suite reproduces the recorded green run exactly: `2638 tests / 2593 pass / 0 fail / 40 skipped / 5 todo`.
- **`npm test` again left the Phase 18 transcript dirty**, as `deferred-items.md` item 1 predicts. Restored with `git checkout --` on that exact path before staging. Every file was staged individually.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Phase 23 is closed. Nothing downstream is ready to plan until a milestone decision is taken, and this plan deliberately does not take it.**

- The verdict is `no-go`, rule `R1`, and `R1` hands back a two-branch choice its own text names: **secure a corpus first**, or **re-scope v0.6.0 to a claim explicitly qualified as fixture-only**. Whoever plans Phase 24 reads that before writing a plan, through the `**Depends on**` line and Notes. No Phase 24, 25 or 26 plan was written, amended or pre-empted here.
- **The first branch is cheaper than it looks, and its cost is one specific thing.** A frame-exact stop is the single gate: hex transcription is solved and validated, and the remaining divergence — 201 multi-bit addresses between two `danish` runs, snapshot-to-snapshot with no transcription anywhere — is machine nondeterminism from a checkpoint that reports the hit about a frame of work late. Nothing in the milestone can be measured on real code until that is solved.
- **Three requirements remain genuinely open** (`PROOF-01`, `PROOF-02`, `PROOF-03`) and are recorded as such rather than closed. They are not re-openable debt discovered later; they are Pending now, with the reason on the row.
- **`AUTO-04` and `AUTO-05` are unvalidated, not narrowed.** Phase 26's most exposed criterion has no observation behind it in either direction. Its ROADMAP note says so.
- Repository state is clean: zero product code across the whole phase, and the full suite green.

---
*Phase: 23-the-real-release-gate-go-degrade-no-go*
*Completed: 2026-08-26*
