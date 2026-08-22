---
title: c64-ram-capture's keyboard-typed LOAD"*",8,1 fallback route did not progress within a bounded 20-second poll on stock
date: 2026-08-19
priority: medium
source: 08.2-WALKTHROUGH-EVIDENCE.md FINDING-E2 — Phase 8.2 plan 04 walkthrough re-run, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
---

# Keyboard-typed LOAD fallback stalled in plan 04's re-run

Phase 8.2 plan 04's DIST-03 walkthrough re-run tried `vice_keyboard_type
"LOAD\"*\",8,1\n"` followed by `vice_execution_run` and a bounded 20-second poll as a
fallback route, with the checkpoint armed ahead of time. It did not progress the
machine past the BASIC/KERNAL READY vicinity within that budget.

A plausible cause consistent with FINDING-D2 (every inbound binary-monitor byte
re-halts the CPU, `08.2-BROKER-LIVE-EVIDENCE.md` §6): the keyboard-typed `LOAD` command
needs many real seconds of uninterrupted CPU time to complete the IEC-emulated disk
load before `RUN` can find a loaded program to run, and the specific resume/sleep
intervals this run used may not have given the load enough real wall-clock time before
the machine was next queried. This was not investigated further within plan 04's own
time budget.

**This does not block DIST-03's closure** — the pass verdict rests entirely on the
`vice_autostart` route's own independent, complete success (65536-byte capture,
sha256-verified). This finding is about the keyboard-typed fallback path specifically,
which no test in this phase depends on.

## Why deferred rather than fixed here

Plan 04 explicitly carried this forward as "an open question for whichever plan next
touches the keyboard-fallback path, not fixed or forced" and owned no source file in
that plan. Out of Phase 8.2 plan 05's scope fence (E-5 asks only for a tracked home,
never the fix).

## What would close it

Re-run the keyboard-typed `LOAD"*",8,1` fallback with longer or adaptively-lengthened
resume/sleep/read poll intervals (consistent with the resume-then-sleep(500ms) discipline
`08.2-BROKER-LIVE-EVIDENCE.md` FINDING-D2 already established as mandatory for this
monitor), and confirm whether the fallback route completes given enough real wall-clock
time between polls, or whether a different root cause is at play.

## Resolution

**Promoted with a named owner (Phase 15, plan 15-12) rather than closed `wont-fix` or
closed on new evidence — neither of the two closing conditions was met.**

Checked Phase 15 plan 15-08's live UAT work (`15-UAT-EVIDENCE.md`) for evidence bearing on
this specific stall, per this plan's own instruction:

- **Scenario 1** exercised `vice_autostart`/`vice_disk_attach` (a `.d64`-image PRG load
  via the disk-attach/autostart tool route) and `vice_snapshot_save`/`vice_snapshot_load` —
  not the keyboard-*typed* `LOAD"*",8,1` fallback this todo is about. Different tool, same
  general "get a program loaded" goal, but it does not exercise the keyboard-buffer-typed
  route at all.
- **Scenario 2** exercised `vice_keyboard_petscii` — a single-byte KERNAL-keyboard-buffer
  injection into an *already-running* reacting program, deterministically passing. This
  proves keyboard injection itself works, but it never issues a `LOAD` command and so never
  exercises the IEC-emulated disk-load timing FINDING-E2's plausible cause names (many real
  seconds of uninterrupted CPU time for the load to complete before `RUN` has anything to
  run) — it is not the same probe under a different name.

**Neither condition applies:** 15-08 did not reproduce this todo's specific stall (it never
attempted a keyboard-typed `LOAD`), and it did not demonstrate the keyboard-typed `LOAD`
route working either (it used a different tool for a different purpose). Closing on
inference from either result would be exactly the "invent a predicate the evidence does not
support" this phase's own must-haves forbid.

**Owner:** whichever future plan or milestone next touches `c64-ram-capture`'s
keyboard-typed-fallback load path, or does deeper stock-VICE binary-monitor CPU-timing
work generally (the resume/sleep discipline `08.2-BROKER-LIVE-EVIDENCE.md` FINDING-D2
already established). No phase in v0.4.0 (Phases 12-17) touches this file or this fallback
route. This does not block `DIST-03`'s closure (the `vice_autostart` route already carries
that pass, independently) and is not one of `DEBT-02`'s five named behaviours, so it carries
no requirement ID of its own — recorded here as a named-owner promotion per `DEBT-01`'s
three-outcome criterion (fix / wont-fix / promote-with-owner), the third of the three.
