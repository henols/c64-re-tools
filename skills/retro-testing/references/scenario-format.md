# Scenario format

This file gives the format of a scenario file and of a run file. For the commands, see the sections ``### `test <scenario.json>` `` and ``### `run <run.json>` `` of `SKILL.md`.

A scenario is one JSON object in a project file.

```json
{
  "name": "player moves left",
  "original": { "program": "original/game.prg", "symbols": "knowledge" },
  "rebuild": { "program": "build/clean.prg", "symbols": "build/symbols/clean.json" },
  "steps": [
    { "frames": 150 },
    { "load": true },
    { "registers": { "pc": "start" } },
    { "runUntil": { "target": { "kind": "address", "address": "main_loop" }, "timeoutFrames": 600 } },
    { "joystick": { "port": 2, "direction": "left" } },
    { "frames": 10 },
    { "observe": "moved", "memory": ["player_x", { "address": "$0400", "size": 40 }], "screen": {} }
  ]
}
```

## Subjects

`original` and `rebuild` each have:

- `program`: a PRG file, relative to the project folder.
- `symbols`: where the names come from:
  - `knowledge`: the project knowledge.
  - A JSON file: the symbol file of a build, or an object of names and `$` addresses.
  - `none`: no names.

Optional: `videoStandard`, `pal` (default) or `ntsc`.

## Steps

Before the first step of each side, the script does a hard reset. The CPU stops at the reset vector. Then the script does the steps in sequence. Each step has one of these keys:

| Step | Effect |
|---|---|
| `{ "reset": "hard" }` | Reset the C64 (`hard` or `soft`). The CPU stops at the reset vector. |
| `{ "frames": 150 }` | Run for an exact number of frames, from 1 to 30000. A breakpoint or a watchpoint stops it before that. Use it after a reset to start the C64. |
| `{ "load": true }` | Load the program of the side into memory. The CPU stays stopped. |
| `{ "autostart": true }` | Load the program of the side, type `RUN` and wait until the program runs. The program must have a BASIC start line. The keys of a later `type` step go to the program. |
| `{ "write": { "address": "seed", "data": "0102" } }` | Write 1 to 4096 bytes into memory. Optional: `space` (`c64` or `drive8`, default `c64`) and `view` (`cpu` or `ram`, default `cpu`). |
| `{ "registers": { "pc": "start", "a": 0, "flags": { "i": true } } }` | Set registers: `pc`, `a`, `x`, `y`, `sp` and `flags` (`n`, `v`, `b`, `d`, `i`, `z`, `c`). Only `pc` can be a name. |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. `fire` is `false` by default. The joystick stays in this state until the next joystick step. |
| `{ "type": { "mode": "text", "text": "RUN\n" } }` | Put at most 1024 keys into the keyboard queue of the KERNAL. A program that reads the keyboard hardware does not see them. Use `press` for that program. |
| `{ "type": { "mode": "petscii", "bytes": [147] } }` | Put PETSCII codes from 1 to 255 into the keyboard queue of the KERNAL. Use it for keys that mode `text` does not have. |
| `{ "press": { "keys": "{F1}" } }` | Press keys of the keyboard matrix and RESTORE. A program that reads the keyboard hardware sees them. Each tap holds its keys for 3 frames, then releases them for 3 frames. Optional: `frames` from 1 to 3000. The keys are the same as the keys of a `press` step of a record file. |
| `{ "runUntil": { "target": { "kind": "address", "address": "main_loop" }, "timeoutFrames": 600 } }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "target": { "kind": "memory", "address": "game_state", "operator": "eq", "value": 2 }, "timeoutFrames": 600 } }` | Run until a write to the byte makes the comparison with `value` true. `operator` is `eq`, `ne`, `lt`, `lte`, `gt` or `gte`. The run does not stop for a byte that is already true at the start. It also does not stop for a register that the hardware changes, for example `$d012`. For a raster line, use a `raster` target. |
| `{ "runUntil": { "target": { "kind": "raster", "line": 250 }, "timeoutFrames": 5 } }` | Run until the raster beam gets to a line (0 to 311 for PAL, 0 to 262 for NTSC). Optional: `cycle` from 0 to 64. |
| `{ "runUntil": { "target": { "kind": "address", "address": "irq_tick", "condition": { "kind": "raster", "line": 250 } }, "timeoutFrames": 600 } }` | Run until the CPU gets to an address while the condition is true. |
| `{ "snapshot": "snapshots/start.vsf" }` | Restore a snapshot file. Usually with `side`: the snapshot of one program is not a state of the other. |
| `{ "normalize": true }` | Write pages 0 to 3 and `$00`/`$01` from the entry state in the project knowledge. The entry state comes from a capture of the unpacked program. Then both sides have the same zero page, stack and KERNAL work area. |
| `{ "observe": "moved", ... }` | Record a checkpoint. |

