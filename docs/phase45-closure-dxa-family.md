# Phase 45 plan 45-08 — the dxa/export-asm/petcat family, closed

This is D-12's second half for the six fixtures plan 45-06 derived: names,
purpose comments, resolved-or-declined referenced addresses, and the
decomposition-completeness gate driven to exit 0 for all six. Every result
below was produced by actually running the real CLI paths
(`anno decomp-completeness` / `completeness-report.mjs`) against a live
store re-imported from the committed `.annostore.json` exports, never
asserted from reading the JSON alone.

## Method

For each fixture: the committed `<fixture>.annostore.json` was imported
(`importStoreDocument()`) into a fresh scratch sqlite store
(`.c64-re-tools/phase45-08-scratch/`, gitignored). Names and comments were
written through the same `anno-store.ts` functions the `anno_set_label_name`
/ `anno_set_comment` MCP tools dispatch to (`setLabel()` / `setComment()`).
The enum route (`generateEnumsFromStore()`) was run over each fixture that
writes a hardware register. The store was then re-exported
(`exportStoreDocument()`) and the export copied over the committed
`.annostore.json`, so the committed artifact IS the store the gate below was
run against, not a hand-edited copy of it.

`anno_join_memmap` (via `runMemmapJoin()`) was considered for referenced-
address resolution per Task 2's own action text, but MEASURED to be a
structural no-op for this whole family: `runMemmapJoin()` joins over
`listXrefs()` rows, and plan 45-06 MEASURED (and this session re-confirmed)
that Ghidra's cross-reference import wrote **zero xrefs** for all six
fixtures — none has a JSR/JMP or a Ghidra-recognised function entry beyond
what dxa itself traced. With zero rows in the store's `xrefs` table, `anno
join_memmap` has nothing to iterate and produces zero decisions regardless
of fixture. The `decomp-completeness` gate's own `referencedAddresses`
census (`buildReferencedAddresses()` in `anno-cli.ts`) instead derives
candidates directly from decoding the store's `code`-typed ranges
(`instructionReferencedAddress()`), which is where every address named or
declined below actually came from. This is recorded here rather than
silently substituted, since the plan's own action text names
`anno_join_memmap` as the resolution mechanism and the real, measured
mechanism differs.

## Task 1 — entry points, by address

| Fixture | Address | Name | Purpose comment (four elements, single line per `assertCommentText()`'s no-embedded-newline rule) |
|---|---|---|---|
| `dxa/tracer.prg` | `$0801` | `tracer_entry` | function: BASIC-stub entry (10 SYS 2064) that hands control to the machine-code routine at $0810. \| inputs: none \| outputs: none \| side effects: none directly -- invoking $0810 sets the VIC-II border colour ($D020) to black via LDA #$00 / STA $D020. |
| `dxa/fixture.prg` | `$0801` | `fixture_entry` | function: BASIC-stub entry (10 SYS 2064) that hands control to the machine-code routine at $0810, which sets the border colour, copies a 32-byte array, then dispatches indirectly through a handler table. \| inputs: none \| outputs: none \| side effects: sets VIC-II border colour $D020 to black, copies arr_src ($08bf) into arr_dst ($08df) 32 bytes via loop_arr ($0817), then JMPs indirectly through the zero-page pointer ($00fb/$00fc) to one of three handler routines selected via disp_lo/disp_hi ($08ab/$08ae) at index 2. |
| `dxa/fixture.prg` | `$0817` | `loop_arr` | function: array-copy loop body -- copies one byte from arr_src+X to arr_dst+X, increments X, loops until X=$20. \| inputs: X = current copy index (0..$1f) \| outputs: none \| side effects: writes arr_dst[X] = arr_src[X]; branches back to itself ($0817) via BNE until the 32-byte copy completes. |
| `dxa/fixture.prg` | `$08ab` | `disp_lo` | function: low-byte table of the three handler-dispatch addresses (handler0/handler1/handler2), indexed by X. \| inputs: X = handler index (0..2) \| outputs: A = low byte of the selected handler address \| side effects: none (read-only table). |
| `dxa/fixture.prg` | `$08ae` | `disp_hi` | function: high-byte table of the three handler-dispatch addresses (handler0/handler1/handler2), indexed by X. \| inputs: X = handler index (0..2) \| outputs: A = high byte of the selected handler address \| side effects: none (read-only table). |
| `dxa/fixture.prg` | `$08bf` | `arr_src` | function: 32-byte source array (values 0..31) copied into arr_dst by loop_arr. \| inputs: none \| outputs: none \| side effects: none (read-only data). |
| `dxa/fixture.prg` | `$08df` | `arr_dst` | function: 32-byte destination array filled by loop_arr's array-copy loop. \| inputs: none \| outputs: none \| side effects: written by loop_arr, one byte per iteration. |
| `dxa/fixture.prg` | `$00fb` | `dispatch_ptr_lo` | function: zero-page low byte of the indirect-JMP dispatch pointer, loaded from disp_lo[X] before the indirect jump. \| inputs: none \| outputs: none \| side effects: read by the indirect JMP ($00fb) as the low byte of the jump target. |
| `dxa/fixture.prg` | `$00fc` | `dispatch_ptr_hi` | function: zero-page high byte of the indirect-JMP dispatch pointer, loaded from disp_hi[X] before the indirect jump. \| inputs: none \| outputs: none \| side effects: read by the indirect JMP ($00fb) as the high byte of the jump target (JMP reads ($00fb)/($00fc) as one 16-bit pointer). |
| `dxa/basic-stub.prg` | `$0801` | `basic_stub_entry` | function: canonical 10 SYS 2064 BASIC stub followed by 4 arbitrary unknown-region ground-truth bytes (aa bb cc dd); not real code. \| inputs: none \| outputs: none \| side effects: none (declared NOT EXECUTED in `fixtures/decomp-execution-manifest.json` -- SYS 2064 would jump into 4 garbage bytes with no defined behaviour). |
| `export-asm/smc.prg` | `$0801` | `smc_loop_entry` | function: self-modifying border-colour loop -- loads its own (previously incremented) immediate operand, stores it to the VIC-II border colour register, increments that operand, then jumps back to itself. \| inputs: none (state persists in the mutated operand byte at $0802 across iterations) \| outputs: none (never returns) \| side effects: modifies its own operand byte at $0802 via INC each iteration (self-modifying code), writes VIC-II border colour $D020, and loops forever via JMP $0801 -- this fixture's own jmp $0801 never halts. |
| `petcat/computed-sys.prg` | `$0801` | `computed_sys_program_start` | function: tokenized BASIC program text (10 sys peek(43)+256*peek(44)); not machine code -- this fixture is declared NOT EXECUTED in `fixtures/decomp-execution-manifest.json`. \| inputs: none \| outputs: none \| side effects: none (never executed as a program; exists to test petcat.decode's computed-SYS verdict). |
| `petcat/not-basic.prg` | `$0a03` | `not_basic_data_start` | function: 64 deterministic non-BASIC bytes ((i*7+3) mod 256), the PREP-04 planted-failure fixture for petcat.decode's non-vacuous control; not a program. \| inputs: none \| outputs: none \| side effects: none (declared NOT EXECUTED in `fixtures/decomp-execution-manifest.json`; never executed by construction, exists to make petcat.decode refuse it). |

**Technical note on "each on its own labelled line":** `assertCommentText()`
(`anno-types.ts`) REFUSES any comment text containing an embedded line
break -- a stored newline would put everything after it into the generated
ACME source at column zero, as assembler input rather than as a comment.
Every purpose comment above is therefore ONE physical line with the four
labelled elements separated by ` | `, not four literal source lines. The
gate's own `entryPoints` measure checks for the four labels as
case-insensitive substrings anywhere in the address's comments
(`purposeLabelPatterns` in `anno-cli.ts`), which this format satisfies
exactly, and `completeness-report.mjs`'s own rendering confirms
`hasName=true` / `purpose comment complete` for every entry point below.

**MEASURED, disclosed: the gate's own `entryPoints` census always includes
the image's own load address, regardless of whether that address is code.**
`buildEntryPoints()` (`anno-cli.ts`) unconditionally adds `image.origin` (the
`.prg`'s own 2-byte load address) to the entry-point candidate set, then
unions JSR targets and code-range xrefs on top. For
`petcat/computed-sys.prg` and `petcat/not-basic.prg` this means the gate's
`ENTRY POINTS` section reads **1 of 1**, naming the BASIC-program /
raw-data load address itself -- **not** "0 of 0" as this plan's own Task 1
action text predicted for these two fixtures. This was MEASURED directly by
running `anno decomp-completeness --store <fresh, unedited store>` against
each of the six fixtures before any name was written (all six showed `(0 of
1)`, never `(0 of 0)`). Both fixtures' load addresses are named and
documented above (honestly, as data, not as invented code) rather than left
unnamed to chase an "0 of 0" that the shipped gate does not produce for a
fixture with a real `.prg` load address. `dxa/basic-stub.prg` shows the same
`(0 of 1)`/now `(1 of 1)` shape for the same reason -- it also has no code
range once dxa is run without an entry point, per plan 45-06.

## Task 2 — declines and accepted disagreements, by address

| Fixture | Address | Kind | Text |
|---|---|---|---|
| `export-asm/smc.prg` | `$0802` | `DECLINED:` | this is smc.prg's own self-modified operand byte -- the immediate operand of the LDA #$00 at $0801, rewritten in place by INC $0802 every loop iteration. Its effective value varies per iteration by construction (0, 1, 2, ... wrapping at 256) and there is no single correct symbol or value to name here -- see export-asm/README.md. |
| `petcat/computed-sys.prg` | `$0805` | `DECLINED:` | SYS peek(43)+256*peek(44) -- the machine-code handover target is computed at runtime from the zero-page BASIC-program-start pointer at $2B/$2C (decimal 43/44), never literal. No single target address is correct for this standalone fixture in isolation, and none is annotated here (Pitfall 12: a fabricated indirect target is worse than an absent one). |

No `DISAGREEMENT-ACCEPTED:` comments were written for this family:
`anno evid-disagreements --json` reported `disagreementCount: 0` for every
one of the six fixtures (both before and after this plan's edits, since
disagreements are computed from bytes/execution evidence, not from
authored content) -- there is nothing to accept because nothing disagreed.
`disagreementResolution` therefore renders `0 accepted, 0 unresolved of 0`
for all six, which the gate accepts as clean (an empty denominator is not a
failure).

**Referenced-address census, by fixture, before and after this plan's
declines/names (`REFERENCED NON-HARDWARE ADDRESSES`):**

| Fixture | Denominator | Resolved (after) | Declined (after) | Unresolved (after) |
|---|---|---|---|---|
| `dxa/tracer.prg` | 0 | n/a | n/a | n/a |
| `dxa/fixture.prg` | 7 | `$00fb, $00fc, $0817, $08ab, $08ae, $08bf, $08df` | none | none |
| `dxa/basic-stub.prg` | 0 | n/a | n/a | n/a |
| `export-asm/smc.prg` | 2 | `$0801` | `$0802` | none |
| `petcat/computed-sys.prg` | 0 | n/a | n/a | n/a |
| `petcat/not-basic.prg` | 0 | n/a | n/a | n/a |

`computed-sys.prg`'s own zero-page-pointer decline (`$2B`/`$2C`, decimal
43/44) is NOT part of the `referencedAddresses` census above -- that census
only covers addresses a `code`-typed range's decoded instructions
reference, and `computed-sys.prg` has no code range at all (pure BASIC text,
never traced by dxa since no entry point was ever supplied to it, per plan
45-06). The decline is persisted anyway, at the SYS token's own address
(`$0805`), because criterion 4's own text and this plan's `must_haves`
require it as a named, persisted record independent of what the automated
gate happens to census.

## Task 3 — enum generation and the gate, per fixture

**MEASURED, disclosed finding: none of this family's fixtures has an
eligible register write for the enum route, contradicting this plan's own
Task 3 action text.** `generateEnumsFromStore()` (`anno-enum-gen.ts`) was
run against `dxa/tracer.prg`, `dxa/fixture.prg` and `export-asm/smc.prg` --
the three fixtures in this family that write a hardware register at all,
all three writing only `$D020` (VIC-II border colour). All three reports
below show `totalRegisterStores: 0`.

**Why, measured to the actual code path (three checks, not one):**

1. `fetchRegisterSearchRows()`'s absolute-store pass only counts a `sta`/
   `stx`/`sty` whose target key is present in `Object.keys(loadRegBits())`
   (`anno-regbits.json`, the curated per-bit-field table `anno-regbits-gen.ts`
   generates). `$D020` is **not a key in the committed `anno-regbits.json`**
   -- `grep -c '"\$D020"' anno-regbits.json` (case-insensitive) returns 0,
   confirmed directly against the committed file.
2. `anno-regbits-gen.ts`'s `OVERRIDES` table (the hand-curated escape hatch
   for a register `memmap.json`'s own per-bit `desc` text cannot mechanically
   derive fields from) also carries **no `$D020` entry**.
3. `memmap.json`'s own two `$D020`/53280 rows describe it as "Border color
   (only bits #0-#3)" -- a single scalar 4-bit VALUE (a palette index),
   never a set of independently named flag bits the way `$D011`/`$D018`
   are. There is no per-bit `desc` text to mechanically decompose, and
   nothing in this project's shipped code infers a "one variant per
   distinct value written" enum for a register that carries no curated
   bit-field entry at all.

This is architecturally consistent with `.planning/phases/45-decomposition-to-closure-disagreement-first/45-CONTEXT.md`'s own Flag 3
("Every other fixture touches $D020, $D021 or $01 only. There is no second
candidate among the committed fixtures" for the multi-bit decomposition
demo, `fixtures/ghidra/charset-phantom.prg` being the one and only home) --
this family's fixtures were never candidates for D-16/D-17's multi-bit
decoder, and the plain `generateEnumsFromStore()` pairing route additionally
requires the SAME curated bit-field table before it will pair anything at
all, which `$D020` never has.

**This plan does NOT hand-edit `anno-regbits.json` or `anno-regbits-gen.ts`**
to manufacture an entry for `$D020` -- both are outside this plan's own
`files_modified`, `anno-regbits.json` is generated-but-committed and this
plan's own `must_haves.prohibitions` forbids hand-editing it, and widening
the curated table's own inclusion rule (to admit a plain value register with
no bit fields) is an architectural change to a shared generator every other
register in the project reads, not a fixture-closure edit. This is disclosed
as a plan-vs-measured-code discrepancy rather than silently worked around:
**Task 3's own acceptance criterion "Every fixture that writes a hardware
register carries at least one project enum and one enum usage binding" and
its own `<verify>` command for `dxa/tracer.prg` do not pass for this
family, and cannot without a change to `anno-regbits.json`'s own generation
rule that is out of this plan's scope.** See `SUMMARY.md`'s own Deviations
section.

**`buildEnumGenerationReport()` output, verbatim, per fixture:**

```
dxa/tracer.prg:
{
  "totalRegisterStores": 0,
  "pairedStores": 0,
  "unpairedStores": 0,
  "pass1Truncated": false,
  "pass2Truncated": false,
  "enums": [],
  "summaryLines": [
    "total register stores seen: 0",
    "paired (adjacent lda #imm found): 0",
    "unpaired (no adjacent immediate load): 0"
  ]
}

