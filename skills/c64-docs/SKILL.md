---
name: c64-docs
description: Use this skill to write the documentation of a C64 program. The documentation explains the flows, state machines, tables, data formats and graphics, with links to the source lines and to the assets. The script generates the reference pages from the knowledge and the source. You write the other pages by the method of this skill. A second command of the script adds the links to each name and address and checks every link. Use it after the source is identical, or to keep the documentation correct after a change to the knowledge.
---

# c64-docs

## Purpose

Write documentation that tells how a program works, and that points to the code. The documentation is Markdown in the project. The entry page is `README.md` in the project folder. The other pages and the reference are in `docs/`. The documentation has two parts:

- **The reference.** `docs.ts generate` generates it from the knowledge, the source map of c64-source and the image. It has a page for each module. The page gives the routines, their callers and callees, the data and a call graph. It also has pages for the names, the variables, the tables, the memory map and the graphics. Do not edit these pages. The next run writes over them.
- **The pages that you write.** They tell how the program works. They give the flows, the state machines, the data formats and the task of each part. Use the page types in `references/page-types.md` and the rules in `references/style.md`.

`docs.ts link` connects the two parts. In each page that you write, a name in backticks gets a link to its line in the source. The address after the name gets a link to the entry of the name in the reference. When the source changes, `docs.ts link` moves the links to the new lines.

This skill does not change the knowledge.

## Inputs

- The source directory of c64-source, with its `source-map.json`, for example `src`. The source must be from the current knowledge revision.
- The program in the knowledge. Put it in with `image` of the c64-knowledge skill. The reference decodes the tables and shows the graphics from it.
- The entry page `README.md` and the directory of the other pages, for example `docs`. The reference goes into a directory of its own, for example `docs/reference`.

## Tools / execution path

The script runs on this machine. It does not use the emulator or the host runtime.

```
node <skill>/scripts/docs.ts generate src --out docs/reference
node <skill>/scripts/docs.ts link README.md docs --source src
node <skill>/scripts/docs.ts link README.md docs --source src --check
```

| Option | Meaning |
|---|---|
| `src` | `docs.ts generate`: the source directory of c64-source. The command reads `src/source-map.json`. |
| `--source src` | `docs.ts link`: the source directory of c64-source. The command reads `src/source-map.json`. |
| `--out docs/reference` | The directory of the reference. `docs.ts generate` writes only there. It refuses to start when the directory holds a page that it did not write. |
| `README.md docs` | The pages of the documentation: `.md` files and directories. `docs.ts link` reads each file and every `.md` file below each directory. It changes only the pages that you wrote. It checks the pages of the reference. |
| `--reference <dir>` | The directory of the reference for `docs.ts link`. The default is the `reference` directory of the first directory that has one, for example `docs/reference`. |
| `--check` | `docs.ts link` writes nothing. `result` is `FAIL` when a link is not up to date or a page has a problem. |
| `--max-listed 20` | List at most this number of items in each list. The default is 50. |

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
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

1. Read the knowledge with the c64-knowledge skill. The documentation can only be as good as the knowledge. Each routine needs a name and a comment. Each table needs a region and a name. Each file of the source needs a module with a title. Record what is missing with c64-knowledge.
2. Generate the source with c64-source. Make sure that `check.identical` is `true`. The script also writes `source-map.json`.
3. Run `docs.ts generate`. Read `index.md` of the reference. A module with no routines, or a routine with no comment, shows what the knowledge does not have yet.
4. Make the plan of the pages. Start from the modules and the call graphs. Find the main loop, the interrupt chain, the dispatch tables, the state machines and the data formats. Each subsystem gets one page in `docs/`. The entry page `README.md` in the project folder lists the pages. Use the page types in `references/page-types.md`.
5. Write each page. Read the code and the knowledge for each fact. Run the program with c64-testing or c64-emulator when a fact needs a run. Write each name with its address, for example `` `draw_room` `$09BC` ``. Mark each fact with its evidence. Several subagents can write the pages at the same time, one page each. Give each subagent `references/page-types.md` and `references/style.md`.
6. Record each new fact in the knowledge first: a name, a comment, a region or a module. Then the source and the reference show it too. A fact only in a page is lost at the next change of the knowledge.
7. Run `docs.ts link`. Read `problems` and correct each one. Then run `docs.ts link --check`. Make sure that `result` is `PASS`.
8. When the project folder is in a workspace with other projects, find `README.md` at the root of the workspace. This page lists each program of the workspace. Add one row for the program, with a link to `<project>/README.md` and one sentence. If the page does not exist, make it. Use the workspace index in `references/page-types.md`. `docs.ts link` does not read this page, because the page is not in the project folder.
9. After each change to the knowledge, do steps 2, 3 and 7 again. The links then go to the new lines.

## The links

`docs.ts link` changes these forms in the pages that you write. It does not change a code block, a mermaid diagram or an HTML comment. The examples are for a page in `docs/`. In `README.md`, the links start with `src/` and `docs/reference/`.

