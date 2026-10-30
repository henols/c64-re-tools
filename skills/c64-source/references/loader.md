# The loader

This file gives the loader program of `generate --out <dir> --loader`, the fields of `loader` in its result, and the action for each result. For the command, see the section "Generate the source" of `SKILL.md`.

## The loader program

`--loader` writes `loader.asm` in `--out`. It also writes the loader program and its symbols in `build/`. Git ignores `build/`.

- `loader.program` is the loader program. `loader.symbols` is its symbols file. The symbols file holds the labels of `loader.asm`, `main.asm` and `start_screen_stage.asm`. Give the two files to a test of the loader program.
- The loader program has the switch values of `config.asm`. With the defaults, it is the clean program: no copy protection, all corrections and no leftovers. The entry state is the state of the base release.
- The name of the loader program changes with the switch values. Then the script removes the loader program of the earlier run and its symbols.
- The loader program sets the entry state of the capture and jumps to the entry. It sets the memory, $00/$01, the registers, the VIC-II, the colour RAM, the raster line and the CIA timers.
- The loader changes the free stack byte below the stack pointer (`stackByte`). It does not set the SID, the time of day of the CIAs, the CIA interrupt flags or the interrupt registers of the VIC-II. A program that reads SID voice 3 for random numbers can thus give a different result. When you compare the reference and the rebuild, observe after the program sets its own random numbers.
- For the loader program of a release, build `loader.asm` with the build option `--release <label>`. This is possible only when `loader.packed` is not in the result. That loader program also does not have the leftovers.

## The start screen

- When the knowledge has a start screen and `START_SCREEN` is 1, the loader program shows the start screen. It waits until the user releases all keys and fire buttons. Then it waits for a key, or for a fire button on joystick port 1 or 2, and for its release. A move of a joystick is not a key.
- The start screen needs the VIC-II values of the entry state. Its screen, bitmap, charset and colours must be in a segment of the program, or in a captured stage. See "The start screen of a captured stage".
- The start screen is part of the clean build only. A release build has no start screen. `LEFTOVERS = 1` also turns it off.
- To start the program at once, build the source with the switch value `START_SCREEN=0`. The build then also gives its loader program. See "The loader of other switch values".
- A test, a run and a replay of the loader program pass the start screen.

## The loader of other switch values

To get the loader program of other switch values, build `main.asm` of the source with these switch values, for example `TRAINER=1`. `config.asm` does not change. The build result then has the loader program in `loader.out` and its symbols file in `loader.symbolsFile.out`. No check of this loader program runs, so `loader.verified` is `false`. Test the loader program before you trust it.

The build refuses the loader program in these cases:

- A segment of the program starts below $0400.
- The switch values change a byte that `loader.asm` holds between its free ranges.
- The start screen is of a captured stage.

In these cases, set the switch values in `config.asm`. Then run `generate --out <dir> --loader`.

## The fields of the loader

`loader` holds these fields:

- `program` and `symbols`: the loader program and its symbols file.
- The `copies` in their order, `copier` and `stackByte`.
- `verified: true`: the check ran the loader program to its jump to the entry. There, the memory, $00/$01, the registers, the VIC-II and the colour RAM are equal to the entry state. The raster line and the CIA values are also equal. An interrupt can run right at the entry, as in the program of the base release.
- `limits`: each CIA value that the loader cannot set as it was at the entry. An old capture has no CIA values or no colour RAM. Then capture the program again at its entry point.
  When no free RAM outside the segments has room for the 1000 colours, the loader does not set the colour RAM, and `limits` tells this. Then the program starts with other colours where it does not write them.
- `startScreen`: with a start screen, `shown: true` when the VIC-II had the values of the start screen, and `waits: true` when the start screen waited without a key.
- `packed`: `packedBytes` and `unpackedBytes` of the packed form. A program that is too large for one loader file gets the packed form. With a start screen of a captured stage, this is the packed program in the loader program.
- `stage`: the show stage of a start screen of a captured stage. It has the `space` of the stage and the address of the show `code`. It also has the `bytes` of the stage in the loader program, the `stash` copies, `packedBytes` and `unpackedBytes`. `startScreen.stage` names the space.
- When the check of the loader program cannot run, the script does not write a loader program. The loader program of an earlier run stays as it was. `loader.asm` is new. `reason` tells why the check did not run.
- `kept`: when the result has no new loader program, the paths of the loader programs of an earlier run. They are not of this source.

## When the loader is not verified

Do these actions when `verified` is `false`:

| Field | Action |
|---|---|
| `reason` about the copy order, the free pages or the count of copies | The reason gives the ranges. Capture the program again with fewer segments. If this is not possible, stop the task and give the reason to the user. |
| `reason` about the packed form | If a tool is missing, stop the task and give the message to the user. If the free ranges are too small, stop the task and give the reason to the user. If the check of the unpack fails, give the reason to the user. |
| `reason` that the source does not assemble | Correct the source first. The loader includes the source. |
| `reason` about the start screen | Correct the start screen in the project knowledge, or capture the program again with the start screen in memory. If the start screen is not necessary, remove it from the project knowledge. |
| `reason` about the show stage | If the reason names the coverage of the stage, run the stage with coverage. Put the map into the project knowledge in the space of the stage. If the memory is too small, capture the stage again with less memory. If a tool is missing, stop the task and give the message to the user. If `start_screen_stage.asm` does not assemble, stop the task and give the reason to the user. The reason names the file in `.c64-re-tools/local/` with the source that failed. |
| `reason` that the check of the loader program did not run | Stop the task and give the reason to the user. When the user tells you that the emulator is available, run the same command again. |
| `differences` | The loader ran. The list gives the bytes and the registers that are not equal. |
| `stop` | The loader did not get to its copier or its jump. `stop` gives the address and `port`, the value of $01. `history` gives the last 16 instructions. `cause` gives the first byte of the copier or of a copy that is not correct. |

## The start screen of a captured stage

Often the loading stage of a program shows a picture that is not in memory at the entry. Then the knowledge has the picture in the captured stage of the space `loading`. `--stage` of the start screen names that space. `--call` names a routine of the stage, for example the routine that starts the loading tune.

The loader program then shows the start screen before it unpacks the program. The program stays packed while the screen shows. Thus the picture and the tune have more free memory.

- The script puts everything in memory. It does not matter where the stage keeps its bytes, if the memory has enough room.
- The loader program has only the bytes of the stage that the start screen uses. These are the screen, the bitmap and the charset. With a call, they are also each byte of the stage that is not free from the call, as in "The free ranges". A call thus needs the coverage of the stage.
- With colours from the colour RAM of the capture, the loader program sets the colour RAM to these colours.
- The patches of the stage are in at the defaults of their switches. Thus a patch under a switch can remove the text of a crack from the picture.
- `start_screen_stage.asm` holds the show code and the bytes of the stage. Do not edit it. To make the loader program again, run `generate --out <dir> --loader`.
- The show stage needs Exomizer. The show code needs free memory in $0400-$9fff or $c000-$cfff. When the memory is too small, the reason gives the largest free ranges.
- The check also compares the VIC-II, the screen bytes and the colour RAM with the start screen.
