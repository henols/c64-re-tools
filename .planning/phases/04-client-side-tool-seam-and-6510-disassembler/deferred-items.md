# Deferred Items -- Phase 04

Items discovered during plan execution that are out of scope for the task
that found them (Scope Boundary rule: only auto-fix issues directly caused
by the current task's changes).

## 04-01: `repo-root.test.ts` fails when run from inside a Claude Code worktree

**Found during:** Plan 04-01, Task 2 verification (`npm run test:automated`).

**Symptom:** `repo-root.test.ts`'s "path agreement ... THE regression this
task exists to catch" test fails with:
```
the agreed directory must not sit under .claude -- got
.../.claude/worktrees/agent-<id>/.vice-supervisor (the exact regression a
naive move would introduce)
```

**Cause:** Not related to disasm-opcodes.ts/disasm-opcodes.test.ts (04-01's
own files -- confirmed no reference to `disasm` anywhere in
`repo-root.test.ts`). The failure is purely an artifact of this execution
running inside a Claude Code worktree at
`.claude/worktrees/agent-<id>/...`: the repo-root `.git`-walk resolves the
worktree's own root, which itself happens to live under a `.claude/`
directory (the worktree's location, not the resolver's fault). The test's
assertion ("must not sit under .claude") was written correctly against the
real regression it guards (a naive `supervisorDir()` move landing under
`.claude/mcp/vice/`), but a worktree checkout at
`.claude/worktrees/<id>/` incidentally satisfies that same string match one
level up.

**Status:** Not fixed -- out of scope for 04-01 (Scope Boundary rule: no
file this plan touches is involved). Confirmed pre-existing: reproduces on
a clean worktree checkout with zero 04-01 changes applied
(`node --test repo-root.test.ts` in isolation, before any disasm-opcodes
files existed).

**Suggested follow-up:** Either (a) have the test skip cleanly when
`process.cwd()` itself is under a `.claude/worktrees/` segment (mirroring
how other env-gated tests in this tree skip on unavailable preconditions),
or (b) tighten the assertion to check specifically for
`.claude/mcp/vice/.vice-supervisor` rather than any path containing
`.claude` anywhere in its ancestry. Not actioned here; flagging for the
phase orchestrator / a future gap-closure plan.
