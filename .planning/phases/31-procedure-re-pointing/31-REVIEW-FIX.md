---
phase: 31-procedure-re-pointing
fixed_at: 2026-08-31T00:00:00Z
review_path: .planning/phases/31-procedure-re-pointing/31-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 6
skipped: 5
status: partial_fix
---

# Phase 31: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** `.planning/phases/31-procedure-re-pointing/31-REVIEW.md`
**Iteration:** 1
**Scope:** `all` (Critical + Warning + Info)

**Summary:**
- Findings in scope: 11 (2 critical, 6 warning, 3 info)
- Fixed: 6 — `CR-01`, `CR-02`, `WR-01`, `WR-03`, `WR-05`, `WR-06`
- Skipped (deferred or accepted, each with a named trigger or a reason): 5 —
  `WR-02`, `WR-04`, `IN-01`, `IN-02`, `IN-03`

`status` is `partial_fix`, not `all_fixed`, and that is deliberate. Both BLOCKERs and the two
warnings the verification report's `missing[]` lines demanded are fixed; the five remaining are
recorded below with the reasoning that decided each, and every deferral names the event that
should reopen it. A record claiming `all_fixed` over five untouched findings would be the same
class of defect this phase spent a round closing — a document the tree falsifies.

**Why this file exists at all.** `31-VERIFICATION.md` § "Note on the review-disposition guard"
records that it deliberately wrote NO dispositions: a disposition living only in a
`VERIFICATION.md` is non-durable, because the next re-verification overwrites that file and
every id whose only disposition lived there goes red again with nothing about the finding
having changed — which is what happened on phases 19 and 28. `docs-review-disposition.test.ts`
recognises a phase's own `*-REVIEW-FIX.md` as disposition source 5, and that is the durable
route. Its red before this file existed was correct signal.

## Verification

**Where the gates ran:** the GSD worktree at
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-aae6d5eaaad75f3d2`, branch
`worktree-agent-aae6d5eaaad75f3d2`, forked from `abab85b7`. That matters for exactly one
measurement below (`repo-root.test.ts`), which is called out explicitly rather than folded into
a total.

**Preconditions established before any measurement:**

- `systemctl --user is-active vice-broker` → `inactive`. A live broker reddens the `BACK-05`
  test deterministically, and every suite number below would otherwise be untrustworthy.
- `installer/skills/` materialised through the one existing producer,
  `installer/scripts/sync-skills.mjs` (7 skill directories, 6 non-shipping entries excluded).
  It is gitignored and absent in a fresh worktree; nothing under it was hand-edited at any
  point, and `git status --porcelain` was empty before the first task's edits.

**Commands and their measured outputs:**

- `cd src/mcp/vice && npm run typecheck` → clean (`tsc --noEmit`), after each task.
- `cd src/mcp/vice && node --test skill-attribution.test.ts` → `# tests 14 / # pass 14 /
  # fail 0`, with the diagnostic line
  `ABS-02 naming lines: scored 2 of 2 declared root(s) [src/skills, installer/skills]; 0 unscored`.
- `cd src/mcp/vice && CI=1 node --test skill-attribution.test.ts` → the same `# fail 0` and the
  same 2 of 2.
- `cd src/mcp/vice && node --test ci-suite-coverage.test.ts` → `# tests 10 / # pass 10 /
  # fail 0`, unchanged from its pre-task measurement. This is the ONE guard that parses the
  edited `.github/workflows/ci.yml` as structure, so a mis-indented step insertion or one
  perturbing the `working-directory: installer` + exact-`npm test` frozen pairing surfaces here.
- **The absent-tree reproduction** (the one that proves gap 1 closed). With `installer/skills`
  moved aside:
  - `CI=1 node --test --test-name-pattern 'both skill trees carry the ABS-02 naming lines'
    skill-attribution.test.ts` → `# pass 0 / # fail 1`, the failure message naming the shipped
    root: `…/installer/skills is absent under CI, where an explicit workflow step materialises
    it before the suite runs…`.
  - The same command with `CI` unset → exit 0, and the run emits
    `# ABS-02 naming lines: root installer/skills NOT scored -- …does not exist: a fresh clone
    has never run the installer's prepack…` followed by
    `# ABS-02 naming lines: scored 1 of 2 declared root(s) [src/skills]; 1 unscored`.
    That is the loud skip: before this round the identical situation produced
    `ok 1 … # pass 1 # fail 0 # skipped 0` with no diagnostic at all.
