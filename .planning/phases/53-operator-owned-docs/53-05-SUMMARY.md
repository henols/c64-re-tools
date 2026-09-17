---
phase: 53-operator-owned-docs
plan: 05
subsystem: infra
tags: [docs, evidence-tree, cross-references, roadmap, phase-gate]

requires:
  - phase: 53-operator-owned-docs (plan 04)
    provides: "27 evidence documents relocated to .planning/phases/*/evidence/ via git mv; both functional guard tests repointed; orphan-destination decision recorded in ROADMAP.md"
provides:
  - "Every one of the 98 references the relocation stranded now resolves: 87 across the 22 relocated documents that carry cross-references, and 11 across the two operator documents (5) and CLAUDE.md (6)"
  - "All five live Phase 53 success criteria demonstrated mechanically with pasted command output"
  - "Confirmation that no recurrence guard, CI check, lint rule, pre-commit hook, note, seed or todo was built for DOCS-04 (withdrawn 2026-09-17, closes SUPERSEDED)"
affects: [phase-51-guard-widening]

actuals:
  tokens: 19037
  tasks: 3
  commits: 2
plan_head_before: ffb38f7a5bbc60f9b716a899f032460302aef446

tech-stack:
  added: []
  patterns: ["scripted sed substitution map for a path repair, with a manual repair for the one reference a markdown line-wrap had split across two lines"]

key-files:
  modified:
    - .planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md
    - .planning/phases/01-corrected-ground-truth/evidence/phase1-probe-results.md
    - .planning/phases/02-stock-backend-connection/evidence/phase2-backend-probe-evidence.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/phase23-real-release-gate-findings.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/phase33-reproducible-run-gate-findings.md
    - .planning/phases/34-the-host-tool-execution-seam/evidence/phase34-host-tool-seam-decisions.md
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/phase36-sleigh-language-and-harness-findings.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/phase39-dual-channel-coexistence-gate-findings.md
    - .planning/phases/40-the-three-preprocessing-host-tools/evidence/phase40-preprocessing-tools-decisions.md
    - .planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md
    - .planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/evidence/phase42-text-format-drift-citations.md
    - .planning/phases/43-the-runtime-evidence-layer/evidence/phase43-runtime-evidence-layer.md
    - .planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-closure-gate.md
    - .planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-closure-ghidra-family.md
    - .planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-derivation-execution-evidence.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-ci-boundary.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-equivalence-transcript.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-edit-findings.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-modifiability-transcript.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-modifiability-findings.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-modifiability-transcript.md
    - docs/roadmap-stock-vice.md
    - docs/stock-vice-parity.md
    - CLAUDE.md

key-decisions:
  - "Re-measured before repair rather than trusting either the plan's '98' figure or the orchestrator's slightly different counts: found 87 stranded references across the 22 relocated documents (not all 27 carry cross-references), and 11 occurrences across 9 lines outside the relocated set (5 in the two operator documents, 6 across 4 lines in CLAUDE.md) -- 98 total, matching the plan's headline number even though the per-group split needed re-derivation"
  - "One reference (in phase50-exported-edit-findings.md) was split across a markdown line-wrap boundary (docs/phase50-modifiability-\\nfindings.md) and did not match the single-line sed substitution; repaired by hand with a rewrapped paragraph that preserves every word and lands at exactly the same 5-line count"
  - "Repointed all 25 files' addresses (never rewrote to a 'reason', unlike src/**) per ENGINEERING_RULES 21.3: none of these files is product source -- 22 live inside the planning tree already, and the two operator docs plus CLAUDE.md are read by someone with the whole checkout or the git-archive plugin zip, both of which carry the planning tree"
  - "No guard, CI check, lint rule, pre-commit hook, note, seed or todo was added for DOCS-04's withdrawn recurrence check -- criterion 6 stays withdrawn per the 2026-09-17 owner decision, and DOCS-04 remains SUPERSEDED as recorded by plan 53-04"

