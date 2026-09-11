---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 06
subsystem: annotation-export
tags: [acme, provenance, structural-guard, negative-control, tdd]

# Dependency graph
requires:
  - phase: 46
    provides: "plan 46-01's ledger carry (PROVENANCE_MARKER_PREFIX, per-block provenance annotation), plan 46-03's addExcludedRange/listExcludedRanges/removeExcludedRange, and plan 46-05's EXCLUSION_MARKER_PREFIX/excludedRangeCount and exclusionStore()/writeLedgerFixture() fixtures -- all reused directly rather than re-derived"
provides:
  - "anno-export-asm.test.ts: a red-then-green planted control (exportAsmWithVerdictFilter(), the TEST-ONLY filtering variant, observed dropping a CRACKER-PATCH-classified range before the real exportAsm() is trusted to keep it) plus the never-shipped assertions naming the variant and files[]"
  - "anno-export-asm.test.ts: a structural guard (blockConstructionSlice(), pinsUnconditionalBlockMap(), hasRangeListFilter(), hasBlockListFilter(), referencesProvenanceField()) that reds the moment anything between the store read and the emitted block array branches on a verdict, confidence or kind value, with four synthetic non-vacuity proofs plus a codeOnly() self-check"
  - "anno-export-asm.test.ts: a behavioural companion measuring 'no verdict value changes what is emitted' across all three verdicts (ORIGINAL/CRACKER-PATCH/UNKNOWN) and multiple confidence tiers, with per-block annotation asserted individually and verdict-set equality asserted in both directions"
affects: []

# Actuals (#2632)
actuals:
  tokens: 6652
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A negative control is only trustworthy once its RED half has actually run: exportAsmWithVerdictFilter() is a real, working filtering re-implementation of just the block-construction stretch, executed in the SAME test as the real exporter's GREEN result, over the SAME fixture -- so the control cannot pass because the fixture happened to be broken or the two halves silently diverged."
    - "A structural guard over a module that documents its own forbidden shape in prose must scan codeOnly()'d text, never raw source -- otherwise the guard's own negative assertion is satisfied or invalidated by the module's commentary rather than its code (shipped-modules.ts's own measured incident)."
    - "A structural guard's scope should be the NARROWEST slice that is unambiguous, not the whole file: bounding the guard to `const sortedRanges = ...sort(...)` through the block .map()'s closing `}));` means a bare word-occurrence check for verdict/confidence/kind is a strictly stronger, still-correct form of 'no conditional reads it' -- the later per-block loop's LEGITIMATE ledger-field interpolation sits outside the slice entirely, so no disambiguation logic is needed."
    - "Every guard predicate is written as a violation-detector (returns true when something is WRONG) and proven to fire against a synthetic, in-memory, single-property mutation of the guard's own scanned text -- a predicate that has never been observed to fire is indistinguishable from one that cannot."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "Both tasks declare anno-export-asm.test.ts as their only <files> entry, so both landed in ONE commit rather than two -- the identical precedent 46-04's and 46-05's own SUMMARYs already recorded for this exact shape ('a task's own tests land in a sibling task's file list is not a deviation'). The plan's own <verification> step explicitly wants the RED half and the GREEN half in the SAME commit, which a single commit satisfies by construction."
  - "The filtering variant's verdict is a fixed module-level constant (FILTERED_VERDICT = \"CRACKER-PATCH\") rather than a caller-supplied option, since the plan's own <action> text describes the variant as 'the negative control BUILD-07 criterion 1 requires' keyed on a SPECIFIC plausible-heuristic verdict, not a general-purpose filter. This keeps the variant as small as its one stated purpose requires."
  - "The structural guard's scope is deliberately bounded to a regex-extracted slice (`const sortedRanges = [...ranges].sort(...)` through the block .map()'s closing `}));`) rather than the whole stripped file. Verified empirically (node script run against the real, current anno-export-asm.ts) before committing to the shape: the slice contains nothing but the range-to-block conversion, so a bare word-occurrence check for verdict/confidence/kind inside it cannot collide with the LATER per-block loop's legitimate ledger-field interpolation into a comment string, which sits entirely outside the slice."
  - "The behavioural companion reuses exclusionStore() and writeLedgerFixture() verbatim (46-05's own fixtures) rather than writing a new duplicate store builder -- exclusionStore() already carries the exact three-range, one-range-per-verdict shape LEDGER_GENERATED_RANGES classifies, plus an exclusions parameter, which is precisely 'one range per verdict plus one recorded exclusion' the plan's <behavior> asks for."

