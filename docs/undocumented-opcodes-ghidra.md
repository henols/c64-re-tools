Here is the complete implementation:

```
# NMOS 6502 / 6510 undocumented opcodes for Ghidra SLEIGH
#
# Intended use:
#
#   6502_nmos.slaspec:
#       @include "6502.slaspec"
#       @include "6502_undocumented.sinc"
#
# Do NOT include this file directly from 6502.slaspec, because
# 65c02.slaspec includes 6502.slaspec and reuses many of these opcode
# bytes for documented 65C02 instructions.
#
# Mnemonic convention:
#   JAM (aka KIL)
#   SLO, RLA, SRE, RRA
#   SAX, LAX, DCP, ISC
#   ANC, ALR, ARR, AXS
#   XAA, AHX, TAS, SHY, SHX, LAS
#
# Coverage:
#   All 105 opcode bytes not defined by the documented NMOS 6502 ISA.
#
# Accuracy notes:
# - The deterministic undocumented instructions have explicit p-code.
# - XAA ($8b) and immediate LAX/LXA ($ab) are electrically unstable on
#   real NMOS parts, so they use black-box userops.
# - AHX/TAS/SHX/SHY have unusual bus/address behavior on page crossing.
#   This file keeps the nominal effective address for useful static
#   references and uses black-box userops for the stored value.
# - ARR is modeled accurately for binary mode. Its unusual decimal-mode
#   behavior is not modeled here.
# - RRA/ISC/$EB SBC use binary arithmetic semantics. This is consistent
#   with the current Ghidra 6502 model, which does not model NMOS decimal
#   ADC/SBC behavior either.
#
# ---------------------------------------------------------------------
# Black-box p-code operations for electrically unstable instructions.
# These deliberately preserve data-flow inputs while avoiding a false
# claim of deterministic transistor-level behavior.
# ---------------------------------------------------------------------

define pcodeop unstableXAA;
define pcodeop unstableLAXImmediate;
define pcodeop unstableAHXStore;
define pcodeop unstableTASStore;
define pcodeop unstableSHXStore;
define pcodeop unstableSHYStore;

# ---------------------------------------------------------------------
# Undocumented read/modify/write operand table.
#
# The bbb field is already defined by 6502.slaspec.  This table mirrors
# the useful OP1 addressing modes but implements zero-page pointer wrap
# explicitly for the indirect modes.
# ---------------------------------------------------------------------

# (zp,X)
UOP: (imm8,X) is bbb=0 & X; imm8
{
    local zp:1 = imm8 + X;
    local loaddr:2 = zext(zp);
    local hiptr:1 = zp + 1;
    local hiaddr:2 = zext(hiptr);
    local lo:1 = *:1 loaddr;
    local hi:1 = *:1 hiaddr;
    local lo16:2 = zext(lo);
    local hi16:2 = zext(hi);
    local addr:2 = lo16 | (hi16 << 8);
    export *:1 addr;
}

# zp
UOP: imm8 is bbb=1; imm8
{
    local addr:2 = imm8;
    export *:1 addr;
}

# abs
UOP: imm16 is bbb=3; imm16
{
    export *:1 imm16;
}

# (zp),Y
UOP: (imm8),Y is bbb=4 & Y; imm8
{
    local zp:1 = imm8;
    local loaddr:2 = zext(zp);
    local hiptr:1 = zp + 1;
    local hiaddr:2 = zext(hiptr);
    local lo:1 = *:1 loaddr;
    local hi:1 = *:1 hiaddr;
    local lo16:2 = zext(lo);
    local hi16:2 = zext(hi);
    local base:2 = lo16 | (hi16 << 8);
    local addr:2 = base + zext(Y);
    export *:1 addr;
}

# zp,X
UOP: imm8,X is bbb=5 & X; imm8
{
    local zp:1 = imm8 + X;
    local addr:2 = zext(zp);
    export *:1 addr;
}

# abs,Y
UOP: imm16,Y is bbb=6 & Y; imm16
{
    local addr:2 = imm16 + zext(Y);
    export *:1 addr;
}

# abs,X
UOP: imm16,X is bbb=7 & X; imm16
{
    local addr:2 = imm16 + zext(X);
    export *:1 addr;
}

# ---------------------------------------------------------------------
# Arithmetic helpers used by RRA / ISC / undocumented SBC.
#
# These implement binary arithmetic explicitly and correctly account for
# carry-in/borrow-in. Decimal-mode behavior is intentionally outside the
# scope of this include.
# ---------------------------------------------------------------------

macro undocADC(value) {
    local oldA:1 = A;
    local oldC:1 = C;

    local wideA:2 = zext(oldA);
    local wideValue:2 = zext(value);
    local wideCarry:2 = zext(oldC);
    local wideResult:2 = wideA + wideValue + wideCarry;
    local result:1 = wideResult:1;

    C = (wideResult & 0x100) != 0;
    V = ((~(oldA ^ value) & (oldA ^ result) & 0x80) != 0);

    A = result;
    resultFlags(A);
}

macro undocSBC(value) {
    local oldA:1 = A;
    local borrow:1 = !C;

    local wideA:2 = zext(oldA);
    local wideValue:2 = zext(value);
    local wideBorrow:2 = zext(borrow);
    local wideSub:2 = wideValue + wideBorrow;
    local wideResult:2 = wideA - wideSub;
    local result:1 = wideResult:1;

    C = (wideA >= wideSub);
    V = (((oldA ^ result) & (oldA ^ value) & 0x80) != 0);

    A = result;
    resultFlags(A);
}

# =====================================================================
# JAM / KIL
# =====================================================================

:JAM is
    op=0x02 | op=0x12 | op=0x22 | op=0x32 |
    op=0x42 | op=0x52 | op=0x62 | op=0x72 |
    op=0x92 | op=0xb2 | op=0xd2 | op=0xf2
{
    # NMOS CPU locks until reset.  A self-branch is a useful static
    # approximation because it prevents false fall-through analysis.
    goto inst_start;
}

# =====================================================================
# Undocumented NOPs
# =====================================================================

# Implied, one byte
:NOP is
    op=0x1a | op=0x3a | op=0x5a |
    op=0x7a | op=0xda | op=0xfa
{
}

# Immediate, two bytes
:NOP "#"imm8 is
    (op=0x80 | op=0x82 | op=0x89 | op=0xc2 | op=0xe2); imm8
{
    local ignored:1 = imm8;
}

# Zero page, two bytes.  The real CPU performs the memory read.
:NOP imm8 is
    (op=0x04 | op=0x44 | op=0x64); imm8
{
    local addr:2 = imm8;
    local ignored:1 = *:1 addr;
}

# Zero page,X, two bytes
:NOP imm8,X is
    (op=0x14 | op=0x34 | op=0x54 |
     op=0x74 | op=0xd4 | op=0xf4) & X; imm8
{
    local zp:1 = imm8 + X;
    local addr:2 = zext(zp);
    local ignored:1 = *:1 addr;
}

# Absolute, three bytes
:NOP imm16 is op=0x0c; imm16
{
    local ignored:1 = *:1 imm16;
}

# Absolute,X, three bytes
:NOP imm16,X is
    (op=0x1c | op=0x3c | op=0x5c |
     op=0x7c | op=0xdc | op=0xfc) & X; imm16
{
    local addr:2 = imm16 + zext(X);
    local ignored:1 = *:1 addr;
}

# =====================================================================
# SLO = ASL memory, then ORA
# =====================================================================

:SLO UOP is
    (op=0x03 | op=0x07 | op=0x0f |
     op=0x13 | op=0x17 | op=0x1b | op=0x1f) ... & UOP
{
    local value:1 = UOP;

    C = (value & 0x80) != 0;
    value = value << 1;
    UOP = value;

    A = A | value;
    resultFlags(A);
}

# =====================================================================
# RLA = ROL memory, then AND
# =====================================================================

:RLA UOP is
    (op=0x23 | op=0x27 | op=0x2f |
     op=0x33 | op=0x37 | op=0x3b | op=0x3f) ... & UOP
{
    local value:1 = UOP;
    local oldC:1 = C;

    C = (value & 0x80) != 0;
    value = (value << 1) | oldC;
    UOP = value;

    A = A & value;
    resultFlags(A);
}

# =====================================================================
# SRE = LSR memory, then EOR
# =====================================================================

:SRE UOP is
    (op=0x43 | op=0x47 | op=0x4f |
     op=0x53 | op=0x57 | op=0x5b | op=0x5f) ... & UOP
{
    local value:1 = UOP;

    C = (value & 1) != 0;
    value = value >> 1;
    UOP = value;

    A = A ^ value;
    resultFlags(A);
}

# =====================================================================
# RRA = ROR memory, then ADC
# =====================================================================

:RRA UOP is
    (op=0x63 | op=0x67 | op=0x6f |
     op=0x73 | op=0x77 | op=0x7b | op=0x7f) ... & UOP
{
    local value:1 = UOP;
    local oldC:1 = C;

    C = (value & 1) != 0;
    value = (value >> 1) | (oldC << 7);
    UOP = value;

    # The carry produced by ROR is the ADC carry-in.
    undocADC(value);
}

# =====================================================================
# DCP = DEC memory, then CMP
# =====================================================================

:DCP UOP is
    (op=0xc3 | op=0xc7 | op=0xcf |
     op=0xd3 | op=0xd7 | op=0xdb | op=0xdf) ... & UOP
{
    local value:1 = UOP - 1;
    UOP = value;

    local result:1 = A - value;
    resultFlags(result);
    C = (A >= value);
}

# =====================================================================
# ISC / ISB = INC memory, then SBC
# =====================================================================

:ISC UOP is
    (op=0xe3 | op=0xe7 | op=0xef |
     op=0xf3 | op=0xf7 | op=0xfb | op=0xff) ... & UOP
{
    local value:1 = UOP + 1;
    UOP = value;

    undocSBC(value);
}

# =====================================================================
# SAX = store A & X
# =====================================================================

# (zp,X), zp, abs
:SAX UOP is (op=0x83 | op=0x87 | op=0x8f) ... & UOP
{
    UOP = A & X;
}

# zp,Y
:SAX imm8,Y is op=0x97 & Y; imm8
{
    local zp:1 = imm8 + Y;
    local addr:2 = zext(zp);
    *:1 addr = A & X;
}

# =====================================================================
# LAX = load A and X simultaneously
# =====================================================================

# (zp,X), zp, abs, (zp),Y
:LAX UOP is (op=0xa3 | op=0xa7 | op=0xaf | op=0xb3) ... & UOP
{
    local value:1 = UOP;
    A = value;
    X = value;
    resultFlags(value);
}

# zp,Y
:LAX imm8,Y is op=0xb7 & Y; imm8
{
    local zp:1 = imm8 + Y;
    local addr:2 = zext(zp);
    local value:1 = *:1 addr;

    A = value;
    X = value;
    resultFlags(value);
}

# abs,Y
:LAX imm16,Y is op=0xbf & Y; imm16
{
    local addr:2 = imm16 + zext(Y);
    local value:1 = *:1 addr;

    A = value;
    X = value;
    resultFlags(value);
}

# Immediate LAX/LXA ($AB) is electrically unstable on real NMOS parts.
:LAX "#"imm8 is op=0xab; imm8
{
    local value:1 = unstableLAXImmediate(A, imm8);
    A = value;
    X = value;
    resultFlags(value);
}

# =====================================================================
# Immediate combination instructions
# =====================================================================

# ANC = AND immediate, then C = N
:ANC "#"imm8 is (op=0x0b | op=0x2b); imm8
{
    A = A & imm8;
    resultFlags(A);
    C = (A & 0x80) != 0;
}

# ALR / ASR = AND immediate, then LSR A
:ALR "#"imm8 is op=0x4b; imm8
{
    local value:1 = A & imm8;

    C = (value & 1) != 0;
    A = value >> 1;

    Z = (A == 0);
    N = 0;
}

# ARR = AND immediate, then ROR with unusual C/V flag behavior.
# This constructor models binary mode. NMOS decimal ARR is stranger.
:ARR "#"imm8 is op=0x6b; imm8
{
    local oldC:1 = C;
    local value:1 = A & imm8;

    A = (value >> 1) | (oldC << 7);

    resultFlags(A);
    C = (A & 0x40) != 0;
    V = (((A >> 6) ^ (A >> 5)) & 1) != 0;
}

# AXS / SBX = X <- (A & X) - immediate
# Carry-in and decimal mode are ignored; V is unchanged.
:AXS "#"imm8 is op=0xcb; imm8
{
    local ax:1 = A & X;
    local result:1 = ax - imm8;

    C = (ax >= imm8);
    X = result;
    resultFlags(X);
}

# Alternate immediate SBC opcode.
:SBC "#"imm8 is op=0xeb; imm8
{
    undocSBC(imm8);
}

# =====================================================================
# XAA / ANE -- electrically unstable
# =====================================================================

:XAA "#"imm8 is op=0x8b; imm8
{
    # Real 6510 behavior depends on analog/bus state and can vary between
    # chip/video revisions. Keep it explicitly opaque to the decompiler.
    A = unstableXAA(A, X, imm8);
    resultFlags(A);
}

# =====================================================================
# AHX / SHA -- unstable indexed stores
#
# The nominal effective address is retained so Ghidra still gets useful
# memory references. The stored byte is a black-box function because the
# high-address-byte interaction and page-crossing behavior are unusual.
# =====================================================================

# AHX (zp),Y
:AHX (imm8),Y is op=0x93 & Y; imm8
{
    local zp:1 = imm8;
    local loaddr:2 = zext(zp);
    local hiptr:1 = zp + 1;
    local hiaddr:2 = zext(hiptr);
    local lo:1 = *:1 loaddr;
    local hi:1 = *:1 hiaddr;
    local lo16:2 = zext(lo);
    local hi16:2 = zext(hi);
    local base:2 = lo16 | (hi16 << 8);
    local addr:2 = base + zext(Y);

    local value:1 = unstableAHXStore(A, X, base, Y);
    *:1 addr = value;
}

# AHX abs,Y
:AHX imm16,Y is op=0x9f & Y; imm16
{
    local addr:2 = imm16 + zext(Y);
    local value:1 = unstableAHXStore(A, X, imm16, Y);
    *:1 addr = value;
}

# =====================================================================
# TAS / SHS
# =====================================================================

:TAS imm16,Y is op=0x9b & Y; imm16
{
    # S <- A & X is the deterministic part of TAS.
    S = A & X;

    local addr:2 = imm16 + zext(Y);
    local value:1 = unstableTASStore(S, imm16, Y);
    *:1 addr = value;
}

# =====================================================================
# SHY / SHX
# =====================================================================

:SHY imm16,X is op=0x9c & X; imm16
{
    local addr:2 = imm16 + zext(X);
    local value:1 = unstableSHYStore(Y, imm16, X);
    *:1 addr = value;
}

:SHX imm16,Y is op=0x9e & Y; imm16
{
    local addr:2 = imm16 + zext(Y);
    local value:1 = unstableSHXStore(X, imm16, Y);
    *:1 addr = value;
}

# =====================================================================
# LAS / LAR
# =====================================================================

:LAS imm16,Y is op=0xbb & Y; imm16
{
    local addr:2 = imm16 + zext(Y);
    local value:1 = *:1 addr;
    value = value & S;

    A = value;
    X = value;
    S = value;

    resultFlags(value);
}
```
And the small wrapper language file:

