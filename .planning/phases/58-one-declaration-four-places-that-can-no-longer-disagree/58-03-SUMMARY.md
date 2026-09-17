---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
plan: 03
subsystem: docs
tags: [citation-ledger, provenance, tdd, node-test, requirements]

requires:
  - phase: 58-one-declaration-four-places-that-can-no-longer-disagree
    provides: "prerequisites.json, prerequisites.test.ts, docs/phase58-declaration-provenance.md (plans 58-01, 58-02)"
provides:
  - "A mechanically-falsifiable citation ledger over docs/phase58-declaration-provenance.md, run inside npm run test:automated"
  - "Both wrong file:line citations 58-VERIFICATION.md flagged (REQUIREMENTS.md, ci.yml) corrected by re-derivation, not transcription"
  - "unp64's exclusion from the declaration recorded in writing as DECL-F3, with a named downstream owner (Phase 61)"
affects: ["60-the-seam-wired-into-the-code-that-ships", "61-vice-mcp-doctor-reachable-on-a-node-too-old-to-run-the-server"]

actuals:
  tokens: 8516
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Citation ledger: a fenced json block of {citation, anchor} pairs inside a markdown document, re-verified against the live cited files on every test run -- mirrors phase50-findings-contract.test.ts's colocated-audit-function shape"

key-files:
  created:
    - src/mcp/vice/phase58-citation-ledger.test.ts
  modified:
    - docs/phase58-declaration-provenance.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The ledger lives inside the provenance document as a fenced json block, not a sidecar file, so citation and anchor stay visible to the human reader who is the document's whole audience"
  - "Anchor matching is a raw substring test with no normalisation, no trim, no case folding -- the document quotes real source text and any normalisation would let the check accept text the file does not literally carry"
  - "unp64 is recorded as an owned deferral (DECL-F3) rather than added as a ninth prerequisites.json record -- ROADMAP SC1's closed eight-tool list is the phase's own scope, not an oversight"

patterns-established:
  - "Citation ledger pattern: any future document whose entire content is falsifiable citations should carry a machine-read ledger of {citation, anchor} pairs rather than relying on a path-existence check"

requirements-completed: [DECL-01, DECL-02, DECL-04, DECL-05]

coverage:
  - id: D1
    description: "Both wrong file:line citations 58-VERIFICATION.md flagged are corrected by live re-derivation (REQUIREMENTS.md:88->85->86, ci.yml:70-72->80-81)"
    requirement: "DECL-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/phase58-citation-ledger.test.ts#the committed provenance document's citation ledger is complete and every anchor resolves"
        status: pass
      - kind: other
        ref: "grep -anF derivation commands in this plan's <verify> blocks, re-run live during execution"
        status: pass
    human_judgment: false
  - id: D2
    description: "A citation-ledger structural guard (resolution, completeness, no-orphans, non-vacuity relations) runs inside npm run test:automated with no test-gate.mjs edit"
    requirement: "DECL-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/phase58-citation-ledger.test.ts (10/10 passing)"
        status: pass
      - kind: integration
        ref: "npm run test:automated (3713 tests / 3704 pass / 0 fail / 9 skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard is proven non-vacuous on real content: it named the stale REQUIREMENTS.md citation before correction (twice -- once for the plan's pre-existing defect, once for this plan's own DECL-F3 edit), and returned empty after"
    verification:
      - kind: unit
        ref: "captured TAP output, see 'Non-vacuity evidence on real content' below"
        status: pass
    human_judgment: false
  - id: D4
    description: "unp64's omission from the declaration is recorded as an owned deferral (DECL-F3) with a named downstream consequence, not left as an unowned advisory"
    requirement: "DECL-01"
    verification: []
    human_judgment: true
    rationale: "Whether the written record faithfully captures the owner's scope intent is a judgment only the owner can make (58-VERIFICATION.md's human_verification item 2); this SUMMARY records what was written, not that the owner has re-confirmed it"

duration: 55min
completed: 2026-09-17
status: complete
---

# Phase 58 Plan 3: Citation-Ledger Guard and unp64 Deferral Summary

