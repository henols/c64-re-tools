---
name: c64-source
description: Use this skill to generate ACME source code for a C64 program from the project knowledge. The knowledge holds the program, its entry state, the coverage and the names. The script runs Ghidra for the instructions and writes the source files. It checks with ACME that the source assembles to the same bytes as the program. It can also write a loader that sets the entry state of an unpacked program. It can also export the program as the start of a new program. The export is a new project with one value for each switch and without unused code. Use it to make a rebuild. Do not edit the generated files. Change the knowledge and generate again.
---

# c64-source

## Purpose

Generate ACME source from the knowledge: the program, its entry state, the coverage, and the names and the other facts. The same knowledge gives the same source. Make the source better through the knowledge: names, comments, regions, modules and macros. Change the program through patches. Then generate again.

This skill does not change the knowledge.

## Inputs

- The program in the knowledge. Put it in with `image` of the c64-knowledge skill: a capture of the c64-unpacker skill, or a PRG.
- The output directory for the source files, relative to the project folder.
- Optional entry points for Ghidra.
- Optional: the coverage in the knowledge. Add it with `coverage` of the c64-knowledge skill.
- For the loader: the entry state of a capture in the knowledge.

## Tools / execution path

The script runs Ghidra and ACME on this machine. With `--loader`, it also runs the loader in the emulator through the host runtime.

```
node <skill>/scripts/source.ts generate --out src
node <skill>/scripts/source.ts generate --out src --entry '$080d'
node <skill>/scripts/source.ts generate --out src --loader
```

| Option | Meaning |
|---|---|
| `--out src` | The directory for the source files. The script writes over the files that it generated before. It removes a generated `.asm` file that this run does not write. A run without `--loader` keeps `loader.asm` and `loader.prg` of an earlier run. |
| `--entry '$080d'` | An entry point for Ghidra. Use it again for more entry points. The entry of the program, the routines and the code regions in the knowledge are entry points too. |
| `--analyzer-names` | Name an address that has no symbol and no platform name with its analyzer name, for example `FUN_17e2`. The order is heuristic, Ghidra, then DXA. Without it, the source makes its own names, for example `l_17e2`. |
| `--space drive8` | Generate the source of drive code or a cartridge bank from the knowledge of that space. The coverage, `--loader` and the platform names are only for `c64`. |
| `--loader` | Also write `loader.asm` and `loader.prg`. This needs a capture in the knowledge, with its entry and its entry state. |
| `--max-listed 20` | List at most this number of items in each list. The default is 50. The counts are always in the result. |