dxa/fixture.prg:
{
  "totalRegisterStores": 0,
  "pairedStores": 0,
  "unpairedStores": 0,
  "pass1Truncated": false,
  "pass2Truncated": false,
  "enums": [],
  "summaryLines": [
    "total register stores seen: 0",
    "paired (adjacent lda #imm found): 0",
    "unpaired (no adjacent immediate load): 0"
  ]
}

export-asm/smc.prg:
{
  "totalRegisterStores": 0,
  "pairedStores": 0,
  "unpairedStores": 0,
  "pass1Truncated": false,
  "pass2Truncated": false,
  "enums": [],
  "summaryLines": [
    "total register stores seen: 0",
    "paired (adjacent lda #imm found): 0",
    "unpaired (no adjacent immediate load): 0"
  ]
}
```

No truncation was reported for any pass on any fixture (`pass1Truncated` /
`pass2Truncated` both `false` throughout).

### The gate, per fixture, real CLI output, run against the FINAL committed store

`node src/skills/routine-queue-walker/scripts/completeness-report.mjs --store <fixture>.annostore --disagreements <fixture>-disagreements.json --manifest src/mcp/vice/fixtures/decomp-execution-manifest.json`, against a live store freshly re-imported from each fixture's own FINAL committed `.annostore.json`:

```
decomposition completeness: dxa/tracer.prg
  FIXTURE: dxa/tracer.prg
  EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).

  BYTE CENSUS (denominator 21)
    byte: 15 of 21
    code: 6 of 21
    undefined: 0 of 21

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 21)
    none
  AGREEMENT: 3 of 21
  NO OBSERVATION: 18 of 21
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (8 range(s)) -- unchanged from plan 45-06 (byte-derived / observed-executing)

  ENTRY POINTS (1 of 1)
    $0801  tracer_entry  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (0 resolved of 0)
    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

