# Gap 5 (`CR-08`) — the completeness guard whose population was its own remedy

**Date:** 2026-09-01
**Plan:** 32-18 (gap-closure round 2, wave 3)
**Commits measured:** `555356e` (Task 1, the predicate flip — committed RED on purpose)
and `1c8bbbe` (Task 2, the rows and the pins — green).
**Base:** `07a9b48` — the wave-2 merge, i.e. plans 32-16 and 32-17 already in.

This file is NEW. It corrects, rewrites and replaces nothing. No dated evidence
record, no `*-SUMMARY.md` and not `32-VERIFICATION.md` was edited by the plan
that produced it.

---

## 0. The state of the machine, established once

Read by the method `evidence/32-close-gate.md` §2b records, including its
`pgrep` self-match trap: the bare `pgrep -af 'vice-broker'` form finds its own
wrapping command line and reports a hit on an idle host, so every reading below
uses the `ps | grep -v grep` form that document settles on.

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
live broker deterministically reds the `BACK-05` test, and any suite figure
quoted without that reading is uninterpretable.

---

## 1. What was wrong, quoted rather than paraphrased

`32-VERIFICATION.md` `gaps[1]`:

> `src/mcp/vice/audit-root-args.test.ts:423` derives the population as
> `if (src.includes("parseRootArg(")) out.push(...)` — the REMEDY, not the FLAG.
> So the set it compares against MATRIX is "scripts that already use the seam",
> which is tautologically the set MATRIX covers.
> Measured: `grep -l -- '--root' scripts/*.mjs | wc -l` = 8;
> `grep -l 'parseRootArg(' scripts/*.mjs | wc -l` = 6. The two invisible scripts
> are exactly `audit-gate.mjs` and `audit-mutation-harness.mjs`, i.e. exactly the
> two behind.

and its three `missing` lines:

> - "Derive the population from the FLAG: a `scripts/*.mjs` whose source contains the token `--root` is a member, whether or not it uses the seam."
> - "That change reds the guard immediately with `audit-gate` and `audit-mutation-harness` named — which is the correct outcome, and the same one Gap 2 above asks for. Do not add an exclusion list to keep it green."
> - "Correct the two docblock sentences at :294-296 to state what the guard actually measures."

**A line-number note, per this repository's convention.** The verifier cites
`:423` and `:294-296`. Plan 32-17 added the value-flag unit block, so at this
plan's base the same code sits at `:561-570` (the predicate) and `:429-441` (the
docblock), in a 1011-line file the plan describes as 866 lines. Treated as DRIFT
TO RE-VERIFY, not as evidence the finding changed: the substance was re-measured
here and matched exactly.

---

## 2. The two population counts, taken in this tree with `grep -a`

```
$ grep -a -l -- '--root' scripts/*.mjs | wc -l
8
$ grep -a -l 'parseRootArg(' scripts/*.mjs | wc -l
8
```

Both are **8** here, because plans 32-16 and 32-17 migrated the two stragglers
in this same round. The pre-round HEAD values quoted from the verifier above
were **8 and 6** — that divergence is the entire reason this gap exists, and it
is recorded here because it is no longer reproducible in this tree.

`grep -a` rather than `grep`: this repository contains a source file carrying a
NUL byte, which hides it from a plain `grep` and has already produced one false
decision.

**The population function's own returned list** — the direct measurement, of
which the `grep` counts are the independent cross-check:

```
accepting (8):
  audit-gate
  audit-mutation-harness
  check-guard-fates
  check-skill-cli-invocations
  check-skill-description-overlap
  check-skill-fork-honesty
  check-skill-tool-coverage
  generate-tool-support-table
visited .mjs count: 11
```

---

## 3. The captured RED — the point of the plan, not a step towards it

Taken at `555356e`, with the predicate flipped to the flag and MATRIX still
carrying six rows. **Exactly one test failed**, and it is the completeness
assertion.

