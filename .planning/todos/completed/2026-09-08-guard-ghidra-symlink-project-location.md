---
title: Guard that Ghidra still accepts a symlinked project location
date: 2026-09-08
priority: medium
---

# Guard that Ghidra still accepts a symlinked project location

## Why

Once the Ghidra runs root moves under `.c64-re-tools/` (gap `G-40-1`), every
`ghidra.analyze` run depends on a property of Ghidra we do not control:
`ProjectLocator` calls `java.io.File.getAbsolutePath()` and **not**
`getCanonicalPath()`, so it never resolves the symlink handle the broker hands
it. MEASURED in bytecode against 12.1.3 — see
`.planning/notes/ghidra-dot-path-check-semantics.md`.

If an upstream release switches that one call, **every** run breaks at once,
silently, with a dot-segment error that names a path the user never typed —
12–16 seconds into a JVM startup. That is close to the worst possible failure
shape: late, misleading, and total.

## What

A guard that fails at **test** time rather than at user time. It must exercise
the real property, not restate it:

- Create a real directory under a dot-prefixed ancestor, symlink it from a
  non-dotted path, and run a real `analyzeHeadless` import through the link.
- Assert the project is created **and** the database lands physically under the
  dotted path.
- On failure, the message must say what changed — *"Ghidra now resolves
  symlinks in the project location; the `.c64-re-tools/` runs root is no longer
  reachable"* — not merely that an assertion failed.

## Notes

- This is a live-Ghidra test, so it belongs with the existing live-Ghidra suite
  and its skip-when-absent discipline, **not** in the pure-unit tier that
  `ghidra-project.test.ts` occupies (that file is provable with no Ghidra
  installed, which is a stated property of the module and must stay true).
- Do not implement this by parsing Ghidra's stderr for the exception string —
  `ghidra-project.mts`'s header explicitly prohibits that pattern for the
  refusal path, and the same objection applies here.
- Blocked on `G-40-1` landing first; there is nothing to guard until the runs
  root actually moves.
