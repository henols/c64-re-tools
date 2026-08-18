---
phase: 07-cycle-timing-and-wedge-triage
verified: 2026-08-18T12:29:43Z
status: verified
score: 4/4 truths fully verified; the one residual human-verification item is closed with a real live transcript (quick task 260818-obc)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "Truth 1 (cycle stopwatch / no fabricated zero): CR-01 root cause fixed in 07-11 (probeCpuHistory()/resolveCapabilities() now classify StockFramingError/StockDesyncError/StockResponseMismatchError as a capability answer, never a fatal rethrow) and 07-12 (CPUHISTORY_GET per-entry wire layout re-derived from real VICE 3.10 fixtures, decodes correctly). Independently re-reproduced live in this verification pass against genuine /usr/bin/x64sc (3.9) and /usr/local/bin/x64sc (3.10) — the exact CR-01 failure string no longer occurs; stockConnect() resolves cpuHistory correctly on both."
    - "Truth 2 (vice_run_until cleanup honesty): WR-01 and WR-02 fixed in 07-14 -- the already_gone race branch now resolves `reached` from a live PC read (or reports `reachedUnknown`, never a fabricated `reached:false`), and every answer stamps `machineHalted`/`machineHaltedNote`. Verified directly in stock-run-until.ts source and 21/21 stock-run-until.test.ts."
    - "Truth 3 (vice_diagnose five/six-state distinction): WR-03 fixed in 07-15 (machinePaused now derived via deriveMachinePaused()/runStateFor(), never hand-passed, with machinePausedSource provenance label); WR-07 fixed in 07-16 (resolveAdvertisedToolDefinition() makes the manifest overwrite backend-aware -- confirmed 'stale_read_path' no longer appears anywhere in tools-manifest.stock.json, grep count 0); a sixth, non-verdict `diagnosis_unavailable` outcome (7 reason classes) now classifies every non-verdict session-acquisition failure, including a CR-01-class decode error, instead of falling through to an opaque error. checkpoint_trap, wedged (both capability routes), and restarted are now live-proven (07-17) -- independently re-run by this verification against both real binaries with identical results."
    - "Truth 4 (SKILL.md opening move / no false claims): docs/stock-vice-parity.md's false 'live-confirmed... resolves to available' claim (lines 349-352 in the old tree) is corrected in 07-18 with the full honest history and 07-13's real measured figures (511,061 / 530,713 cycles) -- independently reproduced by this verification (530,713 exactly reappeared on a fresh live run). vice-wedge-triage/SKILL.md's Provenance table now grades confidence per-claim (HIGH for the five verdicts and run_until mechanism, MEDIUM for the honesty fields and the broker-mediated monitor_held_elsewhere/restarted paths) instead of making a blanket VICE-3.10 'live-confirmed' claim."
    - "RESOLVED 2026-08-18, quick task 260818-obc: the broker-mediated monitor_held_elsewhere verdict AND the broker-supervised (not test-performed) restarted respawn -- this report's own previously-named residual gap and human-verification item -- are now both live-proven in one real run (stock-live-broker-monitor.test.ts) against a genuine host broker daemon (resources/vice-broker.mjs) and genuine stock VICE on both /usr/bin/x64sc (3.9) and /usr/local/bin/x64sc (3.10). A real crash respawn (externally SIGKILLed, relaunched by the broker's OWN crash supervision, never the test) produced two real broker grants resolving to the SAME instance; the session whose real claimMonitor() arrived second was refused monitor_held_elsewhere, naming the other grant's real id, settling in 1ms against the 10000ms bound on both binaries. The same run's own vice_diagnose call, made against the broker-supervised respawn before the second grant ever claimed anything, independently answered restarted with baselineEpoch:1/currentEpoch:2 at zero-to-minimal emulator cost on both binaries -- closing TIME-04's second named residual in the same transcript."
  gaps_remaining:
    - "PREVIOUSLY LISTED HERE, NOW RESOLVED (see gaps_closed above, quick task 260818-obc): The broker-mediated `monitor_held_elsewhere` verdict (a real second `claimMonitor()` refusal surfaced through the host broker's own control plane) is unit-proven only (stock-diagnose.test.ts, injecting a real MonitorOwnershipError at the exact ensureStockSession() call boundary handleDiagnoseStock() catches). The related but distinct socket-level contention case (a second raw connect() against an already-claimed monitor, with no broker involved) IS live-proven, independently re-run by this verification: it settles in ~1502ms against a 1500ms bound, answering `diagnosis_unavailable (monitor_acquisition_timeout)` -- not a hang, but also not literally the `monitor_held_elsewhere` verdict. This is 07-18's own named residual gap (07-VALIDATION.md's last open Manual-Only row, nyquist_compliant left false for exactly this reason), reported here as a human-verification item rather than silently passed."
  regressions: []
