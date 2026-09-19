# Requirements: c64-re-tools v2.0.0 "One Broker, One Socket"

**Defined:** 2026-09-19
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture
RAM, inspect chip state — and keep working when the emulator misbehaves.

**Milestone hypothesis (falsifiable).** One manually-started broker per machine,
reached by every client through a single fixed TCP endpoint with all files
carried as bytes over that socket, lets the MCP server and every skill script
work identically on a bare host and inside a devcontainer — with no discovery
file, no bind mount and no path translation anywhere in the tree. The
falsifiable part is **"anywhere"**: this is Validated only if the old seam is
**gone from production code, not merely bypassed**.

**Settled design decisions.** These were decided by the owner and are not open
for re-derivation during planning:

1. **Discovery** — fixed port **19510**, dialled `127.0.0.1` then
   `host.docker.internal`, first handshake wins. No file on disk.
2. **Lifecycle** — one **manually started** broker per machine; no client spawns it.
3. **Session model** — skill calls stateless; the MCP connection **is** the session.
4. **Files** — bytes over the socket, saved under the client's own
   `.c64-re-tools/<kind>/`, response carries the local path.
5. **Bind and auth — `PKG-04` is REVERSED.** Loopback plus **enumerated** bridge
   gateways; never `0.0.0.0`; the per-boot token is **dropped**. A hardcoded
   `172.17.0.1` is wrong — a custom Docker network has its own gateway.
6. **Wire shape — one endpoint, multiple tagged connections** (decided
   2026-09-19). One long-lived connection relays binary-monitor traffic;
   short-lived stateless connections carry files and skill-script calls; all dial
   the same fixed port. **No new envelope format, and `stock-protocol.ts`'s
   socket-consumption contract is not touched.** The single-physical-socket
   multiplexed alternative was considered and rejected as a materially larger and
   riskier cutover for no behavioural gain.

---

## v2.0.0 Requirements

### Endpoint — finding the broker with nothing on disk

- [x] **ENDPOINT-01**: A client reaches the broker with no file on disk, by dialling one fixed port in a fixed candidate order (`127.0.0.1`, then `host.docker.internal`), taking the first candidate that completes a handshake
- [x] **ENDPOINT-02**: Each dial candidate is bounded by its own timeout, so a wedged or foreign listener on the first candidate cannot prevent the second from being tried
- [x] **ENDPOINT-03**: The handshake proves the listener is genuinely this broker and at a compatible version, so "something else answered" is distinguishable from "nothing is listening"
- [x] **ENDPOINT-04**: A client that finds no broker refuses by name and tells the user the exact command to start one on their platform
- [x] **ENDPOINT-05**: A client and broker at incompatible versions refuse by name and say which to update — the two npm packages update independently, so skew is expected, not exceptional

### Broker — one per machine, started by the user

- [x] **BROKER-01**: One broker serves every session from every project on the machine, whether the client runs on the host or in a devcontainer
- [x] **BROKER-02**: No client ever spawns the broker; the user starts it
- [x] **BROKER-03**: The broker listens on loopback plus the container bridge gateway address(es) it enumerates at startup, and never on `0.0.0.0` or a hardcoded gateway address
- [x] **BROKER-04**: The broker refuses by name at startup when its port is already in use, rather than racing or silently failing
- [x] **BROKER-05**: A service definition ships for Linux and macOS, committed but never auto-applied, with a documented foreground command as the universal fallback
- [x] **BROKER-06**: Broker-owned state and staged files live under a machine-level root, never inside any project's `.c64-re-tools/`

### Session — the connection is the session

- [ ] **SESS-01**: A skill script's call is a stateless one-shot — open, send, receive, close — that binds no emulator and holds no lease
- [ ] **SESS-02**: An MCP server's connection stays open for the life of that process, and the broker holds that connection's emulator instance for exactly as long as the socket lives
- [x] **SESS-03**: The broker reclaims a session from socket events alone, so a client killed with `SIGKILL` — which sends no goodbye — is still cleaned up
- [x] **SESS-04**: A client death that produces no `FIN` at all is detected by the broker within a bounded time, rather than waiting on the operating system's keepalive
- [x] **SESS-05**: When a connection drops mid-operation, an incident record is written **before** the instance is reclaimed, carrying a broker-supplied reason naming the operation that was in flight
- [ ] **SESS-06**: A user can tell which live session is their own, so a stuck emulator in a shared broker is diagnosable rather than ambiguous

