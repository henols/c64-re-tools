---
name: c64-memory-map
description: Gives the C64 platform meaning of an address. Examples are a VIC-II, SID or CIA register, a KERNAL routine, a vector or a system variable. It also decodes the value of a hardware register, for example the memory configuration in $01 or the screen address in $D018. It tells when an address has no platform meaning and belongs to the application. Use it when code reads or writes an address that you do not know. Use it to get the platform names as an include file for ACME. It does not read the memory of a running program, and it does not change the project knowledge.
---

# C64 memory map

Use this script to get the C64 platform meaning of an address or of a register value.
Use only the commands of the script. Do not look up C64 platform addresses in another way.

```bash
node <skill>/scripts/memory-map.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `at '$d020'`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Find what one or more addresses mean | `at '$d020' '$0314' '$ffd2'` |
| Find the address of a platform name | `at SCROLY CHROUT` |
| Decode the memory configuration | `decode '$01' '$35'` |
| Decode the screen and character addresses of the VIC-II | `decode '$d018' '$15' --bank '$97'` |
| Read all registers of a chip | `list vic` |
| Read the KERNAL jump table | `list kernal` |
| Write the platform names as an ACME include file | `export --out src/hw.asm` |

## Addresses, registers and values

- `<address>` is an address from the code or from the question. It can also be a platform name, for example `SCROLY` or `CHROUT`, in upper or lower case. The commands `list` and `export` show the platform names. A platform name comes before a name of the project knowledge.
- `<register>` is the address or the platform name of a register that has a decoder. The decoders are for `$01`, `$D010`, `$D011`, `$D015` to `$D01F`, `$D016`, `$D018`, `$DC0D`, `$DD00` and `$DD0D`.
- `<value>` is the value of the register, from 0 to 255. Write it as `$` and hex digits, as a decimal number, or as `%` and binary digits. Put a `$` value in single quotes in a shell.
- `<list>` is one of `vic`, `sid`, `cia1`, `cia2`, `kernal` and `system`.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
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

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--bank <value>` | `decode` | The value of `$DD00`. With it, a `$D018` value gives addresses, not only offsets in the VIC-II bank. Only for `$D018`. No default. |
| `--max-listed <n>` | `list` | The maximum number of entries in `listed`. The default is 50. |
| `--out <file>` | `export` | The include file to write, relative to the project folder. Required. |

---

## Look up an address

### `at <address>...`

`body.addresses` holds one item for each address:

- `kind`: `platform` or `application`.
  - `platform`: the C64 gives the address a meaning. Read `name` and `meaning`.
  - `application`: the address has no platform meaning. The program decides its use. This is not a failure.
- `area`: the memory area of the address, for example `VIC-II registers`, `color RAM` or `free RAM`.
- `mirrorOf`: for an I/O register, the register that this mirror address repeats.
- `entryStart`: the first address of the entry, for a byte in an entry of more than one byte. An example is the high byte of a vector.
- `visible`: for an address from `$D000` to `$DFFF`. The address is visible only when `$01` shows I/O at `$D000`. This area holds the chip registers, the color RAM and the cartridge I/O areas.

When an address has the kind `application`, `hint` names it. Find its use in the disassembly or in the emulator.

Do not record platform facts in the project knowledge. A conclusion about the application can go into the project knowledge. An example is "the program writes the address of its IRQ handler to `$0314`".

Failure:

- `invalid-input` with "is not a C64 platform name": the name is not a platform name and not a name in the project knowledge. Give a `$` address, a platform name, or a symbol of the project knowledge.
- `invalid-input` with "must be $ and 1 to 4 hex digits": the address is not correct. A decimal number is not an address.

### `decode <register> <value>`

`body` holds `register`, `value`, `name`, and the meaning of each bit field of the value. Examples:

- `$01`: what the CPU sees at `$A000`, `$D000` and `$E000`.
- `$D018`: the offsets of the screen, the characters and the bitmap in the VIC-II bank. With `--bank`, also `bank` and the addresses `screen`, `characters` and `bitmap`.
- `$DD00`: the VIC-II bank and its addresses.

Some registers have a different meaning for a read and for a write, for example `$DC0D`. Then the body gives both.

For `$D018` without `--bank`, `hint` tells you to give `--bank` with the value of `$DD00`. Get that value from the code or from the emulator.

Failure:

- `invalid-input` with "There is no decoder": the register has no decoder. Use `at` for its meaning.
- `invalid-input` with "--bank works only with $d018": remove `--bank`.

### `list <list>`

`body.entries` is a list of the entries of the group: `count`, `listed` and `rest`. Each item has `start`, `end` for an entry of more than one byte, `name` and `meaning`.

When the list is cut, `hint` gives the full count, and `nextAction` runs `list` again with a `--max-listed` that holds all entries.

### `export`

Writes all platform names to the project file at `--out`, as an ACME include file. Each line gives one name and its meaning as a comment. A zero-page name is `NAME = $xx`. Another name is `NAME = $xxxx`.

`body` holds `names` (the number of names) and the file as `out`, `bytes` and `sha256`.

Include the file with `!source` in source that you write by hand.

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

