---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 03
subsystem: host-tool-executor
tags: [tool-location, host-tool, acme, ghidra, dxa, acme-lib, remedy, tdd]

# Dependency graph
requires:
  - phase: 60-the-seam-wired-into-the-code-that-ships
    provides: "plan 60-01's HostToolLocator/createRequire precedent and plan 60-02's remedyTextsFor() (DECL-03's first runtime reader of prerequisites.json's remedies arrays)"
provides:
  - "buildHostToolArgv() resolves acme/acme-lib/ghidra through resolveTool() (LOC-01) via an optional fourth HostToolLocator parameter (PD-06), threaded from runHostTool()'s own repoRootAbs through all five call sites"
  - "A missing ACME binary is refused BY NAME before any spawn, carrying remedyTextsFor(\"acme\")'s declared remedy -- new pre-spawn behaviour where none existed before"
  - "findAcmeLib() widened (PD-07): the seam answers env+tools.json ahead of the existing four-prefix fixed list, which stays as the probe layer beneath it"
  - "All three duplicated Ghidra existence checks (ghidra.analyze, and both ghidra.installExtension sites) resolve through resolveTool(\"ghidra\", ...) and quote the declared remedy"
  - "dxa.disassemble's refusal message is repointed at remedyTextsFor(\"dxa\") -- dxa itself stays un-overridable (Phase 59 D-16, LOC-05), only the message's source changed"
  - "Regenerated, committed compiled artifact: resources/host-tool.mjs"
affects: [60-04, 60-05, 61-the-prerequisite-doctor-and-its-capability-map]

# Actuals (#2632)
actuals:
  tokens: 24037
  tasks: 3
  commits: 6
plan_head_before: 7b64c3b30eb4452d6a764f86089ceaa7730f8dfe

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HostToolLocator: a deliberately narrow ({ toolsDir, projectRoot } plus a test-only `here` override) optional fourth parameter on buildHostToolArgv(), rather than the seam's full ResolveToolDeps shape -- PD-06's answer to a function with 40+ pre-existing argv-shape-only call sites"
    - "Plain static .mjs sibling import for a host-bound module that NEVER ships unbuilt (host-tool.mts's only two real routes are the compiled artifact via import and via direct host spawn) -- distinct from backend-detect.mts's lazy createRequire() dance, which exists only for a module that ships BOTH unbuilt and compiled"
    - "withRemedy(): composes a refusal sentence's declared-remedy suffix once, appending nothing when the declaration carries none, so no refusal path can end in a dangling separator"

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/acme-verify.test.ts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/repo-root.ts
    - docs/phase58-declaration-provenance.md
    - docs/phase59-tool-location-placement.md

key-decisions:
  - "host-tool.mts imports the seam as a plain static \"./tool-location.mjs\" value import (matching its own pre-existing ghidra-project.mjs/backend-detect.mjs imports) rather than backend-detect.mts's lazy createRequire() dance -- verified by exhaustive grep that no import specifier anywhere in this tree names \"./host-tool.mts\" unbuilt; every real consumer (vice-broker.mts's value import, host-tool-client.ts's direct host spawn, every test file) reaches only the COMPILED resources/host-tool.mjs artifact, so the dual-shipping hazard the lazy-load pattern exists for does not apply here."
  - "HostToolLocator carries an additional `here?: string` field beyond PD-06's stated { toolsDir, projectRoot } -- a test-only override (mirrors tool-location.mts's own ResolveToolDeps.here/RemedyTextsForDeps.here) threaded from HostToolDeps.here through runHostTool(), needed to prove DECL-03's non-vacuity claim (a mutated remedy sentence changes a live refusal) end-to-end through the real executor without a mocking library, which this suite carries none of."
  - "findAcmeLib()'s ghidra.installExtension-style two-shaped refusal is now effectively belt-and-suspenders for ghidra.analyze: resolveTool()'s own directory-kind existence check already verifies the declared marker (support/analyzeHeadless) before returning a non-null path, so the second (\"resolved directory exists but launcher missing\") message can only fire if the filesystem changes between resolution and the check -- kept per the plan's explicit \"keep the two-shaped response\" instruction rather than collapsed, matching this module's existing defense-in-depth posture for the installExtension duplicate."

