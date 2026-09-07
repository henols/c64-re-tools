---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 01
subsystem: testing
tags: [decision-gate, pre-commitment, chan-01, dual-channel, vice, stock-vice, totality-walk]

requires:
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "The pre-committed-gate pattern this plan reuses verbatim: rules first-match-wins, evidence layout split into DECISION-RULE.md/SCHEMA.md/README.md, git order as the sole ordering proof, no test guard"
provides:
  - "The binding CHAN-01 decision rules R1..R15 (DECISION-RULE.md), frozen before any of this phase's seven measurements exist"
  - "The frozen outcome-line schema for all seven gate inputs plus the recorded-fact lines and the findings-frontmatter shape (SCHEMA.md)"
  - "The evidence conventions binding on every later plan in phase 39, and the banked ordering proof (README.md)"
  - "An executable totality walk (totality-walk.mjs) proving totality, R1..R14 disjointness and TEXT_SINGLE_CLIENT independence (D-08) over all 3,888 tuples"
  - "The walk's real recorded transcript and column-0 outcome lines (39-totality.md)"
affects: ["39-02", "39-03", "39-04", "39-05", "39-06", "39-07", "39-08", "phase 41 (serialization shape)", "phase 43 (capture step scheduling)"]

actuals:
  tokens: 21000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Pre-committed decision gate: rules authored and committed before any measurement exists, with git commit order (not a test guard) as the sole proof of precedence"
    - "Executable totality walk over a cross-product of gate-input domains, asserting the strong property (exactly one antecedent matches, or none and the exhaustive default) rather than the weak one (at least one matches)"

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/DECISION-RULE.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/SCHEMA.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/README.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/totality-walk.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-totality.md
  modified: []

key-decisions:
  - "Task 1 checkpoint resolved `proceed` by the human owner: rules R1..R15, the seven input domains and the D-10/D-11 pre-mapped degrade narrowings froze exactly as drafted, no value adjusted"
  - "R2's residual risk (a probe defect reaching the same no-go as a genuine incompatibility) is mitigated procedurally, not structurally: REMOTEMONITOR_FLAG_ORDER, TEXT_PROMPT_LITERAL_CONFIRMED and TEXT_BIND_BUDGET_MS_MAX are recorded as facts beside the gate in evidence/39-idle-coexist.md (SCHEMA.md section 3), never as an eighth gate input"

patterns-established:
  - "Disjointness-by-conditioning: each of R3..R14 requires every input earlier in the reading order to hold its best value, making R1..R14 pairwise mutually exclusive so the totality walk can assert the strong property mechanically"
  - "Narrowings are not scoped to the fired rule: both pre-mapped degrade narrowings (D-10, D-11) apply whenever their own triggering input value is recorded, independent of which rule id actually fired first"

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "CHAN-01 decision rules R1..R15 committed, first-match-wins, with the D-10/D-11 pre-mapped degrade narrowings and Task 1's `proceed` selection transcribed verbatim"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -ac 'first match wins' DECISION-RULE.md && all 15 rule headings present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Frozen outcome-line schema: value domain, derivation and single declared source file for each of the seven gate inputs, plus the findings-frontmatter shape and not-yet-transcribed placeholder rule"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "all seven input names present in both DECISION-RULE.md and SCHEMA.md; not-yet-transcribed present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Executable totality walk enumerating all 3,888 tuples, asserting exactly one antecedent matches each, and computing TOTALITY, TSC_INDEPENDENCE and COULD_NOT_RUN_EMITTABLE mechanically rather than by promise"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "node evidence/totality-walk.mjs (exit 0): TOTAL_TUPLES 3888, TOTALITY holds, TSC_INDEPENDENCE holds, COULD_NOT_RUN_EMITTABLE no, RULE_HIT_R15 3"
        status: pass
    human_judgment: false
  - id: D4
    description: "Single-commit ordering proof: the DECISION-RULE.md-adding commit is the only commit reachable from itself that touches evidence/, and it touches no path outside evidence/"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "git rev-list --count <rules-sha> -- evidence/ == 1; git show --name-only <rules-sha> has zero paths outside evidence/"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 01: CHAN-01 decision rules, schema, conventions and executable totality walk Summary

**Froze the CHAN-01 go/degrade/no-go decision rules (R1..R15) and their 3,888-tuple executable totality proof in one commit, before any of this phase's seven measurements exist.**

