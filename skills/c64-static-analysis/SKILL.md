---
name: c64-static-analysis
description: Finds the structure of a C64 program with DXA or Ghidra, without running it. It records the code and data regions, the analyzer names and the references in the project knowledge. Use it to get a fast first pass of code and data, and a disassembly listing. Use it to get the routines, the references, an instruction list and decompiled code. Use it when the project knowledge has coverage, to find code that only a vector, a table or an interrupt reaches. Use it to find 6502 idioms, pointer candidates, raster pitfalls and macro candidates. It does not run the program. It does not give names to routines.
---

# Static analysis

Use this script to find the code, the data, the routines and the references of a C64 program without running it.
Use only the commands of the script. Do not disassemble or decompile the program in another way.

```bash
node <skill>/scripts/static-analysis.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `analyze --analyzer dxa`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Get a fast first pass of the code and data regions | `analyze --analyzer dxa` |
| Get a disassembly listing | `analyze --analyzer dxa --out-listing .c64-re-tools/local/game.lst` |
| Find the routines and the references | `analyze --entry '$080d'` |
| Get C-like code of a routine | `analyze --entry '$080d' --decompile '$0818'` |
| Get each instruction as JSON | `analyze --entry '$080d' --out-instructions .c64-re-tools/local/instructions.json` |
| Analyze drive code or a cartridge bank | `analyze --space drive8` |
| Get the macro candidates as a batch of changes | `analyze --out-macro-batch .c64-re-tools/local/macros.json` |
| Get more items in each list | `analyze --max-listed 500` |

---

## The program and the entry points

- The program comes from the project knowledge. Put the program into the project knowledge before you analyze it.
- Put each coverage map of the program into the project knowledge before you analyze it. With coverage, the analysis finds code that only a vector, an RTS table or an interrupt reaches. It also finds the code after a JSR to a routine that an analyzer thinks does not return.
- The analysis uses coverage only in the space `c64`.
- An entry point is an address where code starts. Give it with `--entry`. Get it from these sources:
  - The SYS address of a BASIC start. Get it from a listing of the BASIC program.
  - A vector or an interrupt target that you found in the emulator.
  - An address in `functions` of an earlier Ghidra result.
- Ghidra needs at least one entry point. DXA finds the SYS address of a BASIC start without help.
- Each routine, each `code` region and each entry of a `jumps` table in the project knowledge is also an entry point. Each name in the project knowledge is a label in the listing and in the decompiled code.
- The two start vectors of a `CBM80` header at `$8000` are entry points without help.
- Each region that is not code in the project knowledge stays data. Each `data` or `variable` symbol also keeps its region as data. If the region holds an entry point or executed code, only the byte of the symbol stays data.
- If an analyzer decodes data as code, classify the region as data in the project knowledge. Then run `analyze` again.
- The facts of an analyzer are not entry points or data for the next analysis. Thus a new analysis can correct them.
- With coverage, the analysis keeps as data the RAM under ROM that the runs did not read or execute. A call into the KERNAL thus does not decode the RAM under it. If the program has code there, give its address with `--entry`.
- Ghidra does not follow BRK. If the program removes the KERNAL and uses the BRK vector, give the target of the vector with `--entry`.
- `--decompile` takes the address of a routine. Get it from `functions` of an earlier Ghidra result, or from the routines in the project knowledge.

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
| `--analyzer <dxa\|ghidra>` | `analyze` | The analyzer. `dxa` gives a fast first pass. `ghidra` gives a deeper pass. The default is `ghidra`. |
| `--entry <address>` | `analyze` | An entry point of the program. Give it again for more entry points. There is no default. |
| `--decompile <address>` | `analyze` | Ghidra only. Decompile the routine at this address. Give it again for more routines, at most 32. There is no default. |
| `--space <space>` | `analyze` | The knowledge space of the program: `drive8` for 1541 drive code, or `bank0` to `bank255` for a cartridge bank. The analysis reads the entry points from that space and writes the findings into it. The default is `c64`. |
| `--max-listed <n>` | `analyze` | List at most `n` items in each list. `0` lists no items. The counts stay complete. The default is 50. |
| `--out-listing <file>` | `analyze` | DXA only. Write the disassembly listing to this project file. There is no default. |
| `--out-instructions <file>` | `analyze` | Ghidra only. Write each instruction to this project file as JSON. There is no default. |
| `--out-macro-batch <file>` | `analyze` | Write the macro candidates to this project file as a batch of changes to the project knowledge. There is no default. |

---

## Analyze the program

### `analyze`

Runs DXA or Ghidra over the program in the project knowledge. The script records the findings in the project knowledge as one revision. Then it records the 6502 idioms as a second revision.

The script records only structure: code and data regions, analyzer names, and the references from Ghidra. It does not record the listing or the decompiled code. Do not record the listing, the decompiled code or the function list as comments in the project knowledge.

`body` holds these fields for both analyzers:

- `analyzer`: `dxa` or `ghidra`. `space` is in `body` only for a space that is not `c64`.
- `revision`: the revision of the findings, or `null` when the knowledge did not change.
- `coverage`: the ranges that the analyzer examined.
- `changes`: for analyzer names (`names`), `regions` and `references`, the counts `added`, `changed`, `retired`, `unchanged` and `suppressed`. `suppressed` counts the findings that the script did not record, because the user or the LLM removed a fact at that place. `symbols.retired` counts the old symbols of the analyzer that became analyzer names.
- `conflicts`: each place where the analyzer and the project knowledge disagree. `problem` tells the disagreement.
- `coverageSeeds`: only with coverage. `entryPoints` and `used` give how many entry points the coverage gave, and how many the analysis used. `romOnlyRanges` and `romOnlyUsed` give the same counts for the data ranges under ROM.
- `coverageConflicts`: only with coverage. Each analyzer data region where the coverage shows executed code.
- `idioms`: the 6502 idioms that the script found by pattern. The counts are `rtsTables`, `jumpTables`, `bitSkips` and `cartridgeHeaders`. `revision`, `changes` and `conflicts` are for the idioms, as above. `candidates` holds what the script did not record.

DXA also gives:

- `regions`: the code and data regions, each with `start`, `end` and `classification`.
- `labels`: the names that DXA found, as a list.
- `listing`: the listing file, with `--out-listing`.

Ghidra also gives:

- `functions`: the routines that Ghidra found, as a list, each with `entry` and `name`.
- `decompilations`: the C-like code of each `--decompile` routine, with `entry` and `text`. `truncated` tells that the text is cut.
- `notDecompiled`: the routines that Ghidra did not decompile, each with a `reason`.
- `instructions`: the file and the `count`, with `--out-instructions`. Each instruction has `address`, `bytes`, `mnemonic`, `mode` and `operand` in 6502 syntax. A branch, a jump or a call also has `target`. With coverage, `executed` tells if the instruction ran.
- `coverageGaps`: only with coverage. The executed instruction starts that are not in the instructions of Ghidra.

The `hint` gives each of these cases:

- `conflicts` is not empty. Find the correct answer in the emulator. Then correct the project knowledge.
- `coverageConflicts` is not empty. Classify each range as code in the project knowledge, or as `dual-use` when its bytes are also data. For many ranges, write all classifications in one batch of changes.
- The batch of `--out-macro-batch` has changes. Apply the changes in the batch file to the project knowledge. Then generate the source again.
- A list is cut. Give a larger `--max-listed`. The project knowledge has all `labels` and `functions` as analyzer names.

There is no `nextAction`.

#### The candidates

The script does not record the candidates. Examine each candidate and decide.

- `dop`: DOP padding.
- `selfModified`: opcodes that the program wrote and then executed. The write and the execution must be in one coverage file. A coverage file does not record the order. Thus a candidate can also be code that ran first, and that the program then wrote over. To prevent this, save one coverage file for each part of the program, for example the intro, the game, or a loader that copies code. Clear the memory map between the parts.
- `pointers`: code that makes an address from immediates. A `vector` or a `zero-page pointer` candidate stores a low byte (`low`) and a high byte (`high`) to a vector or to a zero-page pair. A `sprite pointer` candidate stores an immediate (`at`) to a sprite pointer of the screen at `$0400` in VIC bank 0. For each correct candidate, record a low and a high operand expression to its `target` in the project knowledge. Then a rebuild can move the target.
- `pitfalls`: code that a C64 runs in a different way than it reads. For `raster-bit-8`, the instruction at `at` reads `$D011`, and the instruction at `store` writes the value back. The write can move the raster interrupt to line 256 or later. On PAL, past line 311, the interrupt never comes. Where the code must not keep bit 7, add a comment and test the program.
- `macros`: runs of instructions that one macro line can replace, for example `+inc16 ptr`. Each candidate has `macro`, `start`, `end`, `args` and `text`. The macros are `inc16`, `dec16`, `add16_8`, `add16`, `sub16`, `set16`, `mov16` and `wait_line`. An arg is a name of the user or the LLM, or a platform name of a ROM that the program uses. `known` counts the uses that the project knowledge has. `leftOut` counts the candidates with a label inside, or with a patch or a use over them. With `--out-macro-batch`, `batch` gives the file and the count of changes (`writes`). The batch holds the macros that the project knowledge does not have, and the uses. `otherMacros` names each macro that the project knowledge has with another body. The batch does not have the uses of that macro.

#### Which facts the analysis replaces

- The analysis never replaces a name or a region of the user or the LLM. Each disagreement shows in `conflicts`.
- DXA and Ghidra do not replace the facts of each other, with one exception. With coverage, a code finding replaces DXA or Ghidra data where a run executed an instruction start. Thus put all coverage maps into the project knowledge first. Then run DXA, then Ghidra.
- An analyzer can find data where a run executed an instruction start, or at a `label` or `routine` symbol of the user or the LLM. Then the script does not record that data region, and the earlier region stays. The conflict has `executed` or `knowledge`.
- An idiom region (origin `heuristic`) replaces the part of a DXA or Ghidra region where it lies. DXA and Ghidra never replace an idiom region. If they find code there, the result shows a conflict.
- An idiom table can be too long or too short. Correct its region in the project knowledge. Your region replaces it.
- A new analysis replaces the earlier facts of the same analyzer in its `coverage`, also its analyzer names. The history keeps the earlier facts.
- A fact that the user or the LLM removed does not come back. To remove a wrong fact, remove it in the project knowledge.
- An analyzer name is a second name of the address, not a symbol. Each analyzer keeps its own name at an address. The generated source does not use an analyzer name by default. To use a name in the source, give the address a name in the project knowledge.
- A Ghidra function that only branches and jumps reach is a `label`, not a `routine`.

#### Traps

- A conflict with the problem "another address has this name": the project knowledge has the generated name at a different address. The knowledge stays unchanged.
- A false reference through a vector: the code jumps through a vector, for example `JMP ($0408)`, and the program writes the vector at run time. The analyzer follows the bytes that the program has there. Do these steps:
  1. Find the real targets in the emulator, or in a coverage file.
  2. If the vector bytes are also code at another time, classify them as `dual-use` in the project knowledge.
  3. Remove the false reference in the project knowledge. It does not come back.
  4. Record a `jump` reference from the JMP to each real target in the project knowledge. Record each target as a routine.
- `coverageGaps` has starts. Normally its count is 0. Each start is not in `--out-instructions` and not in the generated source. Examine the code at the start. Overlapped instructions and self-modified code can cause a gap. A start in a `dual-use` region is a known overlap, for example a BIT skip, and is not in the list.
- `coverageSeeds.used` is smaller than `coverageSeeds.entryPoints`. The analysis did not use all entry points of the coverage. Give the important entry points with `--entry`, or record them as routines in the project knowledge. These come first.
- `romOnlyUsed` is smaller than `romOnlyRanges`. The analysis did not keep all RAM under ROM as data. Classify the RAM under ROM that is not code as data in the project knowledge.
- `notDecompiled` has a reason that the decompiler did not start. Give the remedy in the reason to the user.

#### Failures

- `invalid-input` about an entry point: Ghidra has no entry point in the program. Give one with `--entry`.
- `stale-revision`: the project knowledge changed during the analysis. The script recorded nothing. Run `analyze` again.
- `operation-failed` about an incomplete result or listing: the analyzer did not give a complete result. The script recorded nothing. Tell the user.
- The script did not write the listing: the error tells if the project knowledge has the findings. Correct `--out-listing` and run `analyze` again.

---

## Workflow

1. Read the project knowledge of the program.
2. Put each coverage map of the program into the project knowledge.
3. Run `analyze --analyzer dxa` for a first pass. Read the listing for a quick view of the code.
4. Find the important routines. Give them names in the project knowledge.
5. Run `analyze` with Ghidra. Give the entry points with `--entry`. Give `--decompile` for the routines that you must understand.
6. Do the action for each `hint`. Examine the candidates.
7. Give each important routine a name in the project knowledge. Then run `analyze` again. The analyzers use the new names.

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
