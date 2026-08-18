---
phase: 07-cycle-timing-and-wedge-triage
fixed_at: 2026-08-18T14:05:00Z
review_path: .planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md
iteration: 1
findings_in_scope: 20
fixed: 20
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-18
**Source review:** `.planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 20 (1 critical + 19 warnings; `fix_scope: critical_warning`, and the review recorded 0 info findings)
- Fixed: 20
- Skipped: 0

**Gate result:** `npx tsc --noEmit` clean; `node test-gate.mjs` reports **1624 pass / 0 fail / 5 todo**
(baseline before these changes was 1565 / 0 / 5 — **+59 tests, no regressions**). The 5 todo are the
CLAUDE.md-sanctioned `vice-sync.ts` items, untouched. `node build.ts` re-run and
`resources-sync.test.ts` green (`backend-detect.mjs` regenerated for the `.mts` change).
`node probe-binmon.mjs --selftest` passes; `node scripts/check-skill-tool-coverage.mjs` passes.

## Fixed Issues

### CR-01: A client-side decode failure is persisted to the on-disk capability record

**Files modified:** `.claude/mcp/vice/stock-connect.ts`, `.claude/mcp/vice/stock-connect.test.ts`, `.claude/mcp/vice/backend-detect.mts`, `.claude/mcp/vice/backend-detect.test.ts`, `.claude/mcp/vice/resources/backend-detect.mjs`
**Commit:** `5c7cbd4`
**Applied fix:** `probeCpuHistory()` now returns `{ capability, source: "wire" | "decode_failure" }` and
`resolveCapabilities()` persists only wire-sourced answers — a decode failure still answers `"absent"`
in-process but writes no record. Added `CAPABILITY_SCHEMA_VERSION` (= 2) to the on-disk record;
`readCapabilityRecord()` treats a mismatch **including absence** as `stale`, so every record written
by the pre-fix parser is invalidated and a future parser fix invalidates its own predecessors.
Re-narrowed the `resolveCapabilities()` catch to rethrow unclassified `StockProtocolError` codes,
restoring `0x82 InvalidApiVersion` as a fatal handshake failure (the existing test asserting the
opposite was updated, with both revisions of the reasoning recorded in place).

### WR-01: `vice_run_until` asserts `machineHalted: true` unconditionally

**Files modified:** `.claude/mcp/vice/stock-run-until.ts`, `.claude/mcp/vice/stock-run-until.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/skills/vice-wedge-triage/SKILL.md`
**Commit:** `75f7b42`
**Applied fix:** Derived from `cleanup !== "delete_failed" && session.client.connected`, falling back to
`runStateFor(session.client) === "stopped"` — the same seam `deriveMachinePaused()` uses. Per-branch
`machineHaltedNote` (naming `vice_execution_run` when halted, `vice_diagnose` when unestablished),
and the `explanation` no longer instructs a resume unconditionally. The test stub gained a
`connected` getter (defaulting `true`) so existing cases keep exercising the live-socket path.

### WR-02: the advertised `diagnosis_unavailable` contract missed two reachable paths

**Files modified:** `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-diagnose.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/skills/vice-wedge-triage/SKILL.md`
**Commit:** `b1a0f7d`
**Applied fix:** Added the `liveness_unmeasurable` reason class with its own guidance, routed both
inconclusive-bracket sites and the outer catch-all through `diagnoseUnavailableResult()`, deleted the
now-unused `diagnoseErrorResult()` alias, and stripped `inconclusiveBracketText()`'s duplicate
`vice_diagnose:` prefix. Added a test asserting **every** `isError` answer the handler can produce
matches the advertised prefix (acquisition failures, the verdict-path bracket exit, and the catch-all).

### WR-03: `machinePausedSource: "observed"` for a provably-stale projection

**Files modified:** `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-diagnose.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`
**Commit:** `ba0c8ba`
**Applied fix:** A `"running"` reading now collapses with `"unknown"` to `true`/`"structural"` — every
path reaching a verdict has already sent a halting read (D-05), so `"running"` contradicts this path's
own reads rather than observing the machine. Added the previously-uncovered `"running"` case plus
`machinePaused` assertions on the `live` and `wedged` verdicts (both were hardcoded before 07-15 and
left unasserted by it).

### WR-04: the wire's `JAM` event is parsed and then discarded

**Files modified:** `.claude/mcp/vice/stock-runstate.ts`, `.claude/mcp/vice/stock-runstate.test.ts`, `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-diagnose.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/skills/vice-wedge-triage/SKILL.md`
**Commit:** `88b9a15`
**Applied fix:** `RunStateTracker` gained a latching `jamObserved()` (never cleared, not even by a later
`RESUMED`), exposed as `jamObservedFor()`. `diagnoseVerdictResult()` stamps `evidence.jamObserved`
into **every** verdict (always present, never omitted) and appends a report note naming
`vice_machine_reset` rather than `vice_recycle`. Declared in the stock manifest's `evidence`
outputSchema as a required boolean, and documented in the SKILL with the two-`jamaction` table
(`wedged` under `-jamaction 2`, `live` under the default) that explains why it is evidence on the
existing five verdicts and not a sixth (D-03).

### WR-05 + WR-06: the `CPUHISTORY_GET` loop's bounds, and `RESOURCE_GET`'s unknown value types

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `c3b2896`
**Applied fix (WR-05):** `regCount` is now bounds-checked against `entryEnd` **before** the body-relative
`need()`, so a multi-entry frame with `item_size < 2` can no longer read its register count out of the
next entry (the fabricated `4608` in the review's reproduction). `instruction_length` is validated
against the entry's own declared length instead of a hardcoded `3`, so an entry declaring `200` with 3
bytes present is refused rather than parsed. The mis-named regression test now asserts the **message**,
and a second case supplies a body long enough that only the entry-relative guard can fire; two more
cases cover the overstated and the truthful `instruction_length`.
**Applied fix (WR-06):** A value-type byte outside the documented `{0, 1}` set is a `StockFramingError`
naming the observed byte, instead of falling through to the string branch and rendering arbitrary bytes
as ASCII. Value type `0` still decodes as a string (asserted, so the guard cannot have narrowed the
documented set).

### WR-07: Route A reads `entries[0]` and names it `newest`

**Files modified:** `.claude/mcp/vice/stock-timing.ts`, `.claude/mcp/vice/stock-timing.test.ts`
**Commit:** `41bfc8f`
**Applied fix:** Indexed from the end (`entries[entries.length - 1]`), with the ordering proof and the
reason the positional read was dangerous recorded at the site. Two regressions feed multi-entry
replies: one asserting `readCycleBaseline()` samples the highest cycle, one asserting the stopwatch's
delta is newest-to-newest (2500, where reading `entries[0]` on both sides would give 2000).

### WR-08: `docs/phase0-binmon-findings.md` §5 still carries the disproven layout

**Files modified:** `docs/phase0-binmon-findings.md`
**Commit:** `e65cc69`
**Applied fix:** §5's `CPUHISTORY_GET` response body replaced with the re-derived, fixture-verified
layout as a fenced field-by-field block (`item_size` = everything after that byte, stride
`item_size + 1`; `regCount`; register items; `cycle`; `instruction_length` hardcoded 4), plus the
oldest-first ordering statement and an explicit do-not-restore note pointing at the parser and its
regressions. The earlier §"newest entry's cycle" bullet was corrected too — it also omitted that the
newest entry is the **last**, and wrongly implied the cycle ends an entry.

### WR-09: the fixture registry still describes three synthetic fixtures

**Files modified:** `.claude/mcp/vice/binmon-fixtures.ts`, `.claude/mcp/vice/binmon-fixtures.test.ts`, `.claude/mcp/vice/probe-binmon.mjs`, `.claude/mcp/vice/fixtures/binmon/README.md`, and the three `cpuhistory-get*.json` sidecars
**Commit:** `b04a084`
**Applied fix:** `synthetic` is now a **required** provenance key, so provenance can never again be
established by omission (the defect: `provenance.synthetic === true` meant a silent sidecar read back
as a real capture, satisfying `assert.equal(fixture.synthetic, false)` by saying nothing).
`buildSidecar()` emits `synthetic: false`; the three sidecars state it explicitly with a decoding note.
The README now has separate synthetic/real sections, three new table rows, the extended `<case>` list,
and the corrected five-key sidecar contract; `binmon-fixtures.ts`'s blanket "NOT currently real
captures" / "nothing downstream may treat these bytes as hardware evidence" header was replaced with a
per-fixture statement. Added a test asserting every committed sidecar states its provenance and that
the three CPUHISTORY_GET captures state it as real.

### WR-10: `--capture all` can regenerate `cpuhistory-get-unsupported` from the wrong build

**Files modified:** `.claude/mcp/vice/probe-binmon.mjs`, `.claude/mcp/vice/binmon-fixtures.test.ts`
**Commit:** `581a827`
**Applied fix:** `CAPTURE_REQUIRES_VERSION` declares the required build family per case and is checked
**before** the runner sends anything — a mismatch (including an unreadable `VICE_INFO`, i.e.
`viceVersion === "unknown"`) is skipped with a named reason and writes no `.bin` and no `.json`. The
script's dispatcher is now wrapped in the standard `import.meta.url === file://${process.argv[1]}`
guard so the table is importable (previously a plain `import` fell through to `main()` and dialled a
socket). Tests assert the committed sidecars' `viceVersion` against the gate, that the two
CPUHISTORY_GET gates are mutually exclusive for every version tried, and that the offline selftest
(which machine-checks the table) passes.

