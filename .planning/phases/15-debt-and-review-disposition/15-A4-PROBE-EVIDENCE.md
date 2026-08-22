---
tested_artifact_sha: dc4f6deaa50a98d1d6bb436a238550123721f6aa
tested_artifact_route: local-checkout-HEAD
stock_binary_path: /usr/bin/x64sc
vice_version: "x64sc (VICE 3.9)"
stock_binary_package_version: "3.9+dfsg-1"
node_version: v22.22.0
driven_by: agent (this plan's own executor, live opt-in node --test run of stock-a4-checkpoint-flood.test.ts)
date: 2026-08-22
a4_verdict: confirmed
---

# Phase 15 Plan 10 — A4 Probe Evidence

**A4's question, restated in one sentence:** is `stock-checkpoints.ts`'s D-11 rate-limit guard's
auto-disable deferral — scheduled via a single `setImmediate()` call out of a `CHECKPOINT_INFO`
event listener that itself runs synchronously, inside the emulator's CPU loop, on every hit of a
`stop:false` checkpoint — race-free (fires, reaches the wire, and does not stall the emulator)
under a real, sustained flood of that synchronous event, rather than merely in the unit tests'
simulated event stream?

## Method

**Binary under test:** `/usr/bin/x64sc`, self-reported `x64sc (VICE 3.9)` (`x64sc --version`;
Debian package `3.9+dfsg-1`, confirmed genuinely unpatched — the fork build at
`/usr/local/bin/x64sc` shadows bare `x64sc` earlier on `$PATH` and was never invoked; every
launch below names the absolute stock path). `DISPLAY=:0` was present throughout.

**Driving mechanism:** `.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`, an opt-in,
default-skipped `node --test` case (`VICE_LIVE_A4_FLOOD_BIN=/usr/bin/x64sc node --test
stock-a4-checkpoint-flood.test.ts`), launched through the real broker artifact
(`resources/vice-broker.mjs`) and driving `dispatchStock()` against the granted instance —
never a hand-built argv or an in-process shortcut for the launch under test, matching this
phase's established live-harness convention (`stock-broker-live.test.ts`).

**Armed address:** `$EA31`, read from `c64-memory-mapping/memmap.json`'s own `CINV` entry
("Vector: Hardware IRQ Interrupt Address ($EA31).") rather than typed from memory. `$EA31` is
the KERNAL's documented default hardware-IRQ service-routine entry point, reached via the
`$0314`/`$0315` vector on every CIA1 timer IRQ (the jiffy-clock update) on an unmodified,
freshly booted machine — no fixture, no ACME assembly, and no autostart were needed to reach it.
This is deliberately the gentle tier the plan specifies: a real, comfortably-hot address (~50-60Hz
on real hardware) well above the D-11 guard's 20-hits-per-second limit, without the
million-hits-per-second cliff of a tight loop.

**Measured window and bounded deadlines:** a `stop:false` checkpoint was armed at `$EA31`
(`vice_checkpoint_add({start: "$EA31", stop: false, acknowledgeTraceRisk: true})`), then polled
in a bounded loop (resume via `vice_execution_run`, sleep 600ms, read via
`vice_checkpoint_list`) for up to a 9000ms deadline, watching the checkpoint's own wire
`hitCount` field and the trace guard's `autoDisables` report — never a paused-state flag, per
this project's `vice-sync.ts` invariant. A tight-loop escalation tier (a hand-assembled,
ACME-built BASIC-stub-launched `sei` / `loop: jmp loop` program at `$080D`/`$080E`) was
implemented and ready to run if the gentle tier's deadline expired with no auto-disable, with the
escalation's own recovery route (this test's `withBrokerHarness()` teardown —
SIGTERM-then-SIGKILL of the granted process, unconditional in a `finally` block — as the bounded
substitute for `vice_recycle` in this harness's scope, since it drives `dispatchStock()` directly
rather than the full MCP proxy's diagnose/recycle surface) recorded before any escalation would
have been attempted.

## Raw observations