The `port` of a joystick is 1 or 2. The `direction` is `center`, `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left` or `down-right`.

A `condition` has the `kind` `register`, `memory` or `raster`. A `register` condition has `register` (`a`, `x`, `y` or `sp`), `operator` and `value`. A `memory` condition has `address`, `operator` and `value`. A `raster` condition has `line` and an optional `cycle`.

`timeoutFrames` is from 1 to 30000, and 3000 by default. A `runUntil` that does not get to its target in `timeoutFrames` frames makes the result INCONCLUSIVE.

Each step except `observe` can have `"side": "original"` or `"side": "rebuild"`. Then only that side does the step. Use it when only one side needs a step, for example a key for the intro of the original. An `observe` step has no `side`, because it compares both sides.

Each side finds a name in its own symbols.

## Observations

An `observe` step has a checkpoint name. A scenario can have each name only one time. The step can have these keys:

| Key | What the script compares |
|---|---|
| `memory` | A list of names, `$` addresses, or objects. An object has `address`, `size` (1 to 65536, default 1), `view` (`cpu` or `ram`, default `cpu`), `tolerance` (0 to 255, default 0), `mask` and `exclude`. The view `ram` reads the RAM under the ROMs and the I/O area. |
| `registers` | A list of register names: `pc`, `a`, `x`, `y`, `sp`, `flags`. |
| `screen` | The screen of the rebuild against the screen of the original. `maxMismatchRatio` (default 0) is the largest permitted part of different pixels. `mask` is a list of rectangles (`x`, `y`, `width`, `height`) that the comparison does not include. |
| `vicii` | The VIC-II state: mode, screen address, scroll and colors. |
| `sprites` | A list of sprite numbers from 0 to 7. The script compares their position, color and flags. |

A `tolerance` is the largest permitted difference for each byte. A screen `mask` has at most 64 rectangles. A `mask` must not cover all of the screen: PAL is 384×272 pixels and NTSC is 384×247 pixels. A scenario can observe the screen at most at 64 checkpoints.

The `mask` of a memory object gives the bits that the comparison uses, as hex. It is one byte for all bytes of the range, for example `0f`, or one byte for each byte of the range. The comparison applies the mask first and then the `tolerance`. The colour RAM at $d800 has only 4 bits, and its other 4 bits are not stable. Thus observe the colour RAM with the mask `0f`.

`exclude` is a list of bytes in the observed range that the comparison does not include. Each has `address` and a `reason`, for example `{ "address": "$d01e", "reason": "latched sprite collision, not writable" }`. The result lists each excluded byte with its `address` and `reason`.

A `pc` value is an address. Compare `pc` only when both programs have the code at the same address.

## Runs

A run file is one JSON object in a project file. It has:

- `name`: required. A short name, a non-empty string.
- `start`: required. `{ "program": "game.prg" }` to autostart a program with a BASIC start line, `{ "program": "game.prg", "load": true }` to load it with the CPU stopped (set `pc` in a step), or `{ "snapshot": ".c64-re-tools/local/snapshots/room0.vsf" }`.
- `symbols`: optional, `knowledge`, `none` (default), or a JSON file as for a subject. Without `symbols`, a run has no names: give `"symbols": "knowledge"` to use the names of the knowledge.
- `videoStandard`: optional, `pal` (default) or `ntsc`.
- `steps`: required. At least one step. The steps `write`, `registers`, `joystick`, `type`, `frames` and `runUntil` of a scenario, and the run steps `snapshot`, `save`, `screen`, `coverage`, `trace`, `observe` and `expect`.

The run steps have these effects:

| Step | Effect |
|---|---|
| `{ "snapshot": ".c64-re-tools/local/snapshots/room0.vsf" }` | Restore a snapshot file. |
| `{ "save": "room3" }` | Write the state now to `room3.vsf` in the `--out` folder. |
| `{ "screen": "room3" }` | Write the screen to `room3.png`. |
| `{ "coverage": "room3" }` | Write the coverage map since the start or the last `coverage` step to `room3.bin`. Then clear the map. |
| `{ "observe": "room3", "memory": ["$c100"], "registers": true }` | Record memory, registers, `vicii` or `sprites` in `results.json`. |
| `{ "observe": "all3", "memory": "all" }` | Write all 64 KiB of RAM to `all3.bin`, also the RAM under the ROMs and the I/O area. |
| `{ "trace": "d011", "points": [{ "kind": "write", "start": "$d011" }], "frames": 100 }` | Record each hit of the points for 100 frames in `d011.json`: the instruction, its registers, and the raster line and cycle. |
| `{ "expect": "title", "memory": [{ "address": "$0400", "text": "HELLO" }] }` | Compare memory and registers with the expected values. See the section "Expected values". |

