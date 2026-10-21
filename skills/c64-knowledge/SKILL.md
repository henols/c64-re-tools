---
name: c64-knowledge
description: Reads and changes the durable knowledge of a C64 project in .c64-re-tools/knowledge/. The knowledge holds the program and the coverage of the runs. It holds the names, regions, comments and references, and the releases, switches, patches and macros of the source. It keeps the history of each change. Use it to find the knowledge at an address or a name. Use it to record a name, a region, a comment or a reference after you interpret the evidence. Use it to put a program or the coverage of runs into the project. Use it to record the releases, switches, patches and macros of the generated source. Use it to read the history, to revert to an earlier revision, or to decide the conflicts of a git merge. It does not run the program, analyze the machine code or generate the source.
---

# C64 knowledge

Use this script to read and change the knowledge of a C64 project.
Use only the commands of the script. Do not read or change the project knowledge in another way.

```bash
node <skill>/scripts/knowledge.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `at '$2100'`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

The knowledge is text in `.c64-re-tools/knowledge/` of the project. Commit that folder with git. Do not edit its files yourself. The script checks each change.

---

## Select the command

| Goal | Command |
|---|---|
| Find all knowledge at one address | `at '$2100'` |
| Find names and comment text | `search player` |
| List the symbols in a range | `symbols --range '$2000-$2fff'` |
| List the names that the analyzers gave | `symbols --analyzer` |
| List only the facts of the user and the LLM | `symbols --origin semantic` |
| List the regions, comments or references in a range | `regions --range '$2000-$2fff'` |
| Show the code of a range with names, comments, access and references | `listing '$0400-$04ff'` |
| Write all knowledge to one file | `export --out .c64-re-tools/local/knowledge.json` |
| Find what the knowledge holds of the program | `program` |
| Put a captured program into the knowledge | `image .c64-re-tools/local/capture/image.json` |
| Put a PRG into the knowledge | `image original/game.prg` |
| Put drive code into the knowledge | `image drive.prg --space drive8` |
| Add the coverage of runs | `coverage .c64-re-tools/local/runs/rooms/room0.bin` |
| Name the symbol at an address | `rename '$2100' update_player --kind routine --reason 'reads joystick 2'` |
| Remove a symbol | `remove-symbol '$2100'` |
| Classify memory | `classify '$3000-$303f' sprite` |
| Classify a table of records | `classify '$3000-$303b' bytes --element 6` |
| Make memory unknown, and keep the analyzers out of it | `unclassify '$3000-$303f'` |
| Write a comment | `comment '$2100' line Reads joystick 2.` |
| Add a reference | `reference '$2000' '$2100' call` |
| Find the places that a removal blocks | `suppressions --range '$2000-$2fff'` |
| Start a file of the generated source | `module '$2000' player.asm --title 'Player movement'` |
| Write the operand of an instruction as an expression | `operand '$8079' --lo irq_handler` |
| Record a release of the program | `release ORIGINAL --file original/game.prg --base` |
| Write a switch | `switch PROTECTION --kind protection --releases ORIGINAL` |
| Write the code of a switch for a range | `patch '$100e-$1010' PROTECTION --code-file no-check.asm` |
| List the releases, switches and patches | `switches` |
| Record the start screen of the program | `start-screen --mode multicolour --screen '$5c00' --bitmap '$6000' --colours '$8328' --border 0 --background 0` |
| Record the start screen of a captured stage, and its tune | `start-screen --stage bank1 --call '$9000'` |
| Remove the start screen | `unstart-screen` |
| Write a macro | `macro inc16 --params dst --body-file inc16.asm` |
| Write instructions as one use of a macro | `use '$1005-$100a' inc16 --args ptr` |
| Do many writes as one revision | `apply .c64-re-tools/local/batch.json` |
| Make one batch from the batches of parallel agents | `join a.json b.json --out .c64-re-tools/local/joined.json` |
| Read the history of an address or a name | `history '$2100'` |
| Read the last revisions | `revisions` |
| Go back to an earlier state | `revert 20261015T2145` |
| Decide the conflicts after a git merge | `merge --reason 'merge of two computers'` |

---

## Addresses, names and spaces

- A symbol is the name of an address from the user or the LLM. Get it from `at`, `search` or `symbols`.
- An analyzer name is a second name from DXA, Ghidra or an idiom search, for example `FUN_17e2`. Each analyzer keeps its own name at an address. Get them from `at`, `search` or `symbols --analyzer`.
- The generated source uses only the symbols. To use an analyzer name in the source, give the address that name with `rename`.
- A symbol name is a label for ACME: a letter or an underscore, then letters, digits or underscores. The knowledge refuses the name of a 6502 instruction, for example `lda`, in upper or lower case.
- A space is `c64` (the default), `drive8` for code in the 1541 drive, or `bank0` to `bank255` for cartridge banks and for a captured stage of the loading. Drive code, banks and stages use the same addresses as the C64. Thus each space has its own knowledge. A name is unique in one space.
- A revision id has the form `20261015T214501.123-k3f9qz`. It starts with the date and the time. Give the full id, or a start of the id that only one revision has. Get the ids from `revisions`, or from the `revision` field of a result. The revision `0` is the knowledge before the first revision.
- A file of a capture is the `image.json` that the capture of a packed program wrote. Keep the other files of the capture next to it.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- In a group folder, each version of a program is a project. The script refuses the group folder and each folder in it that is not a project. Give `--project` with a project of the group, for example `--project v1`.
- A path that a command only reads can go into another project of the group, for example `../v1/original/game.prg`. The command writes only in its own project.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/` and the index of the knowledge. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a test or another file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses that evidence in that folder.
- A coverage map can stay in `.c64-re-tools/local/`. The project knowledge keeps its ranges and its SHA-256.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--space <space>` | All commands | The space of the command: `c64`, `drive8`, or `bank0` to `bank255`. The default is `c64`. Without `--space`, `revert` reverts all spaces. |
| `--by <user\|llm>` | All commands in "Change the knowledge" | Who decided the change. The default is `llm`. Give `user` only when the user decided the change. |
| `--reason <text>` | All commands in "Change the knowledge" | Why you make the change. The revision keeps it, and `history` shows it. |
| `--evidence <kind:ref>` | All commands in "Change the knowledge" | One thing that the change rests on: `coverage:<map>`, `test:<file>`, `file:<file>` or `note:<text>`. You can give it more than one time. |
| `--expect-revision <revision>` | All commands in "Change the knowledge" | Refuse the change when the knowledge changed after this revision. Give the `revision` of your last read. |
| `--range <start>-<end>` | `symbols`, `regions`, `comments`, `references`, `suppressions`, `modules`, `operands`, `patches`, `uses`, `export` | Only the rows in this range. The default is all addresses. |
| `--origin <origin>` | `search`, `symbols`, `regions`, `comments`, `references`, `modules`, `operands`, `patches`, `macros`, `uses`, `export` | Only the rows of these origins: `user`, `llm`, `dxa`, `ghidra`, `heuristic`, `semantic` (user and llm), `analyzer` (dxa, ghidra and heuristic), or a comma list. The default is all origins. |
| `--max-listed <n>` | `search`, `symbols`, `regions`, `comments`, `references`, `suppressions`, `modules`, `operands`, `patches`, `switches`, `releases`, `macros`, `uses`, `spaces`, `history`, `revisions`, `revision`, `listing` | The most items in each list of the body. The default is 50. The counts are always complete. |
| `--kind <kind>` | `symbols`, `rename` | The symbol kind: `label`, `routine`, `variable`, `data` or `vector`. A read gives all kinds by default. A new symbol without `--kind` is a `label`. A `rename` without `--kind` keeps the kind of the symbol. |
| `--kind <kind>` | `references` | Only references of this kind: `call`, `jump`, `read`, `write`, `reference` or `pointer`. |
| `--kind <kind>` | `switch` | Necessary. The switch kind: `protection`, `trainer`, `cheat`, `crack`, `fix` or `change`. |
| `--analyzer` | `symbols` | List the analyzer names in place of the symbols. |
| `--type <type>` | `regions` | Only regions of this type. |
| `--switch <switch>` | `patches`, `unpatch` | Only the patches of this switch. For `unpatch`, the switch of the patch to remove. |
| `--switch <name>` | `history` | The history of a switch and its patches in place of an address. |
| `--macro <name>` | `uses` | Only the uses of this macro. |
| `--macro <name>` | `history` | The history of a macro in place of an address. |
| `--name <name>` | `history` | The history of a name in place of an address. |
| `--before <revision>` | `revisions` | Only the revisions before this one. |
| `--out <file>` | `export`, `join` | Necessary. The JSON file to write. |
| `--out <file>` | `listing` | Write the listing as text to this file in place of the lines in the body. |
| `--element <n>` | `classify` | The bytes of one element of a table. The length of the range must be a multiple of it. |
| `--title <text>` | `module` | The title of the file. A `module` write without a title keeps the title that the module has. |
| `--lo <symbol>` | `operand` | The operand is the low byte of the symbol plus the offset. |
| `--hi <symbol>` | `operand` | The operand is the high byte of the symbol plus the offset. |
| `--value <symbol>` | `operand` | The operand is the symbol plus the offset. |
| `--expr <text>` | `operand` | The operand is this ACME expression. |
| `--offset <n>` | `operand` | With `--lo`, `--hi` or `--value`: a whole number to add, for example `1` or `'$1000'`. Write a negative offset as `--offset=-1`. The default is 0. |
| `--code <text>` | `patch` | The ACME code of the patch. |
| `--code-file <file>` | `patch` | A project file with the ACME code of the patch. |
| `--nop` | `patch` | The patch is NOP only. |
| `--comment <text>` | `patch`, `switch`, `release`, `macro`, `start-screen` | A comment for the row. A `patch`, `switch`, `macro` or `start-screen` write without `--comment` keeps the comment that the row has. |
| `--default <0\|1>` | `switch` | The value in the default build. See the section of `switch`. |
| `--releases <A,B>` | `switch` | The labels of the releases that have the switch on, as a comma list. A write without it keeps the releases that the switch has. |
| `--file <file>` | `release` | Necessary. The PRG or `image.json` of the release, in a folder that git keeps. |
| `--base` | `release` | This release is the program of the knowledge. |
| `--params <a,b>` | `macro` | The params of the macro, as a comma list without a dot. The default is no params. |
| `--body <text>` | `macro` | The body of the macro. |
| `--body-file <file>` | `macro` | A project file with the body of the macro. |
| `--args <x, y>` | `use` | One expression for each param of the macro, as a comma list. |
| `--mode <mode>` | `start-screen` | The mode of the VIC-II: `text`, `hires` or `multicolour`. Necessary without `--stage`. |
| `--screen <address>` | `start-screen` | The address of the screen memory: 1000 bytes. Necessary without `--stage`. |
| `--bitmap <address>` | `start-screen` | The address of the bitmap: 8000 bytes. `hires` and `multicolour` need it. |
| `--charset <address>` | `start-screen` | The address of the charset: 2048 bytes. `text` needs it. |
| `--colours <address>` | `start-screen` | The address of the 1000 bytes that the loader copies to the colour RAM. |
| `--colour <0-15>` | `start-screen` | One colour for all of the colour RAM, in place of `--colours`. |
| `--border <0-15>` | `start-screen` | The border colour. Necessary without `--stage`. |
| `--background <0-15>` | `start-screen` | The background colour. Necessary without `--stage`. |
| `--stage <space>` | `start-screen` | The space of a captured stage that shows the screen, for example `bank1`. The script takes the mode, the addresses and the colours from the capture. Without it, the bytes are in the program at the entry. |
| `--call <address>` | `start-screen` | A routine of the stage that the start screen calls before it waits, for example the start of the loading tune. It must return with RTS. It needs `--stage`. |

---

## Read the knowledge

A read writes nothing. A project without knowledge gives empty lists and the revision `0`.

Each row in a body has `origin` and `revision`. A row of a space other than `c64` also has `space`.

When a git merge left conflicts in the knowledge, each read body also has `conflicts`. Each item gives the `conflict` and its `rows`. The `hint` tells you to decide the conflicts, and `nextAction` is the `merge` command. Each write stops until you run `merge`.

### `at <address>`

- `body` holds `address`, `comments`, `referencesFrom`, `referencesTo` and `revision`. When the knowledge has them, it also holds `symbol`, `analyzerNames`, `region`, `operand`, `patch`, `macroUse` and `suppressions`.
- `revision` is the current revision of the knowledge. Give it to `--expect-revision` of your next write.
- Use `at` for the addresses of the question before other work.

### `search <text>`

- `body` holds the lists `symbols`, `analyzerNames` and `comments` with the text in their names or comment text.
- If a list is long, give a longer text.

### `symbols`

- `body.symbols` lists the symbols, each with `address`, `name` and `kind`.
- With `--analyzer`, `body.analyzerNames` lists the analyzer names in place of the symbols.

### `regions`

- `body.regions` lists the regions, each with `start`, `end` and `type`. A table also has `element` and `count`.

### `comments`

- `body.comments` lists the comments, each with `address`, `placement` and `text`.

### `references`

- `body.references` lists the references, each with `from`, `to` and `kind`.

### `suppressions`

- `body.suppressions` lists the places that a removal blocks. Each item has `suppresses` (`symbol`, `region` or `reference`), the place, and the `reason` of the removal.
- `unclassify` and `unreference` block the place for DXA and Ghidra. A later analysis does not add a region in that range or that reference again. This is also true for a fact from the LLM.
- `remove-symbol` does not block the address, because an analyzer name never becomes a symbol.
- A `rename`, `classify` or `reference` at a blocked place ends the block there. A `revert` to a revision before the removal also ends the block.
- `at` and `history` also show the blocks.

### `modules`

- `body.modules` lists the modules, each with `start`, `file` and `title`.

### `operands`

- `body.operands` lists the operand expressions, each with `address`, `select` and `text`. `text` is the operand as the source writes it.

### `patches`

- `body.patches` lists the patches, each with `start`, `end`, `bytes`, `switch`, `code` and `comment`.

### `switches`

- `body.switches` lists the switches. Each item has `name`, `kind`, `default`, `base`, `releases`, `comment` and the ranges of its `patches`.
- `base` is the value of the switch in the program of the knowledge.

### `releases`

- `body.releases` lists the releases, the base release first. Each item has `label`, `file`, `sha256`, `base` and `define`.
- `define` is the assembler define that builds the release.

### `macros`

- `body.macros` lists the macros, each with `name`, `params`, `body` and `comment`.

### `uses`

- `body.uses` lists the macro uses, each with `start`, `end`, `macro`, `args` and `text`. `text` is the line of the source, for example `+inc16 ptr`.

### `spaces`

- `body.spaces` lists the spaces that hold knowledge.

### `program`

- `body.image` is `null` when the knowledge has no program in the space. Then put the program in with `image`.
- Else `body.image` has `segments`, `bytes`, `entry`, `state` and `stages`. `state` is `true` when the knowledge has the entry state of a capture. `stages` is the number of unpacker stages.
- `body.startScreen` gives the start screen of the space, when the knowledge has one.
- `body.coverage.maps` lists the coverage maps of the space. `body.coverage.ranges` gives the number of ranges of each access kind.

### `listing <range>`

- `body.lines` lists one line for each instruction of a code region, and one `!byte` line for other bytes.
- Each line has `address`, `bytes`, `text`, `referencesIn` and `referencesOut`. It can also have `label`, `analyzerNames` and `comment`.
- `text` is the instruction with the names of its target. An operand expression of the knowledge replaces the operand.
- When the knowledge has coverage, `access` tells if a run executed (`x`), read (`r`) or wrote (`w`) the bytes of the line, or `-` for none.
- With `--out`, the body has `lines` as a number, and `out`, `bytes` and `sha256` of the text file.
- If the knowledge has no program in the space, the script refuses. Put the program in with `image` first.
- Use `listing` in place of your own disassembler.

### `export`

- `body` holds `counts`, `revision`, `out`, `bytes` and `sha256`. `counts` gives the number of rows of each kind in the file.
- The file has all current knowledge of the space in the range, with the analyzer names and the source knowledge. `startScreen` is the start screen, when the knowledge has one.

---

## Read the history

### `history [<address>]`

- Give exactly one of `<address>`, `--name`, `--macro` and `--switch`.
- `body.history` lists the rows of all revisions. Each item has `entity`, the fields of the row, `fromRevision`, and `toRevision` when a later revision closed the row. It also has the `reason` and the `evidence` of the revision that wrote it.
- Use `history` when the current knowledge is surprising or disputed.

### `revisions`

- `body.revisions` lists the revisions, newest first. Each item has `id`, `operation`, `description`, `createdAt`, `origin` and `evidence`.
- To get older revisions, give `--before` with the oldest `id` in `listed`.

### `revision <revision>`

- `body.revision` gives the revision. `body.added` and `body.closed` list the rows that it added and closed.
- The rows include the memory, entry and coverage rows of the program.

---

## Change the knowledge

Each command in this group writes one revision. The first accepted write makes `.c64-re-tools/knowledge/`. A refused write writes nothing.

- `body.revision` is the new revision. A `revision` of `null` tells that nothing changed.
- When the write replaced a row of a different origin, `body.previous` gives that row as it was before. For example, an `llm` write over a `user` name gives `previous`. Read `previous` and tell the user about the change.
- A write can give the same fact that an analyzer gave. Then the fact gets the origin of the write, and the next analysis does not remove it.
- A `--by user` write over the same fact of `llm` changes the origin to `user`. A `--by llm` write over the same fact of `user` changes nothing.
- A comment, a module and an operand expression are at the start of an instruction. In a code region, the script refuses an address that is an operand byte of an instruction. The `hint` gives the start of that instruction. In data, each address is correct.

Errors of this group:

- `conflict`: the change contradicts the current knowledge. For example, the name belongs to another address. Read that address and its history. Then decide.
- `conflict` with "from a git merge": git joined the knowledge of two computers, and two rows are current where the knowledge permits one row. Run `merge`. Then write again.
- `stale-revision`: the knowledge changed after the revision of `--expect-revision`. Read the knowledge again. Then decide again.
- `not-found`: there is nothing to remove, no such revision, or no such file.
- `invalid-database` or `unsupported-schema`: give `error` and `hint` to the user. Do not edit the knowledge files.

### `rename <address> <name>`

- `body.symbol` gives the symbol after the write.
- A `rename` changes the name in each operand expression and in each argument of a macro use.

### `remove-symbol <address>`

- The knowledge refuses the removal while an operand expression or a macro use names the symbol. Remove the expression with `unoperand`, or the use with `unuse`, first.

### `classify <range> <type>`

- `body.regions` gives the regions after the write. A classification inside a region splits that region. Thus regions never overlap.
- With `--element`, each region item also has `element` and `count`.

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
| `dual-use` | Code at one time, and data or a vector at another time. No analyzer finding conflicts with it. |

### `unclassify <range>`

- The range becomes unknown. The analyzers do not classify it again. See the section of `suppressions`.

### `comment <address> <placement> <text>...`

- `<placement>` is `line` or `side`. A `line` comment is a line of its own above the address. A `side` comment is at the end of the line of the address.
- `body.comment` gives the comment after the write.

### `uncomment <address> <placement>`

- Removes the comment of that placement.

### `reference <from> <to> <kind>`

- `<kind>` is `call`, `jump`, `read`, `write` or `reference`. Only an operand expression writes a `pointer` reference.
- `body.reference` gives the reference after the write.

### `unreference <from> <to> <kind>`

- The analyzers do not add this reference again. See the section of `suppressions`.

### `module <start> <file.asm>`

- A module tells where a file of the generated source starts. The file runs to the next module or to the end of its segment.
- Each address has one module, and each file name has one module.
- A file name has letters, digits, underscores or hyphens, and ends in `.asm`. It has no folder.
- The generated source has the files `main.asm`, `loader.asm`, `switches.asm`, `config.asm`, `constants.asm` and `macros.asm` already. Thus a module cannot have one of these names, in upper or lower case.
- The title becomes the first line of the file.
- `body.module` gives the module after the write.

### `unmodule <start>`

- Removes the module that starts at the address.

### `operand <address>`

An operand expression tells the generated source how to write the operand of one instruction. The source then has a name, not a number. When code or data changes its length, the operand follows the address that moved.

| Flag | Source |
|---|---|
| `--lo irq_handler` | `lda #<irq_handler` |
| `--hi sprite_bank --offset '$1000'` | `lda #>(sprite_bank+$1000)` |
| `--value bar_colours --offset=-1` | `lda bar_colours-1,x` |
| `--expr '(sprite_bank + 5*64) / 64'` | `lda #(sprite_bank + 5*64) / 64` |

