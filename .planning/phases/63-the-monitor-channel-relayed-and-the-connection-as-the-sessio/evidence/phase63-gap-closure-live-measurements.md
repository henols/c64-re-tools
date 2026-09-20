# Phase 63 Plan 10: Gap-Closure Live Measurements

This document is the live evidence for plan 63-10, which answers, by direct
measurement, the two non-reproductions plan 63-06 recorded honestly and left
open on `.planning/WINDOWS.md`: id 69 (the unsolicited `REGISTER_INFO` dump
on monitor open was not observed over the relay connection) and id 70 (no
`JAM` (0x61) event arrived against genuine stock VICE 3.9 under the default
`JamAction`). Both cases record an outcome rather than assert one; this file
quotes the recorded outcome verbatim and is the citation each WINDOWS row
points back to.

## Binary and environment

- **Binary:** `/usr/bin/x64sc` (absolute path -- `/usr/local/bin/x64sc` is a
  fork build that shadows `x64sc` on `$PATH` and was never used).
- **Reported version:** `x64sc (VICE 3.9)` (`/usr/bin/x64sc --version`).
- **Date:** 2026-09-20.
- **No broker daemon and no leftover `x64sc` process running before or after
  either run** -- `pgrep -af "vice-broker|x64sc"` (excluding the shell
  invoking it) confirmed empty immediately before the live run and again
  immediately after it completed.
- **Command:**
  ```
  VICE_LIVE_RELAY_BIN=/usr/bin/x64sc node --test --test-reporter=tap \
    --test-name-pattern='gap-probe' stock-live-relay.test.ts
  ```
  run from `src/mcp/vice/`. Result: `# tests 2`, `# pass 2`, `# fail 0`, exit
  0. Both new cases printed their own `GAP-PROBE OBSERVED` block, quoted in
  full below.
- **The verbatim `-jamaction <Type>` line, from `/usr/bin/x64sc --help`:**
  ```
  -jamaction <Type>
  	Set action on CPU JAM: (0: Ask, 1: continue, 2: Monitor, 3: Reset, 4: Power cycle, 5: Quit Emulator)
  ```
  `0` (Ask) was not probed: it raises a modal dialog, which would hang this
  session with no automated way to dismiss it. `4` (Power cycle) and `5`
  (Quit Emulator) were not probed: this project's own standing rule
  (T-07-17-05, `stock-live-triage.test.ts`) forbids both -- power-cycling
  destroys all emulation state, and quitting races the harness's own
  teardown. The probeable set was therefore exactly `1` (the default, no
  override), `2` (Monitor) and `3` (Reset), matching this plan's own
  `<planner_findings>` fact 3.

## Case A -- does genuine stock VICE emit a bare JAM at all, and does the relay differ from a direct dial

**`GAP-PROBE OBSERVED` block, quoted verbatim (from the live run's own TAP
output):**

