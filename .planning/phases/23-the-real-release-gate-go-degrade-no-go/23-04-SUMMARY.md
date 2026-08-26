---
phase: 23-the-real-release-gate-go-degrade-no-go
plan: 04
subsystem: testing
tags: [evidence, regenerator2000, analyzer, ghidra, dxa, capability-audit, proof-04]

requires:
  - phase: 23-01
    provides: "DECISION-RULE.md rule R8 and its never-a-gate declaration for C4_LOST_ACCEPTED; SCHEMA.md § 8's three-disposition vocabulary and the four C4_* outcome-line names; README.md's ten evidence conventions"
provides:
  - "C4_UNREPLACED_CAPABILITIES: 0 — rule R8's only input, on disk at column 0 of evidence/criterion4-analyzer-audit.md"
  - "C4_CAPABILITIES_AUDITED: 26, C4_REPLACED: 23, C4_LOST_ACCEPTED: 3 — the reported, non-gating counts"
  - "A 26-row capability audit of analyzer.rs: 8 entry points, 11 LabelType variants, 7 BlockType variants, each with exactly one disposition argued from the crate source"
  - "Three ## ACCEPTED LIMIT blocks, one per lost-accepted capability, each naming what it breaks and which requirement consumes it"
  - "Six scope observations for Phase 25 — AppState capabilities that live in state/, not analyzer.rs, recorded without entering the count"
  - "Eight RESEARCH CORRECTIONS held in this plan's own evidence file for 23-10 to collect"
affects: [23-10, 25-annotation-store-and-cutover, 26-automatic-annotation]

