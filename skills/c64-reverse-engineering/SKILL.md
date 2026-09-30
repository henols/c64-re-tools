---
name: c64-reverse-engineering
description: The method to take an unknown C64 program apart, in a set order, from its scope to a fully documented program. Use when asked to reverse engineer a C64 game or program, or where to start on an unknown or depacked program. Also use it to find where the main loop, entry point, IRQ handler or game state machine is. Also use it to decide which regions are code and which are data, or to document a routine. Also use it to name a program's variables and routines, or to annotate every remaining undocumented routine.
---

# Reverse engineering an unknown C64 program

**Do not disassemble the whole program first.** The structure hangs off a small set of well-known
addresses. Read them in order and the answer falls out. Treated as a search problem, it costs an
hour every session. Written down, it is minutes.

Build a network of checked facts. Once you know the vectors, the IRQ handler, the main loop and
the major tables, everything else classifies far more easily.

This skill is the method only. Every tool step names the skill that does it. Go there for the
call, then come back here for what the answer means.

## Before step 1

Get the program's bytes into a form you can read. Each of these is a different skill's job:

- A file still inside a `.d64` image: extract it with `c64-disk`.
- A tokenized BASIC stub rather than machine code: detokenize it and read the `SYS` handover with
  `c64-basic`.
- A packed image: check and depack it with `c64-unpacker` before step 1. Every label you write on
  a packed image is lost when you recover the real image.

## The order

Each step is a read whose answer rules something out. Do not skip ahead. Step 6 is cheap once you
know the handler, because that is where most chip writes happen.

| # | Question | Read | What the answer settles |
|---|---|---|---|
| 0 | Which of these bytes are even the game? | The capture's buckets, from `c64-provenance` | Tracing a depacker's IRQ handler wastes work. Scope before you trace |
| 1 | Where does execution start? | Post-depack: wherever the PC sits at the decrunch checkpoint. There is no BASIC stub to find | The one address everything else hangs off |
| 2 | Which vector is live? | `$01`, then `$0314/$0315` **or** `$FFFE/$FFFF` | HIRAM (`$01` bit 1) decides. KERNAL out ⇒ the RAM vectors are meaningless |
| 3 | What drives the frame? | `$D01A`, `$D012`, `$DC0D` | `$DC0D` untouched ⇒ raster IRQ. Programmed ⇒ the game runs its own timebase |
| 4 | Where is the main loop? | Checkpoint a suspected loop head, run one frame | Two shapes only: a real loop, or a two-instruction spin with the IRQ doing everything |
| 5 | Code or data? | What the PC actually visits across full coverage | A range never executed is data, whatever a tracer guessed |
| 6 | Where is the graphics? | `$DD00` → `$D018` → mode bits → `$D015` → VM+`$03F8` | Every byte shown on screen, computed. Nothing to search for |
| 7 | Where is the music? | Watch `$D404` | `init` runs once from main code. `play` runs once per frame from the IRQ |
| 8 | Where is the input? | Reads of `$DC00`/`$DC01` | Games poll the matrix directly and ignore the KERNAL buffer |

Read live values (memory, registers, chip state, checkpoints, watches) with `c64-emulator`.
Before you drive the emulator, read its
[references/observation-hazards.md](../c64-emulator/references/observation-hazards.md). Chip state
has its own pages there:
[references/graphics.md](../c64-emulator/references/graphics.md) and
[references/sound-and-input.md](../c64-emulator/references/sound-and-input.md). Turn register
values into addresses (the live vector pair, VIC bank, screen, charset, sprite pointers) with
`c64-memory-map`'s `derive.ts`.

- Steps 1-5 in depth, including the state machine:
  [references/control-flow.md](references/control-flow.md).
- Steps 3 and 6-8 in depth (timebase, graphics, sound, input), with the watch targets that find
  each routine: [references/finding-subsystems.md](references/finding-subsystems.md).

## Step 0 in full: only the game is in scope

Every image taken from a cracked release carries three layers that are **not the game**, and no
original master exists to strip them for you:

| Layer | What it is | Dead when |
|---|---|---|
| **loader** | The custom raw-sector routine that bypasses the KERNAL | The payload is in RAM |
| **cruncher / depacker** | The decompression stub | It has run once |
| **cracktro** | The group's intro, scroller, credits, and the keypress gate that dismisses it | Dismissed |

**The rule: a byte with nothing to do with the game is out of scope — always, not case by case.**
It is not annotated, not reconstructed, and not traced. This is a standing default, not a
per-session decision.

**The evidence bar runs both ways, and this project failed in both directions.**

- Removal needs *positive* evidence of the bucket: a crack-credit vocabulary match, a
  `RELEASES.json` `loader_ranges` entry earned from live disassembly, or a depacker stub provably
  dead after first run. A bare printable-ASCII scan classified **the game's own title text** as
  cracktro credit and would have shipped a confidently-wrong `CRACKER-PATCH` verdict.
- Absence of evidence records `UNKNOWN` and **keeps the bytes**. One real title-screen text
  divergence sat in a region that is neither loader nor cracktro — a cracker edit inside
  the game's own data. Stripping only the obvious intro screen leaves crack residue behind.

`c64-provenance` owns the bucketing and its five kinds. What belongs here is the ordering:
**bucket first, then trace only what survives.**

Then work **backwards from observable effects** rather than reading code sequentially. It is
consistently faster. Watch writes to the sprite coordinates to find movement. Watch `$D018` to find
the room loader. Watch VM+`$03F8` to find the animation driver. A write watchpoint finds the
*writers*, and that is its real leverage. The full list of watch targets is in
[references/finding-subsystems.md](references/finding-subsystems.md).

Differential experiments close the loop: patch a routine to `RTS` and see what stops. If enemies
freeze and nothing else does, that checks the routine's purpose. It is far stronger evidence than
reading the listing.

## Worked example: a real capture

`c64-memory-map`'s `derive.ts vectors` over a captured image printed this:

```
$01 = $40 %01000000
  bit 0 LORAM  = 0  BASIC ROM  out (RAM at $A000-$BFFF)
  bit 1 HIRAM  = 0  KERNAL ROM out (RAM at $E000-$FFFF)
  bit 2 CHAREN = 0  character ROM at $D000-$DFFF

LIVE VECTOR PAIR: $FFFE/$FFFF (KERNAL banked OUT — the hardware vectors are live)
CBM80 SIGNATURE:  absent — nothing catches a reset here

## KERNAL IRQ/BRK/NMI ($0314-$0319)
   DORMANT: KERNAL ROM banked out — nothing maintains these. Read it, do not act on it.
vector        value   default   status
$0314/$0315  $0101   $EA31   *** RETARGETED ***
              CINV  — KERNAL IRQ (RAM, indirect)
…
## Hardware vectors ($FFFA-$FFFF) — live when the KERNAL is banked out
$FFFA/$FFFB  $1116     --     no default
$FFFC/$FFFD  $1116     --     no default
$FFFE/$FFFF  $1103     --     no default

Non-default bytes in DORMANT blocks: 17. These are NOT diverted
vectors. …
```

Read it as: the KERNAL is banked out, so the whole `$0300-$0333` range is **dormant** and `$0314`'s
`$0101` is residue, not a retargeted vector. Ignore it. The live handler is `$1103`, and that is
where to arm the first checkpoint. `$FFFA` and `$FFFC` both holding `$1116` says the game installs
its own NMI *and* RESET handlers, at one shared address.

Both cracked releases give the same answers across all three of their captures. `$1103` is the
same IRQ entry that earlier live work established independently (chain `$1103 → $1574 → $152C`).
The method reproduced a known-good result from a static image with no emulator running. The
`$1116` pair was new. See [references/control-flow.md](references/control-flow.md) § 2.

## Documenting one routine, end to end

The order above finds *where* the structure is. This section is what you do after you pick
one routine and want it documented properly. It handles **one routine, at one explicit address**.
Draining every undocumented routine in a project is
[references/backlog-to-closure.md](references/backlog-to-closure.md), which runs this procedure
once per queue entry. Every read and write below goes through `c64-annotations`.

### 1. Context first

