---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 07
subsystem: mcp-tooling
tags: [vice, text-monitor, cpu-history, flat-profile, backtrace, register-decode, capability-probe, shared-tool-name, tdd]

# Dependency graph
requires:
  - phase: 42
    provides: "plan 42-01's withTextTool()/capabilityIdentityFor() precedent and D-42-3 discriminated-refusal shape; plan 42-02/42-03's textmon-cpuhistory.ts/textmon-backtrace.ts/textmon-profile.ts/textmon-registers.ts parsers; plan 42-04's buildTextCommand()/TEXT_COMMAND_PARAM_SPECS; plan 42-05's text-capability-probe.ts (classifyTextCapabilityResponse, probeTextCapability, textCapabilityRefusalMessage)"
provides:
  - "The four remaining text tools reachable end to end: vice_cpu_history, vice_profile_flat, vice_backtrace, vice_io_registers"
  - "vice_backtrace as a SHARED tool name (D-42-4) -- the stock text-monitor implementation lands under the fork's own existing tool name with a backward-compatible argument shape, verified by manifest-arg-compat.test.ts, rather than minting a second name for one capability"
  - "PARSE-04 closed end to end: all five text tools (including the plan 42-01 tracer, retrofitted here) classify a raw reply for build capability BEFORE parsing it"
affects: [42-08, 42-09]

# Actuals (#2632)
actuals:
  tokens: 19545
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "capabilityIdentityFor(): the ONE shared helper (text-tools.ts) that threads deps.resolvedBinaryPath/resolvedBinaryPathIsResolved plus a best-effort lease.brokerControl.hostState() cross-check into every text tool's capability check -- never invents or defaults an identity; a failed hostState() call (this plan's own test stub included) is absent evidence, not disagreement"
    - "classify-then-verdict per handler: each handler calls classifyTextCapabilityResponse() directly on its own dial's raw reply (literal, not funnelled through one shared branch function) to decide whether to consult probeTextCapability()'s polished, cross-checked, textCapabilityRefusalMessage()-rendered verdict -- chosen so io's own per-chip runtime degradation (invisible to the bare classifier) is still caught by always falling through to the probe module's renderer for that one verb"

key-files:
  modified:
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/stock-derived.ts
    - src/mcp/vice/stock-derived.test.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/capability-registry.ts
    - src/mcp/vice/capability-registry.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/tool-support-table.test.mjs
    - docs/tool-support.md

key-decisions:
  - "vice_backtrace's argument shape declares depth as JSON-Schema type \"number\" (not \"integer\") on the stock manifest, matching the fork's own declared type character-for-character -- manifest-arg-compat.test.ts's checker does a strict string comparison of the .type field, so \"integer\" (even though every accepted value is one) would have read as a retyping violation. Runtime validation still enforces an integer via Number.isSafeInteger; only the JSON-Schema type string had to match the fork's."
  - "The four new handlers do NOT funnel their capability check through one shared branch function -- each literally calls classifyTextCapabilityResponse() on its own line, driven by Task 3's own grep-verifiable requirement (\"one classification site per text tool that parses a reply\", >=5 lines). Identity construction IS factored into one shared helper (capabilityIdentityFor()); the classify call is not, by design."
  - "handleIoRegisters always falls through to probeTextCapability()+textCapabilityRefusalMessage() regardless of classifyTextCapabilityResponse()'s own outcome, because io is never gated behind FEATURE_CPUMEMHISTORY (classification can only ever return capable/indeterminate for it) but still degrades per-chip at runtime with its own two fixed strings -- a fact only the probe module's renderer, not the bare classifier, can see."
  - "Each parameterized handler (chis/prof flat/io) calls buildTextCommand() alone for bound validation and surfaces ITS OWN refusal message verbatim -- no handler restates the 1-65535 / 0-65535 bounds locally, so there is exactly one statement of each bound in the tree (D-42-1, inherited from plan 42-04)."
  - "handleBacktrace's depth argument is the one deliberate exception to that rule: it is a client-side projection filter over the PARSED frame list, never a wire parameter (\"bt\" takes none), so it is validated locally (1-64, matching the fork's own declared bound) rather than through buildTextCommand()."

