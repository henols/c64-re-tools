---
phase: 64-files-as-bytes-both-directions
plan: 16
subsystem: broker
tags: [staging, startup-sweep, singleton, control-port-bind, g-64-6, xfer-07, tdd]

# Dependency graph
requires:
  - phase: 64 (plan 64-05)
    provides: sweepOrphanedStaging() and reapOrphanedConfigScratch(), the two startup passes with opposite lifetime rules (D-07, D-08)
  - phase: 64 (plan 64-08)
    provides: the control-token gate that acquire and stage_file sit behind, whose only distribution channel is broker.json
provides:
  - "run() (vice-broker.mts) calls sweepOrphanedStaging() once, after the loopback bind is confirmed and before the first writeBrokerRecordFile(), so a broker that loses the singleton removes nothing under the staging root"
  - "three spawned-real-broker regression tests in broker-control.test.ts, each named with G-64-6: a losing second broker, a loud-loss broker on a squatted port, and a winning broker over crash residue"
  - "startRealBroker() and the liveness round trip in broker-control.test.ts default VICE_BROKER_HOME to their own mkdtempSync state directory"
  - "sweepOrphanedStaging()'s contract text in broker-kill.mts states its bind-winner precondition, names the defect and forbids a pid check as a substitute"
affects: [65, 66]

# Actuals (#2632)
actuals:
  tokens: 10437
  tasks: 2
  commits: 2
plan_head_before: 291464226acd5a699227ff2a0450c72e224dc6c4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A destructive startup pass whose only safety argument is 'the residue is unambiguous at the next broker's start' runs inside the region where the kernel enforces the singleton: after the confirmed bind, before the token is published."
    - "Test brokers are spawned against a fresh mkdtempSync VICE_BROKER_HOME by default, with the caller's env spread last so a test can still override it."

key-files:
  created:
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-16-red-evidence-losing-second-broker.json
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-16-red-evidence-squatted-port-broker.json
  modified:
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/broker-kill.mts
    - src/mcp/vice/resources/broker-kill.mjs
    - src/mcp/vice/vice-broker-staging.test.ts
    - .planning/phases/64-files-as-bytes-both-directions/deferred-items.md

key-decisions:
  - "Route (a), as planned: the staging sweep runs only in the process that won the control-port bind, before it publishes its token. Route (b), per-directory owner records with a pid-liveness check, was not built, because it would bring back the pid-reuse heuristic run()'s startup header records retiring."
  - "reapOrphanedConfigScratch() stays in the pre-bind, unconditional block. Its mandatory live-pid and identity guard (D-08) makes it safe in a process that goes on to lose the singleton. Only the unguarded staging sweep moved."
  - "The shared-home, different-control-port configuration stays an accepted residual (T-64-G6-04). The call-site comment names it with the same scope limit the singleton comment at the bind states."

patterns-established:
  - "Bind-winner-only destructive startup work: place it between the confirmed loopback bind and the first writeBrokerRecordFile(). Never above the bind (a loser reaches it), and never below the record write (a client can hold the token and stage a file the pass would remove)."

requirements-completed: [XFER-07]

