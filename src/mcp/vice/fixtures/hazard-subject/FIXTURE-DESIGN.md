# The hazard-subject fixture: what it is, and why each construction is not the textbook one

A small synthetic Commodore 64 program built on purpose to carry four
constructions that block a piece of code or data from being moved, relocated
or rebased without silently breaking the program. It exists because a tool
that claims to find such constructions needs something real to be measured
against, and a fixture written by the same hand that wrote the detector is
the weakest possible test of that detector -- it can only ever confirm that
the two agree with each other, never that either one is right.

This document is that measurement's other half: for each of the four
constructions, which variant the program actually carries, what the
published, textbook version of that construction looks like, and why the
planted variant is deliberately something else. It also states plainly what
this program does NOT attempt to cover, so a reader can tell the difference
between a hazard this fixture leaves out on purpose and one nobody thought
of.

## Files

| File | What it contributes |
|---|---|
| `hazard-subject.a` | The root: the BASIC loader stub, the single machine-code entry point, and the `!source` lines that pull in every part below, in the order they were added. |
| `hazard-subject-smc.a` | The self-modifying-code construction, in two separate forms -- one the report finds, one it is built to miss. |
| `hazard-subject-dispatch.a` | The indexed-dispatch construction: a proven, non-canonical stack-return jump table, and a second, genuinely working dispatch a closed evidence gate correctly declines to promote. |
| `hazard-subject-align.a` | The page-alignment construction: a VIC-II hardware alignment dependency on a sprite shape and a character set, plus a level table and a music table. |
| `hazard-subject-align-misaligned.a` | A deliberately mis-aligned twin of the file above -- the same routine, differing in exactly two filler bytes, so the alignment class has a real, observable negative control rather than only a written claim. |
| `hazard-subject-raster.a` | The cycle-exact-raster construction, in its non-canonical, timer-based form. |
| `make-hazard-subject-fixtures.mjs` | The only writer of the two committed program images. Refuses rather than writing a partial fixture. |
| `hazard-subject.prg` | The assembled, committed program image. |
| `hazard-subject-misaligned.prg` | The assembled, committed mis-aligned twin image. |
| `hazard-subject.annostore.json` | The committed decomposition of the program image -- every byte typed, every routine scoped, every reference named -- that the multi-file export and reassembly path reads. |
| `make-hazard-subject-annostore.mjs` | The only writer of the committed decomposition above. |

## Provenance

Both committed images are real assembler output, never hand-written or
hand-edited bytes. `make-hazard-subject-fixtures.mjs` assembles the source
files above with a real ACME 0.97 ("Zem") and writes the result only after a
clean exit and a produced file; it refuses, rather than writing a partial
fixture, if the assembler cannot be found or the assembly fails. Running it
twice leaves nothing to commit -- the committed images are a pure function of
the committed sources, and a suite that re-runs it on every pass re-derives
both images from source and byte-compares them against what is committed, so
the two can never silently drift apart. The committed decomposition follows
the identical discipline: `make-hazard-subject-annostore.mjs` assembles the
program, reads the real assembler's own symbol table, and decomposes the
result into a fresh store through the same public write verbs any caller of
the annotation tools would use -- never raw, hand-written rows.

## Class 1: indexed dispatch (the "RTS-trick" idiom)

**The textbook idiom.** A split table of return addresses, stored as high
bytes in one array and low bytes in another, each entry pre-adjusted by minus
one. A short routine indexes both arrays with the SAME register, pushes the
high byte then the low byte, and executes a plain return instruction --
exploiting the fact that a return instruction resumes execution at the
popped address plus one, which is exactly why every table entry is written
one less than its real target. Every existing example this project's own
detector was proven against, before this subject existed, indexes both
arrays through the same one register, and the two tables sit contiguous with
the code that reads them.

