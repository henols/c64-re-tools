---
status: complete
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T20:45:00Z
updated: 2026-09-23T20:05:10Z
---

## Current Test

[testing complete]

## Tests

### 1. The owner's own in-session re-run of UAT test 1 (G-64-1) against the fixed code
Reconnect the vice MCP server (or start a new Claude Code session) so it loads the fixed code; start the broker as a systemd user unit by the documented route with VICE_BIN=/usr/bin/x64sc; run vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load; confirm none errors and no result names a path under ~/.c64-re-tools/; read the disk write-loss wording after an attach-write-close cycle; then stop the broker and confirm a clean teardown. Note: plan 64-11 measured that a cold session's first stock call can fail while the emulator is still booting (see test 2); the scripted run retried the first call.
expected: All four tools succeed with no broker-side path in any result, matching what plan 64-11's own scripted run and its independent nested Claude Code session both already measured.
result: issue
reported: "Run by Claude at the owner's instruction (\"you are running the tests\"), 2026-09-23 22:01-22:04 CEST, through a freshly spawned vice-proxy.ts over stdio (this session's own MCP proxy predated the 64-08..64-10 fixes), driven by evidence/64-g641-live-driver.mjs, broker as transient systemd user unit vice-broker-uat64 with VICE_BIN=/usr/bin/x64sc (VICE 3.9). G-64-1's own truth HOLDS: all four tools returned isError false in run 2; leak scan of every result for $HOME/.c64-re-tools/ found 0; snapshot path under the client project's .c64-re-tools/snapshots/; $C000 sentinel ff -> c9 after vice_autostart; writeLoss wording held exactly (TESTSAVE present in the LOAD\"$\" listing read from $0801, local blank.d64 sha256 unchanged 689b2150..., staging empty); clean teardown (unit inactive and unloaded, 0 x64sc/broker processes, 0 listeners on 19510/66xx). But 'confirm none errors' does NOT hold: the intermittent 0x8f ('condition syntax error', binary monitor error 0x8f for response type 0x00) hit a migrated tool's first attempt in BOTH runs -- vice_snapshot_load in run 1 (right after vice_snapshot_save, following ~30 memory_read/execution_run pairs), vice_disk_attach in run 2 (right after a successful vice_snapshot_load; 2nd attempt succeeded). Plan 64-11 saw it on vice_disk_attach only (~1 in 3) and filed no todo for it, only a WINDOWS.md deviation. Also: vice_ping needed 2 attempts in both runs (live defect 1, test 2). Also noted, out of scope: my first run passed relative paths from the wrong cwd (driver error, not a product defect); plan 64-11's screen-RAM TESTSAVE check was a false-positive-prone probe (the typed SAVE line echoes the name), replaced here by a $0801 directory-listing read."
severity: major

### 2. Decide the disposition of the cold-launch relay-attach race found live by plan 64-11
A cold-launched broker instance's first relay attach races the real emulator's own startup and is killed by the broker's kill-never-recycle release policy on that race's failure (11 consecutive failures measured in one session; independently reproduced through a nested Claude Code session's first vice_ping). Evidence: .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md, "Live defect 1". Pending todo: .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md.
expected: A recorded decision: fix before the v2.0.0 milestone is treated as production-ready, or accept and track as a fast-follow.
result: issue
reported: "Decision (taken by Claude under the owner's standing 'you decide' instruction, 2026-09-23): FIX BEFORE the v2.0.0 milestone is treated as production-ready. Reason: re-measured in this UAT, the race hit the first call of EVERY cold session observed -- 2 of 2 fresh proxy sessions here (vice_ping needed 2 attempts each), plus plan 64-11's scripted run (up to 11 consecutive failures) and its nested Claude Code session. A Claude session's very first vice_* call therefore fails with 'stock handshake failed', whose text does not tell the model to retry, and each retry cold-launches a fresh instance into the same race, so retrying does not converge by design. That breaks the Core Value ('keep working when the emulator misbehaves') on the happy path, not an edge case."
severity: major

## Summary

total: 2
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- gap ids G-64-3/G-64-4, not G-64-{test}: G-64-1 is the prior round's gap, resolved by plans
64-08..64-11 whose frontmatter carries gap_ids [G-64-1]; reusing it would make reconcile_gaps
auto-resolve these new gaps against those old plans. -->

- gap_id: G-64-3
  truth: "vice_disk_attach and vice_snapshot_load succeed on their first attempt in a session that has already run other stock tools (memory reads, execution_run, snapshot_save), never returning binary monitor error 0x8f"
  status: failed
  reason: "User reported: intermittent 0x8f ('condition syntax error', response type 0x00) on a migrated tool's first attempt in both live runs -- vice_snapshot_load in run 1, vice_disk_attach in run 2; plan 64-11 measured the vice_disk_attach case at ~1 in 3 and in one case the attach had taken effect despite the error."
  severity: major
  test: 1
  artifacts: []
  missing: []

- gap_id: G-64-4
  truth: "A cold session's first vice_* call succeeds: the broker does not hand out a grant or splice a relay until the freshly launched x64sc's binary monitor is accepting connections, and a failed first attach does not kill a still-booting instance"
  status: failed
  reason: "User reported: decision recorded -- fix before v2.0.0 is production-ready. Re-measured: vice_ping needed 2 attempts in 2 of 2 fresh sessions; 64-11 measured up to 11 consecutive failures. Evidence: evidence/64-g641-live-check.md 'Live defect 1'; todo .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md."
  severity: major
  test: 2
  artifacts: []
  missing: []