```
@include "6502.slaspec"
@include "6502_undocumented.sinc"
```
I verified that the `.sinc` explicitly covers **all 105 undocumented opcode bytes**, which together with the 151 documented opcodes gives the complete 256-byte NMOS 6502/6510 opcode space. This matches the C64/6510 opcode matrices.

### How to install it

Put both files in:

```text
Ghidra/Processors/6502/data/languages/

6502.slaspec
6502.pspec
6502.cspec
6502.ldefs
65c02.slaspec

6502_nmos.slaspec            <- new
6502_undocumented.sinc       <- new
```

`6502_nmos.slaspec` deliberately contains only:

```text
@include "6502.slaspec"
@include "6502_undocumented.sinc"
```

This separation is important because Ghidra's current `65c02.slaspec` itself includes `6502.slaspec`. If we put undocumented NMOS opcodes directly into the base file, bytes such as `$80`, `$89`, `$9C`, `$9E`, etc. would collide with real 65C02 instructions. 

### Add the new processor variant

Edit:

```text
Ghidra/Processors/6502/data/languages/6502.ldefs
```

The current file defines `6502:LE:16:default` and `65C02:LE:16:default`. 

Add this before `</language_definitions>`:

```xml
<language processor="6502"
          endian="little"
          size="16"
          variant="nmos"
          version="1.0"
          slafile="6502_nmos.sla"
          processorspec="6502.pspec"
          manualindexfile="../manuals/6502.idx"
          id="6502:LE:16:nmos">
    <description>NMOS 6502/6510 with undocumented opcodes</description>
    <compiler name="default" spec="6502.cspec" id="default"/>
</language>
```

