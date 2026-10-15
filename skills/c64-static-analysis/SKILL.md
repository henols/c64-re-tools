---
name: c64-static-analysis
description: Use this skill to find the structure of a C64 program without running it. DXA gives a fast first pass of code and data regions and a disassembly listing. Ghidra gives a deeper pass with routines, regions, references and decompiled code. The skill records the structure in the project knowledge and reports conflicts with the current knowledge. Do not use it for runtime questions or to name routines.
---

# c64-static-analysis

## Purpose

Find the static structure of a C64 program. Record the structure in the project knowledge. Report conflicts with current knowledge.

## Inputs

- The program: a PRG file, relative to the project folder. Or 64 KiB of memory from `$0000`, for example a memory dump.
- Entry points: addresses where code starts, for example the SYS address from the c64-basic skill. Routine symbols in the knowledge are entry points too. Ghidra needs at least one. DXA finds the SYS of a BASIC start by itself.
- Optional: routines to decompile (Ghidra), or a file for the listing (DXA).

## Tools / execution path

The script reads the current knowledge and runs DXA or Ghidra on this machine. The host runtime is not necessary. The script records the result in the project knowledge, `.c64-re-tools/knowledge/`.

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
| `--max-listed 20` | List at most this number of labels, functions or candidates. The default is 50. Use 0 to list none. |
| `--instructions analysis/instructions.json` | Ghidra only: write every instruction to this project file as JSON. Each has `address`, `bytes`, `mnemonic`, `mode` and `operand` in 6502 syntax. A branch, jump or call also has its `target`. With `--coverage`, `executed` tells if it ran. |
| `--space drive8` | The knowledge space of the image: `drive8` for code from the 1541 drive, or `bank0` to `bank255` for a cartridge bank. The default is `c64`. The seeds come from that space, and the findings go into it. |
| `--coverage coverage/attract.bin` | A coverage file of 64 KiB from `c64_memmap` (action `read` with `out`). Use it again for more runs. The executed code becomes entry points. |

The script prints one JSON object. Addresses are `$` and four hex digits.

Both analyzers use the knowledge from the user and the LLM as seeds:

- Each routine is an entry point.
- Each region that is not code stays data.
- Each name is a label. The listing, Ghidra and the decompiler show that name.

Facts that an analyzer found are not seeds. A new analysis can then correct or remove them.

More seeds come from evidence:

- The start of each `code` region and each entry of a `jumps` table from the user or the LLM is an entry point.
- With `--coverage`, each executed instruction that starts a flow is an entry point. A flow starts after a gap, or after RTS, RTI, JMP or BRK. Then the analyzers find code that only a vector, an RTS table or an interrupt reaches.

The analyzers take at most 1024 entry points. Knowledge routines and `--entry` come first, then code regions and tables, then coverage. `coverageSeeds` gives how many entry points the coverage gave and how many the analysis used.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Keep the results, batches and step files that you save for yourself in `.c64-re-tools/local/` of the project. Git ignores that folder.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Read the knowledge for the program with the c64-knowledge skill.
2. Run a first pass with `--analyzer dxa`. For a BASIC loader, DXA finds the SYS address. Read the listing for a quick view of the code.
3. Find the important routines. Give them names with the c64-knowledge skill.
4. Run a deeper pass with Ghidra. Give the entry points with `--entry`. Ask for decompiled code of the routines that you must understand.
5. Read the result:
   - `changes` counts the symbols, regions and references that the analysis `added`, `changed`, `retired` or kept `unchanged`. `suppressed` counts the findings that the analysis did not write, because a removal blocks that place.
   - DXA: `regions` lists the code and data regions. `labels` gives the number of names that DXA found (`count`) and lists the first names (`listed`).
   - Ghidra: `functions` gives the number of routines that Ghidra found (`count`) and lists the first routines (`listed`). `decompilations` gives C-like code for the requested routines.
   - If a list is not complete, `rest` gives the c64-knowledge command that lists all of them. For `candidates`, `rest` tells you to give a larger `--max-listed`.
   - `conflicts` lists the places where the analyzer and the current knowledge disagree.
   - `idioms` tells what the script found by pattern: RTS dispatch tables (`rtsTables`), JMP tables (`jumpTables`) and BIT skips (`bitSkips`). The script writes them as knowledge with the origin `heuristic`, and seeds their targets into the same analysis. `candidates` gives DOP padding (`dop`) and opcodes that the program wrote and executed (`selfModified`). For `selfModified`, the write and the execution must be in one coverage file. A coverage file does not record the order. Thus a candidate can also be code that ran first, and that the program then wrote over. To prevent this, save one coverage file for each part of the program, for example the intro and the game. Clear the memory map between the parts. Each list has a `count`. The script does not write the candidates. Look at them and decide.
   - `candidates.pointers` gives code that makes an address from immediates. A `vector` or a `zero-page pointer` candidate stores a low byte (`low`) and a high byte (`high`) to a vector or to a zero-page pair that `(zp),y` uses. Its `target` is in the image or has a platform name. A `sprite pointer` candidate stores an immediate (`at`) to a sprite pointer of the screen at $0400 in VIC bank 0. Its `target` (the value × 64) is in a `sprite` region. For each candidate that you confirm, write operand expressions with `operand` of the c64-knowledge skill, for example `operand '<low>' --lo <target name>` and `operand '<high>' --hi <target name>`. Then a rebuild can move the target.
   - With `--coverage`, a code finding replaces the DXA or Ghidra data where a run executed an instruction start. `coverageConflicts` lists the analyzer data regions where the coverage still shows executed code. Classify them as code with the c64-knowledge skill, or as `dual-use` when the bytes are also data.
