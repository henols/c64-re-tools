---
phase: 30-acme-export-and-the-real-acme-oracle
plan: 04
subsystem: testing
tags: [acme, assembler, byte-diff, self-modifying-code, opcodes, enums, annotation-store, exporter]

requires:
  - phase: 30-acme-export-and-the-real-acme-oracle
    provides: "plan 30-01's exportAsm() and the published verifyAcmeAssembles() surface; plan 30-02's five named verdict rules; plan 30-03's per-block `*` brackets, verifyExport() one-call-site helper and the typed data emitter"
  - phase: 28-the-annotation-store
    provides: "setLabel()'s duplicate-name refusal and the `unique` DDL on anno_label.name, createProjectEnum()/applyEnumUsage()/listProjectEnums()/listEnumUsage(), parseVariantKey()"
  - phase: 04-disassembler
    provides: "the 256-entry OPCODES table with its acmeExpressible column, decode(), renderLine()'s D-09 `!byte` substitution and D-10 fixed note vocabulary"
  - phase: 27-annotation-coverage
    provides: "AUTO_NAME_PREFIX_RE -- the one home of the eleven typed auto-name prefixes"
provides:
  - "mid-instruction inline label definitions, proved load-bearing on a committed fixture that genuinely self-modifies"
  - "src/mcp/vice/fixtures/export-asm/ -- smc.a, smc.prg, its regenerator and a provenance README"
  - "the first cross-module PRODUCTION importer of AUTO_NAME_PREFIX_RE, with a three-direction structural scan that catches a five-prefix copy"
  - "immediate-operand-only enum substitution with four by-name refusals"
  - "a 256-opcode single-invocation round trip driven from the OPCODES table"
  - "real ACME confirming the store's duplicate-label refusal at the source-text boundary"
affects: [30-05, 30-06]

actuals:
  tokens: 53841
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "a committed fixture whose defining PROPERTY is asserted from its bytes, not from its filename: the integrity test decodes smc.prg and requires exactly one instruction whose absolute write target is another instruction's immediate operand byte"
    - "regenerator-agreement: the committed image is re-assembled from its source on every run and byte-compared, so source and blob cannot drift"
    - "the two-parameter verify helper (result, source): a negative control mutates the TEXT while keeping the UNMUTATED export's expectations, so the mutation cannot move the goalposts with it"
    - "observe-then-assert for a control with two possible refusing instruments: the exit status is read, the winning rule named, and the unconditional assertion is only that nothing reads as a pass"
    - "read the wording out of the source before matching on it (acme-gate.test.ts technique), applied to anno-store.ts's refusal and disasm-renderer.ts's note vocabulary"

key-files:
  created:
    - src/mcp/vice/fixtures/export-asm/smc.a
    - src/mcp/vice/fixtures/export-asm/smc.prg
    - src/mcp/vice/fixtures/export-asm/make-export-asm-fixtures.mjs
    - src/mcp/vice/fixtures/export-asm/README.md
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts
    - src/mcp/vice/acme-verify.test.ts

key-decisions:
  - "The zero-page mid-instruction refusal's stated mechanism was MEASURED before it was written down, and the plan's parenthetical was too weak. The forward-reference case widens and emits `Using oversized addressing mode.` at exit 0 with the bytes UNCHANGED; the BACKWARD case with the width force dropped shrinks `ee 81 00` to `e6 81` at exit 0 with NO diagnostic at all. The comment and the refusal message record the stronger measured fact."
  - "\"The one hole `+2` does not close\" is stated in a precise, defensible sense: it is the one place this MODULE has no mitigation of its own. For an ordinary label the exporter owns the two-hex-digit header definition rule; a mid-instruction label is defined inline by construction and cannot use it, leaving a disasm-renderer.ts invariant this module does not own as the sole defence."
  - "Auto-generated names are MARKED with a fixed trailing comment, never filtered. Every store label reaches the source either way; the marker is routine-queue-walker's backlog signal carried into the one artefact that leaves this tree, and a comment cannot change a byte."
  - "The >$ff enum refusal checks EVERY variant of an enum bound to an immediate operand, not only the matched one. Checking only the match would make the refusal unreachable (a byte operand can never match a >$ff key), and the real modelling error is attaching a non-byte vocabulary to a byte operand."
  - "Only the MATCHED variant is defined in the header, not the whole vocabulary: an unreferenced definition is clutter a reader must discount, and every extra emitted symbol is one more chance to collide with a label name and turn a correct export into `Symbol already defined.`"
  - "Enum substitution is a targeted text replacement on this module's own rendered line, NOT a RenderOptions widening. D-11 forbids renderLine() from substituting into an immediate operand and is not relaxed; what an enum adds is a caller-supplied fact the renderer does not have, and the operand's width is one byte and cannot change."
  - "The header definition block is now BUILT after the block loop and EMITTED before it, because which labels are defined inline is only knowable once the code blocks have been decoded."
  - "RESEARCH.md assumption A5 refined: anno_label.name carries a `unique` DDL constraint on top of setLabel()'s guard, so a store-level duplicate plant can never reach ACME. The external observation is produced at the SOURCE-TEXT boundary -- the only place the duplicate can exist -- which still satisfies criterion 5, since criterion 5 asks the external oracle to confirm the internal one."

