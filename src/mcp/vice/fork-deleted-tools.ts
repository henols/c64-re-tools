// fork-deleted-tools.ts
//
// The single named source of truth for "deliberately deleted from the fork
// manifest, not stale." D-16 (`.planning/phases/03-direct-tools/03-05-SUMMARY.md`,
// commit `f5c171d`; reconciled in ROADMAP.md's Phase 15 planning note and Wave 1
// plan-listing line) deleted `vice_snapshot_list` from `tools-manifest.json`
// because nothing in the repo called it -- a documented single exception to
// BACK-02, not staleness.
//
// `fork-manifest-surface.test.ts`'s count/name assertions are what catch a
// regeneration that silently re-adds a name in this set. `fork-live.test.ts`'s
// live-surface diff imports this same constant so a deliberately-deleted name
// is never hand-typed a second time -- a second hand-typed list is how this
// kind of note goes stale.
//
// Deliberately a plain `.ts` module, never a `.test.ts` file: importing a
// `.test.ts` module for its exports would also re-run every top-level
// `node:test` `test(...)` call it registers as an import side effect,
// silently duplicating that file's test execution inside whatever file
// imports it.
export const DELIBERATELY_DELETED_FORK_TOOLS: readonly string[] = ["vice_snapshot_list"];
