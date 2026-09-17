---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-15
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared evidence file. Paths are relative to
  # .planning/phases/50-equivalence-and-modifiability/. This is a single,
  # first run over the MODIFIED subject -- there is no prior run of this
  # gate against this subject to supersede.
  tree_rebuild: ok                 # evidence/50-03-modified-gate-run.md:46
  movement_rebuild: ok             # evidence/50-03-modified-gate-run.md:50
  hazard_disposition: acknowledged # evidence/50-03-modified-gate-run.md:54
  diff_scope_coverage: complete    # baseline: evidence/50-03-modified-gate-run.md:47 (complete), movement: evidence/50-03-modified-gate-run.md:51 (complete) -- both occurrences complete
  red_controls: all-observed       # evidence/50-03-modified-gate-run.md:136
  second_path_guard: held          # evidence/50-03-modified-gate-run.md:178 -- NARROWER evidence than Phase 49's own. See "## What this document does not claim" and the evidence file's own Part 3.
  ordering_proof: held             # evidence/50-03-modified-gate-run.md:215
---

This document carries YAML frontmatter, mirroring
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md`: `EQUIV-03` requires a
machine-readable `green` / `acknowledged` / `red` verdict for the MODIFIED
hazard subject, and a prose sentence in the body is not a machine-readable
verdict. ROADMAP Phase 50 criterion 4 requires the modified source
"reassembled through Phase 49's gate" -- this document is that re-run's own
record, over new inputs, through the identical unmodified gate module.

**The transcription rule, which is the whole basis of the verdict's
honesty.** Every value in this document is taken from a literal outcome
line at **column 0** of a named evidence file, cited by path relative to
`.planning/phases/50-equivalence-and-modifiability/`. Where a line appears
more than once in one file, the final occurrence is the one taken. Nothing
here is written from memory and nothing is taken from a plan SUMMARY's
paraphrase.

## Verdict

**`acknowledged` -- rule `R10` fired.** Every input is at its passing value
except `HAZARD_DISPOSITION`, which is `acknowledged` rather than `clean`: a
human accepted four named movement constraints -- the modified subject's own
real hazard report, disposed against a frozen, reasoned, per-finding array
built from that report -- each with a reason true of this run: that this
run's baseline rebuild does not relocate the thing the finding names.
`acknowledged` is not `green`. See "What the next phase may rely on" below.

`R10`'s text, reproduced verbatim from `src/mcp/vice/reassembly-gate.ts`:

> R10: HAZARD_DISPOSITION is acknowledged and every other input is at its
> passing value.

### The walk, in written order, first match wins

| Rule | Antecedent | Matched? | Why not (the transcribed value that fails a conjunct) |
|---|---|---|---|
| `R1` | any of the seven inputs absent or out of domain | no | all seven inputs present with a real, declared value |
| `R2` | `ORDERING_PROOF` is `breached` | no | `ORDERING_PROOF: held` |
| `R3` | `SECOND_PATH_GUARD` is `breached` | no | `SECOND_PATH_GUARD: held` |
| `R4` | `TREE_REBUILD` or `MOVEMENT_REBUILD` is `skipped` | no | `TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok` |
| `R5` | `MOVEMENT_REBUILD` is `refused` | no | `MOVEMENT_REBUILD: ok` |
| `R6` | `TREE_REBUILD` or `MOVEMENT_REBUILD` is `failed` | no | `TREE_REBUILD: ok`, `MOVEMENT_REBUILD: ok` |
| `R7` | `DIFF_SCOPE_COVERAGE` is `incomplete` (either occurrence) | no | `DIFF_SCOPE_COVERAGE` (baseline): `complete`, (movement): `complete` |
| `R8` | `RED_CONTROLS` is `partial` or `none` | no | `RED_CONTROLS: all-observed` |
| `R9` | `HAZARD_DISPOSITION` is `blocked` | no | `HAZARD_DISPOSITION: acknowledged` |
| `R10` | `HAZARD_DISPOSITION` is `acknowledged` and every other input passing | **yes** | all six other inputs at their passing value, `HAZARD_DISPOSITION: acknowledged` |

Rules `R11` and `R12` were never reached: `R10` is the first rule in the
committed table whose condition holds against the recorded inputs, and
first-match-wins means nothing below it is evaluated.

## What was measured

- **Subject.** The MODIFIED hazard subject
  (`src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg` and
  its store export, plan 50-02's own output), exported as a 16-block tree
  and reassembled by a real ACME (`acme`, release 0.97 "Zem", resolved on
  `$PATH`) -- 2279 bytes, byte-identical to the exporter's own
  `expectedBytes`, unchanged in overall length and block shape from the
  committed subject.
- **Assembler.** `acme`, release 0.97 "Zem", resolved on `$PATH` (no
  `ACME_BIN` override was needed on this run).
- **Movement.** `routine_a`, the same shared, purpose-built relocation
  subject Phase 49's own run used -- untouched by this phase's
  modification, reused rather than re-derived. Relocated by a delta of
  `261` bytes (`$0105`) from `$080B` to `$0910`, re-exported at the new
  layout (272 bytes across 4 blocks) and reassembled byte-identical
  through the same real ACME.
- **Hazard findings and undecided regions (this run).** The real hazard
  report over the MODIFIED subject carries **4 findings** and **0**
  undecided (`"unclassified"`) regions:
  - `indexed-dispatch` at `$081C` (`stack-return-dispatch`) -- unchanged
    from the committed subject's report.
  - `self-modifying-code` at `$0825` (`store-target-in-instruction-opcode-byte`)
    -- unchanged from the committed subject's report, though its
    reachability moved from never-called to called once (see below).
  - `page-alignment` at `$0881` (`charset-base-pinned-by-register`) --
    unchanged from the committed subject's report.
  - `cycle-exact-raster` at `$10C2` (`timer-reload-in-vectored-handler`) --
    unchanged from the committed subject's report.

  The committed subject's fifth finding, `page-alignment` at `$088B`
  (`sprite-pointer-names-aligned-base`), is **absent** from this run's
  report -- the construction that produced it was removed by this
  modification. All 4 present findings were acknowledged by the frozen,
  reasoned, per-finding array `src/mcp/vice/reassembly-gate-modified-run.test.ts`
  declares. 0 undecided regions remain, so no region acknowledgement is
  needed. The disposal is `acknowledged`.
- **Diff-scope extents.** Baseline: `$0801..$10E8` (exclusive). Movement:
  `$0801..$0911` (exclusive) -- the movement subject is independent of this
  phase's modification.

## The two behaviour changes

Both changes live in `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a`,
the modified subject's own alignment-routine file, plan 50-02's own output.
Neither is a new construction: each is anchored to a hazard-report finding
this project's own committed record already names.

**Removed -- anchor `$088B`, finding `page-alignment`, mechanism
`sprite-pointer-names-aligned-base`.** The committed subject's alignment
routine (`hazard-subject-align.a`) writes the sprite-0 pointer at `$07F8`,
enables sprite 0 at `$D015`, and positions it at `$D000`/`$D001`. The
modified subject removes all four of those stores. The sprite shape itself
(`align_sprite_base`, its `!fill 63` data) stays committed in the image --
only the code that points the VIC-II hardware at it is gone. The
consequence in the assembled image: `$07F8` is never written by the
modified subject at all, so nothing in the sprite-pointer's range names the
committed sprite shape's aligned base any more, and the finding that
existed only because that write existed does not appear in this run's
hazard report.

**Added -- anchor `$0825`, finding `self-modifying-code`, mechanism
`store-target-in-instruction-opcode-byte`.** The modified subject adds a
single `jsr hazard_smc2_entry` at the end of the alignment routine,
immediately before its `rts`. `hazard_smc2_entry`
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a`) is the
second, deliberately-undetected self-modifying construction the committed
subject's own design already carries but never calls -- this addition
makes it run for the first time. The consequence in the assembled image:
the finding's own bytes are unchanged (the construction was always
present), but its reachability moves from never-called to called once.
The consequence at runtime (recorded here as the predicted effect, not
measured by this document -- see below) is that the immediate operand byte
of the `lda` at `hazard_smc2_write` ($834) is rewritten from `$04` to `$05`
through a runtime-built zero-page pointer at `$FC`/`$FD`, and the routine's
final border-colour write at `$D020` comes from this construction's second
pass rather than from the dispatch routine's own first target.

