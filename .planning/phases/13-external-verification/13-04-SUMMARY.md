---
phase: 13-external-verification
plan: 04
subsystem: testing
tags: [stock-protocol, assumptions-log, label-discipline, tdd, node-test]

requires:
  - phase: 13-external-verification (plan 03)
    provides: 13-PROBE-RESULTS.md's four live-probed verdicts (A1 CONFIRMED, A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED) against fork VICE 3.10
provides:
  - Consistent [ASSUMED] labels across authored source (A1/A2 removed, A3/A5 kept)
  - assumption-label-discipline.test.ts, a permanent all-or-nothing label guard
  - Post-probe status recorded in 03-RESEARCH.md's Assumptions Log and 03-VALIDATION.md's Manual-Only row
  - An advertised-tool-contract finding (vice_disk_attach's D-14 approximation) handed to plan 13-05
affects: [13-05, docs/stock-vice-parity.md, stock-machine.ts]

actuals:
  tokens: 42000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns: ["directory-derived scan with minimum-count floor + shared real/planted predicate (assumption-label-discipline.test.ts, following hostpath-consumers.test.ts's precedent)"]

key-files:
  created:
    - .claude/mcp/vice/assumption-label-discipline.test.ts
  modified:
    - .claude/mcp/vice/broker-launch.mts
    - .claude/mcp/vice/resources/broker-launch.mjs
    - .claude/mcp/vice/stock-execution.ts
    - .claude/mcp/vice/stock-protocol.ts
    - .planning/phases/03-direct-tools/03-RESEARCH.md
    - .planning/phases/03-direct-tools/03-VALIDATION.md

key-decisions:
  - "A5's correction was resolved entirely through D-13-04's escape hatch: the only wrong claim behind A5 is vice_disk_attach's advertised D-14 approximation (a tool-contract promise to callers), so Task 2 made zero source/test changes for A5 and instead recorded a finding for plan 13-05 to file."
  - "The Assumptions Log rows in 03-RESEARCH.md were annotated in place (appended sentences on the A1/A2/A3/A5 table rows) rather than by adding a table column, because a new column would have touched A4's row too and violated the 'A4 byte-for-byte untouched' requirement."
  - "assumption-label-discipline.test.ts's own planted-violation test caught a real false-positive in this plan's own Task 1 edit: a general summary comment naming both A3 and A5 next to a literal [ASSUMED] token made the guard think A3's label survived even after the real per-row label was stripped in-memory. Reworded the summary comment (Task 3) rather than weaken the guard's detection window."

patterns-established:
  - "Pattern: label-discipline guards derive both their scanned file set (directory read + floor) and their real/planted detection logic from ONE shared predicate function, so the guard's own proof of non-vacuity cannot silently drift from what it actually checks."

requirements-completed: [EXTV-03]

coverage:
  - id: D1
    description: "A1 and A2's [ASSUMED] labels removed at every authored site, citing 13-PROBE-RESULTS.md's live observations"
    requirement: EXTV-03
    verification:
      - kind: unit
        ref: "assumption-label-discipline.test.ts#Assumptions Log row A1/A2: the [ASSUMED]-labelled file set is empty or exactly the expected complete set, never a partial strip"
        status: pass
    human_judgment: false
  - id: D2
    description: "A3 (INCONCLUSIVE) and A5 (CONTRADICTED) labels left untouched at every site; A5's tool-contract finding recorded for plan 13-05, no contract redesigned here"
    requirement: EXTV-03
    verification:
      - kind: unit
        ref: "assumption-label-discipline.test.ts#Assumptions Log row A3/A5: the [ASSUMED]-labelled file set is empty or exactly the expected complete set, never a partial strip"
        status: pass
    human_judgment: false
  - id: D3
    description: "assumption-label-discipline.test.ts: a committed, non-vacuous guard makes a half-stripped label a red automated gate"
    requirement: EXTV-03
    verification:
      - kind: unit
        ref: "assumption-label-discipline.test.ts#planted-violation: half-stripping row A3's label (removed from one site, kept on its sibling) is rejected by the shared predicate"
        status: pass
    human_judgment: false
  - id: D4
    description: "03-RESEARCH.md's A1/A2/A3/A5 rows and 03-VALIDATION.md's Manual-Only row record post-probe status; A4 left byte-for-byte untouched"
    requirement: EXTV-03
    verification:
      - kind: other
        ref: "diff against git show 1359ef7:.planning/phases/03-direct-tools/03-RESEARCH.md, A4 lines identical"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-22
status: complete
---

# Phase 13 Plan 04: Assumption Label Discipline Summary

**Closed A1/A2's `[ASSUMED]` labels against `13-PROBE-RESULTS.md`'s live verdicts, left A3/A5 untouched per their INCONCLUSIVE/CONTRADICTED verdicts, and shipped a committed guard that makes a half-stripped label a red automated gate.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-22T00:05:00Z (approx.)
- **Completed:** 2026-08-22T00:30:00Z (approx.)
- **Tasks:** 3 (Task 2 produced zero diff by design — see below)
- **Files modified:** 6 modified, 1 created

## Accomplishments

- Removed the `[ASSUMED]` label at every authored site A1 (`-remotemonitoraddress` spelling) and A2 (`ADVANCE_INSTRUCTIONS` step-over semantics) carried — `broker-launch.mts`, `stock-execution.ts`, `stock-protocol.ts` — citing `13-PROBE-RESULTS.md`'s live observations against fork VICE 3.10, and rebuilt `resources/broker-launch.mjs` from source in the same commit.
- Left A3 (`JOYPORT_SET` bit mapping, INCONCLUSIVE) and A5 (`AUTOSTART` `fileIndex` with `runAfter=false`, CONTRADICTED) labels exactly as they were at every site — `stock-input.ts` and `stock-protocol.ts`.
- Recorded the escape-hatch finding for A5: `vice_disk_attach`'s advertised D-14 approximation (`"AUTOSTART with the run flag clear"`, documented as "attach without loading or running anything") is empirically wrong per `13-PROBE-RESULTS.md` §A5 — the real binary still resets and loads a program. This is a tool-contract change, out of this plan's scope; handed to plan 13-05 as a todo (see "Escape Hatch Finding" below).
- Updated `03-RESEARCH.md`'s Assumptions Log rows A1/A2/A3/A5 with a post-probe status citing `13-PROBE-RESULTS.md`, leaving A4's row byte-for-byte identical to `HEAD` (verified by diff).
- Rewrote `03-VALIDATION.md`'s Manual-Only Verifications row to state which of A1/A2/A3/A5 are now exercised against a real binary.
- Shipped `assumption-label-discipline.test.ts`: a committed, non-vacuous guard (7 tests) enforcing that each Assumptions Log row's `[ASSUMED]`-labelled file set is empty or exactly the row's complete expected set, never a proper subset — with a directory-derived scan (floor 40, real count 68) and a planted-violation test proving the guard rejects a half-strip.

## Grep Inventory (Task 1, taken at execution time)

```
$ grep -rn '\[ASSUMED\]' .claude/mcp/vice --include='*.ts' --include='*.mts' | grep -v '/resources/' | grep -v '\.test\.'
.claude/mcp/vice/stock-input.ts:161:  ... JOYPORT_SET's `value` bit layout. **[ASSUMED]** -- RESEARCH.md   [A3]
.claude/mcp/vice/stock-input.ts:166:  ... Do not remove the [ASSUMED] label until that todo's acceptance   [A3, instruction sentence]
.claude/mcp/vice/broker-launch.mts:140: ... `[ASSUMED]` by symmetry with `-binarymonitoraddress`             [A1]
.claude/mcp/vice/stock-execution.ts:227: ... is [ASSUMED] -- RESEARCH.md Assumptions Log row A2               [A2]
.claude/mcp/vice/stock-protocol.ts:408: ... in its own JSDoc as [ASSUMED], naming the RESEARCH.md ...         [general convention statement, no row]
.claude/mcp/vice/stock-protocol.ts:742: ... step, matching the fork's own `stepOver` field name) is [ASSUMED] [A2]
.claude/mcp/vice/stock-protocol.ts:791: ... up/down/left/right/fire) is [ASSUMED] -- RESEARCH.md Assumptions  [A3]
.claude/mcp/vice/stock-protocol.ts:847: ... `fileIndex`'s behaviour when `runAfter` is false is [ASSUMED] --  [A5]
```

Cross-checked against the plan's expected shape (A1 in `broker-launch.mts`; A2 in `stock-execution.ts`+`stock-protocol.ts`; A3 in `stock-input.ts`+`stock-protocol.ts`; A5 in `stock-protocol.ts`): matches exactly, no unexpected site found. `stock-protocol.ts:408` is the module-level convention statement, general and row-agnostic — not attributed to any row.

Post-edit inventory (final state, verified by re-running the same grep):

```
.claude/mcp/vice/stock-input.ts:161,166   [A3 -- unchanged]
.claude/mcp/vice/stock-protocol.ts:408    [general convention statement -- unchanged]
.claude/mcp/vice/stock-protocol.ts:729    [general block comment -- reworded in Task 3, no row-specific label]
.claude/mcp/vice/stock-protocol.ts:796    [A3 -- unchanged]
.claude/mcp/vice/stock-protocol.ts:852    [A5 -- unchanged]
```

A1's and A2's occurrences are gone entirely. `git diff 1359ef7 -- stock-protocol.ts` confirms neither A3's (lines ~794-798) nor A5's (lines ~850-852) own label sentences were touched — only the surrounding general block comment and A2's own JSDoc changed.

## Task Commits

Each task was committed atomically (Task 2 produced no commit — see below):

1. **Task 1: Remove confirmed labels, update Assumptions Log** — `0cf3bea` (docs)
2. **Task 2: Regression-test/correct contradicted assumptions** — no commit (zero diff, escape hatch fired for the sole contradicted assumption, A5 — see below)
3. **Task 3: Assumption-label-discipline guard** — `3dc221f` (test), which also includes a small `stock-protocol.ts` reword the guard's own planted-violation test required (see Deviations)

**Plan metadata:** committed alongside this SUMMARY.

## Task 2: Why It Produced Zero Diff

`13-PROBE-RESULTS.md` records exactly one `CONTRADICTED` assumption: A5. Re-reading its "Consequences for plan 13-04" row and the "Advertised tool contract finding" section side by side: the only concrete wrongness A5 identifies is `vice_disk_attach`'s advertised D-14 approximation string — a promise `stock-machine.ts`'s `handleDiskAttach` makes to its caller ("attach a disk image without loading or running anything"), which `13-PROBE-RESULTS.md` shows is false (a full reset + program load happens regardless of `fileIndex`). This is *exactly* the escape hatch's own worked example ("the disk-attach tool's advertised no-side-effect approximation is false in a way a caller can observe").

There is no SEPARATE, offline-testable behavioural claim behind A5 beyond that tool contract — `autostartBody()`'s own JSDoc (`stock-protocol.ts` A5's label site) states only that `fileIndex`'s behaviour when `runAfter` is false is `[ASSUMED]`; the encoder's byte layout is unaffected by the contradiction (it already unconditionally encodes `fileIndex` regardless of `runAfter`), so there is no source bug to fix and no meaningful "fails before, passes after" regression test to write without a live emulator. Per the task's own hard rule ("A label removed before a regression test exists leaves the corrected behaviour unpinned"), the label at `stock-protocol.ts`'s `autostartBody()` JSDoc stays on.

