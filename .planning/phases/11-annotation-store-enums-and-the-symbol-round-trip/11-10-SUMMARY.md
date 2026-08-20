---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 10
subsystem: annotation-store
tags: [regenerator2000, mcp, markdown-generation, confidence-grading, drift-detection]

requires:
  - phase: 11-annotation-store-enums-and-the-symbol-round-trip
    provides: "r2000-tools.ts's curated runR2000Tool()/r2000_get_blocks/get_symbols/get_comments (plan 11-05); r2000-cli.ts's verb dispatch pattern (plans 11-01/11-06/11-08)"
provides:
  - "r2000-confidence.ts: the D-25 confidence-prefix convention (five grades, parser that throws on a typo, composer, search-query builder)"
  - "r2000-memmap-render.ts: the D-24/D-27 reconciliation -- store + validated provenance sidecar -> generated Markdown memory map, with a render digest and drift detection"
  - "vice-mcp r2000 render-memmap [--check] CLI verb"
affects: [c64-program-recon, criterion-1-evidence-transcript]

tech-stack:
  added: []
  patterns:
    - "Confidence grades as a machine-readable bracket-token prefix inside r2000 line comments, parsed by one module that throws on any near-miss rather than degrading to ungraded"
    - "Generated-view-over-canonical-store: a Markdown artifact carries a banner + render_digest and a --check verb that re-renders and byte-compares, catching both a hand edit and a store-side change"
    - "Run-scoped facts arrive as a validated JSON sidecar INPUT to a renderer, never as a hand-edited region of the renderer's OUTPUT"

key-files:
  created:
    - .claude/mcp/vice/r2000-confidence.ts
    - .claude/mcp/vice/r2000-confidence.test.ts
    - .claude/mcp/vice/r2000-memmap-render.ts
    - .claude/mcp/vice/r2000-memmap-render.test.ts
  modified:
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-cli.test.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "A confidence grade is always a full-string bracket token (e.g. [confirmed-code]) checked by exact match against the five canonical tokens -- ANY leading bracket token that is not an exact match throws, including near-misses that look almost right, rather than trying to fuzzy-correct or partially accept it."
  - "The render digest covers sorted query results (blocks/symbols/comments) plus the raw sidecar bytes plus a renderer version constant, so a store-side change (e.g. a comment's grade) registers as drift even when the rendered file on disk is untouched."
  - "checkRenderedMemoryMap() re-renders in full and does a line-by-line diff against disk rather than only comparing the digest line, so the first differing line is always nameable, not just 'the digest changed'."
  - "The renderer's layout is embedded in TypeScript, never read from the recon skill's template file at runtime (Phase 10 D-06) -- pinned by a zero-count grep test for the template filename."

patterns-established:
  - "D-25 confidence-prefix convention: [confirmed-code]/[probable-code]/[confirmed-data]/[probable-data]/[unknown], one vocabulary module, parse/format/search-query all routed through it."
  - "D-24/D-27 reconciliation: canonical store + validated sidecar -> generated Markdown, with a banner + digest + --check drift verb, mirroring resources-sync.test.ts's generate-then-byte-diff discipline for a Markdown target."

requirements-completed: [R2000-10]

duration: 35min
completed: 2026-08-21
---

# Phase 11 Plan 10: Confidence Grading and the Generated Memory Map Summary

