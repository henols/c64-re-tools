# Phase 23 — The binding decision rule (PROOF-05)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files, **never from a summary's paraphrase**, then
evaluate the rules **in order** and take the first that matches. Record which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof; see `README.md` § *Ordering proof*.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands — including by a later plan that
believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
records it as an `## ACCEPTED LIMIT` in its own evidence file and the findings document
records an explicit override. The rule text itself does not move.

**Decision checkpoint.** The thresholds, the criterion-1 measurement definitions and the
inventory provenance below were confirmed by the operator at 23-01 Task 1 (a
`blocking-human` gate) with the selection **`proceed`** — as specified, no value adjusted.

---

## Inputs

Each input is read from one literal outcome line at column 0 of one named evidence file.
Paths are relative to `.planning/phases/23-the-real-release-gate-go-degrade-no-go/`.
Where a line is written more than once in a file, **the final occurrence wins**.

| Input | Source line | Source file |
|---|---|---|
| `c0_corpus` | `C0_CORPUS:` | `evidence/capture/CAPTURE-SUMMARY.txt` |
| `c1_adjudicated_fraction` | `C1_ADJUDICATED_FRACTION:` | `evidence/criterion1-dxa-classification.txt` |
| `c1_data_recovery_pct` | `C1_DATA_RECOVERY_PCT:` | `evidence/criterion1-dxa-classification.txt` |
| `c1_false_positives` | `C1_FALSE_POSITIVES:` | `evidence/criterion1-dxa-classification.txt` |
| `c2_computed_dispatch` | `C2_COMPUTED_DISPATCH:` | `evidence/criterion2-ghidra-dispatch.txt` |
| `c3_bank_divergence` | `C3_BANK_DIVERGENCE:` | `evidence/criterion3-bank-divergence.txt` |
| `c4_unreplaced` | `C4_UNREPLACED_CAPABILITIES:` | `evidence/criterion4-analyzer-audit.md` |

Every input named above **must exist** in its named file carrying one of the values
`SCHEMA.md` declares for it. A measurement that could not be completed writes
`could-not-run` rather than leaving the line absent. An absent line is not a pass, not a
`not-exercised`, and not a defensible state — it is an incomplete phase.

---

## Rules, first match wins

- **R1 → `no-go`.** `c0_corpus` is not `pass`. Every criterion except 4 is measured on
  the depacked capture (D-03). Without a real release and a capture proven equivalent
  across two runs, the phase would be measuring another self-authored fixture — the exact
  defect `PROOF-01` exists to remove. The milestone becomes: secure a corpus first, or
  re-scope v0.6.0 to a claim explicitly qualified as fixture-only.

- **R2 → `no-go`.** `c1_false_positives > 0` **and** `c1_data_recovery_pct < 50`. Both
  halves of dxa's error budget failed at once: it types certain-code bytes as data
  (poisoning discovery) *and* recovers less than half the certain data. Ghidra produced
  0 functions and 0 code bytes with no map on the pivot fixture, so dxa's map is not an
  optimisation but the thing that makes Ghidra work at all; wrong in both directions means
  `DXA-01..03` and `GHID-01..05` are not the phases they were scoped as.

- **R3 → `degrade`.** `c1_adjudicated_fraction < 10`. Below one tenth of the declared
  window, `C1_DATA_RECOVERY_PCT` is a statement about a sliver and `PROOF-01`'s
  "re-measured against real cracked releases" is not honestly claimable at full strength.
  Narrowing authored at verdict time against the evidence — criterion 1 is not pre-mapped,
  per D-09.

- **R4 → `degrade`.** `c1_false_positives > 0`. dxa typed at least one byte the CPU was
  observed executing as data. Narrowing authored at verdict time against the evidence.

- **R5 → `degrade`.** `c1_data_recovery_pct < 50`. The false-negative direction — data
  called code — is the dangerous one on the pivot's own record, and it feeds phantom code
  into every downstream stage. Narrowing authored at verdict time; `AUTO-07`'s
  graphics-feedback containment and `DXA-03`'s known-data exclusion are the obvious
  candidates and are named as such **without being pre-bound**.

- **R6 → `degrade`.** `c2_computed_dispatch` is not `resolved` — that is, `unresolved`,
  `not-exercised`, or `could-not-run`.

  **Pre-mapped narrowing (D-09).** `AUTO-04` and `AUTO-05` narrow to decline-to-annotate at
  every dispatch site whose index is not a compile-time constant: the join emits **no**
  target annotation there rather than a confident wrong one. `GHID-04`'s "at least one
  resolved computed jump" acceptance is qualified to "resolved where the dispatch index is
  a compile-time constant, recorded as a declared unresolved otherwise". On `not-exercised`
  the same narrowing applies but is recorded as **unproven either way** rather than as a
  demonstrated failure — the corpus did not exercise the construct, which is a fact about
  the corpus, not about Ghidra.

