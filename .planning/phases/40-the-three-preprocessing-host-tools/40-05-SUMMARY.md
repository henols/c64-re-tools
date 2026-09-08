---
phase: 40-the-three-preprocessing-host-tools
plan: 05
subsystem: testing
tags: [skills, documentation-honesty, description-overlap, test-hygiene, node-test-runner]

# Dependency graph
requires:
  - phase: 40-the-three-preprocessing-host-tools (plans 40-02, 40-03)
    provides: c64-disk-access and c64-petcat, the two new skills whose descriptions this plan re-cuts the existing skill surface against
provides:
  - Two re-cut skill descriptions (c64-ram-capture, c64-program-recon) that are true of what each skill now owns, with pointers to the new owners instead of restated capability
  - A nine-row, byte-identical project-skills table in CLAUDE.md, matching the real nine-skill directory tree
  - Corrected first-party skill-count prose in two coverage scripts, now relation-based instead of a stale bare number
  - A uniquely-named-per-invocation scratch-directory fix for one of two carried scratch-fixture race sites, plus a recorded assessment of the second site
affects: [40-06 (deletes d64-parse.mjs and its test, now uncited by c64-ram-capture/SKILL.md)]

# Actuals (#2632)
actuals:
  tokens: 4900
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Uniquely-named scratch DIRECTORY (mkdtempSync) created INSIDE a walked tree, cleaned up via the test runner's own t.after() hook, replacing a fixed-name scratch file cleaned up in a bare try/finally"
    - "Dated-rider prose for a magnitude that would otherwise go stale (skill count, with the date it was true) instead of a bare number or a relation restated without evidence"

key-files:
  created: []
  modified:
    - src/skills/c64-ram-capture/SKILL.md
    - src/skills/c64-program-recon/SKILL.md
    - scripts/check-skill-tool-coverage.mjs
    - scripts/lib/skill-descriptions.mjs
    - src/mcp/vice/skill-honesty-checks.test.ts
    - src/mcp/vice/dxa-seam.test.ts
    - src/mcp/vice/module-classification.ts
    - .planning/phases/40-the-three-preprocessing-host-tools/deferred-items.md
    - .planning/WINDOWS.md

key-decisions:
  - "c64-ram-capture's frontmatter description already claimed no disk-image structure work; the fix was removing the four in-body citations of d64-parse.mjs (preamble alias, two prose paragraphs, References-table row) and replacing them with a one-line pointer to c64-disk-access."
  - "c64-program-recon's frontmatter needed no rewrite either (it never claimed BASIC-stub decoding); instead added a 'Before disassembling anything' pointer section naming both new skills, and narrowed the REFERENCE-ONLY BASIC-token section to point at c64-petcat's real decode+handover-resolution capability rather than re-teaching the manual method, since that manual method is now what c64-petcat actually ships."
  - "CLAUDE.md's project-skills table already had nine byte-identical rows before this plan touched anything -- no edit was needed there."
  - "Both stale-count scripts kept their historical figures (Phase 5's 6-skill criterion, the Phase 19 measurement's 6-skill/11-total corpus) but reworded to state the relation (derived from the tree at run time) and carry the historical figure with its own date, per the project's dated-rider convention -- never a bare 'six skills' substring, since the verify gate greps for exactly that."
  - "Site 1 (skill-honesty-checks.test.ts): fixed-name scratch file -> uniquely-named scratch directory (mkdtempSync) inside the same walked src/skills/acme-build/ directory, cleanup via t.after()."
  - "Site 2 (dxa-seam.test.ts): assessed, not changed. findDxaBinary()'s first candidate is a FIXED, project-vendored path with no test-time override (unlike findAcmeLib()'s ACME-env-first pattern), so the fixture cannot move to a unique directory without a production-code change this plan does not make. Checked directly (not assumed) that no committed test file's own directory walk currently branches on resources/vendor/dxa/dxa's presence -- resources-sync.test.ts filters to .mjs before comparing anything, and dxa-build-gate.test.ts scans a different vendor tree entirely -- so this site carries no currently-measured hazard."
  - "A THIRD, orthogonal concurrent-scanner race was discovered in audit-root-args.test.ts during verification, confirmed pre-existing (reproduces identically on the stashed, pre-fix code), and is out of this plan's files_modified scope -- logged to deferred-items.md and WINDOWS.md rather than fixed here."

