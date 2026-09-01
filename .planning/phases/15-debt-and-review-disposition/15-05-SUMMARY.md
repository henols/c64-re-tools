---
phase: 15-debt-and-review-disposition
plan: 05
subsystem: testing
tags: [review-disposition, stock-connect, shell-injection-gate, evidence-immutability]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "plan 15-04's disposition of 03-REVIEW.md's eight findings, and 15-01's widened docs-review-disposition.test.ts guard that surfaces every undispositioned finding across all *-REVIEW.md files"
provides:
  - "02-REVIEW.md's IN-05 fixed at source: stockReconnect()'s thrown message now names itself, pinned by a derived where:-vs-message-prefix invariant test"
  - "09-REVIEW.md's IN-01, IN-02, IN-03 recorded wont-fix on evidence-immutability grounds, closing the second of GATE-02's two explicitly-named phases"
  - "13-REVIEW.md's WR-01 confirmed already fixed (commit f73d0fa) and mechanically pinned by a derived readdirSync-based sh -c interpolation gate; WR-02/IN-01 deferred with named reopen triggers; IN-02 promoted to plan 15-12 with a named owner"
affects: [15-debt-and-review-disposition, 15-12]

actuals:
  tokens: 7200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Derived (not literal-string) regression pin: scan the source's own throw-statement/argv shape with a regex (message-prefix-vs-where field pairing; sh -c interpolation detection) rather than asserting a hardcoded string, so the assertion survives future wording changes and generalizes past the single call site the finding named."
    - "readdirSync-derived file-set scanning for a security-shape gate: reused this repo's established topLevelProductionModules()/stripCommentLines() convention (hostpath-consumers.test.ts, anno-launch.test.ts) rather than hand-typing a file list, so the gate covers every current and future top-level production .ts/.mjs file in .claude/mcp/vice, not just probe-binmon.mjs."
    - "Two-commit task shape for a fix-then-cite disposition: when a todo's Resolution must cite the commit that lands the fix, split the task into a code commit followed by a docs commit citing that now-resolvable sha, rather than inventing a placeholder."

key-files:
  created:
    - .planning/todos/completed/2026-08-22-phase-02-review-in-05-stockreconnect-names-the-wrong-function.md
  modified:
    - .claude/mcp/vice/stock-connect.ts
    - .claude/mcp/vice/stock-connect.test.ts
    - .planning/todos/pending/2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md (moved to completed/)
    - .planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md (moved to completed/)
    - .planning/STATE.md

