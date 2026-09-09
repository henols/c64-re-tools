---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 04
subsystem: protocol
tags: [vice, vice_diagnose, channel-lock, contention, wedge-triage, stock-backend, chan-05]

requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: "plan 41-02's channel-lock.ts (tryAcquireChannelLock(), currentChannelLockHolder(), the ChannelLockHolder record) -- this plan's whole guard and evidence derivation reads it, never re-derives it"
provides:
  - "stock-diagnose.ts: StockChannelContention + channelContentionFor(), always-present evidence.channelContention on every vice_diagnose verdict, on the identical derive-once-and-spread shape jamObserved already established (D-09)"
  - "handleDiagnoseStock() step 4: a tryAcquireChannelLock() guard placed before the first liveness bracket, making wedged structurally unreachable while a foreign hold is live -- a foreign hold short-circuits to verdict live with bracketsRun:0 and no bracket run at all (D-10, D-11)"
  - "tools-manifest.stock.json: vice_diagnose's evidence gains channelContention in both properties and required, alongside jamObserved"
  - "vice-wedge-triage/SKILL.md: the contention row, the evidence.channelContention section, and a MEDIUM provenance row honest about its single-binary (/usr/bin/x64sc, VICE 3.9) basis"
  - "text-monitor-live.test.ts: CHAN-05's live proof -- a real text-channel hold read as contention by a concurrent vice_diagnose, then a real bracket once released"
affects: [41-05, 41-06]

actuals:
  tokens: 13360
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Always-present, never-conditionally-omitted evidence field, derived once per call and spread into evidence -- jamObserved's own shape, reused verbatim for channelContention"
    - "A structural code guard (tryAcquireChannelLock() before the only resuming step) making one verdict path (wedged) unreachable under a specific evidence condition, deliberately stronger than jamObserved's prose-only qualification -- documented in-code as a permanent asymmetry, not an inconsistency to 'fix' later"
    - "A JSON-Schema property that can be genuinely two different runtime types (string/number when held, null when not) omits \"type\" entirely rather than expressing a nullable union checkAgainstSchema() cannot represent -- vice_checkpoint_set_condition.condition's own precedent, reused for four fields at once"

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-diagnose.ts
    - src/mcp/vice/stock-diagnose.test.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/text-monitor-live.test.ts
    - src/skills/vice-wedge-triage/SKILL.md

key-decisions:
  - "The four nullable channelContention detail fields (channel/operation/grantId/heldMs) omit \"type\" in the manifest schema rather than declaring string/number -- a literal typed declaration would fail stock-dispatch.ts's own real conformance test (checkAgainstSchema() rejects null against a declared \"string\"/\"number\" type), since the shipped checkpoint_trap conformance case genuinely answers held:false with all four fields null. Presence is still enforced via the parent evidence.required and channelContention's own required array; only the per-field type check is omitted, following this manifest's own established precedent for a field whose runtime type is not fixed."
  - "\"description\" is not a supported stock-schema-check.ts keyword -- an early draft added per-field descriptions inside the outputSchema itself, which checkAgainstSchema() reports as an unsupported-keyword violation (SUPPORTED_KEYWORDS has no \"description\" entry). Caught by running the real conformance suite before committing; the explanatory prose lives entirely in the tool-level description instead, which is never schema-checked."
  - "diagnoseVerdictResult() gained a fifth, defaulted `self: ChannelLockHandle | null = null` parameter rather than a second derivation function -- every pre-guard verdict (restarted, checkpoint_trap, monitor_held_elsewhere) needs no call-site change at all, and only the three step-4 call sites (both live-bracket-advances answers and wedged) pass the guard's own handle so channelContentionFor() can tell \"I hold this myself\" from \"a foreign hold is live\"."
  - "channelContentionNote() is appended universally in diagnoseVerdictResult() (like JAM_OBSERVED_NOTE), not only from the guard's own contended-live report -- contention is evidence cutting across all five verdicts, so a foreign hold observed while answering e.g. checkpoint_trap gets the same note. renderStockContendedReport() is still written to read completely on its own, in case the note is ever stripped."

requirements-completed: [CHAN-05]

