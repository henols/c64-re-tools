# Export

This file gives the free ranges of an export and the files of the new project. For the command, see the section "Export a new program" of `SKILL.md`.

## The free ranges

A block of code stops after RTS, RTI, JMP, BRK or a JAM, and before a gap. A block of code becomes free only when both of these are true:

- No run of the coverage executed it.
- No path gets to it from the entry, the hardware vectors or the code that stays. A path is a call, a jump, a branch, a reference of the knowledge or an operand expression. An entry of a table, and two immediate operands that give its address, are paths too.

Two immediate operands give an address only in these cases:

- The code stores the low byte and the high byte to two adjacent addresses outside $d000-$dfff.
- The code calls a routine with the low byte and the high byte in two registers.
- The code pushes the high byte and then the low byte onto the stack.

An operand expression of the knowledge at an immediate operand replaces these cases for that operand. Thus an operand expression with a constant stops a wrong address.

Code that a run executed always stays. `unreachableExecuted` lists the executed code that the entry and the vectors do not get to. An example is a copy check whose call the export removed. Give its `drop` value to `export` to make it free.

Data becomes free only when all of these are true:

- Its region type is `bytes`, `words`, a table of addresses, `petscii`, `workspace` or `unused`.
- No run read, wrote or executed a byte of it.
- No code that stays reads it or names it. No table that stays has an entry in it.
- It is not in the BASIC line that starts the program, and not at $fffa-$ffff.
- No `charset`, `sprite`, `bitmap` or `screen` region has a byte of it. For example, `unused` bytes in a bitmap stay.

The coverage does not show the reads of the VIC-II. Thus `charset`, `sprite`, `bitmap` and `screen` data stay, unless `--drop` names them. The bytes of the start screen always stay. Bytes without a region also stay.

The entry is the entry of the knowledge. Without it, the entry is the address of the first SYS in the BASIC line of the program. Without coverage, nothing becomes free without `--drop`. Without an entry and without the hardware vectors in the program, no code is unreachable.

## The new project

```text
README.md                  the steps to build and test, the free ranges and the origin
src/                       main.asm, constants.asm, macros.asm, the modules in their folders and loader.asm
baseline/<name>.prg        the exported program, and baseline/<name>.json with its symbols
tests/                     the tests of the project, changed for the new program
.c64-re-tools/knowledge/   the knowledge of the new program
```

- The source has no mark line, no `switches.asm` or `config.asm`, no patch zones and no `; not executed` lines. A start screen stays in the loader. Build with `-DSTART_SCREEN=0` to start the program at once. It keeps the names, the comments, the operand expressions and the macros. A line comment at each changed patch gives the switch, its kind, its value and the comments.
- The knowledge has one revision `export`. It holds the program, the entry and its state, the names, the comments, the regions, the modules and the start screen. It has no history, analyzer names, references, operand expressions, macros, patches, switches, releases or coverage.
- A scenario of `tests/` compares the build of the new project with the baseline. Both sides are the same program. Thus a step of the reference side alone goes. A step of the rebuild side alone runs on both sides.
- A run file of `tests/` runs the build of the new project. Scenarios and run files take the names from the symbol files.
- The export leaves out a test that restores a snapshot. It also leaves out a test with a name that the new program does not have, or with an address in a free range.
- The export does not copy recordings, record files or `runs/`.
- The zip file holds the folder without `.c64-re-tools/local/`.
