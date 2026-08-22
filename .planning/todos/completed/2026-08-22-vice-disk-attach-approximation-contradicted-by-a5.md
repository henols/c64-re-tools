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
  restating it. (Now `.planning/todos/completed/` — closed in full by
  Phase 15 plan 15-10.)

## Resolution

Both advertised-behaviour records corrected to state what Phase 13's A5
probe actually observed; the tool's contract itself was NOT restructured
(that question is promoted below, per this todo's own "product decision"
framing and Plan 15-11's scope fence).

Answering this todo's own "How to verify" points in order:

1. **`docs/stock-vice-parity.md`'s D-14 entry** (§A item 7) now states the
   full-machine-reset-plus-program-load behaviour, cites
   `13-PROBE-RESULTS.md` § A5 by name, and adds the clause that this is an
   instance of item 7's own caveat — a wrong probed implementation detail is
   a silently wrong answer, not a licensed divergence — rather than
   restating "without loading or running anything" (that exact phrase was
   never verbatim in the doc; the correction targets the substance of the
   claim, not a literal string match).
2. **`stock-machine.ts`'s `handleDiskAttach` approximation string** is now
   an exported named constant, `DISK_ATTACH_APPROXIMATION`: `"AUTOSTART
   (D-14): performs a full machine reset and loads a program from the
   image; unlike vice_autostart it does not issue a final run step, as far
   as observed."` `stock-machine.test.ts`'s assertion imports and compares
   against this constant directly (`assert.equal(payload.approximation,
   DISK_ATTACH_APPROXIMATION)`), so the test and the source string cannot
   drift apart.
3. **A regression test against the real fork build is out of scope for a
   record correction** — this is a disposition phase, not a re-probe phase,
   and Phase 13's own A5 probe (a real, live, non-vacuous experiment against
   genuine fork VICE 3.10, with emulator-log corroboration and a byte-level
   sentinel-destruction check) already stands in as the live evidence this
   correction is derived from. Re-running that probe would re-prove a fact
   already proven; the correction here is bringing two documents into
   agreement with an existing result, not establishing a new one.

**Skill audit (per this todo's own "What a fix would touch" item):** no
skill assumes `vice_disk_attach` is side-effect-free.
`.claude/skills/vice-wedge-triage/SKILL.md:63` and
`.claude/skills/c64-program-recon/references/observation-hazards.md:133`
both use it as a **reboot** step ("Reboot from `vice_disk_attach`"), which
is consistent with reset-plus-load, not contradicted by it.
`.claude/skills/c64-ram-capture/SKILL.md`'s "Boot a disk" section (line 82)
likewise calls `vice_disk_attach` as step 1 of an intentional boot sequence
followed by `vice_autostart` and `vice_execution_run` — also consistent, not
an inspect-without-disturbing claim. No skill prose required a fix.

**Promotion, not a fix:** whether `vice_disk_attach`'s contract should be
restructured — given how little it differs from `vice_autostart` — is a
product decision this disposition phase's scope fence explicitly excludes.
It is promoted to `.planning/REQUIREMENTS.md` → Future Requirements →
"Promoted by DEBT-01" (the placeholder section already reserved for exactly
this). **Owner: plan 15-12**, which performs the final `REQUIREMENTS.md`
reconciliation for this phase and will add the actual entry there, so this
plan does not edit that file concurrently with 15-12's own edits.

Commits: this plan's Task 1 commit (see `15-11-SUMMARY.md`).
