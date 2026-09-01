# Gap 2, second half — the mutation harness joins the argv seam

**Date:** 2026-09-01
**Plan:** 32-17 (gap-closure round 2, wave 2)
**Commit measured:** `484bcd4` (Tasks 1 and 2 landed)
**Base:** `b64e9a6` — the wave-1 merge, i.e. plan 32-15 already in.

This file is NEW. It corrects, rewrites and replaces nothing. No dated evidence
record, no `*-SUMMARY.md` and not `32-VERIFICATION.md` was edited by the plan
that produced it.

The subject is the ONE instrument in this phase that both **mutates the working
tree** and **writes the registry and the evidence file** —
`scripts/audit-mutation-harness.mjs`, the sole producer of all 35 recorded
observed reds.

---

## 0. The state of the machine, established once

Every measurement below was taken on the same host, at the same commit, with
the same emulator state. Read-only; nothing was started or stopped (D-13).

Broker state read by the method recorded in
[`32-close-gate.md` §2b](./32-close-gate.md) and its preamble — the `ps | grep -v grep`
form, **not** `pgrep -af`, because the bare `pgrep` form self-matches its own
shell wrapper and would assert a live broker on a host that has none:

```
$ systemctl --user is-active vice-broker
inactive
exit=4
```

```
$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output — no matching process)
```

```
$ ps -eo pid,args | grep -i x64sc | grep -v grep
exit=1          (no output — no emulator running)
```

**No VICE broker and no `x64sc` process was running.** This matters because a
live broker deterministically reds the `BACK-05` test and the
`stock-broker-live` family, and any suite figure quoted without it is
uninterpretable.

```
$ git rev-parse HEAD
484bcd4a6133950dc7a73ba6fae6a0bf943a6a40
```

The measurements ran inside a GSD worktree at
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c`,
so every absolute path quoted below carries that prefix. On the merged branch
the same paths read `/home/henrik/dev/henrik/git/c64-re-tools`.

### `git status --porcelain`, before and after

```
before (at the pre-fix captures):          after (at the last command):
 M scripts/audit-mutation-harness.mjs      (empty)

$ git status --porcelain   ->  empty (exit 0)
```

The one modified path during the §2 measurements was this plan's own Task 2
work in progress; it was committed immediately afterwards as `484bcd4`. The
working `--row` re-run in §5 left a scratch evidence file, which was deleted
inside the same task — see §5 for the raw before/after. **No `git clean` was
run at any point** (it is prohibited inside a worktree), and no plant survived
any run.

---

## 1. The two named defects, reproduced BEFORE the fix

Taken at the pre-fix tree (base `b64e9a6` plus Task 1 only, harness untouched).

### 1a. Defect one — a valueless trailing `--root` silently reads the REAL tree

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --root
audit-mutation-harness: FAIL -- row selection: "src/does/not/exist.ts" matched 0 registry row(s) by `historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE naming the offending entry, never a silent skip.
EXIT=1
```

**Reaching ROW SELECTION is the finding.** Row selection happens only after
`resolveContainedRoot()` has resolved a root, the root has been confirmed to
exist, and `guard-fates.json` has been **read from it**. So the REAL registry
had already been loaded. Nothing in the output mentions `--root` at all — the
operator is given no signal whatsoever that the flag they typed was discarded.

### 1b. Defect two — `--root` swallows the following flag as its value

```
$ node scripts/audit-mutation-harness.mjs --root --row src/does/not/exist.ts
audit-mutation-harness: USAGE -- unrecognised argument "src/does/not/exist.ts". Usage: node scripts/audit-mutation-harness.mjs (--row <historicalPath> | --rows <p,p,...> | --all) [--root <dir>] [--out <file>]
EXIT=2
```

`--row` was consumed as the root's value, leaving the path itself as a stray
token. Note the **exit 2** and the bespoke prefix — both removed by this plan
(§4).

### 1c. The control — the identical message with no `--root` at all

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts
audit-mutation-harness: FAIL -- row selection: "src/does/not/exist.ts" matched 0 registry row(s) by `historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE naming the offending entry, never a silent skip.
EXIT=1
```

**Byte-identical to §1a.** That is the proof that the trailing `--root` was
discarded rather than honoured: the flagged and unflagged invocations are
indistinguishable in their output.

### 1d. The space form works — so the defect is exactly the valueless path

```
$ node scripts/audit-mutation-harness.mjs --root /tmp --row src/does/not/exist.ts
audit-mutation-harness: REFUSED -- --root "/tmp" resolves to /tmp, which is OUTSIDE the repository root /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c. Refusing: this flag decides which tree the audit reads and writes, so it is contained to the repository by construction rather than by convention. Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil` suffix) is refused here too -- the comparison is segment-wise.
EXIT=1
```

