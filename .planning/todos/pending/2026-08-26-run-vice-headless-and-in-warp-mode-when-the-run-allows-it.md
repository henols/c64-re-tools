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
  - src/mcp/vice/resources/broker-launch.mjs:165
  - src/mcp/vice/broker-state.mts:117-141

audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
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
2. **Warp** — **PREMISE CORRECTED 2026-08-28, verified live. Warp is probably
   not a launch-mode dimension at all.** The original argument ran: CLAUDE.md's
   settled constraint says there is no runtime `WarpMode` *resource* on stock
   (`vsync.c:220-241`, deliberate), and `capability-registry.ts:283-285` records
   that the fork advertises a `WarpMode` resource stock does not have — therefore
   warp must be a launch-time `-warp` / `InitialWarpMode` knob expressed per
   backend.

   That constraint is true **of the resource** and says nothing about the monitor
   *command*. VICE's text monitor has a real `warp on` / `warp off` / `warp`
   command, reachable over TCP on the `-remotemonitor` port — which
   `broker-launch.mjs:165` **already appends to every stock launch**, allocating
   and recording the port at `broker-state.mts:139`, with nothing in the tree ever
   dialing it.

   Confirmed live against `/usr/bin/x64sc` (genuine stock, VICE 3.9) on
   2026-08-27: `warp` → `Warp mode is off.`, `warp on`, `warp` → `Warp mode is
   on.`, `warp off`. Full probe evidence in
   `.planning/notes/text-monitor-channel-live-probe.md`; the doc defect that hid
   this is tracked in
   `.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md`.

   **Consequence for this todo:** the expensive part of the design below — making
   launch mode part of warm-instance eligibility, threading a mode field through
   the acquire frame, and deciding what the warm floor pre-warms — was motivated
   largely by warp being un-retrofittable to an already-booted process. Runtime
   `warp on` **is** retrofittable to a warm instance, so it needs none of that.
   Re-scope before planning: **headless is the only genuine launch-mode
   dimension** (a window and an audio device cannot be un-opened after the fact),
   and warp becomes an ordinary runtime operation over the text channel. Whether
   the on-demand-lifecycle half (point 3) still earns its complexity for headless
   alone is an open question this re-scope should answer, not assume.
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
  warp before this is turned on by default anywhere. **This constraint survives the
  2026-08-28 correction unchanged, and gets sharper:** runtime warp means the ratio
  can now change *mid-run*, not only between launches, so the re-check has to cover
  a bracket that starts un-warped and ends warped.
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

- **Re-scope to headless first** (see the correction in point 2). Add an opt-in
  launch-mode input (env knob and/or an acquire-time parameter threaded from
  `vice-broker.mts`'s acquire path) — `VICE_HEADLESS=1` — that `buildViceArgs()`
  reads *in addition to* the backend shape, rather than a `VICE_ARGS` full
  override. **Do not add `VICE_WARP=1`**: stock can flip warp at runtime over the
  text monitor, and so can the fork via its `WarpMode` resource, so warp is a
  runtime operation on both backends rather than a launch flag on either.
  Everything below about mode-aware warm-instance eligibility should be re-read
  asking whether headless alone still justifies it.
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
