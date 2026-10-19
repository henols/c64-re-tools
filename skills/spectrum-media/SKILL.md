---
name: spectrum-media
description: Examines ZX Spectrum media in the project. It lists the blocks of a TAP or TZX tape with their ROM headers and checksums. It writes the data of a block to a project file. It gives the machine state of a .z80 or .sna snapshot. It writes a .scr screen or the screen of a snapshot as a PNG. Use it when a program comes as a tape, a snapshot or a screen file. It does not run the program, and it does not list BASIC.
---

# ZX Spectrum media

Use this script to examine the tapes, the snapshots and the screens of a ZX Spectrum program.
Use only the commands of the script. Do not read tapes, snapshots or screen files in another way.

```bash
node <skill>/scripts/media.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `blocks original/game.tzx`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Get the blocks and the files of a tape | `blocks original/game.tzx` |
| Write the data of one block to a file | `read original/game.tzx 3 --out .c64-re-tools/local/block3.bin` |
| Get the registers, the border and the paging of a snapshot | `snapshot original/game.z80` |
| Write the screen of a snapshot as a PNG | `screen original/game.z80 --out .c64-re-tools/local/screen.png` |
| Write a screen file as a PNG with a black border | `screen original/title.scr --border 0 --out .c64-re-tools/local/title.png` |

## Tapes, snapshots and screens

- `<tape>` is a `.tap` or `.tzx` file.
- `<snapshot>` is a `.z80` or `.sna` file.
- A screen file is a `.scr` file of 6912 bytes: the bitmap and the attributes.
- `<block>` is the number of a block, as `blocks` gives it. The first block is 0.

### Wrong files

- `not-found`: there is no file at the path. Correct the path.
- `invalid-input` with "is no tape" or "is no snapshot": the command does not take this type of file. Give a file of the type that the command takes.
- `invalid-input` with another text: the file is cut, or its content is not of its type. Give `error` to the user. Do not change the file.

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
| `--out <file>` | `read` | The data file to write, relative to the project folder. Required. |
| `--out <file.png>` | `screen` | The PNG file to write, relative to the project folder. Required. |
| `--border <colour>` | `screen` | The border colour from 0 to 7, only for a `.scr` file. The default is 7 (white). |

---

## Examine a tape

### `blocks <tape>`

`body` holds `count` and `blocks`. Each block has:

- `block`: the number of the block.
- `kind`: the kind of block.
  - `standard`: the ROM format.
  - `turbo`: the TZX block `$11`, with other timings.
  - `pure-data`: the TZX block `$14`.
  - `other`: a TZX block without data. This block has `id`, the TZX block ID. A description block also has `text`.
- `flag`, `length` and `checksumOk`, for a block with data. `length` does not include the flag byte and the checksum.
- `header`, for a ROM header block: the `type`, the `name` and the `length` of the next file.
  - A `program` header also gives `autostart` and `programLength`. `autostart` is the line that the header starts, or `null`.
  - A `code` header also gives `address`, the load address of the file.

A file on a tape is a header block (`flag` `$00`, with `header`) and the data block after it (`flag` `$FF`).

A game with its own loader often has `turbo` or `pure-data` blocks. Its data blocks often have no ROM header. The own loader of the game decides where these blocks go in memory.

A data block with `checksumOk: false` has a bad checksum. The ROM refuses that block. An own loader can use a different checksum.

`hint` gives the next task:

- A `program` header: list the BASIC of the tape.
- A `code` header: write the data of the CODE file with `read`, and disassemble it at its load address. `nextAction` is the `read` command for the first CODE file.
- Blocks without a ROM header, `turbo` blocks or `pure-data` blocks: load the tape in the emulator, and stop at the entry of the machine code. Then find where these blocks go in memory.

Do not record the block list in the project knowledge.

### `read <tape> <block>`

Writes the data of one block at `--out`, without its flag byte and its checksum.

`body` holds `block` and the written file as `out`, `bytes` and `sha256`.

When the block before it is a ROM header, `hint` gives the next task. For a `code` header, disassemble the data at the load address of the header. For a `program` header, list the BASIC of the data.

When the load address of a file is a durable fact, record it in the project knowledge.

Failure:

- `invalid-input` with "holds no data": the block has no data, for example a TZX block of the kind `other`. Give a block that `blocks` shows with a `flag`.

---

## Examine a snapshot

### `snapshot <snapshot>`

`body` holds:

- `model`: `48k` or `128k`.
- `registers`: `pc`, `sp`, `af`, `bc`, `de`, `hl`, `ix`, `iy`, the second set `af2`, `bc2`, `de2` and `hl2`, and `i`, `r`, `im`, `iff1` and `iff2`. `im` is the interrupt mode.
- `border`: the border colour from 0 to 7.
- On the 128K: `port7ffd`, `pagedBank` and `screenBank`. `port7ffd` is the last value that the program wrote to port `$7FFD`. `pagedBank` is the RAM bank at `$C000`. `screenBank` is 5 or 7.

`registers.pc` is the address where the program stops in the snapshot. When the entry point of the program is a durable fact, record it in the project knowledge.

Do not record the state of the snapshot in the project knowledge.

### `screen <file>`

Writes the screen as a PNG at `--out`. The PNG has 320 x 256 pixels: the picture of 256 x 192 pixels with the border around it.

- For a snapshot, the PNG shows the screen bank that port `$7FFD` selects, and the border of the snapshot.
- For a `.scr` file, the border is 7 (white). Give `--border` for a different colour.

`body` holds `width`, `height` and the written file as `out`, `bytes` and `sha256`.

Failure:

- `invalid-input` with "--border works only with a .scr file": a snapshot gives its own border. Remove `--border`.
- `invalid-input` with "a .scr screen has 6912": the file is not a screen file.

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
