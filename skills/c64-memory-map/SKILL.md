---
name: c64-memory-map
description: Look up what a C64 address, KERNAL routine or register bit means. Annotate 6502 disassembly against the C64 memory map, and decode register values into concrete addresses. Use when asked to look up an address like $D020, $EA24 or $FFD2. Use when asked to annotate or comment assembly against the published memory map, or to document a disassembly listing by resolving every address it touches. Use when asked to find the VIC bank, screen RAM, charset or bitmap address from $DD00/$D018/$D011/$D016. Also use when asked where sprite data lives from the sprite pointers, or which KERNAL, BASIC or hardware vectors a 64K RAM image retargets.
---

# Resolving C64 addresses and register values

**Trust a hardware register name. Check every other name against the
program.** Zero-page and `$0200-$07FF` names describe how BASIC and the
KERNAL use an address. A game that banks ROM out keeps its own variables
there.

```bash
D=skills/c64-memory-map/scripts/driver.ts   # from the repo root
V=skills/c64-memory-map/scripts/derive.ts   # from the repo root

node $D lookup '$D011' '$FFD2'      # what lives at an address
node $D annotate --file game.asm    # document a listing or .asm file
… | node $D annotate                # ... or one piped in on stdin
node $D memmap                      # rebuild the table from its sources (needs network)

node $V vic     --dd00 3E --d018 18 --d011 1B --d016 C8   # VIC bank, screen, charset, mode
node $V sprites --dd00 3E --d018 18 --d015 FF --ptrs 20,21,22,23,24,25,26,27
node $V vectors image.bin [--port 35] [--all]             # every vector in a 64K image
```

Both scripts run offline, on any host with Node ≥ 24. They contact nothing.
`driver.ts` answers "what does this address mean". `derive.ts` does the
arithmetic that a lookup table cannot do: register bits to concrete addresses.

## Look up an address

Write an address in the form of its source. `driver.ts` accepts hex `$D011`,
`0xD011`, `D011h` or `D011`, binary `%1101000000010001`, or decimal `53265`.
All forms give the same register, in upper or lower case.

`lookup` prints the full published prose for an address. The most specific
match comes first. Each match has a tag for its source and for the memory
region that contains it. A register shows its per-bit breakdown. The wider
regions that contain the address follow:

```
=== $D011 ===
$D011  [$D000-$D3FF, 53248-54271 VIC-II; video display]  <sta>
  Screen control register #1. Bits: Bits #0-#2: Vertical raster scroll. Bit #3: Screen height; 0 =
  24 rows; 1 = 25 rows. Bit #4: 0 = Screen off, complete screen is covered by border; 1 = Screen
  on, normal screen contents are visible. Bit #5: 0 = Text mode; 1 = Bitmap mode. Bit #6: 1 =
  Extended background mode on. Bit #7: Read: Current raster line (bit #8). Write: Raster line to
  generate interrupt at (bit #8). Default: $1B, %00011011.
$D011  [MOS 6566 VIDEO INTERFACE CONTROLLER (VIC)]  <io>
  VIC Control Register
    bit 7    Raster Compare: (Bit 8) See 53266
    bit 6    Extended Color Text Mode 1 = Enable
    bit 5    Bit Map Mode. 1 = Enable
    bit 4    Blank Screen to Border Color: O = Blank
    bit 3    Select 24/25 Row Text Display: 1 = 25 Rows
    bit 2-0  Smooth Scroll to Y Dot-Position (0-7)
$D000-$D02E  [C64 memory map (labelled)]  <zim>
  6566 Video Interface Chip, VIC II.
…
```

Use `lookup` when a bare address needs a meaning: a register that you will
write, a `JSR` target, or a variable that needs a symbol name.

## Annotate a listing

```bash
node $D annotate --file game.asm --out game.documented.asm
```

The input is any text with 6502 mnemonics: hand-written source, or a listing
from any disassembler. Each line comes back byte-for-byte. Indentation,
labels, directives, blank lines and existing comments do not change.
`annotate` adds a `; $addr (SYMBOL) = description` comment:

