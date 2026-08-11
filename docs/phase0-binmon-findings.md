# Phase 0 — stock VICE binary-monitor de-risk findings

Authoritative answers to the roadmap's open questions, read directly from VICE's
source (`VICE-Team/svn-mirror` @ `master`): `vice/src/monitor/monitor_binary.c`
and `vice/src/monitor/mon_register.c`. Where a point still needs to be confirmed
against a *specific build*, it is called out as **VERIFY** and covered by the
probe script (`.claude/mcp/vice/probe-binmon.mjs`).

## 1. Cycle stopwatch — RESOLVED: yes, via CPU history

- There is **no monotonic cycle register**. `e_Cycle` (0x36) and `e_Rasterline`
  (0x35) are *not real registers* — `mon_register.c` gates them with the comment
  *"these are not actually registers, we need them for the conditionals"*.
  `e_Cycle` is the cycle **within the current raster line**, for checkpoint
  conditions — not elapsed time. So `REGISTERS_GET` (0x31) cannot be a stopwatch.
- **`CPUHISTORY_GET` (0x86) is the stopwatch.** Each history entry ends with a
  **uint64 absolute clock** (`write_uint64(current->cycle, …)` in
  `monitor_binary.c`). Read the newest entry's cycle before and after a run; the
  difference is a cycle-accurate elapsed count.
- **VERIFY:** CPU history is a *compile-time* feature. If the target `x64sc`
  wasn't built with it, `CPUHISTORY_GET` returns an error or zero entries and the
  stopwatch is unavailable. The probe checks this on the real build. Fallbacks if
  absent: derive cycles by summing per-instruction costs while single-stepping
  (slow), or fall back to wall-clock timing.

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

## 4. Pause / run model — async events, no bare pause

- The emulator emits **unsolicited** events, all with request-id
  `MON_EVENT_ID = 0xffffffff`: `STOPPED` (0x62, body = 2-byte PC), `RESUMED`
  (0x63, body = 2-byte PC), `JAM` (0x61). The client **must demultiplex** these
  from command replies by request-id.
- `EXIT` (0xaa) resumes the emulator. There is **no "pause now" opcode** — to stop
  a free-running machine on demand, set a temporary checkpoint (or open the
  monitor). This is the one real ergonomic wrinkle for `vice_execution_pause`.

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
`count` (uint32). Response: uint32 entry count, then per entry:
`item_size`(1) + register block + **cycle (uint64)** + instr_len(1) + opcode +
operands.

## The one empirical step left

Run `.claude/mcp/vice/probe-binmon.mjs` against a stock `x64sc -binarymonitor`
(this repo's container has no VICE and no display). It confirms, on the real
build: connectivity + api version, whether **CPU history is enabled** (the
stopwatch), that `DISPLAY_GET` works, and demonstrates the async STOPPED/RESUMED
demux. Its result decides the timing-tool design before Phase 1 client code lands.
