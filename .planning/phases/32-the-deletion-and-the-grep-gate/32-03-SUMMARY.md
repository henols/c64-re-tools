---
phase: 32-the-deletion-and-the-grep-gate
plan: 03
subsystem: docs
tags: [planning-documents, ci-guard, line-citations, dated-records, drift]

requires:
  - phase: 32-01
    provides: "the audited-set reconciliation (43/16/2 = 61), the `grep -a` NUL-byte trap finding, and the recorded worktree test artifact"
  - phase: 29-the-mcp-surface
    provides: "the deletion itself (plan 29-10, commit 1d40ad0) and the -2 line shift its removals caused in vice-proxy.ts"
provides:
  - "`.planning/PROJECT.md:311` — four re-verified `vice-proxy.ts` line citations and the surviving `anno_*` tool family, matching CLAUDE.md:26"
  - "`.planning/PROJECT.md:396` — the D-36 row's guard pointer now names a file that exists on disk"
  - "`.planning/ARCHITECTURE.md` Rule A21 — a dated, superseded record with its number, all five citations and its reversal condition intact"
  - "`scripts/check-no-analyser.mjs` — rule 4's NUL offset and tree-wide totals re-measured, dated, scope-defined, with a drift clause"
  - "An explicit correct-or-keep verdict for every one of the 17 `anno_`-carrying lines in `.planning/PROJECT.md`, with the D-08 clause that decided each"
affects: [32-04, 32-05, 32-08]

actuals:
  tokens: 51328
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Superseded-rule conversion in ARCHITECTURE.md: keep the heading and number, mark superseded with a date and the removing phase, restate the body in past tense with every citation intact, name what replaced it, state a reversal condition"
    - "Numeric-citation drift clause in a CI guard's own header: state the measurement date AND the scope definition beside the figure, and say that a mismatch is drift to re-verify rather than a changed rule"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/32-03-SUMMARY.md
  modified:
    - .planning/PROJECT.md
    - .planning/ARCHITECTURE.md
    - scripts/check-no-analyser.mjs

key-decisions:
  - "Chose option (a) for the removal gate's tree-wide totals — re-measure in the gate's OWN scope and state that scope — rather than option (b) attributing the stale pair to plan 29-02. The gate prints its own scope and its own totals on every successful run, so a figure taken from that line is self-refreshing evidence, whereas an attributed stale pair would have to be re-read against a tree it no longer describes."
  - "Left PROJECT.md:311's dated parenthetical and self-recorded drift history byte-identical, and did NOT append a phase-29-10 `-2` drift note of the kind CLAUDE.md:26 carries. The plan's acceptance criterion requires byte-identity for that clause, and CLAUDE.md:26 already records the shift; the correction is recorded here instead."
  - "Resolved three ambiguous `anno_`-carrying lines (143, 668, 715) to KEEP and recorded the ambiguity, per the plan's own tie-break. All three are present-tense clauses sitting inside milestone- or phase-scoped blocks, and none tells a reader to use, install or invoke a deleted route."

patterns-established:
  - "Pattern: adjudicate-then-record — every candidate line gets an explicit `correct` or `keep` verdict with the deciding rule clause written down, so a later reader can distinguish 'we looked and it is fine' from 'we never looked' (D-09)"

requirements-completed: [CUT-06]