requirements-completed: [PARSE-02, PARSE-04]

coverage:
  - id: D1
    description: "All four remaining text formats (chis/prof flat/bt/io) are reachable from a tool call and return structured, bounded, parser-ordered data; a caller-chosen count/address/depth is validated before any lease is resolved or byte written"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-tools.test.ts#handleCpuHistory/handleProfileFlat/handleBacktrace/handleIoRegisters: success cases driven from fixtures/textmon/ captures via loadTextFixture(), plus argument-refusal cases asserting no lease resolved"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#conformance (D-02): dispatchStock(\"vice_cpu_history\"/\"vice_profile_flat\"/\"vice_backtrace\"/\"vice_io_registers\", ...) answers, validating against its own declared outputSchema"
        status: pass
    human_judgment: false
  - id: D2
    description: "vice_backtrace shares the fork's existing tool name with a backward-compatible argument shape (optional numeric depth, unchanged); its capability-registry entry is removed now that the name no longer diverges between manifests"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "manifest-arg-compat.test.ts#every tool shared between the two manifests is backward-compatible"
        status: pass
      - kind: unit
        ref: "capability-registry.test.ts#plan 42-07/D-42-4: vice_backtrace has NO registry entry -- it is now a SHARED tool"
        status: pass
      - kind: unit
        ref: "capability-registry.test.ts#mechanical completeness: the registry's name set equals the manifest-derived divergence set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every one of the five text tools classifies the raw reply for build capability BEFORE parsing it -- a disabled build (memmapshow/chis) or a per-chip runtime degradation (io) is a named capability answer, never a parser refusal code; an indeterminate reply is a named state, never a silent empty success"
    requirement: "PARSE-04"
    verification:
      - kind: unit
        ref: "text-tools.test.ts#disabled-stub/chip-degradation/indeterminate cases across all five handlers (handleMemmapShow retrofit included)"
        status: pass
      - kind: unit
        ref: "grep -ac classifyTextCapabilityResponse text-tools.ts >= 5 (one classification site per text tool)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All five text tools are registered at every repo-mandated guard site, the published file set matches what shipped code imports, and docs/tool-support.md is regenerated rather than hand-edited"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "stock-derived.test.ts, hostpath-consumers.test.ts, capability-registry.test.ts, tool-support-table.test.mjs, shipped-modules.test.ts, check-npm-packages.mjs (full suite, all green)"
        status: pass
    human_judgment: false

# Metrics
duration: 96min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 07: The four remaining text-tools plus the closed capability loop Summary

**`vice_cpu_history`/`vice_profile_flat`/`vice_backtrace`/`vice_io_registers` wired end to end through `withTextTool()`, each classifying its reply for build capability (PARSE-04) before parsing, with `vice_backtrace` deliberately landed under the fork's own existing name and a backward-compatible argument shape rather than a second vocabulary for one capability.**

## Performance

