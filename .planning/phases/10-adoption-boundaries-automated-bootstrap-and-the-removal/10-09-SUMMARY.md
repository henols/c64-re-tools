---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 09
subsystem: docs
tags: [roadmap, requirements, licence-correction, research-annotation, vice-wedge-triage, todo-closure, d-03, d-14]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "plan 10-02/10-03/10-04's shipped bootstrap input set (.prg/.d64/flat 64K), plan 10-08's correct THIRD-PARTY-NOTICES.md notice, and 10-01's --vice guard -- this plan's four corrections all cite those plans' actual shipped outcomes"
provides:
  - "ROADMAP.md criterion 3 and the standing .vsf constraint matching what shipped, not what was originally scoped"
  - "REQUIREMENTS.md (R2000-03, R2000-08 fold note, R2000-09) and .planning/notes/regenerator2000-integration.md carrying the true dual MIT OR Apache-2.0 licence throughout, with no stray single-licence mentions left in either living document"
  - "10-RESEARCH.md's Open Questions section, retitled (RESOLVED), each of the three questions annotated with the plan that settled it -- including Q2's departure from its own recommendation, stated explicitly for Phase 11"
  - "vice-wedge-triage/SKILL.md's contention discriminator and named causes, extending (not duplicating) the existing monitor_held_elsewhere material"
  - "Both folded todos moved to .planning/todos/completed/ with their resolving plan(s) recorded"
