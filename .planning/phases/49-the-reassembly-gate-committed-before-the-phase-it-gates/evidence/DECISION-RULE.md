# Phase 49 — The binding decision rule (BUILD-06)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files declared in `SCHEMA.md`, **never from a summary's
paraphrase**, then evaluate the rules **in order** and take the first that matches. Record
which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof: `git log --diff-filter=A -- .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md`
shows both files added in one commit, and every measurement evidence file this phase produces
(`evidence/49-tree-rebuild.md`, `evidence/49-movement-rebuild.md`,
`evidence/49-hazard-disposition.md`, `evidence/49-red-controls.md`, `evidence/49-guards.md`)
lands in a strictly later commit. `ORDERING_PROOF` (§ Inputs below) is this exact check,
performed against real git history rather than taken on either document's own word.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands — including by a later plan that
believes it is only resolving an ambiguity. If an ambiguity is found, the measuring plan
records it as an `## ACCEPTED LIMIT` in its **own** evidence file and the findings document
(`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md`) records an explicit override. The rule text
itself does not move. A rule found to be wrong after a measurement commit lands is recorded as
an override in the verdict document, never silently corrected here — a rule set that can be
adjusted once the numbers are visible is not a pre-commitment; it is a verdict written
backwards from the answer.

**Decision checkpoint.** The rule text and ordering, the seven input names with their value
domains, and the three verdict tokens were confirmed at `49-01` Task 1 (a `blocking` decision
gate) with the selection **`freeze-as-proposed`** — freeze the seven inputs and three verdict
tokens exactly as drafted, **no value adjusted**. The gate was auto-selected in auto-mode per
this project's own checkpoint protocol (`gate="blocking"`, not `gate="blocking-human"`), and
the rationale for the selection — including why the two declined alternatives
(`collapse-guards`, `rename-verdicts`) were wrong — is recorded in `SCHEMA.md`'s own
"Checkpoint provenance" section rather than duplicated here.

---

## Inputs

