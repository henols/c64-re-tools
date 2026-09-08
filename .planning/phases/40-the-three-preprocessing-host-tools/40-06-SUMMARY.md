---
phase: 40-the-three-preprocessing-host-tools
plan: 06
subsystem: host-tool-seam
tags: [c1541, host-tool-seam, d64, disk-image, vice-mcp, skill, deletion, structural-invariant]

# Dependency graph
requires:
  - phase: 40-02
    provides: "Five c1541.* HostToolIds, findSiblingBinary(), the single-file byte-extraction id (c1541.read) whose argument shape mirrors extractEntry(image, entryName) one-for-one"
  - phase: 40-04
    provides: "The ported fakery detector (c64-disk-access's audit subcommand), so anno-d64.ts/d64-parse.mjs's own detector logic already had a seam-side home before deletion"
  - phase: 40-05
    provides: "c64-ram-capture/SKILL.md already carried no d64-parse.mjs citation, so this plan's deletion left nothing dangling there"
provides:
  - "The ONE disk-image route: every consumer of .d64 structure/contents now reaches it exclusively through the c1541.* host-tool seam"
  - "src/mcp/vice/d64-single-route.test.ts -- a committed, non-vacuous structural invariant (tree-derived walk + 3 OR'd predicates + 5 planted-violation proofs) that reds if a second disk-image parser reappears"
  - "Two independent duplicate disk-image readers deleted: src/mcp/vice/anno-d64.ts and src/skills/c64-ram-capture/scripts/d64-parse.mjs, plus their test files"
affects: []

# Actuals (#2632)
actuals:
  tokens: 29700
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic import of a URL (never a bare string specifier) to reach a host-bound .mts module's own compiled resources/*.mjs artifact from a plain .test.ts file, bypassing tsc's declaration-file requirement for a .mjs import while staying byte-identical to the committed, resources-sync-gated artifact -- used where a plain static .mts import would throw ERR_MODULE_NOT_FOUND because the source file's own cross-extension sibling import (ghidra-project.mjs) only resolves once compiled alongside it."
    - "De-literalize rather than delete a prose citation of a module being deleted: move a cited constraint's text directly into the citing file, or substitute a still-existing real example, or describe the deleted precedent without its literal filename -- never leave a claim with nothing behind it, and never let a mechanical grep-based verify gate see a name that is about to dangle."

key-files:
  created:
    - src/mcp/vice/d64-single-route.test.ts
  modified:
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/ghidra-opcode-live.test.ts
    - src/mcp/vice/dxa-live.test.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/package.json
    - scripts/check-npm-packages.mjs
    - src/mcp/vice/prg-image.ts
    - src/mcp/vice/vsf-slice.ts
    - src/mcp/vice/install-resources.ts
    - src/mcp/vice/install-resources.test.ts
    - src/mcp/vice/host-scripts.test.ts
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/skills/c64-disk-access/scripts/c1541.mjs
    - src/skills/c64-disk-access/scripts/c1541.test.mjs
    - src/skills/c64-provenance-diff/scripts/recovery-schema.mjs
    - src/skills/c64-ram-capture/scripts/derive-transients.mjs
    - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
    - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs

key-decisions:
  - "Re-pointed the three live tests' program extraction onto runHostTool() (host-tool.mts) via a dynamic import of the committed resources/host-tool.mjs artifact -- the SAME idiom host-tool.test.ts already uses, minus that file's own build() call, since these three files' own headers state they build nothing and resources-sync.test.ts already gates the artifact's freshness. A plain static import of host-tool.mts's own TypeScript source throws ERR_MODULE_NOT_FOUND at load time, because that file's own ghidra-project.mjs import only resolves once compiled alongside its sibling under resources/."
  - "De-literalized every remaining prose citation of either removed module -- inside AND outside this plan's declared file list -- rather than deleting the sentences: moved a cited constraint's text directly into the citing file (prg-image.ts, vsf-slice.ts, vsf-slice.mjs), substituted a still-existing real example (diff-images.mjs for install-resources.ts/install-resources.test.ts/host-scripts.test.ts), or described the deleted precedent without its literal filename (c1541.mjs, c1541.test.mjs, derive-transients.mjs, recovery-schema.mjs, host-tool.mts, check-npm-packages.mjs's own historical past-tense paragraph, module-classification.ts's historical consumer-list note). Every one of these files' own committed guard (module-classification.test.ts DIRECTION 3, vsf-slice.test.mjs's two header-citation assertions, check-npm-packages.mjs's tarball validation, check-skill-fork-honesty.mjs) still passes."
  - "host-tool.mts, src/skills/c64-disk-access/scripts/c1541.mjs, c1541.test.mjs and src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs were NOT in this plan's declared file lists but carried further prose citations of the removed modules that this plan's own repo-wide verify grep counts -- fixed as a scope-necessary deviation (Rule 1/3) rather than leaving the grep non-zero. resources/host-tool.mjs was rebuilt (node build.ts) after the host-tool.mts edit to keep resources-sync.test.ts green."
  - "One new bare 'Phase 40 plan 40-06' citation (derive-transients.mjs) shared a paragraph with the word 'unavailable', tripping check-skill-fork-honesty.mjs's stale-forward-reference heuristic (which exempts only the '(Phase N, id)' citation shape). Wrapped it in that exact shape ('(Phase 40, plan 40-06)') rather than weakening or routing around the heuristic."
  - "Deviation (Rule 1, regression discovered running the full suite after Task 3's deletion): hostpath-consumers.test.ts hand-pins ANNO_MODULE_FLOOR, a literal count of anno-*.ts production modules its own committed instructions say must be re-derived, naming the plan, whenever the family gains OR LOSES a member. anno-d64.ts was one of the three post-rename anno-* modules its original 2026-08-29 baseline counted. Lowered 21 -> 20 -- the first lowering this floor has ever needed -- documented with the same dated-relation discipline every prior raise carries, rather than either leaving the guard red or silently nudging the literal without recording why."
  - "The new invariant (d64-single-route.test.ts) exempts exactly one path pair: c64-disk-access's own c1541.mjs and c1541.test.mjs -- the seam's own deliberate, approved port of the same domain knowledge (plan 40-04, D-06). A dedicated planted-violation test proves the exemption mechanism is a real filter (the exempt path's own real content shape IS one the predicate would flag if it were not exempt), not a no-op that would let the whole invariant pass vacuously."

patterns-established:
  - "Dynamic import(new URL(...).href) idiom for a test file that needs a host-bound .mts module's real runtime behaviour without triggering that module's own cross-extension compiled-sibling import failure, and without adding a build() call to a file whose own header states it builds nothing."

requirements-completed: [PREP-01]

coverage:
  - id: D1
    description: "The three live tests (ghidra-live.test.ts, ghidra-opcode-live.test.ts, dxa-live.test.ts) obtain their corpus program bytes over the c1541.dir + c1541.read host-tool seam calls, in-process, with unique scratch directories per call and unchanged live-gate skip behaviour"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "node --test dxa-live.test.ts (5/5 pass, all skip cleanly with no opt-in); node --test ghidra-live.test.ts ghidra-opcode-live.test.ts (skip cleanly, 4/4 non-gated pass)"
        status: pass
      - kind: manual_procedural
        ref: "Live-opted-in runs against the real Phase 23 corpus image, a real vendored dxa binary, and a real Ghidra 12.1.3 installation: dxa-live.test.ts 5/5 pass with VICE_LIVE_DXA(_CORPUS)=1; ghidra-live.test.ts's two corpus tests pass with VICE_LIVE_GHIDRA(_CORPUS)=1; ghidra-opcode-live.test.ts's CORPUS case passes the same way -- all three exercised over the seam this session"
        status: pass
    human_judgment: false
  - id: D2
    description: "No registration, packaging surface, or prose citation outside the four soon-to-be-deleted files names anno-d64.ts or d64-parse.mjs; both tarball validations pass; the two vsf-slice.test.mjs header-citation assertions survive, re-pointed to the rewritten header's new citations"
    requirement: PREP-01
    verification:
      - kind: other
        ref: "grep -ran 'anno-d64|d64-parse' over src/scripts/installer, excluding the four deleted files, before Task 3's deletion -- 0"
        status: pass
      - kind: unit
        ref: "node --test module-classification.test.ts install-resources.test.ts host-scripts.test.ts (46/46 pass); node --test src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs (15/15 pass, tests count unchanged); node --test src/skills/c64-disk-access/scripts/c1541.test.mjs (17/17 pass)"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (both packages OK)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The four files are deleted in one commit alongside a non-vacuous one-route invariant (d64-single-route.test.ts) with a tree-derived floor and a planted-violation proof; typecheck, both tarball validations and the full automated suite (at its documented floor) all pass afterwards"
    requirement: PREP-01
    verification:
      - kind: other
        ref: "git ls-files -- the four deleted paths -- 0"
        status: pass
      - kind: unit
        ref: "node --test d64-single-route.test.ts (7/7 pass: the main invariant, the non-vacuity floor, three planted violations -- one per signature, a comment/string decoy control, and the exemption-mechanism control)"
        status: pass
      - kind: other
        ref: "npm run typecheck (clean); node scripts/check-npm-packages.mjs (both packages OK); npm run test:automated settles at 3569/3573 pass, matching the documented floor exactly (3 known anno-register.test.ts failures + the documented audit-root-args.test.ts intermittent race, confirmed transient by re-running that file alone at 58/58)"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 06: Deleting the Duplicate Disk-Image Parser Summary

