# Pitfalls Research: v2.0.0 "One Broker, One Socket"

**Domain:** Transport/deployment redesign of an existing shipping MCP plugin that drives a real
emulator process over TCP — collapsing per-project discovery files and path-translation into one
machine-wide broker reached over a single fixed socket.
**Researched:** 2026-09-19
**Confidence:** HIGH for anything citing this codebase's own source/history; MEDIUM/LOW flagged
inline for general networking facts not measured against this project.

This file connects the redesign's four target features — fixed port with no discovery file,
connection-is-the-session, stateless vs. stateful call shapes, files-as-bytes — to failure modes
this project has *already lived through once*, per its own module headers and `CLAUDE.md`. Every
citation below is to a real file, not a paraphrase of the prompt.

---

## Critical Pitfalls

### Pitfall 1: Deleting `broker.json` deletes the token's only distribution channel, not just discovery

**What goes wrong:**
Today, authentication and discovery are the same file. `broker-control.mts`'s header states the
wire format is "newline-delimited JSON, per-boot capability token, connection open = claim /
close = release," and `newControlToken()` (lines 313–319) mints 32 random bytes "held in memory
only by the caller; written once into `broker.json` and never logged." Every client learns the
token by reading `broker.json` (`acquireOverControlPlane()`, `openBrokerControl()` in
`vice-broker-client.ts`). The milestone deletes `broker.json` "and every other discovery record."
If nothing replaces it, the fixed, well-known port becomes **structurally unauthenticated** —
`timingSafeEqual`-gated code with no channel left to hand out the value being compared. A
well-known fixed port with no credential is dialable by *anything on the machine* (and, per the
existing accepted-risk decision below, potentially anything on the local network segment),
capable of acquiring, releasing and recycling every project's VICE instance.

**Why it happens:**
"No discovery file" reads as "no file," and the token distribution just happens to have been
piggybacking on the same file. A plan that deletes `broker.json` for the stated reason (fixed
port needs no discovery) can delete it for that reason alone and not notice it was also the only
credential channel — the two concerns were never separated in the current code.

**How to avoid:**
Treat "discovery" (finding host:port) and "authentication" (proving both sides trust each other)
as two separate design questions, explicitly, even though one file used to answer both. A fixed
port answers discovery. It answers nothing about authentication. Options to weigh at planning
time, not implementation time: (a) a per-boot token still written to a fixed, well-known,
mode-0600 path (this is *not* a discovery record — host and port are already fixed — only a
credential), (b) OS-level access control if the transport can be a Unix domain socket on loopback
(the 2026-08-03 checkpoint decision already "considered and rejected a unix-domain-socket
alternative" once, for container reachability reasons that a fixed-TCP-port redesign does not
remove), or (c) an explicit, owner-approved decision to run this fixed endpoint unauthenticated,
recorded with the same rigor `PKG-04` used for the `0.0.0.0` bind (dated, rationale, residual
risk, reversal condition). Silence is the one unacceptable outcome.

**Warning signs:**
A phase plan that says "delete `broker.json`" without a companion line item for where the token
now lives. A design doc for the fixed-port handshake that never mentions `timingSafeEqual` or
`newControlToken()`. A code review that finds `checkToken()` (or its successor) deleted along
with the file it used to read from.

**Phase to address:**
The very first transport phase — token/credential distribution must be decided *before* the fixed
port is wired up, because every other phase (connection lifecycle, file transfer, multi-project
isolation) assumes an authenticated connection.

---

### Pitfall 2: The fixed port is squatted by a stale broker, an unrelated process, or a second copy of itself

**What goes wrong:**
Three distinct failure shapes hide behind "the port is fixed now":
1. **Stale broker from a previous version** is still bound and answers the handshake with an
   *old* protocol — a client dials, gets a real TCP accept, and then hangs or misbehaves because
   the peer speaks a wire format from before this milestone shipped.
2. **An unrelated process** already owns the port (another dev tool, a leftover test listener) —
   the client connects successfully to something that is not a VICE broker at all.
3. **Two broker instances race to bind** — the user (or a script, or a systemd unit that restarts
   too eagerly) starts a second broker while the first is still up; only one wins the `EADDRINUSE`,
   and the loser must fail *usefully* rather than silently.