```
$ cd src/mcp/vice && node --test audit-root-args.test.ts
# tests 55
# pass 54
# fail 1
```

```
not ok 27 - the matrix covers EVERY root-accepting script
  ---
  location: '.../src/mcp/vice/audit-root-args.test.ts:713:1'
  failureType: 'testCodeFailure'
  error: |-
    a script accepting --root exists that this file does not exercise (or vice versa). The population is derived from the FLAG, not from the shared seam, so a script that hand-rolls the reader is a member too -- that is the whole point. Add the missing row to MATRIX with a typed expectation and its own spawned test. Do NOT relax this assertion, and do NOT add an exclusion list, an unmigrated-scripts array or a skip: removing a member from measurement is the defect this guard was corrected to stop having.
    + actual - expected

      [
    +   'audit-gate',
    +   'audit-mutation-harness',
        'check-guard-fates',
        'check-skill-cli-invocations',
        'check-skill-description-overlap',
        'check-skill-fork-honesty',
        'check-skill-tool-coverage',

  code: 'ERR_ASSERTION'
```

**Both scripts named, by the flag-derived population.**

### 3a. Why this is not the pre-existing red, stated because it would be easy to confuse

At this plan's base the file was ALREADY red, with a superficially identical
diff. That red came from the OLD `parseRootArg(`-derived predicate, which began
seeing eight the moment 32-16 and 32-17 migrated both scripts:

```
not ok 26 - the matrix covers EVERY script wired to the shared argv seam
```

Different test name, different assertion message, different cause. The red
recorded in §3 is the one this plan's criterion requires — produced by the
FLAG-derived population, under the renamed test — and it was captured between
the predicate flip and the rows landing. The base red is recorded here only so a
reader does not mistake one for the other.

---

## 4. The population cross-check, and why its two sides are different mechanisms

The walk is `readdirSync` + `isFile()` + a Node-side read, inside the test
process. The independent side is a `spawnSync` shell glob expansion in another
process, with no `isFile()` filter and no Node-side read:

```js
spawnSync("/bin/sh", ["-c", "printf '%s\\n' scripts/*.mjs"], { cwd: ROOT })
```

Two `readdirSync` calls sharing the walk's filter **cannot disagree** — that
would be a tautological guard added to the very file whose tautological
population is this gap. The two sides are compared as **sorted basename lists,
reported in BOTH directions**, so a file skipped for any reason is NAMED rather
than reduced to a smaller number nobody reads.

### 4a. The shell command is fixed, and the wrong form was measured

`printf '%s\n'`, never a bare `ls`. Measured in this tree against this plan's
own probe, with a DIRECTORY at `scripts/zz-population-probe.mjs`:

```
$ sh -c 'ls scripts/*.mjs' | tail -6
scripts/check-skill-fork-honesty.mjs
scripts/check-skill-tool-coverage.mjs
scripts/generate-tool-support-table.mjs
scripts/version.mjs

scripts/zz-population-probe.mjs:
```

A bare `ls` whose glob matches a directory **descends into it**, emitting a blank
line and then the directory's name with a trailing colon instead of the path.
That would inject a phantom empty-string member and a colon-suffixed member,
reddening the assertion for the wrong reason. The correct form:

```
$ sh -c "printf '%s\n' scripts/*.mjs" | tail -4
scripts/check-skill-tool-coverage.mjs
scripts/generate-tool-support-table.mjs
scripts/version.mjs
scripts/zz-population-probe.mjs
```

The listing side drops empty entries and trailing-colon entries explicitly, and
says in the code that both are the signature of that wrong form — guarding
against reintroduction rather than trusting a comment.

### 4b. Non-vacuity, proven by mutating the SUBJECT

**Explicitly not** by reducing an expected count or editing the comparison —
that proves only that the comparison executes, which was never in doubt.

