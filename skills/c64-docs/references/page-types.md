# Page types

Each page that you write is one of these types. The types come from the documentation of the Bruce Lee field run. Use the parts of a type that the program needs. Do not add a part with no content.

## 1. The entry page

One entry page for the program: `README.md` in the project folder. A large subsystem can have an entry page of its own in `docs/`, for example `docs/rooms.md`. The entry page of the program has these parts, in this order:

1. **One paragraph.** What the program is, and which release the documentation is for.
2. **The table of pages.** One row for each page, with the link and one sentence about its content.
3. **The layers.** A mermaid diagram of the layers of the program. The layers are the data, the code that runs one time, the main loop and the interrupts. Under the diagram, a numbered list tells how the layers work together.
4. **The flow of a user.** A mermaid diagram of the steps of the player or user from start to end. An example is the order of the levels.
5. **Findings.** A table of the facts that a reader does not expect, each with its evidence. Put a bug of the original program here.
6. **The reference.** A link to `docs/reference/index.md`.
7. **Still open.** What is not known yet, and which run can find it.
8. **The release and the rebuild.** What the release holds, for example a crack with a cracktro and a mover. Which part is the clean program of the knowledge. Which changes of the release to the machine state stay, and how the loader sets them. How the source assembles to the clean program, and which scenarios compare the original with the rebuild.

```markdown
# <Program>: <subject>

<What the program is. The release. What this documentation covers.>

| Page | Content |
|---|---|
| [parts/main_loop.md](docs/parts/main_loop.md) | **The main loop.** <one sentence> |

## 1. The layers

~~~mermaid
flowchart TB
  subgraph DATA["Data"]
  ...
~~~

## 2. The flow of a player

...

## 3. Findings

| Finding | Evidence |
|---|---|
| <fact> | Observed: <what run showed it> |

## 4. The reference

[docs/reference/index.md](docs/reference/index.md)

## 5. Still open

- <question> — <the run that can answer it>

## 6. The release and the rebuild

- **The release.** <the file on the disk, and what the release adds to the program>
- **The rebuild.** <the source, the loader and the scenarios>
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

1. **The scope.** A list of what the page covers, and the sources (the source files, the assets).
2. **The conventions.** The terms of the page, for example "a pass is one run of `main_loop` `$1BC2`". Also the evidence labels. Use the conventions block of section 6.
3. **The overview.** A short text diagram or a mermaid flowchart of the calls, from the entry of the subsystem to its end.
4. **The catalogue.** A table of the data of the subsystem. Each row has the name, the address, the layout (bytes, entries, the meaning of each byte), the readers and the writers.
5. **The step-by-step walk.** For each main routine: a numbered list of what it does, in the order of the code. Each step gives the names and addresses. Add pseudo-code when a loop or a condition is not clear from the list.
6. **The state machine.** For code that changes from one state to another: a mermaid `stateDiagram-v2` and a transition table. The transition table has the state, the condition, the next state and the code that makes the change.
7. **The worked example.** One real case decoded by hand from the image, byte by byte. For example the first bytes of the map of level 1, and the screen cells that they give.
8. **Still open.**

```markdown
## 3. The state machine of <thing>

~~~mermaid
stateDiagram-v2
  state "Waiting ($00)" as Wait
  state "Moving ($01)" as Move
  [*] --> Wait
  Wait --> Move: timer = 0
~~~

| State | Condition | Next state | Code |
|---|---|---|---|
| Waiting `$00` | `move_timer` = 0 | Moving `$01` | `update_slider` `$3F8C` |
```

## 4. The entity sections

A program often has many items of one kind: levels, rooms, enemies, tunes. Give each item one section of the same form, in a page for a group of items. Each section has these parts:

1. **The description.** What the item is, in one paragraph. Embed the image of the item when an asset or the reference has one.
2. **The data.** The table rows of the item: its entries in each table, with the values.
3. **The setup.** What the init handler of the item does, step by step.
4. **The behaviour.** What the frame handler of the item does: a state diagram and a transition table.
5. **The links to other items.** The conditions in other items that change this item, for example a door that opens when another room is empty.

End the group page with a table of the dependencies between the items.

## 5. The data-format page

One page for each format of data, for example a packed map, a music stream or a sprite format. It has these parts:

1. **Where the data is.** The table of pointers, the range of the data, and the routine that reads it.
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

## 6. The conventions block

Put this block near the top of each subsystem page. Change the terms for the program.

```markdown
**Conventions.**
- Addresses are C64 addresses. Names are the names of the knowledge.
- A *pass* is one run of `main_loop` `$1BC2`. A *frame* is one raster interrupt.
- **Observed** marks a fact that a run showed. **Code** marks a fact from the code only. **Conclusion** marks an interpretation.
```
