---
status: complete
phase: 07-cycle-timing-and-wedge-triage
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md, 07-08-SUMMARY.md, 07-09-SUMMARY.md, 07-10-SUMMARY.md, 07-11-SUMMARY.md, 07-12-SUMMARY.md, 07-13-SUMMARY.md, 07-14-SUMMARY.md, 07-15-SUMMARY.md, 07-16-SUMMARY.md, 07-17-SUMMARY.md, 07-18-SUMMARY.md
started: 2026-08-18T14:31:30Z
updated: 2026-08-18T15:24:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean tree, `npx tsc --noEmit` is clean, `node test-gate.mjs` passes with zero failures, `node build.ts` produces zero drift in `resources/*.mjs`, and both manifests parse with stock = 38 tools and the fork's list unchanged.
result: pass
detail: |
  `npx tsc --noEmit` -> exit 0, no diagnostics.
  `node test-gate.mjs` -> 1629 tests, **1624 pass / 0 fail / 0 skipped / 5 todo**, 24.8s.
  The 5 todo are the CLAUDE.md-sanctioned `vice-sync.ts` items, untouched.
  `node build.ts` -> "wrote 8 artifact(s)"; `git status --porcelain -- resources/` empty
  (zero drift).
  `tools-manifest.stock.json` = 38 tools; `tools-manifest.json` = 62 raw entries, last
  touched by `f5c171d` (Phase 03) -- unchanged by Phase 07 as the compatibility
  constraint requires.

### 2. Measure Elapsed Cycles on Stock (Route A)
expected: On genuine VICE >= 3.10, `vice_cycles_stopwatch` brackets a real operation and returns an exact, non-zero, plausible cycle count via route `cpu_history`, dispatched through the real `dispatchStock()` seam.
result: pass
detail: |
  `node --test stock-live.test.ts` against genuine `/usr/bin/x64sc` (3.9) and
  `/usr/local/bin/x64sc` (3.10): **14/14 pass**, 15.1s.
  - ok 12: `stockConnect()` resolves on real 3.10 with `cpuHistory: available` -- the exact
    inversion of the CR-01 failure string.
  - ok 13: a real ~500ms bracket on genuine 3.10 measures an exact, non-zero, plausible
    cycle count via route `cpu_history`, through the real `dispatchStock()` seam.
  Unit side: `stock-timing.test.ts` 38/38.

### 3. An Unmeasurable Bracket Says So Instead of Returning Zero
expected: When cycles cannot be measured (VICE 3.9 with no `CPUHISTORY_GET`, or a Route B bracket that provably crossed a frame boundary), the answer carries `measurable: false` and no `cycles` key at all — never a fabricated `0`.
result: pass
detail: |
  Live: ok 11 in `stock-live.test.ts` -- `stockConnect()` against genuine VICE 3.9 resolves
  with `cpuHistory: absent` and a usable session (the population that has no Route A at all).
  Unit: `stock-timing.test.ts` 38/38 pins the proven-wraparound refusal, and
  `stock-diagnose.ts`'s `liveness_unmeasurable` reason class carries the same rule into
  `vice_diagnose` -- "a bracket that cannot measure is not one that measured zero".

### 4. Run to an Exact Address, Checkpoint Cleaned Up
expected: `vice_run_until` on stock stops at the requested address and the temporary checkpoint is gone afterwards — on hit VICE auto-deletes it, on timeout exactly one `CHECKPOINT_DELETE` is sent with `ObjectMissing` tolerated, and on a machine restart no delete is attempted.
result: pass
detail: |
  `stock-run-until.test.ts` **27/27** (was 21/21 at 07-14; +6 from the code-review fix
  batch). All three cleanup paths pinned. The reach/timeout mechanism is additionally
  recorded live-proven against both binaries by 07-10.

### 5. run_until Timeout Is Bounded and Honest
expected: A `vice_run_until` that never reaches its address returns within the `timeout_ms` bound (default 30000, ceiling 600000) rather than hanging, states `machineHalted`, names `vice_execution_run` as the resume call, and resolves `reached` from a live PC read (or says `reachedUnknown`) instead of asserting a false `reached: false`.
result: pass
detail: |
  `stock-run-until.test.ts` 27/27. Manifest agrees with the handler: `vice_run_until`'s
  `outputSchema.required` is `[requested, address, timeoutMs, runState, machineHalted]` --
  `reached` correctly NOT required -- and its properties include `reachedUnknown`,
  `raceResolved`, `pcAtCleanup`, `pcReadError`, `raceNote`, `machineHaltedNote`.

