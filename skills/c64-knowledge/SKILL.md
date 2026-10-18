---
name: c64-knowledge
description: Use this skill to read, write, correct and review the durable knowledge of a C64 project in .c64-re-tools/knowledge/. The knowledge holds the program, its entry state and the coverage of the runs. It gives the knowledge at an address, and it names symbols, classifies memory regions, sets comments and records references. It records patches and macros for the generated source. It also shows the history of each change, and it can revert to an earlier revision. Do not use it for live emulator state or for static analysis.
---

# c64-knowledge

## Purpose

Read, write, correct and review the durable understanding of a C64 project. The knowledge also holds the program: its bytes, its entry state and the stages of its unpacker. It holds the coverage of the runs too. The other skills read the program and the coverage from the knowledge. The knowledge is text in `.c64-re-tools/knowledge/` in the project folder: one JSON line for each row. Commit that folder with git. The script keeps an index of the text in `.c64-re-tools/local/knowledge.db` and makes the index again when the text changes. Do not commit the index.

This skill is the only write path for conclusions of the user and the LLM. It does not run an emulator or an analyzer. Write the knowledge only with the script. The script checks each write. Do not write or edit the files in `.c64-re-tools/knowledge/` or the index yourself.

## Inputs

One of these:

- an address, a range or a symbol name to look up
- text to search for
- a change to a symbol, a region, a comment or a reference, with a short reason
- a capture of the c64-unpacker skill, a PRG, or coverage maps to put into the knowledge
- a request to see the history or a revision.

## Tools / execution path

```
node <skill>/scripts/knowledge.ts <command> [subjects] [options]
```

A symbol is the name of an address from the user or the LLM. An analyzer name is a second name from DXA, Ghidra or an idiom, for example `FUN_17e2`. Each analyzer keeps its own name at an address. `at`, `search` and `export` show the analyzer names. The generated source uses only the symbols, unless c64-source gets `--analyzer-names`. To use an analyzer name in the source, `rename` the address with it. A symbol name is a label for ACME: a letter or underscore, then letters, digits or underscores. The knowledge refuses the name of a 6502 instruction, for example `lda`, in upper or lower case.

| Need | Command |
|---|---|
| Everything known at one address | `at '$2100'` |
| Find names and comment text | `search player` |
| Lists in a range | `symbols`, `regions`, `comments`, `references` with `--range '$2000-$2fff'` |
| The names that DXA, Ghidra and the idioms gave | `symbols --analyzer` |
| Only some origins | add `--origin semantic`, `--origin analyzer` (dxa, ghidra and heuristic), or `--origin user,llm` |
| All knowledge in one file | `export --out .c64-re-tools/local/knowledge.json` |
| Put the program into the knowledge | `image .c64-re-tools/local/capture/image.json` or `image original/game.prg` |
| Add the coverage of runs | `coverage .c64-re-tools/local/runs/rooms/room0.bin ...` |
| What the knowledge holds of the program | `program` |
| The code of a range with names, comments, access and references | `listing '$0400-$04ff'` |
| Name the symbol at an address | `rename '$2100' update_player --kind routine` |
| The rows that one revision added and closed, also memory, entry and coverage rows | `revision 20261015T2145` |
| Remove a symbol | `remove-symbol '$2100'` |
| Classify memory | `classify '$3000-$303f' sprite` |
| Classify a table of records | `classify '$3000-$303b' bytes --element 6` |
| Many writes as one revision | `apply -` with the JSON on standard input, or `apply <file>` |
| One batch from the batches of parallel agents | `join a.json b.json --out .c64-re-tools/local/joined.json` |
| Make memory unknown, and keep the analyzers out of it | `unclassify '$3000-$303f'` |
| Set or remove a comment | `comment '$2100' line Reads joystick 2.` / `uncomment '$2100' line` |
| Add or remove a reference | `reference '$2000' '$2100' call` / `unreference ...` |
| Places that a removal blocks | `suppressions` with `--range` |
| Start a file of generated source | `module '$2000' player.asm --title 'Player movement'` / `unmodule '$2000'` |
| Write the operand of an instruction as an expression | `operand '$8079' --lo irq_handler` / `unoperand '$8079'` |
| Operand expressions | `operands` with `--range` |
| Replace a range with code when a switch is on | `patch '$100e-$1010' CRACK --code-file crack.asm` / `unpatch '$100e'` |
| Patches and switches | `patches` with `--switch`, and `switches` |
| Write a macro | `macro inc16 --params dst --body-file inc16.asm` / `unmacro inc16` |
| Write instructions as one use of a macro | `use '$1005-$100a' inc16 --args ptr` / `unuse '$1005'` |
| Macros and their uses | `macros`, and `uses` with `--range` and `--macro` |
| Files of generated source | `modules` |
| The address spaces that hold knowledge | `spaces` |
| History | `history '$2100'`, `history --name update_player`, `history --macro inc16`, `revisions`, `revision 20261015T2145` |
| Go back to an earlier state | `revert 20261015T2145` for all spaces, or `revert 20261015T2145 --space bank3` for one space |
| Decide the conflicts after a git merge | `merge --reason 'merge of two computers'` |

