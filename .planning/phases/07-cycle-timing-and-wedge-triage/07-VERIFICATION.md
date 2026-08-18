---
phase: 07-cycle-timing-and-wedge-triage
verified: 2026-08-18T00:00:00Z
status: gaps_found
score: 1/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A user can measure elapsed cycles across an operation on the stock backend, and a bracket that cannot be measured says so rather than returning zero."
    status: failed
    reason: >
      Live-reproduced against genuine /usr/local/bin/x64sc (VICE 3.10, unpatched): the stock
      connect handshake itself (stockConnect() -> resolveCapabilities() -> probeCpuHistory())
      throws StockFramingError before any session is returned. ensureStockSession() (the seam
      every stock tool including vice_cycles_stopwatch, vice_run_until, vice_diagnose and
      vice_recycle goes through) never resolves on this build. Reproduced independently of
      07-REVIEW.md's CR-01 using this tree's own stockConnect()/ViceMonitorClient, same error:
      "StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65". On
      genuine /usr/bin/x64sc (VICE 3.9) the same probe connects successfully and
      session.capabilities.cpuHistory resolves to "absent" (Route B only). So "a user can
      measure elapsed cycles on the stock backend" is true only for pre-3.10 builds; on any
      build that actually implements CPUHISTORY_GET (the opcode this milestone explicitly
      targets, and the version CLAUDE.md names as the one official/Homebrew builds ship) the
      user reaches no tool at all, not merely a degraded stopwatch.
    artifacts:
      - path: ".claude/mcp/vice/stock-connect.ts"
        issue: >
          probeCpuHistory() (lines 117-133) sends CPUHISTORY_GET with count=1 (07-01's fix for
          the pre-3.10 InvalidParameter/0x81 case) but only catches StockProtocolError. On a
          compliant >=3.10 build the monitor answers with a real, well-formed CPUHISTORY_GET
          reply that stock-protocol.ts's own parser cannot decode (see next row), which throws
          StockFramingError -- a different class, not caught here, so it rethrows at line 131,
          propagates through resolveCapabilities() (no try/catch, stock-connect.ts:163) and out
          of stockConnect() step 5 (stock-connect.ts:341), which treats it as a fatal handshake
          failure and rejects. This is 07-01's own must_have truth ("A stock connect handshake
          against a real VICE >= 3.10 build completes instead of throwing out of
          resolveCapabilities()") re-failing via a different, unhandled error class -- the fix
          only handled the pre-3.10 refusal path, not the >=3.10 success-that-cant-be-decoded
          path it created exposure to.
      - path: ".claude/mcp/vice/stock-protocol.ts"
        issue: >
          The CpuHistoryGet parser case (lines 1414-1447) still carries the comment "confirmed
          against monitor_binary.c:1563-1617" (WR-13, unfixed) despite the phase's own
          deferred-items.md recording, with a byte-level live capture, that a real VICE 3.10
          reply for count:1 is 52 bytes with item_size=47 -- leaving no room for the documented
          trailing cycle+instruction fields the parser requires (>= 65 bytes). This is the root
          decode defect that CR-01 shows escapes into a handshake-fatal error.
      - path: "docs/stock-vice-parity.md"
        issue: >
          Lines 349-352 still claim "the capability now actually resolves to \"available\"
          where the build supports it, live-confirmed against the fork's own genuine VICE
          3.10.0.0 build" -- directly contradicted by the live reproduction above: the capability
          never resolves to anything because the handshake fails before any capability value is
          produced. This claim is unfixed since 07-REVIEW.md flagged it as CR-01.
    missing:
      - "probeCpuHistory() must also catch StockFramingError and answer a capability value (e.g. \"absent\", per CR-01's suggested fix) instead of rethrowing -- a decode bug must never fail the whole handshake."
      - "The CPUHISTORY_GET per-entry wire layout must be re-derived from a real VICE >= 3.10 build (deferred-items.md's own recommendation) so Route A actually decodes, not just fails safely."
      - "docs/stock-vice-parity.md:349-352's false live-confirmed claim must be corrected or removed."
      - "REQUIREMENTS.md's TIME-01 'Complete' marking ('on any supported VICE version') must be reverted -- it is contradicted by this live evidence."
  - truth: "A user can run to an exact address on the stock backend, with the temporary checkpoint cleaned up whether the run succeeded, timed out, or the machine restarted underneath it."
    status: partial
    reason: >
      Only reachable at all on VICE 3.9 in practice -- on genuine VICE 3.10 the same CR-01
      handshake failure blocks vice_run_until before any checkpoint is ever set, since it too
      goes through ensureStockSession() -> stockConnect(). On 3.9, the cleanup mechanism itself
      is real (temporary:true on CHECKPOINT_SET, exactly one CHECKPOINT_DELETE on both the hit
      and timeout paths, ObjectMissing tolerated as benign, delete skipped on
      MachineRestartedError) and unit-tested (stock-run-until.test.ts, 15/15) plus live-checked
      against both binaries per deferred-items.md (before the CR-01 regression's blast radius
      was understood). But two unfixed WARNING-level defects (07-REVIEW.md WR-01, WR-02, both
      confirmed still present in the current stock-run-until.ts) mean the tool actively
      misreports what happened: on a benign already-gone race it still answers
      `reached: false, timedOut: true` even though the checkpoint almost certainly fired
      (WR-01), and the timeout path's own cleanup delete halts the machine with nothing to
      resume it and no field in the answer says so (WR-02, live-reproduced in the review). The
      underlying cleanup mechanism works; the tool's honesty about outcome and machine state
      does not.
    artifacts:
      - path: ".claude/mcp/vice/stock-run-until.ts"
        issue: >
          Lines 252-279: on ObjectMissing during cleanup, `cleanup = "already_gone"` but the
          top-level answer still asserts `reached: false` (WR-01, unfixed). No `machineHalted`
          field exists anywhere in the file (WR-02, unfixed) despite the timeout path's own
          cleanup delete provably halting the machine on stock.
    missing:
      - "WR-01: do not assert reached:false when cleanup is already_gone -- re-derive via PC read or degrade to reached:\"unknown\"."
      - "WR-02: report machineHalted:true (and a resume hint) after the timeout cleanup delete, or resume once after cleanup."
  - truth: "vice_diagnose distinguishes, on the stock backend, an emulator that is genuinely wedged from one stopped at the user's own checkpoint, one that crashed and respawned, one merely paused, AND one whose binary monitor is already held by another client."
    status: partial
    reason: >
      All five verdicts (restarted, checkpoint_trap, wedged, monitor_held_elsewhere, live) are
      implemented and unit-tested (stock-diagnose.test.ts, 25/25). But this whole path is gated
      behind the same ensureStockSession()->stockConnect() seam CR-01 breaks: on genuine VICE
      3.10, handleDiagnoseStock()'s session-acquisition catch block (stock-diagnose.ts:604) is
      reached with a StockFramingError, which is neither MonitorOwnershipError nor
      MachineRestartedError, so it falls through to a generic
      `diagnoseErrorResult("vice_diagnose: session acquisition failed (...)")` -- not one of the
      five documented verdicts, and not actionable via the wedge-triage table (the caller gets a
      raw protocol-decode message, not a triage answer). Additionally, WR-03 (unfixed, verified
      in current code at stock-diagnose.ts:640-648) means the checkpoint_trap verdict reports
      `machinePaused: false` when the machine is in fact paused (every wire read in
      gatherStockCheckpointTrapEvidence halts it). 07-VALIDATION.md's own Manual-Only table
      marks checkpoint_trap/wedged/restarted as NOT exercised live (only "live" was), so this
      truth is unit-verified but not fully live-verified even setting CR-01 aside.
    artifacts:
      - path: ".claude/mcp/vice/stock-diagnose.ts"
        issue: >
          machinePaused:false hand-passed on the checkpoint_trap path (line ~648) despite the
          machine being paused by that path's own evidence-gathering reads (WR-03, unfixed).
          Session-acquisition failures that are neither MonitorOwnershipError nor
          MachineRestartedError (including CR-01's StockFramingError) fall through to a generic
          error result rather than a named verdict.
      - path: ".claude/mcp/vice/tools-manifest.stock.json / vice-proxy.ts"
        issue: >
          WR-07 (unfixed, confirmed at vice-proxy.ts:3191-3192): `tools[DIAGNOSE_TOOL.name]` and
          `tools[RECYCLE_TOOL.name]` are overwritten by the fork's synthetic tool definitions
          after the manifest loop runs, so the advertised stock vice_diagnose schema still lists
          "stale_read_path" (a verdict stock cannot produce) and omits
          "monitor_held_elsewhere" (one it can). An agent reading the tool's own schema on stock
          -- exactly what SKILL.md tells it to do -- sees the wrong contract.
    missing:
      - "WR-03: derive machinePaused from observed run-state rather than a hand-passed boolean."
      - "A sixth, explicit outcome (or documented fallback) for 'session acquisition failed for a reason that is not one of the five verdicts' so a CR-01-class failure doesn't surface as an opaque protocol error."
      - "WR-07: make the manifest overwrite backend-aware so stock's corrected description/outputSchema actually reaches tools/list."
  - truth: "vice-wedge-triage's documented opening move works on stock rather than returning fork HTTP failure text."
    status: partial
    reason: >
      handleDiagnoseStock() does not literally return fork HTTP failure text -- it returns a
      graceful, backend-appropriate error object even when the underlying connect throws. But on
      genuine VICE 3.10 the "opening move" (call vice_diagnose first, per SKILL.md line 33)
      returns "vice_diagnose: session acquisition failed (StockFramingError: response type 0x86
      body is 52 byte(s), needs at least 65)" -- a raw protocol decode message with zero triage
      value, not one of the five states the skill's own table lists, and not something the
      skill's guidance tells the user how to act on. SKILL.md itself (lines 90, 143) claims the
      live/reached/timeout behaviors were "live-confirmed against genuine stock VICE 3.9 and
      VICE 3.10" -- a claim this verification's live reproduction directly contradicts for the
      connect step every one of those calls depends on.
    artifacts:
      - path: ".claude/skills/vice-wedge-triage/SKILL.md"
        issue: >
          Lines 90 and 143 claim live confirmation against VICE 3.10 for behaviors that require
          a successful stock connect, which this verification shows fails unconditionally on a
          genuine 3.10 build via CR-01.
    missing:
      - "Fix CR-01 first (see gap 1) -- everything in this gap is downstream of the same root cause."
