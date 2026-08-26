---
phase: 23-the-real-release-gate-go-degrade-no-go
requirement: [PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05]
probe_date: 2026-08-26
verdict: no-go
verdict_rule_applied: R1
corpus:
  releases:
    - release: "danish"
      file_sha256: "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5"
      capture_sha256: "could-not-run"
      canonical: true
    - release: "saeger"
      file_sha256: "b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5"
      capture_sha256: "could-not-run"
      canonical: false
tools:
  dxa: "0.1.5, tarball sha256 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799, built-binary sha256 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523"
  ghidra: "12.1.3 PUBLIC, build 2026-Aug-17"
  vice: "fork 3.10"
criteria:
  # R1's only input. Transcribed from evidence/capture/CAPTURE-SUMMARY.txt.
  c0_corpus: partial
  # The six inputs below were NEVER EVALUATED: R1 is the first rule under
  # first-match-wins and it matched, so the derivation stopped there. Five of
  # them have no evidence file at all, because plans 23-05..23-09 were not
  # dispatched -- each reads the depacked flat-64K capture as its substrate
  # (D-03) and 23-03 could not produce one. `could-not-run` is written rather
  # than the key being left absent, per DECISION-RULE.md section Inputs.
  # See "## Inputs that were never evaluated, and why that cannot flatter the
  # verdict" in the body.
  c1_adjudicated_fraction: could-not-run   # no evidence file; 23-05/23-07 not dispatched
  c1_data_recovery_pct: could-not-run      # no evidence file; 23-07 not dispatched
  c1_false_positives: could-not-run        # no evidence file; 23-07 not dispatched
  c2_computed_dispatch: could-not-run      # no evidence file; 23-08 not dispatched
  c3_bank_divergence: could-not-run        # no evidence file; 23-09 not dispatched
  # Criterion 4 ran offline against crate source and needs no capture, so this
  # one IS measured. Transcribed from evidence/criterion4-analyzer-audit.md.
  c4_unreplaced: 0
---

This document carries YAML frontmatter, unlike `docs/phase1-probe-results.md` and
`docs/phase2-backend-probe-evidence.md`, both of which have none — the departure is
deliberate: criterion 5 requires a machine-readable `go` / `degrade` / `no-go` verdict that
Phase 24's planner reads as a gate, and a prose sentence buried in the body is not that.
The precedent is `docs/phase9-regenerator2000-probe-findings.md`, which took the same
departure for the same reason.

Every value in this document is transcribed from an outcome line at column 0 of a named
evidence file, cited by path relative to
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/`. Where a line appears more
than once in one file, the final occurrence is the one taken, per that directory's
`README.md` § *Evidence conventions* 7. Nothing here is written from memory and nothing is
taken from a plan SUMMARY's paraphrase.

## Verdict

**`no-go` — rule `R1` fired.**

**The input that fired it.** `c0_corpus = partial`, transcribed from
`evidence/capture/CAPTURE-SUMMARY.txt`, where the line reads exactly:

```
C0_CORPUS: partial
```

`R1` fires on "`c0_corpus` is not `pass`". `SCHEMA.md` § 3 declares that line's domain as
`pass | partial | could-not-run`. `partial` is not `pass`, so `R1`'s condition is true.

**Why every earlier rule did not fire: there is no earlier rule.** `R1` is the *first*
rule in `DECISION-RULE.md`'s first-match-wins order. This is the whole of the
re-derivation, and it is stated this plainly on purpose — a walk through `R2`..`R9`
explaining why each did not fire would be manufactured, because under first-match-wins no
later rule is ever reached once `R1` matches. A reader re-derives the verdict by doing
exactly two things: reading `C0_CORPUS:` out of `evidence/capture/CAPTURE-SUMMARY.txt`, and
observing that `R1` is listed first in the reproduced rule below. No judgement enters at
any step, so re-running the derivation over the same evidence yields the same verdict and
the same fired rule.

**Threshold boundaries.** `R1` carries no numeric threshold; it is an equality test against
an enumerated domain, so the threshold boundary contract has nothing to resolve here. The
one numeric-threshold input that *does* carry a recorded value is `c4_unreplaced = 0`
(`evidence/criterion4-analyzer-audit.md`), and the contract states that exactly `0` does
**not** fire `R8` — so had evaluation ever reached `R8`, it would not have fired. That is
recorded for completeness, not as part of the derivation: evaluation stopped at `R1`.

**No override was taken.** The escape hatch `DECISION-RULE.md` provides — a loud
`### Override` subsection naming what was departed from and why — was considered and is not
used, because no outcome value fits the rule badly. `partial` is a value the rule's own
domain declares and `R1`'s condition names it unambiguously. The rule was not edited,
reinterpreted or re-scoped. There is therefore no `### Override` section in this document,
and its absence is a statement rather than an omission.

### What the milestone becomes instead

`R1` names the consequence in its own text, and it is reproduced here rather than
re-authored:

> The milestone becomes: secure a corpus first, or re-scope v0.6.0 to a claim explicitly
> qualified as fixture-only.

That is the whole of the pre-committed narrowing for this verdict. This document does not
extend it. Specifically, and per this plan's own prohibitions, no Phase 24, 25 or 26 plan is
written, amended or pre-empted here: the verdict records what the milestone becomes; it does
not plan the becoming.

Two facts bear directly on which of `R1`'s two branches is cheaper, and both are recorded in
`## Other findings (carried forward, not scored)` below rather than here, because neither
changed this verdict: the hex-transcription half of 23-03's blocker is **solved** with a
validated method, and the frame-exactness half is **unsolved** and is the single remaining
obstacle between this phase and a real measurement.

## Inputs that were never evaluated, and why that cannot flatter the verdict

`DECISION-RULE.md` § *Inputs* is emphatic that an absent line "is not a pass, not a
`not-exercised`, and not a defensible state — it is an incomplete phase". That sentence
exists so a gap can never be read as favourable. It is honoured here in full, and the
situation it guards against does not arise, for a structural reason worth stating precisely:

**`R1` is the first rule and it matched on the first input.** Under first-match-wins the
derivation reads `c0_corpus` and stops. The six remaining inputs are never read, so no value
they might have carried — favourable, unfavourable or absent — could change the fired rule
or the verdict. The gap cannot flatter the verdict because the verdict does not depend on it.

**Why five of them have no evidence file at all.** Plans 23-05, 23-06, 23-07, 23-08 and
23-09 were **deliberately not dispatched, by explicit operator decision**. Every one of them
reads the depacked flat-64K capture as its substrate (D-03), and 23-03 could not produce
one. Running them against the self-authored 279-byte fixture instead is the exact defect
`PROOF-01` exists to remove, so they were skipped rather than run on a substitute substrate.
This is a recorded decision, not an omission and not a failure. Their criteria are
`could-not-run`, and this paragraph is the reason.

| Rule input | Declared source file | State | Why |
|---|---|---|---|
| `c0_corpus` | `evidence/capture/CAPTURE-SUMMARY.txt` | `partial` — **measured** | 23-03 ran; corpus secured, capture equivalence disproven |
| `c1_adjudicated_fraction` | `evidence/criterion1-dxa-classification.txt` | `could-not-run` — no file exists | 23-05 (inventory) and 23-07 not dispatched: no depacked capture (D-03) |
| `c1_data_recovery_pct` | `evidence/criterion1-dxa-classification.txt` | `could-not-run` — no file exists | 23-07 not dispatched: no depacked capture (D-03) |
| `c1_false_positives` | `evidence/criterion1-dxa-classification.txt` | `could-not-run` — no file exists | 23-07 not dispatched: no depacked capture (D-03) |
| `c2_computed_dispatch` | `evidence/criterion2-ghidra-dispatch.txt` | `could-not-run` — no file exists | 23-08 not dispatched: no depacked capture (D-03) |
| `c3_bank_divergence` | `evidence/criterion3-bank-divergence.txt` | `could-not-run` — no file exists | 23-09 not dispatched: no depacked capture (D-03) |
| `c4_unreplaced` | `evidence/criterion4-analyzer-audit.md` | `0` — **measured** | 23-04 ran offline against crate source; needs no capture |

`could-not-run` is written rather than the key being left absent, per `DECISION-RULE.md`
§ *Inputs*. A `could-not-run` here is **not** `not-exercised` and is nowhere folded into a
pass count: `not-exercised` is a claim about the corpus, earned only by a pre-committed
inventory showing a construct absent, and no such inventory exists because 23-05 was not
dispatched. Nothing in this document may be read as saying criteria 1, 2 or 3 passed,
degraded gracefully, or were shown inapplicable. They were not run.

## The decision rule, reproduced verbatim

Reproduced in full from `evidence/DECISION-RULE.md`, so this document is self-contained and
does not depend on a plan file surviving. The never-a-gate declarations are included
deliberately: a later reader must not mistake `C4_LOST_ACCEPTED: 3` for three failures, nor
a large `C3_DIVERGENT_SITES` for a defect. Compare this blockquote against
`evidence/DECISION-RULE.md` in git if you suspect it has drifted — that comparison is the
tamper check, and it is why the rule is reproduced rather than cited.

