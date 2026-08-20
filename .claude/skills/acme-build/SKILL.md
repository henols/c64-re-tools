---
name: acme-build
description: Assemble Commodore 64 6510 assembly with the ACME cross assembler. Use when asked to assemble, build, compile or link .a/.asm 6502/6510 source, produce a C64 .prg, scaffold a new C64 program, or list the symbols a program uses.
---

# Assembling C64 source with ACME

Source in, `.prg` out. Everything goes through one script:

```bash
A=.claude/skills/acme-build/scripts/acme.mjs   # from the repo root

node $A new game.asm          # scaffold a C64 program
node $A build game.asm        # assemble -> .prg .sym .vs .rep
node $A sym game.asm          # the symbols the program uses
```

The script wraps `acme` and nothing else — **assembling only**. Running
the result on a C64 belongs to the emulator skills (`acme.mjs:3-4` says so, and the
absent `run` verb is not an omission). It contacts nothing.

Options: `-o FILE` `--out-dir DIR` `-f FORMAT` `--setpc ADDR` `-DSYM=VAL`
`-I DIR` `--no-report` `--json`.

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

Only address-typed *and* referenced symbols survive into the `.vs` — raw
`--vicelabels` output lists constants too, and a debugger reading
`viccolor_WHITE = $1` would relabel the 6510 processor port at `$0001`
(`curateLabels`, `scripts/acme.mjs`) — hence 4 addresses against 121 total
symbols above. Load it with `mcp__plugin_c64-re-tools_vice__vice_symbols_load` (format `vice`), this
project's only route to the emulator (`.claude/CLAUDE.md` § Version Compatibility
/ § Emulator Access).

Re-run `build` until it exits 0 — a clean exit means every symbol resolved.

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

Build variants with `-D`, giving each its own `-o` so the symbol files stay
separate:

```bash
node $A build game.asm -DBORDER=2 -o v2.prg    # -> v2.prg v2.sym v2.vs
node $A build game.asm -DBORDER=5 -o v5.prg    # -> v5.prg v5.sym v5.vs
```

Inspect the result with `od`:

```bash
od -An -tx1 game.prg | head -2
```

The first two bytes are the little-endian load address (`01 08` = `$0801`); code
follows.

## Writing source

Start from the scaffold — it carries a BASIC stub whose `SYS` target is computed,
so the entry point stays correct as the program grows:

```bash
node $A new game.asm
```

Use the C64 symbol library instead of writing addresses by hand:

| `!source <...>` | gives you | example |
|---|---|---|
| `<cbm/c64/vic.a>` | `vic_*` registers, `viccolor_*` constants | `vic_cborder` = `$d020` |
| `<cbm/c64/kernal.a>` | `k_*` KERNAL entry points `$ff81`–`$fff5` | `k_chrout` = `$ffd2` |
| `<cbm/c64/cia1.a>` / `<cbm/c64/cia2.a>` | `cia1_*` / `cia2_*` | keyboard, joystick, timers |
| `<cbm/c64/sid.a>` | `sid_*` | sound |

KERNAL routines use the **`k_`** prefix — `k_chrout`, `k_getin`, `k_setnam`,
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
isc anc alr arr sbx las tas sha shx shy jam`. Verified — `lax $fb / dcp $fc /
sax $fd / slo $02 / anc #$0f / sbx #$10` assembles to
`a7 fb c7 fc 87 fd 07 02 0b 0f cb 10`. Keep `!cpu 6510` at the top of any source
you also assemble by hand, so these stay recognised as mnemonics.

## Disassembly

This skill does not disassemble. Static disassembly of a `.prg` or flat 64K image
is a **required prerequisite** of this plugin, not an optional accelerator:
regenerator2000, reached through

```bash
npx -y @henols/vice-mcp r2000 export-asm game.prg          # npm installs
node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 export-asm game.prg  # in-repo/plugin
```

A recursive-descent disassembler with an auto-analyzer does not render strings,
tables and the BASIC stub as instructions, so there are no out-of-range labels
to hand-define and no illegal-opcode lines to re-indent — the caveats this
section used to carry were structural to a flat linear decoder and do not
apply here. The exported source is verified reassemblable by a real ACME
via `vice-mcp r2000 verify` (evidence:
`.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt`).
`c64-program-recon` points at this same route; it is not restated there.

## Setup

`acme` on `$PATH` is the **only** requirement. The scaffold `new` writes
assembles against a bare install with no standard hardware-register library —
that's deliberate: neither a plain `~/.local/bin/acme` build nor the Debian
trixie `apt` candidate ships one, so a scaffold that depended on it would fail
to assemble on a fresh install (Phase 8.1 FINDING-A1).

`$ACME` and the wrapper's auto-probe (`$ACME`, `/usr/local/share/acme`,
`/usr/share/acme`, `/usr/lib/acme`, `~/.acme`) still exist and still matter —
but only for **your own** sources that use angle-bracket includes (see
"Writing source" above), not for the scaffold. If you have that library
somewhere, point `$ACME` at its directory and angle-bracket includes work as
before; if you don't, the scaffold doesn't need it.

Re-checked against ACME release 0.97 "Zem" (31 Jan 2021). CI now assembles
the shipped scaffold on every build with `$ACME` cleared (the "Assemble the
acme-build scaffold (library-free)" step in `.github/workflows/ci.yml`), so
this claim is re-checkable rather than a one-machine observation.

Copy `acme.mjs` into any project's `.claude/skills/acme-build/scripts/`, and
`template.a` into `.claude/skills/acme-build/`, to use this elsewhere.

## Which skill does what

This one turns source into bytes. It does not restate what the others carry.

| Need | Go to |
|---|---|
| Where to start on an unknown program, and which address to read next | `c64-program-recon` |
| What a specific address or bit means, or annotating a listing | `c64-memory-mapping` — `node … lookup '$D018'` |
| A verified 64K image, or comparing two captures | `c64-ram-capture` |
| Static disassembly of a `.prg` or flat image | `vice-mcp r2000 export-asm` (see Disassembly above) |
| **Source in, `.prg` out** | here |

## References

| File | Covers |
|---|---|
| `scripts/acme.mjs` | The driver. Its comments are the contract for every flag above |
| `template.a` | The scaffold `new` writes: BASIC stub with a computed `SYS`, five local hardware constants (no library needed), no `!to` |

Findings that make RE faster go in `.planning/RE-FINDINGS.md` **at the moment you
find them**, graded with `Evidence:` and `Confidence:`. Promote by re-logging with
the new evidence, never by editing a grade in place. File-changing work enters
through a GSD command (`/gsd-quick`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `install the ACME cross assembler and put acme on PATH` | Install ACME. |
| `for <...> includes, set $ACME to …` | `export ACME=<dir holding cbm/c64/vic.a>`. |
| `Value not defined (kernal_chrout)` | Use the `k_` prefix — `k_chrout`. `node $A sym` lists what resolved. |
| `Label name not in leftmost column` + `Syntax error` on a mnemonic | Add `!cpu 6510`. |
| `Output file already chosen` | Remove `!to` from the source and keep `-o`. |
| `Number does not fit in 8 bits` | Pass a value 0–255, or drop the `#` if you meant an address. |
| `This tool cannot read binary files. The file appears to be a binary .a file.` | The file is fine — ACME source is plain text; the agent's Read tool refuses the `.a` extension regardless of content, and Edit needs a prior successful Read. Scaffold and write source as `.asm` instead — the driver accepts `.a`/`.asm`/`.s`, all three assemble byte-identically (verified both directions in this container, 2026-08-04). To read an existing `.a` file, use `sed -n '1,60p' file.a`. |
