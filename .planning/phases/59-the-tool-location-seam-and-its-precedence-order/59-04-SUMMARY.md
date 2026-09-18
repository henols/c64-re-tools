---
phase: 59-the-tool-location-seam-and-its-precedence-order
plan: 04
subsystem: infra
tags: [tool-location, path-resolution, prerequisites-declaration, structural-gate]

# Dependency graph
requires:
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "All eight prerequisites.json records with location/kind/marker (plan 59-02), resolveTool()/validateToolsFile()'s completed refusal contract (plan 59-03)"
provides:
  - "assertLocationBlockShape(doc), assertKindAndMarker(doc) and assertNoReservedToolId(doc) -- three new named, exported validators in prerequisites.test.ts, the declaration's one authoritative structural gate, each with a clean control and at least one planted-violation case"
  - "The new fields the refusals in plan 59-03 quote verbatim (location.reason) and the fields Phase 61's doctor prints per row (location.envVar, kind, marker) are now policed in the same place as the declaration's original fields, never in a second gate"
  - "Relation-only proof that the four declared env-var names and the two declared markers map to their tool ids, with no assertion on how many records carry either field"
  - "Packaging proof that the compiled tool-location seam artifact ships alongside the declaration in the packed tarball's own file list, one directory apart -- the artifact's filename derived from build.ts's HOST_BOUND_ARTIFACTS, never a fresh string literal"
affects: [60-rewire-every-live-resolution-path-through-the-seam, 61-the-doctor, 59-05]

# Actuals (#2632)
actuals:
  tokens: 3600
  tasks: 2
  commits: 1
plan_head_before: d74e2c197f6965c02d7bd154684c601e9a961a30

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same named-exported-function / planted-violation idiom as the four pre-existing validators in this file -- no second structural gate, no repo-path existence check for packaging"
    - "assertNoReservedToolId is a deliberate superset of the D-11 unknown-key exemption's exact single-leading-underscore predicate: it flags every underscore-led tool id (single or double leading), not only the ones the exemption actually swallows, because no real tool id ever needs either shape"

key-files:
  created: []
  modified:
    - src/mcp/vice/prerequisites.test.ts

key-decisions:
  - "assertNoReservedToolId flags any tool id beginning with an underscore (single or double leading), rather than mirroring validateToolsFile()'s exact single-leading-underscore exemption predicate. D-11's own text ('a test must assert no declared tool id begins with `_`') is unqualified, and the exemption's narrower predicate describes what tools.json swallows silently -- not a ceiling on what a tool id may safely start with."
  - "Task 1 and Task 2 both modify the same single file (prerequisites.test.ts, this plan's only files_modified entry), so both tasks were committed together as one commit rather than two -- there is no meaningful RED/GREEN split for Task 1 (it did not carry tdd=\"true\") and no intermediate state worth a separate commit for Task 2's one additional case."

requirements-completed: [LOC-05, LOC-06, LOC-07]

coverage:
  - id: D1
    description: "assertLocationBlockShape passes on the real committed document and reports a record whose location is missing/not-an-object/an-array, a non-boolean fileOverridable, a fileOverridable:false record with a missing or empty-string reason, an implausible envVar name (lowercase, leading digit, or a disallowed character), and an extra key inside the three D-05 locks"
    requirement: "LOC-05, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#assertLocationBlockShape: passes on the real document"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): assertLocationBlockShape reports a record whose location is missing, not an object, or an array (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): a non-boolean fileOverridable is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): a fileOverridable:false record with no reason is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): a fileOverridable:false record with an empty-string reason is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): a lowercase envVar is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): an envVar with a leading digit, or a character outside [A-Z0-9_], is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (LOC-05/T-59-14): an extra key inside location is reported (D-05 locks, non-vacuity)"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertKindAndMarker passes on the real committed document and reports a record whose kind is missing/unrecognised, a directory record with no or empty marker, and an executable record carrying a marker"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#assertKindAndMarker: passes on the real document"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (D-07/T-59-15): assertKindAndMarker reports a record whose kind is missing or unrecognised (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (D-07/T-59-15): a directory record with no marker, or an empty-string marker, is reported (non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (D-07/T-59-15): an executable record carrying a marker is reported (non-vacuity)"
        status: pass
    human_judgment: false
  - id: D3
    description: "assertNoReservedToolId passes on the real committed document and reports a planted tool id beginning with an underscore; every record's id still equals its own key; the four env-var names and the two markers map to their tool ids as relations, never a count"
    requirement: "LOC-05, LOC-06, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#assertNoReservedToolId: passes on the real document and reports a planted underscore-prefixed id (D-11, non-vacuity)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#every record's id still equals its own key (subset relation, never a record count)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#D-05: the four declared environment-variable names match their tool ids (relation, not a count)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#D-07: the two declared directory markers match their tool ids (relation, not a count)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The compiled tool-location seam artifact and prerequisites.json are both present in the packed tarball's own file list, one directory apart, with the artifact's filename derived from build.ts's HOST_BOUND_ARTIFACTS rather than a fresh string literal"
    requirement: "LOC-05, LOC-06, LOC-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#packaging (T-59-16): the compiled seam artifact and its declaration are both packed, one directory apart"
        status: pass
    human_judgment: false

