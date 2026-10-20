---
name: c64-provenance
description: Compares two or more releases of a C64 program byte by byte and tells which releases agree at each difference. It can run each release and tell how the program uses each difference. It gives evidence for each range of the program in the project knowledge. It finds the leftovers in the program, for example texts, assembler source, BASIC lines, unused bytes, copies and dead code. It keeps a library of routines that several programs share, and finds these routines in a program. Use it to separate the original application from the changes of a crack or of a release. Use it to find the history of a program in its leftovers. Use it to find known routines, for example a music driver, in a program. It does not disassemble or analyze the code, and it does not change the project knowledge.
---

# C64 provenance

Use this script to compare releases of a C64 program, to find the leftovers in a program, and to keep a library of shared routines.
Use only the commands of the script. Do not compare releases or search for leftovers in another way.

```bash
node <skill>/scripts/provenance.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `compare releases/a.prg releases/b.prg`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Compare two or more releases | `compare releases/a.prg releases/b.prg releases/c.prg` |
| Compare a release that loads at a different address | `compare releases/a.prg releases/b.prg --shift 2:-256` |
| Compare only the bytes in a range | `compare releases/a.prg releases/b.prg --range '$0900-$09ff'` |
| Map two releases with moved code in blocks of equal bytes | `compare releases/a/image.json releases/b/image.json --align --range '$0400-$bfff'` |
| Find how each release uses each difference | `compare knowledge .c64-re-tools/local/b/image.json --frames 600 --steps .c64-re-tools/local/start-game.json` |
| Get the evidence for each range of the program in the project knowledge | `separate --out .c64-re-tools/local/separate.json` |
| Find the leftovers in the program | `leftovers --out .c64-re-tools/local/leftovers.json` |
| Find short texts, for example a group name | `leftovers --min-text 6` |
| Save a module of the program as a routine of the library | `routine '$1000' --library ../library` |
| Save a range of the program as a routine with a name | `routine '$1000-$1026' --name play --library ../library` |
| Find the routines of the library in the program | `match --library ../library` |
| Write the names of the found routines as a batch of changes | `match --library ../library --out .c64-re-tools/local/match.json` |

---

## Releases and the library

- `compare` takes two or more releases. A release is one of these:
  - `knowledge`: the program in the project knowledge.
  - A PRG file. The script puts it at its load address.
  - The `image.json` of a capture of the unpacked program. Put its `entry_state.json` beside it. Without that file, `--frames` cannot start the release.
- Get a PRG out of a disk image before you compare it. The script refuses a disk image, a tape image and a cartridge image.
- Unpack a packed release before you compare it.
- The first release on the command line is release 1. `--shift` uses these numbers.
- `separate`, `leftovers`, `routine` and `match` read the program in the project knowledge. Put the program, its coverage and its code regions into the project knowledge first.
- The steps file of `--steps` is a JSON list of action steps, for example a key press that starts the game. The steps run before the frames.
- A library is a folder of routine files. Each file holds one routine: its bytes and its knowledge.
- Keep one library beside the project folders, for example `library/` at the root of the workspace. A library is not a project folder. Commit the library with the projects.
- `--library` is relative to the project folder. For example, `../library` is the folder `library/` beside the project.
- The subject of `routine` is the start address of a module, or a range `<start>-<end>`. Get the start addresses from the modules in the project knowledge.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/` and the index of the knowledge. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses evidence in that folder.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--shift <release>:<bytes>` | `compare` | Move a release by a number of bytes. For example, `2:-256` moves release 2 by -256 bytes. Give one shift for each release. The default is no shift. |
| `--range <start>-<end>` | `compare` | Compare only the addresses in this range. The default is all addresses. |
| `--align` | `compare` | Map release 1 to release 2 in blocks of equal bytes. Each block has its own shift. Give two releases. Do not use it with `--shift` or `--frames`. Off by default. |
| `--min-block <n>` | `compare` | With `--align`: the minimum number of bytes in a block, from 8. The default is 16. |
| `--frames <n>` | `compare` | Run each release for `n` frames, and give each listed difference its runtime evidence. The default is no run. |
| `--steps <file>` | `compare` | With `--frames`: run the action steps of this file before the frames. The default is no steps. |
| `--out <file>` | `separate`, `leftovers`, `match` | `separate` and `leftovers` write all items to this file. `match` writes the batch of changes to this file. The default is no file. |
| `--max-listed <n>` | `separate`, `leftovers`, `match` | List at most `n` items of each list. The default is 50. `count` always gives the full number. |
| `--min-text <n>` | `leftovers` | The minimum number of characters in a text, from 4. The default is 8. A short text, for example a group name, can need 6. |
| `--library <folder>` | `routine`, `match` | Required. The library folder. |
| `--name <name>` | `routine` | The name of the routine and of its file. The default is the user or LLM name at the start of the routine. |
| `--title <text>` | `routine` | The title of the routine. The default is the title of the module. |
| `--replace` | `routine` | Write over a routine of the library with the same name. Off by default. |

---

## Compare releases

### `compare <release>...`

Compares the releases byte by byte at the addresses where all releases have bytes.

`body` holds:

- `releases`: the `name`, the `shift` and the `segments` of each release. An image has bytes only in its segments.
- `common`: the ranges where all releases have bytes. The script compares only these ranges.
- `identicalBytes` and `differingBytes`: the counts of the bytes.
- `identicalShare`: the share of identical bytes, with 3 decimals. It is 1 only when no byte differs.
- `differences`: each item has `start`, `end`, `values` and `groups`. `values` gives the bytes of each release, at most 32. `groups` gives the releases that have the same bytes there.
- `moreDifferences: true`: `differences` holds only the first differences.
- `suggestedShifts`: only when `identicalShare` is less than 0.5. Each item has `release`, `shift` and `matchingSequences`. Each release has at most 3 shifts, with the most `matchingSequences` first. `current: true` marks the shift of this run.
- `shiftsNotSuggested`: each item has a `reason`. The reason tells why a shift does not fit in `$0000-$ffff`.

With `--shift`, the addresses of `segments`, `common` and `differences` are the release addresses plus the `shift` of the release.

With `--frames`, the body also holds:

- `runtime` in each difference: one item for each release that started. `start` and `end` are the addresses in the release, without the shift.
  - `first`: the first access in that release: `read`, `write`, `execute` or `none`. An instruction that reads and then writes the same byte, for example INC, counts as `read`. The operand bytes of an executed instruction count as `execute`, for example the `$03` of `LDA #$03`.
  - `changed`: `true` when the bytes at the end of the run are not the bytes of the release.
