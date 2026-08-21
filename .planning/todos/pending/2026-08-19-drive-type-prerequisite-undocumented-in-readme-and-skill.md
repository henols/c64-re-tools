---
title: README.md and c64-ram-capture/SKILL.md name no drive-type prerequisite (now moot for the default launch path, worth a closing note)
date: 2026-08-19
priority: low
source: 08.1-WALKTHROUGH-EVIDENCE.md FINDING-C4 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
resolves_phase: 15
---

# Neither doc names a drive-type prerequisite

Phase 8.1's walkthrough found that neither `README.md`'s backend section nor
`c64-ram-capture/SKILL.md`'s documented "Boot a disk" procedure named any
drive-type/true-drive-emulation prerequisite — both assumed attach-then-autostart was
sufficient, which the walkthrough disproved for a freshly launched, unconfigured stock
instance (`Drive8Type=0` default, FINDING-C1).

**Update: Phase 8.2's fix likely makes this moot rather than merely narrower.**
`broker-launch.mts`'s stock argv now unconditionally includes `-drive8type 1541`
(`const args = ["-default", "-drive8type", "1541", "-binarymonitor", ...]`) for every
stock launch — not conditioned on whether a disk or a bare `.prg` is subsequently
loaded. Plan 03's live measurement (`08.2-BROKER-LIVE-EVIDENCE.md`) established the
pre-fix blast radius was **all program loads**, not merely disk loads (a bare `.prg`
autostart hit the identical `Drive8Type=0` wall a `.d64` load did) — so there is no
narrower undocumented raw-`.prg` workaround left to name; the fix at launch time covers
both routes identically. A user driving the documented `vice_disk_attach` →
`vice_autostart` procedure through this project's broker never has to know the drive
type existed as a concept, because the broker configures it before any client call.

## Why deferred rather than fixed here

Documentation-only closing note, out of Phase 8.2's scope fence, and E-5's own
instruction forbids editing `README.md` or any `SKILL.md` in this plan.

## What would close it

Confirm the fix is unconditional (as read above) and, if so, close this item with no
doc edit needed beyond an optional historical note in `README.md`'s changelog-style
section that the drive-type gap existed and was fixed at launch time in v0.2.0. If a
future backend or launch path is added that does NOT set `-drive8type` unconditionally,
re-open this and add the explicit manual-workaround prose the original finding called
for.