| You write | `docs.ts link` writes |
|---|---|
| `` `draw_room` `$09BC` `` | `` [`draw_room`](../src/room_draw.asm#L6) [`$09BC`](reference/modules/room_draw.md#draw_room) `` |
| `` `draw_room` (`$09BC`) `` | the same links, in the brackets |
| `` `draw_room` `$0AAF` `` | `$0AAF` is a place inside `draw_room`. The address gets a link to its line in the source. |
| `` `room_script_vars+3` `$4E9A` `` | a name with an offset. The address must be the address of the name plus the offset. |
| `` `draw_room` `` | the name gets a link to its line. |

- A name is a name of the knowledge or of the source. A word in backticks that is no name stays as it is.
- In a list such as `` `a`/`b` `$1000`/`$1010` ``, each name gets its link. The addresses stay as they are.
- `docs.ts link` writes a link again when its line moves. A link that you made to another target stays as you wrote it.
- `docs.ts link` checks every link and image: the file must exist, a `#anchor` must exist in the page, and a `#L` line must exist in the file.

## The reference

- `index.md`: each file of the source with its range, title, the number of routines and the number of names.
- `modules/<file>.md`: a call graph of the file, its data regions with their readers and writers, and an entry for each name. An entry has the comment, the callers, the table that holds it, and for a routine its calls, jumps, reads and writes.
- `variables.md`: each name outside the image, with the routines that read it and write it.
- `tables.md`: each table of addresses, jumps and words, entry by entry, with its target. An RTS table holds each target minus 1. The table gives the target.
- `memory-map.md`: each region in address order.
- `symbols.md`: each name in alphabetical order.
- `graphics.md`: each `sprite`, `bitmap`, `charset` and `screen` region. A sprite, a bitmap or a charset shows in hires and in multicolour, because the knowledge has no graphics mode. A charset shows 16 characters in each row. A screen shows as text.

### Images and assets

- The reference draws each sprite, bitmap and charset region, and it decodes each table. To get the image of a graphic or the entries of a table, classify its region with c64-knowledge. Do not write a script that draws or decodes them.
- A script of the project decodes only a format of the program, for example a packed map or a music stream. Put the script in `tools/` of the project. Its output files are the assets, for example in `assets/rooms/`.
- When the code of the program makes the data, run that code in VICE with a run of c64-testing. Observe the memory, or capture the screen. Do not write a 6502 emulator in the script.

In the call graph, a solid arrow is a call, a thick arrow is a table entry, and a dotted arrow is a jump. A table entry goes from each routine that reads the table to each target in code. A table of data addresses gives no arrow.

## Knowledge

Read:
- symbols, regions, comments, references and modules of the space of the source.

Automatic write:
- none.

Do not store:
- the pages, or the facts that are only in the pages. Record each fact with c64-knowledge.

## Result

`docs.ts generate`:

- `out`, `index` and `revision`.
- `pages`, `entries`, `tables`, `images` and `edges`: the counts of the reference.
- `files`: the pages that it wrote, each with `out`, `bytes` and `sha256`.
- `program`: `the knowledge`, or a note when the knowledge has no program. Without the program, the tables are not decoded and the graphics page has no images.

`docs.ts link`:

- `result`: `PASS` when no page has a problem. `FAIL` when a page has a problem, or with `--check` when a link is not up to date.
- `pages`: the count of the pages that it read.
- `reference`: the directory of the reference, or a note when there is no reference.
- `linked`: the count of the links that it wrote (`links`), and the pages that it changed. With `--check`, `notUpToDate` gives the links that are not up to date.
- `problems`: `byKind` and the list of problems. Each problem has `at` (the page and the line), `kind` and `message`.

## Failure and conflicts

- `not-found` for `source-map.json`: generate the source with c64-source. Then run the script again.
- `invalid-input` that names an old revision: the knowledge changed after the source. Generate the source again, then run `docs.ts generate`.
- `invalid-input` that names a page in the reference directory: the page is not a page of `docs.ts generate`. Move the page out of the directory. Do not give `--out` a directory with pages that you wrote.
- `unknown-name`: the page uses a name that is not in the knowledge. Record the name with c64-knowledge, or correct the page.
- `wrong-address`: the address after the name is not the address of the name, and it is not a place inside it. The message gives the routine that holds the address. Correct the name or the address. For a value, write `` `scroll_moves` = `$10` ``. The script does not link such a mention until it is correct.
- `missing-file`, `missing-anchor` or `missing-line`: a link goes to nothing. Correct the link. An image of an asset must exist in the project.
- `stale-reference`: the source or the reference is older than the knowledge. Do steps 2 and 3 of the workflow again.
- `conflict`: the knowledge has conflicts from a git merge. Run `knowledge.ts merge` of c64-knowledge.

## Handoffs

- Names, comments, regions and modules → c64-knowledge
- The source and its source map → c64-source
- A fact that needs a run → c64-testing or c64-emulator
- What an address of the C64 is → c64-memory-map
