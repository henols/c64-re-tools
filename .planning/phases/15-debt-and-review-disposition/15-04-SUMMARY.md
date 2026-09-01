---
phase: 15-debt-and-review-disposition
plan: 04
subsystem: testing
tags: [stock-registers, stock-live, vice-proxy-test, review-disposition, register-cache]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "plan 15-01's widened docs-review-disposition.test.ts parser (discovers 03-REVIEW.md's 14 level-4 findings) and the pending todo it filed enumerating this plan's eight-finding workload, with per-finding pre-verification against current source"
provides:
  - "03-REVIEW.md's eight newly-surfaced findings (WR-06, WR-07, WR-08, IN-02, IN-03, IN-04, IN-05, IN-06) each carry a landed fix and a cited verdict in a completed todo"
  - "registerCatalogFor() caches the in-flight promise (not the resolved value), closing a real concurrent-duplicate-fetch race, evicting on rejection so failures are retried"
  - "vice-proxy.test.ts's vice-proxy: identity detector no longer exempts a literal reached via throw new/Error(, and its text: marker is word-boundary-anchored"
  - "README.md's Development section and Environment table match current source (eight manual-only files, VICE_LIVE_STOCK_BIN documented)"
affects: [15-debt-and-review-disposition, 15-12]

actuals:
  tokens: 9822
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "In-flight-promise caching: cache the async function's own returned promise (constructed via an inner async IIFE, before any await in the caller-visible function), not the resolved value, so two synchronous callers on the same tick share one in-flight request; evict on rejection via a fire-and-forget .catch() so a failed fetch is retried, never memoised."
    - "Live-source-only verification for a file that cannot be executed: when a *.test.ts file is MANUAL_ONLY_TESTS-listed and hangs outside a devcontainer, verify a logic change by extracting the exact function into a standalone throwaway script (outside the repo, in the scratchpad) and running IT — never `node --test` on the forbidden file itself — plus a full manual grep audit of every marker occurrence in the real source the change could affect."
    - "Planted-revert non-vacuity proof: temporarily revert the fix in place (via a scripted string-replace, not git), run the new test, confirm it fails with the exact pre-fix symptom, then restore byte-identically and re-confirm green — applied twice here (concurrency send-count, rejection-eviction) since a single revert did not exercise both code paths."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-live.test.ts
    - .claude/mcp/vice/stock-registers.ts
    - .claude/mcp/vice/stock-registers.test.ts
    - .claude/mcp/vice/vice-proxy.test.ts
    - .claude/mcp/vice/README.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-22-phase-03-review-wr-06-through-in-06-never-dispositioned.md

key-decisions:
  - "WR-06: took the review's first offered fix (delete the false sentence) over its second (accept only slash-prefixed values) — the second changes opt-in behavior for a live test suite, out of a disposition plan's remit."
  - "WR-08 and IN-03: the plan's own action text claimed both were moot/superseded (a premise 15-01 had already flagged as false in its own SUMMARY). Re-verified directly against current source per this plan's own objective, confirmed both were STILL OPEN (README still said 'three' against an actual eight and still omitted VICE_LIVE_STOCK_BIN; OPEN_SERVERS still had exactly one .add() call site, never a NetServer), and fixed the real bugs rather than recording a false 'superseded' verdict. This is a documentation-accuracy correction of the plan's own claim, following the same evidence-over-inference standard 15-01 already established, not a scope change."
  - "WR-07: re-verified rather than assumed superseded. Both defects the review named (throw-new false-negative class, text: mid-word match on context:) were still present at the detector's current, drifted line range (:3869-3890, not the review's :3856-3875). Fixed both, verified via a standalone throwaway probe reproducing the exact same logic plus a manual grep audit of every throw new/Error(/context: occurrence in the real vice-proxy.ts (three total, none closer to any vice-proxy: literal than that literal's own console.error() call) — vice-proxy.test.ts itself was never executed, honoring the plan's prohibition (it is MANUAL_ONLY_TESTS entry 2 and hangs outside a devcontainer)."
  - "IN-05 discovery (out of scope, not fixed): the plan's read_first claimed 'no other *.test.ts in this directory carries [a shebang]' as the basis for calling the fix 'convergence with the local convention.' Direct verification found six OTHER manual-only/live test files (fork-live.test.ts, anno-launch.test.ts, spawn-seam.test.ts, stock-broker-live.test.ts, stock-live-broker-monitor.test.ts, stock-live-triage.test.ts) also carry the identical non-executable shebang. Fixed stock-live.test.ts per the plan's explicit instruction (still the right fix — a non-executable file should not carry an interpreter shebang) but did NOT expand scope to the other six files; logged as a pre-existing, out-of-scope finding per the deviation scope boundary."