Read the program's binary info: `system`, `filename`, `description` and
`may_contain_undocumented_opcodes`.

- `system` names the target machine and therefore which memory map, hardware registers and ROM
  entry points are in play.
- `filename` and `description` identify the software. This is how you recognise a stock component
  instead of re-deriving it — a Hubbard-style music driver, an Exomizer decrunch stub — and how
  genre informs a guess (`check_collision` is a plausible routine in a shooter).
- With `may_contain_undocumented_opcodes: true`, expect `LAX`, `SAX`, `SLO`, `DCP`, `ISC`. These
  are real instructions, not disassembly errors. Do not stop reading at one.

### 2. Bounds, from an explicit address

**Always start from an address that someone gave you or that you derived**, `$XXXX` or its decimal equivalent.
There is no editor cursor to rely on.

Find the start (the entry point or its label) and the end (`RTS`, `RTI`, or a `JMP`). Two shapes
to expect:

- A routine ending in `JMP shared_epilogue` still **ends there**. That is a tail call, and the
  target's body is a different routine.
- A routine with no return at all may **fall through** into the next one. Use the
  cross-references and the flow to decide where the boundary is, and say in the comment that it
  falls through.

### 3. Read the range

Read the routine's explicit range as disassembly. One region read is size-capped. Read a longer
routine (rare, but real in a decruncher or a level builder) as **consecutive ranges**, in order.
Never ask for a wider read to swallow the whole program: the cap is what keeps "read this routine"
from becoming a whole-program export.

Then read the flow, not just the instructions:

- Does it loop? Where does the loop stop?
- Does it call other routines, or ROM entry points?
- Does it touch hardware registers?

Recurring shapes worth recognising on sight:

| Pattern | Almost always |
|---|---|
| `SEI` … `CLI` bracketing | IRQ setup or teardown |
| `LDA`/`STA` with `DEX`/`DEY`/`BNE` | Memory copy or fill |
| Bit shifts plus `ADC`/`SBC` chains | Maths, or a decompressor |
| Reads an I/O address then branches | Hardware polling |
| Writes to `$0314`/`$FFFE` | Interrupt vector installation |
| Writes to `$D400`–`$D418` | Music or SFX driver tick |
| Reads `$DC00`/`$DC01` | Joystick or keyboard polling |

### 4. Who calls it

Get the cross-references to the entry point. The caller is often more decisive than the body:

- Called from an init block → a setup routine, runs once.
- Called from the main loop → a per-frame update.
- Called from the IRQ → must be fast. Likely a music tick or a raster update, and its zero-page
  usage is IRQ-relative.
- **No callers at all** → not necessarily dead. It may be a dispatch target reached through a jump
  table. Check the nearby data blocks for an address table pointing at it.

### 5. What data it touches

For every address the routine reads or writes:

1. Look it up with `c64-memory-map` first. It answers a hardware register or KERNAL entry point
   outright and needs no further work.
2. Otherwise get that address's cross-references, and read the shape:
   - Written once, in init → a constant or a config value.
   - Written *and* read by several routines → shared state, a global.
   - In the zero page and used as `($addr),Y` → an indirect pointer.
3. **Enums.** If the accessed addresses or the immediate values form a logical set — state
   constants, joystick direction bits, colour codes — look for an existing project, global or
   system enum that matches, and apply it at the accessing instruction. If none matches but the
   set is clean, define one with a real description, then apply it everywhere it fits. This is
   what turns `lda #$1b` into something a reader understands.

**A pointer set up by an immediate pair.** A routine that sets up a pointer or a vector does it
with two immediate loads: `LDA #<target / STA ptr`, `LDA #>target / STA ptr+1`. The annotation
project cannot render that pair as one symbol reference. Recombine the two bytes yourself and put
the reconstructed target in a side comment on both instructions, so the setup reads as one
pointer. The rule behind this is that every branch, `JSR`/`JMP` and data reference goes through a
symbol, so code can move.

### 6. Synthesise, then document

Four things, and they are the four things the comment block carries: **purpose** (one sentence),
**inputs** (registers and memory used as arguments), **outputs** (registers and memory modified),
**side effects** (hardware, screen, sound).

