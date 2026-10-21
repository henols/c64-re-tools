---
name: c64-source
description: Generates ACME source code for a C64 program from the project knowledge. It checks that the source assembles to the same bytes as the program. It can also write a loader that sets the entry state of an unpacked program. It can also export the program as the start of a new program. The export is a new project with one value for each switch and without unused code. Use it to make a rebuild of a program. Use it when the source must show new names, comments, regions, modules, macros or patches of the knowledge. Use it to start a new program from a rebuild. It does not change the project knowledge. It does not build or test the program.
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
| `--out <dir>` | `generate` | The folder for the source files. It is necessary. The script writes over the files of an earlier run. It removes a generated `.asm` file that this run does not write. A run without `--loader` keeps `loader.asm`, the loader program, `start_screen.asm` and `start_screen_stage.asm` of an earlier run. `staleLoader` tells when they are of another knowledge revision. |
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
The folder `--out` gets only source files. The command writes `source-map.json` and `not_executed.json` in `.c64-re-tools/local/generated/<dir>/`. Git ignores this folder.
The same knowledge always gives the same source.
Do not edit the generated files. The next run writes over them. The values in `config.asm` are the one exception.
To make the source better, change the project knowledge. Then generate again.

`body` holds these fields:

- `result`: `PASS` when every check passes, else `FAIL`.
- `files`: the files that the command wrote, each with `out`, `bytes` and `sha256`. `sourceMap` names `source-map.json`.
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
- `notExecuted`: with coverage, the count of instructions that no run executed, and their ranges. `rest` names `not_executed.json`, which has all the ranges. Each range there has its source `file` and the `routine` before it.
- `unusedModules`: modules whose start is in no segment of the program. Often the program does not hold the code that the knowledge describes.
- `leftovers`: the bytes that nothing uses, with `bytes` and each range with its `file`. See "The leftovers". `noCoverage` tells that the knowledge has no coverage, so no range is a leftover. `changed` gives the ranges that are `added` to the leftovers and `removed` from them since the earlier run in `--out`.
- `operandExpressions`: the count of instructions with an operand expression.
- `operandsAsNumbers`: each operand expression that the source has as a number, with its `address`, `expression` and `reason`.
- `macroUses`: the count of macro uses in the source.
- `macrosAsInstructions`: each macro use that the source has as instructions, with its `start`, `end`, `macro` and `reason`.
- `patchesNotWritten`: each patch that the source does not have, with its range, `switch` and `reason`.
- `switches`, `default`, `releases`: the checks of the switches. See "Switches and releases".
- `loader`: the check of the loader. See "The loader".
- `staleLoader`: a run without `--loader` kept `loader.asm` and the loader program of another knowledge revision. `files` gives the files. `revision` gives the revision of `loader.asm`. Without `revision`, `loader.asm` does not give one. `noEntryState: true` tells that the knowledge has no entry state for a new loader.

`result` is `FAIL` for each of these:

- The source does not assemble, or it does not assemble to the program.
- The entry is in no segment of the program.
- A patch is in `patchesNotWritten`.
- A switch or the default build does not fit.
- A release does not give its bytes. A release with `layout differs` does not give `FAIL`. But the base release must be `identical`.
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
| A list with `rest` | Give a larger `--max-listed`. For `notExecuted`, read the file in `rest`. |
| `staleLoader` | The loader can copy bytes that are not the bytes of the source. Run `nextAction`, which generates with `--loader`. With `noEntryState: true`, remove the files when the build does not use them. |

#### The source files

