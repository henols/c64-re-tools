---
title: vice-proxy.ts's dispatchStockFor() never wires the broker's per-boot control token into StockDispatchDeps, so a REAL MCP-to-broker relay handshake fails end to end
date: 2026-09-23
priority: high
source: plan 64-07's own live human-check attempt (systemd-run broker, absolute /usr/bin/x64sc, real vice-proxy.ts over stdio)
---

# What

Live-tested plan 64-07's own `<human-check>` item 1 (run the four migrated
file-carrying tools against a real broker and a real `/usr/bin/x64sc`,
confirm no broker-side path leaks). The broker started correctly (real
`x64sc` bound, `broker.json` written with a valid `control_token`), and a
real `vice-proxy.ts` process over stdio successfully performed `initialize`
and an `acquire` (a real grant for a real emulator instance). Every one of
the four tool calls (`vice_autostart`, `vice_disk_attach`,
`vice_snapshot_save`, `vice_snapshot_load`) then failed identically:

```
vice_autostart: stock handshake failed (vice: missing or invalid control token).
```

The refusal originates in `broker-control.mts`'s own token gate
(`"missing or invalid control token"`, `broker-control.mts:1286`), meaning
the connection `stockConnect()` opens to the broker's relay/control plane
(via `defaultDialMonitorSocket()`/`defaultTransferFile()` in
`stock-connect.ts`, both parameterised on a raw `controlToken: string`)
presented an EMPTY token rather than the real one from `broker.json`.

Traced the wiring precisely: `vice-proxy.ts`'s `dispatchStockFor()` (the
ONE place every stock tool call's shared deps object is built) calls:

```ts
return stockDispatch.dispatchStock(name, args, {
  ensureLease: ensureBrokerLease,
  resolvedBinaryPath: RESOLVED_BINARY.binPath,
  resolvedBinaryPathIsResolved: RESOLVED_BINARY.binPathResolved,
});
```

`StockDispatchDeps` HAS a `controlToken?: string` field
(`stock-dispatch.ts:225`), forwarded into `StockConnectDeps` at
`stockConnectDepsFor()` (`stock-dispatch.ts:458`,
`if (deps.controlToken) connectDeps.controlToken = deps.controlToken;`) --
but `dispatchStockFor()` never sets it. `grep -n "controlToken" vice-proxy.ts`
returns zero hits. The token IS available at the point `ensureBrokerLease()`
runs (`openBrokerControl()` reads `broker.json`'s `control_token` to
authenticate the control connection it opens), but it is never carried
forward into the `HeldLease`/`StockDispatchDeps` object every subsequent
tool call receives -- `buildHeldLease()` (`vice-proxy.ts:1198`) puts
`brokerControl: session` (the authenticated session object, whose own
high-level methods like `stageFile()`/`claimMonitor()` presumably carry
their own internal authentication) but no raw token string, and nothing
downstream re-derives one.

# Why it matters

This is the FIRST live test in this codebase's history to drive a stock
tool call through the REAL `vice-proxy.ts` MCP stdio entry point against a
REAL broker using the Phase 62+ fixed-endpoint, control-token-gated relay
model. Every existing "live" test (`stock-live.test.ts`,
`stock-broker-live.test.ts`, and phase 64's own extensive DI-stub coverage
across `stock-machine.test.ts`, `vice-broker-staging.test.ts`, this plan's
own `transfer-disjoint-roots.test.ts`) calls `dispatchStock()` or a specific
handler DIRECTLY with an injected session/deps object, bypassing
`vice-proxy.ts`'s own `dispatchStockFor()` entirely -- so this exact wiring
gap has no test coverage anywhere and would not be caught by
`npm run test:automated` or the full `npm test` glob. If this reproduces
against a real Claude Code session (not yet independently confirmed
outside this one live run), every stock tool call through the real MCP
surface would fail identically against a broker using this relay model --
not merely the four file-carrying tools this todo's own reproduction
exercised, since `defaultDialMonitorSocket()` (the FIRST, ordinary
binary-monitor connection every tool needs) requires the SAME
`controlToken` and is reached before any tool-specific logic runs.

# Why it was invisible

Every phase-64 plan's own "human-check" and "live round trip" verification
(64-03 through 64-06) exercised the wired-in broker callbacks
(`handleStageFile`/`handleFileTransfer`/`handleRelease`) directly against a
real `startControlListener()`, or drove `stockConnect()` with an explicitly
injected `controlToken` in the test's own fixture -- never through
`vice-proxy.ts`'s own `dispatchStockFor()`, which is the ONLY place in
production code that is supposed to supply this value from `ensureLease()`'s
own resolved lease. No SUMMARY in this phase claims to have exercised the
full `vice-proxy.ts` stdio surface against a real broker; 64-07 is the first
plan whose own `<human-check>` asked for exactly that, and this is what it
found.

# Do NOT

Do not conclude from this alone that the four file-carrying tools'
migration (Phase 64's own deliverable) is broken -- every one of Phase 64's
own extensive tests (`transfer-disjoint-roots.test.ts` included) proves the
STAGE/TRANSFER protocol itself is correct when a caller supplies a valid
session/token, which is exactly what production code is supposed to do and
currently does not. This is a wiring gap in `vice-proxy.ts`'s own deps
construction, not a defect in the file-transfer protocol Phase 64 built.

Do not fix this inside a plan whose own `files_modified` does not name
`vice-proxy.ts`, `stock-dispatch.ts` or `stock-connect.ts` -- confirm the
reproduction independently first (ideally with an unmodified, real Claude
Code session, not only this ad-hoc systemd-run reproduction), then decide
whether the fix is as narrow as threading `controlToken` through
`buildHeldLease()`/`dispatchStockFor()`, or whether it surfaces a broader
question about how a raw string token should be exposed alongside an
already-authenticated `BrokerControlSession` object.

# Resolution

Fixed by route (b), NOT by the thread-through this todo's own "Do NOT"
section left as the open question. Plan 64-08 (gap G-64-1) moved
`broker-control.mts`'s `attach` and `transfer` dispatch arms ahead of the
per-boot control-token gate, so each is now authenticated by its
broker-minted per-claim/per-stage handle alone -- the handle
`monitor_claim`/`stage_file` already mint, over the still-token-gated
control session, before either relay/transfer connection is ever opened.
This is possible only because the owner's decision 5 (REQUIREMENTS.md)
already forbids threading the per-boot token through client deps as a
standing rule ("no phase may plan an auth mechanism, a credential file"),
which ruled out this todo's own first candidate fix outright. Plan 64-09
removes the now-dead client-side empty-token parameters this todo's own
diagnosis traced (`StockDispatchDeps.controlToken`,
`defaultDialMonitorSocket()`/`defaultTransferFile()`'s `controlToken`
plumbing) -- `vice-proxy.ts`'s `dispatchStockFor()` still supplies neither,
and now correctly so: there is nothing left for it to supply.

Full record, including the replacement mitigation and the residual risk
accepted in its place: `.planning/phases/64-files-as-bytes-both-directions/
evidence/64-g641-handle-only-authority.md`. This resolution is recorded
here, at this todo's original path -- moving or renaming it would be a
deletion, which `cleanup-wave` refuses; the orchestrator relocates it at
the phase close.
