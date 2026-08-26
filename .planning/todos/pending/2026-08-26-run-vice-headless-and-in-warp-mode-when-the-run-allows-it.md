---
created: 2026-08-26T12:36:16.314Z
title: Run VICE headless and in warp mode when the run allows it
area: broker
severity: minor
files:
  - src/mcp/vice/broker-launch.mts:153-218
  - src/mcp/vice/vice-broker.mts:401
  - src/mcp/vice/capability-registry.ts:283-285
---

## Problem

Every broker-launched `x64sc` today boots as a full interactive emulator: a real
window, real-time speed, sound. `buildViceArgs()` (`src/mcp/vice/broker-launch.mts:153`)
emits exactly one fixed argv per backend —

- stock: `-default -drive8type 1541 -binarymonitor -binarymonitoraddress ip4://<host>:<port>`
  (plus optional `-remotemonitor`)
- fork: `-mcpserver -mcpserverhost <host> -mcpserverport <port>`

— and neither shape carries any display or speed flag. The only escape hatch is the
`VICE_ARGS` full-override short-circuit at `broker-launch.mts:163`, which replaces the
whole argv (including the monitor flags), so it is unusable as a "add two more flags"
knob.

That is the right default for interactive reverse-engineering, where a human is
watching the screen. It is the wrong default for the large share of runs where nobody
looks at the window and wall-clock time is the cost: the live test suites, corpus
sweeps, `vice_run_until` / checkpoint-wait brackets, depack-and-capture RAM runs,
and any CI-ish batch. Those pay real-time emulation speed and open a window on the
host's display for no benefit — and they cannot run at all on a display-less host.

Two related capabilities, which is why this is one todo and not two:

1. **Headless** — VICE's `-VICIIdsize`/video and sound flags, or a `-default`-safe
   equivalent, so no window is mapped and no audio device is opened. Needs to be
   established which stock/fork flag combination actually yields a usable
   monitor-only instance (the monitors must still bind).
2. **Warp** — CLAUDE.md's settled constraint says there is **no runtime `WarpMode`
   resource** on stock (`vsync.c:220-241`, deliberate), so warp on stock must be a
   launch-time `-warp` / `InitialWarpMode`. `capability-registry.ts:283-285` already
   records that the fork advertises a `WarpMode` resource stock does not have. That
   asymmetry means the knob has to be expressed at launch, per backend, not as a tool.

Constraints any implementation has to respect:

- `-default` must stay at index 0 on stock, and must precede `-binarymonitor`, or the
  monitor never binds and the connect hangs in the backlog looking exactly like a
  wedge. Any new flag has to be inserted *after* `-default`, not before.
- Warp changes the emulator's wall-clock-to-cycle ratio, so anything that measures or
  waits on real time — broker probe timeouts (`probeReady`), `VICE_MCP_TIMEOUT_MS`,
  the checkpoint-wait poll loops in `vice-sync.ts` — needs to be re-checked under
  warp before this is turned on by default anywhere.
- `vice-sync.ts`'s invariants (exactly one resume per wait; poll on `hit_count`,
  never on paused state) are deliberately untested and must survive the change.

## Solution

TBD in detail; the shape that fits the existing seams:

- Add an opt-in launch-mode input (env knob and/or an acquire-time parameter threaded
  from `vice-broker.mts`'s acquire path) — something like `VICE_HEADLESS=1` /
  `VICE_WARP=1` — that `buildViceArgs()` reads *in addition to* the backend shape,
  rather than a `VICE_ARGS` full override. Keep the flags backend-specific: the fork
  can also flip warp at runtime, stock cannot.
- Decide the default: almost certainly still interactive/real-time, with the batch
  callers (live test suites, corpus/capture sweeps) opting in explicitly, so no
  existing interactive session silently loses its window.
- Establish the actual working flag set live against `/usr/bin/x64sc` (genuine stock)
  before committing to it — verify the binary monitor still binds headless, and that
  a checkpoint still fires correctly under warp.
- Cover it in `broker-launch.test.ts` alongside the existing argv-shape assertions,
  keeping the `-default` index-0 / precedes-`-binarymonitor` invariants asserted.
