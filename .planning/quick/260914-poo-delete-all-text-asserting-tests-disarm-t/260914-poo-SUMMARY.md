---
task: Delete all text-asserting tests and disarm their text-scanning CI checkers
date: 2026-09-14
status: complete
commits:
  - 276c15c9 test(260914-poo): delete 43 non-qualifying tests and module-classification.ts
  - 0b6c394e test(260914-poo): delete textmon-seam.test.ts, a fourth pinned-registry text-scanner
  - e4759250 ci(260914-poo): drop the four text-scanning skill checkers, the audit gate and their orphans
  - 85d13976 docs(260914-poo): retire the planning-vocabulary convention and drop deleted-enforcer citations
actuals:
  files_deleted: 60
  files_edited: 4
  tasks: 4
  commits: 4
---

# Summary

Only data-driven tests of production code remain. Every test that asserted on the TEXT
of documents, comments or CI scripts is deleted, along with the four text-scanning CI
checkers and everything those deletions orphaned. The planning-vocabulary convention is
retired outright. The suite exits 0 with an empty failing set.

## Scale

| | |
|---|---|
| Files deleted (`git rm`) | 60 |
| Files edited | 4 (`.github/workflows/ci.yml`, `CLAUDE.md`, `.planning/codebase/CONVENTIONS.md`, `260914-poo-PLAN.md`) |
| Commits | 4 |

The 60 deleted files break down as: 44 test files, 1 production module
(`module-classification.ts`), 4 skill-text checkers, 1 audit gate, 10 orphaned
`scripts/lib/` files.

## Before and after (compared as SETS, per the plan's own rule — never as counts)

**Baseline**, measured by the planner before this task: `tests 4432 | pass 4421 | fail 2 |
skipped 9 | EXIT=1`. The failing SET was exactly:
- `DIRECTION 9 (precision): every advisory line citation is verified by containment`
  (`module-classification.test.ts`)
- `no shipped file carries planning vocabulary beyond its pinned ratchet allowance`
  (`skills-planning-vocabulary.test.ts`)

**Final**, measured after all four commits: `tests 3765 | suites 21 | pass 3756 | fail 0 |
skipped 9 | EXIT=0`. The failing SET is empty. Both baseline failures are gone because
their files are gone.

`npm run typecheck` exits 0 at every checkpoint in this task — no deleted module left a
dangling import anywhere in the surviving tree.

## Scope addition found mid-execution: `textmon-seam.test.ts`

Task 1's own verify step surfaced a failure outside its planned scope after the first
44-file deletion landed: `textmon-seam.test.ts` (a surviving test, at the time) declared
the just-deleted `textmon-fixtures.test.ts` as a literal consumer in a hand-pinned owner
map, and the deletion tripped its own exact-set-equality assertion.

Per the plan's own instruction ("the new names are the finding. Report them and stop
rather than adjust an assertion"), execution paused and reported the finding rather than
patching the assertion or silently expanding Task 1's scope. The orchestrator reviewed
the evidence and authorized deleting `textmon-seam.test.ts` itself, as a fourth,
independently-qualifying member of set A, rather than editing it:

- Its complete import list is `node:test`, `node:assert/strict`, `node:fs`, `node:url`,
  `node:path`. It imports no production module.
- It executes no parser. It reads the five `textmon-*` parser modules' SOURCE with
  `readFileSync` and asserts on that text against a hand-declared owner map and a
  hand-pinned `TEXTMON_MODULE_FLOOR`.
- It carries 67 registry/pinned/declared/OWNERS/consumers mentions across 790 lines,
  against 12 in its closest sibling, `anno-seam.test.ts`.

Same shape as `module-classification.test.ts`, already in set A: a pinned registry
compared against disk. It failed D-1 (asserts on text) and D-2 (executes no production
code). Deleting it, rather than patching around it, ended the coupling entirely. No
surviving file needed an edit. This widened set A from 43 to 44 files (17,534 to 18,324
lines, 597 to 618 test declarations) and the total deletion count from 59 to 60. The
plan's own stated totals (frontmatter, objective, measured_baseline, success_criteria)
were updated in the same commit that deleted the file, so `260914-poo-PLAN.md` does not
carry stale numbers. `textmon-fixtures.ts`, the module, stays — only its test and
`textmon-seam.test.ts` went.

This is the only place a surviving file was found to reference a deleted file's name in
a load-bearing (non-comment) way. Every other basename from the deletion set was checked
against the whole surviving tree and found only in comments (see "Stale comments" below).

## Kept but now deliberately untested (accepted consequence of D-2, D-4, D-5)

Not a gap. Not future work. The user's own rule — only data-driven tests of production
code survive — means these modules lose their dedicated test file and stay that way:

`dxa-partition.ts`, `dxa-listing.ts`, `dxa-gate.ts`, `dxa-proof01-compare.ts`,
`shipped-modules.ts`, `test-gate.mjs`, `acme-gate.ts`, `binmon-fixtures.ts`,
`textmon-fixtures.ts`, `stock-schema-check.ts`, `ghidra-run.ts`,
`scripts/check-no-skill-external-spawn.mjs`.

`test-gate.mjs` still RUNS the suite (`automatedTestFiles()` reads the directory at run
time) and `shipped-modules.ts` is still imported by 20+ surviving tests. Both keep
working. Only their own tests are gone.

## Stale comments left in place, deliberately

These name a deleted artifact in prose only, with no runtime effect. Sweeping them was
out of scope, and two of the files are untouchable under this task's own constraints:

`scripts/lib/skill-corpus.mjs`, `installer/scripts/sync-skills.mjs`,
`src/mcp/vice/anno-tools.ts` (uncommitted user work, never touched),
`src/mcp/vice/anno-tools.test.ts`, `src/mcp/vice/anno-cli.ts` (shipped),
`src/mcp/vice/anno-cli.test.ts`, `src/mcp/vice/anno-cli-path-consumers.test.ts`,
`src/mcp/vice/anno-decomp-closure.test.ts`, `src/mcp/vice/dxa-seam.test.ts`,
`src/mcp/vice/anno-register.test.ts`, `docs/stock-vice-parity.md`, `.gitignore`.

`.planning/codebase/TESTING.md` is knowingly left stale — it enumerates deleted guards —
and is regenerated by `/gsd-map-codebase`. It was not touched.

## Planning-vocabulary convention: retired outright (D-6)

Both the source (`.planning/codebase/CONVENTIONS.md`) and its generated copy
(`CLAUDE.md`'s `## Comments` section) had the convention deleted — no note, seed, or
successor document created anywhere. Also dropped: the `CLAUDE.md` Constraints-section
citations crediting enforcement to `scripts/check-skill-capability-honesty.mjs` and
`spawn-seam.test.ts` (both now deleted). The underlying project constraints those
bullets describe (stock-tool honesty, argv-array spawn safety) stay untouched. Only the
now-false enforcement claims went. In `CONVENTIONS.md`, three more things went:

- The stale `scripts/*.mjs` guard roster (naming two checkers already gone before this
  task, plus the four just deleted), replaced with a sentence naming only the two guards
  that remain (`check-npm-packages.mjs`, `check-no-skill-external-spawn.mjs`).
- The `ci-suite-coverage.test.ts` citation.
- The entire "Comments are mechanically checked" block, which named only now-deleted
  test files.

## Correction to an earlier record

`scripts/lib/anno-cli-verbs.mjs` and `scripts/lib/anno-cli-invocations.mjs` were deleted
as measured orphans (each had exactly two real importers, one a set-C checker and one a
set-A test, both now gone). This corrects an earlier record that credited the SHIPPED
`anno-cli.ts` with importing the latter — that mention (line 435) is JSDoc prose, not an
import. `anno-cli.ts`'s actual import list (lines 124-178) contains no `scripts/lib/`
entry.

`scripts/lib/skill-corpus.mjs` survives on a single remaining importer,
`scripts/check-npm-packages.mjs` — one surviving importer is enough to keep a module.

## CI

`.github/workflows/ci.yml` had exactly four steps removed by name (never by line number,
since earlier deletions shifted every later line): "Validate skill tool coverage against
the stock manifest (Phase 5 criterion 5)", "Validate skill playbook and README
capability-honesty", "Validate skill description trigger uniqueness (Phase 19, ABS-03)",
"Validate documented anno CLI invocations argument-by-argument (REPOINT-01/02)". The
file still parses as valid YAML. Every remaining `node scripts/<file>` invocation
resolves to a file that exists. `check-npm-packages.mjs` and
`check-no-skill-external-spawn.mjs` both still run in CI and both exit 0 when invoked
directly.

## Constraints honored throughout

- The ASD-STE100 skill (`setup-claude-ste100.sh`, `~/.claude/skills/asd-ste100/`) was
  never touched — verified by a case-insensitive `git log` scan across every commit in
  this task.
- The user's in-flight uncommitted work (`anno-bank.ts`, `anno-coverage.ts`,
  `anno-enum-gen.ts`, `anno-tools.ts`, `.claude/settings.json`, and the three untracked
  files) was never staged, committed, or modified by any commit in this task — verified
  after every commit and again at the end.
- Every commit staged files by explicit path. No `git add -A`, `git add .`, or
  `git commit -a` was used anywhere.
- All 60 deletions used `git rm`. No file was truncated or emptied.
- No replacement test, guard, lint rule, doc note, or weaker assertion was written for
  anything deleted.

## Deviations from Plan

**1. [Rule 4 — architectural/scope, escalated per the plan's own stop-and-report clause]
Set A widened from 43 to 44 files mid-execution.**
- **Found during:** Task 1's own verify step, after its first commit.
- **Issue:** `textmon-seam.test.ts`, a surviving test, declared the just-deleted
  `textmon-fixtures.test.ts` in a pinned literal-consumer list, tripping two of its own
  assertions.
- **Resolution:** paused and reported per the plan's explicit instruction rather than
  patching the assertion. The orchestrator reviewed the measured evidence and authorized
  deleting `textmon-seam.test.ts` itself as a fourth qualifying member of set A (it
  independently fails D-1 and D-2 on the same evidence used for
  `module-classification.test.ts`), in its own commit with its own justification, plus an
  update to the plan's stated totals in that same commit.
- **Files affected:** `src/mcp/vice/textmon-seam.test.ts` (deleted),
  `260914-poo-PLAN.md` (totals updated).
- **Verification:** re-ran `npm run typecheck` and `npm run test:automated` after the
  deletion. The failing set was verified empty before continuing to Task 2.
- **Committed in:** `0b6c394e`.

No other deviations. The remaining three tasks executed as planned.

## Next steps

None. This was a deletion-and-retirement task with no follow-on work. The orchestrator
handles `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` updates and the final metadata
commit.

## Self-Check: PASSED

- All four commit hashes (`276c15c9`, `0b6c394e`, `e4759250`, `85d13976`) found in `git log`.
- `260914-poo-SUMMARY.md` exists on disk.
- `src/mcp/vice/textmon-seam.test.ts` verified deleted.
- `src/mcp/vice/textmon-fixtures.ts` verified kept.