- **Duration:** 96 min
- **Started:** 2026-09-09T14:13:00Z (approx, first Read call)
- **Completed:** 2026-09-09T15:49:00Z (approx)
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Four new handlers in `text-tools.ts` (`handleCpuHistory`, `handleProfileFlat`, `handleBacktrace`, `handleIoRegisters`), each an `export async function` going through `withTextTool()`: argument validation before any lease resolves, `buildTextCommand()` as the sole builder of any parameterized command string, classify-before-parse ordering, and a bounded answer that always carries its own denominator (returned/total counts, an unrecognised-lines count present even at zero).
- `handleBacktrace` reuses the fork's own `vice_backtrace` tool name (D-42-4) with a backward-compatible argument shape -- the optional numeric `depth` stays optional and stays numeric (declared as JSON-Schema `"number"`, matching the fork's own declared type exactly, not `"integer"`) -- proven by `manifest-arg-compat.test.ts`. Its former `capability-registry.ts` "descoped" entry is REMOVED now that the name is shared and no longer diverges between the two manifests; the mechanical completeness test enforces this as a relation, not a list.
- `capabilityIdentityFor()`: the one shared helper all five text tools (four new plus the plan 42-01 `handleMemmapShow` retrofit) use to attribute a capability answer to an identity -- built from `deps.resolvedBinaryPath`/`resolvedBinaryPathIsResolved`, cross-checked against the broker's own `hostState()` report when obtainable, never invented or defaulted.
- `handleMemmapShow` (plan 42-01) retrofitted with the identical classify-before-parse ordering: it was written before `text-capability-probe.ts` existed, so a disabled-stub reply previously reached `parseAccessMap()` and surfaced a parser refusal code -- exactly the "reads like a defect in this project" outcome PARSE-04 forbids.
- All five tools registered at every guard site 42-01's own SUMMARY named as its checklist: `STOCK_DERIVED_TOOLS` (+pinned-count test 16→20), the `stock-dispatch.ts` dispatch table (all `needsSession: false`), `tools-manifest.stock.json` (four new entries), `capability-registry.ts` (three new stock-only-gain entries, one descoped entry removed, both block counts and the header's own count remark updated 26→31), `hostpath-consumers.test.ts`'s `DERIVED_TOOL_MODULES` map, `package.json`'s `files[]` (the four parser modules plus `text-capability-probe.ts`), and `docs/tool-support.md` (regenerated via the generator).
- 40 new/modified tests across `text-tools.test.ts` (24 new + 2 modified) and `stock-dispatch.test.ts` (5 conformance cases + 1 STOCK_ONLY_TOOLS/D-03 fix + the corrected structural D-02 case), all green; `grep -ac "classifyTextCapabilityResponse" text-tools.ts` = 8 (five per-handler literal calls plus the import line and two doc-comment mentions).

## Task Commits

1. **Task 1: The four handlers -- validated arguments, classify before parse, bounded answers** - `da53f78c` (feat)
2. **Task 2: Registration -- six sites, the shared-name consequence, the file set, and the regenerated table** - `bfc0de68` (feat)
3. **Task 3: Close the loop -- the tracer's handler gains the capability check, and one stale claim is corrected** - `f10a9e1c` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/text-tools.ts` - Four new handlers, `capabilityIdentityFor()`, `isValidBacktraceDepthArg()`; `handleMemmapShow` retrofitted with classify-before-parse
- `src/mcp/vice/text-tools.test.ts` - 24 new tests (success/argument-refusal/disabled-stub/chip-degradation/indeterminate per new handler) + 2 modified pre-existing memmapshow tests reflecting the retrofit's new interception point
- `src/mcp/vice/stock-derived.ts`, `stock-derived.test.ts` - `STOCK_DERIVED_TOOLS` four new entries, pinned count 16→20
- `src/mcp/vice/stock-dispatch.ts` - four dispatch-table entries via `withDerivedTool(..., { needsSession: false }, ...)`
- `src/mcp/vice/stock-dispatch.test.ts` - four `conformanceTest()` cases, three `STOCK_ONLY_TOOLS` entries, the D-02 structural case's corrected rationale (both assertions unchanged)
- `src/mcp/vice/tools-manifest.stock.json` - four new tool entries (input/output schemas)
- `src/mcp/vice/capability-registry.ts` - three new stock-only-gain entries, the `vice_backtrace` descoped entry removed, both block provenance counts and the header count remark updated
- `src/mcp/vice/capability-registry.test.ts` - widened stock-only-gain case (three new names), new "vice_backtrace has no entry" case
- `src/mcp/vice/hostpath-consumers.test.ts` - four `DERIVED_TOOL_MODULES` entries
- `src/mcp/vice/package.json` - five modules added to `files[]` (four parsers + the capability probe; no test file, no fixture loader)
- `src/mcp/vice/tool-support-table.test.mjs` - the "currently fork-only fixture subject" test re-pointed from `vice_backtrace` (now shared) to `vice_disk_detach`
- `docs/tool-support.md` - regenerated

