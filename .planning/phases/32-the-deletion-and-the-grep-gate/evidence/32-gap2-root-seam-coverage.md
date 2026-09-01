# Gap 2, second half — the split read, closed raw

**Date:** 2026-09-01
**Plan:** 32-12 (gap-closure round 1, wave 3)
**Commit measured:** `2916b10` (Task 1 landed); tests added on top of it in the same branch.
**Base:** `7206f99` — the wave-2 merge, i.e. plans 32-10 and 32-11 already in.

This file is NEW. It corrects, rewrites and replaces nothing. No dated evidence
record, no `*-SUMMARY.md` and not `32-VERIFICATION.md` was edited by the plan
that produced it.

---

## 0. The state of the machine, established once

Every measurement below was taken on the same host, at the same commit, with the
same emulator state. Read read-only; nothing was started or stopped.

```
$ pgrep -af 'vice-broker|x64sc' | grep -v -- "--test"
(no output)   filtered-exit=1
```

**No VICE broker and no `x64sc` process was running.** This matters because a live
broker deterministically reds the `BACK-05` test and the `stock-broker-live`
family, and any suite figure quoted without it is uninterpretable. The `--test`
filter is required: `node --test` runs list `vice-broker-*.test.ts` in their own
argv and match a naive `pgrep`.

```
$ git rev-parse HEAD
2916b10ce0ab23a88abeb61062946938824cb3f6
```

The measurements ran inside a GSD worktree at
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1e16d869eb90f17e`,
so every absolute path quoted below carries that prefix. On the merged branch the
same paths read `/home/henrik/dev/henrik/git/c64-re-tools`.

### `git status --porcelain`, before and after

Captured immediately before the first command in this document and immediately
after the last:

```
before:                                    after:
 M src/mcp/vice/audit-root-args.test.ts     M src/mcp/vice/audit-root-args.test.ts

$ diff <before> <after>  ->  identical (exit 0)
$ ls -d .audit-root-synth-*  ->  no such file or directory
```

Byte-identical. The one modified path is this plan's own Task 2 work in progress
at the time of measurement; it was committed immediately afterwards. No fixture
directory survived any run, including the deliberate mid-run failure in §5.

---

## 1. The verifier's ✗ FAIL rows, as they behave now

`32-VERIFICATION.md`'s "Behavioural Spot-Checks" table (lines 297–315) carries
**four** ✗ FAIL rows. The before-values are QUOTED from that table and attributed
to it rather than re-measured — the old behaviour no longer exists to measure,
and re-deriving it would mean reverting the fix, which is not a measurement of
anything a reader can reproduce.

### Row 1 — CR-01, `--root=<dir>` on the read gate

| | |
|---|---|
| Command | `node scripts/check-guard-fates.mjs --root=/tmp` |
| Verifier's before (cited) | `` `OK …`, exit 0 (should have refused) `` — ✗ FAIL |
| Closed by | plan 32-11 |

```
$ node scripts/check-guard-fates.mjs --root=/tmp
exit=1
check-guard-fates: BAD ARGUMENTS -- "--root=/tmp" uses the equals form. The space-separated spelling `--root <dir>` is the ONLY accepted one. Write: node scripts/check-guard-fates.mjs --root "/tmp". Usage: node scripts/check-guard-fates.mjs [--root <dir>] [--json]
```

### Row 2 — CR-01, typo'd flag

| | |
|---|---|
| Command | `node scripts/check-guard-fates.mjs --rooot /tmp` |
| Verifier's before (cited) | `` `OK …`, exit 0 `` — ✗ FAIL |
| Closed by | plan 32-11 |

```
$ node scripts/check-guard-fates.mjs --rooot /tmp
exit=1
check-guard-fates: BAD ARGUMENTS -- unrecognised argument "--rooot". Usage: node scripts/check-guard-fates.mjs [--root <dir>] [--json]
```

### Row 3 — CR-01, `--root=<dir>` on the WRITING script

| | |
|---|---|
| Command | `node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here` |
| Verifier's before (cited) | `` `wrote docs/tool-support.md` — the real one `` — ✗ FAIL |
| Closed by | plan 32-10 (argv) and, for the in-repository case, **this plan** |

```
$ node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here
exit=1
generate-tool-support-table: BAD ARGUMENTS -- "--root=/tmp/definitely-not-here" uses the equals form. The space-separated spelling `--root <dir>` is the ONLY accepted one. Write: node scripts/generate-tool-support-table.mjs --root "/tmp/definitely-not-here". Usage: node scripts/generate-tool-support-table.mjs [--root <dir>]
```

The space-separated spelling of the same path is refused one layer further in, by
containment rather than by the parser — two failure classes, one exit code, told
apart by their prefix:

```
$ node scripts/generate-tool-support-table.mjs --root /tmp/definitely-not-here
exit=1
generate-tool-support-table: REFUSED -- --root "/tmp/definitely-not-here" resolves to /tmp/definitely-not-here, which is OUTSIDE the repository root /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1e16d869eb90f17e. Refusing: this flag decides which tree the audit reads and writes, so it is contained to the repository by construction rather than by convention. Note that a sibling directory whose name merely shares the root's prefix (e.g. a `-evil` suffix) is refused here too -- the comparison is segment-wise.
```

```
$ ls -d /tmp/definitely-not-here
ls: cannot access '/tmp/definitely-not-here': No such file or directory
```

The path genuinely does not exist, so this is the refusal firing rather than an
incidental ENOENT.

### Row 4 — CR-03, four gates import from `DEFAULT_ROOT`

| | |
|---|---|
| Command | `grep` for `^import.*from "\.\./src` |
| Verifier's before (cited) | `2+1+1+2 static imports found; 4/5 files also carry the contradicting docblock` — ✗ FAIL |
| Closed by | **this plan** |