duration: approx 35 min
completed: 2026-09-18T11:00:00Z
status: complete
---

# Phase 59 Plan 04: Guarding the Location, Kind, Marker and Packaged-Seam Fields Summary

**Three new named, exported validators — `assertLocationBlockShape`, `assertKindAndMarker` and `assertNoReservedToolId` — extend `prerequisites.test.ts`'s existing structural gate to police the `location`/`kind`/`marker` fields the phase's refusals and doctor rows depend on, each proven with a planted violation; a fourth new case proves the compiled seam artifact and the declaration both survive packing, one directory apart.**

## Performance

- **Duration:** approx 35 min
- **Completed:** 2026-09-18T11:00:00Z
- **Tasks:** 2 (Task 1: the three field validators; Task 2: the packaging case)
- **Files modified:** 1 (`src/mcp/vice/prerequisites.test.ts`)

## Accomplishments
- `assertLocationBlockShape(doc)` added: rejects a record whose `location` is missing, not a plain object, or an array; whose `fileOverridable` is not a boolean; whose `fileOverridable: false` carries a missing or empty-string `reason` (the exact field a Phase 60 refusal quotes verbatim, so an absent one would produce a refusal with nothing in it); whose `envVar`, when present, is not a plausible upper-snake-case name (lowercase, a leading digit, or a disallowed character all reported); or whose `location` carries a key outside the three D-05 locks (`envVar`, `fileOverridable`, `reason`).
- `assertKindAndMarker(doc)` added: rejects a record whose `kind` is missing or is neither `"executable"` nor `"directory"`; a `directory` record with no or an empty-string `marker`; and an `executable` record carrying a `marker` at all — the amended `LOC-06` triad is only meaningful when every directory record has something to look for.
- `assertNoReservedToolId(doc)` added: rejects any declared tool id beginning with an underscore (D-11) — a deliberate superset of `validateToolsFile()`'s exact single-leading-underscore exemption predicate (plan 59-03), since no real tool id has any legitimate reason to begin with either shape.
- Each of the three validators has its own clean-control case against the real, unmodified document and at least one dedicated planted-violation case built with `structuredClone`, matching the granularity of the four pre-existing validators in this file. Eight distinct planted-violation cases were added for `assertLocationBlockShape` alone (missing/non-object/array location, non-boolean `fileOverridable`, missing reason, empty reason, lowercase envVar, leading-digit envVar, disallowed-character envVar, extra location key), four for `assertKindAndMarker`, and one for `assertNoReservedToolId`.
- Two relation-only tests were added: the four declared environment-variable names (`x64sc`/`VICE_BIN`, `acme`/`ACME_BIN`, `acme-lib`/`ACME`, `ghidra`/`GHIDRA_HOME`) and the two declared markers (`acme-lib`/`cbm/c64/vic.a`, `ghidra`/`support/analyzeHeadless`) mapped to their tool ids, plus a generalized "every record's id equals its own key" subset check — none of these count how many records carry either field.
- The packaging section gained one more case (T-59-16): `HOST_BOUND_ARTIFACTS` is imported from `./build.ts`, the compiled seam artifact's own filename is found in that array rather than typed as a fresh literal, and the resulting `resources/`-prefixed path is asserted present in `packedFileList()`'s output alongside `prerequisites.json`, with an explicit check that the artifact sits exactly one directory below the package root — the sibling relationship the seam's own declaration lookup depends on. No second `npm pack` helper was added and no repository-path `existsSync` check was used.

## Task Commits

1. **Task 1 + Task 2 (both modify the same single file):** `813062f3` (test)

_Neither task carried `tdd="true"`; Task 1 is `type="auto"` and Task 2 is `type="auto"` with a `<precondition>` (npm reachable, no network) that was already met — the same packaging case in this file already depends on it and passes today. Both tasks land in one commit since `files_modified` names exactly one file for this plan and there is no meaningful intermediate state between them worth a separate commit._

**Plan metadata:** commit hash recorded below after this file and STATE/ROADMAP/REQUIREMENTS are committed.

## Files Created/Modified
- `src/mcp/vice/prerequisites.test.ts` — `ToolRecord` extended with optional `location`/`kind`/`marker`; three new named exported validators plus their clean-control and planted-violation test cases; two relation-only tests; one new packaging case; `HOST_BOUND_ARTIFACTS` imported from `./build.ts`. Test count: 20 → 37. The file's pre-existing real NUL byte (inside the D-06 test's `.join()` separator) survives untouched — verified byte-for-byte before and after every edit.

