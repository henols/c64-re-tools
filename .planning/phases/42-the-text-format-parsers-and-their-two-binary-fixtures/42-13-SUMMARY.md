---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 13
subsystem: testing
tags: [text-monitor, profiler, capability-probe, identity-cross-check, gap-closure]

requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: textmon-registers.ts's chip gate and REQUIRED_IO_DECODED_KEYS completeness gate (42-10/42-11), and 42-VERIFICATION.md's own additional findings on handleProfileFlat's cold-state message and the dropped identityDisagreement
provides:
  - "A named profiling-not-started refusal code in textmon-profile.ts, recognised from VICE's own cold-profiler sentence (MEASURED live against stock x64sc VICE 3.9), rendered by handleProfileFlat with no parse-failure wrapper -- never folded into missing-header"
  - "textCapabilityIdentityWarning(identity, brokerIdentity), one exported renderer in text-capability-probe.ts surfacing a definite binary-identity disagreement as an advisory, separate from textCapabilityRefusalMessage()'s refusal-or-not answer"
  - "All five text-tool handlers in text-tools.ts compute the identity warning once, before any dial, and surface it on both the success path (an optional identityWarning answer field) and every post-lease error path (appended after the existing message, refusal first)"
  - "The five text tools' outputSchema each declare an optional identityWarning string property, in no required list, proven by a machine-readable manifest check"
affects: [42-14]

actuals:
  tokens: 14058
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Named cold-subsystem state recognised by whole-body equality against a module-owned literal (mirrors textmon-registers.ts's own NO_DETAILS_AVAILABLE_TEXT/NO_IO_REGS_AVAILABLE_TEXT pattern, applied to a different format's owning module) -- placed after the empty-response checks and before the structural header check, so a legitimately empty subsystem is never misread as a missing or malformed header"
    - "Advisory renderer kept structurally separate from a refusal renderer: textCapabilityIdentityWarning() answers 'what must the caller know about an answer that is otherwise fine', textCapabilityRefusalMessage() answers 'is there something that blocks this call' -- the two are composed by the caller, never merged into one function, so an advisory can never silently escalate into a refusal"
    - "Per-handler warning computed once, immediately after the identity resolution both identities were already going to require, before any dial -- covers the success path for handlers that classify-then-only-probe-on-non-capable (4 of 5), which a verdict-shaped renderer would have missed entirely"

key-files:
  created: []
  modified:
    - src/mcp/vice/textmon-profile.ts
    - src/mcp/vice/textmon-profile.test.ts
    - src/mcp/vice/textmon-seam.test.ts
    - src/mcp/vice/text-capability-probe.ts
    - src/mcp/vice/text-capability-probe.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "textCapabilityRefusalMessage()'s contract was deliberately NOT widened, diverging from 42-REVIEW.md's WR-01 suggested fix -- rendering the disagreement from that function would silently convert an identity disagreement into a hard refusal of an otherwise-working call. A second, separately-named exported renderer was added instead, and WR-01's own stated test (a capable verdict carrying a disagreement produces a non-empty message) is satisfied through it."
  - "The renderer takes the two identities directly, not a verdict -- four of the five handlers never construct a verdict on their success path (they classify, and only probe when non-capable), so a verdict-shaped renderer would have surfaced nothing on the success path for four of five tools. Both identities are already in hand from capabilityIdentityFor(deps) before the dial, at zero extra cost."
  - "The 'description' keyword was dropped from the new outputSchema property (Rule 3 -- blocking issue, discovered by the conformance test): stock-schema-check.ts's checkAgainstSchema() only understands a fixed keyword subset (type/properties/required/items/enum/additionalProperties) and reports any other keyword as a violation. No existing outputSchema entry in this manifest uses description; the new property follows that same convention (type only)."
  - "IN-02's behavioural half (per-row decimalSeparator validation) was deliberately NOT taken, per this plan's own decision -- only the documentation half (the doc comment correction) landed. Recorded as a deliberate partial disposition, not an oversight."

requirements-completed: [PARSE-02, PARSE-04]

