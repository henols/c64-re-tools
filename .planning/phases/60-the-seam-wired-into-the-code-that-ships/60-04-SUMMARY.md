---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 04
subsystem: host-tool-executor
tags: [tool-location, host-tool, c1541, petcat, sibling-probe, remedy, tdd]

# Dependency graph
requires:
  - phase: 60-the-seam-wired-into-the-code-that-ships
    provides: "plan 60-01's HostToolLocator/locatorFrom() precedent, plan 60-02's remedyTextsFor(), and plan 60-03's withRemedy()/loc threading through buildHostToolArgv()'s c1541/petcat branches"
provides:
  - "findSiblingBinary() gains a tools.json layer (PD-08) ahead of the sibling-of-x64sc candidate: c1541 and petcat -- Phase 59 D-06's two ids with no environment-variable route of their own -- become locatable through .c64-re-tools/tools.json for the first time (LOC-04)"
  - "Both c1541.*/petcat.decode refusals now carry the declaration's remedy text via withRemedy(), matching the acme/ghidra/dxa refusals plan 60-03 already wired"
  - "The inline $PATH loop inside findSiblingBinary() is replaced by a call to the seam's exported resolveOnPath() -- the second of Phase 59 D-02's three coexisting $PATH-walk copies to collapse (60-01 collapsed the first)"
  - "Four shipped-source comments that cited the deleted spawn-seam.test.ts as an enforcing guard are corrected to state the naming convention is kept voluntarily, and name what IS mechanically enforced instead (tool-location-consumers.test.ts, plan 60-05)"
  - "Regenerated, committed compiled artifact: resources/host-tool.mjs"
affects: [60-05]

# Actuals (#2632)
actuals:
  tokens: 19363
  tasks: 3
  commits: 5
plan_head_before: 77d8930b2b1b01af37fc3f1409e4656315b41e89

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "findSiblingBinary()'s new file-layer branch calls resolveTool() but accepts ONLY a layer:\"file\" answer as its own -- resolveTool()'s own internal $PATH layer (layer 3, unconditional for an executable-kind id with no tools.json entry) is deliberately NOT trusted here, because accepting it would let the seam's internal $PATH walk silently outrank the sibling-of-x64sc candidate before this function ever tried it, inverting PD-08's stated precedence and losing the shadowing warning"
    - "freshHostTool()/resetResolvedBackendMjs(): a test-only pattern for isolating per-binary-name memo state across cases that must each start from a clean slate -- a query-string-busted dynamic import of the COMPILED resources/host-tool.mjs artifact gives a fresh siblingBinaryMemo per case, and a companion dynamic import of resources/backend-detect.mjs (no query string, so it resolves to the ONE shared instance every host-tool.mjs consumer -- fresh or shared -- actually imports internally) resets resolvedBackend()'s memo correctly, unlike this file's pre-existing .mts-sourced resetResolvedBackendForTests(), which targets a different, unreachable module instance and was a silent no-op for every case going through the compiled artifact"

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/host-tool-client.ts
    - src/mcp/vice/acme-verify.ts
    - src/mcp/vice/resources/host-tool.mjs
    - docs/phase58-declaration-provenance.md
    - docs/phase59-tool-location-placement.md

key-decisions:
  - "findSiblingBinary()'s seam call only accepts a layer:\"file\" answer, never a layer:\"probe\" one, even though resolveTool() itself would happily return a $PATH-resolved path for c1541/petcat (both are executable-kind with no envVar, so resolveTool()'s own layer 3 fires unconditionally once tools.json has nothing to say). This is a deliberate narrowing beyond the plan's literal action text, discovered while writing Test 3: without it, a binary reachable on $PATH would answer from INSIDE the seam call, before the sibling candidate is ever tried and before this function's own resolveOnPath() call (the one that carries the shadowing warning) ever runs -- silently inverting PD-08's tools.json-then-sibling-then-$PATH order and losing the warning the whole probe exists to keep."
  - "A latent bug in the shared Phase 40 c1541/petcat test fixture was fixed as an in-scope deviation: withFakeC1541()'s resetResolvedBackendForTests() (imported from the UNBUILT backend-detect.mts) resets a completely different module instance than the one resolvedBackend()'s own compiled-artifact consumers (every host-tool.mjs instance, fresh or shared) actually read -- backend-detect.mjs's own resetResolvedBackendForTests(). This was previously invisible because Phase 40's own tests always set VICE_BIN to the SAME value on every call, so a never-reset-but-also-never-changing memo happened to already hold the right answer; Plan 60-04's own earlier cases, each pointing VICE_BIN at a fresh per-test scratch path, exposed it. Fixed by adding resetResolvedBackendMjs() (a query-string-free dynamic import of resources/backend-detect.mjs) and using it everywhere resetResolvedBackendForTests() was previously called in this file."
  - "PD-08 (planner decision, recorded in the plan): the tools.json layer sits AHEAD of the sibling-of-x64sc candidate, not between it and the $PATH fallback -- resolving a tension between 60-PATTERNS.md's literal insertion-point note and two requirement texts (LOC-02, LOC-01) plus ROADMAP criterion 4, all of which place tools.json ahead of any probe layer."