The static imports are still there — they are not the defect, and the remedy
chosen does not remove them:

```
$ grep -c 'from "\.\./src/' scripts/check-skill-tool-coverage.mjs scripts/check-skill-fork-honesty.mjs scripts/check-skill-cli-invocations.mjs scripts/generate-tool-support-table.mjs scripts/check-skill-description-overlap.mjs scripts/check-guard-fates.mjs
scripts/check-skill-tool-coverage.mjs:2
scripts/check-skill-fork-honesty.mjs:1
scripts/check-skill-cli-invocations.mjs:1
scripts/generate-tool-support-table.mjs:2
scripts/check-skill-description-overlap.mjs:0
scripts/check-guard-fates.mjs:0
```

Unchanged: 2+1+1+2, exactly the verifier's count. What changed is the CLAIM and
the BEHAVIOUR beside them:

```
$ grep -c 'do not re-derive a path from' <the same six files>
scripts/check-skill-tool-coverage.mjs:0        <- was 1
scripts/check-skill-fork-honesty.mjs:0         <- was 1
scripts/check-skill-cli-invocations.mjs:0      <- was 1
scripts/generate-tool-support-table.mjs:0      <- was 0 (measured, not assumed; see below)
scripts/check-skill-description-overlap.mjs:1  <- unchanged, and TRUE there
scripts/check-guard-fates.mjs:0                <- unchanged

$ grep -c 'SPLIT READ REFUSED' <the same six files>
scripts/check-skill-tool-coverage.mjs:1
scripts/check-skill-fork-honesty.mjs:1
scripts/check-skill-cli-invocations.mjs:1
scripts/generate-tool-support-table.mjs:1
scripts/check-skill-description-overlap.mjs:0
scripts/check-guard-fates.mjs:0
```

**`scripts/generate-tool-support-table.mjs` was measured rather than assumed.** The
verifier wrote "4/5 files also carry the contradicting docblock"; measured at
`7206f99`, that file's count for this sentence is **0**. It carries a DIFFERENT
sentence — "do not reintroduce a second path constant derived from `DEFAULT_ROOT`
outside this function" — which is about paths only, and is true. It was not
deleted. A clarifying paragraph was appended to it stating what it does not cover
(the two static imports are not paths and no argument can move them) and that
`main()` now refuses a non-default root before `paths()` is ever called.

