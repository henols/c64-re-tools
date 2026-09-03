---
phase: 34-the-host-tool-execution-seam
plan: 05
subsystem: infra
tags: [ci-gate, skill-scripts, spawn-seam, host-tool, closing-sweep]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-04's migration of acme.mjs and packer-finding.mjs onto the host-tool execution seam (the clean tree this gate's non-vacuous scope requires), plan 34-06's second prefix floor closing the ANNO_MODULE_FLOOR blind spot before this plan's closing sweep runs"
provides:
  - "scripts/check-no-skill-external-spawn.mjs: the whole-tree gate banning a skill script from spawning a host binary directly, scanning both the packed-tarball route (via check-npm-packages.mjs's packFiles(), post-prepack) and the git-tracked plugin route, never git ls-files alone"
  - "src/mcp/vice/skill-external-spawn-gate.test.ts: 18 cases proving the gate bites on three planted violation shapes and holds on four exemption shapes including one real on-disk file (vsf-slice.mjs), both scope floors hand-pinned, empty-input non-vacuity, ordering/idempotency all asserted"
  - "One CI step in .github/workflows/ci.yml's build job, adjacent to check-npm-packages.mjs, a 3-line diff"
  - "evidence/34-guard-dispositions.md's ## Phase close section: all twelve guards this phase touched observed green together on the merged (un-worktreed) tree, with the test:automated delta recorded against the measured baseline"
affects: []

actuals:
  tokens: 10358
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A two-pass comment/string scanner (stripComments() keeps literal bodies intact for later inspection; a second blankStrings() pass -- length-preserving -- is used ONLY to locate genuine call-site syntax, so a banned name spelled out inside a decoy string can never be discovered as a call, while the real argument text is read back from the unblanked pass at the same index)"
    - "A predicate's own non-vacuity failure is a distinguishable non-array sentinel, never an empty array, so Array.isArray() alone tells a caller 'clean scan' from 'refused to scan nothing'"
    - "Two independent scope routes (packed-tarball via the existing packFiles() seam, git-tracked tree via git ls-files) feeding the SAME named predicate, mirroring plan 34-06's own two-scope discipline"

key-files:
  created:
    - scripts/check-no-skill-external-spawn.mjs
    - scripts/check-no-skill-external-spawn.d.mts
    - src/mcp/vice/skill-external-spawn-gate.test.ts
  modified:
    - .github/workflows/ci.yml
    - .planning/phases/34-the-host-tool-execution-seam/evidence/34-guard-dispositions.md

key-decisions:
  - "BANNED_COMMAND_SHAPES includes both of the packer oracle's documented names (`unp64`, the default command, and `UNP64`, its primary env-var-derived name), the future disassembly/discovery seam consumer (`dxa`), the Ghidra headless launcher (`analyzeHeadless`), the three VICE utilities 34-RESEARCH.md names as future consumers (`c1541`, `petcat`, `cartconv`), and the emulator binary (`x64sc`) alongside the assembler (`acme`) -- a defensible reading of the plan's 'packer oracle's two documented command names' phrase, since no second literal command name (distinct from the env-var name) appears anywhere in this codebase"
  - "The predicate never blanks string bodies outright (unlike shipped-modules.ts's codeOnly() default) because THIS gate's violation shape can live inside a literal (a bare command-name string as a spawn call's first argument) -- blanking would make it unobservable. A second, length-preserving blanked pass is used only to locate genuine call syntax, keeping the decoy-string false positive closed without losing the bare-literal true positive."
  - "Both scope floors (TRACKED_SCOPE_FLOOR, PACKED_SCOPE_FLOOR) are hand-pinned at 6, exactly the number the plan's own <behavior> text specifies, rather than the higher measured counts (16 tracked, 15 packed) -- a floor lower than the measured count is still a real, failable floor, and pinning at the plan's own stated number keeps the test's intent traceable to the text that specified it."
  - "check-no-skill-external-spawn.d.mts (a companion .d.mts declaration file, not named in the plan's files_modified list) was added under Rule 3 -- strict typecheck cannot resolve a plain .mjs cross-package import without one, mirroring scripts/lib/anno-cli-invocations.d.mts's own established precedent for the identical cross-tree import shape."

