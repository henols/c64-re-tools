---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 02
subsystem: infra
tags: [prerequisites, tool-location, declaration, tdd, structural-gate]

# Dependency graph
requires:
  - phase: 58-one-declaration-four-places-that-can-no-longer-disagree
    provides: "prerequisites.json's remedies block (D-06 platform keys, D-09 prose-not-argv)"
  - phase: 59-the-tool-location-seam-and-its-precedence-order
    provides: "tool-location.mts's readDeclaration(here) and its private declaration-lookup idiom"
provides:
  - "remedyTextsFor(id, deps) -- the FIRST runtime reader of prerequisites.json's remedies arrays"
  - "assertRemedyBlockShape() and assertRemedyIsProseNotArgv() -- structural gate over the remedies shape the reader depends on"
affects: ["60-03", "60-04 (the refusal-site rewiring plans that will call remedyTextsFor())"]

# Actuals (#2632)
actuals:
  tokens: 6121
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "remedyTextsFor() reuses tool-location.mts's existing private readDeclaration(here) reader rather than adding a second one"
    - "assertRemedyBlockShape/assertRemedyIsProseNotArgv follow prerequisites.test.ts's existing named-exported-validator idiom (offender-list return, never a throw)"

key-files:
  created: []
  modified:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/prerequisites.test.ts
    - src/mcp/vice/resources/tool-location.mjs

key-decisions:
  - "RED phase used a stub remedyTextsFor() that always returns [] (rather than omitting the export) so the six new tests fail on their real assertions, not on a missing-export module-load crash -- confirmed via gsd-tools check tdd-red-evidence (RED_EVIDENCE_OK)."
  - "assertRemedyBlockShape and assertRemedyIsProseNotArgv are two separate validators (shape vs. never-auto-install prose constraint) rather than one, matching the plan's own two named exports and keeping each offender list about one concern."

requirements-completed: [DECL-03]

coverage:
  - id: D1
    description: "remedyTextsFor(id, deps) reads a declared tool's remedy prose from prerequisites.json, in platform-then-universal declaration order, byte-identically, returning [] for an unknown id or a record with no remedies block"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "tool-location.test.ts#remedyTextsFor(\"dxa\") against the real committed declaration returns exactly one string, byte-identical to remedies.universal[0].text"
        status: pass
      - kind: unit
        ref: "tool-location.test.ts#non-vacuity (DECL-03): pointing here at a scratch declaration with a distinctive dxa remedy sentence returns that sentence, proving the string is not a literal inside the module"
        status: pass
      - kind: unit
        ref: "tool-location.test.ts#remedyTextsFor(\"acme\", { platform: \"linux\" }) returns the two linux entries in declaration order followed by the universal entry, stable across repeated calls"
        status: pass
      - kind: unit
        ref: "tool-location.test.ts#empty cases: a record with no remedies block returns [], a platform with no matching key returns only universal entries, and an undeclared id returns [] without throwing"
        status: pass
      - kind: unit
        ref: "tool-location.test.ts#encoding: the c1541 linux entry containing a non-ASCII em dash is returned intact, with its string length unchanged from the parsed declaration's own value"
        status: pass
      - kind: unit
        ref: "tool-location.test.ts#compiled artifact: importing the regenerated resources/tool-location.mjs and calling remedyTextsFor returns the same answer as the unbuilt source"
        status: pass
    human_judgment: false
  - id: D2
    description: "The remedies shape remedyTextsFor() depends on is policed by prerequisites.json's one authoritative structural gate, with a planted violation observed firing for each new validator"
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "prerequisites.test.ts#assertRemedyBlockShape: passes on the real document"
        status: pass
      - kind: unit
        ref: "prerequisites.test.ts#structural (DECL-03): assertRemedyBlockShape reports a non-object remedies value, a platform key outside the closed set, and a non-array platform value (non-vacuity)"
        status: pass
      - kind: unit
        ref: "prerequisites.test.ts#structural (DECL-03): assertRemedyBlockShape reports a non-object entry, a missing/empty/non-string text, and an invalid provenance (non-vacuity)"
        status: pass
      - kind: unit
        ref: "prerequisites.test.ts#assertRemedyIsProseNotArgv: passes on the real document"
        status: pass
      - kind: unit
        ref: "prerequisites.test.ts#structural (D-09/T-60-06): assertRemedyIsProseNotArgv reports a planted args key, a cmd key, and an array-shaped text (non-vacuity)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-18