coverage:
  - id: D1
    description: "PROJECT.md's Architecture constraint bullet cites four verified vice-proxy.ts line numbers and names the surviving anno_* tool family; its D-36 Key Decisions row names a guard file that exists on disk"
    requirement: "CUT-06"
    verification:
      - kind: integration
        ref: "src/mcp/vice/docs-absorbed-decisions.test.ts (5/5)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/docs-linerefs.test.ts + docs-dangling-refs.test.ts (11/11)"
        status: pass
      - kind: other
        ref: "grep -ac 'vice-proxy.ts:3052' == 0; ':2987' == 0; 'vice-proxy.ts:1531' == 0; ':1507' == 0; 'docs-anno-decisions' == 0; 'vice-proxy.ts:3050' >= 1; 'vice-proxy.ts:1529' >= 1"
        status: pass
      - kind: other
        ref: "sed -n '3050p;2985p;1529p;1505p' src/mcp/vice/vice-proxy.ts — each line read and matched to its claimed construct"
        status: pass
    human_judgment: false
  - id: D2
    description: "ARCHITECTURE.md's Rule A21 is a dated, superseded record rather than a present-tense invariant about a deleted module, with its number and all five citations intact and the research copy untouched"
    requirement: "CUT-06"
    verification:
      - kind: integration
        ref: "src/mcp/vice/docs-absorbed-decisions.test.ts#3 (Rule A21 body names resolveStorePath, ChildProcess, anno-mcp-client.ts)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2eaa136 HEAD -- .planning/research/ARCHITECTURE.md exits 0"
        status: pass
      - kind: other
        ref: "git diff -- .planning/ARCHITECTURE.md | grep -E '^[-+]#' finds no changed heading line"
        status: pass
    human_judgment: false
  - id: D3
    description: "The removal gate's rule-4 header states a NUL offset and tree-wide totals that reproduce, with a measurement date, an explicit scope definition and a drift clause; the gate's pins and predicates are untouched and it still exits 0"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "node scripts/check-no-analyser.mjs exits 0 (406 files, 157 exempt, 0 allow-listed)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/removal-gate.test.ts (8/8)"
        status: pass
      - kind: other
        ref: "python3 byte scan of src/mcp/vice/anno-memmap-render.ts — 31604 bytes, 2 NULs, first at offset 15097 = line 315"
        status: pass
      - kind: other
        ref: "git diff -- scripts/check-no-analyser.mjs shows no changed line that is not a comment"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 03: CUT-06 part A — living pointers corrected, history preserved Summary

**Four `vice-proxy.ts` citations re-verified and un-staled by +2, the deleted `anno_*` family swapped for the surviving `anno_*` one, a nonexistent guard filename repaired, Rule A21 converted from a live invariant into a dated superseded record, and the removal gate's own false NUL offset and pre-deletion occurrence totals re-measured with their scope and a drift clause.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-31T16:09:00Z (anchored to the worktree base commit `2eaa136`; `PLAN_START_TIME` was not separately captured)
- **Completed:** 2026-08-31T16:26:43Z
- **Tasks:** 3
- **Files modified:** 3 (plus this SUMMARY created)

## Accomplishments

- **`.planning/PROJECT.md:311` — four line citations corrected and independently re-verified in the same run.** `3052→3050`, `2987→2985`, `1531→1529`, `1507→1505`. Every one was stale by exactly `+2`, which is precisely the `−2` shift `CLAUDE.md:26` records for phase 29 plan 29-10. Each target line was read before writing: `:3050` is `const rewritten = rewriteArguments(args, name);`, `:2985` is `async function forwardToVice(...)`, `:1529` is `const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot");`, `:1505` is `async function gatherWedgeEvidence(...)`. All four matched the plan's expectation, so no measured-value substitution was needed. Note that only two of the four (`vice-proxy.ts:3050`, `vice-proxy.ts:1529`) are in the form `docs-linerefs.test.ts`'s `CITATION_RE` matches; the bare `:2985` / `:1505` shorthands were repaired anyway, because the guard checks two and the reader reads four.
- **The same line's live pointer at a deleted tool family replaced.** `The anno_* family (v0.3.0 Phase 11) is registered through buildViceTool()…` became `The anno_* family is registered through buildViceTool()…`, matching `CLAUDE.md:26` and tagged `(MCP-02)` in the same idiom as the `(SKILL-01)` bullet immediately above it. Confirmed against source rather than inherited from CLAUDE.md: `vice-proxy.ts:3388-3390` registers `ANNO_TOOL_DEFINITIONS` through `buildViceTool()` directly, and the block's own comment states the constraint is satisfied by construction because the runner is never wired to `forwardToVice()`.
- **`.planning/PROJECT.md:396` — the D-36 row's guard pointer now resolves.** `docs-absorbed-decisions.test.ts` does not exist (`ls` confirms); plan 29-05 renamed it to `docs-absorbed-decisions.test.ts` per D-12. Only that filename changed. The row still states "supersedes D-32", names `handler.rs:1894`, names `issues/42` and carries a reversal-trigger phrase — all four asserted by `docs-absorbed-decisions.test.ts` test 4, plus row uniqueness, and all five of its tests pass.
- **`.planning/ARCHITECTURE.md` Rule A21 converted to a dated, superseded record.** It had asserted, in the present tense, that "At most one live the external analyser child exists per `vice-proxy.ts` process", keyed on `resolveStorePath()` — a symbol that no longer exists — and that the child "is never spawned from a module other than `anno-mcp-client.ts`", a module deleted by commit `1d40ad0` on 2026-08-30. The heading and number are unchanged, the body is past tense, all five citations survive (`D18-04`, `D18-03`, `D18-21`, `D18-02`, `anno-mcp-client.ts`), and the record now names phase 29's own `D-06` as the decision that reversed A21 explicitly and on the record, states that nothing of the same kind replaced it (the `anno_*` store is in-process, so there is no child to govern), and carries a reversal condition. The diff contains no heading line and touches no other rule.
- **`scripts/check-no-analyser.mjs` rule 4 — both false numbers re-measured, both sites repaired.** Comment-only edit; the gate still exits 0 and `removal-gate.test.ts` still passes 8/8.

