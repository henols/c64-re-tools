# Product Mission

## What It Is

**c64-re-tools** is a Claude Code plugin that bundles the tooling used to
reverse-engineer and rebuild Commodore 64 programs, reusable across C64
projects. It ships as a Claude Code plugin and as two npm packages:
`@henols/vice-mcp` (the MCP server and broker) and `@henols/c64-re-tools` (an
installer that adds the skills and wires the server into a project).

## Problem

To reverse-engineer a C64 program with an AI assistant, you have to drive a real
emulator reliably, keep what you learn across sessions, and turn a binary back
into source that you can change and rebuild. Emulators wedge, crash and
misbehave. One-off scripts lose evidence, and each session derives the same
facts again. Disassemblers also guess: they classify code and data with
confidence even where the evidence does not support it.

## Target Users

- A developer or hobbyist who uses Claude Code to reverse-engineer C64 programs
  (games and cracked releases) and rebuild them as ACME source.
- One person with one or more C64 projects on one machine. Claude Code runs
  either on the bare host or inside a devcontainer.

## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program (read and write memory, set checkpoints, capture RAM, inspect chip
state) and keep working when the emulator misbehaves.

## Solution

- **`vice` MCP server.** A `vice_*` tool surface that drives the VICE `x64sc`
  emulator over its binary monitor and its text monitor, through one broker per
  machine. The broker owns the emulator processes and respawns them when they
  crash.
- **Annotation store (`.annostore`).** Findings are kept as queryable state, not
  as prose: labels, comments, per-range types, scopes, enums, cross-references
  and runtime execution evidence. It is reached through the `vice-mcp anno` CLI.
- **Analysis engines.** A vendored dxa builds the code/data map, and headless
  Ghidra runs under this project's own NMOS 6502 language. Both annotate the store
  automatically.
- **Rebuild.** An annotated store exports as a directory of ACME source. That
  source reassembles to the same bytes as the original, can be edited, and is
  checked for equivalence against the original in VICE.
- **Eight skills.** These are playbooks with helper scripts: `acme-build`,
  `c64-disk-access`, `c64-memory-mapping`, `c64-petcat`, `c64-program-recon`,
  `c64-provenance-diff`, `c64-ram-capture` and `routine-queue-walker`.

## Guiding Principles

- **Evidence over assertion.** Correctness that depends on external behaviour is
  proven against the real tool (VICE, ACME, Ghidra), not against a mock built on
  the same assumptions. A completion claim never goes further than its evidence.
- **Report, never decide.** The pipeline never removes, strips or drops part of a
  subject binary on its own judgement. Hazards and disagreements are reported.
  Where bank state depends on the execution path, the tool declines with a reason
  instead of annotating.
- **Honest capability.** Only implemented tools are advertised. When a capability
  is missing, the tool refuses and names what is missing, so it never gives a
  plausible wrong answer.
- **Never auto-install.** External tools are detected, never installed. When one
  is missing, the refusal names the tool and gives the remedy for the user to
  run. This binds our own packages too: the installer copies skills and never
  runs `npm` or `npx`, and no shipped remedy text uses `npx -y`.

## Key Constraints

- Runs on a VICE that anyone can install from a package manager (`x64sc` ≥ 3.9).
  Three capabilities are permanently unavailable through VICE's monitor: SID
  register read-back, matrix-keyboard input and RESTORE/NMI. They are accepted as
  permanent limitations.
- The user starts one broker per machine. No client ever starts it, and every
  project and container on the machine shares it.
- Tool-written output goes under one root: the project's `.c64-re-tools/`
  directory for client-side files, and `~/.c64-re-tools` for broker-owned state.
- The server has exactly two npm runtime dependencies. New runtime dependencies
  need a strong reason.
