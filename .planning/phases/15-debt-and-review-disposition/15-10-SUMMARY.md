---
phase: 15-debt-and-review-disposition
plan: 10
subsystem: testing
tags: [vice-mcp, stock-vice, live-probe, checkpoints, rate-limiter, uat, todo-closure]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "15-08's live-close of 03-HUMAN-UAT.md scenarios 1 and 2, and the exact 03-HUMAN-UAT.md/15-UAT-EVIDENCE.md frontmatter/evidence shape this plan extends"
  - phase: 15-debt-and-review-disposition
    provides: "15-09's Deferred Items ledger baseline (pending 10, total 11) that this plan's todo closure decrements from"
provides:
  - "A4 (the D-11 rate-limiter's setImmediate() auto-disable deferral) live-tested against genuine stock VICE and CONFIRMED for the rates and host tested"
  - "03-HUMAN-UAT.md's last pending scenario (scenario 3) closed, leaving the file with zero result: [pending] rows"
  - "2026-08-14-probe-phase3-assumed-wire-details.md closed in full, all five original assumptions accounted for"
  - "stock-a4-checkpoint-flood.test.ts: the ninth opt-in MANUAL_ONLY_TESTS entry, a reusable escalation-capable checkpoint-flood harness"
affects: [03-direct-tools, 15-debt-and-review-disposition]

actuals:
  tokens: 16722
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Gentle-tier-first live safety probe: reach for an already-hot, unmodified-machine address (the KERNAL default IRQ vector, $EA31) before ever assembling a tight-loop fixture, so the riskiest tier of a probe is attempted only if the safe tier does not already answer the question"
    - "Mutable multi-field closure outcome captured via a single object literal, not several separate `let` bindings -- works around TypeScript's control-flow narrowing treating a `let` variable assigned only inside a nested closure as still holding its declaration-time value at later read sites in the enclosing scope"
    - "Wire-side re-verification of a client-side report: after the trace guard's local autoDisabled state claims a checkpoint is disabled, a FRESH vice_checkpoint_list call re-reads that checkpoint's own enabled flag off the wire, rather than trusting the local report -- the exact discriminator the A4 race would show if it existed"

key-files:
  created:
    - .claude/mcp/vice/stock-a4-checkpoint-flood.test.ts
    - .planning/phases/15-debt-and-review-disposition/15-A4-PROBE-EVIDENCE.md
  modified:
    - .claude/mcp/vice/test-gate.mjs
    - .claude/mcp/vice/test-gate.test.ts
    - .claude/mcp/vice/docs-deferred-ledger.test.ts
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-14-probe-phase3-assumed-wire-details.md
    - .planning/phases/03-direct-tools/03-HUMAN-UAT.md

key-decisions:
  - "PC sampled five times (bounded resume/sleep/read attempts), not LIN/vice_cycles_stopwatch, as the post-flood progress observable -- a live spot-check found this build's REGISTERS_GET consistently reports LIN=0 immediately after a halt (matching an unrelated data point already on file in 15-08's own evidence transcript), which reads like the monitor's halt point synchronises to the raster on this build rather than LIN tracking real elapsed time at a two-sample granularity. PC has no such ambiguity."
  - "The tight-loop escalation tier was built and typechecked but not exercised -- the gentle KERNAL-IRQ tier alone exceeded the D-11 guard's 20-hits-per-second limit (observed ~21/s) well within its own bounded deadline, so escalating would have answered a question the gentle tier had already answered."
  - "A4 carries no [ASSUMED] label (confirmed by direct inspection of assumption-label-discipline.test.ts's own scope note, which excludes A4 by design as a design choice rather than a wire assumption) -- so closing it required no label removal, only the probe-debt todo's own closure."
  - "docs-deferred-ledger.test.ts's non-vacuity floor (previously 'expect at least 10 pending todos') was lowered to 5 -- it is a sanity check that the scan found something, not a debt-count contract, and real pending count legitimately dropped below 10 for the first time this milestone."

requirements-completed: [DEBT-01, DEBT-03]  # Declared by this plan's own frontmatter; NOT marked complete in REQUIREMENTS.md -- both are shared IDs sibling plans 15-11/15-12 still declare (shared-ID gate #2388; requirements.ready-ids confirmed 0/2 ready)

