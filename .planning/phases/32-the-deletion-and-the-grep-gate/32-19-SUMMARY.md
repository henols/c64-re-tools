---
phase: 32-the-deletion-and-the-grep-gate
plan: 19
subsystem: testing
tags: [signals, process-handlers, node-test, mutation-harness, restore-invariant, wr-03]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-17's argv-seam wiring and the harness's IS_ENTRY_POINT guard, which is what makes a driver able to register the real handlers without running main()"
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-14's ten-attempt measurement and its diagnosis that main() is wholly synchronous — the finding this plan acts on"
provides:
  - "The restore-on-signal invariant OBSERVED through the harness's own registered handler for SIGINT and SIGTERM, 10/10 attempts at exit 130"
  - "Three exported harness symbols (plant, restoreAll, pendingRestoreCount) and a dated note recording why the export count is no longer zero"
  - "Two in-process drivers under src/mcp/vice/fixtures/harness-signal/ that create the signal window outside the harness"
  - "src/mcp/vice/audit-harness-restore.test.ts — 5 tests in the automated suite, 1.3 s"
  - "WR-03 settled and closed: the second restoreAll() is a genuine no-op, proven by a sentinel written between the calls"
  - "evidence/32-restore-on-signal.md — the full attempt log, both signals, with the D-17 reasoning recorded in full"
affects: [milestone-close, broken-windows-ledger, phase-32-verification]

actuals:
  tokens: 17708
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "In-process driver under fixtures/ to create a runtime window a synchronous module cannot create for itself, without modifying that module"
    - "Negative control whose SAFETY property passes identically, so the discriminating evidence is forced to be the exit code rather than the byte comparison"
    - "Discriminating latch measurement: change the observed state BETWEEN two idempotent calls so a no-op and a re-write predict different results"
    - "Attributable-delta porcelain assertion: scope a whole-repo git reading to paths the test can be responsible for, so it survives a concurrent 120-file suite"

key-files:
  created:
    - src/mcp/vice/audit-harness-restore.test.ts
    - src/mcp/vice/fixtures/harness-signal/signal-window-driver.mjs
    - src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-on-signal.md
  modified:
    - scripts/audit-mutation-harness.mjs
    - .gitignore

key-decisions:
  - "Took the verifier's in-process-driver branch and refused the injected-await branch: changing how the instrument behaves when it is really run, in order to test how it behaves when it is really run, is the defect shape this phase exists against"
  - "Exported exactly three symbols and no more; pendingRestoreCount() returns the map's size rather than the map, so a consumer can observe the restore machinery without being able to mutate it"
  - "Recorded the grep self-match rather than rewording around it: the bare await/async/.then count now returns 7 because the new header note contains those words, and the discriminating comment-excluding form (0 code occurrences) is written into the file"
  - "Narrowed the porcelain assertion to attributable paths after measuring that the whole-repo form fails under the 120-file concurrent suite, and replaced what it could never see with a direct scratch-root contents assertion"
  - "Did not touch .planning/WINDOWS.md: entry 33's resolution is recorded in the evidence file and flagged for the orchestrator, because WINDOWS.md is a shared artifact outside this plan's files_modified and a sibling plan runs in the same wave"

