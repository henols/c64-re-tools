# 36-05 — the volatile carve proven by disappearance, on both import routes

All runs below were driven through `runGhidraAnalyze()` (`ghidra-run.ts`)
against a real Ghidra 12.1.3 installation, in a scratch workspace outside this
repository (D-36-12), never through a click-path. Every wire request shown is
the exact object passed to `runGhidraAnalyze()`; `repoRoot` pointed at the
scratch workspace in every case. The committed scripts, the committed
fixtures and this repository's own run directory (`tools/ghidra-runs/`) were
confirmed unchanged (`git status --porcelain`) after every run in this file.

## A MEASURED correction to this plan's own premise, made before Part 1

This plan's own action text expected the volatile carve's effect to be
observable in `GhidraStructExport.java`'s `## REFERENCES` section. **MEASURED
this session, real Ghidra 12.1.3: it is not.** `## REFERENCES` is populated
from the reference manager — one entry per operand reference established at
DISASSEMBLY time. A memory-write instruction's own reference to its target
address survives in this list regardless of whether the target range is
volatile: dead-store elimination is a DECOMPILER-layer, per-function,
p-code-level transformation, and it does not remove or alter the listing's
own reference database. Run twice over the identical program — once with the
committed script's flag left in place, once with a scratch copy that
neutralises it — `## REFERENCES` came back **byte-identical** both times (see
Part 2's own diff). A harness checking only this section would observe no
difference at all and wrongly conclude the carve made no difference.

The actual, real, MEASURED dead-store elimination this project's Standing
Constraint describes (and `.planning/notes/ghidra-volatile-io-and-banking.md`
originally demonstrated) is visible only in **decompiled C text** — the
`DecompInterface` output `GhidraStructExport.java` already computed internally
for its structural-fact regexes but never printed anywhere. This plan
therefore adds one new, purely additive section to the committed
`GhidraStructExport.java` — `## DECOMPILED_TEXT`, one function per entry: its
entry point, its name, and its full decompiled C body verbatim — and asserts
the disappearance THERE instead. This is a **[Rule 2 — missing critical]**
deviation from this plan's stated `files_modified` (which named only
`ghidra-live.test.ts` and this evidence file): without this section, the
plan's own criterion cannot be proven true or false by this script pair at
all. See this plan's own `SUMMARY.md` for the full deviation record,
including why the change is additive and safe for the two prior plans'
existing live tests (36-04) that already parse this export format.

A second, related correction was made and is recorded in
`fixtures/ghidra/README.md` (**[Rule 1 — bug]**): that file's own
"MEASURED reference-dump lines" table was hand-traced assuming a real C64
loader's convention — that the `.prg` file's own two-byte load-address header
is stripped before the remaining bytes are loaded. MEASURED this session:
`ghidra.analyze`'s `"prg"` route does not do this — `BinaryLoader` loads the
entire 60-byte file, header included, as raw content at `loaderBaseAddr`. The
fixture's real first instruction is therefore at `$0812` on the `.prg` route,
not `$0810` as the table originally said (an entry point of `$0810` on that
route disassembles a padding zero byte and stops — the original symptom that
surfaced this correction). The flat-64K route does not have this problem
(`generateFlat64kVariant()` strips the header itself), so `$0810` was already
correct there. `fixtures/ghidra/README.md` now carries both routes' own
corrected reference-dump tables.

## Part 1 — the with-flag reference section, on both routes

### `.prg` route

**Wire request:**

```json
{
  "runId": "vol-withflag-prg",
  "importPath": "bank.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "entrypoints.txt",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "withflag-prg-export.txt"
}
```

`entrypoints.txt` contained the single line `$0812` — the fixture's real
first instruction on this route (see the correction above).

**Block dump, before the carve:**

```
BLOCKS-BEFORE:
  ZERO_PAGE 0000-00ff vol=false
  STACK 0100-01ff vol=false
  RAM 0801-083c vol=false
NAIVE-BLOCK-AT-D000: none (.prg route)
```

**Branch taken, from the pre-script's own printed output:**

```
SPLIT-OK at 2
SPLIT-SKIP at d000: no block covers this address
SPLIT-SKIP at e000: no block covers this address
VOLATILE-SET: ZERO_PAGE 0000-0001
VOLATILE-NEW: VOL_d000 d000-dfff (.prg route -- no existing block covered this address)
VOLATILE-BLOCK-COUNT: 2
```

The processor port's own `ZERO_PAGE` default block DOES exist on this route,
so the split succeeds and the existing sub-block is flagged (the
existing-block branch). Nothing covers the I/O page at all, so the split is
skipped and the create branch fires — `VOLATILE-NEW`, a fresh block, per
D-36-14's own route dependence.

**Block dump, after the carve:**

```
BLOCKS-AFTER:
  ZERO_PAGE.split 0000-0001 vol=true
  ZERO_PAGE.split 0002-00ff vol=false
  STACK 0100-01ff vol=false
  RAM 0801-083c vol=false
  VOL_d000 d000-dfff vol=true
```