coverage:
  - id: D1
    description: "A real non-stopping (stop:false) checkpoint armed on a hot KERNAL address against genuine stock VICE, driven past the D-11 rate limit; the auto-disable fires, reaches the wire, and the emulator keeps progressing -- committed as the ninth opt-in MANUAL_ONLY_TESTS entry, default-skip everywhere"
    verification:
      - kind: manual_procedural
        ref: "VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc node --test stock-a4-checkpoint-flood.test.ts (opt-in live run, this session: 1/1 pass)"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test test-gate.test.ts (3/3 pass, nine manual-only entries) && npm run test:automated (2112/2107/0/5, new file excluded)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A4's verdict recorded with cited raw observations (verbatim autoDisables entry, independently re-read wire-side enabled flag, post-flood PC samples) and an explicitly scoped CONFIRMED verdict; the probe-debt todo closed in full with all five original assumptions accounted for"
    requirement: null
    verification:
      - kind: manual_procedural
        ref: "15-A4-PROBE-EVIDENCE.md; .planning/todos/completed/2026-08-14-probe-phase3-assumed-wire-details.md's ## Resolution"
        status: pass
    human_judgment: true
    rationale: "Confirming the verdict's scope is honestly limited to the rates/host actually tested (not overstated into a general guarantee) is exactly this plan's own <human-check> requirement -- a judgment call about prose honesty, not a mechanically checkable fact."
  - id: D3
    description: "03-HUMAN-UAT.md's scenario 3 recorded pass with cited evidence; the file's own Summary counts and Gaps section reconciled to zero pending rows"
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'result: \\[pending\\]' 03-HUMAN-UAT.md == 0; Summary block reads 2 passed / 1 issues / 0 pending, summing to 3; Gaps section non-empty"
        status: pass
    human_judgment: false

