---
status: complete
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-24T19:05:00Z
updated: 2026-09-24T21:37:00Z
---

## Current Test

[testing complete]

## Tests

### 1. The owner's own in-session re-run of plan 64-14's live check, now that G-64-6 is also closed
expected: All calls succeed on their first attempt with no 0x8f errors, matching the scripted live-check evidence in evidence/64-g643-g644-live-check.md (135/135 calls clean, 7/7 cold sessions first-attempt), but performed from the owner's own fresh Claude Code session against the merged code. Teardown leaves no vice-broker/x64sc process and no 19510/66xx listener.
result: pass
evidence: |
  Run 2026-09-24 21:35-21:36Z from a Claude Code session on the owner's request ("You can do that").
  The session's vice-proxy started at 10:35 local or later. It post-dates plans 64-12/64-13. Every later code change
  (64-15, 64-16) is broker-side, and the broker was started fresh from this checkout
  (resources-sync.test.ts 2/2 pass). Pre-flight: vice-broker.service inactive, no vice-broker/x64sc process,
  no 19510/66xx listener, broker.json stale (pid 1289317 dead).
  Unit: systemd-run --user --unit=vice-broker --collect --setenv=VICE_BIN=/usr/bin/x64sc
  --setenv=MASTRA_TELEMETRY_DISABLED=1 -- node src/mcp/vice/vice-cli.mjs broker. Journal: backend "stock"
  (binary: /usr/bin/x64sc). The leased instance reported VICE 3.9.0.0. epoch.json vice_bin = /usr/bin/x64sc.
  12 MCP calls, each once, no retry, all isError false, zero 0x8f: vice_ping (the session's first call) x2,
  vice_snapshot_save x3, vice_snapshot_load x4 (including one load of a snapshot saved while running
  after an attach), vice_disk_attach x3 (subject.d64 and blank.d64 alternated).
  Journal for this invocation: launching = 1, relay_error = 0, 0x8f = 0. New incident records = 0.
  After systemctl --user stop: unit inactive, no vice-broker/x64sc process, no 19510/66xx listener.
  Benign note: shutdown logged "refusing to signal pid ... [x64sc] <defunct>". systemd's cgroup SIGTERM had
  already ended x64sc. It was an unreaped zombie with no survivor.
  Unrelated pre-existing residue: the config-scratch reap found 377 vice-broker-vicerc-* dirs and removed 244.
  It left the rest in place because they have no readable pid record.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(Round 2's UAT, status diagnosed, with gaps G-64-3 and G-64-4, is preserved in git history at 38e739b8. Both gaps were closed by plans 64-12/64-13, and the round-4 verification re-confirmed both truths VERIFIED.)
