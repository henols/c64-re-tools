---
phase: 32-the-deletion-and-the-grep-gate
plan: 13
subsystem: planning-evidence
tags: [audit, gap-closure, d-09, guard-fates, documentation]
status: complete

requires:
  - ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json (61 rows, read-only)"
  - ".planning/phases/32-the-deletion-and-the-grep-gate/32-VERIFICATION.md (Gap 1, read-only)"
  - "src/mcp/vice/docs-linerefs.test.ts (in-band discharge, read-only)"
  - "scripts/check-guard-fates.mjs:672 (stranger-row rule, read-only)"
provides:
  - "evidence/32-audited-set-reconciliation.md §6.1 — all eleven CUT-04 names adjudicated"
  - ".planning/REQUIREMENTS.md — dated Gap-1 non-demotion note beside CUT-04"
affects:
  - "Phase 32 re-verification: Gap 1 (verifier truth 1) now has a committed record"

tech-stack:
  added: []
  patterns:
    - "Name resolution by basename EQUALITY against the registry's historicalPath set, never substring containment"
    - "Every figure accompanied by the command that produced it, re-run rather than transcribed"
    - "Pure-insertion editing of dated records (0 deletions asserted by numstat)"

key-files:
  created: []
  modified:
    - ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-audited-set-reconciliation.md (+323/-0)"
    - ".planning/REQUIREMENTS.md (+2/-0)"

decisions:
  - "Took the verifier's FIRST remedy (adjudication paragraph) over the second (a manual registry row), after re-measuring that check-guard-fates.mjs:672's stranger-row rule would reject the row and red the blocking CI gate"
  - "Resolved CUT-04's bare stems against guard-fates.json's historicalPath basenames rather than §1.3's git ls-files rule, after measuring that §1.3's rule returns 0 paths for a bare stem"
  - "Chose basename equality over substring containment after measuring that containment makes tool-support-table claim generate-tool-support-table.mjs's row"
  - "Recorded the plan's ':361-383 / three planted-violation tests' citation as a MEASURED CORRECTION rather than transcribing it — six such tests exist and the range spans two"

metrics:
  duration: "~25 min"
  completed: 2026-09-01

actuals:
  tokens: 5621
  tasks: 2
  commits: 2
---

# Phase 32 Plan 13: CUT-04's Named List, Adjudicated — Summary

Closed Gap 1 by writing the record that was missing: all eleven guards `CUT-04` names by
name now carry a measured verdict, and `docs-linerefs` — the one it names first and the one
with no registry row — has a written exclusion stating what was measured, why the mechanical
predicate cannot reach it, and where its non-vacuity was discharged instead.

## What Was Done

### Task 1 — §6.1 in the reconciliation (commit `27b695d`, +323/-0)

Added `## 6.1 CUT-04's NAMED list, adjudicated name by name` immediately before §7, as a
**pure insertion**. Five sub-sections: why it exists, the mechanical name extraction, the
resolution rule and why it differs from §1.3's, the eleven verdicts, the `docs-linerefs`
paragraph, and the measured closing arithmetic.

### Task 2 — the non-demotion note (commit `b08bdbc`, +2/-0)

Inserted a dated Gap-1 closure note after `CUT-04`'s "Why this requirement STAYED in
Phase 32" sub-bullet, recording the finding, the decision (verifier's recommendation quoted
verbatim, including "a paragraph, not code"), where the closure lives, and what was
deliberately not done.

## The Eleven Names and the Command That Extracted Them

