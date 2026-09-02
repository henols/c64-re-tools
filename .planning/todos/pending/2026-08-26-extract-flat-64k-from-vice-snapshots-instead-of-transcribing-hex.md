---
created: 2026-08-26T14:40:00.000Z
title: Extract flat 64K from VICE snapshots instead of transcribing hex
area: capture
severity: major
files:

  - src/skills/c64-ram-capture/SKILL.md

resolves_phase: 33
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

## What

Phase 23's 23-03 could not produce a verified flat 64K capture, and gave two
independent causes. **One of them is removable and the method is already proven.**

`vice_snapshot_save` writes a `.vsf` that already contains the exact 64K. There is no
need to read 64 KB out as hex through the tool surface and reassemble it — which is
where 23-03 lost a 32 KB write to truncation and an 8 KB write to ten silently dropped
characters.

## The method (validated 2026-08-26)

A VICE `.vsf` is a 19-byte magic `VICE Snapshot File\x1a`, 2 version bytes, a 16-byte
machine name, then modules. Each module is a 16-byte name, 1 major, 1 minor, and a
4-byte little-endian size covering the whole module including its 22-byte header.

The `C64MEM` module body is **4 bytes of port/PLA state followed by exactly 65536 bytes
of RAM**. Slice `[bodyStart + 4, bodyStart + 4 + 65536)`.

**`RAM[$00]` and `RAM[$01]` are the underlying RAM bytes, not the 6510 processor-port
registers.** A CPU-view read of `$0000`/`$0001` returns the port (e.g. `$EF`/`$35`);
the snapshot holds what is beneath it. These two addresses are the only place a
snapshot-derived image legitimately differs from a `vice_memory_read` transcript.

## Evidence it is correct

Extracted RAM from `danish_r2_handoff.vsf` and compared against the same instant's
independently hand-transcribed hex from 23-03:

| range | result |
|-------|--------|
| `$0000-$1FFF` | 2 differences, exactly `$0000` and `$0001` — the port overlay, explained |
| `$2000-$3FFF` | byte-identical (8192 bytes) |
| `$4000-$5FFF` | byte-identical (8192 bytes) |
| `$6000-$7FFF` | identical up to `$7871`, then shifted — independently localising 23-03's reported dropped characters |

The extraction also produces an exact 65536-byte image with a stable sha256 with no
transcription step at all, which is what `CAPTURE_SIZE` and `CAPTURE_SHA256` need.

## What this does NOT fix

The second cause is untouched: **the fork's stopping exec checkpoint is not frame-exact.**
Diffing the two danish handoff snapshots directly — no transcription anywhere — still
shows 201 multi-bit divergences, so that is real machine nondeterminism. A frame-exact
stop is still required before two runs can compare as equivalent. `saeger`'s two runs,
which both landed on the same `hit_count`, diverged at exactly one byte (`$00F6`, the
KERNAL keyboard-decode-table pointer), which is the evidence that frame index is the
dominant term.

## Why it matters

Phase 23 closed **no-go** on `C0_CORPUS: partial` under the pre-committed rule R1. Of the
two blockers behind that verdict, this one is solved and the remaining one is a single,
well-characterised problem. Whoever re-scopes v0.6.0 should not re-derive this.
