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

## Resolution

Closed 2026-08-22, Phase 15 plan 15-06.

Confirmed at source: `.claude/mcp/vice/broker-launch.mts`'s `buildViceArgs()` (stock
branch, `broker-launch.mts:202`) builds
`["-default", "-drive8type", "1541", "-binarymonitor", ...]` unconditionally for every
stock launch — the flag is not gated on whether a disk is subsequently attached, nor on
disk-vs-bare-`.prg`. (The one pre-existing escape hatch, `VICE_ARGS`/`viceArgsEnv`
overriding the entire argv at `broker-launch.mts:163-166`, is an operator override of
the whole launch line, not a condition on drive setup, and does not narrow this claim.)

Added a one-sentence closing note to `.claude/skills/c64-ram-capture/SKILL.md`'s
`## Boot a disk` procedure, between the program-counter-moved step and the
keyboard-typed fallback paragraph: "The broker sets the drive type at launch for every
stock instance, so no drive setup is needed before attaching." No `README.md` changelog
entry added — the note lives where a user following the disk-boot procedure will read
it, per this todo's own "What would close it" and DEBT-02's point-of-use criterion.
