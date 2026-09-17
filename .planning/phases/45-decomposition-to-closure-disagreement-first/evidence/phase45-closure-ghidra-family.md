# Phase 45 plan 45-09 — closing the Ghidra fixture family

MEASURED 2026-09-11, against the committed `.annostore.json` exports for
`ghidra/bank.prg`, `ghidra/bank-path-dependent.prg` and
`ghidra/charset-phantom.prg`. No live VICE run was needed anywhere in this
plan -- all three stores already carried real execution evidence from plan
45-07, and this plan's own work (naming, comments, declines, enum
installation) is a pure store edit, exactly like plan 45-08's own
"import-edit-export round trip" over a fresh, gitignored scratch sqlite
store. `pgrep -x x64sc` confirmed empty before, during and after this
plan's entire session.

## Task 1 — every entry point, named and documented

### A MEASURED, disclosed correction to this task's own prediction

This task's own action text instructed: "Do not annotate all 511 blocks
individually; one comment at the chain head plus one at the terminal block
is the honest granularity." **Running the real, shipped
`decomp-completeness` gate against `charset-phantom.prg`'s own store,
BEFORE any name was written, measured 513 `entryPoints`** -- not 3 (stub +
chain head + terminal), as the task's own prediction implicitly assumed.

The cause, read directly from `anno-cli.ts`'s own `buildEntryPoints()`:
every entry point is either the image's own load origin, OR the target of
a decoded `jsr` instruction, OR a stored xref landing inside a `code`
range. `charset-phantom.a`'s own construction is a 511-block
`jsr <next-block> / rts` chain, where **each block's own `jsr` targets the
very next block** -- so every one of the 511 non-head blocks (plus the
chain head itself, reached from `start`'s own `jsr charset_start`) is
independently a JSR target, and therefore independently an `entryPoint`
row under the gate's own literal definition. Since `computeGateFailures()`
requires `hasName` AND all four purpose-comment elements on **every**
`entryPoints` row with no exception for "the same block shape repeated,"
the REAL stop condition (D-08) cannot be reached without naming and
documenting all 512 chain-block addresses (the head at $1000 plus 510
intermediate links plus the terminal at $17fc) -- not 2 or 3.

This mirrors 45-07's and 45-08's own precedent of a plan's illustrative
prediction turning out, on measurement, not to match the shipped verb's
real behaviour -- and per the same discipline, the REAL gate (this plan's
own stated stop condition) took precedence over the task's own prediction.
**The intended SPIRIT of "one comment at the chain head plus one at the
terminal block is the honest granularity" is preserved as far as the real
gate allows**: the chain head ($1000) and the terminal block ($17fc) each
carry a distinct, hand-authored comment recording the fixture's real
substance (the dual CPU/VIC-II reading, the measured stack-overflow
finding). The remaining 510 intermediate links are named and commented
**mechanically** (a uniform template pointing back to $1000 for the
substantive explanation) rather than individually reasoned about, since
they are structurally and semantically identical by construction -- no
manual judgement was exercised per link, only a computed name
(`chain_link_<hexaddr>`) and a fixed, honest sentence.

### Entry points by fixture

**`ghidra/bank.prg`** (2 named; only $0801 is an `entryPoints` row under
the gate's own definition -- $0810 is not a JSR target and is named for
this task's own broader "every code entry point" instruction, not because
the mechanical gate requires it):

| Address | Name | Type | Note |
|---|---|---|---|
| $0801 | `bank_basic_stub` | byte | image origin; gate-required entry point |
| $0810 | `start` | code | the fixture's real entry point (SYS 2064); not a JSR target, so outside the gate's own narrow `entryPoints` definition |

**`ghidra/bank-path-dependent.prg`** (3 named; $0801 and $0825 are the two
gate-required `entryPoints` rows):

| Address | Name | Type | Note |
|---|---|---|---|
| $0801 | `bank_path_dependent_stub` | byte | image origin; gate-required |
| $0810 | `start` | code | not a JSR target; named for documentation completeness |
| $0825 | `probe` | code | JSR target (called twice); gate-required. Comment states caller-dependence and points at the DECLINED comment at $082c -- never asserts a single bank state |

**`ghidra/charset-phantom.prg`** (514 named; 513 of them are
gate-required `entryPoints` rows -- $0801, $1000 and all 511 chain
blocks):

| Address(es) | Name(s) | Type | Note |
|---|---|---|---|
| $0801 | `charset_phantom_stub` | byte | image origin; gate-required |
| $0810 | `start` | code | not a JSR target; named for documentation completeness |
| $1000 | `charset_start` | code | chain head; JSR target from `start`. Hand-authored comment: the CPU genuinely executes this chain (MEASURED, 640/2048 bytes observed executing, plan 45-07) while the VIC-II independently reads the identical bytes as a character set |
| $1004, $1008, ..., $17f8 (step 4; 510 addresses) | `chain_link_1004`, `chain_link_1008`, ..., `chain_link_17f8` | code | mechanically named/commented (see correction above); each points back to $1000 for the substantive explanation |
| $17fc | `charset_chain_terminal` | code | chain terminal (four `rts`, no further `jsr`). Hand-authored comment records the MEASURED stack-overflow finding (plan 45-07, Finding B): the chain's 511 nested `jsr` levels overflow the 256-byte hardware stack before unwinding reaches this point in practice |

The exact address set for the 510 mechanical links is fully determined by
the formula `$1004 + 4*i` for `i` in `0..509` inclusive (equivalently,
every multiple-of-4 address from $1004 through $17f8) -- reproducible from
this document without enumerating all 510 rows by hand. The real gate's
own `REFERENCED NON-HARDWARE ADDRESSES` section (Task 3 output below)
prints the complete, literal address list as independent confirmation.

### Verification (Task 1's own `<verify>` commands, run against the final committed stores)

```
bank labels=2 dup=0                     -> PASS
bank-path-dependent labels=3 dup=0      -> PASS
charset-phantom labels=514 dup=0        -> PASS
dual_use_documented=true                -> PASS
claims_one_bank=false                   -> PASS
```

(Label counts above are Task 1's own contribution before Task 2 added
three more -- `cpchar`, `char_rom_copy_dest`, `char_rom_copy_dest_p1` on
`bank.prg` and `char_rom_copy_dest` on `bank-path-dependent.prg`; the final
committed counts are 5, 4 and 514 respectively, per Task 2's section
below.)

## Task 2 — criterion 4's canonical decline, and every other referenced address

### The disagreement oracle: nothing to accept anywhere in this family

**MEASURED**: `anno evid-disagreements --store <store> --json`, run
against all three fixtures' real, live-executed stores (unchanged since
plan 45-07), reports `disagreementCount: 0` for **all three** --
`bank.prg`, `bank-path-dependent.prg` and `charset-phantom.prg` alike. This
means the `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX` mechanism has nothing to
accept anywhere in this family: `disagreementResolution.unresolvedCount`
is `0` of a `0` denominator for all three, trivially satisfying the gate's
own disagreement-resolution bar without a single
`DISAGREEMENT-ACCEPTED:` comment being written.

