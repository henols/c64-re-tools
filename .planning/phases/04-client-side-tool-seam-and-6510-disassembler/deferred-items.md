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

## 260817-n6p: same worktree-path artifact reproduced, plus `npm test`
(bare) confirmed not a usable gate; `npm run test:automated` is the
correct one

**Found during:** quick task `260817-n6p` (WR-01 startAddress bound),
Task 1 verification.

**Symptom 1 — bare `npm test`:** `node --test '*.test.*'` (the plain
`npm test` script) took ~12 minutes and reported 128 failing tests,
dominated by `vice-proxy.test.ts` (one file alone ran for the whole
duration). This matches the disposition already recorded in
`.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-
devcontainer.md`: `vice-proxy.test.ts`, `vice-broker-launch.test.ts`,
`broker-e2e.test.ts` and `stock-live.test.ts` are explicitly
`MANUAL_ONLY_TESTS` in `test-gate.mjs`, excluded from the automated gate
because they need a real broker/emulator/display topology. Bare `npm
test` is not a usable regression gate in this (or any non-devcontainer)
environment; `npm run test:automated` is.

**Symptom 2 — `npm run test:automated` still showed 29 failures**
before this worktree's `.claude/mcp/vice/node_modules` was provisioned
(it started completely empty — 0 packages, only an empty `.cache/` dir
— unlike the main checkout's fully installed tree). Confirmed the
worktree's `package-lock.json` is byte-identical to the main checkout's,
then copied the main checkout's already-`npm ci`'d `node_modules/` into
the worktree (exact copy of already-vetted packages matching the
identical committed lockfile — provisioning, not a new install; not
committed, since `node_modules/` is gitignored). This is the same fix
already documented in `03-direct-tools/deferred-items.md` item 2. After
provisioning, `npm run test:automated` failures dropped from 29 to 1,
and `npx tsc --noEmit` (which had failed with `Cannot find type
definition file for 'node'`, an unrelated symptom of the same missing
`node_modules`) became clean.

**Symptom 3 — the one remaining `npm run test:automated` failure** is
the identical, already-documented worktree-path artifact from this same
file's `04-01` entry above (`repo-root.test.ts`'s "path agreement (D-3,
D-6, THE regression this task exists to catch)" test, test 373 in this
run). Reproduces the exact same assertion text and root cause: the
worktree's own `.git`-walked root sits under `.claude/worktrees/`,
which the test's "must not be under .claude" assertion cannot
distinguish from the real regression it guards against. Confirmed no
reference to `disasm` anywhere in `repo-root.test.ts`, and this task
touched no file that test exercises.

**Disposition:** Not fixed — out of scope for `260817-n6p` (identical
Scope Boundary reasoning as `04-01`'s entry). `disasm-decoder.test.ts`
run in isolation is 74/74 green (including this task's two new WR-01
cases), and it is the only file this task's source changes touch.
`npm run test:automated` is 1189/1195 green with the single pre-existing
worktree-path failure above; `npx tsc --noEmit` is clean.

**Independently reproduced by:** every prior phase-04/03 plan that ran
a full-suite verification from inside this worktree class (see the
`04-01` and `03-direct-tools` entries above) — this is the fourth
independent confirmation that the worktree-path assertion failure is a
function of checkout location, not of any plan's code changes.