patterns-established:
  - "A path-substitution repair across many files: build a single ordered sed script from the source-to-destination map, apply once, then mechanically resolve every remaining planning-tree path in the touched files rather than trusting the substitution alone"

requirements-completed: [DOCS-01]

coverage:
  - id: D1
    description: "All 87 stranded cross-references across the 22 relocated documents that carry them are repointed to their new .planning/phases/*/evidence/ addresses, every referenced path resolves, and every touched file's diff is a one-for-one line replacement"
    requirement: "DOCS-01"
    verification:
      - kind: unit
        ref: "shell: grep -arn 'docs/phase' .planning/phases/*/evidence/phase*.md -> 0; every .planning/phases/.../evidence/phase*.md path referenced resolves to a real file; git diff --numstat per file has equal add/delete counts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 11 stranded references in the two operator documents (5) and CLAUDE.md (6, across 4 lines) are repointed, resolve, and leave line counts unchanged"
    requirement: "DOCS-01"
    verification:
      - kind: unit
        ref: "shell: grep -arn 'docs/phase' docs/roadmap-stock-vice.md docs/stock-vice-parity.md CLAUDE.md -> 0; every referenced path resolves; git diff --numstat has equal add/delete counts per file"
        status: pass
    human_judgment: false
  - id: D3
    description: "All five live Phase 53 success criteria demonstrated mechanically: operator-owned docs/, 27 relocated documents with history intact, orphan decision recorded, zero scan across src/+scripts/ (both the old-address and repointed-path forms), and net-positive src/ diff across the whole phase"
    requirement: "DOCS-01"
    verification:
      - kind: unit
        ref: "shell: ls docs/ (0 phase-prefixed, 0 subfolders); find .planning/phases -path '*/evidence/phase*.md' -> 27; git log --follow on 3 representative documents; grep -rn 'docs/phase' and grep -rn '.planning/phases/...evidence/phase' over src+scripts -> both 0; git diff --numstat ea013a8e..HEAD -- src -> 336 insertions > 198 deletions, cross-checked against the four prior plan summaries' own numstat figures"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm --prefix src/mcp/vice run typecheck exits 0 and npm run test:automated is green with no broker/emulator running (full npm test intentionally excluded per orchestrator instruction -- one live-emulator test is timing-sensitive and out of this plan's scope)"
    requirement: "DOCS-01"
    verification:
      - kind: unit
        ref: "shell: npm run typecheck -> exit 0; npm run test:automated -> tests 3701, pass 3692, fail 0, skipped 9"
        status: pass
    human_judgment: false

duration: ~9min
completed: 2026-09-17
status: complete
---

# Phase 53 Plan 05: Repair the Stranded References and Close the Phase Summary

**Repointed all 98 references plan 53-04's relocation left dangling (87 among the 22 relocated evidence documents that cite each other, 11 in the two operator documents and CLAUDE.md) and demonstrated all five live Phase 53 success criteria with pasted command output.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-17T12:12:55Z
- **Completed:** 2026-09-17T12:21:09Z (approx.)
- **Tasks:** 3/3 completed
- **Files modified:** 25 (22 relocated evidence documents + 2 operator docs + CLAUDE.md)

## Accomplishments

- Built a 27-row sed substitution map from 53-04-SUMMARY.md's source-to-destination table (three of the rows are pre-roadmap orphans whose destination is not derivable from the filename) and applied it in one pass across all 25 files.
- Repaired 87 stranded cross-references across 22 of the 27 relocated evidence documents (the other 5 carry no cross-references to a sibling). One reference had been split by a markdown line-wrap (`docs/phase50-modifiability-\nfindings.md`) and needed a hand rewrap that lands at the same 5-line count as the original paragraph.
- Repaired 11 stranded references outside the relocated set: 2 in `docs/roadmap-stock-vice.md`, 3 in `docs/stock-vice-parity.md`, and 6 across 4 lines in `CLAUDE.md`.
- Every referenced planning-tree evidence path across all 25 touched files now resolves to a real file on disk (mechanically verified, not asserted).
- Every touched file's diff is a one-for-one line replacement: 22 relocated documents came out at 91 insertions / 91 deletions; the 3 operator/instruction files at 9/9.
- Demonstrated all five live Phase 53 success criteria with literal command output (see below) and confirmed no recurrence guard was built for the withdrawn criterion 6 / DOCS-04.

## Task Commits

1. **Task 1: Repoint the 87 cross-references among the 22 relocated documents that carry them** - `fd7a6edc` (fix)
2. **Task 2: Repair the 5 references in the two operator documents and the 6 in the top-level instruction file** - `f4dfb7da` (fix)
3. **Task 3: Demonstrate all five live Phase 53 success criteria and close the phase** - this SUMMARY (no separate code commit; the phase-gate evidence is the deliverable)

_Both code commits landed directly on `main` per this plan's explicit USE_WORKTREES_FOR_PLAN: false / sequential instruction, matching 53-04's precedent._

## Files Created/Modified

- 22 relocated evidence documents under `.planning/phases/*/evidence/` — path substitution only, no reasoning added or removed.
- `docs/roadmap-stock-vice.md`, `docs/stock-vice-parity.md` — 2 and 3 stranded references repointed respectively.
- `CLAUDE.md` — 6 occurrences across 4 dense measured bullets (lines 28, 33, 37, 43) repointed; nothing else on those lines touched.

## Decisions Made

- **Repointing, not reason-rewriting, is correct here.** ENGINEERING_RULES 21.3 bans a `.planning/` path from product source because it is dead on arrival for an npm/plugin consumer who has only the product. None of these 25 files is product source: 22 already live inside the planning tree (a reader who can open one can open its neighbour), and the two operator documents plus CLAUDE.md are read by someone with the whole checkout or the `git archive HEAD`-built plugin zip — both of which carry the planning tree.
- **Re-measured rather than trusted the plan's or orchestrator's counts.** The plan said 98 references split as 87/5/6; the orchestrator's own fresh measurement (line-count based) reported 5 operator-doc lines and 4 CLAUDE.md lines. Both are consistent once occurrence-vs-line counting is reconciled: 9 lines carry 11 occurrences outside the relocated set (2+3 lines / 2+3 occurrences in the operator docs, 4 lines / 6 occurrences in CLAUDE.md), and 87 occurrences sit inside the relocated set — 98 total, matching the plan's headline figure.
- **The base commit for criterion 5 was sanity-checked, not assumed.** `ea013a8e` (the commit directly preceding `docs(53): research phase domain`) was confirmed as `22a6548f`'s sole parent, and the `src/` insertions/deletions measured from it (336/198) sum EXACTLY to the four prior plans' own recorded per-plan numstat figures (110+136+69+21+0 / 57+83+51+7+0), which would not happen if the wrong base commit had been resolved.
- **No successor to the withdrawn recurrence guard was built.** Criterion 6 was withdrawn 2026-09-17 by owner decision and `DOCS-04` already closes as SUPERSEDED (recorded by plan 53-04); this plan added no guard, CI check, lint rule, pre-commit hook, note, seed or todo proposing one, as explicitly instructed.

## Criterion-by-Criterion Evidence

### Criterion 1 — operator-owned `docs/`

```
$ ls -la docs/
dissambler-workflow.md
roadmap-stock-vice.md
stock-hard-losses.md
stock-vice-parity.md
undocumented-opcodes-ghidra.md
vice-mcp-ideas.md

$ ls docs/ | grep -c '^phase'
0
$ find docs -mindepth 1 -type d | wc -l
0
```
No phase-prefixed file, no subfolder.

### Criterion 2 — 27 relocated documents with history intact

```
$ find .planning/phases -path '*/evidence/phase*.md' -type f | wc -l
27
```

`git log --follow` on three representative documents, each showing commits that predate this phase:

**Oldest (phase 01):**
```
$ git log --follow --oneline -- .planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md | tail -5
f22bd530 docs(07-04): mark frame-counter stopwatch fallback SUPERSEDED in phase0-binmon-findings.md sec1
28af91cc docs(01-04): close probe-outstanding references and sign off 01-VALIDATION.md
2005fcec docs(01-01): correct section 4 of phase0-binmon-findings.md
e9d7caef docs(01-01): correct section 1 of phase0-binmon-findings.md
68b0a799 Add Phase 0 binary-monitor de-risk findings and probe to main
```

**Middle (phase 36):**
```
$ git log --follow --oneline -- .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/phase36-sleigh-language-and-harness-findings.md
fd7a6edc fix(53-05): repoint 87 stranded cross-references across 22 relocated evidence docs
ccdc58da feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs
497111b9 docs(36-07): the phase's consolidated findings, every touched guard's disposition
```

**Newest (phase 50):**
```
$ git log --follow --oneline -- .planning/phases/50-equivalence-and-modifiability/evidence/phase50-ci-boundary.md
fd7a6edc fix(53-05): repoint 87 stranded cross-references across 22 relocated evidence docs
ccdc58da feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs
9bbf53a8 docs(50): close three requirements, record the EQUIV-04 decline, queue 50-08
cfb6f5fc docs(50-07): a broken step, observed going red and reverted
1a91061a docs(50-07): state the CI boundary rather than blurring it
```

### Criterion 3 — orphan destination decided and recorded

Already recorded by plan 53-04 in `.planning/ROADMAP.md`'s Phase 53 section (confirmed present, unchanged by this plan):

```
- **ORPHAN DESTINATIONS — DECIDED and RECORDED 2026-09-17 (`DOCS-02`).** All three
  pre-roadmap documents are placed by the evidence of which plan authored them, not by the
  number in their filename:
  - `docs/phase0-binmon-findings.md` and `docs/phase1-probe-results.md` both appear verbatim
    in `.planning/phases/01-corrected-ground-truth/01-04-PLAN.md`'s own `files_modified:`
    frontmatter list -- that plan authored both documents. Destination:
    `.planning/phases/01-corrected-ground-truth/evidence/`.
  - `docs/phase2-backend-probe-evidence.md`'s own opening paragraph names its origin --
    it records evidence-gathering "plan 02-02 was supposed to perform" -- and its body cites
    the decision record it overrides, `.planning/phases/02-stock-backend-connection/02-CONTEXT.md`.
    Destination: `.planning/phases/02-stock-backend-connection/evidence/`.
  All three moved with `git mv` in plan 53-04; `git log --follow` on each returns its
  pre-move history.
```

### Criterion 4 — zero across `src/` and `scripts/`, nothing repointed there

Two checks, both required:

```
$ grep -rn 'docs/phase' src scripts | wc -l
0
$ grep -rn '\.planning/phases/[^ ]*evidence/phase' src scripts | wc -l
0
```
The old-address form is zero (unchanged from waves 1-2), AND this plan introduced no planning-tree evidence path into `src/` or `scripts/` — this plan's repairs stayed confined to the 25 files named in its scope.

### Criterion 5 — no net deletion of explanatory comments

Base commit resolved as the most recent commit whose subject does not carry a phase-53 scope:

```
$ git log --format="%H %s" | awk '!/\(53(-[0-9]+)?\)/ {print; exit}'
ea013a8e1860ad37044ca07844207f3e0359d597 docs(architecture): remove references to guards and modules that no longer exist [skip release]
```

Sanity-checked: `ea013a8e` is the sole parent of `22a6548f` (`docs(53): research phase domain`), the first phase-53 commit.

```
$ git diff --shortstat ea013a8e..HEAD -- src
34 files changed, 336 insertions(+), 198 deletions(-)
```

Insertions (336) exceed deletions (198).

Cross-checked against the four prior plans' own recorded/measured per-plan `src/` numstat:

| Plan | Range | Insertions | Deletions |
|---|---|---|---|
| 53-01 | `ea013a8e..7a2d6e79` | 110 | 57 |
| 53-02 | `7a2d6e79..d3a27c95` | 136 | 83 |
| 53-03 | `d3a27c95..632c8525` | 69 | 51 |
| 53-04 | `632c8525..ffb38f7a` | 21 | 7 |
| 53-05 (this plan) | `ffb38f7a..HEAD` | 0 | 0 |
| **Sum** | | **336** | **198** |

The sum matches the direct `ea013a8e..HEAD` measurement exactly (336/198 both ways), which would not happen if the base commit had been resolved wrongly. 53-01's own summary independently recorded `+110/-57` for its range, matching the re-derived figure. This plan touched no `src/` files (0/0), consistent with its scope being confined to `.planning/`, `docs/`, and `CLAUDE.md`.

### What this phase did NOT build

No guard, continuous-integration check, lint rule, pre-commit hook, note, seed or todo proposing a `docs/phase*` recurrence check exists anywhere in this plan's output. Criterion 6 was withdrawn on 2026-09-17 by owner decision (recorded in `.planning/ROADMAP.md`'s Phase 53 section) and `DOCS-04` closes as SUPERSEDED, not met. The recurrence risk — nothing mechanical stops a future plan from writing evidence to `docs/` again — is accepted and named, not mitigated. This plan added no successor document, guard, or check to close that gap; doing so would have directly violated this plan's own constraints.

