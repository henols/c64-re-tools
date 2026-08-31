---
phase: 32-the-deletion-and-the-grep-gate
plan: 12
subsystem: audit-tooling
tags: [gap-closure, cut-04, cr-03, split-read, refusal, contract-assertion, non-vacuity]
status: complete
requires:
  - "scripts/lib/audit-root.mjs — parseRootArg() and resolveContainedRoot() (plans 32-10, 32-11)"
  - "src/mcp/vice/audit-root-args.test.ts — the six-script spawned matrix and its synthetic-tree helper (plan 32-11)"
provides:
  - "Four gates refuse a root their statically-bound comparison data cannot follow, naming the identifiers that make it impossible"
  - "The writing script can be pointed at no tree but the real one, and a refused root causes no I/O at all"
  - "splitReadRefusalReason() — the reason text built once rather than copy-pasted four times"
  - "A contract assertion that goes red if a future phase reintroduces the split read, non-vacuous in both directions"
  - "The false docblock sentence deleted from the three files that contradicted it, replaced by what each file actually does"
  - ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-root-seam-coverage.md — the closure raw"
affects:
  - "scripts/generate-tool-support-table.mjs, check-skill-tool-coverage.mjs, check-skill-fork-honesty.mjs, check-skill-cli-invocations.mjs"
  - "scripts/lib/audit-root.mjs (one new export; no existing behaviour changed)"
  - "src/mcp/vice/audit-root-args.test.ts (36 -> 44 cases)"
tech-stack:
  added: []
  patterns:
    - "third failure class at the same exit code, separated by prefix: BAD ARGUMENTS -- / REFUSED -- / SPLIT READ REFUSED --"
    - "reason text built once in the seam, prefix written per consumer (IN-06 not re-committed)"
    - "text-predicate contract assertion driven against real files AND planted texts, one predicate for both"
    - "the antecedent's population asserted, not just the absence of violations (CUT-03's anti-vacuity rule)"
key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-root-seam-coverage.md
  modified:
    - scripts/lib/audit-root.mjs
    - scripts/generate-tool-support-table.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-skill-cli-invocations.mjs
    - src/mcp/vice/audit-root-args.test.ts
decisions:
  - "REFUSAL, not root-parameterised dynamic imports. The verifier named two acceptable remedies; the dynamic-import route needs every synthetic tree to carry a working src/mcp/vice/ module graph, at which point it is a copy of the repository rather than the small planted corpus D-06 exists to point at."
  - "The refusal REASON lives once in scripts/lib/audit-root.mjs; only the `<script>: SPLIT READ REFUSED --` prefix and the identifier list are per-consumer. This mirrors the split resolveContainedRoot() already uses and avoids re-committing IN-06 (one reader copy-pasted six times) at four copies."
  - "The contract assertion is a TEXT predicate, not a behavioural one, because the antecedent ('binds a ../src specifier statically') is a property of the module graph and is not observable from outside the process. The spawned matrix proves the consequent behaves; the text predicate proves the implication holds for the whole population, including scripts a future phase adds."
  - "check-skill-cli-invocations.mjs's now-unreachable `else` arm (the installer/skills regeneration SKIP under a --root tree) was deliberately LEFT IN PLACE, per the plan's action D. Deleting it would make a future re-enabling of an arbitrary root silently spawn sync-skills.mjs from an operator-supplied tree — T-32-08, the exact thing that branch exists to prevent."
  - "generate-tool-support-table.mjs's paths() docblock was NOT deleted: measured, its sentence count for the false claim is 0. It carries a different, TRUE claim about paths, to which a clarifying paragraph was appended stating what it does not cover."
metrics:
  duration: ~55 min
  completed: 2026-09-01
actuals:
  tokens: 51000
  tasks: 2
  commits: 2
---

# Phase 32 Plan 12: The Split Read Summary

Four audit gates that read their corpus from a `--root` tree while importing
their comparison data from the repository — three of them under a docblock
sentence forbidding exactly that — now refuse the root outright, naming the
identifiers that make honouring it impossible, and a contract assertion that is
non-vacuous in both directions keeps them that way.

## Measurement method, stated before any number

