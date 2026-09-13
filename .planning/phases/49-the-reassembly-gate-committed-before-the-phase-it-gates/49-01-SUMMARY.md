---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 01
subsystem: testing
tags: [reassembly-gate, decision-rule, schema, pre-commitment, acme-verify, hazard-report, gate-precedent]

# Dependency graph
requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: the SCHEMA.md/DECISION-RULE.md pre-commitment pattern this plan replicates for a new gate
  - phase: 47
    provides: the multi-file ACME export tree (exportAsmTree) this gate's TREE_REBUILD/MOVEMENT_REBUILD inputs measure
  - phase: 48
    provides: buildHazardReport()'s HazardReport (findings, regions, HazardRegionOutcome) this gate's HAZARD_DISPOSITION input reads
provides:
  - The seven frozen gate input names (TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, DIFF_SCOPE_COVERAGE, RED_CONTROLS, SECOND_PATH_GUARD, ORDERING_PROOF), their complete value domains, and the derivation rule for each
  - The twelve-rule, first-match-wins, red-biased decision table (R1..R12) mapping the seven inputs to one of three verdict tokens (green/acknowledged/red)
  - The verdict document's frozen frontmatter key order for docs/phase49-the-reassembly-gate-findings.md
  - A git-history ordering proof (ORDERING_PROOF) that later measuring plans must check rather than assume
affects: [49-02, 49-03, 49-04, 49-05, 49-06, 49-07, 50]

# Actuals (#2632)
actuals:
  tokens: 7093
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-commitment gate pattern (Phases 9, 23, 33, 39): SCHEMA.md + DECISION-RULE.md committed together, alone, before any measurement evidence file exists in the same directory"
    - "Bare NAME: value at column 0 as the sole outcome-line convention, final-occurrence-wins, one declared source file per line"
    - "Red-biased first-match-wins rule ordering: absence, then ordering-proof/seam-guard structural breaches, then unrun/failed/refused measurements, then scope/controls, then hazard disposition, with an unconditional red catch-all closing the table"

key-files:
  created:
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md
  modified: []

key-decisions:
  - "Checkpoint auto-selected freeze-as-proposed (per orchestrator pre-authorization): seven inputs and three verdict tokens (green/acknowledged/red) frozen exactly as drafted, no value adjusted."
  - "Declined collapse-guards: SECOND_PATH_GUARD and ORDERING_PROOF stay gate inputs, not test-only properties, because their breach is what makes every other input untrustworthy."
  - "Declined rename-verdicts: green/acknowledged/red kept over go/degrade/no-go because degrade would mislabel a fully-correct rebuild with an accepted, named movement constraint as a reduced capability."
  - "DIFF_SCOPE_COVERAGE is read from two declared source files (one per rebuild run), the one input in this schema with more than one source, because scope coverage is a property of an individual rebuild rather than a single fact about the gate."
  - "R10 (acknowledged) and R11 (green) are the only two non-red rules in the twelve-rule table; every other rule, including the R12 catch-all, resolves red."

patterns-established:
  - "Pattern: this project's fourth-plus gate to freeze SCHEMA.md + DECISION-RULE.md in one commit set before any measurement evidence file exists in the same evidence/ directory, verified by a task-level guard that fails if a measurement file is present."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "The seven gate inputs (TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, DIFF_SCOPE_COVERAGE, RED_CONTROLS, SECOND_PATH_GUARD, ORDERING_PROOF) are declared with complete value domains and derivations in SCHEMA.md, committed before any measurement exists"
    requirement: "BUILD-06"
    verification:
      - kind: other
        ref: "grep -ac column-0 NAME: line check over SCHEMA.md (task 1 <verify>) — 7/7 declared, skipped named 8 times, findings doc absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "The twelve-rule, first-match-wins, red-biased DECISION-RULE.md table reads every declared input and resolves every reachable combination to green/acknowledged/red with no fourth token"
    requirement: "BUILD-06"
    verification:
      - kind: other
        ref: "grep -ac ^\\*\\*R[0-9]+ check + per-input presence loop over DECISION-RULE.md (task 2 <verify>) — 12/12 rules present, all 7 inputs read, evidence dir holds exactly the 2 pre-commitment files"
        status: pass
    human_judgment: false
  - id: D3
    description: "The checkpoint decision (freeze-as-proposed vs collapse-guards vs rename-verdicts) was resolved before either file was written, with the rationale for the selection and the two declined alternatives recorded in SCHEMA.md"
    human_judgment: true
    rationale: "The checkpoint was pre-authorized and auto-selected by the orchestrator (gate=\"blocking\", auto-mode) rather than answered by a human at this run; a human reviewer should confirm the recorded rationale is sound before Phase 49's measuring plans (49-02..49-07) begin writing against this frozen vocabulary."