actuals:
  tokens: 34000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Disposition audit with an evidence floor: a replaced-by: claim must cite an observed artifact (ghidra3.txt's 43 typed references) or carry a shape-mismatch note naming what is lost"
    - "Adversarial reporting of a non-firing rule input: the file names the single row whose reclassification would move C4_UNREPLACED_CAPABILITIES off zero, and the exact conditions under which it should be"

key-files:
  created:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion4-analyzer-audit.md
  modified:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md

key-decisions:
  - "C4_UNREPLACED_CAPABILITIES is 0: no analyzer.rs capability carries lost-blocking:, so criterion 4 does not fire rule R8"
  - "follow_indirect_jumps is replaced-by: Ghidra COMPUTED_JUMP with a shape-mismatch note, not lost-blocking: — Ghidra was observed resolving a strictly harder runtime-written-pointer dispatch, and r2000's own precondition (an already-Address-typed block) is store state the milestone already commits to holding. Whether the net is a loss is criterion 2's question and R6's rule, not criterion 4's"
  - "BlockType::HiLoAddress is lost-accepted:, not replaced-by:, because the pivot fixture contained no HiLo table — the CONCAT11 observation covers the LoHi byte order only, and claiming the mirror would be reasoning from a feature list"
  - "LabelType::Return (and the promote_return_labels pass that sets it) is lost-accepted: with a cosmetic label-quality cost — STORE-05's own prefix list does not include r_, so the omission is now a decision rather than an oversight"
  - "Ten of the twenty-three replaced-by: rows name the annotation store rather than an engine; they are collected in their own section so the Phase 25 dependency this audit creates is visible rather than spread across three tables"

patterns-established:
  - "Evidence floor for a replacement claim: cite an observed reference kind from the project's own artifact, or downgrade the disposition and state the uncertainty in the cost"
  - "Partial replacement resolves to replaced-by: plus an explicit shape-mismatch note (this plan's flagged assumption), never to a silent upgrade or a silent loss"

requirements-completed: [PROOF-04]

coverage:
  - id: D1
    description: "Entry-point capability table — all eight analyzer.rs top-level items named with their declared line, each carrying exactly one disposition, with follow_indirect_jumps argued in both directions"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "bash: ROWS=$(grep -cE 'replaced-by:|lost-accepted:|lost-blocking:' criterion4-analyzer-audit.md) >= 20 && greps for follow_indirect_jumps, promote_return_labels, LoHiAddress, ZeroPagePointer, 'Scope observations for Phase 25' -> AUDIT-TABLE-OK (ROWS=38)"
        status: pass
      - kind: other
        ref: "bash: per-row disposition count over ^\\| (E|L|B)[0-9]+ \\| -> all 26 rows carry exactly 1"
        status: pass
    human_judgment: true
    rationale: "The mechanical checks prove the table's shape — every row present, exactly one disposition each. They cannot prove a disposition is the RIGHT one. Each replaced-by: is a claim about what dxa and Ghidra do relative to r2000, and the load-bearing E6 row is an explicit both-directions argument. A human must read the arguments and accept or reject them; that is what criterion 4 exists to have judged."
  - id: D2
    description: "LabelType vocabulary accounting — all eleven variants analyzer.rs produces, each with its own disposition and its production line"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "bash: rows L1..L11 present, each with exactly one disposition literal; variant names cross-checked against state/types.rs:361-378"
        status: pass
    human_judgment: true
    rationale: "Whether Ghidra's CONDITIONAL_JUMP genuinely records the same fact as r2000's Branch, and whether the six store-side rows are honest replacements or deferred work, is a judgment about equivalence that no command can assert."
  - id: D3
    description: "BlockType vocabulary accounting — all seven variants analyzer.rs dispatches on, including the split-pointer LoHi/HiLo pair and the STORE-01 per-range-typing sufficiency ruling"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "bash: rows B1..B7 present, each with exactly one disposition literal; variant names cross-checked against state/types.rs:314-331"
        status: pass
    human_judgment: true
    rationale: "The central claim — that Ghidra's CONCAT11 shape is NOT sufficient for a per-range typing model, evidenced by 08ad/08b0 being typed undefined1 len=1 while the contiguous table got pointer[4] len=8 — is exactly the flagged assumption this plan was told a verifier should check rather than accept."
  - id: D4
    description: "The four C4_* outcome lines at column 0, with the arithmetic reproduced in prose, three ## ACCEPTED LIMIT blocks matching the non-replaced count, ## RESEARCH CORRECTIONS and ## Reproducing this"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "bash: grep -v '^#' | grep -qE '^C4_(CAPABILITIES_AUDITED|REPLACED|LOST_ACCEPTED|UNREPLACED_CAPABILITIES): [0-9]+$' for all four, plus '## ACCEPTED LIMIT', '## RESEARCH CORRECTIONS', '## Reproducing this' -> C4-LINES-OK"
        status: pass
      - kind: other
        ref: "bash: grep -c '^## ACCEPTED LIMIT$' -> 3, equal to C4_LOST_ACCEPTED (3) + C4_UNREPLACED_CAPABILITIES (0)"
        status: pass
      - kind: other
        ref: "arithmetic: C4_REPLACED 23 + C4_LOST_ACCEPTED 3 + C4_UNREPLACED_CAPABILITIES 0 == C4_CAPABILITIES_AUDITED 26"
        status: pass
    human_judgment: false
  - id: D5
    description: "The audit was derived offline with no regenerator2000 process started, and 23-RESEARCH.md was not edited"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "git diff --name-only edbffc7~1..HEAD -> only .planning/ paths, no src/, no 23-RESEARCH.md"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm test -> # fail 0 (2593 pass, 40 skipped, 5 todo)"
        status: pass
    human_judgment: true
    rationale: "The git and test checks are mechanical, but 'no regenerator2000 process was started' is a claim about the whole transcript, not about any one command's output. Only a reader of the transcript can confirm the negative."

duration: 33 min
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 04: Criterion 4 — the `analyzer.rs` capability audit Summary

**All 26 `analyzer.rs` capabilities dispositioned against observed dxa/Ghidra facts — 23 replaced, 3 accepted as lost, 0 blocking — so `C4_UNREPLACED_CAPABILITIES: 0` and rule R8 does not fire.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-08-26T13:05Z (approx., first source read)
- **Completed:** 2026-08-26T11:40Z UTC (`3350374`)
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 appended)

## Accomplishments

- **Every `analyzer.rs` capability now carries exactly one disposition, argued from the source.** 26 rows across three tables: 8 top-level entry points (all eight of `23-RESEARCH.md`'s line numbers verified correct against a fresh structural grep), 11 `LabelType` variants, 7 `BlockType` variants. No row carries two dispositions and none carries zero — checked mechanically, per row.
- **`C4_UNREPLACED_CAPABILITIES: 0` is on disk as rule R8's only input**, with the arithmetic (`23 + 3 + 0 = 26`) reproduced in prose immediately above the four outcome lines so a reader recomputes rather than trusts.
- **The zero is reported adversarially rather than banked.** Because `0` is R8's *non-firing* value, the file names the single row whose reclassification would move it — E6 `follow_indirect_jumps` — and the two conditions that would justify moving it (criterion 2 recording `unresolved` on the real corpus, **and** `GHID-04`'s acceptance being read as requiring the declaration-driven static fallback). It explicitly declines to pre-empt criterion 2, whose own rule R6 already covers that outcome without double-counting.
- **`follow_indirect_jumps` argued in both directions, as the plan required.** Where r2000 is stronger: it is declaration-driven and purely static, firing on any `JMP ($xxxx)` into a pre-typed `Address` block with no reachability and no constant-foldability requirement — where Ghidra's `COMPUTED_JUMP` simply produces nothing, silently. Where Ghidra is stronger: the one observed `COMPUTED_JUMP` (`082e -> 089a`) resolves a pointer the program *writes at runtime* into zero page, which r2000 structurally cannot reach (`$00fb` fails `is_internal` for any `.prg` based at `$0801`). The precondition r2000 requires is named explicitly and shown to be store state the milestone already commits to holding.
- **The split-pointer shape mismatch measured, not asserted.** `ghidra3.txt` typed the contiguous address table as `08b7 pointer[4] len=8` with four `DATA` references to its targets — a clean range-shaped replacement (B2). The *split* lo/hi arrays got `08ad undefined1 len=1` and `08b0 undefined1 len=1` — one byte each, no extent, no pair count, no stride — with the pairing appearing only as a decompiler expression at one use site. The audit rules that shape **not sufficient** for `STORE-01`'s per-range typing model and lands the obligation on Phase 25.
- **Ten `replaced-by:` rows name the annotation store rather than an engine, and they are collected in their own section** so the size of the Phase 25 dependency this audit creates is visible at a glance instead of buried across three tables.
- **Six scope observations for Phase 25 recorded without widening the count** — `is_virtual_splitter`, `is_external`, `excluded_addresses`, the `LabelKind` User/Auto/System precedence rule, `ImmediateFormat`, and the `LabelType::prefix` table that `STORE-05` names as worth stealing and which turns out to live in `state/types.rs`, not in `analyzer.rs` at all.

