---
phase: 59-the-tool-location-seam-and-its-precedence-order
plan: 02
subsystem: infra
tags: [tool-location, path-resolution, build-pipeline, host-bound-module, prerequisites-declaration]

# Dependency graph
requires:
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "tool-location.mts (resolveTool()/resolveOnPath()), x64sc's location/kind block on prerequisites.json, the D-12 tools.json bare-string format (plan 59-01)"
provides:
  - "All eight prerequisites.json records carry a completed location block and a kind: four env-var names (VICE_BIN, ACME_BIN, ACME, GHIDRA_HOME) each matching its real read site; c1541/petcat deliberately omit envVar; dxa/node deliberately refuse via fileOverridable: false plus a verbatim reason"
  - "resolveTool() is kind-aware: a directory-kind candidate must be a statable directory containing its declared marker, and the seam returns the directory itself, never the marker-joined path"
  - "A tools.json entry that exists on disk but fails the kind check (wrong kind, or a directory missing its marker) is refused by name; an absent entry still falls through unchanged"
  - "A record declared fileOverridable: false (dxa, node) walks no layer at all -- not env, not tools.json, not $PATH -- and refuses with a sentence quoting its own declared reason verbatim"
  - "The compiled resources/tool-location.mjs artifact carries the same kind-aware and exclusion behaviour as the source"
affects: [60-rewire-every-live-resolution-path-through-the-seam, 61-the-doctor, 59-03, 59-04, 59-05]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 3
plan_head_before: d09fafc2fa1b040b0ee1c2d62ec68a9f036e77c1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kind-aware existence check (matchesDeclaredKind) widens plain existsSync to a statable-file-or-marked-directory test, reused across the environment and file layers"
    - "Refusal-by-name for an on-disk-but-wrong-kind tools.json entry, distinct from an absent entry (which still falls through) -- the LOC-06 criterion amendment, scoped to resolveTool() only for the two cases this plan tests"
    - "A fileOverridable: false record short-circuits before any layer is touched, returning tried: [] and a refusal built from the declaration's own reason field, never a re-authored sentence"

key-files:
  created: []
  modified:
    - src/mcp/vice/prerequisites.json
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/resources/tool-location.mjs

key-decisions:
  - "The CRITERION AMENDMENT's 'path is absent' refusal clause was NOT implemented in resolveTool(). Only the two clauses this plan's <behavior>/<acceptance_criteria> actually test -- wrong kind and missing marker for an entry that exists on disk -- produce a refusal. An absent tools.json entry still falls through to the next layer unchanged, exactly as plan 59-01's own passing test already proved for x64sc. The full triad (including 'absent') is D-10's validateToolsFile(), a separate export this plan does not build."
  - "The pre-existing directory-kind test fixture (withDirectoryKindFixture, from plan 59-01) declared no marker field, which the new kind-aware check now requires for any directory-kind record. Fixed the fixture to carry a marker and created that marker file in the trailing-separator test, matching the shape every real directory-kind record declares (D-07) -- rather than special-casing markerless directories in resolveTool() itself."

requirements-completed: [LOC-05, LOC-06, LOC-07]