```
        * = $C000
start   lda #$00
        sta $d021                           ; $D021 = Background color (only bits #0-#3)
loop:   ldx $dc01                           ; $DC01 = Port B, keyboard matrix rows and joystick #1
        inc $d020                           ; $D020 = Border color (only bits #0-#3)
        jsr $ffd2                           ; $FFD2 = Output Vector, chrout
        lda ($fb),y                         ; $00FB-$00FE (FREKZP, pointer) = Unused (4 bytes)
        sta $0400,x                         ; $0400-$07E7 (VICSCN, indexed) = Default area of screen memory (1000 bytes)
        bne loop
        jmp ($0314)                         ; $0314-$0315 (CINV, pointer) = Execution address of interrupt service routine
        rts
```

`annotate` adds a header block at the start. The header lists each referenced
address with its full description, symbol and region (not shown above). On the
two examples on this page, the header is a little more than 2x the input: 23
lines for the eleven-line listing above, and 25 lines for the nine-line IRQ
excerpt below. Use `--no-header` to get the annotated body only.

Options:

- `--out FILE` writes the result to a file, not to stdout.
- `--max-span N` puts comments only on hits narrower than N bytes. The
  default is 4096 bytes. At that width, a hit as wide as screen RAM
  (`$0400-$07E7`, 1000 bytes) or the `$C000-$CFFF` block gets an inline
  comment. The 8 KB BASIC and KERNAL ROM blocks do not. A branch comment
  "KERNAL ROM (8192 bytes)" gives no useful data. The cap applies only to
  non-flow instructions. `annotate` holds flow instructions (`JMP`, `JSR`,
  branches, `RTS`, `RTI`) to 2 bytes, whatever `--max-span` is. So a jump or
  branch gets a comment only when it targets a specific vector such as
  `$0314`. `--max-span 2` gives register-level and variable-level comments
  only.
- `--no-header` removes the header block. Use it when you pipe annotated
  output into files for a large set of listings.
- `--file -` reads stdin. It is the same as a bare `annotate`.

Pipes work the same way:

```bash
node $D annotate --max-span 2 < irq.txt
```

```
$EA31: 20 EA FF    JSR $FFEA                ; $FFEA = Increment Real-Time Clock
$EA34: A5 CC       LDA $CC                  ; $00CC (BLNSW) = Cursor visibility switch
$EA36: D0 29       BNE $EA61
$EA38: C6 CD       DEC $CD                  ; $00CD (BLNCT) = Delay counter for changing cursor phase
$EA3C: A9 14       LDA #$14
$EA40: A4 D3       LDY $D3                  ; $00D3 (PNTR) = Current cursor column
$EA44: AE 87 02    LDX $0287                ; $0287 (GDCOL) = Color of character under cursor
$EA47: B1 D1       LDA ($D1),Y              ; $00D1-$00D2 (PNT, pointer) = Pointer to current line in screen memory
$EA4F: 20 24 EA    JSR $EA24                ; $EA24 = Syncronise Color Pointer
```

To write the names and comments into the annotation project, use
`c64-annotations`.

## Reading the annotations

The region of a comment tells you how much to trust it:

- **`$D000-$DFFF` is authoritative.** The hardware sets what these addresses
  mean, so a VIC, SID or CIA comment is correct for all programs.
  `LDA $DC01 / AND #$10 / BNE` gets the comment "Port B, keyboard matrix rows
  and joystick #1". Bit 4 is the fire button. That reading is correct because
  it comes from the hardware. KERNAL entry points are equally correct when ROM
  is banked in. `$01` bits #0-#2 select the banking. The vector at `$0314`
  shows if the program uses the KERNAL IRQ path.
- **Zero page, `$0200-$07FF` and the BASIC area describe BASIC and KERNAL
  usage.** Use them as a strong hint. Compare them with the behaviour of the
  program before you use the name. A real case: at `$08E6`, a game's
  `LDA $49` gets the label `FORPNT` ("value of current variable during LET").
  But `$49` is one of the game's own variables. Take the address, then check
  the meaning.