## Performance

- **Duration:** ~25 min (continuation from a prior Task 1 checkpoint)
- **Started:** 2026-09-07T~19:45:00Z (continuation resume)
- **Completed:** 2026-09-07T20:06:04Z
- **Tasks:** 2 (Task 1 checkpoint resolved by human owner as `proceed`; Task 2 authored and committed)
- **Files modified:** 5 created, 0 modified

## Accomplishments

- `evidence/DECISION-RULE.md`: the binding inputs table (seven inputs), rules `R1`..`R15`
  first-match-wins with a re-derivable reasoning paragraph per rule, the disjointness design
  and the "narrowings are not scoped to the fired rule" correction, the `## Totality` section
  with the expected/observed per-rule histogram, the three-shape implication table, `## Never
  a gate`, and Task 1's `proceed` selection transcribed verbatim in the `**Decision
  checkpoint.**` paragraph.
- `evidence/SCHEMA.md`: value domain, corpus-free flag, derivation rule and single declared
  source file for each of the seven gate inputs; the recorded-facts table (never gate inputs);
  the findings-document frontmatter key order with the `not-yet-transcribed` incremental-
  population rule.
- `evidence/README.md`: the artifact table naming every file this phase will produce and its
  owning plan; nine numbered evidence conventions binding on every later plan; the banked
  `## Ordering proof` with real `git log` / `git rev-list` / `ls` output taken at this
  session's actual `HEAD`.
- `evidence/totality-walk.mjs`: an executable Node script (no dependencies) enumerating the
  full 3,888-tuple cross-product, asserting every tuple matches exactly one of `R1`..`R14` or
  none of them (then `R15`), with a named self-check regression witness for the
  `DISCONNECT_RECOVERY: leaves-halted` / `HITCOUNT_INVARIANT_HOLDS: breaks` overlap case, and
  computing `TSC_INDEPENDENCE` and `COULD_NOT_RUN_EMITTABLE` mechanically.
- `evidence/39-totality.md`: the walk's real transcript (exit 0) and its bare column-0 outcome
  lines, plus the actually-observed `test:automated` baseline for this run.
- All five files landed in exactly ONE commit (`05c2c069`) touching nothing outside
  `evidence/`; the plan's own ordering-proof verify command confirms
  `git rev-list --count 05c2c069 -- evidence/` is `1` and the commit's diff is entirely inside
  `evidence/`.

## Task Commits

Task 1 (`checkpoint:decision`, `gate="blocking"`) produced no commit — it was resolved by the
human owner through the orchestrator in a prior dispatch with the selection `proceed`, and
this continuation resumed from that resolution per the continuation-state instructions.

1. **Task 2: The rules, the schema, the conventions and the executable walk — authored, run,
   committed as ONE commit** - `05c2c069` (feat)

