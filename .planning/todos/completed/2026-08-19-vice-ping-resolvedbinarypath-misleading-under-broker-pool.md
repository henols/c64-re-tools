---
title: vice_ping's resolvedBinaryPath is a static bare-x64sc PATH probe, independent of what the broker actually launched — misleading for binary-identity audits
date: 2026-08-19
priority: high
source: 08.1-WALKTHROUGH-EVIDENCE.md FINDING-C3 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
resolves_phase: 15
---

# `resolvedBinaryPath` does not reflect the leased instance's real binary

`vice_ping`'s `resolvedBinaryPath` field (`vice-proxy.ts:192`,
`const ACTIVE_BACKEND = backendDetect.resolvedBackend();`) runs exactly once at
MCP-server process startup, doing its own static, bare-`x64sc` `$PATH` lookup in the
MCP server's own environment. This probe is entirely independent of which binary the
broker (a separate, already-running process) actually launches for whichever instance
gets leased to a given request. On a machine where bare `x64sc` on `$PATH` resolves to
the fork build, `resolvedBinaryPath` reports the fork's path unconditionally on every
stock-backend `vice_ping` call, regardless of which binary is actually serving the
request — misleading for exactly the binary-identity audits this project performs.

**Corroborating evidence:** Phase 8.2 plan 04's own walkthrough re-run had to route
around this field entirely (excluded per this finding) and instead proved backend
identity using the broker's own `epoch.json` plus a live `ps -o args=` read on the
leased instance's pid — independent confirmation that the field is a trap for anyone
who trusts it as ground truth.

## Why deferred rather than fixed here

Out of Phase 8.2's scope fence — this phase closes the Drive8Type/test-gate/walkthrough
blockers, not `vice-proxy.ts`'s reporting fields. Fixing it means editing
`vice-proxy.ts`, which E-5's own instruction forbids in this plan.

## What would close it

Either make `resolvedBinaryPath` query the actual leased instance's launch record
(the broker's own `epoch.json`/`vice_bin`) per-request instead of a one-time
process-startup PATH probe, or rename/document the field explicitly as
"MCP-server-process-startup PATH probe, not the leased instance's binary" so callers
stop treating it as authoritative.

## Resolution (2026-08-22, Phase 15 plan 15-09)

Took the second option on the record: **documented the field rather than
re-querying the broker per request.** The first option (per-request requery
against the broker's launch record) was considered and explicitly rejected —
it is a real behavioural change to a reporting field, out of a disposition
phase's remit.

Documented in two places, both additive and backward-compatible (the existing
field name and shape are unchanged):

1. **At the definition** — `vice-proxy.ts`'s module-scope `ACTIVE_BACKEND`
   resolution (now at line 316, shifted from the todo's original citation of
   `:192` by prior phases' edits) carries a new comment block stating this is
   resolved exactly once at MCP-server process startup, by a `$PATH` probe in
   the server's own environment, independent of which binary the broker
   leased for any given request — naming the broker's own launch record
   (`epoch.json`'s `vice_bin` field, written by `broker-epoch.mts`) as the
   authoritative per-instance answer, and citing Phase 8.2 plan 04's
   walkthrough as the precedent that had to route around this field entirely.
2. **In the response itself** — `stock-dispatch.ts`'s `handlePing()` now adds
   an additive sibling field, `resolvedBinaryPathScope`, whose string value
   states plainly that `resolvedBinaryPath` is a one-time
   MCP-server-process-startup PATH probe, not the binary the broker leased
   for this request, and points to `epoch.json`'s `vice_bin` field as the
   authoritative per-instance answer. The existing `resolvedBinaryPath` /
   `resolvedBinaryPathIsResolved` fields are untouched.

A new runnable test file, `.claude/mcp/vice/vice-proxy-ping.test.ts` (never
`vice-proxy.test.ts`, which hangs), pins both the new field's presence and
content and the unchanged shape of the existing fields. Non-vacuity proven by
a planted-violation probe: temporarily removing the `resolvedBinaryPathScope`
line from `handlePing()` reddened the new test
(`AssertionError: expected 'string', actual 'undefined'` on the field-presence
assertion); restoring it returned the suite to green (2/2 pass). The file was
confirmed to land in the automated test set (absent from `test-gate.mjs`'s
`MANUAL_ONLY_TESTS`).

Landed together with the warp-over-RESOURCE_SET todo's closure in this same
plan; see that todo's own Resolution and the plan's SUMMARY.md for the full
commit list. `STATE.md`'s `## Deferred Items` ledger was reconciled in the
same commit set (pending 12 → 10, total 13 → 11).
