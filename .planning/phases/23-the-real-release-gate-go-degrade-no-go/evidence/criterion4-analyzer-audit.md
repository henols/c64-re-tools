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

---

## 5. Outcome lines

**The arithmetic, reproduced so a reader recomputes rather than trusts.** Three tables were
audited and every row in all three carries exactly one disposition:

- § 1 entry points: **8** rows — E1..E8. Seven `replaced-by:`, one `lost-accepted:` (E4
  `promote_return_labels`), zero `lost-blocking:`.
- § 2 `LabelType`: **11** rows — L1..L11. Ten `replaced-by:`, one `lost-accepted:` (L11
  `Return`), zero `lost-blocking:`.
- § 3 `BlockType`: **7** rows — B1..B7. Six `replaced-by:`, one `lost-accepted:` (B5
  `HiLoAddress`), zero `lost-blocking:`.

Totals: `8 + 11 + 7 = 26` audited. Replaced `7 + 10 + 6 = 23`. Accepted as lost
`1 + 1 + 1 = 3`. Blocking `0 + 0 + 0 = 0`. The four counts close:
`23 + 3 + 0 = 26`, which equals the audited total.

C4_CAPABILITIES_AUDITED: 26
C4_REPLACED: 23
C4_LOST_ACCEPTED: 3
C4_UNREPLACED_CAPABILITIES: 0

**`C4_UNREPLACED_CAPABILITIES` is rule R8's only input.** `DECISION-RULE.md` R8 fires on
`c4_unreplaced > 0`; the threshold boundary contract states that exactly `0` does **not** fire
it and `1` does. This file records `0`, so criterion 4 does not fire R8.

**`C4_LOST_ACCEPTED` never changes the verdict, and the reason is that a capability accepted
as lost with its cost stated is a decision, not a defect.** It appears in no rule in
`DECISION-RULE.md` and may not be added to one — it is listed there explicitly among the four
inputs that never gate. A later reader must not read `C4_LOST_ACCEPTED: 3` as three failures:
it is three capabilities whose loss was priced and accepted, each written up below at the same
length a replacement would have been given.

**A zero is a claim, not an absence — so here is how to disagree with it.** `0` is the
non-firing value, which makes it the value most in need of adversarial reading. Exactly one
row would move the count if reclassified: **E6 `follow_indirect_jumps`**. It is written
`replaced-by:` because Ghidra was *observed* resolving a strictly harder indirect dispatch
(`082e -> 089a COMPUTED_JUMP`) and because the precondition r2000 required — an
already-`Address`-typed block — is itself store state the milestone is already committed to
holding. It should be reclassified `lost-blocking:` if, and only if, **both** of these turn
out to hold: criterion 2 records `C2_COMPUTED_DISPATCH: unresolved` on the real corpus, **and**
`GHID-04`'s "resolved computed jumps" acceptance is read as requiring the declaration-driven
static fallback rather than only the decompiler route. Criterion 2 is 23-08's measurement and
is not known at the time this file is written; this audit deliberately does not pre-empt it,
and R6 already exists to degrade on exactly that outcome without criterion 4 double-counting
it. No other row is close to the boundary: the remaining twenty-five are either observed
replacements or the three priced losses below.

---

## ACCEPTED LIMIT

**(1) The `Return` label promotion is gone: no engine records "this target is a bare return
stub".** `promote_return_labels` (E4, `analyzer.rs:372`) walked every code-flow label whose
target was internal, sat in a `Code` block, and began with `RTS` ($60) or `RTI` ($40), and
retyped it `LabelType::Return` — the doc comment names IDA Pro's `locret_` convention as the
model. Nothing in dxa's listing or Ghidra's export carries this fact. The nearest observed
approach is `085f sub_85f body=1 callers=0` in `ghidra3.txt`: Ghidra did create a function at
the one-byte body, but named and typed it identically to every other function, so the
return-stub-ness exists only as an inference a reader might draw from `body=1`.

