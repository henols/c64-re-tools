---
name: spectrum-assembler
description: Assembles ZX Spectrum Z80 source code with sjasmplus and writes the bytes of the program into the project. It gives the source errors with their file and line, and the symbols with their addresses or values. With --compare, it checks each byte of the build against the program in the project knowledge. Use it to build a rebuild of a ZX Spectrum program or a change to it. It does not assemble C64 source, it does not run the program, and it does not change the project knowledge.
---

# ZX Spectrum assembler

Use this script to assemble ZX Spectrum Z80 source code with sjasmplus and to write the program into the project.
Use only the commands of the script. Do not assemble the source in another way.

```bash
node <skill>/scripts/assembler.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `build src main.asm --out build/game.bin`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Build the program from the source | `build src main.asm --out build/game.bin` |
| Check that the rebuild is identical to the program in the project knowledge | `build src main.asm --out build/game.bin --compare` |
| Build a source that includes files from a folder | `build src main.asm --out build/game.bin --include lib` |
| Build a source with an assembler symbol | `build src main.asm --out build/game.bin --define LIVES=5` |
| Build for the 128K | `build src main.asm --out build/game.bin --model 128k` |
| Write all symbols to a file for a test run | `build src main.asm --out build/game.bin --out-symbols build/game.json` |
| List more symbols in the result | `build src main.asm --out build/game.bin --max-listed 500` |

---

## The source and the program

- `<source-root>` is the folder in the project that holds the source files of the program.
- `<entry>` is the main source file, relative to the source root.
- An include folder is a path relative to the source root.
- The source sets its addresses with `ORG`.
- The source must not have `DEVICE`. The build sets the device of the model. The script refuses a `DEVICE` line: `assembled` is `false`, and a diagnostic gives the file and the line. Remove the line, and give `--model` for the 128K.
- The target CPU is the Z80. Do not give C64 source to this script.
- `--out` is the path of the program file, relative to the project folder. The file holds the bytes from the first address to the last address that the build fills. A gap between two `ORG` areas holds zeros. The file has no header.
- Before you use `--compare`, put the program bytes into the project knowledge.
- A snapshot gives the project knowledge all of the RAM. A source usually fills only its code and its data. Thus the build usually does not fill each byte of the program in the knowledge.

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

---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--out <file.bin>` | `build` | The path of the program file, relative to the project folder. Required. |
| `--include <dir>` | `build` | An include folder, relative to the source root. Give the flag again for each folder. The default is no include folder. |
| `--define NAME=VALUE` | `build` | An assembler symbol: an integer in decimal, or `$` and hex digits, or `true` or `false`. Give the flag again for each symbol. |
| `--model <model>` | `build` | The device of the build: `48k` or `128k`. The default is the model of the project machine. Without a project machine, the default is `48k`. |
| `--compare` | `build` | Compare the bytes of the build with the program in the project knowledge, segment by segment. Off by default. |
| `--max-listed <n>` | `build` | List at most `n` symbols. The default is 50. `symbols.count` always gives the count of all symbols. |
| `--out-symbols <file.json>` | `build` | Write all symbols to this project file as `{"symbols": [...]}`. Give this file to a test run as the symbols of the rebuild. |

---

## Build

### `build <source-root> <entry>`

Assembles the source and writes the bytes of the program to `--out`.

`body` holds:

- `result`: `PASS` or `FAIL`.
- `assembled`: `false` when the source has errors.
- `model`: the model of the build, `48k` or `128k`.
- `out` and `sha256`: the program file.
- `bytes`: the count of the bytes that the build fills. This count does not include the zeros in a gap. Thus it is not always the size of the program file.
- `range`: `start` and `end`, the first address and the last address that the build fills.
- `segments`: each item has `start` and `end`. Each segment is an area of addresses that the build fills.
- `symbols`: `count`, `listed` and `rest`. Each item has `name`, `kind` and `used`:
  - Kind `address` has a value in a segment. It gives `address`.
  - Kind `constant` has a value outside the segments. It gives `value` as `$` and four or more hex digits.
- `symbolsFile`: only with `--out-symbols`. The symbols file, with `out`, `bytes` and `sha256`.
- `diagnostics`: each item has `severity` (`error` or `warning`), `file`, `line` and `message`. `file` is relative to the source root. `file` and `line` are not in an item without a location in the source.
- `compare`: only with `--compare`. It holds `matches`, `identical` and `segments`:
  - `matches` is `true` when each byte that the build fills is the byte of the knowledge.
  - `identical` is `true` only when the build also fills each byte of the program in the knowledge.
  - `segments` has one item for each segment of the program in the knowledge, with `start`, `end` and `result`.
  - Result `identical`: the build fills each byte of the segment, and each byte is the byte of the knowledge.
  - Result `different`, with `differences` and `firstDifference`. `firstDifference` gives `address`, and the byte of the build (`built`) and of the knowledge (`reference`), each as `$` and two hex digits. The item can also have `uncovered`.
  - Result `not covered`, with `uncovered`: the count of the bytes of the segment that the build does not fill. Examples are the screen and the system variables.

Do as the result tells:

- `result` is `PASS`: the program is at `out`. To run or debug the program, load the file at `out` into the emulator.
- `result` is `PASS` with `--compare`: each byte that the build fills is the byte of the knowledge. `hint` tells when the build does not fill all bytes of the program. Then read `uncovered` in `compare.segments`.
- `result` is `FAIL` and `assembled` is `false`: the source has errors, and the script wrote no file. `hint` tells you to correct the source. Correct the source at the file and the line of each diagnostic. Then run `build` again.
- `result` is `FAIL` and `assembled` is `true`: a byte of the build is not the byte of the knowledge. The script wrote the program file. Read `firstDifference` of each segment in `compare.segments`.
- `hint` tells that `symbols` is cut: give a larger `--max-listed`, or give `--out-symbols <file.json>` for the full list.
- Error `installation-incomplete`: sjasmplus is not on this machine. Do not use another assembler.
- Error `not-found` names the source root, the entry or an include folder. Give the main source file relative to the source root. Give `--include` a folder with files, relative to the source root.
- Error `not-found` tells that the knowledge has no program: put the program bytes into the project knowledge. Then use `--compare` again.
- Error `invalid-input`: the source gives no bytes, or a path or a define is not correct. Give the source `ORG` and code or data. Do as `hint` tells.

The script does not keep the diagnostics or the program in the project knowledge.

To compare runs of the rebuild with runs of the original, give the file of `--out-symbols` to the test run as the symbols of the rebuild.

---

## Workflow

1. Put the program bytes into the project knowledge.
2. Find the source root and the entry.
3. Run `build` with `--compare`.
4. If `assembled` is `false`, correct the source. Then do step 3 again.
5. If `result` is `FAIL`, correct the source at the first difference of each segment. Then do step 3 again.
6. Run or debug the program at `out` in the emulator.

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