## Task Commits

1. **Task 1: Repair PROJECT.md's Architecture bullet and its D-36 row** — `11abb71` (docs)
2. **Task 2: Convert ARCHITECTURE.md's Rule A21 to dated, superseded prose** — `5ff2311` (docs)
3. **Task 3: Repair the removal gate's header drift** — `c81d2ee` (docs)

**Plan metadata:** see the `docs(32-03): complete` commit that carries this file.

## Files Created/Modified

- `.planning/PROJECT.md` — two lines changed (`:311`, `:396`); 2 insertions / 2 deletions
- `.planning/ARCHITECTURE.md` — Rule A21 block only; 34 insertions / 7 deletions
- `scripts/check-no-analyser.mjs` — comments only, at rule 4 in the header and at the `readFileSync()` call site; 26 insertions / 11 deletions

## Worktree re-anchoring (required by this plan's execution context)

Every `<automated>` command in `32-03-PLAN.md` hardcodes the **orchestrator's** checkout at
`/home/henrik/dev/henrik/git/c64-re-tools`, which does not contain this plan's commits. All of them
were re-anchored to this worktree root before running:

```
WT_ROOT=/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4d3cd6594bc32759
```

Actual commands run (from `$WT_ROOT`, or from `$WT_ROOT/src/mcp/vice` where the plan says `cd src/mcp/vice`):

```
node scripts/check-no-analyser.mjs                       # exit 0
node scripts/audit-gate.mjs --json                              # allowed:true, redGuards:[], 9 guards
cd $WT_ROOT/src/mcp/vice && node --test docs-absorbed-decisions.test.ts docs-dangling-refs.test.ts \
    docs-linerefs.test.ts removal-gate.test.ts                  # 24 tests / 24 pass / 0 fail
cd $WT_ROOT/src/mcp/vice && npm run test:automated              # see below
git diff --exit-code 2eaa136 HEAD -- .planning/research/ARCHITECTURE.md   # exit 0
```

`npm ci --no-audit --no-fund` was run once in `$WT_ROOT/src/mcp/vice` from the committed lockfile
before `test:automated` (the worktree had no `node_modules/`); nothing new was installed.

Every census over document content used `grep -a`, per plan 32-01's NUL-byte finding — the exact
trap this repo already carries in `anno-memmap-render.ts` and which produced one false decision here
before.

## Verification results

