---
name: c64-testing
description: Use this skill to test if a rebuilt or changed C64 program behaves as the original. It runs one scenario on the original and then on the rebuild in an emulator. It compares memory, registers, chip state and the screen with explicit rules, and gives PASS, FAIL or INCONCLUSIVE. It also makes a checklist for a human playtest. Use its run command to explore a program with many steps, for example to visit each room or level. A run keeps screens, coverage maps and snapshots as files. Do not use it to find the cause of a difference.
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
node <skill>/scripts/test.ts tests/moves-left.json --out results/moves-left
node <skill>/scripts/checklist.ts tests/moves-left.json --item 'FIRE starts the game.'
```

The test script prints one JSON object. The exit status is 0 for PASS, 1 for FAIL, 3 for INCONCLUSIVE and 2 for a bad call. With `--out`, a FAIL writes files into that directory: both screens and the difference image for each screen difference, and `memory.json` with each byte that differs. `files` in the result names them.

The checklist script prints a Markdown checklist for a human tester.

### Runs

A run does steps on one program, with no comparison, and keeps the results as files. Use it for many steps. One run replaces many emulator calls, for example a visit to each room of a game.

```
node <skill>/scripts/run.ts runs/rooms.json --out runs/rooms
```

The run file gives where to start (a program, or a snapshot file), the steps, and optional symbols. To go on from the live emulator, save its state with `c64_snapshot` action `save` and `out`, and start the run from that file. Besides the steps of a scenario, a run has these steps:

| Step | Effect |
|---|---|
| `{ "snapshot": "snapshots/room0.vsf" }` | Restore a snapshot file. |
| `{ "save": "room3" }` | Write the state now to `room3.vsf` in the output directory. |
| `{ "screen": "room3" }` | Write the screen to `room3.png`. |
| `{ "coverage": "room3" }` | Write the coverage map since the start or the last coverage step to `room3.bin`, then clear the map. |
| `{ "observe": "room3", "memory": ["$c100"], "registers": true }` | Record memory, registers, `vicii` or `sprites` in `results.json`. |

See [references/scenario-format.md](references/scenario-format.md), section Runs. The script prints one JSON object. The exit status is 0 when all steps ran, 1 when a step did not reach its target, and 2 for a bad call. A long run can need more time than one shell call. Then run it in the background.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Keep the results, batches and step files that you save for yourself in `.c64-re-tools/local/` of the project. Git ignores that folder.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Write the scenario file. Start the steps with a frame count, for example `{ "frames": 150 }`. Each side starts at the reset vector, and the C64 needs these frames to start.
2. Use symbol names, for example `player_x`, not fixed addresses. Each side finds the name in its own symbols. Use a `$` address only when both programs use the same address.
3. Make each checkpoint a condition, for example `runUntil` at a routine. Do not wait for a time.
4. Save the c64-assembler output of the rebuild to the symbol file, for example `build/game.json` in the project folder. From the folder above the project, write `assemble.ts --project <folder> ... > <folder>/build/game.json`.
5. Run the test script.
6. Read the result:
   - `PASS`: all observations are equal, or the differences are in the allowed tolerance.
   - `FAIL`: `differences` lists each difference with the checkpoint, the item, the original value and the rebuild value.
   - `INCONCLUSIVE`: `reason` tells why the script could not compare. This is not a failure of the program.
7. For a FAIL, examine the first difference with the c64-emulator skill.

## Knowledge

Read:
- the symbols of the original from the project knowledge.

Automatic write:
- none.

Do not store:
- test results
- screenshots
- playtest results.

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
- The two sides start differently, for example the original after a cracked intro. Give the steps that only one side needs a `side`. Then make the memory the same with a `normalize` step from the entry state of the c64-unpacker skill.
- Frame counts drift by one frame between the sides: the sides got to the same address at different raster positions. Do not sync on an IRQ handler. Sync on a value that the IRQ changes, with `runUntil` `memory`, or on an address and a raster line together.
- A byte that cannot be the same on both sides, for example a read-only collision register: use `exclude` with the reason. Do not use `exclude` to hide a real difference.

Do not add a mask or a tolerance only to make a test pass. A tolerance must have a reason in the behavior of the program.

## Handoffs

- Find the cause of a difference → c64-emulator
- Find the code that causes it → c64-static-analysis
- Rebuild after a correction → c64-assembler
- Record a confirmed conclusion → c64-knowledge
