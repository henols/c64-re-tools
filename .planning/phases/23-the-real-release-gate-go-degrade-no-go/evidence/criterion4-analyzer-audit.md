# Criterion 4 — the `analyzer.rs` capability audit (PROOF-04)

**What this file is.** Every capability `regenerator2000-core` 0.9.20's `analyzer.rs`
provides, named, with the source line it is declared on, and given **exactly one**
disposition from the vocabulary `SCHEMA.md` § 8 fixes:

| Disposition | Meaning |
|---|---|
| `replaced-by:<what>` | A named dxa or Ghidra facility does the same job |
| `lost-accepted:<cost>` | Not replaced; the cost of losing it is stated, and it is accepted |
| `lost-blocking:<what it breaks>` | Not replaced, and something in the milestone depends on it |

**Read offline. No regenerator2000 process was started** — not the binary, not
`r2000-coverage.ts`, not any `r2000_*` MCP tool (D-01, evidence convention 4). Reading the
crate source as text is permitted and is this criterion's entire subject. See
`## Reproducing this` at the end for the exact path, version and command lines.

**Scope.** `analyzer.rs` only. A capability that turns out to live in `exporter/` or
`state/` is recorded under `## Scope observations for Phase 25` and **does not enter the
count** — widening the audit here would grow the gate, and criterion 4 names `analyzer.rs`
specifically.

**Evidence discipline for a `replaced-by:` claim.** A `replaced-by:` is written only where
this project has *observed* the replacement producing the fact. The available observation is
the pivot's own Ghidra reference dump,
`.planning/notes/dxa-ghidra-pivot-evidence/ghidra3.txt` — 43 typed cross-references, 17
functions, 8 defined-data entries, produced on the 279-byte fixture. Its reference kinds are
`READ` (10), `WRITE` (9), `READ_WRITE` (2), `DATA` (13), `CONDITIONAL_JUMP` (5),
`UNCONDITIONAL_JUMP` (1), `UNCONDITIONAL_CALL` (2), `COMPUTED_JUMP` (1). Where the
replacement is only plausible from a feature list and no observation exists, the disposition
is `lost-accepted:` or `lost-blocking:` with the uncertainty stated in the cost — **not**
`replaced-by:`. Where the replacement is a *different shape of answer* to the same question,
the disposition is `replaced-by:` **with an explicit shape-mismatch note naming what is
lost**, per this plan's flagged assumption on the disposition boundary.

**Where the replacement is the annotation store rather than an engine**, the disposition is
`replaced-by: store-side (<requirement id>)` and the row is a named Phase 25 dependency, not
an engine capability. Those rows are collected in `## Store-side dependencies` so a reader
can see at a glance how much of the audit rests on a store that does not exist yet.

---

## 1. Entry-point capability table

Eight top-level items, all eight line numbers checked against the source rather than copied
from `23-RESEARCH.md`. The structural grep found no ninth entry point; it did find one type
alias the research's list omits (`UsageData`, line 13), recorded under
`## RESEARCH CORRECTIONS` rather than added here, because a type alias is not a capability.