**Escape Hatch Finding (for plan 13-05):**

`vice_disk_attach`'s advertised approximation is wrong, not merely unconfirmed. `stock-machine.ts`'s `handleDiskAttach` reports `approximation: "AUTOSTART with the run flag clear (D-14)"`, and `docs/stock-vice-parity.md`'s D-14 entry documents the intent as "attach a disk image without loading or running anything," distinct from `vice_autostart` (documented as loading/running). `13-PROBE-RESULTS.md` §A5 shows this is false: `AUTOSTART` with `runAfter=false` performs a full machine reset and loads a program from the attached image regardless of `fileIndex`, corroborated by the emulator's own log (`AUTOSTART: Resetting the machine to autostart '*'` / `AUTOSTART: Loading program '*'`) and by a byte-level read-back showing a BASIC program chain was relinked. Plan 13-05 should file a todo to: (1) correct `docs/stock-vice-parity.md`'s D-14 entry and `stock-machine.ts`'s `approximation` string to state the true side effects, and (2) consider whether `vice_disk_attach`'s contract needs restructuring (e.g., explicitly documenting the reset+load side effect, or reconsidering whether the tool should exist in its current form) so a caller is not misled about what the call does. Not redesigned here, per D-13-04's escape hatch.

## Files Created/Modified

