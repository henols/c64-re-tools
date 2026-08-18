---
phase: 07-cycle-timing-and-wedge-triage
plan: 15
subsystem: wedge-triage
tags: [vice_diagnose, stock-backend, run-state, error-classification, binary-monitor]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "stock-diagnose.ts's five-verdict handleDiagnoseStock() (07-06/07-07), stock-runstate.ts's runStateFor() (D-06)"
provides:
  - "diagnoseVerdictResult() derives machinePaused from runStateFor(session.client) instead of a hand-passed literal, labelled machinePausedSource (no_session|observed|structural)"
  - "STOCK_DIAGNOSE_UNAVAILABLE_OUTCOME (\"diagnosis_unavailable\") and STOCK_DIAGNOSE_UNAVAILABLE_REASONS (7-member frozen list), classifyDiagnoseUnavailable(), diagnoseUnavailableResult() -- routes every non-verdict vice_diagnose failure through a classified, greppable, anti-escalation message"
  - "38+ (delivered 40) regression tests pinning the derivation, the classifier, and the frozen five-verdict set"
affects: [07-16-manifest-schema, 07-18-skill-triage-table, wedge-triage skill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive-don't-pass: a field that can be read from observed state must never be a hand-passed literal at a call site (WR-03's own rule, stated in stock-diagnose.ts's deriveMachinePaused() comment)"
    - "Named non-verdict outcome on the existing isError:true channel, rather than widening a frozen enum, when the manifest's required-field schema forbids a nullable/optional verdict"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-diagnose.ts
    - .claude/mcp/vice/stock-diagnose.test.ts

key-decisions:
  - "machinePausedSource has exactly three values: no_session (no session was ever obtained -- monitor_held_elsewhere and the thrown-MachineRestartedError acquisition path), observed (runStateFor() reported stopped or running directly from the wire's own stopped/resumed/jam events), structural (runStateFor() reported unknown -- inferred paused because every function in this file except runStockLivenessBracket() never resumes, and that function itself ends with a halting read)"
  - "STOCK_DIAGNOSE_UNAVAILABLE_REASONS is exactly 7 members, in this order: protocol_decode_failure, connection_lost, request_timeout, monitor_acquisition_timeout, session_refused, evidence_gathering_failed, unknown. classifyDiagnoseUnavailable() can only ever produce 4 of these (protocol_decode_failure, connection_lost, request_timeout, unknown) -- the other 3 are assigned directly at their own call sites in handleDiagnoseStock(), never through the classifier"
  - "diagnosis_unavailable message format: 'vice_diagnose: diagnosis_unavailable (<reason>) -- no verdict could be established. This is deliberately NOT one of the five documented verdicts (restarted, checkpoint_trap, wedged, monitor_held_elsewhere, live). The emulated machine's state is therefore UNKNOWN -- do not read this as live and do not treat it as a wedge. Recycling on this answer alone is wrong: vice_recycle is destructive and wedged was not established. <reason-specific guidance>. <raw detail>'"
  - "MonitorOwnershipError and MachineRestartedError must never reach classifyDiagnoseUnavailable() -- both are checked with instanceof BEFORE the classifier is called and route to their own real verdicts (monitor_held_elsewhere/restarted), proven by a dedicated test driving handleDiagnoseStock() end-to-end"

patterns-established:
  - "A derivation function (deriveMachinePaused()) that owns both the boolean and its provenance label, called from exactly one place (diagnoseVerdictResult()), so no future call site can drift by hand-passing a stale value"

requirements-completed: [TIME-04]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 07 Plan 15: WR-03 machinePaused Derivation and diagnosis_unavailable Outcome Summary

**`vice_diagnose`'s `machinePaused` field is now derived from `runStateFor()` instead of hand-passed, and every non-verdict failure (CR-01-class decode errors included) answers a classified, greppable `diagnosis_unavailable` outcome instead of an opaque protocol string.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-18T11:03:59Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 2 (`stock-diagnose.ts`, `stock-diagnose.test.ts`)

## Accomplishments

- **WR-03 closed:** `diagnoseVerdictResult()` no longer accepts a `machinePaused` boolean parameter. `deriveMachinePaused(session)` reads `runStateFor(session.client)` and returns both `machinePaused` and a `machinePausedSource` label (`"no_session"` / `"observed"` / `"structural"`), so a caller can tell an actual wire observation from a structural inference. All 7 `diagnoseVerdictResult()` call sites in `handleDiagnoseStock()` updated.
- **Gap 3 / Gap 4 / CR-01 closed:** every non-verdict failure exit (`session acquisition failed` generic catch, the race-timeout branch, `!outcome.ok`, the trap-evidence catch, and both liveness-bracket catches) now returns `diagnoseUnavailableResult(reason, detail)` — a stable-prefix, greppable message naming one of 7 reason classes, stating the verdict set was NOT reached, that the machine state is UNKNOWN, and that `vice_recycle` on this answer alone is wrong.
- **D-03 preserved:** `STOCK_DIAGNOSE_VERDICTS` is still exactly the 5 of D-03; `diagnosis_unavailable` is a named outcome on the `isError:true` channel, never added to the verdict array. A dedicated test (temporarily mutated locally, observed to fail, then reverted — see below) proves the guard is load-bearing.
- **40/40 tests green** in `stock-diagnose.test.ts` (25 pre-existing + 15 added), **159/159** across `stock-diagnose.test.ts` + `stock-dispatch.test.ts` (including the `vice_diagnose` `outputSchema` conformance case, unaffected by the additive `machinePausedSource` field), and `test-gate.mjs` shows only the pre-existing, already-documented `repo-root.test.ts` worktree-path failure.

## Task Commits

1. **Task 1: Derive machinePaused from the observed run state** - `91135b1` (fix)
2. **Task 2: Add the named diagnosis_unavailable outcome and route every non-verdict failure through it** - `c280994` (feat)
3. **Task 3: Lock the derivation, the classifier and the frozen five into stock-diagnose.test.ts** - `c0a4867` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.claude/mcp/vice/stock-diagnose.ts` — `deriveMachinePaused()`, `MachinePausedSource` type; `STOCK_DIAGNOSE_UNAVAILABLE_OUTCOME`, `STOCK_DIAGNOSE_UNAVAILABLE_REASONS`, `StockDiagnoseUnavailableReason`, `classifyDiagnoseUnavailable()`, `diagnoseUnavailableGuidance()`, `diagnoseUnavailableResult()`; `diagnoseVerdictResult()` signature change; 6 of `handleDiagnoseStock()`'s failure exits rerouted.
- `.claude/mcp/vice/stock-diagnose.test.ts` — 15 new tests: 2 WR-03 checkpoint_trap machinePausedSource cases, 1 extended monitor_held_elsewhere assertion, 2 extended live/wedged assertions, 1 reasons-list guard, 4 classifier unit cases, 1 never-classified proof (Monitor/MachineRestarted), 6 end-to-end `diagnosis_unavailable` reason cases (protocol_decode_failure, connection_lost, request_timeout, monitor_acquisition_timeout, session_refused, evidence_gathering_failed), 1 extended verdict-array guard, 1 anti-escalation wording guard.

## Decisions Made

- **`machinePausedSource` value set (for 07-16's manifest delta):** `"no_session" | "observed" | "structural"`.
- **`STOCK_DIAGNOSE_UNAVAILABLE_REASONS` (7, frozen, exported):** `"protocol_decode_failure"`, `"connection_lost"`, `"request_timeout"`, `"monitor_acquisition_timeout"`, `"session_refused"`, `"evidence_gathering_failed"`, `"unknown"`.
- **Exact message prefix format (stable for machine parsing):** `` vice_diagnose: diagnosis_unavailable (<reason>) -- `` followed by, in order: (1) "no verdict could be established... deliberately NOT one of the five documented verdicts (restarted, checkpoint_trap, wedged, monitor_held_elsewhere, live)"; (2) "The emulated machine's state is therefore UNKNOWN -- do not read this as live and do not treat it as a wedge."; (3) "Recycling on this answer alone is wrong: vice_recycle is destructive and wedged was not established."; (4) reason-specific guidance text; (5) the raw `detail` string, verbatim, last.
- **`outputSchema` delta 07-16 must apply:** `vice_diagnose`'s manifest entry needs a `machinePausedSource` field (string enum: `no_session`, `observed`, `structural`) alongside the existing `machinePaused` boolean. `STOCK_DIAGNOSE_VERDICTS` stays untouched (still exactly 5) — `diagnosis_unavailable` is NOT a manifest verdict enum member; it only ever appears as `isError:true` text.
- **Triage-table row 07-18 must add to `vice-wedge-triage/SKILL.md`:** a row (or note) documenting that `vice_diagnose` can return `isError:true` with text starting `vice_diagnose: diagnosis_unavailable (<reason>)` for any of the 7 reason classes above, that this means no verdict was established and the machine state is unknown, and that the triage agent's next move is reason-specific (retry once for `connection_lost`/`request_timeout`; check `docs/stock-vice-parity.md` for `protocol_decode_failure`; retry once the current holder releases for `monitor_acquisition_timeout`; `vice_execution_run` may be needed for `evidence_gathering_failed`) — never a direct jump to `vice_recycle`.

## Deviations from Plan

None — plan executed exactly as written. The generic outer `catch (err)` at the very end of `handleDiagnoseStock()` ("an unexpected error occurred") was deliberately left on `diagnoseErrorResult()`, matching the plan's exact list of exits to reroute (it named the generic session-acquisition catch, the race-timeout branch, `!outcome.ok`, the trap-evidence catch, and the bracket catches — not this outermost catch-all, which the plan's own `inconclusiveBracketText(...)` carve-out implies is out of scope for the same reason: it is a different kind of already-explained failure).

## Issues Encountered

- The plan's Task 3 read_first section implied `session_refused` could be produced by making `deps.connect()` return `{ ok: false, message }`. Reading `ensureStockSession()` (stock-dispatch.ts:236-344) showed `connect()`/`connectFn` always returns a `StockConnectSession` or throws — `{ ok: false }` can only originate from `deps.ensureLease()` itself or the `lease === null` (VICE_MCP_URL override) branch. The `session_refused` test was written against `ensureLease` returning `{ ok: false, message: ... }` instead, which is the actually-reachable path to `!outcome.ok`.
- Similarly, the `evidence_gathering_failed` test needed to throw from `CommandType.MemoryGet` rather than `CommandType.RegistersGet`: `handleRegistersGet` (used by `readStockPc()`) catches its own wire failures and returns `isError:true` rather than throwing, so a `RegistersGet` failure would have been silently absorbed as `pc: null` rather than propagating out of `gatherStockCheckpointTrapEvidence()`. `resolveStockLiveIrqHandler()`'s direct, uncaught `session.client.send(CommandType.MemoryGet, ...)` call is the one that actually propagates.
- Verified the frozen-set guard test is load-bearing per the plan's own acceptance criterion: temporarily added a 6th entry (`"TEMP_SIXTH_VERDICT_FOR_GATE_VERIFICATION"`) to `STOCK_DIAGNOSE_VERDICTS`, ran `node --test stock-diagnose.test.ts`, observed the guard test fail with the expected diff, then reverted the edit (confirmed via `git diff --stat` showing no changes) and re-ran the full suite green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 07-16 can now consume `machinePausedSource`'s exact three-value enum and add it to `tools-manifest.stock.json`'s `vice_diagnose` `outputSchema` without re-deriving anything.
- 07-18 can now consume the 7 reason classes and the exact message prefix to add a `diagnosis_unavailable` row/note to `vice-wedge-triage/SKILL.md`'s verdict table.
- The live proofs of `checkpoint_trap`/`wedged`/`restarted` against a real emulator (owned by 07-17) are unaffected — this plan only changed evidence-field derivation and non-verdict failure text, not any wire behavior or verdict logic.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-diagnose.ts
- FOUND: .claude/mcp/vice/stock-diagnose.test.ts
- FOUND commit: 91135b1 (Task 1)
- FOUND commit: c280994 (Task 2)
- FOUND commit: c0a4867 (Task 3)