You will then have:

```text
6502:LE:16:default
    documented NMOS 6502

6502:LE:16:nmos
    documented + undocumented NMOS 6502/6510

65C02:LE:16:default
    65C02
```

This is much safer than changing the normal 6502 definition.

Ghidra recompiles modified SLEIGH `.slaspec`/`.sinc` sources into `.sla` when the processor is next used; restarting Ghidra may be necessary.

For headless C64 analysis you can consequently use:

```bash
analyzeHeadless ./ghidra-project C64 \
    -import game.bin \
    -processor 6502:LE:16:nmos
```

Ghidra's headless analyzer supports selecting the exact language ID this way.

### What's implemented

The file contains all the important deterministic families:

```text
SLO   03 07 0F 13 17 1B 1F
RLA   23 27 2F 33 37 3B 3F
SRE   43 47 4F 53 57 5B 5F
RRA   63 67 6F 73 77 7B 7F

SAX   83 87 8F 97
LAX   A3 A7 AF B3 B7 BF

DCP   C3 C7 CF D3 D7 DB DF
ISC   E3 E7 EF F3 F7 FB FF

ANC   0B 2B
ALR   4B
ARR   6B
AXS   CB
SBC   EB

LAS   BB
```

Plus all **27 undocumented NOP bytes** and all **12 JAM/KIL bytes**.

