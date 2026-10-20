# Page types

Each page that you write is one of these types. Use the parts of a type that the program needs. Do not add a part with no content. Write each page by the rules in `<skill>/references/style.md`. The section "Workflow" of `<skill>/SKILL.md` gives the steps to plan and write the pages.

## 1. The entry page

One entry page for the program: `README.md` in the project folder. A large subsystem can have an entry page of its own in `docs/`, for example `docs/rooms.md`.

The most interesting parts for a reader are the development of the program and its copy protection. Put them first, and explain them in depth. The entry page of the program has these parts, in this order:

1. **One paragraph.** What the program is, who made it and when, and which release the documentation is for. Under it, one line defines the evidence marks: **Observed**, **Code** and **Conclusion**.
2. **The development.** How the authors made the program, as the code and the leftovers tell it. Explain each trace in depth: what the bytes are, how you identified them, and what they tell about the work of the authors. Use as many paragraphs as the traces need. Link the development page (section 6) for the full details.
3. **The copy protection.** How the original protection works, in depth. Tell what the loader left in memory, and explain each check and where the program hides it. Tell what happens when a check fails, and how the rebuild turns it off. Link the copy protection page (section 7) for the full details.
4. **Findings.** The bugs and the facts that a reader does not expect. Write a bulleted list, not a table. Each item has a title in bold, the facts and the evidence. It also has a link to the page with the details. Then tell what the finding means in practice. Examples are what a player sees, what a test or a fix can use, and what a preservation project must know. Mark an idea that no run showed as **Conclusion**.
5. **How the program works.** A short walk through the program, from the start to the main loop. Tell what the program does at each stage and why. Use one mermaid diagram of the layers and one of the flow of the player. Under the diagrams, a numbered list tells how the layers work together. Link only the entry of each layer, for example the cold start, the main loop and the interrupt. Use about 5 to 8 links in the full section.
6. **The pages.** A table with one row for each page: the link and one sentence about its content. The sentences have no links to the code.
7. **The releases.** A short section. A small table gives each known release: the label, the file and the SHA-256 of the file. Then one line for each crack tells what it adds around the program, and the bytes of the program that it changed. Do not describe the intro, the mover or the relocator of a crack in detail. They are not part of the program.
8. **The rebuild.** Which release is the base release, the program of the knowledge. Which changes of the release to the machine state stay, and how the loader sets them. A table of the switches of the project knowledge: the name, the kind, the default and the releases that have the switch on. How to build the default program and each release. Which scenarios compare the original with the rebuild.
9. **Still open.** What is not known yet, and which run can find it.
10. **The reference.** One line with a link to `docs/reference/index.md`.

Look for findings of these kinds. They are often the most useful to a reader:

- A table or a variable that the program fills and never reads, or reads before it fills.
- A source of random numbers that is not random, for example a routine that reads memory with fixed contents. A test can use it to make a run repeat.
- Code that depends on bytes that a loader or a crack left in memory.
- A bug that a player can see, and the conditions that cause it.
- Data that is bigger than its space, and the bytes that it writes over.

```markdown
# <Program>

<What the program is. The authors and the year. The release that this documentation is for.>

**Evidence.** **Observed** marks a fact that a run showed. **Code** marks a fact from the code only. **Conclusion** marks an interpretation.

## The development

<Several paragraphs: each trace, what it is, how you know, and what it tells.> The details are on [docs/development.md](docs/development.md).

## The copy protection

<Several paragraphs: the marks of the loader, each check, and what a failed check does.> The details are on [docs/protection.md](docs/protection.md).

## Findings

- **<Title of the finding>.** <What happens, and why.> **Observed** in <run>. <What it means in practice, for example: a test can use it to make a run repeat (**Conclusion**).> See [combat.md](docs/combat.md).

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

## The releases

<A small table of the releases, and one line for each crack.>

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

## 2b. The group entry page

A program with two or more versions in a group folder has one `README.md` in the group folder. It tells the parts of the program that the versions share. Each version has its own entry page in its project folder. The group entry page has these parts, in this order:

1. **One paragraph.** What the program is, who made it and when, and which versions the documentation is for. Under it, one line defines the evidence marks.
2. **The versions.** A table with one row for each version: the link to its entry page, the releases of the version, and its entry address. Under the table, tell how the versions are different and why the versions need a project each.
3. **The development**, **The copy protection** and **Findings**, as in the entry page of section 1, for the facts that the versions share. Write the label of the version before each name, for example `` `v1:speech_irq` `$29C8` ``.
4. **The pages.** A table of the shared pages in `docs/`, for example the development, the changes between the versions, the releases and the disk layout.
5. **Still open.**

Each fact goes in one place. A fact of all versions goes in the group entry page or a shared page. A fact of one version goes in the pages of that version.

```markdown
# <Program>

