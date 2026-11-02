---
name: c64-assembler
description: Assembles C64 6510 source code with the ACME assembler and writes the program (PRG) into the project. It gives the source errors with their file and line, and the symbols with their addresses or values. Use it to build a rebuilt program or a new program. Use it to check that a rebuild is identical to the program in the project knowledge or to the file of a release. It does not run the program, and it does not change the project knowledge.
---

# C64 assembler

Use this script to assemble C64 source code with ACME and to write the program into the project.
Use only the commands of the script. Do not assemble the source in another way.

```bash
node <skill>/scripts/assembler.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `build src main.a --out build/game.prg`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Build the program from the source | `build src main.a --out build/game.prg` |
| Build a source that includes files from a folder | `build src main.a --out build/game.prg --include lib` |
| Build a source that includes a file that you generated into a folder next to the source root | `build src boot.asm --out build/boot.prg --include ../build` |
| Build a source that sets no start address | `build src main.a --out build/game.prg --set-pc '$0801'` |
| Build a generated source with the values of `config.asm` | `build src main.asm` |
| Build a generated source with other switch values, and its loader program | `build src main.asm --switch TRAINER=1` |
| Check that the rebuild is identical to the program in the project knowledge | `build src main.asm --compare` |
| Build a release and check it against the bytes of that release | `build src main.asm --release FIRESTAR --compare` |
| Check the rebuild of a program in another space, for example the drive | `build src main.asm --out build/drive.prg --compare --space drive8` |
| List all symbols, also the constants that the source does not use | `build src main.a --out build/game.prg --all-symbols --max-listed 500` |
| Write only the bytes of the program, without the load address | `build src main.a --out build/game.bin --plain` |

---

## The source and the program

- `<source-root>` is the folder in the project that holds the source files of the program. The script reads only the files in the source root and in the include folders.
- An include folder is a path relative to the source root, inside the project folder. It can be outside the source root, for example `--include ../build`.
- `<entry>` is the main source file, relative to the source root. It normally sets its start address, for example `* = $0801`. If it does not, give `--set-pc`.
- For a source that you generated from the project knowledge, the source root is the folder of that source. The entry is `main.asm`.
- `--out` is the path of the program, relative to the project folder. Without `--out`, the script writes `build/<name>.prg`. See "Build names".
- The script also writes the symbols file of the program. `symbolsFile.out` gives its path. Give this file to a test run as the symbols of the rebuild.
- Get the label of a release from the releases in the project knowledge. Record a release in the project knowledge before you build it.
- Before you use `--compare`, put the program bytes into the project knowledge.
- The target CPU is the 6510. The program is a C64 PRG, or the bytes only with `--plain`.

### Switches

A source that you generated from the project knowledge has switches in `config.asm`.

- Without `--release`, the build uses the values in `config.asm`. With the default values, the program is the clean program: no copy protection, no trainers, no cheats, no crack changes, no leftovers, and all corrections. This program can be different from the base release. Thus `--compare` can give `FAIL`.
- The default build leaves out the leftovers, because `LEFTOVERS` is 0. A leftover is a range that nothing uses, in a file in `leftovers/`. To build the leftovers, give `--switch LEFTOVERS=1`.
- To build other switch values, give `--switch` for each switch, for example `--switch TRAINER=1`. `config.asm` does not change. Do not use `--define` for a switch.
- With `--switch` and the entry `main.asm`, a source with `loader.asm` also gives its loader program with these switch values. See "Build".
- With `--release <label>`, each switch has the value of that release. A release build does not read `config.asm`.

### Build names

Without `--out`, the name of the program tells what the build is:

| Build | Name |
|---|---|
| `--release <label>` | `release_<label>.prg`, for example `release_FIRESTAR.prg` |
| Each switch value is its default | `clean.prg` |
| A switch value is not its default | `custom_<switches>.prg`, for example `custom_trainer.prg`. A switch that is off has `no_` before its name, for example `custom_no_start_screen.prg`. |
| A source without `config.asm` | the name of the entry, for example `main.prg` |

An entry other than `main.asm` adds its name. With `--plain`, the extension is `.bin`. Do not give `--out` for a build of a generated source. Then the name always tells the build.

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
| `--out <file.prg>` | `build` | The path of the program, relative to the project folder. The default is `build/<name>.prg`. See "Build names". |
| `--include <folder>` | `build` | An include folder: a path relative to the source root, inside the project folder. Give the flag again for each folder. The default is no include folder. |
| `--define NAME=VALUE` | `build` | An assembler symbol: an integer, also `$` and hex digits, or `true` or `false`. Give the flag again for each symbol. Do not use it for a switch. |
| `--switch NAME=VALUE` | `build` | A switch of `config.asm` with the value 0 or 1 for this build. Give the flag again for each switch. `config.asm` does not change. The script refuses it with `--release`. |
| `--set-pc <address>` | `build` | The start address when the source does not set one, for example `'$0801'`. |
| `--release <label>` | `build` | Build a release of the project knowledge. Each switch gets the value of that release. With `--compare`, the reference is the bytes of the release in the project knowledge. |
| `--compare` | `build` | Compare the program byte by byte with the program in the project knowledge, or with the file of `--release`, segment by segment. Off by default. |
| `--space <space>` | `build` | The space of the program in the project knowledge: `c64`, `drive8`, `loading`, or `bank0` to `bank255`. The default is `c64`. Give it only with `--compare` or `--release`. |
| `--plain` | `build` | Write only the bytes of the program, without the 2-byte load address. Off by default. |
| `--all-symbols` | `build` | List also the constants that the source does not use. Off by default. |
| `--max-listed <n>` | `build` | List at most `n` symbols. The default is 50. `symbols.count` always gives the count of all symbols. |

---

## Build

### `build <source-root> <entry>`

Assembles the source and writes the program to `--out`, or to `build/<name>.prg`. It also writes the symbols file, which `symbolsFile` gives. Without `--all-symbols`, that file does not have the constants that the source does not use.

`body` holds:

- `result`: `PASS` or `FAIL`.
- `assembled`: `false` when the source has errors.
- `out`, `bytes` and `sha256`: the program file.
- `plain`: `true` with `--plain`.
- `loadRange`: `start`, `end` and `bytes` of the program in C64 memory. With `--plain`, `loadRange` tells where the bytes go.
- `symbols`: `count`, `listed` and `rest`. Each item has `name`, `kind` and `used`:
  - Kind `address` has a value in `loadRange`. It gives `address`.
  - Kind `constant` has a value outside `loadRange`. It gives `value` as `$` and four or more hex digits. A label in a `!pseudopc` block can be a constant, because its value is the run address, not the load address.
  - `used` is `false` when the source does not use the symbol.
- `symbolsFile`: the symbols file, with `out`, `bytes` and `sha256`.
- `unusedConstants`: the count of the constants that the list does not include. It is not in the body with `--all-symbols`.
- `diagnostics`: each item has `severity` (`error`, `warning` or `note`), `file`, `line` and `message`. `file` is relative to the source root. A file in an include folder outside the source root starts with `../`. `file` and `line` are not in an item without a location in the source.
- `compare`: only with `--compare`. `identical` is `true` when each segment is identical. `segments` has one item for each segment of the reference program, with `start`, `end` and `result`:
  - `identical`.
  - `different`, with `differences` and `firstDifference`. `firstDifference` gives `address`, and the byte of the build (`built`) and of the reference (`reference`), each as `$` and two hex digits. It is the first different byte outside the leftovers that the build leaves out. When all different bytes are in these leftovers, the segment has no `firstDifference`.
  - `not covered`, with `uncovered`: the build does not hold all bytes of the segment.
- A segment in `compare.segments` can also have `leftovers`. These are the leftovers that the build leaves out, where a byte is different or not in the build. Each item has `start`, `end`, `file` (the leftover file, relative to the source root) and `differences`. `differences` and `uncovered` of the segment also count these bytes.
- `loader`: only with `--switch`, the entry `main.asm` and a `loader.asm` in the source root. It is the loader program of these switch values, with `out`, `bytes` and `sha256`. `symbolsFile` is its symbols file. `packed` gives `packedBytes` and `unpackedBytes` of the packed form. `verified` is always `false`, because no check of the loader program runs. When the script cannot make the loader program, `loader` holds only `written`, which is `false`, and `reason`.

Do as the result tells:

- `result` is `PASS`: the program is at `out`. To run or debug the program, load the file at `out` into the emulator. A generated source with a loader is different: the build of `main.asm` does not set the entry state, and it can hold bytes for $d000-$dfff. Load the loader program in its place: `loader.program` of the generation of the source with the loader, or `loader.out` of a build with `--switch`. Test the loader program of `loader.out` before you trust it.
- `result` is `FAIL` and `assembled` is `false`: the source has errors, and the script wrote no program. `hint` tells you to correct the source. Correct the source at the file and the line of each diagnostic. Then run `build` again.
- `result` is `FAIL` and `assembled` is `true`: the program is not identical to the reference. The script wrote the program. Read the first difference of each segment in `compare.segments`. Without `--release`, read the section "Switches" first.
- A segment has `leftovers`: these bytes are different because the build leaves out the leftovers. They are not an error in the source. `hint` tells when all other bytes are identical. To build the leftovers, give `--switch LEFTOVERS=1`.
- `hint` tells that `symbols` is cut: give a larger `--max-listed`, or read the symbols file for the full list.
- `loader.written` is `false`: the script wrote the program of `main.asm`, but it cannot make the loader program of these switch values. Do as `loader.reason` tells.
- Error `not-found` names the entry: give the main source file relative to the source root.
- Error `not-found` names an include folder: give `--include` a folder with files, relative to the source root.
- Error `invalid-input` names an include folder: the folder is outside the project folder. Give `--include` a folder inside the project folder.
- Error `not-found` names a release: the project knowledge has no release with that label. Record the release in the project knowledge, or give the label of a recorded release.
- Error `not-found` tells that the knowledge has no program: put the program bytes into the project knowledge. Then use `--compare` again.
- Error `invalid-input` names a switch: give `--switch` a switch of `config.asm`, with the value 0 or 1.
- Error `invalid-input`: an option or a path is wrong. Do as `hint` tells. The script refuses `--space` without `--compare` or `--release`.

The script does not keep the diagnostics or the program in the project knowledge.

To compare runs of the rebuild with runs of the reference, give the symbols file to the test run as the symbols of the rebuild. A symbol of the rebuild gives the address of a routine in the rebuild.

---

## Workflow

1. Find the source root and the entry.
2. Run `build`.
3. If `assembled` is `false`, correct the source. Then do step 2 again.
4. For a rebuild, run `build` with `--compare`. For a release, also give `--release <label>`.
5. Run or debug the program at `out` in the emulator.

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