**What this subject carries instead.** The two split address tables
(`dispatch_hi`, `dispatch_lo`) are declared in a source file separate from
the routine that consumes them (`hazard_dispatch_entry`, in the root file),
so the pairing between the tables and their reader crosses a real
source-file boundary rather than sitting inside one file. Both indexed
loads walk the Y register -- still one consistent register on both loads,
satisfying the accepted shape, but a register no example in this project's
own existing test corpus used before this subject was written. Beside it,
in the same file, sits a second, genuinely WORKING dispatch
(`dispatch_decline_entry`) built the identical way except that its two
loads walk two DIFFERENT registers, one through X and one through Y. That
second construction is not a hand-built non-example built to fail: every
byte of it really does reconstruct a target address and really does return
to it. It exists so a reader can see the evidence gate's accepted-shape list
decline a real, working construction, not merely a synthetic one built to be
declined.

**What the textbook idiom would have proven.** Only that the detector
recognises the one shape its own author already had in mind -- same register
on both loads, tables and reader in the same file. Planting the register
choice this project's prior fixtures never used, splitting the pairing
across a file boundary, and adding a real declining twin all test properties
the textbook idiom, planted unchanged, would never have exercised at all.

## Class 2: self-modifying code

**The textbook idiom.** A store or a read-modify-write instruction whose
target address is a later instruction's OPERAND byte -- an immediate value
or an address encoded in that instruction. The classic shape is an increment
or decrement that rewrites the operand of a nearby load, changing what VALUE
that load reads on its next execution.

**What this subject carries instead.** The first construction plants an
OPCODE-byte patch rather than an operand-byte patch: a short, self-terminating
loop writes the literal byte for a return instruction directly over another
instruction's own opcode position, so the second pass through the loop
executes a different INSTRUCTION altogether rather than the same instruction
with a different value. Relocating this routine by even one byte moves the
address the patch targets, and nothing about a disassembly listing of either
copy shows that the two have drifted apart -- the listings look identical;
only the running behaviour differs. The second construction goes further
still: it stores through a zero-page pointer built entirely at runtime from a
biased, compile-time-computed offset, reaching its target through
indirect-indexed addressing rather than a literal address encoded in the
instruction. No instruction anywhere in the assembled image carries the real
target address as an operand at all -- this construction is planted
specifically to have no static operand for a detector to find, and it is
recorded, not hidden: the committed decomposition carries a comment at the
instruction that would otherwise be misleadingly labelled, naming the byte
as declined rather than giving it a symbol no single value could honestly
carry, and the report's own emitted limits name the miss by describing this
exact shape.

**What the textbook idiom would have proven.** Only that a detector checking
"did a store land on an operand byte" finds exactly that shape. Planting an
opcode-byte patch tests whether the detector also recognises a control-flow
change, not merely a value change; planting the indirect-indexed store tests
-- and demonstrates -- the detector's own honestly-recorded blind spot, which
the textbook idiom by itself would never surface.

## Class 3: page-alignment dependence

**The textbook idiom.** The VIC-II chip never reads a sprite shape's or a
character set's address as an address at all -- it reads a small, scaled
INDEX. The sprite-pointer byte at a fixed screen-matrix offset names a
64-byte-aligned block within the current 16-kilobyte VIC-II bank; a field
inside the VIC-II's own memory-control register names a 2048-byte-aligned
block for the character set, within that same bank. The textbook dependency
is simply placing the sprite shape and the character set at addresses that
satisfy those two alignments and deriving the stored index FROM the data's
own address, so the two stay in agreement as long as nothing moves either
one independently of the other.

**What this subject carries instead.** Exactly that dependency, planted for
real rather than merely described: a sprite pointer and a character-set
selector both computed from their data's own labels, never written as bare
constants, alongside a level table and a music table that carry no alignment
requirement at all -- ordinary data the export path can extract without the
alignment question complicating it. What makes this subject's version of the
dependency interesting is not a different shape from the textbook one -- there
is no more exotic reading to plant here -- but a deliberately mis-aligned
TWIN, built by inserting exactly two one-byte fillers before the character
set and the sprite shape in an otherwise byte-for-byte identical copy of the
same routine. Because the pointer and the selector are computed FROM the data's
own label rather than hand-written, the mis-aligned build's arithmetic is
still individually correct -- it simply now names the wrong 64-byte or
2048-byte block, because the data moved one byte off the boundary that
arithmetic assumes. The assembler exits zero on this build. Nothing in it is
malformed 6502 or malformed source; the only thing that differs is what the
VIC-II hardware actually reads back at those indices, and that is visible
only on a real screen, with no error, exception or diagnostic anywhere in the
chain.