Each input is read from one literal outcome line at **column 0** of one named evidence file.
Paths are relative to
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/`. Where a line
is written more than once in a file, **the final occurrence wins**. The complete value domains
and the derivation rule that produces each value from raw measurement are declared in
`SCHEMA.md`; the table below is the index, not the definition.

| Input | Domain | Source line | Source file |
|---|---|---|---|
| `TREE_REBUILD` | `ok` / `failed` / `skipped` | `TREE_REBUILD:` | `evidence/49-tree-rebuild.md` |
| `MOVEMENT_REBUILD` | `ok` / `failed` / `skipped` / `refused` | `MOVEMENT_REBUILD:` | `evidence/49-movement-rebuild.md` |
| `HAZARD_DISPOSITION` | `clean` / `acknowledged` / `blocked` | `HAZARD_DISPOSITION:` | `evidence/49-hazard-disposition.md` |
| `DIFF_SCOPE_COVERAGE` | `complete` / `incomplete` | `DIFF_SCOPE_COVERAGE:` | `evidence/49-tree-rebuild.md` and `evidence/49-movement-rebuild.md` |
| `RED_CONTROLS` | `all-observed` / `partial` / `none` | `RED_CONTROLS:` | `evidence/49-red-controls.md` |
| `SECOND_PATH_GUARD` | `held` / `breached` | `SECOND_PATH_GUARD:` | `evidence/49-guards.md` |
| `ORDERING_PROOF` | `held` / `breached` | `ORDERING_PROOF:` | `evidence/49-guards.md` |

Every input above **must exist** in its named file carrying one of the values `SCHEMA.md`
declares for it. An absent line is not a pass, not a default, and not a defensible state — it
is an incomplete phase, and the honest action is a blocking report rather than a substituted
value.

**`DIFF_SCOPE_COVERAGE` is read from two files.** Because it is a property of an individual
rebuild run rather than a single fact about the gate, `SCHEMA.md` § 2.4 declares one
occurrence in the baseline evidence file and one in the movement evidence file. Every rule
below that reads `DIFF_SCOPE_COVERAGE` treats it as `incomplete` if **either** declared
occurrence reads `incomplete`, and as `complete` only when both do.

---

## Rules, first match wins

Twelve rules, `R1` through `R12`, evaluated in order. The ordering is deliberately red-biased
— every way of not knowing resolves to red before any way of passing is considered — mirroring
this project's established gate precedent (Phase 39's `R1`/`R2` absence-first ordering) rather
than inventing a new shape.

**R1 → `red`.** Any of the seven declared inputs is absent from its declared source file —
absence is never a pass. *Enforces ROADMAP Phase 49 success criterion 1: the verdict must be
derivable from a complete, committed measurement set, never from a gap silently read as a
pass.*

**R2 → `red`.** `ORDERING_PROOF` is `breached`. Rules written after a measurement make the
whole instrument advisory, so nothing evaluated below this rule can be trusted regardless of
what it reads. *Enforces success criterion 1: the decision rules must be committed to git
before any measurement is taken against them, and this rule is what makes that a checked
property rather than an assertion.*

**R3 → `red`.** `SECOND_PATH_GUARD` is `breached`. If the byte-diff the gate reports may not
be the one the gate claims to have run — because an unaudited second spawn or comparison site
exists — no byte-level result read below means anything. *Enforces success criterion 2: the
verdict must be derived from the exporter's own `expectedBytes` byte-diff and extend the
existing oracle rather than fork a second one; this rule is the mechanical check that the
fork never happened.*

**R4 → `red`.** Either `TREE_REBUILD` or `MOVEMENT_REBUILD` is `skipped`. No assembler ran, so
no claim about the bytes exists — `skipped` is never a pass. *Enforces success criterion 2:
the verdict must never read an unrun assembler as a byte-level result.*

**R5 → `red`.** `MOVEMENT_REBUILD` is `refused`. The phase criterion is that movement is
exercised on every run, not optionally — a same-address round trip or an absent movement input
is a refusal, not a pass. *Enforces success criterion 4: movement is exercised on every run,
and a same-address-only round trip is refused as a pass.*

**R6 → `red`.** Either `TREE_REBUILD` or `MOVEMENT_REBUILD` is `failed`. *Enforces success
criterion 2: a byte-diff mismatch against the exporter's own expected bytes is a failure, and
this rule is where that failure becomes the verdict.*

**R7 → `red`.** `DIFF_SCOPE_COVERAGE` is `incomplete` (on either declared occurrence, per
§ Inputs above). *Enforces success criterion 3's third planted control (a hazard-adjacent
range left outside the diff scope) by making an incomplete scope red on every run, not only
on the planted one.*

**R8 → `red`.** `RED_CONTROLS` is `partial` or `none`. A green result is not trusted before
the planted controls have been observed going red in the same run that produced it. *Enforces
success criterion 3: the gate must be observed going red on all three planted controls before
any green result is trusted.*

**R9 → `red`.** `HAZARD_DISPOSITION` is `blocked`. *Enforces success criterion 5: a non-clean
hazard report either blocks the gate or passes only with an explicit, recorded,
per-finding acknowledgement — this rule is the blocking half.*

**R10 → `acknowledged`.** `HAZARD_DISPOSITION` is `acknowledged` **and** every other input is
at its passing value (`TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok`, `DIFF_SCOPE_COVERAGE:
complete` on both occurrences, `RED_CONTROLS: all-observed`, `SECOND_PATH_GUARD: held`,
`ORDERING_PROOF: held`). *Enforces success criterion 5's other half: an explicit, recorded,
per-finding acknowledgement is the only path from "hazard found" to anything other than red —
never a silent green.*

**R11 → `green`.** Every input is at its passing value with `HAZARD_DISPOSITION: clean`
(`TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok`, `DIFF_SCOPE_COVERAGE: complete` on both
occurrences, `RED_CONTROLS: all-observed`, `SECOND_PATH_GUARD: held`, `ORDERING_PROOF: held`).
*Enforces every success criterion at once: this is the only rule that can produce `green`, and
it requires every other criterion's passing condition simultaneously.*

**R12 → `red`.** Catch-all. An input combination no rule above matched is an unanticipated
state and is never a pass. *Enforces success criterion 1's spirit structurally: a verdict is
never produced by falling through an incomplete rule set — every reachable input combination
resolves to a named rule, and an combination this table failed to anticipate resolves to red
rather than to silence.*

**Disjointness.** `R1` through `R11` are evaluated strictly in order and each is read as
conditioned on every rule above it having failed to match (first-match-wins), so no tuple of
the seven inputs can satisfy two of `R1`..`R11` at once in a way that changes which verdict is
recorded — the recorded rule id is always the first one whose stated condition holds. `R12` is
the exhaustive default: it fires exactly when none of `R1`..`R11` does, which is what makes
`red`/`acknowledged`/`green` (never a fourth "could not resolve" token) structurally the
complete output space of this table.

---

## Never a gate

Declared here so a later plan cannot promote them into the rule table above:

- **The VICE binary's version.** Provenance recorded beside the gate, never an input — the
  baseline is whatever stock ACME/VICE this phase's evidence files record, and a run on a
  later version invalidates nothing about the rule table itself.
- **ACME's exit status, taken alone.** Read only as one signal inside the oracle's own five
  ordered verdict rules (`acme-verify.ts`), never surfaced to this table directly and never a
  gate input in its own right.
- **The number of relocated symbols.** `MOVEMENT_REBUILD` records whether the relocated tree
  rebuilt, not how many symbols moved; a count is a fact recorded in
  `evidence/49-movement-rebuild.md` for a reader's benefit, never a rule antecedent.

---

## Status: frozen pre-commitment

This file is committed alongside `SCHEMA.md`, before any measurement exists, and may not be
edited, refined, re-scoped or clarified after the first measurement commit lands. A rule found
to be wrong after that point is recorded as an override in the verdict document
(`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md`) rather than silently corrected here.
