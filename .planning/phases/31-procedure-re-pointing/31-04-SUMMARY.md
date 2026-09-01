---
phase: 31-procedure-re-pointing
plan: 04
subsystem: testing
tags: [ci, github-actions, attribution, abs-02, guards, non-vacuity, node-test]

# Dependency graph
requires:
  - phase: 31-procedure-re-pointing
    provides: "plan 31-02's two-naming-lines guard in src/mcp/vice/skill-attribution.test.ts, whose two durability defects this round closes"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "upstream-procedure-manifest.json -- the pinned record both naming-line constants and now the per-tree block floor derive from"
provides:
  - "A CI step that materialises the generated, gitignored installer/skills/ tree through the one existing producer, ordered before the Test step, so the two-tree ABS-02 guard reaches both trees where it runs unattended"
  - "emptyRootVerdict() -- a three-valued, fully-injected root verdict replacing the boolean skippableEmptyRoot(); keyed on ABSENCE not emptiness, never skipping under CI, and carrying a reason the caller prints"
  - "A loud-skip protocol: every unscored root recorded with a named reason and announced by t.diagnostic(), plus an unconditional scored-of-declared summary and a totals+unscored===declared accounting relation"
  - "attributionBlockLines() -- a line-anchored ABS-02 block extractor returning whole physical lines, coexisting with the capture-based attributionBlocks() and asserted to agree with it on block count"
  - "namingLineCountsIn(lines: readonly string[]) -- the grep -rx claim made true BY CONSTRUCTION via the parameter type, with every call site re-pointed"
  - "Two boundary plants (head and tail) with one-newline controls, covering the two positions the interior plants structurally cannot reach"
  - "31-REVIEW-FIX.md -- the durable disposition record for all 11 findings in 31-REVIEW.md"
affects: [phase-32-cut-04-guard-audit, abs-02-attribution-chain, removal-gate-pins]

actuals:
  tokens: 31600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Injected-probe verdicts: a classifier takes { rootExists, ci } as explicit arguments rather than reading existsSync/process.env internally, so every branch is assertable on any machine instead of only the branch the local tree exercises"
    - "Type-level claim enforcement: a documented byte-equality claim is made true by the predicate's PARAMETER TYPE (readonly string[] of whole physical lines), not by prose promising callers behave"
    - "Loud skip: a skipped unit of work is recorded with a named non-empty reason AND emitted as a diagnostic, with an accounting relation making an unrecorded unit a failure"

key-files:
  created:
    - .planning/phases/31-procedure-re-pointing/31-REVIEW-FIX.md
  modified:
    - .github/workflows/ci.yml
    - src/mcp/vice/skill-attribution.test.ts

key-decisions:
  - "Took BOTH branches of the verification report's either/or (CI step AND loud skip), because the CI step alone still lets a half-failed sync read as absence and the loud skip alone still leaves CI scoring one tree"
  - "Keyed the empty-root skip on ABSENCE via an injected rootExists probe rather than on file count, so an interrupted sync fails instead of masquerading as a fresh clone (WR-01)"
  - "Fixed the grep -rx claim at the predicate's INPUT (parameter retyped to an array of whole lines) rather than at its comparison, which was already exact -- and re-pointed every call site, because attributionBlocks(...)[0].split(\"\\n\") typechecks and passes on today's tree while reinstating the hole"
  - "Kept attributionBlocks() alongside the new line-anchored extractor with different jobs (content isolation vs byte-exactness), asserting the two agree on block count per file rather than consolidating -- consolidation needs the removal gate edited, which this round is fenced from"
  - "Fixed WR-03 and WR-06 rather than accepting them: both are the red-on-a-correct-tree failure mode this file's own doctrine block was written against"
  - "Recorded 31-REVIEW-FIX.md status as partial_fix, not all_fixed -- five findings are genuinely untouched and every deferral names its reopening trigger"
  - "Left requirements-completed empty: the plan and the verification report both require REPOINT-03/REPOINT-04 to stay Pending until a re-verification verdict clears them"

patterns-established:
  - "Injected-probe verdict: hand a classifier its view of the world as explicit booleans so all branches are deterministically assertable"
  - "Boundary plant with a one-newline control: a plant proving a boundary defect is paired with a control differing by exactly one newline, so the plant cannot pass vacuously"
  - "Non-vacuity by inversion outside the repo: invert one expected count in a scratch copy held in the session scratchpad, confirm it fails, discard -- never plant into the tracked file or either skill tree"

