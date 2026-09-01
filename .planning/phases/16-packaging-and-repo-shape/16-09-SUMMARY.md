---
phase: 16-packaging-and-repo-shape
plan: 09
subsystem: testing
tags: [comment-hygiene, structural-guard, node-test, repo-root, path-references]

# Dependency graph
requires:
  - phase: 16-packaging-and-repo-shape
    provides: the relocated src/mcp/vice tree (plan 16-04), comment-phase-pointers.test.ts's extractor/scan-set/fixture conventions (plan 16-07's PKG-03 phase-pointer half) this plan's guard follows
provides:
  - hop-chain-comments.test.ts, a committed structural guard against comments that splice a current path-chain starting segment onto pre-relocation intermediate segments
  - the two corrected repo-root hop-chain comments in anno-symbol-roundtrip.test.ts (16-REVIEW.md WR-02)
  - behaviour-neutral renamed scratch trees in anno-regbits.test.ts and a corrected .gitignore comment naming the source sync-skills.mjs actually reads
affects: [16-10, 16-11]

# Actuals (#2632)
actuals:
  tokens: 5521
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment-scoped structural guard (per-line matching, not per-span) calibrated against the real corpus and pinned with a committed positive fixture -- the same shape comment-phase-pointers.test.ts established for phase-number pointers, now applied to path-reference chains"
    - "Non-vacuity floors as their own named tests (file-count floor, chain-line-count floor, in-tree negative control, fixture positive/negative controls) rather than one combined assertion"

key-files:
  created:
    - src/mcp/vice/hop-chain-comments.test.ts
    - src/mcp/vice/fixtures/planted-hop-chain-fixture.ts.txt
  modified:
    - src/mcp/vice/anno-symbol-roundtrip.test.ts
    - src/mcp/vice/anno-regbits.test.ts
    - .gitignore

key-decisions:
  - "The detector's three-part rule (chain arrow + repo-root phrase + pre-relocation-root segment, all on ONE physical line) is frozen as two module-level constants (CHAIN_ARROW/REPO_ROOT_PHRASE, PRE_RELOCATION_ROOT_SEGMENT) so per-line matching -- not per-span -- is what keeps repo-root.test.ts's deliberate pre-move-shape narration green without an exemption, exactly mirroring comment-phase-pointers.test.ts's own established discipline."
  - "extractCommentSpans/buildLineIndex/lineNumberFor copied verbatim from comment-phase-pointers.test.ts rather than imported, per this codebase's 'each guard test owns its own scan end-to-end' convention (that file's own header records the same decision for the same helpers)."
  - "Scan set is readdirSync(HERE)-derived over every *.ts/*.mts file, not package.json's files[] -- both real violations from 16-REVIEW.md's WR-02 finding live in test files that are deliberately unshipped."
  - "This SUMMARY deliberately avoids spelling out the OTHER open 16-REVIEW.md finding's exact id token anywhere in this file (see the Guard Status section below) -- docs-review-disposition.test.ts's disposition check is a bare-word presence scan with no context awareness, so writing that other finding's literal id here (even to explain it is out of scope) would falsely close it. That finding stays out of scope for this plan by design; plan 16-10 owns closing it."

requirements-completed: [PKG-03]

coverage:
  - id: D1
    description: "hop-chain-comments.test.ts fails on a half-swept repo-root chain comment, demonstrated RED against the two real WR-02 violations before being fixed, and stays pinned by a committed fixture"
    requirement: PKG-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/hop-chain-comments.test.ts (7 tests, all pass post-fix; RED capture recorded below)"
        status: pass
      - kind: other
        ref: "RED-then-GREEN demonstration against the real tree (this SUMMARY, Non-Vacuity section)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both real WR-02 violations in anno-symbol-roundtrip.test.ts corrected to name only real ancestors of the module directory, with the in-tree negative control (absorbed-answer-key.test.ts:34) and the deliberate pre-move-shape test (repo-root.test.ts) both staying green with no exemption"
    requirement: PKG-03
    verification:
      - kind: unit
        ref: "node --test hop-chain-comments.test.ts anno-symbol-roundtrip.test.ts absorbed-answer-key.test.ts repo-root.test.ts (38 tests, 0 fail)"
        status: pass
      - kind: other
        ref: "git diff --quiet -- src/mcp/vice/repo-root.test.ts (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno-regbits.test.ts's two synthetic scratch trees renamed to the current src/mcp/vice shape at unchanged depth, proven behaviour-neutral by the drift guard's own unequal digests; .gitignore's comment corrected to name src/skills/"
    requirement: PKG-03
    verification:
      - kind: unit
        ref: "node --test anno-regbits.test.ts (20 tests, 0 fail; two unequal digest diagnostics recorded below)"
        status: pass
      - kind: other
        ref: "git check-ignore -q installer/skills (exit 0); git diff -U0 .gitignore shows only comment lines added"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 09: Repo-root hop-chain comment guard (16-REVIEW.md WR-02) plus behaviour-neutral scratch-tree/gitignore renames Summary

