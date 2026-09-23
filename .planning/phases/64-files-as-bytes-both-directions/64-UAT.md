---
status: testing
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T20:45:00Z
updated: 2026-09-23T20:45:00Z
---

## Current Test

number: 1
name: The owner's own in-session re-run of UAT test 1 (G-64-1) against the fixed code
expected: |
  All four tools succeed with no broker-side path in any result, matching what plan 64-11's own scripted run and its independent nested Claude Code session both already measured.
awaiting: user response

## Tests

### 1. The owner's own in-session re-run of UAT test 1 (G-64-1) against the fixed code
Reconnect the vice MCP server (or start a new Claude Code session) so it loads the fixed code; start the broker as a systemd user unit by the documented route with VICE_BIN=/usr/bin/x64sc; run vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load; confirm none errors and no result names a path under ~/.c64-re-tools/; read the disk write-loss wording after an attach-write-close cycle; then stop the broker and confirm a clean teardown. Note: plan 64-11 measured that a cold session's first stock call can fail while the emulator is still booting (see test 2); the scripted run retried the first call.
expected: All four tools succeed with no broker-side path in any result, matching what plan 64-11's own scripted run and its independent nested Claude Code session both already measured.
result: [pending]

### 2. Decide the disposition of the cold-launch relay-attach race found live by plan 64-11
A cold-launched broker instance's first relay attach races the real emulator's own startup and is killed by the broker's kill-never-recycle release policy on that race's failure (11 consecutive failures measured in one session; independently reproduced through a nested Claude Code session's first vice_ping). Evidence: .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md, "Live defect 1". Pending todo: .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md.
expected: A recorded decision: fix before the v2.0.0 milestone is treated as production-ready, or accept and track as a fast-follow.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
