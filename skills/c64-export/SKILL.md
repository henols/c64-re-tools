---
name: c64-export
description: Exports a rebuilt C64 program as the start of a new program. The export sets each switch to one value in the code. Corrections, trainers and cheats are in, and copy protection and crack changes are out. It removes code and data that nothing uses. It writes a new project folder with the source, a baseline program, the tests and a small knowledge, and a zip file of the folder. Use it when the user asks to "export the project", "start a new game from this rebuild" or "make a clean package of the code". It does not change the rebuilt project or its knowledge.
---

# C64 export

## Purpose

Make the start of a new program from a rebuilt program. The new program is a new project. A person changes its source directly.

Do not change the rebuilt project or its knowledge.

## Inputs

- A rebuilt project: the generation of its source from the project knowledge gives PASS.
- The folder of the new project. It must be new or empty, and no project can hold it. Use a folder beside the project, for example `../game-new`.
- Optional: the coverage of the runs in the knowledge. Without coverage, nothing becomes free by itself.

## Workflow

1. Generate the source from the project knowledge into `src`. Continue only when the result is PASS. If it is not PASS, stop. Complete the rebuild of the program first.
2. Read the switches in the project knowledge. Tell the user the export value of each switch:
   - `fix`, `trainer` and `cheat`: 1. The code becomes a part of the new program.
   - `protection` and `crack`: 0.
   - `change`: its default.

   If the user wants another value for a switch, change its kind or its default in the project knowledge first.
3. Export the program of the project knowledge to the folder of the new project.
4. Read `unreachableExecuted` in the result of the export. Each range is code that a run executed and that the entry does not get to now. For each range, find the code that calls it in the project knowledge:
   - Only code that the export removed calls it, for example a copy check: drop the range.
   - Code that the knowledge does not show can call it, for example through a pointer: keep the range.
   - If you are not sure, ask the user.
5. To drop a range, remove the folder and the zip file of the export. Then export again, and drop each range.
6. Build the new project with the build commands in its `README.md`. Use the new folder as the project. The build that compares with the baseline must give PASS.
7. Run each test of the new project with the test commands in its `README.md`. Use the new folder as the project. Each test must give PASS.

### The answer

Give the user a short answer at the end:

1. The folder and the zip file.
2. The value of each switch.
3. The free ranges, with their bytes.
4. Each test and its result, and the tests that the export left out, with the reason.
5. The next step: develop features and fixes in the source of the new project.

## Knowledge

Read the switches, and the code at the addresses of `unreachableExecuted`.

Do not write to the knowledge of the rebuilt project. The export writes the knowledge of the new project.

## Result

A new project folder and a zip file of it. Its build is identical to its baseline, and each of its tests gives PASS.

## Failure and conflicts

- The export gives FAIL: read `stage` and `reason`. Do as `reason` tells.
- The export refuses the folder: give a new or empty folder outside every project. Remove a folder or a zip file of an earlier export only when this task made it.
- A test of the new project gives FAIL: the export dropped a range that the program uses. Remove the folder and the zip file. Export again and keep the range. Then test again.
- A task reports `installation-incomplete` or `machine-unavailable`: stop the whole task. Give the message to the user and wait for the user. Do not continue with other tasks.
