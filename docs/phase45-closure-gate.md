# Phase 45 plan 45-10 — the closure gate

This document is the phase's own closure record, organised against
`.planning/ROADMAP.md`'s five Phase 45 success criteria. Each criterion
section below names what was measured, where the underlying evidence
lives, and what the result was — never restating the two family closure
documents (`docs/phase45-closure-dxa-family.md`,
`docs/phase45-closure-ghidra-family.md`) that already carry the per-fixture
detail.

## Criterion 5 — hardware register writes render as named enum members, with a multi-bit register decomposed

**MEASURED 2026-09-11**, against the REAL committed
`src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json` export and the
REAL committed `src/mcp/vice/fixtures/ghidra/charset-phantom.prg` image — not
a synthetic image. Method: the committed export was imported
(`importStoreDocument()`) into a fresh scratch sqlite store, `anno
export-asm`'s own implementation (`exportAsm()`) was run over that store
against the real fixture image, the exported source was assembled with real
ACME 0.97 ("Zem"), and the produced bytes were diffed against the fixture
image byte for byte. `anno_disassemble` was then run over the same store and
image for the readability half (D-16).

### A measured blocker, disclosed and worked around for this demonstration only

Running `exportAsm()` over the committed store **exactly as committed**
throws for the WHOLE document:

```
Error: exportAsm: decomposing the enum usage at $0810 (enum "DD00", value $3f)
against its bit-name table failed: decomposeRegisterValue: register $DD00
value 0x3f is not fully covered by its fields -- the OR of the decomposed
terms is 0x3c, leaving bits 0x3 unaccounted for. Refusing to emit a lossy
decomposition rather than a residual hex literal (add an OVERRIDES entry in
anno-regbits-gen.ts and regenerate anno-regbits.json).
```

Root cause, read directly from the committed `anno-regbits.json`: the `$DD00`
entry's fields cover only bits #2-#7 (mask `0xfc` — `RS_232_DATA_OUTPUT`,
`SERIAL_BUS_ATN_SIGNAL_OUTPUT`, `SERIAL_BUS_CLOCK_PULSE_OUTPUT`,
`SERIAL_BUS_DATA_OUTPUT`, `SERIAL_BUS_CLOCK_PULSE_INPUT`,
`SERIAL_BUS_DATA_INPUT`). It carries **no field for bits #0-#1** — the VIC
bank-select bits — even though those are exactly the bits
`charset-phantom.a`'s own header comment calls out as semantically load-bearing
("`$DD00 = $3f`: bits #0-#1 = `%11` -> VIC bank select inverts to 0 -> bank
base `$0000`"). `decomposeRegisterValue()` is doing exactly its documented
job here — refusing to emit a lossy decomposition rather than silently
dropping two bits — so this is **not a bug in the decoder**; it is a
genuine, pre-existing incompleteness in the curated `anno-regbits.json` table
for `$DD00`, unrelated to `$D011`/`$D018` (both of which this table covers
**completely**: `$D011`'s fields OR to `0xff`, `$D018`'s fields OR to `0xff`,
confirmed by reading the committed table directly).

`$DD00` was never criterion 5's own subject — the roadmap names `$D011` and
`$D018` specifically, and plan 45-09's own SUMMARY records `DD00` as "a
bonus eligible register" the enum-generation route happened to also pick up,
never a requirement. Per this plan's own prohibitions ("never hand-edit
`anno-regbits.json`") and plan 45-08's own established precedent (widening a
curated table's inclusion rule is an architectural change to a shared
generator, out of scope for a fixture-closure plan), this gap is **not**
fixed here. For this demonstration only, the `DD00` project-enum and its one
usage binding were dropped from a **scratch copy** of the imported document
(2 of 3 project enums and 2 of 3 usage bindings survive: `D011` and `D018`,
untouched) — the committed `charset-phantom.annostore.json` on disk was never
modified. Every other row (514 labels, 514 comments, 4 ranges, 3 xrefs, 2555
exec observations) is the real, unmodified, committed content. This is
recorded here as a genuine, disclosed limitation of the current closed state
of `charset-phantom.prg`'s store: **`anno export-asm` cannot run over the
committed store as committed today**, only over the store with `DD00`'s enum
usage removed. A later plan/human decision is needed on whether to widen
`anno-regbits-gen.ts`'s `$DD00` field set (adding the VIC-bank-select field)
or to leave `DD00`'s enum uninstalled in the committed fixture.

### The exported source, verbatim (D011/D018 only — criterion 5's own subject)

Per-field constant header definitions (one line per field, each appearing
exactly once):

```
D018_SELECT_UPPER_LOWER_CHARACTER_SET0 = $00
D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 = $04
D018_VIDEO_MATRIX_BASE_ADDRESS0 = $00
D011_YSCROLL3 = $03
D011_ROW25 = $08
D011_SCREENON = $10
D011_TEXT = $00
```

