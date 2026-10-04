---
name: c64-basic
description: Use this skill to decode a C64 BASIC V2 program (PRG) into a readable listing. It also finds where the BASIC gives control to machine code with SYS or USR. Use it on the start file of a game or of a demo. Do not use it on machine code or to run the program. Give the handoff address to the c64-static-analysis or c64-emulator skill.
---

# c64-basic

## Purpose

Decode a C64 BASIC V2 program. Find the handoff from BASIC to machine code.

This skill does not run the program and does not change project knowledge.

## Inputs

- The program: a PRG file, relative to the project directory.

## Tools / execution path

The script sends the program to the host runtime. The host decodes it with petcat and finds the handoffs.

```
node <skill>/scripts/basic.ts extracted/game.prg
```

The script prints one JSON object. Addresses are `$` and four hex digits.

## Workflow

1. Run the script on the program.
2. Read `listing`. Each line starts with its BASIC line number. Keywords show in lower case. Control characters in strings show in braces, for example `{clr}`.
3. Read `handoffs`. Each handoff has a `kind` (`sys` or `usr`) and the BASIC `line`.
   - A `sys` handoff with an `address`: BASIC calls the machine code at that address.
   - A handoff with `computed: true`: the address comes from a calculation at run time. Use the c64-emulator skill to find the address.
4. Compare the address with `loadRange` and `basicEnd`. From `basicEnd` to the end of `loadRange`, the file holds bytes that are not BASIC. Usually this is the machine code that the handoff calls.

The address ranges are for a load to the load address of the file. A load without `,1` puts a BASIC program at `$0801`. Most loaders have `$0801` as their load address.

## Knowledge

Automatic write:
- none.

Do not store:
- the listing.

The entry point of the machine code can be durable knowledge. The c64-reverse-engineering skill decides that and records it with the c64-knowledge skill.

## Result

The listing and the handoff addresses. Or `decoded: false` with a reason when the file is not a BASIC program.

## Failure and conflicts

- `decoded: false`: the file is not a BASIC program. This is a normal result. Usually the file is machine code. Give it to the c64-static-analysis skill.
- An empty `handoffs` list: the BASIC does not start machine code with SYS or USR. Do not make up a handoff. Look for a POKE into a vector or a LOAD of another file in the listing.
- `installation-incomplete`: petcat is not on the host. Tell the user the message.
- `operation-failed` with a message about the host runtime: the host runtime does not run. Tell the user to start the host runtime with `npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host`.
- `not-found` or `invalid-input`: the path or an argument is wrong. Read the message and correct the call.

## Handoffs

- Machine code at the handoff address → c64-static-analysis
- Run the program to the handoff → c64-emulator
- Record the entry point → c64-knowledge
