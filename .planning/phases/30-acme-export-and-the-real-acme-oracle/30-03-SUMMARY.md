---
phase: 30-acme-export-and-the-real-acme-oracle
plan: 03
subsystem: testing
tags: [acme, assembler, byte-diff, annotation-store, exporter, data-types, comment-injection]

requires:
  - phase: 30-acme-export-and-the-real-acme-oracle
    provides: "plan 30-01's exportAsm() and the published verifyAcmeAssembles() surface (AcmeVerifyOptions/Result, ACME_VERIFY_ARGV_FLAGS)"
  - phase: 28-the-annotation-store
    provides: "the store's public write verbs (setDataType/setLabel/setComment), listComments(), DATA_TYPES, COMMENT_TYPES and assertCommentText()"
  - phase: 04-disassembler
    provides: "decode() and renderLine(), including D-11's `+2` width force which turns out to be the exporter's live defence against Pitfall 5"
provides:
  - "every emitted block bracketed by an origin and an exclusive-end `*` assertion, both observed firing against real ACME 0.97"
  - "a typed data-range emitter covering all twelve DATA_TYPES members byte-identically"
  - "assertCommentText()'s fourth check: an unconditional embedded-line-break refusal with reason \"embedded newline\""
  - "assertExportableCommentText() -- the export-boundary re-check for a store written before that refusal existed"
  - "comment emission in both placements, and a by-name refusal for a comment the export cannot place"
  - "anno-export-asm.test.ts -- the exporter's own test file with the never-skipped ACME gate and the three shared helpers"
affects: [30-04, 30-05, 30-06]

actuals:
  tokens: 70000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "planted-violation testing: a control is only proved by observing it FIRE, with the paired unmodified direction asserted in the same test so a red cannot be a broken fixture"
    - "the one-call-site helper: verifyExport() is the single place verifyAcmeAssembles() is reached, so a REQUIRED option has exactly one place to be right"
    - "a table-driven suite iterating the vocabulary's own frozen array, with a pinned length so a thirteenth member is a visible edit rather than a silent gap"
    - "boundary re-check by CALLING the one validator rather than restating its predicate, with the validator's message discarded so no file content reaches the error text"

key-files:
  created:
    - src/mcp/vice/anno-export-asm.test.ts
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-memmap-render.test.ts
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "Planted violation 2's stated mechanism does NOT reproduce -- measured, moving a symbol definition below the first `* =` leaves the bytes unchanged at exit 0, because renderLine()'s `+2` width force already holds the width. The test now reproduces Pitfall 4 honestly (a symbol substituted into a zeropage operand AND the definition moved) and asserts the counter-case as measured evidence."
  - "A comment with no emitted line to attach to is REFUSED BY NAME rather than dropped -- the plan's own prohibition, which the specified emission rules would otherwise have violated for a mid-instruction or out-of-range comment."
  - "The embedded-newline check runs SECOND, immediately after the non-string check and before both the semicolon rule and the byte bound."
  - "assertExportableCommentText() delegates to assertCommentText() and replaces its message, so the predicate has one home and no stored text reaches an exporter error (CR-03)."
  - "No `!text` directive is emitted for petscii/screencode; stock-petscii.ts was checked and exports asciiToPetscii() only, so no second conversion table was invented."
  - "hexExtent() pads without masking, because hex4()'s `& 0xffff` would render a $ffff-ending block's exclusive end as $0000 -- an assertion no assembly could satisfy."

patterns-established:
  - "Assert a directive at the START of a line, never as a substring: two test-authoring bugs in this plan came from assertions that tripped over an explanatory comment or the `* = $` origin line rather than the emission they were about."
  - "When a new refusal breaks an older test that needed the refused input, reproduce the pre-refusal state in the fixture rather than deleting the coverage the refusal is defence-in-depth for."

requirements-completed: [EXPORT-03]

