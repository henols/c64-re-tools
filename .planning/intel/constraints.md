# Constraints

Synthesized by `gsd-doc-synthesizer`. Primary source is the SPEC,
`docs/phase0-binmon-findings.md`, derived by reading VICE source
(`VICE-Team/svn-mirror` @ `master`: `vice/src/monitor/monitor_binary.c`,
`vice/src/monitor/mon_register.c`). Phase 1 applied source-verified corrections
to this file on 2026-08-12; every item below now has a settled status. The
block that was the one remaining unresolved item — renamed to
`CON-probe-resolved` to reflect its settled state — is resolved by the
empirical probe run recorded in `docs/phase1-probe-results.md`.

Two capability constraints (`CON-sid-readback-hard-loss`,
`CON-chip-internal-state-partial`) originate from `docs/stock-vice-parity.md`
(DOC) and are binding here because the user made that document authoritative on
chip-state read-back (resolution W1, 2026-08-11).

Per resolution W2 (2026-08-11), the SPEC is **NORMATIVE** on binary-monitor wire
format; the ADR's looser paraphrase is superseded.

---

## CON-wire-request-header

- **source:** `docs/phase0-binmon-findings.md` §5
- **type:** protocol
- **status:** SETTLED — normative per user resolution W2, 2026-08-11
- **constraint:** Request (client → VICE) is an 11-byte header + body. All
  multi-byte values little-endian.
  - offset 0, size 1 — STX = `0x02`
  - offset 1, size 1 — api_version = `0x02`
  - offset 2, size 4 — body length (not counting header)
  - offset 6, size 4 — request id
  - offset 10, size 1 — command type
  - offset 11, size n — body
- **superseded:** `docs/roadmap-stock-vice.md` Phase 1 paraphrased framing as
  "STX 0x02, length, cmd, request-id" — wrong field order, `api_version` omitted.
  Do not implement against that text.

## CON-wire-response-header

- **source:** `docs/phase0-binmon-findings.md` §5
- **type:** protocol
- **status:** SETTLED — normative per user resolution W2, 2026-08-11
- **constraint:** Response/event (VICE → client) is a 12-byte header + body.
  - offset 0, size 1 — STX = `0x02`
  - offset 1, size 1 — api_version = `0x02`
  - offset 2, size 4 — body length
  - offset 6, size 1 — response type
  - offset 7, size 1 — error code (`0x00` = OK)
  - offset 8, size 4 — request id (`0xffffffff` = async event)
  - offset 12, size n — body

## CON-command-opcode-set

- **source:** `docs/phase0-binmon-findings.md` §5
- **type:** api-contract
- **constraint:** Confirmed command set — `MEM_GET`/`MEM_SET` `0x01`/`0x02`;
  `CHECKPOINT_GET`/`SET`/`DELETE`/`LIST`/`TOGGLE` `0x11`–`0x15`; `CONDITION_SET`
  `0x22`; `REGISTERS_GET`/`SET` `0x31`/`0x32`; `DUMP`/`UNDUMP` `0x41`/`0x42`;
  `RESOURCE_GET`/`SET` `0x51`/`0x52`; `ADVANCE_INSTRUCTIONS` `0x71`;
  `KEYBOARD_FEED` `0x72`; `EXECUTE_UNTIL_RETURN` `0x73`; `PING` `0x81`;
  `BANKS_AVAILABLE` `0x82`; `REGISTERS_AVAILABLE` `0x83`; `DISPLAY_GET` `0x84`;
  `VICE_INFO` `0x85`; `CPUHISTORY_GET` `0x86`; `PALETTE_GET` `0x91`;
  `JOYPORT_SET` `0xa2`; `USERPORT_SET` `0xb2`; `EXIT` `0xaa`; `QUIT` `0xbb`;
  `RESET` `0xcc`; `AUTOSTART` `0xdd`.

## CON-error-codes

- **source:** `docs/phase0-binmon-findings.md` §5
- **type:** api-contract
- **constraint:** `OK 0x00`, `OBJECT_MISSING 0x01`, `INVALID_MEMSPACE 0x02`,
  `INVALID_LENGTH 0x80`, `INVALID_PARAMETER 0x81`, `INVALID_API_VERSION 0x82`,
  `INVALID_TYPE 0x83`, `CMD_FAILURE 0x8f`.

## CON-cpuhistory-schema