### 6. vice_diagnose Recognises a Checkpoint Trap
expected: Against a real emulator stopped at the user's own checkpoint, `vice_diagnose` on stock answers `verdict: "checkpoint_trap"` with the trapping checkpoint identified — not "wedged".
result: pass
detail: |
  `node --test stock-live-triage.test.ts`, run against BOTH binaries:
  ok 1 on `/usr/bin/x64sc` (3.9) and ok 1 on `/usr/local/bin/x64sc` (3.10) -- an armed
  stopping exec checkpoint at $EA31 halts the machine, `vice_diagnose` reports
  `checkpoint_trap` with `machinePaused` observed and no bracket run.

### 7. vice_diagnose Recognises a Genuinely Wedged Machine
expected: Against a real CPU JAM held in the monitor, `vice_diagnose` on stock answers `verdict: "wedged"` via its snapshot-resume-wait-halt-compare liveness bracket (exactly one resume, zero traffic during the wait).
result: pass
detail: |
  ok 2 on both binaries -- a real CPU JAM held in the monitor produces two zero-advance
  liveness brackets (`frame_position` route on 3.9, `cpu_history` on 3.10).

### 8. vice_diagnose Recognises a Crashed-and-Respawned Emulator
expected: Against a real kill-and-relaunch underneath the session, `vice_diagnose` on stock answers `verdict: "restarted"` rather than reporting a hang.
result: pass
resolved_by: "quick task 260818-nh5 (commits acc9933, 84cca54, 9831fa8)"
original_result: "issue (severity: major). Retained verbatim below in `reported`/`detail` --- the verdict was always correct, only its proof was broken, and the history of that is worth keeping."
reported: "The live proof is red on both binaries. `vice_diagnose` DOES answer verdict:\"restarted\" correctly — the failure is a stale assertion in stock-live-triage.test.ts:682 that demands the restarted evidence carry exactly {baselineEpoch,currentEpoch}, but WR-04 (commit 88b9a15) later added jamObserved to every verdict's evidence. Because stock-live-triage.test.ts is manual-only and excluded from test-gate.mjs, the code-review fix batch reported a green 1624/0 gate while breaking the phase's only executable live proof of this verdict."
severity: major
detail: |
  `VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc node --test stock-live-triage.test.ts`   -> 2 pass / 1 fail
  `VICE_LIVE_TRIAGE_BIN=/usr/local/bin/x64sc node --test stock-live-triage.test.ts` -> 2 pass / 1 fail

      not ok 3 - restarted is live-proven -- a real kill-and-relaunch on the same port
                 with a bumped epoch file yields restarted at zero emulator cost
        error: restarted evidence must carry ONLY baselineEpoch/currentEpoch,
               got keys: baselineEpoch,currentEpoch,jamObserved
        + actual   'baselineEpoch,currentEpoch,jamObserved'
        - expected 'baselineEpoch,currentEpoch'
        at stock-live-triage.test.ts:682

  The assertions that matter all PASSED before line 682:
    - `postPayload.verdict === "restarted"`            (line 671)
    - `evidence.baselineEpoch === BASELINE_EPOCH`      (line 672)
    - `evidence.currentEpoch === BASELINE_EPOCH + 1`   (line 673)
    - no `bracket` / `bracket1` / `checkpoints` keys   (lines 677-679, zero emulator cost)
  Only the exact-key-set equality at line 682 failed. Product behaviour is correct; the
  regression proof is not runnable.

  Provenance of the break:
    - `88b9a15 fix(07): WR-04 keep the JAM signal instead of collapsing it into stopped`
      (2026-08-18 15:12 +0200) added `jamObserved` at `stock-diagnose.ts:770` to the
      evidence of EVERY verdict, restarted included.
    - `07-VERIFICATION.md` ran at 12:29Z, BEFORE that commit, and recorded "3/3 on each
      binary, 6/6 total" -- true when written, false now.
    - `07-REVIEW-FIX.md`'s gate (`node test-gate.mjs`, 1624/0) structurally cannot see it:
      `stock-live-triage.test.ts` is entry 5 of `MANUAL_ONLY_TESTS`.

**RESOLVED 2026-08-18 by quick task 260818-nh5.** The assertion was relaxed, not the
product changed --- `stock-diagnose.ts` is byte-identical to its pre-task state
(D-01: `jamObserved` STAYS on the restarted branch; both restarted call sites were
read, and `stock-diagnose.ts:911`'s epoch-comparison branch passes a NON-null session,
so `jamObservedFor()` reads the live latching tracker there and the field is genuinely
load-bearing, not inert).