requirements-completed: [BUILD-07]

coverage:
  - id: D1
    description: "A planted control fixture -- a range classified CRACKER-PATCH/cracktro in the ledger, carrying printable crack-credit text, referenced by no label, comment or enum usage anywhere in the store -- is proven, by three independent non-vacuity assertions, to actually tempt a heuristic before anything about the exporter is asserted."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#PLANTED CONTROL (BUILD-07): a CRACKER-PATCH-classified, cracktro-shaped, wholly unreferenced range is dropped by a filtering variant (RED) and survives byte for byte, annotated, in the real exporter (GREEN)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A test-only filtering variant (exportAsmWithVerdictFilter()) is observed, mechanically and in the same test run, to DROP the planted range (RED) -- one fewer block than the store's own range count, the planted start absent from block starts, the planted bytes absent from the expected-byte span -- with the discriminating-power observation recorded in channel-lock.test.ts:108-118's own comment structure, immediately above the GREEN half's first assertion."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#PLANTED CONTROL (BUILD-07): a CRACKER-PATCH-classified, cracktro-shaped, wholly unreferenced range is dropped by a filtering variant (RED) and survives byte for byte, annotated, in the real exporter (GREEN)"
        status: pass
      - kind: other
        ref: "git show 0202814c -- src/mcp/vice/anno-export-asm.test.ts: the RED half and the GREEN half of the planted control land in the SAME commit (the plan's own end-of-phase git-log requirement)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real, shipped exportAsm() over the SAME fixture keeps the planted range byte for byte (right start/endExclusive, right offset in expectedBytes), annotates it with its CRACKER-PATCH verdict rather than merely retaining it, drops nothing (blocks.length equals the store's own range count), and the whole export still round-trips through real ACME."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#PLANTED CONTROL (BUILD-07): a CRACKER-PATCH-classified, cracktro-shaped, wholly unreferenced range is dropped by a filtering variant (RED) and survives byte for byte, annotated, in the real exporter (GREEN)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The filtering variant is proven absent from everything that ships: its identifier does not appear in anno-export-asm.ts's own source, and anno-export-asm.test.ts itself is absent from package.json's files[] array."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#the filtering variant's identifier never reaches anno-export-asm.ts's own shipped source"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#anno-export-asm.test.ts is absent from package.json's files[] array (test-only, mechanically enforced, acme-gate.test.ts's own idiom)"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (repo root)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A structural guard reads anno-export-asm.ts's own source through codeOnly() and, over the narrowly-bounded block-construction slice, positively pins the unconditional block-array .map() and negatively forbids a range-list filter, a block-list filter, and any reference to a verdict/confidence/kind field."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#STRUCTURAL GUARD (BUILD-07): the block array is built 1:1 from the sorted range list, with no filter and no provenance-field conditional"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each of the guard's four predicates (shape-pin, range-list-filter, block-list-filter, field-reference) is proven non-vacuous against its own dedicated synthetic, in-memory mutation, and codeOnly()'s own extraction is self-checked as non-empty and strictly shorter than the raw source -- five separately-named 'guard non-vacuity:' proofs in total."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#guard non-vacuity: codeOnly()'s own extraction of anno-export-asm.ts is non-empty and strictly shorter than the raw source"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#guard non-vacuity: pinsUnconditionalBlockMap fires when the block shape drifts from the pinned form"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#guard non-vacuity: hasRangeListFilter fires when a .filter() is inserted before the block .map()"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#guard non-vacuity: hasBlockListFilter fires when a .filter() is chained after the block .map()"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#guard non-vacuity: referencesProvenanceField fires when a provenance field name is inserted into the slice"
        status: pass
    human_judgment: false
  - id: D7
    description: "A behavioural companion measures 'no verdict value changes what is emitted' across the whole vocabulary: a fixture carrying all three verdicts and multiple confidence tiers, result.blocks.length compared against listRanges()'s live row count, every block individually asserted to carry at least one provenance line, and the verdict set asserted equal between ledger and source in both directions."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#BEHAVIOURAL COMPANION (BUILD-07): no verdict, confidence or kind value changes what is emitted, across the full vocabulary"
        status: pass
    human_judgment: false

