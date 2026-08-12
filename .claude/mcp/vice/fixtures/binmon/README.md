# Binary-monitor wire fixtures

Byte-exact response frames for the binary-monitor cases VERIF-02 can only
answer against a real `x64sc` -- captured live from the emulator's binary
monitor, never hand-edited. The other five of VERIF-02's eight cases (JAM,
unknown response type, duplicate reply, desync stream, byte-at-a-time
delivery) need no emulator at all and are synthesized directly by
`../../binmon-fixtures.ts`'s `synthetic*` builders instead of living here.

## Source paths

| Fixture | Case | Captured from | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|
| `display-get.bin` / `.json` | `display-get` | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) |
| `event-interleaved.bin` / `.json` | `event-interleaved` | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) |
| `checkpoint-list.bin` / `.json` | `checkpoint-list` | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) | PENDING (plan 02-02) |

Each `.bin` is the raw, concatenated wire bytes captured in arrival order;
each `.json` sidecar carries exactly `capturedFrom`, `viceVersion`,
`capturedAt`, and `command` (`binmon-fixtures.ts`'s `loadCapturedFixture()`
throws a named `MissingFixtureError` if either file is absent or the
sidecar is missing one of those four keys).

## Frozen evidence vs. living capture

Once populated by plan 02-02, all three fixtures here are **living
captures**, not frozen evidence (contrast `../README.md`'s bash-broker
fixtures, which are frozen because their writer no longer exists): each is
regenerable at any time by running

```
node probe-binmon.mjs --capture <case>
```

against a real `x64sc -binarymonitor` build, where `<case>` is one of
`display-get`, `event-interleaved`, `checkpoint-list`, or `all` for every
case in one run. Regenerating a fixture is expected and safe when the
target VICE build changes; it is not "tidying" and does not need special
justification the way editing a frozen fixture would.

## Bounded by design

`--capture`'s `MAX_CAPTURE_FRAMES` cap (32 frames per case) exists so a
runaway case -- in particular `checkpoint-list`, whose fork-build flood is
recorded in `docs/phase1-probe-results.md` -- aborts and writes no `.bin`
rather than consuming the whole capture session's time budget. An aborted
case leaves its row above unchanged (still `PENDING`) rather than writing a
partial fixture.