patterns-established:
  - "A skill's 'Which skill does what' cross-reference table gets a new row whenever a new skill takes over part of its job, kept in sync at the same time the ownership pointer is added to the body."

requirements-completed: [PREP-01, PREP-02]

coverage:
  - id: D1
    description: "Re-cut c64-ram-capture and c64-program-recon skill descriptions to be true of what each skill now owns, with c64-program-recon pointing at c64-disk-access and c64-petcat instead of restating their work; nine-row project-skills table stays byte-identical; pairwise description-collision list and allowlist both empty."
    requirement: "PREP-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-description-overlap.test.ts (32 tests)"
        status: pass
      - kind: other
        ref: "grep -ac 'd64-parse' src/skills/c64-ram-capture/SKILL.md == 0"
        status: pass
      - kind: other
        ref: "awk '/GSD:skills-start/,/GSD:skills-end/' CLAUDE.md | grep -ac '^| [a-z0-9-]* |' == 9; ls -1 src/skills | wc -l == 9"
        status: pass
    human_judgment: false
  - id: D2
    description: "Correct stale 'six skills' prose in check-skill-tool-coverage.mjs and scripts/lib/skill-descriptions.mjs, stated as a relation derived from the tree at run time, with historical figures carrying their own dates; behaviour of both scripts unchanged (still exit 0)."
    requirement: "PREP-02"
    verification:
      - kind: other
        ref: "grep -aci 'six skills' scripts/check-skill-tool-coverage.mjs scripts/lib/skill-descriptions.mjs == 0 for both files"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs; node scripts/check-skill-fork-honesty.mjs -- both exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Take the carried scratch-fixture fix at the first named site (skill-honesty-checks.test.ts): fixed-name scratch file replaced with a uniquely-named per-invocation scratch directory inside the same walked src/skills/acme-build/ directory, cleaned up via t.after() so cleanup runs on an assertion failure too. Second site (dxa-seam.test.ts) assessed and left unchanged with the assessment recorded in a comment, since its fixture path is fixed by production code with no test-time override."
    verification:
      - kind: integration
        ref: "for i in 1..20: node --test skill-honesty-checks.test.ts dxa-seam.test.ts audit-root-args.test.ts -- REPEAT20_OK both times run"
        status: pass
      - kind: other
        ref: "git status --porcelain src/skills src/mcp/vice/resources after a single run == 0 (no surviving scratch artifact)"
        status: pass
      - kind: integration
        ref: "npm run test:automated -- floor confined to anno-register.test.ts (3 known-pre-existing failures); an intermittent 4th failure in audit-root-args.test.ts was observed on ~3 of 5 full-suite runs, confirmed pre-existing (reproduces identically on the stashed pre-fix code) and out of this plan's scope"
        status: unknown
    human_judgment: true
    rationale: "The full-suite run's pass/fail is genuinely non-deterministic because of a SECOND, different concurrent-scanner race this plan does not own (audit-root-args.test.ts comparing four sequential live spawns against a shared mutable tree). The deterministic, in-scope proof (20 consecutive runs of the two touched files plus the named victim file) is clean both times it was run; a human should confirm the deferred-items.md assessment is acceptable rather than treat a flaky full-suite run as this plan's own regression."

duration: 55min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 05: Skill Description Re-Cut and Scratch-Fixture Race Summary

**Re-cut c64-ram-capture and c64-program-recon's descriptions to be true after 40-02/40-03's two new skills, corrected stale skill-count prose in two coverage scripts, and closed one of two carried scratch-artifact test races (with the second formally assessed and left unforced).**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-08T11:12:27Z (approx, first task commit)
- **Completed:** 2026-09-08T11:35:25Z (approx, verification concluded shortly after)
- **Tasks:** 3
- **Files modified:** 9 (7 tracked source/doc files + deferred-items.md + WINDOWS.md)

## Accomplishments

