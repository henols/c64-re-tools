---
name: c64-testing
description: Use this skill to test if a rebuilt or changed C64 program behaves as the original. It runs one scenario on the original and then on the rebuild in an emulator. It compares memory, registers, chip state and the screen with explicit rules, and gives PASS, FAIL or INCONCLUSIVE. It also makes a checklist for a human playtest. Do not use it to find the cause of a difference.
---

# c64-testing

## Purpose

Test if a rebuild or a changed program behaves as the original in a scenario. Give one result: PASS, FAIL or INCONCLUSIVE.

A PASS proves only the behavior that the scenario does and observes. It does not prove that the two programs are equal in all behavior.

## Inputs

- The original program and the rebuild: PRG files in the project.
- The symbols of each side. For the original, the project knowledge. For the rebuild, the JSON output of the c64-assembler skill in a file.
- A scenario file: the steps, the checkpoints and the observations. See [references/scenario-format.md](references/scenario-format.md).

## Tools / execution path

The script starts one emulator through the host runtime. It runs the scenario on the original, then resets the emulator and runs the scenario on the rebuild.

```
node <skill>/scripts/test.ts tests/moves-left.json
node <skill>/scripts/checklist.ts tests/moves-left.json --item 'FIRE starts the game.'
```

The test script prints one JSON object. The exit status is 0 for PASS, 1 for FAIL, 3 for INCONCLUSIVE and 2 for a bad call.

The checklist script prints a Markdown checklist for a human tester.

## Workflow

1. Write the scenario file. Start with a reset and a frame count, so both sides start from the same state.
2. Use symbol names, for example `player_x`, not fixed addresses. Each side finds the name in its own symbols. Use a `$` address only when both programs use the same address.
3. Make each checkpoint a condition, for example `runUntil` at a routine. Do not wait for a time.
4. Save the c64-assembler output of the rebuild to the symbol file: `assemble.ts ... > build/game.json`.
5. Run the test script.
6. Read the result:
   - `PASS`: all observations are equal, or the differences are in the allowed tolerance.
   - `FAIL`: `differences` lists each difference with the checkpoint, the item, the original value and the rebuild value.
   - `INCONCLUSIVE`: `reason` tells why the script could not compare. This is not a failure of the program.
7. For a FAIL, examine the first difference with the c64-emulator skill.

## Knowledge

Read:
- the symbols of the original from the project knowledge.

Automatic write:
- none.

Do not store:
- test results
- screenshots
- playtest results.

## Result

PASS, FAIL or INCONCLUSIVE, the checkpoints and the smallest differences that explain a FAIL.

## Failure and conflicts

- INCONCLUSIVE, "did not reach the checkpoint": one side did not reach the checkpoint in the frame limit. Find the reason with the c64-emulator skill. Do not report a FAIL.
- INCONCLUSIVE, "has no symbol": one side has no symbol with that name. Add the name to the knowledge or to the rebuild source.
- INCONCLUSIVE, "no emulator" or "could not run": the host runtime or the emulator failed. Tell the user the message.
- A FAIL with only a `screen` difference: add `vicii` or `sprites` to the observation to find which chip state is different.
- A program that uses random numbers: set the random seed with a `write` step on both sides. If that is not possible, observe only values that do not depend on the random numbers.

Do not add a mask or a tolerance only to make a test pass. A tolerance must have a reason in the behavior of the program.

## Handoffs

- Find the cause of a difference → c64-emulator
- Find the code that causes it → c64-static-analysis
- Rebuild after a correction → c64-assembler
- Record a confirmed conclusion → c64-knowledge
