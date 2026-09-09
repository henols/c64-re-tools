---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 02
subsystem: mcp-tooling
tags: [vice, text-monitor, chis, bt, cpu-history, backtrace, parser, stock-only-tool, tdd]

# Dependency graph
requires:
  - phase: 42
    provides: "plan 42-01's textmon-memmap.ts (the D-42-3 refusal discipline -- a parser returns a discriminated refusal, never throws) and textmon-fixtures.ts's loadTextFixture(), both inherited rather than re-decided here"
provides:
  - "The one owning module for chis text -- textmon-cpuhistory.ts (parseCpuHistory, closed CpuHistoryRefusalCode union covering empty-response/malformed-line/unrecognised-flag/unrecognised-memspace/unrecognised-register-label)"
  - "The one owning module for bt text -- textmon-backtrace.ts (parseBacktrace, closed BacktraceRefusalCode union covering empty-response/missing-current-pc-line/malformed-frame-line/unrecognised-origin/malformed-sp-offset/unrecognised-memspace)"
  - "The MEASURED per-entry-cycle-count-on-3.9 claim (PARSE-02), proven from the real stock capture's sidecar-confirmed viceVersion"
  - "The reconstructed-JSR-chain claim (PARSE-02), proven from real captured bytes including the reset-origin frame and the negative SP offset"
affects: [42-04, 42-07, 42-08]

# Actuals (#2632)
actuals:
  tokens: 13892
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared address/bytes/disassembly column layout between textmon-cpuhistory.ts and textmon-backtrace.ts (both formats print the same '.<memspace>:<addr>  <12-char bytes column>  <disassembly>' shape mid-line), each module keeping its own copy per the purity rule rather than sharing a helper module"
    - "Structural-vs-content refusal split (established by textmon-memmap.ts, reapplied here): a line either matches the overall shape (else malformed-line/malformed-frame-line) or matches but carries an unrecognised value at a specific position (a distinct, named refusal code) -- never conflated into one generic failure"

key-files:
  created:
    - src/mcp/vice/textmon-cpuhistory.ts
    - src/mcp/vice/textmon-cpuhistory.test.ts
    - src/mcp/vice/textmon-backtrace.ts
    - src/mcp/vice/textmon-backtrace.test.ts
  modified: []

key-decisions:
  - "CpuHistoryFlags decoded as a frozen record of 8 named booleans (n, v, unused, b, d, i, z, c), keeping the 6502's reserved status bit as its own member rather than folding it into a neighbour -- its set-glyph happens to be a literal hyphen, but it is validated by the same closed-set rule as every other position"
  - "BacktraceFrame.origin is typed number | 'reset' | 'irq' | 'nmi' rather than a single string field, so a caller cannot accidentally treat a named origin as a numeric address without an explicit type narrowing"
  - "Both modules use a non-greedy prefix-capture regex (SUFFIX_RE style) to locate the shared memspace-marker-plus-address pattern, then validate the captured prefix separately against a loose structural regex before checking closed-set content -- this is what lets 'wrong shape' (malformed-*) and 'right shape, wrong value' (unrecognised-*/malformed-sp-offset) land on distinct, plan-mandated refusal codes instead of collapsing into one"
  - "parseSpOffset() treats VICE's literal '+-241' form exactly as the plan specifies: the '+' is a fixed field marker, never a sign to honour, and the sign lives in the digits' own prefix -- validated by the single regex /^ *-?\\d+$/ over whatever text sat between '+' and ']'"

requirements-completed: [PARSE-02, PARSE-03]

coverage:
  - id: D1
    description: "chis output parses into CPU history entries that each carry their own per-entry cycle count, proven on the real stock 3.9 capture with the sidecar's viceVersion asserted as the grounding fact"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "textmon-cpuhistory.test.ts#MEASURED claim (PARSE-02): every entry of the stock 3.9 capture carries a positive integer cycles value"
        status: pass
      - kind: unit
        ref: "textmon-cpuhistory.test.ts#parseCpuHistory: a 12-digit cycle count parses to the exact integer"
        status: pass
    human_judgment: false
  - id: D2
    description: "bt output parses into the reconstructed JSR chain -- each frame's caller, callee, signed SP offset and disassembled instruction, in VICE's own emitted order, never re-sorted"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "textmon-backtrace.test.ts#order assertion: the sequence of callee addresses is pinned exactly as VICE emitted them, never re-sorted or reversed"
        status: pass
      - kind: unit
        ref: "textmon-backtrace.test.ts#order is data (T-42-08): no code path in this module sorts or reverses frames -- asserted over the module's own source"
        status: pass
      - kind: unit
        ref: "textmon-backtrace.test.ts#real capture: the literal '+-241' SP-offset field parses to the negative integer -241"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every closed set in both formats (memspace marker, processor flags, register-label order for chis; frame origin, memspace marker, SP-offset shape for bt) refuses by name via a planted control, paired with an assertion that both real captures still parse"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-cpuhistory.test.ts#planted-refusal tests (unrecognised-flag, unrecognised-memspace, unrecognised-register-label), each paired with assertRealCapturesStillParseCleanly()"
        status: pass
      - kind: unit
        ref: "textmon-backtrace.test.ts#planted-refusal tests (unrecognised-origin, malformed-sp-offset, unrecognised-memspace x2, malformed-frame-line, missing-current-pc-line), each paired with assertRealCapturesStillParseCleanly()"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both modules import nothing and declare no module-scope mutable state; parsing is idempotent and safe under interleaved concurrent calls"
    requirement: "PARSE-03"
    verification:
      - kind: unit
        ref: "textmon-cpuhistory.test.ts#purity + idempotency + concurrency tests"
        status: pass
      - kind: unit
        ref: "textmon-backtrace.test.ts#purity + idempotency + concurrency tests"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 02: chis and bt text-format parsers Summary

