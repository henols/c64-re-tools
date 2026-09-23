---
status: diagnosed
trigger: "G-64-4 (Phase 64): a cold session's first vice_* call fails with 'stock handshake failed (binary monitor connection closed with 1 request(s) abandoned)' -- the broker hands out a grant / splices a relay before the freshly launched x64sc's binary monitor accepts connections, and the failed first attach kills the still-booting instance"
created: 2026-09-23T22:18:29+02:00
updated: 2026-09-23T22:35:00+02:00
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED -- the broker grants a cold-launched instance (launching -> granted, no readiness step) and answers the relay `attached` before its single emulator-leg dial has connected; that dial reaches 127.0.0.1:<port> 17-31ms after spawn, x64sc binds 55-142ms after spawn, so the dial gets ECONNREFUSED, handleRelayDeath() closes the client leg, and the client's first PING is abandoned
next_action: none (find_root_cause_only) -- hand diagnosis to /gsd-plan-phase --gaps
bug_class: Bohrbug-shaped order violation (deterministic on real x64sc: 22/22 immediate attaches failed; 0/8 failed once the attach waited for LISTEN)
reasoning_checkpoint:
  hypothesis: "The first vice_* call of a cold session fails because vice-broker.mts:942-943 grants the freshly spawned record with no readiness step, and broker-control.mts:1349 answers `attached` as soon as spliceRelay() (broker-relay.mts:329) has ISSUED its one netConnect(), not when that connect succeeded; the client's attach+PING lands 17-31ms after spawn while x64sc binds its binmon port 55-142ms after spawn, so the emulator leg fails ECONNREFUSED and the relay is torn down under the client's PING"
  confirming_evidence:
    - "MEASURED (instrumented scratch copy of resources/): emulator leg ERROR code=ECONNREFUSED at +0-2ms after the splice dial, dial 17-31ms after the broker's spawn log line, 5/5 cold attaches; the one dial that happened after bind logged CONNECTED +0ms"
    - "MEASURED (unmodified repo broker): Mode A (attach immediately after grant) 0/5 and 0/4 first-attempt success, port never LISTEN at grant time, LISTEN 55-142ms after grant; Mode B (wait for LISTEN in /proc/net/tcp, no connect, then attach) 8/8 success"
    - "MEASURED: every Mode A failure happened AFTER the client got `attached` (dialMonitorRelay ok:true, failure observed on the PING as close/ECONNRESET)"
    - "READ: broker-launch.mts:998 records that the cold arm grants without probing; selectWarmInstance() (vice-broker.mts:737) probes, the cold arm does not"
  falsification_test: "Mode B failing (attach after LISTEN still dying) would have refuted it -- it did not fail (8/8). An ECONNREFUSED-free emulator-leg error in the instrumented run would also have refuted it -- every failure was ECONNREFUSED."
  fix_rationale: "(direction only, not applied) gate the grant or the splice on the emulator leg actually being connectable, so the client never receives an acknowledgement for a leg that does not exist yet"
  blind_spots: "Recycle-respawn path (broker-launch.mts:1493-1495 sets respawned.state='granted') READ only, not measured live. Host-load sensitivity: bind latency measured 55-142ms on this host only. The 64-11 nested Claude Code session was not re-run."
  candidate_causes:
    - "code: cold arm launching->granted with no readiness step (vice-broker.mts:942-943); single un-retried emulator dial + premature `attached` (broker-relay.mts:329, broker-control.mts:1349)"
    - "environment: real x64sc bind latency (55-142ms after spawn) and monitor-service latency (PING answered 1.0-1.7s after bind) vs a stub TCP server in every test that binds synchronously"
    - "config: none -- VICE_BROKER_PROBE_TIMEOUT_S is never consulted on the cold arm"
  and_gate: "yes: (a) no readiness gate before grant/attach AND (b) x64sc bind latency > the client's grant->attach latency. (b) is always true for real x64sc here (55-142ms vs 17-31ms), which is why every cold session hits it and why stubbed tests never do. The kill-on-release is NOT a necessary condition for the first-call failure -- it matters only when the client session itself ends after the failure."

## Symptoms

