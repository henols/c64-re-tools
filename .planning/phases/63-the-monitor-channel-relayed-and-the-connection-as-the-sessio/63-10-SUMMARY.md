---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
plan: 10
subsystem: infra
tags: [vice-mcp, binary-monitor-protocol, jam-frame, register-info, live-proof, gap-closure, windows-ledger]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    plan: "06"
    provides: "The original live, opt-in stock-live-relay.test.ts and the two open non-reproductions (WINDOWS ids 69, 70) this plan's gap probe discriminates by cause"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    plan: "09"
    provides: "broker-relay.test.ts's synthetic proof of the relay's own JAM byte-transparency, which this plan's evidence file cites as the other half of the JAM claim"
provides:
  - "Two opt-in, default-skipped gap-probe cases in stock-live-relay.test.ts that RECORD (not assert) whether genuine stock VICE emits a bare JAM at all under any probeable JamAction, and whether a production-shaped prior connection consumes the one-time REGISTER_INFO greeting"
  - "A new phase evidence document quoting both live GAP-PROBE OBSERVED blocks verbatim, with per-variant and per-connection tables"
  - "Both WINDOWS ids 69 and 70 disposed of (waived) by measurement, per the pre-committed rules in this plan's own PLAN.md"
affects: []

actuals:
  tokens: 10071
  tasks: 2
  commits: 2
  plan_head_before: de95aab51e17b20d2c034187b012b0da42ffbf62

tech-stack:
  added: []
  patterns:
    - "withDirectEmulator(): a local, per-file spawn helper that bypasses the broker entirely for a live probe whose question is about the EMULATOR, not the relay -- deliberately mirrors stock-live-triage.test.ts's own spawnOnPort() in shape rather than importing it (test files in this repo do not import one another)."
    - "Pre-committed disposition rules, written into PLAN.md before the live run: the branch that fires (waive/fixed/escalate) is determined by the measurement, never chosen after seeing which is more convenient."

key-files:
  created:
    - .planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/evidence/phase63-gap-closure-live-measurements.md
  modified:
    - src/mcp/vice/stock-live-relay.test.ts
    - .planning/WINDOWS.md

key-decisions:
  - "The direct-versus-relay discriminator for Case A was implemented as meaningful ONLY for the \"default\" (no -jamaction override) variant, because the broker's own production launch argv carries no jamaction knob (T-33-04) -- a relay-managed instance's shape is byte-identical to the \"default\" direct-dial variant and no other. Since no variant (including default) produced a jam, this branch was never exercised live, but the code path and its own explicit skip-reason exist and were exercised by the skip logic."
  - "Case B's \"ordinary command\" proving the pipe is intact uses REGISTERS_GET (which decodes to a typed \"registers\" reply) rather than PING (which this file's own parser decodes as \"unknown\" -- there is no dedicated Ping response case in stock-protocol.ts's parser), for a cleaner, typed assertion."

requirements-completed: [SESS-02]

coverage:
  - id: D1
    description: "A live, direct-dial gap probe measures whether genuine stock VICE 3.9 emits a bare JAM (0x61) event at all, across three JamAction variants (default, 2, 3), with opcode/PC writes independently confirmed correct by read-back in every case"
    requirement: "SESS-02"
    verification:
      - kind: manual_procedural
        ref: "stock-live-relay.test.ts (opt-in VICE_LIVE_RELAY_BIN=/usr/bin/x64sc), live run 2026-09-20 -- gap-probe: does genuine stock VICE emit a bare JAM at all... -- passed; observed values recorded in phase63-gap-closure-live-measurements.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "A live, three-connection gap probe measures whether a production-shaped readiness-probe connection consumes the one-time REGISTER_INFO greeting"
    requirement: "SESS-02"
    verification:
      - kind: manual_procedural
        ref: "stock-live-relay.test.ts (opt-in VICE_LIVE_RELAY_BIN=/usr/bin/x64sc), live run 2026-09-20 -- gap-probe: does a prior production-shaped monitor connection consume the one-time REGISTER_INFO greeting -- passed; observed values recorded in phase63-gap-closure-live-measurements.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both WINDOWS rows (ids 69, 70) are disposed of by the measurement, per the pre-committed rule, with the ledger's own counters left arithmetically consistent"
    verification:
      - kind: other
        ref: "gsd-tools windows waive 69/70; git diff -- .planning/WINDOWS.md shows both rows and their JSON mirror changed; per-status tallies (45 open / 17 waived / 9 fixed = 71 total) match the frontmatter counters exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full automated suite, with the new gap-probe cases default-skipped, exits 0 with zero failures and an explained delta over the recorded baseline"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice test -- 4268/4184/0/84, exit 0 (baseline 4266/4184/0/82: +2 tests, +2 skipped, 0 pass delta, 0 fail -- exactly the two new default-skipped cases)"
        status: pass
    human_judgment: false