**A machine-read citation ledger inside `docs/phase58-declaration-provenance.md`, enforced by a new `phase58-citation-ledger.test.ts` structural gate, closes both wrong `file:line` citations `58-VERIFICATION.md` flagged and records `unp64`'s exclusion as `DECL-F3`.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-17T18:50:00Z
- **Completed:** 2026-09-17T19:45:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built `src/mcp/vice/phase58-citation-ledger.test.ts`: a colocated audit (`parseCitationLedger`, `extractCitations`, `auditProvenanceCitations`) enforcing four relations over the provenance document's citations -- resolution (anchor found in the cited range), completeness (every body citation is ledgered), no-orphans (every ledger entry occurs in the body), and non-vacuity (an empty ledger against a citing document fails). 10 test cases, all passing, discovered automatically by `automatedTestFiles()` with no `test-gate.mjs` edit.
- Corrected both citations `58-VERIFICATION.md` and the committed `58-REVIEW.md` (WR-01, WR-02) had already flagged: `.planning/REQUIREMENTS.md:88` -> `:85` (both occurrences in Case one), and `.github/workflows/ci.yml:70-72` -> `:80-81` (the actual tee/grep banner check, not the `retry_apt` failure branch it previously pointed at). Both re-derived live via `grep -anF`, never copied from this plan or the review.
- Made the ledger total: all 21 distinct citations the document made after Task 2 (25 after Task 3's own additions) now carry a ledger entry with an anchor re-derived from the live cited file.
- Recorded `unp64`'s exclusion as `DECL-F3` in `.planning/REQUIREMENTS.md`'s Future Requirements, and added a new "Case six" section to the provenance document naming the reason (ROADMAP SC1's closed eight-tool list), the owning requirement, and the downstream phase (61) that first feels the consequence.
- Caught a real citation drift the moment it happened: adding `DECL-F3` shifted the `.planning/REQUIREMENTS.md` line the ledger's own guard cites (85 -> 86); the audit named the stale citation before correction and returned empty after -- the guard catching a defect on the first edit after being built.

## Task Commits

Each task followed RED -> GREEN (Tasks 1 and 2 are `tdd="true"`; Task 3 is `type="auto"`):

1. **Task 1: One citation proven end to end** -- RED `3874b667` (`test(58-03): add failing tests for citation-ledger resolution audit`), GREEN `de9e02fe` (`feat(58-03): implement citation-ledger resolution audit, correct Case one's REQUIREMENTS.md citation`)
2. **Task 2: The ledger made total, totality enforced** -- RED `5c3e3cd6` (`test(58-03): add failing tests for completeness, no-orphans, non-vacuity, encoding and ordering relations`), GREEN `cce31493` (`feat(58-03): make the citation ledger total and correct the ci.yml banner-grep citation`)
3. **Task 3: The unp64 deferral recorded** -- `678534cb` (`docs(58-03): record the unp64 deferral as DECL-F3, re-derive the drifted REQUIREMENTS.md citation`)

No REFACTOR commits were needed -- both TDD tasks' GREEN implementations were left as first-written; nothing needed cleanup.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| Task 1 | `3874b667` | `de9e02fe` | none needed | Pass |
| Task 2 | `5c3e3cd6` | `cce31493` | none needed | Pass |

Both RED commits were verified via `gsd_run check tdd-red-evidence` before any implementation code was written:
- Task 1 target test `"the committed provenance document's citation ledger is complete and every anchor resolves"` -> `RED_EVIDENCE_OK`.
- Task 2 target test `"structural (non-vacuity): a citation in the body with no ledger entry is reported"` -> `RED_EVIDENCE_OK`.

## Non-vacuity evidence on real content

Required by the plan as evidence, not narration -- captured live during execution, not asserted after the fact.

**Task 1 -- the historical WR-01 defect, before and after correction:**

Before (ledger written with the document's then-current, wrong citation):
```
+ [
+   '.planning/REQUIREMENTS.md:88: anchor "No shipped tool refuses on one." not found in cited range; actual text: "| Byte-identical guarding of the generated README | Owner decision 2026-09-13 removes that assertion class. `ENGINEERING_RULES.md` §11 already permits \"an equivalent deterministic drift check\" |"'
+ ]
- []
```
After (citation corrected to the live-derived line 85): `# pass 1`, `# fail 0`.

**Task 3 -- the guard catching its own plan's edit, before and after correction:**

Before (DECL-F3 added to REQUIREMENTS.md, shifting the target row from line 85 to 86, citation not yet updated):
```
+ [
+   '.planning/REQUIREMENTS.md:85: anchor "No shipped tool refuses on one." not found in cited range; actual text: "| `VICE_BROKER_NODE` moving into `tools.json` | `vice-launcher.sh` is bash and reads it before any working Node exists to parse JSON with |"'
+ ]
- []
```
After (citation corrected to the newly-derived line 86): `# pass 1`, `# fail 0`.

This is the guard rejecting a real, non-synthetic drift on the very first edit made after it was built -- the strongest evidence this closure can produce that the mechanism works, on top of the planted-fixture cases in the test suite itself.

## Files Created/Modified

- `src/mcp/vice/phase58-citation-ledger.test.ts` -- the citation-ledger audit and its 10-case test suite (resolution, planted shift, path confinement, range semantics, completeness, no-orphans, non-vacuity, encoding, ordering, automated-gate membership)
- `docs/phase58-declaration-provenance.md` -- corrected Case one and Case three citations, added a total Citation ledger section (25 entries), added a "Case six" section recording the `unp64` deferral, added one sentence to Case three on the `measured` grade's actual scope
- `.planning/REQUIREMENTS.md` -- added `DECL-F3` under Future Requirements > Declaration

## Decisions Made

- The ledger's anchor is deliberately redundant: re-asserted against the cited file's live text on every run, never cached or trusted on its own, so it can never itself drift into a second unfalsifiable source of truth.
- `unp64` stays a deferral (`DECL-F3`), not a ninth `prerequisites.json` record -- reversing that call would require amending ROADMAP SC1 and extending `prerequisites.test.ts`'s required-id set, which is out of this plan's scope and was the owner's call to make, made in the planning session.
- The `node` record's `unblocks.mcp` list is left unedited: it enumerates every `HOST_TOOL_IDS` member (verified: both lists are identical, 12 entries, same order), so it is not a misfiling of `oracle.probe`/`oracle.run` -- the missing fact is the absent second gate (`unp64` itself), which Case six's new prose states rather than fixing with a `prerequisites.json` edit this plan is not scoped to make.

## Deviations from Plan

### Auto-fixed Issues

None -- no bugs, missing critical functionality, or blocking issues were encountered that required Rule 1-3 auto-fixes.

### Verify-script precision notes (not defects, disclosed per the executor's own honesty obligation)

Three of this plan's own `<fails_when>` thresholds do not match reality once the ledger the plan itself mandates exists, in each case because the check's grep scope is slightly wider than the fact it means to test. None of these are bugs in the implementation; all are documented here rather than silently worked around, per the plan's own "the mechanism ... converts an unfalsifiable prose claim into a check" ethos -- a verify script is not exempt from that scrutiny.

**1. `cited_at_derived` reads 3, not 2 (Task 1 and Task 3 verify blocks).** The check greps the WHOLE document (prose + ledger) for the derived `.planning/REQUIREMENTS.md:NN` string. Case one's prose cites it twice (introduction and "wins" restatement) by design, and the ledger -- which Task 1's own action text requires adding in the same task -- necessarily carries the identical string a third time. `distinct_req_citations` (which the same command computes) correctly reads 1 throughout, confirming no drift; the raw line-count check simply did not anticipate that its own mandated ledger entry would also match the substring it greps for.

**2. `decl_traceability_rows` reads 5, not 4 (Task 3 verify block).** The regex `^\| DECL-0[12345] \|` matches `DECL-03` (a pre-existing, untouched Phase 60 row) in addition to the four Phase 58 rows (`DECL-01/02/04/05`) the check means to assert are unedited. Confirmed by direct inspection: the four Phase 58 rows are present with their pre-plan statuses (`Gaps Found`, `Gaps Found`, `Complete`, `Complete`) unedited by this task; `DECL-03`'s row (`Phase 60 | Pending`) is untouched and unrelated to this closure.

**3. The Phase 58 ROADMAP slice's `unp64` grep reads 1, not 0 (Task 3 acceptance criterion).** Success Criterion 1's own tool-list line (`... covering x64sc, c1541, petcat, the ACME binary, ...`) does not name `unp64`, confirmed directly. The one match in the section-wide grep is the *pre-existing* `58-03-PLAN.md` Plans-list bullet ("records the `unp64` ninth-tool deferral decision"), written by the planner before this execution to describe this very plan -- not part of Success Criterion 1 and not edited by this task.

---

**Total deviations:** 0 auto-fixed. 3 verify-script precision notes disclosed above.
**Impact on plan:** None on correctness -- every underlying fact the three checks intended to protect (citation consistency, Phase 58 requirement statuses, Success Criterion 1's tool list) is confirmed correct by direct inspection; the checks' own grep scopes were slightly wider than their intent.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `58-VERIFICATION.md`'s one gap (the two wrong citations) is closed, and the mechanism that let them ship without detection now runs in `npm run test:automated`.
- `unp64`'s scope question has a written record (`DECL-F3` plus the new provenance case); `58-VERIFICATION.md`'s human-verification item 2 (owner confirmation that the record matches intent) is unresolved by this plan and remains a human task.
- `58-VERIFICATION.md`'s human-verification item 1 (`decl-02-node18-proof` real-runner execution) is untouched by this plan, as required -- nothing was pushed to origin. **Explicit confirmation: no `git push` of any kind was run during this plan's execution.**
- Phase 58 requirements: `DECL-04` and `DECL-05` remain `Complete` (untouched, re-confirmed by the full automated suite). `DECL-01` is advanced by this closure's citation correction and totality guard. `DECL-02` is carried only, per the plan's own `requirement_honesty` table -- this plan touches no CI job.

## Self-Check: PASSED

- `[ -f src/mcp/vice/phase58-citation-ledger.test.ts ]` -> FOUND
- `git log --oneline --all | grep -q 3874b667` -> FOUND
- `git log --oneline --all | grep -q de9e02fe` -> FOUND
- `git log --oneline --all | grep -q 5c3e3cd6` -> FOUND
- `git log --oneline --all | grep -q cce31493` -> FOUND
- `git log --oneline --all | grep -q 678534cb` -> FOUND
- Re-ran all `<acceptance_criteria>` for all three tasks: pass (with the three verify-script precision notes disclosed above, none of which indicate an implementation defect)
- Re-ran the plan-level `<verification>` block: `npm run test:automated` (3713/3704/0/9), `npm run typecheck` (clean), `prerequisites.test.ts` (20/20), structural sweep (`unledgered=[]`, `orphans=[]`, `body_citations=25`, `later_headings=[]`), all three artifacts present by content.

---
*Phase: 58-one-declaration-four-places-that-can-no-longer-disagree*
*Completed: 2026-09-17*
