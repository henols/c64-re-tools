---
status: diagnosed
trigger: "G-64-3: vice_disk_attach / vice_snapshot_load intermittently return binary monitor error 0x8f for response type 0x00 on their first attempt in a session that already ran other stock tools"
created: 2026-09-23T22:30:00+02:00
updated: 2026-09-23T22:25:00+02:00
goal: find_root_cause_only
---

## Current Focus

bug_class: Bohrbug-shaped race (deterministic mechanism, timing-dependent outcome; reproduces at 37-67% per call on this host)
hypothesis: CONFIRMED -- upload-publish race. The client sends AUTOSTART/UNDUMP naming the broker-staged file before the broker has renamed the uploaded temp file into place; VICE cannot open the path and answers CMD_FAILURE 0x8f in its generic error frame (response type 0x00).
test: done -- live differential, mode A (send at once) vs mode B (wait until staged file exists), plus an unmodified-production baseline
next_action: none (find_root_cause_only) -- hand diagnosis to /gsd-plan-phase --gaps
reasoning_checkpoint:
  hypothesis: "vice_disk_attach / vice_snapshot_load fail with 0x8f because the client's upload promise resolves when its own socket write finishes, not when the broker has published the staged file, so the next AUTOSTART/UNDUMP reaches VICE while the staged path does not yet exist"
  confirming_evidence:
    - "VICE's own log: every failing disk_attach handle logs 'Cannot open file' on the disk and tape probes; some then open the full 174848-byte file on the CRT/PRG probe (file appeared mid-probe)"
    - "client-side probe: 11/11 failures had existsAtSend=false; 3/3 sends with existsAtSend=true succeeded"
    - "mode B (wait for the file, 1-2 ms) = 0/30 failures; mode A = 11/30; unmodified production proxy = 20/30"
  falsification_test: "a 0x8f failure with the staged file present at send time, or failures persisting in mode B -- neither observed"
  fix_rationale: "the handler must not name the file until the broker has confirmed the publish (renameSync done)"
  blind_spots: "run 1's UNDUMP failure has no VICE-side log (instance log tail unflushed); UNDUMP failures never log in VICE, so the UNDUMP half rests on the client probe + differential, not a VICE log line"
  candidate_causes:
    - "code: missing upload-completion acknowledgement (transfer_complete named in broker-control.mts comments, never implemented)"
    - "data/protocol: stale checkpoint condition (L1) -- eliminated"
    - "protocol: error frame demux mismatch on response type 0x00 (L2) -- eliminated"
    - "environment: same-host loopback makes the relay faster than the broker's fs write+close+rename"
  and_gate: "no -- a single mechanism; the fast same-host relay is the condition that exposes it, not a second defect"

## Symptoms

expected: every call of the four migrated tools (vice_autostart, vice_disk_attach, vice_snapshot_save, vice_snapshot_load) returns isError false.
actual: (measured live 2026-09-23 22:01-22:04 CEST, stock /usr/bin/x64sc VICE 3.9, fresh vice-proxy.ts over stdio, real broker as systemd user unit)
  - run 1: vice_snapshot_load returned isError true immediately after a successful vice_snapshot_save, which followed ~30 pairs of vice_memory_read + vice_execution_run.
  - run 2: vice_snapshot_load succeeded 1st attempt; the next call, vice_disk_attach (unit 8, blank .d64), failed 1st attempt and succeeded on the 2nd.
  - plan 64-11: vice_disk_attach failed ~1 in 3, always after a vice_snapshot_load and several vice_run_until calls in the same session; once the attach had taken effect despite the error.
errors: "vice_disk_attach: the command failed inside the monitor with no further diagnostic (a condition syntax error reports exactly this and nothing more) (binary monitor returned error code 0x8f for response type 0x00)." -- identical text with vice_snapshot_load.
reproduction: UAT test 1 in .planning/phases/64-files-as-bytes-both-directions/64-UAT.md; live driver evidence/64-g641-live-driver.mjs; transcript scratchpad/uat64/transcript.jsonl
started: discovered during Phase 64 UAT; the migrated handlers are Phase 64 work.

## Eliminated

- hypothesis: L2 -- response type 0x00 means the error frame belongs to a different request, or is an unsolicited frame mis-matched to the pending request
  evidence: VICE source (vice-3.8 src/monitor/monitor_binary.c:335-337) -- monitor_binary_error() always sends monitor_binary_response(0, 0, errorcode, request_id, NULL), i.e. response type 0x00 carrying the FAILING command's own request id. Every VICE binary-monitor error frame has response type 0x00. The AUTOSTART handler (:753-756) and the UNDUMP handler (:868-871) both answer CMD_FAILURE through it when mon_autostart()/mon_read_snapshot() return < 0. So 0x00 is the normal shape, not a demux mismatch.
  timestamp: 2026-09-23T22:40:00+02:00
