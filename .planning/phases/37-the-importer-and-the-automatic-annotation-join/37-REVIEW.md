---
phase: 37-the-importer-and-the-automatic-annotation-join
reviewed: 2026-09-05T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/mcp/vice/anno-bank.test.ts
  - src/mcp/vice/anno-bank.ts
  - src/mcp/vice/anno-confinement.test.ts
  - src/mcp/vice/anno-graphics.test.ts
  - src/mcp/vice/anno-graphics.ts
  - src/mcp/vice/anno-import.test.ts
  - src/mcp/vice/anno-import.ts
  - src/mcp/vice/anno-join.test.ts
  - src/mcp/vice/anno-join.ts
  - src/mcp/vice/anno-register.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/fixtures/ghidra/bank-path-dependent.a
  - src/mcp/vice/fixtures/ghidra/bank-path-dependent.prg
  - src/mcp/vice/fixtures/ghidra/charset-phantom.a
  - src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json
  - src/mcp/vice/fixtures/ghidra/charset-phantom.prg
  - src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt
  - src/mcp/vice/fixtures/ghidra/README.md
  - src/mcp/vice/ghidra-live.test.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/ghidra-run.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/join-image-controls.test.ts
  - src/mcp/vice/memmap-lookup-controls.test.ts
  - src/mcp/vice/memmap-lookup.test.ts
  - src/mcp/vice/memmap-lookup.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/resources/ghidra-project.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java
  - src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java
  - src/skills/c64-program-recon/SKILL.md
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

This phase builds the Ghidra-export importer (`anno-import.ts`), the mechanical
memmap join (`anno-join.ts`), the processor-port bank decode (`anno-bank.ts`),
and the VIC-register graphics-range derivation (`anno-graphics.ts`), all
individually well-designed and covered by extensive, sharply-targeted unit and
live tests. The path-confinement rule for `anno_import_ghidra_export`'s
`export_path` is correctly routed through the same `storePathWithinWorkspace()`
seam the `store`/`image` arguments use, and is exercised against a real symlink
escape (`anno-confinement.test.ts` tests 20-21). The digest-then-delete
discipline in `importGhidraExport()` is implemented exactly as documented: a
single `unlinkSync` call site, reached only after every `putXref()` in the
batch has returned, never inside the write loop and never on a throwing path.
`anno-join.ts`'s bank-state candidate constraint genuinely runs BEFORE
`selectMemmapEntry()` (it narrows the `entries` array passed in, rather than
filtering the result), which is the property `AUTO-04` requires.

However, tracing the full pipeline described in this phase's own requirements
(`AUTO-04` through `AUTO-07`: resolve bank state before the address; derive and
feed back graphics ranges) from the actual, shipped MCP tool surface down to
the module level surfaces a critical integration gap: **the bank-state and
graphics-derivation machinery this phase built and unit-tested is unreachable
from the `anno_import_ghidra_export` / `anno_join_memmap` verbs an agent or the
`c64-program-recon` skill actually calls.** `runMemmapJoin()`'s optional
`constWrites` argument -- the switch that activates everything `anno-bank.ts`
and `anno-graphics.ts` do -- is never supplied by `anno-tools.ts`'s
`dispatchJoinMemmap()`, and the CONST_WRITES facts a real Ghidra export
carries are parsed by `parseConstWrites()` in test code only: the production
`importGhidraExport()` never calls it, never persists the facts anywhere durable, and
deletes the one file that carried them as its last successful step. Separately,
a boundary bug in the new `DataRangeSeed.java` pre-script throws inside a
legitimately-derivable graphics range (one ending at `$FFFF`), turning a fully
successful data-range seed into a false failure report.

## Critical Issues

### CR-01: AUTO-04 through AUTO-07 are unreachable from the shipped `anno_*` tool surface -- the const-write facts are parsed only in tests and never persisted

**File:** `src/mcp/vice/anno-tools.ts:1866-1871`, `src/mcp/vice/anno-tools.ts:976-995`, `src/mcp/vice/anno-import.ts:393-474`

**Issue:** `runMemmapJoin()` (`anno-join.ts:252-256`) accepts an optional
`constWrites` argument that is the ONLY switch activating the bank-state
decline/resolve machinery (`AUTO-04`/`AUTO-05`, `anno-bank.ts`) and the
graphics write-back (`AUTO-06`/`AUTO-07`, `anno-graphics.ts`). But the actual
MCP verb that reaches it, `dispatchJoinMemmap()`, calls it unconditionally
without that argument:

```ts
function dispatchJoinMemmap(handle: AnnoStoreHandle, args: unknown): unknown {
  const baseRevision = assertBaseRevisionArg("anno_join_memmap", args);
  assertNotStale("anno_join_memmap", handle, baseRevision);
  const image = loadImage("anno_join_memmap", args);
  return runMemmapJoin(handle, { imageOrigin: image.origin, imageByteLength: image.body.length });
}
```

