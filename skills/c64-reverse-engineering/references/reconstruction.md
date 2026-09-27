# Rebuilding the program as source

Do not wait until you understand everything. Stand up a buildable tree early. Include the
unidentified bulk as binary, and replace regions with real source as you prove them. The tree
stays assemblable at every commit, so a regression has a small blast radius.

`c64-assembler` assembles the tree. This file covers the shape of the source and what makes a
reconstruction right.

## Start with binary inclusion

```asm
* = $4000
!binary "unknown_4000_5fff.bin"
```

Then replace it piece by piece, and keep every address the same:

```asm
* = $4200

UpdatePlayer:
    ; reconstructed code
```

A layout that keeps this workable:

```
src/
  main.a          zeropage.a      irq.a
  input.a         player.a        enemies.a
  collision.a     graphics.a      music.a
  data/
    sprites.a     levels.a        text.a
```

## Behavioural equivalence is the definition of correct

**Correct means scripted replay plus comparison at checkpoints, and nothing else.** A
reconstruction is right when you drive it through the checkpoint set and it shows the same
observable behaviour as the original. **Anything that no checkpoint can observe is not verified.**
That is why checkpoint design is part of the reconstruction work, not something to add afterwards.

**That bar gives you the freedom to rename routines, reorganise files, replace constants with
symbols and add macros.** **But** a reorganisation moves addresses, and that breaks self-modifying
code and timing-sensitive raster routines. Replay through the checkpoint set after EACH
reorganisation, not at the end of several. One moved address per failing replay is a short
diagnosis. Ten is a bisect.

A full 64K RAM capture is not a comparison surface. RAM that nothing writes drifts continuously,
so full-64K identity is impossible in principle. Compare captures with `c64-ram-capture`, which
gives the drift rules.

## Self-modifying code needs explicit labels

A static disassembler sees `LDA $FFFF,X` and cannot know that the program writes the operand at
runtime:

```asm
    LDA SourceAddress
    STA CopyLoop+1
    LDA SourceAddress+1
    STA CopyLoop+2
CopyLoop:
    LDA $FFFF,X
    STA $0400,X
```

Name the patched location, so the intent survives:

```asm
CopySource = CopyLoop + 1
```

Look for writes to the byte after an opcode, the two bytes after a `JMP`/`JSR`, branch operands
and immediate constants: `STA Routine+1`, `STX Routine+2`, `INC Routine+1`.

## Names come from the annotation project

Name symbols with the method in "Naming a symbol" in `SKILL.md`, and use the same names in the
source. Record the evidence next to the thing:

```asm
; Confirmed: decremented once per frame while the player is invulnerable.
; Evidence: live watch on $D015 during damage.
player_invulnerability_timer:
    !byte 0
```

Split lo/hi address tables and other data that a linear disassembler destroys are in
[classifying-regions.md](classifying-regions.md).

## Names between the source, the project and the emulator

- **The annotation project is the merge point, not your own notes.** When you find a name live (in
  a disassembly of the running machine, or at a checkpoint), write it into the project first,
  before you take it anywhere else.
- **Regenerate a label file whole. Never patch it one name at a time.** An incremental hand patch
  brings back exactly the drift that one merge point prevents.
- `c64-assembler` writes a VICE label file on every build. Load it into the emulator with
  `c64-emulator` after each build, and your checkpoints show real names.