The gentle tier reproduced across two runs during development (both quoted below for
transparency — the second is the run this evidence document's verdict rests on):

**Run A** (development iteration, before the post-flood progress check was corrected to use PC
sampling — see Deviations below):

```
poll iteration 1 -- checkpoint 1 hitCount=0  enabled=true  autoDisableEntry=none yet
poll iteration 2 -- checkpoint 1 hitCount=0  enabled=true  autoDisableEntry=none yet
poll iteration 3 -- checkpoint 1 hitCount=17 enabled=true  autoDisableEntry=none yet
poll iteration 4 -- checkpoint 1 hitCount=21 enabled=false autoDisableEntry={"checkpointNum":1,"reason":"auto-disabled: exceeded 20 hits/second on a stop:false trace checkpoint (observed ~21/s) -- a non-stopping checkpoint emits CHECKPOINT_INFO synchronously from inside the emulator's CPU loop and can deadlock this client on a hot address","at":1787418725980,"hitsPerSecond":21}
```

**Run B** (the run this evidence document's verdict is drawn from — full `node --test` pass,
`0 fail`):

```
stock-a4-checkpoint-flood: armed address = $EA31 (59953) -- c64-memory-mapping/memmap.json,
  sym "CINV": "Vector: Hardware IRQ Interrupt Address ($EA31)." -- ...
stock-a4-checkpoint-flood: vice_checkpoint_add (gentle tier, $EA31) ->
  {"id":1,"start":59953,"end":59953,"stop":false,"enabled":true,
   "operation":{"value":4,"flags":["exec"],"defaulted":true},"temporary":false,
   "hitCount":0,"ignoreCount":0,"hasCondition":false,"traceMode":true,"runState":"stopped"}
poll iteration 1 -- checkpoint 1 hitCount=0  enabled=true  autoDisableEntry=none yet
poll iteration 2 -- checkpoint 1 hitCount=0  enabled=true  autoDisableEntry=none yet
poll iteration 3 -- checkpoint 1 hitCount=7  enabled=true  autoDisableEntry=none yet
poll iteration 4 -- checkpoint 1 hitCount=21 enabled=false autoDisableEntry={"checkpointNum":1,
  "reason":"auto-disabled: exceeded 20 hits/second on a stop:false trace checkpoint
  (observed ~21/s) -- a non-stopping checkpoint emits CHECKPOINT_INFO synchronously from
  inside the emulator's CPU loop and can deadlock this client on a hot address",
  "at":1787418850020,"hitsPerSecond":21}
stock-a4-checkpoint-flood: wire-side re-check after auto-disable -- checkpoint 1 entry =
  {"id":1,"start":59953,"end":59953,"stop":false,"enabled":false,
   "operation":{"value":4,"flags":["exec"]},"temporary":false,"hitCount":21,"ignoreCount":0,
   "hasCondition":false,"traceMode":true,"condition":null,"conditionTextKnown":false,
   "autoDisabled":{"reason":"auto-disabled: exceeded 20 hits/second on a stop:false trace
   checkpoint (observed ~21/s) -- ...","at":1787418850020,"hitsPerSecond":21}}
stock-a4-checkpoint-flood: post-flood progress check -- PC samples over 5 bounded
  resume/sleep/read attempts = [58836,58836,58831,58833,58836]
ok 1 - stock-a4-checkpoint-flood: ...
# tests 1 / # pass 1 / # fail 0
```

**The verbatim `autoDisables` entry** this A4 verdict rests on (Run B, the same object both the
gentle-tier poll and the wire-side re-check independently reported):

```json
{
  "checkpointNum": 1,
  "reason": "auto-disabled: exceeded 20 hits/second on a stop:false trace checkpoint (observed ~21/s) -- a non-stopping checkpoint emits CHECKPOINT_INFO synchronously from inside the emulator's CPU loop and can deadlock this client on a hot address",
  "at": 1787418850020,
  "hitsPerSecond": 21
}
```

**The wire-side enabled flag** (re-read via a fresh `vice_checkpoint_list` call *after* the
auto-disable, not merely the local `autoDisabled` report — the exact check A4 asks for, since an
entry in the local report with a still-enabled checkpoint on the wire is precisely the race under
test): `enabled: false`. The toggle reached the wire.

**The post-flood progress observation:** five bounded resume/sleep/read attempts (400ms sleep
each) sampled the PC register: `[58836, 58836, 58831, 58833, 58836]` (`$E5D4`, `$E5D4`, `$E5CF`,
`$E5D1`, `$E5D4` — all KERNAL-area addresses the machine's own idle/IRQ-return loop visits). Not
all five samples are identical, so the emulator was demonstrably still executing after the flood
and after the auto-disable — not stalled, not dead.

**No orphan process or scratch directory:** `pgrep -af x64sc` after the run showed no process
from this run; `pgrep -af vice-broker` showed only a pre-existing, unrelated long-lived
`broker-control.test.ts` singleton fixture (confirmed by PID and start time, the same singleton
plan 15-08's own evidence document names); the harness's `mkdtempSync` scratch directory was
confirmed absent after teardown.

**Escalation:** not needed. The gentle KERNAL-IRQ tier exceeded the 20-hits-per-second limit on
its own (observed ~21/s) well within the poll loop's 9000ms deadline (by the fourth 600ms-spaced
iteration, roughly 2.4 seconds of real run time). The tight-loop escalation code path exists in
`stock-a4-checkpoint-flood.test.ts` and was typechecked, but its runtime branch was not exercised
this session — recorded honestly, not implied as run.

## Verdict

**A4 — CONFIRMED, for the rates and host tested.** The D-11 rate-limit guard's `setImmediate()`
auto-disable deferral fired under a real, synchronous `CHECKPOINT_INFO` flood generated from
inside VICE's own CPU loop: the local `autoDisabled` report and the checkpoint's own wire-side
`enabled` flag agreed (both `false`) with no observed divergence between them, and the emulator
continued executing afterward rather than stalling or deadlocking.

**What this establishes:** on this specific host and build (genuine unpatched `/usr/bin/x64sc`,
VICE 3.9, Debian package `3.9+dfsg-1`), at the rate a real KERNAL IRQ handler naturally produces
(~21 observed hits/second, just over the 20/s threshold), the deferral through `setImmediate()`
is race-free — it schedules and completes the disabling `CHECKPOINT_TOGGLE` send correctly, that
send reaches the wire, and the client never blocks the emulator's CPU loop long enough to be
observed as a stall.

**What this does NOT establish:** this is a single run, on one host, at one build, at one
observed rate (~21/s, barely over the 20/s limit). It does not establish freedom from a race at
substantially higher rates (the tight-loop escalation tier exists precisely for that gap and was
not exercised, because it was not needed to answer the gentle tier's own question), nor does it
establish the same result on a different VICE build, a different OS/scheduler, or under
concurrent host load that could plausibly widen the `setImmediate()` deferral window. It also does
not establish behaviour for multiple simultaneously-flooding `stop:false` checkpoints at once
(this probe armed exactly one). A future probe wanting stronger rate coverage has the escalation
tier already written and ready to invoke.

## Resolution: closing `2026-08-14-probe-phase3-assumed-wire-details.md`

This todo is closed in full by this plan (`git mv` to `.planning/todos/completed/`, `##
Resolution` section appended there). All five original assumptions' final states, for the
record:

- **A1** (`-remotemonitoraddress` flag spelling) — CONFIRMED by Phase 13 plan 13-03 against fork
  VICE 3.10; label removed by plan 13-04. See `13-PROBE-RESULTS.md` §A1.
- **A2** (`ADVANCE_INSTRUCTIONS` step-over semantics) — CONFIRMED by Phase 13 plan 13-03 against
  fork VICE 3.10; label removed by plan 13-04. See `13-PROBE-RESULTS.md` §A2.
- **A3** (`JOYPORT_SET` bit mapping) — INCONCLUSIVE, label stays on
  (`assumption-label-discipline.test.ts`'s all-or-nothing guard for A3 is untouched). Phase 13
  plan 13-03's zero-delta result was independently reproduced by Phase 15 plan 15-08 against a
  program proven genuinely running, eliminating one of A3's three candidate explanations without
  resolving which of the remaining two is true. See `13-PROBE-RESULTS.md` §A3 and
  `15-UAT-EVIDENCE.md` § Scenario 2.
- **A4** (this plan's own item — the `stop:false` rate-limiter's auto-disable deferral timing) —
  **CONFIRMED**, for the rates and host tested, per this document.
- **A5** (`AUTOSTART` `fileIndex` with the run flag clear) — CONTRADICTED by Phase 13 plan 13-03;
  label stays on. Handed to its own todo
  (`2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`) via D-13-04's escape
  hatch, which remains open on its own track and is not closed by this document.

Cited commit for A4's own answer: this plan's Task 1 commit (`dc4f6de`, adding
`stock-a4-checkpoint-flood.test.ts`) and this document.

## Deviations from the plan's own design, encountered while building the probe

- **`c64-memory-mapping/memmap.json` is `{ sources, entries }`, not a bare array** — the probe's
  address-lookup helper was corrected to read `.entries` rather than treating the parsed JSON as
  the array itself. Caught by the live run's own first failure (`raw.find is not a function`),
  fixed, re-verified.
- **The post-flood progress check was changed from a two-sample raster-line (`LIN`) comparison to
  a five-sample PC comparison.** The original design (read `LIN` before/after an 800ms sleep)
  consistently observed `LIN=0` in both samples on this build — matching an unrelated data point
  already on file (plan 15-08's own `stock-broker-live.test.ts` evidence transcript also shows
  `LIN:0` on both of its own register-read attempts), which reads like this monitor's halt point
  is synchronised to the raster on this build rather than `LIN` tracking elapsed real time at the
  read granularity a single before/after pair uses. Switched to sampling the `PC` register five
  times (matching `stock-broker-live.test.ts`'s own scenario-2 running-state proof) and asserting
  the samples are not all identical — a strictly more robust progress signal, since the PC is
  provably not stuck once at least one of five bounded samples differs from the others. This is a
  test-file-only correction (Rule 1, a bug in the probe's own design), not a finding about
  `stock-checkpoints.ts` or any other production source.