- `.claude/mcp/vice/assumption-label-discipline.test.ts` — new guard (7 tests): row-by-row empty-or-exact-set check, module-convention presence check, minimum-scan-count floor, and a planted-violation non-vacuity proof.
- `.claude/mcp/vice/broker-launch.mts` — A1's label removed from `buildViceArgs()`'s JSDoc; rebuilt `resources/broker-launch.mjs`.
- `.claude/mcp/vice/stock-execution.ts` — A2's label removed from `handleExecutionStep`'s JSDoc.
- `.claude/mcp/vice/stock-protocol.ts` — A2's label removed from `advanceInstructionsBody()`'s JSDoc; the surrounding general block comment reworded twice (Task 1 to describe post-probe status, Task 3 to remove a spurious `[ASSUMED]`/row-letter proximity the guard's own planted-violation test caught); A3's and A5's own label sentences untouched.
- `.planning/phases/03-direct-tools/03-RESEARCH.md` — Assumptions Log rows A1/A2/A3/A5 each gained a "Post-probe status" sentence citing `13-PROBE-RESULTS.md`; A4's row untouched.
- `.planning/phases/03-direct-tools/03-VALIDATION.md` — Manual-Only Verifications row rewritten to state current status of A1/A2/A3/A5, naming A4 as still open.

## Decisions Made

- A5 resolved entirely via the escape hatch (see above) — no source correction, no regression test, label stays on, finding recorded for 13-05.
- `03-RESEARCH.md`'s Assumptions Log table rows were annotated in place (appended sentences within the existing "Risk if Wrong" cell) rather than via a new table column, specifically to keep A4's row byte-for-byte untouched — a new column would have required an (even empty) cell edit on A4's row too.
- The general block comment in `stock-protocol.ts` (lines ~722-730, naming which rows remain assumed) was reworded twice: once in Task 1 for accuracy after A2 closed, and again in Task 3 after `assumption-label-discipline.test.ts`'s own planted-violation test caught it creating a false "row still fully labelled" result (a literal `[ASSUMED]` token followed closely by both "A3" and "A5" tokens in a summary sentence, distinct from A3's real per-row label site, was making the guard's proximity-window detector attribute A3's label to `stock-protocol.ts` even after the real label was stripped in-memory for the planted test). This is recorded as a deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a general comment in `stock-protocol.ts` to fix a false positive in the new label-discipline guard**
- **Found during:** Task 3, writing the planted-violation non-vacuity test
- **Issue:** Task 1's general block comment ("...rows A3 and A5 remain `[ASSUMED]` -- A3 stayed INCONCLUSIVE ... and A5 was CONTRADICTED...") placed a literal `[ASSUMED]` token within the guard's lookahead window of both "A3" and "A5" tokens. This made `rowsNamedByAssumedLabels()` attribute row A3 to `stock-protocol.ts` from THIS general sentence, independent of A3's real per-row label site (lines 794-798). The planted-violation test — which strips only the real per-row label from an in-memory copy — then found A3 was still (spuriously) attributed to the file, because the general sentence's `[ASSUMED]` token was untouched.
- **Fix:** Reworded the general comment to state the same information without placing an `[ASSUMED]` token in proximity to a row letter+digit, moving the actual `[ASSUMED]` reference to a generic phrase ("each of those two encoders' own JSDoc, below, still carries its own [ASSUMED]") that names no specific row within the lookahead window.
- **Files modified:** `.claude/mcp/vice/stock-protocol.ts`
- **Verification:** `assumption-label-discipline.test.ts`'s planted-violation test passes; the row-by-row real-scan tests still pass; `git diff` confirms A3's and A5's own label sentences (the actual enforcement targets) are unchanged.
- **Committed in:** `3dc221f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — guard false-positive caused by this plan's own earlier edit).
**Impact on plan:** The fix is a comment reword with zero effect on the label state of any row; it was necessary for the guard's own non-vacuity proof to be trustworthy. No scope creep.

## Issues Encountered

None beyond the deviation above (caught and fixed by the guard's own test, exactly as the plan intended a guard-writing task to do).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 13-05 has one concrete, well-scoped todo to file: correct `vice_disk_attach`'s advertised D-14 approximation (docs + `stock-machine.ts`'s `approximation` string) to match the confirmed real behaviour, and decide whether the tool's contract needs restructuring.
- A3 and A5 remain genuinely open (INCONCLUSIVE / CONTRADICTED-but-unresolved) — no further action is expected from this plan; any future probe extension for A3 (varying the wire `port` value, or checking a running-program precondition) is a candidate for a fresh todo, not something this plan closes.
- `assumption-label-discipline.test.ts` is now a permanent, automated backstop: any future attempt to close A3 or A5 partially (one site edited, its sibling left behind) will fail this guard immediately.

---
*Phase: 13-external-verification*
*Completed: 2026-08-22*

## Self-Check: PASSED

- All 7 key files (created + modified) confirmed present on disk.
- Both task commits (`0cf3bea`, `3dc221f`) confirmed in `git log --oneline --all`.
- Re-ran every task's `<acceptance_criteria>` command: all passed (see inline command output captured during execution — A4 row byte-identical, `[ASSUMED]` inventory matches expectation exactly, `tsc --noEmit` clean, `npm run test:automated` 2086 tests / 2086 pass / 0 fail, up from 2079 pre-plan).
- Re-ran the plan-level `<verification>` block: `node --test assumption-label-discipline.test.ts resources-sync.test.ts docs-dangling-refs.test.ts` — 17/17 pass; `node scripts/check-npm-packages.mjs` — OK, new test file leaked into neither tarball.
