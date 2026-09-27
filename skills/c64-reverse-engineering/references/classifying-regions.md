# Classifying regions: reading, recognising and reporting

This file is the depth behind "Classifying every region" in `SKILL.md`. The proof bar and the
pass order are there. Every read and write here goes through the `c64-annotations` skill.

## Scope, and reading a region

1. Read the binary info first. Keep `origin`, `size`, `system`, `filename`, `description` and
   `may_contain_undocumented_opcodes`.
   - `system` names the target machine. On a C64, look up every address that a region touches
     with `c64-memory-map` before you guess at it.
   - `filename` and `description` are the software context. A known title, a known music driver
     or a known packer changes what a region is likely to be.
   - `may_contain_undocumented_opcodes: true` means that illegal opcodes (`LAX`, `SAX`, `SLO`,
     `DCP`, `ISC`) can occur. **Do not classify them as data.** They are valid instructions. The
     flag is a human's hint, not a guarantee. Some programs use them with the flag false.
2. List the blocks that are already classified, and work on the Undefined ones.
3. Read each candidate region twice: once as a hexdump for the byte patterns, and once as
   disassembly for how it would decode. One region read is size-capped, so walk a large binary in
   consecutive ranges. Chunks of **256–512 bytes** are the practical size for classification. A
   larger hexdump is more than you can read carefully in one pass.

## Recording the classification

- **Code**: disassemble from the entry-point address to read it. Then record as code only the
  range you followed, to its `RTS`/`RTI`/`JMP`. Later cross-reference and search reads decode
  instructions out of the code-typed ranges, so a range that is too wide pollutes them.
- **Data**: record many ranges in one batch. A real classification pass is dozens of ranges.
- **A wrong classification does not need an undo.** Record the correct type again over the same
  range, and the previous type is gone.
- **Read the disclosures that come back from a retype.** They are not errors. They name the
  comments whose confidence now contradicts the new type, and the split tables that the retype
  broke into fragments.
- A split table needs an even byte count. The low half and the high half must be the same length.
- List the blocks again after each batch, to check what actually landed.

## The kinds of region

| Kind | When |
|---|---|
| **Code** | Provably-executed instructions. Read the extent first, then record exactly what you checked |
| Byte | Raw 8-bit data: sprites, bitmaps, charsets, lookup tables, variables, unknowns |
| Word | 16-bit little-endian values: 16-bit variables, math constants, SID frequencies |
| Address | 16-bit little-endian pointers: jump tables, vector lists. Creates cross-references |
| PETSCII text | PETSCII strings: messages, prompts, anything that goes to `$FFD2` |
| Screencode text | Text that goes straight to screen RAM (`$0400`–`$07E7`) |
| Lo/Hi address | Split address table, low bytes first. Even byte count |
| Hi/Lo address | Split address table, high bytes first. Even byte count |
| Lo/Hi word | Split word table, low half first. For example, a SID frequency table |
| Hi/Lo word | Split word table, high half first |
| External file | Large blobs to export as they are: SID tunes, bitmaps, charsets |
| Undefined | Unknown. The honest answer for a region you cannot place |

`c64-annotations` gives the data-type name for each kind.

## Recognising each kind

**Byte data**: regular patterns that form no valid instruction sequence. Table lookups
(`LDA addr,X` / `LDA addr,Y`) address it. Sprite data comes in 63-byte units (padded to 64),
usually grouped. Bitmap data comes in 8-byte character cells. Colour data stays in `$00`–`$0F`. Or
it is random-looking bytes between two code blocks, and their disassembly is nonsense.

**Word data**: byte pairs that form meaningful 16-bit values (screen addresses, timer values).
Adjacent `LDA addr` / `LDA addr+1` loads read the low byte, then the high byte.

**Address tables**: byte pairs that read as little-endian addresses *inside* the binary. `JMP
($addr)` or indexed indirect reads reach them. Jump tables, dispatch tables and vector lists all
live here.

