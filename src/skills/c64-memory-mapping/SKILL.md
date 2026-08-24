---
name: c64-memory-mapping
description: Look up what any C64 address means and turn raw 6502 disassembly into documented assembly, by resolving every address against the C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA register tables. Use when asked to annotate or comment assembly, document a disassembly listing, or look up an address like $D020, $EA24 or $FFD2.
---

# C64 memory mapping & annotated disassembly

Look up what a C64 address means, and document a 6502 listing by resolving every
address it touches. One script does both, offline, anywhere Node ≥18 runs:

```bash
D=src/skills/c64-memory-mapping/scripts/driver.mjs   # relative to the repo root

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

## Feeding the enum generator

`memmap.json`'s structured `bits` entries are the source of the curated register bit-name table used
to generate program-specific enums for regenerator2000's annotation store (R2000-13): register
writes disassemble as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` instead of a bare `#$1b`. The
generator is `src/mcp/vice/r2000-regbits-gen.ts`; its committed output is
`src/mcp/vice/r2000-regbits.json`; and that output is **digest-pinned** to `memmap.json` — a
`node r2000-regbits-gen.ts` run compares its own fresh build against the committed file, and CI fails
if `memmap.json` changed without a re-run.

**The honest gap:** only 29 of this file's 959 entries carry a structured `bits` array. `$D015`,
`$D017`, `$D01A` and `$D01B`–`$D01D` — the sprite-plane bitmask registers a real game writes
constantly — are **not** among those 29, so the enum generator supplies them from its own curated
override table (`OVERRIDES` in `r2000-regbits-gen.ts`), not from this file. Widening `memmap.json`'s
`io` parser (or repairing the OCR damage already present in some `bits` prose, e.g. a letter `O` for
the digit `0`) so those registers get a real structured entry here is separate work belonging to this
skill, not the generator.

**Installing those bit names into a project's own disassembly:** the table above only builds
`r2000-regbits.json` — turning a specific project's register *writes* into named enum variants is a
separate, later step, once a `.regen2000proj` already exists (`r2000 bootstrap`, see
`c64-program-recon`):

```bash
npx -y @henols/vice-mcp r2000 gen-enums game.regen2000proj                            # npm install
node <plugin-root>/src/mcp/vice/vice-proxy.ts r2000 gen-enums game.regen2000proj  # in-repo/plugin
```

`r2000 gen-enums` requires an EXISTING `.regen2000proj` — it does not bootstrap one from a raw
input. It reads the project's own disassembly, creates one enum variant per DISTINCT value actually
written at each matching immediate-load address (named from the curated table above), and prints
total/paired/unpaired register-store counts plus a per-enum variant count. It exits non-zero, naming
the reason, when either of its two internal search passes hits its own 10000-row ceiling — pass
`--max-results` to raise that ceiling for a program whose store exceeds it.

<!--
ATTRIBUTION (ABS-02)
Adapted from regenerator2000.
  Source repository: https://github.com/ricardoquesada/regenerator2000
  Source path:       r2000-analyze-blocks/SKILL.md — held under the upstream
                     repository's excluded agent-skills directory, which the
                     published crate does not ship. The full upstream path is
                     recorded once, in
                     .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json
  Pinned commit:     493f840418f1450a342bb220c2fe3d2585dd0525  (v0.9.20, 2026-07-11)
  Source sha256:     3fad6193466a20fa0d2f56a7e38a740fa7218b920aa36e348bc65273c987aa1b
  Upstream licence:  MIT OR Apache-2.0 — Copyright (c) 2026 Ricardo Quesada
  This project elects: MIT

  ADAPTED, NOT VERBATIM. Named deviations, each one a real change to what the
  upstream text instructs:
    - Upstream's "if a conversion was wrong, undo it" step is replaced with
      "set the correct type again". `r2000_set_data_type` is idempotent over a
      range, so the undo call buys nothing and this project does not expose
      it.
    - Upstream's two instructions to insert a table boundary marker are NOT
      carried as instructions — the underlying call is not exposed here. The
      HAZARD they exist to prevent is carried instead, as a dated limitation
      with a forward pointer, under "The adjacent-table limitation" below.
    - Upstream's soft cross-reference to its own sibling procedure file is
      replaced by a pointer to this project's own absorbed routine procedure
      in `src/skills/c64-program-recon/SKILL.md`. The upstream file it named
      does not exist for anyone who installed regenerator2000 from the crate.
    - The region-read step names this project's own byte ceiling, which
      upstream has no equivalent of.

  Re-sync trigger: see ABS-04's dated decision and the manifest's
  `resync_triggers`.
  See THIRD-PARTY-NOTICES.md.
