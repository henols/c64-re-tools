---
name: spectrum-basic
description: Lists the Sinclair BASIC of a ZX Spectrum tape, snapshot or program file. It reads TAP, TZX, .z80 and .sna files. It finds where the BASIC gives control to machine code with USR. It also finds CLEAR, which sets the top of BASIC, and LOAD "" CODE, which loads the next file. It shows a number that the program keeps hidden behind other digits. Use it on the loader of a game. Use it to find the address where the machine code starts. It does not run the program, and it does not disassemble machine code.
---

# ZX Spectrum BASIC

Use this script to list a Sinclair BASIC program and to find its handoffs to machine code.
Use only the commands of the script. Do not decode BASIC in another way.

```bash
node <skill>/scripts/basic.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `list original/game.tap`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Read the BASIC lines of each program on a tape | `list original/game.tap` |
| Read the BASIC program in the memory of a snapshot | `list original/game.z80` |
| Read the BASIC of a 128K program on a tape | `list original/game.tap --model 128k` |
| Find the address where BASIC starts the machine code | `list original/game.tap` |

## Programs

- `<file>` is a tape (`.tap` or `.tzx`), a snapshot (`.z80` or `.sna`), or the bytes of a program.
- On a tape, the script lists each program. A program is a header block and the data block after it.
- In a snapshot, the script lists the program that the system variables `PROG` and `VARS` show in memory.
- The bytes of a program are the data of a program block, without the flag byte and the checksum. Write the data of the block to a file first.
- The tokens `$A3` and `$A4` are the keywords `SPECTRUM` and `PLAY` only on the 128K. On the 48K, they are the user graphics T and U. The script uses the model of a snapshot, else the 48K. For a tape of a 128K program, give `--model 128k`.

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
| `--model <model>` | `list` | The model for the tokens `$A3` and `$A4`: `48k` or `128k`. The default is the model of a snapshot, else `48k`. |

---

## List a program

### `list <file>`

`body.programs` holds one item for each program. Each item has:

- `listing`: the BASIC lines. Each line starts with its BASIC line number. The keywords show in capitals, also in strings and in REM, as LIST shows them. A colour code or a position code shows in braces, for example `{INK 2}` or `{AT 3,4}`. A user graphic shows as `{UDG A}`. Another byte that is not a character shows as `{$xx}`.
- `handoffs`: each place where the BASIC gives control to machine code or loads a file. Each handoff has a `kind` and the BASIC `line`.
- `variableBytes`: the number of bytes of the BASIC variables after the program.
- On a tape: `block`, `name` and `autostart`. `block` is the number of the header block. `autostart` is the line that the header starts, or `null`.
- In a snapshot: `from`, the address where the program starts. For the bytes of a program, `from` is `file`.

On a tape, `body.code` lists the CODE files of the tape. Each CODE file has `block`, `name`, `address` and `length`. `address` is the load address from the header.

Look for `{=value}` after a number in the listing. BASIC keeps a hidden form of each number in the text, and the program uses the hidden form. A loader can show `USR 0` and keep `32768` hidden. Then the listing shows `USR 0{=32768}`, and the program calls `$8000`.

The kinds of handoff:

- `usr` with an `address`: the BASIC calls the machine code at that address. The address comes from a number or from `VAL "digits"`.
- `usr` with `computed: true`: the address comes from a calculation at run time.
- `clear`: CLEAR puts the top of BASIC (RAMTOP) at `address`. Usually the machine code is above that address.
- `load-code`: the program loads the next file with LOAD "" CODE. `address` is the load address when the text gives it. Else the header of the file gives the address.
- `load-screen`: the program loads the next file with LOAD "" SCREEN$.

On a tape, compare the `usr` address with `body.code`. The CODE file that loads to that address holds the machine code.

A program on a tape without its data block has `problem` and no listing. Then the game has its own loader, or the tape is cut.

`hint` gives the next task:

- A `usr` address: disassemble the machine code at that address. `hint` also names the CODE file that loads to that address.
- A computed address: find the address in the emulator at run time. Do not guess the address.
- No `usr` handoff: the BASIC starts no machine code with USR. Look in the listing for a POKE or a LOAD of another file. Do not make up a handoff.
- A program without its data block: load the tape in the emulator, and stop at the entry of the machine code.

When the address where the machine code starts is a durable fact, record it in the project knowledge. Do not record the listing.

Failure:

- `invalid-input` with "is no BASIC program": the bytes are not a BASIC program. Usually the bytes are machine code. Disassemble them from their load address.
- `invalid-input` with "holds no BASIC program": the system variables of the snapshot show no BASIC program in memory.
- `not-found`: there is no file at the path. Correct the path.

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