> # Phase 23 — The binding decision rule (PROOF-05)
>
> **Binding. Stated here, before the run, so the verdict is derived and not judged.**
> Read the inputs from the evidence files, **never from a summary's paraphrase**, then
> evaluate the rules **in order** and take the first that matches. Record which rule fired.
>
> This document's commit precedes every measurement commit in this phase. `git log` is the
> proof; see `README.md` § *Ordering proof*.
>
> **Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
> or "clarified" after the first measurement commit lands — including by a later plan that
> believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
> records it as an `## ACCEPTED LIMIT` in its own evidence file and the findings document
> records an explicit override. The rule text itself does not move.
>
> **Decision checkpoint.** The thresholds, the criterion-1 measurement definitions and the
> inventory provenance below were confirmed by the operator at 23-01 Task 1 (a
> `blocking-human` gate) with the selection **`proceed`** — as specified, no value adjusted.
>
> ---
>
> ## Inputs
>
> Each input is read from one literal outcome line at column 0 of one named evidence file.
> Paths are relative to `.planning/phases/23-the-real-release-gate-go-degrade-no-go/`.
> Where a line is written more than once in a file, **the final occurrence wins**.
>
> | Input | Source line | Source file |
> |---|---|---|
> | `c0_corpus` | `C0_CORPUS:` | `evidence/capture/CAPTURE-SUMMARY.txt` |
> | `c1_adjudicated_fraction` | `C1_ADJUDICATED_FRACTION:` | `evidence/criterion1-dxa-classification.txt` |
> | `c1_data_recovery_pct` | `C1_DATA_RECOVERY_PCT:` | `evidence/criterion1-dxa-classification.txt` |
> | `c1_false_positives` | `C1_FALSE_POSITIVES:` | `evidence/criterion1-dxa-classification.txt` |
> | `c2_computed_dispatch` | `C2_COMPUTED_DISPATCH:` | `evidence/criterion2-ghidra-dispatch.txt` |
> | `c3_bank_divergence` | `C3_BANK_DIVERGENCE:` | `evidence/criterion3-bank-divergence.txt` |
> | `c4_unreplaced` | `C4_UNREPLACED_CAPABILITIES:` | `evidence/criterion4-analyzer-audit.md` |
>
> Every input named above **must exist** in its named file carrying one of the values
> `SCHEMA.md` declares for it. A measurement that could not be completed writes
> `could-not-run` rather than leaving the line absent. An absent line is not a pass, not a
> `not-exercised`, and not a defensible state — it is an incomplete phase.
>
> ---
>
> ## Rules, first match wins
>
> - **R1 → `no-go`.** `c0_corpus` is not `pass`. Every criterion except 4 is measured on
>   the depacked capture (D-03). Without a real release and a capture proven equivalent
>   across two runs, the phase would be measuring another self-authored fixture — the exact
>   defect `PROOF-01` exists to remove. The milestone becomes: secure a corpus first, or
>   re-scope v0.6.0 to a claim explicitly qualified as fixture-only.
>
> - **R2 → `no-go`.** `c1_false_positives > 0` **and** `c1_data_recovery_pct < 50`. Both
>   halves of dxa's error budget failed at once: it types certain-code bytes as data
>   (poisoning discovery) *and* recovers less than half the certain data. Ghidra produced
>   0 functions and 0 code bytes with no map on the pivot fixture, so dxa's map is not an
>   optimisation but the thing that makes Ghidra work at all; wrong in both directions means
>   `DXA-01..03` and `GHID-01..05` are not the phases they were scoped as.
>
> - **R3 → `degrade`.** `c1_adjudicated_fraction < 10`. Below one tenth of the declared
>   window, `C1_DATA_RECOVERY_PCT` is a statement about a sliver and `PROOF-01`'s
>   "re-measured against real cracked releases" is not honestly claimable at full strength.
>   Narrowing authored at verdict time against the evidence — criterion 1 is not pre-mapped,
>   per D-09.
>
> - **R4 → `degrade`.** `c1_false_positives > 0`. dxa typed at least one byte the CPU was
>   observed executing as data. Narrowing authored at verdict time against the evidence.
>
> - **R5 → `degrade`.** `c1_data_recovery_pct < 50`. The false-negative direction — data
>   called code — is the dangerous one on the pivot's own record, and it feeds phantom code
>   into every downstream stage. Narrowing authored at verdict time; `AUTO-07`'s
>   graphics-feedback containment and `DXA-03`'s known-data exclusion are the obvious
>   candidates and are named as such **without being pre-bound**.
>
> - **R6 → `degrade`.** `c2_computed_dispatch` is not `resolved` — that is, `unresolved`,
>   `not-exercised`, or `could-not-run`.
>
>   **Pre-mapped narrowing (D-09).** `AUTO-04` and `AUTO-05` narrow to decline-to-annotate at
>   every dispatch site whose index is not a compile-time constant: the join emits **no**
>   target annotation there rather than a confident wrong one. `GHID-04`'s "at least one
>   resolved computed jump" acceptance is qualified to "resolved where the dispatch index is
>   a compile-time constant, recorded as a declared unresolved otherwise". On `not-exercised`
>   the same narrowing applies but is recorded as **unproven either way** rather than as a
>   demonstrated failure — the corpus did not exercise the construct, which is a fact about
>   the corpus, not about Ghidra.
>
> - **R7 → `degrade`.** `c3_bank_divergence` is not `found` — that is, `not-exercised` or
>   `could-not-run`.
>
>   **Pre-mapped narrowing (D-09).** `AUTO-04`'s per-program-point bank carry ships
>   unvalidated against real path-dependent code, so its acceptance is qualified to
>   single-`$01`-value access sites only. `AUTO-05`'s decline rule may be acceptance-tested
>   against a synthetic path-dependent fixture with the corpus gap recorded beside it. Phase
>   26's third selection rule is marked unvalidated in the ROADMAP.
>
>   **Note the asymmetry deliberately: `found` does *not* fire this rule.** A divergence that
>   is found is the criterion answered affirmatively and is consistent with the milestone as
>   already scoped — Phase 26 is already required to decline where bank state is
>   path-dependent. It is the *absence* of a demonstrated break point that leaves the model
>   unvalidated, not its presence.
>
> - **R8 → `degrade`.** `c4_unreplaced > 0`. At least one `analyzer.rs` capability carries
>   the `lost-blocking:` disposition. Narrowing authored at verdict time, naming each
>   blocking capability and which Phase 25 requirement absorbs it.
>
> - **R9 → `go`.** Everything above passed.
>
> ---
>
> ## Inputs that never change the verdict
>
> Four recorded values are **measurements, not gates**. Stated explicitly, in the Phase 9
> manner, so a later reader cannot mistake their absence — or an unflattering value in one of
> them — for a failure. None of them appears in any rule above, and none may be added to one.
>
> - **`C1_FALSE_NEGATIVES` never changes the verdict.** It is arithmetically derived from
>   `C1_DATA_RECOVERY_PCT` and the same denominator, so gating on it would double-count R5.
>
> - **`C1_CODE_DATA_OVERLAP` never changes the verdict.** Self-modifying code and jump tables
>   legitimately produce bytes that are both executed and DMA-fetched, so an overlap is a
>   finding — reported by count and excluded from both ratios — and not an error.
>
> - **`C3_DIVERGENT_SITES` never changes the verdict.** No threshold on *how much* divergence
>   is defensible can be defended before the measurement exists, and inventing one here would
>   be the planner making a scope decision it has no authority to make.
>
> - **`C4_LOST_ACCEPTED` never changes the verdict.** A capability accepted as lost with its
>   cost stated is a decision, not a defect; only the `lost-blocking:` count gates, via R8.
>
> ---
>
> ## Threshold boundary contract
>
> One line per numeric comparison, stating what happens exactly at the threshold and one step
> either side. There is no ambiguity to resolve later.
>
> - `c1_adjudicated_fraction` of exactly `10.00` does **not** fire R3. `9.99` does. `10.01` does not.
> - `c1_data_recovery_pct` of exactly `50.00` does **not** fire R2 or R5. `49.99` does. `50.01` does not.
> - `c1_false_positives` of exactly `0` does **not** fire R2 or R4. `1` does.
> - `c4_unreplaced` of exactly `0` does **not** fire R8. `1` does.
>
> R2 requires **both** of its halves. `c1_false_positives = 1` with
> `c1_data_recovery_pct = 50.00` does not fire R2; it falls through to R4 and degrades.
>
> ---
>
> ## Precision contract
>
> - Every percentage is computed as an **exact integer ratio of byte counts**.
> - The rule is evaluated against the **unrounded** ratio. A value that rounds to `50.00` from
>   below (e.g. `49.999…`) fires R5; rounding is a display concern and never a rule input.
> - The **displayed** value is rounded **half-up to two decimal places**.
> - The raw **numerator and denominator byte counts** are printed on their own outcome lines
>   beside every percentage, so a reader recomputes rather than trusts.
>
> ---
>
> ## Hold-out precedence contract
>
> `C1_DATA_RECOVERY_PCT` and `C1_FALSE_POSITIVES` are the **cracker-held-out** numbers for
> the canonical release, and they are the only criterion-1 rule inputs.
>
> - `C1_DATA_RECOVERY_PCT_WITH_CRACKER` and `C1_FALSE_POSITIVES_WITH_CRACKER` are printed
>   beside them and **never gate**. The difference between the two is itself evidence about
>   how far a naive measurement would have been distorted.
> - If the provenance diff cannot produce a hold-out — `PROV_HOLDOUT: unavailable`, e.g. the
>   anchors disagree so there is no single offset — then `C1_CRACKER_HELD_OUT: no` is written,
>   the all-resident-bytes number becomes the rule input, and that substitution is recorded as
>   an `## ACCEPTED LIMIT` in the criterion-1 evidence file.
> - The **secondary** release's numbers live in their own evidence file and never gate.
>
> ---
>
> ## Ordering
>
> This document's commit precedes every measurement commit in this phase. `git log` is the
> proof and it is checkable by anyone. **No test guard is added** (D-08): a guard would encode
> roadmap policy in a suite belonging to a phase that ships no code, and the likeliest outcome
> — `degrade`, meaning "proceed, narrowed" — is precisely the case such a guard cannot check.
>
> The ordering proof is banked as two facts in `README.md` § *Ordering proof*: that the first
> commit anywhere under `evidence/` is the commit introducing this file, and that no
> `criterion*`, `inventory` or `capture` path exists anywhere in history at that moment.

