# Text-monitor wire fixtures

The first text-channel fixture batch: raw, byte-exact text-monitor responses for
a fixed set of parseable commands, captured **live** from both binaries on this
host — genuine unpatched stock VICE 3.9 (`/usr/bin/x64sc`) and the patched fork
VICE 3.10 (`/usr/local/bin/x64sc`) — with the same five-key provenance
discipline `../binmon/README.md` already documents for the binary-monitor
fixtures. Captured by
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs`
(plan `39-07`, `CHAN-01`).

**Every fixture here is a real, hardware-recorded capture (`"synthetic": false`).**
Read each fixture's own sidecar, never this paragraph alone.

## Source paths

**The "Loader case name" column is exactly `loadTextFixture()`'s `caseName`
argument** (confirmed against `listTextFixtures()`'s actual output) — it is
always the command-group name plus a `-stock`/`-fork` suffix. The bare
command-group name (e.g. `access-map`) is never a valid `caseName` by itself.

| Fixture | Command group | Loader case name | Captured from | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|---|
| `access-map-stock.txt` / `.json` | `access-map` | `access-map-stock` | **real capture** — `stock:/usr/bin/x64sc` | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `access-map-fork.txt` / `.json` | `access-map` | `access-map-fork` | **real capture** — `fork:/usr/local/bin/x64sc` | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `flat-profile-stock.txt` / `.json` | `flat-profile` | `flat-profile-stock` | **real capture** — `stock:/usr/bin/x64sc` | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `flat-profile-fork.txt` / `.json` | `flat-profile` | `flat-profile-fork` | **real capture** — `fork:/usr/local/bin/x64sc` | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `cpu-history-stock.txt` / `.json` | `cpu-history` | `cpu-history-stock` | **real capture** — `stock:/usr/bin/x64sc` | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `cpu-history-fork.txt` / `.json` | `cpu-history` | `cpu-history-fork` | **real capture** — `fork:/usr/local/bin/x64sc` | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `backtrace-stock.txt` / `.json` | `backtrace` | `backtrace-stock` | **real capture** — `stock:/usr/bin/x64sc` | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `backtrace-fork.txt` / `.json` | `backtrace` | `backtrace-fork` | **real capture** — `fork:/usr/local/bin/x64sc` | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `register-decode-stock.txt` / `.json` | `register-decode` | `register-decode-stock` | **real capture** — `stock:/usr/bin/x64sc` | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `register-decode-fork.txt` / `.json` | `register-decode` | `register-decode-fork` | **real capture** — `fork:/usr/local/bin/x64sc` | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `connect-banner-stock.txt` / `.json` | `connect-banner` | `connect-banner-stock` | **real capture** — `stock:/usr/bin/x64sc` (0 bytes — see "The empty banner" below) | `x64sc (VICE 3.9)` | 2026-09-07 | `textmon-fixtures.test.ts` |
| `connect-banner-fork.txt` / `.json` | `connect-banner` | `connect-banner-fork` | **real capture** — `fork:/usr/local/bin/x64sc` (0 bytes — see "The empty banner" below) | `x64sc (VICE 3.10)` | 2026-09-07 | `textmon-fixtures.test.ts` |

**The `capturedFrom` kind token (`stock`/`fork`) is DERIVED, not operator-supplied**
— unlike the binmon tree's own recorded two-month mislabelling incident
(`../binmon/README.md`), `fixture-capture.mjs` computes it from the RESOLVED
ABSOLUTE PATH of the binary that actually answered (`probe-harness.mjs`'s
`viceKind()`), never from an environment variable or a hand-typed string.

Each `.txt` is the raw response bytes exactly as received over the text-monitor
TCP socket — always including the final exit prompt, and additionally the
entry-echo prompt for `memmapshow` only (see "Framing" below) — terminator
included, with no trimming, re-wrapping or decoding. Each `.json` sidecar
carries exactly the five required keys `capturedFrom`, `viceVersion`,
`capturedAt`, `command`, `synthetic` (mirroring
`../../binmon-fixtures.ts`'s `REQUIRED_PROVENANCE_KEYS`, reimplemented — not
imported — by `../../textmon-fixtures.ts` per D-18), plus the optional `note`
key for an unsupported-command capture (D-20; none fired in this batch — see
below).

**`capturedAt` is run-level, not per-capture** (WR-02, `39-REVIEW.md`): every
sidecar in this batch carries the SAME millisecond-precision `capturedAt`,
because the capture script stamps the batch run's start time, not each
individual capture's completion time — do not read `capturedAt` as a
per-capture timestamp or use it to order or time-compare individual captures.

## The command set

The six parseable outputs the next phase's parsers will consume, one payload
pair per command per binary:

| Command group | Command sent | What it captures |
|---|---|---|
| `access-map` | `memmapshow` | The per-address IO/ROM/RAM access map (all 65536 addresses — ~1.6MB) |
| `flat-profile` | `prof flat 5` (after `prof on`) | The flat profiler report, top 5 by cycles |
| `cpu-history` | `chis 4` | The last 4 CPU-history entries, with per-entry cycle counts |
| `backtrace` | `bt` | The reconstructed JSR call-chain with SP offsets |
| `register-decode` | `io $d020` | The VIC-II register dump plus decoded semantics (raster line, mode, colors, sprites) |
| `connect-banner` | *(none — captured from the connect itself)* | Whatever arrives before any command is sent |

## The empty banner

`connect-banner-{stock,fork}.txt` are both **zero bytes**, on both binaries.
This is not a capture bug: `39-idle-coexist.md` (plan `39-03`) already measured
and recorded this same fact — the stock text monitor sends **nothing** on
connect, no greeting and no prompt, and only replies once it receives input.
This batch reconfirms the same zero-byte finding independently, now on both
binaries rather than stock alone, and commits it as a fixture rather than only
a prose note: a parser build against this batch must not assume a banner
exists to skip over.

## Framing: every reply ends with an exit-prompt; a leading entry-echo is command-dependent

**Not previously documented anywhere in this project, and corrected here after
CR-01 (`39-REVIEW.md`) found the original wording overgeneralized from a
single case.** Every committed reply ends with a second `(C:$xxxx) ` prompt
once the monitor returns to its input-wait state — that part holds for all
twelve payloads. A *leading* entry-echo of the same form, written before the
command has actually executed, was observed in this batch **only** for
`memmapshow` (`access-map-{stock,fork}.txt`, 2 occurrences of `(C:$xxxx)` each
— entry-echo plus exit-prompt). The other five committed pairs (`backtrace`,
`cpu-history`, `flat-profile`, `register-decode` — 1 occurrence each, the
trailing exit-prompt only) begin directly with the command's own output, and
`connect-banner` (0 occurrences, both binaries) carries neither — it is the
pre-prompt banner, captured before any command is sent (see "The empty
banner" above). A parser must not assume every command reply is prefixed with
an entry-echo prompt.

For a command slow enough to compute (`memmapshow`, scanning all 65536
addresses), the entry-echo and the rest of the reply routinely arrive as
**separate TCP segments** — measured live while building the capture script:
a naive client that resolves on the FIRST regex match against the accumulated
buffer's end (`textmon-probe-client.mjs`'s own `sendAndAwaitPrompt()` — a
throwaway, by its own file header, explicitly not built to survive this
hazard) truncates the capture at 10 bytes (the bare entry-echo) and
misattributes the real ~1.6MB `memmapshow` dump to whatever command is sent
next. `fixture-capture.mjs` uses its own local settle-based capture instead
(wait for a `PROMPT_RE` match, then require the socket to go quiet for a fixed
window before finalizing, resetting on any further data) — every payload in
this tree was captured with that corrected framing, confirmed by
`39-fixture-batch.md`'s own transcript showing the fix applied before and
after.

## Divergence between the two binaries

`FIXTURE_DIVERGENCE: access-map, flat-profile, cpu-history, backtrace,
register-decode` — every committed pair except `connect-banner` (both 0 bytes
on both binaries) differs between stock and fork on this host. Read against
the actual byte diffs (see `39-fixture-batch.md`), every one of these
differences is a **timing artefact, not a format or semantic difference**:

- `access-map` / `backtrace`: only the entry-echo and exit-prompt's PC value
  differs (`e5d1` vs `e5d4`) — both addresses are inside the SAME five-address
  KERNAL idle loop (`bt`'s own reconstructed call chain shows it), so this is
  which instruction of that loop the CPU happened to be paused at when the
  monitor re-entered, not a different location in the program.
- `flat-profile` / `cpu-history`: only the accumulated cycle counts /
  timestamps differ, by a few thousand cycles — the natural result of two
  independently-launched processes reaching the same idle steady-state after
  a slightly different number of real-time-driven wall-clock cycles, even
  with the shared determinism flags fixing the RNG seed.
- `register-decode`: the VIC-II raster position (`Raster cycle/line`, `VC`,
  `VMLI`, `Phi1`) differs because `io $d020` samples LIVE, continuously
  advancing VIC-II state — reading it at two different real-time instants
  necessarily reads two different raster positions; `$D020`'s own border
  colour value (byte 5 of the register dump) is IDENTICAL on both binaries.

None of these is a command-syntax, output-shape, or stock/fork semantic
difference. Both captures stay committed; neither is treated as canonical or
corrected toward the other, per this phase's own "a divergence is a finding,
never averaged or dropped" rule.

## Encoding

`FIXTURE_ENCODING: has-high-bytes` — measured across every byte in this batch,
not assumed. The high bytes are confined to `flat-profile-{stock,fork}.txt`:
VICE's flat-profiler report uses the UTF-8 encoding of U+202F (NARROW NO-BREAK
SPACE, bytes `e2 80 af`) as its thousands-group separator in the cycle-count
columns (e.g. the digits in `2 326 048` are separated by this three-byte
sequence, not an ASCII space). This is exactly why the payload buffer, not a
lossily-decoded string, is this tree's authoritative capture — a naive
ASCII/Latin-1 decode would silently mangle these separators.

## Unsupported commands (D-20)

`FIXTURE_UNSUPPORTED: none` in this batch — every command in the set answered
successfully on both binaries; no refusal fired. This is itself a real,
measured finding worth stating plainly: it is **not** the version-floor
behaviour the binary-monitor side has for `CPUHISTORY_GET` (0x86), and no
finding in this batch treats it as such (see "Version sensitivity" below). If
a future re-capture against a different build ever does produce a refusal, the
capture script commits it as its own `<case>-unsupported-<kind>` pair per
`../binmon/cpuhistory-get-unsupported.json`'s model, with a `note` naming both
the missing capability and the binary.

## Version sensitivity

**This tree does NOT import the binary-monitor side's `>= 3.10` version-floor
framing, on purpose.** `CPUHISTORY_GET` (0x86) requires VICE ≥ 3.10 over the
**binary** monitor because the opcode itself does not exist in 3.9's wire
protocol. The **text**-monitor `chis` command is a different capability
entirely: `.planning/notes/text-monitor-channel-live-probe.md` already
measured `chis 4` returning real CPU-history entries with per-entry cycle
counts against genuine stock VICE 3.9, and this batch's own
`cpu-history-stock.txt` reconfirms it. The version floor applies to the
**binary opcode**, never to the **capability**, and no finding in this tree —
or in `39-fixture-batch.md` — states otherwise. Any text-monitor
"opt-out-at-build-time" capability gap (D-20) would be a *build configuration*
question (a specific binary compiled without a specific feature), never a
protocol *version* question the way the binary side's opcode gate is.

## Regenerate, never hand-edit

Hand-editing any `.txt` or `.json` here is never the right move — a fixture
edited to make a test pass silently stops being evidence of anything.
Regenerate the whole batch instead:

```
node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs
```

against both `/usr/bin/x64sc` and `/usr/local/bin/x64sc` present and
executable, with the `vice-broker` user unit `inactive` and no other `x64sc`
process alive (the script's own `preflight()` refuses in code otherwise, per
D-16). The script commits into this directory directly; every fixture pair in
the table above is regenerated by the same single invocation.
