---
phase: 53-operator-owned-docs
plan: 01
subsystem: docs
tags: [comments, engineering-rules, npm-published, stock-protocol, third-party-notices]

# Dependency graph
requires: []
provides:
  - "Zero docs/phase citations remain in the ten npm-published modules (`@henols/vice-mcp` files[])"
  - "The rewrite voice (state the reason, not the reference) established on disk for plans 53-02/53-03 to copy"
affects: [53-02, 53-03, 53-04]

actuals:
  tokens: 5874
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Comment citation rewrite: state WHAT was empirically established and AGAINST WHAT (source decoder read, live probe, or both), name zero paths, and be longer than the pointer removed"

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-protocol.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-registers.ts
    - src/mcp/vice/stock-memory-search.ts
    - src/mcp/vice/stock-execution.ts
    - src/mcp/vice/stock-checkpoints.ts
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/textmon-profile.ts
    - src/mcp/vice/evid-ingest.ts
    - src/mcp/vice/THIRD-PARTY-NOTICES.md

key-decisions:
  - "THIRD-PARTY-NOTICES.md's derivation clause (\"derived from independent probing against a running VICE binary, never from reading VICE's own C source\") was preserved byte-for-byte, per the plan's explicit legal-attribution instruction; only the docs/phase0-binmon-findings.md citation clause ahead of it was rewritten."
  - "Real sibling-file/source citations (probe-binmon.mjs line ranges, monitor_binary.c line ranges, mon_breakpoint.c line ranges) were kept wherever they already appeared alongside a docs/phase pointer -- criterion 4 targets evidence-document paths specifically, not every citation."

patterns-established:
  - "Rewrite pattern: (a) state what was empirically confirmed and against what, (b) name zero paths of any kind, (c) net longer than the removed pointer -- applied identically across all 30 sites in this plan and intended as the template for 53-02/53-03."

requirements-completed: [DOCS-03]

duration: 35min
completed: 2026-09-17
status: complete
---

# Phase 53 Plan 01: Rewrite Citations in the Ten npm-Published Modules Summary

**All 30 docs/phase0-binmon-findings.md (and phase42/43/50) pointers in the ten modules `@henols/vice-mcp` ships verbatim were replaced with the reason each site stood for -- monitor_binary.c's own request decoder, a live probe against genuine stock VICE, or a specific measured verdict -- with zero paths repointed and every file's diff net-longer than the pointer it replaced.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-17T (session start)
- **Completed:** 2026-09-17T11:30:32Z
- **Tasks:** 3/3 completed
- **Files modified:** 10

## Accomplishments
- Rewrote all 18 citations in `stock-protocol.ts` (the densest file), establishing the rewrite voice the rest of the phase reuses.
- Rewrote the 7 remaining citations across the five stock transport modules (`stock-connect.ts`, `stock-registers.ts`, `stock-memory-search.ts`, `stock-execution.ts`, `stock-checkpoints.ts`), including two WHY-header opening sentences.
- Rewrote the final 5 sites in `text-protocol.ts`, `textmon-profile.ts`, `evid-ingest.ts` and the legal attribution document `THIRD-PARTY-NOTICES.md`, then ran the plan's single full gate: typecheck clean, `npm run test:automated` green (3692 pass / 0 fail / 9 skipped, pre-existing manual-only set).

## Per-file citation counts (before -> after)

| File | Before | After |
|------|-------:|------:|
| `stock-protocol.ts` | 18 | 0 |
| `stock-connect.ts` | 3 | 0 |
| `stock-registers.ts` | 1 | 0 |
| `stock-memory-search.ts` | 1 | 0 |
| `stock-execution.ts` | 1 | 0 |
| `stock-checkpoints.ts` | 1 | 0 |
| `text-protocol.ts` | 2 | 0 |
| `textmon-profile.ts` | 1 | 0 |
| `evid-ingest.ts` | 1 | 0 |
| `THIRD-PARTY-NOTICES.md` | 1 | 0 |
| **Total** | **30** | **0** |

`grep -rn 'docs/phase'` across all ten files returns 0 lines (re-measured after every task).

## Diff shape (aggregate, measured against plan start `1864322e`)

`git diff --numstat` across the ten files: **+110 / -57**. No single file's diff removed more lines than it added (`stock-checkpoints.ts` was the tightest at +2/-2, still not a net shrink). Per-file breakdown:

| File | + | - |
|------|--:|--:|
| `stock-protocol.ts` | 60 | 28 |
| `stock-connect.ts` | 12 | 10 |
| `stock-registers.ts` | 3 | 1 |
| `stock-memory-search.ts` | 3 | 2 |
| `stock-execution.ts` | 4 | 2 |
| `stock-checkpoints.ts` | 2 | 2 |
| `text-protocol.ts` | 6 | 3 |
| `textmon-profile.ts` | 8 | 3 |
| `evid-ingest.ts` | 7 | 3 |
| `THIRD-PARTY-NOTICES.md` | 5 | 3 |

## Two rewritten sites, quoted in full (for the phase verifier and 53-02/53-03 to check the voice held)

**`stock-protocol.ts`, REGISTERS_GET/REGISTERS_AVAILABLE one-byte body** (matches the exact worked example in RESEARCH.md Q6):

