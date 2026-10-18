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
node <skill>/scripts/assembler.ts build src main.a --out build/game.prg
```

| Option | Meaning |
|---|---|
| `--include lib` | An include directory, relative to the source root. Use it again for more directories. |
| `--define DEBUG=1` | An assembler symbol: an integer, also as `$` hex, or `true` or `false`. Use it again for more symbols. |
| `--set-pc '$0801'` | The start address when the source does not set one. |
| `--compare` | Check the program byte by byte against the program in the knowledge, each segment. Put it in with `image` of the c64-knowledge skill. `--space drive8` or `--space bank0` compares with the program of that space. The script refuses `--space` without `--compare`. |
| `--plain` | Write only the bytes of the program, without the 2-byte load address of a PRG. `loadRange` still tells where the bytes go. |
| `--all-symbols` | List all symbols. Without it, the list does not include the constants that the source does not use. `unusedConstants` gives their count. |
| `--max-listed 200` | Show at most 200 symbols in the result. The default is 50. `symbols.count` gives the count of all symbols. |
| `--out-symbols build/game.json` | Write the symbols to this file as `{"symbols": [...]}`. Without `--all-symbols`, the file does not have the constants that the source does not use. Give this file to the c64-testing skill as the symbols of the rebuild. |

The script copies the full source root. Put all files that the program includes under it. Version control directories stay out.

The target CPU is the 6510. The output is a C64 PRG, or the bytes only with `--plain`.

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- The script examines each `--out` path before it starts work. It refuses a path in `.c64-re-tools/knowledge/` and the index of the knowledge, because only c64-knowledge writes them. It refuses a folder where the command writes a file, and a file where the command writes a folder.
- The result is one JSON object on one line. A file that the script writes shows as `{"out", "bytes", "sha256"}`. A list shows as `{"count", "listed"}`, and `rest` tells where to get the rest of a long list.
- An error is `{"error": {"code": "...", "message": "..."}}`. The message tells what is wrong and what to do.
- The exit status is 0 for done or PASS, 1 for FAIL, 2 for an error and 3 for INCONCLUSIVE.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence test:<file>` or `--evidence file:<file>` of c64-knowledge. These two refuse a file in `.c64-re-tools/local/`.
- Do not move a coverage map after `coverage` of c64-knowledge imported it. `--evidence coverage:<map>` names the map by its path at the import. The knowledge keeps the coverage and the SHA-256 of the map, so the evidence stays valid.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Find the source root and the entry source. The entry source sets its own start address with `* = $0801` or similar.
2. Run the script.
3. If `result` is `PASS`, the PRG is at `out`. `loadRange` tells where it loads. `symbols` is a list with `count` and `listed`. Each item in `listed` is one symbol:
   - Kind `address` has a value in `loadRange`. It gives the `address`.
   - Kind `constant` has a value outside `loadRange`. It gives the `value` as `$` and four or more hex digits. A label in a `!pseudopc` block can be a constant, because its value is the run address, not the load address.
   - `used` is `false` when the source does not use the symbol.
4. If `result` is `FAIL` and `assembled` is `false`, read `diagnostics`. Each one has a severity, a file, a line and a message. Correct the source and run the script again.
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

`result` is `PASS` or `FAIL`.

- `PASS`: the PRG is in the project at `out`, with its load range and symbols.
- `FAIL` with `assembled: false`: the source has errors. `diagnostics` gives them.
- `FAIL` with `assembled: true`: `--compare` found differences. The PRG is at `out`.

With `--compare`, `compare` gives `identical` and `segments`: one check for each segment of the program in the knowledge. The `result` of a check is `identical`, `different` with `firstDifference`, or `not covered` when the build does not hold the segment. `firstDifference` gives the `address`, and the byte of the build (`built`) and of the knowledge (`reference`), each as `$` and two hex digits.

## Failure and conflicts

- `FAIL` with `assembled: false`: the source has errors. Correct the source.
- `FAIL` with `assembled: true`: the build is not identical to the program in the knowledge. Read `compare.segments`.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `invalid-input`: an option or a path is wrong. Read the message and correct the call.
- `not-found`: the source root has no main source file with that name, or no folder with files for an `--include`. Give a path relative to the source root.

## Handoffs

- Run or debug the program → c64-emulator
- Compare the rebuild with the original → c64-testing
