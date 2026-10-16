# Style of the pages

These rules apply to each page that you write. `link.ts` checks the rules that a script can check.

## Names and addresses

- Write each routine, table and variable with its name and its address: `` `draw_room` `$09BC` ``. `link.ts` gives the name a link to its line, and the address a link to its entry in the reference.
- Use the name of the knowledge. Do not make a name that is only in the page. When a part has no good name, record a name with c64-knowledge first.
- For a place inside a routine, write the name of the routine and the address of the place: `` `draw_room` `$0A04` ``. The address gets a link to its line.
- For a byte inside a table or a variable, write the name with an offset: `` `room_script_vars+3` `$4E9A` ``.
- For a value, write an equals sign: `` `scroll_moves` = `$10` ``. Without the sign, `link.ts` reads `$10` as an address.
- Write addresses with `$` and hex digits in upper case: `$09BC`. Write values in hex with `$`, or in decimal without `$`.
- Write a range with a hyphen: `` `$4E97-$4E9B` ``.
- Write the name and the address in backticks. A name without backticks gets no link.

## Evidence

- Mark each fact with its evidence, as text:
  - **Observed**: a run showed it.
  - **Code**: the code shows it, and no run showed it.
  - **Conclusion**: an interpretation of the facts.
- Do not link to the files of a run. The run files are not part of the documentation. Name the run in the text when it helps a reader to do the run again.
- Do not write a fact that you did not check in the code, the knowledge or a run. Put a question in **Still open**.

## Diagrams and images

- Use mermaid for the diagrams: `flowchart` for calls and data flow, `stateDiagram-v2` for state machines. Write the name and the address in each node: `"draw_room $09BC"`.
- A diagram gets no links. Give the links in a table or a list under the diagram.
- Keep a diagram small: at most about 20 nodes. Make two diagrams before one diagram that a reader cannot read.
- Embed an image only from the project. It can be an extracted asset (for example `../assets/sprites/bruce.png`), an image of the reference (`reference/images/`), or a PNG that a skill made. `link.ts` checks that each image exists.
- Give each image one line of text that tells what it shows.

## Text

- Write short sentences: one fact or one step in each sentence.
- Use a numbered list for steps in an order. Use a bulleted list for items without an order. Use a table for items with the same fields.
- Use the same word for the same thing on each page. Define each term of the program one time, in the conventions block.
- Write the pages for a person who knows the 6502 and the C64, but not the program.

## Generated pages

- Do not edit a page in the reference. Change the knowledge, generate the source, and run `generate.ts` again.
- Do not put a page that you write in the reference directory. `generate.ts` refuses to write when one is there.
