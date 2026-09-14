---
quick_id: 260914-poo
phase: quick-260914-poo
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260914-poo]

files_modified:
  - .github/workflows/ci.yml
  - CLAUDE.md
  - .planning/codebase/CONVENTIONS.md

files_deleted:
  # Set A: 43 test files (17,534 lines, 597 test declarations)
  - src/mcp/vice/docs-absorbed-decisions.test.ts
  - src/mcp/vice/docs-constraints-sync.test.ts
  - src/mcp/vice/docs-core-value-decision.test.ts
  - src/mcp/vice/docs-dangling-refs.test.ts
  - src/mcp/vice/docs-deferred-ledger.test.ts
  - src/mcp/vice/docs-fork-absence.test.ts
  - src/mcp/vice/docs-fork-decision.test.ts
  - src/mcp/vice/docs-review-disposition.test.ts
  - src/mcp/vice/docs-uat-abstention.test.ts
  - src/mcp/vice/docs-worktree-isolation.test.ts
  - src/mcp/vice/absorbed-answer-key.test.ts
  - src/mcp/vice/proof-evidence-integrity.test.ts
  - src/mcp/vice/comment-phase-pointers.test.ts
  - src/mcp/vice/hop-chain-comments.test.ts
  - src/mcp/vice/assumption-label-discipline.test.ts
  - src/mcp/vice/skills-planning-vocabulary.test.ts
  - src/mcp/vice/skill-basic-trigger.test.ts
  - src/mcp/vice/skill-consumer-paths.test.ts
  - src/mcp/vice/skill-description-overlap.test.ts
  - src/mcp/vice/skill-honesty-checks.test.ts
  - src/mcp/vice/ci-guardrails.test.mjs
  - src/mcp/vice/ci-suite-coverage.test.ts
  - src/mcp/vice/audit-integrity.test.ts
  - src/mcp/vice/skill-external-spawn-gate.test.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/module-classification.test.ts
  - src/mcp/vice/audit-root-args.test.ts
  - src/mcp/vice/acme-seam.test.ts
  - src/mcp/vice/spawn-seam.test.ts
  - src/mcp/vice/binmon-fixtures.test.ts
  - src/mcp/vice/dxa-partition.test.ts
  - src/mcp/vice/dxa-listing.test.ts
  - src/mcp/vice/dxa-build-gate.test.ts
  - src/mcp/vice/dxa-proof01-compare.test.ts
  - src/mcp/vice/dxa-gate.test.ts
  - src/mcp/vice/textmon-fixtures.test.ts
  - src/mcp/vice/telemetry-import.test.ts
  - src/mcp/vice/acme-gate.test.ts
  - src/mcp/vice/ghidra-harness-gates.test.ts
  - src/mcp/vice/stock-schema-check.test.ts
  - src/mcp/vice/test-gate.test.ts
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/d64-single-route.test.ts
  # Set B: the one module whose sole consumer was in set A
  - src/mcp/vice/module-classification.ts
  # Set C: the four text-scanning skill checkers
  - scripts/check-skill-capability-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/check-skill-cli-invocations.mjs
  # Set D: the audit gate whose only consumer was the deleted hook
  - scripts/audit-gate.mjs
  # Set E: the orphan cascade, each measured to zero surviving consumers
  - scripts/lib/audit-root.mjs
  - scripts/lib/audit-root.d.mts
  - scripts/lib/skill-descriptions.mjs
  - scripts/lib/skill-descriptions.d.mts
  - scripts/lib/skill-honesty-checks.mjs
  - scripts/lib/skill-honesty-checks.d.mts
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-invocations.d.mts
  - scripts/lib/anno-cli-verbs.mjs
  - scripts/lib/anno-cli-verbs.d.mts

estimate:
  tokens: 58000
  raw_tokens: 58000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "`npm run test:automated` in src/mcp/vice exits 0, and its failing-test name SET is empty."
    - "`npm run typecheck` in src/mcp/vice exits 0 — no surviving file imports a deleted module."
    - "Every `node scripts/<file>` invocation left in .github/workflows/ci.yml resolves to a file that exists."
    - ".github/workflows/ci.yml still parses as YAML and still runs check-npm-packages.mjs."
    - "No basename from the committed deletion set appears in CLAUDE.md or .planning/codebase/CONVENTIONS.md."
    - "The planning-vocabulary convention is absent from both CLAUDE.md and .planning/codebase/CONVENTIONS.md."
  artifacts:
    - .github/workflows/ci.yml
    - CLAUDE.md
    - .planning/codebase/CONVENTIONS.md
  key_links:
    - "scripts/lib/skill-corpus.mjs -> scripts/check-npm-packages.mjs (this is now its ONLY surviving importer, and it keeps the module alive)"
    - "scripts/check-no-skill-external-spawn.mjs -> scripts/check-npm-packages.mjs packFiles() (both survive, both stay wired in CI)"
    - "src/mcp/vice/shipped-modules.ts -> 20+ surviving tests still import it (keep it working)"
    - "src/mcp/vice/test-gate.mjs reads the directory at run time, so no list needs editing when tests disappear"
---

<objective>
Keep only data-driven tests of production code. Delete every other test, the
text-scanning CI checkers, and everything those deletions orphan. Retire the
planning-vocabulary convention.

Purpose: the repository carries a large body of tests that assert on the TEXT of
documents, comments and CI scripts rather than on the behaviour of shipped code.
Two of them are red right now against a correct tree. The user has decided that
no test may assert on text at all, and that only data-driven tests of production
code survive.

Output: 59 files deleted with `git rm`, 3 files edited, and a suite that exits 0
with an empty failing-test set.

