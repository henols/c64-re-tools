---
name: c64-knowledge
description: Reads and changes the durable knowledge of a C64 project. The knowledge holds the program and the coverage of the runs. It holds the names, regions, comments and references, and the releases, switches, patches, macros and start screen of the source. It keeps the history of each change. Use it to find the knowledge and the access of the runs at addresses or names. Use it to record a name, a region, a comment or a reference after you interpret the evidence. Use it to put a program, the coverage of runs or a recording into the project. Use it to record the releases, switches, patches, macros and start screen of the generated source. Use it to read the history, to revert to an earlier revision, or to decide the conflicts of a git merge. Use it to start a check of the comments by another agent, to record the verdicts of the check and to get its result. It does not run the program, analyze the machine code or generate the source.
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

Commit the folder `.c64-re-tools/knowledge/` of the project with git.

---

## Select the command

| Goal | Command |
|---|---|
| Find all knowledge and the access of the runs at addresses | `at '$2100' '$2104' '$3000'` |
| Find names and comment text | `search player` |
| List the symbols in a range | `symbols --range '$2000-$2fff'` |
| List the names that the analyzers gave | `symbols --analyzer` |
| List the regions in a range, and count the bytes of each type | `regions --range '$2000-$2fff'` |
| Find the references into a range, counted by kind and target | `references --range '$2000-$2fff' --direction in` |
| Find the routines that a range calls | `references --range '$2000-$2fff' --direction out --kind call` |
| Show the code of a range with names, comments, access and references | `listing '$0400-$04ff'` |
| Show only the instructions of a range | `listing '$0400-$04ff' --code` |
| Start a check of 30 comments, selected at random | `sample` |
| Get the comments and the verdicts of a check | `checks 4711` |
| Record the verdict of one comment of a check | `verdict 4711 '$2100' wrong --class callers --why 'JSR at $1f00 calls it too' --text 'Moves the player.'` |
| Write all knowledge to one file | `export --out .c64-re-tools/local/knowledge.json` |
| Find what the knowledge holds of the program | `program` |
| Put a captured program into the knowledge | `image .c64-re-tools/local/capture/image.json` |
| Put a PRG into the knowledge | `image releases/game.prg` |
| Add the coverage of runs | `coverage .c64-re-tools/local/runs/rooms/room0.bin` |
| Add the coverage of a recording | `coverage tests/recordings/walk` |
| Name the symbol at an address | `rename '$2100' update_player --kind routine --reason 'reads joystick 2'` |
| Remove a symbol | `remove-symbol '$2100'` |
| Classify memory | `classify '$3000-$303f' sprite` |
| Classify a table of records | `classify '$3000-$303b' bytes --element 6` |
| Make memory unknown, and keep the analyzers out of it | `unclassify '$3000-$303f'` |
| Write a comment | `comment '$2100' line Reads joystick 2.` |
| Add a reference | `reference '$2000' '$2100' call` |
| Start a file of the generated source | `module '$2000' game/player.asm --title 'Player movement'` |
| Write the operand of an instruction as an expression | `operand '$8079' --lo irq_handler` |
| Record a release of the program | `release FIRESTAR --file releases/game.prg --base` |
| Get the files of the releases and their SHA-256 | `releases` |
| Write a switch | `switch PROTECTION --kind protection --releases FIRESTAR` |
| Write the code of a switch for a range | `patch '$100e-$1010' PROTECTION --code-file no-check.asm` |
| Record the patch from the bytes of a release | `patch '$100e-$1010' FIX_LIVES --from-release V2` |
| List the switches and the ranges of their patches | `switches` |
| Record the start screen in the program from a capture | `start-screen --capture .c64-re-tools/local/title/image.json` |
| Record the start screen of a captured stage, and its tune | `start-screen --stage loading --call '$9000'` |
| Write a macro | `macro inc16 --params dst --body-file inc16.asm` |
| Write instructions as one use of a macro | `use '$1005-$100a' inc16 --args ptr` |
| Do many writes as one revision | `apply .c64-re-tools/local/batch.json` |
| Show the batches of parallel agents as one list of writes | `join a.json b.json` |
| Write the batches of parallel agents as one revision | `join a.json b.json --apply` |
| Read the history of an address or a name | `history '$2100'` |
| Read the last revisions | `revisions` |
| See what one revision changed | `revision 20261015T2145` |
| Go back to an earlier state | `revert 20261015T2145` |
| Decide the conflicts after a git merge | `merge --reason 'merge of two computers'` |

