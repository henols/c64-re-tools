---
phase: 23-the-real-release-gate-go-degrade-no-go
plan: 01
subsystem: testing
tags: [pre-commitment, decision-rule, evidence-schema, git-ordering, dxa, ghidra, vice, proof-05]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "The first-match-wins <decision_rule> shape, the machine-readable verdict frontmatter, and the evidence-conventions block this plan copies structurally"
provides:
  - "A binding first-match-wins decision rule R1..R9 whose commit provably precedes every measurement commit in phase 23"
  - "The complete outcome-line vocabulary — 68 literal names with value domains and owning evidence files — fixed before any capture exists"
  - "The criterion-1 measurement definitions, window derivation rule and dxa flag set, fixed sight-unseen"
  - "The corpus.releases[] list schema with exactly one canonical: true, superseding the scalar phrasing in 23-RESEARCH.md and 23-VALIDATION.md"
  - "The three-disposition analyzer.rs audit vocabulary and the D-09 pre-mapped degrade narrowing for criteria 2 and 3"
  - "The ten evidence conventions, binding on every plan in phase 23, plus the banked two-fact ordering proof"
affects: [23-02, 23-03, 23-04, 23-05, 23-06, 23-07, 23-08, 23-09, 23-10, 23-11, phase-24, phase-25, phase-26]

actuals:
  tokens: 9081
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pre-committed first-match-wins decision rule, inputs read from literal outcome lines in named evidence files"
    - "Ordering proof banked as two independent git facts rather than one"
    - "Outcome-line vocabulary fixed before measurement, with final-occurrence-wins resolution"

key-files:
  created:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/DECISION-RULE.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/SCHEMA.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/README.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/.gitignore
  modified: []

key-decisions:
  - "Task 1 blocking-human checkpoint answered `proceed` by the operator — thresholds, criterion-1 measurement definitions and inventory provenance committed as specified, no value adjusted"
  - "R2's no-go requires both halves failing at once (c1_false_positives > 0 AND c1_data_recovery_pct < 50); a lone false-positive failure degrades via R4 rather than no-goes"
  - "corpus.releases[] promoted to a list with exactly one canonical: true, superseding the scalar corpus.file_sha256 / corpus.capture_sha256 phrasing in 23-RESEARCH.md Pattern 2 and 23-VALIDATION.md"
  - "Percentage outcome lines carry `<decimal> (<numerator>/<denominator>)`; the rule input is the leading decimal and the parenthesised raw byte counts are the precision contract's audit trail — this satisfies 'raw counts printed beside every percentage' without minting outcome-line names outside the fixed set"
  - "Ordering asserted over evidence/ only, never primacy over the phase directory, which already carries four pre-execution commits and is therefore unsatisfiable by construction"

patterns-established:
  - "Pre-commitment freeze: the rule, schema and measurement definitions may not be edited after the first measurement commit; an ambiguity is recorded as an ACCEPTED LIMIT in the measuring plan's own evidence file and overridden explicitly in the findings document"
  - "Two-fact ordering proof: the first commit under evidence/ IS the rule commit, AND no criterion*/inventory/capture path exists anywhere in history at that moment"
  - "not-exercised as a first-class value distinct from pass, with both R6 and R7 firing on it"

requirements-completed: [PROOF-05, PROOF-01, PROOF-02, PROOF-03, PROOF-04]