### 1e. `--out` and `--rows` carry the identical hole

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --out
audit-mutation-harness: FAIL -- row selection: "src/does/not/exist.ts" matched 0 registry row(s) by `historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE naming the offending entry, never a silent skip.
EXIT=1
```

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --rows
audit-mutation-harness: FAIL -- row selection: "src/does/not/exist.ts" matched 0 registry row(s) by `historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE naming the offending entry, never a silent skip.
EXIT=1
```

Both are byte-identical to the §1c control. Six pre-fix captures in total
(§1a–§1e).

---

## 2. The full malformed-form matrix for all four flags, AFTER the fix

Taken at `484bcd4`. Every row differs from its pre-fix reading.

| # | Command | Pre-fix | Post-fix |
|---|---------|---------|----------|
| 1 | `--row <path> --root` | exit 1, reached ROW SELECTION, no mention of `--root` | exit 1, `BAD ARGUMENTS --` naming `--root`, **never reads the registry** |
| 2 | `--root --row <path>` | exit **2**, `--row` swallowed as the root's value | exit 1, `BAD ARGUMENTS --` stating `--root` was followed by a flag |
| 3 | `--row <path> --out` | exit 1, identical to the control | exit 1, `BAD ARGUMENTS --` naming `--out` |
| 4 | `--row <path> --rows` | exit 1, identical to the control | exit 1, `BAD ARGUMENTS --` naming `--rows` |
| 5 | `--rooot /tmp` | exit **2**, bespoke prefix | exit 1, `BAD ARGUMENTS --` quoting the token |
| 6 | `--root=/tmp` | exit **2**, bespoke prefix | exit 1, `BAD ARGUMENTS --` quoting the token |

Raw output for each.

### 2.1 — trailing `--root` (defect one, closed)

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --root
audit-mutation-harness: BAD ARGUMENTS -- `--root` requires a directory, but it was the last argument. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

**No row-selection message.** The registry was never read. Compare §1a.

### 2.2 — `--root` followed by a flag (defect two, closed)

```
$ node scripts/audit-mutation-harness.mjs --root --row src/does/not/exist.ts
audit-mutation-harness: BAD ARGUMENTS -- `--root` requires a directory, but it was followed by "--row", which is itself a flag. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

### 2.3 — trailing `--out`

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --out
audit-mutation-harness: BAD ARGUMENTS -- `--out` requires a value, but it was the last argument. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

The message names `--out`, **not** `--root`. That is the `valueFlags` design
working: a mistake made on one flag is not reported against another.

### 2.4 — trailing `--rows`

```
$ node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --rows
audit-mutation-harness: BAD ARGUMENTS -- `--rows` requires a value, but it was the last argument. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

### 2.5 — a mistyped token

