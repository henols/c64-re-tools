---
name: c64-packer
description: Packs and crunches C64 PRG files with Exomizer into one PRG that unpacks itself and starts with RUN. It checks each byte and the entry of the result before it writes the PRG. Use it to make a small release file of a rebuilt or new program. Use it to merge more PRG files into one program. It does not assemble or run the program. It does not unpack a packed program.
---

# C64 packer

Use this script to pack PRG files of the project into one PRG that unpacks itself.
Use only the commands of the script. Do not pack or crunch a program in another way.

```bash
node <skill>/scripts/packer.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `pack build/game.prg --out build/game-packed.prg`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Pack a BASIC program at `$0801` that starts with `SYS` | `pack build/game.prg --out build/game-packed.prg` |
| Pack a program that starts at a known address | `pack build/main.prg --entry '$0400' --out build/release.prg` |
| Merge more PRG files into one packed program | `pack build/clean_loader.prg build/clean.prg --entry '$0400' --out build/clean_packed.prg` |
| Start the program with RAM in place of the BASIC and KERNAL ROMs | `pack build/game.prg --exit-memory '$35' --out build/game-packed.prg` |

---

## Inputs and the entry

- `<input.prg>` is a PRG file of the project. Give more files in load order to merge them into one program. Where two files overlap, the later file wins.
- The packed PRG loads at `$0801` and starts with RUN. It unpacks the program and jumps to the entry.
- The entry is the address where the program starts after the unpack. When the first input is a BASIC program at `$0801` with `SYS` and a number, the script uses that address. Else, give `--entry` with the start address of the program, for example the entry of the program in the project knowledge.
- `--exit-memory` is the value of `$01` when the program starts. Give it when the program uses RAM under BASIC or KERNAL and does not set `$01` itself.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- In a group folder, each version of a program is a project. The script refuses the group folder and each folder in it that is not a project. Give `--project` with a project of the group, for example `--project v1`.
- A path that a command only reads can go into another project of the group, for example `../v1/releases/game.prg`. The command writes only in its own project.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/`. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a test or another file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses that evidence in that folder.
- A coverage map can stay in `.c64-re-tools/local/`. Do not move a coverage map after you put it into the project knowledge.
- To keep a run as evidence, use the command that keeps a run. It copies the run, its results and its snapshot files into `runs/<name>/`, and it changes the paths in the copy. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--out <file.prg>` | `pack` | Write the packed program to this file. `pack` needs this flag. The file must not be an input. |
| `--entry <address>` | `pack` | Jump to this address after the unpack. It must be `$0400` or higher. The default is the `SYS` address of the BASIC line of the first input. |
| `--exit-memory <value>` | `pack` | Set `$01` to this value, `$34` to `$37`, when the program starts. With it, the program starts with interrupts off. The default is `$37`: BASIC, KERNAL and I/O. |

---

## Pack

### `pack <input.prg>...`

`pack` packs the inputs into one program, and unpacks the result again to check it. It writes the packed program only when the check finds no difference.

`body` holds:

- `result`:
  - `PASS`: the packed program unpacks to the bytes of all inputs and jumps to the entry. The PRG is at `out`.
  - `FAIL`: the packed program unpacks to different bytes, or jumps to a different address. The script did not write a file.
  - `INCONCLUSIVE`: the check has only the largest range that the unpacker wrote. Bytes of the inputs outside that range have no check. This occurs when the inputs have gaps between them. The PRG is at `out`.
- `out`, `bytes` and `sha256`: the packed PRG. A `FAIL` has no `out`.
- `packedBytes` and `unpackedBytes`: the size of the packed PRG and of the bytes of the inputs. `percent` is the packed size as a percentage of the unpacked size.
- `entry` and `exitMemory`: the entry and the value of `$01` of the call.
- `unpackSeconds`: the time of the unpack, in seconds at the PAL clock. A real C64 can need more time.
- `inputs`: each input with its `file`, `loadRange` and `bytes`.
- `check.entry`: the address where the unpacker jumped.
- `check.segments`: one check for each segment of the merged inputs. The `result` of a segment is `identical`, `different` or `not covered`. A `different` segment has `differences` and `firstDifference`. `firstDifference` gives the `address`, the unpacked byte (`built`) and the input byte (`reference`).

`hint` gives the action for the result:

- `PASS`: run the packed program in the emulator with RUN. Make sure that the program starts and works.
- `INCONCLUSIVE`: run the packed program in the emulator. Examine the memory of each segment that is `not covered`.
- `FAIL`: do not use the packed program. Give the call and `check` to the user.

Traps:

- The unpacker starts with `SYS 2061`, at `$080d`. A BASIC program at `$0801` often has its entry at `$080d` too. Then the CPU gets to `$080d` two times: first before the unpack, then at the start of the program. To examine the program at its entry in the emulator, stop at `$080d`, run one frame, and stop at `$080d` again.
- A program that loads into `$0334` to `$03ff` or into the zero page can fail, because the unpacker uses these addresses while it runs. Then the command fails with `operation-failed`, or the check gives `FAIL`. Give the result to the user.
- `invalid-input` for the entry: the entry is below `$0400`. The unpacker runs there. A program with an entry below `$0400` needs a different packer.
- `invalid-input` with "There is no SYS address": the first input has no BASIC line with `SYS` and a number. Give `--entry`.
- `operation-failed` with "Exomizer could not pack the program": `hint` gives the last output of Exomizer. Change the inputs, or give the message to the user.

---

## Workflow

1. Assemble the program. Use the release or the switches that you want in the packed file.
2. Find the entry and the value of `$01`. See the section "Inputs and the entry".
3. Run `pack`.
4. Do the action that `hint` gives for `body.result`.
5. To release the program on a disk, write the packed PRG to a disk image.

The packed program and the check result do not go into the project knowledge.

---

## JSON output

Each command prints one JSON envelope on one line on stdout. Notes go to stderr.

- On success, the exit code is 0: `{"ok": true, "command": "<command>", "body": {}, "hint": "...", "nextAction": "..."}`
- On failure, the exit code is 2: `{"ok": false, "command": "<command>", "code": "<code>", "error": "...", "hint": "...", "nextAction": "..."}`
- `body` holds the result. The section of each command gives the fields of its body.
- A check gives its verdict in `body.result`: `PASS`, `FAIL` or `INCONCLUSIVE`. The exit code is 0 for each verdict. Thus read `body.result`, not the exit code.
- `error` is one sentence. It tells what is wrong. `hint` tells what to do or what to examine. Read it before your next step.
- `nextAction` is a full command line. It runs from any directory. Run it when it agrees with your task.
- A list has `count`, `listed` and `rest`. `listed` holds at most `--max-listed` items. `rest` tells how to get the other items. A file that the command wrote has `out`, `bytes` and `sha256`.
- To get only some fields of `body`, give `--fields <path>,<path>`, for example `--fields count,listed.start`. A path through a list gives that field of each item. Do not write code to filter an envelope.
- To get the command list, run the script with no arguments. To get the subjects and the flags of one command, run `<command> --help`.

| `code` | Action |
|---|---|
| `installation-incomplete`, `machine-unavailable` | Stop the task. Give `error` and `hint` to the user and wait for the user. Do not install, start or change a tool. Do not make a replacement for the tool, for example your own disk parser, disassembler or emulator script. |
| `invalid-input`, `not-found` | Correct the call as `hint` tells. Then run the command again. |
| `operation-failed` | Give `error` and `hint` to the user. |
| Another code | Do as `hint` tells. |
