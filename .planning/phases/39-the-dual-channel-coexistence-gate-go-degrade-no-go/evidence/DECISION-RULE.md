# Phase 39 — The binding decision rule (CHAN-01)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files, **never from a summary's paraphrase**, then
evaluate the rules **in order** and take the first that matches. Record which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof; see `README.md` § *Ordering proof*.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands — including by a later plan that
believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
records it as an `## ACCEPTED LIMIT` in its **own** evidence file and the findings document
(`docs/phase39-dual-channel-coexistence-gate-findings.md`) records an explicit override. The
rule text itself does not move. A rule set that can be adjusted once the numbers are visible
is not a pre-commitment; it is a verdict written backwards from the answer.

**Decision checkpoint.** The rule text and ordering, the seven input names with their value
domains, and the two pre-mapped `degrade` narrowings below were confirmed at `39-01` Task 1
(a `blocking` decision gate) with the selection **`proceed`** — freeze rules `R1`..`R15`, the
seven input names with their value domains, and the two pre-mapped `degrade` narrowings
exactly as drafted, **no value adjusted**. The gate was resolved by the human owner through
the orchestrator **before this plan's Task 2 ran and before any measurement in this phase
existed**; no executor self-answered it, because an autonomous executor that approves its own
pre-commitment has produced no pre-commitment. Two alternatives were on offer and declined:
`soften-r2` (making `IDLE_COEXIST: not-taken` a `degrade` instead of a `no-go`) was rejected
because it would contradict the reasoning `39-CONTEXT.md` recorded under `D-09` and license a
`degrade` verdict — which selects a serialization shape for Phase 41 to build — off a
coexistence precondition nobody ever observed; `adjust` (change a named value, domain,
derivation or rule position) was not invoked, since no specific change was named.

`R2`'s residual risk — that a probe defect (a wrong `-remotemonitor` flag position, a wrong
prompt terminator, an under-budgeted connect retry) could reach the same `no-go` as a genuine
measured incompatibility — is mitigated **procedurally, not structurally**: `SCHEMA.md` § 4
declares `REMOTEMONITOR_FLAG_ORDER:`, `TEXT_PROMPT_LITERAL_CONFIRMED:` and
`TEXT_BIND_BUDGET_MS_MAX:` as facts recorded beside the gate — in `evidence/39-idle-coexist.md`,
never as gate inputs — so a reader can tell the two apart after the fact even though the
verdict is the same either way.

---

## Inputs

