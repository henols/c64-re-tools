---
phase: 59-the-tool-location-seam-and-its-precedence-order
plan: 03
subsystem: infra
tags: [tool-location, path-resolution, build-pipeline, host-bound-module, file-validation]

# Dependency graph
requires:
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "tool-location.mts (resolveTool()/resolveOnPath()), all eight prerequisites.json records with location/kind, the D-12 tools.json bare-string format (plans 59-01/59-02)"
provides:
  - "validateToolsFile(deps): ToolsFileProblem[] -- judges .c64-re-tools/tools.json alone (shape, keys, value types, the two declared exclusions) and resolves nothing (D-10); a caller shows a user one problem per key, in file key order"
  - "resolveTool()'s file layer now implements the amended LOC-06 triad in full: a named tools.json entry is refused by name when the path is absent, is not what its record's kind declares, or -- for a directory kind -- lacks its declared marker; it never silently falls through to $PATH after a file-layer refusal"
  - "The file layer's executable-bit check: an executable-kind candidate must pass accessSync(path, fsConstants.X_OK), scoped to the file layer alone (D-08) -- the environment and $PATH layers stay existsSync-only, unchanged from plan 59-01/59-02"
  - "The export surface stays exactly three functions -- resolveTool, resolveOnPath, validateToolsFile -- and the import set stays exactly node:fs, node:path, node:url"
affects: [60-rewire-every-live-resolution-path-through-the-seam, 61-the-doctor, 59-04, 59-05]

# Actuals (#2632)
actuals:
  tokens: 13700
  tasks: 2
  commits: 4
plan_head_before: e0030da91a3118a362a1086a29a753c7f3411e5a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validateToolsFile()/resolveTool() split (D-10): the validator judges the file's own shape with no resolution, the resolver walks layers and terminates per-id -- the doctor (Phase 61) calls both, live dispatch calls only the second"
    - "File-layer terminal refusal (D-09 extended): once a non-empty tools.json entry names a candidate for an id, resolveTool() either accepts or refuses it for that id -- it never falls through to $PATH afterward, so a bad entry cannot silently resolve a different binary than the file named"
    - "accessSync(path, fsConstants.X_OK) inside try/catch is the sole executable-bit primitive, scoped to the file layer via a dedicated passesFileLayerCheck() wrapper around the existing kind-only matchesDeclaredKind()"
    - "Single-leading-underscore prose exemption (refined D-11): a key is exempt from the unknown-key refusal only when its SECOND character is not itself an underscore -- this is what keeps a JavaScript dunder name (__proto__) reported as unknown without a separate branch, while _readme/_viceBrokerNode stay exempt"

key-files:
  created: []
  modified:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/resources/tool-location.mjs

key-decisions:
  - "The underscore-prose exemption (D-11) is scoped to a SINGLE leading underscore, not any leading underscore. The plan's own action text says 'skip it entirely when its first character is an underscore', but its own embedded verify gate requires \"__proto__\" (two leading underscores) to be reported as unknown -- a direct conflict for that specific key. Resolved by requiring the exemption's second character not be an underscore: _readme/_viceBrokerNode/_anything stay exempt (single leading underscore), __proto__ falls through to the ordinary array-membership check and is reported unknown with no separate branch. Chosen over adding a __proto__-specific branch (explicitly prohibited by the acceptance criteria) because it satisfies both the D-11 template convention and the prototype-key gate from one general rule."
  - "Task 2 completes the amended LOC-06 triad's 'absent' clause in resolveTool() itself, which plan 59-02 explicitly deferred to this validator-vs-resolver split. This required updating six pre-existing tests: five that wrote an x64sc-kind (executable) file via writeFileSync with no executable bit set, now refused by the new file-layer check, repaired with chmodSync(…, 0o755); and one ('nothing answers…') that named a nonexistent path in tools.json to prove a fall-through, now refused outright by the amended triad, repaired to omit the tools.json key entirely so it continues testing 'the file has nothing to say about this id' rather than the now-superseded 'absent path falls through' behaviour."

requirements-completed: [LOC-05, LOC-06, LOC-07]