So the three files that carried the false sentence are 3, not 4, and all three now
say instead what they actually do.

---

## 2. THE SPLIT READ ITSELF — the measurement this plan exists for

The `[edge:CUT-04/adjacency]` reject side, measured at `7206f99` BEFORE any edit
in this plan, using an in-repository synthetic tree carrying copies of the real
manifests, the real skill corpus and a `docs/` directory.

### 2a. Before — all four exit 0 on a hybrid read

```
$ SYNTH=$(mktemp -d "$PWD/.audit-root-synth-probe-XXXXXX")
$ # populate: src/mcp/vice/{tools-manifest.json,tools-manifest.stock.json,vice-proxy.ts,vice.ts,anno-cli.ts},
$ #           src/skills/, installer/skills/, README.md, docs/stock-vice-parity.md
$ node scripts/generate-tool-support-table.mjs --root "$SYNTH"
exit=0
generate-tool-support-table: wrote docs/tool-support.md under --root /…/.audit-root-synth-probe-FYns68

$ node scripts/check-skill-tool-coverage.mjs --root "$SYNTH"
exit=0
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 33 files across 7 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries). anno CLI verbs: 3 parsed from anno-cli.ts, 3/3 resolved (named by at least one skill file).

$ node scripts/check-skill-fork-honesty.mjs --root "$SYNTH"
exit=0
check-skill-fork-honesty: OK -- 11 fork-only mentions across 33 files in 7 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).

$ node scripts/check-skill-cli-invocations.mjs --root "$SYNTH"
exit=0
check-skill-cli-invocations: SKIPPED the installer/skills/ regeneration -- --root is /…/.audit-root-synth-probe-FYns68, not this repository, and installer/scripts/sync-skills.mjs is only run as first-party code. The --root tree must carry both skill trees itself; the scan below reads them as they are on disk.
check-skill-cli-invocations: OK -- 18 documented anno CLI invocation(s) extracted from 20 of 60 skill file(s) across 2 trees (src/skills, installer/skills); 3 verb(s) covered (coverage, export-asm, render-memmap); every flag checked against anno-cli.ts's own VERB_OPTIONS, every positional against the kinds its loader reads, every REQUIRED flag for its presence, and every value-taking flag for both a value and that value's kind.

$ git diff --exit-code -- docs/tool-support.md   ->  exit 0 (real table untouched)
$ ls -l "$SYNTH/docs/tool-support.md"            ->  8132 bytes, WRITTEN
```

**Read the four messages carefully — each one is a hybrid.** The `vice_*` NAMES came
from the synthetic corpus and the two tables they were checked against
(`CAPABILITY_REGISTRY`, `CURATED_ANNO_TOOLS`) came from the real repository. The
fork-only MENTIONS came from the synthetic corpus and the 24 names they were
policed against came from the real registry. The 18 documented INVOCATIONS came
from the synthetic corpus and `VERB_OPTIONS` came from the real `anno-cli.ts`. The
8132-byte table was rendered from the synthetic manifests against the real
registry and the real deny-list — a document that is neither tree's truth, written
into the synthetic tree, exiting 0 while printing success.

A violation planted in that corpus would have been measured against data the plant
never touched. That is "a false green inside the audit instrument itself", and it
is reproduced above rather than asserted.

### 2b. After — all four refuse, naming what they could not move