- **source:** `docs/phase0-binmon-findings.md` §5
- **type:** schema
- **constraint:** `CPUHISTORY_GET` request body = `memspace` (1 byte, `0x00` =
  main) + `count` (uint32). Response = uint32 entry count, then per entry:
  `item_size` (1) + register block + **cycle (uint64)** + `instr_len` (1) +
  opcode + operands.

## CON-no-monotonic-cycle-register

- **source:** `docs/phase0-binmon-findings.md` §1 (corrected 2026-08-12, Phase 1)
- **type:** protocol
- **constraint:** There is **no monotonic cycle register**. `e_Cycle` (`0x36`) and
  `e_Rasterline` (`0x35`) are not real registers — `mon_register.c` gates them
  with the comment *"these are not actually registers, we need them for the
  conditionals"*. `e_Cycle` is the cycle **within the current raster line**, for
  checkpoint conditions, not elapsed time. However `LIN` and `CYC` **are** present
  in `mon_reg_list_6510` (`mon_register6502.c:57`) and `REGISTERS_GET` (`0x31`)
  does return them, so absolute cycles **can** be reconstructed without CPU
  history: `cycles = frames × 19656 (PAL) + Δ(LIN × 63 + CYC)`, with frame count
  taken from a **non-stopping** exec checkpoint's `hit_count` (bytes 13-16 of the
  `CHECKPOINT_GET`/`CHECKPOINT_INFO` (`0x11`) response). Cost warning: every hit of
  a non-stopping checkpoint fires a synchronous `CHECKPOINT_INFO` event from
  inside the CPU loop (`mon_breakpoint.c:439-535`) — do not place one over a wide
  range for this purpose. Phase 7 chooses between this route and the CPU-history
  route (`CON-stopwatch-via-cpuhistory`) based on measured cost; that choice is
  not pre-decided here.

## CON-stopwatch-via-cpuhistory

- **source:** `docs/phase0-binmon-findings.md` §1 (corrected 2026-08-12, Phase 1)
- **type:** protocol
- **status:** SETTLED — gated by VICE version, not a build-time compile flag
- **constraint:** `CPUHISTORY_GET` (`0x86`) is the stopwatch. Each history entry
  ends with a uint64 absolute clock (`write_uint64(current->cycle, …)` in
  `monitor_binary.c`). Read the newest entry's cycle before and after a run; the
  difference is a cycle-accurate elapsed count.
- **VERSION GATE:** `e_MON_CMD_CPUHISTORY_GET` (`0x86`) requires **VICE ≥ 3.10**.
  `--enable-cpuhistory` is on by default and universally set in distro/CI builds —
  the compile flag is not the risk. Debian/Ubuntu ship VICE 3.9 and lack the
  opcode entirely (`INVALID_TYPE` `0x83`); on ≥3.10 with the feature genuinely
  disabled, expect `CMD_FAILURE` (`0x8f`). Detect via `VICE_INFO` (`0x85`)'s
  version quad. Fallbacks on 3.9: reconstruct via `LIN`/`CYC` + a non-stopping
  frame-count checkpoint (see `CON-no-monotonic-cycle-register`), or wall-clock.

## CON-no-run-for-n-cycles

- **source:** `docs/phase0-binmon-findings.md` §2
- **type:** protocol
- **constraint:** Native execution control is `ADVANCE_INSTRUCTIONS` (`0x71`, step
  N instructions), `EXECUTE_UNTIL_RETURN` (`0x73`), and checkpoints (run resumes
  until a checkpoint hits). There is **no "run for exactly N cycles"** command.
  Implement `vice_run_until` "for N cycles" on top of the CPU-history clock (read
  clock, run, poll) or restrict it to run-until-address.

## CON-display-get-indexed8-only

- **source:** `docs/phase0-binmon-findings.md` §3
- **type:** api-contract
- **constraint:** `DISPLAY_GET` (`0x84`) supports **only**
  `e_DISPLAY_GET_MODE_INDEXED8` (8 bpp palette indices) and requires
  **api_version ≥ 2**. The response carries: debug (uncropped) width/height, inner
  x/y offset, inner width/height, bpp (=8), then `debug_width * debug_height`
  index bytes. Combine with `PALETTE_GET` (`0x91`) to map indices → RGB, then
  encode PNG client-side.

## CON-async-event-demux

