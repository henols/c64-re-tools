---
phase: 34-the-host-tool-execution-seam
plan: 09
subsystem: infra
tags: [host-tool, ghidra, timeout, argv-construction, security, gap-closure, dos-mitigation]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool executor and its single-timeout constant, plan 34-07's resolved-paths pattern, and plan 34-08's HOST_TOOL_PATH_ARG_KEYS census, all of which this plan extends rather than replaces"
provides:
  - "HOST_TOOL_TIMEOUT_MS (host-tool.mts): a per-tool server-side budget table with an explicit entry for every HOST_TOOL_IDS member -- ghidra.analyze gets 600_000ms (10 min), every other tool keeps the pre-existing 20s default -- plus hostToolTimeoutMs(), the one resolver every spawn site reads from (CR-04)"
  - "HOST_TOOL_REQUEST_TIMEOUT_MS / hostToolRequestTimeoutMs() (host-tool-client.ts): the client-side per-tool request-deadline table, declared where vice-broker-client.ts's pinned export census cannot reach it"
  - "hostToolOverControlPlane()'s single timer split into a connect-phase timer (CONTROL_CONNECT_TIMEOUT_MS) and a request-deadline timer (per-tool, started the instant the request line is written), mirroring openBrokerControl()'s own connect-then-request split"
  - "Every attempted-invocation log line now carries the applied budget (timeout_ms=<n>); a request refused before any spawn still logs nothing"
  - "A cross-seam ordering test iterating every HOST_TOOL_IDS member, importing both the server table and the client resolver, asserting client deadline > server budget for each"
  - "vice-broker.mts's onHostTool wiring documents why it supplies no timeout: the per-tool table inside the executor is authoritative"
  - "SEAM-02 flipped Complete in REQUIREMENTS.md, after the three-plan closure gate ran and passed"
affects: []

actuals:
  tokens: 13128
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-tool budget table, both sides: a single default constant demoted to a fallback-for-an-unclassified-tool-id, with a per-tool table as the primary representation -- the same generalization shape 34-08's HOST_TOOL_PATH_ARG_KEYS census already used for path-bearing keys."
    - "Connect-then-request timer split: mirrors vice-broker-client.ts's openBrokerControl()/sendAndAwaitLine() pair exactly -- a connect timer cleared the instant the connection is usable, then a separate, larger deadline for the actual work."
    - "Deliberate duplication plus an iterating assertion: the client and server budget tables live in two files (two processes) with no shared import, and a test that imports BOTH and iterates every tool id is the anti-drift mechanism, not a comment."
    - "`exec sleep N` over `sleep N; exit 0` in a fake test launcher: a forked grandchild inherits the parent's stdio pipe file descriptors, so SIGKILL on the immediate child alone does not promptly end a test that measures kill-on-expiry -- `exec` replaces the process image so there is only one pid to kill."

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool-client.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - docs/phase34-host-tool-seam-decisions.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "ghidra.analyze's server-side budget is 600_000ms (10 min) and its client-side request deadline is 660_000ms (11 min) -- a fixed 60s margin above the server budget rather than a percentage, chosen because the side that owns the budget (the host-bound executor) must always be the side whose refusal a caller sees; 60s is comfortably larger than any plausible response-transmission delay without being needlessly slack."
  - "The client-side table and resolver are declared in host-tool-client.ts, never added to vice-broker-client.ts, whose export list is pinned by exact set equality (vice-broker-client.test.ts:1208) -- confirmed by re-reading that pin before writing any code, per the plan's own Traps section."
  - "The kill-on-expiry test case's fake Ghidra launcher uses `exec sleep N`, not `sleep N; exit 0` -- discovered live while writing the case: the naive form measured a ~6s 'kill' because the orphaned sleep grandchild kept the shared stdout/stderr pipe file descriptors open past the parent shell's own SIGKILL death, delaying node's close event for the full sleep regardless of the kill signal actually being delivered promptly."
  - "The connect-phase-timeout test dials 10.255.255.1 (a private-range address empirically confirmed, before the test was written, to hang rather than fail fast in this sandbox) rather than trying to simulate a TCP handshake delay over loopback, which is not possible: a client's 'connect' event fires once the OS-level handshake completes, independent of whether the listening application has called accept() yet."
  - "The connect-phase-vs-request-deadline message-distinctness acceptance criterion is additionally backed by a source-text assertion (mirroring host-tool-transport.test.ts's own readCapFromBrokerControlSource precedent) alongside the live network test, rather than relying solely on the network-dependent case."