- **The present-but-empty reproduction** (`WR-01`). With `installer/skills` moved aside and an
  EMPTY `installer/skills/` created, the same named test with `CI` unset → `# fail 1`, message:
  `…/installer/skills EXISTS but yields no SKILL.md -- that is an interrupted or partial sync,
  not an un-run one, so it must fail rather than skip`. It does not skip.
- **Restore, proven byte-identical.** Tree moved back, `node scripts/sync-skills.mjs` re-run,
  then `diff` over the three absorbed playbooks (`c64-memory-mapping/SKILL.md`,
  `c64-program-recon/SKILL.md`, `routine-queue-walker/SKILL.md`) between `src/skills` and
  `installer/skills` → no differences. `git status --porcelain` showed only the two intended
  source files.
- **The boundary-plant non-vacuity proof.** One expected boundary count was inverted in a
  scratch copy held OUTSIDE the repository (under the session scratchpad, never in the tracked
  file). It failed exactly as intended — `+ adapted: 0 / - adapted: 1` against the head-plant
  message — and the un-inverted control passed. The scratch copy was then deleted; nothing was
  written into either skill tree at any point.
- `cd src/mcp/vice && node --test docs-review-disposition.test.ts` → `# tests 7 / # pass 6 /
  # fail 1` BEFORE this file existed (`every REVIEW.md finding id anywhere in .planning/phases/
  has a recorded disposition (AUDIT-01, self-applied)`); `# fail 0` once it does.
- `cd src/mcp/vice && node --test audit-integrity.test.ts` → `# tests 44 / # pass 43 /
  # fail 1` before, at the cascade subtest `no milestone audit declares a gated status while any
  docs guard is red (D-12-02)`; `# fail 0` once this file exists.
- `cd src/mcp/vice && node --test anno-derivation.test.ts` → `# tests 9 / # pass 8 / # fail 0 /
  # skipped 1` (the pre-existing expected skip). The `REPOINT-04` non-regression.
- `node scripts/check-no-regenerator2000.mjs` → exit 0; 400 files scanned (370 tracked outside
  `.planning/` + 30 shipped-but-untracked installer paths, floor 350); 157 permanently exempt;
  temporary allow-list empty. `attribution-guard-test 14` and `skill-attribution-headers 24`
  both unmoved.
- Gate ladder, all exit 0: `node scripts/check-npm-packages.mjs`
  (`@henols/vice-mcp` 79 files, `@henols/c64-re-tools` 34 files / 7 skills);
  `node scripts/check-skill-description-overlap.mjs` (7 skills, 21 pairs, max 0.250 < 0.35,
  allowlist 0, CLAUDE.md table 7/7 byte-identical); `node scripts/check-skill-tool-coverage.mjs`;
  `node scripts/check-skill-fork-honesty.mjs`.
- Per-path subject-token pins, both unmoved:
  `grep -o 'regenerator2000' src/mcp/vice/skill-attribution.test.ts | wc -l` → **12**;
  `grep -c 'regenerator2000' .github/workflows/ci.yml` → **1**.

### `npm run test:automated` — the failure LIST, not the exit code

`cd src/mcp/vice && npm run test:automated`, broker confirmed `inactive`:

**`# tests 2920 / # suites 24 / # pass 2911 / # fail 3 / # skipped 1 / # todo 5`**, measured
BEFORE this file was written. The three failures, named rather than summarised:

| # | Test | Status after this file exists |
|---|---|---|
| 858 | `no milestone audit declares a gated status while any docs guard is red (D-12-02)` (`audit-integrity.test.ts`) | **GREEN** — this file is the disposition source it cascades from |
| 1294 | `every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)` (`docs-review-disposition.test.ts`) | **GREEN** — this file is that disposition |
| 1451 | `path agreement (D-3, D-6 …): the launcher's own repo_root … and the agreed path is not under .claude` (`repo-root.test.ts`) | **STILL RED IN THIS WORKTREE — environment-induced, not a phase-31 defect** |

Re-measured with this file in place:
**`# tests 2920 / # suites 24 / # pass 2913 / # fail 1 / # skipped 1 / # todo 5`** — failures 858
and 1294 both cleared, 1451 unchanged. The two-test delta between the runs is exactly the two
disposition guards this record discharges.

