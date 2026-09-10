---
phase: 43-the-runtime-evidence-layer
plan: 05
subsystem: annotation-store
tags: [evidence, memmapshow, ingest, mcp-tool, tdd]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 02)
    provides: "SCHEMA_VERSION 4's anno_evid_exec table and its insertExecObservations/listExecObservations/listObservedRuns/deleteExecObservationsForRun store functions -- the write path this plan carries observations into"
  - phase: 43-the-runtime-evidence-layer (plan 04)
    provides: "evid-reconcile.ts's row/observation shapes (EvidExecRow, EvidSourceBank) this plan's rows must match exactly"
provides:
  - "evid-ingest.ts: the pure transform from a parsed memmapshow access map to durable-shaped observations (execObservationsFrom, runIdentityFrom, ingestAccessMap)"
  - "anno_evid_ingest: the MCP write verb carrying one memmapshow reply plus one run identity into anno_evid_exec, registered through the existing ANNO_TOOL_DEFINITIONS array and single anno registration loop"
affects: [43-06, 43-07]

# Actuals (#2632)
actuals:
  tokens: 16929
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure parse-to-rows transform (evid-ingest.ts) stays outside anno-store.ts's node:sqlite seam entirely -- the store write happens one layer up, in the MCP dispatch arm, keeping the transform importable by any future non-tool consumer"
    - "observationsWritten is computed by diffing against a pre-write listExecObservations() query, never from the size of the array handed to insertExecObservations() -- otherwise a repeated identical ingest would report the same count instead of 0"
    - "A real, continuously-racing subprocess (atomic rename over the store path) is the only way to test the assertStorePresent()/assertSameFile() inode-race window: both node:fs's and a local ESM module's exported bindings are non-configurable, so mock.method() fails on either (measured directly against this Node 24 runtime) -- a background racer hits the window reliably (~98%+ per-call in a small experiment) because the whole call is synchronous with zero yield points for anything else to land the swap"

key-files:
  created:
    - src/mcp/vice/evid-ingest.ts
    - src/mcp/vice/evid-ingest.test.ts
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/anno-register.ts
    - src/mcp/vice/textmon-seam.test.ts

key-decisions:
  - "A row is written if and only if an address's ram.execute, rom.execute or io.execute flag is true in the parsed reply -- read-and-write-only access, and an address absent from the sparse entries array, both produce NO row, and those are two different facts the store never conflates."
  - "anno_evid_ingest accepts argv (the exact launch argv) and digests it itself through the shipped argvDigest() -- no argv_digest parameter exists anywhere on this verb's surface, so a caller cannot invent a run identity."
  - "anno_evid_ingest is NOT added to READ_ONLY_ANNO_VERBS (now exported, previously module-private, for test visibility) -- it takes the existence-check-plus-inode-guard write route every other write verb takes, and never creates the store it was asked to annotate."
  - "No capability-registry.ts entry was added: the anno_* family's standing exclusion from the backend-aware seam applies to this verb unchanged, satisfied by construction because the family never reaches forwardToVice()."

requirements-completed: [EVID-01, EVID-04]

coverage:
  - id: D1
    description: "evid-ingest.ts's pure transform (execObservationsFrom, runIdentityFrom, ingestAccessMap) turns a parsed memmapshow access map plus a run identity into sorted, durable-shaped observations, refusing a parse failure unabsorbed"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "evid-ingest.test.ts#Behavior 1: execObservationsFrom over the committed memmapshow fixture returns one observation per address/bank pair whose execute flag is true, and nothing else"
        status: pass
      - kind: unit
        ref: "evid-ingest.test.ts#Behavior 5: runIdentityFrom computes argvDigest from the supplied argv and refuses an empty/non-array argv, a malformed imageSha256, and an empty seed"
        status: pass
      - kind: unit
        ref: "evid-ingest.test.ts#Behavior 6: ingestAccessMap handed a { ok: false } parse result returns a named refusal carrying the refusal code and the offending line"
        status: pass
      - kind: unit
        ref: "evid-ingest.test.ts#Behavior 7: observations are sorted ascending by address then by bank, so two identical replies produce identical arrays"
        status: pass
    human_judgment: false
  - id: D2
    description: "A row exists only for an observed execute bit -- read+write-without-execute and address-absence both produce NO row, proven in both directions by one fused planting"
    requirement: "EVID-04"
    verification:
      - kind: unit
        ref: "evid-ingest.test.ts#Behavior 2: an entry with read:true, write:true, execute:false on all three banks produces NO observation"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 3 Test 1 (fused planting, both directions): read+write with no execute leaves listExecObservations empty, and the SAME address with execute produces exactly one row"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno_evid_ingest is registered through the existing ANNO_TOOL_DEFINITIONS array and single anno registration loop, writes one row per observed execute bit through one insertExecObservations() call, and is idempotent on a repeat"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#Task 2 Test 1: anno_evid_ingest writes one row per observed execute bit and reports changed:true with observationsWritten and a denominator"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 2 Test 2: an identical repeat reports changed:false and observationsWritten:0, with the row count unchanged"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 2 Test 6: anno_evid_ingest is curated (derived from ANNO_TOOL_DEFINITIONS) and is NOT in READ_ONLY_ANNO_VERBS"
        status: pass
    human_judgment: false
  - id: D4
    description: "The verb never creates the store it was asked to annotate (refuses an absent path, and refuses when the file is replaced between the existence check and the open), and never writes to the byte-derived block table"
    requirement: "EVID-04"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#Task 2 Test 3: a store path that does not exist refuses by name with the never-create message, and creates no file"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 3 Test 3: the store file replaced between the existence check and the open refuses by name, writing nothing"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 3 Test 2: an ingest never touches the byte-derived block table -- listRanges is deep-equal before and after"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two different run identities coexist in the same store without leaking into each other's filtered view, both address-space extremes ingest to exactly one row, and one live memmapshow reply from genuine stock VICE lands as rows"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#Task 3 Test 4: two different run identities coexist, and neither's filtered rows leak into the other's"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#Task 3 Test 5: 0x0000 and 0xffff each ingest to exactly one row -- neither extreme is special-cased into a falsy hole"
        status: pass
      - kind: integration
        ref: "anno-tools.test.ts#Task 3 Test 6 (opt-in, live): a real memmapshow reply from genuine stock VICE is ingested by anno_evid_ingest, producing 0 < rowCount <= addressesQueried"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 5: The Runtime Evidence Ingest Verb Summary

