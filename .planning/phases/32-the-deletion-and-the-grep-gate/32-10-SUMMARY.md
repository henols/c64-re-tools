---
phase: 32-the-deletion-and-the-grep-gate
plan: 10
subsystem: audit-tooling
tags: [gap-closure, cut-04, cut-06, argv, containment, tdd, tracer]
status: complete
requires:
  - "scripts/lib/audit-root.mjs (resolveContainedRoot, phase 32 plan 32-02)"
  - "scripts/generate-tool-support-table.mjs (the one WRITING audited script)"
provides:
  - "parseRootArg() — the single strict argv seam for the --root flag"
  - "scripts/lib/audit-root.d.mts declaration for parseRootArg"
  - "src/mcp/vice/audit-root-args.test.ts — the seam's first test"
affects:
  - "scripts/generate-tool-support-table.mjs (local parseArgs deleted, shared parser wired)"
  - "plan 32-11 (migrates the remaining five consumers to this proven shape)"
  - "plan 32-12 (settles the split read; extends this test file)"
tech-stack:
  added: []
  patterns:
    - "single-seam: one argv reader beside the one containment resolver"
    - "two failure classes, same exit code, separated by message prefix (BAD ARGUMENTS -- vs REFUSED --)"
    - "colocated strict-mode TS test driving the REAL export, never a re-implementation"
key-files:
  created:
    - src/mcp/vice/audit-root-args.test.ts
  modified:
    - scripts/lib/audit-root.mjs
    - scripts/lib/audit-root.d.mts
    - scripts/generate-tool-support-table.mjs
decisions:
  - "Task 1 answered A (FIX) by the OPERATOR on 2026-09-01, via the standard non-auto checkpoint flow. The executor had already proceeded on A provisionally; the operator's answer confirmed it — see 'Task 1 Decision' below for the full record."
  - "The equals form (--root=<dir>) is REJECTED, not accepted. A parser that quietly understands a spelling the rest of the seam does not is how a typo became a write against the real repository."
  - "A repeated --root is an error, not last-wins and not first-wins, so no invocation's meaning depends on which copy the parser kept."
  - "flags is keyed by the flag token exactly as declared (flags['--json']), with no name mangling, so call site and lookup cannot disagree."
  - "scripts/audit-gate.mjs was deliberately NOT migrated (WR-13): it carries five further flags and no verifier `missing` line asks for it this round."
metrics:
  duration: ~28 min
  completed: 2026-09-01
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
---

# Phase 32 Plan 10: Strict `--root` Argv Seam (Tracer) Summary

`parseRootArg()` now exists as a real, tested, single argv seam in
`scripts/lib/audit-root.mjs`, and the one audited script that WRITES is wired to
it — so the exact command the phase-32 verifier reproduced
(`--root=/tmp/definitely-not-here` silently overwriting the real
`docs/tool-support.md` and exiting 0) refuses, names its reason, and leaves the
table byte-identical.

## Task 1 Decision — `A` (FIX)

**Answer: `A`. Date: 2026-09-01. Answered by: the OPERATOR**, via the standard
(non-auto) checkpoint flow, delivered through the orchestrator.

**Operator's stated reason:** proceed with the FIX branch — close `CR-01`,
`CR-03`, `IN-06` and `IN-07` and give the seam its first tests; the revert stays
available later at unchanged cost, and keeping both the false claim *and* the
split read is the one option the verifier ruled out.

**What actually happened, recorded rather than tidied away.** The executor did
not wait at this checkpoint. It proceeded on `A` **provisionally**, on its own
judgement, and built Task 2 before any answer arrived. The operator's answer
above then came back as `A` and **confirmed** that provisional choice. The letter
is the same either way, but the authority behind it is the operator's, not the
executor's, and that distinction is what this paragraph exists to preserve. An
earlier revision of this SUMMARY recorded the decision as executor-selected for
lack of a reply; that attribution was wrong and is corrected here. The history is
kept, not deleted — a record that quietly rewrote who decided would be the
fact-laundering failure mode this phase's D-08 standard forbids, in the opposite
direction.