duration: 23 min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 06: The Planted Control and the Structural Guard for BUILD-07 Summary

**A test-only filtering exporter variant is observed dropping a CRACKER-PATCH-classified range (RED) before the real `exportAsm()` is trusted to keep it byte for byte and annotated (GREEN), plus a `codeOnly()`-scanned structural guard whose four predicates are each proven to fire against a synthetic mutation, plus a behavioural companion measuring losslessness across the whole verdict vocabulary.**

## Performance

- **Duration:** 23 min (approximate -- bounded by the prior plan's close-out commit `b31514b8` at 19:02:13+02 and this plan's own commit `0202814c` at 19:24:47+02; `date -u` was not captured as the literal first bash call this session)
- **Started:** 2026-09-11T17:02:13Z (approximate, per the bound above)
- **Completed:** 2026-09-11T17:24:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `exportAsmWithVerdictFilter()`, a doc-commented TEST-ONLY filtering re-implementation of just the block-construction stretch, keyed on `FILTERED_VERDICT = "CRACKER-PATCH"`. Run in the RED half of `PLANTED CONTROL (BUILD-07)`, it drops the planted range: one fewer block than the store's own range count, the planted start absent from block starts, the planted bytes absent from the expected-byte span -- three separate assertions, not one.
- The planted control's own fixture: a real, labelled/commented `code` range first, the PLANTED range second (literally the middle of three), and a plain `byte` range last. The planted range's bytes (`"CRACKED BY GRP"`) are a printable run, its ledger row is `CRACKER-PATCH`/`cracktro`, and no label, comment or enum usage in the store references it -- all three proven by non-vacuity assertions before the RED or GREEN half runs, with a companion assertion proving the "zero references" count is a genuine absence (the store DOES carry labels/comments elsewhere) rather than an empty store.
- The GREEN half, over the SAME fixture: the real `exportAsm()` keeps the planted block at its exact `start`/`endExclusive`, its bytes at the right offset in `result.expectedBytes`, annotates it with a `; PROVENANCE LEDGER: ... verdict=CRACKER-PATCH` line (not merely retaining it), emits `blocks.length` equal to the store's own range count, and round-trips through real ACME (`outcome: "ok"`, `byteDiff.equal: true`). The discriminating-power observation, in `channel-lock.test.ts:108-118`'s exact comment structure, sits immediately above the GREEN half's first assertion and states explicitly that this control's red observation is CONTINUOUS (run mechanically in this same test every time the file runs) rather than a historical hand run.
- Two never-shipped assertions: `exportAsmWithVerdictFilter`'s identifier is absent from `anno-export-asm.ts`'s own source, and `anno-export-asm.test.ts` is absent from `package.json`'s `files[]` (the same idiom `acme-gate.test.ts` already uses in this directory).
- A structural guard (`blockConstructionSlice()`, `pinsUnconditionalBlockMap()`, `hasRangeListFilter()`, `hasBlockListFilter()`, `referencesProvenanceField()`) that reads `anno-export-asm.ts`'s own source through `codeOnly()` (`shipped-modules.ts`'s ONE comment-and-string-literal stripper) and scans only the narrowly-bounded block-construction slice -- from `const sortedRanges = [...ranges].sort(...)` through the block `.map()`'s closing `}));` -- so the later per-block loop's legitimate ledger-field interpolation into a comment string cannot collide with the guard's own bare word-occurrence check.
- Five separately-named `guard non-vacuity:` proofs: each of the guard's four predicates fired against its own dedicated, single-property, in-memory mutation of the real slice (shape drift, a filter inserted before `.map(`, a filter chained after it, a provenance-field name inserted), plus a `codeOnly()` self-check (non-empty, strictly shorter than the raw source) citing `ci-suite-coverage.test.ts`'s own reasoning.
- A behavioural companion, reusing 46-05's own `exclusionStore()`/`writeLedgerFixture()` fixtures with one added exclusion, measuring "no verdict value changes what is emitted" across all three verdicts (`ORIGINAL`/`CRACKER-PATCH`/`UNKNOWN`) and multiple confidence tiers: `result.blocks.length` compared against `listRanges()`'s LIVE row count (never hard-coded), every block individually asserted to carry at least one provenance line, and verdict-set equality asserted in BOTH directions separately (nothing dropped, nothing invented).
- 8 new tests total (130 in the file, 0 fail, 0 skipped -- ACME present).

