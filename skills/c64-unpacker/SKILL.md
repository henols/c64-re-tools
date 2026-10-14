---
name: c64-unpacker
description: Use this skill to find out if a packer or a cruncher compressed a C64 program, and to get the unpacked program for analysis. It shows evidence of packing without a guess of the packer name. It runs the program in an emulator until the unpacked code starts, then writes the memory into the project. Do not use it to analyze the unpacked code.
---

# c64-unpacker

## Purpose

Find out if a packer compressed a C64 program. Get the unpacked program for analysis.

This skill does not change project knowledge.

## Inputs

- The program: a PRG file, relative to the project directory.
- For a capture: the address where the unpacked program starts, and the directory for the result.

## Tools / execution path

```
node <skill>/scripts/unpack.ts inspect original/game.prg
node <skill>/scripts/unpack.ts trace original/game.prg
node <skill>/scripts/unpack.ts capture original/game.prg --until '$c000' --out unpacked
node <skill>/scripts/unpack.ts stages original/game.prg --steps input.json
```

`inspect` examines the file locally. `trace` and `capture` start their own emulator through the host runtime and start the program. `trace` runs the program and finds the memory that the program wrote and then executed. `capture` stops the program when the CPU gets to the `--until` address. `stages` runs the program and finds each stage: a decruncher, an intro, a copier, and then the program. For each stage it gives the entry, the frames, the written memory (`wrote`) and the entry of the next stage (`next`). In `stages`, a `frames` step counts as run time, and a `runUntil` step is not possible.

| Option | Meaning |
|---|---|
| `--until '$c000'` | The address where the unpacked program starts. |
| `--out unpacked/game.prg` | Where to write the result, relative to the project directory. |
| `--range '$c000' '$cfff'` | Write this range as a PRG. Without it, the script writes all 64 KiB of RAM as a flat file. |
| `--timeout-frames 3000` | How many frames the program can run before the capture stops (default 3000). |
| `--frames 3000` | `trace` only: how many frames the program runs (default 3000). |
| `--entry '$c000'` | `trace` only: start the program at this address. Without it, `trace` types RUN. A program without a BASIC start line needs it. |
| `--steps input.json` | Input for the program, right after it starts: a JSON list of steps. Use it when an intro waits for a key or a menu waits for a choice. |
| `--min-stage 64` | `stages` only: the smallest block of written memory that starts a new stage when the CPU executes it (default 64). |

The capture reads RAM, also the RAM under the ROMs and the I/O area. The script prints one JSON object.

A steps file has the steps `write`, `registers`, `joystick`, `type`, `frames` and `runUntil` of the c64-testing skill. Addresses are `$` and four hex digits. For example, wait 50 frames and press the space bar:

```json
[{ "frames": 50 }, { "type": " " }]
```

## Workflow

1. Run `inspect`. Read `basicStart` and `packing`:
   - `likely`: most of the bytes look compressed. Packed data has this property.
   - `unlikely`: the bytes look like code and data. A simple cruncher can also give this result.
   - `unclear`: the file is short, or the blocks do not give clear evidence. Or the code at the SYS address decodes or moves bytes outside the program.

   Also read the evidence that the script finds in the file. The script never names a packer from it:
   - `basicText`: the BASIC lines as text. A packer or a crack often puts its name there.
   - `strings`: readable text near the start of the code.
   - `start`: the code at the SYS address. `jumpsOutside` and `writesOutside` give an address outside the loaded program, where the code jumps or writes.
   - `decodeLoops`: EOR instructions in loops that store with an index. This is usually decryption or decoding.
2. Run `trace`. It gives the evidence from the run. Read `packing`:
   - `likely`: the program wrote code and then executed it. It unpacked, decrypted or moved code. `runningRange` is the code that runs now. Its `start` is usually the entry point of the unpacked program.
   - `unclear`: the program executed a small quantity of code that it wrote. This can be code that changes itself.
   - `unlikely`: the program executed no code that it wrote. If the program waits for a key or a joystick, it can move code after that input. Then use the c64-emulator skill.
3. Find the address where the unpacked program starts:
   - Run `stages`. The `entry` of the last stage is usually the start of the program.
   - Or use `runningRange.start` from `trace`, or `suggestedUntil`. The CPU gets to `suggestedUntil` after the unpacking.
   - Or use the c64-emulator skill: set a breakpoint after the unpack loop, or look at the last JMP of the unpacker.
4. Run `capture` with that address and a directory in `--out`. Give the same `--steps` as before. The directory gets:
   - `image.bin`: all 64 KiB of RAM at the entry.
   - `image.json`: the entry, the segments, the vectors and the stages. A segment is a block that a stage wrote. Blocks with the code of an earlier stage are not segments. `writtenBy` tells which stage wrote the segment.
   - One PRG for each segment.
   - `entry_state.json`: the registers, `$00` and `$01`, pages 0 to 3, the VIC, SID and CIA registers, and the vectors. `differsFromReset` lists the bytes that are not as a clean C64 has them at READY. A rebuild must make these bytes the same, because the program can read them.
5. Make sure that the result is the application: the code at the entry must not be the unpacker again. A segment can be data that a loader left, for example intro graphics. Keep it until other evidence shows that the program does not use it.
6. Give `image.bin` to the c64-static-analysis skill with its `--flat64k` option, or give it the segment PRGs.
7. Use `--range` only when you know the area of the program. Then the capture writes that one segment.

## Knowledge

Automatic write:
- none.

Do not record the unpacker in the project knowledge, unless the user asks to examine the unpacker.

## Result

The packing evidence, the stages, or the unpacked program with its image, segments and entry state in a directory of the project.

The exit status is 0 for a result. The exit status is 1 for `traced: false`, for `captured: false` and for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `traced: false`: the emulator did not load the program into memory in the time limit. The reason gives the load address. Make sure that the file is a PRG that the C64 can load.
- `captured: false`: the program did not get to the address in the time limit. The reason tells where it stopped. Find a better address with the c64-emulator skill, or give more frames. If it stopped in a key wait, give `--steps` with a key.
- A step did not reach its target: the reason names the step. Change the step or give it more frames.
- Do not name a packer from weak evidence. The script never names one.
- Some programs unpack in more than one stage. Run `stages` to find each stage. Capture at the entry of the last stage. Make sure that it is the application and not a second unpacker.
- `not-found` or `invalid-input`: a path or an argument is wrong. Read the message.
- `installation-incomplete`, or a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.

## Handoffs

- Unpacked machine code → c64-static-analysis
- Find the start address at run time → c64-emulator