A revision has an id such as `20261015T214501.123-k3f9qz`. The id starts with the date and time. A command takes the full id, or a start of the id that only one revision has. The revision `0` is the knowledge before the first revision.

Every command takes `--space`: `c64` (the default), `drive8` for code in the 1541 drive, or `bank0` to `bank255` for cartridge banks. `revert` is different: without `--space`, it reverts all spaces. With `--space`, it reverts only that space. Drive code and banks use the same addresses as the C64, so each space has its own knowledge. A name is unique inside one space. In a batch, a write can name its own `space`.

Symbol kinds are `label`, `routine`, `variable`, `data` and `vector`. Reference kinds are `call`, `jump`, `read`, `write`, `reference` and `pointer`. Only an operand expression writes a `pointer` reference.

Region types:

| Type | Meaning |
|---|---|
| `code` | Instructions. |
| `bytes`, `words`, `petscii`, `screen`, `bitmap`, `sprite` | Data of that form. |
| `charset` | Characters of a character set, 8 bytes for each character. |
| `addresses`, `addresses-split` | A table of addresses: one table of 16-bit values, or a low-byte table and then a high-byte table. |
| `rts-addresses`, `rts-addresses-split` | The same, with each value the target minus 1, for a PHA, PHA, RTS dispatch. |
| `jumps` | A table of `JMP abs` instructions. Each 3-byte entry is an entry point. It is code. |
| `workspace` | RAM that the program writes at run time. Its bytes in the image do not matter. |
| `unused` | Bytes that nothing executes or reads. |
| `dual-use` | Code at one time and data or a vector at another time. No analyzer finding conflicts with it. |

`--element` gives the bytes of one element of a table. The length of the region must be a multiple of it. The result shows `element` and `count`.

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

Read:

1. Use `at` for the addresses in the question before other work.
2. Use `history` when the current knowledge is surprising or disputed. Each row gives the `reason` and the `evidence` of the revision that wrote it.

Write:

1. Read the current value with `at`. Note the `revision` in the result.
2. Decide the change. Keep observed facts apart from your conclusions.
3. Write it with `--reason` and `--expect-revision` set to the revision you read. Add `--evidence` for each thing that the change rests on: `coverage:<map>`, `test:<file>`, `file:<file>` or `note:<text>`.
   - `coverage:<map>` names a map by its path at the import. The script uses the last import of that map into the space of the write.
   - `test:<file>` and `file:<file>` name a file outside `.c64-re-tools/local/`. Move the file before the write.
   - The script keeps the SHA-256 of each file and map.
4. Read the result. A `revision` of `null` means that nothing changed.

Each write is one revision. A classification inside a region splits that region, so regions never overlap.

A write can give the same fact that an analyzer gave. Then the fact gets the origin of the write, and `previous` in the result shows the row of the analyzer. The next analysis does not remove the fact. This is true for a symbol, a region, a comment and a reference. A `--by user` write over the same fact of `llm` also changes the origin to `user`. A `--by llm` write over the same fact of `user` changes nothing.