`mkdir scripts/zz-population-probe.mjs` (a DIRECTORY: the shell glob matches it
by name, the walk's `isFile()` drops it):

```
not ok 26 - the population walk sees every scripts/*.mjs an independent mechanism sees
  error: |-
    a scripts/*.mjs is present on disk but was SKIPPED by the population walk, so it could never have been tested for the --root token. The population walk and this listing are DELIBERATELY DIFFERENT MECHANISMS: ...
    + actual - expected

    + [
    +   'zz-population-probe.mjs'
    + ]
    - []
```

**Red, naming the file, as seen by the listing and not by the walk.** Removed:

```
$ rmdir scripts/zz-population-probe.mjs
$ test ! -e scripts/zz-population-probe.mjs && echo REMOVED
REMOVED
$ git status --porcelain
 M src/mcp/vice/audit-root-args.test.ts
```

An empty directory is invisible to `git status`, so the **existence check is the
load-bearing cleanup proof here, not the diff.**

### 4c. The paired control — a divergence detector, not a pinned snapshot

Taken AFTER the directory probe so the two readings cannot be confused. A real,
EMPTY scratch **file** at the same path is seen by BOTH sides, so it must NOT red
the cross-check:

```
$ touch scripts/zz-population-probe.mjs   (size 0)
$ cd src/mcp/vice && node --test audit-root-args.test.ts
not ok 27 - the matrix covers EVERY root-accepting script
# tests 55
# pass 54
# fail 1
```

Test 26 — the cross-check — is **GREEN**; the only failure is the intended
Task 1 completeness red. Recording this is what stops a later reader
"correcting" the assertion into a hard-coded count. The file is empty on
purpose: a scratch file containing the token `--root` would join the population
and red a different assertion, which would not be this control.

```
$ rm scripts/zz-population-probe.mjs
$ test ! -e scripts/zz-population-probe.mjs && echo REMOVED
REMOVED
$ git status --porcelain
 M src/mcp/vice/audit-root-args.test.ts
```

---

## 5. The three docblock claims, before and after

| # | Before (round 1) | After (this plan) |
|---|---|---|
| 1 | "Six scripts accept a root." | "MEASURED, 2026-09-01: EIGHT top-level `scripts/*.mjs` accept a root." |
| 2 | "The table below is the whole population, and the completeness guard beneath it derives that population FROM DISK" | "THE POPULATION IS DERIVED FROM THE FLAG … A `scripts/*.mjs` whose source carries the token `--root` is a member WHETHER OR NOT it uses the shared seam — because a script that hand-rolls the reader is the defect this file exists to catch, and keying on the seam excludes exactly those." |
| 3 | "a seventh root-accepting script added later fails this file by omission rather than passing unnoticed" (false in the PRESENT tense — the seventh and eighth already existed and already passed unnoticed) | "a NINTH root-accepting script added later fails this file BY OMISSION rather than passing unnoticed", plus a dated paragraph recording that the previous predicate derived the population from the remedy and that this docblock asserted the opposite. |

```
$ grep -c 'The table below is the whole population' src/mcp/vice/audit-root-args.test.ts
0
$ grep -a -c 'UNMIGRATED' src/mcp/vice/audit-root-args.test.ts
0
$ grep -c 'Six scripts accept a root' src/mcp/vice/audit-root-args.test.ts
0
$ grep -c 'NINTH root-accepting' src/mcp/vice/audit-root-args.test.ts
1
```

### 5a. A criterion whose stated non-vacuity is wrong, reported rather than quietly satisfied

Plan 32-18's Task 1 criterion reads: `grep -c 'The table below is the whole
population'` returns 0, and **"Non-vacuous: it returns 1 at HEAD."** The first
half holds. **The second half is false**, and it was false before this plan ran:

```
$ git show HEAD:src/mcp/vice/audit-root-args.test.ts | grep -c 'The table below is the whole population'
0
```

The claim was WRAPPED ACROSS TWO COMMENT LINES at base (`… caught it. The` /
`// table below is the whole population, …`), so the single-line exact-phrase
grep never matched it, at HEAD or anywhere. The intended non-vacuity therefore
needs a wrap-tolerant form, which does behave as the criterion expected:

```
$ git show HEAD:src/mcp/vice/audit-root-args.test.ts | grep -c 'whole population'
1
$ git show HEAD:src/mcp/vice/audit-root-args.test.ts | grep -c 'seventh root-accepting'
1
$ git show HEAD:src/mcp/vice/audit-root-args.test.ts | grep -c 'Six scripts accept a root'
1
```

The substantive requirement is met — the file no longer ASSERTS any of the three
claims. It does still **quote** claims 2 and 3, in past tense, inside the dated
correction paragraph, because criterion D requires recording what the docblock
used to claim. A future reader running the loose `grep -c 'whole population'`
will therefore get 1 and must read the line before concluding anything: the hit
is history, not an assertion.

---

## 6. The matrix taken green, and the test-count delta accounted for

```
$ cd src/mcp/vice && node --test audit-root-args.test.ts
# tests 62
# pass 62
# fail 0
$ cd src/mcp/vice && node --test audit-root-args.test.ts     (second consecutive run)
# tests 62
# pass 62
# fail 0
$ cd src/mcp/vice && npm run typecheck
exit=0
```

Two consecutive runs, because three of the case loops spawn real gates, one of
which regenerates a directory under the default root — a test that passes only
on a cold tree is not a test.

**Delta 55 → 62 = +7, accounted for exactly:**

| Source | Tests |
|---|---|
| Case 1 (equals form) × 2 new rows | +2 |
| Case 2 (out-of-repo refusal) × harness only — `audit-gate` is skipped by type | +1 |
| Case 2b (out-of-repo ACCEPTED), new typed case, `audit-gate` only | +1 |
| E1, the closed fs-import allow-list | +1 |
| E2, the enumerated write-API count | +1 |
| The write-freedom pair's own non-vacuity guard | +1 |
| **Total** | **+7** |

---

## 7. The two opposite out-of-repository captures

Asserted in OPPOSITE directions for two scripts that are equal in one property
and different in another — both accept `--root`, both are on the shared argv
seam, and they differ ONLY in containment (`[edge:CUT-06/adjacency]`).

**The harness — REFUSED:**

```
$ node scripts/audit-mutation-harness.mjs --root <out-of-repo-dir> --row zz-no-such-registry-row-exists.mjs
audit-mutation-harness: REFUSED -- --root "…/scratchpad" resolves to …/scratchpad, which is OUTSIDE the repository root /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a9b21ffd4201bf0f5. Refusing: this flag decides which tree the audit reads and writes, so it is contained to the repository by construction rather than by convention. Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil` suffix) is refused here too -- the comparison is segment-wise.
exit: 1
```

**`audit-gate` — ACCEPTED as an argument, reaching its own logic:**

```
$ node scripts/audit-gate.mjs --root <out-of-repo-dir>
audit-gate: FAIL
  - ENOENT: no such file or directory, scandir '…/scratchpad/src/mcp/vice'