When the knowledge has coverage, code that no run executed gets the line `; not executed` with its range. `notExecuted` lists it. The executed code is also a seed for Ghidra. Thus the source has the code after a JSR to a routine that Ghidra thinks does not return.

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- The script examines each `--out` path before it starts work. It refuses a path in `.c64-re-tools/knowledge/` and the index of the knowledge, because only c64-knowledge writes them. It refuses a folder where the command writes a file, and a file where the command writes a folder.
- The result is one JSON object on one line. A file that the script writes shows as `{"out", "bytes", "sha256"}`. A list shows as `{"count", "listed"}`, and `rest` tells where to get the rest of a long list.
- An error is `{"error": {"code": "...", "message": "..."}}`. The message tells what is wrong and what to do.
- The exit status is 0 for done or PASS, 1 for FAIL, 2 for an error and 3 for INCONCLUSIVE.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence test:<file>` or `--evidence file:<file>` of c64-knowledge. These two refuse a file in `.c64-re-tools/local/`.
- Do not move a coverage map after `coverage` of c64-knowledge imported it. `--evidence coverage:<map>` names the map by its path at the import. The knowledge keeps the coverage and the SHA-256 of the map, so the evidence stays valid.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Put the program into the knowledge with `image` of the c64-knowledge skill. For a packed program, capture it first with the c64-unpacker skill. For a program without a packer, use the PRG.
2. Run the script.
3. Read `result` and `check`. `check.identical: true` tells that the build of the base release assembles to the program byte by byte. Without switches, this build is the default build.
4. Read the source. A label `l_xxxx` is an address that has no name in the knowledge.
5. Record names, comments, regions and modules with the c64-knowledge skill. Use `apply` for many changes.
6. Run the script again. Do steps 4 to 6 again until the source is clear.
7. Build the program with the c64-assembler skill: `assembler.ts build src main.asm --out <file.prg>`. This is the default build. For a release, add `--release <label>`.
8. For an unpacked program, run the script with `--loader` at the end. Test `loader.prg` against the original with the c64-testing skill.

## The source

- `main.asm` sets the address of each segment and includes the files in address order.
- Each module in the knowledge is one file. A module starts at its address and stops at the next module or at the end of its segment. Without modules, each segment is one file, `segment_xxxx.asm`.
- `constants.asm` holds the names of addresses outside the program, for example `EXTCOL = $d020`. The file puts the names in groups by memory area, for example zero page, VIC-II registers or CIA 1 registers. Each group is in address order. Drive code and banks have one group only. The side comment of a name tells what the address is. This text is the knowledge comment of the address. Without a comment, the text is the platform meaning. When the knowledge name is not the platform name, the platform name comes first. For an I/O mirror without a meaning, the text gives the register that the mirror repeats. Then `Used:` counts how the source uses the name. The kinds are `read`, `written`, `modified`, `called`, `jumped to`, `jumped through`, `branched to`, `pointer`, `address`, `table` and `macro argument`. `address` is an immediate operand expression. `table` is an entry in a table of addresses.
- `config.asm` holds the value of each switch, for example `PROTECTION = 0`. The first value of a switch is its default. The switches are in groups by kind. The side comment gives the releases that have the switch on, the ranges of its patches and the comment of the switch. The user can change a value to 0 or 1. The next run keeps the values of the file. It adds a new switch with its default and removes a switch that the knowledge does not have.
- `switches.asm` holds every release of the knowledge. `main.asm` and `loader.asm` include it first. The script writes it only when the knowledge has switches or releases. For each release, a block `!ifdef RELEASE_<label>` gives each switch the value of that release. A build without a release reads the values from `config.asm`.
- A label or a constant gets the name of the address in the knowledge. Without a knowledge name, it gets the platform name of the c64-memory-map skill, for example `EXTCOL` or `CHROUT`. A platform name wins over a name from an analyzer (`dxa`, `ghidra` or `heuristic`), for example `EXTCOL` over `ld020`. A `user` or `llm` name wins over a platform name. An address in the program without a name gets `l_xxxx`.
- The source uses the names of a ROM only when the program uses that ROM. When the knowledge has coverage, a ROM is in use when a run executed code of it. A read of ROM bytes as data does not count. Without coverage, `$01` of the entry state tells which ROMs are in. When the program uses neither ROM, the zero page and pages 2 and 3 get no system names. `romNamesLeftOut` gives the ROMs that the source did not name, and the evidence. An operand expression or a macro use with such a name gets that reason.
- `sta $d011  ; $d011: yScroll 3, rows 25, displayEnabled` is a store of an immediate to a register that the c64-memory-map skill decodes. The side comment gives the decoded value. A side comment in the knowledge replaces it.
- Code regions, and the instructions that Ghidra decodes outside of data regions, become instructions.
- Data regions become data by their type: `!byte`, `!word`, `!pet`, `!scr`, `!fill`, tables of labels, and sprite bytes in binary.
- `lda+2 $0012` is an absolute operand below $0100. `+1` is a zero-page operand with a label.
- `sta NMINV+1` is an address inside a platform entry of more than one byte, for example the high byte of a vector.
- `lda room_colours+5` is an address inside a data region whose start has a name. The address has no name of its own.
- `name = * + 1` is a label inside an instruction, for example for code that changes its own operand.
- `lda #<irq_handler` and `lda bar_colours-1,x` are operand expressions of the knowledge. The script writes each name of an expression with the name of its address in the source. An operand expression in a non-immediate mode that starts with a bracket gets `0+` before it, because ACME reads `(...)` as indirect.
- `; = <irq_handler` at the end of an instruction with a number: the source cannot use this operand expression. `operandsAsNumbers` gives the reason.
- `!byte` with an instruction as its comment: ACME writes this instruction with a different opcode. The bytes keep the source identical.
- `not decoded` marks bytes in a code region that Ghidra did not decode.
- `; not executed $xxxx-$yyyy` starts code that no run of the coverage executed. The range is the same as in `not_executed.json`.
- `+inc16 ptr` is a use of a macro of the knowledge. `macros.asm` holds the macros. `main.asm` and `loader.asm` include it. The comments inside a use go to its side comment.
- `!zone patch_PROTECTION_100e` starts a patch of the knowledge. The condition is the state that the program does not have. It is `!if TRAINER` when the base release has the switch off. It is `!if PROTECTION = 0` when the base release has it on. The block has the code of the patch and NOP to the end of the range. `else` has the original code. The labels inside the range come before the zone as `name = * + n`. Thus all builds have them.
- Alternatives are patches of two or more switches at one range. They follow as `} else { !if FIX_B {`. A line before them stops the build with `!error` when two of them are in.

