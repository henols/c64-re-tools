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

Select the path for the scope:

- A narrow scope, for example one routine, the IRQ handler or the input system: use the loop.
- A full rebuild of the program: use the stages.

### The loop

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
| Source code from the knowledge | c64-source |
| Source code to build | c64-assembler |
| Proof that a rebuild behaves as the original | c64-testing |

4. Interpret the result. Keep observed facts apart from your conclusions.
5. Record each conclusion that the evidence supports with the c64-knowledge skill: names of routines and variables, data classifications, comments.
6. Go back to step 3 until the scope is complete.

### The stages of a full rebuild

Do the stages in this sequence. Go to the next stage only when its exit check is true, or when the user accepts an exception. Write each exception in the report.

| Stage | Work | Exit check |
|---|---|---|
| 1. Acceptance | Ask the user for the criteria of the rebuild. Offer these: identical source, a verified loader, passed c64-testing scenarios, a list of the code that no run executed. Write the criteria in `report.md`. | The user gave the criteria. |
| 2. Get | c64-disk: list the disk. Extract the start file into `original/`. | The start file is in the project. |
| 3. Start | c64-basic: find the SYS address of the BASIC start. | You have the entry address. |
| 4. Unpack | c64-unpacker: examine the program. Capture a packed program into `unpacked/`. | `image.json` and `entry_state.json` exist, or the evidence shows no packer. |
| 5. Run | c64-emulator and the run of c64-testing: run each part that the scope names. Write a coverage file for each part into `coverage/`. | Each part that the scope names has a coverage file. |
| 6. Analyze | c64-static-analysis with `--coverage` for each coverage file. | No coverage conflict is open. |
| 7. Name | c64-knowledge and c64-memory-map: name each routine in the scope and give it a comment. Record the modules. | Each routine in the scope has a name and a comment. |
| 8. Generate | c64-source with `--coverage` into `src/`. For an unpacked program, add `--loader`. | `check.identical` is true. For an unpacked program, `loader.verified` is true. |
| 9. Build and test | c64-assembler with `--compare` into `build/`. c64-testing scenarios in `tests/`. | The criteria of stage 1 are true. |
| 10. Report | Write `report.md`. | The report has all its sections. |

In stage 5, if you cannot get to a part of the program, ask the user how to get to it. Do stages 7 and 8 again until the source is clear. Each run of c64-source writes the source again.

### Deliverables of a full rebuild

- `.c64-re-tools/knowledge.db` with the names, regions, comments and modules
- the image and the entry state
- the coverage files
- the generated source
- the built program and the loader
- the c64-testing scenarios and their results
- `report.md`.

### The report

`report.md` is short. It has these sections:

1. Acceptance: each criterion of stage 1 and its result, and each exception that the user accepted.
2. The program: what the program does, in a few sentences.
3. Modules: the file, the address range and the title of each module.
4. Untested code: all ranges in the `not_executed.json` file of c64-source. Tell why no run executed them, if you know.
5. Open questions: what the evidence does not explain.

Keep observed facts apart from your conclusions.

### Project layout

If the project has no layout, use this one. It is a proposal. No script checks it. Each script takes the paths that you give.

```
original/      the disk image or the program as you got it
unpacked/      image.json, image.bin and entry_state.json from c64-unpacker
coverage/      coverage files from c64_memmap
src/           the generated source from c64-source
build/         programs from c64-assembler
tests/         c64-testing scenarios and their results
report.md      the report
```

If the project has a layout, use that layout.

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

A clear answer for the scope, with the durable conclusions in the project knowledge. For a full rebuild, the deliverables and the report, with the criteria of the user met or each exception in the report.

## Failure and conflicts

- A skill reports `installation-incomplete`, or a message that the host runtime does not run: stop the whole task. Give the message to the user and wait for the user. Do not continue with other skills. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- If the evidence does not support a conclusion, keep the unknown and get more evidence. Do not make up a meaning.
- Before you replace current knowledge from the user or the LLM, read its history and the evidence for it.
- A conflict from the static analysis: find the correct answer at run time with the c64-emulator skill.
- A test that is INCONCLUSIVE does not show a defect. Find why the test could not compare.

## Handoffs

All specialist skills in the table above.