patterns-established:
  - "When a new emission decorates a line, tests that compared that line VERBATIM compare the part before the comment separator instead -- exact on the thing under test, tolerant of the decoration. Three such tests were repaired rather than loosened."
  - "A planted control is built FROM the parsed vocabulary (a five-prefix regex assembled from the real eleven), so the control is a genuine short copy rather than five names typed into the test."

requirements-completed: [EXPORT-02, EXPORT-03]

coverage:
  - id: D1
    description: "A committed fixture that GENUINELY self-modifies exports with its write target named by an inline mid-instruction label and reassembles byte-identically through real ACME"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#FIXTURE INTEGRITY: smc.prg genuinely self-modifies -- an `inc` writes to an earlier `lda #`'s own immediate operand byte, proved FROM THE BYTES"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#REGENERATOR AGREEMENT: re-assembling smc.a reproduces the committed smc.prg byte-for-byte"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a label strictly inside an instruction is emitted as `name =*+$NN` on the line IMMEDIATELY BEFORE its host, and is NOT restated in the header"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#ROUND TRIP: the self-modifying fixture reassembles BYTE-IDENTICALLY with its write target named by a mid-instruction label"
        status: pass
    human_judgment: false
  - id: D2
    description: "Placement is proved load-bearing: moving the inline definition after its host instruction changes the bytes while ACME still exits 0"
    requirement: "EXPORT-02"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#NEGATIVE CONTROL: moving the `=*+$01` line to AFTER its host instruction changes the bytes, and ACME exits 0 anyway"
        status: pass
    human_judgment: false
  - id: D3
    description: "A mid-instruction label below $0100 is refused by name, naming the label, the address and the floor"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a mid-instruction label below $0100 is REFUSED BY NAME rather than emitted"
        status: pass
    human_judgment: false
  - id: D4
    description: "The eleven typed prefixes are derived from AUTO_NAME_PREFIX_RE itself; a five-prefix reimplementation is caught, a comment-only mention is not, and `L_` stays absent with ASCII case-sensitive matching"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#the auto-name prefix set is parsed from AUTO_NAME_PREFIX_RE's own alternation: exactly eleven, `L_` absent, ASCII case-sensitive"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#STRUCTURAL SCAN, all three directions: the exporter imports the prefix regex, a planted five-prefix copy is reported, and a comment-only mention is NOT"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#every one of the parsed prefixes round-trips as a label name, is MARKED in the source, and `L_`/uppercase names are not counted"
        status: pass
    human_judgment: false
  - id: D5
    description: "Enums render on the IMMEDIATE operand only, byte-identically to the plain form; the wrong operand is refused by the exporter and refused again at the source-text boundary"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#an enum on an IMMEDIATE operand renders as `#<enum>_<VARIANT>`, defines the variant in the header, and produces the SAME bytes as the plain form"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#an enum bound to a NON-IMMEDIATE operand is REFUSED by name, naming the address and the operand role"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#WRONG-OPERAND CONTROL: hand-moving the enum symbol onto a following `sta` is REFUSED at the source-text boundary"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#an enum usage with no decoded instruction at its address is REFUSED by name, never silently dropped"
        status: pass
    human_judgment: false
  - id: D6
    description: "An enum variant above $ff on an immediate operand is refused by the exporter, and real ACME independently refuses the same shape with `Number does not fit in 8 bits.` at exit 1"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#an enum carrying a variant above $ff is REFUSED for an immediate operand, and real ACME refuses the same shape with `Number does not fit in 8 bits.`"
        status: pass
    human_judgment: false
  - id: D7
    description: "All 256 opcodes export in one image and reassemble byte-identically in a single ACME invocation; every acmeExpressible:false entry goes out as `!byte` with a naming comment, driven from the OPCODES table"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#ALL 256 OPCODES: every `acmeExpressible: false` entry goes out as `!byte` with a naming comment, and the whole export reassembles byte-identically"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#the `!byte` note vocabulary matched below is really present in disasm-renderer.ts (so this file cannot pass for the wrong reason)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The store refuses a duplicate label name bound to a different address, and real ACME confirms the same duplicate at the source-text boundary with `Symbol already defined.` and exit 1"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#the store's duplicate-label refusal wording asserted below is really present in anno-store.ts (so this file cannot pass for the wrong reason)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#INTERNAL REFUSAL: setLabel() refuses a name already bound to a DIFFERENT address, and does NOT refuse the same name at the same address"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#EXTERNAL ORACLE: real ACME refuses the same duplicate at the source-text boundary with `Symbol already defined.` and exit 1"
        status: pass
    human_judgment: false
  - id: D9
    description: "The empty-input cases: an empty label set, an empty enum set and a single-element range each export and reassemble byte-identically"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#a store with ZERO labels emits no symbol definitions and renders every operand as a hex literal, and still round-trips"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#a store with an EMPTY enum set still reassembles byte-identically -- an exporter that only works on a richly annotated store fails on a fresh project"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-export-asm.test.ts#a SINGLE-ELEMENT range -- one byte, one instruction -- exports bracketed and reassembles byte-identically"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-08-30