Each input is read from one literal outcome line at **column 0** of one named evidence file.
Paths are relative to
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/`. Where a line is
written more than once in a file, **the final occurrence wins**. The complete value domains
and the derivation rule that produces each value from raw measurements are declared in
`SCHEMA.md`; the table below is the index, not the definition.

| Input | Domain | Corpus-free | Source line | Source file |
|---|---|---|---|---|
| `IDLE_COEXIST` | `clean` / `corrupts` / `not-taken` | yes | `IDLE_COEXIST:` | `evidence/39-idle-coexist.md` |
| `FOREIGN_HALT_VISIBILITY` | `visible` / `invisible` / `corrupts` / `not-taken` | yes | `FOREIGN_HALT_VISIBILITY:` | `evidence/39-foreign-halt.md` |
| `CONCURRENT_INFLIGHT` | `clean` / `degraded` / `corrupts` / `not-taken` | yes | `CONCURRENT_INFLIGHT:` | `evidence/39-concurrent-inflight.md` |
| `CROSS_CHANNEL_RESUME` | `clean` / `corrupts` / `not-taken` | yes | `CROSS_CHANNEL_RESUME:` | `evidence/39-cross-channel-resume.md` |
| `DISCONNECT_RECOVERY` | `recovers` / `leaves-halted` / `not-taken` | yes | `DISCONNECT_RECOVERY:` | `evidence/39-disconnect-recovery.md` |
| `HITCOUNT_INVARIANT_HOLDS` | `holds` / `breaks` / `not-taken` | yes | `HITCOUNT_INVARIANT_HOLDS:` | `evidence/39-hitcount-invariant.md` |
| `TEXT_SINGLE_CLIENT` | `single` / `multi` / `not-taken` | yes | `TEXT_SINGLE_CLIENT:` | `evidence/39-text-single-client.md` |

Every input above **must exist** in its named file carrying one of the values `SCHEMA.md`
declares for it. An absent line is not a pass, not a default, and not a defensible state — it
is an incomplete phase, and the honest action is a blocking report rather than a substituted
value. `not-taken` is an explicitly written value that no plan may reach by omission: it names
which experiment could not be taken and why, on the same page.

## The distinguishing property of this gate

Stated as the **inversion** of Phase 33's, explicitly rather than by omission. Phase 23's gate
could return `could-not-run` because every input needed a corpus. Phase 33 removed that by
making four of its five inputs corpus-free, leaving one corpus-bound input whose absence was
still an input value (`not-obtained`). Here **all seven inputs are corpus-free** — no cracked
release is involved anywhere in this gate — so the abstention risk this gate carries is not a
missing corpus but an **untakeable experiment**: a host limitation, a probe defect, or a
timing budget that cannot be met on this hardware. `not-taken` is what absorbs it, as an input
value rather than a silent omission.

The check this places on every rule: **if a rule can be reached only when every input has a
measured value, the rule is wrong.** A rule set that required all seven inputs to be
successfully measured before it could resolve would reintroduce exactly the abstention this
gate exists to remove, just one level up. `R2` and every rule downstream of it exists so that
an untakeable `IDLE_COEXIST` still resolves to a verdict.

---

## Rules, first match wins

- **R1 → `no-go`.** `IDLE_COEXIST` is `corrupts`. A non-halting read on the binary channel
  returning wrong data, erroring or desyncing merely because a silent text client is connected
  is unfixable by discipline: the in-process mutex, the broker-level lease and the
  connect-gate all assume the idle case is safe, and only the connect-gate — the two channels
  time-sharing and never coexisting live — survives. Sole `no-go` trigger per `D-09`.

- **R2 → `no-go`.** `IDLE_COEXIST` is `not-taken`. Same verdict by a different rule and a
  different stated reason (`D-09`): an unmeasured coexistence precondition cannot license a
  design that *assumes* coexistence, and because `IDLE_COEXIST` is the cheapest experiment and
  a precondition for the other four, its being untakeable means none of them were taken
  either. Numbered separately from `R1` so the record distinguishes a measured corruption
  from an untakeable experiment.

- **R3 → `degrade`.** `IDLE_COEXIST` is `clean` **and** `FOREIGN_HALT_VISIBILITY` is
  `corrupts`. Narrowing authored at verdict time against the evidence, Phase 9 style, and
  labelled as such.

- **R4 → `degrade`.** `IDLE_COEXIST` is `clean` **and** `FOREIGN_HALT_VISIBILITY` is
  `invisible`. Verdict-time narrowing.

- **R5 → `degrade`.** `IDLE_COEXIST` is `clean` **and** `FOREIGN_HALT_VISIBILITY` is
  `not-taken`. Verdict-time narrowing.

- **R6 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`
  **and** `CONCURRENT_INFLIGHT` is `corrupts`. Verdict-time narrowing.

- **R7 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`
  **and** `CONCURRENT_INFLIGHT` is `degraded`. Verdict-time narrowing.

- **R8 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`
  **and** `CONCURRENT_INFLIGHT` is `not-taken`. Verdict-time narrowing.

- **R9 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean` **and** `CROSS_CHANNEL_RESUME` is `corrupts`. Verdict-time
  narrowing.

- **R10 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean` **and** `CROSS_CHANNEL_RESUME` is `not-taken`. Verdict-time
  narrowing.

- **R11 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean`, `CROSS_CHANNEL_RESUME` is `clean` **and**
  `DISCONNECT_RECOVERY` is `leaves-halted`. **Pre-mapped narrowing (D-10):** a killed text
  client leaving the machine permanently halted and indistinguishable from a genuine wedge is
  a **missing mechanism**, not a proof of incompatibility — the binary side's "connection
  close IS the release" (`broker-control.mts` ~line 522) has no text-channel analogue, and
  only the broker outlives a killed client. So this outcome points **at** the broker-lease
  shape rather than away from coexistence, and the fix — a broker-held halt-authority lease
  released when the holding connection dies — becomes named Phase 41 scope in the verdict,
  discovered here rather than at Phase 41's gate.

- **R12 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean`, `CROSS_CHANNEL_RESUME` is `clean` **and**
  `DISCONNECT_RECOVERY` is `not-taken`. Verdict-time narrowing.