| Check | Result |
|---|---|
| `node scripts/check-no-analyser.mjs` | **exit 0** — `OK -- scanned 406 files (376 tracked outside ".planning/" + 30 shipped-but-untracked installer paths, floor 350); 157 occurrence(s) permanently exempt, 0 temporarily allow-listed across 0 entries.` Identical before and after the Task 3 edit. |
| `node --test docs-absorbed-decisions.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts removal-gate.test.ts` | **24 tests / 24 pass / 0 fail** |
| `node scripts/audit-gate.mjs --json` | `allowed: true`, `redGuards: []`, `guardFiles` = 9 derived docs guards, `structuralErrors: []` |
| `npm run test:automated` | **2941 tests / 2934 pass / 1 fail / 1 skipped / 5 todo**, exit 1. The single failure is the recorded worktree artifact — see below. |
| `git diff --exit-code -- .planning/research/ARCHITECTURE.md` | **exit 0** — byte-identical |
| `git diff --name-only 2eaa136 HEAD` | exactly the three declared files; none of plan 32-02's five `scripts/*.mjs` |

### The one `test:automated` failure is the known worktree artifact, not a regression

```
not ok 1472 - path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's
own repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE),
and the agreed path is not under .claude
  location: src/mcp/vice/repo-root.test.ts:178:1
  stack:    src/mcp/vice/repo-root.test.ts:249:10
  error: 'the agreed directory must not sit under .claude -- got
    …/.claude/worktrees/agent-a4d3cd6594bc32759/.vice-supervisor'
```

This is `repo-root.test.ts:248-251` asserting `!supervisorDir().includes(".claude")`, and a GSD
worktree root **is** `<repo>/.claude/worktrees/agent-*`. It fails inside every GSD worktree and only
inside a worktree; it is already measured, attributed and recorded by plan 32-01 in
`.planning/phases/32-the-deletion-and-the-grep-gate/deferred-items.md` § 1. Nothing in this plan
touches `repo-root.ts`, `vice.ts`, the broker, or any launcher resource. It was **not** "fixed" and
the assertion was **not** loosened. No VICE broker was running during the run (`pgrep` clean), so the
BACK-05 broker-reddening artifact does not apply either. **In the main checkout the expected floor
for this suite is 0 failures.**

## The `anno_` adjudication ledger for `.planning/PROJECT.md` (D-08 / D-09)

Measured with `grep -a` before the edits: **17 lines carrying `anno_`, 23 occurrences**, and **46
lines carrying the full subject literal, 51 occurrences** — both reproducing the plan's plan-time
figures exactly, so no census drift. After the edits: **16 lines / 22 occurrences** of `anno_`
(line 311 dropped out) and **46 lines / 51 occurrences** of the full literal (unchanged).

Every one of the 17 has a verdict. Nothing was swept.

