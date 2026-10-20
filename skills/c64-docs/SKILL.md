---
name: c64-docs
description: Writes the documentation of a C64 program. You write the pages by the method of this skill. The script generates the reference pages from the project knowledge and the generated source. The pages put first the development of the program and its copy protection, in depth, with the findings and what each one means in practice. They explain how the program works, with links to the main parts of the source, and they list the releases in short. They tell the history of a crack only when the crack left traces in the program. Use it to document a program after its rebuilt source is identical to the original. Use it to keep the documentation correct after a change to the project knowledge. It does not change the project knowledge, and it does not run the program.
---

# C64 documentation

Use this script to generate the reference pages of a program, and to link the pages that you write to the source.
Use only the commands of the script. Do not generate the reference or write the links to the source in another way.

```bash
node <skill>/scripts/docs.ts <command>
```

`<skill>` is the base directory of this skill. Run the script with `node`. You can run it from any directory.
Each command in this skill, for example `generate src --out docs/reference`, goes in the place of `<command>`.
Each command prints one JSON envelope on stdout. See the section "JSON output".
To get the command list, run the script with no arguments.

---

## Select the command

| Goal | Command |
|---|---|
| Generate the reference pages from the project knowledge and the source | `generate src --out docs/reference` |
| Link the names in the pages to the source, and check each link and image | `link README.md docs --source src` |
| Check that each link is up to date, and write nothing | `link README.md docs --source src --check` |
| Link the pages when the reference is in a folder with another name | `link README.md docs --source src --reference docs/lookup` |
| Link one page | `link docs/main_loop.md --source src` |
| In a group folder, link the shared pages and the pages of each project | `link README.md docs v1/README.md v1/docs v2/README.md v2/docs --source src` |

---

## The documentation and the source

The documentation is Markdown in the project. It has two parts:

- **The pages that you write.** The entry page is `README.md` in the project folder. The other pages are in `docs/`. They explain how the program works: the flows, the state machines, the data formats and the task of each part. Use the page types in `<skill>/references/page-types.md` and the rules in `<skill>/references/style.md`.
- **The reference.** `generate` writes it into a folder of its own, for example `docs/reference`. It is the lookup for each routine, table and variable. Do not edit these pages. The next `generate` writes over them.

Get the values for the commands from these places:

- `<source-dir>` and `--source`: the folder of the source that you generated from the project knowledge, for example `src`. It must hold `source-map.json`. The source must be from the current revision of the project knowledge.
- `--out`: a folder that holds only the reference, for example `docs/reference`. Keep the pages that you write outside it.
- `<page>`: the entry page `README.md` and the folder of the other pages, for example `docs`.
- The program bytes: put them into the project knowledge before `generate`. Then the reference decodes the tables and shows the graphics.

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
- When a file is the evidence for a finding in the project knowledge, move it out of `.c64-re-tools/local/` first. The project knowledge refuses evidence in that folder.
- Do not move a coverage map after you put it into the project knowledge. The knowledge refers to the map by its path at that time.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and its snapshot files. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

### The group folder

A group folder holds one project for each version of a program. It also holds the pages that the versions share.

- A group folder is a folder in a git repository. It holds one or more project folders. It is not a project, and it is not in a project.
- Each project folder in the group folder is a project of the group. The label of the project is the name of its folder, for example `v1`. A project folder that holds `.git` is not a project of the group.
- The shared pages are `README.md` and `docs/` of the group folder.
- A page in the group folder can link to each file in the group folder. A link out of the group folder is a problem.
- Give each project the same folder for the source and the same folder for the reference, for example `src` and `docs/reference`. `--source` and `--reference` apply to each project.
- To link the shared pages, run `link` in the group folder. Give the pages relative to the group folder. From a different folder, give `--project <group folder>`.

---

## Flags

Each flag applies only to the commands in the table. On another command, the script refuses the flag.

