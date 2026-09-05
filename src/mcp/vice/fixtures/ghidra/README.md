# fixtures/ghidra -- provenance

## `bank.a` / `bank.prg` (36-03, `VolatileCarve.java`'s own hazard fixture)

`bank.a` is copied UNCHANGED from
`.planning/notes/dxa-ghidra-pivot-evidence/bank.a` -- the fixture the
volatile-block dead-store-elimination hazard was originally demonstrated on
(see `.planning/ROADMAP.md` -- Standing Constraints, "Ghidra deletes hardware
writes as dead stores unless the I/O ranges are marked volatile"). Its own
comment names what it exercises: "the SAME address means different things
under different $01" -- three passes over `$D020` and one over `$D000,x`,
each under a different `$01` banking value, so a correct volatile carve must
preserve every one of the writes (and the one read) below regardless of
which bank is active at the time.

**Exact ACME command, version, date:**

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.

$ acme -f cbm -o fixtures/ghidra/bank.prg fixtures/ghidra/bank.a
[exit 0]
```

Run 2026-09-04 at `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/`.

**Resulting artifacts:**

| File | Bytes | sha256 |
|---|---|---|
| `bank.a` | 963 | `ab400073d00a39ae5b01af065ab03df59b84fef95270635cae5411e100dfb265` |
| `bank.prg` | 60 | `e46e71e1ffbfc196d1eb04d3a14f6ae638502225be56c996f0a090650ded2384` |

`bank.prg`'s first two bytes are `$01 $08` -- a `.prg` load-address header for
origin `$0801`. The 12-byte canonical `10 SYS 2064` BASIC stub occupies
`$0801-$080c`; three implicit zero-padding bytes fill `$080d-$080f` (the
source's own `* = $0810` directive skips ahead without emitting them
explicitly); the fixture's actual code begins at `$0810` (the `start:`
label).

**CORRECTED 2026-09-04 (plan 36-05).** The table below was originally
hand-traced assuming a real C64 loader's convention -- that the `.prg`
file's own two-byte load-address header is STRIPPED before the remaining
bytes are loaded at the header's own address. MEASURED this session, real
Ghidra 12.1.3, against `ghidra.analyze`'s actual `"prg"` route: it is not.
`BinaryLoader` (the loader `ghidra.analyze` always uses, a fixed literal on
both routes) has no concept of the `.prg` format at all -- it loads the
ENTIRE 60-byte file, header included, as raw content starting at
`loaderBaseAddr` ($0801 by default). The header's own two bytes therefore
occupy $0801-$0802 as ordinary memory content, and every address after them
is shifted TWO BYTES LATER than `bank.a`'s own source labels. The fixture's
actual first instruction (`lda #$37`, `start:` in the source) is therefore
loaded at **$0812**, not $0810 -- an entry point of `$0810` on this route
disassembles a padding zero byte (`BRK`) and stops immediately, MEASURED
this session as the original symptom that surfaced this correction. The
flat-64K route does not have this problem: `generateFlat64kVariant()`
(`ghidra-live.test.ts`) strips the two header bytes itself before embedding
the body, so `$0810` is the correct entry point THERE, and the table below's
values were already correct for that route.

**MEASURED reference-dump lines this fixture yields under a correct volatile
carve, flat-64K route** (`VolatileCarve.java`'s `SPLIT_AT`/`VOLATILE_RANGES`
applied, then `GhidraStructExport.java`'s `## REFERENCES` section, entry
point `$0810`) -- the four `sta $01`/`lda $01`-equivalent writes at
`$0812`/`$081c`/`$0828`/`$0837`, the two `sta $d020` writes at
`$0816`/`$0820`, and the one `lda $d020` read at `$0823`:

```
0812 -> 0001 WRITE
0816 -> d020 WRITE
081c -> 0001 WRITE
0820 -> d020 WRITE
0823 -> d020 READ
0828 -> 0001 WRITE
0837 -> 0001 WRITE
```

**MEASURED reference-dump lines this fixture yields under a correct volatile
carve, `.prg` route** (same script pair, `-loader-baseAddr 0x801`, entry
point `$0812` -- every address TWO BYTES LATER than the flat-64K route's own,
for the reason explained above):

```
0814 -> 0001 WRITE
0818 -> d020 WRITE
081e -> 0001 WRITE
0822 -> d020 WRITE
0825 -> d020 READ
082a -> 0001 WRITE
0839 -> 0001 WRITE
```

**A note on a different, similarly-shaped set of lines.** `36-RESEARCH.md`
(Pitfall: `MemoryConflictException` route-dependence) quotes a
MEASURED reference-dump proof at different addresses entirely --
`4002 -> d020 WRITE`, `4007 -> d020 WRITE`, `400a -> 0001 READ`,
`400e -> 0001 WRITE`. Those four lines come from a DIFFERENT fixture (a
flat-64K image based at `$4000`), carried into that research document from an
earlier exploration session, not from `bank.a`/`bank.prg` above. A later
reader comparing the two sets against this committed fixture should not
expect them to match -- the seven lines recorded in this README are the ones
`bank.a`/`bank.prg` actually produce.

## `runlog-benign-base0-conflict.txt` (36-03, Task 3)

A real captured `analyzeHeadless` run log from a base-0 import whose image
covers the zero page and the stack (`$0000-$01FF`), demonstrating the
naive-grep false-fire hazard `ghidra-harness-gates.test.ts` proves.

**Command (via the `ghidra.analyze` host tool, `importRoute: "flat64k"`,
`loaderBaseAddr` defaulted to `0x0`):**

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request \
    '{"tool":"ghidra.analyze","args":{"runId":"benign-base0","importPath":"base0.bin","processor":"6502:LE:16:default","importRoute":"flat64k"}}'
```

Image: 4096 bytes of cryptographically-random content (`node:crypto`'s
`randomBytes(4096)`), based at `$0000` (the default `flat64k`-route base
address). Process exit status: **0**. Date: 2026-09-04.

**Committed fixture:** 74 lines, sha256
`3e2cb7b1c262a0cf683d093e73c60950ad764522f32ef1ccfab836b24ade64f3`.

Contains the two MEASURED benign lines verbatim:

```
Failed to add language defined memory block due to conflict: ZERO_PAGE: start_address=0x0000, uninitialized, length=0x100
Failed to add language defined memory block due to conflict: STACK: start_address=0x0100, uninitialized, length=0x100
```

**The trigger is the image covering the first two pages, not the image being
64K.** MEASURED this session at a 4096-byte base-0 image, not a full 65,536-
byte one -- a naive log-classifier exemption scoped to "the flat-64K route"
specifically would be narrower than the real hazard and would miss this
smaller image just as easily as a real corpus release based at `$0000`.

## `runlog-script-error.txt` (36-03, Task 3)

A real captured `analyzeHeadless` run log from a run whose post-script threw
-- produced by running `GhidraStructExport.java` with a deliberately wrong
expected classification line count (script argument 1), so the script's own
internal equality assertion fails and throws for real, not as a simulated
log line.

**Command** (the `postScript` field must be the FULL workspace-relative
path, `vendor/ghidra-scripts/GhidraStructExport.java`, not the bare
filename -- `ghidra.analyze`'s seam resolves `postScript` through the same
`resolveWorkspacePath()` site it resolves `importPath` through, independent
of `scriptPath`; a bare filename resolves against the workspace ROOT and
Ghidra reports `Script not found`, MEASURED this session on the first
attempt before this was corrected):

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request \
    '{"tool":"ghidra.analyze","args":{"runId":"script-error","importPath":"bank.prg","processor":"6502:LE:16:default","importRoute":"prg","noanalysis":true,"scriptPath":"vendor/ghidra-scripts","postScript":"vendor/ghidra-scripts/GhidraStructExport.java","exportPath":"export.txt","expectedClassificationLines":1}}'
```

Image: `bank.prg` (the committed fixture above, 60 bytes, `.prg` route, base
`$0801`). Process exit status recorded for this run: **0** --
`analyzeHeadless` exits 0 even though the post-script threw an exception.
This is the entire reason a run-log CLASSIFIER, never the exit status, is
the signal `ghidra-harness-gates.test.ts` exercises. Date: 2026-09-04.

**Committed fixture:** 77 lines, sha256
`b3378dc4e4a8608ecf72bea05aa6135dec17f403a393ae3fd9c280a91707f2c0`. The run
log's own printed lines show `GhidraStructExport.java` computed a block
total of 572 (the `.prg` route's classified address space, not `bank.prg`'s
60-byte file size), then threw because script argument 1 planted an
override of `1`:

```
GhidraStructExport.java> CLASSIFICATION_EXPECTED_FROM_BLOCKS: 572 (GhidraScript)
GhidraStructExport.java> CLASSIFICATION_OBSERVED: 572 (GhidraScript)
ERROR REPORT SCRIPT ERROR:  (HeadlessAnalyzer) java.lang.IllegalStateException: GhidraStructExport: exported 572 classification lines but expected 1 (block-total expectation=572). Refusing a short export.
```

## Opcode sweep layout (36-06, `ghidra-opcode-live.test.ts`'s `generateOpcodeSweep()`)

Not a committed fixture -- generated fresh into the caller's own scratch
workspace on every call, never committed (D-36-17). Recorded here so the
layout is readable without re-running the generator.

**Rule:** on the flat-64K route, one byte of the tested set occupies its own
fixed-size 4-byte slot at a computable address:

```
slot(i) address = baseAddr + i * 4          (i = 0, 1, 2, ... in the caller's own byte-array order)
slot(i) byte 0   = the opcode under test
slot(i) byte 1-2 = 0xEA (documented NOP filler)
slot(i) byte 3   = 0x60 (documented RTS terminator)
```

`baseAddr` differs per task (`0x2000` for the full 105-byte sweep, `0x3000`
for the six unstable/page-crossing representatives, `0x4000` for the
15-byte 65C02 overlap set) so the three sweeps never collide inside the same
64K image, though each is generated into its own separate image regardless.

**Why a terminator, not just NOP filler.** MEASURED this plan: a slot with no
terminator lets `analyzeAll()`'s own fall-through disassembly run each
seeded "function" off the end of the image with no discovered exit --
`DecompInterface` reports every one of them `DECOMPILE_FAILED` (0 decompiled
of N attempted), so `## DECOMPILED_TEXT` carries nothing to check at all. A
documented RTS ($60) at the LAST byte of each 4-byte slot bounds every
slot's own function without ever overlapping the instruction itself: the
longest undocumented instruction is 3 bytes (opcode + a 2-byte
absolute/absolute-indexed operand -- every `UOP` addressing mode in the
committed `.sinc` tops out there), so the terminator always lands on the one
byte no instruction can reach. With the terminator present, every slot in
every sweep this plan ran decompiled cleanly (0 failed, 0 timed out).

Every slot also gets its own explicit entry point, written one hex address
per line into the run's `entrypointsPath` file, so no slot's decode depends
on fall-through from the slot before it.

## `bank-path-dependent.a` / `bank-path-dependent.prg` (37-02, the two-caller path-dependent `$01` fixture)

`bank.a` above is MEASURED (`37-RESEARCH.md` § D) to be straight-line code:
three separate `$D020` program points, none of them reached from two callers
or two bank contexts, so it cannot exercise `AUTO-04`/`AUTO-05`'s
path-dependent-bank-state criteria -- a flip/decline control run against it
would be vacuous. `bank-path-dependent.a` exists to fix exactly that: it
calls one subroutine, `probe`, TWICE -- once right after `$01=$34`, once
right after `$01=$33` -- so `probe`'s own `sta $d020` and `lda $d000,x`
instructions each occupy exactly ONE address, reached from TWO callers,
under two determinate and DIFFERENT bank states.

The two decodes, recorded as facts:
- `$34` = `%00110100` -- bits 1-0 (LORAM/HIRAM) clear, so `$D000-$DFFF` reads
  as RAM regardless of bit 2 (CHAREN). `bank.a`'s own inline comment
  mislabels `$34` as having bit 2 clear -- it does not, bit 2 (`0b100`) is
  SET in `$34` -- but the RAM outcome it states is nevertheless right,
  because the RAM case depends only on bits 1-0.
- `$33` = `%00110011` -- bits 1-0 set, bit 2 clear, so `$D000-$DFFF` is
  Character ROM.

**Exact ACME command, version, date:**

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.

$ acme -f cbm -o fixtures/ghidra/bank-path-dependent.prg fixtures/ghidra/bank-path-dependent.a
[exit 0]
```

Run 2026-09-05 at `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/`.

**Resulting artifacts:**

| File | Bytes | sha256 |
|---|---|---|
| `bank-path-dependent.a` | 2135 | `9f118e7a442b39766b43d3b1772156e14463f6c61c06199ef26536adff0c3e95` |
| `bank-path-dependent.prg` | 52 | `5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078` |

`bank-path-dependent.prg`'s first two bytes are `$01 $08` -- a `.prg` load-address
header for origin `$0801`, identical in shape to `bank.a`/`bank.prg` above.

**The `.prg`-route two-byte offset applies here exactly as it does to
`bank.a`/`bank.prg` above** (see the "CORRECTED 2026-09-04" paragraph in that
section): `BinaryLoader` loads the entire file, header included, as raw
content starting at `loaderBaseAddr` ($0801 by default), so every address on
the `.prg` route is TWO BYTES LATER than this source's own labels. The
flat-64K route strips the two header bytes before embedding the body (per
`generateFlat64kVariant()`), so its addresses match the source's own labels
unshifted.

**Address trace, read off a real ACME report (`acme -r`), never hand-traced:**

| Instruction | Flat-64K route | `.prg` route |
|---|---|---|
| `start:` (`sei`) | `$0810` | `$0812` |
| `sta $01` (call 1, `$01=$34`) | `$0813` | `$0815` |
| `jsr probe` (call 1) | `$0815` | `$0817` |
| `sta $01` (call 2, `$01=$33`) | `$081a` | `$081c` |
| `jsr probe` (call 2) | `$081c` | `$081e` |
| `probe:` (`lda #$aa`) | `$0825` | `$0827` |
| `sta $d020` (the shared write) | `$0827` | `$0829` |
| `lda $d000,x` (the shared read) | `$082c` | `$082e` |

The `.prg`-route column is the source-label column shifted +2, confirmed by
running `acme -f cbm -o /tmp/check.prg -r /tmp/report.txt
fixtures/ghidra/bank-path-dependent.a` and reading the flat-64K-equivalent
(source-label) addresses directly off the report's own byte-offset column,
then applying the +2 correction measured on `bank.a`/`bank.prg` -- both
routes are also confirmed against a real `analyzeHeadless` run in Task 3 of
plan 37-02 (see `export-bank-path-dependent.txt`'s own README entry below).

**A NEW finding this fixture exposes, `.prg` route ONLY: an internal `jsr`'s
own operand target is NOT corrected for the two-byte shift, so `probe` is
NOT reached correctly on this route.** `bank.a` has no internal control-flow
instruction at all (no `jsr`/`jmp` to a label inside the same image), so this
was never observable there -- MEASURED this plan, real Ghidra 12.1.3, first
observation on this fixture. ACME assembles `jsr probe`'s two-byte absolute
operand using the SOURCE's own address space (`probe:` at source label
`$0825`), which assumes a real C64 loader strips the file's own two-byte
header before loading -- exactly what `generateFlat64kVariant()` does, and
exactly what `BinaryLoader` on the `.prg` route does NOT do (per the
"CORRECTED 2026-09-04" paragraph above). The result: on the `.prg` route,
both `jsr probe` instructions (now themselves at `$0817`/`$081e`, correctly
shifted) still carry the UNSHIFTED operand value `$0825` baked in by ACME,
which is TWO BYTES BEFORE `probe`'s real, shifted load address (`$0827`) --
so the call lands on `$0825`, which under the `.prg` route's own byte
layout is the tail end of the CALLER's own code (`cli` / `rts`, MEASURED:
`FUN_0825` decompiles to an empty `{ return; }` body), never `probe` at all.
Consequence, MEASURED: on the `.prg` route only, `probe`'s real body (the
border-colour write, the character-ROM read) is never executed and never
appears in `## REFERENCES` at all; the two `sta $01` writes at the CALLER
level are UNAFFECTED (their own addresses and constant values are correct on
both routes, since they involve no internal address reference) and are what
`## CONST_WRITES` reads. The flat-64K route has no such defect -- its own
call target (`$0825`) and `probe`'s own real load address (`$0825`) agree,
because `generateFlat64kVariant()` strips the header exactly as a real C64
loader would. Plan 37-02's own live tests therefore assert the
"shared-program-point, reached from two distinct call sites" claim ONLY on
the flat-64K route (where it is measurably true) and assert only the
$01-differs claim on the `.prg` route (which remains true there). This is a
general limitation of `ghidra.analyze`'s own `.prg` import route for ANY
fixture with an internal absolute code reference, not specific to this
fixture's own construction -- recorded here as the first fixture to expose
it.