**What this breaks:** nothing executes differently. What degrades is label quality at exactly
the places a human reading a disassembly most wants a hint — a jump table full of entries that
are all bare `RTS` reads as a jump table full of ordinary routines. In a cracked release, a
dispatch table whose unused slots point at a shared `RTS` is a common idiom, and losing the
distinction makes the used and unused slots look alike.

**Who consumes it:** `STORE-05` (typed label prefixes carrying inferred type in the name).
Note that `STORE-05`'s own text, and the pivot note's list of prefixes worth stealing
(`zpp_` / `zpa_` / `f_` / `a_` / `e_`), do **not** include `r_` — so this limit costs
`STORE-05` nothing it has already promised, and is recorded here so that the omission is a
decision rather than an oversight. Phase 25 may reinstate it cheaply: the rule is one byte
comparison at the target address, and both engines supply the bytes.

---

## ACCEPTED LIMIT

**(2) `LabelType::Return` leaves the label vocabulary, so the store's type set is eleven
values rather than twelve.** This is limit (1)'s consequence one layer down, and it is
recorded separately because it has a different consumer: (1) is about a *pass* that no longer
runs, this is about a *value* that no longer exists in the vocabulary the annotation store
persists. `analyzer.rs` produced eleven `LabelType` values (L1..L11); ten of them map onto an
observed engine fact or onto a store rule the milestone has already committed to
(`STORE-05`'s prefixes, `AUTO-03`'s image-range test). `Return` maps onto neither.

**What this breaks:** a store schema modelled on r2000's vocabulary would carry a `Return`
value that nothing can ever set, which is worse than not having it — a dead enum value invites
a later reader to assume something populates it. The honest schema omits it.

**Who consumes it:** `STORE-01` (the store holds labels … with per-range typing covering what
`DECOMP-01` will need in v0.7.0). The decision `STORE-01` must make explicitly is whether its
label-type vocabulary is r2000's minus `Return`, or a vocabulary designed from the engines'
own facts. This audit's recommendation is the latter, precisely because L1..L3, L6 and L10 are
already re-derivations rather than direct reads — but the decision belongs to Phase 25, not
here.

---

## ACCEPTED LIMIT

**(3) `BlockType::HiLoAddress` has no observation in either direction — the high-byte-first
split pointer table is unproven, not replaced.** `analyzer.rs:123-155` walks a hi-then-lo
split table exactly as it walks the lo-then-hi form (B4), pairing entry `i` of the high array
with entry `i` of the low array, bounded by the next virtual splitter. The pivot fixture
contained a LoHi table and **no HiLo table at all**, so the `CONCAT11` observation that backs
B4's `replaced-by:` covers the LoHi byte order only. Claiming the mirrored case on the
strength of the LoHi observation would be reasoning from a plausible feature list, which this
audit's evidence discipline and this plan's prohibitions both forbid.

**The uncertainty, stated as the cost requires:** the LoHi result makes it *likely* that
Ghidra's decompiler folds the HiLo idiom into an equivalent `CONCAT11` expression with the
operands swapped, since the byte-order difference is invisible at the p-code level. Likely is
not observed. If it holds, this limit costs nothing beyond B4's own shape mismatch; if it does
not, the HiLo table produces no pointer expression at all and the range must be typed by hand.

**What this breaks:** the same thing B4's shape mismatch breaks, with less confidence — a
per-range typing model cannot learn a split table's extent, pair count or stride from a
decompiler expression at one use site, and for the HiLo order it may not get the expression
either. Concretely: the four `DATA` references and the `pointer[4] len=8` range that made B2's
contiguous address table a clean replacement have no analogue here; the observed split arrays
were typed `08ad undefined1 len=1` and `08b0 undefined1 len=1`.

**Who consumes it:** `STORE-01` (per-range data typing … address, table). Phase 25 must carry
split-table ranges as declared store state with an explicit byte-order flag, and must not
assume either order can be recovered from the engines. A cheap way to discharge this limit is
to add a HiLo table to whatever fixture Phase 24 builds for `GHID-04` and re-check — this
audit is not the place to build one, since criterion 4 runs offline against source and starts
no engine.