A `trace` step has a name, `points` (1 to 8), `frames` (1 to 3000) and an optional `maxHits` (at most 20000). A point has `kind` (`exec`, `read` or `write`), `start` and an optional `end`. The step writes `<name>.json` with each hit. `results.json` gives the file, the count of hits, the frames and why the trace ended. A trace that a breakpoint, a watchpoint or a JAM ends also ends the run.

In a run, an `observe` step can have `memory`, `registers`, `vicii` and `sprites`. `registers` and `vicii` are `true` or `false`, not a list. `"registers": true` gives all registers. A scenario takes a list of register names, a run does not. `sprites` is a list of sprite numbers from 0 to 7.

In a run, a memory item has `address`, `size` (1 to 65536) and `view`. An item larger than 4096 bytes goes into the file `<observe>-<address>.bin`, without the `$`. `results.json` gives the file name.

A name in `save`, `screen`, `coverage`, `observe` and `expect` has 1 to 64 letters, digits, dots, underscores or hyphens. The files go into the `--out` directory, with `results.json`. It has the observations, the expectations, the files and the steps done. If a `runUntil` step did not reach its target, it also tells why the run stopped.

### Expected values

An `expect` step compares the memory and the registers with the values that the step gives. It writes no file. Use it to test a program that has no original, for example a new program or a fix.

```json
{ "expect": "title",
  "memory": [
    { "address": "$0400", "text": "HELLO FROM C64" },
    { "address": "score", "data": "0000" },
    { "address": "$d020", "data": "01", "mask": "0f" }
  ],
  "registers": { "pc": "main_loop", "a": 0, "flags": { "i": true } } }
```

The step has a name, and `memory`, `registers` or both.

A memory item has `address` and one of these two keys:

- `data`: the bytes as hex. The step compares each byte.
- `text`: characters on the screen, as screen codes of the upper-case set. The step reads one byte for each character. It compares the text, not the reverse video. A graphics character reads as a dot. Write letters in upper case.

A memory item can also have:

- `mask`: hex bytes with the same length as `data`. The step compares only the bits that are 1 in the mask. Use it for an I/O register with bits that read as 1, for example `$d020`.
- `view`: `cpu` (default) or `ram`.

A memory item has at most 4096 bytes.

`registers` has the fields of a `registers` step: `pc`, `a`, `x`, `y`, `sp` and `flags`. Only `pc` can be a name.

A value that is not equal does not stop the run. The later steps run. `results.json` and the result have `expectations`. For each step, it gives `pass` and the count of values that are not equal. It also lists at most 16 of them, with the expected and the actual value. `failedExpectations` names each step that did not pass. The result is FAIL when an expectation did not pass.

Example: visit two rooms from the same start.

```json
{
  "name": "rooms",
  "start": { "snapshot": ".c64-re-tools/local/snapshots/room0.vsf" },
  "steps": [
    { "write": { "address": "$0350", "data": "01" } },
    { "frames": 50 },
    { "screen": "room1" },
    { "coverage": "room1" },
    { "snapshot": ".c64-re-tools/local/snapshots/room0.vsf" },
    { "write": { "address": "$0350", "data": "02" } },
    { "frames": 50 },
    { "screen": "room2" },
    { "coverage": "room2" }
  ]
}
```

## Checks

The script checks the scenario before it does a step. A step with an unknown key or a wrong value stops the script with `invalid-input`. The message names the step.

A scenario file or a run file with an unknown key also stops the script with `invalid-input`. The message names the key and gives the keys of the file. A missing or wrong `name`, `start` or `steps` gives the form of that key.

The script also examines each file before it does a step: the program and the symbols of each side, and each snapshot file. A missing file stops the script with `not-found`. A program that is not a PRG, for example a disk image, stops the script with `invalid-input`. A snapshot file that is not a `.vsf` snapshot file also stops the script with `invalid-input`. The message names the step and the file.

A run also examines each name of its steps before it does a step. An unknown name stops the run with `invalid-input`, and the message names the step. In a scenario, a side that does not have a name gives INCONCLUSIVE, and `reason` names the step.

A step in the form of version 2.0 stops the script with `invalid-input`. The message names the old field and gives the step to write. For example, the script refuses `{ "runUntil": { "at": "main_loop" }, "timeoutFrames": 300 }` and gives `{"runUntil": {"target": {"kind": "address", "address": "main_loop"}, "timeoutFrames": 300}}`. A memory item with `at` gets the same refusal: write `address`.

In a run, two steps must not write the same file name. The script refuses such a run before it starts. Names that differ only in upper and lower case are the same name.