A comment and a module are at the start of an instruction. In a code region, the script refuses an address that is an operand byte of an instruction. The error gives the start of that instruction. In data, each address is correct.

## The program and the coverage

The knowledge holds the program, so a project needs no image or coverage files. The other skills read them from the knowledge and take no path to them.

1. Capture a packed program with the c64-unpacker skill into `.c64-re-tools/local/`. Then put it in with `image .c64-re-tools/local/capture/image.json`. The script reads `image.bin`, `entry_state.json` and the stages next to it.
2. For a program without a packer, drive code or a cartridge bank, put the PRG in with `image <file.prg>`. Give `--space drive8` or `--space bank0` for drive code or a bank. A PRG has the extension `.prg` or no extension. The script refuses a file with another extension.
3. Write each coverage map of a run into `.c64-re-tools/local/`. Then add it with `coverage <map.bin> ...`.
4. Read what the knowledge holds with `program`: the segments, the entry, and the coverage maps that it has.

- `image` writes only the bytes that changed. The same image again writes nothing. A new image replaces the program of the space. The history keeps the old bytes.
- `coverage` joins the maps. It keeps each address that a run executed, read or wrote. It also keeps each address that one run wrote and executed: self-modified code. `coverage` puts each map into the space of `--space`. You can add the same map to each space. A map that the space has is not added again.
- The capture and the maps are not necessary after the import. Keep them in `.c64-re-tools/local/`.
- A `revert` also gives back the coverage maps of that revision. A `revert` to a revision before an import removes the map and its ranges. Then you can import the map again, and `--evidence coverage:<map>` refuses it until you do.

For more than a few writes, use `apply -` and give the writes on standard input as one JSON list. Each write has `op` and the arguments of the command with the same name, for example:

```json
[
  { "op": "rename", "address": "$2100", "name": "update_player", "kind": "routine" },
  { "op": "classify", "start": "$3000", "end": "$303b", "type": "bytes", "element": 6 },
  { "op": "comment", "address": "$2100", "placement": "line", "text": "Reads joystick 2." }
]
```

The ops and their fields:

| op | Fields |
|---|---|
| `rename` | `address`, `name`, `kind` (optional) |
| `remove-symbol` | `address` |
| `classify` | `start`, `end`, `type`, `element` (optional) |
| `unclassify` | `start`, `end` |
| `comment` | `address`, `placement` (`line` or `side`), `text` |
| `uncomment` | `address`, `placement` |
| `reference`, `unreference` | `from`, `to`, `kind` |
| `module` | `start`, `file`, `title` (optional) |
| `unmodule` | `start` |
| `operand` | `address`, `select` (`lo`, `hi`, `value` or `expr`), `symbol` and `offset` (optional), or `expression` for `expr` |
| `unoperand` | `address` |
| `patch` | `start`, `end`, `switch`, `code` (empty for NOP only), `comment` (optional) |
| `unpatch`, `unuse` | `start` |
| `macro` | `name`, `params` (a list or a comma list), `body`, `comment` (optional) |
| `unmacro` | `name` |
| `use` | `start`, `end`, `macro`, `args` (a list or a comma list) |

Each write can also have `space`. A `line` comment is a line of its own above the address. A `side` comment is at the end of the line of the address. The script checks an `operand`, `patch` or `use` write against the program of the knowledge in the space of `--space`. All writes become one revision. If the knowledge refuses one write, the script writes nothing, and the error names the write.

The c64-provenance skill writes a batch with `match --out`. The batch holds the names of library routines at their addresses in this program. Read the `batch.leftOut` of its result first. Then apply the batch with the command in its `apply`.

## Listing

`listing` reads the program and the other knowledge, and writes no knowledge. Use it in place of your own disassembler.

- `listing` gives one line for each instruction of a code region, and one `!byte` line for other bytes. A line has the name of the address, the instruction with the names of its target, and the comments. An operand expression of the knowledge replaces the operand. `analyzerNames` gives the second names. `referencesIn` and `referencesOut` count the references. When the knowledge has coverage, `access` tells if a run executed (`x`), read (`r`) or wrote (`w`) the bytes of the line, or `-` for none. `--out` writes the listing as text to a project file.