-->

## Classifying every region of an annotation project

Everything above answers *what does this published address mean*. This section
answers a different question over the same map: **given a loaded binary in an
annotation project, what is each region of it — code, or one of eight kinds of
data?**

**This is the static answer, taken from bytes on disk.** `c64-program-recon`
answers the *live* code-versus-data question — its step 5 is "what the PC
actually visits across full coverage", and an execution trace beats every
static heuristic on this page. Run the live pass when you have a running
machine; run this one when all you have is a file, and treat a later trace as
the thing that overrules it.

When a binary is first loaded, the auto-analyzer traces reachable code from the
entry point and marks it **Code**. Everything else is **Undefined** — not
"data", just unexplored. The job here is to walk the Undefined regions, work
out what each one actually is, and set it.

### The one mistake that matters more than the rest

**Never disassemble a region without concrete proof that it executes.** Random
data routinely disassembles into plausible-looking instruction sequences, and
that is *not* evidence of code — it is a property of the 6502's dense opcode
map. A region earns the Code type only when at least one of these holds:

- **It is a `JSR`/`JMP` target.** Already-analysed code contains `JSR $addr` or
  `JMP $addr` landing in it. Check with `r2000_get_cross_references`.
- **It is a branch target** of an already-analysed `BNE`/`BEQ`/`BCC`/`BCS`/
  `BPL`/`BMI`/`BVC`/`BVS`.
- **It is a vector or handler**: its address appears in a vector table
  (`$FFFA`–`$FFFF`, `$0314`–`$0319`), in an `address` or split-address block,
  or in a jump table reached by `JMP ($addr)`.
- **A human says so explicitly.**

None of those? Leave it **Undefined**, or classify it as data — even when the
bytes disassemble cleanly. "It looked like code" is how a sprite sheet becomes
four hundred lines of fiction.

### The order of the passes

Work the Undefined blocks in four passes, in this order. Do not interleave
them; each pass makes the next one cheaper.

1. **Provably-reachable code** — `r2000_disassemble` at the entry point of each
   region that meets the proof bar above. Control-flow disassembly follows the
   flow itself and sets the Code blocks for you.
2. **Text** — PETSCII and screencode strings.
3. **Tables** — byte, word, address and split (lo/hi, hi/lo) tables.
4. **Whatever is left** — decide data, or leave it Undefined for a human.
   **Never** speculatively disassemble in this pass; by definition nothing here
   met the proof bar.

### Scope, and reading a region

1. `r2000_get_binary_info` first. Keep `origin`, `size`, `system`, `filename`,
   `description` and `may_contain_undocumented_opcodes`.
   - `system` names the target machine. On a C64 the rest of this skill *is*
     the memory map you need — `lookup` any address a region touches before
     guessing at it.
   - `filename` and `description` are the software context. A known title, a
     known music driver or a known packer changes what a region is likely to
     be.
   - `may_contain_undocumented_opcodes: true` means illegal opcodes (`LAX`,
     `SAX`, `SLO`, `DCP`, `ISC`) may appear. **Do not misclassify those as
     data** — they are valid instructions. The flag is a human's hint, not a
     guarantee: some programs use them with the flag false.
2. `r2000_get_blocks` to see what is already classified, and focus on the
   Undefined entries.
3. Read each candidate region twice, through `r2000_read_region`: `view:
   "hexdump"` shows the byte patterns, and **omitting `view`** gives the
   disassembly view — its documented default, confirmed live — which shows how
   the region would decode. The combined byte count is capped at **4096 bytes** per call
   (`R2000_READ_REGION_MAX_BYTES`), and a request above the cap is refused by
   name rather than truncated — so walk a large binary in consecutive ranges.
   Chunks of **256–512 bytes** are the practical working size for
   classification; a 4096-byte hexdump is more than can be read carefully in
   one pass.

