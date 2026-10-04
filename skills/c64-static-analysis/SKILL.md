---
name: c64-static-analysis
description: Use this skill to find the structure of a C64 program without running it. Ghidra finds the routines, the code and data regions and the references between addresses. The skill records them in the project knowledge and reports conflicts with the current knowledge. It can also decompile routines for a quick read. Do not use it for runtime questions or to name routines.
---

# c64-static-analysis

## Purpose

Find the static structure of a C64 program. Record the structure in the project knowledge. Report conflicts with current knowledge.

## Inputs

- The program: a PRG file, relative to the project directory. Or 64 KiB of memory from `$0000`, for example a memory dump.
- At least one entry point: an address where code starts, for example the SYS address from the c64-basic skill. Routine symbols in the knowledge are entry points too.
- Optional: routines to decompile.

## Tools / execution path

The script reads the current knowledge, sends the program to the host runtime, and the host runs Ghidra. The script records the result in `.c64-re-tools/knowledge.db`.

```
node <skill>/scripts/analyze.ts extracted/game.prg --entry '$080d'
```

| Option | Meaning |
|---|---|
| `--entry '$080d'` | An address where code starts. Use it again for more addresses. |
| `--decompile '$0818'` | Decompile the routine at this address. Use it again for more routines, at most 32. |
| `--flat64k` | The file is 64 KiB of memory from `$0000`, not a PRG. |

The script prints one JSON object. Addresses are `$` and four hex digits.

Ghidra uses the knowledge as seeds:

- Each routine symbol is an entry point.
- Each region that is not code stays data.
- Each name from the user or the LLM is a label. Ghidra and the decompiler show that name.

## Workflow

1. Read the knowledge for the program with the c64-knowledge skill.
2. Find an entry point. For a BASIC loader, use the c64-basic skill to find the SYS address.
3. Run the script.
4. Read the result:
   - `symbols`, `regions` and `references` count the facts that the analysis `added`, `changed`, `retired` or kept `unchanged`.
   - `functions` lists the routines that Ghidra found, with their names.
   - `conflicts` lists the places where Ghidra and the current knowledge disagree.
   - `decompilations` gives C-like code for the requested routines.
5. Give each important routine a name with the c64-knowledge skill. Then run the script again. Ghidra uses the new names, and the decompiled code shows them.

The script records only structure: routine entry points with generated names, code and data regions, and references. The decompiled code is only for the current task. The script does not record it.

## Knowledge

Automatic write:
- routine entry points with names that Ghidra generated
- code and data regions
- references: call, jump, read and write.

The script never replaces a name or a region from the user or the LLM. A name that Ghidra only shows back stays with its owner.

A new analysis replaces the earlier Ghidra facts in the analyzed range. The history keeps the earlier facts.

Do not store:
- decompiled code
- the function list as comments.

## Result

The changes to the knowledge, the conflicts, the routines and the decompiled code.

## Failure and conflicts

- A conflict: Ghidra finds code where the knowledge has data, or data where the knowledge has code. The knowledge stays unchanged. Find the correct answer with the c64-emulator skill, then correct the knowledge with the c64-knowledge skill.
- A conflict with the problem "another address has this name": the knowledge has the routine name from Ghidra at a different address. The knowledge stays unchanged.
- `invalid-input` with a message about an entry point: no entry point is inside the program. Give one with `--entry`.
- `stale-revision`: the knowledge changed during the analysis. Run the script again.
- `operation-failed` with a message about an incomplete result: Ghidra did not give a complete result. The script recorded nothing. Tell the user.
- `installation-incomplete`: Ghidra is not on the host. Tell the user the message.
- `operation-failed` with a message about the host runtime: the host runtime does not run. Tell the user to start `c64-re-tools-host`.

## Handoffs

- Runtime behavior → c64-emulator
- Names and classifications → c64-knowledge
- The meaning of a C64 hardware address → c64-memory-map
- Source code for a rebuild → c64-assembler
