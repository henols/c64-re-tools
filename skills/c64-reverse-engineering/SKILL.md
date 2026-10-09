---
name: c64-reverse-engineering
description: Use this skill to reverse engineer a C64 program or a part of it. The work goes from an unknown disk or file to documented understanding or a rebuilt program. It decides what to learn next and which specialist skill does that work. Use it for questions such as "what does this game do", "find the main loop", "understand $2100" or "rebuild this program".
---

# c64-reverse-engineering

## Purpose

Coordinate the reverse engineering of a C64 program. Decide the next unknown to examine and the specialist skill that examines it.

This skill does not do the specialist work itself.

## Inputs

- The subject: a disk image or a program file in the project, or a program that runs in the emulator.
- The scope: the question or the target. Examples:
  - identify the main loop
  - understand the routine at `$2100`
  - find the IRQ handler
  - reconstruct the input system
  - reverse engineer and rebuild the whole program
- The current project knowledge.

## Tools / execution path

This skill uses the other skills. It does not use the host runtime or the emulator directly.

## Workflow

1. Write down the scope. Stop when the scope is complete.
2. Read the current knowledge for the subject with the c64-knowledge skill. Do not examine again what the knowledge already explains.
3. Find the next unknown or blocker, and use the specialist for it:

| Unknown | Skill |
|---|---|
| The files on a disk image, or a file to extract | c64-disk |
| A BASIC program, and where it starts machine code | c64-basic |
| A program that can be packed or crunched | c64-unpacker |
| What the program does at run time: values, input, timing, screen | c64-emulator |
| The routines, code, data and references of the program | c64-static-analysis |
| The platform meaning of an address or a register | c64-memory-map |
| Differences between releases of the program | c64-provenance |
| Source code to build | c64-assembler |
| Proof that a rebuild behaves as the original | c64-testing |

4. Interpret the result. Keep observed facts apart from your conclusions.
5. Record each conclusion that the evidence supports with the c64-knowledge skill: names of routines and variables, data classifications, comments.
6. Go back to step 3 until the scope is complete.
7. For a rebuild scope: write the source, build it with the c64-assembler skill, and test it against the original with the c64-testing skill.

A typical order for an unknown program:

1. c64-disk: list the disk and extract the start file.
2. c64-basic: find the SYS address of the BASIC start.
3. c64-unpacker: find out if a packer compressed the program. Unpack it if necessary.
4. c64-emulator: run the program and observe it.
5. c64-static-analysis: find the routines, regions and references.
6. c64-knowledge and c64-memory-map: name the important routines and variables.
7. c64-static-analysis again: Ghidra now uses the names.
8. c64-assembler and c64-testing: rebuild and test when the scope asks for it.

## Knowledge

Read:
- the knowledge for the addresses, ranges and routines in the scope
- the history of a conclusion that is surprising or that a person disputes.

Automatic write:
- none directly.

Record durable conclusions with the c64-knowledge skill. Do not store:
- the state of the current investigation
- a name only because a routine needs a temporary name
- guesses.

## Result

A clear answer for the scope, with the durable conclusions in the project knowledge. For a rebuild scope, also a rebuilt program that passes its tests.

## Failure and conflicts

- If the evidence does not support a conclusion, keep the unknown and get more evidence. Do not make up a meaning.
- Before you replace current knowledge from the user or the LLM, read its history and the evidence for it.
- A conflict from the static analysis: find the correct answer at run time with the c64-emulator skill.
- A test that is INCONCLUSIVE does not show a defect. Find why the test could not compare.

## Handoffs

All specialist skills in the table above.