- `run`: `frames`, `steps` and `releases`. `releases` tells for each release if it started, or the `reason` that it did not start. `skipped` tells that the releases have no differences, so no release ran.

A PRG starts with RUN after its load. An image starts at its entry, with the state of `entry_state.json`.

With `--align`, the body holds a map in place of `differences` and the shift suggestions:

- `blocks`: the blocks of equal bytes, in the order of their addresses in release 1. `a` is the range in release 1. `b` is the range in release 2. `bytes` is the length of the block.
- `shift` of a block: the address in `b` minus the address in `a`. The blocks can have a different order in release 2, because code moved.
- `onlyInA`: the ranges of release 1 that no block holds. Release 2 does not have these bytes, or it has other bytes there.
- `onlyInB`: the ranges of release 2 that no block holds. Release 2 added these bytes, or it changed them.
- `alignedShare`: the share of the bytes of the two releases that a block holds, with 3 decimals.
- Each list holds at most 64 items. `moreBlocks`, `moreOnlyInA` and `moreOnlyInB` count the other items.

`hint` and `nextAction`:

- `identicalShare` is low, and a shift is in `suggestedShifts`: `nextAction` runs `compare` with the first shift that the run does not have. Try each shift. Data that did not move and code that moved give different shifts.
- `identicalShare` is low, and no shift is better: `nextAction` runs `compare` with `--align`. The code and the data can be at other addresses in each release.
- `moreDifferences` or a `more...` count is in the body: `hint` tells you to compare a smaller `--range`.

Traps:

- `common` is empty: the releases do not have bytes at the same addresses. Give `--shift`, or a `--range` that all releases have.
- A release has `started: false`: the PRG has no BASIC start, or the image has no `entry_state.json`. The `reason` tells which. The other releases still give evidence.
- Each release writes a range before it reads it: the range is probably runtime state, not a difference of the releases.
- A range has `first: none` in each release: the run did not use it. Run more frames or other steps before you decide.
- The script refuses `--align` with `--shift` or `--frames`. It refuses `--min-block` without `--align`, and `--steps` without `--frames`.
- Error `not-found`: the project has no file at that path.

