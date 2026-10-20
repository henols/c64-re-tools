---
name: c64-basic
description: Use this skill to decode a C64 BASIC V2 program (PRG) into a readable listing. It also finds where the BASIC gives control to machine code with SYS or USR. Use it on the start file of a game or of a demo. Do not use it on machine code or to run the program. Give the handoff address to the c64-static-analysis or emulator skill.
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
node <skill>/scripts/basic.ts list extracted/game.prg
```

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- The script examines each `--out` path before it starts work. It refuses a path in `.c64-re-tools/knowledge/` and the index of the knowledge, because only c64-knowledge writes them. It refuses a folder where the command writes a file, and a file where the command writes a folder.
- The result is one JSON object on one line. A file that the script writes shows as `{"out", "bytes", "sha256"}`. A list shows as `{"count", "listed"}`, and `rest` tells where to get the rest of a long list.
- An error is `{"error": {"code": "...", "message": "..."}}`. The message tells what is wrong and what to do.
- The exit status is 0 for done or PASS, 1 for FAIL, 2 for an error and 3 for INCONCLUSIVE.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence test:<file>` or `--evidence file:<file>` of c64-knowledge. These two refuse a file in `.c64-re-tools/local/`.
- Do not move a coverage map after `coverage` of c64-knowledge imported it. `--evidence coverage:<map>` names the map by its path at the import. The knowledge keeps the coverage and the SHA-256 of the map, so the evidence stays valid.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Run `list` on the program.
2. Read `listing`. Each line starts with its BASIC line number. Keywords show in lower case. Control characters in strings show in braces, for example `{clr}`.
3. Read `handoffs`. Each handoff has a `kind` (`sys` or `usr`) and the BASIC `line`.
   - A `sys` handoff with an `address`: BASIC calls the machine code at that address. The script calculates a SYS argument with numbers, π, `+`, `-`, `*`, `/` and brackets. For example, `SYS π*656` calls `$080c`.
   - A handoff with `computed: true`: the address comes from a calculation at run time, for example with `PEEK`. A `sys` handoff gives its argument in `expression`. Use the emulator skill to find the address.
4. Compare the address with `loadRange` and `basicEnd`. From `basicEnd` to the end of `loadRange`, the file holds bytes that are not BASIC. Usually this is the machine code that the handoff calls. Some programs have no end marker (two zero bytes) after the last line. The machine code starts directly after the last line. Then `basicEnd` is the first byte of that machine code.

The address ranges are for a load to the load address of the file. A load without `,1` puts a BASIC program at `$0801`. Most loaders have `$0801` as their load address.

## Knowledge

Automatic write:
- none.

Do not store:
- the listing.

The entry point of the machine code can be durable knowledge. The c64-reverse-engineering skill decides that and records it with the c64-knowledge skill.

## Result

The listing and the handoff addresses.

## Failure and conflicts

- `invalid-input` with "is no BASIC program": the file is not a BASIC program. Usually the file is machine code. Give it to the c64-static-analysis skill. A memory dump also gives this error: its first two bytes are not a load address, and its bytes go past `$ffff`.
- An empty `handoffs` list: the BASIC does not start machine code with SYS or USR. Do not make up a handoff. Look for a POKE into a vector or a LOAD of another file in the listing.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- `not-found` or another `invalid-input`: the path or an argument is wrong. Read the message and correct the call.

## Handoffs

- Machine code at the handoff address → c64-static-analysis
- Run the program to the handoff → emulator
- Record the entry point → c64-knowledge