## Task Commits

1. **Task 1: Read analyzer.rs function by function and write the capability table** — `edbffc7` (docs)
2. **Task 2: Emit the criterion-4 outcome lines and the accepted limits** — `2e0e416` (docs)
3. **Self-check appended to the evidence file** — `3350374` (docs)

## Files Created/Modified

- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion4-analyzer-audit.md` (created, 494 lines) — the three disposition tables, the E6 both-directions argument, the store-side dependency roll-up, `## Scope observations for Phase 25`, the four `C4_*` outcome lines with reproduced arithmetic, three `## ACCEPTED LIMIT` blocks, `## RESEARCH CORRECTIONS`, `## Reproducing this` with the registry path / crate version / source sha256 / verbatim command transcript, and `## Self-Check: PASSED`.
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md` (appended) — one out-of-scope discovery logged rather than fixed.

## Decisions Made

- **`C4_UNREPLACED_CAPABILITIES: 0`.** No capability was found that is both unreplaced *and* depended on by something in the milestone. The three genuine losses are priced and accepted; the milestone as already scoped (R6's pre-mapped criterion-2 narrowing, `AUTO-05`'s decline rule) already tolerates the one case that came close.
- **`E6 follow_indirect_jumps` is `replaced-by:` with a shape-mismatch note.** Rationale in full above. The decisive consideration: r2000's route *requires* a block already typed `Address`, which is exactly the map dxa produces and the store holds — so the capability is relocated rather than lost, and reading a 16-bit pointer out of a declared address block is arithmetic, not analysis.
- **`B5 HiLoAddress` is `lost-accepted:`, not `replaced-by:`.** The pivot fixture contained no HiLo table, so no observation exists in that byte order. The LoHi `CONCAT11` result makes the mirror *likely*; likely is not observed, and the plan's own prohibition forbids a `replaced-by:` on the strength of a plausible feature name.
- **`E4` / `L11` (`promote_return_labels` and `LabelType::Return`) are two rows, not one**, and therefore two `## ACCEPTED LIMIT` blocks. They have different consumers: `E4` is a pass that no longer runs (`STORE-05`'s prefix set), `L11` is a value that no longer exists in the vocabulary the store persists (`STORE-01`'s label-type schema). Recording them once would have hidden the second decision.
- **No PLAN.md / SCHEMA.md divergence was found.** The phase-wide ruling (SCHEMA wins) had nothing to arbitrate here: `SCHEMA.md` § 8's three-disposition vocabulary and its four `C4_*` line names match the plan's instructions exactly, and `C4_CAPABILITIES_AUDITED`'s "integer" domain is satisfied by the plan's "total rows across the entry-point table and both vocabulary tables". No `## ACCEPTED LIMIT` was added on that account — and adding a fourth would have broken the block-count parity Task 2's acceptance criteria pin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, resolved as out-of-scope] `npm test` acceptance gate went red on a pre-existing load-flaky test**

