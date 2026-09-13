# Phase 49 — The outcome-line schema and measurement definitions

**Binding. Committed before any measurement exists.** Every literal name the rest of this
phase may emit is fixed here, together with the **derivation rule** that produces its value
from raw measurement — so no measuring plan can invent a favourable definition, and no plan
can mint a line name that flatters its own result. A measuring plan that needs a name not
declared below has found a gap in the pre-commitment; it records that as an `## ACCEPTED
LIMIT` in its **own** evidence file and the findings document records an explicit override.
**It does not invent a name, and it does not edit this file.**

`DECISION-RULE.md` reads its inputs from the lines declared here. The two files are one
pre-commitment in two parts and share its frozen status.

**Checkpoint provenance.** The seven input names, their value sets, and the three verdict
tokens below were confirmed at this plan's own Task 1 (a `blocking` decision gate, auto-mode
auto-selected per `checkpoints.md` golden rule 5) with the selection **`freeze-as-proposed`**
— freeze the seven inputs and three verdict tokens exactly as drafted, no value adjusted. Two
alternatives were on offer and declined: `collapse-guards` (dropping `SECOND_PATH_GUARD` and
`ORDERING_PROOF` as gate inputs, keeping them as tests only) was rejected because those two
properties are exactly the ones whose failure makes every other input untrustworthy — a
breached ordering proof means the rules were written after the measurement, and a breached
seam guard means the byte-diff may not be the one the gate claims; leaving them out of the
verdict would mean a reader cannot see, from the verdict alone, whether the gate was still a
gate. `rename-verdicts` (using `go`/`degrade`/`no-go` instead of `green`/`acknowledged`/`red`)
was rejected because `degrade` names a reduced capability, which is not what an acknowledged
hazard is — the rebuild is fully correct and a human has accepted a named movement
constraint, and a token that does not mean what happened is how a verdict starts getting
paraphrased.

---

## 1. Outcome-line conventions

Every rule input and every recorded fact is a bare `NAME: value` at **column 0** of a named
evidence file. Never indented, never inside a fenced block that a reader would take for
sample output, never inside a table cell.

- **Final occurrence wins.** Where a line is written more than once in one file, the last
  occurrence is the value. This project's own precedent (Phase 9) carried a superseded early
  line that was only resolved much later in the same file; the rule exists so a reader never
  has to guess which occurrence is authoritative.
- **One declared source file per line.** The table below names exactly one file per line
  name. A gate input written into a second file is not a second opinion; it is a name
  collision, and the declared file is the one that counts.
- **Absence.** For the **seven gate inputs** an absent line is not a pass, not a default and
  not a defensible state — it is an incomplete phase. Absence is never a pass.
- **Repeated declared line.** A declared input line appearing more than once in its own
  source file resolves to its final column-0 occurrence, per the final-occurrence-wins rule
  above — stated a second time here because it is also an explicit acceptance criterion of
  this document.
- **Accepted-limit escape hatch.** A measuring plan that needs a name this document does not
  declare records an `## ACCEPTED LIMIT` section in its own evidence file, naming the gap and
  what it did instead, and the findings document records an explicit override. This file is
  never edited to accommodate it.

---

## 2. The seven gate inputs

These seven, and only these seven, are read by `DECISION-RULE.md`. Declared here in the
literal `NAME: value-set` form, one per line at column 0, exactly as frozen at this plan's
Task 1 checkpoint — this block is the canonical declaration; the table and per-input
derivations below expand on it but do not redefine it:

TREE_REBUILD:         ok | failed | skipped
MOVEMENT_REBUILD:     ok | failed | skipped | refused
HAZARD_DISPOSITION:   clean | acknowledged | blocked
DIFF_SCOPE_COVERAGE:  complete | incomplete
RED_CONTROLS:         all-observed | partial | none
SECOND_PATH_GUARD:    held | breached
ORDERING_PROOF:       held | breached

