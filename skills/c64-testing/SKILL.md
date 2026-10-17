---
name: c64-testing
description: Use this skill to test if a rebuilt or changed C64 program behaves as the original. It runs one scenario on the original and then on the rebuild in an emulator. It compares memory, registers, chip state and the screen with explicit rules, and gives PASS, FAIL or INCONCLUSIVE. It also makes a checklist for a human playtest. Use its run command to explore a program with many steps, for example to visit each room or level. A run keeps screens, coverage maps and snapshots as files. Use its record and replay commands to keep a long play session of the original and replay it on each rebuild. Do not use it to find the cause of a difference.
---

# c64-testing

## Purpose

Test if a rebuild or a changed program behaves as the original in a scenario. Give one result: PASS, FAIL or INCONCLUSIVE.

A PASS proves only the behavior that the scenario does and observes. It does not prove that the two programs are equal in all behavior.

## Inputs

- The original program and the rebuild: PRG files in the project.
- The symbols of each side. For the original, the project knowledge. For the rebuild, the JSON output of the c64-assembler skill in a file.
- A scenario file: the steps, the checkpoints and the observations. See [references/scenario-format.md](references/scenario-format.md).

## Tools / execution path

The script starts one emulator through the host runtime. It runs the scenario on the original and then on the rebuild. Before each side, it does a hard reset of the emulator. The CPU then stops at the reset vector.

```
node <skill>/scripts/test.ts tests/moves-left.json --out .c64-re-tools/local/results/moves-left
node <skill>/scripts/checklist.ts tests/moves-left.json --item 'FIRE starts the game.'
```

The test script prints one JSON object. The exit status is 0 for PASS, 1 for FAIL, 3 for INCONCLUSIVE and 2 for a bad call. With `--out`, a FAIL writes files into that directory: both screens and the difference image for each screen difference, and `memory.json` with each byte that differs. `files` in the result names them. A PASS writes no files. To keep the screens of a PASS, use a run (below).

The checklist script prints a Markdown checklist for a human tester.

### Runs

A run does steps on one program, with no comparison, and keeps the results as files. Use it for many steps. One run replaces many emulator calls, for example a visit to each room of a game.

```
node <skill>/scripts/run.ts .c64-re-tools/local/runs/rooms/run.json --out .c64-re-tools/local/runs/rooms
```

The run file gives where to start (a program, or a snapshot file), the steps, and optional symbols. To go on from the live emulator, save its state with `c64_snapshot` action `save` and `out`, and start the run from that file. Besides the steps of a scenario, a run has these steps:

| Step | Effect |
|---|---|
| `{ "snapshot": ".c64-re-tools/local/snapshots/room0.vsf" }` | Restore a snapshot file. |
| `{ "save": "room3" }` | Write the state now to `room3.vsf` in the output directory. |
| `{ "screen": "room3" }` | Write the screen to `room3.png`. |
| `{ "coverage": "room3" }` | Write the coverage map since the start or the last coverage step to `room3.bin`, then clear the map. Add the map to the knowledge with `coverage` of the c64-knowledge skill. |
| `{ "observe": "room3", "memory": ["$c100"], "registers": true }` | Record memory, registers, `vicii` or `sprites` in `results.json`. |
| `{ "trace": "d011", "points": [{ "kind": "write", "at": "$d011" }], "frames": 100 }` | Record each hit of the points for 100 frames in `d011.json`: the instruction, its registers and the raster line and cycle. A point is `exec`, `read` or `write`, at an address or a name, with an optional `end`. `maxHits` limits the hits. |
| `{ "observe": "all3", "memory": "all" }` | Write all 64 KiB of RAM to `all3.bin`, also the RAM under the ROMs and the I/O area. |

A memory item can have `"view": "ram"`. Then it reads the RAM under the ROMs and the I/O area, for example code at `$e000` under the KERNAL. The default view `cpu` reads as the CPU sees memory. An item larger than 4096 bytes goes into its own `.bin` file, and `results.json` gives the file name.

See [references/scenario-format.md](references/scenario-format.md), section Runs. The script prints one JSON object. The exit status is 0 when all steps ran, 1 when a step did not reach its target, and 2 for a bad call. A long run can need more time than one shell call. Then run it in the background.

### Recordings

A recording keeps a session of the original program, for example a play through some rooms of a game. A replay gives the same input to a rebuild and compares the game state. Make the recordings early, before you change the program. A recording needs no names. Its coverage also helps the static analysis.