coverage:
  - id: D1
    description: "A second broker that loses the control-port bind, quietly (a live first broker holds the port) or loudly (a plain squatter holds it), removes nothing under the staging root: the session directory and its staged file survive with an unchanged sha256, and the losing broker logs no staging-sweep line"
    requirement: "XFER-07"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#singleton staging (G-64-6): a losing second broker leaves a live first broker's staging session directory and its staged file in place"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#singleton staging (G-64-6): a broker that fails loudly on a squatted control port leaves the staging root untouched"
        status: pass
    human_judgment: false
  - id: D2
    description: "A broker that wins the bind still removes a crashed broker's staging residue, both a directory holding a staged file and an empty interrupted-removal-shaped directory, by the time its discovery record first exists; deleting the one sweep call makes that test fail"
    requirement: "XFER-07"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#startup staging sweep (G-64-6): a broker that wins the control-port bind has removed a crashed broker's staging residue by the time its discovery record exists"
        status: pass
      - kind: other
        ref: "Task 2 mutation command: sed deletes the sweep call from vice-broker.mts, node --test --test-name-pattern='startup staging sweep' broker-control.test.ts exits 1 (# fail 1), files restored byte-identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "run()'s one non-comment sweepOrphanedStaging() call sits after the confirmed loopback bind and before the first writeBrokerRecordFile(); reapOrphanedInstances() and reapOrphanedConfigScratch() still precede the bind; the call-site comment names the defect and the residual"
    requirement: "XFER-07"
    verification:
      - kind: other
        ref: "Task 1 verify grep block: sweep_calls=1, reap=2205 config=2232 bind=2320 listener=2522 sweep=2555 record_write=2598, SWEEP_ORDER_OK, PREBIND_REAPS_OK, incident_named=2, residual_named=1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every broker the automated suite spawns runs against a temporary VICE_BROKER_HOME, so a test run next to a live machine-level broker never sweeps its staging root"
    requirement: "XFER-07"
    verification:
      - kind: other
        ref: "Task 1 verify grep block: broker_spawn_sites=2, home_confinements=2 in broker-control.test.ts; census table in this SUMMARY (broker-kill.test.ts:563 already confined)"
        status: pass
    human_judgment: false
  - id: D5
    description: "broker-kill.mts's contract text matches the new placement: no unconditional-residue claim, no shared-block claim, the precondition stated as 'won the control-port bind', and sweepOrphanedStaging()'s body never references isAlive; the no-pid-check test passes unedited"
    requirement: "XFER-07"
    verification:
      - kind: other
        ref: "Task 2 verify grep block: unconditional_residue_claim=0, same_block_claim=0, precondition_stated=1, stale_test_comment=0, isalive_called_in_sweep=0"
        status: pass
      - kind: unit
        ref: "broker-kill.test.ts#sweepOrphanedStaging: removes every session directory it finds, and its injected liveness check is never called"
        status: pass
    human_judgment: false
  - id: D6
    description: "The automated gate and the full-glob suite are green with no broker running, and the committed resources match their sources"
    verification:
      - kind: other
        ref: "npm run test:automated (re-run): 4277 tests / 4268 pass / 0 fail / 9 skipped, exit 0"
        status: pass
      - kind: other
        ref: "npm test (full glob): 4452 tests / 4368 pass / 0 fail / 84 skipped, exit 0, not_ok=0"
        status: pass
      - kind: unit
        ref: "resources-sync.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 6h51m wall clock (about 45 min active)
completed: 2026-09-24
status: complete
---

# Phase 64 Plan 16: The staging sweep runs only in the bind winner Summary

**run() now calls sweepOrphanedStaging() only after the loopback control-port bind is confirmed and before broker.json first publishes the control token. A second broker that loses the singleton, quietly or loudly, no longer deletes a live broker's staging. The bind winner still clears crash residue, and a mutation test proves the guarding test is not vacuous.**

## Performance

- **Duration:** 6h51m wall clock from dispatch (2026-09-24T11:47:15Z) to SUMMARY (2026-09-24T18:40Z). About 45 minutes of that was active work. The rest was the gap after the first executor stopped on a provider quota error partway through Task 2, before this continuation executor started.
- **Tasks:** 2 of 2
- **Files modified:** 6 source and resource files, plus 2 new evidence records and 1 deferred-items entry

## Accomplishments