**Split lo/hi (or hi/lo) tables**: two equal halves, one of plausible low bytes and one of
plausible high bytes. Code references each half separately:
`LDA lo,X / STA ptr / LDA hi,X / STA ptr+1 / JMP (ptr)`. Recombine the halves and check that the
addresses are real. Lo/Hi (low half first) is the more common form on the 6502. **The total byte
count must be even and the halves equal.** An odd count means that the boundary is in the wrong
place. The classic case:

```asm
AddressLo:  !byte <Room0, <Room1, <Room2
AddressHi:  !byte >Room0, >Room1, >Room2
```

A disassembler that does not recognise the pair shows meaningless instructions.

**PETSCII text**: bytes in `$20`–`$7E` (unshifted) or `$C0`–`$DF` (shifted). It is often
recognisable English, because PETSCII shares `$20`–`$5F` with ASCII. A `$00`, a `$0D` or a
high-bit sentinel ends it. `$FFD2` (CHROUT) or `$AB1E` (BASIC STROUT) prints it. `GAME OVER`,
`PRESS FIRE`, menus, credits.

**Screencode text**: bytes in `$00`–`$3F`, where `$00` is `@` and `$01` is `A`. The program
copies it directly to `$0400`–`$07E7`. `LDA data,X / STA $0400,X` gives it away. A full screen
dump is exactly 1000 bytes.

**External file**: a large contiguous non-code block that matches a known format. A `PSID`/`RSID`
header, a 2048-byte charset (256 chars × 8 bytes), sprite data in multiples of 64, or a bitmap.
Export it. Do not annotate it.

**PETSCII is not screencode.** If the program copies the text to `$0400`, it is screencode. If
the program gives it to CHROUT, it is PETSCII. If you get this backwards, the text shows as
garbage in exactly one of the two places.

Other data tells: indexed loads reference it, repeated byte patterns, valid PETSCII or screen
codes, sprite-sized 64-byte blocks, values that match VIC-II coordinates. Code tells: `JSR`,
`JMP`, branches or vectors reach it, it **executes during tracing**, and its control flow is
plausible.

## Two adjacent tables of the same kind

Record two adjacent tables of the same kind as two ranges, not as one range that spans both. The
annotation project keeps them as two rows, and the block list then tells them apart.

Also record the boundary in the annotations. Put a label at the start of the second table and a
line comment on both, with the extent you found. A name and an evidence line survive a later
retype. A row boundary does not.

## Labelling, and the report

Name what you classified: entry points, tables and strings. Comment it, with a line comment above
and side comments beside. Use "Naming a symbol" in `SKILL.md` for the conventions, and "Documenting
one routine" for the comment block on a subroutine.

Then report:

- The total number of blocks, by kind.
- Notable findings: "three PETSCII strings", "a lo/hi jump table at `$1200`".
- **Every region that is still uncertain or still Undefined, by address.** This part makes the pass
  reusable. A classification report with no uncertain regions on a real game is almost always a
  report that stopped looking.
- The project revision at the end of the pass. It pins the report to an exact project state,
  not to "after the pass". `c64-annotations` shows how to read it.

## What goes wrong

| Symptom | What it actually is |
|---|---|
| A region disassembles beautifully but has no incoming reference | Data. Decodability is not evidence. Leave it Undefined. |
| Disassembly full of impossible branches or floods of `BRK` (`$00`) | Data misread as code. |
| Odd-looking instructions, but real `JSR`/`JMP` cross-references land here | Probably code that uses undocumented opcodes. Check the `may_contain_undocumented_opcodes` hint. |
| A split table's addresses recombine to nonsense | The half boundary is in the wrong place, or the table is hi/lo, not lo/hi. |
| Two tables you classified separately show up as one block | You recorded them with one spanning range. Record them as two. |
| Text shows as garbage on screen but prints correctly through CHROUT | It is PETSCII typed as screencode, or the reverse. |
