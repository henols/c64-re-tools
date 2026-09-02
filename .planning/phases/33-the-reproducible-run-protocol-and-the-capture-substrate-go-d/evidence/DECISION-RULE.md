# Phase 33 — The binding decision rule (GATE-01)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files, **never from a summary's paraphrase**, then
evaluate the rules **in order** and take the first that matches. Record which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof; see `README.md` § *Ordering proof*.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands — including by a later plan that
believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
records it as an `## ACCEPTED LIMIT` in its **own** evidence file and the findings document
(`docs/phase33-reproducible-run-gate-findings.md`) records an explicit override. The rule
text itself does not move. A rule set that can be adjusted once the numbers are visible is
not a pre-commitment; it is a verdict written backwards from the answer.

**Decision checkpoint.** The rule text and ordering, the five input names with their value
domains, and the two pre-mapped `degrade` narrowings below were confirmed at `33-01` Task 1
(a `blocking` decision gate) with the selection **`proceed`** — freeze rules `R1`..`R9`, the
five input names with their value domains, and the two pre-mapped `degrade` narrowings
exactly as drafted, **no value adjusted**. The gate was resolved by the human owner through
the orchestrator **before this plan was dispatched and before any measurement in this phase
existed**; no executor self-answered it, because an autonomous executor that approves its
own pre-commitment has produced no pre-commitment. The rejected alternative
`harden-capture-pair` (making `C0_CAPTURE_PAIR: fail` a `no-go`) was declined on two
recorded grounds: it would make a *captured-and-failed* pair fatal while *never obtaining*
a pair stayed only `degrade` — the wrong incentive — and `D-04` deliberately leaves `fail`
unmapped so its narrowing is authored against the actual recorded cause.

---

## Inputs

Each input is read from one literal outcome line at **column 0** of one named evidence file.
Paths are relative to
`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/`.
Where a line is written more than once in a file, **the final occurrence wins**. The
complete value domains and the derivation rule that produces each value from raw
measurements are declared in `SCHEMA.md`; the table below is the index, not the definition.

| Input | Domain | Corpus-free | Source line | Source file |
|---|---|---|---|---|
| `SEED_EFFECT` | `pinned` / `partial` / `unpinned` | yes | `SEED_EFFECT:` | `evidence/33-repro01-determinism.md` |
| `JITTER_IMMUNITY` | `immune` / `partial` / `not-immune` | yes | `JITTER_IMMUNITY:` | `evidence/33-repro02-reset-removed.md` |
| `ORACLE_NECESSITY` | `proven` / `unproven` | yes | `ORACLE_NECESSITY:` | `evidence/33-repro03-frame-anchor.md` |
| `SLICER` | `validated` / `failed` | yes | `SLICER:` | `evidence/33-slicer-validation.md` |
| `C0_CAPTURE_PAIR` | `pass` / `fail` / `not-obtained` | no | `C0_CAPTURE_PAIR:` | `evidence/33-capture-pair.md` |

Every input named above **must exist** in its named file carrying one of the values
`SCHEMA.md` declares for it. An absent line is not a pass, not a default, and not a
defensible state — it is an incomplete phase, and the honest action is a blocking report
rather than a substituted value.

**The distinguishing property of this gate (D-02).** Four of the five inputs —
`SEED_EFFECT`, `JITTER_IMMUNITY`, `ORACLE_NECESSITY` and `SLICER` — are **corpus-free**:
each is measurable on a bare host with genuine stock VICE and no cracked release anywhere
on disk. The fifth, `C0_CAPTURE_PAIR`, is corpus-bound, and `C0_CAPTURE_PAIR:
not-obtained` is an input **value**, never a reason to abstain. This is the specific defect
its predecessor carried: **every** input of Phase 23's gate needed a corpus, so
`could-not-run` was reachable and was in fact reached. Removing that reachability is what
the ROADMAP names as this gate's distinguishing property, and it is asserted structurally
below (§ *Totality*, `R9` has no antecedent) rather than promised in prose.

---

## Rules, first match wins

- **R1 → `no-go`.** `SLICER` is `failed`. The flat-64K substrate every downstream number is
  measured on does not exist, so Phases 35-38 would measure hand-transcribed hex again —
  the exact error source `CAP-01` removes (one 32 KB write truncated mid-payload, one 8 KB
  write dropping ten characters, localised to `$7871`). Nothing downstream can be trusted
  above the trustworthiness of the bytes it reads, and with no slicer those bytes are typed
  by hand. **Corpus-free:** the slicer is validated against committed `.vsf` fixtures and
  two unit suites, so a missing corpus can never produce this `no-go`.

- **R2 → `no-go`.** `SEED_EFFECT` is `unpinned`. Launch nondeterminism dominates every
  comparison — worth roughly a thousand false-divergence addresses per capture pair
  (MEASURED `NOSEED_DIFF_TOTAL_64K 1092` on this host), with `RAMInitRandomChance` shipping
  at `10`, i.e. 0.1% of all RAM bits flipped at power-up — so no capture pair can be
  trusted and no equivalence claim means anything. **Corpus-free:** measured by two cold
  boots with and without the determinism block, no release involved.

