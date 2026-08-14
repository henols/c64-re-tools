---
title: Probe Phase 3's four ASSUMED wire details against a real stock VICE build
date: 2026-08-14
priority: high
source: /gsd-plan-phase 3 — no live stock VICE reachable in-environment
---

# Four behavioural/spelling details were written spec-driven, never exercised against a real binary

Phase 3's request-body encoders, handlers and broker launch flag were all
written grounded in `docs/phase0-binmon-findings.md` §5, the official VICE
manual §13 (Binary monitor), and this repo's own offline-tested
`probe-binmon.mjs` request-body builders. Genuinely stock VICE (`x64sc`,
apt-installed) was present but unused in the research session — the task
scope deliberately did not require live emulator access, so every wire-level
claim had to be grounded in normative docs instead. Four behavioural or
spelling details were never exercised against a running binary and are
carried as `[ASSUMED]` in `.planning/phases/03-direct-tools/03-RESEARCH.md`'s
Assumptions Log (A1, A2, A3, A5) and one design choice (A4) whose
correctness can only be observed against real emulator timing.

**This is verification debt, not a Phase 3 blocker.** No source comment or
test anywhere in this phase's diff claims any of the four assumptions as
verified — each stays labelled `[ASSUMED]` in its JSDoc block until this
todo's acceptance check closes it.

## The four assumptions, case by case

- **A1 — `-remotemonitoraddress` flag spelling.**
  `broker-launch.mts`'s `buildViceArgs()` stock branch appends
  `-remotemonitor -remotemonitoraddress ip4://<host>:<port>`, inferred by
  symmetry with `-binarymonitor`/`-binarymonitoraddress`. **What breaks if
  wrong:** stock either refuses to launch (bad flag) or binds the text
  monitor somewhere unintended (wrong flag, ignored silently). **Risk:** low
  in Phase 3 because nothing dials the port yet; **blocking for Phase 7**,
  which builds the text client and does dial it. **File/function to
  correct:** `.claude/mcp/vice/broker-launch.mts`, `buildViceArgs()`'s stock
  branch.

- **A2 — `ADVANCE_INSTRUCTIONS` (0x71) step-over semantics.**
  `stock-execution.ts` maps `vice_execution_step`'s `stepOver: true` to body
  byte `0x01`. The body layout is `[CITED]` against the official manual; the
  runtime claim that `0x01` skips a `JSR`'s subroutine as one step — matching
  the fork's own `stepOver` field semantic — has never been probed against a
  real `JSR`. **What breaks if wrong:** `stepOver: true` silently behaves
  like a plain single-instruction step, and the PC reported after "stepping
  over" a `JSR` is wrong (it lands inside the subroutine instead of after the
  call). **File/function to correct:** `.claude/mcp/vice/stock-execution.ts`,
  the `advanceInstructionsBody()`/step handler that sets the step-over byte.

- **A3 — `JOYPORT_SET` (0xa2) `value` bit layout.**
  `stock-input.ts` maps the fork's `direction`/`fire` arguments to
  `bit0=up, bit1=down, bit2=left, bit3=right, bit4=fire`, from general VICE
  joystick-driver knowledge, not from the manual page fetched or a probe run
  this session. **What breaks if wrong:** the joystick moves in the wrong
  direction, or fire never registers, with no error — a silently-wrong
  answer, not a loud one. Note that `joyportSetBody()` deliberately takes an
  already-composed raw `value`, so the assumed mapping lives in exactly one
  function to correct. **File/function to correct:**
  `.claude/mcp/vice/stock-input.ts`, the function that composes `direction`/
  `fire` into the raw `value` bitmask before calling `joyportSetBody()`.

- **A5 — `AUTOSTART` (0xdd) `fileIndex` with the run flag clear.**
  `stock-machine.ts` implements D-14's disk-attach approximation as
  `AUTOSTART` with `runAfter = 0` and `fileIndex = 0`. **What breaks if
  wrong:** if VICE's `AUTOSTART` handler treats `fileIndex` differently when
  `runAfter` is 0 (e.g. still attempting to locate and partially load a
  specific program on the disk image even with run suppressed), the
  disk-attach approximation could have a side effect nobody asked for.
  **File/function to correct:** `.claude/mcp/vice/stock-machine.ts`, the
  disk-attach handler that builds the `AUTOSTART` request body.