Rename the label (see [Naming a symbol](#naming-a-symbol)), then put a multi-line line comment
above the first instruction, in this exact shape. The separator is both the first and the last
line:

```
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
<what the routine does>

Inputs:  <registers or memory used as arguments, or "None">
Outputs: <registers or memory modified, or "None">
Side Effects: <hardware changes, screen updates, etc., or "None">
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
```

Then add side comments to the instructions that carry the meaning: what a register holds here,
why this branch is taken, what this address represents. This is the part that makes the listing
readable for the next person, and it is the part most often skipped. Grade each evidence comment
with the confidence prefix `c64-annotations` defines.

### 7. Report

- **Purpose** in one sentence.
- **Inputs / outputs / side effects** as determined above.
- **Evidence**: the instructions or cross-references that decided it.
- **Actions taken**: what you renamed, which line comment you added, which instructions got side
  comments, which enums you defined or applied.
- **Uncertain areas**: every instruction or address whose purpose is still unclear, by address. A
  routine report with no uncertain areas on a real game is usually a report that stopped looking.

### What goes wrong

| Symptom | What it actually is |
|---|---|
| No `RTS`/`JMP`/`RTI` at the apparent end | Deliberate fall-through. Check whether the next label is independently called. |
| `JMP some_routine` as the last instruction | A tail call. This routine ends there. The target is a separate routine. |
| Several routines converging on one `RTS` | A shared epilogue. It belongs to none of them. Note it in each comment. |
| No callers, but the routine is clearly live | Reached through a jump table. Look for an address table pointing at it. |
| Disassembly appears to break mid-routine | Undocumented opcodes. Check the binary-info hint and keep reading. |
| Zero-page usage contradicts the main program's | The routine runs from the IRQ. Its context is IRQ-relative. |

## Classifying every region

Given a program image, decide what each region is: code, or one of the kinds of data. Everything
not yet traced as code is **Undefined**: not "data", just unexplored. The job is to walk the
Undefined regions, find what each one is, and record it.

**The live answer beats the static one.** Step 5 of the order — what the PC actually visits across
full coverage — beats every static heuristic here. Run the live pass when you have a running
machine. Classify statically when all you have is a file, and let a later trace overrule it.

**Never type a region as code without concrete proof that it executes.** Random data routinely
disassembles into plausible-looking instruction sequences. That is a property of the 6502's dense
opcode map, not evidence of code. A region earns the Code type only when at least one of these
holds:

- **It is a `JSR`/`JMP` target**: already-analysed code contains `JSR $addr` or `JMP $addr`
  landing in it.
- **It is a branch target** of an already-analysed `BNE`/`BEQ`/`BCC`/`BCS`/`BPL`/`BMI`/`BVC`/`BVS`.
- **It is a vector or handler**: its address appears in a vector table (`$FFFA`–`$FFFF`,
  `$0314`–`$0319`), in an address or split-address table, or in a jump table reached by
  `JMP ($addr)`.
- **A human says so explicitly.**

None of those? Leave it Undefined, or classify it as data, even when the bytes disassemble
cleanly. "It looked like code" is how a sprite sheet becomes four hundred lines of fiction.

Work the Undefined regions in four passes, in this order. Do not interleave them. Each pass makes
the next one cheaper.

1. **Provably-reachable code.** Read from the entry point of each region that meets the proof bar,
   then record as code only the range you actually followed: to its `RTS`/`RTI`/`JMP`, not "to the
   end of the region". Reading does not classify. The boundary you record is the one you read and
   judged.
2. **Text**: PETSCII and screencode strings.
3. **Tables**: byte, word, address and split (lo/hi, hi/lo) tables.
4. **Whatever is left**: decide data, or leave it Undefined for a human. **Never** speculatively
   disassemble in this pass. By definition nothing here met the proof bar.

How to read a region, how to recognise each kind of data, how to keep two adjacent tables apart,
and what the classification report must carry are in
[references/classifying-regions.md](references/classifying-regions.md).

## Naming a symbol

Looking an address up with `c64-memory-map` answers what a **published** address means: a hardware
register, a KERNAL entry point, an OS variable. This section is the other half: **what a program's
*own* address represents.** No table can say, because the program's code decided the meaning.

**Name from evidence.** A name is a claim about behaviour. A confident name that turns out wrong
costs more than an honest provisional one, because the next reader must un-learn it.

### 1. Target and context

- **Always start from an explicit address**, `$XXXX` or its decimal equivalent. Get everything
  already known about it in one read: its label, comments, block type and cross-references.
- `filename` and `description` from the binary info give a symbol a *domain* name — `lap_counter`
  in a racing game, `lives` in a platformer — instead of a generic one. With undocumented opcodes
  in play, remember that `LAX`, `SAX` and `DCP` have real read and write side effects that belong
  in the data-flow picture.

### 2. Gather the usage

Get every site that touches the address, and read the instruction at each site. The instruction is
the evidence:

- **Writes**: `STA`, `STX`, `STY`
- **Reads**: `LDA`, `LDX`, `LDY`, `BIT`, `CMP`, `CPX`, `CPY`, `ADC`, `SBC`
- **Read-modify-write**: `INC`, `DEC`, `ASL`, `LSR`, `ROL`, `ROR`

**Zero cross-references is a result, not a dead end.** Three explanations, in order of likelihood:

1. Code reaches it **indirectly**. Check whether it is in the zero page (`$00`–`$FF`) and whether
   nearby code uses `($addr),Y` or `($addr,X)`. An indirect pointer's *target* has no direct
   reference by construction.
2. It is a **well-known system address** that the cross-references do not cover. Look it up with
   `c64-memory-map`.
3. It is genuinely **dead**: an unused variable, or code no longer reached. Say so in the report
   rather than inventing a purpose.

### 3. Place it

**A hardware register?** If `c64-memory-map` names it, take the published name and the per-bit
breakdown with it. That reading rests on hardware and holds for any program.

**Inside a well-known global block?** Screen RAM (`$0400`–`$07E7`), colour RAM (`$D800`–`$DBFF`),
a sprite pointer at VM+`$03F8`. **Do not skip these as "obvious".** Name them systematically from
the base plus the offset, `SCREEN_ROW03_COL12`, so contiguous structures read as structures instead
of a field of auto-generated offsets.

**An external ROM or system routine?** An `e_` prefix, an address in KERNAL space
(`$E000`–`$FFFF`), or a standard shadow vector. `c64-memory-map` gives the routine's published
name. Rename to the conventional form: `$FFD2` becomes `KERNAL_CHROUT`, `$EA31` becomes
`SYSTEM_IRQ_HANDLER`.

**A 16-bit pointer?** Below `$0100`, and used with indirect-indexed `($xx),Y` or indexed-indirect
`($xx,X)`. Rename to the `ptr_`/`vec_` form and comment what it points *to*, which is the thing the
name cannot carry.

**A flag or bitmask?** Only ever `$00`/`$01` or `$00`/`$FF`. Tested with `BIT` or `LDA`/`BEQ`. Name
it as a predicate: `is_active`, `has_collided`. When the individual bits carry separate meanings,
that is an enum (`$01 = ACTIVE`, `$02 = COLLIDED`, `$04 = VISIBLE`). Apply it so every bitmask
test reads as words rather than hex.

**A counter or index?** `INC`/`DEC` inside a loop, compared against a limit with
`CPX`/`CPY`/`CMP`. `loop_idx`, `sprite_count`, `delay_timer`.

**A state variable?** Several distinct values, often feeding a dispatch (`ASL` / `TAX` /
`JMP (table,X)`). Name it `game_state` or `current_mode`. These are the best enum candidates of
all. Look for an existing enum first. Otherwise define one (`0 = INIT`, `1 = TITLE`,
`2 = GAMEPLAY`, `3 = GAME_OVER`) with a real description, then apply it to every instruction that
reads or writes the variable.

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

> **The zero-page rule overrides all of the above.** An address at or below `$FF` **must** carry
> the `zp_` prefix. A zero-page pointer becomes `zp_ptr_`, a zero-page flag becomes
> `zp_is_active`, and a zero-page OS variable is `zp_`-prefixed too. The prefix makes the
> addressing mode visible at every use site, which is the whole point.

**Provisional names carry their own uncertainty.** When the evidence suggests a purpose but does
not yet prove it, prefix `maybe_`. When there is no reliable interpretation yet, prefix
`unknown_`. Promote a name only after you check the behaviour: `s_43A2` → `maybe_update_player` →
`update_player_position`. Avoid `amazing_collision_routine`-style names entirely. They encode a
guess as a fact.

Write the name with `c64-annotations`.

### 5. Document it

- A line comment at the definition: the range it occupies, its purpose, its bitfield layout if it
  has one.
- Side comments at the interesting *uses*: why this read, why this write. "Reset life counter"
  beside a `STA` is worth more than any name.
- Define and apply enums where the values form a set (step 3).
- A pointer initialised by an immediate pair: reconstruct the target by hand and side-comment both
  instructions, for example `; low byte of ptr_sprite_table ($C240)` (see step 5 of documenting a
  routine).

### 6. Report

- **Address** and its current label.
- **Classification**: flag, counter, pointer, hardware register, state variable, dead.
- **Evidence**: the specific cross-references or usage patterns that decided it. A classification
  with no evidence line is a guess wearing a name.
- **Actions taken**: what you renamed, what you commented, which enums you defined or applied.
- **Uncertainty**: if the address had no cross-references, say which of the three explanations in
  step 2 you could and could not rule out.

## Working the backlog to closure

A pass that *looks* finished while a hundred auto-named labels are still nameless is the
expensive failure. Build the routine and symbol queues from data, work them one entry at a time,
and stop only when the completeness gate passes. The procedure is
[references/backlog-to-closure.md](references/backlog-to-closure.md).

## Rebuilding the program as source

Stand up a buildable tree early, include the unidentified bulk as binary, and replace regions with
real source as you prove them. The correctness bar is behavioural equivalence at checkpoints.
See [references/reconstruction.md](references/reconstruction.md).

## Failure shape

This skill has no script. Each step refuses in the tool or script that it
calls, and that refusal names the cause. A step that cannot prove its claim
ends as an open item in the backlog. It is never recorded as done.
`completeness-report.ts` gives the numeric stop condition. When it fails,
work on the address that it names.

## What this skill does NOT do

- Drive the emulator (memory, registers, checkpoints, watches, chip state, input, symbols, and
  every observation hazard): `c64-emulator`.
- Read, write, search or report on the annotation project, render the memory map, export source,
  or import a Ghidra export: `c64-annotations`.
- Say what a published address, KERNAL routine or register bit means, or decode register values
  into addresses: `c64-memory-map`.
- Disassemble a whole image with Ghidra or dxa: `c64-disassembler`.
- Detect or depack a packed image: `c64-unpacker`.
- Extract a file from a `.d64`: `c64-disk`.
- Detokenize BASIC or read a `SYS` handover: `c64-basic`.
- Capture or compare 64K RAM images: `c64-ram-capture`.
- Decide whether a byte is original or cracker-modified, or bucket loader, cracktro and game:
  `c64-provenance`.
- Assemble source: `c64-assembler`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `$0314` holds something that is not a plausible address | Check HIRAM (`$01` bit 1). With the KERNAL banked out, the RAM vectors are dormant residue. Read `$FFFE/$FFFF`. |
| A vector target lands in `$A000-$BFFF`, `$D000-$DFFF` or `$E000-$FFFF` | Unresolved until you read it in both banks. See [references/control-flow.md](references/control-flow.md) § 2. |
| No loop head repeats once per frame | The main loop is a two-instruction spin and the IRQ does everything. Go to the handler. |
| A region disassembles beautifully but has no incoming reference | Data. Decodability is not evidence. Leave it Undefined. |
| The routine queue is empty on a project nobody has named yet | You built it from label prefixes only. Build it from cross-references and code blocks first. See [references/backlog-to-closure.md](references/backlog-to-closure.md). |
| A pass reports "nothing left" while auto-named labels remain | A failed pass. List every leftover by address in the report. |