- **R3 → `no-go`.** `JITTER_IMMUNITY` is `not-immune`. The reset protocol does not
  reproduce, so there is no frame-exact stop for anything downstream to stand on and the
  milestone's premise fails at its root: a capture taken at a stop that moves is not a
  capture of anything in particular. **Corpus-free:** measured as the 0 / 1500 / 4000 ms
  jitter triple under the protocol, no release involved.

- **R4 → `degrade`.** `C0_CAPTURE_PAIR` is `fail`. Two captures were obtained from a real
  release and the pair does **not** compare equivalent, or the allow-list derivation
  exceeded the committed cap of 64. Narrowing **authored at verdict time against the
  evidence** — deliberately *not* pre-mapped (`D-04`), because a `fail` whose recorded
  cause is "the stop was not frame-exact" and a `fail` whose recorded cause is "the
  derivation overflowed the committed cap of 64" narrow in different directions: the first
  is a fact about this phase's substrate and is actionable here, the second is a fact about
  the release and is not. The narrowing is written against the cause the evidence actually
  records, and is labelled authored-at-verdict-time so a reader weighs it differently from
  a pre-commitment.

- **R5 → `degrade`.** `C0_CAPTURE_PAIR` is `not-obtained`. **Pre-mapped narrowing (D-04):**
  Phase 38 narrows to **method-only** — it re-records the same `could-not-run` its
  predecessor did, for the same named reason — and Phases 35 / 36 / 37 lose their
  real-image exercise and narrow to **fixture-only**. The `REPRO-*` / `CAP-01` / `CAP-02`
  substrate is **untouched** by this branch: it was measured without a corpus, so it stands
  on its own evidence whatever happens to the release.

- **R6 → `degrade`.** `ORACLE_NECESSITY` is `unproven`. **Pre-mapped narrowing (D-04):** the
  oracle narrows to the two-term `(PC, hit_count)` form with the frame term **recorded but
  not asserted**, and every downstream capture pair carries that weakening in its own
  record rather than in a footnote to this document. Note that `unproven` includes the case
  where no `(LIN, CYC)`-alone-passing control pair was produced at all: the ROADMAP requires
  the necessity of the frame term to be *observed*, and an unobserved necessity is not a
  proven one.

- **R7 → `degrade`.** `SEED_EFFECT` is `partial`. The determinism block reduces the
  differing-address count over the untouched window but does not drive it to zero. Narrowing
  **authored at verdict time against the evidence**, Phase 9 style — the value is a plain
  enumerated result with no interpretive step, so the narrowing costs nothing to defer and
  gains precision by seeing the residual count.

- **R8 → `degrade`.** `JITTER_IMMUNITY` is `partial`. The four-term stop identity matches
  across all three jitter values but the 64K sha256 does not, so the stop reproduces while
  the machine state does not. Narrowing **authored at verdict time against the evidence**.

- **R9 → `go`.** Reached only when `SLICER: validated`, `SEED_EFFECT: pinned`,
  `JITTER_IMMUNITY: immune`, `C0_CAPTURE_PAIR: pass` and `ORACLE_NECESSITY: proven`.
  v0.8.0 proceeds as scoped, with no narrowing anywhere. `R9` has **no antecedent** — it is
  the exhaustive default, which is what makes `could-not-run` structurally unemittable
  (`D-03`) rather than merely discouraged.

---

## Totality

`could-not-run` is not an emittable verdict of this gate, and that is asserted by
arithmetic rather than by promise. The five inputs have domains of size 3, 3, 2, 2 and 3,
so there are **3 × 3 × 2 × 2 × 3 = 108** input tuples. `R1`..`R8` remove every tuple
containing a non-best value and `R9` takes the remainder, so every tuple resolves to
exactly one verdict in `{go, degrade, no-go}`.

The partition, walked value by value under first-match-wins. Each row counts only the
tuples that reach that rule, i.e. the tuples no earlier rule matched:

| Rule | Antecedent | Tuples reaching it that match | Verdict | Tuples still unresolved after it |
|---|---|---|---|---|
| — | (all tuples) | — | — | 108 |
| `R1` | `SLICER: failed` | 3 × 3 × 2 × 3 = **54** | `no-go` | 54 |
| `R2` | `SEED_EFFECT: unpinned` | 1 × 3 × 2 × 3 = **18** | `no-go` | 36 |
| `R3` | `JITTER_IMMUNITY: not-immune` | 2 × 1 × 2 × 3 = **12** | `no-go` | 24 |
| `R4` | `C0_CAPTURE_PAIR: fail` | 2 × 2 × 2 × 1 = **8** | `degrade` | 16 |
| `R5` | `C0_CAPTURE_PAIR: not-obtained` | 2 × 2 × 2 × 1 = **8** | `degrade` | 8 |
| `R6` | `ORACLE_NECESSITY: unproven` | 2 × 2 × 1 × 1 = **4** | `degrade` | 4 |
| `R7` | `SEED_EFFECT: partial` | 1 × 2 × 1 × 1 = **2** | `degrade` | 2 |
| `R8` | `JITTER_IMMUNITY: partial` | 1 × 1 × 1 × 1 = **1** | `degrade` | 1 |
| `R9` | *(none — exhaustive default)* | **1** | `go` | **0** |