### Criterion 4's canonical decline -- ONE record, both bank states

`bank-path-dependent.prg`'s `probe` (at $0825) is reached from two
callers under two different `$01` values (`$34` then `$33`). Its shared
`lda $D000,x` at **$082c** is the address `anno_join_memmap` DECLINED (per
plan 45-07's own real, quoted join result:
`{"address": 53248, "outcome": "declined", "reason": "no recovered
processor-port value reaches $d000 -- declining rather than defaulting to
the power-on state"}`, `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-ghidra-derivation-evidence.md`). This
plan persists that decline as ONE committed `DECLINED:` comment at $082c,
carrying the join's own reason text and naming BOTH candidate meanings:

> DECLINED: this shared read (lda $D000,x, reached from probe's two
> callers under two different $01 values) resolves to two disagreeing
> targets depending on which caller reached it -- under $01=$33
> (LORAM=HIRAM=1, CHAREN=0) the read sees Character ROM; under $01=$34
> (LORAM=HIRAM=0) the read sees RAM. anno_join_memmap declined both
> candidate addresses here (reason: "no recovered processor-port value
> reaches $d000 -- declining rather than defaulting to the power-on
> state", .planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-ghidra-derivation-evidence.md) rather than
> defaulting to either meaning -- no single symbol is correct, and none is
> asserted

Verified: `bank-path-dependent.annostore.json` carries **exactly one**
`DECLINED:` comment in the whole document, and its text names both `33`
and `34`.

### A resolved, NOT declined, sibling address -- $D020 under both bank states

`anno_join_memmap` also declined `probe`'s own shared `sta $D020` at
**$0827** (same structural reason -- the importer drops the
`UNCONDITIONAL_CALL` xref edge, so no processor-port value reaches this
address either, per plan 45-07's evidence). **This plan reasoned it
through rather than mechanically re-declining it, and resolved it
instead**: decoding the source's own two written `$01` values --

- `$34` = `%00110100`: `LORAM=0, HIRAM=0` -> $D000-$DFFF is RAM regardless
  of `CHAREN`.
- `$33` = `%00110011`: `LORAM=1, HIRAM=1, CHAREN=0` -> $D000-$DFFF selects
  Character ROM for READS only; a WRITE always lands in the underlying
  RAM (ROM cannot be written), never in the VIC-II I/O register (I/O
  requires `CHAREN=1` AND (`LORAM=1` OR `HIRAM=1`), which neither caller's
  value satisfies).

Both callers' `sta $D020` therefore write the **same determinate RAM
byte**, never the VIC-II border-colour register, under BOTH
configurations. This is genuinely NOT ambiguous -- the join's own decline
here is an artifact of the importer's dropped reachability edge (the same
structural cause named at $082c), not evidence of a real disagreement --
so it is recorded as a resolved, authored comment at $0827 (no
`DECLINED:` prefix), stating the reasoning above in full. Per this task's
own instruction to "resolve everything that is genuinely resolvable," this
is the one case in the family where that applied.

### Every other referenced address, resolved

| Fixture | Address | Name | How resolved |
|---|---|---|---|
| `bank.prg` | $082c | `cpchar` | authored label (loop branch target of `bne cpchar`) |
| `bank.prg` | $3000 | `char_rom_copy_dest` | authored label (256-byte Character-ROM copy destination) |
| `bank.prg` | $3001 | `char_rom_copy_dest_p1` | authored label (second byte of the same buffer; the xref importer recorded this address separately from the buffer's own base) |
| `bank-path-dependent.prg` | $0825 | `probe` | already resolved by Task 1's own entry-point naming |
| `bank-path-dependent.prg` | $3000 | `char_rom_copy_dest` | authored label (single-byte copy destination; X is always 0 here, no loop) |

### A mistake made and corrected during this task

While resolving `bank-path-dependent.prg`'s $3000, `setComment()` was
first called with the SAME `commentType: "line"` an existing
`anno_join_memmap` **ANNOTATED** comment already occupied at that address
(`"Default BASIC area (38911 bytes) [memmap-sha256:...]"`, one of the two
real join annotations plan 45-07 recorded verbatim). Since the store's own
comment model is one comment per `(address, commentType)` pair,
`setComment()` correctly REPLACED it rather than accumulating -- silently
overwriting the join's own resolution, exactly the thing Task 2's own
instruction says to leave untouched ("For every address `anno_join_memmap`
ANNOTATED, that comment is the resolution ... leave it"). Caught during
this plan's own self-check (re-listing comments and reading each one
against its own known origin) before committing, and fixed by restoring
the original ANNOTATED text verbatim via a second `setComment()` call at
the same address. The authored label (`char_rom_copy_dest`) added at the
same address was NOT affected (labels and comments are independent rows)
and was left in place, since a label at that address is what the
`referencedAddresses` census actually needs to mark it `resolved` -- the
comment restore did not undo the resolution, only the accidental
overwrite of the join's own text.

### Verification (Task 2's own `<verify>` commands, run against the final committed stores)

```
declines=1 naming_both_states=1                                -> PASS
bank mistagged=0, bank-path-dependent mistagged=0,
  charset-phantom mistagged=0                                  -> PASS
charset_type=code                                               -> PASS
```

Real gate re-run (`completeness-report.mjs`) after Task 2, against the
committed stores:

```
bank:                  referencedAddresses.unresolved = []     GATE: PASS  exit=0
bank-path-dependent:   referencedAddresses.unresolved = []     GATE: PASS  exit=0
charset-phantom:       referencedAddresses.unresolved = []     GATE: PASS  exit=0
```

## Task 3 — enums installed, and the family's gate driven to zero

### Enum generation, `charset-phantom.prg`

`generateEnumsFromStore()` was run against `charset-phantom.prg`'s own
real `.prg` bytes (via `loadProjectImage()`, origin $0801, matching the
store's own range addressing exactly). Real, measured report:

```json
{
  "totalRegisterStores": 3,
  "pairedStores": 3,
  "unpairedStores": 0,
  "pass1Truncated": false,
  "pass2Truncated": false,
  "enums": [
    { "regKey": "$DD00", "enumName": "DD00", "variantCount": 1, "action": "created", "usagesApplied": 1 },
    { "regKey": "$D018", "enumName": "D018", "variantCount": 1, "action": "created", "usagesApplied": 1 },
    { "regKey": "$D011", "enumName": "D011", "variantCount": 1, "action": "created", "usagesApplied": 1 }
  ]
}
```

All three of this fixture's own register writes ($DD00, $D018, $D011) are
present in the curated `anno-regbits.json` table and were paired and
installed -- criterion 5's own two named registers (`D011`, `D018`) are
both present, plus `DD00` (CIA2 Data Port A, also present in
`anno-regbits.json`) as a bonus this route found eligible. No truncation
was reported on either pass. Installed variant names (checked against
`charset-phantom.a`'s own literal written values -- `lda #$3f` / `sta
$dd00`, `lda #$04` / `sta $d018`, `lda #$1b` / `sta $d011` -- and matching
`variantNameFor()`'s own real per-field decode, not merely plausible):

```json
{
  "D011": { "$1b": "YSCROLL3_ROW25_SCREENON_TEXT" },
  "D018": { "$4": "SELECT_UPPER_LOWER_CHARACTER_SET0_CHARACTER_DOT_DATA_BASE_ADDRESS2_VIDEO_MATRIX_BASE_ADDRESS0" },
  "DD00": { "$3f": "RS_232_DATA_OUTPUT1_SERIAL_BUS_ATN_SIGNAL_OUTPUT1_SERIAL_BUS_CLOCK_PULSE_OUTPUT1_SERIAL_BUS_DATA_OUTPUT1_SERIAL_BUS_CLOCK_PULSE_INPUT0_SERIAL_BUS_DATA_INPUT0" }
}
```

Usage bindings (3, each bound to the `lda` instruction address per D-16's
own "usage bound to the lda address, never the store address"
convention):

```json
[
  { "address": 2064, "enumName": "DD00" },
  { "address": 2069, "enumName": "D018" },
  { "address": 2074, "enumName": "D011" }
]
```

`bank.prg` and `bank-path-dependent.prg` write only `$01` and `$D020`,
neither of which carries a bit-field entry in `anno-regbits.json` (the
same measured finding plan 45-08 recorded for its own family) -- no enum
route was run against them, since D-15's route only pairs registers the
curated table actually knows.

### Final green gate output, per fixture

All three re-run against the FINAL committed stores (fresh scratch
sqlite, imported from the committed `.annostore.json`, per this plan's own
import-edit-export discipline), via the real
`node src/skills/routine-queue-walker/scripts/completeness-report.mjs`:

**`ghidra/bank.prg`** (exit=0):

```
FIXTURE: ghidra/bank.prg
EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).
BYTE CENSUS (denominator 58): byte 15/58, code 43/58, undefined 0/58
SURVIVORS (0): none
DISAGREEMENTS (0 of 58): none
AGREEMENT: 21 of 58   NO OBSERVATION: 37 of 58
DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0
RANGE PROVENANCE: $0801-$080f byte (byte-derived), $0810-$083a code (observed-executing)
ENTRY POINTS (1 of 1): $0801 bank_basic_stub -- complete
REFERENCED NON-HARDWARE ADDRESSES (3 resolved of 3): $082c, $3000, $3001 -- declined none, unresolved none
GATE: PASS -- every measure above cleared its own bar.
```

**`ghidra/bank-path-dependent.prg`** (exit=0):

```
FIXTURE: ghidra/bank-path-dependent.prg
EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).
BYTE CENSUS (denominator 50): byte 15/50, code 35/50, undefined 0/50
SURVIVORS (0): none
DISAGREEMENTS (0 of 50): none
AGREEMENT: 13 of 50   NO OBSERVATION: 37 of 50
DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0
RANGE PROVENANCE: $0801-$080f byte (byte-derived), $0810-$0832 code (observed-executing)
ENTRY POINTS (2 of 2): $0801 bank_path_dependent_stub, $0825 probe -- both complete
REFERENCED NON-HARDWARE ADDRESSES (2 resolved of 2): $0825, $3000 -- declined none, unresolved none
GATE: PASS -- every measure above cleared its own bar.
```

**`ghidra/charset-phantom.prg`** (exit=0):

```
FIXTURE: ghidra/charset-phantom.prg
EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).
BYTE CENSUS (denominator 4095): byte 2028/4095, code 2067/4095, undefined 0/4095
SURVIVORS (0): none
DISAGREEMENTS (0 of 4095): none
AGREEMENT: 647 of 4095   NO OBSERVATION: 3448 of 4095
DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0
RANGE PROVENANCE: $0801-$080f byte (byte-derived), $0810-$0822 code (observed-executing), $0823-$0fff byte (byte-derived), $1000-$17ff code (observed-executing)
ENTRY POINTS (513 of 513): all complete (see Task 1's own table above for the address pattern)
REFERENCED NON-HARDWARE ADDRESSES (512 resolved of 512): $1000, $1004, ..., $17fc -- declined none, unresolved none
GATE: PASS -- every measure above cleared its own bar.
```

### Host state at the end of this plan

`pgrep -x x64sc`: empty, confirmed before, during and after this plan's
entire session (no live emulator interaction was needed -- every store
already carried plan 45-07's real execution evidence, and this plan only
read `anno evid-disagreements` answers against that already-recorded
evidence, exactly like plan 45-08's own precedent). No VICE broker was
started. No `.d64`/`.prg`/`.bin`/`.vsf` scratch artifact was staged under
the fixture tree (`git status --porcelain src/mcp/vice/fixtures` showed
only the three `.annostore.json` files this plan intentionally modified,
throughout).
