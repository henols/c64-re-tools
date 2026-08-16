---
phase: 03-direct-tools
verified: 2026-08-16T22:15:00Z
status: gaps_found
score: 8/9 must-haves verified (1 partial — deliberately deferred, not a defect)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9 must-haves verified (1 partial, 2 systemic blockers carried from broker layer)
  gaps_closed:
    - "CR-01: superviseDepsFor() now takes `backend`/`binmonHost` as required parameters (not an optional default) — crash-respawn/recycle of a stock instance no longer silently reverts to fork launch argv. Source-confirmed (vice-broker.mts:327) and live-confirmed (UAT test 11: kill -9 respawn + 3x recycle, zero 'mcpserver' occurrences in broker log)."
    - "CR-02: remoteMonitorPort is now threaded through SuperviseChildDeps/launchSupervised (broker-launch.mts:1156, 1223-1259) and released via deleteInstanceRecord()'s state.blockedPorts.delete() (broker-launch.mts:468-469) at every teardown. Live-confirmed (UAT test 11: 6 acquire→recycle→release churn cycles, zero port drift)."
    - "vice_registers_set blocker (DIRECT-02/DIRECT-09): stock-registers.ts's width check now compares bit counts (2**sizeBits-1) instead of a byte-count ladder. Live re-confirmed in this session directly (not just cited) against genuine unpatched /usr/bin/x64sc: A=42 round-trip, PC=0xC000, range refusal, and all seven flag-bit refusals (N/V/B/D/I/Z/C) naming the real FL register."
    - "npm test hang: the two open-before-try leak sites in vice-proxy.test.ts are fixed; independently re-run in this session (env -u CONTAINER_WORKSPACE_PATH -u HOST_WORKSPACE_PATH timeout 300 npm test) and it terminated on its own in ~122s with 1099/1083/0/11-skip/5-todo (no hang)."
    - "Structural test 'no agent-visible template literal begins with the vice-proxy: prefix': independently re-run in this session (node --test vice-proxy.test.ts) — passes."
    - "CI validation: independently confirmed via `gh run view 31972421757` — conclusion success, headSha f040d79, name CI."
  gaps_remaining:
    - "DIRECT-06 / success criterion 4: disk detach is still absent from the stock manifest and stock-machine.ts. Unchanged since the initial verification — this was never one of the four UAT gaps this run closed, and 03-CONTEXT.md (D-13) documents it as a locked, deliberate deferral (no binary-monitor opcode exists for detach; the text-monitor route belongs to Phase 7). ROADMAP.md's own success-criteria bullet 4 and REQUIREMENTS.md's DIRECT-06 text have NOT been updated to reflect this despite 03-CONTEXT.md's own note that a 'roadmap change [is] required' — Phase 7's roadmap section (as currently written) does not list DIRECT-06 or mention disk detach at all, so there is no formal later-phase owner to defer this gap to per Step 9b's conservative matching rule."
  regressions: []
gaps:
  - truth: "A user can reset the machine, autostart a PRG or disk image, attach and detach disks, type text, drive the joystick, save and restore snapshots, and enumerate available banks and registers on the stock backend (roadmap success criterion 4 / DIRECT-06)"
    status: partial
    reason: >
      Reset, autostart, disk attach (unit 8 only), snapshots, keyboard, joystick, and bank/register
      enumeration are all implemented, wired, tested, and (for reset/attach/keyboard/registers)
      live-verified against genuine stock VICE in this and prior UAT sessions. Disk DETACH has no
      handler anywhere in stock-machine.ts or tools-manifest.stock.json. This is confirmed
      deliberate — 03-CONTEXT.md's D-13 states there is no binary-monitor opcode for detach and
      routes it to Phase 7's text-monitor client — but the roadmap's own success-criteria wording
      ("attach and detach") and REQUIREMENTS.md's DIRECT-06 line ("attach or detach") have not been
      updated, and Phase 7's roadmap section does not list DIRECT-06 or mention disk detach, so
      there is currently no formal phase that owns closing this gap.
    artifacts:
      - path: ".claude/mcp/vice/stock-machine.ts"
        issue: "No handleDiskDetach/vice_disk_detach handler; grep confirms zero occurrences"
      - path: ".planning/ROADMAP.md"
        issue: "Line 185 (Phase 3 success criterion 4) still says 'attach and detach disks'; Phase 7's section (lines 303-317) does not list DIRECT-06 or mention disk detach, despite 03-CONTEXT.md's note that a roadmap change is required"
    missing:
      - "Either (a) accept this deviation via a VERIFICATION.md override, on the grounds that the phase goal itself is scoped to tools with a 1:1 binary-monitor equivalent and disk detach has none, or (b) update ROADMAP.md to move the detach half of DIRECT-06 and its success-criteria wording into Phase 7 (or a new phase) so REQUIREMENTS.md's DIRECT-06 line has a real, trackable owner"
