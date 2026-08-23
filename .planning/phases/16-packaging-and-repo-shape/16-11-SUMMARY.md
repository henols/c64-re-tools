---
phase: 16-packaging-and-repo-shape
plan: 11
subsystem: planning-record
tags: [requirements-ledger, decision-register, gap-closure, documentation-consistency]

# Dependency graph
requires:
  - phase: 16-packaging-and-repo-shape
    provides: "plans 16-02's PKG-04 accepted-risk evidence, 16-08's tarball leak fix, 16-09's WR-02 fix and IN-01 rename, 16-10's CR-01/WR-03 fixes — this plan records the ledger and decision outcomes of all four"
provides:
  - "REQUIREMENTS.md's PKG-04 entry checked and Complete, agreeing with PROJECT.md's dated Key Decisions row and 16-PKG04-EVIDENCE.md"
  - "REQUIREMENTS.md's PKG-01 entry carrying a closure note naming the plans (16-08, 16-10) that made its tarball-correctness sub-clause true"
  - "16-GAP-CLOSURE-DECISIONS.md — the decision register recording this round's deliberate non-reversals, the probe's four-item accounting, the recalled prohibitions, and five newly-found sites with their closing plans"
affects: [phase-16-close, future-milestone-planning]

# Actuals (#2632)
actuals:
  tokens: 3525
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure notes in REQUIREMENTS.md cite their evidence record (PROJECT.md, evidence docs, closing plan numbers) rather than restating the underlying rationale, matching the established DEBT/GATE closure-note shape"

key-files:
  created:
    - .planning/phases/16-packaging-and-repo-shape/16-GAP-CLOSURE-DECISIONS.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PKG-04 flipped to checked/Complete with a closure note citing PROJECT.md's dated Key Decisions row and 16-PKG04-EVIDENCE.md, and explicitly stating the Control-Plane Bind Follow-on section remains open owned work this completion does not close."
  - "PKG-01 given a companion closure note naming plans 16-08 and 16-10 as the two plans that made its tarball-correctness sub-clause true, so a reader who finds 16-VERIFICATION.md's PARTIAL verdict can trace how it was closed."
  - "REQUIREMENTS.md's Coverage block (v0.4.0 requirements: 16 total / Mapped to phases: 16 / Unmapped: 0) was read and confirmed to be a mapping count, not a completion count — left unedited per the plan's own conditional instruction."
  - "Five items this round deliberately left unchanged (four SKILL.md repo-root quick-references, recovery-schema.mjs's HERE comment, project-paths.mjs's narration, repo-root.test.ts's pre-relocation assertion, and 16-REVIEW.md's IN-01) are recorded in 16-GAP-CLOSURE-DECISIONS.md with owner and reversal trigger each — IN-01 specifically recorded as renamed-not-left, since plan 16-09 executed that rename."
  - "The spec-less probe's four surfaced PKG-01..04 items are fully accounted for in the register: two authored as plain truths (PKG-01 in 16-08, PKG-04 in this plan), two still-unresolved flagged assumptions (PKG-02 in 16-08, PKG-03 in 16-09) — stated as an explicit no-silent-drop equality."

requirements-completed: [PKG-04]

coverage:
  - id: D1
    description: "REQUIREMENTS.md's PKG-04 checkbox and Traceability row agree (both Complete), with a closure note citing PROJECT.md and 16-PKG04-EVIDENCE.md and preserving the open Control-Plane Bind Follow-on; PKG-01 carries a closure note naming plans 16-08/16-10; all four PKG entries pass a mechanical checkbox/row consistency check"
    requirement: PKG-04
    verification:
      - kind: other
        ref: "Task 1's automated node -e consistency check (all four PKG entries internally consistent) plus every acceptance-criteria grep in 16-11-PLAN.md Task 1, recorded verbatim in this SUMMARY's Task Commits/Verification sections"
        status: pass
    human_judgment: false
  - id: D2
    description: "16-GAP-CLOSURE-DECISIONS.md records five deliberate non-reversals with owner/reason, the probe's four-item accounting with the no-silent-drop equality stated, the three recalled prohibitions with a canon-referral breadcrumb, and five newly-found sites each naming its closing plan"
    requirement: PKG-04
    verification:
      - kind: other
        ref: "Task 2's automated node -e coverage check plus every acceptance-criteria grep/python proximity check in 16-11-PLAN.md Task 2, recorded verbatim in this SUMMARY"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 11: Requirement Ledger Close and Gap-Closure Decision Register Summary