**`evid-ingest.ts`'s pure transform plus the new `anno_evid_ingest` MCP verb turn one `memmapshow` reply and one run identity into durable `anno_evid_exec` rows -- a row exists only for an observed execute bit, and "no row" is proven, in both directions, to mean the absence of an assertion rather than a claim about data.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-10T10:50:59Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `src/mcp/vice/evid-ingest.ts` (new): `execObservationsFrom()` (a pure, one-pass transform emitting one observation per address/bank pair whose `execute` flag is true -- never reading `.read`/`.write`, never deriving an observation from an address's absence), `runIdentityFrom()` (validates `imageSha256`/`seed` and computes `argvDigest` itself from the caller's exact `argv` -- no pre-computed digest accepted anywhere), and `ingestAccessMap()` (the one join, returning a refusal unabsorbed on a failed parse). Imports nothing from `anno-store.ts` and names no `node:sqlite`, keeping the transform out of the store's own single-consumer scans.
- `anno_evid_ingest` added to `ANNO_TOOL_DEFINITIONS` (placed after `anno_join_memmap`), with its own per-verb argument assertion and a `dispatchEvidIngest` arm wired into the existing dispatch chain -- zero edits to `vice-proxy.ts`'s single anno registration loop, and no `capability-registry.ts` entry (the anno family's standing exclusion applies unchanged).
- `observationsWritten` is computed from what is genuinely NEW (a `listExecObservations()` query before the write, diffed against the incoming set), not from the array's own length -- so a byte-identical repeat reports `observationsWritten: 0` even though the same-shaped observation array is passed to `insertExecObservations()` again.
- Every count the answer reports (`observationsWritten`, `addressesWithRecordedAccess`, `addressesQueried`) travels beside an explicit `denominator` (`addressesQueried`); no percentage is ever formed.
- 24 tests across `evid-ingest.test.ts` (Task 1's seven behaviours plus a success-path case and a source-census case) and `anno-tools.test.ts` (Task 2's seven behaviours plus Task 3's six, including a real inode-race proof and a live capture against genuine stock VICE 3.9).
- The store-file inode-race window (`assertStorePresent()`/`assertSameFile()`) is proven with a REAL background subprocess continuously replacing the store file via atomic rename, rather than a mock -- `mock.method()` fails on both `node:fs`'s and a local ESM module's exported bindings (measured directly: `Cannot redefine property` on each), and the whole `runAnnoTool()` call is synchronous with zero yield points, so no in-process interleaving is possible.

## Task Commits

Each task was committed atomically:

1. **Task 1: One memmapshow reply becomes one durable row through the real verb** - `b82ae799` (feat)
2. **Task 2: Register anno_evid_ingest through the existing anno loop and write the rows** - `20ad40c8` (feat) -- this commit also contains Task 3's `anno-tools.test.ts` additions (Tests 1-6); see Deviations below.
3. **Task 3: Prove the write path holds against absence, against a foreign store, and against a real live reply** - `53e78835` (test) -- the two structural-guard fixes (`textmon-seam.test.ts`, `anno-register.ts`) Task 3's own full-suite verification pass required.

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/mcp/vice/evid-ingest.ts` - the pure transform: `ExecObservation`, `execObservationsFrom()`, `IngestRunIdentity`, `RunIdentity`, `runIdentityFrom()`, `IngestAccessMapResult`, `ingestAccessMap()`
- `src/mcp/vice/evid-ingest.test.ts` - Task 1's seven behaviours, a success-path case, and Task 3's source-census case
- `src/mcp/vice/anno-tools.ts` - new `ANNO_TOOL_DEFINITIONS` entry `anno_evid_ingest`, `assertEvidIngestArgs`, `dispatchEvidIngest`; `READ_ONLY_ANNO_VERBS` exported
- `src/mcp/vice/anno-tools.test.ts` - Task 2's seven behaviours and Task 3's six (fused planting, block-table isolation, inode race, dual run identities, address extremes, live capture)
- `src/mcp/vice/package.json` - `evid-ingest.ts` added to `files[]`
- `src/mcp/vice/anno-register.ts` - a register entry for `anno_evid_ingest` citing `evid-ingest.ts`/`anno-tools.ts` and `EVID-01`/`EVID-04`
- `src/mcp/vice/textmon-seam.test.ts` - `anno-tools.ts`/`anno-tools.test.ts`/`evid-ingest.ts`/`evid-ingest.test.ts` declared as legitimate importers/literal-consumers of the access-map header

## Decisions Made
- **`observationsWritten` counts NEW rows, not array length.** Computed by querying `listExecObservations()` for the run identity before the write and diffing -- the only way a repeat ingest can honestly report `0` while still passing the WHOLE observation array through one `insertExecObservations()` call (T-43-26's single-transaction requirement).
- **`READ_ONLY_ANNO_VERBS` exported.** Was module-private; exporting it costs nothing behaviourally and lets a test assert `anno_evid_ingest` is absent from it directly, per this plan's own acceptance criteria, rather than only inferring the write route indirectly.
- **The inode-race test uses a real racer subprocess**, not a mock, after confirming empirically that `mock.method()` cannot redefine either `node:fs`'s or a local module's exported bindings on this Node 24 runtime. A background process continuously replacing the store file via atomic rename hits the guard's window reliably (measured ~98%+ per call in a standalone experiment before landing the test), because the vulnerable window is entirely inside one synchronous `runAnnoTool()` call with no yield point for anything else to land the swap at a chosen instant -- so the test loops calling `anno_evid_ingest` against the racing file until it observes the refusal, bounded by a 5-second deadline.
- **The live case (Task 3 Test 6) dials the raw `memmapshow` reply through a direct `textConnect()` session** (wrapped in `withTextChannelLock()`, matching `handleMemmapShow()`'s own discipline), in addition to calling `dispatchStock("vice_memmap_show", ...)` once to prove the real MCP-facing seam also dials successfully -- `dispatchStock()`'s own answer is already-parsed JSON and does not carry the raw text `anno_evid_ingest` needs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `evid-ingest.test.ts`'s source-census case initially tripped `anno-seam.test.ts`'s `node:sqlite` test-tree confinement guard**
- **Found during:** Task 1, first combined verification run
- **Issue:** My first draft of the source-census case banned the literal `node:sqlite` as one of several strings `evid-ingest.ts` must never contain -- which requires spelling that literal inside the test file itself, tripping `anno-seam.test.ts`'s declared-list guard (`TEST_FILES_NAMING_SQLITE`).
- **Fix:** Removed the redundant `node:sqlite`/`anno-store` checks from the census (already proven, non-redundantly, by `anno-seam.test.ts`'s own shipped-module-set scan, which now covers `evid-ingest.ts` too) rather than adding a fourth declared-list member for no additional coverage.
- **Files modified:** `src/mcp/vice/evid-ingest.test.ts`
- **Verification:** `node --test evid-ingest.test.ts anno-seam.test.ts shipped-modules.test.ts` -- 50/50 pass.
- **Committed in:** `b82ae799` (Task 1 commit)

**2. [Rule 3 - Blocking] `textmon-seam.test.ts`'s declared literal/import-consumer lists needed the four new files added**
- **Found during:** Task 3's `npm run test:automated` full-suite pass
- **Issue:** `anno-tools.ts`/`anno-tools.test.ts` now import `parseAccessMap`/`accessMapRanges` from `textmon-memmap.ts`, and `evid-ingest.ts`/`evid-ingest.test.ts` import (or contain, in a test's malformed-reply case) the access-map header literal -- a legitimate new consumer this structural guard is DESIGNED to require a reviewed addition for, not to silently permit.
- **Fix:** Added all four files to `FORMAT_OWNERS[0]`'s (`access map`) `literalConsumers`/`importConsumers` lists, each with a reason. Also reworded three of the new `reason` strings after discovering they accidentally spelled the literal call-shape `parseAccessMap(` -- which trips a DIFFERENT assertion in the same file (`textmon-seam.test.ts` must never itself call the parsers it is scanning for, to keep "ownership" and "decode correctness" separate).
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` -- 33/33 pass.
- **Committed in:** `53e78835` (Task 3 commit)

**3. [Rule 3 - Blocking] `anno-register.ts` needed a new entry for `anno_evid_ingest`**
- **Found during:** Task 3's `npm run test:automated` full-suite pass
- **Issue:** `anno-register.test.ts`'s completeness scan requires every `ANNO_TOOL_DEFINITIONS` entry to have a register entry citing a real consumer path and a declared requirement id -- `anno_evid_ingest` had none, which would have made an existing planted-violation control's baseline list worse in a way that looks pre-existing (exactly the project gotcha this plan's own briefing named).
- **Fix:** Added a register entry citing `evid-ingest.ts`'s `ingestAccessMap` and `anno-tools.ts`'s `anno_evid_ingest`, against `EVID-01`/`EVID-04` (both declared in `.planning/REQUIREMENTS.md`).
- **Files modified:** `src/mcp/vice/anno-register.ts`
- **Verification:** `node --test anno-register.test.ts` settles back to the documented 2-failure baseline for this file (`DIRECTION 5` basis integrity and the negative control, both pre-existing and unrelated to this plan).
- **Committed in:** `53e78835` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking, all structural-guard maintenance the guards themselves are designed to require for a legitimate new consumer).
**Impact on plan:** All three were necessary to keep pre-existing structural guards meaningful and green. No scope creep -- no verb behaviour changed by any of the three; only declared-consumer lists and a register entry were added.

## Process Note (commit granularity)

Task 2's and Task 3's `anno-tools.test.ts` additions were written together in one editing pass and landed in the Task 2 commit (`20ad40c8`) rather than as two separate atomic commits -- Task 3's six tests were drafted alongside Task 2's seven while the dispatch arm was still fresh in context, and splitting them after the fact would have meant an artificial partial-revert-and-recommit rather than a genuinely separable change. `evid-ingest.test.ts`'s Task 3 source-census case similarly landed in the Task 1 commit (`b82ae799`). This is disclosed here as a process deviation, not a code-correctness one: every behaviour Task 3 specifies is present, tested, and green; only the commit boundary differs from a strict per-task split. Task 3's own commit (`53e78835`) carries the two structural-guard fixes its own full-suite verification pass required.

## Issues Encountered

None beyond the three auto-fixed deviations above. `npm run test:automated` was run three times during this plan (after Task 2, after Task 3's first pass, and after the structural-guard fixes); the final run settled at exactly the documented 3-failure floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`), none outside it. The intermittent `audit-root-args.test.ts:982` race noted in prior plans' sessions did not appear in this run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `anno_evid_ingest` is a complete, tested write path from a raw `memmapshow` reply into `anno_evid_exec`, ready for whatever later plan wires a reconciliation-facing report or rendering surface on top of it (plans 43-06/43-07).
- `evid-ingest.ts`'s pure transform (`execObservationsFrom`, `runIdentityFrom`, `ingestAccessMap`) is independently importable by any future non-tool consumer without dragging in `node:sqlite` or a store handle.
- No stubs, no skipped tests, no unrun `<verify>` commands from this plan. The opt-in live case (Task 3 Test 6) was actually run against genuine stock VICE 3.9 at `/usr/bin/x64sc` during this session: a real capture produced 85 observed execute bits out of 3136 addresses with recorded access (65536 addresses queried), and `dispatchStock("vice_memmap_show", ...)`'s own dispatch-layer count matched `execObservationsFrom()`'s pure-transform count exactly over the same reply.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `src/mcp/vice/evid-ingest.ts` and `src/mcp/vice/evid-ingest.test.ts` confirmed present on disk with `[ -f ]`.
- All three task commit hashes (`b82ae799`, `20ad40c8`, `53e78835`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (clean), `node --test evid-ingest.test.ts` (all behaviours plus source census green), the census (`grep -vE '^\s*[/*]' evid-ingest.ts | grep -cE '\.read\b|\.write\b|anno-store|node:sqlite|toFixed'` = 0), `node --test anno-tools.test.ts` (74/74, fused planting proving both directions), `node --test capability-registry.test.ts stock-dispatch.test.ts anno-seam.test.ts shipped-modules.test.ts` (all pass), `vice-proxy.ts`'s single anno registration loop count = 1, `capability-registry.ts` naming `anno_evid_ingest` = 0 times, and `npm run test:automated` (settled at the documented 3-failure floor, none outside it).
- `pgrep -x x64sc` empty -- the opt-in live case's spawned emulator was reaped in its own `finally`, verified with `pgrep -x x64sc` inside the test itself and independently after the run.