**Plan metadata:** commit follows this SUMMARY (see below).

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/DECISION-RULE.md` - the binding rules, first-match-wins, R1..R15
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/SCHEMA.md` - the frozen outcome-line schema and derivations
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/README.md` - evidence conventions and the banked ordering proof
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/totality-walk.mjs` - the executable totality walk
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-totality.md` - the walk's recorded transcript and outcome lines

## Decisions Made

- **Task 1 resolved `proceed`** (received via this continuation's dispatch instructions, originating from the human owner through the orchestrator before this plan's Task 2 ran): freeze rules `R1`..`R15`, the seven input names with their value domains, and the two pre-mapped `degrade` narrowings (`D-10` for `DISCONNECT_RECOVERY: leaves-halted`, `D-11` for `HITCOUNT_INVARIANT_HOLDS: breaks`) exactly as drafted. No value, domain, derivation or rule position was changed. `R2` stays as drafted: `IDLE_COEXIST: not-taken` remains a `no-go`, by its own separately numbered rule with its own stated reason, distinct from `R1`'s measured-corruption `no-go`.
- **R2's residual risk is a recorded procedural mitigation, not a structural one.** A probe defect (wrong `-remotemonitor` flag order, wrong prompt terminator, an under-budgeted connect retry) could in principle reach the same `no-go` verdict as a genuine measured incompatibility. This plan's Task 2 action already specified the mitigating fact-lines (`REMOTEMONITOR_FLAG_ORDER:`, `TEXT_PROMPT_LITERAL_CONFIRMED:`, `TEXT_BIND_BUDGET_MS_MAX:`) in `SCHEMA.md` § 3's "Recorded facts that are not gate inputs" table, sourced to `evidence/39-idle-coexist.md`. Per the continuation instructions' two-case branch: **the first case applied** — the plan's own drafted action already named these three fact-lines, so they were authored exactly as specified rather than added as a deviation. They are declared facts recorded beside the gate, never gate inputs, preserving `D-02` (no eighth input) and `D-08`'s mechanical proof (only the seven declared inputs appear in any antecedent — checkable directly in `totality-walk.mjs`'s `RULES` array, which reads none of these three names).

## Deviations from Plan

### Auto-fixed Issues

**1. [Informational — not a fix] `test:automated` baseline observed higher than the phase-level briefing**
- **Found during:** Task 2, while producing `39-totality.md`'s `TEST_AUTOMATED_BASELINE:` line
- **Issue:** This dispatch's `<phase_facts>` stated the measured baseline as "2 failing tests, in `anno-register.test.ts` alone." The actual `npm run test:automated` run taken during this plan observed **4 failing tests across 3 files** (`anno-import.test.ts`, `anno-register.test.ts` — 2 subtests, `host-scripts.test.ts`), all citing requirement-id declarations (`STORE-01`, `IMP-01`, `IMP-02`, etc.) not yet present in `REQUIREMENTS.md`, plus one `.gitignore` parity gap unrelated to this plan.
- **Fix:** None applied — this is out of scope by the deviation-rules scope boundary (pre-existing failures in files this plan does not touch, not caused by this plan's changes). The evidence convention (`README.md` § *Evidence conventions* 4) requires recording the count **actually observed** at the time of the run, not a previously briefed number, so `39-totality.md` records the true 4/3552 result and states explicitly that none of the four failures is caused by or related to this plan.
- **Files modified:** None (recording only, in `evidence/39-totality.md`, which is one of this plan's own declared output files)
- **Verification:** `cd src/mcp/vice && npm run test:automated` transcript pasted in `39-totality.md`; failing test names and assertion messages match verbatim
- **Committed in:** `05c2c069` (Task 2 commit)

---

**Total deviations:** 1 informational (baseline discrepancy recorded, not fixed — out of scope per deviation-rules scope boundary)
**Impact on plan:** None on this plan's own deliverables. Every later plan in this phase that runs `test:automated` should expect a baseline in this neighborhood (not "2 failing in one file") until whatever phase declared the STORE-01/IMP-01/IMP-02/etc. requirement ids also adds them to `REQUIREMENTS.md`, or until the `.gitignore` parity gap for `/tools/vendor/dxa/dxa` is closed. Neither is `CHAN-01`'s to fix.

## Issues Encountered

None beyond the baseline-observation deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `39-02` through `39-08` can now measure against a frozen, git-ordered rule set: every one of
  the seven gate inputs, its domain and its declared source file is fixed in `SCHEMA.md`, and
  `DECISION-RULE.md`'s rules cannot be revised without an explicit override recorded in the
  findings document.
- `evidence/README.md`'s numbered evidence conventions (transcript convention, `PROBE_DIR`,
  broker-stopped discipline, baseline-stated-never-re-derived, absolute-path binary
  resolution, voided-runs-recorded, final-occurrence-wins, values-transcribed-never-remembered,
  no-Phase-41-production-module) are binding on every remaining plan in this phase.
- No blockers. The ordering proof is banked and independently reproducible with the commands
  in `README.md` § *Ordering proof* fact three.

## Self-Check: PASSED

- All five evidence files and this SUMMARY.md verified present on disk (`[ -f ]`).
- Commit `05c2c069` (`feat(39-01): ...`) verified present in `git log --oneline --all --grep="39-01"`.
- Task 2's four `<verify>` blocks re-run: `GATE_ORDER_OK`, `RULES_SHAPE_OK` (all 15 rule
  headings + all 7 inputs + Never-a-gate + 3888 + not-yet-transcribed + Ordering-proof present),
  `WALK_OK` (exit 0, all 5 asserted lines present), `BANKED_OK` (all 5 lines present verbatim
  in `39-totality.md`) — all passed.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
