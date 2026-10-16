---
name: c64-assembler
description: Use this skill to assemble C64 6510 source code with the ACME assembler and write the program (PRG) into the project. It reports source errors with file and line, and the symbols with their addresses or values. Use it to build a rebuilt or new program. Do not use it to run the program. Give the PRG to the c64-emulator skill for that.
---

# c64-assembler

## Purpose

Assemble C64 source code with ACME. Write the program into the project. Report diagnostics and symbols.

This skill does not run the program and does not change project knowledge.

## Inputs

- The source root: the folder in the project that holds all source files of the program.
- The entry source: the main file, relative to the source root.
- The output path: where to write the PRG, relative to the project folder.
- Optional include directories, symbol definitions and a start address.

## Tools / execution path

The script runs ACME on this machine. It copies the source root to a temporary directory, assembles it there and writes the program into the project. The host runtime is not necessary.

```
node <skill>/scripts/assemble.ts --source-root src --entry main.a --out build/game.prg
```

| Option | Meaning |
|---|---|
| `--include lib` | An include directory, relative to the source root. Use it again for more directories. |
| `--define DEBUG=1` | An assembler symbol: an integer, also as `$` hex, or `true` or `false`. Use it again for more symbols. |
| `--set-pc '$0801'` | The start address when the source does not set one. |
| `--compare unpacked/image.json` | Check the program byte by byte against a reference. The reference is the `image.json` of the c64-unpacker skill, a PRG, or 64 KiB of memory. |
| `--plain` | Write only the bytes of the program, without the 2-byte load address of a PRG. `loadRange` still tells where the bytes go. |
| `--all-symbols` | List all symbols. Without it, the list does not include the constants that the source does not use. `unusedConstants` gives their count. |

The script copies the full source root. Put all files that the program includes under it. Version control directories stay out.

The script prints one JSON object. The target CPU is the 6510. The output is a C64 PRG, or the bytes only with `--plain`.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Keep the results, batches and step files that you use only one time in `.c64-re-tools/local/` of the project. Git ignores that folder.
- Put a run file whose results are the evidence for a finding in `runs/`, with its results. Then git keeps the run file and the results, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Find the source root and the entry source. The entry source sets its own start address with `* = $0801` or similar.
2. Run the script.
3. If `assembled` is `true`, the PRG is at `output`. `loadRange` tells where it loads. `symbols` gives each symbol:
   - Kind `address` has a value in `loadRange`. It gives the `address`.
   - Kind `constant` has a value outside `loadRange`. It gives the `value` as `$` and four or more hex digits. A label in a `!pseudopc` block can be a constant, because its value is the run address, not the load address.
   - `used` is `false` when the source does not use the symbol.
4. If `assembled` is `false`, read `diagnostics`. Each one has a severity, a file, a line and a message. Correct the source and run the script again.
5. To run the program, give the PRG path to the c64-emulator skill.

The source of the c64-source skill has switches. Each switch is 0 when the build does not define it. `--define CRACK=1` puts in the patches of the switch `CRACK`. With `--compare`, only the bytes of those patches are different.

## Knowledge

Automatic write:
- none.

Do not store:
- diagnostics
- build output

A symbol from the rebuilt source can give the address of a routine in the rebuild. Use it to compare runs with the c64-testing skill.

## Result

The PRG in the project at the output path, with its load range and symbols. Or the source diagnostics when the assembly failed.

With `--compare`, `compare` gives `identical` and one check for each segment of the reference. A check is `identical`, `different` with the first different address, or `not covered` when the program does not hold the segment.

The exit status is 0 for a PRG. The exit status is 1 for `assembled: false`, for a `--compare` that is not identical, and for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `assembled: false`: the source has errors. This is a normal result. Correct the source.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `invalid-input`: an option or a path is wrong. Read the message and correct the call.

## Handoffs

- Run or debug the program → c64-emulator
- Compare the rebuild with the original → c64-testing