coverage:
  - id: D1
    description: "Every emitted block is bracketed by an origin assertion and an exclusive-end assertion, and both are proved capable of firing against real ACME 0.97 on a planted length change"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#one block is bracketed: the symbol header, then `* =`, the origin assertion, the block's lines, and the end assertion at endInclusive + 1"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#two blocks are bracketed independently, and `blocks.length === 2`"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#PLANTED VIOLATION 1: removing the `+2` width force shrinks an instruction, and the end assertion fires on real ACME"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#PLANTED VIOLATION 2: a symbol substituted into a zeropage operand with its definition moved below the first `* =` widens the instruction, and the end assertion fires"
        status: pass
    human_judgment: false
  - id: D2
    description: "Symbol definitions are emitted in a header block before the first `* =`, with two hex digits below $0100 and four at or above"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a symbol below $0100 is defined with TWO hex digits and one at or above with FOUR -- the definition's width decides the operand's width"
        status: pass
    human_judgment: false
  - id: D3
    description: "All twelve DATA_TYPES members export and reassemble byte-identically, driven from the vocabulary's own source"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#data type round trip: a `code` range reassembles byte-identically (and the eleven sibling cases, one per DATA_TYPES member)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#the data-type suite is driven from `DATA_TYPES` itself -- a thirteenth member must arrive with a thirteenth case"
        status: pass
    human_judgment: false
  - id: D4
    description: "`!word` is emitted only where provably byte-identical (even-length word/address, little-endian pairs); everything else is `!byte` with the type named verbatim; no `!text` is ever emitted"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#`word` and `address` of EVEN length emit `!word` in little-endian order, with the type named verbatim"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#`word` of ODD length falls back to `!byte`, says why, and still reassembles byte-identically"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#no `!text` directive is ever emitted -- a conversion table this exporter does not control cannot back a byte-identical claim"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#`dataByteCount` counts every byte emitted through the data path, and nothing a code block emitted"
        status: pass
    human_judgment: false
  - id: D5
    description: "The empty-input cases: zero labels emits no definitions and renders every operand as a hex literal; zero comments emits no comment line; both still round-trip"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#a store with ZERO labels emits no symbol definitions and renders every operand as a hex literal, and still round-trips"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#a store with ZERO comments emits no comment line, and still round-trips"
        status: pass
    human_judgment: false
  - id: D6
    description: "assertCommentText() REFUSES an embedded line break (\\n, \\r, U+2028, U+2029) in any position with reason \"embedded newline\", unconditionally including the allowLeadingSemicolon path, and returns clean text unchanged"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#assertCommentText REFUSES an embedded line break by name -- every separator, and every position in the string"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the embedded-newline refusal applies with allowLeadingSemicolon: true too -- that flag governs the semicolon rule only"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#text with no line break is returned UNCHANGED -- including one byte under the bound, so the new check cannot be what makes the old assertions pass"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#defence in depth: writing a newline-bearing comment through the store's public write verb is refused before it reaches disk"
        status: pass
    human_judgment: false
  - id: D7
    description: "The export boundary re-checks rather than trusting the store, so a store written before the refusal existed is refused at export rather than emitted"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#assertExportableCommentText() REFUSES a line break at the export boundary and returns a clean string UNCHANGED"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#the export boundary re-checks rather than trusting the store: a store written BEFORE the refusal existed is refused at export"
        status: pass
    human_judgment: false
  - id: D8
    description: "Comments are emitted in both placements -- line on its own line before its address, side appended to that line -- and the export still reassembles byte-identically"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a `line` comment sits on its own line immediately before its instruction; a `side` comment appends to that instruction's line"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#an export carrying both comment kinds still reassembles byte-identically"
        status: pass
    human_judgment: false
  - id: D9
    description: "An annotation the exporter cannot express is refused loudly and by name, never silently dropped while the export reports success"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a comment the export cannot place is refused BY NAME, never dropped from the output while the export reports success"
        status: pass
    human_judgment: false
  - id: D10
    description: "Running the exporter twice over an unchanged store and image produces byte-identical source -- emission order is derived from sorted addresses, never from row insertion order"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#running the exporter twice over an unchanged store and image produces byte-identical source"
        status: pass
    human_judgment: false

