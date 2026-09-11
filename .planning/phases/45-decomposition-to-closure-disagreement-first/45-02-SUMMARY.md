---
phase: 45-decomposition-to-closure-disagreement-first
plan: 02
subsystem: annotation-store
tags: [anno-store, json-export, round-trip, provenance, d-02, d-03]

requires:
  - phase: 45
    provides: "plan 45-01's real tracer.annostore (dxa+Ghidra-derived, live-executed) used to prove the round trip against real data"
provides:
  - "The general store JSON export/import module (D-02): exportStoreDocument()/importStoreDocument(), the one place a per-fixture store's whole state round-trips to a diffable JSON document"
  - "The row-level derived/authored provenance split on ranges and comments (D-03)"
  - "The three decline/disagreement/authored comment-text conventions (DECLINE_COMMENT_PREFIX, DISAGREEMENT_ACCEPTED_COMMENT_PREFIX, AUTHORED_PROVENANCE_COMMENT_PREFIX), declared once"
  - "STORE_EXPORT_SCHEMA_VERSION, checked first on import and refused by name when unrecognised"
affects: [45-06, 45-07, 45-08, 45-09, 45-10, 46]

actuals:
  tokens: 10400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Whole-document validate-then-write: importStoreDocument() builds a fully-validated in-memory write plan before the first set*/put*/insert* call, mirroring anno-import.ts's own rule"
    - "Provenance as a computed classification, never a persisted column: exported ranges are always \"derived\", exported comments are always \"authored\" (per D-03), so the round trip reproduces provenance for free with no schema change"
    - "Cross-row reference by portable name, not store-internal id: exported enumUsage rows carry enumName, never enumId, since ids are never portable across a fresh import target"

key-files:
  created:
    - src/mcp/vice/anno-store-export.ts
    - src/mcp/vice/anno-store-export.test.ts
    - .planning/phases/45-decomposition-to-closure-disagreement-first/45-02-SCHEMA-FREEZE.md
  modified: []

key-decisions:
  - "Exported rows omit the store's internal `id` (and enumUsage's `enumId`, replaced by `enumName`) -- a store-internal rowid is never portable across a fresh import target, and keeping it would make the round-trip test compare numbers that were never meant to agree."
  - "provenanceForComment() always answers \"authored\" today, including for a DECLINED: comment -- per D-03 and RESEARCH.md Section 5, and confirmed by Task 2's own Test 6. This corrects an imprecise parenthetical in the plan's own Task 1 checkpoint text (which said decline comments were \"derived\"); see 45-02-SCHEMA-FREEZE.md for the full record."
  - "Project-enum variants/description shape gets a NEW, narrower local validator (assertExportVariants/assertExportDescription) rather than reusing anno-store.ts's validatedVariants()/validatedDescription(), which are private to that module. createProjectEnum() still applies its own stricter validation at write time; a document that passes this module's pre-check but fails that stricter one is a disclosed, narrow residual gap."

requirements-completed: [DECOMP-01]

coverage:
  - id: D1
    description: "A per-fixture store exports to a versioned, stably-sorted JSON document and re-imports into a fresh, empty store reproducing every row class exactly, with a malformed document writing nothing."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 1: exportStoreDocument() on a store with one row of every class returns all seven arrays populated"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 2: exporting the same store twice returns byte-identical JSON"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 3: importStoreDocument() into a fresh empty store, then re-exporting, returns a document deep-equal to the original"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 4: a document whose LAST row is malformed leaves the target store with ZERO rows"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 5: a document carrying an unknown schemaVersion is refused by name"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every exported comment and range row carries an explicit provenance tag of derived or authored, distinguishing an authored purpose-comment change from a derived decline in a diff."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store-export.test.ts#Test 6: a comment whose text starts with DECLINED: round-trips with provenance 'authored'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The round trip is proven against a REAL dxa+Ghidra-derived store (dxa/tracer.prg, plan 45-01's own live-executed store: 2 typed ranges, 0 labels, 0 xrefs, 1994 real exec observations), not only a synthetic one -- gated on ANNO_STORE_EXPORT_LIVE_STORE, skipping with a named reason when absent."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "node --test anno-store-export.test.ts with ANNO_STORE_EXPORT_LIVE_STORE pointed at the real tracer.annostore plan 45-01 derived -- 8/8 tests pass, live tier included"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-02's one-way schema-freeze checkpoint (row-level provenance, three comment prefixes) is recorded as owner-confirmed, and the checkpoint's own imprecise decline-provenance framing is corrected against D-03/RESEARCH.md Section 5."
    requirement: null
    verification:
      - kind: other
        ref: ".planning/phases/45-decomposition-to-closure-disagreement-first/45-02-SCHEMA-FREEZE.md"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 2: The General Store JSON Export/Import Round Trip Summary