| Line | Verdict | D-08 clause that decided it |
|---|---|---|
| 24 | keep | Paragraph opens "**As of v0.3.0 recon findings are state, not prose.**" — explicitly scoped to a named past milestone. |
| 91 | keep | "every item weighed for restating is Phase 11 (v0.3.0) evidence … re-weighed one milestone later, not new" — named phase and milestone scope. |
| 137 | keep | `✓` validated-outcome row closed "— Phase 11 (`ANNO-11`; the 17 curated `anno_*` tools)" — named phase scope. |
| 143 | keep *(ambiguity recorded)* | `✓` row closed "— v0.3.0 Phase 10 (`ANNO-02`; …)". Its inner clause is present tense ("the `anno_*` family registers proxy-locally"), but it sits inside a dated achievement record whose scope marker is the phase tag. Ambiguous → KEEP. |
| 159 | keep | `✓` row closed "— v0.5.0 Phase 18 (`SURF-01`..`SURF-03`)" — named milestone and phase scope. |
| 163 | keep | `✓` row closed "— v0.7.0 Phase 28 (`STORE-01`; …)" — named milestone and phase scope. |
| 198 | keep | Non-goal item tagged "*(added v0.3.0, D-R1/D-07)*" — decision-scoped. |
| 223 | keep | Inside "## Context → **Current codebase state.**", a dated milestone-close snapshot ("this milestone", per-milestone comparisons, "Test suite at close"). |
| **311** | **correct** | Live pointer: asserted in the present tense that the deleted `anno_*` family is a currently-registered surface. Replaced with `anno_*` `(MCP-02)`. The bullet's dated parenthetical and self-recorded drift history are byte-identical. |
| 381 | keep | Key Decisions data row — decision-scoped historical record with an Outcome verdict. |
| 384 | keep | Key Decisions data row — decision-scoped historical record with an Outcome verdict. |
| **396** | **correct (partial — Outcome cell only)** | Key Decisions D-36 row. The decision text is dated (2026-08-24) and stays byte-identical; only the Outcome cell's live pointer at a guard file that is not on disk was corrected (`docs-absorbed-decisions.test.ts` → `docs-absorbed-decisions.test.ts`). D-36's verdict was not restated and the row was not deleted. |
| 465 | keep | "**Prior milestone — v0.3.0 the external analyser static-analysis backend**, 2026-08-21" close record — dated. |
| 668 | keep *(ambiguity recorded)* | Inside "## Current Milestone: v0.7.0 … **Opened 2026-08-26.**" target-features list. It is a provenance claim about where the 12-member vocabulary was read from, not a use/install/invoke instruction. Ambiguous → KEEP. |
| 715 | keep *(ambiguity recorded — flagged for 32-05)* | "every absorbed step is written against `anno_*` tool calls". Present tense, and arguably outdated now that phases 29/31 re-pointed the skills — but it is a claim about what the skill *prose* contains, framed as this milestone's own motivating problem, inside a v0.7.0-scoped block ("Measured at the v0.7.0 open" two lines below). It points no reader at a tool to call. Ambiguous → KEEP, and explicitly surfaced here so plan 32-05 can re-adjudicate it with the whole sweep in view. |
| 1254 | keep | Inside "**Phase 11 complete — …** 2026-08-21" dated phase-close record. |
| 1270 | keep | Same dated Phase 11 close record ("Open and recorded, non-blocking: `T-11-NAME-INJECT`"). |

**Totals: 15 keep (3 with a recorded ambiguity), 2 correct.**

`.planning/` is excluded from the removal gate by PREFIX at
`scripts/check-no-analyser.mjs`'s `PLANNING_PREFIX`, so none of these edits could move an
exact-count exemption — confirmed by re-running the gate, whose reported totals are unchanged.

## The `ARCHITECTURE.md` inventory (confirming `D-11`, not re-deriving it)

`find` over the working tree and `git ls-files` agree — there are exactly **four** `ARCHITECTURE.md`
files and **all four live inside `.planning/`**. There is no `ARCHITECTURE.md` outside `.planning/`.

| Path | Carries A21? | Fate this plan |
|---|---|---|
| `.planning/ARCHITECTURE.md` | yes (1 mention of `A21`) | **edited** — Rule A21 converted to a dated superseded record |
| `.planning/codebase/ARCHITECTURE.md` | no (0) | untouched |
| `.planning/research/ARCHITECTURE.md` | yes (4 mentions of `A21`) | **left byte-identical** — a dated research archive; it gets a recorded verdict row in plan 32-05's ledger, not an edit. `git diff --exit-code` against the base commit exits 0. |
| `.planning/research/archive-v0.6.0/ARCHITECTURE.md` | no (0) | untouched |

`.planning/ROADMAP.md` § Phase 32 criterion 2 names "`ARCHITECTURE.md`'s Rule A21" by number; that
reference resolves to `.planning/ARCHITECTURE.md`, and it still resolves after the conversion because
the `### Rule A21` heading and its number were deliberately preserved.

## The removal gate's re-measured numbers, and how they were obtained

**NUL byte.** Measured in-process over the real bytes (not via `grep`):
`src/mcp/vice/anno-memmap-render.ts` is **31604 bytes** and carries **two** NUL bytes, at offsets
**15097** and 15118, both on **line 315** — the `"\0"` field separators in
`const canonical = JSON.stringify({ blocks, symbols, comments }) + "\0" + sidecarBytes + "\0" + RENDERER_VERSION;`.
The header had said one NUL at offset 12862 / line 291, and the in-body comment at the
`readFileSync()` call site repeated `anno-memmap-render.ts:12862`. Both sites now state the measured
values. The gate's own `memmap-measurement-provenance` pin (exactly 1 occurrence, at line 79) was
already correct and was not touched — line 79 still reads
`// measured LIVE against a real external-analyser-core-0.9.20`.