- `main.asm` sets the address of each segment. It includes the files in address order.
- Each module in the knowledge is one file. A module starts at its address. It stops at the next module or at the end of its segment. The file of a module can be in a folder, for example `music/driver.asm`. Without modules, each segment is one file, `segments/segment_xxxx.asm`.
- `constants.asm` holds the names of addresses outside the program, for example `EXTCOL = $d020`. It also holds the register names in the program, for example `RASTER = $d012`. The names are in groups by memory area, in address order. Drive code and banks have one group only.
- The side comment of a constant is the knowledge comment of the address. Without a comment, it is the platform meaning. When the knowledge name is not the platform name, the platform name comes first. For an I/O mirror without a meaning, the comment gives the register that the mirror repeats.
- After the side comment, `Used:` counts how the source uses the name. The kinds are `read`, `written`, `modified`, `called`, `jumped to`, `jumped through`, `branched to`, `pointer`, `address`, `table` and `macro argument`. `address` is an immediate operand expression. `table` is an entry in a table of addresses.
- `config.asm` holds the value of each switch, for example `PROTECTION = 0`. The switches are in groups by kind. The side comment gives the releases that have the switch on, the ranges of its patches and the comment of the switch.
- You can change a value in `config.asm` to 0 or 1. The next run keeps the values of the file. It adds a new switch with its default. It removes a switch that the knowledge does not have.
- When the knowledge has a start screen, `config.asm` also has `START_SCREEN = 1`. Set it to 0 to start the program at once. Then assemble `loader.asm` again.
- `start_screen.asm` is the code that shows the start screen and waits. It is the same for each program. `loader.asm` gives it the values of the start screen.
- `switches.asm` holds each release of the knowledge. `main.asm` and `loader.asm` include it first. The script writes it only when the knowledge has switches or releases, or when the source has leftovers. For each release, a block `!ifdef RELEASE_<label>` gives each switch the value of that release.
- `leftovers/leftover_xxxx.asm` holds a range of leftovers. See "The leftovers".
- `macros.asm` holds the macros of the knowledge. `main.asm` and `loader.asm` include it.

#### Names in the source

- A label or a constant gets the name of the address in the knowledge.
- Without a knowledge name, it gets the platform name, for example `EXTCOL` or `CHROUT`. A platform name wins over an analyzer name (`dxa`, `ghidra` or `heuristic`), for example `EXTCOL` over `ld020`. A `user` or `llm` name wins over a platform name.
- An address in the program without a name gets `l_xxxx`.
- A read or a write in the I/O area `$d000-$dfff` uses the register, also when the program has RAM there. For example, `lda $dd0e` is `lda CI2CRA` and `sta $d012` is `sta RASTER`. `constants.asm` has these names. An address without a platform name stays a number, for example `sta $d800,x`. The data label of the RAM stays at its data. A `user` or `llm` name of the address wins over the register.
- A platform name in an operand expression of the knowledge stays in the source. When the program has the address, `constants.asm` has the name, and the RAM there keeps its label.
- The source uses the names of a ROM only when the program uses that ROM. With coverage, the program uses a ROM when a run executed code of it. A read of ROM bytes as data does not count. Without coverage, `$01` of the entry state tells which ROMs are in.
- When the program uses no ROM, the zero page and pages 2 and 3 get no system names. An operand expression or a macro use with such a name gets that reason.

#### Lines in the source

- `sta $d011  ; $d011: yScroll 3, rows 25, displayEnabled` is a store of an immediate to a register with a known meaning. The side comment gives the decoded value. A side comment in the knowledge replaces it.
- Code regions, and the decoded instructions outside of data regions, become instructions.
- Data regions become data by their type: `!byte`, `!word`, `!pet`, `!scr`, `!fill`, tables of labels, and sprite bytes in binary.
- `lda+2 $0012` is an absolute operand below $0100. `+1` is a zero-page operand with a label.
- `sta NMINV+1` is an address inside a platform entry of more than one byte, for example the high byte of a vector.
- `lda room_colours+5` is an address inside a data region with a named start. The address has no name of its own.
- `name = * + 1` is a label inside an instruction, for example for code that changes its own operand.
- `lda #<irq_handler` and `lda bar_colours-1,x` are operand expressions of the knowledge. An expression in a non-immediate mode that starts with a bracket gets `0+` before it. ACME reads `(...)` as indirect.
- `; = <irq_handler` at the end of an instruction with a number: the source cannot use this operand expression. `operandsAsNumbers` gives the reason.
- `!byte` with an instruction as its comment: ACME writes this instruction with a different opcode. The bytes keep the source identical.
- `not decoded` marks bytes in a code region that the script did not decode.
- `; not executed $xxxx-$yyyy` starts code that no run of the coverage executed. The range is the same as in `not_executed.json`.
- `+inc16 ptr` is a use of a macro of the knowledge. The comments inside a use go to its side comment.
- `!zone patch_PROTECTION_100e` starts a patch. The condition is the switch state that the program does not have. It is `!if TRAINER` when the base release has the switch off. It is `!if PROTECTION = 0` when the base release has it on.
- A patch block has the code of the patch and NOP to the end of the range. `else` has the original code. The labels inside the range come before the zone as `name = * + n`.
- Alternatives are patches of two or more switches at one range. They follow as `} else { !if FIX_B {`. A line before them stops the build with `!error` when two of them are in.

