---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 01
subsystem: infra
tags: [pre-commitment, decision-gate, evidence-protocol, git-ordering-proof, vice, stock-binary-monitor]

# Dependency graph
requires:
  - phase: 23-the-real-release-gate-go-degrade-no-go
    provides: "The pre-committed decision-rule pattern this mirrors — the Inputs/Rules/never-a-gate structure, the outcome-line schema, the numbered evidence conventions and the banked ordering proof"
provides:
  - "GATE-01's binding go / degrade / no-go rules R1..R9, first-match-wins, committed before any measurement in this phase exists"
  - "The five named gate inputs with their value domains, each pointing at exactly one declared source file and one declared outcome-line name"
  - "A totality walk proving all 108 input tuples resolve to exactly one of go / degrade / no-go, so could-not-run has no antecedent (D-03)"
  - "The D-04 pre-mapped degrade narrowings for C0_CAPTURE_PAIR: not-obtained and ORACLE_NECESSITY: unproven, authored while the answers are unknown"
  - "The outcome-line schema: every line name, its domain, its single source file and the derivation rule that produces its value"
  - "The seven numbered evidence conventions binding on every plan in the phase, and the artifact table naming the single owner of each evidence file"
  - "The banked ordering proof: zero commits anywhere in history touched evidence/ before this commit, and this commit is the only commit reachable from itself that touches it"
affects: [33-03, 33-07, 33-10, 33-11, 33-12, phase-34, phase-35, phase-36, phase-37, phase-38]

actuals:
  tokens: 10430
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Pre-committed decision rule with a git-ordering proof and no test guard (third use: Phase 9 R4, Phase 23 R1, Phase 33 GATE-01)"
    - "Structural no-abstain gate: the terminal rule carries no antecedent, so the rule set is total over the input domain product"
    - "Self-referential ordering proof split across the commit boundary: pre-commit facts inside the file, the commit sha in the next commit"

key-files:
  created:
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/DECISION-RULE.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/SCHEMA.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/README.md
  modified: []

key-decisions:
  - "Task 1's blocking decision gate was resolved by the human owner through the orchestrator, before dispatch and before any measurement existed, with the selection `proceed` — rules R1..R9, the five input names with their domains, and the two pre-mapped degrade narrowings frozen exactly as drafted, no value adjusted"
  - "The `harden-capture-pair` alternative was declined on two recorded grounds: making C0_CAPTURE_PAIR: fail a no-go would make a captured-and-failed pair fatal while never obtaining a pair stayed only degrade (the wrong incentive), and D-04 deliberately leaves `fail` unmapped so its narrowing is authored against the actual recorded cause"
  - "The totality argument is arithmetic, not prose: 3x3x2x2x3 = 108 tuples partitioned 54/18/12/8/8/4/2/1/1 across R1..R9, so 84 resolve no-go, 23 degrade and exactly 1 (the all-best tuple) go"
  - "Fact one of the ordering proof is banked as PRE-commit facts (git log over evidence/ = no output, git rev-list --count HEAD -- evidence/ = 0, parent sha 543522c) rather than as a post-commit sha, because a file cannot carry the hash of the commit that introduces it and D-01 forbids the second commit Phase 23 used"
  - "SCHEMA.md declares the eleven non-gating recorded lines as well as the five gate inputs, with domains matching the regexes sibling plans already pin, so no measuring plan can mint a variant name"
  - "DERIVATION: is declared with the single value `void` and explicitly permitted to be absent on the at-or-under-cap branch, so declaring it does not constrain 33-10's success path"

