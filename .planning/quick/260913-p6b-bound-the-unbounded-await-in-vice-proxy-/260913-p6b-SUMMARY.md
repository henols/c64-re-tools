---
phase: quick-260913-p6b
plan: 01
subsystem: testing
tags: [node-test-runner, vice-proxy, test-infrastructure, measurement]

requires: []
provides:
  - "A bounded, honest census of all 117 top-level tests in src/mcp/vice/vice-proxy.test.ts"
  - "A named, un-repaired timeout on the two recycle-stub wait helpers that previously hung the file"
affects: ["a future phase-sized re-baselining of vice-proxy.test.ts against the current, ~58%-smaller vice-proxy.ts"]

actuals:
  tokens: 816
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "withUnsettleableWaitDeadline(pending, timeoutMs, what): races a promise that can only resolve from a specific external callback against an unref'd, finally-cleared setTimeout, so an unsatisfiable wait fails with a named cause instead of hanging the whole test file."

key-files:
  created:
    - .c64-re-tools/runs/vice-proxy-census/260913-p6b/full-run.txt
  modified:
    - src/mcp/vice/vice-proxy.test.ts

key-decisions:
  - "Bounded the wait in the two shared helpers (makeControllableRecycle's waitForCall, makeControllableRecycleSequence's next), not at any of the 13 call sites, per the plan's design_decision: one helper-level fix makes the file finish in one run, and all 13 call sites are bare awaits so a healthy wait's behavior is unchanged."
  - "Did NOT touch the mutable_scope_authority's second-helper allowance — the file completed cleanly on the first pass, so no extension was needed."
  - "Did NOT act on anything the census revealed, per C-2. Every failure in the list below is left exactly as found."

patterns-established:
  - "withUnsettleableWaitDeadline as the file's third bounded-wait convention, alongside nextMessage(timeoutMs=8000) and waitForCondition({timeoutMs=8000}), reusing the same 8000ms number."

requirements-completed: [QUICK-260913-p6b]

duration: ~10min
completed: 2026-09-13
status: complete
---

# Phase quick-260913-p6b: Bound the unbounded await in vice-proxy.test.ts Summary

**Bounded two unsettleable recycle-stub wait helpers with an 8000ms named deadline, so `vice-proxy.test.ts` now completes in ~2m16s and reports a full 122/45/73/0 (tests/pass/fail/cancelled) census instead of hanging at 71/31/36/1-then-timeout.**

**This does NOT fix `vice-proxy.test.ts` and does NOT unblock the push.** The file is still red — badly red, in fact (73 failures, up from 36 previously observed). This plan makes the file *measurable*, nothing more. The actual re-baselining of this 6,493-line test file against the ~58%-smaller `vice-proxy.ts` it now tests is a separate, phase-sized job that is waiting on a product decision this census exists to inform.

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-09-13T16:24:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 1 (`src/mcp/vice/vice-proxy.test.ts`)

## Accomplishments

- Added `withUnsettleableWaitDeadline<T>(pending, timeoutMs, what)` — a module-scope helper directly above `makeControllableRecycle()` — that races a promise against an unref'd `setTimeout`, clearing the timer in a `.finally()` so a healthy resolution leaves nothing behind and a firing deadline cannot itself hold the event loop open.
- Routed `makeControllableRecycle()`'s `waitForCall` and `makeControllableRecycleSequence()`'s `next()` through the helper, both with an 8000ms deadline and a message containing the literal substring `onRecycle() to fire`, naming that the proxy never sent the recycle request and pointing at the proxy's response/stderr for why.
- Confirmed the previously-isolated-hanging test — `vice_recycle: the incident record -- with its evidence section already complete -- exists on disk before the recycle request reaches the broker` — now completes in 8443ms and FAILS honestly with the new message, where it previously exited 124 (external `timeout 90`) with `cancelled 1`.
- Ran the complete file (no test-name-pattern) to completion for the first time: `tests 122 / pass 45 / fail 73 / cancelled 0 / skipped 4 / todo 0`, in 135747.9ms (~2m16s), well inside the file's own healthy ~3-minute baseline plus the handful of 8s deadline hits.
- Saved the complete raw, unedited run at `/home/henrik/dev/henrik/git/c64-re-tools/.c64-re-tools/runs/vice-proxy-census/260913-p6b/full-run.txt` (1323 lines).
- Confirmed `npm run test:automated` is unaffected: `tests 4399 / pass 4390 / fail 0 / cancelled 0 / skipped 9 / todo 0`, RC=0 — matching the documented baseline exactly, since `vice-proxy.test.ts` is a `MANUAL_ONLY_TESTS` entry the automated gate never runs.