affects: ["phase-11-r2000-mcp-surface (inherits Q2's package-boundary reasoning as annotated here)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Annotate-in-place research artifacts rather than deleting superseded prose: RESOLVED lines sit immediately under each question's bolded title, original 'What we know'/'Recommendation' text left intact as the historical record"
    - "Extend an existing skill section with a new paragraph rather than adding a competing table row/section, when the material (a table row, a verdict) already exists"

key-files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/notes/regenerator2000-integration.md
    - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-RESEARCH.md
    - .claude/skills/vice-wedge-triage/SKILL.md
    - .planning/todos/completed/2026-08-17-document-second-binmon-client-as-a-wedge-lookalike.md
    - .planning/todos/completed/2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes.md

key-decisions:
  - "Fixed two additional Apache-2.0-only mentions in ROADMAP.md (Overview prose line ~98, Phase 10 criterion 5) beyond the plan's explicitly scoped files -- the plan's own overall <verification> step 4 greps the whole .planning/ tree, and these two were live claims in the current ROADMAP (not append-only phase history), so they would have tripped that check and left a stray wrong claim in the one document criterion 3 was already being corrected in. Committed separately (fix(10-09)) as an out-of-scope-file deviation (Rule 1)."
  - "Left milestones/v0.2.0-ROADMAP.md, v0.2.0-REQUIREMENTS.md, 09-RESEARCH.md, CONTEXT.md, evidence/*, and other plans' PLAN.md/SUMMARY.md files untouched -- these are archived/append-only phase history the plan's verification step explicitly excludes, and rewriting them would falsify the historical record of what was believed/planned at the time"
  - "Reworded the two REQUIREMENTS.md/notes.md correction annotations to avoid the literal substring 'Apache-2.0-only' colliding with the task's own acceptance-criteria grep (same class of self-collision plans 10-01/10-04/10-05/10-07 each documented) -- used 'single-licence reading' instead"
  - "Q3's RESOLVED line credits plan 10-04 for bootstrap/export-asm and plan 10-05 for verify (not all three to 10-04 as CONTEXT.md's summary implied) -- verified against 10-05-SUMMARY.md, which shows verify was wired in that later plan, not 10-04"
  - "Did not mark any REQUIREMENTS.md checkbox -- requirement completion is phase-close bookkeeping, per the plan's explicit instruction, not this doc-correction task's business"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-20
---

# Phase 10 Plan 09: Doc truth-up — criterion-3 wording, Apache-2.0 corrections, wedge-triage discriminator, folded todos Summary

**Four stale-claim corrections landed as four atomic commits on the main tree (worktree: false, by design): ROADMAP's criterion 3 and standing `.vsf` constraint now match the shipped `.prg`/`.d64`/flat-64K input set, every remaining Apache-2.0-only mention in living planning documents now reads the true dual `MIT OR Apache-2.0`, `10-RESEARCH.md`'s Open Questions are annotated `(RESOLVED)` with the settling plan and outcome per question (Q2 explicitly against its own recommendation), and `vice-wedge-triage/SKILL.md` gained the contention discriminator with both folded todos closed on disk.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-20T19:23Z
- **Tasks:** 3/3 (plus one out-of-scope-file follow-up fix)
- **Files modified:** 7 (all documentation/skill/todo files, no code)

## Accomplishments

- **ROADMAP.md**: Phase 10 criterion 3 now names all three shipped inputs (`.prg`, `.d64` with a named entry, flat 64K) instead of the original `.prg`-or-`.vsf` wording, with a bracketed note recording `.vsf`'s deferral to Phase 11's `c64-ram-capture` extension and the reason (D-03). The standing "prefer `.vsf` over `.raw`" constraint gained a sentence marking it as not applying to Phase 10, citing `docs/phase9-regenerator2000-probe-findings.md` § Accepted limits entry 2. Both edits confined to their two regions (`git diff --stat` showed 8 insertions / 2 deletions in one file, two hunks). A follow-up fix corrected two further Apache-2.0-only mentions in the same file (Overview prose, criterion 5) that the plan's own whole-tree verification grep would otherwise have caught.
- **REQUIREMENTS.md / regenerator2000-integration.md**: `R2000-03`'s text, the folded `R2000-08` note (found to directly contradict the corrected `R2000-09` and fixed for consistency, Rule 1), `R2000-09`'s input-set wording, and the integration note's "Licensing" line all now say `MIT OR Apache-2.0`, each with a citation to Phase 9's correction. Two additional descriptive-prose mentions (`REQUIREMENTS.md`'s opening paragraph, the integration note's own opening description) were also corrected since the plan's verification greps every "Apache-2.0" occurrence in both files, not just the requirement text. No requirement checkbox was touched.
- **10-RESEARCH.md**: Retitled `## Open Questions` to `## Open Questions (RESOLVED)`. Each of the three questions gained an inline `RESOLVED: plan 10-0X — <outcome>` line directly under its bolded title, original "What we know"/"What's unclear"/"Recommendation" prose left intact: Q1 (package-boundary reach) resolved by plan 10-04 as recommended; Q2 (`.d64` extraction) resolved by plan 10-03 **against** the research's own recommendation — a fresh `r2000-d64.ts` beside the seam rather than extending `d64-parse.mjs`, because `.claude/skills/**` is outside `@henols/vice-mcp`'s published `files[]`; Q3 (verb names) resolved by plan 10-04 (`bootstrap`, `export-asm`) and plan 10-05 (`verify`).
- **vice-wedge-triage/SKILL.md**: Added one paragraph (in "## Two traps that read as a wedge and are not") stating the cheap tell (a socket that accepts a connection but never answers is contention, not a wedge) and naming the concrete causes (a hand-run `nc` session, a second Claude Code session, VICE's own `-remotemonitor`, any other 6502 debugger including regenerator2000's own `--vice`) — plus the explicit statement that this plugin's own r2000 route can never be one of them, since `--vice` is refused by construction and by a throwing scan (`R2000-01`, plan 10-01), not by documentation alone. No new table row or verdict entry added — verified the `monitor_held_elsewhere` literal count in the file is unchanged (6 before, 6 after).
- **Both folded todos** moved from `.planning/todos/pending/` to `.planning/todos/completed/` via `git mv`, each with an appended `## Resolved 2026-08-20` block naming the resolving plan(s) and file(s): the wedge-lookalike todo across plans 10-09 (item 1), 10-08 (item 2), 10-01 (item 3); the acme scaffold todo entirely by plan 10-07.

## Task Commits

Each task was committed atomically:

1. **Task 1: reconcile ROADMAP criterion 3 and the standing .vsf constraint** — `184dfa9` (docs)
2. **Task 2: correct the Apache-2.0-only claim, close out RESEARCH.md's Open Questions** — `a0a57e7` (docs)
3. **Task 3: wedge-triage discriminator, close both folded todos** — `232b057` (docs)
4. **Follow-up (Rule 1): correct two more Apache-2.0-only mentions in ROADMAP.md missed by Task 2's file scope** — `592ce87` (fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two additional Apache-2.0-only mentions in ROADMAP.md**
- **Found during:** post-Task-3 overall verification (the plan's own `<verification>` step 4 greps the whole `.planning/` tree)
- **Issue:** ROADMAP.md's Overview prose ("Rust, TUI, Apache-2.0") and Phase 10 criterion 5's install-documentation wording both still said "Apache-2.0" alone — outside Task 2's explicitly scoped `files_modified` list (`REQUIREMENTS.md`, the integration note) but inside a *living* document the plan's own verification step checks
- **Fix:** Both corrected to the dual `MIT OR Apache-2.0` phrase, matching Task 2's fix
- **Files modified:** `.planning/ROADMAP.md`
- **Commit:** `592ce87`

**2. [Rule 1 - Bug] Folded `R2000-08` note contradicted the just-corrected `R2000-09`**
- **Found during:** Task 2 (reading REQUIREMENTS.md's "Out of Scope" section for context)
- **Issue:** The `R2000-08` fold note (a historical "Out of Scope" entry) still said "Prefer `.vsf`" as the note's own guidance, directly contradicting `R2000-09`'s newly-corrected text stating `.vsf` was dropped from Phase 10 entirely
- **Fix:** Amended the note to state the original preference, then mark it superseded by D-03 with the same reasoning `R2000-09` now carries
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Commit:** `a0a57e7`

### Self-collision avoidance (not a deviation, documented per prior plans' convention)

Both `REQUIREMENTS.md` and `regenerator2000-integration.md`'s correction-annotation text originally used the literal substring "Apache-2.0-only", which would have tripped the task's own acceptance-criteria grep (`grep -n 'Apache-2.0' ... | grep -v 'MIT OR Apache-2.0'`). Reworded to "single-licence reading" before committing — same class of issue plans 10-01/10-04/10-05/10-07 each hit and documented.

## Verification

- `grep -c 'd64'` / `grep -c 'phase9-regenerator2000-probe-findings'` on ROADMAP.md: 2 / 6, both present
- `! grep -n 'Apache-2.0' .planning/REQUIREMENTS.md .planning/notes/regenerator2000-integration.md | grep -v 'MIT OR Apache-2.0'`: passes (exit 0)
- `grep -rn 'Apache-2.0' .planning/ | grep -v 'MIT OR Apache-2.0'`: after the follow-up fix, all remaining hits are inside archived/append-only history (`.planning/milestones/v0.2.0-*`, `09-RESEARCH.md`, `evidence/*`, `CONTEXT.md`, other plans' `PLAN.md`/`SUMMARY.md` files, and one plan-title mention describing the correction itself) or unrelated (`research/SCREENSHOT.md`'s `sharp` library entry) — none is a live false claim in a document this plan owns
- `grep -c '^## Open Questions (RESOLVED)$'` / `'^## Open Questions$'` on 10-RESEARCH.md: 1 / 0
- `grep -c 'RESOLVED: plan 10-0'` on 10-RESEARCH.md: exactly 3
- `grep -c 'r2000-d64'` on 10-RESEARCH.md: ≥ 1 (Q2 names it)
- Q3's RESOLVED line names `bootstrap`, `export-asm` and `verify`
- `git diff --numstat` on 10-RESEARCH.md: 4 insertions / 1 deletion (the retitled heading), no other line removed — original question text intact
- `test ! -e` on both pending todo paths, `test -e` on both completed paths: all four pass
- `grep -ci 'remotemonitor'` / `grep -c 'never answers'` on vice-wedge-triage/SKILL.md: ≥ 1 each
- `monitor_held_elsewhere` literal count in vice-wedge-triage/SKILL.md unchanged (6 before and after this plan's edit) — confirms no duplicated table row
- `node scripts/check-skill-fork-honesty.mjs` — exit 0
- `node scripts/check-skill-tool-coverage.mjs` — exit 0
- `node scripts/check-npm-packages.mjs` — exit 0
- `npx tsc --noEmit` in `.claude/mcp/vice` — exit 0
- `npm test` in `.claude/mcp/vice` — 1925 tests / 1890 pass / 0 fail / 30 skipped / 5 todo (matches the documented green baseline exactly)
- `git status --short` confirms the human's `.planning/PROJECT.md` (modified), `.planning/ARCHITECTURE.md` and `.planning/ENGINEERING_RULES.md` (untracked) were never staged or committed by this plan
- All four commits (`184dfa9`, `a0a57e7`, `232b057`, `592ce87`) individually `git show --stat` confirm `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` content actually landed — this plan ran `worktree: false` specifically because worktree mode strips those files from executor commits (precedent: plan 09-08), and that risk did not materialize here

## Known Stubs

None — this plan produced no code, no rendered UI, and no data-flow stubs. All changes are documentation/skill-prose corrections and two todo-file moves.

## Threat Flags

None — this plan's threat register (T-10-15, T-10-17, T-10-18, T-10-01, T-10-SC) covers exactly the surface touched (documentation correctness and a triage playbook's diagnosis accuracy); no new network endpoint, auth path, file access pattern, or schema change was introduced.

## Self-Check: PASSED

- FOUND: `.planning/ROADMAP.md` (git show HEAD~3:.planning/ROADMAP.md through HEAD, all four commits present)
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/notes/regenerator2000-integration.md`
- FOUND: `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-RESEARCH.md`
- FOUND: `.claude/skills/vice-wedge-triage/SKILL.md`
- FOUND: `.planning/todos/completed/2026-08-17-document-second-binmon-client-as-a-wedge-lookalike.md`
- FOUND: `.planning/todos/completed/2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes.md`
- MISSING (expected, moved): `.planning/todos/pending/2026-08-17-document-second-binmon-client-as-a-wedge-lookalike.md`, `.planning/todos/pending/2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes.md`
- FOUND commit `184dfa9` in `git log --oneline --all`
- FOUND commit `a0a57e7` in `git log --oneline --all`
- FOUND commit `232b057` in `git log --oneline --all`
- FOUND commit `592ce87` in `git log --oneline --all`