patterns-established:
  - "A pending todo's per-finding verdict table now has a completed-todo precedent for citing a 'temporarily reverted, confirmed the new test fails, then restored' proof directly in the Resolution's Evidence cell, not just in the SUMMARY."

requirements-completed: []

coverage:
  - id: D1
    description: "WR-06, IN-05, IN-06 fixed in stock-live.test.ts: the three opt-in skip messages no longer promise an unreachable fallback, the file carries no interpreter shebang, and the live flag-refusal assertion is anchored to the handler's full emitted phrase instead of a bare register name."
    requirement: null
    verification:
      - kind: unit
        ref: "stock-live.test.ts (node --test): 14 tests, 14 skipped, exit 0 — unchanged shape"
        status: pass
      - kind: other
        ref: "grep -v -E '^\\s*(//|\\*|/\\*)' stock-live.test.ts | grep -c 'truthy non-path' -> 0; head -1 stock-live.test.ts | grep -c 'usr/bin/env' -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "IN-02 fixed: registerCatalogFor() caches the in-flight promise (not the resolved catalog) and evicts on rejection, closing the concurrent-duplicate-fetch race; IN-04 fixed: the drifted stock-registers.ts:260-268 citation replaced with a plan/commit citation."
    requirement: null
    verification:
      - kind: unit
        ref: "stock-registers.test.ts#registerCatalogFor: two concurrent calls on a fresh session send exactly one REGISTERS_AVAILABLE"
        status: pass
      - kind: unit
        ref: "stock-registers.test.ts#registerCatalogFor: a rejected fetch is evicted so the next call retries instead of replaying the failure"
        status: pass
      - kind: other
        ref: "planted-revert probe: both new tests confirmed to FAIL against a temporarily-reverted implementation (send count 2; replayed rejection), then restored and re-confirmed passing"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-07 re-verified STILL OPEN and fixed: vice-proxy.test.ts's identity detector no longer exempts a throw new/Error(-reached literal, and its text: marker cannot match mid-word inside context:."
    requirement: null
    verification:
      - kind: other
        ref: "standalone throwaway probe (scratchpad, never vice-proxy.test.ts): 6/6 control assertions pass, real vice-proxy.ts source shows 0 violations (unchanged)"
        status: pass
      - kind: unit
        ref: "npm run typecheck (vice-proxy.test.ts compiles clean)"
        status: pass
    human_judgment: true
    rationale: "vice-proxy.test.ts is MANUAL_ONLY_TESTS entry 2 and hangs outside a devcontainer (confirmed timing out at 150s on 2026-08-13) — this plan's own prohibition forbids running it. The fix is verified by source assertion, a standalone logic-equivalent probe, and typecheck, but never by node --test on the real file; a human (or a future devcontainer run) is the only route to execute-time confirmation."
  - id: D4
    description: "IN-03 re-verified STILL OPEN and fixed: OPEN_SERVERS narrowed from Set<Server | NetServer> to Set<Server>, since no net.Server (control-plane socket) was ever added to it — each is already closed by its own local try/finally — and closeAllConnections is undefined on net.Server regardless."
    requirement: null
    verification:
      - kind: other
        ref: "grep -n OPEN_SERVERS.add vice-proxy.test.ts -> exactly one call site (an http.Server, never a NetServer)"
        status: pass
      - kind: unit
        ref: "npm run typecheck (vice-proxy.test.ts compiles clean with the narrowed type)"
        status: pass
    human_judgment: true
    rationale: "Same MANUAL_ONLY_TESTS constraint as D3 — vice-proxy.test.ts was never executed."
  - id: D5
    description: "WR-08 re-verified STILL OPEN (contrary to the plan's own 'moot' premise) and fixed: README.md's Development section now says eight manual-only files (was three) and its Environment table now documents VICE_LIVE_STOCK_BIN. The tracking todo moved from pending/ to completed/ with a Resolution section citing all eight verdicts; STATE.md's Deferred Items ledger reconciled in the same commit."
    requirement: null
    verification:
      - kind: unit
        ref: "docs-review-disposition.test.ts (7/7 pass, 0 undispositioned)"
        status: pass
      - kind: unit
        ref: "docs-deferred-ledger.test.ts (4/4 pass, both directions)"
        status: pass
      - kind: integration
        ref: "npm run test:automated (2108 tests, 2103 pass, 0 fail, 5 pre-existing todo)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 4: Disposition 03-REVIEW.md's Eight Newly-Surfaced Findings Summary

