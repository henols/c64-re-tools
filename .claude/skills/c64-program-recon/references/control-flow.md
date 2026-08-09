# Control flow: entry point → vectors → IRQ source → main loop → structure

Source: `.planning/RE-FINDINGS.md` § Control-flow discovery method (2026-08-01, **MEDIUM**,
doc-derived) except where a line says otherwise. The vector-table step was confirmed against
this project's own captures on 2026-08-04 — see the bottom of this file.

## 1. Entry point — three routes, and post-depack is a different question

| Situation | Where the entry point is |
|---|---|
| BASIC stub at `$0801` | A tokenized `SYS <addr>` line. The address is plain PETSCII digits in the stub, so it reads straight out of the load image with no interpretation. |
| Autostart / non-BASIC | The `.prg` load address (first two bytes), the RESET vector at `$FFFC/$FFFD`, or a cartridge CBM80 signature at `$8000`. |
| **Post-depack — this project's case** | Wherever the PC sits when the decrunch checkpoint fires. A different question with a different answer. |

For a depacked image there is no BASIC stub to find. Do not spend time looking for one.
`c64-ram-capture` § Find an entry point gives the live procedure: step in batches until PC and
SP settle into a repeating range across three consecutive batches.

## 2. Vectors — sweep every block, and `$01` decides which are live

Six pairs is not "all vectors". `node derive.mjs vectors <image.bin>` sweeps all six blocks below;
it prints the IRQ/BRK/NMI and hardware blocks by default and takes `--all` for the rest.

| Block | Range | Why it matters |
|---|---|---|
| BASIC indirects | `$0300-$030B` | IERROR, IMAIN, ICRNCH, IQPLOP, IGONE, IEVAL — a program returning to a modified BASIC prompt hooks these |
| KERNAL IRQ/BRK/NMI | `$0314-$0319` | CINV `$EA31`, CBINV `$FE66`, NMINV `$FE47`. The per-frame handler, and the pair music players retarget |
| KERNAL I/O indirects | `$031A-$0333` | OPEN…SAVE. **`$0328` STOP and `$0330`/`$0332` LOAD/SAVE are where a cracker hooks** |
| Autostart / cartridge | `$8000` cold, `$8002` warm, `$8004` `CBM80` | The standard survive-a-reset trick. Without the signature the KERNAL ignores both words |
| BASIC ROM entry | `$A000/$A002` | Only meaningful with BASIC banked in — check `$01` LORAM first |
| Hardware vectors | `$FFFA-$FFFF` | NMI, RESET, IRQ/BRK. Live when the KERNAL is banked out |

**The hardware pairs are only live when the ROMs are banked out via `$01`.** The deciding bit is
HIRAM, `$01` bit 1 (RE-FINDINGS 2026-08-02). HIRAM = 1 ⇒ KERNAL ROM is in and `$0314/$0315` is
live. HIRAM = 0 ⇒ RAM at `$E000-$FFFF` and `$FFFE/$FFFF` is live.

Why LOAD and STOP earn their own callout on this project: both releases use custom raw-sector
loaders that bypass the KERNAL, so a diverted `$0330` is a provenance signal, and a diverted
`$0328` is anti-tamper. Neither was being looked for before 2026-08-04.

The second tell is the handler's own first instruction: the KERNAL's register-save preamble means
the KERNAL path is in use; a jump straight into game code means it is not.

### A non-default value in a dormant block is not a hook

**A garbage-looking `$0314` is not a bug when HIRAM = 0.** With the KERNAL banked out, nothing
maintains the RAM vectors and they hold whatever was last there — usually the KERNAL's own
boot-time values, partly overwritten. `derive.mjs` labels each such block `DORMANT` and reports
its non-default bytes as *residue*, never as a divert, because reading a hook into residue is the
fastest way to a confidently-wrong structural claim.

A residue byte that **differs between two releases** is still worth something — but it is a
provenance question, not a structural one. Take it to `c64-provenance-diff`.

### A target in a ROM window is unresolved until you read it twice

A vector target in `$A000-$BFFF`, `$D000-$DFFF` or `$E000-$FFFF` is *either* ROM *or* the RAM
underneath, decided by `$01` at the moment the vector is taken. `derive.mjs` marks these
`bank-ambiguous` and stops there, because a static image cannot settle it.

Live, it is one extra call: read the target with `mcp__plugin_c64-re-tools_vice__vice_memory_read`'s default bank,
then again with `bank: "ram"`, and compare (`vice_memory_banks` lists what is available). Agreeing
with stock ROM bytes ⇒ the vector genuinely lands in ROM and the KERNAL path is in use. Differing
⇒ **the program has its own code hidden under ROM**, which is a large structural finding and is
otherwise not looked for at all. Record the stock bytes you compared against, so the check is
reproducible.

This supersedes the weaker "check `$01` and read the handler's preamble" tell, which silently
reads whichever bank happens to be mapped.

### What the widened sweep found here — 2026-08-04

Run over all six committed captures of one title (two releases, runs 1-3 each):