requirements-completed: []
# DELIBERATE, not an omission. This plan declares requirements [REPOINT-03, REPOINT-04] and
# neither may be promoted here. 31-VERIFICATION.md scored the phase `gaps_found`; REPOINT-04 is
# ✓ SATISFIED on the merits but moves WITH REPOINT-03 under REQUIREMENTS.md's four-sites-one-edit
# rule, on a re-verification verdict. The plan's own prohibitions forbid editing REQUIREMENTS.md.

coverage:
  - id: D1
    description: "A workflow step materialises the shipped skills tree through the one existing producer, ordered before the Test step, so the two-tree guard reaches both trees in CI"
    requirement: "REPOINT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/ci-suite-coverage.test.ts (10 tests, the only guard parsing ci.yml as structure)"
        status: pass
      - kind: other
        ref: "grep -n 'name: Generate the shipped skills tree|name: Test$|name: Validate npm package contents' .github/workflows/ci.yml -> 126, 130, 189"
        status: pass
    human_judgment: false
  - id: D2
    description: "No root can go unscored silently: absence outside CI is the only skippable case, it is recorded with a named reason and announced by a diagnostic, an existing-but-empty shipped root fails, a CI run never skips, and an unaccounted root fails a relation"
    requirement: "REPOINT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#both skill trees carry the ABS-02 naming lines byte-identically, in equal numbers (five injected-probe branch assertions + reason-non-emptiness + totals accounting relation)"
        status: pass
      - kind: integration
        ref: "absent-tree reproduction: installer/skills relocated, CI=1 -> # fail 1 naming the shipped root; CI unset -> exit 0 with 'root installer/skills NOT scored' + 'scored 1 of 2' diagnostics"
        status: pass
      - kind: integration
        ref: "present-but-empty reproduction: empty installer/skills/, CI unset -> # fail 1 ('EXISTS but yields no SKILL.md')"
        status: pass
    human_judgment: false
  - id: D3
    description: "The naming-line predicate cannot be handed a line fragment at any call site, so its documented grep -rx whole-line byte equality is true as written at both block boundaries"
    requirement: "REPOINT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#the naming-line predicate bites on a planted one-character mutation (head plant, head control, tail plant, tail control + per-plant one-block assertions)"
        status: pass
      - kind: other
        ref: "grep -n 'namingLineCountsIn(' and grep -n 'attributionBlocks(' over skill-attribution.test.ts -- hit sets disjoint by line number; every predicate argument is an attributionBlockLines() element or an array literal"
        status: pass
      - kind: unit
        ref: "non-vacuity by inversion in an out-of-repo scratch copy: inverted head-plant expectation failed on '+ adapted: 0 / - adapted: 1'; un-inverted control passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The per-tree block floor derives from manifest.procedures.length so it ratchets, and PLANT A no longer depends on the derived upstream name's casing"
    requirement: "REPOINT-03"
    verification:
      - kind: other
        ref: "grep -c 'ABS02_BLOCKS_PER_TREE_FLOOR = 5' -> 0; grep -c 'nameAt' -> 0; declaration reads ': number = manifest.procedures.length'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#the naming-line predicate bites on a planted one-character mutation (length + exactly-one-differing-position assertions still hold)"
        status: pass
    human_judgment: false
  - id: D5
    description: "All eleven 31-REVIEW.md findings carry a disposition in a durable source the disposition guard recognises, with every deferral naming its reopening trigger"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts (7 tests) -- # fail 1 before this file existed, # fail 0 after"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts (44 tests) -- # fail 1 at 'no milestone audit declares a gated status while any docs guard is red (D-12-02)' before, # fail 0 after"
        status: pass
    human_judgment: true
    rationale: "The guard only checks that each id is MENTIONED in a recognised source -- deliberately weak, because a guard that grades prose gets switched off. Whether each verdict is the RIGHT verdict, whether the deferral triggers are the right triggers, and whether partial_fix is the honest status are judgment calls no test asserts."
  - id: D6
    description: "REPOINT-04 non-regression: the phase-19 manifest, its omit disposition and anno-derivation.test.ts are untouched by this round"
    requirement: "REPOINT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-derivation.test.ts -- # tests 9 / # pass 8 / # fail 0 / # skipped 1 (the pre-existing expected skip)"
        status: pass
      - kind: other
        ref: "git status --porcelain over upstream-procedure-manifest.json, check-no-analyser.mjs, STATE.md, ROADMAP.md, REQUIREMENTS.md -> empty"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both removal-gate per-path subject-token pins are unmoved and no pin, needle or scope predicate in the gate was edited"
    verification:
      - kind: other
        ref: "grep -o 'the external analyser' src/mcp/vice/skill-attribution.test.ts | wc -l -> 12; grep -c 'the external analyser' .github/workflows/ci.yml -> 1"
        status: pass
      - kind: other
        ref: "node scripts/check-no-analyser.mjs -> exit 0, still printing 'attribution-guard-test 14' and 'skill-attribution-headers 24'"
        status: pass
    human_judgment: false

