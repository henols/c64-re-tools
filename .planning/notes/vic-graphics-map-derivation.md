---
title: "Locating C64 graphics areas: derive them from the VIC pointers, not from cross-references"
date: 2026-08-24
context: /gsd-explore — user question about VIC banks and instructing Ghidra to ignore graphics
status: demonstrated end to end on a committed fixture
---

# Locating graphics areas from the VIC pointers

## dxa knows nothing about the VIC

Checked, not assumed. dxa 0.1.5's **entire** C64-specific knowledge is eight
lines in `main.c:531-538` testing whether the load address looks like a BASIC
start. No VIC-II, no sprites, no charset, no bitmap, no `$D018`, no `$DD00`. The
single `grep` hit for "VIC" is `StartAddress == 0x1001 /* VIC, 16, +4 */` — the
VIC-**20** machine, not the VIC-II chip. dxa is the discovery engine and nothing
more.

## Why cross-references cannot find graphics

**The VIC fetches screen, charset and bitmap by DMA, not through the CPU.** A
charset can be referenced by no instruction anywhere in the program. There is
frequently *nothing* for an xref-based approach to find. What locates it is the
register write that points the VIC at it.

## The derivation

With `$D000-$DFFF` volatile ([[ghidra-volatile-io-and-banking]]), Ghidra recovers
the pointer writes including their read-modify-write arithmetic:

```c
DAT_dd00 = bVar1 & 0xfc | 2;   // bank bits cleared, then set to %10
DAT_d018 = 0x18;
DAT_d011 = bVar1 & 0xdf;       // BMM cleared -> text mode
```

From which (see `vicderive.mjs` in the evidence dir):

```
$DD00 bits 0-1, INVERTED   -> VIC bank      $4000-$7fff
$D018 bits 4-7, x $0400    -> screen matrix $4400-$47e7  (1000 bytes)
$D018 bits 1-3, x $0800    -> charset       $6000-$67ff  (2048 bytes)
$D011 bit 5 (BMM)          -> text mode, so charset applies rather than bitmap
screen + $3F8              -> sprite pointers $47f8-$47ff (8 bytes)
```

In bitmap mode `$D018` bit 3 alone selects the bitmap in `$2000` steps instead.
Those ranges are then handed to dxa as `-b xxxx-yyyy` data blocks and to Ghidra
as data — which is the "instruct it to ignore the graphics" step.

## Why this is worth doing even though graphics decode to nonsense

The user's reading was that these areas are "garbled information anyway". True of
the *rendering*, but the rendering is not the cost. **Graphics bytes decoded as
instructions mint phantom labels and phantom cross-references that look exactly
like real ones.** From the first fixture in this exploration, anno decoding a
plain 32-byte counting table produced:

```
ora (zpp_02,x)   slo (zpp_04,x)   ora zpa_06   ora a_0F0E   ora f_1B1A,y
```

`zpp_02`, `zpa_06`, `f_1B1A` are invented symbols indistinguishable in form from
genuine ones. In a convergence loop this is actively dangerous: a phantom routine
found inside a charset gets promoted to a Ghidra function, yields phantom xrefs,
feeds the annotation join, and emerges as a confident wrong comment — and the
next pass treats it as established.

The error direction makes it worse. dxa scored **0 false positives** (never
called code data) but 28% false negatives (called data code). Its errors run
exactly the dangerous way, and graphics regions are the largest single source of
them.

## Honest gap: sprite bitmaps are not locatable this way

The 8 sprite *pointer* bytes are locatable (screen + `$3F8`). The sprite bitmaps
they point at are not: the pointer values are program data in the screen matrix,
usually written at runtime, so they are not register values Ghidra can recover.
Locating sprite data needs either the pointer values from a RAM capture
(`c64-ram-capture` gives this directly) or a data-flow trace of the writes into
screen+`$3F8`. Untested either way.

## Second gap: one map per program point, not one per program

This fixture sets the VIC pointers once, in straight-line code. Programs that
switch bank or charset per raster split have several valid graphics maps, and a
single derived map is wrong for all but one. Same path-dependence limit recorded
in [[ghidra-volatile-io-and-banking]].

Related: [[dxa-ghidra-pivot]], [[auto-annotation-from-ghidra-xrefs]]
