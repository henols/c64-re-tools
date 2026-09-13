# Requirements: c64-re-tools — Milestone v1.0.0

**Defined:** 2026-09-10
**Milestone:** v1.0.0 "The Rebuild Half"
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.

**Frame.** This milestone delivers the "and rebuild" half that `PROJECT.md` →
What This Is has claimed since v0.1.x and never shipped: from an annotated binary
to ACME source a person can actually read, change, reassemble and observe
behaving identically. The requirement text below is v0.5.0's, where it was cut
and has stood unchanged since — **with two deliberate departures recorded in
`## Departures from the v0.5.0 text` rather than applied silently.** Phase
numbering continues from 44, so this milestone starts at **Phase 45**.

## The governing constraint

**The tool reports; the end-user decides what gets reverse-engineered.**
(Owner decision, 2026-09-10, taken at this milestone's open.)

No requirement in this milestone may instruct the pipeline to remove, strip,
drop or exclude any particular part of a subject binary on its own judgement.
Surfacing evidence is in scope; deciding on the user's behalf is not. `BUILD-04`
was already the correct model and is unchanged — it **enumerates** what blocks
movement and acts on none of it. `BUILD-05` was reworded and `BUILD-07` added so
the same rule holds across the whole export path, and `BUILD-07` exists
specifically to make it *checkable* rather than merely stated.

## Two settled bars, carried forward from v0.5.0 unchanged

Stated once so no requirement below has to restate them.

- **Byte-identity is not the acceptance bar.** In the owner's words: *"byte
  identical is nothing I care about but the function of it be identical."* This
  is structural rather than preference — unlike every named prior-art
  disassembly project, this project has no clean original binary to match
  against, only a provenance-graded composite with some ranges `HIGH` confidence
  and others honestly `UNKNOWN`. "Byte-identical to what?" has no well-defined
  answer here. A *narrower, optional* pre-modification byte-identical sanity
  check is fine and is not this.
- **Proving ground is committed synthetic fixtures only.** No copyrighted game
  image enters this repository. Re-confirmed by measurement at this open rather
  than assumed: `danish.d64` and `saeger.d64` exist on disk under
  `.planning/phases/23-*/evidence/corpus/` but appear in no `git ls-files`
  output. Applying the pipeline to a real title is downstream use, not this
  milestone's evidence — it remains `FUT-05`.

## v1.0.0 Requirements

### Decomposition

- [x] **DECOMP-01**: Nothing is left `Undefined` on the committed synthetic fixtures — every byte is code, byte, word, address, PETSCII, screencode or table. The completeness gate takes `anno_evid_disagreements` as a **required** input, not an optional cross-check, and respects the soundness asymmetry the type system already enforces: observed-executing **is** code, while never-observed proves nothing and cannot be rendered as `data`
- [x] **DECOMP-02**: Every code entry point carries a user-set name and a purpose comment stating function, inputs, outputs and side effects — no `p_XXXX` or `l_XXXX` left
- [x] **DECOMP-03**: Every referenced non-hardware address is named and documented
- [x] **DECOMP-04**: Hardware register writes render as named enums rather than magic numbers

### Rebuildable Source

- [x] **BUILD-01**: Export emits one ACME source file per annotation-store scope, wired by `acme-build`'s `!source` and assembling to a single output
- [x] **BUILD-02**: Data tables are extracted to their own files, so graphics, levels and music can be swapped without touching code
- [x] **BUILD-03**: Every branch, `JSR`/`JMP` and data reference goes through a symbol, so code can move
- [x] **BUILD-04**: A hazard report enumerates what blocks movement across four classes — indexed jump tables including the RTS-trick idiom, self-modifying code, page-alignment dependence, and cycle-exact raster code. It reports and never acts. The purpose-built synthetic subject carrying all four classes is delivered **in this same phase**, so fixture and detector are reviewed together against a non-vacuity bar rather than the fixture being written to match the detector
- [x] **BUILD-05**: The rebuild is provenance-aware: `c64-provenance-diff`'s verdict is carried to point of use so that for any range the operator can see what the evidence says about it. **What gets reversed, kept or left out is the end-user's decision, never the tool's** — the export emits every byte in scope by default, and any exclusion is one the user asked for, made explicit and recorded rather than silently applied
- [x] **BUILD-06**: Reassembly plus a clean hazard report is a gate that exists before the phase it gates runs, not after
- [x] **BUILD-07**: The export path is lossless by default — no range is dropped, filtered, or omitted on the tool's own judgement, and a user-requested exclusion is emitted as a recorded excluded range rather than a hole. Proven by a planted control: a fixture where a heuristic *would* want to drop a range, showing the range survives

### Equivalence and Modifiability

- [ ] **EQUIV-01**: `compare.mjs` works in original-versus-different-binary mode — narrowed volatile mask so a real `$D020`/`$D015`/`$D018` regression cannot hide, an allowlist for intentional differences, and per-binary logical checkpoints — a mode it has never been run in
- [ ] **EQUIV-02**: Behavioural equivalence between the original and the rebuild is demonstrated in VICE, with a committed transcript as the artifact of record rather than a described walkthrough
- [ ] **EQUIV-03**: Modifiability is demonstrated, not described — one behaviour removed and one added in the rebuilt source, reassembled, both observed taking effect in VICE, transcript committed
- [ ] **EQUIV-04**: The synthetic fixtures are committed and the whole pipeline is runnable in CI

### Fork-Backend Removal (Phase 52)

- [x] **FORKRM-01**: `VICE_BACKEND`, `probeBackend()`, `resolvedBackend()`'s fork branch and `buildBackendAwareTool()` are gone, every `backend === "fork"` test branch is removed rather than skipped, and no module imports a fork transport. One backend means no backend selection.
- [x] **FORKRM-02**: `.planning/PROJECT.md`'s `FORK-01` row and its `### Out of Scope` fork bullet state the REVERSAL with its date and basis, and `docs-fork-decision.test.ts` is rewritten to pin the new decision rather than deleted.
- [x] **FORKRM-03**: SID read-back, matrix keyboard and RESTORE/NMI are recorded as ACCEPTED, dated, with their evidence, in `docs/stock-hard-losses.md`, and they stop being routed to the fork anywhere in shipped skill text.
- [x] **FORKRM-04**: `DENY_LIST` and `denyListRefusalMessage()` are gone along with their consumers, and `anno-tools.ts`'s inverted allowlist (`CURATED_ANNO_TOOLS`, `assertAnnoBatch`, `ANNO_MAX_BATCH_DEPTH`) is unchanged and still guarded.
- [x] **FORKRM-05**: `capability-registry.ts` is resolved by a recorded decision, not left half-referenced.
- [x] **FORKRM-06**: `tools-manifest.stock.json` is the only manifest; `refresh-manifest.ts` and `tools-manifest.json` are gone and nothing regenerates a manifest from a live host.
- [x] **FORKRM-07**: `npm run test:automated` is green at the documented failure-set floor, with every fork-conditional test branch removed rather than skipped.

### Operator-Owned `docs/` (Phase 53)

Owner ruling, 2026-09-13: `docs/` is the operator's own documentation tree.
Generated phase artifacts do not belong in it. A `docs/evidence/` subfolder was
proposed and explicitly rejected -- confining the contamination is not removing it.

- [ ] **DOCS-01**: No GSD-generated artifact is written under `docs/`. The 21
  `docs/phase*.md` files are relocated to the phase artifact tree, matching the
  `evidence/` convention 17 phase directories already follow. Stock GSD prescribes
  no evidence directory, so the destination is this project's existing one:
  `.planning/phases/NN-<slug>/evidence/`.
- [ ] **DOCS-02**: `docs/phase0-binmon-findings.md` gets a recorded home decision.
  It predates `.planning/` by one day (committed 2026-08-11; the roadmap landed
  2026-08-12), has no phase directory to return to, and is the most-cited file of
  the set. Whatever is decided is written down rather than left implicit.
- [ ] **DOCS-03**: Zero `docs/phase*.md` citations remain in `src/**` or `tools/**`.
  Each is replaced by the REASON it stood for, per ENGINEERING_RULES section 21.2 --
  never repointed at a `.planning/` path, which that rule's criterion 4 names as the
  same defect one hop along. Measured 2026-09-13: 42 citing files, of which 15 fall
  inside Phase 51's `files[]` scope and 27 fall outside it.
- [ ] **DOCS-04**: A guard fails the build when a `docs/phase*` path appears in
  `src/**` or `tools/**`, and is proven non-vacuous by a planted citation. Without
  it the pattern returns at the next phase -- it has recurred at every phase since
  2026-08-11 purely by precedent.

## Departures from the v0.5.0 text

Recorded explicitly, because these 14 requirements had stood byte-identical
since they were cut and a silent edit would erase that fact.

| Requirement | Departure | Why |
|---|---|---|
| `BUILD-05` | Reworded. Was: *"cracker patches are deliberately excluded rather than inherited"* | That wording made the **tool** the decider. Owner decision 2026-09-10: the tool reports, the end-user decides what gets reverse-engineered |
| `BUILD-07` | **New** — did not exist in v0.5.0 | `BUILD-05`'s rewording states an invariant; `BUILD-07` makes it checkable by a planted control rather than leaving it as prose |
| `DECOMP-01` | Extended, not reworded — original sentence intact, gate condition appended | v0.9.0 shipped the execution oracle (`anno_evid_exec`, `reconcileObservedExecution()`). Research identified it going uncashed as the milestone's most dangerous integration gap |
| `BUILD-04` | Extended, not reworded — four classes intact, delivery of the synthetic subject bound into the same phase | Owner decision 2026-09-10 (Strategy B). A fixture built ahead of its detector gets written to match it — the `COV-01` failure mode this project measured across four verification rounds |

## Future Requirements

Acknowledged, deferred, not in this roadmap. `FUT-01`..`FUT-05` carry forward
from `milestones/v0.5.0-REQUIREMENTS.md` unchanged except where noted.

### Deferred

- **FUT-05**: Applying the pipeline to a real title (`bruce_lee`, where two cracked releases and a provenance ledger already exist). *Unchanged, and now the natural successor to this milestone: the pipeline is proven on synthetic fixtures here, and a real title is downstream use.*
- **FUT-06**: A fifth movement-hazard class — packed/crunched images whose depacker hardcodes an unpack destination. *Raised by this milestone's Features research as a reasoned addition, not independently corroborated. Deliberately NOT folded into `BUILD-04`, whose four classes are the v0.5.0 text.*
- **FUT-07**: `DISPLAY_GET` framebuffer diffing as a second equivalence signal. *Deferred until memory-based comparison (`EQUIV-01`) is proven; adding a second signal before the first is trusted measures agreement between two unvalidated instruments.*
- **FUT-08**: A `name` column on `anno_scope` (`SCHEMA_VERSION` 5). *Not needed: per-scope filenames derive deterministically from `scope.start`. Revisit only if a human-authored scope name becomes a product requirement.*
- **FUT-09**: Hazard-detector precision measured against real cracked titles. *Depends on `FUT-05`. Synthetic-fixture validation is this milestone's bar.*

## Out of Scope

Explicitly excluded, with reasoning, to prevent scope creep and re-adding.
The first ten rows carry forward from `milestones/v0.5.0-REQUIREMENTS.md`; the
last four are added at this open.

| Feature | Reason |
|---------|--------|
| Byte-identical rebuild as the acceptance bar | Structurally undefined here — no clean original exists, only a provenance-graded composite. A *narrower, optional* pre-modification byte-identical sanity check is fine and is not this |
| C or high-level decompilation output | The deliverable is modifiable 6502 assembly; a C rendering is neither reassemblable to the same program nor what a C64 rebuild is edited in |
| Automatic relocation or rebasing | No general solution exists for 6502; the hazard report enumerates what blocks movement instead of pretending to solve it. **Independently corroborated at this open**: no surveyed prior-art project attempts it |
| Auto-renaming with no evidence bar | Defeats `COV-02` by construction and manufactures confident nonsense — the failure mode `c64-provenance-diff` was built to prevent |
| A GUI, and HTML export | HTML export was cut once already at v0.3.0 (`ANNO-07`) as an artifact no skill produces or consumes |
| Non-C64 targets, and multi-assembler output | No measured caller. ACME is this project's assembler |
| A copyrighted game image in this repository | Synthetic fixtures only; keeps the pipeline CI-runnable and the repo distributable |
| The two upstream contributions (`KEYBOARD_MATRIX_SET`, and the retired analyser's port flags) | Unchanged since v0.4.0 — pull requests against projects this repo does not own |
| A `da65` `.info` generator and a ca65+ld65 rebuild route | An **anti-feature**, five of six grounds measured at v0.8.0: a `TYPE SKIP` hole collapsed and the rebuild assembled cleanly to a **wrong binary** |
| A persisted `program.json` as a parallel model | `.annostore` is the single substrate; a second model is drift with extra steps |
| **Any pipeline behaviour that removes, strips, drops or excludes part of a subject binary on its own judgement** *(added v1.0.0, owner decision 2026-09-10)* | The governing constraint above. Includes auto-stripping cracktros, loaders or cracker patches. The tool surfaces provenance; the operator decides. Reverses only on an explicit owner decision, never on a plan's convenience |
| **New npm runtime dependencies and new host prerequisites** *(added v1.0.0, 2026-09-10)* | Research verdict: every capability is reachable by extending code this project already owns. A new dependency here would be the first in two milestones and needs its own decision, not a plan's assumption |
| **A store table for the hazard report** *(added v1.0.0, 2026-09-10)* | It is a derived query over existing tables, following `reconcileObservedExecution()`'s pattern. A table would be a second, staleable copy of facts the store already holds |
| **Reaching ACME, or any host binary, by any route other than `runHostTool()`** *(added v1.0.0, 2026-09-10)* | Unchanged project law, restated because this milestone spawns ACME more than any before it. The CI gate banning other routes has been observed biting on planted violations |

## Traceability

Populated by roadmap creation. Every v1.0.0 requirement maps to exactly one
phase; none are orphaned or duplicated. Full phase Goals / Depends-on /
Success-Criteria live in `.planning/ROADMAP.md` → "Phase Details".

| Requirement | Phase | Status |
|-------------|-------|--------|
| DECOMP-01 | Phase 45 | Complete |
| DECOMP-02 | Phase 45 | Complete |
| DECOMP-03 | Phase 45 | Complete |
| DECOMP-04 | Phase 45 | Complete |
| BUILD-01 | Phase 47 | Complete |
| BUILD-02 | Phase 47 | Complete |
| BUILD-03 | Phase 47 | Complete |
| BUILD-04 | Phase 48 | Complete |
| BUILD-05 | Phase 46 | Complete |
| BUILD-06 | Phase 49 | Complete |
| BUILD-07 | Phase 46 | Complete |
| EQUIV-01 | Phase 50 | Pending |
| EQUIV-02 | Phase 50 | Pending |
| EQUIV-03 | Phase 50 | Pending |
| EQUIV-04 | Phase 50 | Pending |
| FORKRM-01 | Phase 52 | Complete |
| FORKRM-02 | Phase 52 | Complete |
| FORKRM-03 | Phase 52 | Complete |
| FORKRM-04 | Phase 52 | Complete |
| FORKRM-05 | Phase 52 | Complete |
| FORKRM-06 | Phase 52 | Complete |
| FORKRM-07 | Phase 52 | Complete |
| DOCS-01 | Phase 53 | Pending |
| DOCS-02 | Phase 53 | Pending |
| DOCS-03 | Phase 53 | Pending |
| DOCS-04 | Phase 53 | Pending |

**Coverage:**

- v1.0.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

Seven phases carry requirements above: 45-50 plus 52. (Phase 51 also carries a
`TBD` requirements line in `.planning/ROADMAP.md`, but declaring or renumbering
anything for Phase 51 is that phase's own planning job — doing it here would
make these Coverage totals wrong the moment 51 is planned. The 22/22 figure
above is not a claim that every roadmap phase is mapped; it is a claim that
every requirement declared so far is mapped to exactly one phase.)

**Why `FORKRM-*` is a separate id namespace:** `FORK-01` and `FORK-02` are Key
Decisions rows in `.planning/PROJECT.md` (with an archived mirror in
`.planning/milestones/v0.4.0-REQUIREMENTS.md`), not milestone requirements, so
reusing those ids here would collide a decision id with a requirement id. A
fresh namespace keeps the 1:1 requirement-to-phase invariant this section
asserts.

Every requirement above maps to exactly one phase; no requirement is orphaned
and none is owned by two. Two mappings among the original fifteen are worth
stating explicitly because they look like exceptions and are not:

- **`BUILD-04` owns the purpose-built synthetic subject as well as the four-class
  hazard report**, both inside Phase 48, by owner decision 2026-09-10 ("Strategy
  B"). There is deliberately **no** separate early fixture phase — a fixture
  built ahead of its detector gets written to match it, the `COV-01` failure
  mode this project measured across four verification rounds.
- **`EQUIV-04` is mapped to Phase 50 only.** Its "fixtures are committed" half is
  satisfied by Phase 48's deliverable, which Phase 50 *consumes* rather than
  re-owns; Phase 50 wires the committed subject into CI. That is a dependency
  edge, not a second mapping.

`BUILD-06` is its own phase (49) and stands **before** the phase it gates (50),
which is what its own text requires. `BUILD-05` and `BUILD-07` share Phase 46
because they are one invariant stated two ways — `BUILD-05` states it,
`BUILD-07` makes it checkable — and it is built before the exporter widens in
Phase 47 rather than retrofitted onto it.

---
*Requirements defined: 2026-09-10*
*Last updated: 2026-09-12 — FORKRM-01..07 declared and traced to Phase 52 (22/22 mapped); Phase 51's TBD line remains unaddressed by design*