6. Give each important routine a name with the c64-knowledge skill. Then run the analysis again. The analyzers use the new names.

The script records only structure: generated names, code and data regions, and references from Ghidra. The listing and the decompiled code are only for the current task. The script does not record them in the knowledge.

## Knowledge

Automatic write:
- code and data regions
- names that DXA generated (labels) and routine entry points with names that Ghidra generated
- references from Ghidra: call, jump, read and write.

The script never replaces a name or a region from the user or the LLM. A name that an analyzer only shows back stays with its owner. DXA and Ghidra do not replace the facts of each other, with one exception. With `--coverage`, a code finding replaces a DXA or Ghidra data region or data name where a run executed an instruction start. The revision keeps the coverage files as evidence. Thus run DXA first, then Ghidra with all coverage files.

A `heuristic` region replaces the part of a DXA or Ghidra region where it lies, because an idiom is specific evidence about those bytes. DXA and Ghidra never replace a `heuristic` region. If they find code there, the result shows a conflict. A heuristic table can be too long or too short, because the script cannot know its length. Correct it with the c64-knowledge skill. Your region replaces it, and a removal holds.

A new analysis replaces the earlier facts of the same analyzer in the analyzed range. The history keeps the earlier facts. DXA labels stay until a person or the LLM removes them, because DXA names only the addresses that it sees used.

A fact that the user or the LLM removes does not come back. The next analysis does not write a fact at that place, and counts it as `suppressed`. To remove a wrong fact, use the c64-knowledge skill.

Do not store:
- the listing or decompiled code
- the function list as comments.

## Result

The changes to the knowledge and the conflicts. For DXA, also the regions, the labels and the path of the listing. For Ghidra, also the routines and the decompiled code.

The exit status is 0 for a result, also with conflicts. The exit status is 1 for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- A conflict: the analyzer finds code where the knowledge has data, or data where the knowledge has code. The knowledge stays unchanged. Find the correct answer with the c64-emulator skill, then correct the knowledge with the c64-knowledge skill.
- A conflict with the problem "another address has this name": the knowledge has the generated name at a different address. The knowledge stays unchanged.
- A false reference through a vector: the code jumps through a vector, for example `JMP ($0408)`, and the program writes the vector at run time. The analyzer follows the bytes that the image has there. Do these steps:
  1. Find the real targets with the c64-emulator skill, or in a coverage file.
  2. If the vector bytes are also code at another time, classify them as `dual-use`.
  3. Remove the false reference with `unreference`. It does not come back.
  4. Add a `jump` reference from the JMP to each real target, and name each target as a routine.
- `invalid-input` with a message about an entry point: no entry point is inside the program for Ghidra. Give one with `--entry`.
- `stale-revision`: the knowledge changed during the analysis. The script recorded nothing. Run the analysis again.
- `operation-failed` with a message about an incomplete result or listing: the analyzer did not give a complete result. The script recorded nothing. Tell the user.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `notDecompiled`: Ghidra did not decompile these routines. Each entry has the reason. If the reason says that the decompiler did not start, tell the user the remedy in the reason. On macOS, Ghidra has no native decompiler until the user builds it: `./gradlew buildNatives` in the `support/gradle` directory of Ghidra.

## Handoffs

- Runtime behavior → c64-emulator
- Names and classifications → c64-knowledge
- The meaning of a C64 hardware address → c64-memory-map
- Source code for a rebuild → c64-assembler