What changed:
  - `stock-live-triage.test.ts:682`'s exact-key-set equality became a presence
    assertion on `baselineEpoch`/`currentEpoch` plus an absence loop over a named
    `EMULATOR_COST_EVIDENCE_KEYS` array of ELEVEN cost-bearing keys (`bracketsRun`,
    `bracket`, `bracket1`, `bracket2`, `isTrap`, `checkpoints`,
    `checkpointsUnavailable`, `pc`, `handler`, `trapCheckpoint`, `trapReason`).
    The zero-emulator-cost guarantee is now stated directly and comes out STRONGER
    than the three ad-hoc checks it replaces --- the old equality proved it only
    incidentally, and broke on any additive field.
  - The gate hole is closed by a zero-cost unit SHAPE ORACLE in
    `stock-diagnose.test.ts`, exercising BOTH restarted call sites and pinning the
    exact key set `{baselineEpoch, currentEpoch, jamObserved}`. It needs no emulator,
    so it runs under `node test-gate.mjs` --- where a doc note would not have caught
    `88b9a15`. `MANUAL_ONLY_TESTS` stays at exactly five entries (`test-gate.test.ts`
    guards that list); `test-gate.mjs`'s header now carries the standing rule.

Independently re-verified on merged `main` by the orchestrator, not just self-reported
by the executor:
  `npx tsc --noEmit`                                                 -> exit 0
  `node test-gate.mjs`                    -> 1630 tests, 1625 pass / **0 fail** / 5 todo
  `VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc ...`       -> **3/3** (genuine stock 3.9)
  `VICE_LIVE_TRIAGE_BIN=/usr/local/bin/x64sc ...` -> **3/3** (genuine stock 3.10)
                                                     = 6/6, restoring the recorded claim
  no stray `x64sc` processes left behind.

The gate-hole closure was proven by INJECTION, not assumed: adding a dummy extra field
to `diagnoseVerdictResult()`'s evidence (reproducing `88b9a15`'s exact failure mode)
reds the new oracle under `node --test stock-diagnose.test.ts` while the live suite
stays 3/3 --- precisely the inversion of the original failure. `stock-diagnose.ts` was
restored afterwards and `git status` confirms it unmodified.

### 9. Diagnosing Under Second-Client Contention Settles, Never Hangs
expected: When a second client dials a binary monitor a first client already holds, `vice_diagnose` settles well inside its configured session-acquisition bound and returns a classified answer (`monitor_held_elsewhere`, or the non-verdict `diagnosis_unavailable` with a named reason) — it does not sit there indistinguishable from the hang it is meant to diagnose.
result: pass
detail: |
  ok 14 in `stock-live.test.ts` -- `vice_diagnose` settles within its own bound when a real
  second client dials a monitor a first already holds.
  Scope note, unchanged and honestly recorded: this is the SOCKET-level contention path.
  The BROKER-mediated `monitor_held_elsewhere` verdict (two real, independently-acquired
  broker leases producing a genuine `claimMonitor()`/`MonitorOwnershipError` round trip)
  remains unit-proven only and is already tracked as the single open item in
  `07-HUMAN-UAT.md`. Not re-raised here as a gap.

### 10. vice_recycle Records Evidence Before It Kills
expected: `vice_recycle` on stock gathers four deadline-bounded evidence items (bracket, registers, checkpoints, IRQ handler — no screenshot), writes the incident record to disk with its evidence section complete, and only then sends the broker's destructive recycle RPC.
result: pass
detail: |
  `stock-recycle.test.ts` **21/21**, pinning the reason gate, the record-before-RPC
  ordering (D-17), per-outcome finalisation, and `stockDisconnect()` teardown.
  The screenshot's deliberate absence is recorded as divergence D-01 in
  `docs/stock-vice-parity.md`.

### 11. The Stock Backend Advertises Its Own Corrected Tool Definitions
expected: On the stock backend the advertised `vice_diagnose` / `vice_recycle` definitions come from `tools-manifest.stock.json` (five-verdict enum pinned, no `stale_read_path` anywhere), not `vice-proxy.ts`'s fork-worded literal; the stock manifest advertises 38 tools and every `outputSchema` declares the fields the handlers actually emit.
result: pass
detail: |
  `grep -c stale_read_path tools-manifest.stock.json` -> **0**.
  `vice_diagnose.outputSchema.properties.verdict.enum` ->
    ["restarted","checkpoint_trap","wedged","monitor_held_elsewhere","live"] -- exactly five,
    with `diagnosis_unavailable` correctly kept OUT of the verdict enum.
  Stock manifest = 38 tools.
  `stock-dispatch.test.ts` **125/125**, including the 6 conformance tests that assert the
  ADVERTISED definition (not just the source file) and the guard that fails a future
  re-introduced unconditional overwrite.

