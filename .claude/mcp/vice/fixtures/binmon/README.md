# Binary-monitor wire fixtures

Byte-exact response frames for the binary-monitor cases VERIF-02 can only
answer against a real `x64sc` -- intended to be captured live from the
emulator's binary monitor, never hand-edited. The other five of VERIF-02's
eight cases (JAM, unknown response type, duplicate reply, desync stream,
byte-at-a-time delivery) need no emulator at all and are synthesized
directly by `../../binmon-fixtures.ts`'s `synthetic*` builders instead of
living here.

**SYNTHETIC, NOT HARDWARE-RECORDED (2026-08-13 override of D-19).** No
stock VICE binary is reachable in the environment plan 02-02 executed in,
so the three fixtures below were generated from the normative protocol
spec (`docs/phase0-binmon-findings.md` §5, `../../probe-binmon.mjs`'s own
body layouts) rather than captured from a live `x64sc -binarymonitor`
session. This is a recorded, non-silent downgrade of D-19 -- see
`docs/phase2-backend-probe-evidence.md` for the full override record and
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
for the re-capture follow-up. Every sidecar below carries `"synthetic":
true` and a `specSections` array naming exactly which spec section each
field came from -- do not treat `capturedFrom: "synthesized-fallback"` as
hardware evidence anywhere downstream.

## Source paths

| Fixture | Case | Captured from | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|
| `display-get.bin` / `.json` | `display-get` | **synthesized-fallback** (spec-derived, see sidecar `specSections`) | N/A -- synthetic | 2026-08-13 | `binmon-fixtures.test.ts` (this plan), `stock-protocol.test.ts` (plan 02-04) |
| `event-interleaved.bin` / `.json` | `event-interleaved` | **synthesized-fallback** (spec-derived, see sidecar `specSections`) | N/A -- synthetic | 2026-08-13 | `binmon-fixtures.test.ts` (this plan), `stock-protocol.test.ts` (plan 02-04) |
| `checkpoint-list.bin` / `.json` | `checkpoint-list` | **synthesized-fallback** (spec-derived, see sidecar `specSections`) | N/A -- synthetic | 2026-08-13 | `binmon-fixtures.test.ts` (this plan), `stock-protocol.test.ts` (plan 02-04) |

Each `.bin` is the raw, concatenated wire bytes in arrival order (real
capture order, when re-recorded; synthesized-but-plausible order for now);
each `.json` sidecar carries exactly `capturedFrom`, `viceVersion`,
`capturedAt`, and `command` (`binmon-fixtures.ts`'s `loadCapturedFixture()`
throws a named `MissingFixtureError` if either file is absent or the
sidecar is missing one of those four keys), plus the synthetic-provenance
extras (`synthetic`, `specSections`, `note`) added by this override.

## Frozen evidence vs. living capture

Once re-recorded against a real build, all three fixtures here are meant
to be **living captures**, not frozen evidence (contrast `../README.md`'s
bash-broker fixtures, which are frozen because their writer no longer
exists): each is regenerable at any time by running

```
node probe-binmon.mjs --capture <case>
```

against a real `x64sc -binarymonitor` build, where `<case>` is one of
`display-get`, `event-interleaved`, `checkpoint-list`, or `all` for every
case in one run. Regenerating a fixture is expected and safe when the
target VICE build changes; it is not "tidying" and does not need special
justification the way editing a frozen fixture would. Until the re-capture
described above happens, hand-editing the `.bin` bytes is still never the
right move -- a fixture edited to make a test pass silently stops being
evidence of anything, synthetic or real.

## Bounded by design

`--capture`'s `MAX_CAPTURE_FRAMES` cap (32 frames per case) exists so a
runaway case -- in particular `checkpoint-list`, whose fork-build flood is
recorded in `docs/phase1-probe-results.md` -- aborts and writes no `.bin`
rather than consuming the whole capture session's time budget. An aborted
case leaves its row above unchanged (still whatever it was before the
aborted run -- synthetic or a stale real capture) rather than writing a
partial fixture.