| Flag | Command | Effect |
|---|---|---|
| `--out <dir>` | `generate` | Required. The folder of the reference, relative to the project folder. `generate` writes only there. It refuses to start when the folder holds a page that it did not write. |
| `--source <dir>` | `link` | Required. The folder of the generated source, with its `source-map.json`, relative to the project folder. In a group folder, each project has its source in this folder. |
| `--reference <dir>` | `link` | The folder of the reference, relative to the project folder. In a group folder, each project has its reference in this folder. The default is the first `reference` folder in a given folder or beside a given page, for example `docs/reference`. |
| `--check` | `link` | Write nothing. `result` is `FAIL` when a link is not up to date or a page has a problem. Off by default. |
| `--max-listed <n>` | `generate`, `link` | List at most `n` items in each list. The default is 50. The count is always in the body. |

---

## Generate the reference

### `generate <source-dir>`

Writes the reference pages from the project knowledge, the source map and the program bytes in the project knowledge. Before it writes, it removes the pages of an earlier run in `--out`.

`body` holds:

- `out`: the folder of the reference. `index`: the path of `index.md`. `revision`: the revision of the project knowledge.
- `pages`, `entries`, `tables`, `images` and `edges`: the counts of the reference.
- `files`: the pages and images that it wrote, each with `out`, `bytes` and `sha256`.
- `program`: `the knowledge`, or `none` when the project knowledge has no program bytes. Without them, the tables are not decoded, and the graphics page has no images.

`hint` and `nextAction`:

- `hint` tells you to write the pages. `nextAction` is the `link` command for `README.md` and the folder above `--out`. Run it after you write the pages.
- When `program` is `none`, `hint` tells you to put the program bytes into the project knowledge. Then run `generate` again.

The reference has these pages:

- `index.md`: each file of the source, with its range, its title, the count of routines and the count of names.
- `modules/<file>.md`: a call graph of the file, its data regions with their readers and writers, and an entry for each name. An entry has the comment, the callers and the table that holds the name. For a routine, it also has the calls, the jumps, the reads and the writes.
- `tables.md`: each table of addresses, jumps and words, entry by entry, with its target. An RTS table holds each target minus 1. The page gives the target.
- `memory-map.md`: each region in address order. Then each variable outside the program, with its comment and the routines that read it and write it.
- `graphics.md`: each `sprite`, `bitmap`, `charset` and `screen` region. The project knowledge has no graphics mode. Thus a sprite, a bitmap or a charset shows in hires and in multicolour. A charset shows 16 characters in each row. A screen shows as text.

In a call graph, a solid arrow is a call, a thick arrow is a table entry, and a dotted arrow is a jump. A table entry goes from each routine that reads the table to each target in code. A table of data addresses gives no arrow.

Errors and their actions:

- `not-found` for `source-map.json` or for the source folder: generate the source from the project knowledge. Then run `generate` again.
- `invalid-input` that names an old revision: the project knowledge changed after you generated the source. Generate the source again, then run `generate` again.
- `invalid-input` that names a page in `--out`: `generate` did not write that page. Move the page out of the folder.
- `conflict`: the project knowledge has conflicts from a git merge. Resolve the merge conflicts of the project knowledge. Then generate the source again, and run `generate` again.

### Images and assets

- The reference draws each sprite, bitmap and charset region, and it decodes each table. To get the image of a graphic or the entries of a table, classify its region in the project knowledge. Do not write a script that draws or decodes them.
- A script of the project decodes only a format of the program, for example a packed map or a music stream. Put the script in `tools/` of the project. Its output files are the assets, for example in `assets/rooms/`.
- When two or more projects of a group folder use the script, put it in `tools/` of the group folder. The script takes the paths of its input and output files as arguments.
- When the code of the program makes the data, run that code in a test run. Read the memory, or capture the screen. Do not write a 6502 emulator in the script.

---

## Link the pages

### `link <page>...`

Reads each `.md` file that you give, and each `.md` file below each folder that you give. It writes the links in the pages that you wrote. It only checks the pages of the reference. It does not change a code block, a mermaid diagram or an HTML comment.