| Vector | release-a | release-b | Reading |
|---|---|---|---|
| `$FFFE/$FFFF` IRQ | `$1103` | `$1103` | Known; matches the live-established handler chain |
| `$FFFA/$FFFB` NMI | `$1116` | `$1116` | **New.** The game installs its own NMI handler under KERNAL ROM |
| `$FFFC/$FFFD` RESET | `$1116` | `$1116` | **New.** RESET funnels to the *same* address as NMI |
| `$0328/$0329` ISTOP | `$F6FC` | `$F6ED` (stock) | **New, and a divergence.** Residue — the block is dormant |
| `$8004` `CBM80` | absent | absent | Nothing catches a reset via the cartridge route |

NMI and RESET sharing one entry is the shape of an anti-tamper trap: RESTORE and reset are the two
ways a user perturbs a running game, and both land in the same place. `$1116` is therefore the
address to checkpoint when the emulator is next available — press RESTORE with
`mcp__plugin_c64-re-tools_vice__vice_keyboard_restore` (it is *not* in the keyboard matrix, and NMI will not retrigger
until the line is released, so it is a press→release **edge**), then `vice_machine_reset` soft and
hard, and record where the PC actually lands.

**Evidence:** derived mechanically from six three-run-verified captures; every value identical
across all three runs of its release, so none of it is drift.
**Confidence:** HIGH for the values and for the cross-release divergence. The *interpretation* of
`$1116` as anti-tamper is **LOW** — unexercised, and the perturbation experiment above is exactly
what would settle it.

## 3. IRQ source — two enable masks close the question

- **Raster IRQ** — `$D012` (raster compare), `$D011` bit 7 (raster bit 8), `$D01A` (IRQ enable
  mask), `$D019` (latch, which the handler must acknowledge). **A handler that writes a new
  `$D012` on its way out is a split raster chain**, and each such write is one more IRQ position
  to enumerate.
- **CIA timer IRQ** — `$DC0D` (CIA#1, drives IRQ) and `$DD0D` (CIA#2, drives NMI), with
  `$DC04-$DC07` / `$DD04-$DD07` for the periods.

A game that never touches `$DC0D` is on a raster IRQ. One that programs `$DC04-$DC07` and enables
timer A has its own timebase. Read the two enable registers before reading any handler code.

## 4. Main loop — decide the shape before hunting

- **Real main loop** — an unconditional backward branch or `JMP` to a nearby earlier address that
  never returns, usually preceded by a frame-sync wait: polling `$D012` for a fixed raster line, or
  spinning on a flag the IRQ handler sets.
- **IRQ-does-everything** — the main loop is a two-instruction spin and all logic hangs off the
  raster IRQ. Common enough that assuming the first shape wastes the search.

**The honest test is live, not static.** The address that repeats exactly once per frame in an
execution trace is the main loop, whatever the listing suggests.

## 5. Four structural features a linear disassembler gets wrong

- **Jump tables and dispatch** — `JMP ($xxxx)` and `JSR` into an indexed table. This is where game
  state machines live, and exactly what a linear decoder mis-decodes.
- **Self-modifying code** — writes into `$0800-$CFFF` from code that also executes there. Common
  for animation frame pointers.
- **Zero page** — the game's hot variables. The highest-frequency ZP addresses in a trace are the
  state worth naming first.
- **Code/data separation** — the project's standing rule (`.claude/CLAUDE.md` § Stack Patterns): a
  range never hit as an instruction stream across full gameplay coverage is data, regardless of
  what the tracer guessed. The provenance diff between the two cracked releases is the second check
  on the same question.

## Finding the state machine

Most games have one even when it is not explicit. Two shapes:

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

Finding the state variable gives a high-level map of the whole program. A practical route: pause
at a title screen and again in gameplay, diff the two captures, and look for a single byte that
changed in zero page or low RAM. `vice_memory_compare` narrows this; `c64-ram-capture` § Compare
two captures gives the volatility rules that stop you chasing drift.

## Verified against this project — 2026-08-04

Running `derive.mjs vectors` cold on both releases' `*-gameentry-run1.bin` returns `$01` = `$40`
(LORAM 0, HIRAM 0, CHAREN 0 — KERNAL and BASIC banked out), so the live pair is `$FFFE/$FFFF`,
holding **`$1103`**, while `$0314/$0315` holds `$0101` — nothing meaningful, exactly as the
dormant-block rule predicts.

`$1103` is the same IRQ-handler entry that phase-01 live work independently established, with the
raster-split chain `$1103 → $1574 → $152C` (RE-FINDINGS 2026-08-02, checkpoint-trap entry). The
method reproduces a known-good result from a static image with no emulator running. The widened
sweep's own results, including two facts this table never surfaced, are in §2 above.

**Evidence:** derived mechanically from three-run-verified captures, cross-checked against a live
finding recorded independently.
**Confidence:** HIGH for the vector-table step, the HIRAM rule, and the dormant-block rule. The
remaining steps in this file stay MEDIUM until exercised the same way.
