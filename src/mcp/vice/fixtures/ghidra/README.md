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
