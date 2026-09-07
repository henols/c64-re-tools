---
created: 2026-09-07T10:05:00.000Z
title: Remove pre-warm; launch VICE only on first request
area: broker
severity: minor
files:
  - src/mcp/vice/broker-launch.mts:1148
  - src/mcp/vice/broker-launch.mts:1277
  - src/mcp/vice/vice-broker.mts:939
  - src/mcp/vice/vice-broker.mts:483
  - src/mcp/vice/vice-broker.mts:680
  - src/mcp/vice/vice-broker.mts:181
  - src/mcp/vice/broker-e2e.test.ts:372
---

## Problem

The broker keeps a warm floor of pre-launched `x64sc` instances so an acquire can be
served from memory instead of waiting on a boot. `VICE_BROKER_WARM_FLOOR` defaults to
**1** (`vice-broker.mts:181` and `broker-launch.mts:1045`, two readers deliberately kept
in lockstep), and `runBrokerPass` (`broker-launch.mts:1277`) runs `serveAcquires()` then
`maintainWarmFloor()` on a `setInterval` at `pollMs` (default 500ms), so the floor is
climbed from broker startup with no acquire in sight.

Three things make that spare much less useful than it looks:

1. **It is ineligible for any profiled request.** `profileEligible()`
   (`vice-broker.mts:483-487`) compares `warp` and `headless` `=== true` on both sides.
   The warm-floor call site (`vice-broker.mts:939-969`) passes **no `profile:` field at
   all**, so every spare is `{}` — unwarped, windowed. An acquire asking for `warp` skips
   it synchronously in `selectWarmInstance()` and falls through to the cold arm anyway.
   The code's own banner above `profileEligible()` states the consequence of the
   alternative: refusing would make *"warp unusable whenever a warm floor exists (the
   default is 1, so: essentially always)"*. So the warm floor helps exactly the requests
   that care least about boot latency, and is structurally useless to a warp-mode capture
   run, which is the case that most wants it.

2. **It is consumed, not shared.** Kill-never-recycle (`handleRelease()`,
   `vice-broker.mts:1034-1067`, CR-02) means a granted spare is killed on release and its
   record deleted. The second concurrent acquire finds no spare and cold-launches.

3. **It competes for the single launch slot.** `maintainWarmFloor` launches at most one
   instance per call and shares the single in-flight owner with cold acquires (D-07
   priority ordering). A warming launch that wins the slot delays nothing today only
   because acquires are served first in the pass.

Meanwhile the resident cost is real: an emulator process alive with no Claude session
attached, for as long as the broker runs (which is a systemd unit here).

Proposal: delete the warm-floor mechanism and launch strictly on demand — the first
acquire cold-launches, exactly as the existing fall-through arm already does.

## Solution

TBD in planning, but the shape is clear:

- Remove `maintainWarmFloor()` (`broker-launch.mts:1148`) and the `"spare"` launch reason.
- Reduce `runBrokerPass()` to `serveAcquires()` plus the launching→ready **promotion**
  step, which is currently step 1 *inside* `maintainWarmFloor` and is NOT warm-floor
  logic — a cold acquire's own instance needs promoting too. Do not delete it along with
  the floor; it has to move, not go.
- Retire `VICE_BROKER_WARM_FLOOR` and both of its readers
  (`vice-broker.mts:181`, `broker-launch.mts:1045`) plus the `warm_floor` field in
  `broker.json`'s config echo and `host_state`'s answer. `VICE_BROKER_MAX` / `atCapacity()`
  stay — the ceiling is a separate concern.
- Decide what `selectWarmInstance()` becomes. It is not purely warm-floor machinery: it
  also carries the grant-time re-probe, the CR-01 concurrent-drop identity recheck, and
  the WR-02 fire-and-forget kill of a dead candidate. With no spares, are there ever
  `ready`-but-ungranted instances left for it to walk? If yes it must survive intact; if
  no, removing it must be argued, not assumed.
- Preserve the two invariants the floor's own comments protect, which are NOT the floor's:
  the synchronous single-owner `inFlight` check-and-set with no `await` between (the
  2026-08-01 triple-launch outage, regression-tested per CLAUDE.md), and the named
  anti-pattern against killing or relaunching preemptively to serve a newer request.
- Update `broker-e2e.test.ts`, which touches `VICE_BROKER_WARM_FLOOR` in ten places
  (`:372`, `:393`, `:496`, `:520`, `:696`, `:704`, `:787`, `:792`, `:914`, `:922`).
  Note that **four of those already set it to `0`** (`:704`, `:792`, `:922`, and the
  comment at `:696`) precisely to isolate port-count and pid-stability assertions from
  warming — so a no-warm broker is already an exercised configuration in the suite, not
  an untested one. Only the two fixtures that set it to `1` and assert the resulting
  instance-directory count (`:393`, `:520`) actually depend on the floor existing.

Open question worth settling first (surfaced in the /gsd-explore session that produced
this todo, not yet answered): is the value being sought from warming **boot latency** or
**grant certainty**? Removing the floor costs latency on the first request and costs
nothing in certainty — the cold arm always works, it just makes you wait. If latency on
warp captures is the real want, the alternative to removal is warming *per profile*
instead, which is a different todo.

## Context

Measured during exploration on 2026-09-07: no broker was running and
`.vice-supervisor/broker.json` was 12 days stale (`heartbeat_at` 2026-08-26T15:34:53Z,
`node_version` v20.19.2 — predating the Node >= 24 requirement), which
`classifyBrokerLivenessLocal` would class as `stale`. So there is currently no observed
resident-emulator cost on this host; the case for removal rests on the profile-
ineligibility argument above, not on a running-process measurement.