**D-25's confidence-prefix convention (a bracket token that throws loudly on any typo) plus a store-canonical, sidecar-validated Markdown memory-map renderer with a render-digest drift guard and a `render-memmap [--check]` CLI verb.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `r2000-confidence.ts` gives the project ONE place for the five-grade vocabulary (`confirmed code`, `probable code`, `confirmed data`, `probable data`, `unknown`), a parser that throws `R2000ConfidenceGradeError` naming the offending token and all five valid ones on any near-miss (wrong case, underscore, plural, stray whitespace, plain typo), and a composer/search-query builder so no caller invents its own spelling.
- `r2000-memmap-render.ts` makes the store canonical (D-24) and the Markdown memory map a generated view: it queries `r2000_get_blocks`/`r2000_get_symbols`/`r2000_get_comments` through the curated `runR2000Tool()` seam, validates a JSON provenance sidecar (`parseProvenanceHeader()`, D-27's reconciliation — run-scoped facts are an INPUT to the renderer, never a hand-edited region of the output), and emits a banner carrying a `render_digest` over the sorted query results plus the sidecar bytes plus a renderer version constant.
- `checkRenderedMemoryMap()` re-renders and does a line-by-line comparison against the file on disk, returning `in-sync`/`drifted` (naming the first differing line)/`missing` — proven live to catch BOTH a one-character hand edit and a store-side confidence-grade change with the rendered file left untouched.
- `vice-mcp r2000 render-memmap <project> --provenance FILE [--out FILE] [--check]` makes generating and checking the memory map both one command, from any install route (no template-file resolution into the skills tree, per Phase 10's D-06 — pinned by a zero-count grep test).

## Task Commits

Each task was committed atomically:

1. **Task 1: r2000-confidence.ts — the grade convention, with a typo that fails loudly** - `d5dee34` (feat)
2. **Task 2: r2000-memmap-render.ts — store + validated sidecar → the generated memory map, with a render digest** - `eb0ba75` (feat)
3. **Task 3: the `render-memmap` verb, including `--check`** - `1f3c1de` (feat)

_No separate plan-metadata commit — this SUMMARY.md is the metadata commit, per worktree-mode isolation (STATE.md/ROADMAP.md are owned by the orchestrator after merge)._

## Files Created/Modified

- `.claude/mcp/vice/r2000-confidence.ts` - `CONFIDENCE_GRADES`, `parseConfidencePrefix()`, `formatConfidenceComment()`, `searchQueryForGrade()`, `R2000ConfidenceGradeError`
- `.claude/mcp/vice/r2000-confidence.test.ts` - 15 tests: round trip, six typo shapes must-throw, ungraded-is-legal, non-vacuity vocabulary control
- `.claude/mcp/vice/r2000-memmap-render.ts` - `ProvenanceHeader`, `parseProvenanceHeader()`, `renderMemoryMap()`, `checkRenderedMemoryMap()`, `RENDERER_VERSION`
- `.claude/mcp/vice/r2000-memmap-render.test.ts` - 12 tests: sidecar validation (unit), golden-output render plus drift detection (gated, live regenerator2000)
- `.claude/mcp/vice/r2000-cli.ts` - added the `render-memmap` verb (`cmdRenderMemmap()`, `parseRenderMemmapArgs()`), USAGE text
- `.claude/mcp/vice/r2000-cli.test.ts` - added 9 tests for the new verb (always-run refusals plus one gated happy-path/--check test)
- `.claude/mcp/vice/package.json` - added `r2000-confidence.ts` and `r2000-memmap-render.ts` to `files[]`

## Decisions Made

- **Any leading bracket token that is not an exact match to one of the five canonical tokens throws.** No fuzzy correction, no partial acceptance — this is the entire point of D-25 (a typo must never silently become an ungraded comment, since that is exactly how an `[unknown]` row could disappear from the "still unknown" query).
- **The render digest covers the store's query results, not only the rendered file's bytes.** Live-proven: changing a comment's confidence grade in the store (with the rendered `.md` file left byte-for-byte untouched) still makes `checkRenderedMemoryMap()` report `drifted`, because a fresh render's digest line — and its Confidence column and Open questions section — differ from what's on disk.
- **`checkRenderedMemoryMap()` does a full re-render plus line-by-line diff, not a digest-only comparison.** This makes "the first differing line" always nameable (a real acceptance criterion), and it is what lets both a hand edit and a store change be detected by the SAME mechanism.
- **The renderer's Markdown layout is hardcoded in TypeScript, never read from `.claude/skills/c64-program-recon/templates/memory-map.template.md` at runtime.** Phase 10's D-06: that template only exists as a file on disk under the Claude Code plugin route, and both npm-installer routes launch via `npx` — a runtime path resolution into the skills tree would silently fail for those users. Pinned by a zero-count-grep test for the template's own filename.
- **Query field names for `r2000_get_blocks`/`r2000_get_symbols`/`r2000_get_comments` were measured live** (`start_address`/`end_address`/`type` for blocks; `address`/`name`/`kind`/`type` for symbols; `address`/`comment`/`type` for comments) against a real `regenerator2000 0.9.20 --mcp-server-stdio` child on a tiny synthesized 5-byte program, rather than assumed from documentation — consistent with this project's measure-then-decide posture.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` and `<acceptance_criteria>` were implemented as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None. The one existing test-suite failure observed during full-suite verification (`repo-root.test.ts`'s "path agreement... is not under .claude" assertion) is the documented pre-existing worktree-only artifact noted in this plan's own dispatch context — it fails only because this execution ran inside a git worktree under `.claude/worktrees/`, passes on the main tree, and is unrelated to any change in this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `r2000-confidence.ts` and `r2000-memmap-render.ts` are ready for consumption by whichever later plan produces criterion 1's recorded two-session transcript (D-26) and by plan 11-12 (the recon template's own prose pointing at this generator, per this plan's objective).
- `render-memmap`'s provenance sidecar schema (`ProvenanceHeader`) is the concrete shape a future producer (`c64-ram-capture`'s digest verb, `c64-program-recon`'s `derive.mjs`) would need to fill by hand today; no automated sidecar producer exists yet, and none was in this plan's scope.
- No blockers. `evidence/criterion1/**` was not touched by this plan (verified: `git status` shows no changes under that path), preserving 11-09's sealed answer.

## Verification Evidence

- `cd .claude/mcp/vice && node --test r2000-confidence.test.ts` — 15/15 pass.
- `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 node --test r2000-memmap-render.test.ts` — 12/12 pass (live regenerator2000 0.9.20 at `~/.cargo/bin/regenerator2000`).
- `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` — 43/43 pass.
- `cd .claude/mcp/vice && npm run typecheck` — clean, both before and after adding the two new files.
- `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 npm run test:automated` — 1928/1934 pass, 1 pre-existing worktree-only failure (`repo-root.test.ts`, documented above and in this plan's dispatch context), 5 todo (unrelated, requires a real emulator).
- `node scripts/check-npm-packages.mjs` — OK, `@henols/vice-mcp` 72 files (both new modules present in `files[]`), `@henols/c64-re-tools` 35 files/6 skills.
- Drift-detection transcripts (both sources), captured live against a real regenerator2000 child on a 5-byte `lda #$1b / sta $d011` program at `$0810`:
  - **Hand-edit drift:** corrupting `init_screen` to `init_screeX` in the rendered file made `checkRenderedMemoryMap()` return `{status:"drifted", line:54, expected:"| $0810 | init_screen | ...", actual:"| $0810 | init_screeX | ..."}`.
  - **Store-change drift:** re-grading the same address's comment from `[confirmed-code]` to `[probable-code]` in the store, with the rendered file left byte-for-byte untouched, made `checkRenderedMemoryMap()` return `{status:"drifted", line:5, ...}` — the `render_digest` banner line itself was the first difference, proving the digest covers the store and not merely the file on disk.

## Self-Check

- FOUND: `.claude/mcp/vice/r2000-confidence.ts`
- FOUND: `.claude/mcp/vice/r2000-confidence.test.ts`
- FOUND: `.claude/mcp/vice/r2000-memmap-render.ts`
- FOUND: `.claude/mcp/vice/r2000-memmap-render.test.ts`
- FOUND: commit `d5dee34` (Task 1)
- FOUND: commit `eb0ba75` (Task 2)
- FOUND: commit `1f3c1de` (Task 3)

## Self-Check: PASSED

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Plan: 10*
*Completed: 2026-08-21*