The record and replay scripts run the replay core `c64run` on this machine, not the emulator of the host runtime. The replay core has no disk drive. The program must be a PRG file.

Ask the user to play first. Tell the user which parts of the program the recordings must have, for example each room, a fight and a lost life. Make a scripted recording only for a part that the sessions of the user do not have, or when the user cannot play.

```
node <skill>/scripts/record.ts tests/record/start.json --out tests/recordings/play1 --play --joystick 1
```

- With `--play`, a person plays the program after the steps of the record file. The steps can start the program, for example a key for an intro.
- The script writes the address of a page to stderr. Give the address to the user. In a dev container, the port of the page (default 6465) must be forwarded.
- On the page, the arrow keys, space and a gamepad move the joystick of `--joystick` (default 2). The other keys go to the C64 keyboard.
- The script runs until the user clicks Stop on the page. Run it in the background. Then it writes the recording folder.

A scripted recording has only steps. See [references/recording-format.md](references/recording-format.md). The steps are `frames`, `joystick`, `type`, `write`, `registers` and `runUntil` with `at` or `memory`.

```
node <skill>/scripts/record.ts tests/record/rooms.json --out tests/recordings/rooms
node <skill>/scripts/replay.ts tests/recordings/rooms --checkpoint main_loop --state room --state lives --pin random_ptr:2 --rebuild build/game.prg --symbols build/game.json
```

- The record script writes the recording folder. The exit status is 0 when it recorded the session, 1 when the session did not complete, and 2 for a bad call. `executed` gives the instructions in the coverage map.
- The replay script first replays the recording on the original. The original must end the session with the recorded state. Then the script replays the recording on the rebuild and compares the state at each checkpoint.
- `--checkpoint` gives a routine, and `--state` gives each memory item to compare. Use the names that the knowledge has at the time of the replay. A `$` address is an address of the original. On the rebuild, it moves with the name before it.
- The replay script gives PASS, FAIL or INCONCLUSIVE, with the exit status 0, 1 or 3. A FAIL gives the first checkpoint that is different and the state items that are different.
- With `--out`, a FAIL writes the RAM of the two sides at that checkpoint. Compare the two files with `diff.ts`.
- Without `--rebuild`, the replay script only replays the recording on the original.

A checkpoint is one entry of a routine. Use a routine that the program executes one time in each pass of its game logic, for example the main loop. Do not use an interrupt handler.

The input is the reads of the joystick ports and the keyboard matrix. It is also the reads of the four SID registers that a program can read: the paddles, the noise of voice 3 and its envelope. It is also the reads of `$DE00`-`$DFFF`, where a C64 without a cartridge gives the last byte on the bus. On a replay, the n-th read of each instruction gets the value of the n-th read in the recording. Thus a rebuild with different timing gets the same input and the same SID random numbers. A `write`, `registers` or `runUntil` step is not input. The replay does the step again at the same read of the program.

A replay is deterministic. The replay core has no random source and no clock: the same recording gives the same session, to the cycle. Sometimes the recording has no value for a read of an input. Then the read gets a fixed value: `$FF` for the joystick, keyboard and paddle registers, `$00` for the others. `idleReads` in the result counts these reads on the rebuild. On the original, such a read makes the result INCONCLUSIVE.

Control each source of random numbers:

- A program that reads a seed from the SID gets the recorded value. You do not need to do more.
- A program that reads a seed from the raster line or a CIA timer: add the address to `inputs` of the record file. Do this only when the program does not wait in a loop on that address.
- A program that keeps its random state in RAM: give that state with `--pin`. An example is a pointer into a random table that moves each frame. At each checkpoint, the rebuild gets the values of the original there. A FAIL where an enemy or an event is different, but the input is the same, often shows that a pin is missing.

Put a `runUntil` step with the checkpoint routine before a `registers` step. A `registers` step that sets the pc during an interrupt stops the program.

Commit the recording folder with the scenarios. A recording is not knowledge.

### Differences

```
node <skill>/scripts/diff.ts .c64-re-tools/local/runs/rooms/before.vsf .c64-re-tools/local/runs/rooms/after.vsf
node <skill>/scripts/diff.ts .c64-re-tools/local/runs/rooms/results.json:room0 .c64-re-tools/local/runs/rooms/results.json:room3
```

`diff.ts` tells what changed between two states of one kind. Use it in place of your own compare script.