expected: the first vice_* tool call of a fresh session against a broker with no warm instance returns isError false.
actual: (measured live 2026-09-23 22:01-22:04 CEST, genuine stock /usr/bin/x64sc VICE 3.9, fresh vice-proxy.ts over stdio, broker as systemd user unit) vice_ping needed 2 attempts in 2 of 2 fresh sessions. Plan 64-11 measured up to 11 consecutive failures in one session and reproduced it via a nested Claude Code session's first vice_ping.
errors: "vice_ping: stock handshake failed (binary monitor connection closed with 1 request(s) abandoned)." (also seen as "closed/errored with 1 request(s) abandoned")
reproduction: UAT test 2 in .planning/phases/64-files-as-bytes-both-directions/64-UAT.md. Live driver: scratchpad/uat64/run.mjs importing .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs.
started: discovered during plan 64-11's live check (2026-09-23); decision recorded in UAT: fix before v2.0.0 is production-ready.

## Eliminated

- hypothesis: "a failed first attach releases the grant, so handleRelease() kills the still-booting instance and every in-session retry cold-launches a new instance (non-convergent)"
  evidence: "stockConnect() failure path (stock-connect.ts:795-806) releases only the binary monitor CLAIM, never the grant; MEASURED 20 trials -> exactly 20 launches in the broker journal, in-session retries re-attached to the SAME instance and converged (2 attempts at 500ms spacing, 4-11 at 0ms spacing). The 64-11 '11 consecutive failures' burst at 21:07:31-35 was 8 DIFFERENT req-<pid> ids = 8 separate proxy processes, each cold-launching and each killed on its own process exit."
  timestamp: 2026-09-23T22:29:00+02:00

- hypothesis: "the emulator is up but refuses/closes the first monitor connection while still initialising (something past bind is not ready)"
  evidence: "Mode B: once the port was LISTEN, attach+PING succeeded 8/8 (the PING simply waits 1.0-1.7s for VICE's monitor loop to start servicing it, well inside ViceMonitorClient.send()'s 5000ms default, stock-protocol.ts:2166)"
  timestamp: 2026-09-23T22:27:00+02:00

## Evidence

- timestamp: 2026-09-23T22:18:30+02:00
  checked: .planning/debug/knowledge-base.md (Phase 0)
  found: one entry (gsd-internals-leak-into-src), no overlap with broker/relay/cold-launch/handshake symptoms
  implication: no known-pattern candidate; proceed normally

- timestamp: 2026-09-23T22:19:00+02:00
  checked: vice-broker.mts handleAcquire() (READ, lines 824-960)
  found: cold arm calls acquirePortAndLaunch() (record born state "launching", broker-launch.mts:640) then sets record.state="granted" at 943 with NO probe; the warm arm (selectWarmInstance) DOES re-probe via probeReady() at 737 before granting. Lines 824/943 match the 64-11 citation.
  implication: a readiness notion EXISTS (launching->ready via promoteLaunchingInstances() broker-launch.mts:1241 + probeReady() :1191 PING+EXIT) and the cold arm skips it; once state is "granted", promoteLaunchingInstances() (filters state==="launching") never looks at the record again. broker-launch.mts:998 says it outright: "Cold acquires kept working only because the cold arm grants without probing."

- timestamp: 2026-09-23T22:19:30+02:00
  checked: broker-relay.mts spliceRelay() (READ, 327-430) and broker-control.mts attach arm (READ, 1325-1357)
  found: spliceRelay() calls connectFn({host,port}) once (329), wires pipes and returns synchronously, before the TCP connect resolves; no retry. broker-control.mts:1349 then writes {kind:"attached"} immediately. An emulator-leg "error" -> reportDeath("relay_error") -> handleRelayDeath() (vice-broker.mts:1260) writes an incident, clears the claim, closes BOTH legs, leaves grant+instance standing.
  implication: `attached` acknowledges that the splice was WIRED, not that the emulator leg CONNECTED. The client (stockConnect, stock-connect.ts:738-747) sends PING on `attached`; the leg then dies -> "binary monitor connection closed with 1 request(s) abandoned" (stock-protocol.ts:2457) = exactly the observed text (1 abandoned = the PING).