---

## RESEARCH CORRECTIONS

Recorded here, in this plan's **own** evidence file, per evidence convention 8. **`23-RESEARCH.md`
is not edited by this plan** — plan 23-10 is its single owner and collects every correction in
one pass. Two parallel plans never edit one document.

1. **All eight line numbers in the research inventory are correct.** `8`, `20`, `285`, `372`,
   `419`, `445`, `546`, `581` verified against the structural grep reproduced below. No
   correction needed; recorded because a verifier should be able to see the check was made and
   not merely assumed.

2. **`LabelType` declares fourteen variants, not eleven.** The research says "11 variants
   used", which is accurate as written — eleven are produced by `analyzer.rs` — but the enum
   at `state/types.rs:361-378` carries fourteen. The three `analyzer.rs` never emits are
   `Predefined = 10`, `UserDefined = 11` and `LocalUserDefined = 12`, all three of which share
   the `L_` prefix and are store-side kinds set by a human or by a platform symbol table. The
   distinction between "the enum" and "what the analyzer produces" is not drawn in the
   research and is worth drawing, because a store schema copied from the enum would inherit
   three values the analysis pass has no opinion about.

3. **`BlockType` declares twelve variants, not seven.** Again the research's "7 variants used"
   is accurate — seven have an arm in `analyzer.rs` — but `state/types.rs:314-331` carries
   twelve. The five with no arm are `DataByte`, `PetsciiText`, `ScreencodeText`,
   `ExternalFile` and `Undefined`; all five fall through to the bare `else { pc += 1 }` at
   lines 171-173, i.e. they are walked one byte at a time and **record no label and no
   cross-reference**. This is a substantive fact the research does not state: r2000's analyzer
   is silent about text blocks and about undefined regions, so `STORE-01`'s PETSCII and
   screencode typing has no analyzer-side predecessor to inherit behaviour from.

4. **`update_usage`'s per-`LabelType` count map is built and never read.** The research
   summarises the function as "Ref counting + first-seen-type, feeding first-wins label
   selection". The refs vector and the first-seen type are read; the count map is not. Line
   427 increments `types.entry(priority)`, and line 202 destructures the tuple as
   `(_types_map, refs, first_type)` — the leading underscore is the compiler-silencing name
   for an unused binding. Within `analyzer.rs` the counting is dead code. This matters because
   "ref counting" implies a ranking mechanism that a replacement would have to reproduce, and
   there is none: selection is purely first-wins.

5. **`guess_scope_end`'s splitter branch can fall through, which the one-line summary hides.**
   The research says "or the next virtual splitter". Precisely: on meeting a splitter the
   function returns the *previous* line's last byte, but **only if that previous line has a
   non-zero byte length** (lines 561-564). If the previous line is a zero-length visual line
   the `if bytes > 0` guard fails, no value is returned, and the scan simply continues past
   the splitter to look for an `RTS`/`RTI`. The source carries an unresolved author comment at
   that exact spot ("Wait, just doing safe math or skipping back is fine.", line 560). A
   reimplementation that treats the splitter as an unconditional terminator would not match.

6. **`flow_analyze` ignores `block_types` entirely and cannot follow an indirect jump.** The
   research's "worklist reachability from an entry, returning covered `Range<usize>` spans" is
   correct but hides two structural limits. First, the function reads `state.raw_data`
   directly and never consults `state.block_types`, so it decodes straight into data blocks
   that the rest of the file is careful to respect. Second, its `JMP` arm is guarded by
   `op.mode == AddressingMode::Absolute` (line 647), so `JMP ($xxxx)` terminates the span
   without queueing anything — `flow_analyze` structurally cannot follow the construct
   `follow_indirect_jumps` exists to handle, and the two passes never combine.

7. **The research's grep missed one top-level item, and it is not an entry point.**
   `type UsageData` at line 13 — the tuple alias
   `(BTreeMap<LabelType, usize>, Vec<Addr>, LabelType)` that the usage map's value takes. It
   is recorded here rather than added to § 1's table because a type alias is not a capability;
   its three fields are dispositioned through E5 `update_usage`, which is the only code that
   writes it. No ninth *function* or *struct* exists: the structural grep below lists exactly
   nine top-level items, and the eight in § 1 plus `UsageData` account for all nine.

