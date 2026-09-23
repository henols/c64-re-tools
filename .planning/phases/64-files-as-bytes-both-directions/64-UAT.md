---
status: diagnosed
phase: 64-files-as-bytes-both-directions
source: [64-VERIFICATION.md]
started: 2026-09-23T20:45:00Z
updated: 2026-09-23T20:36:40Z
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
  root_cause: "Upload publish race: the client names the uploaded file before the broker has published it. vice_disk_attach, vice_snapshot_load (and vice_autostart, same exposure) send AUTOSTART/UNDUMP with stageOutcome.emulatorFilename as soon as session.deps.transferFile() resolves (stock-machine.ts:348->358, :606->615, :219->229). defaultTransferFile() (stock-connect.ts ~497-515) resolves when the CLIENT's own pipeline(createReadStream, sendPass, socket) finishes and destroys the socket; the broker, after transfer_ready (vice-broker.mts:1151-1152), still drains to a temp file, closes, digests and renameSync()s it into place (broker-transfer.mts:328, :342) and never writes anything back -- the transfer_complete reply named in broker-control.mts:347/:589 was never implemented. The relay delivers the command faster than the publish, VICE opens a path that does not exist yet, mon_autostart()/mon_read_snapshot() returns -1, and VICE answers CMD_FAILURE 0x8f (response type 0x00 is simply every VICE error frame's shape, not a demux mismatch). MEASURED: VICE's own log for the failing UAT run-2 attach handle shows 'Cannot open file' then the file appearing mid-autostart; unmodified proxy 20/30 failures over 15 save->load->attach loops (save 15/15 ok, since DUMP writes the file itself); scratch-instrumented client, send only after the staged file exists: 0/30. Plan 64-11's checkpoint-condition hypothesis is ruled out (neither handler sets a checkpoint); it was steered there by stock-handler.ts:147's 0x8f gloss ('a condition syntax error'). The only unit test's stub (stock-machine.test.ts:1108-1130) polls up to 2s for the staged file, hiding the race; the handlers' ACCEPTED RISK comment (stock-machine.ts:581-601) assumed an unmeasured, false timing margin."
  artifacts:
    - path: "src/mcp/vice/stock-connect.ts"
      issue: "defaultTransferFile() upload branch reports the client's local write as upload success and never waits for a broker-side acknowledgement"
    - path: "src/mcp/vice/vice-broker.mts"
      issue: "handleFileTransfer() (:1147-1162) publishes asynchronously and writes nothing back to the client"
    - path: "src/mcp/vice/broker-transfer.mts"
      issue: "receivePayloadToFile() rename (:328, :342) completes with no completion signal on the transfer connection"
    - path: "src/mcp/vice/broker-control.mts"
      issue: "names a transfer_complete reply (:347, :589) that no code sends"
    - path: "src/mcp/vice/stock-machine.ts"
      issue: "all three upload-then-command handlers (:219-229, :348-358, :606-615) send AUTOSTART/UNDUMP without confirmation the staged file exists; ACCEPTED RISK comment (:581-601) rests on a false timing assumption"
    - path: "src/mcp/vice/stock-handler.ts"
      issue: "0x8f gloss (:147) says 'condition syntax error'; for AUTOSTART/UNDUMP it means VICE could not open/read the named file"
    - path: "src/mcp/vice/stock-machine.test.ts"
      issue: "stub (:1108-1130) polls for the staged file, so the race can never fail a test"
  missing:
    - "An upload acknowledgement: the broker writes transfer_complete (or an error line) on the transfer connection after the rename succeeds, and defaultTransferFile() resolves only on it -- a client-side existsSync poll is not a fix, because this milestone removes the shared filesystem"
    - "A regression test whose stub opens the staged file immediately (no polling), so naming an unpublished file fails"
    - "0x8f wording that is truthful for file-carrying commands (AUTOSTART/UNDUMP: file could not be opened or read)"
  debug_session: .planning/debug/vice-0x8f-disk-attach-snapshot-load.md