The RMW instructions have actual p-code semantics. For example `SLO` isn't merely recognized as an instruction; Ghidra sees the equivalent of:

```text
memory <<= 1
A |= memory
C = shifted-out-bit
N/Z = result
```

So data-flow analysis and the decompiler can reason through it.

### The unstable instructions are handled differently

These deserve special treatment:

```text
$8B XAA / ANE
$AB LAX / LXA immediate

$93 AHX (zp),Y
$9F AHX abs,Y
$9B TAS abs,Y
$9C SHY abs,X
$9E SHX abs,Y
```

On actual 6510s, some depend on analog bus behavior, chip revision, VIC-II activity, and/or unusual high-address-byte behavior. VICE's old 6510 documentation specifically describes `$8B` as potentially depending on values left on the bus, and the indexed store instructions can modify the effective high address when a page boundary is crossed.

Rather than invent deterministic behavior, I defined SLEIGH userops:

```text
unstableXAA
unstableLAXImmediate
unstableAHXStore
unstableTASStore
unstableSHXStore
unstableSHYStore
```

For example:

```text
A = unstableXAA(A, X, imm8);
```

This is deliberate. Ghidra's p-code supports user-defined operations specifically as black boxes for operations whose exact semantics are too esoteric or incompletely modeled; data dependencies are still visible to analysis.