duration: 37 min
completed: 2026-08-30
status: complete
---

# Phase 30 Plan 03: Structural honesty in the exported source Summary

**Every block now asserts its own origin and its own exclusive end -- both observed making real ACME 0.97 exit 1 on a planted length change with no output file written -- all twelve `DATA_TYPES` members round-trip byte-identically off the vocabulary's own frozen array, and an embedded line break in comment text is refused by name at the store boundary and again at the export boundary.**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-08-30T21:35Z (approx.)
- **Completed:** 2026-08-30T22:12Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- The `*` assertions are not decoration and this plan proves it twice. Before the brackets existed, both planted violations assembled at **exit 0** with silently wrong byte counts; after, both make ACME exit **1**, print the assertion's own `!error` on stderr, and write **no** output file.
- A finding the plan did not anticipate and that the measurement forced: **moving a symbol definition below the first `* =` does not, on its own, change a single byte of this exporter's output.** `renderLine()`'s `+2` width force already holds the width. The header-block placement and the width force cover the same hazard from opposite sides, and the block brackets are what covers losing both — which is now recorded as a measured counter-case inside the test rather than as a hope.
- All twelve `DATA_TYPES` members round-trip byte-identically, as twelve individually-named cases generated by iterating `DATA_TYPES` itself. No list of type names is written down in the test.
- `assertCommentText()` gained its fourth check. The store's `anno_*` MCP tool surface now refuses a comment containing `\n`, `\r`, U+2028 or U+2029 — REFUSED, never stripped, because stripping merges two lines somebody wrote separately into one text and reports success.
- The plan's prohibition ("an annotation the exporter cannot express must be refused loudly and by name") was found to be violated by the emission rules as specified: a comment stored against an operand byte, or against an address no range covers, had no emitted line and would have been dropped in silence. It now throws by name, with the address and the count and none of the text.

## Task Commits

1. **Task 1 (TDD RED): the failing `*`-assertion tests** — `b4c333e` (test)
2. **Task 1 (TDD GREEN): `emitBlock()`** — `cc135b4` (feat)
3. **Task 2 (TDD RED): the failing typed-data tests** — `b222a9f` (test)
4. **Task 2 (TDD GREEN): `emitDataLines()`** — `df266ad` (feat)
5. **Task 3 (TDD RED): the failing newline-refusal and comment tests** — `60d2b09` (test)
6. **Task 3 (TDD GREEN): the fourth check, the boundary re-check, comment emission** — `fd640cf` (feat)

**Plan metadata:** see the `docs(30-03)` commit that carries this file.

_TDD gate sequence, verified in `git log`: `test(30-03)` precedes `feat(30-03)` for all three tasks. No REFACTOR commit was needed._

## Files Created/Modified

- `src/mcp/vice/anno-export-asm.test.ts` — **created.** The exporter's own gates: the never-skipped `ACME availability gate`, one `mkdtempSync` per file removed in `after()`, and the three shared helpers (`buildStore`, `assembleRaw`, `verifyExport`). 33 tests.
- `src/mcp/vice/anno-export-asm.ts` — `emitBlock()`, `hexExtent()`, `formatSymbolDefinition()` (renamed from `symbolDefinition`), `emitDataLines()`, `WORD_PAIR_DATA_TYPES`, `assertExportableCommentText()`, `withComments()`, `LINE_COMMENT`/`SIDE_COMMENT` destructured from `COMMENT_TYPES`, and `ExportAsmResult.dataByteCount` / `.commentCount` (both additive).
- `src/mcp/vice/anno-types.ts` — `LINE_BREAK_RE` and the fourth check in `assertCommentText()`; the function's doc comment now enumerates all four checks in the order they run; `AnnoCommentError`'s class doc and `reason` field doc updated.
- `src/mcp/vice/anno-types.test.ts` — three new tests around the refusal, including the non-vacuity pairing (one byte under the bound, no newline, returned unchanged).
- `src/mcp/vice/anno-memmap-render.test.ts` — `writeCommentIncludingLegacyLineBreaks()`; the pipe-plus-newline escaping fixture now reproduces a pre-refusal store rather than being deleted along with the only way to reach it.
- `src/mcp/vice/module-classification.ts` — one advisory line citation re-pointed `42` → `43`.

