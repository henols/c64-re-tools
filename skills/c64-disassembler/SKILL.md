---
name: c64-disassembler
description: Disassemble a C64 .prg or flat 64K memory image with Ghidra or with dxa. Ghidra gives an analysis and a structural export. dxa gives a code/data listing. The skill also installs the Ghidra 6502 language for the undocumented opcodes. Use when asked to disassemble a C64 .prg or memory image, run Ghidra on a C64 binary, or produce a dxa listing. Also use when asked to install the Ghidra 6502 extension or analyse undocumented opcodes.
---

# Disassembling a C64 image

**Never guess the processor, the image kind or an entry point.** Each one
is a flag or a file that you supply. The script refuses a missing one by
name. A wrong value goes into the full analysis, and a wrong analysis costs
a lot of work to find.

```bash
S=skills/c64-disassembler/scripts/disassemble.ts   # from the repo root

node $S install-extension                                            # one time per Ghidra installation
node $S analyze --image game.prg --kind prg --processor 6502:LE:16:nmos --entrypoints game.entrypoints
node $S listing --image game.prg --kind prg --entrypoints game.entrypoints
```

The script has three verbs:

| Verb | Tool | Result |
|---|---|---|
| `analyze` | Ghidra (`ghidra.analyze`) | A run log and a structural export file |
| `listing` | dxa (`dxa.disassemble`) | A `-a dump` listing and its code/data ranges |
| `install-extension` | Ghidra (`ghidra.installExtension`) | The `6502:LE:16:nmos` language in `GHIDRA_HOME` |

Ghidra and dxa run on the host. The broker runs them. The script never
starts them. The script finds `ghidra-run.ts` and `dxa-run.ts` in the MCP
server tree and runs them with Node. The connection to the broker is in
`c64-project`.

The script resolves each relative path against the current directory
before it sends the request. The last stdout line is one JSON result.

## Prerequisites

- **The broker.** The broker must run. Start it as `c64-project` tells you.
- **Ghidra, for `analyze` and `install-extension`.** Set `GHIDRA_HOME` to a
  Ghidra installation directory. The directory must contain
  `support/analyzeHeadless`. The broker reads `GHIDRA_HOME` on the host.
  This project measured its runs with Ghidra 12.1.3 and JDK 21.
- **dxa, for `listing`.** This project builds dxa from its vendored source.
  Build it once in `src/mcp/vice`:

  ```bash
  bash vendor/dxa/build.bash build
  ```

## Choose `analyze` or `listing`

Use `listing` first when you do not know the program. dxa does a fast
discovery pass. It sorts each byte of the image into code or data.

Use `analyze` for the deeper questions. Ghidra gives control flow,
typed cross-references, decompiled functions, structure facts, and the
constant stores to `$01`, `$D011`, `$D018` and `$DD00`. Only the Ghidra
export goes into the annotation project.

The two passes help each other. Give Ghidra the entry points that dxa and
your own reading found. Give dxa the data ranges that you know.

## Install the Ghidra 6502 extension

Stock Ghidra decodes only the documented 6502 opcodes. Install the
extension before the first `analyze` with `6502:LE:16:nmos`:

```bash
node $S install-extension                         # installs as C64NmosLanguage
node $S install-extension --module-name MyName    # another module directory
```

The broker copies the vendored SLEIGH source into
`<GHIDRA_HOME>/Ghidra/Extensions/<module>/` and compiles `6502_nmos.sla`
with `support/sleigh`. The result gives the `.sla` name, its `sha256` and
its `byteLength`.

Use the default module name every time. A second install with the same
name replaces the first. Two modules with different names declare the
same language id two times.

## Undocumented opcodes

Two language ids are available to `analyze`:

| `--processor` | Decodes |
|---|---|
| `6502:LE:16:nmos` | The documented opcodes and all 105 undocumented NMOS 6502/6510 opcode bytes. Needs `install-extension`. |
| `6502:LE:16:default` | The documented opcodes only (stock Ghidra) |

The extension is a separate language. It does not change `6502:LE:16:default`
or the 65C02 language, because many undocumented bytes are real 65C02
instructions.

The extension models the undocumented opcodes as follows:

- The deterministic instructions (`SLO RLA SRE RRA SAX LAX DCP ISC ANC ALR ARR AXS`,
  `$EB SBC`, `LAS`) have full p-code. The decompiler can follow their data flow.
- The unstable instructions (`$8B XAA`, `$AB LAX #imm`, `$93`/`$9F AHX`,
  `$9B TAS`, `$9C SHY`, `$9E SHX`) store a black-box value. On a real 6510
  their result can depend on the bus, the chip revision and page crossing.
  The decompiler does not simplify them into an exact expression.
- The 12 `JAM` bytes stop the CPU at that instruction. Ghidra does not
  decode the bytes after a `JAM` as a fall-through path.
- Decimal mode is not modelled. `RRA`, `ISC`, `$EB SBC` and `ARR` are
  correct in binary mode only.

dxa decodes the undocumented opcodes too. The broker always runs it with
`-p all-nmos6502`.

For the SLEIGH source and the full opcode tables, read
[docs/undocumented-opcodes-ghidra.md](../../docs/undocumented-opcodes-ghidra.md).

## Analyze with Ghidra

```bash
node $S analyze --image FILE --kind prg|flat64k --processor LANG-ID \
  [--entrypoints FILE] [--data-ranges FILE] [--run-id ID] [--loader-base-addr 0xNNNN] [--project-root DIR]
```

- `--image` is the file to analyse.
- `--kind` is `prg` for a `.prg` file with its 2-byte load address, or
  `flat64k` for a memory image of exactly 65536 bytes.