exit: 1
```

Both exit 1, and that is why the assertions key on the **MESSAGE**, never on the
status: the harness carries `audit-mutation-harness: REFUSED --`, while
`audit-gate` carries **neither** `audit-gate: REFUSED --` nor
`audit-gate: BAD ARGUMENTS --`. Note `audit-gate` has its own
`audit-gate: REFUSED` verdict line for a gated milestone audit — it has no
` --` suffix, which is what keeps the two distinguishable. Neither case can pass
for the other's reason.

---

## 8. Non-vacuity experiment 1 — the harness row is a real standing guard

The harness's matrix row is the **mechanical half of the `CR-05` precondition**
(§10). Proven by making it fail: `scripts/audit-mutation-harness.mjs`'s
`parseArgs()` was temporarily reverted to the pre-32-17 hand-rolled reader.

```
not ok 34 - audit-mutation-harness: the equals form exits non-zero and names itself
  error: |-
    stderr must carry the argument-rejection prefix naming this script, got: audit-mutation-harness: FAIL -- row selection: "zz-no-such-registry-row-exists.mjs" matched 0 registry row(s) by `historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE naming the offending entry, never a silent skip.
# tests 62
# pass 61
# fail 1
```

Off the strict parser, the hand-rolled reader matches only the exact token
`--root`, so `--root=/tmp/definitely-not-here` is **silently discarded** and no
`BAD ARGUMENTS --` is ever emitted. The row reds. That is the guard biting.