Production code, for this plan, means exactly: the entries of
`src/mcp/vice/package.json` `files[]` (including `resources/`, whose `*.mjs` are
compiled from `*.mts` sources — those sources ARE production), plus
`src/skills/**`, which the installer package ships.
</objective>

<must_not_touch>
These are HARD boundaries. An executor that edits, stages, reverts, moves,
renames or references any item below has failed the task.

**The ASD-STE100 skill.** Leave byte-identical and unreferenced:
- `setup-claude-ste100.sh` (repo root, untracked)
- `~/.claude/skills/asd-ste100/` (outside this repository)
Nothing under `src/` or `scripts/` references ste100, so nothing in this plan
reaches it. Do not sweep it as incidental cleanup.

**The working tree the user already owns.** Never `git add`, `git commit`,
`git checkout` or `git restore` any of these:
- `.claude/settings.json`. The user emptied it to `{}` by hand. The
  `scripts/audit-gate.mjs --hook` PreToolUse entry is ALREADY gone. Do not
  re-add it, do not reference it, do not edit this file.
- `src/mcp/vice/anno-bank.ts`, `anno-coverage.ts`, `anno-enum-gen.ts`,
  `anno-tools.ts` (modified, uncommitted)
- `docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`,
  `setup-claude-ste100.sh` (untracked)

Stage files EXPLICITLY BY PATH in every commit. Never `git add -A`, never
`git add .`, never `git commit -a`.
</must_not_touch>

<decisions_locked>
These are settled. Do not re-litigate, do not propose a replacement guard, lint
rule, doc note, seed, weaker assertion, or any successor document.

- D-1: No test may assert on text at all.
- D-2: Only data-driven tests of production code are kept. The rest are deleted.
- D-3: All four `check-skill-*.mjs` CI checkers are dropped, including the two
  that carry ground truth.
- D-4: dxa — delete the tests, KEEP the modules.
- D-5: Test infrastructure — delete the tests, KEEP the modules.
- D-6: The planning-vocabulary convention is retired outright. Delete it from
  CLAUDE.md and from `.planning/codebase/CONVENTIONS.md`. Create NO note, seed
  or successor document.
</decisions_locked>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
</context>

<measured_baseline>
Measured by the planner against the live tree on 2026-09-14, at commit
`f3fe0567`. Re-check anything you act on.

**Set A, measured.** 43 files, 17,534 lines, 597 test declarations (every
`test(` or `it(` at any indent). Twenty-six of them assert on the TEXT of
documents, comments or CI scripts (D-1). The rest have a subject that is not
production code (D-2).

**Suite baseline.** `npm run test:automated` from `src/mcp/vice`:
`tests 4432 | pass 4421 | fail 2 | skipped 9 | duration ~145s | EXIT=1`.
The failing SET is exactly these two names, and both live in set A:
1. `DIRECTION 9 (precision): every advisory line citation is verified by containment`
   — from `module-classification.test.ts`
2. `no shipped file carries planning vocabulary beyond its pinned ratchet allowance`
   — from `skills-planning-vocabulary.test.ts`
Expected after this plan: EXIT=0 and an EMPTY failing set. Compare the SET.
Never compare a count, and never pin a count in an assertion.

**Why the two late additions to set A qualify.**
- `anno-cli-invocations.test.ts` (769 lines, 45 declarations): `spawnSync` count
  0, `SKILL.md` read count 7. It extracts documented `anno <verb> --flag`
  strings out of Markdown and asserts against them, which is a text assertion
  under D-1. Its subject, `scripts/check-skill-cli-invocations.mjs`, is already
  in set C. It also carries a pinned-integer floor case, the ratchet pattern
  being retired.
- `d64-single-route.test.ts` (278 lines, 7 declarations): `spawnSync` count 0,
  `SKILL.md` count 0. It walks shipped modules and skill scripts looking for a
  SOURCE PATTERN with planted synthetic violations. That is source-text
  scanning, and it executes no production code.

**Severability.** A full scan of every surviving `src/mcp/vice/*.test.*` found
no file that imports any set-A test file. Set A is severable. After the two late
additions, no surviving test reads any deleted artifact from disk either, so
this plan contains NO partial edit of a surviving test file.

**Set E, each entry measured to zero surviving consumers.**
- `audit-root`, `skill-descriptions`, `skill-honesty-checks`: their only
  remaining mentions are in COMMENTS (`installer/scripts/sync-skills.mjs`,
  `anno-decomp-closure.test.ts`, `dxa-seam.test.ts`,
  `scripts/lib/skill-corpus.d.mts`, `scripts/lib/skill-descriptions.d.mts`).
- `anno-cli-invocations.mjs`: its only two real importers were
  `scripts/check-skill-cli-invocations.mjs` (set C) and
  `anno-cli-invocations.test.ts` (set A). The SHIPPED `anno-cli.ts` does NOT
  import it — its line 435 is JSDoc prose, and the file's whole import list
  (lines 124-178) contains no `scripts/lib/` entry. `anno-cli.test.ts` lines
  847-848 are likewise a comment.
- `anno-cli-verbs.mjs`: its only two real importers were
  `scripts/check-skill-tool-coverage.mjs` (set C) and `anno-verb-coverage.test.ts`
  (set A). `anno-tools.test.ts:295` is a comment. `anno-cli-path-consumers.test.ts:97`
  is a comment that says outright "A copy rather than an import because that
  module lives under `scripts/lib/`".

**`scripts/lib/skill-corpus.mjs` SURVIVES.** After set A and set C its only
remaining real importer is `scripts/check-npm-packages.mjs`, which stays and
whose CI step stays. One surviving importer is enough. Keep the `.d.mts` too.

