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
