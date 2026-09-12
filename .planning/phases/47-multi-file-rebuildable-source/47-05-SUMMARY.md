---
phase: 47-multi-file-rebuildable-source
plan: 05
subsystem: build
tags: [acme, export-asm, cli, invocation-gate, directory-output, node-test]

requires:
  - phase: 47-multi-file-rebuildable-source
    provides: "plan 47-01's exportAsmTree()/ExportAsmTreeOptions/ExportAsmTreeResult and plan 47-02's multi-scope partition, boundary refusal and output-directory contract -- the library this plan's CLI layer calls, never re-creates"
provides:
  - "anno export-asm --out is a published-surface DIRECTORY, not a FILE: cmdExportAsm() calls exportAsmTree() and defaultExportAsmOut() returns an extension-free directory path beside the store"
  - "pathIsOrContains(): the one containment predicate generalising 30-REVIEW WR-05's plain-equality input-collision refusal to path-segment containment, applied to all three inputs (store/image/ledger), unconditional under --force"
  - "The invocation gate's FLAG_KINDS[\"export-asm\"][\"--out\"] declares the empty-string kind (\"a directory, which carries no extension\"), kept rather than deleted so the value-presence check WR-18 added survives"
  - "Both shipped skills documenting a runnable anno export-asm --out invocation (c64-program-recon and acme-build) are updated to the directory shape and describe the tree's contents"
affects: [47-03-external-file-binaries, 47-04-branch-symbolization, 47-06-branch-symbolization-continuation]

actuals:
  tokens: 15800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Segment-bounded containment, not string prefix: pathIsOrContains() compares confined realpaths with an appended path separator, so a sibling directory whose name merely starts with the same characters (game-src2 beside game-src) is never a false-positive collision."
    - "Kept-not-deleted table entry: FLAG_KINDS[\"export-asm\"][\"--out\"] stays a real key (now the empty-string kind) rather than being removed when the flag's shape changed, because takesValue() is derived from key membership -- removing it would silently drop the value-presence check."
    - "The CLI adds no second overwrite rule: cmdExportAsm() forwards --force straight to exportAsmTree()'s own output-directory contract (plan 47-02) and reports its refusal through the same single-line error path every other exporter refusal already takes."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-invocations.test.ts
    - scripts/lib/anno-cli-invocations.mjs
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/acme-build/SKILL.md
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "Checkpoint resolved: human selected `promote` (option A, the planner's recommendation) -- `anno export-asm --out` now names a DIRECTORY at every layer, and a store with no scopes takes the same code path (a degenerate three-file tree) rather than a second output shape."
  - "The derived default's fixed suffix is `-src` (extension-free, e.g. `game.prg` -> `game-src`) -- reads as \"the source tree for this image\" without ending in a dot-extension that would make a human or a tool mistake the directory for a file."
  - "refuseOverwrite()'s call-site count moved back down from 3 to 2: cmdExportAsm() no longer calls it at all, since a directory's overwrite question is exportAsmTree()'s own contract, not a file-shaped check reshaped to fit. Both the doc comment and the mechanical call-site-count test (30-REVIEW WR-08) were updated together, exactly as that test's own history records happening once before in the other direction."
  - "The invocation gate scans BOTH shipped skill trees, not just the one file this plan's frontmatter names (c64-program-recon/SKILL.md). Running the plan's own Task 2 verify command surfaced a second shipped skill, acme-build/SKILL.md, documenting the identical now-stale `--out game.a` invocation -- fixed under the same must_have (\"every documented anno export-asm invocation in the shipped skill tree\"), disclosed as a deviation below."
  - "The summary line's new `N data file(s)` figure counts every file exportAsmTree() wrote EXCEPT the two always-written structural files (symbols.a, root.a) -- i.e. the scope files and unscoped.a, the files that actually carry a store's own content. No new store concept was invented for this; `external_file`-backed data tables are 47-03's still-unbuilt feature, and the count is worded so it grows correctly once that lands rather than claiming a capability that does not exist yet."

requirements-completed: [BUILD-01]
# BUILD-01 was declared by three sibling plans in this phase (47-01, 47-02,
# 47-05). This is the LAST of the three to land a SUMMARY, so the shared-ID
# gate's requirements.ready-ids should report it ready during this plan's own
# state-update step.