**Flipped PKG-04 to checked/Complete in REQUIREMENTS.md with a closure note citing PROJECT.md's dated accepted-risk decision and its evidence document, gave PKG-01 a companion closure note naming the two plans that made its tarball-correctness sub-clause true, and wrote a new decision register recording every deliberate non-reversal, the spec-less probe's four-item accounting, the recalled prohibitions, and five newly-found sites from this gap-closure round.**

## Performance

- **Duration:** ~30 min
- **Started:** ~2026-08-23T02:35:00Z
- **Completed:** 2026-08-23T03:08:07Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `.planning/REQUIREMENTS.md`'s PKG-04 entry is now `[x]` checked and its Traceability row reads `Complete`, matching the disposition PROJECT.md's Key Decisions table has carried since 2026-08-22 and `16-PKG04-EVIDENCE.md` grounds in file:line citations and a live observed bind. The closure note states the disposition is `accept` (not `narrow`), cites both records rather than restating them, and explicitly names the still-open `Control-Plane Bind Follow-on` section so the completion mark cannot be misread as closing that follow-on too.
- PKG-01's entry now carries a closure note naming plans 16-08 and 16-10 as the two plans that made its tarball-correctness sub-clause true after `16-VERIFICATION.md`'s `⚠️ PARTIAL` verdict — a reader who finds that verdict can now trace how it was closed instead of inferring it.
- All four PKG entries (PKG-01..04) pass a mechanical checkbox/Traceability-row consistency check, run as a command and recorded below rather than eyeballed.
- No requirement sentence was reworded and no other requirement family (`DEBT-`, `CORE-`, `GATE-`, `FORK-`, `EXTV-`) was touched — confirmed by diff-scoped greps.
- A new decision register, `.planning/phases/16-packaging-and-repo-shape/16-GAP-CLOSURE-DECISIONS.md`, records: (1) five items this round deliberately left unchanged, each with an owner and a stated reversal trigger, including `16-REVIEW.md`'s `IN-01` explicitly recorded as renamed-not-left since plan 16-09 executed that rename; (2) the spec-less probe's four surfaced `PKG-01..04` items fully accounted for — two authored as plain truths, two still-unresolved flagged assumptions — stated as an explicit no-silent-drop equality; (3) the three recalled prohibitions this round authored, with which plans carry each, plus a canon-referral breadcrumb for installer path-traversal/arbitrary-write concerns; (4) five newly-found sites this round found, each naming the plan that closed it.

## Task Commits

Each task was committed atomically:

1. **Task 1: The requirement ledger agrees with the verified tree** - `6ae3764` (docs)
2. **Task 2: Every deliberate leave-alone and every unclassified probe row is recorded with its reason** - `23510f1` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - PKG-04 checked and `Complete`, with a closure note; PKG-01 given a companion closure note naming plans 16-08/16-10
- `.planning/phases/16-packaging-and-repo-shape/16-GAP-CLOSURE-DECISIONS.md` - new decision register: deliberate non-reversals, probe accounting, recalled prohibitions, newly-found sites

## Decisions Made