coverage:
  - id: D1
    description: "A first-match-wins decision rule R1..R9 exists in git, naming every input by a literal outcome line and a literal evidence file path, with R9 the only `go`"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "grep -qE '^- \\*\\*R9 → .go' evidence/DECISION-RULE.md; grep -c '^| `c[0-9]' == 7"
        status: pass
      - kind: other
        ref: "grep -cE '^- \\*\\*R[0-9] → ' evidence/DECISION-RULE.md == 9, exactly one bullet naming `go`"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every outcome-line name any later plan may emit is declared with its value domain and owning evidence file, including `not-exercised` as a value distinct from `pass` for C2_COMPUTED_DISPATCH and C3_BANK_DIVERGENCE, and the corpus.releases[] list schema with exactly one canonical"
    requirement: "PROOF-01"
    verification:
      - kind: other
        ref: "11-line presence loop (C0_CORPUS, C1_*, C2_COMPUTED_DISPATCH, C3_BANK_DIVERGENCE, C4_UNREPLACED_CAPABILITIES, INV_SOURCE, INV_WINDOW, PROV_HOLDOUT) + not-exercised + corpus.releases + canonical over evidence/SCHEMA.md"
        status: pass
      - kind: other
        ref: "dxa flag set verbatim: -g 0000, -p all-nmos6502, -d skip-scanning, -t detect-internal, -a dump, second -t detect-all invocation"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ten evidence conventions are published as a binding document later plans cite, and the corpus directory refuses every binary image form before an image can arrive"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "grep -cE '^[0-9]+\\. \\*\\*' evidence/README.md == 10; PROBE_DIR path present; git check-ignore -v proves *.d64 matches at corpus/.gitignore:13; root .gitignore untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ordering proof is banked as two independent git facts, so the findings document can cite it without a reader running git"
    requirement: "PROOF-05"
    verification:
      - kind: other
        ref: "git log --format=%H --reverse -- evidence | head -1 == git log --format=%H --reverse -- evidence/DECISION-RULE.md | head -1 (both 474c37c); git log --oneline -- 'evidence/criterion*' evidence/inventory evidence/capture prints nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The thresholds, criterion-1 measurement definitions and inventory provenance are the right ones to freeze sight-unseen"
    requirement: "PROOF-05"
    verification: []
    human_judgment: true
    rationale: "Whether 10.00 / 50.00 / 0 / 0 are the correct thresholds, and whether the dxa flag set and window rule capture the milestone's terms, cannot be proven by any check — the rule's own value depends on it being fixed before the evidence exists, so there is nothing to test it against. This was put to the operator at the Task 1 blocking-human gate and answered `proceed`; it is recorded here so the audit trail survives, not because it remains open."
  - id: D6
    description: "The repository's behaviour did not move — phase regression gate"
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && npm test — full suite, not test:automated"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 01: Pre-commit the Gate Summary

**A frozen first-match-wins rule R1..R9, a 68-name outcome-line vocabulary, the criterion-1 measurement definitions and the dxa flag set — all committed to git before a single byte of the corpus has been measured, with the ordering banked as two independent git facts.**

## Performance

- **Duration:** 9 min (execution after the Task 1 checkpoint was answered; the checkpoint itself was a human round trip)
- **Started:** 2026-08-26T09:59:21Z
- **Completed:** 2026-08-26T10:08:52Z
- **Tasks:** 3
- **Files modified:** 4 created, 0 modified

## Accomplishments

- **The gate is committed before it can be gamed.** `evidence/DECISION-RULE.md` carries a 7-input table, rules `R1`..`R9` evaluated in order with `R9` the only `go`, and its commit (`474c37c`) is provably the first commit anywhere under `evidence/`.
- **Every literal name a later plan may emit is fixed.** `evidence/SCHEMA.md` declares 68 outcome-line names across eight sections with their value domains and owning evidence files, so no measuring plan can invent a line name that flatters its own result.
- **`not-exercised` is earned, not assumed.** It is a declared value distinct from `pass` for both `C2_COMPUTED_DISPATCH` and `C3_BANK_DIVERGENCE`, and both `R6` and `R7` fire on it — no rule maps it to `go`.
- **The corpus is a list from the start.** `corpus.releases[]` with exactly one `canonical: true`, avoiding the canonical-image-centric model `recovery-schema.mjs` already exists in this codebase to prevent.
- **The measurement cannot be shaped after the fact.** The window derivation rule, the four-set `W`/`C`/`D`/`U` model, and the dxa flag set (`-g 0000 -p all-nmos6502 -d skip-scanning -t detect-internal -R … -B … -a dump`, plus a mandatory second `-t detect-all` run with both numbers printed) are all fixed sight-unseen.
- **Ordering banked as two facts, not one.** The first commit under `evidence/` IS the rule commit, *and* no `criterion*` / `inventory` / `capture` path exists anywhere in history at that moment.