| # | Entry point | Line | What it does (from the code and its doc comment) | Disposition |
|---|---|---|---|---|
| E1 | `AnalysisResult` | 8 | The pass's output shape: `labels: BTreeMap<Addr, Vec<Label>>` and `cross_refs: BTreeMap<Addr, Vec<Addr>>`, i.e. one label list per address and a target→sources reverse index | `replaced-by: store-side (STORE-01 labels, STORE-04 cross-references)` — **shape mismatch, in the replacement's favour:** r2000's `cross_refs` is an *untyped* `Vec<Addr>` carrying only "who referenced this"; Ghidra's export carries the access kind alongside (`0892 -> d021 READ_WRITE` observed, where r2000 would record a bare source address). What is lost is nothing in the reverse index; what moves is ownership — the label half was never an engine fact and becomes Phase 25's to hold |
| E2 | `analyze(state) -> AnalysisResult` | 20 | The driving pass. Walks `raw_data` byte by byte under `block_types`; on a `Code` block decodes an opcode and delegates to `analyze_instruction`; on a data block runs the `Address` / `DataWord` / `LoHi` / `HiLo` walks; then `promote_return_labels`; then materialises labels with User/System preservation and first-wins Auto naming; then `follow_indirect_jumps` | `replaced-by: dxa -t detect-internal code/data map + Ghidra analyzeAll() reference export` (observed: 152 code bytes, 17 functions, 43 typed references in `ghidra3.txt`) — **shape mismatch naming what is lost:** `analyze` performs **no discovery**. It defaults an untyped byte to `BlockType::Code` (line 36) and otherwise consumes a map it is handed, so it is an *attribution* pass over a pre-existing typing. The replacement inverts the order — dxa discovers the map, Ghidra attributes over it — which means the r2000 behaviour of attributing over a **human-declared** map has no direct analogue in either engine and becomes store state |
| E3 | `analyze_instruction(...)` | 285 | Per-addressing-mode operand → `LabelType` attribution: `ZeroPage`→`ZeroPageAbsoluteAddress`, `ZeroPageX/Y`→`ZeroPageField`, `Relative`→`Branch`, `Absolute`→`Subroutine`/`Jump`/`AbsoluteAddress` by mnemonic, `AbsoluteX/Y`→`Field`, `Indirect`→`Pointer`, `IndirectX/Y`→`ZeroPagePointer` | `replaced-by: Ghidra typed reference kinds` (observed `READ`/`WRITE`/`READ_WRITE`/`DATA`/`CONDITIONAL_JUMP`/`UNCONDITIONAL_JUMP`/`UNCONDITIONAL_CALL`/`COMPUTED_JUMP`, `GHID-05`) — **shape mismatch naming what is lost:** the two classifications lie on **different axes**. Ghidra's kind says *what the instruction did to the target* (read it, wrote it, called it); r2000's `LabelType` says *how the target was addressed* (zero page or absolute, indexed field or indirect pointer). `0824 -> 08ad READ` does not say whether the addressing was `Absolute` (r2000: `AbsoluteAddress`) or `AbsoluteX` (r2000: `Field`). The addressing mode survives in the decode both engines emit, so the axis is re-derivable — but no engine emits it as a fact, and re-deriving it is Phase 25 work |
| E4 | `promote_return_labels(...)` | 372 | Promotes a `Branch`, `Jump` or `Subroutine` label to `Return` when the target is internal, sits in a `Code` block, and its first byte is `RTS` ($60) or `RTI` ($40) — the doc comment names IDA Pro's `locret_` convention explicitly | `lost-accepted: label quality only; no engine records "this target is a bare return stub" as a fact.` The nearest observation is `085f sub_85f body=1 callers=0` in `ghidra3.txt` — a one-byte function body, consistent with an `RTS` stub, which Ghidra names `sub_85f` exactly as it names every other function. The fact is *derivable* (body length 1 plus the byte) but nothing in the replacement records it, and no facility was observed producing it, so the replaced disposition is not available here. Cost and consumer in `## ACCEPTED LIMIT` (1) |
| E5 | `update_usage(...)` | 419 | The single mutation point for the usage map: increments a per-`LabelType` count, pushes the referring address onto the refs vector, and on first insert records the `LabelType` that becomes the address's `first_type` (the first-wins arbitration) | `replaced-by: store-side (STORE-04 cross-references and search)` — **shape mismatch naming what is lost:** the refs vector maps directly onto Ghidra's reference export, but the *arbitration policy* (first-seen type wins, ties never revisited) is a naming policy, not an engine fact, and no engine has an opinion about it. Note the per-type count map is built here and **never read** — `analyze` destructures it as `_types_map` at line 202 — so within `analyzer.rs` the counting is dead and there is nothing to replace |
| E6 | `follow_indirect_jumps(...)` | 445 | On opcode `$6C` (`JMP ($xxxx)`) inside a `Code` block: if the pointer address is inside the image **and** the byte there is already typed `BlockType::Address` **and** `ptr_offset + 1 < data_len`, read the 16-bit little-endian pointer, emit an Auto `Jump`/`ExternalJump` label at the target unless a User label or an exclusion blocks it, and push a cross-reference target→`jmp_addr` | `replaced-by: Ghidra COMPUTED_JUMP` (observed `082e -> 089a COMPUTED_JUMP` in `ghidra3.txt`) — **shape mismatch, argued in both directions, below the table.** Whether the net is a loss is criterion 2's question (`C2_COMPUTED_DISPATCH`), not this audit's, and this row deliberately does not pre-empt it |
| E7 | `guess_scope_end(state, start)` | 546 | Scans the rendered disassembly forward from `start` and returns the last byte address of the first `RTS`/`RTI` line found; if a virtual splitter is met first *and* the preceding line has a non-zero byte length, returns that line's last byte instead; otherwise the last byte of the image | `replaced-by: Ghidra Function.getBody()` (observed: every one of the 17 functions in `ghidra3.txt` carries a `body=<n>` extent, e.g. `0817 sub_817 body=26`) — **shape mismatch naming what is lost:** r2000 returns **one end address** from a *linear* scan in address order; `getBody()` returns a *flow-derived* address set that may be non-contiguous. r2000's answer also exists for any address at all, whereas `getBody()` exists only where Ghidra created a function. And r2000 honours user-declared splitters and scope boundaries (`state.is_virtual_splitter`), which no engine sees |
| E8 | `flow_analyze(state, start)` | 581 | Worklist reachability from one entry: follows `JMP` absolute, `JSR` absolute and relative branches onto the queue; terminates a span at `JMP`, `RTS`, `RTI`, an unknown opcode, a truncated opcode or an already-visited byte; returns the covered `Range<usize>` spans | `replaced-by: Ghidra analyzeAll() with dxa-supplied entry points` (observed: 17 functions and 152 code bytes with dxa hints, against 0 functions and 0 code bytes without — the pivot's own before/after) — **shape mismatch, in the replacement's favour:** `flow_analyze`'s `JMP` arm handles `AddressingMode::Absolute` only (line 647), so it structurally cannot follow the very `JMP (indirect)` that E6 exists to handle, and it reads `raw_data` without consulting `block_types` at all, so it walks straight into data blocks. What is lost is that r2000's spans are cheap and deterministic with no decompiler in the loop |

### E6 argued in both directions — criterion 4's most load-bearing row

**Where r2000 does something Ghidra was not observed doing.** `follow_indirect_jumps` is
purely static and *declaration-driven*. It fires on any `JMP ($xxxx)` whose pointer sits in
a block a human (or a prior pass) has typed `Address`, with **no requirement that the site be
reachable** and **no requirement that the pointer value be derivable by data flow** — the
bytes at the pointer are simply read. Ghidra's `COMPUTED_JUMP` is produced by the decompiler
constant-folding the pointer, so on a site the decompiler does not reach, or a pointer it
cannot fold, **the reference is absent entirely and nothing is reported** — the failure is
silent, which `23-RESEARCH.md` § *State of the Art* records having reproduced on a synthetic
variant whose dispatch index was computed rather than immediate.

**Where Ghidra does something r2000 structurally cannot.** The one observed `COMPUTED_JUMP`,
`082e -> 089a`, is a `JMP ($fb)` whose zero-page pointer is **written at runtime** by the
program itself (`0827 -> 00fb WRITE`, `082c -> 00fc WRITE`), assembled from a split lo/hi
table — the decompiler's `DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad)`. r2000 cannot reach
this: for a `.prg` based at `$0801` the pointer `$00fb` fails the `is_internal` test outright
(line 495-499), and even in a flat 64K image the byte at `$00fb` would have to be pre-typed
`Address` *and* already hold the final value, which it does not — it is written by the code
being analysed.

**The precondition, stated plainly.** r2000's route requires **the target block to be already
typed as an address block**. That precondition is exactly the code/data map dxa exists to
produce and the store exists to hold, so the capability is not so much lost as relocated: the
declaration survives as store state (`STORE-01` per-range `address` typing), and reading a
16-bit pointer out of a declared address block is arithmetic, not analysis. That is why this
row is `replaced-by:` and not a loss — but the shape mismatch is real and is named: **the
replacement resolves a strictly harder case and fails silently on an easier one.**

---

## 2. `LabelType` vocabulary accounting

Eleven variants are produced by `analyzer.rs`. Each is a concrete fact r2000 records, so each
gets its own disposition — the replacement either records the same fact or drops it. The
enum itself declares **fourteen**; the three `analyzer.rs` never emits are store-side kinds
and are recorded under `## RESEARCH CORRECTIONS`, not counted here.

| # | Variant | Prefix | Produced at | The fact it records | Disposition |
|---|---|---|---|---|---|
| L1 | `ZeroPageField` | `zpf_` | 305 | This zero-page address is indexed (`zp,X` / `zp,Y`) — the base of an array in zero page | `replaced-by: store-side (STORE-05 typed label prefixes)` — shape-mismatch note: no reference kind carries "indexed"; `ghidra3.txt` has no zero-page-indexed example at all, and the axis is re-derived from the addressing mode in the decode |
| L2 | `Field` | `f_` | 334 | This absolute address is indexed (`abs,X` / `abs,Y`) — an array base, not a scalar | `replaced-by: store-side (STORE-05 typed label prefixes)` — shape-mismatch note: `0843 -> 0900 DATA` and `0847 -> 0902 DATA` (observed) record that a datum was referenced, not that the access was indexed; the distinction from L4 survives only in the decode |
| L3 | `ZeroPageAbsoluteAddress` | `zpa_` | 298 | A plain (non-indexed, non-indirect) zero-page access | `replaced-by: store-side (STORE-05 typed label prefixes)` — shape-mismatch note: observed as `0864 -> 004c READ` — the kind is preserved and the zero-page-ness is implicit in the address, but the "plain vs indexed vs indirect" trichotomy is re-derived |
| L4 | `AbsoluteAddress` | `a_` | 326, 81, 116, 149 | A plain absolute access, **and** every target reached through an `Address` / `LoHiAddress` / `HiLoAddress` data block walk | `replaced-by: Ghidra DATA reference kind` (observed, 13 occurrences, including the four address-table entries `08b7 -> 0892`, `08b9 -> 0896`, `08bb -> 089a`, `08bd -> 0871`) |
| L5 | `Pointer` | `p_` | 342, 197 | This location holds a 16-bit pointer — from an `Indirect` operand, or declared by an `ImmediateFormat::LowByte` / `HighByte` immediate | `replaced-by: Ghidra DEFINED_DATA width typing` (observed `00fb undefined2 len=2 label=DAT_00fb`) — shape-mismatch note: `undefined2` asserts *two bytes*, not *a pointer*; the pointer-ness appears only in the decompiler's `(code *)` cast, and the `ImmediateFormat` half is a user declaration no engine ever produced |
| L6 | `ZeroPagePointer` | `zpp_` | 351, 358 | This zero-page address is the low byte of a pointer pair used via `(zp,X)` / `(zp),Y` | `replaced-by: store-side (STORE-05 typed label prefixes)` — shape-mismatch note naming a concrete loss: Ghidra typed the observed pointer pair as **two independent one-byte data**, `00fd undefined1 len=1` and `00fe undefined1 len=1`, so the *pairing* is not recorded. It is re-derivable from the `(zp),Y` addressing mode in the decode |
| L7 | `Branch` | `b_` | 313 | A relative-branch target | `replaced-by: Ghidra CONDITIONAL_JUMP` (observed, 5 occurrences, e.g. `0820 -> 0817`) |
| L8 | `Jump` | `j_` | 323, 518 | An unconditional-jump target, whether direct or reached through an indirect table | `replaced-by: Ghidra UNCONDITIONAL_JUMP and COMPUTED_JUMP` (observed `0866 -> 004f UNCONDITIONAL_JUMP` and `082e -> 089a COMPUTED_JUMP`) |
| L9 | `Subroutine` | `s_` | 321 | A `JSR` target | `replaced-by: Ghidra UNCONDITIONAL_CALL plus a FUNCTIONS entry` (observed `0860 -> 0871 UNCONDITIONAL_CALL` with `0871 sub_871 body=8 callers=1`) |
| L10 | `ExternalJump` | `e_` | 238, 516 | A code-flow target **outside the loaded image** — r2000 promotes `Jump`/`Subroutine`/`Branch`/`Return` to this when `state.is_external(addr)` holds | `replaced-by: store-side (AUTO-03 image-range test)` — shape-mismatch note: the kind survives (`087d -> ffd2 UNCONDITIONAL_CALL`, observed, a KERNAL call outside the `$0810-$08bf` image) but no engine flags internal-vs-external; `AUTO-03` already requires exactly this image-range test for the annotation join, so the fact is produced by a rule this milestone is already committed to |
| L11 | `Return` | `r_` | 414 | The target is a bare `RTS`/`RTI` return stub — the IDA `locret_` convention | `lost-accepted: the r_ prefix and the Return value in the label vocabulary; no engine records "bare return stub" and none was observed producing it.` Cost and consumer in `## ACCEPTED LIMIT` (2) |

---

## 3. `BlockType` vocabulary accounting

Seven variants `analyzer.rs` dispatches on. The enum declares twelve; the five with no arm
fall through to `pc += 1` (lines 171-173) and record no fact — recorded under
`## RESEARCH CORRECTIONS`, not counted here.

| # | Variant | Handled at | The fact it records | Disposition |
|---|---|---|---|---|
| B1 | `Code` | 38-70 | This range decodes as instructions; each instruction's operand is attributed | `replaced-by: dxa -t detect-internal code/data map plus Ghidra analyzeAll()` (observed: 152 code bytes and 17 functions from dxa hints, 0 and 0 without) |
| B2 | `Address` | 73-87 | This range is a contiguous table of 16-bit little-endian addresses; each entry names a target | `replaced-by: Ghidra DEFINED_DATA range typing plus DATA references` — **both halves observed**: `08b7 pointer[4] len=8 label=data_8b7` gives the range with its element count and extent, and the four `DATA` references from `08b7`/`08b9`/`08bb`/`08bd` give the targets. This is the one data-side variant with a complete, range-shaped observation |
| B3 | `DataWord` | 88-89 | The range is 16-bit words rather than bytes — used for rendering only | `replaced-by: store-side (STORE-01 per-range "word" typing)` — shape-mismatch note: inside `analyzer.rs` this arm is a pure two-byte skip that emits **no label and no cross-reference**, so nothing is lost from the analyzer; the typing itself is store state `STORE-01` already names, and Ghidra's nearest observed analogue is a width-only `undefined2` |
| B4 | `LoHiAddress` | 90-122 | This range is a **split** pointer table: `n` low bytes followed by `n` high bytes, the extent bounded by the next virtual splitter, each pair naming a target | `replaced-by: Ghidra CONCAT11 decompiler idiom (GHID-04)` (observed as `DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad)`, and as the `082e -> 089a COMPUTED_JUMP` it enables) — **explicit shape-mismatch note naming what is lost: the range answer.** Ghidra reports a *per-program-point expression at one use site*; the two arrays themselves were typed `08ad undefined1 len=1` and `08b0 undefined1 len=1` (observed), i.e. one byte each, with **no extent, no pair count, no stride and no splitter boundary**. Contrast B2, where the contiguous table did get a `pointer[4] len=8` range. **This shape is not sufficient for a per-range typing model** (`STORE-01`'s concern): the store must carry the range as declared state, exactly as r2000 did, and cannot read it out of the decompiler |
| B5 | `HiLoAddress` | 123-155 | The same split table with the byte order reversed: `n` high bytes then `n` low bytes | `lost-accepted: no observation exists in either direction — the pivot fixture contained no HiLo table, so nothing in this project has been seen resolving one, and B4's CONCAT11 observation is the LoHi order only.` Claiming the mirrored case on the strength of the LoHi observation would be exactly the plausible-feature-list reasoning this audit's evidence discipline forbids. Cost, uncertainty and consumer in `## ACCEPTED LIMIT` (3) |
| B6 | `LoHiWord` | 156-170 | The range is a split 16-bit **value** table (not addresses), extent bounded by splitters | `replaced-by: store-side (STORE-01 per-range typing)` — shape-mismatch note: `analyzer.rs` walks the extent only to advance `pc` and emits **no label and no cross-reference** for it (verifiable at lines 156-170), so no analyzer fact is lost; what must survive is the range declaration, which is store state |
| B7 | `HiLoWord` | 156-170 | The same, byte order reversed; shares B6's arm exactly | `replaced-by: store-side (STORE-01 per-range typing)` — shape-mismatch note: identical to B6, and identical in the source — the two variants share one `else if` arm keyed on `current_type`, so there is no separate behaviour to lose |

---

## 4. Store-side dependencies created by this audit

Ten of the twenty-three `replaced-by:` rows name the annotation store rather than an engine.
Collected here so the weight is visible rather than spread across three tables, because each
is a **Phase 25 (or Phase 26) dependency this audit has just created** — a `replaced-by:`
whose replacement does not exist yet.

| Row | Named requirement |
|---|---|
| E1 `AnalysisResult` | `STORE-01`, `STORE-04` |
| E5 `update_usage` | `STORE-04` |
| L1 `ZeroPageField` | `STORE-05` |
| L2 `Field` | `STORE-05` |
| L3 `ZeroPageAbsoluteAddress` | `STORE-05` |
| L6 `ZeroPagePointer` | `STORE-05` |
| L10 `ExternalJump` | `AUTO-03` (Phase 26) |
| B3 `DataWord` | `STORE-01` |
| B6 `LoHiWord` | `STORE-01` |
| B7 `HiLoWord` | `STORE-01` |

B4 `LoHiAddress` is **not** in this table — its disposition names a Ghidra facility — but its
shape-mismatch note lands a further `STORE-01` obligation: the split-table *range* must be
carried as declared store state because the decompiler does not report it.

---

## Scope observations for Phase 25

Capabilities that reading `analyzer.rs` revealed but which **live outside it**. Recorded, not
counted: they are Phase 25's concern (`exporter/` at 2,749 lines and `state/` at 5,187,
per the pivot's sizing table), and folding them in would widen criterion 4 beyond the
`analyzer.rs` scope `SCHEMA.md` § 8 fixes.

`analyzer.rs` reads eleven distinct members of `AppState`. Six of them are behaviour, not
data, and every one is a store capability a replacement must provide before the audit's
`replaced-by: store-side` rows can be honoured:

1. **`AppState::is_virtual_splitter(addr)`** — `state/app_state.rs:343`. Returns true for an
   explicit splitter, for any scope start, and for the byte *after* any scope end. Consumed
   by the `LoHi`/`HiLo` extent walks (four call sites) and by `guess_scope_end`. Without it
   a split table has no terminator. Phase 25 dependency of `STORE-01` (scopes) — note the
   scope-end+1 rule is not obvious and is easy to reimplement wrongly.
2. **`AppState::is_external(addr)`** — `state/app_state.rs:262`. The image-range test, written
   to handle a wrapped image (`origin > end`). Consumed by the `ExternalJump` promotion and by
   `follow_indirect_jumps`. Phase 26 dependency of `AUTO-03`, which states the same rule in
   its own words.
3. **`AppState::excluded_addresses`** — consulted before emitting any Auto label (lines 243,
   528). A user-controlled suppression set. Phase 25 dependency of `STORE-01`; nothing in
   dxa or Ghidra has an equivalent.
4. **`AppState::labels` with `LabelKind`** — `state/types.rs:353`, the three-way
   `User` / `Auto` / `System` distinction, and the precedence rule that a User or System
   label at an address suppresses Auto generation entirely (lines 209-251), plus the
   preservation of strictly-unused User labels (lines 258-275). This is the whole of
   "regeneration must not destroy a human's work" and it is pure store policy. Phase 25
   dependency of `STORE-01` and `STORE-02` (undo).
5. **`AppState::immediate_value_formats` with `ImmediateFormat`** — `state/types.rs:436`.
   Eight variants, of which `LowByte(Addr)` and `HighByte(Addr)` are declarations that an
   immediate operand is half of an address, and are pre-seeded into the usage map as
   `Pointer` before analysis proper (lines 188-199). The other six (`Hex`, `InvertedHex`,
   `Decimal`, `NegativeDecimal`, `Binary`, `InvertedBinary`) are rendering-only and belong
   to the exporter. Phase 25 dependency of `STORE-01`, and directly relevant to `STORE-05`'s
   `=*+$01` idiom.
6. **`LabelType::format_label` / `LabelType::prefix`** — `state/types.rs:382-401`. The typed
   prefix table (`zpf_`, `f_`, `zpa_`, `a_`, `p_`, `zpp_`, `e_`, `j_`, `s_`, `b_`, `r_`,
   `L_`) that `analyzer.rs` calls at lines 244 and 521 but does not define. This is literally
   the artefact `STORE-05` names as worth stealing rather than rediscovering, and it lives in
   `state/`, not in `analyzer.rs`.

One further observation, about the **exporter** rather than the store: `guess_scope_end`
operates on `state.disassembly` — already-rendered lines with `bytes` and an optional
`opcode` — not on `raw_data`. So scope-end guessing sits *downstream* of rendering in r2000's
architecture. A replacement that computes scopes from bytes alone is a different design, and
the difference is worth deciding deliberately in Phase 25 rather than inheriting by accident.