**`test-gate.mjs` needs no edit.** `automatedTestFiles()` reads the directory at
run time and filters by `MANUAL_ONLY_TESTS`. None of its 12 entries is in set A,
so deleted files simply vanish from the run set.

**`shipped-modules.ts` STAYS and stays live.** Over twenty surviving tests still
import it, including `anno-index.test.ts`, `anno-derive.test.ts`,
`anno-types.test.ts`, `anno-seam.test.ts`, `anno-coverage.test.ts` and
`stock-dispatch.test.ts`.

**`scripts/check-no-skill-external-spawn.mjs` SURVIVES** and its CI step
(SEAM-05) stays. Only its test (`skill-external-spawn-gate.test.ts`) goes.

**Typecheck scope.** `src/mcp/vice/tsconfig.json` includes `**/*.ts` and
`**/*.mts` relative to `src/mcp/vice` only. There is no repo-root tsconfig, so
`scripts/lib/*.d.mts` are reached only through test imports.
</measured_baseline>

<must_survive>
Checked to keep real consumers. Do not delete, do not edit:
- `scripts/lib/skill-corpus.mjs` + `.d.mts` — kept alive by
  `scripts/check-npm-packages.mjs`, now its only importer
- `scripts/check-npm-packages.mjs` and its CI step
- `scripts/check-no-skill-external-spawn.mjs` + `.d.mts` and its CI step
- `src/mcp/vice/shipped-modules.ts` — imported by 20+ surviving tests
- `src/mcp/vice/ghidra-project.test.ts` — `ghidra-project.mts` compiles to
  `resources/ghidra-project.mjs`, and `resources` IS in `files[]`
- `src/mcp/vice/skill-acme-build-cli.test.ts`,
  `skill-memory-mapping-cli.test.ts`, `skill-program-recon-cli.test.ts` —
  these subprocess-test SHIPPED skill scripts
- `src/mcp/vice/anno-cli.test.ts`, `anno-cli-path-consumers.test.ts`,
  `anno-tools.test.ts` — these exercise SHIPPED modules and only MENTION a
  deleted lib in comments. Do not edit them.
</must_survive>

<accepted_consequences>
State these in SUMMARY.md. Do NOT correct them, and do NOT write replacement
tests or guards for them.

**Kept but now untested** — expected and accepted:
`dxa-partition.ts`, `dxa-listing.ts`, `dxa-gate.ts`, `dxa-proof01-compare.ts`,
`shipped-modules.ts`, `test-gate.mjs`, `acme-gate.ts`, `binmon-fixtures.ts`,
`textmon-fixtures.ts`, `stock-schema-check.ts`, `ghidra-run.ts`,
`scripts/check-no-skill-external-spawn.mjs`.
`test-gate.mjs` still RUNS the suite and `shipped-modules.ts` is still imported
by surviving tests. Both must keep working. Only their tests go.

**Stale comments left in place, deliberately.** These name a deleted artifact in
prose only, with no runtime effect. Sweeping them is unbounded scope and two of
them are untouchable files:
`scripts/lib/skill-corpus.mjs`, `installer/scripts/sync-skills.mjs`,
`src/mcp/vice/anno-tools.ts` (UNCOMMITTED — never touch),
`src/mcp/vice/anno-tools.test.ts`, `src/mcp/vice/anno-cli.ts` (SHIPPED),
`src/mcp/vice/anno-cli.test.ts`, `src/mcp/vice/anno-cli-path-consumers.test.ts`,
`src/mcp/vice/anno-decomp-closure.test.ts`, `src/mcp/vice/dxa-seam.test.ts`,
`src/mcp/vice/anno-register.test.ts`, `docs/stock-vice-parity.md`, `.gitignore`.

**`.planning/codebase/TESTING.md` is out of scope.** It enumerates deleted
guards and will be stale. `/gsd-map-codebase` regenerates it. Leave it.
</accepted_consequences>

<verification_rules>
These standing project rules apply to EVERY `<verify>` block in this plan. They
stated verbatim so an executor cannot paraphrase them away.

1. Run `npm run test:automated` from `src/mcp/vice`. **NEVER pipe it to `tail`
   or `head`** — a pipe reports the PIPE's exit status and fakes a green run.
   **Redirect to a file and read `$?` on the SAME line.**
2. **Compare the failing SET against the baseline set, never a count.**
3. Run `npm run typecheck` from `src/mcp/vice`. No deleted module may leave a
   dangling import.
4. Check that `.github/workflows/ci.yml` still parses as YAML.
5. **Do NOT pin any magic number in an assertion or in a `<verify>` block.**
   Compare sets and relations.

Before the first task, create the log directory and record the pre-change commit
so every later range query is anchored and cannot drift:
`mkdir -p /tmp/gsd-260914-poo && git rev-parse HEAD > /tmp/gsd-260914-poo/base-sha.txt`

The failing-set extraction, used unchanged everywhere below:
`grep -E '^✖ ' LOG | grep -v '^✖ failing tests:' | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | sort -u`
</verification_rules>

<!-- planner-discipline-allow: Planning vocabulary -->
<!-- planner-discipline-allow: check-skill-capability-honesty.mjs -->
<!-- planner-discipline-allow: check-skill-tool-coverage.mjs -->
<!-- planner-discipline-allow: check-skill-description-overlap.mjs -->
<!-- planner-discipline-allow: check-skill-cli-invocations.mjs -->
<!-- planner-discipline-allow: audit-gate.mjs -->
<!-- planner-discipline-allow: spawn-seam.test.ts -->
<!-- planner-discipline-allow: skills-planning-vocabulary.test.ts -->
<!-- planner-discipline-allow: ci-suite-coverage.test.ts -->