coverage:
  - id: D1
    description: "vice_diagnose always carries evidence.channelContention on every verdict it can produce, never conditionally omitted"
    requirement: "CHAN-05"
    verification:
      - kind: unit
        ref: "stock-diagnose.test.ts (65/65, +10 new cases): presence on checkpoint_trap/restarted(x2)/monitor_held_elsewhere/live/wedged including both session===null paths; held:false with all-null details and heldMs null (never 0) when nothing holds the lock; a holder with no grantId reads the literal unknown"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts#CHAN-05 (broker stopped, genuine stock /usr/bin/x64sc, 2026-09-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A foreign hold on either monitor channel answers live with bracketsRun:0 and channelContention.held:true -- no bracket is ever run while contended"
    requirement: "CHAN-05"
    verification:
      - kind: unit
        ref: "stock-diagnose.test.ts: a foreign hold on the binary channel -> live, bracketsRun 0, evidence names the holder; a foreign hold present -> zero CommandType.Exit sends"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts#CHAN-05: verdict=live, evidence.bracketsRun=0, channelContention={held:true,channel:\"text\",operation:\"device c:\"} while a real text-channel hold was live"
        status: pass
    human_judgment: false
  - id: D3
    description: "wedged is structurally unreachable while contended (guarded in code), and still reachable for a genuine uncontended double-zero -- the frozen five verdicts and the manifest verdict enum are untouched"
    requirement: "CHAN-05"
    verification:
      - kind: unit
        ref: "stock-diagnose.test.ts: with NO holder, two zero-advance brackets still answer wedged (the discriminating-power case); a bracket that throws while the handle is held still releases it; STOCK_DIAGNOSE_VERDICTS unchanged, verbatim assertion green"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts/manifest-arg-compat.test.ts/stock-schema-check.test.ts/capability-registry.test.ts (173/173): manifest verdict enum untouched, real conformance answer validates against its own schema"
        status: pass
    human_judgment: false
  - id: D4
    description: "vice-wedge-triage/SKILL.md carries the contention verdict, the evidence.channelContention section, and a MEDIUM provenance row honest about its single-binary basis, shipping in this same phase as the text-channel code"
    requirement: "CHAN-05"
    verification:
      - kind: other
        ref: "node scripts/check-skill-fork-honesty.mjs && node scripts/check-skill-description-overlap.mjs (both exit 0); node --test skill-honesty-checks.test.ts skill-description-overlap.test.ts skill-basic-trigger.test.ts (47/47)"
        status: pass
      - kind: other
        ref: "grep-verified: opening table row contains \"Never recycle\"; wedged row references channelContention; provenance row contains MEDIUM, /usr/bin/x64sc, 3.9 and not /usr/local/bin/x64sc; the channelContention section never recommends vice_recycle outside its own prohibition sentence"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-09
status: complete
---

# Phase 41 Plan 04: Contention as Evidence, Wedged Made Unreachable Summary

**A contended instance now answers `live` with `evidence.channelContention` naming the holder instead of the destructive `wedged` verdict — guarded structurally in `vice_diagnose`'s own handler, not merely warned about in prose — and `vice-wedge-triage`'s playbook and provenance table ship the fix in this same phase.**

## Performance

