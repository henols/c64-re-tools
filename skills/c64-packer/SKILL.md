---
name: c64-packer
description: Use this skill to pack and crunch a C64 program with Exomizer into one PRG that unpacks itself and starts with RUN. It can merge more PRG files into one program. It unpacks the result in an emulator and checks each byte and the entry before it writes the PRG. Use it to make a small release file of a rebuilt or new program. Do not use it to unpack a packed program. Use the c64-unpacker skill for that.
---

# c64-packer

## Purpose

Pack and crunch PRG files of the project with Exomizer into one PRG. The PRG loads at $0801, starts with RUN, unpacks the program and jumps to its entry. Check the result before you use it.

This skill does not assemble the program, does not run it in VICE and does not change project knowledge.

## Inputs

- One or more PRG files in the project, in load order. Where two files overlap, the later file wins.
- The output path: where to write the packed PRG, relative to the project folder.
- The entry: the address where the program starts after the unpack. If the first PRG is a BASIC program at $0801 with `SYS` and a number, the script uses that address.
- Optional: the value of $01 when the program starts.

## Tools / execution path

The script runs Exomizer on this machine. Exomizer packs the files with `sfx`. Then the script unpacks the result with `desfx` in the 6502 emulator of Exomizer. It compares the unpacked bytes with the bytes of the inputs, and the jump address with the entry. The host runtime is not necessary.

```
node <skill>/scripts/packer.ts pack build/game.prg --out build/game-packed.prg
node <skill>/scripts/packer.ts pack build/loader.prg build/main.prg --entry '$0400' --out build/release.prg
```

| Option | Meaning |
|---|---|
| `--entry '$0400'` | The address where the program starts after the unpack. It must be `$0400` or higher. A name of the knowledge is also correct. Without it, the script uses the `SYS` address of the BASIC line of the first input. |
| `--exit-memory '$35'` | The value of $01 when the program starts, `$34` to `$37`. Without it, the value is `$37`: BASIC, KERNAL and I/O. With it, the program starts with interrupts off. |

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

1. Assemble the program with the c64-assembler skill. Use the release or the switches that you want in the packed file.
2. Find the entry. For a BASIC program at $0801 with `SYS`, the script finds it. Else, use the start address of the program, for example the entry of the program in the knowledge.
3. Find the value of $01 that the program needs at its start. Give `--exit-memory` when the program uses RAM under BASIC or KERNAL and does not set $01 itself.
4. Run the script.
5. If `result` is `PASS`, the packed PRG is at `out`. Give it to the emulator skill and run it with RUN. Make sure that the program starts and works.
6. If `result` is `FAIL`, read `check`. Do not use the packed program. The script does not write it.
7. If `result` is `INCONCLUSIVE`, the check did not hold all bytes of the inputs. Run the packed program in the emulator and examine the memory of the segments that are `not covered`.

The unpacker uses $0334 to $03ff and the zero page while it runs. A program that loads into these addresses can fail. Then Exomizer stops with an error, or the check gives `FAIL`.

## Knowledge

Automatic write:
- none.

Do not store:
- the packed program
- the check result

## Result

`result` is `PASS`, `FAIL` or `INCONCLUSIVE`.

- `PASS`: the packed program unpacks to the bytes of all inputs and jumps to the entry. The PRG is at `out`.
- `FAIL`: the packed program unpacks to different bytes, or jumps to a different address. The script did not write a file.
- `INCONCLUSIVE`: the emulator of Exomizer keeps only the largest range that the unpacker wrote. Bytes of the inputs outside that range have no check. This occurs when the inputs have gaps between them. The PRG is at `out`.

Other fields:
- `packedBytes` and `unpackedBytes`: the size of the packed PRG and of the bytes of the inputs. `percent` is the packed size as a percentage of the unpacked size.
- `unpackSeconds`: the time of the unpack in the emulator of Exomizer, in seconds at the PAL clock. A real C64 can need more time.
- `inputs`: each input with its `loadRange` and its `bytes`.
- `check.entry`: the address where the unpacker jumped.
- `check.segments`: one check for each segment of the merged inputs. The `result` of a segment is `identical`, `different` with `firstDifference`, or `not covered`. `firstDifference` gives the `address`, the unpacked byte (`built`) and the input byte (`reference`).

## Failure and conflicts

- `FAIL`: do not use the packed program. Read `check`. Give the call and the result to the user.
- `invalid-input` with `Give --entry`: the first input has no BASIC line with `SYS` and a number. Give `--entry`.
- `invalid-input` for the entry: the entry is below $0400. The unpacker runs there. A program with an entry below $0400 needs a different packer.
- `operation-failed` with `Exomizer could not pack the program`: read the last output of Exomizer in the message. Correct the inputs, or give the message to the user.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `not-found`: there is no file at an input path. Give a path relative to the project folder.

## Handoffs

- Assemble the program before the pack → c64-assembler
- Run the packed program → emulator
- Put the packed program on a disk image → c64-disk
- Unpack a packed program → c64-unpacker