- **R7 → `degrade`.** `c3_bank_divergence` is not `found` — that is, `not-exercised` or
  `could-not-run`.

  **Pre-mapped narrowing (D-09).** `AUTO-04`'s per-program-point bank carry ships
  unvalidated against real path-dependent code, so its acceptance is qualified to
  single-`$01`-value access sites only. `AUTO-05`'s decline rule may be acceptance-tested
  against a synthetic path-dependent fixture with the corpus gap recorded beside it. Phase
  26's third selection rule is marked unvalidated in the ROADMAP.

  **Note the asymmetry deliberately: `found` does *not* fire this rule.** A divergence that
  is found is the criterion answered affirmatively and is consistent with the milestone as
  already scoped — Phase 26 is already required to decline where bank state is
  path-dependent. It is the *absence* of a demonstrated break point that leaves the model
  unvalidated, not its presence.

- **R8 → `degrade`.** `c4_unreplaced > 0`. At least one `analyzer.rs` capability carries
  the `lost-blocking:` disposition. Narrowing authored at verdict time, naming each
  blocking capability and which Phase 25 requirement absorbs it.

- **R9 → `go`.** Everything above passed.

---

## Inputs that never change the verdict

Four recorded values are **measurements, not gates**. Stated explicitly, in the Phase 9
manner, so a later reader cannot mistake their absence — or an unflattering value in one of
them — for a failure. None of them appears in any rule above, and none may be added to one.

- **`C1_FALSE_NEGATIVES` never changes the verdict.** It is arithmetically derived from
  `C1_DATA_RECOVERY_PCT` and the same denominator, so gating on it would double-count R5.

- **`C1_CODE_DATA_OVERLAP` never changes the verdict.** Self-modifying code and jump tables
  legitimately produce bytes that are both executed and DMA-fetched, so an overlap is a
  finding — reported by count and excluded from both ratios — and not an error.

- **`C3_DIVERGENT_SITES` never changes the verdict.** No threshold on *how much* divergence
  is defensible can be defended before the measurement exists, and inventing one here would
  be the planner making a scope decision it has no authority to make.

- **`C4_LOST_ACCEPTED` never changes the verdict.** A capability accepted as lost with its
  cost stated is a decision, not a defect; only the `lost-blocking:` count gates, via R8.

---

## Threshold boundary contract

One line per numeric comparison, stating what happens exactly at the threshold and one step
either side. There is no ambiguity to resolve later.

- `c1_adjudicated_fraction` of exactly `10.00` does **not** fire R3. `9.99` does. `10.01` does not.
- `c1_data_recovery_pct` of exactly `50.00` does **not** fire R2 or R5. `49.99` does. `50.01` does not.
- `c1_false_positives` of exactly `0` does **not** fire R2 or R4. `1` does.
- `c4_unreplaced` of exactly `0` does **not** fire R8. `1` does.

R2 requires **both** of its halves. `c1_false_positives = 1` with
`c1_data_recovery_pct = 50.00` does not fire R2; it falls through to R4 and degrades.

---

## Precision contract

- Every percentage is computed as an **exact integer ratio of byte counts**.
- The rule is evaluated against the **unrounded** ratio. A value that rounds to `50.00` from
  below (e.g. `49.999…`) fires R5; rounding is a display concern and never a rule input.
- The **displayed** value is rounded **half-up to two decimal places**.
- The raw **numerator and denominator byte counts** are printed on their own outcome lines
  beside every percentage, so a reader recomputes rather than trusts.

---

## Hold-out precedence contract

`C1_DATA_RECOVERY_PCT` and `C1_FALSE_POSITIVES` are the **cracker-held-out** numbers for
the canonical release, and they are the only criterion-1 rule inputs.

- `C1_DATA_RECOVERY_PCT_WITH_CRACKER` and `C1_FALSE_POSITIVES_WITH_CRACKER` are printed
  beside them and **never gate**. The difference between the two is itself evidence about
  how far a naive measurement would have been distorted.
- If the provenance diff cannot produce a hold-out — `PROV_HOLDOUT: unavailable`, e.g. the
  anchors disagree so there is no single offset — then `C1_CRACKER_HELD_OUT: no` is written,
  the all-resident-bytes number becomes the rule input, and that substitution is recorded as
  an `## ACCEPTED LIMIT` in the criterion-1 evidence file.
- The **secondary** release's numbers live in their own evidence file and never gate.

---

## Ordering

This document's commit precedes every measurement commit in this phase. `git log` is the
proof and it is checkable by anyone. **No test guard is added** (D-08): a guard would encode
roadmap policy in a suite belonging to a phase that ships no code, and the likeliest outcome
— `degrade`, meaning "proceed, narrowed" — is precisely the case such a guard cannot check.

The ordering proof is banked as two facts in `README.md` § *Ordering proof*: that the first
commit anywhere under `evidence/` is the commit introducing this file, and that no
`criterion*`, `inventory` or `capture` path exists anywhere in history at that moment.
