---
title: Broker-owned output-path laundering for every host tool, not just Ghidra
trigger_condition: When a fourth host tool is added, or when any existing tool's output is found landing outside `.c64-re-tools/` — whichever comes first.
planted_date: 2026-09-08
---

# Broker-owned output-path laundering for every host tool

## The idea

Ghidra turned out to impose a rule on the *path it is handed* (no dot-prefixed
segment in the absolutized location) that is entirely separate from where its
output can physically live. The broker can satisfy both at once by minting a
non-dotted symlink handle — see
`.planning/notes/ghidra-dot-path-check-semantics.md`.

The open question this seed holds: **is Ghidra unique, or is it just the first
one we noticed?**

## Why it is worth checking rather than assuming

The Ghidra constraint was discovered by a run failing, not by reading docs, and
it then sat recorded for two phases as "a hard external-tool constraint" — an
overstatement nobody caught until it was challenged directly. The same discovery
mode has not been applied to the other tools at all.

Specific things no one has checked:

- **`c1541`** — does it refuse, mangle, or silently relativise an output path
  containing a dot segment? It writes files the container then reads.
- **`petcat`** — same question for its `-o` target.
- **`dxa`** — same, plus whatever its listing/symbol outputs do.
- **ACME** — already runs against project-tree paths, but has never been
  exercised with a dot-prefixed output root specifically.

Note the failure mode that motivates checking: a tool that *silently* writes
somewhere else, or writes a relative path resolved against its own cwd, would
not error at all. It would just produce output the container cannot find, or —
worse — output under a stale location that looks plausible.

## Shape of the work if it triggers

Not a rewrite. `runHostTool()` already executes every tool in the broker
process, and `resolveGhidraProject()` already shows the pattern: one
per-tool resolution step that owns the output location and any laundering that
tool's own rules require. The work would be to give each tool id an explicit,
tested answer to "where does this write, and what does it require of that path"
rather than the current implicit assumption that a workspace path always works.

## Related

- `PREP-05` in `REQUIREMENTS.md` — the invariant this seed would extend
- `.planning/seeds/host-tool-executor.md` — the seam that shipped in v0.8.0
