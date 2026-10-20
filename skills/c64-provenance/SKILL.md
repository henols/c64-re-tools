---
name: c64-provenance
description: Use this skill to compare two or more releases of a C64 program, for example cracked versions from different groups. It finds the bytes where the releases differ and shows which releases agree there. It can run each release and tell how the program uses each difference. It also gives evidence for each range of the program in the knowledge. The evidence is the unpack stage, the access, and the code that the entry does not reach. It also finds leftovers in one program: texts, assembler source, BASIC lines, fills, unused bytes, copies and dead code. It finds text of other computers, for example Apple II source. Leftovers tell about the development, the cracks and the recracks. Use the result to separate the content of the application from changes that a release added. It also keeps a library of routines that several programs share. It finds them in the program of the knowledge and writes their names as a batch for c64-knowledge. Do not use it to analyze the code.
---

# c64-provenance

## Purpose

Compare releases of a C64 program. Find the bytes where they differ and which releases agree. Use this to find which bytes are probably the original application and which are changes of one release.

Find the leftovers in one program. A leftover is a part of the program that the program does not need. Examples are a crack text, an old copy of a routine and a piece of assembler source.

Keep a library of routines that several programs share, for example a music driver or a decruncher. Find the routines of the library in a program, and get their names for that program.

This skill does not change project knowledge.

## Inputs

- Two or more releases, relative to the project folder. A release is `knowledge` (the program in the knowledge), a PRG file, or an `image.json` from c64-unpacker capture with its `entry_state.json` beside it. Extract releases from disk images with the c64-disk skill. Unpack packed releases with the c64-unpacker skill first.
- Optional: an address range to compare.
- Optional: a shift for a release that loads at a different address.
- Optional: `--align`, to map two releases with moved code in blocks of equal bytes.
- Optional: a number of frames to run each release, and a steps file.
- For one release: the program, the coverage and the other knowledge of the project. Put the program and the coverage in with `image` and `coverage` of the c64-knowledge skill.
- For the library: the program and the other knowledge of its project, and the library folder.

## Tools / execution path

The script compares the releases locally. Only `--frames` uses the host runtime: each release runs in its own emulator.

```
node <skill>/scripts/provenance.ts compare releases/a.prg releases/b.prg releases/c.prg
node <skill>/scripts/provenance.ts compare releases/a.prg releases/b.prg --shift 2:-256 --range '$0900-$09ff'
node <skill>/scripts/provenance.ts compare releases/a/image.json releases/b/image.json --align --range '$0400-$bfff'
node <skill>/scripts/provenance.ts compare knowledge .c64-re-tools/local/b/image.json --frames 600 --steps .c64-re-tools/local/start-game.json
node <skill>/scripts/provenance.ts separate --out .c64-re-tools/local/separate.json
node <skill>/scripts/provenance.ts leftovers --out .c64-re-tools/local/leftovers.json
```

| Option | Meaning |
|---|---|
| `--shift 2:-256` | Move release 2 (the first release is 1) by -256 bytes. Use it again for more releases. Give one shift for each release. |
| `--range '$0900-$09ff'` | Compare only the addresses in this range. |
| `--align` | Map release 1 to release 2 in blocks of equal bytes. Each block has its own shift. Give two releases. Do not use it with `--shift` or `--frames`. |
| `--min-block 24` | With `--align`: the minimum number of bytes in a block. The default is 16. |
| `--frames 600` | Run each release for this many frames, and give each listed difference its runtime evidence. |
| `--steps .c64-re-tools/local/start-game.json` | With `--frames`: a JSON list of action steps to run before the frames, for example a key to start the game. The steps are the steps of a c64-unpacker steps file. |

The script puts each PRG at its load address. An image has bytes only in its segments. The script compares the addresses where all releases have bytes.

With `--shift`, the addresses of `segments`, `common` and `differences` are the release addresses plus the `shift` of the release. The `start` and `end` of `runtime` are the addresses in the release itself, without the shift.

Use `--align` for two releases with added code and moved data. One shift does not fit them, and the shift suggestions are not useful. The map tells what each block of one release is in the other release. With `--align`, the result has the map, not `differences` and not the shift suggestions:

- `blocks`: the blocks of equal bytes, in the order of their addresses in release 1. `a` is the range in release 1. `b` is the range in release 2. `bytes` is the length of the block.
- `shift`: the address in `b` minus the address in `a`. The address of a byte in release 2 is its address in release 1 plus the `shift` of its block. The blocks can have a different order in release 2, because code moved.
- `onlyInA`: the ranges of release 1 that no block holds. Release 2 does not have these bytes, or it has other bytes there.
- `onlyInB`: the ranges of release 2 that no block holds. Release 2 added these bytes, or it changed them.
- `alignedShare`: the share of the bytes of the two releases that a block holds, with 3 decimals.
- Each list shows at most 64 items. `moreBlocks`, `moreOnlyInA` and `moreOnlyInB` give the number of the items that the list does not show. Use `--range` to see them.

With `--frames`, a PRG starts with autostart and RUN. An image starts from its bytes: the script writes the segments and the entry state from `entry_state.json` into the emulator, and starts at the entry. Watchpoints on each difference stop the run at its first access.

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

1. Run the script on the releases.
2. Read `identicalShare`. If it is low and `suggestedShifts` is present, the releases are at different addresses. Run the script again with a `--shift` of `suggestedShifts`. `shiftsNotSuggested` tells why a found shift does not fit in `$0000-$ffff`. If no shift gives a high `identicalShare`, the code and the data can be at other addresses in each release. Then run the script again with `--align`.

   `suggestedShifts` has at most 3 shifts for each release. The shift with the most `matchingSequences` is first. Data that did not move and code that moved give different shifts. Try each shift. `current: true` marks the shift of this run.
3. Read `differences`. Each one has an address range, the bytes of each release, and `groups`: the releases that have the same bytes there.
4. To know how the program uses the differences, run the script again with `--frames` and the frames that get the program to the part you examine. Read `runtime` of each difference:
   - `first`: the first access in that release: `read`, `write`, `execute` or `none`. An instruction that reads and then writes the same byte, for example INC, counts as `read`. The operand bytes of an executed instruction count as `execute`, for example the value of `LDA #$03`.
   - `changed`: `true` when the bytes at the end of the run are not the bytes of the release.
   - A range that each release writes before it reads is probably runtime state, not a difference of the releases.
   - A range with `none` in each release is not used in this run. Run more frames or other steps before you decide.
   - `run.skipped`: the releases have no differences, so no release ran.
5. Examine each important difference:
   - Disassemble the bytes of each release with the emulator skill, or analyze them with the c64-static-analysis skill.
   - Find what the change does, for example a trainer, a removed copy protection, or a changed text.
6. Decide which bytes are probably the original application. Use more than the byte comparison: the code, the text, and the history of the releases.
7. Record each release with `release` of the c64-knowledge skill. The base release is the program of the knowledge.
8. Record each difference as a switch and a patch with the c64-knowledge skill. Select the kind of the switch:
   - `protection`: a copy protection, or the code that a crack changed to remove it.
   - `trainer` or `cheat`: a trainer or a cheat.
   - `crack`: another change of a cracker in the program, for example a credit text.
   - `fix`: a correction of a bug. Make one switch for each correction, not one switch for each release.
   - `change`: another difference.
9. Give the switch the labels of the releases that have it on. The patch holds the bytes of the state that the base release does not have.
10. Record each other conclusion as a comment or a region with the c64-knowledge skill.

## One release

Use `separate` when you have only one release. It reads the program, its stages and the coverage from the knowledge. It gives evidence, not a decision:

- `ranges`: the program in ranges with the same stage and access. `stage` is the last unpack stage that wrote the range. The last stage is the program. An earlier stage is a depacker, an intro or a loader. Only a capture of c64-unpacker `capture` has stages. For a program from `loads` or a PRG, `noStages` tells this.
- `access`: from the coverage of the knowledge: `executed`, `read`, `written`, `read-written` or `untouched`. `untouched` bytes did not take part in the runs. A `read` byte right after executed code, or at a return address, can be a dummy read of the 6502 that the program does not use.
- `codeRegions.total`: the number of code regions in the knowledge.
- `roots`: the addresses where the reachability starts. They are the entry, and the NMI, RESET and IRQ vectors at `$FFFA`-`$FFFF` when the image holds them. An interrupt handler starts from its vector, because no call or jump goes to it. `from` tells the source of each root.
- `codeRegions.unreachable`: code regions of the knowledge that no chain of call and jump references reaches from a root. A region also reaches the code after it when its last instruction is not RTS, RTI, JMP, BRK or JAM: the CPU continues there. Run c64-static-analysis first, so that the knowledge has the code regions and the references.
- `outside`: RAM outside the program that the program `read` or `executed` but did not write, and code it `generated`. A loader or an earlier stage put the bytes that the program did not write. A `generated` range can have gaps of two bytes or less: these are operand bytes.