# Metrics
duration: 26 min
completed: 2026-08-31
status: complete
---

# Phase 31 Plan 04: Gap-Closure Round 1 Summary

**The two-tree ABS-02 naming-line guard now actually reads two trees in CI, and its documented `grep -rx` whole-line byte equality is true at block boundaries by construction rather than by luck — plus a durable disposition record for all 11 code-review findings.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-31T11:05:00Z
- **Completed:** 2026-08-31T11:31:06Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **Gap 1 closed, both halves.** A CI step ordered before `Test` materialises the generated,
  gitignored `installer/skills/` tree through the one existing producer
  (`installer/scripts/sync-skills.mjs`, the exact command `prepack` runs), AND
  `skippableEmptyRoot()` is replaced by the three-valued `emptyRootVerdict()` that refuses to
  skip under CI, refuses to skip a root that exists, and records a named reason for every root
  it does skip. A one-tree run can no longer read as a two-tree run: it says
  `scored 1 of 2 declared root(s)` in its own output.
- **Gap 2 closed at the input, not the comparison.** `namingLineCountsIn` takes
  `readonly string[]` — whole physical lines from the new line-anchored `attributionBlockLines()`
  — so a regex capture group's boundary fragments cannot be handed to it even by accident. Every
  one of the five call sites was re-pointed, which was the load-bearing part: the cheap
  typecheck-satisfying route (`attributionBlocks(...)[0].split("\n")`) passes on today's tree and
  silently reinstates the hole.
- **Both boundary positions planted and proven.** Head (marker and adapted line sharing one
  physical line → adapted 0) and tail (source-repository line sharing a line with `-->` →
  repository 0), each paired with a control one newline away that scores 1, so neither plant can
  be vacuous.
- **Four review findings fixed beyond the two gaps:** WR-01 (absence-keyed skip), WR-03 (floor
  derived from `manifest.procedures.length` instead of the literal `5`), WR-05 (header now reads
  six ways and enumerates the two-tree departure), WR-06 (PLANT A mutates the constant's own
  fixed prefix, so a manifest name beginning with a digit or hyphen cannot red this test on a
  correct tree).
- **`31-REVIEW-FIX.md` written as the durable disposition source** the verification report
  declined to be, taking both disposition guards from red to green.

## Task Commits

1. **Task 1 (tracer): End-to-end — an unscored shipped tree is impossible to mistake for a scored one** — `20b6a2d` (fix)
2. **Task 2: Make the `grep -rx` claim true by construction — whole physical lines, plus the two boundary plants** — `66d2743` (fix)
3. **Task 3: Record the durable disposition for all 11 review findings** — `8e5d307` (docs)

**Plan metadata:** committed separately with this SUMMARY.

## Files Created/Modified

- `.github/workflows/ci.yml` — new step `Generate the shipped skills tree (scored by
  skill-attribution.test.ts)` at line 126, `working-directory: installer`,
  `run: node scripts/sync-skills.mjs`, ordered before `Test` (130) and `Validate npm package
  contents` (189), with a comment recording why the ordering is load-bearing and which defect it
  closes.
- `src/mcp/vice/skill-attribution.test.ts` — `EmptyRootVerdict` / `EmptyRootProbe` /
  `emptyRootVerdict()`; `attributionBlockLines()`; `namingLineCountsIn` retyped;
  `ABS02_BLOCKS_PER_TREE_FLOOR` derived; the `unscoredRoots` ledger, two diagnostic emissions and
  the accounting relation; five injected-probe branch assertions plus reason-non-emptiness; the
  per-file extractor-agreement assertion; four boundary assertions; PLANT A retargeted; header
  corrected to six ways.
