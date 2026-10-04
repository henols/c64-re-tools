---
name: c64-static-analysis
description: Use this skill to find the structure of a C64 program without running it. DXA gives a fast first pass of code and data regions and a disassembly listing. Ghidra gives a deeper pass with routines, regions, references and decompiled code. The skill records the structure in the project knowledge and reports conflicts with the current knowledge. Do not use it for runtime questions or to name routines.
---

# c64-static-analysis

## Purpose

Find the static structure of a C64 program. Record the structure in the project knowledge. Report conflicts with current knowledge.

## Inputs

- The program: a PRG file, relative to the project directory. Or 64 KiB of memory from `$0000`, for example a memory dump.
- Entry points: addresses where code starts, for example the SYS address from the c64-basic skill. Routine symbols in the knowledge are entry points too. Ghidra needs at least one. DXA finds the SYS of a BASIC start by itself.
- Optional: routines to decompile (Ghidra), or a file for the listing (DXA).

## Tools / execution path

The script reads the current knowledge and runs DXA or Ghidra on this machine. The host runtime is not necessary. The script records the result in `.c64-re-tools/knowledge.db`.

```
node <skill>/scripts/analyze.ts extracted/game.prg --analyzer dxa --listing analysis/game.lst
node <skill>/scripts/analyze.ts extracted/game.prg --entry '$080d' --decompile '$080d'
```

| Option | Meaning |
|---|---|
| `--analyzer dxa` | Use DXA: a fast first pass. Without this option, the script uses Ghidra. |
| `--entry '$080d'` | An address where code starts. Use it again for more addresses. |
| `--listing analysis/game.lst` | DXA only: write the disassembly listing to this project file. |
| `--decompile '$0818'` | Ghidra only: decompile the routine at this address. Use it again for more routines, at most 32. |
| `--flat64k` | The file is 64 KiB of memory from `$0000`, not a PRG. |

The script prints one JSON object. Addresses are `$` and four hex digits.

Both analyzers use the knowledge from the user and the LLM as seeds:

- Each routine is an entry point.
- Each region that is not code stays data.
- Each name is a label. The listing, Ghidra and the decompiler show that name.

Facts that an analyzer found are not seeds. A new analysis can then correct or remove them.

## Workflow

1. Read the knowledge for the program with the c64-knowledge skill.
2. Run a first pass with `--analyzer dxa`. For a BASIC loader, DXA finds the SYS address. Read the listing for a quick view of the code.
3. Find the important routines. Give them names with the c64-knowledge skill.
4. Run a deeper pass with Ghidra. Give the entry points with `--entry`. Ask for decompiled code of the routines that you must understand.
5. Read the result:
   - `changes` counts the symbols, regions and references that the analysis `added`, `changed`, `retired` or kept `unchanged`.
   - DXA: `regions` lists the code and data regions, and `labels` lists the addresses that DXA named.
   - Ghidra: `functions` lists the routines that Ghidra found, and `decompilations` gives C-like code for the requested routines.
   - `conflicts` lists the places where the analyzer and the current knowledge disagree.
6. Give each important routine a name with the c64-knowledge skill. Then run the analysis again. The analyzers use the new names.

The script records only structure: generated names, code and data regions, and references from Ghidra. The listing and the decompiled code are only for the current task. The script does not record them in the knowledge.

## Knowledge

Automatic write:
- code and data regions
- names that DXA generated (labels) and routine entry points with names that Ghidra generated
- references from Ghidra: call, jump, read and write.

The script never replaces a name or a region from the user or the LLM. A name that an analyzer only shows back stays with its owner. DXA and Ghidra do not replace the facts of each other.

A new analysis replaces the earlier facts of the same analyzer in the analyzed range. The history keeps the earlier facts. DXA labels stay until a person or the LLM removes them, because DXA names only the addresses that it sees used.

Do not store:
- the listing or decompiled code
- the function list as comments.

## Result

The changes to the knowledge and the conflicts. For DXA, also the regions, the labels and the path of the listing. For Ghidra, also the routines and the decompiled code.

## Failure and conflicts

- A conflict: the analyzer finds code where the knowledge has data, or data where the knowledge has code. The knowledge stays unchanged. Find the correct answer with the c64-emulator skill, then correct the knowledge with the c64-knowledge skill.
- A conflict with the problem "another address has this name": the knowledge has the generated name at a different address. The knowledge stays unchanged.
- `invalid-input` with a message about an entry point: no entry point is inside the program for Ghidra. Give one with `--entry`.
- `stale-revision`: the knowledge changed during the analysis. Run the script again.
- `operation-failed` with a message about an incomplete result or listing: the analyzer did not give a complete result. The script recorded nothing. Tell the user.
- `installation-incomplete`: DXA or Ghidra is not installed on this machine. Tell the user the message.

## Handoffs

- Runtime behavior → c64-emulator
- Names and classifications → c64-knowledge
- The meaning of a C64 hardware address → c64-memory-map
- Source code for a rebuild → c64-assembler
