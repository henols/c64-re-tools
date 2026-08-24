---
title: "Ghidra: volatile I/O blocks are mandatory, and they are what makes bank-aware annotation possible"
date: 2026-08-24
context: /gsd-explore — user question "can dxa tell us what is banked in or out?"
status: both findings demonstrated on a committed fixture
---

# Volatile I/O blocks: a correctness requirement, and the banking answer

## 1. dxa cannot help with banking

`grep -in bank` over all 3,417 lines of dxa 0.1.5 returns **zero** matches, and
zero in its man page. It models a flat address space with no memory
configuration. Rule it out for this purpose; it remains the discovery engine.

## 2. Ghidra silently deletes hardware writes unless I/O is marked volatile

**This is a correctness hazard, not a missing feature, and it fails silently.**

Fixture (`bank.a`) writes `$01` four times and `$d020` twice. Ghidra 12.1.3,
default settings, decompiled it to:

```c
DAT_d020 = 0xaa;
...
DAT_0001 = 0x37;
```

Three of the four `$01` writes and the `$05` border write were **eliminated as
dead stores**. To the decompiler `$01` and `$d020` are ordinary RAM; two stores
with no intervening read means the first is dead. Applied to a raster loop that
writes `$d020` every scanline, this deletes the entire visible effect and emits
no warning.

**Fix, in the pre-script, before `analyzeAll()`:**

```java
MemoryBlock b = mem.createUninitializedBlock("IO", sp.getAddress(0xd000), 0x1000, false);
b.setVolatile(true); b.setRead(true); b.setWrite(true);
```

Cover at minimum `$0000-$0001` (processor port) and `$D000-$DFFF` (VIC-II, SID,
CIA1, CIA2, colour RAM). Note the loader may already own a block at an address —
call `mem.getBlock(addr)` first and `setVolatile(true)` on the existing block
rather than creating a conflicting one, or the script throws
`MemoryConflictException` and the whole run silently falls back to non-volatile.

## 3. With volatile set, the bank state is fully recoverable

Same binary, volatile applied:

```c
DAT_0001 = 0x37;                              // BASIC in, KERNAL in, I/O in
DAT_d020 = 5;                                 // (A) real border colour
DAT_0001 = 0x34;                              // %00110100 - ALL RAM
DAT_d020 = 0xaa;                              // (B) plain RAM write, NOT the border
uVar1   = DAT_d020;                           // (C) reads RAM
DAT_0001 = 0x33;                              // %00110011 - Character ROM at $D000
  *(bVar2 + 0x3000) = (&DAT_d000)[bVar2];     // (D) Character ROM, NOT sprite-0-X
DAT_0001 = 0x37;                              // restore
```

Every `$01` value is recovered **as a literal, in program order, interleaved with
the accesses it governs**. The xref layer independently pins every write site:

```
0812 -> 0001 WRITE      081c -> 0001 WRITE
0828 -> 0001 WRITE      0837 -> 0001 WRITE
```

## 4. Consequence for the annotation join

[[auto-annotation-from-ghidra-xrefs]] gains a third selection rule:

**Rule 3 — resolve the bank state before the address.** Decode `$01` bits 0-2
(LORAM / HIRAM / CHAREN), carry the state forward per program point from the
recovered literals, and parameterize the `memmap.json` lookup by it. Under `$34`
a `$d020` write is RAM, not the border colour; under `$33` a `$d000` read is
Character ROM, not sprite-0-X. Annotating those from a flat address model
produces confident, wrong comments — the exact failure mode flagged as the
highest-risk item in `.planning/research/questions.md`.

Unresolved: the VIC bank selected by CIA2 `$DD00` bits 0-1 is a second,
independent banking axis governing where the VIC *reads* screen/charset/bitmap
from. Not tested. Same technique should apply, since `$DD00` falls inside the
volatile I/O block.

Also unresolved: this fixture sets `$01` from immediate literals in straight-line
code. Real code computes it, or sets it inside a routine called from several
banking contexts, at which point the state is path-dependent and a single
forward-carried value is wrong. Worth establishing where that breaks before
relying on it.

Related: [[dxa-ghidra-pivot]], [[auto-annotation-from-ghidra-xrefs]]
