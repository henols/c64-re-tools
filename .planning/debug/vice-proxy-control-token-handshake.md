---
status: diagnosed
trigger: "UAT gap G-64-1 (Phase 64): every vice_* tool through vice-proxy.ts against the real broker and /usr/bin/x64sc returns 'stock handshake failed (vice: missing or invalid control token).'"
created: 2026-09-23T16:00:00Z
updated: 2026-09-23T16:45:00Z
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus

bug_class: Bohrbug (deterministic; every call fails identically, reproduced offline 3/3 scenarios)
status: ROOT CAUSE CONFIRMED (goal find_root_cause_only -- no fix applied)
hypothesis: CONFIRMED H1 -- no production code supplies StockConnectDeps.controlToken, so stock-connect.ts's default relay dial sends token "" and broker-control.mts's token gate refuses the attach. H2 (state-dir split) is REAL but a SEPARATE, latent defect that did not contribute to the UAT run.
next_action: return ROOT CAUSE FOUND to orchestrator for plan-phase --gaps

reasoning_checkpoint:
  hypothesis: "Every vice_* call fails because stockConnect()'s default dialMonitorSocket (and, for file tools, defaultTransferFile) sends `token: controlToken ?? \"\"` and production never sets controlToken: vice-proxy.ts dispatchStockFor() omits it, StockDispatchDeps documents it as test-only, and BrokerControlSession hides the token it already holds. The broker dispatches attach/transfer AFTER its per-boot token gate, so the empty string is refused with 'missing or invalid control token'."
  confirming_evidence:
    - "Offline repro scenario A: the REAL vice-proxy.ts over stdio against the REAL startControlListener returns exactly 'vice_ping: stock handshake failed (vice: missing or invalid control token).'; acquire and monitor_claim fire, onRelayAttach never does."
    - "Scenario B (dispatchStock with dispatchStockFor's three deps verbatim) = identical failure. Scenario C (same + controlToken) = onRelayAttach fires, i.e. the token gate passes; controlToken is the only variable changed."
    - "grep -a controlToken vice-proxy.ts = 0 hits; stock-connect.ts:414/:508/:530 `controlToken ?? \"\"`; broker-control.mts:1284-1286 gate."
  falsification_test: "If a production path supplied the token (or stock-connect fell back to broker.json), scenario A would reach onRelayAttach. It did not."
  fix_rationale: "The relay/transfer connections are new sockets opened outside the authenticated control session; they must either carry the credential the session holds, or the broker must stop requiring it for these two ops. Either closes the cause, not a symptom."
  blind_spots: "Did not re-run against a live broker + /usr/bin/x64sc (unnecessary: the offline repro uses the real listener and real proxy, and the symptom text is byte-identical). Did not exercise text-channel tools, but text-tools.ts:159 threads the same undefined deps.controlToken into text-connect.ts:108's identical `?? \"\"` default."
  candidate_causes:
    - "code: relay/transfer dial defaults present an empty token (CONFIRMED cause of G-64-1)"
    - "config/environment: broker state dir vs client discovery dir split (repo-local vs ~/.c64-re-tools) -> stale or missing broker.json (REAL, separate; not active in the UAT run -- launcher pins --repo-root)"
    - "config: relay/transfer dial port fixed at 19510, ignoring broker.json control_port / VICE_BROKER_CONTROL_PORT (latent; not active -- UAT broker was on 19510)"
    - "data: stale ~/.c64-re-tools/supervisor/broker.json token (ELIMINATED for the UAT run -- client never reads that path absent VICE_POOL_DIR)"
  and_gate: "No for G-64-1: the token defect alone reproduces the exact failure with the state dirs aligned (scenario A). Yes for the broader 'real session works end to end' truth: with the documented start command (npx broker / shipped systemd+launchd units) the client fails EARLIER on the state-dir split, so a fix for the token alone leaves the documented route broken; 64-07 hit both in sequence."

## Symptoms

expected: vice_* tool calls through a real Claude Code session (vice-proxy.ts over stdio) reach the emulator; no broker-side path in any result.
actual: broker started as systemd user unit via <repo>/.c64-re-tools/bin/vice-launcher.sh, VICE_BIN=/usr/bin/x64sc, cwd=repo root. Broker log: backend "stock", control listener 127.0.0.1,172.25.0.1,172.17.0.1 port 19510, state directory <repo>/.c64-re-tools/supervisor, wrote <repo>/.c64-re-tools/supervisor/broker.json. vice_ping, vice_snapshot_save, vice_snapshot_load, vice_autostart, vice_disk_attach each returned "stock handshake failed (vice: missing or invalid control token)."
errors: "stock handshake failed (vice: missing or invalid control token)." (broker-control.mts token gate)
reproduction: Test 1 in .planning/phases/64-files-as-bytes-both-directions/64-UAT.md
started: discovered during UAT 2026-09-23; first found by plan 64-07 live attempt (64-07-SUMMARY.md Deviation 3, D6/D7)