<tasks>

<task type="tracer">
  <name>Task 1: Delete the 43 non-qualifying test files and the one module they solely supported, and prove the tree end-to-end</name>
  <files>
src/mcp/vice/docs-absorbed-decisions.test.ts, src/mcp/vice/docs-constraints-sync.test.ts,
src/mcp/vice/docs-core-value-decision.test.ts, src/mcp/vice/docs-dangling-refs.test.ts,
src/mcp/vice/docs-deferred-ledger.test.ts, src/mcp/vice/docs-fork-absence.test.ts,
src/mcp/vice/docs-fork-decision.test.ts, src/mcp/vice/docs-review-disposition.test.ts,
src/mcp/vice/docs-uat-abstention.test.ts, src/mcp/vice/docs-worktree-isolation.test.ts,
src/mcp/vice/absorbed-answer-key.test.ts, src/mcp/vice/proof-evidence-integrity.test.ts,
src/mcp/vice/comment-phase-pointers.test.ts, src/mcp/vice/hop-chain-comments.test.ts,
src/mcp/vice/assumption-label-discipline.test.ts, src/mcp/vice/skills-planning-vocabulary.test.ts,
src/mcp/vice/skill-basic-trigger.test.ts, src/mcp/vice/skill-consumer-paths.test.ts,
src/mcp/vice/skill-description-overlap.test.ts, src/mcp/vice/skill-honesty-checks.test.ts,
src/mcp/vice/ci-guardrails.test.mjs, src/mcp/vice/ci-suite-coverage.test.ts,
src/mcp/vice/audit-integrity.test.ts, src/mcp/vice/skill-external-spawn-gate.test.ts,
src/mcp/vice/anno-verb-coverage.test.ts, src/mcp/vice/module-classification.test.ts,
src/mcp/vice/audit-root-args.test.ts, src/mcp/vice/acme-seam.test.ts,
src/mcp/vice/spawn-seam.test.ts, src/mcp/vice/binmon-fixtures.test.ts,
src/mcp/vice/dxa-partition.test.ts, src/mcp/vice/dxa-listing.test.ts,
src/mcp/vice/dxa-build-gate.test.ts, src/mcp/vice/dxa-proof01-compare.test.ts,
src/mcp/vice/dxa-gate.test.ts, src/mcp/vice/textmon-fixtures.test.ts,
src/mcp/vice/telemetry-import.test.ts, src/mcp/vice/acme-gate.test.ts,
src/mcp/vice/ghidra-harness-gates.test.ts, src/mcp/vice/stock-schema-check.test.ts,
src/mcp/vice/test-gate.test.ts, src/mcp/vice/anno-cli-invocations.test.ts,
src/mcp/vice/d64-single-route.test.ts, src/mcp/vice/module-classification.ts
  </files>
  <action>
Before anything else, run the two commands in `verification_rules` that create
`/tmp/gsd-260914-poo` and write `base-sha.txt`. Later tasks depend on that file.

This task is the thin end-to-end slice: it carries the largest and riskiest
deletion, and it proves the whole approach against both gates (suite and
typecheck) before any other file is touched. Do it first.

Delete all 44 files listed above with a single `git rm` invocation. Use
`git rm`, never truncation, never `rm`, never an edit that empties a file.

Twenty-six of the 43 tests assert on the TEXT of documents, comments or CI
scripts (D-1). The rest have a subject that is not production code (D-2).
`module-classification.ts` goes with them because its only real import anywhere
was `module-classification.test.ts`: it is absent from `package.json` `files[]`,
`anno-register.ts` names it in three COMMENTS only and does not import it, and
after set A it has zero consumers. It is the ONE production-tree module this
plan deletes — D-4 and D-5 keep every other module, because those either have
surviving consumers or plausible use, and this one has neither.

Do not edit `test-gate.mjs`. `automatedTestFiles()` reads the directory at run
time, and no `MANUAL_ONLY_TESTS` entry is in this set.

Do not edit any surviving test file. This set is fully severable, so no
surviving test needs a partial edit.

Do not create a replacement test for anything deleted here.

Commit with an explicit path list. Do not use `git add -A` or `git commit -a`,
and do not stage any file named in the must_not_touch block.
Commit message: `test(260914-poo): delete 43 non-qualifying tests and module-classification.ts`
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools
# (a) the committed deletion set equals the intended set in BOTH directions
git show --diff-filter=D --name-only --format= HEAD | sort -u > /tmp/gsd-260914-poo/t1-actual.txt
diff <(sort -u /tmp/gsd-260914-poo/t1-intended.txt) /tmp/gsd-260914-poo/t1-actual.txt && echo "SET-EQUAL"
# (b) nothing from the must_not_touch list was staged by this commit
git show --name-only --format= HEAD | grep -E '^(\.claude/settings\.json|docs/dissambler-workflow\.md|docs/vice-mcp-ideas\.md|setup-claude-ste100\.sh|src/mcp/vice/anno-(bank|coverage|enum-gen|tools)\.ts)$' && echo "FORBIDDEN-FILE-STAGED" || echo "no-forbidden-files"
# (c) no surviving test file was modified by this commit -- deletions only, plus nothing else
git show --diff-filter=M --name-only --format= HEAD | grep . && echo "UNEXPECTED-MODIFICATION" || echo "deletions-only"
# (d) typecheck: no surviving file imports a deleted module. NEVER pipe to tail/head; read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run typecheck > /tmp/gsd-260914-poo/t1-typecheck.log 2>&1; echo "TYPECHECK_EXIT=$?"
# (e) suite: NEVER pipe to tail/head. Redirect to a file and read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run test:automated > /tmp/gsd-260914-poo/t1-test.log 2>&1; echo "TEST_EXIT=$?"
# (f) compare the failing SET, never a count. Expect EMPTY.
grep -E '^✖ ' /tmp/gsd-260914-poo/t1-test.log | grep -v '^✖ failing tests:' | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | sort -u > /tmp/gsd-260914-poo/t1-failing-set.txt
echo "--- failing set (expect empty) ---"; cat /tmp/gsd-260914-poo/t1-failing-set.txt; echo "--- end ---"
    </automated>
  </verify>
  <done>