requirements-completed: [LOC-04, DECL-03]

coverage:
  - id: D1
    description: "A tools.json entry for c1541 or petcat is honoured by the executor that spawns them, even when a sibling of the resolved emulator also exists"
    requirement: "LOC-04"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 1 (LOC-04 tracer): a tools.json entry for c1541 is honoured even when a sibling of the resolved emulator also exists"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 6: petcat.decode behaves identically to c1541 -- file-layer precedence, sibling retention with no warning, $PATH retention with the warning, and memo timing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sibling-of-x64sc candidate and the $PATH fallback (with its shadowing warning) survive untouched when tools.json has nothing to say"
    requirement: "LOC-04"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 2: with no tools.json entry for c1541, a binary planted beside the resolved emulator is found, exactly as today, and no warning is logged"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 3: with neither the file nor a sibling answering, the $PATH walk still finds the binary AND the shadowing warning is logged"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 4: a tools.json hit logs NOTHING through the warning callback"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-binary-name memo's timing is unchanged -- a file-layer answer is cached exactly like a sibling or $PATH answer, and no reset hatch was added"
    requirement: "LOC-04"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 5 (memo semantics): a c1541 resolution is memoised for the process lifetime -- changing tools.json and the sibling candidate between two calls has no effect on the second"
        status: pass
      - kind: other
        ref: "grep -acE 'siblingBinaryMemo.clear|resetSiblingBinary' host-tool.mts -> 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both c1541/petcat refusals name the tool id, list every candidate tried (including the file-layer one the seam inspected), and carry the declaration's remedy text -- changing with a scratch declaration (DECL-03 non-vacuity)"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-04 Test 7: when nothing answers, the refusal names the tool id, lists tried (including the file-layer candidate the seam inspected), and carries the declaration's remedy -- for both c1541 and petcat, changing with a scratch declaration"
        status: pass
    human_judgment: false
  - id: D5
    description: "No shipped comment claims a guard (spawn-seam.test.ts) that is not on disk; each corrected comment names what is actually enforced instead"
    requirement: "DECL-03"
    verification:
      - kind: other
        ref: "grep -acE 'spawn-seam' host-tool.mts host-tool-client.ts acme-verify.ts -> 0,0,0; grep -acE 'tool-location-consumers' host-tool.mts -> 2"
        status: pass
      - kind: unit
        ref: "node --test host-tool.test.ts host-tool-transport.test.ts acme-verify.test.ts (188/188 pass)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 59 D-02's second coexisting $PATH-walk copy collapses into the seam's own resolveOnPath()"
    requirement: "LOC-04"
    verification:
      - kind: other
        ref: "grep -ac 'resolveOnPath(' host-tool.mts -> 2 (import + call site); grep -acE '\\.split\\(\":\"\\)' host-tool.mts -> 0"
        status: pass
      - kind: unit
        ref: "resources-sync.test.ts (2/2 pass) -- resources/host-tool.mjs regenerated and committed"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 04: The Tool Location Seam and Its Precedence Order Summary

**`findSiblingBinary()` gains a `tools.json` layer ahead of the sibling-of-`x64sc` candidate (PD-08), making `c1541`/`petcat` locatable through the file for the first time, with both refusals now carrying the declaration's remedy -- and four comments citing a deleted structural guard are corrected to say what actually enforces the naming discipline.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-18T15:02:00Z (approx, immediately following plan 60-03's own completion commit)
- **Completed:** 2026-09-18T15:40:32Z
- **Tasks:** 3 completed
- **Files modified:** 7 (5 source/test, 1 regenerated artifact, 2 provenance docs repaired as a deviation)