---

## Evidence from one program

### `separate`

Gives evidence from the program in the project knowledge, its stages and its coverage. It gives evidence, not a decision.

`body` holds:

- `entry`: the entry of the program.
- `stages` and `bytesByStage`: the number of unpack stages, and the bytes of each stage. `none` counts the bytes that no stage wrote.
- `noStages`: the program has no stage log. Only a capture of the unpack stages has one.
- `bytesByAccess`: the bytes of each access in the coverage.
- `ranges`: the program in ranges with the same stage and access.
  - `stage` is the last unpack stage that wrote the range. The last stage is the program. An earlier stage is a depacker, an intro or a loader.
  - `access` is `executed`, `read`, `written`, `read-written` or `untouched`. `untouched` bytes did not take part in the runs.
  - A `read` byte right after executed code, or at a return address, can be a dummy read of the 6502. The program does not use it.
- `roots`: the addresses where the reachability starts, each with `address` and `from`. The roots are the entry, and the NMI, RESET and IRQ vectors at `$fffa`-`$ffff` when the program holds them. A text in place of the list tells why no code region is reachable.
- `codeRegions.total`: the number of code regions in the project knowledge.
- `codeRegions.unreachable`: the code regions that no chain of call and jump references reaches from a root. The CPU also continues into the next code region when the last instruction of a region is not RTS, RTI, JMP, BRK or JAM.
- `outside`: only with coverage. `read` and `executed` give the RAM outside the program that the program used but did not write. A loader or an earlier stage put these bytes there. `generated` gives the code that the program wrote outside its segments. A `generated` range can have gaps of two bytes or less: these are operand bytes.
- `out`, `bytes` and `sha256`: the file of `--out`. It holds the roots, and all ranges, code regions and outside ranges.

`hint`: a list is cut. Without `--out`, give a larger `--max-listed`, or give `--out`. With `--out`, read the file.

Traps:

- No code regions in the project knowledge: `codeRegions` is empty. Analyze the program for its code regions and its references first.
- Many `untouched` ranges: do more coverage runs for these parts. Put the coverage into the project knowledge before you decide.
- Error `not-found`: the project knowledge has no program. Put the program into the project knowledge.

### `leftovers`

Finds what the program in the project knowledge holds in addition to its working code. It gives evidence, not a decision.

`body` holds `entry`, `roots`, and `stages` or `noStages`, as `separate` gives them. `noCoverage` tells that the project knowledge has no coverage. Then `residue` is empty and no finding has `access`. The body also holds these lists:

| List | What it holds |
|---|---|
| `text` | Text, and lines of assembler source. `encoding` is `petscii`, `screen`, `ascii` or `high-bit`. `reversed: true` marks screen codes with bit 7 set. `source: true` marks lines of assembler source. A line end in `text` is a new line. `mnemonics` counts 6502 instructions in the text. A text of more than 120 characters is cut, and `length` gives its full length. |
| `basic` | Two or more BASIC lines away from the BASIC start. `linkedAt` is the address where BASIC linked the lines. It can be a different address from the address of the bytes now. |
| `fill` | One byte that repeats at least 16 times, or a pattern of two to four bytes that repeats for at least 32 bytes. `pattern` is the repeated bytes. |
| `residue` | Bytes that no run touched, and that are not text, BASIC, fill or a code region. `bytes` shows the first 16 bytes. |
| `copies` | At least 32 bytes that are the same as earlier bytes of the program. `copyOf` is the address of the earlier bytes. |
| `deadCode` | Code regions that no root reaches, as in `codeRegions.unreachable` of `separate`, and that no run executed. |

Each finding has `stages`: the unpack stages that wrote its bytes. A stage before the last stage is a depacker, an intro or a loader. Each finding also has `access`: the accesses of its bytes in the coverage.

`out`, `bytes` and `sha256` give the file of `--out`. It holds all findings with the full texts.

`hint`: a list is cut. Without `--out`, give a larger `--max-listed`, or give `--out`. With `--out`, read the file.

Text from another computer can show the tools of the developer:

- `ascii` is text in ASCII, with small letters. A cross assembler on another computer can leave it.
- `high-bit` is text with bit 7 set. The Apple II keeps text in this form, with `$8d` at the end of a line. Apple II assembler source, for example from Merlin, has `DFB` lines and `*` comments. A C64 text in shifted letters with `$a0` spaces is also `high-bit`.
- The script does not find data of another computer, for example a table of Atari key codes. Examine `residue` and the data that no code reads. Use your knowledge of the other computers.

