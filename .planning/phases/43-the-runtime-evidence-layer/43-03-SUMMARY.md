---
phase: 43-the-runtime-evidence-layer
plan: 03
subsystem: mcp-tooling
tags: [vice, text-monitor, memmapzap, memmapshow, stock-only-tool, evidence-bracket]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 01)
    provides: "memmapzap on the shipped TEXT_COMMAND_ALLOWLIST (eleventh entry), proven dialable live through TextMonitorClient"
  - phase: 43-the-runtime-evidence-layer (plan 02)
    provides: "SCHEMA_VERSION 4 with anno_evid_exec (the store-side half of the bracket reset this plan's tool complements)"
provides:
  - "vice_memmap_zap: a stock-only MCP tool that clears VICE's accumulated memory-access map and proves it cleared, via a two-dial (memmapzap then memmapshow) sequence answering an observable post-zap addressesWithRecordedAccess/addressesQueried count"
  - "a live-measured discovery: a real memmapshow dialed immediately after a real memmapzap, in the same locked session with the CPU halted throughout, always returns a header with zero data lines (parseAccessMap's own no-data-lines refusal code) -- handled as a confirmed-empty map, not a refusal, scoped to this one handler"
  - "vice_memmap_zap advertised on the stock manifest only (capability-registry.ts stock-only-gain, STOCK_ONLY_TOOLS), with a zero-argument inputSchema"
affects: [43-04, 43-05, 43-06, 43-07]

# Actuals (#2632)
actuals:
  tokens: 9532
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A tool's own answer classifies a discriminated parser refusal code differently than the parser's general-purpose caller does, when the tool's own call sequence structurally rules out the ambiguity that refusal code exists to guard against (no-data-lines, scoped to handleMemmapZap only -- handleMemmapShow is unaffected and still refuses on it for an arbitrary caller)"
    - "A stock-only text-channel tool's build-capability verdict is borrowed from classifying a DIFFERENT command's reply (memmapshow's, source-traced) rather than asserting an unverified claim about its own command's (memmapzap's) disabled-build stub text"

key-files:
  created: []
  modified:
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/stock-derived.ts
    - src/mcp/vice/stock-derived.test.ts
    - src/mcp/vice/capability-registry.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/hostpath-consumers.test.ts
    - docs/tool-support.md
    - docs/stock-vice-parity.md

key-decisions:
  - "no-data-lines, live-measured: a memmapshow dialed immediately after memmapzap in the SAME withTextChannelLock() hold, with the CPU halted throughout, deterministically returns a header with zero data lines -- parseAccessMap()'s own no-data-lines refusal code. handleMemmapZap treats this ONE code, in this ONE handler, as a confirmed-empty AccessMap ({entries: []}) rather than a refusal, because the two-dial sequence structurally rules out the wire-truncation ambiguity that refusal exists to guard against for an arbitrary caller. handleMemmapShow is unaffected -- an arbitrary caller of memmapshow still gets the generic refusal."
  - "memmapzap deliberately NOT added to CPUHISTORY_GATED_COMMANDS -- the build-capability verdict is borrowed from classifying the memmapshow reply instead, since memmapzap's own disabled-build stub text is not source-traced from anything this project has read."
  - "vice_memmap_zap carries no ranges key and no startAddress/endAddress/maxRanges parameters at all -- it answers 'is the map clear', not 'what is in it'."

patterns-established:
  - "Pattern: a live opt-in test case can live INSIDE an otherwise-automated test file (text-tools.test.ts), gated by node:test's own { skip } option and the same VICE_LIVE_STOCK_BIN opt-in convention MANUAL_ONLY_TESTS files use, without joining that frozen 13-file list -- the file stays in the automated set and the live case self-skips when the env var is absent."

requirements-completed: [EVID-05]

