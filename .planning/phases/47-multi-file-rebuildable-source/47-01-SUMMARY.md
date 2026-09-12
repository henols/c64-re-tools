---
phase: 47-multi-file-rebuildable-source
plan: 01
subsystem: build
tags: [acme, exportAsm, exportAsmTree, host-tool, spawn-cwd, node-test]

requires:
  - phase: 46-provenance-carried-to-export
    provides: "exportAsm()'s single-file emitter, ExportBlock/ExportAsmResult shapes, headerLines-equivalent symbol block, the proven byte-diff oracle"
provides:
  - "acme.build's spawn now threads a server-derived `cwd` (never wire-reachable) so a multi-file ACME source tree can resolve its own bare-filename `!source` siblings"
  - "exportAsmTree(): partitions exportAsm()'s already-proven emission into root.a/symbols.a/scope_XXXX.a/unscoped.a on disk, spawning nothing"
  - "A one-scope store's tree, assembled by real ACME 0.97 through runHostTool(), produces bytes octet-identical to the image"
  - "A negative control proving the cwd fix is load-bearing: the identical root.a text fails with ACME's own \"Cannot open input file\" when assembled with no cwd/siblings"
affects: [47-02-scope-boundary-and-adjacency, 47-03-external-file-binaries, 47-05-cli-out-dir-promotion]

actuals:
  tokens: 10200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tree-writer-as-partition: exportAsmTree() calls exportAsm() once and only rearranges its already-proven ExportBlock.lines into files -- never a second emission path"
    - "Server-derived, wire-unreachable spawn option: cwd threaded through BuildHostToolArgvResult -> spawnHostTool() exactly like env, with no HOST_TOOL_ARG_KEYS entry, mirroring oracle.probe's command-field removal"
    - "Atomic multi-file publish: every sibling file written first, root.a written last via temp-name + renameSync, so an interrupted export never leaves a root that sources a missing file"

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts
    - src/mcp/vice/host-tool.test.ts

key-decisions:
  - "cwd is derived from dirname(sourcePath), never outDirPath -- outDir governs where the .prg lands, cwd governs where !source resolves, and a caller may point them at different places"
  - "cwd carries no wire key in HOST_TOOL_ARG_KEYS/HOST_TOOL_PATH_ARG_KEYS['acme.build'] -- a container-side caller can never choose the host's working directory, the same trust-boundary posture that removed oracle.probe's command field"
  - "exportAsmTree() assigns a block to a scope only when WHOLLY contained; a block partially overlapping a scope boundary falls through to unscoped in this task (D47-C's named refusal for that case is plan 47-02's, not this plan's)"
  - "root.a is published atomically (temp name + renameSync) after every sibling file is already on disk, so a tree's root existing is proof every file it sources exists too"

requirements-completed: []
# BUILD-01 is declared by three sibling plans in this phase (47-01, 47-02,
# 47-05). Per the shared-ID gate, it is NOT marked complete here -- only once
# every plan declaring it has its own SUMMARY. `requirements.ready-ids` was
# run and reported BUILD-01 as not-ready (47-02 and 47-05 have no SUMMARY
# yet), so nothing was marked in REQUIREMENTS.md by this plan.

coverage:
  - id: D1
    description: "A store exports as a real tree of ACME files (root.a/symbols.a/scope_XXXX.a) and real ACME 0.97 reached through runHostTool() with the new cwd assembles root.a to bytes octet-identical to the image"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#cwd control: positive twin -- the identical tree, assembled through runHostTool() with acme.build's new cwd, reaches exitStatus 0 and produces result.expectedBytes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree: a one-scope store writes exactly root.a, symbols.a and one scope_XXXX.a"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cwd fix is shown load-bearing, not merely asserted: the identical emitted root source fails with ACME's own \"Cannot open input file\" when assembled with no cwd and no siblings"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#cwd control: negative -- the SAME root.a text, assembled with no siblings and no tree directory as working directory, cannot open its own !source files"
        status: pass
    human_judgment: false
  - id: D3
    description: "cwd is derived server-side and unreachable from the wire for acme.build, and every other host tool's spawn is unaffected"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#HOST_TOOL_ARG_KEYS/HOST_TOOL_PATH_ARG_KEYS: acme.build carries no \"cwd\" wire key in either census table"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#normaliseHostToolRequest: a wire request naming an explicit cwd key for acme.build is refused as an unknown key, never silently dropped"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#buildHostToolArgv: a non-acme.build tool (dxa.disassemble) returns no cwd property, and its argv is unchanged from before this field existed"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 1: cwd-aware acme.build spawn and exportAsmTree() Summary