- **source:** `docs/phase0-binmon-findings.md` §4 (corrected 2026-08-12, Phase 1)
- **type:** protocol
- **constraint:** The emulator emits **five** unsolicited message types, not
  three, all with request-id `MON_EVENT_ID = 0xffffffff`: `STOPPED` (`0x62`,
  body = 2-byte PC), `RESUMED` (`0x63`, body = 2-byte PC), `JAM` (`0x61`,
  **zero-length body** — `monitor_binary.c:384-394` computes the PC then passes
  `length = 0`, so no PC is sent), `CHECKPOINT_INFO` (`0x11`, emitted on every
  checkpoint hit) and `REGISTER_INFO` (`0x31`, emitted on every monitor open).
  `CHECKPOINT_INFO` and `REGISTER_INFO` **share a response type with a
  legitimate command reply**, so the client **must demultiplex** by request-id
  and must never resolve a pending request with an event. This block is what
  Phase 2's PROTO-03 and PROTO-04 derive from; it must not undercount.

## CON-inbound-byte-halts-machine

- **source:** `docs/phase0-binmon-findings.md` §4 (corrected 2026-08-12, Phase 1)
- **type:** protocol
- **constraint:** `monitor_check_binary()` calls `monitor_startup_trap()` on
  **any inbound byte** (`monitor_binary.c:281`), invoked every vsync from
  `monitor_vsync_hook` (`monitor.c:395`). A bare `PING` (`0x81`) therefore halts
  a free-running machine within roughly one frame and emits `STOPPED` (`0x62`)
  — **no temporary checkpoint is required**. `EXIT` (`0xaa`) resumes. A timeout
  here means no vsync is running, which is itself a `vice-wedge-triage`
  diagnostic signal.

## CON-sid-readback-hard-loss

- **source:** `docs/stock-vice-parity.md` §A.1 — made authoritative on this scope
  by user resolution W1, 2026-08-11
- **type:** nfr (capability)
- **status:** SETTLED
- **constraint:** SID state read-back is a **HARD LOSS**, not a client-side
  derivation. SID registers `$D400–$D418` are **write-only in hardware**, so a
  memory read does not return what was written. The binary monitor exposes no SID
  command and cannot read write-only registers. Voice frequency, waveform, ADSR,
  filter, and volume are **unrecoverable** from memory. Only `$D419–$D41C`
  (paddles, OSC3, ENV3) are readable. Writing (`set`) still works.
- **optional mitigation (NOT full parity):** the client may shadow the SID writes
  it issues itself. It can never observe writes made by the running program.
  Shadowed values must not be presented as a restored `vice_sid_get_state`.
- **supersedes:** `docs/roadmap-stock-vice.md` group B, which listed SID state as
  a memory-mapped client-side derivation.

## CON-chip-internal-state-partial

- **source:** `docs/stock-vice-parity.md` §A.6 — made authoritative on this scope
  by user resolution W1, 2026-08-11
- **type:** nfr (capability)
- **status:** SETTLED
- **constraint:** VIC-II and CIA state read-back is **PARTIAL**. Only what is in
  the readable register map is available. Memory-mapped bits read fine, and
  `MEM_GET` reads **without side effects** so it will not clear collision/latch
  registers. Truly *internal* state — raster-IRQ latch, timer **latch** vs.
  current count, internal flip-flops — is not in the register map and cannot be
  read. Current CIA timer *counts* are readable; their latches are not.
- **supersedes:** `docs/roadmap-stock-vice.md` group B, which listed VIC-II / CIA
  state as a straightforward client-side derivation.

## CON-probe-resolved

- **source:** `docs/phase0-binmon-findings.md` "The empirical probe has been run
  — see docs/phase1-probe-results.md" (corrected 2026-08-12, Phase 1)
- **type:** nfr
- **status:** RESOLVED — see docs/phase1-probe-results.md
- **constraint:** `.claude/mcp/vice/probe-binmon.mjs` has been run against both a
  stock `x64sc -binarymonitor` (VICE 3.9, `/usr/bin/x64sc`) and the barryw fork's
  binary monitor (VICE 3.10, `/usr/local/bin/x64sc`, not a stock 3.10 build). The
  run confirmed connectivity + api version, the `CPUHISTORY_GET` version gate
  (`INVALID_TYPE` on 3.9, success on the fork's 3.10-vintage tree), that
  `DISPLAY_GET` and `PALETTE_GET` work, and demonstrated the async event demux —
  plus resolved or accepted-as-unknown all five items research previously
  flagged UNVERIFIED. Full results, raw output, and one newly-observed anomaly
  (a fork-only checkpoint flood during the `RL`/`CY` fire test) are recorded in
  `docs/phase1-probe-results.md`.