```
$ node scripts/generate-tool-support-table.mjs --root "$SYNTH"
exit=1
generate-tool-support-table: SPLIT READ REFUSED -- --root resolves to /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1e16d869eb90f17e/.audit-root-synth-verify-Y3ONHf, which is not this repository's root /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a1e16d869eb90f17e. This script reads its CORPUS from the resolved root, but its COMPARISON DATA arrives through static imports that cannot follow a root override: the identifiers are `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts`, `DENY_LIST` from `../src/mcp/vice/vice.ts`. A static import specifier is resolved against this file's own location, so honouring the root would compare a corpus read from /…/.audit-root-synth-verify-Y3ONHf against comparison data read from /…/agent-a1e16d869eb90f17e -- a FALSE GREEN rather than a stricter check, because a violation planted in the resolved tree would be measured against data the plant never touched. Refusing rather than half-honouring it (CR-03). Only a --root that RESOLVES to /…/agent-a1e16d869eb90f17e is accepted here. `scripts/check-skill-description-overlap.mjs` is the one skill gate that binds no such import and does honour an arbitrary contained root.

$ node scripts/check-skill-tool-coverage.mjs --root "$SYNTH"
exit=1
check-skill-tool-coverage: SPLIT READ REFUSED -- … the identifiers are `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts`, `CURATED_ANNO_TOOLS` from `../src/mcp/vice/anno-tools.ts`. …

$ node scripts/check-skill-fork-honesty.mjs --root "$SYNTH"
exit=1
check-skill-fork-honesty: SPLIT READ REFUSED -- … the identifier is `CAPABILITY_REGISTRY` from `../src/mcp/vice/capability-registry.ts`. …

$ node scripts/check-skill-cli-invocations.mjs --root "$SYNTH"
exit=1
check-skill-cli-invocations: SPLIT READ REFUSED -- … the identifier is `VERB_OPTIONS` from `../src/mcp/vice/anno-cli.ts`. …
```

The elided `…` in the last three is the identical shared body — resolved root,
default root, the static-specifier explanation, the false-green consequence, the
`CR-03` attribution and the description-overlap exemption. It is built once, in
`scripts/lib/audit-root.mjs`'s `splitReadRefusalReason()`, so the four cannot
drift apart; only the prefix and the identifier list are per-script. The four
messages in full, with their per-script identifier lists, are the four rows above.

### 2c. The filesystem consequence, closed

```
$ ls "$SYNTH/docs/tool-support.md"          ->  synth-table=ABSENT
$ git diff --exit-code -- docs/tool-support.md   ->  exit 0
```

The refusal is checked before `paths()` is built, before any `existsSync`, before
any read and before the write. A refused root now produces **no I/O at all** — not
a wrong write, not a right one. `T-32-01` is closed by construction rather than by
argument validation alone.

### 2d. The accept side — every spelling that RESOLVES to the repository root

The comparison is against RESOLVED paths, not raw arguments, so all of these are
the same tree:

```
$ for s in generate-tool-support-table check-skill-tool-coverage check-skill-fork-honesty check-skill-cli-invocations; do
    node scripts/$s.mjs --root .                 # dot
    node scripts/$s.mjs --root "$PWD"            # absolute
    node scripts/$s.mjs --root "$PWD/scripts/.." # absolute with a redundant segment
    node scripts/$s.mjs --root "./scripts/.."    # relative with a redundant segment
  done

generate-tool-support-table  dot=0 abs=0 abs-redundant=0 rel-redundant=0
check-skill-tool-coverage    dot=0 abs=0 abs-redundant=0 rel-redundant=0
check-skill-fork-honesty     dot=0 abs=0 abs-redundant=0 rel-redundant=0
check-skill-cli-invocations  dot=0 abs=0 abs-redundant=0 rel-redundant=0
```

All four spellings behave exactly like the unflagged run. A refusal written
against the raw argument instead of the resolved path would have accepted at most
one of them.

---

## 3. The full matrix — 44 cases, every one named

`node --test src/mcp/vice/audit-root-args.test.ts`

```
1..44
# tests 44
# suites 0
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11849.343206
```

Exit 0. 44 = plan 32-11's 36 + 8 added here (4 repository-root-spelling cases +
4 contract assertions). The four contained-root cases were TIGHTENED rather than
added, so they do not move the count.