## Accomplishments

- `findSiblingBinary()` widened to a fourth optional `locate?: HostToolLocator` parameter and a new FIRST resolution branch (PD-08): it calls `resolveTool(binaryName, loc)` ahead of the sibling-of-`x64sc` candidate, accepting ONLY a `layer: "file"` answer as its own -- a design decision beyond the plan's literal text, made to stop the seam's own internal `$PATH` layer from silently outranking the sibling candidate (see Decisions Made below). A `refusal` (a named `tools.json` entry that failed its own checks) is terminal and never falls through.
- The inline `$PATH` loop is replaced by a call to the seam's exported `resolveOnPath()` -- the SECOND of Phase 59 `D-02`'s three coexisting `$PATH`-walk copies to collapse (plan 60-01 collapsed the first, inside `backend-detect.mts`). The shadowing warning stays at this call site, byte-identical, since only this function knows which emulator a `$PATH` match is being compared against.
- Both `c1541.*` and `petcat.decode`'s refusal messages now wrap their existing `"does not exist (tried: ...)"` sentence in `withRemedy()`, so a missing binary's refusal carries the declaration's remedy -- matching the acme/ghidra/dxa refusals plan 60-03 already wired.
- Seven new test cases (`Plan 60-04 Test 1-7`) drive the REAL `runHostTool()` end-to-end against scratch `tools.json`/`prerequisites.json` fixtures, each through a freshly-imported compiled module instance (`freshHostTool()`) to isolate `findSiblingBinary()`'s own un-resettable per-binary-name memo. Proves file-layer precedence over the sibling, sibling/`$PATH` retention with the shadowing warning intact, warning suppression on a file hit, memo timing, `petcat` parity, and declaration-sourced remedies for both ids.
- Four comment sites (two in `host-tool.mts`, one each in `host-tool-client.ts` and `acme-verify.ts`) that cited the deleted `spawn-seam.test.ts` as an enforcing guard over the `binPath`/`viceBin`/`VICE_BIN`/`x64sc` naming discipline are corrected: each now states the convention is kept deliberately, with no test behind it since the deletion (commit `276c15c9`), and names what IS mechanically enforced instead -- the closed consumer set `tool-location-consumers.test.ts` (plan 60-05) asserts over the four tool-location environment-variable names.
- `resources/host-tool.mjs` regenerated and committed; `resources-sync.test.ts` green.
- As a deviation, fixed a latent bug in the shared Phase 40 `withFakeC1541()` test fixture (see Deviations below) and repaired six line-number citations plus one factually-stale paragraph in two provenance documents.

## Task Commits

Task 1 followed the RED-GREEN TDD cycle (`tdd="true"`); Tasks 2-3 were single commits each:

1. **Task 1 RED: add failing tests for c1541/petcat tools.json layer** - `701684ec` (test)
2. **Task 1 GREEN: widen the c1541/petcat sibling probe with a tools.json layer** - `51bf96d4` (feat)
3. **Task 2: correct four comments citing a deleted structural guard** - `478400ca` (docs)
4. **Task 3: regenerate and commit the compiled host-tool executor artifact** - `8ce75e25` (chore)
5. **Deviation fix: repair provenance-doc citations shifted by the tools.json layer** - `b55a3d5d` (fix)

**Plan metadata:** (this commit)

_No REFACTOR commit for Task 1 -- the GREEN implementation needed no cleanup beyond what was already written; tests still pass unchanged._

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `findSiblingBinary()` widened with a fourth `locate?` parameter and a new tools.json-first resolution branch (PD-08); its inline `$PATH` loop replaced by `resolveOnPath()`; both `c1541.*`/`petcat.decode` refusal sites wrapped in `withRemedy()` and pass `loc` through; four stale `spawn-seam.test.ts` citations corrected.
- `src/mcp/vice/host-tool.test.ts` - seven new `Plan 60-04` test cases; `freshHostTool()`/`resetResolvedBackendMjs()`/`writeMarkerC1541()`/`writeMarkerPetcat()` helpers added; `writeScratchDeclaration()` widened with `c1541`/`petcat` entries; `runPetcatHostTool`'s deps type widened to accept `here`; the pre-existing `withFakeC1541()` and its own explanatory comment repaired to use the correct memo-reset helper.
- `src/mcp/vice/host-tool-client.ts`, `src/mcp/vice/acme-verify.ts` - one stale `spawn-seam.test.ts` citation corrected each.
- `src/mcp/vice/resources/host-tool.mjs` - regenerated by `build.ts` from the sources above.
- `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md` - six shifted line-number citations repaired; "Case two"'s stale "carries no remedy" claim corrected; the "three coexisting $PATH-walk copies" item marked closed by this plan; one now-orphaned citation-ledger entry removed.