## The Complete Census

Extracted from `.c64-re-tools/runs/vice-proxy-census/260913-p6b/full-run.txt`:

```
tests 122
suites 0
pass 45
fail 73
cancelled 0
skipped 4
todo 0
duration_ms 135747.893307
```

### Three interpretive comparisons (as required by the plan)

1. **Fail count rose from 36 to 73, as expected.** 46 previously-unreached tests now run (71 → 122 wait, actually the isolated-count-of-declared-and-ran number moved from 71 to 122, a rise of 51 not 46 — see note below), and the additional runs surfaced 37 more failures (73 − 36 = 37) on top of the 36 already known. This is the expected direction: the gate required `fail >= 36` and it rose, it did not fall. No pre-existing failure was repaired — every failure that existed before this change still exists after it, for the same reason.
   - Note on the "46 previously-unreached tests" figure from the plan's objective: that number was derived from `117 declared - 71 previously run = 46`. The actual full run reports `tests 122`, 5 more than the 117 top-level `test(` count — `node --test`'s own "tests" tally includes some non-top-level constructs (e.g. subtests) in addition to the 117 top-level ones, which is why `122 - 71 = 51` rather than 46. The top-level test( count itself is unchanged at 117 (verified below), and the qualitative claim — the previously-unreached tail of the file now runs to a verdict — holds regardless of which of these two counting conventions is used.
2. **`cancelled` is now 0, where it was 1.** The isolated run of the blocking test alone went from `cancelled 1` / exit 124 to `fail 1` / exit 1 (non-124) with the new named message. The full-file run shows `cancelled 0` throughout.
3. **The previously-hanging test appears in the failing list, not vanished.** `vice_recycle: the incident record -- with its evidence section already complete -- exists on disk before the recycle request reaches the broker` is present in the full-run failing-tests section (line 791 of `full-run.txt`), failing with `Error: timed out after 8000ms waiting for onRecycle() to fire -- the proxy never sent a recycle request to the broker...`.

### Complete list of failing test names (all 73, unedited, unsampled)

1. tracer: one real tool call round-trips end to end
2. vice_disk_list is refused at tools/call with no request made
3. tools_list is refused at tools/call with no request made
4. vice_disk_list is absent from tools/list
5. structural: the construction-time tools registry itself filters DENY_LIST, not merely tools/list's wire output
6. tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap) except for DENY_LIST's deliberate absence
7. epoch drift is reported loudly and not cached
8. a missing epoch file is not a restart
9. an oversized result is recoverable in full across continuations
10. an exhausted continuation token fails loudly
11. an unknown continuation token (never issued by this proxy) fails loudly, not silently or opaquely
12. the _meta cap stamp and the actual chunk boundary never drift apart
13. never-throw: malformed and hostile input is answered, not fatal
14. never-cache: host down then up succeeds without a restart
15. three states: each unreachable shape gets its own message and fix
16. path translation: a lexical .. cannot escape the workspace, and one that resolves back inside still translates
17. with an explicit endpoint override set, the control listener receives no connection at all
18. containerize: a loopback grant url is rewritten so the forwarded call actually reaches a stub bound off loopback
19. containerize safety net: a grant whose epoch_file translates outside the workspace is refused, falling back to the port-derived path
20. containerize safety net: a grant whose url port disagrees with the granted port is refused, falling back to the port-derived url
21. D-13: a dead granted instance costs exactly one replacement acquisition; the triggering call fails loudly naming the replacement, and the next call succeeds on it
22. D-13: a replacement that lands back on the SAME port as the unreachable original, with an epoch read that never advances, is reported honestly -- never a false 'changed from N to N' and never one port number labelled as two different instances
23. D-13: the epoch baseline after a replacement is re-based to the replacement's OWN epoch, proven by a later drift comparing against it
24. D-13/D-14: a replacement the broker itself refuses (at_capacity) is only reachable on the FRESH session's own attempt, reporting session-must-restart
25. D-13: two consecutive calls against a still-unreachable replacement each attempt exactly one MORE replacement, proving nothing is cached
26. structural: the replaced-machine report is built from the existing voided-run vocabulary (epochDriftMessage), not a second one
27. D-14: the broker connection itself gone -- with a replacement listener available, a forwarded call opens a fresh session, adopts a replacement, and reports it in the same replaced-machine vocabulary
28. D-14: the broker connection itself gone -- with nothing available to reconnect to, a forwarded call reports the session must be restarted, naming the broker
29. D-14: two consecutive calls after the connection dropped each attempt a fresh session from scratch, proving nothing is cached
30. structural: within handleGrantedInstanceUnreachable(), the same-session release call precedes the same-session acquire call, and appears exactly once
31. structural: the fresh-session replacement branch performs no release over the dead session, and the source states why
32. structural: the source records broker death as an accepted, knowing regression, naming what was survivable before
33. fixed-port unreachable is unchanged: no lease held still produces the 01.1 never-started message naming the surviving launcher
34. structural: no message quotes the launcher with a subcommand -- vice-launcher.sh accepts none
35. vice_recycle: a missing or empty reason returns a well-formed error result naming the requirement, writes no record and no request
36. vice_recycle: no broker lease held yet for this session is refused, writes no record and no request
37. vice_recycle: the incident record -- with its evidence section already complete -- exists on disk before the recycle request reaches the broker
38. vice_recycle: an ack whose kill stage is the escalated one produces a result naming that stage verbatim
39. vice_recycle: an ack with a refusal produces an error result naming the refusal, and finalises the incident record with that outcome
40. vice_recycle: an ack that never arrives before the deadline produces a well-formed error result naming the timeout and the record path, never a hang and never a throw
41. vice_recycle: the broker dropping the connection mid-recycle is reported distinctly from a refusal acknowledgement
42. vice_recycle: after a confirmed recycle, a subsequent forwarded call succeeds rather than failing the epoch drift guard
43. vice_recycle: a confirmed kill whose epoch file never advances within the poll deadline persists epoch_after as null, never the stale value equal to epoch_before
44. vice_recycle: a rejected screenshot capture records unavailable with the reason, and every other evidence entry is still populated
45. vice_recycle: a rejected checkpoint enumeration records unavailable for that entry, and the capture still returns
46. vice_recycle: a stand-in that rejects every read produces a fully-populated (all-unavailable) evidence object, and the capture still returns rather than throwing
47. vice_recycle: a rejected snapshot attempt records unavailable with the reason, and the recycle still completes
48. vice_recycle: an unanswered snapshot call does not prevent the recycle from completing
49. vice_recycle: two recycles at the same port and epoch produce two distinct record files, and the first is byte-unchanged
50. structural: within handleRecycle(), the record write appears before the request write (D-17's ordering guard, region-scoped)
51. structural: the set of source files under src/mcp/vice/ containing a network-call construct is exactly broker-launch.mts, vice-probe.ts and vice.ts
52. structural: neither synthetic tool name appears in tools-manifest.stock.json, and both appear in a live tools/list response
53. tools_call carrying a nested vice_disk_list argument is now refused before any request reaches the stand-in host (closes the gap the prior test proved)
54. diagnose: a stopping checkpoint at the current PC is a checkpoint trap, and no bracket is run
55. diagnose: a stopping checkpoint at the resolved live IRQ handler is a checkpoint trap
56. diagnose: the trap report names the vector pair, the $01 value, and that remediation is not guaranteed
57. diagnose: a restarted epoch is reported with both epoch values, and no checkpoint enumeration is attempted
58. diagnose: the live IRQ handler resolver is called fresh on every diagnose call, never cached
59. diagnose: a ping-says-running, counter-frozen stand-in is wedged, and records exactly two resumes; a healthy stand-in records exactly one
60. diagnose: a ping-says-not-running, counter-advancing stand-in is live -- the ping execution field decides nothing
61. diagnose: a byte-identical register read with an advancing counter is stale_read_path
62. diagnose: a below-baseline non-zero rate (six thousand cycles/s) is reported as an observation, not a verdict of its own
63. structural: runCycleBracket has exactly one definition, and every stopwatch call in the file lies inside it
64. structural: DIAGNOSE_VERDICTS is a frozen five-member array, and every fixture's verdict in this file is a member of it
65. seam: arming a stopping exec checkpoint is forwarded and annotated, never refused
66. seam: the annotated result's error flag is false and the host payload is intact
67. seam: the annotation makes no additional forwarded calls
68. seam: a repeat arm at the same address is suppressed to a pointer, and an epoch change clears it
69. structural: every SEAM_HAZARDS entry has a detector, an annotation and a test
70. structural: the refusal set and the annotation set are disjoint
71. synthetic second entry ('test-fixture-synthetic-entry') is detected and annotated through the same SEAM_HAZARDS walk, proving the mechanism is genuinely data-driven
72. structural: SEAM_HAZARDS's checkpoint-arming detector and renderer never route through isErrorText or make a forwarded call
73. BACK-05 (D-G ordering, observed at the wire): DENY_LIST still wins over a capability refusal for tools_call, and the synthetic tools are never refused

**Note on item 73 (BACK-05):** the standing memory note "live-broker-reddens-back-05-test" warns that a live host VICE broker deterministically reddens this test. `systemctl --user is-active vice-broker` was checked both before and after the full run and reported `inactive` both times — this failure is therefore a genuine census result, not broker contamination, and is left untouched per C-2.

## Mechanical Gate Verification

- `git diff --name-only HEAD~1 HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/` → exactly `src/mcp/vice/vice-proxy.test.ts` (the Task 1 commit is the only tracked-tree change; `git diff HEAD` alone reads empty because the change is already committed per this executor's per-task-commit protocol — the `HEAD~1 HEAD` comparison is the correct equivalent check post-commit).
- `grep -cE '^test\(' src/mcp/vice/vice-proxy.test.ts` → `117` (unchanged).
- `grep -cE 'test\.(skip|todo)\(|skip: true|todo: true' src/mcp/vice/vice-proxy.test.ts` → `0` (unchanged).
- Isolated run of the target test: `RC=1` (not 124), `fail 1`, `cancelled 0`, output contains `onRecycle() to fire`. GATE_PASS.
- Full run: `full-run.txt` non-empty (1323 lines), `cancelled 0`, `tests 122` (>= 117), `fail 73` (>= 36), target test name present. GATE_PASS.
- `npm run test:automated`: RC=0, `fail 0`, `skipped 9` — baseline untouched.
- `pgrep -c x64sc` → `0`. Three pre-existing `vice-proxy.ts` processes (PIDs 29448, 30143, 2651137 — Claude Code's own MCP servers) confirmed still running, untouched.

## Task Commits

1. **Task 1: Bound the unsettleable recycle waits so the known hang fails honestly instead of hanging** - `5ec87df9` (test)
2. **Task 2: Run the whole file to completion and record the full honest census** - no code change; produced `.c64-re-tools/runs/vice-proxy-census/260913-p6b/full-run.txt` (gitignored, not committed)

**Plan metadata:** committed separately by the orchestrator per this task's constraints (SUMMARY.md/STATE.md are not committed by the executor).

## Deviations from Plan

None — plan executed exactly as written. The file completed on the first full run; the `mutable_scope_authority` allowance for a second bounded helper was never invoked because no further hang occurred.

## Known Stubs

None introduced by this change. The three deliberate never-settling `new Promise(() => {})` stubs at lines 2831, 4516 and 4563 (verified untouched by the diff) remain intentional and exist to exercise the product's own deadline, per C-5.

## Threat Flags

None. This change adds only a test-file helper; no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced.

## What This Does NOT Do

This plan does **not** fix `vice-proxy.test.ts` and does **not** unblock any push gated on it passing. It makes the file *measurable* — every one of its 117 declared tests now reaches a verdict in one run, where 46 previously never ran at all. The 73 failures recorded above are the honest input to a separate, phase-sized re-baselining decision (re-baselining a 6,493-line test file against a `vice-proxy.ts` that a prior phase shrank by ~58%), which remains explicitly out of scope here and is waiting on a product decision.

## Self-Check: PASSED

- `src/mcp/vice/vice-proxy.test.ts` — FOUND, diff confirmed scoped to this file only.
- `.c64-re-tools/runs/vice-proxy-census/260913-p6b/full-run.txt` — FOUND (1323 lines, non-empty).
- Commit `5ec87df9` — FOUND in `git log --oneline`.