- hypothesis: L1 -- a stale checkpoint condition from earlier vice_run_until / vice_execution_run calls collides with a checkpoint vice_disk_attach sets
  evidence: READ stock-machine.ts:299-372 and :545-640 -- handleDiskAttach and handleSnapshotLoad set no checkpoint and no condition; each sends exactly one binary-monitor command (AUTOSTART 0xdd / UNDUMP 0x42). The "condition syntax error" wording is only the generic CmdFailure gloss in stock-handler.ts:147. Run 1 also had no vice_run_until. VICE's own log (evidence below) shows the AUTOSTART itself failing to open its file.
  timestamp: 2026-09-23T22:40:00+02:00

## Evidence

- timestamp: 2026-09-23T22:30:00+02:00
  checked: .planning/debug/knowledge-base.md
  found: one entry (gsd-internals-leak-into-src), unrelated
  implication: no known-pattern candidate

- timestamp: 2026-09-23T22:35:00+02:00
  checked: READ src/mcp/vice/stock-machine.ts:328-363 (handleDiskAttach), :572-621 (handleSnapshotLoad)
  found: both do stageFile() -> await transferFile(upload) -> send AUTOSTART/UNDUMP naming stageOutcome.emulatorFilename. The handlers' own comments (:210-214, :339-343, :581-601) record an "ACCEPTED RISK": transferFile() resolving does not mean the broker has published the bytes; there is no transfer_complete frame; "this plan's own round-trip test reproduced it reliably on a same-process loopback".
  implication: a known, documented, unguarded race between upload publish and the command that names the file.

- timestamp: 2026-09-23T22:36:00+02:00
  checked: READ src/mcp/vice/stock-connect.ts:473-510 (defaultTransferFile upload) and src/mcp/vice/broker-endpoint.ts:896-1066 (dialFileTransfer)
  found: the upload returns ok as soon as pipeline(createReadStream, sendPass, socket) settles (socket write side finished -> bytes in the kernel send buffer), then destroys the socket. Nothing waits for any broker reply after transfer_ready.
  implication: the client's "upload done" is purely local.

- timestamp: 2026-09-23T22:37:00+02:00
  checked: READ src/mcp/vice/vice-broker.mts:1115-1170 (handleFileTransfer) and src/mcp/vice/broker-transfer.mts:291-348 (receivePayloadToFile), :455-490 (stageFileSlot)
  found: the broker writes transfer_ready, then asynchronously pipeline(socket, transform, createWriteStream(tmp)) -> verifyObserved -> renameSync(tmp, destPath); nothing is ever reported back. stageFileSlot() for a repeated (grant, slot) rm's the previous file and mints a new random handle -- snapshot_save and snapshot_load share slot "snapshot", so the load's staged path never pre-exists.
  implication: the staged file becomes visible only at renameSync, which runs after an fs write + close on the libuv threadpool; the monitor relay forwards the next command immediately.

- timestamp: 2026-09-23T22:40:00+02:00
  checked: READ VICE 3.8 source (/home/henrik/Downloads/vice-3.8/src/monitor/monitor_binary.c:335-337, :738-757, :854-871; autostart.c:2011-2093; autostart-prg.c:64-95)
  found: error frames are response type 0x00 with the failing request's id; AUTOSTART -> mon_autostart -> autostart_autodetect probes disk -> tape -> tapecart -> snapshot -> CRT -> PRG, each opening the file itself, and logs "`<file>' is not a valid file." then returns -1 -> CMD_FAILURE 0x8f. UNDUMP -> machine_read_snapshot < 0 -> CMD_FAILURE 0x8f. autostart_prg's "Invalid size" prints file size minus 2.
  implication: 0x8f on AUTOSTART/UNDUMP means VICE could not read the named file; it is not a condition-syntax error.

- timestamp: 2026-09-23T22:45:00+02:00
  checked: MEASURED -- VICE's own per-instance log of the UAT run-2 instance, /home/henrik/.c64-re-tools/supervisor/6600/logs/x64sc-1790193804660.log lines 166-175 (stdout of x64sc, written by broker-launch.mts:1671-1672)
  found: the FAILING first vice_disk_attach (staged handle 4a571767...): "Filesystem Image: Error - Cannot open file `.../4a5717...'" then "Tape: Error - Cannot open file" then "Error - no CRT header found" (the file now OPENS) then "AUTOSTART: Error - Invalid size of '.../4a5717...': 174846" (= 174848 - 2, the COMPLETE blank.d64) then "is not a valid file" / "AUTOSTART: Error". The retry (handle 2028ff0c...) at line 181 attached at once.
  implication: the staged file did not exist when VICE's first two probes opened it and existed, complete, by the CRT probe microseconds later -- the upload's publish (renameSync) landed DURING VICE's probe sequence. Direct confirmation of H1 for the disk_attach case.

- timestamp: 2026-09-23T22:46:00+02:00
  checked: the run-1 instance log x64sc-1790193717602.log
  found: 8192 bytes, ends before any snapshot line -- x64sc stdout is block-buffered to the file and the tail was never flushed when the instance was killed.
  implication: no VICE-side record of run 1's UNDUMP failure; the UNDUMP case needs its own live measurement.

