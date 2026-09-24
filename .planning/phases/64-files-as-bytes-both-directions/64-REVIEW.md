---
phase: 64-files-as-bytes-both-directions
reviewed: 2026-09-24T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-kill.mts
  - src/mcp/vice/resources/broker-kill.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/vice-broker-staging.test.ts
  - src/mcp/vice/vice-broker.mts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-09-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This is gap-closure round 4 (plan 64-16, commits `7af0dcdd`/`4516584a`), fixing round 3's
CR-01: `sweepOrphanedStaging()` used to run unconditionally in the pre-bind startup-reap
block, so a second broker that had not yet learned it lost the control-port singleton race
could delete a live first broker's active staging directories (a disk image attached to
unit 8, a file mid-transfer) before ever hitting `EADDRINUSE`. The fix moves the call to a
single new site strictly between the confirmed control-port bind and the first
`writeBrokerRecordFile()` — a window in which (a) every early-return path (bind failure,
squatted port, genuine singleton loss) has already exited before reaching the call, and
(b) this process's own control token has no distribution channel yet, so no session of its
own can have created a staging directory the sweep might touch.

I traced the fix by hand against the actual `run()` control flow (confirmed there is
exactly one code path that reaches the new call site, confirmed no `await` sits between the
bind-success assignment and the sweep call so no interleaving is possible, confirmed
`writeBrokerRecordFile()` runs strictly after), verified `resources/vice-broker.mjs` and
`resources/broker-kill.mjs` are byte-consistent with their `.mts` sources for every change
(diffs are comment-relocation plus the identical call-site move), and ran the full
`broker-control.test.ts`, `broker-kill.test.ts` and `vice-broker-staging.test.ts` suites
(238 tests, 0 failures) against the rebuilt artifacts, including the three new G-64-6
end-to-end tests that spawn real broker processes and assert byte-for-byte staging-file
survival/removal in each of the three scenarios the original CR-01 named (live-first-broker
survives; squatted-port failure leaves staging untouched; a genuinely winning broker still
clears real crash residue before its record exists). The fix is sound and the three new
tests are non-vacuous (each asserts the broker actually reached the branch it claims to, via
a stderr message match, not merely a generic exit code).

One accuracy problem remains in a retained code comment (not touched by this diff, but
present in a file under review), and one lower-severity gap in regression coverage for the
fix's own critical invariant.

## Warnings

### WR-01: A retained comment claims a structural test covers `reapOrphanedConfigScratch()`'s pre-bind placement, but no such test exists

**File:** `src/mcp/vice/vice-broker.mts:2212-2217`

**Issue:** The comment directly above the `reapOrphanedConfigScratch()` call reads:

```
// Phase 64 (XFER-07, D-08): one MORE startup-only reap, beside the
// unconditional reap directly above -- never reordering or gating it (its
// own placement, before the bind attempt and unconditional even for a
// process that goes on to lose the singleton race, is unchanged, and is
// already covered by broker-kill.test.ts's own structural source-order
// check).
```

The only structural source-order test in `broker-kill.test.ts` is:

```ts
test("structural: the real broker's startup reap runs before its control listener accepts ...", () => {
  const source = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  const reapIdx = source.indexOf("await reapOrphanedInstances(");
  const listenerIdx = source.indexOf("await startControlListenerOnHosts(");
  assert.ok(reapIdx !== -1 && listenerIdx !== -1);
  assert.ok(reapIdx < listenerIdx);
});
```

This checks only `reapOrphanedInstances()`'s placement relative to the listener bind. It
never calls `source.indexOf("reapOrphanedConfigScratch(")` at all (confirmed by grep across
every `*.test.ts` in the directory — zero hits). So the claim that `reapOrphanedConfigScratch()`'s
own pre-bind placement is "already covered by broker-kill.test.ts's own structural
source-order check" is false: nothing would fail fast if a future edit moved
`reapOrphanedConfigScratch()` to after the bind (which, unlike `sweepOrphanedStaging()`,
would still be *safe* today because of its own live-pid+identity guard — but the false
confidence is the problem, not present safety). This sentence predates this round's plan
(it was already present, describing both `reapOrphanedConfigScratch()` and the
since-relocated `sweepOrphanedStaging()`, in the pre-64-16 tree) and this round left it in
place unchanged while narrowing its scope to `reapOrphanedConfigScratch()` alone.

**Fix:** Either add a `source.indexOf("reapOrphanedConfigScratch(")` assertion to the
existing structural test (comparing it against `listenerIdx` the same way
`reapOrphanedInstances()` is), or soften the comment to stop claiming test coverage that
does not exist, e.g. "this placement is not itself structurally pinned by a fast test —
see G-64-6's live spawned-broker tests in broker-control.test.ts for the closest behavioral
coverage."

## Info

### IN-01: No fast structural regression guard for the fix's own new invariant — only slow, spawned-process tests protect it

**File:** `src/mcp/vice/vice-broker.mts:2525-2555` (call site); `src/mcp/vice/broker-kill.test.ts` (existing structural-test pattern, not itself in this round's file list)

**Issue:** The project's own established pattern for `reapOrphanedInstances()` pairs a
cheap, source-text structural test (asserting the call sits before the listener bind) with
slower behavioral coverage. `sweepOrphanedStaging()`'s new call site carries an equally
critical ordering invariant — it must sit strictly between the confirmed bind and the first
`writeBrokerRecordFile()`, per this round's own doc comment ("Never move this call back
above the bind... Never move it below the record write..."). The only regression coverage
for that invariant is the three new G-64-6 tests in `broker-control.test.ts`, each of which
spawns a real Node child process running the compiled broker artifact (per-test cost in the
run above: 295–452ms, each declared with a 20-second timeout). There is no equivalent
`source.indexOf("sweepOrphanedStaging(")` structural check that would catch a careless
reordering in milliseconds, the way the sibling reap's placement is caught.

**Fix:** No action required for this round — the live coverage is real and the three new
tests are each non-vacuous. If a fast regression guard is wanted later, add a structural
assertion comparing `source.indexOf("sweepOrphanedStaging(")` against both
`source.indexOf("await startControlListenerOnHosts(")` and
`source.indexOf("writeBrokerRecordFile(args.stateDir, record)")`, mirroring the existing
`reapOrphanedInstances()`-vs-listener check.

---

_Reviewed: 2026-09-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