Write the 44 intended paths to `/tmp/gsd-260914-poo/t1-intended.txt` (one per
line) before you run the check, taking them verbatim from this task's `files`
list. Then all of these are true:
- `SET-EQUAL` prints.
- `no-forbidden-files` prints.
- `deletions-only` prints.
- `TYPECHECK_EXIT=0`.
- `TEST_EXIT=0`.
- The failing set is EMPTY. The two baseline failures named in
  `measured_baseline` are gone because their files are gone.
If the failing set is non-empty, the new names are the finding. Report them and
stop rather than adjust an assertion.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete the four text-scanning checkers, the audit gate, the ten-file orphan cascade, and their four CI steps</name>
  <files>
scripts/check-skill-capability-honesty.mjs, scripts/check-skill-tool-coverage.mjs,
scripts/check-skill-description-overlap.mjs, scripts/check-skill-cli-invocations.mjs,
scripts/audit-gate.mjs,
scripts/lib/audit-root.mjs, scripts/lib/audit-root.d.mts,
scripts/lib/skill-descriptions.mjs, scripts/lib/skill-descriptions.d.mts,
scripts/lib/skill-honesty-checks.mjs, scripts/lib/skill-honesty-checks.d.mts,
scripts/lib/anno-cli-invocations.mjs, scripts/lib/anno-cli-invocations.d.mts,
scripts/lib/anno-cli-verbs.mjs, scripts/lib/anno-cli-verbs.d.mts,
.github/workflows/ci.yml
  </files>
  <precondition>Task 1 is committed and its check passed. The working tree is clean apart from the must_not_touch files.</precondition>
  <action>
Both changes MUST land in ONE commit. Any partial application leaves CI red,
because the checkers cannot be deleted while CI still invokes them.

**(1) `git rm` the fifteen script files listed above.** The four checkers go per
D-3, including the two that carry ground truth. The user was shown that split
and chose to drop all four. `audit-gate.mjs` goes because its only consumer was
the PreToolUse hook the user has ALREADY deleted from `.claude/settings.json`,
and because it carries a frozen `DOCS_GUARD_FLOOR` and a frozen registry of
`docs-*.test.ts` files that Task 1 deleted, so it cannot pass.

The ten `scripts/lib/` files go because each was measured to zero surviving
consumers. Read the `measured_baseline` block for the per-file evidence before
you delete them. In particular, the SHIPPED `anno-cli.ts` does NOT import
`scripts/lib/anno-cli-invocations.mjs` — its only mention is JSDoc prose at line
435 — and `anno-cli-path-consumers.test.ts` says outright in a comment that it
holds "A copy rather than an import" of the `anno-cli-verbs.mjs` helper. Do not
edit either of those files. Their mentions are prose and have no runtime effect.

Do NOT delete `scripts/lib/skill-corpus.mjs` or its `.d.mts`. After every other
deletion, `scripts/check-npm-packages.mjs` still imports it, and one surviving
importer is enough to keep it. Do NOT delete `scripts/check-npm-packages.mjs` or
`scripts/check-no-skill-external-spawn.*`.

**(2) Edit `.github/workflows/ci.yml`: delete exactly four steps.** Delete each
step's `- name:` line, its `run:` line, and any comment block that exists only
to explain that step. Line numbers WILL SHIFT as you edit — re-locate each step
by its name string, never by number. The four names:
  "Validate skill tool coverage against the stock manifest (Phase 5 criterion 5)"
  "Validate skill playbook and README capability-honesty"
  "Validate skill description trigger uniqueness (Phase 19, ABS-03)"
  "Validate documented anno CLI invocations argument-by-argument (REPOINT-01/02)"
The file must remain valid YAML. The "Validate npm package contents" step and
the "No skill script reaches a host binary directly (SEAM-05)" step both STAY,
and so does the "Generate the shipped skills tree" step that precedes them.

Do not write a replacement for any deleted check.