## Test Results

**Typecheck:**
```
$ npm --prefix src/mcp/vice run typecheck
> tsc --noEmit -p tsconfig.json
(exit 0, no output)
```

**`npm run test:automated`** (no broker/emulator process running — verified via `ps -eo pid,cmd | grep -E "/x64sc|vice-broker\.mjs|vice-launcher\.sh"` returning nothing before the run):
```
tests 3701
suites 21
pass 3692
fail 0
cancelled 0
skipped 9
todo 0
duration_ms 46518.18
```
Fully green. Per the orchestrator's explicit instruction, the full `npm test` (which includes live-emulator MANUAL_ONLY tests, one of which — `broker-e2e.test.ts`'s "wired disconnect-while-queued" — is a documented timing-sensitive flake per 53-04-SUMMARY.md) was NOT run; the orchestrator settles that separately.

## Deviations from Plan

**1. [Rule 1 - Bug] One reference split across a markdown line-wrap did not match the single-line substitution script**
- **Found during:** Task 1 verification (the zero-scan check initially returned 1, not 0)
- **Issue:** `phase50-exported-edit-findings.md` line 29-30 wrapped `docs/phase50-modifiability-findings.md` across a line break (`docs/phase50-modifiability-\nfindings.md`), so the line-anchored sed substitution — correct for every other occurrence — never matched this one.
- **Fix:** Hand-rewrapped the surrounding 5-line paragraph so the new, longer path fits on its own line, preserving every word of the original prose and landing at exactly the same 5-line count (`textwrap`-computed at width 83 to confirm a 5-line fit existed before editing).
- **Files modified:** `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-edit-findings.md`
- **Verification:** Re-ran the zero-scan and path-resolution checks — both passed; the file's `git diff --numstat` shows equal add/delete counts.
- **Committed in:** `fd7a6edc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** Necessary to satisfy the plan's own "every reference resolves" and "unchanged line count" requirements. No scope creep — the fix stayed inside the file the plan already scoped for Task 1.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 53 is complete: all five live success criteria are demonstrated, `DOCS-04` closes as SUPERSEDED (not met, recurrence risk accepted per owner decision), and `docs/` holds only operator-authored content with the 27 evidence documents living in the phase artifact tree with intact history.
- Phase 51's guard-widening work can proceed on a clean pattern: `src/` and `scripts/` measure zero for both the old `docs/phase` address form and the `.planning/phases/*/evidence/phase*` form, so there is no hole for a widened guard to inherit.
- The recurrence risk (nothing mechanical stops a future plan writing evidence to `docs/` again) remains accepted and recorded, not mitigated — an explicit, owner-made decision, not an oversight.

## Self-Check: PASSED

All 25 modified files confirmed present on disk at their new/unchanged paths; both commit hashes (`fd7a6edc`, `f4dfb7da`) confirmed present in `git log --oneline --all`.

---
*Phase: 53-operator-owned-docs*
*Completed: 2026-09-17*