- The defect is gone at its source. The one `sweepOrphanedStaging({ root: brokerStagingDir() })` call moved out of the pre-bind block to `vice-broker.mts:2555`. That line is after the bind block closes (`listener = { host: loopbackListener.host ...` at :2522) and before `registerShutdownHandlers()`. It is also before the first `writeBrokerRecordFile(args.stateDir, record)` at :2598. Every early return for a failed or lost bind comes before it.
- Three spawned-real-broker tests (compiled `resources/vice-broker.mjs` under bare node, `VICE_BIN=/bin/sleep`, no emulator) prove the behaviour through the real `run()`. Two losing-broker tests failed on the pre-fix tree and pass now. The winning-broker test passes throughout and fails when the sweep call is deleted.
- The automated suite's spawned brokers are confined to temporary homes (census below). The machine-level `~/.c64-re-tools/staging/` was empty before this plan and still is after two full-suite runs (mtime 01:21, before today).
- `broker-kill.mts`'s contract text and `vice-broker-staging.test.ts`'s section comment now match the new placement. No function body or assertion changed.

## Task Commits

1. **Task 1 (tracer, tdd): Tracer: a losing second broker leaves a live broker's staging in place, and the winning broker still sweeps crash residue** - `7af0dcdd` (feat)
2. **Task 2: The sweep's contract text states its new precondition, the crash-sweep guard is proven non-vacuous, and the full suite is green** - `4516584a` (docs)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY.

Two commits by another session landed between the task commits on the same branch: `41fe297f` and `553bc029`. Neither touches a file this plan changed. `git rev-list --count 29146422..HEAD` reads 4 for that reason, and 2 of those commits are this plan's.

## Files Created/Modified

- `src/mcp/vice/vice-broker.mts` - the sweep call moved behind the confirmed bind. The config-scratch comment was rewritten to describe only that pass. A new call-site comment carries the defect, the own-sessions proof, the three prohibitions and the residual.
- `src/mcp/vice/resources/vice-broker.mjs` - regenerated build output.
- `src/mcp/vice/broker-control.test.ts` - the three G-64-6 tests, the `seedStagingSession()` helper, and `VICE_BROKER_HOME` confinement in `startRealBroker()` and the liveness round trip.
- `src/mcp/vice/broker-kill.mts` - the section banner and `sweepOrphanedStaging()`'s JSDoc and `isAlive` doc state the bind-winner precondition (comments only).
- `src/mcp/vice/resources/broker-kill.mjs` - regenerated build output.
- `src/mcp/vice/vice-broker-staging.test.ts` - section comment only. It pins root agreement, not placement.
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-16-red-evidence-*.json` - the two retroactive RED evidence records.
- `.planning/phases/64-files-as-bytes-both-directions/deferred-items.md` - one new out-of-scope entry (below).

## TDD Gate Compliance

**Violation: missing RED commit (tdd.md Fail-Fast Rule 3).** Task 1 is `tdd="true"`. `git log -E --grep='^test\(0*64-0*16\):'` returns nothing. The only gate commit is `7af0dcdd feat(64-16): ...`, which landed the three tests and the fix together. No `test(64-16)` commit precedes the `feat(64-16)` commit. History was not rewritten to hide this. No REFACTOR commit exists, and none was needed.

**A contemporaneous RED run exists, but not as a commit.** The first executor's scratch log `t1-red.tap` was written at 13:59 local, three minutes before `7af0dcdd` at 14:02. With no source file changed, it shows `# tests 3 / # pass 1 / # fail 2`:
- The losing-second-broker test failed at `broker-control.test.ts:2304`, `assert.doesNotMatch(secondStderr, /staging sweep found/)`, with the message "a losing second broker must never run the staging sweep at all". The losing broker's own stderr carried `vice-broker: staging sweep found 1 session director(y/ies), removed 1` next to `another broker is already running and holds control port 39537 -- exiting quietly as a second instance`.
- The squatted-port test failed at `broker-control.test.ts:2357` with "the seeded staging session directory must still exist" (`expected: true, actual: false`).
- The winning-broker test passed, as the plan predicted. Today's sweep already ran before the record write.

