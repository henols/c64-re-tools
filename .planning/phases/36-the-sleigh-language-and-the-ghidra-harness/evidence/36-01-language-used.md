# OPC-04 criterion 1 (language-used half): the run log names which language it used

**What this record is:** the transcript of the two `ghidra.analyze` requests that prove
criterion 1's language-used assertion has a real, checkable direction -- a run driven with
`processor: "6502:LE:16:nmos"` produces a captured run log naming `6502:LE:16:nmos`, and the
SAME import driven with `processor: "6502:LE:16:default"` produces a run log naming
`6502:LE:16:default` instead. Two different requests, two different names in the run log --
never asserted as equal, never inferred from the request alone.

Environment: real Ghidra 12.1.3 at `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`.
Date: 2026-09-04. Import subject: a 128-byte file of random bytes (`/dev/urandom`), sha256
`48c799bc3c619c83c6b626bf66c5b184ad3e4ae2f55ddfe3b7a8b5e0972970bc` -- the file's own content is
immaterial to this criterion, since the assertion is about which LANGUAGE the run used, not
what it decoded (that half -- the stock-language run observed FAILING a 105-byte decode
assertion -- lands with the opcode sweep in **plan 36-06**, named here per this task's own
instruction rather than left implicit).

## Setup: `ghidra.installExtension`

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request '{"tool":"ghidra.installExtension","args":{"sourceDir":"ghidra-ext","moduleName":"EvidenceRun"}}'
```

Response:

```json
{
  "ok": true,
  "tool": "ghidra.installExtension",
  "exitStatus": 0,
  "results": [
    {
      "path": "/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/Ghidra/Extensions/EvidenceRun/data/languages/6502_nmos.sla",
      "sha256": "c5713761f972c2d347d38b0a8e7ed216cbfcba27ba03d8cf194d807edf88eed1",
      "byteLength": 8435
    }
  ]
}
```

## Run 1: `processor: "6502:LE:16:nmos"`

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request '{"tool":"ghidra.analyze","args":{"runId":"evidence-nmos","importPath":"tiny.bin","processor":"6502:LE:16:nmos"}}'
```

Response (`results[0]` is the digested run log -- criterion 1's own captured artifact, per
D-36-05):

```json
{
  "ok": true,
  "tool": "ghidra.analyze",
  "exitStatus": 0,
  "results": [
    {
      "path": "<scratch>/tools/ghidra-runs/evidence-nmos.ghidra-run.log",
      "sha256": "1aa4e6ba3d62bc969bc69f3f2a320c3b2098d710703741b16457ff56fe66b4f9",
      "byteLength": 6138
    }
  ]
}
```

**The run log's own `Using Language/Compiler:` line:**

```
INFO  Using Language/Compiler: 6502:LE:16:nmos:default (ProgramLoader)
```

## Run 2: `processor: "6502:LE:16:default"` (the SAME import, the stock language)

```
$ node resources/host-tool.mjs run --repo-root <scratch> --request '{"tool":"ghidra.analyze","args":{"runId":"evidence-default","importPath":"tiny.bin","processor":"6502:LE:16:default"}}'
```

Response:

```json
{
  "ok": true,
  "tool": "ghidra.analyze",
  "exitStatus": 0,
  "results": [
    {
      "path": "<scratch>/tools/ghidra-runs/evidence-default.ghidra-run.log",
      "sha256": "8bcb9b68cd9f91027386216ce99b0cfa55349fc8ffc0c5a37154eddbb8f409bb",
      "byteLength": 6162
    }
  ]
}
```

**The run log's own `Using Language/Compiler:` line:**

```
INFO  Using Language/Compiler: 6502:LE:16:default:default (ProgramLoader)
```

## The failing direction, stated plainly

Two `ghidra.analyze` requests against the identical import, differing only in the `processor`
field, produced two run logs with two DIFFERENT digests (`1aa4e6ba...` vs `8bcb9b68...`) and two
DIFFERENT `Using Language/Compiler:` lines (`6502:LE:16:nmos` vs `6502:LE:16:default`). The
**second run (`6502:LE:16:default`) is the failing direction** for the language-used assertion:
were this project's language-comparison logic ever silently defaulted, hardcoded, or short-
circuited to "assume the request's own processor is what ran", this run would still read as a
false PASS. It does not, because `ghidra-run.ts`'s `runGhidraAnalyze()` parses the run log's OWN
line and compares it byte-exactly against the REQUESTED `processor` -- the comparison has
something real to catch a mismatch against, not merely two copies of the same string.

## What this record does NOT cover, and where that half lands

This record proves ONLY that the run log names which language ran -- it does not decode any of
the 105 undocumented opcode bytes, and it makes no claim about `6502:LE:16:default`'s own
decode behavior on real opcode bytes. Criterion 1's FULL form additionally requires observing
the STOCK-language run FAIL a 105-byte decode assertion; that half is deliberately deferred to
**plan 36-06** (the opcode sweep), named here rather than left as an implicit gap, because it
requires the opcode-classification harness that plan builds, not merely a run log's language
line.
