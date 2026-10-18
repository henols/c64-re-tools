# Style of the pages

These rules apply to each page that you write. `docs.ts link` checks the rules that a script can check.

The rules in this file are in Simplified Technical English. The pages that you write are not. Write the pages in plain English for a human reader.

## Explain first

- Start each section with what the part does and why. Use the words of the program: the rooms, the player, the lanterns, the score. Then name the code.
- A list of labels is not an explanation. Tell what the code does and why it does it in that way.
- Name a routine only when the reader needs it. Examples are the entry of a part, the routine that a section explains, and a routine that a fact is about. Do not name each helper that a routine calls.
- Do not copy the reference. The reference lists each routine, each caller and each table entry. A page that you write tells the story that the reference cannot tell.
- Give a number or a fact that shows a point. An example: "a pass takes 3 frames, so the game logic runs about 16 times each second".

## Names and links

- Write a name and its address in backticks to make a link: `` `draw_room` `$09BC` ``. `docs.ts link` makes one link of the two, to the line of the name in the source.
- Write a name without its address for each other mention: `` `draw_room` ``. A name without an address gets no link.
- Link a name the first time that a section needs the reader to open the code. A name gets one link in each section. Each heading starts a section, also a heading of level 3 or lower. `docs.ts link` reports a second link as `repeated-link`.
- Put no more than about 3 links in a paragraph. Link the main parts, not each name.
- Put no links in a table. Write the names in the table without the address. Link the important names in the text above the table. `docs.ts link` reports a link in a table as `link-in-table`.
- Use the name of the knowledge. Do not make a name that is only in the page. When a part has no good name, record a name with c64-knowledge first.
- For a place inside a routine, write the name of the routine and the address of the place: `` `draw_room` `$0A04` ``. The link goes to the line of the place.
- For a byte inside a table or a variable, write the name with an offset: `` `room_script_vars+3` `$4E9A` ``.
- For a value, write an equals sign: `` `scroll_moves` = `$10` ``. Without the sign, `docs.ts link` reads `$10` as an address.
- For a name and an address that is not the address of the name, put a word between them: `` `irq_vector` points to `$48C1` ``.
- `docs.ts link` knows only the names of the space of the source. For a name in another space, for example a leftover, write the name without its address. Then give the space and the address: `` `old_demo_input_stream` in bank3 at `$F300` ``.
- Write addresses with `$` and hex digits in upper case: `$09BC`. Write values in hex with `$`, or in decimal without `$`.
- Write a range with a hyphen: `` `$4E97-$4E9B` ``.

## Evidence

- Mark each fact with its evidence, as text:
  - **Observed**: a run showed it.
  - **Code**: the code shows it, and no run showed it.
  - **Conclusion**: an interpretation of the facts.
- Put the mark at the end of the paragraph or the list item. When the facts of a paragraph have different evidence, mark each fact.
- Do not link to the files of a run in `.c64-re-tools/local/`. Name the run in the text when it helps a reader to do the run again. A scenario in `tests/` and a run in `runs/` are part of the project. You can link them.
- Do not write a fact that you did not check in the code, the knowledge or a run. Put a question in **Still open**.

## Diagrams and images

- Use mermaid for the diagrams: `flowchart` for calls and data flow, `stateDiagram-v2` for state machines.
- In a node, write what the step does in the words of the program. Add the name of the routine when the reader needs it: `"Draw the room (draw_room)"`.
- A diagram gets no links. Give the links in the text under the diagram.
- Keep a diagram small: at most about 12 nodes. Make two diagrams before one diagram that a reader cannot read.
- Embed an image only from the project. It can be an image of the reference (`reference/images/`) or a PNG that a skill made. It can also be an asset that a script of the project made from a format of the program, for example `../assets/rooms/room00.png`. `docs.ts link` checks that each image exists.
- Give each image one line of text that tells what it shows.

## Text

- Write plain English in short paragraphs. A sentence can join a cause and its effect.
- Use a numbered list for steps in an order. Use a bulleted list for items without an order. Use a table for items with the same fields.
- Use the same word for the same thing on each page. Define each term of the program one time, in the conventions block.
- Write the entry page up to the findings for any reader who knows the C64 as a user. Write the other pages for a person who knows the 6502 and the C64, but not the program.

## Generated pages

- Do not edit a page in the reference. Change the knowledge, generate the source, and run `docs.ts generate` again.
- Do not put a page that you write in the reference directory. `docs.ts generate` refuses to write when one is there.