```
$ node scripts/audit-mutation-harness.mjs --rooot /tmp
audit-mutation-harness: BAD ARGUMENTS -- unrecognised argument "--rooot". Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

### 2.6 — the equals form

```
$ node scripts/audit-mutation-harness.mjs --root=/tmp
audit-mutation-harness: BAD ARGUMENTS -- "--root=/tmp" uses the equals form. The space-separated spelling `--root <dir>` is the ONLY accepted one. Write: node scripts/audit-mutation-harness.mjs --root "/tmp". Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>] [--rows <value>] [--out <value>]
EXIT=1
```

---

## 3. The exactly-one-selector rule — still fires, in both directions

The rule moved out of the deleted argv loop and into the harness proper. Its
**text is unchanged**; only its exit path changed (exit 2 → exit 1).

```
$ node scripts/audit-mutation-harness.mjs
audit-mutation-harness: row selection must be EXACTLY ONE of --row, --rows or --all; got 0. Zero is not a silent full run and more than one is not a merge: a sweep whose selector was mistyped must fail rather than quietly measure a different set of rows than its plan claims.
EXIT=1
```

```
$ node scripts/audit-mutation-harness.mjs --all --row src/does/not/exist.ts
audit-mutation-harness: row selection must be EXACTLY ONE of --row, --rows or --all; got 2. Zero is not a silent full run and more than one is not a merge: a sweep whose selector was mistyped must fail rather than quietly measure a different set of rows than its plan claims.
EXIT=1
```

Message text unchanged, measured:

```
$ grep -c 'must fail rather than quietly measure a different set of rows' scripts/audit-mutation-harness.mjs
1
```

---

## 4. The bespoke exit code is gone

```
$ grep -c 'USAGE --' scripts/audit-mutation-harness.mjs
0
```

**Non-vacuous:** the same command returns `1` at the base commit `b64e9a6`
(`console.error(\`audit-mutation-harness: USAGE -- ...\`)` at `:768`).

```
$ grep -n 'exit(2)' scripts/audit-mutation-harness.mjs
(no output — no code path in the file exits 2)
```

> **A census caveat worth recording**, because this plan hit it twice. The
> obvious way to document a removed literal is to quote it in the comment that
> explains the removal — at which point the census for that literal matches the
> comment and can no longer tell a live defect from its own obituary. Both the
> `USAGE --` comment here and the corrected provenance paragraph in
> `scripts/lib/audit-root.mjs` are therefore written in **reported speech**,
> naming what the old text said without reproducing it verbatim. The censuses
> above are real zeros as a result.

---

## 5. The instrument still works, and its churn was discarded

```
$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-17-scratch.md
audit-mutation-harness: selected 1 row(s)
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  counts: measured=1 skipped=0 total=1
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c/.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-17-scratch.md
  registry: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c/.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
  tree: restored byte-identical to the baseline
EXIT=0
```

An `OBSERVED RED` at exit 0, with a passing green control and the tree restored
byte-identical — exactly as plan 32-15 left it. Churn, before and after:

```
$ git status --porcelain
 M scripts/audit-mutation-harness.mjs
?? .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-17-scratch.md

$ rm .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-17-scratch.md

$ git status --porcelain -- scripts/ .planning/
 M scripts/audit-mutation-harness.mjs
```

**The registry needed no `git checkout --`.** It was rewritten by the run, but
the write-back was byte-identical to what was already committed (the row's
`observedRed` was unchanged), so `guard-fates.json` never appeared as modified.
The scratch evidence file was the only artifact, and it was removed with a
scoped `rm` naming that one path — not `git clean`, which is prohibited inside
a worktree because it deletes feature-branch files the worktree has not yet
seen in its own history.

Exactly one changed path remained, as required.

---

## 6. The fail-safe ordering — containment still precedes selection

The deliberately non-existent row name makes this assertion fail-safe: even if
the ordering had regressed, nothing could have been planted.

```
$ mktemp -d
/tmp/tmp.CUlgiHm4jD

$ node scripts/audit-mutation-harness.mjs --root /tmp/tmp.CUlgiHm4jD --row __no-such-row__
audit-mutation-harness: REFUSED -- --root "/tmp/tmp.CUlgiHm4jD" resolves to /tmp/tmp.CUlgiHm4jD, which is OUTSIDE the repository root /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c. Refusing: this flag decides which tree the audit reads and writes, so it is contained to the repository by construction rather than by convention. Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil` suffix) is refused here too -- the comparison is segment-wise.
EXIT=1

