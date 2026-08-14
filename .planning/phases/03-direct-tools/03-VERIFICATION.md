---
phase: 03-direct-tools
verified: 2026-08-14T18:22:30Z
status: gaps_found
score: 8/9 must-haves verified (1 partial, 2 systemic blockers carried from broker layer)
overrides_applied: 0
gaps:
  - truth: "D-13: a stock instance is launched with -remotemonitor alongside -binarymonitor on a second, broker-allocated port, and the instance record carries that port (must hold for the life of the instance, not just at cold launch)"
    status: failed
    reason: >
      Verified independently against source (not just cited from 03-REVIEW.md): superviseDepsFor()
      (.claude/mcp/vice/vice-broker.mts:308-315) — the ONLY deps object built by the two real
      crash-supervision call sites (handleExit -> launchSupervised()) — never sets `backend` or
      `binmonHost`. spawnAndRecordInstance() (broker-launch.mts:244) resolves
      `const backend = deps.backend ?? "fork"`, so any crash-respawn or vice_recycle-triggered
      relaunch of a stock instance silently launches with FORK argv (`-mcpserver ...`) instead of
      stock's `-binarymonitor`. Stock VICE does not understand `-mcpserver`, so the respawned
      process never opens a binary-monitor listener again -- the entire stock tool surface goes
      dark for that instance, with no diagnostic (the InstanceRecord still looks like a normal pool
      member to countReady/countTotal). This is CR-01 in 03-REVIEW.md; independently reproduced
      here by reading vice-broker.mts:308-315 and broker-launch.mts:244/952-967 directly.
    artifacts:
      - path: ".claude/mcp/vice/vice-broker.mts"
        issue: "superviseDepsFor() (lines 308-315) omits backend/binmonHost from the SuperviseChildDeps it builds for the crash-supervision exit handler"
      - path: ".claude/mcp/vice/broker-launch.mts"
        issue: "spawnAndRecordInstance() (line 244) silently defaults an unset backend to \"fork\"; no test builds SuperviseChildDeps through the real superviseDepsFor() to catch this"
    missing:
      - "Thread the already-resolved backend (and binmonHost) into superviseDepsFor(), exactly as handleAcquire()/maintainWarmFloorForRealBroker() already do for their own direct launches"
      - "A test that installs withCrashSupervision through the REAL superviseDepsFor() (not a hand-built deps object) and asserts the respawned argv still contains -binarymonitor when backend: \"stock\""
  - truth: "D-13: the second (-remotemonitor) port stays allocated to the instance for its lifetime and never permanently blocks the port band"
    status: failed
    reason: >
      Verified independently: SuperviseChildDeps (broker-launch.mts:952-987) has no
      remoteMonitorPort/allocateRemoteMonitorPort field, and launchSupervised() calls the
      lower-level tryLaunchOne() (which has no concept of a second port), not
      acquirePortAndLaunch() (which does). So (1) any respawned/recycled stock instance loses its
      -remotemonitor port entirely -- the feature silently stops applying the moment an instance is
      replaced -- and (2) the OLD remoteMonitorPort stays in state.blockedPorts forever: grepping
      broker-launch.mts and broker-state.mts for blockedPorts shows only `.add()` call sites
      (broker-launch.mts:405, broker-state.mts:321) and zero `.delete()` call sites anywhere. Every
      crash-respawn or recycle of a stock instance permanently consumes one more port from the
      fixed PORT_SCAN_CEILING (100) window even though the actual port is free again. This is CR-02
      in 03-REVIEW.md, independently confirmed by grep against the current source.
    artifacts:
      - path: ".claude/mcp/vice/broker-launch.mts"
        issue: "SuperviseChildDeps has no remoteMonitorPort field; blockedPorts has add() call sites but no matching release/delete anywhere in this file or broker-state.mts"
    missing:
      - "Thread remoteMonitorPort/allocateRemoteMonitorPort through SuperviseChildDeps and launchSupervised(), or route respawn/recycle through acquirePortAndLaunch() instead of the bare tryLaunchOne()"
      - "Add a releasePort(state, port) call (or equivalent) at every InstanceRecord teardown site so a torn-down instance's remoteMonitorPort leaves blockedPorts"
  - truth: "DIRECT-06 / phase success criterion 4: a user can reset the machine, autostart a PRG or disk image, attach AND detach disks on the stock backend"
    status: partial
    reason: >
      Reset, autostart, and disk-attach (unit 8 only, via the D-14 AUTOSTART approximation) are
      implemented, wired, and tested (stock-machine.ts). Disk DETACH is deliberately absent --
      D-13 (03-CONTEXT.md) moved it to Phase 7 because there is no binary-monitor opcode for
      detach and Phase 7 owns the text-monitor client this needs. This is a locked, documented
      decision, not an oversight -- but it means the phase-level success criterion's literal text
      ("attach and detach disks") is only half true as of this phase, and REQUIREMENTS.md's
      DIRECT-06 text ("attach or detach disks") is not fully satisfied by Phase 3 alone.
    artifacts:
      - path: ".claude/mcp/vice/stock-machine.ts"
        issue: "No vice_disk_detach handler; grep-gated by the file's own header comment to confirm the absence is deliberate"
    missing:
      - "Nothing to add in Phase 3 -- this is intentionally deferred. Track completion of DIRECT-06 against Phase 7's delivery of the text-monitor detach route, and consider whether REQUIREMENTS.md's DIRECT-06 wording should be split into attach (Phase 3) and detach (Phase 7) sub-items so its checkbox state can be accurate before Phase 7 lands."
