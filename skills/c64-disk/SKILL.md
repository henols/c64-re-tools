---
name: c64-disk
description: Use this skill to examine a C64 disk image (D64, D71, D81 or G64) and to extract files from it into the project. It shows the directory, the BAM, the directory entry of a file and the sector chain of a file. Do not use it to run a program or to decode BASIC. Give an extracted file to the c64-basic, c64-unpacker or c64-static-analysis skill.
---

# c64-disk

## Purpose

Examine a C64 disk image. Extract a file from the image into the project.

This skill does not change the disk image and does not change project knowledge.

## Inputs

- The disk image: a `.d64`, `.d71`, `.d81` or `.g64` file, relative to the project directory.
- For one file: the file name as the directory shows it.
- To extract a file: the output path, relative to the project directory.

## Tools / execution path

The script sends the image to the host runtime. The host runs c1541 and sends the result back. The script writes an extracted file into the project.

```
node <skill>/scripts/disk.ts <action> <image> [name] [--out <file>]
```

| Need | Command |
|---|---|
| The disk name, the free blocks and the files | `directory original/game.d64` |
| The free and used sectors of each track | `bam original/game.d64` |
| The type, size and first block of one file | `entry original/game.d64 GAME` |
| The track and sector of each block of one file | `chain original/game.d64 GAME` |
| Extract one file | `read original/game.d64 GAME --out extracted/game.prg` |

The script prints one JSON object.

File names show the characters that the C64 shows in a directory list. A byte that has no character shows as `{$xx}`, for example `{$c1}`. Write the name in the same form. The letter case of a name is not important. Put the name in single quotes in a shell, for example `'GAME {$c1}'`.

## Workflow

1. Run `directory`. Find the file in `entries`. Each entry has a `name`, a `type`, a size in `blocks` and the `closed` and `locked` flags.
2. Run `read` with an output path to extract the file. A PRG file keeps its 2-byte load address at the start.
3. Run `entry` or `chain` only when the disk structure is important, for example for a loader that reads sectors directly.
4. Run `bam` only to find used sectors that no file uses.

## Knowledge

Automatic write:
- none.

Do not store:
- the directory list
- sector chains.

A downstream skill records the meaning of the extracted content.

## Result

The directory, the BAM, an entry or a sector chain as JSON. Or the extracted file in the project at the output path.

The exit status is 0 for a result with the file. The exit status is 1 for `found: false` and for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `found: false`: the image has no file with that name. This is a normal result. Read the directory again and compare the names.
- `media-error`: the image has a defect or is not a disk image. The message tells the problem, for example a sector chain that loops. Tell the user. Do not change the image.
- `installation-incomplete`: c1541 is not on the host. Tell the user the message.
- `operation-failed` with a message about the host runtime: the host runtime does not run. Tell the user to start the host runtime with `npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host`.
- `invalid-input`: an argument or a path is wrong. Read the message and correct the call.

A file that is not `closed` was not written fully. Its data can be incomplete.

## Handoffs

- BASIC program → c64-basic
- Packed program → c64-unpacker
- Machine code → c64-static-analysis
- Run the program → c64-emulator