- Give exactly one of `--lo`, `--hi`, `--value` and `--expr`.
- The knowledge must have the program of the space. Else the script refuses. Put the program in with `image` first.
- The address is the start of an instruction in a code region, as `listing` shows it. The script refuses an address in no code region. Classify the code first.
- A name is a symbol of the knowledge or a platform name of the C64 memory map.
- `--expr` takes `$`, `%` and decimal numbers, names, brackets, the operators `+ - * / % << >> >>> & | XOR`, and `<`, `>`, `-` and `!` before an operand.
- The script compares the value of the expression with the operand in the program. If they are not equal, the script refuses the write. The `error` gives both values.
- Each name in the expression gets a `pointer` reference from the instruction. Thus `at` on the named address shows the code that uses the address.
- `body.operand` gives the expression after the write, with its `text`.
- Write an operand expression for each immediate that is a byte of an address. Also write one for each table read through the byte before the table. The pointer candidates of a static analysis show many of these places.

### `unoperand <address>`

- Removes the operand expression at the address.

### `release <label>`

A rebuild keeps all of the program in the source: unused bytes, dead code, old copies and leftovers of the development. The default build and the loader do not have the leftovers. The build of a release has them. It keeps a copy protection, a trainer and a cheat in the source. A switch puts each of them in or out of the build. A start screen of the program stays too: record it with `start-screen`. Only a cracktro and the other screens of a crack are not in the rebuild.