human_verification: []
# RESOLVED 2026-08-18, quick task 260818-obc (history preserved below, not deleted): this report
# previously carried exactly one human_verification item here --
#   test: "Stand up the host broker control plane with two real, independently-acquired stock
#     sessions against the same live instance (not the dispatch-level harness
#     stock-live.test.ts/stock-live-triage.test.ts use), and call vice_diagnose from the second
#     session while the first still holds the monitor via a real claimMonitor()/MonitorOwnershipError
#     round trip."
#   expected: 'vice_diagnose answers verdict:"monitor_held_elsewhere" (not diagnosis_unavailable)
#     within its configured session-acquisition bound, using the real broker-refused grant's
#     holderGrantId/holderClaimedAt/port evidence fields.'
#   why_human: "Requires standing up the actual host broker daemon with two concurrent, genuinely
#     broker-managed leases -- out of scope for the per-test emulator harnesses this phase's live
#     tests use (07-13 Task 3's own recorded scope boundary), and REQUIREMENTS.md/07-VALIDATION.md
#     both already name this as the one item keeping nyquist_compliant false. This verification
#     independently confirmed the closely-related but distinct socket-level contention bound live;
#     only the broker-mediated verdict path itself remains unexercised end-to-end."
# -- exactly what quick task 260818-obc's own harness (stock-live-broker-monitor.test.ts) stood up
# and exercised: a real host broker daemon, two real independently-acquired sessions against the
# same crash-respawned instance, and a real claimMonitor() refusal. See the gaps_closed entry above
# for the measured result.
---

# Phase 7: Cycle Timing and Wedge Triage Verification Report