### Transfer — files as bytes, never as shared paths

- [ ] **XFER-01**: A request that produces a file returns its bytes over the socket; the client writes them under its own `.c64-re-tools/` per-kind directory and the response carries that local path
- [ ] **XFER-02**: A request that consumes a file is given a local path by its caller, reads it client-side, and streams the bytes to the broker
- [ ] **XFER-03**: A client refuses a broker-supplied destination name that would escape its `.c64-re-tools/` per-kind directory — traversal segments, absolute paths, separators and NUL bytes are refused, not sanitised
- [ ] **XFER-04**: The broker chooses its own staging paths and a client never supplies one; a client refers to a staged file only by an opaque handle the broker minted
- [ ] **XFER-05**: File bytes survive the round trip unaltered, including bytes that are not valid UTF-8
- [ ] **XFER-06**: A transfer is integrity-checked end to end, and one that exceeds the size cap is refused with a message naming the limit
- [ ] **XFER-07**: Staged files are removed when their session closes, and a sweep removes those left behind by a crash
- [ ] **XFER-08**: `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and `vice_snapshot_load` all work over the socket with no shared filesystem between client and broker

### Seam — one client module, two packages

- [ ] **SEAM-01**: Exactly one module owns dialling the endpoint and speaking the wire protocol, and both the MCP server and every skill script reach the broker through it
- [ ] **SEAM-02**: Skill scripts reach that module through the existing resolution ladder, with no second copy of it in the skills package
- [ ] **SEAM-03**: Every skill script that needs a host tool goes through the single endpoint, with no remaining route that depends on running on the host

### Removal — proving the old seam is gone, not bypassed

- [ ] **RM-01**: `hostpath.ts`, `containerpath.ts` and `stock-paths.ts` are deleted and no production module imports them
- [ ] **RM-02**: The `broker.json` discovery record and every reader of it are deleted
- [ ] **RM-03**: The two-route host/container branch in the host-tool client is deleted; container detection survives only where the broker guards its own startup
- [ ] **RM-04**: The stale in-code guidance that the broker must bind `0.0.0.0` is rewritten wherever it appears, so it stops teaching the reversed decision
- [ ] **RM-05**: The dead "never import hostpath.ts" guard comments left behind by the deletion are stripped
- [ ] **RM-06**: The Ghidra symlink alias mechanism is deleted, with runs landing on a broker-side root that has no dot-prefixed segment
- [ ] **RM-07**: Every structural test guarding a deleted seam asserts its **absence**, so none of them passes vacuously once the thing it scanned is gone
- [ ] **RM-08**: CI's bare-host route for the ACME tests is replaced before the escape hatch it depends on is deleted

---

## Future Requirements

Acknowledged, deferred, not in this roadmap.

### Operator surface

- **OPS-01**: An operator can force-recycle an orphaned session belonging to another project
- **OPS-02**: `vice-wedge-triage` teaches the new case where restarting the broker affects every project at once

### Deferred verification

- **DEFER-01**: Podman ≥ 5.0's `pasta` default and its effect on `host.containers.internal` verified against a primary release note rather than a blog

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| TLS / mTLS on the socket | The bind is narrowed to loopback and bridge gateways; there is no network path to encrypt |
| An auth token or credential of any kind | Narrowing the bind removes its job. Reversal of `PKG-04`, decided 2026-09-19. A credential file would also break the "no files" rule this milestone exists to satisfy |
| A full auth / ACL system | One user per machine; no adversarial multi-tenant scenario exists |
| Session resumption after a drop | Directly contradicts "the connection IS the session" — the correctness property, not an incidental one |
| Resumable or chunked file transfer | Payloads are small enough that whole-request retry is correct and far simpler |
| An RPC framework (gRPC, Protobuf, Socket.IO) | The hand-dispatched verb set is already simpler, and Socket.IO's auto-reconnect would defeat connection-as-session |
| A third-party framing or process-supervisor dependency | The two-runtime-dependency invariant holds; systemd and launchd already supervise |
| Unix domain sockets | Considered and rejected 2026-08-03; a bind-mounted socket path would reintroduce the mount this milestone removes |
| A web dashboard or monitoring UI | A thin CLI view over the existing status response is the ceiling |
| Auto-spawning the broker on demand | Owner decision: the user starts it, the client refuses by name |
| Per-client rate limiting or quotas | No adversarial scenario; a single developer's own sessions |
| Cross-machine reachability | The bind narrowing is deliberate; remote use is not a goal |
| A third dial candidate for plain Linux Docker Engine | No hostname or IP fixes a missing `--add-host=host.docker.internal:host-gateway`; the remedy is documented instead |
| Changing any tool's semantics or arguments | This milestone changes how requests and files reach the broker, not what the emulator is asked to do |
| Recovering the three permanent stock losses | A transport redesign cannot recover a capability the hardware channel never had |
| The carried debt | The 2026-09-14 reconciliation, `CR-01`, the stale-doc strings, `INSTALL-01`..`05`, Phase 55's verification, `PROOF-03`, `ANNO-14`/`ANNO-15` were each put to the owner at this open and declined for this milestone |

---

## Traceability

Which phases cover which requirements. Filled at roadmap creation, 2026-09-19.
Every requirement below is owned by **exactly one** phase; the mapping was
cross-checked mechanically against `ROADMAP.md`'s per-phase `**Requirements**:`
lines rather than by eye, because this project has a recorded history of a
requirement owned by two phases or by none.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENDPOINT-01 | Phase 62 | Complete |
| ENDPOINT-02 | Phase 62 | Complete |
| ENDPOINT-03 | Phase 62 | Complete |
| ENDPOINT-04 | Phase 62 | Complete |
| ENDPOINT-05 | Phase 62 | Complete |
| BROKER-01 | Phase 62 | Complete |
| BROKER-02 | Phase 62 | Complete |
| BROKER-03 | Phase 62 | Complete |
| BROKER-04 | Phase 62 | Complete |
| BROKER-05 | Phase 62 | Complete |
| BROKER-06 | Phase 62 | Complete |
| SESS-01 | Phase 63 | Pending |
| SESS-02 | Phase 63 | Pending |
| SESS-03 | Phase 63 | Complete |
| SESS-04 | Phase 63 | Complete |
| SESS-05 | Phase 63 | Complete |
| SESS-06 | Phase 63 | Pending |
| XFER-01 | Phase 64 | Pending |
| XFER-02 | Phase 64 | Pending |
| XFER-03 | Phase 64 | Pending |
| XFER-04 | Phase 64 | Pending |
| XFER-05 | Phase 64 | Pending |
| XFER-06 | Phase 64 | Pending |
| XFER-07 | Phase 64 | Pending |
| XFER-08 | Phase 64 | Pending |
| SEAM-01 | Phase 65 | Pending |
| SEAM-02 | Phase 65 | Pending |
| SEAM-03 | Phase 65 | Pending |
| RM-01 | Phase 66 | Pending |
| RM-02 | Phase 66 | Pending |
| RM-03 | Phase 66 | Pending |
| RM-04 | Phase 66 | Pending |
| RM-05 | Phase 66 | Pending |
| RM-06 | Phase 67 | Pending |
| RM-07 | Phase 66 | Pending |
| RM-08 | Phase 65 | Pending |

**Coverage:**

- v2.0.0 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✅

**Phase ownership at a glance** (Phases 62-67, continuing numbering from Phase 61):

| Phase | Name | Requirements |
|-------|------|--------------|
| 62 | The Fixed Endpoint and the Broker That Owns the Machine | `ENDPOINT-01..05`, `BROKER-01..06` (11) |
| 63 | The Monitor Channel Relayed, and the Connection as the Session | `SESS-01..06` (6) |
| 64 | Files as Bytes, Both Directions | `XFER-01..08` (8) |
| 65 | Every Skill Script Through the One Endpoint, and CI With It | `SEAM-01..03`, `RM-08` (4) |
| 66 | The Deletion Cutover — Gone, Not Bypassed | `RM-01..05`, `RM-07` (6) |
| 67 | Ghidra's Runs Root Without the Alias | `RM-06` (1) |

**`RM-08` sits in Phase 65 and not in Phase 66 on purpose** — the deletion phase
removes the bare-host escape hatch CI's ACME tests currently depend on, so the
replacement must land first. **`RM-07` sits in Phase 66 with the deletions it
guards**, because its widening has to happen *before* the corresponding deletion
or the widened test passes vacuously over a region that no longer exists; that is
an ordering edge inside the phase, not across phases.

---
*Requirements defined: 2026-09-19*