Do not write a file of the rebuild by hand, for example a boot file, a packed picture or a script that changes bytes. Record each change in the knowledge, and generate the source.

- A release is a PRG or the `image.json` of a capture, in a folder that git keeps, for example `original/`. The script refuses a file in `.c64-re-tools/local/`.
- A label is upper case, for example `ORIGINAL`, `FIRESTAR` or `V2`.
- The base release is the release whose bytes are the program of the knowledge. Record it with `--base`. The script refuses `--base` when the segments or the bytes of the file are not the program.
- A space has one base release. Record the base release before the first switch.
- The build of a release gives each switch the value of that release. The check of the generated source compares that build with the bytes of the file.
- `body.release` gives the release, with its `sha256` and its `define`.

### `unrelease <label>`

- The knowledge refuses a release that a switch names. It also refuses the base release while the knowledge has switches.

### `start-screen`

A start screen is a loading screen, a title screen or a presentation screen of the program itself. The loader of the generated source shows it before the program starts. Then the loader waits for a key, or for a fire button on joystick port 1 or 2.

- Record only a screen of the program itself. Do not record a screen of a crack, for example a picture, an intro or a credit screen of a crack group.
- If a release changed the screen of the program, stop and ask the user how to deal with it. An example is a picture with the text of a crack in it. Do not decide alone. Give the user these options:
  1. Record patches under a switch that take out the change.
  2. Use the screen as it is.
  3. Do not record a start screen.