**Built `hop-chain-comments.test.ts` -- a committed, fixture-pinned guard against comments that splice a current path-chain starting segment onto pre-relocation intermediate segments -- demonstrated it RED against both real `anno-symbol-roundtrip.test.ts` violations (16-REVIEW.md's WR-02 finding), fixed them, then renamed two synthetic scratch trees in `anno-regbits.test.ts` and corrected a stale `.gitignore` comment, all three previously self-contradictory about the same phase 16-04 relocation.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `hop-chain-comments.test.ts` scans every `*.ts`/`*.mts` file in `src/mcp/vice` (`readdirSync(HERE)`-derived, not `package.json`'s `files[]`) for a comment line carrying a chain arrow, the phrase "repo root", and the frozen pre-relocation-root segment `.claude` all on one physical line -- exactly the shape WR-02 described.
- Calibrated against the real corpus (measured, not assumed): exactly three comment lines in the whole module directory carry both a chain arrow and the "repo root" phrase; one (`absorbed-answer-key.test.ts:34`) is a legitimate in-tree negative control asserted seen-but-not-flagged; the other two (`anno-symbol-roundtrip.test.ts:55` and `:467`) are WR-02's violations.
- Non-vacuity is asserted, not assumed: a >=50-file scan floor, a >=3-chain-line corpus floor, the real in-tree negative control, and a committed positive fixture (`fixtures/planted-hop-chain-fixture.ts.txt`, `.txt` extension so the scan can never pick it up) that keeps the detector's teeth asserted on every run.
- The guard was demonstrated RED first (guard added, violations untouched), then both comment lines in `anno-symbol-roundtrip.test.ts` were corrected to `` `src/mcp/vice` -> `src/mcp` -> `src` -> repo root. `` -- matching the unchanged three `".."` hops in the code directly below each, and changing no code anywhere in that file.
- `anno-regbits.test.ts`'s two synthetic scratch MCP-directory segment lists renamed from the pre-relocation `claude/mcp/vice` shape to the current `src/mcp/vice` shape (matching the sibling scratch skills tree's own root); both comments corrected to stop claiming to mirror "the real repo shape" while naming the pre-move shape. Depth unchanged (three segments below the scratch root), proven behaviour-neutral by the drift guard's own unequal before/after digests.
- `.gitignore`'s comment above the ignored generated-skills-copy entry now names `src/skills/` (what `installer/scripts/sync-skills.mjs`'s `SRC` constant actually reads today) instead of the no-longer-existing `.claude/skills/`.
- `repo-root.test.ts`'s deliberate pre-move-shape test and historical narration (lines 107-119, 133-149) stay green with **no exemption** -- proven by the guard's own per-line matching (line 113 has the phrase but not the arrow; line 114 has the arrow but not the phrase) and by `git diff --quiet` on that file after this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- a guard that fails on a half-swept repo-root chain, demonstrated red on the two real sites, then green** - `59c8ca4` (test)
2. **Task 2: The scratch trees and the ignore-file comment name the shape they claim to mirror** - `7571c47` (docs)

## Files Created/Modified

