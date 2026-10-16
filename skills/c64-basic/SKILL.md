---
name: c64-basic
description: Use this skill to decode a C64 BASIC V2 program (PRG) into a readable listing. It also finds where the BASIC gives control to machine code with SYS or USR. Use it on the start file of a game or of a demo. Do not use it on machine code or to run the program. Give the handoff address to the c64-static-analysis or c64-emulator skill.
---

# c64-basic

## Purpose

Decode a C64 BASIC V2 program. Find the handoff from BASIC to machine code.

This skill does not run the program and does not change project knowledge.

## Inputs

- The program: a PRG file, relative to the project folder.

## Tools / execution path

The script sends the program to the host runtime. The host decodes it with petcat and finds the handoffs.

```
node <skill>/scripts/basic.ts extracted/game.prg
```

The script prints one JSON object. Addresses are `$` and four hex digits.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence` of c64-knowledge. `--evidence` refuses a file in `.c64-re-tools/local/`.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Run the script on the program.
2. Read `listing`. Each line starts with its BASIC line number. Keywords show in lower case. Control characters in strings show in braces, for example `{clr}`.
3. Read `handoffs`. Each handoff has a `kind` (`sys` or `usr`) and the BASIC `line`.
   - A `sys` handoff with an `address`: BASIC calls the machine code at that address. The script calculates a SYS argument with numbers, π, `+`, `-`, `*`, `/` and brackets. For example, `SYS π*656` calls `$080c`.
   - A handoff with `computed: true`: the address comes from a calculation at run time, for example with `PEEK`. A `sys` handoff gives its argument in `expression`. Use the c64-emulator skill to find the address.
4. Compare the address with `loadRange` and `basicEnd`. From `basicEnd` to the end of `loadRange`, the file holds bytes that are not BASIC. Usually this is the machine code that the handoff calls. Some programs have no end marker (two zero bytes) after the last line. The machine code starts directly after the last line. Then `basicEnd` is the first byte of that machine code.

The address ranges are for a load to the load address of the file. A load without `,1` puts a BASIC program at `$0801`. Most loaders have `$0801` as their load address.

## Knowledge

Automatic write:
- none.

Do not store:
- the listing.

The entry point of the machine code can be durable knowledge. The c64-reverse-engineering skill decides that and records it with the c64-knowledge skill.

## Result

The listing and the handoff addresses. Or `decoded: false` with a reason when the file is not a BASIC program.

The exit status is 0 for a listing. The exit status is 1 for `decoded: false` and for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `decoded: false`: the file is not a BASIC program. This is a normal result. Usually the file is machine code. Give it to the c64-static-analysis skill. A memory dump also gives `decoded: false`: its first two bytes are not a load address, and its bytes go past `$ffff`.
- An empty `handoffs` list: the BASIC does not start machine code with SYS or USR. Do not make up a handoff. Look for a POKE into a vector or a LOAD of another file in the listing.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `not-found` or `invalid-input`: the path or an argument is wrong. Read the message and correct the call.

## Handoffs

- Machine code at the handoff address → c64-static-analysis
- Run the program to the handoff → c64-emulator
- Record the entry point → c64-knowledge
