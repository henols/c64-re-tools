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

---

## RESOLVED 2026-09-03 — owned by `REPRO-02` / `REPRO-03`, and closed on a PARTIAL result

**What discharged it.** Phase 33 plan `33-09` shipped
`src/mcp/vice/stock-reproducible-run.ts` — `runReproducible()`, **one named single-seam
procedure** with the monitor-issued hard `RESET` **inside** it, reached through the optional
`reproducible` argument on `vice_run_until` from exactly one call site. There is no `skip_reset`,
no `no_anchor` and no `reset_only`; `RUN_UNTIL_KEYS` is pinned to exactly five names by one
`assert.deepEqual` so a future sub-flag reds a test rather than earning a review comment. So the
"nothing owns it" condition this todo was filed on is discharged: the stop is a named procedure
with an owner, and every degradation path is an explicit refusal carrying its reason.

`vice-sync.ts`'s two documented invariants — exactly one resume per wait, and poll on
`hit_count` never on paused state — survive the change, as this todo required.

**The outcome lines that close it, including the unflattering one.**

- `JITTER_IMMUNITY: immune` at column 0 of
  `.planning/phases/33-…/evidence/33-repro02-reset-removed.md`. One distinct 64K sha256 and
  `TRIPLE_PAIRWISE_DIFF_TOTAL 0` across pre-protocol jitter 0 / 1500 / 4000 ms, with all four
  terms of `(PC, hit_count, LIN, CYC)` identical. `RESET_REMOVED_CONTROL: red` in the same file
  proves the reset step load-bearing: remove it and the arm yields three distinct sha256 values
  with `line`/`cycle` differing on every pair.
- `ORACLE_NECESSITY: unproven` at column 0 of `.planning/phases/33-…/evidence/33-repro03-frame-anchor.md`.
  The frame term's *necessity* was **not** observed in the form `SCHEMA.md` § 2.3 declares: on
  the `$ea31` anchor a pair exactly one frame apart is unbuildable (60 Hz KERNAL IRQ against a
  50.125 Hz PAL frame; 240 anchor hits, 240 distinct `(LIN, CYC)`, 0 consecutive repeats). This
  fired `R6 → degrade` on `GATE-01`.
- **`AUTOSTART_FRAME_EXACT: not-achieved`** at column 0 of
  `.planning/phases/33-…/evidence/33-autostart-sequencing.md`, and **`CAPTURE_FRAME_EXACT: no`**
  at column 0 of `.planning/phases/33-…/evidence/33-capture-pair.md`. **This todo closes on that
  partial result, stated, and not on the part that worked.**

**What remains open, because a narrowing is not a closure.** The reset protocol is jitter-immune
**at a monitor-halted stop**, and frame-exactness degrades **exactly when the reset inherits an
arbitrary raster phase** — which an autostarted capture cannot avoid. The measured mechanism: a
hard reset does not reset the VIC-II raster counter, so the first post-reset IRQ is
`raster_at_reset + constant`; a monitor halt leaves `LIN` reading `0` on this build, which is why
the specified protocol reproduces and a variant with any step before the reset does not.
`AUTOSTART`'s power cycle resets the CPU, VIC-II and CIAs but **not the absolute emulated clock**,
and the 1541's rotational phase rides that clock, so the pre-protocol interval leaks into the
disk load's byte timing. Frame-exactness holds through anchor hit 50 and is lost from hit 75 —
where the load begins.

So: a frame-exact stop is **owned, procedural and reproducible at a corpus-free monitor-halted
stop**, and it is **still not achieved at a post-load stop on an autostarted release**. The
downstream consequence is recorded as `GATE-01`'s `degrade` verdict with `R6`'s pre-mapped
narrowing — the stop-identity oracle narrows to two-term `(PC, hit_count)` with the frame term
recorded but not asserted — in `docs/phase33-reproducible-run-gate-findings.md`, and it is bound
into Phases 34-38's ROADMAP Notes. **A phase that needs a frame-exact post-load stop on an
autostarted release still has unowned work**, and the mechanism above is what it has to defeat.

**Method rule this produced, worth more than the result.** Never add a step before the protocol's
reset. This probe's first version added a checkpoint halt there and turned an `immune`
measurement into a `not-immune` one — a **false `no-go`**, caught by a method control and four
voided runs rather than shipped.