$ rmdir /tmp/tmp.CUlgiHm4jD
```

`REFUSED --`, **not** a row-selection failure. The order in `main()` is
confirmed unchanged: parse → containment → registry load → selection. The
exactly-one-selector count rule sits inside the parse step and consults no
filesystem, so its new position cannot move a read ahead of containment.

---

## 7. The exit-2 dependency measurement, re-taken in THIS tree

Plan 32-17's frontmatter claimed nothing depends on the harness's exit 2. That
claim is **re-measured here rather than quoted**, per the plan's own
prohibition.

```
$ ls package.json installer/package.json src/mcp/vice/package.json
ls: cannot access 'package.json': No such file or directory
installer/package.json
src/mcp/vice/package.json
```

There is **no root `package.json`** in this repository; the two that exist are
the installer's and the MCP server's.

```
$ grep -an 'audit-mutation-harness' installer/package.json src/mcp/vice/package.json
exit=1          (no output — no match)
```

```
$ grep -arn 'audit-mutation-harness' .github/workflows/
exit=1          (no output — no match)
```

```
$ grep -an 'audit-mutation-harness' scripts/*.sh
exit=1          (no output — no match)
```

```
$ grep -an 'audit-mutation-harness' .claude/settings.json
exit=1          (no output — no match)
```

### The test census, with `grep -a` and its file count asserted

`[edge:CUT-06/empty]`. This repository has already made one false decision from
a plain census: `anno-memmap-render.ts` contains a NUL byte and is silently
skipped by a non-`-a` grep. A zero result is therefore only trustworthy if the
number of files the census actually visited matches the directory listing.

```
$ ls src/mcp/vice/*.test.* | wc -l
128

$ grep -ac '' src/mcp/vice/*.test.* | wc -l
128
```

**128 visited = 128 listed.** No file was silently skipped, so the census below
is a real measurement of the whole population.

```
$ grep -an 'audit-mutation-harness' src/mcp/vice/*.test.*
src/mcp/vice/audit-root-args.test.ts:217:// WHY THESE EXIST: `scripts/audit-mutation-harness.mjs` -- the one instrument
exit=0
```

**One hit, and it is a comment** — the docblock Task 1 added above the new
`valueFlags` unit tests. It is not an invocation. The hit doubles as the
census's own non-vacuity proof: the pattern does match when the text is
present, so the zeros above are real zeros and not a broken search.

**Conclusion: zero consumers of the harness exist anywhere in this repository.**
Not in either `package.json`, not in any workflow, not in any shell script, not
in the hook settings, and not in any of the 128 test files. Nothing could have
been keying on exit 2. `D-17` makes the harness a hand-run instrument by design,
and the measurement confirms the design held. `T-32-SC`'s `accept` disposition
stands on this reading rather than on the planning-time one.

---

## 8. `CR-05` — the precondition, declared

The verifier's `harden:` wording, quoted rather than paraphrased:

> All 35 recorded reds were captured with `plant.kind === "worktree"` and with
> `--root` absent from `guard.argv` in 0 of 61 rows — i.e. the evidence is sound
> BECAUSE nobody exercised the defective `--root` path of the instrument, not
> because that path is safe. `CR-05` is live. Declare the precondition (the
> harness must be wired to the strict parser) rather than continuing to rely on
> the flag never being used.

**What the undeclared precondition was.** Every observed red this phase records
was produced by this one instrument. Until `484bcd4` the instrument could be
pointed at the real repository by a flag the operator believed pointed it
somewhere else: a valueless `--root` resolved to the repository root with no
message at all (§1a). With a real row name and `--all`, that same invocation
plants mutations into the REAL working tree, rewrites the REAL registry and
overwrites the REAL evidence file. The precondition the corpus rested on was
therefore *"no operator ever typed a malformed `--root`"* — an operator habit,
never written down, and never checked.

**The measurement that showed the recorded evidence was safe by NON-USE rather
than by construction.** `--root` appears in `guard.argv` in **0 of 61** registry
rows, and **all 35** plants are worktree plants. Nobody exercised the defective
path. That is why the verifier calls the reliance *coincidental* rather than
laundering it into a soundness claim: the corpus is uncorrupted, but nothing
about the code made it so.

**What makes it true by construction now.** `parseArgs()` reads argv through
`parseRootArg()` with `--all` declared as a boolean flag and `--row`, `--rows`
and `--out` declared as value flags. Every malformed form of all four flags is
a hard, named error (§2), raised **before** containment is consulted and long
before anything is planted. There is no lenient mode, no environment variable
and no tolerated-typo list; `booleanFlags` and `valueFlags` are supplied in the
harness's own code and can never come from argv. The dated note in the harness
header records this in the file itself.

**Where the standing mechanical guard lives.** This section and the header note
are the *written* half of the discharge. The *mechanical* half is **plan
32-18**'s matrix row for `audit-mutation-harness`: a standing spawned test that
goes red the moment the harness is taken off the strict parser. Until that row
lands, the discharge rests on this record and on the code — see §9, where the
completeness guard is currently red **by design** for exactly that reason.

---

## 9. The gates, re-run

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 846.
exit=0
```

Measured line **unchanged** from the base commit.

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

```
$ cd src/mcp/vice && node --test audit-root-args.test.ts
1..54
# tests 54
# pass 54
# fail 0
exit=0
```

54 of 54, up from **44** at the base commit — the ten new `valueFlags` unit
cases. Nine of the ten failed before the implementation existed (see §10).

### `npm run test:automated`, and its two failures

Broker state for this reading: **down** (§0 — unit inactive, no `vice-broker`
process, no `x64sc` process).

```
$ cd src/mcp/vice && npm run test:automated
# tests 3004
# suites 24
# pass 2996
# fail 2
# cancelled 0
# skipped 1
# todo 5
# duration_ms 47087.049593
```

**The whole-glob `npm test` was NOT run.** It blocks indefinitely on
`vice-proxy.test.ts`; that decision is recorded in
[`32-close-gate.md` §2b](./32-close-gate.md) — `timeout 180 node --test vice-proxy.test.ts`
returned `exit=124`, and the timeout *is* the measured result. It is
broken-windows entry **#26**. This plan cites that decision rather than
re-taking it.

Both failures are named and accounted for. **Neither is a behavioural defect
introduced by this plan.**

#### Failure 1 — `the matrix covers EVERY script wired to the shared argv seam`

```
not ok 898 - the matrix covers EVERY script wired to the shared argv seam
    a root-accepting script exists that this file does not exercise (or vice versa). The whole point of the shared seam is that no consumer is left untested -- add the missing row to MATRIX rather than relaxing this assertion.
    + actual - expected
      [
    +   'audit-mutation-harness',
        'check-guard-fates',
        'check-skill-cli-invocations',
        'check-skill-description-overlap',
        'check-skill-fork-honesty',
        'check-skill-tool-coverage',
```

**This red is the plan working, and it is scheduled.** The completeness guard
derives its population as "scripts whose source contains `parseRootArg(`".
Migrating the harness onto the seam adds it to that population, and the matrix
does not yet carry its row.

The row is **plan 32-18's deliverable, not this plan's**, and 32-18
(`wave: 3`, `depends_on: ["32-16", "32-17"]`) requires this exact red as its own
observed-red evidence. Its must-have truth 2, verbatim:

> The flipped predicate is proven to BITE before it is satisfied: with the
> population derived from the flag and the matrix still carrying six rows, the
> guard goes red naming `audit-gate` and `audit-mutation-harness`. That red is
> captured verbatim as this plan's observed-red evidence, and it is the
> cheapest possible regression test for Gap 2 — it is what would have caught
> Gap 2 and did not. NO EXCLUSION LIST is added to keep it green.

Adding the row here would have destroyed that evidence and left 32-18 unable to
prove its own central claim. `audit-gate` — the other name in 32-18's expected
red — arrives from plan 32-16, this plan's wave sibling. The guard returns green
in wave 3 when 32-18 adds both rows.

This plan therefore **did not** touch `MATRIX`, and did not relax, exclude or
narrow the assertion. `src/mcp/vice/audit-root-args.test.ts` was changed by
additions only (§10).

#### Failure 2 — `repo-root.test.ts` path agreement (pre-existing, worktree-only)

```
not ok 1531 - path agreement (D-3, D-6, ...): the launcher's own repo_root ... and the agreed path is not under .claude
    error: 'the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a6abde8bdfb76a30c/.vice-supervisor (the exact regression a naive move would introduce)'
```

The assertion is about **where the checkout sits**, and this executor runs in a
GSD worktree under `.claude/worktrees/`. It is a property of the measurement
location, not of any code. This plan's entire diff is four files —

```
$ git diff --stat b64e9a6 HEAD
 scripts/audit-mutation-harness.mjs   |  87 ++++++++++-------
 scripts/lib/audit-root.d.mts         |  18 +++-
 scripts/lib/audit-root.mjs           | 177 +++++++++++++++++++++++++----------
 src/mcp/vice/audit-root-args.test.ts | 144 ++++++++++++++++++++++++++++
 4 files changed, 342 insertions(+), 84 deletions(-)
```

— none of which touches `repo-root.ts`, `supervisorDir()`, `EPOCH_FILE` or the
launcher resources. It is the same class as the known "live worktrees red
`ci-suite-coverage`" artifact and resolves on merge to the main checkout.

---

## 10. The parser's ten new behaviours

Written as failing tests first. Measured at the RED commit `b1e3d5e`, before
any implementation existed: **9 of 10 failed**.

```
not ok 10 - parseRootArg: a declared value flag's value is returned under its own token
not ok 11 - parseRootArg: a declared value flag as the LAST argument is REJECTED, naming ITSELF
not ok 12 - parseRootArg: a declared value flag followed by a flag is a MISSING value
not ok 13 - parseRootArg: a declared value flag given an empty string is REJECTED
not ok 14 - parseRootArg: a repeated value flag is REJECTED, not resolved by position
not ok 15 - parseRootArg: value flags and boolean flags parse identically in any order
not ok 16 - parseRootArg: unusual-but-valid paths are accepted unchanged as value-flag values
not ok 18 - parseRootArg: the widened signature is ADDITIVE -- values is empty when unused
not ok 19 - parseRootArg: a token declared in BOTH lists is a CALLER error, not a rejection
```

The tenth — *an undeclared flag is still unrecognised when `valueFlags` is
supplied* — **passed at RED**, and the reason is recorded rather than glossed:
`--roww` was already rejected as an unrecognised token before this plan, so the
case is a **non-regression guard** on existing behaviour. It only becomes
load-bearing once `valueFlags` is honoured, at which point it proves the new
option did not loosen the unrecognised-token rule. It is not a new behaviour
that silently already worked.

Test count: **44 → 54** at the base and head commits respectively.

### The five malformed value-flag messages, verbatim

Driven directly against the exported parser with
`script: "audit-mutation-harness"`.

```
### MISSING (last argument)
argv: ["--root","/a","--row"]
BAD ARGUMENTS -- `--row` requires a value, but it was the last argument. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--row <value>]

### FLAG-SHAPED value
argv: ["--row","--all"]
BAD ARGUMENTS -- `--row` requires a value, but it was followed by "--all", which is itself a flag. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--all] [--row <value>]

### EMPTY value
argv: ["--out",""]
BAD ARGUMENTS -- `--out` was given an empty value. An empty string is not a value, and it is specifically NOT a request for a default -- silently falling back to the default root is the defect this parser exists to remove. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--out <value>]

### REPEATED flag
argv: ["--rows","a,b","--rows","c,d"]
BAD ARGUMENTS -- `--rows` was given more than once: "a,b" and "c,d". A repeated flag is rejected rather than resolved by position, so no invocation's meaning depends on which copy the parser happened to keep. Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--rows <value>]

### UNDECLARED token
argv: ["--roww","x"]
BAD ARGUMENTS -- unrecognised argument "--roww". Usage: node scripts/audit-mutation-harness.mjs [--root <dir>] [--row <value>]
```

Each begins with `BAD ARGUMENTS --` and **names the offending flag** rather than
blaming `--root`.

### The double-declaration caller error, verbatim

```
argv: ["--root","/a"]   options: { booleanFlags: ["--dup"], valueFlags: ["--dup"] }
parseRootArg: "--dup" is declared in BOTH `booleanFlags` and `valueFlags`. A token cannot both take a value and not take one, so this is a caller error in the invoking script, not a malformed invocation -- fix the declaration rather than the command line.
```

It does **not** begin with `BAD ARGUMENTS --`. That separation is the point: an
operator mistake and a programming mistake stay distinguishable by message, the
same rule that separates an argv rejection from a containment refusal.

### The additive check

`parseRootArg(["--root", "/a"], { script: "x" })` returns `values` as an empty
record and `flags` as an empty record. The unflagged and root-only paths are
untouched, and all nine pre-existing `--root` unit tests pass unedited.

---

## 11. The corrected provenance citation

**Before** (`scripts/lib/audit-root.mjs:119-122` at the base commit):

```
// The shape and the error style are taken from
// `scripts/audit-mutation-harness.mjs`'s reader -- the one copy that DID throw
// on an unrecognised token and printed a usage line with it. That is the model
// that was not reused; it is reused here.
```

**After** (same position, `:119`), a dated `PROVENANCE CORRECTION` paragraph
that records what the old claim said in reported speech, states that the
harness's reader did reject an unrecognised token **but carried the
valueless-value hole on all four flags**, cites the `--row <path> --root`
reproduction, notes that the seam itself was nevertheless written new rather
than copied (which was always true), and records that the harness is now a
consumer rather than an unmigrated model. The paragraph was **corrected, not
deleted** — it is the record of a citation written down without being checked,
and the lesson is stated explicitly for the next reader.

### The census, and why the plan's stated form was vacuous

The plan's acceptance criterion was
`grep -c 'That is the model that was not reused; it is reused here' scripts/lib/audit-root.mjs`
returning 0, *"Non-vacuous: it returns 1 at HEAD."*

**Measured: it returns 0 at HEAD too.** The sentence is wrapped across two
comment lines (`That is the model` / `that was not reused; it is reused here.`),
and `grep` is line-based. The stated check was vacuous in both directions and
would have passed without any edit at all.

The real, non-vacuous census de-wraps the comment first:

```
$ tr '\n' ' ' < scripts/lib/audit-root.mjs | sed 's|// ||g' | grep -c 'That is the model that was not reused; it is reused here'
1     <- at base commit b64e9a6
0     <- at 484bcd4
```

Both the plain and the de-wrapped forms return 0 after the fix, and the
de-wrapped form returns 1 before it. See the caveat in §4 for why the
correction paragraph does not re-quote the sentence verbatim.

The corrected paragraph is still present at the same position and still names
the harness:

```
$ grep -n 'PROVENANCE CORRECTION, 2026-09-01' scripts/lib/audit-root.mjs
119:// PROVENANCE CORRECTION, 2026-09-01 (plan 32-17). What this paragraph used to

$ grep -c 'audit-mutation-harness' scripts/lib/audit-root.mjs
2
```

---

## 12. What this plan did NOT do

Stated rather than left to inference.

- **No matrix row was added** for `audit-mutation-harness`. That is plan
  32-18's deliverable and it requires this plan's red to exist (§9).
- **No exclusion list, no relaxed assertion.** The completeness guard is red on
  its merits.
- **No export was added** to `scripts/audit-mutation-harness.mjs`. The export
  seam is plan 32-19's subject.
- **The split-read section** of `scripts/lib/audit-root.mjs` was not touched.
- **No package-manager install** was run and no dependency was added
  (`T-32-SC`).
- **`npm test`** (the whole glob) was not run — see §9.
