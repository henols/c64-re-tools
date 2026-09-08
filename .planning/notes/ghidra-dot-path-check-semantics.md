---
title: Ghidra's dot-segment refusal — what it actually checks (MEASURED)
date: 2026-09-08
context: Phase 40 UAT (gap G-40-1). Owner challenged the recorded claim that the Ghidra runs root cannot live under `.c64-re-tools/`. Four live runs against real Ghidra 12.1.3 plus a bytecode read settled the mechanism.
---

# Ghidra's dot-segment refusal — what it actually checks

**Bottom line:** Ghidra refuses a dot-prefixed segment in the **absolutized**
project-location path. It resolves relative paths against the cwd, but it does
**not** resolve symlinks. A symlinked handle therefore lets the real project
data live under `.c64-re-tools/`.

## MEASURED — real Ghidra 12.1.3, 2026-09-08, this host

`analyzeHeadless <location> <name> -import <file>`:

| # | Location argument | Outcome |
|---|---|---|
| B | literal `<...>/.c64-re-tools/runs/ghidra/dotrun` | **Refused** — `java.lang.IllegalArgumentException: Path element starting with '.' is not permitted` |
| D | `relrun` (relative; cwd = `<...>/.c64-re-tools/runs/ghidra/`) | **Refused** — same message. The dot never appeared in the argument. |
| E | `<...>/handles/./fullrun2` | **Refused** — same message. The bare `.` segment is itself caught. |
| A | `<...>/tools/ghidra-runs/linkrun` → symlink → `<...>/.c64-re-tools/runs/ghidra/linkrun` | **Accepted** — `Creating project:` succeeded; `.gpr` + `.rep/` landed physically under `.c64-re-tools/` |
| C | `<...>/handles/fullrun` → symlink → `<...>/.c64-re-tools/runs/ghidra/fullrun` | **Accepted** — full import **and** analysis: `REPORT: Analysis succeeded`. 2.1M of program database physically under `.c64-re-tools/`; the non-dotted tree held only the symlink. |

Test C matters on its own: test A only proved *project creation*, because its
import aborted for an unrelated reason (`No load spec found`). C ran a complete
import-plus-analysis through the symlink, so no later stage re-checks the path.

## MEASURED — the mechanism, from bytecode

`javap -p -c ghidra/framework/model/ProjectLocator.class`
(from `Ghidra/Framework/FileSystem/lib/FileSystem.jar`, 12.1.3) shows a call to
`java.io.File.getAbsolutePath()` and **no `getCanonicalPath()` call anywhere**.

That single fact explains all five results:

- `getAbsolutePath()` **does** resolve a relative path against the cwd → D refused.
- It does **not** collapse `.` / `..` → E's literal dot segment survives to be caught.
- It does **not** resolve symlinks (only `getCanonicalPath()` would) → A and C pass.

## What this corrects

Three places currently record the exception as a hard, unavoidable constraint:

- `src/mcp/vice/ghidra-project.mts:80-96` — *"This is a hard external-tool
  constraint, not a preference"*
- `CLAUDE.md` — the D-33 configuration bullet's `ghidra.analyze` exception
- `.planning/phases/40-.../40-01-SUMMARY.md` — the discovery record

All three are **correct that a dotted path is refused** and **overstated about
what follows from it**. The constraint binds the absolutized path string; it
does not bind where the bytes physically live. A broker-minted symlink handle
satisfies both Ghidra and D-33's "one root" truth simultaneously.

An earlier framing in this same session — "a string check on the literal path
argument; it does not canonicalize" — was also wrong, in the opposite
direction: it *does* absolutize. Tests D and E are what distinguish the two
readings, and neither had been run before.

## The fragility this design carries

The symlink route depends on Ghidra continuing to call `getAbsolutePath()`
rather than `getCanonicalPath()`. That is a one-word upstream change that would
break **every** run, silently, with the same misleading 12–16s-late dot-segment
error. This is not hypothetical enough to ignore and not likely enough to
design around — it is exactly the shape of thing that belongs in a guard test.
See `.planning/todos/pending/2026-09-08-guard-ghidra-symlink-project-location.md`.

## Related

- Gap `G-40-1` in `.planning/phases/40-.../40-UAT.md` — the relocation itself
- `PREP-05` in `REQUIREMENTS.md` — the broker-owned output-path invariant
- `.planning/phases/34-.../evidence/34-ghidra-dotpath.md` — the original
  Phase 34 refusal transcripts (which never tested a symlink, a relative path,
  or a `./` segment)