**Phase Goal:** "How long did that take" and "is the emulator still advancing" work on the stock backend
**Verified:** 2026-08-18T12:29:43Z (original pass); residual item closed 2026-08-18 by quick task 260818-obc
**Status:** verified
**Re-verification:** Yes — after gap closure (8 gap-closure plans, 07-11 through 07-18, plus quick task 260818-obc closing the one remaining human-verification item)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can measure elapsed cycles across an operation on the stock backend, and a bracket that cannot be measured says so rather than returning zero | ✓ VERIFIED | Independently re-reproduced live in this pass (not trusted from SUMMARY): `node --test stock-live.test.ts` against real `/usr/bin/x64sc` (3.9) and `/usr/local/bin/x64sc` (3.10) -- 14/14 pass, including the exact former CR-01 failure site now resolving `cpuHistory:"available"` on 3.10 and `"absent"` on 3.9, and a real ~500ms Route A bracket measuring an exact `530713` cycles through the real `dispatchStock()` seam. Route B's wraparound refusal (`measurable:false`, never `0`) is unit- and live-confirmed (07-VALIDATION.md, unchanged from the original pass). |
| 2 | A user can run to an exact address on the stock backend, with the temporary checkpoint cleaned up whether the run succeeded, timed out, or the machine restarted underneath it | ✓ VERIFIED | Cleanup mechanism read directly in `stock-run-until.ts`: VICE auto-deletes the temporary checkpoint on hit (no delete attempted); exactly one `CHECKPOINT_DELETE` on timeout with `ObjectMissing` tolerated; no delete attempted when `MachineRestartedError` propagates (instance already gone). WR-01/WR-02 (the reporting-honesty defects the prior verification flagged) are fixed: the `already_gone` race branch now resolves `reached` from a live PC read or reports `reachedUnknown`, and every answer stamps `machineHalted`. Confirmed in source and 21/21 `stock-run-until.test.ts`. |
| 3 | `vice_diagnose` distinguishes, on the stock backend, wedged / checkpoint-trap / restarted / paused / monitor-held-elsewhere | ✓ VERIFIED (residual gap closed 2026-08-18, quick task 260818-obc) | `restarted`, `checkpoint_trap`, `wedged` (both capability routes) all independently re-proven live, re-measured on **2026-08-18T15:08:51Z** against both real binaries (`node --test stock-live-triage.test.ts`, 3/3 on each binary, 6/6 total). NOTE (quick task 260818-nh5, closing UAT test-8): the original **2026-08-18T12:29:43Z** measurement below in this same report predated commit `88b9a15` (WR-04, `2026-08-18T13:12:06Z`), which additively widened every verdict's evidence with `jamObserved` -- the `restarted` live test's own exact-key-set assertion went stale and reddened on both real binaries with no product regression; the assertion is now additively-tolerant (`stock-live-triage.test.ts`) and its exact shape is pinned by an automated unit oracle (`stock-diagnose.test.ts`) that runs under `node test-gate.mjs` with no emulator. The 3/3-per-binary, 6/6-total figure cited here is the **re-measured, currently-standing** result. `machinePaused`/`machinePausedSource` now genuinely derived (WR-03 fixed, `deriveMachinePaused()`). Manifest schema is backend-aware and `stale_read_path`-free (WR-07 fixed, grep count 0). **UPDATED 2026-08-18, quick task 260818-obc:** the **broker-mediated** `monitor_held_elsewhere` verdict (two real, independently-acquired broker leases resolving to the same crash-respawned instance) is now live-proven too, on both genuine binaries, settling in 1ms against the 10000ms bound and naming the other grant's real id -- see the Live Verification table below for the full transcript. |
| 4 | `vice-wedge-triage`'s documented opening move works on stock rather than returning fork HTTP failure text | ✓ VERIFIED | `vice_diagnose` (the documented opening move, SKILL.md line 37) now succeeds end-to-end on both binaries per truth 1/3's live evidence -- the CR-01 failure it used to hit before any verdict existed is gone. `docs/stock-vice-parity.md`'s false "live-confirmed... resolves to available" claim is corrected with full honest history and the exact re-verified figures. `SKILL.md`'s Provenance table now grades confidence per-claim (HIGH / MEDIUM) instead of a blanket false "live-confirmed against ... VICE 3.10" claim. |

**Score:** 4/4 truths fully verified. The one narrow, honestly-named sub-item within truth 3 (broker-mediated `monitor_held_elsewhere`, live end-to-end) that was previously routed to human verification is now closed with a real transcript (quick task 260818-obc, `stock-live-broker-monitor.test.ts`) — see the Live Verification table below.

### Root-Cause Note (previous gap 1 / CR-01)

The single root cause that previously failed 3 of 4 truths outright -- `probeCpuHistory()` rethrowing
`StockFramingError` out of a decode bug and killing the entire stock handshake on any genuine VICE
≥ 3.10 build -- is fixed and independently re-verified live in this pass, not merely re-read from
source:

