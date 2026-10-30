# Start screens

This file tells how to record the start screen of the program. For the command, see its section of `SKILL.md`.

A start screen is a loading screen, a title screen or a presentation screen of the program itself. The loader of the generated source shows it before the program starts. Then the loader waits for a key, or for a fire button on joystick port 1 or 2.

## A start screen in the program

Use this when the program at the entry has the bytes of the screen. Do these steps:

1. Run the program of the base release until it shows the screen.
2. Capture the program at that time. Do not exclude the memory of the screen.
3. Record the start screen with `start-screen --capture <image.json>`.

- The script takes the mode, the addresses, the border and the background from the capture. Do not find the addresses or the colours yourself.
- The script finds the 1000 colours of the colour RAM of the capture in the program. Then it records their address as `colours`. When the colour RAM has one colour, the script records that `colour`.
- If the script refuses because the program does not have the colours, find the stage of the loading that shows the screen. Then record the start screen of that stage. If no stage shows the screen, give `error` to the user.
- A capture of an older version has no colour RAM. Then capture the program again.

## A start screen of a captured stage

Use this when a stage of the loading shows the screen, and the program at the entry does not have it. Do these steps:

1. Capture the stage while it shows the screen. Do not exclude the memory of the screen.
2. Put the capture into the knowledge in the space `loading`: `image stage/image.json --space loading`. Do not use another space for it.
3. If the stage plays a tune or does other work during the screen, find the routine that starts it. Run the stage with coverage while that routine runs. Put the map into the knowledge with `coverage <map> --space loading`.
4. Record the start screen with `start-screen --stage loading`, and with `--call` for the routine.

- The script takes the mode, the screen, the bitmap or the charset, the colours and the colour RAM from the capture. Do not find the addresses or the colours yourself.
- A capture of an older version has no colour RAM. Then capture the stage again.

## Flags that correct a capture

- A flag that you give with `--capture` or `--stage` replaces the value of the capture. Give a flag only to correct a value.
- Without `--capture` and `--stage`, give `--mode`, `--screen`, `--border` and `--background`, and the bitmap, the charset and the colours that the mode needs.

## The rules of the VIC-II

- `text` needs `--charset`. `hires` and `multicolour` need `--bitmap`. `text` and `multicolour` need `--colours` or `--colour`. `hires` uses neither.
- The screen is at a step of $0400, the bitmap at a step of $2000 and the charset at a step of $0800. They must be in one VIC bank of 16 KB.
- In VIC bank 0 and 2, the VIC-II reads the character ROM at $1000-$1fff of the bank. A screen or a bitmap cannot be there. A charset at $1000 or $1800 of the bank is the character ROM.
- No part can be in $0000-$03ff. The colours cannot be in $d000-$dfff.
- A space has one start screen, and only the space `c64` has one. A write replaces the start screen of the knowledge.
- The generated source has the switches `START_SCREEN` and `LEFTOVERS`. Thus no symbol and no switch can have these names.