## Eliminated

- hypothesis: "H2 as the cause of the UAT failure -- the client presented the stale 2026-09-19 token from ~/.c64-re-tools/supervisor/broker.json"
  evidence: "The UAT broker was started through vice-launcher.sh, which execs `--repo-root $REPO_ROOT` (vice-launcher.sh:287), so it wrote <repo>/.c64-re-tools/supervisor/broker.json; the client reads VICE_POOL_DIR ?? <repo>/.c64-re-tools/supervisor (vice-broker-client.ts:96-101) -- AGREE (real-resolver census). The client never reads ~/.c64-re-tools absent VICE_POOL_DIR. A wrong token would have failed acquire with a broker-control message, never reaching stock-handler.ts's 'stock handshake failed'. The empty-token path reproduces the symptom with no second broker.json in play."
  timestamp: 2026-09-23T16:40:00Z

- hypothesis: "stockConnect() falls back to reading broker.json (or the session) for a token when controlToken is absent"
  evidence: "stock-connect.ts:409-420, :477-531, :711-712, :746 -- the only source is deps.controlToken; `?? \"\"` is the fallback. BrokerControlSession (vice-broker-client.ts:884-923) exposes no token accessor."
  timestamp: 2026-09-23T16:12:00Z

## Evidence

- timestamp: 2026-09-23T16:00:00Z
  checked: .planning/debug/knowledge-base.md
  found: one entry (gsd-internals-leak-into-src), unrelated to transport/token. No known-pattern candidate.
  implication: proceed with open investigation.

- timestamp: 2026-09-23T16:10:00Z
  checked: src/mcp/vice/vice-proxy.ts:650-656 dispatchStockFor()
  found: builds deps with ONLY ensureLease, resolvedBinaryPath, resolvedBinaryPathIsResolved. `grep -a -n controlToken vice-proxy.ts` = 0 hits.
  implication: StockDispatchDeps.controlToken is always undefined in production.

- timestamp: 2026-09-23T16:11:00Z
  checked: src/mcp/vice/stock-dispatch.ts:221-225 (field doc) and :452-460 stockConnectDepsFor()
  found: controlToken documented as "Test-only override paired with dialMonitorSocket ... Production passes neither"; stockConnectDepsFor copies it only `if (deps.controlToken)`.
  implication: nothing else in the production chain populates StockConnectDeps.controlToken.

- timestamp: 2026-09-23T16:12:00Z
  checked: src/mcp/vice/stock-connect.ts:409-420 defaultDialMonitorSocket(), :477-531 defaultTransferFile(), :711-712 and :746 in stockConnect()
  found: both defaults send `token: controlToken ?? ""`. No fallback -- stock-connect.ts never reads broker.json and never asks brokerControl for its token.
  implication: absent deps.controlToken, every relay attach and every file transfer presents the empty string. Lead 1's "does it fall back to reading broker.json?" -- NO.

- timestamp: 2026-09-23T16:13:00Z
  checked: src/mcp/vice/broker-endpoint.ts:647-701 performAttach(), :714 dialMonitorRelay()
  found: attach line carries opts.token verbatim; an {"kind":"error","message":M} reply becomes reason `vice: ${M}`. Port is DEFAULT_CONTROL_PORT 19510 (fixed endpoint, not broker.json).
  implication: 'vice: missing or invalid control token' is exactly performAttach()'s rendering of the broker's gate reply.

- timestamp: 2026-09-23T16:14:00Z
  checked: src/mcp/vice/broker-control.mts:1284-1286 token gate; stock-handler.ts:123 convertHandshakeError()
  found: gate `tokensMatch(req.token ?? "", opts.token)` -> "missing or invalid control token"; attach (Phase 63) and transfer (Phase 64) are dispatched AFTER this gate (only hello is ahead). convertHandshakeError renders `${tool}: stock handshake failed (${message}).`
  implication: symptom string = convertHandshakeError(ViceError("vice: missing or invalid control token")) thrown from stockConnect's dial step. The claim step (over the token-authenticated control session) succeeded, otherwise the text would be "monitor claim ... failed".