## Task Commits

Both tasks were committed in a single commit, since both declare `anno-export-asm.test.ts` as their only `<files>` entry (46-04's and 46-05's own precedent for this exact shape -- see Decisions Made below). The plan's own `<verification>` step also requires the RED half and the GREEN half to land in the SAME commit, which this satisfies by construction.

1. **Task 1 (the planted control) + Task 2 (the structural guard)** - `0202814c` (test, `anno-export-asm.test.ts` only)

**Plan metadata:** committed as part of this same close-out step.

## Files Created/Modified
- `src/mcp/vice/anno-export-asm.test.ts` - imports (`ExportAsmOptions`, `ExportBlock` types; `listEnumUsage`; `provenanceForRange`/`readProvenanceLedger`; `codeOnly`); the planted-control fixture and `exportAsmWithVerdictFilter()` variant; the `PLANTED CONTROL` red-then-green test plus two never-shipped assertions; the structural guard's five predicate functions, its own test, and five `guard non-vacuity:` proofs; the behavioural companion test

## Decisions Made
See `key-decisions` in the frontmatter above. The most consequential one: both tasks' work landed in one commit because both tasks' `<files>` declaration is the same single file, and the plan's own end-of-phase verification wants the RED and GREEN halves in the same commit anyway -- this is not a deviation, it is the identical shape 46-04's and 46-05's own SUMMARYs already recorded and named as non-deviating.

## Deviations from Plan

### Auto-fixed Issues

None -- no Rule 1-3 auto-fixes were needed. The implementation and tests matched the plan's `<behavior>`/`<action>` text directly.

### Refinements made during self-check (not deviations, tightening literal compliance)