These are the forms that it changes. The examples are for a page in `docs/`. In `README.md`, the links start with `src/`.

| You write | `link` writes |
|---|---|
| `` `draw_room` `$09BC` `` | `` [`draw_room` `$09BC`](../src/room_draw.asm#L6) ``: one link to the line of the name. |
| `` `draw_room` `$0AAF` `` | `$0AAF` is a place inside `draw_room`. The link goes to the line of `$0AAF`. |
| `` `room_script_vars+3` `$4E9A` `` | A name with an offset. The address must be the address of the name plus the offset. The link goes to the line of `$4E9A`. |
| `` `draw_room` `` | No link. |
| `` `scroll_moves` = `$10` `` | No link. The value is not an address. |

- A name is a name of the project knowledge or of the source. A word in backticks that is not a name stays as it is.
- A name gets one link in each section. A section starts at a heading.
- A table gets no links.
- When the line of a name moves, `link` writes the link again. A link that you made to another target stays as you wrote it.
- `link` checks each link and image. The file must exist. A `#anchor` must exist in the page. A `#L` line must exist in the file.

In a group folder, a label names the project of a name. Write the label and a colon before the name. The label stays in the text. The examples are for `README.md` of the group folder.

| You write | `link` writes |
|---|---|
| `` `v1:draw_room` `$09BC` `` | `` [`v1:draw_room` `$09BC`](v1/src/room_draw.asm#L6) ``: one link to the line of the name in the source of `v1`. |
| `` `draw_room` `$09BC` `` | No link. In a shared page, each name needs a label. |

- In a page of a project, a name without a label is a name of that project. To link a name of a different project of the group, write its label, for example `` `v2:draw_room` `$0A10` ``.
- When the line of a name moves in the different project, `link` writes the link again. Thus link to the source of a different project only with a label. `link` does not move a `#L` link that you wrote.
- `` `v1:draw_room` `` and `` `v2:draw_room` `` are two names. Each can get one link in a section.

`body` holds:

- `result`: `PASS` when no page has a problem. `FAIL` when a page has a problem, or with `--check` when a link is not up to date.
- `pages`: the count of the pages that it read.
- `reference`: the folder of the reference, or `none`.
- `linked`: `links`, the count of the links that it wrote, and `pages`, the pages that it changed. With `--check`, `notUpToDate` has the same fields for the links that are not up to date.
- `problems`: `byKind`, `count`, `listed` and `rest`. Each item has `at` (the page and the line), `kind` and `message`. In a group folder, each item also has `project`: the label of the project of the page, or `shared`.
- `group`: only in a group folder. `folder` is the group folder, relative to the folder of the pages. `projects` holds the labels.

`hint` and `nextAction`:

- A page has a problem: `hint` tells you to correct each problem. `nextAction` runs the same `link` command again.
- With `--check`, a link is not up to date and no page has a problem: `nextAction` runs `link` without `--check` to write the links.
- `reference` is `none`: no `reference` folder is in or beside the given pages. Give `--reference <dir>`, or run `generate` first.

Do this for each `kind` of problem:

| `kind` | Action |
|---|---|
| `unknown-name` | The page gives an address after a name that the project knowledge does not have. Record the name in the project knowledge, or correct the page. |
| `wrong-address` | The address is not the address of the name, and it is not a place inside the name. `message` gives the routine that holds the address. Correct the name or the address. For a value, write `` `scroll_moves` = `$10` ``. `link` does not link the mention until it is correct. |
| `repeated-link` | The name has a link in the section already. Remove the address from this mention. |
| `link-in-table` | A name with its address is in a table row. Remove the address in the table. Link the name in the text above the table. |
| `missing-file`, `missing-anchor`, `missing-line` | The link goes to nothing. Correct the link. An image of an asset must exist in the project. |
| `outside-project` | The link goes out of the project folder, and the project is not in a group folder. Correct the link. |
| `outside-group` | The link goes out of the group folder. Correct the link. |
| `unknown-label` | No project of the group folder has the label. `message` gives the labels. Correct the label. |
| `unlabelled-name` | A shared page gives a name and its address without a label. Write the label of the project before the name. |
| `stale-reference` | The source or the reference is older than the project knowledge. `message` names the project. Do steps 2 and 3 of the workflow again for that project. |

Errors:

- `not-found` names a page or a folder that is not in the project folder or the group folder. `invalid-input` names a file that is not a `.md` file, or a folder that goes out through a symbolic link. Correct the paths.
- `not-found` that starts with `In the project <label>`: that project has no source map in `--source`. Generate the source of that project. Then run `link` again.

---

## Workflow

1. Read the project knowledge. The documentation can only be as good as the knowledge. Each routine needs a name and a comment. Each table needs a region and a name. Each file of the source needs a module with a title. Record what is missing in the project knowledge.
2. Generate the source from the project knowledge. Make sure that the check of the source gives identical bytes. This also writes `source-map.json`.
3. Run `generate`. Read `index.md` of the reference. A module with no routines, or a routine with no comment, shows what the knowledge does not have yet.
4. Make the plan of the pages. Start from the modules and the call graphs. Find the main loop, the interrupt chain, the dispatch tables, the state machines and the data formats. Each subsystem gets one page in `docs/`. The entry page `README.md` lists the pages. Use the page types in `<skill>/references/page-types.md`.
5. Collect the facts about the development and the copy protection. These facts are the most interesting parts for a reader, so look for them carefully.
   - Read the leftover spaces and their comments in the project knowledge. If the knowledge has none, find the leftovers of the development in the program.
   - For two or more releases, compare the releases. Then you can separate the program from the changes of each release.
   - Find each check of the copy protection in the code, and the effect of a failed check.
   - Find the traces of each crack in the program. The bytes that the compare of the releases shows are the start. Examples are a check that the crack changed, a group text in the program, and bytes in memory that the program now uses.
   - Do not examine the intro, the mover or the relocator of a crack. They are not part of the program.
6. Write each page. Read the code and the knowledge for each fact. When a fact needs a run, run the program in a test run or in the emulator. Explain each part before you name the code. Link only the main parts. Mark each fact with its evidence. Several subagents can write the pages at the same time, one page each. Give each subagent `<skill>/references/page-types.md` and `<skill>/references/style.md`.
7. Record each new fact in the project knowledge first: a name, a comment, a region or a module. Then the source and the reference show it too. A fact that is only in a page is lost at the next change of the knowledge.
8. Run `link`. Correct each problem. Then run `link` with `--check`. Make sure that `result` is `PASS`.
9. When the project folder is in a workspace with other projects, find `README.md` at the root of the workspace. This page lists each program of the workspace. Add one row for the program, with a link to `<project>/README.md` and one sentence. If the page does not exist, make it. Use the workspace index in `<skill>/references/page-types.md`. When the workspace folder is a group folder, run `link README.md --source src` in it to check the links of this page. Else `link` does not read this page.
9b. When the program has two or more versions in a group folder, write the shared pages in the group folder. Use the group entry page in `<skill>/references/page-types.md`.
   - Write the development, the differences between the versions, the releases and the disk layout one time, in the shared pages.
   - The pages of each project tell only how its version works.
   - In a shared page, write the label of the project before each name.
   - Run `link` in the group folder for the shared pages and the pages of each project.
10. After each change to the project knowledge, do steps 2, 3 and 8 again. Then the links go to the new lines.

Do not keep the pages, or the facts that are only in the pages, in the project knowledge.

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

---

## Reference

- `<skill>/references/page-types.md`: the page types, with the parts of each type and a template. The types are the entry page, the workspace index, the group entry page, the subsystem page and the entity sections. Other types are the data-format page, the development page and the copy protection page. It also has the conventions block.
- `<skill>/references/style.md`: the rules for the text of the pages. They tell how to explain, and how to write the names and the links. They also give the evidence marks, the diagrams and the images.
