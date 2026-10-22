---
name: retro-development
description: Writes a new C64 program in 6510 assembly for ACME, or adds a feature or a fix to a program. It builds, runs, debugs and tests the program in small steps, with tests that give PASS or FAIL. It works on source that a person wrote, and on a rebuilt program with switches. Use it when the user asks for a new program, for example "write a game" or "make the border flash". Use it to add a feature or a fix, for example "add a high score" or "fix the sprite flicker". It does not find out what an unknown program does.
---

# C64 development

## Purpose

Coordinate the development of a C64 program: a new program, a new feature or a fix. Make each change in small steps. Prove each step with a test that gives PASS.

Do the specialist work of each task as that task tells. Do not do it in another way.

## Inputs

- The request: the program, the feature or the defect.
- The acceptance checks: what the user must see or what memory must hold when the work is complete.
- The project: its source, its tests and its knowledge.

## Project rules

- One repository can hold several programs, with one project folder for each program. Work on one project at a time.
- Write all files in the project folder. Do not write files at the root of the repository.
- Keep the run files that are tests in `tests/`. Git keeps them.

## Workflow

First select the path:

- The project has no program yet: path A.
- The program has source that a person wrote: path B. A project that an export of a rebuilt program made also takes path B.
- The source comes from a generation from the project knowledge: path C. Such a source has `main.asm`, and the first line of each generated file tells that it is generated. Do not edit this source. The next generation of the source writes over it.

### Acceptance checks

Before you write code, write the acceptance checks. If the request does not give them, ask the user. Write each check as an `expect` step in a run file in `tests/`. Examples:

- the text at `$0400` after the start
- the value of a variable after a joystick input
- the border color in a frame
- the address of the main loop.

Put a check that only a person can judge, for example smooth animation, into a test checklist.

### A. A new program

Use this layout. No script makes it.

```
src/           the source, with src/main.a as the entry
build/         the built programs and their symbol files. Do not commit them: each build writes them again.
tests/         run files with expect steps
docs/          the documentation, when the user asks for it
```

Start the program with a BASIC line. Then an autostart in the emulator and a test run can start it:

```
* = $0801
!word next, 10        ; line 10
!byte $9e             ; SYS
!text "2061", 0
next !word 0          ; end of the BASIC program
start                 ; $080d = 2061
```

Do these steps for each small part of the program:

1. Find the meaning of each register in the memory map of the C64. Export the platform names as an include file to `src/hw.a`. Include it with `!source`. Do not type the addresses of registers yourself.
2. Write the code for one part.
3. Assemble `src/main.a` into `build/<name>.prg`, with the symbols in `build/<name>.json`. Change the source at the file and the line of each error.
4. Start the program in the emulator with an autostart. Look at the screen. Read the screen memory, not only the screen image.
5. Write the `expect` steps of this part in a run file. Give the symbol file `build/<name>.json` in the run file, so that a step can use the labels of the source.
6. Run all run files in `tests/`. Go to the next part only when each run gives PASS.

To find a defect, debug the program in the emulator:

- Stop at the code with a breakpoint, or at a write to a variable with a watchpoint.
- Run the emulator until the program gets to a state.
- Measure the cycles of an interrupt or a loop. Profile the program to find the routines that use the most cycles.
- Save a snapshot of the machine before a risky try.

Find the cause before you change the code. Do not change code at random until a test passes.

When the user must play or look at the program, open the emulator window for the user.

### B. A feature or a fix in source that a person wrote

1. Write a run file with an `expect` step that shows the defect or the missing feature.
2. Run it. Make sure that it gives FAIL. A test that gives PASS before the change does not test the change.
3. For a defect, find the cause in the emulator.
4. Change the source. Assemble it.
5. Run the new run file and all other run files in `tests/`. Each run must give PASS.

### C. A feature or a fix in a rebuilt program

A rebuilt program gets its source from the project knowledge. A change is a switch and its patches in the knowledge. The build of the base release stays identical to the original.

1. Read the releases and the switches in the project knowledge. If the knowledge has no base release, record the original file as the base release first, for example `original/game.prg`.
2. Give each feature and each fix its own switch. Then each one can be on or off alone. Record the switch in the project knowledge. No release has your change, so do not give the switch a release. Select the kind of the switch:
   - A fix: `fix`, for example `FIX_FLICKER`. The default build has it.
   - A trainer or a cheat: `trainer` or `cheat`. The default build does not have it.
   - Another feature: `change`, for example `HISCORE`. Ask the user if the default build must have it. Record the default as 1 or 0.
3. Find the code to change. Read the project knowledge at the addresses, and examine the code in the emulator.
4. Write the code in a file in `.c64-re-tools/local/`. Record a patch of the switch for the range, with the code from the file. The code must fit in the range.
5. If the code does not fit, write a short patch with a `jsr` to the new code. Put the new code in a second patch of the same switch, in a range that the program does not use. The range must have evidence: a leftover that you found in the program, or code that no run executed and that the program cannot reach. If no range has this evidence, stop and ask the user.
6. Generate the source from the project knowledge into `src`. Continue only when the result of the generation is PASS. A switch with the result `overflow` or `does not assemble` has a patch that you must change.
7. Build the program:
   - Build the base release and compare it with the original. This build must be identical to the original.
   - Build the default build.
   - When the default build does not have the switch, set the switch to 1 in `src/config.asm`. Then build the default build. After the test, set the value back to the default if the user did not ask for the change.
8. Test the build that has the switch:
   - When the behavior must stay the same as the original, replay a recording that executes the changed code. Run a test scenario in `tests/` only when no recording executes that code.
   - Run a run file with `expect` steps that show the feature or the fix.

### The answer

Give the user a short answer at the end:

1. Each acceptance check and its result.
2. The run files in `tests/` and the result of each.
3. For path C: the switches, and how to build with each one.
4. Open questions and the checks that only a person can judge.

## Knowledge

For a new program, the source is the truth. Record names and comments in the project knowledge only when the user asks for the knowledge or for documentation. Then put the built program into the project knowledge first.

For a rebuilt program, record each change as a switch and its patches in the project knowledge.

Do not store:

- test results
- the state of the current work
- guesses.

## Result

A program that builds, with a run file in `tests/` for each acceptance check, and each run gives PASS. For a rebuilt program: a switch for each change, and a build of the base release that is identical to the original.

## Failure and conflicts

- A task reports `installation-incomplete` or `machine-unavailable`: stop the whole task. Give the message to the user and wait for the user. Do not continue with other tasks.
- A tool gives a wrong result: tell the user the defect and the evidence, and wait for the user. Do not make a workaround.
- A test gives FAIL: change the program until the test gives PASS. Do not change the expected value to make the test pass. Change an expected value only when the user changes the acceptance check.
- A run gives FAIL because a `runUntil` step did not get to its target: the program did not get to that state. Find the cause in the emulator.
- The program reads the keyboard hardware, and a key does not arrive: read the description of the keyboard tool of the emulator. Do not change the program to make it accept a key.
- A patch does not fit, and no unused range has evidence: stop and ask the user.

## Other tasks

- To find out what code does when nobody understands it yet, reverse engineer it.
- To start a new program from a rebuilt program, export the rebuilt program as a new project.