(`$D011`'s real written value is `$1b` = `%00011011`: `YSCROLL=3` (bits
#0-#2), `ROWS=1`/`ROW25` (bit #3), `SCREENON=1` (bit #4), `MODE=0`/`TEXT`
(bit #5), `ECM=0` and `RST8=0` (bits #6-#7, both mapped to an EMPTY token by
the curated table and therefore emit no OR term — this is why 4 constants
appear for `$D011`'s 6 fields, not 6). `$D018`'s real written value is `$04`
= `%00000100`: `SELECT_UPPER_LOWER_CHARACTER_SET=0`,
`CHARACTER_DOT_DATA_BASE_ADDRESS=2`, `VIDEO_MATRIX_BASE_ADDRESS=0` — all
three of `$D018`'s fields, none empty.)

The two register-write lines, exported (OR-ed named constants, each followed
by a decoded comment on the SAME line, D-17's shape):

```
        lda #D018_SELECT_UPPER_LOWER_CHARACTER_SET0 | D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 | D018_VIDEO_MATRIX_BASE_ADDRESS0  ; $D018: SELECT_UPPER_LOWER_CHARACTER_SET=0, CHARACTER_DOT_DATA_BASE_ADDRESS=2, VIDEO_MATRIX_BASE_ADDRESS=0
        lda #D011_YSCROLL3 | D011_ROW25 | D011_SCREENON | D011_TEXT  ; $D011: YSCROLL=3, ROWS=1, SCREENON=1, MODE=0, ECM=0, RST8=0
```

`start`'s own hand-authored purpose comment (unaffected by the DD00
workaround, since it is an authored comment row, not a derived enum row),
shown immediately above the two lines in the real export:

```
        ; function: configures a complete VIC-II bank/screen/charset combination ($DD00=$3F selects bank $0000, $D018=$04 places the screen at $0000 and the character set at $1000, $D011=$1B selects character mode) then calls into the charset region at $1000 | inputs: none | outputs: none in registers | side effects: writes $DD00, $D018, $D011 (CIA2 port A and two VIC-II registers), calls charset_start (jsr), returns via rts
```

`enumSubstitutionCount: 2`, `enumDecompositionCount: 2` — both of criterion
5's own register writes are decompositions, and nothing else in the store
substitutes an enum (the `DD00` usage was removed for this run, per above).

### ACME's own verdict — real assembler, byte-identical

```json
{
  "outcome": "ok",
  "reason": "the output file this run created is byte-identical to the expected bytes (4095 byte(s) across 4 segment(s)).",
  "byteDiff": {
    "equal": true,
    "firstDifferingOffset": null,
    "expectedLength": 4095,
    "actualLength": 4095
  }
}
```

515 stderr lines were emitted, **all `Warning` severity** (`Wrong type -
expected address.`, on the mechanically-named `chain_link_*` blocks' own
`jsr * + 4` computed targets — a documented, non-fatal ACME 0.97 quirk per
`anno-export-asm.ts`'s own header). **Zero `Error` or `Serious error`
diagnostics.** No warning was reported as a failure — the verdict layer's own
rule 5 (`acme-verify.ts`) treats only `Error`/`Serious error` as fatal, and
`outcome: "ok"` with `byteDiff.equal: true` is the only thing this document
treats as success, matching this file's own read-first instruction.

**This is criterion 5's proof**: the OR-ed named-constant decomposition for
BOTH `$D011` and `$D018`, taken from the real committed store and the real
committed image, reassembles through a real, unmodified ACME 0.97 to bytes
IDENTICAL to the fixture's own committed `.prg` — 4095 of 4095 bytes, exact.
The decomposition is therefore arithmetically correct, not merely plausible.

### The readability half — `anno_disassemble` over `$0810-$0822`

Same store (DD00-usage-removed scratch copy), same real image, run through
the real `anno_disassemble` tool (`runAnnoTool()`):

```
!cpu 6510
* = $0810
        lda #$3f
        sta $dd00
        lda #D018_SELECT_UPPER_LOWER_CHARACTER_SET0 | D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 | D018_VIDEO_MATRIX_BASE_ADDRESS0  ; $D018: SELECT_UPPER_LOWER_CHARACTER_SET=0, CHARACTER_DOT_DATA_BASE_ADDRESS=2, VIDEO_MATRIX_BASE_ADDRESS=0
        sta $d018
        lda #D011_YSCROLL3 | D011_ROW25 | D011_SCREENON | D011_TEXT  ; $D011: YSCROLL=3, ROWS=1, SCREENON=1, MODE=0, ECM=0, RST8=0
        sta $d011
        jsr $1000
        rts
```

The `$dd00` write renders as a plain hex literal here (its enum usage was
removed from this scratch copy for the reason above — this is the SAME
scratch store the export ran against, not a second inconsistent one). Both
`$D018` and `$D011` render the SAME OR-ed named constants and decoded
comments `anno-export-asm.ts` proved byte-identical above — one decoder
(`decomposeRegisterValue()`), two renderers (D-16), exactly as designed: a
Claude session reading this listing sees what the export proves.

---

*(The remaining four success-criterion sections, the nine-fixture idempotence
sweep and the suite-baseline comparison are added by Task 3 of this plan.)*