- `src/mcp/vice/hop-chain-comments.test.ts` - new guard: readdirSync-derived scan, per-line arrow+repo-root+pre-relocation-segment detector, 7 tests (2 non-vacuity floors, 1 in-tree negative control, 3 fixture-driven, 1 main assertion)
- `src/mcp/vice/fixtures/planted-hop-chain-fixture.ts.txt` - new committed positive fixture (`.txt` extension, deliberately outside the scanned/shipped set), one planted violation line and one planted legitimate-narration near-miss line
- `src/mcp/vice/anno-symbol-roundtrip.test.ts` - both hop-chain comments (lines 55, 467) corrected to name real ancestors of the module directory
- `src/mcp/vice/anno-regbits.test.ts` - both scratch MCP-directory segment lists renamed `claude/mcp/vice` -> `src/mcp/vice`; both adjacent comments corrected to name the current shape (kept the generator hop-count-formula sentence and the plan-16-01 parenthetical, per the plan's own must-have)
- `.gitignore` - the comment above `/installer/skills/` now names `src/skills/`

## Decisions Made

- The detector's rule is frozen as module-level constants (`CHAIN_ARROW`, `REPO_ROOT_PHRASE`, `PRE_RELOCATION_ROOT_SEGMENT`) matched per PHYSICAL LINE (never per comment span) -- the same discipline `comment-phase-pointers.test.ts` established, and the reason `repo-root.test.ts`'s two-root narration line stays green without an exemption mechanism (which this guard deliberately does not have).
- `extractCommentSpans`/`buildLineIndex`/`lineNumberFor` are copied verbatim from `comment-phase-pointers.test.ts` rather than imported, matching this codebase's "each guard test owns its own scan end-to-end" convention.
- Scan set is `readdirSync(HERE)`-derived over every `*.ts`/`*.mts` file (not `package.json`'s `files[]`), since both real violations live in deliberately-unshipped test files.
- This SUMMARY deliberately never spells out the exact id token of `16-REVIEW.md`'s OTHER open finding (see Guard Status below) -- naming it here, even to explain it is out of scope, would falsely satisfy `docs-review-disposition.test.ts`'s content-blind disposition check for it.

## Deviations from Plan

None - plan executed exactly as written. The plan's own "Flagged Assumptions" section (PKG-03/unclassified/unresolved) was accepted as-is per its own stated terms: this plan treats the path-reference reading of PKG-03 as in scope, additive if a reviewer reads PKG-03 as phase-pointers-only.

## Non-Vacuity / Bite Demonstrations (recorded per plan requirement)

### Task 1 -- RED demonstration (guard added, comments still untouched)

Command: `cd src/mcp/vice && node --test hop-chain-comments.test.ts`

```
not ok 7 - no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)
  error: |-
    half-swept repo-root chain comment(s) found -- correct the segment names so the chain names only real
    ancestors of the module directory, ending at the repository root; do not add a per-file exemption instead:
      anno-symbol-roundtrip.test.ts:55: // `src/mcp/vice` -> `.claude/mcp` -> `.claude` -> repo root.
      anno-symbol-roundtrip.test.ts:467: // `src/mcp/vice` -> `.claude/mcp` -> `.claude` -> repo root.
1..7
# tests 7
# pass 6
# fail 1
```

Exit code: 1. Both real violation sites named at the exact plan-cited lines (55, 467). All 6 other tests (floors, negative control, fixture controls) already passed at this point -- only the real-corpus assertion was red, exactly as intended.

**GREEN after the fix:**

```
1..7
# tests 7
# pass 7
# fail 0
```

### Task 2 -- unequal digest diagnostics (scratch-tree rename proven behaviour-neutral)

Command: `cd src/mcp/vice && node --test anno-regbits.test.ts`

```
# committed memmap.json digest: 60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
# mutated (planted-violation) memmap.json digest: 9d1cd787afc983a7309269cfd3b730c8052fb3cdc2845ef2e1e45af78f9faaa1
```
Both digests differ, and all 20 tests pass -- the rename did not change where the copied generator resolves `memmap.json` (still three segments below the scratch root).

## Guard Status: `docs-review-disposition.test.ts`

`16-REVIEW.md` carries two currently-open findings under review: the WR-02 finding this plan fixes (self-contradictory relocation comments describing the repo-root hop count in `anno-symbol-roundtrip.test.ts`), and one other finding about generic reuse advice in `acme-build/SKILL.md` pointing outside Claude Code's skill-discovery path, owned by plan 16-10.

**IMPORTANT -- read before re-running this guard or writing 16-10's SUMMARY:** `docs-review-disposition.test.ts`'s "every REVIEW.md finding id ... has a recorded disposition (AUDIT-01, self-applied)" check does not parse disposition semantics -- it only tests whether a finding's bare id string appears ANYWHERE (case-sensitive, word-bounded) in any recognised disposition source for that finding's phase (any `*-SUMMARY.md`/`*-VERIFICATION.md`/`*-REVIEW-FIX.md` in the phase's own directory, or a matching pending/completed todo, or the phase's milestone-audit tech-debt block). It does not check whether the mention represents an actual fix. **This means merely typing the other finding's id anywhere in a phase-16 SUMMARY -- even in a sentence explaining that it is explicitly out of scope -- would cause this guard to incorrectly report it as dispositioned.** This SUMMARY was rewritten specifically to avoid that: it describes the other finding by its content only, never by its literal id token, so plan 16-10's own closure of it stays independently verifiable.

**This plan's scope is WR-02 only.** It is fixed at source in this plan's Task 1 (`hop-chain-comments.test.ts` guards the class; both real violation lines were corrected, commit `59c8ca4`). This SUMMARY.md sits in `16-REVIEW.md`'s own phase directory and is one of the guard's recognised disposition sources; citing "WR-02" here by name satisfies the guard's disposition check for that finding specifically.

**Observed before this plan's own commits (matches `16-08-SUMMARY.md`'s independently-confirmed pre-existing state):** `docs-review-disposition.test.ts` red, its undispositioned-findings list naming two ids for `16-REVIEW.md` -- WR-02 and the other, unrelated finding described above.

**Observed live, run immediately before this SUMMARY was written (guard added, both Task 1/Task 2 commits landed, this SUMMARY not yet committed):** the guard was STILL red, still naming both of `16-REVIEW.md`'s two open ids -- because this SUMMARY (the disposition source that names WR-02) did not exist on disk yet at scan time. This is expected: `docs-review-disposition.test.ts` reads whatever disposition sources exist on disk at the moment it runs, and this SUMMARY had not landed yet.

**Expected once this SUMMARY's own commit lands:** the guard's undispositioned list should drop from two `16-REVIEW.md` ids to exactly one -- the other finding, untouched by this plan, correctly left open for plan 16-10 to close. **`docs-review-disposition.test.ts` is NOT expected to be fully green after this plan.** Do not read a continuing single-id failure on this guard as a regression introduced by this plan; it is the documented, intentional interim state named in this plan's own phase context.

`audit-integrity.test.ts`'s "no milestone audit declares a gated status while any docs guard is red (D-12-02)" fails as a downstream cascade of the same guard and is likewise expected to stay red until plan 16-10 closes the other finding.

## Full Baseline Gate (measured before and after this plan's commits)

`cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test`: **2373 tests, 2327 pass, 2 fail, 39 skipped, 5 todo, 24 suites** (up from 2366/24 at the 16-08 baseline, +7 from this plan's new `hop-chain-comments.test.ts` suite). The 2 failures are exactly the two pre-existing, phase-context-named failures (`docs-review-disposition.test.ts`'s AUDIT-01 test, `audit-integrity.test.ts`'s D-12-02 test) -- both predate this plan (present in the 16-08 baseline) and their remaining cause (the other open `16-REVIEW.md` finding, see Guard Status above) is explicitly out of this plan's scope. No new failure was introduced.

`cd src/mcp/vice && npm run typecheck`: exit 0.
`node scripts/check-npm-packages.mjs`: OK (`@henols/vice-mcp` 73 files, `@henols/c64-re-tools` 31 files/6 skills) -- the new fixture does not leak into either tarball.
`node scripts/check-skill-tool-coverage.mjs`: OK (37 `vice_*`, 10 `anno_*`).
`node scripts/check-skill-fork-honesty.mjs`: OK.
`bash scripts/package.sh`: OK, 981 files.
`cd installer && npm test`: 18/18 pass.
`git check-ignore -q installer/skills`: exit 0 (ignore rule intact).
`git diff --quiet -- src/mcp/vice/repo-root.test.ts`: exit 0 (out-of-scope file untouched); `node --test repo-root.test.ts`: 6 tests, `# fail 0`.

## Issues Encountered

None beyond the pre-existing, explicitly-out-of-scope docs-review-disposition/audit-integrity state documented above under Guard Status (carried forward from `16-08-SUMMARY.md`, expected to close at plan 16-10).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-02 fixed at source and dispositioned via this SUMMARY; `hop-chain-comments.test.ts` ships as a standing, fixture-pinned guard against this defect class recurring.
- `docs-review-disposition.test.ts`'s undispositioned-findings list for `16-REVIEW.md` should drop from two ids to one once this plan's commits (including this SUMMARY) land -- plan 16-10 is expected to close the remaining one.
- `anno-regbits.test.ts`'s scratch-tree rename and `.gitignore`'s comment fix are both behaviour-neutral and independent of 16-10/16-11's remaining work.
- The measured baseline (2373 tests, 2 pre-existing fails, all four repo-root validators exit 0) is unregressed and ready for plan 16-10.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*

## Self-Check: PASSED

All key files confirmed present on disk (`src/mcp/vice/hop-chain-comments.test.ts`,
`src/mcp/vice/fixtures/planted-hop-chain-fixture.ts.txt`, `src/mcp/vice/anno-symbol-roundtrip.test.ts`,
`src/mcp/vice/anno-regbits.test.ts`, `.gitignore`, this SUMMARY). Both task commit hashes
(`59c8ca4`, `7571c47`) confirmed in `git log`. Every acceptance criterion in `16-09-PLAN.md`
re-run live and recorded above with observed output. `docs-review-disposition.test.ts` and
`audit-integrity.test.ts` are confirmed still red on the OTHER open `16-REVIEW.md` finding
(not WR-02) after this SUMMARY lands, which is the documented, intentional interim state --
not a regression and not silently presented as green.
