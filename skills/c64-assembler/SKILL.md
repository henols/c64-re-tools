---
name: c64-assembler
description: Assemble Commodore 64 6510 assembly source into a .prg with the ACME cross assembler. Use when asked to assemble, build, compile or link .a/.asm 6502/6510 source, or to produce a C64 .prg. Also use when asked to scaffold a new C64 program, or to list which symbols an assembled build used from its symbol file.
---

# Assembling C64 source with ACME

**Re-run `build` until it exits 0.** A clean exit means every symbol
resolved. Any other exit means the `.prg` is not the program you wrote.

```bash
A=skills/c64-assembler/scripts/acme.ts   # from the repo root

node $A new game.asm          # scaffold a C64 program
node $A build game.asm        # assemble -> .prg .sym .vs .rep
node $A sym game.asm          # the symbols the program uses
```

The script wraps `acme` and nothing else. It only assembles: source in,
`.prg` out. It has no `run` verb, and that is not an omission (`acme.ts:3-4`
says so).

Options: `-o FILE` `--out-dir DIR` `-f FORMAT` `--setpc ADDR` `-DSYM=VAL`
`-I DIR` `--no-report` `--json`. The comments in `scripts/acme.ts` are the
contract for every flag.

The seam resolves `-I DIR` **workspace-relative** to the project root the host
broker starts with. This is the same resolution that `source` and `--out-dir`
go through, and it happens before the request reaches the assembler. The seam
refuses an absolute or escaping `-I` directory. It does not pass one to ACME.

## Writing source

Start from the scaffold:

```bash
node $A new game.asm
```

`new` writes `template.a` (at the skill root). It holds a BASIC stub that
computes its `SYS` target instead of hard-coding it, so the entry point stays
correct as the program grows. It defines five local hardware constants, so it
needs no library. It has no `!to`.

Use the C64 symbol library instead of writing addresses by hand:

| `!source <...>` | gives you | example |
|---|---|---|
| `<cbm/c64/vic.a>` | `vic_*` registers, `viccolor_*` constants | `vic_cborder` = `$d020` |
| `<cbm/c64/kernal.a>` | `k_*` KERNAL entry points `$ff81`–`$fff5` | `k_chrout` = `$ffd2` |
| `<cbm/c64/cia1.a>` / `<cbm/c64/cia2.a>` | `cia1_*` / `cia2_*` | keyboard, joystick, timers |
| `<cbm/c64/sid.a>` | `sid_*` | sound |

KERNAL routines use the **`k_`** prefix: `k_chrout`, `k_getin`, `k_setnam`,
`k_plot`. Several have aliases (`k_bsout` and `k_basout` are also `$ffd2`).
Run `node $A sym game.asm` to see what a build resolved:

```
addr    $80d  entry
addr   $ffd2  k_chrout
addr   $d021  vic_cbg
addr   $d020  vic_cborder
```

Let `-o` name the output and leave `!to` out of the source, so the filename you
pass is the filename you get.

The 6510's illegal opcodes are always available: `lax dcp sax slo rla sre rra
isc anc alr arr sbx las tas sha shx shy jam`. Verified: `lax $fb / dcp $fc /
sax $fd / slo $02 / anc #$0f / sbx #$10` assembles to
`a7 fb c7 fc 87 fd 07 02 0b 0f cb 10`. Keep `!cpu 6510` at the top of any source
you also assemble by hand, so these stay recognised as mnemonics.

## Build

```bash
node $A build game.asm
```
```
  Saving 53 (0x35) bytes (0x801 - 0x836 exclusive).
built game.prg (55 bytes)  load $0801-$0836  53 bytes of code
symbols: game.sym (4 used / 121 total)
debug labels: game.vs (4 addresses)
```

The indented line is ACME's own `-v1` note, passed straight through. Three side
files land next to the `.prg`, and `--no-report` drops the `.rep`:

| file | contents |
|---|---|
| `.prg` | the program, with its load address |
| `.sym` | every symbol, with the used ones marked |
| `.vs` | address labels, ready for a debugger or monitor |
| `.rep` | each source line with the address and bytes it produced |

Only symbols that are address-typed *and* referenced go into the `.vs`. Raw
`--vicelabels` output lists constants too, and a debugger that reads
`viccolor_WHITE = $1` would relabel the 6510 processor port at `$0001`
(`curateLabels`, `scripts/acme.ts`). That is why the example above has 4
addresses against 121 total symbols. Load the `.vs` into the running emulator
with `c64-emulator` (`vice_symbols_load`, format `vice`).

