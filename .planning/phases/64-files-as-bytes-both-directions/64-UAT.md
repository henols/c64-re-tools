---
status: complete
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T14:50:48Z
updated: 2026-09-23T15:40:00Z
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
  artifacts: []
  missing: []
