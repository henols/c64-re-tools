---
title: Probe Phase 3's four ASSUMED wire details against a real stock VICE build
date: 2026-08-14
priority: high
source: /gsd-plan-phase 3 — no live stock VICE reachable in-environment
updated: 2026-08-22
note: >
  A1/A2/A3/A5 answered by phase 13 (plans 13-03/13-04/13-05, against fork
  VICE 3.10). A4 is this todo's only remaining item and stays open,
  deliberately excluded from phase 13's scope (D-13-05) rather than
  overlooked — this todo does NOT resolve in phase 13.
---

# Four behavioural/spelling details were written spec-driven, never exercised against a real binary

**Status (2026-08-22, plan 13-05): A1, A2, A3 and A5 are now answered by
phase 13's live probes (plans 13-03/13-04). A4 is this todo's only
remaining item, and stays open — deliberately excluded from phase 13's
scope (D-13-05), not overlooked.** Probing A4 means arming a
non-stopping (`stop:false`) checkpoint on a hot, frequently-executed
address; per `docs/phase0-binmon-findings.md` §4 and CLAUDE.md's own
Protocol constraint, a non-stopping checkpoint's `CHECKPOINT_INFO` hit
frame is emitted **synchronously, over the blocking socket, from inside
the emulator's CPU loop** (`mon_breakpoint.c:557-562`) — on a hot address
this can stall the emulator thread. No probe run by phase 13 armed any
checkpoint of any kind.

Phase 3's request-body encoders, handlers and broker launch flag were all
written grounded in `docs/phase0-binmon-findings.md` §5, the official VICE
manual §13 (Binary monitor), and this repo's own offline-tested
`probe-binmon.mjs` request-body builders. Genuinely stock VICE (`x64sc`,
apt-installed) was present but unused in the research session — the task
scope deliberately did not require live emulator access, so every
wire-level claim had to be grounded in normative docs instead. Four
behavioural or spelling details were never exercised against a running
binary and were carried as `[ASSUMED]` in
`.planning/phases/03-direct-tools/03-RESEARCH.md`'s Assumptions Log (A1,
A2, A3, A5), and one design choice (A4) whose correctness can only be
observed against real emulator timing.

## The four wire assumptions, now answered — and the one design choice that stays open

- **A1 — `-remotemonitoraddress` flag spelling: CONFIRMED.** Phase 13 plan
  13-03 launched fork VICE 3.10 with `-remotemonitor
  -remotemonitoraddress ip4://<host>:<port>` and confirmed, via both an
  accepted TCP connect and an independent `ss -ltnp` listener check, that
  a real text-monitor listener binds. Full evidence:
  `.planning/phases/13-external-verification/13-PROBE-RESULTS.md` §A1. The
  `[ASSUMED]` label was removed from `broker-launch.mts`'s
  `buildViceArgs()` JSDoc by plan 13-04, citing this verdict; stock 3.9
  was not independently probed (the flag pair is symmetrical and not
  version-sensitive, so this is recorded as a low-risk carry-forward, not
  full coverage).

- **A2 — `ADVANCE_INSTRUCTIONS` step-over semantics: CONFIRMED.** Plan
  13-03 stepped over a live `JSR` on fork 3.10 and observed the reported
  PC land at `JSR`+3 (the instruction after the call), reproduced
  identically across two independent live sessions. Full evidence:
  `13-PROBE-RESULTS.md` §A2. The `[ASSUMED]` label was removed from
  `stock-execution.ts` and `stock-protocol.ts`'s `advanceInstructionsBody()`
  JSDoc by plan 13-04.

- **A3 — `JOYPORT_SET` bit mapping: INCONCLUSIVE, label stays on.** Plan
  13-03 drove each of the five single-bit `JOYPORT_SET` values
  individually against fork 3.10 and read both CIA1 port bytes (`$DC00`,
  `$DC01`) back before and after each — zero delta was observed at any
  bit, in two independent live sessions. This neither confirms nor
  refutes the assumed bit positions, polarity, or port mapping; it is an
  absence of signal, not evidence the mapping is wrong. Full evidence and
  the three candidate explanations recorded (no CIA1 effect on this build,
  a different port value, or a running-program precondition):
  `13-PROBE-RESULTS.md` §A3. The `[ASSUMED]` label stays on
  `stock-input.ts`'s `JOYPORT_BITS` constant and `stock-protocol.ts`, per
  `assumption-label-discipline.test.ts`'s permanent guard. **A follow-up
  probe (varying the wire `port` value, or checking whether a running
  program is a precondition for the CIA read to reflect joystick state) is
  a candidate for a fresh todo — this todo does not track that
  follow-up.**

- **A5 — `AUTOSTART` `fileIndex` with the run flag clear: CONTRADICTED,
  label stays on.** Plan 13-03 found that `AUTOSTART` with
  `runAfter=false` performs a full machine reset and loads a program from
  the attached image regardless of `fileIndex`, corroborated by the
  emulator's own reset/load log lines and a byte-level sentinel-destruction
  check across two live sessions. Full evidence: `13-PROBE-RESULTS.md`
  §A5. This directly refutes the approximation `stock-machine.ts`'s
  `handleDiskAttach` (`vice_disk_attach`) advertises. The `[ASSUMED]`
  label stays on `stock-protocol.ts`'s `autostartBody()` JSDoc — plan
  13-04 found no separate, offline-testable behavioural claim behind A5
  beyond the tool-contract finding, which is filed as its own todo (see
  Related, below) rather than resolved by a source correction here.