requirements-completed: [SEAM-02]

coverage:
  - id: D1
    description: "A ghidra.analyze request whose tool outlives the TCP-connect timeout completes over the real, default-configured control-plane route -- the exact round trip CR-04 found could never complete before this plan, observed with a measured elapsed time"
    requirement: "SEAM-02"
    verification:
      - kind: integration
        ref: "host-tool.test.ts#END TO END (slow): a ghidra.analyze request whose fake launcher sleeps longer than the connect-timeout constant resolves ok:true over the real control-plane route, with all seven VICE callbacks provably uncalled"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every HOST_TOOL_IDS member has an explicit, finite server-side budget at or below a stated ceiling; ghidra.analyze's budget clears this project's own measured JVM-startup numbers with headroom"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_TIMEOUT_MS: every HOST_TOOL_IDS member has a server-side table entry, and every entry is finite and at or below a stated ceiling"
        status: pass
    human_judgment: false
  - id: D3
    description: "For every tool id, the client-side request deadline is strictly greater than the server-side budget -- proven by an iterating test that imports both sides, not asserted by comment"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#cross-seam ordering: for every HOST_TOOL_IDS member, the client-side request deadline (host-tool-client.ts) is strictly greater than the server-side budget (host-tool.mts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "spawnHostTool()'s kill-on-expiry behaviour is unchanged: raising a budget never removed the bound, and an invocation that outlives its (small, explicit) budget is still killed and reported as a refusal naming that budget"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: a slow ghidra.analyze launcher killed on expiry names the small budget it was given, and returns well under the launcher's own sleep"
        status: pass
    human_judgment: false
  - id: D5
    description: "The applied budget is on the one log line per attempted invocation; a request refused before any spawn still logs nothing"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: a ghidra.analyze run with no override logs a line whose timeout_ms equals HOST_TOOL_TIMEOUT_MS[\"ghidra.analyze\"]"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: an acme.build run with no override logs a line whose timeout_ms equals DEFAULT_HOST_TOOL_TIMEOUT_MS"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: an explicit deps.timeoutMs is what gets logged, not the table entry -- the test seam and the table cannot be confused"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two overlapping slow ghidra.analyze invocations over the real control-plane route both complete on their own deadlines, write to distinct per-run project locations, and the pair finishes in appreciably less than the sum of their durations -- the per-invocation binding's concurrency claim, observed"
    requirement: "SEAM-02"
    verification:
      - kind: integration
        ref: "host-tool.test.ts#two overlapping slow ghidra.analyze host_tool requests over the real control-plane route both resolve ok:true, reserve distinct project locations, and the pair completes in appreciably less than the sum of the two sleeps"
        status: pass
    human_judgment: false
  - id: D7
    description: "hostToolOverControlPlane() rejects with a connect-phase message when nothing accepts the connection within the connect budget, and with a distinct request-deadline message naming its own milliseconds when the listener accepts but never answers -- backstop truth, verified by both a live network case and a source-text assertion"
    requirement: "SEAM-02"
    verification:
      - kind: integration
        ref: "host-tool.test.ts#hostToolOverControlPlane rejects with a connect-phase message naming the connect-timeout constant when nothing accepts the connection within it"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#host-tool-client.ts's connect-phase and request-deadline rejection messages are textually distinct, each naming its own budget"
        status: pass
    human_judgment: false
  - id: D8
    description: "vice-broker.mts's onHostTool wiring documents why it supplies no timeout -- the executor's per-tool table is authoritative, and a reader arriving at this artifact finds the answer rather than an apparent gap"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "grep -a -c 'authoritative' src/mcp/vice/vice-broker.mts == 1"
        status: pass
    human_judgment: false
  - id: D9
    description: "SEAM-02 is marked complete only after the closure gate covering plans 34-07, 34-08 and this plan actually ran and passed; the decision record describes what changed, what did not, and what is still unmeasured, as an appended correction rather than a rewrite"
    requirement: "SEAM-02"
    verification:
      - kind: other
        ref: "gate run recorded below (host-tool/ghidra-project/resources-sync/host-tool-transport/broker-control/hostpath-consumers suites, packer-finding.test.mjs, typecheck, check-npm-packages, check-no-skill-external-spawn, check-skill-cli-invocations, test:automated) -- all passed or at the documented floor before the REQUIREMENTS.md edit"
        status: pass
    human_judgment: true
    rationale: "The correction's prose quality (reads as a correction, not a rewrite; names gap 2 and CR-04; does not soften the unmeasured-JVM statement) is a judgment call the plan's own <verify> block flags with a <human-check> -- automated greps confirm structure and line counts, not prose fidelity."

duration: 27min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 09: The Per-Tool Timeout Budget and the Two-Timer Split Summary

**CR-04 closed: `ghidra.analyze` now runs under a 10-minute server-side budget with an 11-minute client-side deadline, `hostToolOverControlPlane()`'s single connect-bound timer is split into a connect phase and a separately-sized request-deadline phase, every tool has an explicit budget observable off its own log line, and a live end-to-end test proves the exact round trip that could not complete before this plan now does.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-09-03T21:16:00Z (approx.)
- **Completed:** 2026-09-03T21:43:08Z
- **Tasks:** 3
- **Files modified:** 8 (0 created, 8 modified)

## Accomplishments

- `HOST_TOOL_TIMEOUT_MS` (`host-tool.mts`) gives every `HOST_TOOL_IDS` member an explicit server-side budget: `ghidra.analyze` gets 600,000ms (10 minutes, clearing the documented 12.6-17.4s JVM startup and the project's own 12407ms/11160ms observations with headroom for a real multi-minute analysis), the other three keep the pre-existing 20s default. `hostToolTimeoutMs(tool, override)` is the one resolver `runHostTool()`, `runOracleProbe()` and `runOracleRun()` all read from.
- `hostToolOverControlPlane()` (`host-tool-client.ts`) now runs TWO timers instead of one: a connect-phase timer bounded by the existing `CONTROL_CONNECT_TIMEOUT_MS` (5000ms), cleared the instant the request line is written, then a request-deadline timer sized per tool by a new client-side table (`HOST_TOOL_REQUEST_TIMEOUT_MS`/`hostToolRequestTimeoutMs()`, declared in this file rather than the pinned-export `vice-broker-client.ts`). `ghidra.analyze`'s client deadline (660,000ms) is strictly greater than its server budget by design — the side that owns the budget reports the verdict.
- A live end-to-end test drives a fake Ghidra launcher that sleeps 6 seconds — longer than the old single-timer bound — through the real control-plane route and observes `ok: true` with a measured elapsed time exceeding `CONTROL_CONNECT_TIMEOUT_MS`: the exact round trip CR-04 identified as impossible before this plan.
- Every attempted-invocation log line now carries the applied budget (`timeout_ms=<n>`), so which budget governed a run is observable rather than inferred; a request refused before any spawn still logs nothing.
- A completeness case (every `HOST_TOOL_IDS` member has a finite server entry at or below a stated ceiling) and a cross-seam ordering case (iterating every tool id, importing both the server table and the client resolver, asserting client-deadline > server-budget for each) make "no tool can ship without a bounded, correctly-ordered budget" a tested mechanism rather than a sentence.
- An overlapping-slow-pair case proves the per-invocation JVM binding's concurrency claim by observation: two concurrent slow `ghidra.analyze` requests both resolve `ok: true`, reserve distinct per-run project directories, and the pair finishes in well under the sum of the two sleeps.
- A kill-on-expiry case proves raising a budget never removed the bound: a small explicit `deps.timeoutMs` still kills the child and reports a refusal naming that budget, promptly rather than after the launcher's own sleep.
- `vice-broker.mts`'s `onHostTool` wiring gained a comment recording why it supplies no timeout: the executor's per-tool table is authoritative and no wire field carries a budget.
- `SEAM-02` is marked `Complete` in `REQUIREMENTS.md` (checkbox and status-table row, exactly two changed lines) — the LAST act of this plan, after the closure gate covering `34-07`, `34-08` and this plan ran and passed (see Gate Run below).
- `docs/phase34-host-tool-seam-decisions.md` gained an appended Part 3 correction: what was wrong (CR-04's two undersized budgets), what changed (per-tool budgets, ordered), what did not change (the per-invocation binding and its `N=20`/`P=30%` reversal condition), and what is still unmeasured (no new real JVM timing was taken this round — the end-to-end evidence is a fake launcher that sleeps).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — a tool that outlives the connect timeout completes over the real control-plane route** - `465c2d6` (feat)
2. **Task 2: The budget is observable, complete, and ordered across the seam — and the broker wiring says why it supplies none** - `7986cdb` (test)
3. **Task 3: The ledger and the decision record brought into agreement with the code** - `06f01b6` (docs)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `HOST_TOOL_TIMEOUT_MS`, `hostToolTimeoutMs()`; all three spawn-site reads (`runHostTool()`'s acme/ghidra branch, `runOracleProbe()`, `runOracleRun()`) now call the resolver; every attempted-invocation log line gains a `timeout_ms=<n>` field; `DEFAULT_HOST_TOOL_TIMEOUT_MS`'s doc comment corrected to describe it as the fallback, not the ceiling
- `src/mcp/vice/host-tool-client.ts` - `HOST_TOOL_REQUEST_TIMEOUT_MS`, `DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS`, `hostToolRequestTimeoutMs()`; `hostToolOverControlPlane()`'s single timer split into a connect-phase timer and a request-deadline timer, with distinct rejection messages
- `src/mcp/vice/host-tool.test.ts` - `withFakeGhidraHome` gains an optional slow-launcher mode (`exec sleep N`, not `sleep N; exit 0` — see key-decisions); new cases: the slow END-TO-END completion, the kill-on-expiry refusal, the connect-phase-timeout case (against a hanging private-range address), the message-distinctness source assertion, the per-tool-positive-deadline sanity case, the three budget-selection/override log cases, the completeness case, the cross-seam ordering case, and the overlapping-slow-pair case
- `src/mcp/vice/vice-broker.mts` - `onHostTool` wiring's comment extended to record why it supplies no timeout (the per-tool table is authoritative); no behaviour change
- `src/mcp/vice/resources/host-tool.mjs`, `src/mcp/vice/resources/vice-broker.mjs` - regenerated committed build artifacts, byte-identical to a fresh `node build.ts` (confirmed by `resources-sync.test.ts`)
- `docs/phase34-host-tool-seam-decisions.md` - appended Part 3 correction (additions only — `git diff` shows zero removed content lines)
- `.planning/REQUIREMENTS.md` - SEAM-02's checkbox and status-table row flipped to complete (exactly two changed lines)

## Decisions Made

See `key-decisions` in the frontmatter for the five decisions and their rationale: the 600s/660s Ghidra budget pair and its 60s margin, declaring the client table in `host-tool-client.ts` rather than the pinned `vice-broker-client.ts`, the `exec sleep N` launcher fix discovered live while writing the kill-on-expiry case, the 10.255.255.1 choice for the connect-phase-timeout test, and backing the message-distinctness criterion with both a live network test and a source-text assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The kill-on-expiry test's fake launcher did not measure a prompt kill**
- **Found during:** Task 1 (writing the kill-on-expiry case)
- **Issue:** The fake Ghidra launcher script was `#!/bin/sh\nsleep N\nexit 0\n`. Sending `SIGKILL` to the immediate child (the shell) does not terminate `sleep`, which runs as a forked grandchild inheriting the same stdout/stderr pipe file descriptors `spawnHostTool()` reads. The orphaned `sleep` process keeps those pipe fds open until its own natural exit, so Node's `close` event — and therefore the test's measured "kill" — did not fire until the full sleep elapsed (measured: ~6022ms for a 6s sleep, when the test asserted well under 3000ms).
- **Fix:** Changed the launcher body to `#!/bin/sh\nexec sleep N\n`, which replaces the shell's own process image with `sleep` (no fork) — there is only one pid, and `SIGKILL` on it terminates the sleep immediately.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** Re-ran the kill-on-expiry case: it now measures ~508ms for a 500ms budget against a 6s sleep, well under the 3000ms bound.
- **Committed in:** `465c2d6` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a test-only bug discovered and fixed within the same task, before it could ship as a flaky or misleading case).
**Impact on plan:** No scope creep — a mechanical fix to a test helper this plan itself introduced, caught by directly observing the assertion fail during authoring rather than by a later regression.

## Verification Notes

**Gate run (Task 3, before the REQUIREMENTS.md edit):**

- `node build.ts && node --test host-tool.test.ts ghidra-project.test.ts resources-sync.test.ts host-tool-transport.test.ts broker-control.test.ts hostpath-consumers.test.ts`: 195 tests, 195 pass, 0 fail, 0 skipped.
- `node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs`: 19 tests, 18 pass, 0 fail, 1 skipped (named — no external `unp64` oracle installed on this host, the expected/documented absence).
- `npm run typecheck`, `node scripts/check-npm-packages.mjs`, `node scripts/check-no-skill-external-spawn.mjs`, `node scripts/check-skill-cli-invocations.mjs`: all clean (`OK`).
- `npm run test:automated` (no VICE broker running, confirmed via `pgrep -af 'node.*resources/vice-broker.mjs'`): measured at 3262 tests, 3253-3254 pass, 2-3 fail across repeated runs, 1 skipped, 5 todo. Investigated the variance: a first run showed 3 failures including one in `audit-root-args.test.ts` ("check-skill-tool-coverage: every spelling that RESOLVES to the repository root is accepted"); re-running that file in isolation passed 58/58, and two subsequent full-suite runs both settled at exactly 2 failures — `anno-register.test.ts`'s documented `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` pre-existing bookkeeping floor ("DIRECTION 5 (basis integrity)" and "planted violation (the negative control)"), unrelated to any file this plan touched. The `audit-root-args.test.ts` case is an environment-timing flake (it took 4800ms in the failing run vs. ~3300ms in isolation), not a regression this plan introduced. Final measured state: 2-in-1, within the documented 5-in-3 floor.
- `.planning/REQUIREMENTS.md`: `grep -c '^| SEAM-02 | Phase 34 | Complete |'` and `grep -c '^- \[x\] \*\*SEAM-02\*\*'` both equal 1; `git diff .planning/REQUIREMENTS.md` shows exactly two changed lines; no other requirement id touched.
- `docs/phase34-host-tool-seam-decisions.md`: `git diff --stat` shows insertions only (65 lines added, the diff's single `-` line is the `--- a/...` header, not a removed content line).

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SEAM-02` is now `Complete` — this closes the last gap-closure plan in this round (`34-07`, `34-08`, `34-09`). All three plans' closure gates have run and passed.
- Phase 34 (The Host-Tool Execution Seam) has no further plans in its own directory beyond this gap-closure round; the phase's own requirements (`SEAM-01`..`SEAM-07`) are now all `Complete`.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/host-tool-client.ts
- FOUND: src/mcp/vice/host-tool.test.ts
- FOUND: src/mcp/vice/vice-broker.mts
- FOUND: src/mcp/vice/resources/host-tool.mjs
- FOUND: src/mcp/vice/resources/vice-broker.mjs
- FOUND: docs/phase34-host-tool-seam-decisions.md
- FOUND commit: 465c2d6
- FOUND commit: 7986cdb
- FOUND commit: 06f01b6
- `node --test host-tool.test.ts`: 67/67 pass
- `node --test ghidra-project.test.ts resources-sync.test.ts host-tool-transport.test.ts broker-control.test.ts hostpath-consumers.test.ts`: all pass (195 combined with host-tool.test.ts)
- `npm run typecheck`: clean
- `node scripts/check-npm-packages.mjs`: OK
- `node scripts/check-no-skill-external-spawn.mjs`: OK
- `node scripts/check-skill-cli-invocations.mjs`: OK
- `npm run test:automated`: measured at the documented 2-in-1 floor (see Verification Notes)
- `grep -c '^| SEAM-02 | Phase 34 | Complete |' .planning/REQUIREMENTS.md`: 1
- `grep -c '^- \[x\] \*\*SEAM-02\*\*' .planning/REQUIREMENTS.md`: 1

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
