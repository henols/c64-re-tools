# Sealed Answer — Criterion 1 (D-26), Plan 11-07

This file is **forbidden reading** for plan 11-09 (session B) — see `QUESTION.md`'s permitted-
inputs list. It exists so `.claude/mcp/vice/r2000-answer-key.test.ts` can recompute
`ANSWER.sha256` from this file's own canonical line and assert the two never drift apart
(T-11-SEAL-DRIFT).

## Canonical answer line

The line between the two `CANONICAL-ANSWER-LINE` marker fences below is the exact, sealed answer.
`r2000-answer-key.test.ts` extracts it by finding the text strictly between those two marker lines
(exclusive of the markers themselves and of the newline immediately preceding the closing marker),
and hashes that extracted text with **no trailing newline** — matching `QUESTION.md`'s own stated
hashing convention.

<!-- CANONICAL-ANSWER-LINE -->
label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2
<!-- /CANONICAL-ANSWER-LINE -->

## Field-by-field explanation

- **`label=border_bump_up`** — `r2000_get_symbols({ project, kind: "user" })` returns an entry
  `{ "address": 2124, "name": "border_bump_up", ... }`. This is the label session A's
  `r2000_batch_execute` call gave to address `2124` (`$084C`, the routine that increments
  `$D020`'s border colour). Produced by: `r2000_set_label_name` (write), read back via
  `r2000_get_symbols` (query).
- **`confidence=probable-data`** — `r2000_get_comments({ project })` returns an entry
  `{ "address": 2156, "comment": "[probable-data] decodes as a syntactically valid instruction
  stream (lda #0 / sta $d020 / rts / nop / nop) but is never reached by any JSR/JMP/vector in this
  program -- classified as data on reachability grounds, not opcode shape", "type": "line" }`. The
  bracketed prefix's contents, lowercased with the space replaced by a hyphen, is `probable-data`.
  Produced by: `r2000_set_comment` (write, carrying the D-25 confidence-prefix convention), read
  back via `r2000_get_comments` (query).
- **`blocktype=byte`** — `r2000_get_blocks({ project })` returns an entry
  `{ "start_address": 2156, "end_address": 2163, "type": "Byte" }`, lowercased to `byte`. Produced
  by: `r2000_set_data_type({ start_address: 2156, end_address: 2163, data_type: "byte" })` (write),
  read back via `r2000_get_blocks` (query).
- **`xrefcount=2`** — `r2000_get_cross_references({ project, address: 2128 })` returns the array
  `[2118, 2150]` — two entries: `2118` is the `jsr` instruction inside `take_two` that calls this
  routine, and `2150` is the address-table entry (inside `routine_vector_table`, itself classified
  `address` per D-19's "creates X-Refs" note) whose word value is `2128`. Produced by: the `jsr`
  instruction and the `address`-typed block existing in the assembled `.prg` and the store's own
  block classification (write), read via `r2000_get_cross_references` (query) — the one part of
  the answer whose existence is, in principle, recoverable from the raw bytes alone (named
  explicitly in `QUESTION.md`'s own "why store-only" section as the one part that is not, by
  itself, sufficient evidence).
