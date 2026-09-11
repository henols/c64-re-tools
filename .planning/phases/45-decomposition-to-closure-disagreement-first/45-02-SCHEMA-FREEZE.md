# Phase 45 Plan 02, Task 1: D-02 Export Schema Freeze

**Checkpoint type:** `checkpoint:decision` (one-way, per 45-CONTEXT.md's own reversibility rating for D-02: "the export becomes a committed on-disk format every later phase's fixtures are written in; changing it later needs a migration of every committed fixture artifact.")

**Resolution:** answered by the owner before this executor was dispatched, per the orchestrator's `<checkpoint_already_answered>` briefing. Recorded here rather than re-asked, per that briefing's own instruction.

## Owner's verdict, as delivered

- **Item 2 (provenance granularity): CONFIRMED AS PROPOSED — row-level.** A `"provenance": "derived" | "authored"` field on every `ranges` and `comments` row. Table-level was explicitly presented and explicitly rejected, on the stated ground that it cannot express a comment table mixing authored purpose comments with derived decline comments (RESEARCH.md §5).
- **Item 3 (decline recording): CONFIRMED AS PROPOSED — three comment prefixes.** Ride the one existing `anno_set_comment` API with three exported constants: `DECLINE_COMMENT_PREFIX = "DECLINED:"`, `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX = "DISAGREEMENT-ACCEPTED:"`, `AUTHORED_PROVENANCE_COMMENT_PREFIX = "PROVENANCE: authored"`. A dedicated store table/column was explicitly presented and explicitly rejected, on the stated grounds that it is a schema change and a second convention the roadmap forbids.
- Items 1, 4 and 5 (row classes + stable sort order, `STORE_EXPORT_SCHEMA_VERSION` with refuse-by-name on an unknown version, and designing the provenance field for Phase 46's `BUILD-05`) were presented as proposed and are confirmed with them.

## As frozen and shipped in `anno-store-export.ts`

1. **Row classes, in file order:** `ranges`, `labels`, `comments`, `projectEnums`, `enumUsage`, `xrefs`, `execObservations` — each an array, each sorted by its own documented stable key, so two exports of the same store are byte-identical (proven by Task 2's Test 2, and separately by exporting the live tier's real store twice inside the same process).
2. **Provenance:** a per-row `provenance: "derived" | "authored"` field on every `ranges` and `comments` row, computed rather than persisted as a real store column — see `anno-store-export.ts`'s own header for why no schema change was needed.
3. **Three comment-prefix constants**, declared exactly once in `anno-store-export.ts` and nowhere else (`grep -ral 'DECLINED:' src/mcp/vice` lists only this module and its test).
4. **`STORE_EXPORT_SCHEMA_VERSION = 1`**, checked first on import; an unrecognised version is refused by name (Test 5) before any other validation runs.
5. **Forward consumer:** Phase 46's `BUILD-05` reads the per-range provenance markers this schema now carries.

## One correction to this checkpoint's own justification text, discovered during Task 2

This checkpoint's own item-2 justification (above, and in `45-02-PLAN.md`'s Task 1) describes the comment table as mixing "authored purpose comments" with "**derived** decline comments." That phrasing is imprecise and is **not** what Task 2 actually implements or tests, because it not what D-03/RESEARCH.md's own findings support (see `45-02-SUMMARY.md`'s Deviations section for the full reasoning). CONTEXT.md's D-03 states plainly: "Names, purpose comments and recorded declines are **authored**, reviewed once, then frozen." RESEARCH.md §5 restates it again: "labels/comments/(and ... decline-comments) are the **authored** half." Task 2's own executable Test 6 is unambiguous on the same point: a `DECLINED:` comment round-trips with `provenance: "authored"`.

The *structural* decision this checkpoint froze — row-level (not table-level) provenance, because a fixture's comment table mixes two *distinguishable* comment kinds — is unaffected and is exactly what shipped. Only the checkpoint's own illustrative classification of *which* comment kind is "derived" was backwards; `provenanceForComment()` therefore always answers `"authored"` for every comment today (declines included), per D-03, and is written as a function of the comment's own text only so a future comment-writing derivation path has one place to add a rule, not because one exists yet.