Commit with an explicit path list. Do not use `git add -A` or `git commit -a`.
Commit message: `ci(260914-poo): drop the four text-scanning skill checkers, the audit gate and their orphans`
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools
# (a) every `node scripts/<file>` invocation left in CI resolves to a real file (one step runs from installer/)
for s in $(grep -oE 'node scripts/[A-Za-z0-9._-]+' .github/workflows/ci.yml | awk '{print $2}' | sort -u); do test -f "$s" -o -f "installer/$s" || echo "DANGLING $s"; done; echo "ci-script-probe-done"
# (b) ci.yml still parses as YAML, and check-npm-packages is still wired
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML-OK')"
grep -q 'check-npm-packages' .github/workflows/ci.yml && echo "npm-packages-step-present"
# (c) nothing from the must_not_touch list was staged by this commit
git show --name-only --format= HEAD | grep -E '^(\.claude/settings\.json|docs/dissambler-workflow\.md|docs/vice-mcp-ideas\.md|setup-claude-ste100\.sh|src/mcp/vice/anno-(bank|coverage|enum-gen|tools)\.ts)$' && echo "FORBIDDEN-FILE-STAGED" || echo "no-forbidden-files"
# (d) ci.yml is the ONLY file this commit modified
git show --diff-filter=M --name-only --format= HEAD | grep -v '^\.github/workflows/ci\.yml$' | grep . && echo "UNEXPECTED-MODIFICATION" || echo "only-ci-yml-modified"
# (e) no surviving source, script or test file still IMPORTS or READS a deleted scripts/lib module
grep -rn "lib/audit-root.mjs\|lib/skill-descriptions.mjs\|lib/skill-honesty-checks.mjs\|lib/anno-cli-invocations.mjs\|lib/anno-cli-verbs.mjs" --include=*.ts --include=*.mts --include=*.mjs . 2>/dev/null | grep -v node_modules | grep -v '^\./\.planning' | grep -E 'readFileSync|existsSync|^[^:]+:[0-9]+:import|^[^:]+:[0-9]+:\} from|spawn|execFile' && echo "LIVE-REFERENCE-REMAINS" || echo "no-live-references"
# (f) typecheck. NEVER pipe to tail/head; read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run typecheck > /tmp/gsd-260914-poo/t2-typecheck.log 2>&1; echo "TYPECHECK_EXIT=$?"
# (g) suite. NEVER pipe to tail/head. Redirect to a file and read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run test:automated > /tmp/gsd-260914-poo/t2-test.log 2>&1; echo "TEST_EXIT=$?"
grep -E '^✖ ' /tmp/gsd-260914-poo/t2-test.log | grep -v '^✖ failing tests:' | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | sort -u > /tmp/gsd-260914-poo/t2-failing-set.txt
echo "--- failing set (expect empty) ---"; cat /tmp/gsd-260914-poo/t2-failing-set.txt; echo "--- end ---"
    </automated>
  </verify>
  <done>
All of these are true:
- `ci-script-probe-done` prints with no `DANGLING` line above it.
- `YAML-OK` prints.
- `npm-packages-step-present` prints.
- `no-forbidden-files` prints.
- `only-ci-yml-modified` prints.
- `no-live-references` prints.
- `TYPECHECK_EXIT=0`.
- `TEST_EXIT=0`.
- The failing set is EMPTY.
  </done>
</task>

<task type="auto">
  <name>Task 3: Retire the planning-vocabulary convention and every citation of a deleted enforcer from the two convention documents</name>
  <files>CLAUDE.md, .planning/codebase/CONVENTIONS.md</files>
  <precondition>Tasks 1 and 2 are committed, so the deletion set is final and can be derived from git history using the recorded base SHA.</precondition>
  <action>
`.planning/codebase/CONVENTIONS.md` is the SOURCE and `CLAUDE.md`'s
`## Comments` section is GENERATED from it by `/gsd-map-codebase` (see the
`<!-- GSD:conventions-end -->` marker). That regeneration is how this convention
decayed back in before, so BOTH files must be edited or the next map run
restores it. Per D-6, create NO note, seed, successor document or replacement
rule anywhere. Delete the text and stop.

**In `CLAUDE.md`, three edits:**
1. In the `## Comments` bullet list (near the end, around lines 160-161), delete
   BOTH bullets: the one beginning "**Planning vocabulary stays inside
   `.planning/`**", and the follow-on bullet beginning "The one surviving
   citation form is a decision id that resolves OUTSIDE `.planning/`". Leave the
   three bullets above them, and the rest of `## Comments`, intact.
2. In the Constraints section, in the `- **Compatibility**:` bullet that begins
   "The stdio MCP surface advertises only the tools this project actually
   implements against stock VICE" (around line 26), delete only its final
   sentence, which credits enforcement to a checker Task 2 deleted. Keep the
   whole rest of the bullet, including the `docs/stock-hard-losses.md` pointer.
3. In the Constraints section, in the `- **Architecture**:` bullet about the
   argv-array spawn rule (around line 48), delete the enforcement clause that
   begins with the name of a test Task 1 deleted and runs to the end of the
   bullet. End the bullet after "...removed when backend detection collapsed to
   a single stock target." The spawn rule itself is a real project constraint
   and STAYS. Only the claim that a now-deleted test enforces it goes.

**In `.planning/codebase/CONVENTIONS.md`, four edits:**
1. Around line 25-27, the sentence "Repo-level guards live in `scripts/*.mjs`
   (...) and are proven by test files under `src/mcp/vice/`." — its list names
   four files that no longer exist (two were already stale before this plan).
   Replace the whole sentence with one that names only the two guards that
   actually remain: `check-npm-packages.mjs` and
   `check-no-skill-external-spawn.mjs`. Drop the "and are proven by test files
   under `src/mcp/vice/`" clause, because their tests are gone.
2. Around line 197, in the bullet "What the file deliberately does NOT do, and
   why the cheaper alternative was rejected", delete only the parenthetical
   example that cites a test Task 1 deleted. Keep the bullet.
3. Around lines 199-214, delete the entire paragraph beginning "**Planning
   vocabulary does NOT belong in these comments.**", the entire follow-on
   paragraph beginning "The one citation that survives is a decision id", AND
   the entire "NOTE FOR A FUTURE `/gsd-map-codebase` RUN:" paragraph that
   defends them. All three exist only to carry the retired convention.