```
$ VICE_LIVE_STOCK_BIN=/usr/bin/x64sc VICE_LIVE_STOCK_BIN_39=/usr/bin/x64sc \
  VICE_LIVE_STOCK_BIN_310=/usr/local/bin/x64sc node --test stock-live.test.ts
ok 11 - stockConnect() resolves against genuine VICE 3.9, with cpuHistory absent and a usable session
ok 12 - stockConnect() resolves against genuine VICE 3.10, inverting the previously live-reproduced
        failure "StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65",
        with cpuHistory available
ok 13 - a real ~500ms bracket on genuine VICE 3.10 measures an exact, non-zero, plausible cycle
        count via route cpu_history, through the real dispatchStock() seam
ok 14 - vice_diagnose settles within its own bound when a second real client dials a monitor
        already held by a first
# tests 14 / pass 14 / fail 0
```

```
$ VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc  node --test stock-live-triage.test.ts   # VICE 3.9
$ VICE_LIVE_TRIAGE_BIN=/usr/local/bin/x64sc node --test stock-live-triage.test.ts  # VICE 3.10
ok 1 - checkpoint_trap is live-proven
ok 2 - wedged is live-proven (frame_position on 3.9, cpu_history on 3.10)
ok 3 - restarted is live-proven (test-performed relaunch + epoch bump)
# tests 3 / pass 3 / fail 0   (both runs)
```

Both live-emulator sessions were freshly launched for this verification and left no stray
processes afterward (checked via `ps aux | grep x64sc`, empty at the end of the pass).

**Reproduction note (added 2026-08-18T15:08:51Z, quick task 260818-nh5):** the TAP block
above is the original 12:29:43Z run and is left in place for history, but it is now
STALE evidence -- it predates commit `88b9a15` (WR-04, 13:12:06Z), which additively
widened every verdict's evidence with `jamObserved`. That widening made the
`restarted` live test's exact-key-set assertion go red on both real binaries
afterward, even though `vice_diagnose`'s own answer never regressed. The assertion
in `stock-live-triage.test.ts` is now additively-tolerant (asserts presence of the
two epoch keys and absence of all eleven cost-bearing keys, rather than an exact
key-set match), and the exact evidence shape for both `restarted` branches is now
pinned by an automated shape-oracle test in `stock-diagnose.test.ts` -- that oracle
runs under `node test-gate.mjs` at zero emulator cost, so a future additive widening
reds there first instead of silently reddening this manual-only live suite between
runs. Both binaries were re-run fresh for this note and both reported 3/3 pass, 0
fail (see the Live Verification table below for the currently-standing figures).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/stock-connect.ts` | `probeCpuHistory()`/`resolveCapabilities()` never fail the whole handshake on a decode-class error | ✓ VERIFIED | `probeCpuHistory()` catches `StockFramingError`/`StockDesyncError`/`StockResponseMismatchError` -> `"absent"`; `resolveCapabilities()`'s own call-site guard degrades anything else unclassified to `"absent"` without caching, while still rethrowing real transport/instance failures. Read directly, lines ~148-215. |
| `.claude/mcp/vice/stock-protocol.ts` | `CPUHISTORY_GET` parser decodes real ≥3.10 wire replies | ✓ VERIFIED | Re-derived layout (count u32LE, then per-entry item_size/regCount/registers/cycle u64LE/instruction bytes) matches three committed real fixtures captured from genuine VICE 3.10/3.9 (`fixtures/binmon/cpuhistory-get*.bin/json`), all `need()`-guarded (StockFramingError on short frames, never a RangeError). Live-decoded correctly in this verification's own re-run. |
| `.claude/mcp/vice/stock-run-until.ts` | Exact-address run with correct cleanup + reporting | ✓ VERIFIED | `readProgramCounter()`-based race resolution (WR-01), unconditional `machineHalted`/`machineHaltedNote` (WR-02). 21/21 `stock-run-until.test.ts`. |
| `.claude/mcp/vice/stock-diagnose.ts` | Six-outcome triage (five verdicts + non-verdict `diagnosis_unavailable`) | ✓ VERIFIED (all five verdicts + the non-verdict outcome now live-proven, including the broker-mediated `monitor_held_elsewhere` path, quick task 260818-obc) | `deriveMachinePaused()` (WR-03), `classifyDiagnoseUnavailable()`/`diagnoseUnavailableResult()` (7 reason classes) confirmed in source; 40/40 `stock-diagnose.test.ts` plus the new shape oracle for `monitor_held_elsewhere`'s evidence. |
| `.claude/mcp/vice/tools-manifest.stock.json` + `stock-dispatch.ts`/`vice-proxy.ts` | Backend-correct advertised schema | ✓ VERIFIED | `resolveAdvertisedToolDefinition()` selects the stock manifest entry over the fork's synthetic literal; `grep -c stale_read_path tools-manifest.stock.json` = 0; `vice_run_until`/`vice_diagnose` outputSchema fields match what the handlers actually emit (`machineHalted`, `reachedUnknown`, `raceResolved`, `machinePausedSource`, etc.), confirmed by direct read. |
| `.claude/skills/vice-wedge-triage/SKILL.md` | Opening move + accurate confidence grading | ✓ VERIFIED | No blanket false "live-confirmed against ... VICE 3.10" claim remains; Provenance table grades each claim HIGH/MEDIUM with the specific unit-only vs. live-proven scope named. |
| `docs/stock-vice-parity.md` | Accurate divergence/gain record | ✓ VERIFIED | Lines ~344-409 now record the disproven original claim, both fixes (07-11/07-12), and 07-13's exact re-verified live figures, matching this verification's own independent re-run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-dispatch.ts: ensureStockSession()` | `stock-connect.ts: stockConnect()` | direct call | ✓ WIRED, now succeeds on both VICE 3.9 and 3.10 | Re-verified live in this pass. |
| `stock-connect.ts: resolveCapabilities()` | `stock-connect.ts: probeCpuHistory()` | direct call, guarded try/catch | ✓ WIRED, GUARDED | Decode-class errors degrade to a capability value; transport/instance errors still propagate. |
| `stock-diagnose.ts: handleDiagnoseStock()` | `stock-dispatch.ts: ensureStockSession()` | `Promise.race` against a timeout | ✓ WIRED | `MonitorOwnershipError`/`MachineRestartedError` route to their real verdicts; everything else routes to a classified `diagnosis_unavailable`, never an opaque error. |
| `vice-proxy.ts` tool registration | `tools-manifest.stock.json` via `resolveAdvertisedToolDefinition()` | backend-aware selector | ✓ WIRED | No longer an unconditional overwrite; 6 conformance tests assert the served definition, not just the source file. |
| `stock-run-until.ts` timeout/already_gone branch | `stock-timing.ts: readProgramCounter()` | direct call | ✓ WIRED | Confirmed the exported seam is reused rather than reimplemented. |

