# `export-asm` round-trip fixtures

A committed C64 program that **genuinely modifies its own code**, plus the ACME
source it was assembled from, used to prove `anno-export-asm.ts`'s
mid-instruction `=*+$01` label emission (`EXPORT-02`) against a real assembler
rather than against a substring match on the exporter's own output.

**These are real assembler outputs, not synthesized bytes.** `smc.prg` is the
byte-for-byte file ACME 0.97 wrote for `smc.a` under
`--cpu 6510 -f cbm`. Nothing here was hand-assembled, trimmed, padded or edited
after capture; `make-export-asm-fixtures.mjs` is the only thing that writes
`smc.prg`, and `anno-export-asm.test.ts`'s regenerator-agreement test
re-assembles `smc.a` on every run and byte-compares the result, so the two
cannot drift apart in silence.

## What is in this directory

| File | What it is |
|---|---|
| `smc.a` | The ACME source. Self-modifying by construction -- see below. |
| `smc.prg` | The assembled image, with the two-byte little-endian load address `$01 $08`. |
| `make-export-asm-fixtures.mjs` | The regenerator. Refuses rather than writing a partial fixture. |

## Provenance table

| File | Produced by | Assembler | Host | Captured at | Requirement anchor |
|---|---|---|---|---|---|
| `smc.prg` | `make-export-asm-fixtures.mjs` from `smc.a` | `ACME, release 0.97 ("Zem"), 31 Jan 2021` (`/home/henrik/.local/bin/acme`) | Linux x86-64 (this repo's development host) | 2026-08-30 | `EXPORT-02` (phase 30 criterion 3) |

## The bytes

```
0108  a9 00        ; $0801  lda #$00      <- $0802 is this instruction's operand byte
      ee 02 08     ; $0803  inc $0802     <- writes to $0802
      8d 20 d0     ; $0806  sta $d020
      4c 01 08     ; $0809  jmp $0801
```

Eleven payload bytes covering `$0801..$080b`, so the block's EXCLUSIVE end is
`$080c`.

## What this fixture proves

Phase 30's criterion 3 is explicit that **emitting** the `=*+$01` idiom is not
the criterion. A fixture that merely *contains* the idiom would prove only that
the exporter can print three characters, and every test over it would still
pass if the idiom were emitted in the wrong place, or on the wrong instruction,
or for an address no instruction owns.

This program genuinely self-modifies: `inc $0802` rewrites the immediate
operand of the `lda #$00` at `$0801`, so the instruction the CPU executes on the
next pass is a different instruction than the one it executed on this one, and
the changing value is written to the border-colour register so the modification
is not dead code. The write target `$0802` is **strictly inside** a decoded
instruction, which is exactly the condition under which the exporter must emit
`smc_operand =*+$01` rather than an ordinary `smc_operand = $0802` definition.

Placement is load-bearing and is proved so, not asserted: `anno-export-asm.test.ts`
carries a negative control that moves the `=*+$01` line from immediately BEFORE
its host instruction to immediately AFTER it. ACME accepts both and exits 0 for
both; the label then names `$0804` -- the *next* instruction's operand -- and
only the byte-diff tells them apart.

## Regenerating

```
cd src/mcp/vice && node fixtures/export-asm/make-export-asm-fixtures.mjs
```

Deterministic: running it twice must leave
`git status --porcelain src/mcp/vice/fixtures/export-asm` empty. The script
probes `ACME_BIN` (defaulting to `acme` on `PATH`) first and exits non-zero
without touching `smc.prg` if the assembler is missing, refuses the source, or
writes no output file.
