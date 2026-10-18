# Page types

Each page that you write is one of these types. Use the parts of a type that the program needs. Do not add a part with no content. Write each page by the rules in `style.md`.

## 1. The entry page

One entry page for the program: `README.md` in the project folder. A large subsystem can have an entry page of its own in `docs/`, for example `docs/rooms.md`. The entry page of the program has these parts, in this order:

1. **One paragraph.** What the program is, who made it and when, and which release the documentation is for. Under it, one line defines the evidence marks: **Observed**, **Code** and **Conclusion**.
2. **How the program works.** A short walk through the program in plain words, from the start to the main loop. Tell what the program does at each stage and why. Use one mermaid diagram of the layers and one of the flow of the player. Under the diagrams, a numbered list tells how the layers work together. Link only the entry of each layer, for example the cold start, the main loop and the interrupt. Use about 5 to 8 links in the full section.
3. **The pages.** A table with one row for each page: the link and one sentence about its content. The sentences have no links to the code.
4. **Findings.** The bugs and the facts that a reader does not expect. Write a bulleted list, not a table. Each item has a title in bold, one to three sentences, the evidence and a link to the page with the details.
5. **The development.** How the authors made the program, as the code and the leftovers tell it. Give a summary here. When the facts fill more than a screen, put them on a development page (section 6) and link it.
6. **Releases, cracks and preservation.** The known releases, what each crack changed, and what a preservation project must know. Give a summary here. When the facts fill more than a screen, put them on a releases page (section 7) and link it.
7. **The rebuild.** Which release is the base release, the program of the knowledge. Which changes of the release to the machine state stay, and how the loader sets them. A table of the switches from `knowledge.ts switches`: the name, the kind, the default and the releases that have the switch on. How to build the default program and each release. Which scenarios compare the original with the rebuild.
8. **Still open.** What is not known yet, and which run can find it.
9. **The reference.** One line with a link to `docs/reference/index.md`.

```markdown
# <Program>

<What the program is. The authors and the year. The release that this documentation is for.>

## How the program works

<Two or three short paragraphs: what happens from the start to the play, in the words of the program.>

~~~mermaid
flowchart TB
  A["Start: build the charsets"] --> B["Title screen"]
  B --> C["Play: one pass of the main loop"]
  ...
~~~

1. **The start runs one time.** [`cold_start` `$0400`](src/cold_start.asm#L22) builds ... (**Code**)
2. **The main loop sets the pace.** ...

## The pages

| Page | Content |
|---|---|
| [docs/main_loop.md](docs/main_loop.md) | **The main loop.** <one sentence> |

## Findings

- **<Title of the finding>.** <What happens, and why.> **Observed** in <run>. See [combat.md](docs/combat.md).

## The development

<Summary, or a link to docs/development.md.>

## Releases, cracks and preservation

<Summary, or a link to docs/releases.md.>

## The rebuild

...

## Still open

- <question> — <the run that can answer it>

## The reference

[docs/reference/index.md](docs/reference/index.md)
```

## 2. The workspace index

A workspace with several projects has one `README.md` at its root. It lists each program of the workspace. It has a title, one sentence and a table with one row for each program. Each row has a link to the entry page of the program and one sentence about the program.

```markdown
# C64 games

Reverse-engineered C64 games. Each game has its own folder with the original disk, the rebuilt source and the documentation.

| Game | |
|---|---|
| [Bruce Lee](bruce_lee/README.md) | Datasoft 1984. How the program works, from the cold start to the last room. |
```

## 3. The subsystem page

One page for each subsystem, for example the main loop, the interrupt chain, the room generation or the sound player. It has these parts:

1. **What it does.** One paragraph in the words of the program. Tell what the subsystem does for the player and why the program needs it. Do not list the routines.
2. **The conventions.** The terms of the page, for example "a pass is one run of the main loop". Use the conventions block of section 8.
3. **How it works.** A small mermaid flowchart, then the explanation in prose. Put a fact that a reader does not expect into the text where it belongs. The findings of the entry page link to it. Link the entry routine of the subsystem one time. For the main routine, give a numbered list of what it does and why, in the order of the code. Name a helper routine only when the reader needs it. Add pseudo-code when a loop or a condition is not clear from the list.
4. **The data.** Only the data that a reader needs to understand the subsystem. For each structure, give the layout: the bytes, the entries and the meaning of each byte. The reference lists every variable, so do not make a table of each variable.
5. **The state machine.** For code that changes from one state to another: a mermaid `stateDiagram-v2` and a transition table. The transition table has the state, the condition, the next state and the name of the code that makes the change, without a link.
6. **The worked example.** One real case decoded by hand from the image, byte by byte. For example the first bytes of the map of level 1, and the screen cells that they give.
7. **Still open.**