### Applying the classification

- **Code**: call `r2000_disassemble` with the entry-point address. Do **not**
  pass `"code"` to `r2000_set_data_type` — the enum accepts the value, but
  setting a range to code is not the same as tracing flow through it, and only
  the trace produces correct block boundaries. After every `r2000_disassemble`,
  call `r2000_get_blocks` again: the trace has created blocks you have not seen.
- **Data**: batch the `r2000_set_data_type` calls through
  `r2000_batch_execute`. A real classification pass is dozens of ranges, and
  batching is what makes that affordable. Do not put code regions in the batch.
- **A wrong classification is not a disaster and does not need undoing.**
  `r2000_set_data_type` is idempotent over a range: set the correct type again
  over the same range and the previous one is gone. (Upstream reaches for an
  undo call here; this project does not expose one, and does not need to.)
- Re-read `r2000_get_blocks` after each batch to confirm what actually landed.

Example of a valid data-only batch, then the code regions separately:

```
r2000_batch_execute:
  - r2000_set_data_type  start=2304  end=2367  data_type="byte"
  - r2000_set_data_type  start=2368  end=2431  data_type="petscii"
then: r2000_disassemble address=2049
then: r2000_disassemble address=2432
then: r2000_get_blocks          # refresh
```

### The block types

| Block type | `data_type` | When |
|---|---|---|
| **Code** | *call `r2000_disassemble`* | Provably-executed instructions. Never via `r2000_set_data_type`. |
| Byte | `byte` | Raw 8-bit data: sprites, bitmaps, charsets, lookup tables, variables, unknowns |
| Word | `word` | 16-bit little-endian values: 16-bit variables, math constants, SID frequencies |
| Address | `address` | 16-bit LE pointers — jump tables, vector lists. Creates cross-references |
| PETSCII text | `petscii` | PETSCII strings: messages, prompts, anything bound for `$FFD2` |
| Screencode text | `screencode` | Text written straight to screen RAM (`$0400`–`$07E7`) |
| Lo/Hi address | `lo_hi_address` | Split address table, low bytes first. Even byte count required |
| Hi/Lo address | `hi_lo_address` | Split address table, high bytes first. Even byte count required |
| Lo/Hi word | `lo_hi_word` | Split word table, low half first — e.g. a SID frequency table |
| Hi/Lo word | `hi_lo_word` | Split word table, high half first |
| External file | `external_file` | Large blobs to export as-is: SID tunes, bitmaps, charsets |
| Undefined | `undefined` | Reset to unknown. The honest answer for a region you cannot place |

### Recognising each kind

**Byte data** — regular patterns that form no valid instruction sequence;
addressed by `LDA addr,X` / `LDA addr,Y` table lookups; sprite data in 63-byte
(padded to 64) units, usually grouped; bitmap data in 8-byte character cells;
colour data confined to `$00`–`$0F`; or random-looking bytes between two code
blocks whose disassembly is nonsense.

**Word data** — byte pairs forming meaningful 16-bit values (screen addresses,
timer values); loaded low-then-high by adjacent `LDA addr` / `LDA addr+1`.

**Address tables** — byte pairs that read as little-endian addresses landing
*inside* the binary; reached by `JMP ($addr)` or indexed indirect reads. Jump
tables, dispatch tables and vector lists all live here.

**Split lo/hi (or hi/lo) tables** — two equal halves, one of plausible low
bytes and one of plausible high bytes, referenced separately:
`LDA lo,X / STA ptr / LDA hi,X / STA ptr+1 / JMP (ptr)`. Recombine the halves
and check the addresses are real. Lo/Hi (low half first) is the commoner form
on the 6502. **The total byte count must be even and the halves equal** — an
odd count means the boundary is in the wrong place.

**PETSCII text** — bytes in `$20`–`$7E` (unshifted) or `$C0`–`$DF` (shifted),
often recognisably English since PETSCII shares `$20`–`$5F` with ASCII;
terminated by `$00`, `$0D`, or a high-bit sentinel; reached by `$FFD2` (CHROUT)
or `$AB1E` (BASIC STROUT). `GAME OVER`, `PRESS FIRE`, menus, credits.

