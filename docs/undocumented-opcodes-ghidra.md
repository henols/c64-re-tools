The SLEIGH implementation lives in
[`src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc`](../src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc).
It is the tested source; this page explains its design and how to install it.

The small wrapper language file, `6502_nmos.slaspec`, contains only:

```
@include "6502.slaspec"
@include "6502_undocumented.sinc"
```

The `.sinc` covers **all 105 undocumented opcode bytes**, which together with the 151 documented opcodes gives the complete 256-byte NMOS 6502/6510 opcode space. This matches the C64/6510 opcode matrices.

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
