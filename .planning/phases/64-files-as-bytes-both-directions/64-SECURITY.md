---
phase: "64"
slug: "files-as-bytes-both-directions"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 64 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time: all 16 plans carry a `<threat_model>` block (96 rows).
> `workflow.security_block_on: high`. No SUMMARY carries a `## Threat Flags` section.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| transfer socket → receiver (broker or client) | Every header field and payload byte on a transfer connection comes from an unauthenticated peer | untrusted bytes, capped at 16777216, length+sha256 verified before publish |
| client → broker `attach` / `transfer` arms | Unauthenticated TCP peer presenting a broker-minted per-claim handle; the handle is the only authority (owner decision 5, G-64-1) | 32-hex handle, no credential |
| token-gated control session → handle mint | The only place an attach or transfer handle is minted and handed out | control token (per boot), handles |
| control connection → `stage_file` | A grant-holding connection asks the broker to allocate storage on its own disk | slot name (never reaches a path) |
| uploaded bytes → broker's own disk | Untrusted bytes written under the broker's machine-level root (`~/.c64-re-tools/`) | staged program, disk and snapshot images |
| downloaded bytes → client filesystem | Untrusted bytes written under the client's own `.c64-re-tools/snapshots/` | snapshot images |
| tool argument → client filesystem | Agent-supplied `name` / `unit` / `path` values | snapshot name, drive unit, caller-chosen file path (unrestricted by D-14) |
| broker → client replies and tool results | Completion and error lines cross the container/host boundary; results reach the agent | kind, byteLength, sha256, handle, errno code — never a broker-side path |
| broker → operator stderr / journal | Full failure reasons, paths included, for the person running the broker | broker-side paths |
| broker → emulator monitor ports | The broker dials an unauthenticated binary or text monitor on loopback that may not be bound yet | monitor protocol |
| broker process ↔ broker process (shared VICE_BROKER_HOME) | Only the kernel's control-port bind decides which process is the broker | staging directories, broker.json |
| on-disk pid records → reap decisions; staging listing → recursive delete | State a previous broker left drives deletion | directory names, pid records |
| machine-level state dir → client | Client reads broker.json (carries the per-boot control token) from the broker's directory | control token, port |
| package tarball → consuming project | The `files` array decides which modules exist on the npm route | shipped modules |
| live-check plans → host (systemd user manager, incident dir, nested Claude session) | Plans 64-11 and 64-14 drive a real broker and emulator | transient units, incident records, MCP tool calls |

