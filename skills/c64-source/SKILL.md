---
name: c64-source
description: Use this skill to generate ACME source code for a C64 program from its image and the project knowledge. The script runs Ghidra for the instructions and writes the source files. It checks with ACME that the source assembles to the same bytes as the image. It can also write a loader that sets the entry state of an unpacked program. Use it to make a rebuild. Do not edit the generated files. Change the knowledge and generate again.
---

# c64-source

## Purpose

Generate ACME source from an image and the knowledge. The same knowledge gives the same source. Make the source better through the knowledge: names, comments, regions and modules. Then generate again.

This skill does not change the knowledge.

## Inputs

- The image: an `image.json` from c64-unpacker capture, or a PRG. The path is relative to the project directory.
- The output directory for the source files, relative to the project directory.
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
| `--coverage coverage/attract.bin` | A coverage file of 64 KiB from `c64_memmap` with `out`. Use it again for more runs. Code that no run executed gets the line `; not executed`, and `notExecuted` lists it. |
| `--loader` | Also write `loader.asm` and `loader.prg`. This needs `image.json` with an entry, and `entry_state.json`. |

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
- `constants.asm` holds the names of addresses outside the image, for example a name for $d020.
- A label is the name of the address in the knowledge. An address without a name gets `l_xxxx`.
- Code regions, and the instructions that Ghidra decodes outside of data regions, become instructions.
- Data regions become data by their type: `!byte`, `!word`, `!pet`, `!scr`, `!fill`, tables of labels, and sprite bytes in binary.
- `lda+2 $0012` is an absolute operand below $0100. `+1` is a zero-page operand with a label.
- `name = * + 1` is a label inside an instruction, for example for code that changes its own operand.
- `!byte` with an instruction as its comment: ACME writes this instruction with a different opcode. The bytes keep the source identical.
- `not decoded` marks bytes in a code region that Ghidra did not decode.
- `; not executed` starts code that no run of the `--coverage` files executed.

Do not edit the generated files. The next run writes over them.

## The loader

`--loader` writes `loader.asm` and assembles it to `loader.prg`. The loader does these steps:

1. `10 SYS 2061` starts it.
2. It moves its copier to two free pages. The copier runs with interrupts off and with all RAM visible.
3. It copies each segment and the pages $0002-$03ff of the entry state into place. The script selects an order in which no copy writes over the packed bytes of a copy that has not run yet.
4. It sets $00/$01, the stack pointer, A, X, Y and the flags, and jumps to the entry.

The flags go through the free stack byte below the stack pointer (`stackByte`). The loader changes this byte. The loader does not set the VIC, SID and CIA registers. They stay as the KERNAL set them.

The script simulates the copies first. Then it runs `loader.prg` in the emulator to the entry. It compares the memory, $00/$01 and the registers with the entry state. `loader.verified: true` tells that all of them are equal.

## Knowledge

Read:
- symbols, regions, comments, references and modules of all origins.

Automatic write:
- none.

Do not store:
- the generated source or its labels `l_xxxx`.

## Result

One JSON object:

- `files`: the files in the output directory.
- `instructions`, `dataBytes` and `undecodedBytes`.
- `labels`: `named` labels from the knowledge and `generated` labels `l_xxxx`.
- `asBytes`: the instructions that the source has as bytes.
- `unusedModules`: modules that start outside the image.
- `notExecuted`: with `--coverage`, the count of instructions that no run executed, and their ranges. Put these ranges in the report.
- `check`: `identical`, and the result for each segment. A different segment gives its first different address.
- `loader`: the program, the copies in their order, the copier page, `stackByte`, `verified` and `differences`.

The exit status is 0 when the source is identical and the emulator check of the loader passes. The exit status is 1 for a failed check and for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `check.diagnostics`: ACME did not assemble the source. A name in the knowledge can be wrong for ACME. Read the diagnostics and change the name with c64-knowledge.
- `check.identical: false`: the script has a defect. Give the result to the user.
- `invalid-input` that names a symbol or a module: change that symbol or module in the knowledge.
- `invalid-input` for the loader: no copy order or no free pages exist. The message gives the ranges. Capture the image again with fewer segments, or write the loader by hand.
- `loader.verified: false`: `differences` gives the bytes and registers that are not equal.
- `installation-incomplete`, or a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disassembler or emulator script.

## Handoffs

- Get an image → c64-unpacker
- Names, regions, comments and modules → c64-knowledge
- Build the program → c64-assembler
- Test the rebuild against the original → c64-testing