4. Around lines 216-223, delete the entire "**Comments are mechanically
   checked.**" block: its lead sentence, all four bullets, and the trailing
   "See TESTING.md for the full documentation-guard set." line. Every test it
   names is deleted, and one of them (`docs-linerefs.test.ts`) was already
   absent before this plan.

Both files must remain well-formed Markdown with no orphaned bullet, no doubled
blank line where a paragraph was deleted, and no dangling sentence fragment.

Commit with an explicit path list. Do not use `git add -A` or `git commit -a`.
Commit message: `docs(260914-poo): retire the planning-vocabulary convention and drop deleted-enforcer citations`
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools
# (a) no basename from the committed deletion set is still named in either document.
#     The name list is DERIVED from git across the whole change, anchored on the recorded
#     base SHA, so it cannot drift from what was actually deleted.
BASE=$(cat /tmp/gsd-260914-poo/base-sha.txt)
git log --diff-filter=D --name-only --format= "$BASE"..HEAD | grep -v '^$' | xargs -n1 basename 2>/dev/null | sort -u > /tmp/gsd-260914-poo/t3-deleted-basenames.txt
: > /tmp/gsd-260914-poo/t3-stale.txt
while read -r b; do grep -aq -- "$b" CLAUDE.md .planning/codebase/CONVENTIONS.md && echo "STALE-REF $b" >> /tmp/gsd-260914-poo/t3-stale.txt; done < /tmp/gsd-260914-poo/t3-deleted-basenames.txt
echo "--- stale references (expect empty) ---"; cat /tmp/gsd-260914-poo/t3-stale.txt; echo "--- end ---"
# (b) the retired convention is absent from both documents
grep -aic 'planning vocabulary' CLAUDE.md .planning/codebase/CONVENTIONS.md
# (c) both documents still parse as Markdown with a sane heading structure and no empty bullet
grep -n '^- *$\|^  - *$' CLAUDE.md .planning/codebase/CONVENTIONS.md && echo "EMPTY-BULLET-FOUND" || echo "no-empty-bullets"
grep -c '^#' CLAUDE.md; grep -c '^#' .planning/codebase/CONVENTIONS.md
# (d) nothing from the must_not_touch list was staged by this commit
git show --name-only --format= HEAD | grep -E '^(\.claude/settings\.json|docs/dissambler-workflow\.md|docs/vice-mcp-ideas\.md|setup-claude-ste100\.sh|src/mcp/vice/anno-(bank|coverage|enum-gen|tools)\.ts)$' && echo "FORBIDDEN-FILE-STAGED" || echo "no-forbidden-files"
    </automated>
  </verify>
  <done>
All of these are true:
- The stale-reference list is EMPTY.
- Step (b) reports `0` for BOTH files.
- `no-empty-bullets` prints.
- Both heading counts are non-zero.
- `no-forbidden-files` prints.
If step (a) reports a `STALE-REF`, the named document still cites a file this
plan deleted. Delete that citation. Do not weaken the check.
  </done>
</task>

<task type="auto">
  <name>Task 4: Prove the whole change end-to-end from a clean tree and record the consequences</name>
  <files>.planning/quick/260914-poo-delete-all-text-asserting-tests-disarm-t/260914-poo-SUMMARY.md</files>
  <precondition>Tasks 1, 2 and 3 are committed, and /tmp/gsd-260914-poo/base-sha.txt still holds the pre-change commit.</precondition>
  <action>
Re-run every gate once more over the final tree, so the result is proven against
the combined change rather than against three partial states.

Then write `260914-poo-SUMMARY.md` in this plan's directory. It must record, as
plain statements of fact:
- the total count of files deleted, and the three files edited.
- the measured before and after: the baseline failing SET (two named tests) and
  the final failing SET (expected empty), compared as SETS, with no count pinned
  as an assertion.
- the full "kept but now untested" list from `accepted_consequences`, stated as
  an accepted consequence of D-2, D-4 and D-5. NOT as a gap, and NOT as future
  work.
- the stale-comment list from `accepted_consequences`, stated as deliberate.
- that `.planning/codebase/TESTING.md` is knowingly left stale and is
  regenerated by `/gsd-map-codebase`.
- that the planning-vocabulary convention is retired outright per D-6, with no
  note, seed or successor document created.
- that `scripts/lib/anno-cli-verbs.mjs` and `scripts/lib/anno-cli-invocations.mjs`
  were deleted as measured orphans, correcting an earlier record that credited
  the SHIPPED `anno-cli.ts` with importing the latter. That mention is JSDoc
  prose, not an import.
- that `scripts/lib/skill-corpus.mjs` survives on a single remaining importer,
  `scripts/check-npm-packages.mjs`.

Do NOT update `ROADMAP.md`. Do NOT create any note, doc, seed, replacement test
or replacement guard.

