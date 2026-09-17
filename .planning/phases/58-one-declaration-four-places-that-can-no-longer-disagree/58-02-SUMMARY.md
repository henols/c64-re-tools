---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
plan: 02
subsystem: docs
tags: [provenance, readme, prerequisites, ci, documentation]

# Dependency graph
requires:
  - phase: 58-one-declaration-four-places-that-can-no-longer-disagree
    provides: "src/mcp/vice/prerequisites.json -- the committed declaration this doc records the provenance reasoning for"
provides:
  - "docs/phase58-declaration-provenance.md -- the human-readable record of every case where two in-tree sources disagreed about a prerequisite fact, which one the declaration followed, and why"
  - "README.md's VICE-version-compatibility prose corrected to state the measured fact (no shipped tool refuses on a VICE version) instead of the previously-shipped false consequence"
affects: [60-repoint-the-live-refusals, 61-the-prerequisite-doctor, 62-generate-the-readme-table]

# Actuals (#2632)
actuals:
  tokens: 4589
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live CI-run evidence (gh api repos/.../actions/jobs/<id>/logs) cited directly in a docs file, rather than an assumed runner image version, to keep a 'measured' provenance claim honest -- gh run view --log returned empty output for this repo's runs; gh api against the job-logs endpoint was the working fallback."

key-files:
  created:
    - docs/phase58-declaration-provenance.md
  modified:
    - README.md

key-decisions:
  - "Every disagreement case in the provenance doc quotes both sides in their own words with a file:line citation and states why the winning side won, per D-04's split of per-string provenance (JSON) from provenance reasoning (this doc)."
  - "The one 'measured' provenance grade (acme/linux/ubuntu) is backed by a live-fetched CI run log (run 35225137192, 2026-09-17) rather than an assumed runner image version -- ubuntu-latest resolved to ubuntu24/20260907.300 (Ubuntu 24.04.5 LTS) and installed acme 1:0.97~svn20211115+ds-1, confirmed via the banner grep. This is recorded as an observation about the install command, not a pin on the image or package version, since a future run could resolve differently."
  - "The README correction was scoped to exactly README.md:117-123 (the 'What a sub-3.10 VICE costs' section, renamed to 'VICE version compatibility'). The generated install table at README.md:99-108 and its dated lead-in at 94-97 were left byte-untouched, since Phase 62 owns regenerating that section and a hand-edit here would be silently overwritten."
  - "No 'authored' provenance entries exist in the committed declaration (all eight tools' remedies are 'carried' or 'measured'), so the doc's per-authored-source citation requirement is satisfied vacuously; this is stated as an observed fact from src/mcp/vice/prerequisites.json, not assumed."

requirements-completed: [DECL-01, DECL-04]

coverage:
  - id: D1
    description: "docs/phase58-declaration-provenance.md records, for every case where two in-tree sources disagreed about the same fact, which one the declaration followed and why (criterion 5's second half)"
    requirement: "DECL-01"
    verification:
      - kind: other
        ref: "task 1 <verify> automated block 1: sections=7 (>= 6 required), all five named-source strings present"
        status: pass
      - kind: other
        ref: "task 1 <verify> automated block 2: 8 unique path citations extracted, all resolve on disk (unresolved_flag=0)"
        status: pass
      - kind: other
        ref: "task 1 <verify> automated block 4 (node script): authored_sources=0, undocumented_authored=[], tools_unmentioned=[]"
        status: pass
    human_judgment: false
  - id: D2
    description: "The VICE 3.10 disagreement is recorded as a worked example naming README.md:96-97 as the losing side and .planning/REQUIREMENTS.md:88 as the winning, later evidence"
    requirement: "DECL-01"
    verification:
      - kind: other
        ref: "docs/phase58-declaration-provenance.md 'Case one' section quotes both sides verbatim with file:line citations and states REQUIREMENTS.md wins on recency and measurement"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md no longer asserts a VICE-version consequence this project has measured false; states no shipped tool carries a VICE version dependency and cites the measured evidence"
    requirement: "DECL-04"
    verification:
      - kind: other
        ref: "task 2 <verify> automated blocks 1-4: table byte-identical (TABLE_DIFF_EXIT=0), stale approximation absent, text_channel/chis/REQUIREMENTS.md/prerequisites.json all present in the rewritten region, zero table rows touched in the diff"
        status: pass
      - kind: manual_procedural
        ref: "task 2 <human-check>: rewritten prose cross-checked against .planning/REQUIREMENTS.md:85-88 and the provenance doc's Case one -- all three state the same fact"
        status: pass
    human_judgment: true
    rationale: "The plan's own <verify> block designates this a <human-check> item -- provenance/factual-agreement between three prose sources is a judgment call no assertion can make, per the plan's Flagged Planner Assumptions section."
  - id: D4
    description: "The eight-row VICE install table (README.md:99-108) and its dated lead-in (94-97) remain byte-unchanged, since Phase 62 generates that section"
    requirement: "DECL-01"
    verification:
      - kind: other
        ref: "task 2 <verify> automated block 2: before_rows=10, after_rows=10, diff exit 0 (no difference)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-17
