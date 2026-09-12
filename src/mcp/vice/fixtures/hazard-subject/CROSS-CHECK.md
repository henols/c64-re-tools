# Hazard-detector cross-check

The fixture and the detectors in this directory were built together, so a detector
could have been fitted to a fixture without either looking wrong. The only control
against that is running the detectors on programs written earlier, for other
reasons, by people not thinking about hazard detection at all. This record is that
control, run for real: four programs this work did not author, checked against
every hazard class, with the answer recorded as three counts against an explicit
denominator and named addresses -- never a pass, a fail, a score or a percentage.

## The four independently-sourced fixtures

| Fixture | What it actually contains | The question it was originally written to answer | Authored, relative to this work |
|---|---|---|---|
| `fixtures/dxa/tracer.prg` | A 23-byte hand-built program: a canonical `10 SYS 2064` BASIC stub handing over to a three-instruction routine that loads the accumulator with zero, stores it to the border-colour register, and returns. | Whether a byte-level disassembler's classified code/data split over a minimal known program matched a hand-derived ground truth. | About twelve days before this work opened. |
| `fixtures/ghidra/bank.prg` | A processor-port bank-switching program: the same address means a real VIC-II border-colour register, a plain RAM location, or Character ROM, depending on the current processor-port value written immediately before each access. | Whether a static analyser's dead-store elimination would incorrectly discard a hardware register write whose observable effect depends on runtime bank state. | About eight days before this work opened. |
| `fixtures/export-asm/smc.prg` | A 13-byte program that genuinely rewrites its own code: an increment instruction bumps the immediate operand byte of a preceding load, so the instruction executed on the next pass differs from the one executed on this pass, and the changing value is written to the border-colour register. | Whether a source exporter could name a write target strictly inside a decoded instruction with a mid-instruction label and reassemble byte-identically under a real assembler. | About twelve days before this work opened. |
| `fixtures/ghidra/charset-phantom.prg` | A program that writes a complete VIC-II bank/screen/character-set register combination, then places, inside the resulting 2048-byte character-set range, a chain of call-then-return blocks shaped to decode as plausible 6502 code. | Whether an analyser with nothing marking that range as data would mint a phantom function label at every block, and whether marking the range as data first would suppress that. | About seven days before this work opened. |

None of the four was written with a hazard detector in mind, and none has ever been
run against one before this record.

## The cross-check table

Sixteen rows: the four fixtures above, times the four hazard classes. Every count
is transcribed from the comparator's own output over the committed fixtures, not
from what was predicted before running it.

| Fixture | Class | Expectation | Denominator | Detected | Missed | False positives | Addresses |
|---|---|---|---|---|---|---|---|
| `tracer.prg` | indexed-dispatch | negative | 0 | 0 | 0 | 0 | -- |
| `tracer.prg` | self-modifying-code | negative | 0 | 0 | 0 | 0 | -- |
| `tracer.prg` | page-alignment | negative | 0 | 0 | 0 | 0 | -- |
| `tracer.prg` | cycle-exact-raster | negative | 0 | 0 | 0 | 0 | -- |
| `bank.prg` | indexed-dispatch | negative | 0 | 0 | 0 | 0 | -- |
| `bank.prg` | self-modifying-code | negative | 0 | 0 | 0 | 0 | -- |
| `bank.prg` | page-alignment | negative | 0 | 0 | 0 | 0 | -- |
| `bank.prg` | cycle-exact-raster | negative | 0 | 0 | 0 | 0 | -- |
| `smc.prg` | indexed-dispatch | negative | 0 | 0 | 0 | 0 | -- |
| `smc.prg` | self-modifying-code | positive | 1 | 1 | 0 | 0 | detected: `$0802` |
| `smc.prg` | page-alignment | negative | 0 | 0 | 0 | 0 | -- |
| `smc.prg` | cycle-exact-raster | negative | 0 | 0 | 0 | 0 | -- |
| `charset-phantom.prg` | indexed-dispatch | negative | 0 | 0 | 0 | 0 | -- |
| `charset-phantom.prg` | self-modifying-code | negative | 0 | 0 | 0 | 0 | -- |
| `charset-phantom.prg` | page-alignment | positive | 1 | 1 | 0 | 0 | detected: `$1000` |
| `charset-phantom.prg` | cycle-exact-raster | negative | 0 | 0 | 0 | 0 | -- |

Every negative-control row's false-positive count is zero, across all sixteen
rows -- including the two rows where the fixture (`bank.prg`) is a negative
control specifically FOR the page-alignment class: its border-colour and
Character-ROM accesses are gated by a processor-port state change, never by a
spatial alignment boundary, and the detector correctly stays silent on it.

## Which classes have no independent positive example

Read plainly, per class, rather than left implied:

- **self-modification** has one: the 13-byte self-modifying loop (`smc.prg`),
  detected at exactly the address its own source names as the self-modified
  operand byte.
- **spatial alignment** has one: the character-set program (`charset-phantom.prg`),
  detected at exactly the 2K-aligned base its own header comment derives register
  by register.
- **indexed dispatch** has **no independent positive example** among these four
  fixtures. This detector has fired only on programs authored in this work. This
  cross-check establishes only that the detector does not fire spuriously on four
  unrelated programs -- it establishes nothing about whether the detector would
  find a real instance of that construction in a program nobody here wrote. That
  is an open question, not a closed one.
- **cycle-exact raster** has **no independent positive example** among these four
  fixtures, for the same reason. The detector's only positive evidence anywhere
  is a program built specifically to carry the construction, and this record does
  not pretend otherwise.

## The deliberate miss

The subject program carries a second self-modification through a zero-page
pointer built entirely at runtime from a biased, compile-time-computed offset --
an indirect-indexed store, not a literal target address. The self-modification
detector misses it BY CONSTRUCTION: the static decoder has no literal address to
test against an indirect-indexed operand, only a pointer whose value is a fact
about the running machine. This is recorded here as a known false negative, not
left visible only in the source that plants it -- no finding exists at the
indirect store's target anywhere in the subject's own report, and the report's
own emitted limits name the miss by describing exactly this construction.

## What a weaker construction would not have proved

A cross-check whose false-positive column reads zero everywhere is only a
meaningful result if at least some of its rows are positives. A table built from
four negative controls alone would show a detector that never fires under any
condition as indistinguishable from a detector that fires correctly and never
over-fires -- both would produce the identical all-zero column. The two positive
rows above are what make the all-zero false-positive result mean something: a
detector that fired on nothing at all would have passed exactly as cleanly, and
this record is only honest because it also shows the two detectors that DO have
an independent positive example actually finding it.