`anno_join_memmap`'s own `inputSchema` (`anno-tools.ts:976-995`) has no
`constWrites`/`graphicsMapIndex` property at all, so there is no way for any
caller of the real tool to ever supply one. Every call through this verb
therefore takes the pre-37-06 code path: for every address inside
`$A000-$BFFF`/`$D000-$DFFF`/`$E000-$FFFF`, `args.constWrites !== undefined`
is false, so the bank-conditional guard is skipped entirely and the address is
annotated through the ordinary, UNCONSTRAINED `selectEntry()` call -- exactly
the "confident wrong comment" this phase's own header says `AUTO-04` exists to
prevent, silently, on every real run.

The other half of the gap is upstream: `importGhidraExport()`
(`anno-import.ts:393-474`) parses the transfer file's `## CONST_WRITES`
section only insofar as `parseGhidraExport()` collects it into
`GhidraExportDocument.sections`; the import function itself never calls
`parseConstWrites()` (defined at `anno-import.ts:323`, called only from
`anno-join.test.ts` and `ghidra-live.test.ts`) and `ImportCounts`
(`anno-import.ts:346-360`) has no field carrying the parsed facts. The store's
`bank` column is documented as permanently reserved and always `null`
(`anno-store.ts:1846-1851`), so there is no durable place these facts could
land even if the import function did parse them. Because `importGhidraExport()`
deletes the transfer file as the last step of a successful call
(`anno-import.ts:451-461`), the ONE artifact carrying the CONST_WRITES facts is
gone by the time any subsequent call could read it -- there is no route from a
completed `anno_import_ghidra_export` call to a `constWrites` value at all,
whether through the tool surface or by hand.

The only place `constWrites` is ever actually populated end-to-end is inside
test code (`ghidra-live.test.ts`'s own `writeDataRangesFile()`/`parseConstWrites(parseGhidraExport(exportText))`
calls, driving `deriveGraphicsRanges()` and `runGhidraAnalyze()` directly), not
in anything shipped. `37-08-SUMMARY.md` states "`AUTO-07` is complete... all of
`AUTO-01`..`AUTO-08` are now complete, closing the phase's requirement set" with
no caveat that the capability is unreachable from the actual verb surface, and
`src/skills/c64-program-recon/SKILL.md`'s own description of the two-call
import/join pipeline (lines 314-335) does not mention bank state or graphics
ranges at all -- consistent with the fact that, as shipped, calling these two
tools as documented can never produce either.

**Fix:** Either (a) wire `constWrites` end-to-end: have `importGhidraExport()`
call `parseConstWrites()` and return the facts in `ImportCounts` (or persist
them in a new durable table before the transfer file is deleted), and add a
`const_writes`/`graphics_map_index` argument to `anno_join_memmap`'s schema
that `dispatchJoinMemmap()` actually threads into `runMemmapJoin()`; or (b) if
this wiring is intentionally deferred to a later phase, correct
`37-08-SUMMARY.md`'s "AUTO-01..AUTO-08 are now complete" claim and add an
explicit statement to `anno_join_memmap`'s own tool description and to
`c64-program-recon/SKILL.md` that bank-state resolution and graphics-range
derivation are not yet reachable through this verb, so a caller does not
mistake the current unconstrained-annotation behavior for the declined-when-
uncertain behavior `AUTO-04`'s success criteria describe.

### CR-02: `DataRangeSeed.java`'s per-byte seed loop throws when a derived range ends at `$FFFF`, turning a fully-applied seed into a false "FAILED" report

**File:** `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java:174-184`

**Issue:**

```java
Address cur = startAddr;
while (cur.compareTo(endAddr) <= 0) {
    listing.createData(cur, Undefined1DataType.dataType);
    cur = cur.add(1);
}
```

`Address.add(1)` throws `AddressOutOfBoundsException` when `cur` is already
the address space's maximum offset (`$FFFF` for the 16-bit 6502 space this
project targets) -- there is no address to advance to. This loop calls
`cur.add(1)` unconditionally after every `createData()`, including the
iteration where `cur == endAddr`, so any range whose `endInclusive` is exactly
`$FFFF` throws on its LAST iteration -- after `createData()` has already
successfully marked every byte in the range as data. The exception is caught by
the surrounding `catch (Exception e)` (line 182), which prints
`"DATARANGE-FAILED: ..."` and does not increment `seededCount` -- so a range
that was, in fact, fully and correctly seeded is reported as a failure, and
`DATARANGE-SEED-COUNT` undercounts by one.

