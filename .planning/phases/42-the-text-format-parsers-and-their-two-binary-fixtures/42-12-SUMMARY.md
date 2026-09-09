---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 12
subsystem: testing
tags: [text-monitor-live, teardown, process-leak, gap-closure, planted-control]

requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: text-monitor-live.test.ts's live harness, its withBrokerHarness()/startBroker()/stopBroker() shape, and 42-VERIFICATION.md's orchestrator addendum naming the leaked broker daemon (G5)
provides:
  - "A teardown assertion that observes the broker child this harness itself spawns -- its pid joins the existing pidsAliveAfterTeardown array, covered by all eight existing empty-array assertions with no edit at their call sites"
  - "A scratch-scoped stray-process sweep (pidsMatchingCommandLine()) that catches a grandchild no pid was ever recorded for, matched only against this harness's own unique mkdtempSync path so it can never report an unrelated developer broker as a leak"
  - "A proven-removed scratch directory (scratchDirRemoved, asserted via existsSync() after rmSync(), not assumed)"
  - "An unskipped planted-violation control proving the teardown assertion can actually fail, runnable with no VICE_LIVE_STOCK_BIN set at all"
  - "stopBroker() verifying its own SIGKILL escalation instead of returning immediately after sending it"
  - "The file's own header recording the corrected teardown-verification method, replacing the superseded systemd-unit-plus-emulator-only-grep method"
affects: [42-13, 42-14]

actuals:
  tokens: 4793
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Scratch-scoped stray-process sweep: match a diagnostic ps -eo pid=,args= scan against the harness's own unique mkdtempSync path rather than a process name, so a leak detector for THIS harness's children can never misreport an unrelated instance -- never-throw on ps failure, since a diagnostic must not be the reason a run fails for an unrelated cause"
    - "Planted-violation control with no opt-in guard: prove a teardown/leak-detection assertion can fail by spawning a marker-carrying process, asserting the detector sees it, reaping it, and asserting the detector reports it gone -- runnable in seconds with no live dependency, giving a cheap standing answer to 'is this guard still real?'"

key-files:
  created: []
  modified:
    - src/mcp/vice/text-monitor-live.test.ts

key-decisions:
  - "The broker pid joins the existing pidsAliveAfterTeardown array rather than getting a separate assertion, per the plan's own <plan_decisions> -- all eight live cases (not seven; the plan's count was off by one, see Deviations) cover the broker with zero edits at those call sites."
  - "The sweep is needle-scoped to the harness's own scratch path, never the broker's process name -- a tree-wide name search would misreport a developer's unrelated broker instance as this harness's own leak."
  - "stopBroker()'s return type changed from Promise<void> to Promise<boolean> -- the negative SIGKILL outcome is now recorded by the caller rather than silently discarded, per the plan's explicit instruction."

requirements-completed: [PARSE-01, PARSE-02]

coverage:
  - id: D1
    description: "Task 1: the harness observes the broker child it actually spawns (brokerPid folded into pidsAliveAfterTeardown), a scratch-scoped sweep catches an unrecorded grandchild (strayPidsMatchingScratch), scratch-dir removal is proven not assumed (scratchDirRemoved), and an unskipped planted control proves the whole assertion can fail"
    verification:
      - kind: unit
        ref: "text-monitor-live.test.ts#teardown control (no skip guard): plants a marker-carrying process, proves the sweep helper and isAlive() both observe it alive, reaps it, proves both report it gone -- pass, exit 0, run with no VICE_LIVE_STOCK_BIN set"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts, live opt-in run against genuine stock /usr/bin/x64sc VICE 3.9 (VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts) -- 9/9 pass, 0 skipped, all eight live cases' new strayPidsMatchingScratch/scratchDirRemoved assertions green"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: the file header records the corrected teardown-verification method (three subjects, service-unit citation forbidden, planted control named) and the superseded incident, with no behaviour change"
    verification:
      - kind: other
        ref: "grep -ac 'scratch' / 'WHAT NOT TO DO' over the first 110 lines of text-monitor-live.test.ts -- both non-zero; node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts -- 37/37 pass"
        status: pass
      - kind: integration
        ref: "npm run test:automated re-measured at plan end in a verified-clean environment -- 3 failures (anno-import.test.ts, anno-register.test.ts), matching the documented floor exactly, no new failing file"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 12: The Harness Observes The Broker Child It Spawns, And A Planted Control Proves It Summary

