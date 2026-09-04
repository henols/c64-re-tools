# Phase 36 Plan 07 -- Acceptance Run and DataTypeManager Control Evidence

Recorded from real live runs against Ghidra 12.1.3 (`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`), `VICE_LIVE_GHIDRA=1 VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-live.test.ts`. Every run built its own `mkdtemp` scratch workspace outside the repository and tore it down in a `finally`; `git status --porcelain` was confirmed empty after every run below.

## Part 1 -- the acceptance run (`DecompInterface`, `GHID-04`/`GHID-05`)

**The image, route, language and entry points** are the SAME `danish.d64` corpus program (`"BRUCE LEE   (DC)"`, 45074 bytes) and the SAME five entry points (`$081b`, `$b70a`, `$b74c`, `$b7e7`, `$b790`) `evidence/36-07-corpus-before-after.md` records in full, run once more under `6502:LE:16:nmos`. The wire request (`ghidra.analyze`, via `runGhidraAnalyze()`):

```json
{
  "runId": "acceptance",
  "importPath": "release.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "release.entrypoints",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "acceptance-export.txt"
}
```

**Export digest and byte length**, as reported by the seam's own results and re-digested by the test: sha256 `c38c5eb368d704b802dff1126f2879309c11ad9afaa0388db4dfccea66f21466`, 553832 bytes.

**The five fact kinds.** `## STRUCTURAL_FACTS`, verbatim:

```
STRUCTURAL_FACT ARRAY_BOUND not-found
STRUCTURAL_FACT SPLIT_POINTER found function=FUN_a660 address=a660
STRUCTURAL_FACT SPLIT_POINTER found function=FUN_b790 address=b790
STRUCTURAL_FACT RECORD_STRIDE not-found
STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found
STRUCTURAL_FACT SELF_MODIFYING_WRITE found from=b7de to=081f
```

Found on this image: `SPLIT_POINTER` (twice) and `SELF_MODIFYING_WRITE`. Not found: `ARRAY_BOUND`, `RECORD_STRIDE`, `COMPUTED_JUMP_RESOLVED` -- each carries its own explicit not-found line rather than an omission, and each absence is a fact about this specific corpus image at the depth these five entry points reach (no `for(...)`-shaped loop or explicit multiply-stride pattern decompiles anywhere in the ten functions reached; no RESOLVED computed jump exists at all -- see the `COMPUTED_JUMP` finding below, which is the SAME underlying fact from a different angle).

**Split-pointer detection route.** `FUN_a660`'s own decompiled body contains the literal `CONCAT11(` text:

```
pcVar1 = (char *)CONCAT11(*(undefined1 *)(ushort)(byte)(param_2 + 0x21),
                          *(undefined1 *)(ushort)(byte)(param_2 + 0x20));
```

The detection route on this image is therefore the printed decompiler text (`CONCAT11(`), not the `PcodeOp.PIECE` fallback -- recorded because the two routes can disagree and knowing which one fired is what makes a later change to either detectable.

**The accounting identity.** `## DECOMPILE_ACCOUNTING`, verbatim:

```
DECOMPILE_ATTEMPTED 10
DECOMPILE_DECOMPILED 10
DECOMPILE_TIMED_OUT 0
DECOMPILE_FAILED 0
DECOMPILE_TIMEOUT_SECONDS 30
DECOMPILE_TIMED_OUT_CEILING 5
```

`attempted (10) = decompiled (10) + timedOut (0) + failed (0)` holds; `attempted` is greater than zero (not vacuous); `timedOut` (0) is at or below the script's own named ceiling (5), read from this export rather than restated in the test. A SEPARATE case (`ghidra-live acceptance zero-function`), against an all-zero flat-64K image with no entry points and no preScript, drove `DECOMPILE_ATTEMPTED 0` and asserted the explicit `DECOMPILE_ZERO_FUNCTIONS true (no functions were found to decompile)` line -- proving the zero-function line is not merely tolerated as an empty section but is itself asserted present when genuinely zero functions exist.

**Typed cross-references, one example line per kind found:**

| Kind | Example line |
|---|---|
| `READ` | `a68e -> 8de3 READ` |
| `WRITE` | `081d -> 0001 WRITE` |
| `READ_WRITE` | `a691 -> 8ae1 READ_WRITE` (a real `ROL $8ae1` -- read-modify-write on an absolute address) |
| `COMPUTED_JUMP` | **not present as a resolved reference on this image** -- see finding below |

**MEASURED finding: `COMPUTED_JUMP` is genuinely absent from this corpus program's own resolved references, at the depth this plan's five entry points reach.** This plan's own `flagged_assumptions` anticipated uncertainty about `GHID-05`'s reference-kind coverage; the actual finding, disclosed rather than forced: every computed control transfer this image reaches decodes as a `BRK` instruction whose own flow is the "BRK trick" -- a computed jump through the hardware IRQ vector (`$FFFE`), which this synthetic flat import cannot resolve because the vector's own target lives entirely outside the loaded image. Ghidra's own decompiler recognises the shape explicitly (`"Could not recover jumptable... Treating indirect jump as call"`, `(*_IRQ)()`), and the underlying instruction correctly falls into `## UNRESOLVED_DISPATCH` (below) rather than into a resolved `COMPUTED_JUMP` reference. This was independently RE-CONFIRMED, during this plan's own investigation, on a SECOND, unrelated crack of the SAME game (`saeger.d64`, cracked by a different group) -- the identical `BRK`-trick shape appears there too, at its own two computed-call sites. The committed test asserts this absence as a POSITIVE, checked fact (`kindsPresent.has("COMPUTED_JUMP") === false`, named in its own assertion message) rather than silently omitting the kind -- a future entry-point or corpus change that introduces a resolved `COMPUTED_JUMP` would need this assertion updated deliberately. Recorded as a Rule 1 (plan-premise correction by measurement) deviation in this plan's own SUMMARY.

