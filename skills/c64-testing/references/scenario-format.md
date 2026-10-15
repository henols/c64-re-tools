# Scenario format

A scenario is one JSON object in a project file.

```json
{
  "name": "player moves left",
  "original": { "program": "original/game.prg", "symbols": "knowledge" },
  "rebuild": { "program": "build/game.prg", "symbols": "build/game.json" },
  "steps": [
    { "frames": 150 },
    { "load": true },
    { "registers": { "pc": "start" } },
    { "runUntil": { "at": "main_loop" }, "timeoutFrames": 600 },
    { "joystick": { "port": 2, "direction": "left" } },
    { "frames": 10 },
    { "observe": "moved", "memory": ["player_x", { "at": "$0400", "size": 40 }], "screen": {} }
  ]
}
```

## Subjects

`original` and `rebuild` each have:

- `program`: a PRG file, relative to the project directory.
- `symbols`: where the names come from:
  - `knowledge`: the project knowledge.
  - A JSON file: the output of the c64-assembler skill, or an object of names and `$` addresses.
  - `none`: no names.

Optional: `videoStandard`, `pal` (default) or `ntsc`.

## Steps

Before the first step of each side, the script does a hard reset. The CPU stops at the reset vector. Then the script does the steps in sequence. Each step has one of these keys:

| Step | Effect |
|---|---|
| `{ "reset": "hard" }` | Reset the C64 (`hard` or `soft`). The CPU stops at the reset vector. |
| `{ "frames": 150 }` | Run for an exact number of frames, from 1 to 10000. Use it after a reset to start the C64. |
| `{ "load": true }` | Load the program of the side into memory. The CPU stays stopped. |
| `{ "autostart": true }` | Load the program of the side, type `RUN` and wait until the program runs. The program must have a BASIC start line. The keys of a later `type` step go to the program. |
| `{ "write": { "at": "seed", "bytes": [1, 2] } }` | Write bytes into memory: 1 to 4096 numbers from 0 to 255. |
| `{ "registers": { "pc": "start", "a": 0 } }` | Set registers: `pc`, `a`, `x`, `y` or `sp`. A value is a number or a name. |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. The joystick stays in this state until the next joystick step. |
| `{ "type": "RUN\n" }` | Type text on the keyboard, at most 1024 keys. The keys go into the keyboard queue of the KERNAL. A program that reads the keyboard hardware does not see them. A step cannot press one specific key of the keyboard matrix. |
| `{ "runUntil": { "at": "main_loop" }, "timeoutFrames": 600 }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "memory": { "at": "game_state", "equals": 2 } }, "timeoutFrames": 600 }` | Run until a byte in memory has a value. |
| `{ "runUntil": { "raster": 250 }, "timeoutFrames": 5 }` | Run until the raster beam gets to a line (0 to 311 for PAL, 0 to 262 for NTSC). |
| `{ "runUntil": { "at": "irq_tick", "raster": 250 }, "timeoutFrames": 600 }` | Run until the CPU gets to an address while the beam is on that line. |
| `{ "snapshot": "snapshots/start.vsf" }` | Restore a snapshot file. Usually with `side`: the snapshot of one program is not a state of the other. |
| `{ "normalize": "unpacked/entry_state.json" }` | Write pages 0 to 3 and `$00`/`$01` from an entry state file of the c64-unpacker skill. Then both sides have the same zero page, stack and KERNAL work area. |
| `{ "observe": "moved", ... }` | Record a checkpoint. |

The `port` of a joystick is 1 or 2. The `direction` is `center`, `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left` or `down-right`.

`timeoutFrames` is from 1 to 30000. A `runUntil` that does not get to its target in `timeoutFrames` frames makes the result INCONCLUSIVE.

Each step except `observe` can have `"side": "original"` or `"side": "rebuild"`. Then only that side does the step. Use it when only one side needs a step, for example a key for the intro of the original. An `observe` step has no `side`, because it compares both sides.

An address is `$` and four hex digits, or a symbol name. Each side finds a name in its own symbols.

## Observations

An `observe` step has a checkpoint name. A scenario can have each name only one time. The step can have these keys:

| Key | What the script compares |
|---|---|
| `memory` | A list of names, `$` addresses, or objects with `at`, `size` (1 to 4096, default 1), `tolerance` (0 to 255, default 0) and `exclude`. |
| `registers` | A list of register names: `pc`, `a`, `x`, `y`, `sp`, `flags`. |
| `screen` | The screen of the rebuild against the screen of the original. `maxMismatchRatio` (default 0) is the largest permitted part of different pixels. `mask` is a list of rectangles (`x`, `y`, `width`, `height`) that the comparison does not include. |
| `vicii` | The VIC-II state: mode, screen address, scroll and colors. |
| `sprites` | A list of sprite numbers from 0 to 7. The script compares their position, color and flags. |

A `tolerance` is the largest permitted difference for each byte. A `mask` has at most 64 rectangles. A `mask` must not cover all of the screen: PAL is 384×272 pixels and NTSC is 384×247 pixels. A scenario can observe the screen at most at 64 checkpoints.

`exclude` is a list of bytes in the observed range that the comparison does not include. Each has `at` and a `reason`, for example `{ "at": "$d01e", "reason": "latched sprite collision, not writable" }`. The result lists each excluded byte with its reason.

A `pc` value is an address. Compare `pc` only when both programs have the code at the same address.

## Runs

A run file (for `run.ts`) has:

- `name`: a short name.
- `start`: `{ "program": "game.prg" }` to autostart a program with a BASIC start line, `{ "program": "game.prg", "load": true }` to load it with the CPU stopped (set `pc` in a step), or `{ "snapshot": "snapshots/room0.vsf" }`.
- `symbols`: optional, `knowledge`, `none` (default), or a JSON file as for a subject.
- `videoStandard`: optional, `pal` (default) or `ntsc`.
- `steps`: the steps `write`, `registers`, `joystick`, `type`, `frames` and `runUntil` of a scenario, and the run steps `snapshot`, `save`, `screen`, `coverage` and `observe`.

A name in `save`, `screen`, `coverage` and `observe` has 1 to 64 letters, digits, dots, underscores or hyphens. The files go into the `--out` directory, with `results.json`. It has the observations, the files and the steps done. If a `runUntil` step did not reach its target, it also tells why the run stopped.

Example: visit two rooms from the same start.

```json
{
  "name": "rooms",
  "start": { "snapshot": "snapshots/room0.vsf" },
  "steps": [
    { "write": { "at": "$0350", "bytes": [1] } },
    { "frames": 50 },
    { "screen": "room1" },
    { "coverage": "room1" },
    { "snapshot": "snapshots/room0.vsf" },
    { "write": { "at": "$0350", "bytes": [2] } },
    { "frames": 50 },
    { "screen": "room2" },
    { "coverage": "room2" }
  ]
}
```

## Checks

The script checks the scenario before it starts the emulator. A step with an unknown key or a wrong value stops the script with `invalid-input`. The message names the step.