Paths are relative to
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/`.

| Line | Domain | Declared source file |
|---|---|---|
| `TREE_REBUILD` | `ok` \| `failed` \| `skipped` | `evidence/49-tree-rebuild.md` |
| `MOVEMENT_REBUILD` | `ok` \| `failed` \| `skipped` \| `refused` | `evidence/49-movement-rebuild.md` |
| `HAZARD_DISPOSITION` | `clean` \| `acknowledged` \| `blocked` | `evidence/49-hazard-disposition.md` |
| `DIFF_SCOPE_COVERAGE` | `complete` \| `incomplete` | `evidence/49-tree-rebuild.md` and `evidence/49-movement-rebuild.md` (see § 3 for the split) |
| `RED_CONTROLS` | `all-observed` \| `partial` \| `none` | `evidence/49-red-controls.md` |
| `SECOND_PATH_GUARD` | `held` \| `breached` | `evidence/49-guards.md` |
| `ORDERING_PROOF` | `held` \| `breached` | `evidence/49-guards.md` |

Verdict tokens produced by `DECISION-RULE.md` from these seven: `green` | `acknowledged` |
`red`. There is no fourth token, and `could-not-run` is not a spelling this phase uses
anywhere — every input above has an explicit absence rule (§ 1) rather than an abstention
value, because unlike the corpus-bound gates that preceded this one (Phase 23, Phase 33),
every one of the seven inputs here is produced by a script this project itself runs to
completion or does not run at all; there is no external hardware limitation that can make an
input untakeable in the way a live emulator probe can.

### 2.1 `TREE_REBUILD` — derivation

Takes the assembler oracle's own outcome token **verbatim** for the baseline export tree at
its original layout — the tree-aware entry point on `verifyAcmeAssembles()` (D49-B), run once
against the unmodified export.

- It is **never** derived from the assembler's exit status alone.
- It is **never** derived from an aggregate summary line (ACME's own `-v2` aggregate output is
  read only as one of the oracle's five ordered verdict rules, never taken as the verdict on
  its own).
- It is **never** derived from a file at a path that existed **before** the run that produced
  it — the oracle's own "output path already present" rule (`acme-verify.ts` rule 6, the
  `absentBeforeSpawn` check) is inherited unchanged by the tree-aware entry point, so a stale
  artifact from a previous run can never be read as this run's bytes.
- **`skipped` means no assembler ran and therefore no claim about the bytes exists.** It is
  neither a pass nor a byte-level failure, exactly as `AcmeOutcome`'s own JSDoc states for the
  single-file oracle it extends (`acme-verify.ts:106-112`): "`skipped` is NOT a flavour of
  `failed` and is NOT a quiet `ok`". `TREE_REBUILD: skipped` maps to `red` at every point it
  can appear in the rule table (`DECISION-RULE.md` rule `R4`) — a run in which no assembler
  ran can never be read as a pass.

### 2.2 `MOVEMENT_REBUILD` — derivation

Takes the same oracle's outcome token for the relocated layout (D49-C's store-document +
image-layer relocation, never a text splice of generated assembly), **plus one value the
oracle itself cannot produce**: `refused`.

- `refused` is emitted when the gate was handed no movement input at all, **or** one whose
  relocation delta is zero. A same-address round trip is a refusal, not a pass: relocating a
  symbol to its own existing address exercises nothing about whether a *moved* layout still
  rebuilds, so recording it as `ok` would let the gate's movement requirement (ROADMAP Phase
  49 success criterion 4) be satisfied vacuously.
- Otherwise this input inherits every one of `TREE_REBUILD`'s derivation rules verbatim,
  applied to the relocated tree in place of the baseline one: never from exit status alone,
  never from an aggregate summary line, never from a pre-existing output path, and `skipped`
  is never a pass.

### 2.3 `HAZARD_DISPOSITION` — derivation

Derived from `buildHazardReport()`'s `HazardReport` (Phase 48) and the acknowledgement match
against it (D49-D).

- **`clean`** only when the hazard report carries **zero** findings **and** zero regions whose
  outcome is the undecided one (`HazardRegionOutcome`'s `"unclassified"` member,
  `anno-hazard-report.ts:162-165`) — a region left `unclassified` is not evidence of safety,
  so a report that is silent about a region cannot be read as clean about it.
- **`acknowledged`** when every finding is matched by exactly one acknowledgement carrying a
  non-empty reason, **and** every undecided (`unclassified`) region is likewise acknowledged.
- **`blocked`** in every other case, including a finding matched by zero acknowledgements and
  an acknowledgement matching zero or more than one finding — an ambiguous match is treated as
  no match, never resolved in the acknowledger's favour.
- **The identity of a finding for matching purposes is the triple `(hazardClass, anchorAddress,
  mechanism)` taken together (D49-D)**, never the anchor address alone: one address can carry
  findings under two mechanisms, and the finding type carries no identity field of its own.
  This makes the findings array's ordering irrelevant by construction — no acknowledgement
  reasoning may depend on array position, because no ordering contract for that array is
  documented anywhere.

### 2.4 `DIFF_SCOPE_COVERAGE` — derivation

- **`complete`** only when every finding's `anchorAddress` and every non-null
  `blockedAddress` lies inside the half-open byte-diff extent the export itself reports for
  the run being scored (the baseline extent for `evidence/49-tree-rebuild.md`, the relocated
  extent for `evidence/49-movement-rebuild.md`).
- **`incomplete`** otherwise — including the case where a hazard-anchored address falls
  outside the scope that was actually byte-diffed.
- **Why this input exists:** a byte-diff over a narrowed scope can be perfectly clean while
  the range a reader actually cares about — a hazard-anchored range — was never compared at
  all. A `TREE_REBUILD: ok` sitting beside `DIFF_SCOPE_COVERAGE: incomplete` is not evidence
  that the hazard-adjacent bytes rebuilt correctly; it is silence about them.
- **Two declared source files, one per run.** Unlike the other six inputs, this one is
  produced twice — once for the baseline tree and once for the relocated tree — because
  "which extent was actually diffed" is a fact of each individual rebuild, not a single fact
  about the gate. Both occurrences are read; `DECISION-RULE.md`'s rule reads this input as
  `incomplete` if **either** declared occurrence reads `incomplete` (see § 3 below for exactly
  which line each file carries).

### 2.5 `RED_CONTROLS` — derivation

- **`all-observed`** only when all three planted controls named in the phase's own success
  criterion 3 were observed **red** in the same suite run that produced the green result being
  reported: a wrong-byte rebuild under an exit-zero assembler, a stale-output-path scenario
  where a previous run's artifact would be read as this run's, and a rebuild in which a
  hazard-adjacent range was left outside the diff scope.
- **`partial`** when one or two of the three were observed red but not all three.
- **`none`** when zero were observed red, or the controls were never run.
- A green (or acknowledged) verdict is never trusted before the planted controls have been
  observed going red in the same run — this is the reason `RED_CONTROLS` sits ahead of the
  passing rules in the decision table, not behind them.

### 2.6 `SECOND_PATH_GUARD` — derivation

- **`held`** when the structural seam guard's two set equalities both hold: the set of modules
  that spawn the assembler (`ACME_SPAWN_SITES`) matches the frozen expected set exactly, and
  the set of modules that perform a produced-versus-expected byte comparison
  (`EXPECTED_BYTES_COMPARISON_SITES`) matches its own frozen expected set exactly — in both
  directions, so a second, independent spawn or comparison site cannot appear unguarded.
- **`breached`** otherwise — a new spawn site or a new comparison site appeared that the frozen
  sets do not name, or a previously-frozen site disappeared without the set being updated in
  the same commit.
- **Why this input exists:** if the byte-diff the gate reports may not be the one the gate
  itself claims to have run — because a second, unaudited comparison exists somewhere in the
  tree — then no byte-level result below this input means anything.

### 2.7 `ORDERING_PROOF` — derivation

- **`held`** when this file's own add-commit and `DECISION-RULE.md`'s own add-commit both
  precede every measurement commit in this phase, **read from git history** (`git log
  --diff-filter=A`, or equivalent) and never from any document's claim about itself.
- **`breached`** otherwise.
- **Why this input exists:** a rule table edited after a measurement exists makes the whole
  instrument advisory — the gate would no longer be deriving a verdict, it would be justifying
  one already known. This is the property `git log` proves or disproves; no document's own
  prose about itself is admissible evidence for this input.

---

## 3. Declared-source assignment table

Each of the seven line names is assigned to exactly one declared source file (two for
`DIFF_SCOPE_COVERAGE`, per § 2.4), drawn from the five measurement evidence file names this
phase's plan frontmatter lists. A later plan reads this table to know where to write each
measurement. One line name never has two source files; a file may declare more than one line.

| Evidence file | Line(s) it declares |
|---|---|
| `evidence/49-tree-rebuild.md` | `TREE_REBUILD`, `DIFF_SCOPE_COVERAGE` (baseline-run occurrence) |
| `evidence/49-movement-rebuild.md` | `MOVEMENT_REBUILD`, `DIFF_SCOPE_COVERAGE` (relocated-run occurrence) |
| `evidence/49-hazard-disposition.md` | `HAZARD_DISPOSITION` |
| `evidence/49-red-controls.md` | `RED_CONTROLS` |
| `evidence/49-guards.md` | `SECOND_PATH_GUARD`, `ORDERING_PROOF` |

---

## 4. Absence rules (restated as their own section, per this document's own acceptance gate)

- A declared input with **no occurrence** of its line in its declared source file is
  **ABSENT**.
- **Absence is never a pass.** An absent `TREE_REBUILD`, `MOVEMENT_REBUILD`,
  `HAZARD_DISPOSITION`, `DIFF_SCOPE_COVERAGE`, `RED_CONTROLS`, `SECOND_PATH_GUARD` or
  `ORDERING_PROOF` line means the phase is incomplete, not that the input defaults to a
  favourable value.
- A line appearing **more than once** in its declared source resolves to its **final
  occurrence at column 0** (§ 1).

---

## 5. The findings-document frontmatter shape

Fixed here, before `docs/phase49-the-reassembly-gate-findings.md` exists, mirroring
`docs/phase39-dual-channel-coexistence-gate-findings.md`. Keys in this order:

| Key | Domain |
|---|---|
| `phase` | `49-the-reassembly-gate-committed-before-the-phase-it-gates` |
| `requirement` | `BUILD-06` |
| `probe_date` | `YYYY-MM-DD` |
| `verdict` | exactly one of `green`, `acknowledged`, `red` |
| `verdict_rule_applied` | matches `R[1-9]` or `R1[0-2]` — the id of the **first** rule that fired |
| `inputs.tree_rebuild` | the `TREE_REBUILD` domain in § 2.1 |
| `inputs.movement_rebuild` | the `MOVEMENT_REBUILD` domain in § 2.2 |
| `inputs.hazard_disposition` | the `HAZARD_DISPOSITION` domain in § 2.3 |
| `inputs.diff_scope_coverage` | the `DIFF_SCOPE_COVERAGE` domain in § 2.4 |
| `inputs.red_controls` | the `RED_CONTROLS` domain in § 2.5 |
| `inputs.second_path_guard` | the `SECOND_PATH_GUARD` domain in § 2.6 |
| `inputs.ordering_proof` | the `ORDERING_PROOF` domain in § 2.7 |

The seven `inputs.*` values are **transcribed** from the literal outcome lines declared in
§ 2 and § 3, each with a trailing comment citing the evidence file and line its value was
transcribed from, final occurrence wins. A value with no traceable source line is not
acceptable — every `inputs.*` entry in the findings document must cite a real `evidence/`
file and line.

**Incremental population.** The `inputs:` block is populated as measurements land. A
not-yet-transcribed input carries the literal placeholder **`not-yet-transcribed`**, and that
placeholder is **not** a member of any input's value domain. The `verdict:` and
`verdict_rule_applied:` keys are **absent** until all seven inputs carry real domain members
— a findings document with the `verdict:` key present alongside any `not-yet-transcribed`
placeholder is an incomplete phase, exactly as an absent outcome line is.

---

## Status: frozen pre-commitment

This file is committed before any measurement exists and may **not** be edited, refined,
re-scoped or "clarified" after the first measurement commit lands — including by a later plan
that believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
records it as an `## ACCEPTED LIMIT` in its **own** evidence file and the findings document
records an explicit override. This file's text does not move. A schema that can be adjusted
once the numbers are visible is not a pre-commitment; it is a vocabulary written backwards
from the answer.