### WR-11: `check-skill-tool-coverage.mjs` misclassifies `vice_diagnose`/`vice_recycle`

**Files modified:** `scripts/check-skill-tool-coverage.mjs`
**Commit:** `18e5474`
**Applied fix:** Added `PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY` for the hybrid case (handler in
`vice-proxy.ts`, definition from the stock manifest), asserted present in the stock manifest and
deliberately **not** allowlisted so both tools count toward `resolvedAdvertisedCount` (which rose from
27 to 29). Gave `PROXY_LOCAL_TOOLS` the missing absent-from-both-manifests assertions — it was the one
classification with no manifest-presence check, which is how it kept claiming "present in neither
manifest by design" against `stock-dispatch.test.ts`'s opposite assertion. **Verified the new guard
fails** on a deliberate misclassification before restoring.

### WR-12: `stock-derived.ts`'s citations and reachability reasoning are stale

**Files modified:** `.claude/mcp/vice/stock-derived.ts`
**Commit:** `173d949`
**Applied fix:** Re-verified against the current source (2889 / 1344 / 1368, not 2773 / 1343 / 1367) and
replaced the line numbers with **symbol-anchored** citations, recording why (these drift every phase,
and this header is the in-tree statement of CLAUDE.md's derived-tool constraint). Restated the
"unreachable on stock" argument in terms of what enforces it today — `buildBackendAwareTool()` routes
every stock call to `dispatchStock()` — and noted that the old reason became false when Phase 7
implemented `handleRecycleStock`.

### WR-13: a bigint cycle delta narrowed with `Number()` and still labelled `exact`

**Files modified:** `.claude/mcp/vice/stock-timing.ts`, `.claude/mcp/vice/stock-timing.test.ts`, `.claude/mcp/vice/stock-recycle.ts`, `.claude/mcp/vice/stock-recycle.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`
**Commit:** `086ee42`
**Applied fix:** Gated the narrowing on `delta <= BigInt(Number.MAX_SAFE_INTEGER)`; above it the label
becomes `"exact-but-narrowed"` with a `caveat` pointing at `cyclesExact` (boundary tested as inclusive).
`stock-recycle.ts`'s incident record now always carries `cyclesExact`, and when the narrowing would
round it puts the exact decimal in `cycles` itself, because `incident-record.ts`'s renderer only prints
`cycles`/`elapsedMs` — so the permanent artifact can never present a rounded figure as the measurement.
Manifest description documents `cyclesExact` as authoritative.

### WR-14: stopwatch baselines and the video-standard cache are never invalidated

**Files modified:** `.claude/mcp/vice/stock-timing.ts`, `.claude/mcp/vice/stock-timing.test.ts`, `.claude/mcp/vice/stock-dispatch.ts`
**Commit:** `4cf0662`
**Applied fix:** Both stores now record the session's `baselineEpoch` alongside the value. An epoch
mismatch is a first-class stopwatch refusal checked **before** either route's arithmetic (so it covers
Route B, which had no guard of its own, not just Route A's incidental `delta < 0n`), and a
video-standard entry whose epoch differs is a cache **miss**. Exported
`forgetTimingForOtherTargets()`, called from the same line in `ensureStockSession()` that already
evicts the condition registry, so the two registries cannot drift on when they forget. Five tests
including the "same machine, same epoch, new session object still measures" case that keeps the strong
`Map` meaningful.

### WR-15: env-var timeout parsers still accept `0`

**Files modified:** `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-diagnose.test.ts`, `.claude/mcp/vice/stock-recycle.ts`, `.claude/mcp/vice/stock-recycle.test.ts`
**Commit:** `7e10d45`
**Applied fix:** Both validators require `parsed > 0` and log the rejected value together with the
default being used (a silent fallback is how a stray `0` stays invisible for a session). The diagnose
log names the `monitor_acquisition_timeout` misdiagnosis a `0` would otherwise produce; the recycle log
names the evidence-free incident record. Tests cover `0`, negatives, non-numeric, `NaN` and `±Infinity`
for all three knobs, plus that a positive override is still honoured (a test needing an instant
timeout passes `1`).

### WR-16: the `stock-dispatch` ↔ `stock-diagnose` ↔ `stock-recycle` cycle has no guard

**Files modified:** `.claude/mcp/vice/load-order.test.ts`
**Commit:** `e39a1cb`
**Applied fix:** Added Part 4. Cycle members are **derived** from a new VALUE-only import graph — using
the existing graph (which counts `import type` edges) made 19 stock modules look like members and would
have failed on `stock-checkpoints.ts`'s perfectly safe `const` handlers; the value-only graph yields
exactly `stock-diagnose.ts`, `stock-dispatch.ts`, `stock-recycle.ts`. Two complementary guards: one
child process per entry point asserting a clean `import` (the runtime proof, since evaluation order
differs per entry point), and a comment-aware source check that no `handle*`/`dispatch*`/`resolve*`
export from a cycle member is a `const` arrow. A non-vacuity test fails if the cycle is ever broken
structurally, so the guards cannot pass on an empty subject. **Verified both guards fail** when
`handleDiagnoseStock` is changed back to a `const` arrow (the runtime one reproducing the real
`ReferenceError`), before restoring.

### WR-17: `resolveVideoStandard()`'s catch-all swallows typed transport errors

**Files modified:** `.claude/mcp/vice/stock-timing.ts`, `.claude/mcp/vice/stock-timing.test.ts`
**Commit:** `7274287`
**Applied fix:** `MachineRestartedError`, `StockConnectionClosedError` and `StockRequestTimeoutError`
now propagate; the PAL fallback is kept for value-shaped failures only (unexpected reply shape,
unrecognised standard, missing resource). Tests assert each of the three propagates by identity, that a
value-shaped failure still yields `assumed: true`, that a transport failure inside Route B's
`readCycleBaseline()` reaches the caller, and that `classifyDiagnoseUnavailable()` maps exactly those
errors to `connection_lost`/`request_timeout` — connecting the two halves of the fix visibly.

### WR-18: `vice_run_until` silently ignores `cycles`, accepts unknown arguments

**Files modified:** `.claude/mcp/vice/stock-run-until.ts`, `.claude/mcp/vice/stock-run-until.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/skills/vice-wedge-triage/SKILL.md`
**Commit:** `7ee52aa`
**Applied fix:** `cycles` is refused whenever **present**, not only when `address` is absent, with a
distinct message for the address-present case that names `timeout_ms` as the argument that does bound
the wait. Unexpected keys are refused by name, matching `handleCyclesStopwatch`'s discipline — the
realistic `timeoutMs`/`timeout_ms` typo previously ran with the default bound in silence. Both refusals
happen before anything is armed (asserted: zero sends). Manifest input descriptions and the SKILL
updated.

### WR-19: `vice_diagnose`'s bounded acquisition abandons the losing promise unobserved

**Files modified:** `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-diagnose.test.ts`, `.claude/skills/vice-wedge-triage/SKILL.md`
**Commit:** `b8cecf6`
**Applied fix:** An observer is attached to the in-flight acquisition **inside the timed-out branch**,
reporting a later success (a `heldSession` the answer did not describe) or a later failure (calling out
a `MonitorOwnershipError`, which had its own verdict) on stderr. Attaching before the race was tried
first and is wrong: the observer would be queued ahead of the race's own continuation, so any
"already settled" flag is still false and the **normal** path logs a spurious abandonment line — that
regression is now itself a test. The refusal text says the acquisition may still be in flight and that
a later-appearing held session is not a ghost; the SKILL's reason table says the same.

## Notes for the developer

**Two findings changed advertised behaviour in ways that go beyond a bug fix** — both directly
instructed by the review, but worth a conscious look:

1. **CR-01** makes `0x82 InvalidApiVersion` (and any other unclassified wire error code) **fatal to the
   handshake** again. 07-11 had deliberately widened this so "every downstream stock tool stays
   reachable even when a future, currently-unmapped wire error code appears"; the review argues that an
   api-version rejection is the one thing step 3 exists to make fatal. The test that asserted the old
   behaviour was rewritten rather than left green-but-wrong, and both revisions of the reasoning are
   recorded in the test file.
2. **WR-18** makes `{ address, cycles }` an **error** where it previously succeeded (while silently
   dropping `cycles`). Any existing caller passing both now gets `isError: true`.

**Requires human verification (logic, not syntax):** WR-01, WR-03, WR-13, WR-14 and WR-19 change
*conditions and derivations* rather than structure, and unit tests can only confirm the branches
behave as written, not that the semantics are what you want:
- **WR-01/WR-03** — `machineHalted` and `machinePaused` are now `false`/`structural` in cases that
  previously reported confidently. Both changes make the answer *less* assertive on purpose; confirm
  that is the trade you want for `vice_run_until` and `vice_diagnose`.
- **WR-14** — the epoch check will refuse a stopwatch read that previously produced a figure whenever
  `baselineEpoch` differs. If `baselineEpoch` is `null` on both sides (identity unprovable at connect)
  the check passes, which is the most this file can honestly claim but is not a proof of sameness.
- **WR-19** — the observer cannot cancel the acquisition; it only makes the outcome visible. A session
  can still be established after a `monitor_acquisition_timeout` answer. That is now documented rather
  than fixed, because cancelling would race the broker claim.

**Not re-exercised against a real emulator.** Everything here is unit- and gate-proven. The two
`stock-live*.test.ts` files remain default-SKIP manual-only entries and were not run; WR-04's
`jamObserved` in particular is asserted against a synthesised `JAM` event, not a real `KIL`.
`vice-sync.ts` was not touched (its checkpoint-wait functions stay deliberately untested, per
CLAUDE.md).

**Deferred-items carryover.** The review noted that WR-04/05/06/09/10/11/12 (its previous-review
numbering) were untracked in `deferred-items.md`. All are now fixed rather than deferred, so no
`deferred-items.md` entry was added; that file was left untouched.

---

_Fixed: 2026-08-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
