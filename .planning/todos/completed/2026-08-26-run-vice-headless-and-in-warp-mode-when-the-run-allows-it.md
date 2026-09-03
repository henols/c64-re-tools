---
created: 2026-08-26T12:36:16.314Z
title: Run VICE headless and in warp mode when the run allows it
area: broker
severity: minor
resolves_phase: 33
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

---

## RESOLVED 2026-09-03 — discharged by the additive acquire `profile` and the warm-instance eligibility rule

**What discharged it, and note that it is the shape this todo's own 2026-08-28 correction asked
for** — additive flags, not a whole-argv override, with headless as the genuine launch-mode
dimension.

- **The additive knob.** `buildViceArgs()` in `src/mcp/vice/broker-launch.mts` grew an optional
  `profile` (`LaunchProfile`), absent by default. `-console` lands at argv **index 1** — pinned by
  an assertion, because at index ≥ 2 the process **dies** headless with
  `Gtk-WARNING: cannot open display:` — and `-warp` immediately before `-binarymonitor`.
  `-default` stays at index 0 ahead of `-binarymonitor`, the ordering invariant this todo's
  constraints section demanded, and the fork branch's argv is byte-identical.
- **The control-plane thread.** `normaliseLaunchProfile()` in
  `src/mcp/vice/broker-control.mts` validates and normalises the profile arriving on the acquire
  frame, so the mode is **per-run** rather than per-broker — the missing mode field this todo
  identified on `{ op: "acquire", id, token }`. `InstanceRecord.profile` in `broker-state.mts`
  records what each live instance was launched with.
- **The eligibility rule, which is the part this todo said was structural.**
  `profileEligible()` in `src/mcp/vice/vice-broker.mts` makes `selectWarmInstance()`
  profile-aware: a warm candidate whose recorded profile does not match the request is
  **skipped**, and a mode-sensitive acquire that finds no match falls through to the existing
  cold-launch arm. So the one outcome this todo asked to rule out — "silently downgrading the
  caller to whatever was already warm" — cannot happen. `handleRelease()`'s existing
  kill-never-recycle supplies the shutdown half, as this todo predicted. The single-owner
  `inFlight` launch guard was not perturbed.
- **Warp, per this todo's own correction, is not the launch dimension it was filed as.** Phase 33
  measured `-warp` **behaviour-neutral under a frame-anchored protocol** on a real autostarted
  release — identical registers, one identical 64K sha256
  (`c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3`), zero differing addresses
  across warped-at-two-jitters and the unwarped run at the same target — and **invalidating for a
  wall-clock-anchored bracket** (1.76× region overshoot on an identical 10 s bracket). `-warp` is
  worth only ~**1.97×** on emulated throughput on this host, and `AUTOSTART` turns warp on by
  itself during a load whatever argv says. `D-17` also re-grounded
  `capability-registry.ts`'s stale warp sentence in the same commit as its generated table: there
  is no runtime `WarpMode` resource at all on stock (measured `err=0x01` OBJECT_MISSING), and
  runtime toggling lives only on the text monitor this project does not dial.

**The outcome line that closes it, and it is the unflattering one.**
**`PROBEREADY_BUDGET: short`** at column 0 of
`.planning/phases/33-…/evidence/33-probeready-warp-console.md`, with
`WARP_TIME_TO_BIND_MS_MAX: 3155` and `CONSOLE_TIME_TO_BIND_MS_MAX: 2385` beside it. This is
precisely the re-check this todo's constraints section demanded before headless or warp is turned
on anywhere, and it came back **short**: against `DEFAULT_PROBE_TIMEOUT_S = 1`
(`BUDGET_RESOLVED_MS 1000`), the observed maxima are `(absent)` **3132 ms**, `{warp}` **3155 ms**,
`{headless}` **2175 ms**, `{warp, headless}` **2385 ms** — every profile over by 1.2–2.2 s.

**What `short` does and does not mean, so this closure is not read as worse than it is.**
`DEFAULT_PROBE_TIMEOUT_S` is a **per-attempt** timeout and `probeReady()` has **no retry loop**
by design: a still-booting instance fails *this* pass and is re-probed on the next, so a slow host
is re-probed rather than starved. `short` therefore means the first probe pass after a cold launch
always misses on this host — it does **not** mean a launch fails or an instance is lost, and the
cost is promotion **latency**, not loss. Critically, **the shortfall is not caused by either new
flag**: the absent profile — the argv a stock launch has always emitted — is already 2.1 s over,
and `-console` *reduces* it.

**The named follow-up, left open deliberately.** The budget was **not** changed by the measuring
plan, for two recorded reasons: it lives in host-bound launcher code whose edit requires a
regenerated `resources/broker-launch.mjs` in the same commit, and a timing change made in the same
breath as the measurement that justifies it is not a measurement. Two candidate responses, neither
taken: raise `DEFAULT_PROBE_TIMEOUT_S`, or leave it and treat the first-pass miss as intended. The
decision **needs a milestone-level owner**, because it trades cold-acquire latency against a probe
that blocks longer on a genuinely dead port — the trade `probeReady`'s own header records being
made deliberately in the other direction. `SCHEMA.md` § 3 and `DECISION-RULE.md` § *Never a gate*
both put this line outside `GATE-01`, so nothing about v0.8.0's verdict waits on it.

Also settled by measurement rather than left as this todo's open question: research's single
`-console` observation of "not bound at 3000 ms" did **not** reproduce —
`CONSOLE_LAUNCHES_MEASURED 10`, `CONSOLE_LAUNCHES_AT_OR_OVER_3000_MS 0`, all ten between 1945 ms
and 2385 ms. That earlier datum stands as what it was labelled: one observation, not a latency.