**Tree-wide totals — option (a), re-measured in the gate's own scope.** The stale pair ("399 with
`-a` and 398 without") was measured at plan 29-02 against the pre-deletion tree AND over a narrower
set than the sentence described. Re-measured 2026-08-31 by running the gate and reading its own
success line: scope is **tracked files outside `.planning/` plus the shipped-but-untracked installer
paths `packFiles()` supplies** — 406 files — with **157** occurrences with `-a` (157 permanently
exempt + 0 allow-listed; the gate fails on anything else, so that sum *is* the in-scope total) and
**156** without. The header now states both figures, the date, and the scope definition, and notes
explicitly that this is not the same set as a plain `git ls-files` sweep.

**The one-hit difference — rule 4's load-bearing claim — cross-checked independently.**
`grep -aoc 'the external analyser' src/mcp/vice/anno-memmap-render.ts` reports **1**; plain
`grep -oc 'the external analyser'` on the same file **exits 1 and reports nothing**, because GNU grep
classifies the file as binary and skips it. So the difference is exactly one hit and that hit is the
provenance comment at `:79` — precisely what a grep-backed gate would let survive its own removal
check.

**Drift clause added**, in `CLAUDE.md:26`'s idiom: the offset moves as the module grows and the
totals move as the tree or the pack list does; a mismatch is drift to re-verify, not evidence that
rule 4 stopped applying; and the load-bearing claim is the one-hit difference and its identity at
`:79`, never the absolute numbers. The stale figures are described but **not reprinted** (the plan's
acceptance criteria require `grep -c '12862'`, `grep -c 'line 291'` and `grep -c '399 with'` all to be
0, and they are).

Not touched, per `D-07` and the plan: no exemption id, no `hits:` / `lines:` / `prefixHits:` value, no
`need()` call, no scope predicate, no assertion. `git diff` on the file contains **no changed line
that is not a comment**, verified mechanically. `grep -ac 'the external analyser'` on the gate is still
**0** — it composes every occurrence from `SUBJECT_NEEDLE`, so a prose edit cannot move an
exact-count pin.

## Decisions Made

1. **Option (a) over option (b) for the tree-wide totals.** Re-measuring in the gate's own scope was
   chosen because the gate prints that scope and those totals on every successful run, making the
   figure self-refreshing evidence. Attributing the stale pair to plan 29-02 would have been
   defensible but leaves a reader holding a number they must re-derive against a tree it no longer
   describes.
2. **No `29-10` drift note appended to PROJECT.md:311's parenthetical.** `CLAUDE.md:26` carries
   "All four moved by −2 in phase 29 plan 29-10 …" but this plan's acceptance criterion requires
   PROJECT.md's parenthetical and drift history to be byte-identical, so the `+2` correction is
   recorded in this SUMMARY and in commit `11abb71`'s message instead of appended there. If a later
   plan wants the twin documents to match on that clause too, it is a one-line additive edit — but it
   is a change to a dated record and should be made deliberately, not as a side effect.
3. **Ambiguity resolves to KEEP, and the ambiguity is written down.** Lines 143, 668 and 715 are
   present-tense clauses inside milestone- or phase-scoped blocks. Rewriting any of them would be the
   one move this project's convention treats as destroying evidence. Line 715 is the closest call and
   is flagged by name for plan 32-05.
4. **`(MCP-02)` added to the corrected clause.** `CLAUDE.md:26` carries the tag and the bullet
   immediately above in PROJECT.md carries `(SKILL-01)`, so the tag is in-idiom; `MCP-02` was
   confirmed to be a real requirement id present in `.planning/REQUIREMENTS.md` and
   `.planning/ROADMAP.md` before adding it, so it cannot be a dangling reference.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria passed on the first
