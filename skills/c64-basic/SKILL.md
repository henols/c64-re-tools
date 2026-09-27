---
name: c64-basic
description: Detokenize a Commodore 64 BASIC V2 program into readable text and read the machine-code handover address from its SYS line. It also covers the BASIC V2 token table and the PETSCII bytes in a tokenized line. Use when asked to detokenize a BASIC listing, list what a BASIC stub does, or find where a program hands over to machine code. Also use when asked to decode a BASIC token or a tokenized BASIC line.
---

# Detokenizing BASIC with petcat

**Never guess an entry point.** When the `SYS` argument is not a literal
number, the script reports a named decline. A guessed address sends a
disassembler to the wrong code, and that costs a lot of work downstream.

```bash
S=skills/c64-basic/scripts/petcat.ts   # from the repo root

node $S decode --image path/to/program.prg   # detokenize + resolve the SYS handover
```

The script wraps one binary, VICE's `petcat`, and nothing else. The broker
runs `petcat` on the host. `c64-project` describes that connection.

The script requires `--image`. `--out-dir` is optional. Its default is the
directory of the image, the same default that `c64-assembler` uses. The script
resolves both paths **workspace-relative** to the smallest ancestor directory
that contains both. This occurs before the request goes to the seam.
`c64-assembler` and `c64-disk` use the same resolution.

Options: `--image PATH` `--out-dir DIR` `--json`.

## Detokenizing and resolving the handover point

```bash
node $S decode --image game.prg --json
```

The script prints the response of the seam, unchanged, as one line of JSON:

```json
{"ok":true,"tool":"petcat.decode","exitStatus":0,"results":[{"path":"/abs/path/game.bas.txt","sha256":"...","byteLength":21}],"stderrTail":"","entrypoint":2064,"entrypointReason":"literal SYS argument on BASIC line 10: sys2064"}
```

`results[0].path` is the detokenized listing file that the seam wrote. It is
the decoded text of `petcat`, captured and digested. The listing itself never
comes back inline, also when it is short.

Two fields give the handover verdict. BOTH are present on each `ok: true`
response:

- **`entrypoint`**: a number when the `SYS` argument is a literal decimal
  value. `null` when it is not.
- **`entrypointReason`**: always a string. When `entrypoint` is a number, it
  names the BASIC line that holds the value. When `entrypoint` is `null`, it
  quotes the unresolved expression exactly. Or it states that the listing has
  no handover instruction.

A `null` entrypoint is **not a failure**. It is a resolved "no". The tool
detokenized the program correctly and found that the entry point is not a
static address.

Without `--json`, the script prints the same data as two lines: the resolved
entry point (or the decline and its reason) and the path of the listing file.
It never prints the contents of the listing.

## The BASIC dialect

The dialect is C64 BASIC V2.0. The server sets it. It is not a flag on this
script and not a field on the wire. `c64-assembler` sets its assembler target
in the same way.

## PETSCII and ASCII

Bytes from `$20` to `$7F` in a tokenized line are literal PETSCII characters:
strings, variable names and numbers. The space, the digits and the uppercase
letters have the same byte values in unshifted PETSCII text mode as in ASCII.

## Reading a tokenized BASIC stub by hand

Use `decode` first. Its listing and its handover address are the source of
truth. Read the bytes by hand only to check them, or to find the address of
each line in memory. In practice, most commercial C64 titles captured after
the loader ran have a one-line `SYS` stub, so this step is rare.

### Line anatomy

A tokenized BASIC program is a linked list in memory. Each line has this
layout:

1. **Bytes 0–1: the next-line pointer.** The address where the *next* line
   starts, little-endian (`24 04` → `$0424`).
2. **Bytes 2–3: the line number**, 16-bit little-endian (`0A 00` → `10`).
3. **Bytes 4–N: the tokens.** They continue until a `$00` terminator.
4. **End of program:** a line whose next-line pointer is `$00 $00`.

Start at the first line. Follow the pointer chain until a pointer is
`$00 $00`. To read the bytes from the annotation project, use
`c64-annotations`.

### Keyword tokens (BASIC V2)

Bytes with the high bit set, `$80` through `$CB`, are keywords:

| Hex | Keyword | Hex | Keyword | Hex | Keyword | Hex | Keyword |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `$80` | `END` | `$93` | `LOAD` | `$A6` | `SPC(` | `$B9` | `POS` |
| `$81` | `FOR` | `$94` | `SAVE` | `$A7` | `THEN` | `$BA` | `SQR` |
| `$82` | `NEXT` | `$95` | `VERIFY` | `$A8` | `NOT` | `$BB` | `RND` |
| `$83` | `DATA` | `$96` | `DEF` | `$A9` | `STEP` | `$BC` | `LOG` |
| `$84` | `INPUT#` | `$97` | `POKE` | `$AA` | `+` | `$BD` | `EXP` |
| `$85` | `INPUT` | `$98` | `PRINT#` | `$AB` | `-` | `$BE` | `COS` |
| `$86` | `DIM` | `$99` | `PRINT` | `$AC` | `*` | `$BF` | `SIN` |
| `$87` | `READ` | `$9A` | `CONT` | `$AD` | `/` | `$C0` | `TAN` |
| `$88` | `LET` | `$9B` | `LIST` | `$AE` | `^` | `$C1` | `ATN` |
| `$89` | `GOTO` | `$9C` | `CLR` | `$AF` | `AND` | `$C2` | `PEEK` |
| `$8A` | `RUN` | `$9D` | `CMD` | `$B0` | `OR` | `$C3` | `LEN` |
| `$8B` | `IF` | `$9E` | `SYS` | `$B1` | `>` | `$C4` | `STR$` |
| `$8C` | `RESTORE` | `$9F` | `OPEN` | `$B2` | `=` | `$C5` | `VAL` |
| `$8D` | `GOSUB` | `$A0` | `CLOSE` | `$B3` | `<` | `$C6` | `ASC` |
| `$8E` | `RETURN` | `$A1` | `GET` | `$B4` | `SGN` | `$C7` | `CHR$` |
| `$8F` | `REM` | `$A2` | `NEW` | `$B5` | `INT` | `$C8` | `LEFT$` |
| `$90` | `STOP` | `$A3` | `TAB(` | `$B6` | `ABS` | `$C9` | `RIGHT$` |
| `$91` | `ON` | `$A4` | `TO` | `$B7` | `USR` | `$CA` | `MID$` |
| `$92` | `WAIT` | `$A5` | `FN` | `$B8` | `FRE` | `$CB` | `GO` |

### What a decoded line gives you

For each line you get four facts: the address of its next-line pointer
(bytes 0–1), its line number (bytes 2–3), the span of its tokens (byte 4
through the `$00` terminator, inclusive), and the reconstructed text, for
example `10 REM LODE RUNNER`. The last line is the `$00 $00` terminator. To
record these facts as typed ranges and comments, use `c64-annotations`.

## Failure shape

The seam reports a file that `petcat` does not recognise as a BASIC program as
`{"ok":false,"message":"..."}` with a non-zero exit code. A missing file gets
the same result. The seam never reports a success envelope with an empty or
guessed verdict. `petcat` itself exits `0` also on garbage input. So the
classifier of the seam decides success, not the exit code.

Without `--json`, a failed call prints `petcat call FAILED: <message>` on
stderr. A missing `--image` prints `error: usage: decode --image <path.prg>
[--out-dir <dir>] [--json]` and exits 1.

## What this skill does NOT do

- **No direct binary spawn.** `petcat` runs on the host, through the broker
  (see `c64-project`). It needs a running broker.
- **No guessed entry point.** The script always reports a computed or
  unresolved `SYS` argument as a named decline with `entrypoint: null`. It
  never gives a fallback value. It never scans the listing for "something
  that looks like an address".
- **No emulator.** This skill works on files only. Running the program on a
  C64 is `c64-emulator`.
- **No disassembly.** Disassembling the machine code at the handover address
  is `c64-disassembler`.
- **No file extraction.** Getting a `.prg` out of a `.d64` is `c64-disk`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `error: usage: decode --image <path.prg> [--out-dir <dir>] [--json]` | Give `--image` with the path of the `.prg`. |
| `"entrypoint":null` | Not a failure. Read `entrypointReason`. It quotes the expression or says that no handover exists. |
| `petcat call FAILED: …` | The seam refused the file or the call. Read the message. Start the broker by hand when it is not running (see `c64-project`). |
