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

## Part 2 -- the six unstable/page-crossing bytes decode to a declared unknown, never plausible arithmetic

Sweep base `$3000`, one representative byte per declared pcodeop (source
order: `unstableXAA`, `unstableLAXImmediate`, `unstableAHXStore`,
`unstableTASStore`, `unstableSHXStore`, `unstableSHYStore`), each derived
from the committed `.sinc` by `findRepresentativeBytes()` -- the FIRST
constructor (source order) whose body calls the pcodeop. `unstableAHXStore`
is referenced by two constructors (`$93`, `(zp),Y`, and `$9f`, `abs,Y`);
`$93` is the one picked, since it appears first in the source.

| pcodeop | byte | mnemonic | address |
|---|---|---|---|
| unstableXAA | $8b | XAA | $3000 |
| unstableLAXImmediate | $ab | LAX | $3004 |
| unstableAHXStore | $93 | AHX | $3008 |
| unstableTASStore | $9b | TAS | $300c |
| unstableSHXStore | $9e | SHX | $3010 |
| unstableSHYStore | $9c | SHY | $3014 |

Run under `6502:LE:16:nmos` only (this task is about proving OUR extension's
own opaque-operation contract; the stock language has no constructor for any
of these six bytes at all). All six decompiled cleanly (0 failed, 0 timed
out) -- MEASURED only after the RTS terminator was added to the sweep
generator (see Part 1's own note and `fixtures/ghidra/README.md`); without
one, `DECOMPILE_FAILED` was 6 of 6 (see below).

**All six decoded forms, verbatim, from `## DECOMPILED_TEXT`:**

```c
FUNCTION 3000 FUN_3000
undefined1 FUN_3000(undefined1 param_1,undefined1 param_2)
{
  undefined1 uVar1;
  uVar1 = unstableXAA(param_1,param_2,0xea);
  return uVar1;
}

FUNCTION 3004 FUN_3004
undefined1 FUN_3004(undefined1 param_1)
{
  undefined1 uVar1;
  uVar1 = unstableLAXImmediate(param_1,0xea);
  return uVar1;
}

FUNCTION 3008 FUN_3008
void FUN_3008(undefined1 param_1,undefined1 param_2,byte param_3)
{
  undefined1 uVar1;
  uVar1 = unstableAHXStore(param_1,param_2,CONCAT11(DAT_00eb,DAT_00ea),param_3);
  *(undefined1 *)(CONCAT11(DAT_00eb,DAT_00ea) + (ushort)param_3) = uVar1;
  return;
}

FUNCTION 300c FUN_300c
void FUN_300c(byte param_1,byte param_2,byte param_3)
{
  undefined1 uVar1;
  uVar1 = unstableTASStore(param_1 & param_2,0xeaea,param_3);
  (&LAB_eaea)[param_3] = uVar1;
  return;
}

FUNCTION 3010 FUN_3010
void FUN_3010(undefined1 param_1,byte param_2)
{
  undefined1 uVar1;
  uVar1 = unstableSHXStore(param_1,0xeaea,param_2);
  (&LAB_eaea)[param_2] = uVar1;
  return;
}

FUNCTION 3014 FUN_3014
void FUN_3014(byte param_1,undefined1 param_2)
{
  undefined1 uVar1;
  uVar1 = unstableSHYStore(param_2,0xeaea,param_1);
  (&LAB_eaea)[param_1] = uVar1;
  return;
}
```

Every one of the six calls its own source-declared pcodeop by name, and in
every case the call's own return value (`uVar1`) is what flows DIRECTLY to
the destination -- a bare `return uVar1;` for the two register-producing
operations (XAA, immediate LAX), a bare `... = uVar1;` pointer/array store
for the four store-producing operations (AHX, TAS, SHX, SHY). No arithmetic
operator ever appears between the call and its own destination.

**What a plausible-p-code outcome would have looked like, and why it would
be worse.** If these six constructors had instead implemented deterministic
arithmetic (as the OTHER 99 undocumented instructions correctly do), the
decompiled output would show ordinary expressions -- e.g. `A = (A & X) &
param_1;` for XAA, or `*(addr) = A & X;` for AHX -- indistinguishable in
shape from any of this file's genuinely deterministic instructions (SLO,
RLA, DCP, SAX, ...). A reader (or an automated annotation pass) would have
no signal that the real hardware's behaviour on these six bytes is
UNDEFINED and chip/revision-dependent; the confident-looking arithmetic
would be silently WRONG on real hardware some fraction of the time. The
opaque userop call is what admits the gap instead of hiding it -- exactly
what `OPC-02` requires: "a confident wrong semantic is worse than an
admitted gap."

**On the flagged assumption.** This plan's own `flagged_assumptions`
worried the decoded form might not surface the operation's name in any
output the harness already produces. MEASURED: it does -- `##
DECOMPILED_TEXT` (added in plan 36-05, additively, for an unrelated reason)
names every one of the six pcodeops verbatim, by their own source-declared
name, in every one of the six decompiled bodies above. No further export
change was needed.

## Part 3 -- the 15 shared bytes keep their 65C02 meaning, and the non-collision is structural

**The derived overlap set and its size.** `opcodeBytesInText()` (Part 1's own
derivation helper) run over the host's installed
`$GHIDRA_HOME/Ghidra/Processors/6502/data/languages/65c02.slaspec`, then
intersected with the 105-byte set. MEASURED: **exactly 15** shared bytes --
independently confirmed at the shell:

