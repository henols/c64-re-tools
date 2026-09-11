---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 04
subsystem: mcp-tool-surface
tags: [anno-tools, mcp, exclusion, provenance, tdd]

# Dependency graph
requires:
  - phase: 46
    provides: "plan 46-03's addExcludedRange/listExcludedRanges/removeExcludedRange store verbs and SCHEMA_VERSION 5's anno_excluded_range table"
provides:
  - "anno_exclude_range / anno_include_range on the MCP surface, registered at all four sites anno_add_scope/anno_remove_scope occupy"
  - "ANNO_VERB_REGISTER entries for both verbs, citing BUILD-05/BUILD-07 and real current consumers"
  - "src/skills/c64-provenance-diff/SKILL.md's documented round trip from a ledger verdict to a recorded, reversible exclusion"
affects: [46-05, 46-06]

# Actuals (#2632)
actuals:
  tokens: 15500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Exclusion setter/unsetter pair follows anno_add_scope/anno_remove_scope's exact four-site registration shape byte-for-byte: ANNO_TOOL_DEFINITIONS entry pair, one shared assertExcludedRangeArgs() validator reached by two assertVerbArgs() arms, one dispatchExcludedRange() write dispatch, one outer dispatch() gate clause"
    - "Surface-layer reason validation (absent/non-string/empty) via refuseArg() is an EARLIER gate on the store's own assertCommentText() check, not a second divergent rule -- both reject the same three malformed shapes, at different boundaries"
    - "Register entries cite consumers that are TRUE RIGHT NOW rather than the plan's suggested forward-reference to plan 46-05's not-yet-landed anno-export-asm.ts call site (see Deviations)"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/anno-register.ts
    - src/skills/c64-provenance-diff/SKILL.md

key-decisions:
  - "anno_exclude_range's second ANNO_VERB_REGISTER consumer cites anno-tools.ts's own anno_exclude_range dispatch rather than the plan-suggested anno-export-asm.ts:listExcludedRanges, because plan 46-05 (same wave, not yet executed in this tree) has not landed that call site -- citing it now would be a forward-dated citation the register's own header explicitly warns against (\"symbol is a citation, never a justification\")"
  - "Both new tool definitions positioned immediately after anno_add_scope/anno_remove_scope in ANNO_TOOL_DEFINITIONS, and both new register entries positioned immediately after anno_update_project_enum in ANNO_VERB_REGISTER, keeping the two span-shaped capability pairs adjacent for a reader"

requirements-completed: [BUILD-05, BUILD-07]