#### The leftovers

A leftover is a range of the program that nothing uses: unused code, old copies and old data. The script finds the leftovers from the coverage, as the export finds its free ranges (see "The free ranges"). The start screen, the patches, the macro uses and the addresses that the code of a patch names are never leftovers.

- Each range of leftovers is a file `leftovers/leftover_xxxx.asm`. When a range cuts a module, the module continues after the range in `<module>_xxxx.asm`, in the folder of the module. The module in the knowledge does not change.
- `main.asm` builds a leftover file only when `LEFTOVERS` is 1. When it is 0, the build skips the bytes. Thus the addresses after the range do not change.
- `config.asm` has `LEFTOVERS = 0`. Thus the default build is the clean program, without the leftovers.
- Each release has `LEFTOVERS = 1`. Thus the build of a release gives the bytes of the release.
- The loader program never has the leftovers. The loader does not copy them, and the memory there keeps the bytes that were in it before.
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

Each item of `releases` has `label`, `base`, `define` and `result`:

- `identical`: the build gives the bytes of the release.
- `different`: the release has bytes that no patch gives. Compare the release with the program. Then record a switch and a patch for each difference.
- `layout differs`: the release has other segments than the program. Patches cannot move code. This result does not fail the run.
- `does not assemble`: read the ACME diagnostics.

The script writes a patch only when its range is complete items of one file. A patch cannot cut an instruction. Its switch name cannot be a name of the source.
The script writes a macro use only when the use gives the bytes of the program. A label inside the range of a use also keeps the instructions. The macro line has no place for the label.

Build the program from the source in these ways:

- The build of `config.asm`: no option. With the defaults, this is the default build, without the leftovers.
- A release: the build option `--release ORIGINAL`.
- One switch: set its value in `config.asm`, for example `TRAINER = 1`. Do not define a switch on the command line of the build. ACME stops with `Symbol already defined`, because `config.asm` also sets the switch.

#### The loader

`--loader` writes `loader.asm` in `--out`. It assembles `loader.asm` to the loader program in `build/`. Git ignores `build/`. The name of the loader program tells its build:

- `clean_loader.prg`: each value of `config.asm` is its default. This is the clean program.
- `custom_<switches>_loader.prg`: the names of the switches that are not at their default. A switch that is off has `no_` before its name, for example `custom_no_start_screen_loader.prg`.

The symbols of the loader program are in `build/symbols/<name>.json`, for example `build/symbols/clean_loader.json`. They hold the labels of `loader.asm`, `main.asm` and `start_screen_stage.asm`. Give this file to a test of the loader program as its symbols. When the name changes, the script removes the loader program of the earlier run and its symbols.

The loader does these steps:

1. `10 SYS 2061` starts it.
2. It stops the interrupts and makes all RAM visible. It moves its copier to two free pages.
3. It copies each segment without the leftovers, and the pages $0002-$03ff of the entry state, into place. No copy writes over the packed bytes of a copy that has not run yet.
4. When the knowledge has a start screen and `START_SCREEN` is 1, it shows the start screen. It waits until the user releases all keys and fire buttons. Then it waits for a key, or for a fire button on joystick port 1 or 2, and for its release. A move of a joystick is not a key.
5. It sets the screen registers of the VIC-II and the VIC bank from the entry state. Then it waits for the raster line of the entry.
6. It sets the CIA timers, their latches and the interrupt masks from the entry state. A running timer gets the value that counts down to the timer value at the entry.
7. It sets $00/$01, the stack pointer, A, X, Y and the flags. Then it jumps to the entry.

The copy table, the copier and the jump use labels, not numbers. `loader_from_xxxx` and `loader_end_xxxx` are around each packed segment. `loader_to_xxxx` is its first address in place. Thus a segment can change its length, and the loader still works.

