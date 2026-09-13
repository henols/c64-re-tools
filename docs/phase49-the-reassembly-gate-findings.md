---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
requirement: [BUILD-06]
probe_date: 2026-09-13
verdict: red
verdict_rule_applied: R7
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared source file. Paths are relative to
  # .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/.
  tree_rebuild: ok                 # evidence/49-tree-rebuild.md:48
  movement_rebuild: ok             # evidence/49-movement-rebuild.md:54
  hazard_disposition: blocked      # evidence/49-hazard-disposition.md:50
  diff_scope_coverage: incomplete  # evidence/49-tree-rebuild.md:49 (baseline: incomplete); evidence/49-movement-rebuild.md:55 (movement: complete) -- either occurrence incomplete makes this input incomplete, per SCHEMA.md S2.4
  red_controls: all-observed       # evidence/49-red-controls.md:85
  second_path_guard: held          # evidence/49-guards.md:164
  ordering_proof: held             # evidence/49-guards.md:165
---

This document carries YAML frontmatter, mirroring
`docs/phase39-dual-channel-coexistence-gate-findings.md`: `BUILD-06` requires
a machine-readable `green` / `acknowledged` / `red` verdict a downstream
phase reads as a precondition, and a prose sentence in the body is not a
machine-readable verdict. `SCHEMA.md` §5 fixed this document's key order,
in this order, before this file existed.