requirements-completed: [LOC-01, LOC-03, DECL-03]

coverage:
  - id: D1
    description: "A tools.json entry for acme, acme-lib or ghidra is honoured by the host-tool executor that spawns them, reached through both routes"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Test 1 (LOC-01 tracer): a tools.json entry for acme is the binary runHostTool() actually spawns, with no ACME_BIN set"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 1: a tools.json entry for ghidra resolves ghidra.analyze's launcher, with GHIDRA_HOME unset"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 4a: a tools.json entry for acme-lib reaches the child's ACME environment variable"
        status: pass
    human_judgment: false
  - id: D2
    description: "ACME_BIN, ACME and GHIDRA_HOME still win over a present tools.json entry"
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Test 2: the ACME_BIN environment variable wins over a present tools.json entry"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 2: the GHIDRA_HOME environment variable wins over a present tools.json entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "A missing ACME binary is refused by name before any spawn, with the declared remedy, instead of a raw operating-system spawn error"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Test 3b: with no tools.json, no ACME_BIN and nothing on $PATH, the request is refused by name before any spawn"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Test 4 (DECL-03 non-vacuity): a scratch declaration's distinctive acme remedy text appears in the refusal message"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Test 5: a scratch declaration whose acme record carries no remedy for the running platform still refuses by name, with no dangling separator"
        status: pass
    human_judgment: true
    rationale: "The plan's own <human-check> requires pointing the real ACME_BIN at a nonexistent path against a real host with real ACME moved aside -- not automatable in this sandbox; the automated tests above prove the same refusal shape and remedy-sourcing against scratch fixtures, but the plan explicitly reserves the live-environment confirmation for a human."
  - id: D4
    description: "ACME's four documented fixed prefixes still resolve the standard library; findAcmeLib() widened, not replaced (PD-07)"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 4b: with no tools.json entry and no ACME env var, a directory planted at one of the four documented fixed prefixes is still found and still reaches the child environment"
        status: pass
      - kind: other
        ref: "grep -acE '/usr/local/share/acme|/usr/share/acme|/usr/lib/acme' host-tool.mts -> 3 (fixed_prefix_list_intact)"
        status: pass
    human_judgment: false
  - id: D5
    description: "All three duplicated Ghidra existence checks refuse by name with the declared remedy, and a scratch declaration changes all three messages"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 3a: with neither GHIDRA_HOME nor tools.json set, ghidra.analyze refuses by name and a scratch declaration's distinctive remedy appears in the message"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 3b: ghidra.installExtension's own runHostTool() pre-check refuses by name and carries the scratch declaration's distinctive remedy"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 3c: ghidra.installExtension's own buildHostToolArgv() re-check refuses by name and carries the scratch declaration's distinctive remedy"
        status: pass
    human_judgment: false
  - id: D6
    description: "dxa.disassemble stays un-overridable by tools.json; its refusal carries the declared remedy, changing with a scratch declaration"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 5a: a tools.json entry naming dxa never changes the resolved binary"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 5b: when the vendored dxa binary is genuinely absent, the refusal carries the declared remedy, changing with a scratch declaration"
        status: pass
    human_judgment: false
  - id: D7
    description: "Ghidra's resolution returns the installation directory itself, never the marker-joined launcher path (D-07)"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#Plan 60-03 Task 2 Test 6: ghidra's resolution returns the installation directory itself, never the marker-joined launcher path"
        status: pass
    human_judgment: false
  - id: D8
    description: "No ACME or Ghidra environment-variable literal remains in host-tool.mts outside a comment; the compiled artifact is regenerated and committed with resources-sync.test.ts green"
    requirement: "LOC-02"
    verification:
      - kind: other
        ref: "grep -acE 'env[.]ACME_BIN|env[.]GHIDRA_HOME|env[.]ACME\\b' host-tool.mts -> 0,0,0; remedy-literal leak scan -> leaked_count=0"
        status: pass
      - kind: unit
        ref: "resources-sync.test.ts (2/2 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 59min
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 03: The Seam Wired Into the Code That Ships Summary