## Run date, corpus and builds tested

**Probe date:** 2026-08-26.

**Corpus.** Two independently-cracked releases of one title — Bruce Lee (Datasoft, 1984) —
supplied by the operator under D-04 and **never committed**. Identity is release name plus
sha256; the images live outside this repository and their paths are deliberately absent from
this document. Transcribed from `evidence/corpus/corpus-intake.txt` and reproduced in
`evidence/capture/CAPTURE-SUMMARY.txt`.

| Release | `file_sha256` | `capture_sha256` | Canonical |
|---|---|---|---|
| `danish` | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` | `could-not-run` | **yes** |
| `saeger` | `b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5` | `could-not-run` | no |

`CORPUS_RELEASES: 2`, `CORPUS_CANONICAL: danish`. The canonical designation was produced by a
rule stated *before* any measurement of these images existed — the release whose sha256 is
lexicographically smaller is canonical, and `1a9d29…` < `b45e53…` — so the choice cannot have
been influenced by a result (`evidence/corpus/corpus-intake.txt` § *Canonical designation*).
The operator directed explicitly that no CSDb id and no group attribution be invented; the
on-disk strings `(DC)` and `XIDEX` are recorded in the intake transcript as the literal
strings they are and are not expanded here. `INDEPENDENCE: no-shared-ancestor-indicator-found`
is recorded in that same file as a corpus fact; it is not a declared schema name and it gates
nothing.

**Both `capture_sha256` values are `could-not-run`, and no 64-hex capture hash exists.**
`SCHEMA.md` § 1 types that key as 64 hex. No such value can be written without fabricating
it, so `could-not-run` is written instead, per `DECISION-RULE.md` § *Inputs*. This is
recorded as this document's own limit under `## Accepted limits`.

**Instruments.** Transcribed from `evidence/tools/TOOLS.txt`, whose values agree line for
line with the transcripts in `evidence/tools/instrument-provenance.txt` and
`evidence/fixture/fixture-baseline.txt`.

| Instrument | Recorded value |
|---|---|
| dxa version | `0.1.5` |
| dxa tarball sha256 | `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799` (`DXA_TARBALL_SHA256_VERIFIED: yes`) |
| dxa built-binary sha256 | `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` |
| Ghidra | `12.1.3 PUBLIC`, build `2026-Aug-17` |
| Java | `openjdk 21.0.12.1 2026-08-18` (Debian build `21.0.12.1+1-1-deb13u1`) |
| VICE backend | `fork 3.10` |

The dxa tarball sha256 appears verbatim above so `DXA-01` in Phase 24 can vendor the same
build. **Ghidra is recorded by version and build date only, never by install path** — the
probe install's own README states it is safe to delete and that nothing in the repository
depends on that path, so recording its location would create a dependency the install itself
disclaims (`evidence/README.md` § *External inputs*).

**Why the fork backend was the measurement instrument.** The capture route needs a stopping
execution checkpoint, direct memory reads at a paused instant, and — for the `danish`
release — direct keyboard-matrix injection to pass an intro gate that polls `$DC01` rather
than going through KERNAL `GETIN`; `vice_keyboard_matrix` is fork-only, so the stock binary
monitor could not have driven that release to its handoff at all.

**A property of the tool under test, recorded beside its numbers rather than as a
supply-chain signal.** dxa 0.1.5 describes itself as *"still considered \"alpha\" software
and there may be bugs, which is why it is not part of the official xa distribution yet"*, and
its tarball carries **no upstream signature and no upstream-published checksum** — the pin is
corroborated only by a third-party ports tree (FreeBSD `devel/dxa65`). Note the citation
correction: that self-description is at `INSTALL:15`, **not** in the man page `dxa.1`
(`grep -i alpha dxa.1` exits 1 with no output) — see correction 6 below.

## Summary table

One row per ROADMAP success criterion. Every outcome cell is transcribed from an outcome line
at column 0 of the named file, or reads `could-not-run` where no such file exists.
`not-exercised` appears nowhere in this table, because it was never earned: no pre-committed
inventory exists to earn it, and it is a strictly different value from `could-not-run`.
Nothing here is folded into a pass count; **there is no pass count in this phase.**

| # | Requirement | Outcome | Outcome line | Evidence file |
|---|---|---|---|---|
| 0 (gate input) | PROOF-01 | `partial` | `C0_CORPUS: partial` | `evidence/capture/CAPTURE-SUMMARY.txt` |
| 1 | PROOF-01 | `could-not-run` | none — file was never produced | `evidence/criterion1-dxa-classification.txt` (absent) |
| 2 | PROOF-02 | `could-not-run` | none — file was never produced | `evidence/criterion2-ghidra-dispatch.txt` (absent) |
| 3 | PROOF-03 | `could-not-run` | none — file was never produced | `evidence/criterion3-bank-divergence.txt` (absent) |
| 4 | PROOF-04 | audited: `26`, replaced `23`, lost-accepted `3`, **unreplaced `0`** | `C4_CAPABILITIES_AUDITED: 26` / `C4_REPLACED: 23` / `C4_LOST_ACCEPTED: 3` / `C4_UNREPLACED_CAPABILITIES: 0` | `evidence/criterion4-analyzer-audit.md` |
| 5 | PROOF-05 | **`no-go`, rule `R1`** | this document's frontmatter | `docs/phase23-real-release-gate-findings.md` + `evidence/DECISION-RULE.md` |

## Criterion 1

> *dxa's data-recovery rate and false-positive count are readable as numbers against a named
> real release … and printed beside the 279-byte fixture's 72%-data / 0-false-positive claim
> rather than replacing it.*

**Outcome: `could-not-run`. There is no criterion-1 number.** Plan 23-07 was not dispatched,
because it reads the depacked flat-64K capture as its substrate (D-03) and 23-03 could not
produce one; plan 23-05, which would have committed the measurement window `W` and the
certain-code / certain-data sets, and plan 23-06, which would have produced the cracker
hold-out, were not dispatched for the same reason. No `evidence/criterion1-*.txt` file exists.

**The window, the denominator and the adjudicated fraction are all `could-not-run`**, and
they are named here as first-class absences rather than left out: `C1_WINDOW` was never
committed, `C1_DENOMINATOR_BYTES` was never computed, and `C1_ADJUDICATED_FRACTION` — the
number that would have said what fraction of the window the measurement even spoke about —
does not exist. `C1_CRACKER_HELD_OUT`, `C1_DATA_RECOVERY_PCT_WITH_CRACKER` and
`C1_FALSE_POSITIVES_WITH_CRACKER` likewise do not exist, so the hold-out precedence contract
was never exercised and **the difference between the held-out and with-cracker figures — the
evidence about how far a naive measurement would have been distorted — was never obtained.**
The secondary release `saeger` has no criterion-1 numbers either; had it produced any, they
would never have been a rule input.

**The fixture's reproduced numbers, printed under one definition.** These are real and they
were reproduced by 23-02 (`evidence/fixture/fixture-baseline.txt`, outcome lines duplicated in
`evidence/tools/TOOLS.txt`). They are printed here **beside an empty criterion-1 column**, so
that no fixture figure can be misread as a release result. Positive class is data; the
denominator is certain-data bytes; a false positive is a certain-**code** byte typed as data.

| Quantity | Fixture, **reproduced** (source-derived) | Fixture, **as published by the pivot** | Canonical release `danish` |
|---|---|---|---|
| total bytes | `279` (`FIXTURE_TOTAL_BYTES: 279`) | 279 | `could-not-run` |
| ground-truth partition | 145 code / 131 data / 3 assembler-pad → 145/134 with pad counted as data | 141 code / 138 data | `could-not-run` |
| data-recovery rate | **`72.39 (97/134)`** | **`72.46%` (100/138)** | `could-not-run` |
| false positives | **`3`** | **`0`** | `could-not-run` |
| false negatives | **`27.61 (37/134)`** | `27.5%` / `27.54%` (38/138) | `could-not-run` |
| `FIXTURE_REPRODUCED` | `no` | — | — |