- PKG-04's closure note cites `PROJECT.md` → Key Decisions and `16-PKG04-EVIDENCE.md` rather than restating the accepted-risk rationale, and states in plain terms that the `Control-Plane Bind Follow-on` section remains open owned work.
- PKG-01's closure note names both closing plans (16-08, 16-10) by number so the `⚠️ PARTIAL` verdict in `16-VERIFICATION.md` is traceable to its resolution.
- REQUIREMENTS.md's `Coverage:` block (`16 total` / `Mapped to phases: 16` / `Unmapped: 0`) was read first and confirmed to be a mapping count rather than a completion count, per the plan's own conditional instruction — left unedited, not invented.
- The five deliberate-leave-alone items are recorded with named owners (future-milestone playbook routing for the four SKILL.md quick-references; no owner needed for `recovery-schema.mjs`/`project-paths.mjs`/`repo-root.test.ts` since each is stated correct-as-written, not deferred) and explicit reversal triggers where applicable.
- `16-REVIEW.md`'s `IN-01` is recorded as a decision made and executed (renamed by plan 16-09), not an item this round left alone — the register states the opposite outcome from a bare "left alone" reading, per `IN-01`'s own request for an explicit either-way decision.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` instructions were followed literally: scoped edits only to `.planning/REQUIREMENTS.md` in Task 1 (no whole-file rewrite), and a new single document in Task 2. `.planning/phases/16-packaging-and-repo-shape/deferred-items.md`'s stale attribution (it credits this plan with closing the two `docs-review-disposition.test.ts`/`audit-integrity.test.ts` failures, when plans 16-09 and 16-10 actually closed them by dispositioning `16-REVIEW.md`'s `WR-02` and `WR-03` findings respectively) was noticed during required reading but was **not** edited — it is not named in this plan's `files_modified` frontmatter, is not one of the four decision-register sections this plan's tasks define, and correcting it would exceed this plan's declared scope ("Bookkeeping only. Do not overreach."). Noted here for the record rather than silently left uncorrected.

## Issues Encountered

None. The full baseline (`VICE_REQUIRE_ACME=1 npm test`) was already green before this plan ran (2386/2342/0/39/5, 24 suites, per 16-10-SUMMARY.md), and remained identically green after both commits — confirmed by a full re-run below rather than assumed.

## Verification (plan-level, all seven items re-run live)

1. Ledger consistency check (Task 1 `<verify>`): `PASS: all four PKG entries internally consistent`.
2. `grep -c '^- \[x\] \*\*PKG-04\*\*' .planning/REQUIREMENTS.md` → `1`.
3. `grep -cE '^\| PKG-04 \| 16 \| Complete \|' .planning/REQUIREMENTS.md` → `1`.
4. Decision-register coverage check (Task 2 `<verify>`): `PASS: decision register covers all required entries`.
5. `git status --porcelain -- src scripts installer .github .planning/STATE.md .planning/ROADMAP.md` → empty (nothing printed).
6. `git log -2 --name-only --format=%s` → both commits show their `.planning/` artifact (`16-GAP-CLOSURE-DECISIONS.md`, `REQUIREMENTS.md`) — this plan ran on the main checkout (`isolation=none`), not an isolated worktree, so both `.planning/` deliverables landed.
7. Regression check: `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` → `2386 tests, 2342 pass, 0 fail, 39 skipped, 5 todo, 24 suites` (unchanged from the pre-plan baseline). `node scripts/check-npm-packages.mjs` → OK (73/31 files). `node scripts/check-skill-tool-coverage.mjs` → OK. `node scripts/check-skill-fork-honesty.mjs` → OK. `bash scripts/package.sh` → OK, 987 files. `node --test docs-review-disposition.test.ts audit-integrity.test.ts` → 50/50 pass, both guards green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16's requirement ledger now agrees with the verified tree: all four `PKG-01..04` entries are checked and `Complete`, both with closure notes tracing evidence.
- The gap-closure round's own decision register is committed, closing the "undecided state" the phase's own gaps repeatedly came from.
- Full baseline remains green (`2386/2342/0/39/5`, 24 suites); `docs-review-disposition.test.ts` and `audit-integrity.test.ts` both confirmed green.
- Phase 16 is ready to close. `.planning/STATE.md` and `.planning/ROADMAP.md` still need their own state/roadmap-progress updates (performed next in this execution, outside this plan's own file scope).

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: `.planning/phases/16-packaging-and-repo-shape/16-GAP-CLOSURE-DECISIONS.md`
- FOUND: commit `6ae3764` (Task 1) in `git log`
- FOUND: commit `23510f1` (Task 2) in `git log`
- Confirmed: `.planning/REQUIREMENTS.md` contains checked/`Complete` PKG-04 with closure note
- Confirmed: `.planning/REQUIREMENTS.md` contains PKG-01 closure note naming 16-08/16-10
- Confirmed: `git status --porcelain -- .planning/STATE.md .planning/ROADMAP.md` empty
- Confirmed: `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` — 2386/2342/0/39/5, 24 suites
- Confirmed: `node scripts/check-npm-packages.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`, `bash scripts/package.sh` all exit 0