- timestamp: 2026-09-23T16:15:00Z
  checked: vice-broker-client.ts:1399-1470 openBrokerControl() / createSession(socket, token); BrokerControlSession interface :884-923
  found: the token IS read from broker.json by openBrokerControl() and captured in createSession()'s closure (every session op sends it), but BrokerControlSession exposes no accessor for it; buildHeldLease() (vice-proxy.ts:1198) carries brokerControl only.
  implication: lead 3 answered -- acquire/claim authenticate via the session closure; that value never escapes to the relay/transfer dial, which opens a NEW connection outside the session.

- timestamp: 2026-09-23T16:16:00Z
  checked: git history -- cfd02597 (63-01) introduced defaultDialMonitorSocket + StockConnectDeps.controlToken; bba7a44e (63-02) added StockDispatchDeps.controlToken labelled test-only; `git log -S controlToken -- vice-proxy.ts` empty
  found: defect present since 2026-09-19 (Phase 63), not introduced by Phase 64; Phase 64 extended it to defaultTransferFile(). 63-01-SUMMARY dev.1 added the field "so the default can authenticate" but no plan built the production supplier.
  implication: regression window = Phase 63 relay cutover.

- timestamp: 2026-09-23T16:18:00Z
  checked: state-dir resolution, both sides (lead 2). vice-broker.mts:219-224 parseArgs(); broker-home.mts:95-112; vice-broker-client.ts:96-101 brokerRootDir(); resources/vice-launcher.sh:287; vice-cli.mjs:188-196
  found: broker state dir = --state-dir ?? VICE_POOL_DIR ?? (--repo-root ? <repo>/.c64-re-tools/supervisor : brokerStateDir() = ~/.c64-re-tools/supervisor). Client = VICE_POOL_DIR ?? repo-root.ts supervisorDir() = <repo>/.c64-re-tools/supervisor -- the client NEVER consults broker-home.mts. The launcher always execs with `--repo-root "$REPO_ROOT"`; `npx -y @henols/vice-mcp broker` (BROKER_START_COMMAND, broker-endpoint.ts:435) passes no --repo-root.
  implication: launcher-started broker (the UAT run) -> both sides agree on <repo>/.c64-re-tools/supervisor/broker.json. Machine-level start (npx broker / systemd service with no --repo-root) -> broker writes ~/.c64-re-tools/supervisor/broker.json, client reads the repo-local file -> never_started or stale-record mismatch. This is 64-07's VICE_BROKER_HOME/VICE_POOL_DIR misalignment.

- timestamp: 2026-09-23T16:19:00Z
  checked: the two on-disk broker.json files (tokens compared, never printed)
  found: <repo>/.c64-re-tools/supervisor/broker.json pid 3138210 started 2026-09-23T15:30:02Z (the UAT broker); ~/.c64-re-tools/supervisor/broker.json pid 961761 started 2026-09-19T16:11:36Z; tokens differ.
  implication: the UAT client read the fresh repo-local record (a stale token would have failed openBrokerControl/acquire, and the error would then be a broker-control message, not "stock handshake failed"). H2 did not contribute to the UAT failure.