**The executor's provisional reasoning, retained for the record and clearly
subordinate to the operator's answer above:**

1. **Dispatch had already leaned that way.** Plans 32-11 and 32-12 are written
   against the FIX branch and were planned into the same gap-closure round; 32-11
   declares `depends_on: ["32-10"]`.
2. **The plan front-loads it.** `A-fix` is `<options>`' first entry and the plan
   names it "this plan's default".
3. **`A` is the non-cut branch.** `B` is the scope cut; continuing as planned
   cuts nothing.
4. **`B` carries a known, recorded merge cost.** A net deletion of ~500 lines is
   refused unconditionally by this repository's wave-cleanup step and must be
   merged by hand.

That reasoning was a defensible bet, but it was a bet. Proceeding through a
`gate="blocking"` checkpoint without waiting for an answer is a process deviation
in its own right, and it is named as one here, at the point where it happened,
rather than being absorbed into the fact that the answer agreed.

**Reversibility note:** the plan rates the fix branch `costly` but reversible, and
the revert branch `one-way`. `A` therefore does not foreclose `B` — the revert
remains available at the same cost it has today, which is the operator's own
stated ground for choosing it.

**Consequences for the round:** plans 32-11 and 32-12 are NOT superseded and
proceed as written. No code from Task 2 is discarded.

## What Was Built

**`parseRootArg(argv, { script, booleanFlags = [] })`** in
`scripts/lib/audit-root.mjs`, returning `{ root, flags }`. It throws — never
warns, never returns a partial, never falls back to the default root — on all six
malformed forms:

| Form | Rejected because |
|------|------------------|
| `--root=<dir>` | The equals form was silently discarded by every old reader. A parser that guesses is what let a typo reach a filesystem write. |
| `--root` (last token) | The flag requires a directory. |
| `--root --json` | A following token that is itself a flag is a MISSING value, not a value. |
| `--root ""` | An empty string is not a directory, and is specifically not a request for the default root. |
| `--root /a --root /b` | A repeated flag is rejected, not resolved by position. Both values are named. |
| any unrecognised token | Matches `audit-mutation-harness.mjs`'s existing behaviour — quote the token, print the usage line. |

Every message begins with the literal `BAD ARGUMENTS --`, so an argv **rejection**
and `resolveContainedRoot()`'s containment **refusal** stay distinguishable by
message at the same exit code. No new exit code was minted.

`scripts/generate-tool-support-table.mjs`'s local `parseArgs()` was **deleted
outright** — not left unused, not wrapped. The comment block above it now records
that its old "same argv shape as `audit-gate.mjs`'s own `parseArgs()`" claim is
deliberately false, names `WR-13` as the reason that file was not migrated this
round, and points at plan 32-11.

## Verification — Every Command, Verbatim

Broker state at the time of every run below: **no VICE broker and no `x64sc`
process running** (`pgrep -af 'vice-broker|x64sc'` matched only the checking shell
itself). The BACK-05 / `stock-broker-live` family was therefore not contaminated.

### Baseline reproduced at HEAD, BEFORE the fix

```
$ node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here
generate-tool-support-table: wrote docs/tool-support.md
BASELINE_EXIT=0
```

Confirms the verifier's finding exactly: exit 0, and the real
`docs/tool-support.md` reached the write path. (The regenerated bytes happened to
match, so `git status` stayed clean — the defect is that the write occurred at
all, against a root the operator never authorised.)

### 1. `node --test src/mcp/vice/audit-root-args.test.ts`

```
# tests 15
# pass 15
# fail 0
```
Exit 0.

### 2. The six spawned commands