The failure also demonstrates the **T-32-30 fail-safe** working: the run got past
argument handling and stopped on the deliberately non-existent row name, finding
**nothing to plant** rather than mutating the real tree from inside a unit test.

**Restored, bounded by BOTH required checks:**

```
$ git diff --stat -- scripts/audit-mutation-harness.mjs
(empty)
$ sha256sum scripts/audit-mutation-harness.mjs
e761c7bf8b44bf36b4bfa38751fffd27bb05cf176134adb7794f56ca9a3f0cc3   (matches pre-experiment)
```

Both bounds are required, not one: this file is owned by plan **32-19** in the
same wave, and the empty diff plus hash match is precisely what makes that
cross-plan edge safe to leave out of `depends_on` (flagged assumption 4).

---

## 9. Non-vacuity experiment 2 — BOTH halves of the write-freedom pair red

`scripts/audit-gate.mjs` was temporarily given a real `writeFileSync` **import**
(so E1 reds) **and a call to it** (so E2 reds). A mutation reddening only one
half would leave the other unproven.

```
not ok 60 - audit-gate: E1 -- the DIRECT fs import surface is exactly the read-only set
  error: |-
    audit-gate.mjs must bind ONLY read APIs from node:fs. A new name here means the performs-no-filesystem-write basis recorded in this script's header and in plan 32-16's `T-32-22` is REVOKED, and the script must be moved onto the containment seam in `lib/audit-root.mjs`. SCOPE, stated because an unqualified completeness claim is exactly the CR-08 shape this round exists to remove: this assertion is CLOSED over the DIRECT fs IMPORT SURFACE and over nothing wider. …
    + actual - expected
      [
        'readFileSync',
        'readdirSync',
    +   'writeFileSync'
      ]

not ok 61 - audit-gate: E2 -- zero filesystem-write calls over comment-stripped source
  error: |-
    audit-gate.mjs calls a filesystem-write API (writeFileSync). CONSEQUENCE, not just a fact: the performs-no-filesystem-write basis recorded in this script's header and accepted in plan 32-16 as `T-32-22` is REVOKED. … TWO RESIDUAL HOLES, named as MEASURED limits … (2) Present in this file TODAY rather than merely conceivable: it binds `spawnSync` from `node:child_process`, so a write performed BY A SPAWNED PROCESS is outside BOTH halves …
    + actual - expected
    + [
    +   'writeFileSync'
    + ]

# tests 62
# pass 60
# fail 2
```

**Both red, each with its consequence message.** Restored:

```
$ git diff --stat -- scripts/audit-gate.mjs
(empty)
$ sha256sum scripts/audit-gate.mjs
51e5f8b778eda5b36c208e41dc82c4d1d5216a980d5971f1270bc92f8654c284   (matches pre-experiment)
$ test ! -e zz-write-freedom-probe.txt && echo absent
absent
```

### 9a. What the pair measures, and what it does not

**E1 — the CLOSED half**, over the DIRECT fs import surface. Re-measured here:
`scripts/audit-gate.mjs:130` binds exactly `{ readdirSync, readFileSync }` from
`node:fs`; nothing is bound from `node:fs/promises`; there is no fs namespace
import and no `require`/dynamic `import()` of fs.