Commit with an explicit path list. Do not use `git add -A` or `git commit -a`.
Commit message: `docs(260914-poo): record the deletion result and its accepted consequences`
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools
# (a) typecheck. NEVER pipe to tail/head; read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run typecheck > /tmp/gsd-260914-poo/final-typecheck.log 2>&1; echo "TYPECHECK_EXIT=$?"
# (b) suite. NEVER pipe to tail/head. Redirect to a file and read $? on the SAME line.
cd /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice && npm run test:automated > /tmp/gsd-260914-poo/final-test.log 2>&1; echo "TEST_EXIT=$?"
# (c) compare the failing SET against the baseline SET, never a count
grep -E '^✖ ' /tmp/gsd-260914-poo/final-test.log | grep -v '^✖ failing tests:' | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | sort -u > /tmp/gsd-260914-poo/final-failing-set.txt
echo "--- final failing set (expect empty) ---"; cat /tmp/gsd-260914-poo/final-failing-set.txt; echo "--- end ---"
# (d) CI is coherent: valid YAML, every script invocation resolves, both surviving gates run green
cd /home/henrik/dev/henrik/git/c64-re-tools && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML-OK')"
for s in $(grep -oE 'node scripts/[A-Za-z0-9._-]+' .github/workflows/ci.yml | awk '{print $2}' | sort -u); do test -f "$s" -o -f "installer/$s" || echo "DANGLING $s"; done; echo "ci-script-probe-done"
node scripts/check-npm-packages.mjs > /tmp/gsd-260914-poo/final-npm-packages.log 2>&1; echo "NPM_PACKAGES_EXIT=$?"
node scripts/check-no-skill-external-spawn.mjs > /tmp/gsd-260914-poo/final-spawn-gate.log 2>&1; echo "SPAWN_GATE_EXIT=$?"
# (e) the user's own working-tree files are untouched by this whole plan
git status --porcelain .claude/settings.json src/mcp/vice/anno-bank.ts src/mcp/vice/anno-coverage.ts src/mcp/vice/anno-enum-gen.ts src/mcp/vice/anno-tools.ts docs/dissambler-workflow.md docs/vice-mcp-ideas.md setup-claude-ste100.sh
echo "--- the seven lines above must still show the SAME M/?? states the plan recorded ---"
# (f) the ASD-STE100 skill was never reached, across the WHOLE change
BASE=$(cat /tmp/gsd-260914-poo/base-sha.txt)
git log --name-only --format= "$BASE"..HEAD | grep -i 'ste100' && echo "STE100-TOUCHED" || echo "ste100-untouched"
    </automated>
  </verify>
  <done>
All of these are true:
- `TYPECHECK_EXIT=0`.
- `TEST_EXIT=0`.
- The final failing set is EMPTY.
- `YAML-OK` prints.
- `ci-script-probe-done` prints with no `DANGLING` line.
- `NPM_PACKAGES_EXIT=0`.
- `SPAWN_GATE_EXIT=0`.
- `setup-claude-ste100.sh` is still listed as untracked, and the four
  `anno-*.ts` files are still listed as modified, unchanged from the states
  recorded in `must_not_touch`.
- `ste100-untouched` prints.
- `260914-poo-SUMMARY.md` exists and records every item the action lists.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo -> npm registry | `check-npm-packages.mjs` is the only remaining gate on published tarball contents. It SURVIVES. |
| repo -> plugin users | `src/skills/**` ships to every plugin user. Four checkers that scanned skill text are deleted by user decision D-3. |
| skill script -> host binary | `check-no-skill-external-spawn.mjs` (SEAM-05) is the gate. It SURVIVES and its CI step stays. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-poo-01 | Information disclosure | published tarballs | medium | mitigate | `check-npm-packages.mjs` and its CI step are explicitly preserved, and Task 4 `<verify>` step (d) runs the gate directly. |
| T-poo-02 | Elevation of privilege | skill scripts spawning host binaries | high | mitigate | `check-no-skill-external-spawn.mjs` and its CI step are explicitly preserved, and Task 4 `<verify>` step (d) runs the gate directly. |
| T-poo-03 | Tampering | skill playbooks naming unavailable tools | medium | accept | ACCEPTED BY USER DECISION D-3. All four skill-text checkers are dropped, including the two carrying ground truth. Do not propose a replacement. |
| T-poo-04 | Repudiation | documentation drifting from the shipped tree | low | accept | ACCEPTED BY USER DECISIONS D-1 and D-6. Text-asserting doc guards and the planning-vocabulary convention are retired. Do not propose a replacement. |
| T-poo-SC | Tampering | npm/pip/cargo installs | high | n/a | This plan installs no package and adds no dependency. No package-legitimacy checkpoint is required. |
</threat_model>

<verification>
Applied after every task, verbatim:
1. `npm run test:automated` from `src/mcp/vice`. NEVER pipe to `tail` or `head`
   — that reports the pipe's exit status and fakes a green run. Redirect to a
   file and read `$?` on the SAME line.
2. Compare the failing SET against the `measured_baseline` set, never a count.
3. `npm run typecheck` from `src/mcp/vice` — no deleted module may leave a
   dangling import.
4. `.github/workflows/ci.yml` still parses as YAML.
5. No magic number is pinned in any assertion or in a `<verify>` block. Sets and
   relations only.
</verification>

<success_criteria>
- 59 files deleted with `git rm`: 43 tests, 1 module, 4 checkers, 1 audit gate,
  10 orphan-cascade files.
- 3 files edited: `.github/workflows/ci.yml`, `CLAUDE.md`,
  `.planning/codebase/CONVENTIONS.md`. No surviving test file is edited.
- `npm run test:automated` exits 0 with an EMPTY failing set.
- `npm run typecheck` exits 0.
- `.github/workflows/ci.yml` is valid YAML. Every `node scripts/<file>` it still
  invokes resolves. `check-npm-packages.mjs` and
  `check-no-skill-external-spawn.mjs` both still run and exit 0.
- Neither `CLAUDE.md` nor `.planning/codebase/CONVENTIONS.md` names any deleted
  file, and neither carries the retired planning-vocabulary convention.
- Four atomic commits, one per task, each staged by explicit path.
- The ASD-STE100 skill and all `must_not_touch` working-tree files are
  byte-identical and unstaged.
- No note, seed, doc, replacement test or replacement guard was created.
</success_criteria>

<output>
Create `.planning/quick/260914-poo-delete-all-text-asserting-tests-disarm-t/260914-poo-SUMMARY.md` when done.
</output>