Add `--json` to act on diagnostics programmatically:

```bash
node $A build game.asm --json
```
```json
{ "ok": false,
  "diags": [ { "file": "game.asm", "line": 26, "severity": "error",
               "zone": "Zone <untitled>",
               "message": "Number does not fit in 8 bits." } ] }
```

Use the `.rep` listing to map source to memory:

```
    16  0801 0b080a00                   !word .eol, 10          ; link to next line, line number
    26  080d a900                       lda #viccolor_BLACK
    27  080f 8d21d0                     sta vic_cbg             ; $d021 background
    29  0814 8d20d0                     sta vic_cborder         ; $d020 border
```

Build variants with `-D`. Give each its own `-o`, so the symbol files stay
separate:

```bash
node $A build game.asm -DBORDER=2 -o v2.prg    # -> v2.prg v2.sym v2.vs
node $A build game.asm -DBORDER=5 -o v5.prg    # -> v5.prg v5.sym v5.vs
```

Inspect the result with `od`:

```bash
od -An -tx1 game.prg | head -2
```

The first two bytes are the little-endian load address (`01 08` = `$0801`). Code
follows.

**Reassembling exported source.** `anno export-asm` in `c64-annotations`
writes source text and runs no assembler, so a clean export is not an
assembler verdict. To know that the emitted source reassembles, build it
here.

## Setup

`acme` on `$PATH` **on the host**, never inside a container, is the **only**
requirement. Install it with `npx skills add henols/c64-re-tools --skill
c64-assembler`, together with `c64-project`, which this script loads for the
host-tool connection (see `c64-project`).

The scaffold that `new` writes assembles against a bare install with no
standard hardware-register library. That is deliberate: neither a plain
`~/.local/bin/acme` build nor the Debian trixie `apt` candidate ships one, so a
scaffold that depended on it would fail to assemble on a fresh install.

The host side probes for the library in the conventional install locations
that `acme.mts`'s `findAcmeLib()` names. `$ACME` still matters for **your own**
sources that use angle-bracket includes (see "Writing source" above). It does
not matter for the scaffold. Set it in the environment of the **host** broker
process, not in this script's environment, because the probe runs host-side.
If you do not have that library, the scaffold does not need it.

Re-checked against ACME release 0.97 "Zem" (31 Jan 2021). CI assembles the
shipped scaffold on every build with `$ACME` cleared (the "Assemble the
c64-assembler scaffold (library-free)" step in `.github/workflows/ci.yml`), so
this claim can be re-checked on any machine.

## Failure shape

A failed build exits 1. With `--json` it prints the build result with
`"ok": false` and a `diags` array. Each diagnostic carries `file`, `line`,
`severity`, `zone` and `message`. Without `--json` it prints each diagnostic
and then `build FAILED (<n> error(s))`. A missing source file or a host-tool
refusal (no broker, no `acme` on the host `$PATH`) prints `error: <message>`
on stderr and exits 1. The script never falls back to spawning `acme` itself.

## What this skill does NOT do

- **No running the program.** Loading and running a `.prg` on a C64 is
  `c64-emulator`.
- **No disassembly.** Turning a `.prg` or flat image back into a listing is
  `c64-disassembler`. Exporting annotated source is `c64-annotations`.
- **No address meanings.** What an address or register bit means is
  `c64-memory-map`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `install the ACME cross assembler and put acme on PATH` | Install ACME. |
| `for <...> includes, set $ACME to …` | `export ACME=<dir holding cbm/c64/vic.a>`. |
| `Value not defined (kernal_chrout)` | Use the `k_` prefix: `k_chrout`. `node $A sym` lists what resolved. |
| `Label name not in leftmost column` + `Syntax error` on a mnemonic | Add `!cpu 6510`. |
| `Output file already chosen` | Remove `!to` from the source and keep `-o`. |
| `Number does not fit in 8 bits` | Pass a value 0–255, or drop the `#` if you meant an address. |
| `This tool cannot read binary files. The file appears to be a binary .a file.` | The file is fine. ACME source is plain text. The agent's Read tool refuses the `.a` extension regardless of content, and Edit needs a prior successful Read. Scaffold and write source as `.asm` instead. The driver accepts `.a`/`.asm`/`.s`, and all three assemble byte-identically (verified both directions). To read an existing `.a` file, use `sed -n '1,60p' file.a`. |