```
decomposition completeness: dxa/fixture.prg
  FIXTURE: dxa/fixture.prg
  EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).

  BYTE CENSUS (denominator 279)
    byte: 246 of 279
    code: 33 of 279
    undefined: 0 of 279

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 279)
    none
  AGREEMENT: 8 of 279
  NO OBSERVATION: 271 of 279
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (96 range(s)) -- unchanged from plan 45-06

  ENTRY POINTS (1 of 1)
    $0801  fixture_entry  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (7 resolved of 7)
    RESOLVED: $00fb, $00fc, $0817, $08ab, $08ae, $08bf, $08df
    DECLINED: none
    UNRESOLVED: none

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

```
decomposition completeness: dxa/basic-stub.prg
  FIXTURE: dxa/basic-stub.prg
  NOT EXECUTED: A 12-byte canonical 10 SYS 2064 BASIC stub followed by 4 arbitrary bytes (aa bb cc dd) explicitly built as unknown-region ground truth, never real code -- running it would SYS 2064 into four garbage bytes with no defined behaviour, and the fixture's own purpose (byte-derived partition ground truth) does not depend on execution.

  BYTE CENSUS (denominator 16)
    byte: 16 of 16
    undefined: 0 of 16

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 16)
    none
  AGREEMENT: 0 of 16
  NO OBSERVATION: 16 of 16
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (6 range(s)) -- unchanged from plan 45-06

  ENTRY POINTS (1 of 1)
    $0801  basic_stub_entry  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (0 resolved of 0)
    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