Each list has `count` and `listed`. `listed` has the first ranges, at most `--max-listed` (default 50). `--out` writes all of them and the result shows the file as `{out, bytes, sha256}`. Run more coverage runs for parts that are `untouched`, and add them with `coverage` of the c64-knowledge skill, before you decide.

## Leftovers

Use `leftovers` to find what the program holds in addition to its working code. It reads the program, its stages, the coverage and the code regions from the knowledge, as `separate` does. It gives evidence, not a decision. Each list has `count` and `listed`, as in `separate`. `--out` writes all findings.

| List | What it holds |
|---|---|
| `text` | Text, and lines of assembler source. `encoding` is `petscii`, `screen`, `ascii` or `high-bit`. `reversed: true` marks screen codes with bit 7 set. `source: true` marks lines of assembler source. A line end in `text` is a new line. `mnemonics` counts 6502 instructions in the text. |
| `basic` | Two or more BASIC lines away from the BASIC start. `linkedAt` is the address where BASIC linked the lines. It can be another address than the address of the bytes now. |
| `fill` | One byte that repeats, at least 16 times, or a pattern of two to four bytes that repeats, at least 32 bytes in total. `pattern` is the repeated bytes. |
| `residue` | Bytes that no run touched and that are no text, BASIC, fill or code region. `bytes` shows the first 16 bytes. |
| `copies` | Bytes that are the same as earlier bytes of the program, at least 32 bytes. `copyOf` is the address of the earlier bytes. |
| `deadCode` | Code regions of the knowledge that no root reaches, as in `codeRegions.unreachable` of `separate`, and that no run executed. |

Text from another computer can show the tools of the developer:

- `ascii` is text in ASCII, with small letters. A cross assembler on another computer can leave it.
- `high-bit` is text with bit 7 set. The Apple II keeps text in this form, with `$8d` at the end of a line. Apple II assembler source, for example from Merlin, has `DFB` lines and `*` comments. A C64 text in shifted letters with `$a0` spaces is also `high-bit`.
- Data of another computer, for example a table of Atari key codes, is not text. The script does not find it. Examine `residue` and the data that no code reads, and use your knowledge of the other computers.

Each finding has `stages`: the unpack stages that wrote its bytes. Each finding also has `access`: the accesses of its bytes in the coverage. A stage before the last stage is a depacker, an intro or a loader.

| Option | Meaning |
|---|---|
| `--min-text 6` | The minimum number of characters in a text. The default is 8. A short text, for example a group name, can need 6. |

Do these steps:

1. Unpack the program with `stages` or `capture` of the c64-unpacker skill. Put the capture into the knowledge.
2. Add the coverage of runs that use many parts of the program. Without coverage, `residue` is empty and no finding has `access`. `noCoverage` tells this.
3. Run c64-static-analysis. Without code regions, `deadCode` is empty, and `residue` can include code.
4. Run `leftovers`. When you have two or more releases, also compare them.
5. Read `text` first: names, dates, greetings and credits. Then read `copies`, `residue`, `basic` and `deadCode`.
6. Examine each important finding with the emulator skill or the c64-static-analysis skill.
7. Record each confirmed finding with the c64-knowledge skill. Do not remove a leftover from the program: a rebuild keeps it. Only the data of a cracktro goes out, with `capture --exclude` of the c64-unpacker skill. Classify a confirmed PETSCII text as a `petscii` region, and a screen code text as a `screen` region. Classify other text as `bytes`. Write a comment that tells what the leftover is.

Read the findings with care:

- A text is a run of bytes that looks like text. Some runs are data, for example a character map. A text can include one byte before it or after it that is not part of the text.
- A copy is not always a leftover. A program can copy its code to another address before it runs the code.
- A text in an early stage is often a crack intro. A text that no run read can be an old text of an earlier release.
- Keep the fact apart from the conclusion. "Text at $4770" is a fact. "A recrack by group X" is a conclusion.

## Library of routines

A library is a folder of routine files. Each file holds one routine: its bytes and its knowledge. Keep one library beside the project folders, for example `library/` at the root of the workspace. A library is not a project folder. Commit it with the projects.

`--library` is relative to the project folder, as all other paths. For example, `../library` is the folder `library/` beside the project.

```
node <skill>/scripts/provenance.ts routine '$1000' --library ../library --project game-a
node <skill>/scripts/provenance.ts routine '$1000-$1026' --name play --library ../library --project game-a
node <skill>/scripts/provenance.ts match --library ../library --out .c64-re-tools/local/match.json --project game-b
```