status: complete
plan_head_before: 73efe66b
commits: 3
---

# Phase 60 Plan 02: The Declaration's Remedy Reader Summary

**`remedyTextsFor()` is now the one exported reader of `prerequisites.json`'s `remedies` prose, and its shape is policed by the declaration's structural gate — the first runtime code path any of the eight records' remedy text has ever reached.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-18T13:47:00Z (approx, per STATE.md's session marker at plan start)
- **Completed:** 2026-09-18T13:58:28Z
- **Tasks:** 2 completed
- **Files modified:** 4 (`tool-location.mts`, `tool-location.test.ts`, `prerequisites.test.ts`, `resources/tool-location.mjs`)

## Accomplishments

- `remedyTextsFor(id, deps)` exported from `tool-location.mts`: reads `prerequisites.json`'s `remedies` block through the module's existing private `readDeclaration(here)`, returns platform-key entries (`linux`/`darwin`/`win32`) followed by `universal` entries, in declaration order, byte-identical (no trimming, case change, or Unicode normalisation) — proven against both the committed declaration and a scratch declaration (non-vacuity), and against both the unbuilt source and the regenerated `resources/tool-location.mjs`.
- An id the declaration does not carry, and a record with no `remedies` block, both return `[]` without throwing — matching every other export in this module's structured-result-over-throw convention.
- `assertRemedyBlockShape()` and `assertRemedyIsProseNotArgv()` added to `prerequisites.test.ts`'s structural gate, policing the `remedies` shape the new reader depends on: object shape, closed platform-key set, entry shape, non-empty string `text`, a valid three-valued `provenance`, and — Phase 58 `D-09` made mechanical — no `args`/`cmd` key and no array-shaped `text` anywhere in the declaration.
- Full TDD RED→GREEN cycle followed for Task 1 (tracer, `tdd="true"`): a stub `remedyTextsFor()` that always returned `[]` produced six genuine assertion failures (`RED_EVIDENCE_OK` via `gsd_run check tdd-red-evidence`), then the real declaration read made all 66 `tool-location.test.ts` cases pass.

## Task Commits

Each task was committed atomically (Task 1 followed the RED→GREEN TDD cycle, two commits):

1. **Task 1 RED: add failing tests for `remedyTextsFor()`** — `6cfb0e84` (test)
2. **Task 1 GREEN: implement `remedyTextsFor()` reading declaration remedies** — `cd582dfa` (feat)
3. **Task 2: police the remedies shape `remedyTextsFor()` depends on** — `58342e21` (test)

_Task 1 carried no REFACTOR commit — the GREEN implementation needed no cleanup; tests still pass unchanged._

## Files Created/Modified

- `src/mcp/vice/tool-location.mts` — new `remedyTextsFor()` export and `RemedyTextsForDeps` interface; widened the private `ToolDeclarationRecord`/new `RemedyBlock`/`RemedyEntry` types to describe the `remedies` shape; module header extended naming `DECL-03` and the negative rule (compose, never re-type; never execute a remedy string).
- `src/mcp/vice/tool-location.test.ts` — six new test cases: real-declaration proof, scratch-declaration non-vacuity proof, `acme` linux+universal ordering, the three empty-result cases, `c1541`'s non-ASCII em-dash byte fidelity, and compiled-artifact parity.
- `src/mcp/vice/prerequisites.test.ts` — two new named-exported validators (`assertRemedyBlockShape`, `assertRemedyIsProseNotArgv`) plus five companion tests, following the file's existing `assertNoStrayVersionFloor` idiom exactly (`grep -a` used throughout — this file carries a real NUL byte).
- `src/mcp/vice/resources/tool-location.mjs` — regenerated (host-bound build), `resources-sync.test.ts` green against it.