deferred: []
human_verification:
  - test: "vice_autostart / vice_disk_attach / vice_snapshot_load against real .prg/.d64/.vsf fixtures on genuine stock VICE"
    expected: "Each round-trips correctly against a real file, matching the unit-test-covered logic"
    why_human: "UAT (test 8) exercised reset and snapshot save live but explicitly did not prepare fixtures for autostart/attach/snapshot-load; unit tests cover the logic but not a live emulator round-trip"
  - test: "vice_keyboard_petscii, vice_joystick_set against a running program"
    expected: "Raw PETSCII bytes and joystick bit patterns are observed to actually affect a running program"
    why_human: "UAT (test 9) exercised vice_keyboard_type live but had no running program to observe petscii/joystick effects against"
  - test: "Hot non-stopping checkpoint (stop:false) auto-disables after ~20 hits/second"
    expected: "The rate-limit/auto-disable guard (D-11) actually fires under sustained live hit pressure instead of stalling the emulator thread"
    why_human: "Requires sustained 20+/sec hits against a real running program; out of scope for the UAT session's probes (test 6)"
---

# Phase 3: Direct Tools Verification Report

**Phase Goal:** Every tool with a 1:1 binary-monitor equivalent works on the stock backend
**Verified:** 2026-08-16T22:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (03-14..03-18, closing the four gaps recorded in 03-UAT.md)

## Goal Achievement

This is a re-verification. The prior VERIFICATION.md (2026-08-14) found 3 gaps: two Critical
broker defects (CR-01, CR-02) and a partial DIRECT-06 (disk detach). Between that verification and
this one, CR-01/CR-02 were fixed (commits `83a8732`, `510e097`) and then a full UAT pass (12 live
tests against genuine, previously-undiscovered stock VICE at `/usr/bin/x64sc`) found FOUR NEW,
different gaps: a `vice_registers_set` bit/byte-width bug, an `npm test` hang, a stale structural
test, and no CI coverage. Plans 03-14 through 03-18 closed those four. This report verifies both:
(a) that the four UAT gaps are genuinely closed (not just claimed), and (b) that the two
originally-found broker defects have not regressed, and (c) the phase goal as a whole.

