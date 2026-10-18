---
name: c64-development
description: Use this skill to write a new C64 program in 6510 assembly for ACME. Also use it to add a feature or a fix to a program. It builds, runs, debugs and tests the program step by step, with tests that give PASS or FAIL. It works on source that a person wrote, and on a rebuilt program with switches. It decides which specialist skill does each step. Use it for requests such as "write a game", "add a high score", "fix the sprite flicker" or "make the border flash". Do not use it to find out what an unknown program does. Use c64-reverse-engineering for that.
---

# c64-development

## Purpose

Coordinate the development of a C64 program: a new program, a new feature or a fix. Make each change in small steps. Prove each step with a test that gives PASS.

This skill does not do the specialist work itself.

## Inputs

- The request: the program, the feature or the defect.
- The acceptance checks: what the user must see or what memory must hold when the work is complete.
- The project: its source, its tests and its knowledge.

## Tools / execution path

This skill uses the other skills. It does not use the host runtime or the emulator directly.

| Work | Skill |
|---|---|
| Assemble the source to a PRG, with errors and symbols | c64-assembler |
| Run, look, debug and measure | c64-emulator |
| Tests with expected values (`expect` steps in a run), and original against rebuild | c64-testing |
| The meaning of an address or a register, and an include of the platform names | c64-memory-map |
| Patches and switches of a rebuilt program, names and comments | c64-knowledge |
| The source of a rebuilt program | c64-source |
| Ranges that a rebuilt program does not use | c64-provenance |
| Documentation | c64-docs |

### Project folder

One repository can hold several programs, with one project folder for each program. A project folder holds `.c64-re-tools/`. Work on one project at a time:

- From the root of the repository, give `--project <folder>` to each skill script, and `project` to each emulator tool with a path.
- Write all files in the project folder. Do not write files at the root of the repository.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, step files, snapshots and memory dumps.
- Keep the run files that are tests in `tests/`. Git keeps them.
- Write the knowledge only with the c64-knowledge script. Do not write or edit the files in `.c64-re-tools/knowledge/` yourself.

## Workflow

First select the path:

- The project has no program yet: path A.
- The program has source that a person wrote: path B.
- The source comes from c64-source: path C. The source has `main.asm` and `source-map.json` from c64-source. Do not edit this source. The next `source.ts generate` writes over it.

### Acceptance checks

Before you write code, write the acceptance checks. If the request does not give them, ask the user. Write each check as an `expect` step in a run file in `tests/`. Examples:

- the text at `$0400` after the start
- the value of a variable after a joystick input
- the border color in a frame
- the address of the main loop.

A check that only a person can judge, for example smooth animation, goes into a checklist with `testing.ts checklist` of c64-testing.

### A. A new program

Use this layout. No script makes it.

```
src/           the source, with src/main.a as the entry
build/         programs and symbol files from c64-assembler
tests/         run files with expect steps
docs/          the documentation, when the user asks for it
```

Start the program with a BASIC line, so that `c64_autostart` and a run with `start.program` can start it:

```
* = $0801
!word next, 10        ; line 10
!byte $9e             ; SYS
!text "2061", 0
next !word 0          ; end of the BASIC program
start                 ; $080d = 2061
```

Do these steps for each small part of the program:

1. Find the meaning of each register with c64-memory-map. Make an include of the platform names with `memory-map.ts export --out src/hw.a`. Include it with `!source`. Do not type the addresses of registers yourself.
2. Write the code for one part.
3. Build it with c64-assembler: `assembler.ts build src main.a --out build/<name>.prg --out-symbols build/<name>.json`. Change the source at the file and the line of each error.
4. Start it with `c64_autostart` of c64-emulator. Look at the screen with `c64_screen`. Read the screen memory, not only the image.
5. Write the `expect` steps of this part in a run file. Give `"symbols": "build/<name>.json"`, so that a step can use the labels of the source.
6. Run all run files in `tests/` with `testing.ts run`. Go to the next part only when each run gives PASS.

To find a defect, use c64-emulator:

- Stop at the code with `c64_breakpoint`, or at a write to a variable with `c64_watchpoint`.
- Get to a state with `c64_run_until`.
- Measure an interrupt or a loop with `c64_timing`. Find the routines that use the most cycles with `c64_profile`.
- Save the state with `c64_snapshot` before a risky try.

Find the cause before you change the code. Do not change code at random until a test passes.

When the user must play or look at the program, use the window procedure of c64-emulator. Open the window, tell the user what to do, wait, and close the window.

### B. A feature or a fix in source that a person wrote

1. Write a run file with an `expect` step that shows the defect or the missing feature.
2. Run it with `testing.ts run`. Make sure that it gives FAIL. A test that gives PASS before the change does not test the change.
3. For a defect, find the cause with c64-emulator.
4. Change the source. Build it with c64-assembler.
5. Run the new run file and all other run files in `tests/`. Each run must give PASS.

### C. A feature or a fix in a rebuilt program

A rebuilt program gets its source from the knowledge. A change is a patch of the knowledge. A patch has a switch, so the default build stays identical to the original.

1. Give each feature and each fix its own switch, for example `HISCORE` or `FIX_FLICKER`. Then each one can be on or off alone.
2. Find the code to change with c64-knowledge (`at`, `regions`) and c64-emulator.
3. Write the code in a file in `.c64-re-tools/local/`. Write the patch with `knowledge.ts patch '<range>' <SWITCH> --code-file <file>` of c64-knowledge. The code must fit in the range.
4. If the code does not fit, write a short patch with a `jsr` to the new code. Put the new code in a second patch of the same switch, in a range that the program does not use. The range must have evidence: `provenance.ts leftovers` of c64-provenance, or code that no run executed and that the program cannot reach. If no range has this evidence, stop and ask the user.
5. Make the source again with `source.ts generate --out src` of c64-source. Each switch must have `switches[].result` with no `overflow` and no `does not assemble`.
6. Build two programs with c64-assembler:
   - the default build with `--compare`, which must be identical to the original
   - the build with `--define <SWITCH>=1`.
7. Test the build with the switch:
   - Run the scenarios in `tests/` with `testing.ts test`, where the behavior must stay the same as the original.
   - Run a run file with `expect` steps that show the feature or the fix.

### The answer

Give the user a short answer at the end:

1. Each acceptance check and its result.
2. The run files in `tests/` and the result of each.
3. For path C: the switches, and how to build with each one.
4. Open questions and the checks that only a person can judge.

## Knowledge

For a new program, the source is the truth. Record names and comments in the knowledge only when the user asks for the knowledge or for documentation. Then put the program in with `knowledge.ts image build/<name>.prg` of c64-knowledge first.

For a rebuilt program, write each change as a patch with c64-knowledge.

Do not store:

- test results
- the state of the current work
- guesses.

## Result

A program that builds, with a run file in `tests/` for each acceptance check, and each run gives PASS. For a rebuilt program: a switch for each change, a default build that is identical to the original, and a build for each switch.

## Failure and conflicts

- A skill reports `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the whole task. Give the message to the user and wait for the user. Do not continue with other skills. Do not make a replacement for the tool or the host runtime, for example your own assembler or emulator script.
- A tool gives a wrong result: tell the user the defect and the evidence, and wait for the user. Do not make a workaround.
- A test gives FAIL: change the program until the test gives PASS. Do not change the expected value to make the test pass. Change an expected value only when the user changes the acceptance check.
- A run gives FAIL because a `runUntil` did not get to its target: the program did not get to that state. Find why with c64-emulator.
- The program reads the keyboard hardware, and a key does not arrive: read the keyboard text of c64-emulator. Do not change the program to make it accept a key.
- A patch does not fit, and no unused range has evidence: stop and ask the user.

## Handoffs

- Assemble → c64-assembler
- Run, debug and measure → c64-emulator
- Tests with expected values, and original against rebuild → c64-testing
- The meaning of an address or a register → c64-memory-map
- Patches, names and comments → c64-knowledge
- The source of a rebuilt program → c64-source
- Unused ranges of a rebuilt program → c64-provenance
- Documentation → c64-docs
- Code that nobody understands yet → c64-reverse-engineering
