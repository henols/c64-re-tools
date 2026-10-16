---
name: c64-source
description: Use this skill to generate ACME source code for a C64 program from its image and the project knowledge. The script runs Ghidra for the instructions and writes the source files. It checks with ACME that the source assembles to the same bytes as the image. It can also write a loader that sets the entry state of an unpacked program. Use it to make a rebuild. Do not edit the generated files. Change the knowledge and generate again.
---

# c64-source

## Purpose

Generate ACME source from an image and the knowledge. The same knowledge gives the same source. Make the source better through the knowledge: names, comments, regions, modules and macros. Change the program through patches. Then generate again.

This skill does not change the knowledge.

## Inputs

- The image: an `image.json` from c64-unpacker capture, or a PRG. The path is relative to the project folder.
- The output directory for the source files, relative to the project folder.
- Optional entry points for Ghidra.
- For the loader: the `entry_state.json` next to `image.json`.

## Tools / execution path

The script runs Ghidra and ACME on this machine. With `--loader`, it also runs the loader in the emulator through the host runtime.

```
node <skill>/scripts/generate.ts unpacked/image.json --out src
node <skill>/scripts/generate.ts game.prg --out src --entry '$080d'
node <skill>/scripts/generate.ts unpacked/image.json --out src --loader
```

| Option | Meaning |
|---|---|
| `--out src` | The directory for the source files. The script writes over the files that it generated before. |
| `--entry '$080d'` | An entry point for Ghidra. Use it again for more entry points. The entry of `image.json`, the routines and the code regions in the knowledge are entry points too. |
| `--coverage coverage/attract.bin` | A coverage file of 64 KiB from `c64_memmap` with `out`. Use it again for more runs. Code that no run executed gets the line `; not executed` with its range. `notExecuted` lists it. |
| `--space drive8` | Generate the source of drive code or a cartridge bank from the knowledge of that space. `--coverage` and `--loader` are only for `c64`, and platform names are only for `c64`. |
| `--loader` | Also write `loader.asm` and `loader.prg`. This needs `image.json` with an entry, and `entry_state.json`. |

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Keep the results, batches and step files that you save for yourself in `.c64-re-tools/local/` of the project. Git ignores that folder.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Get the image. For a packed program, use c64-unpacker capture. For a program without a packer, use the PRG.
2. Run the script.
3. Read `check`. `identical: true` tells that the source assembles to the image byte by byte.
4. Read the source. A label `l_xxxx` is an address that has no name in the knowledge.
5. Record names, comments, regions and modules with the c64-knowledge skill. Use `apply` for many changes.
6. Run the script again. Do steps 4 to 6 again until the source is clear.
7. Build the program with the c64-assembler skill: `--source-root src --entry main.asm`.
8. For an unpacked program, run the script with `--loader` at the end. Test `loader.prg` against the original with the c64-testing skill.

## The source

- `main.asm` sets the address of each segment and includes the files in address order.
- Each module in the knowledge is one file. A module starts at its address and stops at the next module or at the end of its segment. Without modules, each segment is one file, `segment_xxxx.asm`.
- `constants.asm` holds the names of addresses outside the image, for example `EXTCOL = $d020`. The file puts the names in groups by memory area, for example zero page, VIC-II registers or CIA 1 registers. Each group is in address order. Drive code and banks have one group only. The side comment of a name tells what the address is. This text is the knowledge comment of the address. Without a comment, the text is the platform meaning. When the knowledge name is not the platform name, the platform name comes first. For an I/O mirror without a meaning, the text gives the register that the mirror repeats. Then `Used:` counts how the source uses the name. The kinds are `read`, `written`, `modified`, `called`, `jumped to`, `jumped through`, `branched to`, `pointer`, `address`, `table` and `macro argument`. `address` is an immediate operand expression. `table` is an entry in a table of addresses.
- The top of `constants.asm` sets each switch to 0, for example `!ifndef CRACK { CRACK = 0 }`. A build that defines the switch as 1 uses the patches of that switch.
- A label or a constant gets the name of the address in the knowledge. Without a knowledge name, it gets the platform name of the c64-memory-map skill, for example `EXTCOL` or `CHROUT`. A platform name wins over a name from an analyzer (`dxa`, `ghidra` or `heuristic`), for example `EXTCOL` over `ld020`. A `user` or `llm` name wins over a platform name. An address in the image without a name gets `l_xxxx`.
- Code regions, and the instructions that Ghidra decodes outside of data regions, become instructions.
- Data regions become data by their type: `!byte`, `!word`, `!pet`, `!scr`, `!fill`, tables of labels, and sprite bytes in binary.
- `lda+2 $0012` is an absolute operand below $0100. `+1` is a zero-page operand with a label.
- `sta NMINV+1` is an address inside a platform entry of more than one byte, for example the high byte of a vector.
- `name = * + 1` is a label inside an instruction, for example for code that changes its own operand.
- `lda #<irq_handler` and `lda bar_colours-1,x` are operand expressions of the knowledge. The script writes each name of an expression with the name of its address in the source. An operand expression in a non-immediate mode that starts with a bracket gets `0+` before it, because ACME reads `(...)` as indirect.
- `; = <irq_handler` at the end of an instruction with a number: the source cannot use this operand expression. `operandsAsNumbers` gives the reason.
- `!byte` with an instruction as its comment: ACME writes this instruction with a different opcode. The bytes keep the source identical.
- `not decoded` marks bytes in a code region that Ghidra did not decode.
- `; not executed $xxxx-$yyyy` starts code that no run of the `--coverage` files executed. The range is the same as in `not_executed.json`.
- `+inc16 ptr` is a use of a macro of the knowledge. `macros.asm` holds the macros. `main.asm` and `loader.asm` include it. The comments inside a use go to its side comment.
- `!zone patch_CRACK_100e` starts a patch of the knowledge. `!if CRACK` has the code of the patch and NOP to the end of the range. `else` has the original code. The labels inside the range come before the zone as `name = * + n`. Thus both builds have them.