verification loop, no fix cycles were needed, and no deviation rule was invoked.

Two facts the plan told me to re-verify rather than assume, and which reproduced unchanged:

- All four `vice-proxy.ts` line numbers were exactly where the plan predicted, so no measured-value
  substitution was required.
- The NUL byte is at offset 15097 / line 315, matching the plan's plan-time measurement to the byte.

## Known Stubs

None. This plan changed prose in two planning documents and comments in one CI script; it created no
code path, no placeholder value and no unwired component.

## Threat Flags

None. No file changed here introduces a network endpoint, an auth path, a file-access pattern or a
schema change at a trust boundary. The plan's own threat register dispositioned `T-32-10` through
`T-32-12` as `mitigate`, and each mitigation was executed and verified rather than assumed:
`docs-absorbed-decisions.test.ts` was run after the D-36 edit (`T-32-10`), every candidate line got a
recorded verdict and the diff was asserted confined (`T-32-11`), and the gate diff was asserted
comment-only with both the gate and `removal-gate.test.ts` re-run (`T-32-12`).

## Issues Encountered

- **No `node_modules/` in the fresh worktree.** `npm ci --no-audit --no-fund` from the committed
  lockfile at `src/mcp/vice/` resolved it in 6s (237 packages). Nothing new was installed. Predicted
  by plan 32-01's finding 4.
- **One `test:automated` failure that is a worktree artifact, not a regression.** Documented in full
  above. Predicted by plan 32-01's finding 2.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 32-04 (wave 3) is unblocked.** `.planning/PROJECT.md`'s Architecture bullet now cites four
  line numbers that resolve, in the two forms `docs-linerefs.test.ts`'s `CITATION_RE` matches
  (`vice-proxy.ts:3050`, `vice-proxy.ts:1529`) and the two bare shorthands it does not. Widening the
  guard onto this file should land green rather than red, which is what ordering constraint 5 and the
  `4f048bb` precedent require.
- **Plan 32-05's sweep ledger has three inputs waiting.** The 17-row `anno_` verdict table above,
  the four-path `ARCHITECTURE.md` inventory (with `.planning/research/ARCHITECTURE.md`'s A21 recorded
  as a deliberate no-edit), and the specific flag on `.planning/PROJECT.md:715`.
- **Plan 32-08 (wave 4) can measure `scripts/check-no-analyser.mjs` as-is.** Per `D-07`, this
  plan's edit to that audited guard landed in wave 2 and the file will not be touched again by this
  plan. Its header numbers are now measured, dated and scope-defined, and it exits 0.
- **No blockers.** `.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately not modified —
  the orchestrator owns those writes after the wave merges.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

- All four claimed files exist on disk (`.planning/PROJECT.md`, `.planning/ARCHITECTURE.md`,
  `scripts/check-no-analyser.mjs`, and this SUMMARY).
- All four claimed commits resolve in `git log --oneline --all`: `11abb71`, `5ff2311`, `c81d2ee`,
  `ce98f7a`.
- All three tasks' `<acceptance_criteria>` were re-run after the final commit and all pass; the
  plan-level `<verification>` block was re-run and its results are recorded in the table above,
  with the single `test:automated` failure attributed to the recorded worktree artifact.

## `REQUIREMENTS.md` deliberately not touched (shared-ID gate)

`CUT-06` is declared by **six** plans in this phase — 32-02, 32-03, 32-04, 32-05, 32-07 and 32-09 —
so it must not read `Complete` until every one of them has produced a SUMMARY. Confirmed
mechanically rather than assumed:

```
$ node <gsd-core>/bin/gsd-tools.cjs query requirements.ready-ids \
    .planning/phases/32-the-deletion-and-the-grep-gate/32-03-PLAN.md CUT-06 --raw
0/1 requirement(s) ready to mark complete
```

The ready set is empty, so `.planning/REQUIREMENTS.md` was correctly left unmodified. It becomes
ready when the last declaring plan finishes.
