---
phase: 32-the-deletion-and-the-grep-gate
plan: 11
subsystem: audit-tooling
tags: [gap-closure, cut-04, argv, containment, in-06, expansion, spawned-matrix]
status: complete
requires:
  - "scripts/lib/audit-root.mjs — parseRootArg() and resolveContainedRoot() (plan 32-10)"
  - "scripts/generate-tool-support-table.mjs — the proven wiring shape (plan 32-10)"
provides:
  - "One argv reader for all six root-accepting scripts; five local copies deleted"
  - "The full six-script spawned matrix (18 cases) in src/mcp/vice/audit-root-args.test.ts"
  - "A from-disk completeness guard: a seventh root-accepting script fails the file by omission"
  - "The first proof that a contained --root actually REDIRECTS a gate's reads"
  - ".gitignore entry for the in-repository synthetic fixture"
affects:
  - "scripts/check-guard-fates.mjs (the blocking CI gate — three malformed root forms went exit 0 -> exit 1)"
  - "scripts/check-skill-tool-coverage.mjs, check-skill-fork-honesty.mjs, check-skill-cli-invocations.mjs, check-skill-description-overlap.mjs"
  - "plan 32-12 (settles the split read; pins the message this file deliberately leaves unpinned)"
tech-stack:
  added: []
  patterns:
    - "single-seam: six consumers, one argv reader, one containment resolver"
    - "two failure classes, same exit code, separated by message prefix (BAD ARGUMENTS -- vs REFUSED --)"
    - "table-driven spawned matrix whose population is derived FROM DISK, not restated"
    - "synthetic fixture built INSIDE the repository because containment requires it, removed twice over"
key-files:
  created: []
  modified:
    - scripts/check-guard-fates.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-skill-cli-invocations.mjs
    - scripts/check-skill-description-overlap.mjs
    - src/mcp/vice/audit-root-args.test.ts
    - .gitignore
decisions:
  - "The matrix's population is DERIVED from disk (every top-level scripts/*.mjs containing `parseRootArg(`) and asserted equal to the hand-written table, so the table cannot silently fall behind the tree."
  - "The four `refuses` contained-root cases assert SHAPE only (non-zero + a diagnostic naming the script), never the specific message — so the case survives plan 32-12's change to WHY they refuse without being rewritten between waves."
  - "The two `--json` ordering ACCEPT cases were deliberately kept OUT of the test file: each is a full run of the fate guard, and the file runs no script to completion twice. They are asserted at unit level and measured end to end below."
  - "scripts/audit-gate.mjs and scripts/audit-mutation-harness.mjs were NOT migrated (WR-13, scope fence), unchanged from plan 32-10's recorded decision."
metrics:
  duration: ~40 min
  completed: 2026-09-01
actuals:
  tokens: 43600
  tasks: 2
  commits: 2
---

# Phase 32 Plan 11: The Five Remaining Argv Readers Summary

Six root-accepting scripts now share one argv reader. The blocking CI fate gate,
which at HEAD answered `--root=/tmp`, `--rooot /tmp` and a valueless `--root`
with a full green report about the real repository, refuses all three by name —
and the description-overlap gate is now proved, not assumed, to read the tree its
`--root` names.

## Measurement method, stated before any number

