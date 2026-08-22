---
phase: 14-backend-decision
plan: 03
subsystem: testing
tags: [fork-backend, mcpserver, live-transport, manual-only-test, criterion-3]

# Dependency graph
requires:
  - phase: 14-backend-decision (plan 14-01)
    provides: "FORK-01 branch token (retain) and sub-question B non-override"
provides:
  - "fork-live.test.ts: a committed, env-gated, default-skipped test that drives the fork's own -mcpserver HTTP transport against a real fork binary through the same useInstance()/call()/serverInfo() seam production uses"
  - "The fork transport's first live exercise recorded in this repository, with 6/6 tests passed and 0 skipped against a real /usr/local/bin/x64sc (VICE 3.10)"
  - "14-CRITERION3-EVIDENCE.md: the phase's criterion-3 live artifact, naming the binary unambiguously by absolute path and reported version"
  - "fork-live.test.ts registered as the eighth entry in test-gate.mjs's MANUAL_ONLY_TESTS, with test-gate.test.ts's drift guard updated to match"
affects: [14-04-backend-decision, 14-05-backend-decision]

# Actuals (#2632)
actuals:
  tokens: 9200
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fork-live.test.ts follows stock-live.test.ts's exact opt-in idiom (VICE_LIVE_*_BIN env var, computed-once SKIP_REASON threaded through node:test's { skip } option, before()/after() lifecycle with teardown-runs-even-on-throw, freeEphemeralPort() via createServer) but drives vice.ts's HTTP transport seam (useInstance/call/serverInfo) instead of stock-dispatch.ts's binary-monitor seam"
    - "Spawned argv derived from production's own buildViceArgs({backend:'fork', mcpHost:'127.0.0.1'}) rather than hand-written, so the test cannot silently drift from what the broker actually launches"

key-files:
  created:
    - .claude/mcp/vice/fork-live.test.ts
    - .planning/phases/14-backend-decision/14-CRITERION3-EVIDENCE.md
    - .planning/todos/pending/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md
  modified:
    - .claude/mcp/vice/test-gate.mjs
    - .claude/mcp/vice/test-gate.test.ts
    - .planning/STATE.md

key-decisions:
  - "Unconditional on the FORK-01 branch: this plan's live exercise ran regardless of the retain/deprecate/remove decision, because the fork transport still ships at the end of this phase on every branch (per the plan's own framing)."
  - "The manifest/live surface diff is not asserted as an exact match in either direction — only 'every manifest name is live' is a hard assertion. An extra live-only name (vice_snapshot_list) is logged as a finding and filed as a todo, not treated as a test failure, because the manifest is a generated point-in-time snapshot rather than a live source of truth."

requirements-completed: [FORK-01, FORK-02]

coverage:
  - id: D1
    description: "fork-live.test.ts written: env-gated, default-skipped everywhere, drives vice.ts's real useInstance()/call()/serverInfo() seam against buildViceArgs()'s own fork-branch argv forced to loopback"
    requirement: "FORK-01"
    verification:
      - kind: unit
        ref: "fork-live.test.ts (VICE_LIVE_FORK_BIN unset — all 6 skipped, 0 pass/fail)"
        status: pass
      - kind: unit
        ref: "test-gate.test.ts (eight-entry drift guard, 3/3 passing) + docs-dangling-refs.test.ts (8/8 passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live exercise actually ran against the real fork binary (/usr/local/bin/x64sc, VICE 3.10): 6/6 passed, 0 skipped, including the load-bearing vice_sid_get_state (FORK-02 hard-loss route) call"
    requirement: "FORK-02"
    verification:
      - kind: integration
        ref: "VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc node --test fork-live.test.ts -- 6/6 pass, 0 skip (see 14-CRITERION3-EVIDENCE.md ## Observed results)"
        status: pass
    human_judgment: true
    rationale: "The plan's own verify block includes a human-check step reading 14-CRITERION3-EVIDENCE.md against ROADMAP Phase 14 criterion 3, confirming the binary is labelled unambiguously and the recorded results are observations rather than success assertions -- this SUMMARY records that the automated proof passed, but the plan itself requires a human read of the evidence document."
  - id: D3
    description: "No stray emulator process survives the run; the committed test's diff against its own commit is empty (not tuned to pass)"
    verification:
      - kind: other
        ref: "pgrep -f 'x64sc.*-mcpserver' (no genuine match after run) + git diff -- fork-live.test.ts (empty vs Task 1 commit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CI and npm test stay green with no emulator present -- fork-live.test.ts is invisible to the automated gate and package tarball"
    verification:
      - kind: unit
        ref: "node test-gate.mjs (automated set excludes fork-live.test.ts) + node scripts/check-npm-packages.mjs (no test file leaked)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 3: Live Fork-Transport Test and Criterion-3 Evidence