**Retroactive RED evidence, produced by this continuation.** A detached worktree was created outside the repo at `7af0dcdd^` (`29146422`), with the post-fix `broker-control.test.ts` copied in and the main tree's `node_modules` symlinked. `node --test --test-reporter=tap --test-name-pattern=G-64-6 broker-control.test.ts` exited 1 with `# tests 3 / # pass 1 / # fail 2`. The same two tests failed on the same two assertions (:2304, :2357). The same command on the current tree exited 0 with 3/3 passing. Both records were persisted and checked:

| Record | `check tdd-red-evidence` verdict |
|--------|----------------------------------|
| `evidence/64-16-red-evidence-losing-second-broker.json` | `RED_EVIDENCE_OK` (`target_test_failed`), exit 0 |
| `evidence/64-16-red-evidence-squatted-port-broker.json` | `RED_EVIDENCE_OK` (`target_test_failed`), exit 0 |

The scratch worktree was removed with `git worktree remove --force` and `git worktree prune`. **This evidence is retroactive.** It proves the tests detect the defect against the pre-fix source. It does not cure the commit-order violation above.

**One nuance against the plan's prediction.** The plan expected the losing-second-broker test to fail "on the directory-survives assertion". It fails one assertion earlier, on the no-sweep-line assertion at :2304, so the directory-survives assertion at :2306 is never reached. The stderr it quotes (`removed 1`) is the losing broker reporting that it removed the live broker's session directory. The squatted-port test fails on its directory-survives assertion exactly as predicted.

## Non-vacuity (mutation) check

The plan's Task 2 mutation command was run exactly as written, after Task 1 was committed:
- `CLEAN_BEFORE=yes`
- `mutant_numstat=0	1	src/mcp/vice/vice-broker.mts` (one line deleted, none added)
- `MUTANT_EXIT=1`, `# tests 1 / # pass 0 / # fail 1`
- The failing assertion was `broker-control.test.ts:2386`: "the crashed session directory holding a staged file must be gone", `true !== false`, `operator: 'strictEqual'`.
- `RESTORE_BUILD_EXIT=0`, `RESTORED=yes`. `vice-broker.mts` and `resources/vice-broker.mjs` are byte-identical to HEAD afterwards.

## Own-sessions proof, re-verified against the tree by function name

| Link | Location |
|------|----------|
| Directory-creating site 1: `stageFileSlot()` | `broker-transfer.mts:639`. It creates the directory at :645-646 with `ensureBrokerDir(join(brokerStagingDir(), grantId))` |
| Directory-creating site 2: `receivePayloadToFile()` | `broker-transfer.mts:426`, with `mkdirSync(dirname(destPath), { recursive: true })` at :451. Its only caller is `handleFileTransfer()` at `vice-broker.mts:1254`, passing `destPath: entry.path`. `entry` comes from `resolveStagedFile()` at `broker-transfer.mts:685`, a lookup in `handleIndex` (:591). Only `stageFileSlot()` fills `handleIndex`, at :668 |
| `handleStageFile()` | `vice-broker.mts:1090`. It calls `stageFileSlot()` at :1094 and is wired as `onStageFile` at :2385 |
| Token gate | `broker-control.mts:1493-1497` (the "missing or invalid control token" refusal is at :1494) |
| `transfer` arm (ahead of the gate; reaches only existing handles) | `broker-control.mts:1433` |
| `acquire` arm | `broker-control.mts:1518` |
| `stage_file` arm | `broker-control.mts:1730` |
| `newControlToken()` | `broker-control.mts:648`, minted in `run()` at `vice-broker.mts:2139` |
| New sweep call | `vice-broker.mts:2555` |
| First `writeBrokerRecordFile(args.stateDir, record)` | `vice-broker.mts:2598` |

**No third directory-creating site.** `brokerStagingDir()` (`broker-home.mts:167`) has exactly three production users: `stageFileSlot()`'s create (:645), the session-teardown removal (`broker-transfer.mts:729`), and the new sweep call. The literal `"staging"` appears in production only inside `brokerStagingDir()` (`broker-home.mts:168`). No route to a staged handle bypasses the token gate. The proof holds.

## Spawn-site census (Task 1)

