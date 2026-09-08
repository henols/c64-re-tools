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

## Resolution

**Landed.** Plan `40-09` Task 3 (commit `09246ea0`), in `ghidra-live.test.ts` —
already this file's own `MANUAL_ONLY_TESTS` eleventh entry, so the guard is
**opt-in** and **default-SKIP** in the manual-only live suite: it never runs
under `npm run test:automated`, and a plain `node --test ghidra-live.test.ts`
with no opt-in reports `fail 0` with all 24 of that file's cases (including
these two) skipped. It runs only with `VICE_LIVE_GHIDRA=1` set and a real
`GHIDRA_HOME` pointed at an installed Ghidra.

**Two halves, exactly as this todo's own "What" section specified:**

- **Positive half** — mints/verifies the handle through `resolveGhidraProject()`
  (the real code under test), then spawns `analyzeHeadless` directly at the
  resolved non-dotted handle path (deliberately without production's own
  unconditional `-deleteProject` flag, which was MEASURED live to delete
  exactly the artifacts this guard needs to inspect). Asserts a real project
  database (`.gpr` plus a populated `.rep/`) exists **physically** under the
  dotted `.c64-re-tools/runs/ghidra/` root, with only the handle symlink
  present in the non-dotted tree.
- **Negative control** — spawns `analyzeHeadless` directly at a **literal**
  dot-prefixed project location, bypassing the production resolver (which
  would refuse it itself), and asserts no project database is created there.
  This is what stops the guard being vacuous: without it, a broken guard that
  always reports "database present" would pass the positive half for the
  wrong reason (e.g. a stale fixture left on disk), never having proven the
  *symlink route specifically* is what let the import through.

**Neither half matches Ghidra's own stderr text**, honouring this todo's own
prohibition against parsing the exception string — both are outcome
differentials (project database present vs. absent), and both failure
messages name the specific upstream mechanism a future regression would
trigger (`ProjectLocator` switching `getAbsolutePath()` to
`getCanonicalPath()`), not an assertion on Ghidra's wording.

**Installed Ghidra version proved against: 12.1.3** — read live from
`application.properties` during plan `40-09`'s Task 3 run, matching this same
file's pre-existing `EXPECTED_GHIDRA_VERSION` pin (recorded transcript:
`40-09-SUMMARY.md` § "Live-Ghidra Guard Transcript").

**Blocking condition discharged.** This todo was explicitly blocked on gap
`G-40-1` landing first. `G-40-1` is closed: plan `40-08` re-pointed the runs
root onto the broker-mintable handle; plan `40-09` had the broker mint the
handle at startup and added this very guard; plan `40-10` corrected every
document that had recorded the old location as an unavoidable external-tool
constraint; plan `40-11` (this closure) marked `PREP-05` Complete and
reconciled the project's own bookkeeping.
