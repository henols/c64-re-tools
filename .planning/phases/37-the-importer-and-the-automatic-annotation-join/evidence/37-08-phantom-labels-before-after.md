# Phase 37 Plan 08 — Phantom labels present before the graphics feedback, absent after

**Requirement:** AUTO-07.

**Fixture:** `fixtures/ghidra/charset-phantom.a` / `.prg` (see that directory's own
`README.md` section for the full provenance table, address trace, and the reason the
`.prg` route is unusable for this specific proof).

**Ghidra version:** 12.1.3 (`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`,
read from the installation, matching `ghidra-live.test.ts`'s own `EXPECTED_GHIDRA_VERSION`).

**Route:** flat-64K only. `anno-graphics.ts`'s `deriveGraphicsRanges()` computes the
character-set range purely from the three register VALUES this fixture writes — a fact
about the C64's own real hardware address space — which coincides with Ghidra's own
import address space on the flat-64K route only. On the `.prg` route `BinaryLoader`'s
header-inclusive load shifts every address two bytes later, misaligning the derived
range against where the fixture's charset bytes actually land (see the fixtures
README's own paragraph on this). The `.prg` route's own CONST_WRITES facts are
unaffected and are exercised separately in `ghidra-live.test.ts`'s own gated case.

**Date:** 2026-09-05.

## The exact arguments (BEFORE — no graphics feedback)

```json
{
  "runId": "...",
  "importPath": "charset-phantom-flat64k.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "<file containing $0810>",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "<export file>"
}
```

No `dataRangesPath` argument. `analyzeHeadless` exit status: **0**. The run log carries
no `ERROR REPORT SCRIPT ERROR:` (no thrown script).

## The derived character-set range

Computed by `parseConstWrites()` (`anno-import.ts`) over this run's own real
`## CONST_WRITES` section, fed into `deriveGraphicsRanges()` (`anno-graphics.ts`) —
never hard-coded:

```
## CONST_WRITES
0812 dd00 0x3f
0817 d018 0x4
081c d011 0x1b
## CONST_WRITES_COUNT 3
```

`deriveGraphicsRanges()` over these three facts derives one map (a single distinct
combination), whose character-set range is:

```
start: 4096 ($1000), endInclusive: 6143 ($17ff)
```

## The source the label set was extracted from

`## DECOMPILED_TEXT`'s own `FUNCTION <address> <name>` lines — GhidraStructExport.java
emits one such line per function that decompiled successfully
(`currentProgram.getFunctionManager().getFunctions(true)`, decompile-completed only).
This is the ONLY place a minted symbol name is visible in the committed export format;
the `## CLASSIFICATION`/`## REFERENCES` sections carry addresses and access kinds but
no names.

## The before-set — MEASURED, non-empty

**513 functions total** in the whole export; **512 of them** fall inside the derived
character-set range (`$1000`-`$17ff`), one per 4-byte `jsr`/`rts` block the fixture's
own chain produces. The one function OUTSIDE the range is the fixture's own real entry
point, `FUN_0810`.

First three (by address, ascending):
```
FUN_1000 @ $1000
FUN_1004 @ $1004
FUN_1008 @ $1008
```

Last three:
```
FUN_17f4 @ $17f4
FUN_17f8 @ $17f8
FUN_17fc @ $17fc
```

The full 512-entry list is committed as measured output at
`fixtures/ghidra/charset-phantom-minted-labels.json` (`beforeLabelsInRange`), alongside
the real `## CONST_WRITES` facts and the derived range those facts produced — so a
later reader (and the hermetic automated counterpart in `anno-join.test.ts`) can
recompute or re-check the whole chain without a live Ghidra installation.

## Comparison against the ROADMAP's cited names — a CORRECTION, not a confirmation

`.planning/ROADMAP.md` (Phase 37 notes) cites three example phantom labels: `zpp_02`,
`zpa_06`, `f_1B1A`. None of the 512 real, measured names above match this pattern or
these literal tokens — every one of them is `FUN_<lowercase-hex-address>`, Ghidra
12.1.3's own genuine default function-naming convention under
`6502:LE:16:nmos` (`FunctionManager`'s default namer, unrelated to any project-specific
naming scheme). `37-RESEARCH.md` §E already flagged this discrepancy (zero matches for
the cited tokens across every committed Phase 36 evidence file) and recommended
capturing the real names rather than assuming the cited ones would reproduce — this is
that capture, and the cited names do not reproduce. Per D-37-31, no assertion anywhere
in this phase's test suite quotes `zpp_02`/`zpa_06`/`f_1B1A` — every assertion is
against the measured `FUN_*` names above, or against `beforeLabelsInRange.length > 0`
without naming a specific label at all.

## The after-set — MEASURED, empty (Task 3)

Same fixture, same route, same entry point, with `dataRangesPath` added (pointing at a
one-line range file containing `1000-17ff`) — `DataRangeSeed.java` marks the whole
derived range as undefined data BEFORE `VolatileCarve.java`'s own `analyzeAll()` call
runs (confirmed by argv order in the run log: `DataRangeSeed.java` executes first,
`VolatileCarve.java` second). The one argument that differed from the BEFORE run above:

```json
{ "dataRangesPath": "<file containing the single line \"1000-17ff\">" }
```

`analyzeHeadless` exit status: **0**. Run log carries `DataRangeSeed.java> DATARANGE-OK:
1000-17ff (2048 bytes)` and `DataRangeSeed.java> DATARANGE-SEED-COUNT: 1`.

**After this run, `## DECOMPILED_TEXT` carries exactly ONE function: `FUN_0810`** — the
fixture's own real entry point. Every one of the 512 phantom functions the BEFORE run
minted inside `$1000`-`$17ff` is gone. The empty after-set is committed alongside the
before-set in `fixtures/ghidra/charset-phantom-minted-labels.json`
(`afterLabelsInRange: []`).

## Attempts

One. The fixture's chosen byte pattern (a chain of `jsr`/`rts` blocks, each targeting
the immediately following block) minted a non-empty before-set on the first real run —
no re-derivation of the fixture bytes was needed.