patterns-established:
  - "Never-a-gate declarations name the four values a later plan might promote (corpus release count, absolute cycle count, probeReady's budget, the test:automated failure count) and forbid promoting them"
  - "Evidence convention 4 states the measured test:automated baseline as 5 failing tests in 3 files with the file names, and forbids any transcript writing `clean` or `0 failures`"
  - "The evidence artifact table names a single owner plan per file, so two parallel plans never edit one document"

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "GATE-01's binding decision rules are committed as a single commit that is the only commit reachable from itself touching the phase evidence directory — the ordering that makes the verdict derived rather than judged"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "git log --diff-filter=A --format=%H -- evidence/DECISION-RULE.md | tail -1; git rev-list --count <sha> -- evidence/ => 1 (GATE_ORDER_OK rules=2a8ef95b3a6474d0300c3069eb56bfee33e820eb)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rule set carries R1..R9 first-match-wins with exactly one go rule, all five named inputs, the Totality section stating 108 tuples, the Never a gate declarations, and Task 1's selection transcribed verbatim"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep gate over DECISION-RULE.md and SCHEMA.md (RULES_SHAPE_OK); grep -c '-> `go`' = 1; grep -c '**Decision checkpoint.**' = 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "SCHEMA.md declares a value domain AND a derivation rule for each of the five outcome lines, with exactly one source file per line, plus the eleven non-gating lines, the corpus.releases[] shape and the findings frontmatter keys"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep for SEED_EFFECT / JITTER_IMMUNITY / ORACLE_NECESSITY / SLICER / C0_CAPTURE_PAIR in SCHEMA.md (RULES_SHAPE_OK); domains cross-checked against the anchored regexes already pinned in 33-03/33-07/33-10/33-11/33-12 verify commands"
        status: pass
    human_judgment: false
  - id: D4
    description: "README.md carries the artifact table, the seven numbered evidence conventions binding on every plan in the phase, and the ordering proof with real git output"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep -q 'Ordering proof' evidence/README.md (RULES_SHAPE_OK); pasted output of `git log --oneline -- evidence` (no output) and `git rev-list --count HEAD -- evidence` (0) at parent 543522c"
        status: pass
    human_judgment: false
  - id: D5
    description: "The pre-commitment is substantively correct — the thresholds, the rule ordering and the two pre-mapped narrowings are the right ones to freeze, and the degrade/no-go boundary is defensible"
    verification: []
    human_judgment: true
    rationale: "This is a one-way door whose correctness cannot be established by any test: the rules gate measurements that do not yet exist, so no automated check can distinguish a well-chosen threshold from a badly-chosen one. It was resolved as a blocking decision gate by the human owner before dispatch, which is the only form of verification available to it."

# Metrics
duration: 20 min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 01: The Pre-Committed GATE-01 Decision Rules Summary