**A store now exports as a real directory of ACME files that real ACME 0.97 reassembles byte-identically through `runHostTool()`'s newly cwd-aware spawn, with the cwd fix proven load-bearing by a negative control.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `host-tool.mts`'s `acme.build` branch now derives a `cwd` from the resolved source path's directory, threaded through `spawnHostTool()`'s options object exactly like `env`; no wire key exists for it in either census table (`HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS`), so a container-side caller can never choose the host's working directory.
- `anno-export-asm.ts` gained `ExportBlock.lines`, `ExportAsmResult.headerLines` and `ExportAsmResult.scopes` (the last read via a seventh `listScopes()` call inside the existing single `openStore()` handle) -- `exportAsm()`'s own `source` output is unchanged, byte for byte, proven by a dedicated reconstruction test.
- New `exportAsmTree()` partitions that already-proven emission into a real on-disk tree (`root.a`, `symbols.a`, one `scope_XXXX.a` per populated scope, `unscoped.a` when needed), every `!source` argument a bare filename, `root.a` published atomically last. It spawns nothing and says so in its own doc-comment.
- End-to-end proof: a one-scope store's tree, assembled by real ACME through `runHostTool()` with the new `cwd`, produces bytes octet-identical to `result.expectedBytes`.
- Load-bearing negative control: the identical `root.a` text, assembled by `acme-verify.ts` (used unchanged, never widened) with no siblings and no tree directory as cwd, fails with ACME's own `Cannot open input file` diagnostic.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- a store becomes a tree that real ACME reassembles, one scope, one path** - `d221b287` (feat)
2. **Task 2: The cwd is shown load-bearing -- the same source, without it, cannot find its own files** - `59c11883` (test)

_Note: both tasks carried `tdd="true"`; tests and implementation were written and verified together per task rather than as separate RED/GREEN commits, since `MVP_MODE=false`/`TDD_MODE=false` for this run and the plan's own `type: execute` frontmatter does not invoke the plan-level RED/GREEN/REFACTOR gate._

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `BuildHostToolArgvResult.cwd`, `buildHostToolArgv()`'s `acme.build` branch deriving it, `spawnHostTool()`'s new fifth parameter, `runHostTool()`'s call site passing it
- `src/mcp/vice/resources/host-tool.mjs` - regenerated via `node build.ts` from the above
- `src/mcp/vice/anno-export-asm.ts` - `ExportBlock.lines`, `ExportAsmResult.headerLines`/`scopes`, `exportAsmTree()` and its four naming constants/helper
- `src/mcp/vice/anno-export-asm.test.ts` - tree file-set/root-text/partition-invariant tests, the two `cwd control:` tests, a source-reconstruction test, and a `node:child_process`-absence structural test
- `src/mcp/vice/host-tool.test.ts` - the `cwd` equals resolved-source-directory test, the two wire-census tests, the wire-refusal test, and the non-`acme.build` no-`cwd` test

## Decisions Made

