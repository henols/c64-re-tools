# Feature Research

**Domain:** Binary-to-modifiable-source reverse engineering (C64/6502, retro-console disassembly-to-rebuild pipelines)
**Researched:** 2026-08-23
**Confidence:** MEDIUM (community/GitHub sources, cross-checked across 3+ independent named projects per claim; no primary-vendor docs exist for this domain — the community itself *is* the source hierarchy's top tier here)

## Context this research answers into

v0.5.0 adds the step from *annotated binary* (regenerator2000 store, already built) to *rebuildable, modifiable source*. The milestone's Active requirements already commit to: full decomposition with **measured** coverage, one-file-per-subsystem export wired through ACME's `!source`, symbol-only references everywhere, a **relocation-hazard report**, provenance-awareness (cracker patches excluded), a demonstrated modify-reassemble-observe loop, and **behavioural equivalence in VICE via `compare.mjs`** as the final bar — explicitly *not* byte-identity. This research validates each of those choices against how the wider disassembly community actually works, and flags the one place this project's constraints (no clean original binary; cracked-release provenance) make it structurally different from every named prior-art project.

## Q1 — How the community does full-game disassembly to rebuildable source

There is a mature, decades-old practice with a small set of load-bearing conventions repeated across every serious project, independent of target platform:

**Named prior art:**

| Project | Platform | Assembler/build | Verification | Notes |
|---|---|---|---|---|
| [pret/pokered](https://github.com/pret/pokered) | Game Boy | RGBDS + Makefile | Byte-identical ROM (build fails otherwise) | Canonical reference for the whole "disassembly project" genre; `engine/`, `data/`, `gfx/`, `maps/`, plus `wram.asm`/`hram.asm`/`sram.asm` for memory-area symbol tables; `scan_includes` tool derives the dependency graph from `INCLUDE`/`INCBIN` directives so the Makefile doesn't hand-list every file |
| [sonicretro/s1disasm](https://github.com/sonicretro/s1disasm) | Sega Mega Drive | AS68k/ASM68k (two dialects kept aligned) | Matching ROM | Long-running (10+ years), CI via GitHub Actions, community-maintained fork-and-PR model |
| doppelganger's SMBDIS.ASM ([Xkeeper0/smb1](https://github.com/Xkeeper0/smb1), ca65 port at [threecreepio/smb-disassembly](https://github.com/threecreepio/smb-disassembly)) | NES | ca65 | Byte-identical | The most-cited single-file 6502 disassembly in the hobbyist community; later reworked into [6502bench SourceGen](https://6502disassembly.com/nes-smb/) format for cross-referenced browsing |
| [crystalisdisassembly/crystalisdisassembly](https://github.com/crystalisdisassembly/crystalisdisassembly) | NES | ca65 | Byte-identical diff against a supplied original ROM when present | Uses a **Mesen Code/Data Log (CDL)** to drive both code/data classification and a published completeness percentage (see Q4) |
| [mwenge/iridisalpha](https://github.com/mwenge/iridisalpha) | **C64** (Jeff Minter, 1986) | 64tass + Exomizer, VICE for validation | Not explicitly stated as byte-identical; framed as educational/buildable | `src/`, `bin/`, `demos/`, `docs/`, `orig/`, `utils/` layout — `orig/` keeps the pristine input alongside the recovered source, a pattern worth copying |
| [mwenge/gridrunner](https://github.com/mwenge/gridrunner) | **C64** (Jeff Minter, 1982) | 64tass, VICE | **Explicit incremental MD5 byte-for-byte checks** while recovering source | Documents the actual recon workflow: BASIC-stub trace → relocation copy (`$0900`→`$8000`) → char-set extraction via `$D018` → main-loop discovery via repeated `JSR` clusters → renaming (`e84F8` → `UpdateShipPosition`) as understanding solidifies |
| [Piddewitt/C64-Game-Source-Code](https://github.com/Piddewitt/C64-Game-Source-Code) | **C64** (Loderunner, Championship Loderunner, Castles of Dr Creep) | 64tass, 65xxDis, WinVice | Byte-identical for `originals/`; **explicitly not** for `mods/` | **The single most relevant precedent in this research.** Its stated goal for the pristine tree is "reassembles to an exact copy of the original binary," but it maintains a *parallel* `mods/` tree with the *same file layout* where "source [is] as variable as possible to allow any kind of modifications, data area and code relocation" — i.e., symbolic labels and configurable addresses replace hard-coded ones specifically so a human can move code and swap data without re-deriving addresses by hand |
| [mist64/c64ref](https://github.com/mist64/c64ref) | C64 KERNAL/BASIC ROM | — | — | Not a game disassembly but the canonical fully-commented ROM reference; useful for symbol-naming conventions this project's `c64-memory-mapping` skill already mirrors |

**Universal conventions across all of the above, regardless of platform:**

1. **One file per subsystem/bank, wired by an include mechanism, never one flat file.** RGBDS's `INCLUDE`, ca65's `.include`, ACME's `!source` all serve the same purpose: let the assembler's own include graph *be* the module boundary, rather than inventing a separate build-config format. This project's Active requirement ("one file per subsystem off r2000 scopes wired by `acme-build`'s `!source`") is exactly this convention, using this project's existing assembler.
2. **Symbol tables for memory areas are separate from code.** `wram.asm`/`hram.asm` (pret) is the same idea as this project's r2000 scope-derived label store — a place that owns "what does this address mean" independent of which routine references it.
3. **A pristine/`orig` copy of the source binary is kept alongside recovered source**, never overwritten, so provenance and re-verification stay possible. This project's own architecture already keeps `.bin` dumps immutable per `c64-provenance-diff`'s D-05 ("the `.bin` files are never edited or zeroed").
4. **Naming starts generic and is promoted only on evidence**, exactly mirroring this project's `[confirmed-code]`/`[probable-code]`/`[unknown]` confidence-grade discipline already built into `c64-program-recon`. Gridrunner's own writeup names this explicitly: labels evolve from `e84F8` to `UpdateShipPosition` as understanding solidifies, never the reverse.
5. **Code/data separation is empirically driven** — what the PC actually visits, not what a linear decoder guesses. This is already this project's stated method (`c64-program-recon` step 5, "a range never executed is data, whatever a tracer guessed") and matches how Crystalis's CDL and Gridrunner's ASCII-run detection both work.
6. **The flat original binary is never treated as one address space to hand-carve.** Every project above splits the load image at boot/entry-known boundaries (BASIC stub, loader-copy target, bank switch) before annotating — this project's recon skill already does this (step 1/2, HIRAM/vector derivation).

## Q2 — Byte-identity vs functional/behavioural equivalence (the load-bearing question)

**What the byte-identity community gains, concretely, from every project above:** a mechanically checkable, zero-judgment oracle. "Does the reassembled binary's MD5 match?" requires no human review of correctness and catches *any* wrong opcode, wrong operand, or misread byte immediately — Gridrunner's writeup describes this literally as the thing that let false steps be caught immediately during recovery. It is the cheapest possible correctness gate a disassembly project can build, and every named C64 example (Piddewitt, Gridrunner) uses it for exactly that reason during initial recovery.

**What it costs, and where the community's own practice concedes this:**

- **It caps modifiability at zero by construction.** The moment a byte changes on purpose, the oracle you built stops applying — there is no way to "modify a little and still check the whole thing" with an MD5. Piddewitt's own project structure is the community's tacit admission of this: it does not try to extend byte-identity into the `mods/` tree. It builds the `originals/` tree to prove the disassembly is *correct*, then explicitly discards that oracle the moment the goal shifts to *modification*, replacing "provably correct" with "the assembler labels are named and parameterised enough that a human confidently understands what moving them would do."
- **N64 decompilation projects hit the same wall from the C-decompilation side and named their escape hatch explicitly: `NON_MATCHING`.** Projects like [n64decomp/sm64](https://github.com/n64decomp/sm64) and [zeldaret/oot](https://github.com/zeldaret/oot) target compiler-output-identical (their form of byte-identity) as the default, verified per-function with `asm-differ`, but accept a function tagged `NON_MATCHING` when only *functional* equivalence is achievable or desirable — same observable behaviour and side effects, different compiled bytes. Verification for those functions is not automatic; it is asm-differ's diff read by a human plus test/playthrough coverage. This is a direct precedent for "verify behaviour, not bytes" as a first-class, named, accepted mode within an otherwise byte-obsessed genre — it is not a fringe idea.
- **The modding fork pattern is the cleanest precedent of all.** [HackerN64/HackerOoT](https://github.com/HackerN64/HackerOoT) forks zeldaret/oot's matched decomp specifically "to provide a flexible, easy-to-use base for creating romhacks." The moment it forks, matching stops being the target at all — the fork's own verification is "does it build, and does it play correctly," checked by running the game, not by any automated equivalence tool. zeldaret's own stated charter is explicit division of labour: *they* do matching decompilation only; downstream teams that want to modify things fork off and stop caring about matching. **This is the community's actual answer to "how do projects that want modifiability verify instead": they build, they run it, they play it, and they trust the fork's provenance (it started from a matched decomp) rather than a mechanical bytewise or behavioural check.**
- **TASVideos' console-verification practice is the nearest real precedent for automated *behavioural* equivalence checking**, though it verifies emulator-vs-hardware, not source-vs-binary: a recorded, deterministic input sequence is replayed and the resulting state (not the ROM bytes) is what's compared. That is structurally the same shape as this project's own `compare.mjs` bar — replay inputs into a live VICE, compare resulting machine state rather than static bytes.

**Why this project is right to reject byte-identity outright, not merely as a preference but structurally:** every named byte-identity project above (Piddewitt, Gridrunner, pret, Crystalis, s1disasm) has one thing this project's own skills prove it does **not** have — a single clean original binary to match against. `c64-program-recon`'s own text states it plainly: *"no original master exists to strip [loader/cruncher/cracktro layers] for you."* `c64-provenance-diff` exists precisely because determining "what the game originally was" requires cross-referencing multiple independently-cracked releases and still leaves ranges `UNKNOWN` rather than resolved. Byte-identity to *what*, exactly, is not a rhetorical question here — there is no canonical target byte sequence, only a provenance-graded composite with some ranges carrying `HIGH` confidence and others honestly `UNKNOWN`. Chasing an MD5 match would force either (a) inventing a canonical binary that never existed, or (b) reproducing whatever cracker patches happen to sit in whichever release was captured — exactly the trainer-inheritance hazard `c64-provenance-diff` was built to catch. Functional/behavioural equivalence in VICE is therefore not a downgrade from the community's gold standard; it is the *only* target that is even well-defined given this project's own provenance model. This is the strongest, most load-bearing finding of this research: **state it in the roadmap as a structural fact, not a stylistic choice.**

**What "verify instead" concretely looks like, synthesizing the above for this project:** input-replay + state comparison (TASVideos' shape), scoped per-behaviour rather than per-byte (the N64 `NON_MATCHING`-function shape: verify the thing you changed, trust the rest by construction because it round-tripped through `r2000 verify`'s reassembly gate unchanged), gated by "does it build" as a cheap pre-filter before any behavioural check runs (every project above, without exception, gates on a clean assemble first).

## Q3 — What makes disassembled source actually modifiable

| Practice | Table stakes or differentiator | Evidence | Complexity | Depends on (existing) |
|---|---|---|---|---|
| Symbol-only references (no raw absolute addresses in branches/JSR/JMP/data refs) | **Table stakes** | Every named project (pret, Piddewitt, Gridrunner); this project's own Active requirement | LOW–MEDIUM | r2000's cross-reference store (`r2000_get_cross_references`), already built |
| One file per subsystem, wired by assembler include | **Table stakes** | pret's `engine/`/`data/`/`gfx/`, Piddewitt's per-game layout | MEDIUM | r2000 scopes (`r2000_add_scope`, already built), ACME's `!source` (already built) |
| Data extracted to its own file(s), separate from code | **Table stakes** | pret's `gfx/`/`maps/` split; Crystalis's CDL Code/Data split | MEDIUM | r2000's `set_data_type` block classification (already built) |
| Macros/constants for hardware registers instead of magic numbers | **Table stakes** | ACME's `<cbm/c64/vic.a>` etc. (already used by `acme-build`); this project already generates register-bit enums (`r2000 gen-enums`, v0.3.0) | LOW (already substantially built) | `c64-memory-mapping`'s `memmap.json`, `r2000 gen-enums` — both existing |
| Explicit padding/alignment for anything page-sensitive | **Differentiator** — most named projects handle this ad hoc, not systematically | 6502-community consensus (self-modifying code, jump tables, cycle-exact raster code all care about page boundaries) | MEDIUM–HIGH | new: the relocation-hazard report (Active requirement) is exactly where this should be surfaced |
| Documentation density (comment-per-routine, not comment-per-line) | **Table stakes**, but *density* is a differentiator | Every named project comments at routine/block granularity; Gridrunner shows line-level comments only where genuinely non-obvious | LOW | r2000's comment store, already built |
| **What breaks first when inserting/removing code in 6502**, per 6502-community sources: | | | | |
| — Anything computed by *distance* rather than by symbol: relative branches (`BEQ`/`BNE`/etc., ±127 range) silently go out of range and the assembler must catch it, not silently wrap | Table stakes to detect | 6502.org community consensus | LOW (ACME already errors on out-of-range branches) | none new |
| — Self-modifying code: an instruction's *operand bytes* are also data someone else writes to. Moving the instruction without moving the write-site (or vice versa) breaks it silently, and it will not show up as an assembly error | **The single most dangerous class** | 6502.org "Self modifying code" thread; this is *exactly* what the Active requirement's relocation-hazard report exists to enumerate | HIGH | needs new detection: any write target that falls inside `code`-typed range |
| — Jump tables built from computed offsets (`page,X` addressing into a table of `JMP`/address pairs) break if the table or the targets move independently | Table stakes to detect | 6502.org jump-table discussion | MEDIUM | r2000's block/data-type store already distinguishes `address`-typed data — this is a query over data already captured |
| — Page-crossing timing: raster-synchronised code that depends on cycle-exact timing can break *functionally* (visible glitch) even when the reassembled bytes are correct, purely because inserting code shifts a branch across a page boundary and adds a cycle | **Real and C64-specific**, not covered by any of the byte-identity projects above since none of them are raster-critical to the same degree as most C64 games | This project's own constraints file already documents raster-IRQ sensitivity (`CHECKPOINT_INFO` synchronous-emit hazard) | HIGH | flagged, not solved, by the relocation-hazard report |

## Q4 — Coverage and completeness, measured not asserted

The clearest, most reusable precedent is **crystalisdisassembly's published coverage report**, generated from a Mesen Code/Data Log:

> "PRG Analysis 92.19% Complete (18.74% Code, 73.45% Data, 7.81% Unknown)" plus a parallel CHR (graphics-data) percentage.

This is exactly the shape the milestone's Active requirement wants ("nothing left `Undefined`... with coverage measured, not asserted"). It is directly computable from data this project already has:

- **Bytes classified vs total**: `r2000_get_blocks` already returns every block's type (`code`/`byte`/`address`/`petscii`/…) or its absence — `% classified = (total bytes) − (bytes in blocks still Undefined) / (total bytes)`. No new data collection needed, only a report generator over existing store queries.
- **Entry points / routines named vs auto-named**: `r2000_get_symbols` already distinguishes user labels from generated ones (`export-lbl`'s own "USER labels only" caveat proves the store already knows this distinction).
- **Hardware writes named vs raw**: `r2000 gen-enums`'s output is exactly this, and it's already built.
- **Non-hardware referenced addresses without a comment/label**: a query over `r2000_get_cross_references` intersected with `r2000_get_symbols`/`r2000_get_comments` for the referenced-but-undocumented set.

**This is a report-generation feature, not a data-collection feature** — the store already has everything a coverage report needs. Complexity: LOW–MEDIUM (aggregation script over existing `r2000_*` queries), and it should be one of the earliest deliverables in the phase sequence since every other Active requirement ("nothing left Undefined," "every referenced non-hardware address documented") is *itself* a coverage claim that needs this instrument to be checkable rather than asserted — directly mirroring this project's own hard-won lesson (stated in `PROJECT.md`) that an internally-asserted claim is worth less than a mechanically checked one.

## Q5 — Anti-features

| Candidate | Genuinely an anti-feature? | Why |
|---|---|---|
| Producing C or a high-level decompilation instead of assembly | **Yes.** | Every C64-specific named project (Iridis Alpha, Gridrunner, Piddewitt) targets assembly, not C, because ACME/64tass round-trips byte-for-byte and a C decompiler for 6502 does not exist with anything near that fidelity — C decompilation is an N64/PS1-era practice tied to compiled-from-C originals; C64 games are hand-written 6502, so "decompiling to C" would be inventing a compiler-generated shape the source never had. This project's whole toolchain (ACME, `!source`, symbol store) is already assembly-native; a C target would discard all of it. |
| Attempting automatic relocation/rebasing | **Yes, and the roadmap already agrees.** | The Active requirement list *itself* calls for a **relocation-hazard report** rather than automatic relocation — because self-modifying code, jump tables, page alignment, and cycle-exact raster code (Q3 above) make blind automatic relocation unsafe on 6502 in ways that have no general static solution. Enumerate hazards; let a human decide. Automating the move itself would be building the wrong tool for a problem this domain has never solved generally. |
| Auto-renaming everything with LLM-guessed names and no evidence | **Yes.** | Directly contradicts this project's own established discipline: `c64-program-recon`'s confidence-grade prefixes (`[confirmed-code]`, `[probable-code]`, `[unknown]`) exist specifically so a name or classification is never asserted without a stated evidence bar, and "promote by re-logging with new evidence, never by editing a grade in place" is already a hard convention across every skill in this repo. An LLM guessing plausible names en masse without evidence is exactly the "confident nonsense" `c64-provenance-diff`'s own header warns against, applied to a different axis. |
| A GUI | **Yes.** | No existing skill in this project has one; the entire interaction model is Claude Code driving CLI/MCP tools. A GUI would be new surface with no consumer (an LLM doesn't use one) and no precedent — pure scope creep. |
| HTML export | **Yes — and this is a repeat decision, not a new one.** | v0.3.0 already cut this exact feature (`R2000-07`, HTML export with clickable xrefs) with the rationale "a shareable artifact no skill produces or consumes." Nothing about v0.5.0 changes that calculus; regenerator2000's `--export_html` remains available ad hoc outside this pipeline. Re-litigating it would be re-adding scope this project already measured and rejected once. |
| Supporting non-C64 targets | **Yes.** | The entire stack (VIC-II/SID/CIA register maps, ACME's `cbm/c64/*` includes, the 6510 illegal-opcode set, regenerator2000's C64 project defaults) is C64-specific by construction; generalizing to other 6502 platforms (NES, Apple II) would multiply the memory-map and register surface for zero demand — no requirement, issue, or prior milestone names another target. |
| **Byte-identical rebuild as an acceptance bar** (for completeness, though not literally asked as a candidate — it is this milestone's central rejected option) | **Confirmed correctly rejected**, and confirmed *structurally* rejected, not just stylistically — see Q2. | — |

**One candidate worth flagging as genuinely fine, not an anti-feature, contrary to how it might first read:** *keeping a byte-identical check as an optional, early-phase sanity gate on the un-modified export* (i.e., before any deliberate change is made, prove the freshly-exported source reassembles to something behaviourally — and, where a clean baseline exists, bytewise — equivalent to the captured RAM image it came from). This is not the acceptance bar the milestone rejected (that bar is about *modified* source matching original *bytes*, which this project structurally cannot even define — see Q2). It is a much narrower, cheap, one-time confidence check on the *unmodified* export, in the same spirit as `r2000 verify`'s existing reassembly gate, and every named project in Q1 does something like it as a first correctness pass before any modification begins. Recommend keeping it in scope as a pre-modification sanity step, distinct from and strictly weaker than the rejected acceptance bar.

## Q6 — BASIC handling: confirmed, not challenged

The exclusion of BASIC token decoding is validated by both the research and this project's own already-built recon method. `c64-program-recon`'s own step 1 states the C64-community-standard pattern directly: *"Post-depack: wherever the PC sits at the decrunch checkpoint. There is no BASIC stub to find"* for a post-loader captured image, and separately documents the canonical stub shape when one exists (`c64-provenance-diff`/`acme-build`'s scaffold: a one-line `SYS <address>` BASIC program whose sole job is to transfer control to machine code). Community sources on C64 program structure (Lemon64 threads on BASIC loaders, `restore64.dev`'s auto-depack tooling) confirm this is close to universal practice for commercial C64 games: the BASIC "program" is a single `10 SYS xxxxx`-shaped line (or occasionally two — one `SYS` line plus a `POKE`/`REM` line for a loader parameter), never a meaningful *program* written in BASIC. Games with substantial BASIC logic beyond a stub exist (a minority of budget/type-in titles, and some earlier titles that fell back to BASIC for menu-only screens), but they are not the profile this project's toolchain targets (cracked commercial releases reached via VICE/regenerator2000, per `c64-provenance-diff`'s worked examples). **Verdict: the exclusion is correct.** Decoding a one-line `SYS` stub, when it needs handling at all, is a two-second manual read, not a subsystem — building or absorbing a BASIC tokenizer for this would be solving a problem the corpus this project actually targets does not present.

## Feature Dependencies

```
Coverage report (Q4)
    └──requires──> r2000 block/symbol/xref queries (existing, v0.3.0)

One-file-per-subsystem export
    └──requires──> r2000 scopes (existing) + ACME !source (existing)
    └──enhances──> modifiability demonstration (Active requirement)

Relocation-hazard report
    └──requires──> code/data block classification (existing)
    └──requires──> new: self-modifying-code write-target detection (code range vs write-target overlap)
    └──requires──> new: jump-table / address-table detection over existing "address"-typed data
    └──requires──> new: raster/cycle-sensitivity flagging (informed by existing checkpoint/timing constraints)
    └──gates──> "modifiability demonstrated" (Active requirement) — do not attempt automatic
                relocation before this exists; it is the safety check, not an afterthought

Behavioural-equivalence verification (compare.mjs)
    └──requires──> a live VICE session (existing MCP surface)
    └──requires──> deterministic input replay (new, TASVideos-shaped: recorded inputs + state diff)
    └──conflicts with──> byte-identical acceptance bar (deliberately, per Q2 — do not build both
                          as competing gates; the pre-modification sanity check described in
                          Q5 is a distinct, narrower, optional thing)

Provenance-aware rebuild
    └──requires──> c64-provenance-diff's verdict ledger (existing)
    └──enhances──> coverage report (an UNKNOWN-classified range should read differently in
                    coverage than a cracker-patch-excluded range)

Packer detection (recon finding)
    └──independent of the above──> can land in any phase; informs Step 0 scoping
                                    (c64-program-recon already owns "which bytes are the game")
```

### Dependency Notes

- **Coverage report requires nothing new from regenerator2000** — it is purely an aggregation script over `r2000_get_blocks`/`r2000_get_symbols`/`r2000_get_cross_references`/`r2000_get_comments`, all already built and callable. This should be sequenced early: every other completeness claim in the Active requirements list needs this instrument to be checkable.
- **Relocation-hazard report gates the modifiability demonstration.** Do not sequence "demonstrate one behaviour removed and one added" before the hazard report exists — the whole point of the report is to tell you *where it is safe* to make that demonstration change, and picking a spot blind risks landing on self-modifying code or a jump-table entry by accident.
- **Behavioural-equivalence verification conflicts with (deliberately excludes) a byte-identical acceptance bar** — see Q2 and Q5's closing note. Building both as parallel gates would reintroduce the exact target the milestone rejected, alongside the one it chose; pick one bar for "did the rebuild succeed" and one narrower, separate, optional pre-modification sanity check.
- **Provenance-awareness enhances rather than blocks the coverage report** — an `UNKNOWN` provenance range and a genuinely un-analysed range are different kinds of gaps and the coverage report should be able to say which is which, but neither blocks the other from shipping.

## MVP Definition

### Launch With (v1 of this milestone's rebuild pipeline)

- [ ] Coverage report over existing r2000 store queries — essential because every other completeness claim in this milestone is unverifiable without it
- [ ] One-file-per-subsystem export wired by `!source`, off existing r2000 scopes — essential because it is the literal definition of "rebuildable source" this milestone targets
- [ ] Symbol-only references end to end (branches, JSR/JMP, data refs) — essential; without it "source you can modify" is false advertising, since every address is still a magic number
- [ ] Relocation-hazard report (self-modifying-code write-target overlap, jump-table detection at minimum) — essential as the safety gate before any modification demo
- [ ] Provenance-aware exclusion of cracker patches at export time — essential; skipping this risks shipping a "rebuild" that silently reproduces a trainer

### Add After Validation (v1.x within this milestone)

- [ ] Raster/cycle-sensitivity flagging in the hazard report — genuinely hard to get right generally; land the simpler hazard classes first and add this once the report format is proven useful
- [ ] Packer-detection-as-recon-finding — independent, can land any time, lower risk

### Future Consideration (beyond this milestone)

- [ ] A pre-modification byte-identical sanity check on the unmodified export (Q5's "genuinely fine" candidate) — valuable but strictly optional relative to the behavioural bar this milestone already committed to; do not let it become a second acceptance bar by accident

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Coverage report | HIGH | LOW | P1 |
| One-file-per-subsystem export | HIGH | MEDIUM | P1 |
| Symbol-only references | HIGH | MEDIUM | P1 |
| Relocation-hazard report (SMC + jump tables) | HIGH | HIGH | P1 |
| Provenance-aware export | HIGH | LOW–MEDIUM | P1 (dependency already built, this is wiring) |
| Behavioural-equivalence verification (`compare.mjs`) | HIGH | MEDIUM–HIGH | P1 |
| Raster/cycle-sensitivity hazard flagging | MEDIUM | HIGH | P2 |
| Packer-detection recon finding | MEDIUM | LOW–MEDIUM | P2 |
| Pre-modification byte-identical sanity check | LOW–MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for this milestone's stated Active requirements
- P2: Should have, strengthens the hazard report / recon findings but not blocking
- P3: Nice to have, deliberately not the acceptance bar

## Competitor / Prior-Art Feature Analysis

| Feature | pret (Game Boy) | zeldaret/HackerOoT (N64) | Piddewitt (C64) | This project's plan |
|---------|--------------|--------------|--------------|--------------|
| Acceptance bar | Byte-identical ROM | Byte/compiler-identical (matching), `NON_MATCHING` escape hatch | Byte-identical for `originals/`, none for `mods/` | Behavioural equivalence via `compare.mjs` — structurally forced by no-clean-original (Q2) |
| File split | One file per engine subsystem/bank | One file per game subsystem (C translation units) | One file per game, per variant tree | One file per r2000 scope, `!source`-wired |
| Coverage measurement | Implicit (build either succeeds fully or doesn't; no partial-completion project ships) | Per-function matching percentage tracked publicly | Not published | Explicit `%` report over classified bytes/named routines/documented references (new) |
| Modifiability path | N/A (matching-only project; downstream forks do this) | Separate forks (HackerOoT) do the modifying, upstream stays matching | Separate `mods/` tree in the *same* repo | Single pipeline, single repo, modifiability built in from the start rather than forked later |
| Relocation safety | Not needed (GB has no equivalent SMC/raster-timing hazard class at this severity) | Not applicable (recompiled C, not relocated machine code) | Ad hoc / by convention only | Explicit relocation-hazard report (new — no named prior art does this as a first-class artifact) |

## Sources

- [pret/pokered](https://github.com/pret/pokered) — build system, DeepWiki summary of the Makefile/RGBDS toolchain
- [pret/pokered INSTALL.md](https://github.com/pret/pokered/blob/master/INSTALL.md), [pret/pokered Makefile](https://github.com/pret/pokered/blob/master/Makefile)
- [sonicretro/s1disasm](https://github.com/sonicretro/s1disasm)
- [Xkeeper0/smb1](https://github.com/Xkeeper0/smb1), [threecreepio/smb-disassembly](https://github.com/threecreepio/smb-disassembly), [6502disassembly.com SMB annotated source](https://6502disassembly.com/nes-smb/SuperMarioBros.html)
- [crystalisdisassembly/crystalisdisassembly](https://github.com/crystalisdisassembly/crystalisdisassembly)
- [mwenge/iridisalpha](https://github.com/mwenge/iridisalpha)
- [mwenge/gridrunner](https://github.com/mwenge/gridrunner), [Disassembling.md](https://github.com/mwenge/gridrunner/blob/master/Disassembling.md)
- [Piddewitt/C64-Game-Source-Code](https://github.com/Piddewitt/C64-Game-Source-Code)
- [mist64/c64ref](https://github.com/mist64/c64ref)
- [n64decomp/sm64](https://github.com/n64decomp/sm64), [Awesome N64 Development](https://n64.dev/)
- [zeldaret/oot](https://github.com/zeldaret/oot), [HackerN64/HackerOoT](https://github.com/HackerN64/HackerOoT), [duskport.com Zelda decomp ranking](https://duskport.com/decomp/zeldaret-projects/)
- [TASVideos Console Verification Guide](https://tasvideos.org/ConsoleVerification/Guide), [TASVideos Emulator Resources / Features](https://tasvideos.org/EmulatorResources/Features)
- [restore64.dev](https://restore64.dev/) (C64 auto-depack packer database, relevant to packer-detection anti-feature/differentiator assessment)
- Lemon64 forum threads on C64 BASIC loader/SYS stub conventions
- This project's own `src/skills/c64-program-recon/SKILL.md`, `src/skills/c64-provenance-diff/SKILL.md`, `src/skills/acme-build/SKILL.md`, `.planning/PROJECT.md` — used as the ground truth for what already exists and what the milestone has already committed to

---
*Feature research for: binary-to-modifiable-source C64 reverse engineering (v0.5.0)*
*Researched: 2026-08-23*
