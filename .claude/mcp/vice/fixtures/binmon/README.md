# Binary-monitor wire fixtures

Byte-exact response frames for the binary-monitor cases VERIF-02 can only
answer against a real `x64sc` -- intended to be captured live from the
emulator's binary monitor, never hand-edited. The other five of VERIF-02's
eight cases (JAM, unknown response type, duplicate reply, desync stream,
byte-at-a-time delivery) need no emulator at all and are synthesized
directly by `../../binmon-fixtures.ts`'s `synthetic*` builders instead of
living here.

**ALL REAL CAPTURES -- read each fixture's own sidecar, never this paragraph
alone.** There is a single blanket answer for this directory now, and there
did not used to be: this README once claimed three fixtures were synthetic,
which stopped being true when the external-verification phase re-recorded
them (see `.planning/phases/13-external-verification/13-CAPTURE-TRANSCRIPT.md`).
Every sidecar **states** `synthetic` explicitly, and
`../../binmon-fixtures.ts`'s `loadCapturedFixture()` **requires** the key, so
provenance can never again be established by omission.

**Re-recorded (3): `display-get`, `event-interleaved`, `checkpoint-list`.**
2026-08-13 override of D-19: no stock VICE binary was reachable in the
environment plan 02-02 executed in, so these three were originally generated
from the normative protocol spec (`docs/phase0-binmon-findings.md` §5,
`../../probe-binmon.mjs`'s own body layouts) rather than captured from a live
`x64sc -binarymonitor` session. That override is now resolved: the
external-verification phase re-recorded all three against a real, running
`x64sc` (the patched, non-upstream fork build at `/usr/local/bin/x64sc` --
see `CLAUDE.md`'s framing of that binary -- shadowing genuine stock VICE
earlier on `$PATH` on the host that ran the capture). See
`docs/phase2-backend-probe-evidence.md` for the original override record and
`13-CAPTURE-TRANSCRIPT.md` for the re-capture evidence: frame-by-frame
decoding, the `display-get` geometry match, the `event-interleaved` order
verdict, and the `checkpoint-list` terminator verdict. Each now carries
`"synthetic": false` and a `capturedFrom` naming the real binary's kind and
absolute path -- the retired `specSections`/`note` sidecar keys and the
`"synthesized-fallback"` placeholder no longer apply to any fixture in this
directory.

**Real captures (3): `cpuhistory-get`, `cpuhistory-get-multi`,
`cpuhistory-get-unsupported`.** Added 2026-08-18 by plan 07-12, off the
**patched, non-upstream fork build** (`/usr/local/bin/x64sc`, VICE 3.10, for
the first two -- not a "genuine" build in the upstream sense; see CLAUDE.md)
and genuine unpatched stock VICE (`/usr/bin/x64sc`, VICE 3.9, for the third).
Each carries `"synthetic": false`. These **are** hardware evidence:
`cpuhistory-get` was hand-decoded byte by byte to re-derive the
`CPUHISTORY_GET` entry layout, and `cpuhistory-get-multi` (four entries,
strictly ascending cycles) is what proved `entries[]` arrives oldest-first.
`cpuhistory-get-unsupported` can only be re-recorded against a **3.9-class**
build -- see "Bounded by design" below.

## Source paths

| Fixture | Case | Captured from | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|
| `display-get.bin` / `.json` | `display-get` | **real capture** -- `fork:/usr/local/bin/x64sc` | 3.10.0.0 | 2026-08-21 | `binmon-fixtures.test.ts`, `stock-protocol.test.ts` |
| `event-interleaved.bin` / `.json` | `event-interleaved` | **real capture** -- `fork:/usr/local/bin/x64sc` | 3.10.0.0 | 2026-08-21 | `binmon-fixtures.test.ts`, `stock-protocol.test.ts` |
| `checkpoint-list.bin` / `.json` | `checkpoint-list` | **real capture** -- `fork:/usr/local/bin/x64sc` | 3.10.0.0 | 2026-08-21 | `binmon-fixtures.test.ts`, `stock-protocol.test.ts` |
| `cpuhistory-get.bin` / `.json` | `cpuhistory-get` | **real capture** -- `stock:/usr/local/bin/x64sc` (sidecar's literal value; that binary is actually the fork build, not upstream stock -- known mislabel, see CLAUDE.md and the paragraph above; tracked outside this plan's scope) | 3.10.0.0 | 2026-08-18 | `stock-protocol.test.ts` (plan 07-12) |
| `cpuhistory-get-multi.bin` / `.json` | `cpuhistory-get-multi` | **real capture** -- `stock:/usr/local/bin/x64sc` (sidecar's literal value; same known mislabel as above) | 3.10.0.0 | 2026-08-18 | `stock-protocol.test.ts` (plan 07-12) |
| `cpuhistory-get-unsupported.bin` / `.json` | `cpuhistory-get-unsupported` | **real capture** -- `stock:/usr/bin/x64sc` (INVALID_TYPE error frame; genuine unpatched stock; **needs a 3.9-class build to re-record**) | 3.9.0.0 | 2026-08-18 | `stock-protocol.test.ts` (plan 07-12) |

Each `.bin` is the raw, concatenated wire bytes in real capture arrival order;
each `.json` sidecar carries exactly `capturedFrom`, `viceVersion`,
`capturedAt`, `command`, and `synthetic` (`binmon-fixtures.ts`'s
`loadCapturedFixture()` throws a named `MissingFixtureError` if either file is
absent or the sidecar is missing one of those five keys), plus the optional
`specSections`/`note` extras. `synthetic` became **required** in WR-09: while it
was optional, `loadCapturedFixture()` derived `synthetic: provenance.synthetic
=== true`, so a sidecar that omitted it read back as a real capture and
`assert.equal(fixture.synthetic, false)` was satisfied by silence.

## Frozen evidence vs. living capture

Every fixture here is meant to be a **living capture**, not frozen evidence
(contrast `../README.md`'s bash-broker fixtures, which are frozen because their
writer no longer exists): each is regenerable at any time by running

```
node probe-binmon.mjs --capture <case>
```

against a real `x64sc -binarymonitor` build, where `<case>` is one of
`display-get`, `event-interleaved`, `checkpoint-list`, `cpuhistory-get`,
`cpuhistory-get-multi`, `cpuhistory-get-unsupported`, or `all` for every case in
one run. Regenerating a fixture is expected and safe when the target VICE build
changes; it is not "tidying" and does not need special justification the way
editing a frozen fixture would.

**`--capture all` is version-gated per case.** `cpuhistory-get` and
`cpuhistory-get-multi` need a **≥ 3.10** target; `cpuhistory-get-unsupported`
needs a **3.9** one. `probe-binmon.mjs`'s `CAPTURE_REQUIRES_VERSION` refuses the
mismatch and writes no `.bin`, so a single `--capture all` run against one build
can no longer overwrite a fixture with bytes from the wrong VICE version while
leaving its sidecar's `command` string describing the other (07-REVIEW.md
WR-10).

Hand-editing any `.bin` here is never the right move -- a fixture edited to
make a test pass silently stops being evidence of anything. Regenerate it
against a real binary instead.

## Bounded by design

Two independent guards keep a capture run from writing a fixture that lies.

`CAPTURE_REQUIRES_VERSION` (WR-10) declares the VICE version family each case
requires and is checked BEFORE the case's runner sends anything, so a
mismatched target is skipped with a named reason and no `.bin` is written. This
matters because `cpuhistory-get-unsupported`'s runner is byte-identical to
`cpuhistory-get`'s -- the only thing distinguishing them is the build they run
against, and before this guard `--capture all` against a 3.10 build overwrote
the "unsupported" fixture with a successful 52-byte history frame while its
sidecar still read *"against a build without FEATURE_CPUMEMHISTORY"*.

`--capture`'s `MAX_CAPTURE_FRAMES` cap (32 frames per case) exists so a
runaway case -- in particular `checkpoint-list`, whose fork-build flood is
recorded in `docs/phase1-probe-results.md` -- aborts and writes no `.bin`
rather than consuming the whole capture session's time budget. An aborted
case leaves its row above unchanged (still whatever it was before the
aborted run -- synthetic or a stale real capture) rather than writing a
partial fixture.