## Decisions Made

See `key-decisions` in frontmatter. The two decisions worth calling out in prose:

1. **`depth`'s JSON-Schema type is `"number"`, not `"integer"`, on the stock manifest.** `manifest-arg-compat.test.ts`'s backward-compatibility checker does a strict string comparison of each shared property's `.type` field against the fork's declaration. The fork declares `depth: { "type": "number" }` (no `required`); matching that exactly -- rather than the more precise `"integer"` a purely stock-native design would have chosen -- is what makes the shared name pass the compatibility gate. Runtime validation (`isValidBacktraceDepthArg`) still enforces an actual integer 1-64.
2. **Classification is NOT factored into one shared branch function.** Task 3's own verify block requires `grep -ac "classifyTextCapabilityResponse" text-tools.ts` to report at least 5 -- a literal per-handler call count, not a total-occurrence count achievable by calling the classifier once from inside a shared helper. Each of the five handlers therefore calls `classifyTextCapabilityResponse()` on its own line; only identity construction (`capabilityIdentityFor()`) is factored into one shared helper, per the plan's own distinction between "one identity helper" and "the classifier runs in each handler."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `stock-dispatch.test.ts`'s D-02 conformance completeness guard and D-03 STOCK_ONLY_TOOLS name-coverage guard, neither named in Task 2's `read_first` list**

