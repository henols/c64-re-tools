---
title: The unclaimed text-monitor channel — live probe against genuine stock VICE 3.9
date: 2026-08-27
context: /gsd-explore — "docs/vice-mcp-ideas.md: what do we have, what can we improve, what ideas can we take"
supersedes_on_scope: .planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md Pitfall 5 (its generalization only, not its narrow claim)
---

# The unclaimed text-monitor channel

## The finding

`broker-launch.mjs:165` already appends `-remotemonitor -remotemonitoraddress
ip4://<host>:<remoteMonitorPort>` to **every stock launch**, and
`broker-state.mts:117-137` allocates and records the second port. Its own banner
says so in capitals:

> NOTHING IN PHASE 3 DIALS THIS PORT -- there is no text-monitor client yet, and
> no protocol code anywhere in this tree opens a socket to it. […] Phase 7, which
> builds the text-monitor client (Phase 2's D-13), is the right place to add a
> `channel: "binary" | "text"` discriminator to `monitorClient`.

Phase 7 became *Cycle Timing and Wedge Triage*. The client was never built. The
port has been opened, allocated, and recorded on every stock instance since
Phase 3, and nothing has ever connected to it.

## What was probed, and how

Launched `/usr/bin/x64sc` — genuine unpatched stock, **VICE 3.9** — directly:

```
/usr/bin/x64sc -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:16502 \
               -remotemonitor -remotemonitoraddress ip4://127.0.0.1:16510
```

Both ports bound (`ss -ltn` confirmed `16502` and `16510` LISTEN). A plain Node
`net` socket to 16510 drove the commands below. Every result in the next section
is **observed output from the real binary**, not a documentation claim.

## Results — all confirmed working on stock 3.9

| Command | Observed |
|---|---|
| `warp` / `warp on` / `warp off` | `Warp mode is off.` → `Warp mode is on.` Runtime warp control, and it reports state |
| `sw` / `stopwatch` | `Stopwatch:   12855025` — raw `clk`, and it advances while the machine runs |
| `chis 4` | Four full history entries **with per-entry cycle counts**: `.C:e5cf  85 CC  STA $CC  A:00 X:00 Y:0a SP:f3 ..-...Z.  12855012` |
| `memmapshow` / `memmapzap` | Per-address `IO ROM RAM` access map; `help` gives the mask bits `ioRWXrwx`, so **execute is a separate bit** for both ROM and RAM. `memmapzap` clears it |
| `prof on` / `prof off` / `prof flat 5` | Real profiler. Self/total cycles per function address, ranked and percentaged |
| `bt` | Reconstructed JSR chain with SP offsets: `e112 -> ffcf [SP +  3] .C:e112  20 CF FF  JSR $FFCF` |
| `io $d020` | VIC-II register dump **plus** decoded semantics: raster cycle/line, IRQ line, `Mode: Standard Text (ECM/BMM/MCM=0/0/0)`, border/BG colors, scroll X/Y, `40x25` |
| `device c:` | `Setting default device to 'Computer'` |
| `r` | Registers including `LIN CYC` **and a `STOPWATCH` column** |
| `bank` | `*default *cpu ram rom io cart` |

Correction to my own probe: `device c` is a syntax error; the accepted spelling
is `device c:`.

## The halt semantics — the one thing that constrains the design

The text monitor **halts the machine on command, exactly like the binary
monitor**. Observed directly: `sw` → `37759176`, then `x` (exit), then ~1.5 s of
wall clock, then `sw` → `39449592`. The counter only advanced across the `x`.

So this is a *second channel needing the same serialization discipline*, not a
free non-pausing side-channel. Anything that claims it must respect the same
one-resume-per-wait invariants `vice-sync.ts` holds for the binary side. The two
servers do coexist — separate `BinaryMonitorServer` / `MonitorServer` resources,
both polled from `monitor_vsync_hook()` — but coexisting is not concurrency.

## Three CLAUDE.md constraints that need re-reading

Each is **literally true as written**. Each is scoped to the binary monitor, and
each has a text-channel remedy. None of the three should be deleted; each should
gain a scoping clause.

1. **"`CPUHISTORY_GET` (0x86) requires VICE ≥ 3.10. Debian trixie/forky/sid and
   all current Ubuntu ship 3.9, which lacks the opcode entirely."** — true of the
   *opcode*. `chis` over the text channel returned CPU history with cycle counts
   on 3.9. The **capability** is not gated on 3.10; only the binary route is.

2. **"There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately).
   Warp control on the stock backend must be launch-time (`-warp` /
   `InitialWarpMode`)."** — true of the *resource*. `warp on` is a monitor
   *command*, not a resource, and it works at runtime. This bears directly on the
   pending todo `2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it`,
   whose whole "warp must be expressed at launch, per backend" argument — and the
   mode-aware-warm-instance complexity that follows from it — rests on this
   constraint. Warp specifically may not need to be a launch-mode dimension at
   all. Headless still does.

3. **"`default_memspace` contamination has no direct remedy over the binary
   monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command
   resets it."** — accurate, and precisely scoped. `device c:` over the text
   channel is the remedy, and `.planning/research/GAINS-PROTOCOL.md` §A.7 already
   said so. Nothing acted on it because nothing dialed the port.

## The defect this explains

`07-RESEARCH.md` Pitfall 5 says the text `stopwatch` is *"reachable only from the
interactive console (`-console`), a wholly separate code path from the
binary-monitor TCP port this client speaks."*

The narrow claim is **correct and should survive**: `monitor_binary.c`'s
`enum t_binary_command` has no execute-monitor-command-text opcode, on any
version. The generalization is **wrong**: the text monitor is reachable over
`-remotemonitor` TCP (`monitor_network.c`), which this repo's own broker launches
for every stock instance. Route 2 in
`.planning/notes/stock-vice-migration-revised-loss-ledger.md` (Loss 5) had it
right; Pitfall 5 contradicted it and Pitfall 5 is what the phase acted on.

Tracked as a todo. See [[runtime-evidence-layer]] and [[host-tool-executor]] for
what claiming the channel is *for*.

## Not probed

Whether a text-channel client and a binary-channel client can be connected
simultaneously without the halt/resume of one corrupting the other's view. The
servers coexist at bind time; interleaved *command* behaviour was not tested and
must be established before any dual-channel controller is designed.