Do not edit the generated files. The next run writes over them. The values in `config.asm` are the one exception.

## Switches and macros

The program of the knowledge is the base release. The default build is the clean program: no copy protection, no trainer, no cheat and no crack change, and all corrections. Thus the default build can differ from the program. The script does these checks:

1. `check`: the build of the base release, with each switch at its base value, must give the program byte by byte.
2. `switches`: the script builds each switch alone at the other value. It does not build two switches together. The build must have the same length as the build of the base release. It can change bytes only in the ranges of the patches of the switch.
3. `default`: the default build must have the same length. It can change bytes only in the patches of the switches in `default.in`. These are the switches whose default is not their base value.
4. `releases`: the script builds each release with `RELEASE_<label>=1` and compares it with the file of the release.

The checks use the defaults and the values of the knowledge. They do not use the values in `config.asm`. When `config.asm` has a value that is not the default, `config.notDefault` gives the switch, its value and its default.

Build the program with the c64-assembler skill:

- The build of `config.asm`: no option. With the defaults, this is the default build.
- A release: `--release ORIGINAL`.
- One switch: set its value in `config.asm`, for example `TRAINER = 1`. Do not use `--define` for a switch. ACME stops with `Symbol already defined`, because `config.asm` also gives the switch a value.

The script writes a patch only when its range is complete items of one file. A patch cannot cut an instruction. Its switch name cannot be a name of the source.

The script writes a macro use only when the use gives the bytes of the program. First it assembles each use alone at its address. Then it checks the full build. A use that fails stays instructions, and `macrosAsInstructions` gives the reason. A label inside the range of a use also keeps the instructions, because the macro line has no place for the label.

## The loader

`--loader` writes `loader.asm` and assembles it to `loader.prg`. The loader does these steps:

1. `10 SYS 2061` starts it.
2. It stops the interrupts and makes all RAM visible. Then it moves its copier to two free pages. Thus a copier at $a000 or higher is not read from the BASIC ROM.
3. It copies each segment and the pages $0002-$03ff of the entry state into place. The script selects an order in which no copy writes over the packed bytes of a copy that has not run yet.
4. It sets the screen registers of the VIC-II and the VIC bank from `io` in the entry state. Then it waits for the raster line of the entry.
5. It sets the CIA timers, their latches and the interrupt masks from `io` and `cia` in the entry state. A running timer gets the value that counts down to the timer value of the entry at the entry.
6. It sets $00/$01, the stack pointer, A, X, Y and the flags, and jumps to the entry.

The copy table, the copier and the jump to the entry use labels, not numbers. `loader_from_xxxx` and `loader_end_xxxx` are around each packed segment, and `loader_to_xxxx` is its first address in place. The jump goes to the label of the entry. Thus a segment can change its length, and the loader still copies it and jumps to the entry that moved. The screen values, the raster line and the CIA values stay numbers. They are the entry state, not addresses of the program.