---

## Addresses, names and spaces

- A symbol is the name of an address from the user or the LLM. Get it from `at`, `search` or `symbols`.
- An analyzer name is a second name from DXA, the decompiler or an idiom search, for example `FUN_17e2`. Each analyzer keeps its own name at an address. Get them from `at`, `search` or `symbols --analyzer`.
- The generated source uses only the symbols. To use an analyzer name in the source, give the address that name with `rename`.
- A symbol name is a label for ACME: a letter or an underscore, then letters, digits or underscores. The knowledge refuses the name of a 6502 instruction, for example `lda`, in upper or lower case.
- A space is `c64` (the default), `drive8` for code in the 1541 drive, `loading` or `bank0` to `bank255`. `loading` is the captured stage of the loading that shows the start screen. `bank0` to `bank255` are cartridge banks, or other memory images of the program, for example a file that the program loads later. Each space has its own knowledge. A name is unique in one space.
- A revision id has the form `20261015T214501.123-k3f9qz`. Give the full id, or a start of the id that only one revision has. Get the ids from `revisions`, or from the `revision` field of a result. The revision `0` is the knowledge before the first revision.
- A file of a capture is the `image.json` that the capture of a packed program wrote. The other files of the capture must be next to it.

### Paths and the project folder

- Give each path relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project, give `--project <folder>` to each command. If the working directory has projects below it, the script refuses and lists them.
- In a group folder, each version of a program is a project. The script refuses the group folder and each folder in it that is not a project. Give `--project` with a project of the group, for example `--project v1`.
- A path that a command only reads can go into another project of the group, for example `../v1/releases/game.prg`. The command writes only in its own project.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Put an address in single quotes in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- The script refuses an `--out` path in `.c64-re-tools/knowledge/`. Change the project knowledge only with the commands that change it.
- The script refuses a folder where the command writes a file. It refuses a file where the command writes a folder.
- When a test or another file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses that evidence in that folder.
- A coverage map can stay in `.c64-re-tools/local/`. Do not move a coverage map after you put it into the project knowledge.
- To keep a run as evidence, use the command that keeps a run. It copies the run, its results and its snapshot files into `runs/<name>/`, and it changes the paths in the copy. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.