**GATE-01's go / degrade / no-go rules, its outcome-line schema and the phase's evidence conventions committed as one commit that provably precedes every measurement — with a totality walk over all 108 input tuples that leaves `could-not-run` no antecedent to fire on.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-02T16:56:57Z
- **Completed:** 2026-09-02T17:17:00Z
- **Tasks:** 2 of 2 (Task 1 was a blocking decision gate resolved by the human owner before dispatch)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- **The gate cannot abstain, and that is arithmetic rather than prose.** `DECISION-RULE.md`'s `## Totality` section partitions all `3 x 3 x 2 x 2 x 3 = 108` input tuples across `R1`..`R9` as `54 / 18 / 12 / 8 / 8 / 4 / 2 / 1 / 1` — 84 resolving `no-go`, 23 `degrade`, and exactly one (the all-best tuple) `go`. `R9` carries no antecedent, so there is no combination of values, including the all-worst tuple and the most absence-laden reachable tuple, for which the rules fall through. This is the defect Phase 23's gate carried and actually hit, and removing it is what the ROADMAP names as this gate's distinguishing property.
- **The three `no-go` rules fire only on corpus-free inputs.** `R1` (`SLICER: failed`), `R2` (`SEED_EFFECT: unpinned`) and `R3` (`JITTER_IMMUNITY: not-immune`) are each measurable on a bare host with no cracked release anywhere on disk, so a missing corpus can never produce a `no-go`. `C0_CAPTURE_PAIR` — the one corpus-bound input — reaches only `degrade`, via `R4` (`fail`) or `R5` (`not-obtained`).
- **The two pre-mapped `degrade` narrowings are written down while the answers are unknown (D-04).** `C0_CAPTURE_PAIR: not-obtained` narrows Phase 38 to method-only and Phases 35/36/37 to fixture-only, with the `REPRO-*` / `CAP-01` / `CAP-02` substrate explicitly untouched. `ORACLE_NECESSITY: unproven` narrows the oracle to the two-term `(PC, hit_count)` form with the frame term recorded but not asserted. `R4`'s `fail` is deliberately left unmapped, with the reason stated: a not-frame-exact stop and a cap overflow narrow in different directions.
- **No measuring plan can invent a favourable definition.** `SCHEMA.md` gives each of the five gate inputs a complete domain, a single declared source file and a **derivation rule** — including both halves of `SEED_EFFECT: pinned` (the without-block count must also be non-zero, or the window was never nondeterministic), the direction `ORACLE_NECESSITY`'s control has to run in, and the requirement that `SLICER: validated` carry both suite transcripts. Eleven non-gating recorded lines are declared alongside them, with domains matching the anchored regexes sibling plans already pin.
- **The ordering is banked as fact, not as a promise.** `README.md` § *Ordering proof* pastes the real pre-commit output — `git log --oneline -- evidence` returning nothing and `git rev-list --count HEAD -- evidence` returning `0` at parent `543522c` — plus the reproducible post-commit assertion. The landed commit `2a8ef95` is the only commit reachable from itself that touches `evidence/`, confirmed at `1`.
- **The phase's evidence protocol is stated before the measurements it governs.** Seven numbered conventions: the `$ <command>` transcript rule, the `PROBE_DIR` location, `BROKER_STATE: inactive` recorded per run (`D-11`), the measured `test:automated` baseline stated as **5 failing tests in 3 files** and never as `clean`, voided runs recorded rather than discarded, final-occurrence-wins, and values transcribed rather than remembered.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm the rule thresholds and the five-input set before they are frozen** — no commit; a `checkpoint:decision` with `gate="blocking"`, resolved by the human owner through the orchestrator **before dispatch and before any measurement in this phase existed**. Selection: **`proceed`**. Transcribed verbatim into `DECISION-RULE.md`'s `**Decision checkpoint.**` paragraph.
2. **Task 2: The rules, the schema and the conventions — authored, committed as ONE commit, and the ordering proved end to end** — `2a8ef95` (docs)

**Plan metadata:** see the `docs(33-01): complete …` commit that carries this SUMMARY.

## Files Created/Modified

- `.planning/phases/33-…/evidence/DECISION-RULE.md` (15 055 bytes) — The binding rules: the frozen-status and decision-checkpoint paragraphs, the five-input table with corpus-free flags, `R1`..`R9` first-match-wins with a re-derivable reasoning paragraph each, the `## Totality` partition table over 108 tuples, the `## Never a gate` declarations, and the `## Ordering` statement.
- `.planning/phases/33-…/evidence/SCHEMA.md` (13 131 bytes) — Outcome-line conventions; the five gate inputs with domain, corpus-free flag, declared source file and a per-input derivation subsection; eleven non-gating recorded lines; the `corpus.releases[]` list schema; the eleven findings-frontmatter keys in `D-05` order.
- `.planning/phases/33-…/evidence/README.md` (13 535 bytes) — The nineteen-row artifact table with a single owner plan and a "what it proves" per file, the seven numbered evidence conventions, the three-fact ordering proof, and the scope note that every ordering assertion is scoped to `evidence/` and never to the phase directory.

## Decisions Made

