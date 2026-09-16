---
phase: 50-equivalence-and-modifiability
plan: 07
subsystem: vice-mcp
tags: [ci-boundary, transcript-freshness, staleness-guard, green-only-refusal, synthetic-fixtures, observed-red]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability (plan 50-05)
    provides: the red control section in docs/phase50-equivalence-transcript.md, which is what the green-only refusal has to find
  - phase: 50-equivalence-and-modifiability (plan 50-06)
    provides: docs/phase50-equivalence-transcript.md's green section, docs/phase50-modifiability-transcript.md, the five committed captures and hazard-subject-rebuild.prg
  - phase: 48 (the purpose-built hazard subject)
    provides: src/mcp/vice/fixtures/hazard-subject/, the committed synthetic fixtures this pipeline runs on -- consumed here, not re-owned
provides:
  - "src/mcp/vice/phase50-transcript-freshness.test.ts: a CI-runnable guard that recomputes every transcript's recorded subject digest, refuses an orphaned reference, refuses a green section with no paired red control, and fails rather than passing vacuously on an empty transcript set"
  - "docs/phase50-ci-boundary.md: the stated split between the segment a GitHub runner executes and the emulator-dependent segment that is a named manual step, with every CI claim traced to a named step in .github/workflows/ci.yml"
  - "A prg_path beside every recorded prg_sha256 in both transcripts, which is what makes a recorded digest checkable at all"
  - "A verbatim record of one deliberately broken step observed going red against the exact command and environment CI's Test step uses, and of the same command passing after the revert"
affects: []

# Actuals (#2632)
actuals:
  tokens: 11377   # MEASURED chars/4 over the realized text diff of 5c5845f1..HEAD
                  # (45510 chars, 843 inserted lines, 0 deleted, no binary artifacts).
                  # Against the plan's estimate of 27000 this came in at roughly 42%.
                  # The gap is mostly that two of the three tasks produce prose, and
                  # the third produces a single test file rather than a module plus a
                  # test file.
  tasks: 3
  commits: 4      # MEASURED: git rev-list --count 5c5845f1ea4383baa1ce2fa993b14af19a4c6984..HEAD
                  # reported 4 at SUMMARY-write time -- the RED and GREEN halves of
                  # task 1 plus one commit each for tasks 2 and 3. The same command
                  # reports 5 after this SUMMARY's own docs commit lands.
plan_head_before: 5c5845f1ea4383baa1ce2fa993b14af19a4c6984

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A staleness guard written as one pure function over a directory, so the file's own negative cases drive the SAME code path the committed case drives -- never a second re-derived copy of the rule"
    - "A hand-rolled indentation reader for exactly the frontmatter shape in use, rather than a YAML dependency, because a guard that needs a new dependency is itself a new prerequisite for the CI half"
    - "Fenced code blocks stripped before scanning markdown headings, so a transcript that quotes real command output cannot have a quoted line mistaken for a section"
    - "A discovery pattern narrow enough that membership is decided by the file NAME, so a matched file missing its expected frontmatter is a hard failure rather than a silent non-member"

key-files:
  created:
    - src/mcp/vice/phase50-transcript-freshness.test.ts
    - docs/phase50-ci-boundary.md
  modified:
    - docs/phase50-equivalence-transcript.md
    - docs/phase50-modifiability-transcript.md

key-decisions:
  - "Transcripts are discovered by the pattern `phase50-*-transcript.md`, not the plan's literal `phase50-*.md`. docs/ also holds phase50-modifiability-findings.md and this plan's own phase50-ci-boundary.md, neither of which is a transcript and neither of which carries a subjects: block. The wider pattern would have forced a content sniff to decide membership -- and a real transcript that LOST its subjects: block would then have passed that sniff silently, which is exactly the quiet failure the guard exists to prevent. With the narrower pattern a matched file with no subjects: block is a hard failure, and a transcript added later is still covered with no code change."
  - "Each subject gained an explicit prg_path rather than having its path guessed from its name. A recorded digest with no path is unverifiable, and the four subjects do not share one directory -- three are committed fixtures and hazard-subject-rebuild is a build output under the phase evidence directory. A name-to-path convention would be a second, unwritten rule that resolves to the wrong file the moment two directories hold the same basename."
  - "The guard checks the .prg subjects and deliberately NOT the captures: entries. The captures carry recorded digests but no path, and widening the guard to cover them would have meant adding paths for ten more files with no requirement asking for it. The boundary document states plainly that CI does not re-derive a transcript's result."
  - "The observation section records the absence of a real GitHub-runner run rather than recording a developer decline that was never given. The plan's acceptance criterion offers a run URL or a dated decline; neither is true, so the section names the open item as an open item."
  - "EQUIV-04 is WITHHELD. See the requirements block below for the clause and the single action that closes it."