**Two pure, import-free parsers -- `parseCpuHistory()` for VICE's `chis` output and `parseBacktrace()` for `bt` -- both proven against real stock-3.9 and fork-3.10 captures, with every closed set (processor flags, memspace markers, register-label order, frame origins, SP-offset shape) refusing by name on drift rather than decoding a plausible-looking wrong answer.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-09T13:17:27Z
- **Completed:** 2026-09-09T13:33:17Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 4 (all created)

## Accomplishments

- `textmon-cpuhistory.ts`: `parseCpuHistory(text)`, zero imports, never throws (D-42-3), decoding per-entry address, raw bytes, disassembly, the four registers (A/X/Y/SP), an 8-position closed processor-flag set (`NV-BDIZC` set-glyph sequence, the reserved bit kept as its own member), and `cycles` as an integer accepting up to 12 digits
- `textmon-backtrace.ts`: `parseBacktrace(text)`, zero imports, never throws, decoding the current-PC frame plus every call frame in VICE's own emitted order (no `.sort(`/`.reverse(` anywhere in the module, asserted from the module's own source), with a closed origin set (numeric address or `reset`/`irq`/`nmi`) and VICE's literal `+-241` negative-SP-offset form decoded correctly
- Both modules' MEASURED claims proven from real evidence: 4 `chis` entries with positive-integer `cycles` on the sidecar-confirmed stock-3.9 capture; a 5-frame `bt` chain with the real reset-origin frame and the real `-241` SP offset, plus the pinned callee-address sequence `[0xffcf, 0xe112, 0xa560, 0xe422, 0xfce2]` shared identically by both binaries' captures
- 40 tests added across `textmon-cpuhistory.test.ts` (18) and `textmon-backtrace.test.ts` (22), all green; every refusal code in both closed unions proven reachable via a planted control paired with a real-capture discriminating assertion
- Idempotency (`deepEqual` of two sequential parses) and concurrency (`Promise.all`-interleaved parses matching sequential results) proven for both modules

## Task Commits

1. **Task 1: chis -- CPU history entries carrying their own per-entry cycle counts** - `e1103a8d` (feat)
2. **Task 2: bt -- the reconstructed JSR chain, with its signed SP offsets and its interrupt origins** - `ef4d5d91` (feat)

_Note: both tasks are `tdd="true"`, but per the same reasoning documented in 42-01's Deviations (Task 1 there), the layout was derived directly from the real committed captures via node-script byte-position analysis before any parser code was written, so the regex/validation logic and its test coverage landed together rather than as a strict RED-then-GREEN pair. Both commits are `feat(...)`, not `test(...)`→`feat(...)` pairs, because production code and its test file were authored and verified together against the same evidence in one pass._

## Files Created/Modified

- `src/mcp/vice/textmon-cpuhistory.ts` - The owning parser for `chis`: `parseCpuHistory`, `CpuHistoryEntry`, `CpuHistoryFlags`, `CpuHistoryRefusalCode`, `TextParseRefusal`, `CpuHistoryParseResult`
- `src/mcp/vice/textmon-cpuhistory.test.ts` - 18 tests: purity (import + mutable-state), both real captures, the MEASURED positive-cycles claim, the flag-decode shape, every refusal code, 12-digit cycle count, idempotency, concurrency
- `src/mcp/vice/textmon-backtrace.ts` - The owning parser for `bt`: `parseBacktrace`, `BacktraceCurrentPc`, `BacktraceFrame`, `BacktraceOriginName`, `BacktraceRefusalCode`, `TextParseRefusal`, `BacktraceParseResult`
- `src/mcp/vice/textmon-backtrace.test.ts` - 22 tests: purity (import + mutable-state + no-sort/reverse), both real captures, the reset-origin frame, the negative SP offset, the pinned callee-order sequence, every refusal code, idempotency, concurrency

## Decisions Made

