# Gap 2, first half — `scripts/audit-gate.mjs` on the shared argv seam, closed raw

**Date:** 2026-09-01
**Plan:** 32-16 (gap-closure round 2, wave 2)
**Base:** `b64e9a6` — the wave-1 state this worktree forked from (plan 32-15 already in).
**Commits measured:** `234a900` (Task 1, the migration), `b23dbc5` (Task 2, the six notes).

This file is NEW. It corrects, rewrites and replaces nothing. No dated evidence
record, no `*-SUMMARY.md` and not `32-VERIFICATION.md` was edited by the plan
that produced it.

The measurements ran inside a GSD worktree at
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-ab44a8d427a4bf8f0`,
so every absolute path quoted below carries that prefix. On the merged branch the
same paths read `/home/henrik/dev/henrik/git/c64-re-tools`.

---

## 0. The state of the machine, established once

Read-only. Nothing in this run stopped, killed, restarted or otherwise touched the
developer's `vice-broker` systemd user unit (D-13). The method is the one recorded
in `evidence/32-close-gate.md` §2b's surrounding block, **including its
process-name false-positive trap**, and it is cited rather than re-derived:

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

**No VICE broker and no `x64sc` process was running.** This matters because a live
broker deterministically reds the `BACK-05` test, and any suite figure quoted
without the broker state beside it is uninterpretable.

`ps | grep -v grep` is used rather than `pgrep -af vice-broker` for the reason
`32-close-gate.md` measured and recorded: the bare `pgrep` form **self-matches**,
finding its own wrapping command line and reporting a hit on an idle host.
Recording `exit=0` from it would assert a live broker on a host that has none.
That trap is cited here, not re-taken.

---

## 1. The three defects, reproduced BEFORE anything was changed

All four invocations below were captured at base `b64e9a6`, before any edit, each
with its raw command, exit status and raw output. The unflagged control is
included so the three defects are comparable against it.

### 1a. Control — no arguments

```
$ node scripts/audit-gate.mjs
exit: 0
stdout: audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
stderr: (empty)
```

### 1b. Defect 1 — the equals form

```
$ node scripts/audit-gate.mjs --root=/tmp
exit: 0
stdout: audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
stderr: (empty)
```

### 1c. Defect 2 — a bare, valueless `--root`

```
$ node scripts/audit-gate.mjs --root
exit: 0
stdout: audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
stderr: (empty)
```

### 1d. Defect 3 — the typo `--rooot`

```
$ node scripts/audit-gate.mjs --rooot /tmp
exit: 0
stdout: audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
stderr: (empty)
```

**Three invocations, three identical real-tree runs, none of them mentioning
`--root`.** Each is byte-identical to the control at 1a. The cause is
`parseArgs()` at `:1118-1131`: it matched only the exact token `--root`, took
`argv[i + 1]` with no missing-value check, and **silently dropped** any token it
did not recognise. The operator believes they audited `/tmp`; the gate audited the
real repository and vouched for it.

---

## 2. The same four invocations AFTER the migration

Captured at `234a900`.

### 2a. Control — no arguments (unchanged)

```
$ node scripts/audit-gate.mjs
exit: 0
stdout: audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
stderr: (empty)
```

Byte-identical to 1a. The unflagged path is untouched.

### 2b. Defect 1 closed — the equals form

```
$ node scripts/audit-gate.mjs --root=/tmp
exit: 1
stdout: (empty)
stderr: audit-gate: BAD ARGUMENTS -- "--root=/tmp" uses the equals form. The space-separated spelling `--root <dir>` is the ONLY accepted one. Write: node scripts/audit-gate.mjs --root "/tmp". Usage: node scripts/audit-gate.mjs [--root <dir>] [--json] [--hook]
```

### 2c. Defect 2 closed — a bare, valueless `--root`

```
$ node scripts/audit-gate.mjs --root
exit: 1
stdout: (empty)
stderr: audit-gate: BAD ARGUMENTS -- `--root` requires a directory, but it was the last argument. Usage: node scripts/audit-gate.mjs [--root <dir>] [--json] [--hook]
```

### 2d. Defect 3 closed — the typo `--rooot`

```
$ node scripts/audit-gate.mjs --rooot /tmp
exit: 1
stdout: (empty)
stderr: audit-gate: BAD ARGUMENTS -- unrecognised argument "--rooot". Usage: node scripts/audit-gate.mjs [--root <dir>] [--json] [--hook]
```

Each exits 1, each prints a first stderr line beginning `audit-gate: BAD
ARGUMENTS --`, each names the offending token and quotes the accepted spelling,
and **none prints the gate's report line**.

### 2e. `--json` — unchanged, and proven so by diff

```
$ node scripts/audit-gate.mjs --json
exit: 0
```

A single parseable JSON object on stdout. The pre-fix and post-fix stdout captures
were compared directly:

```
$ diff pre-json.out post-json.out
exit=0          (no output — byte-identical)
```

### 2f. `--hook` — still reads stdin, scope rule unchanged

Every payload below was built as a JS object inside a driver file and handed to
the child through `spawnSync`'s `input` option — **never assembled or piped
through an actual Bash command line.** That constraint is
`audit-integrity.test.ts`'s recorded CRITICAL HAZARD: the hook is wired live in
`.claude/settings.json`, so a payload typed as a shell command carrying both a
write indicator and a gated `*MILESTONE-AUDIT*.md` token would block the very tool
call typing it.

```
$ node scripts/audit-gate.mjs --hook     (stdin: {"tool_name":"Read","tool_input":{"file_path":"/etc/hostname"}})
exit: 0     stdout: (empty)     stderr: (empty)