> **Line drift, re-measured rather than adopted.** The plan cites
> `audit-gate.mjs:90` for the fs import and `:93` for `spawnSync`. Plan 32-16's
> migration onto the shared argv seam shifted the file; measured at this plan's
> base the two are at **`:130`** and **`:133`**. The **bound names are
> unchanged** and are exactly what the must-have asserts. Drift to re-verify,
> not a changed constraint.

**E2 — the OPEN half**, an ENUMERATED write-API set counted over
COMMENT-STRIPPED source. Both mechanics have measured reasons:

- **Comments are stripped** because this file discusses writes in prose
  throughout its header, and plan 32-16 added a note whose stated reversal
  condition is a write call appearing in it. An unstripped count could red on the
  very prose that documents the assertion — a self-invalidating header.
- **`process.stderr.write(` is deliberately not matched.** Measured: the file
  carries **five** such calls in live code (`:1056`, `:1100`, `:1117`, `:1131`,
  `:1154`) plus one inside a comment at `:73`. Stdio is not a filesystem write,
  and a bare `.write(` pattern would red on a correct file. The assertion anchors
  on the enumerated API names, and asserts positively that those five calls are
  still present — so the negative direction stays exercised.
- **The set is enumerated, not a single API.** A `writeFileSync`-only check
  would miss `appendFileSync`, `createWriteStream`, `mkdirSync`, `rmSync`,
  `rmdirSync`, `unlinkSync`, `renameSync`, `cpSync`, `copyFileSync`,
  `truncateSync`, `writeSync` and the `node:fs/promises` forms.

**Two residual holes, named as measured limits rather than implied.** (1) A write
through a name outside the enumerated set and not bound at import time — an
`openSync` with a write flag — evades E2; E1 exists beside it for that reason.
(2) Present today: the file binds `spawnSync` from `node:child_process`, so a
write by a **spawned process** is outside BOTH halves. Neither half claims to
cover it. The pair is a scoped instrument, not a completeness proof.

---

## 10. The `CR-05` precondition, declared

**The verifier's `harden:`, quoted:**

> All 35 recorded reds were captured with `plant.kind === "worktree"` and with
> `--root` absent from `guard.argv` in 0 of 61 rows — i.e. the evidence is sound
> BECAUSE nobody exercised the defective `--root` path of the instrument, not
> because that path is safe. `CR-05` is live. Declare the precondition (the
> harness must be wired to the strict parser) rather than continuing to rely on
> the flag never being used.

**The precondition:** `scripts/audit-mutation-harness.mjs` must read its
arguments through `parseRootArg()`, the strict shared argv seam.

**The measurement that showed the recorded evidence was safe by NON-USE rather
than by construction:** all 35 recorded observed reds were captured with `--root`
absent from `guard.argv` in 0 of 61 registry rows. The instrument's `--root`
path was defective throughout; it simply went unexercised.

**What makes it true by construction now:** plan 32-17 wired the harness to
`parseRootArg()` with `valueFlags: ["--row", "--rows", "--out"]`, so a malformed
value is a hard `audit-mutation-harness: BAD ARGUMENTS --` at exit 1 instead of
a silent fallback to the repository root.

**Which named test reds if it stops being true — the part that makes this a
declaration rather than a note:**

> **`audit-mutation-harness: the equals form exits non-zero and names itself`**
> in `src/mcp/vice/audit-root-args.test.ts`

That is a standing spawned test, and §8 above shows it **observed failing**
against a harness taken off the strict parser. The soundness of the 35 recorded
reds therefore no longer rests on the flag going unused; it rests on a guard
that has been seen to bite.

**The prose half is in plan 32-17's harness header**, at
`scripts/audit-mutation-harness.mjs`'s `ARGV IS READ THROUGH THE SHARED SEAM`
block. The two halves are cross-referenced so each is findable from the other:
prose states the rule, this test enforces it.

---

## 11. The departure from `32-REVIEW.md`'s `CR-08` fix, recorded rather than silent