- `.planning/phases/31-procedure-re-pointing/31-REVIEW-FIX.md` — disposition record for all 11
  findings (6 fixed, 2 deferred with triggers, 3 accepted with reasons), a Verification section
  naming every command and its measured output, an explicit scope statement, and a
  residuals-carried-forward table.

## Decisions Made

- **Took both branches of the verification report's `either/or`.** `missing[0]` offered "either
  materialise the tree in CI, or make the skip loud". Each alone leaves a hole: the CI step alone
  still lets a half-failed sync read as absence; the loud skip alone still leaves CI scoring one
  tree. Both landed.
- **Injected the probe rather than reading the world inside the verdict.** `{ rootExists, ci }`
  are arguments, not `existsSync`/`process.env` calls inside `emptyRootVerdict()`. That is what
  lets all five branches be asserted deterministically on any machine, instead of only the branch
  the machine's own tree happens to exercise — which was the original three assertions' weakness.
- **Fixed gap 2 at the predicate's input.** The comparison was already exact; the defect was that
  it received a mid-line-anchored capture. Retyping the parameter makes the fix structural: the
  fragment-bearing input is no longer expressible.
- **Kept both extractors rather than consolidating.** `attributionBlocks()` keeps content
  isolation for registry-row matching; `attributionBlockLines()` owns byte-exactness. They are
  asserted to agree on block count per file. Full consolidation into
  `scripts/lib/skill-corpus.mjs` (WR-02) needs the removal gate edited, which this round is
  fenced from — recorded as a deferral with a trigger, not done quietly.
- **`status: partial_fix`, not `all_fixed`.** Five findings are genuinely untouched. Claiming
  otherwise would be the same defect class this round spent its effort closing.
- **`requirements-completed: []`.** See the frontmatter note: both requirements stay `Pending`
  until a re-verification verdict, per the plan's prohibitions and the verification report.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned the worktree execution environment**

- **Found during:** Task 1 precondition evaluation
- **Issue:** The plan's task-1 precondition requires `installer/skills/` to exist locally with 7
  skill directories. In a freshly-forked GSD worktree it does not: the tree is gitignored and
  generated, and `src/mcp/vice/node_modules` was likewise absent, so no suite could run at all.
- **Fix:** `npm ci` in `src/mcp/vice` from the committed lockfile (environment provisioning, not
  a new dependency — `package.json`/`package-lock.json` are untouched), then
  `node scripts/sync-skills.mjs` from `installer/`, which is the plan's own sanctioned single
  producer and the exact command its acceptance criteria use for the restore step.
- **Files modified:** none tracked — both outputs are gitignored. `git status --porcelain` was
  empty afterwards.
- **Verification:** 7 skill directories present; precondition's second half
  (`systemctl --user is-active vice-broker` → `inactive`) confirmed before any suite ran.
- **Committed in:** n/a (no tracked change)

**2. [Rule 3 - Blocking] Ran the boundary-plant non-vacuity proof outside the repository**

- **Found during:** Task 2 acceptance criteria
- **Issue:** The criterion asks for a scratch copy under the scratchpad directory. A scratch copy
  placed there cannot resolve `repoRoot({ from: HERE })` — it falls back three levels up and the
  test dies with `ENOENT` on `/tmp/claude-1000/src/skills/...`, which would have made the
  "it fails when inverted" result meaningless (it fails for the wrong reason).
- **Fix:** In the scratch copy only, the three relative paths were absolutised and `ROOT` was
  pinned to the worktree root, so the run exercised the real constants and the real corpus. The
  inverted run then failed on exactly the intended assertion (`+ adapted: 0 / - adapted: 1`
  against the head-plant message) and the un-inverted control passed. Scratch copy deleted.
- **Files modified:** none — the scratch copy lived outside the repository for its whole life and
  the tracked file was never mutated.
- **Verification:** control run `ok 1 … # pass 1 # fail 0`; `git status --porcelain` clean.
- **Committed in:** n/a (no tracked change)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking environment issues)
**Impact on plan:** None on scope or content. Neither changed a tracked file; both were required
to make the plan's own acceptance criteria executable inside a worktree. No scope creep.

## Issues Encountered

**`npm run test:automated` reports 1 failure in this worktree, and it is environment-induced.**

`repo-root.test.ts` → `path agreement (D-3, D-6, THE regression this task exists to catch): …
and the agreed path is not under .claude` fails with:

> the agreed directory must not sit under `.claude` — got
> `…/.claude/worktrees/agent-aae6d5eaaad75f3d2/.vice-supervisor`

`repoRoot()` walks up to the nearest `.git`; inside a GSD worktree that is a `.git` FILE at the
worktree root, and this worktree root *is* `…/.claude/worktrees/agent-…`, so the resolved
supervisor directory necessarily sits under `.claude`. The test cannot pass from inside any
`.claude/worktrees/**` checkout and cannot be triggered by this round's changes:
`git log -- src/mcp/vice/repo-root.test.ts` shows its last touch was `fd4e54b` (`test(18-07)`),
and this plan's full diff lists only `.github/workflows/ci.yml`,
`src/mcp/vice/skill-attribution.test.ts` and `31-REVIEW-FIX.md`. On the merged main checkout the
resolved root is `/home/henrik/dev/henrik/git/c64-re-tools`, which is not under `.claude`, so the
project's clean floor of **0 failures** holds there.

Measured both ways so the delta is unambiguous: `# tests 2920 / # pass 2911 / # fail 3` before
`31-REVIEW-FIX.md` existed (the two disposition guards plus this one), and
`# tests 2920 / # pass 2913 / # fail 1` after. Recorded as an execution-environment note in
`31-REVIEW-FIX.md` too — **not** as an accepted defect and **not** as a new baseline. It should
be re-measured on main after the worktree merges.

Everything else was green throughout: typecheck clean, `ci-suite-coverage.test.ts` 10/10,
`docs-review-disposition.test.ts` 7/7, `audit-integrity.test.ts` 44/44, `anno-derivation.test.ts`
8 pass / 1 expected skip, and the whole gate ladder
(`check-no-analyser.mjs`, `check-npm-packages.mjs`,
`check-skill-description-overlap.mjs`, `check-skill-tool-coverage.mjs`,
`check-skill-fork-honesty.mjs`) exit 0.

## Known Stubs

None. No hardcoded empty value, placeholder string, `TODO`/`FIXME` marker or unwired component
was introduced. Every assertion added runs on every invocation of its suite; every `<verify>` in
the plan was executed and its output recorded above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both gaps `31-VERIFICATION.md` raised are closed with reproductions recorded in
  `31-REVIEW-FIX.md`. The phase is ready for **re-verification**.
- **`REPOINT-03` and `REPOINT-04` remain `Pending`, deliberately.** `REQUIREMENTS.md` was not
  edited by this plan. `REPOINT-04` is ✓ SATISFIED on the merits per `31-VERIFICATION.md` and
  moves with `REPOINT-03` on the re-verification verdict, under the four-sites-one-edit rule.
- **The stopping rule from `31-04-PLAN.md` § Notes applies to the next verdict.** If
  re-verification finds new defects ONLY in plan-derived truths — not in either ROADMAP success
  criterion, both already VERIFIED by independent direct measurement — the phase SEALS with its
  residuals stated rather than running a round 2.
- **Residuals carried forward, each with a trigger** (full table in `31-REVIEW-FIX.md`):
  `WR-02` and `IN-02` (extractor and notices-list consolidation → Phase 32 `CUT-04`), `WR-04`
  (the removal gate's ROADMAP-ordinal citation → next `D-NN` renumbering or Phase 32),
  `IN-01`, `IN-03`, and `walkSkills`' `EACCES` swallow in `scripts/lib/skill-corpus.mjs`.
- **One thing to re-measure on main:** the `repo-root.test.ts` failure above, to confirm it is
  absent outside the worktree as analysed.

## Self-Check: PASSED

- Files claimed created/modified all present on disk: `31-REVIEW-FIX.md`, `31-04-SUMMARY.md`,
  `.github/workflows/ci.yml`, `src/mcp/vice/skill-attribution.test.ts`.
- All four commits present in `git log`: `20b6a2d`, `66d2743`, `8e5d307`, `90634b1`.
- `git status --porcelain` clean; `git diff --name-only <base>..HEAD` lists exactly the three
  files this plan declared, plus this SUMMARY.
- Every task's `<acceptance_criteria>` re-run and passing; the plan-level `<verification>`
  sequence re-run end-to-end, with the single environment-induced `repo-root.test.ts` failure
  documented under Issues Encountered rather than absorbed into a total.

---
*Phase: 31-procedure-re-pointing*
*Completed: 2026-08-31*