patterns-established:
  - "Window-from-outside: when a synchronous module cannot be interrupted from within, import it (registering its real handlers under an IS_ENTRY_POINT guard) and create the window in the importing process"
  - "A safety property that holds on BOTH paths is not evidence for either; include the negative control that demonstrates it, so the reader can see which observation actually discriminates"

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "The harness exports exactly three symbols (plant, restoreAll, pendingRestoreCount), importing it is inert, and the CLI is unchanged"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "node -e 'import(\"./scripts/audit-mutation-harness.mjs\").then(m=>console.log(Object.keys(m).sort().join(\",\")))' -> pendingRestoreCount,plant,restoreAll"
        status: pass
      - kind: other
        ref: "import-only probe script: exit 0, 0 bytes stdout, 0 bytes stderr, git status --porcelain byte-identical"
        status: pass
      - kind: other
        ref: "node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <scratch> -> OBSERVED RED, tree restored byte-identical"
        status: pass
    human_judgment: false
  - id: D2
    description: "The restore-on-signal invariant is observed through the harness's OWN registered handler: SIGINT and SIGTERM each exit 130 with a null terminating signal while a plant is on disk, restoring byte-for-byte"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#SIGINT delivered inside the plant window exits 130 and restores byte-for-byte"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#the attempt log is complete and every recorded exit code is the discriminating one"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-03 settled: after a first restoreAll(), a second call is a genuine no-op — the sentinel written by hand between the calls survives"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write"
        status: pass
    human_judgment: false
  - id: D4
    description: "The harness was not widened: no injected await, no flag/env/hook/delay/test-mode, restore machinery and restored latch untouched, module still wholly synchronous in code"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "grep -n 'await|async |.then(' scripts/audit-mutation-harness.mjs | grep -vE ':[[:space:]]*(//|\\*)' -> exit 1, no output (0 code occurrences)"
        status: pass
      - kind: other
        ref: "git diff 07a9b48 HEAD -- scripts/audit-mutation-harness.mjs: 83 added / 2 removed lines, all comment or export-keyword"
        status: pass
    human_judgment: false
  - id: D5
    description: "The evidence record states a verdict the log supports, records WR-03's disposition and broken-windows entry 33's new state, and records the D-17 reasoning in full"
    verification:
      - kind: other
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-on-signal.md exists, 25251 bytes, ten-row attempt log + control + verbatim latch verdict"
        status: pass
    human_judgment: true
    rationale: "Whether the prose verdict faithfully matches the log, whether entry 33 should move to resolved given its stated cause is still true, and whether the D-17 argument is accepted are all reader judgments. The log itself is machine-produced; the reading of it is not."
  - id: D6
    description: "[edge:CUT-06/concurrency] Every suite figure in this plan carries the VICE broker's state beside it, read by evidence/32-close-gate.md §2b's ps-based method rather than the self-matching pgrep form"
    verification:
      - kind: manual_procedural
        ref: "systemctl --user is-active vice-broker -> inactive (exit 4); ps -eo pid,args | grep -i vice-broker | grep -v grep -> exit 1; same for x64sc -> exit 1"
        status: pass
    human_judgment: true
    rationale: "Routed as a backstop in the plan's must_haves: it is a property of how the record is WRITTEN rather than of a command's exit status, so it abstains to human review rather than silently passing."

duration: 23 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 19: Restore-on-Signal Observed Summary

**The harness's restore-on-signal invariant is observed through its own registered handler — 10/10 attempts at exit `130` across both signals, against plan 32-14's ten zeros — by creating the window in an in-process driver rather than injecting an `await` into the instrument; and `WR-03`'s latch doubt is settled by a sentinel that survives the second `restoreAll()`.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-01T07:54:21Z
- **Completed:** 2026-09-01T08:17:35Z
- **Tasks:** 3
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments

- **The invariant is OBSERVED, not claimed.** SIGINT and SIGTERM, delivered while a plant is on disk and observed on disk before delivery, each exit `130` with a **null** terminating signal — meaning the harness's own registered handler ran, because a registered handler suppresses the default action. Five attempts per signal, ten of ten. Plan 32-14's ten attempts all read `0`.
- **The harness was not widened to make this possible.** No `await` injected, no flag, environment variable, hook, delay or test mode added; `runGuard()`, the restore machinery, the four handler registrations and the `restored` latch untouched. The window is created OUTSIDE the harness by a driver that imports it — registering the four real handlers, while the pre-existing `IS_ENTRY_POINT` guard keeps `main()` from running — plants for real, then awaits a timer so the event loop turns.
- **`WR-03` is settled and closed**, in the direction that could have gone the other way. The latch driver writes a distinct sentinel by hand BETWEEN the two `restoreAll()` calls, so a genuine no-op and a re-write of identical bytes predict different bytes. The sentinel survives.
- **The negative control makes the result legible.** The same driver run to completion without a signal ALSO restores byte-for-byte and exits `0`. Byte identity therefore never distinguished the two paths — the exit code is the only thing that does, and the suite now demonstrates that in the same run.
- **A grep that began self-matching is recorded rather than worked around.** Plan 32-14's synchronous-module check now returns `7` instead of `0` because the header note this plan added contains the words it greps for — including the sentence asserting the count is zero.

