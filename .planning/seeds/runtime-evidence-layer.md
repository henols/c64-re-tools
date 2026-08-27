---
title: "Runtime evidence layer — observed execution as its own accumulating store, joined against byte-derived blocks"
trigger_condition: "v0.8.0 milestone shaping, after Phase 32's deletion lands and the store is the sole substrate. Hard prerequisite: a text-monitor client exists (see [[text-monitor-channel-live-probe]]), since memmapshow / prof / chis are text-channel only on stock."
planted_date: 2026-08-28
---

# Runtime evidence layer

Make what the emulator *observed* a first-class, durable, accumulating kind of
fact — distinct from what the bytes *imply*.

## The three sources, all confirmed live on stock VICE 3.9

Over the `-remotemonitor` channel this project already opens and never dials:

- **`memmapshow` / `memmapzap`** — per-address access map with mask bits
  `ioRWXrwx`, i.e. **execute is a separate bit** for ROM and RAM. This is a
  direct code-vs-data oracle from real execution. `memmapzap` resets it, so a
  run can be bracketed.
- **`prof on/off` / `prof flat N`** — self and total cycles per function address,
  ranked. Answers *what code actually matters* before any static analysis is
  spent.
- **`chis N`** — CPU history with per-entry cycle counts. Available on 3.9,
  where the binary `CPUHISTORY_GET` (0x86) does not exist.

`bt` (reconstructed JSR chain) is a fourth, useful at a checkpoint hit rather
than as a bulk source.

## The design constraint that shapes everything

**`memmapshow`'s execute bit is sound-positive and incomplete.** An address
observed executing *is* code — that is proof. An address never touched proves
nothing: it may be level-3 code the run never reached. A single run can therefore
license `code` and can **never** license `data`.

`block-class.ts:95-101` deliberately keeps `BlockClass` three-valued
(`code | data | undefined`) and its header states that consumers *"compare this
against a classification derived from completely different inputs, so a richer
vocabulary would manufacture disagreement out of vocabulary drift rather than
measure anything."* Runtime evidence is a **third** independent classifier
alongside the store's blocks and the byte-derived coverage census. That
independence is the asset.

## The chosen shape (decided 2026-08-28)

A **separate, monotonically accumulating evidence layer**, not a mutation of the
block table.

- Observations are their own rows, **keyed by run identity** — which image, which
  scenario, which bracket. `$9C00 never executed` is only meaningful with the
  denominator attached.
- Union across runs is monotone. Twelve scenarios that never reach `$9C00` is a
  statable, strengthening fact; it is still not `data`.
- The block table stays byte-derived. A **query joins the two and reports
  agreement and disagreement** — never a silent overwrite. Disagreement is the
  highest-value output of the whole design: bytes say data, execution says code.
- Rejected: promoting observed-EXEC into the block table under a confidence
  bracket. Fewer moving parts, but it collapses two independent classifiers into
  one, destroys the disagreement signal, and a wrong promotion is unrecoverable.
- Rejected: live read-only tools with nothing persisted. Ships fastest, but each
  run's evidence dies with the session — the exact gap `CORE-01` already flagged
  and left as a dated open question.

## Why this is the spine and not a feature

It closes the loop the disassembler workflow (`docs/dissambler-workflow.md`)
draws but cannot currently feed: dxa's discovery pass and Ghidra's semantic pass
both guess at code-vs-data boundaries in `$8000-$BFFF`, and profiling tells you
which of those regions is worth a human's attention at all. Today the store's
classification is derived from bytes alone. This makes it derivable from observed
execution as well, with the two kept apart and compared.

## What it needs first

1. A text-monitor client with the `channel: "binary" | "text"` discriminator on
   `monitorClient` that `broker-state.mts:129-137` already anticipates. The text
   monitor **halts on command** like the binary one, so it inherits `vice-sync.ts`'s
   serialization invariants — see [[text-monitor-channel-live-probe]].
2. Reproducible runs. Evidence keyed by run identity is only worth accumulating
   if the run can be repeated; VICE event history record/replay is the obvious
   candidate, and it also bears on the unowned frame-exact-stop problem holding
   Phases 24 and 26.
3. A parser boundary. `memmapshow`, `prof flat` and `chis` return human-formatted
   text. Parsing them is real surface area with real drift risk across VICE
   versions, and it needs the same single-seam discipline the rest of the tree
   uses — one module owns each format, fixtures pinned, nothing else reads the raw text.

## Unverified

That a text client and a binary client can be connected simultaneously without
one's halt/resume corrupting the other's view. Bind-time coexistence is
confirmed; interleaved command behaviour is not. Establish before designing a
dual-channel controller.
