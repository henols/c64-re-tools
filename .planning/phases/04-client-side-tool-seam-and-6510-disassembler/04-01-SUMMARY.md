---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 01
subsystem: disassembler
tags: [6502, 6510, opcode-table, cc65, acme, node-test]

# Dependency graph
requires: []
provides:
  - "disasm-opcodes.ts: the committed 256-entry 6502/6510 opcode table (OPCODES, OpcodeEntry, AddressingMode, LENGTH_FOR_MODE), zero imports, zero I/O"
  - "disasm-opcodes.test.ts: an independent aaabbbcc bit-pattern derivation test proving the table's mode/length fields against the CPU's own instruction encoding, not against the transcription source"
affects: [04-03-decoder, 04-04-renderer, 04-05-vice-disassemble-tool, 04-06-acme-roundtrip, phase-5-backtrace, phase-6-cpuhistory-decode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-data module with a long structured attribution/provenance header (WHY THIS FILE EXISTS / WHAT NOT TO DO), matching stock-protocol.ts's precedent"
    - "Independent cross-check test derived from first principles (CPU bit structure), not from the same source as the code under test"

key-files:
  created:
    - .claude/mcp/vice/disasm-opcodes.ts
    - .claude/mcp/vice/disasm-opcodes.test.ts
  modified: []

key-decisions:
  - "Renamed two cc65 mnemonics to match ACME's verified illegal-opcode set: $AB lax->lxa (to disambiguate from the genuine indexed LAX family), $CB axs->sbx (matching masswerk.at/oxyron.de's SBX naming) -- makes acmeExpressible pure set membership"
  - "fluffy-6502 could not be found under that name; recorded in the header as an unavailable source rather than cited, per 04-RESEARCH.md Pitfall 5"
  - "Roadmap's 'twelve NOP variants' corrected to the verified 27 opcodes across 6 addressing-mode groups (04-RESEARCH.md Pitfall 1)"
  - "deriveMode() uses aaa-conditional sub-rules (Y-indexing for STX/LDX/SAX/LAX, accumulator-vs-implicit split) rather than nulling whole bbb columns, keeping IRREGULARS to the 33 opcodes that are genuinely undecidable from the bit pattern alone"

requirements-completed: [DISASM-02]

# Metrics
duration: 55min
completed: 2026-08-17
---

# Phase 04 Plan 01: 6502/6510 Opcode Table Summary

**Committed 256-entry cc65-derived opcode table plus an independent aaabbbcc bit-pattern derivation test that pins all 256 entries against the CPU's own instruction encoding**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 completed
- **Files modified:** 2 created (plus 1 phase-level deferred-items log)

## Accomplishments
- Transcribed `disasm-opcodes.ts` directly from cc65's raw `src/da65/opc6502x.c` (fetched live against `master` @ `547d923588d870aacf0b0016c67d0f6a92a70f83`, table itself last touched at `02e79d35d73efd31522b5eab986d1919e3560bba`, 2025-06-19), not from a summary
- 256/256 entries verified byte-exact against the fetched source via an automated diff before commit; one transcription slip (`$FD` SBC absolute,X marked illegal) caught and fixed by that diff, before it ever reached a test
- Built `deriveMode()`, an independent re-derivation of addressing mode from the 6502's `aaabbbcc` bit structure, exhaustive over all 256 opcodes, with a 33-entry `IRREGULARS` table (BRK/JSR/RTI/RTS, JMP-indirect, the 8 conditional branches, the 12 JAMs, and the 8 cc=0b11 "immediate combo-op" opcodes) and a reverse "dead entry" check
- Corrected the NOP-class count from the roadmap's "twelve" to the verified 27 opcodes across 6 addressing-mode groups, and the 12-opcode JAM class, both asserted by exact opcode value and by count
- Confirmed the test is non-vacuous: corrupting `$00`'s length locally made `node --test disasm-opcodes.test.ts` fail (exit 1), then reverted cleanly (verified via diff against a pre-corruption backup)

## Task Commits

1. **Task 1: Create disasm-opcodes.ts** - `2fe5a0c` (feat)
2. **Task 2: Create disasm-opcodes.test.ts** - `0f1dbe8` (test)

Additional commit (deviation logging, not a plan task):
- `5499f10` (docs) - logged a pre-existing, unrelated worktree-path test failure to `deferred-items.md`

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `.claude/mcp/vice/disasm-opcodes.ts` - the 256-entry opcode table, zero imports, zero I/O; `OPCODES`, `OpcodeEntry`, `AddressingMode`, `LENGTH_FOR_MODE`
- `.claude/mcp/vice/disasm-opcodes.test.ts` - shape suite, exhaustive bit-pattern derivation suite, NOP-class suite (27/6-group), JAM-class suite (12), `acmeExpressible` seed-sanity suite, purity suite (comment-stripped import count)
- `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md` - new phase-level log (deviation tracking, not a plan file)

## Decisions Made
- `$AB` renamed `lax` -> `lxa` and `$CB` renamed `axs` -> `sbx` relative to cc65's own spelling, to align with ACME's verified 18-mnemonic illegal-opcode set (`acme-build/SKILL.md`) so `acmeExpressible` reduces to plain set membership. No other mnemonic in the table differs from cc65's spelling. Documented in the file's own header.
- `fluffy-6502` recorded as an explicitly **unavailable** source (not cited) per 04-RESEARCH.md's Assumptions Log A1 / Pitfall 5.
- The "twelve NOP variants" figure from ROADMAP.md criterion 2 / 04-CONTEXT.md D-09 is corrected in both files' headers to the verified 27-opcode/6-group enumeration.
- `deriveMode()` was built with aaa-conditional sub-rules for the few genuinely uniform-but-aaa-dependent columns (STX/LDX/SAX/LAX's Y-indexing exception at zeropage/absolute+index slots; the accumulator-vs-implicit split at cc=0b10 bbb=0b010) rather than declaring those whole columns irregular. This keeps `IRREGULARS` to exactly the 33 opcodes with no bit-derivable mode at all (BRK/JSR/RTI/RTS, the one JMP-indirect, the 8 branches, the 12 JAMs, and the 8 cc=0b11 combo-immediate opcodes), and makes the test strictly stronger: a transcription bug in, say, `$96`'s addressing mode would now be caught by the derivation rule itself rather than by a hardcoded literal that could silently drift in step with the same bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed own transcription error before it reached a test**
- **Found during:** Task 1, self-verification diff against the raw cc65 fetch
- **Issue:** `$FD` (`sbc absolute,x`) was manually transcribed with `illegal: true, acmeExpressible: false` instead of `illegal: false, acmeExpressible: true` -- SBC is a fully legal, documented instruction in all 8 of its addressing-mode forms; only `$EB` (the duplicate immediate-mode encoding) is illegal.
- **Fix:** Corrected the single entry; re-diffed the full 256-entry table against an independently-generated reference (built from a from-scratch parse of the fetched cc65 source) until byte-identical.
- **Files modified:** `.claude/mcp/vice/disasm-opcodes.ts`
- **Verification:** `diff` against the independently-generated table showed zero differences; `node --test disasm-opcodes.test.ts` (written afterward) also passes on this corrected entry.
- **Committed in:** `2fe5a0c` (the error never appeared in any commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caught pre-commit by self-verification, not by a later test run)
**Impact on plan:** No scope creep. The fix is exactly the correctness the plan's own threat model (T-04-01-01) calls for.

## Issues Encountered
- `npm run test:automated` surfaces one pre-existing, unrelated failure: `repo-root.test.ts`'s "path agreement ... THE regression this task exists to catch" test fails when the whole suite is run from inside this Claude Code worktree (`.claude/worktrees/agent-<id>/...`), because the worktree's own checkout path happens to contain a `.claude` segment that the test's "must not sit under .claude" assertion also matches. Confirmed via `grep` that `repo-root.test.ts` has zero reference to `disasm-opcodes` or anything this plan touches, and confirmed the failure is about `.vice-supervisor` path resolution, not opcode data. Logged to `deferred-items.md` per the Scope Boundary rule rather than fixed here (would require touching `repo-root.ts` or `repo-root.test.ts`, neither in this plan's `files_modified`).
- `node_modules/` did not exist in this fresh worktree (never committed, per `.gitignore`); ran `npm ci` in `.claude/mcp/vice` to obtain `tsc` for typecheck verification. No `package.json`/`package-lock.json` changes resulted.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`OPCODES`/`OpcodeEntry`/`AddressingMode`/`LENGTH_FOR_MODE` are ready for 04-03's decoder to import. 04-06's real-ACME round-trip is the next and final authority on every `acmeExpressible` seed value in the table -- nothing here should be treated as final until that plan runs. No blockers for 04-02 (derived-tool seam), which has no dependency on this plan and was explicitly scoped to run in the same wave.

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/disasm-opcodes.ts`
- FOUND: `.claude/mcp/vice/disasm-opcodes.test.ts`
- FOUND: `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md`
- FOUND commit `2fe5a0c` (Task 1)
- FOUND commit `0f1dbe8` (Task 2)
- FOUND commit `5499f10` (deviation log)
