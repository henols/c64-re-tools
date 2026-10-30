# Coverage

This file tells what the coverage of the knowledge shows. For the commands, see the sections of `coverage`, `at` and `listing` of `SKILL.md`.

## Maps and their paths

- The knowledge names a coverage map by its path. A recording folder gives the path of its map.
- A space has one map for each path. A new map of a path replaces the earlier map of that path. Thus, after you record a run again into the same folder, put its new map into the project knowledge. Then the coverage has only the new run of that folder.
- Do not move a coverage map after you put it into the project knowledge. Else `--evidence coverage:<map>` cannot name it.
- `coverage` puts each map into the space of `--space`. You can add the same map to each space.
- `--evidence coverage:<map>` names the last import of that map into the space of the write.
- A revert to a revision before an import removes the map. Then `--evidence coverage:<map>` refuses the map until you import it again.

## Access

- The coverage of a space is the union of its maps. It has each address that a run executed, read or wrote. It also has each address that one run wrote and executed: self-modified code.
- `at` gives the access of each map at the address, and the joined access of all maps: `x` executed, `rw` read and written, `r` read, `w` written, `-` none. An execute wins over a read and a write.
- `listing` gives the joined access of the bytes of each line: `x`, `r` and `w` as the runs did them, or `-` for none.

## Reads that the program does not do

An `r` on code can come from a read of the 6510 that the program does not do. Examples:

- The third byte of a JSR.
- The opcode after a branch that the CPU takes.
- The opcode at the PC when an interrupt starts.
- An indexed read (`lda table,x`) that crosses a page also reads the byte $100 below its target.

A read watchpoint does not stop at these reads. Thus an `r` on code alone does not show that the program reads the byte as data.