### Live Verification (independently re-run by this verification pass, not taken from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `stockConnect()` against genuine VICE 3.9 and 3.10 | `node --test stock-live.test.ts` (both `VICE_LIVE_STOCK_BIN_39`/`_310` set) | 14/14 pass, incl. the exact former CR-01 site now resolving correctly on both | ✓ PASS |
| Route A stopwatch, real ~500ms bracket, VICE 3.10 | (same run) | `530713` exact cycles, `route:"cpu_history"`, `exactness:"exact"` | ✓ PASS |
| Second-client socket contention bound | (same run) | Settled in `1502ms` against a `1500ms` bound, answered `diagnosis_unavailable (monitor_acquisition_timeout)` -- no hang | ✓ PASS (proves the socket-level bound only -- the broker-mediated verdict is the NEW row directly below, quick task 260818-obc) |
| Broker-mediated `monitor_held_elsewhere` verdict, VICE 3.9 | `VICE_LIVE_BROKER_BIN=/usr/bin/x64sc node --test stock-live-broker-monitor.test.ts` (quick task 260818-obc) | A real host broker daemon granted two real sessions the same crash-respawned instance; the session whose real `claimMonitor()` arrived second was refused `monitor_held_elsewhere`, naming the other grant's real id, settling in `1ms` against the `10000ms` bound. The same run's `vice_diagnose` also independently answered `restarted` (`baselineEpoch:1`/`currentEpoch:2`) for the broker's OWN crash-supervised respawn, before the second grant ever claimed anything | ✓ PASS |
| Broker-mediated `monitor_held_elsewhere` verdict, VICE 3.10 | `VICE_LIVE_BROKER_BIN=/usr/local/bin/x64sc node --test stock-live-broker-monitor.test.ts` (quick task 260818-obc) | Same mechanism and result as the 3.9 row: refused in `1ms` against the `10000ms` bound, naming the other grant's real id; `restarted` (`baselineEpoch:1`/`currentEpoch:2`) also independently confirmed for the broker-supervised respawn | ✓ PASS |
| `checkpoint_trap`/`wedged`/`restarted` verdicts, VICE 3.9 | `VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc node --test stock-live-triage.test.ts` | 3/3 pass, re-measured **2026-08-18T15:08:51Z** (quick task 260818-nh5) after the original 12:29:43Z figure went stale against `88b9a15` (WR-04, 13:12:06Z) -- see the reproduction note above; the product's `restarted` answer never regressed, only the test's exact-key-set assertion did, and it is now additively-tolerant | ✓ PASS |
| `checkpoint_trap`/`wedged`/`restarted` verdicts, VICE 3.10 | `VICE_LIVE_TRIAGE_BIN=/usr/local/bin/x64sc node --test stock-live-triage.test.ts` | 3/3 pass, `wedged` confirmed on `cpu_history` route this time (vs. `frame_position` on 3.9); re-measured **2026-08-18T15:08:51Z** (quick task 260818-nh5) for the same reason as the 3.9 row above -- the original 12:29:43Z figure predated `88b9a15` (WR-04, 13:12:06Z) | ✓ PASS |
| Full automated gate | `node test-gate.mjs` | 1565 pass / 0 fail / 5 todo across 21 suites | ✓ PASS (matches orchestrator-supplied evidence, independently re-run) |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS (independently re-run) |

