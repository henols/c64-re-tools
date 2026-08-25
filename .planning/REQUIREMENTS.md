# Requirements: c64-re-tools — v0.6.0 Own the substrate

**Defined:** 2026-08-25
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.

**Milestone goal:** Replace regenerator2000 as the analysis substrate with dxa +
Ghidra and an annotation store this project owns — proving the pivot's numbers
hold on real cracked code *before* anything is built on them.

**Scope note.** This milestone is the substrate only. `DECOMP-01..04`,
`BUILD-01..06` and `EQUIV-01..04` — v0.5.0's cut phases, re-mapped at its close —
are deliberately held for v0.7.0 rather than rewritten now against a store that
does not exist yet. Their text stands unchanged in
[`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md).

## v0.6.0 Requirements

### Proof

<!-- The gate. Every number behind the pivot comes from one 279-byte fixture
     written by the same person testing it. This category exists to find that
     out before four phases are built on it. -->

- [ ] **PROOF-01**: dxa's data-recovery rate and false-positive count are measured on real cracked releases from the `c64-provenance-diff` fixtures, reported as numbers against a named binary — and stated *beside* the 279-byte fixture's 72%-data / 0-false-positive claim rather than silently replacing it
- [ ] **PROOF-02**: Ghidra's indirect-dispatch resolution is tested where the dispatch index is **computed** rather than an immediate `ldx #$02` — the case the pivot fixture never exercised — with the result recorded whichever way it comes out
- [ ] **PROOF-03**: The `memmap.json` join is run against code that banks ROM in and out, and the point where a single forward-carried `$01` value becomes wrong is established rather than assumed: path-dependent bank state is the highest-risk item on the pivot's own record
- [ ] **PROOF-04**: The dropped `analyzer.rs` work is checked for anything the dxa+Ghidra pair does not replace, so dropping it is a measured decision rather than an inference from one fixture
- [ ] **PROOF-05**: The milestone's verdict is a recorded go / degrade / no-go against named rules, produced **before** any engine or store code is written — the pattern Phase 9 used, where `degrade` shipped a smaller, correct milestone

### Discovery Engine

- [ ] **DXA-01**: dxa is vendored at a pinned version with its GPLv2+ notice in `THIRD-PARTY-NOTICES.md` and is built by this project rather than assumed present on `$PATH` — it ships in no Debian package (`dpkg -L xa65` has no `dxa`) and its upstream is dormant at 0.1.5
- [ ] **DXA-02**: dxa's human-readable listing is parsed into a machine-readable code/data map, and the parser's failure mode is a refusal rather than a silent mis-parse — dxa has no machine-readable output, so this parser is this project's to own and maintain
- [ ] **DXA-03**: Known-data ranges are handed to dxa as `-b` data blocks, so a caller can exclude graphics regions from discovery

### Semantic Engine

- [ ] **GHID-01**: Ghidra runs headless under this project's harness against a `.prg` or flat 64K image, given dxa's map as hints, reproducible from a committed script rather than a documented click-path
- [ ] **GHID-02**: `$0000-$0001` and `$D000-$DFFF` are marked volatile before `analyzeAll()`, proven by a planted-violation test — remove the volatile flag and hardware writes must disappear from the output, because Ghidra deletes them as dead stores with no warning
- [ ] **GHID-03**: A loader-owned block at the same address is handled by setting the flag on the existing block, so a run cannot fall back to non-volatile through an unhandled `MemoryConflictException`
- [ ] **GHID-04**: Structural facts are exported through `DecompInterface` — array bounds, the split-pointer `CONCAT11` idiom, record strides, resolved computed jumps, self-modifying write targets — and not through `DataTypeManager`, which returns essentially nothing on 6502
- [ ] **GHID-05**: Typed cross-references are exported with their access kind preserved (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), since the annotation join consumes the kind and not only the address

### Opcode Coverage

- [ ] **OPC-01**: All 105 opcode bytes stock Ghidra's `6502.slaspec` omits are decodable, as a SLEIGH extension layered so it cannot collide with `65c02.slaspec`'s reuse of the same bytes
- [ ] **OPC-02**: The electrically unstable opcodes (`XAA` `$8b`, immediate `LAX`/`LXA` `$ab`) and the page-crossing-dependent ones (`AHX`, `TAS`, `SHX`, `SHY`) are modelled as declared unknowns rather than given plausible p-code — a confident wrong semantic is worse than an admitted gap
- [ ] **OPC-03**: The extension is verified against real code containing illegal opcodes, not only against a synthetic opcode sweep

### Annotation Store

- [ ] **STORE-01**: The store holds labels, comments, per-range data typing, scopes and project enums, with per-range typing covering what `DECOMP-01` will need in v0.7.0 — code, byte, word, address, PETSCII, screencode, table
- [ ] **STORE-02**: Edits are undoable and the store survives a process restart, proven by a planted-violation test (mutate → kill → reopen → assert persisted; then remove the save and prove the test goes red)
- [ ] **STORE-03**: The store is reached through an MCP tool surface this project owns, declared in `capability-registry.ts` and identical on both backends — it never touches VICE, so backend-agnosticism is structural rather than tested per backend
- [ ] **STORE-04**: Cross-references and search over the typed decode stay queryable — the capability `R2000-11` shipped, carried across the substrate swap rather than lost in it
- [ ] **STORE-05**: The store exports ACME source carrying the two idioms worth stealing rather than rediscovering: the `=*+$01` mid-instruction label that names a self-modifying write target without breaking reassembly, and typed label prefixes carrying inferred type in the name
- [ ] **STORE-06**: Exported source is verified by real ACME reassembly rather than asserted, reusing the `--verify` seam that keys strictly on ACME's own result line

### Cutover

- [ ] **CUT-01**: The 19,181 lines of regenerator2000 integration glue (9,087 non-test + 9,928 test) are deleted, gated by a whole-tree grep proven to bite on a planted reintroduction — the pattern the `toacme` removal used, so the replacement is not left standing beside its predecessor
- [ ] **CUT-02**: What survives the swap is reused rather than rebuilt — `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` (2,555 lines), `r2000-d64.ts` (310 lines), and `memmap.json` with `r2000-regbits-gen.ts` and `r2000-enum-gen.ts` — with r2000-shaped naming resolved rather than carried as a fossil
- [ ] **CUT-03**: Every living document naming regenerator2000 as a required prerequisite is corrected — install documentation, `CLAUDE.md`'s constraints, and the seven skills' playbooks — because a skill pointing at a deleted route is worse than one pointing at nothing

### Automatic Annotation

- [ ] **AUTO-01**: Machine addresses are annotated mechanically by joining Ghidra's typed cross-references against `memmap.json`, with no agent call, queue walk or skill invocation in the loop
- [ ] **AUTO-02**: The join selects the **narrowest containing range**, breaking ties toward the entry carrying a `sym` — selecting by first match or by description length yields the useless wide entry, and it fails silently
- [ ] **AUTO-03**: An address inside the loaded image is treated as a program address and never looked up in `memmap.json`, so in-program branch targets cannot be annotated as machine features
- [ ] **AUTO-04**: Bank state is resolved **before** the address — `$01` bits 0-2 (LORAM / HIRAM / CHAREN) decoded and carried per program point — so a `$d020` write under `$34` is not labelled the border colour and a `$d000` read under `$33` is not labelled sprite-0-X
- [ ] **AUTO-05**: Where bank state is path-dependent — computed, or set inside a routine reached from several banking contexts — the join declines to annotate rather than emitting a confident wrong comment
- [ ] **AUTO-06**: Graphics areas are derived from the VIC pointers rather than from cross-references (`$DD00` bits 0-1 inverted for the VIC bank, `$D018` for screen and charset or bitmap, `$D011` bit 5 for the mode, screen + `$3F8` for sprite pointers), because the VIC fetches by DMA and a charset may be referenced by no instruction anywhere in the program
- [ ] **AUTO-07**: Derived graphics ranges are fed back to dxa as `-b` data blocks and to Ghidra as data, so graphics bytes cannot mint phantom labels and phantom cross-references that feed the join and emerge as confident wrong comments

## Future Requirements

Deferred to v0.7.0 and beyond. Tracked, not in this roadmap.

### The rebuild half (v0.7.0 — text unchanged in `milestones/v0.5.0-REQUIREMENTS.md`)

- **DECOMP-01..04**: Nothing left `Undefined`; every entry point named with a purpose comment; every referenced non-hardware address documented; hardware writes as named enums
- **BUILD-01..06**: One ACME file per annotation-store scope wired by `!source`; data tables in their own files; every reference through a symbol; the four-class hazard report; provenance-aware rebuild; the reassembly gate existing before the phase it gates
- **EQUIV-01..04**: `compare.mjs` in original-versus-different-binary mode; behavioural equivalence in VICE with a committed transcript; modifiability demonstrated; the pipeline runnable in CI

### Carried, unowned by this milestone

- **Sprite bitmap location** — the 8 sprite *pointer* bytes are derivable (screen + `$3F8`); the bitmaps they point at are not, since the pointer values are program data usually written at runtime. Needs a RAM capture or a data-flow trace. Untested either way (`vic-graphics-map-derivation.md`)
- **The second VIC banking axis** — CIA2 `$DD00` bits 0-1 govern where the VIC *reads* from, independently of the `$01` CPU banking. `$DD00` falls inside the volatile I/O block so the same technique should apply, but it is untested
- **Loaders beyond `.prg` / `.d64`** — `.t64`, `.crt`, `.vsf`. `.vsf` remains explicitly out of scope as a bootstrap input (see Out of Scope)

## Out of Scope

| Feature | Reason |
|---------|--------|
| A packer/unpacker | Owner decision 2026-08-25. r2000's unpacker is ~5,400 lines including the `cpu.rs` 6502 emulator it needs, with claimed 100% unp64 benchmark parity. Depack-by-running via `c64-ram-capture` is sufficient |
| cc65 (da65 / ca65 / ld65) as the export path | da65's complete `RANGE TYPE` vocabulary (`ADDRTABLE BYTETABLE CODE DBYTETABLE DWORDTABLE RTSTABLE SKIP TEXTTABLE WORDTABLE`, verified against the binary's own string table) cannot express a split-address table or a struct. Every structural fact Ghidra recovers dies at that boundary — and it emits ca65, not ACME |
| Byte-perfect reconstruction | Explicitly not the goal (user decision 2026-08-24). Source quality and functionality are; rebuilding a binary is a separate, later step |
| dxa for banking or VIC knowledge | Checked, not assumed. `grep -in bank` over all 3,417 lines returns zero; dxa's entire C64 knowledge is eight lines testing whether the load address looks like a BASIC start. It is the discovery engine and nothing more |
| Ghidra's `DataTypeManager` as the structural-fact source | Measured: `getAllComposites()` and `getDefinedData()` return essentially nothing on 6502. Named here because it is the obvious implementation and the single most expensive mistake available in this design |
| `.vsf` as a bootstrap input | Carried unchanged from v0.3.0 (D-34, closed `wont-fix` by plan 15-12). A `.vsf`'s machine type reads correct only by coincidence. Reverses only if a consumer has `.vsf` captures and cannot re-capture as `.raw` |
| Removing or deprecating the fork backend | Unchanged. `FORK-01` = **retain**, with the upstream `KEYBOARD_MATRIX_SET` coupling as its named reversal criterion |
| The two upstream contributions | VICE's `KEYBOARD_MATRIX_SET` opcode and regenerator2000's `--mcp-port` / `--mcp-bind`. Both are pull requests against projects this repo does not own. Standing, not scoped |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (pending roadmap) | — | — |

**Coverage:**
- v0.6.0 requirements: 32 total
- Mapped to phases: 0
- Unmapped: 32 ⚠️

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 after initial definition*