| # | Case | Result |
|---|---|---|
| 1 | `parseRootArg`: the unflagged invocation is untouched | ok |
| 2 | `parseRootArg`: the space-separated spelling is accepted | ok |
| 3 | `parseRootArg`: the equals form is REJECTED, not guessed at | ok |
| 4 | `parseRootArg`: a trailing `--root` with no value is REJECTED | ok |
| 5 | `parseRootArg`: a following token that is itself a flag is a MISSING value | ok |
| 6 | `parseRootArg`: an empty value never resolves to the default root | ok |
| 7 | `parseRootArg`: an unrecognised token is REJECTED and named | ok |
| 8 | `parseRootArg`: a repeated `--root` is REJECTED, not resolved by position | ok |
| 9 | `parseRootArg`: a declared boolean flag is reported, never eaten as a value | ok |
| 10 | the equals form refuses and leaves the REAL table byte-identical | ok |
| 11 | a mistyped flag refuses and names the token | ok |
| 12 | a valueless `--root` refuses and names the flag | ok |
| 13 | an out-of-repository `--root` is REFUSED | ok |
| 14 | a sibling sharing the root's string prefix is REFUSED, not treated as a typo | ok |
| 15 | `--root` naming the repository root itself is accepted and writes identical bytes | ok |
| 16 | the matrix covers EVERY script wired to the shared argv seam | ok |
| 17 | `generate-tool-support-table`: the equals form exits non-zero and names itself | ok |
| 18 | `check-guard-fates`: the equals form exits non-zero and names itself | ok |
| 19 | `check-skill-tool-coverage`: the equals form exits non-zero and names itself | ok |
| 20 | `check-skill-fork-honesty`: the equals form exits non-zero and names itself | ok |
| 21 | `check-skill-cli-invocations`: the equals form exits non-zero and names itself | ok |
| 22 | `check-skill-description-overlap`: the equals form exits non-zero and names itself | ok |
| 23 | `generate-tool-support-table`: an out-of-repository root exits 1 with REFUSED | ok |
| 24 | `check-guard-fates`: an out-of-repository root exits 1 with REFUSED | ok |
| 25 | `check-skill-tool-coverage`: an out-of-repository root exits 1 with REFUSED | ok |
| 26 | `check-skill-fork-honesty`: an out-of-repository root exits 1 with REFUSED | ok |
| 27 | `check-skill-cli-invocations`: an out-of-repository root exits 1 with REFUSED | ok |
| 28 | `check-skill-description-overlap`: an out-of-repository root exits 1 with REFUSED | ok |
| **29** | **`generate-tool-support-table`: a contained root that is not the default root is a SPLIT READ refusal** | **ok** |
| **30** | **`check-skill-tool-coverage`: same** | **ok** |
| **31** | **`check-skill-fork-honesty`: same** | **ok** |
| **32** | **`check-skill-cli-invocations`: same** | **ok** |
| **33** | **`generate-tool-support-table`: every spelling that RESOLVES to the repository root is accepted** | **ok** |
| **34** | **`check-skill-tool-coverage`: same** | **ok** |
| **35** | **`check-skill-fork-honesty`: same** | **ok** |
| **36** | **`check-skill-cli-invocations`: same** | **ok** |
| 37 | `check-guard-fates`: a contained root equal to the repository root runs and exits 0 | ok |
| 38 | `check-skill-description-overlap`: a contained root REDIRECTS the reads, provably | ok (now also asserts it does NOT refuse) |
| 39 | a repeated `--root` is rejected by the spawned script, naming BOTH values | ok |
| 40 | a declared boolean flag is never swallowed as the root's value | ok |
| **41** | **the six scripts carry no NUL byte, so a text read of them loses nothing** | **ok** |
| **42** | **split-read contract: every root-accepting script that binds `../src` statically refuses** | **ok** |
| **43** | **split-read contract: each refusal NAMES every specifier its script binds statically** | **ok** |
| **44** | **split-read contract: the predicate REPORTS a planted violation, and clears a planted fix** | **ok** |

Rows in **bold** are new or rewritten by this plan. Cases 29–32 previously asserted
only "non-zero plus a diagnostic naming the script" — a shape satisfied by BOTH
the old incidental missing-input stop AND the new principled refusal. A test that
cannot tell those apart cannot detect a regression back to the first, so they now
assert the literal, the resolved root, the default root, every declared specifier,
and the ABSENCE of the missing-input diagnostic (proving the refusal precedes the
read).

