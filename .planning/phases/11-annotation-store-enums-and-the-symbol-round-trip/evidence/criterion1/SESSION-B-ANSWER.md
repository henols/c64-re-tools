# Session B Answer — Criterion 1 (D-26), Plan 11-09

This is the second, independent execution context for criterion 1's two-session
falsifiability proof. It answers `QUESTION.md` using only the curated `r2000_*`
tool surface (`runR2000Tool()` in `.claude/mcp/vice/r2000-tools.ts`) against the
committed store `evidence/criterion1/recon-subject.regen2000proj`. The store was
never opened as raw text — every value below came from a named tool call.

## canonical answer line

<!-- CANONICAL-ANSWER-LINE -->
label=border_bump_up confidence=probable-data blocktype=byte xrefcount=2
<!-- /CANONICAL-ANSWER-LINE -->

## Derivation

Every call below was made through `runR2000Tool(name, { project, ...args })` —
the same dispatcher `vice-proxy.ts` uses for the `r2000_*` MCP surface — driven
from a small Node driver script that imports `runR2000Tool` directly (this
session has no live MCP connection exposing `r2000_*` tools, so the dispatcher
was invoked programmatically rather than through a tool-call transport; the
function called and its guards — `assertCuratedTool()`, `resolveStorePath()` —
are identical either way). `project` was
`.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj`
on every call.

### Part 1 — label at address 2124 ($084C)

**Call:** `r2000_get_symbols({ start_address: 2124, end_address: 2124 })`

**Response fragment:**
```json
[
  {
    "address": 2124,
    "kind": "User",
    "name": "border_bump_up",
    "type": "Subroutine"
  }
]
```

**Field value:** `label=border_bump_up` — the `name` field, taken verbatim
(case-sensitive, per `QUESTION.md`'s field rule that this one field is not
lowercased with the rest of the line).

### Part 2 — confidence grade on the comment for block 2156-2163 ($086C-$0873)

**Call:** `r2000_get_comments({ start_address: 2156, end_address: 2163 })`

**Response fragment:**
```json
[
  {
    "address": 2156,
    "comment": "[probable-data] decodes as a syntactically valid instruction stream (lda #0 / sta $d020 / rts / nop / nop) but is never reached by any JSR/JMP/vector in this program -- classified as data on reachability grounds, not opcode shape",
    "type": "line"
  }
]
```

**Field value:** `confidence=probable-data` — the bracketed prefix token's
contents (`probable-data`), already lowercase and hyphenated exactly as
`QUESTION.md`'s field rule describes (no spaces to convert).

### Part 3 — block type for range 2156-2163 (lowercased)

**Call:** `r2000_get_blocks({})` (no `block_type` filter — the full block list
was inspected and the entry covering the requested range picked out by its
address range)

**Response fragment:**
```json
[
  { "start_address": 2064, "end_address": 2139, "type": "Code" },
  { "start_address": 2140, "end_address": 2147, "type": "Byte" },
  { "start_address": 2148, "end_address": 2155, "type": "Address" },
  { "start_address": 2156, "end_address": 2163, "type": "Byte" }
]
```

**Field value:** `blocktype=byte` — the block whose `start_address`/`end_address`
is exactly `2156`/`2163` reports `type: "Byte"`, lowercased per the field rule.
This is the range the question names, and it is a distinct block from its three
neighbours (`Code` 2064-2139, `Byte` 2140-2147, `Address` 2148-2155) — no
ambiguity about which entry answers the question.

### Part 4 — cross-reference count for address 2128 ($0850)

**Call:** `r2000_get_cross_references({ address: 2128 })`

**Response fragment:**
```json
[2118, 2150]
```

**Field value:** `xrefcount=2` — the array has exactly two entries.

## Files read this session

- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-09-PLAN.md` (this plan)
- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/QUESTION.md`
- `.planning/PROJECT.md` (required initial-read context, not session-A-specific)
- `.planning/ARCHITECTURE.md` (required initial-read context)
- `.planning/ENGINEERING_RULES.md` (required initial-read context)
- `.planning/STATE.md` (required initial-read context)
- `./CLAUDE.md` (project instructions)
- `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-05-SUMMARY.md` (explicitly permitted per `prior_wave_context` — tool mechanics only, not plan 11-07)
- `.claude/mcp/vice/r2000-tools.ts` (API documentation named in Task 1's `read_first` — the curated tool definitions, the allow-list, and `runR2000Tool()` itself, which this session called directly)
- `.claude/mcp/vice/r2000-cli.ts` (named in Task 1's `read_first`; read in full — the CLI has no query verbs reaching `r2000_get_*`, so the driver script called `runR2000Tool()` directly instead)
- `.claude/mcp/vice/r2000-answer-key.test.ts` (named in Task 2's `read_first` — read to learn the `<!-- CANONICAL-ANSWER-LINE -->` marker convention and the extraction/hashing mechanics before writing this file's own canonical-line fence)

**Not read** (the forbidden set, confirmed by name): `evidence/criterion1/ANSWER.md`,
`evidence/criterion1/ANSWER.sha256`, `evidence/criterion1/SESSION-A-TRANSCRIPT.md`,
`evidence/criterion1/fixture/recon-subject.a`, `evidence/criterion1/fixture/recon-subject.prg`,
`11-07-PLAN.md`, `11-07-SUMMARY.md`, and no `git log -p`/`git show`/`git log` was run
over plan 11-07's commits. `recon-subject.regen2000proj` itself was never opened as
text or JSON — every value above came from an `r2000_*` tool call's own response.

## Store completeness

Nothing the question asked for came back empty or missing. All four parts were
answered by a single, unambiguous tool-call response each; no truncation applied
(none of the four calls used `r2000_search_disassembly`, whose only silent-cap
risk is `max_results`).