- `c64-ram-capture/SKILL.md` no longer cites `d64-parse.mjs` anywhere (preamble alias, two prose paragraphs, and its References-table row all removed), replaced with a one-line pointer to `c64-disk-access` as the new owner of disk-image structure; its "Which skill does what" table gained a matching row.
- `c64-program-recon/SKILL.md` gained a "Before disassembling anything" section naming both `c64-disk-access` and `c64-petcat` as the owners of adjacent jobs, and its former "REFERENCE-ONLY: decoding Commodore BASIC tokens" section (which taught the exact manual method `c64-petcat` now automates) was corrected to point at `c64-petcat`'s real `decode` verb and named decline, narrowed to cover only the one thing `c64-petcat` still doesn't do (writing tokenized-byte annotations into the store).
- Confirmed the nine-row `CLAUDE.md` project-skills table and the pairwise description-collision check (empty allowlist) were already correct after 40-02/40-03 and stayed correct through this plan's edits — verified with the committed test suite, not assumed.
- `scripts/check-skill-tool-coverage.mjs` and `scripts/lib/skill-descriptions.mjs` no longer carry a literal "six skills" claim; both now state the relation (derived from the tree at run time) and carry their historical figures with dates, per this project's dated-rider convention. Neither script's behaviour changed (both still exit 0 against the real tree of nine).
- `skill-honesty-checks.test.ts`'s `runCiScriptWithScratchFile()` helper now creates a uniquely-named scratch directory per invocation (via `mkdtempSync`) inside the same walked `src/skills/acme-build/` directory, instead of writing a fixed-name file directly there — closing the specific race where another concurrently-running test file's own scan could observe or collide with a fixed name. Cleanup moved to the test runner's own `t.after()` hook.
- `dxa-seam.test.ts`'s planted-binary site was assessed rather than changed: `findDxaBinary()`'s first candidate is a fixed, project-vendored path with no test-time override, so it cannot take the same fix without a production-code change. A comment records that assessment plus the fact (checked directly, not assumed) that no committed test file's directory walk today observes that specific path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-cut the two overlapping descriptions, point the recon skill at the new owners** - `e8f8fb95` (docs)
2. **Task 2: Correct the stale first-party skill-count prose** - `240db56e` (docs)
3. **Task 3: Take the carried scratch-fixture fix at both named sites** - `0918848f` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/skills/c64-ram-capture/SKILL.md` - Removed all four `d64-parse.mjs` citations; added a pointer to `c64-disk-access` and a matching cross-reference-table row.
- `src/skills/c64-program-recon/SKILL.md` - Added a "Before disassembling anything" pointer section; narrowed the BASIC-token reference section to point at `c64-petcat`; added two cross-reference-table rows.
- `scripts/check-skill-tool-coverage.mjs` - Header comment reworded from a bare "six skills" claim to a dated, relation-based statement.
- `scripts/lib/skill-descriptions.mjs` - Threshold-measurement doc comment reworded the same way, with the Phase 19 corpus size dated.
- `src/mcp/vice/skill-honesty-checks.test.ts` - `runCiScriptWithScratchFile()` rewritten to use a uniquely-named scratch directory and `t.after()` cleanup; three call sites updated to pass the test's `TestContext`.
- `src/mcp/vice/dxa-seam.test.ts` - Assessment comment added above `plantFakeDxaBinary()`; no behavioural change.
- `src/mcp/vice/module-classification.ts` - Two pinned line citations (`parseAnnoCliVerbs`, line 52 -> 59) updated after task 2's header-comment edit shifted `check-skill-tool-coverage.mjs`'s line numbers (Rule 1 auto-fix, see Deviations).
- `.planning/phases/40-the-three-preprocessing-host-tools/deferred-items.md` - New entry recording the second, orthogonal, pre-existing `audit-root-args.test.ts` race discovered during verification.
- `.planning/WINDOWS.md` - Ledger entry for the same deferred item.

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's header-comment edit shifted a pinned line-number citation in `module-classification.ts`**
- **Found during:** Task 2 verification (ran `npm run test:automated` before committing task 3, to check for collateral damage)
- **Issue:** `check-skill-tool-coverage.mjs`'s header comment grew by 7 lines (task 2's stale-prose fix), shifting the `import { parseAnnoCliVerbs, ... }` line from 52 to 59. `module-classification.ts` carries two `{ path: "scripts/check-skill-tool-coverage.mjs", symbol: "parseAnnoCliVerbs", line: 52 }` citations that `module-classification.test.ts`'s "DIRECTION 9 (precision)" containment check verifies against the live file — both went stale and started failing.
- **Fix:** Updated both citations from `line: 52` to `line: 59`.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` passes; `npm run typecheck` clean.
- **Committed in:** `0918848f` (folded into task 3's commit, since it was discovered and fixed alongside that task's own verification pass)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, a collateral line-reference drift from task 2's own edit).
**Impact on plan:** Necessary to keep an unrelated committed test green; no scope creep — the fix is a two-number correction in a pinned citation table, not new functionality.