**Closed G5 -- `text-monitor-live.test.ts`'s teardown assertion now covers the broker daemon it directly spawns (not just the emulator), a scratch-path-scoped sweep catches any unrecorded grandchild, scratch-directory removal is proven rather than assumed, and an unskipped planted-violation control proves the whole assertion can go red -- with the file's own header recording the corrected method that replaces the systemd-unit-plus-emulator-only-grep check that missed the original leak.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-09T18:57:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `HarnessReport` gained three fields -- `brokerPid`, `strayPidsMatchingScratch`, `scratchDirRemoved` -- and `withBrokerHarness()` populates all three. The broker child's pid is captured immediately after `startBroker()` returns, and in the `finally` block (after `stopBroker()` and the recorded-pid SIGKILL loop) it is bounded-waited for exit and pushed onto the existing `pidsAliveAfterTeardown` array when still alive -- so all eight (see Deviations) pre-existing empty-array assertions now cover the broker with zero edits at their call sites.
- A new module-level `pidsMatchingCommandLine(needle)` helper lists pids of every process whose full command line contains `needle`, via `execFileSync("ps", ["-eo", "pid=,args="], ...)` with `COLUMNS` widened to avoid truncation, excludes the current process's own pid, and returns `[]` (never throws) if `ps` itself cannot run. `withBrokerHarness()` calls it with the harness's own `mkdtempSync` scratch directory as the needle -- never the broker's process name -- so it can never mistake a developer's unrelated broker instance for this harness's own leak. Anything the sweep finds is best-effort SIGKILLed before the scratch directory is removed.
- `stopBroker()`'s signature changed from `Promise<void>` to `Promise<boolean>`: it now waits again after the SIGKILL fallback and returns whether the child actually exited, instead of returning immediately after sending the signal. The caller records a negative outcome by escalating to a direct `process.kill(brokerPid, "SIGKILL")` rather than discarding it.
- `scratchDirRemoved` is computed as `!existsSync(scratchDir)` immediately after the existing `rmSync()` call -- a proof, not an assumption, on a host where `/tmp` is RAM-backed with aging disabled.
- A new unskipped top-level test ("teardown control") spawns a marker-carrying `node -e "setTimeout(() => {}, 60000)" <marker>` child, asserts `pidsMatchingCommandLine()` and `isAlive()` both report it alive, kills it, and asserts both report it gone -- proving the assertion machinery this file relies on can actually fail. It carries no `skip` option at all, so it runs (and passes) on a bare `node --test text-monitor-live.test.ts` with no `VICE_LIVE_STOCK_BIN` set.
- Task 2 extended the file's header comment with a "TEARDOWN VERIFICATION METHOD" section naming all three teardown subjects, stating the scratch-dir-removal proof and why it matters on this host's RAM-backed `/tmp`, naming the planted control as the cheap standing check, and recording the leaked-broker incident (~25 min survival, both prior checks looking at something else) and its consequence (a live broker deterministically reddens an unrelated ordering assertion) -- with no phase number cited, per the plan's own instruction. Two new "WHAT NOT TO DO" entries forbid citing a service-unit status as evidence for this file, and adding a new live case whose teardown assertion omits the stray-sweep/scratch-dir checks.

## Task Commits

1. **Task 1: The harness observes the process it spawns, and a planted control proves the observation can fail** - `296ad507` (feat)
2. **Task 2: Record the corrected teardown-verification method where the next reader will look** - `6ff146a6` (docs)

**Plan metadata:** committed separately below (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `src/mcp/vice/text-monitor-live.test.ts` - `HarnessReport`'s three new fields; `pidsMatchingCommandLine()`; `stopBroker()`'s verified-SIGKILL return value; `withBrokerHarness()`'s reworked teardown half; companion `strayPidsMatchingScratch`/`scratchDirRemoved` assertions at all eight live-case call sites; the unskipped planted-violation "teardown control" test; the header's new teardown-method section and two new "WHAT NOT TO DO" entries.

## Decisions Made

- **Broker pid folded into the existing array, not a separate assertion** (plan's own `<plan_decisions>`, executed as specified) -- avoids an eight-way edit and the risk of a future case forgetting a second assertion.
- **Sweep needle is the scratch path, never a process name** -- the plan's own stated rationale, confirmed correct: a tree-wide `vice-broker` name search would have reported this session's OWN other, legitimate `node --test` invocations (or a developer's unrelated broker) as a leak.
- **`stopBroker()`'s return type changed** from `Promise<void>` to `Promise<boolean>` -- no other file in this tree imports or calls this function (module-local, confirmed by grep), so the signature change is contained entirely within this file.

## Deviations from Plan

### Implementation clarification (not a rule violation)

**The plan's own text says "seven" live cases; the file actually has eight.** Grepping `report.pidsAliveAfterTeardown` call sites in the pre-existing file found eight `test()` blocks each asserting an empty array (one written as a multi-line `assert.deepEqual` at the file's very first test, seven written as single-line calls) -- not seven. This plan's own `<plan_decisions>` describes the mechanism correctly ("push onto the existing array so every case covers it with no edit at call sites"), and that mechanism is unaffected by the miscount: all eight sites received the two new companion assertions (`strayPidsMatchingScratch` deep-equals `[]`, `scratchDirRemoved` is `true`), leaving none uncovered. Documented here per Rule 1/clarification convention (matching 42-10-SUMMARY.md's own precedent for a plan-text-vs-code discrepancy) rather than silently adjusted.

---

**Total deviations:** 0 auto-fixed. One implementation clarification (a plan-text off-by-one that did not change what was built), documented above with no code or coverage impact.
**Impact on plan:** None. No scope creep, no unmet acceptance criteria -- all eight live cases (rather than the plan-stated seven) now carry the full three-part teardown assertion.

## Issues Encountered

None. Both live invocations (opt-in and bare) passed cleanly on every run, and the environment was independently confirmed clean (`ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc'` empty) before and after each measurement in this plan. One note: `pgrep -af '[v]ice-broker|[x]64sc'` itself produced a false-positive match during one evidence-gathering command in this session, because that particular Bash invocation's OWN command-line text happened to contain the literal substring `x64sc` (from the `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc` argument being typed into the same shell wrapper `pgrep` was also scanning) -- confirmed a non-issue by cross-checking with `ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc'` (which greps for the `/x64sc` binary path specifically, not the bare substring), which returned nothing. All "clean" claims below use the un-confounded form.

## User Setup Required

None - no external service configuration required.

## Evidence (per plan's `<output>` instructions)

**`ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep` (the un-confounded equivalent of the plan's own `pgrep -af '[v]ice-broker|[x]64sc'`, used throughout this plan's evidence-gathering after the false-positive noted above), before and after Task 2's two live invocations, verbatim:**

- Before the bare (opt-in-off) run: *(empty -- no process line printed)*, exit 1.
- After the bare (opt-in-off) run: not separately checked (that run spawns no broker/emulator at all -- the live cases skip).
- Before the opt-in (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc`) run: *(empty -- no process line printed)*, exit 1.
- After the opt-in run: *(empty -- no process line printed)*, exit 1.
- `ls -d /tmp/text-monitor-live-* 2>/dev/null`: *(empty)*, exit 2 -- no harness scratch directory survived any run in this plan.