## What this document does not claim

This document records a gate verdict for the MODIFIED subject and nothing
about behaviour in a running emulator. `TREE_REBUILD`, `MOVEMENT_REBUILD`
and `HAZARD_DISPOSITION` are static, ACME-only measurements -- they prove
the modified source reassembles to the bytes its own exporter expects and
that its hazard report is fully disposed, never that the removed or added
behaviour is actually observed taking effect on real hardware or in a real
emulator. The live transcript that plan 50-06 commits is where that
evidence lives. This document does not substitute for it and is not
evidence that the two behaviour changes above are visible at runtime.

This document's `second_path_guard` value is also narrower than Phase 49's
own: `src/mcp/vice/acme-seam.test.ts`, the tree-wide frozen-set guard Phase
49's own finding cited, was removed in commit `276c15c9` after Phase 49
closed. This run's own `held` value rests on `acme-verify.test.ts`'s
narrower, but still real, single-launch pin and on this plan's own grep
check that its new gate-run file adds no second launch -- see
`evidence/50-03-modified-gate-run.md`'s own Part 3 for the full statement
of what this narrower guard does and does not cover.

## Override -- this plan's own Task 2 `<verify>` column-zero assertion

`50-03-PLAN.md`'s own Task 2 `<verify>` block asserts that the seven
declared input-key names appear **at column zero** in this document
(`grep -ac '^\(tree_rebuild\|...\):'`). This document's frontmatter instead
nests every input key two spaces under a YAML `inputs:` mapping, on
`50-03-PLAN.md`'s own explicit instruction to carry "an `inputs:` block
with `tree_rebuild`, `movement_rebuild`, ...". `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md`
carries the identical nested structure, and the same literal column-zero
grep against that committed file also returns `0` -- measured directly as
part of this override. The rule found not to match reality is this plan's
own verify-command literal, never the document's own structure: a
whitespace-tolerant form of the same grep
(`grep -c '^\s*\(tree_rebuild\|...\):'`) checks that all seven keys are
present, each carrying a real value -- `7`, measured directly. `088B` and
`0825` each appear `2` times, satisfying the plan's other two `<verify>`
line-count assertions unmodified.