**`FIXTURE_REPRODUCED: no`, and that is a substantive finding, not a procedural hiccup.** The
published 141/138 partition is **not recoverable from `fixture.a`** — re-deriving it byte by
byte from the assembler's own report gives 145 / 131 / 3-pad under every padding treatment.
All four published figures *are* exactly reproducible under a four-byte reclassification
(`$0869-$086b` and `$08a6`), but that reclassification was **fitted** to make the numbers
agree, so it is recorded as a hypothesis and not as a baseline
(`evidence/fixture/fixture-baseline.txt` § RESEARCH CORRECTIONS RC-1). What is *proven* is
the negative: the pivot's partition was an assumption, and it is **more generous to dxa than
the source is, in exactly the place that decides the headline "0 false positives" claim** —
three bytes dxa got wrong (it typed a live `JSR` as data) are counted as data in the published
ground truth, scoring as a success rather than as three false positives. A strict-denominator
variant is also recorded and is not the reported baseline: `71.76 (94/131)` recovery, `6`
false positives, `28.24 (37/131)` false negatives.

**The consequence for D-11's side-by-side, stated so a later plan does not repeat the
mistake.** A future criterion-1 measurement derives `C` and `D` from a VICE runtime inventory
(D-05 / D-06) with no hand-adjustment step. Printing such a number beside the pivot's
published `72.46%` / `0`-FP is therefore **not apples-to-apples**. The apples-to-apples
fixture figures are the source-derived ones — `72.39` / `3` / `27.61` — and the published
figures may be printed beside them only with RC-1 attached.

**Error direction, and what it means for Phase 26.** The error *direction* against a real
release is `could-not-run` and remains unknown. What is known is the fixture's direction under
both partitions: the errors run **data-called-code** (false negatives materially exceed false
positives — `27.61%` against 3 bytes on the source-derived partition, `27.5%` against 0 on the
published one). That is the dangerous direction, because it feeds phantom code into every
downstream stage. **Whether Phase 26's graphics-feedback containment is sufficient or
load-bearing therefore remains an open question that this phase did not answer**, and the only
data bearing on it is a 279-byte self-authored fixture — which is precisely the state
`PROOF-01` exists to end.

## Criterion 2

> *A computed-index indirect dispatch taken from real code is either resolved by Ghidra's
> constant propagation, with the resolved target shown, or recorded as unresolved with its
> transcript. A corpus containing no computed dispatch is reported as not exercised and never
> as a pass.*

**Outcome: `could-not-run`.** Plan 23-08 was not dispatched — no depacked capture exists
(D-03) — and neither was plan 23-05, whose runtime inventory is the independent enumeration
this criterion is checked against. No `evidence/criterion2-ghidra-dispatch.txt` exists.
`C2_SITES_ENUMERATED` and `C2_COMPUTED_SITES` were never produced, so **zero sites were
enumerated and zero sites were tested against the computed definition**. `C2_RESOLVED_TARGET`
does not exist and no target is shown.

**This is `could-not-run` and explicitly not `not-exercised`.** `not-exercised` is a claim
about the corpus — that the construct was not present to test — and `SCHEMA.md` § 3 says it is
earned *only* by the pre-committed inventory (D-05) showing the construct absent. No inventory
exists, so nothing was earned. Both values fire `R6` identically, but they say opposite things
about what is known, and conflating them would be exactly the softening this phase forbids.

**The detection design, recorded because it is the part most easily lost.** Ghidra **reports
nothing when it fails to resolve a dispatch** — there is no error, no diagnostic and no
"unresolved" record in its export. Unresolved is therefore detectable only as the **absence of
a reference from a site that was independently enumerated by something other than Ghidra**,
which is why `C2_SITES_ENUMERATED` is specified to come from the VICE runtime inventory and
never from Ghidra (`SCHEMA.md` § 3), and why a site is *computed* only if it dispatches
through two or more distinct values at the same program address across the observed run
(`SCHEMA.md` § 7). Without that independent enumeration, criterion 2 degrades to "Ghidra
resolved the dispatch that Ghidra found", which is the circularity the definition exists to
close. Any future run of this criterion must carry that design forward intact.

**What *is* on record, and what it is not.** The pivot's own Ghidra reference dump records one
`COMPUTED_JUMP` (`082e -> 089a`) on the 279-byte fixture — but the fixture's dispatch index was
an immediate `ldx #$02`, the easy case, which is the specific defect this criterion exists to
remove. It is not a criterion-2 result and is not counted as one anywhere in this document.

## Criterion 3

> *The point at which a single forward-carried `$01` value stops being correct is established
> rather than assumed … or the absence of such an address in the corpus is recorded as a fact
> about the corpus rather than about the model.*

**Outcome: `could-not-run`.** Plan 23-09 was not dispatched — no depacked capture exists
(D-03) — and plan 23-05's `$01` write timeline, which this criterion joins against, was never
produced. No `evidence/criterion3-bank-divergence.txt` exists. `C3_DIVERGENT_SITES` and
`C3_MEMMAP_SHA256` do not exist, and no divergent site, address or `$01` pair can be shown.

**This is not `not-exercised`, and the distinction is the whole point of the criterion.**
`not-exercised` would be a **fact about the corpus** — that real banking code in these two
releases contains no address annotating differently under two bank states. `could-not-run` is
a fact about **this phase's execution**: the question was never put to the corpus. The ROADMAP
calls this "the highest-risk item on the pivot's own record", and it remains at exactly the
risk it started at: the single-forward-carried-`$01` model is **unvalidated against real
path-dependent code**, neither confirmed nor broken.

**What the corpus did show about `$01`, recorded because it is real and adjacent.** At the
loader/game handoff both releases read `$01 = $35` (BASIC and KERNAL banked out, RAM live
under both), with `$DD00 = $C1` → VIC bank 2, `$D018 = $33` → `screen_base $8C00` /
`charset_base $8800`, identical sprite pointers and PAL raster 311
(`evidence/capture/CAPTURE-SUMMARY.txt`, derived in `evidence/capture/capture-record-primary.md`).
That is one observed `$01` value at one instant. It is **not** a bank-divergence measurement
and is not offered as one.

## Criterion 4

> *What the dropped `analyzer.rs` work did that the dxa+Ghidra pair does not is a named list
> of concrete capabilities, each either matched to a replacement or accepted as lost with what
> it costs — derived from the real thing, not inferred from the fixture.*

**Outcome: measured.** This is the one criterion that needs no depacked capture — it is read
offline from the `regenerator2000-core` 0.9.20 crate source, and **no regenerator2000 process
was started** (D-01). Transcribed from `evidence/criterion4-analyzer-audit.md`:

```
C4_CAPABILITIES_AUDITED: 26
C4_REPLACED: 23
C4_LOST_ACCEPTED: 3
C4_UNREPLACED_CAPABILITIES: 0
```

The counts close: 8 entry points (E1..E8) + 11 `LabelType` variants (L1..L11) + 7 `BlockType`
variants (B1..B7) = 26 audited; 7 + 10 + 6 = 23 replaced; 1 + 1 + 1 = 3 accepted as lost;
0 + 0 + 0 = 0 blocking; and 23 + 3 + 0 = 26.

**`C4_LOST_ACCEPTED: 3` is not three failures.** `DECISION-RULE.md` lists it explicitly among
the four inputs that never change the verdict: a capability accepted as lost with its cost
stated is a decision, not a defect. Only the `lost-blocking:` count gates, via `R8`, and it is
`0`.

**Headline rows.**

| Row | Capability | Disposition |
|---|---|---|
| **E6** | `follow_indirect_jumps(...)` (`analyzer.rs:445`) — on `JMP ($xxxx)`, if the pointer address is inside the image **and** already typed `BlockType::Address`, read the 16-bit pointer and emit a jump label plus a cross-reference | `replaced-by: Ghidra COMPUTED_JUMP` (observed `082e -> 089a COMPUTED_JUMP`), **with an explicit shape-mismatch note** |
| E8 | `flow_analyze(...)` (`:581`) — worklist reachability from one entry | `replaced-by: Ghidra analyzeAll() with dxa-supplied entry points` — observed 17 functions / 152 code bytes **with** dxa hints against **0 functions / 0 code bytes without** |
| B4 | `LoHiAddress` split pointer table (`:90-122`) | `replaced-by: Ghidra CONCAT11 decompiler idiom` — with the range answer named as lost: the arrays typed `undefined1 len=1` each, no extent, no pair count, no stride |
| E4 | `promote_return_labels(...)` (`:372`) | `lost-accepted:` label quality — no engine records "this target is a bare return stub" |
| L11 | `LabelType::Return` / the `r_` prefix | `lost-accepted:` — the value leaves the vocabulary |
| B5 | `HiLoAddress` split pointer table (`:123-155`) | `lost-accepted:` — **no observation in either direction**; the pivot fixture contained no HiLo table |

**E6 is the audit's most load-bearing comparison, and the audit deliberately did not settle
it.** The row is written `replaced-by:` because Ghidra was *observed* resolving a strictly
harder indirect dispatch, and because r2000's own precondition — an already-`Address`-typed
block — is store state the milestone is committed to holding anyway. The audit states the
exact condition under which it should be reclassified `lost-blocking:`: **if and only if**
criterion 2 records `C2_COMPUTED_DISPATCH: unresolved` on a real corpus **and** `GHID-04`'s
acceptance is read as requiring the declaration-driven static fallback rather than only the
decompiler route. **Criterion 2 is `could-not-run`, so that condition is neither met nor
refuted, and `C4_UNREPLACED_CAPABILITIES` stays `0` as recorded.** It is recorded here as the
single row a re-run could move, so a later reader knows where to look first.