duration: 6min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 01: The Pre-Commitment Summary

**Froze the reassembly gate's seven-input outcome-line schema and its twelve-rule, first-match-wins decision table in git, alone, before any measurement exists.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-13T08:29:00Z
- **Completed:** 2026-09-13T08:35:24Z
- **Tasks:** 3 (1 checkpoint:decision, 2 auto)
- **Files modified:** 2 (both created)

## Accomplishments
- `evidence/SCHEMA.md`: seven gate inputs (`TREE_REBUILD`, `MOVEMENT_REBUILD`, `HAZARD_DISPOSITION`, `DIFF_SCOPE_COVERAGE`, `RED_CONTROLS`, `SECOND_PATH_GUARD`, `ORDERING_PROOF`), each with a complete value domain, one declared source evidence file, and an explicit derivation rule — including the `skipped`-is-never-a-pass property inherited from `acme-verify.ts`'s existing oracle, and the `refused` value `MOVEMENT_REBUILD` adds for a same-address or absent movement input.
- `evidence/DECISION-RULE.md`: twelve ordered rules (`R1`..`R12`), first-match-wins, red-biased — every way of not knowing (absence, breached ordering proof, breached seam guard, a skipped assembler) resolves red before any passing rule is considered. `R10` is the sole `acknowledged` path (hazard acknowledged, everything else passing), `R11` is the sole `green` path, and `R12` is an unconditional red catch-all so no reachable input combination falls through unresolved.
- The verdict document's frozen frontmatter shape (`docs/phase49-the-reassembly-gate-findings.md`, not yet created) — key order, `not-yet-transcribed` placeholder convention, and the rule requiring `verdict`/`verdict_rule_applied` to stay absent until all seven inputs carry real values.
- The checkpoint decision (`freeze-as-proposed`) is recorded with its rationale and the reasoning for declining both alternatives, directly in `SCHEMA.md`, so a later reader does not have to reconstruct why the seven-input, three-token shape was chosen.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the outcome-line schema** - `b6953618` (feat)
2. **Task 2: Declare the binding decision rule** - `4df0f567` (feat)

**Plan metadata:** committed in this SUMMARY's own commit (docs)

_Note: the checkpoint:decision task (Task 0 in plan numbering) produced no file changes of its own — it was resolved before Task 1 began writing, per the orchestrator's pre-authorization, and its outcome is recorded inline in `SCHEMA.md`'s "Checkpoint provenance" section rather than as a separate commit._

## Files Created/Modified
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md` - the seven frozen gate inputs, their domains, derivations, declared-source assignment table, absence rules, and the verdict document's frontmatter shape
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md` - the twelve-rule, first-match-wins, red-biased decision table, each rule cited to the ROADMAP success criterion it enforces