```
decomposition completeness: export-asm/smc.prg
  FIXTURE: export-asm/smc.prg
  EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).

  BYTE CENSUS (denominator 11)
    code: 11 of 11
    undefined: 0 of 11

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 11)
    none
  AGREEMENT: 1 of 11
  NO OBSERVATION: 10 of 11
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (4 range(s)) -- unchanged from plan 45-06

  ENTRY POINTS (1 of 1)
    $0801  smc_loop_entry  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (1 resolved of 2)
    RESOLVED: $0801
    DECLINED: $0802 (this is smc.prg's own self-modified operand byte -- the immediate operand of the LDA #$00 at $0801, rewritten in place by INC $0802 every loop iteration. Its effective value varies per iteration by construction (0, 1, 2, ... wrapping at 256) and there is no single correct symbol or value to name here -- see export-asm/README.md.)
    UNRESOLVED: none

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

```
decomposition completeness: petcat/computed-sys.prg
  FIXTURE: petcat/computed-sys.prg
  NOT EXECUTED: Pure BASIC (10 sys peek(43)+256*peek(44)) with no machine-code payload of its own; the computed SYS target depends on runtime BASIC-pointer state this standalone fixture never establishes meaningfully. Its entire purpose (petcat.decode's computed-vs-literal SYS handover verdict) is about the BASIC tokenization/decode layer, not about running the program.

  BYTE CENSUS (denominator 24)
    byte: 24 of 24
    undefined: 0 of 24

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 24)
    none
  AGREEMENT: 0 of 24
  NO OBSERVATION: 24 of 24
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (8 range(s)) -- unchanged from plan 45-06

  ENTRY POINTS (1 of 1)
    $0801  computed_sys_program_start  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (0 resolved of 0)
    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