patterns-established:
  - "When an evidence document's recorded value cannot be located on disk, add the locator to the document rather than teaching the checker to guess. The document becomes self-describing and the checker stays dumb."
  - "Observe the break against the exact command AND the exact environment the CI step uses, redirecting to a file and reading $? on the same line. A pipeline reports the last command's exit status, which makes a red run look green."
  - "Prove a break reddens the aggregate gate too, not just the one file: 3684 tests, pass 3674, fail 1 is a different and stronger statement than 11 tests, 1 fail."

# ----------------------------------------------------------------------------
# Requirements
# ----------------------------------------------------------------------------
# CLAIMED: none. WITHHELD: EQUIV-04.
#
# The plan frontmatter declares `requirements: [EQUIV-04]`. That says what this
# plan CONTRIBUTES TO, not what it completes, and it is not inherited.
#
# EQUIV-04 -- "The synthetic fixtures are committed and the whole pipeline is
#   runnable in CI." WITHHELD over one clause of ROADMAP criterion 5, which is
#   the requirement's operative refinement.
#
#   What IS evidenced, each against a run recorded below:
#     - The synthetic fixtures are committed (Phase 48's deliverable, consumed
#       here). `git ls-files` finds every subject the pipeline uses, including
#       hazard-subject-rebuild.prg and the five captures.
#     - The boundary is STATED rather than blurred: docs/phase50-ci-boundary.md
#       names the segment a runner executes, the four workflow steps that carry
#       it, and the emulator-dependent artifacts by path (coverage C2).
#     - The manual half's transcripts ARE freshness-checked against the
#       fixture's hash, by a guard that runs under the existing Test glob with
#       no workflow change (coverage C1, C4).
#     - A broken step IS observed going red, verbatim, against the exact command
#       and environment CI's Test step uses (coverage C3).
#
#   What is NOT evidenced, which is why the id is withheld:
#     - Criterion 5's last sentence is "A broken step is observed reddening CI."
#       The observation was made LOCALLY against CI's exact command, never on a
#       GitHub runner. No GitHub Actions run was observed at any point in this
#       plan.
#     - The plan's own flagged assumption P5 says the boundary is stated "from a
#       reading of the workflow" and that neither task 2 nor task 3 "proves the
#       boundary exhaustively". That assumption is still unresolved.
#
#   ONE action closes it: push the same one-character break on a scratch branch,
#   open a pull request, observe the `build` job go red, record the run URL and
#   the observed job status in docs/phase50-ci-boundary.md's
#   `## A broken step, observed going red` section, then close the pull request
#   and delete the branch. Alternatively the developer records a dated decline,
#   in which case the withheld clause becomes an accepted residual rather than a
#   gap -- but that is the developer's call to make, not this executor's.
requirements-completed: []

# Metrics
metrics:
  duration: "~25 min"
  completed: 2026-09-16
  tasks: 3
  files-created: 2
  files-modified: 2

status: complete
---

# Phase 50 Plan 07: The Stated CI Boundary, the Transcript Freshness Guard, and a Broken Step Observed Going Red Summary

A CI-runnable guard now makes a stale Phase 50 transcript a test failure instead
of a quiet pass, a document states which half of the pipeline a GitHub runner
actually executes, and one deliberately broken step was observed reddening the
exact command CI runs and then reverted.

## What was built

### Task 1 — the transcript freshness guard

`src/mcp/vice/phase50-transcript-freshness.test.ts` (488 lines). Executed as a
real RED/GREEN cycle:

- **RED** (`dbf0774c`). The whole rule set written first against a stubbed
  `auditPhase50Transcripts()` returning no failures. 11 tests discovered, 5
  pass, 6 fail; the target case failed with `expected exactly one failure, got
  []`. `gsd-tools check tdd-red-evidence` returned
  `RED_EVIDENCE_OK (target_test_failed)`.
- **GREEN** (`275d4228`). The audit implemented; 11 tests, 11 pass, 0 fail.

The guard checks three directions, with no process launch, no socket and no
assembler, so it runs unchanged on a bare runner:

1. **Freshness.** Every `prg_sha256` in a transcript's frontmatter is recomputed
   from the file named by its `prg_path`. A mismatch names the transcript, the
   subject, both digests and the remedy.
2. **Orphans.** A subject naming a `.prg` that is gone fails as an `ORPHAN`.
3. **The green-only refusal.** A transcript carrying a `## Green ...` section
   and no `## Red ...` control is refused. This is ROADMAP criterion 2 made
   mechanical rather than left to a reviewer's memory, and it is the reason this
   file is worth more than a hash comparison.

An empty transcript set fails rather than passing vacuously, so a tree whose
transcripts were deleted or renamed out of the pattern reports that it checked
nothing.