The flags go through the free stack byte below the stack pointer (`stackByte`). The loader changes this byte. The loader does not set the SID, the time of day of the CIAs, the CIA interrupt flags or the interrupt registers of the VIC-II. `loader.limits` names each CIA value that the loader cannot set as it was at the entry. A program that reads the SID voice 3 for random numbers can still differ in a scenario. A raster sync does not change a timer or the SID. Then observe after the program sets up its own random numbers. To sync the original and the rebuild in a test, see the sync rules of the c64-testing skill.

The script simulates the copies first. Then it runs `loader.prg` in the emulator to its jump to the entry. It compares the memory, $00/$01, the registers, the screen registers of the VIC-II, the VIC bank and the raster line with the entry state there. It also compares the CIA timers, latches and interrupt masks. `loader.verified: true` tells that all of them are equal. An interrupt can run right at the entry, as in the original program.

The entry state is the state of the base release. Thus the script builds and checks `loader.prg` with the switch values of the base release. For a loader of the default build, build `loader.asm` with the c64-assembler skill and no option.

### The packed loader

A loader file that loads into $d000 or higher writes the I/O area. When the image is too large for one loader file, `loader.asm` has the packed form. The packed form needs Exomizer. It has these differences:

- `loader.asm` holds only the copier and the bytes below $0400: pages $0002-$03ff of the entry state and the parts of segments there. The copier is at a free address, `loader.copier`. The segments at $0400 and higher are not in `loader.asm`.
- The script packs the build of `main.asm` from $0400 and the build of `loader.asm` into `loader.prg` with Exomizer. Where the two builds overlap, the bytes of `loader.asm` are in `loader.prg`.
- `10 SYS` starts the unpacker. The unpacker writes all bytes, also at $d000-$dfff. Then it jumps to the copier with all RAM visible ($01 = $34).
- The unpacker uses the zero page and $0334-$03ff. Thus the copier writes pages $0002-$03ff after the unpack. Then it does steps 4 to 6.
- The jump to the entry uses the address of the entry, not its label. The build of `loader.asm` does not include `main.asm`.

The script checks the unpack in the emulator of Exomizer. All bytes of the two builds must be correct, and the unpacker must jump to the copier. Then the script runs `loader.prg` in the emulator, as for the plain loader. `loader.packed` gives `packedBytes` and `unpackedBytes`.

To make the packed loader for other switch values, do these steps:

1. Build the program with the c64-assembler skill: `assembler.ts build src main.asm --out build/main.prg`.
2. Build the copier with the c64-assembler skill: `assembler.ts build src loader.asm --out build/copier.prg`.
3. Pack the two files with the c64-packer skill: `packer.ts pack build/main.prg build/copier.prg --entry '$c000' --exit-memory '$34' --out build/loader.prg`. The comment at the start of `loader.asm` gives the `--entry` value.

These commands do not work when a segment starts below $0400. Then the build of `main.asm` has bytes in the area of the unpacker. Use `generate --loader` for the base release.

## Export for a new application

`export` writes the program of the knowledge as the start of a new program: a new project folder and a zip file of it. A person changes the source of the new project directly. The c64-export skill gives the full procedure.

```
node <skill>/scripts/source.ts export --to ../game-new
node <skill>/scripts/source.ts export --to ../game-new --name game --drop '$081b-$0822'
```

| Option | Meaning |
|---|---|
| `--to ../game-new` | The folder of the new project, relative to the project folder. The folder must be new or empty, and no project can hold it. The script also writes `../game-new.zip`. |
| `--name game` | The name of `baseline/game.prg` and `build/game.prg`. The default is the name of the folder. |
| `--keep '$2000-$20ff'` | A range that stays, also when nothing uses it. Use it again for more ranges. |
| `--drop '$081b-$0822'` | A range that becomes free. Use it again for more ranges. Code that stays must not go to the range or read it. |
| `--max-listed 20` | List at most this number of items in each list. The default is 50. |

The script does these steps. It writes nothing until all the checks pass.

1. It builds the source of the base release. The build must give the program byte by byte, with all the patches.
2. It sets each switch to its export value:
   - `fix`, `trainer` and `cheat`: 1. Trainers and cheats become a part of the new program.
   - `protection` and `crack`: 0.
   - `change`: its default.
