# Phase 0 — stock VICE binary-monitor de-risk findings

Authoritative answers to the roadmap's open questions, read directly from VICE's
source (`VICE-Team/svn-mirror` @ `master`): `vice/src/monitor/monitor_binary.c`
and `vice/src/monitor/mon_register.c`. Where a point still needs to be confirmed
against a *specific build*, it is called out as **VERIFY** and covered by the
probe script (`.claude/mcp/vice/probe-binmon.mjs`).

## 1. Cycle stopwatch — RESOLVED: yes, via CPU history (plus a reconstructible fallback)

- There is **no monotonic cycle register**. `e_Cycle` (0x36) and `e_Rasterline`
  (0x35) are *not real registers* — `mon_register.c` gates them with the comment
  *"these are not actually registers, we need them for the conditionals"*.
  `e_Cycle` is the cycle **within the current raster line**, for checkpoint
  conditions — not elapsed time, and it is not monotonic.
- **`REGISTERS_GET` (0x31) does return `LIN`/`CYC`.** Both are present in
  `mon_reg_list_6510` (`mon_register6502.c:57`), so a plain `REGISTERS_GET` call
  sources them. The point that survives is only that neither is monotonic on its
  own — `CYC` is cycle-within-raster-line, same as above. Absolute elapsed
  cycles can be reconstructed client-side without CPU history:
  `cycles = frames * 19656 (PAL) + Δ(LIN * 63 + CYC)`, with the frame count read
  from a **non-stopping** exec checkpoint at `$EA31`, taking `hit_count` from
  bytes 13–16 of the `CHECKPOINT_INFO` (0x11) response. **Cost warning:** every
  hit of a non-stopping checkpoint fires a synchronous `CHECKPOINT_INFO` frame
  from inside the CPU loop (`mon_breakpoint.c:439-535`), so a non-stopping
  checkpoint over a wide address range is dangerous — this reconstruction uses a
  single frame-boundary address, not a range, but the hazard applies to any
  other non-stopping checkpoint the client adds alongside it.

  **SUPERSEDED (Phase 7, 2026-08-18):** this frame-counter fallback is rejected,
  not merely costed. A frame-boundary exec checkpoint at `$EA31` fires
  ~50.1 times/second on PAL and ~59.8 times/second on NTSC — and this client's
  own D-11 trace-hazard guard caps a non-stopping checkpoint at
  `TRACE_HITS_PER_SECOND_LIMIT = 20` hits/second (`stock-checkpoints.ts`),
  sending its own `CHECKPOINT_TOGGLE` with `enabled:false` once that count is
  exceeded. The checkpoint this fallback depends on therefore auto-disables
  roughly 0.4-0.5 real seconds into any bracket, silently truncating the frame
  count the reconstruction needs. The guard is a safety mechanism this project
  deliberately built; a stopwatch design that fights it is a stopwatch built
  against its own codebase. Two routes replace it: **Route A**,
  `CPUHISTORY_GET`'s per-entry monotonic uint64 cycle field, on VICE >= 3.10;
  **Route B** below 3.10, `LIN`/`CYC` frame-position reconstruction that
  reports an exact delta only when no wraparound is detected and **refuses
  explicitly** — never returning zero and never guessing a
  `+ k * cyclesPerFrame` correction — when a frame boundary is proven crossed.
- This reconstruction route was considered as a second stopwatch alongside CPU
  history, but is not always available — see the SUPERSEDED note above. Phase 7
  did not pick between the two routes with measured socket cost; it rejected
  the frame-counter fallback outright and routes exclusively through Route A
  (`CPUHISTORY_GET`) or Route B (`LIN`/`CYC` reconstruction with explicit
  refusal on a crossed frame boundary), per VICE version. This document still
  correctly states that `REGISTERS_GET` can source `LIN`/`CYC` cycle data; it
  no longer proposes building a frame-counter stopwatch from it.
- **`CPUHISTORY_GET` (0x86) is the other stopwatch route.** Each history entry
  carries a **uint64 absolute clock** (`write_uint64(current->cycle, …)` in
  `monitor_binary.c`), followed by `instruction_length` and the instruction
  bytes — the cycle is **not** the last field of an entry. Read the **newest**
  entry's cycle before and after a run; the difference is a cycle-accurate
  elapsed count. **The newest entry is the LAST element of the returned array,
  not the first** — entries arrive oldest-first (proven 2026-08-18 against
  `fixtures/binmon/cpuhistory-get-multi.bin`, four entries with strictly
  ascending cycles). See §5's corrected response layout below for the exact
  wire shape.