**Why it happens:**
"Manually started, never spawned by a client" removes the software-level single-owner guard this
project already built (`broker-launch.mts`'s `inFlight`) — that guard governs concurrent *launch
calls inside one broker process*, not concurrent *broker processes*. Nothing in the current
codebase enforces "exactly one broker binds this port" at the OS level beyond the kernel's own
`bind()` refusal, and nothing today distinguishes "a real broker refused the connect" from
"a stale/foreign process happens to be listening."

**How to avoid:**
Make the handshake **prove identity**, not just completion — this project already has the exact
right model in `defaultBinmonProbe()` (`broker-launch.mts`): it never trusts a bare TCP accept
("a C64 can accept a connection before it has finished booting"), and instead requires a
well-formed, version-checked reply keyed by its own request id before calling anything "ready."
The new fixed-endpoint handshake needs the same discipline: a version/magic exchange the client
verifies before treating the connection as real, so a stale-protocol broker or a foreign process
squatting the port produces an explicit `wrong_protocol`/`unrecognized_peer` refusal instead of a
silent hang or a corrupted session. For the second-broker race, make the *broker itself* refuse to
start (not merely fail its first client) when the bind fails — `EADDRINUSE` on startup should be a
loud, named refusal ("another broker already owns this port, or something else does — see
`<remedy>`"), matching this project's own detect-then-refuse-by-name posture for every other
external dependency (`CLAUDE.md`'s "Dependency" bullet on `x64sc`/`c1541`/ACME/Ghidra/dxa).

**Warning signs:**
A client that connects successfully but then times out on every request (stale/foreign process).
A broker start log with no "bind failed" message even though a duplicate is clearly running (two
`ps` entries, one port). A version mismatch that surfaces only as a malformed-JSON-line error deep
inside `sendAndAwaitLine()`'s parse path rather than at connect time.

**Phase to address:**
The fixed-endpoint bind/handshake phase — same phase as Pitfall 1, since both are about proving
"this is genuinely my broker" before trusting anything it says.

---

### Pitfall 3: Binding loopback-only silently breaks every containerized consumer

**What goes wrong:**
The milestone's own dial order is `127.0.0.1`, then `host.docker.internal`. `host.docker.internal`
resolves, on Linux, to the Docker **bridge gateway address**, not to loopback. A listener bound to
`127.0.0.1` is answerable only from the same network namespace as the broker itself — a
containerized MCP server or skill script dialing `host.docker.internal` reaches a real IP, gets a
real TCP-level connection refused or a silent black hole (depending on firewall shape), and every
skill and MCP tool that needs the host emulator breaks, in every devcontainer consumer, at once.

**Why it happens:**
This exact tradeoff was already decided once, for the *existing* control-plane listener, and
recorded as `PKG-04` (`.planning/PROJECT.md`, 2026-08-22, `checkpoint:decision` 2026-08-03):
"Bind: 0.0.0.0 explicitly, never 127.0.0.1 — `host.docker.internal` is the bridge address, not
loopback, so a loopback-only listener is structurally unreachable from the container"
(`broker-control.mts:16–23`). A new implementer of the fixed-port bind, reasoning from first
principles about "narrow the bind for safety," can easily re-derive the *opposite* of the
project's own already-accepted answer and quietly narrow to `127.0.0.1`, breaking every
container-side consumer without a single test failing on a host-only dev machine (this repo has
**no devcontainer of its own** — see standing note "No devcontainer in this repo" — so the
regression is invisible to whoever wrote it unless a real container is exercised).

**How to avoid:**
Carry the `PKG-04` decision forward explicitly rather than re-deciding it implicitly. If the fixed
socket **is** the same listener that used to be the control plane, bind `0.0.0.0` again, with the
same compensating control (token, `timingSafeEqual`, and now a real identity handshake per
Pitfall 2). If a design choice narrows it, that is a **reversal** of a dated, evidence-grounded
decision and must be argued and recorded with the same weight `PKG-04` was — not defaulted
silently. Either way, the decision must be tested against an actual container reaching
`host.docker.internal`, not merely asserted in a comment.

**Warning signs:**
Every container-side tool call fails with a connection-refused or timeout, while the exact same
call from a bare host process succeeds. `ss -tlnp` on the broker host shows the fixed port bound
to `127.0.0.1` instead of `0.0.0.0`. A phase's own test suite is all host-native and never
actually dials from inside a container.

**Phase to address:**
Same fixed-endpoint bind phase as Pitfalls 1–2 — this is the third leg of "get the bind address
and the handshake right before anything else is built on top of them."

---

### Pitfall 4: A wildcard bind on a process-spawning daemon is a bigger blast radius than the one already accepted

**What goes wrong:**
`0.0.0.0` is the *right* answer for container reachability (Pitfall 3), but it is not free: the
existing `PKG-04` record states the residual risk in writing — "any host reachable on the same
local network segment can open a connection to the control port... with a leaked token, an
attacker on that segment can acquire, release and recycle emulator instances." That risk was
accepted for a control plane whose worst case is "spawn/kill an emulator." The new fixed socket
additionally carries **all file movement as bytes** (Pitfall set below) and, per the milestone's
own scope note, is dialed by "every skill script" too — meaning a wider set of operations, some of
which write files under `.c64-re-tools/`, now sit behind the same bind decision. The blast radius
of a leaked token is larger than it was when `PKG-04` was accepted, even though the bind address
argument (container reachability) is unchanged.

**Why it happens:**
`PKG-04`'s accepted-risk analysis was scoped to the control plane as it existed at the time
(acquire/release/recycle/status/host_state/monitor_claim/monitor_release). The new milestone folds
file transfer and skill-script traffic onto the same socket without re-running that risk analysis
against the new, larger operation set.

**How to avoid:**
Re-open `PKG-04`'s residual-risk paragraph as part of this milestone rather than treating the bind
address as already-settled. The bind address decision (`0.0.0.0`, for container reachability) can
stand unchanged; what needs re-stating is the **consequence list**, now including file read/write
by path inside `.c64-re-tools/` (tie this explicitly to Pitfalls 9–10's path-traversal concern —
an unauthenticated or token-leaked connection that can also stage/retrieve files is a materially
different exposure than one that can only start and stop an emulator). Do not silently reuse the
old `PKG-04` prose as if it still covers the new surface.

**Warning signs:**
A security/threat-model note (if one is written for this milestone) that cites `PKG-04` without
updating its scope. A code reviewer who assumes "the bind address question is already answered"
and skips re-deriving what a leaked token now grants.

**Phase to address:**
The fixed-endpoint bind/handshake phase, as a documentation and threat-model deliverable
alongside the code — not a separate later phase, because the token/bind decisions and the file
surface are being designed at the same time.

---

### Pitfall 5: SIGKILL leaves no goodbye — reclaim must be driven by socket events, never by a client-sent message

**What goes wrong:**
"The connection is the session" is only safe if the broker's notion of "session ended" is the
kernel's own FIN/RST delivery, not an application-level message the client sends on its way out.
A `SIGKILL`ed client process gets **no chance to run any cleanup code at all** — no goodbye
message is ever sent. The broker only learns anything happened when the OS delivers a `close` or
`error` event on its side of the socket, and depending on the client's OS and network path, that
can take anywhere from milliseconds (local loopback, immediate RST) to the full TCP retransmission
timeout (a routed connection with packets in flight) before the kernel gives up and reports the
peer gone.

**Why it happens:**
The existing code already gets this right in one place and wrong nowhere yet, because nothing
today holds a live emulator lease across an MCP-server-lifetime connection — `HeldLease` in
`vice-broker-client.ts` is scoped to a whole session already, and `release()`'s own comment says
"the connection IS the lease... `socket.destroy()` is itself idempotent." The risk is in what gets
added on top for the *stateful* MCP path: a design that additionally waits for the client to say
"goodbye, please clean up X" before reclaiming will simply never fire that path on a SIGKILL,
while a design that reclaims on `close`/`error`/`end` alone is unconditionally correct regardless
of how the client died.

**How to avoid:**
Reclaim exclusively on the raw socket lifecycle events (`close`, `error`) on the broker's own end
of the connection — exactly the pattern `createSession()` already uses for
`settleAllBrokerGone()` in `vice-broker-client.ts` (lines 919–925), just applied on the *broker*
side of the new stateful connections instead of only the client side. Never gate a VICE-instance
teardown or a lease release on receiving any particular byte sequence from the client.

**Warning signs:**
A design or PR that adds a `disconnect`/`goodbye`/`close_session` request kind to the wire
protocol as the mechanism that triggers cleanup. A test suite with no case that kills the client
process (`SIGKILL`, not a graceful `socket.end()`) and asserts the broker still reclaims.

**Phase to address:**
The connection-lifecycle phase (stateful sessions / "connection is the session" implementation).

---

### Pitfall 6: An idle stateful connection looks alive to both sides for hours

**What goes wrong:**
Node does not enable TCP keepalive on a socket by default, and even when a caller does call
`socket.setKeepAlive(true)`, the OS default on Linux is `net.ipv4.tcp_keepalive_time = 7200`
seconds (2 hours) before the first probe is even sent — a widely documented Linux default, **not**
measured against this project's own hosts, but a real property of the platform this broker runs
on. An MCP server that opens a stateful connection and then sits mostly idle (a long human
thinking-pause between tool calls is normal for this project's workflow) can have that connection
silently dropped by an intermediate NAT/proxy/firewall's own idle-connection timeout — commonly
well under an hour — while neither the broker nor the client notices for a long time, because
absent keepalive, nothing generates traffic to surface the drop. The broker keeps holding the VICE
instance and its resources for a client that is, from the network's point of view, already gone.

**Why it happens:**
The existing code path never needed this: the whole current lease lifetime is bounded by an
explicit request/response round trip (`acquire` → work → `release`/close), and the file-based
predecessor protocol used an active heartbeat (`startHeartbeat()`, since retired — see
`vice-broker-client.ts`'s header, "the lease-heartbeat interval... has no successor. Nothing needs
touching to prove a TCP connection is alive; it either is, or the broker's own 'close' handler has
already reclaimed the instance"). That reasoning is correct for a *short-lived* control-plane
connection. It is not obviously correct for a connection meant to live "for the life of that
server process," which can be hours in a real reverse-engineering session.

**How to avoid:**
Enable `socket.setKeepAlive(true, intervalMs)` on the broker's own side of every stateful
connection with an interval tuned to this project's realistic idle gaps (seconds to low minutes,
not the OS default of hours), and treat a keepalive failure as an ordinary `close` for reclaim
purposes. Decide, explicitly, whether idle-but-alive is fine indefinitely (in which case document
that a long-idle session legitimately holds its VICE instance) or whether a maximum idle bound
should trigger a proactive release — either answer is acceptable, but "we never thought about it"
is not.

**Warning signs:**
A VICE instance count that only ever grows during a long session with visible gaps between tool
calls. A user reporting `at_capacity`/`no_free_port` refusals despite believing they have no other
sessions open — because a NAT-dropped-but-not-reclaimed connection from an hour ago is still
counted.

**Phase to address:**
The connection-lifecycle phase, as an explicit design decision (keepalive interval, idle policy),
not left as a default.

---

### Pitfall 7: A connection drop mid-checkpoint or mid-capture must void the run and write the incident record — but the client is the one who vanished

**What goes wrong:**
This project already carries a hard rule: an incident record is written **before** any recycle or
kill (`vice-wedge-triage/SKILL.md`: "`vice_recycle` requires a `reason`. It writes that string
verbatim into a permanent incident record... **before the recycle kills anything**"). That rule
assumes a live caller is still present to *supply* the reason. Under "connection is the session,"
the most likely trigger for a broker-initiated reclaim is now the **client disappearing**
mid-operation — exactly the case where nobody is present to hand the broker a `reason` string. A
capture or a checkpoint wait that was in flight when the socket dropped has no natural narrator,
and a broker that reclaims silently (because "the client is gone, nothing to log") loses the one
thing this project's whole incident discipline exists to preserve: a reconstructable reason.

**Why it happens:**
The incident-record mechanism as it exists today is invoked *by a client call* (`vice_recycle`)
that supplies a reason. It has never had to fire from a *broker-initiated* reclaim triggered by
socket teardown, because no such reclaim path exists yet — connections have never been leases
before this milestone.

**How to avoid:**
Give the broker its own synthetic reason for a socket-teardown reclaim — e.g.
`"connection_closed_mid_operation: <last known operation>"` — written through the exact same
incident-record code path (`incident-record.ts`) a human-supplied reason uses, populated from
whatever the broker itself can observe about the connection's last in-flight request (the pending
request kind, target address, elapsed time). Treat "the client vanished while a checkpoint/capture
was outstanding" as a **first-class reclaim reason**, not an absence of one. Any run whose evidence
was mid-flight at disconnect must be marked void using the same "void the run, reboot from
scratch" procedure `vice-wedge-triage/SKILL.md` already documents for a `restarted` verdict — the
mechanism generalizes; a connection-drop void just has a different trigger than an epoch bump.

**Warning signs:**
A `.c64-re-tools/incidents/` directory with no entries despite VICE instances visibly being torn
down and relaunched over a session. A capture or checkpoint-derived artifact that looks complete
but was produced by an instance that no longer exists by the time anything reads the result.

**Phase to address:**
The connection-lifecycle phase, in the same unit of work as Pitfalls 5–6 — reclaim, incident
recording, and evidence-voiding are one mechanism, not three.

---

### Pitfall 8: An MCP-server restart can produce two connections briefly claiming the same logical session

**What goes wrong:**
Claude Code can restart the stdio MCP server process. The old connection's socket may not have
finished tearing down (still draining a `FIN`/`close` sequence, or lingering in `TIME_WAIT` on the
broker's side) at the moment the new server process opens a fresh stateful connection. If the
broker's reclaim logic is not strictly "one VICE instance per connection, keyed by the connection
object itself," a naive design keyed on something reused across restarts (a project path, a fixed
client identity) could hand the *new* connection the *old* connection's still-live VICE instance
before the old one is confirmed gone — exactly the kind of double-ownership window the existing
`monitor_claim`/`MonitorOwnershipError` machinery exists to prevent for the binmon socket
specifically (`vice-broker-client.ts:713–742`).

**Why it happens:**
"The connection is the session" is a clean model for a single, stable connection. It gets
ambiguous the moment two connections can exist for what a human thinks of as "the same session" —
old-dying and new-starting — even briefly. The project already knows this shape of bug from a
different angle: `CLAUDE.md`'s Concurrency constraint on stock's single-client binmon, and the
2026-08-01 triple-launch outage `broker-launch.mts` guards against, are both instances of "two
things briefly think they own the same resource."

**How to avoid:**
Key every acquired VICE instance strictly to the *socket object* the broker is holding, never to
any identity that could be reused across a restart (project path, PID, client-supplied name). A
brand-new stateful connection always gets treated as a brand-new session with no prior claim,
full stop — restart recovery, if wanted at all, is a deliberate, explicit reconnect protocol
(analogous to `stockReconnect()`'s epoch-based identity proof in the existing code), never an
implicit "same session because it looks like the same client."

**Warning signs:**
Two live VICE instances briefly both reporting themselves attached to what the user believes is
one MCP server session. A restart that occasionally leaves an orphaned instance nobody's new
connection can see or recycle, because it inherited a different lease.

**Phase to address:**
The connection-lifecycle phase, with an explicit test that restarts a client mid-session against
a real (or realistically faked) broker and asserts the old instance is reclaimed independently of
whether the new connection ever appears.

---

### Pitfall 9: Path traversal via the broker-supplied write path — the security-critical direction

**What goes wrong:**
Per the milestone's own design: "A request that produces a file gets the bytes streamed back over
the same socket; the client writes them under its own `.c64-re-tools/` and the response carries
the **local** path." That means **the broker tells the client where to write**. If the broker ever
echoes back (or the client ever trusts without validating) a filename or relative path containing
`..` segments, a drive letter, or an absolute path, the client can be made to write attacker- or
bug-controlled bytes **outside** `.c64-re-tools/` — anywhere the MCP server process has filesystem
permission to write, including its own source tree, its `node_modules`, or arbitrary user files.
This is the sharpest edge in the whole redesign: the party receiving untrusted path text is the
one about to perform the write.

**Why it happens:**
The whole point of "files travel as bytes, never as shared paths" is to stop *trusting a shared
path meaning the same thing on both sides* — but the response still has to carry *some* string
telling the client what to name the file (a snapshot ID, a Ghidra run name, an original filename
the user supplied on `vice_disk_attach`). Any of those strings can originate from, or be
influenced by, data the broker did not fully control (an emulator-reported filename, a value
threaded through from the original tool call). Treating that string as a trusted path fragment
rather than untrusted input is the exact mistake `readJsonMaybe()`/`isPlainObject()` throughout
`vice-broker-client.ts` and `normaliseLaunchProfile()` in `broker-control.mts` already refuse to
make for every *other* field crossing this boundary — the project's own standing discipline is
"never trust wire input," and file-destination strings are wire input too.

**How to avoid:**
The client must resolve every broker-supplied filename against its own fixed root
(`.c64-re-tools/<kind>/`) using a canonicalization check that **refuses** rather than sanitizes:
reject any component that is `..`, is empty, contains a path separator after decoding, or resolves
(via `path.resolve`) outside the fixed root directory — refuse by name, in this project's own
established idiom, rather than silently stripping the dangerous part and writing somewhere
plausible-but-wrong. Never accept an absolute path from the broker as a destination. Model the
validator on `normaliseLaunchProfile()`'s own discipline (`broker-control.mts:373–400`): "the
complete accepted key set... adding a knob... refuses the knob rather than silently widening the
boundary" — the same all-or-nothing refusal posture applies to path components, not just object
keys. Write a dedicated, colocated test (`*.test.ts`) that feeds `../../etc/passwd`,
`/etc/passwd`, `..%2F..%2F`, a Windows-style `C:\`, a NUL byte, and an empty string through the
resolver and asserts refusal for every one.

**Warning signs:**
A file lands somewhere under the repo root or the user's home directory that is not under
`.c64-re-tools/`. A code review that finds a `join(baseDir, serverSuppliedName)` with no
containment check afterward. A test suite with happy-path file-transfer tests only.

**Phase to address:**
The file-transfer protocol phase — this validator must exist and be tested *before* any tool is
wired to stream bytes back, not retrofitted after the six file-carrying tools
(`vice_autostart`, `vice_disk_attach`, `vice_symbols_load`, `vice_program_load`,
`vice_snapshot_save`, `vice_snapshot_load`) are migrated.

---

### Pitfall 10: Path traversal in reverse — a client-sent path read by the broker

**What goes wrong:**
The inbound direction has the same shape with the roles reversed: "a request that consumes a file
is given a local path by its caller, reads it, and streams the bytes to the broker, which stages
them on its own side." If the broker accepts a client-declared path (or filename to stage under)
uncritically, a malicious or buggy client-side caller could direct the broker to read a file the
*broker's own host* can see but should not be exposing (anything readable by the broker process's
user, not just files inside a legitimate C64 project), or to stage an incoming file at a
broker-side path outside its own intended scratch/staging area.

**Why it happens:**
Symmetrical to Pitfall 9: the design correctly removes the assumption that a path *means the same
thing* on both sides, but both directions still carry *some* string across the boundary, and
whichever side receives that string is responsible for treating it as untrusted.

**How to avoid:**
The broker-side staging path must be **broker-chosen**, not client-supplied — the client sends
bytes plus, at most, a client-side-meaningful label (for logging/diagnostics), and the broker
decides the actual staging filename/location itself (e.g. a generated temp name under its own
scratch directory), exactly mirroring how `spawnAndRecordInstance()` already generates its own
`mkdtempSync` scratch directory rather than accepting one from a caller. If the client *must* name
something the broker reads back later in the same exchange (e.g., "the file I just uploaded"), use
an opaque broker-minted handle/ID for that reference, never a path string re-echoed by the client.

**Warning signs:**
A broker-side staging directory containing files whose names came directly from client input
without transformation. A broker log showing a read attempt against a path outside its own
scratch/staging root.

**Phase to address:**
Same file-transfer protocol phase as Pitfall 9 — inbound and outbound path handling should be
designed, implemented and tested together, by the same validator discipline.

---

### Pitfall 11: One socket, two grammars — binary file bytes interleaved with JSON control lines

**What goes wrong:**
The existing control protocol is newline-delimited JSON: `createSession()`'s framing
(`vice-broker-client.ts:889–917`) buffers incoming bytes as a UTF-8 string and splits on `"\n"`.
That framing assumes **every byte on the wire is UTF-8 JSON text**. The moment file bytes are
multiplexed onto the *same* socket as control messages, that assumption breaks: a raw file byte
that happens to decode to `0x0a` (`\n`) inside a binary payload (a `.vsf` snapshot, a PNG, a `.prg`)
will be misread as a JSON-line boundary, corrupting both the file transfer and every control
message queued behind it. This is the classic framing-desync bug, and it is *worse* here than in
a generic client-server system because this project's control plane was built assuming text-only
framing from day one — nothing in the current wire format reserves a length-prefixed binary
region.

**Why it happens:**
`createSession()`'s buffer-and-split-on-newline logic is correct and simple for a protocol that is
JSON-lines all the way down. It was never designed to carry a binary payload, because until this
milestone nothing needed to.

**How to avoid:**
Do not interleave binary bytes and JSON text on the same framing layer. Pick one discipline and
apply it uniformly: either (a) length-prefix **every** frame (JSON or binary) with a fixed-width
byte count, so the reader always knows exactly how many bytes to consume before looking for the
next frame boundary — the same shape this project's own binary-monitor wire format already uses
(`stock-protocol.ts`'s length-prefixed binary framing, and `broker-launch.mts`'s own
`defaultBinmonProbe()`, which explicitly "walks complete frames off the front of the buffer" using
each frame's own body-length field rather than assuming byte-alignment) — or (b) reserve JSON
control messages for a distinct, explicitly length-prefixed "control frame" type and treat a
binary file transfer as one giant length-prefixed frame with no in-band delimiter search at all.
Never search binary payload bytes for a text delimiter.

**Warning signs:**
A file transfer that silently truncates at a specific, reproducible byte offset (the position of a
`0x0a` byte in the payload). A control message parsed as garbage immediately after a file transfer
completed. `JSON.parse()` throwing on what should have been a clean line boundary, intermittently,
correlated with file size rather than message content.

**Phase to address:**
The file-transfer protocol phase — the wire-framing redesign is the first deliverable, before any
tool is migrated to send or receive files.

---

### Pitfall 12: Backpressure and memory blowup on a large payload with no flow control

**What goes wrong:**
`createSession()`'s current buffer discipline is `buffer += chunk.toString("utf8")` — unbounded
string concatenation with no backpressure awareness. That is fine for tiny JSON control lines. It
is not fine for even a modest file: a 20MB payload read this way means holding at least one, and
transiently two, 20MB+ JS strings in memory per in-flight transfer, on a **single-threaded Node
process now serving every project on the machine at once** (Pitfall set below). Multiple
concurrent large transfers — plausible once one broker serves many projects — multiply that memory
pressure directly. On the *write* side, `socket.write()` without checking its boolean return value
or waiting for `'drain'` can queue unbounded data in the socket's internal buffer if the receiving
side reads slowly, another way to blow up memory on the sender.

**Why it happens:**
The existing protocol never had to move anything larger than a JSON control line, so nobody has
had to reason about streaming, chunking, or `Readable`/`Writable` backpressure anywhere in this
codebase yet — it is a genuinely new problem class for this project, not a regression of existing
code.

**How to avoid:**
Stream file bytes using Node's `stream` primitives (`Readable`/`Writable`, or a `Duplex` wrapper
around the socket) rather than buffering a payload fully into a string or `Buffer` before acting
on it. Respect `socket.write()`'s return value and pause/resume (or use `pipe()`) so a slow
receiver naturally throttles a fast sender. Decide and enforce a maximum payload size up front
(reject oversized requests by name, matching this project's existing refuse-by-name posture)
rather than discovering the ceiling empirically via an OOM crash. Test with a real multi-megabyte
payload over a real loopback socket, not just a small fixture — a framing bug and a memory bug both
tend to hide at small sizes and appear only past some threshold.

**Warning signs:**
Broker RSS climbing sharply and non-linearly during file transfers. A transfer that works for a
64KB RAM capture but hangs or OOMs for a larger Ghidra project artifact. `'drain'` never observed
in broker logs despite large writes.

**Phase to address:**
The file-transfer protocol phase, as a load-bearing non-functional requirement tested with
realistic payload sizes (the six file-carrying tools' actual artifact sizes: RAM captures ~64KB,
`.vsf` snapshots, Ghidra project data, disk images up to a few hundred KB, symbol files).

---

### Pitfall 13: A connection drop mid-transfer leaves a truncated file that looks valid

**What goes wrong:**
If the client (or broker) disconnects partway through a file transfer, whatever bytes already
landed on disk under `.c64-re-tools/` can look like a complete, well-formed file to a later reader
— especially for formats without a strong self-describing length or checksum at the very end. A
partially-written `.vsf` snapshot or disk image that silently passes as "the capture" is a data
integrity failure that may not surface until much later, disconnected in time from the disconnect
that caused it.

**Why it happens:**
Streaming reduces memory pressure (Pitfall 12's fix) but reintroduces exactly this risk if nothing
marks a file as provisional until it is confirmed complete — the two concerns pull in opposite
directions and both have to be solved together.

**How to avoid:**
Write to a temporary/staging name (e.g. a `.partial` suffix or a staging subdirectory) and rename
atomically into its final `.c64-re-tools/<kind>/` location only after the full expected byte count
has been received and, ideally, a checksum verified — the length-prefixed framing from Pitfall 11
gives you the expected byte count for free. Never let a reader observe a file at its final name
before the transfer that produced it is confirmed complete.

**Warning signs:**
A capture or snapshot file whose size does not match what the tool call should have produced. A
downstream consumer (an `anno_*` verb, a skill script) crashing on a truncated file with a
confusing parse error rather than a clear "incomplete transfer" signal.

**Phase to address:**
The file-transfer protocol phase, alongside Pitfalls 9–12 — atomic-write discipline is part of the
same deliverable as path safety and framing.

---

### Pitfall 14: The single-owner launch guard's job doesn't disappear — it needs a new, larger shape

**What goes wrong:**
`broker-launch.mts`'s `inFlight` boolean exists because of "the 2026-08-01 triple-launch outage
(three simultaneous x64sc launches: one SEGV, one exit 1, one exit 0 at the identical spawn
second)," and its own header is explicit that "launch PRIORITY is layered on this owner, and never
replaces or weakens it." Nothing about "no client may spawn the broker" removes the need for this
guard **inside** the broker process — `x64sc` instances are still launched on demand, per session,
by the one broker, and concurrent `acquire`s (now potentially from many more simultaneous
callers, across every project on the machine, since there is only one broker) can still race the
same async port-allocation window `acquirePortAndLaunch()`'s own header describes: "two overlapping
callers could otherwise BOTH be told the SAME candidate port is free before either commits it to
`state.instances`." One broker for the whole machine plausibly means **more** concurrent acquire
traffic hitting this exact guard than any single project's broker saw before, not less.

**Why it happens:**
It is easy to read "no client spawns the broker" as "the launch race is solved," when what changed
is *who starts the broker process*, not *how many concurrent launch requests the running broker
must serialize once it exists*.

**How to avoid:**
Keep `tryLaunchOne()`/`acquirePortAndLaunch()`'s exact synchronous check-and-set discipline
unchanged and unweakened — do not let a well-meaning refactor introduce an `await` between the
check and the set while restructuring this code for the new multiplexed-connection model. Add a
regression test (this project already has one design for this:
`broker-launch.test.ts`'s "discriminating power" check) that proves the guard still holds when
multiple **new-shape** concurrent stateful connections all acquire at once, not just multiple bare
function calls in a unit test.

**Warning signs:**
Two `x64sc` processes launched at the identical spawn second, visible in `ps` output or the
per-instance boot logs `superviseChild()` writes. A `state.instances` entry silently overwritten
by a second launch on the same port.

**Phase to address:**
The connection-lifecycle / concurrent-acquire phase — this guard's invariant must be explicitly
re-verified as part of wiring many simultaneous stateful connections through the same broker
process, not assumed to still hold because the code "didn't change."

---

### Pitfall 15: One machine-wide broker makes the single-binmon-client collision *more* likely, not just as likely

**What goes wrong:**
"Stock VICE's binary monitor services exactly one client. A second `connect()` sits unserviced in
the backlog with no reply and no EOF — indistinguishable from a wedge" (`CLAUDE.md`, Concurrency).
Today this collision requires two things to reach for the *same instance* of VICE at once within
one project's broker. Under one broker for every project on the machine, the set of things that
could plausibly race for a monitor socket grows to include: a second Claude Code session on a
*different* project that happens to share a warm/idle instance if any pooling or instance reuse is
ever introduced across projects (see Pitfall 20 below), any hand-run `nc`/debugger session on the
host, and simply more total concurrent sessions overall increasing the odds that *some* pair of
them contends. The existing `MonitorOwnershipError`/`monitor_claim` mechanism already prevents the
*silent* failure mode (claim-before-dial, so a refusal is a clean JSON response rather than a hung
socket) — but only for callers that go through it. Any new code path added during this milestone
that dials a monitor socket directly, bypassing the broker's claim step, reintroduces the
indistinguishable-from-a-wedge failure at machine scale instead of project scale.

**Why it happens:**
The claim-before-dial discipline is currently enforced by *convention plus one call site*
(`stock-dispatch.ts`'s `ensureStockSession()`), not by a structural guarantee that no code anywhere
can reach a binmon port without going through `claimMonitor()` first. A larger, busier, one-broker
world raises the cost of any single bypass.

**How to avoid:**
Treat "every binmon/text-monitor dial goes through `monitor_claim` first" as an invariant to
structurally test (a grep-based or import-graph-based structural test, in this project's own
established style — "Many test files guard the architecture rather than the behaviour," per
`CLAUDE.md`'s Architecture section) rather than a convention to remember. When adding the new
fixed-socket protocol's own dispatch layer, route every path that ends in a `net.connect()` to the
emulator's monitor ports through the existing claim primitive, with no second code path.

**Warning signs:**
`vice_diagnose` reporting `wedged` when the real cause is a second, unclaimed connection sitting in
VICE's own accept backlog — i.e., a false wedge diagnosis that a claim check would have caught.
Two client sessions from *different, unrelated projects* both reporting a stuck emulator at
overlapping times.

**Phase to address:**
The multi-project isolation phase (see the dedicated section below) — this is fundamentally a
"does the new dispatch layer preserve an existing invariant" concern, best verified once the new
per-connection dispatch code exists.

---

### Pitfall 16: The demux-by-request-id rule has to be re-derived, correctly, one layer up

**What goes wrong:**
`CLAUDE.md`'s Protocol constraints establish, at the wire level, that unsolicited messages
(`STOPPED`, `RESUMED`, `JAM`, `CHECKPOINT_INFO`, `REGISTER_INFO`) can arrive at any time and that
two of them "share a response type with a legitimate command reply, so demux must key on request-id
and never resolve a pending request with an event." The new multiplexed single-socket protocol —
carrying acquire/release/recycle/status/monitor-claim requests, file-transfer frames, *and*
whatever new event types this milestone introduces (a disconnect notification, a progress update
for a long file transfer, a broker-initiated reclaim notice) — is a **second protocol layer** with
the exact same shape of hazard: something can arrive on the wire that is not a direct reply to the
most recently sent request, and a naive "read the next line, assume it answers my last request" FIFO
matcher (which is what `sendAndAwaitLine()`'s current `pending.shift()` does, correct today only
because "every session method awaits its own `sendAndAwaitLine()` call to settle before this client
ever writes a second request line") will misattribute an unsolicited/out-of-order message to the
wrong pending request the moment concurrent in-flight requests or async server-pushed events are
introduced.

**Why it happens:**
`createSession()`'s FIFO-by-arrival-order matching is explicitly documented as correct *only*
under the current one-request-at-a-time-per-connection usage pattern (`vice-broker-client.ts`
lines 845–855: "FIFO order is sound here because every session method awaits its own... call to
settle before this client ever writes a second request line"). Any new feature that pipelines
multiple in-flight requests on one connection, or that lets the broker push an unsolicited
notification (e.g., "your file transfer is 40% done," or "your session was reclaimed"), breaks that
precondition silently — the code keeps compiling and keeps working in every test that preserves
one-at-a-time usage, and fails only once real concurrency or a real push notification appears.

**How to avoid:**
If the new protocol needs concurrent in-flight requests or server-pushed events on one connection,
give every request an explicit correlation id the response echoes back, and match responses to
pending entries **by id**, never by arrival order — the same fix `CLAUDE.md`'s wire-level rule
already prescribes one layer down. If the new protocol deliberately stays one-request-at-a-time per
connection (a legitimate, simpler choice), document that constraint explicitly next to
`sendAndAwaitLine()`'s successor and add a test that proves a second request sent before the first
resolves is refused or queued, never interleaved.

**Warning signs:**
A file-transfer progress notification silently resolves an unrelated pending `status` request. A
broker-initiated reclaim notice (Pitfall 7's evidence-voiding path) gets misattributed to whatever
request happened to be pending at the same moment.

**Phase to address:**
The multiplexed-protocol design phase — this decision (id-correlated vs. strictly sequential) has
to be made before file-transfer and connection-lifecycle features are layered onto the same
socket, because it constrains what either of those can safely do concurrently.

---

### Pitfall 17: A synchronous, blocking-socket checkpoint-hit frame now stalls a shared process, not a per-project one

**What goes wrong:**
"A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the
blocking socket, from inside the CPU loop**... On a hot address this can stall the emulator
thread" (`CLAUDE.md`, Protocol). Today that stall is scoped to one emulator process serving one
project. Nothing about this milestone changes VICE's own behavior — but the **broker process**
that mediates access to that emulator is now shared by every project on the machine, and Node's
single-threaded event loop means any code path in the broker that itself blocks synchronously
(e.g., a naive synchronous read loop mirroring the emulator's own blocking behavior, or a
long synchronous JSON stringify/parse over a huge status payload) stalls dispatch for **every**
other project's connections simultaneously, not just the one that triggered it.

**Why it happens:**
The broker's dispatch code is already single-threaded and event-driven (per `CLAUDE.md`'s own
"Global state" bullet: "The event loop is single-threaded throughout, and the broker spawns
emulator instances as child processes rather than worker threads"). That was always true. What
changes is the *cost of a mistake* in that dispatch code — a per-project broker's occasional bad
synchronous op only ever hurt that one project; a shared broker's bad synchronous op now hurts
everyone at once.

**How to avoid:**
Audit every new code path added for this milestone (the fixed-socket dispatch layer, the
file-transfer streaming code, any new per-connection bookkeeping) for accidental synchronous
blocking work — large synchronous `Buffer` operations, synchronous filesystem calls
(`readFileSync`/`writeFileSync`) on a hot path, or anything that loops without yielding back to
the event loop. This project already has the right instinct in one place — `readJsonMaybe()`
deliberately reads `broker.json` synchronously precisely because it is small and infrequent; that
same casualness must not be copied onto a per-request or per-file-chunk hot path now that the
broker is shared. Keep VICE's own emulator-loop stall (an accepted, documented, per-instance
property) conceptually separate from broker dispatch performance, which this milestone can and
should protect.

**Warning signs:**
One project's checkpoint-heavy workload causing visible latency spikes in an unrelated project's
unrelated tool calls on the same broker. Broker event-loop lag metrics (if collected) spiking
during a large file transfer or a hot checkpoint window.

**Phase to address:**
The multi-project isolation phase, as a performance/isolation non-functional requirement — one
noisy project's workload must not measurably degrade another's.

---

## Multi-Project Interference (One Broker, Many Projects)

| Failure mode | Concrete symptom | Prevention |
|---|---|---|
| One project's `vice_recycle`/wedge-triage reaches another project's instance | A recycle call unexpectedly tears down an emulator the caller never acquired | Preserve and extend the existing ownership check — `broker-control.mts`'s `onRecycle` is already only invoked "after this listener has already confirmed the requesting connection holds the named target grant" (lines 216–221); every new op added for this milestone (file transfer targeting an instance, status filtered to "mine") must run through the same connection-holds-grant check, never a bare `target_id` lookup |
| One project's runaway/hung emulator starves the whole machine | `no_free_port`/`at_capacity` refusals appear for a project that has never opened more than one session itself | There is no fair-share concept today (`max_instances`/port-scan ceiling are already machine-wide); this milestone removes the informal per-project fence that separate discovery files used to imply for operators who ran one broker per project. Decide explicitly whether a per-connection or per-token quota is needed, or document that the ceiling is intentionally shared and sized for worst-case aggregate load |
| A user cannot tell whether a stuck emulator is theirs | `status`/`vice_diagnose` output lists instances with no project or session identity attached (`StatusInstanceEntry` today carries only port/url/state/reason/epoch/hasMonitorClient) | Add a caller-visible label to `status` output tying each instance to the connection/grant that acquired it, so a user comparing their own session's grant id against the status list can positively identify "mine" without guessing by port number |
| FD/port/memory exhaustion is no longer naturally bounded per project | A single machine-wide broker accumulates open sockets for every long-lived stateful MCP-server connection across every project; a Claude Code session that does not exit cleanly leaks a socket the broker never sees close | Bound and monitor total connection count and per-connection resource usage at the broker level; treat "many stale-but-technically-open connections" as an operational condition to detect (e.g., via `status`/`host_state` reporting connection age), not something a per-project restart used to paper over |
| Diagnosis confusion when triaging | A user runs `vice-wedge-triage` against "the" emulator without realizing three unrelated projects each have one running | `vice_diagnose`/status responses should make it structurally impossible to act on the wrong instance — require the caller's own held grant id for any diagnostic or recovery action rather than accepting a bare port number typed by a human |

---

## Deletion & Migration Pitfalls

This milestone deletes real, load-bearing code: path translation (`hostpath.ts`/
`containerpath.ts`), the transport-decision branch of `container-guard.mts`'s
`isInsideContainer()`, `broker.json` and its readers, and (per the milestone's own note) the
Ghidra symlink alias once file bytes are staged broker-side. The project's own measured blast
radius at the milestone's open — "~38 non-test production modules touch path translation; 14
touch `host-tool-client.ts`" (`.planning/PROJECT.md`) — means this is not a small, easily-verified
deletion.

### Pitfall 18: A "fallback to the old route" is not a safety net here — it is the failure the milestone exists to prevent

**What goes wrong:**
It is tempting, mid-migration, to leave the old path-translation call reachable "just in case" a
not-yet-migrated tool still needs it — a `try new socket path, fall back to hostpath.ts on
failure` shim. The milestone's own stated hypothesis is explicit that this is not an acceptable
end state: the redesign is validated only if the old seam is **gone from production code**, not
merely bypassed by default. A live fallback path, even an unused one, means the thing this
milestone claims to have removed ("nothing anywhere needs to know whether it is running on the
host or inside a devcontainer") is still present and still capable of silently reactivating —
especially dangerous because a fallback that "just works" when hit gives no signal that it was hit
at all.

**Why it happens:**
Deleting ~38 call sites in one atomic step is risky and slow; a phased migration naturally wants a
safety net for the interim state. That instinct is right for most migrations and wrong for this
one specifically, because the milestone's success criterion is architectural absence, not
behavioral equivalence with a fallback available.

**How to avoid:**
Migrate incrementally by **call site count converging to zero**, not by adding a parallel path.
Track the exact number the milestone already measured (38 path-translation consumers, 14
`host-tool-client.ts` consumers) as a literal countdown; each phase's exit criterion is "N fewer
callers of `hostpath.ts`/`containerpath.ts`/`host-tool-client.ts` than at phase start," verified by
a grep/import-graph census, not by "the new path works in the cases I tried." Delete the old files
themselves only once the census reaches zero, and delete them as a whole phase deliverable rather
than leaving them present-but-unimported (present-but-unimported code is exactly the "bypassed
rather than gone" state a later reader or a later regression can silently reawaken).

**Warning signs:**
`hostpath.ts`/`containerpath.ts` still present in the tree with zero importers for several phases
in a row "just in case." A code review comment saying "left the old path as a fallback for safety."
Grep for `isInsideContainer()` finding a call site that still branches transport-reachability
decisions on it, contradicting the milestone's own stated design ("the dial order *is* the
host/container detection, so no code reads `isInsideContainer()` to decide how to reach the
broker").

**Phase to address:**
Every migration phase individually (via the call-site census as its exit gate), with a final
deletion phase whose entire deliverable is removing the now-zero-importer files and tightening the
structural tests that used to police them.

---

### Pitfall 19: Structural tests that assert absence can pass trivially once their subject is gone, hiding a miss elsewhere

**What goes wrong:**
This project's structural tests are largely "does this closed set/region contain a forbidden
pattern" checks — `vice-broker-client.ts`'s own header names one directly: "A structural test in
`vice-broker-client.test.ts` extracts exactly the region between this marker and REGION END below
(by these marker strings, not a whole-file scan) and asserts it contains no filesystem-write
construct." Likewise, `hostpath-consumers.test.ts` pins "the host-path consumer set... closed to
exactly four production modules." These tests are scanning **named regions or named files**. If a
deletion phase removes the marked region or the named file *before* updating what the test scans,
the test can pass — not because the invariant holds, but because there is nothing left for it to
find. A structural test asserting "region X contains no filesystem write" is vacuously true once
region X no longer exists; a consumer-set test pinned to four specific module names silently stops
checking anything the moment a *fifth* module reintroduces path-translation logic somewhere else
entirely, because that test only ever looked at the original four.

**Why it happens:**
Region-scoped and file-scoped structural tests are precise by design — that precision is exactly
what makes them useful today. The same precision means they cannot, by construction, catch a
violation that appears **outside** their scanned scope, and a deletion that shrinks or removes the
scanned scope without a matching widening of what "the whole tree" means for that invariant leaves
a blind spot that looks like a passing test.

**How to avoid:**
When retiring a region-scoped or consumer-set-scoped structural test, replace it with a
whole-tree-scoped equivalent for the remaining lifetime of the invariant it protected, rather than
deleting it outright the moment its original scanned region disappears — e.g., "no production
module outside `stock-protocol.ts` may import `node:net` for binmon bytes" should become, if the
old module is deleted, "no production module *anywhere* may do this," not simply removed because
the one place it used to matter is gone. Before deleting `hostpath.ts`/`containerpath.ts`
themselves, add (or confirm the project already has) a whole-tree grep-based test asserting zero
importers of those module names project-wide, and let *that* test — not the old four-module
consumer-set test — be the one still running after the files are gone, so a stray reintroduction
anywhere in the tree is caught rather than silently unscanned.

**Warning signs:**
A green CI run immediately after a large deletion, with no structural test's assertion count or
scanned-file count visibly changing to reflect the new, smaller (or larger, if consolidated
elsewhere) surface. A structural test whose only failure mode was removed along with the code it
used to guard.

**Phase to address:**
The final deletion phase — sequence the structural-test widening/replacement **before** deleting
the files those tests currently scope to, so a test run between "widen the test" and "delete the
file" would have caught a stray survivor, proving the net catches misses rather than merely
agreeing with an empty result.

---

## Testing Pitfalls Specific to This Project

This project's suite is `node --test` with **no mocking library**; every function touching env,
time, spawning or I/O takes an injectable override instead (`CLAUDE.md`, Conventions). Testing a
socket protocol, a connection-is-the-session lifecycle, and file transfer under that constraint
needs the following, plus explicit avoidance of four already-measured local traps.

### How to test each new surface without a mocking library

- **The wire protocol / demux (Pitfalls 11, 16):** Test the pure framing/parsing functions
  (frame-boundary walking, id-correlation matching) as plain functions over `Buffer`/string input
  with no socket involved at all — the same style `broker-launch.mts`'s own
  `binmonRequest()`/frame-walking logic in `defaultBinmonProbe()` is already unit-testable in
  isolation from a real connection. Reserve real `net.createConnection`/`net.createServer` pairs
  on an ephemeral port (`port: 0`) for a smaller number of true integration tests that prove the
  framing survives an actual TCP round trip, not for every case.
- **Connection-is-the-session lifecycle (Pitfalls 5–8):** Build a synthetic client/server pair over
  real loopback sockets (mirroring `stock-run-until.ts`'s existing "event-driven port... against a
  synthetic client" pattern already used for the single-resume-per-wait invariant) and drive it
  through `socket.destroy()` (simulates an abrupt SIGKILL-style close with no goodbye), `socket.end()`
  (simulates a graceful close), and simply never sending data (simulates idle) — assert the
  broker's reclaim logic reacts correctly to each, using injected `now()`/timer overrides so idle
  and keepalive-timeout tests do not need to wait out real wall-clock minutes.
- **File transfer (Pitfalls 9–13):** Test the path-containment validator as a pure function with no
  I/O (feed it traversal strings, assert refusal — fast, no filesystem needed). Separately, test
  the actual write path with a real temp directory (`mkdtempSync`, this project's own established
  pattern from `broker-launch.mts`'s scratch `XDG_CONFIG_HOME`) and a real loopback socket carrying
  a real multi-megabyte buffer, asserting byte-for-byte round trip and asserting that a mid-transfer
  `socket.destroy()` never leaves a file visible at its final name.
- **Backpressure (Pitfall 12):** A real loopback pair with the receiving side deliberately paused
  (stop reading, or wrap in a slow `Writable`) to force `socket.write()`'s buffer to fill, asserting
  the sender's own flow-control logic (pause on backpressure, resume on `'drain'`) actually engages
  rather than buffering unboundedly in JS-land.

### Four measured local traps to design the new suite around from the start

1. **A live broker deterministically reddens one existing test** (not a flake). Any new test that
   might interact with a *real* running broker on the fixed port must not assume none is running —
   either use a dynamically allocated port for every test broker instance, or explicitly check for
   and refuse to run against an unexpected pre-existing listener on the fixed port, rather than
   silently producing a red result that looks like a new defect.
2. **`node --test` silently skips a missing or typo'd test file and still exits 0.** Every new test
   file for this milestone must be verified present and actually executed — `ls` the expected new
   `*.test.ts`/`*.test.mts` files and cross-check against the glob `node --test` actually runs,
   rather than trusting a green run alone as proof a new test exists and ran.
3. **Piping `npm test` through `tail` (or any pipe) reports the pipe's exit code, not the test
   run's**, faking a green baseline. Always redirect to a file and check `$?` on the same command
   line, or run in the foreground with no pipe, when validating this milestone's new tests locally.
4. **The suite has a recorded history of races on scratch files written into the repo tree.** Any
   new test exercising file transfer or connection lifecycle must write its scratch fixtures under
   a fresh `mkdtempSync(tmpdir())` directory per test, never a fixed path inside the repository
   working tree, especially since `node --test` can run test files in parallel.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Leaving a fallback to `hostpath.ts`/`containerpath.ts` "temporarily" during migration | Lower short-term migration risk | Directly falsifies the milestone's own stated validation hypothesis; a later reader cannot tell whether the fallback is dead or load-bearing | Never — use the call-site-census approach (Pitfall 18) instead |
| Buffering a whole file into memory before validating/streaming it, "for now, files are small" | Simpler first implementation | Silent OOM ceiling that moves with whichever tool produces the largest artifact next (a bigger Ghidra project, a larger disk image) | Only as an explicitly time-boxed first pass with a tracked follow-up item, never as the shipped behavior for the milestone's close |
| Reusing the existing `sendAndAwaitLine()` FIFO-by-arrival-order matching unchanged for the new multiplexed protocol | No new code needed for response correlation | Reintroduces the exact request-id-demux defect class `CLAUDE.md` documents at the wire-protocol layer, one layer up (Pitfall 16) | Only if the new protocol is deliberately and permanently kept strictly one-in-flight-request-per-connection, documented as such |
| Deferring the token/credential redistribution question (Pitfall 1) past the first working prototype | Faster demo of "it dials the fixed port and works" | An unauthenticated process-spawning daemon reachable machine-wide (or network-wide, per the `0.0.0.0` decision) for however long the deferral lasts | Never for anything merged past a throwaway spike |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `host.docker.internal` reachability from inside a devcontainer | Assuming a loopback (`127.0.0.1`) bind is "safe enough" and narrowing to it | Keep the broker's listener bound `0.0.0.0` (or an equivalent non-loopback bind), per the already-accepted `PKG-04` rationale — `host.docker.internal` resolves to the Docker bridge gateway, not loopback, on Linux |
| Dial-order fallback (`127.0.0.1` then `host.docker.internal`) | Treating the first successful TCP `connect()` as proof of a genuine broker | Require a protocol-level identity handshake (Pitfall 2) before trusting either candidate address — a bare accept proves nothing about who is listening |
| Node's default socket options | Assuming an idle connection is detected promptly by the OS | Explicitly enable and tune `setKeepAlive()` rather than relying on Linux's ~2-hour default keepalive interval |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded string/Buffer accumulation for file payloads on one shared broker | Broker RSS spikes non-linearly with concurrent transfers | Stream with backpressure; cap max payload size | The first time two projects transfer large files concurrently, or one transfer exceeds a few MB |
| Machine-wide `max_instances`/port-scan ceiling shared across every project | `no_free_port`/`at_capacity` for a project that never opened more than one session itself | Explicit quota/fair-share decision, or documented as intentionally shared | As soon as more than a handful of projects are active on one machine at once |
| Synchronous work on the broker's single event loop | One project's tool calls visibly slow down while an unrelated project transfers a file or hits a hot checkpoint | Audit for synchronous FS/Buffer work on hot paths; keep dispatch non-blocking | Any workload with a genuinely large or hot synchronous operation, once more than one project shares the process |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deleting `broker.json` without replacing its token-distribution role | Fixed, well-known port becomes callable by anything on the machine (or network segment, given the `0.0.0.0` bind) with no credential at all | Explicitly redesign credential distribution as part of the fixed-endpoint phase (Pitfall 1) |
| Treating a broker-supplied filename as a trusted path fragment | Path traversal — arbitrary file write outside `.c64-re-tools/` from a party that literally names where the write happens | Canonicalize-and-refuse validator, tested against traversal strings, on both write (Pitfall 9) and read (Pitfall 10) directions |
| Re-using `PKG-04`'s old risk analysis unchanged once file transfer and skill-script traffic share the same socket | Understated residual risk — a leaked token now grants file read/write, not just instance spawn/kill | Re-open and re-scope the accepted-risk record for this milestone (Pitfall 4) |
| Trusting a bare TCP accept as proof of a genuine broker | A stale, previous-version broker or an unrelated process squatting the fixed port is indistinguishable from the real thing until something breaks confusingly later | Protocol-level identity handshake before trusting any connection (Pitfall 2) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|------------------|
| No broker found on either candidate address | A confusing low-level connection-refused error instead of an actionable message | Refuse **by name** with the exact remedy, matching this project's established pattern for every other missing external dependency — e.g. "no broker found at 127.0.0.1:<port> or host.docker.internal:<port> — start it with `<command>`" |
| `status`/diagnostic output with no project identity per instance | A user cannot tell which of several listed instances is theirs when triaging a stuck emulator | Surface the caller's own grant/connection identity next to each instance so "is this mine" is a direct comparison, not a guess |
| A void-worthy connection-drop mid-capture reported identically to a normal, clean release | User trusts an artifact that was actually produced by a session that vanished mid-write | Distinguish a clean release from a reclaim-due-to-disconnect in whatever surfaces run status to the user, and mark affected artifacts void per the existing `vice-wedge-triage` procedure |

## "Looks Done But Isn't" Checklist

- [ ] **Fixed-port handshake:** Looks done once a client can `connect()` and exchange one message —
      verify it also refuses a stale-protocol or foreign-process listener by name, not just the
      happy path.
- [ ] **Token/credential redesign:** Looks done once `timingSafeEqual` still gates requests —
      verify there is an actual, documented, tested channel by which a legitimate client learns the
      current token, now that `broker.json` is gone.
- [ ] **File transfer:** Looks done once a small fixture file round-trips correctly — verify a
      multi-megabyte payload, a mid-transfer disconnect, and a traversal-attempting path all behave
      correctly too, not just the small clean case.
- [ ] **Connection-is-the-session reclaim:** Looks done once a graceful `socket.end()` triggers
      cleanup — verify a `SIGKILL`/`socket.destroy()` (no goodbye at all) and a long-idle connection
      both do too.
- [ ] **Path translation deletion:** Looks done once `hostpath.ts`/`containerpath.ts` are deleted —
      verify a whole-tree grep for their names, and for any surviving `isInsideContainer()` call
      site that still decides *transport reachability* (as opposed to some unrelated purpose), both
      return zero.
- [ ] **Multi-project isolation:** Looks done once two projects can each acquire an instance without
      erroring — verify one project's recycle/status/diagnose calls cannot see or affect another
      project's instance at all, and that a runaway one degrades gracefully rather than starving
      the others silently.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Unauthenticated fixed port shipped without a credential mechanism | HIGH | Treat as a security incident even pre-release: add the credential mechanism, rotate any token that may have been exposed, and audit whether anything on the machine dialed the port during the exposure window |
| Path traversal write reaches production | HIGH | Add the canonicalize-and-refuse validator immediately; audit `.c64-re-tools/` and surrounding directories for files written outside expected subdirectories since the regression was introduced; treat as a security incident, not a bug fix |
| Stale broker squatting the fixed port causes silent misbehavior | MEDIUM | Add the identity handshake; in the interim, document a manual `ss -tlnp`/process-check remedy for a user hitting this |
| Structural test silently stopped covering a deleted seam | LOW–MEDIUM | Re-scope the test to whole-tree coverage of the same invariant (Pitfall 19) and re-run it before trusting the deletion is complete |
| A voided run's evidence was actually lost because disconnect-triggered incident recording was never wired up | MEDIUM | Add the synthetic reclaim-reason path (Pitfall 7) and retroactively flag any artifact produced in a session that ended via unexplained disconnect during the gap |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (logical, pre-roadmap naming) | Verification |
|---------|--------------------------------------------------|---------------|
| 1 (token distribution deleted with discovery file) | Fixed-endpoint bind & handshake | A documented, tested credential mechanism exists and is exercised by a test that dials without it and gets refused |
| 2 (stale/foreign process squats the port) | Fixed-endpoint bind & handshake | A test connects a fake, wrong-protocol listener on the fixed port and asserts the real client refuses it by name |
| 3, 4 (bind address: container reachability vs. blast radius) | Fixed-endpoint bind & handshake | A real container-side dial to `host.docker.internal` succeeds in CI or a documented manual check; the re-scoped `PKG-04` risk note is written |
| 5–8 (connection-is-the-session lifecycle) | Connection lifecycle | Synthetic-client tests cover `destroy()`, `end()`, idle, and restart-overlap cases, each asserting correct reclaim and (where relevant) incident recording |
| 9, 10 (path traversal, both directions) | File-transfer protocol | A dedicated test feeds traversal/absolute/NUL paths through the validator and asserts refusal for every one, before any tool is migrated |
| 11–13 (framing desync, backpressure, partial writes) | File-transfer protocol | A real loopback test moves a multi-megabyte payload interleaved with control messages and asserts no corruption; a mid-transfer `destroy()` never leaves a file at its final name |
| 14 (launch guard under new concurrency shape) | Connection lifecycle / concurrent acquire | The existing `inFlight` discriminating-power test is extended to drive concurrent *stateful connections*, not just concurrent function calls |
| 15, 17 (single-binmon-client collision, shared-process stalls) | Multi-project isolation | A structural test asserts every monitor dial path goes through `monitor_claim`; a load test proves one project's hot workload does not measurably delay another's |
| 16 (demux one layer up) | Multiplexed-protocol design | Either an id-correlation test proves correct matching under concurrent in-flight requests, or a strictly-sequential constraint is documented and tested |
| 18, 19 (fallback survives; structural tests stop scanning) | Deletion phase | Call-site census reaches zero before file deletion; structural tests are re-scoped to whole-tree before their originally-scanned region disappears |
| Multi-project interference table (ownership, starvation, diagnosis, exhaustion) | Multi-project isolation | Two-project integration test: one project's recycle/status cannot touch another's instance; a resource-exhaustion scenario degrades with a clear error rather than silent starvation |
| Testing traps (live broker, silent skip, piped exit code, scratch races) | Every phase, as a working-practice standard | Team practice: never pipe `npm test`; verify new test files actually ran; use `mkdtempSync` for all new scratch fixtures |

## Sources

- `CLAUDE.md` (this repo) — Constraints list, read in full; nearly every Protocol/Concurrency/
  Architecture bullet is a documented past failure this research draws directly on.
- `.planning/PROJECT.md` — `## Current Milestone: v2.0.0` section (measured blast radius, decided
  scope, explicit non-goals) and the `PKG-04` Key Decisions row (dated 2026-08-22, `0.0.0.0` bind
  accepted-risk record).
- `src/mcp/vice/broker-launch.mts` — `inFlight`/`inFlightReason` single-owner guard
  (lines 64–96, 587–777), stock bind defaults and widening warnings (lines 152–375), the
  binmon readiness probe's frame-walking discipline (`defaultBinmonProbe()`, lines 907–1014).
- `src/mcp/vice/vice-broker-client.ts` — header naming the six retired file-protocol mechanisms
  (lines 1–21), `classifyConnectHost`/`resolveControlTarget` refusing a wildcard-bind address as a
  dial target (lines 191–298), `MonitorOwnershipError` and claim-before-dial discipline
  (lines 704–742), `createSession()`'s FIFO response matching and its stated precondition
  (lines 845–1173).
- `src/mcp/vice/broker-control.mts` — module header on wire format, token gate, and the `0.0.0.0`
  bind rule (lines 1–23), `normaliseLaunchProfile()`'s refuse-unknown-keys discipline
  (lines 345–400) used here as the model for path-component validation.
- `src/skills/vice-wedge-triage/SKILL.md` — the five-state triage taxonomy, the
  incident-record-before-recycle rule, and the single-binmon-client contention discussion.
- `docs/stock-hard-losses.md` — the three permanent, unrecoverable stock losses (SID read-back,
  matrix keyboard, RESTORE/NMI), confirmed out of scope for any transport-layer fix and not
  proposed for recovery anywhere in this document.
- `.planning/STATE.md`, `.planning/MILESTONES.md`, `.planning/phases/16-packaging-and-repo-shape/`
  (`16-PKG04-EVIDENCE.md`, `16-RESEARCH.md`, `16-VERIFICATION.md`) — the `PKG-04` accepted-risk
  decision's full evidentiary trail, cited for Pitfalls 3–4.
- General Linux/Node networking facts (TCP keepalive defaults, Node's lack of default keepalive,
  NAT/proxy idle timeouts) — widely documented platform behavior, **not** measured against this
  project's own hosts; flagged inline as MEDIUM/LOW confidence where used.

---
*Pitfalls research for: c64-re-tools v2.0.0 "One Broker, One Socket"*
*Researched: 2026-09-19*