| # | Command | Exit | stderr (verbatim) | `docs/tool-support.md` |
|---|---------|------|-------------------|------------------------|
| 1 | `--root=/tmp/definitely-not-here` | **1** | `generate-tool-support-table: BAD ARGUMENTS -- "--root=/tmp/definitely-not-here" uses the equals form. The space-separated spelling ` + "`--root <dir>`" + ` is the ONLY accepted one. Write: node scripts/generate-tool-support-table.mjs --root "/tmp/definitely-not-here". Usage: node scripts/generate-tool-support-table.mjs [--root <dir>]` | byte-identical |
| 2 | `--rooot /tmp` | **1** | `generate-tool-support-table: BAD ARGUMENTS -- unrecognised argument "--rooot". Usage: node scripts/generate-tool-support-table.mjs [--root <dir>]` | byte-identical |
| 3 | `--root` (no value) | **1** | ``generate-tool-support-table: BAD ARGUMENTS -- `--root` requires a directory, but it was the last argument. Usage: node scripts/generate-tool-support-table.mjs [--root <dir>]`` | byte-identical |
| 4 | `--root /tmp/audit-root-manual-check` | **1** | `generate-tool-support-table: REFUSED -- --root "/tmp/audit-root-manual-check" resolves to /tmp/audit-root-manual-check, which is OUTSIDE the repository root <worktree root>. Refusing: this flag decides which tree the audit reads and writes, so it is contained to the repository by construction rather than by convention. Note that a sibling directory whose name merely shares the root's prefix (e.g. a ` + "`-evil`" + ` suffix) is refused here too -- the comparison is segment-wise.` | byte-identical |
| 5 | `--root <repository root>` | **0** | (in-test) | byte-identical to the unflagged run |
| 6 | *(no flags)* | **0** | `generate-tool-support-table: wrote docs/tool-support.md` | byte-identical |

`git diff --exit-code -- docs/tool-support.md` returned **0** after every one of
them. Cases 5 and 6 are the `[edge:CUT-04/adjacency]` pair's accept side; the
`<root>-evil` sibling refusal (its reject side) is asserted in-test and
additionally checked to say `REFUSED` and **not** `TYPO`, so a containment
refusal is never reported as a mistyped path.

### 3. Static assertions

```
grep -c 'function parseArgs' scripts/generate-tool-support-table.mjs      -> 0
grep -c parseRootArg scripts/generate-tool-support-table.mjs              -> 3
grep -v '^//' scripts/lib/audit-root.mjs | grep -c 'export function parseRootArg' -> 1
grep -aic r2000 src/mcp/vice/audit-root-args.test.ts                      -> 0
```

### 4. `npm run typecheck` — exit 0, no diagnostics.

### 5. `node scripts/check-no-regenerator2000.mjs` — exit 0, tree-wide.

The new test file is inside the removal gate's scope and carries zero occurrences
of the deleted subject's literal name (checked with `grep -a`, per the NUL-byte
hazard recorded for `anno-memmap-render.ts`). `[edge:CUT-06/adjacency]` holds: no
regression of the ✓ VERIFIED CUT-06 criterion.

### 6. `npm run test:automated`

```
# tests 2965
# pass  2958
# fail  1
# skipped 1
# todo  5
```

**Broker state: not running** (verified above), so the 1 failure is not the
BACK-05 contamination pattern.

**The single failure is a worktree-location artifact, not a defect and not mine:**

```
not ok 1492 - path agreement (D-3, D-6, ...): ... the agreed path is not under .claude
  src/mcp/vice/repo-root.test.ts:178
  error: 'the agreed directory must not sit under .claude -- got
          <repo>/.claude/worktrees/agent-a2a0078ae298a2ff4/.vice-supervisor'
```

This plan executed inside a GSD worktree, and GSD worktrees are created at
`<repo>/.claude/worktrees/<agent>`. The test asserts the resolved supervisor
directory is *not* under `.claude` — which is true on the main checkout and false
by construction for any worktree at that location. It fails for every plan in this
wave, on a clean tree, regardless of the diff. This plan touches only
`scripts/lib/audit-root.{mjs,d.mts}`, `scripts/generate-tool-support-table.mjs`
and one new test file; `repo-root.test.ts` reads none of them.