Read the findings with care:

- A text is a sequence of bytes that looks like text. Some of them are data, for example a character map. A text can include one byte before it or after it that is not part of the text.
- A copy is not always a leftover. A program can copy its code to another address before it runs the code.
- A text in an early stage is often a crack intro. A text that no run read can be an old text of an earlier release.
- Keep the fact apart from the conclusion. "Text at $4770" is a fact. "A recrack by group X" is a conclusion.

Traps:

- No coverage: `residue` is empty. Put the coverage of runs that use many parts of the program into the project knowledge.
- No code regions: `deadCode` is empty, and `residue` can include code. Analyze the program for its code regions first.
- Error `not-found`: the project knowledge has no program. Put the program into the project knowledge.

---

## Library of routines

### `routine <module|range>`

Saves a routine of the program in the project knowledge to the library. The file keeps the user and LLM names, comments, regions, references and operand expressions in the range. It also keeps the code regions of each origin.

- A module ends at the next module, or at the end of its segment.
- A routine has at least 16 bytes. Its last instruction must end in the range.
- Name the routine in the project knowledge before you save it, or give `--name`.

`body` holds:

- `routine`: the name of the routine.
- `out`, `bytes` and `sha256`: the routine file. `out` is relative to the project folder.
- `start`, `end` and `length`: the range of the routine in the program.
- `instructions`: the count of the instructions.
- `relocations`: the count of the addresses into the routine.
- `variable`: the count of the operand bytes that address something outside the routine.
- `counts`: the number of symbols, regions, comments, references and operands that the file keeps.
- `leftOut`: the rows that the file does not keep, and why. For example, the file does not keep an operand expression that uses a name outside the routine.

Traps:

- Error `not-found` with "No module starts at": list the modules of the project knowledge, or give a range.
- Error `invalid-input` with "no code region": analyze the program for its code regions first, or classify the code in the project knowledge.
- Error `invalid-input` with "no user or LLM name": give `--name`.
- Error `conflict`: the library has a routine with that name. Give another `--name`, or give `--replace` to write over it.
- Error `invalid-input` with "is a project folder": the library folder is a project. Give a folder beside the projects.

### `match`

Finds each routine of the library in the program of the project knowledge.

- The opcodes and the other bytes must be equal.
- An address into the routine must point into the routine at its new address.
- An operand that addresses something outside the routine can be different.

`body` holds:

- `library` and `routines`: the library folder and the number of routines in it.
- `matches`: each item has `routine`, `start`, `end` and `shift`. `shift` is the address in the program minus the address in the library.
- `differing` in each match: each operand that addresses something outside the routine and that is different. It gives the value in the `library` and in the `program`. Examine each one. For example, the program can use other variables or another SID voice.
- `batch`: only with `--out`. `out`, `bytes` and `sha256` give the batch file. `writes` counts its writes. `known` counts the writes that the project knowledge has already. `leftOut` lists the writes that the script left out, and why.

The batch has the names, regions, comments, references and operand expressions of each routine at its address in the program. The script leaves out a write in these conditions:

- The program has a user or LLM row at that place.
- The program uses the name at another address.
- A removal holds at that place.
- The routine occurs two times. Only the first copy gets the names.
- The script left out the name that an operand expression uses, or the expression does not give the operand in the program.

`hint` and `nextAction`:

- Without `--out`, with matches: `nextAction` runs `match` with `--out`. Examine `differing` of each match first.
- With `--out`, with writes: `hint` tells you to apply the changes in the batch file to the project knowledge. Read `batch.leftOut` first. Apply the changes as one revision of the LLM.
- No match: `hint` tells that a packed program can hold a routine in a packed form. Unpack the program, put it into the project knowledge, and run `match` again.

Traps:

- `match` does not change the project knowledge.
- Error `not-found`: the library folder does not exist, or it has no routine files. Save a routine with `routine` first.
- Error `invalid-input` with "is a project folder": the library folder is a project. Give a folder beside the projects.

---

## Workflow

### Compare releases

