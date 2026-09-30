# vendor/ghidra-scripts -- provenance

Three committed, function-named Ghidra scripts. All three are reached
through `-scriptPath` (`ghidra.analyze`'s own `scriptPath` field): Ghidra
resolves script filenames against that path, and a script loaded this way is
compiled in the default package, so no file below declares a `package`.

- `VolatileCarve.java` (class `VolatileCarve`) -- a `-preScript`. Reached
  through `ghidra.analyze`'s `preScript` field, with an optional entry-point
  file supplied as `entrypointsPath`. Requires `ghidra.analyze`'s
  `noanalysis` field to be set, since this script calls `analyzeAll()`
  itself. Marks the 6510 processor port and the I/O page volatile before
  analysis runs, so hardware writes survive dead-store elimination.

- `DataRangeSeed.java` (class `DataRangeSeed`) -- a `-preScript` that runs
  when `ghidra.analyze` gets a `dataRangesPath`. Reads a file of inclusive
  address ranges and redefines each range as undefined data, so code
  discovery does not treat known display data (character sets, bitmaps,
  screen matrices, sprite pointers) as instructions.

- `GhidraStructExport.java` (class `GhidraStructExport`) -- a
  `-postScript`. Reached through `ghidra.analyze`'s `postScript` field, with
  the output path supplied as `exportPath` (its own `getScriptArgs()[0]`)
  and an optional expected-classification-line-count override supplied as
  `expectedClassificationLines` (`getScriptArgs()[1]`). Exports the
  program's structural facts through `DecompInterface`.

The `.java` sources ship in the npm package (`vendor/ghidra-scripts/` is in
`package.json`'s `files`), because Ghidra compiles them on the host at run
time. The scripts are named for what they do; no file here names a
development phase.