- **A4 (design choice, not a wire assumption) — the `stop:false` rate
  limiter's auto-disable deferral timing. Deliberately excluded, remains
  open.** See the Status note at the top of this file for why.
  `stock-checkpoints.ts`'s D-11 rate limiter defers its auto-disable
  `CHECKPOINT_TOGGLE` send via `setImmediate()`; whether this deferral is
  race-free under a real, synchronous `CHECKPOINT_INFO` flood from inside
  VICE's CPU loop is only observable against a real emulator, and phase 13
  did not attempt it. **File/function to note:**
  `.claude/mcp/vice/stock-checkpoints.ts`, the rate-limiter's auto-disable
  scheduling.

## Acceptance check for closing this todo

Only A4 remains open. Closing this todo requires:

1. Arm a `stop:false` checkpoint on a hot, frequently-executed address
   against a real stock (or fork) VICE build and confirm the rate
   limiter's auto-disable actually fires, the checkpoint is toggled off,
   and neither the client nor the emulator deadlocks or stalls during the
   flood.
2. If the probe confirms the deferral is race-free, remove the
   `[ASSUMED]`-equivalent note from `stock-checkpoints.ts`'s rate-limiter
   JSDoc, citing the probe's own evidence document.
3. If the probe finds a genuine race or stall, correct the deferral
   mechanism and add a regression test capturing the corrected behaviour
   before any label or note is softened.

## Related

- `.planning/phases/13-external-verification/13-PROBE-RESULTS.md` — the
  live evidence document answering A1/A2/A3/A5, produced by phase 13 plan
  13-03.
- `.planning/phases/13-external-verification/13-04-SUMMARY.md` — the
  label-removal record for A1/A2, and A5's escape-hatch tool-contract
  finding.
- `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`
  (filed by plan 13-05) — the A5 tool-contract finding this todo does not
  itself resolve.
- `.planning/todos/completed/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
  — the sibling Phase 2 probe-debt todo, closed by phase 13.
- `.planning/todos/completed/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`
  — the sibling Phase 2 probe-debt todo, closed by phase 13.
- `docs/stock-vice-parity.md` section A item 7 — the licensed-divergence
  register; item 7 now carries a caveat (added by plan 13-05) that a wrong
  probed implementation detail is a silently wrong answer, not a licensed
  divergence.

## Resolution (2026-08-22, phase 15 plan 15-10)

**A4 answered, and this todo closed in full.** A real `stop:false` checkpoint was armed on the
KERNAL's default hardware-IRQ entry point (`$EA31`) against genuine unpatched stock
`/usr/bin/x64sc` (VICE 3.9), launched through the real broker artifact
(`.claude/mcp/vice/stock-a4-checkpoint-flood.test.ts`, the ninth `MANUAL_ONLY_TESTS` entry). The
KERNAL IRQ handler's natural ~50-60Hz rate exceeded the D-11 guard's 20-hits-per-second limit
without any fixture: the checkpoint's hit count climbed `0 -> 7 -> 21` in roughly 2.4 seconds,
the guard's `setImmediate()`-deferred auto-disable fired (`hitsPerSecond: 21`), the checkpoint's
own wire-side `enabled` flag was independently re-read and confirmed `false` (not merely the
local report), and five bounded post-flood register reads showed the emulator's PC still moving
(`[58836,58836,58831,58833,58836]`) — no stall, no deadlock. No escalation to a tight loop was
needed. Full transcript, the verbatim `autoDisables` entry, and the documented scope of what this
single-host/single-rate observation does and does not establish: `15-A4-PROBE-EVIDENCE.md`.
**Verdict: CONFIRMED, for the rates and host tested.**

All five original assumptions, final states:

- **A1** — CONFIRMED (phase 13 plan 13-03, fork VICE 3.10); label removed (plan 13-04).
- **A2** — CONFIRMED (phase 13 plan 13-03, fork VICE 3.10); label removed (plan 13-04).
- **A3** — INCONCLUSIVE; label stays on `stock-input.ts`/`stock-protocol.ts`
  (`assumption-label-discipline.test.ts`'s all-or-nothing guard unaffected). Phase 15 plan 15-08
  independently reproduced the same zero-delta result against a program proven genuinely
  running, eliminating one of three candidate explanations without resolving the rest.
- **A4** — CONFIRMED, for the rates and host tested (this Resolution, `15-A4-PROBE-EVIDENCE.md`).
  No `[ASSUMED]` label existed for A4 (it is a design choice, not a wire assumption — confirmed
  by direct inspection of `assumption-label-discipline.test.ts`'s scope note), so no label change
  applies.
- **A5** — CONTRADICTED; label stays on `stock-protocol.ts`. Its own tool-contract finding
  (`vice_disk_attach`'s advertised approximation) was handed to
  `2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`, which remains open on its
  own track and is not closed by this Resolution.

No source file was changed by this plan (`git diff --quiet .claude/mcp/vice/stock-checkpoints.ts`
confirmed clean); the deferral mechanism was found race-free as designed, not patched.

Cited commits: `dc4f6de` (Task 1, `stock-a4-checkpoint-flood.test.ts`); this todo's own move and
`15-A4-PROBE-EVIDENCE.md`'s creation (Task 2).