## Criterion 5

> *A machine-readable verdict — `go` / `degrade` / `no-go` — is recorded against decision rules
> committed before the measurements were run, and Phase 24's planner reads it as a
> precondition.*

**Outcome: this document.** The verdict is `no-go` and the fired rule is `R1`, both carried as
`verdict:` and `verdict_rule_applied:` in the frontmatter above, and the full rule is
reproduced verbatim in the body so the derivation is checkable without any other file
surviving.

**The ordering proof, quoted so a reader need not run git.** From `evidence/README.md`
§ *Ordering proof*, banked immediately after the rule commit landed and before any other path
under `evidence/` existed:

> **Fact one — the rules are the first thing in the evidence tree.**
>
> ```
> $ git log --oneline -1 -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/DECISION-RULE.md
> 474c37c docs(23-01): pre-commit the decision rule and the outcome-line schema
>
> $ git log --oneline --reverse -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence | head -1
> 474c37c docs(23-01): pre-commit the decision rule and the outcome-line schema
> ```
>
> The two commits are the same commit. `README.md` and `corpus/.gitignore` were written
> only after the rule commit had landed, so this identity holds by construction rather
> than by luck.
>
> **Fact two — no measurement evidence exists anywhere in history at this moment.**
>
> ```
> $ git log --oneline -- '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion*' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/inventory' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture'
> (no output)
> ```

Both facts were re-checked while writing this document. Fact one still reproduces verbatim.
Fact two is a point-in-time statement made at commit `474c37c`, and it re-verifies today by
scoping the same query to that commit (`git log --oneline 474c37c -- …`), which still returns
no output. **The rules provably precede every measurement**, which is the whole of PROOF-05's
ordering requirement. No test guard was added, per D-08: a guard would encode roadmap policy
in the suite of a phase that ships no code.

Note also that this document's verdict rests on a rule whose *thresholds and definitions* were
confirmed by the operator at a `blocking-human` gate in 23-01 Task 1 with the selection
`proceed` — as specified, no value adjusted (`evidence/DECISION-RULE.md` § *Decision
checkpoint*).

## Accepted limits

Every `## ACCEPTED LIMIT` block recorded in every evidence file, collected here one entry
each, unmerged and unsoftened. **Eight blocks exist across the evidence tree** and eight
entries appear below. `evidence/capture/capture-record-secondary.md` § *Accepted limits* is a
cross-reference to entries 1 and 2 rather than a ninth block, and is noted as such.

1. **The 64K image could not be assembled** (`evidence/capture/capture-record-primary.md`
   ACCEPTED LIMIT 1). Re-emitting 64 KB of hex through the executing agent failed twice in
   measured, distinct ways: a 16384-byte chunk **truncated outright**, and an 8192-byte chunk
   came back **silently 10 characters short**, caught only by an explicit length assertion.
   Nothing available catches a *substituted* character, and a single undetected substitution
   would put a wrong byte into the substrate every later criterion is measured on.
   **What it breaks:** `CAPTURE_SHA256`, `CAPTURE_SIZE`, the four `write-set` artifacts and
   the `vic_bank` / `screen_base` / `charset_base` / `sprite_data_addresses` derivation were
   not produced, and `compare.mjs compare` could not be run over two `.bin` files.

2. **`WarpMode` unavailable; every run was real-time**
   (`evidence/capture/capture-record-primary.md` ACCEPTED LIMIT 2). `vice_machine_config_set`
   declares `resources` as a JSON string in its own schema while the host server requires a
   JSON object, so the call cannot be satisfied from this surface. No `x64sc` was invoked by
   hand and none of the three power-cycling resources was ever set. **What it breaks:** ~110 s
   to the intro gate plus ~30 s to the handoff per run, five boots across the calibration run,
   the voided run and runs 1 and 2 — which is why the template's three-run minimum was not met.

3. **Where the corpus outcome lines live** (`evidence/corpus/corpus-intake.txt` ACCEPTED
   LIMIT 1). `SCHEMA.md` § 3 places `CORPUS_RELEASES` / `CORPUS_CANONICAL` /
   `CORPUS_FILE_SHA256` in `evidence/capture/CAPTURE-SUMMARY.txt`; 23-03-PLAN.md Task 2
   directed them into `evidence/corpus/corpus-intake.txt` and its verify greps there.
   Resolved without editing either document: emitted where the identities are established, and
   reproduced verbatim in the schema-declared home. **What it breaks:** nothing — `R1` reads
   only `C0_CORPUS` and reads none of the three.

4. **Outcome-line value vocabulary: `SCHEMA.md` wins** (`evidence/corpus/corpus-intake.txt`
   ACCEPTED LIMIT 2, restated in `evidence/capture/CAPTURE-SUMMARY.txt`). 23-03-PLAN.md
   directs `C0_CORPUS: fail` and a `CAPTURE_EQUIVALENT` of `pass`/`fail`; `SCHEMA.md` § 3
   declares `pass | partial | could-not-run` and `yes | no | could-not-run`. The plan's own
   regex would **reject** the schema-legal value `yes`. Operator-confirmed and phase-wide:
   `SCHEMA.md` wins, the evidence is not bent to satisfy a regex the frozen pre-commitment
   contradicts, and the mismatch is logged as a plan deviation. **What it breaks:** the
   affected plan verifies do not pass as written; no rule input changes in substance.

5. **The `Return` label promotion is gone** (`evidence/criterion4-analyzer-audit.md` ACCEPTED
   LIMIT 1). No engine records "this target is a bare return stub". **What it breaks:** label
   quality where a reader most wants a hint — a dispatch table whose unused slots all point at
   a shared `RTS` reads as a table full of ordinary routines, and that idiom is common in
   cracked releases. Consumer: `STORE-05`.

6. **`LabelType::Return` leaves the label vocabulary** (`evidence/criterion4-analyzer-audit.md`
   ACCEPTED LIMIT 2). The store's type set is eleven values rather than twelve. **What it
   breaks:** a store schema copied from r2000's enum would carry a value nothing can ever set,
   inviting a later reader to assume something populates it. Consumer: `STORE-01`.

7. **`BlockType::HiLoAddress` has no observation in either direction**
   (`evidence/criterion4-analyzer-audit.md` ACCEPTED LIMIT 3). The pivot fixture contained a
   LoHi table and **no HiLo table at all**, so the `CONCAT11` observation backing B4 covers the
   LoHi byte order only; the mirrored case is unproven, not replaced. **What it breaks:** a
   per-range typing model cannot learn a split table's extent, pair count or stride from a
   decompiler expression at one use site, and for the HiLo order it may not get the expression
   at all. Consumer: `STORE-01`.

8. **Four `23-02-PLAN.md` / `SCHEMA.md` divergences resolved in `SCHEMA.md`'s favour**
   (`evidence/fixture/fixture-baseline.txt` ACCEPTED LIMIT, four sub-items in one block).
   (a) `DXA_TARBALL_SHA256_VERIFIED` — schema domain `yes | no`, plan expects `pass`; `yes` is
   written and the plan's regex is not satisfied. (b) `FIXTURE_REPRODUCED` — schema
   `yes | no | could-not-run`, plan expects `pass`/`fail`; `no` is written. (c)
   `FIXTURE_DATA_RECOVERY_PCT` and `FIXTURE_FALSE_NEGATIVES` — schema fixes the
   `<decimal> (<num>/<den>)` shape, plan expects bare values. (d) Outcome-line home — schema
   declares `evidence/tools/TOOLS.txt`, plan names two other files; resolved by writing all
   three, agreeing line for line. **What it breaks:** those plan verifies are unsatisfiable
   without contradicting the frozen pre-commitment, and are recorded as deviations rather than
   accommodated.

### Limits recorded by this document itself

Kept separate so the collected count above stays equal to the number of `## ACCEPTED LIMIT`
blocks in the evidence tree.

- **`corpus.releases[].capture_sha256` is `could-not-run`, not 64 hex.** `SCHEMA.md` § 1 types
  that key as a 64-hex string. No capture was assembled (limit 1 above), so no such value
  exists and writing one would be fabrication. `could-not-run` is written instead, per
  `DECISION-RULE.md` § *Inputs*. Consequence: `23-10-PLAN.md` Task 1's automated verify, which
  greps for a 64-hex `capture_sha256`, **is not satisfied and cannot be satisfied without
  fabricating evidence.** This follows the phase-wide precedent established by 23-02 and 23-03
  and recorded in `evidence/corpus/corpus-intake.txt` ACCEPTED LIMIT 2: where a plan's verify
  disagrees with the frozen pre-commitment or with the facts, the evidence is not bent.

## Other findings (carried forward, not scored)