coverage:
  - id: D1
    description: "validateToolsFile() judges .c64-re-tools/tools.json alone -- shape, keys, value types, the two declared exclusions -- and performs no resolution; an absent/zero-byte/{} file is silent, a broken one names exactly what is broken once per problem in file key order"
    requirement: "LOC-05, LOC-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: an absent tools.json, a zero-byte one and a bare {} one each return no problems"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: unparseable JSON is exactly one file-level problem naming the file path (planted violation), and valid JSON is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: a non-object top level (array) is exactly one file-level problem (planted violation); an object top level is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: several distinct problems are returned one per problem, in file key order, deterministically across repeated calls"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unknown key is reported by exact case-sensitive array membership against the declaration's own id set, never object-property lookup -- covering a case-variant, whitespace-padded, decomposed-Unicode, and JavaScript-prototype-shaped key, each with no special branch"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: an unknown key is one problem naming it (planted violation); a declared id with a valid value is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: a case-variant, whitespace-padded, or decomposed-Unicode key is reported as unknown rather than silently matched (planted violations); the exact declared id is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: a JavaScript-prototype-shaped key is reported as unknown with no separate branch (planted violation)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: a key beginning with an underscore is never reported as unknown, whatever its value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: a non-string value for a declared id is one problem per shape (planted violations); a non-empty string is the clean control"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tools.json entry naming the vendored disassembler or the Node interpreter is refused by validateToolsFile() with the declaration's own reason quoted verbatim, proven not to be a literal in the module by varying the reason via a scratch declaration"
    requirement: "LOC-05, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: naming the vendored disassembler is one problem quoting the declaration's own reason verbatim (planted violation); omitting it is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: naming the Node interpreter is one problem quoting the declaration's own reason verbatim (planted violation); omitting it is a clean control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#validateToolsFile: pointing `here` at a scratch declaration with different reason strings changes both exclusion messages, proving neither sentence is a literal in the module"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveTool()'s file layer implements the amended LOC-06 triad in full: absent, wrong kind, or missing marker (directory) is refused by name with the file named as the source; a directory is the correct, never-refused state for the two directory-kind ids"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("x64sc", …) refuses a tools.json entry naming a path that does not exist, and the refusal names the file'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("x64sc", …) refuses a tools.json entry naming an existing directory, because the record declares an executable file'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("ghidra", …) refuses a tools.json entry naming an existing regular file, because the record declares a directory'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("ghidra", …) refuses a tools.json directory that exists but lacks its marker'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("ghidra", …) resolves through tools.json to the directory when its marker is present'
        status: pass
    human_judgment: false
  - id: D5
    description: "The executable-bit check (accessSync(path, X_OK)) is scoped to the file layer alone: an executable-kind entry with no exec bit is refused and resolves once the bit is set; a directory-kind entry's permission bits are never checked; an environment override with no exec bit still resolves unchanged"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("x64sc", …) refuses a tools.json entry with no executable bit (planted violation), and resolves once the bit is set (clean control)'
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a directory-kind entry's own permission bits are never executable-bit checked: mode 0o555 and 0o755 both resolve"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#an environment override naming a file with no executable bit still resolves, unchanged from plan 59-01's behaviour (D-08)"
        status: pass
    human_judgment: false
  - id: D6
    description: "One bad tools.json entry refuses one tool: a malformed acme entry refuses acme by name while x64sc still resolves through the same file in the same call, and tried carries no PATH-built candidate for an id refused at the file layer"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#one malformed acme entry refuses acme by name; x64sc still resolves through the same file in the same call sequence (D-09 blast radius)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#after a file-layer refusal, tried contains no candidate built from a PATH directory for that call"
        status: pass
    human_judgment: false
  - id: D7
    description: "A tools.json rewritten between two resolveTool() calls yields one complete state, the other complete state, or a parse refusal -- never a merge (backstop truth, sampled not proven)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a tools.json rewritten between calls yields one complete state or the other, never a merge (backstop, T-59-13)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The export surface stays exactly resolveTool/resolveOnPath/validateToolsFile and the import set stays exactly the three Node builtins; the compiled resources/tool-location.mjs artifact carries the same behaviour"
    verification:
      - kind: unit
        ref: "grep -aoE 'export (async )?function [A-Za-z0-9_]+' src/mcp/vice/tool-location.mts (Task 1/2 verify blocks) -- resolveTool, resolveOnPath, validateToolsFile only"
        status: pass
      - kind: unit
        ref: "grep -aoE 'from \"[^\"]+\"' src/mcp/vice/tool-location.mts (Task 1/2 verify blocks) -- node:fs, node:path, node:url only"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/resources-sync.test.ts"
        status: pass
    human_judgment: false

