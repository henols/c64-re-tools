---
status: diagnosed
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T14:50:48Z
updated: 2026-09-23T16:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Run the four migrated tools through a real, unmodified Claude Code session against the real broker and a real /usr/bin/x64sc
expected: All four succeed and no broker-side path appears in any result. The disk write-loss wording reads correctly after a real attach-write-close cycle. Currently expected to FAIL on all four with "stock handshake failed (vice: missing or invalid control token)": vice-proxy.ts dispatchStockFor() never forwards control_token into StockDispatchDeps. That field was added in Phase 63 (bba7a44e) and is untouched by Phase 64. Todo: .planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md
result: issue
reported: "Run live in-session at the user's request (user first replied 'pass', then asked for the test to be run rather than self-reported). Broker started as systemd user unit vice-broker.service with VICE_BIN=/usr/bin/x64sc (log: backend \"stock\" (binary: /usr/bin/x64sc), control listener 127.0.0.1:19510). This session's real vice-proxy.ts MCP server then answered vice_ping, vice_snapshot_save, vice_snapshot_load, vice_autostart and vice_disk_attach each with 'stock handshake failed (vice: missing or invalid control token).' No tool reached the emulator, so the no-broker-path and write-loss-wording checks could not be observed. Broker stopped; no x64sc/broker process or listening port left."
severity: blocker

### 2. Decide the disposition of the control-token wiring gap
expected: A recorded decision: either fix it before Phase 64 (or the milestone) is treated as production-ready, or accept it and track it as a fast-follow. The gap blocks every tool reachable through vice-proxy.ts, not only the four this phase migrated.
result: pass
decision: "fix now" -- the control-token wiring gap is a blocking fix for Phase 64, closed through gap G-64-1 before the phase is treated as production-ready (owner decision, 2026-09-23).

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-64-1
  truth: "vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load succeed through a real Claude Code session (vice-proxy.ts) against the real broker and /usr/bin/x64sc, with no broker-side path in any result"
  status: failed
  reason: "User reported (measured live in-session): every vice_* call, including vice_ping, fails with 'stock handshake failed (vice: missing or invalid control token).'"
  severity: blocker
  test: 1
  root_cause: "PRIMARY (the cause of G-64-1): no production code supplies a credential to the relay/transfer dial. Since Phase 63 (cfd02597) stockConnect()'s default socket source dials the fixed endpoint and sends `token: controlToken ?? \"\"` (stock-connect.ts:409-420; Phase 64 copied it into defaultTransferFile() :508/:530; text-connect.ts:100-110 has the same default). broker-control.mts:1284-1286 checks the token before handling attach/transfer. vice-proxy.ts dispatchStockFor() (:650-656) never sets StockDispatchDeps.controlToken, which stock-dispatch.ts:221-225 documents as test-only; openBrokerControl() keeps the real token inside createSession()'s closure (vice-broker-client.ts:1035). So every relay attach sends an empty token and is refused, for every vice_* tool on both channels. Acquire/monitor_claim succeed because they ride the already-authenticated control session. Offline reproduction confirmed that adding controlToken is the only thing that moves the refusal. SECONDARY (real, did not cause this UAT failure): broker and client resolve broker.json in different directories: the broker without --repo-root writes brokerStateDir() = ~/.c64-re-tools/supervisor (vice-broker.mts:219-222), while the client reads VICE_POOL_DIR ?? <project>/.c64-re-tools/supervisor (vice-broker-client.ts:96-101) and ignores broker-home.mts. The documented start route (`npx -y @henols/vice-mcp broker`, README.md:211, service/vice-broker.service:31, the launchd plist, BROKER_START_COMMAND broker-endpoint.ts:435) is the mismatched one; only vice-launcher.sh:287 (--repo-root) aligns them, and that pin contradicts BROKER-06."
  artifacts:
    - path: "src/mcp/vice/vice-proxy.ts"
      issue: "dispatchStockFor() (:650-656) and buildHeldLease() (:1198-1234) never carry a credential to the relay dial"
    - path: "src/mcp/vice/stock-dispatch.ts"
      issue: "controlToken (:221-225, :452-460) documented as test-only, so production never fills it"
    - path: "src/mcp/vice/stock-connect.ts"
      issue: "default monitor dial (:409-420) and defaultTransferFile() (:477-531) send `controlToken ?? \"\"`"
    - path: "src/mcp/vice/text-connect.ts"
      issue: "same empty-token default on the text channel (:100-110, :188; text-tools.ts:159)"
    - path: "src/mcp/vice/broker-control.mts"
      issue: "attach and transfer are dispatched after the per-boot token gate (:1284-1286)"
    - path: "src/mcp/vice/vice-broker-client.ts"
      issue: "client broker.json discovery (:96-101) ignores broker-home.mts; session hides its token (:1035)"
    - path: "src/mcp/vice/vice-broker.mts"
      issue: "without --repo-root the broker state dir is ~/.c64-re-tools/supervisor (:219-222), which the client never reads"
    - path: "src/mcp/vice/vice-proxy.test.ts"
      issue: "spawns the real proxy and sends vice_ping but discards the tool result (:2016-2017, :2106-2108), and its listener is on port 0 while the relay dials 19510"
  missing:
    - "Relay attach and file transfer succeed from a real vice-proxy.ts session against a real broker, on both the binary and text channels"
    - "Broker and client resolve the same broker.json for every documented start route (npx broker, service unit, launchd plist, vice-launcher.sh)"
    - "A regression test that drives the real vice-proxy.ts against a real control listener and asserts a stock tool call reaches onRelayAttach and returns a non-error result"
    - "A test asserting the broker's default state dir and the client's discovery path agree"
  debug_session: ".planning/debug/vice-proxy-control-token-handshake.md"
