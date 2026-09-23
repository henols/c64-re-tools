---
title: A cold-launched broker instance's first relay attach races the real emulator's own startup, and the broker's kill-never-recycle release policy kills the still-booting process on that race's failure
date: 2026-09-23
priority: high
source: plan 64-11's own live check (systemd-run broker, absolute /usr/bin/x64sc, real vice-proxy.ts over stdio, and independently through a real nested Claude Code session)
---

# What

Plan 64-11's live check (G-64-1's own truth, run against a real broker and
real `/usr/bin/x64sc` after plans 64-08/64-09/64-10 closed G-64-1's two
root causes) found a THIRD, independent, previously-undiscovered defect:
the very first stock tool call against a freshly cold-started broker (no
warm instance already in the pool) fails almost every time, with:

```
vice_ping: stock handshake failed (binary monitor connection closed/errored with 1 request(s) abandoned).
```

Measured 11 consecutive failures in one scripted session before any call
succeeded; independently reproduced through a real, separate, nested
`claude -p` session (its own first `vice_ping` attempt failed identically;
a second attempt, per the prompt's own retry instruction, succeeded).

# Root cause, precisely traced

The emulator itself is healthy — a direct, attach-free probe
(`session.acquire()` alone, no relay dial) found the freshly-spawned
process alive continuously from 4ms to past 3000ms after acquire returned,
and a standalone timing measurement (identical argv) found the real
binary-monitor bind completing in as little as 71ms. The emulator is not
what fails.

What kills it: `handleAcquire()`'s cold-launch arm
(`src/mcp/vice/vice-broker.mts:824`, `record.state = "granted"` at
`vice-broker.mts:943`) returns the grant to the client IMMEDIATELY once the
process is spawned, with no wait or probe for the binary monitor to be
listening. `handleMonitorClaim()` (`vice-broker.mts:1034`) and
`handleRelayAttach()` (`vice-broker.mts:1422`) both proceed with no
readiness check either. `spliceRelay()`
(`src/mcp/vice/broker-relay.mts:327-329`) dials the freshly-spawned
emulator's own binary-monitor port IMMEDIATELY (`netConnect({host,port})`),
with no retry and no backoff. Against a real, slow-booting `x64sc` this
dial usually loses the race and fails with `relay_error`. The client's own
error handling then releases the grant, and `handleRelease()`
(`vice-broker.mts:1774`) — kill-never-recycle by design (comment at
`vice-broker.mts:1834`: "this instance is gone for good") —
`verifiedKill()`s the STILL-BOOTING process outright, before it ever gets
the chance to finish starting.

`vice-proxy.ts:797-810`'s own `brokerWarmingMessage()` comment states the
INTENDED design: *"A cold x64sc launch plus boot plus readiness is
seconds... the correct next action is simply to retry the SAME call... it
should succeed once the instance finishes booting."* No code path
currently implements that wait; the `deadline`/"warming" outcome that
comment describes exists only for the control-plane's own request/response
timeout, a different and narrower case. `vice-proxy.ts:862-870`'s own
comment confirms directly: "stock has no equivalent probe-then-replace step
at this proxy layer." Consequence: "retry the same call" does not converge
by itself, because every retry cold-launches a BRAND NEW instance (the
previous one was just killed by the failed retry's own release) and races
the identical narrow window against the identical boot time. It took
between 2 and 46 retries across several runs in plan 64-11's own testing
for one to land by chance.

# Why every existing test missed this

Every existing regression suite — including plan 64-08's own G-64-1
tracer/transfer/text tests — stands in for the emulator with a stub TCP
server that binds its port synchronously, before the broker's own "spawn"
call even returns. This defect is invisible to any fixture that binds
before it is dialled; only a genuinely slow-starting real emulator process
exercises the race at all.

# Suggested remedy shape (not decided here — plan 64-11 is prohibited from
editing production code)

Two shapes were visible during the investigation, neither implemented:
(a) `handleAcquire()`'s cold arm waits for (or the client polls for) a
readiness probe before returning/using the grant, closing the gap where it
is opened; or (b) `spliceRelay()`'s first dial retries with a short bounded
backoff before reporting `relay_error`, so a normal boot-time race
self-heals without ever reaching `handleRelease()`'s kill path. Either
requires a decision about where the wait belongs and how long is
reasonable — out of scope for a todo to prescribe.

# Evidence

`.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md`
("Live defect 1") — full reproduction, code citations, and the isolation
proof that the emulator process itself is healthy.