```json
{
  "variants": {
    "default": {
      "jamObserved": false,
      "eventTypesSinceResume": [
        "resumed"
      ],
      "opcodeReadBackConfirmed": true,
      "pcReadBackConfirmed": true
    },
    "jamaction2": {
      "jamObserved": false,
      "eventTypesSinceResume": [
        "resumed",
        "registers",
        "stopped"
      ],
      "opcodeReadBackConfirmed": true,
      "pcReadBackConfirmed": true
    },
    "jamaction3": {
      "jamObserved": false,
      "eventTypesSinceResume": [
        "resumed"
      ],
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

**Per-variant table:**

| Variant | Jam event observed | Event types observed since resume | Opcode read-back confirmed | PC read-back confirmed | Relay repeat result |
|---|---|---|---|---|---|
| `default` (no `-jamaction` override, VICE's own factory default `1 = continue`) | No | `resumed` | Yes | Yes | Not run -- no direct-dial jam to compare against |
| `jamaction2` (`-jamaction 2`, Monitor) | No | `resumed`, `registers`, `stopped` | Yes | Yes | Not run -- no direct-dial jam to compare against |
| `jamaction3` (`-jamaction 3`, Reset) | No | `resumed` | Yes | Yes | Not run -- no direct-dial jam to compare against |

For every variant, the KIL opcode write and the PC write were independently
confirmed correct by an explicit read-back before ever resuming -- so the
absent jam event in every case is an emulator answer, not a harness bug.

**`jamaction2`'s own event sequence corroborates a previously recorded
finding rather than contradicting it.** `stock-live-triage.test.ts`'s own
header records that `-jamaction 2` (Monitor) "routes a JAM through the
STOPPED path instead of emitting the bare, zero-length-body JAM (0x61)
event" -- this run's own `registers`/`stopped` pair (an unsolicited register
dump followed by a stopped event, with no `jam` event at all) is consistent
with that citation, not a new contradiction of it. `jamaction3` (Reset) was
not previously probed by any file in this repository; this run measures, for
the first time, that a Reset-triggered JAM also produces no bare `JAM` (0x61)
event within the bounded window -- only a `resumed` event, consistent with
the CPU resuming and then being reset without ever surfacing a wire-level
JAM.

Because **no** variant produced a bare JAM over a direct dial, the relay
repeat was correctly skipped (per the case's own pre-committed branch) --
there is nothing for a relay comparison to test.

## Case B -- does a prior production-shaped monitor connection consume the one-time REGISTER_INFO greeting

**`GAP-PROBE OBSERVED` block, quoted verbatim (from the live run's own TAP
output):**

```json
{
  "connections": [
    {
      "index": 1,
      "shape": "probeReady() (real PING/EXIT, graceful close)",
      "registerDumpObserved": null,
      "ordinaryCommandSucceeded": null
    },
    {
      "index": 2,
      "shape": "direct dial, event listener wired first",
      "registerDumpObserved": false,
      "ordinaryCommandSucceeded": true
    },
    {
      "index": 3,
      "shape": "direct dial, after connection 2's graceful close",
      "registerDumpObserved": false,
      "ordinaryCommandSucceeded": true
    }
  ]
}
```

**Per-connection table:**

| Connection | Shape | Register dump observed | Ordinary command succeeded |
|---|---|---|---|
| 1 | `probeReady()` -- the production readiness probe's exact shape: a real `PING`, read the reply, `EXIT` to resume, graceful `socket.end()` close | n/a (this connection's own dump, if any, was never instrumented -- it is the CANDIDATE CONSUMER this case measures against) | n/a |
| 2 | Direct dial, `event` listener wired before the socket is handed to `ViceMonitorClient` | No | Yes (`RegistersGet` decoded a `"registers"` reply) |
| 3 | Direct dial, dialled again after connection 2 closed gracefully | No | Yes (`RegistersGet` decoded a `"registers"` reply) |

Connection 2 -- the first connection dialled AFTER the production-shaped
readiness probe closed -- observed **no** unsolicited `REGISTER_INFO` dump,
even though its `event` listener was wired before the socket was handed to
the client (so a dump arriving in the same segment as the connection's own
accept could not have been missed). Connection 3, dialled after connection
2's own graceful close, also observed none. Both connections' own ordinary
`REGISTERS_GET` command succeeded normally in both cases, proving the wire
pipe itself is intact in each case -- only the passive, unsolicited greeting
is specifically absent for every connection after the first.

## What this measures, and what it does not

The relay's own byte-transparency for a JAM frame -- IF one ever crosses it
-- is proven automatically and unconditionally by `broker-relay.test.ts`
(plan 63-09): a synthetic zero-length-body JAM survives `spliceRelay()`
byte-identically, survives a split across its own 12-byte header, and never
lets a JAM impersonate a legitimate reply under an interleaved write. That
proof does not depend on genuine stock VICE ever emitting a real JAM, and it
is unaffected by anything measured in this document.

This document's two cases answer a separate, emulator-side question that
`broker-relay.test.ts` cannot: whether genuine stock VICE, under any
probeable `JamAction`, ever emits a bare JAM (0x61) event at all on the wire
in the first place, and whether the unsolicited `REGISTER_INFO` greeting
genuinely arrives only once per emulator process rather than once per
connection. Both are properties of the emulator's own behaviour, observed
here through a direct dial that bypasses the broker and the relay entirely.

## The T-33-04 note

No `-jamaction` override was threaded through the broker's production launch
path. `broker-control.mts`'s `normaliseLaunchProfile()` carries an explicit
T-33-04 prohibition on any profile key whose VALUE reaches argv -- `profile`
maps to exactly two literal flag tokens (`-console`, `-warp`) and to nothing
else, and `-jamaction <n>` is precisely a key whose value would reach argv.
This plan's probe therefore spawned the emulator directly from the test file
(`withDirectEmulator()`), touching no shipped module and changing no launch
argv for any broker-managed instance. Because no variant produced a bare
JAM, this measurement carries no finding that would require a production
route for a `-jamaction` override -- but if a future measurement ever does
show a jamaction value that produces one, threading it into
`broker-launch.mts`'s `LaunchProfile` remains a separate, future design
decision, not something this round smuggled in.

## Disposition applied to the WINDOWS rows

Both dispositions below were pre-committed in `63-10-PLAN.md` before this run
was performed, and are applied exactly as measured:

- **id 70 (JAM):** No variant (`default`, `jamaction2`, `jamaction3`)
  produced a bare JAM over a direct dial. Per the pre-committed rule, the
  absence is an emulator-side behaviour and the relay is exonerated --
  **waived**, citing this evidence file and plan 63-09's automated relay
  proof (`broker-relay.test.ts`).
- **id 69 (REGISTER_INFO):** Connection 2 observed no dump after the
  production-shaped connection 1. Per the pre-committed rule, the stated
  hypothesis is confirmed -- **waived**, citing this file's three-connection
  result.

Neither row was closed on an assertion, an inference, or an absent run --
both citations quote the measurement recorded in this document.
