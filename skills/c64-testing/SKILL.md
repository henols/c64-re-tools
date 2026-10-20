---
name: c64-testing
description: Tests if a rebuilt or changed C64 program behaves as the original, or if a program has the expected values. It runs a scenario on the original and on the rebuild in an emulator. It compares memory, registers, chip state and the screen with explicit rules, and gives PASS, FAIL or INCONCLUSIVE. Use it when you must show that a rebuild or a correction keeps the behavior of the original. Use it to do many steps on one program and keep the screens, coverage maps, traces and snapshots as files. Use it to test a new program or a correction with expected values. Use it to record a play session of the original and replay it on each rebuild. Use it to find what changed between two machine states, and to make a checklist for a human playtest. It does not find the cause of a difference. It does not build the program.
---

# C64 testing

Use this script to test a rebuild or a changed C64 program against the original, or against expected values.
Use only the commands of the script. Do not compare machine states or replay play sessions in another way.

```bash
node <skill>/scripts/testing.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `test tests/moves-left.json`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Compare the rebuild with the original in a scenario | `test tests/moves-left.json` |
| Keep the screens and all differing bytes of a FAIL | `test tests/moves-left.json --out .c64-re-tools/local/results/moves-left` |
| Do many steps on one program and keep the results as files | `run .c64-re-tools/local/runs/rooms/run.json --out .c64-re-tools/local/runs/rooms` |
| Test a new program or a correction with expected values | `run tests/title.json --out .c64-re-tools/local/runs/title` |
| Record a play session of a person on the original | `record tests/record/start.json --out tests/recordings/play1 --play --joystick 1` |
| Record a session from steps only | `record tests/record/rooms.json --out tests/recordings/rooms` |
| Make sure that a recording replays on the original | `replay tests/recordings/rooms` |
| Compare the rebuild with a recording | `replay tests/recordings/rooms --checkpoint main_loop --state room --state lives --pin random_ptr:2 --rebuild build/game.prg --symbols build/game.json --out .c64-re-tools/local/results/rooms` |
| Find what changed between two snapshot files | `diff .c64-re-tools/local/runs/rooms/before.vsf .c64-re-tools/local/runs/rooms/after.vsf` |
| Find what changed between two observations of runs | `diff .c64-re-tools/local/runs/rooms/results.json:room0 .c64-re-tools/local/runs/rooms/results.json:room3` |
| Find what changed between two memory files of runs | `diff .c64-re-tools/local/runs/a/all.bin .c64-re-tools/local/runs/b/all.bin --gap 4` |
| Make a checklist for a human playtest | `checklist tests/moves-left.json --item 'FIRE starts the game.'` |

## Programs, files and names

- The original program and the rebuild are PRG files in the project. The script refuses a disk, tape or cartridge image. Extract the program file from the image first.
- The original gets its names from the project knowledge. Give `"symbols": "knowledge"` for the original.
- The rebuild gets its names from the symbol file of its build. Build the rebuild with a symbol file that has all symbols, also the constants that the source does not use.
- You write the scenario file, the run file and the record file. Their formats are in the files of the section "Reference".
- `<recording>` is the `--out` folder of `record`.
- `--checkpoint` is a routine that the program executes one time in each pass of its game logic, for example the main loop. Do not use an interrupt handler. Get the name from the project knowledge.
- `--state` and `--pin` take a name or a `$` address, with `:size` for more than one byte, for example `room:2`. Use the names that the project knowledge has at the time of the replay.
- The joystick port of `--joystick` is the port that the program reads. Port 2 is `$DC00`, and port 1 is `$DC01`. Find the port in the code or in the project knowledge. If you do not know the port, use 2.
- `diff` takes two states of one kind. A state is a snapshot file (`.vsf`), a memory file (`.bin`) of a run, or an observation of a run (`results.json:<name>`). A `save` step of a run writes a snapshot file. A snapshot save in the emulator also writes one.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/` and the index of the knowledge. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses evidence in that folder.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--out <dir>` | `test` | With a FAIL, write the files of the differences into this folder. No folder by default. |
| `--max-listed <n>` | `test` | List at most n differing bytes of each memory item. The default is 50. The count is always in the body. |
| `--out <dir>` | `run` | The folder for the files of the steps and `results.json`. Required. |
| `--out <dir>` | `record` | The recording folder, for example `tests/recordings/<name>`. Required. |
| `--play` | `record` | A person plays after the steps. Off by default. |
| `--joystick <1\|2>` | `record` | With `--play`: the joystick port at the start. The default is 2. |
| `--http-port <n>` | `record` | With `--play`: the port of the page. The default is 6465. |
| `--checkpoint <routine>` | `replay` | The routine of the checkpoints. Each entry of the routine is a checkpoint. The default is the comparison of the record file. |
| `--state <item>` | `replay` | A memory item to compare at each checkpoint. Give it again for each item. |
| `--pin <item>` | `replay` | Random state in RAM. At each checkpoint, the rebuild gets the values of the original there. Give it again for each item. |
| `--rebuild <prg>` | `replay` | The rebuild to compare with the original. Without it, the script replays only on the original. |
| `--symbols <file>` | `replay` | The symbol file of the rebuild. The default is the symbols of the recording. |
| `--out <dir>` | `replay` | With a FAIL, write the RAM of each side at the first different checkpoint into this folder. |
| `--gap <n>` | `diff` | Join changed ranges across at most n equal bytes. The default is 0. |
| `--max-listed <n>` | `diff` | List at most n items of each list. The default is 50. |
| `--ntsc` | `diff` | The snapshot files are of an NTSC machine. The default is PAL. |
| `--address <address>` | `diff` | The address of the first byte of a memory file of less than 64 KiB. The default is `$0000`. |
| `--out <file>` | `diff` | Also write all ranges and all changed registers to this file. |
| `--item <text>` | `checklist` | A line for this program. Give it again for each line. |

---

## Compare and run

### `test <scenario.json>`

The script runs the scenario on the original and then on the rebuild. Before each side, it does a hard reset. The CPU then stops at the reset vector.
Before the test starts, the script examines the scenario and each file that it names. The section "Checks" of `references/scenario-format.md` gives each refusal.

`body` holds:

- `result`: `PASS`, `FAIL` or `INCONCLUSIVE`.
- `checkpoints`: the names of the checkpoints.
- `differences`: with a FAIL, each difference with its `checkpoint` and the item in `what`.
  - A memory item gives `bytes`. `bytes.count` is the number of differing bytes. `bytes.listed` gives the first bytes, each with `address`, `original` and `rebuild`.
  - Another item gives the `original` value and the `rebuild` value.
- `excluded`: each byte that an `exclude` left out of the comparison, with its `reason`.
- `files`: with `--out` and a FAIL, the files that the script wrote. These are both screens and the difference image for each screen difference. `memory.json` has all bytes of each memory item that differs, and each byte that differs.
- `reason`: with an INCONCLUSIVE, why the script could not compare.

The pc and each address are `$xxxx`. Memory is lowercase hex. Other register values and chip values are decimal numbers.

Do this for each result:

- `PASS`: all observations are equal, or the differences are in the allowed tolerance. A PASS proves only the behavior that the scenario does and observes. A PASS writes no files. To keep the screens of a PASS, do a run.
- `FAIL`: `hint` tells you to examine the first difference in the emulator at its checkpoint. Without `--out`, `hint` also tells you to give `--out`.
- `INCONCLUSIVE`: this is not a failure of the program. Do not report a FAIL. `hint` tells you to correct the cause. Then run `test` again. `reason` gives the cause:
  - `step N (kind): ...`: the step failed on one side.
  - "did not reach the checkpoint": one side did not get to the checkpoint in the frame limit. Find the reason in the emulator.
  - "has no symbol": one side has no symbol with that name. Add the name to the project knowledge or to the source of the rebuild.
  - "no emulator" or "could not run": the emulator failed. Give `reason` to the user.

Traps:

- A FAIL with only a `screen` difference: add `vicii` or `sprites` to the observation. Then you find the chip state that is different.
- A program that uses random numbers: set the random seed with a `write` step on both sides. If you cannot set it, observe only values that do not depend on the random numbers.
- The two sides start differently, for example the original after a cracked intro. Give a `side` to the steps that only one side needs. Then make the memory the same with a `normalize` step.
- `normalize` needs the entry state of a capture in the project knowledge. If the knowledge has no capture, the script refuses. Then capture the unpacked program at its entry point, and put the capture image into the project knowledge.
- The frame counts of the sides are different by one frame. The sides got to the same address at different raster positions. Do not synchronize on an interrupt handler. Synchronize on a value that the interrupt changes, with a `runUntil` step with a `memory` target. Or use an `address` target with a `raster` condition.
- A byte cannot be the same on both sides, for example a read-only collision register. Use `exclude` with the reason. Do not use `exclude` to hide a real difference.
- Do not add a mask or a tolerance only to make a test pass. A tolerance must have a reason in the behavior of the program.
- `invalid-input` or `not-found` that names a step or a file: correct the scenario file or the file as `hint` tells. Then run `test` again.

### `run <run.json>`

The script does the steps of the run file on one program, with no comparison. It writes the files of the steps and `results.json` into `--out`. One run replaces many emulator calls, for example a visit to each room of a game.
The run starts from a program or from a snapshot file. To continue from the state of the emulator, save that state to a snapshot file in the emulator. Then start the run from that file.
Before the run starts, the script examines the run file, each file that it names and each name of the steps. The section "Checks" of `references/scenario-format.md` gives each refusal.

`body` holds:

- `result`: `PASS` when all steps ran and each `expect` step passed. Else `FAIL`.
- `completed`, `steps` and `done`: if the run completed, the number of steps, and the number of steps that ran.
- `reason`: why a step did not run.
- `pc`: the pc at the end of the run.
- `files`: each file that the run wrote.
- `observations`: the names of the observations. `results.json` in `--out` has their values.
- `expectations`: for each `expect` step, `pass`, `count` and at most 16 `mismatches` with the expected and the actual value.
- `failedExpectations`: the names of the `expect` steps that did not pass.
- `traces`: for each `trace` step, its file, the count of hits, the frames and why the trace ended.

With a FAIL, `hint` tells you to read `reason` or `failedExpectations`. A value that is not equal does not stop the run.

Traps:

- A long run can need more time than one shell call. Then run the command in the background.
- Add each coverage map of a run to the project knowledge as coverage.

---

## Recordings

A recording keeps a session of the original program, for example a play through some rooms of a game. A replay gives the same input to a rebuild and compares the game state. A recording needs no names.

- Make the recordings early, before you change the program.
- Ask the user to play first. Tell the user which parts of the program the recordings must have, for example each room, a fight and a lost life.
- Record a session from steps only for a part that the sessions of the user do not have, or when the user cannot play.
- Commit the recording folder with the scenarios. Do not put a recording into the project knowledge. Do not put test results, screenshots or playtest results into it.
- A finding that a recording shows can go into the project knowledge. Give the `recording.json` of the recording as its test evidence.
- The C64 of a recording has no disk drive. For a program that loads more files from a disk, use a scenario with `test`.
- The emulator cannot examine the C64 of a recording or a replay.

A replay is deterministic. The same recording gives the same session, to the cycle. The n-th read of an input at each instruction gets the value of the n-th read in the recording. Thus a rebuild with different timing gets the same input, also the same random values from the SID.

Control each source of random numbers:

- A program that reads a seed from the SID gets the recorded value. You do not need to do more.
- A program that reads a seed from the raster line or a CIA timer: add the address to `inputs` of the record file. Do this only when the program does not wait in a loop on that address.
- A program that keeps its random state in RAM: give that state with `--pin` of `replay`. An example is a pointer into a random table that moves each frame.

### `record <record.json>`

The script does the steps of the record file on the original program. Then it writes the recording folder into `--out`: `recording.json`, `reads.txt` and `coverage.bin`. The program must be a PRG file.

`body` holds:

- `result`: `PASS` when the script recorded the session. `FAIL` when the session did not complete.
- `recorded`: `true` or `false`.
- `out` and `files`: the recording folder and its files.
- `frames`, `inputSites` and `events`: the length of the session, the number of instructions that read input, and the number of events.
- `executed`: the number of instructions in the coverage map.
- `coverageFrom`: the `frame` and the `pc` where the coverage map starts. `null` when the coverage did not start.
- `reason`: with a FAIL, why the session did not complete.

Do this for each result:

- `PASS`: `hint` tells you to commit the folder and to add its `coverage.bin` to the project knowledge as coverage. `nextAction` replays the recording on the original. Run it to make sure that the recording replays.
- `FAIL` after a cancel on the page: `hint` tells you to ask the user what to do. Do not record a session from steps in place of the session of the user.
- Another `FAIL`: `reason` names the step that did not complete. Examples are a `runUntil` step that did not get to its target, and a `type` step with too many keys. Change the step, then run `record` again.
- `coverageFrom` is `null` and `executed` is 0: the coverage did not start, so the coverage map is empty. The recording can still replay.

With `--play`, a person plays the program after the steps. The steps can start the program, for example a key for an intro.

- The script writes the address of a page to stderr. Give the address to the user.
- The page shows the screen after the steps. The C64 is frozen until the user pushes Enter or clicks Start. Tell the user to read the screen first.
- Tell the user that F9 changes the joystick port.
- The page has the full C64 keyboard and the joystick. F10 changes the arrow keys and space between the joystick and the C64 keys. A gamepad is always the joystick. The key maps are in `references/recording-format.md`.
- End (F12) stops the C64 and freezes the screen. Then the script writes the recording folder. Run the command in the background.
- Cancel (F11) stops the session. The script writes no folder.

Traps:

- By default, the coverage map starts at the first input read of code in RAM. The start-up code of the program ran before that point, and it has no marks in the map. Do not think that this code did not run. To include it, give `"coverage": "start"` or a `$` address in the record file.
- Put a `runUntil` step with the checkpoint routine before a `registers` step. A `registers` step that sets the pc during an interrupt stops the program.
- A record file has no `raster` target and no `condition`. The script refuses them.

### `replay <recording>`

The script first replays the recording on the original. The original must end the session with the recorded state. With `--rebuild`, the script then replays the recording on the rebuild and compares the state at each checkpoint. Without `--rebuild`, it replays only on the original.

`--checkpoint` and `--state` go together. `--pin` needs both of them. `--symbols` needs `--rebuild`. Give at most 16 `--state` and `--pin` items. Without `--checkpoint`, the script uses the comparison of the record file.
A `$` address is an address of the original. On the rebuild, it moves with the name before it.

`body` holds `result`, `side`, `firstDifference`, `reason` and `files`. The section "Replay" of `references/recording-format.md` gives each field.

Do this for each result:

- `PASS`: each checkpoint of the rebuild has the state of the original. Without `--rebuild`, the recording replays on the original.
- `FAIL` with `--out`: `files` has the RAM of each side at the first different checkpoint. `nextAction` compares the two files with `diff`. Then examine the first different state item in the emulator.
- `FAIL` without `--out`: `hint` tells you to give `--out`. A FAIL where an enemy or an event is different, but the input is the same, often shows that a `--pin` is missing.
- `FAIL` with no `firstDifference`: the rebuild did not get to all checkpoints. `reason` gives the number. Examine the rebuild in the emulator after its last checkpoint.
- `INCONCLUSIVE`: `reason` gives the cause:
  - "does not reproduce": the original does not end the session with the recorded state. Record the session again.
  - "never came to the checkpoint": the original did not execute the checkpoint routine in the session. Give another routine.
  - "is not the program of the recording": the program file changed after the recording. Record the session again.

Traps:

- `idleReads` counts the input reads of the rebuild that the recording had no value for. On the original, such a read makes the result INCONCLUSIVE.
- The script refuses a recording of version 2.0 with `invalid-input`. Record the session again.

---

## Other commands

### `diff <a> <b>`

The script tells what changed between two states of one kind. Use it in place of your own compare script.

`body` holds `a` and `b`, and the parts that apply to the kind of state:

- `memory`: the changed ranges of the RAM. `changedBytes` is the number of changed bytes. Each range in `listed` has `start`, `end`, and the bytes `a` and `b`.
- `colorRam`: with two snapshot files, the changed ranges of the colour RAM.
- `registers`: each changed register and chip value, with `name`, `a` and `b`. `cpu.pc` is a `$` address. Each CPU flag is `cpu.flags.<flag>`, for example `cpu.flags.c`, with `true` or `false`.
- `observed`: with two observations, each changed memory item.
- `compared`: with two observations, the count of items that both observations have. With `compared: 0`, `reason` tells what each observation has. Then the diff compared nothing, and the observations are not equal.
- `out`, `bytes` and `sha256`: with `--out`, the file. It uses the field names of the body.

Traps:

- With two snapshot files, `$00` and `$01` are the CPU port of the snapshot: the direction register and the data register. They are not the RAM under the port.
- `--ntsc` is only for snapshot files. `--address` is only for memory files. The script refuses them for the other kinds.
- The script refuses a snapshot file that does not restore. An example is a PAL snapshot with `--ntsc`. Give `--ntsc` only for snapshots of an NTSC machine.

### `checklist <scenario.json>...`

The script makes a checklist for a human tester. `body.text` is the checklist in Markdown. It has a line for each checkpoint of the scenarios, each `--item`, and the behavior that only a person can judge.
Give the checklist to the human tester. Do not put the results of the playtest into the project knowledge.

---

## Workflow

1. Write the scenario file. Start the steps with a frame count, for example `{ "frames": 150 }`. Each side starts at the reset vector, and the C64 needs these frames to start.
2. Use symbol names, for example `player_x`, not `$` addresses. Each side finds the name in its own symbols. Use a `$` address only when both programs use the same address.
3. Make each checkpoint a condition, for example a `runUntil` step with an `address` target at a routine. Do not wait for a time.
4. Build the rebuild with a symbol file that has all symbols.
5. Run `test`.
6. Read `body.result`, and do the action of the section of `test`.
7. For a FAIL, examine the first difference in the emulator. Find the code that causes the difference.
8. After a correction, build the rebuild again. Then run `test` again.
9. Record each conclusion that a test proves in the project knowledge.

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

---

## Reference

- `references/scenario-format.md`: the scenario file of `test` and the run file of `run`. It gives each step, each observation, the expected values, and the checks before a test or a run.
- `references/recording-format.md`: the record file of `record`, the play page and its key maps, and the files of a recording folder. It also gives the fields of the body of `replay`.