### Discovered But Not Fixed (Scope Boundary)

A SECOND, orthogonal concurrent-scanner race exists in `audit-root-args.test.ts` (not named by this plan, not in `files_modified`), discovered while re-running the full suite to verify task 3. Its "every spelling that RESOLVES to the repository root is accepted" test runs four sequential live spawns of `check-skill-fork-honesty.mjs` against the real, shared `src/skills/` tree, and can disagree with itself if `skill-honesty-checks.test.ts`'s own deliberately-violating scratch fixture exists during some of those four spawns but not others. **Confirmed pre-existing**: stashing this plan's fix and re-running the identical full suite against the original fixed-name-scratch-file code reproduces the identical failure by the identical mechanism. Logged to `deferred-items.md` and the `WINDOWS.md` ledger (entry 54) rather than fixed, per the scope-boundary rule — closing it durably would mean editing a file this plan does not own.

## Issues Encountered

- The full `npm run test:automated` suite is genuinely non-deterministic in this environment because of the deferred `audit-root-args.test.ts` race above: of 5 full-suite runs during this plan's verification, 3 showed the extra flake and 2 were clean at the documented 3-failure floor (all in `anno-register.test.ts`). The deterministic, in-scope proof this plan's own acceptance criteria specify — 20 consecutive runs of `skill-honesty-checks.test.ts dxa-seam.test.ts audit-root-args.test.ts` together — was run twice and was clean (`REPEAT20_OK`) both times.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `c64-ram-capture/SKILL.md` no longer references `d64-parse.mjs` in any form, so 40-06 (which deletes `src/skills/c64-ram-capture/scripts/d64-parse.mjs` and its test) has nothing left citing the module it's about to remove.
- The nine-skill inventory, its project-skills table, and the description-collision check are all in agreement and green.
- The `audit-root-args.test.ts` race is a known, documented, open item — not a blocker for this phase, since it predates this plan and is confined to a full-suite scheduling artifact rather than a deterministic regression.

## Self-Check: PASSED

- `src/skills/c64-ram-capture/SKILL.md` exists, modified: FOUND
- `src/skills/c64-program-recon/SKILL.md` exists, modified: FOUND
- `src/mcp/vice/skill-honesty-checks.test.ts` exists, modified: FOUND
- Commit `e8f8fb95` found in `git log --oneline --all`: FOUND
- Commit `240db56e` found in `git log --oneline --all`: FOUND
- Commit `0918848f` found in `git log --oneline --all`: FOUND
- `node --test skill-description-overlap.test.ts skill-honesty-checks.test.ts dxa-seam.test.ts audit-root-args.test.ts`: 111 pass, 0 fail
- `grep -ac 'd64-parse' src/skills/c64-ram-capture/SKILL.md`: 0
- `awk` skills-table row count: 9; `ls src/skills | wc -l`: 9
- `grep -aci 'six skills'` both scripts: 0
- `node scripts/check-skill-tool-coverage.mjs` / `check-skill-fork-honesty.mjs`: both exit 0
- Two independent 20x repeats of the three named files: `REPEAT20_OK` both times
- `git status --porcelain src/skills src/mcp/vice/resources` after a run: 0
- `npm run typecheck`: clean
- `npm run test:automated`: at or below the documented floor on 2 of the last 3 runs; the 3rd run's extra failure is the deferred, confirmed-pre-existing `audit-root-args.test.ts` race (see Deviations / Issues Encountered)

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*
