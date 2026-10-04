---
name: c64-assembler
description: Use this skill to assemble C64 6510 source code with the ACME assembler and write the program (PRG) into the project. It reports source errors with file and line, and the symbols with their addresses or values. Use it to build a rebuilt or new program. Do not use it to run the program. Give the PRG to the c64-emulator skill for that.
---

# c64-assembler

## Purpose

Assemble C64 source code with ACME. Write the program into the project. Report diagnostics and symbols.

This skill does not run the program and does not change project knowledge.

## Inputs

- The source root: the project directory that holds all source files of the program.
- The entry source: the main file, relative to the source root.
- The output path: where to write the PRG, relative to the project directory.
- Optional include directories, symbol definitions and a start address.

## Tools / execution path

The script sends the source root to the host runtime. The host runs ACME and sends the program back. The script writes the program into the project.

```
node <skill>/scripts/assemble.ts --source-root src --entry main.a --out build/game.prg
```

| Option | Meaning |
|---|---|
| `--include lib` | An include directory, relative to the source root. Use it again for more directories. |
| `--define DEBUG=1` | An assembler symbol: an integer, also as `$` hex, or `true` or `false`. Use it again for more symbols. |
| `--set-pc '$0801'` | The start address when the source does not set one. |

The source root goes to the host as a whole. Put all files that the program includes under it. Version control directories stay out.

The script prints one JSON object. The target CPU is the 6510 and the output is always a C64 PRG.

## Workflow

1. Find the source root and the entry source. The entry source sets its own start address with `* = $0801` or similar.
2. Run the script.
3. If `assembled` is `true`, the PRG is at `output`. `loadRange` tells where it loads. `symbols` gives each symbol as an `address` or a `value`.
4. If `assembled` is `false`, read `diagnostics`. Each one has a severity, a file, a line and a message. Correct the source and run the script again.
5. To run the program, give the PRG path to the c64-emulator skill.

## Knowledge

Automatic write:
- none.

Do not store:
- diagnostics
- build output

A symbol from the rebuilt source can give the address of a routine in the rebuild. Use it to compare runs with the c64-testing skill.

## Result

The PRG in the project at the output path, with its load range and symbols. Or the source diagnostics when the assembly failed.

## Failure and conflicts

- `assembled: false`: the source has errors. This is a normal result. Correct the source.
- `installation-incomplete`: ACME is not on the host. Tell the user the message.
- `operation-failed` with a message about the host runtime: the host runtime does not run. Tell the user to start `c64-re-tools-host`.
- `invalid-input`: an option or a path is wrong. Read the message and correct the call.

## Handoffs

- Run or debug the program → c64-emulator
- Compare the rebuild with the original → c64-testing
