---
phase: 16-packaging-and-repo-shape
plan: 10
subsystem: testing
tags: [consumer-paths, regression-fix, node-test, skill-generators, node-test-registry]

# Dependency graph
requires:
  - phase: 16-packaging-and-repo-shape
    provides: plan 16-08's build-job step that runs src/skills/*/scripts/*.test.mjs in CI (without it the two behavioural guards this plan adds would pass locally and be executed by nothing)
provides:
  - the three restored consumer-path literals in renderLedger/anchor-search (diff-images.mjs) plus a repaired, mechanically-enforced guarding comment
  - the two restored consumer-path literals in renderLoading's absence-as-evidence paragraph (watch-loads.mjs)
  - the corrected `; Build:` scaffold line (template.a) and reuse-advice sentence (acme-build/SKILL.md)
  - src/mcp/vice/skill-consumer-paths.test.ts, a frozen four-entry registry guard against this whole defect class recurring
affects: [16-11]

# Actuals (#2632)
actuals:
  tokens: 5799
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen registry guard (fixed, named entries -- not a corpus scan) for a small, known set of consumer-facing sites, each entry pairing a presence check on the consumer form with an absence check on the source-tree form, never a substring both satisfy"
    - "Content-anchored region scoping (anchor text, never a line number) for the one file that legitimately carries both the consumer form and the source-tree form in different places"
    - "Plant-and-revert bite demonstration performed live per registry entry (not as a committed test, since that would leave the tree dirty) and recorded in the SUMMARY as the non-vacuity evidence"

key-files:
  created:
    - src/mcp/vice/skill-consumer-paths.test.ts
  modified:
    - src/skills/c64-provenance-diff/scripts/diff-images.mjs
    - src/skills/c64-provenance-diff/scripts/diff-images.test.mjs
    - src/skills/c64-ram-capture/scripts/watch-loads.mjs
    - src/skills/c64-ram-capture/scripts/watch-loads.test.mjs
    - src/skills/acme-build/template.a
    - src/skills/acme-build/SKILL.md
    - src/mcp/vice/skill-acme-build-cli.test.ts

key-decisions:
  - "The guarding comment at renderLedger's generation site was rewritten to 3 lines (not the originally-drafted 6-9 line version) to fit the plan's own <=12-changed-line budget for the whole diff-images.mjs diff (three literals + the comment, no code) -- it still contrasts two different roots and names its own mechanical enforcement (skill-consumer-paths.test.ts), just more tersely than my first draft."
  - "skill-consumer-paths.test.ts is a fixed four-entry REGISTRY, not a corpus scan like hop-chain-comments.test.ts/comment-phase-pointers.test.ts -- the four sites are known, named, and fixed in number, so a registry with per-entry non-vacuity floors is the right shape, not a pattern-detector tuned against a larger corpus."
  - "The plant-and-revert bite demonstrations for all four registry entries were performed live (sed-planted, tested, reverted, confirmed clean) rather than committed as tests, since a committed plant-and-revert test would leave the working tree dirty between runs -- the plan itself anticipated this ('Record all four captures in the SUMMARY... A guard entry whose plant did not turn it red is not wired')."

requirements-completed: [PKG-01]

coverage:
  - id: D1
    description: "renderLedger's generated ledger (recovery/PROVENANCE.md) and the anchor-search method: field name the consumer-installed path in all three places, never this repository's source tree; the guarding comment contrasts two different roots again and names its own enforcement"
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "src/skills/c64-provenance-diff/scripts/diff-images.test.mjs#renderLedger's generated ledger names the consumer's installed script location... (16-REVIEW.md CR-01 regression)"
        status: pass
      - kind: other
        ref: "RED-then-GREEN demonstration against the real tree (this SUMMARY, Task 1 RED Capture section)"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderLoading's generated record (recovery/LOADING.md) names both watch-loads.mjs and dump-artifacts.mjs at the consumer-installed location, never this repository's source tree"
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/watch-loads.test.mjs#renderLoading names both watch-loads.mjs and dump-artifacts.mjs at the consumer's installed location... (16-REVIEW.md CR-01 class)"
        status: pass
      - kind: other
        ref: "RED-then-GREEN demonstration against the real tree (this SUMMARY, Task 2 RED Capture section)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The generated acme.mjs new scaffold's ; Build: line, and acme-build/SKILL.md's generic reuse advice (16-REVIEW.md WR-03), both name the consumer-installed, Claude-Code-discoverable location; one frozen registry guard (skill-consumer-paths.test.ts) covers all four consumer-facing sites, each entry demonstrated to bite on a planted source-tree literal"
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-acme-build-cli.test.ts#the scaffold verb writes a `; Build:` line naming the consumer's installed location... (16-REVIEW.md CR-01 class); src/mcp/vice/skill-consumer-paths.test.ts (12 tests, all pass)"
        status: pass
      - kind: other
        ref: "Four plant-and-revert bite demonstrations against the real tree (this SUMMARY, Task 3 Bite Demonstrations section); git status --porcelain confirmed clean after each revert"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 10: Reverted CR-01 (consumer-path regression), plus a frozen four-entry registry guard against the class recurring