- **A region-only answer is not an error.** An address that no source names
  specifically prints only the wider regions that contain it. There is no
  error and no not-found line. `node $D lookup '$1234'` prints:
  ```
  === $1234 ===
  $0801-$9FFF  [$0800-$9FFF, 2048-40959 BASIC area]  <sta>
    Default BASIC area (38911 bytes).
  $0800-$9FFF  [C64 memory map (labelled)]  <zim>
    Normal BASIC Program space.
  ```
  This is the usual answer for the own code of a game. It means "the four
  tables do not name this exact address". It does not mean "this address is
  unmapped". The genuine zero-hit case is different: `lookup` prints
  `(not in memory map)` when no entry covers the address. A scan of the
  committed `memmap.json` shows that at least one entry covers each address
  `$0000`-`$FFFF`. So `(not in memory map)` cannot occur for a valid address
  with the current table. The branch is there for a future table with less
  coverage.

For a game, the fastest route to a real name is this: annotate with
`--max-span 2`, trust the I/O lines, and check the other lines against what
the code does with those addresses. The full method to classify regions and
name a program's own symbols is in `c64-reverse-engineering`.

## Decoding register values

`derive.ts` takes register values as arguments and RAM as a file. It reads
nothing from the emulator. Read the registers with `c64-emulator`
(`vice_vicii_get_state`, `vice_memory_read`). Get a 64K image with
`c64-ram-capture`.

What each VIC-II, SID and CIA register means, in the order to read them, is
in [references/chip-registers.md](references/chip-registers.md).

**`derive.ts` reads a bare number as hex.** `3E`, `$3E` and `0x3E` are the same
value. Use `%00111110` for binary. This is different from `driver.ts`, which
reads a bare `1234` as decimal. Register dumps are hex, so `derive.ts` needs no
marker for them.

### VIC bank, screen, charset and mode: `vic`

```bash
node $V vic --dd00 3E --d018 18 --d011 1B --d016 C8
```

`--dd00` and `--d018` are necessary. `--d011` has the default `1B` and
`--d016` has the default `C8`. The verb prints:

- **The VIC bank.** `$DD00` bits 0-1 select the bank, **inverted**:
  bank = 3 − bits, base = bank × `$4000`. This is the most common cause of a
  wrong answer in C64 graphics RE, because all other pointers use this base.
- **Screen RAM.** `$D018` bits 4-7 (VM): screen = base + VM × `$0400`.
- **The charset.** `$D018` bits 1-3 (CB): charset = base + CB × `$0800`
  (256 chars). The VIC sees character ROM at `$1000-$1FFF` in bank 0 and at
  `$9000-$9FFF` in bank 2, whatever `$01` says. When CB points there, the verb prints
  `*** CHARACTER ROM, NOT RAM ***`. There is then no charset in RAM to
  extract.
- **The bitmap**, in bitmap mode. Only bit 3 of `$D018` has an effect. It
  selects the 8K half of the bank (8000 bytes). The video matrix then holds
  colour pairs, not character codes.
- **The mode**, from ECM (`$D011` bit 6), BMM (`$D011` bit 5) and MCM
  (`$D016` bit 4): standard text, multicolor text, standard bitmap,
  multicolor bitmap, or extended background text. Any other combination is
  `INVALID — screen goes black`. Read the registers again: you probably read
  them in the middle of an update inside a raster split. Multicolor uses bit
  pairs at half the horizontal resolution.
- **The sprite pointers** at screen + `$03F8` (8 bytes), and colour RAM at
  `$D800-$DBFF`. Colour RAM does not move with the VIC bank. Only its low
  nybble is used.

### Sprite data addresses: `sprites`

```bash
node $V sprites --dd00 3E --d018 18 --d015 FF --ptrs 20,21,22,23,24,25,26,27
```

For each of the 8 sprites, the verb prints if it is enabled (`$D015`, default
`FF`), its pointer, and its data address: base + pointer × 64. Each sprite
uses 63 bytes of its 64-byte block. `$D010` holds bit 8 of X for X > 255.
The other registers of a disabled sprite hold old values. Do not decode them.

### Vectors in a 64K image: `vectors`

```bash
node $V vectors image.bin            # the IRQ spine and the hardware vectors
node $V vectors image.bin --all      # every block
node $V vectors image.bin --port 35  # use this $01 value, not the image's
```

