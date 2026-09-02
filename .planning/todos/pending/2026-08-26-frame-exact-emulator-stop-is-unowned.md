---
created: 2026-08-26T19:10:00.000Z
title: Frame-exact emulator stop is the single gate on a real corpus, and nothing owns it
area: capture
severity: major
files:

  - src/mcp/vice/vice-sync.ts

resolves_phase: 33
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

## What

`ROADMAP.md` calls a frame-exact emulator stop **"the single gate"** on rule R1's
"secure a corpus first" branch — the branch that would let v0.6.0 proceed as scoped. **No
phase and no other todo owns it.** Phase 23 identified it and closed; Phase 24 *consumes*
a corpus rather than producing one; Phase 26 records `AUTO-04`/`AUTO-05` as **unvalidated
rather than narrowed**. Raised as verification warning W4 on Phase 23.

The companion todo
(`2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`) solves
the *other* capture blocker and explicitly leaves this one untouched. Between them they are
the whole of what stands between this project and a real-release measurement.

## The problem, as measured

The fork's stopping exec checkpoint reports its hit but pauses roughly a frame later, at a
wall-clock-determined instruction. Two runs of the same release therefore stop in different
game frames, and the captures do not compare as equivalent:

| runs | where they stopped | result |
|------|--------------------|--------|
| `danish` r1 vs r2 | `hit_count` 1 and **2** — different frames | **201** multi-bit divergences (`evidence/capture/snapshot-divergence.txt`) |
| `saeger` r1 vs r2 | both `hit_count` 1 — same frame | **1** multi-bit difference: `$00F6`, the KERNAL keyboard-decode-table pointer |

That contrast is the useful part: frame index is the dominant term, and intra-frame position
costs only one-bit drift (41 of them, all passing). Land on the same frame and the two runs
are one transient KERNAL pointer away from equivalent.

Measured snapshot-to-snapshot with no transcription anywhere, so this is real machine
nondeterminism and not a readout artifact.

## What is already known about the mechanism

- `vice_run_until` inherits the same imprecision — it is the same underlying stop.
- `vice_execution_step` advances nothing observable, so single-stepping to a frame boundary
  is not currently a route.
- `vice-sync.ts`'s documented invariants must survive any fix: exactly one resume per wait,
  and poll on `hit_count`, never on paused state. Those are load-bearing (see CLAUDE.md —
  a non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop).
- `CLAUDE.md` also records that there is no monotonic cycle register, and that `LIN`/`CYC`
  are readable but not monotonic — so "stop at raster line N of frame M" needs a constructed
  frame counter, not a register read.

## Why it is worth owning

Without it, every criterion that reads a depacked capture stays `could-not-run`, which is
what produced Phase 23's `no-go`. With it — plus the snapshot extraction already validated —
criteria 1, 2 and 3 become real measurements on real cracked code, which is the whole
premise v0.6.0 was scoped on.

Any fix touches `src/`, which Phase 23 was forbidden from doing. That is why this is a todo
and not a Phase 23 deliverable.