3. It builds the program with these values. This build can change bytes only in the patches.
4. It finds the free ranges. Each free range gets the bytes $00 and the label `free_xxxx`. No address moves.
5. It makes the source of the new program. ACME must assemble the source to the new program byte by byte. For a capture with an entry state, the script also makes `loader.asm` and simulates its copies. It does not run the loader in the emulator.
6. It writes the new project and the zip file.

### The free ranges

The script divides the decoded instructions into blocks. A block stops after RTS, RTI, JMP, BRK or a JAM, and before a gap. A block of code becomes free only when both of these are true:

- No run of the coverage executed it.
- No path gets to it from the entry, the hardware vectors or the code that stays. A path is a call, a jump, a branch, a reference of the knowledge or an operand expression. An entry of a table and two immediate operands that give its address are paths too.

Code that a run executed always stays. `unreachableExecuted` lists the executed code that the entry and the vectors do not get to. An example is a copy check whose call the export removed. Give its range to `--drop` to make it free.

Data becomes free only when all of these are true:

- Its region type is `bytes`, `words`, a table of addresses, `petscii`, `workspace` or `unused`.
- No run read, wrote or executed a byte of it.
- No code that stays reads it or names it, and no table that stays has an entry in it.
- It is not at the first address of the program and not at $fffa-$ffff.

The VIC-II reads `charset`, `sprite`, `bitmap` and `screen` data without the CPU, so the coverage does not show these reads. This data stays unless `--drop` names it. Bytes without a region also stay.

The entry is the entry of the knowledge. Without it, the entry is the address of the first SYS in the BASIC line of the program. Without coverage, nothing becomes free by itself. Without an entry and without the hardware vectors in the image, no code is unreachable.

### The new project

```
README.md                  the commands to build and test, the free ranges and the origin
src/                       main.asm, constants.asm, macros.asm, the modules and loader.asm
baseline/<name>.prg        the exported program, and baseline/<name>.json with its symbols
tests/                     the tests of the project, changed for the new program
.c64-re-tools/knowledge/   the knowledge of the new program
```

- The source has no mark line, no `switches.asm` or `config.asm`, no patch zones and no `; not executed` lines. It keeps the names, the comments, the operand expressions and the macros. A line comment at each changed patch gives the switch, its kind, its value and the comments of the switch and the patch.
- The knowledge has one revision `export`. It holds the program, the entry and its state, the names, the comments, the regions and the modules. It has no history, analyzer names, references, operand expressions, macros, patches, switches, releases or coverage.
- The tests come from the JSON files in `tests/`:
  - A scenario compares the build of the new project with the baseline. Both sides are the same program, so a step of the original side alone goes. A step of the rebuild side alone runs on both sides.
  - A run file runs the build of the new project.
  - Both take the names from the symbol files.
  - The script leaves out a test that restores a snapshot. It also leaves out a test with a name that the new program does not have, or with an address in a free range.
  - The script does not copy recordings, record files or `runs/`.
- The zip file holds the folder without `.c64-re-tools/local/`.

The result of `export`:

- `result`: `PASS` when the script wrote the new project. `FAIL` with `stage` when a check failed: `original`, `switches`, `export` or `loader`. Then the script wrote nothing.
- `to` and `zip`: the folder and the zip file.
- `switches`: each switch with `kind`, `base` and the export `value`.
- `free`: the count of free bytes, and each free range with `bytes`, `what` and `label`.
- `unreachableExecuted`: each range of executed code that the entry does not get to, with the `routine` before it and its `--drop` option.
- `knowledge`: the counts of the rows of the new knowledge.
- `tests`: the `written` tests, and the `leftOut` tests with the reason.
- `loader`: the copies, the copier, `stackByte` and `simulated: true`.
- `noCoverage` or `unrooted`: why nothing became free by itself.
- `spacesLeftOut`: the spaces that the export does not have. The export has only the space `c64`.

## Knowledge

Read:
- symbols, regions, comments, references, modules, operand expressions, patches, macros and macro uses of all origins.

