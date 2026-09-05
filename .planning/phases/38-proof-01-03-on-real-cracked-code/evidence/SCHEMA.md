# Phase 38 — the outcome-line schema

**Binding. Committed before any measurement exists.** Every literal outcome-line
name any later plan in this phase may emit is fixed here, together with its
value domain and the single evidence file that is its declared source. A
measuring plan that needs a name not declared below has found a gap in this
pre-commitment; it records that gap as an `## ACCEPTED LIMIT` in its **own**
evidence file, and the findings document (if one is ever written for this
phase) records an explicit override. **It does not invent a name, and it does
not edit this file.**

Unlike Phase 33's `GATE-01`, this phase is not gate-and-rule-shaped: there is no
`DECISION-RULE.md` sibling and no first-match-wins verdict rule. This file
declares the vocabulary only — what a name may hold and where it lives — not a
decision procedure that reads it.

---

## 1. Outcome-line conventions

Ported unchanged, in substance, from Phase 33's own `SCHEMA.md` §1 — the same
four rules bind every evidence file this phase produces.

- **Column 0, bare `NAME: value`.** Every recorded fact is a bare `NAME: value`
  at column 0 of a named evidence file. Never indented, never inside a fenced
  block a reader would take for sample output, never inside a table cell.
- **Final occurrence wins.** Where a line is written more than once in one
  file, the last occurrence is the value.
- **One declared source file per line.** The tables below name exactly one
  file per line name (or, for the two lines in §6 that are recorded across
  every live-run file by design, the class of file that is their source).
  A line written into a second file is not a second opinion; it is a name
  collision, and the declared file is the one that counts.
- **Transcripts are appended, never reconstructed.** The `$ <command>`
  transcript convention, `BROKER_STATE:` / `TEST_AUTOMATED_BASELINE:`, and the
  voided-run rule are in `README.md` § *Evidence conventions*, binding on
  every plan in this phase.

**Absence.** Absence is permitted only where the branch that would write a
line was genuinely not taken (e.g. `PROOF02_DEPACKED_*` lines when the
depacked capture was not obtained), and is stated as such rather than left
silent. Absence is never a substitute for a value this phase's own
requirements demand.

---

## 2. PROOF-01 outcome lines

Declared source file for every line in this table: `evidence/proof01-dxa-real-release.md`.

