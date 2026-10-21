---
name: c64-unpacker
description: Finds evidence that a packer or a cruncher compressed a C64 program, and captures the unpacked program from the emulator into the project. Use it when a program can be packed, crunched, encrypted or relocated. Use it to get the unpacked program, its segments and its entry state for analysis. Use it to capture each part of a multi-load program and the drive RAM. It does not name the packer. It does not analyze the unpacked code.
---

# C64 unpacker

Use this script to find evidence of packing and to capture the unpacked program.
Use only the commands of the script. Do not unpack or capture a program in another way.

```bash
node <skill>/scripts/unpacker.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `inspect original/game.prg`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Find evidence of packing in the file, without a run | `inspect original/game.prg` |
| Find the code that the program wrote and then executed | `trace original/game.prg` |
| Run a program that is not a BASIC program at `$0801` | `trace original/game.prg --entry '$c000'` |
| Give input to an intro or a menu before the evidence starts | `trace original/game.prg --steps .c64-re-tools/local/input.json` |
| Find each stage and the entry of the unpacked program | `stages original/game.prg` |
| Capture the unpacked program at its entry | `capture original/game.prg --until '$c000' --out .c64-re-tools/local/capture` |
| Capture again without the bytes of a cracktro | `capture original/game.prg --until '$c000' --out .c64-re-tools/local/capture --exclude '$a000-$a9ff'` |
| Capture only one known range of the program | `capture original/game.prg --until '$c000' --out .c64-re-tools/local/capture --range '$c000-$cfff'` |
| Capture each part of a multi-load program | `loads original/game.d64 --steps .c64-re-tools/local/parts.json --out .c64-re-tools/local/parts` |
| Capture each part and the RAM of the disk drive | `loads original/game.d64 --steps .c64-re-tools/local/parts.json --out .c64-re-tools/local/parts --drive` |

---

## Programs, addresses and steps

- `<program>` is a PRG file of the project. `inspect`, `trace`, `stages` and `capture` refuse a disk, tape or cartridge image. For an image, use `loads`. Or extract the PRG from the image, and give the path of that PRG.
- `loads` takes a PRG, or a disk, tape or cartridge image. It starts a PRG with RUN. Thus the PRG must have a BASIC start line, for example `10 SYS 2061`.
- `trace`, `stages` and `capture` start the program with RUN. RUN needs a BASIC program at `$0801`. For another program, give `--entry` with the start address of its code. Get that address from the load address of the file, or from a disassembly of the file.
- Get the `--until` address of `capture` from `stages`, or from `runningRange.start` or `suggestedUntil` of `trace`. Or set a breakpoint in the emulator after the unpack loop. Then read the address where the CPU stops.
- Get each `--exclude` range from the segments of an earlier capture. Exclude only bytes that the program does not read. See step 5 of the section "Workflow".

### Steps files

A steps file is a JSON list of steps. The steps run right after the program starts. Use a steps file when an intro waits for a key or a menu waits for a choice. For example, wait 50 frames and type a space:

```json
[{ "frames": 50 }, { "type": { "mode": "text", "text": " " } }]
```

Each step has one of these kinds:

- `{ "write": { "address": "$c000", "data": "0102" } }` writes bytes.
- `{ "registers": { "pc": "start", "a": 1 } }` sets registers. Only `pc` takes a name.
- `{ "joystick": { "port": 2, "direction": "up", "fire": false } }` sets a joystick.
- `{ "type": { "mode": "text", "text": "RUN\n" } }` or `{ "type": { "mode": "petscii", "bytes": [147] } }` puts keys in the keyboard queue of the KERNAL.
- `{ "frames": 50 }` runs 1 to 30000 frames.
- `{ "runUntil": { "target": { "kind": "address", "address": "main_loop" }, "timeoutFrames": 300 } }` runs until the target. The target kinds are `address`, `memory` and `raster`. `timeoutFrames` is 1 to 30000. The default is 3000.
- `{ "capture": "level1" }` captures a part. Only `loads` takes this step. Give each capture step a different name of 1 to 64 letters, digits, dots, underscores or hyphens.

An address in a step can be a name. The script refuses an unknown name before the program runs. The message gives the file and the step.

The script refuses a `press` step. A program that reads the keyboard matrix does not see the keys of a `type` step. A wait for any key that reads all keyboard columns can end without a key.

The script refuses a step in an old form. The message gives the step to write.

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
| `--entry <address>` | `trace`, `stages`, `capture` | Start the program at this address in place of RUN. Without it, the script types RUN. |
| `--steps <file>` | `trace`, `stages`, `capture`, `loads` | Run the steps of the file right after the program starts. See "Steps files". `loads` needs this flag. The other commands run no steps without it. |
| `--frames <n>` | `trace`, `stages` | Run the program for n frames, at most 30000. The default is 3000. In `stages`, the frames of the steps count in n. |
| `--max-listed <n>` | `trace` | List at most n ranges in `writtenThenExecuted`. The default is 50. |
| `--min-stage <bytes>` | `stages`, `capture` | A new stage starts when the CPU executes a written block of at least this size. The default is 64. It does not change `wrote` or the segments. |
| `--until <address>` | `capture` | Capture when the CPU gets to this address after the steps. `capture` needs this flag. |
| `--out <dir>` | `capture`, `loads` | Write the result into this folder. These commands need this flag. |
| `--range <start>-<end>` | `capture` | Write only this range as the one segment. The range must hold the `--until` address. Without it, the segments are the blocks that the stages wrote. |
| `--exclude <start>-<end>` | `capture`, `loads` | Remove this range from the segments. You can give it more than once. For `capture`, the range must not hold the `--until` address. The default is no range. |
| `--timeout-frames <n>` | `capture` | Stop the wait for `--until` after n frames, at most 30000. The default is 3000. The frames of the steps count in n. |
| `--drive` | `loads` | Also write the 2 KiB RAM of the 1541 drive at each capture, as `drive8.prg`. The default is off. |
| `--min-block <bytes>` | `loads` | Write a changed block as a segment when it has at least this size. The default is 64. |

The script refuses a wrong `--range` or `--exclude` before the program runs.

---

## Examine the file

### `inspect <program>`

`inspect` examines the file. It does not run the program.

`body` holds:

- `loadRange` and `bytes`: the addresses and the size of the program.
- `basicStart`: the first SYS line and its address in `sys`. When the SYS argument needs values at run time, `sys` is null and `expression` gives the argument. Then `stages` and `capture` start the first stage at the first instruction after the BASIC text. `basicStart` is null when the program has no SYS.
- `packing`, with the reason in `evidence`:
  - `likely`: most of the bytes look compressed. Packed data has this property.
  - `unlikely`: the bytes look like code and data. A simple cruncher can also give this result.
  - `unclear`: the file is short, or the blocks do not give clear evidence. Or the code at the SYS address decodes or moves bytes outside the program.
- `entropy`: the count of blocks, the count of blocks that look compressed, and the median.
- `basicText`: the BASIC lines as raw evidence. A byte that is not a printable character shows as `{$xx}`. A packer or a crack often puts its name there. This is not a listing. To get a listing, list the BASIC program of the file.
- `strings`: readable text near the start of the code.
- `start`: the code at the SYS address. `jumpsOutside` and `writesOutside` give an address outside the program, where the code jumps or writes.
- `decodeLoops`: EOR instructions in loops that store with an index. This is usually decryption or decoding.

The script never names a packer. Do not name a packer from this evidence.

`nextAction` is `trace` of the same program. When the program is not a BASIC program at `$0801`, there is no `nextAction`. Then `hint` tells you to give `--entry`.

---

## Run the program

`trace`, `stages`, `capture` and `loads` run the program in the emulator. `body.result` is `PASS` or `FAIL`. A `FAIL` has `reason`, which tells what stopped the run. Do the action for the reason:

- The program was not in memory in the time limit. The reason gives the load address. Make sure that the file is a PRG that the C64 can load.
- The body has `stopReason`. The CPU stopped before the frames ran, for example at a JAM instruction. The reason gives the address. Make sure that `--entry` is the start of the code at that time. Make sure that the steps have no error.
- A step did not reach its target. The reason names the step. Change the step, or give it more frames.
- After RUN, BASIC ran no program line. The program has no BASIC start line. Give `--entry`. For `loads`, use `capture` with `--entry`.

### `trace <program>`

`trace` runs the program and finds the memory that the program wrote and then executed.

`body` holds:

- `traced`: true when the run completed. `frames` and `pc` give where the run ended.
- `writtenThenExecuted`: the ranges that the program wrote and then executed, as a list. `underRom: true` marks a range in RAM under a ROM.
- `bytes`: the count of written bytes that the CPU executed.
- `packing`, with the reason in `evidence`:
  - `likely`: the program wrote code and then executed it. It unpacked, decrypted or moved code.
  - `unclear`: the program executed a small quantity of code that it wrote. This can be code that changes itself.
  - `unlikely`: the program executed no code that it wrote.
- `runningRange`: the written code that runs at the end of the run. When the run ends in ROM code, for example in an interrupt, it is the written code that runs next. Its `start` is code that runs after the unpacking. It is not always the entry point of the program.
- `suggestedUntil`: an address that the CPU gets to after the unpacking.

When no written code runs in 50 more frames, `body` has no `runningRange` and no `suggestedUntil`.

For `likely` and `unclear`, `nextAction` is `stages` with the same `--entry` and `--steps`. For `unlikely`, `hint` tells you to give the input of the program in `--steps`. A program that waits for a key or a joystick can unpack its code after that input. When `writtenThenExecuted` is cut, `hint` tells you to give a larger `--max-listed`.

### `stages <program>`

`stages` runs the program and finds each stage, for example a decruncher, an intro, a copier, and then the program.

`body` holds:

- `followed`: true when the run completed. `frames` and `pc` give where the run ended.
- `stages`: one item for each stage, with `stage`, `entry`, `frames`, `wrote` and `next`. `wrote` lists each block that the stage wrote, also a small block. `next` is the entry of the next stage.
- `moreStages: true`: the script followed only the first stages. Then `hint` tells you to give a larger `--min-stage`.

The `entry` of the last stage is usually the start of the program. `nextAction` is `capture` at that entry, into `.c64-re-tools/local/capture`, with the same `--entry` and `--steps`. `hint` tells you to disassemble the code at that entry first.

Traps:

- A routine that a stage writes and calls is part of that stage when it returns to the stage.
- A program can be relocated and not packed. Then a short copier moves the code and jumps to it. The moved code is the last stage.
- The `entry` of the last stage can be code that the program writes at run time. Disassemble the entry to make sure that it is the start of the program.
- `stages` takes a `runUntil` step only with an address target without a condition. It refuses each other `runUntil` step. Use `frames` steps, or use `capture`.

### `capture <program>`

`capture` runs the program until the CPU gets to `--until` after the steps. Then it writes the memory into `--out`.

`body` holds:

- `captured`: true when the CPU got to `--until`. `pc` is that address.
- `files`: each file that the command wrote, as `{out, bytes, sha256}`. `removed` names the segment files of an earlier capture that the new `image.json` does not list.
- `segments` and `excluded`: the ranges of the segment files, and the ranges that `--exclude` removed.
- `stages`: the count of stages.
- `differsFromReset`: the count of bytes that are not as a clean C64 has them at READY.

The folder `--out` gets these files:

- `image.bin`: all 64 KiB of RAM at the entry. This RAM includes the RAM under the ROMs and the I/O area. A segment can be in the RAM under the I/O area at `$d000`-`$dfff`.
- `image.json`: the entry, the segments, the vectors and the stages. `writtenBy` of a segment tells the last stage that wrote into it.
- One PRG for each segment.
- `entry_state.json`: the registers, `$00` and `$01`, pages 0 to 3, the VIC, SID and CIA registers, and the vectors. `cia` gives the CIA timer latches and interrupt masks. `differsFromReset` lists the bytes that are not as a clean C64 has them at READY. A rebuild must make these bytes the same, because the program can read them.

A segment is a block that a stage wrote, also a small block. These blocks are not segments:

- A block that holds the entry of a later stage before the program, when no stage wrote over that entry.
- A block that a stage before the program wrote in such a block, for example a variable of a loader.
- A block that is fully in pages 0 to 3. `entry_state.json` holds these pages.

The block with the capture entry is always a segment. Segments do not overlap.

A capture into a folder with an earlier capture removes only the segment files that the new `image.json` does not list. It keeps all other files.

On `PASS`, `hint` tells you to disassemble the code at `pc`, and then to put `<out>/image.json` into the project knowledge.

Traps:

- The capture stops at the first arrival at `--until` after the steps. To capture a later arrival, add a `runUntil` step to an address after the first arrival.
- `captured: false`: the program did not get to `--until` in `--timeout-frames`. The reason tells where it stopped. Find a better address, or give more frames. If it stopped in a key wait, give `--steps` with a `type` step.

### `loads <program>`

`loads` runs a multi-load program with the steps file. Each `capture` step writes `<out>/<name>/` with `image.bin`, `image.json`, `entry_state.json` and a PRG for each segment. With `--drive`, it also writes `drive8.prg`: the drive RAM at `$0000`-`$07ff`.

A segment is a block of RAM from `$0400` that the program changed after the capture before. The first capture also has the program itself.

`body` holds:

- `loaded`: true when a capture has a segment.
- `captures`: one item for each capture step, with `capture`, `out`, `files`, `removed`, `pc`, `segments`, `excluded`, `differsFromReset`, `smallChanges` and `drive`.
  - `smallChanges`: the count of changed bytes in blocks that are smaller than `--min-block`.
  - `keyWait: true`: the CPU was in the KERNAL wait for a key, at READY or at an INPUT statement.
  - `drive`: the name of the drive file, with `--drive`.

Each `entry_state.json` has `differsFromReset`, as the one of `capture` has. A capture into a folder with an earlier capture removes the segment files and the `drive8.prg` that the new `image.json` does not list.

On `PASS`, `hint` tells you to put the `image.json` of the part that you work on into the project knowledge. With `--drive`, it also tells you to put `drive8.prg` into the project knowledge in the space `drive8`.

Traps:

- `loaded: false` and no capture has a segment: the program did not load a part, or it did not start. `keyWait: true` on a capture tells that the C64 waited for a key at READY or at an INPUT statement.

---

## Workflow

### Packed program

1. Run `inspect`. Read `packing` and the evidence.
2. Run `trace`. Read `packing`. If it is `unlikely` and the program waits for input, give the input in `--steps`.
3. Find the address where the unpacked program starts:
   - Run `stages`. Use the `entry` of the last stage.
   - Or use `runningRange.start` or `suggestedUntil` of `trace`.
   - Or set a breakpoint in the emulator after the unpack loop. Or examine the last JMP of the unpacker.
   - Disassemble the code at the address. Make sure that it is the start of the program. The start of a program often sets the stack pointer, the interrupts and the vectors.
4. Run `capture` with that address in `--until` and a folder in `--out`. Give the same `--steps` as before.
5. Make sure that the result is the program. The code at the entry must not be the unpacker again. A segment can be data that a loader or a cracktro left, for example intro graphics. Keep it until other evidence shows that the program does not use it. Then capture again with `--exclude` for that range.
   - Exclude each range of a cracktro that the program does not read. A rebuild has no cracktro. Also exclude a picture, an intro or a credit screen of a crack.
   - Do not exclude the start screen of the program, also when the program does not read it. An example is the loading picture of the publisher. Record it as the start screen in the project knowledge. The loader of the rebuild shows it.
   - Do not exclude other unused bytes, for example leftovers of the development or an old copy of a routine. A rebuild keeps them.
   - Keep a crack change that the program reads, for example a credit text in the game. Record it as a `crack` switch in the project knowledge.
6. Put `<out>/image.json` into the project knowledge. The knowledge keeps the segments, the entry, the entry state and the stages. After that, you do not need the files in `<out>`.
7. Use `--range` only when you know the area of the program.

Do not record the unpacker in the project knowledge, unless the user asks you to examine the unpacker.

### Multi-load program

1. Write a steps file. Put a `capture` step after each point where a part is in memory, for example:

   ```json
   [
     { "runUntil": { "target": { "kind": "address", "address": "$080d" }, "timeoutFrames": 6000 } },
     { "capture": "main" },
     { "type": { "mode": "text", "text": " " } },
     { "runUntil": { "target": { "kind": "address", "address": "$c000" }, "timeoutFrames": 6000 } },
     { "capture": "level1" }
   ]
   ```

2. Run `loads` with the steps file and a folder in `--out`. Add `--drive` when the program has its own drive code, for example a fast loader. Add `--exclude` for each range of a loader or of a crack that the program does not read. Do not exclude the start screen of the program.
3. Put `<out>/<name>/image.json` of the part that you work on into the project knowledge.
4. With `--drive`, put `<out>/<name>/drive8.prg` into the project knowledge in the space `drive8`. Then analyze the drive code in the space `drive8`.

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