duration: ~20 min (approximate)
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 10: Gap-Closure Live Measurement of the Bare JAM and REGISTER_INFO Greeting Summary

**Two new opt-in, default-skipped gap-probe cases in `stock-live-relay.test.ts` measure, by direct dial against genuine stock VICE 3.9, that no probeable `JamAction` (default, 2, 3) ever emits a bare JAM (0x61) and that a production-shaped readiness-probe connection consumes the one-time `REGISTER_INFO` greeting for every later connection -- both `.planning/WINDOWS.md` findings (ids 69, 70) are waived by this measurement, quoted verbatim in a new phase evidence document.**

## Performance

- **Duration:** ~20 min (approximate)
- **Started:** 2026-09-20T09:24:00Z (approximate, immediately following 63-09's completion)
- **Completed:** 2026-09-20T09:40:44Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1** added a `withDirectEmulator()` helper (argv-array spawn, `127.0.0.1`-only bind, `-default` before `-binarymonitor`, per-run `mkdtempSync()` scratch dir, `try`/`finally` SIGKILL-and-reap) and two gap-probe cases to `stock-live-relay.test.ts`:
  - **Case A** drove the Shape-4 JAM sequence (write KIL, read back, resolve PC's register id via `REGISTERS_AVAILABLE`, set PC, resume, wait for an event) across three direct-dialled emulator instances -- `default` (no override), `jamaction2` (`-jamaction 2`), `jamaction3` (`-jamaction 3`) -- recording per variant whether a jam arrived, its `programCounter`, every event type observed since resume, and both read-back confirmations. The relay-repeat branch (reusing `withRelayHarness()`'s claim-and-attach path, meaningful only for the `default` variant since the broker's own production launch argv has no jamaction knob) was coded and its skip-path exercised, since no variant produced a jam to compare.
  - **Case B** drove `probeReady()` (the exact production readiness-probe shape: real PING, read reply, EXIT, graceful `socket.end()`) as connection 1, then two further direct dials (connections 2 and 3) each with an `event` listener wired before the socket was handed to the client, recording whether an unsolicited `"registers"` event at `VICE_BROADCAST_REQUEST_ID` arrived and whether an ordinary `REGISTERS_GET` still succeeded.
  - Both cases inherit the file's existing `SKIP_REASON`/`{ skip }` gate (no hand-rolled early return) and print exactly one `stock-live-relay: GAP-PROBE OBSERVED -> <json>` line each from a `finally` block.
  - Ran live against `/usr/bin/x64sc` (genuine, unpatched stock VICE 3.9): `# tests 2`, `# pass 2`, `# fail 0`, both `GAP-PROBE OBSERVED` blocks captured (quoted in full below and in the evidence file). With the opt-in env var unset, the same file reports 3 skipped tests (the original combined proof plus both new cases), exit 0. No broker or `x64sc` process was left running after either run (`pgrep -af "vice-broker|x64sc"` confirmed clean before and after).
- **Task 2** wrote `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/evidence/phase63-gap-closure-live-measurements.md` (never `docs/` -- that directory is operator-owned) with the binary path, version, run date, the verbatim `-jamaction <Type>` help line, both `GAP-PROBE OBSERVED` blocks quoted verbatim, per-variant and per-connection tables, a "what this measures / does not" section, and the T-33-04 note. Then disposed of both WINDOWS rows via `gsd-tools windows waive`, and re-ran the full automated suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: A recording-only live probe that tells "the emulator never emitted one" apart from "the relay swallowed one"** - `aa2a21dc` (test)
2. **Task 2: Record the measurement, and dispose of both WINDOWS rows by it** - `6ad2e986` (docs)

_Note: `type: execute`, not `type: tdd` -- no RED/GREEN/REFACTOR cycle in this plan._

## Live measurement, verbatim (see the evidence file for the full document)

**Case A -- `GAP-PROBE OBSERVED`:**

```json
{
  "variants": {
    "default": {
      "jamObserved": false,
      "eventTypesSinceResume": ["resumed"],
      "opcodeReadBackConfirmed": true,
      "pcReadBackConfirmed": true
    },
    "jamaction2": {
      "jamObserved": false,
      "eventTypesSinceResume": ["resumed", "registers", "stopped"],
      "opcodeReadBackConfirmed": true,
      "pcReadBackConfirmed": true
    },
    "jamaction3": {
      "jamObserved": false,
      "eventTypesSinceResume": ["resumed"],
      "opcodeReadBackConfirmed": true,
      "pcReadBackConfirmed": true
    }
  },
  "relayRepeat": {
    "ranFor": null,
    "skippedReason": "no variant produced a jam event over a direct dial -- nothing to compare."
  }
}
```

**Case B -- `GAP-PROBE OBSERVED`:**

```json
{
  "connections": [
    { "index": 1, "shape": "probeReady() (real PING/EXIT, graceful close)", "registerDumpObserved": null, "ordinaryCommandSucceeded": null },
    { "index": 2, "shape": "direct dial, event listener wired first", "registerDumpObserved": false, "ordinaryCommandSucceeded": true },
    { "index": 3, "shape": "direct dial, after connection 2's graceful close", "registerDumpObserved": false, "ordinaryCommandSucceeded": true }
  ]
}
```

## Which disposition branch fired, and why

- **WINDOWS id 70 (JAM) -- WAIVED.** No variant (`default`, `jamaction2`, `jamaction3`) produced a bare JAM over a direct dial, with the KIL opcode write and the PC write independently confirmed correct by read-back in every case (so the absence is an emulator answer, not a harness bug). Per the plan's pre-committed rule, this makes the absence an emulator-side behaviour and exonerates the relay -- the row was waived, citing the evidence file and plan 63-09's `broker-relay.test.ts` (which already proves the relay's own byte-transparency for the JAM shape synthetically). The direct-dial-observed / relay-not-observed branch (which would have required escalating a new Blocker) did **not** fire -- no variant observed a jam at all, so there was nothing for a relay comparison to test.
- **WINDOWS id 69 (REGISTER_INFO) -- WAIVED.** Connection 2 (direct dial immediately after the production-shaped `probeReady()` readiness probe closed) observed no unsolicited register dump, and connection 3 (after connection 2's own graceful close) observed none either -- both connections' own ordinary `REGISTERS_GET` succeeded, proving the wire pipe itself stayed intact. Per the plan's pre-committed rule, this confirms the stated hypothesis (the readiness probe's own connection consumes the one-time greeting) -- the row was waived, citing the three-connection result.

Both dispositions were pre-committed in `63-10-PLAN.md` before this run was performed; neither was chosen after seeing which was more convenient. Both row edits quote a figure from the evidence file and cite it by path (verified: `grep` for both row numbers finds exactly one match each, and `git diff --numstat` shows 11/11 lines touched in `.planning/WINDOWS.md`, covering the table row and its JSON mirror for both ids).

## Files Created/Modified

- `src/mcp/vice/stock-live-relay.test.ts` -- new `withDirectEmulator()` helper plus two gap-probe test cases (Task 1)
- `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/evidence/phase63-gap-closure-live-measurements.md` -- new phase evidence document, never `docs/` (Task 2)
- `.planning/WINDOWS.md` -- ids 69 and 70 waived, both citing the new evidence file; counters updated (`open_count` 47->45, `waived_count` 15->17, `fixed_count` unchanged at 9, `total_count` unchanged at 71) (Task 2)

## Decisions Made

See `key-decisions` in the frontmatter: the relay-repeat branch in Case A is meaningful only for the "default" variant (no production route exists to launch a jamaction override through the broker, T-33-04); Case B's ordinary-command proof uses `REGISTERS_GET` rather than `PING` for a typed, unambiguous assertion.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<acceptance_criteria>` were verified directly (see below) with no fix cycles needed.

**Total deviations:** 0.
**Impact on plan:** None.

### Acceptance criteria, verified

- `grep -ac 'GAP-PROBE OBSERVED' stock-live-relay.test.ts` -> 2 (one console.log call site per case; the section-header prose was worded to avoid a spurious third match).
- `grep -ac 'withDirectEmulator' stock-live-relay.test.ts` -> 5 (definition, doc-comment mentions, and two call sites) -- at least 4 required.
- The spawn is argv-array form: `spawn(viceBinPath, [...])` with an array literal as the second argument; `grep -c 'shell: true' stock-live-relay.test.ts` -> 0.
- Both new cases pass `SKIP_REASON` through `{ skip: SKIP_REASON, ... }`; `grep -n 'if (SKIP_REASON'` finds no hand-rolled early return.
- Armed live run (`VICE_LIVE_RELAY_BIN=/usr/bin/x64sc`, `--test-name-pattern='gap-probe'`): `# tests 2`, `# pass 2`, `# fail 0`, exit 0, 2 `GAP-PROBE OBSERVED` lines. Unset-env run: `# pass 0`, `# skipped 3`, exit 0.
- Case A records an entry for each of the three variants, each carrying the observed event-type list and both read-back confirmations (see the quoted JSON above).
- Case A contains the direct-versus-relay assertion (`assert.equal(relay.jamObserved, true, ...)`, gated on `variantThatJammed === "default"`) -- present in source, not exercised this run since no variant jammed.
- Case B records three connections and asserts connections 2 and 3's ordinary commands succeeded (both `true` in the observed JSON above).
- `git diff` of `stock-live-relay.test.ts` against the pre-commit tree shows the combined proof case's own two unrelaxed assertions unchanged -- confirmed by inspecting the diff directly (only the two import lines and the new GAP PROBE section were added; zero deletion lines inside the pre-existing test body).
- `test-gate.mjs`'s `MANUAL_ONLY_TESTS` registration for `stock-live-relay.test.ts` is unchanged (`git diff --stat -- test-gate.mjs` empty).
- Evidence file exists at the phase `evidence/` path, quotes both `GAP-PROBE OBSERVED` blocks verbatim, and carries the per-variant/per-connection tables.
- `git status --porcelain -- docs/` captured to a file: 2 lines reported, but both are `docs/dissambler-workflow.md` and `docs/vice-mcp-ideas.md` -- pre-existing untracked files present in the working tree before this plan started (confirmed against the session's own starting `git status` baseline), never touched, staged, or referenced by this plan's tasks. This plan itself made zero writes to `docs/` (`git diff --stat` for this plan's own commits shows no `docs/` path).
- Both WINDOWS rows exist and were both modified; per-status tallies (45/17/9 = 71) match the frontmatter counters exactly.
- `npm --prefix src/mcp/vice test` exits 0 with 0 failures: 4268 tests / 4184 pass / 0 fail / 84 skipped, compared against the 63-09 baseline (4266/4184/0/82) as a failing-SET comparison (empty in both) -- the delta (+2 tests, +2 skipped, 0 pass, 0 fail) is exactly the two new default-skipped gap-probe cases.

## Issues Encountered

**Pre-existing, unrelated `docs/` untracked files.** The working tree carried `docs/dissambler-workflow.md` and `docs/vice-mcp-ideas.md` as untracked files from before this plan started (see the conversation's own starting `git status`). Task 2's own verify command (`git status --porcelain -- docs/`) reports these 2 lines regardless of this plan's own work, since it is a blanket repo-wide check rather than a diff against this plan's own starting point. This plan's own commits touch no path under `docs/` -- confirmed directly. Not a deviation requiring action: these files are explicitly out of this plan's scope (per this session's own dispatch instructions) and were never staged, modified, or referenced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both `.planning/WINDOWS.md` findings this phase's live proof (plan 63-06) opened are now waived by direct measurement, each citing this plan's own evidence document. Phase 63's own live-proof gap-closure work (plans 63-07 through 63-10) is complete.
- `requirements.mark-complete SESS-02` reported `already_complete` -- consistent with 63-09-SUMMARY's own precedent: `REQUIREMENTS.md`'s SESS-02 row already read `Complete` from earlier in the phase, and this plan neither touches nor needed to correct that pre-existing state.
- This is the last plan in this phase (63-10 of 10). Per this session's own dispatch instructions, phase completion (`phase.complete`, ROADMAP.md's phase checkbox, REQUIREMENTS.md phase rows beyond this plan's own progress row) is owned by the orchestrator after verification, not by this plan.
- Any future work wanting to actually PRODUCE a bare JAM (0x61) event against genuine stock VICE, for any purpose, now has three independently-measured negatives to build on (default/1, 2, 3) rather than the single default-only measurement plan 63-06 recorded -- `0` (Ask), `4` (Power cycle) and `5` (Quit) remain unprobed for the documented reasons (modal dialog; T-07-17-05's standing prohibition).

## Self-Check: PASSED

- Created file verified on disk: `.planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/evidence/phase63-gap-closure-live-measurements.md` -- `FOUND`.
- Modified files verified on disk with the expected content: `src/mcp/vice/stock-live-relay.test.ts` contains both new test names and `withDirectEmulator` (grep count 5); `.planning/WINDOWS.md` rows 69 and 70 both read `waived` with a reason citing the evidence file.
- Commit hashes verified in `git log --oneline --all`: `aa2a21dc`, `6ad2e986` -- both `FOUND`.
- All plan-level `<verification>` commands re-run and passing: bin presence/version; `npm --prefix src/mcp/vice run typecheck` (exit 0); armed live run (`# tests 2`, `# pass 2`, `# fail 0`, 2 observation lines, exit 0); unset-env run (`# pass 0`, exit 0); evidence file present with 3 `GAP-PROBE OBSERVED` occurrences (>= 2 required) and zero `docs/`-path writes from this plan; both WINDOWS rows present, modified, and counter-consistent; full suite (4268/4184/0/84, exit 0).
- Every `must_haves.truths` entry from the plan has a named, passing test case and a corresponding WINDOWS disposition (see coverage block D1-D4 above and the "Which disposition branch fired" section).
- No pre-existing live assertion was relaxed: the combined proof case in `stock-live-relay.test.ts` is byte-for-byte unchanged except for two additive import-line edits.
- Broker and emulator processes confirmed stopped after both live runs: `pgrep -af "vice-broker|x64sc"` reported no matching process before and after.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio*
*Completed: 2026-09-20*