key-decisions:
  - "13-REVIEW.md WR-01: confirmed already fixed at plan time (commit f73d0fa) rather than re-implementing the review's own suggested two-line fix, per this plan's explicit correction to 15-RESEARCH.md's stale row. probe-binmon.mjs was not touched by this plan."
  - "IN-05's derived pin generalizes past the single stockReconnect() site: the regex pairs any `where: \"stock-connect.ts:<fn>\"` throw with its own message prefix, so a future such throw added inside stockConnect() itself is covered by the same test, not just the one site named."
  - "WR-01's pin scans the derived top-level production file SET (readdirSync over .claude/mcp/vice, excluding *.test.*), not just probe-binmon.mjs, so any future caller-derived sh -c interpolation anywhere in this directory trips the same gate."
  - "IN-02 (13-REVIEW.md) recorded as a promotion with a named owner (plan 15-12) rather than a wont-fix, since the scoping omission is in code-review.md's file-list derivation -- GSD tooling outside this repo's own source, not a defect this project's plans can fix."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "02-REVIEW.md IN-05 fixed: stockReconnect()'s thrown MachineRestartedError message now begins \"stockReconnect:\" instead of \"stockConnect:\", matching its own where field. Pinned by a derived test that scans stock-connect.ts for every where:-carrying throw and asserts the message prefix names the same function."
    requirement: null
    verification:
      - kind: unit
        ref: "stock-connect.test.ts#02-REVIEW.md IN-05 pin: every thrown message naming a function via a where: field is prefixed with that SAME function's name"
        status: pass
      - kind: other
        ref: "planted-revert probe: temporarily restored the old 'stockConnect:' prefix, confirmed the new test FAILS naming the exact mismatch, then restored the fix and reconfirmed 38/38 (was 37/37) passing"
        status: pass
    human_judgment: false
  - id: D2
    description: "09-REVIEW.md IN-01/IN-02/IN-03 recorded wont-fix on evidence-immutability grounds; the tracking todo moved to completed/ with a per-finding Resolution table; not one byte under Phase 09's directory changed."
    requirement: null
    verification:
      - kind: unit
        ref: "docs-review-disposition.test.ts (11/11 pass, all findings dispositioned)"
        status: pass
      - kind: unit
        ref: "docs-deferred-ledger.test.ts (4/4 pass, both directions)"
        status: pass
      - kind: other
        ref: "git diff --stat HEAD -- .planning/phases/09-the-assumption-probe-go-no-go/ is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "13-REVIEW.md's four findings dispositioned: WR-01 confirmed already fixed (commit f73d0fa) and mechanically pinned by a new readdirSync-derived sh -c interpolation gate covering every top-level production file in .claude/mcp/vice; WR-02 and IN-01 deferred with named reopen triggers; IN-02 promoted to plan 15-12 with a named owner."
    requirement: null
    verification:
      - kind: unit
        ref: "stock-connect.test.ts#13-REVIEW.md WR-01 pin: no production .ts/.mjs file in .claude/mcp/vice interpolates a template placeholder into a sh -c command string"
        status: pass
      - kind: other
        ref: "planted-violation probe: added a scratch .mjs with an interpolated sh -c command to .claude/mcp/vice, confirmed node --test stock-connect.test.ts FAILED naming that exact file and snippet, then deleted the scratch file and reconfirmed 39/39 passing"
        status: pass
      - kind: other
        ref: "git diff --stat HEAD -- .claude/mcp/vice/probe-binmon.mjs is empty across every commit this plan made"
        status: pass
    human_judgment: false

duration: 45min (approx.)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 5: Close 02-REVIEW.md IN-05, Disposition Phase 09 and Phase 13 Findings Summary

