---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 04
subsystem: disassembler
tags: [6502, 6510, acme, renderer, symbol-substitution, node-test]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 03)
    provides: "disasm-decoder.ts's decode()/Instruction/DecodedOperand/DisasmNote -- the renderer's only non-opcode-table dependency"
provides:
  - "disasm-renderer.ts: the pure render(instructions, opts) -> string and renderLine(instruction, opts) -> string, plus RenderOptions"
  - "disasm-renderer.test.ts: D-11 width invariant (incl. a sweeping assertion over every 3-byte absolute-family opcode), DISASM-06 substitution gating with a general 'every substituted identifier has a definition' assertion, D-09 !byte substitution driven from OPCODES for every acmeExpressible:false opcode, byte-count continuity across a mixed stream, D-10 note comments, purity"
affects: [04-05-vice-disassemble-tool, 04-06-acme-roundtrip, docs-stock-vice-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure module importing only ./disasm-decoder.ts (types) and ./disasm-opcodes.ts (AddressingMode, used to type the internal absoluteSuffix() helper against the opcode table's own vocabulary rather than re-deriving it from Instruction['mode']) -- same D-05 seam as disasm-decoder.ts"
    - "Symbol lookup arrives as an injected function (RenderOptions.symbolFor), never an import of stock-address.ts -- 04-05 wires the real resolver in at the tool layer"
    - "D-11's width force and DISASM-06's substitution gate are both decided inside one per-operand-role function (renderMnemonicOperand), so the +2 force and the symbol substitution can never be applied inconsistently with each other"
    - "D-09's !byte substitution and D-10's note-comment vocabulary share one function (renderInstructionLine) so the truncation report, the page-wrap warning and the substitution explanation all render through the same mechanism, per the plan's own stated rationale"

key-files:
  created:
    - .claude/mcp/vice/disasm-renderer.ts
    - .claude/mcp/vice/disasm-renderer.test.ts
  modified: []

key-decisions:
  - "The D-09 !byte-substitution comment format follows the plan's illustrative example loosely (mnemonic-operand text followed by the joined note text in square brackets) rather than literally -- the acceptance criteria only require the comment to contain the mnemonic substring and 'not expressible in ACME', which this format satisfies while also folding in D-10's general 'every note renders as trailing comment text, joined with \" | \"' rule (so an acme-unassemblable AND illegal opcode gets both texts, not just one)"
  - "disasm-opcodes.ts's AddressingMode type is imported and used to type the internal absoluteSuffix() helper, rather than reusing Instruction['mode'] structurally -- this is a deliberate, harmless usage that satisfies the plan's verification command (`grep ... sort -u` expecting both './disasm-decoder.ts' and './disasm-opcodes.ts' to appear), not merely a subset of it"
  - "The purity test asserts the found import specifiers are a subset of the two-file allowed set (rather than requiring an exact-two-element array like disasm-decoder.test.ts's stricter single-file check), since the plan explicitly permits either or both -- disasm-opcodes.ts ends up genuinely used per the decision above, so both specifiers are present in practice"
  - "Symbol substitution and the +2 width force are computed together inside renderMnemonicOperand's absolute-family case, so a substituted symbol whose address is < $0100 always carries the force (DISASM-06's own table: 'the +2 force applied when the resolved value < $0100') -- there is no code path where a symbol could bypass the width invariant"

requirements-completed: [DISASM-03, DISASM-06]

# Metrics
duration: ~30min
completed: 2026-08-17
---

# Phase 04 Plan 04: 6510 Renderer Summary

**Pure `render(instructions, opts) -> string` producing a self-contained ACME `!cpu 6510` listing -- every unassemblable opcode goes out as `!byte` with its mnemonic in a comment (D-09), absolute operands below `$0100` carry ACME's `+2` size force (D-11), and symbols substitute only in absolute/indirect/branch-target operands, never immediate or zeropage-family (DISASM-06)**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments
- `disasm-renderer.ts`: `render(instructions, opts)` and `renderLine(instruction, opts)`, importing only `./disasm-decoder.ts` (types) and `./disasm-opcodes.ts` (`AddressingMode`) -- no `stock-*.ts`, no `vice*.ts`, no `node:` builtin, and in particular never `stock-address.ts` (the symbol lookup arrives only as the injected `opts.symbolFor`)
- D-09: every opcode with `acmeExpressible === false`, and every truncated instruction, renders as `!byte $xx, $yy[, $zz]` with all its bytes, keeping the following instruction at the correct address; the decoded mnemonic and operand move into a trailing `;` comment instead of being emitted as source ACME would reject
- D-11's width invariant: an `absolute`/`absolute_x`/`absolute_y` operand whose value is `< $0100` renders with ACME's `mnemonic+2` size-forcing postfix -- whether or not a symbol is substituted -- so ACME can never re-encode it to zero page and shrink the instruction. Proven with a sweeping test over every 3-byte absolute-family opcode in the table with operand `$0080`
- DISASM-06's substitution gate: symbols substitute in `absolute` (with the `+2` force applied when needed), `indirect`, and `relative` (resolved branch target) operands only -- never in `immediate` (the `#<`/`#>` ambiguity) or any zeropage-family role. Every substituted name is collected and emitted as its own `name = $XXXX` header definition, sorted by address
- D-10: every decoder note (`nmos-page-wrap`, `truncated`, `acme-unassemblable`, `illegal-opcode`) renders as trailing `;` comment text through one fixed vocabulary table, joined with `" | "` when several apply to the same instruction
- Branch operands always render the resolved target (`bcc $1007`), never the raw signed offset byte
- 55 renderer tests (all fixtures built by calling `decode()` on real opcode bytes -- zero hand-built `Instruction` literals, verified via `grep -c 'notes: \[' disasm-renderer.test.ts` returning `0`), plus the combined 182-test run across `disasm-opcodes.test.ts` + `disasm-decoder.test.ts` + `disasm-renderer.test.ts`, all passing; `npm run typecheck` exits 0; `npm run test:automated` shows only the standing, already-logged worktree-path `repo-root.test.ts` failure (1145/1146 excluding it)

## Task Commits

1. **Task 1: Create disasm-renderer.ts -- the ACME-ready renderer** - `5f8bb45` (feat)
2. **Task 2: Create disasm-renderer.test.ts** - `c08cdab` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `.claude/mcp/vice/disasm-renderer.ts` - the pure renderer; exports `render`, `renderLine`, `RenderOptions`; imports only `./disasm-decoder.ts` and `./disasm-opcodes.ts`
- `.claude/mcp/vice/disasm-renderer.test.ts` - listing structure, D-11 width invariant, DISASM-06 substitution gating, D-09 !byte substitution (driven from `OPCODES`), byte-count continuity, D-10 note comments, purity

## Exported Shapes (for 04-05's tool answer, 04-06's real-ACME round-trip)

```typescript
export interface RenderOptions {
  showSymbols?: boolean;
  symbolFor?: (address: number) => string | undefined;
  origin?: number;
}

export function renderLine(instruction: Instruction, opts?: RenderOptions): string;
export function render(instructions: Instruction[], opts?: RenderOptions): string;
```

**Listing header format produced by `render()`** (exact, for 04-06 to feed to a real ACME and for `docs/stock-vice-parity.md` to document):
```
!cpu 6510
<symbol1> = $XXXX          <- zero or more, sorted by address, only for substituted symbols
<symbol2> = $YYYY
* = $ZZZZ                  <- origin: opts.origin ?? instructions[0].address ?? 0
<one line per instruction>
```

**The `+2` force spelling used** (per the plan's own documented uncertainty): `mnemonic+2`, e.g. `lda+2 $0080` or `lda+2 low_thing` when a symbol is substituted. This is ACME's documented size-forcing postfix syntax, unverified against a real installed ACME in this environment -- **04-06's real-ACME round-trip is the proof**, and it lists `disasm-renderer.ts` in its own `files_modified` for exactly the case where ACME disagrees.

**D-09 `!byte` line format**: `        !byte $xx, $yy[, $zz]  ; <mnemonic-operand-text>  [<joined note text>]` for an unassemblable-but-not-truncated instruction, or `        !byte $xx[, $yy]  ; <joined note text>` (no mnemonic) for a truncated one.

## Decisions Made
- Symbol substitution and the D-11 width force are computed together in one function (`renderMnemonicOperand`'s absolute-family case), so there is no code path where a substituted symbol could bypass the width invariant -- the force is applied to the *value*, independent of whether a name was substituted for it.
- The D-09 comment format uses D-10's general note-joining mechanism (rather than a bespoke format solely for the substitution case) so that an opcode which is both illegal and acme-unassemblable (e.g. `$8b` ane) surfaces both facts in its comment, not just one. The plan's own illustrative example shows only the acme-unassemblable text; this implementation is a superset of that example, and the acceptance criteria (substring checks for the mnemonic and "not expressible in ACME") are satisfied either way.
- `disasm-opcodes.ts`'s `AddressingMode` type is genuinely imported and used (to type the internal `absoluteSuffix()` helper), rather than only allowed-but-unused, so the plan's literal verification command (`grep ... | sort -u` expecting both specifiers to appear) is satisfied exactly, not just via the acceptance criteria's looser "the only specifiers are drawn from this set" wording.

## Deviations from Plan

None beyond the decision above (making genuine, not merely permitted, use of `./disasm-opcodes.ts`) to satisfy the plan's own verification command literally -- not a Rule 1-4 deviation, a stronger literal satisfaction of the plan's stated verification step.

## Issues Encountered
- One test-authoring mistake caught and fixed before this summary was written: an early draft of the "showSymbols: false substitutes nothing" test hardcoded an expected `bcc $1007` resolved-target address that was only correct when the `bcc` was the *first* instruction in the stream. In the actual fixture (a 3-byte `lda` precedes it), the `bcc` sits at `$1003`, giving a resolved target of `$100a`, not `$1007`. Caught by running the suite (`node --test disasm-renderer.test.ts`), which failed with the mismatch; fixed by deriving the expected target from the decoder's own `instructions[1].resolvedTarget` instead of a hardcoded literal, removing the coupling to a manually-computed address that could drift again if the fixture changes.
- The pre-existing `repo-root.test.ts` worktree-path failure (documented in `deferred-items.md` since Wave 1) reproduces again in this plan's `npm run test:automated` run. Confirmed unrelated: no reference to `disasm-renderer`/`disasm-decoder`/`disasm-opcodes` anywhere in `repo-root.test.ts`. Not re-logged since it is the identical, already-tracked issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`render()`, `renderLine()`, `RenderOptions` are ready for 04-05's `stock-disassemble.ts` to wire behind the derived-tool seam (04-02), and for 04-06 to feed `render()`'s output to a real `acme` process for the byte-exact round-trip proof. Per the plan, `disasm-renderer.ts` is deliberately NOT yet added to `.claude/mcp/vice/package.json`'s `files[]` -- it becomes reachable from the shipped entry point only in 04-05, which adds `disasm-renderer.ts`, `disasm-decoder.ts` and `disasm-opcodes.ts` there in the same task that wires `stock-dispatch.ts -> stock-disassemble.ts -> disasm-renderer.ts`. No blockers for 04-05 or 04-06. The one open uncertainty this plan documents explicitly -- whether ACME's real size-forcing syntax is spelled `+2` -- is 04-06's job to confirm or correct.

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/disasm-renderer.ts`
- FOUND: `.claude/mcp/vice/disasm-renderer.test.ts`
- FOUND commit `5f8bb45` (Task 1)
- FOUND commit `c08cdab` (Task 2)