**Broker pid the harness reported for one case** (captured via a temporary, non-committed diagnostic log added and removed during Task 1's own verification, run against the first live test in isolation with `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc`):

```
GSD_42_12_EVIDENCE brokerPid=2251609
```

**The planted control's observed pid, independently cross-checked by an external `ps` poll racing the same 5-second detection window the control itself uses** (the committed code does not print the pid; this poll observes the same externally-visible fact `pidsMatchingCommandLine()` and `isAlive()` check internally):

- During the run (first sighting, polled every 50ms): `2269063 /home/henrik/.nvm/versions/node/v24.20.0/bin/node -e setTimeout(() => {}, 60000) text-monitor-live-teardown-control-2269024-1788980068818-hnzw71g6hhg`
- After the run completed: no match for the same marker string -- confirmed reaped.

**`npm run test:automated` at plan start:** not independently re-measured with a fresh command invocation before this plan's edits began (only the environment-cleanliness check was run at that point) -- matching 42-10-SUMMARY.md's own disclosed convention for this exact situation. The most recent prior measurement is 42-11-SUMMARY.md's own second (environment-reconfirmed) reading, taken the same day: `tests 3927 | suites 24 | pass 3911 | fail 3 | cancelled 0 | skipped 8`, failing files `anno-import.test.ts`, `anno-register.test.ts` -- the documented 3-failure floor.

**`npm run test:automated` at plan end** (clean environment, confirmed via the `ps` check above immediately beforehand):

```
tests 3927 | suites 24 | pass 3913 | fail 3 | cancelled 0 | skipped 6
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- exactly the documented pre-existing 3-failure floor, no new failing file introduced by this plan.

**Superseded method, stated explicitly:** the previous teardown-verification record (42-09-SUMMARY.md's "Teardown verification result" line: a `systemctl --user is-active vice-broker.service` check plus a `ps ... | grep x64sc` check) is superseded by this plan. Neither half of that method could ever have caught the broker leak this plan closes: this harness never starts a systemd/launchd unit at all (it spawns `resources/vice-broker.mjs` directly via `spawn(process.execPath, [BROKER_ARTIFACT, ...])`), so the service-unit check observed nothing real; and the emulator-only `x64sc` grep never named the broker process, so a surviving `vice-broker.mjs` child was invisible to it by construction. The method recorded in this plan's Task 2 header addition -- three explicit subjects (recorded emulator pids, the broker's own pid, and a scratch-path-scoped sweep) plus scratch-dir-removal proof plus an unskipped planted control -- replaces it.

## Next Phase Readiness

- G5 is closed. This plan's own `must_haves.truths` are all satisfied by real code: the harness observes the broker child it spawns, the scratch-scoped sweep catches an unrecorded grandchild with no possibility of false-positiving on an unrelated instance, scratch-dir removal is proven not assumed, the assertion is proven able to fail by an unskipped planted control, and the file's own header names the corrected method rather than citing a service unit this file never uses.
- Both required live invocations (bare/opt-in-off and `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc`) pass cleanly with the environment verified clean before and after, and `npm run test:automated` sits exactly at the documented 3-failure floor with no new failing file.
- Next: 42-13, 42-14 per the existing gap-closure sequence (IN-02, in `textmon-profile.ts`, is this phase's next remaining item per 42-11-SUMMARY.md's own forward note).
- No blockers.

## Self-Check: PASSED

All key files confirmed present on disk (`text-monitor-live.test.ts`, this SUMMARY). Both commit hashes (`296ad507`, `6ff146a6`) confirmed present in `git log --oneline --all`. Environment confirmed clean of broker/emulator processes and scratch directories at the time this SUMMARY was written.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