**Fixed the one genuinely open v0.2.0 code-review straggler (stockReconnect()'s misnamed thrown message), recorded Phase 09's three evidence-harness findings wont-fix on evidence-immutability grounds, and dispositioned Phase 13's four findings — confirming its one fixable item (WR-01) was already landed at commit f73d0fa and pinning it mechanically rather than re-implementing a stale-premise fix.**

## Performance

- **Duration:** 45 min (approx.)
- **Started:** 2026-08-22T15:35:00Z (approx.)
- **Completed:** 2026-08-22T16:20:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 6 (1 created, 3 modified, 2 renamed+modified)

## Accomplishments

- **02-REVIEW.md IN-05** (`stock-connect.ts`): `stockReconnect()`'s thrown `MachineRestartedError` message now begins `"stockReconnect:"` instead of `"stockConnect:"`, matching the `where` field it already set correctly. Pinned by a new derived test in `stock-connect.test.ts` that scans `stock-connect.ts`'s own source for every `where: "stock-connect.ts:<fn>"` throw site and asserts the message's own leading prefix names the same function — not a literal-string assertion, so it also covers any future such throw added inside `stockConnect()` itself. Confirmed non-vacuous: temporarily restored the old prefix, the new test failed naming the exact mismatch (`thrown message is prefixed "stockConnect:" but its own where: field names "stockReconnect"`), then the fix was restored and the suite reconfirmed 38/38 (was 37/37). Filed as a new completed todo citing commit `9849224`, superseding the earlier straggler entry in `.planning/todos/completed/2026-08-21-phase-10-and-11-review-residual-dispositions.md` and STATE.md's "Also carried, not blocking" paragraph.
- **09-REVIEW.md IN-01/IN-02/IN-03**: all three recorded `wont-fix` in the tracking todo (moved `pending/` → `completed/`), executing the todo's own recommendation. `evidence/vice-tool-harness.mjs` and `evidence/mcp-harness.mjs` are throwaway probe harnesses whose committed transcripts back the milestone's `degrade`/`R4` verdict recorded in `docs/phase9-external-analyser-probe-findings.md`; editing a harness after the fact would break the provenance link between the harness in the tree and the evidence it produced. A per-finding `Id | File | Verdict | Reason` table names all three, plus a stated reopen consequence (any future re-run of a harness must fix it first and record fresh transcripts, never retro-fit these). `git diff --stat` over `.planning/phases/09-the-assumption-probe-go-no-go/` is empty.
- **13-REVIEW.md's four findings**:
  - **WR-01** confirmed **already fixed at source** — `checkCommandAvailable()` (`probe-binmon.mjs:1493-1496`) passes the binary name as positional `$1`, never spliced into the shell command line, landed in commit `f73d0fa` (which predates this plan). Verified live: `probe-binmon.mjs` was NOT re-touched by this plan (`git diff --stat` empty across every commit). Correction to `15-RESEARCH.md`, as this plan's own execution context flagged: its row calling for a two-line fix here was stale. Pinned mechanically with a new `readdirSync`-derived test in `stock-connect.test.ts` that scans every top-level production `.ts`/`.mjs` file in `.claude/mcp/vice` (reusing this repo's established `topLevelProductionModules()`/`stripCommentLines()` convention) for the forbidden `sh -c` interpolation shape. Confirmed non-vacuous: a scratch `.mjs` containing the interpolated form was added, `node --test stock-connect.test.ts` failed naming that exact file and code snippet, then the scratch file was deleted and the suite reconfirmed 39/39.
  - **WR-02** deferred with intent: `probe-binmon.mjs` is now 2435 lines (was 2429 when filed) across the same five usage modes. Splitting it now would rewrite the file that produced Phase 13's committed probe transcripts — the same evidence-immutability argument governing Phase 09's harnesses. Reopens when a sixth probe mode is actually added.
  - **IN-01** `wont-fix` for now: `probeA3JoyportBits()`'s `clearedInDc00 || clearedInDc01` short-circuit is confirmed still live; matters only if A3 is re-probed, and A3 is `INCONCLUSIVE` today with its `[ASSUMED]` label still on `stock-input.ts`'s `JOYPORT_BITS`. Reopens by tightening `polarityNotes` to report both CIA1 ports independently *before* any A3 re-probe.
  - **IN-02** promoted out of this repo: the scoping omission is in `.claude/gsd-core/workflows/code-review.md`'s `files:` derivation (matched `.txt`/`.json` evidence pairs should be scoped as a unit) — GSD tooling, not this project's source. Owner named explicitly: **plan 15-12**, which records the promotion in `REQUIREMENTS.md` → Future Requirements.
  - Todo moved `pending/` → `completed/` with a per-finding `Id | Verdict | Evidence or trigger | Owner` table; `## The transferable half`'s cross-phase structural analysis carried forward verbatim, unedited.
