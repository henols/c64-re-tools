---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 02
subsystem: docs
tags: [planning-artifacts, claude-md, text-monitor, remotemonitor, ledger-guard]

requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "The original (incorrect) Pitfall 5 and Alternatives Considered row this plan corrects"
provides:
  - "07-RESEARCH.md's Pitfall 5 and Alternatives Considered row, corrected to keep the narrow t_binary_command claim and name -remotemonitor/monitor_network.c as the third route"
  - "Three CLAUDE.md Constraints bullets scoped with a binary-monitor-only clause and their measured text-channel remedy"
  - "A cross-reference in stock-vice-migration-revised-loss-ledger.md recording the contradiction and Phase 39 as where the port was first dialed"
  - "The phase-7-pitfall-5 todo closed through docs-deferred-ledger.test.ts's two-directional guard"
affects: [39-the-dual-channel-coexistence-gate-go-degrade-no-go]

actuals:
  tokens: 12000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md
    - CLAUDE.md
    - .planning/notes/stock-vice-migration-revised-loss-ledger.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md

key-decisions:
  - "Corrected only the generalization in 07-RESEARCH.md's Pitfall 5 and Alternatives row, not Phase 7's decision to reject the text route for the cycle bracket — the outcome may still stand even though its stated reason rested on a false premise."
  - "Scoped all three CLAUDE.md constraints with a 'binary monitor only' clause rather than deleting or weakening any of them, since each is literally true of the binary monitor."
  - "Left the sibling warp/headless todo (2026-08-26-run-vice-headless...) untouched after re-checking it: it was already resolved by Phase 33 independently, and its own Resolution text already incorporates this correction."

requirements-completed: []

coverage:
  - id: D1
    description: "07-RESEARCH.md's Alternatives Considered row and Pitfall 5 corrected: narrow claim survives, generalization dropped, -remotemonitor/monitor_network.c named"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -c 'monitor_network.c'/'-remotemonitor'/'t_binary_command' 07-RESEARCH.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three CLAUDE.md Constraints bullets scoped with 'binary monitor only' clauses, original text intact"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -c 'binary monitor only' CLAUDE.md >= 3"
        status: pass
      - kind: unit
        ref: "docs-linerefs.test.ts, docs-dangling-refs.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "stock-vice-migration-revised-loss-ledger.md cross-references the contradiction and 07-RESEARCH.md by path"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -c '07-RESEARCH.md' stock-vice-migration-revised-loss-ledger.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Todo closed through docs-deferred-ledger.test.ts's two-directional guard: file moved to completed/ with a Resolution section, STATE.md row removed, both in the same commit; historical v0.7.0 audit row untouched"
    requirement: "CHAN-01"
    verification:
      - kind: unit
        ref: "docs-deferred-ledger.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 02: Correct Pitfall 5's overgeneralized text-monitor-unreachable claim, close the todo Summary