I did not trust any SUMMARY.md claim below without independent confirmation — every item marked
"independently confirmed" or "independently re-run" in this report was executed fresh in this
verification session, not read from a summary.

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can read/write memory and CPU registers on stock, reads side-effect-free by default, no unrequested pause/resume round trip | ✓ VERIFIED | `stock-memory.ts`/`stock-registers.ts`. Independently re-ran `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` in this session against the genuine unpatched stock binary (confirmed via `file`: stripped 4MB ELF, distinct build-id from the fork's 20MB debug build at `/usr/local/bin/x64sc`): `vice_registers_set({register:"A",value:42})` → `observedValue:42`; `PC→0xC000` echoed `49152`; out-of-range `256` refused naming `0..0xff`; all 7 flag-bit refusals fired naming real register `FL`. `sideEffects=false` default confirmed by direct code reading (`stock-memory.ts`, no `CommandType.Exit` in the file). |
| 2 | User can set/list/delete/toggle/condition checkpoints and watchpoints; conditions emitted through a typed builder that parenthesises every comparison, emits `$hex`, uses `RL`/`CY` | ✓ VERIFIED | `stock-condition.ts` (`emitCondition()`, `PSEUDO_NAMES = ["RL","CY"]`, header comment documents over-parenthesisation and `$hex` emission), consumed exclusively by `stock-checkpoints.ts`. `STOP_FALSE_HAZARD_TEXT` gate and `autoDisabled` map both present and unchanged. Live-verified in UAT test 6 (string condition `"RL == $64"` round-tripped as `"(RL == $64)"` against real stock VICE). |
| 3 | User can pause/resume on demand, step, execute-until-return; pause/resume idempotent (agent retry = no wire traffic) | ✓ VERIFIED | `stock-execution.ts`: `handleExecutionPause`/`handleExecutionRun` short-circuit on `stateBefore === "stopped"`/`"running"` (confirmed present at lines 167, 202). Live-verified in UAT test 7 (`pause` while already stopped → `{sent:false, alreadyStopped:true}`, zero wire traffic; `run` sent EXIT and runState flipped). |
| 4 | User can reset, autostart PRG/disk image, attach AND detach disks, type text, drive joystick, save/restore snapshots, enumerate banks and registers | ⚠️ PARTIAL | Reset/autostart/attach/snapshots/keyboard/joystick/banks/registers all implemented, wired, tested, and (reset, attach description, keyboard-type, registers) live-verified. **Disk detach confirmed absent** — `grep` of `stock-machine.ts` for `disk_detach`/`handleDiskDetach` returns zero matches; `tools-manifest.stock.json`'s 25 tools contain no `vice_disk_detach`. This is deliberate per 03-CONTEXT.md D-13 (no binary-monitor opcode exists for detach), unchanged since the prior verification, and NOT one of the four gaps this run was tasked with closing. See Gaps below. |

**Score:** 3/4 fully verified, 1/4 partial (deliberate, documented, out-of-scope-by-goal-wording deferral, not a fresh defect)

### The Two Prior Broker Blockers (CR-01, CR-02): Regression Check

Both were independently re-confirmed fixed by direct source reading, not by trusting the SUMMARY:

- **CR-01** — `superviseDepsFor()` (`vice-broker.mts:327`) now declares `backend: ViceBackend` as a
  required positional parameter (no `?? "fork"` fallback anywhere in the function), and both real
  call sites (`handleAcquire`'s crash-supervision closure at line 606, `maintainWarmFloorForRealBroker`
  at line 845) pass the same resolved `backend` the launch itself used. A `_superviseDepsFor` alias is
  exported specifically so a test can exercise the REAL builder rather than a hand-built stub — the
  exact blind spot that let CR-01 ship originally.
- **CR-02** — `remoteMonitorPort` is threaded through `SuperviseChildDeps`/`launchSupervised()`
  (`broker-launch.mts:1156`, `1223-1259`), and `deleteInstanceRecord()` (line 467-471) calls
  `state.blockedPorts.delete(record.remoteMonitorPort)` at every instance teardown — the previously
  add-only, never-delete `blockedPorts` Set now has both directions.
- **UAT test 11** (this run's own predecessor) live-drove both fixes end-to-end against a real,
  isolated second broker running genuine `/usr/bin/x64sc`: crash-respawn (`kill -9`) kept stock argv
  and the same `-remotemonitor` port; three consecutive `op:recycle` calls each relaunched with stock
  argv and the same second port; 6 full acquire→recycle→release churn cycles never drifted the
  allocated port upward (would have marched 6900→6902→6904... if the leak still existed; it stayed at
  6902/6903 throughout).

No regression found. These are no longer gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `stock-registers.ts` | register get/set/available, width check derived from bits not bytes | ✓ VERIFIED | `2 ** sizeBits - 1` (line ~277); live-tested against real 8-bit and 16-bit registers in this session |
| `vice-broker.mts` | `superviseDepsFor()` carries resolved backend into crash-supervision | ✓ VERIFIED | required param, no default; confirmed by reading + UAT live test 11 |
| `broker-launch.mts` | `remoteMonitorPort` survives respawn/recycle, released on teardown | ✓ VERIFIED | threaded through `launchSupervised`, `deleteInstanceRecord()` deletes from `blockedPorts` |
| `vice-proxy.test.ts` | leak-prevention safety net so a hang converts into a diagnostic | ⚠️ PARTIAL (functionally sufficient for the two named hang sites, incomplete as a general net) | `OPEN_SERVERS`/`OPEN_CHILDREN` registered only inside `startStandInServer()` (per 03-REVIEW.md WR-02) — the two ORIGINAL leak sites are genuinely fixed (independently re-ran full suite without container env vars in this session: 1099 tests, 0 fail, terminated in ~122s, no hang), but 3 of 4 HTTP-server factories and all control-plane `net.Server` listeners in the same file are not registered, so a *different* open-before-try bug in this file could still hang `npm test` today. Not a phase-goal blocker (no such bug currently exists), but a real gap in the safety net's stated scope. |
| `stock-machine.ts` | reset/autostart/attach/snapshots | ✓ VERIFIED (detach absent by design) | `grep` confirms no detach handler |
| `tools-manifest.stock.json` | 25-tool stock surface | ✓ VERIFIED | Independently counted in this session: exactly 25 tools, names cross-checked against `STOCK_DISPATCH_TABLE` |
| `stock-condition.ts` | typed AST + emitter, D-09 | ✓ VERIFIED | `RL`/`CY` pseudo-names, over-parenthesisation documented and implemented |
| `stock-checkpoints.ts` | D-10/D-11 guards | ✓ VERIFIED | `STOP_FALSE_HAZARD_TEXT`, `autoDisabled` map present |
| `stock-execution.ts` | pause/run idempotence, D-08 | ✓ VERIFIED | short-circuit at `stateBefore === "stopped"`/`"running"` confirmed by reading |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `vice-broker.mts` (crash-respawn) | stock launch argv | `superviseDepsFor()`'s required `backend` param | ✓ WIRED | confirmed by reading + live UAT test 11 |
| `broker-launch.mts` (respawn/recycle) | `-remotemonitor` port survival | `launchSupervised(..., record.remoteMonitorPort)` | ✓ WIRED | confirmed by reading + live UAT test 11 (zero port drift over 6 churn cycles) |
| `broker-launch.mts` (teardown) | port band not exhausted | `deleteInstanceRecord()` → `blockedPorts.delete()` | ✓ WIRED | confirmed by reading + live UAT test 11 |
| `stock-registers.ts` | width validation | `2 ** sizeBits - 1` derived from the wire's bit-count field | ✓ WIRED | confirmed live against two real widths (8-bit `A`, 16-bit `PC`) in this session |
| `tools-manifest.stock.json` (`vice_registers_set` description) | actual refusal behavior | description text vs. `handleRegistersSet`'s flag-bit refusal | ⚠️ PARTIAL — description still lies | See Anti-Patterns (WR-01): the shipped description still lists `N\|V\|B\|D\|I\|Z\|C` as valid register names, which `handleRegistersSet` always refuses. Not fixed in the gap-closure wave despite 03-16 live-proving the refusal. Not in `docs/stock-vice-parity.md` either (grepped, zero hits for "register" flag-bit divergence). This is a real, user-facing contract inconsistency but does not prevent success criterion 1 (ordinary register read/write) from working — flagged as a Warning, not a Blocker. |

### Behavioral Spot-Checks (independently executed this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `tsc --noEmit` clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Full suite terminates and passes | `env -u CONTAINER_WORKSPACE_PATH -u HOST_WORKSPACE_PATH timeout 300 npm test` | 1099 tests, 1083 pass, 0 fail, 11 skipped, 5 todo, ~122s, no hang | ✓ PASS (11 skipped here vs. the orchestrator's 2-skipped run — the 9-test delta is exactly WR-04's env-gate effect: I ran WITHOUT the CI env vars, so the 9 container-guard/path-translation tests skip rather than run. Confirms WR-04's finding is real, not theoretical — see Anti-Patterns.) |
| `vice_registers_set` against genuine stock VICE 3.9 | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` | 2/2 pass; A=42 round-trip, PC=0xC000, range refusal, all 7 flag refusals naming `FL` | ✓ PASS |
| Default-skip (no live binary opt-in) | `node --test stock-live.test.ts` | 2 skipped, exit 0, ~270ms | ✓ PASS |
| No orphaned `x64sc` after live test | `pgrep -af x64sc` | only the pre-existing, unrelated fork-backend broker process (pid 119885, `-mcpserver`) remained; no test-spawned process left over | ✓ PASS |
| Structural identity test (`vice-proxy:` prefix) | `node --test vice-proxy.test.ts` (grep for the specific subtest) | `ok 64 - structural: no agent-visible template literal begins with the vice-proxy: prefix` | ✓ PASS |
| CI run genuinely succeeded | `gh run view 31972421757 --json conclusion,headSha,status,name` | `{"conclusion":"success","headSha":"f040d79...","name":"CI","status":"completed"}` | ✓ PASS |
| No debt markers in the gap-closure diff's files | `grep -n "TBD\|FIXME\|XXX"` across `stock-registers.ts`, `vice-broker.mts`, `broker-launch.mts`, `stock-live.test.ts`, `vice-proxy.test.ts`, `test-gate.mjs` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| DIRECT-01 | 03-01, 03-02, 03-06 | Read/write memory, side-effect-free reads | ✓ SATISFIED | `stock-memory.ts`, live-verified |
| DIRECT-02 | 03-02, 03-07, 03-14, 03-16 | Read/write CPU registers | ✓ SATISFIED (blocker fixed) | `stock-registers.ts`, independently live-verified against genuine stock VICE 3.9 in this session |
| DIRECT-03 | 03-02, 03-03, 03-05, 03-08 | Checkpoints/watchpoints/conditions | ✓ SATISFIED (except ignore counts, D-15, intentional, tracked under BACK-05/Phase 8) | `stock-checkpoints.ts`, `stock-condition.ts` |
| DIRECT-04 | 03-02, 03-09 | Step, execute-until-return | ✓ SATISFIED | `stock-execution.ts` |
| DIRECT-05 | 03-01, 03-02, 03-09 | Pause/resume idempotent | ✓ SATISFIED | `stock-execution.ts`, live-verified in UAT test 7 |
| DIRECT-06 | 03-02, 03-04, 03-05, 03-10 | Reset/autostart/attach/detach | ⚠️ PARTIAL — attach/reset/autostart satisfied; detach absent by design, no formal future-phase owner in ROADMAP.md | See Gaps |
| DIRECT-07 | 03-02, 03-05, 03-11 | Type text, drive joystick | ✓ SATISFIED (`vice_joystick_tap` deliberately omitted, documented) | `stock-input.ts`, live-verified `vice_keyboard_type` in UAT test 9 |
| DIRECT-08 | 03-02, 03-05, 03-10 | Save/restore snapshots | ✓ SATISFIED | `stock-machine.ts`, live-verified `snapshot_save` in UAT test 8 |
| DIRECT-09 | 03-02, 03-06, 03-07, 03-14, 03-16 | Enumerate banks and registers | ✓ SATISFIED (blocker fixed) | `stock-memory.ts`, `stock-registers.ts`, live-verified banks (`cpu/ram/rom/io/cart`) and registers in this session |

No orphaned requirements: REQUIREMENTS.md's Phase 3 mapping lists exactly these nine IDs; all nine appear in at least one plan's `requirements` frontmatter. `BACK-02` also appears in 03-15/03-17/03-18's frontmatter but is a Phase-2-owned requirement already marked Complete in REQUIREMENTS.md — not orphaned, just cross-referenced because the gap-closure fixes touch the fork-regression contract broadly (test-suite integrity, CI validation).

### Anti-Patterns Found (from 03-REVIEW.md, independently re-checked against current source)

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tools-manifest.stock.json` | 156 | `vice_registers_set` description still lists `N\|V\|B\|D\|I\|Z\|C` as valid register names (WR-01) | Warning | Confirmed still present by direct read in this session. Stock always refuses these seven names (live-proven twice now). Misleads an agent into a call that can never succeed. Does not block success criterion 1 (ordinary registers work); not documented in `docs/stock-vice-parity.md` either. |
| `vice-proxy.test.ts` | 140-165, 984, 1630, 5326, 2121 | Leak-prevention registry covers 1 of 4 server factories, 0 of the control-plane `net.Server` listeners (WR-02) | Warning | The two sites that caused the ORIGINAL hang are fixed and independently confirmed fixed in this session; other latent open-before-try bugs in this file are not yet netted. |
| `test-gate.mjs` | 44-69 | Two false-green vectors: cwd-relative glob, string-concat direct-invocation guard (WR-03) | Warning | Does not trip on this machine/CI's invocation shape today; a portability change could silently make `npm run test:automated` report success having run 0 tests. |
| `vice-proxy.test.ts` / `broker-e2e.test.ts` / `vice-broker-launch.test.ts` | multiple | No assertion that the CI env gate (`CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH`) is open where 8 safety-relevant tests expect it (WR-04) | Warning | Independently reproduced the effect in this session: running the suite without those two vars dropped from an expected 2-skip run to 11-skip, silently. A `ci.yml` env-block edit would silently skip container-guard regression tests while CI stays green. |
| `stock-live.test.ts` | 152-209 | `before()` hook has a narrow child/scratch-dir leak window if construction throws after `spawn()` (WR-05) | Warning | Not triggered in either of this session's runs (clean pass, clean default-skip); latent only. |
| `stock-registers.ts` | 256 | `in` operator on `FLAG_BIT_POSITIONS` walks the prototype chain (IN-01) | Info | Not exploitable today; one lowercase key away from a wrong branch. |

No `TBD`/`FIXME`/`XXX` markers found in any file touched by this gap-closure wave (independently grepped in this session). No unresolved debt-marker gate trip.

### Human Verification Required

See the `human_verification` list in the frontmatter — these are pre-existing, previously-UAT-acknowledged coverage gaps (autostart/attach/snapshot-load fixture round-trips, keyboard-petscii/joystick against a running program, the trace-rate auto-disable guard under sustained hits), not new findings. They do not change the overall status determination since a genuine gap (DIRECT-06 disk detach) already applies, but they are recorded for completeness per the escalation-gate pattern.

## Gaps Summary

**What this run closed (verified, not just claimed):** The four UAT gaps — `vice_registers_set`'s
bit/byte width bug, the `npm test` infinite hang, the stale `vice-proxy:` identity structural test,
and the absence of any CI validation of the milestone — are all genuinely fixed. I independently
reproduced each fix in this session: live register writes against genuine unpatched stock VICE 3.9
(not the fork build shadowing it on `$PATH`), a full test-suite run that terminates in ~122s with
zero failures, a passing structural test, and a real `gh run view` confirming CI conclusion
`success` against sha `f040d79`. The two Critical broker defects (CR-01, CR-02) found in the FIRST
verification pass and fixed before UAT ran were re-confirmed not to have regressed, both by source
reading and by UAT's own live respawn/recycle/churn test.

**What remains open:** Disk detach (the second half of DIRECT-06 / roadmap success criterion 4) is
still absent from the stock backend. This is unchanged since the first verification, is documented
as a deliberate design decision in `03-CONTEXT.md` (no binary-monitor opcode exists for detach), and
was never one of the four gaps this gap-closure wave targeted. However: (1) the roadmap's own
success-criteria wording and REQUIREMENTS.md's DIRECT-06 line have not been updated to reflect the
deferral, and (2) Phase 7's roadmap section — the phase 03-CONTEXT.md names as disk detach's new
home — does not currently list DIRECT-06 or mention disk detach anywhere, so there is no formal
later-phase owner for this gap today. This is a paperwork gap as much as a functional one: the
phase's own goal text ("every tool with a 1:1 binary-monitor equivalent") arguably excludes disk
detach by definition (no such 1:1 equivalent exists), which is a reasonable basis for an override —
but that override has not been formally recorded.

**This looks intentional.** To accept this deviation, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "A user can reset the machine, autostart a PRG or disk image, attach and detach disks, type text, drive the joystick, save and restore snapshots, and enumerate available banks and registers on the stock backend"
    reason: "Disk detach has no 1:1 binary-monitor equivalent (confirmed: no opcode exists), so it falls outside this phase's own goal wording ('every tool with a 1:1 binary-monitor equivalent works on the stock backend'). Deferred to the text-monitor route per 03-CONTEXT.md D-13."
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

Alternatively, update `ROADMAP.md` to move the detach half of DIRECT-06 (and adjust success
criterion 4's wording) into a phase that actually lists it — none currently does.

Also worth a small follow-up (not blocking): WR-01 (stale manifest description for
`vice_registers_set`) is a one-line fix that plan 03-16 already proved is needed live; it was not
picked up in this gap-closure wave and should be closed before Phase 8's documentation work
(BACK-05) builds on top of it.

---

_Verified: 2026-08-16T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
