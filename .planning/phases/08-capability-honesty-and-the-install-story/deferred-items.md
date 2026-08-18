# Deferred Items — Phase 08 Plan 01

## repo-root.test.ts pre-existing failure (out of scope for 08-01)

`node test-gate.mjs` (and `node --test repo-root.test.ts` in isolation) fails one
subtest: "path agreement (D-3, D-6...) ... the agreed directory must not sit
under .claude". This is caused by this execution's git worktree living at
`.claude/worktrees/agent-a406ade8c1a574f31/` — the test's own `repoRoot()`
last-resort .git-walk fallback correctly detects that its walk terminates
under a `.claude/` segment in THIS environment, which is an artifact of the
worktree-isolation mechanism itself, not of any file this plan touches.

Confirmed unrelated to capability-registry.ts/capability-registry.test.ts:
reproduces identically running `repo-root.test.ts` alone, a file with zero
overlap with this plan's `files_modified`. Not auto-fixed per the Scope
Boundary rule (pre-existing failure in an unrelated file). Left for the
orchestrator/a future plan to re-run outside a nested worktree path.

## `references/tool-selection.md:39` — pre-existing false positive for the plan's own final-verification grep (out of scope for 08-04)

08-04's plan-level `<verification>` block includes
`grep -rn 'Phase [0-9]' .claude/skills/ | grep -Ei 'deferred|not yet|until|unavailable'`
and expects it to return nothing. It does not: `tool-selection.md:39` reads
"`vice_run_until`'s timeout is backend-qualified ... (Phase 7, D-02).** On the
fork, `cycles` is documented as *"not yet implemented"*" — both "Phase 7" and
"not yet" co-occur on that one physical line, matching the naive regex.

This is a citation of the FORK's own tool-schema documentation ("not yet
implemented" is quoted verbatim from what the fork's own `cycles` parameter
description says), not a sentence deferring a capability of this project to a
future phase (research Pitfall 5's actual target). It pre-dates this plan,
`tool-selection.md` is not in 08-04's `files_modified`, and Task 2's four
target sites do not include it — confirmed present before any 08-04 edit.

`scripts/check-skill-fork-honesty.mjs` (08-04 Task 1) implements the
stale-forward-reference check more precisely than the plan's literal
same-line-co-occurrence spec, requiring a possessive `Phase N's` form (the
idiom this project's own prose actually uses to hand a capability to a phase,
e.g. control-flow.md's now-fixed "Phase 8's `BACK-05` is what reports..."),
so the lint itself does not false-positive on this line and exits 0 after
Task 2. Only the plan's own literal final-verification grep command, run
directly rather than through the lint, still surfaces this pre-existing line.
Not auto-fixed per the Scope Boundary rule. Left for a future plan/quick task
to either rephrase `tool-selection.md:39` or narrow the plan's own
verification grep to match the lint's possessive-form pattern.
