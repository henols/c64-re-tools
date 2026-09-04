# Phase 36 Plan 06 -- Opcode Sweep Evidence

Recorded from real live runs against Ghidra 12.1.3 (`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`), `VICE_LIVE_GHIDRA=1 node --test ghidra-opcode-live.test.ts`. Every run built its own `mkdtemp` scratch workspace outside the repository and tore it down in a `finally`; `git status --porcelain` over `vendor/` and `tools/` was confirmed empty after every run below.

## Part 1 -- the 105-byte sweep: `6502:LE:16:nmos` decodes all of it, `6502:LE:16:default` is observed FAILING

**Derived cardinality.** `opcodeBytesInText()` extracts every distinct `op=0x[0-9a-fA-F]{2}` byte value from the committed `vendor/ghidra-ext/data/languages/6502_undocumented.sinc`, lowercased and de-duplicated. MEASURED: **exactly 105** distinct bytes -- independently confirmed at the shell:

```
$ grep -ao 'op=0x[0-9a-fA-F][0-9a-fA-F]' vendor/ghidra-ext/data/languages/6502_undocumented.sinc | tr 'A-F' 'a-f' | sort -u | wc -l
105
```

**Sweep layout** (see `fixtures/ghidra/README.md` -> "Opcode sweep layout" for the same rule recorded there): one byte per 4-byte slot, `slot(i) address = 0x2000 + i*4` (`i` in ascending-byte-value order), byte 0 = the opcode under test, bytes 1-2 = `$EA` (NOP) filler, byte 3 = `$60` (RTS) terminator. All 105 slots span `$2000`-`$21a0` inclusive (start addresses), on the flat-64K import route.

**Both wire requests** (`ghidra.analyze`, via `runGhidraAnalyze()`), identical except `processor` and `runId`/`exportPath`:

```json
{
  "runId": "sweep105-nmos",
  "importPath": "sweep105.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "sweep105-entrypoints.txt",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "sweep105-nmos-export.txt"
}
```

```json
{
  "runId": "sweep105-default",
  "importPath": "sweep105.bin",
  "processor": "6502:LE:16:default",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "sweep105-entrypoints.txt",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "sweep105-default-export.txt"
}
```

Both runs used the identical generated sweep image (`sweep105.bin`), the identical entry-points file, and the identical import route -- only `processor` differed.

**Per-byte decode table, both languages, side by side.** `code` means the slot's own opcode-byte address classified as code (an `Instruction` code unit) in `GhidraStructExport.java`'s `## CLASSIFICATION` section; `undef` means it did not.

