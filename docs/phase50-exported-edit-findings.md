---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
verdict: acknowledged
verdict_rule_applied: R10
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared evidence file. Paths are relative to
  # .planning/phases/50-equivalence-and-modifiability/. This is a single,
  # first run over the EXPORTED-EDIT subject -- there is no prior run of
  # this gate against this subject to supersede.
  tree_rebuild: ok                 # evidence/50-08-exported-edit-gate-run.md:53
  movement_rebuild: ok             # evidence/50-08-exported-edit-gate-run.md:57
  hazard_disposition: acknowledged # evidence/50-08-exported-edit-gate-run.md:61
  diff_scope_coverage: complete    # baseline: evidence/50-08-exported-edit-gate-run.md:54 (complete), movement: evidence/50-08-exported-edit-gate-run.md:58 (complete) -- both occurrences complete
  red_controls: all-observed       # evidence/50-08-exported-edit-gate-run.md:149
  second_path_guard: held          # evidence/50-08-exported-edit-gate-run.md:192 -- NARROWER evidence than Phase 49's own, on the identical ground docs/phase50-modifiability-findings.md's own second_path_guard value already stands on. See "## What this document does not claim" below.
  ordering_proof: held             # evidence/50-08-exported-edit-gate-run.md:241
---

This document carries YAML frontmatter, mirroring
`docs/phase49-the-reassembly-gate-findings.md` and
`docs/phase50-modifiability-findings.md`: `EQUIV-03` requires a
machine-readable `green` / `acknowledged` / `red` verdict, and a prose
sentence in the body is not a machine-readable verdict. ROADMAP Phase 50
criterion 4 requires the source "reassembled through Phase 49's gate" --
this document is that re-run's own record, over a NEW subject, through the
identical unmodified gate module. Unlike `docs/phase50-modifiability-
findings.md`, which records the gate against the hand-written
`hazard-subject-modified.prg`, this document records the gate against
`hazard-subject-exported-edit.prg` -- the same two behaviour changes made
this time in a file `exportAsmTree()` itself emitted.

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
human accepted four named movement constraints -- the exported-edit
subject's own real hazard report, disposed against a frozen, reasoned,
per-finding array built from that report -- each with a reason true of this
run: that this run's baseline rebuild does not relocate the thing the
finding names.
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

- **Subject.** The EXPORTED-EDIT hazard subject
  (`src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg`
  and the COMMITTED store's own export, plan 50-08's own Task 1 output),
  exported as a 16-block tree and reassembled by a real ACME (`acme`,
  release 0.97 "Zem", resolved on `$PATH`) -- 2279 bytes, byte-identical to
  the exporter's own `expectedBytes`, unchanged in overall length and block
  shape from the committed subject.
- **The exported file the edits were made in.** Both behaviour changes were
  made in `scope_087a.a` -- the alignment routine's own scope file
  `exportAsmTree()` emits, resolved from that export's own `files` list
  rather than assumed -- and nowhere else. This is the property
  `docs/phase50-modifiability-findings.md`'s own hand-written twin does not
  carry: that document's two changes live in
  `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a`,
  a hand-written fixture source, never a file the decomposition's own
  exporter wrote.
- **Assembler.** `acme`, release 0.97 "Zem", resolved on `$PATH` (no
  `ACME_BIN` override was needed on this run).
- **Movement.** `routine_a`, the same shared, purpose-built relocation
  subject Phase 49's own run and plan 50-03's own run used -- untouched by
  this plan's edit, reused rather than re-derived. Relocated by a delta of
  `261` bytes (`$0105`) from `$080B` to `$0910`, re-exported at the new
  layout (272 bytes across 4 blocks) and reassembled byte-identical through
  the same real ACME.
- **The store route, measured rather than assumed.** The COMMITTED
  `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json` is
  used UNCHANGED, exported directly against
  `hazard-subject-exported-edit.prg`. This is the STRONGER of the two
  routes the plan named -- it says the original decomposition still
  describes the program after the edit, which is exactly the modifiability
  claim ROADMAP criterion 4 asks for -- and it is available because the
  edit preserves every block boundary and every symbol value (every source
  edit replaces removed bytes one-for-one in length; Task 1's own guard
  proves every other exported file is byte-identical to a fresh export).
  The round trip was measured, at plan-authoring time and again in this
  run, to reassemble byte-identical -- `TREE_REBUILD: ok` above. The
  refusal path (a third `SUBJECTS` entry in
  `make-hazard-subject-annostore.mjs`) was therefore never taken; no
  `hazard-subject-exported-edit.annostore.json` exists.
