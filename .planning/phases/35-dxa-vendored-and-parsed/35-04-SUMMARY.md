---
phase: 35-dxa-vendored-and-parsed
plan: 04
subsystem: infra
tags: [dxa, host-tool-seam, annotation-store, data-blocks, disassembler]

# Dependency graph
requires:
  - phase: 35-dxa-vendored-and-parsed
    provides: "35-01's dxa.disassemble HostToolId (datablocksPath/labelsPath already-typed allowlist keys), dxa-run.ts's runDxaDisassemble() and injectable run seam, dxa-listing.ts's DumpListingMap; 35-02's hardened parser; 35-03's HOST_TOOL_FAMILY_FLOOR precedent"
provides:
  - "dxa-blocks.ts -- emitDataBlocks()/emitLabels(), the ONE emitter turning the annotation store's frozen 12-member DATA_TYPES vocabulary into dxa's -B/-l file formats"
  - "dxa-run.ts's DxaRunArgs.knownDataRows -- an alternative to a caller-supplied datablocksPath/labelsPath, writing per-invocation files and wiring their paths into the wire request"
  - "a proven, measured exclusion pair on the tracer fixture (6/15 code/data without a range, 0/21 with it) and a real cracked release (danish.d64's extracted BRUCE LEE (DC), before/after per-address classification)"
affects: [37-automatic-graphics-range-derivation]

# Actuals (#2632)
actuals:
  tokens: 12200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A row-shape emitter that NEVER opens the store itself: dxa-blocks.ts imports only the DataType/DATA_TYPES type/value from anno-types.ts and accepts already-fetched rows from a caller -- no anno-store.ts import, no node:sqlite anywhere in the module, verified by anno-seam.test.ts's single-namer census staying green."
    - "Sort-then-check-consecutive-pairs for overlap detection over an interval set -- O(n log n), never an O(n^2) pairwise scan, and provably sufficient to find every overlap once sorted by start."
    - "A caller-supplied output path is the module's ONLY concurrency contract: no fixed filename inside the emitter, so two invocations at different paths cannot collide by construction, and a repeated call at the SAME path truncates rather than appends."