## Decisions Made
- **`assertNoReservedToolId` flags any underscore-led tool id, single or double leading**, rather than mirroring `validateToolsFile()`'s narrower single-leading-underscore exemption predicate. D-11's own text ("a test must assert no declared tool id begins with `_`") is unqualified; the exemption's predicate describes what `tools.json` silently swallows, not a ceiling on what shape a real tool id may safely take. Recorded in frontmatter `key-decisions`.
- **Task 1 and Task 2 were committed together**, since both modify the plan's single `files_modified` entry and neither carries `tdd="true"` — there is no RED/GREEN split and no intermediate state between the two tasks worth a separate commit.
- Everything else followed the plan as written: the D-05 shape lock (`envVar?`, `fileOverridable`, `reason?`), the D-07 kind/marker rule, and the LOC-05/06/07 requirement IDs, none reopened.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**`npm run test:automated` reports the same one pre-existing, out-of-scope failure documented in plans 59-01/59-02/59-03's SUMMARYs.** `phase58-citation-ledger.test.ts`'s "the committed provenance document's citation ledger is complete and every anchor resolves" fails because a citation in `docs/phase58-declaration-provenance.md` points at a `ROADMAP.md` line range that has since drifted further (`.planning/ROADMAP.md:1980-1983` no longer matches the anchor text, which has moved to a different line as the file has grown). Reproduced identically before any of this plan's changes were present, and none of `ROADMAP.md`, `phase58-citation-ledger.test.ts`, or `docs/phase58-declaration-provenance.md` is in this plan's `files_modified`. Not fixed here per the Scope Boundary deviation rule — already logged in `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` and `WINDOWS.md` entry 68 by plan 59-01; not re-logged. With no broker running, the full gate reports 3774 total (3764 pass, 1 fail, 9 skipped) — the one known failure and no other.

**Shared-requirement-ID gate (#2388): only `LOC-06` was marked complete by this plan.** `LOC-05` and `LOC-07` are also declared by sibling plan `59-05` (not yet executed), so `requirements.ready-ids` correctly held both back — they will be marked complete once `59-05` produces its own SUMMARY.md. `LOC-06` is declared only by `59-01`/`59-02`/`59-03`/`59-04`, all now finished, so it was marked complete in this plan's `update_requirements` step.

## Known Stubs

None — no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired components) apply to this plan; it extends a structural test gate over a declaration nothing calls yet by design (D-01, carried from plan 59-01).

## Threat Flags

None beyond what the plan's own `<threat_model>` already scoped (T-59-14 through T-59-17, T-59-SC) — no new surface was introduced outside that register. T-59-14 (absent/empty `reason`), T-59-15 (a markerless directory record), T-59-16 (the compiled artifact not surviving packing) and T-59-17 (an underscore-led tool id) are all directly exercised by this plan's planted-violation tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The declaration's `location`/`kind`/`marker` fields are now guarded by the same structural gate as its original fields — Phase 60's refusal wiring and Phase 61's doctor can both depend on this file catching drift, with no second gate to disagree with it.
- `LOC-06` is now complete. `LOC-05` and `LOC-07` remain open pending sibling plan `59-05`, which shares those requirement IDs and has not yet executed.
- No blockers. The one open item is the pre-existing, unrelated citation-ledger drift already documented in plans 59-01/59-02/59-03's SUMMARYs and `WINDOWS.md` entry 68 — not a blocker for `59-05`.

## Self-Check: PASSED

- Key file `src/mcp/vice/prerequisites.test.ts` verified present on disk with `[ -f ]`.
- Commit hash `813062f3` verified present via `git log --oneline --all`.
- Re-ran `node --test prerequisites.test.ts` (37/37 pass) and `npm run typecheck` (exit 0) immediately before writing this section.
- Re-ran every one of Task 1's and Task 2's embedded `<verify>` gate scripts exactly as written; all reported the expected values (three exported validator names present, ≥5 planted-violation cases, zero writes to the committed declaration, zero declaration/seam-file changes, `npm pack --dry-run --json` listing both the declaration and the seam artifact one directory apart, exactly one `npm pack` helper, zero repository-path existence checks).
- `npm run test:automated` with no broker running reports exactly the one pre-existing, unrelated failure (`phase58-citation-ledger.test.ts`) documented above under Issues Encountered, and no other — not silently omitted.
- The pre-existing real NUL byte in `prerequisites.test.ts` was confirmed present (count 1, at its new byte offset after the edits) both before and after every edit and after the commit.
- `git rev-list --count d74e2c19..HEAD` measured `1`, matching `actuals.commits` and the one commit listed above.

---
*Phase: 59-the-tool-location-seam-and-its-precedence-order*
*Completed: 2026-09-18*