---

## 4. The two clean controls, measured

```
$ grep -cE '^import .* from "\.\./src' scripts/check-guard-fates.mjs scripts/check-skill-description-overlap.mjs
scripts/check-guard-fates.mjs:0
scripts/check-skill-description-overlap.mjs:0

$ grep -c 'from "\.\./src/' scripts/check-guard-fates.mjs scripts/check-skill-description-overlap.mjs
scripts/check-guard-fates.mjs:0
scripts/check-skill-description-overlap.mjs:0
```

Zero under both the narrow (line-anchored) and the broad (specifier-only) form, so
neither is exempt by an accident of import formatting. `check-guard-fates` derives
everything it needs from a git object store; `check-skill-description-overlap`
reads both halves of its comparison — the skills corpus AND `CLAUDE.md` — from the
resolved root, which is why its docblock sentence is true and was not deleted.

Case 42 asserts this set is exactly `["check-guard-fates",
"check-skill-description-overlap"]` by deep equality, so a future edit that gives
either one a `../src` import without a refusal fails the assertion instead of
sliding past it as "still no violations found".

---

## 5. The deliberate non-vacuity check

The refusal literal was removed from ONE of the four scripts and the file re-run.

```
$ perl -pi -e 's/SPLIT READ REFUSED/ROOT NOT HONOURED/g' scripts/check-skill-fork-honesty.mjs
$ grep -c 'SPLIT READ REFUSED' scripts/check-skill-fork-honesty.mjs
0
$ cd src/mcp/vice && node --test audit-root-args.test.ts
exit=1
# tests 44
# pass 42
# fail 2
not ok 31 - check-skill-fork-honesty: a contained root that is not the default root is a SPLIT READ refusal
not ok 42 - split-read contract: every root-accepting script that binds ../src statically refuses
```

Both halves went red: the BEHAVIOURAL case (the spawned process no longer prints
the contract literal) and the CONTRACT case (the file's text is selected by the
antecedent and no longer satisfies the consequent). One would have been enough to
fail; two failing is what proves the two assertions are independent rather than
one assertion counted twice.

Restored, and the tree verified byte-identical:

```
$ cp <backup> scripts/check-skill-fork-honesty.mjs
$ grep -c 'SPLIT READ REFUSED' scripts/check-skill-fork-honesty.mjs
1
$ git status --porcelain
 M src/mcp/vice/audit-root-args.test.ts     (unchanged from before the check)
$ git diff --stat -- scripts/check-skill-fork-honesty.mjs
(empty)
```

Case 44 carries the same non-vacuity in the other direction, at unit level and
without touching the tree: a planted script text carrying the static import and no
refusal is REPORTED by the same predicate the six real files are driven through,
and the same predicate CLEARS that text once the refusal literal is added. The
second half matters as much as the first — without it the predicate could be
reporting the import rather than the missing refusal, and every refusing script
would be a false positive that happened to pass for the wrong reason.

---

## 6. The rest of the verification, raw

| # | Command | Result |
|---|---|---|
| 1 | the four bare runs (`node scripts/<name>.mjs`, no arguments) | `0 / 0 / 0 / 0` — identical to the pre-change values measured at `7206f99` |
| 2 | the two untouched root-accepting scripts, bare | `check-guard-fates=0`, `check-skill-description-overlap=0` |
| 3 | `node scripts/generate-tool-support-table.mjs` then `git diff --exit-code -- docs/tool-support.md` | `regen-exit=0`, `table-identical=0` |
| 4 | `node --test audit-root-args.test.ts` | 44 tests, 44 pass, 0 fail, exit 0 |
| 5 | `npm run typecheck` (in `src/mcp/vice`) | exit 0, no diagnostics |
| 6 | `npm run test:automated` (in `src/mcp/vice`) | 2994 tests, 2987 pass, **1 fail**, 1 skipped, 5 todo — see below |
| 7 | `node scripts/check-guard-fates.mjs` | exit 0 — the blocking CI gate still green after all three Gap-2 plans |
| 8 | `node scripts/check-no-analyser.mjs` | exit 0 |
| 9 | the nine `docs-*.test.ts` guards, run individually | 9/9 exit 0 |