- timestamp: 2026-09-23T16:20:00Z
  checked: REQUIREMENTS.md decision 5 (line 25-26), ROADMAP.md:789-795 and Phase 66 SC2 (:2420); 63-01-PLAN T-63-01; 63-SECURITY.md:45
  found: owner decision: "the per-boot token is dropped", "No phase may plan an auth mechanism, a credential file"; discovery "No file on disk"; broker.json + readers deleted in Phase 66. Yet 63-01's T-63-01 mitigation deliberately made attach require "the per-boot control token AND the per-claim handle", recorded closed in 63-SECURITY.md.
  implication: the fix direction has a decision fork -- threading the broker.json token through (todo's direction) re-entrenches a credential Phase 66 must delete; moving attach/transfer ahead of the gate (handle-only auth) matches decision 5 but reverses a recorded T-63-01 mitigation. Planner must decide; not a debugger call.

- timestamp: 2026-09-23T16:35:00Z
  checked: offline reproduction scratchpad/repro-token.mts -- REAL resources/broker-control.mjs startControlListener on 127.0.0.1:19510 with a known token, broker.json in a scratch VICE_POOL_DIR, scratch CLAUDE_PROJECT_DIR, no x64sc
  found: |
    A (real vice-proxy.ts over stdio, tools/call vice_ping): "vice_ping: stock handshake failed (vice: missing or invalid control token)." -- callbacks: onAcquire, onMonitorClaim, onMonitorRelease; onRelayAttach NEVER.
    B (dispatchStock, deps = {ensureLease, resolvedBinaryPath, resolvedBinaryPathIsResolved}): identical text, identical callbacks.
    C (B + controlToken = broker.json token): onRelayAttach FIRES ("TOKEN GATE PASSED"); error becomes the stub's own deliberate "attach refused: denied".
  implication: H1 confirmed by a single-variable differential. Byte-identical to the UAT symptom with no broker or emulator involved.

- timestamp: 2026-09-23T16:38:00Z
  checked: scratchpad/repro-statedir.mts -- real parseArgs() (resources/vice-broker.mjs) vs real brokerJsonPath() (vice-broker-client.ts), CLAUDE_PROJECT_DIR=repo
  found: |
    AGREE    vice-launcher.sh (--repo-root) -> both <repo>/.c64-re-tools/supervisor/broker.json
    MISMATCH npx -y @henols/vice-mcp broker -> broker ~/.c64-re-tools/supervisor/broker.json, client <repo>/.c64-re-tools/supervisor/broker.json
    MISMATCH npx broker + VICE_BROKER_HOME=/tmp/x -> broker /tmp/x/supervisor/broker.json, client repo-local
    AGREE    launcher + VICE_BROKER_HOME (VICE_BROKER_HOME ignored when --repo-root is given)
  implication: H2 is real and independent. The start command README.md:211, service/vice-broker.service:31, service/com.henols.vice-broker.plist:34-37 and BROKER_START_COMMAND (broker-endpoint.ts:435) all name the MISMATCH route. vice-proxy.ts's own brokerNeverStartedMessage() names the launcher instead (the AGREE route), and the launcher contradicts BROKER-06 (state "never inside any project's .c64-re-tools/").

- timestamp: 2026-09-23T16:42:00Z
  checked: why no test caught H1 -- vice-proxy.test.ts:1911-1960 startControlBroker(), :2016-2017, :2106-2108; broker-endpoint.ts:715; stock-connect.ts:409-416
  found: vice-proxy.test.ts ALREADY spawns the real vice-proxy.ts against a real startControlListener and sends tools/call vice_ping, but (a) binds the listener on port 0 while the relay dial is hard-wired to DEFAULT_CONTROL_PORT 19510 (stock-connect never forwards a port), and (b) discards the vice_ping result (`await proxy.nextMessage(); // the forwarded call's own response`), asserting only on control-connection count. Every other relay/transfer test injects dialMonitorSocket/transferFile stubs or passes the token straight to dialMonitorRelay (stock-live-relay.test.ts:360/:440).
  implication: the one test with the full production path in hand throws away the result; the relay endpoint is not injectable through the proxy, so the test could not have asserted success even if it tried. Side finding (latent, not G-64-1): relay/transfer ignore broker.json control_port and VICE_BROKER_CONTROL_PORT (broker-control.mts:806-812).

## Resolution

root_cause: |
  PRIMARY (causes G-64-1): the Phase 63 relay cutover (cfd02597, 63-01) made stockConnect()'s default socket source a NEW connection to the fixed endpoint that must present the per-boot control token (stock-connect.ts:409-420; Phase 64 added the same shape to defaultTransferFile(), :477-531, and text-connect.ts:100-110 is the text-channel twin), and broker-control.mts dispatches `attach`/`transfer` after its token gate (:1284-1286). No production code ever supplies that token: vice-proxy.ts dispatchStockFor() (:650-656) omits StockDispatchDeps.controlToken, stock-dispatch.ts:221-225 documents the field as "Test-only ... Production passes neither" (bba7a44e, 63-02), and the token openBrokerControl() reads from broker.json stays locked inside createSession()'s closure (vice-broker-client.ts:1035, BrokerControlSession has no accessor). Result: every relay attach sends token "", the broker refuses, and stock-handler.ts:123 renders "stock handshake failed (vice: missing or invalid control token)." for every vice_* tool on both channels.
  SECONDARY (independent, latent; blocks the DOCUMENTED start route, not the UAT run): the broker's state dir and the client's broker.json discovery dir diverge. With no --repo-root the broker writes brokerStateDir() = ~/.c64-re-tools/supervisor (vice-broker.mts:219-222, BROKER-06), but the client reads VICE_POOL_DIR ?? repo-root.ts supervisorDir() = <project>/.c64-re-tools/supervisor (vice-broker-client.ts:96-101) and never consults broker-home.mts. The documented command (README.md:211, both shipped service units, BROKER_START_COMMAND) takes the no---repo-root path; only vice-launcher.sh (:287, pins --repo-root) aligns them. The stale 2026-09-19 ~/ broker.json is the residue of that route.
fix: (not applied -- goal find_root_cause_only)
verification: offline reproduction, 3 scenarios, real proxy + real listener; see Evidence 16:35 and 16:38
files_changed: []