- **A4 (design choice, not a wire assumption) — the `stop:false` rate
  limiter's auto-disable deferral timing.** `stock-checkpoints.ts`'s D-11
  rate limiter defers its auto-disable `CHECKPOINT_TOGGLE` send via
  `setImmediate()`, out of the synchronous `'event'` callback stack that
  receives each `CHECKPOINT_INFO` hit — a design decision (this research
  session's own synthesis, not sourced from CONTEXT.md or an external
  document), not a protocol fact to get right or wrong. Whether this
  particular deferral mechanism is race-free under a real, synchronous
  `CHECKPOINT_INFO` flood from inside VICE's CPU loop is only observable
  against a real emulator — unit tests can prove the deferral's *ordering*
  (zero sends before the tick, one after) but not whether it suppresses a
  genuine flood without reentering it. **File/function to note:**
  `.claude/mcp/vice/stock-checkpoints.ts`, the rate-limiter's auto-disable
  scheduling.

## Acceptance check for closing this todo

Run, on a session with a real stock `x64sc` build reachable:

1. Extend `.claude/mcp/vice/probe-binmon.mjs` with one check per wire
   assumption (A1, A2, A3, A5): send each new request body against the real
   binary and assert the reply's `errorCode` is not `InvalidLength` (`0x80`),
   `InvalidParameter` (`0x81`), or `InvalidType` (`0x83`) — a rejected body
   means the assumed layout itself is wrong, before even getting to the
   behavioural question.
2. **A2:** step over a known `JSR` instruction and compare the reported PC
   afterward against the address immediately following the `JSR`'s operand
   (3 bytes past the `JSR` opcode) — confirms or refutes the "skip
   subroutine as one step" semantic.
3. **A3:** drive each joystick direction (up/down/left/right) and fire
   individually through `JOYPORT_SET`, then read the corresponding CIA
   joystick port back through `MEM_GET` to confirm which physical direction
   each bit actually produced.
4. **A5:** attach a `.d64`/`.g64` image via `AUTOSTART` with `runAfter = 0`
   and confirm no program was loaded or partially loaded — the machine stays
   exactly as it was before the attach except for the disk being mounted.
5. **A1:** launch stock VICE with both `-binarymonitor` and `-remotemonitor`
   flags together, then `ss -ltnp` to confirm both ports are actually
   listening — not just that the process didn't crash.
6. **A4:** arm a `stop:false` checkpoint on a hot, frequently-executed
   address and confirm the rate limiter's auto-disable actually fires,
   the checkpoint is toggled off, and neither the client nor the emulator
   deadlocks or stalls during the flood.
7. Once a step above **confirms** its assumption, remove the `[ASSUMED]`
   label from that assumption's named JSDoc block **only** — leave any
   assumption not yet confirmed labelled. If a probe **contradicts** an
   assumption, correct the mapping in `stock-input.ts` (A3) or the
   step-semantics note in `stock-execution.ts` (A2), or the relevant handler
   for A1/A5, and add a regression test capturing the corrected, real
   behaviour before removing the label.

## Related

- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
  — the sibling Phase 2 probe-debt todo: the three VERIF-02 binmon fixtures
  are synthetic, not hardware-recorded, for the identical reason (no stock
  VICE reachable in that plan's execution environment). Shares this todo's
  environment constraint and should be closed in the same hands-on session.
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`
  — the sibling Phase 2 probe-debt todo for the `--help` backend
  discriminator, independently scoped but from the same missing-hardware
  constraint.
- `docs/stock-vice-parity.md` section A item 7 — the licensed-divergence
  register this phase's decisions are recorded against; A1/A2/A3/A5 do not
  change any *licensed divergence* (they are implementation-detail risks,
  not design decisions), but a wrong A2/A3/A5 would produce a silently wrong
  answer the parity doc does not currently warn about.
- `.planning/phases/03-direct-tools/03-VALIDATION.md`'s Manual-Only
  Verifications table — this todo is the tracking artifact for that table's
  "New encoders are byte-for-byte accepted by a real VICE binary" row.