deferred:
  - truth: "vice_checkpoint_set_ignore_count exists on the stock backend"
    addressed_in: "Phase 8 (BACK-05)"
    evidence: "D-15 (03-CONTEXT.md): the tool is deliberately trimmed from the stock manifest because implementing it would require a carve-out in D-05's absolute no-unrequested-resume policy; BACK-05 (Phase 8) reports the absence via the capability-error path. Documented in docs/stock-vice-parity.md and in 03-13-PLAN's own must-haves."
  - truth: "Disk detach on the stock backend (the other half of DIRECT-06/success criterion 4)"
    addressed_in: "Phase 7"
    evidence: "03-CONTEXT.md D-13: \"Disk detach moves to Phase 7 via the text monitor... Roadmap change required: DIRECT-06's detach half moves from Phase 3 to Phase 7.\" Phase 3 ships only the -remotemonitor launch flag and port allocation, no text-monitor client."
---

# Phase 3: Direct Tools Verification Report

**Phase Goal:** Every tool with a 1:1 binary-monitor equivalent works on the stock backend
**Verified:** 2026-08-14T18:22:30Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can read/write memory and CPU registers on stock, reads side-effect-free by default, no unrequested pause/resume round trip | VERIFIED | `stock-memory.ts` (`handleMemoryRead`/`handleMemoryWrite`), `stock-registers.ts` (`handleRegistersGet`/`handleRegistersSet`). Read defaults `sideEffects = false` (`memGetBody({ sidefx: sideEffects, ... })`, `stock-memory.ts:200-215`); no `CommandType.Exit` anywhere in either file. Full unit-test coverage passes (481/481 phase-relevant tests, 927/927 full suite). |
| 2 | User can set/list/delete/toggle/condition checkpoints and watchpoints; conditions emitted through a typed builder that parenthesises every comparison, emits `$hex`, uses `RL`/`CY` | VERIFIED | `stock-condition.ts` (typed AST + `emitCondition()`), consumed exclusively by `stock-checkpoints.ts`. Golden-emitter and refusal tests present and passing (`stock-condition.test.ts`). D-10 fail-closed cleanup and D-11 rate-limit/auto-disable both present in `stock-checkpoints.ts` (`autoDisabled` map, `conditionRegistry`, `STOP_FALSE_HAZARD_TEXT` gate at lines 401-405/669-673). Minor bug found: `stop` argument coerced with `Boolean()` not a strict type check (WR-01, still present at lines 401 and 669) — safer-direction bug (defaults to the safe `stop:true`), classified Warning not Blocker. |
| 3 | User can pause/resume on demand, step, execute-until-return; pause/resume idempotent (agent retry = no wire traffic) | VERIFIED | `stock-execution.ts`: `handleExecutionPause`/`handleExecutionRun` short-circuit on `stateBefore === "stopped"`/`"running"` respectively, sending nothing (D-08). `handleExecutionRun` is the only call site in the file sending `CommandType.Exit`. `handleExecutionStep`/`handleExecutionUntilReturn` refuse while `runState === "unknown"` (D-07). All encoder/gating/short-circuit tests pass. |
| 4 | User can reset, autostart PRG/disk image, attach AND detach disks, type text, drive joystick, save/restore snapshots, enumerate banks and registers | PARTIAL | Reset/autostart/attach (`stock-machine.ts`), snapshots (`stock-machine.ts`), keyboard/joystick (`stock-input.ts`, `stock-petscii.ts`), banks (`stock-memory.ts`), registers enumeration (`stock-registers.ts`) are all implemented, wired, and tested. **Disk detach is absent by design** (D-13, deferred to Phase 7 — see gaps/deferred below). `vice_joystick_tap` is deliberately absent (documented rationale: a tap needs an unrequested resume, forbidden by D-05, plus timing infrastructure that doesn't exist until Phase 7); `vice_joystick_set` covers "drive the joystick." |

**Score:** 3/4 success criteria fully verified, 1/4 partially verified (by locked, documented design decision, not an execution gap)

### Systemic Finding Carried From Code Review (affects the durability of ALL four criteria)

Two independently-reproduced Critical defects in the broker's crash-supervision path mean that
**any crash or `vice_recycle` of a running stock instance silently reverts it to the fork's launch
argv**, after which the stock binary monitor never listens again on that instance — every DIRECT
tool goes dark with no diagnostic. This directly contradicts this project's own stated core value
("...and keep working when the emulator misbehaves") and D-13's own must-have that "the instance
record carries [the second port]" — verified false the moment an instance is replaced. Details and
independent source confirmation are in the Gaps section (mapped to DIRECT-06, since D-13 is that
requirement's broker-side half) and in `03-REVIEW.md` (CR-01, CR-02). I independently reproduced
both directly from `vice-broker.mts` and `broker-launch.mts` rather than trusting the review's
narrative. These were **not** fixed after the review (no commits touch either file after the
review's timestamp; the working tree matches the review's findings exactly).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `stock-runstate.ts` | D-06/D-07 runState projection | VERIFIED | `attachRunStateTracker`, `runStateFor` exported, tested |
| `stock-address.ts` | D-04 one address parser | VERIFIED | decimal/`$hex`/`0x` forms, symbolic refusal path present, tested |
| `stock-handler.ts` | `stockAnswer()` seam | VERIFIED | every handler in every family module funnels through it |
| `stock-protocol.ts` | request-body encoders for every Phase 3 opcode | VERIFIED | `memGetBody`, `memSetBody`, `checkpointSetBody`, `conditionSetBody`, `registersSetBody`, `advanceInstructionsBody`, `keyboardFeedBody`, `joyportSetBody`, `resetBody`, `autostartBody`, `dumpBody`, `undumpBody` all present, all with matching round-trip tests |
| `stock-condition.ts` | D-09 typed AST + emitter | VERIFIED | `emitCondition`, `parseConditionString`, `conditionFromJson` exported; golden + refusal tests pass |
| `stock-memory.ts` | memory read/write/banks | VERIFIED | 324 lines, real logic (not a stub), side-effect-free default, bank resolution via live enumeration |
| `stock-registers.ts` | register get/set/available | VERIFIED | catalog resolved from `REGISTERS_AVAILABLE`, never hardcoded |
| `stock-checkpoints.ts` | checkpoint/watchpoint handlers + D-10/D-11 guards | VERIFIED | condition registry, fail-closed cleanup, rate-limit/auto-disable all present and exercised by tests |
| `stock-execution.ts` | pause/run/step/until-return | VERIFIED | D-08 short-circuit, D-07 gating, D-05 single-EXIT-site all confirmed by direct reading |
| `stock-machine.ts` | reset/autostart/attach/snapshots | VERIFIED (attach/detach split noted above) | 358 lines; disk detach absent by design (D-13) |
| `stock-input.ts` / `stock-petscii.ts` | keyboard/joystick, ASCII→PETSCII table | VERIFIED | `vice_joystick_tap` deliberately absent, documented |
| `stock-dispatch.ts` | `STOCK_DISPATCH_TABLE` with all 25 entries | VERIFIED | exactly 25 entries, one dispatch table, no fall-through to `forwardToVice()` |
| `stock-schema-check.ts` | hand-rolled outputSchema checker | VERIFIED | `checkAgainstSchema` exported, exercised by 40+ tests |
| `tools-manifest.stock.json` | 25-tool stock surface, every entry with `inputSchema`+`outputSchema` | VERIFIED | Programmatically confirmed: 25 tools, every entry declares `outputSchema.properties.runState` as a required string with enum exactly `["running","stopped","unknown"]` |
| `tools-manifest.json` (fork) | `vice_snapshot_list` removed, count = 62, description updated | VERIFIED | Programmatically confirmed: 62 tools, `vice_snapshot_list` absent, `vice_snapshot_load`'s description no longer references it |
| `broker-launch.mts` / `vice-broker.mts` | D-13 second-port launch flag, cold-launch correctness | VERIFIED for cold/warm launch, **FAILED for crash-respawn/recycle** | See Systemic Finding above and Gaps below |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `stock-dispatch.ts` | all 12 family modules | direct imports + `STOCK_DISPATCH_TABLE` entries | WIRED | 25/25 entries resolve to real handler imports, confirmed by `node --test` passing and by direct grep of the dispatch table |
| `tools-manifest.stock.json` | `stock-dispatch.ts` | name-for-name correspondence | WIRED | Both directions confirmed programmatically: manifest's 25 names == dispatch table's 25 keys |
| `stock-condition.ts` | `stock-checkpoints.ts` | `emitCondition()` is the only condition-text producer | WIRED | confirmed by reading `stock-checkpoints.ts`'s condition-setting code path |
| `stock-machine.ts` / `stock-memory.ts` (path-carrying handlers) | `hostpath.ts` | `stock-paths.ts`'s `withEmulatorSidePath()` wrapper | WIRED | confirmed — no direct `hostPath()`/`hostPathCandidates()` calls in `stock-machine.ts` |
| `broker-launch.mts` (cold acquire / warm floor) | `-remotemonitor` argv + second port | `acquirePortAndLaunch()` → `allocateRemoteMonitorPort` | WIRED (cold path only) | confirmed by direct reading |
| `broker-launch.mts` (crash-respawn / recycle) | `-remotemonitor` argv + second port + correct backend argv | `launchSupervised()` → `tryLaunchOne()` | **NOT WIRED** | `superviseDepsFor()` never carries `backend`/`binmonHost`/`remoteMonitorPort`; confirmed by direct reading of `vice-broker.mts:308-315` and `broker-launch.mts:952-987` |

### Behavioral Spot-Checks / Probes

No real stock VICE instance is available in this environment or milestone (per project MEMORY.md
and CLAUDE.md — "no real stock VICE available" — live validation deferred). All checks in this
report are static: source reading, unit test execution, and manifest/dispatch cross-referencing.
No live-emulator behavioral spot-check or probe script was runnable. This is consistent with the
whole milestone's spec-driven-only status and is not itself a phase-3-specific gap.

- `npm run test:automated` (`.claude/mcp/vice`): **927 pass / 0 fail / 5 todo (932 total)** — matches the orchestrator-provided baseline exactly, re-run independently in this verification session.
- `npm run typecheck`: clean, no errors.
- Targeted phase-3 test files (`stock-dispatch.test.ts`, `stock-schema-check.test.ts`, and all 13 family/protocol/condition/address/runstate/handler/paths test files, plus `fork-manifest-surface.test.ts`): **481/481 pass.**

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| DIRECT-01 | 03-01, 03-02, 03-06 | Read/write memory, side-effect-free reads | **SATISFIED** — recommend marking complete | `stock-memory.ts`, wired, tested |
| DIRECT-02 | 03-02, 03-07 | Read/write CPU registers | **SATISFIED** — recommend marking complete | `stock-registers.ts`, wired, tested |
| DIRECT-03 | 03-02, 03-03, 03-05, 03-08 | Set/list/delete/toggle/condition checkpoints & watchpoints | **SATISFIED except ignore counts (D-15, intentional, tracked in Phase 8/BACK-05)** — recommend marking complete with a footnote | `stock-checkpoints.ts`, `stock-condition.ts`, wired, tested |
| DIRECT-04 | 03-02, 03-09 | Step instructions, execute-until-return | **SATISFIED** — recommend marking complete | `stock-execution.ts`, wired, tested |
| DIRECT-05 | 03-01, 03-02, 03-09 | Pause/resume, idempotent | **SATISFIED** — recommend marking complete | `stock-execution.ts`, wired, tested |
| DIRECT-06 | 03-02, 03-04, 03-05, 03-10 | Reset, autostart, attach/detach disks | **PARTIAL — attach/reset/autostart satisfied; detach explicitly deferred to Phase 7 (D-13).** Do NOT mark complete as written; either split the requirement text or leave Pending until Phase 7. Additionally, the D-13 broker plumbing that IS in phase-3 scope (the second port surviving a respawn) is itself broken — see Gaps. | `stock-machine.ts` (attach/reset/autostart); no detach handler anywhere (deliberate); CR-01/CR-02 in `03-REVIEW.md`, independently reconfirmed |
| DIRECT-07 | 03-02, 03-05, 03-11 | Type text, drive joystick | **SATISFIED** (`vice_joystick_tap` deliberately omitted, documented rationale; `vice_joystick_set` covers the requirement) — recommend marking complete | `stock-input.ts`, `stock-petscii.ts`, wired, tested |
| DIRECT-08 | 03-02, 03-05, 03-10 | Save/restore snapshots | **SATISFIED** — recommend marking complete | `stock-machine.ts` (`handleSnapshotSave`/`handleSnapshotLoad`), wired, tested |
| DIRECT-09 | 03-02, 03-06, 03-07 | Enumerate memory banks and registers | **SATISFIED** — recommend marking complete | `stock-memory.ts` (`handleMemoryBanks`), `stock-registers.ts` (`handleRegistersAvailable`), wired, tested |

No orphaned requirements: all nine DIRECT-0x IDs appear in at least one of the 13 plans' `requirements` frontmatter fields, and REQUIREMENTS.md's "Phase 3" mapping (lines 171-179) lists exactly these nine and no others.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `stock-checkpoints.ts` | 401, 669 | `Boolean(args.stop)` instead of strict `typeof` check (WR-01) | Warning | `stop: "false"` (a plausible LLM-formatting mistake) silently becomes `stop: true` — the safe direction, not a safety bypass, but a real silent-override bug |
| `stock-execution.ts` | 266, 308 | `capture.finish()` only called via `??` short-circuit, dormant listener-leak risk if a future parser change adds `programCounter` to these response shapes (WR-02) | Warning | Currently harmless (finish() always runs today); latent for a future change |
| `stock-checkpoints.ts` | 129, 256 | `conditionRegistry`/`traceGuards` never evicted for a target that has gone away (WR-03) | Warning | Slow, bounded-scope memory growth over a long-running broker's life; small compared to the port leak below |
| `vice-broker.mts` | 308-315 | `superviseDepsFor()` omits `backend`/`binmonHost` (CR-01) | **Blocker** | Crash-respawn/recycle of a stock instance silently launches with fork argv |
| `broker-launch.mts` | 952-987, 1156-1215 | `SuperviseChildDeps`/`launchSupervised()` has no `remoteMonitorPort` field; `blockedPorts` has `.add()` but no `.delete()` anywhere (CR-02) | **Blocker** | Respawned stock instances permanently lose `-remotemonitor`; the old port is leaked forever, eventually exhausting the port band under routine crash/recycle churn |
| `stock-protocol.ts` | 573-601 | `checkpointSetBody()` doesn't validate `end >= start` unlike its siblings (IN-01) | Info | Not exploitable today (both callers validate first); an inconsistent encoder contract |

No `TBD`/`FIXME`/`XXX` markers found in any phase-3-modified file. No `TODO`/`HACK`/`PLACEHOLDER` markers found. The "not implemented" string hits found by grep are legitimate user-facing error text (`ErrorCode.InvalidType` mapping, and stock-dispatch's fork-only-tool refusal message), not stub markers.

### Human Verification Required

None of the following are gaps in the phase-3 sense — they are the milestone-wide, already-acknowledged
absence of a real stock VICE instance (documented in project MEMORY.md: "No real stock VICE
available... live validation is deferred to a later session"). They are listed here for completeness,
not as new findings:

1. **Wire-protocol assumptions ([ASSUMED] items A1-A5 in RESEARCH.md/03-05-PLAN.md)** — e.g. `stepOver`'s JSR-skip semantics, `JOYPORT_SET`'s bit layout, `-remotemonitoraddress`'s exact spelling, `AUTOSTART`'s `fileIndex`+`runAfter` behavior.
   **Expected:** each encoder/handler behaves exactly as coded against a real stock VICE ≥ 3.10 binary monitor.
   **Why human:** no real stock VICE binary is reachable in this environment; already filed as a pending todo (`2026-08-14-probe-phase3-assumed-wire-details.md`) per 03-05-PLAN and 03-CONTEXT.md.

2. **CR-01/CR-02's actual runtime consequence** — does a real crash/recycle of a real stock instance actually revert to fork argv and hang, as the static analysis predicts?
   **Expected:** yes, per the code trace above.
   **Why human:** requires triggering an actual crash/recycle cycle against a live broker + real stock VICE, not reachable in this session.

## Gaps Summary

The tool-handler layer of Phase 3 (the twelve family modules, the dispatch table, the manifest, the
schema checker, the condition AST) is thoroughly and correctly implemented: every one of the 25
advertised stock tools has a real, non-stub handler, is wired end-to-end from manifest through
dispatch to a tested implementation, carries `runState` per D-06, and respects the D-05/D-07/D-08
halt-policy invariants exactly as designed. All 927 automated tests pass and typecheck is clean.
This is genuinely strong, careful work, confirmed by direct reading of the source rather than by
trusting the SUMMARY files.

However, two things prevent a clean `passed` verdict:

1. **Two independently-reproduced Critical defects in the broker's crash-supervision path**
   (carried forward from `03-REVIEW.md`, and reconfirmed here against the current source rather
   than merely cited) mean the D-13 half of DIRECT-06 — "the instance record carries \[the second
   port\]" — is false the moment a stock instance crashes or is recycled, and the ENTIRE stock
   backend goes silently dark on that instance (wrong launch argv) with no diagnostic. Given this
   project's explicit core value ("...and keep working when the emulator misbehaves"), this is a
   phase-goal-relevant blocker, not a cosmetic one — it undermines "works on the stock backend" for
   any session that experiences even one crash or recycle over its lifetime, which is the exact
   scenario crash supervision exists to handle routinely.

2. **DIRECT-06 / success criterion 4's "attach and detach disks" is only half delivered** — disk
   detach is absent by a locked, well-documented design decision (D-13), moved to Phase 7. This is
   not a defect, but the phase goal and REQUIREMENTS.md's literal text are not fully met by Phase 3
   alone, and should not be marked complete without acknowledging the split.

**Recommendation:** Do not block the milestone's overall progress on these — the fix for CR-01/CR-02
is narrow and well-specified in `03-REVIEW.md` (thread `backend`/`binmonHost`/`remoteMonitorPort`
through `superviseDepsFor()`/`launchSupervised()`, and add a `releasePort()` call at instance
teardown) — but they should be closed with a small follow-up plan before this phase is considered
fully done, given they sit in the direct blast radius of "works on the stock backend" for anything
beyond a single crash-free session.

---

_Verified: 2026-08-14T18:22:30Z_
_Verifier: Claude (gsd-verifier)_