**Restored three consumer-installed-path literals in `renderLedger`/`anchor-search`, two in `renderLoading`, and two more (the `acme.mjs new` scaffold's `; Build:` line and `acme-build/SKILL.md`'s reuse advice) that a prior sweep had pointed at this repository's own source tree instead of a consumer's installed `.claude/skills/` directory -- then shipped `skill-consumer-paths.test.ts`, a frozen registry pinning all four sites with presence-of-consumer/absence-of-source-tree assertions, each demonstrated live to bite on a planted regression.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-08-23T02:35:00Z (approx.)
- **Completed:** 2026-08-23T03:45:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- `diff-images.mjs`'s `renderLedger()` regenerate-with comment, header prose pointer, and the `anchor-search` verb's `method:` field all restored to name `.claude/skills/c64-provenance-diff/scripts/diff-images.mjs` (the path `installer/bin/cli.mjs`'s `installSkills()` actually deploys to), not this repository's `src/skills/...` tree.
- The guarding comment at the `renderLedger` generation site -- self-contradictory since plan 16-04's sweep rewrote its own example alongside the literals it was protecting -- now contrasts two different roots again (`.claude/skills/...` vs `src/skills/...`) and names its own mechanical enforcement (`diff-images.test.mjs`, `skill-consumer-paths.test.ts`).
- `watch-loads.mjs`'s `renderLoading()` absence-as-evidence paragraph restored to name both `watch-loads.mjs` and `dump-artifacts.mjs` at the consumer-installed location; a JSDoc sentence added pointing at the enforcement rather than restating the literal.
- `template.a`'s `; Build:` line -- copied verbatim into every file `acme.mjs new` writes -- corrected to name the consumer-installed script path.
- `acme-build/SKILL.md`'s generic reuse advice (16-REVIEW.md **WR-03**) corrected to point at `.claude/skills/acme-build/` (the path Claude Code auto-discovers and `installSkills()` deploys to), with a one-clause rationale added; the file's in-repo developer routes (the `npm install`/`in-repo/plugin` dual-route block, the `from the repo root` quick-reference assignment) are untouched.
- `src/mcp/vice/skill-consumer-paths.test.ts`: a new, frozen four-entry registry guard covering all four sites above. Each entry pairs a presence check on the consumer form with an absence check on the source-tree form -- never a substring both satisfy -- and the one file that legitimately carries both forms (`acme-build/SKILL.md`) is region-scoped by a content anchor, never a line number. Four non-vacuity floors (entry-count >= 4, per-entry file-exists, per-entry required/forbidden non-empty, per-entry anchor-matches). Not added to `package.json`'s `files[]` -- the guard itself is not shipped.
- A new scaffold-consumer-path test added to `skill-acme-build-cli.test.ts`, scaffolding through the real `new` verb into a temp directory and reading what a user would actually get.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end -- renderLedger's generated ledger names the consumer's installed path** - `08d9e30` (fix)
2. **Task 2: renderLoading's generated record names the consumer's installed path** - `fef3705` (fix)
3. **Task 3: the scaffold, the reuse advice, and the class-level registry guard** - `612dccf` (fix)

## Files Created/Modified

- `src/skills/c64-provenance-diff/scripts/diff-images.mjs` - three consumer-path literals restored (regenerate-with comment, header prose pointer, `anchor-search`'s `method:` field); guarding comment repaired
- `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs` - new behavioural `renderLedger` consumer-path test
- `src/skills/c64-ram-capture/scripts/watch-loads.mjs` - two consumer-path literals restored in `renderLoading`'s absence-as-evidence paragraph; JSDoc enforcement pointer added
- `src/skills/c64-ram-capture/scripts/watch-loads.test.mjs` - new behavioural `renderLoading` consumer-path test
- `src/skills/acme-build/template.a` - `; Build:` line corrected (one line changed)
- `src/skills/acme-build/SKILL.md` - reuse-advice sentence corrected (16-REVIEW.md WR-03), rationale clause added
- `src/mcp/vice/skill-acme-build-cli.test.ts` - new generated-scaffold consumer-path test
- `src/mcp/vice/skill-consumer-paths.test.ts` - new: frozen four-entry consumer-path registry guard

## Decisions Made

- The `renderLedger` guarding comment was kept to 3 physical lines (restoring the original contrast plus a terse enforcement pointer) rather than the more verbose first draft, to satisfy the plan's own <=12-changed-line acceptance criterion for the whole `diff-images.mjs` diff.
- `skill-consumer-paths.test.ts` is a fixed registry, not a corpus scanner -- matches the plan's own instruction ("Hold a frozen registry of the consumer-facing sites") and is the right shape for four known, named, fixed-in-number sites, as opposed to `hop-chain-comments.test.ts`'s pattern-detector-over-a-corpus shape (appropriate there because the violation could recur anywhere in the module directory).
- The four plant-and-revert bite demonstrations were performed live via `sed`/`cp` round-trips rather than committed as tests (a committed plant-and-revert test would leave the working tree dirty between runs); recorded below as this task's non-vacuity evidence, per the plan's own instruction.

## Deviations from Plan

### Auto-fixed Issues

None - both fixes (the three-then-two-then-two literal restorations) were exactly what the plan specified, applied at the exact sites the plan's `read_first` and `key_links` named.

### Noted plan-measurement discrepancy (not a deviation, not auto-fixed -- reported for honesty)

**Task 3's acceptance criteria and the plan-level `<verification>` block both state `skill-acme-build-cli.test.ts` measured "18" tests before this task, and require "at least 19" (task) / "at least 19" (plan verification) after.** Measured directly against the pre-task commit (`git show HEAD~1:...` immediately before this plan's Task 3 edit, then confirmed again via `git stash`): the file had exactly **14** top-level tests before this task, all passing, 0 skipped, 0 failed (verified live: `node --test skill-acme-build-cli.test.ts` -> `# tests 14 / # pass 14 / # fail 0`). This plan's own new test brings it to **15** -- one higher than the true pre-task baseline (14), but not the "19" the plan's acceptance criteria state. `git log --oneline -- src/mcp/vice/skill-acme-build-cli.test.ts` shows exactly one prior commit (`8fb40ec`, plan 16-06), which already had 14 tests, so this is not a case of another plan silently removing tests since the "18" figure was written -- the "18"/"19" figures in `16-10-PLAN.md` appear to be a stale or miscounted measurement from plan-authoring time, not a regression this plan introduced or missed. Reported here rather than silently "corrected" or silently accepted, per this codebase's evidence-over-inherited-claims convention (see `15-04`'s WR-08/IN-03 precedent in STATE.md).