**The reviewer proposed** an explicit exclusion list beside the matrix, so that
non-migration would be "an explicit, named exception rather than an invisible
one":

```ts
/** Scripts that accept a root but are deliberately NOT on the shared seam yet. */
const UNMIGRATED = ["audit-gate", "audit-mutation-harness"] as const;
```

**The verifier overrode it**, in `gaps[1].missing[1]`:

> "Do not add an exclusion list to keep it green."

**This plan followed the verifier, and the override is right here** for a reason
specific to this round: **both scripts are migrated** by plans 32-16 and 32-17,
so the list would be **empty** — and an empty exclusion list is an invitation to
fill it. The reviewer wrote the suggestion before those two plans existed, when
a named debt would have been the better of two bad options.

The reviewer's underlying concern — that non-migration must never be invisible —
is honoured by a different mechanism: if a future script genuinely cannot be
migrated, the answer is a **typed expectation with a stated reason and its own
spawned test** (the shape `uncontained-read-only` now demonstrates), never an
absence from the population. `grep -a -c 'UNMIGRATED'` returns **0**.

---

## 12. The gates, re-run

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 846.
exit=0
```

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

```
$ cd src/mcp/vice && npm run typecheck
exit=0
```

```
$ cd src/mcp/vice && npm run test:automated
# tests 3012
# pass 3005
# fail 1
# skipped 1
```

Broker state for that suite figure is §0: **no broker, no emulator**.

### 12a. The one failure is a WORKTREE-LOCATION ARTIFACT, and that is proven, not asserted

```
not ok 1539 - path agreement (D-3, D-6, THE regression this task exists to catch): …
  location: '.../src/mcp/vice/repo-root.test.ts:178:1'
  error: 'the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a9b21ffd4201bf0f5/.vice-supervisor (the exact regression a naive move would introduce)'
```

The assertion is that the resolved supervisor directory must not sit under
`.claude`. This plan executed in a Claude Code worktree whose root **is**
`…/c64-re-tools/.claude/worktrees/agent-a9b21ffd4201bf0f5`, so the assertion is
structurally unsatisfiable from inside it, for every plan in this wave, whatever
its diff.

Two independent proofs that it is not this plan's doing:

```
$ git diff --name-only HEAD~2 HEAD
src/mcp/vice/audit-root-args.test.ts
```

This plan's two commits touch **exactly one file**, and it is neither
`repo-root.test.ts` nor anything it imports.

```
$ cd /home/henrik/dev/henrik/git/c64-re-tools && node --test src/mcp/vice/repo-root.test.ts
# tests 6
# pass 6
# fail 0
```

**The same test passes 6/6 in the main checkout**, which is not under `.claude`.
The failure is a function of WHERE the worktree lives and resolves on merge.
Out of scope under the executor's scope boundary: not auto-fixed, and recorded
here rather than absorbed into a claimed pass. **`test:automated` did not exit 0
in this tree, and nothing in this document claims it did.**

### 12b. The whole-glob `npm test` was NOT run

Deliberately. `evidence/32-close-gate.md` §2b records that
`vice-proxy.test.ts` does not terminate — measured there at `exit=124` under a
180 s bound, and by plan 32-07 as still running when killed at 300106 ms — which
is why the bare full glob `node --test '*.test.*'` cannot be run to completion on
this host. That decision is cited, not re-taken.

---

## 13. Tree state at the end

```
$ git status --porcelain
 M src/mcp/vice/audit-root-args.test.ts      (before this evidence file was written)
$ git diff --name-only -- scripts/audit-mutation-harness.mjs scripts/audit-gate.mjs
(empty — both byte-identical to base, hash-confirmed in §8 and §9)
```

Both temporarily-modified scripts are byte-identical to this plan's base by
`git diff` **and** by sha256. Both scratch probes at
`scripts/zz-population-probe.mjs` (a directory, then a file) were removed and
their absence verified by `test ! -e`.