**Surviving hardware-access reference lines, verbatim, with access kind
(`## REFERENCES`, `withflag-prg-export.txt`) — 7 lines:**

```
0814 -> 0001 WRITE
0818 -> d020 WRITE
081e -> 0001 WRITE
0822 -> d020 WRITE
0825 -> d020 READ
082a -> 0001 WRITE
0839 -> 0001 WRITE
```

**The same seven accesses, as decompiled C text (`## DECOMPILED_TEXT`,
`FUNCTION 0812 FUN_0812`) — this is where the carve's real effect is
observed:**

```c
undefined1 FUN_0812(void)

{
  undefined1 uVar1;
  byte bVar2;

  DAT_0001 = 0x37;
  DAT_d020 = 5;
  DAT_0001 = 0x34;
  DAT_d020 = 0xaa;
  uVar1 = DAT_d020;
  DAT_0001 = 0x33;
  bVar2 = 0;
  do {
    *(undefined1 *)(bVar2 + 0x3000) = (&DAT_d000)[bVar2];
    bVar2 = bVar2 + 1;
  } while (bVar2 != 0);
  DAT_0001 = 0x37;
  return 0x37;
}
```

All four `$01` writes, both `$d020` writes, and the `$d020` read survive as
literal statements, in program order — matching
`.planning/notes/ghidra-volatile-io-and-banking.md` §3's own original
demonstration exactly.

### Flat-64K route

**Wire request:**

```json
{
  "runId": "vol-withflag-flat64k",
  "importPath": "bank-flat64k.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "entrypoints.txt",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "withflag-flat64k-export.txt"
}
```

`entrypoints.txt` contained `$0810` — the source's own unshifted label,
correct on this route because `generateFlat64kVariant()` strips the two
header bytes itself before embedding `bank.prg`'s own body.

**Block dump, before the carve:**

```
BLOCKS-BEFORE:
  RAM 0000-ffff vol=false
NAIVE-BLOCK-AT-D000: RAM 0000-ffff size=65536
```

The loader owns ONE block spanning the entire image — this is the route
where a loader-owned block already covers the I/O page.

**Branch taken:**

```
SPLIT-OK at 2
SPLIT-OK at d000
SPLIT-OK at e000
VOLATILE-SET: RAM 0000-0001
VOLATILE-SET: RAM.split.split d000-dfff
VOLATILE-BLOCK-COUNT: 2
```

All three splits succeed and BOTH volatile ranges flag an EXISTING
(post-split) block — no `VOLATILE-NEW` anywhere in this route's log. This is
the opposite branch from the `.prg` route's I/O-page case, confirmed as an
OBSERVED fact rather than assumed.

**Block dump, after the carve:**

```
BLOCKS-AFTER:
  RAM.split 0000-0001 vol=true
  RAM.split.split 0002-cfff vol=false
  RAM.split.split d000-dfff vol=true
  RAM.split.split.split e000-ffff vol=false
```

**Surviving hardware-access reference lines, verbatim, with access kind
(`## REFERENCES`, `withflag-flat64k-export.txt`) — 7 lines:**

```
0812 -> 0001 WRITE
0816 -> d020 WRITE
081c -> 0001 WRITE
0820 -> d020 WRITE
0823 -> d020 READ
0828 -> 0001 WRITE
0837 -> 0001 WRITE
```

**Decompiled C text (`## DECOMPILED_TEXT`, `FUNCTION 0810 FUN_0810`):**

```c
undefined1 FUN_0810(void)

{
  undefined1 uVar1;
  byte bVar2;

  DAT_0001 = 0x37;
  DAT_d020 = 5;
  DAT_0001 = 0x34;
  DAT_d020 = 0xaa;
  uVar1 = DAT_d020;
  DAT_0001 = 0x33;
  bVar2 = 0;
  do {
    *(undefined1 *)(bVar2 + 0x3000) = (&DAT_d000)[bVar2];
    bVar2 = bVar2 + 1;
  } while (bVar2 != 0);
  DAT_0001 = 0x37;
  return 0x37;
}
```

Byte-identical STATEMENT text to the `.prg` route's own decompiled function —
only the function's own entry-point address label differs, as expected: the
same source, the same seven accesses, two different routes.

**Both routes' `## REFERENCES` sections were diffed against each other's
without-flag counterparts (Part 2) and found byte-identical** — recorded
there, not here, since that comparison is Part 2's own finding.

## Part 2 — remove the flag and observe the writes vanish, on both routes

D-36-13: each without-flag case reads the COMMITTED `VolatileCarve.java`,
neutralises BOTH flag-setting calls (the existing-block branch's
`blk.setVolatile(true)` and the create branch's `nb.setVolatile(true)`, each
forced to `false`), and writes the result into its own scratch script
directory. The committed script was never written; `git status --porcelain
src/mcp/vice/vendor/ghidra-scripts/` was empty after every run in this part.

**The exact edit made (identical text substituted in both places, quoted):**