deferred: []
human_verification:
  - test: "Induce a real wedge (two consecutive zero-cycle brackets) and a real kill-and-respawn on the stock backend, and confirm vice_diagnose answers wedged / restarted respectively."
    expected: "vice_diagnose returns the correct verdict for each induced state."
    why_human: "07-VALIDATION.md's own Manual-Only Verifications table records these two live states as not yet exercised (only checkpoint_trap and restarted's epoch-comparison path are unit-tested, not live-triggered); requires a deliberate, longer live session to force a genuine wedge and a genuine broker-mediated respawn."
  - test: "Open a second binary-monitor client against the same stock instance while vice_diagnose is mid-call, on a build unaffected by CR-01 (VICE 3.9), and confirm monitor_held_elsewhere is returned within its bound rather than hanging."
    expected: "vice_diagnose returns verdict monitor_held_elsewhere within diagnoseSessionTimeoutMs, not an indefinite hang."
    why_human: "Requires two real concurrent broker-mediated sessions against a live emulator; the review's own live pass only confirmed the raw-socket-level fact (a second connect() sits unserviced), not the broker-mediated end-to-end verdict."
---

# Phase 7: Cycle Timing and Wedge Triage Verification Report

**Phase Goal:** "How long did that take" and "is the emulator still advancing" work on the stock backend
**Verified:** 2026-08-18
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can measure elapsed cycles on the stock backend; unmeasurable brackets say so, never `0` | ✗ FAILED | Live-reproduced: `stockConnect()` throws `StockFramingError` before any session exists, on genuine VICE 3.10 (`/usr/local/bin/x64sc`). Works only on VICE 3.9. See gap 1. |
| 2 | User can run to an exact address, with temporary-checkpoint cleanup on hit, timeout, or restart | ⚠️ PARTIAL | Mechanism (temporary checkpoint + single delete + ObjectMissing tolerance) is real and unit-tested, but (a) only reachable on VICE 3.9 due to gap 1's blast radius, and (b) the tool misreports outcome/machine-state on the timeout path (WR-01, WR-02, unfixed). |
| 3 | `vice_diagnose` distinguishes wedged / checkpoint-trap / restarted / paused / monitor-held-elsewhere on stock | ⚠️ PARTIAL | All five verdicts implemented and unit-tested; blocked entirely on VICE 3.10 by gap 1 (falls through to a generic, non-actionable error, not a verdict); `machinePaused` misreported on the `checkpoint_trap` verdict (WR-03, unfixed); manifest schema still advertises the fork's verdict vocabulary (WR-07, unfixed); 3 of 5 verdicts never exercised live per the phase's own validation doc. |
| 4 | `vice-wedge-triage`'s opening move works on stock, not fork HTTP failure text | ⚠️ PARTIAL | Technically not literal "fork HTTP failure text" — a graceful stock-side error object is returned — but on VICE 3.10 it is an opaque protocol-decode message with no triage value, none of the five documented states, and SKILL.md's own "live-confirmed against ... VICE 3.10" claims (lines 90, 143) are contradicted by this verification. |

