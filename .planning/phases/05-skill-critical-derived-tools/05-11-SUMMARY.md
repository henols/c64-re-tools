---
phase: 05-skill-critical-derived-tools
plan: 11
subsystem: mcp-derived-tools
tags: [stock-vice, symbol-store, path-containment, schema-conformance, security-fix]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "DERIV-04's symbol store (stock-symbols.ts, plan 05-02) and stock-address.ts's parseAddress()/setSymbolResolver() seam (plan 05-07-adjacent baseline)"
provides:
  - "vice_symbols_lookup's answer conforms to its own declared outputSchema for every accepted address form (query.address is always the parsed number)"
  - "vice_symbols_load reads, stats and reports exactly the canonical (realpath-resolved) path it containment-checked -- closing the check-then-use window"
  - "A schema-conformance assertion covering the address branch, driven by the shipped tools-manifest.stock.json, that cannot pass vacuously"
affects: [stock-symbols.ts, gap-closure verification for 05-VERIFICATION.md criterion 2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "query echoes the value a handler actually used (the parsed local), never the caller's raw argument -- kept consistent with vice_memory_read's own echoed-address convention"
    - "resolveLabelFilePath() returns the post-realpathSync canonical path: exactly one fully-resolved string crosses the containment-check boundary and is then stat'ed, read and reported"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-symbols.ts
    - .claude/mcp/vice/stock-symbols.test.ts

key-decisions:
  - "D-05-18 (from plan): echo the parsed address number, not the raw caller argument -- the schema declares one type and checkAgainstSchema() has no oneOf, so the parsed value is the only schema-conformant choice"
  - "D-05-19 (from plan): return `real` (post-realpathSync) from resolveLabelFilePath() rather than adopting an O_NOFOLLOW/fd-based rewrite -- this is a local developer-facing debug bridge, and the residual kernel-level TOCTOU window is accepted and recorded in the threat register (T-05-11-02), not engineered away"
  - "Deleted the write-only loadedPath module state (WR-11) rather than exposing it as a new answer field, since adding an answer key would require a tools-manifest.stock.json change this plan deliberately excludes"

patterns-established:
  - "Schema-conformance assertions for handler branches the shared conformance harness (stock-dispatch.test.ts) doesn't exercise belong in the handler's own test file, reading tools-manifest.stock.json directly with node:fs and calling checkAgainstSchema() -- mirrors assertAnswerConforms()'s shape without importing across test files"
  - "A schema-conformance assertion is paired with a non-vacuity control (deliberately corrupting the value and asserting the checker DOES fail) so the assertion cannot silently pass on a broken import or an unused schema"

requirements-completed: [DERIV-04]

# Metrics
duration: 20min
completed: 2026-08-17
---

# Phase 05 Plan 11: Close WR-01/WR-08 in stock-symbols.ts Summary

**Echoed the parsed numeric address (not the raw caller argument) in `vice_symbols_lookup`, and made `resolveLabelFilePath()` return the same canonical, containment-checked path it stats, reads and reports.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-17T20:04Z (worktree base reset)
- **Completed:** 2026-08-17T20:24Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `vice_symbols_lookup`'s address branch now echoes `query.address` as the parsed number (e.g. `53280`) for every accepted input form (`53280`, `"$d020"`, `"0xd020"`), closing the live-confirmed WR-01 schema-conformance violation.
- Added a real schema-conformance assertion for the address branch, driven by the shipped `tools-manifest.stock.json`'s own `outputSchema`, plus a non-vacuity control proving the checker actually fails when handed a corrupted (string) `query.address`.
- `resolveLabelFilePath()` now returns `real` (the `realpathSync`-resolved, containment-checked path) instead of `resolved` (the pre-canonicalisation string it previously returned), so `statSync`, `readFileSync` and the answer's `resolvedPath` all agree on one fully-resolved path -- closing the WR-08 check-then-use window.
- Added a canonical-path test (in-workspace symlink -> `resolvedPath` equals the target's realpath, never the symlink's own basename) and strengthened the existing symlink-escape refusal test to assert the resolved target is named in the refusal message and that no symbol table is installed after a refusal.
- Deleted the write-only `loadedPath` module state (WR-11): assigned on every load, cleared on reset, read nowhere in the codebase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Echo the parsed address in vice_symbols_lookup and schema-check the address branch** - `658da1f` (fix)
2. **Task 2: Stat, read and report the canonical containment-checked path in vice_symbols_load** - `0db3265` (fix)

**Plan metadata:** (this commit) `docs: complete 05-11 plan`

## Files Created/Modified
- `.claude/mcp/vice/stock-symbols.ts` - `handleSymbolsLookup`'s address branch echoes the parsed `address` local instead of `args.address`; `resolveLabelFilePath()` returns `real` instead of `resolved`; write-only `loadedPath` state deleted (declaration, assignment, reset-clear, header comment)
- `.claude/mcp/vice/stock-symbols.test.ts` - added: parsed-address-echo assertion across all three address forms, an in-file `checkAgainstSchema()` conformance assertion for the address branch against the real manifest with a non-vacuity control, an in-workspace-symlink canonical-path case, and a strengthened symlink-escape refusal case (names the resolved target, asserts no table installed)

## Decisions Made
- Followed the plan's D-05-18 and D-05-19 decisions exactly as written (see key-decisions above). No deviation from the plan's prescribed fix or its rejected alternatives.

## Deviations from Plan

None - plan executed exactly as written. One in-flight self-correction: the WR-11 removal comment for the deleted `loadedPath` field initially referenced the field by its literal identifier name in the surrounding prose, which the plan's own acceptance criterion (`grep -c 'loadedPath' stock-symbols.ts` outputs `0`) would have failed on a rerun; reworded the comment to describe the field without naming it literally, verified by re-running the grep before committing Task 2. Caught before commit, not requiring a follow-up fix commit.

## Issues Encountered
`npm run test:automated` reports 1 pre-existing failure (`repo-root.test.ts`'s "path agreement... the agreed path is not under .claude" case) that is a confirmed worktree-nesting artifact, already documented and dispositioned RESOLVED in `.planning/phases/05-skill-critical-derived-tools/deferred-items.md` (discovered independently by all five wave-1 plans; the orchestrator's post-merge gate on `main` reports 0 fail). Reproduced the same test passing cleanly when run from the main repo checkout (outside the worktree), confirming it is unrelated to this plan's changes. Not fixed here -- out of scope per the executor's scope-boundary rule (pre-existing, unrelated file, caused by the parallel-execution environment, not by this plan's edits).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both live-confirmed WR-01 and WR-08 defects in `stock-symbols.ts` are closed, with tests that cannot pass vacuously (schema check backed by a non-vacuity control; symlink-escape check names the resolved target and asserts no table installed).
- No manifest, dispatch, `files[]` or `STOCK_DERIVED_TOOLS` change was needed or made -- stock manifest stays 34 tools, `package.json` `files[]` stays 44, matching the plan's stated invariant.
- `05-VERIFICATION.md` criterion 2's WARNING (the live-confirmed `query.address` schema violation) is resolved; a re-run of the phase verification should now find no open finding against this file.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*