## Evidence the plan asked to be recorded

### The exported source under test, verbatim

Fixture: an 8-byte `.prg` body `a9 00 a5 90 8d 90 00 60` at `$0801`, one `code` range `$0801..$0808`, labels `zpf_90` at `$0090` and `entry` at `$0801`. It deliberately carries BOTH operand shapes for the same zero-page address — a zeropage-mode operand (rendered as a hex literal, never symbol-substituted, D-11) and an absolute-mode operand below `$0100` (rendered with the `+2` size force).

```asm
!cpu 6510
zpf_90 = $90
entry = $0801
* = $0801
!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }
        lda #$00
        lda $90
        sta+2 zpf_90
        rts
!if * != $0809 { !error "export-asm: block end drifted, expected $0809" }
```

Clean run — `EXIT=0`, output file written:

```
First pass.
Segment size is 8 (0x8) bytes (0x801 - 0x809 exclusive).
Saving 8 (0x8) bytes (0x801 - 0x809 exclusive).
```
```
<tmp>/planted.a(7) : Warning (Zone <untitled>): Wrong type - expected address.
<tmp>/planted.a(8) : Warning (Zone <untitled>): Wrong type - expected address.
```

### PLANTED VIOLATION 1 — observed

One documented substitution: `sta+2 zpf_90` → `sta zpf_90`. ACME re-encodes to zeropage, two bytes where the original was three.

**Exit status: `1`. Output file: does not exist.**

stdout:
```
First pass.
Segment size is 7 (0x7) bytes (0x801 - 0x808 exclusive).
```
stderr:
```
<tmp>/planted.a(7) : Warning (Zone <untitled>): Wrong type - expected address.
<tmp>/planted.a(8) : Warning (Zone <untitled>): Wrong type - expected address.
<tmp>/planted.a(10) : Error (Zone <untitled>): !error: export-asm: block end drifted, expected $0809
```

**Before the brackets existed** (the RED run, commit `b4c333e`) the same substitution gave `EXIT=0` and a written output file — the silent shortening criterion 4 names.

### PLANTED VIOLATION 2 — observed, and the plan's stated mechanism corrected

The plan specified "moving one symbol definition from the header block to a position after the first `* =`". **Measured: that alone does not fire, and does not change a byte.** With the `+2` force intact, the definition move gives `EXIT=0`, a written output file, and bytes `a9 00 a5 90 8d 90 00 60` — identical to the clean run:

```
First pass.
Segment size is 8 (0x8) bytes (0x801 - 0x809 exclusive).
Further pass.
Saving 8 (0x8) bytes (0x801 - 0x809 exclusive).
```

Reproducing RESEARCH.md Pitfall 4 on this exporter's own output requires undoing **both** mitigations at once — substituting a symbol into a zeropage operand (what D-11 forbids) **and** moving that symbol's definition below its first reference (what the header block prevents). Then the instruction widens from `a5 90` (2 bytes) to `ad 90 00` (3):

**Exit status: `1`. Output file: does not exist.**

stdout — note the segment is **9** bytes where it should be 8:
```
First pass.
Segment size is 9 (0x9) bytes (0x801 - 0x80a exclusive).
```
stderr:
```
<tmp>/planted.a(10) : Error (Zone <untitled>): !error: export-asm: block end drifted, expected $0809
```