coverage:
  - id: D1
    description: "Every declared tool id (x64sc, c1541, petcat, acme, acme-lib, ghidra, dxa, node) carries a location block and a kind; the four env-var names match their real read sites; c1541/petcat omit envVar entirely; dxa/node carry fileOverridable: false with a verbatim reason"
    requirement: "LOC-05"
    verification:
      - kind: unit
        ref: "node -e over prerequisites.json (Task 1 verify block) -- schemaVersion=1, no missing ids, no record without location/kind, envvars map correctly, dxa/node reasons contain the required substrings"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts (20/20, unmodified by this plan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "acme-lib and ghidra resolve to the directory itself (never the marker-joined path) through the environment and tools.json layers, and are never walked on $PATH"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("acme-lib", …) resolves through the environment variable to the directory itself, never the marker-joined path'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("ghidra", …) resolves through tools.json to the directory when its marker is present'
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a directory-kind id is not walked on $PATH: no environment and no file entry leaves tried with no PATH candidate"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tools.json entry that exists on disk but does not match its record's kind, or is a directory missing its declared marker, is refused by name -- distinct from an absent entry, which still falls through"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("ghidra", …) refuses a tools.json directory that exists but lacks its marker'
        status: pass
    human_judgment: false
  - id: D4
    description: "dxa and node resolve through no layer at all -- environment, tools.json and $PATH are all untouched even when each names a real file -- and the refusal quotes the declaration's own reason verbatim, provably not duplicated in the module"
    requirement: "LOC-05, LOC-07"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("dxa", …) refuses through every layer with the declared reason, even when tools.json, env and PATH all name real files'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("node", …) refuses through every layer with the declared reason, even when VICE_BROKER_NODE names a real executable'
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#the exclusion refusal is read from the declaration at call time, not duplicated in the module"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.mts import_specifiers / declared_reason_strings_in_module check (Task 2 verify block) -- both dxa_sentence_copied_into_module and node_sentence_copied_into_module read false"
        status: pass
    human_judgment: false
  - id: D5
    description: "c1541 consults no environment variable at all -- any variable set in the injected environment changes nothing -- while resolving normally through tools.json and $PATH"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/tool-location.test.ts#resolveTool("c1541", …) consults no environment variable at all'
        status: pass
    human_judgment: false
  - id: D6
    description: "The compiled resources/tool-location.mjs artifact carries the same directory-kind and exclusion behaviour as the unbuilt source"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#compiled artifact: the two directory-kind ids and the two excluded ids behave the same as the unbuilt source"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/resources-sync.test.ts"
        status: pass
    human_judgment: false

duration: approx 25 min
completed: 2026-09-18T10:12:11Z
status: complete
---

# Phase 59 Plan 02: The Remaining Seven Declaration Records, and a Kind-Aware `resolveTool()` Summary

**Seven `prerequisites.json` records gain `location`/`kind` fields, and `resolveTool()` learns to validate a directory candidate against its marker and to refuse the two ids (`dxa`, `node`) that may never be located through any layer, quoting each refusal from the declaration itself.**

## Performance

- **Duration:** approx 25 min (not separately timed; single continuous dispatch)
- **Completed:** 2026-09-18T10:12:11Z
- **Tasks:** 2 (Task 1: declaration completion; Task 2: `resolveTool()` kind-awareness, `tdd="true"`)
- **Files modified:** 4 (`prerequisites.json`, `tool-location.mts`, `tool-location.test.ts`, `resources/tool-location.mjs`)

## Accomplishments
- `prerequisites.json`'s seven remaining records (`c1541`, `petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`) each gained a `location` block and a `kind`, matching the plan's locked table byte-for-byte: four env-var names verified against their real read sites (`ACME_BIN` at `host-tool.mts:1292`, `ACME` at `host-tool.mts:2234`, `GHIDRA_HOME` at `host-tool.mts:1348`, plus the existing `VICE_BIN`), `c1541`/`petcat` deliberately omitting `envVar`, and `dxa`/`node` carrying `fileOverridable: false` with the two exact condensed sentences from `.planning/REQUIREMENTS.md`'s Out of Scope table.
- `resolveTool()` now makes its existence test kind-aware: an `executable`-kind candidate must be a statable file; a `directory`-kind candidate must be a statable directory containing its declared `marker`, tested by joining the marker onto the candidate and returning the candidate directory itself -- never the joined path. This check applies at both the environment and file layers; the `$PATH` layer stays skipped entirely for a directory-kind id (D-15), recording nothing in `tried`.
- A `tools.json` entry that resolves to something that exists on disk but fails the kind check -- the wrong kind, or a directory missing its marker -- is now refused by name, distinct from an absent entry (which still falls through to the next layer unchanged, preserving plan 59-01's own locked behaviour for `x64sc`).
- A record declared `fileOverridable: false` (`dxa`, `node`) short-circuits before any layer is touched: `tried` stays `[]`, and the refusal quotes the record's own `location.reason` field verbatim -- proven, not merely asserted, by a test that changes the reason in a scratch declaration and observes the refusal text change with it, and by a static check that neither sentence appears as a literal inside `tool-location.mts`.
- `resources/tool-location.mjs` regenerated via `build.ts` and proven, through the same exclusion and directory-kind assertions run against the dynamically-imported compiled artifact, to carry identical behaviour to the source.

## Task Commits

1. **Task 1: The remaining seven records** - `f371c939` (feat)
2. **Task 2: `resolveTool()` learns the record** - `3273ab92` (test, RED) -> `fddd6a21` (feat, GREEN)

**Plan metadata:** commit hash recorded below after this file and STATE/ROADMAP/REQUIREMENTS are committed.

_Note: Task 2 carried `tdd="true"`. RED was confirmed genuine: 5 of 22 planned test cases failed on their target assertions against the pre-Task-2 implementation (the ghidra-missing-marker case, the dxa/node exclusion cases, the declaration-read-at-call-time case, and the compiled-artifact exclusion case), while the other 17 new cases already passed against the 59-01 baseline plus Task 1's completed declaration -- correctly proving those invariants held with no implementation change needed, exactly as plan 59-01's own SUMMARY reported for its Task 3. No separate REFACTOR commit was needed; the GREEN implementation required no further cleanup beyond fixing one pre-existing test fixture (see Deviations)._

## Files Created/Modified
- `src/mcp/vice/prerequisites.json` - Seven remaining records gain `location`/`kind` (and `marker` for the two directory-kind ids); `schemaVersion` stays `1`
- `src/mcp/vice/tool-location.mts` - `resolveTool()` gains the `fileOverridable: false` short-circuit and the kind-aware `matchesDeclaredKind()` check reused across the env and file layers; `defaultStatKind()` wired in as the real default behind `deps.statKind`
- `src/mcp/vice/tool-location.test.ts` - 9 new colocated tests for the directory-kind resolution, the two exclusions, the declaration-read-at-call-time proof, and the compiled-artifact equivalent; one pre-existing fixture fixed (see Deviations)
- `src/mcp/vice/resources/tool-location.mjs` - Regenerated compiled artifact, committed

## Decisions Made
- **Scoped the LOC-06 criterion amendment's refusal to the two clauses this plan actually tests (wrong kind, missing marker for an on-disk entry), not the third ("path is absent").** An absent `tools.json` entry still falls through unchanged, matching plan 59-01's own locked test for `x64sc`. The full triad, including "absent", is D-10's `validateToolsFile()` -- a separate export this plan does not build. Recorded in frontmatter `key-decisions`.
- **Fixed the pre-existing directory-kind test fixture rather than special-casing a markerless directory record inside `resolveTool()`.** The fixture from plan 59-01 declared `kind: "directory"` with no `marker`, which the real declaration never does (both `acme-lib` and `ghidra` always carry one, D-07); adding a marker to the fixture keeps the test honest about the shape the real declaration produces, rather than teaching the implementation to tolerate a shape that cannot occur.
- Everything else followed the plan as written: the locked table of eight records, D-01 through D-17 as recorded in `59-CONTEXT.md`, none reopened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test fixture broke under the new kind-aware check**
- **Found during:** Task 2 GREEN phase, first full test run after implementing `matchesDeclaredKind()`
- **Issue:** `withDirectoryKindFixture()` (written in plan 59-01) declared a `directory`-kind record with no `marker` field. The new kind-aware check requires a `marker` for any `directory`-kind record, so the pre-existing "trailing separator resolves to the same path" test started failing: `matchesDeclaredKind()` returned `false` for every candidate against a markerless directory record.
- **Fix:** Added `marker: "marker-file"` to the fixture's declaration and created that marker file inside the test's scratch `libDir`, matching the shape every real directory-kind record declares (D-07).
- **Files modified:** `src/mcp/vice/tool-location.test.ts`
- **Verification:** `node --test tool-location.test.ts` -- 22/22 pass after the fix, including the repaired test
- **Committed in:** `fddd6a21` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, scope-internal to the file this task already modifies)
**Impact:** No scope creep -- the fixture belongs to `tool-location.test.ts`, already in this task's `files_modified`, and the fix keeps the test honest about a record shape the real declaration never produces.

## Issues Encountered

**`npm run test:automated` reports the same one pre-existing, out-of-scope failure documented in plan 59-01's SUMMARY.** `phase58-citation-ledger.test.ts`'s "the committed provenance document's citation ledger is complete and every anchor resolves" fails because a citation in `docs/phase58-declaration-provenance.md` points at a `ROADMAP.md` line range that has since drifted (`.planning/ROADMAP.md:1980-1983` vs. the anchor text's actual current location at `:1989`). Reproduced identically before any of this plan's changes were present (confirmed by 59-01's own dispatch), and none of `ROADMAP.md`, `phase58-citation-ledger.test.ts`, or `docs/phase58-declaration-provenance.md` is in this plan's `files_modified`. Not fixed here per the Scope Boundary deviation rule -- already logged in `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` and `WINDOWS.md` entry 68 by plan 59-01; not re-logged. The full gate otherwise reports 3725/3726 relevant tests passing (3735 total, 9 skipped, 1 known failure), with no broker running.

## Known Stubs

None -- no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired components) apply to this plan; it completes a declaration and a resolution module that nothing calls yet by design (D-01, carried from plan 59-01).

## Threat Flags

None beyond what the plan's own `<threat_model>` already scoped (T-59-05 through T-59-08, T-59-SC) -- no new surface was introduced outside that register. T-59-05 (no layer walked for a `fileOverridable: false` record) and T-59-06 (refusal text read from the declaration, not duplicated) are both directly exercised by this plan's new tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All eight `prerequisites.json` records now carry a complete `location`/`kind` declaration; `resolveTool()` resolves every one of them correctly, including the two directory-kind ids and the two excluded ids.
- Nothing calls this seam yet, which is correct per D-01 -- Phase 60 owns wiring it into a live resolution path (`backend-detect.mts`, `host-tool.mts`'s `findAcmeLib()`/`findDxaBinary()`/`findSiblingBinary()`/the `ghidra.analyze` `GHIDRA_HOME` read).
- No blockers. The one open item is the pre-existing, unrelated citation-ledger drift already documented in plan 59-01's SUMMARY and `WINDOWS.md` entry 68 -- not a blocker for 59-03 through 59-05.

## Self-Check: PASSED

- All 4 key-files verified present on disk with `[ -f ]`.
- All 3 commit hashes (`f371c939`, `3273ab92`, `fddd6a21`) verified present via `git log --oneline --all`.
- Re-ran `node --test tool-location.test.ts` (22/22 pass), `node --test prerequisites.test.ts` (20/20 pass), `node --test resources-sync.test.ts` (pass), and `npm run typecheck` (exit 0) immediately before writing this section.
- `npm run test:automated` with no broker running reports exactly the one pre-existing, unrelated failure (`phase58-citation-ledger.test.ts`) documented above under Issues Encountered, and no other -- not silently omitted.
- `git rev-list --count d09fafc2..HEAD` measured `3`, matching `actuals.commits` and the three commits listed above.

---
*Phase: 59-the-tool-location-seam-and-its-precedence-order*
*Completed: 2026-09-18*