- **Task 1: `proceed`.** Recorded verbatim, with the human-owner provenance and the timing (before dispatch, before any measurement) stated in the same paragraph, plus the recorded grounds for declining `harden-capture-pair`.
- **The totality walk is a partition table, not a prose claim.** Counting tuples *reaching* each rule under first-match-wins (rather than tuples *matching* its antecedent) makes the nine counts sum to exactly 108 and makes the verdict tallies checkable by arithmetic. A reader can re-derive `84 / 23 / 1` without trusting the document.
- **Adjacency is answered by rule id.** The document states that a tuple satisfying several antecedents has exactly one verdict — the first rule's — and that unevaluated rules are recorded as *not evaluated*, never as passed. `33-12` records `verdict_rule_applied: R<N>` accordingly.
- **The non-gating lines are declared, not left open.** Declaring `BROKER_STATE`, `TEST_AUTOMATED_BASELINE`, `AUTOSTART_FRAME_EXACT`, `AUTOSTART_SEQUENCE`, `WALLCLOCK_CONTROL`, `WARP_BRACKET_CONTROL`, `RESET_REMOVED_CONTROL`, `CAPTURE_FRAME_EXACT`, `TRANSIENT_COUNT`, `DERIVATION`, `MEMSPACE_ASSERTION`, `PROBEREADY_BUDGET`, `WARP_TIME_TO_BIND_MS_MAX` and `CONSOLE_TIME_TO_BIND_MS_MAX` closes the name-invention route in both directions. Their domains were taken from the anchored `grep -Eq '^NAME: (…)$'` regexes already committed in the sibling plans' verify blocks, so the schema cannot contradict a plan that already exists.
- **`DERIVATION` is declared as absent-permitted.** Only `void` is declared, and the schema says explicitly that the line is absent on the at-or-under-cap branch — so declaring it does not force `33-10` to emit a value the plan never specified, and `33-10`'s `grep -q '^DERIVATION: void$'` branch test keeps working unchanged.
- **Absence is defined asymmetrically.** For the five gate inputs an absent line is an incomplete phase; for every other declared line, absence is permitted where the branch that writes it was not taken. Stated in `SCHEMA.md` § 1 so no plan reads the strict rule as universal and pads its evidence with placeholder lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The ordering proof's fact one is self-referential and cannot be satisfied inside a single commit**

- **Found during:** Task 2 (authoring `README.md` § *Ordering proof*)
- **Issue:** The plan asks fact one to "paste the real output of `git log --oneline -1 -- <evidence>/DECISION-RULE.md`", whose output contains the sha of the commit that introduces the file doing the pasting. That is a fixed-point the content cannot reach: any amend that inserts the sha changes the sha. Phase 23 could paste it only because it wrote its `README.md` in a **later** commit — a route `D-01`'s single-commit requirement forecloses. The two available bad outcomes were a stale sha (dishonest in exactly the document whose only job is honesty about ordering) or a placeholder (barred by the acceptance criteria).
- **Fix:** Restructured the proof into three facts of equal probative force, all with real command output. **Fact one** pastes the **pre-commit** state — `git log --oneline -- evidence` returning no output and `git rev-list --count HEAD -- evidence` returning `0`, with the parent commit named by full sha `543522cd0f62e3052841a0a93d6155c3cc37627d` (stable and knowable at authoring time) — which proves the stronger claim that **no path under `evidence/` has ever existed in the reachable history**, so no measurement artifact can predate the rules. **Fact two** pastes `ls <evidence>` (the three files). **Fact three** states the post-commit assertion, gives the exact four-line reproduction, and explains in the document itself why the sha is not pasted, pointing at this SUMMARY (which lands in the next commit) and at `33-12`'s re-run.
- **Files modified:** `evidence/README.md`, plus the closing `## Ordering` paragraph of `evidence/DECISION-RULE.md` which points at the same three facts.
- **Verification:** Both of Task 2's `<automated>` verify commands pass — `GATE_ORDER_OK rules=2a8ef95b3a6474d0300c3069eb56bfee33e820eb` (evidence dir holds exactly three files; `git rev-list --count 2a8ef95 -- evidence/` is `1`) and `RULES_SHAPE_OK`. The plan's `<verification>` item 5 (real git output, not a placeholder) is met by facts one and two.
- **Committed in:** `2a8ef95` (part of the task commit)

---

**Total deviations:** 1 auto-fixed (1 × Rule 3 — blocking issue).
**Impact on plan:** None on scope, and the ordering claim came out **stronger** rather than weaker: "nothing under `evidence/` has ever existed in history" is a strictly larger claim than "the rules commit is the first commit under `evidence/`". No file outside `files_modified` was touched, the single-commit requirement held, and the sha the plan wanted pasted is recorded here and re-verified by `33-12`.