- timestamp: 2026-09-23T22:13:00+02:00
  checked: MEASURED live, mode A -- instrumented SCRATCH copy of the client (stock-machine.ts only; logs existsSync(emulatorFilename) right before the send, then the result), broker unit vice-broker-dbg0x8f, /usr/bin/x64sc 3.9, 15 iterations of {3x memory_read+execution_run, snapshot_save, snapshot_load, disk_attach}
  found: snapshot_load 7/15 failed, disk_attach 4/15 failed, all with the verbatim UAT text (0x8f, response type 0x00), each returning in ~20 ms. Cross-tab: 11/11 errors had existsAtSend=false and existsAtResult=true; 3/3 sends with existsAtSend=true succeeded; 16 sends with existsAtSend=false still succeeded (won the race). snapshot_save 15/15 ok.
  implication: every failure coincides with the staged file being absent at send time and present by the time VICE's error comes back.

- timestamp: 2026-09-23T22:14:00+02:00
  checked: MEASURED -- VICE log of the mode-A instance (~/.c64-re-tools/supervisor/6600/logs/x64sc-1790194416230.log)
  found: all 4 failing disk_attach handles (e179dfb5, 524f22f3, bd2901b3, 44d557fa) log "Filesystem Image: Error - Cannot open file" + "Tape: Error - Cannot open file"; two then open the full file on the PRG probe ("Invalid size ... 174846"), two stay absent through the PRG probe ("AUTOSTART: Error - Cannot open"). Successful undumps log "Unit 8: RESET (For undump)"; failing undumps log nothing (VICE's snapshot_open fails silently).
  implication: VICE-side confirmation that the emulator was handed a path that did not yet exist.

- timestamp: 2026-09-23T22:17:00+02:00
  checked: MEASURED live, mode B -- same scratch copy with DBG_WAIT_STAGED=1 (poll existsSync until the staged file exists, then send), same loop, 15 iterations
  found: snapshot_load 15/15 ok, disk_attach 15/15 ok. The file was absent at send time in 28/30 cases and appeared after 1-2 ms of waiting.
  implication: removing only the send-before-publish window removes every failure. The publish lags the client's "upload ok" by ~1-2 ms on this host.

- timestamp: 2026-09-23T22:21:00+02:00
  checked: MEASURED live, baseline -- the UNMODIFIED repo proxy src/mcp/vice/vice-proxy.ts, same loop, 15 iterations
  found: snapshot_load 8/15 failed, disk_attach 12/15 failed (20/30).
  implication: the production code reproduces it without any instrumentation; the scratch probe only delays the send slightly (lower failure rate in mode A).

- timestamp: 2026-09-23T22:23:00+02:00
  checked: READ stock-machine.test.ts:1108-1130, broker-control.mts:344-350 and :585-592, stock-handler.ts:147
  found: the unit-test UNDUMP stub POLLS up to 2 s for the staged file before opening it, so the suite cannot fail on this race. broker-control.mts comments name a `transfer_complete` reply "per this plan's wire_vocabulary" that nothing ever writes. stock-handler.ts:147 glosses every 0x8f as "(a condition syntax error reports exactly this and nothing more)", which pointed 64-11 at checkpoints.
  implication: why it was not caught: the only test for the path absorbs the race by design, and the accepted-risk assumption ("the window is expected to be dwarfed by the real network round-trip", stock-machine.ts:596-598) was never measured. It is false on a same-host broker.

## Resolution

root_cause: Upload-publish race in the Phase 64 file-transfer path. handleDiskAttach (stock-machine.ts:348-360), handleSnapshotLoad (:606-615) and handleAutostart (:219-231) send AUTOSTART/UNDUMP as soon as session.deps.transferFile() resolves. defaultTransferFile() (stock-connect.ts:497-510) resolves when the CLIENT's pipeline into the transfer socket finishes, then destroys the socket. The broker (vice-broker.mts:1147-1162 -> broker-transfer.mts:325-345) still has to drain the socket, flush and close the temp file, verify the digest and renameSync() it into place, and it never reports completion (no transfer_complete frame). The monitor relay forwards the command to VICE faster than that (~1-2 ms on a same-host broker), so VICE's autostart_autodetect()/machine_read_snapshot() opens a path that does not exist yet, returns -1, and monitor_binary_error() answers CMD_FAILURE 0x8f in VICE's generic error frame (response type 0x00, the failing request's own id). The file was freshly minted for each call (stageFileSlot mints a new random handle and deletes the superseded file), so no stale copy can mask it. Contributing (misdiagnosis, not cause): stock-handler.ts:147 describes every 0x8f as a condition syntax error.
fix: (not applied -- find_root_cause_only)
verification: (diagnosis only) live differential 20/30 (production) and 11/30 (instrumented, send at once) failures vs 0/30 when the send waits for the staged file
files_changed: []
