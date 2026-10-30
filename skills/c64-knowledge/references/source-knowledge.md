# Source knowledge

This file gives the rules of the releases, the switches, the patches, the macros and the macro uses. For the commands, see their sections of `SKILL.md`.

## Releases

A release is one version of the program, for example the original or a crack. Record each release with `release <label> --file <file>`.

- A label is upper case, for example `FIRESTAR`, `TBC` or `V2`.
- `--file` is a PRG or the `image.json` of a capture. The project knowledge keeps the bytes of the release, the path of the file and its SHA-256. After the write, the project does not need the file. A file can stay in `.c64-re-tools/local/`.
- The base release is the release whose bytes are the program of the knowledge. Record it with `--base`. The script refuses `--base` when the segments or the bytes of the file are not the program.
- A space has one base release. Record the base release before the first switch.
- To change the bytes of a release, record the release again with its new file.
- A release of an earlier toolkit version has no `file` and no `sha256`. To get them, record the release again with its file.

## Switches

A switch puts one change of the program in or out of the build. A switch has a kind, a default and the releases that have it on. The generated source writes all switches with their defaults.

| Kind | What it changes | Default |
|---|---|---|
| `protection` | A copy protection | 0 (off) |
| `trainer` | A trainer, for example infinite lives | 0 (off) |
| `cheat` | A cheat | 0 (off) |
| `crack` | A change that a cracker made in the program, for example a credit text | 0 (off) |
| `fix` | A correction that one or more releases have | 1 (on). Give `--default 0` only for an alternative (see "Patches"). |
| `change` | Another difference between releases | Give `--default 0` or `--default 1`. |

- The default build is the clean program. It has no copy protection, trainer, cheat or crack change, and it has all corrections. Thus the script refuses `--default 1` for `protection`, `trainer`, `cheat` and `crack`.
- A switch that no release has on, for example a trainer of your own, has no `--releases`.
- The base value of a switch is 1 when the base release has it on, else 0. The program of the knowledge has the base value of each switch.
- A switch name is upper case, for example `PROTECTION`, `TRAINER` or `FIX_LIVES`. It cannot start with `RELEASE_`. It cannot be the name of a symbol or a platform name.
- The script refuses a change of the base value while the switch has patches. Remove the patches first, because they hold the other state.
- The script refuses defaults that put in two alternatives.

## Patches

A patch is ACME code for a range of the program. The code is the bytes of the switch in the state that the base release does not have. Examples:

- The base release has a copy protection. The switch `PROTECTION` names the base release. The code is the program without the protection, for example NOP in place of the `JSR` to the check.
- The base release has the protection already removed, and another release has it. The code is the bytes of the protection from that release. When no release has these bytes, write in a comment that the crack removed the protection.
- A correction is only in release `V2`. The switch `FIX_LIVES` names `V2`, and the code is the bytes of `V2`.
- A correction is in the base release and not in `V1`. The switch names the base release, and the code is the bytes of `V1`.

When another release has the bytes of the other state, give `--from-release <label>`. The script then writes the bytes of that release in the range as `!byte` lines. Do not copy the bytes yourself. The script refuses the base release, and a range where the release has no bytes.

Rules:

- Give exactly one of `--code`, `--code-file`, `--nop` and `--from-release`.
- Write the switch first. `patch` refuses a switch that the knowledge does not have.
- Many patches can have the same switch.
- The code must fit in the range. NOP (`$EA`) fills the bytes after the code. The script refuses code that is longer than the range. The check of the generated source finds the length errors of code with a label or a macro.
- The code can use the labels and the macros of the source, and local labels with a dot, for example `.skip`.
- The braces in the code must be pairs.
- Patches of different switches can have the same range. They are alternatives, for example two releases with two different corrections of one bug. The default build can put in only one of them.
- The knowledge refuses all other overlaps of patches. A patch cannot overlap a macro use.
- A patch with the same start and the same switch replaces the patch.
- Each byte of the range must be in the program of the knowledge.

## Macros

A macro writes a run of instructions as one line of the source, for example `+inc16 ptr`. Use macros to make the source shorter and easier to read.

- Give `--body` or `--body-file`. The body uses each param with a dot, for example `.dst`.
- The knowledge refuses a change of the number of params while the macro has uses.

## Macro uses

- The range of a use is complete instructions of the program of the knowledge.
- Each name in an argument is a symbol of the knowledge or a platform name.
- A use cannot overlap a patch or another use.
- The generated source writes a use only when the use gives the bytes of the program. Else it writes the instructions and gives the reason.