## Decisions Made
- **Checkpoint auto-selected `freeze-as-proposed`** (per the orchestrator's pre-authorization — this is a `gate="blocking"` decision checkpoint, auto-approvable in auto-mode per `checkpoints.md` golden rule 5, not `gate="blocking-human"`): froze the seven inputs and three verdict tokens exactly as drafted in the plan's checkpoint `<context>`. Recorded as `⚡ Auto-selected: freeze-as-proposed`.
  - Rejected `collapse-guards` (dropping `SECOND_PATH_GUARD`/`ORDERING_PROOF` as gate inputs, keeping them as tests only): these two properties are exactly the ones whose failure makes every other input untrustworthy — a breached ordering proof means the rules were written after the measurement, and a breached seam guard means the byte-diff may not be the one the gate claims.
  - Rejected `rename-verdicts` (`go`/`degrade`/`no-go` instead of `green`/`acknowledged`/`red`): `degrade` names a reduced capability, which is not what an acknowledged hazard is — the rebuild is fully correct and a human accepted a named movement constraint.
- **`DIFF_SCOPE_COVERAGE` reads from two declared source files** (baseline and relocated rebuild evidence files) rather than one, because scope coverage is a fact of each individual rebuild run, not a single fact about the gate — the only one of the seven inputs with this shape, called out explicitly in both `SCHEMA.md` and `DECISION-RULE.md` so a later plan does not read it as a schema violation.
- **Twelve rules rather than a smaller table**: the plan's own `<action>` specified the exact rule count and ordering (absence → ordering proof → seam guard → skipped → refused → failed → scope → controls → hazard blocked → acknowledged → green → catch-all); followed verbatim rather than compressed, since compression would blur which single condition each rule tests.

## Deviations from Plan

**One auto-fix, Rule 3 (blocking) — verify command required a literal column-0 declaration block not otherwise implied by prose.**

- **Found during:** Task 1, running the plan's own `<verify>` command (`grep -ac '^\(TREE_REBUILD\|...\):' SCHEMA.md`) after drafting the schema in prose/table form.
- **Issue:** The initial draft declared the seven inputs only via a Markdown table (`| \`TREE_REBUILD\` | ... |`), which does not match at column 0 — the grep returned `0`, failing the task's own hard verification gate. Cross-checked against the precedent file (`39-01`'s own `SCHEMA.md`) and found it has the identical gap when tested with the analogous pattern, confirming this is a property the *verify command* requires of this plan's document specifically, not something the precedent already satisfied.
- **Fix:** Added an explicit literal block reproducing the checkpoint's own `NAME: value-set` lines at column 0 (`TREE_REBUILD:         ok | failed | skipped`, etc.) immediately under the "seven gate inputs" heading, ahead of the table — the canonical declaration the table and derivations expand on.
- **Files modified:** `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md`
- **Verification:** Re-ran the task's three `<verify>` commands — all three now pass (`7` declared inputs at column 0, `skipped` named `8` times, findings document absent).
- **Committed in:** `b6953618` (Task 1 commit; the fix was made before the first commit, so no separate corrective commit was needed).

---

**Total deviations:** 1 auto-fixed (1 blocking — HARD GATE `<verify>` failure fixed before proceeding)
**Impact on plan:** No scope creep; the fix only changed the schema document's own formatting to satisfy its own stated verification gate, no input name, value domain, or derivation rule changed.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `49-02` (the tracer: a tree-aware entry point on `verifyAcmeAssembles()`, the gate module, and one real end-to-end run) can now measure against a frozen, git-committed vocabulary and rule table — it must write `evidence/49-tree-rebuild.md`'s `TREE_REBUILD:` and `DIFF_SCOPE_COVERAGE:` lines (and, per D49-B, the movement counterpart in a later plan) using exactly the names and value domains declared here.
- No blockers. `git log` confirms both files landed in two commits (`b6953618`, `4df0f567`), both preceding any measurement evidence file — the `ORDERING_PROOF` input's derivation is satisfiable by construction at this point, and stays that way as long as no later plan edits either frozen file.
- **Concern to carry forward:** `ORDERING_PROOF` and `SECOND_PATH_GUARD` are structural checks that later plans (`49-06` for the seam guard, `49-07` for the real run) must actually compute from git history and the frozen expected-site sets — this plan defines what they mean but does not itself compute them, since no measurement exists yet.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md`
- FOUND: `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md`
- FOUND commit: `b6953618`
- FOUND commit: `4df0f567`