## Task Commits

1. **Task 1: Confirm the one-way pre-commitment** — no commit (blocking-human decision checkpoint; outcome recorded below and in `DECISION-RULE.md`)
2. **Task 2: Write the binding decision rule and the outcome-line schema** — `474c37c` (docs)
3. **Task 3: Publish the evidence conventions and bank the ordering proof** — `edc527b` (docs)

**Plan metadata:** `3ef3045` (docs: complete plan) and `7cb72b2` (docs: log the npm-test evidence-file side effect as a deferred item — see `deferred-items.md`).

## Files Created/Modified

- `.planning/phases/23-…/evidence/DECISION-RULE.md` (183 lines) — the inputs table, `R1`..`R9`, the D-09 pre-mapped narrowing for R6/R7, four never-a-gate declarations, and the threshold-boundary / precision / hold-out-precedence contracts
- `.planning/phases/23-…/evidence/SCHEMA.md` (319 lines) — `corpus.releases[]`, findings frontmatter keys, 68 outcome lines, criterion-1 definitions, window derivation, dxa flag set, inventory schema, audit disposition vocabulary
- `.planning/phases/23-…/evidence/README.md` (116 lines) — the artifact index, the ten binding evidence conventions, the external-inputs note, and `## Ordering proof`
- `.planning/phases/23-…/evidence/corpus/.gitignore` (26 lines) — refuses `*.d64` `*.prg` `*.bin` `*.t64` `*.crt` `*.zip` `*.gz`, tracks `.gitignore` / `*.md` / `*.txt` / `*.json`

## Decisions Made

**Task 1 checkpoint (`blocking-human`) — operator selection recorded verbatim: `proceed`.**

> Proceed as specified. No adjustment to any threshold, flag or definition. `R2` stays as
> specified: `no-go` requires both halves failing at once (`c1_false_positives > 0` AND
> `c1_data_recovery_pct < 50`); a lone false-positive failure degrades rather than no-goes.

The three things that became irreversible at `474c37c`: the verdict thresholds (10.00 / 50.00 / 0 / 0 with an exact-at-threshold contract), the criterion-1 measurement definitions and dxa flag set, and the inventory provenance (`INV_SOURCE: vice-runtime-observation`, D-06). No shadow default was carried anywhere.

**Percentage value shape.** The precision contract requires raw numerator and denominator byte counts printed beside every percentage, but the plan's fixed outcome-line set contains no numerator name and forbids minting one. Resolved by declaring the value shape `<decimal> (<numerator>/<denominator>)`, with the rule input being the leading decimal. This satisfies the contract inside the fixed vocabulary rather than by extending it — which is the correct place to resolve such an ambiguity, since after the first measurement commit the schema is frozen.

**Ordering scoped to `evidence/`, never the phase directory.** The phase directory already carries the CONTEXT, RESEARCH, VALIDATION and PLAN commits made before execution began, so a primacy check against it can only ever name the context commit and is unsatisfiable by construction. Stated explicitly in `README.md` so a later plan does not write the unsatisfiable check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `SCHEMA.md` section count**

- **Found during:** Task 2
- **Issue:** The plan's action text says `SCHEMA.md` "has seven sections", then enumerates eight distinct ones (corpus release list, findings frontmatter keys, outcome lines, criterion-1 measurement definitions, window derivation rule, dxa flag set, inventory schema, audit disposition vocabulary).
- **Fix:** Wrote all eight enumerated sections. The enumeration is the substantive instruction and the count is a miscount; dropping or merging a section to reach seven would have removed pre-commitment content that later plans depend on.
- **Files modified:** `evidence/SCHEMA.md`
- **Verification:** All eleven required outcome-line names, both value domains, `corpus.releases`, `canonical` and the full dxa flag set present; 319 lines against a 120-line floor.
- **Committed in:** `474c37c`

**2. [Rule 3 - Blocking] Task 2's `<verify>` block is not runnable as written**