```bash
sed -n '141p' .planning/REQUIREMENTS.md \
  | sed 's/.*Named explicitly: //' \
  | sed 's/([^)]*)//g' \
  | grep -ao '`[^`]*`' | tr -d '`'
```

The parenthetical-strip step was added **after measurement**: without it the same extraction
returns **13** tokens, four of which (`CLAUDE.md`, `docs-absorbed-decisions`,
`scripts/audit-gate.mjs`, `D-12`) are asides rather than list members. Re-verified after
Task 2's edit that the `:141` anchor still yields the same eleven.

| # | Name | Resolved path | Verdict |
|---|---|---|---|
| 1 | `docs-linerefs` | `src/mcp/vice/docs-linerefs.test.ts` *(no registry row)* | **EXCLUDED** |
| 2 | `docs-dangling-refs` | `src/mcp/vice/docs-dangling-refs.test.ts` | CITED — `re-pointed` |
| 3 | `docs-r2000-decisions` | `src/mcp/vice/docs-r2000-decisions.test.ts` @ `0394cbc` | CITED — `re-pointed` |
| 4 | `hostpath-consumers` | `src/mcp/vice/hostpath-consumers.test.ts` | CITED — `re-pointed` |
| 5 | `stock-dispatch` | `src/mcp/vice/stock-dispatch.test.ts` | CITED — `re-pointed` |
| 6 | `vice-proxy` | `src/mcp/vice/vice-proxy.test.ts` | CITED — `re-pointed` |
| 7 | `capability-registry` | `src/mcp/vice/capability-registry.test.ts` | CITED — `re-pointed` |
| 8 | `skill-attribution` | `src/mcp/vice/skill-attribution.test.ts` | CITED — **`kept-unchanged`** |
| 9 | `tool-support-table` | `src/mcp/vice/tool-support-table.test.mjs` | CITED — `re-pointed` |
| 10 | `check-skill-tool-coverage.mjs` | `scripts/check-skill-tool-coverage.mjs` | CITED — `re-pointed` |
| 11 | `generate-tool-support-table.mjs` | `scripts/generate-tool-support-table.mjs` | CITED — `re-pointed` |

**Measured distribution: 10 CITED, 1 EXCLUDED, 0 AMBIGUOUS.** Rows 9 and 11 resolved to two
**distinct** rows as the plan warned they might, and are cited separately.

## Findings

### 1. Substring containment would have collapsed two audited guards into one

Measured by swapping the predicate for `historicalPath.includes(name)` and re-running:

```
tool-support-table   2   scripts/generate-tool-support-table.mjs | src/mcp/vice/tool-support-table.test.mjs
```

Under containment `tool-support-table` claims row 11 as well as its own — one name eating
another name's row, leaving a different named guard unaudited while appearing to resolve.
Basename equality returns one row each. This is recorded in §6.1.2 as the reason the rule is
stated in the form it is.

### 2. §1.3's set-C rule is unusable for bare stems — measured, not assumed

```bash
$ git ls-files | awk -v t='docs-linerefs' '$0==t || $0 ~ ("/" t "$")' | wc -l
0
```

Most of the eleven are bare stems, not filenames, so the document states a different rule
and records this measurement as the reason.

### 3. MEASURED CORRECTION — the plan's (and the verifier's) planted-violation citation does not reproduce

Plan 32-13 directed the `docs-linerefs` paragraph to cite "its **three** planted-violation
tests at `:361-383`"; `32-VERIFICATION.md:328` likewise says "3 planted-violation tests".
Re-measured before writing:

```bash
$ grep -ac '^test("planted-violation' src/mcp/vice/docs-linerefs.test.ts
6
```

There are **six**, at `:272`, `:339`, `:361`, `:376`, `:389`, `:405`. The range `:361-383`
spans **two** of them — `:361-374` whole, and `:376-387` cut at its eighth line. The five
that plan 32-04 landed and enumerates in `32-04-SUMMARY.md` are `:339`, `:361`, `:376`,
`:389`, `:405`; the sixth at `:272` predates that widening. §6.1.4 records the measured
inventory and states the correction explicitly rather than quietly adjusting it — a line
citation written from expectation is exactly the defect `docs-linerefs.test.ts` exists to
catch, and writing one into the paragraph adjudicating that guard would be self-refuting.

**No `guard-fates.json` row, floor or figure changed as a result.** This is a citation
correction inside new prose, not a re-derivation.

## Measurements Recorded

**`docs-linerefs` occurrence counts (the exclusion's basis):**

```bash
$ git show 0394cbc:src/mcp/vice/docs-linerefs.test.ts | grep -aic r2000
0
$ git show 345d5c4:src/mcp/vice/docs-linerefs.test.ts | grep -aic r2000
0
$ git diff --name-only --diff-filter=A 0394cbc 345d5c4 | grep -x 'src/mcp/vice/docs-linerefs.test.ts'
$ echo $?   # -> 1 (no output; not added between the pins)
```

`grep -a` used throughout and stated in the document, per the NUL-byte hazard that has
already produced one false decision in this project.

**Stranger-row rule, re-measured (rules out the registry-row remedy):**

```bash
$ grep -an 'stranger row' scripts/check-guard-fates.mjs
672:      `stranger row: ${REGISTRY_REL_PATH} names \`${key}\`, which is NOT in the derived audited ` +
```

Still at `:672`, still saying *"This direction is what stops the registry drifting into a
hand-typed second list of members."*

**In-band discharge, line numbers re-measured rather than transcribed:**

- `SCANNED_DOCS` widening onto `.planning/PROJECT.md` — `:64-67`
- per-document floor expression — `:192`; its "This floor is per document." message — `:196`
- globally-summed-floor plant — `:361-374`; one-citation floor plant — `:376-387`

**Fate gate, before and after, same working tree:**

| | exit | measured line |
|---|---|---|
| before Task 1 | 0 | `set C parsed from .planning/ROADMAP.md line 830` |
| after Task 1 | 0 | `set C parsed from .planning/ROADMAP.md line 830` |
| after Task 2 | 0 | unchanged |

Full line both times: `check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61
(floors setA=43 setB=16 setC=2 total=61)`. The `line 830` reading differs from the `814`
recorded in §1.3 and in `32-VERIFICATION.md`; those are dated records of what the gate
printed when each was written and were **deliberately not edited** to agree. `ROADMAP.md`
has grown since.

**Diff shapes — both pure insertions:**

```
git diff --numstat HEAD~2 HEAD
2       0       .planning/REQUIREMENTS.md
323     0       .planning/phases/.../evidence/32-audited-set-reconciliation.md
```

**Deletion counts: 0 and 0.** `git diff --name-only HEAD~2 HEAD` lists exactly these two
files — no `*-SUMMARY.md`, no `32-VERIFICATION.md`, no other `evidence/*.md`.

## Verification Results

| Check | Result |
|---|---|
| `git diff --numstat` deletions, both files | **0** and **0** |
| `grep -c 'docs-linerefs'` on the reconciliation | **17** (baseline 0; floor ≥ 6) |
| Adjudication rows in §6.1.3 | **11** — one per name, none doubled, none sharing a citation |
| Verdicts in those rows | 10 CITED / 1 EXCLUDED / 0 AMBIGUOUS |
| Documented rule re-run verbatim by hand | reproduces all **11** resolutions |
| `git show 0394cbc:… \| grep -aic r2000` re-run | **0**, matches the written figure |
| `node scripts/check-guard-fates.mjs` | exit **0**, same measured line before and after |
| `node scripts/check-no-regenerator2000.mjs` | exit **0** |
| Nine `docs-*.test.ts` guards, run individually | all exit **0** (5/6/8/6/6/12/7/8/5 passing) |
| `grep -c '\- \[x\] \*\*CUT-04\*\*'` | **1** — checkbox unchanged |
| `grep -c '\| CUT-04 \| Phase 32 \| Complete \|'` | **1** — row unmoved |
| `grep -c '\| CUT-06 \| Phase 32 \| Complete \|'` | **1** — row unmoved |
| `git status --porcelain` after each task | only the intended file |

## Prose Safety Re-read (Task 1 step F)

**Confirmed: the finished section was re-read against the "does it route a reader at
something deleted" test before committing.** Every occurrence of the deleted subject's short
form inside §6.1 sits in one of exactly two permitted places — a quoted measurement command
(`grep -aic r2000`) or a dated historical path (`docs-r2000-decisions.test.ts` at
`0394cbc`, explicitly annotated with its rename to `docs-absorbed-decisions.test.ts` by plan
29-05). The document never, in its own voice, tells a reader to use, install or invoke
anything that no longer exists. `node scripts/check-no-regenerator2000.mjs` exits 0 with the
temporary allow-list still empty, which is the mechanical confirmation.

## Deviations from Plan

**1. [Rule 1 — measured correction] The plan's planted-violation citation did not reproduce**

- **Found during:** Task 1, section D step 5
- **Issue:** the plan directed a citation to "three planted-violation tests at `:361-383`";
  measurement returned six such tests, with `:361-383` spanning two of them
- **Fix:** wrote the measured inventory and recorded the discrepancy as an explicit
  MEASURED CORRECTION block in §6.1.4, per the plan's own instruction to re-measure line
  numbers before writing them and its standing rule that a result differing from the plan's
  expectation is a finding to record, never a number to reconcile
- **Files modified:** `evidence/32-audited-set-reconciliation.md`
- **Commit:** `27b695d`

**2. [Rule 1 — measured refinement] The plan's `:196` floor citation lands on the message, not the expression**

- **Found during:** Task 1, section D step 5
- **Issue:** the plan cites the per-document floor at `docs-linerefs.test.ts:196`; `:196` is
  the message line, the floor expression `citations.length >= 2` is at `:192`
- **Fix:** cited both, each with its measured line number and the `grep -an` that produced it
- **Commit:** `27b695d`

No architectural deviations. No auth gates. No package installs. Nothing was deferred.

## Scope Fence Honoured

No code written, no script touched, no test changed. `guard-fates.json` untouched. Set A,
set B and set C not re-derived. `CUT-06` not re-opened. `32-VERIFICATION.md`, every
`*-SUMMARY.md` and every other `evidence/*.md` left byte-identical. In worktree mode
`STATE.md` and `ROADMAP.md` were not touched — the orchestrator owns those.

## Known Stubs

None. Both deliverables are complete prose backed by re-run commands.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no
schema change. `T-32-09` (record tampering) was mitigated structurally by the asserted
zero-deletion insertions; `T-32-10` (NUL-byte grep) by `grep -a` throughout, stated in the
document; `T-32-11` (redding the CI gate) by taking the adjudication remedy and re-measuring
the stranger-row rule that rules out the alternative.