The nine, each `node --test <file>` on its own:

```
docs-absorbed-decisions.test.ts   exit=0
docs-core-value-decision.test.ts  exit=0
docs-dangling-refs.test.ts        exit=0
docs-deferred-ledger.test.ts      exit=0
docs-fork-decision.test.ts        exit=0
docs-linerefs.test.ts             exit=0
docs-review-disposition.test.ts   exit=0
docs-uat-abstention.test.ts       exit=0
docs-worktree-isolation.test.ts   exit=0
count=9
```

### The one `test:automated` failure is the same worktree-location artifact

```
$ node --test repo-root.test.ts
not ok 5 - path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
# tests 6
# pass 5
# fail 1
```

`src/mcp/vice/repo-root.test.ts:178` asserts the resolved supervisor directory is
NOT under `.claude`. That is true on the main checkout and **false by
construction** for any GSD worktree, which is created at
`<repo>/.claude/worktrees/agent-<id>`. It failed identically for plan 32-10 in
wave 1 and plan 32-11 in wave 2; this plan touches five `scripts/*.mjs` and one
test file, none of which `repo-root.test.ts` reads.

It was deliberately NOT "fixed". Making a guard green under a condition it
correctly detects is the exact vacuity this phase exists to catch. **Expected on
the merged branch: 0 failures.**

Test count moved 2986 → 2994 (+8), matching the eight new cases exactly.

---

## 7. What the seam is now claimed to do — and what it is NOT

**Claimed.** Six scripts accept a `--root` flag. Every malformed spelling of it is
a named error at exit 1 (`BAD ARGUMENTS --`), every out-of-repository value is a
named refusal at exit 1 (`REFUSED --`), and every value that resolves inside the
repository is either honoured for BOTH halves of the script's comparison or
refused with a message naming the identifiers that make honouring it impossible
(`SPLIT READ REFUSED --`). Exactly one script — `check-skill-description-overlap`
— is in the first category, and its read-redirection is proved by an output the
real repository provably does not produce. The writing script can be pointed at no
tree but the real one, and a refused root causes no I/O.

**NOT claimed.** Four of the six gates do not SUPPORT a synthetic root; they
REFUSE one. This is the branch chosen from the two remedies the verifier named,
and the choice is a real narrowing of capability, not a disguised implementation
of it. The alternative — root-parameterised dynamic imports — would require every
synthetic tree to carry a working `src/mcp/vice/` module graph, at which point the
"synthetic tree" is a copy of the repository and no longer the small planted
corpus D-06's flag exists to point at.

**`WR-11`'s observation stands, and this plan does not close it.** The seam still
has no production caller: the fate registry passes a root override in 0 of 61 rows
and all 35 plants are `kind: "worktree"`. What now keeps the seam honest is the
CONTRACT ASSERTION (cases 42–44), not a caller — a script that acquires a
`../src` static import without acquiring a refusal fails the test file, whether or
not anyone is invoking `--root`. That is a weaker guarantee than a live consumer
and it is recorded as such rather than dressed up as one.

**Also not closed, and deliberately so:** `WR-06` (the fate guard does not tie an
observed red to its row's subject — data audited clean 35/35, so the registry is
honest today), `WR-10` (the new blocking CI gate hard-depends on live `.planning/`
artifacts and carries no removal trigger of its own), `WR-12`, `WR-13`
(`audit-gate.mjs` and `audit-mutation-harness.mjs` not migrated to the shared
parser), `WR-14`, and broken windows #28–#32. All stay OPEN in
`.planning/todos/pending/2026-08-31-phase-32-review-twenty-five-open-findings.md`.
`T-32-02` (lexical containment vs. an in-repository symlink pointing outward)
remains `accept`ed at ASVS L1 — though its reach is materially smaller now, since
four of the six scripts accept only the default root, where the containment
question does not arise at all.
