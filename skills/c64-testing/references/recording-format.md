# Recording format

This file gives the format of a record file and of a recording folder. For the commands, see the sections ``### `record <record.json>` `` and ``### `replay <recording>` `` of `SKILL.md`.

## Record file

A record file is one JSON object in a project file.

```json
{
  "name": "first rooms",
  "program": "original/game.prg",
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
- `press` pushes keys of the keyboard matrix. It is input. A scenario has no `press` step.

A record file has no `raster` target and no `condition`. `write` and `runUntil` have only the space `c64`.

| Step | Effect |
|---|---|
| `{ "frames": 300 }` | Run 300 frames (19656 cycles each). |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. It stays in this state until the next joystick step. |
| `{ "press": "RUN\n" }` | Press each key of the text on the keyboard matrix for 3 frames, then release it for 3 frames. |
| `{ "type": { "mode": "text", "text": "RUN\n" } }` | Put at most 10 keys into the keyboard queue of the KERNAL, after the keys that wait there. |
| `{ "write": { "address": "next_room", "data": "01" } }` | Write bytes into RAM. |
| `{ "registers": { "pc": "change_room", "a": 16 } }` | Set registers at the next instruction. `pc` continues the program at that address. |
| `{ "runUntil": { "target": { "kind": "address", "address": "main_loop" }, "timeoutFrames": 300 } }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "target": { "kind": "memory", "address": "room", "operator": "eq", "value": 2 }, "timeoutFrames": 600 } }` | Run until a byte compares true with `value`. The script reads the byte at the end of each frame. |

A `press` step can press A to Z, 0 to 9, space, return (`\n`) and `+-.:@,*;=/!"#$%&'()[]<>?`. It presses a to z as A to Z.

The keyboard queue of the KERNAL holds 10 keys. If the keys of a `type` step and the keys that wait in the queue do not fit, the session stops. A program that reads the keyboard hardware does not see the keys of a `type` step. Use `press` for that program.

`joystick`, `press` and `frames` steps are input and time. The recording keeps their effect in the reads, so a replay does not do these steps again.

`type`, `write`, `registers` and `runUntil` steps are events. The recording keeps a point in the program for each event. The point is the next read at the input site with the most reads. That site is not in ROM. A replay does the event again at the same read. An event that comes directly after another event runs at once after that event.

## Play

With `--play`, `record` does the steps, then a person plays. The page on `http://localhost:<port>/` (`--http-port`) shows the screen at 50 frames each second. It has no sound.

| Button | Key | Effect |
|---|---|---|
| Start | Enter, on the start screen | The C64 runs. Before Start, the page shows the screen after the steps, and the C64 is frozen. The time before Start is not in the recording. |
| End and save | F12 | The C64 stops at the frame on the page, and the screen stays frozen. The script writes the recording folder. |
| Cancel | F11 | The session stops before or during the play. The script writes no folder and gives `recorded: false`. |
| Port | F9 | The joystick goes to the other port. `--joystick` gives the first port. |
| Arrows | F10 | The arrow keys and space change between the joystick and the C64 keys. At the start, they are the joystick. |
| Keys | | The keyboard changes between the symbolic map (the default) and the positional map. |

The buttons are in one row above the screen.

| Page input | C64 input |
|---|---|
| Arrow keys and space, when they are the joystick | The joystick: directions and fire. |
| A gamepad | The joystick: the left stick or the cross for directions, button 1 or 2 for fire. |
| Arrow keys and space, when they are C64 keys | CRSR up, down, left and right, and SPACE. |
| Escape, Shift+Escape | RUN/STOP, RUN |
| Page Up | RESTORE |
| Tab, left Alt | CTRL, C= |
| Home, Shift+Home | CLR/HOME, CLR |
| Backspace, Shift+Backspace | INST/DEL, INST |
| F1-F8 | F1-F8 |

In the symbolic map, a key gives the character on the PC key. a-z give the C64 letters, and A-Z give the letters with SHIFT. The digits and the symbols give the same characters. `£` gives the pound key, `^` gives the up arrow, and the backquote gives the left arrow.

In the positional map, a key gives the C64 key at the same place on the keyboard. Each SHIFT key is a C64 SHIFT key, also alone. The C64 keys `+ - @ * : ; =` are on the PC keys `- = [ ] ; ' \`. Insert gives the pound key, Delete gives the up arrow, and the backquote gives the left arrow. Use the positional map when the program reads SHIFT alone or a key with SHIFT.

Ctrl and Cmd are not C64 keys. They keep their function in the browser.

The page sends input only between Start and End. The input of the page goes into the reads, as the input of the steps does. RESTORE starts an NMI and is not a read. The recording keeps each RESTORE as an event without a step number. The replay presses RESTORE again at the same read of the program.

## Recording folder

`record` writes these files into the `--out` folder:

| File | Content |
|---|---|
| `recording.json` | The program and its SHA-256, the symbols, and the comparison of the record file. Also the inputs, the events, the input sites, the cycles of the session and the state hash at its end. |
| `reads.txt` | One line `<site> <addr> <from> <value>` for each change of the value at a site. From the read with the index `<from>`, the reads at `<site>` from `<addr>` get `<value>`. One line `end <site> <addr> <count>` for each site gives its number of reads. |
| `coverage.bin` | The coverage map of the session: 65536 bytes, one for each address, in the format of the coverage maps of the emulator. It starts where the key `coverage` of the record file tells. The code before that point has no marks. |

A site is the address of the instruction that reads. The values are hex. `<from>` and `<count>` are decimal.

`replay` examines `recording.json` before the replay starts. A recording of version 2.0 can have events or a comparison in the old form, for example `"at"` in place of `"address"`. The script refuses it with `invalid-input`. The message names the event, the old field and the form to write. Record the session again.

## Replay

`replay` replays the recording on the original program first. The session must end with the recorded cycles and state hash. Else the result is INCONCLUSIVE. With `--rebuild`, `replay` then replays the recording on the rebuild. At each checkpoint, the rebuild first gets the pinned values of the original. Then the script compares the state. The cycles can be different.

A recording without names (`symbols` is `none`) takes the names of the project knowledge at the time of the replay.

For the rebuild, the script finds each name with the names of the rebuild (`--symbols`). A `$` address is an address of the original. It moves with the name before it in the original: the script finds the same name in the rebuild and adds the same offset. Code moves with a code label, and data with any name. A site in ROM does not move. Give a state item a name, or the state moves with the code before it.

The body of the envelope of `replay` has these fields:

- `result`: PASS, FAIL or INCONCLUSIVE.
- `side`: `original` for the check of the original only, `rebuild` with `--rebuild`.
- `checkpoint`: the routine of the comparison.
- `checkpoints` and `compared`: the checkpoints of the original, and the checkpoints of the rebuild that were the same.
- `firstDifference`: on a FAIL, the checkpoint (1 is the first), the cycle on each side, and each state item that is different. An item has `address`, and the `original` and `rebuild` values as hex.
- `reason`: why the result is FAIL or INCONCLUSIVE.
- `movedSites`: the number of sites at a different address in the rebuild.
- `startScreen`: `skipped` when the rebuild went past the wait of its start screen.
- `idleReads`: the input reads of the rebuild that the recording had no value for. Such a read is at a site that the recording does not have, or after its end. Each got the fixed value `$FF` (joystick, keyboard, paddles) or `$00`. An input site that the site map did not find shows here.
- `files`: with `--out`, the RAM of each side at the first different checkpoint, `original-<n>.bin` and `rebuild-<n>.bin`.
