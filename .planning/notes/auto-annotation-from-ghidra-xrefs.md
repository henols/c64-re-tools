---
title: "Automatic annotation: Ghidra typed xrefs x memmap.json, no agent in the loop"
date: 2026-08-24
context: /gsd-explore — user hypothesis that dxa+Ghidra could annotate automatically
status: proof of concept executed and passing on the synthetic fixture
---

# Automatic annotation from Ghidra xrefs x memmap.json

**The hypothesis held.** Every hardware, KERNAL and zero-page access in a program
can be annotated mechanically by joining Ghidra's typed cross-references against
`c64-memory-mapping`'s `memmap.json` (959 entries, 4 published sources). No agent
call, no queue walk, no skill invocation.

Measured on the pivot fixture: **18 of 18 machine-address xrefs annotated
(10 distinct addresses), 25 program addresses correctly skipped, out of 43 total.**

```
$d020  Border color (only bits #0-#3).
$d021  Background color (only bits #0-#3).
$ffd2  Output Vector, chrout
$0400  VICSCN — Default Screen Video Matrix.
$00fb  FREKZP — Free Zero Page space for User Programs.
$004c  VARTXT — Temporary storage for TXTPTR during READ, INPUT and GET.
$004f  Pointer to current FN function.
```

## The two rules that make it correct

Both were got wrong on the first attempt, and both fail *silently* — producing
plausible, confident, wrong comments rather than an error.

**1. Narrowest containing range wins.** `memmap.json` entries overlap: `$D020`
is covered both by a 1-byte "Border color (only bits #0-#3)" entry and by a
4096-byte "I/O Area (memory mapped chip registers)" entry. Selecting by
description length — or by first match — yields the useless wide one. Select the
entry with the smallest `end - start` that contains the address; break ties in
favour of the entry carrying a `sym`.

**2. An address inside the loaded image is a program address, never a machine
address.** Skip `memmap.json` lookup entirely for anything within the image
range. Otherwise in-program branch targets land inside the "Default BASIC area
(38911 bytes)" entry and get annotated as if they were machine features — the
first attempt annotated two ordinary loop-back branches this way.

**3. Resolve the bank state before resolving the address.** Added 2026-08-24
after testing -- see [[ghidra-volatile-io-and-banking]]. `$d020` under `$01 = $34`
is RAM, not the border colour; `$d000` under `$01 = $33` is Character ROM, not
sprite-0-X. Ghidra recovers every `$01` value as a literal in program order,
*provided* the I/O ranges are marked volatile. Without rule 3 the join emits
confident, wrong comments on any program that banks.

## Why this matters for the pivot

This is `DECOMP-03` ("every referenced non-hardware address is named and
documented") and `DECOMP-04` ("every hardware register write renders as a named
enum rather than a magic number") done mechanically rather than by an agent
walking a backlog. It moves `c64-memory-mapping` from a skill an agent invokes
to a data source a pipeline stage joins against — which is what the user
predicted.

`memmap.json` is therefore **more** load-bearing after the pivot, not less. It is
already upstream of the enum path (`anno-regbits-gen.ts` pins it by
`memmapSha256`), and it carries what anno structurally does not: anno's built-in
C64 map is 732 labels, **names only, no descriptions**, and its first line reads
`excluded = ["D000-D031","D400-D41D","DC00-DC10","DD00-DD10","FFFA-FFFF"]` — the
entire hardware register file is out of scope for it, and its only built-in enums
are three plain value sets.

## What this does NOT do

It annotates *machine* addresses. It says nothing about what `$1173` does in this
program — that remains a finding a human or agent produces, and remains the
reason an annotation store has to exist at all.

Related: [[dxa-ghidra-pivot]], [[ghidra-volatile-io-and-banking]]