**Corrected `07-RESEARCH.md`'s Pitfall 5 and three distorted `CLAUDE.md` constraints to name `-remotemonitor`/`monitor_network.c` as the genuinely reachable text-monitor route, then closed the originating todo through the two-directional ledger guard.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-07T20:22:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `07-RESEARCH.md`'s Alternatives Considered row and Pitfall 5 keep the narrow, correct claim (`monitor_binary.c`'s `enum t_binary_command` has no execute-monitor-command-text opcode, on any VICE version) and drop the false generalization that the text monitor is reachable only from the interactive console. Both now name `-remotemonitor` / `monitor_network.c` explicitly, with a visible correction marker citing Phase 39 and the live-probe note. Phase 7's decision to reject the text route is preserved verbatim; only its stated reason is corrected, with an explicit sentence that the decision rested on a false premise even though the outcome may still stand.
- All three `CLAUDE.md` Constraints bullets this distortion produced (`CPUHISTORY_GET` version floor, no-runtime-`WarpMode`, `default_memspace` no-remedy) each gained a `binary monitor only` scoping clause naming the measured text-channel remedy (`chis` over text channel on stock 3.9, runtime `warp on`/`warp off`, `device c:`). Original assertions are untouched — nothing was deleted or weakened.
- `stock-vice-migration-revised-loss-ledger.md`'s Loss 5 (which already had the correct finding) now cross-references the contradiction with `07-RESEARCH.md`'s Pitfall 5 and records Phase 39 as where the port was first dialed.
- The originating todo is closed: moved to `.planning/todos/completed/` with a Resolution section, its `STATE.md` `## Deferred Items` row removed, both landing in the same commit per the two-directional ledger guard's requirement. The historical v0.7.0 audit-acknowledgement row for the same stem is untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct the overgeneralized claim, scope the three constraints** - `1ff67138` (docs)
2. **Task 2: Close the todo through the two-directional ledger guard** - `e7b51683` (docs)

**Corrective follow-up** (deviation, see below): `fe7670fa` (docs) — added the Resolution-section content that a failed multi-path `git add` had silently dropped from `e7b51683`.

_Note: no plan-metadata commit is listed separately — see the final commit note below._

## Files Created/Modified
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md` - Alternatives Considered row and Pitfall 5 corrected with a visible marker
- `CLAUDE.md` - three Constraints bullets gained `binary monitor only` scoping clauses
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md` - cross-reference to the corrected `07-RESEARCH.md`
- `.planning/STATE.md` - `## Deferred Items` row for the closed todo removed
- `.planning/todos/completed/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md` - moved from `pending/`, Resolution section appended

## Decisions Made
- Corrected only the *stated reason* behind Phase 7's rejection of the text route, not the decision itself — the decision may still be correct on its own merits (second channel, ownership question, halt-on-command semantics).
- Scoped, never deleted, the three CLAUDE.md constraints — each is literally true of the binary monitor.
- Left the sibling pending-turned-completed todo `2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it` exactly as found: it was re-checked per this plan's instruction and found already resolved by Phase 33 (2026-09-03), independent of this plan, with its own Resolution section already citing this same correction (runtime `warp on`/`off` over the text channel, not a launch-time dimension). Nothing was open to act on, so nothing was changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recovered a silently-dropped edit from a failed multi-path `git add`**
- **Found during:** Task 2 (closing the todo)
- **Issue:** After `git mv`-ing the todo file and then editing it to add a `## Resolution` section, a `git add` invocation naming three paths (the now-nonexistent `pending/` path, the `completed/` path, and `STATE.md`) failed with `fatal: pathspec ... did not match any files` for the stale pending path. That failure aborted the whole `git add` call before it staged the Resolution-section content-diff on the `completed/` file (the rename itself was already staged by `git mv`, so it looked committed but carried a 0-line diff). The commit `e7b51683` therefore contained only the rename and the STATE.md row removal — the Resolution content was still sitting unstaged in the working tree afterward.
- **Fix:** Verified with `git status`/`grep` that the Resolution section was present on disk but absent from the last commit's diff, staged it explicitly, and committed it as a follow-up (`fe7670fa`).
- **Files modified:** `.planning/todos/completed/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md`
- **Verification:** `git show --name-only e7b51683` still lists both the completed path and `.planning/STATE.md` (satisfying the plan's "same commit" acceptance criterion for the move + row removal); `grep -c 'Resolution' <file>` now returns 2 (heading + prose reference) and the content is now on HEAD.
- **Committed in:** `fe7670fa`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — bug in my own commit-staging sequence, not in the plan's instructions).
**Impact on plan:** No scope creep. The plan's "same commit" requirement (file move + Deferred Items row removal) is satisfied by `e7b51683` regardless; the Resolution section's prose content simply landed one commit later than intended.

## Issues Encountered
None beyond the deviation above.

## Verification Results

- `07-RESEARCH.md` contains `monitor_network.c` (2×), `-remotemonitor` (3×), `t_binary_command` (2×) — PASS
- `CLAUDE.md` contains `binary monitor only` at least 3 times (measured 3) — PASS
- `node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts` (run from `src/mcp/vice`): 27 tests, `fail 0` — PASS
- `stock-vice-migration-revised-loss-ledger.md` cites `07-RESEARCH.md` — PASS
- Todo moved to `completed/` with a Resolution section; `## Deferred Items` row gone; v0.7.0 audit-acknowledgement row for the same stem intact — PASS (`LEDGER_MOVE_OK`)
- `npm run test:automated` (from `src/mcp/vice`): **3 failing / 3552** (`anno-import.test.ts` line 352, `anno-register.test.ts` lines 385 and 479) across three separate runs; a fourth, non-reproducing failure (`check-skill-fork-honesty` in `skill-honesty-checks.test.ts`/`audit-root-args.test.ts`) appeared in exactly one of three runs, consistent with this project's recorded scratch-directory race and not attributable to this plan's changes (this plan touched no source files, only planning docs and `CLAUDE.md` prose). No file this plan modified is a test target of any failing test. This is a **relation**, not an absolute-zero claim: no new failure was introduced relative to the pre-existing baseline this run observed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The premise this phase measures (the text-monitor channel is reachable and unclaimed) is now stated correctly at its origin, so plans 39-03 through 39-08's probes are no longer contradicted by an incorrect artifact in this same tree.
- `CHAN-01` is declared by all 8 plans in this phase and is a shared requirement — it is intentionally left unmarked-complete here (`requirements.ready-ids` gate) until every declaring plan's SUMMARY exists.
- No blockers for the remaining wave-1/wave-2 plans.

## Self-Check: PASSED

- All 5 key files verified present on disk (`[ -f ]`).
- All 3 task/deviation commit hashes (`1ff67138`, `e7b51683`, `fe7670fa`) verified present in `git log --oneline --all`.
- Re-ran plan-level `<verification>`: `node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts` → 27 tests, fail 0.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