status: complete
---

# Phase 30 Plan 04: Load-Bearing Idioms and the Real-ACME Oracle Summary

**A committed C64 program that rewrites its own `lda` operand now exports with that operand named by an inline `=*+$01` label and reassembles byte-identically; the eleven auto-name prefixes are read from `AUTO_NAME_PREFIX_RE` with a three-direction scan that catches a five-prefix copy; enums render on the immediate operand only; and all 256 opcodes round-trip in one ACME invocation with real ACME confirming the store's duplicate-label refusal.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-30T22:16:37Z
- **Completed:** 2026-08-30T22:51:06Z
- **Tasks:** 3 (plus one follow-up commit closing the remaining empty-input truth)
- **Files modified:** 7 (3 modified, 4 created)

## Accomplishments

- `src/mcp/vice/fixtures/export-asm/` — a committed program that genuinely self-modifies (`inc $0802` rewrites the immediate operand of the `lda #$00` at `$0801`), its ACME source, a refusing regenerator and a provenance README. The self-modification is asserted **from the bytes**, not from the filename.
- Mid-instruction labels emitted inline, immediately before their host instruction, excluded from the header block, counted in `midInstructionLabelCount`, and refused by name below `$0100`.
- `anno-export-asm.ts` is now the **first cross-module production importer** of `AUTO_NAME_PREFIX_RE`, marking every auto-generated symbol definition in the emitted source so `routine-queue-walker`'s backlog stays visible in the one artefact that leaves this tree.
- A structural scan with **one shared predicate and three directions**: the real source clean, a planted five-prefix regex reported, and the same text in a comment **not** reported.
- Enum substitution confined to the immediate operand, with four by-name refusals (wrong operand role, variant above `$ff`, no variant for the value, no decoded instruction at the address).
- One image covering all 256 opcodes, exported as one code range and verified in **one** ACME invocation: 546 payload bytes, `byteDiff.equal === true`, all 35 `acmeExpressible: false` entries out as `!byte`.
- Real ACME confirming the store's duplicate-label refusal at the source-text boundary.

## Task Commits

1. **Task 1: the `=*+$01` idiom on a fixture that genuinely self-modifies** — `4603788` (feat)
2. **Task 2: the eleven typed prefixes from their one home, and enums on the immediate operand only** — `cd51f2e` (feat)
3. **Task 3: every inexpressible opcode as `!byte`, and real ACME confirming the duplicate-label refusal** — `2d741cd` (test)
4. **Follow-up: the remaining empty-input truth (empty enum set, single-element range)** — `807393b` (test)

## Files Created/Modified

