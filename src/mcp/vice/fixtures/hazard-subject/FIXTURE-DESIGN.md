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

Both runs below were prepared entirely by the person writing this document:
each committed image was loaded into a real stock emulator, run, and its
screen captured, with no step asking anyone to launch, type or run anything.
The prediction is stated first, from the source; the observation is recorded
second, verbatim, so the two can disagree.

**ALIGNED build (`hazard-subject.prg`).**

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

**MIS-ALIGNED build (`hazard-subject-misaligned.prg`).**

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
than left to be inferred from a passing test suite.
