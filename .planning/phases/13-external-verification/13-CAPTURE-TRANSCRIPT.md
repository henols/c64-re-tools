# Phase 13 Plan 01 — Real-capture transcript for the three VERIF-02 binmon fixtures

This transcript is the evidence record for re-recording `display-get.bin`,
`event-interleaved.bin` and `checkpoint-list.bin` against a real `x64sc`
binary, answering the six numbered acceptance steps in
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`.

## Binary resolution (T-13-01 / D-13-01 / D-13-02 corollary)

The binary was resolved dynamically, never by a hardcoded path:

```
command -v x64sc
```

On this host that resolved to `/usr/local/bin/x64sc` — the **fork** build
(`x64sc (VICE 3.10)`), because the fork shadows genuine stock VICE
(`/usr/bin/x64sc`, VICE 3.9) earlier on `$PATH`. This is expected and
documented project-wide (CLAUDE.md, MEMORY.md): a bare `x64sc` always
resolves to the fork on this machine.

The backend kind was derived in the same shell step, never typed by hand
(T-13-02 mitigation):

```
MCPSERVER_COUNT=$("$X64SC_BIN" --help 2>&1 | grep -c -- "-mcpserver")
# MCPSERVER_COUNT=5 -> CAPTURE_BACKEND_KIND=fork
```

Cross-check against genuine stock for contrast (not used for capture):
`/usr/bin/x64sc --help | grep -c -- "-mcpserver"` returns `0`.

Resolved binary: `/usr/local/bin/x64sc`
Kind: `fork`
`x64sc --version` output: `x64sc (VICE 3.10)`
`VICE_INFO` (0x85) reply decoded `viceVersion`: `3.10.0.0`

## Launch command (verbatim)

```
"$X64SC_BIN" -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```

(`-default` precedes `-binarymonitor`, per the settled project constraint —
reversed order never binds the monitor.) Launched in the background; the
monitor port was confirmed listening (`ss -ltnp | grep 6502`) before any
capture ran.

## Capture commands (verbatim, one process per case)

```
VICE_BINMON=127.0.0.1:6502 VICE_BIN="$X64SC_BIN" CAPTURE_BACKEND_KIND=fork \
  node probe-binmon.mjs --capture display-get

VICE_BINMON=127.0.0.1:6502 VICE_BIN="$X64SC_BIN" CAPTURE_BACKEND_KIND=fork \
  node probe-binmon.mjs --capture event-interleaved

VICE_BINMON=127.0.0.1:6502 VICE_BIN="$X64SC_BIN" CAPTURE_BACKEND_KIND=fork \
  node probe-binmon.mjs --capture checkpoint-list
