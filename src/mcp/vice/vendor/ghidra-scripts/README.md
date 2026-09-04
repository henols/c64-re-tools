# vendor/ghidra-scripts -- provenance

Two committed, function-named Ghidra scripts, promoted from throwaway
evidence written earlier in this project's exploration
(`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/`).
Both are reached through `-scriptPath` (`ghidra.analyze`'s own `scriptPath`
field): Ghidra resolves script filenames against that path, and a script
loaded this way is compiled in the default package -- neither file below
declares a `package`.

- `VolatileCarve.java` (class `VolatileCarve`) -- a `-preScript`. Reached
  through `ghidra.analyze`'s `preScript` field, with an optional entry-point
  file supplied as `entrypointsPath`. Requires `ghidra.analyze`'s
  `noanalysis` field to be set, since this script calls `analyzeAll()`
  itself. Marks the 6510 processor port and the I/O page volatile before
  analysis runs, so hardware writes survive dead-store elimination.

- `GhidraStructExport.java` (class `GhidraStructExport`) -- a
  `-postScript`. Reached through `ghidra.analyze`'s `postScript` field, with
  the output path supplied as `exportPath` (its own `getScriptArgs()[0]`)
  and an optional expected-classification-line-count override supplied as
  `expectedClassificationLines` (`getScriptArgs()[1]`). Exports the
  program's structural facts through `DecompInterface`.

**Neither file, nor this README, may name a phase number anywhere -- not in
a class name, not in a comment, not in a string literal.** Both scripts are
named for what they do, not for the phase that promoted them. This directory
sits outside `docs-dangling-refs.test.ts`'s own scanned set --that guard's
character-state-machine literal extractor covers only the `.ts`/`.mts`
modules named in `package.json`'s `files[]`, and `.java` sources under
`vendor/` are never packaged (the same exclusion `fixtures/` gets, per
`scripts/check-npm-packages.mjs`). The rule is enforced here instead by this
plan's own `<verify>` grep over both `.java` files and this README:
`grep -aciE 'Phase[[:space:]]+[0-9]'`, asserted to return 0.