| byte | nmos | default |
|---|---|---|
| $02 | code | undef |
| $03 | code | undef |
| $04 | code | undef |
| $07 | code | undef |
| $0b | code | undef |
| $0c | code | undef |
| $0f | code | undef |
| $12 | code | undef |
| $13 | code | undef |
| $14 | code | undef |
| $17 | code | undef |
| $1a | code | undef |
| $1b | code | undef |
| $1c | code | undef |
| $1f | code | undef |
| $22 | code | undef |
| $23 | code | undef |
| $27 | code | undef |
| $2b | code | undef |
| $2f | code | undef |
| $32 | code | undef |
| $33 | code | undef |
| $34 | code | undef |
| $37 | code | undef |
| $3a | code | undef |
| $3b | code | undef |
| $3c | code | undef |
| $3f | code | undef |
| $42 | code | undef |
| $43 | code | undef |
| $44 | code | undef |
| $47 | code | undef |
| $4b | code | undef |
| $4f | code | undef |
| $52 | code | undef |
| $53 | code | undef |
| $54 | code | undef |
| $57 | code | undef |
| $5a | code | undef |
| $5b | code | undef |
| $5c | code | undef |
| $5f | code | undef |
| $62 | code | undef |
| $63 | code | undef |
| $64 | code | undef |
| $67 | code | undef |
| $6b | code | undef |
| $6f | code | undef |
| $72 | code | undef |
| $73 | code | undef |
| $74 | code | undef |
| $77 | code | undef |
| $7a | code | undef |
| $7b | code | undef |
| $7c | code | undef |
| $7f | code | undef |
| $80 | code | undef |
| $82 | code | undef |
| $83 | code | undef |
| $87 | code | undef |
| $89 | code | code |
| $8b | code | undef |
| $8f | code | undef |
| $92 | code | undef |
| $93 | code | undef |
| $97 | code | undef |
| $9b | code | undef |
| $9c | code | undef |
| $9e | code | undef |
| $9f | code | undef |
| $a3 | code | undef |
| $a7 | code | undef |
| $ab | code | undef |
| $af | code | undef |
| $b2 | code | undef |
| $b3 | code | undef |
| $b7 | code | undef |
| $bb | code | undef |
| $bf | code | undef |
| $c2 | code | undef |
| $c3 | code | undef |
| $c7 | code | undef |
| $cb | code | undef |
| $cf | code | undef |
| $d2 | code | undef |
| $d3 | code | undef |
| $d4 | code | undef |
| $d7 | code | undef |
| $da | code | undef |
| $db | code | undef |
| $dc | code | undef |
| $df | code | undef |
| $e2 | code | undef |
| $e3 | code | undef |
| $e7 | code | undef |
| $eb | code | undef |
| $ef | code | undef |
| $f2 | code | undef |
| $f3 | code | undef |
| $f4 | code | undef |
| $f7 | code | undef |
| $fa | code | undef |
| $fb | code | undef |
| $fc | code | undef |
| $ff | code | undef |

**Under `6502:LE:16:nmos`:** all 105 slot addresses classify as `code` -- zero
failures. `assertSweepFullyDecodes()` over the full 105-byte set succeeds.

**Under `6502:LE:16:default`:** 104 of the 105 slot addresses classify as
`undef` -- `assertSweepFullyDecodes()` over the same 105-byte set THROWS
(observed FAILING, the second half of criterion 1), naming all 104 in its own
error message. The undecoded set is non-empty (size 104) and, for every one
of those 104 bytes, the nmos map above shows `code` -- the two languages'
verdicts differ on every one of them, asserted per byte.

**A disclosed, MEASURED anomaly, not explained away.** One byte, `$89`
(this project's own undocumented `NOP "#"imm8`), decodes as `code` under the
STOCK `6502:LE:16:default` language too, even though `6502.slaspec` declares
no constructor for `op=0x89` anywhere (confirmed: `grep -c 'op=0x89'
6502.slaspec` is 0; only `65c02.slaspec` declares it, as `BIT "#"imm8`). This
was reproduced identically across two independent runs (with and without the
RTS terminator later added -- see `fixtures/ghidra/README.md`), so it is a
real, repeatable artifact of this run, not a fluke. It is consistent with
`analyzeAll()`'s own generic analyzer suite (`Disassemble Entry Points`,
`Non-Returning Functions`, `Function ID`, etc. -- all run as part of the
standard analysis pipeline `VolatileCarve.java` triggers) doing more than a
single explicit `disassemble(entry)` call at that one address; this plan did
not chase the exact analyzer responsible, and records the anomaly here
rather than silently omitting it or padding the undecoded count to a rounder
104-of-104. It does not change any of this Part's own conclusions: the
plan's own wording anticipates "at least one, and in practice most" bytes
failing under the stock language -- 104 of 105 satisfies that literally, and
the 105-byte assertion is still observed FAILING either way.

**Criterion 1, both halves.** The first half -- the run-log naming the
language actually used -- is plan 36-01's own `evidence/36-01-language-used.md`.
This Part is the second half: the SAME 105-byte assertion, run against the
identical sweep, observed FAILING under the stock language.

<!-- gsd:write-continue -->