duration: approx 55 min
completed: 2026-09-18T10:40:52Z
status: complete
---

# Phase 59 Plan 03: The Tool-Location Seam's Refusal Contract Summary

**`validateToolsFile()` judges `.c64-re-tools/tools.json` alone with no resolution performed, and `resolveTool()`'s file layer now implements the full amended `LOC-06` triad plus a file-layer-only `accessSync(path, X_OK)` executable-bit check -- every refusal family proven with a planted violation observed failing and a clean control observed passing, through the same exported function.**

## Performance

- **Duration:** approx 55 min
- **Completed:** 2026-09-18T10:40:52Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 3 (`tool-location.mts`, `tool-location.test.ts`, `resources/tool-location.mjs`)

## Accomplishments
- `validateToolsFile(deps): ToolsFileProblem[]` added to `tool-location.mts` (D-10): reads and judges `.c64-re-tools/tools.json` alone -- shape, keys against the declaration's own id set (exact, case-sensitive array membership, never object-property lookup), value types, and the two `fileOverridable: false` exclusions -- without walking `$PATH`, reading the environment, or statting a declared path. An absent/zero-byte/`{}` file returns no problems; a broken file returns one problem per issue, in file key order, so the same file always produces identical output.
- A key beginning with a single leading underscore (`_readme`, `_viceBrokerNode`) is exempt from the unknown-key refusal per D-11's template convention; a key with a SECOND leading underscore (`__proto__`) is not, and is reported as unknown through the same general array-membership path with no separate branch -- resolving a genuine conflict between the plan's literal action text ("skip when the first character is an underscore") and its own embedded verify gate, which requires `__proto__` to be reported.
- The two exclusion refusals (`dxa`, `node`) quote the declaration's own `reason` field verbatim; a test pointing `here` at a scratch declaration with different reason strings proves neither sentence is a literal in the module.
- `resolveTool()`'s file layer now implements the amended `LOC-06` triad in full and is terminal for any id a `tools.json` entry names: it accepts the candidate or refuses it, and never falls through to `$PATH` afterward (D-09) -- refusing an absent path, a path of the wrong kind, or a directory missing its declared marker, each refusal naming the tool id, the path, and stating `tools.json` supplied it.
- The file layer gained a real executable-bit check -- `accessSync(candidate, fsConstants.X_OK)` inside a `try`/`catch`, never mode-bit arithmetic -- scoped to `executable`-kind candidates via a new `passesFileLayerCheck()` wrapper around the existing kind-only `matchesDeclaredKind()`. A `directory`-kind candidate is never subjected to it (proven at mode `0o555` and `0o755` both resolving). The environment and `$PATH` layers are untouched (D-08): an environment override with no executable bit still resolves exactly as in plan 59-01.
- One bad `tools.json` entry still refuses exactly one tool (D-09): a malformed `acme` entry and a valid `x64sc` entry in the same file produce one refusal and one success in the same call sequence; `tried` carries no `PATH`-built candidate for an id refused at the file layer.
- A backstop test samples the concurrency property recorded in this plan's `must_haves` (T-59-13): a `tools.json` rewritten between calls yields one complete state, the other complete state, or a parse refusal -- never a value drawn from both.
- `resources/tool-location.mjs` regenerated via `build.ts` after each task; `resources-sync.test.ts` green.

## Task Commits

1. **Task 1: `validateToolsFile()` -- the file judged alone** -- `957524fd` (test, RED) -> `cbe0d0f4` (feat, GREEN)
2. **Task 2: The file layer's refusal contract inside `resolveTool()`** -- `e56601a5` (test, RED) -> `ead7a041` (feat, GREEN)