These are the automated-suite files, meaning every `*.test.*` file that is not a `MANUAL_ONLY_TESTS` member of `test-gate.mjs`:

| Spawn site | Suite | VICE_BROKER_HOME set to a temporary directory? |
|------------|-------|------------------------------------------------|
| `broker-control.test.ts:2122` (liveness round trip) | automated | Yes, `VICE_BROKER_HOME: stateDir` (fixed by this plan) |
| `broker-control.test.ts:2157` (`startRealBroker()`, used by both `singleton:` tests and all three G-64-6 tests) | automated | Yes. It defaults to `stateDir`, placed before the caller's `env` spread (fixed by this plan) |
| `broker-kill.test.ts:563` (`startBroker()`) | automated | Yes, already confined (`VICE_BROKER_HOME: stateDir`) |

The other automated files that name `resources/vice-broker.mjs` only `import()` it in-process. They include broker-relay, broker-relay-text, broker-state, stock-connect, stock-machine, transfer-disjoint-roots, vice-broker-acquire, vice-broker-staging and vice-broker-supervision. `run()` sits behind the `process.argv[1]` main guard at `vice-broker.mts:2678`, so an import never reaches the sweep. The files that mention it as a string or fixture spawn no broker: install-resources, build-atomic, service-no-invoke and text-connect.

Manual-only residual rows (`MANUAL_ONLY_TESTS` members, not changed here):

| Spawn site | VICE_BROKER_HOME confined? |
|------------|---------------------------|
| `stock-live-relay.test.ts:221` | **No.** It sweeps the machine-level staging root when opted in (named residual) |
| `stock-a4-checkpoint-flood.test.ts:228` | **No.** Same (named residual) |
| `broker-e2e.test.ts:126` and `:145` (`startBroker()` and `startBrokerWithArgv()` through `buildBrokerEnv()`) | **No, by default.** Only individual cases pass one (`:546`, `:1145`). This is a third unconfined manual-only spawner the plan did not name, found by this census |
| `vice-broker-launch.test.ts:149` | Partially. Several pre-existing cases spawn with no `VICE_BROKER_HOME`, as already recorded in `deferred-items.md` |
| `stock-live-broker-monitor.test.ts:274`, `stock-broker-live.test.ts:268`, `text-monitor-live.test.ts:212` | Yes (`VICE_BROKER_HOME: scratchDir`) |

**Recommended todo (not created here):** confine the unconfined manual-only broker spawners. That means `stock-live-relay.test.ts`, `stock-a4-checkpoint-flood.test.ts` and `broker-e2e.test.ts`'s default `buildBrokerEnv()`. With the sweep moved, a losing broker no longer removes anything, but any of them that WINS its own ephemeral-port bind while sharing the machine-level home still sweeps it (the route (a) residual).

## Decisions Made

- Route (a) was implemented as planned. Route (b) was declined for the reasons in the plan's `<assumption_delta_decision>`.
- In Task 2's staged diff, the gap id `(G-64-6)` was removed from two production comments in `broker-kill.mts` and replaced with prose, as the plan and CLAUDE.md's comment rule require. The test files keep `G-64-6` in test names and in references to those names, as the plan specifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Contract-text wording in the first executor's staged Task 2 diff**
- **Found during:** Task 2 review (continuation)
- **Issue:** The staged `broker-kill.mts` comments carried the gap id `(G-64-6)` twice, which the plan's comment rules forbid in source. The banner still opened "beside reapOrphanedInstances() above", and the plan's artifact line says the banner must stop placing the staging sweep there. The JSDoc forbade a call "from the unconditional pre-bind reap block above", but that block lives in `vice-broker.mts`, not in this file.
- **Fix:** Both gap ids became prose. The banner now reads "defined in this module after reapOrphanedInstances()". The prohibition names "vice-broker.mts's unconditional pre-bind reap block".
- **Files modified:** `src/mcp/vice/broker-kill.mts`, `src/mcp/vice/resources/broker-kill.mjs` (rebuilt)
- **Verification:** The Task 2 grep block, resources-sync, and the four targeted suites all passed (184/184).
- **Committed in:** `4516584a`

