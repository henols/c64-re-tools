# Decisions (from ADR-class sources)

Synthesized by `gsd-doc-synthesizer`. One entry per decision. Every entry carries
its source path. Nothing here is LOCKED — the sole ADR-class source is marked
`Status: proposed`.

Two positions in this file were **superseded by user resolution on 2026-08-11**
(conflicts W1 and W2). Superseded text is retained inline and marked, never
silently dropped. See `.planning/INGEST-CONFLICTS.md` § RESOLVED.

---

## DEC-stock-vice-migration

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** emulator dependency / overall architecture
- **decision:** Drop the custom, non-upstream `x64sc -mcpserver` build and drive an
  unmodified upstream `x64sc` through its binary monitor (`-binarymonitor`, TCP,
  length-prefixed binary protocol).
- **context:** `vice-proxy.ts` today forwards MCP tool calls over HTTP JSON-RPC to a
  `/mcp` endpoint served by the emulator itself, enabled by the non-upstream
  `-mcpserver -mcpserverhost -mcpserverport` flags in `broker-launch.mts`. That
  patched `x64sc` is external to this repo and is the load-bearing dependency.
  Stock VICE has no `-mcpserver` and serves no `/mcp`.
- **consequences:** Runs on stock apt/Homebrew/official VICE builds; no forked
  emulator to build, ship, or maintain; directly furthers the "totally generic"
  goal. Cost: substantial reimplementation of server logic into the client, plus
  capability trade-offs.

## DEC-preserve-mcp-surface

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** MCP tool surface / blast radius
- **decision:** The stdio MCP surface Claude Code sees stays unchanged. The single
  seam to swap is `vice.ts`'s `call()` (plus `vice-sync.ts`). The 63-tool surface
  is preserved in shape.

## DEC-server-logic-moves-client-side

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** architecture / responsibility boundary
- **decision:** Everything the custom `-mcpserver` did *inside* the emulator must
  move **into the new client** as binary-monitor command sequences plus client-side
  derivations.

## DEC-tool-triage-abc

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked) — **AMENDED by user resolution W1, 2026-08-11**
- **scope:** tool-by-tool migration mapping
- **decision:** Triage the 63-tool surface into three groups.
  - **A. Direct (1:1 with a binary-monitor command):** memory read/write
    (0x01/0x02); registers get/set (0x31/0x32); checkpoints add/delete/list/toggle
    (0x11–0x15) + condition (0x22); watchpoints (checkpoint w/ load/store); step
    (0x71); execute-until-return / backtrace aid (0x73, CPU history 0x86); reset
    (0xcc); keyboard typing (feed 0x72); joystick (joyport set 0xa2); snapshots
    (dump/undump 0x41/0x42); autostart PRG/disk; memory banks (0x82); machine
    config / disk attach-detach (resource get/set 0x51/0x52); ping (0x81).
  - **B. Client-side derivation:** memory search/compare/fill; backtrace
    (stack-page walk + SP); checkpoint groups & ignore-count bookkeeping;
    disassemble; symbols load/lookup; sprite get/set/inspect; screenshot PNG.
  - **C. Gaps / must-verify:** cycle stopwatch + run-until-N-cycles; low-level
    keyboard (press/release, matrix, chord, RESTORE/NMI); explicit pause-now;
    `disk_read_sector`; deep internal chip state beyond memory-mapped registers;
    **SID state read-back (hard loss)**; **VIC-II / CIA internal state (partial)**.

### W1 amendment — chip-state read-back (user-resolved 2026-08-11)

- **SUPERSEDED ADR TEXT (group B):** "VIC-II / SID / CIA state (memory-mapped I/O
  at `$D000`/`$D400`/`$DCxx`)" listed as a straightforward client-side derivation.
- **AUTHORITATIVE POSITION:** `docs/stock-vice-parity.md` (DOC) governs this scope.
  - **SID state read-back is a HARD LOSS, not a client-side derivation.** SID
    registers `$D400–$D418` are write-only in hardware; a memory read does not
    return what was written. The binary monitor has no SID command. Voice
    frequency/waveform/ADSR/filter/volume are unrecoverable. Only `$D419–$D41C`
    (paddles, OSC3, ENV3) are readable. `set` still works.
  - **Optional mitigation (NOT full parity):** the client may *shadow* the SID
    writes it issues itself. It can never observe writes made by the running
    program, so shadowing is a partial mitigation and must not be presented as
    restored `vice_sid_get_state` capability.
  - **VIC-II / CIA internal state is PARTIAL.** Only what is in the readable
    register map is available. Truly internal state — raster-IRQ latch, timer
    **latch** vs. current count, internal flip-flops — is not in the register map
    and cannot be read. CIA timer *counts* are readable; their latches are not.
    `MEM_GET` reads without side effects, so it will not clear collision/latch
    registers.