**Impact:** None on the acceptance criterion's actual intent (a scaffold-consumer-path test exists, is real, and passes) -- only on the literal numeric floor the plan cites. The `<= 18/19>` numbers are corrected here to the observed `14 -> 15`.

---

**Total deviations:** 0 auto-fixed. **Impact on plan:** None -- the one discrepancy above is a documentation/measurement note, not a functional deviation, and does not affect any acceptance criterion's substance.

## Task 1 RED Capture (renderLedger, before the literal fix)

Command: `node --test src/skills/c64-provenance-diff/scripts/diff-images.test.mjs` (new test added, literals still broken):

```
not ok (subtest 37) - renderLedger's generated ledger names the consumer's installed script location, never this repository's source-tree location (16-REVIEW.md CR-01 regression)
  error: 'renderLedger output must name the consumer-installed path ".claude/skills/c64-provenance-diff/scripts/diff-images.mjs" at least twice (regenerate-with comment + header prose pointer); found 0'
  code: 'ERR_ASSERTION'
1..43
# tests 43
# pass 41
# fail 1
```

**GREEN after the fix:** `# tests 43 / # pass 42 / # fail 0` (1 skipped, unrelated corpus-dependent test).

Live confirmation via the plan's own tracer `<verify>` one-liner (run against `renderLedger` directly, after the fix):
```
renderLedger output: consumer path x2, source-tree path x0
```

## Task 2 RED Capture (renderLoading, before the literal fix)

Command: `node --test src/skills/c64-ram-capture/scripts/watch-loads.test.mjs` (new test added, literal still broken):

```
not ok 25 - renderLoading names both watch-loads.mjs and dump-artifacts.mjs at the consumer's installed location, never this repository's source-tree location (16-REVIEW.md CR-01 class)
  error: 'renderLoading output must name the consumer-installed path for watch-loads.mjs'
  code: 'ERR_ASSERTION'
1..25
# tests 25
# pass 22
# fail 1
```