## Decisions Made

- **`findSiblingBinary()`'s seam call accepts ONLY a `layer: "file"` answer, never `"probe"`.** `resolveTool()` itself unconditionally tries its own internal `$PATH` layer once neither the environment nor `tools.json` answered (true for both `c1541`/`petcat`, which declare no `envVar`). Accepting that internal `$PATH` answer as this function's own would let it win BEFORE the sibling candidate is ever tried and BEFORE this function's own `resolveOnPath()` call (the one that logs the shadowing warning) ever runs -- silently inverting PD-08's tools.json-then-sibling-then-`$PATH` order and losing the warning. Discovered while writing Test 3 (the `$PATH`-fallback-with-warning case), which would otherwise short-circuit through the seam's own hidden `$PATH` probe with no warning logged.
- **`writeMarkerC1541()`/`writeMarkerPetcat()` print a classifier-satisfying trailer, not just a bare marker.** `classifyC1541DirOutput()` requires an `"<N> blocks free"` trailer and `classifyPetcatDecodeOutput()` requires a `";<path> ==<hex>=="` banner; a bare marker line alone made every new test's `runHostTool()` call fail its own output classifier before the test's actual assertion ever ran.
- **`process.env.PATH` is prepended to, never replaced, in the two `$PATH`-fallback cases.** Replacing it outright breaks the fake stub's own `#!/usr/bin/env node` shebang (no `node` reachable), mirroring plan 60-03's own established fix for the identical pitfall.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `withFakeC1541()`'s `resetResolvedBackendForTests()` was a no-op for every case reached through the compiled artifact**
- **Found during:** Task 1 GREEN verification (first full `host-tool.test.ts` run after adding the seven new cases)
- **Issue:** `host-tool.test.ts` imports `resetResolvedBackendForTests` from the UNBUILT `./backend-detect.mts` source, but every real `c1541`/`petcat` resolution in this suite goes through the COMPILED `resources/host-tool.mjs` artifact, which imports `resolvedBackend()` from the COMPILED `resources/backend-detect.mjs` -- a completely separate module instance with its own memo. Calling the `.mts`-sourced reset function therefore reset a memo nothing here ever reads. This was invisible before this plan because Phase 40's own `withFakeC1541()`-wrapped tests always set `VICE_BIN` to the SAME value on every call, so a never-actually-reset-but-also-never-changing memo happened to already hold the right answer. Plan 60-04's own new cases, each pointing `VICE_BIN` at a fresh per-test scratch path, exposed the gap: three of the plan's own new tests (2, 3, 6) initially failed with a stale sibling directory from an EARLIER test (already deleted by `withTempDir`'s own cleanup), and separately, once that layer was fixed, four PRE-EXISTING Phase 40 tests (the c1541 census test and three petcat SYS-token tests) started failing because a real system `c1541`/`petcat` was resolved instead of the fixtures' fakes.
- **Fix:** Added `resetResolvedBackendMjs()` -- a dynamic, query-string-free import of `resources/backend-detect.mjs` that resets the SAME module instance `host-tool.mjs` (fresh or shared) actually reads -- and replaced every one of the file's 22 `resetResolvedBackendForTests()` call sites (including inside `withFakeC1541()`) with it. Repaired the explanatory comments at both the top-of-file import and immediately above `withFakeC1541()` to describe the correct mechanism, and corrected the same section's now-stale claim that c1541/petcat resolution has "no configurable override" (Plan 60-04 adds `tools.json` as exactly that).
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** `node --test host-tool.test.ts` 133/133 pass (was 128/133 before the fix, with the four Phase 40 failures showing a REAL system `c1541` had actually been spawned, per its `OPENCBM: opening dynamic library libopencbm.so failed!` stderr).
- **Committed in:** `701684ec` (RED commit, since the fix landed in the test file before Task 1's implementation existed)

**2. [Rule 3 - Blocking] Two structural guards broke from host-tool.mts's own line-number shifts, and one prose claim went factually stale**
- **Found during:** post-Task-3 full `npm run test:automated` run
- **Issue:** `phase58-citation-ledger.test.ts` polices two committed provenance documents citing exact `host-tool.mts` line ranges with required anchor text; six citations shifted after this plan's edits, and the `findSiblingBinary()` citation's own anchor text (`"function findSiblingBinary(binaryName: string, ...)"`) no longer existed verbatim once the signature moved to a multi-line, four-parameter form. Separately, `docs/phase58-declaration-provenance.md`'s "Case two" section asserted the c1541/petcat refusals "carry no remedy text of their own" -- true before this plan, false after, since both now wrap `withRemedy()`.
- **Fix:** Repaired all six citations' line numbers (and widened the `findSiblingBinary()` anchor to the still-verbatim `"function findSiblingBinary("`); corrected "Case two"'s prose to describe the current `withRemedy()`-wired state while preserving the byte-for-byte remedy-copy rationale it was written to explain; removed one now-orphaned `README.md:99-108` citation-ledger entry the corrected prose no longer references; marked `docs/phase59-tool-location-placement.md`'s "three coexisting `$PATH`-walk copies" item closed by this plan, mirroring how plan 60-01's earlier closure of the first copy was already recorded there.
- **Files modified:** `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md`
- **Verification:** `phase58-citation-ledger.test.ts` 11/11 pass; full `npm run test:automated` green (3830 tests / 3821 pass / 0 fail / 9 skipped).
- **Committed in:** `b55a3d5d` (separate deviation-fix commit)

---

**Total deviations:** 2 auto-fixed (1 bug in a shared test fixture's memo-reset mechanism, 1 blocking structural-guard-plus-stale-prose repair spanning two docs)
**Impact on plan:** Both fixes were necessary for the plan's own stated outcome (a working, fully green build with honest documentation) to be achievable at all. Neither widens this plan's scope beyond keeping the existing test suite and provenance record honest about a change this plan's own action text required. No scope creep.

## Issues Encountered

None beyond the deviations above, all resolved during execution. One test-authoring pitfall worth recording for future reference (distinct from the memo-reset deviation): the c1541/petcat output classifiers (`classifyC1541DirOutput()`/`classifyPetcatDecodeOutput()`) require a specific trailer/banner shape in captured stdout, not just any output -- a marker-only fake stub fails `runHostTool()`'s own classifier before a test's real assertion ever runs, surfacing as a refusal message rather than the expected content mismatch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `c1541`, `petcat`, `acme`, `acme-lib`, `ghidra` and `dxa` all now resolve through (or are correctly excluded from) the tool-location seam inside the one executor both routes reach; only plan 60-05 (the closed consumer set for the four tool-location environment-variable names, `tool-location-consumers.test.ts`) remains in this phase.
- All four comments this plan corrected now point at `tool-location-consumers.test.ts` by name as the mechanically-enforced rule -- plan 60-05 must deliver that test file with that exact name, or these citations go stale in the same way `spawn-seam.test.ts`'s did.
- No blockers.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `src/mcp/vice/host-tool.mts` - FOUND, contains `function findSiblingBinary(` with a `locate?: HostToolLocator` fourth parameter and `layer === "file"` guard
- `src/mcp/vice/host-tool.test.ts` - FOUND, contains 7 `Plan 60-04 Test` names and `freshHostTool`/`resetResolvedBackendMjs`
- `src/mcp/vice/host-tool-client.ts`, `src/mcp/vice/acme-verify.ts` - FOUND, `spawn-seam` citation removed, `276c15c9` named instead
- `src/mcp/vice/resources/host-tool.mjs` - FOUND, regenerated banner present, contains `resolveOnPath`
- `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md` - FOUND, updated citations and corrected prose present
- Commits `701684ec`, `51bf96d4`, `478400ca`, `8ce75e25`, `b55a3d5d` - all present in `git log --oneline`
- `node --test host-tool.test.ts host-tool-transport.test.ts acme-verify.test.ts resources-sync.test.ts` - 190/190 pass
- `npm run typecheck` - clean
- `npm run test:automated` (full suite) - 3830 tests / 3821 pass / 0 fail / 9 skipped
- `grep -acE 'spawn-seam' host-tool.mts host-tool-client.ts acme-verify.ts` - `0,0,0`
- `grep -ac 'DIFFERENT VICE build' host-tool.mts` - `1` (shadow-warning text intact)
