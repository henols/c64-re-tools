---
phase: 05-skill-critical-derived-tools
plan: 07
subsystem: api
tags: [stock-vice, binary-monitor, derived-tool, dispatch-table, manifest, packaging, vic-ii, cia, sprites]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-03's handleViciiGetState (stock-vicii.ts), 05-04's handleCiaGetState (stock-cia.ts), 05-05's handleSpriteGet/handleSpriteInspect (stock-sprites.ts) -- all built and unit-tested but deliberately unregistered; 05-06's registration/manifest/packaging procedure over the same six shared files"
provides:
  - "vice_vicii_get_state, vice_cia_get_state, vice_sprite_get and vice_sprite_inspect registered into the ONE STOCK_DISPATCH_TABLE via withDerivedTool(), reachable through dispatchStock() for the first time -- closing the phase's tool surface at 34 stock tools / 9 derived tools"
  - "Four tools-manifest.stock.json entries (30 -> 34 tools) with fork-compatible inputSchema and eleven machine-checked enum:[false] unavailability pins (D-05-07's mechanism 2)"
  - "package.json files[] shipping stock-vicii.ts, stock-cia.ts, stock-sprites.ts (41 -> 44 entries) in the same commit that made them reachable (Phase 3 Rule 2)"
  - "scripts/check-npm-packages.mjs's PHASE4_MODULES renamed to REQUIRED_DERIVED_MODULES and extended to all ten derived modules (Phase 4 + Phase 5), making the tarball regression guard phase-neutral"
  - "Four new conformanceTest() cases with an address-dispatching stub that throws on an unmapped MEM_GET start address"
