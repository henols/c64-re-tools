---
title: "Pivot — dxa + Ghidra replace the external analyser as the analysis substrate"
date: 2026-08-24
context: /gsd-explore "docs/dissambler-workflow.md — will it be more efficient than anno?"
status: decided by user 2026-08-24; reverses D-R1/D-R2; ROADMAP restructure not yet done
supersedes: .planning/notes/external-analyser-integration.md (D-R2 "required prerequisite")
---

# Pivot: dxa + Ghidra replace the external analyser

**Decision (user, 2026-08-24).** Stop building on the external analyser. Adopt dxa for
discovery and Ghidra headless for semantic analysis. Anything anno uniquely
offers is replicated as our own skill/tool/MCP surface. The cc65 half of
`docs/dissambler-workflow.md` (da65/ca65/ld65) is **not** adopted. Byte-perfect
reconstruction is explicitly **not** the goal — source quality and functionality
are; rebuilding a binary is a separate, later step.

The user was told the timing concern (v0.5.0 Phases 20-22 are built on anno)
and chose to pivot now rather than defer to v0.6.0. That is a deliberate,
recorded override, not a drift.

## Why the pivot became viable

anno looked irreplaceable while it appeared to be the analysis engine. It is
not. Measured on a purpose-built 279-byte fixture (141 code / 138 data bytes)
exercising split pointer tables, an RTS-trick dispatch, a full address table, a
bounded indexed array, a stride-5 record array, inline `JSR` parameters and
self-modifying code:

| | zero hints | with dxa hints |
|---|---|---|
| **dxa** 0.1.5 | 72% of data bytes typed as data, **0 false positives**; found every routine from the BASIC `SYS`; resolved the 4-entry address table to labels | — |
| **Ghidra** 12.1.3 | **nothing** — 0 functions, 0 code bytes, 1 ASCII string | 152 code bytes, 17 functions, 43 typed xrefs |
| **anno** 0.9.20 fresh bootstrap | flat linear decode; every data table rendered as garbage instructions (9 `!byte` lines total) | n/a |
| **da65** 2.18 no `.info` | flat linear decode (6 `.byte` lines) | n/a |

Ghidra alone contributed three facts nothing else produced:

```
082e -> 089a COMPUTED_JUMP   resolved jmp ($fb) through the split lo/hi table
08a2 -> 08a6 WRITE           the self-modifying write landing inside a Code block
0892 -> d021 READ_WRITE      inc $d021 typed read-write, not merely write
```

**Ghidra's structural facts live in the decompiler layer, not the listing's data
types.** Querying `DataTypeManager.getAllComposites()` and `getDefinedData()` —
the obvious implementation — returns essentially nothing on 6502. Via
`DecompInterface` the same program yields the index bound, the split-pointer
idiom and the record stride directly:

```c
} while (param_1 != 0x20);                          // array bound -> byte[32]
DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad);     // split pointer, typed code*
param_1 = param_1 + 5;  if (param_1 == 0x19) return; // record stride 5
```

Write `ExportAnalysis.java` against `DecompInterface`. This is the single most
expensive mistake available in this design.

**And mark `$0000-$0001` and `$D000-$DFFF` as volatile memory blocks before
`analyzeAll()`, or the decompiler deletes hardware writes as dead stores** --
silently, with no warning. See [[ghidra-volatile-io-and-banking]]. This is a
hard requirement of the pre-script, not a tuning option.

## Division of labour

dxa owns discovery: it is the only tool that produces a code/data map from
nothing, and the only one covering illegal NMOS opcodes (`-p all-nmos6502`).
Ghidra 12.1.3's `6502.slaspec` defines **57 instructions, all documented** — no
SLO/RLA/SRE/RRA/SAX/LAX/DCP/ISC/ANC/ARR, no `illegal`/`undocumented` handling,
and it ships `6502` and `65C02` language IDs only. For crack and packer code
that gap is real, and dxa closes exactly it.