- **effect on the 85–90% estimate:** the ADR's figure counted SID state inside the
  cleanly-porting share. Treat 85–90% as approximate and not re-derived.

## DEC-ship-6502-disassembler

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** `vice_disassemble`
- **decision:** Ship a client-side 6502 disassembler. The binary monitor has no
  disassemble command.

## DEC-client-side-png-screenshots

- **source:** `docs/roadmap-stock-vice.md` (corroborated + refined by
  `docs/phase0-binmon-findings.md`)
- **status:** proposed (not locked)
- **scope:** `vice_display_screenshot`
- **decision:** Obtain the framebuffer via `DISPLAY_GET` (0x84) plus `PALETTE_GET`
  (0x91) and encode the PNG client-side.

## DEC-d64-parsed-client-side

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** `vice_disk_read_sector`
- **decision:** Parse the `.d64` image directly (as already done in the
  `c64-ram-capture` skill's `d64-parse.mjs`) rather than reading sectors through
  the monitor.

## DEC-new-binmon-client-module

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** new code artifacts
- **decision:** Introduce `vice-binmon.ts` as the protocol client, alongside a 6502
  disassembler and a framebuffer-to-PNG encoder.

## DEC-broker-flag-and-concurrency-review

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** `broker-launch.mts` / `vice-broker.mts`
- **decision:** Swap launch flags `-mcpserver…` → `-binarymonitor
  -binarymonitoraddress`, adapt the port model, and review the broker/concurrency
  model because the binary monitor is a **single, stateful TCP connection**.

## DEC-phased-delivery-plan

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked) — plan-of-record, NOT locked requirements
- **scope:** delivery sequencing
- **decision:** Seven phases, Phase 0 first.
  - Phase 0 — De-risk: probe stock `x64sc -binarymonitor` for elapsed cycle count,
    pause/continue model, Display Get format; decide the timing fallback.
  - Phase 1 — Binary-monitor client: TCP framing, request/response correlation,
    async stopped/resumed events, reconnect — behind the existing `call()` seam.
  - Phase 2 — Direct tools (group A).
  - Phase 3 — Derived tools (group B), incl. 6502 disassembler + symbol store.
  - Phase 4 — Screenshot: Display Get + Palette → PNG.
  - Phase 5 — Broker/launcher: flags, port model, single-connection concurrency;
    update tests, `tools-manifest.json` (mark degraded tools), `.mcp.json`, README.
  - Phase 6 — Verify: run the suite against stock `x64sc`; parity-check tool
    outputs vs the current custom server on a sample program.
- **note:** Phase 0 is **complete in analysis** per `docs/phase0-binmon-findings.md`;
  one empirical probe run remains outstanding (see CON-probe-outstanding).

### W2 amendment — Phase 1 wire framing (user-resolved 2026-08-11)

- **SUPERSEDED ADR TEXT (Phase 1):** "TCP framing (STX 0x02, length, cmd,
  request-id, little-endian)" — imprecise paraphrase; wrong field order and no
  `api_version` byte.
- **AUTHORITATIVE POSITION:** `docs/phase0-binmon-findings.md` (SPEC) §5 is
  **NORMATIVE** on binary-monitor wire format. Phase 1 must implement the 11-byte
  request header exactly as given in `CON-wire-request-header`.

## DEC-doability-assessment

- **source:** `docs/roadmap-stock-vice.md`
- **status:** proposed (not locked)
- **scope:** feasibility
- **decision:** Doable. ~85–90% of the surface is direct (A) or straightforward
  client-side derivation (B). Residual risk concentrates in group C — chiefly
  cycle-accurate timing and the run/pause model.
- **note:** Estimate predates the W1 amendment, which moves SID read-back out of
  group B into group C. Not re-derived by any source.
