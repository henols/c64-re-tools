---
status: testing
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-24T19:05:00Z
updated: 2026-09-24T19:05:00Z
---

## Current Test

number: 1
name: The owner's own in-session re-run of plan 64-14's live check, now that G-64-6 is also closed
expected: |
  Reconnect the vice MCP server (or start a new Claude Code session) so it loads the fixed code.
  Start the broker as a systemd user unit by the documented route with VICE_BIN=/usr/bin/x64sc.
  The session's very first vice_ping succeeds without a retry. vice_snapshot_save,
  vice_snapshot_load and vice_disk_attach, run a few times each, never return 0x8f.
  After the broker is stopped, no vice-broker/x64sc process and no 19510/66xx listener remain.
awaiting: user response

## Tests

### 1. The owner's own in-session re-run of plan 64-14's live check, now that G-64-6 is also closed
expected: All calls succeed on their first attempt with no 0x8f errors, matching the scripted live-check evidence in evidence/64-g643-g644-live-check.md (135/135 calls clean, 7/7 cold sessions first-attempt), but performed from the owner's own fresh Claude Code session against the merged code. Teardown leaves no vice-broker/x64sc process and no 19510/66xx listener.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(Round 2's UAT, status diagnosed, with gaps G-64-3 and G-64-4, is preserved in git history at 38e739b8. Both gaps were closed by plans 64-12/64-13, and the round-4 verification re-confirmed both truths VERIFIED.)