No stray `x64sc` processes were left running after this verification's own live test runs.

### Requirements Coverage

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
|--------------|-----------------|--------------------------------|--------|----------|
| TIME-01 | 07-01, 07-02, 07-05, 07-08, 07-10, 07-11, 07-12, 07-13 | User can measure elapsed CPU cycles on the stock backend, on any supported VICE version | ✓ SATISFIED | Independently re-verified live against both genuine 3.9 and 3.10 in this pass. REQUIREMENTS.md's "Complete" marking is now justified. |
| TIME-02 | 07-03, 07-08, 07-10, 07-14, 07-16 | User can run until an address is reached, exactly | ✓ SATISFIED | Reach/timeout mechanism live-proven (07-10, unchanged); WR-01/WR-02 honesty fields unit-proven (21/21) and confirmed correct by direct source read. REQUIREMENTS.md's "Complete" marking is justified, though the honesty-fields half is unit-only (accurately reflected in REQUIREMENTS.md's own citation text, not overclaimed). |
| TIME-03 | 07-03, 07-05, 07-08, 07-10, 07-12, 07-13 | Cycle-bounded execution is either supported or reports its approximation honestly | ✓ SATISFIED | Route B wraparound refusal (live, unchanged) + Route A now decodes and live-measures correctly (re-verified in this pass). |
| TIME-04 | 07-04, 07-06, 07-07, 07-09, 07-10, 07-15, 07-16, 07-17, quick-260818-obc | `vice-wedge-triage`'s "is the emulator advancing" check works on the stock backend | ✓ SATISFIED (quick task 260818-obc closed the last two residuals) | All five verdicts plus the non-verdict outcome are now live-proven, including the broker-mediated `monitor_held_elsewhere` verdict and a broker-supervised (not test-performed) `restarted` respawn (`stock-live-broker-monitor.test.ts`, both genuine binaries). REQUIREMENTS.md now correctly marks this "Complete" -- no discrepancy between the doc and the code found. |