**The transcription rule, which is the whole basis of the verdict's
honesty.** Every value in this document is taken from a literal outcome
line at **column 0** of a named evidence file, cited by path relative to
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/`.
Where a line appears more than once in one file, the final occurrence is
the one taken. Nothing here is written from memory and nothing is taken
from a plan SUMMARY's paraphrase.

## Verdict

**`red` — rule `R7` fired.** The gate's byte-level machinery is sound —
both rebuilds passed (`TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok`), all
three planted controls were observed going red in the same run
(`RED_CONTROLS: all-observed`), and both structural guards held
(`SECOND_PATH_GUARD: held`, `ORDERING_PROOF: held`) — but the baseline
rebuild's own byte-diff scope did not cover everything the hazard report
itself flagged as undetermined: the committed subject carries one region
(`$087A..$0FFF`) the hazard report could not classify
(`"unclassified"`), and `hazardCoverageOutsideDiffScope()`'s committed rule
treats any such undecided region as making `DIFF_SCOPE_COVERAGE`
`incomplete`, unconditionally — a clean byte-diff over a scope that still
carries an unclassified region is silence about that region, not evidence
that it rebuilt correctly.

`R7`'s text, reproduced verbatim from `evidence/DECISION-RULE.md`:

> **R7 → `red`.** `DIFF_SCOPE_COVERAGE` is `incomplete` (on either declared
> occurrence, per § Inputs above). *Enforces success criterion 3's third
> planted control (a hazard-adjacent range left outside the diff scope) by
> making an incomplete scope red on every run, not only on the planted
> one.*

### The walk, in written order, first match wins

| Rule | Antecedent | Matched? | Why not (the transcribed value that fails a conjunct) |
|---|---|---|---|
| `R1` | any of the seven inputs absent | no | all seven inputs present with a real value |
| `R2` | `ORDERING_PROOF` is `breached` | no | `ORDERING_PROOF: held` |
| `R3` | `SECOND_PATH_GUARD` is `breached` | no | `SECOND_PATH_GUARD: held` |
| `R4` | `TREE_REBUILD` or `MOVEMENT_REBUILD` is `skipped` | no | `TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok` |
| `R5` | `MOVEMENT_REBUILD` is `refused` | no | `MOVEMENT_REBUILD: ok` |
| `R6` | `TREE_REBUILD` or `MOVEMENT_REBUILD` is `failed` | no | `TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok` |
| `R7` | `DIFF_SCOPE_COVERAGE` is `incomplete` (either occurrence) | **yes** | `DIFF_SCOPE_COVERAGE` (baseline occurrence): `incomplete` |

Rules `R8` through `R12` were never reached: `R7` is the first rule in the
committed table whose condition holds against the recorded inputs, and
first-match-wins means nothing below it is evaluated. In particular,
`HAZARD_DISPOSITION: blocked` (which would itself fire `R9`, two rules
later) is never reached — the verdict is `R7`'s, not `R9`'s, and this
document does not restate `R9`'s own text as if it had fired.

## What was measured

- **Subject.** The committed purpose-built hazard subject
  (`src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` and its store
  export), exported as a 12-file, 16-block tree and reassembled by a real
  ACME (`acme`, release 0.97 "Zem", resolved on `$PATH`) — 2279 bytes,
  byte-identical to the exporter's own `expectedBytes`. See
  `evidence/49-tree-rebuild.md`.
- **Assembler.** `acme`, release 0.97 "Zem", resolved on `$PATH` (no
  `ACME_BIN` override was needed on this run).
- **Movement.** `routine_a`, one symbol of a small, purpose-built
  relocation subject (plan 49-04's own subject, reused rather than
  duplicated — `src/mcp/vice/reassembly-gate-movement-subject.ts`),
  relocated by a delta of `261` bytes (`$0105`) from `$080B` to `$0910`,
  re-exported at the new layout (272 bytes across 4 blocks) and
  reassembled byte-identical through the same real ACME. See
  `evidence/49-movement-rebuild.md`.
- **Hazard findings and undecided regions.** The real hazard report over
  the committed subject carries 3 findings (`indexed-dispatch` at `$081C`,
  `self-modifying-code` at `$0825`, `cycle-exact-raster` at `$10C2`) and 1
  undecided (`"unclassified"`) region (`$087A..$0FFF`, an incomplete
  VIC-II register recovery). All 3 findings were acknowledged by a frozen,
  reasoned, per-finding array; the 1 undecided region was not — the
  disposal is `blocked`, not `acknowledged`, exactly as the plan's own
  instruction states no entry is added to a disposition to make a run
  pass. See `evidence/49-hazard-disposition.md`.

## Why the verdict is what it is

`R7` fired because the baseline rebuild's own diff-scope coverage is
`incomplete` — not because of a byte-diff mismatch, not because of the
hazard disposition (which, while `blocked`, is not what produced this
verdict; see the walk table above), and not because either structural
guard failed. The one input that made this run red is the same subject's
own permanent, pre-existing incompleteness in VIC-II register recovery
(`evidence/49-tree-rebuild.md`'s own citation), unrelated to anything this
plan's own movement or acknowledgement work introduced.

## What the next phase may rely on

The verdict token and the rule id above are the machine-readable
precondition: `verdict: red`, `verdict_rule_applied: R7`. **A verdict other
than `green` means the equivalence work reads a gate that did not pass
cleanly** — this is stated plainly here, not only in the frontmatter. The
next phase's equivalence claims must account for the fact that this run's
own diff-scope coverage was incomplete over a real, permanent gap in this
subject's own hazard classification, not merely a byte-level defect that a
later run might quietly fix. Per this plan's own prohibition, this verdict
is recorded as the finding — it is not re-measured with a different
subject, a different scope, or a narrower extent to obtain a better one.

## Ordering

The rule table's add-commit (`DECISION-RULE.md`, `4df0f567a7a980ae64985c65061fe5968761f625`)
touched exactly one file — itself — and the schema's own add-commit
(`SCHEMA.md`, `b6953618c972a0a88d92f84d9e5a015367f61601`) touched exactly
one file — itself. Both are the first two commits this whole phase made;
every measurement commit (`f681e76a` onward, through this plan's own
`0ba1872e`) postdates both. See `evidence/49-guards.md`'s own `ORDERING_PROOF`
section for the full `git log`/`git show` transcript this section
summarizes.

## Override — this plan's own Task 2 `<verify>` line-count assertion

`evidence/49-tree-rebuild.md` and `evidence/49-movement-rebuild.md` each
record an `## ACCEPTED LIMIT`: this plan's own Task 2 `<verify>` command
asserts that the seven declared outcome-line names appear **exactly seven
times total**, at column zero, across the five evidence files. `SCHEMA.md`
§2.4 and §3 require `DIFF_SCOPE_COVERAGE` to appear as its own bare line in
**two** separate declared files (once per rebuild run), which makes the
schema-correct total **eight**, not seven — measured directly: the count
is `8`. This document records the override the two evidence files'
`ACCEPTED LIMIT` sections point to: the rule that was found not to match
reality is this plan's own verify-command literal, not a rule in the
frozen `DECISION-RULE.md` table (which is unaffected and unedited), and the
departure taken is to write both `DIFF_SCOPE_COVERAGE` occurrences in full,
as `SCHEMA.md` requires, rather than omit one to make an unrelated count
assertion pass. Omitting either occurrence would have made that occurrence
ABSENT from its declared source file, which `SCHEMA.md` §1/§4 states is
never a pass and never a defensible state — a worse outcome than a
verify-command miscount. `SCHEMA.md` and `DECISION-RULE.md` themselves are
unedited (`git diff --quiet HEAD -- DECISION-RULE.md SCHEMA.md` in the
repository root passes clean, confirmed as part of this task's own
verification).