Failure 1451 is stated plainly because the project's standing rule is that this command carries
its own baseline and the honest report is the list. Its assertion message is:

> the agreed directory must not sit under `.claude` — got
> `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-aae6d5eaaad75f3d2/.vice-supervisor`

The cause is structural and wholly outside this plan. `repoRoot()` walks up to the nearest
`.git`; inside a GSD worktree that is a `.git` FILE at the worktree root, and this worktree root
IS `…/.claude/worktrees/agent-…`, so the resolved supervisor directory necessarily sits under
`.claude`. The test is incapable of passing from inside any `.claude/worktrees/**` checkout and
equally incapable of being triggered by this round's changes: `git log -- src/mcp/vice/repo-root.test.ts`
shows its last touch was `fd4e54b` (`test(18-07)`), and `git diff --name-only` across this
plan's commits lists only `.github/workflows/ci.yml` and `src/mcp/vice/skill-attribution.test.ts`.
On the merged main checkout the resolved root is `/home/henrik/dev/henrik/git/c64-re-tools`,
which is not under `.claude`, so the clean floor of **0 failures** holds there. This is recorded
as an execution-environment note, NOT as an accepted defect and NOT as a new baseline.

## Fixed Issues

### CR-01: The two-tree half of the new guard is silently skipped in CI

**Files modified:** `.github/workflows/ci.yml`, `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `20b6a2d`
**Verification report:** gap 1.

The finding's structural argument was confirmed and its consequence reproduced: the run was a
silent PASS, not a skip. Both halves of `missing[0]` were taken, not one — the "either/or" it
offers is not enough on its own, because the CI step alone still leaves a half-failed sync
reading as absence, and the loud skip alone still leaves CI scoring one tree.

- **The workflow.** A new step, `Generate the shipped skills tree (scored by
  skill-attribution.test.ts)`, with `working-directory: installer` and
  `run: node scripts/sync-skills.mjs` — the exact command `installer`'s `prepack` hook runs, so
  this reuses the single existing producer rather than adding a second sync path. Ordered before
  `Test` (line 126 vs 130 vs `Validate npm package contents` at 189), and carrying a comment
  recording that `installer/skills/` is generated and gitignored, that the producer is the one
  `prepack` uses, that the ordering is load-bearing because `check-npm-packages.mjs` further
  down is too late to help, and the specific defect closed. `ci-suite-coverage.test.ts` — the
  only guard that reads that file as structure — is `# fail 0` with both planted-removal tests
  still biting, so the six-space step indentation and the frozen `installer` +
  exact-`npm test` pairing are intact.
- **The verdict.** `skippableEmptyRoot(root, fileCount)` is replaced by
  `emptyRootVerdict(root, fileCount, probe)` returning
  `EmptyRootVerdict { skippable, reason }`. It refuses to skip under CI. Every unscored root is
  pushed onto an `unscoredRoots` ledger with its reason AND announced by a `t.diagnostic()`
  naming the root; an UNCONDITIONAL summary diagnostic reports scored-of-declared, so a one-tree
  run says so in its own output instead of looking identical to a two-tree run; and
  `totals.size + unscoredRoots.length === SKILL_ATTRIBUTION_ROOTS.length` makes a root that is
  neither scored nor recorded a failure rather than a silence.
- `probe` is an explicit `{ rootExists, ci }` object passed in by the call site, never read from
  `existsSync`/`process.env` inside the function. That injection is what lets all five branches
  be asserted deterministically on any machine, instead of only the branch the local tree
  happens to exercise. Five branch assertions replace the previous three, plus one asserting
  every verdict carries a non-empty reason so a reason cannot rot to `""` and take the
  diagnostic's meaning with it.

Reproduced both ways after the fix, as recorded in Verification above: absent tree + `CI=1`
fails naming the shipped root; absent tree with `CI` unset emits the named diagnostic and exits
0.

### CR-02: The byte-exactness claim is false at every block's first and last line

