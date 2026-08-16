---
status: partial
phase: 03-direct-tools
source: [03-VERIFICATION.md]
started: 2026-08-16T22:40:00Z
updated: 2026-08-16T22:40:00Z
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
result: [pending]

### 2. vice_keyboard_petscii and vice_joystick_set against a running program
expected: Raw PETSCII bytes and joystick bit patterns are observed to actually affect a running program.
why_human: UAT test 9 exercised `vice_keyboard_type` live, but there was no running program to observe petscii/joystick effects against.
result: [pending]

### 3. Hot non-stopping checkpoint auto-disables under sustained hit pressure
expected: The D-11 rate-limit / auto-disable guard actually fires at ~20 hits/second instead of stalling the emulator thread.
why_human: Requires sustained 20+/sec hits against a real running program. Out of scope for the UAT session's probes (test 6). Note this is the failure mode CLAUDE.md calls out — a non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop, so on a hot address it can stall the emulator thread.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