- The bytes of the screen must be in the program of the knowledge at the entry, or in a captured stage.

#### A start screen of a captured stage

Use this when a stage of the loading shows the screen, and the program at the entry does not have it. Do these steps:

1. Capture the stage while it shows the screen. Do not exclude the memory of the screen.
2. Put the capture into the knowledge in a space of its own, for example `image stage/image.json --space bank1`.
3. If the stage plays a tune or does other work during the screen, find the routine that starts it. Run the stage with coverage while that routine runs. Put the map into the knowledge with `coverage <map> --space bank1`.
4. Record the start screen with `start-screen --stage bank1`, and with `--call` for the routine.

- The script takes the mode, the screen, the bitmap or the charset, the colours and the colour RAM from the capture. Do not find the addresses or the colours yourself.
- The generated source puts the screen in memory. It does not matter where the stage keeps its bytes, if the memory has enough room.
- A flag that you give replaces the value of the capture. Give a flag only to correct a value.
- A capture of an older version has no colour RAM. Then capture the stage again.

#### A start screen in the program

- Capture the program while the bytes of the screen are in memory.
- Get the mode, the addresses and the colours from the VIC-II while the original program shows the screen.
- Find the 1000 colour bytes in the program: compare them with the colour RAM at $d800 while the original shows the screen. Give their address with `--colours`. If the program does not have them, give one colour with `--colour`.

