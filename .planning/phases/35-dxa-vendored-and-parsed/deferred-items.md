# Deferred items

Out-of-scope discoveries made during plan execution, logged per the executor's
scope-boundary rule ("only auto-fix issues DIRECTLY caused by the current
task's changes... log out-of-scope discoveries here, do NOT fix them").

## 35-03: intermittent `host-scripts.test.ts` gitignore-parity flake

**Test:** `` `.gitignore` and install-resources.ts's deployed set
(resourceEntries() + the deploy manifest) are in two-way parity `` in
`src/mcp/vice/host-scripts.test.ts`.

**Observed:** Failed twice during this plan's session with:
```
.gitignore is missing /tools/vendor/dxa/dxa -- a deployed artifact with no
ignore line shows up as untracked noise in git status in whatever commit
happens to follow.
```
but PASSED on the plan's official opening-floor measurement run (recorded
below) and on the closing-floor measurement run, both taken via
`npm run test:automated` with no intervening code change to
`install-resources.ts`, `.gitignore`, or anything under
`src/mcp/vice/resources/`. `resourceEntries()` walks
`src/mcp/vice/resources/` at call time; the module directory holds no `dxa`
file at rest (checked directly with `find`/`ls` immediately after the failing
runs). This is consistent with a test-ordering/concurrency race where some
other test transiently deposits a file under `resources/vendor/dxa/` during
its own run and `host-scripts.test.ts`'s parity check observes that
transient state — not a real gap this plan's own code (`dxa-partition.ts`,
which touches neither `install-resources.ts` nor `resources/`) introduced.

**Scope:** Out of scope for plan 35-03 (source-derived/byte-derived
partition tiers). Not fixed here. Left for whichever plan or maintenance
pass next touches `install-resources.ts`/`host-scripts.test.ts` to
investigate the underlying race, if it recurs with enough frequency to be
worth chasing.

**Evidence:** Three full `npm run test:automated` runs taken during this
plan's session, saved as scratch logs (not committed, session-local):
run 1 (before any 35-03 commits) -- FAIL on this test, PASS on none else
new; run 2 (immediately re-run in full, same pre-35-03 state) -- PASS on
this test, confirming non-determinism; run 3 (after all 35-03 commits,
closing floor) -- PASS on this test. The two `anno-register.test.ts`
failures (`STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` requirements-bookkeeping
drift) are present in all three runs and are the plan 35-02-recorded floor,
unrelated to this plan.

## Orchestrator (phase-35 close): the `audit-root-args.test.ts` flake, culprit named

**Added from the orchestrator seat at the phase gates, not by a plan executor.**
Recorded here because it is a measured out-of-scope discovery that would
otherwise be lost, and because it shares one mechanism with the 35-03 entry
above.

**Test:** the `--root`-spelling sub-tests of `src/mcp/vice/audit-root-args.test.ts`
(`check-skill-tool-coverage` and `check-skill-fork-honesty`, both
"every spelling that RESOLVES to the repository root is accepted").

**Observed at the closing gate (commit `9b228c7a`):** 2 failing sub-tests, with
`check-skill-tool-coverage` reporting `got 1, unflagged 0` and an `ENOENT` inside
the subprocess it spawns:

```
Error: ENOENT: no such file or directory, open
'<repo>/src/skills/acme-build/zz-scratch-in03-negative.md'
    at scripts/check-skill-tool-coverage.mjs:666:26
```

`check-skill-fork-honesty` failed in the inverse direction (`got 0, unflagged 1`).

**Culprit, identified by direct measurement — this is what the closing reading in
`evidence/35-baseline.md` could only hedge at ("a scratch file one of those tests
writes and removes"):** `src/mcp/vice/skill-honesty-checks.test.ts` creates
`zz-scratch-in03-negative.md` **inside `src/skills/acme-build/`**, a directory that
`scripts/check-skill-tool-coverage.mjs` walks. Node's test runner executes test
FILES concurrently, so the checker subprocess spawned by `audit-root-args.test.ts`
can glob that path while the file exists and then `readFileSync` it after
`skill-honesty-checks.test.ts` has removed it. The two `--root` spellings run as
two separate subprocesses at two different instants, so they legitimately disagree.

**Verification:**
- `grep -arln 'zz-scratch-in03-negative' src/mcp/vice/ scripts/` → `src/mcp/vice/skill-honesty-checks.test.ts` (sole creator)
- `ls src/skills/acme-build/zz-scratch-in03-negative.md` → absent at rest
- `node --test audit-root-args.test.ts` **alone: 58/58 pass, 0 fail**

**Why this is not a phase-35 regression:** the file was neither created nor modified
by this phase; the failure is scheduling-dependent (0 failures in the orchestrator's
wave-1, wave-2 and wave-3 gates, 1 in the opening reading, 2 in the closing reading,
with no intervening change to either test); and neither assertion references any
phase-35 artefact.

**Same mechanism as the 35-03 entry above.** Both are a test writing a scratch file
into a directory another test's directory-walk observes, under concurrent test-file
execution — one under `resources/vendor/dxa/`, one under `src/skills/acme-build/`.
A fix should make scratch fixtures land outside any walked tree (e.g. `mkdtemp`),
which is the idiom `dxa-live.test.ts` already uses.

**Scope:** out of scope for phase 35 — not fixed. Left for whichever pass next
touches these tests.