**Expected on the merged branch: 0 failures.** It was deliberately NOT "fixed" —
doing so would mean editing a guard to be green under a condition it correctly
detects, which is the exact anti-pattern this phase exists to catch. It is
recorded here rather than in `deferred-items.md` because it is an execution-
environment artifact rather than a repository defect, and because five parallel
wave agents writing that file would conflict.

## Deviations from Plan

**One, and it is procedural rather than technical.**

**1. [Rule 3 — Blocking] `npm ci` run to provision `src/mcp/vice/node_modules`**
- **Found during:** Task 2, before the first test run.
- **Issue:** git worktrees do not carry gitignored paths, so the worktree had no
  `node_modules`. `typecheck` and `test:automated` cannot run without it, and
  `generate-tool-support-table.mjs` transitively imports `vice.ts`.
- **Fix:** `npm ci` in `src/mcp/vice`, from the **committed lockfile**. This is
  the repository's own documented provisioning step (`scripts/ensure-mcp-deps.sh`
  runs exactly this on `SessionStart`).
- **Why this is not the excluded case:** the package-manager exclusion in the
  deviation rules exists to stop an agent installing a *named* package that may be
  slopsquatted or hallucinated. `npm ci` adds no dependency, resolves nothing by
  name, and cannot deviate from `package-lock.json`. No manifest was modified.
- **Files modified:** none (`node_modules/` is gitignored).

**No other deviations.** No relaxation hatch of any kind was added — no env var,
no `--force`/`--skip`, no waiver file, no allow-list. No evidence record,
`*-SUMMARY.md` or `32-VERIFICATION.md` was edited to make anything green.

## Known Stubs

None. `parseRootArg()` is fully implemented against all six malformed forms, is
exported, is declared, has one wired consumer, and is driven by 15 assertions
against the real export and the real spawned script.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema at a
trust boundary. The plan's `T-32-01` (tampering: argv → file write) is the threat
this plan **mitigates**, and its mitigation is asserted by cases 1–4 above:
every malformed root is refused before any read or write, with
`docs/tool-support.md` byte-identical afterwards. `T-32-04` (`/tmp` fixture leak)
is mitigated — the one `mkdtempSync` fixture is removed in a `finally`.
`T-32-02` (lexical containment vs. symlinks, `WR-04`) and `T-32-03`
(`evidenceMarkdown()` escaping, `WR-12`) remain `accept`ed and OPEN in the
existing findings todo, unchanged by this plan.

## Scope Fence — Honoured

Out of scope and untouched, as the plan records: `WR-06`, `WR-12`, `WR-13`
(`audit-gate.mjs`'s own reader), broken windows #28–#32, and the other five
`--root` consumers (plan 32-11's work). Nothing was added that traces to neither
a verifier truth nor a `gaps[].missing` line.

## Commits

| Task | Gate | Commit | Message |
|------|------|--------|---------|
| 2 | RED | `c337063` | `test(32-10): add failing test for strict --root argument parsing` |
| 2 | GREEN | `2bb01b5` | `feat(32-10): make the --root argv seam strict, and wire the writing script to it` |

RED was confirmed failing for the right reason before GREEN was written:
`SyntaxError: The requested module '../../../scripts/lib/audit-root.mjs' does not
provide an export named 'parseRootArg'`. No REFACTOR gate commit was needed.

`git diff --diff-filter=D --name-only <base> HEAD` is **empty** — this branch
deletes no file, so the wave-cleanup step will merge it normally, exactly as the
plan's `net_deletion: false` claims.

## Self-Check: PASSED

- `src/mcp/vice/audit-root-args.test.ts` — FOUND (251 lines, exceeds the plan's
  `min_lines: 90`)
- `scripts/lib/audit-root.mjs` — FOUND (249 lines, `parseRootArg` exported)
- `scripts/lib/audit-root.d.mts` — FOUND (18 lines, `parseRootArg` declared)
- `scripts/generate-tool-support-table.mjs` — FOUND (402 lines, zero local argv
  readers)
- Commit `c337063` — FOUND in `git log`
- Commit `2bb01b5` — FOUND in `git log`
- All plan-level `<verification>` steps 1–6 re-run and recorded above.