This is not a hypothetical input: `anno-graphics.ts`'s own
`deriveGraphicsRanges()` can legitimately derive a screen-matrix or
sprite-pointer range ending at `$FFFF` -- e.g. bank-select value with bits
0-1 both clear (`vicBankBase()` selects bank 3, base `$C000`) combined with
`$D018`'s high nibble `$F` (`screenMatrixStart()` = `$C000 + 15*1024 =
$FC00`, end `$FC00 + 1023 = $FFFF`; the sprite-pointer range then derives to
`$FFF8-$FFFF`). Neither `anno-graphics.test.ts` nor `ghidra-live.test.ts`'s
`charset-phantom` fixture exercises this boundary, so the bug is untested and
silent. Contrast with `GhidraStructExport.java`'s own classification loop
(`GhidraStructExport.java:267-278`), which gets the identical boundary right
by checking `a.equals(r.getMaxAddress())` and `break`ing BEFORE calling
`a.next()` again, rather than advancing unconditionally.

**Fix:**

```java
Address cur = startAddr;
while (true) {
    listing.createData(cur, Undefined1DataType.dataType);
    if (cur.equals(endAddr)) break;
    cur = cur.add(1);
}
```

## Warnings

### WR-01: `anno_import_ghidra_export`'s and `anno_join_memmap`'s tool-dispatch layer has no test coverage in `anno-tools.test.ts`

**File:** `src/mcp/vice/anno-tools.ts:1835-1871` (`dispatchImportGhidraExport`, `dispatchJoinMemmap`)

**Issue:** `anno-tools.ts`'s own header states it is "the ONE authoritative
place for the curated `anno_*` tool surface" and that no other module may
hand-validate an `anno_*` argument. `anno-tools.test.ts` -- the file that owns
testing this layer -- has zero references to `anno_join_memmap` or
`anno_import_ghidra_export` (confirmed: `grep -in "ghidra\|memmap"
anno-tools.test.ts` returns nothing). The only coverage these two verbs get
outside their own module-level tests (`anno-import.test.ts`, `anno-join.test.ts`)
is `anno-confinement.test.ts`'s two `export_path`-confinement cases (tests
20-21). Nothing exercises, at the `runAnnoTool()` dispatch layer: a
successful `anno_import_ghidra_export`/`anno_join_memmap` call end to end
through `runAnnoTool()`; `assertNotStale()`'s `base_revision` staleness
refusal for either verb; `loadImage()`'s error paths reached through
`anno_join_memmap` (missing image, wrong extension, etc.); or the
`READ_ONLY_ANNO_VERBS` exclusion (both verbs are writers and take the
existence-check-plus-inode-guard route -- untested for these two specifically).

**Fix:** Add cases to `anno-tools.test.ts` covering a successful
`anno_import_ghidra_export` call through `runAnnoTool()` (asserting the
returned `ImportCounts` shape), a stale-`base_revision` refusal for both new
verbs, and a successful `anno_join_memmap` call through `runAnnoTool()`
asserting the returned `JoinCounts` shape -- mirroring the pattern the other
59 tests in that file already use for the pre-existing verbs.

### WR-02: `parseConstWrites()` is dead code from the shipped importer's perspective

**File:** `src/mcp/vice/anno-import.ts:323-343`

**Issue:** `parseConstWrites()` is exported and thoroughly unit-tested
(`anno-import.test.ts`), but is never called by `importGhidraExport()` --
the only production entry point that reads a transfer file. It is called only
from test code (`anno-join.test.ts` builds its `GraphicsConstWriteFact[]`
fixtures directly rather than through the importer; `ghidra-live.test.ts`
calls it against a real captured export). Combined with CR-01, this means the
function exists, is correct, and is completely unreachable in production use.

**Fix:** Same fix as CR-01(a) -- have `importGhidraExport()` call
`parseConstWrites()` and surface or persist the result. If this is
intentionally deferred, note the dead-code status in this function's own
header rather than leaving a reader to conclude from its extensive tests that
it is wired in.

## Info

### IN-01: `DataRangeSeed.java`'s `readDataRanges()` can abort the WHOLE script on an I/O error, not just the affected range

**File:** `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java:100-147`

**Issue:** `readDataRanges()` is declared `throws Exception` and is called
from `run()` (line 154) with no surrounding `try`/`catch`. A malformed LINE
is refused by name and the run continues (per this file's own header, "a
refused line does not abort the run") -- but an I/O-level failure reading the
range file itself (e.g. `Files.readAllLines()` throwing after the
`f.isFile()` existence check races with a concurrent delete) propagates out
of `run()` entirely, aborting the whole script rather than being reported as
a named, contained failure the way every other refusal in this file is.

**Fix:** Wrap the `Files.readAllLines()` call in its own `try`/`catch`, print
a `DATARANGE-SEED-REASON`-style diagnostic naming the I/O failure, and return
an empty range list rather than letting the script abort -- consistent with
this script's own stated discipline that a bad input is reported, never a
silent or total abort.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