**Unresolved dispatch, no denominator.** `## UNRESOLVED_DISPATCH`, verbatim:

```
UNRESOLVED_DISPATCH_COUNT 2
a665 BRK
b74c BRK
```

Count (2) equals the site-list length (2); a negative read over this section's own text (`/%|\bratio\b|\bpercent(age)?\b|total[- ]sites/i`) finds no match -- no ratio, percentage or total-sites figure appears anywhere in it. The denominator this milestone cannot source (`C2_SITES_ENUMERATED`, `ROADMAP.md`) was stated absent by owner decision on 2026-09-02; this section reflects that decision structurally, not merely by omission.

**Reproducibility.** A second run (`runId: "acceptance-2"`), over the SAME extracted program and entry points, produced an export whose sha256 is BYTE-IDENTICAL to the first: `c38c5eb368d704b802dff1126f2879309c11ad9afaa0388db4dfccea66f21466` both times.

## Part 2 -- the `DataTypeManager` control, same image, one script argument apart (`GHID-04`)

**Invocation.** The control is NOT reachable through `ghidra.analyze`'s typed seam (plan 36-03's own key-decision: only the export path and the expected-line override are wired as positional script arguments) -- it is invoked directly against `analyzeHeadless`, building the SAME fixed-order argv `buildAnalyzeHeadlessArgv()` (`ghidra-project.mts`) would, with one extra positional slot (the mode selector) after an always-empty expected-classification-lines override:

```
<projectLocation> <runId>
-import <release.prg, absolute>
-processor 6502:LE:16:nmos
-loader BinaryLoader
-loader-baseAddr 0x801
-noanalysis
-scriptPath <vendor/ghidra-scripts, absolute>
-preScript <VolatileCarve.java, absolute> <release.entrypoints, absolute>
-postScript <GhidraStructExport.java, absolute> <control-datatype-export.txt, absolute> "" DATATYPE
-deleteProject
```

Same image (`release.prg`, byte-identical to Part 1's own), same route (`prg`), same language (`6502:LE:16:nmos`), same script (`GhidraStructExport.java`), same entry points -- differing from Part 1's own acceptance invocation ONLY in the trailing `DATATYPE` mode argument. Exit status: 0.

**The control's own count lines, verbatim** (`## STRUCTURAL_FACTS`):

```
STRUCTURAL_FACT COMPOSITE_TYPES count=0
STRUCTURAL_FACT DEFINED_DATA count=14
STRUCTURAL_FACT_MODE_NOTE DataTypeManager route -- expected near-empty on 6502
```

And, confirming no decompiler interface was ever constructed in this mode (`## DECOMPILE_ACCOUNTING`, verbatim): `DECOMPILE_ACCOUNTING_MODE_NOTE decompiler not invoked in DATATYPE mode`. The script's own printed mode line (captured in the run log): `EXPORT_MODE: DATATYPE`.

**The acceptance run's corresponding counts, beside them:**

| Metric | Acceptance (`DecompInterface`) | Control (`DataTypeManager`) |
|---|---|---|
| Composite/structural-fact producing route | 10 functions fully decompiled, 183 non-blank lines of recovered C text (`## DECOMPILED_TEXT`) | 0 functions ever decompiled (mode never invoked) |
| `COMPOSITE_TYPES` | n/a (this mode's own metric) | 0 |
| `DEFINED_DATA` | n/a (this mode's own metric) | 14 |
| **Control total** (`COMPOSITE_TYPES`+`DEFINED_DATA`) | -- | **14** |

**Stated threshold and stated multiple**, named explicitly rather than left ambiguous: the control's own total (14) is asserted at or below a stated near-zero threshold of **100** -- far below both the classified address total (49682) and the acceptance route's own decompiled-text line count, expressing "essentially nothing" as a bound rather than an assumed exact zero. The acceptance export's own structural-fact count, defined for this comparison as its `## DECOMPILED_TEXT` section's own non-blank line count (183), is asserted greater than the control's total (14) by a stated multiple of at least **5x** -- the actual observed ratio is ~13x (183 / 14).

**Confirmation of sameness.** Both runs used the identical `release.prg` bytes (written once into the scratch workspace and never rewritten), the identical `prg` route, the identical `6502:LE:16:nmos` language, and the identical committed `GhidraStructExport.java` script -- differing in exactly one argument, the mode selector.

## What this plan now knows, and does not know, about the export

**Known.** The export's structural facts, accounting and typed references are genuinely sourced from `DecompInterface`, not from `DataTypeManager` -- the control, on the identical image, returns a total two orders of magnitude smaller than the acceptance route's own recovered structure. The accounting identity holds under a named ceiling read from the export itself. Unresolved dispatch is reported with no denominator, mechanically enforced by a negative text read. Reproducibility is byte-exact across two runs.

**Not known / not established here.** Whether a resolved `COMPUTED_JUMP` reference exists ANYWHERE in this corpus release's own game code (as opposed to its loader/depacker stage, which is all this plan's five entry points reach) is not established -- the game's own real code is packed and never appears as static bytes in this file until the depacker actually runs, which this plan's static analysis does not emulate. `ARRAY_BOUND` and `RECORD_STRIDE` are recorded absent on this specific image at this specific depth; a different corpus release, or deeper entry-point coverage of this same one, might find either.
