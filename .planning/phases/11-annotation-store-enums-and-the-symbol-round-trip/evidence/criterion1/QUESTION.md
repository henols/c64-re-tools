# Session B Question — Criterion 1 (D-26), Plan 11-07

## Permitted inputs

Answering this question is permitted to use **only** these two files:

- `recon-subject.regen2000proj` (this phase's committed annotation store — query it with the
  curated `r2000_*` tools, do not open it as raw text and pattern-match it by eye)
- this file, `QUESTION.md`

**Explicitly forbidden**, and reading any of them invalidates the result:

- `fixture/recon-subject.a` (the ACME source)
- `fixture/recon-subject.prg` (the assembled binary)
- `SESSION-A-TRANSCRIPT.md`
- `ANSWER.md` and `ANSWER.sha256`
- `11-07-PLAN.md`, `11-07-SUMMARY.md`, and any git commit message or commit diff from plan 11-07

## The question

Using only the curated `r2000_*` tools against `recon-subject.regen2000proj`, answer all four
parts:

1. **Label.** What user-defined label name did session A give to memory address `2124` (decimal;
   `$084C`)?
2. **Confidence.** Session A recorded a D-25 confidence-prefix comment on the memory block that
   spans addresses `2156`-`2163` (decimal; `$086C`-`$0873`). What is the confidence grade — the
   bracketed token's contents, without the brackets — recorded in that comment?
3. **Block type.** What block type does `r2000_get_blocks` report for that same block,
   `2156`-`2163` (lowercased)?
4. **Cross-references.** How many distinct addresses does `r2000_get_cross_references` return for
   address `2128` (decimal; `$0850`)?

## Canonical answer format

Exactly one line. Lowercase. Single ASCII space between fields. No trailing newline (the sealed
hash in `ANSWER.sha256` is computed over the raw bytes of this line with no trailing `\n`).

```
label=<label-name> confidence=<confidence-grade> blocktype=<block-type> xrefcount=<integer>
```

Field rules:

- `<label-name>` — exactly as stored, case-sensitive, exactly as `r2000_get_symbols` returns it in
  its `name` field. Do not lowercase it even though the rest of the line is lowercase.
- `<confidence-grade>` — the bracketed prefix token's contents, lowercased, with any spaces
  replaced by hyphens (e.g. a comment beginning `[confirmed-code]` yields `confirmed-code`; one
  beginning `[unknown]` yields `unknown`).
- `<block-type>` — the block type string `r2000_get_blocks` returns for that range, lowercased
  (e.g. `Byte` → `byte`, `Address` → `address`, `Code` → `code`).
- `<integer>` — the number of entries in the array `r2000_get_cross_references` returns, as a bare
  decimal integer with no leading zeros (`0` if the array is empty).

**Worked example** (dummy values — this is not the real answer):

```
label=dummy_routine confidence=confirmed-code blocktype=code xrefcount=3
```

Two answers built from the same underlying facts must produce byte-identical lines under this
grammar, which is what lets `ANSWER.sha256` check a submitted answer mechanically.

## Why this question is store-only

- **Part 1 (label).** The name session A chose is a human naming decision recorded in the store.
  Nothing about the address, the bytes at it, or the `.a` source's own internal label
  (`fixture/recon-subject.a` is forbidden reading anyway) determines what session A decided to
  call it in `recon-subject.regen2000proj` — it is an arbitrary, independent judgement, not a
  derivation.
- **Part 2 (confidence).** regenerator2000's own block-type mechanism has no confidence axis at
  all (D-25) — "probable" versus "confirmed" is not a property any disassembler, human or
  automated, can read off raw bytes. It records what session A had or had not yet established,
  which exists only inside the comment text session A chose to write.
- **Part 3 (block type)** for this specific range is a classification judgement, not a byte-level
  fact. The eight bytes at `2156`-`2163` decode as a syntactically valid 6502 instruction stream —
  a byte-level classifier that trusts opcode validity alone would call this range code. Session
  A's actual classification came from a reachability judgement (nothing in the program's own
  control flow ever jumps or calls into this range) recorded as a deliberate `r2000_set_data_type`
  call, not from the bytes' own shape.
- **Part 4 (cross-references)** exercises criterion 2's query layer as well. Taken alone it is, in
  principle, recoverable from the raw bytes (both a call instruction and an address-table entry
  naming address `2128` are visible in the `.prg`) — which is exactly why it is only one of four
  required parts, and why a correct answer to Part 4 alone is not sufficient: the falsifiability
  rule for this question rests on Parts 1-3, each of which requires a stored human judgement no
  amount of byte-level analysis can recover.
