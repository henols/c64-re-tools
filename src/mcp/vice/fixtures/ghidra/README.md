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

**MEASURED reference-dump lines this fixture yields under a correct volatile
carve** (`VolatileCarve.java`'s `SPLIT_AT`/`VOLATILE_RANGES` applied, then
`GhidraStructExport.java`'s `## REFERENCES` section, `.prg` route,
`-loader-baseAddr 0x801`) -- the four `sta $01`/`lda $01`-equivalent writes at
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

Image: 4096 bytes of `/dev/urandom` content, based at `$0000` (the default
`flat64k`-route base address). Process exit status: **0**. Date: 2026-09-04.

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

**Command:**

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request \
    '{"tool":"ghidra.analyze","args":{"runId":"script-error","importPath":"bank.prg","processor":"6502:LE:16:default","importRoute":"prg","scriptPath":"vendor/ghidra-scripts","postScript":"GhidraStructExport.java","exportPath":"export.txt","expectedClassificationLines":1}}'
```

Process exit status recorded for this run: **0** -- `analyzeHeadless` exits 0
even though the post-script threw an exception. This is the entire reason a
run-log CLASSIFIER, never the exit status, is the signal
`ghidra-harness-gates.test.ts` exercises. Date: 2026-09-04.