**Research question 2 — does Ghidra's 6502 decompiler degrade on illegal opcodes in real
code? No observation was made.** Ghidra was never run against real cracked code in this
phase, because no depacked capture exists. There is therefore **no observation of an
undecodable illegal opcode poisoning a function**, in either direction — neither that it
happens nor that it does not. This section says so explicitly rather than being omitted. The
deliberate answer remains `OPC-03` in Phase 24, and nothing here raises or lowers `OPC-01`'s
priority there.

**Divergence between the two releases' criterion-1 numbers: not obtained.** Neither release
produced criterion-1 numbers, so there is no evidence here about how much the crack shapes the
measurement. That question is untouched.

**Finding A — the hex-transcription blocker is solved, and the method is validated.**
Recorded at `.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`
(committed at `d6ed4fd`). A VICE `.vsf` snapshot already contains the exact 64K: the `C64MEM`
module body is 4 bytes of port/PLA state followed by exactly 65536 bytes of RAM, so the image
is a slice, with no transcription step anywhere. Validated on 2026-08-26 against 23-03's own
hand-transcribed hex from the same instant: `$2000-$3FFF` and `$4000-$5FFF` byte-identical,
`$0000-$1FFF` differing at exactly `$0000` and `$0001` (the 6510 processor-port overlay — the
snapshot holds the RAM beneath it, which is the only place a snapshot-derived image
legitimately differs from a CPU-view read), and `$6000-$7FFF` identical up to `$7871` then
shifted, **independently localising the ten characters 23-03 reported as silently dropped**.
The method also produces a stable sha256, which is exactly what `CAPTURE_SIZE` and
`CAPTURE_SHA256` need.

**This finding did not change the verdict and must not be read as though it did.** The verdict
is `no-go` on the evidence as it stood when the rule was applied. Finding A is carried forward
because `R1`'s "secure a corpus first" branch is materially cheaper than it looks, not because
it alters anything scored here.

**Finding B — the remaining blocker, unsolved: the fork's stopping exec checkpoint is not
frame-exact.** Diffing the two `danish` handoff snapshots **directly, with no transcription
anywhere**, still shows **201 multi-bit divergences**. That is real machine nondeterminism,
and it is the single obstacle between this phase and a real measurement. The two releases'
results isolate the cause cleanly: `danish`'s two runs stopped at `hit_count` 1 and 2 — i.e.
in *different game frames* — and produced 231 differing addresses in `$0000-$CFFF`, of which
100 lie outside every volatile region and differ by two or more bits; `saeger`'s two runs both
stopped at `hit_count` 1 — the *same* frame — and produced 41 one-bit drifts plus exactly
**one** non-volatile multi-bit difference (`$00F6`, the KERNAL keyboard-decoding-table
pointer). **Frame index is the dominant term; intra-frame position costs only one-bit drift.**
Neither is a fact about the corpus. A frame-exact stop is required before two runs can compare
as equivalent (`evidence/capture/CAPTURE-SUMMARY.txt`; both comparisons are the tool's own
output, pasted verbatim in the capture records). The snapshot-to-snapshot figure is recorded
at `evidence/capture/snapshot-divergence.txt` — `DIFF_DIVERGENCE_MULTI_BIT: 201`, alongside
`DIFF_DRIFT_ONE_BIT: 149` and `DIFF_VERDICT: not-equivalent`. *(Added 2026-08-26, code review
CR-02: the 201 figure was cited here while existing in no evidence file. It was measured by the
execute-phase orchestrator at phase close rather than by a dispatched plan — 23-09 would have
owned it and was never dispatched — and that provenance is stated at the head of the transcript.
It was re-measured from scratch for the record rather than copied forward, and reproduces.)*

**Finding C — the two releases need different keypress routes to reach their handoff.**
`danish` polls `$DC01` directly and needs `vice_keyboard_matrix` (fork-only); `saeger` spins on
KERNAL `GETIN` and needs `vice_keyboard_petscii`. Each was established by disassembling the
running gate, not guessed. This is why the fork was the measurement instrument, and it is a
concrete constraint on any future stock-backend attempt at the same capture.

**Finding D — the loader/game handoff is `$1BC2` for both releases**, identified by
disassembling the running machine and re-verified per release on that release's own fresh
machine, with `CAPTURE_PORT01: $35` at that instant for both. A re-run does not have to
re-derive this.

**Finding E — the regression gate's "flake set" was mostly one live broker; the suite is green
on a broker-free host.** *(Superseded 2026-08-26 at phase close; the earlier text described four
consecutive runs giving fail counts 1, 4, 1, 1 with a varying failing identity as a
load-sensitive flake set. `evidence/README.md` § convention 7 — final occurrence wins.)*

Those runs were all taken on a host where a VICE broker was deliberately kept live to drive
23-03's captures. With the broker stopped, one full run at the same commit is completely green:

```
# tests 2638   # pass 2593   # fail 0   # skipped 40   # todo 5      exit 0
```

`2408` (`vice-proxy.test.ts:6382`, BACK-05 D-G ordering) is **not a flake at all** — it is
deterministic and broker-caused, proven in both directions at one commit: broker unit active →
`# fail 1`, unit stopped → `# pass 1`. The test forces `VICE_BACKEND=stock` while a live broker
owns the emulator as `fork`, so the proxy's backend-mismatch guard fires correctly and its own
advice text trips the `doesNotMatch` assertion. The product code is right; the test is not
isolated from ambient host state.

What this does and does not settle, on the timing evidence:

| test | observed during | broker live? | verdict |
|------|-----------------|--------------|---------|
| `2408` | 23-03, 23-10 | yes | **broker-caused, deterministic — proven both directions** |
| `916` | 23-04 | **no** (broker dead since 2026-08-20) | genuinely load-sensitive |
| `159` | 23-03/23-10 | yes | unresolved — never observed on a broker-free host |
| `2410` | 23-03/23-10 | yes | unresolved — never observed on a broker-free host |

One green run does not *prove* `159` and `2410` are broker-caused rather than load-sensitive, so
they stay open rather than being reclassified. The gate result to carry forward is
**green on a broker-free host** — with the caveat that any future plan driving the emulator
re-introduces `2408` for its duration and should expect exactly that one failure. Full detail in
the phase's `deferred-items.md`; not fixed here, because all of it is test-harness behaviour
under `src/`.

## Corrections to prior documents

Every `## RESEARCH CORRECTIONS` entry recorded in every evidence file, collected here in one
pass, plus the corrections `SCHEMA.md` and this phase's execution generated directly. Plans
23-02 through 23-04 were forbidden from editing `23-RESEARCH.md` and recorded their
corrections locally, precisely so parallel plans in one wave could not collide on a single
document (`evidence/README.md` § *Evidence conventions* 8). **This document is that file's
single owner**, and the applicable corrections below are applied to it as scoped edits in the
same commit as this section.

1. **`.planning/research/questions.md` claims a real corpus that does not exist in this
   repository.** Under "Does dxa + Ghidra hold up on a real cracked release?" it tells the
   reader the measurements are *"answerable against the existing `c64-provenance-diff`
   fixtures — real releases, already committed, already provenance-classified"*. That is
   false. `c64-provenance-diff` is pure Node over a **consuming** project's `recovery/` tree
   and ships no releases; there is no `recovery/` tree here, and a `find` over the whole tree
   for `*.prg` / `*.d64` / `*.t64` returns three `.prg` files, all synthetic probe fixtures.
   **The corpus was operator-supplied under D-04** and lives outside this checkout. Filed as
   `.planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md`.
   *Not applied here:* `questions.md` is outside this plan's `files_modified` set; the todo is
   its owner.

2. **`23-CONTEXT.md`'s Claude's-discretion note recommended reusing `BankProbe3.java`'s
   `getBlock()`-first volatile guard verbatim, and on a flat 64K import that is wrong —
   silently.** The pivot's guard calls `getBlock(addr)` and sets `setVolatile(true)` on
   whatever comes back. That was written for the `.prg` route, where no block covers `$D000`,
   so `getBlock` returned null and a fresh I/O block was created. On a flat 64K raw import
   Ghidra's `BinaryLoader` creates exactly **one** block, `RAM 0000-ffff`, so
   `getBlock($D000)` returns the whole image and `setVolatile(true)` marks the **entire
   address space volatile — with no error and no warning**, and the symptom (no dead-store
   elimination anywhere) looks like success. The pattern this phase used instead is
   **split-first**: `Memory.split()` at `$0002`, `$D000` and `$E000`, then `setVolatile(true)`
   on the carved `$0000-$0001` and `$D000-$DFFF` blocks only, with the `getBlock`-null
   fallback retained for the `.prg` branch so one script serves both routes. Verified live
   against Ghidra 12.1.3. Evidence: `evidence/FlatVolatile.java` (header comment § *The one
   thing not to copy from the pivot*) and the rehearsal transcript in
   `evidence/tools/instrument-provenance.txt` § 3.