The loader changes the free stack byte below the stack pointer (`stackByte`). It does not set the SID, the time of day of the CIAs, the CIA interrupt flags or the interrupt registers of the VIC-II. A program that reads SID voice 3 for random numbers can thus give a different result. A start screen writes the colour RAM, and the loader does not set it again. When you compare the original and the rebuild, observe after the program sets its own random numbers.

The script builds and checks the loader program with the values of `config.asm`. With the defaults, the loader program is the clean program: no copy protection, all corrections and no leftovers. The entry state is the state of the base release. For a loader of a release, build `loader.asm` with the build option `--release <label>`. That loader also does not have the leftovers.

The start screen:

- The start screen needs the VIC-II values of the entry state. Its screen, bitmap, charset and colours must be in a segment of the program, or in a captured stage. See "The start screen of a captured stage".
- With a start screen, the copier uses three pages, not two.
- The start screen is part of the clean build only. The loader program always shows it. A release build has no start screen, and `LEFTOVERS = 1` also turns it off.
- To start the program at once, set `START_SCREEN = 0` in `config.asm`, and assemble `loader.asm`. Do not define `START_SCREEN` on the command line of the build: `config.asm` sets it.
- A test that runs the loader program stops at the start screen, because the emulator cannot press a key of the keyboard matrix. Run until `loader_start_screen_wait`. Then set the PC to `loader_start_screen_continue`.

`loader` holds these fields:

- `program`, the `copies` in their order, `copier` and `stackByte`.
- `verified: true`: the check ran the loader program to its jump to the entry. There, the memory, $00/$01, the registers and the VIC-II are equal to the entry state. The raster line and the CIA values are also equal. An interrupt can run right at the entry, as in the original program.
- `limits`: each CIA value that the loader cannot set as it was at the entry. An old capture has no CIA values. Then capture the program again at its entry point.
- `startScreen`: with a start screen, `shown: true` when the VIC-II had the values of the start screen, and `waits: true` when the start screen waited without a key. `wait` and `continue` are the addresses of the wait and of the code after it. The check sets the PC to `continue`, and then runs the loader to its jump.
- `packed`: `packedBytes` and `unpackedBytes` of the packed form. With a start screen of a captured stage, this is the packed program in the loader program.
- `stage`: the show stage of a start screen of a captured stage. It has the `space` of the stage and the address of the show `code`. It also has the `bytes` of the stage in the loader program, the `stash` copies, `packedBytes` and `unpackedBytes`. `startScreen.stage` names the space.
- When the check of the loader program cannot run, the script does not write a loader program. The loader program of an earlier run stays as it was. `loader.asm` is new. `reason` tells why the check did not run.
- `kept`: when the result has no new loader program, the paths of the loader programs of an earlier run. They are not of this source.

Do these actions when `verified` is `false`:

| Field | Action |
|---|---|
| `reason` about the copy order, the free pages or the count of copies | The reason gives the ranges. Capture the program again with fewer segments, or write the loader by hand. |
| `reason` about the packed form | If a tool is missing, stop the task and give the message to the user. If the free ranges are too small, write the loader by hand. If the check of the unpack fails, give the reason to the user. |
| `reason` that the source does not assemble | Correct the source first. The loader includes the source. |
| `reason` about the start screen | Correct the start screen in the project knowledge, or capture the program again with the start screen in memory. If the start screen is not necessary, remove it from the project knowledge. |
| `reason` about the show stage | If the reason names the coverage of the stage, run the stage with coverage. Put the map into the project knowledge in the space of the stage. If the memory is too small, capture the stage again with less memory. If a tool is missing, stop the task and give the message to the user. If `start_screen_stage.asm` does not assemble, stop the task and give the reason to the user. The reason names the file in `.c64-re-tools/local/` with the source that failed. |
| `reason` that the check of the loader program did not run | Stop the task and give the reason to the user. When the user tells you that the emulator is available, run the same command again. |
| `differences` | The loader ran. The list gives the bytes and the registers that are not equal. |
| `stop` | The loader did not get to its copier or its jump. `stop` gives the address and `port`, the value of $01. `history` gives the last 16 instructions. `cause` gives the first byte of the copier or of a copy that is not correct. |