**Screencode text** — bytes in `$00`–`$3F` where `$00` is `@` and `$01` is `A`;
copied directly to `$0400`–`$07E7`. `LDA data,X / STA $0400,X` is the
give-away. A full screen dump is exactly 1000 bytes.

**External file** — a large contiguous non-code block matching a known format:
a `PSID`/`RSID` header, a 2048-byte charset (256 chars × 8 bytes), sprite data
in multiples of 64, or a bitmap. Export it rather than annotate it.

**PETSCII is not screencode.** If it is copied to `$0400`, it is screencode; if
it is passed to CHROUT, it is PETSCII. Getting this backwards produces text
that renders as garbage in exactly one of the two places.

### The adjacent-table limitation

**Dated limitation, recorded 2026-08-24.** Two adjacent regions of the *same*
type auto-merge into one block, and `r2000_get_blocks` reports the merged
result. Two byte tables side by side, or the two halves of a split table
sitting next to each other, therefore lose their boundary in the store.

Upstream's answer is a `toggle_splitter` call at the boundary, which this
project does not expose. Until it does:

- **Do not** rely on the block listing to tell two adjacent same-type tables
  apart. It cannot.
- **Do** record the boundary where it survives: a `r2000_set_label_name` at the
  start of the second table, and a line comment on both naming the extent you
  actually determined.
- Expect a systematic **over-merge** bias in any count taken from the block
  store, and say so when reporting one.