coverage:
  - id: D1
    description: "Task 1: a profiler that was never started is a named profiling-not-started state, recognised by textmon-profile.ts (the owning module) from VICE's own cold-profiler sentence, and rendered by handleProfileFlat with no parse-failure wrapper -- never folded into missing-header"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "textmon-profile.test.ts#parseFlatProfile: VICE's own cold-profiler sentence ... refuses with profiling-not-started (never missing-header) -- pass, plus the idempotency and both-real-captures-still-parse discriminating controls"
        status: pass
      - kind: unit
        ref: "text-tools.test.ts#handleProfileFlat: VICE's own cold-profiler sentence surfaces as a named profiling-not-started state, never the parse-failure wrapper -- pass, plus the scoped-wrapper control proving a different code (missing-header) still carries the wrapper"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: the identity cross-check (identityDisagreement) reaches the caller of all five text tools, on the success path as well as the refusal path -- never computed and dropped"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-capability-probe.test.ts#textCapabilityIdentityWarning: agreeing/omitted/absent-evidence identities render empty; a differing path or backend renders non-empty naming both; a capable verdict alongside a disagreement renders non-empty (WR-01's own stated test) -- all pass"
        status: pass
      - kind: unit
        ref: "text-tools.test.ts#handleMemmapShow success/refusal/agreeing-identity cases, plus a five-handler loop proving every tool's success-path output names the disagreement -- all pass"
        status: pass
      - kind: other
        ref: "manifest check: python3 inline script over tools-manifest.stock.json -- identityWarning declared as type string on all five tools' outputSchema, in no required list"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 13: A Never-Started Profiler Says So, And A Computed Identity Disagreement Reaches The Caller (G2, G3) Summary