- **Found during:** Task 2
- **Issue:** The automated verify embeds a backtick inside a double-quoted `bash -c` string (`grep -c "^| \`c[0-9]"`), which bash parses as command substitution rather than a literal backtick, and the second Task 3 `grep -qx -- '*.d64'` form errors under this host's `ugrep` shim.
- **Fix:** Ran each check's *intent* with correct quoting — single-quoted patterns for the backtick case, `grep -qxF` for the fixed-string case, plus `git check-ignore -v` as an independent proof that the ignore rule actually matches. Every check passed on its intent; nothing was skipped.
- **Files modified:** none (verification-harness issue, not a content issue)
- **Verification:** inputs-table row count = 7 (satisfies the `[7-9]|[0-9]{2}` assertion); `git check-ignore -v` reports `corpus/.gitignore:13:*.d64` matching.
- **Committed in:** n/a — no content change

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Neither changed scope. One recovered enumerated content the plan's own count under-stated; the other worked around two unrunnable shell quotings in the verify blocks without weakening what they assert. No scope creep, no measurement taken.

## Issues Encountered

**The Task 1 checkpoint was surfaced rather than auto-approved.** `workflow.auto_advance` and `workflow._auto_chain_active` are both `false`, and the task carries `gate="blocking-human"`, which is never auto-approved in any mode. The operator's standing "you decide" preference was weighed and set aside: that preference explicitly reserves human input for one-way decisions and scope cuts, and this task carries a `one-way` reversibility rating written by the operator's own planner. A specific, recent, deliberate `blocking-human` marking beats a general autonomy preference. The checkpoint was answered `proceed` and execution resumed with zero partial state (no commits had been made).

**Regression gate run twice, both green.** Full `cd src/mcp/vice && npm test` (not `test:automated`, which skips `MANUAL_ONLY_TESTS` and hides CI failures) after each task commit: 2593 pass, 0 fail, 40 skipped, 5 todo, ~105s.

## Known Stubs

None. The `*(not written yet — 23-NN)*` markers in `README.md`'s artifact index are forward references to artifacts later plans produce by design, each naming the owning plan; they are not stubbed implementations.

## Threat Flags

None. This plan creates no network endpoint, no auth path, no file-access pattern and no schema at a trust boundary. `T-23-05` (repudiation of the rule/measurement ordering) and `T-23-08` (tampering with the pre-committed thresholds) are both mitigated as planned — the ordering is banked as two git facts and the thresholds are numeric with an exact-at-threshold contract. `T-23-06` (corpus disclosure) is mitigated before any image can arrive.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Wave 2 is unblocked.** 23-02 (dxa/Ghidra provisioning, the tracer), 23-03 (corpus intake and capture) and 23-04 (the `analyzer.rs` audit) all declare `depends_on: [23-01]` and can now read a frozen `SCHEMA.md` for every line name they must emit.

**Binding on every subsequent plan in this phase:**

- `evidence/DECISION-RULE.md` and `evidence/SCHEMA.md` are **frozen**. An ambiguity is recorded as an `## ACCEPTED LIMIT` in the measuring plan's own evidence file and overridden explicitly in the findings document. The rule text does not move.
- The next commit that creates any path under `evidence/criterion*`, `evidence/inventory` or `evidence/capture` permanently ends the state the ordering proof describes. That is expected and correct — the proof is already banked.
- Every rule input must exist in its named file carrying a declared value. A measurement that could not be completed writes `could-not-run`; an absent line is not a pass.

**No blockers.** The corpus itself remains operator-supplied (D-04) and is 23-03's precondition, not this plan's.

## Self-Check: PASSED

- All four created files verified present on disk with `[ -f ]`.
- Both commit hashes (`474c37c`, `edc527b`) verified present in `git log --oneline --all`.
- All three `min_lines` floors cleared: DECISION-RULE.md 183/90, SCHEMA.md 319/120, README.md 116/30.
- Plan-level `<verification>` block re-run post-commit: ordering identity PASS, no-measurement-evidence PASS, both docs committed, no `criterion*` file exists, `git diff --name-only 5f4f9b9..HEAD` touches only `.planning/`, nothing under `src/`.
- Full `npm test` green.

---
*Phase: 23-the-real-release-gate-go-degrade-no-go*
*Completed: 2026-08-26*