- **Shared column layout, no shared module**: `chis` and `bt` both print the same `.<memspace>:<addr>  <12-char bytes>  <disassembly>` mid-line shape (confirmed byte-for-byte against both real fixture files via a node script before writing either parser). Rather than factor a shared helper module (which would violate the D-42-3 zero-import purity rule for at least one of the two modules), each module keeps its own copy of the parsing logic -- exactly the tradeoff `textmon-memmap.ts`'s own module header documents as the reason purity is asserted per-file, not per-family.
- **Non-greedy prefix capture, then separate structural/content validation**: both modules locate the shared address/bytes/disassembly suffix via a non-greedy `(.*?)` prefix capture, then validate the captured prefix text against a second, format-specific regex. This two-stage design is what makes "wrong shape entirely" (`malformed-line`/`malformed-frame-line`) and "right shape, wrong value at a specific position" (every `unrecognised-*`/`malformed-sp-offset` code) land on distinct, plan-mandated refusal codes rather than being conflated into one generic failure -- the same split `textmon-memmap.ts` established between `malformed-line` and `unrecognised-glyph`.
- **`unused` flag position kept as its own named member**: the 6502's reserved status bit (VICE's set-glyph for it happens to be a literal hyphen) is decoded by the exact same per-position closed-set rule as every other flag, never special-cased or folded away -- this is explicit in both the module header's "WHAT NOT TO DO" and the flags-decode test.

## Deviations from Plan

None - plan executed exactly as written. Both modules' exact byte layouts were derived directly from the committed real captures (via node-script character-position analysis, not assumed from the plan's prose description), and every layout detail the plan's `<action>` text describes (the 12-character bytes column, the closed flag/origin/memspace sets, the literal `+-` SP-offset form) matched the measured real data exactly on the first attempt -- no corrections to the plan's own premises were needed here, unlike 42-01's `(uninitialized read)` correction.

## Issues Encountered

None.

## Measured Baseline (this plan's own `<verification>` requirement)

Measured at plan start, before any edit (`npm run test:automated`): **9 failures across 5 files** --
- `anno-import.test.ts` (1 failure)
- `anno-register.test.ts` (2 failures)
- `dxa-seam.test.ts` (4 failures -- the vendored `dxa` binary is not built in this worktree)
- `repo-root.test.ts` (1 failure -- this worktree's path sits under `.claude/worktrees/agent-.../`, tripping a "not under .claude" assertion)
- `audit-root-args.test.ts` (1 failure -- the documented intermittent scratch-file race between `skill-honesty-checks.test.ts` and `check-skill-tool-coverage.mjs`)

All five are pre-existing/worktree-environment artifacts, matching this repo's documented note that the gate is never green and the floor varies by worktree location and vendored-binary state -- none are caused by this plan's changes.

Re-measured after both tasks: **8 failures, the same first 4 files** (`anno-import.test.ts`, `anno-register.test.ts` x2, `dxa-seam.test.ts` x4, `repo-root.test.ts`) -- the `audit-root-args.test.ts` race did not trigger on this run, consistent with its documented intermittency. No new failing file appeared. The gate is at or below the measured baseline, satisfying the plan's own `<verify>` requirement.

## Refusal Codes Proven Reachable

**`CpuHistoryRefusalCode`** (all 5 members): `empty-response` (empty string, whitespace-only, and prompt-only payload), `malformed-line` (missing cycle-count column), `unrecognised-flag` (planted `Q` character), `unrecognised-memspace` (planted `.D:` marker, message contains `vice_device_console`), `unrecognised-register-label` (planted `X`/`A` order swap).

**`BacktraceRefusalCode`** (all 6 members): `empty-response` (empty string, whitespace-only, and prompt-only payload), `missing-current-pc-line` (payload starting with a frame line instead of `PC`), `malformed-frame-line` (a totally garbled frame line), `unrecognised-origin` (planted `zzzz` origin token), `malformed-sp-offset` (planted `+abc` field), `unrecognised-memspace` (planted `.D:` marker on both a frame line and the current-PC line itself, message contains `vice_device_console`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `textmon-cpuhistory.ts` and `textmon-backtrace.ts` are ready for plan 42-07's tool wiring (`vice_chis`, `vice_bt`) and plan 42-04's `TEXT_COMMAND_ALLOWLIST` parameterization for the `chis <count>` argument -- neither module was wired to a tool or added to `package.json`'s `files[]` in this plan, per this plan's own `<plan_decisions>` note (D-42-3 inherited, `files[]` deferred to 42-07 to avoid a same-wave collision).
- Both modules' `textmon-` family membership is ready for 42-08's phase-wide structural single-owning-module test to include in its floor count (now 3 of the eventual 5: `textmon-memmap.ts`, `textmon-cpuhistory.ts`, `textmon-backtrace.ts`).
- No blockers for plan 42-03 (running beside this plan in the same wave) or any downstream plan.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/textmon-cpuhistory.ts`
- FOUND: `src/mcp/vice/textmon-cpuhistory.test.ts`
- FOUND: `src/mcp/vice/textmon-backtrace.ts`
- FOUND: `src/mcp/vice/textmon-backtrace.test.ts`
- FOUND commit: `e1103a8d` (Task 1)
- FOUND commit: `ef4d5d91` (Task 2)
- Re-ran all `<acceptance_criteria>` across both tasks: PASS
- Re-ran the plan-level `<verification>` block (`node --test textmon-cpuhistory.test.ts textmon-backtrace.test.ts`, `npm run typecheck`, `npm run test:automated`): PASS (automated gate at 8 failures, at or below the measured 9-failure baseline, same failing files, no new failures)
