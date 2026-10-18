---
name: c64-export
description: Use this skill to export a rebuilt C64 program as the start of a new program. The export sets each switch to one value in the code. Corrections, trainers and cheats are in, and copy protection and crack changes are out. It removes code and data that nothing uses. It writes a new project folder with the source, a baseline program, the tests and a small knowledge, and a zip file of the folder. Use it for requests such as "export the project", "start a new game from this rebuild" or "make a clean package of the code". Do not use it to change the rebuild. Use c64-development for that.
---

# c64-export

## Purpose

Make the start of a new program from a rebuilt program. The new program is a new project. A person changes its source directly.

This skill does not change the rebuilt project or its knowledge.

## Inputs

- A rebuilt project: `source.ts generate` of the c64-source skill gives PASS.
- The folder of the new project. It must be new or empty, and no project can hold it. Use a folder beside the project, for example `../game-new`.
- Optional: the coverage of the runs in the knowledge. Without coverage, nothing becomes free by itself.

## Tools / execution path

This skill uses the other skills. It does not use the host runtime directly.

| Work | Skill |
|---|---|
| The export | c64-source: `source.ts export` |
| The switches and the code at an address | c64-knowledge |
| The build of the new project | c64-assembler |
| The tests of the new project | c64-testing |

## Workflow

1. Run `source.ts generate --out src` of c64-source. It must give PASS. If it does not, stop and complete the rebuild with the c64-reverse-engineering skill.
2. Read the switches with `knowledge.ts switches` of c64-knowledge. Tell the user the export value of each switch:
   - `fix`, `trainer` and `cheat`: 1. The code becomes a part of the new program.
   - `protection` and `crack`: 0.
   - `change`: its default.

   If the user wants another value for a switch, change its kind or its default with `knowledge.ts switch` first.
3. Run `source.ts export --to <folder>` of c64-source.
4. Read `unreachableExecuted`. Each range is code that a run executed and that the entry does not get to now. For each range, find the code that calls it with c64-knowledge:
   - Only code that the export removed calls it, for example a copy check: drop it.
   - Code that the knowledge does not show can call it, for example through a pointer: keep it.
   - If you are not sure, ask the user.
5. To drop a range, remove the folder and the zip file of the export. Then run `source.ts export` again with `--drop '<range>'` for each range.
6. Build the new project with c64-assembler. Give `--project <folder>`. Use the build commands in its `README.md`. The build with `--compare` must give PASS.
7. Run each test of the new project with c64-testing. Give `--project <folder>`. Use the test commands in its `README.md`. Each test must give PASS.

### The answer

Give the user a short answer at the end:

1. The folder and the zip file.
2. The value of each switch.
3. The free ranges, with their bytes.
4. Each test and its result, and the tests that the export left out, with the reason.
5. The next step: the c64-development skill, path B.

## Knowledge

Read:

- the switches, and the code at the addresses of `unreachableExecuted`.

Automatic write:

- none in the rebuilt project. The export writes the knowledge of the new project.

## Result

A new project folder and a zip file of it. Its build is identical to its baseline, and each of its tests gives PASS.

## Failure and conflicts

- `export` gives FAIL with `stage`: read `reason`. The c64-source skill tells what to do for each stage.
- `export` refuses the folder: give a new or empty folder outside every project. Remove a folder or a zip file of an earlier export only when this task made it.
- A test of the new project gives FAIL: the export dropped a range that the program uses. Remove the folder and the zip file. Run `export` again with `--keep` for the range, then test again.
- A skill reports `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the whole task. Give the message to the user and wait for the user. Do not make a replacement for the tool or the host runtime.

## Handoffs

- The rebuild is not complete → c64-reverse-engineering
- The export → c64-source
- Switches and the code at an address → c64-knowledge
- The build of the new project → c64-assembler
- The tests of the new project → c64-testing
- A new feature or a fix in the new project → c64-development
