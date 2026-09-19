---
phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts
plan: 03
subsystem: docs-generation
tags: [markdown-generation, drift-guard, prerequisites, readme, provenance, citation-ledger]

# Dependency graph
requires:
  - phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts (plan 01)
    provides: the generated `vice-ecosystems`/`prerequisite-overview` regions in README.md, the generator/guard pair, and the citation ledger's first two re-anchorings
provides:
  - "README.md's three prose passages that cited the dropped VICE version columns, rewritten to state only what survives generation (GEN-01's non-generated-neighbour half)"
  - "the citation ledger in docs/phase58-declaration-provenance.md re-anchored a third time (README.md:145-151 -> 146-152) in the same commit that moved the lines (D-08)"
  - "three new sections in docs/phase58-declaration-provenance.md: the 27 circular source citations (D-09), the acme-lib remedy's known rendering defect, and the four-step regeneration procedure (ENGINEERING_RULES.md §11)"
affects: [any future phase touching prerequisites.json, README.md's install sections, or docs/phase58-declaration-provenance.md]

# Actuals (#2632)
actuals:
  tokens: 2378
  tasks: 2
  commits: 3
  plan_head_before: d486488cc00801e67cf0082dd793b74ef4d036fe

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prose-without-a-line-pin, deliberately: the new circular-citations section describes the 27 stale README-line `source` values without embedding a literal `README.md:NNN` token, because the citation-ledger's extraction regex treats ANY such token as a fresh citation requiring a live-resolving ledger entry -- which a historical, pre-generation line number cannot satisfy."
    - "Anchor-preservation-over-re-anchoring: two of the three D-07 passages kept their ledger-anchor sentence unmoved and untouched, reducing the edit to \"the surrounding prose changed, the anchor didn't\" rather than a full re-anchor; only the one passage whose rewrite grew by a line needed its range updated."

key-files:
  modified:
    - README.md
    - docs/phase58-declaration-provenance.md

key-decisions:
  - "Followed the plan's STRONGLY PREFERRED path for the D-07 lead-in rewrite: kept 'Checked live against each ecosystem on 2026-08-18.' byte-identical and unmoved, so the README.md:119-120 ledger entry needed no change at all -- only the second sentence (introducing the dropped version-floor framing) was rewritten to introduce what survives: ecosystem id, platforms, install command."
  - "The Windows-guidance rewrite (D-07's second passage) grew from two lines to three, shifting every following line down by one -- re-anchored the one ledger entry this affected (README.md:145-151 -> 146-152) in the same commit, updating it identically in the ledger JSON, the document body, and both YAML frontmatter fields (location, amended_at)."
  - "Left Case one's historical blockquote (quoting the pre-rewrite README lead-in verbatim) untouched. The document already establishes this exact convention in its own frontmatter -- 'location' tracks where a passage lives NOW while 'original' preserves what it said THEN -- so a citation range moving to follow a rewritten passage, while the historical quote stays as written, is the document's own established pattern, not a new judgment call."
  - "Task 2's three new sections state the 27 stale README-line numbers, the ENGINEERING_RULES.md section number, and every command/script name in prose with no `file.ext:line` citation, after discovering mid-draft that writing 'README.md:101' as a literal token gets picked up by the ledger's own extraction regex as a new citation requiring a live-resolving anchor -- which a number describing the OLD, pre-generation README cannot satisfy. Reworded to 'a README line number in the low hundreds' before any commit; caught and fixed during drafting, never shipped in the failing form."

requirements-completed: [GEN-01]

coverage:
  - id: D1
    description: "The three README.md prose passages that cited the dropped VICE version columns (the table lead-in, the Windows guidance, and the version-compatibility subsection's table attribution) no longer name a column that doesn't exist, and the citation ledger is re-anchored in the same commit"
    requirement: "GEN-01"
    human_judgment: true
    rationale: "The isolating checks (no 'named in the table above', no 'zips above', the anchor sentence still present, generate:readme leaves README.md byte-unchanged, prerequisites.json untouched) all passed and are recorded in the body below. But src/mcp/vice/phase58-citation-ledger.test.ts as a whole still reports its own exit code as failing -- for five .planning/-only anchors documented as pre-existing in both 61-01's and 61-02's SUMMARYs (.planning/REQUIREMENTS.md:86, .planning/ROADMAP.md:2002-2005/1959/1939-1942/1947), none touching README.md, none new. The failing SET was verified identical to the documented baseline after each commit, but the test file's own exit code is not usable as a standalone proof of this specific deliverable, so it is routed for a human's confirmation of that reading rather than auto-passed -- matching 61-01's own D4 precedent for the same test file."
  - id: D2
    description: "Three new level-2 sections in docs/phase58-declaration-provenance.md record the 27 circular source citations (D-09), the acme-lib remedy's known rendering defect, and the four-step regeneration procedure (ENGINEERING_RULES.md §11), all positioned before the Citation ledger, which stays the document's final section"
    requirement: "GEN-01"
    verification:
      - kind: other
        ref: "grep -ac '^## ' docs/phase58-declaration-provenance.md (12 level-2 headings, up from 9) and tail from the Citation ledger heading showing it is the only '## ' heading from that point on"
        status: pass
      - kind: other
        ref: "grep -ac 'acme-lib' and grep -ac 'generate:readme' against docs/phase58-declaration-provenance.md, both non-zero"
        status: pass
      - kind: other
        ref: "git status --porcelain -- src/mcp/vice/prerequisites.json src/mcp/vice/resources/prerequisites.json (empty) and git diff --quiet HEAD -- README.md (unchanged by this task)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-19
status: complete
---

# Phase 61 Plan 03: The Install Tables Generated, and a Guard That Compares Facts Summary

**Rewrote the three README.md passages the dropped VICE version columns left false, and recorded in `docs/phase58-declaration-provenance.md` why 27 declaration citations are now historical, why one remedy string renders wrong, and how to regenerate the tables safely.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-19 (session start; first commit 2026-09-19T08:02:54Z)
- **Completed:** 2026-09-19T08:07:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- The "Which VICE you get, per package manager" lead-in no longer frames a VICE version floor as load-bearing before the table -- it now introduces only what the generated table carries: an ecosystem id, the platforms it covers, and the install command. The lead-in's dating sentence ("Checked live against each ecosystem on 2026-08-18.") was kept byte-identical, so its citation-ledger anchor needed no change.
- The Windows package-availability sentence no longer names a specific SourceForge version number the table no longer carries -- it now points at "the official download named in the table's `windows-official` row above, or a source build."
- The "VICE version compatibility" subsection's 3.10-floor sentence no longer attributes the floor to "the table above" (a claim that went outright false the moment the version column was dropped) -- it states the floor as a fact about the `CPUHISTORY_GET` opcode on its own terms, still citing `.planning/REQUIREMENTS.md` for the measured claim. The subsection's opening sentence ("No shipped tool in this project refuses on a VICE version.") is byte-unchanged, preserving its own ledger anchor.
- The citation ledger's one affected entry (`README.md:145-151`, whose range moved because the Windows-guidance rewrite gained a line) was re-anchored to `README.md:146-152` identically in the ledger JSON block, the document body ("Case one" and the "second task" reference), and both YAML frontmatter fields (`location`, `amended_at`) -- four occurrences, one `sed` pass, verified with `node --test phase58-citation-ledger.test.ts` afterward.
- `docs/phase58-declaration-provenance.md` gained three new level-2 sections, all before the Citation ledger (which stays the document's final section): "The 27 circular citations" (D-09 -- every `x64sc`/`c1541`/`petcat` remedy's `source` field naming a README line now cites the generator's own output; nothing audits this today; both rejected alternatives named; the declaration stays frozen per D-02), "The `acme-lib` remedy's placeholder does not render" (the `remedies.universal[0].text` field's `<dir holding cbm/c64/vic.a>` placeholder is dropped by markdown renderers as an unrecognized HTML tag; both repairs foreclosed here; handed to a future phase by record and field name), and "Regenerating README.md's install tables" (ENGINEERING_RULES.md §11's four steps mapped onto `prerequisites.json` / `generate:readme` / `prereq-readme-gen.test.ts` / the two marker regions, plus the citation-ledger re-anchoring consequence).
- `npm --prefix src/mcp/vice run generate:readme` run after every commit leaves `README.md` byte-identical (verified via `git diff --quiet`), proving no hand edit strayed inside a marker-delimited generated region.
- `src/mcp/vice/prerequisites.json` and `src/mcp/vice/resources/prerequisites.json` are confirmed byte-unchanged throughout (D-02), verified via `git status --porcelain` after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the three passages the dropped version columns leave false** - `60de655b` (docs)
2. **Task 2: Record what generation changed about provenance** - `86b4b9d9` (docs)

**Plan metadata:** committed separately below.

## Files Created/Modified

- `README.md` - three prose passages rewritten (the "Which VICE you get" lead-in, the Windows-guidance sentence, the "VICE version compatibility" 3.10-floor sentence); no generated region touched.
- `docs/phase58-declaration-provenance.md` - the `README.md:145-151` citation re-anchored to `146-152` in four places (ledger JSON, body x2, frontmatter x2 fields); three new level-2 sections added before the Citation ledger.

## Decisions Made

- Kept both the `README.md:119-120` and `README.md:133` ledger anchors unmoved by keeping their anchor sentences intact, per the plan's STRONGLY PREFERRED path -- only `README.md:145-151` (now `146-152`) needed re-anchoring, from the Windows-guidance rewrite gaining one line.
- Wrote the new provenance sections' description of the 27 stale README-line `source` values in prose with no literal `README.md:NNN` token, after discovering mid-draft that such a token is picked up by the ledger's own citation-extraction regex as a fresh citation requiring a live-resolving anchor -- which a number describing the pre-generation README cannot satisfy. Reworded before any commit; the failing form was never shipped.
- Left "Case one"'s historical blockquote (quoting the pre-rewrite README lead-in verbatim, including the sentence Task 1 just rewrote) untouched. This matches the document's own established convention, visible in its own frontmatter split between `location` (tracks where a passage lives now) and `original` (preserves what it said then) -- a citation range following a rewritten passage while the historical quote stays as written is the document's own pattern, not a new judgment call introduced here.

## Deviations from Plan

None - plan executed exactly as written. The mid-draft citation-regex discovery (see Decisions Made) was caught and corrected before any commit, never shipped in a failing form, so it is not tracked as a deviation.

## Known Stubs

None new. The `acme-lib` remedy's rendering defect (documented as Known Stubs by 61-01's SUMMARY and now given a named home in `docs/phase58-declaration-provenance.md`'s new second section) remains an accepted, out-of-scope defect per D-02/D-05 -- not something this plan introduces or may fix.

## Issues Encountered

- The full `phase58-citation-ledger.test.ts` file still carries the same two failing tests (five drifted `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md` anchors between them) documented as pre-existing in 61-01's and 61-02's SUMMARYs. Re-verified after both task commits and again after a final `generate:readme` regeneration: the failing SET is byte-identical to the documented baseline -- `.planning/REQUIREMENTS.md:86`, `.planning/ROADMAP.md:2002-2005`, `.planning/ROADMAP.md:1959`, `.planning/ROADMAP.md:1939-1942`, `.planning/ROADMAP.md:1947` -- all five `.planning/`-only, none touching README.md, none new. Full `npm --prefix src/mcp/vice test`: 21 suites, 3968 pass, 2 fail (same two files, same five anchors), 81 skipped (`MANUAL_ONLY_TESTS`, expected), 0 cancelled/todo. `npm --prefix src/mcp/vice run typecheck`: exit 0. The failing SET was compared, not the count, per this plan's own stated obligation.
- No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GEN-01` is now delivered in full across all three plans: both README install regions are generated from `prerequisites.json` (61-01), the guard proves non-vacuous on five planted divergences and tolerates reflow (61-02), and no hand-maintained prose is left standing beside the generated section describing a column that no longer exists (61-03).
- The citation ledger is true against the final README: every README.md citation (`119-120`, `133`, `146-152`) resolves, and the failing set is exactly the five documented pre-existing `.planning/`-only anchors.
- The circularity, the known rendering defect, and the regeneration procedure are all written down in `docs/phase58-declaration-provenance.md` where a maintainer will find them (D-09, ENGINEERING_RULES.md §11).
- This is the last plan in Phase 61 (3/3). No blockers for phase closure; the pre-existing five-anchor citation-ledger gap remains a phase-level item for a separate gap-closure plan, as recorded by the orchestrator before this plan's dispatch.

## Self-Check: PASSED

- FOUND: README.md (three passages rewritten, verified via git diff)
- FOUND: docs/phase58-declaration-provenance.md (three new sections + re-anchored citation)
- FOUND commit: 60de655b (docs: Task 1)
- FOUND commit: 86b4b9d9 (docs: Task 2)
- Re-ran all task acceptance criteria and the plan-level `<verification>`: negative greps (`named in the table above`, `zips above`) both 0; ledger-anchor sentence present; `generate:readme` leaves README.md byte-unchanged (sha256 identical before/after a second run); `git status --porcelain` clean on both `prerequisites.json` copies; `npm run typecheck` exit 0; full `npm --prefix src/mcp/vice test`: 3968/2/81/0 (pass/fail/skipped/cancelled) -- the 2 failing tests carry exactly the 5 documented pre-existing `.planning/`-only anchors, verified by name, not by count.