- **VERIFY — the availability gate is the VICE version, not a build flag.**
  `--enable-cpuhistory` is on by default (`configure.ac:120,521`), and Debian,
  Ubuntu, Homebrew and official VICE CI all build with it — whether the feature
  was compiled in is not the risk. The real gate is `e_MON_CMD_CPUHISTORY_GET`
  (`0x86`), which exists only in **VICE >= 3.10** (VICE manual §13, "Minimum
  VICE version: 3.10"); Debian trixie/forky/sid and all current Ubuntu ship 3.9,
  whose `monitor_binary.c` has no `0x86` case at all. Two distinguishable
  failures: the opcode absent entirely (VICE < 3.10) returns `INVALID_TYPE`
  (`0x83`); the opcode present but the feature genuinely disabled on a >= 3.10
  build returns `CMD_FAILURE` (`0x8f`). Detect capability via `VICE_INFO`
  (0x85)'s 4-byte version quad, never the SVN revision field, which is zeros in
  distro builds. The probe records which of the two error codes appears on a
  given build; it does not decide whether the feature was compiled in.
- Checkpoint *conditions* use a different, uppercase-only token pair: `RL`
  (raster line) and `CY` (cycle within line) — **not** the `REGISTERS_GET`
  names `LIN`/`CYC`, which lex as `BANKNAME` in `COND_MODE` and produce a
  syntax error (`0x8f`, no diagnostic body) (`mon_lex.l:559-560`). Conditions
  have **no operator precedence** (`mon_parse.y:168`), so
  `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is
  always false — parenthesise every comparison. Bare integer literals are
  **hex by default** (`monitor.c:1597`), so `RL == 100` means line 256, not
  100.

## 2. run-until-N-cycles — native only for run-until-*address*

Native execution control is: `ADVANCE_INSTRUCTIONS` (0x71, step N instructions),
`EXECUTE_UNTIL_RETURN` (0x73), and checkpoints (run resumes until a checkpoint
hits). There is **no "run for exactly N cycles"** command. Implement
`vice_run_until` "for N cycles" on top of the CPU-history clock (read clock, run,
poll) or restrict it to run-until-address.

## 3. Screenshot — INDEXED8 framebuffer + palette, encode PNG client-side

`DISPLAY_GET` (0x84) supports **only** `e_DISPLAY_GET_MODE_INDEXED8` (8 bpp
palette indices) and requires **api_version ≥ 2**. The response carries: debug
(uncropped) width/height, inner x/y offset, inner width/height, bpp (=8), then
`debug_width * debug_height` index bytes. Combine with `PALETTE_GET` (0x91) to map
indices → RGB, then encode a PNG in the client. (The old `-mcpserver` returned a
ready image; that conversion now moves client-side.)

## 4. Pause / run model — any inbound byte halts the machine

- The emulator emits **five** unsolicited event types, all at request-id
  `MON_EVENT_ID = 0xffffffff`: `STOPPED` (0x62, body = 2-byte PC), `RESUMED`
  (0x63, body = 2-byte PC), `JAM` (0x61, **zero-length body** —
  `monitor_binary.c:384-394` computes the PC but then passes `length = 0`, so
  no PC is sent; every client surveyed that assumes a 2-byte body breaks on
  it), `CHECKPOINT_INFO` (0x11, emitted on every checkpoint hit), and
  `REGISTER_INFO` (0x31, emitted on every monitor open). The last two **share
  a response type with a legitimate command reply**, so the client's
  demultiplexer must key on request-id and must never resolve a pending
  request with an event.
- `monitor_check_binary()` calls `monitor_startup_trap()` on **any inbound
  byte** (`monitor_binary.c:281`), and that check runs every vsync from
  `monitor_vsync_hook` (`monitor.c:395`). A bare `PING` (0x81) therefore halts
  the machine within roughly one frame and emits `STOPPED` (0x62) — no
  temporary checkpoint is required to stop a free-running machine on demand.
  Corollary: if there is no vsync because the host UI is paused or hung, the
  command times out, which is itself a `vice-wedge-triage` diagnostic signal
  rather than a protocol failure. `EXIT` (0xaa) still resumes the emulator.

## 5. Wire format (for the Phase-1 client)

All multi-byte values little-endian.

**Request (client → VICE), 11-byte header + body:**

| off | size | field |
|----:|-----:|-------|
| 0 | 1 | STX = `0x02` |
| 1 | 1 | api_version = `0x02` |
| 2 | 4 | body length (not counting header) |
| 6 | 4 | request id |
| 10 | 1 | command type |
| 11 | n | body |

**Response / event (VICE → client), 12-byte header + body:**

| off | size | field |
|----:|-----:|-------|
| 0 | 1 | STX = `0x02` |
| 1 | 1 | api_version = `0x02` |
| 2 | 4 | body length |
| 6 | 1 | response type |
| 7 | 1 | error code (`0x00` = OK) |
| 8 | 4 | request id (`0xffffffff` = async event) |
| 12 | n | body |

**Confirmed command set:** MEM_GET/SET `0x01/0x02`; CHECKPOINT
GET/SET/DELETE/LIST/TOGGLE `0x11–0x15`; CONDITION_SET `0x22`; REGISTERS
GET/SET `0x31/0x32`; DUMP/UNDUMP `0x41/0x42`; RESOURCE GET/SET `0x51/0x52`;
ADVANCE_INSTRUCTIONS `0x71`; KEYBOARD_FEED `0x72`; EXECUTE_UNTIL_RETURN `0x73`;
PING `0x81`; BANKS_AVAILABLE `0x82`; REGISTERS_AVAILABLE `0x83`; DISPLAY_GET
`0x84`; VICE_INFO `0x85`; CPUHISTORY_GET `0x86`; PALETTE_GET `0x91`; JOYPORT_SET
`0xa2`; USERPORT_SET `0xb2`; EXIT `0xaa`; QUIT `0xbb`; RESET `0xcc`; AUTOSTART
`0xdd`. Error codes: OK `0x00`, OBJECT_MISSING `0x01`, INVALID_MEMSPACE `0x02`,
INVALID_LENGTH `0x80`, INVALID_PARAMETER `0x81`, INVALID_API_VERSION `0x82`,
INVALID_TYPE `0x83`, CMD_FAILURE `0x8f`.

**`CPUHISTORY_GET` request body:** `memspace` (1 byte, `0x00` = main) +
`count` (uint32).

**`CPUHISTORY_GET` response body (CORRECTED 2026-08-18, plan 07-12 — re-derived
from `monitor_binary_process_cpuhistory()` and verified byte-by-byte against
`.claude/mcp/vice/fixtures/binmon/cpuhistory-get.bin` and
`cpuhistory-get-multi.bin`, both genuine captures from VICE 3.10):**

```
count(u32LE), then per entry:
  item_size(1)          -- the byte count of EVERYTHING AFTER this byte, so the
                           entry stride is item_size + 1. It is NOT the
                           register-block length alone.
  regCount(u16LE)       -- number of register items that follow
  regCount x { size(1), id(1), value(u16LE) }
  cycle(u64LE)
  instruction_length(1) -- a hardcoded 4 in VICE, never a decoded instruction
                           size
  instruction_length bytes of instruction data (opcode, p1, p2, and a trailing
  placeholder byte for a third parameter that exists on some machines)
```

Entries arrive **OLDEST-first**: `entries[count-1]` is the newest, so a
stopwatch must index from the END of the array, never `entries[0]`.

The earlier wording in this section — `item_size`(1) + register block + cycle +
instr_len + opcode + operands, read as "`item_size` denotes the raw
register-block byte count alone", with "read the *newest* entry" and no
statement of the ordering — was **disproven live** and produced a real decode
bug (07-VERIFICATION.md gap 1: a genuine 52-byte reply was rejected as
"needs at least 65", which in turn killed the connect handshake). Do not
restore it. The authoritative implementations are
`.claude/mcp/vice/stock-protocol.ts`'s `ResponseType.CpuHistoryGet` parse branch
and its hostile-input regressions in `stock-protocol.test.ts`; this section and
those must be changed together.

## The empirical probe has been run — see docs/phase1-probe-results.md

`.claude/mcp/vice/probe-binmon.mjs` has been run against both a stock `x64sc
-binarymonitor` (VICE 3.9, `/usr/bin/x64sc`) and the barryw fork's binary monitor
(VICE 3.10, `/usr/local/bin/x64sc`, not a stock 3.10 build — see the recorded
caveat). The full run, including raw output and per-item dispositions, is
recorded in `docs/phase1-probe-results.md`. In short: it confirmed the
`CPUHISTORY_GET` version gate (`INVALID_TYPE` on 3.9, success on the 3.10-vintage
fork), the `RL`/`CY` condition acceptance-and-firing behaviour, `PALETTE_GET`'s
16-entry table, and `DISPLAY_GET`'s geometry — and it surfaced one new anomaly
(a fork-only checkpoint-flood observed during the `RL`/`CY` fire test) that is
recorded there rather than silently absorbed.
