---
created: 2026-08-26T12:36:16.314Z
title: Run VICE headless and in warp mode when the run allows it
area: broker
severity: minor
files:
  - src/mcp/vice/broker-launch.mts:153-218
  - src/mcp/vice/broker-launch.mts:850
  - src/mcp/vice/broker-launch.mts:953
  - src/mcp/vice/vice-broker.mts:169
  - src/mcp/vice/vice-broker.mts:401
  - src/mcp/vice/vice-broker.mts:473
  - src/mcp/vice/vice-broker.mts:929
  - src/mcp/vice/vice-broker-client.ts:372
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

Three related capabilities, which is why this is one todo and not three:

1. **Headless** — VICE's `-VICIIdsize`/video and sound flags, or a `-default`-safe
   equivalent, so no window is mapped and no audio device is opened. Needs to be
   established which stock/fork flag combination actually yields a usable
   monitor-only instance (the monitors must still bind).
2. **Warp** — CLAUDE.md's settled constraint says there is **no runtime `WarpMode`
   resource** on stock (`vsync.c:220-241`, deliberate), so warp on stock must be a
   launch-time `-warp` / `InitialWarpMode`. `capability-registry.ts:283-285` already
   records that the fork advertises a `WarpMode` resource stock does not have. That
   asymmetry means the knob has to be expressed at launch, per backend, not as a tool.
3. **On-demand lifecycle, so the mode can be chosen per run** (added 2026-08-26) —
   VICE does not have to be pre-started at all; it should be launched when a run
   needs it, in the mode that run wants, and shut down when the run is done.
   Teardown is already right: `handleRelease()` (`vice-broker.mts:929`) is
   kill-never-recycle — it marks the death deliberate, drops the instance record,
   returns the port and `verifiedKill()`s the pid. The *start* side is the gap, and
   it is structural rather than a missing flag:

   - The warm floor defaults to **1** (`vice-broker.mts:169`,
     `broker-launch.mts:850`, both defaulting to 1 since D-06), so
     `maintainWarmFloor()` (`broker-launch.mts:953`) keeps one `x64sc` alive
     *before any request exists*. That instance was necessarily launched with the
     one fixed argv `buildViceArgs()` emits, i.e. before the mode for the run that
     will eventually claim it is known.
   - `selectWarmInstance()` (`vice-broker.mts:473`) then runs *first* on the
     acquire path, before the cold-launch arm is ever consulted. So a warm
     instance wins the grant, and a caller that asked for headless+warp silently
     gets the interactive real-time instance that was already sitting there.
   - The acquire request has nowhere to say what it wants: the wire frame is
     `{ op: "acquire", id, token }` (`vice-broker-client.ts:372`) — no mode field.

   Net: capabilities 1 and 2 are not implementable as a per-run choice by adding
   flags alone. A mode knob is inert on a warm instance, so the mode has to become
   part of the acquire request *and* part of warm-instance eligibility, or the warm
   floor has to be off for mode-sensitive callers.

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
- A warm instance is a real, already-booted process, so it can never be
  retro-fitted to a mode: the only two honest options are to treat launch mode as
  part of warm-instance eligibility (a mismatched warm candidate is skipped, not
  handed out) or to bypass the warm floor entirely for a mode-sensitive acquire.
  Silently downgrading the caller to whatever was already warm is the one outcome
  to rule out.
- Dropping the warm floor to 0 for these callers gives up what the floor buys —
  a cold launch plus `probeReady` on the request's hot path. That trade is
  acceptable for batch runs (they are already long) but must be a deliberate,
  per-caller choice, not a new global default.
- The single-owner `inFlight` launch guard (synchronous check-and-set, no `await`
  between — it exists because of the 2026-08-01 triple-launch outage and is
  regression-tested) must not be perturbed by adding a mode dimension to the
  launch key.

## Solution

TBD in detail; the shape that fits the existing seams:

- Add an opt-in launch-mode input (env knob and/or an acquire-time parameter threaded
  from `vice-broker.mts`'s acquire path) — something like `VICE_HEADLESS=1` /
  `VICE_WARP=1` — that `buildViceArgs()` reads *in addition to* the backend shape,
  rather than a `VICE_ARGS` full override. Keep the flags backend-specific: the fork
  can also flip warp at runtime, stock cannot.
- Carry the mode on the acquire request itself (a field on the
  `{ op: "acquire", id, token }` frame) so it is per-run rather than per-broker, and
  make `selectWarmInstance()` mode-aware: record each instance's launch mode in its
  instance record, and skip a warm candidate whose mode does not match the request.
  A mode-sensitive acquire that finds no matching warm instance falls through to the
  existing cold-launch arm — which is the on-demand start this todo asks for, with
  `handleRelease()`'s existing kill-never-recycle already supplying the shutdown.
- Decide what the warm floor pre-warms once modes exist. Simplest defensible answer:
  the floor keeps warming the interactive default only, and mode-sensitive callers
  always cold-launch; revisit only if cold-launch latency actually hurts.
- Decide the default: almost certainly still interactive/real-time, with the batch
  callers (live test suites, corpus/capture sweeps) opting in explicitly, so no
  existing interactive session silently loses its window.
- Establish the actual working flag set live against `/usr/bin/x64sc` (genuine stock)
  before committing to it — verify the binary monitor still binds headless, and that
  a checkpoint still fires correctly under warp.
- Cover it in `broker-launch.test.ts` alongside the existing argv-shape assertions,
  keeping the `-default` index-0 / precedes-`-binarymonitor` invariants asserted.