```
$ A=$(mktemp) && B=$(mktemp)
$ grep -ao 'op=0x[0-9a-fA-F][0-9a-fA-F]' vendor/ghidra-ext/data/languages/6502_undocumented.sinc | tr 'A-F' 'a-f' | sort -u > "$A"
$ grep -ao 'op=0x[0-9a-fA-F][0-9a-fA-F]' $GHIDRA_HOME/Ghidra/Processors/6502/data/languages/65c02.slaspec | tr 'A-F' 'a-f' | sort -u > "$B"
$ comm -12 "$A" "$B" | wc -l
15
```

`$1a, $34, $3a, $3c, $5a, $64, $74, $7a, $7c, $80, $89, $9c, $9e, $da, $fa` --
asserted both as a set (`deepEqual`) and as a size, with a separate
non-empty-overlap assertion carrying its own message (an empty overlap would
make the non-collision check below entirely vacuous).

**The two shared bytes also in the eight-constructor compile-failure set:**
`$9c` (SHY in this extension) and `$9e` (SHX in this extension) -- called
out explicitly below.

**Per-byte 65C02 table.** Sweep base `$4000`, one slot per shared byte in
ascending order (same generator, same slot layout as Parts 1-2). Run under
`65C02:LE:16:default` in the SAME installation that has the extension
installed. All 15 classify as `code`; `## DECOMPILE_ACCOUNTING` reports
`DECOMPILE_ATTEMPTED 15 / DECOMPILE_DECOMPILED 15 / DECOMPILE_FAILED 0`.

| byte | extension mnemonic (this project) | 65C02 decompiled body (verbatim) | compile-failure set |
|---|---|---|---|
| $1a | NOP (implied) | `return param_1 + '\x01';` (INC A) | |
| $34 | NOP zp,X | `return;` (BIT zp,X -- flags only, no visible side effect) | |
| $3a | NOP (implied) | `return param_1 + -1;` (DEC A) | |
| $3c | NOP abs,X | `return;` (BIT abs,X -- flags only) | |
| $5a | NOP (implied) | `return;` (PHY -- stack effect only, no visible body) | |
| $64 | NOP zp | `DAT_00ea = 0;\nreturn;` (STZ zp) | |
| $74 | NOP zp,X | `*(undefined1 *)(ushort)(byte)(param_1 - 0x16) = 0;\nreturn;` (STZ zp,X) | |
| $7a | NOP (implied) | `return;` (PLY -- stack effect only) | |
| $7c | NOP abs,X | `return param_1 + '\x01';` (JMP (abs,X) -- decompiler renders the indirect-jump target computation; the run log records `UNRESOLVED_DISPATCH_COUNT 1` / `4020 JMP`, since this dispatch target is genuinely computed) | |
| $80 | NOP #imm | `return;` (BRA rel -- unconditional branch, no visible body) | |
| $89 | NOP #imm | `return;` (BIT #imm -- flags only) | |
| $9c | SHY imm16,X | `LAB_eaea = 0;\nreturn;` (STZ abs) | **yes** |
| $9e | SHX imm16,Y | `(&LAB_eaea)[param_1] = 0;\nreturn;` (STZ abs,X) | **yes** |
| $da | NOP (implied) | `return;` (PHX -- stack effect only) | |
| $fa | NOP (implied) | `return;` (PLX -- stack effect only) | |

**Non-collision, checked, not merely described.** For every one of the 15
bytes, the decompiled body was checked against all six of this extension's
own pcodeop names (`unstableXAA`, `unstableLAXImmediate`,
`unstableAHXStore`, `unstableTASStore`, `unstableSHXStore`,
`unstableSHYStore`) -- NONE appear in any of the 15 bodies. For the two
compile-failure bytes specifically, `$9c` and `$9e` each decompile to a
literal store-of-zero statement (`= 0;`) -- the real, distinctive signature
of 65C02's own `STZ` instruction, and the opposite of this extension's own
`SHY`/`SHX` semantics (which compute an opaque, page-crossing-dependent
stored value via `unstableSHYStore`/`unstableSHXStore`, never a literal
zero).

**The structural reason.** `65c02.slaspec`'s own first line is
`@include "6502.slaspec"` -- it includes only the STOCK base source, never
this project's own extension. The stock `6502.ldefs` declares exactly its
own two original ids (`6502:LE:16:default`, `65C02:LE:16:default`) --
MEASURED unchanged, read directly from the `<language>` elements' own `id`
attributes (a naive whole-file `id="..."` scan would have double-counted
each language's own NESTED `<compiler ... id="default"/>` child element,
which is a different `id` entirely -- caught and corrected before this
assertion was written). The extension's own `6502_nmos.ldefs` is a
physically SEPARATE file declaring exactly one id, `6502:LE:16:nmos`, which
does not collide with either of the stock file's two ids. This is what makes
the non-collision STRUCTURAL rather than incidental: the 65C02 language
loads its own compiled `65c02.sla`, built from its own include of the base
source; the extension's bytes live in a different compiled file
(`6502_nmos.sla`) behind a different id. There is no code path by which the
65C02 language could inherit the extension's semantics even if this test
never ran.

**What remains unproven.** The sweep in all three Parts above is synthetic
-- a generated image with one isolated instruction per slot, never a real
program. The real-code check -- whether this language decodes an ACTUAL
cracked release's bytes usefully -- is plan 36-07's, named here so a future
reader does not mistake this plan's synthetic proof for that one.
