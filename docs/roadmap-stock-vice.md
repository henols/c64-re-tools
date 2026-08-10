# Roadmap: move c64-re-tools onto **stock** VICE

> Status: proposed. This document is the reference for the migration; the actual
> work happens on a dedicated implementation branch.

## The core finding (why this matters)

Today the tooling does **not** run on stock VICE. `vice-proxy.ts` forwards MCP tool
calls over **HTTP JSON-RPC to a `/mcp` endpoint that the emulator itself serves**,
started with a **non-upstream `-mcpserver` flag** (`broker-launch.mts`:
`-mcpserver -mcpserverhost <ip> -mcpserverport <port>`). That `-mcpserver`-capable
`x64sc` is a **custom/patched build, external to this repo** — it is the load-bearing
dependency.

Stock upstream VICE has no `-mcpserver` and serves no `/mcp`. It exposes two remote
interfaces: the **binary monitor** (`-binarymonitor`, TCP, length-prefixed binary
protocol) and the text remote monitor (`-remotemonitor`). Neither is used today
(zero non-fixture references in the tree).

**"Go to stock VICE" = drop the custom `-mcpserver` dependency and drive an
unmodified `x64sc` through its binary monitor.**
Ref: [VICE Manual §13 — Binary monitor](https://vice-emu.sourceforge.io/vice_13.html).

## What changes (architecture)

- **Today:** `vice-proxy` (stdio MCP for Claude) → `call()` HTTP-MCP seam (`vice.ts`)
  → custom `x64sc -mcpserver` (HTTP `/mcp`).
- **Target:** `vice-proxy` (stdio MCP, unchanged) → **new binary-monitor client**
  (TCP, VICE binary protocol) → **stock `x64sc -binarymonitor`**.
- The stdio MCP surface Claude Code sees is unchanged. The one seam to swap is
  `vice.ts`'s `call()` (+ `vice-sync.ts`). Broker flags change in `broker-launch.mts`.
- **Key implication:** everything the custom `-mcpserver` did *inside* the emulator
  must move **into the new client** as command sequences + client-side derivations.

## Tool-by-tool mapping (63-tool surface → stock binary monitor)

**A. Direct (1:1 with a binary-monitor command) — safe**
memory read/write (0x01/0x02) · registers get/set (0x31/0x32) · checkpoints
add/delete/list/toggle (0x11–0x15) + condition (0x22) · watchpoints (checkpoint w/
load/store) · step (0x71) · execute-until-return / backtrace aid (0x73, CPU history
0x86) · reset (0xcc) · keyboard typing (feed 0x72) · joystick (joyport set 0xa2) ·
snapshots (dump/undump 0x41/0x42) · autostart PRG/disk · memory banks (0x82) ·
machine config / disk attach-detach (resource get/set 0x51/0x52) · ping (0x81).

**B. Client-side derivation (compose over A; the custom server did these, we reimplement)**
memory search / compare / fill · backtrace (stack-page walk + SP) · checkpoint
groups & ignore-count (bookkeeping) · disassemble (**ship a 6502 disassembler** —
binary monitor has none) · symbols load/lookup (pure client state) · sprite
get/set/inspect · VIC-II / SID / CIA state (memory-mapped I/O at $D000/$D400/$DCxx) ·
screenshot PNG (**Display Get 0x84 framebuffer + Palette 0x91 → encode PNG
client-side**).

**C. Gaps / must-verify**
- **Cycle stopwatch + run-until-N-cycles** (`vice_cycles_stopwatch`, `vice_run_until`
  "for N cycles"): whether the stock binary monitor exposes an **elapsed CPU cycle
  count** is **unconfirmed** (VICE manual was egress-blocked during research). If
  absent → degrade to instruction-count / wall-clock, or support run-until-*address*
  only. **This is the #1 de-risk item.**
- **Low-level keyboard** (key press/release, matrix, chord, RESTORE/NMI): feed (0x72)
  injects text only; holds/matrix/NMI likely unsupported → partial/degraded.
- **Explicit pause-now**: binary monitor stop/continue is monitor-entry/checkpoint
  driven; "pause on demand" needs a workaround (temp checkpoint / monitor open).
- **disk_read_sector**: parse the `.d64` directly (already done in the
  `c64-ram-capture` skill's `d64-parse.mjs`), not via the monitor.
- **Deep internal chip state** beyond memory-mapped registers: not exposed.

## Doability

**Yes — doable.** ~85–90% of the surface is either direct (A) or a straightforward
client-side derivation (B). It is an engineering effort, not a research dead-end.
Residual risk concentrates in group C — chiefly cycle-accurate timing and the
run/pause model.

## What it buys you

- Runs on **unmodified upstream VICE** (apt / Homebrew / official builds) — no forked
  emulator to build, ship, or maintain. Anyone can `npx @henols/c64-re-tools` + install
  stock VICE and go. Directly furthers the "totally generic" goal.
- **Costs:** substantial reimplementation (server logic → client); a few capability
  trade-offs (timing, low-level keys); the binary monitor is a **single, stateful TCP
  connection**, so the broker/concurrency model needs review.

## Phased plan

- **Phase 0 — De-risk (do first):** probe a stock `x64sc -binarymonitor` for (a) elapsed
  cycle count, (b) the pause/continue model, (c) Display Get format. Decide the timing
  fallback. Small throwaway TCP probe.
- **Phase 1 — Binary-monitor client:** TCP framing (STX 0x02, length, cmd, request-id,
  little-endian), request/response correlation, async stopped/resumed events, reconnect
  — behind the existing `call()` seam so the rest of the tree is untouched.
- **Phase 2 — Direct tools (group A).**
- **Phase 3 — Derived tools (group B):** incl. the 6502 disassembler + symbol store.
- **Phase 4 — Screenshot:** Display Get + Palette → PNG.
- **Phase 5 — Broker/launcher:** swap `-mcpserver…` → `-binarymonitor -binarymonitoraddress`,
  adapt the port model, review single-connection concurrency; update tests,
  `tools-manifest.json` (mark degraded tools), `.mcp.json`, README.
- **Phase 6 — Verify:** run the suite against stock `x64sc`; parity-check tool outputs
  vs the current custom server on a sample program.

## Critical files

- `.claude/mcp/vice/vice.ts` — the `call()` seam (swap HTTP-MCP → binary-monitor client)
- `.claude/mcp/vice/vice-proxy.ts` — `forwardToVice`, per-tool translation, gap handling
- `.claude/mcp/vice/vice-sync.ts` — checkpoint sync built on `call()`
- `.claude/mcp/vice/broker-launch.mts`, `vice-broker.mts` — launch flags + ports
- `resources/` (regenerated `.mjs`), `.mcp.json`, `tools-manifest.json`, `README.md`
- **New:** `vice-binmon.ts` (protocol client) · a 6502 disassembler · framebuffer→PNG encoder

## Verification

- Phase-0 probe result (cycle count + pause model) recorded before further work.
- Unit tests for the binary-monitor client against recorded/stubbed protocol frames.
- End-to-end: launch stock `x64sc -binarymonitor`, drive the MCP tools, diff outputs
  against the current `-mcpserver` behavior for a known program.