ACME's own oversized-addressing-mode warning — the mechanism's signature, captured on the RED run before the assertion existed to stop the further pass:

```
<tmp>/planted.a(5) : Warning (Zone <untitled>): Using oversized addressing mode.
```

Both the mechanism and the measured counter-case are recorded in the test's own comments and assertions, so a later reader sees why two mitigations exist rather than one.

### The twelve data-type case names, as the runner printed them

```
ok 10 - data type round trip: a `code` range reassembles byte-identically
ok 11 - data type round trip: a `byte` range reassembles byte-identically
ok 12 - data type round trip: a `word` range reassembles byte-identically
ok 13 - data type round trip: a `address` range reassembles byte-identically
ok 14 - data type round trip: a `petscii` range reassembles byte-identically
ok 15 - data type round trip: a `screencode` range reassembles byte-identically
ok 16 - data type round trip: a `lo_hi_address` range reassembles byte-identically
ok 17 - data type round trip: a `hi_lo_address` range reassembles byte-identically
ok 18 - data type round trip: a `lo_hi_word` range reassembles byte-identically
ok 19 - data type round trip: a `hi_lo_word` range reassembles byte-identically
ok 20 - data type round trip: a `external_file` range reassembles byte-identically
ok 21 - data type round trip: a `undefined` range reassembles byte-identically
```

Every one of them is `outcome === "ok"` with `byteDiff.equal === true`. No positive case in this file is proved by an exit status.

### Acceptance-criteria greps

```
grep -v '^\s*//' anno-export-asm.ts | grep -v '^\s*\*' | grep -c '!if \* != '   ->  2   (both inside emitBlock)
grep -c 'anno-export-asm.test.ts' test-gate.mjs                                 ->  0
forbidden same-wave symbols, comments stripped, anno-export-asm.ts              ->  0
forbidden same-wave symbols, comments stripped, anno-export-asm.test.ts         ->  0
grep -c 'verifyAcmeAssembles(' (test, comments stripped)                        ->  1
grep -c '!text' (exporter, comments stripped)                                   ->  0
grep -c 'DATA_TYPES' (test, comments stripped)                                  ->  4
```

### Verification commands

```
cd src/mcp/vice && npm run typecheck                                  -> exit 0
cd src/mcp/vice && VICE_REQUIRE_ACME=1 node --test anno-export-asm.test.ts
    # tests 33 / # pass 33 / # fail 0
cd src/mcp/vice && node --test anno-types.test.ts
    # tests 23 / # pass 23 / # fail 0
cd src/mcp/vice && npm run test:automated
    # tests 2819 / # pass 2812 / # fail 1 / # skipped 1 / # todo 5
node scripts/check-npm-packages.mjs                                   -> exit 0, 55-module closure clean
```

The single `test:automated` failure is `repo-root.test.ts`'s path-agreement test — the environmental worktree-only failure plan 30-01 logged in `deferred-items.md`. Arithmetic against 30-01's close: 2783 tests + 36 new (33 exporter + 3 anno-types) = 2819; 2776 + 36 = 2812.

## Decisions Made

- **Planted violation 2 was corrected against measurement rather than written to match the plan.** The plan's mechanism was tested first and found not to fire. Making the assertion pass by weakening it, or by asserting a warning the run does not emit, would have shipped a control that cannot bite — the exact failure the two planted violations exist to rule out.
- **A comment the export cannot place throws.** The plan's emission rules place a comment on the line for its address; nothing in them said what happens to a comment at an address with no line. Dropping it would have violated the plan's own first prohibition, so it is refused by name, carrying the placement, the address and the count — never the text (CR-03).
- **The newline check runs second, not last.** "Your comment has a line break in it" is actionable; "your comment is over 4096 bytes" would be the wrong thing to say about a two-line comment.
- **`assertExportableCommentText()` calls the store validator rather than restating it.** The key link is that `assertCommentText()` is the ONE comment-text vocabulary; a second regex at the export boundary would be a second definition that drifts. What the export boundary adds is the address in the message and the discarding of a message that quotes file content.
- **The trailing type comment goes on every data line, not only the first.** A generated file is read by scrolling into the middle of it, and a line that carries its own provenance costs nothing.
- **`!word` is used only for even-length `word` / `address`.** Every other type, the four split-orientation layouts included, goes out as `!byte`: their low and high halves are not adjacent pairs, so `!word` would either change bytes or need an emitter that re-orders them, and byte-identity is the criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Planted violation 2's specified mechanism does not reproduce**