coverage:
  - id: D1
    description: "vice_memmap_zap registered through the same six surfaces every derived stock text tool uses (text-tools.ts handler, stock-dispatch.ts dispatch table, stock-derived.ts registry, capability-registry.ts, tools-manifest.stock.json, docs/tool-support.md), advertised on the stock backend only"
    requirement: "EVID-05"
    verification:
      - kind: unit
        ref: "stock-derived.test.ts#STOCK_DERIVED_TOOLS: exactly twenty-one entries ... plan 43-03's EVID-05 entry"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#manifest/backend (D-03 name coverage): every non-stock-only, non-proxy-local stock tool has a fork counterpart; every STOCK_ONLY_TOOLS name is stock-only"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#conformance (D-02): dispatchStock(\"vice_memmap_zap\", ...) answers, validating against its own declared outputSchema"
        status: pass
      - kind: unit
        ref: "hostpath-consumers.test.ts#D-02 mechanism 2: no module implementing a STOCK_DERIVED_TOOLS entry may ever join the hostpath.ts consumer set"
        status: pass
    human_judgment: false
  - id: D2
    description: "The tool's answer proves the clear via an observable post-zap addressesWithRecordedAccess/addressesQueried relation, verified live against genuine stock VICE 3.9 in one session (post-zap count strictly below the pre-zap count)"
    requirement: "EVID-05"
    verification:
      - kind: integration
        ref: "text-tools.test.ts#LIVE (opt-in): vice_memmap_zap against genuine stock VICE -- the post-zap addressesWithRecordedAccess is strictly lower than the pre-zap count measured in the same session (VICE_LIVE_STOCK_BIN=/usr/bin/x64sc, genuine stock VICE 3.9)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A build without FEATURE_CPUMEMHISTORY is reported as a named missing capability with its remedy, via the memmapshow classification, never a parser refusal; memmapzap was NOT added to CPUHISTORY_GATED_COMMANDS"
    requirement: "EVID-05"
    verification:
      - kind: unit
        ref: "text-tools.test.ts#handleMemmapZap: a build without FEATURE_CPUMEMHISTORY is reported as a named missing capability, via the memmapshow classification, never a parser refusal"
        status: pass
      - kind: unit
        ref: "grep -v comments text-capability-probe.ts | grep -c memmapzap == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Documentation regenerated/extended: docs/tool-support.md carries the new row (byte-identical to the generator's output), docs/stock-vice-parity.md narrates the two-dial design and the accepted stub-verification limit"
    requirement: "EVID-05"
    verification:
      - kind: unit
        ref: "tool-support-table.test.mjs#generateToolSupportTable() output is byte-identical to committed docs/tool-support.md"
        status: pass
      - kind: unit
        ref: "docs-dangling-refs.test.ts + docs-linerefs.test.ts + comment-phase-pointers.test.ts + shipped-modules.test.ts"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 3: The vice_memmap_zap Bracket-Reset Tool Summary

**`vice_memmap_zap` clears VICE's accumulated memory-access map and proves it cleared through an observable post-zap count -- live-verified against genuine stock VICE 3.9, with a real, measured discovery about what a real clear-then-read sequence actually returns.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- `handleMemmapZap` added to `text-tools.ts`, dialing the two frozen allowlisted literals `memmapzap` then `memmapshow` inside one `withTextTool()` session, answering the post-zap `addressesWithRecordedAccess`/`addressesQueried` (never a `ranges` key -- this tool answers "is the map clear", not "what is in it").
- Registered through the same six surfaces every derived stock text tool uses: `stock-dispatch.ts` (`withDerivedTool(..., { needsSession: false })`), `stock-derived.ts` (`STOCK_DERIVED_TOOLS`, size 20 -> 21), `capability-registry.ts` (`stock-only-gain`), `tools-manifest.stock.json` (zero-argument `inputSchema`), `docs/tool-support.md` (regenerated), and this SUMMARY.
- **Live-measured discovery (against genuine stock VICE 3.9):** a real `memmapshow` dialed immediately after a real `memmapzap`, in the same locked session with the CPU halted the entire time, ALWAYS returns a header with zero data lines -- `parseAccessMap()`'s own `no-data-lines` refusal code, a deliberate Phase 42 design choice ("never decoded as a zero-entry access map"). `handleMemmapZap` treats this ONE code, in this ONE handler, as a confirmed-empty `AccessMap` rather than a refusal, since the two-dial sequence (same lock, no intervening execution possible) structurally rules out the wire-truncation ambiguity that refusal exists to guard against for an arbitrary caller. `handleMemmapShow` is completely unaffected.
- A new opt-in live test case in `text-tools.test.ts` (gated by `VICE_LIVE_STOCK_BIN`, the same convention `text-monitor-live.test.ts` uses) proves the whole design end-to-end against a directly-spawned genuine stock `x64sc`: resume the CPU via a throwaway binary-monitor connection, free-run 3 seconds, read a pre-zap count via `dispatchStock("vice_memmap_show", ...)`, then dial `dispatchStock("vice_memmap_zap", ...)` and assert the post-zap count is strictly lower -- a relation, never a pinned number.
- `docs/stock-vice-parity.md` gained a new item narrating the two-dial design, why `memmapzap` was deliberately NOT added to `CPUHISTORY_GATED_COMMANDS`, and the resulting accepted limit on a build without `FEATURE_CPUMEMHISTORY`.

## Task Commits