**`anno-store-export.ts` ships the first general per-fixture store JSON round trip (D-02), with row-level derived/authored provenance (D-03) and three `anno_set_comment`-riding decline/disagreement/authored conventions, proven both against a synthetic all-classes fixture and against the real, live-executed `tracer.annostore` plan 45-01 derived.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3 completed (1 checkpoint:decision, already owner-confirmed; 2 auto)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- `exportStoreDocument()`/`importStoreDocument()` (D-02): the ONE general
  JSON round trip for a per-fixture `.annostore` -- distinct from
  `anno_import_ghidra_export`, which is Ghidra-shaped and writes xrefs
  only. Seven row-class arrays (`ranges`, `labels`, `comments`,
  `projectEnums`, `enumUsage`, `xrefs`, `execObservations`), each stably
  sorted so two exports of the same store are byte-identical.
- Row-level `provenance: "derived" | "authored"` on every `ranges` and
  `comments` row (D-03), computed rather than persisted as a real store
  column -- no schema change, matching `must_haves.truths` item 4.
- The three comment-prefix constants (`DECLINE_COMMENT_PREFIX`,
  `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX`, `AUTHORED_PROVENANCE_COMMENT_PREFIX`),
  declared exactly once (`grep -ral 'DECLINED:' src/mcp/vice` lists only
  this module and its test).
- `STORE_EXPORT_SCHEMA_VERSION`, checked first on import; an unrecognised
  version is refused by name before any other validation runs.