While re-checking every `<acceptance_criteria>` line against the first draft, three wording gaps were closed before finalizing:
- Added an explicit `assert.equal(patchRow.verdict, "CRACKER-PATCH", ...)` alongside the existing `.kind` check, so "the ledger row's verdict is CRACKER-PATCH" is its own assertion rather than only implied by the `.find()` predicate that located the row.
- Moved the DISCRIMINATING POWER comment to sit directly above `assert.ok(plantedBlock, ...)` (the GREEN half's actual first assertion) rather than above the preceding `const result = exportAsm(...)` line, matching `channel-lock.test.ts:108-118`'s placement more literally.
- Replaced the single `assert.deepEqual` verdict-set check with two explicit directional loops (`for (const v of verdictsInLedger) ...` / `for (const v of verdictsInSource) ...`), so "asserted in both directions" is two literal assertions rather than one equality check that happens to encode both directions.

All three were verified by re-running the full file's test suite (130/130 pass) and `npm run typecheck` (clean) after each change.

## Issues Encountered

**Unrelated concurrent activity in the shared main working tree (not caused by this plan, not fixed, out of scope):** `git status` showed modifications to `.planning/ENGINEERING_RULES.md`, `.planning/debug/gsd-internals-leak-into-src.md`, `fixtures/c1541/README.md`, `skills-planning-vocabulary.test.ts`, and several `src/skills/**` files, plus untracked `.vice-snapshots/`, `.vice-supervisor/`, two new `docs/*.md` files, and `tools/` -- none of which this plan touched, staged, or committed. A commit named `ef039bd1 fix: forbid decision ids in shipped skills outright, and close two guard holes` landed on `main` from this concurrent activity between this plan's start and its own commit. Every `git add` this plan performed named `src/mcp/vice/anno-export-asm.test.ts` explicitly (never `git add -A`/`.`), confirmed via `git status --short` immediately before the commit, so none of the concurrent session's files were accidentally staged.

## User Setup Required

None - no `user_setup` block in the plan's frontmatter, and no external service configuration required.

## Next Phase Readiness
- This is the LAST plan of Phase 46. `BUILD-07` is now the last requirement this phase declares, and `requirements.mark-complete` confirmed it READY and marked it complete (checkbox and traceability table both updated in `.planning/REQUIREMENTS.md`).
- Full re-run of `node --test anno-export-asm.test.ts`: `ℹ tests 130`, `ℹ pass 130`, `ℹ fail 0`, `ℹ skipped 0`.
- `npm run typecheck` (from `src/mcp/vice/`): clean, exit 0.
- `node scripts/check-npm-packages.mjs` (from repo root): `check-npm-packages: OK`, exit 0 -- neither the filtering variant nor the test file itself reaches either published tarball.
- `git show 0202814c -- src/mcp/vice/anno-export-asm.test.ts`: confirmed the RED half (`exportAsmWithVerdictFilter` call and its three assertions) and the GREEN half (`exportAsm` call and its assertions) are both present in this ONE commit, satisfying the plan's own end-of-phase manual-read requirement.
- No blockers. Phase 46 is ready for phase-level verification.

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-export-asm.test.ts ]` - FOUND (modified)
- `git log --oneline --all | grep -E '\(46-06\)|46-06'` -- the commit subject uses the `test(46-06): ...` convention: `0202814c test(46-06): plant a red-then-green control and a structural guard for BUILD-07` - FOUND, 1 commit
- Re-ran every task's `<verify>` and the plan-level `<verification>` commands against the final tree:
  - `node --test anno-export-asm.test.ts` (from `src/mcp/vice/`) -- `ℹ tests 130`, `ℹ pass 130`, `ℹ fail 0`, `ℹ skipped 0`
  - `npm run typecheck` (from `src/mcp/vice/`) -- exit 0, clean
  - `node scripts/check-npm-packages.mjs` (from repo root) -- `exit=0`
  - `grep -ac 'DISCRIMINATING POWER' src/mcp/vice/anno-export-asm.test.ts` -> 1
  - `grep -ac 'codeOnly' src/mcp/vice/anno-export-asm.test.ts` -> 7
  - `node --test anno-export-asm.test.ts 2>&1 | grep -ac 'guard non-vacuity:'` -> 5
  - `node -e '...indexOf(0)...'` on both `anno-export-asm.test.ts` and `anno-export-asm.ts` -> `-1` (no NUL bytes in either file)
  - `git diff --diff-filter=D --name-only HEAD~1 HEAD` -> empty (no accidental deletions)
- Every task's `<acceptance_criteria>` re-checked line by line against the final tree, including the three wording refinements documented above under Deviations.

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