Seven negative cases build a broken tree in a scratch directory and drive the
**same** audit function the committed case drives — never a second copy of the
rule. A paired positive case stops the refusal cases passing for the wrong
reason (a guard that refused everything would satisfy them too).

The file is not in `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, so it runs under both
`npm run test:automated` and CI's wider `npm test` glob.

### Task 2 — the boundary document

`docs/phase50-ci-boundary.md` (`1a91061a`), with the five required sections.
Every claim about what CI runs is traced to a named step in
`.github/workflows/ci.yml`:

- **What a GitHub runner executes** — the store → export → assemble → gate →
  byte-diff segment, as a table naming the test file carrying each part, plus
  the four `build`-job steps that run them (`Install ACME cross-assembler`,
  `Assemble the acme-build scaffold`, `Test`, `Test the skills`) and the role of
  `VICE_REQUIRE_ACME=1` in turning an absent assembler from a named SKIP into a
  hard FAIL.
- **What a GitHub runner cannot execute** — every behavioural comparison, with
  both transcripts, the five captures and their sidecars, and the two capture
  drivers named by path.
- **What CI checks about the manual half** — not the prose and not the result:
  freshness, orphans and the green-without-red refusal, all named to
  `src/mcp/vice/phase50-transcript-freshness.test.ts`.
- **Only committed synthetic fixtures** — the hazard subject and its variants,
  and the statement that no copyrighted disk image is used or available, with
  the untracked Phase 23 corpus images named as explicitly out of this pipeline.
- **How to run each half** — the CI command, the skills command, the local
  command, the wide-glob local hang cited to the workflow's own comment, and the
  warning against piping a test run into anything.

### Task 3 — a broken step observed going red

`cfb6f5fc` added `## A broken step, observed going red`, in two layers.

**Layer one, asserted every run.** The guard's seven negative cases re-prove the
broken condition on every CI run rather than having been seen once.

**Layer two, one real break.** One character of one committed file: the
`hazard-subject` digest recorded at line 13 of
`docs/phase50-equivalence-transcript.md`, `8` → `9`. The subject binary itself
was left alone, which is the shape a real staleness takes.

The exact command CI's `Test` step uses, with CI's environment:

```
cd src/mcp/vice
VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts
```

went red: **11 tests, 10 pass, 1 fail, EXIT=1**, failing with