- **Duration:** ~50 min
- **Started:** ~2026-09-09T07:13:00Z
- **Completed:** 2026-09-09T08:02:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `stock-diagnose.ts` exports `StockChannelContention` and `channelContentionFor()`; `diagnoseVerdictResult()` derives `channelContention` on the identical always-present, derived-once, spread-unconditionally shape `jamObserved` already established, and appends a universal `channelContentionNote()` (mirroring `JAM_OBSERVED_NOTE`) whenever `held` is true, on every verdict.
- `handleDiagnoseStock()` step 4 gained a `tryAcquireChannelLock()` guard placed immediately before the first liveness bracket: on a foreign hold it short-circuits to verdict `live` with `bracketsRun: 0` and `renderStockContendedReport()`, with **no bracket run at all**; on success it holds the handle across both brackets and releases it in a `finally` covering every return from step 4 onward, so a thrown bracket still releases. `wedged` is now structurally unreachable while contended — the only route to it is through a bracket, and a bracket only runs when this call's own guard actually held the lock.
- `tools-manifest.stock.json`'s `vice_diagnose` entry gains `evidence.channelContention` (object, five required sub-fields) alongside `jamObserved` in `evidence.required`, plus a description paragraph on the same register `jamObserved`'s sentences already use. The four nullable detail fields deliberately omit a `"type"` keyword (matching `vice_checkpoint_set_condition.condition`'s own precedent) rather than declare a type `checkAgainstSchema()`'s real conformance test would then reject on the shipped checkpoint_trap fixture's genuine `null` answer.
- `stock-diagnose.test.ts` grew from 55 to 65 cases: ten new tests covering presence on every verdict path, the no-holder/nulls shape, a foreign hold's `live`/`bracketsRun:0`/holder-naming answer, zero brackets run while contended, the uncontended-double-zero discriminating-power case still answering `wedged`, an unknown-grantId holder, the contended report's forbidden-vocabulary and channel/ms-figure assertions, release-on-throw, and the manifest's `evidence.required` shape — plus the two pre-existing shape-oracle tests widened to include `channelContention` in their exact expected key sets.
- `vice-wedge-triage/SKILL.md`: a new contention row in the opening State/Cheap-tell/Safe-action table; the `live` verdict row gains a second qualifier and the `wedged` row states it is now structurally unreachable while contended; a new `### evidence.channelContention` section modelled directly on the existing `jamObserved` section, including the deliberate-asymmetry note a later reader should not "fix"; and a new Provenance row graded **MEDIUM**, honest about its single-binary (`/usr/bin/x64sc`, VICE 3.9) basis, never implying the neighbouring HIGH row's two-binary coverage.
- `text-monitor-live.test.ts` gained `CHAN-05`'s live case: with a real text-channel hold live through `withTextChannelLock()` around a real `device c:` command, a concurrent `vice_diagnose` (through the real `dispatchStock()` path) answered `verdict: live`, `evidence.bracketsRun: 0`, `evidence.channelContention.held: true`, `channel: "text"`; after release, the same call answered `channelContention.held: false` with a real bracket having run (`bracketsRun: 1`, `advanced: true`).

## Task Commits

1. **Task 1: Contention as always-present evidence, and wedged made unreachable** - `b542dd24` (feat)
2. **Task 2: Fix the playbook, and record the live signature at MEDIUM** - `3adf4f9b` (docs)

**Plan metadata:** committed separately, see the `docs(41-04)` commit following this file.

## Files Created/Modified

- `src/mcp/vice/stock-diagnose.ts` - `StockChannelContention`, `channelContentionFor()`, `channelContentionNote()`, `renderStockContendedReport()`, the step-4 guard, `diagnoseVerdictResult()`'s new `self` parameter
- `src/mcp/vice/stock-diagnose.test.ts` - 10 new cases (65 total, was 55); two shape-oracle assertions widened
- `src/mcp/vice/tools-manifest.stock.json` - `vice_diagnose`'s `evidence.channelContention` (properties + required), description paragraph
- `src/mcp/vice/text-monitor-live.test.ts` - `CHAN-05`'s live proof (MEASURED against genuine stock `/usr/bin/x64sc`)
- `src/skills/vice-wedge-triage/SKILL.md` - contention row, `evidence.channelContention` section, MEDIUM provenance row

## Decisions Made

- The four nullable `channelContention` detail fields omit `"type"` in the manifest schema (matching `vice_checkpoint_set_condition.condition`'s established precedent) rather than declaring `string`/`number`, because `checkAgainstSchema()`'s real conformance test genuinely answers `held:false` with all-null details on the shipped `checkpoint_trap` fixture, and a literal type declaration would reject that true answer.
- "description" is not a `stock-schema-check.ts`-supported keyword — an early draft that added per-field descriptions inside the `outputSchema` itself was caught by the real conformance suite before committing and moved into the tool-level description only.
- `diagnoseVerdictResult()` gained a defaulted `self: ChannelLockHandle | null = null` parameter instead of a second derivation function, so every pre-guard verdict needs zero call-site changes.
- `channelContentionNote()` is appended universally (like `JAM_OBSERVED_NOTE`), not only on the guard's own contended-live path, since contention is evidence cutting across all five verdicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The manifest schema's per-field "description" keyword would have broken the real conformance test**
- **Found during:** Task 1, before running the four manifest-shape gates
- **Issue:** An initial draft of `channelContention`'s manifest sub-schema added `"description"` on the object and its four detail properties. `stock-schema-check.ts`'s `SUPPORTED_KEYWORDS` set does not include `"description"`, so `checkAgainstSchema()` would report it as an unsupported-keyword violation the instant it walked that sub-schema — breaking both the self-consistency test (`stock-dispatch.test.ts`'s "every outputSchema itself uses only checkAgainstSchema's supported keyword subset") and the real `vice_diagnose` conformance test.
- **Fix:** Removed all nested `"description"` keys from the schema; the explanatory prose was added to the tool-level description paragraph instead, which is never schema-checked.
- **Files modified:** `src/mcp/vice/tools-manifest.stock.json`
- **Verification:** `node --test stock-dispatch.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts capability-registry.test.ts` — 173/173 pass.
- **Committed in:** `b542dd24` (Task 1 commit)

**2. [Rule 1 - Bug] Declaring the four nullable detail fields typed (`string`/`number`) would have broken the real conformance test**
- **Found during:** Task 1, reasoning through the plan's own literal "typed boolean, string, string, string, number" instruction against the shipped `checkpoint_trap` conformance fixture
- **Issue:** The plan's action text suggested typing `channel`/`operation`/`grantId`/`heldMs` as `string`/`string`/`string`/`number`. The real `vice_diagnose` conformance test (`stock-dispatch.test.ts`) drives the `checkpoint_trap` path, which never touches `channel-lock.ts` and therefore answers `channelContention.held: false` with all four detail fields genuinely `null` — `checkAgainstSchema()` would reject `null` against a declared `"string"`/`"number"` type.
- **Fix:** Followed this manifest's own established precedent (`vice_checkpoint_set_condition.condition`) of omitting the `"type"` keyword entirely for a field whose runtime type is not fixed, while keeping all five fields in `channelContention`'s own `required` array so presence is still enforced at the schema level.
- **Files modified:** `src/mcp/vice/tools-manifest.stock.json`
- **Verification:** `node --test stock-dispatch.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts capability-registry.test.ts` — 173/173 pass, including the real `vice_diagnose` conformance case.
- **Committed in:** `b542dd24` (Task 1 commit)

**3. [Rule 1 - Bug] A TypeScript closure-narrowing false positive on the CHAN-05 live test**
- **Found during:** Task 2, `npm run typecheck` after adding the new live test
- **Issue:** `let diagnoseDuringHold: Record<string, unknown> | null = null;` assigned inside a nested async callback passed to `withTextChannelLock()`, then read after the `await`, produced three `tsc` errors (`Property does not exist on type 'never'`) — TypeScript's control-flow narrowing does not track a `let` reassignment made inside a captured closure the same way as a same-scope assignment.
- **Fix:** Returned the parsed payload from the `withTextChannelLock()` callback directly (`const diagnoseDuringHold = await withTextChannelLock(...)`) instead of assigning an outer `let`, eliminating the narrowing hazard entirely.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** `npm run typecheck` clean.
- **Committed in:** `3adf4f9b` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 schema-shape bugs caught before the manifest-shape gates ran, 1 TypeScript narrowing fix). **Impact on plan:** All three were necessary for the plan's own stated verification to pass; none expanded scope beyond `CHAN-05`.

## Issues Encountered

- **`npm run test:automated`'s measured floor is 3 failures, not the plan's stated "2-failure baseline".** Two full runs during this plan's own verification (one for Task 1, one for Task 2) both landed at exactly 3 failures, all confined to `anno-register.test.ts` (`annoRegisterEntryFor()`, `DIRECTION 5`, the planted-violation negative control) — none touching any file this plan modified. This exactly matches plan **41-02**'s own SUMMARY, which measured and documented this same 3-failure signature earlier in this same phase ("final two consecutive runs both landed exactly at 3 failures, confined to `anno-register.test.ts`/`anno-import.test.ts`'s documented pre-existing baseline"). Treated as the current pre-existing floor, consistent with 41-02's own precedent, not a regression introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CHAN-05` is closed. `vice_diagnose` and `vice-wedge-triage` both ship the contention fix in this same phase, satisfying the ROADMAP's own "`CHAN-05`-ships-with-the-code" rule.
- The five-verdict enum and the manifest's verdict enum are both untouched and remain frozen.
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All modified files confirmed present via `[ -f ]`: `stock-diagnose.ts`, `stock-diagnose.test.ts`, `tools-manifest.stock.json`, `text-monitor-live.test.ts`, `SKILL.md`.
- Both task commits (`b542dd24`, `3adf4f9b`) confirmed present via `git log --oneline --all`.
- `npm run typecheck` clean.
- `node --test stock-diagnose.test.ts` — 65/65 pass (>= 65 required).
- `node --test stock-dispatch.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts capability-registry.test.ts` — 173/173 pass.
- `node scripts/check-skill-fork-honesty.mjs && node scripts/check-skill-description-overlap.mjs` — both exit 0.
- `node --test skill-honesty-checks.test.ts skill-description-overlap.test.ts skill-basic-trigger.test.ts` — 47/47 pass.
- `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` — 5/5 pass, 0 skipped, broker/x64sc confirmed stopped beforehand.
- `npm run test:automated` — two consecutive runs both landed at exactly 3 failures, confined to `anno-register.test.ts`'s documented pre-existing baseline (matching plan 41-02's own measurement).
- No unexpected deletions in either task commit (`git diff --diff-filter=D --name-only` empty for both).
