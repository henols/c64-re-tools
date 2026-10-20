---
name: c64-basic
description: Decodes a C64 BASIC V2 program (PRG) into a readable listing. It finds where the BASIC gives control to machine code with SYS or USR. Use it on the start file of a game or of a demo. Use it to find the address where the machine code starts. It does not run the program, and it does not disassemble machine code.
---

# C64 BASIC

Use this script to decode a C64 BASIC V2 program and to find its handoffs to machine code.
Use only the commands of the script. Do not decode BASIC in another way.

```bash
node <skill>/scripts/basic.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `list extracted/game.prg`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Read the BASIC lines of a program | `list extracted/game.prg` |
| Find the address where BASIC starts the machine code | `list extracted/game.prg` |

## Programs

- `<program>` is a PRG file. A PRG starts with its 2-byte load address.
- Get the PRG from a disk image, a tape file or a cartridge file first. The script refuses a disk image, a tape file and a cartridge file.

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
- When a file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses evidence in that folder.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Decode a program

### `list <program>`

`body` holds:

- `listing`: the BASIC lines. Each line starts with its BASIC line number. Keywords show in lower case. A control character in a string shows in braces, for example `{clr}`.
- `handoffs`: each place where the BASIC gives control to machine code. Each handoff has a `kind` (`sys` or `usr`) and the BASIC `line`.
  - A `sys` handoff with an `address` calls the machine code at that address. The script calculates a SYS argument with numbers, π, `+`, `-`, `*`, `/` and brackets. For example, `SYS π*656` calls `$080c`.
  - A handoff with `computed: true` gets its address from a calculation at run time, for example with `PEEK`. A `sys` handoff of this type gives its argument in `expression`.
- `loadRange`: the `start` and the `end` of the program in memory.
- `basicEnd`: the first address after the BASIC, or `null`. From `basicEnd` to the end of `loadRange`, the file holds bytes that are not BASIC. Usually these bytes are the machine code that the handoff calls.

The addresses are for a load to the load address of the file. A load without `,1` puts a BASIC program at `$0801`. Most loaders have `$0801` as their load address.

Some programs have no end marker (two zero bytes) after the last line. Then the machine code starts directly after the last line, and `basicEnd` is the first byte of that machine code.

`hint` gives the next task:

- A handoff address: disassemble the machine code at that address.
- A computed handoff: find the address in the emulator at run time. Do not guess the address.
- No handoff: the BASIC starts no machine code with SYS or USR. Look in the listing for a POKE into a vector or a LOAD of another file. Do not make up a handoff.

When the address where the machine code starts is a durable fact, record it in the project knowledge. Do not record the listing.

Failure:

- `invalid-input` with "is no BASIC program": the file is not a BASIC program. Usually the file is machine code. Disassemble it from its load address. A memory dump also gives this error.
- `invalid-input` with "is a disk image" or a similar text: get the PRG out of the file first.

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