**Fixed all eight of 03-REVIEW.md's newly-surfaced findings after re-verifying each against current source — including reversing two of the plan's own stale "superseded" claims (WR-08, IN-03) that direct source inspection found still false — landing an in-flight-promise cache fix for a real concurrent register-fetch race, hardening a test-only identity detector against a throw-reached false negative, and closing the tracking todo with a per-finding, commit-cited Resolution.**

## Performance

- **Duration:** 40 min (approx.)
- **Started:** 2026-08-22T14:45:00Z (approx.)
- **Completed:** 2026-08-22T15:04:17Z
- **Tasks:** 3 completed
- **Files modified:** 7 (0 created, 6 modified, 1 renamed+modified)

## Accomplishments

- **WR-06** (`stock-live.test.ts`): deleted the unreachable-fallback sentence ("Defaults to `X` when set to a truthy non-path value") from all three opt-in skip-message sites (`VICE_LIVE_STOCK_BIN`, `_39`, `_310`) — the branch each message lives in only runs when the variable is unset, so the fallback it described could never be reached from there.
- **IN-05** (`stock-live.test.ts`): removed the non-executable file's `#!/usr/bin/env node` shebang.
- **IN-06** (`stock-live.test.ts`): anchored the flag-bit refusal assertion to the handler's full emitted phrase (`` reported by this catalog as "${escapedStatusName}" ``, matching `stock-registers.ts`'s real string verbatim) instead of a bare, regex-escaped register name — closing the class of build where a single-character status register (e.g. `"P"`) could make the assertion match unrelated text.
- **IN-02** (`stock-registers.ts`): `registerCatalogFor()` now caches the in-flight *promise*, not the resolved catalog, so two handlers racing on a fresh session share one `REGISTERS_AVAILABLE` round trip instead of each sending their own. A rejected promise is evicted from the cache so a failed fetch (e.g. an empty enumeration) is retried by the next call rather than memoised forever. Two new tests in `stock-registers.test.ts` (25 -> now 25 total in that file, 28 combined with `docs-linerefs.test.ts`), each confirmed **live** to fail against a temporarily-reverted implementation before being restored.
- **IN-04** (`stock-registers.test.ts`): replaced the drifted `stock-registers.ts:260-268` line-range citation with a plan/commit citation (`03-14-PLAN.md`, `ff82edc`) that still resolves (`git cat-file -e` exits 0).
- **WR-07** (`vice-proxy.test.ts`, re-verified STILL OPEN): the widened `vice-proxy:` identity detector still exempted a literal reached via `throw new`/standalone `Error(` (a real false-negative class), and its `text:` marker still matched mid-word inside `context:`. Fixed both — added `throw new `/`\bError\(` to the agent-visible marker set and word-boundary-anchored `text:` — verified via a standalone throwaway probe reproducing the exact detector logic (never by running `vice-proxy.test.ts`, which is `MANUAL_ONLY_TESTS` entry 2 and hangs outside a devcontainer) plus three new control assertions committed to the file itself.
- **IN-03** (`vice-proxy.test.ts`, re-verified STILL OPEN): `OPEN_SERVERS`'s `Set<Server | NetServer>` never received a `NetServer` — confirmed exactly one `.add()` call site, always the `http.Server` stand-in — because every per-test `controlServer` (a real `net.Server`) is already closed by its own local `try`/`finally`. Narrowed the type to `Set<Server>` and documented why control-plane sockets are untracked by this net, rather than wiring 30+ call sites into a registry that was never needed.
- **WR-08** (`README.md`, re-verified STILL OPEN, more stale than described): README's Development section still said "excludes the three manual-only files" against an actual **eight** (`test-gate.mjs`'s own header, `test-gate.test.ts`), and its Environment table still omitted `VICE_LIVE_STOCK_BIN`. Fixed both.
- Closed the tracking todo `.planning/todos/pending/2026-08-22-phase-03-review-wr-06-through-in-06-never-dispositioned.md` — moved to `completed/` with `git mv` and a per-finding `## Resolution` table citing every verdict and commit. `STATE.md`'s Deferred Items ledger reconciled in the same commit (pending 21 -> 20).
- `03-REVIEW.md` is byte-identical to before this plan — confirmed via `git diff --stat` on every touched commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix the three stock-live.test.ts findings (WR-06, IN-05, IN-06)** - `aaaffce` (fix)
2. **Task 2: Fix the two stock-registers findings, and record the vice-proxy.test.ts pair's verdicts (IN-02, IN-04, WR-07, IN-03)** - `e8621d7` (fix)
3. **Task 3: Record WR-08 as fixed and close the tracking todo** - `4e784a4` (docs)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.claude/mcp/vice/stock-live.test.ts` - WR-06/IN-05/IN-06 fixes (three false skip-message sentences deleted, shebang removed, flag-bit assertion re-anchored)
- `.claude/mcp/vice/stock-registers.ts` - IN-02 fix: `registerCatalogFor()` caches the in-flight promise with rejection eviction; doc comment updated to match
- `.claude/mcp/vice/stock-registers.test.ts` - IN-04 fix (citation replaced); two new non-vacuous tests for IN-02 (concurrency send-count, rejection-eviction)
- `.claude/mcp/vice/vice-proxy.test.ts` - WR-07 fix (marker set widened, `text:` anchored, three new control assertions); IN-03 fix (`OPEN_SERVERS` narrowed to `Set<Server>`, documented)
- `.claude/mcp/vice/README.md` - WR-08 fix (manual-only count corrected to eight, `VICE_LIVE_STOCK_BIN` documented)
- `.planning/STATE.md` - Deferred Items ledger reconciled (row removed, pending-todo prose count corrected 21 -> 20), Phase 15 accumulated-context bullet added
- `.planning/todos/completed/2026-08-22-phase-03-review-wr-06-through-in-06-never-dispositioned.md` - moved from `pending/` via `git mv`; `## Resolution` section added citing all eight verdicts and commits

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) WR-06 took the review's non-behavior-changing fix option; (2) WR-08 and IN-03 were re-verified against current source per this plan's own stated methodology and found STILL OPEN despite the plan's own action text claiming otherwise — both were fixed for real rather than recorded as false "superseded" verdicts; (3) WR-07 was likewise re-verified (not assumed superseded) and both of its defects were confirmed still present at a drifted line location, then fixed; (4) IN-05's fix proceeded as planned, but a discovery that the plan's own "no other sibling carries a shebang" premise was false (six other files do) was logged as an out-of-scope finding rather than silently expanding the task's scope to six additional files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan premise was stale] WR-08's action text claimed the finding was moot; direct re-verification found it still open and more stale than described**
- **Found during:** Task 3, before writing the todo's Resolution section
- **Issue:** The plan's action text said WR-08's subject ("README.md no longer contains the manual-only-count or Environment-table text") was gone. `grep -n "excludes the three"` still matched `README.md:67`, and `test-gate.mjs`'s own header/`test-gate.test.ts` say the manual-only count is now **eight**, not the "four" the original 03-REVIEW.md expected — the drift continued past both the review's and the plan's assumptions.
- **Fix:** Fixed README.md for real (count corrected to eight, `VICE_LIVE_STOCK_BIN` added to the Environment table) instead of recording a false "superseded" verdict.
- **Files modified:** `.claude/mcp/vice/README.md`
- **Verification:** `grep -c 'manual-only' README.md` (post-fix) shows the corrected wording; no residual "three manual-only" match remains
- **Committed in:** `4e784a4`