**Plan metadata:** commit hash recorded below after this file and STATE/ROADMAP/REQUIREMENTS are committed.

_Both tasks carried `tdd="true"`. Task 1's RED confirmed 1 of 35 planned cases failing on its target assertion (the `__proto__` case, against an implementation written directly rather than a stub -- see Deviations) before the underscore-exemption refinement made it GREEN at 35/35. Task 2's RED confirmed 4 of 44 cases failing on their target assertions (absent-path refusal, the executable-bit pair, the D-09 blast radius, and the tried-exclusion check) against the pre-Task-2 implementation, while the other 40 -- including five pre-existing fixtures repaired in the same RED commit -- already passed, correctly proving those invariants held with no implementation change needed. No separate REFACTOR commit was needed for either task._

## Files Created/Modified
- `src/mcp/vice/tool-location.mts` -- `validateToolsFile()`, `ToolsFileProblem`, `ValidateToolsFileDeps`, `describeValueShape()`; `resolveTool()`'s file layer gains `passesFileLayerCheck()` and `buildFileLayerRefusal()` and is now terminal per id; `ResolveToolDeps` gains `access`
- `src/mcp/vice/tool-location.test.ts` -- 35 new tests across the two tasks (validateToolsFile's clean/planted-violation pairs, the amended-triad and executable-bit cases, the blast-radius and tried-exclusion checks, and the concurrency backstop); 6 pre-existing tests repaired for the new file-layer behaviour (see Decisions Made)
- `src/mcp/vice/resources/tool-location.mjs` -- regenerated compiled artifact, committed after each task

## Decisions Made
- **The D-11 underscore-prose exemption is scoped to a single leading underscore, not any leading underscore.** See frontmatter `key-decisions` for the full resolution of the conflict between the plan's action text and its own verify gate over `__proto__`.
- **Task 2 completes the amended LOC-06 triad's "absent" clause in `resolveTool()` itself**, which plan 59-02 explicitly deferred pending this plan's validator/resolver split. This required repairing six pre-existing tests written before the executable-bit check and the absent-path refusal existed -- see frontmatter `key-decisions` for the full list and rationale.
- Everything else followed the plan as written: the locked `ToolsFileProblem`/`ValidateToolsFileDeps` shapes, the CRITERION AMENDMENT text verbatim, D-01 through D-17 as recorded in `59-CONTEXT.md`, none reopened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Six pre-existing test fixtures broke under the new file-layer checks**
- **Found during:** Task 2 RED phase, first full test run after adding the amended-triad and executable-bit test cases
- **Issue:** Five tests (`file layer answers when the environment variable is unset`, the file-layer subtest inside `compiled artifact: the same three layers answer…`, and the three path-normalisation tests for `~/` expansion, bare `~`, and relative-to-`projectRoot`, plus the non-ASCII round-trip test) wrote an `x64sc`-kind (`executable`) file via `writeFileSync(path, "")` with no executable bit set, which the new file-layer `accessSync(path, X_OK)` check now refuses. A sixth test (`nothing answers: …`) named a nonexistent path in a `tools.json` entry for `x64sc` to prove a fall-through to `$PATH`; the amended triad now refuses a named-but-absent path outright rather than falling through, so the previously-passing assertion (`refusal === null`) would now be false.
- **Fix:** Added `chmodSync(path, 0o755)` after each of the five file-writes so they continue testing "the file layer answers" rather than newly colliding with the executable-bit check this plan adds. Repaired the sixth test's fixture to write `{}` (no `x64sc` key at all) instead of a key naming a nonexistent path, preserving the test's original intent -- "the file has nothing to say about this id, so resolution falls through to `$PATH`" -- without asserting the now-superseded "a named-but-absent path silently falls through" behaviour.
- **Files modified:** `src/mcp/vice/tool-location.test.ts`
- **Verification:** `node --test tool-location.test.ts` -- 44/44 pass after the fix, including all six repaired tests
- **Committed in:** `e56601a5` (Task 2 RED commit, since the repairs were necessary to even reach a meaningful RED/GREEN signal) and confirmed still green in `ead7a041` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (6 pre-existing test fixtures repaired for a directly plan-mandated behaviour change, scope-internal to `tool-location.test.ts`, already in this task's `files_modified`)
**Impact:** No scope creep -- every repaired assertion belongs to a file this task already modifies, and each repair keeps the fixture testing the SAME invariant it was originally written for, under the new file-layer semantics this plan's own acceptance criteria require.

## Issues Encountered

**`npm run test:automated` reports the same one pre-existing, out-of-scope failure documented in plans 59-01 and 59-02's SUMMARYs.** `phase58-citation-ledger.test.ts`'s "the committed provenance document's citation ledger is complete and every anchor resolves" fails because a citation in `docs/phase58-declaration-provenance.md` points at a `ROADMAP.md` line range that has since drifted. Reproduced identically before any of this plan's changes were present (confirmed by the orchestrator at commit `613571e5`, and by plans 59-01/59-02's own dispatches), and none of `ROADMAP.md`, `phase58-citation-ledger.test.ts`, or `docs/phase58-declaration-provenance.md` is in this plan's `files_modified`. Not fixed here per the Scope Boundary deviation rule -- already logged in `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` and `WINDOWS.md` entry 68 by plan 59-01; not re-logged. With no broker running, the full gate reports 3757 total (3747 pass, 1 fail, 9 skipped) -- the one known failure and no other.

## Known Stubs

None -- no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired components) apply to this plan; it completes a resolution/validation module that nothing calls yet by design (D-01, carried from plan 59-01).

