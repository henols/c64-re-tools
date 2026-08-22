---
title: vice_disk_attach's advertised D-14 approximation is wrong, not merely unconfirmed
date: 2026-08-22
priority: high
source: /gsd-execute-phase 13 plan 13-05 — advertised-tool-contract finding handed over by plan 13-04's A5 escape hatch (D-13-04)
---

# `vice_disk_attach`'s no-side-effect promise is contradicted by live evidence

`stock-machine.ts`'s `handleDiskAttach` (the `vice_disk_attach` tool)
implements disk attach as `AUTOSTART` (0xdd) with `runAfter: false,
fileIndex: 0`, and reports back to the caller:

```ts
// stock-machine.ts:185
approximation: "AUTOSTART with the run flag clear (D-14)",
```

`docs/stock-vice-parity.md`'s D-14 entry documents the intended contract:
"a documented approximation, not an exact port" of an *attach*, distinct
from `vice_autostart` (documented as loading/running a program).

**Phase 13 plan 13-03's live probe (A5) shows this contract is false, not
merely unverified.** Against real fork VICE 3.10, sending `AUTOSTART` with
`runAfter=false` at two different `fileIndex` values both:

1. Performed a **full machine reset** — the emulator's own log recorded
   `Main CPU: RESET.` / `Unit 8: RESET.` for each call.
2. **Loaded a program from the attached image** — the emulator's own log
   recorded `AUTOSTART: Loading program '*'`; a sentinel byte pattern
   written to the BASIC program area was destroyed after the call, and a
   follow-up read showed the KERNAL BASIC loader had relinked the program
   chain — a real load, not a coincidental log line.
3. Happened **regardless of `fileIndex`** — both `fileIndex=0` and
   `fileIndex=1` produced the reset+load behaviour (the second call's
   effects were not separately logged at the level captured, an open
   detail this probe did not resolve either way).

Full evidence:
`.planning/phases/13-external-verification/13-PROBE-RESULTS.md` § A5.

**The gap this creates for a caller:** an agent calling `vice_disk_attach`
expecting only "the image is now visible to the drive" is not told the
call also resets the machine and loads whatever program the image's
directory wildcard resolves to — the same class of side effect
`vice_autostart` produces, minus (as far as observed) a final RUN step.
This is a real caller-facing correctness gap, not a documentation nicety:
a recon session that calls `vice_disk_attach` to inspect a disk's contents
without disturbing machine state will have its state disturbed anyway.

## Why this was not fixed here

Plan 13-04's D-13-04 escape hatch applies: a probe showing an *advertised
tool contract* is wrong is recorded as a finding and filed as a todo
rather than redesigned inside a verification phase. Deciding whether to
correct the documentation string, restructure the tool's contract, or
reconsider the tool's existence is a product decision with real
trade-offs (see "What a fix would touch" below), not a same-phase
correction.

## What a fix would touch

- `docs/stock-vice-parity.md`'s D-14 entry (currently at the "Disk attach
  is `AUTOSTART` with the run flag clear" bullet under §A item 7) — the
  intent description ("attach a disk image without loading or running
  anything") needs correcting to state the real reset+load side effect.
- `stock-machine.ts`'s `handleDiskAttach` — the `approximation` string
  returned to callers should either name the real side effect explicitly,
  or the tool's contract should be restructured so a caller is not misled
  (e.g. documenting the reset+load as expected behaviour, or reconsidering
  whether `vice_disk_attach` should exist in its current form given how
  little it actually differs from `vice_autostart`).
- `docs/tool-support.md` if the tool's generated support-table description
  references the approximation string.
- Any skill playbook (`c64-program-recon`, `c64-ram-capture`) whose
  documented methodology assumes `vice_disk_attach` is side-effect-free
  when inspecting a disk.

## How to verify

1. `docs/stock-vice-parity.md`'s D-14 entry states the true reset+load
   side effect rather than "without loading or running anything."
2. `stock-machine.ts`'s `handleDiskAttach` approximation string (or the
   tool's broader contract) reflects the corrected behaviour.
3. A regression test exercises the corrected description/contract against
   the real fork build, or documents why a live re-probe is out of scope
   for the fix.

## Related

- `.planning/phases/13-external-verification/13-PROBE-RESULTS.md` § A5 —
  the live evidence.
- `.planning/phases/13-external-verification/13-04-SUMMARY.md` — "Escape
  Hatch Finding (for plan 13-05)" — the original hand-off of this finding.
- `docs/stock-vice-parity.md` §A item 7 — the licensed-divergence register
  D-14 lives in; item 7 now carries a caveat (plan 13-05) that a wrong
  probed implementation detail is a silently wrong answer, not a licensed
  divergence — this todo is exactly that case.
- `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`
  — A5's own row names this finding and points here rather than
  restating it.