status: complete
---

# Phase 58 Plan 02: The Provenance Record and the README Correction Summary

**Wrote `docs/phase58-declaration-provenance.md` recording all five disagreements the prerequisite declaration had to settle (with the VICE 3.10 gate's live-CI-verified worked example), and corrected README.md's "What a sub-3.10 VICE costs" prose to state the now-measured fact that no shipped tool refuses on a VICE version.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-17T14:10:00Z (approx.)
- **Completed:** 2026-09-17T14:36:01Z
- **Tasks:** 2
- **Files modified/created:** 2 (1 created, 1 modified)

## Accomplishments
- Created `docs/phase58-declaration-provenance.md`: 274 lines, 7 second-level sections covering all five worked disagreements the plan named (VICE version gate, shared c1541/petcat remedy, scope of the one measured grade, the two Node floors, one ecosystem under two platforms), plus an authoring-decisions section and the ACME library probe prefixes.
- Fetched a real GitHub Actions job log (`gh api repos/.../actions/jobs/105214655577/logs`, run `35225137192`, 2026-09-17) to record the `measured` grade's evidence precisely -- `ubuntu-latest` resolved to runner image `ubuntu24/20260907.300` (Ubuntu 24.04.5 LTS), installed `acme` `1:0.97~svn20211115+ds-1`, banner confirmed "This is ACME, release 0.97 ("Zem"), 31 Jan 2021" -- rather than asserting an unobserved figure.
- Rewrote `README.md:117-123` ("What a sub-3.10 VICE costs" -> "VICE version compatibility"): states no shipped tool refuses on a VICE version, names `vice_cpu_history`'s text-channel `chis` route, cites `.planning/REQUIREMENTS.md` for the measured claim, and names `src/mcp/vice/prerequisites.json` as carrying no VICE version data.
- Left the generated install table (`README.md:99-108`) and its dated lead-in (`94-97`) byte-identical to HEAD, verified by extracting and diffing the table region before and after the edit.
- Every `path:line` citation across both deliverables resolves to a real repository file (verified programmatically).

## Task Commits

Each task was committed atomically:

1. **Task 1: The provenance record -- every case where two sources disagreed, and which won** - `6a17f33d` (feat)
2. **Task 2: Correct the README claim the project has since measured false** - `ba52be37` (fix)

**Plan metadata:** committed alongside this SUMMARY (see final commit).

## Files Created/Modified
- `docs/phase58-declaration-provenance.md` - the human-readable provenance record; one section per disagreement case, an authoring-decisions section, and the ACME probe-prefix record
- `README.md` - `117-123` rewritten from "What a sub-3.10 VICE costs" to "VICE version compatibility"; everything else in the file untouched

## Decisions Made
- **The provenance doc's `statements_reversed` frontmatter block cites README.md's old prose**, not a `.planning/` planning document, adapting `docs/phase40-preprocessing-tools-decisions.md`'s pattern (originally used only for reversing locked ROADMAP/REQUIREMENTS statements) to a case where the reversed statement lives in a project-facing doc instead. This keeps the reversal machine-findable without inventing a second pattern.
- **The one `measured` grade's evidence was pulled from a live CI run rather than left as a described mechanism.** `gh run view --log` returned empty output against this repository's runs (log retention/access quirk); `gh api repos/henols/c64-re-tools/actions/jobs/<id>/logs` was the working fallback and is recorded as the technique in `tech-stack.patterns` for any future doc that needs the same evidence.
- **No `authored` provenance entries exist in the committed declaration** (confirmed via a direct `node -e` read of `prerequisites.json`), so the doc does not fabricate a "which page this was authored from" citation for a category that has zero members today -- this is stated as an observed absence, not silently skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `docs/phase40-preprocessing-tools-decisions.md` does not exist at the path the plan's `read_first` cites**
- **Found during:** Task 1, first `read_first` file read
- **Issue:** The plan's `read_first` list cites `docs/phase40-preprocessing-tools-decisions.md` as the frontmatter-shape and "statements reversed" model. That path does not exist; the file actually lives at `.planning/phases/40-the-three-preprocessing-host-tools/evidence/phase40-preprocessing-tools-decisions.md`.
- **Fix:** Located the file by searching the repository for its basename, read it from the actual path, and used its frontmatter shape (`decision`, `decision_ids`, `statements_reversed`, `related_decisions`) as the model for `docs/phase58-declaration-provenance.md`'s frontmatter.
- **Files modified:** none beyond the plan's own deliverable -- this was a read-time correction, not a write.
- **Verification:** Confirmed the file's actual location resolves and its frontmatter shape matches what the plan describes.
- **Committed in:** N/A (read-only correction; no separate commit needed)

**2. [Rule 1 - Bug] One citation in the provenance doc's first draft omitted its directory prefix**
- **Found during:** Task 1, running the citation-resolution `<verify>` block
- **Issue:** A second reference to `vice-launcher.sh:266` (after an earlier full-path citation to the same file) was written without its `src/mcp/vice/resources/` prefix, so the citation-extraction regex resolved it against a nonexistent repo-root-relative path and the verify command reported `MISSING_PATH:vice-launcher.sh`.
- **Fix:** Expanded the citation to the full relative path `src/mcp/vice/resources/vice-launcher.sh:266`.
- **Files modified:** `docs/phase58-declaration-provenance.md`
- **Verification:** Re-ran the citation-resolution `<verify>` block; `unresolved_flag=0`, 8 unique paths, all resolve.
- **Committed in:** `6a17f33d` (fixed before the task's first commit, so no separate fix commit was needed)

---

**Total deviations:** 2 (1 Rule 3 read-time path correction, 1 Rule 1 citation bug caught by the task's own verify loop before committing).
**Impact on plan:** Neither deviation changed what the plan asked for or introduced new scope -- one was a stale path in the plan text itself (found and worked around before any edit), the other was caught and fixed by the acceptance-criteria verification loop before the task's commit landed. No unverified citation reached the committed state.

## Issues Encountered
- **Pre-existing dirty working tree unrelated to this plan.** At dispatch time, `.claude/settings.json`, `.planning/state.json`, `skills-lock.json`, and four `src/mcp/vice/anno-*.ts` files were already modified in the working tree (visible in the git status snapshot taken before this plan's execution began). Task 2's acceptance criteria include `git status --porcelain` showing no modification to any file under `src/mcp/vice/`; that check reports 4 files, but `git show --stat` on both of this plan's commits (`6a17f33d`, `ba52be37`) confirms neither touched anything under `src/mcp/vice/` -- the modifications predate this plan's dispatch and are out of scope per the Scope Boundary rule (only auto-fix issues directly caused by the current task's changes). Not fixed; not committed; left exactly as found.

## Known Stubs
None.

## Threat Flags
None -- this plan's threat register (`T-58-05` through `T-58-08`, `T-58-SC`) is fully addressed: `T-58-05`'s citation-resolution mitigation caught and the plan's own `<verify>` blocks fixed one bad citation before commit (see Deviations); `T-58-06`'s generated-table-untouched mitigation is verified byte-identical; `T-58-07`'s rewritten-README mitigation passed both the automated citation checks and the human-check comparing the rewrite against `.planning/REQUIREMENTS.md` and the provenance doc.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both deliverables this plan owed are committed and verified: the provenance doc (Task 1) and the README correction (Task 2). This closes Phase 58 -- both of its plans (58-01, 58-02) are now complete.
- Phase 60 (repointing the live refusals to read from the declaration) and Phase 62 (generating the README table from the declaration) can both build on this phase's committed declaration and its documented provenance without re-deriving remedy text or re-litigating which source won each disagreement.
- The pre-existing uncommitted `src/mcp/vice/anno-*.ts` changes noted under Issues Encountered are unrelated to this phase and remain in the working tree for whatever session introduced them to resolve.

## Self-Check: PASSED
- `[ -f docs/phase58-declaration-provenance.md ]` -- FOUND
- `[ -f README.md ]` -- FOUND (modified, not created)
- `git log --oneline --all --grep="58-02"` -- did not match (commit subjects use the `(58-02):` scope form, not the literal string "58-02" as a standalone grep target in all cases); confirmed instead via `git log --oneline 6a17f33d^..HEAD` returning both task commits (`6a17f33d`, `ba52be37`) plus this plan's own scope prefix `(58-02)` present in both subject lines.
- Task 1's four `<verify>` automated blocks re-run: all pass (sections=7, named_sources all `ok`, citations resolve with `unresolved_flag=0`, untouchable files unmodified, authored/tools checks pass).
- Task 2's five `<verify>` automated blocks re-run: all pass (table byte-identical, region content checks pass, diff/status exits are 0, zero table rows touched); the `<human-check>` was performed and passed.
- Plan-level `<verification>` re-run: provenance doc has frontmatter and 7 sections (>= 6); every citation resolves; every declaration tool id is mentioned and there are zero `authored` sources to omit; the README table is byte-identical to HEAD with no added/removed table rows in the diff; the rewritten region no longer carries the old approximation claim and cites both `REQUIREMENTS.md` and `prerequisites.json`; `CLAUDE.md` and `.planning/PROJECT.md` are unmodified by this plan (confirmed via `git show --stat` on both commits, independent of the pre-existing dirty-tree files noted in Issues Encountered).
- `plan_head_before: 4f3e07799c403745fa99fa2be6a5474a2d54fb9d`, `commits: 2` (measured via `git rev-list --count`)

---
*Phase: 58-one-declaration-four-places-that-can-no-longer-disagree*
*Completed: 2026-09-17*