## Task Commits

1. **Task 1: three exports and a gitignore line** — `b55ec3f` (feat)
2. **Task 2 RED: the failing test** — `4d95bd7` (test)
3. **Task 2 GREEN: two in-process drivers** — `9215e49` (feat)
4. **Task 2 fix: scope the porcelain assertion** — `e61ee28` (fix)
5. **Task 3: the evidence record** — `d4dba81` (docs)

## Files Created/Modified

- `scripts/audit-mutation-harness.mjs` — `plant` and `restoreAll` exported; new `pendingRestoreCount()` accessor returning the map's SIZE (not the map); dated header note recording why the export count is no longer zero and documenting the grep self-match with its discriminating form
- `.gitignore` — `/.harness-signal-scratch-*/`, load-bearing rather than tidy
- `src/mcp/vice/audit-harness-restore.test.ts` — 5 tests: SIGINT ×5, SIGTERM ×5, negative control, WR-03 latch, attempt-log completeness
- `src/mcp/vice/fixtures/harness-signal/signal-window-driver.mjs` — plants, emits a marker carrying the pre-plant bytes as base64, then awaits
- `src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs` — the discriminating latch measurement, printing a JSON verdict
- `.planning/phases/.../evidence/32-restore-on-signal.md` — the full attempt log, verdict, WR-03 disposition, entry 33's new state, D-17 in full

## The Attempt Log

| Attempt | Landed | Polls | Marker seen | Sent at | Lifetime | Exit code | Killed by | Bytes | Porcelain |
|---|---|---|---|---|---|---|---|---|---|
| SIGINT 1 | yes | 1 | 57 ms | 57 ms | 63 ms | `130` | null | yes | yes |
| SIGINT 2 | yes | 1 | 56 ms | 56 ms | 61 ms | `130` | null | yes | yes |
| SIGINT 3 | yes | 1 | 58 ms | 58 ms | 62 ms | `130` | null | yes | yes |
| SIGINT 4 | yes | 1 | 60 ms | 60 ms | 65 ms | `130` | null | yes | yes |
| SIGINT 5 | yes | 1 | 59 ms | 59 ms | 64 ms | `130` | null | yes | yes |
| SIGTERM 1 | yes | 1 | 43 ms | 43 ms | 47 ms | `130` | null | yes | yes |
| SIGTERM 2 | yes | 1 | 56 ms | 57 ms | 61 ms | `130` | null | yes | yes |
| SIGTERM 3 | yes | 1 | 41 ms | 41 ms | 45 ms | `130` | null | yes | yes |
| SIGTERM 4 | yes | 1 | 46 ms | 46 ms | 50 ms | `130` | null | yes | yes |
| SIGTERM 5 | yes | 1 | 46 ms | 47 ms | 50 ms | `130` | null | yes | yes |
| **none (control)** | yes | 1 | 39 ms | 40 ms | 245 ms | **`0`** | null | **yes** | yes |

Byte identity is a Buffer comparison against a target carrying a NUL, the lone bytes `0xFF 0xFE 0x80`, and the truncated sequence `0xC3 0x28` — none of which survives a UTF-8 round trip.

**The latch verdict, verbatim:**

```
{"plantReallyHappened":true,"pendingCountBeforeFirstCall":1,"restoredToOriginalAfterFirstCall":true,"pendingCountAfterFirstCall":0,"sentinelIntactAfterSecondCall":true,"secondCallRewroteOriginal":false,"originalSha":"Ly8gaGFybmVzcyByZXN0b3Jl","afterSecondSha":"SEFSTkVTU19MQVRDSF9TRU5U"}
```

## The Exported Name List, Verbatim

```
pendingRestoreCount,plant,restoreAll
```

Exactly three. `revert`, `runGuard`, `measureRow`, `selectRows` and `main` stay private.

## Verification