**2. [TDD] Missing RED commit for the tdd="true" tracer task.** This is disclosed under TDD Gate Compliance above. It could not be fixed without rewriting history, which was not done.

---

**Total deviations:** 1 auto-fixed (Rule 1), 1 disclosed TDD-gate violation.
**Impact on plan:** None on behaviour. Both are text or process corrections. No scope creep.

## Issues Encountered

- **The first `npm run test:automated` run exited 1, on an out-of-scope race, and hung for over 10 minutes.** The failing test was `vice-broker-acquire.test.ts:241` (BACK-02 cold acquire), on "the recorded XDG_CONFIG_HOME must be a non-empty string". `waitForFile()` (:201) returns once the recorder's file exists, before its content is written. The recorder child's `/proc/<pid>/environ` held the correct fixture-home value, so the read was early, not wrong. Because the assertion threw before the test's own kill, the recorder stub kept the test file alive. This executor killed that stub by hand (a test-spawned `recorder.mjs`, not a broker or an emulator), and the gate then finished. The file passed 47/47 when run alone right afterwards. A gate re-run exited 0. The file is outside `files_modified`, and 64-16's change is unreachable from an in-process `handleAcquire()` test, so the race was not fixed here. It is recorded in `deferred-items.md`.
- **Suite readings.** They are compared as failing sets, and the set was empty at every point:
  - The first executor's baseline, before any edit: `test:automated` 4274/4265/0/9, exit 0.
  - After Task 1: `test:automated` 4277/4268/0/9 and full glob 4452/4368/0/84.
  - This continuation, after Task 2: `test:automated` 4277/4268/0/9, exit 0 on the re-run, and full glob 4452/4368/0/84, exit 0, `not_ok=0`.
  - The +3 is the three G-64-6 tests.
- **Another session committed on the same branch mid-plan** (`41fe297f`, `553bc029`). In doing so it unstaged the first executor's staged `resources/broker-kill.mjs` without changing its content. The working tree was verified intact against HEAD and resources-sync, and the three Task 2 paths were re-staged by explicit path.

## Known residuals (unchanged by this plan)

- CR-02 of the round-three review: `receivePayloadToFile()`'s unguarded `mkdirSync()`, already `.planning/WINDOWS.md` entry 77 (open). It is cited, not re-ledgered.
- In the same-port double-launch race, a losing second broker still runs `reapOrphanedInstances()` before its bind (`vice-broker.mts:2190-2204`, accepted). It no longer deletes staging, but it is not harmless.
- Route (a)'s scope limit (T-64-G6-04): a broker deliberately bound to a different control port or host while sharing one `VICE_BROKER_HOME` still sweeps the shared staging root.
- 64-UAT.md's G-64-3 and G-64-4 entries still read `status: failed`, and plan 64-14's queued owner in-session human check is still pending.

## Threat model outcome

T-64-G6-01, T-64-G6-02 and T-64-G6-03 are mitigated as planned (D1, D2 plus the own-sessions proof, and D4). T-64-G6-04 through T-64-G6-06 and T-64-G6-SC are accepted as planned. No package was installed. No new security-relevant surface was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

All 16 of 16 Phase 64 plans now have a SUMMARY. G-64-6 is ready for phase re-verification. `64-VERIFICATION.md` truth #5 (XFER-07) should be re-scored against the tests and proof above. The Phase 64 ROADMAP checkbox stays open until that verification passes.

## Self-Check: PASSED

- All six modified source and resource files and both evidence records exist on disk.
- Commits `7af0dcdd` and `4516584a` exist in `git log --all`.
- All Task 1 and Task 2 acceptance criteria were re-run by this continuation and pass. The plan-level `<verification>` bullets are covered by D1-D6 above.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-24*