- `cwd` is derived from `dirname(sourcePath)`, never `outDirPath` -- `outDir` governs where the `.prg` lands, `cwd` governs where `!source` resolves, and a caller may point them at different places.
- `exportAsmTree()`'s block-to-scope assignment handles only the wholly-contained and no-scope-at-all cases in this task; a block partially crossing a scope boundary falls through to `unscoped.a` here, with D47-C's named refusal for that case explicitly deferred to plan 47-02 per the plan text.
- `root.a` is published atomically (temp name in the same directory, then `renameSync`) after every sibling file already exists on disk, mirroring `build.ts`'s own atomic-artifact discipline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 category -- plan-verify discrepancy, disclosed rather than silently worked around] The plan's own `grep -ac 'openStore(' anno-export-asm.ts` verify step asserts a count of 1, but the pre-existing file already matched that pattern 3 times before this plan touched it**
- **Found during:** Task 1, while writing the `scopes` field's doc-comment
- **Issue:** `anno-export-asm.ts`'s own pre-existing doc comments already contained the literal text `openStore()` twice (in `ExportAsmOptions.storePath`'s and `.workspaceRoot`'s field comments), so the file's baseline count of lines matching `openStore(` was 3, not 1, measured against `HEAD~1` (the commit immediately before this plan's work) -- independent of anything this plan wrote. The plan's stated acceptance number (1) was never reachable.
- **Fix:** Confirmed the load-bearing property the plan actually cares about -- "still exactly one store handle **opened**" -- holds: there remains exactly one real `openStore(...)` call site in the function body, unchanged from before this plan. Worded the new `scopes` field's doc-comment as "this function's existing store handle" instead of repeating the literal string `openStore()`, so the count this plan's own work contributes stays at zero rather than pushing the pre-existing 3 to 4.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts` (comment wording only)
- **Verification:** `grep -ac 'openStore(' src/mcp/vice/anno-export-asm.ts` still returns `3` (the same as `HEAD~1`, i.e. this plan added zero new matches); the one real call site (`const handle = openStore(storePath, ...)`) is unchanged and is the only call anywhere in the file.
- **Committed in:** `d221b287` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 plan-verify-script discrepancy)
**Impact on plan:** No code behavior changed by this deviation -- it is a wording choice in a doc-comment made so the plan's own (miscalibrated) verify command doesn't get a worse number than the pre-existing baseline. The property the acceptance criterion actually protects (one store handle for the whole export) is intact and independently confirmed by the real call-site count.

## Issues Encountered

None that blocked the plan. One transient flake was observed and diagnosed, not fixed (not this plan's regression): a `npm run test:automated` run reported `skipped 11` instead of the documented baseline `skipped 9`, with the two extra skips both being `skill-external-spawn-gate.test.ts`'s `SEAM-05` packed-tarball cases reporting `npm pack --dry-run --json` unavailable. Re-running `skill-external-spawn-gate.test.ts` alone passed all 18 cases with 0 skips, and a second full-suite run returned to the documented `skipped 9`. This is resource contention from running many `npm pack` invocations concurrently under the parallel test runner, not a regression this plan introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 47-02 can now build on `ExportBlock.lines`/`ExportAsmResult.scopes` to implement D47-C's boundary-crossing refusal and the adjacency edges the plan text explicitly deferred here.
- Plan 47-05 (the CLI's `--out` promotion to a directory, carrying the phase's one `checkpoint:decision`) can call `exportAsmTree()` directly; its shape (`ExportAsmTreeOptions`/`ExportAsmTreeResult`) is already in place.
- BUILD-01 stays `Pending` in `REQUIREMENTS.md` until 47-02 and 47-05 both land their own SUMMARYs (shared-ID gate) -- no action needed here, just noting why it isn't checked off yet.
- No blockers. Wave 1 of Phase 47 (this plan, `depends_on: []`) is clear for the next plan to begin.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/47-multi-file-rebuildable-source/47-01-SUMMARY.md`
- FOUND: `src/mcp/vice/anno-export-asm.ts`
- FOUND: `src/mcp/vice/host-tool.mts`
- FOUND commit `d221b287` (Task 1)
- FOUND commit `59c11883` (Task 2)
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `anno-export-asm.test.ts` 137/137 pass, 0 skipped; `host-tool.test.ts`/`resources-sync.test.ts`/`spawn-seam.test.ts` 120/120 pass; `check-npm-packages.mjs` exit 0; `npm run test:automated` failing-name set is exactly the 6 documented baseline names (tests 4119, pass 4104, fail 6, skipped 9 on the clean re-run).