- **R13 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean`, `CROSS_CHANNEL_RESUME` is `clean`, `DISCONNECT_RECOVERY`
  is `recovers` **and** `HITCOUNT_INVARIANT_HOLDS` is `breaks`. **Pre-mapped narrowing
  (D-11):** every stock module that upholds "poll on `hit_count`, never on paused state"
  natively — `stock-checkpoints.ts`, `stock-run-until.ts`, `stock-reproducible-run.ts`,
  `stock-diagnose.ts` — must gain foreign-halt discrimination, and Phase 41's selected shape
  must supply it. Pre-mapped precisely because this is where an after-the-fact author would
  be most tempted to declare the existing invariant already sufficient.

- **R14 → `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY` is `visible`,
  `CONCURRENT_INFLIGHT` is `clean`, `CROSS_CHANNEL_RESUME` is `clean`, `DISCONNECT_RECOVERY`
  is `recovers` **and** `HITCOUNT_INVARIANT_HOLDS` is `not-taken`. Verdict-time narrowing.

- **R15 → `go`.** Reached only when `IDLE_COEXIST: clean`, `FOREIGN_HALT_VISIBILITY: visible`,
  `CONCURRENT_INFLIGHT: clean`, `CROSS_CHANNEL_RESUME: clean`, `DISCONNECT_RECOVERY: recovers`
  and `HITCOUNT_INVARIANT_HOLDS: holds`, at **any** value of `TEXT_SINGLE_CLIENT`. `R15` has
  **no antecedent** — it is the exhaustive default, which is what makes `could-not-run`
  structurally unemittable (`D-03`) rather than merely discouraged.

**The disjointness design.** Each of `R3`..`R14` explicitly requires every input **earlier in
the reading order** to hold its best value, so `R1`..`R14` are pairwise mutually exclusive: no
tuple can satisfy two of them, and `R15` fires exactly when none of them does. **First match
wins** is therefore a statement about how a reader proceeds, not the mechanism that
disambiguates an overlap — which is what lets `totality-walk.mjs` assert the strong property
`D-04` asks for ("exactly one antecedent matches each tuple") instead of the weak one ("at
least one"). The concrete consequence a reader can check: without the conditioning, a tuple
carrying both `DISCONNECT_RECOVERY: leaves-halted` and `HITCOUNT_INVARIANT_HOLDS: breaks` would
satisfy two antecedents at once and the record would not say which narrowing applied; with the
conditioning, `R11` fires, `R13` does not, and the second finding is carried in the evidence
and in the findings document's per-input sections rather than in the rule id. This is the one
place the rule set gives a reader less than the evidence does, so it is stated plainly rather
than left implicit.

### Narrowings are not scoped to the fired rule

**Both pre-mapped narrowings apply whenever their own input carries its triggering value,
independently of which rule id fired.** The rule id records which antecedent came first in the
reading order; it does not record which narrowings are in force. So a verdict reached through
`R11` still carries `R13`'s pre-mapped narrowing if `HITCOUNT_INVARIANT_HOLDS` reads `breaks`,
and the findings document is required to state every narrowing whose triggering value was
recorded, regardless of which rule id the verdict itself cites. Without this sentence the
conditioning above would silently discard a finding, which is the opposite of what the
conditioning is for.

---

## Totality

`could-not-run` is not an emittable verdict of this gate, and that is asserted by an
executable walk rather than by promise. The seven inputs have domains of size 3, 4, 4, 3, 3,
3, 3, so there are **3 × 4 × 4 × 3 × 3 × 3 × 3 = 3,888** tuples — roughly 36 times Phase 33's
108, which `D-04` records as already at the limit of what a reader can check in prose. Rather
than tabulate 3,888 rows by hand, `totality-walk.mjs` enumerates the cross-product, evaluates
every one of `R1`..`R15` against every tuple, and asserts exactly one of `R1`..`R14` matches or
none of them does (in which case `R15` takes it) — throwing, naming the offending tuple and
every id it matched, on any violation. Its recorded output is banked in `39-totality.md`.

The expected — and, per the walk's own run recorded in `39-totality.md`, **observed** —
per-rule hit histogram, so a reader can check the walk rather than merely trust it:

| Rule | Verdict | Tuples reaching it |
|---|---|---|
| `R1` | `no-go` | 1296 |
| `R2` | `no-go` | 1296 |
| `R3` | `degrade` | 324 |
| `R4` | `degrade` | 324 |
| `R5` | `degrade` | 324 |
| `R6` | `degrade` | 81 |
| `R7` | `degrade` | 81 |
| `R8` | `degrade` | 81 |
| `R9` | `degrade` | 27 |
| `R10` | `degrade` | 27 |
| `R11` | `degrade` | 9 |
| `R12` | `degrade` | 9 |
| `R13` | `degrade` | 3 |
| `R14` | `degrade` | 3 |
| `R15` | `go` | 3 |

`1296 + 1296 + 324 + 324 + 324 + 81 + 81 + 81 + 27 + 27 + 9 + 9 + 3 + 3 + 3 = 3888`. Every
tuple is accounted for exactly once.

**`RULE_HIT_R15: 3` is load-bearing.** The `go` branch is reached at all **three** values of
`TEXT_SINGLE_CLIENT` — `single`, `multi` and `not-taken` — which is `D-08` proved by
arithmetic: `TEXT_SINGLE_CLIENT` never narrows which of `R1`..`R14` fires (`TSC_INDEPENDENCE`
in the walk's own output proves this over all 1,296 tuple groups that differ only in that
input), and it does not narrow `R15` either. A rule set in which `go` were reachable at only
one or two values of `TEXT_SINGLE_CLIENT` would have smuggled an eighth gating condition past
the seven declared inputs.

Two consequences worth stating explicitly, because they are the properties the gate was
designed for:

- **The all-worst tuple resolves.** `IDLE_COEXIST: corrupts` (with every other input at its
  worst value) matches `R1` and yields `no-go`. There is no combination of bad values for
  which the rules fall through.
- **The all-`not-taken` tuple resolves.** `IDLE_COEXIST: not-taken` (with every other input
  `not-taken`) matches `R2` and yields `no-go` — the untakeable-experiment case, resolved by a
  rule distinct from the measured-corruption one. No combination of untaken experiments falls
  through either.
- **`go` cannot be reached by an absence.** `R15` requires all six non-`TEXT_SINGLE_CLIENT`
  inputs at their single best value each; any `not-taken` among them routes through `R2`,
  `R5`, `R8`, `R10`, `R12` or `R14` instead.

**Adjacency is decided by order, not by judgement.** The rules are first-match-wins and the
findings document records `verdict_rule_applied: R<N>` — the id of the **first** rule that
matched. Two rules can never both be "the first match" for one input tuple, so a tuple that
would satisfy several antecedents has exactly one verdict, the first one's, and the record
says so by rule id rather than by argument. Rules that were never evaluated because an earlier
one matched are recorded as **not evaluated**, not as passed.

## The three shapes the verdict selects

Reproduced here so the verdict document does not have to invent it:

- **`go`** → an in-process async mutex, both channels connected for the session's lifetime,
  the `channel` discriminator kept for bookkeeping only.
- **`degrade`** → a broker-level cross-channel halt-authority lease, moving correctness from
  one process's in-memory mutex to the broker, at the cost of a round trip per halting call.
- **`no-go`** → a connect-gate in which opening one channel requires releasing the other's
  claim, the two time-sharing and never coexisting live.

A `no-go` does not kill the runtime-evidence layer: it makes Phase 43's capture step
**scheduled** rather than concurrent, and Phase 43 is written to survive it.

## Never a gate

Declared here so a later plan cannot promote them:

- **`TEXT_SINGLE_CLIENT` (D-08).** It constrains Phase 41's connection management to one text
  client per instance — the same rule the broker already enforces for the binary monitor —
  but says nothing about whether one text and one binary client can coexist, which is the
  only question this gate asks. `TSC_INDEPENDENCE: holds` in the walk's output proves this
  mechanically rather than promising it.
- **The VICE version (D-15).** Provenance, never an input; the baseline is stock 3.9 and a run
  landing on something later invalidates nothing.
- **The second binary's outcomes.** Recorded as facts beside the gate, and a divergence
  between the two binaries recorded loudly rather than averaged.
- **The `test:automated` failure count.** A recorded baseline every transcript states, never a
  threshold anything passes.
- **The concurrent-write overlap gap in milliseconds.** Recorded as a measurement caveat so a
  reader can judge how tight the overlap was, never compared against a threshold.
- **`IDLE_TEXT_CLIENT_HALTS`.** A recorded fact shaping Phase 41's connection management, in no
  antecedent above.