**2. [Rule 1 - Plan premise was stale] IN-03's action text implied the union member might be superseded by NetServer's broader use elsewhere; direct re-verification found the specific finding still live**
- **Found during:** Task 2, before editing `vice-proxy.test.ts`
- **Issue:** `NetServer`-typed `controlServer` locals are used at 30+ sites in the file, which could read as superseding the finding, but `grep -n "OPEN_SERVERS.add"` still returns exactly one call site (an `http.Server`, never a `NetServer`) — the specific finding (the leak registry's `NetServer` union member is dead) held regardless of `NetServer`'s unrelated, widespread use.
- **Fix:** Narrowed `OPEN_SERVERS` to `Set<Server>` and documented why control-plane sockets are untracked by this net (each already has correct local teardown).
- **Files modified:** `.claude/mcp/vice/vice-proxy.test.ts`
- **Verification:** `npm run typecheck` exits 0; manual grep confirmed the single `.add()` call site; `vice-proxy.test.ts` was never executed
- **Committed in:** `e8621d7`

**3. [Scope boundary - logged, not fixed] IN-05's "convergence with local convention" premise found false; six other files share the same shebang**
- **Found during:** Task 1's read_first verification step
- **Issue:** The plan instructed confirming "no other `*.test.ts` in this directory carries [a shebang]" before removing it as "convergence with the local convention." Direct `head -1` across every `*.test.ts` file found six others (`fork-live.test.ts`, `anno-launch.test.ts`, `spawn-seam.test.ts`, `stock-broker-live.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-live-triage.test.ts`) carrying the identical non-executable shebang.
- **Fix:** None to the other six files — out of this task's declared scope (`.claude/mcp/vice/stock-live.test.ts` only). Fixed `stock-live.test.ts` per the plan's explicit instruction (still correct on its own terms) and logged the broader pattern here rather than silently expanding scope.
- **Files modified:** none beyond the planned `stock-live.test.ts`
- **Verification:** `head -1` across all seven affected files, confirmed via `ls -la` that none is executable (no `x` permission bit)
- **Committed in:** N/A (documentation-only observation, no code change)

---

**Total deviations:** 3 (2 stale-plan-premise corrections resolved by evidence and fixed for real, 1 out-of-scope discovery logged not fixed). **Impact:** No scope creep beyond the plan's declared file list except README.md (added for WR-08's real fix, justified by the same must-have that forbids recording an unfixed finding as fixed/superseded); no test assertion weakened; every fix independently verified without ever executing the forbidden `vice-proxy.test.ts`.