- **Found during:** Task 1, running the `cd src/mcp/vice && npm test` acceptance criterion.
- **Issue:** `r2000-session.test.ts:615` — *"stub: a child that answers nothing within the call timeout rejects with R2000TimeoutError, is killed, and the crash counter increases by 1"* — failed with `Expected values to be strictly equal: 0 !== 1` (crash counter read `0`, expected `1`). This plan changed exactly one markdown file under `.planning/`, so it cannot have caused a `src/` test failure.
- **Fix:** Diagnosed rather than patched. Run in isolation (`node --test r2000-session.test.ts`) the file is 25/25 green, identifying it as a load-sensitive timing assertion that races the suite scheduler. A second full `npm test` at the same commit returned `# fail 0` (2593 pass), confirming non-determinism. Logged to `deferred-items.md` with a candidate fix (poll the crash counter to a bounded deadline instead of sampling once). **Not fixed** — evidence convention 9 forbids this phase from modifying anything under `src/`, the executor's scope boundary excludes failures not caused by the current task, and there is a standing project instruction that the r2000 test surface is not this milestone's to verify or extend.
- **Files modified:** `.planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md`
- **Verification:** second full-suite run `# fail 0`; single-file run 25/25 pass.
- **Committed in:** `edbffc7` (initial entry) and `2e0e416` (flake confirmation).

**2. [Rule 3 - Blocking] Plan `<verification>` expects the commits to touch "only the one evidence file"; they touch two**

- **Found during:** Task 2, plan-level verification.
- **Issue:** The plan's verification block reads *"`git diff --name-only` across this plan's commits touches only the one evidence file"*, but the executor's scope-boundary rule requires out-of-scope discoveries to be logged to `deferred-items.md`. Deviation 1 produced exactly such a discovery, so the two requirements are in direct tension and both cannot hold.
- **Fix:** Logged the discovery as the scope-boundary rule requires and recorded the divergence here. The check's *intent* — that this phase ships evidence and no product code — is fully satisfied and was verified directly: `git diff --name-only edbffc7~1..HEAD` lists zero paths under `src/`, and both touched paths live under `.planning/phases/23-.../`, so evidence convention 9 holds. `23-RESEARCH.md` is likewise untouched, as convention 8 requires.
- **Files modified:** none beyond deviation 1's.
- **Verification:** `git diff --name-only edbffc7~1..HEAD | grep -c '^src/'` → `0`; `... | grep -c '23-RESEARCH.md'` → `0`.
- **Committed in:** `2e0e416`.

---

**Total deviations:** 2 (both Rule 3 — blocking issues resolved without touching out-of-scope code).
**Impact on plan:** None on the deliverable. Neither deviation changed a disposition, an outcome line or the audit's scope. Deviation 1 is a pre-existing flake in another phase's test surface; deviation 2 is a one-file drift from a plan-side check whose intent was verified directly and holds.

## Issues Encountered

- **The plan's `read_first` inventory describes eleven `LabelType` variants but enumerates only ten by name**, leaving `Subroutine` implicit behind "and any twelfth found". Resolved by reading the enum: `analyzer.rs` produces exactly eleven, the eleventh being `Subroutine` (line 321), and the enum itself declares fourteen. Recorded as RESEARCH CORRECTION 2 rather than treated as a plan error.
- **`23-RESEARCH.md`'s eight line numbers all proved correct**, which is worth recording because the plan explicitly instructed checking rather than copying them. The check produced no correction — but it did surface a ninth top-level item the research's grep missed (`type UsageData`, line 13), which is a type alias rather than a capability and is recorded in the corrections rather than added to the table.
- **The `vice` MCP server was not needed and was not contacted.** Criterion 4 is the one criterion requiring no corpus, no capture and no instrument, which is why it was scheduled in wave 2 — plan 23-03's halt at its Task 3 had no effect on this plan.

## User Setup Required

None — no external service configuration required. The one external input, the cargo registry copy of `regenerator2000-core` 0.9.20, was already present on this host and is identified by sha256 in the evidence file so a later reader does not depend on the path.

## Next Phase Readiness

- **Rule R8's input is recorded and final unless criterion 2 changes the reading of E6.** `C4_UNREPLACED_CAPABILITIES: 0` means criterion 4 contributes no degrade. The findings document (23-10) can walk R8 mechanically.
- **23-10 has eight RESEARCH CORRECTIONS waiting in this file** to collect in its single pass over `23-RESEARCH.md`. None of them changes a rule input; four are substantive behavioural corrections (dead count map, splitter fall-through, `flow_analyze`'s two structural limits, the five unhandled `BlockType` variants).
- **Phase 25 inherits ten named store-side obligations plus six scope observations**, all collected in their own sections. The sharpest is `STORE-01`'s: split-pointer table ranges must be carried as declared store state with an explicit byte-order flag, because neither engine reports the extent — and for the HiLo order neither engine has been observed reporting anything at all.
- **A cheap way to discharge accepted limit (3)** is named in the file: add a HiLo split table to whatever fixture Phase 24 builds for `GHID-04` and re-check. This audit is not the place to build one, since criterion 4 runs offline and starts no engine.
- **No blockers.** Nothing in this plan depended on the halted 23-03 or on the corpus.

---
*Phase: 23-the-real-release-gate-go-degrade-no-go*
*Completed: 2026-08-26*