| # | Check | Result |
|---|-------|--------|
| 1 | `node --check scripts/audit-mutation-harness.mjs` | exit `0` |
| 2 | Import inert: probe script | exit `0`, 0 bytes stdout, 0 bytes stderr, porcelain byte-identical |
| 3 | Synchronous, code-only count | `grep ... \| grep -vE ':[[:space:]]*(//\|\*)'` → exit 1, **0 occurrences** |
| 4 | Synchronous, bare count (self-matching) | `7`, all in the new note — recorded, not accepted as an injected `await` |
| 5 | CLI unchanged | `OBSERVED RED ... exit status 1 (control 0)`, `tree: restored byte-identical` |
| 6 | `node --test audit-harness-restore.test.ts` | **5 pass, 0 fail, 1329 ms** |
| 7 | Ten attempts, exit code | `130` ×10, terminating signal `null` ×10 |
| 8 | `node scripts/check-guard-fates.mjs` | `OK -- setA=43 setB=16 setC=2 total=61 rows=61`, exit `0` |
| 9 | `node scripts/audit-gate.mjs` | `OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status`, exit `0` |
| 10 | `npm run typecheck` | exit `0` |
| 11 | `npm run test:automated` | 3009 tests, **3001 pass, 2 fail**, 1 skipped, 45.6 s, exit `1` — see Issues |
| 12 | Automated glob membership | 120 files; includes the test file; contains **no** driver |
| 13 | Broker state (§2b method) | **inactive** for every figure |

**The whole-glob `npm test` was NOT run.** It blocks indefinitely on `vice-proxy.test.ts` — broken-windows entry **#26**, measured at `exit=124` under a 180 s bound in `evidence/32-close-gate.md` §2b. That decision is **cited, not retaken**.

## Decisions Made

- **In-process driver, not an injected `await`.** The verifier's `behavior_unverified_items[0].test` offered both. Injecting an `await` would change the instrument's runtime behaviour in order to test it — the defect shape this phase exists against.
- **Exactly three exports.** `pendingRestoreCount()` returns the internal map's size rather than the map, so a consumer can observe the restore machinery without mutating it (T-32-36).
- **The grep self-match is documented, not designed around.** Rewording the note until the bare grep agreed with it would have been as dishonest as recording `7` as an injected `await`. Same shape as the `pgrep -af vice-broker` trap in §2b.
- **`WINDOWS.md` was not edited.** Entry 33's resolution is recorded in the evidence file and flagged below. `WINDOWS.md` is outside this plan's `files_modified` and a sibling plan runs in the same wave.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The whole-repo porcelain assertion was flaky under the concurrent suite**
- **Found during:** Task 3, running `npm run test:automated`
- **Issue:** In isolation the file passed 5/5 with `git status --porcelain` byte-identical on all eleven attempts. Inside `test:automated` — which runs 120 test files **concurrently** — three of five failed with `git status --porcelain differs across the attempt`. A sibling test's own fixture directory appearing between one attempt's two whole-repo readings is enough. The assertion was a true statement about the repository and a false one about the harness.
- **Fix:** Narrowed to `attributablePorcelainDelta()` — new porcelain entries under `.planning/` or `scripts/`, or naming this test's scratch prefix, which is where a mis-contained harness run actually writes. Added a **stronger** direct assertion that porcelain could never have made: the scratch root is gitignored, so a stray partial write inside it would never appear in `git status` at all, and its contents are now read directly and must be exactly `["plant-target.txt"]` at the moment the child exits. The strict whole-repo comparison is still taken and still recorded per attempt, reported rather than asserted.
- **Verification:** suite failures 5 → 2; isolated run still 5 pass with all eleven attempts whole-repo byte-identical
- **Committed in:** `e61ee28`

**2. [Rule 1 — Bug] Orphaned `Promise.race` deadline timers held the runner open for 21 s**
- **Found during:** Task 2 GREEN
- **Issue:** `Promise.race` does not cancel the loser. Eleven live 20-second deadline timers kept the event loop alive after the work finished, so the file took **21.2 s** of wall clock against ~1 s of actual work. Bounded, so not the unterminating-file hazard, but a twenty-fold tax on a suite this file was about to join (T-32-38).
- **Fix:** `deadline(ms)` returning `{ promise, cancel }`; the winner cancels the loser.
- **Verification:** 21.2 s → **1.4 s**, same 5 pass
- **Committed in:** `9215e49`