1. Run `compare` on the releases.
2. Read `identicalShare`. If it is low, run the `nextAction`. Try each shift in `suggestedShifts`. If no shift gives a high `identicalShare`, run `compare` with `--align`.
3. Read `differences`.
4. To find how the program uses the differences, run `compare` again with `--frames`. Give the frames and the steps that get the program to the part that you examine. Read `runtime` of each difference.
5. Examine each important difference. Disassemble or analyze the bytes of each release. Find what the change does, for example a trainer, a removed copy protection, or a changed text.
6. Decide which bytes are probably the original application. Use more than the byte comparison: the code, the text, and the history of the releases.
   - Do not call releases independent when you do not know their relation. Two cracks can come from the same source.
   - Do not call a byte original only because one release has it. A majority of releases is also not proof.
7. Record each release in the project knowledge. The base release is the program in the project knowledge.
8. Record each difference in the project knowledge as a switch and a patch. Select the kind of the switch:
   - `protection`: a copy protection, or the code that a crack changed to remove it.
   - `trainer` or `cheat`: a trainer or a cheat.
   - `crack`: another change of a cracker in the program, for example a credit text.
   - `fix`: a correction of a bug. Make one switch for each correction, not one switch for each release.
   - `change`: another difference.
9. Give the switch the labels of the releases that have it on. The patch holds the bytes that the base release does not have.
10. Record each other conclusion in the project knowledge as a comment or a region. Do not record the full comparison.

### Find the leftovers

1. Capture the unpack stages of the program, and put the capture into the project knowledge.
2. Put the coverage of runs that use many parts of the program into the project knowledge.
3. Analyze the program for its code regions.
4. Run `leftovers`. When you have two or more releases, also run `compare`.
5. Read `text` first: names, dates, greetings and credits. Then read `copies`, `residue`, `basic` and `deadCode`.
6. Examine each important finding. Disassemble or analyze its bytes, or examine them in the emulator.
7. Record each finding that you proved in the project knowledge. Do not record the full list of leftovers.
   - Do not remove a leftover from the program. A rebuild keeps it. Only the data of a cracktro goes out: leave it out of the capture of the program.
   - Classify a PETSCII text that you proved as a `petscii` region, and a screen code text as a `screen` region. Classify other text as `bytes`.
   - Write a comment that tells what the leftover is.

### Share routines

1. Put the program into the project knowledge, and name the routine there.
2. Run `routine`. Read `leftOut`.
3. In another project, put the program into the project knowledge. Run `match`.
4. Run `match` with `--out`. Read `batch.leftOut`.
5. Apply the changes in the batch file to the project knowledge.

---

## JSON output

Each command prints one JSON envelope on one line on stdout. Notes go to stderr.

On success, the exit code is 0:

```json
{"ok": true, "command": "<command>", "body": {}, "hint": "...", "nextAction": "..."}
```

On failure, the exit code is 2:

```json
{"ok": false, "command": "<command>", "code": "<code>", "error": "...", "hint": "...", "nextAction": "..."}
```

- `body` holds the result. The section of each command gives the fields of its body.
- A check gives its verdict in `body.result`: `PASS`, `FAIL` or `INCONCLUSIVE`. The exit code is 0 for each verdict. Thus read `body.result`, not the exit code.
- `error` is one sentence. It tells what is wrong.
- `hint` tells what to do or what to examine. Read it before your next step. Some envelopes have no `hint`.
- `nextAction` is a full command line. It runs from any directory. Run it when it agrees with your task. Some envelopes have no `nextAction`.
- `code` does not change between versions. Do the action for the code:

| `code` | Action |
|---|---|
| `installation-incomplete`, `machine-unavailable` | Stop the task. Give `error` and `hint` to the user and wait for the user. Do not install, start or change a tool. Do not make a replacement for the tool, for example your own disk parser, disassembler or emulator script. |
| `invalid-input`, `not-found` | Correct the call as `hint` tells. Then run the command again. |
| `operation-failed` | Give `error` and `hint` to the user. |
| Another code | Do as `hint` tells. |

These fields have the same meaning in each body:

| Field | Meaning |
|---|---|
| `out`, `bytes`, `sha256` | A file that the command wrote: its path, its size and its SHA-256. |
| `count`, `listed`, `rest` | A list. `count` is the number of items. `listed` holds the first items, at most `--max-listed`. `rest` tells how to get the other items. |

To get the command list, run the script with no arguments. The envelope has `command: "help"`, and `body.commands` gives the name, the summary and the synopsis of each command.
To get the subjects and the flags of one command, run `<command> --help`. Then `body.subjects` and `body.options` give them.