```java
// BEFORE (committed):
            blk.setVolatile(true);
// AFTER (scratch copy only):
            blk.setVolatile(false); // NEUTRALISED for the disappearance proof (scratch copy only, never committed)

// BEFORE (committed):
        nb.setVolatile(true);
// AFTER (scratch copy only):
        nb.setVolatile(false); // NEUTRALISED for the disappearance proof (scratch copy only, never committed)
```

### `.prg` route, without the flag

**Wire request** (identical to Part 1's `.prg` case except `scriptPath`,
`preScript` and `postScript` now point at the scratch copy's own directory,
and `runId`/`exportPath` are distinct so the two runs cannot collide):

```json
{
  "runId": "vol-noflag-prg",
  "importPath": "bank.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor-scratch/noflag-prg/ghidra-scripts",
  "preScript": "vendor-scratch/noflag-prg/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "entrypoints.txt",
  "postScript": "vendor-scratch/noflag-prg/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "noflag-prg-export.txt"
}
```

**`## REFERENCES` — byte-identical to Part 1's with-flag `.prg` export.** All
seven lines Part 1 recorded present are STILL present here, verbatim:

```
0814 -> 0001 WRITE
0818 -> d020 WRITE
081e -> 0001 WRITE
0822 -> d020 WRITE
0825 -> d020 READ
082a -> 0001 WRITE
0839 -> 0001 WRITE
```

This is the finding recorded above: `## REFERENCES` never reflects
volatility. The disappearance is real, but it is not visible here.

**`## DECOMPILED_TEXT` — the disappearance, per statement:**

```c
void FUN_0812(void)

{
  byte bVar1;

  DAT_d020 = 0xaa;
  bVar1 = 0;
  do {
    *(undefined1 *)(bVar1 + 0x3000) = (&DAT_d000)[bVar1];
    bVar1 = bVar1 + 1;
  } while (bVar1 != 0);
  DAT_0001 = 0x37;
  return;
}
```

**Vanished (present in Part 1's with-flag text, absent here):**

- `DAT_0001 = 0x34;`
- `DAT_0001 = 0x33;`
- `DAT_d020 = 5;`
- `= DAT_d020;` (the read — `uVar1 = DAT_d020;` in Part 1's text)

**Survived (present in both):**

- `DAT_d020 = 0xaa;` — the last write to `$d020`, no read after it
- `DAT_0001 = 0x37;` — the last write to `$01`, no read after it

**The without-flag run otherwise completed normally, reporting success:**
`analyzeHeadless` exit status `0`; the run log carries no thrown-script
signal; the export carries its own completed-assertion section
(`## UNRESOLVED_DISPATCH`, `UNRESOLVED_DISPATCH_COUNT 0`) and a non-trivial
reference count (`## REFERENCE_COUNT 10`).

**What an observer reading only the exit status, or only the export's own
count lines (classification count, reference count, the completed-assertion
section's presence), would have seen: nothing wrong at all.** Every one of
those signals is identical to the with-flag run. Three of `$01`'s four
writes and one of `$d020`'s two writes — plus the read — are gone from the
decompiled function with no warning anywhere in the export or the run log.
This is the exact failure shape the Standing Constraint names: applied to a
raster loop, this would delete the entire visible effect of the program
while every signal an unwary harness might check kept reporting success.

### Flat-64K route, without the flag

**Wire request:**

```json
{
  "runId": "vol-noflag-flat64k",
  "importPath": "bank-flat64k.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor-scratch/noflag-flat64k/ghidra-scripts",
  "preScript": "vendor-scratch/noflag-flat64k/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "entrypoints.txt",
  "postScript": "vendor-scratch/noflag-flat64k/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "noflag-flat64k-export.txt"
}
```

**`## REFERENCES` — byte-identical to Part 1's with-flag flat64k export**, all
seven lines still present verbatim (0812/0816/081c/0820/0823/0828/0837).

**`## DECOMPILED_TEXT` — the same disappearance pattern:**

```c
void FUN_0810(void)

{
  byte bVar1;

  DAT_d020 = 0xaa;
  bVar1 = 0;
  do {
    *(undefined1 *)(bVar1 + 0x3000) = (&DAT_d000)[bVar1];
    bVar1 = bVar1 + 1;
  } while (bVar1 != 0);
  DAT_0001 = 0x37;
  return;
}
```

Same vanished set (`DAT_0001 = 0x34;`, `DAT_0001 = 0x33;`, `DAT_d020 = 5;`,
the read), same surviving set (`DAT_d020 = 0xaa;`, `DAT_0001 = 0x37;`). The
without-flag run again completed normally: exit status `0`, no thrown-script
signal, `## UNRESOLVED_DISPATCH` present, `## REFERENCE_COUNT 12` (non-trivial;
this route's own reference count includes two additional lines the `.prg`
route's smaller loaded image does not reach — unrelated to the volatile
carve, both routes' counts confirmed non-trivial and unaffected by the flag).

**The committed `VolatileCarve.java` was confirmed byte-identical
(`diff`) to its own state before this part's runs**, both before and after —
the removal lived only in the two scratch copies, each torn down in a
`finally` after its own case.

