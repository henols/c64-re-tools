# Control flow: entry point → vectors → IRQ source → main loop → structure

This file is steps 1-5 of the order in depth. Read live values with the `c64-emulator` skill.
Decode vector blocks and `$01` with `c64-memory-map`'s `derive.ts vectors`.

## 1. Entry point

There are three routes. Post-depack is a different question from the other two.

| Situation | Where the entry point is |
|---|---|
| BASIC stub at `$0801` | A tokenized `SYS <addr>` line. The address is plain PETSCII digits in the stub. `c64-basic` reads it. |
| Autostart / non-BASIC | The `.prg` load address (first two bytes), the RESET vector at `$FFFC/$FFFD`, or a cartridge CBM80 signature at `$8000`. |
| **Post-depack** | Wherever the PC is when the decrunch checkpoint fires. |

A depacked image has no BASIC stub to find. Do not spend time on a search for one.

To find the entry point live:

1. Go past any "hit any key" gate. `c64-emulator` tells you which input route the gate reads.
2. Step forward in batches. Read the registers after each batch.
3. Stop when the program counter and the stack pointer both settle into a repeating range across
   three consecutive batches. That range is the dispatch loop. Its lowest address is the entry
   point.
4. Disassemble the address and check it before you record it.

Set a batch ceiling before you start. If the PC does not settle, report that as a finding, with
the number of batches you spent. Never extend the ceiling silently.

## 2. Vectors: sweep every block, and `$01` decides which are live

Six pairs is not "all vectors". `derive.ts vectors` sweeps all six blocks below. It prints the
IRQ/BRK/NMI and hardware blocks by default, and it takes `--all` for the rest.

| Block | Range | Why it matters |
|---|---|---|
| BASIC indirects | `$0300-$030B` | IERROR, IMAIN, ICRNCH, IQPLOP, IGONE, IEVAL. A program that returns to a modified BASIC prompt hooks these |
| KERNAL IRQ/BRK/NMI | `$0314-$0319` | CINV `$EA31`, CBINV `$FE66`, NMINV `$FE47`. The per-frame handler, and the pair that music players retarget |
| KERNAL I/O indirects | `$031A-$0333` | OPEN…SAVE. **A cracker hooks `$0328` STOP and `$0330`/`$0332` LOAD/SAVE** |
| Autostart / cartridge | `$8000` cold, `$8002` warm, `$8004` `CBM80` | The standard trick to survive a reset. Without the signature, the KERNAL ignores both words |
| BASIC ROM entry | `$A000/$A002` | Only meaningful with BASIC banked in. Check `$01` LORAM first |
| Hardware vectors | `$FFFA-$FFFF` | NMI, RESET, IRQ/BRK. Live when the KERNAL is banked out |

**The hardware pairs are only live when `$01` banks the ROMs out.** The deciding bit is HIRAM,
`$01` bit 1. HIRAM = 1 ⇒ the KERNAL ROM is in and `$0314/$0315` is live. HIRAM = 0 ⇒ RAM is at
`$E000-$FFFF` and `$FFFE/$FFFF` is live.

LOAD and STOP get their own callout because both releases of the title studied here use custom
raw-sector loaders that bypass the KERNAL. A diverted `$0330` is a provenance signal. A diverted
`$0328` is anti-tamper.

The second tell is the first instruction of the handler. The KERNAL's register-save preamble
means that the KERNAL path is in use. A jump straight into game code means that it is not.

### A non-default value in a dormant block is not a hook

**A garbage-looking `$0314` is not a bug when HIRAM = 0.** With the KERNAL banked out, nothing
maintains the RAM vectors. They hold whatever was last there, usually the KERNAL's own boot-time
values, partly overwritten. `derive.ts` labels each such block `DORMANT`. It reports the
non-default bytes as *residue*, never as a divert. A hook read into residue is the fastest way to
a confidently-wrong structural claim.

A residue byte that **differs between two releases** is still worth something. But it is a
provenance question, not a structural one. Take it to `c64-provenance`.

### A target in a ROM window is unresolved until you read it twice

A vector target in `$A000-$BFFF`, `$D000-$DFFF` or `$E000-$FFFF` is *either* ROM *or* the RAM
under it. `$01` decides, at the moment the CPU takes the vector. `derive.ts` marks these
`bank-ambiguous` and stops there, because a static image cannot settle it.

Live, it is one extra read. Read the target in the default bank, then read it again from RAM, and
compare (`c64-emulator` shows how to pick the bank).