| Line | Domain |
|---|---|
| `PROOF01_RELEASE_ID` | free text naming the release, e.g. `danish` |
| `PROOF01_RELEASE_SHA256` | 64 hex chars, the corpus `.d64`'s own sha256 |
| `PROOF01_ENTRY_NAME` | free text, the `.d64` directory entry name exactly as `listEntries()` returns it |
| `PROOF01_ENTRY_SHA256` | 64 hex chars, the extracted entry's own sha256 |
| `PROOF01_ENTRY_BYTES` | non-negative integer, the extracted entry's byte length |
| `PROOF01_ENTRYPOINTS` | free text, `$xxxx`-shaped address(es) passed to `runDxaDisassemble()` |
| `PROOF01_GROUND_TRUTH_TIER` | exactly one of `byte-derived` \| `source-derived` |
| `PROOF01_POSITIVE_CLASS` | exactly `data` |
| `PROOF01_DATA_RECOVERY_PCT` | `formatPercent()`'s `NN.NN (numerator/denominator)` shape when `denominator > 0`; a named refusal naming the zero denominator when `denominator === 0`. A bare percentage with no fraction, `0.00`, `NaN` or `100.00` printed in place of the refusal are all outside this domain |
| `PROOF01_FALSE_POSITIVES` | **the single literal `structurally-uncomputable`, followed by a parenthesised reason.** An integer is **NOT** in this line's domain, per D-03 and `dxa-partition.ts:462-464`'s own doc comment that `certainCode` is ALWAYS empty on the byte-derived tier |
| `PROOF01_UNCLASSIFIED_OVERLAP` | non-negative integer — a certain-data address dxa's own listing reported `unclassified`; counted in neither the recovered numerator nor any false-positive tally |
| `PROOF01_DXA_CODE_ADDRESSES` | non-negative integer, `res.map.code.size` |
| `PROOF01_DXA_DATA_ADDRESSES` | non-negative integer, `res.map.data.size` |
| `PROOF01_WEAKNESS_NO_EXTERNAL_CHECK` | free text — the absent execution oracle (`memmapshow`), stated with its reversal condition |
| `PROOF01_WEAKNESS_UNCOMPUTABLE_FP` | free text — the ground-truth *design* limit (distinct from the oracle's *availability*), per D-03: neither weakness is ever folded into the other |
| `PROOF01_CAPTURE_PAIR` | `none` when this measurement reports no capture pair (this plan's expected value — PROOF-01 takes no live capture) |
| `FIXTURE_DATA_RECOVERY_PCT` | `formatPercent()` shape, recorded value `72.39 (97/134)`, cited to `docs/phase23-real-release-gate-findings.md` — never re-derived |
| `FIXTURE_FALSE_POSITIVES` | non-negative integer, recorded value `3` |
| `FIXTURE_REPRODUCED` | exactly `no` |
| `PIVOT_PUBLISHED_DATA_RECOVERY_PCT` | `formatPercent()` shape, recorded value `72.46 (100/138)` — the pivot's own published figure, beside the fixture, never as ground truth |
| `PIVOT_PUBLISHED_FALSE_POSITIVES` | non-negative integer, recorded value `0` |
| `PIVOT_REPRODUCTION_STATUS` | exactly `not-reproduced` |
| `PIVOT_NON_REPRODUCTION_CAUSE` | free text beginning with the literal word `hypothesis` — never written as a finding |

---

## 3. PROOF-02 outcome lines

| Line | Domain | Declared source file |
|---|---|---|
| `PROOF02_SITES_METHOD` | free text naming the independent, non-Ghidra site-enumeration route (e.g. raw `$6C` opcode scan / `dxa -a dump` grep) | `evidence/proof02-loader-stage.md` |
| `PROOF02_CIRCULARITY_GUARD` | free text stating the D-06 guard: sites are enumerated and recorded BEFORE any check of what Ghidra resolved | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_IMAGE_SHA256` | 64 hex chars, the extracted loader/depacker-stage image's sha256 | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_ENTRYPOINTS` | free text, `$xxxx`-shaped address(es) | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_SITES_ENUMERATED` | non-negative integer, total candidate indirect-dispatch sites found at this depth | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_SITES_COMPUTED_INDEX` | non-negative integer, the subset whose index is computed (not immediate) | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_SITES_IMMEDIATE_INDEX` | non-negative integer, the subset whose index is an immediate constant (the pivot fixture's own `ldx #$02` shape) | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_COMPUTED_DISPATCH` | exactly one of `resolved` \| `unresolved` \| `not-exercised` | `evidence/proof02-loader-stage.md` |
| `PROOF02_LOADER_SEARCH_DEPTH` | free-text depth statement naming which entry points and which image the search covered; **required whenever any `PROOF02_LOADER_COMPUTED_DISPATCH` line is present — absence alongside that line is not permitted** | `evidence/proof02-loader-stage.md` |
| `PROOF02_DEPACKED_SITES_ENUMERATED` | non-negative integer, over the depacked flat-64K image | `evidence/proof02-depacked-capture.md` |
| `PROOF02_DEPACKED_SITES_COMPUTED_INDEX` | non-negative integer | `evidence/proof02-depacked-capture.md` |
| `PROOF02_DEPACKED_SITES_IMMEDIATE_INDEX` | non-negative integer | `evidence/proof02-depacked-capture.md` |
| `PROOF02_DEPACKED_COMPUTED_DISPATCH` | exactly one of `resolved` \| `unresolved` \| `not-exercised` | `evidence/proof02-depacked-capture.md` |
| `PROOF02_DEPACK_PROGRESS` | free text — measured evidence the captured image contains bytes the statically extracted `.prg` does not, or a plain statement that it does not | `evidence/proof02-depacked-capture.md` |
| `PROOF02_CAPTURE_OBTAINED` | `yes` \| `no`, with a reason required when `no` | `evidence/proof02-depacked-capture.md` |
| `PROOF02_CAPTURE_IMAGE_SHA256` | 64 hex chars, absent when `PROOF02_CAPTURE_OBTAINED: no` | `evidence/proof02-depacked-capture.md` |
| `PROOF02_CAPTURE_ORACLE_TERMS` | free text — **required in any file reporting a capture**: the two-term `(PC, hit_count)` stop oracle, `GATE-01`'s `D-04` narrowing | `evidence/proof02-depacked-capture.md` |
| `PROOF02_CAPTURE_FRAME_TERM` | free text — the frame term `(LIN, CYC)` recorded but not asserted; **a file reporting NO capture writes `PROOF0N_CAPTURE_PAIR: none` instead of leaving this absent** | `evidence/proof02-depacked-capture.md` |
| `PROOF02_SITES_ENUMERATED` | non-negative integer — the roll-up total across whichever depth(s) were actually searched | `evidence/proof02-computed-dispatch.md` |
| `PROOF02_SEARCH_DEPTH` | free text — the roll-up depth statement (`loader-only` or `loader-and-depacked`), naming which per-depth file(s) it was derived from | `evidence/proof02-computed-dispatch.md` |
| `PROOF02_COMPUTED_DISPATCH` | exactly one of `resolved` \| `unresolved` \| `not-exercised` — the roll-up verdict | `evidence/proof02-computed-dispatch.md` |

**A stated rule, not an aside:** the `PROOF02_*_COMPUTED_DISPATCH` domain
(`resolved` / `unresolved` / `not-exercised`, all three lines above) explicitly
**excludes** two spellings a careless measuring plan might reach for:

- Phase 23's own `could-not-run` spelling is **not** a member — the corpus now
  exists on disk, so the reason `could-not-run` existed (no corpus) no longer
  applies anywhere in this phase.
- `pass` is **not** a member either — a searched-and-empty corpus is
  `not-exercised`, never a pass. A "pass" implies the property under test was
  satisfied; an absent computed dispatch at a given depth proves nothing about
  a depth not searched, so it earns the honestly-scoped `not-exercised` label,
  never the flattering one.

---

## 4. PROOF-03 outcome lines

Declared source file for every line in this table: `evidence/proof03-bank-boundary.md`.

| Line | Domain |
|---|---|
| `PROOF03_FIXTURE` | free text naming the committed fixture, `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` |
| `PROOF03_FIXTURE_PRG_SHA256` | 64 hex chars, the committed `.prg`'s own sha256 |
| `PROOF03_EXPORT_SHA256` | 64 hex chars, the committed real Ghidra export's own sha256 (`export-bank-path-dependent.txt`) |
| `PROOF03_TWO_BANK_STATES` | free text naming the two `$01` values exercised (`$34`, `$33`) and confirming, by direct string inequality, that the same address annotates differently under each |
| `PROOF03_FORWARD_CARRY_WRONG_AT` | free text naming the disagreeing-values program point where forward-carrying (taking the first reaching value) produces a confident, specific, WRONG label |
| `PROOF03_AGREEING_VALUES_BRANCH` | one of `JoinDecision.outcome`'s own vocabulary (`anno-join.ts:199-205`): `annotated` \| `declined` \| `skipped-in-image` \| `skipped-no-entry` — the branch taken at a program point reached by two const-write facts carrying the SAME `$01` value |
| `PROOF03_DISAGREEING_VALUES_BRANCH` | same vocabulary as above — the branch taken at a program point reached by two DIFFERENT `$01` values |
| `PROOF03_CONSTWRITES_ABSENT_BRANCH` | same vocabulary — the branch taken when `constWrites` is `undefined` (the bank machinery is a complete no-op) |
| `PROOF03_CONSTWRITES_EMPTY_BRANCH` | same vocabulary — the branch taken when `constWrites` is `[]` (activated with zero facts) |
| `PROOF03_ORDERING` | free text stating the ordering rule the committed code uses where reaching values or decisions compare equal |
| `PROOF03_CAPTURE_PAIR` | `none` — this measurement takes no live capture; stated rather than left absent, so `GATE-01`'s two-term narrowing is explicitly shown to have nothing to attach to here |

---

## 5. `PROOF02_COMPUTED_DISPATCH` (roll-up) and per-depth values — worked example of the domain rule

To make the exclusion in §3 concrete: if the loader/depacker stage (searched by
plan `38-03`) is `not-exercised` at that depth (no computed dispatch found, but
only the BASIC-stub/loader entry points were reached) and the depacked stage
(searched by plan `38-04`, if obtained) is also `not-exercised`, the roll-up
`PROOF02_COMPUTED_DISPATCH` is `not-exercised`, citing both per-depth files and
naming the total sites the union of both searches covered. If the depacked
capture is never obtained at all, the roll-up takes the loader-stage value
verbatim and `PROOF02_SEARCH_DEPTH` names the fallback explicitly, per plan
`38-04`'s own `must_haves`.

---

## 6. Recorded lines that never gate

Declared so no plan mints a variant name. This phase carries no rule table to
gate against in the first place (§ opening), so this section exists purely to
fix the vocabulary and the recording discipline — not, as in Phase 33, to
distinguish gate inputs from non-gate inputs.

| Line | Domain | Declared source file | Note |
|---|---|---|---|
| `BROKER_STATE` | `inactive` \| `active` | every evidence file carrying a live run | `inactive` is the only value a trusted measurement is taken against; a measurement recorded against `active` is **discarded and re-run, never repaired** |
| `TEST_AUTOMATED_BASELINE` | free text, `tests <N> / pass <N> / fail <N>` | `evidence/README.md` — **stated once there, cited thereafter, never re-derived, and never a gate** | The floor is a recorded baseline, not a target. A number differing from Phase 37's own closing baseline is a fact to record, not a discrepancy to fix |