**Files modified:** `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `66d2743`
**Verification report:** gap 2.

Root cause, as the finding states and the verifier reproduced: the predicate's INPUT, not its
comparison. `namingLineCountsIn()` is exact (`===`, no trim, no case folding, no normalisation,
no substring), but it was handed `attributionBlocks()`'s regex capture `m[1]`, which begins
mid-line right after the `ATTRIBUTION (ABS-02)` marker and ends mid-line right before `-->`.
The first and last elements of its `split("\n")` are therefore line FRAGMENTS, so comparing them
with `===` against a whole-line constant behaves like a suffix/prefix match at exactly the two
positions the interior plants cannot reach.

The fix is the line-anchored route `missing[0]` names, not the fragment-dropping one — so a
naming line jammed onto a boundary line is reported as an OFFENDER rather than silently
discarded:

- New `attributionBlockLines(text): string[][]` returns, per block, the file's own WHOLE
  PHYSICAL LINES from the marker's line through that block's closing `-->` line, inclusive. It
  closes a block whose marker and `-->` share one physical line on that same line — leaving it
  open would swallow every following line up to the next `-->` anywhere in the file, which is
  the single-line hole `WR-02` records on the gate's own extractor.
- `namingLineCountsIn` now takes `readonly string[]`. **The parameter type is what makes the
  `grep -rx` claim true, rather than a promise in prose:** a capture-group fragment is not
  merely unlikely to reach it, it cannot be expressed. Both comment sites the verification
  report names (the predicate's own doc comment and the `EQUALITY IS BYTES` doctrine block above
  `ABS02_ADAPTED_LINE`) were rewritten to say so.
- **Every** call site was re-pointed, not only the ones the other changes passed through. This
  was the load-bearing part: retyping the parameter makes typecheck force each site to change,
  and the cheapest change at two of them is `attributionBlocks(...)[0].split("\n")` — which
  typechecks, passes on today's tree (all 10 real blocks have empty boundary fragments) and
  silently reinstates the fragment-bearing input. The five sites now read: the per-file scoring
  read and the unmutated control take `attributionBlockLines()` results directly; plants A and B
  map over that line array (each keeping an anchor-found assertion, so a plant whose anchor
  drifted cannot pass by mutating nothing); the negative case is an explicit array literal
  `["nothing to see here"]`. `grep -n 'namingLineCountsIn('` and `grep -n 'attributionBlocks('`
  have DISJOINT hit sets by line number — no capture feeds the predicate anywhere in the file.
- A per-file assertion that `attributionBlockLines(text).length === attributionBlocks(text).length`,
  naming the file and both counts, so the two extractors cannot drift on where a block begins
  and ends. The capture-based one keeps its own job (isolating a block's CONTENT to match a
  registry row by the upstream file it names); the line-based one owns byte-exactness.
- The two BOUNDARY plants `missing[1]` requires, both in memory, each paired with a control one
  newline away so neither can be vacuous, and each asserting its synthetic text yields exactly
  one block so a plant that failed to parse cannot pass by scoring nothing:
  head plant (marker + adapted line on one physical line) → `{ adapted: 0, repository: 1 }`,
  head control → `{ 1, 1 }`; tail plant (source-repository line + `-->` on one line) →
  `{ adapted: 1, repository: 0 }`, tail control → `{ 1, 1 }`.

Non-vacuity proven by inversion in an out-of-repo scratch copy (see Verification).

### WR-01: A shipped tree that exists but holds no `SKILL.md` is silently skipped

**Files modified:** `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `20b6a2d`
**Verification report:** gap 1 `missing[1]`.

The skip is now keyed on ABSENCE, never on emptiness. `emptyRootVerdict()`'s branch 4 returns
`skippable: false` for a shipped root that EXISTS but yields no `SKILL.md`, with the reason
"that is an interrupted or partial sync, not an un-run one". Reproduced: an empty
`installer/skills/` fails even with `CI` unset, where before it was indistinguishable from a
fresh clone. Branch 5 — absent, outside CI — is the only skippable case, and even it records a
reason and emits a diagnostic.

**What is NOT fixed, stated explicitly rather than left implied.** The finding's second half is
untouched: `walkSkills()` still has `catch { return; }` around `readdirSync` inside
`scripts/lib/skill-corpus.mjs`, so an `EACCES` or a broken symlink on a scanned root is still
indistinguishable from absence at that layer. For the SHIPPED root specifically that residual is
now closed from above — the verdict consults `existsSync(root)`, so a root that exists but walks
to nothing fails regardless of why the walk came back empty. The underlying swallow belongs to
whoever owns that shared module; this round was fenced to two files and did not touch it.

### WR-03: `ABS02_BLOCKS_PER_TREE_FLOOR = 5` is a magic literal that cannot ratchet

