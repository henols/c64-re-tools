---
name: spectrum-memory-map
description: Gives the ZX Spectrum platform meaning of an address. Examples are a ROM routine such as LD_BYTES, a restart such as RST $28 and a system variable such as FRAMES. It also decodes a value that the program writes to the ULA port, to the paging port $7FFD or to an attribute. It tells when an address has no platform meaning and belongs to the application. Use it when code reads or writes an address that you do not know. Use it to get the platform names as an include file for sjasmplus. It does not read the memory of a running program, and it does not change the project knowledge.
---

# ZX Spectrum memory map

Use this script to get the ZX Spectrum platform meaning of an address, a port or a value.
Use only the commands of the script. Do not look up ZX Spectrum platform addresses in another way.

```bash
node <skill>/scripts/memory-map.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `at '$5c78'`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Find what one or more addresses mean | `at '$5c78' '$0556' '$8000'` |
| Find the address of a platform name | `at FRAMES LD_BYTES` |
| Decode a value that the program writes to port `$7FFD` | `decode paging '$17'` |
| Decode a value that the program writes to the ULA port | `decode ula '$07'` |
| Decode an attribute byte | `decode attribute '$38'` |
| Read the system variables | `list system` |
| Read the I/O ports | `list ports` |
| Write the platform names as a sjasmplus include file | `export --out src/platform.asm` |

## Addresses and values

- `<address>` is an address from the code or from the question. It can also be a platform name, for example `FRAMES` or `LD_BYTES`, in upper or lower case. The commands `list` and `export` show the platform names. A platform name comes before a name of the project knowledge.
- A platform name has `_` where the ROM disassembly has `-`.
- `<what>` is the kind of value: `ula`, `paging` or `attribute`.
- `<value>` is a value from 0 to 255. Write it as `$` and hex digits, as a decimal number, or as `%` and binary digits. Put a `$` value in single quotes in a shell.
- `<list>` is one of `rom`, `system`, `areas` and `ports`.
- The ROM names are the names of the 48 BASIC ROM. On the 128K, they are correct only when port `$7FFD` selects ROM 1. To find the ROM, decode the last value that the program writes to `$7FFD` with `decode paging`.

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
| `--max-listed <n>` | `list` | The maximum number of entries in `listed`. The default is 50. |
| `--out <file>` | `export` | The include file to write, relative to the project folder. Required. |

---

## Look up an address

### `at <address>...`

`body.addresses` holds one item for each address:

- `kind`: `platform` or `application`.
  - `platform`: the ZX Spectrum gives the address a meaning. Read `name` and `meaning`.
  - `application`: the address has no platform meaning. The program decides its use. This is not a failure.
- `area`: the memory area of the address: `rom`, `screen`, `attributes`, `printer-buffer`, `system-variables` or `ram`.
- `entryStart`: the first address of the entry, for a byte in an entry of more than one byte. An example is the high byte of a system variable.

When an address has the kind `application`, `hint` names it. Find its use in the disassembly or in the emulator.

Do not record platform facts in the project knowledge. A conclusion about the application can go into the project knowledge. An example is "the program puts its interrupt routine in a table that the register I points to".

Failure:

- `invalid-input` with "is not a ZX Spectrum platform name": the name is not a platform name and not a name in the project knowledge. Give a `$` address, a platform name, or a symbol of the project knowledge.
- `invalid-input` with "must be $ and 1 to 4 hex digits": the address is not correct. A decimal number is not an address.

### `decode <what> <value>`

`body` holds `what`, `value`, and the meaning of each bit field of the value:

- `ula`: a value that the program writes with OUT to an even port. The fields are `border`, `mic` and `beeper`.
- `paging`: a value that the program writes to port `$7FFD` of the 128K. The fields are `ramBank` (the RAM bank at `$C000`), `screenBank`, `rom` and `locked`.
- `attribute`: an attribute byte. The fields are `ink`, `paper`, `bright` and `flash`.

The ULA decodes each even port. Thus `OUT ($FE),A` and an OUT to a different even port do the same thing. To get the meaning of each port, run `list ports`.

Failure:

- `invalid-input` with "must be one of": `<what>` is not `ula`, `paging` or `attribute`.

### `list <list>`

`body.entries` is a list of the entries of the group: `count`, `listed` and `rest`.

- `rom` and `system`: each item has `start`, `end` for an entry of more than one byte, `name` and `meaning`.
- `areas`: each item has `start`, `end`, `name` and `meaning`.
- `ports`: each item has `port`, `name` and `meaning`.

When the list is cut, `hint` gives the full count, and `nextAction` runs `list` again with a `--max-listed` that holds all entries.

### `export`

Writes all platform names to the project file at `--out`, as a sjasmplus include file. Each line is `NAME EQU $xxxx` for one name, with its meaning as a comment.

`body` holds `names` (the number of names) and the file as `out`, `bytes` and `sha256`.

Include the file with `INCLUDE` in source that you write by hand.

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