- Import validates the WHOLE document into an in-memory write plan before
  the first mutating call (`anno-import.ts`'s own rule) -- a document
  malformed at its LAST row leaves the target store with zero rows,
  observed directly rather than asserted by code inspection (Test 4).
- The round trip is proven twice: once against a synthetic one-row-per-class
  fixture (Task 2, 7 tests), and once against the REAL `tracer.annostore`
  plan 45-01 derived through the genuine dxa+Ghidra spine and a real
  stock-VICE execution run (Task 3's live tier) -- 2 typed ranges, 0 labels,
  0 xrefs, 1994 real exec observations, exported/imported/re-exported
  byte-identically.

## Task Commits

1. **Task 1 (checkpoint:decision, owner-confirmed before dispatch)** -
   `a98e432c` (docs) -- the schema-freeze record, citing items 2 and 3's
   confirmation and correcting the checkpoint's own imprecise
   decline-provenance framing
2. **Task 2 (auto, tdd)** - `29121f3a` (feat) -- `anno-store-export.ts` and
   its six-test round-trip suite
3. **Task 3 (auto)** - `f8c2a589` (test) -- the live tier against a real
   derived store

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-store-export.ts` - the export/import module, schema
  types, provenance predicates, three comment-prefix constants
- `src/mcp/vice/anno-store-export.test.ts` - two-tier round-trip suite
  (7 pure-unit tests + 1 opt-in live test)
- `.planning/phases/45-decomposition-to-closure-disagreement-first/45-02-SCHEMA-FREEZE.md` -
  the owner's checkpoint verdict, recorded verbatim, plus the correction
  noted below

## Decisions Made

- Exported rows omit the store's internal `id` (and `enumUsage`'s
  `enumId`, replaced by the portable `enumName`) -- ids are never
  portable across a fresh import target, and the round-trip test would
  otherwise compare numbers that were never meant to agree.
- `provenanceForComment()` always answers `"authored"` today, including
  for a `DECLINED:` comment -- see Deviations below.
- Project-enum `variants`/`description` shape gets a new, narrower local
  validator rather than reusing `anno-store.ts`'s private
  `validatedVariants()`/`validatedDescription()`; `createProjectEnum()`
  still applies its own stricter validation at write time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the checkpoint's own decline-comment provenance classification**
- **Found during:** Task 2, while implementing `provenanceForComment()` against Test 6's own literal spec
- **Issue:** Task 1's checkpoint decision text (45-02-PLAN.md, item 2's
  justification) describes the comment table as mixing "authored purpose
  comments" with "**derived** decline comments." That is backwards from
  both `45-CONTEXT.md`'s own D-03 ("Names, purpose comments and recorded
  declines are **authored**, reviewed once, then frozen") and
  `45-RESEARCH.md` Section 5 ("labels/comments/(and ... decline-comments)
  are the **authored** half") -- and from Task 2's own executable Test 6,
  which requires a `DECLINED:` comment to round-trip with
  `provenance: "authored"`.
- **Fix:** Implemented `provenanceForComment()` to always return
  `"authored"` (matching D-03/RESEARCH.md and Test 6), not
  content-dependent on the decline prefix. The STRUCTURAL decision the
  checkpoint froze -- row-level, not table-level, provenance -- is
  unaffected; only the illustrative classification of which comment kind
  is "derived" was wrong. Documented in full in
  `45-02-SCHEMA-FREEZE.md`'s own correction section so the record does
  not silently contradict itself.
- **Files modified:** `src/mcp/vice/anno-store-export.ts` (header +
  `provenanceForComment()`), `.planning/phases/45-decomposition-to-closure-disagreement-first/45-02-SCHEMA-FREEZE.md`
- **Verification:** Test 6 passes; `grep` confirms D-03/RESEARCH.md's own
  wording
- **Commit:** `29121f3a` (code), `a98e432c` (record)

---

**Total deviations:** 1 auto-fixed (1 bug -- a plan-internal factual
inconsistency, resolved in favour of the authoritative CONTEXT.md/RESEARCH.md
decision record and the plan's own executable test).
**Impact on plan:** No scope change. The frozen schema shape (row classes,
sort order, schema version, the three comment prefixes) is exactly as the
owner confirmed; only one internal justification sentence was corrected.

## Issues Encountered

None beyond the deviation recorded above.

## Known Stubs

None. Both the synthetic round trip and the live round trip are backed by
real store data; no placeholder value or empty default stands in for
unimplemented behaviour.

## User Setup Required

None -- no external service configuration required. `dxa` and Ghidra were
already present on this host (per plan 45-01's own Wave 0 measurements) and
were only detected, never installed; the live tier's real store
(`.c64-re-tools/phase45-scratch/tracer.annostore`) already existed from
plan 45-01's own execution and needed no re-derivation.

## Next Phase Readiness

- `anno-store-export.ts` is ready for plans 45-06 through 45-10 to write
  their committed `.annostore.json` fixture artifacts through.
- Phase 46's `BUILD-05` has a designed consumer: the per-range
  `provenance` field, though Phase 46 will need its OWN research to
  confirm this export's shape meets its actual needs (45-RESEARCH.md's own
  Open Question 2 flagged this as unverified against not-yet-written
  Phase 46 research).
- No blockers. `pgrep -x x64sc` and `systemctl --user is-active vice-broker`
  were both confirmed clean before and after this plan's live-tier run.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