**What the textbook idiom, planted alone, would have proven.** Only that the
detector recognises a correctly-aligned dependency when it sees one -- which
says nothing about whether relocating the data without updating the
pointer, or relocating the data by an amount that breaks the alignment
silently, is a real, observable failure rather than a theoretical one. The
mis-aligned twin is what turns "this could break" into "this DOES break, and
here is what it looks like when it does."

**A note on what the detector for this class does and does not evaluate.**
Only VIC-II HARDWARE alignment is evaluated here -- the sprite pointer's
64-byte granularity and the character-set selector's 2048-byte granularity.
A different, real dependency exists where code or a table is aligned so that
an indexed memory access never crosses a 256-byte page, which changes
INSTRUCTION TIMING rather than which bytes the hardware reads; that reading
is a separate hazard this subject and its detector do not evaluate at all,
and it is named explicitly, not silently absorbed into this class, in the
section below on what this subject deliberately excludes.

**Amendment (2026-09-13): the two VIC-II dependencies this subject left
unstated, and what stating them cost.** The setup routine originally selected
the VIC-II bank through a read-modify-write on $dd00 (`lda $dd00` / `and` /
`ora` / `sta $dd00`, preserving whatever the CIA2 port A register already
held) and never wrote VIC-II control register 1 ($d011) at all. Both
omissions were invisible to the fixture's own claim, not merely to a casual
reading of it: `anno-graphics.ts`'s register recovery only ever accepts a
register value stated as an immediate load directly followed by its store --
a read-modify-write's result is a runtime fact about whatever the port held
at the moment the CPU actually ran it, not a static one, and a static report
correctly declines to guess it; a register never written at all carries no
value to recover in the first place. The consequence was structural, not
cosmetic: `deriveGraphicsRanges()` omits every range depending on a missing
register rather than defaulting it, so the character-set range this class's
whole dependency is ABOUT was never derived, and the block spanning the
alignment routine and its own padding reported as a region no detector could
decide either way -- not as a hazard ruled out, but as a hazard never
evaluated.

