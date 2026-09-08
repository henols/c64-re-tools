---
phase: quick-260908-m4k
plan: 01
subsystem: docs
tags: [claude-md, project-md, constraints, dependency-policy]

requires: []
provides:
  - "A binding `- **Dependency**:` bullet in CLAUDE.md's `### Constraints` list stating external tools are never auto-installed"
  - "The identical bullet mirrored into `.planning/PROJECT.md`'s `## Constraints` list, the GSD-managed block's declared source"
affects: [installer, ci, host-tool-detection]

actuals:
  tokens: 1100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - CLAUDE.md
    - .planning/PROJECT.md

key-decisions:
  - "Used the existing `Dependency` category (not `Safety`, not a new category) per the plan's Category Decision section"
  - "Cited symbol names (probeBackend, findSiblingBinary, findDxaBinary) rather than line numbers so the bullet doesn't need re-verification every phase"
  - "Did not reconcile the pre-existing drift between CLAUDE.md and PROJECT.md's Constraints lists (Node version floor, four PROJECT.md-only bullets) — explicitly out of scope per the plan"

patterns-established: []

requirements-completed: [QUICK-260908-m4k]

coverage:
  - id: D1
    description: "CLAUDE.md's `### Constraints` list carries one new `- **Dependency**:` bullet codifying the no-auto-install rule, the positive detect-then-refuse pattern, and the three out-of-scope edges"
    requirement: "QUICK-260908-m4k"
    verification:
      - kind: other
        ref: "grep assertions in 260908-m4k-PLAN.md Task 1 verify block (count=1, pattern presence, no vice-proxy.ts:<N> citation)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-dangling-refs.test.ts, docs-linerefs.test.ts, docs-worktree-isolation.test.ts (26 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Byte-identical bullet mirrored into `.planning/PROJECT.md`'s `## Constraints` list so it survives regeneration of CLAUDE.md's GSD-managed block"
    requirement: "QUICK-260908-m4k"
    verification:
      - kind: other
        ref: "grep + sort -u diff-equivalence check in 260908-m4k-PLAN.md Task 2 verify block"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-dangling-refs.test.ts, docs-linerefs.test.ts, docs-worktree-isolation.test.ts (26 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-08
status: complete
---

# Quick Task 260908-m4k: Document the no-auto-install constraint Summary

**Codified the owner's 2026-09-08 standing rule — external tools are never auto-installed, only detected — as a `Dependency` bullet in both CLAUDE.md and PROJECT.md's Constraints lists.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-08T16:02Z (plan already committed as `ddd34e87`)
- **Completed:** 2026-09-08T16:05:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Appended one unwrapped `- **Dependency**:` bullet to `CLAUDE.md`'s `### Constraints` list, immediately after the last existing bullet (`- **Testing**: ...`) and before `<!-- GSD:project-end -->`.
- Mirrored the byte-identical bullet into `.planning/PROJECT.md`'s `## Constraints` list, immediately after its own copy of the `- **Testing**: ...` bullet and before `## Engineering Governance`, so a future regeneration of CLAUDE.md's GSD-managed block reproduces the rule from its declared source.
- No behavioural code change — the compliance survey in the plan established the tree already honours the constraint; this task only makes it binding and discoverable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append the Dependency bullet to CLAUDE.md's Constraints list** - `6df87285` (docs)
2. **Task 2: Mirror the byte-identical bullet into .planning/PROJECT.md** - `4384ecec` (docs)

**Plan metadata:** committed separately by the orchestrator (this SUMMARY, STATE.md are not committed by the executor per task constraints).

## Files Created/Modified
- `CLAUDE.md` - added one `- **Dependency**:` bullet to `### Constraints` (1 line, no other change)
- `.planning/PROJECT.md` - added the identical bullet to `## Constraints` (1 line, no other change)

## Decisions Made
- Category: `Dependency` (not `Safety`, not a new category) — matches the plan's Category Decision rationale (external prerequisite + provisioning policy, same subject as the existing `CPUHISTORY_GET` bullet).
- Citation style: symbol names only (`probeBackend()`, `resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`), zero `vice-proxy.ts:<digits>` tokens, so `docs-linerefs.test.ts`'s `CITATION_RE` / `qualifyingCount` check is unaffected.
- Left the pre-existing CLAUDE.md/PROJECT.md Constraints drift untouched (see Known Issues below) — reconciling it was explicitly out of scope for this task.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` and `<done>` criteria verbatim; no Rule 1-4 fixes were needed.

## Issues Encountered

None. Both anchor bullets (`- **Testing**: ...checkpoint-wait functions...`) were confirmed unique (`grep -c` = 1) in each file before editing, matching the plan's stated line numbers (CLAUDE.md:48, PROJECT.md:513) closely enough that the scoped-edit anchors were unambiguous.

## Known Pre-existing Issues (not fixed, per plan's explicit scope boundary)

- **CLAUDE.md/PROJECT.md Constraints drift**: `PROJECT.md` states `Node ≥ 22.18` where `CLAUDE.md` states `Node ≥ 24` for the same Tech-stack bullet. `PROJECT.md` also carries four `Dependency`/`Architecture`/`Capability` bullets about "the external analyser" that do not appear in `CLAUDE.md` at all. This is pre-existing drift the plan explicitly forbade reconciling in this task (it would put unrelated content in a documentation-only diff). Flagging here per the plan's scope_warning so it stays visible as separate future work for the project owner.
- Per project memory (`external-analyser-name-is-banned`), the "external analyser" name itself is treated as banned in new prose; the pre-existing PROJECT.md bullets that use it were not touched (out of scope) and are noted here only as a location pointer, not re-litigated or renamed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The no-auto-install rule is now durable across a CLAUDE.md regeneration (mirrored at its declared source).
- Reconciling the CLAUDE.md/PROJECT.md Constraints drift (Node version floor + four PROJECT.md-only bullets) remains open, unscoped work for a future task.

## Self-Check: PASSED

- `CLAUDE.md` and `.planning/PROJECT.md` both exist and contain exactly one `- **Dependency**: External tools are **never auto-installed**` bullet each (verified via `grep -c`).
- The two bullets are byte-identical (`sort -u` of both extracted lines yields exactly 1 unique line).
- Commits `6df87285` and `4384ecec` both found in `git log --oneline`.
- `node --test src/mcp/vice/docs-dangling-refs.test.ts src/mcp/vice/docs-linerefs.test.ts src/mcp/vice/docs-worktree-isolation.test.ts` → 26 pass, 0 fail (matches measured baseline).
- `git diff --stat HEAD~2 HEAD` → exactly two files changed, one insertion each.

---
*Phase: quick-260908-m4k*
*Completed: 2026-09-08*