**GREEN after the fix:** `# tests 25 / # pass 23 / # fail 0`.

## Task 3 Bite Demonstrations (all four registry entries, planted then reverted)

Each entry: the consumer-form literal was temporarily overwritten with the source-tree form (via `sed`/file copy), `node --test src/mcp/vice/skill-consumer-paths.test.ts` was run, the failure was confirmed to name the correct file, then the file was restored from a pre-change backup copy and `git status --porcelain <file>` confirmed clean (or, for template.a/SKILL.md, confirmed to match this plan's own intended fixed state exactly, since those two files were not yet committed at plant time).

**1. `src/skills/c64-provenance-diff/scripts/diff-images.mjs`** (planted: `.claude/skills/c64-provenance-diff` -> `src/skills/c64-provenance-diff`):
```
not ok 5 - src/skills/c64-provenance-diff/scripts/diff-images.mjs: names the consumer-installed location (the provenance-diff generator (renderLedger + anchor-search's method: field))
  error: 'src/skills/c64-provenance-diff/scripts/diff-images.mjs must name the consumer-installed path ".claude/skills/c64-provenance-diff/scripts/diff-images.mjs" -- ...'
not ok 6 - src/skills/c64-provenance-diff/scripts/diff-images.mjs: never names this repository's source-tree location (the provenance-diff generator (renderLedger + anchor-search's method: field))
  error: 'src/skills/c64-provenance-diff/scripts/diff-images.mjs must NOT name this repository's source-tree path "src/skills/c64-provenance-diff/scripts/diff-images.mjs" -- ...'
```
Reverted; `git status --porcelain src/skills/c64-provenance-diff/scripts/diff-images.mjs` -> clean.

**2. `src/skills/c64-ram-capture/scripts/watch-loads.mjs`** (planted: `.claude/skills/c64-ram-capture` -> `src/skills/c64-ram-capture`):
```
not ok 7 - src/skills/c64-ram-capture/scripts/watch-loads.mjs: names the consumer-installed location (the RAM-capture watcher (renderLoading's absence-as-evidence paragraph))
not ok 8 - src/skills/c64-ram-capture/scripts/watch-loads.mjs: never names this repository's source-tree location (the RAM-capture watcher (renderLoading's absence-as-evidence paragraph))
```
Reverted; `git status --porcelain src/skills/c64-ram-capture/scripts/watch-loads.mjs` -> clean.

**3. `src/skills/acme-build/template.a`** (planted: line 2's `.claude/skills/acme-build` -> `src/skills/acme-build`):
```
not ok 9 - src/skills/acme-build/template.a: names the consumer-installed location (the assembly scaffold's `; Build:` line, copied verbatim into every user file by `acme.mjs new`)
not ok 10 - src/skills/acme-build/template.a: never names this repository's source-tree location (the assembly scaffold's `; Build:` line, copied verbatim into every user file by `acme.mjs new`)
```
Reverted (restored from pre-plant backup); `git diff -U0 src/skills/acme-build/template.a` afterward shows exactly this plan's own intended one-line fix (vs the pre-plan committed original), confirming the revert landed on the correct target state, not the planted one.

**4. `src/skills/acme-build/SKILL.md`** (planted: reuse-advice line 1's `.claude/skills/acme-build/scripts/` -> `src/skills/acme-build/scripts/`, line 2 left alone):
```
not ok 11 - src/skills/acme-build/SKILL.md: names the consumer-installed location (the acme-build playbook's generic reuse advice)
not ok 12 - src/skills/acme-build/SKILL.md: never names this repository's source-tree location (the acme-build playbook's generic reuse advice)
```
Reverted (restored from pre-plant backup); `git diff -U0 src/skills/acme-build/SKILL.md` afterward shows exactly this plan's own two-line intended fix.

`git status --porcelain` confirmed clean (no stray planted content) after all four reverts, before this plan's Task 3 commit.

## `docs-review-disposition.test.ts` / `audit-integrity.test.ts` Guard Status (16-REVIEW.md WR-03)

Per `16-09-SUMMARY.md`'s explicit handoff note: `16-REVIEW.md` carried exactly one open finding after plan 16-09 -- **WR-03**, "Generic reuse advice in `acme-build/SKILL.md` now points outside Claude Code's skill-discovery path" -- owned by this plan.

**Observed before this SUMMARY existed on disk** (Task 3's commit landed, this file not yet written): `docs-review-disposition.test.ts` red, naming WR-03 as the sole remaining undispositioned `16-REVIEW.md` id (matches 16-09-SUMMARY.md's prediction exactly). `audit-integrity.test.ts`'s D-12-02 test red as a downstream cascade of the same guard.

WR-03 is fixed at source in this plan's Task 3 (`acme-build/SKILL.md`'s reuse-advice sentence corrected, commit `612dccf`), and is dispositioned by this SUMMARY citing **WR-03** by name in the paragraph above -- this file sits in `16-REVIEW.md`'s own phase directory and is one of the guard's recognised disposition sources.

**Observed live, immediately after this SUMMARY's content was written to disk (commit not yet made):**

```
cd src/mcp/vice && node --test docs-review-disposition.test.ts
1..7
# tests 7
# pass 7
# fail 0
```

Zero undispositioned `16-REVIEW.md` findings remain. `audit-integrity.test.ts`'s D-12-02 test also confirmed green in the same run (see Full Baseline Gate below) -- the cascade resolved as 16-09-SUMMARY.md predicted.

## Full Baseline Gate (measured after this plan's three task commits, before the SUMMARY commit)

`cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` immediately after Task 3's commit (SUMMARY not yet on disk): **2386 tests, 2340 pass, 2 fail, 39 skipped, 5 todo, 24 suites** -- the 2 pre-existing failures (`docs-review-disposition.test.ts`, `audit-integrity.test.ts` D-12-02), exactly as predicted by 16-09-SUMMARY.md's "expected once this SUMMARY's own commit lands" note.

`cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` after this SUMMARY was written to disk (full re-run, not just the two named files): **2386 tests, 2342 pass, 0 fail, 39 skipped, 5 todo, 24 suites.** `docs-review-disposition.test.ts` (7/7 pass) and `audit-integrity.test.ts` (43/43 pass) both confirmed green individually and as part of the full run -- the measured baseline is fully green for the first time in this phase.

`cd src/mcp/vice && npm run typecheck`: exit 0.
`node scripts/check-npm-packages.mjs`: OK (`@henols/vice-mcp` 73 files, `@henols/c64-re-tools` 31 files/6 skills) -- the new guard test and the two new *.test.mjs assertions do not leak into either tarball.
`node scripts/check-skill-tool-coverage.mjs`: OK (37 `vice_*`, 10 `anno_*`).
`node scripts/check-skill-fork-honesty.mjs`: OK.
`bash scripts/package.sh`: OK, 984 files.
`node --test 'src/skills/*/scripts/*.test.mjs'`: 97 tests, `# fail 0` (up from the 95 measured at plan time, +2 from this plan's two new behavioural tests).
`cd src/mcp/vice && node --test skill-consumer-paths.test.ts`: 12 tests, `# fail 0`.
`cd src/mcp/vice && VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts`: 15 tests, `# fail 0` (see Deviations section for the "18/19" plan-measurement discrepancy).
Scaffold command line (plan verification item 6): `T=$(mktemp -d) && ACME= node src/skills/acme-build/scripts/acme.mjs new "$T/x.a" && grep '; Build:' "$T/x.a"` -> `; Build:  node .claude/skills/acme-build/scripts/acme.mjs build THIS.a` (consumer-installed location); `rm -rf "$T"`.

## Issues Encountered

None beyond the plan-measurement discrepancy documented above under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four CR-01-class consumer-path regressions reverted and mechanically guarded; `16-REVIEW.md`'s CR-01 (critical) and WR-03 findings both closed at source.
- `docs-review-disposition.test.ts` and `audit-integrity.test.ts` (D-12-02) confirmed green once this SUMMARY lands -- the full baseline should read `# fail 0` for plan 16-11 to pick up.
- Plan 16-11 (ledger close) can proceed against a fully green measured baseline.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*

## Self-Check: PASSED

All key files confirmed present on disk (`src/mcp/vice/skill-consumer-paths.test.ts`,
`src/skills/c64-provenance-diff/scripts/diff-images.mjs`, `src/skills/c64-ram-capture/scripts/watch-loads.mjs`,
`src/skills/acme-build/template.a`, `src/skills/acme-build/SKILL.md`, `src/mcp/vice/skill-acme-build-cli.test.ts`,
this SUMMARY). All three task commit hashes (`08d9e30`, `fef3705`, `612dccf`) confirmed in `git log`.
Every acceptance criterion in `16-10-PLAN.md` re-run live and recorded above with observed output, including
the honest "18/19 vs measured 14/15" discrepancy for `skill-acme-build-cli.test.ts` rather than a silently
adjusted number. `docs-review-disposition.test.ts` and `audit-integrity.test.ts` re-confirmed green in the
same live run that produced the full-suite `2386/2342/0/39/5` result recorded above -- not assumed from the
prediction in `16-09-SUMMARY.md`.