**`host-tool.mts`'s `buildHostToolArgv()` resolves `acme`/`acme-lib`/`ghidra` through the tool-location seam (env -> tools.json -> $PATH/fixed-prefix), a missing ACME is now refused by name before any spawn with the declared remedy, and `dxa`'s refusal quotes the same declaration -- both routes into `runHostTool()` rewired through one regenerated compiled artifact.**

## Performance

- **Duration:** 59 min
- **Started:** 2026-09-18T13:58:28Z (approx., immediately following plan 60-02's own completion)
- **Completed:** 2026-09-18T14:57:26Z
- **Tasks:** 3 completed
- **Files modified:** 7 (5 source/test, 1 regenerated artifact, 2 provenance docs repaired as a deviation)

## Accomplishments

- `buildHostToolArgv()` gains an optional fourth `HostToolLocator` parameter (PD-06) and resolves `acme`'s binary through `resolveTool("acme", ...)` instead of a direct `process.env.ACME_BIN` read -- env then `tools.json` then `$PATH`, in that order. A missing ACME is now refused BY NAME before any spawn, carrying `remedyTextsFor("acme")`'s declared remedy text; this existence check is NEW behaviour (today's code has none at all, and a missing ACME surfaces only as a raw operating-system spawn error).
- `runHostTool()` builds one `HostToolLocator` from its already-resolved `repoRootAbs` and threads it through all five `buildHostToolArgv()` call sites, plus `findAcmeLib()`'s own call site and `ghidra.installExtension`'s pre-materialisation resolution branch.
- `findAcmeLib()` widened per PD-07 (correcting `60-PATTERNS.md`'s "drop-in" claim): the seam answers the environment (`ACME`) and `tools.json` layers first, falling through to the SAME fixed four-prefix well-known-install-location list this function has always carried -- only the environment-variable candidate is removed from that list, since the seam's own env layer now covers it.
- All three duplicated Ghidra existence checks (`ghidra.analyze`, and both the `buildHostToolArgv()`-level and `runHostTool()`-level `ghidra.installExtension` checks) resolve through `resolveTool("ghidra", ...)` instead of reading `process.env.GHIDRA_HOME` directly, preserving today's env-only-then-refuse shape while adding the file layer, and quoting the declared remedy in both refusal messages.
- `dxa.disassemble`'s refusal message is repointed at `remedyTextsFor("dxa")`, replacing a hardcoded literal that happened to match the declaration's own text by coincidence -- `findDxaBinary(HERE)` itself is completely untouched (Phase 59 D-16, LOC-05: no locator, no seam call, dxa stays un-overridable).
- Seventeen new test cases across two RED-GREEN cycles (Task 1: ACME, 7 cases; Task 2: Ghidra/acme-lib/dxa, 10 cases) drive the REAL `runHostTool()` end-to-end against scratch `tools.json`/`prerequisites.json` fixtures, proving env-vs-file precedence, the new pre-spawn refusal, DECL-03 non-vacuity (a scratch declaration's distinctive remedy text changes the live refusal), and the empty-remedy no-dangling-separator case.
- `resources/host-tool.mjs` regenerated and committed; `resources-sync.test.ts` green against it, and the compiled artifact's own seam import resolves to `./tool-location.mjs`, already sitting beside it in `resources/` since Phase 59.

## Task Commits

Each task followed its own RED-GREEN TDD cycle (both tasks carry `tdd="true"`):

1. **Task 1 RED: add failing tests for ACME through the seam** - `b55f654b` (test)
2. **Task 1 GREEN: wire ACME through the seam, refused by name** - `3b116e80` (feat)
3. **Task 2 RED: add failing tests for ghidra/acme-lib/dxa through the seam** - `eb7f7fb5` (test)
4. **Task 2 GREEN: wire ghidra/acme-lib through the seam, dxa's remedy sourced** - `6972cc41` (feat)
5. **Task 3: regenerate and commit the compiled host-tool executor artifact** - `7a555dc0` (chore)
6. **Deviation fix: repair structural guards shifted by the seam wiring** - `ba68a8f2` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `HostToolLocator`/`locatorFrom()`/`withRemedy()` added; `buildHostToolArgv()` gains an optional fourth locator parameter; `acme.build`, `ghidra.analyze`, both `ghidra.installExtension` refusal sites, and `dxa.disassemble`'s refusal message all rewired; `findAcmeLib()` widened (PD-07); `runHostTool()` builds and threads one `HostToolLocator`.
- `src/mcp/vice/host-tool.test.ts` - 17 new test cases (Plan 60-03 Test 1-6, Task 2 Test 1-6 including the 3a/3b/3c and 5a/5b splits), three new helpers (`writeToolsJson`, `writeScratchDeclaration`, `writeFakeGhidraInstallDir`), `writeFakeAcme()` widened with an optional filename parameter and a new `"echoenv"` mode.
- `src/mcp/vice/acme-verify.test.ts` - the "binary-token divergence is DISCHARGED" case repointed at the seam delegation plus the declaration's own `envVar` field, since `host-tool.mts` no longer reads `process.env.ACME_BIN` as a literal.
- `src/mcp/vice/resources/host-tool.mjs` - regenerated by `build.ts` from the sources above.
- `src/mcp/vice/repo-root.ts` - `toolsDir()`'s doc-comment census corrected from 8 to 10 occurrences, `host-tool.mts`'s own bullet from 1 to 3.
- `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md` - six shifted line-number citations repaired; the ACME-library-probe section's prose corrected to describe the new two-layer (seam-then-fixed-prefix) resolution instead of a now-false single-list claim.

## Decisions Made

- **Plain static `.mjs` import, not the lazy `createRequire()` dance.** `host-tool.mts` imports the seam as `import { resolveTool, remedyTextsFor } from "./tool-location.mjs"`, matching its own pre-existing `ghidra-project.mjs`/`backend-detect.mjs` imports -- verified by exhaustive repository grep that no import specifier anywhere names `"./host-tool.mts"` unbuilt; every real consumer reaches only the compiled `resources/host-tool.mjs` artifact, so `backend-detect.mts`'s dual-shipping hazard (which motivated its own lazy-load pattern) does not apply to this file.
- **`HostToolLocator` carries a test-only `here?: string` field beyond PD-06's stated two fields.** Needed to prove DECL-03 non-vacuity end-to-end through the real `runHostTool()` without a mocking library (this suite has none); production code (`runHostTool()`'s own locator construction) never sets it beyond passing through `deps.here`, which every real caller leaves `undefined`.
- **The second ("launcher missing") Ghidra refusal message is effectively unreachable via normal resolution now**, since `resolveTool()`'s own directory-kind existence check already verifies the declared marker before returning a path -- kept anyway per the plan's explicit "keep the two-shaped response" instruction, matching this module's existing defense-in-depth posture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `acme-verify.test.ts`'s divergence-discharge assertion broke on the intended ACME_BIN removal**
- **Found during:** Task 1 GREEN verification
- **Issue:** The pre-existing test literally asserted `host-tool.mts`'s source matches `/process\.env\.ACME_BIN/` -- true before this plan, false after, since ACME_BIN is now read inside the seam.
- **Fix:** Repointed the assertion at `resolveTool("acme", ...)`'s delegation plus `prerequisites.json`'s own declared `envVar` field, preserving the test's intent (both sides still honour the SAME overridable convention).
- **Files modified:** `src/mcp/vice/acme-verify.test.ts`
- **Verification:** `node --test acme-verify.test.ts` 47/47 pass.
- **Committed in:** `3b116e80` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Two structural guards broke from host-tool.mts's own line-number shifts**
- **Found during:** post-Task-3 full `npm run test:automated` run
- **Issue:** `repo-root.ts`'s `toolsDir()` doc comment carries an exact machine-checked census of `.c64-re-tools` non-comment string-literal occurrences (repo-root.test.ts's census gate); this plan's `HostToolLocator` plumbing added two new occurrences to `host-tool.mts`, going from 1 to 3 (total 8 to 10). Separately, `phase58-citation-ledger.test.ts` polices two committed provenance documents citing exact `host-tool.mts` line ranges with required anchor text; six citations shifted, and `findAcmeLib()`'s own citation additionally needed a new anchor since PD-07 changed its signature and moved its `$ACME` read to the seam.
- **Fix:** Updated the census comment's count and per-file breakdown; repaired all six citations' line numbers; corrected `docs/phase58-declaration-provenance.md`'s ACME-library-probe prose, which had gone factually false (it described `$ACME` as `findAcmeLib()`'s own first-checked candidate, no longer true).
- **Files modified:** `src/mcp/vice/repo-root.ts`, `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md`
- **Verification:** `repo-root.test.ts` 9/9 pass; `phase58-citation-ledger.test.ts` 11/11 pass; full `npm run test:automated` green (3823 tests / 3814 pass / 0 fail / 9 skipped).
- **Committed in:** `ba68a8f2` (separate deviation-fix commit)

---

**Total deviations:** 2 auto-fixed (1 bug in a test's own assertion, 1 blocking structural-guard repair spanning three files)
**Impact on plan:** Both fixes were necessary for the plan's own stated outcome (a working, fully green build) to be achievable at all. Neither widens this plan's scope beyond keeping the existing test suite honest about a change this plan's own action text required. No scope creep.

## Issues Encountered

None beyond the deviations above, all resolved during execution. One test-authoring pitfall worth recording for future reference: an early draft of the `$PATH`-probe positive case set `process.env.PATH` to ONLY a scratch directory, which broke the fake ACME stub's own `#!/usr/bin/env node` shebang (no `node` reachable on that restricted `PATH`) -- fixed by prepending the scratch directory to the existing `PATH` rather than replacing it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `acme`, `acme-lib`, `ghidra` and `dxa` all resolve through (or are correctly excluded from) the tool-location seam inside the one executor both routes reach; plans 60-04 and 60-05 (the remaining `LOC`/`DECL` requirements, and `c1541`/`petcat`'s own sibling-probe rewiring per `60-PATTERNS.md`'s own note that "the `findSiblingBinary()` loop is plan 60-04's") are unaffected by anything in this plan and remain ready to execute independently.
- The `<human-check>` in this plan's own `<verification>` block (pointing a real `ACME_BIN` at a nonexistent path against a real host with real ACME moved aside, confirming the refusal names `acme.build` and carries the declared remedy) was not run in this sandboxed session -- it needs a real host with a real ACME install to move out of the way, which is why the plan itself marks it as not automated. The automated test suite proves the same refusal shape and remedy-sourcing against scratch fixtures.
- No blockers.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `src/mcp/vice/host-tool.mts` - FOUND, contains `export interface HostToolLocator` and `resolveTool("acme"`
- `src/mcp/vice/host-tool.test.ts` - FOUND, contains 17 `Plan 60-03` test names
- `src/mcp/vice/acme-verify.test.ts` - FOUND, contains `resolveTool\("acme"` assertion
- `src/mcp/vice/resources/host-tool.mjs` - FOUND, regenerated banner present, contains `from "./tool-location.mjs"`
- `src/mcp/vice/repo-root.ts` - FOUND, census comment reads "exactly 10 non-comment occurrences"
- `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md` - FOUND, updated citations present
- Commits `b55f654b`, `3b116e80`, `eb7f7fb5`, `6972cc41`, `7a555dc0`, `ba68a8f2` - all present in `git log --oneline`
- `node --test host-tool.test.ts dxa-seam.test.ts acme-verify.test.ts resources-sync.test.ts` - 184/184 pass
- `npm run typecheck` - clean
- `npm run test:automated` (full suite) - 3823 tests / 3814 pass / 0 fail / 9 skipped
- Remedy-literal leak scan - `leaked_count=0`
- `grep -acE 'env[.]ACME_BIN|env[.]GHIDRA_HOME|env[.]ACME\b' host-tool.mts` - `0`
