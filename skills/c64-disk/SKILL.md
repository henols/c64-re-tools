---
name: c64-disk
description: Examines a C64 disk image (D64, D71, D81 or G64), a T64 tape file or a CRT cartridge file. It extracts files from it into the project. It shows the directory, the BAM, the directory entry of a file and the sector chain of a file. It writes the bytes of sectors to a file. It writes each bank of a cartridge as a PRG. Use it when a program comes as a disk image, a tape file or a cartridge file. Use it to find the sectors that a loader reads directly. It does not run the program, it does not decode BASIC, and it does not change the disk image.
---

# C64 disk

Use this script to extract files from a C64 disk image, a T64 tape file or a CRT cartridge file, and to examine them.
Use only the commands of the script. Do not read disk images, tape files or cartridge files in another way.

```bash
node <skill>/scripts/disk.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `directory original/game.d64`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Get the disk name, the free blocks and the files of a disk | `directory original/game.d64` |
| Extract one file of a disk | `read original/game.d64 GAME --out extracted/game.prg` |
| Get the type, the size and the first block of one file | `entry original/game.d64 GAME` |
| Get the track and the sector of each block of one file | `chain original/game.d64 GAME` |
| Find the used sectors that no file uses | `bam original/game.d64` |
| Write the bytes of the used sectors that no file uses | `sectors original/game.d64 --unreferenced --out .c64-re-tools/local/hidden.bin` |
| Write the bytes of some sectors | `sectors original/game.d64 18/0 20/5 --out .c64-re-tools/local/sectors.bin` |
| Get the files of a tape | `directory original/game.t64` |
| Extract one file of a tape | `read original/game.t64 GAME --out extracted/game.prg` |
| Get the banks of a cartridge | `directory original/game.crt` |
| Write each bank of a cartridge as a PRG | `crt original/game.crt --out cart` |

## Images and file names

- `<image>` is the file that the user gives. Each command takes only some types of file:

  | Command | Types of file |
  |---|---|
  | `directory` | `.d64`, `.d71`, `.d81`, `.g64`, `.t64`, `.crt` |
  | `read` | `.d64`, `.d71`, `.d81`, `.g64`, `.t64` |
  | `bam`, `entry`, `chain`, `sectors` | `.d64`, `.d71`, `.d81`, `.g64` |
  | `crt` | `.crt` |

- `<name>` is a file name from the result of `directory`. Write the name in the same form as the directory shows it. The letter case of a name is not important.
- A name shows the characters that the C64 shows in a directory list. A byte that has no character shows as `{$xx}`, for example `{$c1}`. Put the name in single quotes in a shell, for example `'GAME {$c1}'`.
- Put `--` before a name that starts with `-`. Put the `--` after all flags, for example `read d.d64 --out x.prg -- '-----'`.
- The script does not read a TAP file. A TAP file holds tape signals, and turbo loaders have their own formats. Start a TAP file in the emulator, or capture the parts of the program that it loads.

### Wrong files and names

- `not-found`: the image file is missing, or the image has no file with that name. Run `directory` again and compare the names.
- `media-error`: the file has a defect, or its content is not of its type. A cartridge of a hardware type that the script does not read also gives `media-error`. `error` tells the problem, for example a sector chain that loops. Give `error` to the user. Do not change the file.
- `invalid-input` with "is not a file that": the command does not take this type of file. `hint` gives each type that the command takes.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- In a group folder, each version of a program is a project. The script refuses the group folder and each folder in it that is not a project. Give `--project` with a project of the group, for example `--project v1`.
- A path that a command only reads can go into another project of the group, for example `../v1/original/game.prg`. The command writes only in its own project.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/` and the index of the knowledge. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a test or another file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses that evidence in that folder.
- A coverage map can stay in `.c64-re-tools/local/`. The project knowledge keeps its ranges and its SHA-256.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--out <file>` | `read`, `sectors` | The file to write, relative to the project folder. Required. |
| `--unreferenced` | `sectors` | Write also the used sectors that no file uses, after the given sectors. |
| `--out <dir>` | `crt` | The folder for the bank files and `crt.json`, relative to the project folder. Required. |

---

## Examine a file

### `directory <image>`

For a disk image, `body` holds `diskName`, `diskId`, `dosType`, `freeBlocks` and `entries`. Each entry has `name`, `type`, `blocks`, `closed` and `locked`.

For a tape file, `body` holds `name` and `entries`. Each entry has `name`, `start`, `end` and `bytes`. Many T64 files have a wrong end address. Then the entry has `fixedSize: true`, and the size comes from the position of the next file.

For a cartridge file, `body` holds the header and `chips`. The header is `name`, `type`, `typeName`, `exrom`, `game`, and `mode` for type 0. Each chip has `bank`, `address`, `size` and `space`.

When a file on a disk is not `closed`, `hint` names it. The data of that file can be incomplete.

Do not record the directory list in the project knowledge.

### `bam <image>`

`body.tracks` gives the `freeSectors` and the `usedSectors` of each track. `body.unreferenced` lists the used sectors that no file uses. The list does not include the header, the directory and the BAM blocks. These sectors can hold data that a loader reads directly.

When `body.unreferenced` is not empty, `nextAction` is the `sectors` command that writes their bytes.

### `entry <image> <name>`

`body` holds `found: true` and `entry`: the `name`, `type`, `blocks`, `closed`, `locked`, `startTrack` and `startSector` of the file. Use it when the disk structure is important, for example for a loader that reads sectors directly.

### `chain <image> <name>`

`body` holds `found: true` and `sectors`: the `track` and the `sector` of each block of the file, in sequence. Do not record the sector chain in the project knowledge.

---

## Extract files

### `read <image> <name>`

Writes the bytes of one file at `--out`. A PRG file keeps its 2-byte load address at the start. A file from a tape gets the start address of its tape entry as its load address.

`body` holds the `name` of the file and the written file as `out`, `bytes` and `sha256`.

For a cartridge file, the script refuses `read`. Use `crt`.

### `sectors <image> [<track>/<sector>...]`

Writes the 256 bytes of each sector at `--out`, in the given sequence. Give each sector as `<track>/<sector>` in decimal, for example `18/1`. With `--unreferenced`, the file also gets the used sectors that no file uses, after the given sectors. Give at least one sector or `--unreferenced`.

`body.count` is the number of sectors. `body.sectors` gives the `track`, the `sector` and the `offset` of each sector in the file. `body` also holds the written file as `out`, `bytes` and `sha256`.

When the disk has no used sectors that no file uses and you give no sectors, the script writes no file. Then `body.count` is 0, and `hint` tells it.

- `invalid-input` with "The disk has no track": the disk does not have that sector. Run `bam` and give a sector that it shows.

### `crt <file.crt>`

Writes one PRG for each CHIP packet of the cartridge, for example `bank3-8000.prg`. It also writes `crt.json` with the header and the packets. The script reads hardware types 0 (normal 8K, 16K or Ultimax), 5 (Ocean), 19 (Magic Desk) and 32 (EasyFlash).

`body` holds the header, `chips` and `files`. Each chip has `bank`, `address`, `size`, `space` and `file`. `files` has one item for each PRG and one item for `crt.json`.

All banks use the same addresses. Thus `hint` tells you to analyze each bank PRG in its own knowledge space. The field `space` of the chip gives that space, for example `bank3`. Record the knowledge of the bank in that space too.

---

## Workflow

1. Run `directory`. Find the file in `entries`.
2. Run `read` to extract the file. For a cartridge, run `crt`.
3. Run `entry` or `chain` only when the disk structure is important.
4. Run `bam` only to find the used sectors that no file uses. Then run `sectors --unreferenced` to examine their bytes.
5. Give the extracted file to the next task. Decode a BASIC program, unpack a packed program, or disassemble machine code.

---

## JSON output

Each command prints one JSON envelope on one line on stdout. Notes go to stderr.

On success, the exit code is 0:

```json
{"ok": true, "command": "<command>", "body": {}, "hint": "...", "nextAction": "..."}
```

On failure, the exit code is 2:

```json
{"ok": false, "command": "<command>", "code": "<code>", "error": "...", "hint": "...", "nextAction": "..."}
```

- `body` holds the result. The section of each command gives the fields of its body.
- A check gives its verdict in `body.result`: `PASS`, `FAIL` or `INCONCLUSIVE`. The exit code is 0 for each verdict. Thus read `body.result`, not the exit code.
- `error` is one sentence. It tells what is wrong.
- `hint` tells what to do or what to examine. Read it before your next step. Some envelopes have no `hint`.
- `nextAction` is a full command line. It runs from any directory. Run it when it agrees with your task. Some envelopes have no `nextAction`.
- `code` does not change between versions. Do the action for the code:

| `code` | Action |
|---|---|
| `installation-incomplete`, `machine-unavailable` | Stop the task. Give `error` and `hint` to the user and wait for the user. Do not install, start or change a tool. Do not make a replacement for the tool, for example your own disk parser, disassembler or emulator script. |
| `invalid-input`, `not-found` | Correct the call as `hint` tells. Then run the command again. |
| `operation-failed` | Give `error` and `hint` to the user. |
| Another code | Do as `hint` tells. |

These fields have the same meaning in each body:

| Field | Meaning |
|---|---|
| `out`, `bytes`, `sha256` | A file that the command wrote: its path, its size and its SHA-256. |
| `count`, `listed`, `rest` | A list. `count` is the number of items. `listed` holds the first items, at most `--max-listed`. `rest` tells how to get the other items. |

To get the command list, run the script with no arguments. The envelope has `command: "help"`, and `body.commands` gives the name, the summary and the synopsis of each command.
To get the subjects and the flags of one command, run `<command> --help`. Then `body.subjects` and `body.options` give them.