Do not edit the generated files. The next run writes over them.

## Switches and macros

A switch changes the program only when the build defines it. Thus the source without a define stays identical to the image.

1. The script checks the default build with `check`.
2. Then it builds each switch on its own, with the switch as 1. It does not build two switches together.
3. The build of a switch must have the same length as the default build. It can change bytes only in the ranges of its patches.
4. Build the program with a switch on with the c64-assembler skill: `--define CRACK=1`.

The script writes a patch only when its range is complete items of one file. A patch cannot cut an instruction. Its switch name cannot be a name of the source.

The script writes a macro use only when the use gives the bytes of the image. First it assembles each use alone at its address. Then it checks the full build. A use that fails stays instructions, and `macrosAsInstructions` gives the reason. A label inside the range of a use also keeps the instructions, because the macro line has no place for the label.

## The loader

`--loader` writes `loader.asm` and assembles it to `loader.prg`. The loader does these steps:

1. `10 SYS 2061` starts it.
2. It moves its copier to two free pages. The copier runs with interrupts off and with all RAM visible.
3. It copies each segment and the pages $0002-$03ff of the entry state into place. The script selects an order in which no copy writes over the packed bytes of a copy that has not run yet.
4. It sets the display registers of the VIC-II and the VIC bank from `io` in the entry state. Then it waits for the raster line of the entry.
5. It sets the CIA timers, their latches and the interrupt masks from `io` and `cia` in the entry state. A running timer gets the value that counts down to the timer value of the entry at the entry.
6. It sets $00/$01, the stack pointer, A, X, Y and the flags, and jumps to the entry.

The copy table, the copier and the jump to the entry use labels, not numbers. `loader_from_xxxx` and `loader_end_xxxx` are around each packed segment, and `loader_to_xxxx` is its first address in place. The jump goes to the label of the entry. Thus a segment can change its length, and the loader still copies it and jumps to the entry that moved. The display values, the raster line and the CIA values stay numbers. They are the entry state, not addresses of the program.

The flags go through the free stack byte below the stack pointer (`stackByte`). The loader changes this byte. The loader does not set the SID, the time of day of the CIAs, the CIA interrupt flags or the interrupt registers of the VIC-II. `loader.limits` names each CIA value that the loader cannot set as it was at the entry. A program that reads the SID voice 3 for random numbers can still differ in a scenario. A raster sync does not change a timer or the SID. Then observe after the program sets up its own random numbers. To sync the original and the rebuild in a test, see the sync rules of the c64-testing skill.

The script simulates the copies first. Then it runs `loader.prg` in the emulator to its jump to the entry. It compares the memory, $00/$01, the registers, the display registers of the VIC-II, the VIC bank and the raster line with the entry state there. It also compares the CIA timers, latches and interrupt masks. `loader.verified: true` tells that all of them are equal. An interrupt can run right at the entry, as in the original program.

## Knowledge

Read:
- symbols, regions, comments, references, modules, operand expressions, patches, macros and macro uses of all origins.

Automatic write:
- none.

Do not store:
- the generated source or its labels `l_xxxx`.

## Result

One JSON object:

- `files`: the files in the output directory.
- `instructions`, `dataBytes` and `undecodedBytes`.
- `labels`: `named` labels from the knowledge and `generated` labels `l_xxxx`.
- `entriesInData`: each `--entry` in a data region of the knowledge, with the `region` and its `origin`. Ghidra does not decode an entry in a data region.
- `asBytes`: the instructions that the source has as bytes.
- `operandExpressions`: the count of instructions that the source has with an operand expression.
- `operandsAsNumbers`: the operand expressions that the source has as a number with a side comment, each with its `address`, `expression` and `reason`. An expression becomes a number when no instruction with an operand value is at the address, or when a name has no address. An expression that ACME refuses or does not assemble to the image also becomes a number. Then the script assembles the source again, at most six times.
- `unusedModules`: modules in the knowledge whose start is in no segment of the image. Often this tells that the image does not hold code that the knowledge describes.
- `entryOutside`: the entry of `image.json` is in no segment of the image, with a `reason`. The image does not hold the program.
- `notExecuted`: with `--coverage`, the count of instructions that no run executed, the count of their ranges, and the first ranges. `all` names the file `not_executed.json` in `--out`. It has all of the ranges. Put all of these ranges in the report.
- `macroUses`: the count of macro uses that the source has.
- `macrosAsInstructions`: the macro uses that the source has as instructions, each with its `start`, `end`, `macro` and `reason`.
- `patchesNotWritten`: the patches that the source does not have, each with its range, `switch` and `reason`.
- `check`: `identical`, and the result for each segment. A different segment gives its first different address.
- `switches`: the build of each switch. Each item has the `define` for the c64-assembler skill, the patches and the `result` of the build with the switch on. `fits` tells that the build is good, and `changedBytes` counts the changed bytes. `overflow` tells that the code of a patch is longer than its range. `changes outside` gives the first byte outside the ranges that changed. `does not assemble` gives the diagnostics of ACME. `insideNames` lists the labels inside a patch. Code that writes to one of these labels changes the patch when the switch is on.
- `loader`: the program, the copies in their order, the copier page, `stackByte`, `verified` and `differences`. `limits` lists the CIA values that the loader cannot set. An entry state from an old capture has no CIA values. Then `limits` tells you to capture the program again. When the script cannot make the loader, `loader` has `verified: false` and a `reason`. The loader includes the source. Thus a source that does not assemble to the image also stops the loader.

The exit status is 0 when the source is identical and the emulator check of the loader passes. The exit status is 1 for a failed check, for an entry in no segment, and for an error. A patch that the source does not have, or a switch that does not fit, also gives 1. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `check.diagnostics`: ACME did not assemble the source. A name in the knowledge can be wrong for ACME. Read the diagnostics and change the name with c64-knowledge.
- `check.identical: false`: the script has a defect. Give the result to the user.
- `operandsAsNumbers`: read each `reason`. Correct the expression with `operand` of the c64-knowledge skill, or remove it with `unoperand`.
- `invalid-input` that names a symbol or a module: change that symbol or module in the knowledge.
- `switches` with `overflow`: make the code of the patch shorter, or make the range of the patch larger, with `patch` of the c64-knowledge skill.
- `switches` with `does not assemble`: read the diagnostics and correct the code of the patch.
- `patchesNotWritten`: read each `reason`. Move the start or the end of the patch to an instruction, or give the switch another name.
- `macrosAsInstructions`: read each `reason`. Correct the macro or the args, or remove the use with `unuse`. The source stays identical, so this is not a failure.
- `entryOutside`: the run fails, but the script still writes and checks the source. With `--loader`, `loader.verified` is `false` with the same `reason`. Capture the image again with c64-unpacker `loads` or `capture`. Make sure that a segment holds the entry.
- `entriesInData`: an analyzer region of data hides the code at the entry. If the entry is code, record a code region at the entry with the c64-knowledge skill, for example `classify '$0500' '$05ff' code`. A region of the user or the LLM replaces the analyzer region. Then generate again.
- `loader.verified: false` with a `reason`: the script did not make the loader. The script still writes and checks the source. When no copy order or no free pages exist, or the loader needs too many copies, the reason gives the ranges. Capture the image again with fewer segments, or write the loader by hand.
- `loader.verified: false` with `differences`: the loader ran, and `differences` gives the bytes and registers that are not equal.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disassembler or emulator script.

## Handoffs

- Get an image → c64-unpacker
- Names, regions, comments and modules → c64-knowledge
- Build the program → c64-assembler
- Test the rebuild against the original → c64-testing