```markdown
## The state machine of <thing>

The slider waits until its timer is 0, then moves one step. [`update_slider` `$3F8C`](../src/sliders.asm#L40) makes each change.

~~~mermaid
stateDiagram-v2
  state "Waiting ($00)" as Wait
  state "Moving ($01)" as Move
  [*] --> Wait
  Wait --> Move: timer = 0
~~~

| State | Condition | Next state | Code |
|---|---|---|---|
| Waiting `$00` | `move_timer` = 0 | Moving `$01` | `update_slider` |
```

## 4. The entity sections

A program often has many items of one kind: levels, rooms, enemies, tunes. Give each item one section of the same form, in a page for a group of items. Each section has these parts:

1. **The description.** What the item is, in one paragraph. Embed the image of the item when an asset or the reference has one.
2. **The data.** The entries of the item in each table, with the values. Write the names without links.
3. **The setup.** What the init handler of the item does, in a few sentences. Link the handler one time.
4. **The behaviour.** What the frame handler of the item does: a state diagram and a transition table.
5. **The links to other items.** The conditions in other items that change this item, for example a door that opens when another room is empty.

End the group page with a table of the dependencies between the items.

## 5. The data-format page

One page for each format of data, for example a packed map, a music stream or a sprite format. It has these parts:

1. **Where the data is.** The table of pointers, the range of the data, and the routine that reads it. Link the routine one time.
2. **The byte layout.** A table of each byte or bit field, with its meaning. For a stream: each command byte, its arguments and what it does.
3. **The decoder.** Pseudo-code of the routine that reads the format.
4. **A worked example.** The first bytes of one item, decoded by hand.
5. **The assets.** A link to the extracted files and images, for example `../assets/rooms/room00.png`. Embed the image.

```markdown
| Byte | Meaning |
|---|---|
| `$80` | End of the stream. |
| `$81-$FF` | The next `b & $7F` bytes are cells. |
| `$01-$7F` | The next byte, `b` times. |
```

## 6. The development page

One page, `docs/development.md`, that tells how the authors made the program. The facts come from the code, the texts and the leftovers. Get the leftovers from `provenance.ts leftovers` of c64-provenance, or from the leftover spaces of the knowledge. Use the parts that the program has evidence for:

1. **The authors and the version.** The names, the dates and the version texts in the program, for example a credit line or "REV.2".
2. **The tools and the computer of the development.** The format of the source text in the leftovers, and the assembler. The computer that the authors used, for example an Apple II with a cross-assembler.
3. **Other versions of the program.** Traces of a version for another computer, for example key codes of the Atari 8-bit.
4. **Old versions in the image.** Old copies of code, tables, graphics or music. Tell what changed between the old copy and the version that runs.
5. **The original names.** Fragments of a symbol table or source text that give the names of the authors. Tell which names of the knowledge come from them.
6. **Unused and unfinished parts.** Code that nothing calls, texts and graphics that nothing shows, debug code and test code.
7. **What the development tells.** A short conclusion, marked **Conclusion**, for example the order in which the authors made the parts.

For each fact, give the evidence. A leftover in another space of the knowledge has no line in the source. Write its name without its address. Then give its space and its address, for example "`old_demo_input_stream` in bank3 at `$F300`".

## 7. The releases page

One page, `docs/releases.md`, for the releases of the program and the facts that a preservation project needs. Get the differences from `provenance.ts compare` of c64-provenance, and the crack stages from c64-unpacker. It has these parts:

1. **The known releases.** A table with one row for each release. A row gives the label, the disk image, the file, the group, the date and the SHA-256 of the file. The file is the file of the release, for example the PRG on the disk. Write "unknown" for a value that no source gives.
2. **The original.** Which release is nearest to the original program, and the evidence. Tell what is missing, for example the original loader or a release without a crack.
3. **The cracks.** For each crack: the intro, the mover, the relocator, the packer, a trainer and the texts that it changed. Tell how the crack removed the copy protection.
4. **The copy protection.** The original protection, and the parts of it that each release still has.
5. **Traces of other people.** A release made from another crack, a memory dump of a program that ran, or tools on the disk.
6. **The differences.** A table of the bytes where the releases differ, what each difference does, and the switch that gives it in the rebuild.

## 8. The conventions block

Put this block near the top of each subsystem page. Change the terms for the program.

```markdown
**Conventions.**
- Addresses are C64 addresses. Names are the names of the knowledge.
- A *pass* is one run of the main loop. A *frame* is one raster interrupt.
- **Observed** marks a fact that a run showed. **Code** marks a fact from the code only. **Conclusion** marks an interpretation.
```