Every figure below is the output of a command quoted beside it. Nothing here was
reasoned from the diff. Where a number is a baseline, it was measured at
`0aae79b` (this branch's base) BEFORE the first edit, not recalled.

**Broker state, established once and true for every run in this document:**

```
$ pgrep -af 'vice-broker|x64sc' | grep -v -- "--test"
(no output)   filtered-exit=1
```

No VICE broker and no `x64sc` process was running, so neither the BACK-05 test
nor the `stock-broker-live` family was contaminated. The `--test` filter is
required because `node --test` runs list `vice-broker-*.test.ts` in their own
argv and match a naive `pgrep`.

## Task 1 — Five readers deleted, five scripts wired

`scripts/check-guard-fates.mjs` was done FIRST, as the plan requires, because it
is the blocking CI gate and any regression there had to surface before the four
skill gates were touched.

Each file now:

- imports `parseRootArg` alongside `resolveContainedRoot` from `./lib/audit-root.mjs`;
- calls it with its own base name, so an argument rejection names the same source
  the containment refusal already named;
- handles the two failure classes in **two separate handlers** with two distinct
  prefixes at **one** exit status (`BAD ARGUMENTS --` vs `REFUSED --`). No new
  exit code was minted;
- carries a rewritten comment block naming the shared seam, `IN-06` (one reader
  copy-pasted into six files, so one defect shipped six times) and `WR-13`
  (`audit-gate.mjs` deliberately not migrated this round).

`scripts/check-guard-fates.mjs` alone declares a boolean flag; `--json` is passed
through `booleanFlags` and read as `flags["--json"]`.

The static imports at the top of `check-skill-tool-coverage.mjs`,
`check-skill-fork-honesty.mjs` and `check-skill-cli-invocations.mjs` were **not
touched** — that split read is plan 32-12's work and must land in its own commit
(D-07's ordering constraint applied to the auditor itself).

### The five bare runs, before and after

Command: `node scripts/<name>.mjs` with no arguments at all.

| Script | Bare exit at `0aae79b` (before) | Bare exit after | Changed? |
|---|---|---|---|
| `check-guard-fates` | 0 | 0 | no |
| `check-skill-tool-coverage` | 0 | 0 | no |
| `check-skill-fork-honesty` | 0 | 0 | no |
| `check-skill-cli-invocations` | 0 | 0 | no |
| `check-skill-description-overlap` | 0 | 0 | no |

### The three malformed forms, before and after

The same twenty invocations, run once at `0aae79b` and once at `06b9705`:

| Script | `--root=/tmp` | `--rooot /tmp` | `--root` (no value) |
|---|---|---|---|
| `check-guard-fates` | **0 → 1** | **0 → 1** | **0 → 1** |
| `check-skill-tool-coverage` | **0 → 1** | **0 → 1** | **0 → 1** |
| `check-skill-fork-honesty` | **0 → 1** | **0 → 1** | **0 → 1** |
| `check-skill-cli-invocations` | **0 → 1** | **0 → 1** | **0 → 1** |
| `check-skill-description-overlap` | **0 → 1** | **0 → 1** | **0 → 1** |

The baseline is not merely "exit 0" — the fate gate printed a complete, green
audit report about the real repository while being told to read `/tmp`:

```
$ node scripts/check-guard-fates.mjs --root=/tmp        # at 0aae79b
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 830.
BASELINE_EXIT=0
```

That is the audit instrument vouching for a tree it was explicitly told not to
read — `T-32-05`, reproduced rather than asserted.

### The boolean flag, both orderings, measured

```
$ node scripts/check-guard-fates.mjs --json                 -> exit 0, stdout begins {   "ok": true, ...
$ node scripts/check-guard-fates.mjs --json --root .        -> exit 0, stdout begins {   "ok": true, ...
$ node scripts/check-guard-fates.mjs --root . --json        -> exit 0, stdout begins {   "ok": true, ...
$ diff <unflagged --json> <--json --root .>                 -> identical (exit 0)
$ diff <--json --root .> <--root . --json>                  -> identical (exit 0)
```

So the JSON path is byte-identical across both orderings AND identical to the
unflagged `--json` run: the shared parser regressed nothing, and the ordering of
the two flags does not change the answer. The flag is never swallowed as the
root's value:

```
$ node scripts/check-guard-fates.mjs --root --json
exit=1
check-guard-fates: BAD ARGUMENTS -- `--root` requires a directory, but it was followed by "--json", which is itself a flag. Usage: node scripts/check-guard-fates.mjs [--root <dir>] [--json]
```

And the repeated flag names BOTH values rather than silently keeping one:

```
$ node scripts/check-guard-fates.mjs --root /a --root /b
exit=1
check-guard-fates: BAD ARGUMENTS -- `--root` was given more than once: "/a" and "/b". A repeated flag is rejected rather than resolved by position, so no invocation's meaning depends on which copy the parser happened to keep. Usage: node scripts/check-guard-fates.mjs [--root <dir>] [--json]
```

### Static assertions

```
$ grep -c 'function parseArgs' <the five files>
check-skill-tool-coverage.mjs:0   check-guard-fates.mjs:0   check-skill-cli-invocations.mjs:0
check-skill-description-overlap.mjs:0   check-skill-fork-honesty.mjs:0

$ grep -c parseRootArg <the five files>
check-skill-cli-invocations.mjs:3   check-skill-description-overlap.mjs:3   check-skill-fork-honesty.mjs:3
check-skill-tool-coverage.mjs:3     check-guard-fates.mjs:3
```

`grep -c parseRootArg` returns 3 for every file (import, call, comment), above
the required floor of 2. Zero local readers remain.

## Task 2 — The eighteen matrix cases, plus the read proof

`node --test src/mcp/vice/audit-root-args.test.ts`:

```
1..36
# tests 36
# pass 36
# fail 0
# skipped 0
# todo 0
# duration_ms 6434.694406
```

Exit 0. 36 = the 15 cases plan 32-10 left (9 unit + 6 spawned) + 21 new.

### The eighteen, one row per case — `gaps[1].missing[2]` stated verbatim

| # | Script | Case | Result |
|---|---|---|---|
| 1 | `generate-tool-support-table` | equals form → non-zero + `<script>: BAD ARGUMENTS --` | ok |
| 2 | `check-guard-fates` | equals form | ok |
| 3 | `check-skill-tool-coverage` | equals form | ok |
| 4 | `check-skill-fork-honesty` | equals form | ok |
| 5 | `check-skill-cli-invocations` | equals form | ok |
| 6 | `check-skill-description-overlap` | equals form | ok |
| 7 | `generate-tool-support-table` | out-of-repository root → exit 1 + `<script>: REFUSED --` | ok |
| 8 | `check-guard-fates` | out-of-repository root | ok |
| 9 | `check-skill-tool-coverage` | out-of-repository root | ok |
| 10 | `check-skill-fork-honesty` | out-of-repository root | ok |
| 11 | `check-skill-cli-invocations` | out-of-repository root | ok |
| 12 | `check-skill-description-overlap` | out-of-repository root | ok |
| 13 | `generate-tool-support-table` | contained root, none of its inputs → non-zero + diagnostic | ok (219 ms) |
| 14 | `check-skill-tool-coverage` | contained root, none of its inputs | ok (295 ms) |
| 15 | `check-skill-fork-honesty` | contained root, none of its inputs | ok (101 ms) |
| 16 | `check-skill-cli-invocations` | contained root, none of its inputs | ok (321 ms) |
| 17 | `check-guard-fates` | contained root == repository root → exit 0, normal report | ok (1619 ms) |
| 18 | `check-skill-description-overlap` | contained root == synthetic corpus → reads THAT tree | ok (52 ms) |

Three further cases sit beside the matrix: the from-disk completeness guard, the
process-level repeated-flag rule, and the process-level `--root --json` swallow
rejection.

Only three of the 36 cases run a script to completion, one per script and no
script twice (case 17, case 18, and plan 32-10's pre-existing generator run).
Everything else refuses before its script reads or writes anything.

### The completeness guard

`scriptsUsingTheSharedParser()` reads `scripts/*.mjs` from disk, keeps every
top-level file containing `parseRootArg(`, and asserts that set is **deep-equal**
to the hand-written `MATRIX`. It measures the tree rather than restating the
table, so a seventh root-accepting script added later fails this file by
omission. `scripts/lib/` is excluded — that is where the seam itself lives.

### The read proof — both outputs, quoted

The synthetic tree is built INSIDE the repository (`mkdtempSync` against
`.audit-root-synth-` at the repository root) because containment requires it. It
carries six synthetic skills with deliberately disjoint vocabulary and a
`CLAUDE.md` whose project-skills table matches them byte-for-byte.

**(a) Both halves synthetic — what the test asserts, and what a correct
single-root read produces:**

```
$ node scripts/check-skill-description-overlap.mjs --root <synthetic tree>
check-skill-description-overlap: OK -- 6 skills scanned (synth-alpha, synth-bravo, synth-charlie, synth-delta, synth-echo, synth-foxtrot); 15 pairs compared (n*(n-1)/2 for n=6); observed maximum score 0.000 from synth-alpha :: synth-bravo; threshold 0.35 (inclusive); allowlist size 0; CLAUDE.md project-skills table: 6 rows, all byte-identical to their SKILL.md.
exit=0
```

**(b) The SPLIT read — the same synthetic skills corpus, but `CLAUDE.md` taken
from the REAL repository (the defect shape this case exists to rule out):**

```
$ cp CLAUDE.md <synthetic tree>/CLAUDE.md
$ node scripts/check-skill-description-overlap.mjs --root <synthetic tree>
check-skill-description-overlap: FAIL
  - CLAUDE.md project-skills table disagrees with src/skills/ for "synth-alpha" (missing-from-copy):
      SKILL.md:  "Quintle vorbex ledgers for zephyr couriers."
      CLAUDE.md: ""
      A verbatim copy that drifts is a description a reader trusts and the dispatcher never sees. Update the table row to match the SKILL.md frontmatter byte-for-byte.
  - CLAUDE.md project-skills table disagrees with src/skills/ for "synth-bravo" (missing-from-copy):
      SKILL.md:  "Marrow flindle beacons for tarquin wardens."
      CLAUDE.md: ""
  ... (13 disagreements in total: 6 missing-from-copy + 7 unknown-skill-in-copy)
exit=1
```

For reference, the REAL repository's own answer, which the `--root` run must not
produce:

```
$ node scripts/check-skill-description-overlap.mjs
check-skill-description-overlap: OK -- 7 skills scanned (acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage); 21 pairs compared (n*(n-1)/2 for n=7); observed maximum score 0.250 from c64-program-recon :: c64-provenance-diff; threshold 0.35 (inclusive); allowlist size 0; CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md.
```

**What discriminates them, stated in the test's own comment:** exit 0 together
with `6 skills scanned` and `6 rows, all byte-identical to their SKILL.md` is
reachable ONLY when BOTH the skills corpus and `CLAUDE.md` come from the resolved
root. A split read fails outright (b), and a read of the real tree would say
`7 skills scanned` and name `acme-build` (c). The test asserts the positives AND
the negative (`!stdout.includes("acme-build")`), so a case that would pass under
both reads is impossible here. `[edge:CUT-04/adjacency]`'s accept side is case 17;
this is D-06's mechanism actually holding rather than being assumed.

### Fixture hygiene

`git status --porcelain`, captured immediately before and immediately after a
full run of the test file:

```
before:                                  after:
 M .gitignore                             M .gitignore
 M src/mcp/vice/audit-root-args.test.ts   M src/mcp/vice/audit-root-args.test.ts

$ diff <before> <after>   -> identical (exit 0)
$ ls -d .audit-root-synth-*  -> no such file or directory
```

Byte-identical, and no fixture directory survived. Removal happens in a `finally`
AND in a `t.after` hook; `.gitignore` carries `/.audit-root-synth-*/` with a
comment naming the reason (a leftover directory would dirty the tree, and a dirty
tree voids the mutation harness's evidence at
`scripts/audit-mutation-harness.mjs:654`). `grep -c 'audit-root-synth' .gitignore`
returns 1.

## Full verification run

| # | Command | Result |
|---|---|---|
| 1 | five bare runs, before vs after | all 0, all unchanged (table above) |
| 2 | `node --test src/mcp/vice/audit-root-args.test.ts` | 36 tests, 36 pass, 0 fail, exit 0 |
| 3 | `--json` alone and both orderings with `--root` | exit 0, byte-identical JSON in all three |
| 4 | `npm run typecheck` (in `src/mcp/vice`) | exit 0, no diagnostics |
| 5 | `npm run test:automated` (in `src/mcp/vice`) | 2986 tests, 2979 pass, **1 fail**, 1 skipped, 5 todo — see below |
| 6 | `node scripts/check-no-analyser.mjs` | exit 0, scanned 407 files, 0 temporarily allow-listed |
| 7 | `git status --porcelain` before/after the test run | byte-identical |

`grep -aic anno src/mcp/vice/audit-root-args.test.ts` returns **0** — the file is
inside the removal gate's scope and carries zero occurrences of the deleted
subject's literal name (checked with `grep -a`, per the NUL-byte hazard recorded
for `anno-memmap-render.ts`). `[edge:CUT-06/adjacency]` holds.

### The one `test:automated` failure is a worktree-location artifact

```
not ok 1513 - path agreement (D-3, D-6, THE regression this task exists to catch):
  the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
  supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

`src/mcp/vice/repo-root.test.ts:178` asserts the resolved supervisor directory is
NOT under `.claude`. That is true on the main checkout and **false by
construction** for any GSD worktree, which is created at
`<repo>/.claude/worktrees/agent-<id>`. It fails on a clean tree regardless of the
diff, it failed identically for plan 32-10 in wave 1, and this plan touches only
five `scripts/*.mjs`, one test file and `.gitignore` — `repo-root.test.ts` reads
none of them.

It was deliberately NOT "fixed". Editing a guard to be green under a condition it
correctly detects is the exact vacuity this phase exists to catch. **Expected on
the merged branch: 0 failures.** Recorded here rather than in
`deferred-items.md` because it is an execution-environment artifact, not a
repository defect.

Test count moved 2965 → 2986 (+21), matching the 21 new cases in this plan
exactly.

## TDD Gate Compliance

Task 2 carries `tdd="true"`, and the gate sequence is **not** the usual
RED-commit-then-GREEN-commit pair. It cannot be, because the plan itself
sequences the implementation into Task 1 and the tests into Task 2. Recorded
plainly rather than dressed up:

- **RED was measured, not skipped.** Before any edit, at `0aae79b`, all twenty
  malformed-form invocations exited **0** — precisely what the new assertions
  forbid. That baseline is the RED evidence and is quoted verbatim above,
  including the fate gate's full green report. Fifteen of the eighteen matrix
  cases would have failed against that tree.
- **GREEN is commit `691645e`** (`refactor(...)`), which is the implementation
  commit, and it precedes the test commit rather than following it.
- **No `feat(...)` commit exists on this branch**, because this plan adds no
  feature — it deletes five duplicated readers and points their callers at an
  existing one. `refactor` is the honest type for that, and choosing `feat` to
  satisfy a gate-sequence scan would be exactly the fact-laundering this phase's
  D-08 standard forbids.
- **No REFACTOR gate commit** was needed.

A strict per-task RED→GREEN commit pair was therefore not achievable under the
plan's own task ordering. This is stated as a compliance note, not claimed as
compliance.

## Deviations from Plan

**One, and it is the same provisioning step plan 32-10 recorded.**

**1. [Rule 3 — Blocking] `npm ci` run to provision `src/mcp/vice/node_modules`**
- **Found during:** Task 1, before the first typecheck.
- **Issue:** git worktrees do not carry gitignored paths, so the worktree had no
  `node_modules`. `typecheck` and `test:automated` cannot run without it.
- **Fix:** `npm ci` in `src/mcp/vice`, from the **committed lockfile**. This is
  the repository's own documented provisioning step (`scripts/ensure-mcp-deps.sh`
  runs exactly this on `SessionStart`).
- **Why this is not the excluded case:** the package-manager exclusion exists to
  stop an agent installing a *named* package that may be slopsquatted or
  hallucinated. `npm ci` adds no dependency, resolves nothing by name, and cannot
  deviate from `package-lock.json`. No manifest and no lockfile was modified.
- **Files modified:** none (`node_modules/` is gitignored).

**One deliberate narrowing of the plan's letter, recorded rather than absorbed.**

**2. The two `--json` ordering ACCEPT cases were not added to the test file.**
The plan's Task 1 acceptance criteria require `--json --root .` and
`--root . --json` to both exit 0 and emit JSON; Task 2's action D forbids adding
a second full run of any script. Each of those orderings IS a full run of the
fate guard, and the file already runs it once (case 17). They are therefore
asserted against the real parser at unit level (plan 32-10's boolean-flag test,
both orderings) and measured end to end above, with the JSON proved
byte-identical across all three invocations. The test file keeps only the fast
`--root --json` swallow rejection. Nothing was weakened: the accept side is
measured, just not re-spawned.

**No other deviations.** No relaxation hatch of any kind was added — no env var,
no `--force`/`--skip`, no waiver file, no allow-list. No evidence record,
`*-SUMMARY.md` or `32-VERIFICATION.md` was edited to make anything green.

## Known Stubs

None. All five scripts are fully wired, all eighteen matrix cases assert against
real spawned processes, and the synthetic-corpus case asserts an output the real
repository provably does not produce.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema at a
trust boundary.

`T-32-05` (spoofing: the blocking CI gate vouching for a tree it was told not to
read) is **mitigated** and the mitigation is measured: all three malformed forms
went from a green exit 0 to a named exit 1.

`T-32-06` (a crashed test leaving a fixture behind and voiding the mutation
harness's evidence) is **mitigated** three ways: removal in a `finally`, removal
in a `t.after`, and a `.gitignore` entry. Verified — `git status --porcelain` was
byte-identical across a full run and no `.audit-root-synth-*` directory survived.

`T-32-02` (lexical containment vs. symlinks, `WR-04`) remains `accept`ed and OPEN
in the existing findings todo, unchanged.

`T-32-SC` (package-manager installs): the only package-manager command run was
`npm ci` from the committed lockfile, which resolves nothing by name. No
package-legitimacy checkpoint is owed.

## Scope Fence — Honoured

Untouched, as the plan records: `scripts/audit-gate.mjs` (`WR-13`),
`scripts/audit-mutation-harness.mjs` (the model that was not reused, which
already rejects unknown arguments correctly), `WR-06`, `WR-12`, `WR-14`, and
broken windows #28–#32. The static imports at the top of three skill gates — the
split-read defect — were deliberately left for plan 32-12, so an argument
regression and a split-read regression can never be confused for one another.
Nothing was added that traces to neither a verifier truth nor a `gaps[].missing`
line.

## Commits

| Task | Commit | Type | Message |
|---|---|---|---|
| 1 | `691645e` | `refactor` | delete five local argv readers, wire all five to the shared strict parser |
| 2 | `06b9705` | `test` | the six-script `--root` matrix, plus proof a contained root redirects a gate's reads |

`git diff --diff-filter=D --name-only 0aae79b HEAD` is **empty** — this branch
deletes no file (the five readers are deleted as LINES inside modified files), so
the wave-cleanup step will merge it normally, exactly as the plan's
`net_deletion: false` claims.

## Notes on `actuals`

`tokens: 43600` is `chars/4` over the seven files actually changed
(`174283` chars, measured with `cat ... | wc -c`). The realized diff alone is
`34935` chars ≈ `8700` tokens (`git diff 0aae79b HEAD | wc -c`). Both figures are
given because the two methods differ by 5×, and reporting only the flattering one
would corrupt every later projection. Against the plan's `estimate: 82000`
(confidence `low`), the whole-file method lands at ~53% of estimate and the
diff-only method at ~11%.

## Self-Check: PASSED

- `scripts/check-guard-fates.mjs` — FOUND (974 lines, 0 local `parseArgs`, 3 `parseRootArg`)
- `scripts/check-skill-tool-coverage.mjs` — FOUND (681 lines, 0 / 3)
- `scripts/check-skill-fork-honesty.mjs` — FOUND (700 lines, 0 / 3)
- `scripts/check-skill-cli-invocations.mjs` — FOUND (270 lines, 0 / 3)
- `scripts/check-skill-description-overlap.mjs` — FOUND (324 lines, 0 / 3)
- `src/mcp/vice/audit-root-args.test.ts` — FOUND (553 lines, exceeds the plan's `min_lines: 200`)
- `.gitignore` — FOUND (`grep -c 'audit-root-synth'` returns 1)
- Commit `691645e` — FOUND in `git log`
- Commit `06b9705` — FOUND in `git log`
- All plan-level `<verification>` steps 1–7 run and recorded above.