**Wrote and ran `fork-live.test.ts` — the first live exercise of the fork backend's own `-mcpserver` HTTP transport anywhere in this repository's history — 6/6 passing against a real `/usr/local/bin/x64sc` (VICE 3.10), with `vice_sid_get_state` (FORK-02's load-bearing hard-loss route) confirmed followable end to end.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-22T09:44:41Z
- **Completed:** 2026-08-22T10:10:00Z
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files modified:** 6 (4 created, 3 modified: 2 test-gate files, plus a STATE.md deviation fix)

## Accomplishments
- `fork-live.test.ts` written following `stock-live.test.ts`'s exact opt-in
  idiom: `VICE_LIVE_FORK_BIN` env var (default `/usr/local/bin/x64sc`), a
  computed-once `SKIP_REASON` threaded through every `test()`'s `{ skip }`
  option, `before()`/`after()` lifecycle with teardown that runs even on
  throw, `freeEphemeralPort()` via `createServer`, and a per-run
  `mkdtempSync()` scratch `XDG_CONFIG_HOME`.
- The spawned argv is derived from production's own
  `buildViceArgs(port, { backend: "fork", mcpHost: "127.0.0.1" })` — not
  hand-written — so the test cannot silently drift from what the broker
  actually launches. Test 1 asserts the resulting argv binds
  `-mcpserverhost` to `127.0.0.1` and never `0.0.0.0` (T-14-09).
- Six tests: bind posture, `serverInfo()` vs. the committed manifest
  (58 `vice_*` names, well above the 50-name non-vacuity floor), `vice_ping`,
  `vice_registers_get`, `vice_sid_get_state` (the FORK-02 hard-loss
  assertion), and `beginSession()`/`readEpoch()` session bookkeeping.
- Registered as the **eighth** entry in `test-gate.mjs`'s
  `MANUAL_ONLY_TESTS` — the one registry, no second list — with
  `test-gate.test.ts`'s drift guard updated to expect eight entries and
  `docs-dangling-refs.test.ts` confirmed unaffected (it only scans
  `package.json`'s `files[]`, which `fork-live.test.ts` was deliberately
  kept out of).
- **Live run, opted in:** `VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc node
  --test fork-live.test.ts` — **6 passed, 0 failed, 0 skipped**. Full
  observed payloads for `vice_ping`, `vice_registers_get`, and
  `vice_sid_get_state` recorded verbatim in
  `14-CRITERION3-EVIDENCE.md`.
- `14-CRITERION3-EVIDENCE.md` written: binary identity (fork
  `/usr/local/bin/x64sc`, VICE 3.10, 20,259,104 bytes, 6 `mcpserver`-flag
  mentions in `--help`, vs. stock `/usr/bin/x64sc`, VICE 3.9, 4,057,928
  bytes, 0 mentions), exact spawned argv/endpoint, per-test observed
  payloads, an explicit provenance/limits section (one host, one build, one
  run), and one finding.
- **Finding:** the live server offers `vice_snapshot_list`, which the
  committed `tools-manifest.json` (generated 2026-07-31) does not list — no
  other name mismatch in either direction. Filed as a pending todo
  (`2026-08-22-tools-manifest-stale-missing-vice_snapshot_list`) rather than
  silently regenerating the manifest mid-evidence, per the plan's own
  instruction not to weaken or fix around a finding.
- No stray `x64sc` process survived the run (`pgrep -f 'x64sc.*-mcpserver'`
  returned no genuine match once teardown completed).

## Task Commits

1. **Task 1: Write the live fork-transport test and register it in the one manual-only list** - `cae7811` (feat)
2. **Task 2: Run the live exercise against the real fork binary and record the evidence** - `a71776a` (docs)

**Deviation fix (Rule 2):** `ae05182` (fix) — see below.

**Plan metadata:** (this commit)

## Files Created/Modified
- `.claude/mcp/vice/fork-live.test.ts` - the live fork-transport test (opt-in, default-skipped everywhere)
- `.claude/mcp/vice/test-gate.mjs` - `MANUAL_ONLY_TESTS` extended to eight entries; header comment updated
- `.claude/mcp/vice/test-gate.test.ts` - drift guard updated to expect eight entries
- `.planning/phases/14-backend-decision/14-CRITERION3-EVIDENCE.md` - the recorded live run: binary identity, argv/endpoint, observed payloads, provenance/limits, findings
- `.planning/todos/pending/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md` - the manifest-drift finding, filed rather than fixed
- `.planning/STATE.md` - Deferred Items row added for the new pending todo (deviation fix, see below)

## Decisions Made
- **Unconditional on FORK-01's branch token.** This plan's live exercise ran
  irrespective of `retain`/`deprecate`/`remove` — the fork transport still
  ships at the end of this phase on every branch, so criterion 3's live
  check had to be paid regardless of the decision recorded in 14-01.
- **The manifest-vs-live surface diff asserts one direction only.** Every
  manifest name must be live (hard assertion); an extra live-only name is a
  logged finding, not a failure — the manifest is a generated point-in-time
  snapshot (`refresh-manifest.ts`'s job), and a stricter two-way assertion
  would make this test a manifest-freshness gate it was never meant to be.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a STATE.md Deferred Items row for the new pending todo**
- **Found during:** post-Task-2 full-suite verification (`node test-gate.mjs`, run per this session's mandated full-scope verification, not scoped to touched files)
- **Issue:** `docs-deferred-ledger.test.ts`'s AUDIT-04 direction-A guard failed: the pending todo filed by Task 2 (`2026-08-22-tools-manifest-stale-missing-vice_snapshot_list`) had no corresponding row in `STATE.md`'s `## Deferred Items` section. A second, adjacent AUDIT-04 subtest in the same file failed as a direct consequence.
- **Fix:** Added one table row to `STATE.md`'s Deferred Items section naming the todo, its priority (`low`), and a one-line summary matching the todo's own framing.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `node --test docs-deferred-ledger.test.ts` went from 2 failing / 2 passing to 4/4 passing. Full `node test-gate.mjs` re-run afterward dropped from 8 failures to 1 (a pre-existing, documented full-suite-load flake in `r2000-mcp-client.test.ts`, confirmed green when run focused — see Issues Encountered).
- **Committed in:** `ae05182`

---

**Total deviations:** 1 auto-fixed (1 missing-critical).
**Impact on plan:** Necessary for the automated gate to stay green after this plan's own new artifact (the pending todo); no scope creep — the fix is a one-line documentation row, not a code change.

## Issues Encountered

**Full-suite test-gate.mjs run surfaced 8 failures on the first pass; 7 of
the 8 are the exact pre-existing full-suite-load flakes this plan's dispatch
instructions named in advance** (`audit-integrity.test.ts`'s D-12-02 case,
`broker-control.test.ts`'s SIGHUP/singleton case, `r2000-cli.test.ts`'s
`--help`/verb-options bin cases, and `r2000-mcp-client.test.ts`'s
mid-call-exit-family Property 1/2/5 and Task-3 cases). All seven were
re-run focused (`node --test <file>.test.ts` in isolation) and passed
cleanly: `audit-integrity.test.ts` 43/43, `broker-control.test.ts` 45/45,
`r2000-cli.test.ts` 64/64, `r2000-mcp-client.test.ts` 23/23 — confirming
these are timing-sensitive child-process-stub tests under full-suite CPU/IO
contention, not regressions introduced by this plan. The 8th failure
(`docs-deferred-ledger.test.ts`'s AUDIT-04 direction-A) was this plan's own
gap, fixed above. A second full-suite re-run afterward showed exactly 1
failure remaining — a `r2000-mcp-client.test.ts` Property-5 case from the
same known-flaky family, also confirmed green when run focused
(23/23) — consistent with the documented flake pattern, not a new one.

One background-shell hazard during Task 2 verification: a long-running
chained verification command exceeded the tool's foreground timeout and was
moved to background automatically; a subsequent `pgrep -f 'x64sc.*-mcpserver'`
transiently matched a shell process whose own argv contained the literal
string `x64sc` (the invoking command line itself), not a real emulator
process — confirmed by `ps -p <pid>` returning nothing moments later. No
actual leaked process occurred at any point; this is recorded for
transparency about a confusing signal encountered during verification, not
as a defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Criterion 3's live artifact exists on the `retain` branch:
  `14-CRITERION3-EVIDENCE.md` names the fork build unambiguously (absolute
  path + reported version, contrasted against stock's) and records observed
  payloads rather than success assertions, per the plan's own human-check
  instruction.
- `fork-live.test.ts` is committed, repeatable, and default-skipped
  everywhere — CI and `npm test` stay green with no emulator present, and
  `npm run test:automated` never runs it (verified: it is absent from both
  `package.json`'s `files[]` and the automated test set).
- One new pending todo carried forward (`2026-08-22-tools-manifest-stale-missing-vice_snapshot_list`,
  `low` priority) for plan 14-05's deferred-ledger reconciliation.
- `FORK-01`/`FORK-02` are NOT yet marked complete in `.planning/REQUIREMENTS.md`:
  the shared-ID gate (#2388) correctly holds them open pending plans 14-04
  and 14-05's own SUMMARY.md files (14-04 also declares FORK-01; check
  14-05's frontmatter for FORK-02's other declarer).
- No blockers.

## Self-Check: PASSED

- `[ -f .claude/mcp/vice/fork-live.test.ts ]` → FOUND
- `[ -f .planning/phases/14-backend-decision/14-CRITERION3-EVIDENCE.md ]` → FOUND
- `[ -f .planning/todos/pending/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md ]` → FOUND
- `git log --oneline --all | grep -q cae7811` → FOUND
- `git log --oneline --all | grep -q a71776a` → FOUND
- `git log --oneline --all | grep -q ae05182` → FOUND
- All task-level `<acceptance_criteria>` re-run: PASS (tsc clean; unset-env run all-skip 6/6; live run 6/6 pass 0 skip; test-gate/docs-dangling-refs green; `grep -c` fork-live.test.ts in test-gate.mjs = 1; automated set excludes fork-live.test.ts; `files[]` exclusion confirmed; `check-npm-packages.mjs` OK; no stray `x64sc -mcpserver` process; `git diff` on the test file empty vs Task 1 commit)
- Plan-level `<verification>` re-run: PASS (full list in the plan's own `<verification>` block, all satisfied — see body above for the one full-suite flake and its focused-run confirmation)

---
*Phase: 14-backend-decision*
*Completed: 2026-08-22*