key-files:
  created:
    - src/mcp/vice/dxa-blocks.ts
    - src/mcp/vice/dxa-blocks.test.ts
    - .planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa03-real-image.md
  modified:
    - src/mcp/vice/dxa-run.ts (DxaRunArgs.knownDataRows, emitDataBlocks()/emitLabels() wiring)
    - src/mcp/vice/dxa-live.test.ts (EXCLUSION, OMISSION and CORPUS cases)
    - src/mcp/vice/hostpath-consumers.test.ts (HOST_TOOL_FAMILY_FLOOR 2+1+2+1 -> 2+1+2+2)
    - src/mcp/vice/fixtures/dxa/README.md (the exclusion pair's commands/splits, a pointer to the real-image evidence)

key-decisions:
  - "dxa-blocks.ts defines its OWN KnownDataRow type ({ start, endInclusive, dataType, sym? }) rather than importing anno-types.ts's RangeRow directly -- RangeRow carries no sym field (labels are a separate anno_label table in the store), so a caller merging range and label information before calling this module is the correct seam, not a store-side join this module would otherwise have to perform itself (which would require importing anno-store.ts, forbidden by A-11/A-12's own no-store-access rule)."
  - "DxaRunArgs.knownDataRows is mutually exclusive with a caller-supplied datablocksPath/labelsPath -- runDxaDisassemble() throws naming the collision rather than silently preferring one, mirroring host-tool.mts's own first-refusal-wins discipline for its resolved paths."
  - "Task 3's real-image range ($0819-$081f) is the depacker entry stub dxa's OWN heuristics classify as code under this seam's fixed -d skip-scanning policy from the extracted release's one SYS-token entry point -- chosen to exercise the SAME mechanism the tracer case exercises on real cracked code, since with skip-scanning and no further declared routines almost nothing else in the release is code to begin with. Documented explicitly in evidence/35-dxa03-real-image.md as an operator judgement exercising the mechanism, not a claim about which bytes of BRUCE LEE are genuinely game data -- that automatic derivation is Phase 37's AUTO-06/AUTO-07."
  - "PLAN.md's own acceptance-criteria text says host-tool.test.ts's declared-path-key total stays 'unchanged at 11' -- the actual, internally-consistent value (per 35-01-SUMMARY.md's own documented Rule 1 fix) is 12. This task adds no new HostToolId argument key, so the value is genuinely unchanged; only the plan's inherited literal was stale. No file was edited for this -- host-tool.test.ts's own census assertion already asserts 12 against itself and passed unmodified."

requirements-completed: [DXA-03]

coverage:
  - id: D1
    description: "The store's frozen 12-member DATA_TYPES vocabulary becomes sorted, disjoint, deterministic -B and -l files (dxa-blocks.ts), with adjacency, overlap, emptiness, ordering, idempotency and concurrency each answered by a named test case."
    requirement: "DXA-03"
    verification:
      - kind: unit
        ref: "dxa-blocks.test.ts (14 cases: DATA_BEARING_TYPES derivation x2, emitDataBlocks x9, emitLabels x3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dxa-run.ts wires the emitted files into the dxa.disassemble request as the already-typed datablocksPath/labelsPath arguments, adding no allowlist key, and omits the argument entirely on a zero-range result."
    requirement: "DXA-03"
    verification:
      - kind: unit
        ref: "dxa-live.test.ts#dxa-live OMISSION (hermetic, injected run seam, asserts on the constructed wire request)"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts, dxa-seam.test.ts (declared-path-key census and typed-allowlist gate, unaffected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Naming a known-data range removes those bytes from dxa's OWN code classification -- proven on the tracer fixture, before/after, both halves asserted as measured literals."
    requirement: "DXA-03"
    verification:
      - kind: integration
        ref: "dxa-live.test.ts#dxa-live EXCLUSION (6 code/15 data without the range, 0 code/21 data with it, real vendored dxa binary)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The same exclusion is exercised on a real cracked release (Phase 23's corpus), extracted with no VICE/broker/capture pipeline, with the corpus image never entering the working tree."
    requirement: "DXA-03"
    verification:
      - kind: integration
        ref: "dxa-live.test.ts#dxa-live CORPUS (per-address relative assertion, real vendored dxa binary, gated behind VICE_LIVE_DXA_CORPUS=1)"
        status: pass
      - kind: other
        ref: "evidence/35-dxa03-real-image.md (release identity, extracted entry, range basis, both commands, before/after classification, D-04 oracle-narrowing statement)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-04
status: complete
---

# Phase 35 Plan 4: dxa Vendored and Parsed -- Data Blocks Summary

**A hand-annotated known-data range now measurably excludes those bytes from dxa's own code classification, on both a synthetic fixture and a real cracked C64 release, through `-B`/`-l` files this project writes from the annotation store's frozen 12-member vocabulary.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-04T~10:56Z (approximate)
- **Completed:** 2026-09-04T11:41:04Z
- **Tasks:** 3 (all completed)
- **Files modified:** 7 (excluding `.planning/STATE.md`/`state.json`, which the orchestrator owns)

## Accomplishments

- `dxa-blocks.ts` (`emitDataBlocks()`/`emitLabels()`): the ten data-bearing `DATA_TYPES` members (derived by excluding `"code"`/`"undefined"` from the frozen twelve, never hand-listed) become a plain-form `-B` datablocks file and an xa65-format `-l` labels file. Adjacency stays two lines, overlaps refuse by name quoting both, zero selected rows writes no file at all, output is sorted and byte-identical across repeated runs, and the output path is always caller-supplied so concurrent invocations cannot collide -- each answered by a named test case (14 total).
- `dxa-run.ts` gained `DxaRunArgs.knownDataRows`, an alternative to a caller-supplied `datablocksPath`/`labelsPath`: `runDxaDisassemble()` calls the new emitter, writes per-invocation files under the run's own output directory, and wires the resulting workspace-relative paths into the wire request -- omitting the argument entirely when the emitter selects zero rows. No new `HostToolId` argument key, no allowlist change.
- Proved the exclusion end to end against the real, locally-built vendored `dxa` binary on the 23-byte tracer fixture: without a known-data range, dxa classifies its `$0810-$0815` entry stub as 6 code bytes (15 data elsewhere); with the SAME six bytes named as a known-data range, the identical six bytes reclassify as data and the window reads 0 code / 21 data -- both halves asserted as measured literals in `dxa-live.test.ts`'s new `EXCLUSION` case.
- Repeated the exercise on a REAL cracked release: extracted `BRUCE LEE (DC)` from Phase 23's `danish.d64` corpus via the committed `anno-d64.ts` reader (no VICE, no broker, no capture pipeline), identified the depacker's own dxa-discovered `$0819-$081f` entry stub as the named range, and asserted -- per address, relatively, never pinned to a byte count of unshipped content -- that dxa's own classification drops every byte in that range from code to data. The extracted release bytes never touch the working tree (written only to a `mkdtemp` scratch directory outside the repository, removed in the test's own `finally`).
- `evidence/35-dxa03-real-image.md` records the release identity (name plus sha256, never the image itself), the extracted entry, the chosen range's basis, both commands verbatim, the before/after classification, and the `D-04` oracle-narrowing statement (this task produced and consumed no capture pair).
- `HOST_TOOL_FAMILY_FLOOR` raised from `2 + 1 + 2 + 1` to `2 + 1 + 2 + 2` for `dxa-blocks.ts`, comment updated to name this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: The emitter -- 12-member vocabulary in, -B and -l files out** - `b88dbd8c` (feat)
2. **Task 2: Wire the emitted files into the run, and prove exclusion on the tracer image** - `6dcae195` (feat)
3. **Task 3: The real-image exercise -- a range from the store, on a corpus release** - `cbc6edd3` (docs)

## Files Created/Modified

See `key-files` in frontmatter for the full list. Highlights:
- `src/mcp/vice/dxa-blocks.ts`, `dxa-blocks.test.ts` -- the emitter and its 14-case hermetic suite.
- `src/mcp/vice/dxa-run.ts` -- `knownDataRows` wiring.
- `src/mcp/vice/dxa-live.test.ts` -- `EXCLUSION`, `OMISSION` and `CORPUS` cases.
- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa03-real-image.md` -- the real-release exercise record.

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written. (PLAN.md's own acceptance-criteria text names a stale "declared-path-key total unchanged at 11" -- the actual, internally-consistent baseline this task inherited from 35-01 is 12; no file needed editing for this, since the value was genuinely unchanged by this task's own work and `host-tool.test.ts`'s own census assertion already asserts 12 against itself. Recorded as a key-decision rather than a deviation, since no code or test behavior needed correcting.)

## Issues Encountered

None. Every acceptance criterion, `<verify>` command and the plan-level `<verification>` block passed on direct execution; the real-vendored-binary and real-corpus preconditions named in Task 3's `<precondition>` were both already satisfied (per the orchestrator's pre-verification), so no HALT was needed.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `DXA-03` is complete.
- `dxa-blocks.ts`'s `emitDataBlocks()`/`emitLabels()` are stated, in the module's own header and in this plan's A-11 decision, as the emitter Phase 37's `AUTO-06`/`AUTO-07` (automatic VIC-pointer-derived graphics ranges) is expected to reuse unchanged with a derived row set -- no second emitter.
- No blockers.

## Self-Check: PASSED

All 3 created/primary files confirmed present on disk (`dxa-blocks.ts`, `dxa-blocks.test.ts`,
`evidence/35-dxa03-real-image.md`); all 3 claimed commit hashes (`b88dbd8c`, `6dcae195`,
`cbc6edd3`) confirmed in `git log`. All task-level `<acceptance_criteria>` and the plan-level
`<verification>` block were re-run immediately before this SUMMARY was written: `dxa-blocks.test.ts`
14/14 pass; `VICE_LIVE_DXA=1 node --test dxa-live.test.ts` 3/3 pass (1 skipped -- the corpus
case, correctly gated absent its own second opt-in); `VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1
node --test dxa-live.test.ts` 4/4 pass, 0 skipped; `host-tool.test.ts`/`anno-seam.test.ts`/
`hostpath-consumers.test.ts` 128/128 pass; `npm run typecheck` clean; `git status --porcelain`
shows zero `.d64` files. Full `npm run test:automated` floor: 3371 tests, 3363 pass, 2 fail --
the SAME 2 pre-existing, phase-35-unrelated `anno-register.test.ts` failures recorded at the
wave-2 post-merge floor (3357/3355/2), a delta of exactly +14 tests (this plan's own
`dxa-blocks.test.ts`), zero new failures.

---
*Phase: 35-dxa-vendored-and-parsed*
*Completed: 2026-09-04*