## Issues Encountered

- **`D-11` and evidence convention 4 disagree about the `test:automated` floor, and the plan already resolved it.** `33-CONTEXT.md`'s `D-11` says "clean floor: **0** failures"; `33-RESEARCH.md` P8 measured `EXIT=1, pass 3019 / fail 5` in 3 files on this tree with the broker stopped, and the plan's action text specifies the corrected wording. Convention 4 therefore states **5 failing tests in 3 files** with the file names, names the two root causes, records that `33-02` repairs one of them (expected baseline afterwards: **2 in `anno-register.test.ts` only**), and forbids any transcript writing `clean` or `0 failures`. `DECISION-RULE.md` § *Never a gate* additionally forbids promoting the count to a gate. No plan edit was needed — this is the plan's own instruction, recorded here so a later reader does not read `D-11` as live.
- **Three untracked files predate this plan and were deliberately left alone** (`docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`), as were the orchestrator's pre-dispatch edits to `.planning/STATE.md` and `.planning/state.json`. `D-01` says this plan touches nothing else, and the commit's `--name-only` output confirms exactly three paths.

## Self-Check: PASSED

- `evidence/DECISION-RULE.md` — FOUND (15 055 bytes)
- `evidence/SCHEMA.md` — FOUND (13 131 bytes)
- `evidence/README.md` — FOUND (13 535 bytes)
- Commit `2a8ef95` — FOUND in `git log`
- Task 2 verify 1 — PASS (`GATE_ORDER_OK rules=2a8ef95b3a6474d0300c3069eb56bfee33e820eb`)
- Task 2 verify 2 — PASS (`RULES_SHAPE_OK`)
- Acceptance: `first match wins` present (1); `R1`..`R9` all present; exactly one `-> \`go\`` rule (count 1); `## Totality` with `108`; `## Never a gate` naming all four never-gates; `**Decision checkpoint.**` present (1) carrying `proceed`
- Plan `<verification>` 1-6 — PASS (three files in `evidence/`; `rev-list --count` = 1; rules/totality/never-a-gate present; five derivations with one source file each; ordering proof carries real git output and convention 4 states 5-in-3; commit touched only the three `files_modified` paths)

## Known Stubs

None. All three files are complete documents; no placeholder, TODO or unwired value was left behind. The one value the plan asked for and this commit cannot carry — the rules commit's own sha — is recorded in this SUMMARY and in `README.md` § *Ordering proof* fact three as a reproducible command, and is documented as a deviation above rather than left as a stub.

## Threat Flags

None. This plan creates no network endpoint, no auth path, no file-access pattern and no schema at a trust boundary. The three threats the plan's `<threat_model>` dispositions as `mitigate` are all discharged in the artifacts: `T-33-11` (repudiation) by the single-commit landing plus the banked ordering proof and the `rev-list --count` = 1 assertion; `T-33-12` (tampering after the first measurement) by the frozen-status paragraph, which names the specific failure mode ("a later plan that believes it is only resolving an ambiguity") and routes ambiguities to an `## ACCEPTED LIMIT` plus an explicit override; `T-33-13` (derivability) by the `## Totality` partition table.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Wave 1 is complete on this side.** `33-02` runs concurrently and writes nothing under `evidence/`, so it cannot disturb the proof.
- **Every measuring plan now has its contract.** `33-03`, `33-07`, `33-10` and `33-11` each have a declared source file, declared outcome-line names with fixed domains, a derivation rule they cannot renegotiate, and seven binding evidence conventions. `33-12` has the rule set to reproduce verbatim, the frontmatter key list, and the ordering assertion to re-run.
- **One thing is deliberately unwritten:** `R4`'s narrowing for `C0_CAPTURE_PAIR: fail`. It is authored at verdict time against the recorded cause, per `D-04`, and `33-12` must label it authored-at-verdict-time so a reader weighs it differently from a pre-commitment.
- **No blockers.** The rules are frozen from this commit forward; the next edit to `DECISION-RULE.md` after any measurement lands would break the only mechanism `GATE-01` has.

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*