- **Found during:** Task 1, before writing the test — the mechanism was probed against real ACME first.
- **Issue:** The plan states that "moving one symbol definition from the header block to a position after the first `* =` reproduces RESEARCH.md Pitfall 4's forward-reference widening, and the end assertion fires". Measured against ACME 0.97 on this exporter's actual output, it does not: the export's absolute-mode operands below `$0100` carry `renderLine()`'s `+2` size force, which holds the width regardless of where the definition sits, and its zeropage-mode operands are hex literals that reference no symbol at all. The move alone gives exit 0 and byte-identical output. A further measurement: a forward-referenced symbol WITHOUT the force produces `Using oversized addressing mode.` and **still** three bytes, so the two mistakes cancel exactly.
- **Fix:** the test reproduces Pitfall 4 the way it can actually be reached here — a symbol substituted into a zeropage operand AND its definition moved below its first reference — and additionally asserts the measured counter-case (the move alone assembles at exit 0 with an output file), so the finding is a gate rather than a note.
- **Files modified:** `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** exit 1, `!error: export-asm: block end drifted, expected $0809`, `Segment size is 9`, no output file; counter-case exit 0 with an output file. Both pasted above.
- **Committed in:** `b4c333e` / `cc135b4`

**2. [Rule 2 - Missing critical] A comment the export cannot place was silently dropped**

- **Found during:** Task 3
- **Issue:** the plan's emission rules attach a comment to the line for its address. A comment stored against an operand byte (inside an instruction), or against an address no annotated range covers, has no such line — and under the rules as written it would simply not appear in the output while the export returned success. The plan's own first prohibition forbids exactly that.
- **Fix:** every placed comment is tracked by `id`; anything unplaced when the last block is emitted throws `exportAsm: the {placement} comment at $XXXX has no emitted line to attach to ...` naming the address and the count. `commentCount` is therefore always the store's full comment count on a successful return.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** a comment at `$0802` (the operand byte of the two-byte `lda #$00` at `$0801`) is refused by name; the message carries no stored text.
- **Committed in:** `60d2b09` / `fd640cf`

**3. [Rule 2 - Missing critical] `hex4()` would have rendered a `$ffff`-ending block's exclusive end as `$0000`**