#### The rules of the VIC-II

- `text` needs `--charset`. `hires` and `multicolour` need `--bitmap`. `text` and `multicolour` need `--colours` or `--colour`. `hires` uses neither.
- The screen is at a step of $0400, the bitmap at a step of $2000 and the charset at a step of $0800. They must be in one VIC bank of 16 KB.
- In VIC bank 0 and 2, the VIC-II reads the character ROM at $1000-$1fff of the bank. A screen or a bitmap cannot be there. A charset at $1000 or $1800 of the bank is the character ROM.
- No part can be in $0000-$03ff. The colours cannot be in $d000-$dfff.
- A space has one start screen, and only the space `c64` has one. A write replaces the start screen of the knowledge.
- The generated source has the switches `START_SCREEN` and `LEFTOVERS`. Thus no symbol and no switch can have these names.
- `body.startScreen` gives the start screen after the write.

### `unstart-screen`

- Removes the start screen. The loader of the generated source then starts the program at once.

### `switch <name>`

A switch has a kind, a default, and the releases that have it on. The generated source writes all switches with their defaults.

| Kind | What it changes | Default |
|---|---|---|
| `protection` | A copy protection | 0 (off) |
| `trainer` | A trainer, for example infinite lives | 0 (off) |
| `cheat` | A cheat | 0 (off) |
| `crack` | A change that a cracker made in the program, for example a credit text | 0 (off) |
| `fix` | A correction that one or more releases have | 1 (on). Give `--default 0` only for an alternative (see `patch`). |
| `change` | Another difference between releases | Give `--default 0` or `--default 1`. |