## `export-bank-path-dependent.txt` (37-02, Task 3 -- the real `## CONST_WRITES` capture)

A REAL, unedited `analyzeHeadless` export over `bank-path-dependent.prg`, the
`.prg` route (chosen over the flat-64K route to match the size and format of
every other committed export/run-log fixture in this directory -- a
committed flat-64K capture would carry one `## CLASSIFICATION` line per byte
of a 65,536-byte image, ~700KB, which no other fixture here does; see
D-36-17's own "generated fresh, never committed" convention for flat-64K
material). Per the finding immediately above, the `.prg` route's own
internal-`jsr` defect means this specific capture's `## REFERENCES` section
carries no border-colour or Character-ROM access at all -- `## CONST_WRITES`
is unaffected (its facts come from the caller-level `sta $01` writes only)
and is exactly what this capture exists to prove.

**Command, version, date:**

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.
```

`ghidra.analyze` arguments: `importPath: "bank-path-dependent.prg"`,
`processor: "6502:LE:16:nmos"`, `importRoute: "prg"`, `noanalysis: true`,
`preScript: "vendor/ghidra-scripts/VolatileCarve.java"`,
`entrypointsPath` containing `$0812` (this fixture's own `.prg`-route entry
point, per the address trace above), `postScript:
"vendor/ghidra-scripts/GhidraStructExport.java"`. Ghidra version: 12.1.3
(read from the installation, per `EXPECTED_GHIDRA_VERSION` in
`ghidra-live.test.ts`). Run 2026-09-05. Process exit status: **0**.

**Committed fixture:** 4719 lines, 52417 bytes, sha256
`d02a7a2705f171e07f21ea98fd608df2e175d507faed324e96e2512ae1497882`.

**The `## CONST_WRITES` section this capture carries, verbatim:**