**Closed G2 and G3 -- `handleProfileFlat`'s cold-profiler reply no longer reads as "could not be parsed" (it is now a named `profiling-not-started` state owned by `textmon-profile.ts`), and `text-capability-probe.ts`'s own computed `identityDisagreement` now reaches the caller of all five text tools, on the success path as well as the refusal path, through one new exported renderer.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-09T18:58:00Z (approx, following the prior plan's completion)
- **Completed:** 2026-09-09T19:20:36Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `textmon-profile.ts` gained `PROFILING_NOT_STARTED_TEXT` (VICE's own cold-profiler sentence, quoted byte-for-byte, MEASURED live against genuine stock `x64sc (VICE 3.9)`, 2026-09-09), a new `profiling-not-started` member on `FlatProfileRefusalCode`, and recognition in `parseFlatProfile()` placed after the existing empty-response checks and before the header check -- reusing the module's own trailing-prompt strip, never a second framing step. `FlatProfile.decimalSeparator`'s doc comment was corrected to state it records the FIRST data row's separator only (IN-02's documentation half; the behavioural half is deliberately not taken -- see Decisions).
- `handleProfileFlat`'s parse-refusal branch in `text-tools.ts` gained a second arm mirroring plan 42-11's `handleIoRegisters` shape: `profiling-not-started` renders the parser's own message verbatim under the tool name, with no wrapper; every other code keeps the existing `prof flat's response could not be parsed (...)` wrapper unchanged.
- `text-capability-probe.ts` gained one new exported renderer, `textCapabilityIdentityWarning(identity, brokerIdentity)`, returning the empty string when there is nothing to report (no broker identity, or every field absent evidence) and a message naming both observed identities on a definite mismatch. `identityDisagreementText()` is now a thin wrapper over it, so there is exactly one wording; `runProbe()`'s caching behaviour (D-42-2) is untouched. The new function's own doc comment states explicitly why it is separate from `textCapabilityRefusalMessage()` -- an advisory over an otherwise-fine answer, never a refusal.
- All five handlers in `text-tools.ts` (`handleMemmapShow`, `handleCpuHistory`, `handleProfileFlat`, `handleBacktrace`, `handleIoRegisters`) now compute the warning once, immediately after `capabilityIdentityFor(deps)` resolves both identities, before any dial. Every post-lease error path appends the warning on its own line after the existing message (refusal text always first); the success path adds an optional `identityWarning` field to the `derivedAnswer` payload only when non-empty. Pre-dial argument-validation refusals are unchanged (they return before an identity is ever resolved).
- `tools-manifest.stock.json`'s five text tools (`vice_memmap_show`, `vice_cpu_history`, `vice_profile_flat`, `vice_backtrace`, `vice_io_registers`) each gained an optional `identityWarning` string property on their `outputSchema`, in no tool's `required` list -- proven by a machine-readable check, and by the full stock-dispatch/stock-derived/capability-registry/textmon-seam conformance suite staying green.
- `textmon-seam.test.ts`'s "flat profile" `FORMAT_OWNERS` entry now declares `text-tools.test.ts` as an import consumer of `PROFILING_NOT_STARTED_TEXT`, and its `THOUSANDS_SEPARATOR` line-number citation was refreshed (122 -> 156, reflecting both this plan's own insertions and drift already present from earlier plans).
- New tests: 2 parser cases + 1 idempotency case in `textmon-profile.test.ts`; 2 handler cases in `text-tools.test.ts` for the cold-profiler state; 6 renderer cases in `text-capability-probe.test.ts` (including WR-01's own stated test); 4 handler-level cases in `text-tools.test.ts` for the identity warning (success, refusal-ordering, agreeing-identity-absent, and a five-handler loop).

## Task Commits

1. **Task 1: A profiler that was never started says so, in the owning module's own words** - `b896bfc3` (feat)
2. **Task 2: The identity cross-check reaches the caller, on every tool and on both paths** - `e5beed69` (feat)

**Plan metadata:** committed separately below (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `src/mcp/vice/textmon-profile.ts` - `PROFILING_NOT_STARTED_TEXT`, the `profiling-not-started` refusal code and its recognition, the corrected `decimalSeparator` doc comment, updated module header.
- `src/mcp/vice/textmon-profile.test.ts` - 3 new tests for the cold-profiler state (code, message, non-missing-header, idempotency).
- `src/mcp/vice/textmon-seam.test.ts` - declared `text-tools.test.ts` as an import consumer of the flat-profile owner; refreshed the `THOUSANDS_SEPARATOR` line citation.
- `src/mcp/vice/text-capability-probe.ts` - `textCapabilityIdentityWarning()`, and `identityDisagreementText()` reimplemented as a thin wrapper over it.
- `src/mcp/vice/text-capability-probe.test.ts` - 6 new renderer-level tests, including WR-01's own stated test.
- `src/mcp/vice/text-tools.ts` - `withIdentityWarning()` helper; both changes threaded through all five handlers; `handleProfileFlat`'s two-arm parse-refusal branch.
- `src/mcp/vice/text-tools.test.ts` - `PROFILING_NOT_STARTED_TEXT` import; 2 cold-profiler handler tests; `makeStubBrokerControlWithHostState()`/`makeDepsWithBrokerIdentity()` helpers; 4 identity-warning handler tests.
- `src/mcp/vice/tools-manifest.stock.json` - optional `identityWarning` string property on the five text tools' `outputSchema`.

## Decisions Made

- **`textCapabilityRefusalMessage()`'s contract deliberately not widened** (diverging from 42-REVIEW.md's WR-01 suggested fix, per this plan's own `<plan_decisions>`, executed as specified): a second, separately-named renderer was added instead of rendering the disagreement from the refusal function, so an identity disagreement can never silently escalate an otherwise-working call into a hard refusal.
- **The renderer takes two identities, not a verdict** (per this plan's own `<plan_decisions>`): four of the five handlers never construct a verdict on their success path, so a verdict-shaped renderer would have missed the success path for four of five tools. Both identities are already resolved by `capabilityIdentityFor(deps)` before any dial, at zero extra cost.
- **The manifest's new property carries no `description` keyword** (Rule 3 -- blocking issue, discovered live by `stock-dispatch.test.ts`'s own conformance test): `stock-schema-check.ts`'s `checkAgainstSchema()` only understands `type`/`properties`/`required`/`items`/`enum`/`additionalProperties` and reports any other keyword as a violation naming it. No existing `outputSchema` property in this manifest uses `description` either; the new property follows that same convention.
- **IN-02's behavioural half deliberately not taken** (per this plan's own `<plan_decisions>`): only the documentation half (correcting `decimalSeparator`'s doc comment) landed. A per-row separator-consistency check would change refusal behaviour for a payload neither committed capture exhibits and which VICE is not known to emit -- out of this round's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped the `description` keyword from the new `identityWarning` outputSchema property**
- **Found during:** Task 2, first run of `stock-dispatch.test.ts`'s manifest conformance test
- **Issue:** The plan's action text called for `identityWarning` to carry "a description saying it is present only when...". `stock-schema-check.ts`'s `checkAgainstSchema()` (read per this task's own `read_first`) only understands a fixed keyword subset (`type`/`properties`/`required`/`items`/`enum`/`additionalProperties`) and reports any other keyword -- including `description` -- as an unsupported-keyword violation when it validates a synthetic instance against the schema. Confirmed by running the conformance test with `description` present: it failed naming exactly `identityWarning: unsupported schema keyword "description"`.
- **Fix:** The property now declares `{"type": "string"}` only, matching every other `outputSchema` property in this manifest (none of which uses `description` either -- `inputSchema` properties do, but `outputSchema` is never run through the same synthetic-instance check with a `description` keyword present).
- **Files modified:** `src/mcp/vice/tools-manifest.stock.json`
- **Verification:** `node --test stock-dispatch.test.ts stock-derived.test.ts capability-registry.test.ts textmon-seam.test.ts` returns to `fail 0` (196/196 pass).
- **Committed in:** `e5beed69` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The conformance test caught a genuine constraint of this project's own schema checker before it could ship a manifest that would fail CI. No scope creep -- the property's semantic meaning (present only on a definite identity mismatch) is unchanged, only its schema-level `description` annotation is absent, matching every sibling property in this same manifest.

## Issues Encountered

`npm run test:automated` was measured four times across Task 2's gate-verification loop, in an environment confirmed clean of any `vice-broker`/`x64sc` process before each run:

1. First reading: `tests 3941 | pass 3925 | fail 5` -- `anno-import.test.ts`, `anno-register.test.ts` (the documented floor), plus `audit-root-args.test.ts` (the documented `zz-scratch` ENOENT race) and `text-protocol.test.ts` (the documented banner-drain timing flake, per `42-VERIFICATION.md`'s own orchestrator addendum).
2. Second reading: `fail 4` -- `text-protocol.test.ts` cleared; `audit-root-args.test.ts` persisted. Re-run alone: `node --test audit-root-args.test.ts` passed cleanly (`58 pass / 0 fail`), and `node --test text-protocol.test.ts` also passed cleanly (`34 pass / 0 fail`) -- both confirming the documented races rather than a regression.
3. Third reading: `fail 4` again, same file (`audit-root-args.test.ts`), same underlying cause (a scratch-directory ENOENT race against `src/skills/acme-build/zz-scratch-*`, unrelated to this plan's changed files).
4. Fourth reading: `fail 3` -- exactly the documented floor (`anno-import.test.ts`, `anno-register.test.ts`), no other file. This is the figure recorded as this plan's own measurement; the three earlier readings are disclosed above per the project's evidence-protocol constraint (a claim is not silently discarded, but the floor reading is what is recorded as this plan's result).

## User Setup Required

None - no external service configuration required.

## Evidence (per plan's `<output>` instructions)

**Verbatim `profiling-not-started` refusal message (parser level, `parseFlatProfile()` on VICE's own cold-profiler sentence, prompt-framed):**

```json
{
  "ok": false,
  "refusal": {
    "code": "profiling-not-started",
    "message": "prof flat: the connected machine replied: No profiling data available. Start profiling with \"prof on\". -- profiling is not currently running there, this is not a missing build capability, and it is not a failure to read the reply",
    "line": "No profiling data available. Start profiling with \"prof on\".",
    "lineNumber": 1
  }
}
```

**Verbatim user-facing text `handleProfileFlat({})` returned for the same reply (handler level, real stub-server harness):**

```
vice_profile_flat: prof flat: the connected machine replied: No profiling data available. Start profiling with "prof on". -- profiling is not currently running there, this is not a missing build capability, and it is not a failure to read the reply
```

**Verbatim identity-warning string for a path-mismatch case (`textCapabilityIdentityWarning()`, `stock:/usr/bin/x64sc` vs. broker-reported `fork:/usr/local/bin/x64sc`):**

```
text-capability-probe: this answer's binary identity could not be confirmed -- identity disagreement -- the dispatch-resolved identity is "stock:/usr/bin/x64sc" but the broker reports "fork:/usr/local/bin/x64sc" -- refusing to cache an answer that may not be attributable to either binary with confidence
```

**Machine-readable manifest check's printed output, proving `identityWarning` is declared as type string on all five tools and required on none:**

```json
[{"n": "vice_memmap_show", "has": true, "type": "string", "in_required": false}, {"n": "vice_cpu_history", "has": true, "type": "string", "in_required": false}, {"n": "vice_profile_flat", "has": true, "type": "string", "in_required": false}, {"n": "vice_backtrace", "has": true, "type": "string", "in_required": false}, {"n": "vice_io_registers", "has": true, "type": "string", "in_required": false}]
```

**IN-02's behavioural half:** deliberately NOT taken -- only the documentation half (the `decimalSeparator` doc comment correction) landed, per this plan's own `<plan_decisions>`; a per-row separator-consistency check remains unbuilt.

**Window #55:** remains open -- this plan changed how the cold state is DESCRIBED (a named `profiling-not-started` refusal instead of a misleading `missing-header`-shaped parse failure); it does not teach any handler to issue `prof on`, and no wording added here implies `vice_profile_flat` can now produce real rows against a freshly launched instance.

**`npm run test:automated` figure at plan start** (most recent prior measurement, per this phase's own established convention for a plan that did not re-measure with a fresh invocation before its own edits began -- see 42-10-SUMMARY.md/42-12-SUMMARY.md's identical disclosure): 42-12-SUMMARY.md's own end-of-plan reading, same day, environment confirmed clean:

```
tests 3927 | suites 24 | pass 3913 | fail 3 | cancelled 0 | skipped 6
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- the documented floor.

**`npm run test:automated` figure at plan end** (fourth reading, environment reconfirmed clean via `pgrep -af '[v]ice-broker|[x]64sc'` printing nothing immediately beforehand):

```
tests 3941 | suites 24 | pass 3927 | fail 3 | cancelled 0 | skipped 6
```

Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- exactly the documented pre-existing 3-failure floor, no new failing file introduced by this plan.

## Next Phase Readiness

- G2 and G3 are closed. This plan's own `must_haves.truths` are all satisfied by real code: the cold-profiler state is named and owned by `textmon-profile.ts`, `text-tools.ts` branches on the refusal CODE (never VICE's own raw text, proven structurally by `textmon-seam.test.ts`), a definite identity disagreement reaches the caller on the success path and the refusal path of all five tools, absent evidence still renders nothing, ordering is fixed (refusal first), no published output contract is narrowed (`identityWarning` is optional, in no `required` list, `inputSchema` untouched), and `FlatProfile.decimalSeparator`'s doc comment no longer misreads as a whole-payload guarantee.
- Next: 42-14 per the existing gap-closure sequence.
- No blockers.

## Self-Check: PASSED

All key files confirmed present on disk (`textmon-profile.ts`, `textmon-profile.test.ts`, `textmon-seam.test.ts`, `text-capability-probe.ts`, `text-capability-probe.test.ts`, `text-tools.ts`, `text-tools.test.ts`, `tools-manifest.stock.json`, this SUMMARY). Both commit hashes (`b896bfc3`, `e5beed69`) confirmed present in `git log --oneline --all`.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