<What the program is. The authors and the year. The versions that this documentation is for.>

**Evidence.** **Observed** marks a fact that a run showed. **Code** marks a fact from the code only. **Conclusion** marks an interpretation.

## The versions

| Version | Releases | Entry |
|---|---|---|
| [v1](v1/README.md) | <release> | `$1158` |
| [v2](v2/README.md) | <base release>, <release> | `$115A` |

<How the versions are different: the moved code and data, with the labelled names.> The details are on [docs/versions.md](docs/versions.md).

## The development

...

## The pages

| Page | Content |
|---|---|
| [docs/development.md](docs/development.md) | **The development.** <one sentence> |

## Still open

- <question> — <the run that can answer it>
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

One page, `docs/development.md`, that tells how the authors made the program. The facts come from the code, the texts and the leftovers. Get the leftovers from the leftover spaces of the project knowledge. If the knowledge has none, find the leftovers of the development in the program. This page is one of the most interesting pages for a reader. Explain each trace in depth: what the bytes are, how you identified them, and what they tell. Compare an old copy with the version that runs, byte by byte when it helps. Use the parts that the program has evidence for:

1. **The authors and the version.** The names, the dates and the version texts in the program, for example a credit line or "REV.2".
2. **The tools and the computer of the development.** The format of the source text in the leftovers, and the assembler. The computer that the authors used, for example an Apple II with a cross-assembler.
3. **Other versions of the program.** Traces of a version for another computer, for example key codes of the Atari 8-bit.
4. **Old versions in the image.** Old copies of code, tables, graphics or music. Tell what changed between the old copy and the version that runs.
5. **The original names.** Fragments of a symbol table or source text that give the names of the authors. Tell which names of the knowledge come from them.
6. **Unused and unfinished parts.** Code that nothing calls, texts and graphics that nothing shows, debug code and test code. Tell what each part did, or was to do.
7. **What the development tells.** A short conclusion, marked **Conclusion**, for example the order in which the authors made the parts.

For each fact, give the evidence. A leftover in another space of the knowledge has no line in the source. Write its name without its address. Then give its space and its address, for example "`old_demo_input_stream` in bank3 at `$F300`".

## 7. The copy protection page

One page, `docs/protection.md`, that explains the copy protection of the program in depth. This page is one of the most interesting pages for a reader. It has these parts:

1. **The scheme.** How the original protection works as a whole. Tell about the disk or the loader, and the marks that the loader leaves in memory. Tell which keys the program compares.
2. **Each check.** For each check, tell where it is and when it runs. Tell what it compares, and how the program hides it. Link the code of the check one time. Use a table for a summary of the checks, without links.
3. **The effect of a failed check.** What the program does when a check fails. Examples are a crash at once, a slow change of code, damaged data and a wipe of memory. Tell how long the effect takes to show.
4. **The releases.** In one or two sentences: which checks still run in each release.
5. **The rebuild.** The switch that turns the protection off, the bytes that it changes, and the scenarios that show that the program runs without it.
6. **Still open.** The checks that no run reached, and the run that can reach them.

## 8. The conventions block

Put this block near the top of each subsystem page. Change the terms for the program.

```markdown
**Conventions.**
- Addresses are C64 addresses. Names are the names of the knowledge.
- A *pass* is one run of the main loop. A *frame* is one raster interrupt.
- **Observed** marks a fact that a run showed. **Code** marks a fact from the code only. **Conclusion** marks an interpretation.
```