affects: ["05-08 (coverage script checks skill usage against the final 34-name stock tool list below)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registration-only plan: no new production logic beyond the one documented one-line fix (stock-cia.ts's `requested` field), only wiring 05-03/05-04/05-05's already-built handlers into the shared dispatch/manifest/packaging surface"
    - "Packaging closure in the SAME commit as reachability (Phase 3 Rule 2): stock-vicii.ts, stock-cia.ts and stock-sprites.ts join package.json's files[] in Task 1's own commit, verified by a transitive-closure walk from vice-proxy.ts"
    - "Address-dispatching conformance stub (chipStateSendImpl): a shared helper mapping MEM_GET start address to a reply byte array, throwing on an unmapped address -- necessary because all four handlers issue multiple reads of different ranges, so a single fixed reply would let a wrong-address bug pass silently"
    - "Schema-pin as second, independent enforcement mechanism (D-05-07): eleven unavailable chip-state fields declared with `available: {enum:[false]}` / `reason: {type:string}` / `required:[available,reason]` in outputSchema, validated against the REAL answer by the conformance harness -- a regression to 0, to {available:true}, or to an absent key fails a manifest-derived gate, not just a hand-written test"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-derived.ts
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
    - scripts/check-npm-packages.mjs
    - .claude/mcp/vice/stock-derived.test.ts
    - .claude/mcp/vice/stock-cia.ts
    - .claude/mcp/vice/stock-cia.test.ts

key-decisions:
  - "D-05-07 mechanism 2 (from plan, implemented as specified): eleven enum:[false] schema pins (six VIC-II, five CIA), each validated against the REAL dispatchStock() answer by the conformance harness, plus a direct belt-and-braces assertion inside the vice_vicii_get_state/vice_cia_get_state conformance cases that available===false and reason is non-empty for every declared member"
  - "stock-cia.ts's `requested` field changed from a `1 | 2 | \"both\"` union to always a string (\"1\"/\"2\"/\"both\") -- the plan's own preferred fix, so outputSchema can declare a single `type:\"string\"` that checkAgainstSchema() can express instead of a union it cannot. Two pre-existing stock-cia.test.ts assertions (bare numbers 1/2) updated to their string forms to track this."
  - "REQUIRED_DERIVED_MODULES (renamed from PHASE4_MODULES) now names all ten derived production modules across Phase 4 and Phase 5, turning the tarball regression guard from a Phase-4-only list into a standing one"

patterns-established: []

requirements-completed: [DERIV-05, DERIV-06]

# Metrics
duration: 30min
completed: 2026-08-17
---

# Phase 5 Plan 7: Register DERIV-05/DERIV-06 Tools Summary

**Wired vice_vicii_get_state/vice_cia_get_state/vice_sprite_get/vice_sprite_inspect into the stock dispatch table, manifest and shipped package.json files[], closing Phase 5's tool surface at 34 stock tools / 9 derived tools, with eleven `enum:[false]` schema pins making criterion 3's "never reported as zero" promise a manifest-derived, machine-checked gate.**

## Performance

- **Duration:** ~30 min (task commits 20:14:26 -> 20:23:58 +02:00, 2026-08-17, plus setup/context-reading time)
- **Started:** 2026-08-17 (worktree base-check + context reads)
- **Completed:** 2026-08-17T20:23:58+02:00
- **Tasks:** 3
- **Files modified:** 10 (7 declared in plan `files_modified`, 3 additional: `stock-derived.test.ts`, `stock-cia.ts`, `stock-cia.test.ts` -- all Rule 1 fixes tracking this plan's own specified changes)

## Accomplishments

- `STOCK_DERIVED_TOOLS` grown from 5 to 9 members; all eight Phase 5 tools now dispatch through the one `STOCK_DISPATCH_TABLE` via `withDerivedTool()`, all four new registrations `needsSession: true`
- `stock-vicii.ts`, `stock-cia.ts` and `stock-sprites.ts` joined `package.json`'s `files[]` (41 -> 44) in the same commit that made them reachable from `vice-proxy.ts`'s import closure, verified by a transitive-closure walk (37 clean modules)
- Four `tools-manifest.stock.json` entries added (30 -> 34 tools) with fork-compatible `inputSchema` (D-03: `vice_vicii_get_state` takes no arguments at all, matching the fork's `additionalProperties:false`; `vice_sprite_inspect`'s `format` enum narrowed to `["ascii","binary"]`) and machine-checked `outputSchema` including eleven `enum:[false]` unavailability pins (six VIC-II fields, five CIA fields)
- Fork manifest (`tools-manifest.json`) untouched at 62 tools; `git diff --stat` confirmed empty; `fork-manifest-surface.test.ts` passes
- `stock-dispatch.test.ts` extended to 34 registered names with four `conformanceTest()` cases validating the REAL `dispatchStock()` answers against their own declared `outputSchema`, using a shared `chipStateSendImpl()` address-dispatching stub (dispatches on the request's `start` field via `body.readUInt16LE(1)`) that throws on an unmapped address -- necessary because all four handlers issue multiple reads of different ranges
- The `vice_vicii_get_state` and `vice_cia_get_state` conformance cases each add a direct assertion that every declared `unavailable` member is `available:false` with a non-empty `reason`, through the real dispatch path -- the belt-and-braces check proving the schema pin and the real answer agree, not only in the family test files
- The sprite conformance cases reuse 05-05's verified `$DD00=193 (0xC1)` / `$D018=0x31` pair, so the pointer table (`36856`) and sprite 0's data address (`40960`) are the same constants in `stock-dispatch.test.ts` and `stock-sprites.test.ts`
- `hostpath-consumers.test.ts`'s `DERIVED_TOOL_MODULES` extended to all nine derived tools across five modules; `EXPECTED_IMPORTERS` unchanged at exactly five
- `scripts/check-npm-packages.mjs`'s `PHASE4_MODULES` renamed to `REQUIRED_DERIVED_MODULES` and extended with all five Phase 5 derived modules, making the tarball regression guard phase-neutral (covers Phase 4 + Phase 5, ten modules total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the four tools in stock-derived.ts and stock-dispatch.ts, and ship the three modules (Rule 2)** - `9fd3ee6` (feat)
2. **Task 2: Add the four chip-state and sprite manifest entries, with the unavailability pins** - `97df0f8` (feat)
3. **Task 3: Update stock-dispatch.test.ts (34 names, four conformance cases) and extend the derived-module map** - `fb66525` (test)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified

- `.claude/mcp/vice/stock-derived.ts` - `STOCK_DERIVED_TOOLS` grown from 5 to 9 members, four new names with trailing phase/requirement comments
- `.claude/mcp/vice/stock-dispatch.ts` - three new imports (`stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts`), four new `STOCK_DISPATCH_TABLE` entries under two new comment headings (`// derived (DERIV-05)`, `// derived (DERIV-06)`)
- `.claude/mcp/vice/package.json` - `files[]` gains `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts` (41 -> 44), inserted beside the other `stock-*` family entries
- `scripts/check-npm-packages.mjs` - `PHASE4_MODULES` renamed to `REQUIRED_DERIVED_MODULES`, extended with all five Phase 5 derived modules (ten total)
- `.claude/mcp/vice/stock-derived.test.ts` - pre-existing "exactly five entries" assertion updated to nine, naming all four new tool names (Rule 1: legitimately invalidated by Task 1's own `STOCK_DERIVED_TOOLS` growth)
- `.claude/mcp/vice/tools-manifest.stock.json` - four new entries (30 -> 34 tools); full-file `JSON.stringify` re-serialization, matching 05-06's own precedent, produces a large line-diff confirmed structurally identical for all 30 pre-existing entries
- `.claude/mcp/vice/stock-cia.ts` - `requested` field changed to always render as a string (Rule 1 one-line fix, plan's own preferred approach for D-05-07's schema authoring)
- `.claude/mcp/vice/stock-cia.test.ts` - two pre-existing assertions on `requested` updated from bare numbers to their string forms
- `.claude/mcp/vice/stock-dispatch.test.ts` - `REGISTERED_TOOL_NAMES` grown to 34 with every `30` count updated; four new `conformanceTest()` cases and the shared `chipStateSendImpl()` helper added
- `.claude/mcp/vice/hostpath-consumers.test.ts` - `DERIVED_TOOL_MODULES` extended to nine entries; the third test's fixed absence-list extended with the three new module names; `EXPECTED_IMPORTERS` unchanged at five

## Reusable Artifacts for 05-08 (per this plan's `<output>` instruction)

- **Final `files[]` count: 44**
- **Final stock manifest tool count: 34**
- **`requested` on `vice_cia_get_state` is always a string** (`"1"`, `"2"`, or `"both"`) in every case, via the one-line change to `stock-cia.ts` documented above -- `outputSchema.properties.requested` declares a plain `{ "type": "string" }`, no union workaround needed.
- **The exact list of 34 advertised stock tool names**, for 05-08's coverage script:
  ```
  vice_ping, vice_memory_read, vice_memory_write, vice_memory_banks,
  vice_registers_get, vice_registers_set, vice_registers_available,
  vice_execution_pause, vice_execution_run, vice_execution_step,
  vice_execution_until_return, vice_checkpoint_add, vice_checkpoint_delete,
  vice_checkpoint_list, vice_checkpoint_toggle, vice_checkpoint_set_condition,
  vice_watch_add, vice_machine_reset, vice_autostart, vice_disk_attach,
  vice_snapshot_save, vice_snapshot_load, vice_keyboard_type,
  vice_keyboard_petscii, vice_joystick_set, vice_disassemble,
  vice_memory_search, vice_memory_compare, vice_symbols_load,
  vice_symbols_lookup, vice_vicii_get_state, vice_cia_get_state,
  vice_sprite_get, vice_sprite_inspect
  ```
- **`DERIVED_TOOL_MODULES` as written** (`hostpath-consumers.test.ts`), all nine derived tools across five modules:
  ```typescript
  const DERIVED_TOOL_MODULES: Record<string, string> = {
    vice_disassemble: "stock-disassemble.ts",
    vice_memory_search: "stock-memory-search.ts",
    vice_memory_compare: "stock-memory-search.ts",
    vice_symbols_load: "stock-symbols.ts",
    vice_symbols_lookup: "stock-symbols.ts",
    vice_vicii_get_state: "stock-vicii.ts",
    vice_cia_get_state: "stock-cia.ts",
    vice_sprite_get: "stock-sprites.ts",
    vice_sprite_inspect: "stock-sprites.ts",
  };
  ```

## Decisions Made

- **D-05-07 mechanism 2 (from plan, implemented as specified):** see `key-decisions` above and `plan_decision_D-05-07-schema` in `05-07-PLAN.md` for the full rationale.
- **stock-cia.ts's `requested` string-rendering fix (from plan's own explicit "preferred fix" instruction, implemented as specified):** required updating two pre-existing `stock-cia.test.ts` assertions from bare numbers to their string forms -- a Rule 1 fix necessary to keep that file's own tests passing after the change the plan itself directed.
- No decisions beyond what the plan specified for Tasks 1-2. Task 3's `chipStateSendImpl()` fixture byte values (all-zero CIA/VIC-II register blocks except the deliberately non-zero `$D018` byte needed for a deterministic pointer table) were derived directly from each handler's own decode logic tolerating all-zero input without error, not a plan deviation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `stock-derived.test.ts`'s pre-existing size-5 assertion became a correctly-failing regression after Task 1**
- **Found during:** Task 1 (running `node --test stock-derived.test.ts` after the plan's own verify block)
- **Issue:** `stock-derived.test.ts` (not in this plan's declared `files_modified` list) asserted `STOCK_DERIVED_TOOLS.size === 5` and named only the five pre-05-07 members -- a test that this plan's own Task 1 (growing the set to 9 members, exactly as specified) legitimately invalidated. Identical class of issue to 05-06-SUMMARY.md's own documented deviation #3.
- **Fix:** Updated the assertion to `size === 9` and added `.has()` checks for all four new tool names, matching the actual (correct) post-Task-1 state.
- **Files modified:** `.claude/mcp/vice/stock-derived.test.ts`
- **Verification:** `node --test stock-derived.test.ts` passes (4/4); full `npm run test:automated` returns to its baseline 1 pre-existing failure (the documented worktree-nesting issue) with no new failures.
- **Committed in:** `9fd3ee6` (Task 1 commit)

**2. [Rule 1 - Bug] `stock-cia.ts`'s `requested` field was a `1 | 2 | "both"` union, which `checkAgainstSchema()` cannot express as a single `type`**
- **Found during:** Task 2 (authoring `vice_cia_get_state`'s `outputSchema`, per the plan's own explicit instruction to check this and apply its stated preferred fix)
- **Issue:** `handleCiaGetState` returned `requested` as the bare number `1`/`2` for a single-chip request and the string `"both"` for the default, a union no single JSON Schema `type` keyword can express under this codebase's `checkAgainstSchema()`.
- **Fix:** Changed `requested` to always render as a string (`"1"`, `"2"`, `"both"`) via `String(parsed)` at the single construction site, exactly the plan's own named "preferred fix". `outputSchema.properties.requested` now declares a plain `{ "type": "string" }`.
- **Files modified:** `.claude/mcp/vice/stock-cia.ts`, `.claude/mcp/vice/stock-cia.test.ts` (two pre-existing assertions on `requested` updated from bare numbers `1`/`2` to their string forms `"1"`/`"2"`, tracking the fix)
- **Verification:** `node --test stock-cia.test.ts` passes (31/31); `npm run typecheck` passes; the manifest's `vice_cia_get_state.outputSchema.requested` gate in Task 2's verify block passes with a plain string type.
- **Committed in:** `97df0f8` (Task 2 commit)

---

**Total deviations:** 2 (1 legitimately-invalidated pre-existing test updated to match this plan's own specified `STOCK_DERIVED_TOOLS` growth; 1 one-line production fix the plan itself named as its preferred approach, plus the two test assertions that fix necessarily updated)
**Impact on plan:** No scope creep. Both are either a necessary test update tracking this plan's own specified change, or the plan's own explicitly-named preferred fix. No production behavior changed beyond exactly what the plan specified or explicitly preferred.

## Issues Encountered

- **Pre-existing, unrelated `repo-root.test.ts` failure**, identical to the one all five wave-1 plans and 05-06 reported and already fully documented (RESOLVED disposition) in `.planning/phases/05-skill-critical-derived-tools/deferred-items.md` -- this plan's own worktree is likewise nested under `.claude/worktrees/agent-aba72516869099af1/`. No new deferred-items entry was added per the plan's explicit instruction; confirmed the existing entry already covers this exact failure and disposition.
- `tools-manifest.stock.json`'s Task 2 edit was applied via a full-file `JSON.stringify(..., null, 2)` re-serialization rather than a targeted insertion, producing a larger line-diff than the four logical entries added -- same approach 05-06-SUMMARY.md documented for the same reason. Verified via a structural diff (all keys/values read back identically) that all 30 pre-existing entries are byte-identical in content; the diff size is pure re-formatting noise, not a content change.
- Fresh worktree had no `node_modules/` for `.claude/mcp/vice` -- ran `npm ci` before typechecking, matching every prior Phase 5 plan's own documented setup step (not a deviation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All eight Phase 5 tools are now live end-to-end on the stock backend: advertised on `tools-manifest.stock.json` (34 tools), dispatched through the one `STOCK_DISPATCH_TABLE`, and validated by conformance tests against their own declared `outputSchema` through the real `dispatchStock()` path.
- `files[]` is at 44 entries; `scripts/check-npm-packages.mjs`'s transitive-closure walk reports 37 clean modules with no unshipped target, confirming the published tarball will still boot on both backends after this wave merges.
- The fork manifest (`tools-manifest.json`) is byte-identical at 62 tools; `fork-manifest-surface.test.ts` passes.
- `hostpath-consumers.test.ts`'s `EXPECTED_IMPORTERS` is unchanged at exactly five; `DERIVED_TOOL_MODULES` now covers all nine derived tools, each asserted to exist on disk and asserted absent from the `hostpath.ts` consumer set.
- 05-08 can drive its skill-coverage script directly from the 34-name list recorded above without re-deriving it from the manifest.
- `npm run test:automated` reports 1348 pass / 1 fail (the documented, resolved-by-merge worktree-nesting failure) / 5 todo, matching the exact pattern every prior Phase 5 plan reported.
- No blockers.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-vicii.ts
- FOUND: .claude/mcp/vice/stock-cia.ts
- FOUND: .claude/mcp/vice/stock-sprites.ts
- FOUND: .planning/phases/05-skill-critical-derived-tools/05-07-SUMMARY.md
- FOUND commit: 9fd3ee6 (Task 1)
- FOUND commit: 97df0f8 (Task 2)
- FOUND commit: fb66525 (Task 3)
- FOUND commit: c289930 (SUMMARY)
