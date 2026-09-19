---
phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts
plan: 01
subsystem: docs-generation
tags: [markdown-generation, drift-guard, prerequisites, readme, provenance]

# Dependency graph
requires:
  - phase: 58-one-declaration-four-places-that-can-no-longer-disagree
    provides: src/mcp/vice/prerequisites.json (the frozen declaration this plan reads), and docs/phase58-declaration-provenance.md's Citation ledger machinery this plan re-anchors
provides:
  - src/mcp/vice/prereq-readme-gen.ts: derives/renders/splices two generated regions in README.md from prerequisites.json
  - src/mcp/vice/prereq-readme-gen.test.ts: the record-comparison drift guard (GEN-02's first half)
  - README.md's generated VICE ecosystem table and eight-record prerequisite overview
  - a re-anchored citation ledger in docs/phase58-declaration-provenance.md
affects: [61-02, 61-03, any future phase touching prerequisites.json or README.md's install sections]

# Actuals (#2632)
actuals:
  tokens: 12116
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated-but-committed markdown, one artifact kind over from build.ts + resources-sync.test.ts's precedent"
    - "Shared-derivation guard (D-10): the guard imports the generator's own derive functions and only writes its own reader for what the committed file actually contains -- never a second implementation of expected content"
    - "Marker-delimited generated regions inside a hand-authored document, replacing a fully-owned file"

key-files:
  created:
    - src/mcp/vice/prereq-readme-gen.ts
    - src/mcp/vice/prereq-readme-gen.test.ts
  modified:
    - README.md
    - docs/phase58-declaration-provenance.md
    - src/mcp/vice/package.json
    - src/mcp/vice/prerequisites.test.ts

key-decisions:
  - "Ecosystem rows dedupe by (ecosystem, text) with a generated Platforms column (D-04), collapsing Homebrew's identical linux/darwin entries into one row"
  - "findRepoRoot() is a fourth plain .git-marker-walk copy, deliberately not repoRoot() from repo-root.ts, because that function's CLAUDE_PROJECT_DIR branch can name a different tree than the one being generated and guarded"
  - "Citation ledger re-anchored twice in this plan (once per commit that moved README lines): 96-97 stayed put through Task 1, 107->110 and 117-123->122-128 after Task 1's table splice, then 119-120/133/145-151 after Task 2's new section insertion shifted everything below it by +23 lines"

requirements-completed: [GEN-01, GEN-02]

coverage:
  - id: D1
    description: "README.md's VICE ecosystem table is generated from prerequisites.json, idempotent, and all three VICE-package tool ids (x64sc/c1541/petcat) derive identical rows"
    requirement: "GEN-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#the committed declaration/README pair audits clean"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#all three VICE_PACKAGE_TOOL_IDS derive identical ecosystem rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md's eight-record prerequisite overview is generated from prerequisites.json, one row per declared record in declaration key order"
    requirement: "GEN-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#the committed overview region audits clean"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#every declared record id has exactly one overview row, and every overview row id is a declared record"
        status: pass
    human_judgment: false
  - id: D3
    description: "auditGeneratedReadme() parses both sides into records and compares those -- never rendered bytes -- and a planted divergence is caught and named"
    requirement: "GEN-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: a planted divergence in a scratch copy is caught and the diverged ecosystem is named"
        status: pass
    human_judgment: false
  - id: D4
    description: "The citation ledger in docs/phase58-declaration-provenance.md is re-anchored in the same commit that moves a README.md line (D-08), and every README.md ledger entry resolves"
    human_judgment: true
    rationale: "phase58-citation-ledger.test.ts as a whole reports two pre-existing failures (.planning/REQUIREMENTS.md:86 and .planning/ROADMAP.md:2002-2005) plus, in its phase59 sibling test, three more (.planning/ROADMAP.md:1959/1939-1942/1947) -- all five drifted from the Phase 61 planning commits growing ROADMAP.md/REQUIREMENTS.md, none from this plan's changes, and none touching README.md. Every README.md citation was independently confirmed clean by isolating the failure list after each commit (see body), but the test FILE's own overall exit code is not usable as a standalone pass/fail proof for this specific deliverable, so it is routed for a human's confirmation of that reading rather than auto-passed."

# Metrics
duration: 55min
completed: 2026-09-19
status: complete
---

# Phase 61 Plan 01: The Install Tables Generated, and a Guard That Compares Facts Summary

**`prereq-readme-gen.ts` derives README.md's VICE ecosystem table and eight-record prerequisite overview from `prerequisites.json`, and its colocated `prereq-readme-gen.test.ts` proves the two never silently disagree.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-19T (see git log for first commit timestamp)
- **Completed:** 2026-09-19
- **Tasks:** 2 (both `tdd="true"`, both following RED/GREEN with no REFACTOR commit needed)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `src/mcp/vice/prereq-readme-gen.ts` is a new plain-`.ts` repo-tooling module (never compiled by `build.ts`, never in `package.json`'s `files[]`) exporting `deriveEcosystemRows`, `deriveOverviewRows`, `renderEcosystemTable`, `renderOverviewTable`, `spliceRegion`, `writeGeneratedRegions`, `readDeclarationFile`, and the constants both the generator and its guard share.
- README.md's ten hand-written install-table lines became a marker-delimited `vice-ecosystems` region (8 rows: `debian-trixie`, `debian-forky`, `ubuntu-2510`, `arch`, `fedora-rpmfusion`, `alpine-edge`, `homebrew`, `windows-official`) with the two version columns dropped and the ecosystem column now the raw declaration id, per D-02/D-03/D-04.
- A new "Prerequisites at a glance" section carries the `prerequisite-overview` region: 8 rows (one per declared record, in declaration key order), each naming its unblocked skills, unblocked MCP tools, one-line remedy, and location-override mechanism.
- `prereq-readme-gen.test.ts`'s `auditGeneratedReadme()` audits both regions by parsing the committed README back into records and comparing those against the generator's own derive functions (D-10) -- never rendered bytes -- and a `mkdtempSync`-scratch `GEN-03` case proves it catches and names a planted divergence.
- `npm --prefix src/mcp/vice run generate:readme` is idempotent: running it twice in a row leaves README.md byte-identical both times, verified after each task.
- The citation ledger in `docs/phase58-declaration-provenance.md` was re-anchored twice (once per commit that moved a README.md line), keeping every README.md-pointing ledger entry, body citation and frontmatter citation resolving against the live file.

## Task Commits

Each task followed RED (failing guard) -> GREEN (implementation + re-anchor), TDD-style, since both tasks carried `tdd="true"`:

1. **Task 1, RED** - `5a253404` (`test`): added `prereq-readme-gen.ts` + `prereq-readme-gen.test.ts`; the committed-pair audit and GEN-03 case both failed because README.md carried no `vice-ecosystems` markers yet.
2. **Task 1, GREEN** - `9145838e` (`feat`): spliced README.md's table into the marker region, ran the generator, added the `generate:readme` npm script, retired `prerequisites.test.ts`'s line-pinned case with a handover comment, and re-anchored 2 of the 3 README citations (96-97 unaffected).
3. **Task 2, RED** - `3bfa2e6a` (`test`): extended the generator with `deriveOverviewRows`/`renderOverviewTable` and a second owned region; extended the guard's `auditGeneratedReadme` to audit it; added the empty "Prerequisites at a glance" section skeleton to README.md. The committed-pair audit and a new overview-specific case both failed because the region carried no rows yet.
4. **Task 2, GREEN** - `d2241673` (`feat`): ran the generator to fill the overview region and re-anchored the citation ledger a second time (the new section shifted every line below it by +23).

No REFACTOR commit was needed for either task -- the GREEN implementation was already the intended shape.

## Files Created/Modified

- `src/mcp/vice/prereq-readme-gen.ts` - the generator: declaration reader, ecosystem/overview row derivation, table renderers, region splicer, CLI entry point.
- `src/mcp/vice/prereq-readme-gen.test.ts` - the drift guard: region parser, `auditGeneratedReadme`, and six test cases including the `GEN-03` planted-divergence fixture.
- `README.md` - the hand-written VICE install table replaced by a generated region; a new "Prerequisites at a glance" section with a second generated region inserted immediately before "## Installing VICE".
- `docs/phase58-declaration-provenance.md` - three README.md citation line-ranges re-anchored (twice, once per line-moving commit) in the ledger JSON, the document body, and the YAML frontmatter.
- `src/mcp/vice/package.json` - added the `generate:readme` script; `files[]` left untouched (the generator stays out of the published tarball, D-13).
- `src/mcp/vice/prerequisites.test.ts` - the line-pinned README-matching case removed, replaced with a comment naming `prereq-readme-gen.test.ts` as its successor; the neighbouring declaration-only ecosystem-order case is untouched.

## Decisions Made

- Followed the plan's D-10 shared-derivation discipline exactly: the guard imports `deriveEcosystemRows`/`deriveOverviewRows` from the generator rather than reimplementing row expectations.
- Followed the plan's explicit instruction to copy `findRepoRoot()` rather than use `repoRoot()` from `repo-root.ts`, for the reason recorded in both the generator's and the guard's own header comments (the `CLAUDE_PROJECT_DIR` branch can name the wrong tree under plugin/worktree semantics).
- No architectural deviations were needed; the plan's action text was followed as written for both tasks.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The `acme-lib` overview row's remedy text (`export ACME=<dir holding cbm/c64/vic.a>.`) contains an angle-bracketed placeholder that a markdown renderer will drop visually -- this is the plan's own **Flagged Assumption 2**, an already-documented authoring defect in the declaration text itself (not something this plan may fix under D-02/D-05), not a stub introduced by this plan.

## Issues Encountered

- The full `phase58-citation-ledger.test.ts` file carries two failing tests (five drifted `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md` anchors between them) that predate this plan and are explicitly out of scope per this plan's dispatch instructions -- they arose from the Phase 61 planning commits growing `ROADMAP.md`/`REQUIREMENTS.md`, not from any change in this plan. Verified after every commit that moved a README.md line: the failing SET stayed exactly these five `.planning/`-only anchors and never grew to include a README.md anchor. Confirmed both immediately after Task 1's line-move commit and again after Task 2's.
- No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GEN-01` is delivered: both README install regions are generated from `prerequisites.json`, with no hand-maintained table left beside either.
- `GEN-02`'s first half (the record-comparison guard) is delivered and non-vacuously proven (`GEN-03` case). The remaining half of `GEN-02` (if any additional guard integration is planned) and `GEN-03`'s broader scope, if the roadmap treats it as a separate deliverable, are for the next plan(s) in this phase to pick up.
- The declaration (`src/mcp/vice/prerequisites.json`) is confirmed byte-unchanged throughout (D-02) -- verified via `git status --porcelain` after every commit.
- No blockers for 61-02/61-03.

## Self-Check: PASSED

- FOUND: src/mcp/vice/prereq-readme-gen.ts
- FOUND: src/mcp/vice/prereq-readme-gen.test.ts
- FOUND commit: 5a253404 (test: RED, Task 1)
- FOUND commit: 9145838e (feat: GREEN, Task 1)
- FOUND commit: 3bfa2e6a (test: RED, Task 2)
- FOUND commit: d2241673 (feat: GREEN, Task 2)
- Re-ran all task acceptance criteria and plan-level `<verification>`: generator idempotent (twice, both tasks), `prereq-readme-gen.test.ts` 6/6 green, `prerequisites.test.ts` 41/41 green, `phase58-citation-ledger.test.ts` failing set unchanged from the 5 pre-existing `.planning/`-only anchors, `npm run typecheck` exit 0, `git status --porcelain` clean on both `prerequisites.json` copies, full `npm run test:automated` suite: 3880 tests, 3869 pass, 2 fail (both pre-existing, both `.planning/`-only) -- failing SET compared, not count, and unchanged from baseline.