- `--processor` is the Ghidra language id. See [Undocumented opcodes](#undocumented-opcodes).
- `--entrypoints` is a file with one hex address on each line, for example
  `0810`. Ghidra starts a function at each address. Without entry points,
  Ghidra finds little code in a raw image.
- `--data-ranges` is a file with one `xxxx-yyyy` range on each line.
  Ghidra marks each range as data before the analysis. Use it for
  graphics and tables that Ghidra must not decode as code.
- `--run-id` names the run. The default is the image name, with each
  character outside `A-Za-z0-9_-` changed to `-`.

The script always runs the committed scripts in `src/mcp/vice/vendor/ghidra-scripts/`:

1. `VolatileCarve.java` (pre-script) marks the processor port `$0000-$0001`
   and the I/O page `$D000-$DFFF` volatile. It then starts a function at
   each entry point and runs the analysis. Without the volatile marks, the
   decompiler deletes hardware writes as dead stores.
2. `GhidraStructExport.java` (post-script) writes the export file.

**The base address of a `.prg`.** Ghidra's `BinaryLoader` loads the 2-byte
header as memory. The script therefore sets the loader base to the load
address minus 2. The header then occupies the 2 bytes below the load
address, and the program body is at its real address. `--loader-base-addr`
replaces this value. A `flat64k` image loads at `$0000`.

The result:

```json
{"ok":true,"runLogPath":"/proj/.c64-re-tools/local/runs/ghidra/game.ghidra-run.log","sha256":"...","byteLength":48213,"exportPath":"/proj/.c64-re-tools/local/runs/ghidra/game.ghidra-export.txt","exitStatus":0,"language":"6502:LE:16:nmos","runId":"game","importRoute":"prg","loaderBaseAddr":"0x7ff","entrypoints":"/proj/game.entrypoints"}
```

The export file has these `## ` sections, in this order:
`CLASSIFICATION`, `REFERENCES`, `STRUCTURAL_FACTS`, `DECOMPILE_ACCOUNTING`,
`UNRESOLVED_DISPATCH`, `DECOMPILED_TEXT` and `CONST_WRITES`. Two runs on the
same program give the same bytes.

Both files are in `.c64-re-tools/local/runs/ghidra/` in the project. That
directory is machine-local output.

Import the export into the annotation project with `c64-annotations`
(`anno_import_ghidra_export`). The import deletes the export file.

## List with dxa

```bash
node $S listing --image FILE --kind prg|flat64k \
  [--entrypoints FILE] [--datablocks FILE] [--labels FILE] [--known-data ROWS.json] [--project-root DIR]
```

- `--entrypoints` is a file of routine addresses, one hex address on each
  line (dxa `-R`).
- `--datablocks` is a file of `xxxx-yyyy` data ranges (dxa `-B`). dxa does
  not decode these bytes as code.
- `--labels` is an xa65 label file (dxa `-l`).
- `--known-data` is a JSON array of `{ "start", "endInclusive", "dataType", "sym" }`
  rows with integer addresses. `dxa-blocks.ts` writes the data-type rows to
  the `-B` file and their `sym` names to the `-l` file for this run. Use
  `--known-data` or `--datablocks`/`--labels`. Do not use both.

The image must be in the project root. The result:

```json
{"ok":true,"listingPath":"/proj/.c64-re-tools/local/dxa/game.dxa-dump.lst","sha256":"...","byteLength":5120,"codeBytes":812,"dataBytes":230,"matchedLines":410,"firstAddress":"$0801","lastAddress":"$0c16","ranges":[{"class":"code","start":"$0810","end":"$0812"}],"unclassified":[],"outOfWindow":[],"entrypoints":"/proj/game.entrypoints"}
```

- `ranges` gives each listing line as a `code`, `data` or `unclassified` range.
- `unclassified` gives each byte that two listing lines decode. Each item
  has the `reason`. The script does not select one of the two decodes.
- `outOfWindow` gives each listing line with bytes outside the image.

The listing does not go into the annotation project.

## Failure shape

Each refusal is one line, `{"ok":false,"message":"..."}`, with a non-zero
exit code. The script refuses when a required flag is missing, when the
broker or a tool refuses, and when the result does not agree with the
request. It never prints `ok: true` with a partial result.

`analyzeHeadless` exits 0 when a Ghidra script throws. So the run log, not
the exit code, decides success. A run whose log names a language other than
`--processor` is a refusal.

## What this skill does NOT do

- **It does not write annotations.** `c64-annotations` imports the Ghidra
  export and holds the labels, comments and data types.
- **It does not explain addresses.** `c64-memory-map` tells what an address
  or a register means.
- **It does not unpack.** `c64-unpacker` finds a packed image and unpacks
  it. Disassemble the unpacked image.
- **It does not capture memory.** `c64-ram-capture` captures a flat 64K
  image from the running machine.
- **It does not assemble.** `c64-assembler` builds source with ACME.
- **It does not start the broker.** `c64-project` tells you how to start it.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `host_tool "ghidra.analyze" refuses: the requested processor "6502:LE:16:nmos" is not declared by any installed Ghidra language` | Run `node $S install-extension`. Or use `--processor 6502:LE:16:default`. |
| `... but its slafile ... does not exist on disk -- run ghidra.installExtension to build it` | Run `node $S install-extension`. |
| `host_tool "ghidra.installExtension" refuses: no Ghidra installation directory is known` | Set `GHIDRA_HOME` for the broker. Start the broker again. |
| `host_tool "dxa.disassemble" refuses: the vendored dxa binary does not exist` | In `src/mcp/vice`, run `bash vendor/dxa/build.bash build`. |
| `runGhidraAnalyze: a script threw during this run` | Read the run log that the message names. Find the `ERROR REPORT SCRIPT ERROR:` line. |
| `runGhidraAnalyze: language mismatch` | Ghidra used another language. Check the language ids in `GHIDRA_HOME`. |
| `analyze: --kind flat64k needs an image of exactly 65536 bytes` | Use `--kind prg` for a `.prg`. Use `flat64k` only for a full 64K image. |
| `flatImageOrigin: input is ... byte(s) -- a flat 64K capture must be exactly 65536 bytes` | Same correction as the row above, for `listing`. |
| `runDxaDisassemble: image ... which is outside the workspace root` | Put the image in the project, or give `--project-root`. |
| `parseDumpListing: covered byte total ... does not equal expected image size` | The listing does not cover each byte of the image. Check `--kind`. |
| `could not resolve vendor/ghidra-scripts/GhidraStructExport.java.` | Set `VICE_MCP_DIR` to a checkout's `src/mcp/vice`, or use the Claude Code plugin. |
| `c64-disassembler needs the "c64-project" skill` | Run `npx skills add henols/c64-re-tools --skill c64-project`. |