## Batches of parallel agents

When more agents name the program at the same time, give each agent one range of addresses. Each agent writes one batch file and does not apply it. A batch of an agent has the form `{"owner": {"start": "$1000", "end": "$1fff"}, "ops": [...]}`. `ops` holds the writes, as for `apply`. The owner ranges must not overlap.

`join` makes one batch from the batch files. It writes no knowledge.

- At an address in the owner range of a batch, the name, the comment, the operand and the module of that batch stay. At an address that no batch owns, the first batch in the command stays.
- A batch can give an address a name that `join` replaces. Then `join` also replaces that name in the operand expressions and macro args of that batch.
- The regions of the owner come after the regions of the other batches. Thus the regions of the owner stay where they overlap.
- A name from a batch stays when another batch removes the symbol at that address.
- `choices` lists each place where the batches gave different values, with the value that stays.
- When one name or one module file is at two addresses, `join` writes nothing and gives the error `conflict`. The message names the addresses and the batches. Correct the batches, then do `join` again.

Then apply the joined batch with the command in `apply`.

## Modules

A module tells the c64-source skill where a file of the generated source starts. The file runs to the next module or to the end of its segment. Each address has one module, and each file name has one module. A file name has letters, digits, underscores or hyphens, and ends in `.asm`. The c64-source skill writes `main.asm`, `loader.asm`, `constants.asm` and `macros.asm` itself. Thus a module cannot have one of these names, in upper or lower case. The title becomes the first line of the file. A `module` write without a title keeps the title that the module has. Modules have a history, and `revert` restores them.

## Operand expressions

An operand expression tells the c64-source skill how to write the operand of one instruction. The source then has a name, not a number. When code or data changes its length, the operand follows the address that moved.

Give one selector:

| Option | Operand | Source |
|---|---|---|
| `--lo <symbol>` | The low byte of the symbol plus the offset | `lda #<irq_handler` |
| `--hi <symbol>` | The high byte of the symbol plus the offset | `lda #>(sprite_bank+$1000)` |
| `--value <symbol>` | The symbol plus the offset | `lda bar_colours-1,x` |
| `--expr <text>` | ACME expression text with names and numbers | `lda #(sprite_bank + 5*64) / 64` |

- The address is the start of an instruction in a code region. The script decodes the instructions from the start of the region, as `listing` does. It refuses an address in no code region and an operand byte of an instruction. Classify the code first.
- `--offset` adds a whole number to the symbol. Write a negative offset as `--offset=-1`.
- A name is a symbol of the knowledge or a platform name of the c64-memory-map skill.
- `--expr` takes `$`, `%` and decimal numbers, names, brackets, the operators `+ - * / % << >> >>> & | XOR`, and `<`, `>`, `-` and `!` before an operand.
- The script compares the value of the expression with the operand in the program of the knowledge. If they are not equal, the script refuses the write.
- Each name in the expression gets a `pointer` reference from the instruction. Thus `at` on the named address shows the code that uses the address.
- A `rename` of a symbol changes the name in each expression. The knowledge refuses `remove-symbol` while an expression uses the symbol. Use `unoperand` first.

Write an operand expression for each immediate that is a byte of an address. Also write one for each table read through the byte before the table. The pointer candidates of the c64-static-analysis skill show many of these places.

## Code switches

A patch is ACME code that replaces a range of the program when the build defines its switch as 1. Use patches to change the program, for example for a crack, a trainer or a debug hook. The default build does not define the switch. Thus the c64-source skill still makes a source that is identical to the program.

