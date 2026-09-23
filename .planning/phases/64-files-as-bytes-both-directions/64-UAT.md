---
status: testing
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T14:50:48Z
updated: 2026-09-23T14:50:48Z
---

## Current Test

number: 1
name: Run the four migrated tools through a real, unmodified Claude Code session against the real broker and a real /usr/bin/x64sc
expected: |
  vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load all succeed, and no broker-side path appears in any result. The disk write-loss wording reads correctly after a real attach-write-close cycle.
awaiting: user response

## Tests

### 1. Run the four migrated tools through a real, unmodified Claude Code session against the real broker and a real /usr/bin/x64sc
expected: All four succeed and no broker-side path appears in any result. The disk write-loss wording reads correctly after a real attach-write-close cycle. Currently expected to FAIL on all four with "stock handshake failed (vice: missing or invalid control token)": vice-proxy.ts dispatchStockFor() never forwards control_token into StockDispatchDeps. That field was added in Phase 63 (bba7a44e) and is untouched by Phase 64. Todo: .planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md
result: [pending]

### 2. Decide the disposition of the control-token wiring gap
expected: A recorded decision: either fix it before Phase 64 (or the milestone) is treated as production-ready, or accept it and track it as a fast-follow. The gap blocks every tool reachable through vice-proxy.ts, not only the four this phase migrated.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