- **Found during:** Task 2, running the plan's own verify block after registering the four tools
- **Issue:** `stock-dispatch.test.ts` carries a conformance-test completeness guard (`CONFORMANCE_TOOL_NAMES` must cover exactly the stock manifest's tool names) and a named `STOCK_ONLY_TOOLS` allow-list (D-03: every stock-only tool name absent from the fork manifest must be explicitly listed). Task 2's own `<files>` list did not name `stock-dispatch.test.ts` at all (it is Task 3's declared file), but the plan's own Task 2 `<verify>` block runs `node --test ... stock-dispatch.test.ts ...` and requires "fail 0" -- registering the four tools per the plan's own instructions left both guards red. This mirrors exactly the deviation plan 42-01's own SUMMARY documented for the same two guards.
- **Fix:** Added four `conformanceTest()` cases (`vice_cpu_history`, `vice_profile_flat`, `vice_backtrace`, `vice_io_registers`), each driving a real reply through `dispatchStock()` against a stub text-monitor server and validating the answer against its own manifest `outputSchema`. Added three `STOCK_ONLY_TOOLS` entries (`vice_cpu_history`, `vice_profile_flat`, `vice_io_registers`) -- `vice_backtrace` deliberately excluded, since it now has a genuine fork-manifest counterpart and is not stock-only.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test capability-registry.test.ts manifest-arg-compat.test.ts stock-dispatch.test.ts stock-derived.test.ts hostpath-consumers.test.ts` -- 193/193 pass after the fix.
- **Committed in:** `bfc0de68` (Task 2 commit)

**2. [Rule 3 - Blocking] Two `outputSchema` entries used the `"description"` keyword, unsupported by `checkAgainstSchema`'s keyword subset**

- **Found during:** Task 2, running the plan's own conformance verify step
- **Issue:** `checkAgainstSchema()` (`stock-schema-check.ts`) supports exactly six keywords (`type`/`properties`/`required`/`items`/`enum`/`additionalProperties`) and reports any other keyword as a violation by design ("never silently ignore an unsupported keyword"). Two of the four new `outputSchema` entries -- `vice_io_registers`'s `decoded` field and `vice_backtrace`'s `origin` field -- initially carried a `"description"` key explaining their shape, causing both conformance tests to fail with "unsupported schema keyword" violations.
- **Fix:** Removed the `"description"` key from both properties, leaving `decoded: { "type": "object" }` (an intentionally loose declaration, matching this checker's own "flat and small" design philosophy) and `origin: {}` (no `type` at all, since the field is a union of an integer address or one of three named strings, and this checker's supported subset has no union keyword).
- **Files modified:** `src/mcp/vice/tools-manifest.stock.json`
- **Verification:** `conformance (D-02): dispatchStock("vice_io_registers"/"vice_backtrace", ...)` -- both pass after the fix.
- **Committed in:** `bfc0de68` (Task 2 commit)

**3. [Rule 1 - Bug/premise correction] `tool-support-table.test.mjs`'s "currently fork-only fixture subject" test used `vice_backtrace`, which this plan just moved into the shared-tool set**

- **Found during:** Task 2, running the plan's own `<verify>` step 3
- **Issue:** A pre-existing test asserts that adding a currently-fork-only tool's entry to a FIXTURE stock manifest flips its support-table row to "available on both." It used `vice_backtrace` as its subject, with a precondition assertion (`vice_backtrace must be ABSENT from the real stock manifest today`) that this plan's own Task 2 work makes false. Not named in any `read_first` list, since the plan's own author could not have anticipated which specific fork-only tool a future test file might pick as its example subject.
- **Fix:** Re-pointed the test's `FORK_ONLY_TARGET` constant from `vice_backtrace` to `vice_disk_detach` -- a genuinely still-fork-only, still-descoped tool, verified present in the fork manifest and absent from the stock manifest before relying on it as the fixture subject.
- **Files modified:** `src/mcp/vice/tool-support-table.test.mjs`
- **Verification:** `node --test tool-support-table.test.mjs shipped-modules.test.ts` -- 24/24 pass after the fix.
- **Committed in:** `bfc0de68` (Task 2 commit)

**4. [Rule 1 - Bug/premise correction] The retrofit changed `handleMemmapShow`'s observable behavior for an empty reply, breaking a pre-existing plan-42-01 test**

- **Found during:** Task 3, running the plan's own verify block after retrofitting `handleMemmapShow`
- **Issue:** `handleMemmapShow`'s pre-existing "a parse refusal surfaces as isErrorText... never a partial answer" test fed a whitespace-only reply (a bare prompt with no content) and asserted the parser's own `empty-response` refusal code. After the Task 3 retrofit, that same input is now intercepted EARLIER -- classified as `indeterminate` by `classifyTextCapabilityResponse()` before ever reaching `parseAccessMap()` at all -- which is the CORRECT new behavior (PARSE-04's own requirement that "an unknown answer is a named state, not an empty success"), but it broke the pre-existing test's literal assertion.
- **Fix:** Split into two tests: the original case re-pointed at a non-empty but structurally wrong reply (so it still exercises `parseAccessMap()`'s own `missing-header` refusal code), and a new dedicated test asserting the empty-reply case now surfaces the capability module's `"unknown, not negative"` indeterminate message instead, with an explicit assertion that the parser's own `empty-response` code never appears.
- **Files modified:** `src/mcp/vice/text-tools.test.ts`
- **Verification:** `node --test text-tools.test.ts` -- 38/38 pass after the fix.
- **Committed in:** `f10a9e1c` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 3/blocking, 2 Rule 1/bug-or-premise-correction).
**Impact on plan:** All four were required to keep the plan's own verify blocks green after its own instructions were followed literally; none changed the plan's design or scope. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## Measured Baseline (plan's own requirement)

`npm run test:automated`, measured at Task 3 (after all three tasks' own commits): **exit 1, exactly 8 pre-existing failures**, matching plan 42-01's and 42-05's own recorded baseline byte-for-byte -- same four files, same per-file counts, none introduced by this plan:
- `anno-import.test.ts` (1 failure)
- `anno-register.test.ts` (2 failures)
- `dxa-seam.test.ts` (4 failures -- the vendored `dxa` binary is not built in this worktree)
- `repo-root.test.ts` (1 failure -- this worktree's path sits under `.claude/worktrees/agent-.../`, tripping a "not under .claude" assertion)

## Final Stock Manifest Tool Count (plan's own requirement)

**45 tools** in `tools-manifest.stock.json` after this plan (41 before + 4 new: `vice_cpu_history`, `vice_profile_flat`, `vice_backtrace`, `vice_io_registers`).

## Capability-Registry Block Counts, Before and After (plan's own requirement)

| Block | Before | After |
|---|---|---|
| hardware | 6 | 6 (unchanged) |
| descoped | 18 | 17 (`vice_backtrace` removed -- now shared, not diverging) |
| stock-only-gain | 5 | 8 (+`vice_cpu_history`, `vice_profile_flat`, `vice_io_registers`) |
| **Total** | **29** (header comment had drifted to a stale "26-entry" claim, corrected as part of this same edit per the plan's own instruction) | **31** |

## Identity Strings the Capability Helper Produced During the Tool-Level Tests (plan's own requirement)

Every `text-tools.test.ts` case drives `capabilityIdentityFor()` against the file's own `makeDeps()` stub, whose `brokerControl` implements only `claimMonitor`/`releaseMonitor` (no `hostState()`), and whose `StockDispatchDeps` never sets `resolvedBinaryPath`/`resolvedBinaryPathIsResolved`. The identity produced in every test case is therefore, byte-for-byte:

```json
{ "identity": { "backend": "stock", "binPath": "", "resolved": false }, "brokerIdentity": undefined }
```

`resolved: false` means `text-capability-probe.ts`'s own `textCapabilityCacheKey()` returns `null` for every one of these calls -- so no verdict from any test in this file is ever cached (consistent with D-42-2's "never cache an unproven identity" rule) -- and `brokerIdentity: undefined` because the stub's `hostState()` call throws (no such method), caught by `capabilityIdentityFor()`'s own `try/catch` and treated as absent evidence, never disagreement.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five text tools (`vice_memmap_show`, `vice_cpu_history`, `vice_profile_flat`, `vice_backtrace`, `vice_io_registers`) are reachable end to end, registered at every guard site, and classify for build capability before parsing.
- `vice_backtrace`'s shared-name design is proven backward-compatible and its registry bookkeeping is paid in full -- no dangling reference to it remains in `capability-registry.ts`.
- Plan 42-08's structural single-owning-module test can include all five `textmon-` parser modules plus `text-capability-probe.ts` in its family-floor count.
- Plan 42-09 (live verification) can now exercise the capable path live for all five text tools against both real binaries this host has, plus the io chip-degradation and cpu-history/memmapshow disabled-capability paths this plan proved offline.
- No blockers for the next plan in this wave.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/text-tools.ts` (modified)
- FOUND: `src/mcp/vice/text-tools.test.ts` (modified)
- FOUND: `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-07-SUMMARY.md`
- FOUND commit: `da53f78c` (Task 1)
- FOUND commit: `bfc0de68` (Task 2)
- FOUND commit: `f10a9e1c` (Task 3)
- Re-ran all `<acceptance_criteria>` across all three tasks: PASS
- Re-ran the plan-level `<verification>` block (`node --test text-tools.test.ts stock-dispatch.test.ts` 181/181; `node --test capability-registry.test.ts manifest-arg-compat.test.ts stock-derived.test.ts hostpath-consumers.test.ts load-order.test.ts` 61/61; `node scripts/generate-tool-support-table.mjs` then `node --test tool-support-table.test.mjs shipped-modules.test.ts` 24/24, zero drift in `docs/tool-support.md`; `node scripts/check-npm-packages.mjs` OK; `npm run typecheck` clean; `npm run test:automated` 8 pre-existing failures, matching the measured baseline, no new failing files): PASS