Automatic write:
- none.

Do not store:
- the generated source or its labels `l_xxxx`.

## Result

- `result`: `PASS` when every check passes, else `FAIL`.
- `files`: the files that the script wrote in `--out`, each with `out`, `bytes` and `sha256`. `sourceMap` names `source-map.json`.
- `removed`: the files of an earlier run that the script removed from `--out` and did not write again.
- `instructions`, `dataBytes` and `undecodedBytes`.
- `labels`: `named` labels from the knowledge and `generated` labels `l_xxxx`.
- `entriesInData`: each `--entry` in a data region of the knowledge, with the `region` and its `origin`. Ghidra does not decode an entry in a data region.
- `asBytes`: the instructions that the source has as bytes.
- `operandExpressions`: the count of instructions that the source has with an operand expression.
- `operandsAsNumbers`: the operand expressions that the source has as a number with a side comment, each with its `address`, `expression` and `reason`. An expression becomes a number when no instruction with an operand value is at the address, or when a name has no address. An expression that ACME refuses or does not assemble to the program also becomes a number. Then the script assembles the source again, at most six times.
- `unusedModules`: modules in the knowledge whose start is in no segment of the program. Often this tells that the program does not hold code that the knowledge describes.
- `entryOutside`: the entry is in no segment of the program in the knowledge, with a `reason`. The capture does not hold the program.
- `dataOnly`: the knowledge has no entry, no routine, no code region and no executed address in the space. Thus the source has only data, and Ghidra does not run. A table or a key page in a cartridge bank is an example.
- `notExecuted`: when the knowledge has coverage, the count of instructions that no run executed, the count of their ranges, and the first ranges. `rest` names the file `not_executed.json` in `--out` when the list is not complete. This file has all of the ranges. Each range has its source `file` and the `routine` before it. `files` counts the ranges in each file.
- `macroUses`: the count of macro uses that the source has.
- `macrosAsInstructions`: the macro uses that the source has as instructions, each with its `start`, `end`, `macro` and `reason`.
- `patchesNotWritten`: the patches that the source does not have, each with its range, `switch` and `reason`.
- `check`: `identical`, and the result for each segment of the build of the base release. A different segment gives its first different address.
- `switches`: the build of each switch that has patches. Each item has `kind`, `default`, `base`, the `define` for the c64-assembler skill and the patches. `result` is the result of the build with the switch at the value that is not `base`. `fits` tells that the build is good, and `changedBytes` counts the changed bytes. `overflow` tells that the code of a patch is longer than its range. `changes outside` gives the first byte outside the ranges that changed. `does not assemble` gives the diagnostics of ACME. `insideNames` lists the labels inside a patch. Code that writes to one of these labels changes the patch when the switch is on.
- `default`: the default build. `in` lists the switches whose patches are in. `result` and `changedBytes` are as in `switches`.
- `releases`: the build of each release. Each item has `label`, `base`, `file`, the `define` and the `result`. `identical` tells that the build gives the bytes of the file. `different` gives the segments that differ. `layout differs` tells that the release has other segments than the program: patches cannot move code, so this result does not fail the run. `file changed` tells that the file is not the file that the knowledge recorded. `does not assemble` gives the diagnostics of ACME.
- `loader`: the program, the copies in their order, the copier page, `stackByte`, `verified` and `differences`. A packed loader also has `packed` with `packedBytes` and `unpackedBytes`. `limits` lists the CIA values that the loader cannot set. An entry state from an old capture has no CIA values. Then `limits` tells you to capture the program again. When the script cannot make the loader, `loader` has `verified: false` and a `reason`. The loader includes the source. Thus a source that does not assemble to the program also stops the loader.

`result` is `PASS` when the source is identical and the emulator check of the loader passes. `result` is `FAIL` for a failed check and for an entry in no segment. These also give `FAIL`:

- a patch that the source does not have
- a switch or a default build that does not fit
- a release that the build does not give. A release with `layout differs` does not give `FAIL`, but the base release must be `identical`.

