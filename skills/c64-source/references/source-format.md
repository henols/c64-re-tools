# Source format

This file gives the files, the names and the lines of the source that `generate` writes. For the command, see the section "Generate the source" of `SKILL.md`.

## The source files

- `main.asm` sets the address of each segment. It includes the files in address order.
- Each module in the knowledge is one file. A module starts at its address. It stops at the next module or at the end of its segment. The file of a module can be in a folder, for example `music/driver.asm`. Without modules, each segment is one file, `segments/segment_xxxx.asm`.
- `constants.asm` holds the names of addresses outside the program, for example `EXTCOL = $d020`. It also holds the register names in the program, for example `RASTER = $d012`. The names are in groups by memory area, in address order. Drive code and banks have one group only.
- The side comment of a constant is the knowledge comment of the address. Without a comment, it is the platform meaning. When the knowledge name is not the platform name, the platform name comes first. For an I/O mirror without a meaning, the comment gives the register that the mirror repeats.
- After the side comment, `Used:` counts how the source uses the name. The kinds are `read`, `written`, `modified`, `called`, `jumped to`, `jumped through`, `branched to`, `pointer`, `address`, `table` and `macro argument`. `address` is an immediate operand expression. `table` is an entry in a table of addresses. A macro line counts one `macro argument` for each name in its args. The other bytes that the macro reads or writes, for example the high byte of a 16-bit value, count for no name.
- `config.asm` holds the value of each switch, for example `PROTECTION = 0`. The switches are in groups by kind. The side comment gives the releases that have the switch on, the ranges of its patches and the comment of the switch.
- You can change a value in `config.asm` to 0 or 1. The next run keeps the values of the file. It adds a new switch with its default. It removes a switch that the knowledge does not have.
- `start_screen.asm` is the code that shows the start screen and waits. It is the same for each program.
- `switches.asm` holds each release of the knowledge. `main.asm` and `loader.asm` include it first. The script writes it only when the knowledge has switches or releases, or when the source has leftovers. For each release, a block `!ifdef RELEASE_<label>` gives each switch the value of that release.
- `leftovers/leftover_xxxx.asm` holds a range of leftovers. See "The leftovers".
- `macros.asm` holds the macros of the knowledge. `main.asm` and `loader.asm` include it.

## Names in the source

- A label or a constant gets the name of the address in the knowledge.
- Without a knowledge name, it gets the platform name, for example `EXTCOL` or `CHROUT`. A platform name wins over an analyzer name (`dxa`, `decompiler` or `heuristic`), for example `EXTCOL` over `ld020`. A `user` or `llm` name wins over a platform name.
- An address in the program without a name gets `l_xxxx`.
- A read or a write in the I/O area `$d000-$dfff` uses the register, also when the program has RAM there. For example, `lda $dd0e` is `lda CI2CRA` and `sta $d012` is `sta RASTER`. `constants.asm` has these names. An address without a platform name stays a number, for example `sta $d800,x`. The data label of the RAM stays at its data. A `user` or `llm` name of the address wins over the register.
- A platform name in an operand expression of the knowledge stays in the source. When the program has the address, `constants.asm` has the name, and the RAM there keeps its label.
- The source does not use the names of a ROM that the program does not use. `romNamesLeftOut` gives these ROMs.
- When the program uses no ROM, the zero page and pages 2 and 3 get no system names. An operand expression or a macro use with such a name gets that reason.

## Lines in the source

- `sta $d011  ; $d011: yScroll 3, rows 25, displayEnabled` is a store of an immediate to a register with a known meaning. The side comment gives the decoded value. A side comment in the knowledge replaces it.
- Code regions, and the decoded instructions outside of data regions, become instructions.
- Data regions become data by their type: `!byte`, `!word`, `!pet`, `!scr`, `!fill`, tables of labels, and sprite bytes in binary.
- `lda+2 $0012` is an absolute operand below $0100. `+1` is a zero-page operand with a label.
- `sta NMINV+1` is an address inside a platform entry of more than one byte, for example the high byte of a vector.
- `lda room_colours+5` is an address inside a data region with a named start. The address has no name of its own.
- `name = * + 1` is a label inside an instruction, for example for code that changes its own operand.
- `lda #<irq_handler` and `lda bar_colours-1,x` are operand expressions of the knowledge. An expression in a non-immediate mode that starts with a bracket gets `0+` before it. ACME reads `(...)` as indirect.
- `; = <irq_handler` at the end of an instruction with a number: the source cannot use this operand expression. `operandsAsNumbers` gives the reason.
- `!byte` with an instruction as its comment: ACME writes this instruction with a different opcode. The bytes keep the source identical.
- `not decoded` marks bytes in a code region that the script did not decode.
- `; not executed $xxxx-$yyyy` starts code that no run of the coverage executed. The range is an item of `notExecuted`.
- `+inc16 ptr` is a use of a macro of the knowledge. The comments inside a use go to its side comment.
- `!zone patch_PROTECTION_100e` starts a patch. The condition is the switch state that the program does not have. It is `!if TRAINER` when the base release has the switch off. It is `!if PROTECTION = 0` when the base release has it on.
- A patch block has the code of the patch and NOP to the end of the range. `else` has the code of the base release. The labels inside the range come before the zone as `name = * + n`.
- Alternatives are patches of two or more switches at one range. They follow as `} else { !if FIX_B {`. A line before them stops the build with `!error` when two of them are in.