- The default build is the clean program. It has no copy protection, trainer, cheat or crack change, and it has all corrections. Thus the script refuses `--default 1` for `protection`, `trainer`, `cheat` and `crack`.
- A switch that no release has on, for example a trainer of your own, has no `--releases`.
- The base value of a switch is 1 when the base release has it on, else 0. The program of the knowledge has the base value of each switch.
- A switch name is upper case, for example `PROTECTION`, `TRAINER` or `FIX_LIVES`. It cannot start with `RELEASE_`. It cannot be the name of a symbol or a platform name.
- The script refuses a change of the base value while the switch has patches. Remove the patches first, because they hold the other state.
- The script refuses defaults that put in two alternatives.
- `body.switch` gives the switch after the write, with its `base`.

### `unswitch <name>`

- The knowledge refuses a switch that has patches. Remove the patches with `unpatch` first.

### `patch <range> <switch>`

A patch is ACME code for a range of the program. The code is the bytes of the switch in the state that the base release does not have. Examples:

- The base release has a copy protection. The switch `PROTECTION` names the base release. The code is the program without the protection, for example NOP in place of the `JSR` to the check.
- The base release has the protection already removed, and another release has it. The code is the bytes of the protection from that release. When no release has these bytes, write in a comment that the crack removed the protection.
- A correction is only in release `V2`. The switch `FIX_LIVES` names `V2`, and the code is the bytes of `V2`.
- A correction is in the base release and not in `V1`. The switch names the base release, and the code is the bytes of `V1`.

