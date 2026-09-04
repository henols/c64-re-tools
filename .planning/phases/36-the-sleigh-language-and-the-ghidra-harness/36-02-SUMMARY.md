---
phase: 36-the-sleigh-language-and-the-ghidra-harness
plan: 02
subsystem: reverse-engineering-harness
tags: [ghidra, host-tool-seam, argv-construction, loader, preflight]

# Dependency graph
requires:
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: plan 36-01's ghidra.analyze required processor field, LANGUAGE_ID_PATTERN, GHIDRA_STOCK_6502_LANGUAGE_FILES, and ghidra-run.ts's own already-forward-compatible GhidraRunArgs shape (this plan's seven fields were pre-anticipated there as optional)
provides:
  - Seven new typed ghidra.analyze wire fields (importRoute, loaderBaseAddr, noanalysis, scriptPath, entrypointsPath, exportPath, expectedClassificationLines) closing the seam-argv surface gap 36-RESEARCH.md measured
  - buildAnalyzeHeadlessArgv()'s full fixed-order argv -- -processor, -loader BinaryLoader, -loader-baseAddr, -noanalysis, -scriptPath, -preScript+entrypoints, -postScript+export+expected-lines, -deleteProject
  - installedLanguageIds() and the checked, non-materialising ghidra.analyze language preflight (refuses a language that cannot load, before any child process is spawned)
  - The export-file second outputs[] entry, digested by the existing loop with no new digest code
affects: [36-03-java-scripts-and-run-log-gates, 36-04-live-ghidra-suites, 36-06-opcode-sweep]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 30200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A checked, non-materialising preflight: read installed-language metadata from disk (no child process), refuse by name on a mismatch, never fix -- the same posture as the existing GHIDRA_HOME/analyzeHeadless-existence refusals it sits beside."
    - "Route-derived defaults with an explicit conflict refusal: an enum field (importRoute) supplies a default for a related raw-value field (loaderBaseAddr), and a caller-supplied value that disagrees with the route's own fixed value is refused by name rather than silently honoured or silently overridden."

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/resources/ghidra-project.mjs
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/ghidra-project.test.ts

key-decisions:
  - "loaderBaseAddr is REQUIRED (never optional) inside buildAnalyzeHeadlessArgv() itself, mirroring processor's own required/re-validated treatment -- host-tool.mts always supplies a value (the caller's own validated one, or the route's own default via importRouteBaseAddr()) before calling it, so the wire field stays optional while the argv-builder's own field stays always-present and independently re-checked."
  - "The checked preflight lives inside buildHostToolArgv()'s ghidra.analyze branch, immediately after the existing GHIDRA_HOME/analyzeHeadless-existence refusals and before argv is built -- joining the SAME refuse-by-name voice those two checks already use, per the plan's own <read_first> pointer."
  - "expectedClassificationLines without exportPath is ALSO refused (a deviation beyond the plan's literally-stated rule, which only named 'exportPath or expectedClassificationLines with no postScript') -- the export script's own getScriptArgs()[1] positional contract means expectedClassificationLines with no exportPath would silently occupy the WRONG argv position (postScript's argument 0) rather than reporting a coherent error."
  - "withFakeGhidraHome() and one hand-built GHIDRA_HOME test fixture now plant a synthetic Ghidra/Processors/fake6502/data/languages/fake6502.ldefs declaring '6502:LE:16:default' with an existing (empty) .sla sidecar -- required once Task 2's preflight landed, since every pre-existing ghidra.analyze test fixture names that processor and would otherwise trip the NEW 'not declared' refusal rather than reaching its own intended assertion."

patterns-established:
  - "Second-layer re-validation for every new field in buildAnalyzeHeadlessArgv() (ghidra-project.mts), independent of host-tool.mts's own normaliseHostToolRequest() checks -- mirrors the pre-existing processor/dot-segment/parent-segment re-check discipline, extended to loaderBaseAddr, noanalysis, expectedClassificationLines, and the three new path-shaped fields' parent-segment and no-script-without-argument rules."

requirements-completed: []  # GHID-01 is shared with sibling plans 36-03/36-04 (requirements.ready-ids reports 0/1 ready) -- not marked complete until every plan declaring it has its own SUMMARY.md (shared-ID gate, #2388).

coverage:
  - id: D1
    description: "The seven new ghidra.analyze wire fields are typed, allowlisted, classified path or non-path, and emitted as separate argv entries in the MEASURED fixed order for both import routes"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: the full prg-route argv is pinned by deep equality against the expected literal array, and no entry contains a space"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: the full flat64k-route argv is pinned by deep equality against the expected literal array, and no entry contains a space"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: is deterministic with every new field populated -- two calls with identical input return deeply equal argv arrays"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every refusal the plan names (absent/invalid importRoute, route-conflicting or malformed loaderBaseAddr, non-boolean noanalysis, invalid expectedClassificationLines, a script argument with no script, workspace-escaping scriptPath/entrypointsPath/exportPath including through a symlink) is proven with a case asserting on the message naming the offending field"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#normaliseHostToolRequest: every new ghidra.analyze field refusal names the offending field in its message"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: a scriptPath/entrypointsPath/exportPath reaching outside the workspace root through a symlink is refused, naming the resolved path and the root"
        status: pass
    human_judgment: false
  - id: D3
    description: "ghidra.analyze refuses by name, before any child process is spawned, when the requested processor is not declared by any installed Ghidra language or is declared but its slafile is missing on disk -- the preflight checks and never fixes, proven unchanged on a synthetic tree after a refusal"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: ghidra.analyze refuses a processor whose case differs from the installed declaration -- the preflight comparison is byte-exact and case-sensitive"
        status: pass
      - kind: manual_procedural
        ref: "shell verification (this plan's own Task 2 <verify> block): a synthetic Ghidra tree with only the real stock 6502.ldefs installed, requesting the not-yet-installed 6502:LE:16:nmos, refuses naming both ids and prints PREFLIGHT_REFUSED; re-run against a declared-but-missing-slafile fixture confirms the second refusal message and an unchanged synthetic tree (byte-for-byte, via find | md5sum before/after)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A repeated runId is refused the second time and two distinct run ids succeed and produce two distinct run-log paths, via a full runHostTool() invocation against a fake analyzeHeadless stand-in; the run log captures stdout then stderr with a correct byteLength, and a supplied exportPath yields a second digested results[] entry"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: ghidra.analyze running twice with the SAME runId refuses the second time; two different run ids on the same image succeed both times and produce two distinct run-log paths"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: a full ghidra.analyze invocation reports results[0] naming a file containing the stand-in's stdout line followed by its stderr line, with a byteLength equal to the file's size on disk; with exportPath supplied, results has a second entry digesting the export file"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 36 Plan 02: The SLEIGH Language and the Ghidra Harness -- Seam-Argv Surface Summary

**Seven new typed `ghidra.analyze` wire fields (`importRoute`, `loaderBaseAddr`, `noanalysis`, `scriptPath`, `entrypointsPath`, `exportPath`, `expectedClassificationLines`) closing the seam-argv gap `36-RESEARCH.md` measured, plus a checked, non-materialising language preflight that refuses an unloadable processor before any child process spawns.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-04T16:23:00Z (approx.)
- **Completed:** 2026-09-04T16:58:33Z
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- Added `importRoute` (required `"prg" | "flat64k"` enum), `loaderBaseAddr` (anchored lowercase-hex, route-defaulted via `importRouteBaseAddr()`, route-conflict-checked on `flat64k`), `noanalysis` (strict boolean), `scriptPath`/`entrypointsPath`/`exportPath` (path-bearing, routed through `resolveWorkspacePath()`), and `expectedClassificationLines` (non-negative integer) to `ghidra.analyze`'s typed allowlist and `GhidraAnalyzeArgs`.
- `buildAnalyzeHeadlessArgv()` now emits the full MEASURED order: two positional project args, `-import`, `-processor`, `-loader BinaryLoader` (fixed literal, never a wire field), `-loader-baseAddr`, `-noanalysis` when set, `-scriptPath` when present, `-preScript`+entrypoints-file when both present, `-postScript`+export-path+expected-line-count when each present, `-deleteProject` last -- deterministic across two calls, verified end to end against a real Node-executed `analyzeHeadless` stand-in.
- Added `LOADER_BASE_ADDR_PATTERN`, `GHIDRA_IMPORT_ROUTES`, `importRouteBaseAddr()`, and `installedLanguageIds()` to `ghidra-project.mts` -- the last walks `Ghidra/Extensions/*/data/languages/*.ldefs` and `Ghidra/Processors/*/data/languages/*.ldefs` via a narrow anchored attribute match (no XML parser dependency), returning a sorted `{id, ldefsPath, slafile, slafileExists}` list, provable with no Ghidra installation present.
- Wired the checked preflight into `buildHostToolArgv()`'s ghidra branch: refuses by name (naming the declared id list, or the missing `slafile` path and `ghidra.installExtension` as the remedy) before argv is ever built or a child process ever spawned -- byte-exact, case-sensitive comparison, verified to leave a synthetic Ghidra tree byte-for-byte unchanged after a refusal.
- `outputs[0]` stays the run log unconditionally; `exportPath`, when supplied, becomes a second `outputs[]` entry digested by the pre-existing `digestOutputFile()` loop with no new code.
- Extended both hermetic suites: an exact-contents census for `ghidra.analyze`/`ghidra.installExtension`'s allowlists, a data-driven refusal table covering every new field (each asserting the message names the offender), a symlink-escape case for the three new path fields, the full pinned prg-route and flat64k-route argv arrays (deep equality, no-space assertion), determinism, and full `runHostTool()` round trips proving the run-log/export-slot digest shape and same-runId/different-runId idempotency.

## Task Commits

Each task was committed atomically:

1. **Task 1: The seven typed fields and the fixed-order argv** - `a3716d54` (feat)
2. **Task 2: The checked, non-materialising language preflight** - `58c4a5ae` (feat)
3. **Task 3: Hermetic seam tests — census, confinement, ordering and idempotency** - `afe852ba` (test)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - seven new `ghidra.analyze` fields, their validation (including the route-defaulted/route-conflict-checked `loaderBaseAddr`), the checked language preflight, the export-slot `outputs[]` extension
- `src/mcp/vice/ghidra-project.mts` - `LOADER_BASE_ADDR_PATTERN`, `GHIDRA_IMPORT_ROUTES`, `importRouteBaseAddr()`, `installedLanguageIds()`, and `buildAnalyzeHeadlessArgv()`'s extended fixed-order argv with second-layer re-checks for every new field
- `src/mcp/vice/resources/host-tool.mjs`, `src/mcp/vice/resources/ghidra-project.mjs` - regenerated via `node build.ts`, byte-identical to a fresh build
- `src/mcp/vice/host-tool.test.ts` - fixture fixes for 24 pre-existing tests broken by `importRoute`/`loaderBaseAddr` becoming required (mirrors 36-01's own `processor` precedent), plus the new census/refusal/symlink/run-log/idempotency tests
- `src/mcp/vice/ghidra-project.test.ts` - fixture fixes for the same reason, plus the new second-layer-refusal and pinned-argv tests

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: `expectedClassificationLines` without `exportPath` is refused even though the plan's literal wording only named "exportPath or expectedClassificationLines with no postScript" -- without `exportPath`, `expectedClassificationLines` would silently occupy the export script's argument-0 position instead of argument-1, a correctness bug the literal rule as written would not have caught (Rule 2 deviation, detailed below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `expectedClassificationLines` without `exportPath` was not independently refused**
- **Found during:** Task 1's own action-text review (the plan's "refuse a script argument with no script" rule pairs `entrypointsPath`↔`preScript` and `exportPath`/`expectedClassificationLines`↔`postScript`, but does not separately pair `expectedClassificationLines`↔`exportPath`)
- **Issue:** `GhidraStructExport.java`'s own usage contract is `getScriptArgs()[0]` = export path, `getScriptArgs()[1]` = expected line count. A request supplying `expectedClassificationLines` with `postScript` present but `exportPath` ABSENT would have pushed the expected-lines value into the export script's argument-0 slot instead of argument-1 -- silently misinterpreted as a path, not a count.
- **Fix:** Added an independent refusal (both in `host-tool.mts`'s `normaliseHostToolRequest()` and, as a second layer, in `ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()`) naming `expectedClassificationLines` when `exportPath` is absent.
- **Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/ghidra-project.mts`, plus a test case in each of `src/mcp/vice/host-tool.test.ts` / `src/mcp/vice/ghidra-project.test.ts`.
- **Verification:** `node --test host-tool.test.ts ghidra-project.test.ts` -- both new cases pass.
- **Committed in:** `a3716d54` (Task 1), `afe852ba` (Task 3's own test case)

**2. [Rule 1 - Bug] 24 pre-existing tests broke when `importRoute`/`loaderBaseAddr` became required, and again when the Task 2 preflight landed**
- **Found during:** Task 1's own verify step (`node --test host-tool.test.ts ghidra-project.test.ts`), and again after Task 2's preflight wiring
- **Issue:** Every pre-existing `ghidra.analyze` test fixture predates the now-required `importRoute` field (24 failures after Task 1); after Task 2's preflight landed, 8 more of those same fixtures (the ones using `withFakeGhidraHome()`'s synthetic `GHIDRA_HOME` with no declared language) began failing the NEW "processor not declared" refusal.
- **Fix:** Added `importRoute`/`loaderBaseAddr` to every affected fixture (mirrors 36-01's own `processor` precedent); extended `withFakeGhidraHome()` (and one hand-built `GHIDRA_HOME` fixture) to plant a synthetic `Ghidra/Processors/fake6502/data/languages/fake6502.ldefs` declaring `6502:LE:16:default` with an existing empty `.sla` sidecar, so the preflight finds the processor every pre-existing fixture already names.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/ghidra-project.test.ts`.
- **Verification:** `node --test host-tool.test.ts ghidra-project.test.ts` -- 178/178 pass (90 + 44 + 44 across the two files' full runs, no failures).
- **Committed in:** `a3716d54` (Task 1's fixture fixes), `58c4a5ae` (Task 2's `withFakeGhidraHome()` extension)

### Commit-granularity note (not a defect)

`ghidra-project.mts`'s `installedLanguageIds()` function (Task 2's own stated deliverable) was authored and committed as part of Task 1's commit (`a3716d54`), one commit earlier than its own task boundary, because splitting a single authored edit into two temporally-separated hand-edits (write it, remove it, re-add it) across two commits carried more risk of introducing a transcription error than the granularity purity was worth. The function is inert (unimported by `host-tool.mts`) until Task 2's commit (`58c4a5ae`) wires it into `buildHostToolArgv()`'s ghidra branch -- so Task 1's own commit carries no BEHAVIORAL change from Task 2's deliverable, only its dormant source. Both the function and its wiring are proven working, and every task's own `<verify>`/`<acceptance_criteria>` passed at its own commit boundary (Task 1's commit was verified with the preflight-call temporarily absent from `host-tool.mts`, confirming Task 1's tests pass independent of Task 2's behavior).

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical), 1 auto-fixed (Rule 1 - bug, two waves), plus 1 commit-granularity note.
**Impact on plan:** The Rule 2 fix closes a real correctness gap the plan's literal wording would have missed; the Rule 1 fixes were necessary for the plan's own stated verification to pass. No scope creep.

## Known Stubs

None.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. `GHIDRA_HOME` remains the existing, already-documented host prerequisite from Phase 34.

## Next Phase Readiness

- The seam can now express every flag and script argument both routes of `GHID-01`'s harness need; plan 36-03 (Java scripts and run-log gates) and plan 36-04 (live Ghidra suites) can drive `ghidra.analyze` with the full field set this plan added.
- `GHID-01` stays `requirements-completed: []` here -- shared with sibling plans 36-03/36-04, and `requirements.ready-ids` reports 0/1 ready. It will be marked complete once the LAST plan declaring it (36-03 or 36-04, whichever finishes last) produces its own SUMMARY.md.
- `ghidra-run.ts` (plan 36-01) already anticipated this plan's seven fields as optional members of `GhidraRunArgs`, forwarding each to the wire only when the caller supplies it -- no changes to that file were needed this plan.
- No blockers.

---
*Phase: 36-the-sleigh-language-and-the-ghidra-harness*
*Completed: 2026-09-04*

## Self-Check: PASSED

- All 6 declared modified files verified present on disk with `[ -f ]`.
- All 3 task commits (`a3716d54`, `58c4a5ae`, `afe852ba`) verified present in `git log --oneline --all`.
- Re-ran every plan-level `<verification>` command: `npm run typecheck` green; `node build.ts` + `resources-sync.test.ts` green (byte-identical, no drift); `node --test host-tool.test.ts ghidra-project.test.ts` -- 134 tests combined (90 + 44), 0 fail; the Task 2 synthetic-tree preflight shell command printed `PREFLIGHT_REFUSED`.
- Re-ran `npm run test:automated`: 3399 tests, 3386 pass, 2 fail (both in `anno-register.test.ts`), matching the measured baseline exactly (baseline: 2 failing in 1 file) -- no regression, 16 new tests added since the baseline reading.