**Score:** 1/4 truths fully verified (0 fully verified as stated; truth 1 is FAILED outright, truths 2-4 are PARTIAL/gated by the same root cause). Rounding to the stricter of the two conventions this report uses **1/4** to reflect that only a narrowed, VICE-3.9-only version of the phase goal is currently true.

### Root-Cause Note

All four gaps trace to one place: `probeCpuHistory()` in `.claude/mcp/vice/stock-connect.ts`
only classifies `StockProtocolError`, not `StockFramingError`, and the `CPUHISTORY_GET`
per-entry parser it calls (`stock-protocol.ts`) is known-wrong for real VICE ≥ 3.10 replies
(documented by the phase's own `deferred-items.md`, live-reproduced independently in
`07-REVIEW.md` as CR-01, and **re-reproduced independently in this verification** using this
tree's own `stockConnect()` against a genuine, unmodified `/usr/local/bin/x64sc` VICE 3.10:

```
CONNECT FAILED: StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65
```

Fixing this one function (CR-01's suggested fix: also catch `StockFramingError` and answer a
capability value instead of rethrowing) unblocks all four truths for connectivity purposes,
though gaps 2-4's secondary defects (WR-01, WR-02, WR-03, WR-07) remain separately open.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/stock-connect.ts` | `probeCpuHistory()` never fails the whole handshake on any wire outcome | ✗ STUB-LIKE (functional for pre-3.10, fatal for compliant ≥3.10) | Only catches `StockProtocolError`; `StockFramingError` from a real ≥3.10 reply rethrows and fails `stockConnect()` |
| `.claude/mcp/vice/stock-protocol.ts` | `CPUHISTORY_GET` parser decodes real wire replies | ✗ WRONG LAYOUT | 52-byte real reply vs. 65-byte minimum the parser requires (deferred-items.md, re-confirmed) |
| `.claude/mcp/vice/stock-run-until.ts` | Exact-address run with correct cleanup reporting | ⚠️ PARTIAL | Cleanup mechanism correct; outcome/machine-state reporting wrong (WR-01, WR-02) |
| `.claude/mcp/vice/stock-diagnose.ts` | Five-verdict triage | ⚠️ PARTIAL | Verdicts implemented; `machinePaused` wrong on one verdict (WR-03); non-verdict failures (CR-01-class) fall through to opaque error |
| `.claude/mcp/vice/stock-recycle.ts` | Incident-record-before-RPC ordering | ✓ VERIFIED (unit + ordering test) | Not directly implicated in the live-reproduced blocker; scope of this verification did not re-litigate |
| `.claude/skills/vice-wedge-triage/SKILL.md` | Documents stock's opening move and five-state table | ⚠️ PARTIAL | Correct content, but makes VICE-3.10 "live-confirmed" claims this verification contradicts |
| `docs/stock-vice-parity.md` | Accurate divergence/gain record | ✗ FALSE CLAIM (lines 349-352) | Still claims "live-confirmed against ... VICE 3.10.0.0" resolving to `"available"` — contradicted live |
| `.claude/mcp/vice/tools-manifest.stock.json` + `vice-proxy.ts` | Backend-correct advertised schema for `vice_diagnose`/`vice_recycle` | ✗ SHADOWED (WR-07) | Manifest entries overwritten by fork's synthetic `DIAGNOSE_TOOL`/`RECYCLE_TOOL` definitions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-dispatch.ts: ensureStockSession()` | `stock-connect.ts: stockConnect()` | direct call | WIRED but FAILS ON 3.10 | Confirmed by direct read (`stock-dispatch.ts:236` calls into `stockConnect()`) and by live reproduction |
| `stock-connect.ts: resolveCapabilities()` | `stock-connect.ts: probeCpuHistory()` | direct call, no try/catch at call site | WIRED, UNGUARDED | `resolveCapabilities()` (line 163) has no try/catch around `probeCpuHistory()`; any thrown error propagates to `stockConnect()`'s own top-level try/catch, which treats it as fatal |
| `stock-diagnose.ts: handleDiagnoseStock()` | `stock-dispatch.ts: ensureStockSession()` | `Promise.race` against a timeout | WIRED | Confirmed; catches `MonitorOwnershipError`/`MachineRestartedError` by name but not `StockFramingError`, which falls to generic error text |
| `vice-proxy.ts` tool registration | `tools-manifest.stock.json` | name-keyed object assignment | PARTIAL (WR-07) | Registration order means `DIAGNOSE_TOOL`/`RECYCLE_TOOL` overwrite the stock-specific manifest entries |

### Behavioral Spot-Checks / Live Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `stockConnect()` against genuine VICE 3.10 (`/usr/local/bin/x64sc -default -binarymonitor`) | Custom script calling this tree's `stockConnect()` with a mocked `brokerControl`, `deps: {}` | `CONNECT FAILED: StockFramingError \| response type 0x86 body is 52 byte(s), needs at least 65` | ✗ FAIL (confirms gap 1 / CR-01, independently reproduced) |
| `stockConnect()` against genuine VICE 3.9 (`/usr/bin/x64sc -default -binarymonitor`) | Same script, port pointed at the 3.9 instance | `CONNECT OK: {"cpuHistory":"absent"}` | ✓ PASS (confirms Route B path is reachable on pre-3.10 builds) |
| Raw `PING` against the same 3.9 instance | Direct `ViceMonitorClient` script | `PING reply` decoded, connection healthy | ✓ PASS (control — proves the 3.9 instance itself is healthy and reachable) |

Both live emulators were freshly launched for this verification and cleanly terminated afterward
(`pkill -9 -f x64sc`); no stray processes were left running.

### Requirements Coverage

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
|--------------|-----------------|--------------------------------|--------|----------|
| TIME-01 | 07-01, 07-02, 07-04, 07-05, 07-08, 07-10 | "User can measure elapsed CPU cycles on the stock backend, on any supported VICE version" | ✗ BLOCKED | REQUIREMENTS.md marks this "Complete" — contradicted by live reproduction on VICE 3.10, a version the description explicitly claims to cover ("any supported VICE version") and one CLAUDE.md itself names as a supported/official build |
| TIME-02 | 07-03, 07-08, 07-10 | "User can run until an address is reached, exactly" | ⚠️ PARTIAL | Mechanism correct on VICE 3.9 only (gated by TIME-01's same root cause); reporting-honesty defects unfixed (WR-01, WR-02) |
| TIME-03 | 07-03, 07-05, 07-08, 07-10 | "Cycle-bounded execution is either supported or reports its approximation honestly" | ⚠️ PARTIAL | Route B's wraparound refusal live-confirmed on 3.9 (never fabricates a number); Route A unusable on any build where it would matter (3.10+) due to the same decode defect |
| TIME-04 | 07-04, 07-06, 07-07, 07-09, 07-10 | "`vice-wedge-triage`'s 'is the emulator advancing' check works on the stock backend" | ⚠️ PARTIAL | Implemented and unit-tested; gated by TIME-01's root cause on 3.10; `machinePaused`/manifest-schema defects unfixed on any build |

**No orphaned requirements found** — `.planning/REQUIREMENTS.md`'s "Phase 7" row maps exactly
TIME-01 through TIME-04, and every one of the 10 plans in this phase declares a subset of that
same set in its `requirements:` frontmatter. **However, all four "Complete" markings in
REQUIREMENTS.md are not justified by the current codebase state** and should be reverted to
reflect the gaps above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.claude/mcp/vice/stock-connect.ts` | 117-133 | Incomplete error-class handling (`StockFramingError` not caught) | 🛑 BLOCKER | Fails the entire stock handshake on genuine VICE ≥ 3.10 (CR-01, unfixed, independently reproduced) |
| `.claude/mcp/vice/stock-protocol.ts` | 1414-1447 | Wire-layout comment claims "confirmed" against source it demonstrably does not match | 🛑 BLOCKER (root cause of above) | Misleads future readers into trusting a disproven layout (WR-13, unfixed) |
| `.claude/mcp/vice/stock-protocol.ts` | 1455-1461 | `RESOURCE_GET` integer branch reads 4 bytes behind a 2-byte guard | ⚠️ WARNING | `RangeError` escapes `parseResponse()` on wire-controlled short `size` (CR-02, unfixed, not re-tested live this pass but confirmed present by direct read) |
| `.claude/mcp/vice/stock-run-until.ts` | 252-279 | `reached: false` asserted despite near-proof of a race hit; no `machineHalted` field | ⚠️ WARNING | Caller told the address was never reached when it likely was, and not told the machine is now frozen (WR-01/WR-02, unfixed) |
| `.claude/mcp/vice/stock-diagnose.ts` | 640-648 | Hand-passed `machinePaused: false` on a path that provably paused the machine | ⚠️ WARNING | Evidence field lies to the consumer deciding whether to resume/step (WR-03, unfixed) |
| `.claude/mcp/vice/vice-proxy.ts` | 3191-3192 | Manifest entry overwritten by fork-only synthetic tool definition | ⚠️ WARNING | Advertised stock schema for `vice_diagnose`/`vice_recycle` is wrong (WR-07, unfixed) |
| `docs/stock-vice-parity.md` | 349-352 | Claims a live-confirmed result that this verification's own live reproduction disproves | 🛑 BLOCKER (documentation integrity) | Directly contradicts CR-01; a future reader would trust a false "resolved" claim |
| `.claude/skills/vice-wedge-triage/SKILL.md` | 90, 143 | Claims "live-confirmed against genuine stock VICE 3.9 and VICE 3.10" for behaviors gated by the broken connect path | ⚠️ WARNING | Overstates verification depth; the connect prerequisite for these claims is proven broken on 3.10 |

No `TBD`/`FIXME`/`XXX` debt markers found in the phase's touched files (`stock-connect.ts`,
`stock-protocol.ts`, `stock-timing.ts`, `stock-run-until.ts`, `stock-diagnose.ts`,
`stock-recycle.ts`, `stock-dispatch.ts`) — the debt-marker gate itself is not triggered, but the
functional and documentation defects above are.

### Human Verification Required

See `human_verification` in frontmatter — inducing a genuine wedge/respawn live, and proving
`monitor_held_elsewhere` end-to-end through the broker with two real concurrent sessions, both
require a longer deliberate live session than this verification pass's scope.

### Gaps Summary

Phase 7 shipped substantial, well-tested code (354 unit tests green, four new stock tools, a
corrected skill and parity doc) but the one fix this phase itself identified as its own
**Wave-0 blocking prerequisite** — "a stock connect handshake against a real VICE ≥ 3.10 build
completes instead of throwing out of `resolveCapabilities()`" (07-01's own must-have truth) —
does not hold. It was fixed for the specific `InvalidParameter` (0x81) refusal a pre-3.10 build
sends, but the same probe change (`count=0` → `count=1`) opened a new, more severe failure mode
on any build that actually *supports* the opcode: the real reply cannot be decoded, and that
decode failure is not classified as a capability answer, so it kills the entire handshake. This
was found once already, live, in `07-REVIEW.md` (CR-01) with a documented fix; it remains
unfixed in the current tree, and this verification independently reproduced it from a clean
process against a freshly-launched, genuine, unmodified `/usr/local/bin/x64sc` (VICE 3.10).

The practical consequence: on any VICE build that actually implements the opcode this milestone
is built around, **every** stock tool — not just the stopwatch — refuses to work. On VICE 3.9
(no `CPUHISTORY_GET` at all) the backend is genuinely usable, and Route B's stopwatch,
`vice_run_until`'s cleanup mechanism, and `vice_diagnose`'s `live` verdict all live-check out —
but three further unfixed WARNING-level defects (`WR-01`, `WR-02`, `WR-03`) mean even the
working path over- and under-reports what actually happened. `docs/stock-vice-parity.md` and
`vice-wedge-triage/SKILL.md` both contain claims of live-confirmed VICE-3.10 success that this
verification's own reproduction disproves.

Recommend a dedicated gap-closure plan that: (1) applies CR-01's fix (catch
`StockFramingError` in `probeCpuHistory()`, answer a capability value, never rethrow), (2)
re-derives the real `CPUHISTORY_GET` per-entry wire layout from a genuine ≥3.10 build so Route A
actually decodes, (3) applies CR-02's fix to the `RESOURCE_GET` integer-branch guard, (4) fixes
WR-01/WR-02/WR-03/WR-07, and (5) corrects the two now-false "live-confirmed" claims in
`docs/stock-vice-parity.md` and `SKILL.md` before `REQUIREMENTS.md`'s TIME-01..04 rows are
re-marked Complete.

---

_Verified: 2026-08-18_
_Verifier: Claude (gsd-verifier)_