3. **`23-CONTEXT.md`'s `<specifics>` framed criterion 1's cracker/game separation as
   unavailable, and the operator's corpus turned it into a measurement.** The note reads
   *"Criterion 1's cracker/game separation is not available via provenance diffing on a single
   image, since `c64-provenance-diff` is N-way"* — correct given its assumption of one image,
   but that assumption did not survive planning. The operator supplied **two independently
   cracked releases of one title**, which makes the N-way diff able to classify. The design
   this phase committed keeps the unadjudicated third bucket (`U = W \ (C ∪ D)`, entering no
   ratio) **alongside** the cracker hold-out rather than replacing it, and the hold-out
   precedence contract makes the held-out figures the only criterion-1 rule inputs with the
   with-cracker figures printed beside them and never gating. Evidence:
   `evidence/corpus/corpus-intake.txt` (two releases, hashed) and `evidence/SCHEMA.md` §§ 4
   and *Hold-out precedence contract*. Note that the separation was nonetheless never
   exercised — 23-06 was not dispatched — so this correction records a design that is
   available, not a result.

4. **`SCHEMA.md` § 1 supersedes the scalar `corpus.file_sha256` / `corpus.capture_sha256`
   frontmatter keys proposed in `23-RESEARCH.md` Pattern 2 and `23-VALIDATION.md`'s
   verification map.** With two releases those scalar keys have no single correct value, and
   adding a `corpus.file_sha256_secondary` beside them would reproduce the exact
   canonical-image-centric model `recovery-schema.mjs` already exists in this codebase to
   prevent. The corpus is a **list with exactly one element flagged canonical**; the
   one-release case is the degenerate single-element list. `SCHEMA.md` says so itself and
   directs the correction here. *Applied* to `23-RESEARCH.md` in this commit.

5. **The fixture's 141-code / 138-data ground truth is not source-derivable, and this phase
   is the first to check** (`evidence/fixture/fixture-baseline.txt` RC-1). `23-RESEARCH.md`
   logs it as assumption A1 and states the 72% / 0-FP / 28%-FN claim "was reproduced exactly".
   Re-deriving the partition byte by byte from `fixture.a` via ACME's own report gives
   **145 code / 131 data / 3 assembler-pad** — never 141/138 under any padding treatment. All
   four published figures are exactly reproducible under a four-byte reclassification
   (`$0869-$086b`, `$08a6`), but that reclassification was **fitted** and is recorded as a
   hypothesis. What is proven is the negative: A1 was an assumption and remains one, and the
   published partition is more generous to dxa than the source is in exactly the place that
   decides the "0 false positives" headline. *Applied* to `23-RESEARCH.md` in this commit.

6. **dxa's "alpha software" self-description is in `INSTALL`, not the man page**
   (`evidence/fixture/fixture-baseline.txt` RC-3). `grep -i alpha dxa.1` exits 1 with no
   output; the statement is at `INSTALL:15`. The claim holds; the citation does not.
   *Applied* to `23-RESEARCH.md` in this commit.

7. **The pivot's published dxa command line uses `-a enabled`, not `-a dump`**
   (`evidence/fixture/fixture-baseline.txt` RC-2). The pivot ran
   `dxa -U -p all-nmos6502 -t detect-all -a enabled fixture.prg` and its `dxa.out` carries
   address+text lines with no byte columns. `23-02-PLAN.md` calls the `-a dump` variant "the
   pivot's own published command line"; `-a dump` is **this phase's**, required by
   `SCHEMA.md` § 6 because the byte columns are what make counts *read* rather than inferred
   from mnemonic lengths. dxa's classification is identical under both (179 code / 100 data
   either way). Only the attribution was wrong; no number changes. *Not applied:*
   `23-02-PLAN.md` is a committed plan file and is not this plan's to edit.

8. **All eight `analyzer.rs` line numbers in the research inventory are correct**
   (`evidence/criterion4-analyzer-audit.md` correction 1). `8`, `20`, `285`, `372`, `419`,
   `445`, `546`, `581` verified against a structural grep. **No correction needed** —
   recorded so a verifier can see the check was made rather than assumed.

9. **`LabelType` declares fourteen variants, not eleven**
   (`evidence/criterion4-analyzer-audit.md` correction 2). The research's "11 variants used"
   is accurate as written — eleven are *produced* by `analyzer.rs` — but the enum at
   `state/types.rs:361-378` carries fourteen. The three never emitted are `Predefined = 10`,
   `UserDefined = 11` and `LocalUserDefined = 12`, all store-side kinds set by a human or a
   platform symbol table. A store schema copied from the enum would inherit three values the
   analysis pass has no opinion about. *Applied* to `23-RESEARCH.md` in this commit.

10. **`BlockType` declares twelve variants, not seven**
    (`evidence/criterion4-analyzer-audit.md` correction 3). Seven have an arm in
    `analyzer.rs`; `state/types.rs:314-331` carries twelve. The five with no arm — `DataByte`,
    `PetsciiText`, `ScreencodeText`, `ExternalFile`, `Undefined` — fall through to a bare
    `else { pc += 1 }` and **record no label and no cross-reference**. r2000's analyzer is
    therefore silent about text blocks and undefined regions, so `STORE-01`'s PETSCII and
    screencode typing has no analyzer-side predecessor to inherit behaviour from. *Applied* to
    `23-RESEARCH.md` in this commit.

11. **`update_usage`'s per-`LabelType` count map is built and never read**
    (`evidence/criterion4-analyzer-audit.md` correction 4). The research summarises the
    function as "Ref counting + first-seen-type". Line 427 increments
    `types.entry(priority)`; line 202 destructures the tuple as `(_types_map, refs,
    first_type)` — the leading underscore is the compiler-silencing name for an unused
    binding. Within `analyzer.rs` the counting is dead code. This matters because "ref
    counting" implies a ranking mechanism a replacement would have to reproduce, and there is
    none: selection is purely first-wins. *Applied* to `23-RESEARCH.md` in this commit.

12. **`guess_scope_end`'s splitter branch can fall through**
    (`evidence/criterion4-analyzer-audit.md` correction 5). On meeting a splitter the function
    returns the *previous* line's last byte, but **only if that line has a non-zero byte
    length** (lines 561-564). On a zero-length visual line the `if bytes > 0` guard fails, no
    value is returned, and the scan continues past the splitter looking for an `RTS`/`RTI`.
    The source carries an unresolved author comment at that exact spot. A reimplementation
    treating the splitter as an unconditional terminator would not match. *Applied* to
    `23-RESEARCH.md` in this commit.

13. **`flow_analyze` ignores `block_types` entirely and cannot follow an indirect jump**
    (`evidence/criterion4-analyzer-audit.md` correction 6). It reads `state.raw_data` directly
    and never consults `state.block_types`, so it decodes straight into data blocks the rest
    of the file is careful to respect; and its `JMP` arm is guarded by
    `op.mode == AddressingMode::Absolute` (line 647), so `JMP ($xxxx)` terminates the span
    without queueing anything. **`flow_analyze` structurally cannot follow the construct
    `follow_indirect_jumps` exists to handle, and the two passes never combine.** *Applied* to
    `23-RESEARCH.md` in this commit.

14. **The research's structural grep missed one top-level item, and it is not an entry point**
    (`evidence/criterion4-analyzer-audit.md` correction 7). `type UsageData` at line 13 — the
    tuple alias `(BTreeMap<LabelType, usize>, Vec<Addr>, LabelType)`. Recorded rather than
    added to the capability table, because a type alias is not a capability; its three fields
    are dispositioned through E5 `update_usage`. **No count changes.**

15. **`23-RESEARCH.md`'s PROOF-05 ordering check is unsatisfiable as written, and the
    satisfiable form is scoped to `evidence/`.** The traceability row proposes
    `git log --oneline --reverse -- <phase dir> | head -1` naming 23-01. The phase directory
    already carried four commits before execution began — the CONTEXT, RESEARCH, VALIDATION and
    PLAN documents — so that query names the context commit and can never name the rule commit,
    whatever any plan does. The ordering assertion must be scoped to `evidence/`, which is
    where measurement artifacts land and where nothing existed before the rule commit.
    Evidence: `evidence/README.md` § *Ordering proof* → *Scope note*. *Applied* to
    `23-RESEARCH.md` in this commit.

## Reproducing this

**Every evidence file this phase produced, by relative path, with what it proves.** Paths are
relative to `.planning/phases/23-the-real-release-gate-go-degrade-no-go/`.