- Two snapshot files: the script restores each one in its own emulator. It gives the changed ranges of the RAM and of the colour RAM, and the changed VIC-II, CIA, SID and CPU registers.
- Two memory files of a run: the changed ranges. For a file of less than 64 KiB, `--at` gives the address of its first byte.
- Two observations of runs, also of one run: the changed memory items and registers.

`--gap N` joins ranges across N equal bytes. `--out` writes all ranges to a project file.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence` of c64-knowledge. `--evidence` refuses a file in `.c64-re-tools/local/`.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Write the scenario file. Start the steps with a frame count, for example `{ "frames": 150 }`. Each side starts at the reset vector, and the C64 needs these frames to start.
2. Use symbol names, for example `player_x`, not fixed addresses. Each side finds the name in its own symbols. Use a `$` address only when both programs use the same address.
3. Make each checkpoint a condition, for example `runUntil` at a routine. Do not wait for a time.
4. Save the c64-assembler output of the rebuild to the symbol file, for example `build/game.json` in the project folder. Give `--all-symbols`, so that the file also has the constants that the source does not use. From the folder above the project, write `assemble.ts --project <folder> ... > <folder>/build/game.json`.
5. Run the test script.
6. Read the result:
   - `PASS`: all observations are equal, or the differences are in the allowed tolerance.
   - `FAIL`: `differences` lists each difference with the checkpoint, the item, the original value and the rebuild value.
   - Each value has one form. The pc and each address are `$xxxx`. Memory is lowercase hex. Other register values and chip values are decimal numbers.
   - `INCONCLUSIVE`: `reason` tells why the script could not compare. This is not a failure of the program.
7. For a FAIL, examine the first difference with the c64-emulator skill.

## Knowledge

Read:
- the symbols of the original from the project knowledge.

Automatic write:
- none.

Write with c64-knowledge:
- the coverage of a recording: `knowledge.ts coverage tests/recordings/<name>/coverage.bin`.
- a finding that a recording shows, with `--evidence test:tests/recordings/<name>/recording.json`.

Do not store:
- test results
- screenshots
- playtest results
- recordings.

## Result

PASS, FAIL or INCONCLUSIVE, the checkpoints and the smallest differences that explain a FAIL.

## Failure and conflicts

- `invalid-input`: the scenario file has an error. The message names the step. Change the step and run the test again.
- INCONCLUSIVE, "did not reach the checkpoint": one side did not reach the checkpoint in the frame limit. Find the reason with the c64-emulator skill. Do not report a FAIL.
- INCONCLUSIVE, "has no symbol": one side has no symbol with that name. Add the name to the knowledge or to the rebuild source.
- INCONCLUSIVE, "no emulator" or "could not run": the host runtime or the emulator failed. Tell the user the message.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- A FAIL with only a `screen` difference: add `vicii` or `sprites` to the observation to find which chip state is different.
- A program that uses random numbers: set the random seed with a `write` step on both sides. If that is not possible, observe only values that do not depend on the random numbers.
- The two sides start differently, for example the original after a cracked intro. Give the steps that only one side needs a `side`. Then make the memory the same with a `normalize` step. It writes the entry state of the capture in the knowledge.
- Frame counts drift by one frame between the sides: the sides got to the same address at different raster positions. Do not sync on an IRQ handler. Sync on a value that the IRQ changes, with `runUntil` `memory`, or on an address and a raster line together.
- INCONCLUSIVE, "does not reproduce": the original does not end the session with the recorded state. Record the session again with this `c64run`.
- INCONCLUSIVE, "never came to the checkpoint": the original did not execute the checkpoint routine in the session. Give another routine.
- INCONCLUSIVE, "is not the program of the recording": the program file changed after the recording. Record the session again.
- A record result with `recorded` false: a step did not reach its target. Change the step.
- A record result with `executed` 0: the program never read its input from RAM, so the coverage map is empty. The recording can still replay.
- A FAIL from a replay: compare the two RAM files of `--out` with `diff.ts`. Then examine the first different state item with the c64-emulator skill.
- A program that loads more files from a disk: the replay core has no disk drive. Use a test scenario in the emulator.
- A byte that cannot be the same on both sides, for example a read-only collision register: use `exclude` with the reason. Do not use `exclude` to hide a real difference.

Do not add a mask or a tolerance only to make a test pass. A tolerance must have a reason in the behavior of the program.

## Handoffs

- Find the cause of a difference → c64-emulator
- Find the code that causes it → c64-static-analysis
- Rebuild after a correction → c64-assembler
- Record a confirmed conclusion → c64-knowledge