- The bytes agree with stock ROM ⇒ the vector lands in ROM and the KERNAL path is in use.
- The bytes differ ⇒ **the program has its own code hidden under ROM.** That is a large structural
  finding, and nothing else looks for it.

Record the stock bytes you compared against, so that someone can repeat the check. This check
replaces the weaker "check `$01` and read the handler's preamble" tell, which silently reads
whichever bank is mapped at that moment.

### What the full sweep found on one title

The sweep ran over six committed captures of one title: two releases, three runs each.

| Vector | release-a | release-b | Reading |
|---|---|---|---|
| `$FFFE/$FFFF` IRQ | `$1103` | `$1103` | Known. Matches the handler chain found live |
| `$FFFA/$FFFB` NMI | `$1116` | `$1116` | **New.** The game installs its own NMI handler under KERNAL ROM |
| `$FFFC/$FFFD` RESET | `$1116` | `$1116` | **New.** RESET goes to the *same* address as NMI |
| `$0328/$0329` ISTOP | `$F6FC` | `$F6ED` (stock) | **New, and a divergence.** Residue: the block is dormant |
| `$8004` `CBM80` | absent | absent | Nothing catches a reset through the cartridge route |

Each value is identical across all three runs of its release, so none of it is drift. The values
and the cross-release divergence are mechanical facts.

NMI and RESET that share one entry have the shape of an anti-tamper trap. RESTORE and reset are the
two ways a user disturbs a running game, and both land in the same place. That reading of `$1116`
is not yet tested. The test is to checkpoint `$1116`, perturb the machine, and record where the
PC lands. The reset half is testable: soft and hard resets. The RESTORE half is not testable
through the emulator tools (`c64-emulator` says why).

## 3. IRQ source: two enable masks close the question

- **Raster IRQ**: `$D012` (raster compare), `$D011` bit 7 (raster bit 8), `$D01A` (IRQ enable
  mask), `$D019` (latch, which the handler must acknowledge). **A handler that writes a new
  `$D012` before it exits is a split raster chain.** Each such write is one more IRQ position to
  list.
- **CIA timer IRQ**: `$DC0D` (CIA#1, drives IRQ) and `$DD0D` (CIA#2, drives NMI), with
  `$DC04-$DC07` / `$DD04-$DD07` for the periods.

A game that never touches `$DC0D` runs on a raster IRQ. A game that programs `$DC04-$DC07` and
enables timer A has its own timebase. Read the two enable registers before you read any handler
code.

## 4. Main loop: decide the shape before you search

- **Real main loop**: an unconditional backward branch or `JMP` to a nearby earlier address that
  never returns. A frame-sync wait usually comes before it: a poll of `$D012` for one specific raster
  line, or a spin on a flag that the IRQ handler sets.
- **IRQ does everything**: the main loop is a two-instruction spin, and all logic is in the raster
  IRQ. This shape is common. If you assume the first shape, you waste the search.

**The honest test is live, not static.** The address that repeats exactly once per frame in an
execution trace is the main loop, whatever the listing suggests.

## 5. Four structural features that a linear disassembler gets wrong

- **Jump tables and dispatch**: `JMP ($xxxx)`, and `JSR` into an indexed table. Game state
  machines live here, and a linear decoder mis-decodes exactly this.
- **Self-modifying code**: writes into `$0800-$CFFF` from code that also executes there. It is
  common for animation frame pointers.
- **Zero page**: the game's hot variables. The zero-page addresses with the highest frequency in a
  trace are the state to name first.
- **Code/data separation**: a range that is never hit as an instruction stream across full
  gameplay coverage is data, whatever the tracer guessed. The provenance diff between two cracked
  releases is the second check on the same question.

## Finding the state machine

Most games have one, even when it is not explicit. It has two shapes:

```asm
    LDA GameState        ; indexed dispatch — the common shape, and the one
    ASL                  ; a linear disassembler turns into nonsense
    TAX
    LDA StateTable,X
    STA JumpVector+1
    LDA StateTable+1,X
    STA JumpVector+2
JumpVector:
    JMP $FFFF            ; operand is patched at runtime
```

```asm
    LDA GameState        ; compare chain — easier to read, easier to find
    CMP #STATE_TITLE
    BEQ TitleState
```

The state variable gives a high-level map of the whole program. A practical route:

1. Pause at a title screen and capture memory.
2. Pause again in gameplay and capture memory.
3. Compare the two. Look for a single byte in zero page or low RAM that differs.

`c64-emulator` compares two live ranges. `c64-ram-capture` compares two captures and gives the
volatility rules that stop you from following drift.