---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--space <space>` | All commands except `verdict` and `checks` | The space of the command: `c64`, `drive8`, `loading`, or `bank0` to `bank255`. The default is `c64`. Without `--space`, `revert` reverts all spaces. |
| `--by <user\|llm>` | All commands in "Change the knowledge" | Who decided the change. The default is `llm`. Give `user` only when the user decided the change. |
| `--reason <text>` | All commands in "Change the knowledge" | Why you make the change. The revision keeps it, and `history` shows it. |
| `--evidence <kind:ref>` | All commands in "Change the knowledge" | One thing that the change rests on: `coverage:<map>`, `test:<file>`, `file:<file>` or `note:<text>`. You can give it more than one time. |
| `--expect-revision <revision>` | All commands in "Change the knowledge" | Refuse the change when the knowledge changed after this revision. Give the `revision` of your last read. |
| `--range <start>-<end>` | `symbols`, `regions`, `comments`, `sample`, `references`, `suppressions`, `modules`, `operands`, `patches`, `uses`, `export` | Only the rows in this range. The default is all addresses. |
| `--origin <origin>` | `search`, `symbols`, `regions`, `comments`, `references`, `modules`, `operands`, `patches`, `macros`, `uses`, `export` | Only the rows of these origins: `user`, `llm`, `dxa`, `decompiler`, `heuristic`, `semantic` (user and llm), `analyzer` (dxa, decompiler and heuristic), or a comma list. The default is all origins. |
| `--origin <origin>` | `sample` | Only the comments of these origins. The default is `llm`. |
| `--count <n>` | `sample` | The number of comments in the sample. The default is 30. |
| `--seed <n>` | `sample` | A whole number from 0 to 999999 that selects the sample. Without it, the script selects one. |
| `--placement <line\|side>` | `verdict` | The placement of the comment. Give it when the sample has a line and a side comment at the address. |
| `--class <class>` | `verdict` | With `wrong`: the class of the error: `callers`, `bits`, `registers`, `bounds`, `units`, `paths`, `tables`, `hardware`, `place` or `scope`. |
| `--why <text>` | `verdict` | With `wrong`: the evidence, with the addresses and the instructions. With `unsure`: the run that can show the claim. |
| `--text <text>` | `verdict` | With `wrong`: the correct comment. |
| `--name <name>` | `verdict` | With `wrong`: the correct name at the address. |
| `--max-listed <n>` | `search`, `symbols`, `regions`, `comments`, `references`, `suppressions`, `modules`, `operands`, `patches`, `switches`, `releases`, `macros`, `uses`, `spaces`, `history`, `revisions`, `revision`, `listing`, `join`, `checks` | The most items in each list of the body. The default is 50. The counts are always complete. |
| `--kind <kind>` | `symbols`, `rename` | The symbol kind: `label`, `routine`, `variable`, `data` or `vector`. A read gives all kinds by default. A new symbol without `--kind` is a `label`. A `rename` without `--kind` keeps the kind of the symbol. |
| `--kind <kind>` | `references` | Only references of this kind: `call`, `jump`, `read`, `write`, `reference` or `pointer`. |
| `--kind <kind>` | `switch` | Necessary. The switch kind: `protection`, `trainer`, `cheat`, `crack`, `fix` or `change`. |
| `--direction <in\|out\|inside>` | `references` | With `--range`: `in` from outside into the range, `out` from the range to outside, or `inside` with both ends in the range. |
| `--analyzer` | `symbols` | List the analyzer names in place of the symbols. |
| `--type <type>` | `regions` | Only regions of this type. |
| `--switch <switch>` | `patches`, `unpatch` | Only the patches of this switch. For `unpatch`, the switch of the patch to remove. |
| `--switch <name>` | `history` | The history of a switch and its patches in place of an address. |
| `--macro <name>` | `uses` | Only the uses of this macro. |
| `--macro <name>` | `history` | The history of a macro in place of an address. |
| `--name <name>` | `history` | The history of a name in place of an address. |
| `--before <revision>` | `revisions` | Only the revisions before this one. |
| `--out <file>` | `export` | Necessary. The JSON file to write. |
| `--apply` | `join` | Write the joined writes to the project knowledge as one revision. Without it, `join` writes nothing. |
| `--code` | `listing` | Only the instructions of the code regions. No data lines. |
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
| `--from-release <label>` | `patch` | The code is the bytes of this release in the range. The base release is not permitted. |
| `--comment <text>` | `patch`, `switch`, `release`, `macro`, `start-screen` | A comment for the row. A `patch`, `switch`, `macro` or `start-screen` write without `--comment` keeps the comment that the row has. |
| `--default <0\|1>` | `switch` | The value in the default build. See "Switches" of `<skill>/references/source-knowledge.md`. |
| `--releases <A,B>` | `switch` | The labels of the releases that have the switch on, as a comma list. A write without it keeps the releases that the switch has. |
| `--file <file>` | `release` | Necessary. The PRG or `image.json` of the release. |
| `--base` | `release` | This release is the program of the knowledge. |
| `--params <a,b>` | `macro` | The params of the macro, as a comma list without a dot. The default is no params. |
| `--body <text>` | `macro` | The body of the macro. |
| `--body-file <file>` | `macro` | A project file with the body of the macro. |
| `--args <x, y>` | `use` | One expression for each param of the macro, as a comma list. |
| `--capture <image.json>` | `start-screen` | A capture of the program while it shows the screen. The script takes the screen and its colours from it. |
| `--stage <space>` | `start-screen` | The space of the captured stage that shows the screen: `loading`. The script takes the screen and its colours from the capture of the stage. |
| `--call <address>` | `start-screen` | A routine of the stage that the start screen calls before it waits, for example the start of the loading tune. It must return with RTS. It needs `--stage`. |
| `--mode <mode>` | `start-screen` | The mode of the VIC-II: `text`, `hires` or `multicolour`. Necessary without `--capture` and `--stage`. |
| `--screen <address>` | `start-screen` | The address of the screen memory: 1000 bytes. Necessary without `--capture` and `--stage`. |
| `--bitmap <address>` | `start-screen` | The address of the bitmap: 8000 bytes. `hires` and `multicolour` need it. |
| `--charset <address>` | `start-screen` | The address of the charset: 2048 bytes. `text` needs it. |
| `--colours <address>` | `start-screen` | The address of the 1000 bytes that the loader copies to the colour RAM. |
| `--colour <0-15>` | `start-screen` | One colour for all of the colour RAM, in place of `--colours`. |
| `--border <0-15>` | `start-screen` | The border colour. Necessary without `--capture` and `--stage`. |
| `--background <0-15>` | `start-screen` | The background colour. Necessary without `--capture` and `--stage`. |

---

## Read the knowledge

A read writes nothing. A project without knowledge gives empty lists and the revision `0`. Each row in a body has `origin` and `revision`. A row of a space other than `c64` also has `space`.

When a git merge left conflicts in the knowledge, each read body also has `conflicts`. Each item gives the `conflict` and its `rows`. Each write stops until you run `merge`, the `nextAction` of the read.

### `at <address>...`

- Give all addresses of the question to one `at`. Do not run `at` in a loop.
- `body.revision` is the current revision of the knowledge. Give it to `--expect-revision` of your next write.
- `body.addresses` has one item for each address, with `address`, `comments`, `referencesFrom` and `referencesTo`. When the knowledge has them, an item also has `symbol`, `analyzerNames`, `region`, `operand`, `patch`, `macroUse` and `suppressions`.
- When the space has coverage maps, an item also has `coverage` and `access`. `coverage` gives the `map` and the `access` of each map. `access` is the access of all maps: `x`, `rw`, `r`, `w` or `-`. See "Access" of `<skill>/references/coverage.md`.

### `search <text>`

- `body` holds the lists `symbols`, `analyzerNames` and `comments` with the text in their names or comment text. If a list is long, give a longer text.

### `symbols`

- `body.symbols` lists the symbols, each with `address`, `name` and `kind`. With `--analyzer`, `body.analyzerNames` lists the analyzer names in place of the symbols.

### `regions`

- `body.regions` lists the regions, each with `start`, `end` and `type`. A table also has `element` and `count`.
- `body.byType` gives the `count` of the regions of each type, and their `bytes` in the range. It counts all regions that the flags select, also the regions that `listed` does not show.

### `comments`

- `body.comments` lists the comments, each with `address`, `placement` and `text`.

### `references`

- `body.references` lists the references, each with `from`, `to` and `kind`. Without `--direction`, a reference with one end in the range is in the list.
- `body.byKind` gives the number of references of each kind. `body.byTarget` lists the targets, the target of the most references first. Each item has `to`, `count`, and `name` when the target has a name.

### `suppressions`

- `body.suppressions` lists the places that a removal blocks. Each item has `suppresses` (`symbol`, `region` or `reference`), the place, and the `reason` of the removal.
- `unclassify` and `unreference` block the place for the analyzers. A later analysis does not add a region in that range or that reference again. This is also true for a fact from the LLM.
- A `rename`, `classify` or `reference` at a blocked place ends the block there. A `revert` to a revision before the removal also ends the block.

### `modules`

- `body.modules` lists the modules, each with `start`, `file` and `title`.

### `operands`

- `body.operands` lists the operand expressions, each with `address`, `select` and `text`. `text` is the operand as the source writes it.

### `patches`

- `body.patches` lists the patches, each with `start`, `end`, `bytes`, `switch`, `code` and `comment`.

### `switches`

- `body.switches` lists the switches. Each item has `name`, `kind`, `default`, `base`, `releases`, `comment` and the ranges of its `patches`. `base` is the value of the switch in the program of the knowledge.

### `releases`

- `body.releases` lists the releases, the base release first. Each item has `label`, `base`, `define`, `file` and `sha256`. `define` is the assembler define that builds the release.
- `file` is the path of the file of the release, and `sha256` is the SHA-256 of that file. Use them for the facts of a release, for example in a README. Do not calculate a SHA-256 yourself.

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

- `body.lines` has `count` and `listed`. Each line has `address`, `bytes`, `text`, `referencesIn` and `referencesOut`. It can also have `label`, `analyzerNames`, `lineComments` (the line comments before the line), `comment` (the side comment) and `access`.
- `text` is the instruction with the names of its target. An operand expression of the knowledge replaces the operand. A table of addresses or words shows its values as `!word` lines, with the name of each target. A split table and the other bytes show as `!byte` lines.
- `access` is there when the knowledge has coverage: `x`, `r`, `w` or `-`. See "Reads that the program does not do" of `<skill>/references/coverage.md`.
- With `--code`, `lines` has only the instructions of the code regions.
- With `--out`, `body.lines` is a number, and the body has `out`, `bytes` and `sha256` of the text file.
- Use `listing` in place of your own disassembler. To find the targets of a table, classify the table with its type. Then read its listing. Do not decode the bytes of a table yourself.

### `export`

- `body` holds `counts`, `revision`, `out`, `bytes` and `sha256`. `counts` gives the number of rows of each kind in the file.
- The file has all current knowledge of the space in the range, with the analyzer names, the source knowledge and the start screen.

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

- `body.revision` gives the revision. `body.counts` gives the number of rows that it `added` and `closed`, for each kind of row.
- `body.added` and `body.closed` list the rows. They include the memory, entry and coverage rows of the program. A coverage row gives the `map`, the access `kind` and the number of `ranges` of that kind in the map.
- Use `revision` to see what one revision changed.

---

## Change the knowledge

Each command in this group writes one revision. A refused write writes nothing.

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

- `body.symbol` gives the symbol after the write. A `rename` changes the name in each operand expression and in each argument of a macro use.

### `remove-symbol <address>`

- The knowledge refuses the removal while an operand expression or a macro use names the symbol. Remove the expression with `unoperand`, or the use with `unuse`, first.

### `classify <range> <type>`

- `body.regions` gives the regions after the write. A classification inside a region splits that region. Thus regions never overlap.

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

- A module tells where a file of the generated source starts. The file runs to the next module or to the end of its segment. The title becomes the first line of the file.
- A file name ends in `.asm` and can have one folder, for example `music/driver.asm`. Put the modules of one part of the program in one folder, for example `music/`, `irq/` or `graphics/`.
- Each address has one module, and each file name has one module.
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

- Give exactly one of `--lo`, `--hi`, `--value` and `--expr`. A name is a symbol of the knowledge or a platform name of the C64 memory map.
- The address is the start of an instruction in a code region, as `listing` shows it.
- The script refuses an expression whose value is not the operand in the program. The `error` gives both values.
- Each name in the expression gets a `pointer` reference from the instruction. Thus `at` on the named address shows the code that uses the address.
- `body.operand` gives the expression after the write, with its `text`.
- Write an operand expression for each immediate that is a byte of an address. Also write one for each table read through the byte before the table. The pointer candidates of a static analysis show many of these places.

### `unoperand <address>`

- Removes the operand expression at the address.

### `release <label>`

- `body.release` gives the release, with its `define`, `file` and `sha256`. `body.bytes` gives the number of bytes of the file.
- See "Releases" of `<skill>/references/source-knowledge.md`.

### `unrelease <label>`

- The knowledge refuses a release that a switch names, and the base release while the knowledge has switches.

### `start-screen`

- When the program at the entry has the screen, give `--capture` with a capture of the program while it shows the screen. When a stage of the loading shows the screen, give `--stage loading`. See "Start screens" of `<skill>/references/start-screen.md`.
- `body.startScreen` gives the start screen after the write.

### `unstart-screen`

- Removes the start screen. The loader of the generated source then starts the program at once.

### `switch <name>`

- `body.switch` gives the switch after the write, with its `base`. See "Switches" of `<skill>/references/source-knowledge.md`.

### `unswitch <name>`

- The knowledge refuses a switch that has patches. Remove the patches with `unpatch` first.

### `patch <range> <switch>`

- The code is the bytes of the switch in the state that the base release does not have. When another release has these bytes, give `--from-release` with its label. See "Patches" of `<skill>/references/source-knowledge.md`.
- `body.patch` gives the patch after the write.

### `unpatch <start>`

- When patches of two switches start at the address, give the switch with `--switch`.

### `macro <name>`

- `body.macro` gives the macro after the write. See "Macros" of `<skill>/references/source-knowledge.md`.

### `unmacro <name>`

- The knowledge refuses a macro that has uses. Remove the uses with `unuse` first.

### `use <range> <macro>`

- `body.use` gives the use after the write. See "Macro uses" of `<skill>/references/source-knowledge.md`.

### `unuse <start>`

- Removes the macro use that starts at the address.

### `image <file>`

- `<file>` is the `image.json` of a capture, or a PRG. A PRG has the extension `.prg` or no extension. The script refuses a file with another extension.
- For drive code or a cartridge bank, give `--space drive8` or `--space bank0`.
- `body` holds `revision`, `bytes`, `rowsAdded`, `rowsClosed` and `entryChanged`.
- A new image replaces the program of the space. After the import, the project does not need the file of the capture.

### `coverage <map>...`

- `<map>` is a 64 KiB coverage map of a run, or a recording folder. For a recording folder, the script takes the coverage map of the recording.
- `body` holds `revision`, `imported`, `replaced`, `known`, `added` and `removed`. `imported` lists the new maps. `replaced` lists the new maps that replace an earlier map of the same path. `known` lists the maps that the space has already. `added` and `removed` count the ranges of accesses that the coverage gets and loses.
- When `added` or `removed` is not 0, do as `hint` tells.
- After you record a run again into the same place, put its map into the knowledge again. See "Maps and their paths" of `<skill>/references/coverage.md`.

### `apply <file>`

- `<file>` is a JSON list of writes. Give `-` to read the list from standard input. See "Writes of a batch" of `<skill>/references/batches.md`.
- `body` holds `revision`, `writes` and `replaced`. `replaced` lists each write that replaced a row of a different origin. Each item has the number of the `write`, its `op` and its `previous`.
- If the knowledge refuses one write, the script writes nothing, and the `error` names the write.

### `join <batch>...`

- `join` joins the batches of agents that name the program at the same time. See "Batches of parallel agents" of `<skill>/references/batches.md`.
- Without `--apply`, `join` writes no knowledge. `body` holds `writes`, `repeated` and `choices`. `writes` lists the joined writes. `choices` lists each place where the batches gave different values, with the value that stays.
- Examine `choices` and `writes`. `nextAction` is the same `join` with `--apply`. Run it when the choices agree with your task.
- With `--apply`, `join` writes the joined writes as one revision, or nothing when the knowledge refuses one write. Then `body` holds `revision`, `writes`, `replaced`, `repeated` and `choices`, as for `apply`.
- When one name or one module file is at two addresses, `join` writes nothing and gives the error `conflict`. Correct the batches that the `error` names. Then do `join` again.

### `revert <revision>`

- Makes the knowledge the same as at the revision. Without `--space`, all spaces revert. With `--space`, only that space reverts.
- `body` holds `revision`, `restores`, and `spaces: "all"` or `space`.
- A revert is a new revision. The history stays complete. A revert also gives back the coverage maps of that revision.

### `merge`

- Decides each conflict that a git merge left. Of the rows of one conflict, the newest row stays. All choices become one revision.
- `body.choices` lists each choice, with the `conflict`, the row that is `kept` and the rows that are `closed`. Tell the user the choices.

---

## Check the comments

A check measures how many comments are wrong. An agent that did not write the comments gives a verdict for each comment of a sample: `correct`, `wrong` or `unsure`. A check writes no knowledge.

### `sample`

- Starts a check. `body` holds `seed`, `revision`, `population` and `sampled`. `population` is the number of comments that the script selected from. `sampled` is the number of comments of the check.
- Keep the `seed`. It identifies the check. If the check of the seed has verdicts, the script refuses. Give another seed.

### `verdict <seed> <address> <verdict>`

- Records the verdict of one comment of the check. A new verdict of a comment replaces its earlier verdict.
- A `wrong` verdict needs `--class`, `--why`, and `--text` or `--name`. An `unsure` verdict needs `--why`. A `correct` verdict takes no `--class`, `--text` or `--name`.
- The script refuses an address that is not in the sample of the check.
- `body` holds `seed`, `verdict`, `checked` and `sampled`. `checked` is the number of comments that have a verdict.

### `checks [<seed>]`

- Without a seed, `body.checks` lists each check, newest first. Each item has `seed`, `createdAt`, `revision`, `sampled`, `checked`, `correct`, `wrong` and `unsure`.
- With a seed, `body` holds the same fields for that check, and `files` and `items`.
- `items` lists each comment of the sample with `address`, `placement` and `text`, and `name` when the address has a symbol. A comment with a verdict also has `verdict` and `why`. A `wrong` comment also has `class` and `correction`, with the correct `text` or `name`.
- `files.verdicts` is the file of the verdicts. Give it as `--evidence file:<file>` of each correction.

---

## Workflow

Read: run `at` with all addresses of the question. Run `history` when the current knowledge is surprising or disputed.

Write:

1. Read the current value with `at`. Keep the `revision` of the body.
2. Decide the change. Keep observed facts apart from your conclusions.
3. Write the change with `--reason`, and with `--expect-revision` set to the revision that you read. Give `--evidence` for each thing that the change rests on.
4. Read the body. If it has `previous`, tell the user.

Put the program into the knowledge:

1. For a packed program, capture the unpacked program into `.c64-re-tools/local/`. Then run `image` with its `image.json`.
2. For a program without a packer, drive code or a cartridge bank, run `image` with the PRG.
3. Run `coverage` with the coverage map of each run and with each recording folder.
4. Run `program` to see the segments, the entry and the coverage maps.

Write knowledge only after interpretation:

- a symbol name that tells what a routine or a variable does
- a region type or a reference that the evidence supports
- a comment that explains behavior that a name cannot show.

Do not write temporary investigation state, a guess only because a routine needs a temporary name, or confidence or status words in comment text.

For runtime evidence, examine the program in the emulator. For static evidence, analyze the machine code. To make the source from the knowledge, generate the source. To name the routines that other programs share, match the program against a routine library.

## JSON output

Each command prints one JSON envelope on one line on stdout. Notes go to stderr.

- On success, the exit code is 0: `{"ok": true, "command": "<command>", "body": {}, "hint": "...", "nextAction": "..."}`
- On failure, the exit code is 2: `{"ok": false, "command": "<command>", "code": "<code>", "error": "...", "hint": "...", "nextAction": "..."}`
- `body` holds the result. The section of each command gives the fields of its body.
- A check gives its verdict in `body.result`: `PASS`, `FAIL` or `INCONCLUSIVE`. The exit code is 0 for each verdict. Thus read `body.result`, not the exit code.
- `error` is one sentence. It tells what is wrong. `hint` tells what to do or what to examine. Read it before your next step.
- `nextAction` is a full command line. It runs from any directory. Run it when it agrees with your task.
- A list has `count`, `listed` and `rest`. `listed` holds at most `--max-listed` items. `rest` tells how to get the other items. A file that the command wrote has `out`, `bytes` and `sha256`.
- To get only some fields of `body`, give `--fields <path>,<path>`, for example `--fields count,listed.start`. A path through a list gives that field of each item. Do not write code to filter an envelope.
- To get the command list, run the script with no arguments. To get the subjects and the flags of one command, run `<command> --help`.

| `code` | Action |
|---|---|
| `installation-incomplete`, `machine-unavailable` | Stop the task. Give `error` and `hint` to the user and wait for the user. Do not install, start or change a tool. Do not make a replacement for the tool, for example your own disk parser, disassembler or emulator script. |
| `invalid-input`, `not-found` | Correct the call as `hint` tells. Then run the command again. |
| `operation-failed` | Give `error` and `hint` to the user. |
| Another code | Do as `hint` tells. |

## Reference

- `<skill>/references/source-knowledge.md`: the rules of the releases, the switches, the patches, the macros and the macro uses.
- `<skill>/references/start-screen.md`: how to record the start screen from a capture of the program or of a stage. It also gives the flags that correct a capture, and the rules of the VIC-II.
- `<skill>/references/batches.md`: the writes of a batch for `apply`, and the batches of parallel agents for `join`.
- `<skill>/references/coverage.md`: the coverage maps and their paths, the access at an address, and the reads that the program does not do.
