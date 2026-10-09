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
| `{ "autostart": true }` | Load and start the program of the side as VICE autostart does. |
| `{ "write": { "at": "seed", "bytes": [1, 2] } }` | Write bytes into memory: 1 to 4096 numbers from 0 to 255. |
| `{ "registers": { "pc": "start", "a": 0 } }` | Set registers: `pc`, `a`, `x`, `y` or `sp`. A value is a number or a name. |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. The joystick stays in this state until the next joystick step. |
| `{ "type": "RUN\n" }` | Type text on the keyboard, at most 1024 keys. |
| `{ "runUntil": { "at": "main_loop" }, "timeoutFrames": 600 }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "memory": { "at": "game_state", "equals": 2 } }, "timeoutFrames": 600 }` | Run until a byte in memory has a value. |
| `{ "observe": "moved", ... }` | Record a checkpoint. |

The `port` of a joystick is 1 or 2. The `direction` is `center`, `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left` or `down-right`.

`timeoutFrames` is from 1 to 30000. A `runUntil` that does not get to its target in `timeoutFrames` frames makes the result INCONCLUSIVE.

An address is `$` and four hex digits, or a symbol name. Each side finds a name in its own symbols.

## Observations

An `observe` step has a checkpoint name. A scenario can have each name only one time. The step can have these keys:

| Key | What the script compares |
|---|---|
| `memory` | A list of names, `$` addresses, or objects with `at`, `size` (1 to 4096, default 1) and `tolerance` (0 to 255, default 0). |
| `registers` | A list of register names: `pc`, `a`, `x`, `y`, `sp`, `flags`. |
| `screen` | The screen of the rebuild against the screen of the original. `maxMismatchRatio` (default 0) is the largest permitted part of different pixels. `mask` is a list of rectangles (`x`, `y`, `width`, `height`) that the comparison does not include. |
| `vicii` | The VIC-II state: mode, screen address, scroll and colors. |
| `sprites` | A list of sprite numbers from 0 to 7. The script compares their position, color and flags. |

A `tolerance` is the largest permitted difference for each byte. A `mask` has at most 64 rectangles. A scenario can observe the screen at most at 64 checkpoints.

A `pc` value is an address. Compare `pc` only when both programs have the code at the same address.

## Checks

The script checks the scenario before it starts the emulator. A step with an unknown key or a wrong value stops the script with `invalid-input`. The message names the step.