coverage:
  - id: D1
    description: "anno_exclude_range / anno_include_range live on the MCP surface through all four registration sites (ANNO_TOOL_DEFINITIONS, assertVerbArgs's shared assertExcludedRangeArgs validator reached by two arms, one dispatchExcludedRange write dispatch, one outer dispatch() gate clause), matching anno_add_scope/anno_remove_scope's exact shape"
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts (17 new tests covering both verbs' direct-route and batch-route behavior)"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#the twelve write and stored-read verbs are advertised (pre-existing, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every successful body reports store, both parsed addresses, revision, changed, and the full excludedRanges list unconditionally, including when empty; the setter's description carries the does-not-remove-anything reassurance"
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#anno_exclude_range's description states that recording an exclusion removes nothing"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_exclude_range records a span with its reason, reporting changed:true and excludedRanges of length 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both verbs are validated identically on the direct route and inside anno_batch_execute -- one shared validator, proven by a batch entry with a missing reason refusing the WHOLE batch and naming the offending index"
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#BATCH ROUTE (load-bearing): both anno_exclude_range and anno_include_range are validated inside anno_batch_execute by the SAME per-verb validator"
        status: pass
    human_judgment: false
  - id: D4
    description: "ANNO_VERB_REGISTER carries two new entries citing BUILD-05/BUILD-07 (both declared) and real current consumer paths, with the register's basis-integrity (DIRECTION 5) problem list byte-identical before and after -- no new line naming either verb"
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-register.test.ts (DIRECTION 2, 3, 4, 6 pass; DIRECTION 5's problem-list diff verified byte-identical against the pre-captured baseline)"
        status: pass
    human_judgment: false
  - id: D5
    description: "src/skills/c64-provenance-diff/SKILL.md documents the exclusion round trip in prose -- bare tool identifiers, nothing removed, no gap appears, ledger verdict is operator-read information never wired to an automatic exclusion -- with both skill gates green"
    requirement: "BUILD-05"
    verification:
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs (exit=0)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs (exit=0)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 04: The Exclusion Setter Pair on the MCP Surface Summary

**`anno_exclude_range` / `anno_include_range` land on the `anno_*` MCP surface as a symmetric, batch-validated pair, giving the user a route to record -- and reverse -- an explicit exclusion request without the tool ever answering whether one should exist.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-11T18:10:07+02:00
- **Completed:** 2026-09-11T18:36:00+02:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `anno_exclude_range` / `anno_include_range` registered at all four sites `anno_add_scope`/`anno_remove_scope` occupy: two `ANNO_TOOL_DEFINITIONS` entries, one shared `assertExcludedRangeArgs()` validator reached from `assertVerbArgs()` by two arms, one `dispatchExcludedRange()` write dispatch, one outer `dispatch()` gate clause naming both verbs
- Every successful body reports `store`, both parsed addresses, `revision`, `changed`, and the full current `excludedRanges` list unconditionally (including empty), matching `dispatchSetDataType()`'s own disclosure discipline; the setter's published description states plainly that recording an exclusion changes nothing about which bytes the export emits
- Two `ANNO_VERB_REGISTER` entries (`kind: "unclassified"`) citing `BUILD-05`/`BUILD-07` (both declared) and real, currently-true consumer paths, verified to add zero new lines to `DIRECTION 5`'s basis-integrity problem list (diffed byte-identical against a pre-change baseline capture)
- 17 new tests in `anno-tools.test.ts` covering every accept/refuse path on both the direct and `anno_batch_execute` routes, each refusal asserting message content AND post-state (a follow-up successful call's `excludedRanges` unchanged), plus the pinned does-not-remove-anything description sentence and both-manifests-absence checks
- `src/skills/c64-provenance-diff/SKILL.md` extended with the round-trip paragraph: the operator decides, `anno_exclude_range` records the span with the reason, `anno_include_range` reverses it, nothing is removed and no gap appears, and the ledger verdict is read-only information never wired to an automatic exclusion

## Task Commits

Each task was committed atomically:

1. **Task 1: `anno_exclude_range` / `anno_include_range` -- the four registration sites** - `81facada` (feat)
2. **Task 2: The register entries** - `372e5370` (docs)
3. **Task 3: Tool-surface tests and the skill route** - `940179a9` (test)

**Plan metadata:** committed as part of this same close-out step.

_Note: Task 1 is declared `tdd="true"` in the plan but its own `<files>` list is implementation-only (`anno-tools.ts`); the plan's own Task 1 behavior intro states "Task 3 collects them" -- the formal RED-observed-then-GREEN test artifact for these behaviors lands in Task 3's `anno-tools.test.ts` edit, which is also `tdd="true"`. Both tasks' acceptance criteria and the plan's own file-set split direct this structure; it is not a deviation from the plan._

## Files Created/Modified
- `src/mcp/vice/anno-tools.ts` - two `ANNO_TOOL_DEFINITIONS` entries, `assertExcludedRangeArgs()`, two `assertVerbArgs()` arms, `dispatchExcludedRange()`, one outer `dispatch()` gate clause; imports `addExcludedRange`/`listExcludedRanges`/`removeExcludedRange` from `anno-store.ts`
- `src/mcp/vice/anno-tools.test.ts` - 17-test group covering both verbs' direct-route and batch-route behavior, the pinned description sentence, and both-manifests absence
- `src/mcp/vice/anno-register.ts` - two new `ANNO_VERB_REGISTER` entries (`anno_exclude_range`, `anno_include_range`)
- `src/skills/c64-provenance-diff/SKILL.md` - round-trip paragraph naming both tools in prose, extending the section plan 46-01 Task 2 added

## Decisions Made
- Register consumer citation for `anno_exclude_range` deviates from the plan's suggested `anno-export-asm.ts:listExcludedRanges` -- see Deviations below
- Both new tool definitions and both new register entries positioned adjacent to their scope-verb analogs, for a reader finding the two span-shaped capability pairs together

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `anno_exclude_range`'s register entry cited a consumer symbol that does not yet exist in the tree**
- **Found during:** Task 2, while verifying the plan's suggested consumer citations against disk
- **Issue:** The plan's action text for Task 2 directs citing `{ path: "src/mcp/vice/anno-export-asm.ts", symbol: "listExcludedRanges" }` as `anno_exclude_range`'s second consumer. Plan 46-05 (same wave 3, `depends_on: [46-01, 46-03]`, not on 46-04) owns wiring `listExcludedRanges()` into the exporter and had not executed in this tree at the time this plan ran -- `grep -n "listExcludedRanges" anno-export-asm.ts` returned nothing. Citing it now would make the register state something false: a symbol appearing in a file it does not yet appear in. The register's own header states a citation "names what the consumer actually TAKES from the verb ... it is a CITATION, never a justification" -- a forward-dated citation violates that discipline even though the register's own DIRECTION 5 mechanical check (path-exists + symbol-non-empty) would not have caught it.
- **Fix:** Cited `{ path: "src/mcp/vice/anno-tools.ts", symbol: "anno_exclude_range" }` instead -- a real, currently-true consumer (this plan's own `dispatchExcludedRange()` calls `addExcludedRange`/`listExcludedRanges` directly), matching the exact citation style every sibling entry in this register already uses for its own tool-surface consumer (e.g. `anno_add_scope`'s entry cites `anno-tools.ts: anno_add_scope`).
- **Files modified:** `src/mcp/vice/anno-register.ts`
- **Verification:** `node --test anno-register.test.ts` -- DIRECTION 2/3/4/6 pass; DIRECTION 5's problem list diffed byte-identical against the pre-change baseline capture (no new line for either verb)
- **Committed in:** `372e5370`

---

**Total deviations:** 1 auto-fixed (Rule 1 -- a register citation corrected to name a consumer that actually exists right now, rather than one owned by a not-yet-executed sibling plan in the same wave)
**Impact:** The register entry's basis (requirement ids, rationale, note) is unchanged from the plan's text; only the second consumer's file/symbol pair was substituted for accuracy. No test assertion depended on the specific consumer cited.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`anno_exclude_range`/`anno_include_range` are live and tested; plan 46-05 can now wire `listExcludedRanges()` into `anno-export-asm.ts`'s block-construction loop to emit the visible exclusion marker BUILD-07 requires, and plan 46-06 can add its planted-control test against the real exporter. `BUILD-05` and `BUILD-07` stay "Pending" in `REQUIREMENTS.md` until those land, per the requirement being shared across plans in this phase.

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-tools.ts ]`, `[ -f src/mcp/vice/anno-tools.test.ts ]`, `[ -f src/mcp/vice/anno-register.ts ]`, `[ -f src/skills/c64-provenance-diff/SKILL.md ]` -- all present
- `git log --oneline --all --grep="46-04"` returns 3 commits (`81facada`, `372e5370`, `940179a9`)
- Plan-level `<verification>` re-run: `npm run typecheck` exit 0; `node --test anno-tools.test.ts anno-derivation.test.ts` -> 113 pass / 0 fail / 2 skipped; `node --test anno-register.test.ts` -> DIRECTION 2/3/4/6 pass, DIRECTION 5's problem list unchanged from the pre-change baseline (byte-diff verified); `node scripts/check-skill-tool-coverage.mjs` -> exit=0 (`CURATED_ANNO_TOOLS has 27 entries`, up from 25); `node scripts/check-skill-cli-invocations.mjs` -> exit=0; `grep -ac 'anno_exclude_range' src/skills/c64-provenance-diff/SKILL.md` -> 1
- `npm run test:automated` -> 4191 tests, 4173 pass, 4 fail, 9 skipped -- the failing NAME set is exactly the phase's documented baseline (`annoRegisterEntryFor` re: `anno_import_ghidra_export`/IMP-01, `DIRECTION 5`, `planted violation (negative control)`, `check-skill-fork-honesty`'s known concurrency race), confirmed by inspecting each failure's own assertion text; zero failures name `anno_exclude_range` or `anno_include_range`
- All Task 1/2/3 `<acceptance_criteria>` re-checked against the final tree: `ANNO_TOOL_DEFINITIONS` has exactly two new entries positioned after the scope pair; `CURATED_ANNO_TOOLS` derives both names via its existing `.map()` with no second hand-typed list; `required` arrays exactly match spec; exactly one `assertExcludedRangeArgs` and one `dispatchExcludedRange` exist; no new exported "should this be excluded" function or third tool name was added; both register entries are additions-only (`git diff` on `anno-register.ts` shows only insertions); skill file names both tools as bare identifiers with no `anno <verb>` invocation shape for either

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