- A switch name is upper case, for example `CRACK` or `TRAINER`. It cannot be the name of a symbol or a platform name.
- Many patches can have the same switch. The c64-source skill builds each switch on its own. It does not build two switches together.
- The code must fit in the range. NOP ($EA) fills the bytes after the code. `--nop` gives a range of NOP only.
- `--code` gives the code as text. `--code-file` reads the code from a project file. The code can use the labels and the macros of the source, and local labels with a dot, for example `.skip`.
- The braces in the code must be pairs, because the source puts the code inside `{ }`.
- A patch cannot overlap another patch or a macro use. A patch with the same start and the same switch replaces the patch. A patch of another switch at the same start gives the error `conflict`.
- Each byte of the range must be in the program of the knowledge.
- A `patch` write without `--comment` keeps the comment that the patch has.

Build the program with a switch on with the c64-assembler skill: `--define CRACK=1`.

## Macros

A macro writes a run of instructions as one line of the source, for example `+inc16 ptr`. Use macros to make the source shorter and easier to read.

- `macro` writes the ACME macro: its name, its params and its body. `--params` gives the params as a comma list, without a dot. The body uses each param with a dot, for example `.dst`.
- `use` writes the instructions from the start to the end as one use of a macro. `--args` gives one expression for each param, as a comma list. Each name in an arg is a symbol of the knowledge or a platform name.
- The range of a use is complete instructions of the program of the knowledge.
- A `rename` of a symbol changes the name in each arg. The knowledge refuses `remove-symbol` while an arg uses the symbol.
- The knowledge refuses `unmacro` while the macro has uses. It also refuses a change of the number of params while the macro has uses.
- A use cannot overlap a patch or another use.

The c64-source skill writes a use only when the use gives the bytes of the program. If not, it writes the instructions and gives the reason. The c64-static-analysis skill finds uses of known 6502 idioms and writes them to a batch with `--out-macro-batch`.

## Removals

`unclassify` and `unreference` block the place for DXA and Ghidra. An analysis does not add a region in that range or that reference again. This applies to every removed fact, also to a fact from the LLM. `remove-symbol` does not block the address, because an analyzer name never becomes a symbol.

- `suppressions` lists the blocked places with the reason of each removal. `at` and `history` also show them.
- A `rename`, `classify` or `reference` at a blocked place ends the block there, because your own fact is at the place then.
- A `revert` to a revision before the removal also ends the block.

## Knowledge

Write after interpretation:

- a symbol name that tells what a routine or a variable does
- a region type that the evidence supports
- a comment that explains behavior that a name cannot show
- a reference that the evidence supports.

Do not store:

- temporary investigation state
- a guess, only because a routine needs a temporary name
- confidence or status words in comment text.

The script records the origin `llm`. Use `--by user` only when the user decides the change.

## Result

For a read: the current or historical knowledge in compact JSON. Each list of a list command has `count` and `listed`. `--max-listed` limits `listed`. The default is 50. When the list is longer, `rest` tells how to get the other items. For `revisions`, give `--before` with the oldest revision in `listed`.

For a write: the new revision and the current value after the write. If the write replaces a symbol, a region or an operand expression of a different origin, `previous` gives that row as it was before the write. For example, an `llm` write over a `user` name gives `previous`. Read `previous` and tell the user about the change. For `apply`, `replaced` lists each write that replaced a row. Each item has the number of the write, its `op` and its `previous`.

For `export`, `listing --out` and `join`: the written file as `{out, bytes, sha256}`.

## Failure and conflicts

- `conflict`: the change contradicts current knowledge. For example, the name belongs to another address. Read that address and its history, then decide.
- `stale-revision`: the knowledge changed after you read it. Read it again, then decide again.
- `not-found`: there is nothing to remove, no such revision or no such file.
- `conflict` with "from a git merge": git joined the knowledge of two computers, and two rows are current where the knowledge permits one row. For example, two names are at one address. Every read shows these rows in `conflicts`. Writes stop until you run `merge`. The `merge` command keeps the newest row of each conflict and closes the other rows, in one revision. Its result lists each choice. Tell the user the choices.
- `invalid-database` or `unsupported-schema`: tell the user the message. Do not edit the knowledge files.

A revert makes a new revision. The history stays complete.

## Handoffs

- Runtime evidence → c64-emulator
- Static evidence → c64-static-analysis
- Source from the knowledge → c64-source
- Names of routines that other programs share → c64-provenance