Thus the decompiler won't incorrectly simplify:

```asm
XAA #$37
```

into some supposedly exact C expression when real C64 hardware doesn't guarantee one.

### JAM is also modeled

For:

```text
02 12 22 32 42 52 62 72
92 B2 D2 F2
```

the generated p-code is:

```text
goto inst_start;
```

That represents the CPU as stuck at that instruction and, importantly for reverse engineering, prevents Ghidra from treating the following bytes as a normal fall-through execution path. SLEIGH supports `inst_start` as the address of the current instruction.

### One limitation remains: decimal mode

There is one area I deliberately did **not** pretend to solve in this file.

Ghidra's current base 6502 implementation doesn't properly model NMOS decimal arithmetic for normal `ADC`/`SBC`; its existing definitions manipulate `D`, but the `ADC` and `SBC` implementations don't branch on it. You can see this directly in the current processor source. 

Therefore the undocumented:

```text
RRA
ISC
$EB SBC
```

are currently modeled with accurate **binary-mode** arithmetic.

`ARR $6B` is also accurate in binary mode, including its strange:

```text
C = result bit 6
V = result bit 6 XOR result bit 5
```

behavior. The actual NMOS decimal-mode `ARR` is considerably stranger; VICE's 6510 documentation describes the separate BCD fixups.

For C64 reverse engineering this is already far preferable to unknown instructions, but I think our **next change should be to fix Ghidra's base 6502 ADC/SBC decimal-mode p-code as well**. Then `RRA`, `ISC`, and `ARR` can be made fully NMOS-6510-correct rather than merely binary-mode correct.

One caveat: I validated the opcode coverage and wrote this against the current Ghidra SLEIGH definitions, but I don't have Ghidra's SLEIGH compiler installed in this execution environment, so I have not yet run an actual `.sla` compilation of this file. The next useful step would be to build a **256-opcode automated Ghidra test** that checks mnemonic, instruction length, addressing mode, and p-code for every byte. That will give us a regression test for the 6510 support rather than relying on visual testing.