1. **Task 1: One vice_memmap_zap call clears the map and proves it, end to end** - `195f8668` (feat)
2. **Task 2: Advertise the tool on the stock surface and nowhere else** - `3c58b620` (feat)
3. **Task 3: Regenerate the tool-support table and the parity narrative** - `070b2a7b` (docs)

**Deviation fix commit:** `409a1060` (fix)

## Files Created/Modified
- `src/mcp/vice/text-tools.ts` - new exported `handleMemmapZap`, placed after `handleMemmapShow`
- `src/mcp/vice/text-tools.test.ts` - deterministic unit tests (including the confirmed-empty `no-data-lines` case) plus the new opt-in live test case
- `src/mcp/vice/stock-dispatch.ts` - `vice_memmap_zap` dispatch-table entry
- `src/mcp/vice/stock-dispatch.test.ts` - a new `conformanceTest("vice_memmap_zap", ...)` case, and `STOCK_ONLY_TOOLS` extended (both discovered red by this task's own verify step)
- `src/mcp/vice/stock-derived.ts` - `STOCK_DERIVED_TOOLS` gains `"vice_memmap_zap"`
- `src/mcp/vice/stock-derived.test.ts` - pinned size 20 -> 21
- `src/mcp/vice/capability-registry.ts` - new `vice_memmap_zap` entry, `category: "stock-only-gain"`
- `src/mcp/vice/tools-manifest.stock.json` - new tool entry, empty-`properties` `inputSchema`
- `src/mcp/vice/hostpath-consumers.test.ts` - `DERIVED_TOOL_MODULES` extended (discovered red by `npm run test:automated`, not named in this plan's own read_first)
- `docs/tool-support.md` - regenerated row
- `docs/stock-vice-parity.md` - new Section B item narrating the design

## Decisions Made
- **`no-data-lines` treated as confirmed-empty, scoped to `handleMemmapZap` only.** See `key-decisions` above. This was discovered, not assumed: the plan's own literal instruction ("on `ok: false` return `isErrorText` ... never a partial answer") would have made the tool's own designed proof-of-work fail on every real invocation, since a genuine clear immediately followed by a read in the same halted session is *always* the "header, zero data lines" shape. Fixing this in the shared `textmon-memmap.ts` parser was rejected -- that would change `vice_memmap_show`'s own established, tested Phase 42 policy for an arbitrary caller, where the ambiguity is real.
- **`memmapzap` NOT added to `CPUHISTORY_GATED_COMMANDS`.** Per the plan's own design: the build-capability verdict is borrowed from classifying the `memmapshow` reply, asserting nothing about `memmapzap`'s own disabled-build stub that this project has not read.
- **The live test case lives inside `text-tools.test.ts`, not a new manual-only file.** Gated by `node:test`'s `{ skip }` option using the same `VICE_LIVE_STOCK_BIN` convention as `text-monitor-live.test.ts`/`stock-live.test.ts`; the file stays in the automated set (`test-gate.mjs`'s `MANUAL_ONLY_TESTS` unchanged) since the case self-skips cleanly by default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `no-data-lines` special-cased in `handleMemmapZap` (live-measured, not assumed)**
- **Found during:** Task 1, first live run of the opt-in test case against genuine stock VICE 3.9
- **Issue:** Following the plan's literal instruction ("on `parseAccessMap` `ok: false`, return `isErrorText`... never a partial answer") made every real `vice_memmap_zap` call fail with a `no-data-lines` refusal, because a `memmapshow` dialed immediately after a real `memmapzap`, in the same locked session with the CPU halted throughout, deterministically produces a header with zero data lines -- and the shared parser (correctly, for its OWN general-purpose callers) refuses to read that as a zero-entry map.
- **Fix:** `handleMemmapZap` now treats this ONE refusal code, in this ONE handler, as a confirmed-empty `AccessMap` (`{ entries: [] }`) -- justified because the two-dial sequence (same `withTextChannelLock()` hold, no possible intervening execution) structurally rules out the "maybe truncated" ambiguity the general refusal exists to guard against. `handleMemmapShow`'s own behavior for an arbitrary caller is completely unchanged.
- **Files modified:** `src/mcp/vice/text-tools.ts`, `src/mcp/vice/text-tools.test.ts`
- **Verification:** New deterministic unit test asserts the confirmed-empty success shape; the live opt-in test then passed end-to-end against genuine stock VICE 3.9 (`postZap < preZap` with `postZap` observed as `0`).
- **Committed in:** `195f8668` (Task 1 commit)

**2. [Rule 3 - Blocking] Two hand-maintained lists went red under the plan's own verify step, plus a third under `npm run test:automated`**
- **Found during:** Task 2's own `<verify>` (stock-dispatch.test.ts) and this plan's phase-level regression pass (`npm run test:automated`)
- **Issue:** `stock-dispatch.test.ts`'s `STOCK_ONLY_TOOLS` (D-03 name coverage) and `CONFORMANCE_TOOL_NAMES` (D-02 completeness guard, via a missing `conformanceTest()` case) both went red once the new tool reached the stock manifest; `hostpath-consumers.test.ts`'s `DERIVED_TOOL_MODULES` (D-05-12) went red once the new tool joined `STOCK_DERIVED_TOOLS` -- none of the three was named in this plan's own `read_first`.
- **Fix:** Added `"vice_memmap_zap"` to `STOCK_ONLY_TOOLS`; added a new `conformanceTest("vice_memmap_zap", ...)` case dialing `memmapzap` then `memmapshow` against a stubbed text server; added `vice_memmap_zap: "text-tools.ts"` to `DERIVED_TOOL_MODULES`.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`, `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` and `node --test hostpath-consumers.test.ts` both green; `npm run test:automated` settled at the documented 3-failure floor (`anno-import.test.ts`, `anno-register.test.ts` x2), no new failures.
- **Committed in:** `3c58b620` (`STOCK_ONLY_TOOLS`/`CONFORMANCE_TOOL_NAMES`, part of Task 2) and `409a1060` (`hostpath-consumers.test.ts`, a standalone fix commit after the phase-level regression pass)

**3. [Rule 1 - Bug] `docs/stock-vice-parity.md` has no pre-existing section narrating the three text-channel tools**
- **Found during:** Task 3's `read_first`
- **Issue:** The plan's `read_first` cited "the section where the three existing text-channel tools are narrated" in `docs/stock-vice-parity.md`; no such section exists (checked via grep for `memmapshow`, `device c:`, `warp on`, `chis`, `CPUHISTORY_GATED_COMMANDS` -- zero hits before this task).
- **Fix:** Added a new numbered item (9) to Section B ("Extra stock features worth exposing"), the closest existing home for an already-shipped stock-only capability narrative, covering both `vice_memmap_show` (Phase 42) and the new `vice_memmap_zap`.
- **Files modified:** `docs/stock-vice-parity.md`
- **Verification:** `grep -ac 'vice_memmap_zap' docs/stock-vice-parity.md` returns 1; `docs-dangling-refs.test.ts`/`docs-linerefs.test.ts`/`comment-phase-pointers.test.ts` all green.
- **Committed in:** `070b2a7b` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 bug discovered live, 1 blocking fix spanning three hand-maintained test lists, 1 bug in the plan's own read_first citation).
**Impact on plan:** All three were necessary for correctness (deviation 1 is the actual substance of what live testing this plan found) or to keep the existing structural-guard test suite meaningful and green (deviation 2). None changed the plan's scope or the tool's designed shape.

## Issues Encountered
None beyond the deviations above (which are the real substance of what this plan's live measurement found).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `vice_memmap_zap` is live-proven end to end against genuine stock VICE 3.9 and is the emulator-side half of EVID-05's bracket-reset requirement; plan 43-02's `anno_evid_exec`/`deleteExecObservationsForRun` is the store-side half already shipped -- both halves now exist independently for a later plan to wire together (an ingestion verb turning a parsed `AccessMap` into store rows, per `43-RESEARCH.md`'s scoped-out Open Question 1).
- The `no-data-lines` confirmed-empty discovery is scoped and documented; a future plan reusing `parseAccessMap()` in a similarly narrow, single-writer, no-possible-intervening-execution context should read this plan's reasoning before deciding whether the same treatment applies, rather than re-deriving it from scratch.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All key-files (modified) confirmed present on disk with `[ -f ]`.
- All four commit hashes (`195f8668`, `3c58b620`, `070b2a7b`, `409a1060`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (clean), `node --test stock-derived.test.ts text-tools.test.ts` (60/60, 1 live case correctly skipped by default), census (`grep -v comments text-capability-probe.ts | grep -c memmapzap` == 0), `node --test capability-registry.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts stock-dispatch.test.ts` (186/186), `node scripts/generate-tool-support-table.mjs` (no diff after commit), doc guards (61/61), and the opt-in live case itself run twice against genuine stock `/usr/bin/x64sc` (VICE 3.9) -- once surfacing the `no-data-lines` discovery, once passing after the fix.
- `npm run test:automated`: settled at exactly the documented 3-failure floor (`anno-import.test.ts:352`-equivalent, `anno-register.test.ts:385`, `anno-register.test.ts:479`), no new failures.
- `pgrep -x x64sc` empty and `systemctl --user is-active vice-broker` reports `inactive` after every live run.
