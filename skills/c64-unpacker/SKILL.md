---
name: c64-unpacker
description: Use this skill to find out if a C64 program is packed or crunched, and to get the unpacked program for analysis. It shows evidence of packing without a guess of the packer name. It runs the program in an emulator until the unpacked code starts, then writes the memory into the project. Do not use it to analyze the unpacked code.
---

# c64-unpacker

## Purpose

Find out if a C64 program is packed. Get the unpacked program for analysis.

This skill does not change project knowledge.

## Inputs

- The program: a PRG file, relative to the project directory.
- For a capture: the address where the unpacked program starts, and where to write the result.

## Tools / execution path

```
node <skill>/scripts/unpack.ts inspect original/game.prg
node <skill>/scripts/unpack.ts capture original/game.prg --until '$c000' --out unpacked/game.prg --range '$c000' '$cfff'
```

`inspect` examines the file locally. `capture` starts its own emulator through the host runtime, starts the program, and stops it when the CPU gets to the `--until` address.

| Option | Meaning |
|---|---|
| `--until '$c000'` | The address where the unpacked program starts. |
| `--out unpacked/game.prg` | Where to write the result, relative to the project directory. |
| `--range '$c000' '$cfff'` | Write this range as a PRG. Without it, the script writes all 64 KiB of RAM as a flat file. |
| `--timeout-frames 3000` | How many frames the program can run before the capture stops (default 3000). |

The capture reads RAM, also the RAM under the ROMs and the I/O area. The script prints one JSON object.

## Workflow

1. Run `inspect`. Read `basicStart` and `packing`:
   - `likely`: most of the bytes look compressed. Packed data has this property.
   - `unlikely`: the bytes look like code and data. A simple cruncher can also give this result. If a BASIC SYS line starts the program and the static analysis finds little code, continue with step 2.
   - `unclear`: the file is short, or the evidence is mixed.
2. Find the address where the unpacked program starts. Usually the unpacker ends with a JMP to it.
   - Use the c64-emulator skill: set a breakpoint after the unpack loop, or look at the last JMP of the unpacker.
   - Use the c64-static-analysis skill on the unpacker code.
3. Run `capture` with that address. Use `--range` for the area that holds the unpacked program, if you know it.
4. Make sure that the result is the application: the code at the start address must not be the unpacker again.
5. Give the result to the c64-static-analysis skill. For a flat 64 KiB file, use its `--flat64k` option.

## Knowledge

Automatic write:
- none.

Do not record the unpacker in the project knowledge, unless the user asks to examine the unpacker.

## Result

The packing evidence, or the unpacked program in the project with the address where it starts.

## Failure and conflicts

- `captured: false`: the program did not get to the address in the time limit. The reason tells where it stopped. Find a better address with the c64-emulator skill, or give more frames.
- Do not name a packer from weak evidence. The script never names one.
- Some programs unpack in more than one stage. Make sure that the captured code is the application and not a second unpacker.
- `not-found` or `invalid-input`: a path or an argument is wrong. Read the message.
- `operation-failed` with a message about the host runtime: the host runtime does not run. Tell the user to start the host runtime with `npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host`.

## Handoffs

- Unpacked machine code → c64-static-analysis
- Find the start address at run time → c64-emulator
