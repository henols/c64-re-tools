---
name: c64-memory-mapping
description: Look up what any C64 address means and turn raw 6502 disassembly into documented assembly, by resolving every address against the C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA register tables. Use when asked to annotate or comment assembly, document a disassembly listing, or look up an address like $D020, $EA24 or $FFD2.
---

# C64 memory mapping & annotated disassembly

Look up what a C64 address means, and document a 6502 listing by resolving every
address it touches. One script does both, offline, anywhere Node ≥18 runs:

```bash
D=.claude/skills/c64-memory-mapping/scripts/driver.mjs   # relative to the repo root

node $D lookup '$D011' '$FFD2'      # what lives at an address
node $D annotate --file game.asm    # document a listing or .asm file
… | node $D annotate                # ... or one piped in on stdin
node $D memmap                      # refresh the table from its sources (needs network)
```

Write an address however the source you copied it from wrote it — hex `$D011`,
`0xD011`, `D011h` or `D011`, binary `%1101000000010001`, or decimal `53265` all
reach the same register, in either letter case.

## Look up an address

`lookup` prints the full published prose for an address, most specific match
first, each tagged with the source it came from and the memory region it sits in.
Registers carry their per-bit breakdown, and the wider regions enclosing the
address follow it:

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

Reach for this whenever a bare address needs a meaning — a register you are about
to write, a `JSR` target, or a symbol name to give a variable.

## Annotate a listing

```bash
node $D annotate --file game.asm --out game.documented.asm
```

The input is any text carrying 6502 mnemonics: hand-written source, or a listing
from whichever disassembler produced it. Lines come back byte-for-byte —
indentation, labels, directives, blank lines and existing comments intact — with
a `; $addr (SYMBOL) = description` comment appended:

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

A header block listing every referenced address with its full description, symbol
and region is prepended (elided above): measured on the two examples on this page,
the eleven-line listing above grows a 23-line header and the nine-line IRQ excerpt
below grows a 25-line one — a little over 2x the input either way. Pass
`--no-header` to drop it and get the annotated body alone.

Options:

- `--out FILE` writes the result to a file instead of stdout.
- `--max-span N` keeps comments to hits narrower than N bytes, for terser output.
  Default is 4096 bytes: at that width a hit as wide as screen RAM
  (`$0400-$07E7`, 1000 bytes) or the `$C000-$CFFF` block still earns an inline
  comment, while the 8 KB BASIC and KERNAL ROM blocks do not — a branch
  annotated "KERNAL ROM (8192 bytes)" teaches nobody anything. The cap applies
  only to non-flow instructions: flow instructions (`JMP`, `JSR`, branches,
  `RTS`, `RTI`) are held to 2 bytes regardless of `--max-span`, so a jump or
  branch only earns a comment when it targets a specific vector such as
  `$0314`. `--max-span 2` gives register- and variable-level comments only.
- `--no-header` suppresses the prepended header block, for piping annotated
  output straight into a file across a large listing set.
- `--file -` reads stdin, identical to a bare `annotate`.

Piping works the same way, to annotate straight from another command:

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

## Reading the annotations

Weigh a comment by the region it describes:

- **`$D000-$DFFF` is authoritative.** Hardware decides what these mean, so a VIC,
  SID or CIA comment holds for any program. `LDA $DC01 / AND #$10 / BNE` annotates
  as "Port B, keyboard matrix rows and joystick #1", bit 4 is the fire button, and
  that reading is sound because it rests on hardware. KERNAL entry points are
  equally solid wherever ROM is banked in — `$01` bits #0-#2 select it, and the
  vector at `$0314` shows whether the KERNAL IRQ path is in use.
- **Zero page, `$0200-$07FF` and the BASIC area describe BASIC and KERNAL usage.**
  Read them as a strong hint and confirm against the program's own behaviour
  before adopting the name. A game that banks ROM out keeps its own variables
  there. A real case: at `$08E6` a game's `LDA $49` gets labelled `FORPNT`
  ("value of current variable during LET"), when `$49` is really one of that
  game's own variables. Take the address, verify the meaning.
