---
created: 2026-09-09T20:05:00.000Z
title: io's per-chip degradation check reads a binary-wide cached probe verdict
area: text-channel
severity: major
files:

  - src/mcp/vice/text-tools.ts:626
  - src/mcp/vice/text-capability-probe.ts:415-441
  - src/mcp/vice/text-capability-probe.ts:383
---

## Problem

Disposition of **CR-02** from `42-REVIEW.md` (phase 42, re-review dated
2026-09-09T19:52:54Z). Recorded as **open**, not closed: it is a real defect, it
is **pre-existing** rather than introduced by phase 42's gap-closure round, and
closing it needs a behavioural code change that was outside that round's scope.

`handleIoRegisters` classifies each `io` response for VICE's own per-chip runtime
degradation strings by calling:

```ts
const verdict = await probeTextCapability({ command: "io", identity, brokerIdentity, dial: async () => response });
```

`probeTextCapability()` caches on `(textCapabilityCacheKey(identity), command)`.
The `command` passed here is the **literal `"io"`**, not the address-specific
command the handler actually dialed (`built.command`, e.g. `io $d020`). On a cache
hit the function returns the stored verdict and **never calls `dial`**, so the
response that just came back over the wire is never classified.

That is a category error rather than a tuning problem. `memmapshow` and `chis`
capability is a genuine build-time property of the binary, so caching it
binary-wide is correct. `io`'s degradation is **per chip**, decided by the
caller's `address` argument — a fact `CLAUDE.md` records ("one degrades per-chip
at runtime instead of refusing") and the handler's own comment restates ("it is
what additionally catches io's own per-chip runtime degradation"). Caching a
per-address fact under a binary-wide key makes every `io` call after the first
answer from a different address's evidence.

Reachable in production: `io` classifies as `capable` (never `missing` — it is not
in `CPUHISTORY_GATED_COMMANDS`), which satisfies the `cacheable` predicate at
`text-capability-probe.ts:383`, so the first `io` call populates the entry.

Two failure directions, both bad:

1. First call to a normal chip caches `capable`/no-degradation; a later call to a
   degraded chip has its degradation **missed**, and the degraded text falls
   through to `parseIoRegisters`, which refuses it through the parse-failure
   wrapper. That re-opens, for the `no-details-available` / `no-io-regs-available`
   codes, exactly the "an external condition reads as a defect in this project"
   wording problem plan 42-11 fixed for `unsupported-chip`.
2. First call to a degraded chip caches a refusal; later calls to healthy chips
   are **falsely refused** without their own response ever being looked at.

Untested: `text-tools.test.ts`'s `makeDeps()` never sets a resolved identity, so
`textCapabilityCacheKey(identity)` returns `null` and the cache path is never
exercised. Production resolves `resolvedBinaryPath` for real, so the tests and
production take different branches here.

## Fix sketch

Either key the probe on the address-specific command actually dialed
(`built.command`) instead of the literal `"io"`, or — better, since the verdict is
not a capability at all — stop routing `io`'s per-chip degradation through the
capability cache and call the classifier/renderer directly on each response. Add a
regression test that resolves an identity (so the cache path is live) and issues
two `io` calls to different addresses with different responses, asserting the
second is judged on its own reply.

## Why not fixed now

Phase 42's gap-closure round closed the five findings the prior review raised
(CR-01, WR-01, WR-02, IN-01, and IN-02's documentation half). CR-02 was surfaced
by the re-review of that round, is pre-existing (the call dates to plan 42-07 and
is present at commit `5258a210`, the tree as phase 42 originally completed), and
changing the caching contract is a behavioural change that deserves its own plan
with its own tests rather than being folded into a round that was already
verifying itself.