| Path | What it proves |
|---|---|
| `evidence/DECISION-RULE.md` | That the verdict was derived and not judged — `R1`..`R9`, the inputs table, the never-a-gate declarations and the threshold / precision / hold-out contracts, all committed before any number existed |
| `evidence/SCHEMA.md` | That no measuring plan could invent a line name, a window, a denominator or a dxa flag that flattered its own result |
| `evidence/README.md` | The binding evidence conventions, the ordering proof, and the repo-integrity diff |
| `evidence/corpus/corpus-intake.txt` | That two independently-cracked releases were identified by name and sha256 without either image entering the repository, and that the canonical choice was made by a rule stated before any measurement |
| `evidence/corpus/.gitignore` | That no binary image form can enter the repository by accident |
| `evidence/capture/RELEASES.json` | The two-release scratch registry, `danish` flagged canonical |
| `evidence/capture/handoff-identification.txt` | How `$1BC2` was identified by disassembling the running machine, and the two voided runs that preceded the recorded ones |
| `evidence/capture/capture-record-primary.md` | The canonical release's two runs, the verbatim `vice_memory_compare` output disproving equivalence, and ACCEPTED LIMITs 1 and 2 |
| `evidence/capture/capture-record-secondary.md` | The secondary release's two runs, both voided, and the single disarm-and-resume record for the session |
| `evidence/capture/CAPTURE-SUMMARY.txt` | `C0_CORPUS: partial` — rule `R1`'s only input — with the aggregation rule reproduced so a reader re-derives it |
| `evidence/tools/instrument-provenance.txt` | The dxa fetch/pin/verify/build transcript, the Ghidra and Java versions, and the two headless Ghidra rehearsals |
| `evidence/tools/TOOLS.txt` | The instrument and fixture-baseline outcome lines in `SCHEMA.md`'s declared single home |
| `evidence/tools/dxa-0.1.5.tar.gz.sha256` | The pinned tarball hash `DXA-01` must vendor |
| `evidence/tools/dxa` | The built binary the gate actually measured with, sha256 `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` |
| `evidence/tools/verify/*.bash` | Each task's own automated verify, kept as run |
| `evidence/fixture/fixture.a`, `evidence/fixture/fixture.lbl` | The 279-byte fixture and its symbol file, rebuilt rather than quoted |
| `evidence/fixture/fixture-baseline.mjs` | The classifier that produced the reproduced fixture figures |
| `evidence/fixture/fixture-baseline.txt` | That the pivot's 141/138 partition is not source-derivable (RC-1), plus RC-2, RC-3 and the four schema-vs-plan divergences |
| `evidence/dxa-listing-parse.mjs` | The `-a dump` listing parser that **refuses** rather than under-counting on an unseen line shape |
| `evidence/FlatVolatile.java` | The split-first volatile pre-script, and why the pivot's `getBlock()`-first guard silently marks all 64K volatile |
| `evidence/ExportAnalysis23.java` | The structural-fact / reference export script, rehearsed headless |
| `evidence/criterion4-analyzer-audit.md` | All 26 `analyzer.rs` capabilities with exactly one disposition each, `C4_UNREPLACED_CAPABILITIES: 0`, three priced losses and seven research corrections |

**Files that do not exist, and would have to be produced by a re-run:**
`evidence/inventory/INVENTORY.txt` (23-05), `evidence/criterion1-provenance.txt` (23-06),
`evidence/criterion1-dxa-classification.txt` and `-secondary.txt` (23-07),
`evidence/criterion2-ghidra-dispatch.txt` (23-08),
`evidence/criterion3-bank-divergence.txt` (23-09).

**The corpus images are never committed to this repository.** Working copies do exist inside
the checkout at `evidence/corpus/danish.d64` and `evidence/corpus/saeger.d64` — the `vice` MCP
surface refuses any absolute path outside the mounted workspace, so 23-03 had to place them
there to autostart them — but that directory's own `.gitignore` refuses every binary image form
and `git ls-files` reports **zero** tracked `.d64`. Their identity in this document is release
name plus sha256 only (D-04). *(Corrected 2026-08-26, code review CR-04: this previously read
"are not in this repository", which is false of the working tree and contradicted this
document's own — correct — "never committed" at the corpus-identity section above. Never
committed is the claim D-04 actually makes and the one the evidence supports.)*
`danish` = `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`, `saeger` =
`b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5`, both 174848 bytes.

**The capture sha256s the runs were against: there are none.** `CAPTURE_SHA256` is
`could-not-run` for both releases and `CAPTURE_SIZE` likewise, because the 64K image was never
assembled. What exists instead are **three** VICE `.vsf` handoff snapshots banked outside the checkout, in
`~/.config/vice/mcp_snapshots/`: `danish_r1_handoff`, `danish_r2_handoff` and
`saeger_r1_handoff`. There is no `saeger_r2_handoff` — `saeger`'s second run was compared
**live** against run 1's snapshot rather than being banked itself
(`evidence/capture/capture-record-secondary.md`), so the two releases were not handled
identically and only `danish` has both of its runs on disk. A fourth snapshot,
`probe_frame_a`, exists but is a checkpoint-imprecision probe, not a handoff instant.
*(Corrected 2026-08-26, code review CR-03: this previously said "four ... snapshots
(`saeger_r1_handoff` and its sibling), each proven faithful on reload", naming an artifact that
was never saved and generalising a reload proof that was performed for `danish` and not for
every snapshot.)*

Finding A above is the validated route from those snapshots to an exact 65536-byte image with a
stable sha256, and `evidence/capture/snapshot-divergence.txt` exercises it end to end.

**Re-running the verdict derivation** (the only measurement this document itself performed):

```
grep '^C0_CORPUS:' .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/CAPTURE-SUMMARY.txt | tail -1
grep '^C4_UNREPLACED_CAPABILITIES:' .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion4-analyzer-audit.md | tail -1
```

Read the first value against `R1` in `evidence/DECISION-RULE.md`. `partial` is not `pass`,
`R1` is first, `R1` fires, verdict `no-go`. That is the whole derivation.

**Re-running the ordering proof:**

```
git log --oneline -1 -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/DECISION-RULE.md
git log --oneline --reverse -- .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence | head -1
git log --oneline 474c37c -- '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion*' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/inventory' '.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture'
```

The first two must name the same commit; the third must return nothing.

**Re-running the fixture baseline** (this is the one measurement a re-run can reproduce today,
because it needs no corpus):

```
acme -f cbm -o fixture.prg -l fixture.lbl fixture.a
dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg    # -> 179 code / 100 data / 279 total, $0801-$0917
node evidence/fixture/fixture-baseline.mjs                  # ground-truth re-derivation + classification
```

That is the invocation 23-02 actually ran, recorded at `evidence/fixture/fixture-baseline.txt:50`,
and it reproduces `PARSE_CODE_BYTES: 179` / `PARSE_DATA_BYTES: 100` / `PARSE_ACCOUNTED_BYTES: 279`
/ `PARSE_ADDRESS_RANGE: $0801-$0917` exactly. **Corrected 2026-08-26 (code review CR-01):** this
block previously printed `evidence/SCHEMA.md` § 6's flat-64K-capture flag set with `fixture.prg`
appended, which exits 2 with `dxa: Could not open <entrypoints>.` — `-R`/`-B` name inventory files
that plan 23-05 was never dispatched to produce. Stripped of those, it yields `code=0 data=282`
against a record that says `code=179`. A document whose purpose is re-derivability cannot print a
reproduce command that does not reproduce.

**The `-g 0000` hazard applies to a flat 64K capture and must NOT be used on `fixture.prg`.**
On a flat capture `-g 0000` is mandatory: dxa's default load-address detection reads the first two
bytes as a little-endian load address, so a processor-port `$2F $37` re-bases the image to
`* = $372f` and discards roughly 50K, warning only on **stderr**. `fixture.prg` is the opposite
case — 281 bytes carrying a genuine 2-byte `$0801` header plus the 279-byte image — so forcing
base `$0000` decodes the header as content and shifts every address, giving `total=281` against a
declared 279, which is precisely the mismatch `SCHEMA.md` § 6 requires the listing parser to
**refuse** on. The two cases were conflated here and are now separated.

No `-t detect-internal` fixture number exists anywhere in the evidence tree
(`grep -r detect-internal evidence/fixture/` returns nothing), so `C1_DETECT_INTERNAL_DATA_BYTES`
and `C1_DETECT_ALL_DATA_BYTES` are both **absent**: `SCHEMA.md` § 6's "print both, choose neither
after the fact" protocol was specified but never exercised on the fixture. Recorded as an
unexercised protocol rather than a satisfied one.

**Re-running Ghidra headless** (rehearsed in this phase on the fixture; never run on a
release):

The two routes differ in base address and must not be conflated. Both are **single**
invocations — import, pre-script and post-script in one call — because `-deleteProject`
destroys the project on exit, so a second `-process` call has nothing left to open.

```
# fixture (.prg) route, as rehearsed (instrument-provenance.txt:582):
analyzeHeadless <proj> fixture-export -import fixture-image.bin \
  -processor 6502:LE:16:default -loader BinaryLoader -loader-baseAddr 0x801 \
  -noanalysis -scriptPath <scriptdir> \
  -preScript FlatVolatile.java entrypoints-fixture.txt \
  -postScript ExportAnalysis23.java fixture-export.txt -deleteProject

# flat-64K-capture route (instrument-provenance.txt:318) -- rehearsed only against a
# SYNTHETIC 65536-byte image; never run on a real capture, because none exists:
analyzeHeadless <proj> <name> -import <flat64k.bin> \
  -processor 6502:LE:16:default -loader BinaryLoader -loader-baseAddr 0x0 \
  -noanalysis -scriptPath <scriptdir> \
  -preScript FlatVolatile.java <entrypoints-file> \
  -postScript ExportAnalysis23.java <out.txt> -deleteProject
```

*(Corrected 2026-08-26, code review WR-04: the previous block omitted `-scriptPath`, without
which `analyzeHeadless` cannot find either script; split the work across two invocations with
`-deleteProject` on the first, destroying what the second needed; and printed
`-loader-baseAddr 0x0` under a "rehearsed on the fixture" label when the fixture rehearsals
used `0x801` and `0x0` belongs to the flat-capture route.)*

Ghidra is identified by version `12.1.3 PUBLIC` build `2026-Aug-17` and by nothing else; its
install location is an undeclared external input to this phase and is deliberately not
recorded here.