- timestamp: 2026-09-23T22:20:00+02:00
  checked: stock-connect.ts failure path (READ, 774-808) + vice-proxy.ts ensureBrokerLease (READ, 1237-1326)
  found: a failed handshake releases ONLY the binary monitor claim (releaseMonitor), never the grant; the grant is released only when the proxy's control connection closes (releaseLeaseNow on stdin end / signals, vice-proxy.ts:1437-1459).
  implication: within ONE proxy session a retry re-claims (fresh handle) and re-attaches against the SAME instance -- no new cold launch. The 64-11 claim "every retry cold-launches a BRAND NEW instance" cannot hold for an in-session retry.

- timestamp: 2026-09-23T22:21:00+02:00
  checked: journalctl --user -u vice-broker-uat64 (MEASURED, UAT run 22:01-22:04) and -u vice-broker-g641 (64-11 run)
  found: UAT: one `launching` per session (22:01:57.603, 22:03:24.661), each followed 17-20ms later by `relay death ... trigger relay_error` + an incident record; NO second launch; the 2nd vice_ping (500ms later) succeeded on the same grant; release+kill only at session end. 64-11: bursts like 21:07:31.27 -> 21:07:35.09 of 8 launches ~0.5s apart, each with a DIFFERENT req-<pid> (request ids are req-${process.pid}-..., vice-broker-client.ts:84), i.e. 8 different proxy processes, each cold-launch -> relay_error in 9-25ms -> process exit -> handleRelease() kill (no "release on target" line because the relay session was already gone).
  implication: CONFIRMS the dial-before-bind race (relay_error 9-25ms after spawn, every cold launch in both journals). REFUTES the lead's convergence claim as stated: in-session retry converges on the same instance; "11 consecutive failures" came from a driver that started a fresh proxy per attempt, which is where kill-never-recycle + a new cold launch per attempt makes retry non-convergent. Also: every cold start writes a junk relay-death incident record into the machine-wide incidents dir.

- timestamp: 2026-09-23T22:26:00+02:00
  checked: live Mode A vs Mode B differential (MEASURED; unmodified repo broker as unit vice-broker-dbgcold, VICE_BIN=/usr/bin/x64sc VICE 3.9; driver scratchpad/dbgcold/race.mjs importing vice-broker-client.ts + broker-endpoint.ts; LISTEN detected by reading /proc/net/tcp, never by connecting)
  found: Mode A (acquire->claim->attach->PING at once) 0/5 first-attempt success, failure 20-55ms after grant, LISTEN only at 60-137ms after grant. Mode B (same, but wait for LISTEN first) 8/8 success; LISTEN 57-75ms after grant; PING reply 1433-1685ms after the attach.
  implication: the failure is exactly "attach before bind". Once bound, the instance is usable; the monitor just answers late (boot), which the existing client timeout absorbs.

