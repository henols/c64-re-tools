---
name: c64-source
description: Generates ACME source code for a C64 program from the project knowledge. It checks that the source assembles to the same bytes as the program. It can also write a loader that sets the entry state of an unpacked program. It can also export the program as the start of a new program. The export is a new project with one value for each switch and without unused code. Use it to make a rebuild of a program. Use it when the source must show new names, comments, regions, modules, macros or patches of the knowledge. Use it when the user asks to "export the project", "start a new game from this rebuild" or "make a clean package of the code". It does not change the project knowledge. It does not build or test the program.
---

# Generate source

Use this script to generate ACME source from the project knowledge, and to export the program as the start of a new program.
Use only the commands of the script. Do not write or edit the generated source in another way.

```bash
node <skill>/scripts/source.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `generate --out src`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Generate the source and check it | `generate --out src` |
| Generate the source with one more entry point of code | `generate --out src --entry '$080d'` |
| Generate the source of drive code or of a cartridge bank | `generate --out src --space drive8` |
| Generate the source and a loader that sets the entry state | `generate --out src --loader` |
| Use analyzer names for addresses that have no other name | `generate --out src --analyzer-names` |
| Export the program as the start of a new program | `export --to ../game-new` |
| Export the program, and make a range free | `export --to ../game-new --name game --drop '$081b-$0822'` |
| Export the program, and keep a range that nothing uses | `export --to ../game-new --keep '$2000-$20ff'` |

---

## The program and the folders

- The program comes from the project knowledge. The entry, the entry state, the coverage, the names and the other facts also come from it. Put the program bytes into the project knowledge before the first command.
- For a packed program, capture the unpacked program at its entry point first. Then put the capture into the project knowledge.
- For the loader, the knowledge must have the entry and the entry state of a capture.
- `--out` is the folder for the source, relative to the project folder, for example `src`.
- `--entry` is an address where code starts. Give it only when the knowledge does not show the code. The entry of the program, the routines and the code regions of the knowledge are entry points already.
- `--space` is the knowledge space of the program. Use the space where the program bytes are in the project knowledge.
- `--to` is the folder of the new project. Use a new or empty folder beside the project, for example `../game-new`. No project can hold it.
- `--drop` is a range that becomes free. Get the range of executed code from `unreachableExecuted[].drop` of an earlier export. You can also give a data range.
- `--keep` is a range that must stay, also when nothing uses it.

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
| `--out <dir>` | `generate` | The folder for the source files. It is necessary. The script writes over the files of an earlier run. It removes a generated `.asm` file that this run does not write, also in a folder of `--out`. A folder with a generated `main.asm` is the source of another space, and it stays. A run without `--loader` keeps `loader.asm`, the loader program, `start_screen.asm` and `start_screen_stage.asm` of an earlier run. `staleLoader` tells when they are of another knowledge revision. |
| `--entry <address>` | `generate` | An address where code starts. Give the flag again for more addresses. There is no default. |
| `--space <space>` | `generate` | The knowledge space: `c64`, `drive8`, `loading`, or `bank0` to `bank255`. The default is `c64`. `--loader` and the platform names apply only to `c64`. The coverage is the coverage of the space. |
| `--loader` | `generate` | Also write `loader.asm` and the loader program, and `start_screen.asm` when the knowledge has a start screen. A start screen of a captured stage also gives `start_screen_stage.asm`. The script writes the loader program only after the check of the new loader ran. Else the loader program of an earlier run stays. It needs a capture in the knowledge. The default is no loader. |
| `--analyzer-names` | `generate` | Name an address without a name of the user or the LLM, and without a platform name, with its analyzer name, for example `FUN_17e2`. Without the flag, the source makes its own name, for example `l_17e2`. |
| `--to <folder>` | `export` | The folder of the new project. It is necessary. The script also writes `<folder>.zip` beside the folder. |
| `--name <name>` | `export` | The name of `baseline/<name>.prg` and `build/<name>.prg`. The default is the name of the folder. |
| `--keep <start>-<end>` | `export` | A range that stays, also when nothing uses it. Give the flag again for more ranges. |
| `--drop <start>-<end>` | `export` | A range that becomes free. Give the flag again for more ranges. Code that stays must not go to the range or read it. |
| `--max-listed <n>` | `generate`, `export` | List at most `n` items in each list. The default is 50. The counts are always in the body. |

---

## Generate the source

### `generate --out <dir>`

The command writes the source files in `--out`. Then it checks them.
The folder `--out` gets only source files. The same knowledge always gives the same source.
Do not edit the generated files. The next run writes over them. The values in `config.asm` are the one exception.
To make the source better, change the project knowledge. Then generate again.
`<skill>/references/source-format.md` gives the files, the names and the lines of the source.

`body` holds these fields:

- `result`: `PASS` when every check passes, else `FAIL`.
- `files`: the files that the command wrote, each with `out`, `bytes` and `sha256`.
- `removed`: the files of an earlier run that the script removed.
- `instructions`, `dataBytes` and `undecodedBytes`.
- `labels`: `named` labels from the knowledge, and `generated` labels `l_xxxx`.
- `check`: `identical`, and the result for each segment of the build of the base release. A segment that is different gives its first different address.
- `config.notDefault`: each switch in `config.asm` with a value that is not its default, with its `value` and its `default`.
- `romNamesLeftOut`: the ROMs that the source does not name, and the evidence in `from`.
- `entryOutside`: the entry is in no segment of the program, with a `reason`.
- `dataOnly`: the knowledge has no entry, no routine, no code region and no executed address in the space.
- `entriesInData`: each `--entry` in a data region, with the `region` and its `origin`.
- `asBytes`: the instructions that the source has as bytes.
- `notExecuted`: with coverage, the count of instructions that no run executed, and their ranges. Each range has its source `file` and the `routine` before it.
- `unusedModules`: modules whose start is in no segment of the program. Often the program does not hold the code that the knowledge describes.
- `leftovers`: the bytes that nothing uses, with `bytes` and each range with its `file`. See "The leftovers". `noCoverage` tells that the knowledge has no coverage, so no range is a leftover. `changed` gives the ranges that are `added` to the leftovers and `removed` from them since the earlier run in `--out`.
- `unknownCode`: code that nothing reaches and that no run executed, which is not a leftover. A flow in `unresolved` can go to it: a JMP through a vector that a run wrote, or a jump whose address a run wrote. Each flow has `at` and `kind`. The default build and the loader keep this code. Find the targets of each flow in the emulator. Record a jump reference from the flow to each target in the project knowledge. When the flow goes outside the program, for example a crash through the I/O area, record the reference to that address. Then generate again.
- `operandExpressions`: the count of instructions with an operand expression.
- `operandsAsNumbers`: each operand expression that the source has as a number, with its `address`, `expression` and `reason`.
- `macroUses`: the count of macro uses in the source.
- `macrosAsInstructions`: each macro use that the source has as instructions, with its `start`, `end`, `macro` and `reason`.
- `patchesNotWritten`: each patch that the source does not have, with its range, `switch` and `reason`.
- `switches`, `default`, `releases`: the checks of the switches. See "Switches and releases".
- `loader`: the loader program and its check. `<skill>/references/loader.md` gives its fields and the action for each result.
- `staleLoader`: a run without `--loader` kept `loader.asm` and the loader program of another knowledge revision, or of another version of the toolkit. `files` gives the files. `revision` gives the revision of `loader.asm`, and `version` its toolkit version. Without `revision`, `loader.asm` does not give one. `noEntryState: true` tells that the knowledge has no entry state for a new loader. A change in a space that the loader does not hold does not make the loader stale. The loader holds space `c64` and the space of the stage of the start screen.
- `staleReference`: each reference folder of the project that has pages of this source from an earlier knowledge revision. Each item has the `folder` and the `revision` of its pages.

`result` is `FAIL` for each of these:

- The source does not assemble, or it does not assemble to the program.
- The entry is in no segment of the program.
- A patch is in `patchesNotWritten`.
- A switch or the default build does not fit.
- A release does not give its bytes.
- The loader is not verified.

`hint` gives the action for each finding. When a change of the project knowledge corrects a finding, `nextAction` is the same `generate` command. Run it after the change. A `PASS` without findings gives a `hint` and no `nextAction`.

Do these actions for the findings:

| Finding | Action |
|---|---|
| `check.diagnostics` | ACME does not assemble the source. A name in the knowledge can be wrong for ACME. Read the diagnostics. Rename the symbol in the project knowledge. |
| `check.identical: false` without diagnostics | This is a defect of the script. Give the result to the user. |
| `operandsAsNumbers` | Read each `reason`. Record the operand expression again, or remove it, in the project knowledge. |
| `macrosAsInstructions` | Read each `reason`. Correct the macro or the args in the project knowledge, or remove the use. The source stays identical, so this is not a failure. |
| `patchesNotWritten` | Read each `reason`. Move the start or the end of the patch to an instruction, or give the switch another name. If the switch is not in the knowledge, record the switch. |
| `entryOutside` | Capture the program again, so that a segment holds the entry. Put the capture into the project knowledge. The script still writes and checks the source. |
| `dataOnly` | This is not a failure. If the space has code, give `--entry`, or record a code region in the project knowledge. |
| `entriesInData` | An analyzer region of data hides the code at the entry. If the entry is code, record a code region at the entry in the project knowledge. A region of the user or the LLM replaces the analyzer region. |
| `invalid-input` that names a symbol or a module | Change that symbol or module in the project knowledge. |
| `conflict` | The knowledge has conflicts from a git merge. Merge the open changes of the project knowledge. Then run the command again. |
| A list with `rest` | Give a larger `--max-listed`. |
| `loader.verified: false` | Do the action of `<skill>/references/loader.md` for the `reason`. |
| `staleLoader` | The loader can copy bytes that are not the bytes of the source. Run `nextAction`, which generates with `--loader`. With `noEntryState: true`, remove the files when the build does not use them. |
| `staleReference` | The reference pages do not agree with the new source. When you do not change the knowledge again, generate the reference pages again from this source into each `folder`. |

#### The leftovers

A leftover is a range of the program that nothing uses: unused code, old copies and old data. The start screen, the patches and the addresses that the code of a patch names are never leftovers. A macro use in code that nothing uses is in the leftover with that code. A leftover never cuts a macro use in two.

- Each range of leftovers is a file `leftovers/leftover_xxxx.asm`. When a range cuts a module, the module continues after the range in `<module>_xxxx.asm`, in the folder of the module. The module in the knowledge does not change.
- `main.asm` builds a leftover file only when `LEFTOVERS` is 1. When it is 0, the build skips the bytes. Thus the addresses after the range do not change.
- `config.asm` has `LEFTOVERS = 0`. Thus the default build is the clean program, without the leftovers.
- Each release has `LEFTOVERS = 1`. Thus the build of a release gives the bytes of the release.
- The loader program never has the leftovers. The memory of a leftover range does not hold the bytes of the program.
- Without coverage, no range is a leftover. Put the coverage of the runs into the project knowledge. Then generate again.
- When `leftovers.changed` has ranges, the default build and the loader program now leave out other bytes. A test that observes the `added` bytes on the loader program gets other values there. Fill the `added` ranges in the test of the leftovers. In a test that compares them, exclude them with the reason that they are leftovers.
- A leftover can be wrong when the coverage does not show a use. For example, the VIC-II reads a range, or the program reads a range before it writes it. Then a test of the loader program fails. Record the region in the project knowledge, or put the coverage of more runs into it. Do not change the source.

#### Switches and releases

The program of the knowledge is the base release. The default build is the clean program: no copy protection, no trainer, no cheat, no crack change, and all corrections. Thus the default build can be different from the program.

The command does these checks. They use the defaults and the values of the knowledge, not the values in `config.asm`.

1. `check`: the build of the base release must give the program byte by byte. In this build, each switch has its base value, and `LEFTOVERS` is 1.
2. `switches`: each switch alone at its other value. The build must have the same length as the base release. It can change bytes only in the patches of the switch.
3. `default`: the default build. It must have the same length. It can change bytes only in the patches of the switches in `default.in` and in the leftovers.
4. `releases`: each release, built with `RELEASE_<label>=1`, against the bytes of the release in the project knowledge.

Each item of `switches` has `name`, `kind`, `default`, `base`, `define` and the patches.

- `result: fits` tells that the build is good. `changedBytes` counts the changed bytes.
- `overflow`: the code of a patch is longer than its range. Make the code shorter, or make the range larger, in the project knowledge.
- `changes outside`: the build changed a byte outside the ranges. The result gives the first such byte.
- `does not assemble`: read the ACME diagnostics. Correct the code of the patch.
- `insideNames` lists the labels inside a patch. Code that writes to one of these labels changes the patch when the switch is on.

`default` has `in`, `result` and `changedBytes`, as in `switches`. When `default` has `overflow` and the message `turn on one of them`, two alternatives are in the default build. Give one of the switches the default of the base release.

Each item of `releases` has `label`, `base`, `define` and `result`. The check compares the build with each segment of the release.

- `identical`: the build gives the bytes of each segment of the release.
- `different`: the release has bytes that no patch gives. Compare the release with the program. Then record a switch and a patch for each difference.
- `does not assemble`: read the ACME diagnostics.
- `notInRelease`: the ranges of the program that the release does not have. The check does not compare them.

Build the program from the source in these ways:

- The build of `config.asm`: no option. With the defaults, this is the default build, without the leftovers.
- A release: the build option `--release FIRESTAR`.
- Other switch values: the build option `--switch TRAINER=1`, one time for each switch. `config.asm` does not change. With a loader, this build also gives the loader program of these switch values. See "The loader of other switch values".

---

## Export a new program

### `export --to <folder>`

The command writes the program of the knowledge as the start of a new program: a new project folder and a zip file of it. A person changes the source of the new project directly.
First, make sure that `generate` gives `PASS`. The command writes nothing until all its checks pass.
`<skill>/references/export.md` gives the free ranges and the files of the new project.

The command sets each switch to its export value:

- `fix`, `trainer` and `cheat`: 1. Trainers and cheats become a part of the new program.
- `protection` and `crack`: 0.
- `change`: its default.

The build with these values can change bytes only in the patches. Then the command makes the free ranges. Each free range gets the bytes $00 and the label `free_xxxx`. No address moves.

`body` holds these fields:

- `result`: `PASS` when the script wrote the new project. `FAIL` with `stage` and `reason` when a check failed. Then the script wrote nothing.
- `to` and `zip`: the folder and the zip file.
- `files`: the files of the new project.
- `switches`: each switch with `kind`, `base` and the export `value`.
- `free`: the count of free bytes, and each free range with `bytes`, `what` and `label`.
- `unreachableExecuted`: each range of executed code that the entry does not get to, with the `routine` before it and its `drop` value.
- `unknownCode`: code that nothing reaches and that no run executed, which stays because a flow in `unresolved` can go to it. Record the targets of each flow as for `generate`. Then export again.
- `knowledge`: the counts of the rows of the new knowledge.
- `tests`: the `written` tests, and the `leftOut` tests with the reason.
- `loader`: the copies, the copier, `stackByte` and `simulated: true`. The export does not run the loader.
- `noCoverage` or `unrooted`: why nothing became free without `--drop`.
- `spacesLeftOut`: the spaces that the export does not have. The export has only the space `c64`.
- `startScreenLeftOut`: the start screen is of a captured stage. The export does not have it, because the export has only the space `c64`.

On `PASS`, `hint` tells you to build and test the new project as its `README.md` tells. When the knowledge has no coverage, or `unreachableExecuted` has items, `hint` also tells how to make more ranges free.
On `FAIL`, `hint` gives the action for the stage:

| `stage` | Action |
|---|---|
| `base` | The source of the knowledge does not pass. Run `generate`, and correct the project knowledge until `generate` gives `PASS`. Then export again. |
| `switches` | The build with the export values changes bytes outside the patches, or a patch does not fit. Read `build`. Run `generate`, and correct the patches. |
| `export` | This is a defect of the script. Give the result to the user. |
| `loader` | Read `reason`, and give it to the user. The export does not make the packed form of the loader. |

Each range of `unreachableExecuted` is code that a run executed and that the entry does not get to now. Find the code that calls the range in the project knowledge:

| Caller | Action |
|---|---|
| Only code that the export removed, for example a copy check | Drop the range. |
| Code that the knowledge does not show, for example a call through a pointer | Keep the range. |
| You are not sure | Ask the user. |

To drop a range, remove the folder and the zip file of the export. Then export again, and give `--drop` with each range. When a test of the new project gives `FAIL`, the export dropped a range that the program uses. Remove the folder and the zip file. Export again without that range in `--drop`.

Traps of the command:

- The command refuses a folder that is not empty, and a zip file that exists. Remove the folder and the zip file of an earlier export, or give another folder. Remove only the folder and the zip file that this task made.
- The command refuses two switches that change one range. The export puts both alternatives in. In the project knowledge, give all but one of them the kind `change`, with the default of the base release.
- The command refuses a `--drop` range that code which stays goes to or reads. The message names that code. It also refuses a range that cuts code or a region.

---

## Workflow

1. Put the program bytes into the project knowledge. For a packed program, capture the unpacked program at its entry point first.
2. Run `generate`.
3. Read `result` and `check`. `check.identical: true` tells that the build of the base release is the program byte by byte.
4. Read the source. A label `l_xxxx` is an address without a name in the knowledge.
5. Record names, comments, regions and modules in the project knowledge.
6. Run `generate` again. Do steps 4 to 6 again until the source is clear.
7. Assemble `main.asm` to a program. This is the default build. For a release, give the build option `--release <label>`.
8. For an unpacked program, run `generate --out <dir> --loader` at the end. Compare the loader program with the program of the base release in a test. The loader program is in `loader.program`, and its symbols file is in `loader.symbols`.
9. To start a new program from the rebuild, tell the user the export value of each switch. If the user wants another value, change the kind or the default of the switch in the project knowledge. Then run `export`, and build and test the new project as its `README.md` tells.
10. Give the user the folder and the zip file, the value of each switch, the free ranges, and each test with its result.

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

## Reference

- `<skill>/references/source-format.md`: the files of the source, the names in the source and the lines in the source.
- `<skill>/references/loader.md`: the loader program, the start screen and the loader of other switch values. It also gives the fields of `loader`, and the action when the loader is not verified.
- `<skill>/references/export.md`: the free ranges of an export and the files of the new project.
