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