- timestamp: 2026-09-23T22:28:00+02:00
  checked: in-session retry loop (MEASURED; Mode R: re-claim + re-attach on the SAME grant after each failure)
  found: RETRY_MS=0 -> 8, 7, 11, 8 attempts, all succeeded on the same instance once bound (68-142ms); RETRY_MS=500 -> 2, 2, 2 attempts (identical to the UAT's "vice_ping needed 2 attempts"). Journal: 20 trials = 20 launches; 53 relay-death incident records (42 relay_error, 11 relay_close).
  implication: "up to 11 consecutive failures in one session" = a tight retry loop outrunning a ~60-140ms bind, not non-convergence. Every failed cold attach also writes an incident record into ~/.c64-re-tools/incidents/ (this investigation left 61 such records, 20:15-20:35 UTC).

- timestamp: 2026-09-23T22:32:00+02:00
  checked: instrumented SCRATCH copy of resources/ (broker-relay.mjs logs the emulator leg's connect/error with errno; broker-launch.mjs stamps spawn time), run as the same unit name
  found: 5/5 cold attaches: "splice dial 127.0.0.1:6600" 17-31ms after spawn, then "emulator leg ERROR code=ECONNREFUSED +0..2ms". Tight retry: 3 more ECONNREFUSED, then "emulator leg CONNECTED +0ms" 58ms after spawn, PING answered 1599ms later.
  implication: direct observation of the mechanism; the client got `attached` in every one of these (its failure surfaced on the PING, not on the dial), so `attached` acknowledges a leg that was never connected.

- timestamp: 2026-09-23T22:33:00+02:00
  checked: text-monitor port timing (MEASURED, scratchpad/dbgcold/ports.mjs) and recycle path (READ)
  found: -remotemonitor port binds 1-2ms after the binmon port (63/65ms, 77/78ms). broker-launch.mts:1493-1495 sets a recycled respawn straight to state "granted" -- the same ungated transition as the cold arm.
  implication: the same race applies to a session whose first call is a text-channel tool, and (READ, not measured) to the first attach after a recycle. A fix at the splice/attach seam covers all three; a fix only in handleAcquire covers only the cold arm.

- timestamp: 2026-09-23T22:34:00+02:00
  checked: inFlight guard placement vs any readiness wait (READ)
  found: acquirePortAndLaunch() check-and-set is synchronous at broker-launch.mts:803-808, held across its own awaits (810, 829) and the spawn (864), released in the finally at 878-881 -- BEFORE handleAcquire() reaches the grant step (vice-broker.mts:942-943). probeReady() (broker-launch.mts:1191) is PING-then-EXIT with a 1s default timeout, but a fresh instance answers PING 1.0-1.7s after bind (measured), so one default probe usually fails; promoteLaunchingInstances() only ever looks at state "launching" and runs on the 500ms broker pass.
  implication: a readiness wait in handleAcquire after acquirePortAndLaunch() returns is outside the guard window (never between check and set). But vice-broker.mts:937-941 promises no await between resolving `record` and granting it; during such a wait the broker pass could promote the still-"launching" record to "ready" and a concurrent acquire's selectWarmInstance() could grant it to a different session -- an acquire-side wait must reserve the record first. Holding the wait INSIDE the guard is also legal (awaits already sit there) but serialises every boot.

- timestamp: 2026-09-23T22:34:30+02:00
  checked: sibling gap G-64-3 (.planning/debug/vice-0x8f-disk-attach-snapshot-load.md)
  found: G-64-3's root cause is an upload whose completion is acknowledged when the CLIENT's write finishes, not when the broker has published the file. G-64-4's `attached` is acknowledged when the broker has WIRED the splice, not when the emulator leg has CONNECTED.
  implication: same missing "far side is ready" acknowledgement pattern on two broker seams; different code, same class.

## Resolution

root_cause: Order violation between the broker's grant/attach acknowledgements and the real emulator's bind. handleAcquire()'s cold arm moves the freshly spawned record from "launching" straight to "granted" (vice-broker.mts:942-943) with no readiness step, although one exists (probeReady(), promoteLaunchingInstances()) and the warm arm uses it; handleRelayAttach() -> spliceRelay() then issues ONE un-retried netConnect() to the emulator port (broker-relay.mts:329) and broker-control.mts:1349 answers `attached` as soon as that connect is ISSUED, not when it succeeds. On real x64sc the client's attach+PING arrives 17-31ms after spawn while the binmon port binds 55-142ms after spawn (measured), so the emulator leg fails ECONNREFUSED, handleRelayDeath() writes an incident and closes the client leg, and the PING is abandoned -> "stock handshake failed (binary monitor connection closed with 1 request(s) abandoned)". Correction to the 64-11 trace: the failed attach does NOT release the grant (stock-connect.ts:795-806 releases only the monitor claim), so an in-session retry reaches the SAME instance and converges once it binds; handleRelease()'s kill only destroys the booting instance when the client SESSION ends after the failure (a one-shot client, or 64-11's per-attempt proxies).
fix: (not applied -- find_root_cause_only)
verification: (diagnosis only) live differential on genuine /usr/bin/x64sc VICE 3.9: immediate attach 0/9 first-attempt success, attach-after-LISTEN 8/8; instrumented broker shows ECONNREFUSED on every cold emulator-leg dial
files_changed: []