### 12. The Wedge-Triage Skill's Opening Move Works on Stock, and the Docs Do Not Overclaim
expected: `vice-wedge-triage/SKILL.md`'s documented opening move (`vice_diagnose`) succeeds on stock instead of returning fork HTTP failure text, has an actionable response for every `diagnosis_unavailable` reason class, and `docs/stock-vice-parity.md` carries no false "live-confirmed" claim.
result: pass
detail: |
  `STOCK_DIAGNOSE_UNAVAILABLE_REASONS` freezes **8** classes (protocol_decode_failure,
  connection_lost, request_timeout, monitor_acquisition_timeout, session_refused,
  evidence_gathering_failed, liveness_unmeasurable, unknown). SKILL.md's response table
  documents all 8, each with its own next move -- code and skill agree exactly.
  (My own test text originally said "7 reason classes", carried from 07-15-SUMMARY.md
  before WR-02 added `liveness_unmeasurable` and `unknown`; corrected above. Not a defect.)
  `docs/stock-vice-parity.md`'s two remaining "live-confirmed" occurrences (lines 359, 396)
  are the CORRECTED, properly-attributed ones -- the paragraph explicitly names the previous
  claim as wrong and re-attributes the confirmation to 07-13 with the real measured figures
  (511,061 / 530,713 cycles), rather than to the 07-01 fix alone.
  SKILL.md's Provenance table grades confidence per-claim (HIGH / MEDIUM) instead of a
  blanket live-confirmed assertion.

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Against a real kill-and-relaunch underneath the session, vice_diagnose on stock answers verdict:\"restarted\", and that proof is executable"
  status: closed
  closed_by: "quick task 260818-nh5, 2026-08-18 (commits acc9933 test relax, 84cca54 shape oracle, 9831fa8 doc correction)"
  closure_note: "All four `missing:` items below were addressed. Item 2 (does jamObserved belong on the restarted branch?) was resolved as KEEP --- stock-diagnose.ts:911 passes a non-null session, so the field reads the live latching JAM tracker and is not inert on that path. Item 4 was closed with an automated unit shape oracle rather than a doc note, and its effectiveness was proven by injecting the same additive widening that caused the original break."
  reason: "User reported: the live proof is red on both binaries. The verdict itself is correct; stock-live-triage.test.ts:682 asserts an exact evidence key set {baselineEpoch,currentEpoch} that WR-04 (88b9a15) invalidated by adding jamObserved to every verdict's evidence. stock-live-triage.test.ts is manual-only and excluded from test-gate.mjs, so the fix batch's green 1624/0 gate could not see the break."
  severity: major
  test: 8
  root_cause: "stock-live-triage.test.ts:682 pins the restarted verdict's evidence to an exact key set (`Object.keys(evidence).sort().join(',') === 'baselineEpoch,currentEpoch'`). Commit 88b9a15 (WR-04, part of the 07-REVIEW-FIX batch, landed AFTER 07-17 wrote that assertion and AFTER 07-VERIFICATION.md ran) added `jamObserved` at stock-diagnose.ts:770 to the evidence of every verdict, restarted included. The assertion is stale, not the product. It was not caught because stock-live-triage.test.ts is entry 5 of MANUAL_ONLY_TESTS in test-gate.mjs, so `node test-gate.mjs` -- the gate 07-REVIEW-FIX.md reported green at 1624/0 -- never runs it."
  artifacts:
    - path: ".claude/mcp/vice/stock-live-triage.test.ts"
      issue: "line 682: exact-key-set equality on restarted evidence, invalidated by WR-04's jamObserved field"
    - path: ".claude/mcp/vice/stock-diagnose.ts"
      issue: "line 770: correct behaviour -- spreads jamObserved into every verdict's evidence (WR-04). Not to be reverted."
    - path: ".claude/mcp/vice/test-gate.mjs"
      issue: "MANUAL_ONLY_TESTS structurally hides drift in the live suites from every automated gate; no mechanism re-runs them after a code change"
    - path: ".planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md"
      issue: "records `stock-live-triage.test.ts, 3/3 on each binary, 6/6 total` -- true at 12:29Z, false after 88b9a15 at 13:12Z"
  missing:
    - "Relax stock-live-triage.test.ts:682 from an exact key-set equality to an assertion that survives an additively-widened evidence shape: keep the zero-emulator-cost intent (no bracket/bracket1/checkpoints keys, already asserted at lines 677-679) and assert baselineEpoch/currentEpoch are present, rather than that nothing else is."
    - "Decide whether `jamObserved` belongs in the restarted evidence at all -- on a restarted verdict the session is often null and jamObservedFor() returns the constant false, so the field may be inert noise on this path specifically. If it is inert, exclude it at stock-diagnose.ts:770 for the restarted branch and the original assertion stands unchanged."
    - "Correct 07-VERIFICATION.md's live-evidence claim for stock-live-triage.test.ts, and re-run both binaries to restore the recorded 3/3."
    - "Close the gate hole: give the manual-only live suites a re-run trigger (a documented post-change step, or a CI job gated on a real emulator) so a future evidence-shape change cannot silently red them again."
  debug_session: ""