Every figure below is the output of a command quoted beside it or in
`evidence/32-gap2-root-seam-coverage.md`. Nothing here was reasoned from the
diff. Baselines were measured at `7206f99` (this branch's base) BEFORE the first
edit, not recalled.

**Broker state, established once and true for every run in this document:**

```
$ pgrep -af 'vice-broker|x64sc' | grep -v -- "--test"
(no output)   filtered-exit=1
```

No VICE broker and no `x64sc` process was running, so neither `BACK-05` nor the
`stock-broker-live` family was contaminated. The `--test` filter is required
because `node --test` runs list `vice-broker-*.test.ts` in their own argv.

## The four bare-run exit statuses, before and after

Command: `node scripts/<name>.mjs` with no arguments at all.

| Script | Bare exit at `7206f99` (before) | Bare exit after | Changed? |
|---|---|---|---|
| `generate-tool-support-table` | 0 | 0 | no |
| `check-skill-tool-coverage` | 0 | 0 | no |
| `check-skill-fork-honesty` | 0 | 0 | no |
| `check-skill-cli-invocations` | 0 | 0 | no |

The two untouched root-accepting scripts are also unchanged at 0
(`check-guard-fates`, `check-skill-description-overlap`), and
`docs/tool-support.md` regenerates byte-identical (`regen-exit=0`,
`git diff --exit-code` = 0).

## Task 1 — the split read, settled

`scripts/generate-tool-support-table.mjs` was done FIRST, as the plan requires,
because it is the one audited script that WRITES.

Each of the four now carries a third failure class, checked after containment
succeeds and **before `paths()` is built, before any `existsSync`, before the
first read and before any write**:

```
<script>: SPLIT READ REFUSED -- <reason>
```

exit 1 — the same status as the other two classes, separated by its prefix, with
no new exit code minted.

### The four refusal messages in full

They share one body, built by `splitReadRefusalReason()` in
`scripts/lib/audit-root.mjs`. Only the prefix and the identifier list differ, so
they cannot drift apart. The generator's, complete:

```
generate-tool-support-table: SPLIT READ REFUSED -- --root resolves to /…/.audit-root-synth-verify-Y3ONHf, which is not this repository's root /…/agent-a1e16d869eb90f17e. This script reads its CORPUS from the resolved root, but its COMPARISON DATA arrives through static imports that cannot follow a root override: the identifiers are `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts`, `DENY_LIST` from `../src/mcp/vice/vice.ts`. A static import specifier is resolved against this file's own location, so honouring the root would compare a corpus read from /…/.audit-root-synth-verify-Y3ONHf against comparison data read from /…/agent-a1e16d869eb90f17e -- a FALSE GREEN rather than a stricter check, because a violation planted in the resolved tree would be measured against data the plant never touched. Refusing rather than half-honouring it (CR-03). Only a --root that RESOLVES to /…/agent-a1e16d869eb90f17e is accepted here. `scripts/check-skill-description-overlap.mjs` is the one skill gate that binds no such import and does honour an arbitrary contained root.
```

The other three differ only in their prefix and their identifier clause:

| Script | Identifier clause printed |
|---|---|
| `check-skill-tool-coverage` | the identifiers are `` `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts`, `CURATED_ANNO_TOOLS` from `../src/mcp/vice/anno-tools.ts` `` |
| `check-skill-fork-honesty` | the identifier is `` `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts` `` |
| `check-skill-cli-invocations` | the identifier is `` `VERB_OPTIONS` from `../src/mcp/vice/anno-cli.ts` `` |

All four are quoted with their full bodies and their raw exit statuses in
`evidence/32-gap2-root-seam-coverage.md` §2b.

### What the refusal replaced — the hybrid, reproduced at `7206f99`

Before the edit, all four exited **0** against an in-repository synthetic tree.
Each message is a hybrid, and reading them carefully is what makes the defect
visible rather than merely asserted:

- `check-skill-tool-coverage`: `OK -- 37 distinct vice_* names extracted from 33
  files across 7 skill directories … anno_*: 18 distinct names extracted, all
  curated (CURATED_ANNO_TOOLS has 19 entries).` The NAMES came from the synthetic
  corpus; the two tables they were checked against came from the repository.
- `check-skill-fork-honesty`: `OK -- 11 fork-only mentions … 24 fork-only names
  policed from CAPABILITY_REGISTRY`. Mentions synthetic, names real.
- `check-skill-cli-invocations`: `OK -- 18 documented anno CLI invocation(s) …
  every flag checked against anno-cli.ts's own VERB_OPTIONS`. Invocations
  synthetic, `VERB_OPTIONS` real.
- `generate-tool-support-table`: `wrote docs/tool-support.md under --root …` —
  **8132 bytes**, rendered from the synthetic manifests against the real registry
  and the real deny-list, into the synthetic tree, exiting 0 while printing
  success.

After: `synth-table=ABSENT`, `git diff --exit-code -- docs/tool-support.md` = 0.
A refused root now produces no I/O at all.

### The accept side — three spellings, plus a fourth

A root that RESOLVES to the repository root is the same tree however it is
spelled, so the comparison is against resolved paths:

| Script | `--root .` | `--root <abs>` | `--root <abs>/scripts/..` | `--root ./scripts/..` |
|---|---|---|---|---|
| `generate-tool-support-table` | 0 | 0 | 0 | 0 |
| `check-skill-tool-coverage` | 0 | 0 | 0 | 0 |
| `check-skill-fork-honesty` | 0 | 0 | 0 | 0 |
| `check-skill-cli-invocations` | 0 | 0 | 0 | 0 |

The plan asked for three spellings; a fourth (relative-with-redundant-segment)
was added because it is free and it is the one a shell user is most likely to
type by accident.

### The docblock sentence — measured counts, before and after

```
$ grep -c 'do not re-derive a path from' <the six root-accepting scripts>
```

| Script | Before | After | Note |
|---|---|---|---|
| `check-skill-tool-coverage` | 1 | **0** | contradicted two lines above itself |
| `check-skill-fork-honesty` | 1 | **0** | contradicted sixteen lines above itself |
| `check-skill-cli-invocations` | 1 | **0** | contradicted twenty-nine lines above itself |
| `generate-tool-support-table` | **0** | 0 | **measured, not assumed — see below** |
| `check-skill-description-overlap` | 1 | 1 | TRUE there; untouched, as the plan requires |
| `check-guard-fates` | 0 | 0 | never carried it |

**The verifier wrote "4/5 files also carry the contradicting docblock". Measured,
it is 3.** `scripts/generate-tool-support-table.mjs` carries a DIFFERENT sentence
— "do not reintroduce a second path constant derived from `DEFAULT_ROOT` outside
this function" — which is about paths only and is true. Per the plan's explicit
instruction it was NOT deleted; a clarifying paragraph was appended stating what
it does not cover (the two static imports are not paths, and no argument can move
them) and that `main()` now refuses a non-default root before `paths()` runs.

Each deletion was replaced by the true statement of what that file does: which
identifiers it binds statically, that they cannot follow a root override, that a
non-default root is therefore refused rather than half-honoured, and a `CR-03`
back-reference so a later reader finds the reasoning rather than re-deriving it.

```
$ grep -c 'CR-03' <the four modified scripts>
check-skill-tool-coverage.mjs:2   check-skill-fork-honesty.mjs:2
check-skill-cli-invocations.mjs:2  generate-tool-support-table.mjs:3
```

At least 1 each, as required.

### The two clean controls, measured (plan action E)

```
$ grep -cE '^import .* from "\.\./src' scripts/check-guard-fates.mjs scripts/check-skill-description-overlap.mjs
scripts/check-guard-fates.mjs:0
scripts/check-skill-description-overlap.mjs:0

$ grep -c 'from "\.\./src/' <the same two>        # broader, formatting-insensitive
scripts/check-guard-fates.mjs:0
scripts/check-skill-description-overlap.mjs:0
```

**Zero under both forms**, so neither is exempt by an accident of import
formatting. Neither was widened. The four modified scripts measure 2/1/1/2 under
the broad form — exactly the verifier's count, unchanged: the static imports are
not the defect and the remedy does not remove them.

## Task 2 — the contract, and the evidence

### The rule, in the form a future reader can act on

> A script that accepts a `--root` override may NOT statically import its
> comparison data from the default root unless it also refuses a root that is not
> the default root.

Named in the test's own comment as the invariant companion to plan 32-10's
`<assumption_delta_decision>` (the promotion that exactly one root governs every
read in one invocation), so the two are findable from each other.

### `node --test audit-root-args.test.ts`

```
1..44
# tests 44
# pass 44
# fail 0
# skipped 0
# todo 0
# duration_ms 11849.343206
```

Exit 0. 36 → 44 (+8): four repository-root-spelling acceptances and four contract
assertions. The four contained-root cases were TIGHTENED, not added, so they do
not move the count. File is 553 → 866 lines (plan floor: `min_lines: 300`).

### Non-vacuity, both directions

**Positive.** Case 42 asserts the antecedent selected **at least 4** of the 6
scripts and names them, then asserts each carries the refusal. A rule that passes
because nothing matched proves nothing — `CUT-03`'s own failure mode. The two
clean controls are asserted by **deep equality** against
`["check-guard-fates", "check-skill-description-overlap"]`, not left to pass by
silence, so a future edit giving either a `../src` import without a refusal fails
here instead of sliding past as "still no violations found".

**Negative, at unit level.** Case 44 plants a synthetic script text carrying the
static import and no refusal, and drives the **same** `violatesSplitReadContract()`
the six real files are driven through — this repository's planted-violation
convention (see `guard-fates.test.ts`), with file text in place of a registry
object. It then plants the FIX into the same text and asserts the predicate clears
it. The second half matters as much as the first: without it the predicate could
be reporting the import rather than the missing refusal, and every refusing script
would be a false positive that happened to pass for the wrong reason.

**Negative, against the real tree — the deliberate deletion check.**

```
$ perl -pi -e 's/SPLIT READ REFUSED/ROOT NOT HONOURED/g' scripts/check-skill-fork-honesty.mjs
$ node --test audit-root-args.test.ts
exit=1
# tests 44   # pass 42   # fail 2
not ok 31 - check-skill-fork-honesty: a contained root that is not the default root is a SPLIT READ refusal
not ok 42 - split-read contract: every root-accepting script that binds ../src statically refuses
```

**Exit status 1; failing assertions named above.** Both halves went red — the
BEHAVIOURAL case (the spawned process no longer prints the literal) and the
CONTRACT case (the text is selected by the antecedent and no longer satisfies the
consequent). One would have sufficed to fail; two failing is what shows they are
independent assertions rather than one counted twice.

Restored, tree byte-identical:

```
$ grep -c 'SPLIT READ REFUSED' scripts/check-skill-fork-honesty.mjs   ->  1
$ git diff --stat -- scripts/check-skill-fork-honesty.mjs             ->  (empty)
$ git status --porcelain   ->  unchanged from before the check
```

### The targeting control

`check-skill-description-overlap` is handed exactly the kind of root the other
four now refuse and must NOT refuse — its comparison data follows `--root`. Case
38 gained `assert.ok(!r.stderr.includes(SPLIT_READ_REFUSAL))`. Without it, a
future change could make the refusal blanket, killing the one root override that
works, and every other case in the file would still pass.

### The NUL-byte fact, measured

Case 41 asserts none of the six scripts contains a NUL byte, so the text
predicates lose nothing. Recorded as measured rather than assumed: a source file
in this repository is known to carry one, hiding it from a plain `grep`, and it
has already produced one false decision. (One was introduced into the test file
during drafting and removed before the commit — see Deviations.)

### The evidence file

`.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-root-seam-coverage.md`
— NEW, 7 occurrences of `definitely-not-here`, and it corrects nothing. It records
all **four** ✗ FAIL rows from `32-VERIFICATION.md`'s "Behavioural Spot-Checks"
(the plan says three; the table carries four, so all four are recorded), each with
its before-value CITED from that table and its after-value measured raw; the four
before-hybrid reads in full; the four refusals in full; all 44 matrix cases; the
two clean controls' counts; the machine state; and `git status --porcelain` before
and after.

```
$ git diff --name-only    # for Task 2
src/mcp/vice/audit-root-args.test.ts
$ git diff --name-only | grep -E 'SUMMARY|VERIFICATION|evidence/'
(no match, grep-exit=1)
```

No `*-SUMMARY.md`, no `32-VERIFICATION.md` and no pre-existing `evidence/*.md`
was edited.

## Full verification run

| # | Command | Result |
|---|---|---|
| 1 | the four bare runs, before vs after | all 0, all unchanged |
| 2 | the four split-read refusals | exit 1 each, full messages recorded |
| 3 | four spellings resolving to the repository root, per script | 16/16 exit 0 |
| 4 | `node --test audit-root-args.test.ts` | 44 tests, 44 pass, 0 fail, exit 0 |
| 5 | deliberate deletion check | exit 1, cases 31 + 42 red, tree restored |
| 6 | `npm run typecheck` (in `src/mcp/vice`) | exit 0, no diagnostics |
| 7 | `npm run test:automated` (in `src/mcp/vice`) | 2994 tests, 2987 pass, **1 fail**, 1 skipped, 5 todo — see below. Broker: NOT running |
| 8 | `node scripts/check-guard-fates.mjs` | exit 0 — blocking CI gate green after all three Gap-2 plans |
| 9 | `node scripts/check-no-regenerator2000.mjs` | exit 0 |
| 10 | the nine `docs-*.test.ts` guards, individually | 9/9 exit 0 |
| 11 | `git status --porcelain` before/after | byte-identical; no `.audit-root-synth-*` survived |

### The one `test:automated` failure is the worktree-location artifact

```
not ok 5 - path agreement (D-3, D-6, THE regression this task exists to catch):
  the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
  supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

`src/mcp/vice/repo-root.test.ts:178` asserts the resolved supervisor directory is
NOT under `.claude`. True on the main checkout, **false by construction** for any
GSD worktree, which lives at `<repo>/.claude/worktrees/agent-<id>`. It failed
identically for plan 32-10 in wave 1 and 32-11 in wave 2; this plan touches five
`scripts/*.mjs`, one test file and one new evidence document, none of which
`repo-root.test.ts` reads.

Deliberately NOT "fixed" — making a guard green under a condition it correctly
detects is the exact vacuity this phase exists to catch. **Expected on the merged
branch: 0 failures.** Recorded here rather than in `deferred-items.md` because it
is an execution-environment artifact, not a repository defect.

Test count moved 2986 → 2994 (+8), matching the eight new cases exactly.

## Deviations from Plan

**1. [Scope] `scripts/lib/audit-root.mjs` was modified; it is not in the plan's
`files_modified`.**
- **Found during:** Task 1, designing the refusal.
- **Issue:** The refusal's reason text is ~12 lines of near-identical prose across
  four files, differing only in the identifier list. Writing it inline four times
  re-commits `IN-06` — the defect this very seam exists to remove, where one
  reader copy-pasted into six files shipped one bug six times.
- **Fix:** one new export, `splitReadRefusalReason()`, building the reason once.
  The `<script>: SPLIT READ REFUSED --` PREFIX stays at each call site, exactly as
  `REFUSED --` already does, so a refusal always names the script that refused.
- **Why this is the right call rather than plan drift:** it is this project's
  stated "single seam per concern" convention (CLAUDE.md), and it satisfies the
  plan's own artifact contract unchanged — all four scripts still `contain:
  "SPLIT READ"`, `grep -c 'SPLIT READ REFUSED'` returns 1 in each, and the
  deletion check proves the literal is load-bearing in each file individually.
- **No existing behaviour in that module changed.** `parseRootArg()` and
  `resolveContainedRoot()` are untouched; `audit-root.d.mts` needed no new
  declaration because no TypeScript file imports the new export.
- **Commit:** `2916b10`

**2. [Rule 3 — Blocking] `npm ci` run to provision `src/mcp/vice/node_modules`.**
- **Found during:** Task 1, before the first typecheck.
- **Issue:** git worktrees do not carry gitignored paths, so the worktree had no
  `node_modules`; `typecheck` and `test:automated` cannot run without it.
- **Fix:** `npm ci` in `src/mcp/vice`, from the **committed lockfile**. This is
  the repository's own documented provisioning step
  (`scripts/ensure-mcp-deps.sh` runs exactly this on `SessionStart`).
- **Why this is not the excluded case:** the package-manager exclusion exists to
  stop an agent installing a *named* package that may be slopsquatted or
  hallucinated. `npm ci` adds no dependency, resolves nothing by name, and cannot
  deviate from `package-lock.json`. No manifest and no lockfile was modified.
- **Files modified:** none (`node_modules/` is gitignored).

**3. [Rule 1 — Bug, self-inflicted, fixed before commit] A literal NUL byte was
written into the test file.**
- **Found during:** Task 2, immediately after drafting case 41.
- **Issue:** the NUL-byte assertion was written as `.includes("<NUL>")` with an
  actual 0x00 in the source — reproducing, in the very test that measures the
  hazard, the defect it measures. `cat -A` showed `^@`; a plain `grep` for the
  line returned nothing.
- **Fix:** replaced with the escape `" "`. Verified with `cat -A`. Committed
  only after the replacement, so no NUL byte exists in any commit on this branch.
- **Files modified:** `src/mcp/vice/audit-root-args.test.ts`
- **Commit:** `2c375da`

**4. [Deliberate widening, recorded rather than absorbed] The test file's
"never run the SAME script to completion twice" rule was relaxed, in the file's
own header.**
- The `[edge:CUT-04/adjacency]` accept side requires proving that a root
  RESOLVING to the repository root behaves like the unflagged run — a claim about
  a COMPLETED run — in every spelling. That is four scripts × four runs.
- The new budget is stated in the header rather than quietly spent: 16 additional
  full runs at a measured 194/299/151/353 ms each, ≈4 s, against a file that ran
  in 6 s and now runs in 11.8 s. Total end-to-end runs in the file: 19.
- The one script with a working-tree side effect under the default root (the
  invocations gate, which regenerates `installer/skills/`) is idempotent, and the
  `git status --porcelain` before/after in the evidence file confirms it.

**No other deviations.** No relaxation hatch of any kind was added — no env var,
no `--force`/`--skip`/`--allow-split-read`, no waiver file, no allow-list. No
evidence record, `*-SUMMARY.md` or `32-VERIFICATION.md` was edited to make
anything green.

## Known Stubs

None. All four refusals are live and asserted against real spawned processes; the
contract assertion drives real file text and is proved non-vacuous in both
directions against a planted violation AND against a planted fix.

One piece of **intentionally dead code** is recorded rather than hidden:
`scripts/check-skill-cli-invocations.mjs`'s `else` arm — the branch that SKIPS the
`installer/skills/` regeneration when the root is not this repository — is now
unreachable, because the only roots that reach it are `DEFAULT_ROOT`. The plan's
action D requires it stay exactly as it is, and that is the right call
independently: deleting it would mean a future re-enabling of an arbitrary root
silently spawns `installer/scripts/sync-skills.mjs` from an operator-supplied
tree, which is `T-32-08`. A comment at the refusal site says all of this in place.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema at a
trust boundary.

`T-32-07` (spoofing: a gate pointed at a synthetic corpus comparing it against
the REAL registry and reporting green) is **mitigated**, and the mitigation is
measured: all four went from a green exit 0 with a hybrid report to a named
exit 1 that enumerates the identifiers it could not move.

`T-32-01` (tampering: the writing script's root → file write) is **closed by
construction**. The refusal precedes `paths()`, so a refused root writes nothing
anywhere — not the wrong table, not the right one. `synth-table=ABSENT` and
`git diff --exit-code -- docs/tool-support.md` = 0 after every refusal.

`T-32-02` (lexical containment vs. an in-repository symlink pointing outward,
`WR-04`) remains `accept`ed at ASVS L1 and OPEN in the findings todo. Its reach is
materially smaller now: four of the six scripts accept only the default root,
where the containment question does not arise at all.

`T-32-08` (spawning `sync-skills.mjs` from an operator-supplied tree) is
**unreachable** rather than merely guarded — the refusal fires before the branch.
The branch is kept anyway; see Known Stubs.

`T-32-SC` (package-manager installs): the only package-manager command run was
`npm ci` from the committed lockfile, which resolves nothing by name. No
package-legitimacy checkpoint is owed.

## TDD Gate Compliance

Task 2 carries `tdd="true"`, and as in plan 32-11 the gate sequence is **not** the
usual RED-commit-then-GREEN-commit pair, because the plan itself sequences the
implementation into Task 1 and the tests into Task 2. Stated plainly rather than
dressed up:

- **RED was measured, not skipped.** Before any edit, at `7206f99`, all four
  scripts exited **0** against an in-repository synthetic tree while comparing it
  to the real registry — precisely what the new assertions forbid. That baseline
  is quoted verbatim in §2a of the evidence file, including the 8132-byte hybrid
  table. Cases 29–32, 33–36 and 42–43 would all have failed against that tree.
- **A SECOND, sharper RED was run against the finished tree** and is the stronger
  evidence: deleting the refusal literal from one script produced exit 1 with two
  named failures, and the tree was restored byte-identical. That check proves the
  assertions are load-bearing on the code as shipped, which a pre-implementation
  RED cannot.
- **GREEN is commit `2916b10`** (`fix(...)`), the implementation commit, and it
  precedes the test commit rather than following it.
- **No REFACTOR gate commit** was needed.

A strict per-task RED→GREEN commit pair was not achievable under the plan's own
task ordering. This is a compliance note, not a claim of compliance.

## Scope Fence — Honoured

Untouched, as the plan records: `WR-06` (the fate guard's `redOwed()` predicate —
data audited clean 35/35, so the registry is honest today), `WR-10` (the blocking
CI gate's dependence on live `.planning/` artifacts and its missing removal
trigger — deferred with the judgement recorded, not overlooked), `WR-12`, `WR-13`
(`audit-gate.mjs` and `audit-mutation-harness.mjs` not migrated), `WR-14`, and
broken windows #28–#32. All stay OPEN in
`.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md`.

`WR-11`'s observation stands and is stated in the evidence file's closing section
rather than quietly dropped: the seam still has **no production caller** — the
fate registry passes a root override in 0 of 61 rows and all 35 plants are
`kind: "worktree"`. What keeps the seam honest is the contract assertion, not a
caller. That is a weaker guarantee than a live consumer and is recorded as such.

`scripts/check-skill-description-overlap.mjs` was not edited, as the plan
requires. Nothing was added that traces to neither a verifier truth nor a
`gaps[].missing` line.

## Edge-Coverage Arithmetic

This plan owns **0 of the round's 6 probe items** — they belong to plans 32-10
(3), 32-11 (1), 32-13 (1) and 32-14 (1). Round total, stated in plan 32-10: 6
surfaced == 6 authored (5 explicit + 1 backstop) + 0 flagged assumptions. Nothing
dropped here.

`[edge:CUT-04/adjacency]` is exercised on both sides by this plan: the ACCEPT side
by cases 33–36 (four spellings per script, all resolving to the repository root)
and the REJECT side by cases 29–32 (a contained root that is not the repository
root).

## Commits

| Task | Commit | Type | Message |
|---|---|---|---|
| 1 | `2916b10` | `fix` | four gates refuse a root their comparison data cannot follow |
| 2 | `2c375da` | `test` | the split-read contract, non-vacuous both ways, plus raw closure evidence |

```
$ git diff --diff-filter=D --name-only 7206f99 HEAD
(empty)
```

This branch **deletes no file** — the false docblock sentences are deleted as
LINES inside modified files — so the wave-cleanup step will merge it normally,
exactly as the plan's `net_deletion: false` claims.

## Notes on `actuals`

`tokens: 51000` is `chars/4` over the seven files actually changed (`204188`
chars, `cat … | wc -c`). The realized diff alone is `76867` chars ≈ `19200`
tokens (`git diff 7206f99 HEAD | wc -c`). Both are given because the two methods
differ by ~2.7× here, and reporting only the flattering one would corrupt every
later projection. Against the plan's `estimate: 74000` (confidence `low`), the
whole-file method lands at ~69% of estimate and the diff-only method at ~26%.

The ratio is much tighter than plan 32-11's 5× because this plan's largest single
artifact is a **new** file (the evidence record, ~19k chars) that appears in full
in both measurements, rather than small edits scattered through large existing
files.

## Self-Check: PASSED

- `scripts/lib/audit-root.mjs` — FOUND (`splitReadRefusalReason` exported, 1 definition)
- `scripts/generate-tool-support-table.mjs` — FOUND (`SPLIT READ REFUSED` × 1, `CR-03` × 3, `do not re-derive` × 0)
- `scripts/check-skill-tool-coverage.mjs` — FOUND (`SPLIT READ REFUSED` × 1, `CR-03` × 2, `do not re-derive` × 0)
- `scripts/check-skill-fork-honesty.mjs` — FOUND (`SPLIT READ REFUSED` × 1, `CR-03` × 2, `do not re-derive` × 0)
- `scripts/check-skill-cli-invocations.mjs` — FOUND (`SPLIT READ REFUSED` × 1, `CR-03` × 2, `do not re-derive` × 0)
- `scripts/check-skill-description-overlap.mjs` — UNMODIFIED (`do not re-derive` × 1, still true)
- `src/mcp/vice/audit-root-args.test.ts` — FOUND (866 lines, exceeds `min_lines: 300`; 44 cases, 44 pass)
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-root-seam-coverage.md` — FOUND (`definitely-not-here` × 7)
- Commit `2916b10` — FOUND in `git log`
- Commit `2c375da` — FOUND in `git log`
- All plan-level `<verification>` steps 1–9 run and recorded above.