**No orphaned requirements found.** `.planning/REQUIREMENTS.md`'s "Phase 7" row maps exactly TIME-01
through TIME-04, and every one of the 18 plans (10 original + 8 gap-closure) declares a subset of
that same set in its `requirements:` frontmatter.

### Anti-Patterns Found

None in the phase's touched files. `grep -n -E "TBD|FIXME|XXX"` across `stock-connect.ts`,
`stock-protocol.ts`, `stock-timing.ts`, `stock-run-until.ts`, `stock-diagnose.ts`,
`stock-recycle.ts`, `stock-dispatch.ts`, `vice-proxy.ts`, `tools-manifest.stock.json` returns
nothing. The `stale_read_path` string (the WR-07 anti-pattern the previous verification flagged) is
now absent from the manifest entirely, including from description prose (`grep -c` = 0).

### Human Verification Required

None remaining. `human_verification` in frontmatter is now empty (`[]`) -- the one item this report
previously carried (standing up the host broker control plane with two real, independently-acquired
sessions to prove the `monitor_held_elsewhere` verdict end-to-end through a genuine `claimMonitor()`
refusal) was closed 2026-08-18 by quick task 260818-obc's `stock-live-broker-monitor.test.ts`,
against both genuine stock binaries. See the frontmatter's `re_verification.gaps_closed` entry and
the Live Verification table above for the full transcript.

### Gaps Summary

The phase's Wave-0 blocking defect (CR-01: the entire stock handshake failing on any genuine VICE
≥ 3.10 build) — which previously failed 3 of 4 success criteria outright — is fixed and
independently re-verified live in this pass against both a genuine VICE 3.9 and a genuine VICE 3.10
build, with results matching the gap-closure plans' own SUMMARY claims exactly (including the
specific cycle counts). The four secondary defects the prior verification named (WR-01, WR-02,
WR-03, WR-07) are each fixed and confirmed by direct source read plus passing regression tests. The
two "live-confirmed" claims the prior verification found to be false (`docs/stock-vice-parity.md`,
`SKILL.md`) are now corrected with accurate, appropriately-graded provenance.

**RESOLVED 2026-08-18, quick task 260818-obc (history preserved, not erased):** this report
previously named one narrow, honestly-flagged residual item here — the **broker-mediated**
`monitor_held_elsewhere` verdict, a real second `claimMonitor()` refusal surfaced through the host
broker's own control plane, as opposed to the unit-injected `MonitorOwnershipError` or the
live-proven raw-socket contention bound this phase's tests exercise — as not yet proven end-to-end.
It was named as an explicit, deliberate scope boundary by the plan that came closest to it (07-13
Task 3), and was reflected honestly in `07-VALIDATION.md` (the sole row keeping
`nyquist_compliant: false`) and in `REQUIREMENTS.md` (`TIME-04` marked "Partial", not "Complete").

That gap is now closed. Quick task 260818-obc stood up a real host broker daemon
(`resources/vice-broker.mjs`) with two real, independently-acquired `openBrokerControl()` sessions
against the same crash-respawned instance, and exercised the exact scenario this residual item
named: a real `claimMonitor()` refusal, naming the other grant's real id, on both genuine
`/usr/bin/x64sc` (3.9) and `/usr/local/bin/x64sc` (3.10), settling in 1ms against the 10000ms bound.
The SAME run also proved the broker-supervised (not test-performed) `restarted` respawn TIME-04's
text separately named as open. `07-VALIDATION.md`'s `nyquist_compliant` is now `true` and
`REQUIREMENTS.md`'s `TIME-04` is now marked "Complete" — both updated by the same quick task, citing
this transcript. No follow-up plan is owed for either residual.

---

_Verified: 2026-08-18T12:29:43Z (original pass); residual item closed 2026-08-18 by quick task 260818-obc_
_Verifier: Claude (gsd-verifier)_