8. **The test count is exactly right.** The research says "25 `#[test]` functions"; `grep -c`
   returns `25`. The substantive body is lines 1-697 and the test module opens at line 699,
   so "roughly lines 1-700" and "about 25 tests" both hold.

---

## Reproducing this

**Source read.** The absolute registry path, verbatim:

```
/home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs
```

**Crate and version.** `regenerator2000-core` **0.9.20**, from the crates.io registry index
`index.crates.io-1949cf8c6b5b557f`. The supporting enum definitions were read from the sibling
file `.../regenerator2000-core-0.9.20/src/state/types.rs` and the two `AppState` helpers from
`.../src/state/app_state.rs`; both are recorded under `## Scope observations for Phase 25` as
outside this audit's counted scope.

**Path status.** Like the Ghidra probe install, this is an **external input to the phase**, not
a durable repository fact. A cargo registry checkout is content-addressed by the registry hash
and is deleted by `cargo clean`-style maintenance; the file's own sha256 below is the stable
identity, and the path is recorded only so a later reader can find the same bytes.

**No regenerator2000 process was started.** Not the binary, not `r2000-coverage.ts`, not any
`r2000_*` MCP tool, not as an oracle, a baseline or a screening tool (D-01, evidence
convention 4). Every fact in this file comes from reading text. Nothing in this audit compiled,
linked or executed the crate, and the plan's tool-permission posture denies `cargo install`.
The one tampering exposure this leaves — a modified registry copy — can only produce a wrong
audit, which is a recorded and re-checkable claim, not code execution (threat T-23-10); the
sha256 below is what makes it re-checkable.

**Transcript.** Commands as issued, with their real stdout:

```
$ ls -d $HOME/.cargo/registry/src/*/regenerator2000-core-0.9.20/src/analyzer.rs
/home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs

$ wc -l /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs
1506 /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs

$ sha256sum /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs
f72782ef488ff5ead229f0190c9107a6ed61ea6a0383a6738bad1ad65f62361b  /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs

$ grep -c '^\s*#\[test\]' /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs
25

$ grep -nE '^(pub )?(fn|struct|type) ' /home/henrik/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/analyzer.rs
8:pub struct AnalysisResult {
13:type UsageData = (
20:pub fn analyze(state: &AppState) -> AnalysisResult {
285:fn analyze_instruction(
372:fn promote_return_labels(state: &AppState, usage_map: &mut BTreeMap<Addr, UsageData>) {
419:fn update_usage(
445:fn follow_indirect_jumps(
546:pub fn guess_scope_end(state: &AppState, start: Addr) -> Addr {
581:pub fn flow_analyze(state: &AppState, start: Addr) -> Vec<std::ops::Range<usize>> {

$ grep -nE 'pub enum (LabelType|BlockType)' $HOME/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/regenerator2000-core-0.9.20/src/state/types.rs
314:pub enum BlockType {
361:pub enum LabelType {

$ grep -oE '\b(READ|WRITE|READ_WRITE|DATA|CONDITIONAL_JUMP|UNCONDITIONAL_JUMP|UNCONDITIONAL_CALL|COMPUTED_JUMP)\b' .planning/notes/dxa-ghidra-pivot-evidence/ghidra3.txt | sort | uniq -c | sort -rn
     13 DATA
     10 READ
      9 WRITE
      5 CONDITIONAL_JUMP
      2 UNCONDITIONAL_CALL
      2 READ_WRITE
      1 UNCONDITIONAL_JUMP
      1 COMPUTED_JUMP
```

The last command is the reference-kind histogram every `replaced-by:` claim in this file cites
against. It sums to 43, matching the pivot note's "43 typed xrefs", and the eight kinds it
lists are the complete observed vocabulary — no `replaced-by:` in this file names a Ghidra
reference kind absent from it.