**Files modified:** `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `66d2743`

`const ABS02_BLOCKS_PER_TREE_FLOOR: number = manifest.procedures.length;`, replacing the literal
`5`. `grep -c 'ABS02_BLOCKS_PER_TREE_FLOOR = 5'` → `0`. The existing positive-floor assertion
already guards a bad derivation.

**Why fixed rather than accepted** — the reviewer classed it a warning and the hole is caught
elsewhere, so accepting it was available. It was fixed because it is the exact defect class this
project has already been bitten by twice (a pinned count that grows per milestone going red on a
correct tree, recorded for both the installer skill-count pin and the audit-integrity census
assertions), and because it sat in the same file as the doctrine block disclaiming it: "Nothing
here compares a count against `10`, or against `5`-as-an-equality." A guard whose own comment its
code falsifies is this project's named antipattern, and this round exists to close one instance
of exactly that.

### WR-05: The file's normative header under-counts its own rot guards

**Files modified:** `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `20b6a2d`

`NON-VACUITY, five ways` → `six ways`, with an item 6 that describes the per-block two-naming-line
scoring across BOTH trees, states that this is the one guard in the file reading
`installer/skills/` as well as `src/skills/`, names the CI step that makes the shipped half
reachable, and points at `emptyRootVerdict()` for the no-silent-skip rule.
`grep -c 'the header enumerates five'` → `0`: the body aside that pointed at the discrepancy
instead of fixing it is gone, since institutionalising a known error in a header CLAUDE.md makes
normative is the defect the convention exists to prevent.

### WR-06: PLANT A depends on the upstream name's first character having a distinct uppercase form

**Files modified:** `src/mcp/vice/skill-attribution.test.ts`
**Commit:** `66d2743`

`const mutatedAdapted = ABS02_ADAPTED_LINE[0].toLowerCase() + ABS02_ADAPTED_LINE.slice(1);` —
the mutation is now on the constant's own fixed prefix, whose case is guaranteed distinct. The
`nameAt` index lookup and its guard assertion are gone (`grep -c 'nameAt'` → `0`). The `length`
and exactly-one-differing-position assertions stay and still hold.

**Why fixed rather than accepted:** the premise holds today (`r` → `R`), so nothing is broken
right now. But the failure mode is a RED TEST ON A CORRECT TREE, triggered by a legitimate
manifest change to an upstream name beginning with a digit, hyphen or underscore — all legal in
a repository name. That is precisely what this file's own doctrine block was written against,
and a guard that cries wolf on correct trees is a guard someone eventually switches off.

## Skipped / Accepted Issues

### WR-02: Two divergent ABS-02 block extractors — DEFERRED

**Trigger to reopen:** Phase 32's `CUT-04` retrospective non-vacuity audit of the re-pointed
guard set, which is where the removal gate's own non-vacuity is re-measured.

Partially addressed, and the part that was addressed is recorded honestly. The two extractors
INSIDE `skill-attribution.test.ts` are now asserted to agree on block COUNT per scanned file, and
the new `attributionBlockLines()` closes the single-line-block hole on its own side. What was NOT
done is the consolidation the finding actually asks for: moving a shared
`skillAttributionBlockSpans()` into `scripts/lib/skill-corpus.mjs` and having both
`scripts/check-no-regenerator2000.mjs` and this test delegate to it. That requires editing the
removal gate's block extractor, and `31-VERIFICATION.md` § "Scope note for any gap-closure round"
fences this round to two files. The gate's own damage remains bounded by its exact hit-count pins
rather than by the anchor agreement its header claims — which is the finding's real content and
stays true.

### WR-04: The re-pointed prose cites a mutable ROADMAP ordinal — ACCEPTED as a residual

**Trigger to reopen:** the next `D-NN` renumbering that moves the criterion ordinal, or Phase
32's audit of that gate — whichever comes first.

The fix the finding proposes is correct: anchor on the stable requirement id `REPOINT-03`, which
does not renumber, instead of `ROADMAP Phase 31 criterion 1`. It is not applied because both
sites are inside `scripts/check-no-regenerator2000.mjs`, which this round may not touch — the
verification report's scope note names two files and `.planning/` documents, and the standing
prohibition is that no pin, needle or scope predicate in that gate moves. Accepting a known
recurrence risk is the honest position here rather than pretending the citation is durable: this
is already the second renumbering of the same sentence in three days, and nothing mechanically
checks it.

### IN-01: Inconsistent coercion and separator handling around the derived constants — ACCEPTED, no change