The setup routine now states both registers exactly the way the sprite
pointer and the character-set selector already did -- an immediate load,
directly followed by its store, so the value is present in the image bytes
rather than assembled at runtime from prior state. The bank-select write
became `lda #$3f` / `sta $dd00` (mirroring the same literal
`fixtures/ghidra/charset-phantom.a` already uses for an identical bank-0
selection); the control-register-1 write is new, `lda #$1b` / `sta $d011`
(the same fixture's own value, naming character mode with bit 5 clear).
Both are the SAME literal that fixture already commits to disk, not a value
invented for this subject.

**What was given up, stated as a cost and not as an improvement.** The
read-modify-write this subject used to carry existed to preserve the CIA2
port A bits it did not care about -- among them the serial-bus ATN, CLK and
DATA lines, both the output-enable and output-level bits for each. A bare
immediate store to $dd00 no longer preserves whatever this program's own
earlier serial-bus activity had left those bits at; $3f drives them to a
fixed state (all of bits #2-#7 set) regardless of what came before. That is
a real loss of behaviour, not a refinement of it, and it is recorded here
rather than left for a reader to discover by diffing the routine against its
own history. The detector's decision to decline a read-modify-write result
is correct, not a gap to route around: the register value it would have
recovered from this subject's OLD form was never a static fact in the first
place, and recovering "a value" from an operation whose result depends on
prior runtime state would have been indistinguishable from recovering the
wrong one.

## Class 4: cycle-exact raster code

**The textbook idiom.** A routine that must execute a specific block of code
starting at an exact CPU cycle relative to the video beam's position on
screen. The published stabiliser technique uses two chained interrupts: a
first raster interrupt at a known line sets up cycle-accurate entry to a
second interrupt one line later, and the routine re-reads the raster-line
register -- sometimes comparing it against itself -- to confirm the timing
landed where expected, then burns the small remaining jitter (0 to 7 cycles
of interrupt-entry variance) in a short run of no-operation instructions
immediately after that confirming read.

**What this subject carries instead.** A structurally different stabilising
mechanism, not a relabelling of the textbook one: the first CIA chip's own
hardware timer. The raster-compare register is armed exactly ONCE, from a
setup routine OUTSIDE the interrupt handler the hardware vector points at,
and is never read or re-armed again anywhere in this program. When that one
raster interrupt lands, the shared interrupt handler (both the raster
interrupt and the CIA timer's own interrupt vector through the same
RAM-resident handler, distinguished by a one-byte phase flag, since both
routes reach the CPU's one interrupt line) arms a one-shot reload on the
first CIA's own Timer A, chosen so that the SECOND interrupt -- the timer's,
not the raster line's -- lands at a fixed cycle offset into the following
line. No no-operation sled was added anywhere in this routine, even though
one would have made a second detection signal fire; padding a fixture with
idle cycles purely to satisfy a detector would be manufacturing evidence
rather than planting a real, honest construction, and the routine's own
header records the absence as a deliberate, verified fact rather than an
oversight.

**What the textbook idiom would have proven.** Only that a structural
detector recognises the ONE published shape its own author had most
directly in mind: a raster-register access inside a vectored interrupt
handler, immediately followed by a timing sled. This subject's timer-based
variant presents neither of those two signals at all -- only the timer
reload, written inside the vectored handler -- so it tests whether the
detector's third, independent signal is genuinely a separate, working
detection path rather than something that only ever fires alongside the
other two.

**What the detector for this class does and does not determine, stated
here in the same sentence as its capability.** No static algorithm for
cycle-exact raster detection exists anywhere, and this detector does not
pretend otherwise: it matches a structural SIGNATURE only -- a
raster-register access, a timing sled, or a timer reload, each inside a
routine an interrupt vector names -- and a match is never a claim that the
matched code actually achieves cycle-exact timing, nor a claim that it would
remain cycle-exact after being relocated. Moving this routine's start
address changes nothing about which opcode bytes it contains, but it CAN
change which of those bytes cross a 256-byte page boundary, which costs an
extra CPU cycle on an indexed-addressing access or a taken branch -- so a
routine whose entire purpose is landing on a specific cycle can become
silently wrong after a move that alters not one byte of its own body, and no
static check anywhere in this codebase determines whether that has happened.

## Why these four classes are structurally different, not one shape reskinned

Each class depends on a genuinely different mechanism, not a shared shape
wearing four different names:

- **Indexed dispatch** depends on a return ADDRESS assembled on the CPU's own
  stack from two separately-read table entries, then handed to a return
  instruction that resumes execution wherever that assembled address names.
- **Self-modifying code** depends on a WRITE landing inside another
  instruction's own bytes -- either its opcode or its operand -- so that
  instruction decodes differently the next time the CPU reaches it.
- **Page-alignment dependence** depends on a hardware register holding a
  SCALED INDEX into a fixed-size block, where the index and the data's real
  address must independently satisfy the same alignment for the hardware to
  read the right bytes.
- **Cycle-exact raster code** depends on a TIMING WINDOW between two
  interrupts landing at a specific, counted number of CPU cycles apart,
  independent of which particular bytes execute in that window.

A reader can check this claim directly rather than take it on faith: if two
of these four classes were really the same underlying construction wearing
different labels, the report's own findings for the subject's four planted
instances would show the same detection MECHANISM identifier appearing
under two different hazard classes. A test asserts that this never happens
anywhere in the whole subject.

## What this subject deliberately does not cover

Two real hazards are left out on purpose, recorded here as considered and
excluded rather than left to be discovered as omissions.

**The page-crossing timing reading of alignment.** A code or data table can
also be aligned so that an indexed memory access never crosses a 256-byte
page boundary, purely to avoid the extra CPU cycle such a crossing costs on
this processor. That is a real movement hazard -- relocating the table can
introduce a page crossing where none existed, silently changing timing with
no change to a single opcode byte -- but it changes INSTRUCTION TIMING, not
which bytes the hardware reads, which is a different failure mode from the
VIC-II hardware alignment this subject's class-3 construction actually
plants. Neither this subject nor its detector evaluates it.

**The self-modification the detector cannot see.** The second
self-modifying construction in this subject -- the indirect-indexed store
through a runtime-computed, biased zero-page pointer -- is planted
specifically so the class-2 detector misses it. It is present in the
committed image, undetected by design, and recorded rather than hidden: no
finding exists anywhere in the report at the address this construction
patches, and the report's own emitted limits name the exact shape of this
miss by description.

## What a weaker construction would not have proved

A subject built from four textbook idioms and nothing else would have shown
only that each detector recognises the one example its own author had most
directly in mind -- the exact failure mode a fixture and its detector,
written by the same hand in the same sitting, are most at risk of. It would
never have exercised a cross-file table pairing, a genuinely working
construction an evidence gate correctly declines, an opcode-byte rather than
an operand-byte patch, a hardware alignment dependency proven wrong on a real
mis-aligned twin rather than only asserted, a self-modification recorded as a
deliberate miss rather than quietly absent, or a raster stabiliser using an
entirely different piece of hardware than the textbook technique. Each of
those properties is what turns this subject from a mirror of its own
detectors into a real, independent test of them.

## On-screen observations

**Instrument.** Every capture in this section was taken in this pass against
genuine stock `/usr/bin/x64sc` (reports `x64sc (VICE 3.9)`, Debian package
`vice 3.9+dfsg-1`), launched as `timeout 180 /usr/bin/x64sc -default
[-autostartprgmode 1] -warp -limitcycles <N> [-autostart <file>]
-exitscreenshot <path>`, with `-default` first; a `-limitcycles` run that
terminates with process exit status 1 is the normal path, not a failure.
Two distinct autostart routes appear below: the DEFAULT route (the flag
omitted) and the WORKING route (`-autostartprgmode 1`) -- the difference
between them is exactly the subject of the correction this section now
carries. Every image and an evidence manifest recording each capture's md5,
byte size, exit status and full argv line live under this project's own
gitignored tool-written root; no captured PNG is committed here, because
nothing in this repository's automated suite renders or inspects a screen,
so a committed screenshot would be a binary artifact no check could
regenerate or falsify -- the md5 plus the argv line is the regenerable
residue instead.

The positive control -- booting with no `-autostart` at all (capture
`p2-positive-control`, md5 `3f91057a6e973bd21b1ae0c177ca7bc5`) -- was opened
and visually inspected: a readable, ordinary BASIC start-up screen, `****
COMMODORE 64 BASIC V2 ****` / `READY.` in the default colours with a
blinking cursor. This establishes that the rig renders and captures a real,
inspectable screen, by inspection rather than by file size alone.

Investigating rather than stopping at an early equality found the actual
cause. Every DEFAULT-route `-autostart` invocation taken in this pass --
against the aligned build, the mis-aligned build, and an unrelated
committed program (`petcat`'s `computed-sys.prg`) -- failed identically at
the emulator level (captures `p2-default-aligned`, `p2-default-misaligned`
and `p2-default-control`, all md5 `e7e70b082a4a6ec247e66bfa8e0c128a`),
logging `AUTOSTART: Loading PRG file '<path>' with autostart disk image.`,
`AUTOSTART: Error - No idea what disk image format to use.`, `AUTOSTART:
Error - '<path>' is not a valid file.` and `Error - Failed to autostart
'<path>'`. The DEFAULT route's own log line names the mechanism it is
trying and failing at -- "with autostart disk image" -- and this build's
own `-help` output enumerates that same route as mode 2 of
`-autostartprgmode` (`Set autostart mode for PRG files (0: VirtualFS, 1:
Inject, 2: Disk image)`), confirming this is a MODE DEFAULT, not an absence
of loading capability. This installation has no disk-image infrastructure
configured for that mode, so the mode fails the same way regardless of
which file is named.

A working route exists and loads this program: `-autostartprgmode 1`,
direct RAM injection. Capture `p2-work-aligned`'s own log records
`AUTOSTART: Loading PRG file '<path>' with direct RAM injection.` followed
by `AUTOSTART: Injecting program data at $0801 (size $08e7)` and
`AUTOSTART: Starting program.` -- an unambiguous injection and run, not a
failed attempt; the identical injection line, at the identical address and
size, appears in the mis-aligned and control builds' own logs taken through
the same route. Without this log line the correction would itself be an
assumption, which is the failure being corrected.

Checked directly in this pass rather than assumed: `-autostartprgmode` is
NOT absent from this build's own `-help` output. `/usr/bin/x64sc -help`
(full stdout captured, 1828 lines, exit status 0) lists `-autostartprgmode
<Mode>` with its three modes spelled out verbatim, on this genuine stock
build. A prior assumption that the flag was missing from `-help` on this
build did not survive this pass's own check; recorded here as measured, so
a future reader who greps this build's help text for the flag finds it
rather than concluding it does not exist.

The drive-configuration explanation this section previously offered for
the DEFAULT route's failure is retired: the plain 1541 ROM this
installation's default drive type actually wants (`Drive8Type=0`) is
present (`1541-c000.325302-01.bin` and `1541-e000.901229-05.bin` under this
user's VICE data directory), and every DEFAULT-route capture's own log
complains only about the 1540, 1541-II, 1570, 1571, 1581, 2000, 4000,
CMDHD, 2031, 2040, 3040, 4040, 1001/8050/8250 and D9090/9060 drive ROMs --
never about the plain 1541 -- so an absent drive ROM was never a sound
explanation for what these captures show. This is a correction of the
record: the mechanism was the mode default, not the drive configuration.

A second, independent attempt to load and run the aligned build through the
binary monitor's own `AUTOSTART` wire command, rather than the CLI flag,
refused with the same failure (monitor error code `0x8f`); a first attempt
to combine the CLI flag with the binary monitor found the CLI autostart
failure itself terminates the whole emulator process, closing the monitor
port before any session was possible. Both of these are observations of
the DEFAULT-mode route specifically -- the working route was never put
through the binary monitor in either pass -- and no longer read as evidence
about loading capability in general.

**ALIGNED build (`hazard-subject.prg`).**

PREDICTION, from the amended source: a recognisable sprite in its intended
solid shape, driven by a sprite pointer computed from the sprite data's own
label; a recognisable custom glyph drawn from a custom character set now
selected through an immediate load of `$1b` into VIC-II control register 1
(`$d011`), alongside the VIC-II bank now selected through an immediate load
of `$3f` into CIA2 port A (`$dd00`) -- the two registers the amendment
described earlier in this document made statically visible; a horizontal
colour split drawn by the timer-stabilised raster routine; and the border
colour differing from the default as the self-modifying routine runs.

OBSERVATION: DEFAULT-route capture `p2-default-aligned` (md5
`e7e70b082a4a6ec247e66bfa8e0c128a`) is a uniformly black frame -- per the
cause established above, this is read as the program never having been
loaded to attempt rendering anything, not as evidence about the four
predicted effects one way or the other. WORKING-route capture
`p2-work-aligned` (md5 `e9578287a77c2337fee0c73a63be2fe6`, taken via
`-autostartprgmode 1 -limitcycles 20000000`), through which the program
genuinely ran (per the injection log line above), shows the ordinary
settled BASIC `READY.` prompt in default colours -- no sprite, no custom
glyph, no colour split, and no border difference from default anywhere in
the frame. None of the four predicted effects is visible in this capture.
This is the same reversion this document's superseded observations already
recorded for the isolated builds, now confirmed through a route that
actually ran the program rather than one that never loaded it.

**MIS-ALIGNED build (`hazard-subject-misaligned.prg`).**

PREDICTION, from the amended source: the same program, running the same
way -- same split, same border behaviour -- but with the sprite garbled or
wrongly shaped, and the custom-set characters garbled, because the hardware
reads from the address the scaled pointers name rather than from where the
data actually sits.

OBSERVATION: DEFAULT-route capture `p2-default-misaligned` (md5
`e7e70b082a4a6ec247e66bfa8e0c128a` -- identical to the aligned build's own
default-route capture) is the same uniformly black frame, for the same
reason: the program was never loaded. WORKING-route capture
`p2-work-misaligned` (md5 `e9578287a77c2337fee0c73a63be2fe6` -- identical
to the aligned build's own working-route capture, taken at the same
`-limitcycles 20000000`) shows the identical settled `READY.` prompt, no
sprite, no custom glyph, no colour split, no border difference. The two
builds agreeing here, through a route that genuinely ran both, is not
evidence that the mis-alignment failed to land or that it did -- the
settled screen this route captures is program-blind by construction (see
the restated conclusion below), so it never had a chance to show the
difference the mis-aligned twin's own source predicts. The mis-aligned
twin's own byte-level proof, that its sprite and character-set base
addresses are provably not multiples of their required boundaries checked
against the actual assembled image, remains established independently in
this fixture's own test file (`hazard-subject-fixture.test.ts`) and never
rested on a screen capture alone; nothing in this pass changes that.

**The surviving conclusion, restated on this run's own evidence.** Through
the WORKING route -- the one that actually loads and runs a program -- the
hazard subject and an unrelated committed program produced byte-identical
captures at 20,000,000 cycles (`p2-work-aligned`, `p2-work-misaligned` and
`p2-work-control`, all md5 `e9578287a77c2337fee0c73a63be2fe6`), at
6,000,000 cycles (`p2-mid-6000000-aligned`, `p2-mid-6000000-control` and
`p2-mid-6000000-misaligned`, all md5 `5b86f08792a5480d320dc6d802aca633`),
and at 2,000,000 cycles (`p2-mid-2000000-aligned` and
`p2-mid-2000000-control`, both md5 `e7e70b082a4a6ec247e66bfa8e0c128a`). At a
fourth cycle count tried, 12,000,000, the aligned build (md5
`e9578287a77c2337fee0c73a63be2fe6`) and the control (md5
`5b86f08792a5480d320dc6d802aca633`) differ -- but visual inspection of both
frames side by side shows the identical settled `READY.` prompt in both,
with no sprite, no custom glyph, no colour split and no border change in
either; the sole pixel difference is whether the blinking text cursor is
drawn at that instant, because the two unrelated programs return control to
BASIC after a different number of cycles. That is a cursor-blink-phase
artefact of when each program finishes running, not a rendering of any of
the four predicted effects, and not a per-program on-screen difference this
fixture's predictions are about.

The md5 varying across cycle counts for a single build --
`e7e70b082a4a6ec247e66bfa8e0c128a` at 2,000,000, then
`5b86f08792a5480d320dc6d802aca633` at 6,000,000, then
`e9578287a77c2337fee0c73a63be2fe6` at 12,000,000 and 20,000,000 -- is what
proves the capture moment genuinely moved across this pass; that the
subject and the control never differ from each other in a way that
reflects the four predicted effects at any of the moments tried is the
separate fact that carries the conclusion. Keeping the two apart matters:
the first shows the instrument samples different points in time; the
second shows none of those points, on this route, ever renders a
per-program difference this fixture's predictions are about.

The honest reading goes no further than this. A capture taken after a
program has returned to BASIC shows the settled BASIC screen, which is the
same screen for any program that returns -- so a settled-screen capture is
program-blind BY CONSTRUCTION, not by accident. Whether some mid-execution
capture, at some cycle count not tried here, could catch the four predicted
effects before they revert or before the program returns, was probed at
four distinct cycle counts and did not turn up such a capture; that is a
bounded negative result, not a proof that no such capture exists. This
capture route licenses no per-program on-screen claim about this subject --
for a construction reason now measured directly, rather than because the
route never loaded anything.

**Post-amendment versus pre-amendment, as measured.** The pre-amendment
aligned and mis-aligned images -- extracted from commit `758d7df6` into the
session scratchpad, source md5s `aa5dac7abde9c544ae1f0f54a6f7533e` and
`df74e46627b83ace861c93076683b1d8` respectively, each distinct from the
post-amendment committed images' own bytes -- were pushed through the
identical WORKING-route harness (`-autostartprgmode 1 -limitcycles
20000000`) used for the post-amendment aligned and mis-aligned builds
above. `p2-pre-aligned` produced md5 `5b86f08792a5480d320dc6d802aca633` and
`p2-pre-misaligned` produced md5 `e9578287a77c2337fee0c73a63be2fe6` -- the
SAME two values already seen among the post-amendment captures above, for
the identical cursor-blink-phase reason: both settle to the ordinary
`READY.` prompt, differing only in whether the cursor is drawn at that
instant. Given the conclusion above -- that a settled screen through this
route is program-blind by construction -- this comparison is still worth
little as evidence that the amendment left on-screen behaviour unchanged,
but now for the stated construction reason rather than because nothing
loaded.

The isolated single-construction builds described in the superseded
observations below -- the self-modifying routine and the alignment routine
built and run alone, without the raster construction -- were NOT rebuilt or
re-run in this pass. Nothing below should be mistaken for a fresh
measurement of those isolated builds.

**Further screen-capture investment on this fixture is not recommended.**
The route is program-blind by construction at a settled screen, as
established above; and this fixture's alignment claims rest on byte-level
assertions in `hazard-subject-fixture.test.ts`, which never depended on a
screen and are not weakened by anything in this section.

### Superseded observations (pre-amendment bytes, commit `758d7df6`)

The two observations below were recorded before the two-register amendment
described earlier in this document was made. Commit `758d7df6` is the last
commit carrying the un-amended bytes of `hazard-subject.prg` and
`hazard-subject-misaligned.prg`; both committed images were regenerated when
the amendment landed, so these observations describe bytes that are no
longer what is committed. They are preserved verbatim, exactly as first
recorded, as history rather than as a current claim about the images
committed today.

**ALIGNED build (`hazard-subject.prg`), pre-amendment.**

PREDICTION: a recognisable sprite in its intended solid shape; a recognisable
custom glyph drawn from the custom character set; a horizontal colour split
drawn by the timer-stabilised raster routine; and the border colour differing
from the default as the self-modifying routine runs.

OBSERVATION: the settled screen shows the ordinary BASIC start-up display --
`READY.` in the default colours -- with none of the four predicted effects
present. This is recorded as found, not reconciled with the prediction.
Isolating each construction narrows exactly how far the disagreement reaches:
built and run alone (no raster construction present), the self-modifying
routine's border write and the alignment routine's sprite enable, position and
pointer all take effect and are directly visible on a real screen -- a solid
sprite renders exactly where the code places it, and the border colour
changes and stays changed. The moment the timer-stabilised raster construction
is added back in, every one of those effects reverts to its default before a
settled screen can be captured: the shared interrupt vector this construction
installs, and the VIC-II/CIA state around it, is found reset by the time
execution reaches a stable point, even when the machine-code entry never
returns control to BASIC at all (tested directly: an entry point ending in an
unconditional jump to itself, never an `rts`, shows the identical reversion).
That rules out "returning to BASIC undoes the vector" as the explanation; the
precise trigger was not pinned down further. What is established, and
recorded here plainly rather than smoothed over, is that the reversion is
reproducible, is not present without the raster construction, and prevents
capturing a single settled screen where all four predicted effects are
visible together on the real, committed image.

**MIS-ALIGNED build (`hazard-subject-misaligned.prg`), pre-amendment.**

PREDICTION: the same program, running the same way -- same split, same
border behaviour -- but with the sprite garbled or wrongly shaped, and the
custom-set characters garbled, because the hardware reads from the address
the scaled pointers name rather than from where the data actually sits.

OBSERVATION: the settled screen shows the same ordinary BASIC start-up
display as the aligned build, indistinguishable from it in this capture --
for the identical reason recorded above: the reversion happens before the
alignment dependency's own effect can be read off a settled screen for this
build either. The two captures agreeing here is therefore not evidence that
the mis-alignment failed to land; isolating the alignment construction alone
(no raster) shows a real, direct effect on the aligned side (the solid sprite
block referenced above), and the mis-aligned twin's own byte-level proof --
that its sprite and character-set base addresses are provably not
multiples of their required boundaries, checked against the actual assembled
image -- is already established independently in this fixture's own test
file, never resting on a screen capture alone.

**What no automated check in this repository can establish.** Whether the
VIC-II hardware actually reads the wrong 64-byte or 2048-byte block on the
mis-aligned build, and shows a garbled sprite or character as a result, is a
claim about what a real screen looks like, and nothing in this repository's
automated suite renders a screen and inspects it. The assembler exits zero on
both builds, every byte-level assertion in this fixture's own test file
passes on both builds, and the emulator reports no error on either -- that is
exactly why this property is recorded here, by direct observation, rather
than left to be inferred from a passing test suite. This pass adds a second,
independent example of the same limit: the autostart failure documented
above was itself only found by direct inspection of the emulator's own log
output, not by any check this repository runs automatically -- nothing here
parses an emulator log for a failed autostart either.