- **Hazard findings and undecided regions (this run).** The real hazard
  report over the EXPORTED-EDIT subject carries **4 findings** and **0**
  undecided (`"unclassified"`) regions:
  - `indexed-dispatch` at `$081C` (`stack-return-dispatch`) -- unchanged
    from the committed subject's report.
  - `self-modifying-code` at `$0825` (`store-target-in-instruction-opcode-byte`)
    -- unchanged from the committed subject's report, though its
    reachability moved from never-called to called once (see below). This
    run's own test asserts the construction's own bytes at `$0825`-`$0832`
    are byte-identical between the committed and exported-edit subjects.
  - `page-alignment` at `$0881` (`charset-base-pinned-by-register`) --
    unchanged from the committed subject's report.
  - `cycle-exact-raster` at `$10C2` (`timer-reload-in-vectored-handler`) --
    unchanged from the committed subject's report.

  The committed subject's fifth finding, `page-alignment` at `$088B`
  (`sprite-pointer-names-aligned-base`), is **absent** from this run's
  report -- the construction that produced it was removed by this edit.
  This run's own test asserts BOTH directions in the same run: the
  committed subject's report carries the `$088B` finding, and the
  exported-edit subject's report does not. All 4 present findings were
  acknowledged by the frozen, reasoned, per-finding array
  `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` declares. 0
  undecided regions remain, so no region acknowledgement is needed. The
  disposal is `acknowledged`.
- **Diff-scope extents.** Baseline: `$0801..$10E8` (exclusive). Movement:
  `$0801..$0911` (exclusive) -- the movement subject is independent of this
  plan's edit.

## The two behaviour changes

Both changes live in `scope_087a.a`, the file `exportAsmTree()` itself
emitted for the alignment routine's own scope -- resolved from the export's
own `files` list, not assumed by naming convention -- and nowhere else. The
pre-registered manifest driving both,
`src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json`, is
committed before the assembler ever ran against the edited tree. This is
the property `docs/phase50-modifiability-findings.md`'s own hand-written
twin does not carry: its two changes live in a hand-written fixture source
(`hazard-subject-align-nosprite.a`), never a file the decomposition's own
exporter wrote. Neither change here is a new construction: each is anchored
to a hazard-report finding this project's own committed record already
names.

**Removed -- anchor `$088B`, finding `page-alignment`, mechanism
`sprite-pointer-names-aligned-base`.** The committed subject's alignment
routine writes the sprite-0 pointer at `$07F8`, enables sprite 0 at
`$D015`, and positions it at `$D000`/`$D001`. The exported-edit subject
removes all four of those stores -- and the four immediate loads that feed
them -- replacing the freed 20-byte region one-for-one in length with
`nop`. The sprite shape itself (`align_sprite_base`, its `!fill 63` data,
exported as its own `external_file` block) stays committed in the image --
only the code that points the VIC-II hardware at it is gone. The
consequence in the assembled image: `$07F8` is never written by the
exported-edit subject at all, so nothing in the sprite-pointer's range
names the committed sprite shape's aligned base any more, and the finding
that existed only because that write existed does not appear in this run's
hazard report.

**Added -- anchor `$0825`, finding `self-modifying-code`, mechanism
`store-target-in-instruction-opcode-byte`.** The exported-edit subject adds
a single `jsr hazard_smc2_entry` inside the region the removal freed --
`symbols.a` already defines the symbol at `$0839`, and the `jsr` replaces
the first three of the freed region's twenty `nop`-padded bytes one-for-one
in length. `hazard_smc2_entry` is the second, deliberately-undetected
self-modifying construction the committed subject's own design already
carries but never calls -- this addition makes it run for the first time.
The consequence in the assembled image: the finding's own bytes are
unchanged (the construction was always present, measured byte-identical
between the two subjects at `$0825`-`$0832`), but its reachability moves
from never-called to called once. The consequence at runtime (recorded
here as the predicted effect, not measured by this document -- see below)
is that the immediate operand byte of the `lda` at `hazard_smc2_write`
(`$0834`) is rewritten from `$04` to `$05` through a runtime-built
zero-page pointer at `$FC`/`$FD`, and the routine's final border-colour
write at `$D020` comes from this construction's second pass rather than
from the dispatch routine's own first target.

## What this document does not claim

This document records a gate verdict for the EXPORTED-EDIT subject and
nothing about behaviour in a running emulator. `TREE_REBUILD`,
`MOVEMENT_REBUILD` and `HAZARD_DISPOSITION` are static, ACME-only
measurements -- they prove the exported-edit source reassembles to the
bytes its own exporter expects and that its hazard report is fully
disposed, never that the removed or added behaviour is actually observed
taking effect on real hardware or in a real emulator. The live transcript
this plan's own Task 3 commits
(`docs/phase50-exported-modifiability-transcript.md`) is where that
evidence lives. This document does not substitute for it and is not
evidence that the two behaviour changes above are visible at runtime.

This document's `second_path_guard` value is also narrower than Phase 49's
own, on the identical ground `docs/phase50-modifiability-findings.md`'s own
value already stands on: `src/mcp/vice/acme-seam.test.ts`, the tree-wide
frozen-set guard Phase 49's own finding cited, was removed in commit
`276c15c9` after Phase 49 closed. This run's own `held` value rests on
`acme-verify.test.ts`'s narrower, but still real, single-launch pin and on
this plan's own grep checks that neither its new driver
(`make-exported-edit.mjs`) nor its new gate-run file
(`reassembly-gate-exported-edit-run.test.ts`) adds a second launch -- see
`evidence/50-08-exported-edit-gate-run.md`'s own Part 3 for the full
statement of what this narrower guard does and does not cover.