Ghidra owns understanding, but only once handed an entry point.

## Sizing the replacement

`external-analyser-core` 0.9.20 is 31,585 lines of Rust:

| Subsystem | Lines | Position |
|---|---:|---|
| `state/` annotation store, undo, project file | 5,187 | must build |
| `core.rs` central model | 3,275 | must build |
| `unpacker.rs` + `packer_signatures.rs` | 3,959 | **dropped** — see below |
| `mcp/` 28-tool server | 2,857 | we own the MCP harness |
| `exporter/` 4 assemblers + HTML | 2,749 | need ~1 of 4 (ACME) |
| `disassembler/` + `disassembler.rs` | 4,596 | **already have** — 2,555 lines in `disasm-*.ts` |
| `parser/` prg/d64/t64/crt/vsf | 1,930 | partly — `anno-d64.ts` is 310 standalone lines |
| `analyzer.rs` | 1,506 | **irrelevant** once dxa+Ghidra own discovery |
| `cpu.rs` 6502 emulator | 1,441 | only the unpacker needed it |
| `vice/` | 1,048 | dead by D-R1 — never `--vice` |

Against that, **19,181 lines of our own anno integration code get deleted**
(9,087 non-test + 9,928 test). Net: build roughly 9,000 lines-equivalent of
store + model + one exporter; delete 19,181 lines of glue.

**The unpacker is dropped by explicit user decision** (2026-08-24): depack-by-
running via `c64-ram-capture` is sufficient. This dissolves the one capability
with no in-house equivalent (~5,400 lines including `cpu.rs`, with claimed 100%
unp64 benchmark parity across Exomizer 1.x/2.x/3.0/3.02+, Dali, ByteBoozer
1.0/2.0, PUCrunch).

## What must be replicated

1. **Annotation store** — labels, comments, per-range data typing, scopes,
   project enums, undo, persistence. The per-range typing is `DECOMP-01`'s
   substrate; nothing else in the stack records it.
2. **Cross-references derived from the typed decode**, and search over it.
3. **ACME exporter** with the two design details worth stealing rather than
   rediscovering: the `=*+$01` mid-instruction label idiom (how an SMC
   write-target is named without breaking reassembly — anno and dxa both do
   this; da65 does not), and typed label prefixes carrying inferred type in the
   name (`zpp_`/`zpa_`/`f_`/`a_`/`e_`).
4. **Loaders** beyond `.prg`/`.d64`: `.t64`, `.crt`, `.vsf`.

## Why cc65 is not adopted

da65's complete `RANGE TYPE` vocabulary is `ADDRTABLE BYTETABLE CODE
DBYTETABLE DWORDTABLE RTSTABLE SKIP TEXTTABLE WORDTABLE` (verified against the
binary's own string table). A split-address-table or a struct degrades to
anonymous `ByteTable`s on export — every structural fact Ghidra recovers dies at
that boundary. `PARAMSIZE` is present in the V2.18 binary and parses without
error but **did not fire** in testing, with or without a covering `TYPE Code`
range. And it emits ca65, not ACME.

## dxa packaging facts

Not in Debian's `xa65` package (`dpkg -L xa65` ships `xa`, `file65`, `ldo65`,
`printcbm`, `reloc65`, `uncpk` — no `dxa`). Separate tarball, 3,417 lines of C,
builds clean with plain `make`. GPLv2+. Dormant: tarball mtime 2022-03, latest
release 0.1.5, no FreeBSD port maintainer. **No machine-readable output** — the
listing parser is ours to own and maintain.

## Standing caveat

Every measurement here is one 279-byte fixture written by the same person
testing it. The constructs and the tools are real; a fixture author's dispatch
table is friendlier than a demo coder's. Re-run against a real cracked release
before anything load-bearing is built on these numbers. See
[[dxa-ghidra-real-fixture-question]].

Related: [[auto-annotation-from-ghidra-xrefs]], [[ghidra-volatile-io-and-banking]], [[external-analyser-integration]]
