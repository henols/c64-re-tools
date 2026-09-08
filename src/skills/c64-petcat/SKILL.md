---
name: c64-petcat
description: Convert a Commodore .prg between PETSCII and ASCII, detokenize a BASIC program into readable text, and read the machine-code handover address out of its startup line, using VICE's own petcat conversion tool as the reference implementation. Use when asked to detokenize a BASIC listing, list what a BASIC stub does, find where a program hands over to machine code, or convert C64 text between PETSCII and ASCII.
---

# Detokenizing BASIC with petcat

One capability, one script, one binary (`petcat`) reached only through the
host-tool execution seam:

```bash
S=src/skills/c64-petcat/scripts/petcat.mjs   # from the repo root

node $S decode --image path/to/program.prg   # detokenize + resolve the SYS handover
```

The script wraps `petcat` and nothing else. `--image` is required; `--out-dir`
is optional, defaulting to the image's own directory, exactly like
`acme-build`'s own `--out-dir` default. Both are resolved
**workspace-relative** to the smallest ancestor directory containing both,
before the request ever reaches the seam — the same resolution
`acme-build`/`c64-disk-access` already go through.

Options: `--image PATH` `--out-dir DIR` `--json`.

## Detokenizing and resolving the handover point

```bash
node $S decode --image game.prg --json
```

Prints the seam's response verbatim as one line of JSON:

```json
{"ok":true,"tool":"petcat.decode","exitStatus":0,"results":[{"path":"/abs/path/game.bas.txt","sha256":"...","byteLength":21}],"stderrTail":"","entrypoint":2064,"entrypointReason":"literal SYS argument on BASIC line 10: sys2064"}
```

`results[0].path` names the detokenized listing file the seam wrote —
`petcat`'s own decoded text, captured and digested. The listing itself never
crosses inline, no matter how short it is.

Two fields carry the handover verdict, and BOTH are present on every
`ok: true` response:

- **`entrypoint`** — a number when the program's `SYS` argument is a literal
  decimal value, `null` otherwise.
- **`entrypointReason`** — always a string. When `entrypoint` is a number, it
  names the BASIC line the value came from. When `entrypoint` is `null`, it
  quotes the unresolved expression verbatim, or states that the listing
  carries no handover instruction at all.

A `null` entrypoint is **not a failure** — it is a resolved "no": the tool
detokenized the program correctly and correctly concluded the entry point is
not a static address. Reported this way, never as a guessed address: a
guessed entry point is expensive downstream, spent on a disassembler that
then has nothing real to work from.

Non-JSON mode prints the same information as two lines — the resolved entry
point (or the decline and its reason) and the listing file's path — never the
listing's contents inline.

## The BASIC dialect

Fixed server-side, not a flag on this script or a field on the wire — this
project's target is fixed to C64 BASIC V2.0 everywhere already, the same
posture `acme-build` already takes for its own assembler target.

## Failure shape

A file `petcat` does not recognise as a BASIC program at all — including a
missing file — is reported as `{"ok":false,"message":"..."}` with a
non-zero exit code, never a success envelope carrying an empty or guessed
verdict. `petcat` itself exits `0` even on garbage input; the seam's own
classifier, not the exit code, is what decides success here.

## What this skill does NOT do

- **No direct binary spawn.** `petcat` runs host-side; this script only ever
  constructs a typed request and reads the produced listing file back off
  the shared workspace tree — the host-tool execution seam is the only
  route.
- **No guessed entry point.** A computed or otherwise unresolvable `SYS`
  argument is always reported as a named decline with `entrypoint: null` —
  never a fallback value, never an inline listing scan for "something that
  looks like an address".
- **No backend declaration.** This skill names no VICE emulator tool at all
  — it is silent on fork vs. stock by construction.