Rules:

- Give exactly one of `--code`, `--code-file` and `--nop`.
- Write the switch first. `patch` refuses a switch that the knowledge does not have.
- Many patches can have the same switch.
- The code must fit in the range. NOP (`$EA`) fills the bytes after the code.
- `patch` refuses code that is longer than the range when each line is a 6510 instruction, `!byte`, `!word`, `!fill` or a comment. It does not check the length of other code, for example code with a label or a macro. The check of the generated source finds these errors.
- The code can use the labels and the macros of the source, and local labels with a dot, for example `.skip`.
- The braces in the code must be pairs.
- Patches of different switches can have the same range. They are alternatives, for example two releases with two different corrections of one bug. The default build can put in only one of them.
- The knowledge refuses all other overlaps of patches. A patch cannot overlap a macro use.
- A patch with the same start and the same switch replaces the patch.
- Each byte of the range must be in the program of the knowledge.
- `body.patch` gives the patch after the write.

### `unpatch <start>`

- When patches of two switches start at the address, give the switch with `--switch`.

### `macro <name>`

A macro writes a run of instructions as one line of the source, for example `+inc16 ptr`. Use macros to make the source shorter and easier to read.

- Give `--body` or `--body-file`. The body uses each param with a dot, for example `.dst`.
- The knowledge refuses a change of the number of params while the macro has uses.
- `body.macro` gives the macro after the write.

### `unmacro <name>`

- The knowledge refuses a macro that has uses. Remove the uses with `unuse` first.

### `use <range> <macro>`

- The range is complete instructions of the program of the knowledge.
- Each name in an argument is a symbol of the knowledge or a platform name.
- A use cannot overlap a patch or another use.
- The generated source writes a use only when the use gives the bytes of the program. Else it writes the instructions and gives the reason.
- `body.use` gives the use after the write.

### `unuse <start>`

- Removes the macro use that starts at the address.

### `image <file>`

- `<file>` is the `image.json` of a capture, or a PRG. A PRG has the extension `.prg` or no extension. The script refuses a file with another extension.
- For drive code or a cartridge bank, give `--space drive8` or `--space bank0`.
- `body` holds `revision`, `bytes`, `rowsAdded`, `rowsClosed` and `entryChanged`.
- `image` writes only the bytes that changed. The same image again writes nothing. A new image replaces the program of the space. The history keeps the old bytes.
- After the import, you do not need the file of the capture. Keep it in `.c64-re-tools/local/`.

### `coverage <map>...`

- `<map>` is a 64 KiB coverage map of a run. Write each map in `.c64-re-tools/local/`.
- `body` holds `revision`, `imported`, `known` and `ranges`. `imported` lists the new maps. `known` lists the maps that the space has already.
- `coverage` joins the maps. It keeps each address that a run executed, read or wrote. It also keeps each address that one run wrote and executed: self-modified code.
- `coverage` puts each map into the space of `--space`. You can add the same map to each space.
- `--evidence coverage:<map>` names a map by its path at the import. It refers to the last import of that map into the space of the write.

### `apply <file>`