**Deleted `anno-d64.ts` and `d64-parse.mjs` -- the two independent 1541 disk-format readers -- re-pointing every consumer (three live tests, a module registration, two npm packaging surfaces, and a dozen prose citations) onto the `c1541.*` host-tool seam, and committing a non-vacuous structural invariant that reds if a second disk-image parser ever reappears.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-08T11:55:11Z (first task commit)
- **Completed:** 2026-09-08T12:23:56Z (last task commit)
- **Tasks:** 3
- **Files modified:** 25 (across 3 commits: 20 modified, 1 created, 4 deleted)

## Accomplishments

- **Task 1:** `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts` and `dxa-live.test.ts` each re-point their own `extractCorpusProgram()` from a direct, in-process call into `anno-d64.ts`'s pure `listEntries()`/`extractEntry()` onto two seam calls (`c1541.dir` then `c1541.read`), reached via `runHostTool()` through a dynamic import of the committed `resources/host-tool.mjs` artifact -- no client subprocess, no skill script, and no `build()` call in a file whose own header says it builds nothing. Live-verified end to end against the real Phase 23 corpus image, a real vendored `dxa` binary, and a real Ghidra 12.1.3 installation.
- **Task 2:** Removed the `anno-d64.ts` registration entry (including its pinned consumer citation) from `module-classification.ts`; removed it from `package.json`'s `files[]`; de-literalized every prose citation of either removed module across a dozen files, moving each cited constraint directly into its citing file or substituting a still-existing real example rather than leaving a dangling name. Re-pointed `vsf-slice.test.mjs`'s two committed "the header cites the removed module" assertions to what the rewritten header now states.
- **Task 3:** Deleted the four files (`anno-d64.ts`, `anno-d64.test.ts`, `d64-parse.mjs`, `d64-parse.test.mjs`) in one commit alongside `d64-single-route.test.ts` -- a tree-derived walk over the shipped MCP module set plus every `.mjs` under `src/skills/`, checking three OR'd signatures matching either deleted module's exact algorithmic shape, with the seam's own `c1541.mjs` as the one named exemption and five planted-violation tests proving the predicate has real teeth.

## Task Commits