```

Each ran as its own process — never `--capture all` — so each case's
`BinMon.nextId` sequence started fresh at 1, consumed by `VICE_INFO` (sent by
`runCapture()` before the case runner), leaving id 2 as the case's own first
request id.

## Step 1 — MAX_CAPTURE_FRAMES

No case hit `MAX_CAPTURE_FRAMES` (32). Frame counts: `display-get` 1 frame,
`event-interleaved` 4 frames, `checkpoint-list` 11 frames — all far below the
cap. All three commands printed `OK: <n> frame(s), <n> byte(s)` and none
printed the `ABORTED: reached MAX_CAPTURE_FRAMES` message. Each rewritten
pair on disk (re-read below) is itself the evidence that no case aborted —
an aborted case writes no `.bin` at all.

## Per-case frame tables

Frame header fields decoded per `docs/phase0-binmon-findings.md` §5: STX,
`api_version`, `body_length` (`u32LE` @2), `response_type` @6, `error_code`
@7, `request_id` (`u32LE` @8).

### `display-get.bin` (157281 bytes, 1 frame)

| # | response_type | name | error_code | body_length | request_id |
|---|---|---|---|---|---|
| 0 | 0x84 | DISPLAY_GET | 0x00 | 157269 | 2 |

Total consumed bytes == file length (157281). No trailing bytes.

### `event-interleaved.bin` (94 bytes, 4 frames)

| # | response_type | name | error_code | body_length | request_id |
|---|---|---|---|---|---|
| 0 | 0x71 | (ADVANCE_INSTRUCTIONS reply) | 0x00 | 0 | 2 |
| 1 | 0x63 | RESUMED | 0x00 | 2 | BROADCAST (0xffffffff) |
| 2 | 0x31 | REGISTER_INFO | 0x00 | 42 | BROADCAST (0xffffffff) |
| 3 | 0x62 | STOPPED | 0x00 | 2 | BROADCAST (0xffffffff) |

Total consumed bytes == file length (94). No trailing bytes.

### `checkpoint-list.bin` (320 bytes, 11 frames)

| # | response_type | name | error_code | body_length | request_id | decoded |
|---|---|---|---|---|---|---|
| 0 | 0x11 | CHECKPOINT_INFO | 0x00 | 23 | 2 | id=1 start=0xea31 end=0xea31 stopWhenHit=1 enabled=0 temp=1 |
| 1 | 0x63 | RESUMED | 0x00 | 2 | BROADCAST | — |
| 2 | 0x31 | REGISTER_INFO | 0x00 | 42 | BROADCAST | — |
| 3 | 0x62 | STOPPED | 0x00 | 2 | BROADCAST | — |
| 4 | 0x11 | CHECKPOINT_INFO | 0x00 | 23 | 3 | id=2 start=0xea81 end=0xea81 stopWhenHit=1 enabled=0 temp=1 |
| 5 | 0x63 | RESUMED | 0x00 | 2 | BROADCAST | — |
| 6 | 0x31 | REGISTER_INFO | 0x00 | 42 | BROADCAST | — |
| 7 | 0x62 | STOPPED | 0x00 | 2 | BROADCAST | — |
| 8 | 0x11 | CHECKPOINT_INFO | 0x00 | 23 | 4 | id=1 (checkpoint #1 entry, listed) |
| 9 | 0x11 | CHECKPOINT_INFO | 0x00 | 23 | 4 | id=2 (checkpoint #2 entry, listed) |
| 10 | 0x14 | CHECKPOINT_LIST | 0x00 | 4 | 4 | body hex `02000000` -> `readUInt32LE(0)` = 2 |

Total consumed bytes == file length (320). No trailing bytes.

Request ids embedded, read directly off the committed bytes: the two
`CHECKPOINT_SET` replies are id **2** and id **3** (frames 0 and 4); the
terminal `CHECKPOINT_LIST` reply and the two `CHECKPOINT_INFO` entries that
precede it under the same request all carry id **4** (frames 8, 9, 10). This
matches the predicted numbering exactly (`VICE_INFO` consumes id 1; the
case's own first request is id 2).

## Step 2 — `display-get` geometry diff

Decoded body fields (`infoLen=13`, six `u16LE` fields + 1 `bpp` byte):

| Field | Recorded (`docs/phase1-probe-results.md`) | Real capture | Match |
|---|---|---|---|
| `dw` | 504 | 504 | yes |
| `dh` | 312 | 312 | yes |
| `xo` | 136 | 136 | yes |
| `yo` | 51 | 51 | yes |
| `iw` | 320 | 320 | yes |
| `ih` | 200 | 200 | yes |
| `bpp` | 8 | 8 | yes |

`imageLength` (`buflen` field) decoded as 157248, exactly `dw * dh`
(504 * 312 = 157248), and `4 (infoLenField) + 13 (info) + 4 (buflenField) +
157248 (pixelBuffer) = 157269` matches the frame's declared `body_length`
exactly. **Every geometry field matches the previously recorded probe
reading field-for-field.**

## Step 3 — `event-interleaved` order verdict

Observed arrival order (from the frame table above): the command's own
correlated reply (`0x71`, id 2) arrived **first**, then `RESUMED` (0x63),
then `REGISTER_INFO` (0x31), then `STOPPED` (0x62).

- Against the **retired synthetic model** (the fixture's own retired sidecar
  note: "RESUMED, STOPPED, REGISTER_INFO, then the command's own correlated
  reply"): **differs** — the real order puts the reply first (not last) and
  swaps the STOPPED/REGISTER_INFO order (real: REGISTER_INFO before STOPPED;
  retired model: STOPPED before REGISTER_INFO).
- Against `docs/phase1-probe-results.md` line 248's recorded
  `[RESUMED, REGISTER_INFO, STOPPED]` (and line 262's identical restatement):
  **matches** — the three-event subsequence, in arrival order, is exactly
  `RESUMED, REGISTER_INFO, STOPPED`.

**Verdict: the real event order matches `docs/phase1-probe-results.md` line
248/262's recorded order, and differs from the retired synthetic model.**

## Step 4 — `checkpoint-list` terminator verdict

The terminal frame (frame 10 above) has `response_type = 0x14`
(`CHECKPOINT_LIST`) and `body_length = 4`, with body bytes `02 00 00 00`
decoding as `readUInt32LE(0) = 2` — exactly the count of checkpoints just
listed (the two enabled:0, temp:1 checkpoints this case created and is about
to delete).

`stock-protocol.ts`'s `case ResponseType.CheckpointList` branch calls
`need(body, 4, responseType, requestId)` then reads `total:
body.readUInt32LE(0)`. Both the response-type byte and the 4-byte `u32LE`
count read are exactly what the real bytes contain.

**Verdict: CONFIRMED.** No correction to `stock-protocol.ts` is needed or
made by this plan. (Task 3, per the plan's own instruction for the CONFIRMED
case: `stock-protocol.ts` is left untouched — `git diff --stat
stock-protocol.ts` for this task is empty.)

**This is also the phase's highest-probability contradiction candidate
(per the plan's threat framing), and it did not contradict.**

## Steps 5–6 — binary, kind, version, timestamps, commands

| Case | `capturedFrom` | `viceVersion` | `capturedAt` |
|---|---|---|---|
| `display-get` | `fork:/usr/local/bin/x64sc` | `3.10.0.0` | `2026-08-21T23:02:34.003Z` |
| `event-interleaved` | `fork:/usr/local/bin/x64sc` | `3.10.0.0` | `2026-08-21T23:02:49.774Z` |
| `checkpoint-list` | `fork:/usr/local/bin/x64sc` | `3.10.0.0` | `2026-08-21T23:03:02.766Z` |

Exact capture commands run (one process per case, as listed above under
"Capture commands"):

1. `VICE_BINMON=127.0.0.1:6502 VICE_BIN=/usr/local/bin/x64sc CAPTURE_BACKEND_KIND=fork node probe-binmon.mjs --capture display-get`
2. `VICE_BINMON=127.0.0.1:6502 VICE_BIN=/usr/local/bin/x64sc CAPTURE_BACKEND_KIND=fork node probe-binmon.mjs --capture event-interleaved`
3. `VICE_BINMON=127.0.0.1:6502 VICE_BIN=/usr/local/bin/x64sc CAPTURE_BACKEND_KIND=fork node probe-binmon.mjs --capture checkpoint-list`

## Sidecar re-record confirmation

All three sidecars were read back from disk after the capture run and
independently verified (never accepted on the capture command's exit status
alone, per the plan's own acceptance gate):

```
node -e '... loadCapturedFixture(c) for each case ...'
=> 3/3 sidecars re-recorded
```

Each of the three `.json` files now carries exactly the five required keys
(`capturedFrom`, `viceVersion`, `capturedAt`, `command`, `synthetic`), with
`synthetic: false`, a `capturedFrom` of the form `fork:/usr/local/bin/x64sc`,
and `viceVersion: "3.10.0.0"`.

## Consequence for `stock-protocol.test.ts`'s `correlat:` tests

The two `correlat:` tests' `initialRequestId` values (`checkpoint-list`: 4;
`event-interleaved`: 2) were set against the retired synthetic numbering.
Checked against the real embedded ids recorded above:

- `checkpoint-list`'s terminal `CHECKPOINT_LIST` reply carries request id
  **4** — the existing literal (`initialRequestId: 4`) already matches the
  real bytes. No numeric change was required; Task 3 adds a citing comment.
- `event-interleaved`'s correlated `ADVANCE_INSTRUCTIONS` reply carries
  request id **2** — the existing literal (`initialRequestId: 2`) already
  matches the real bytes. No numeric change was required; Task 3 adds a
  citing comment.

Both numbers happened to already agree with the real capture because the
synthetic model's numbering followed the same "`VICE_INFO` consumes id 1,
the case's own first request is id 2" rule the real capture also follows.
This is a genuine confirmation, not a coincidence to be suspicious of: the
rule was derived from `runCapture()`'s own call order, which is unchanged
between the synthetic authoring pass and this real capture.

## Consequence for `binmon-fixtures.ts` / `binmon-fixtures.test.ts` / README.md

All three fixtures are now real captures (`synthetic: false`), matching the
three `cpuhistory-get*` fixtures already committed by plan 07-12. Task 2
rewrites the module header, the two `WR-10` tests whose premise inverted,
the `WR-09` expectation array, and the README's provenance table and prose
to state this fact in all three places.