- gap_id: G-64-4
  truth: "A cold session's first vice_* call succeeds: the broker does not hand out a grant or splice a relay until the freshly launched x64sc's binary monitor is accepting connections, and a failed first attach does not kill a still-booting instance"
  status: failed
  reason: "User reported: decision recorded -- fix before v2.0.0 is production-ready. Re-measured: vice_ping needed 2 attempts in 2 of 2 fresh sessions; 64-11 measured up to 11 consecutive failures. Evidence: evidence/64-g641-live-check.md 'Live defect 1'; todo .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md."
  severity: major
  test: 2
  root_cause: "The broker acknowledges before the emulator side is ready. spliceRelay() (broker-relay.mts:327-330) makes ONE netConnect() to the emulator's monitor port with no retry and returns before it connects; handleRelayAttach -> broker-control.mts:1346-1349 writes {kind:'attached'} as soon as that dial is STARTED; and handleAcquire()'s cold-launch arm grants the new record straight from launching (vice-broker.mts:942-943) although a readiness mechanism exists (probeReady()/promoteLaunchingInstances(), used by the warm arm at :737). MEASURED on real x64sc 3.9: the splice dial lands 17-31ms after spawn, x64sc binds 55-142ms after spawn -> emulator-leg ECONNREFUSED -> handleRelayDeath() writes an incident record and closes the client leg, abandoning the client's PING ('stock handshake failed ... 1 request(s) abandoned'). Attach immediately after grant: 0/9 first-attempt success on the unmodified broker; attach after the port is listening: 8/8. The text-monitor port binds 1-2ms after the binary port, so the same race hits a text-channel first call. CORRECTS plan 64-11's trace: a failed first attach releases only the monitor claim (stock-connect.ts:795-806), NOT the grant, and does not kill the instance; a same-session retry reaches the same instance (20 trials -> exactly 20 launches). 64-11's '11 consecutive failures' is a fast retry loop outrunning the bind, plus a burst of 8 separate proxy processes each cold-launching. Recycle respawn also grants ungated (broker-launch.mts:1493-1495, READ only). Every failed cold attach writes a spurious relay-death incident record. The inFlight guard's check-and-set (broker-launch.mts:803-808) is released in its finally (:878-881) before the grant, so a readiness wait after acquirePortAndLaunch() is outside it. Same fault class as G-64-3: completion is reported when the broker's own side is done, not when the far side is ready."
  artifacts:
    - path: "src/mcp/vice/broker-relay.mts"
      issue: "spliceRelay() (:327-430) dials once, wires pipes and returns before the connect completes"
    - path: "src/mcp/vice/broker-control.mts"
      issue: "attached (:1346-1349) is written without waiting for the emulator-side connect"
    - path: "src/mcp/vice/vice-broker.mts"
      issue: "cold arm grants with no readiness step (:942-943); handleRelayDeath() (:1260-1302) records a never-connected dial as an incident"
    - path: "src/mcp/vice/broker-launch.mts"
      issue: "recycle respawn record set to granted ungated (:1493-1495)"
    - path: "src/mcp/vice/stock-handler.ts"
      issue: "handshake-failure text (:123) gives the model no retry hint"
  missing:
    - "At the splice/attach seam (covers cold acquire, recycle respawn and the text channel at once): dial the emulator side first with a short bounded retry on ECONNREFUSED, and send attached / wire the pipes only after the emulator-side connect event"
    - "No incident record for a dial that never connected"
    - "A regression test whose emulator stand-in binds its port only AFTER the broker's spawn resolves (every existing stub binds before, which is why no test caught this)"
    - "If a readiness wait is ever added at acquire instead: reserve the record before any await (the 500ms pass could otherwise promote and hand it to a concurrent acquire), probe repeatedly to a deadline (a single 1s probeReady() usually fails -- first PING answers 1.0-1.7s after bind), and keep nothing between inFlight's check and set"
  debug_session: .planning/debug/cold-launch-relay-attach-race.md