- `STATE.md`'s Deferred Items ledger reconciled across all three closures in the same commits as each: pending count 20 → 19 (Phase 09) → 18 (Phase 13); table row count and prose counts kept in sync (18 `todo` rows + 1 `uat_gap` = 19 total items, matching the updated prose).
- `GATE-02` was **NOT** marked complete by this plan, per the shared-ID gate (#2388) and this phase's established convention (plans 15-02, 15-03, 15-04 all deferred it the same way) — it closes when plan 15-12, the last plan declaring it, finishes.

## Task Commits

Each task was committed atomically (Task 1 split into two commits — code fix, then the docs commit citing that now-resolvable sha, since the todo's Resolution must cite the commit that lands the fix):

1. **Task 1a: Fix stockReconnect()'s misnamed thrown message + derived pin** - `9849224` (fix)
2. **Task 1b: Record 02-REVIEW.md IN-05 as fixed, superseding the earlier straggler entry** - `373aa52` (docs)
3. **Task 2: Disposition 09-REVIEW.md's IN-01..IN-03 wont-fix on evidence immutability** - `a43be35` (docs)
4. **Task 3: Disposition 13-REVIEW.md's four findings, pin WR-01's already-landed fix** - `e85794b` (docs)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.claude/mcp/vice/stock-connect.ts` - IN-05 fix: `stockReconnect()`'s thrown message prefix corrected
- `.claude/mcp/vice/stock-connect.test.ts` - two new derived source-level pins (IN-05 message-prefix-vs-where invariant; WR-01 sh -c interpolation gate over the derived production file set)
- `.planning/todos/completed/2026-08-22-phase-02-review-in-05-stockreconnect-names-the-wrong-function.md` - new completed todo citing commit `9849224`
- `.planning/todos/completed/2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md` - moved from `pending/`; `## Resolution` section added with per-finding table
- `.planning/todos/completed/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md` - moved from `pending/`; `## Resolution` section added with per-finding table
- `.planning/STATE.md` - Deferred Items ledger reconciled (two rows removed, prose counts corrected 20 → 18 pending), "Also carried, not blocking" paragraph corrected to no longer describe IN-05 as open

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) WR-01 was cited and pinned, not re-implemented, after confirming live that commit `f73d0fa` already landed the fix; (2) both new test pins are derived source scans (regex over the actual throw statement / `readdirSync`-derived file set) rather than literal-string assertions, so each generalizes past the single site its finding named; (3) IN-02 was recorded as a promotion with a named owner (plan 15-12) rather than a `wont-fix`, since the defect lives in GSD tooling outside this repo.

## Deviations from Plan

None - plan executed exactly as written. The one correction the plan itself flagged in advance (13-REVIEW.md WR-01 already fixed, 15-RESEARCH.md's row is stale) was executed as instructed, not discovered as a deviation during this plan's own execution.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`02-REVIEW.md`'s `IN-05`, `09-REVIEW.md`'s `IN-01`..`IN-03`, and `13-REVIEW.md`'s `WR-01`/`WR-02`/`IN-01`/`IN-02` — the three remaining GATE-02 clusters outside Phase 08 and Phase 03 — all now carry cited, commit-referencing or explicitly-triggered dispositions. `docs-review-disposition.test.ts` and `docs-deferred-ledger.test.ts` both run green (11/11, 4/4). `IN-02`'s promotion is handed to plan 15-12 by name, to be recorded in `REQUIREMENTS.md` → Future Requirements. `GATE-02` remains open (by design — shared-ID gate, closes with plan 15-12). No blockers for the remaining phase 15 plans.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All modified/created files confirmed present on disk (`stock-connect.ts`, `stock-connect.test.ts`, all three completed todos, `STATE.md`, this SUMMARY). All four commits confirmed in `git log` (`9849224`, `373aa52`, `a43be35`, `e85794b`). Plan-level `<verification>` re-run: `npm run typecheck` exits 0; `npm run test:automated` exits 0 (2110 tests, 2105 pass, 0 fail, 5 pre-existing todo); `node --test docs-review-disposition.test.ts docs-deferred-ledger.test.ts` exits 0 (11/11 pass); `git diff --stat` over `.planning/phases/09-the-assumption-probe-go-no-go/` and `.claude/mcp/vice/probe-binmon.mjs` is empty; all three completed todos each contain their own review filename (`02-REVIEW.md`, `09-REVIEW.md`, `13-REVIEW.md` respectively) plus a `## Resolution` heading.
