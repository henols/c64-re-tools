---
title: vice_ping's resolvedBinaryPath is a static bare-x64sc PATH probe, independent of what the broker actually launched — misleading for binary-identity audits
date: 2026-08-19
priority: high
source: 08.1-WALKTHROUGH-EVIDENCE.md FINDING-C3 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
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
