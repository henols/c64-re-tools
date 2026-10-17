# Recording format

## Record file

A record file (for `record.ts`) is one JSON object in a project file.

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
- `symbols`: optional. `knowledge` (default), `none`, or a JSON file: the output of the c64-assembler skill, or an object of names and `$` addresses. The steps use these names.
- `load`: optional. With `false` (default), the program must load at `$0801` with a BASIC start line, and the C64 types `RUN`. With `true`, the program goes into memory and the C64 stays at READY. Then a `registers` step with `pc` starts the program.
- `checkpoint`, `state` and `pin`: optional. The comparison that a replay uses when the replay gives none. `checkpoint` is the name or `$` address of a routine. Each entry of the routine is a checkpoint. `state` is 1 to 16 memory items that the checkpoints compare. `pin` is the random state in RAM. An item is a name, a `$` address, or `{ "at", "size" }` with a size from 1 to 4096. Give `checkpoint` and `state` together.
- `inputs`: optional. The I/O addresses (or ranges such as `$de00-$dfff`) whose reads are input. The default is `$dc00` and `$dc01`: the joystick ports and the keyboard matrix. It also has `$d419` to `$d41c` (the paddles, and the noise and envelope of SID voice 3), and `$de00-$dfff` (no device: the last byte on the bus). Add `$d012` or a CIA timer only for a program that reads a seed there and does not wait in a loop on it.
- `steps`: the steps.

## Steps

The steps have the form of the steps of a scenario.

| Step | Effect |
|---|---|
| `{ "frames": 300 }` | Run 300 frames (19656 cycles each). |
| `{ "joystick": { "port": 2, "direction": "left", "fire": true } }` | Set a joystick. It stays in this state until the next joystick step. |
| `{ "type": "RUN\n" }` | Press each key of the text on the keyboard matrix, for 3 frames, then release it for 3 frames. |
| `{ "write": { "at": "next_room", "bytes": [1] } }` | Write bytes into RAM. |
| `{ "registers": { "pc": "change_room", "a": 16 } }` | Set registers at the next instruction. `pc` continues the program at that address. |
| `{ "runUntil": { "at": "main_loop" }, "timeoutFrames": 300 }` | Run until the CPU gets to an address. |
| `{ "runUntil": { "memory": { "at": "room", "equals": 2 } }, "timeoutFrames": 600 }` | Run until a byte has a value. The script reads the byte at the end of each frame. |

The replay core has no `runUntil` with `raster`.

A `type` step can press A to Z, 0 to 9, space, return (`\n`) and `+-.:@,*;=/!"#$%&'()[]<>?`. It types a to z as A to Z.

`joystick`, `type` and `frames` steps are input and time. The recording keeps their effect in the reads, so a replay does not do these steps again.

`write`, `registers` and `runUntil` steps are events. The recording keeps a point in the program for each event. The point is the next read at the input site with the most reads. That site is not in ROM. A replay does the event at the same read. An event that comes directly after another event runs at once after that event.

## Play

With `--play`, `record.ts` does the steps, then a person plays. The page on `http://localhost:<port>/` (`--http-port`, default 6465) shows the screen at 50 frames each second. It has no sound.

| Page input | C64 input |
|---|---|
| Arrow keys, space | The joystick of `--joystick` (default 2): directions and fire. |
| A gamepad | The same joystick: the left stick or the cross for directions, button 1 or 2 for fire. |
| A-Z, 0-9, the symbols of a `type` step, Return, Backspace (DEL), Escape (RUN/STOP), F1-F8 | The C64 keyboard. |

Stop on the page ends the session, and the script writes the recording folder. The input of the page goes into the reads, as the input of the steps does.

## Recording folder

`record.ts` writes these files into the `--out` folder:

| File | Content |
|---|---|
| `recording.json` | The program and its SHA-256, the symbols, and the comparison of the record file. Also the inputs, the events, the input sites, the cycles of the session and the state hash at its end. |
| `reads.txt` | One line `<site> <addr> <from> <value>` for each change of the value at a site. From the read with the index `<from>`, the reads at `<site>` from `<addr>` get `<value>`. One line `end <site> <addr> <count>` for each site gives its number of reads. |
| `coverage.bin` | The coverage map of the session: 65536 bytes, one for each address, in the format of the coverage maps of the emulator. It starts at the first input read of code in RAM, thus after a loader or a relocation. |

A site is the address of the instruction that reads. The values are hex. `<from>` and `<count>` are decimal.

## Replay

`replay.ts` replays a recording folder:

1. It replays the recording on the original program. The session must end with the recorded cycles and state hash. Else the result is INCONCLUSIVE. It also takes the state at each checkpoint of the original.
2. With `--rebuild`, it replays the recording on the rebuild. At each checkpoint, the rebuild first gets the pinned values of the original. Then the script compares the state. The cycles can be different.

The comparison comes from `--checkpoint`, `--state` and `--pin`, or else from the record file. A recording without names (`symbols` is `none`) takes the names of the knowledge at the time of the replay.

For the rebuild, the script finds each name with the names of the rebuild (`--symbols`). A `$` address is an address of the original. It moves with the name before it in the original: the script finds the same name in the rebuild and adds the same offset. Code moves with a code label, and data with any name. A site in ROM does not move. Give a state item a name, or the state moves with the code before it.

The result is one JSON object:

- `result`: PASS, FAIL or INCONCLUSIVE.
- `side`: `original` for the check of the original only, `rebuild` with `--rebuild`.
- `checkpoint`: the routine of the comparison.
- `checkpoints` and `compared`: the checkpoints of the original, and the checkpoints of the rebuild that were the same.
- `firstDifference`: on a FAIL, the checkpoint (1 is the first), the cycle on each side, and each state item that is different, as hex.
- `reason`: why the result is FAIL or INCONCLUSIVE.
- `movedSites`: the number of sites at a different address in the rebuild.
- `idleReads`: the input reads of the rebuild that the recording had no value for. Such a read is at a site that the recording does not have, or after its end. Each got the fixed value `$FF` (joystick, keyboard, paddles) or `$00`. An input site that the site map did not find shows here.
- `files`: with `--out`, the RAM of each side at the first different checkpoint, `original-<n>.bin` and `rebuild-<n>.bin`.