---

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|------|----------|-----------|----------|-------------|-----------------------|--------|
| T-64-01 | 64-01 | Denial of Service | `receivePayloadToFile()` — a sender lying about, or simply miscomputing, the declared `byt… | high | mitigate | transfer-hash.mts:83-91 observed-count cap; broker-transfer.mts:438-445 declared-length check; test broker-transfer.test.mts:334 | closed |
| T-64-02 | 64-01 | Tampering | `receivePayloadToFile()` — a connection dropped mid-payload leaving a partial file visible… | high | mitigate | broker-transfer.mts:452-530 temp, verify, renameSync, cleanupTmp on every branch; tests :390, vice-broker-staging.test.ts:402 | closed |
| T-64-03 | 64-01 | Tampering / Elevation of Privilege | `validateContainedDestination()` — a destination name escaping the client's per-kind direc… | high | mitigate | transfer-paths.ts:83-103 six refuse-not-sanitise rules; tests transfer-paths.test.ts:25/31/37/43 (no production caller yet, by design) | closed |
| T-64-04 | 64-01 | Tampering | `readTransferHeader()` — a malformed or hostile JSON header line | medium | mitigate | broker-transfer.mts:147-180 guarded JSON parse, per-field type checks, only pre-terminator bytes decoded; test :200 | closed |
| T-64-05 | 64-01 | Information Disclosure | `sendPayloadFromFile()` reads whatever local path its caller supplies | medium | accept | Accepted — see Accepted Risks log (D-14, stock-machine.ts:151-163) | closed |
| T-64-06 | 64-01 | Denial of Service | Memory exhaustion from buffering a whole payload | medium | mitigate | pipeline() throughout, no payload Buffer.concat (broker-transfer.mts:339/352/466); test :430 | closed |
| T-64-SC | 64-01 | Tampering | npm/pip/cargo installs | high | mitigate | runtime deps exactly @mastra/mcp + @mastra/core; package-lock unchanged since 42f83bc7 (pre-phase); new modules import node: built-ins only | closed |
| T-64-07 | 64-02 | Elevation of Privilege | The `transfer` arm — a caller presenting another session's handle to read or overwrite its… | high | mitigate | vice-broker.mts:648 randomBytes(16); broker-control.mts:1741 gates stage_file on ownsTarget() | closed |
| T-64-08 | 64-02 | Elevation of Privilege | The `stage_file` arm — a connection allocating staging against a grant it does not hold | high | mitigate | broker-control.mts:1741-1748 refuses denied before the callback; test broker-control.test.ts:1192 | closed |
| T-64-09 | 64-02 | Spoofing | A transfer request arriving before the token gate | medium | mitigate | stage_file stays behind the token gate (broker-control.mts:1493); test :1440. transfer moved pre-gate by 64-08, covered by T-64-G1-02 | closed |
| T-64-10 | 64-02 | Tampering | A malformed reply line from an unknown listener on the control port | medium | mitigate | broker-endpoint.ts:988-1013 guarded parse; unrecognisable reply is a refusal, never a throw | closed |
| T-64-11 | 64-02 | Denial of Service | Two transfers racing the same handle against one staged file | medium | mitigate | vice-broker.mts:1223-1226 refuses by name ("already in flight", code denied); test vice-broker-staging.test.ts:590 | closed |
| T-64-SC | 64-02 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-12 | 64-03 | Tampering / Elevation of Privilege | `stageFileSlot()` — a slot string carrying a separator, a traversal segment or a NUL byte … | high | mitigate | broker-transfer.mts:615-621 refuses NUL/empty/./../separator in grantId and slot; :649 names file after handle; test :922 | closed |
| T-64-13 | 64-03 | Elevation of Privilege | `resolveStagedFile()` — guessing another session's handle | high | mitigate | broker-transfer.mts:648 16-byte hex handle; :687 refusal carries no path; test :971 | closed |
| T-64-14 | 64-03 | Denial of Service | Unbounded staged bytes accumulating across a long session | medium | mitigate | broker-transfer.mts:651-665 slot supersession unlinks previous file; test :869 | closed |
| T-64-15 | 64-03 | Information Disclosure | A staging directory outliving its session and remaining readable | medium | mitigate | broker-transfer.mts:728-747 recursive delete from handleRelease (vice-broker.mts:2078/2106) on socket close; test vice-broker-staging.test.ts:647 | closed |
| T-64-16 | 64-03 | Denial of Service | Two transfers racing one staged file | medium | mitigate | broker-transfer.mts:700-706 synchronous in-flight check-and-set; tests :953, staging :590 | closed |
| T-64-17 | 64-03 | Tampering | A partially-received upload becoming resolvable and then consumed as if complete | high | mitigate | upload through receivePayloadToFile into the staged path (vice-broker.mts:1254-1260); atomic publish as T-64-02 | closed |
| T-64-SC | 64-03 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-18 | 64-04 | Tampering / Elevation of Privilege | `handleSnapshotSave` / `handleSnapshotLoad` — a `name` treated as a path fragment | high | mitigate | stock-machine.ts:456/:583 validateSnapshotName before any path; test stock-machine.test.ts:670 | closed |
| T-64-19 | 64-04 | Information Disclosure | A tool result leaking a broker-side path to the agent | medium | mitigate | result carries handle, no sentPath; stock-machine.test.ts:679-697 + assertNoStagedPathLeak :662 | closed |
| T-64-20 | 64-04 | Tampering | A download interrupted mid-payload leaving a partial `.vsf` at its final name that a later… | high | mitigate | client download temp, verify, rename (stock-connect.ts:584-616); test stock-machine.test.ts:787 | closed |
| T-64-21 | 64-04 | Spoofing | An agent reusing a handle from one result as an argument to a tool that does not accept on… | low | mitigate | OPEN: no handle-shape refusal exists; a 32-hex handle passes validateSnapshotName (transfer-paths.ts SNAPSHOT_NAME_RE) and is accepted as a snapshot name; the comment at stock-machine.ts:448-451 overstates | open — below high threshold (non-blocking) |
| T-64-SC | 64-04 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-22 | 64-05 | Denial of Service | `reapOrphanedConfigScratch()` — deleting a live emulator's configuration directory out fro… | high | mitigate | broker-kill.mts:695-702, 795-825 live-pid + identity check, no record means leave in place; tests broker-kill.test.ts:1011/1030/1048/1066 | closed |
| T-64-23 | 64-05 | Tampering | A forged or corrupted pid record steering the reap into deleting the wrong directory | medium | mitigate | atomic pid record (broker-launch.mts:512-516); defensive parse (broker-kill.mts:723-742); delete confined to join(root, readdir entry) | closed |
| T-64-24 | 64-05 | Information Disclosure | Staged payload bytes surviving on real disk across a reboot, now that they no longer live … | medium | mitigate | broker-kill.mts:893-912 unconditional staging sweep, called at vice-broker.mts:2555 | closed |
| T-64-25 | 64-05 | Denial of Service | A sweep racing a live transfer and deleting a file mid-stream | medium | mitigate | single startup call site vice-broker.mts:2555; the two setIntervals (:2604, :2630) do no sweeping | closed |
| T-64-SC | 64-05 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-26 | 64-06 | Information Disclosure | `handleAutostart` / `handleDiskAttach` — an unrestricted `path` reading any client-readabl… | medium | accept | Accepted — see Accepted Risks log (D-14, stock-machine.ts:151-163) | closed |
| T-64-27 | 64-06 | Repudiation | A user believing their in-game saves persisted when the staged image is deleted at session… | high | mitigate | stock-machine.ts:296 DISK_ATTACH_WRITE_LOSS, in result at :405; pin test stock-machine.test.ts:537 | closed |
| T-64-28 | 64-06 | Tampering | `vice_disk_attach` silently retargeting a request for unit 9, 10 or 11 to unit 8 | medium | mitigate | stock-machine.ts:345-352 refuses units 9-11 by name; tests :486, :502 | closed |
| T-64-29 | 64-06 | Denial of Service | Two tools sharing one staging slot, so attaching a disk deletes an autostarted program's s… | medium | mitigate | distinct slots autostart and disk8 (stock-machine.ts:144, :269); test :587 | closed |
| T-64-30 | 64-06 | Information Disclosure | A tool result leaking a broker-side path | medium | mitigate | handle instead of path; assertNoStagedPathLeak in autostart/disk tests (:376, :512) | closed |
| T-64-SC | 64-06 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-31 | 64-07 | Information Disclosure | Any of the four tool results leaking a broker-side path through a key nobody anticipated | high | mitigate | transfer-disjoint-roots.test.ts:405-433 recursive result walk; planted-key self-test :436 | closed |
| T-64-32 | 64-07 | Information Disclosure | Staged payload bytes surviving a session close and remaining readable under the broker roo… | medium | mitigate | transfer-disjoint-roots.test.ts:625-628 staging dir gone after close | closed |
| T-64-33 | 64-07 | Repudiation | A green test being later mistaken for a stronger claim than it makes | medium | mitigate | D-17 limit stated in transfer-disjoint-roots.test.ts:19-26 and evidence/64-convergence-metric.md:137-146 | closed |
| T-64-34 | 64-07 | Tampering | A regression between this phase and Phase 66 going uncaught because nothing mechanical gua… | low | accept | Accepted — see Accepted Risks log (evidence/64-convergence-metric.md:120-135) | closed |
| T-64-SC | 64-07 | Tampering | npm/pip/cargo installs | high | mitigate | no packages added | closed |
| T-64-G1-01 | 64-08 | Elevation of Privilege | broker-control.mts attach arm (pre-gate) | high | mitigate | vice-broker.mts:1600-1604 length check, timingSafeEqual, second-attach refusal; minted by gated monitor_claim (:1069); cleared on relay death (:1385/1414); test broker-control.test.ts:1526 | closed |
| T-64-G1-02 | 64-08 | Information Disclosure | broker-control.mts transfer arm (pre-gate) | high | mitigate | broker-control.mts:1433-1483 handle-only; vice-broker.mts:1210-1226 unknown-handle refusal + in-flight guard; tests staging :379/:590, broker-control :1403 | closed |
| T-64-G1-03 | 64-08 | Elevation of Privilege | gated ops on a connection after a refused pre-gate op | high | mitigate | token checked per line (broker-control.mts:1492-1497); test :1488 | closed |
| T-64-G1-04 | 64-08 | Spoofing | handle guessing over one long-lived connection | medium | accept | Accepted — see Accepted Risks log (evidence/64-g641-handle-only-authority.md:106-120) | closed |
| T-64-G1-05 | 64-08 | Spoofing | VICE_BROKER_CONTROL_PORT pointing the client at a foreign listener | low | mitigate | broker-endpoint.ts:97-102 port 1..65535 only; hello classification :215 | closed |
| T-64-G1-06 | 64-08 | Tampering | bind set | high | mitigate | wildcard bind refused (vice-broker.mts:2159-2171); bind set unchanged | closed |
| T-64-G1-SC | 64-08 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (08-PLAN threat model) | closed |
| T-64-G1-07 | 64-09 | Information Disclosure | attach/transfer request lines | low | mitigate | request lines broker-endpoint.ts:783, :1023-1028; key-set tests broker-endpoint.test.ts:1060/1088/1114 | closed |
| T-64-G1-08 | 64-09 | Elevation of Privilege | re-threading the per-boot token into a dial (route a) | medium | mitigate | no token field in any dial options type (broker-endpoint.ts:893-911, stock-connect.ts:357-395) | closed |
| T-64-G1-09 | 64-09 | Denial of Service | a new client against a broker built before plan 64-08 | low | accept | Accepted — see Accepted Risks log (09-PLAN threat model) | closed |
| T-64-G1-SC | 64-09 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (09-PLAN threat model) | closed |
| T-64-G1-10 | 64-10 | Spoofing | a stale broker.json at the machine-level root (one from 2026-09-19 exists on this host) | medium | mitigate | vice-broker-client.ts:183-195 stale-record classification; :1421-1426 refuses before connecting | closed |
| T-64-G1-11 | 64-10 | Information Disclosure | broker.json's token now read from ~/.c64-re-tools/supervisor | low | mitigate | vice-broker.mts:392-401 chmod 0600 before content; root broker-home.mts:131 | closed |
| T-64-G1-12 | 64-10 | Spoofing | an attacker-chosen VICE_BROKER_HOME/VICE_POOL_DIR pointing the client at a forged broker.j… | low | accept | Accepted — see Accepted Risks log (64-10-PLAN; client dials mcpHost(), vice-broker-client.ts:286-304) | closed |
| T-64-G1-13 | 64-10 | Denial of Service | devcontainer clients cannot see the host-home broker.json | medium | accept | Accepted — see Accepted Risks log (evidence/64-g641-state-dir-agreement.md; todo 2026-09-23-container-clients-cannot-see-the-machine-level-broker-json) | closed |
| T-64-G1-14 | 64-10 | Tampering | tests reading or writing the developer's real broker state | medium | mitigate | vice-proxy.test.ts:442 defaults VICE_BROKER_HOME; isolation test :511 | closed |
| T-64-G1-15 | 64-10 | Denial of Service | published package missing imported modules | high | mitigate | package.json files array covers the runtime import closure (re-checked 2026-09-24); pack-and-import run recorded in 64-10-SUMMARY | closed |
| T-64-G1-SC | 64-10 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (10-PLAN threat model) | closed |
| T-64-G1-16 | 64-11 | Denial of Service | a broker or emulator left running | high | mitigate | evidence/64-g641-live-check.md:309-326 four teardown checks, --collect unit, suite after teardown | closed |
| T-64-G1-17 | 64-11 | Tampering | disturbing a broker or unit the user already runs | high | mitigate | pre-flight recorded at evidence/64-g641-live-check.md:22 | closed |
| T-64-G1-18 | 64-11 | Elevation of Privilege | the nested Claude Code session | medium | mitigate | --strict-mcp-config + vice-only --allowedTools (live-check.md:284-285) | closed |
| T-64-G1-19 | 64-11 | Information Disclosure | results or transcripts naming broker-side paths or the control token | low | mitigate | leak scan live-check.md:191, :304-306; no control token in evidence | closed |
| T-64-G1-20 | 64-11 | Tampering | scratch output landing in the repository | low | mitigate | scratch outside the repo, removed (live-check.md:54, :170) | closed |
| T-64-G1-SC | 64-11 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (11-PLAN threat model) | closed |
| T-64-G4-01 | 64-12 | Denial of Service | pending attaches each holding a retrying dial | medium | mitigate | vice-broker.mts:1618 attached before any await; 5000 ms deadline (broker-relay.mts:571); isAbandoned :1641-1646; tests broker-relay.test.ts:1204/:1250 | closed |
| T-64-G4-02 | 64-12 | Spoofing | a pending dial connecting to a different instance that reused the port after a kill or rec… | high | mitigate | vice-broker.mts:1693-1697 identity re-check after connect; test broker-relay.test.ts:1250 | closed |
| T-64-G4-03 | 64-12 | Information Disclosure | the attach refusal's wire message | low | mitigate | broker-relay.mts:686-691 names only channel, port, deadline; reachable only after the handle check | closed |
| T-64-G4-04 | 64-12 | Repudiation | a never-connected dial leaving no incident record | low | accept | Accepted — see Accepted Risks log (64-12-PLAN; stderr line vice-broker.mts:1678-1681) | closed |
| T-64-G4-05 | 64-12 | Tampering | client bytes sent during the dial window | low | mitigate | vice-broker.mts:1628 clientSocket.pause() before the await; test broker-relay.test.ts:1304 | closed |
| T-64-G4-SC | 64-12 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (12-PLAN threat model) | closed |
| T-64-G3-01 | 64-13 | Tampering | a completion reply that does not match what was sent | medium | mitigate | broker-endpoint.ts:1237-1246 echoed-value comparison; tests broker-endpoint.test.ts:1169+ | closed |
| T-64-G3-02 | 64-13 | Information Disclosure | the `error` line and `transfer_complete` fields | medium | mitigate | vice-broker.mts:1195-1196 completion line carries kind/byteLength/sha256 only, error text is wireReason; tests staging :447/:504, stock-machine :1291/:1365 | closed |
| T-64-G3-03 | 64-13 | Denial of Service | a half-open transfer socket whose client never closes | low | mitigate | OPEN (partial): reply-end-destroy with 2000 ms bound exists (vice-broker.mts:1172, 1192-1205), but mkdirSync at broker-transfer.mts:451 sits outside the try and the upload .then() at vice-broker.mts:1254-1266 has no .catch; a throwing mkdir leaves the in-flight guard set and reaches the unhandled-rejection teardown (broker-kill.mts:377). Unreachable in normal use (stageFileSlot already created the dir) | open — below high threshold (non-blocking) |
| T-64-G3-04 | 64-13 | Denial of Service | a client that waits forever for a reply an older broker never sends | low | mitigate | broker-endpoint.ts:1206-1211 timeout with "restart the broker" reason; test :1238 | closed |
| T-64-G3-05 | 64-13 | Tampering | a test-only pre-publish hook reachable in production | low | mitigate | run() wiring passes no deps (vice-broker.mts:2386); hook takes no path (broker-transfer.mts:395) | closed |
| T-64-G3-SC | 64-13 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (13-PLAN threat model) | closed |
| T-64-G34-01 | 64-14 | Denial of Service | a broker or emulator left running | high | mitigate | evidence/64-g643-g644-live-check.md:151-165 teardown checks | closed |
| T-64-G34-02 | 64-14 | Tampering | disturbing a broker, unit or record the user already has | high | mitigate | pre-flight + incident-marker scoping (live-check.md:20-21, :70-71) | closed |
| T-64-G34-03 | 64-14 | Information Disclosure | transcripts naming broker-side paths or the control token | low | mitigate | scratch removed (:165) | closed |
| T-64-G34-04 | 64-14 | Tampering | scratch output landing in the repository | low | mitigate | scratch outside the repo (:46, :165) | closed |
| T-64-G34-SC | 64-14 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (14-PLAN threat model) | closed |
| T-64-G5-01 | 64-15 | Information Disclosure | `receivePayloadToFile()`'s three caught-fault branches, and the `error` line | high | mitigate | formatPathFreeFault on all three caught-fault branches (broker-transfer.mts:490, :514, :528); tests broker-transfer.test.mts:518/:642/:702, staging :447/:504 | closed |
| T-64-G5-02 | 64-15 | Information Disclosure | a caught fault's `code` property | medium | mitigate | broker-transfer.mts:237 regex; :276-285 guarded getter; test :586 | closed |
| T-64-G5-03 | 64-15 | Information Disclosure | a future failure branch without wire text | medium | mitigate | broker-transfer.mts:222-224 code/wireReason required; vice-broker.mts:1196 no fallback to reason | closed |
| T-64-G5-04 | 64-15 | Repudiation | the operator's diagnostic trail | low | mitigate | reason keeps destPath for stderr (broker-transfer.mts:482/489/513/527, vice-broker.mts:1262); test :518 | closed |
| T-64-G5-05 | 64-15 | Denial of Service | a sender exceeding the cap, told no limit | low | mitigate | broker-transfer.mts:477-484 bad_request naming the cap; test :759 | closed |
| T-64-G5-06 | 64-15 | Information Disclosure | the download branch and the `stage_file` reply | low | accept | Accepted — see Accepted Risks log (64-15-PLAN; download failures stderr-only (vice-broker.mts:1268-1274)) | closed |
| T-64-G5-SC | 64-15 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (15-PLAN threat model) | closed |
| T-64-G6-01 | 64-16 | Tampering | `run()`'s startup sweep in a broker that loses the singleton | high | mitigate | sweep after the confirmed bind (vice-broker.mts:2555); losing branches return first (:2454-2506); tests broker-control.test.ts:2281 (:2304), :2316 | closed |
| T-64-G6-02 | 64-16 | Tampering | the winning broker's own sessions' staging | high | mitigate | sweep precedes first writeBrokerRecordFile (:2598); stage_file token-gated; test broker-control.test.ts:2366 | closed |
| T-64-G6-03 | 64-16 | Tampering | the automated suite's spawned brokers against the machine-level staging root | medium | mitigate | startRealBroker sets VICE_BROKER_HOME (broker-control.test.ts:2156-2163, :2127) | closed |
| T-64-G6-04 | 64-16 | Tampering | two brokers deliberately bound to different ports or hosts that share one VICE_BROKER_HOME | medium | accept | Accepted — see Accepted Risks log (vice-broker.mts:2549-2554 call-site comment) | closed |
| T-64-G6-05 | 64-16 | Denial of Service | crash residue left on real disk while no broker wins the bind | low | accept | Accepted — see Accepted Risks log (16-PLAN threat model) | closed |
| T-64-G6-06 | 64-16 | Repudiation | an operator reading whether a startup swept | low | accept | Accepted — see Accepted Risks log (broker-kill.mts:910 zero-count logging) | closed |
| T-64-G6-SC | 64-16 | Tampering | npm/pip/cargo installs | low | accept | Accepted — see Accepted Risks log (16-PLAN threat model) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*
*Supply-chain rows `T-64-SC` and `T-64-G1-SC` recur per plan with the same ID. Each plan's row is its own entry.*
*Evidence paths are relative to `src/mcp/vice/` unless they start with `evidence/` (the phase evidence directory).*

### Open below threshold (non-blocking)

- **T-64-21 (64-04, Spoofing, low).** The plan wanted a handler to refuse by name when a handle-shaped value arrives as an argument it does not accept. No such refusal exists. A 32-hex handle matches `SNAPSHOT_NAME_RE` (`transfer-paths.ts`). `vice_snapshot_save` and `vice_snapshot_load` therefore accept a handle as a snapshot name. The doc comment at `stock-machine.ts:445-451` says nothing would accept one, which is wrong. The impact is confined: the name only builds a filename under the client's own snapshots directory.
- **T-64-G3-03 (64-13, Denial of Service, low). Partly mitigated.** `receivePayloadToFile()` calls `mkdirSync(dirname(destPath))` at `broker-transfer.mts:451`, outside its try, although its doc says "Never throws". The upload branch at `vice-broker.mts:1254-1266` chains `.then()` with no `.catch`. If that mkdir throws (EACCES, ENOSPC or EROFS on the broker root), three things happen:
  - the in-flight guard stays set;
  - the socket gets no reply;
  - the rejection reaches the unhandled-rejection teardown at `broker-kill.mts:377`, which ends the pool.

  Normal use cannot reach this, because `stageFileSlot()` has already created the directory. Fix route: move the mkdir inside the try, or add a `.catch` that clears the guard and destroys the socket.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-64-01 | T-64-05 (64-01) | D-14: `vice_autostart`'s and `vice_disk_attach`'s `path` stays unrestricted by deliberate owner decision. Bounded by the cap and by session-scoped staging, not eliminated. Recorded, accepted; do not narrow it in this phase. Recorded at: D-14, stock-machine.ts:151-163 | Henrik Olsson (plan-time disposition, 64-01-PLAN) | 2026-09-23/24 |
| AR-64-02 | T-64-26 (64-06) | D-14, ACCEPTED and NAMED at the point of decision. Confining it was offered and declined: it is a regression dressed as hardening, and this tree exists to analyse artifacts wherever the user put them. Bounded by the transfer cap and session-scoped staging, not… Recorded at: D-14, stock-machine.ts:151-163 | Henrik Olsson (plan-time disposition, 64-06-PLAN) | 2026-09-23/24 |
| AR-64-03 | T-64-34 (64-07) | D-18's named, accepted cost. Recorded in the evidence so Phase 66 does not assume continuous protection. Recorded at: evidence/64-convergence-metric.md:120-135 | Henrik Olsson (plan-time disposition, 64-07-PLAN) | 2026-09-23/24 |
| AR-64-04 | T-64-G1-04 (64-08) | A refused pre-gate op no longer destroys the connection; a 128-bit handle space makes guessing infeasible and per-client rate limiting is Out of Scope in REQUIREMENTS.md. Recorded in the evidence file. Recorded at: evidence/64-g641-handle-only-authority.md:106-120 | Henrik Olsson (plan-time disposition, 64-08-PLAN) | 2026-09-23/24 |
| AR-64-05 | T-64-G1-SC (64-08) | No package is installed or added by this plan; the runtime dependency set stays @mastra/mcp and @mastra/core. Recorded at: 64-08-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-08-PLAN) | 2026-09-23/24 |
| AR-64-06 | T-64-G1-09 (64-09) | Such a broker still gates attach/transfer on the token and would refuse; broker and proxy ship in the same unreleased @henols/vice-mcp v2.0.0 package, so the pair cannot skew in a release. Recorded at: 64-09-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-09-PLAN) | 2026-09-23/24 |
| AR-64-07 | T-64-G1-SC (64-09) | No package is installed or added by this plan. Recorded at: 64-09-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-09-PLAN) | 2026-09-23/24 |
| AR-64-08 | T-64-G1-12 (64-10) | Pre-existing: VICE_POOL_DIR already had this power; the client still dials mcpHost() and never a host named in the record; setting a user's environment already implies control of that user's session. Recorded at: 64-10-PLAN; client dials mcpHost(), vice-broker-client.ts:286-304 | Henrik Olsson (plan-time disposition, 64-10-PLAN) | 2026-09-23/24 |
| AR-64-09 | T-64-G1-13 (64-10) | Recorded interim limitation with a documented remedy (VICE_BROKER_HOME/VICE_POOL_DIR per side) and a todo owned by Phase 66 (RM-02); v2.0.0 is unreleased, and before this change a container reached the broker only for the one project that launched it. Recorded at: evidence/64-g641-state-dir-agreement.md; todo 2026-09-23-container-clients-cannot-see-the-machine-level-broker-json | Henrik Olsson (plan-time disposition, 64-10-PLAN) | 2026-09-23/24 |
| AR-64-10 | T-64-G1-SC (64-10) | No package is installed or added; `npm pack` only packages this repository's own files. Recorded at: 64-10-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-10-PLAN) | 2026-09-23/24 |
| AR-64-11 | T-64-G1-SC (64-11) | No package is installed or added; `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-11-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-11-PLAN) | 2026-09-23/24 |
| AR-64-12 | T-64-G4-04 (64-12) | By design (G-64-4 names a record for a never-connected dial as spurious); the broker still writes a stderr journal line naming target, channel, port, errno, attempts and elapsed time. Recorded at: 64-12-PLAN; stderr line vice-broker.mts:1678-1681 | Henrik Olsson (plan-time disposition, 64-12-PLAN) | 2026-09-23/24 |
| AR-64-13 | T-64-G4-SC (64-12) | No package is installed or added; `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-12-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-12-PLAN) | 2026-09-23/24 |
| AR-64-14 | T-64-G3-SC (64-13) | No package is installed or added; `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-13-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-13-PLAN) | 2026-09-23/24 |
| AR-64-15 | T-64-G34-SC (64-14) | No package is installed or added; `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-14-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-14-PLAN) | 2026-09-23/24 |
| AR-64-16 | T-64-G5-06 (64-15) | The sweep found download failures stderr-only (the socket is destroyed, nothing is written). `emulator_filename` is a by-design relay value that is never put in a tool result (64-02-PLAN.md:116-122). Neither is caught-error text. Recorded at: 64-15-PLAN; download failures stderr-only (vice-broker.mts:1268-1274) | Henrik Olsson (plan-time disposition, 64-15-PLAN) | 2026-09-23/24 |
| AR-64-17 | T-64-G5-SC (64-15) | No package is installed or added. `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-15-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-15-PLAN) | 2026-09-23/24 |
| AR-64-18 | T-64-G6-04 (64-16) | This is the singleton's own documented scope limit (`vice-broker.mts:2311`), stated again at the new call site. In that configuration the second broker's accepted pre-bind reap already voids the first broker's instances. A per-directory owner record (route b) … Recorded at: vice-broker.mts:2549-2554 call-site comment | Henrik Olsson (plan-time disposition, 64-16-PLAN) | 2026-09-23/24 |
| AR-64-19 | T-64-G6-05 (64-16) | Residue persists only until the next broker that binds, and it is bounded by slots times the 16 MiB cap per crashed session (D-05, D-09). A broker that cannot bind serves nobody in any case. Recorded at: 64-16-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-16-PLAN) | 2026-09-23/24 |
| AR-64-20 | T-64-G6-06 (64-16) | A winner logs the sweep's found and removed counts, including zero. A loser logs its "second instance" or FATAL line and no sweep line, and the losing-broker test asserts that absence. Recorded at: broker-kill.mts:910 zero-count logging | Henrik Olsson (plan-time disposition, 64-16-PLAN) | 2026-09-23/24 |
| AR-64-21 | T-64-G6-SC (64-16) | No package is installed or added. `npm ci` only restores this package's own locked dependencies if a worktree lacks them. Recorded at: 64-16-PLAN <threat_model> | Henrik Olsson (plan-time disposition, 64-16-PLAN) | 2026-09-23/24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-24 | 96 | 94 | 2 (both low, below block_on=high; threats_open: 0) | gsd-security-auditor (opus), ASVS L1, via `/gsd-secure-phase 64` as the verify:post step of `/gsd-verify-work 64` |

## Security Audit 2026-09-24
| Metric | Count |
|--------|-------|
| Threats found | 96 (75 mitigate, 21 accept) |
| Closed | 94 |
| Open | 2 (low, non-blocking) |

The orchestrator re-checked both open findings against the source before recording them: `mkdirSync` precedes the `try` in `receivePayloadToFile()`, the upload `.then()` has no `.catch`, and `validateSnapshotName()` accepts a 32-hex string.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-24