## Issues Encountered

None beyond the three deviations above, all resolved within this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`03-REVIEW.md`'s all 14 findings are now fully dispositioned (six were already closed before this phase; these eight close the remainder), and `docs-review-disposition.test.ts` runs green with 0 undispositioned findings across all 150 discovered across every `*-REVIEW.md`. `03-REVIEW.md` itself remains byte-identical to before this plan. `GATE-02` was NOT marked complete by this plan — it is declared by multiple sibling plans in this phase (the shared-ID gate, #2388), and closes only when plan 15-12 (the last plan declaring it) finishes, per this phase's established convention (matching plans 15-02 and 15-03). No blockers for the remaining phase 15 plans.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All modified files confirmed present on disk (`stock-live.test.ts`, `stock-registers.ts`, `stock-registers.test.ts`, `vice-proxy.test.ts`, `README.md`, `STATE.md`, this SUMMARY). All three task commits confirmed in `git log` (`aaaffce`, `e8621d7`, `4e784a4`). Plan-level `<verification>` re-run: `npm run typecheck` exits 0; `npm run test:automated` exits 0 (2108 tests, 2103 pass, 0 fail, 5 pre-existing todo); `node --test docs-review-disposition.test.ts docs-deferred-ledger.test.ts docs-linerefs.test.ts` exits 0 (14/14 pass); `node --test stock-live.test.ts` reports 14 tests, 14 skipped, exit 0 (unchanged shape); `git diff --stat` on every touched commit shows no `*-REVIEW.md` file changed; `vice-proxy.test.ts` was never executed via `node --test` at any point in this plan (confirmed by command-log review — the only verification against its logic used a standalone throwaway probe file in the scratchpad directory, since deleted).