#### The start screen of a captured stage

Often the loading stage of a program shows a picture that is not in memory at the entry. Then the knowledge has the picture in the captured stage of the space `loading`. `--stage` of the start screen names that space. `--call` names a routine of the stage, for example the routine that starts the loading tune.

The loader then always has the packed form, and the start screen is a program of its own in front of it:

1. Exomizer packs the program with the copier. This is the packed loader.
2. Exomizer packs the packed loader, the bytes of the stage and the show code into the loader program.
3. When the loader program starts, Exomizer unpacks these parts. The program stays packed. The bytes of the packed loader under the stage go to a stash in free memory.
4. The show code shows the start screen with `start_screen.asm`. With a call, it sets $01 to $37, starts the interrupts and calls the routine.
5. It waits for a key or a fire button, as the start screen in the program does.
6. It stops the interrupts and the sound, and it stops the screen. It sets the CIA timers as RUN leaves them.
7. It copies the stash back to the packed loader. Then it starts the packed loader, which unpacks the program over the start screen.

The program is packed while the screen shows. Thus the picture and the tune have more free memory.

- The script puts everything in memory. It does not matter where the stage keeps its bytes, if the memory has enough room.
- The loader program has only the bytes of the stage that the start screen uses. These are the screen, the bitmap and the charset. With a call, they are also each byte of the stage that is not free from the call, as in "The free ranges". A call thus needs the coverage of the stage.
- With colours from the colour RAM of the capture, the show code holds the 1000 colours. It copies them to the colour RAM.
- The patches of the stage are in at the defaults of their switches. Thus a patch under a switch can remove the text of a crack from the picture.
- `start_screen_stage.asm` holds the show code and the bytes of the stage. Do not edit it. To make the loader program again, run `generate --loader`.
- The show stage needs Exomizer. The show code needs free memory in $0400-$9fff or $c000-$cfff. When the memory is too small, the reason gives the largest free ranges.
- The check runs the loader program to `loader_start_screen_wait` of the show stage. There, it compares the VIC-II with the start screen, the screen bytes in memory with the stage, and the colour RAM with the capture. Then it sets the PC to `loader_start_screen_continue`, and it checks the loader as usual.

#### The packed loader

A loader file that loads into $d000 or higher writes the I/O area. When the program is too large for one loader file, `loader.asm` has the packed form:

- `loader.asm` holds only the copier and the bytes below $0400. The segments at $0400 and higher are not in `loader.asm`. Between its free ranges, `loader.asm` holds the bytes of the program.
- The loader program is the build of `main.asm` from $0400 and the build of `loader.asm`, packed into one file. Where the two builds overlap, the loader program has the bytes of `loader.asm`.
- The jump to the entry uses the address of the entry, not its label.

To make the packed loader for other switch values, do these steps:

1. Assemble `main.asm` without an output path. The build name of the program tells the switch values, for example `build/custom_trainer.prg`. The leftovers are $00 in this build.
2. Assemble `loader.asm` without an output path, for example to `build/custom_trainer_loader.prg`. This is the copier.
3. Pack the two files into `build/custom_trainer_packed.prg`. The start address is the copier address in the comment at the start of `loader.asm`. The memory configuration at the exit is `$34`.

These steps do not work when a segment starts below $0400. They also do not work when a patch is between the free ranges of `loader.asm`. In these cases, use `generate --loader` for the base release.

---

## Export a new program

### `export --to <folder>`

The command writes the program of the knowledge as the start of a new program: a new project folder and a zip file of it. A person changes the source of the new project directly.
First, make sure that `generate` gives `PASS`. The command writes nothing until all its checks pass.

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
| `original` | The source of the knowledge does not pass. Run `generate`, and correct the project knowledge until `generate` gives `PASS`. Then export again. |
| `switches` | The build with the export values changes bytes outside the patches, or a patch does not fit. Read `build`. Run `generate`, and correct the patches. |
| `export` | This is a defect of the script. Give the result to the user. |
| `loader` | Read `reason`, and give it to the user. The export does not make the packed form of the loader. |

Traps of the command:

- The command refuses a folder that is not empty, and a zip file that exists. Remove the folder and the zip file of an earlier export, or give another folder.
- The command refuses two switches that change one range. The export puts both alternatives in. In the project knowledge, give all but one of them the kind `change`, with the default of the base release.
- The command refuses a `--drop` range that code which stays goes to or reads. The message names that code. It also refuses a range that cuts code or a region.

#### The free ranges

A block of code stops after RTS, RTI, JMP, BRK or a JAM, and before a gap. A block of code becomes free only when both of these are true:

- No run of the coverage executed it.
- No path gets to it from the entry, the hardware vectors or the code that stays. A path is a call, a jump, a branch, a reference of the knowledge or an operand expression. An entry of a table, and two immediate operands that give its address, are paths too.

Two immediate operands give an address only in these cases:

- The code stores the low byte and the high byte to two adjacent addresses outside $d000-$dfff.
- The code calls a routine with the low byte and the high byte in two registers.
- The code pushes the high byte and then the low byte onto the stack.

An operand expression of the knowledge at an immediate operand replaces these cases for that operand. Thus an operand expression with a constant stops a wrong address.

A call or a jump to ROM is not a path. The coverage shows where the CPU sees ROM. Without coverage, $01 of the entry state shows it. Known code of the knowledge is never ROM.

Code that a run executed always stays. `unreachableExecuted` lists the executed code that the entry and the vectors do not get to. An example is a copy check whose call the export removed. Give its `drop` value to `export` to make it free.

Data becomes free only when all of these are true:

- Its region type is `bytes`, `words`, a table of addresses, `petscii`, `workspace` or `unused`.
- No run read, wrote or executed a byte of it.
- No code that stays reads it or names it. No table that stays has an entry in it.
- It is not in the BASIC line that starts the program, and not at $fffa-$ffff.

The coverage does not show the reads of the VIC-II. Thus `charset`, `sprite`, `bitmap` and `screen` data stay, unless `--drop` names them. The bytes of the start screen always stay. Bytes without a region also stay.

The entry is the entry of the knowledge. Without it, the entry is the address of the first SYS in the BASIC line of the program. Without coverage, nothing becomes free without `--drop`. Without an entry and without the hardware vectors in the program, no code is unreachable.

#### The new project

```text
README.md                  the steps to build and test, the free ranges and the origin
src/                       main.asm, constants.asm, macros.asm, the modules in their folders and loader.asm
baseline/<name>.prg        the exported program, and baseline/<name>.json with its symbols
tests/                     the tests of the project, changed for the new program
.c64-re-tools/knowledge/   the knowledge of the new program
```

- The source has no mark line, no `switches.asm` or `config.asm`, no patch zones and no `; not executed` lines. A start screen stays in the loader. Build with `-DSTART_SCREEN=0` to start the program at once. It keeps the names, the comments, the operand expressions and the macros. A line comment at each changed patch gives the switch, its kind, its value and the comments.
- The knowledge has one revision `export`. It holds the program, the entry and its state, the names, the comments, the regions, the modules and the start screen. It has no history, analyzer names, references, operand expressions, macros, patches, switches, releases or coverage.
- A scenario of `tests/` compares the build of the new project with the baseline. Both sides are the same program. Thus a step of the original side alone goes. A step of the rebuild side alone runs on both sides.
- A run file of `tests/` runs the build of the new project. Scenarios and run files take the names from the symbol files.
- The export leaves out a test that restores a snapshot. It also leaves out a test with a name that the new program does not have, or with an address in a free range.
- The export does not copy recordings, record files or `runs/`.
- The zip file holds the folder without `.c64-re-tools/local/`.

---

## Workflow

1. Put the program bytes into the project knowledge. For a packed program, capture the unpacked program at its entry point first.
2. Run `generate`.
3. Read `result` and `check`. `check.identical: true` tells that the build of the base release is the program byte by byte.
4. Read the source. A label `l_xxxx` is an address without a name in the knowledge.
5. Record names, comments, regions and modules in the project knowledge.
6. Run `generate` again. Do steps 4 to 6 again until the source is clear.
7. Assemble `main.asm` to a program. This is the default build. For a release, give the build option `--release <label>`.
8. For an unpacked program, run `generate` with `--loader` at the end. Compare the loader program with the original program in a test.
9. To start a new program from the rebuild, run `export`.

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
