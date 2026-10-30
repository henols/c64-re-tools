# Recording format

This file gives the format of a record file. For the commands, see the sections ``### `record <record.json>` `` and ``### `replay <recording>` `` of `SKILL.md`.

## Record file

A record file is one JSON object in a project file.

```json
{
  "name": "first rooms",
  "program": "releases/game.prg",
  "steps": [
    { "frames": 300 },
    { "joystick": { "port": 2, "direction": "center", "fire": true } },
    { "frames": 30 },
    { "joystick": { "port": 2, "direction": "right" } },
    { "frames": 500 }
  ]
}
```

- `name`: a short text.
- `program`: a PRG file, relative to the project folder.
- `symbols`: optional. `knowledge` (default), `none`, or a JSON file: the symbol file of a build, or an object of names and `$` addresses. The steps use these names.
- `load`: optional. With `false` (default), the program must load at `$0801` with a BASIC start line, and the C64 types `RUN`. With `true`, the program goes into memory and the C64 stays at READY. Then a `registers` step with `pc` starts the program.
- `checkpoint`, `state` and `pin`: optional. The comparison that a replay uses when the replay gives none. `checkpoint` is the name or `$` address of a routine. Each entry of the routine is a checkpoint. `state` is 1 to 16 memory items that the checkpoints compare. `pin` is the random state in RAM. An item is a name, a `$` address, or `{ "address", "size" }` with a size from 1 to 4096. Give `checkpoint` and `state` together.
- `inputs`: optional. The I/O addresses (or ranges such as `$de00-$dfff`) whose reads are input. The default is `$dc00` and `$dc01`: the joystick ports and the keyboard matrix. It also has `$d419` to `$d41c` (the paddles, and the noise and envelope of SID voice 3), and `$de00-$dfff` (no device: the last byte on the bus). Add `$d012` or a CIA timer only for a program that reads a seed there and does not wait in a loop on it.
- `coverage`: optional. Where the coverage map starts:
  - `input` (default): at the first input read of code in RAM. The start-up code of the program, for example a loader, a relocation or an initialization, is not in the map.
  - `start`: when the program starts, after `RUN` or at the `registers` step of `load` `true`.
  - A `$` address, for example `"$1aed"`: at the first execution of that address.
- `steps`: the steps.

## Steps

The steps have the form of the steps of a scenario. Two steps behave differently:

- `type` puts at most 10 keys into the keyboard queue of the KERNAL. It is an event: a replay does it again.
- `press` pushes keys of the keyboard matrix. It is input.

A record file has no `raster` target and no `condition`. `write` and `runUntil` have only the space `c64`.

| Step | Effect |
|---|---|
| `{ "frames": 300 }` | Run 300 frames. |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. It stays in this state until the next joystick step. |
| `{ "press": { "keys": "RUN\n" } }` | Press the keys of the keyboard matrix. Each tap holds its keys for 3 frames, then releases them for 3 frames. `frames` sets a different number, from 1 to 3000. |
| `{ "type": { "mode": "text", "text": "RUN\n" } }` | Put at most 10 keys into the keyboard queue of the KERNAL, after the keys that wait there. |
| `{ "write": { "address": "next_room", "data": "01" } }` | Write bytes into RAM. |
| `{ "registers": { "pc": "change_room", "a": 16 } }` | Set registers at the next instruction. `pc` continues the program at that address. |
| `{ "runUntil": { "target": { "kind": "address", "address": "main_loop" }, "timeoutFrames": 300 } }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "target": { "kind": "memory", "address": "room", "operator": "eq", "value": 2 }, "timeoutFrames": 600 } }` | Run until a byte compares true with `value`. The script reads the byte at the end of each frame. |

Each character of `keys` is one tap. a to z press the same keys as A to Z. `\n` presses RETURN. A character with SHIFT, for example `!`, also presses the left SHIFT.

The program runs while a `press` step taps its keys. An event in these frames is past when the next step starts. After a `press` step, run until an address that the program gets to later. For example, after F1 starts a game, run until the main loop of the game, not until the routine that starts the game.

A key without a character has its name in braces, in upper or lower case. `{STOP}` is RUN/STOP, and `{CBM}` is the Commodore key. The names are:

- `{F1}` to `{F8}`, `{RETURN}`, `{SPACE}`, `{DEL}`, `{INST}`, `{HOME}`, `{CLR}`
- `{STOP}`, `{RUN}`, `{RESTORE}`, `{CTRL}`, `{CBM}`, `{LSHIFT}`, `{RSHIFT}`
- `{UP}`, `{DOWN}`, `{LEFT}`, `{RIGHT}`, `{POUND}`, `{UPARROW}`, `{LEFTARROW}`

`{F2}`, `{F4}`, `{F6}`, `{F8}`, `{RUN}`, `{CLR}`, `{INST}`, `{UP}` and `{LEFT}` also press the left SHIFT.

To hold keys together in one tap, join them with `+` in braces. For example, `{ "press": { "keys": "{LSHIFT+CBM}" } }` holds the left SHIFT and the Commodore key together. One tap holds at most 4 keys. RESTORE counts as a key.

The keyboard queue of the KERNAL holds 10 keys. If the keys of a `type` step and the keys that wait in the queue do not fit, the session stops. A program that reads the keyboard hardware does not see the keys of a `type` step. Use `press` for that program.

`joystick`, `press` and `frames` steps are input and time. The recording keeps the input that the program read, so a replay does not do these steps again.

RESTORE starts an NMI and is not an input read. A replay presses each RESTORE of a `press` step again at the same point of the program.

`type`, `write`, `registers` and `runUntil` steps are events. A replay does each event again at the same point of the program. A `runUntil` step to an address needs no input. Another event needs an input read of the program.

Some parts of a program read no input, for example an intro or a bonus screen. To do an event in such a part, put a `runUntil` step to an address before the event.