requirements-completed: [SEAM-05]

coverage:
  - id: D1
    description: "The whole-tree gate exists, discovers rather than enumerates, reads both the packed-tarball route and the tracked-plugin route, refuses an empty scope, and reports OK on the migrated tree (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: other
        ref: "node scripts/check-no-skill-external-spawn.mjs -- OK, tracked-tree 16 files, packed-tarball 15 files"
        status: pass
      - kind: other
        ref: "node --check scripts/check-no-skill-external-spawn.mjs -- clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate is observed BITING on three planted violation shapes (argv literal, indirect local, shell interpolation) through the shipped predicate, and observed NOT biting on four exemption shapes including one real on-disk file asserted both in scope and unreported (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: unit
        ref: "skill-external-spawn-gate.test.ts (18/18 pass, fail 0)"
        status: pass
      - kind: other
        ref: "planted-violation CLI probe -- GATE_BITES n=1; negative-control CLI probe -- NEGATIVE_CONTROL_IN_SCOPE_AND_CLEAN n=16"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate runs in CI's build job exactly once, in a form ci-suite-coverage.test.ts's textual extraction recognises, with a diff of at most 5 added lines and 0 deleted (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: other
        ref: "grep -c 'check-no-skill-external-spawn' .github/workflows/ci.yml == 1; git diff --numstat == 3 added, 0 deleted"
        status: pass
      - kind: unit
        ref: "node --test ci-suite-coverage.test.ts (10/10 pass, fail 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every guard this phase touched is observed green TOGETHER on the merged tree -- and since this run carried no worktree isolation, the tree measured IS the merged tree, not a simulation of one -- with the test:automated delta recorded against the measured baseline rather than a zero-floor claim"
    verification:
      - kind: other
        ref: "13-file closing suite (183/183 pass) + broker-control.test.ts (64/64 pass) + npm run typecheck (clean) + both gate scripts (OK) + three skills suites (38 pass, 1 named skip, 0 fail)"
        status: pass
      - kind: other
        ref: "npm run test:automated: 3222 tests, 3214 pass, 2 fail -- delta 0 against the documented baseline (same 2 pre-existing anno-register.test.ts failures)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 05: SEAM-05's Closing Gate Summary

**`scripts/check-no-skill-external-spawn.mjs` bans a skill script from spawning a host binary directly, scanning the packed-tarball route and the git-tracked plugin route through one shared predicate, observed biting on three planted violations and holding on four exemptions (including the real `vsf-slice.mjs` on-disk control), now wired into CI's `build` job with the phase's closing sweep recorded on the un-worktreed merged tree.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-03T~15:10:00Z (approx.)
- **Completed:** 2026-09-03T16:05:08Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `scripts/check-no-skill-external-spawn.mjs`: one exported pure predicate (`skillScriptSpawnViolations`) plus two exported scope enumerators (`skillScriptFilesFromPackedTarball`, `skillScriptFilesFromTrackedTree`) plus an entry-point-guarded driver, following `check-npm-packages.mjs`'s own `IS_ENTRY_POINT` idiom. The predicate uses a two-pass comment/string technique: `stripComments()` removes `//`/`/* */` comments while keeping every string body intact (so a bare-literal violation like `spawnSync("acme", ...)` stays observable), then `blankStrings()` produces a length-preserving second pass used ONLY to locate genuine call-site syntax -- a banned name spelled out inside a decoy string can never be discovered as a call, because its text is blanked to `#` in that pass, while the real argument text is read back from the unblanked pass at the identical index.
- Runs against the migrated tree (plan 34-04's `acme.mjs`/`packer-finding.mjs`) and reports `check-no-skill-external-spawn: OK -- tracked-tree 16 files, packed-tarball 15 files` -- zero violations, on the first run, with no fix-up needed.
- `src/mcp/vice/skill-external-spawn-gate.test.ts`: 18 cases -- three planted violations (bare literal, indirect local, shell interpolation), two interpreter exemptions (direct `process.execPath`, and through a local declared from it), two false-positive controls (a banned name inside a comment/non-call string, and `RegExp.prototype.exec()`), the real on-disk negative control (`vsf-slice.mjs`, asserted both IN the tracked scope and ABSENT from the violation list, as two separate assertions), both scope floors hand-pinned at 6 (the plan's own stated number, well below the measured 16/15), the empty-input non-vacuity sentinel, ordering (reversed input, byte-identical output) and idempotency, and the committed tree passing on both real scopes. All 18 cases pass on the first run.
- One CI step added to `.github/workflows/ci.yml`'s `build` job, immediately after "Validate npm package contents" (the other `packFiles()` caller, so the two stay sequential in the same job) -- a 3-line diff, exactly one occurrence, and `ci-suite-coverage.test.ts` still reports `fail 0` (10/10 pass) after the edit.
- `evidence/34-guard-dispositions.md` gained a `## Phase close` section: all twelve guards this phase touched (the eight plan 34-01 named, plus the four suites this phase created -- `host-tool`, `host-tool-transport`, `ghidra-project`, `skill-external-spawn-gate`) recorded `green`, observed together in a single 13-file `node --test` invocation (183/183 pass) plus `broker-control.test.ts` run separately (64/64 pass, not part of that 13-file list). Since this run carried no worktree isolation (auto-degraded to `ISOLATION=none`), the tree measured genuinely IS the merged tree -- stated plainly in the evidence rather than describing a merge that never happened. `npm run test:automated`: 3222 tests, 3214 pass, 2 fail -- the SAME two pre-existing failures named in the plan 34-01 baseline (`anno-register.test.ts`'s "DIRECTION 5" and "planted violation (the negative control)" cases), a delta of 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: The gate script — discovery, not enumeration, over what actually ships** - `93c55fa` (test)
2. **Task 2: The gate observed biting — a planted violation and a real negative control** - `0df32f2` (test)
3. **Task 3: The gate wired into the only CI job that runs on a pull request, and the phase's closing sweep** - `a06bc82` (docs)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `scripts/check-no-skill-external-spawn.mjs` - the whole-tree gate: `BANNED_COMMAND_SHAPES`, `skillScriptSpawnViolations()`, `skillScriptFilesFromPackedTarball()`, `skillScriptFilesFromTrackedTree()`, and an entry-point-guarded driver
- `scripts/check-no-skill-external-spawn.d.mts` - type declarations for the `.mjs` gate, so the colocated TypeScript test typechecks under strict mode (mirrors `scripts/lib/anno-cli-invocations.d.mts`)
- `src/mcp/vice/skill-external-spawn-gate.test.ts` - 18 cases proving the gate bites and holds correctly, plus non-vacuity/ordering/idempotency and the committed-tree-passes assertions
- `.github/workflows/ci.yml` - one step in the `build` job invoking the new gate
- `.planning/phases/34-the-host-tool-execution-seam/evidence/34-guard-dispositions.md` - `## Phase close` section recording all twelve guards green together plus the closing `test:automated` delta

## Decisions Made

See `key-decisions` in frontmatter: the `BANNED_COMMAND_SHAPES` membership reasoning for the packer oracle's "two documented names," the string-preserving two-pass scanner design, the hand-pinned floor value (6, matching the plan's own stated number rather than the higher measured counts), and the added `.d.mts` companion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scripts/check-no-skill-external-spawn.mjs` has no type declarations, and strict `tsc --noEmit` cannot resolve a plain `.mjs` cross-package import without one**
- **Found during:** Task 2, first `npm run typecheck` after writing the test file
- **Issue:** `skill-external-spawn-gate.test.ts` imports `skillScriptSpawnViolations`/`skillScriptFilesFromTrackedTree`/`skillScriptFilesFromPackedTarball` from `../../../scripts/check-no-skill-external-spawn.mjs`. With `allowJs: false` and `strict: true`, TypeScript reported `TS7016: Could not find a declaration file` and a downstream `TS7006` implicit-`any` on a callback parameter whose type depended on the missing declaration.
- **Fix:** Added `scripts/check-no-skill-external-spawn.d.mts`, mirroring `scripts/lib/anno-cli-invocations.d.mts`'s own established precedent for the identical cross-tree import shape (`anno-cli-invocations.test.ts` imports from `scripts/lib/anno-cli-invocations.mjs` the same three-levels-up way).
- **Files modified:** `scripts/check-no-skill-external-spawn.d.mts` (new)
- **Verification:** `npm run typecheck` -- clean, 0 `error TS` lines.
- **Committed in:** `0df32f2` (Task 2 commit)

**2. [Rule 1 - Bug] The plan's own `<verify>` snippet for the planted-violation CLI probe (Task 2) mixes `require()` with `--input-type=module` and top-level `await`, which Node refuses as ambiguous module syntax**
- **Found during:** Task 2, running the plan's own verify command verbatim
- **Issue:** `node --input-type=module -e '... await import(...); const src=require("node:fs")...'` throws `ERR_AMBIGUOUS_MODULE_SYNTAX: Cannot determine intended module format because both 'require' and top-level await are present.` This is a defect in the verify text itself, not in this plan's implementation -- the semantic check it describes (the gate bites on a planted violation) is sound.
- **Fix:** Ran the equivalent check with `import { readFileSync } from "node:fs"` instead of `require("node:fs")`, which is unambiguous under `--input-type=module`. No source file was changed; this is a verification-tooling workaround, recorded here so a future re-run of the plan's literal text is not mistaken for a new regression.
- **Files modified:** none
- **Verification:** The corrected command printed `GATE_BITES n=1` as intended.
- **Committed in:** n/a (verification-only; no commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 -- a missing type declaration required by strict typecheck for a cross-package `.mjs` import the plan's own text specified; 1 Rule 1 -- a pre-existing bug in the plan's own verify snippet, worked around without touching any source file).
**Impact on plan:** Neither was scope creep. The `.d.mts` addition is the mechanical, anticipated consequence of the cross-package import shape the plan's own action text specifies (and which `anno-cli-invocations.test.ts` already establishes needs one). The verify-snippet workaround changed no file at all -- it only affected how this executor confirmed the gate's behavior locally.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- This is the last plan of Phase 34. SEAM-05 is closed: no skill script can reach a host binary directly without CI catching it on the very next pull request, and the gate's own scope discipline (packed tarball plus tracked tree, never `git ls-files` alone) matches the phase's own Standing Constraint.
- `evidence/34-guard-dispositions.md`'s `## Phase close` section is the one place a future reader can see all twelve guards this phase touched confirmed green together, plus the closing `test:automated` delta -- no separate "is everything actually green" investigation should be needed before shipping this phase.
- The two pre-existing `anno-register.test.ts` failures (undeclared `STORE-04`/`STORE-06`/`MCP-04` requirement ids) remain open and out of this phase's scope, as they have been since plan 34-01's own baseline measurement.
- No blockers.

## Self-Check: PASSED

- FOUND: scripts/check-no-skill-external-spawn.mjs
- FOUND: scripts/check-no-skill-external-spawn.d.mts
- FOUND: src/mcp/vice/skill-external-spawn-gate.test.ts
- FOUND commit: 93c55fa
- FOUND commit: 0df32f2
- FOUND commit: a06bc82
- `node --check scripts/check-no-skill-external-spawn.mjs && node scripts/check-no-skill-external-spawn.mjs`: OK, tracked-tree 16 files, packed-tarball 15 files
- `node --test skill-external-spawn-gate.test.ts`: 18/18 pass
- Planted-violation CLI probe: `GATE_BITES n=1`
- Negative-control CLI probe: `NEGATIVE_CONTROL_IN_SCOPE_AND_CLEAN n=16`
- `node scripts/check-npm-packages.mjs`: OK
- `node --test ci-suite-coverage.test.ts`: 10/10 pass
- `npm run typecheck`: clean
- 13-file closing suite: 183/183 pass; `broker-control.test.ts`: 64/64 pass
- Three skills suites (`packer-finding.test.mjs`, `vsf-slice.test.mjs`, `mcp-module.test.mjs`): 38 pass, 1 named skip, 0 fail
- `npm run test:automated`: 3222 tests, 3214 pass, 2 fail -- delta 0 against the documented baseline
- `evidence/34-guard-dispositions.md`: `## Phase close` section present, 12 `PHASE_CLOSE_GUARD_` lines, all `green`

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