## Decisions Made

- RED phase used a stub `remedyTextsFor()` that always returns `[]`, rather than omitting the export entirely — an omitted export would make the test file fail to load at all (`ERR_MODULE_NOT_FOUND`/static-import SyntaxError under ESM), which classifies as `fixture_or_load_failure` (INVALID_RED, #3770), not a genuine assertion-level RED. The stub let the six new tests fail on their real assertions instead, verified `RED_EVIDENCE_OK` via `gsd_run check tdd-red-evidence`.
- `assertRemedyBlockShape` and `assertRemedyIsProseNotArgv` are two separate validators rather than one combined function, mirroring the plan's own two named exports — one polices the declaration's structural shape (object, closed platform-key set, entry fields, provenance), the other polices Phase 58 `D-09`'s never-auto-install constraint (no `args`/`cmd` key, no array-shaped `text`). Keeping them separate keeps each offender list about exactly one concern, matching every other validator pair in this file (e.g. `assertLocationBlockShape` vs. `assertKindAndMarker`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript intersection-type collision in two structural-gate test cases**
- **Found during:** Task 2 (writing `assertRemedyBlockShape`'s companion tests)
- **Issue:** Casting a `structuredClone`d document to `{ tools: Record<string, ToolRecord & { remedies?: unknown }> }` did not override `ToolRecord`'s own `remedies?: Record<string, RemedyEntry[]>` field — TypeScript intersects the two `remedies` property types rather than replacing one with the other, so `tsc --noEmit` rejected assigning a plain string or a non-array object to `.remedies`/`.remedies.universal` in two test cases (`prerequisites.test.ts(617,3)` and `(625,60)`).
- **Fix:** Dropped the `ToolRecord &` intersection from those two scratch-declaration casts, using a standalone `{ tools: Record<string, { remedies?: unknown }> }` shape instead — the mutation still exercises the real `assertRemedyBlockShape()` against the real `PrerequisitesDoc` cast, just without the conflicting intersected field type at the TypeScript level.
- **Files modified:** `src/mcp/vice/prerequisites.test.ts`
- **Verification:** `npm run typecheck` clean; `node --test prerequisites.test.ts` 42/42 pass.
- **Committed in:** `58342e21` (Task 2 commit — the fix landed before the task's own commit, so no separate commit exists)

---

**Total deviations:** 1 auto-fixed (1 blocking, TypeScript type-checking issue local to two test cases)
**Impact on plan:** No scope creep — a compile-time-only fix inside the new test file itself; no behavior, no declaration, no production code touched.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `remedyTextsFor()` is ready for plans 60-03 and 60-04 to call from every refusal site they rewire (dxa/ghidra/acme/x64sc/c1541/petcat refusals in `host-tool.mts`, `backend-detect.mts`, and any sibling).
- The `remedies` shape is now mechanically policed, so a future edit to `prerequisites.json` that breaks the shape `remedyTextsFor()` depends on (bad platform key, missing text, structured-argv field) fails `prerequisites.test.ts` immediately rather than surfacing as a silent wrong-refusal downstream.
- No blockers.

## Self-Check: PASSED

- `src/mcp/vice/tool-location.mts` — FOUND, contains `export function remedyTextsFor`
- `src/mcp/vice/tool-location.test.ts` — FOUND, contains the six new test names
- `src/mcp/vice/prerequisites.test.ts` — FOUND, contains `assertRemedyBlockShape` and `assertRemedyIsProseNotArgv`
- `src/mcp/vice/resources/tool-location.mjs` — FOUND, regenerated with current banner
- Commits `6cfb0e84`, `cd582dfa`, `58342e21` — all present in `git log --oneline`
- `node --test tool-location.test.ts prerequisites.test.ts resources-sync.test.ts` — 110/110 pass
- `npm run typecheck` — clean
- Remedy-string leak scan — `leaked_count=0`

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*