To save a routine:

1. Put the program into the knowledge, and name the routine there first. The file keeps the user and LLM names, comments, regions, references and operand expressions in the range. It also keeps the code regions of each origin.
2. Run `routine` with the start address of a module, or with a range `<start>-<end>`. A module ends at the next module or at the end of its segment.
   - `--name` is the name of the routine and of its file. When you do not give it, the script uses the user or LLM name at the start.
   - `--title` is the title of the routine. When you do not give it, the script uses the module title.
   - A routine has at least 16 bytes. Its last instruction must end in the range.
3. The result shows the routine file as `{out, bytes, sha256}`. `out` is relative to the project folder.
4. Read `leftOut`. It lists the rows that the file does not keep, and why. For example, the file does not keep an operand expression that uses a name outside the routine.

To find the routines in a program:

1. Put the program into the knowledge. Then run `match`. The script examines each routine of the library at each address of the program.
   - The opcodes and the other bytes must be equal.
   - An address into the routine must point into the routine at its new address. `shift` is the address in the program minus the address in the library.
   - An operand that addresses something outside the routine can be different. `differing` lists each one with its value in the library and in the program. Examine them. For example, the program can use other variables or another SID voice.
2. Give `--out` to get a batch for `knowledge.ts apply`. `batch` shows the file as `{out, bytes, sha256}`. The batch has the names, regions, comments, references and operand expressions of each routine at its addresses in the program. `match` does not change the knowledge.
3. Read `batch.leftOut` before you apply the batch. The script leaves out a write in these conditions:
   - The program has a user or LLM row at that place.
   - The program uses the name at another address.
   - A removal holds at that place.
   - The routine occurs two times. Only the first copy gets the names.
   - The script leaves out the name that an operand expression uses, or the expression does not give the operand in the program.
4. Apply the batch with the command in `apply`. Add `--project` when you are not in the project folder. The batch is one revision of the LLM. `batch.known` counts the writes that the program has already.

## Knowledge

Automatic write:
- none.

Record a confirmed conclusion as a normal comment, region, symbol, release, switch or patch with the c64-knowledge skill. Do not record the full comparison or the full list of leftovers.

`match --out` writes a batch file and does not change the knowledge. Apply the batch with the c64-knowledge skill.

## Result

The differing ranges with the bytes of each release and the groups that agree, and the share of identical bytes. `identicalShare` has 3 decimals. It is 1 only when no byte differs. `identicalBytes` and `differingBytes` give the counts. `common` gives the ranges where all releases have bytes. `releases` gives the segments and the `shift` of each release. With `--frames`, each difference also has `runtime`, and `run` tells if each release started, or why not. With `--align`, the result has `blocks`, `onlyInA`, `onlyInB` and `alignedShare` in place of `differences`.

For `leftovers`: the lists of findings, with `entry`, `roots` and the number of `stages`. `noStages` and `noCoverage` tell which knowledge is missing. Without a root, `roots` tells why `deadCode` is empty.

The runtime evidence and the leftovers are evidence only. The script does not decide which bytes are original.

## Failure and conflicts

- Do not call releases independent when you do not know their relation. Two cracks can come from the same source.
- Do not call a byte original only because one release has it. A majority of releases is also not proof.
- `common` is empty: the releases do not cover the same addresses. Use `--shift`, or compare a range that all releases cover.
- `run.releases` shows `started: false`: a PRG without a BASIC start, or an image without `entry_state.json`. The reason tells which. The other releases still give evidence.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own emulator script.
- `moreDifferences: true`: the script shows only the first differences. Use `--range` to see the others.
- `not-found`: the project has no file at that path.
- `not-found` from `match`: the library folder does not exist, or it has no routine files. Save a routine with `routine` first.
- `conflict` from `routine`: the library has a routine with that name. Give another `--name`, or give `--replace` to save over it.
- `invalid-input` with "is a project folder": the library folder is a project. Give a folder beside the projects.
- `match` gives `count: 0`: the routine is not in the program. A packed program can hold the routine in a packed form. Unpack the program with c64-unpacker first.
- `invalid-input`: a file, an address or a shift is wrong. A path that goes out of the project folder is also wrong, also through a link. Read the message.

## Handoffs

- Get releases from disk images → c64-disk
- Unpack a packed release → c64-unpacker
- Run or examine the different code → emulator
- Analyze the different code → c64-static-analysis
- Record a conclusion → c64-knowledge
- Apply the batch of `match` → c64-knowledge
