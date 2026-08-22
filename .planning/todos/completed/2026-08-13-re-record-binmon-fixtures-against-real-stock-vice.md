---
title: Re-record the three VERIF-02 binmon fixtures against a real stock VICE build
date: 2026-08-13
priority: high
source: /gsd-execute-phase 2 plan 02-02 — D-19 override, no stock VICE reachable in-environment
resolves_phase: 13
---

# Three committed fixtures are synthetic, not hardware-recorded

`.claude/mcp/vice/fixtures/binmon/display-get.bin`,
`event-interleaved.bin`, and `checkpoint-list.bin` were generated from the
normative protocol spec (`docs/phase0-binmon-findings.md` §5,
`probe-binmon.mjs`'s own body-layout parsers) instead of captured live
from a real `x64sc -binarymonitor` session, because no stock VICE binary
was reachable in the environment plan 02-02 executed in on 2026-08-13.
This overrode decision D-19 ("record everything a real emulator will
produce"), which plan 02-02 itself established.

Full rationale, what each field's byte layout was derived from, and what
a re-capture must confirm: `docs/phase2-backend-probe-evidence.md` §1.

## Why this is synthetic, case by case

- **`display-get.bin`** — a single `DISPLAY_GET` (0x84) reply frame,
  requestId `1`, body built from the geometry `docs/phase1-probe-results.md`
  already recorded from an earlier real probe run (`dw=504 dh=312 xo=136
  yo=51 iw=320 ih=200 bpp=8`), but the frame itself was never sent by a
  running emulator in this plan's execution.
- **`event-interleaved.bin`** — models a `RESUMED` → `STOPPED` →
  `REGISTER_INFO` broadcast-event sequence landing between an
  `ADVANCE_INSTRUCTIONS` request and its own correlated reply. The
  ordering follows the documented pause/run model and this project's
  Phase 1 refinement (`REGISTER_INFO` recurs on every `STOPPED`
  transition), but it is a plausible spec-conformant sequence, not an
  observed one — a real single-instruction step could produce a different
  count or order.
- **`checkpoint-list.bin`** — models two `CHECKPOINT_SET` replies followed
  by a `CHECKPOINT_LIST` answer of two `CHECKPOINT_INFO`-shaped entries
  plus a terminator frame, all sharing one request id. The terminator
  frame's exact response type (`0x14`) and body (`u32LE` count) are an
  unverified reading of "N+1 frames on one request id" — no spec text
  this plan had access to names the terminator's real shape.

Every sidecar carries `"synthetic": true`, `"capturedFrom":
"synthesized-fallback"`, and a `specSections` array naming exactly which
spec section each field came from. `fixtures/binmon/README.md`'s
provenance table marks all three rows the same way. Neither is labelled,
or should ever be mistaken for, hardware-recorded evidence.

## Acceptance check for closing this todo

Re-run, on a host with a real stock `x64sc` build:

```
cd .claude/mcp/vice
VICE_BINMON=127.0.0.1:6502 node probe-binmon.mjs --capture all
```

against a real `x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502`
process, then:

1. Confirm the run does not hit `MAX_CAPTURE_FRAMES` for any case (the
   `checkpoint-list` flood hazard recorded in `docs/phase1-probe-results.md`).
2. Diff the newly captured `display-get.bin`'s geometry fields against
   this synthetic fixture's — they should match (`docs/phase1-probe-results.md`'s
   `docs/phase1-probe-results.md` recorded geometry is from the same
   debug-screen setup).
3. Inspect the real `event-interleaved.bin`'s actual event sequence and
   count; update `docs/phase2-backend-probe-evidence.md` and this plan's
   test assertions in `binmon-fixtures.test.ts` if the real sequence
   differs from `RESUMED, STOPPED, REGISTER_INFO, <reply>`.
4. Inspect the real `checkpoint-list.bin`'s terminator frame's actual
   response type and body layout; correct this synthetic fixture's
   assumed `0x14`/`u32LE`-count shape if it differs.
5. Replace all three `.bin`/`.json` pairs, update
   `fixtures/binmon/README.md`'s provenance table to real `capturedFrom`
   (binary path + `stock`), the real `viceVersion` quad, and the real
   `capturedAt` timestamp — and remove the `synthetic`/`specSections`/
   `note` sidecar keys this override added, since they no longer apply to
   real captures.
6. Confirm `binmon-fixtures.test.ts`'s `fixture:` tests still pass
   unmodified against the real bytes — if any assertion needs loosening
   or tightening because the real capture's shape differs from the
   synthetic model, that is itself evidence this todo exists to surface,
   not a reason to skip re-recording.

## Related

- `docs/phase2-backend-probe-evidence.md` §1 — full override record.
- `.planning/phases/02-stock-backend-connection/02-02-PLAN.md` — original
  Task 1, written for a `checkpoint:human-verify` capture run that this
  override bypassed.
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`
  — the sibling todo for plan 02-07's backend-detection `--help`
  discriminator (`docs/phase2-backend-probe-evidence.md` §2's OPEN verdict),
  a different, independently-scoped gap from the same environment
  constraint that produced this one.

## Resolution

Closed by phase 13, plan 13-01 (`bfae419`, `f219e40`, `e97ab78`, `ca7bdf0`)
and closed in the record by plan 13-05 (`ed61f98`). Requirement `EXTV-01`.
Artifacts: `.planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md`
(the full evidence record), `docs/phase2-backend-probe-evidence.md` §1
(the closed override record).

Answers to this todo's six numbered acceptance steps:

1. **No case hit `MAX_CAPTURE_FRAMES`.** Frame counts: `display-get` 1
   frame, `event-interleaved` 4 frames, `checkpoint-list` 11 frames — all
   far below the 32-frame cap. No case printed the `ABORTED` message.
2. **`display-get.bin`'s geometry matched exactly.** All seven decoded
   fields (`dw`/`dh`/`xo`/`yo`/`iw`/`ih`/`bpp`) matched
   `docs/phase1-probe-results.md`'s previously-recorded reading
   field-for-field; `imageLength` and the frame's declared `body_length`
   both checked out arithmetically.
3. **The real `event-interleaved.bin` event sequence differs from this
   todo's synthetic model and was corrected.** Real order: the command's
   own correlated reply first, then `RESUMED`, `REGISTER_INFO`, `STOPPED` —
   not the synthetic `RESUMED, STOPPED, REGISTER_INFO, <reply>` guess. It
   matches `docs/phase1-probe-results.md` line 248/262's already-recorded
   order. `docs/phase2-backend-probe-evidence.md` was updated (plan
   13-05) and `stock-protocol.test.ts`'s `correlat:` checkpoint-list test's
   `events.length` assertion was corrected from 2 to 8 against the real
   interleaved broadcast frames the synthetic fixture never modeled.
4. **The real `checkpoint-list.bin` terminator frame CONFIRMED the assumed
   shape — no correction needed.** `response_type = 0x14`
   (`CHECKPOINT_LIST`) with a 4-byte `u32LE` count body, exactly as
   guessed; `stock-protocol.ts`'s `CheckpointList` branch was left
   untouched (`git diff --stat stock-protocol.ts` for that task was
   empty).
5. **All three `.bin`/`.json` pairs replaced.** Each sidecar now carries
   `capturedFrom: "fork:/usr/local/bin/x64sc"`, `viceVersion: "3.10.0.0"`,
   a real `capturedAt` timestamp, and `synthetic: false`; the
   `specSections`/`note` keys were removed.
   `fixtures/binmon/README.md`'s provenance table and prose were rewritten
   to state all six fixtures (these three plus the pre-existing
   `cpuhistory-get*` three) are real captures.
6. **`binmon-fixtures.test.ts`'s `fixture:` tests pass against the real
   bytes.** The two `WR-10` tests whose premise inverted (asserting
   `synthetic: true` for these three cases) were rewritten, not merely
   tweaked, to describe the post-EXTV-01 world; the `WR-09` "states
   provenance as real" expectation array was updated; and the
   `correlat:`/`checkpoint-list` `events.length` assertion above was
   corrected per this plan's own rule against silently loosening a
   failing assertion.

The binary resolved dynamically via `command -v x64sc` to
`/usr/local/bin/x64sc` (the fork, VICE 3.10.0.0) rather than genuine stock
3.9 — this is D-13-01's accepted, honestly-recorded consequence (see
`docs/phase2-backend-probe-evidence.md` §1's closure), not a deviation
from this todo's own acceptance check, which named "a real stock `x64sc`
build" generically and did not require a specific binary.