## Threat Flags

None beyond what the plan's own `<threat_model>` already scoped (T-59-09 through T-59-13, T-59-SC) -- no new surface was introduced outside that register. T-59-09 (the prototype-shaped key) and T-59-10 (the amended triad plus executable-bit check) are both directly exercised by this plan's planted-violation tests; T-59-13 (a `tools.json` rewritten during a read) is sampled by the concurrency backstop test and remains recorded as `accept`/sampled rather than proven, per the plan's own threat register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `validateToolsFile()` and the completed `resolveTool()` file-layer refusal contract are both proven; Phase 60 can rewire live callsites (`backend-detect.mts`, `host-tool.mts`'s `findAcmeLib()`/`findDxaBinary()`/`findSiblingBinary()`/the `ghidra.analyze` `GHIDRA_HOME` read) against `resolveTool()`, and Phase 61's doctor can call both exports without a second detection path (`DOCTOR-05`).
- Nothing calls this seam yet, which is correct per D-01 -- Phase 60 owns wiring it in.
- Sibling plan 59-04 (extending `prerequisites.test.ts`) and plan 59-05 are unaffected by this plan's changes; neither `prerequisites.json` nor `prerequisites.test.ts` was touched.
- No blockers. The one open item is the pre-existing, unrelated citation-ledger drift already documented in plans 59-01/59-02's SUMMARYs and `WINDOWS.md` entry 68 -- not a blocker for 59-04/59-05.

## Self-Check: PASSED

- All 3 key-files verified present on disk with `[ -f ]`.
- All 4 commit hashes (`957524fd`, `cbe0d0f4`, `e56601a5`, `ead7a041`) verified present via `git log --oneline --all`.
- Re-ran `node --test tool-location.test.ts` (44/44 pass), `node --test resources-sync.test.ts` (pass), `node --test prerequisites.test.ts` (20/20 pass), and `npm run typecheck` (exit 0) immediately before writing this section.
- Re-ran every one of Task 1's and Task 2's embedded `<verify>` gate scripts against the freshly-rebuilt `resources/tool-location.mjs`; all reported the expected values (see task verify logs).
- `npm run test:automated` with no broker running reports exactly the one pre-existing, unrelated failure (`phase58-citation-ledger.test.ts`) documented above under Issues Encountered, and no other -- not silently omitted.
- `git rev-list --count e0030da9..HEAD` measured `4`, matching `actuals.commits` and the four commits listed above.

---
*Phase: 59-the-tool-location-seam-and-its-precedence-order*
*Completed: 2026-09-18*