The forward pointer: exposing the splitter is a Phase 20/21 concern, because
`DECOMP-01` ("every byte is code, byte, word, address, PETSCII, screencode or
table") cannot distinguish two adjacent tables without it, and `BUILD-02`
("data tables extracted to their own files") has no boundary to cut on. The
per-call disposition and its justification are in the manifest named in the
attribution header above.

### Labelling, and the report

Name what you classified — `r2000_set_label_name` on entry points, tables and
strings — and comment it with `r2000_set_comment` (`"line"` above,
`"side"` beside). For the conventions to name things *by*, and for the
comment-block format to use on a subroutine, follow the absorbed routine
procedure in `src/skills/c64-program-recon/SKILL.md`.

Then report, and mean it:

- Total blocks by type.
- Notable findings — "three PETSCII strings", "a lo/hi jump table at `$1200`".
- **Every region still uncertain or still Undefined, by address.** This is the
  part that makes the pass reusable. A classification report with no uncertain
  regions on a real game is almost always a report that stopped looking.
- Offer to `r2000_save_project`.

### What goes wrong

| Symptom | What it actually is |
|---|---|
| A region disassembles beautifully but has no incoming reference | Data. Decodability is not evidence; leave it Undefined. |
| Disassembly full of impossible branches or `BRK` (`$00`) floods | Data misread as code. |
| Odd-looking instructions, but real `JSR`/`JMP` cross-references land here | Probably code using undocumented opcodes. Check the `may_contain_undocumented_opcodes` hint. |
| A split table's addresses recombine to nonsense | The half boundary is misplaced, or the table is hi/lo rather than lo/hi. |
| Two tables you classified separately show up as one block | The adjacent-table limitation above. Not your error. |
| Text renders as garbage on screen but fine through CHROUT | It is PETSCII, typed as screencode — or the reverse. |

<!--
ATTRIBUTION (ABS-02)
Adapted from regenerator2000.
  Source repository: https://github.com/ricardoquesada/regenerator2000
  Source path:       r2000-analyze-symbol/SKILL.md — held under the upstream
                     repository's excluded agent-skills directory, which the
                     published crate does not ship. The full upstream path is
                     recorded once, in
                     .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json
  Pinned commit:     493f840418f1450a342bb220c2fe3d2585dd0525  (v0.9.20, 2026-07-11)
  Source sha256:     d57d9c2fdfa1c3e2f8a6384a881378ad1e3e371114c3b0b8d15ec1c71b3b4da8
  Upstream licence:  MIT OR Apache-2.0 — Copyright (c) 2026 Ricardo Quesada
  This project elects: MIT

  ADAPTED, NOT VERBATIM. Named deviations, each one a real change to what the
  upstream text instructs:
    - Upstream's cursor-based entry route is replaced by explicit address
      input. Upstream's own text forbids relying on the cursor in exactly this
      situation, and this project has no editor cursor at all; the composite
      address lookup (`r2000_get_address_details`) takes an explicit address.
    - Upstream's two low/high-byte immediate-formatting steps are NOT carried
      as instructions — the underlying call is not exposed here. They are
      named by bare verb, with the requirement that would supply their
      criterion, under "The pointer-formatting step this project does not
      have" below.
    - The hardware-register and KERNAL-routine identification steps are routed
      to this skill's own `lookup` verb and its four published tables, rather
      than to unassisted model recall.

  Re-sync trigger: see ABS-04's dated decision and the manifest's
  `resync_triggers`.
  See THIRD-PARTY-NOTICES.md.
-->

## What a symbol in the store actually represents

`lookup` at the top of this page answers what a **published** address means —
a hardware register, a KERNAL entry point, an OS variable. That answer comes
from four tables and holds for every program.

This section is the other half: **what a program's *own* address represents.**
No table can tell you, because the meaning was decided by the program's code.
When `lookup` returns a region-only answer — the dominant case for a game's own
code and variables, as noted above — this is the procedure that gets you a
name.

### 1. Target and context

- **Always start from an explicit address**, `$XXXX` or its decimal
  equivalent. There is no editor cursor in this project's route, and upstream's
  own text forbids relying on one anyway. `r2000_get_address_details` composes
  the symbol, comments, block type and cross-references for one explicit
  address in a single call.
- `r2000_get_binary_info` for `system`, `filename`, `description` and
  `may_contain_undocumented_opcodes`. `filename` and `description` are how a
  symbol gets a *domain* name — `lap_counter` in a racing game, `lives` in a
  platformer — instead of a generic one. With undocumented opcodes in play,
  remember that `LAX`, `SAX` and `DCP` have real read/write side effects that
  belong in the data-flow picture.

### 2. Gather the usage

`r2000_get_cross_references` on the address returns everywhere it is touched.
Read the instruction at each site, because the instruction is the evidence:

- **Writes**: `STA`, `STX`, `STY`
- **Reads**: `LDA`, `LDX`, `LDY`, `BIT`, `CMP`, `CPX`, `CPY`, `ADC`, `SBC`
- **Read-modify-write**: `INC`, `DEC`, `ASL`, `LSR`, `ROL`, `ROR`

**Zero cross-references is a result, not a dead end.** Three explanations, in
order of likelihood:

1. It is reached **indirectly**. Check whether it is in the zero page
   (`$00`–`$FF`) and whether nearby code uses `($addr),Y` or `($addr,X)`. An
   indirect pointer's *target* has no direct reference by construction.
2. It is a **well-known system address** the disassembler does not cross-
   reference. Run `lookup` on it — that is exactly the case the four tables
   above cover.
3. It is genuinely **dead**: unused variable, or code no longer reached. Say so
   in the report rather than inventing a purpose.

### 3. Place it

**A hardware register?** `lookup` it. If one of the four tables names it, take
the published name and the per-bit breakdown with it — that reading rests on
hardware and holds for any program.

**Inside a well-known global block?** Screen RAM (`$0400`–`$07E7`), colour RAM
(`$D800`–`$DBFF`), a sprite pointer at VM+`$03F8`. **Do not skip these as
"obvious".** Name them systematically from the base plus the offset —
`SCREEN_ROW03_COL12` — so contiguous structures read as structures instead of a
field of auto-generated offsets.

**An external ROM or system routine?** An `e_` prefix, or an address in KERNAL
space (`$E000`–`$FFFF`), or a standard shadow vector. `lookup` gives the
routine's published name; rename to the conventional form — `$FFD2` becomes
`KERNAL_CHROUT`, `$EA31` becomes `SYSTEM_IRQ_HANDLER`.

**A 16-bit pointer?** Below `$0100`, and used with indirect-indexed `($xx),Y`
or indexed-indirect `($xx,X)`. Rename to `ptr_`/`vec_` form and comment what it
points *to*, which is the thing the name cannot carry.

**A flag or bitmask?** Only ever `$00`/`$01` or `$00`/`$FF`; tested with `BIT`
or `LDA`/`BEQ`. Name it as a predicate — `is_active`, `has_collided`. When the
individual bits carry separate meanings, that is an enum: define it with
`r2000_create_project_enum` (`$01 = ACTIVE`, `$02 = COLLIDED`, `$04 =
VISIBLE`) and apply it with `r2000_apply_enum_usage` so every bitmask test
reads as words rather than hex.

**A counter or index?** `INC`/`DEC` inside a loop, compared against a limit
with `CPX`/`CPY`/`CMP`. `loop_idx`, `sprite_count`, `delay_timer`.

**A state variable?** Several distinct values, often feeding a dispatch
(`ASL` / `TAX` / `JMP (table,X)`). Name it `game_state` or `current_mode` — and
these are the best enum candidates of all. Look for an existing enum first;
define one (`0 = INIT`, `1 = TITLE`, `2 = GAMEPLAY`, `3 = GAME_OVER`) with a
real `description` if none matches, then apply it to every instruction reading
or writing the variable.

### 4. Name it

| Symbol kind | Convention | Example |
|---|---|---|
| Zero-page variable | `zp_` prefix | `zp_player_lives`, `zp_delay_timer` |
| Zero-page pointer | `zp_ptr_` prefix | `zp_ptr_screen`, `zp_ptr_dest` |
| RAM variable | `snake_case` | `score_hi`, `current_level` |
| Pointer / vector | `ptr_` / `vec_` prefix | `ptr_screen`, `vec_irq` |
| Hardware register | `UPPER_SNAKE` | `VIC_SPR0_X`, `SID_FREQ_LO1` |
| Constant / address | `UPPER_SNAKE` | `SCREEN_RAM`, `CHR_ROM_BASE` |
| Routine entry point | `snake_case` | `init_screen`, `draw_sprite` |
| External ROM call | `KERNAL_` / `OS_` | `KERNAL_CHROUT`, `KERNAL_CLRCHN` |

> **The zero-page rule overrides all of the above.** An address at or below
> `$FF` **must** carry the `zp_` prefix — a zero-page pointer becomes
> `zp_ptr_`, a zero-page flag becomes `zp_is_active`, and a zero-page OS
> variable becomes `zp_`-prefixed too. The prefix makes the addressing mode
> visible at every use site, which is the whole point.

Apply it with `r2000_set_label_name`.

### 5. Document it

- `r2000_set_comment` `"line"` at the definition: the range it occupies, its
  purpose, its bitfield layout if it has one.
- `r2000_set_comment` `"side"` at the interesting *uses*: why this read, why
  this write. "Reset life counter" beside a `STA` is worth more than any name.
- Define and apply enums where the values form a set (above).

**The pointer-formatting step this project does not have.** Where a pointer is
initialised by immediate loads of a target's low and high bytes — `LDA #<target
/ STA ptr / LDA #>target / STA ptr+1` — upstream calls `set_immediate_format`
twice to turn both immediates into a single readable symbol reference. **That
call is not exposed on this project's surface.** `BUILD-03` ("every branch,
`JSR`/`JMP` and data reference goes through a symbol, so code can move") is the
requirement that supplies its criterion, and the per-call disposition is
recorded in the manifest named in the attribution header above. Until then,
reconstruct the target by hand and put it in a side comment on both
instructions — `; low byte of ptr_sprite_table ($C240)` — so the pointer is
still readable even though the store cannot format it.

### 6. Report

- **Address** and its current label.
- **Classification**: flag, counter, pointer, hardware register, state
  variable, dead.
- **Evidence**: the specific cross-references or usage patterns that decided
  it. A classification with no evidence line is a guess wearing a name.
- **Actions taken**: what was renamed, what was commented, which enums were
  defined or applied.
- **Uncertainty**: if `r2000_get_cross_references` returned nothing, say which
  of the three explanations in step 2 you could and could not rule out.

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