```
decomposition completeness: petcat/not-basic.prg
  FIXTURE: petcat/not-basic.prg
  NOT EXECUTED: 64 deterministic non-BASIC bytes ((i*7+3) mod 256), the PREP-04 planted-failure fixture for petcat.decode's non-vacuous control. By construction it is not a program; it exists to make petcat.decode refuse it.

  BYTE CENSUS (denominator 62)
    byte: 62 of 62
    undefined: 0 of 62

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 62)
    none
  AGREEMENT: 0 of 62
  NO OBSERVATION: 62 of 62
  DISAGREEMENT RESOLUTION: 0 accepted, 0 unresolved of 0

  RANGE PROVENANCE (21 range(s)) -- unchanged from plan 45-06

  ENTRY POINTS (1 of 1)
    $0a03  not_basic_data_start  hasName=true  purpose comment complete

  REFERENCED NON-HARDWARE ADDRESSES (0 resolved of 0)
    none -- a zero-referenced-address count is a fact about the candidate set, never evidence of completeness.

  GATE: PASS -- every measure above cleared its own bar.
exit=0
```

**All six gates PASS, exit=0.** The three NOT EXECUTED fixtures still carry
their own manifest-sourced `NOT EXECUTED` line on a green run, exactly as
D-13's anti-vacuity guard requires -- a green gate on a non-executed fixture
still says so by name.

## Host state

`pgrep -x x64sc`: empty throughout this plan's work -- no emulator was ever
launched (no execution was needed; all six fixtures' evidence was already
captured by plan 45-06, and this plan only reads `anno evid-disagreements`
against the already-imported live scratch stores, never re-runs VICE).
`.c64-re-tools/phase45-08-scratch/` is gitignored scratch, never a
deliverable.