- **Found during:** Task 1
- **Issue:** `hex4()` masks with `0xffff`. A range ending at `$ffff` has an exclusive end of `$10000`, which the mask renders `$0000` — an assertion no assembly can satisfy, firing on a correct export.
- **Fix:** `hexExtent()`, which pads without masking, used for both assertions and the `* =` line.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`
- **Verification:** typecheck green; every existing block assertion unchanged for addresses below `$10000`.
- **Committed in:** `cc135b4`

**4. [Rule 3 - Blocking] `anno-memmap-render.test.ts` depended on `setComment()` accepting a newline**

- **Found during:** Task 3, first full-suite run after the refusal landed.
- **Issue:** `comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row` writes `"table | pipe\nsecond line"` through `setComment()` to prove the renderer collapses the newline to `<br>`. The new refusal made that write throw. This is the one regression the plan's acceptance criterion asked to be searched for.
- **Fix:** the fixture now creates the row through the public verb with the line breaks collapsed (so every other column is validated) and then puts the text column back to what a pre-refusal store would hold — the same argument `assertExportableCommentText()` is built on. The escaping assertions are unchanged; only the route the input takes to disk changed.
- **Files modified:** `src/mcp/vice/anno-memmap-render.test.ts`
- **Verification:** `node --test anno-memmap-render.test.ts` → 26/26.
- **Committed in:** `fd640cf`

**5. [Rule 3 - Blocking] An advisory line citation drifted**

- **Found during:** Task 3, same run.
- **Issue:** the new `AnnoCommentError` import in `anno-memmap-render.test.ts` pushed `formatConfidenceComment`'s import from line 42 to 43, and `module-classification.ts` cites it by line. `DIRECTION 9 (precision)` reddened, correctly.
- **Fix:** citation re-pointed `42` → `43` after confirming line 43 contains the cited symbol.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `module-classification.test.ts` green.
- **Committed in:** `fd640cf`

**6. [Rule 3 - Blocking] `node_modules` absent in the worktree**

- **Found during:** setup, before Task 1.
- **Issue:** GSD worktrees are fresh checkouts and `node_modules/` is never committed, so `npm run typecheck` fails with `tsc: not found`. Identical to plan 30-01's deviation 1.
- **Fix:** symlinked `src/mcp/vice/node_modules` to the main checkout's already-provisioned directory. No package installed, no lockfile touched.
- **Files modified:** none tracked. The symlink is untracked and was never staged (files are staged individually, never `git add .`). Note for the orchestrator: `.gitignore`'s `node_modules/` has a trailing slash and so does not match a symlink — it shows as `??` in `git status` inside the worktree.
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** nothing — deliberately.

---

**Total deviations:** 6 auto-fixed (1 bug, 2 missing-critical, 3 blocking)
**Impact on plan:** No scope creep. Deviation 1 is the plan meeting a measurement and losing, which is the phase's whole premise working as intended. Deviations 2 and 3 close correctness holes the plan's steps left open, one of them against the plan's own prohibition. Deviations 4 and 5 are the deterministic downstream consequences of narrowing a shipped store vocabulary, fixed the way each guard's own message prescribes.

## Issues Encountered

- **Two test-authoring bugs, both the same shape: an assertion that tripped over prose instead of the emission it was about.** `assert.equal(source.includes(" = $"), false)` for the zero-label case fired on the `* = $0801` origin line, and `assert.equal(source.includes("!word"), false)` for the odd-length fallback fired on the fallback's own explanatory comment ("!word emits PAIRS"). Both were caught immediately because both were written before the implementation and their first run reported the real text. Both are now matched by line SHAPE (`/^[A-Za-z_][A-Za-z0-9_]* = \$/`, `/^\s*!word\b/`) with a comment saying why — an assertion that fires on a correct export proves nothing.
- **The `repo-root.test.ts` path-agreement test remains red inside the worktree.** Environmental, documented in `deferred-items.md` by plan 30-01, unchanged by this plan. Nothing was added to `deferred-items.md`: this plan found no new out-of-scope issue.

## Known Stubs

None. Every code path either produces output a real ACME 0.97 reproduces byte-for-byte, or refuses by name. No hardcoded empty value reaches a caller and no placeholder text is emitted.

The scope this plan does NOT cover is planned narrowness, not a stub: there is still no enum substitution and no mid-instruction `=*+$01` label insertion in `anno-export-asm.ts`. Those belong to plan 30-04, and the file's header says so. Relatedly, a comment stored against an operand byte is currently REFUSED rather than emitted — when 30-04 adds the mid-instruction label rule it may also want to give such comments a line, and the refusal is where it will find them.

## Threat Flags

None. Every trust boundary this plan touched is in the plan's own register: T-30-06 (comment text → ACME source) and T-30-11 (a length-changing substitution) are both now mitigated and proved by planted violation, and T-30-10's `--strict-segments` is recorded in the emitter's comment as the reason an overlapping store range errors rather than silently overwriting. No new network endpoint, auth path, file-access pattern or schema change was introduced.

## Requirements

`requirements-completed` carries this plan's declared `[EXPORT-03]`, but **`.planning/REQUIREMENTS.md` was deliberately NOT marked.** `EXPORT-03` is also declared by sibling plans 30-02 and 30-04, neither of which has a `SUMMARY.md` yet, so the shared-ID gate blocks it until the last declaring plan finishes. No `REQUIREMENTS.md` edit is part of this plan's commits.

## Same-wave independence

Asserted mechanically, comments stripped, on both `anno-export-asm.ts` and `anno-export-asm.test.ts`: **zero** occurrences of any symbol plan 30-02 introduces (`classifySpawn`, `missingAssemblerIsNeverAPass`, `parseAcmeResultLines`, `parseAcmeAggregateLines`, `parseAcmeDiagnostics`, `firstResultLineDisagreement`, `refuseOnCompetingAggregates`, `AcmeSegmentLine`, `AcmeDiagnostic`). This plan consumes only the surface 30-01 published, reads no fixture 30-02 records, and touches none of 30-02's files — so merge order cannot change its result.

## User Setup Required

None — no external service configuration required. Real ACME 0.97 is installed on this host at `/home/henrik/.local/bin/acme`, and CI installs it and sets `VICE_REQUIRE_ACME=1`.

## Next Phase Readiness

- `exportAsm()`'s signature is unchanged, as the plan required. `ExportAsmResult` gained `dataByteCount` and `commentCount`, both additive — plan 30-05's CLI verb binds to the same call shape.
- `anno-export-asm.test.ts` exists with its three helpers documented as the route later tests go through. Plan 30-04 adds to this file: use `buildStore` / `verifyExport` rather than re-deriving them, and note that `verifyExport()` is the single `verifyAcmeAssembles()` call site by acceptance criterion, so a deliberately-mismatched segment list must be passed at its own call site.
- `assertExportableCommentText()` is exported and is where 30-04's own comment work should re-check, rather than adding a third copy of the predicate.
- The comment-placement refusal is the natural seam for 30-04's mid-instruction `=*+$01` rule: a comment whose address is inside an instruction currently throws, and that is where a mid-instruction label line would give it somewhere to go.
- One caveat carried forward unchanged: while running inside a GSD worktree the suite's clean floor is 1 failure, not 0, for the environmental reason in `deferred-items.md`.

---
*Phase: 30-acme-export-and-the-real-acme-oracle*
*Completed: 2026-08-30*

## Self-Check: PASSED

- `src/mcp/vice/anno-export-asm.test.ts` — FOUND
- `src/mcp/vice/anno-export-asm.ts` — FOUND
- `src/mcp/vice/anno-types.ts` — FOUND
- `src/mcp/vice/anno-types.test.ts` — FOUND
- `src/mcp/vice/anno-memmap-render.test.ts` — FOUND
- `src/mcp/vice/module-classification.ts` — FOUND
- commit `b4c333e` — FOUND
- commit `cc135b4` — FOUND
- commit `b222a9f` — FOUND
- commit `df266ad` — FOUND
- commit `60d2b09` — FOUND
- commit `fd640cf` — FOUND
- plan `<verification>`: `npm run typecheck` exit 0 — PASS
- plan `<verification>`: `VICE_REQUIRE_ACME=1 node --test anno-export-asm.test.ts` exit 0, 33/33 — PASS
- plan `<verification>`: `node --test anno-types.test.ts` exit 0, 23/23 — PASS
- plan `<verification>`: `npm run test:automated` — 2812/2819 pass, 1 fail, the single failure environmental and documented in `deferred-items.md`
- TDD gate sequence: `test(30-03)` precedes `feat(30-03)` for all three tasks — PASS