1. **Task 1: Re-point the three live tests' program extraction onto the seam** - `924711c9` (feat)
2. **Task 2: Re-point the registration, the packaging surfaces, and every prose citation** - `299d5a7b` (feat)
3. **Task 3: Delete the four files and commit the one-route invariant** - `7d36844c` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/mcp/vice/d64-single-route.test.ts` - new committed structural invariant, the ONE disk-image route enforced mechanically
- `src/mcp/vice/ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `dxa-live.test.ts` - re-pointed corpus extraction onto the c1541 seam
- `src/mcp/vice/module-classification.ts` - removed the discharged `anno-d64.ts` registration entry
- `src/mcp/vice/package.json`, `scripts/check-npm-packages.mjs` - packaged file set and packaged-import set both stop naming the removed module
- `src/mcp/vice/prg-image.ts`, `src/mcp/vice/vsf-slice.ts` - moved a cited constraint's text in rather than citing a file about to disappear
- `src/mcp/vice/install-resources.ts`, `install-resources.test.ts`, `host-scripts.test.ts` - substituted a still-existing example (`diff-images.mjs`) for the removed module named as an illustration
- `src/mcp/vice/host-tool.mts` (+ regenerated `resources/host-tool.mjs`) - de-literalized two prose citations naming the removed module as the precedent for `c1541.read`'s argument shape (deviation, scope-necessary)
- `src/mcp/vice/hostpath-consumers.test.ts` - lowered `ANNO_MODULE_FLOOR` 21 -> 20, documented (deviation, Rule 1 regression fix)
- `src/skills/c64-disk-access/scripts/c1541.mjs`, `c1541.test.mjs` - de-literalized four citations of the deleted skill-side module (deviation, scope-necessary)
- `src/skills/c64-provenance-diff/scripts/recovery-schema.mjs`, `src/skills/c64-ram-capture/scripts/derive-transients.mjs` - de-literalized further example citations
- `src/skills/c64-ram-capture/scripts/vsf-slice.mjs`, `vsf-slice.test.mjs` - de-literalized the header's two-copies-precedent citation and re-pointed its two committed assertions

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: the dynamic-import-of-URL idiom for reaching `host-tool.mts`'s real runtime behaviour from the three re-pointed live tests, and de-literalizing (rather than deleting) every prose citation across files both inside and outside this plan's declared scope so the plan's own repo-wide verify grep reaches exactly zero without silently dropping a constraint, a precedent, or a committed assertion's target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Scope-necessary] `host-tool.mts` carried two prose citations of `anno-d64.ts` not listed in Task 2's file set, counted by Task 2's own repo-wide verify grep**
- **Found during:** Task 2, running the plan's own literal verify grep after the declared file list's edits
- **Issue:** `host-tool.mts:472` and `:1616` cited `anno-d64.ts` as the precedent for `c1541.read`'s argument shape (`extractEntry(image, entryName)`). Left as-is, the grep would never reach zero.
- **Fix:** De-literalized both to "the now-deleted MCP-side pure-parse module's own signature (Phase 40 plan 40-06)". Rebuilt `resources/host-tool.mjs` via `node build.ts` to keep `resources-sync.test.ts` green.
- **Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
- **Verification:** `grep -ac anno-d64 host-tool.mts` is 0; `resources-sync.test.ts` passes; `npm run typecheck` clean.
- **Committed in:** `299d5a7b` (Task 2 commit)

**2. [Rule 1/3 - Scope-necessary] `c1541.mjs`/`c1541.test.mjs` (from plan 40-04) and `vsf-slice.test.mjs` carried further `d64-parse.mjs` citations counted by the same grep**
- **Found during:** Task 2, same verify pass
- **Issue:** Five sites in `c1541.mjs`, one in `c1541.test.mjs`, and one in `vsf-slice.test.mjs` named `d64-parse.mjs` as the precedent for a copied table, a copied default, an entry-point-guard convention, or a skip-convention example.
- **Fix:** De-literalized each to "the deleted skill-side pure-parse module" (or, for the skip-convention example, substituted `dxa-live.test.ts` as a still-existing example).
- **Files modified:** `src/skills/c64-disk-access/scripts/c1541.mjs`, `c1541.test.mjs`, `src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs`
- **Verification:** `grep -ac d64-parse` on each is 0; `node --test c1541.test.mjs` (17/17) and `vsf-slice.test.mjs` (15/15) both pass.
- **Committed in:** `299d5a7b` (Task 2 commit)