The image must be exactly 65536 bytes. The verb decodes `$01` (from the image,
or from `--port`) into LORAM, HIRAM and CHAREN. Then it states:

- **The live vector pair.** With HIRAM = 1, `$0314/$0315` (the KERNAL path).
  With HIRAM = 0, `$FFFE/$FFFF` (the hardware vectors). `$FFFA-$FFFF` in a RAM
  capture are the RAM bytes under KERNAL ROM. Those bytes run when HIRAM = 0.
- **The CBM80 signature** at `$8004`. When it is present, `$8000/$8002`
  survive a reset, because the KERNAL uses them.
- **Each vector against its stock default**: `default`, `no default`, or
  `*** RETARGETED ***`. It covers the BASIC indirects (`$0300-$030B`), the
  KERNAL IRQ/BRK/NMI vectors (`$0314-$0319`), the KERNAL I/O indirects
  (`$031A-$0333`), the autostart block (`$8000-$8008`), the BASIC ROM entry
  (`$A000-$A003`) and the hardware vectors (`$FFFA-$FFFF`).
- **Dormant blocks.** A block whose ROM is banked out, or an autostart block
  without CBM80, shows `DORMANT`. With KERNAL ROM banked in, the hardware
  vectors are also `DORMANT`: the CPU uses the ROM vectors, not the program's.
  Nothing maintains a dormant block. Its non-default bytes
  are old values, usually the KERNAL's boot-time values, partly overwritten.
  They are not diverted vectors. Do not read a hook into them.
- **Cracker-hook sites.** A diverted `ISTOP` (`$0328`), `ILOAD` (`$0330`) or
  `ISAVE` (`$0332`) in a live block prints
  `*** CRACKER-HOOK SITES DIVERTED ***`. A diverted LOAD or SAVE is a custom
  loader that bypasses the KERNAL. A diverted STOP is anti-tamper. Both are
  provenance signals, and so is a dormant byte that is different between two
  releases. Take them to `c64-provenance`.
- **Bank-ambiguous targets.** A target in `$A000-$BFFF`, `$D000-$DFFF` or
  `$E000-$FFFF` is ROM or the RAM under it, as set by `$01` when the CPU uses
  the vector. The image alone cannot resolve it. Read the target two times
  with `c64-emulator`: once with the default bank, once with `bank:"ram"`. If
  the RAM bytes are different from stock ROM, the program has its own code
  under ROM.

A retargeted `$0314` is the per-frame handler. Check it on the live machine:
the handler that runs exactly one time per frame is the one that matters.

## Where the data comes from

`node $D memmap` builds the table from four published sources. Each source
covers what the others do not:

| Source | Contribution |
|---|---|
| [sta.c64.org/cbm64mem.html](https://sta.c64.org/cbm64mem.html) | richest prose for zero page, work areas, screen RAM, I/O |
| [C64.MemoryMap.txt](https://www.zimmers.net/anonftp/pub/cbm/maps/C64.MemoryMap.txt) | canonical assembler symbols: `PNT`, `CINV`, `VICSCN`, `TXTTAB` |
| [krnromma.htm](http://unusedino.de/ec64/technical/aay/c64/krnromma.htm) | every KERNAL ROM routine by name, so `JSR $EA24` reads as "Syncronise Color Pointer" |
| [C64io.txt](https://www.zimmers.net/anonftp/pub/cbm/maps/C64io.txt) | VIC/SID/CIA registers broken down per bit |

The built table, `memmap.json`, is committed next to the scripts. So `lookup`
and `annotate` need only Node. Rebuild the table when a source publishes a
correction. The `<src>` tags in `lookup` output show which table gave each
claim.

The MCP server also reads `memmap.json`: `anno_join_memmap` joins it against
an annotation project, and `anno-regbits-gen.mts` builds its register
bit-name table from the structured `bits` entries (digest-pinned, so CI fails
when `memmap.json` changes without a re-run). Only 29 of the 959 entries have
a structured `bits` array. Some `bits` prose has OCR damage, for example a
letter `O` for the digit `0`. To widen the `io` parser or to correct that
prose is work for this skill.

**`memmap` changes a tracked file.** It overwrites the committed `memmap.json`
(235,925 bytes, check with `wc -c`) in place, with no backup and no diff. It
gets one source (`http://unusedino.de/…`) over plain HTTP with no TLS. The
only guards against a bad rebuild are a per-source empty check and a floor of
600 entries across all sources. So a source set that is partly unreachable or
partly changed can replace good data with less data, and nothing tells you.
Do these steps:

1. Start from a clean working tree.
2. Run `node $D memmap`.
3. Run `git diff --stat` on `memmap.json`.
4. If the diff is not the correction you expected, `git checkout` the file.
5. Review the diff before you commit it.

`lookup` and `annotate` are read-only.

## Failure shape

Both scripts print `error: <message>` on stderr and exit 1 when they cannot
do the work.

- `driver.ts` with no command prints its usage and exits 0. An unknown command
  prints the usage and exits 1. A missing table gives
  `no …/memmap.json; run: node driver.ts memmap`. A failed rebuild gives
  `no entries from <url> — layout changed?` or
  `only <n> entries total — layout changed?`, and writes nothing.
- `derive.ts` with no verb or `--help` prints its usage and exits 0. An unknown
  verb prints the usage and exits 2. `vic` refuses a missing `--dd00` or
  `--d018` (`missing --dd00`). `vectors` refuses a missing path
  (`vectors needs an image path`) and an image of the wrong size
  (`expected a 65536-byte image, got <n>`). A value it cannot parse gives
  `cannot parse --<name>: <value>`.
- **`sprites` does not refuse a missing `--dd00` or `--d018`.** It prints
  `NaN` addresses. Give both values.

## What this skill does NOT do

- **No emulator access.** Reading registers and memory from the running C64 is
  `c64-emulator`.
- **No annotation store writes.** Writing names, comments, typed ranges and
  enums into the project is `c64-annotations`.
- **No region classification or symbol naming method.** Deciding what a region
  is and what a program's own symbol represents is `c64-reverse-engineering`.
- **No disassembly.** Producing the listing to annotate is `c64-disassembler`.
- **No RAM capture.** Getting the 64K image for `vectors` is `c64-ram-capture`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| Comments on regions too wide to be useful | `--max-span 2`. The default is 4096 bytes. |
| A `JSR` or branch target got no comment | `annotate` caps flow instructions at 2 bytes, whatever `--max-span` is. `lookup` the target for the ROM routine name. |
| The output is mostly header | `--no-header`. |
| `lookup` printed only wide region lines and no specific name | No table names that address. This is normal for the own code of a game. Take the region, and name the address from what the code does with it. |
| `(not in memory map)` | No entry covers it. Check that the address parsed as you intended: a bare `1234` is decimal in `driver.ts`. |
| `no …/memmap.json; run: node driver.ts memmap` | Restore the committed table with `git checkout`. Do not rebuild it: the rebuild needs network and overwrites tracked data. |
| `memmap` rewrote `memmap.json` and the diff is large or negative | A source was unreachable or changed. `git checkout` the file. |
| Every graphics pointer is wrong, with no error | `$DD00` bits 0-1 are **inverted**. Derive the bank again first. All other values use it. |
| The charset at the computed address is garbage | CB can point into the char-ROM shadow (`$1000`/`$9000`, banks 0/2). `derive.ts vic` shows `*** CHARACTER ROM, NOT RAM ***`. There is no charset in RAM to extract. |
| A sprite decodes as noise | Check `$D015` first. The registers of a disabled sprite hold old values. Then check MCM: a multicolor sprite decoded as hires is two times too wide. |
| `$0314` holds a value that is not a plausible address | Check HIRAM. With the KERNAL banked out, nothing sets the RAM vectors. Read `$FFFE/$FFFF`. `derive.ts vectors` shows the live pair. |
| A `$DD00` write looks like a bank switch inside loader code | `$DD00` also holds the serial bus lines. Check the mask. Loader code that writes `$DD00` usually talks to the drive. |
| `mode: INVALID — screen goes black` | You read the registers during an update inside a raster split. Read them again. |
| `expected a 65536-byte image, got <n>` | `vectors` needs a full 64K capture. Get one with `c64-ram-capture`. |