- `src/mcp/vice/fixtures/export-asm/smc.a` — the ACME source; self-modifying by construction, with the criterion-3 distinction stated in its header
- `src/mcp/vice/fixtures/export-asm/smc.prg` — 13 bytes: load address `01 08`, then `a9 00 / ee 02 08 / 8d 20 d0 / 4c 01 08`
- `src/mcp/vice/fixtures/export-asm/make-export-asm-fixtures.mjs` — the regenerator; probes `ACME_BIN` first and exits non-zero without touching `smc.prg` if the assembler is missing, refuses the source, or writes no output
- `src/mcp/vice/fixtures/export-asm/README.md` — provenance table, "these are real assembler outputs", the byte layout, "what this fixture proves", and the regeneration command
- `src/mcp/vice/anno-export-asm.ts` — `midInstructionLabelLine()`, the inline-label emitter and its zero-page refusal, the `AUTO_NAME_PREFIX_RE` import and marker, enum substitution and its four refusals, three new `ExportAsmResult` fields
- `src/mcp/vice/anno-export-asm.test.ts` — 23 new tests; `verifyExport()` generalised to `verifyExportText(result, source)`
- `src/mcp/vice/acme-verify.test.ts` — one assertion updated to compare the definition rather than the whole line (see Deviations)

## Raw negative-control observations

### SMC placement (Task 1)

The export, verbatim:

```
!cpu 6510
entry = $0801
* = $0801
!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }
smc_operand =*+$01
        lda #$00
        inc smc_operand
        sta $d020
        jmp entry
!if * != $080c { !error "export-asm: block end drifted, expected $080c" }
```

With the `smc_operand =*+$01` line moved to immediately **after** its host:

```
outcome     = failed
exitStatus  = 0
byteDiff    = {"equal":false,"firstDifferingOffset":3,"expectedLength":11,"actualLength":11}
reason      = assembled bytes differ from the expected bytes: first differing byte offset 3, expected length 11, actual length 11.
diagnostics = ["export.a(8) : Warning (Zone <untitled>): Wrong type - expected address.",
               "export.a(9) : Warning (Zone <untitled>): Wrong type - expected address."]
resultLines = ["Segment size is 11 (0xb) bytes (0x801 - 0x80c exclusive)."]
```

**ACME accepted both placements at exit 0.** The instruction's length is unchanged, so the per-block `*` assertions cannot fire and the segment line is identical. Offset 3 from `$0801` is `$0804` — the low byte of the `inc` operand, which now names the *next* instruction's operand instead of the `lda`'s. Only the byte-diff told them apart.

### Enum wrong-operand (Task 2)

The export:

```
!cpu 6510
viccolor_BLACK = $00
entry = $0801
* = $0801
!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }
        lda #viccolor_BLACK
        sta $d020
        rts
!if * != $0807 { !error "export-asm: block end drifted, expected $0807" }
```

With the symbol hand-moved off the immediate operand and onto the following `sta`:

```
outcome     = failed
exitStatus  = 1
byteDiff    = null
reason      = ACME reported a fatal diagnostic: export.a(9) : Error (Zone <untitled>): !error: export-asm: block end drifted, expected $0807
diagnostics = ["export.a(7) : Warning (Zone <untitled>): Wrong type - expected address.",
               "export.a(9) : Error (Zone <untitled>): !error: export-asm: block end drifted, expected $0807"]
resultLines = ["Segment size is 5 (0x5) bytes (0x801 - 0x806 exclusive)."]
```

**The rule that produced the verdict was plan 30-03's per-block `*` end assertion, not the byte-diff — exactly the pre-emption the plan anticipated.** `viccolor_BLACK` is `$00`, so `sta viccolor_BLACK` re-encodes as **zeropage**: ACME's own segment line reports **5 bytes where the export declared 6**. That is a *stronger* catch than the byte-diff, since ACME exits 1 and writes no output file at all (`byteDiff` is `null` because nothing was assembled to compare). The `*` assertion was **not** silenced to manufacture an exit-0 observation. The test asserts `outcome === "failed"` unconditionally and branches on the observed `exitStatus`, asserting the `*` message at 1 and the byte-diff at 0.

### Duplicate symbol, verbatim from real ACME (Task 3)

```
exit         = 1
outputExists = false
stderr       = "dup.a(3) : Error (Zone <untitled>): Symbol already defined.\n"
```