```
phase50-equivalence-transcript.md: STALE -- subject `hazard-subject`
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg`) recorded sha256
99846d...6828 but the committed file now hashes to 89846d...6828.
```

The same break against the whole local gate
(`VICE_REQUIRE_ACME=1 npm run test:automated`) reddened the aggregate too:
**3684 tests, pass 3674, fail 1, EXIT=1**, against `pass 3675 / fail 0` on a
clean tree. Neither run was piped through anything.

The break was then reverted with
`git checkout -- docs/phase50-equivalence-transcript.md`, after which
`git status --porcelain` over the transcripts and the fixture directory printed
nothing and the same command returned **11 tests, 11 pass, 0 fail, EXIT=0**.
Both outputs are in the document verbatim, not transcribed by hand — the section
was generated by reading the captured run files.

**The tree is green and clean of the break.** Verified after the revert and
again after the commit.

## Verification

| # | What was checked | Command | Result |
|---|---|---|---|
| C1 | The guard passes on the committed tree and fails on each broken condition | `cd src/mcp/vice && node --test phase50-transcript-freshness.test.ts` | 11 tests, 11 pass, 0 fail, exit 0 — **evidences EQUIV-04 in part** |
| C2 | The boundary document carries all six sections and names the freshness file and the local command | `grep -ac '^## What a GitHub runner executes\|...'` = 5; `grep -c 'phase50-transcript-freshness.test.ts'` = 1; `grep -c 'test:automated'` = 3; `grep -c 'A broken step, observed going red'` = 1 | all non-zero — **evidences EQUIV-04 in part** |
| C3 | A broken step reddens the exact CI command, and the revert restores green | `VICE_REQUIRE_ACME=1 node --test phase50-transcript-freshness.test.ts` before and after the revert | 10/1 fail exit 1 → 11/0 fail exit 0 — **evidences EQUIV-04 in part; does NOT evidence criterion 5's "reddening CI" on a runner** |
| C4 | The guard runs under the existing CI test command with no workflow change | `git diff --name-only 5c5845f1..HEAD -- .github/workflows/ci.yml` | empty; the file is in `src/mcp/vice/` and absent from `MANUAL_ONLY_TESTS` — **evidences EQUIV-04 in part** |
| C5 | The guard reaches no process launch and no network call | `grep -ac 'spawnSync(\|spawn(\|fetch(' phase50-transcript-freshness.test.ts` | 0 |
| C6 | The guard is not on the manual-only list | `grep -ac 'phase50-transcript-freshness' test-gate.mjs` | 0 |
| C7 | The whole automated gate is green and the skip floor is unchanged BY NAME | `cd src/mcp/vice && npm run test:automated` | tests 3684, pass 3675, fail 0, skipped 9, exit 0. Baseline before this plan: 3673 / 3664 / 0 / 9. The 9 skips `diff` identically by name. |
| C8 | The exact command CI's `Test the skills` step runs is green | `node --test 'src/skills/*/scripts/*.test.mjs'` | tests 219, pass 213, fail 0, skipped 6, exit 0 |
| C9 | Typecheck is clean | `cd src/mcp/vice && npm run typecheck` | exit 0 |
| C10 | No file was deleted by this plan | `git diff --diff-filter=D --name-only 5c5845f1..HEAD` | empty |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The recorded digests named no file, so nothing could check them**

- **Found during:** Task 1, reading the transcripts' `subjects:` blocks.
- **Issue:** Each subject recorded a `prg_sha256` and no path. The plan's action
  says to recompute "the named `.prg` file's sha256", but no subject named one,
  and the four subjects do not share a directory — three are committed fixtures
  under `src/mcp/vice/fixtures/hazard-subject/` and `hazard-subject-rebuild` is a
  build output under the phase evidence directory. Guessing a path from a subject
  name would have been an unwritten second convention.
- **Fix:** Added an explicit `prg_path` beside each `prg_sha256` in both
  transcripts, with a dated frontmatter comment saying who added it and why. **No
  recorded value was changed**, and the guard refuses a subject that has no
  `prg_path` rather than skipping it.
- **Files modified:** `docs/phase50-equivalence-transcript.md`,
  `docs/phase50-modifiability-transcript.md`
- **Commit:** `275d4228`

**2. [Design refinement] The discovery pattern is narrower than the plan's literal text**

- **Found during:** Task 1.
- **Issue:** The plan says to glob `docs/phase50-*.md`. That directory also holds
  `phase50-modifiability-findings.md` (a gate record) and this plan's own
  `phase50-ci-boundary.md`. Neither is a transcript and neither carries a
  `subjects:` block, so the wider pattern would have forced a content sniff to
  decide membership — and a real transcript that lost its `subjects:` block would
  then have passed that sniff silently.
- **Fix:** The pattern is `^phase50-.+-transcript\.md$`. Membership is decided by
  the file name, a matched file with no `subjects:` block is a hard failure, and
  a transcript added later is still covered with no code change. The reason is in
  the file's own header under a named section.
- **Commit:** `275d4228`

**3. [Recorded, not fixed] The RED evidence record needed the TAP reporter**

- `gsd-tools check tdd-red-evidence` parses `node --test`'s TAP output, not the
  default spec reporter's, and returned `zero_tests_discovered` against a spec
  capture. The RED run was repeated with `--test-reporter=tap` purely to produce
  a parseable record; the failure itself was unchanged and the verdict became
  `RED_EVIDENCE_OK`. Noted so the next executor does not spend the same two
  cycles on it.

**4. [Recorded, not fixed] HEAD was on `main`, which the commit protocol calls protected**

- `git.base-branch --is-protected main` returns `true` and
  `git.allow_default_branch_commits` is unset, so the executor's pre-commit
  assertion would normally halt. This plan was dispatched with ISOLATION
  explicitly resolved to `none` and an instruction to work directly on the main
  checkout, and every prior plan in this phase committed there. This was
  deliberate dispatch, not drift, so the four commits were made on `main`. **No
  configuration was changed** — changing it would be a standing change beyond
  this plan's scope.

### Not done, deliberately

**Task 3's developer question is unanswered and is recorded as such.** The plan
says to ask the developer whether they want the stronger evidence of a real CI
run, and to record either a run URL or a dated decline. Neither happened: this
executor cannot give an answer on the developer's behalf, and
`workflow.auto_advance` is `false` with `workflow.human_verify_mode` set to
`end-of-phase`, which defers a human check to the end of the phase. The document
therefore names the open item as an open item and says outright that recording a
decline that was never given would be a fabricated result. Task 3's
`<human-check>` is still outstanding.

## Known Stubs

None. Nothing in this plan is placeholder, mock or hardcoded-empty.

## Threat Flags

None. This plan adds no network endpoint, no auth path and no schema change. It
adds one test file that only reads and hashes files already in the repository,
and one document naming paths, commands and workflow steps that are already
public in this repository — the residual `T-50-14` already accepts.

`T-50-13` (the deliberate break surviving the observation) is mitigated as the
plan requires: the break was reverted, `git status --porcelain` over the
transcripts and the fixture directory is empty, and the guard is green.

## Self-Check: PASSED