duration: ~28min (estimated -- PLAN_START_TIME was not captured at the very start of this session; based on commit timestamps and the prior plan's own recorded session end)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 10: Live-arm the checkpoint-flood safety probe and close both A4 and 03-HUMAN-UAT.md Summary

**Armed a real non-stopping checkpoint on the KERNAL's default IRQ entry point ($EA31) against genuine stock VICE 3.9, watched the D-11 rate-limit guard's auto-disable fire and reach the wire under a sustained ~21-hits/second flood with the emulator still progressing afterward — closing A4's probe-debt todo and 03-HUMAN-UAT.md's last pending scenario with the same experiment.**

## Performance

- **Duration:** ~28 min (estimated)
- **Completed:** 2026-08-22T17:23:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Built `stock-a4-checkpoint-flood.test.ts`, an opt-in, default-skipped live probe launched through the real broker artifact (`resources/vice-broker.mjs`), driving `dispatchStock()` against a genuinely granted stock instance — no hand-built argv, no in-process shortcut. Arms a `stop:false` checkpoint on `$EA31` (read from `c64-memory-mapping/memmap.json`'s own `CINV` entry, never a typed literal), the KERNAL's documented default hardware-IRQ entry point — an unmodified, freshly booted machine's own CIA1 timer IRQ fires it at roughly 50-60Hz with no fixture needed, comfortably past the D-11 guard's 20-hits-per-second limit.
- Registered the file as the ninth `MANUAL_ONLY_TESTS` entry in `test-gate.mjs` with a header rationale in the same voice as the eight existing entries, and updated `test-gate.test.ts`'s frozen expectation set. `npm run test:automated`'s count is unchanged (2112/2107/0/5) — the new file is correctly excluded.
- Ran the probe live against genuine, unpatched `/usr/bin/x64sc` (VICE 3.9): the armed checkpoint's wire hit count climbed `0 -> 7 -> 21` in roughly 2.4 seconds; the D-11 guard's `setImmediate()`-deferred auto-disable fired (`hitsPerSecond: 21`); a *fresh* `vice_checkpoint_list` call afterward — not the local report — confirmed the checkpoint's own wire-side `enabled` flag was `false`; and five bounded post-flood PC-register samples showed the machine still executing (`[58836,58836,58831,58833,58836]`, not all identical). No escalation to the tight-loop tier was needed; that tier is implemented and typechecked but was not exercised. No orphaned process or scratch directory after teardown.
- Wrote `15-A4-PROBE-EVIDENCE.md`, restating A4's question, the method, the raw observations (verbatim `autoDisables` entry, wire-side re-check, PC samples), and a verdict — **CONFIRMED, for the rates and host tested** — with an explicit paragraph on what a single-host/single-rate observation does not establish (higher rates, other builds/OSes, concurrent host load, multiple simultaneous flooding checkpoints).
- Closed `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md` in full: `git mv` to `completed/`, with a `## Resolution` accounting for all five original assumptions (A1/A2 confirmed and corrected at source by Phase 13, A3 inconclusive with its label still on, A4 confirmed here with no label to remove, A5 contradicted and handed to its own already-filed todo). No source file was changed (`git diff --quiet stock-checkpoints.ts` confirmed) — the deferral mechanism was found race-free as designed, not patched.
- Recorded `03-HUMAN-UAT.md` scenario 3 as `pass`, citing `15-A4-PROBE-EVIDENCE.md`'s raw observations and naming the A4 cross-reference explicitly. Zero `result: [pending]` rows remain in the file. `status:` stays `partial` (scenario 2's joystick half remains a genuine, honestly-recorded negative result — not softened to force an overall pass). Summary counts corrected (2 passed / 1 issues / 0 pending, summing to 3); the Gaps section now names both remaining open items with their own scope limits stated explicitly.
- Reconciled `STATE.md`'s Deferred Items ledger in both the table and both prose count figures (pending 10 → 9, total 11 → 10), and reworded one now-stale historical prose mention of the closed todo's stem to a paraphrase, matching the precedent 15-09 established, so `docs-deferred-ledger.test.ts`'s completed-stem guard stays green in both directions.
- **DEBT-01 and DEBT-03 are NOT marked complete** — both are shared requirement IDs still declared by sibling plans 15-11 and 15-12 per the shared-ID gate (#2388); `requirements.ready-ids` correctly withholds them (this plan declared no `requirements` of its own in its frontmatter — verified before executing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the opt-in flood probe and register it as the ninth manual-only entry** - `dc4f6de` (feat)
2. **Task 2: Record the A4 verdict with evidence, including a genuine failure if that is the result** - `6462d68` (docs)
3. **Task 3: Record scenario 3 in 03-HUMAN-UAT.md and close the file out** - `f086975` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts` — new opt-in live probe file (ninth `MANUAL_ONLY_TESTS` entry)
- `.claude/mcp/vice/test-gate.mjs` — ninth entry added to `MANUAL_ONLY_TESTS`, header rationale extended
- `.claude/mcp/vice/test-gate.test.ts` — frozen expectation set widened to nine entries
- `.claude/mcp/vice/docs-deferred-ledger.test.ts` — non-vacuity pending-todo floor lowered from 10 to 5 (Rule 1 fix, see Deviations)
- `.planning/phases/15-debt-and-review-disposition/15-A4-PROBE-EVIDENCE.md` — new evidence document, A4's verdict and raw observations
- `.planning/todos/completed/2026-08-14-probe-phase3-assumed-wire-details.md` — moved from `pending/`, `## Resolution` added
- `.planning/STATE.md` — Deferred Items ledger reconciled (pending 10→9, total 11→10); one historical stem mention reworded
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` — scenario 3 recorded `pass`; Summary/Gaps/frontmatter reconciled

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) PC, sampled five times, replaced a two-sample raster-line (`LIN`) comparison as the post-flood progress observable, after a live spot-check found `LIN` consistently reads `0` immediately after every halt on this build; (2) the tight-loop escalation tier was built but not exercised, since the gentle KERNAL-IRQ tier alone already exceeded the rate limit; (3) A4 carries no `[ASSUMED]` label, confirmed by direct inspection rather than inferred, so no label change applied; (4) `docs-deferred-ledger.test.ts`'s stale non-vacuity floor was lowered as legitimate debt-closure work shrank the real pending count below its old threshold for the first time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `c64-memory-mapping/memmap.json` parsed as a bare array; it is `{ sources, entries }`**
- **Found during:** Task 1, first live run of the new probe
- **Issue:** `readKernalIrqAddress()` called `.find()` directly on the parsed JSON, which is an object with a `sources`/`entries` shape, not an array — `raw.find is not a function`.
- **Fix:** Read `parsed.entries` (with an explicit `Array.isArray` assertion) before searching for the `CINV` row.
- **Files modified:** `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`
- **Verification:** Re-ran the live probe; the address resolved correctly (`$EA31`) on the next attempt.
- **Committed in:** `dc4f6de` (Task 1 commit)

**2. [Rule 1 - Bug] TypeScript narrowed closure-mutated `let` variables to `never` at their read sites**
- **Found during:** Task 1, `npm run typecheck`
- **Issue:** Several outcome variables (`gentleResult`, `escalatedResult`, `escalationNeeded`, etc.) were declared as `let x: T | null = null` in the test's outer scope and assigned only inside a nested async closure passed to `withBrokerHarness()`. TypeScript's control-flow analysis tracked only the last DIRECTLY-VISIBLE assignment in the declaring scope (the `null` initialiser), narrowing every later read in the outer scope to `never` regardless of the closure's real runtime behaviour — surfacing as `Property 'triggered' does not exist on type 'never'`.
- **Fix:** Replaced the separate `let` bindings with a single mutable `outcome` object literal with an explicit property-typed shape; object-property assignment does not fall into the same narrowing trap.
- **Files modified:** `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `dc4f6de` (Task 1 commit)

**3. [Rule 1 - Bug] `LIN`-based post-flood progress check was unreliable on this build**
- **Found during:** Task 1, first full live run (test passed everywhere except the progress assertion)
- **Issue:** A two-sample `LIN` (raster line) comparison before/after an 800ms resume-and-sleep window read `LIN=0` in BOTH samples, failing the "the emulator is still progressing" assertion even though the auto-disable had genuinely fired correctly and the machine was demonstrably alive (matching an unrelated `LIN:0`/`LIN:0` data point already on file in 15-08's own evidence transcript, taken with a different single-sample technique).
- **Fix:** Replaced the `LIN` comparison with five bounded resume/sleep/read attempts sampling the `PC` register instead (mirroring `stock-broker-live.test.ts`'s own scenario-2 running-state proof), asserting the samples are not all identical.
- **Files modified:** `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`
- **Verification:** Re-ran the live probe; PC samples varied (`[58836,58836,58831,58833,58836]`), and the full test passed (`1 pass / 0 fail`).
- **Committed in:** `dc4f6de` (Task 1 commit)

**4. [Rule 1 - Bug] `docs-deferred-ledger.test.ts`'s non-vacuity floor was a stale sanity-check constant**
- **Found during:** Task 2, re-running the plan's verification commands after closing the probe-debt todo
- **Issue:** The test's own "non-vacuity" sub-test asserted `pending.length >= 10` — a sanity check meant to catch an accidentally-empty scan, not a debt-count contract — but legitimate dispositioning work across this phase has now shrunk real pending count to 9 for the first time, tripping the floor.
- **Fix:** Lowered the floor to 5 (matching the sibling `completed.length >= 5` floor's own reasoning), with an inline comment explaining the floor is a sanity check and should be lowered again, not raised, if it recurs for the same reason.
- **Files modified:** `.claude/mcp/vice/docs-deferred-ledger.test.ts`
- **Verification:** `cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts` (11/11 pass, both directions).
- **Committed in:** `6462d68` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs, all Rule 1)
**Impact on plan:** All four were caught by re-running the plan's own verification commands before considering any task complete, not left for a later plan to discover. Three are confined to the new test file's own design; the fourth is a one-line floor correction in a pre-existing guard whose semantics (non-vacuity, not a fixed contract) were unaffected. No scope creep, no production source changed.

## Issues Encountered

None beyond the four auto-fixed deviations above, all caught and resolved within the task that introduced them, before its own commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The milestone's one genuinely unexercised safety-critical probe has now been executed and recorded: A4 is CONFIRMED for the rates and host tested, with an explicitly scoped verdict and a reusable escalation-capable harness for any future plan wanting stronger-rate coverage.
- `03-HUMAN-UAT.md` now carries zero pending scenarios; its remaining open item (scenario 2's joystick candidate explanations) is named in its own `## Gaps` section, not silently dropped.
- `.planning/todos/pending/` count is 9 (was 10 at the start of this plan); `docs-deferred-ledger.test.ts` confirmed green in both directions after the STATE.md reconciliation.
- No follow-up work is blocked by this plan's own execution: all cleanup confirmed (no orphaned `x64sc` process, no leftover scratch directory), all automated gates green (`npm run typecheck`, `npm run test:automated` 2112/2107/0/5, `test-gate.test.ts`, `docs-deferred-ledger.test.ts`, `assumption-label-discipline.test.ts`).

## Self-Check: PASSED

- `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts` — FOUND (created, git-tracked)
- `.planning/phases/15-debt-and-review-disposition/15-A4-PROBE-EVIDENCE.md` — FOUND (created, git-tracked)
- `.planning/todos/completed/2026-08-14-probe-phase3-assumed-wire-details.md` — FOUND (moved from `pending/`, git-tracked)
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` — FOUND (modified, git-tracked)
- Commit `dc4f6de` — FOUND in `git log --oneline --all`
- Commit `6462d68` — FOUND in `git log --oneline --all`
- Commit `f086975` — FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run this session: `npm run typecheck` (0), `npm run test:automated` (2112/2107/0/5, new file excluded), `node --test test-gate.test.ts` (3/3, nine manual-only entries), default `node --test stock-a4-checkpoint-flood.test.ts` (0 pass/1 skip), opt-in live run `VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc node --test stock-a4-checkpoint-flood.test.ts` (1/1 pass), `git diff --quiet probe-binmon.mjs stock-checkpoints.ts` (clean), `grep -c 'result: \[pending\]' 03-HUMAN-UAT.md` (0), `grep -c '^## Gaps' 03-HUMAN-UAT.md` (1), `pgrep -af x64sc` (no orphan from this plan), `pgrep -af vice-broker` (only the pre-existing, unrelated singleton fixture) — all PASS.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*
