---
status: partial
phase: 03-direct-tools
source: [03-VERIFICATION.md]
started: 2026-08-16T22:40:00Z
updated: 2026-08-22
resolved_by: Phase 15 plans 15-08 (scenarios 1 and 2) and 15-10 (scenario 3)
driven_by: agent -- an opt-in live node --test suite (stock-broker-live.test.ts and, for scenario 3, stock-a4-checkpoint-flood.test.ts) against a real broker-launched genuine-stock instance, plus one uncommitted ad-hoc probe script (scenario 2's joystick measurement only); not a human at a keyboard
tested_artifact_sha: d526f52068099de7fa9f950eaa8cf4cdb5d09bb9
tested_artifact_route: local-checkout-HEAD
vice_version: "x64sc (VICE 3.9)"
evidence: [15-UAT-EVIDENCE.md, 15-A4-PROBE-EVIDENCE.md]
---

## Current Test

[awaiting human testing]

## Tests

These are the `human_verification` items carried out of `03-VERIFICATION.md`. Phase 03
passed verification without them — each is covered by unit tests and, where noted, by
live probes — but none has been exercised end-to-end against a real emulator with real
fixtures. They are recorded here so they surface in `/gsd-progress` and `/gsd-audit-uat`
instead of being lost when the phase closed.

### 1. vice_autostart / vice_disk_attach / vice_snapshot_load against real fixtures
expected: Each round-trips correctly against a real `.prg` / `.d64` / `.vsf` file on genuine stock VICE, matching the unit-test-covered logic.
why_human: UAT test 8 exercised reset and snapshot *save* live, but no fixtures were prepared for autostart, attach, or snapshot *load*. Unit tests cover the logic, not a live round trip.
result: pass — all three tools exercised live against a real broker-launched `/usr/bin/x64sc` (VICE 3.9) through a real `.d64`. `vice_autostart`/`vice_disk_attach`: the verified payload region (`$0803`-`$0812`) landed byte-identical to `[234,234,234,234,234,234,234,234,234,234,234,234,234,234,234,96]` after the load; `vice_disk_attach`'s own `runState: "running"` independently corroborates Phase 13's A5 finding that it resets and loads despite its advertised attach-only approximation. `vice_snapshot_load` (the new leg): a save→perturb→load round trip decided by two byte comparisons — `$C000` returned to its exact pre-perturbation bytes `[255,255,0,0]` (not the perturbed `[222,173,190,239]`), and the payload region still matched afterwards, proving the load restored this machine's state, not merely that some load succeeded. Full transcript, raw payloads and cleanup confirmation: `15-UAT-EVIDENCE.md` § Scenario 1.

### 2. vice_keyboard_petscii and vice_joystick_set against a running program
expected: Raw PETSCII bytes and joystick bit patterns are observed to actually affect a running program.
why_human: UAT test 9 exercised `vice_keyboard_type` live, but there was no running program to observe petscii/joystick effects against.
result: partial — a hand-assembled reacting program (BASIC-stub launch, hardware addresses as literals) was proven genuinely running via a register read landing its PC at `$081E`, inside the program's own loop range `[$080E, $0826]`. Keyboard half: pass — before injection `$0400` read `32` (PETSCII space); after `vice_keyboard_petscii([0x41])`, `$0400` read `65`, the exact injected byte. Joystick half: zero delta — all five single-bit `vice_joystick_set` rounds (up, down, left, right, fire) left both `$DC00` (`127`) and `$DC01` (`255`) unchanged, reproducing Phase 13 A3's exact null result but this time against a program independently proven running, which eliminates A3's "running-program precondition" candidate explanation (the other two candidates — no CIA1 effect on this build, or `port=1` mapping to neither `$DC00` nor `$DC01` — remain open). No bit-to-port mapping was observed, so no `[ASSUMED]` label was touched. Full transcript, ACME source and assembler banner: `15-UAT-EVIDENCE.md` § Scenario 2.

### 3. Hot non-stopping checkpoint auto-disables under sustained hit pressure
expected: The D-11 rate-limit / auto-disable guard actually fires at ~20 hits/second instead of stalling the emulator thread.
why_human: Requires sustained 20+/sec hits against a real running program. Out of scope for the UAT session's probes (test 6). Note this is the failure mode CLAUDE.md calls out — a non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop, so on a hot address it can stall the emulator thread.
result: pass — a real `stop:false` checkpoint was armed on the KERNAL's default hardware-IRQ entry point (`$EA31`, read from `c64-memory-mapping/memmap.json` rather than typed from memory) against genuine stock `/usr/bin/x64sc` (VICE 3.9), launched through the real broker artifact (`stock-a4-checkpoint-flood.test.ts`). The freshly booted, unmodified machine's own CIA1 timer IRQ exceeded the D-11 guard's 20-hits-per-second limit with no fixture: the checkpoint's wire hit count climbed `0 -> 7 -> 21` in roughly 2.4 seconds real time, and the guard's `setImmediate()`-deferred auto-disable fired verbatim as `{"checkpointNum":1,"reason":"auto-disabled: exceeded 20 hits/second on a stop:false trace checkpoint (observed ~21/s) -- a non-stopping checkpoint emits CHECKPOINT_INFO synchronously from inside the emulator's CPU loop and can deadlock this client on a hot address","hitsPerSecond":21}`. The checkpoint's own wire-side `enabled` flag was independently re-read afterward (a fresh `vice_checkpoint_list`, not the local report) and confirmed `false` — the toggle reached the wire, not just client-side bookkeeping. Five bounded post-flood PC-register samples (`[58836,58836,58831,58833,58836]`) showed the machine still executing, not stalled or deadlocked. No escalation to a tight loop was needed; the gentle KERNAL-IRQ tier alone exceeded the limit. Full transcript and the explicit scope of what a single-host/single-rate observation does and does not establish: `15-A4-PROBE-EVIDENCE.md`. This scenario and the A4 item of `.planning/todos/completed/2026-08-14-probe-phase3-assumed-wire-details.md` were the same experiment — closing one closed both, which is why the phase could afford to run it once.

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- Scenario 2's joystick half remains an open question (`issues`, not `pending`): Phase 15 plan
  15-08's live run reproduces Phase 13 A3's zero-delta result even against a genuinely running
  program, eliminating one of A3's three candidate explanations but not resolving which of the
  remaining two (no CIA1 effect on this build, or a different physical port than `$DC00`/`$DC01`)
  is true. See `15-UAT-EVIDENCE.md` § Scenario 2.
- Scenario 3's `pass` verdict is scoped to the single host, build, and rate this session actually
  measured (genuine `/usr/bin/x64sc` VICE 3.9, ~21 observed hits/second from a real KERNAL IRQ) —
  it does not establish freedom from a race at substantially higher rates, on a different build,
  or under concurrent host load. See `15-A4-PROBE-EVIDENCE.md` § What this does NOT establish.
  The escalation tier (a tight-loop fixture) needed for stronger-rate coverage exists in
  `stock-a4-checkpoint-flood.test.ts` but was not exercised, since the gentle tier already
  answered the question this scenario asks.