```
## CONST_WRITES
0815 0001 0x34
081c 0001 0x33
0823 0001 0x37
## CONST_WRITES_COUNT 3
```

Three facts: the two flip values (`0x34` at `$0815`, `0x33` at `$081c`) plus
the trailing restore write (`0x37` at `$0823`) -- two distinct values already
satisfies this plan's own non-vacuity requirement, and the third is recorded
rather than filtered, since the exporter's own contract is "every resolved
constant store to a watched address", not "only the ones a later reader
finds interesting".

## `charset-phantom.a` / `charset-phantom.prg` (37-08, the graphics-feedback before/after fixture)

`AUTO-07`'s own criterion needs a fixture that (a) writes a complete,
recovered `$DD00`/`$D018`/`$D011` combination, so `anno-graphics.ts`'s
`deriveGraphicsRanges()` has real input to derive a character-set range from,
and (b) places, inside that exact derived range, a byte pattern that decodes
as plausible-looking 6502 code when nothing marks it as data -- so the
before/after label-set comparison is non-vacuous. Neither `bank.a` nor
`bank-path-dependent.a` writes any of the three VIC registers at all
(MEASURED: neither source contains `$dd00`/`$d018`/`$d011` anywhere), so a
new fixture was required.

**The three register values, decoded (matching `anno-graphics.ts`'s own
arithmetic, cross-checked by hand against the source's own header comment):**
- `$DD00 = $3f` -- bits #0-#1 = `%11` -- VIC bank select inverts to 0 -- bank
  base `$0000`.
- `$D018 = $04` -- high nibble `0` -- screen matrix at `$0000` (1024 bytes);
  low nibble `$4` (`%0100`), bits #1-#3 = `%010` = 2 -- character-or-bitmap
  base = bank base + 2*2048 = **`$1000`**.
- `$D011 = $1b` -- bit #5 clear -- character-set mode (not bitmap), size
  2048 bytes.

Derived character-set range: **`$1000`-`$17ff`** (2048 bytes, matching
`CHARACTER_SET_SIZE`).

**The charset block's own bytes, and why they were chosen.** 511 four-byte
blocks of `jsr <next-block>` / `rts`, each `jsr` targeting the block
immediately following it (via ACME's own `!for i, 0, 510 { jsr * + 4 ; rts }`
loop, MEASURED to assemble to exactly the intended chained-call byte pattern
this session), plus a final four-byte `rts`/`rts`/`rts`/`rts` block that
terminates the chain safely inside the range (511\*4 + 4 = 2048 bytes
exactly -- the whole derived range, no more, no less). `start`'s own single
`jsr charset_start` is the ONE real reference into this region, standing in
for whatever caused a real analyser to look here in the first place (the
requirement's own "phantom routine inside a character set is promoted to a
function" story) -- from there, ordinary call-reference-driven code discovery
follows the chain, decoding one 4-byte "function" after another for the
whole 2048-byte range when nothing marks it as data first.

**Exact ACME command, version, date:**

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.

$ acme -f cbm -o fixtures/ghidra/charset-phantom.prg fixtures/ghidra/charset-phantom.a
[exit 0]
```

Run 2026-09-05 at `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/`.

**Resulting artifacts:**

| File | Bytes | sha256 |
|---|---|---|
| `charset-phantom.a` | 2899 | `998037fbdd2b04711a881c55efbb186138698064108c0f23763fb462e479e115` |
| `charset-phantom.prg` | 4097 | `accff20636b1b763a9bcc92b1ff29889a5dcc69fa08536f6f4f7de7f833bc203` |

`charset-phantom.prg`'s first two bytes are `$01 $08` -- a `.prg` load-address
header for origin `$0801`, identical in shape to every prior fixture in this
directory. The 12-byte canonical `10 SYS 2064` BASIC stub occupies
`$0801-$080c`; three implicit zero-padding bytes fill `$080d-$080f`; the
fixture's real code begins at `$0810` (`start:`); a `* = $1000` directive
after `start`'s own `rts` pads the gap (`$0823-$0fff`) with zero bytes before
the charset block begins.

**Address trace, read off a real ACME report (`acme -r`), never hand-traced,**
flat-64K route (source labels, unshifted -- `generateFlat64kVariant()` strips
the two header bytes before embedding the body, exactly as every prior
fixture's own trace states):

| Instruction | Flat-64K route | `.prg` route |
|---|---|---|
| `start:` (`lda #$3f`) | `$0810` | `$0812` |
| `sta $dd00` | `$0812` | `$0814` |
| `sta $d018` | `$0817` | `$0819` |
| `sta $d011` | `$081c` | `$081e` |
| `jsr charset_start` | `$081f` | `$0821` |
| `rts` (end of `start`) | `$0822` | `$0824` |
| `charset_start:` | `$1000` | `$1002` |

**The `.prg` route's own two-byte shift makes it UNUSABLE for this specific
proof, and the phantom-label before/after comparison is therefore asserted
on the flat-64K route ONLY.** This is a NEW consequence of the
already-documented per-route offset (the "CORRECTED 2026-09-04" paragraph
under `bank.a` above), not a new defect: `anno-graphics.ts`'s derived range
(`$1000-$17ff`) is computed PURELY from the register VALUES this fixture
writes -- a fact about the C64's own real hardware address space, entirely
independent of where `ghidra.analyze` happens to import the image bytes.
On the flat-64K route those two coordinate systems coincide (`charset_start`
loads at `$1000`, matching the derived range exactly). On the `.prg` route
`BinaryLoader`'s own header-inclusive load shifts EVERY address two bytes
later, so `charset_start` loads at `$1002` -- the charset bytes and the
register-derived range would disagree by two bytes, misclassifying the first
two bytes of the real chain as outside the range and the last two bytes of
whatever precedes it as inside. Asserting the before/after proof there would
compare the wrong two-byte window rather than the fixture's own real charset
block. `.prg`-route CONST_WRITES facts (the three register values themselves)
are UNAFFECTED by this -- they carry no internal address reference, exactly
like `bank-path-dependent.a`'s own caller-level `sta $01` writes -- so the
`.prg` route's own gated case in `ghidra-live.test.ts` still exercises the
CONST_WRITES parse and the graphics derivation's own arithmetic; only the
live phantom-label capture is flat-64K-only, and its case says so.