$ node scripts/audit-gate.mjs --hook     (stdin: {"tool_name":"Write","tool_input":{"file_path":".../docs/unrelated-note.md","content":"hello"}})
exit: 0     stdout: (empty)     stderr: (empty)

$ node scripts/audit-gate.mjs --hook     (stdin: {"tool_name":"Write","tool_input":{"totally_unknown_key":1}})
exit: 0     stdout: (empty)     stderr: (empty)

$ node scripts/audit-gate.mjs --hook     (stdin: {not json)
exit: 0     stdout: (empty)     stderr: (empty)
```

**Read these four honestly: all four are the fail-OPEN SCOPE rule, not the
refusal path.** A call naming no `*MILESTONE-AUDIT*.md` target exits 0 before any
`spawnSync`, and that includes the unrecognised-shape and malformed-JSON payloads
above, because neither carries such a target in its fallback text. They prove the
hook still reads stdin and still scopes out correctly; they do **not** prove the
fail-CLOSED half. The fail-CLOSED half is proven by the hook tests in
`audit-integrity.test.ts` §3 below, which build in-scope red trees properly.

**Hook invocation shape, read rather than assumed** (flagged assumption 1):

```
$ grep -n 'audit-gate' .claude/settings.json
9:            "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/audit-gate.mjs\" --hook",
```

The hook passes `--hook` and nothing else, so declaring it a `booleanFlags` entry
leaves every live hook invocation unchanged in shape.

**Flagged assumption 2, re-measured at execution time:** no CI step invokes this
script.

```
$ grep -rn 'audit-gate' .github/workflows src/mcp/vice/package.json scripts/package.sh scripts/ensure-mcp-deps.sh
exit=1          (no output — no invocation)
```

---

## 3. The compatibility contract — `audit-integrity.test.ts`, unmodified

The three existing spawn shapes are `--root <dir> --json` (`:105`), `--root <dir>`
(`:505`) and `--hook --root <dir>` (`:548`), each with an out-of-repository
`mkdtempSync(tmpdir())` root.

```
$ cd src/mcp/vice && node --test audit-integrity.test.ts
# tests 44
# suites 2
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
exit=0
```

**44/44, 0 failures** — including the two WR-03 bad-root tests whose expected first
stderr line is `audit-gate: FAIL`, and the hook tests that pass
`--hook --root <out-of-repo dir>`. All three shapes still work unchanged.

No test file was edited:

```
$ git status --porcelain -- src/
(no output)
```

Had any of the three broken, that would have meant containment was added by
accident. It was not.

---

## 4. The containment decision, recorded as a decision

### 4a. What the verifier actually asked for, quoted literally

`gaps[0].missing[1]`, verbatim:

> "Wire `scripts/audit-gate.mjs` to `parseRootArg()`, preserving its existing
> flags through `booleanFlags`."

It names `parseRootArg()` and `booleanFlags`. It does **not** ask for
`resolveContainedRoot()`. This plan followed that item literally.

### 4b. What was NOT done, stated plainly

`scripts/audit-gate.mjs` was **not** wired to `resolveContainedRoot()`. It accepts
a `--root` outside the repository. That is a decision, not an omission, and the
basis is measured below rather than asserted.

### 4c. The measured basis — this script never writes

Recorded in **both** its forms, both re-measured in this task at `234a900`.

**Form 1 — a count over the enumerated filesystem-write API set, over
COMMENT-STRIPPED source.**

```
$ grep -v '^\s*//' scripts/audit-gate.mjs | grep -c -E 'writeFileSync|appendFileSync|createWriteStream|mkdirSync|rmSync|rmdirSync|unlinkSync|renameSync|cpSync|copyFileSync|truncateSync|writeSync'
0
```

Before the edit: **0**. After the edit: **0**. This is a preservation check, not a
repair; the number that must not move did not move.

Two properties of that command are load-bearing and neither is incidental:

- **Comment-stripping is required.** Task 1 adds a header note whose reversal
  condition is a write call appearing in this file, so the note necessarily names
  write APIs in prose. An unfiltered count is self-invalidating.
- **The API set is enumerated, not `writeFileSync` alone.** A `writeFileSync`-only
  count misses `appendFileSync`, `createWriteStream`, `renameSync`, `cpSync` and
  the rest. Round 1's `WR-13` asserted this script writes; round 2's review
  records that as a correction, and the wider set is the stronger measurement that
  settles it.
- **`process.stderr.write(` is deliberately outside the pattern.** Stdio is not a
  filesystem write, and a bare `.write(` pattern would red on a correct file. This
  file has exactly five, measured comment-stripped, at `:1056`, `:1100`, `:1117`,
  `:1131` and `:1154` post-edit (`:1015`, `:1059`, `:1076`, `:1090`, `:1113`
  pre-edit — the count is unchanged at 5; the line numbers shifted by the header
  block Task 1 added).

**Form 2 — the closed fs import surface.** This is the closed form of the same
fact, and it is what plan 32-18's write-freedom assertion pins:

```
$ grep -v '^\s*//' scripts/audit-gate.mjs | grep 'node:fs'
import { readdirSync, readFileSync } from "node:fs";
```

- Binds exactly `{ readdirSync, readFileSync }` from `node:fs`.
- Binds **nothing** from `node:fs/promises` (comment-stripped count: 0).
- No fs namespace import, no `require` of fs, no dynamic `import()` of fs
  (comment-stripped count: 0).
- Line number: `:130` post-edit. **It was `:90` at base `b64e9a6`**; Task 1's
  40-line header block moved it. Plan 32-18 cites `:90` — that citation is stale
  the moment this plan lands, and is recorded here so 32-18 measures the state
  rather than the stale number.

> **A measurement defect found and fixed in this task's own instrument.** The
> first run of these two checks used unstripped greps for the stderr count and the
> import surface, and scored 6 stderr writes and 1 `node:fs/promises` binding — both
> wrong, both caused by the header note Task 1 had just added naming those very
> tokens while explaining why they are excluded. The instrument was comment-stripped
> to match the write count, and re-run. This is the exact self-invalidation the plan
> warned about for the write count, reproduced one criterion over; it is recorded
> rather than quietly corrected.

### 4d. The recorded design argument this respects

`src/mcp/vice/audit-integrity.test.ts:162-171` records why the synthetic tree
lives outside the repository: a committed fixture literally named
`docs-*.test.ts` would join the real guard glob and red CI permanently, so the
tree is built under `mkdtempSync(join(tmpdir(), ...))` where it is *structurally
incapable* of doing that.

Adding containment would force one of two things, and both are worse:

1. **Relocating that idiom** — overriding a recorded design decision this round
   was not asked to re-take, in a file this plan is forbidden to edit; or
2. **An `allowExtra` entry wide enough to cover any temp directory** — which is
   precisely the relaxation hatch `audit-root.mjs`'s own header forbids ("Do not
   add an 'allow anything' escape"), and which this plan's prohibition 1 names
   explicitly.

### 4e. The named reversal trigger

**The moment a filesystem write appears in `scripts/audit-gate.mjs`, the basis is
gone and containment becomes required.** That is not left to memory:

- It is written into the file's own header as a dated decision block.
- Plan 32-18 pins it mechanically, carrying `audit-gate` in the completeness
  matrix with a typed `uncontained-read-only` expectation, plus the two-part
  write-freedom assertion (closed import surface + enumerated API count). That
  assertion is the **sole mechanical revocation** of `T-32-22`.

This is strictly stronger than containment-by-default, which would have left the
reason unstated.

**Residual hole, named rather than implied:** `audit-gate.mjs` binds `spawnSync`
from `node:child_process`, so a write performed by a *spawned* process is outside
both halves of the write-freedom measurement, and neither half claims to cover it.

### 4f. The anticipated scoring disagreement

The verifier's truth 12 is phrased generically ("Every `--root` argument is
resolved through `resolveContainedRoot()`"), while its `missing[1]` names only
`parseRootArg()` and `booleanFlags`. This plan followed the `missing` item. **A
verifier reading truth 12 literally may still score it partial.** That outcome is
anticipated here rather than discovered later, and the counter-argument above is
written down so the decision can be re-taken with the measurement in hand rather
than re-derived from scratch.

---

## 5. The two committed plant descriptors, re-measured

Two registry rows plant into `scripts/audit-gate.mjs`. Neither targets
`parseArgs()`, so neither should have been disturbed — but "should" is not a
measurement. `grep -aoF` is used so a NUL byte cannot hide a match.

```
$ grep -aoF 'export const DOCS_GUARD_FLOOR = 7;' scripts/audit-gate.mjs | wc -l
1

$ grep -aoF '  "docs-absorbed-decisions.test.ts",' scripts/audit-gate.mjs | wc -l
1
```

Both were **1** before the edit and **1** after. The whole-set sweep plan 32-15
proved completes is not broken by this plan.

**The verdict line is byte-identical.** `console.error("audit-gate: REFUSED")`
lives at `:1266` post-edit and appears in no diff hunk. The only two occurrences
of `REFUSED` in `git diff` are additions inside Task 1's new comment block:

```
$ git diff -U2 scripts/audit-gate.mjs | grep -n 'REFUSED'
64:+  // FAIL and REFUSED paths below: all three are separated by their MESSAGE
66:+  // REFUSED`), never by their status. This is the call-site shape
```

The gate's verdict refusal, its `audit-gate: FAIL` typo line and an argument
rejection remain three distinguishable things.

---

## 6. The six false comment blocks — the census, in all three forms

### 6a. Why the census measures ONE literal and says so

This census measures the **flag-count claim only**. It does not measure the "was
not migrated / is not on the shared parser" half, and the promise is scoped to
exactly what the command measures — a wider promise beside a narrower command is
the instrument-overclaim shape this phase exists to remove.

The non-migration half **cannot be censused at all**, and the reason is recorded
here so a later reader does not "strengthen" the census by adding a second
literal: `not migrated` returns **6** at base over these same six files, but the
prescribed correction itself *reports* that the previous note asserted the script
was deliberately not migrated. A `not migrated` census would therefore red on a
CORRECT retraction and could never reach 0. That literal is unusable by
construction. The non-migration half is carried by the reported-past-tense rule
and by the per-block read in §6c.

### 6b. Three readings, all recorded

```
$ for f in scripts/*.mjs scripts/lib/*.mjs; do sed -e 's|^[[:space:]]*//[[:space:]]*| |' "$f" | tr -s '[:space:]' ' ' | grep -a -o -i 'carries five further flags' | wc -l; done | paste -sd+ | bc
```

| Reading | Form | At base `b64e9a6` | After `b23dbc5` |
|---|---|---|---|
| 1 | single-line `grep -a -c` — **FORBIDDEN** | **5** | 0 |
| 2 | whitespace-insensitive, case-sensitive | **6** | 0 |
| 3 | whitespace-insensitive, case-insensitive — **REQUIRED** | **6** | **0** |

Per-file breakdown at base, reading 3 — one occurrence in each of six files:

```
scripts/check-guard-fates.mjs: 1
scripts/check-skill-cli-invocations.mjs: 1
scripts/check-skill-description-overlap.mjs: 1
scripts/check-skill-fork-honesty.mjs: 1
scripts/check-skill-tool-coverage.mjs: 1
scripts/generate-tool-support-table.mjs: 1
```

**Why the single-line form is forbidden here, measured rather than asserted:** it
returns **5**, not 6, because `scripts/generate-tool-support-table.mjs:360-361`
wraps the phrase across a line break — line 360 ends `carries five` and line 361
opens `// further flags,`. A single-line census can pass while a live false claim
survives in the sixth file.

**Why `-i` is required separately from that:** a retraction opening a sentence
with the claim capitalised would re-assert it in the present tense while passing a
case-sensitive census silently. The reading was re-taken with `-i` in place rather
than carried over: the case-sensitive form **also** returns 6, so `-i` does not
change the baseline and is a forward guard, not a widener of the current count.

The **6** is non-vacuous and was re-taken in this task's own tree, not copied from
the plan.

### 6c. What the six notes said, why it was false, and the per-block read

All six asserted `audit-gate.mjs` had deliberately not been migrated (`WR-13`).
All six gave as the reason that it carried five further flags; five of the six
added "with their own exactly-one-selector rule"
(`scripts/generate-tool-support-table.mjs` carries only the flags half).

**Measured on the subject:** `audit-gate.mjs` accepts **three** flags in total —
`--root`, `--json`, `--hook` — and has **no selector rule at all**.

**Measured on the file the description actually fits:**
`scripts/audit-mutation-harness.mjs` carries **five** flags (`--root`, `--row`,
`--rows`, `--all`, `--out`) and **does** enforce an exactly-one-of
`--row`/`--rows`/`--all` rule (`parseArgs()`, the `selectors !== 1` throw).

A justification written about one file was copied into six. That is `IN-06` one
layer up: the same copy-a-claim-without-checking-it failure, in the comments
rather than in the code. The blocks were **corrected, not deleted** — a note
recording how a wrong claim spread is the cheapest protection against it spreading
again, and `gaps[0].missing[2]` offers deletion only as an alternative to
correction, not as a preference.

**The per-block read that covers what the grep cannot.** Every remaining mention
of `audit-gate` across `scripts/*.mjs` and `scripts/lib/*.mjs` was listed and read
for tense. One live present-tense residue was found that the census cannot see and
that no criterion named:

> `scripts/generate-tool-support-table.mjs:348` read "the same nine lines
> `scripts/audit-gate.mjs` **still carries**" — falsified by Task 1, and a live
> sentence telling a reader that `audit-gate.mjs` is off the shared parser.

It was corrected to reported past tense in the same commit. Without the per-block
read it would have survived the census untouched, which is the concrete
demonstration that the census is not the whole instrument.

### 6d. Every hunk confined to a comment

No logic changed in any of the six. Verified per file: every `+`/`-` line in
`git diff -U0` whose first non-space character is not `//` was counted, and the
count is **0** for all six.

| File | `git diff --numstat` | non-comment changed lines |
|---|---|---|
| `scripts/check-guard-fates.mjs` | 21 / 3 | 0 |
| `scripts/check-skill-cli-invocations.mjs` | 21 / 5 | 0 |
| `scripts/check-skill-tool-coverage.mjs` | 21 / 5 | 0 |
| `scripts/check-skill-description-overlap.mjs` | 21 / 5 | 0 |
| `scripts/check-skill-fork-honesty.mjs` | 21 / 5 | 0 |
| `scripts/generate-tool-support-table.mjs` | 28 / 6 | 0 |

No declaration order, function order or export order changed.

### 6e. The still-true statements carried forward

**`scripts/check-guard-fates.mjs` — byte-identical to base.** The no-relaxation-
hatch paragraph survived untouched (base `:851-855`, now `:869-873`):

```
// `--root <dir>` and `--json` remain this gate's only surface: there is
// deliberately no environment-variable override, no skip flag and no waiver
// file anywhere in it (the no-relaxation-hatch rule recorded in
// `scripts/audit-gate.mjs`'s header). A root that cannot be honoured REFUSES;
// it never degrades into a silent read of the default root.
```

**`scripts/generate-tool-support-table.mjs` — preserved with ONE required
correction, stated rather than glossed.** The write-defect sentences are
byte-identical to base and appear in no diff hunk:

```
// `--root=<dir>`, a valueless `--root` and every typo, so the invocation fell
// through to the default root -- and because THIS is the one audited script
// that WRITES, a mistyped root overwrote the real `docs/tool-support.md` and
// exited 0 while printing success. The reader is deleted; `parseRootArg()` in
// `lib/audit-root.mjs` is now the single argv seam, as `resolveContainedRoot()`
// is the single containment seam.
```

The clause immediately before them was **not** preserved byte-identical: it is the
`:348` "still carries" residue described in §6c, which Task 1 falsified. It was
corrected. Recording it as "preserved byte-identical" would have been false.

---

## 7. The gates, re-run

### 7a. `check-guard-fates`

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 846.
exit=0
```

### 7b. `audit-gate`

```
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

### 7c. `npm run test:automated`

```
$ cd src/mcp/vice && npm run test:automated
# tests 2994
# suites 24
# pass 2986
# fail 2
# cancelled 0
# skipped 1
# todo 5
# duration_ms 47808.036637
exit=1
```

**Four counts, beside the broker state read in §0 (unit `inactive`, no broker
process, no `x64sc` process):** 2994 tests, 2986 pass, **2 fail**, 1 skipped.

Both failures are named, and **neither was made green**:

**Failure 1 — `the matrix covers EVERY script wired to the shared argv seam`**
(`audit-root-args.test.ts:428`). This is the completeness guard **working as
designed**. Its population predicate is `src.includes("parseRootArg(")`, so Task 1
necessarily moves `audit-gate` into the population, and the matrix does not yet
carry a row for it:

```
    a root-accepting script exists that this file does not exercise (or vice versa). The whole point of the shared seam is that no consumer is left untested -- add the missing row to MATRIX rather than relaxing this assertion.
    + actual - expected
      [
    +   'audit-gate',
        'check-guard-fates',
        'check-skill-cli-invocations',
        'check-skill-description-overlap',
        'check-skill-fork-honesty',
        'check-skill-tool-coverage',
```

**This red is the designed outcome, and plan 32-18 owns closing it.** Plan
32-18's own acceptance criteria require this exact test to exit **NON-ZERO** with
`audit-gate` named in the diff — "A green run here fails this criterion — the
whole point is that the flipped predicate bites" — and 32-18 adds the row
(`audit-gate`, contained expectation `uncontained-read-only`, no extra arguments).

Nothing was relaxed to silence it. No exclusion list was added, no predicate was
narrowed, no assertion was deleted; `src/mcp/vice/audit-root-args.test.ts` was not
edited by this plan at all (it belongs to plan 32-17 in this same wave). The
assertion's own instruction — "add the missing row to MATRIX rather than relaxing
this assertion" — is followed by leaving it red for its owner.

**Failure 2 — `path agreement (D-3, D-6 ...)`** (`repo-root.test.ts:178`). A
worktree-location artifact, unrelated to this plan:

```
    the agreed directory must not sit under .claude -- got /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-ab44a8d427a4bf8f0/.vice-supervisor
```

The assertion forbids the supervisor directory sitting under `.claude`. This
executor's worktree *is itself* under `.claude/worktrees/`, so the agreed path
inherits that prefix. It is caused by where the run happened, not by what changed:
this plan touched only `scripts/*.mjs`, and this test concerns launcher/repo-root
path resolution. It does not reproduce on the merged branch.

### 7d. The whole-glob `npm test` was NOT run

Stated in words rather than by omission. `npm test` — the bare full glob
`node --test '*.test.*'` — **was not run**, because it does not terminate on this
host: `vice-proxy.test.ts` blocks indefinitely. `evidence/32-close-gate.md` §2b
already records that non-termination as the measured result (`timeout 180` →
`exit=124`, and plan 32-07 measured the same file still running when killed at
300106 ms; broken-windows ledger entry **#26**). This task cites that record
rather than re-taking the decision.

---

## 8. Tree state

```
$ git status --porcelain
(no output — clean, before and after, apart from this evidence file)
```

`src/mcp/vice/node_modules/` was provisioned with `npm ci` to run the suites; it
is gitignored and does not appear.

---

## 9. What this file does and does not establish

**Establishes:** the three malformed `--root` forms that produced a full real-tree
report now fail loudly and namedly at exit 1; the unflagged, `--json` and `--hook`
paths are unchanged; the compatibility contract holds at 44/44 with no test file
edited; both plant descriptors still match exactly once; the flag-count claim is
gone from all six files; and the containment decision rests on a re-measured
write-freedom fact with a mechanically-guarded reversal trigger.

**Does not establish:** that `audit-gate.mjs` is contained — it is not, by
decision. That no *spawned* process writes on its behalf — `spawnSync` is bound
and that hole is named in §4e. That `npm test`'s whole glob passes — it was not
run, per §7d. That `audit-root-args.test.ts` is green — it is red by design, and
§7c names its owner.