```
/** The one-byte body shared by REGISTERS_GET (0x31) and REGISTERS_AVAILABLE
 * (0x83): a single memspace byte, confirmed against monitor_binary.c's own
 * request decoder and by a live probe against genuine stock VICE that sent
 * each memspace value and matched the returned register set to the
 * expected bank. */
```

**`textmon-profile.ts`, cold-profiler sentence** (the contrast written out in full, no lookup needed):

```
/** VICE's own cold-profiler sentence, quoted byte-for-byte -- including its
 * embedded double quotes and its trailing period -- from
 * `text-protocol.ts`'s `TEXT_COMMAND_ALLOWLIST` doc comment. Unlike this
 * module's siblings' source-traced strings, this one is MEASURED: observed
 * live against genuine stock `x64sc (VICE 3.9)`, 2026-09-09. `prof flat`
 * alone, on a freshly connected session that has never issued `prof on`,
 * returns exactly this sentence -- the profiler subsystem is compiled in
 * and the command itself is fine, it simply has nothing recorded yet. This
 * was a genuinely new live finding, present in neither committed fixture:
 * VICE's flat profiler defaults OFF, and no production handler in this
 * tree issues `prof on` before dialing `prof flat`, so `vice_profile_flat`
 * as shipped cannot yet produce real profile rows against a freshly
 * launched instance -- a real, separately-tracked gap this live run
 * surfaced rather than silently absorbed. */
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite all 18 citations in stock-protocol.ts** - `2b5aaabc` (docs)
2. **Task 2: Rewrite the five remaining stock transport modules (7 citations)** - `9016e52c` (docs)
3. **Task 3: Rewrite the text-channel, evidence-ingest and notices citations (5 sites), then gate the whole plan** - `7a2d6e79` (docs)

_No plan-metadata commit was made: per this run's explicit sequential-on-main instructions, `.planning/STATE.md` and `ROADMAP.md` are not touched by this executor; the orchestrator handles state updates separately._

## Files Created/Modified
- `src/mcp/vice/stock-protocol.ts` - 18 citations rewritten (Task 1)
- `src/mcp/vice/stock-connect.ts` - 3 citations rewritten (Task 2)
- `src/mcp/vice/stock-registers.ts` - 1 citation rewritten (Task 2)
- `src/mcp/vice/stock-memory-search.ts` - 1 citation rewritten (Task 2)
- `src/mcp/vice/stock-execution.ts` - 1 citation rewritten (Task 2)
- `src/mcp/vice/stock-checkpoints.ts` - 1 citation rewritten (Task 2)
- `src/mcp/vice/text-protocol.ts` - 2 citations rewritten (Task 3)
- `src/mcp/vice/textmon-profile.ts` - 1 citation rewritten (Task 3)
- `src/mcp/vice/evid-ingest.ts` - 1 citation rewritten (Task 3)
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` - 1 citation rewritten (Task 3, legal attribution, derivation clause kept byte-for-byte)

## Decisions Made
- Kept every real sibling-file/source citation encountered alongside a removed docs/phase pointer (`probe-binmon.mjs` line ranges, `monitor_binary.c` line ranges, `mon_breakpoint.c` line ranges, `mon_register.c`) -- criterion 4 targets evidence-document paths, not all citations.
- For `THIRD-PARTY-NOTICES.md`, rewrote only the citation clause ("as documented in `docs/phase0-binmon-findings.md`") and left the substantive derivation sentence untouched, per the plan's explicit legal-attribution instruction.

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed with their `<automated>` verify blocks passing on the first run; no Rule 1-4 auto-fixes were needed since this plan only ever touched comment/prose text.

## Issues Encountered

**Noted, not acted on (out of scope for this plan):** `THIRD-PARTY-NOTICES.md` states "never from reading VICE's own C source", while `docs/phase0-binmon-findings.md`'s own header states its answers were "read directly from VICE's source... monitor_binary.c and mon_register.c", and several of this plan's own files (predating this plan, e.g. the JAM-body and memspace-byte comments in `stock-protocol.ts`'s pre-existing header, `stock-connect.ts`'s CR-02 comment) already cite specific `monitor_binary.c`/`mon_breakpoint.c` line ranges as ground truth. This is a pre-existing inconsistency between the legal-notices document and the rest of the codebase's comments, not introduced by this plan -- this plan's rewrites are consistent with the pattern already present in the surrounding, pre-existing comments in the same files. Flagging for the phase owner to resolve separately; not a task 53-01 owns.

## Self-Check: PASSED

- `src/mcp/vice/stock-protocol.ts` exists: FOUND
- `src/mcp/vice/stock-connect.ts` exists: FOUND
- `src/mcp/vice/stock-registers.ts` exists: FOUND
- `src/mcp/vice/stock-memory-search.ts` exists: FOUND
- `src/mcp/vice/stock-execution.ts` exists: FOUND
- `src/mcp/vice/stock-checkpoints.ts` exists: FOUND
- `src/mcp/vice/text-protocol.ts` exists: FOUND
- `src/mcp/vice/textmon-profile.ts` exists: FOUND
- `src/mcp/vice/evid-ingest.ts` exists: FOUND
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` exists: FOUND
- Commit `2b5aaabc` in `git log --oneline --all`: FOUND
- Commit `9016e52c` in `git log --oneline --all`: FOUND
- Commit `7a2d6e79` in `git log --oneline --all`: FOUND
