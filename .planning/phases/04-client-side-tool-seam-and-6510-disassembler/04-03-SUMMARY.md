---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 03
subsystem: disassembler
tags: [6502, 6510, decoder, branch-resolution, nmos-page-wrap, node-test]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 01)
    provides: "disasm-opcodes.ts's OPCODES/OpcodeEntry/AddressingMode/LENGTH_FOR_MODE -- the decoder's only import"
provides:
  - "disasm-decoder.ts: the pure decode(bytes, startAddress, opts) -> Instruction[] function, plus the Instruction/DecodedOperand/DisasmNote/DecodeOptions types"
  - "disasm-decoder.test.ts: DISASM-04 branch resolution, DISASM-05 truncation, page-wrap note, drop-past-end/over-read-by-two, opts.count, all-256 length invariant (checked against LENGTH_FOR_MODE, not tautologically against entry.length), never-throws fuzz, purity"
affects: [04-04-renderer, 04-05-vice-disassemble-tool, 04-06-acme-roundtrip, phase-5-backtrace, phase-6-cpuhistory-decode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure module importing only its one sibling data table, no transport/no I/O -- same D-05 seam as disasm-opcodes.ts"
    - "Notes vocabulary is a closed string-literal union (DisasmNote), pushed in a fixed deterministic order (truncated, nmos-page-wrap, illegal-opcode, acme-unassemblable) so downstream renderer/round-trip output is stable"
    - "Optional object fields (operand, resolvedTarget) are omitted via conditional spread rather than set to `undefined`, so 'omitted' in the plan's acceptance criteria means an absent key, not a present-but-undefined one"
    - "All-256 length-invariant test checks decoder output against LENGTH_FOR_MODE[entry.mode] (an independent ground truth), not against entry.length itself -- comparing against entry.length would be tautological since the decoder always consumes exactly entry.length bytes by construction"

key-files:
  created:
    - .claude/mcp/vice/disasm-decoder.ts
    - .claude/mcp/vice/disasm-decoder.test.ts
  modified: []

key-decisions:
  - "notes ordering is fixed as [truncated, nmos-page-wrap, illegal-opcode, acme-unassemblable] per the plan's rule-numbered list (rules 3, 7, 8), applied identically whether or not the instruction is truncated -- illegal-opcode/acme-unassemblable are opcode-byte facts, known even when the operand is truncated"
  - "opts.count/opts.end validated with isNonNegativeSafeInteger (Number.isSafeInteger + >=0), not merely Number.isInteger, so an 'absurd' huge-but-technically-integer value is also treated as absent rather than accepted"
  - "operand and resolvedTarget are attached via conditional object-spread (...(x !== undefined ? {x} : {})) so 'omitted' means the key is genuinely absent, not present-with-undefined-value -- verified via 'operand' in instr === false in the truncation suite"
  - "Suite 6 (all-256 length invariant) asserts against LENGTH_FOR_MODE[entry.mode], not entry.length -- corrupting an entry's length while leaving its mode alone (e.g. brk implicit length 1->2) is caught by this design and was NOT caught by an entry.length-vs-entry.length comparison; verified live by corrupting disasm-opcodes.ts's $00 entry, confirming suite 6 failed with the exact mismatch, then reverting to a byte-identical file (diff confirmed clean)"

requirements-completed: [DISASM-02, DISASM-04, DISASM-05]

# Metrics
duration: ~35min
completed: 2026-08-17
---

# Phase 04 Plan 03: 6510 Decoder Summary

**Pure `decode(bytes, startAddress, opts) -> Instruction[]` resolving DISASM-04 branch/jump targets, DISASM-05 truncation without fabrication, and the `JMP ($xxFF)` NMOS page-wrap note -- importing nothing but the Phase 04-01 opcode table**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments
- `disasm-decoder.ts`: a single bounded `while` loop (no recursion, `T-04-03-01`) that decodes a byte stream into `Instruction[]`, resolving all eight conditional branches and `jmp`/`jsr` absolute to an absolute `resolvedTarget` wrapped at 16 bits, while preserving the raw operand byte
- DISASM-05 truncation: a partial instruction at the end of a range reports only the bytes that exist, omits `operand`/`resolvedTarget` (as an absent key, not an explicit `undefined`), carries `notes: ["truncated"]`, and never invents a missing byte
- D-10's `JMP ($xxFF)` NMOS page-wrap note, scoped to exactly opcode `$6C` with pointer low byte `$FF` -- proven, not just spot-checked, by decoding a synthetic stream of all 256 opcodes and asserting no other opcode ever emits the note
- `opts.end`'s drop-past-end rule and the roadmap's over-read-by-two allowance (an instruction starting at or before `end` is emitted in full even when its trailing bytes lie numerically past `end`), and `opts.count`'s cap
- The all-256 length invariant (criterion 2) checked against `LENGTH_FOR_MODE[entry.mode]` -- an independent ground truth deliberately *not* `entry.length` itself, which would be a tautological check since the decoder always consumes exactly `entry.length` bytes by construction. Verified live: corrupted `disasm-opcodes.ts`'s `$00` entry's length from 1 to 2 (mode left as `implicit`), reran `disasm-decoder.test.ts`, confirmed exactly one failure (`$00: byte length disagrees with LENGTH_FOR_MODE[implicit] -- 2 !== 1`), then reverted and confirmed the file is byte-identical to its pre-corruption state (`diff` clean)
- A deterministic xorshift32-seeded fuzz suite (200 pseudo-random inputs, no `Math.random()`) proving `decode()` never throws, plus explicit degenerate-input assertions (`undefined` bytes, empty array, negative/non-integer `startAddress`)
- 72 decoder tests + 56 opcode-table tests (128 combined) pass; `npm run typecheck` exits 0; the standing `npm run test:automated` regression gate shows the one pre-existing, unrelated worktree-path failure already logged in `deferred-items.md` from Wave 1 (`repo-root.test.ts`), and otherwise passes (1090/1091 excluding that known issue)

## Task Commits

1. **Task 1: Create disasm-decoder.ts -- the pure decoder** - `7633b66` (feat)
2. **Task 2: Create disasm-decoder.test.ts** - `d0bb95c` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `.claude/mcp/vice/disasm-decoder.ts` - the pure decoder; exports `decode`, `Instruction`, `DecodedOperand`, `DisasmNote`, `DecodeOptions`; imports only `./disasm-opcodes.ts`
- `.claude/mcp/vice/disasm-decoder.test.ts` - branch resolution, truncation, page-wrap, end/count boundary, all-256 length invariant, never-throws fuzz, purity suites

## Exported Shapes (for 04-04's renderer, 04-05's answer schema, Phase 5's DERIV-02, Phase 6's GAIN-01)

```typescript
export type DisasmNote = "nmos-page-wrap" | "truncated" | "acme-unassemblable" | "illegal-opcode";

export interface DecodedOperand {
  role: "immediate" | "zeropage" | "absolute" | "relative" | "indirect";
  value: number;   // as encoded; for "relative" this is the RAW signed offset byte, not the resolved address
  width: 1 | 2;     // always entry.length - 1
}

export interface Instruction {
  address: number;              // wrapped at 16 bits: (startAddress + offset) & 0xffff
  bytes: number[];               // every byte actually consumed, including a partial instruction's real bytes
  opcode: number;
  mnemonic: string;
  mode: AddressingMode;          // re-exported from disasm-opcodes.ts
  illegal: boolean;
  acmeExpressible: boolean;
  operand?: DecodedOperand;      // ABSENT (not undefined-valued) for implicit/accumulator modes and for truncated instructions
  resolvedTarget?: number;       // ABSENT unless mode is "relative", or opcode is jmp/jsr absolute ($4C/$20)
  notes: DisasmNote[];           // always present, possibly empty; fixed order: truncated, nmos-page-wrap, illegal-opcode, acme-unassemblable
}

export interface DecodeOptions {
  count?: number;  // caps the number of instructions returned
  end?: number;    // instructions starting past `end` are dropped entirely; one starting at/before `end` is emitted in full even if its tail lies past `end`
}

export function decode(bytes: Uint8Array, startAddress: number, opts: DecodeOptions = {}): Instruction[];
```

**Important consumer note:** `operand` and `resolvedTarget` are genuinely absent keys when not applicable (verified via `"operand" in instr === false`, not `instr.operand === undefined`) -- a consumer using `Object.keys()`/`JSON.stringify()` will not see these keys at all rather than seeing them serialize as `null`/omitted-by-JSON-quirk.

## Decisions Made
- `notes` order is fixed exactly as the plan's rule list specifies: `"truncated"` (rule 3) first, then `"nmos-page-wrap"` (rule 7), then `"illegal-opcode"`/`"acme-unassemblable"` (rule 8) -- applied uniformly whether or not the instruction is truncated, since the illegal/acme-unassemblable flags are facts about the opcode byte itself (always known), not about the operand.
- Argument narrowing (`startAddress`, `opts.count`, `opts.end`) uses `Number.isSafeInteger(...) && value >= 0`, stricter than plain `Number.isInteger`, so "absurd" (non-safe-integer) values are also treated as absent per the plan's rule 1 wording.
- `operand`/`resolvedTarget` are attached via conditional object-spread rather than being set to `undefined` on the literal, so the plan's "omitted" language is honored as key-absence, not value-absence. This mattered for suite 2's fabrication check (`"operand" in instr` must be `false`).
- Suite 6 (all-256 length invariant) deliberately compares the decoder's output against `LENGTH_FOR_MODE[entry.mode]`, not `entry.length`. A literal reading of the plan text ("assert ... bytes.length === OPCODES[i].length") would make the assertion tautological -- both the stream-builder and the assertion would read the same live (possibly corrupted) `entry.length` value, so no corruption could ever be caught. Using the mode-derived independent ground truth instead makes the acceptance criterion ("changing any one entry's length makes suite 6 fail") literally true, and mirrors this codebase's own cross-check ethic (04-01's `deriveMode()` bit-pattern re-derivation).

## Deviations from Plan

None beyond the correction noted above under "Decisions Made" (suite 6's assertion source), which is a stronger, more literal satisfaction of the plan's own stated acceptance criterion rather than a deviation from it -- no Rule 1-4 applied.

## Issues Encountered
- The plan's literal suite-6 wording ("assert ... `bytes.length === OPCODES[i].length`") would, if implemented verbatim, produce a test that cannot fail from opcode-table corruption (self-consistent by construction). Resolved by asserting against `LENGTH_FOR_MODE[entry.mode]` instead, which is what the stated acceptance criterion ("changing any one entry's length makes suite 6 fail") actually requires. Verified by deliberately corrupting `disasm-opcodes.ts`, confirming the corrected suite fails, then reverting to a byte-identical file.
- The pre-existing `repo-root.test.ts` worktree-path failure (documented in `deferred-items.md` from Plan 04-01) reproduces again in this plan's `npm run test:automated` run. Confirmed unrelated: no reference to `disasm-decoder`/`disasm-opcodes` anywhere in `repo-root.test.ts`, and the failure is purely about this execution running inside `.claude/worktrees/agent-<id>/...`. Not re-logged as a new item since it is the identical, already-tracked issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`decode()`, `Instruction`, `DecodedOperand`, `DisasmNote`, `DecodeOptions` are ready for 04-04's renderer to consume, and for 04-05's `stock-disassemble.ts` to wire behind the derived-tool seam (04-02). Per the plan, `disasm-decoder.ts` is deliberately NOT yet added to `.claude/mcp/vice/package.json`'s `files[]` -- it becomes reachable from the shipped entry point only in 04-05, which adds it there in the same task that wires `stock-dispatch.ts -> stock-disassemble.ts -> disasm-decoder.ts`. No blockers for 04-04 or 04-05.

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/disasm-decoder.ts`
- FOUND: `.claude/mcp/vice/disasm-decoder.test.ts`
- FOUND: `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-03-SUMMARY.md`
- FOUND commit `7633b66` (Task 1)
- FOUND commit `d0bb95c` (Task 2)