**3. [Rule 1 - Bug] One de-literalized citation tripped `check-skill-fork-honesty.mjs`'s stale-forward-reference heuristic**
- **Found during:** Task 2, running `npm run test:automated`
- **Issue:** `derive-transients.mjs`'s new "(Phase 40 plan 40-06)" citation shared a paragraph with the word "unavailable" (an unrelated, pre-existing sentence), tripping the heuristic that flags a bare `Phase N` reference co-occurring with a stale-framing word -- a false positive relative to the heuristic's real intent (this is a citation of when a module was deleted, not a deferral), but the heuristic only exempts the exact `(Phase N, id)` parenthetical shape.
- **Fix:** Reformatted to `(Phase 40, plan 40-06)`, matching the exempted citation shape exactly.
- **Files modified:** `src/skills/c64-ram-capture/scripts/derive-transients.mjs`
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` exits 0 ("no stale phase-deferral prose found").
- **Committed in:** `299d5a7b` (Task 2 commit)

**4. [Rule 1 - Bug/regression] `hostpath-consumers.test.ts`'s hand-pinned `ANNO_MODULE_FLOOR` broke after the deletion**
- **Found during:** Task 3, running `npm run test:automated` after the deletion commit
- **Issue:** `anno-d64.ts` was one of the `anno-*.ts` production modules this literal count tracks (one of the three post-rename modules its original 2026-08-29 baseline counted). Deleting it dropped the real disk count from 21 to 20, failing both the floor assertion (`>=`) and the pinned-equals-measured diagnostic assertion (`===`).
- **Fix:** Lowered `ANNO_MODULE_FLOOR` from 21 to 20, per the test's own committed instructions ("re-derive the floor deliberately, naming the plan that added OR REMOVED the module") -- the first lowering this floor has ever needed, documented with the same dated-relation discipline every prior raise carries.
- **Files modified:** `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test hostpath-consumers.test.ts` (22/22 pass).
- **Committed in:** `7d36844c` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (3 scope-necessary de-literalizations required by the plan's own verify grep reaching into files outside its declared task lists, 1 bug/regression fix in an unrelated pinned-count guard). **Impact:** all four were necessary for the plan's own stated verify commands and acceptance criteria to hold; none introduces new functionality or changes scope beyond keeping every existing guard honest about a module that no longer exists. No scope creep.

## Issues Encountered

- `npm run test:automated` briefly showed a FIFTH failure between the Task 2 and Task 3 commits (`anno-seam.test.ts`'s "files[] ships every anno-* production module on disk" check), because Task 2 removes `anno-d64.ts` from `package.json`'s `files[]` while the physical file still exists on disk until Task 3's deletion lands. This is the exact, anticipated mid-commit-range inconsistency the plan's own `merge_protocol` section names ("Order within the plan matters... A deletion committed first leaves the suite red between commits") -- confirmed self-resolving: the full suite is clean at the documented floor immediately after Task 3's commit.
- The full suite intermittently shows a fifth/sixth failure in `audit-root-args.test.ts` (its own documented, pre-existing concurrent-scanner race, WINDOWS.md entry 54) -- confirmed unrelated to this plan by running that file alone twice (58/58 clean both times).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `c1541.*` host-tool seam is now the ONE route to `.d64` structure and contents anywhere in this project, mechanically enforced by `d64-single-route.test.ts`.
- `40-07` (the phase's final plan, if any) inherits a tree with no dangling `anno-d64`/`d64-parse` citation anywhere outside the new invariant's own explanatory prose, and a full automated suite at its documented floor.
- No blockers.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/mcp/vice/d64-single-route.test.ts
- MISSING (expected -- deleted by this plan): src/mcp/vice/anno-d64.ts
- MISSING (expected -- deleted by this plan): src/mcp/vice/anno-d64.test.ts
- MISSING (expected -- deleted by this plan): src/skills/c64-ram-capture/scripts/d64-parse.mjs
- MISSING (expected -- deleted by this plan): src/skills/c64-ram-capture/scripts/d64-parse.test.mjs
- FOUND commit: 924711c9
- FOUND commit: 299d5a7b
- FOUND commit: 7d36844c
- Acceptance criteria re-verified: `grep -ac anno-d64|d64-parse` outside the four deleted files and the new invariant's own explanatory prose is 0; `npm run typecheck` exits 0; `node scripts/check-npm-packages.mjs` OK for both packages; `node --test d64-single-route.test.ts` reports 7/7 pass; `npm run test:automated` settles at 3569/3573 pass, matching the documented floor (3 known + 1 confirmed-intermittent, unrelated race).