(The `--msvc` spelling, matching RESEARCH.md Pitfall 9's measurement. The full path is elided above; the run used a temp file.)

### 256-opcode export (Task 3)

```
payload bytes          = 546
acmeExpressible:false  = 35   (computed from OPCODES in the same test, never pinned)
unexpressibleCount     = 35
!byte lines emitted    = 35
outcome                = ok
byteDiff               = {"equal":true,"firstDifferingOffset":null,"expectedLength":546,"actualLength":546}
resultLines            = ["Segment size is 546 (0x222) bytes (0x1000 - 0x1222 exclusive)."]
```

Sample `!byte` lines, showing the mnemonic and the fixed note vocabulary in the trailing comment:

```
        !byte $12  ; jam  [illegal opcode | not expressible in ACME !cpu 6510]
        !byte $1a  ; nop  [illegal opcode | not expressible in ACME !cpu 6510]
        !byte $2b, $00  ; anc #$00  [illegal opcode | not expressible in ACME !cpu 6510]
```

### The zero-page mid-instruction hazard, measured (Task 1)

The plan's parenthetical said "ACME reports only a Warning and exits 0". Measured on ACME 0.97, a label at `$0081` named by an earlier `lda #$00` at `$0080`:

| Source | Bytes | Exit | Diagnostic |
|---|---|---|---|
| `inc+2 smc_operand` (backward reference, force intact) | `ee 81 00` | 0 | none |
| `inc smc_operand` (backward reference, force dropped) | **`e6 81`** | 0 | **none at all** |
| `inc smc_operand` before the definition (forward reference) | `ee 84 00` | 0 | `Using oversized addressing mode.` |

The backward case is **worse** than the plan expected: two bytes where the original was three, silently, with no diagnostic whatsoever. The exporter's refusal message and its comment record the measured fact rather than the weaker one.

## Decisions Made

See `key-decisions` in the frontmatter. The two most consequential:

- **The `+2` "hole" is stated precisely.** On the current renderer a mid-instruction label below `$0100` does **not** produce an observable byte shift, because `disasm-renderer.ts`'s `+2` force holds the width for absolute operands and D-11 never substitutes into zeropage ones. The refusal is therefore *conservative*, and the comment says so in the defensible sense: it is the one place this **module** has no mitigation of its own (its two-hex-digit header rule cannot apply to a label defined inline) and depends entirely on an invariant it does not own. Refusing by name is cheaper than depending on another module's rule staying still.
- **The `>$ff` enum check is over every variant, not the matched one.** Checking only the match would make the refusal unreachable — a byte operand can never match a key above `$ff` — so the check would have been dead code paired with a live ACME oracle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three prior tests compared a symbol-definition line verbatim and broke on the new auto-name marker**

- **Found during:** Task 2 (wiring `AUTO_NAME_PREFIX_RE`)
- **Issue:** `zpf_90` and `zpf_10` match the auto-name prefix set, so their definition lines now carry the fixed trailing marker comment. Three assertions written before that emission existed compared the whole line: `anno-export-asm.test.ts`'s width test and its PLANTED VIOLATION 2 string surgery, and `acme-verify.test.ts`'s own width test. PLANTED VIOLATION 2 was the dangerous one — its `.replace("zpf_90 = $90\n", "")` silently matched nothing, leaving the source unmodified so the "violation" would have passed for the wrong reason.
- **Fix:** Added a `definitionOf(lines, name)` helper that splits the trailing comment off and compares the definition **exactly**; PLANTED VIOLATION 2 now reads the definition line out of the export instead of retyping it, so the surgery cannot silently no-op.
- **Files modified:** `src/mcp/vice/anno-export-asm.test.ts`, `src/mcp/vice/acme-verify.test.ts`
- **Verification:** all three tests red before the fix, green after; `npm run test:automated` back to its one known worktree failure
- **Committed in:** `cd51f2e`

**2. [Rule 2 - Missing Critical] An enum usage with no decoded instruction at its address was not covered by the plan's refusal list**

- **Found during:** Task 2 (Part C)
- **Issue:** The plan specifies refusing a non-immediate operand role, but an enum usage at an address inside an instruction, or inside a data range, or outside every range, has no operand role at all — the naive implementation would have dropped it silently while the export reported success, which the plan's own prohibitions forbid.
- **Fix:** Track applied usages and refuse any unapplied one by name after the block loop, in the same shape the comment-placement refusal already uses.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** a usage at `$0802` (an operand byte) throws naming that address
- **Committed in:** `cd51f2e`

**3. [Rule 1 - Correctness] The plan's refusal wording for the zero-page mid-instruction case overstated one measurement and understated another**

- **Found during:** Task 1
- **Issue:** The specified message says "(measured: ACME reports only a Warning and exits 0)". That describes the *forward*-reference case, whose bytes are in fact unchanged; the case that actually shifts bytes is the *backward* reference with the width force dropped, which emits **no diagnostic at all**.
- **Fix:** Measured all three variants against real ACME (table above) and wrote the stronger, measured fact into both the code comment and the refusal message. The message no longer claims a Warning.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`
- **Verification:** the three live ACME runs recorded above
- **Committed in:** `4603788`

**4. [Rule 3 - Blocking] Two prose fragments made a plan acceptance criterion's grep return 3 instead of the intended 1**

- **Found during:** Task 1 acceptance check
- **Issue:** The criterion requires every `=*+$` occurrence in `anno-export-asm.ts` to be inside `midInstructionLabelLine`. Two were prose — a doc-comment fragment and an error-message fragment.
- **Fix:** Reworded both to describe the idiom rather than spell it, and the error message now names `midInstructionLabelLine()`'s role instead. The grep returns exactly one occurrence, inside the helper.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts`
- **Verification:** `grep -v '^\s*//' anno-export-asm.ts | grep -v '^\s*\*' | grep -n '=\*+\$'` returns one line, the helper's `return`
- **Committed in:** `4603788` (folded in before the commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 correctness)
**Impact on plan:** No scope creep. Three were consequences of this plan's own new emission or of a plan-specified message that measurement contradicted; one added a refusal the plan's prohibitions require but its refusal list omitted.

## Issues Encountered

- **`npm run test:automated` reports 1 failure, and it is the known worktree artefact already recorded in `deferred-items.md` by plan 30-01.** `repo-root.test.ts`'s path-agreement test asserts the resolved supervisor directory does not sit under `.claude`; a GSD worktree lives at `.claude/worktrees/agent-*/`, so `.git` is a file there, the `.git`-walk stops at the worktree root, and the assertion fires. It is deterministic, unrelated to this plan (nothing here touches `repo-root.ts`, `resources/` or the launcher), and was confirmed green in the main checkout during 30-01. **Every other test passes: 2857 pass, 1 fail, 1 skip.**
- `node scripts/check-npm-packages.mjs` was run explicitly to confirm the new `fixtures/export-asm/` directory does not leak into either published tarball: `OK — @henols/vice-mcp 79 files, @henols/c64-re-tools 34 files, 7 skills`, with "excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)".
- **`REQUIREMENTS.md` was not edited.** `gsd-core/` is a gitignored vendored install and is not present inside the worktree, so `requirements.ready-ids` / `requirements.mark-complete` could not be run here. Plan 30-03 left the same two IDs `Pending` for the same reason. Both `EXPORT-02` and `EXPORT-03` are ready by the shared-ID rule — `EXPORT-02` is declared only by this plan, and `EXPORT-03`'s other declarers (30-01, 30-02, 30-03) all have summaries — so the orchestrator's post-merge sync can mark both.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ExportAsmOptions` and `exportAsm()`'s signature are **unchanged**, as the plan required. Plan 30-05's CLI verb binds to them safely; the three new `ExportAsmResult` fields (`midInstructionLabelCount`, `autoNamedSymbolCount`, `enumSubstitutionCount`) are additive only.
- `verifyExportText(result, source)` is now the file's single `verifyAcmeAssembles()` call site (comment-stripped `grep -c` returns `1`, as plan 30-03 required); `verifyExport(result)` is a one-line delegation. Later plans that need to verify mutated text should call `verifyExportText` rather than adding a second call site.
- The 256-opcode suite adds ~0.1s: the whole file runs in **0.9s**, far inside the plan's 60-second budget.
- No stubs, no skipped tests, no unrun `<verify>` commands.

## Self-Check: PASSED

- All four created files present on disk: `smc.a`, `smc.prg`, `make-export-asm-fixtures.mjs`, `README.md` under `src/mcp/vice/fixtures/export-asm/`, plus this summary.
- All four task commits present in `git log`: `4603788`, `cd51f2e`, `2d741cd`, `807393b`. (This summary's own `docs(30-04)` commit is deliberately not cited by hash — it is the commit that carries this line.)
- Every task `<acceptance_criteria>` re-run and passing (source greps, byte checks, ACME runs).
- Plan-level `<verification>` re-run: `npm run typecheck` exits 0; `VICE_REQUIRE_ACME=1 node --test anno-export-asm.test.ts` exits 0 (56 pass, 0 fail, 0.9s); `npm run test:automated` reports 1 failure, the known worktree artefact recorded in `deferred-items.md`; `node fixtures/export-asm/make-export-asm-fixtures.mjs` re-run leaves `git status --porcelain src/mcp/vice/fixtures/export-asm` empty.

---
*Phase: 30-acme-export-and-the-real-acme-oracle*
*Completed: 2026-08-30*