`54 + 18 + 12 + 8 + 8 + 4 + 2 + 1 + 1 = 108`. Every tuple is accounted for exactly once:
**84** tuples resolve `no-go`, **23** resolve `degrade`, and exactly **1** — the all-best
tuple — resolves `go`.

Two consequences worth stating explicitly, because they are the properties the gate was
designed for:

- **The all-worst tuple resolves.** `SLICER: failed`, `SEED_EFFECT: unpinned`,
  `JITTER_IMMUNITY: not-immune`, `ORACLE_NECESSITY: unproven`,
  `C0_CAPTURE_PAIR: not-obtained` matches `R1` and yields `no-go`. There is no combination
  of bad values for which the rules fall through.
- **The all-`not-obtained`-shaped tuple resolves.** The most absence-laden reachable state
  — every corpus-free input at its best value and `C0_CAPTURE_PAIR: not-obtained` — matches
  `R5` and yields `degrade` with a narrowing already written down. An absence therefore
  produces a *narrowed proceed*, never an abstention, and never a `go`: `R9` requires all
  five inputs at their best value, so it cannot be reached by an absence.

**Adjacency is decided by order, not by judgement.** The rules are first-match-wins and the
findings document records `verdict_rule_applied: R<N>` — the id of the **first** rule that
matched. Two rules can never both be "the first match" for one input tuple, so a tuple that
satisfies several antecedents (say `SLICER: failed` *and* `C0_CAPTURE_PAIR: fail`) has
exactly one verdict, `R1`'s, and the record says so by rule id rather than by argument.
Rules that were never evaluated because an earlier one matched are recorded as
**not evaluated**, not as passed.

---

## Never a gate

Four recorded values are **measurements, not gates**. Declared here, in the Phase 9 and
Phase 23 manner, so a later plan cannot promote one and so a reader cannot mistake an
unflattering value in any of them — or its absence — for a failure. None of them appears in
any rule above, and none may be added to one.

- **The number of corpus releases never changes the verdict.** `D-27` asks for **one**
  operator-supplied real cracked release. Two are on disk (`danish.d64`, `saeger.d64`, both
  gitignored and untracked), so the second is a **stretch input** whose absence is not a
  shortfall and whose presence earns nothing. Only whether a *pair of captures* was obtained
  from one release gates, via `C0_CAPTURE_PAIR`.

- **The absolute cycle count never changes the verdict.** The text monitor's `stopwatch` is
  excluded by owner decision (2026-09-02) and `CPUHISTORY_GET` (0x86) requires VICE ≥ 3.10
  while this host runs 3.9, so there is no monotonic cycle source available on the measured
  backend at all. `LIN` and `CYC` are read and used as the *frame* term of the stop-identity
  oracle; neither is a cycle total, and no rule reads one as a number.

- **`probeReady`'s timing budget never changes the verdict.** Its adequacy under `-warp` and
  `-console` is measured and recorded (`PROBEREADY_BUDGET:`,
  `WARP_TIME_TO_BIND_MS_MAX:`, `CONSOLE_TIME_TO_BIND_MS_MAX:`), because a wall-clock
  readiness probe misjudging a faster boot is the same class of error this phase is required
  to observe red. It is a fact about the launcher's margins, not about the reproducible-run
  protocol, and no threshold on it could be defended before the measurement existed.

- **The `test:automated` failure count never changes the verdict.** It is a **recorded
  baseline** every transcript states rather than a threshold anything passes or fails. The
  measured baseline on this tree with the broker stopped is **5 failing tests in 3 files**
  (`anno-register.test.ts`, `docs-deferred-ledger.test.ts`, `audit-integrity.test.ts`) from
  two root causes Phase 33 did not create; after `33-02` repairs one of them the expected
  baseline is **2 failing tests in `anno-register.test.ts` only**. See `README.md`
  § *Evidence conventions* 4. Gating on it would make this gate an assertion about unrelated
  bookkeeping.

---

## Ordering

This document's commit precedes every measurement commit in this phase. `git log` is the
proof and it is checkable by anyone. **No test guard is added** (`D-06`): a guard would
encode roadmap policy in a suite belonging to a phase that ships the rules and nothing else,
and the likeliest outcome — `degrade`, meaning "proceed, narrowed" — is precisely the case
such a guard cannot check. The verdict binds Phases 34-38 through their ROADMAP `Depends on`
lines and Notes plus a `STATE.md` pointer.

The ordering proof is banked in `README.md` § *Ordering proof* as facts taken at the moment
this commit was authored, plus the one-line reproduction of the post-commit assertion
`git rev-list --count <rules-sha> -- evidence/` = `1`. `33-12` re-runs that same assertion
after every measurement has landed.