coverage:
  - id: D1
    description: "anno export-asm --out names a directory and the verb writes a tree (root.a/symbols.a/scope files/unscoped.a); a store with no scopes takes the same code path and gets a degenerate three-file tree, not a second output shape"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: writes an ACME source TREE to the derived default directory beside the STORE and exits 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: --force re-writes a previous export of the same store into the same directory and exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The derived default destination (image basename stem + fixed extension-free suffix, beside the store) goes through the SAME confinement seam (storePathWithinWorkspace()) as a caller-supplied --out"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: an --out outside the workspace root is refused even when both INPUTS are legal, and nothing is created there"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: a --store outside the workspace root is refused by the ONE seam, and nothing is created there"
        status: pass
    human_judgment: false
  - id: D3
    description: "The output directory may not BE, and may not CONTAIN, any of the three inputs (store/image/ledger); --force does not lift that refusal; a paired-direction test proves the refusal is not vacuous"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: --out that IS or CONTAINS the store, the image or the ledger is refused, and --force does NOT lift it (T-47-14)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: PAIRED DIRECTION -- an --out that contains none of the inputs still writes (T-47-14 non-vacuity)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The verb still assembles nothing and still says so in its own output (help text and run output); the byte-diff oracle stays test-only"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#export-asm: --help lists the verb and states, in as many words, that it does NOT assemble"
        status: pass
      - kind: other
        ref: "grep -a -v -E '^\\s*(//|\\*|/\\*)' src/mcp/vice/anno-cli.ts | grep -ac 'NOT been assembled' == 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "The invocation gate keeps its value-presence protection for --out (FLAG_KINDS entry kept, not deleted) while learning the new kind means a directory; both shipped skill trees' documented export-asm invocations argument-check clean"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#export-asm --out: a documented value with no value after it is still refused -- the value-presence check survived the file-to-directory promotion"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#export-asm --out: a documented value naming a .a FILE is now reported -- the table describes what the flag really takes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#FLAG_KINDS kind shape: the empty string (a directory) is accepted, and anything else that is not a lowercase dotted extension is still rejected (phase 47 plan 47-05)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs -- exit 0, every anno invocation across both skill trees argument-checks clean"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 5: Promote `anno export-asm --out` to a Directory Summary

**`anno export-asm --out` now names a directory and the verb writes a whole ACME source tree into it -- the CLI layer over plan 47-01/47-02's `exportAsmTree()`, with the single-file input-collision refusal generalised to path-segment containment and the invocation gate taught the flag's new shape.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2 (plus one checkpoint, resolved by the human before this executor ran)
- **Files modified:** 7

## Accomplishments

- **The checkpoint is resolved.** The plan's `checkpoint:decision` task ("confirm the published-surface change to `anno export-asm --out`") was answered by the human before this run: `promote` (option A, the planner's recommendation). Recorded here rather than re-decided, per this run's own instructions.
- `defaultExportAsmOut()` now returns a DIRECTORY: the store's own directory joined with the image's basename stem plus a fixed, extension-free `-src` suffix (`game.prg` -> `game-src`), confined through the same `storePathWithinWorkspace()` seam a caller-supplied `--out` goes through.
- `cmdExportAsm()` calls `exportAsmTree()` once (never `exportAsm()` directly) and adds no second overwrite rule of its own -- the output-directory's non-empty-destination refusal and its `--force` semantics live entirely in `exportAsmTree()` (plan 47-02), reported through this verb's own single-line error path.
- `pathIsOrContains()` generalises 30-REVIEW WR-05's plain-equality input-collision refusal to CONTAINMENT: the output directory may not BE, and may not CONTAIN, the store, the image or the ledger. Compared by confined realpath with an appended path separator (segment-bounded, not a string prefix), so a sibling directory whose name merely starts the same is never a false collision. `--force` does not lift this refusal, exactly as it never lifted the single-file version.
- The summary line now names the directory and the number of files/data files written, keeping every figure it reported before (`blocks`, `symbols`, `auto-named`, `unexpressible`, `mid-instruction labels`, `enum substitutions`, `exclusions`).
- `FLAG_KINDS["export-asm"]["--out"]` in the invocation gate is kept (not deleted) and now declares the single empty-string kind, meaning "a directory, which carries no extension" -- so a documented `--out` with no value is still refused, and a documented `--out game.a` (the pre-promotion spelling) is now reported as wrong.
- Both shipped skills documenting a runnable `anno export-asm ... --out` invocation -- `c64-program-recon/SKILL.md` and `acme-build/SKILL.md` -- are updated to the directory shape, with a sentence added on what the tree contains.

## Task Commits

Each task was committed atomically:

0. **Checkpoint: confirm the published-surface change to `anno export-asm --out`** - resolved by the human (`promote`) before this executor was spawned; no commit of its own.
1. **Task 1: `--out` becomes a directory, with every existing safety carried over rather than rebuilt** - `534e22b1` (feat)
2. **Task 2: Teach the invocation gate what the flag now means, and make the shipped skill's command true again** - `681133b5` (feat)

**Deviation fix (see below):** `0b4656eb` (fix) - repaired a stale line citation in `module-classification.ts` that Task 1's edits shifted.

_Note: both tasks carried `tdd="true"`; tests and implementation were written and verified together per task rather than as separate RED/GREEN commits, since `MVP_MODE=false`/`TDD_MODE=false` for this run and the plan's own `type: execute` frontmatter does not invoke the plan-level RED/GREEN/REFACTOR gate -- the same disclosed approach plans 47-01 and 47-02 already took, for consistency within this phase._

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` - `defaultExportAsmOut()` rewritten for a directory default; new `pathIsOrContains()` containment predicate; `cmdExportAsm()`'s input-collision check generalised to containment and its body switched from `exportAsm()`+`writeFileSync()` to a single `exportAsmTree()` call; `refuseOverwrite()`'s doc comment updated (3 call sites -> 2); `USAGE`'s `export-asm` block rewritten for the directory shape
- `src/mcp/vice/anno-cli.test.ts` - the whole `export-asm` case group carried forward in directory form (20 tests, up from 21 single-file tests, net reorganised rather than shrunk -- see Deviations), plus the `refuseOverwrite()` call-site-count test updated to 2
- `scripts/lib/anno-cli-invocations.mjs` - `FLAG_KINDS["export-asm"]["--out"]` changed to the empty-string kind, with its comment rewritten to explain why the entry stays rather than being deleted
- `src/mcp/vice/anno-cli-invocations.test.ts` - the kind-shape assertion widened via a shared `isValidFlagKind()` predicate (used by both the real-table check and its own dedicated shape test), plus three new `export-asm --out`-specific cases (missing value, directory passes, `.a` file now reported)
- `src/skills/c64-program-recon/SKILL.md` - the "Static disassembly" section's runnable invocation and its `--out` paragraph updated to the directory shape
- `src/skills/acme-build/SKILL.md` - the "Disassembly" section's runnable invocation and its `--out` paragraph updated identically (see Deviations)
- `src/mcp/vice/module-classification.ts` - one stale line-number citation repaired (see Deviations)

## Decisions Made

- The derived default's fixed suffix is `-src` (extension-free): `game.prg` -> `game-src`. Reads as "the source tree for this image" without ending in a dot-extension a human or tool would mistake for a file.
- `refuseOverwrite()`'s call-site count moved back down from 3 to 2, since `cmdExportAsm()` no longer calls it -- a directory's overwrite question is `exportAsmTree()`'s own contract, not a file-shaped check reshaped to fit. Both the function's doc comment and the mechanical call-site-count test were updated together.
- The summary line's `N data file(s)` figure counts every written file except the two always-written structural ones (`symbols.a`, `root.a`) -- i.e. scope files plus `unscoped.a`. This is a reporting-only count derived from `result.files.length`, not a new store concept; it does not claim `external_file`-backed data tables exist yet (that is 47-03's still-unbuilt feature), and is worded so it grows correctly once that lands.
- The output-directory-contract refusal test and the containment refusal test were split into distinct, more targeted tests (rather than exactly mirroring the old file's 1:1 test count), since a single-file "does it exist" question became a directory's two-rule contract (non-empty refusal, then per-input containment) that reads more clearly as separate properties. The plan's own floor (`grep -ac 'export-asm:'` >= 18) is checked and passes at 20.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, scope corrected to match the plan's own must_have] `acme-build/SKILL.md` also documented the now-stale `anno export-asm ... --out game.a` invocation**
- **Found during:** Task 2, running the plan's own verify command `node scripts/check-skill-cli-invocations.mjs`
- **Issue:** The plan's `files_modified` frontmatter names only `src/skills/c64-program-recon/SKILL.md`, but the invocation gate scans BOTH shipped skill trees for every documented `anno` command, and `acme-build/SKILL.md`'s own "Disassembly" section documented the identical `--out game.a` invocation. The plan's own `must_haves.truths` states "Every documented `anno export-asm` invocation in the shipped skill tree is argument-checked ... and passes" -- singular "the shipped skill tree" but the gate's own read_first notes it scans `src/skills` and the generated `installer/skills` mirror together, and this second file was a genuine second documented instance the plan's task list did not enumerate.
- **Fix:** Updated `acme-build/SKILL.md`'s invocation and its following paragraph to the directory shape, identically in substance to the `c64-program-recon/SKILL.md` edit, adding a sentence on what the tree contains.
- **Files modified:** `src/skills/acme-build/SKILL.md`
- **Verification:** `node scripts/check-skill-cli-invocations.mjs` now reports `OK` (was `FAIL` naming both files before this fix); `node --test skills-planning-vocabulary.test.ts` still `ℹ fail 0`.
- **Committed in:** `681133b5` (Task 2 commit)

**2. [Rule 1 - Bug, a real regression this plan's own Task 1 edit introduced] A stale line-number citation in `module-classification.ts`**
- **Found during:** post-Task-2 full-suite verification (`npm run test:automated`)
- **Issue:** `module-classification.ts`'s own prose cites `anno-cli.ts:409` for `checkAcceptedOptions()` as a survey finding. Task 1's edits to `anno-cli.ts` (new `pathIsOrContains()` helper, an expanded doc comment) shifted that function to line 422, and `module-classification.test.ts`'s DIRECTION 9b control -- which verifies every `path:NN` citation in the module's own source resolves to a real line containing the cited symbol -- caught the drift.
- **Fix:** Updated the one citation from `anno-cli.ts:409` to `anno-cli.ts:422`.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` -- `ℹ fail 0` (was failing DIRECTION 9b before this fix); full `npm run test:automated` re-run afterward confirms the failing-name set returns to exactly the documented 6-name baseline.
- **Committed in:** `0b4656eb` (separate follow-up commit, since it was discovered after Task 2's commit already landed)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug; one a scope correction to satisfy the plan's own stated must_have, one a genuine regression this plan's own edit caused)
**Impact on plan:** Both fixes are necessary corollaries of promoting a published CLI flag's shape, not scope creep: the first makes the plan's own "every documented invocation" truth actually hold across the whole shipped skill tree rather than the one file named in frontmatter; the second repairs a citation drift Task 1's own line-count change caused. Neither changes `anno export-asm`'s runtime behavior.

## Issues Encountered

None that blocked the plan. `npm run test:automated` after all commits reports `tests 4145 / pass 4130 / fail 6 / skipped 9` (up from plan 47-02's `4142/4127/6/9` baseline by this plan's own net new tests), with the failing test NAME set unchanged and identical to the six names recorded in `47-01-PLAN.md`'s measured baseline (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`) -- none of them this plan's regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `anno export-asm --out` is a directory at every layer this phase touches: the library (47-01/47-02), the CLI (this plan), the invocation gate (this plan) and both shipped skills (this plan). BUILD-01 is now ready to mark complete -- all three plans declaring it (47-01, 47-02, 47-05) have landed their own SUMMARYs.
- Plan 47-03 (`external_file` leaving as its own `!binary` file) can build on this directory shape directly: the tree already has a real on-disk destination for however many files a store's data tables end up needing, with no CLI-layer change required to add more files to it.
- No blockers. This plan's own tasks (`depends_on: [47-01]`, already satisfied) are complete, and this is the last plan in the phase's wave depending only on 47-01 -- plan 47-04/47-06's own dependencies are unaffected by this plan's work.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-cli.ts`
- FOUND: `src/mcp/vice/anno-cli.test.ts`
- FOUND: `src/mcp/vice/anno-cli-invocations.test.ts`
- FOUND: `scripts/lib/anno-cli-invocations.mjs`
- FOUND: `src/skills/c64-program-recon/SKILL.md`
- FOUND: `src/skills/acme-build/SKILL.md`
- FOUND: `src/mcp/vice/module-classification.ts`
- FOUND commit `534e22b1` (Task 1)
- FOUND commit `681133b5` (Task 2)
- FOUND commit `0b4656eb` (deviation fix)
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `anno-cli.test.ts anno-cli-invocations.test.ts` 139/139 pass, 0 skipped; `check-skill-cli-invocations.mjs` exit 0; `check-skill-tool-coverage.mjs` exit 0; `check-npm-packages.mjs` exit 0; `npm run test:automated` failing-name set is exactly the 6 documented baseline names (tests 4145, pass 4130, fail 6, skipped 9 -- up from 47-02's 4142/4127/6/9 by this plan's own net new tests, same 6 failing names).