- `<file>` is a JSON list of writes. Give `-` to read the list from standard input.
- `body` holds `revision`, `writes` and `replaced`. Each item of `replaced` has the number of the `write`, its `op` and its `previous`.
- All writes become one revision. If the knowledge refuses one write, the script writes nothing, and the `error` names the write.
- Each write has `op` and the fields of the command with the same name. Each write can also have `space`. For example:

```json
[
  { "op": "rename", "address": "$2100", "name": "update_player", "kind": "routine" },
  { "op": "classify", "start": "$3000", "end": "$303b", "type": "bytes", "element": 6 },
  { "op": "comment", "address": "$2100", "placement": "line", "text": "Reads joystick 2." }
]
```

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
| `unpatch` | `start`, `switch` (optional) |
| `macro` | `name`, `params` (a list or a comma list), `body`, `comment` (optional) |
| `unmacro` | `name` |
| `use` | `start`, `end`, `macro`, `args` (a list or a comma list) |
| `unuse` | `start` |

- The script checks an `operand`, `patch` or `use` write against the program of its space.
- Apply a batch from a library match or an idiom search in the same way. Read the notes of the result that wrote the batch first.

### `revert <revision>`

- Makes the knowledge the same as at the revision. Without `--space`, all spaces revert. With `--space`, only that space reverts.
- `body` holds `revision`, `restores`, and `spaces: "all"` or `space`.
- A revert is a new revision. The history stays complete.
- A revert also gives back the coverage maps of that revision. A revert to a revision before an import removes the map and its ranges. Then `--evidence coverage:<map>` refuses the map until you import it again.

### `merge`

- Decides each conflict that a git merge left. Of the rows of one conflict, the newest row stays. All choices become one revision.
- `body.choices` lists each choice, with the `conflict`, the row that is `kept` and the rows that are `closed`. Tell the user the choices.

---

## Batches of parallel agents

When more agents name the program at the same time, give each agent one range of addresses. Each agent writes one batch file and does not apply it. A batch has the form `{"owner": {"start": "$1000", "end": "$1fff"}, "ops": [...]}`. `ops` holds the writes, as for `apply`. The owner ranges must not overlap.

### `join <batch>...`

- `join` makes one batch from two or more batch files. It writes no knowledge.
- `body` holds `writes`, `repeated`, `choices`, `out`, `bytes` and `sha256`.
- `choices` lists each place where the batches gave different values, with the value that stays.
- At an address in the owner range of a batch, the name, the comment, the operand and the module of that batch stay. At an address that no batch owns, the first batch in the command stays.
- A batch can give an address a name that `join` replaces. Then `join` also replaces that name in the operand expressions and macro arguments of that batch.
- The regions of the owner come after the regions of the other batches. Thus the regions of the owner stay where they overlap.
- A name from a batch stays when another batch removes the symbol at that address.
- When one name or one module file is at two addresses, `join` writes nothing and gives the error `conflict`. The `error` names the addresses and the batches. Correct the batches. Then do `join` again.
- The `hint` tells you to examine `choices`. `nextAction` is the `apply` command for the joined batch. Run it when the choices agree with your task.

---

## Workflow

Read:

1. Run `at` for the addresses of the question.
2. Run `history` when the current knowledge is surprising or disputed. Each row gives the `reason` and the `evidence` of the revision that wrote it.

Write:

1. Read the current value with `at`. Keep the `revision` of the body.
2. Decide the change. Keep observed facts apart from your conclusions.
3. Write the change with `--reason`, and with `--expect-revision` set to the revision that you read. Give `--evidence` for each thing that the change rests on.
4. Read the body. If it has `previous`, tell the user.

Put the program into the knowledge:

1. For a packed program, capture the unpacked program into `.c64-re-tools/local/`. Then run `image` with its `image.json`.
2. For a program without a packer, drive code or a cartridge bank, run `image` with the PRG.
3. Write the coverage map of each run into `.c64-re-tools/local/`. Then run `coverage` with the maps.
4. Run `program` to see the segments, the entry and the coverage maps.

Write knowledge only after interpretation:

- a symbol name that tells what a routine or a variable does
- a region type that the evidence supports
- a comment that explains behavior that a name cannot show
- a reference that the evidence supports.

Do not write:

- temporary investigation state
- a guess, only because a routine needs a temporary name
- confidence or status words in comment text.

For runtime evidence, examine the program in the emulator. For static evidence, analyze the machine code. To make the source from the knowledge, generate the source. To name the routines that other programs share, match the program against a routine library.

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