Cosmetic consistency on the derivation line. The reviewer confirms neither variant is
exploitable: a non-string or separator-bearing `manifest.repository` reddens the loud `endsWith`
assertion before the corpus scan runs, and the scoring test asserts the derivation's shape
directly. The derived `ABS02_UPSTREAM_NAME` is the one constant the entire guard is built from —
both naming lines and every plant derive from it — so editing its derivation line for tidiness
carries real risk against zero correctness gain. Left as is deliberately.

### IN-02: `NOTICES_FILES` is duplicated across both reviewed files — ACCEPTED, no change

Same class as `WR-02` (a cross-cutting seam re-derived locally) and deferred to the same trigger:
Phase 32's `CUT-04` audit. The fix requires a shared export consumed by
`scripts/check-no-regenerator2000.mjs`, which this round may not edit. Pre-existing; not
introduced or worsened by phase 31.

### IN-03: The new constants deepen module-load coupling to an archivable `.planning/` path — ACCEPTED, no change

The reviewer's own verdict is "no change required now", and this record agrees. The failure is
loud (a module-scope `readFileSync` throw takes the whole file with it), not silent, so it is
informational. The reviewer's actual ask is bookkeeping: `skill-attribution.test.ts` now has
FOUR call sites reading the phase-19 manifest rather than one, so whenever `WR-11` (the deferred
archival-fragility item) is taken up, its resolution must cover all four together rather than
the single site it was originally scoped against. That is recorded here so `WR-11`'s eventual
owner finds it.

## Scope Statement

This round edited exactly three files:

- `.github/workflows/ci.yml`
- `src/mcp/vice/skill-attribution.test.ts`
- `.planning/phases/31-procedure-re-pointing/31-REVIEW-FIX.md` (this file)

**Deliberately NOT touched**, verified by
`git status --porcelain` over each path returning empty:
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`,
`scripts/check-no-regenerator2000.mjs`, `.planning/STATE.md`, `.planning/ROADMAP.md`,
`.planning/REQUIREMENTS.md`. Nothing under `src/skills/**` was edited and no planted violation
was ever written into either skill tree — every plant lives in memory as a string.
`installer/skills/**` was produced only by the existing `sync-skills.mjs` producer.

**No pending todo was filed.** `git status --porcelain .planning/todos/pending/` is empty. A
pending todo needs a matching `STATE.md` Deferred Items row in the same commit, `STATE.md` is out
of this plan's scope, and a mismatch reddens `docs-deferred-ledger.test.ts` and the
`audit-integrity` cascade. Every deferral above is recorded in this file with its trigger
instead.

**Requirement status.** `REPOINT-03` and `REPOINT-04` remain `Pending`. `REPOINT-04` was scored
✓ SATISFIED on the merits by `31-VERIFICATION.md` (truths 3, 4 and 7, all by direct measurement)
and this round asserts only its NON-REGRESSION — the manifest path shows no working-tree change
and `anno-derivation.test.ts` is green. Under `REQUIREMENTS.md`'s standing four-sites-one-edit
rule it moves WITH `REPOINT-03` on a re-verification verdict, not ahead of it. Neither row may be
promoted from this file.

## Residuals Carried Forward

Named here in one place so a later reader does not have to reconstruct them from the sections
above:

| Finding | Disposition | Trigger to reopen |
|---|---|---|
| `WR-02` | Deferred — count agreement asserted, extractors not consolidated | Phase 32 `CUT-04` audit of the re-pointed guard set |
| `IN-02` | Deferred with `WR-02` — same seam, same blocker | Phase 32 `CUT-04` audit |
| `WR-04` | Accepted residual — ROADMAP-ordinal citation in the removal gate | Next `D-NN` renumbering, or Phase 32's audit of that gate |
| `IN-01` | Accepted — cosmetic; loud assertion already covers the risk | None; revisit only if the derivation line changes for another reason |
| `IN-03` | Accepted — bookkeeping for `WR-11`'s eventual resolution (four call sites, not one) | `WR-11` being taken up |
| `walkSkills` `EACCES` swallow | Not in scope this round; closed from above for the shipped root only | Whoever next owns `scripts/lib/skill-corpus.mjs` |
| `repo-root.test.ts` `.claude` path assertion | Execution-environment artefact of running inside a GSD worktree; green on main | None — not a defect |

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-executor, plan 31-04)_
_Iteration: 1_