- **A region-only answer is not an error.** An address that no source names
  specifically prints only the wider regions enclosing it — no error, no
  not-found line. `node $D lookup '$1234'` prints:
  ```
  === $1234 ===
  $0801-$9FFF  [$0800-$9FFF, 2048-40959 BASIC area]  <sta>
    Default BASIC area (38911 bytes).
  $0800-$9FFF  [C64 memory map (labelled)]  <zim>
    Normal BASIC Program space.
  ```
  This is the dominant case for any game's own code: a region-only answer
  means "the four tables do not name this exact address", not "this address is
  unmapped". It differs from the genuine zero-hit case, where `lookup` prints
  `(not in memory map)` because nothing at all covers the address
  (driver.mjs:485-487). Checked directly against the committed table (a scan of
  `memmap.json`, not a `memmap` rebuild): every address `$0000`-`$FFFF` is
  covered by at least one entry as of this build, so `(not in memory map)` is
  not reachable for any valid address today — the branch exists for a future
  table that loses coverage, not for anything the current one omits.

For a game, the fastest route to a real name is to annotate with `--max-span 2`,
trust the I/O lines immediately, and confirm the rest by watching what the code
does with them.

## Where the data comes from

`node $D memmap` rebuilds the table from four published sources, each covering
what the others leave out:

| Source | Contribution |
|---|---|
| [sta.c64.org/cbm64mem.html](https://sta.c64.org/cbm64mem.html) | richest prose for zero page, work areas, screen RAM, I/O |
| [C64.MemoryMap.txt](https://www.zimmers.net/anonftp/pub/cbm/maps/C64.MemoryMap.txt) | canonical assembler symbols — `PNT`, `CINV`, `VICSCN`, `TXTTAB` |
| [krnromma.htm](http://unusedino.de/ec64/technical/aay/c64/krnromma.htm) | every KERNAL ROM routine by name, so `JSR $EA24` reads as "Syncronise Color Pointer" |
| [C64io.txt](https://www.zimmers.net/anonftp/pub/cbm/maps/C64io.txt) | VIC/SID/CIA registers broken down per bit |

The built table is committed alongside the script, so `lookup` and `annotate` need
only Node. Rebuild when a source publishes a correction; `lookup`'s `<src>` tags
show which table any given claim came from.

`memmap` overwrites the committed, git-tracked `memmap.json` (driver.mjs:270 —
235,925 bytes as of 2026-08-04, confirm with `wc -c`) **in place, with no backup
and no diff.** One of the four sources (`http://unusedino.de/…`, driver.mjs:33)
is fetched over plain HTTP with no TLS, and the only guard against a bad rebuild
is a per-source emptiness check plus a 600-entry floor across all sources
combined (driver.mjs:262, 268) — so a partially-reachable or partially-changed
source set can silently replace good tracked data with less of it. Rebuild, then
run `git diff --stat` on `memmap.json` before accepting the result, and
`git checkout` the file if the diff is not explainable as the correction you
were expecting. Because it mutates the repo, `memmap` belongs behind a GSD
command (`/gsd-quick`), per this project's GSD Workflow Enforcement rule — it is
not a read-only lookup like `lookup` and `annotate`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Comments land on regions too wide to be useful | `--max-span 2`; the default is 4096 bytes. |
| A `JSR` or branch target got no comment at all | Flow instructions are capped at 2 bytes regardless of `--max-span`; `lookup` the target directly for the ROM routine name. |
| The output is mostly header | `--no-header`. |
| `lookup` printed only wide region lines and no specific name | Nothing in the four tables names that address; expected for the game's own code — take the region and name the address from what the code does with it. |
| `lookup` printed `(not in memory map)` | Nothing covers it; check the address parsed as intended, since a bare `1234` reads as decimal. |
| `no memmap.json; run: node driver.mjs memmap` | Restore the committed table with `git checkout` rather than rebuilding; the rebuild needs network and overwrites tracked data. |
| `memmap` rewrote `memmap.json` and the diff is large or negative | A source was unreachable or changed; `git checkout` the file. |
