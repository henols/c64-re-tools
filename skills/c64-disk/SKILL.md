---
name: c64-disk
description: Use this skill to examine a C64 disk image (D64, D71, D81 or G64), a T64 tape file or a CRT cartridge file. It extracts files into the project. It shows the directory, the BAM, the directory entry of a file and the sector chain of a file. It writes each bank of a cartridge as a PRG. Do not use it to run a program or to decode BASIC. Give an extracted file to the c64-basic, c64-unpacker or c64-static-analysis skill.
---

# c64-disk

## Purpose

Examine a C64 disk image, a T64 tape file or a CRT cartridge file. Extract a file from it into the project.

This skill does not change the disk image and does not change project knowledge.

## Inputs

- The disk image: a `.d64`, `.d71`, `.d81` or `.g64` file, relative to the project folder.
- For one file: the file name as the directory shows it.
- To extract a file: the output path, relative to the project folder.
- A T64 tape file or a CRT cartridge file, relative to the project folder.

## Tools / execution path

The script sends a disk image to the host runtime. The host runs c1541 and sends the result back. The script writes an extracted file into the project. It reads T64 and CRT files itself.

```
node <skill>/scripts/disk.ts <command> <image> [name] [--out <file>]
```

| Need | Command |
|---|---|
| The disk name, the free blocks and the files | `directory original/game.d64` |
| The free and used sectors of each track, and the used sectors that no file uses | `bam original/game.d64` |
| The type, size and first block of one file | `entry original/game.d64 GAME` |
| The track and sector of each block of one file | `chain original/game.d64 GAME` |
| Extract one file | `read original/game.d64 GAME --out extracted/game.prg` |
| The files of a tape | `directory original/game.t64` |
| Extract one file of a tape | `read original/game.t64 GAME --out extracted/game.prg` |
| The banks of a cartridge | `directory original/game.crt` |
| Write each bank of a cartridge as a PRG | `crt original/game.crt --out cart` |

File names show the characters that the C64 shows in a directory list. A byte that has no character shows as `{$xx}`, for example `{$c1}`. Write the name in the same form. The letter case of a name is not important. Put the name in single quotes in a shell, for example `'GAME {$c1}'`. A name that starts with `-` needs `--` before it, after all options, for example `read d.d64 --out x.prg -- '-----'`.

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
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

1. Run `directory`. Find the file in `entries`. Each entry has a `name`, a `type`, a size in `blocks` and the `closed` and `locked` flags.
2. Run `read` with an output path to extract the file. A PRG file keeps its 2-byte load address at the start.
3. Run `entry` or `chain` only when the disk structure is important, for example for a loader that reads sectors directly.
4. Run `bam` only to find used sectors that no file uses. `unreferenced` lists them. The list does not include the header, the directory and the BAM blocks. These sectors can hold data that a loader reads directly.

## Knowledge

Automatic write:
- none.

Do not store:
- the directory list
- sector chains.

A downstream skill records the meaning of the extracted content.

## Tapes and cartridges

The script reads T64 and CRT files itself. The host runtime is not necessary for them.

- T64: `directory` and `read`. Many T64 files have a wrong end address. Then the entry has `fixedSize: true`, and the size comes from the position of the next file.
- CRT: `directory` and `crt`. The script reads hardware types 0 (normal 8K, 16K or Ultimax), 5 (Ocean), 19 (Magic Desk) and 32 (EasyFlash). It refuses other types by name. `crt` writes `crt.json` and one PRG for each CHIP packet, for example `bank3-8000.prg`.
- A cartridge bank uses the same addresses as other banks. Analyze each bank PRG with c64-static-analysis and `--space bank3`, and record its knowledge in space `bank3`.
- TAP: a TAP file holds tape signals, and turbo loaders have their own formats. The script does not read it. Start it with the c64-emulator skill, or capture its parts with `loads` of the c64-unpacker skill.

## Result

The directory, the BAM, an entry or a sector chain as JSON.

`read` writes the file at the output path. Its result gives the `name` and the file as `{out, bytes, sha256}`. `crt` gives the header, `chips` and `files`: one item for each PRG and one for `crt.json`.

## Failure and conflicts

- `not-found`: the image file is missing, or the image has no file with that name. Read the directory again and compare the names.
- `media-error`: the image has a defect or is not a disk image. The message tells the problem, for example a sector chain that loops. Tell the user. Do not change the image.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `invalid-input`: an argument or a path is wrong. Read the message and correct the call.

A file that is not `closed` was not written fully. Its data can be incomplete.

## Handoffs

- BASIC program → c64-basic
- Packed program → c64-unpacker
- Machine code, also a cartridge bank → c64-static-analysis
- A TAP file → c64-unpacker
- Run the program → c64-emulator
