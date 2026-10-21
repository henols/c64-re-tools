# Style of the pages

These rules apply to each page that you write. The `link` command checks the rules that a script can check. The section "Link the pages" of `<skill>/SKILL.md` gives the forms of a link and the problems that `link` reports.

## Explain first

- Start each section with what the part does and why. Use the words of the program: the rooms, the player, the lanterns, the score. Then name the code.
- A list of labels is not an explanation. Tell what the code does and why it does it in that way.
- Name a routine only when the reader needs it. Examples are the entry of a part, the routine that a section explains, and a routine that a fact is about. Do not name each helper that a routine calls.
- Do not copy the reference. The reference lists each routine, each caller and each table entry. A page that you write tells the story that the reference cannot tell.
- Give a number or a fact that shows a point. An example: "a pass takes 3 frames, so the game logic runs about 16 times each second".

## Names and links

- Write a name and its address only for a link. Write the name without its address for each other mention.
- Link a name the first time that a section needs the reader to open the code. Each heading starts a section, also a heading of level 3 or lower.
- Put no more than about 3 links in a paragraph. Link the main parts, not each name.
- Put no links in a table. Link the important names in the text above the table.
- Use the name of the knowledge. Do not make a name that is only in the page. When a part has no good name, record a name in the project knowledge first.
- For a name and an address that is not the address of the name, put a word between them: `` `irq_vector` points to `$48C1` ``.
- `link` knows only the names of the space of the source. For a name in another space, for example a leftover, write the name without its address. Then give the space and the address: `` `old_demo_input_stream` in bank3 at `$F300` ``.
- Write addresses with `$` and hex digits in upper case: `$09BC`. Write values in hex with `$`, or in decimal without `$`.
- Write a range with a hyphen: `` `$4E97-$4E9B` ``.

## Evidence

- Mark each fact with its evidence, as text:
  - **Observed**: a run showed it.
  - **Code**: the code shows it, and no run showed it.
  - **Conclusion**: an interpretation of the facts.
- Put the mark at the end of the paragraph or the list item. When the facts of a paragraph have different evidence, mark each fact.
- Do not write the name of a JSON file in a page, and do not link to it. Examples are a scenario, a run file, a capture and a list that the source generation wrote. These files are input and output of the tools. They do not help a reader to understand the program.
- Tell in words what the run did and what it showed. An example: "a run fills each leftover with `$A5` at the entry, and the memory and the screen stay the same at all 10 checkpoints (**Observed**)".
- Do not link to a file in `.c64-re-tools/local/`.
- Do not write a fact that you did not check in the code, the knowledge or a run. Put a question in **Still open**.

## Diagrams and images

- Use mermaid for the diagrams: `flowchart` for calls and data flow, `stateDiagram-v2` for state machines.
- In a node, write what the step does in the words of the program. Add the name of the routine when the reader needs it: `"Draw the room (draw_room)"`.
- A diagram gets no links. Give the links in the text under the diagram.
- Keep a diagram small: at most about 12 nodes. Make two diagrams before one diagram that a reader cannot read.
- Embed an image only from the project. It can be an image of the reference (`reference/images/`), or a PNG from a run or a screen capture. It can also be an asset that a script of the project made from a format of the program, for example `../assets/rooms/room00.png`. `link` checks that each image exists.
- Give each image one line of text that tells what it shows.

## Text

- Write the pages in the language and the style that the user or the project asks for.
- Use a numbered list for steps in an order. Use a bulleted list for items without an order. Use a table for items with the same fields.
- Use the same word for the same thing on each page. Define each term of the program one time, in the conventions block.
- Write the entry page up to the findings for any reader who knows the C64 as a user. Write the other pages for a person who knows the 6502 and the C64, but not the program.

## Generated pages

- Do not edit a page in the reference. Change the knowledge, generate the source again, and run `generate` again.
- Do not put a page that you write in the folder of the reference. `generate` refuses to write when one is there.