`asBytes`, `notExecuted`, `operandsAsNumbers`, `macrosAsInstructions` and `patchesNotWritten` are lists of at most `--max-listed` items.

## Failure and conflicts

- `check.diagnostics`: ACME did not assemble the source. A name in the knowledge can be wrong for ACME. Read the diagnostics and change the name with c64-knowledge.
- `check.identical: false`: the script has a defect. Give the result to the user.
- `operandsAsNumbers`: read each `reason`. Correct the expression with `operand` of the c64-knowledge skill, or remove it with `unoperand`.
- `invalid-input` that names a symbol or a module: change that symbol or module in the knowledge.
- `switches` with `overflow`: make the code of the patch shorter, or make the range of the patch larger, with `patch` of the c64-knowledge skill.
- `switches` with `does not assemble`: read the diagnostics and correct the code of the patch.
- `patchesNotWritten`: read each `reason`. Move the start or the end of the patch to an instruction, or give the switch another name. For a switch that is not in the knowledge, write it with `switch` of the c64-knowledge skill.
- `default` with `overflow` and the message `turn on one of them`: two alternatives are in the default build. Give one of the switches the default of the base release.
- `releases` with `different`: the release has bytes that no patch gives. Compare the releases with the c64-provenance skill. Then record a switch and a patch for each difference.
- `releases` with `file changed`: put back the file, or record the release again with `release` of the c64-knowledge skill.
- `macrosAsInstructions`: read each `reason`. Correct the macro or the args, or remove the use with `unuse`. The source stays identical, so this is not a failure.
- `entryOutside`: the run fails, but the script still writes and checks the source. With `--loader`, `loader.verified` is `false` with the same `reason`. Capture the program again with c64-unpacker `loads` or `capture`. Make sure that a segment holds the entry. Then put it into the knowledge again with `image`.
- `dataOnly`: this is not a failure. If the space has code, give `--entry` or classify the code with the c64-knowledge skill. Then generate again.
- `entriesInData`: an analyzer region of data hides the code at the entry. If the entry is code, record a code region at the entry with the c64-knowledge skill, for example `classify '$0500-$05ff' code`. A region of the user or the LLM replaces the analyzer region. Then generate again.
- `loader.verified: false` with a `reason`: the script did not make the loader. The script still writes and checks the source. When no copy order or no free pages exist, or the loader needs too many copies, the reason gives the ranges. Capture the program again with fewer segments, or write the loader by hand.
- `loader.verified: false` with a `reason` about the packed form: the image is too large for one loader file. If the reason tells that Exomizer is not installed, stop the task. Give the message to the user. If no free range has space for the copier, the reason gives the largest free ranges. Write the loader by hand. If the unpack check of Exomizer fails, give the reason to the user.
- `loader.verified: false` with `differences`: the loader ran, and `differences` gives the bytes and registers that are not equal.
- `loader.verified: false` with `stop`: the loader did not get to its copier or to its jump. `stop` gives the address where it stopped and `port`, the value of $01. `history` gives the last 16 instructions. `cause` gives the first byte of the copier that is not equal to its byte in the loader file. For a packed loader, `cause` gives the first byte of the copier that the unpack did not write. If the copier ran, `cause` can also give the first byte that a copy did not write correctly.
- `export` with `stage: "original"`: the source of the knowledge does not pass. Run `generate`, and correct the knowledge until `generate` gives PASS.
- `export` with `stage: "switches"`: the build with the export values changes bytes outside the patches, or a patch does not fit. Read `build`. Correct the patches.
- `export` refuses two switches that change one range: the export puts both alternatives in. Give all but one of them the kind `change` and the default of the base release with `switch` of the c64-knowledge skill.
- `export` refuses `--drop`: read the message. It names the code that stays and goes to the range or reads it, or the code or region that the range cuts.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disassembler or emulator script.

## Handoffs

- Capture a packed program → c64-unpacker
- Put the program and the coverage into the knowledge → c64-knowledge
- Names, regions, comments and modules → c64-knowledge
- Build the program → c64-assembler
- Test the rebuild against the original → c64-testing
- The start of a new program from the rebuild → c64-export