**3. [Rule 2 — Missing critical] The plan's synchronous-module criterion could not be met literally, and the discrepancy is recorded rather than papered over**
- **Found during:** Task 1
- **Issue:** The criterion reads "a count of `await`, `async ` and `.then(` occurrences in the file returns 0, as plan 32-14 measured. A non-zero count means an `await` was injected." After adding the required dated header note — which necessarily discusses `await` — the bare count returns `7`. Every hit is prose, including the sentence asserting the count is zero. The measuring instrument moved inside its own subject.
- **Fix:** Recorded **both** numbers; established the discriminating comment-excluding form (`0` code occurrences); wrote that form and the reason into the file's own header so a later round uses it, naming the `pgrep` self-match precedent.
- **Verification:** code-only form exits 1 with no output; `git diff` shows the 83 added lines are comment or `export` keyword only
- **Committed in:** `b55ec3f`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** No scope creep. Two were defects in this plan's own new test surfacing under real conditions; the third was an acceptance criterion that became self-referential and is resolved by a stronger measurement plus a written record, not by weakening it.

## Issues Encountered

**`npm run test:automated` exits 1 with 2 failures — neither is this plan's.** The plan's Task 3 acceptance criterion asks for exit 0 with 0 failures; that is not achievable on this base. Both survivors are named rather than absorbed, and this plan's diff (`.gitignore`, `scripts/audit-mutation-harness.mjs`, three new files — 5 files, +844/−2) touches neither:

1. **`not ok 903` — `audit-root-args.test.ts`, "the matrix covers EVERY script wired to the shared argv seam".** Reports `audit-gate` and `audit-mutation-harness` on the seam but absent from `MATRIX`. **This is plan 32-18's declared deliverable, executing in the same wave**, and the orchestrator flagged it as expected on this base. The seam wiring it reads was added by plan **32-17**; measured, this plan changes no line mentioning `parseRootArg` or `audit-root` (`git diff 07a9b48 HEAD -- scripts/audit-mutation-harness.mjs | grep -E "^[-+].*parseRootArg|^[-+].*audit-root"` → exit 1, no output).
2. **`not ok 1536` — `repo-root.test.ts` path agreement.** Fails because the resolved supervisor directory is `.../.claude/worktrees/agent-.../.vice-supervisor` and the assertion forbids anything under `.claude`. A pure artifact of executing inside a worktree that lives under `.claude/`; it disappears in the main checkout.

**Before this plan's own fix the suite read `# fail 5`; after it, `# fail 2`.**

## Action for the Orchestrator

**Broken-windows entry 33 should move from `open` to resolved.** It reads *"Restore-on-signal invariant still behaviour-unverified... 10/10 attempts landed in the window and the child still exited 0, not 130 (plan 32-14 Task 3)"*. That is no longer true: 10/10 now exit `130` through the harness's own handler. `WINDOWS.md` was deliberately not edited here — it is outside this plan's `files_modified` and a sibling plan runs in the same wave — so the ledger update is left to the post-merge single writer. Note when updating it that the entry's stated **cause** remains true: `main()` is still wholly synchronous and a signal still cannot be dispatched mid-plant during a real CLI invocation. What changed is that the invariant no longer had to be reached that way.

**`WR-03` can be closed.** Round 2's review lists it as "still stands"; it is now settled by a measurement with a failing outcome available to it.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Verifier truth 13 stops being present-but-unverified; `behavior_unverified_items[0]` and `human_verification[0]` are both discharged by observation.
- `CUT-04`'s concurrency and encoding edges are both resolved explicitly: interruption is specified and measured, and restoration is asserted as a Buffer equality against a deliberately non-UTF-8 target.
- `D-16` and `D-17` are intact — the harness is still in no CI step and in neither `package.json` `scripts` block; the reasoning for why a restore-machinery contract test does not contradict `D-17` is recorded in full in the evidence file and cross-referenced from the test's header.
- One concern, already visible above: the two pre-existing suite failures must clear before the phase can claim a green automated gate. `903` clears when plan 32-18 merges; `1536` clears on merge out of the worktree.

## Self-Check: PASSED

- All six files verified present on disk.
- All five commits verified in `git log 07a9b48..HEAD`.
- No file deletions in any commit (`git diff --diff-filter=D` empty for each).
- Worktree clean apart from this SUMMARY at the time of writing.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*
