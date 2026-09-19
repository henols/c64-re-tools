# Phase 63: The Monitor Channel Relayed, and the Connection as the Session - Research

**Researched:** 2026-09-19
**Domain:** Node `net` TCP relay/proxy design, socket-lifecycle detection (FIN/RST/keepalive/idle-timeout), single-choke-point session management, incident-before-reclaim ordering
**Confidence:** HIGH for all code-shape claims (every citation below was read against HEAD this session); MEDIUM for the exact relay wire-mechanics recommendation (a design synthesis, not yet-written code); LOW/ASSUMED flagged individually

<user_constraints>
## User Constraints

**No `63-CONTEXT.md` exists — `/gsd-discuss-phase` was not run for this phase.** There are therefore no phase-local `Decisions` / `Claude's Discretion` / `Deferred Ideas` sections to copy verbatim. In their place, two upstream documents carry binding, already-settled design intent that this research treats with the same authority a CONTEXT.md's `Locked Decisions` would carry:

### From `.planning/REQUIREMENTS.md`'s "Settled design decisions" (project-wide, not open for re-derivation)

- **Decision 3 — Session model:** "skill calls stateless; the MCP connection **is** the session." This is SESS-01/SESS-02's literal wording, promoted to a milestone-wide settled decision.
- **Decision 6 — Wire shape (decided 2026-09-19):** "one endpoint, multiple tagged connections. One long-lived connection relays binary-monitor traffic; short-lived stateless connections carry files and skill-script calls; all dial the same fixed port. **No new envelope format, and `stock-protocol.ts`'s socket-consumption contract is not touched.** The single-physical-socket multiplexed alternative was considered and rejected as a materially larger and riskier cutover for no behavioural gain." This directly answers "how can one connection carry both control and byte-transparent binmon traffic" — the settled answer is **not** one multiplexed socket; it is **several physical TCP connections to the same fixed port, distinguished by an application-level tag**, each connection dedicated to one concern for its whole life.

### From `ROADMAP.md`'s Phase 63 section (verbatim quoted in the task prompt, not re-quoted here in full)

- **Shape: ATOMIC at the seam level** — `ensureStockSession()`'s `deps.ensureLease` is the single choke point; ALL of this milestone's requirements confirm this claim holds in the real code (see Finding 1 below), and this research additionally identifies the **narrower, more precise** choke point the swap actually needs: `stockConnect()`'s and `textConnect()`'s own `client.connect(host, port)` call sites, not the lease-acquisition step itself.
- Cross-cutting constraints on demux-by-request-id, `stock-protocol.ts`/`text-protocol.ts` contract preservation, the single-binmon-client collision, the close-is-release extension, and per-operation ownership checks are all treated as binding throughout this document; see the corresponding Common Pitfalls / Architecture Patterns entries below for how each is satisfied concretely against real code.
- `CR-01` (`text-protocol.ts:850`, the inert `timeoutMs` in `TextMonitorClient.command()`) is carried debt, explicitly out of scope; if a Phase 63 plan touches this line it must say so.

**No `Deferred Ideas` to record** — this phase has no discussion transcript to draw them from. The planner should treat every open design question below as needing either its own judgment call (recorded in the plan) or a `checkpoint:human-verify`.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | A skill script's call is a stateless one-shot — open, send, receive, close — binding no emulator, holding no lease | **Already fully implemented** for the host-tool family: `host-tool-client.ts`'s `hostToolOverControlPlane()` is byte-for-byte this shape today (see Finding 4). SESS-01 is not "build this pattern," it is "confirm `vice_*` binmon/text calls do NOT need this shape (they don't — they're MCP-server calls, SESS-02) and that no code mistakenly gives a skill script a lease." |
| SESS-02 | An MCP server's connection stays open for the life of the process; the broker holds that connection's emulator instance for exactly as long as the socket lives | Already true for the **control connection** (`vice-proxy.ts`'s single module-scope `controlSession`, opened once via `openBrokerControl()`, closed only at process exit) and already true for the **release-on-close** mechanism (`broker-control.mts`'s `attachControlProtocol()`, `socket.on("close", ...)` → `opts.onRelease()`, Finding 2). What's NEW: the **binmon/text byte stream** itself must move onto a connection with the identical lifetime discipline instead of a private direct dial (Finding 1, Finding 5). |
| SESS-03 | The broker reclaims a session from socket events alone; a `SIGKILL`ed client (no goodbye) is still cleaned up | **Already implemented for the control connection** (Finding 2: `handleRelease()` identity-verified-kills the instance on `"close"`, which fires for `SIGKILL` exactly as for a clean exit). The gap: this reclaim currently protects the **grant**, not the **binmon dial**, which today is a client-initiated raw socket the broker has no visibility into at all. Once the monitor traffic itself rides a broker-owned connection, this existing mechanism extends to it directly — see Architecture Pattern 2. |
| SESS-04 | A client death producing no `FIN` at all is detected within a bounded time, not via the OS's ~2-hour keepalive | **Genuinely new work.** Nothing in this tree currently calls `socket.setKeepAlive()` or `socket.setTimeout()` on any control-plane or monitor connection (Finding 6 — exhaustive grep, zero hits). This is the one requirement with no existing partial implementation to extend. |
| SESS-05 | A drop mid-operation writes an incident record, broker-minted, before the instance is reclaimed, naming the in-flight operation; a live capture/checkpoint run is marked void | Partially prepared: `broker-home.mts` already exports `brokerIncidentsDir()` (machine-level, unwired, Finding 7) and `incident-record.ts`'s renderer/writer are directly reusable — but both are **client-side, per-project** today (`stock-recycle.ts`, `toolsDir()`-rooted). The broker itself (host-bound, `.mts`) has never written an incident record; this is new plumbing on the host side, not a reuse of the existing client-side call site. |
| SESS-06 | A user can tell which live session is their own, in a shared, machine-wide broker | **No existing wire field carries this at all.** `StatusInstanceEntry` has zero identity fields (Finding 8); the `hello` op's `tag` (Phase 62) is echoed but never persisted against a grant or surfaced in `status`. `stock-recycle.ts`'s `CLAUDE_CODE_SESSION_ID` read (Finding 9) is a **client-only, file-only** precedent for the kind of value that should travel — it is never sent to the broker today. |

</phase_requirements>

## Summary

Phase 62 built a client-facing fixed-endpoint dial (`broker-endpoint.ts`) and a machine-level broker home (`broker-home.mts`), but **neither is wired into the tool-call path yet**: `vice-proxy.ts` still opens its control session through the old, `broker.json`-reading `openBrokerControl()`, and `dialBrokerEndpoint()` has zero production callers (confirmed by exhaustive grep). Separately, and this is the actual subject of Phase 63, `stockConnect()` (`stock-connect.ts:422-430`) and `textConnect()` (`text-connect.ts:126-128`) each perform a **second, independent, raw TCP dial straight from the client process to the emulator's own binmon/text-monitor port** (`client.connect(host, port)` / `client.connect(host, remoteMonitorPort, ...)`), entirely outside the broker's control-plane socket. The broker's `claimMonitor`/`releaseMonitor` control ops are bookkeeping-only calls over the *existing* control connection; they never touch the actual byte stream. **This second, unmediated socket is the "direct dial" the roadmap goal names**, and it is the thing Phase 63 must eliminate.

The good news: the swap is genuinely surgical. `ensureStockSession()` (`stock-dispatch.ts:294`) is confirmed to be the single choke point every `vice_*` tool passes through — but the exact line that must change is one level deeper, inside `stockConnect()`/`textConnect()`, where `host`/`port` (already derived, via `HeldLease`, from `activeInstance().url` — itself already run through the *old* host/container loopback-rewrite this whole milestone is retiring) are handed to a raw `net.createConnection()`. Replacing that one call site in each of the two files — so it dials the fixed broker endpoint and completes a relay handshake instead of dialing the emulator directly — flows automatically through every one of the ~50 dispatch-table entries with no per-tool work, because they all funnel through `ensureStockSession()`.

The single hardest technical fact this research surfaces, not stated anywhere in the roadmap: **`stock-protocol.ts`'s `ViceMonitorClient` and `text-protocol.ts`'s `TextMonitorClient` both create their own socket internally** (`net.createConnection({host, port})`, `stock-protocol.ts:2056`; same shape at `text-protocol.ts:802`) — neither class currently has any way to be handed an already-connected socket. The roadmap's own wording ("only the *source* of the socket they are handed changes") presumes an injection point that does not exist today. Satisfying "their content is not this phase's subject" while still relaying requires adding a **new, narrow entry point** to each class (e.g., an `attach(socket)` alternative to `connect(host, port)`) that reuses every byte of the existing data/close/error wiring unchanged — a real, if small, change to each protocol module's public surface, not a zero-touch pass-through.

The second hardest fact: `broker-control.mts`'s existing socket handling is **string-based** (`buffer += chunk.toString("utf8")`, line-split on `"\n"`) for every one of its 9 ops today, because every existing payload is JSON text. A relay connection's post-handshake bytes are raw VICE binmon frames — arbitrary bytes, not guaranteed valid UTF-8. Any design that reuses the *same* socket for both the `hello`/attach JSON handshake and the subsequent binmon bytes must switch that socket from string-mode to Buffer-mode at the exact byte boundary after the handshake's trailing `\n`, or binary data arriving in the same TCP segment as the handshake reply will be corrupted by a UTF-8 decode/re-encode round trip. This is the identical class of hazard Phase 64's own cross-cutting constraints already name for file bytes ("String accumulation corrupts binary") — it lands here first, one phase earlier, because the monitor relay is the first byte-oriented, non-JSON payload to ride this control plane.

**Primary recommendation:** keep `vice-proxy.ts`'s existing acquire/release/recycle/status control connection exactly as it is for this phase (it is out of scope — `stock-machine.ts` and `vice-proxy.ts` keep their `stock-paths.ts`/legacy imports until Phases 64/66 per the roadmap's own convergence note). Add a **second, dedicated connection per claimed monitor channel** — one physical TCP socket per `(targetId, channel)` pair, dialled at the fixed endpoint via `hello` with a distinguishing tag (e.g. `"monitor-binary"` / `"monitor-text"`), immediately followed by an "attach" control line naming the `targetId` and `channel` (reusing `claimMonitor`'s existing ownership semantics), after which the broker stops treating that specific socket as JSON-line traffic and starts splicing raw bytes to/from a socket the **broker itself** dials directly to the emulator's binmon/text port (which the broker, unlike the client, can always reach — it launched the process). Give `ViceMonitorClient`/`TextMonitorClient` a new `attach(socket)` entry point so `stockConnect()`/`textConnect()` pass this relay socket into the unchanged parsing/framing code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Relay-connection dial + hello/attach handshake | Client (`stock-connect.ts`/`text-connect.ts`, extending the existing claim-then-dial sequence) | Broker (answers the handshake) | The client already owns "when to dial" (it decides when a tool needs a session); the broker only ever answers what it's asked |
| Byte-transparent splice (client-relay-socket ↔ emulator-socket) | Broker (host process, new logic in `vice-broker.mts`/`broker-control.mts`) | — | Only the broker's own machine can reach the emulator's bound port; this is the entire reason a relay exists rather than a translated host/container address |
| Socket-death detection (FIN/RST/idle) | Broker (host process) | — | Kernel-level socket events are only observable where the socket terminates; the broker is the peer that must react by reclaiming |
| Incident-record authorship on a mid-operation drop | Broker (host process) — a new, host-bound writer | — | The client is the thing that died; only the broker survives to write anything, and "before the instance is reclaimed" requires broker-side ordering the client cannot guarantee from beyond the grave |
| Session-identity capture and display | Client (declares an identity string at handshake time) | Broker (records it against the grant, serves it back via `status`) | The broker cannot know a human-meaningful project/session label on its own; the client is the only side that has one (`CLAUDE_CODE_SESSION_ID`, cwd, etc.) |
| `stock-protocol.ts` / `text-protocol.ts` frame parsing | Client (unchanged) | — | Owner decision 6 and the roadmap's own cross-cutting constraint both forbid touching this; only the socket SOURCE changes |

## Standard Stack

No new external packages. Everything Phase 63 needs is a Node built-in already in use elsewhere in this codebase:

| Module / API | Purpose | Already used at |
|---|---|---|
| `node:net` (`createServer`, `connect`, `Socket.pipe()`) | Both the client-side relay dial and the broker-side splice to the emulator | `broker-control.mts`, `stock-protocol.ts`, `text-protocol.ts` |
| `Socket.setKeepAlive(enable, initialDelayMs)` | SESS-04's bounded no-`FIN` detection (a candidate mechanism — see Finding 6 / Pitfall 3 for why this alone is insufficient) | Not used anywhere in `src/mcp/vice/` today [VERIFIED: exhaustive grep, zero hits, this session] |
| `Socket.setTimeout(ms)` | SESS-04's idle-timeout mechanism (fires on read+write inactivity, independent of OS keepalive defaults) | Not used anywhere in `src/mcp/vice/` today [VERIFIED: exhaustive grep, zero hits, this session] |
| `Socket.pipe()` / manual `"data"` forwarding | The byte-transparent splice itself | Not used anywhere in this tree yet — new consumer, stdlib only |

**Version verification:** N/A — no npm packages added. `engines.node` stays `>=24.0.0` [VERIFIED: `src/mcp/vice/package.json`, read this session, unchanged since Phase 62].

## Package Legitimacy Audit

**Not applicable.** This phase installs no external npm/PyPI/crates packages.

## Architecture Patterns

### System Architecture Diagram

```
CLIENT PROCESS (vice-proxy.ts, one long-lived MCP server)
  │
  │ EXISTING, UNCHANGED THIS PHASE:
  │   controlSession = openBrokerControl()  -- one persistent connection,
  │   acquire/release/recycle/status, still via broker.json (RM-02, Ph.66)
  │
  │ ensureStockSession(deps) -- THE CHOKE POINT (stock-dispatch.ts:294)
  │   1. deps.ensureLease() -- unchanged, returns HeldLease{host,port,targetId,...}
  │   2. stockConnect({host,port,targetId,brokerControl,deps})  <-- THIS is what changes
  │        old: claimMonitor() [control conn] -> client.connect(host,port) [RAW DIRECT DIAL]
  │        new: claimMonitor() [control conn] -> dial FIXED ENDPOINT, hello{tag:"monitor-binary"},
  │             attach{targetId, channel:"binary"} -> hand resulting socket to
  │             ViceMonitorClient.attach(socket)  [byte-identical framing from here on]
  │
  ▼
BROKER (one process, one machine, port 19510)
  │  hello dispatch (pre-token-gate, existing, Phase 62)
  │  attach dispatch (NEW): validates targetId+channel ownership
  │    (the SAME ownsTarget()-style check recycle/monitor_claim already use --
  │     never a bare target_id trust)
  │  -> broker dials 127.0.0.1:<emulator's own binmon port> ITSELF
  │     (the broker's own machine can always reach this; the client never could
  │     without the container/host translation this milestone removes)
  │  -> splices bytes: clientRelaySocket <-> emulatorSocket, both directions,
  │     BUFFER-MODE ONLY past the handshake boundary (never chunk.toString("utf8"))
  │  -> on EITHER socket's "close"/"error"/idle-timeout/no-FIN-within-bound:
  │       1. write an incident record (NEW, host-bound, machine-level --
  │          brokerIncidentsDir(), Finding 7) BEFORE step 2
  │       2. reclaim: extends handleRelease()'s EXISTING identity-verified-kill
  │          (Finding 2) -- this phase generalizes it, does not reinvent it
  ▼
EMULATOR (x64sc, launched by broker-launch.mts, untouched -- still argv-array
  spawn, still the frozen one-spawn-site invariant, still binds its own port
  wherever broker-launch.mts always put it)
```

### Recommended Project Structure

No new top-level directories. Likely new/edited files, all inside the existing `src/mcp/vice/` tree:

```
src/mcp/vice/
├── stock-connect.ts       # EDIT -- stockConnect() dials the relay instead of host:port directly
├── stock-protocol.ts      # EDIT -- ViceMonitorClient gains attach(socket), connect(host,port) stays for tests/fixtures
├── text-connect.ts        # EDIT -- textConnect() mirrors stockConnect()'s new dial
├── text-protocol.ts       # EDIT -- TextMonitorClient gains attach(socket); CR-01's line 850 sits in this same file (say so if touched)
├── broker-control.mts     # EDIT -- new "attach" op (or an extended monitor_claim), Buffer-mode handoff
├── vice-broker.mts        # EDIT -- the actual splice logic, dialing the emulator's own port broker-side
├── broker-home.mts        # EDIT (wire only) -- brokerIncidentsDir() gets its first real consumer
├── incident-record.ts     # POSSIBLE EXTEND -- a broker-minted `operation` field, or a parallel host-bound writer
└── resources/
    ├── broker-control.mjs # regenerated by `npm run build`
    └── vice-broker.mjs    # regenerated by `npm run build`
```

### Pattern 1: `ensureStockSession()` is the confirmed, but not the *only*, choke point

**What:** `stock-dispatch.ts:294`'s `ensureStockSession(deps)` is genuinely a single function every one of the dispatch table's handlers reaches through (confirmed: `stock-dispatch.ts:564` and `:646` are its only two call sites, both inside the shared error-converting adapters `withStockSession`-style wrappers used by every family module). This validates the roadmap's atomicity claim. **But** the actual line that must change for Phase 63 is one level *inside* that function's own call graph — `stockConnect()`'s `client.connect(host, port)` (`stock-connect.ts:430`) and `stockReconnect()`'s equivalent path — not `ensureStockSession()`'s own body, which the planner should leave untouched apart from possibly threading a new identity/tag value down through `StockConnectDeps`.

**Source (verified this session):**
```typescript
// stock-connect.ts:422-430
export async function stockConnect({ host, port, targetId, brokerControl, deps = {} }: StockConnectOptions): Promise<StockConnectSession> {
  const claimOutcome = await brokerControl.claimMonitor({ targetId, channel: "binary" });
  if (!claimOutcome.ok) { /* ... */ }
  const client = new ViceMonitorClient();
  // ...
  await client.connect(host, port);   // <-- THIS is today's direct dial to the EMULATOR
```

### Pattern 2: The close-is-release mechanism already exists and already kills the instance — extend it, don't reinvent it

**What:** `broker-control.mts:756-763`'s `socket.on("close", ...)` already calls `opts.onRelease(requestId)` for **any** connection close, including a client's own `SIGKILL` (the comment states this explicitly: `"connection close IS the release... including on the client's own SIGKILL, since close always fires either way"`). `vice-broker.mts:1117`'s `handleRelease()` already does an **identity-verified kill** of the instance (matches the grant's own recorded `pid` before killing, refusing to touch a mismatched occupant) — this is SESS-03's entire behavior, already built, for the **control connection**.

**The gap Phase 63 must close:** this mechanism protects the *control* connection's grant. The **relay connection** (new this phase) is a *second*, independent socket, and its death is not currently observed by anything. The correct move is not a parallel reimplementation — it's wiring the SAME `"close"`/`"error"` handling shape onto the new relay-connection acceptor, calling the same (or a sibling) reclaim path.

**Source (verified this session):**
```typescript
// broker-control.mts:756-765
socket.on("close", () => {
  // Connection close IS the release -- including on the client's own
  // SIGKILL, since "close" always fires either way. Idempotent...
  if (requestIdForThisConnection) {
    const id = requestIdForThisConnection;
    requestIdForThisConnection = null;
    opts.onRelease(id);
  }
});
```

### Pattern 3: `host-tool-client.ts` is the ALREADY-BUILT reference implementation for SESS-01's call shape

**What:** SESS-01 asks for "open, send, receive, close, no lease held." This exact shape already exists, has already shipped, and is already tested — it just isn't for `vice_*` tools:

**Source (verified this session, header comment quoted in full since it states the contract precisely):**
```typescript
// host-tool-client.ts:3-11
// Phase 34, plan 34-01 (SEAM-01..SEAM-03, tracer): the CONTAINER-side half of
// the host-tool execution seam. Mirrors vice-broker-client.ts's
// acquireOverControlPlane() shape exactly: read broker.json ONCE, resolve the
// dial target, open ONE connection, write ONE JSON line, await ONE response
// line, then close -- session-less and short-lived, no lease held. That is
// SEAM-01's "consumes no emulator lease" satisfied by construction: this
// module never writes an `acquire` line, never holds a socket open past one
// request/response pair, and the broker's own host_tool dispatch branch
// (broker-control.mts) never calls any of the seven VICE callbacks for it.
```
**When to use:** this is the pattern to point at when a plan needs to *demonstrate* (not build from scratch) what "no lease held" looks like in this codebase's own idiom. It also demonstrates the exact `hello`-free, single-line-request-response shape a **file-transfer** connection (Phase 64) or a stateless `anno` call (folded todo, Phase 65) would extend. It still reads `broker.json`, not the fixed endpoint — migrating it to `broker-endpoint.ts`'s dial is `SEAM-02`'s job (Phase 65), not this phase's.

### Pattern 4: Buffer-mode is mandatory the instant a socket carries anything but JSON lines

**What:** `attachControlProtocol()`'s existing `"data"` handler decodes every incoming chunk with `chunk.toString("utf8")` before ever looking at it (`broker-control.mts`, inside `attachControlProtocol()`). This is safe today because every one of the 9 existing ops is JSON text. The relay connection's post-handshake payload is raw binmon bytes — not guaranteed valid UTF-8, and a UTF-8 decode/re-encode round trip is **lossy** for arbitrary binary data (an invalid byte sequence gets replaced with U+FFFD on decode, which cannot be reconstructed on re-encode). **Any leftover bytes buffered past the handshake's trailing `\n` in the same read must never pass through the existing string-mode `"data"` handler at all** — they belong to the emulator's protocol, and must be captured and forwarded as a raw `Buffer`, never round-tripped through a JS string.

**How to use:** design the attach/hello exchange so the tagged relay connection's FIRST bytes are guaranteed ASCII JSON terminated by exactly one `\n`, parse ONLY that first line using a Buffer-aware `indexOf(0x0a)` search (not the existing string-accumulator), then immediately detach any further parsing and start raw-forwarding everything from that point on, including any bytes that arrived in the same TCP segment past the first `\n`.

**Warning signs:** a test that only ever sends the handshake JSON and the first binmon frame in *separate* `socket.write()` calls will never catch this — TCP makes no such guarantee, and a corruption bug here is exactly the kind that only manifests under real network timing. A planned unit test MUST include a case where the handshake line and the first bytes of a binmon frame arrive in the SAME `write()`/`"data"` event.

### Anti-Patterns to Avoid

- **Reusing the control connection's own `pendingAcquires` FIFO-by-arrival-order dispatch for the relay connection.** The roadmap's own cross-cutting constraint is explicit: VICE sends 5 unsolicited message types at request-id `0xffffffff`, two of which share a response type with a legitimate reply. `vice-broker-client.ts`'s own `createSession()` (the client-side control-plane reader) *already* uses a FIFO `pending.shift()` for the CONTROL protocol and documents why that's safe there (every control-plane request is awaited to completion before the next is sent, so responses can never arrive out of order) — see the comment at `vice-broker-client.ts` above `interface PendingLineEntry`. That reasoning **does not transfer** to binmon traffic, which is exactly why `stock-protocol.ts` has its own request-id-keyed demux (per CLAUDE.md's protocol notes) rather than reusing this FIFO idiom. **Do not let the relay layer reintroduce a FIFO assumption on binmon bytes** — the relay must be byte-transparent (Success Criterion 1), meaning `stock-protocol.ts`'s own existing demux is what runs, unchanged, on the client side of the relay; the relay itself must not attempt to interpret or reorder binmon frames at all.
- **Killing/relaunching the emulator to serve a newer request.** CLAUDE.md's own architecture constraint ("Do not kill or relaunch the emulator to serve a newer request. Write the incident record first.") applies directly to SESS-05's ordering requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Connection-close-triggers-cleanup | A new `"close"` listener with its own reclaim logic | Extend `attachControlProtocol()`'s existing `socket.on("close", () => opts.onRelease(...))` shape (Pattern 2) | Already handles the `SIGKILL` case correctly and is already regression-tested; a parallel mechanism risks the two drifting on what counts as "released" |
| Per-instance kill safety | A blind `process.kill(pid)` on reclaim | `verifiedKill()` / `handleRelease()`'s pid-match-before-kill discipline (`vice-broker.mts:1117`) | Prevents killing an unrelated process that happens to now occupy a recycled port |
| Atomic incident-record write | A plain `writeFileSync` | `incident-record.ts`'s existing `writeAtomic()` (tmp file, mode 0600, then rename) | Already solves the "briefly world-readable" and "half-written record" hazards; a second ad hoc writer would need to re-solve both |
| Idle/dead-peer detection | A hand-rolled ping/pong heartbeat protocol | `Socket.setTimeout(ms)` (fires on read+write inactivity) combined with `Socket.setKeepAlive(true, ms)` (Finding 6) | Both are kernel/stdlib-backed; VICE's own binmon protocol has no idle-heartbeat concept to reuse, and inventing an application-level ping is exactly the kind of second-mechanism duplication this project's "one mechanism per seam" convention warns against |

**Key insight:** every low-level primitive this phase needs (socket-close reclaim, pid-verified kill, atomic file write, injectable clock) already exists in this codebase in a directly reusable form. The genuinely new work is (a) the relay/splice mechanism itself — Node has no built-in "socket A ↔ socket B" library beyond `.pipe()`, which the planner should use directly rather than hand-rolling a copy loop — and (b) the identity/tag plumbing for SESS-06, which has no existing analog beyond the unused `hello` tag echo.

## Common Pitfalls

### Pitfall 1: Assuming the control connection's release IS the fix for SESS-03/04

**What goes wrong:** A planner reads "connection close IS the release" (already true, Pattern 2) and concludes SESS-03/04 are already satisfied, shipping no new code.
**Why it happens:** The existing mechanism genuinely does satisfy SESS-03 for the *control* connection today. But the control connection's death and the *relay* connection's death are two different sockets once this phase's relay connection exists, and nothing currently links them — a `SIGKILL`ed client kills BOTH sockets simultaneously (same process, same moment) so this may not surface in casual testing, but a client that leaks/orphans only its relay socket (e.g., a bug, or a deliberate half-close) would not be caught by the control connection's own close handler.
**How to avoid:** wire the SAME close-triggers-reclaim discipline onto the relay connection's own acceptor, independently of the control connection's.
**Warning signs:** a test that only ever kills the whole client process (which closes every fd at once) never exercises the relay-connection-only-dies case.

### Pitfall 2: The `hello` op's `tag` field is currently a no-op beyond an echo

**What goes wrong:** A planner assumes the `tag` field already does something server-side (routing, identity persistence) because Phase 62's own design notes call it "open-ended" and "Phase 63 adds the long-lived monitor-relay tag."
**Why it happens:** The phrasing sounds like the mechanism is ready; the code shows it is only an echo.
**How to avoid:** confirm before planning around it — `broker-control.mts`'s `hello` dispatch (verified this session) does exactly: `const tag = typeof req.tag === "string" && req.tag !== "" ? req.tag : "control"; writeLine(socket, {kind:"hello", ..., tag});` and nothing else. No state is stored, no routing occurs. Phase 63 must add BOTH the tag's meaning (what happens differently for `"monitor-binary"` vs `"control"`) and the follow-on attach protocol.
**Warning signs:** a plan that treats "add the monitor-relay tag" as a one-line change.

### Pitfall 3: TCP keepalive alone does not satisfy SESS-04's "bounded time"

**What goes wrong:** A planner enables `socket.setKeepAlive(true, ms)` and considers SESS-04 done.
**Why it happens:** Keepalive sounds like exactly the right primitive, and Node's API surface makes it look complete.
**How to avoid:** understand what each does. `setKeepAlive(true, initialDelayMs)` only sets the *delay before the first probe*; **the actual retry count and interval between probes remain governed by OS-level sysctls** (`tcp_keepalive_time`/`tcp_keepalive_intvl`/`tcp_keepalive_probes` on Linux — CLAUDE.md's own architecture notes cite the ~7200s Linux default for the base timer, and Node's `initialDelayMs` argument only overrides that base timer, not the per-probe interval or probe count, which stay at their OS defaults unless separately tuned outside Node's API surface entirely). A broker cannot itself change the client machine's kernel sysctls. **`socket.setTimeout(ms)`** is the mechanism that is fully broker-controlled and needs no cooperation from the OS or the peer: it fires when NO data has been read or written for `ms` milliseconds, entirely in userspace, and is what actually delivers a bounded, broker-owned deadline. **Use `setTimeout()` for SESS-04's bound; treat `setKeepAlive()` as a secondary, best-effort signal, not the mechanism the requirement is actually satisfied by.**
**Warning signs:** a plan or test that asserts SESS-04 by only calling `setKeepAlive()` and waiting — on Linux this will not fire within any reasonable test bound without also tuning `/proc/sys/net/ipv4/tcp_keepalive_time`, which a test cannot portably do.

### Pitfall 4: FIFO-by-arrival-order response matching on the relay connection

**What goes wrong:** A planner copies `vice-broker-client.ts`'s existing `createSession()` FIFO-dispatch pattern (`pending.shift()` on every response line) onto the NEW attach/relay handshake, reasoning "it's the same JSON-line shape as `hello`."
**Why it happens:** The attach handshake genuinely IS JSON-line shaped, so the existing control-plane reader pattern looks directly reusable.
**How to avoid:** the attach handshake itself (one request, one response, before the mode switch) is fine to build this way — but once the socket switches to raw binmon-byte relay mode, **stock-protocol.ts's own existing request-id-keyed demux must be what interprets the bytes**, not a second, arrival-order-based interpretation layer at the relay. The relay's job past the handshake is to move bytes, not parse frames.
**Warning signs:** any relay-side code that inspects opcode/request-id bytes inside a binmon frame — that is `stock-protocol.ts`'s job and reintroducing it at the relay layer is exactly the "the exact defect class stock-protocol.ts already solves" the roadmap warns against.

### Pitfall 5: Editing `broker-control.mts`/`vice-broker.mts` (`.mts`, host-bound) without regenerating `resources/*.mjs`

**What goes wrong:** A plan edits the `.mts` source, tests pass locally (they import the `.mts` source directly in most cases), but `resources-sync.test.ts` fails CI because the committed `resources/*.mjs` file has drifted from a fresh `npm run build` output.
**Why it happens:** `build.ts`'s `HOST_BOUND_ARTIFACTS` array (confirmed this session: 11 entries, includes `broker-control.mjs`, `vice-broker.mjs`, `broker-home.mjs`) requires every edit to a listed `.mts` source to ship its regenerated `.mjs` twin in the SAME commit.
**How to avoid:** run `npm run build` (or the project's documented build step) and commit the regenerated `resources/*.mjs` alongside every `.mts` edit. If Phase 63 introduces a genuinely NEW host-bound `.mts` module (plausible if the splice logic is factored into its own file), it must be added to `HOST_BOUND_ARTIFACTS` in the same change.
**Warning signs:** a green local `node --test broker-control.test.ts` but a red `resources-sync.test.ts` — that specific combination is this exact drift, not a flaky test.

### Pitfall 6: New tests landing in a `MANUAL_ONLY_TESTS` file are invisible to CI

**What goes wrong:** A plan adds relay-lifecycle assertions to `vice-proxy.test.ts` or `broker-e2e.test.ts` (both currently in `test-gate.mjs`'s frozen 12-member `MANUAL_ONLY_TESTS` array, confirmed unchanged since Phase 62), and CI's `npm run test:automated` (this project's configured `test_command`) silently never runs them.
**Why it happens:** These are the files with the most existing end-to-end broker/proxy fixture machinery, so they're the path of least resistance to extend.
**How to avoid:** put the new synthetic loopback-socket lifecycle tests (abrupt/graceful/idle, per the roadmap's own testing note) in a **new, automated-by-default** test file (e.g. `stock-connect-relay.test.ts`, `broker-relay.test.ts`) — none of `broker-endpoint.test.ts`, `broker-home.test.ts`, `broker-control.test.ts` (Phase 62's own new/edited test files) are on the manual-only list, confirming this is exactly where new synthetic-socket coverage belongs.
**Warning signs:** a verification step that runs `npm run test:automated` and calls it sufficient when the new assertions actually live in a manual-only file.

### Pitfall 7: Assuming the text channel and the binary channel can share one reconnect/reclaim policy

**What goes wrong:** A planner designs one uniform "on relay-connection death, do X" policy for both channels.
**Why it happens:** `stock-connect.ts` and `text-connect.ts` are architecturally near-identical (claim-then-dial), inviting a single shared implementation.
**How to avoid:** `text-connect.ts`'s own header comment is explicit and deliberate: *"Never build a `textReconnect()`. ... an unexpected text-socket close is treated as FATAL for the session, not something to silently reconnect."* The binary channel, by contrast, has a full `stockReconnect()` with machine-identity re-proof. Any Phase 63 relay-death policy must preserve this asymmetry: a dead binary-relay connection may legitimately attempt a controlled reconnect-with-identity-check; a dead text-relay connection must fail the session outright.
**Warning signs:** a single `handleRelayDeath(channel)` function with no `channel`-conditional branch for this exact asymmetry.

## Code Examples

### Existing FIFO-safe control-plane reader (client side) — the pattern to NOT extend to binmon bytes

```typescript
// Source: src/mcp/vice/vice-broker-client.ts, createSession() (verified this session)
// FIFO order is sound here because every session method awaits its own
// sendAndAwaitLine() call to settle before this client ever writes a second
// request line -- responses can therefore never arrive out of the order
// their requests were sent in...
socket.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf8");   // <-- STRING mode: fine for JSON-only traffic
  let newlineIdx: number;
  while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    if (line.trim() === "") continue;
    const entry = pending.shift();
    if (!entry) continue;
    // ...
  }
});
```

### Existing session-identity precedent, client-side only, never sent to the broker

```typescript
// Source: src/mcp/vice/stock-recycle.ts:496,511 (verified this session)
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
// ...
recordPath = writeIncidentRecord({
  at, port: lease.port, epoch_before: epochBefore, reason,
  session_id: sessionId,   // <-- written to a LOCAL, per-project file only.
  evidence,                //     Never transmitted to the broker today.
});
```

### `broker-home.mts`'s already-built, unwired machine-level incidents resolver

```typescript
// Source: src/mcp/vice/broker-home.mts:127-132 (verified this session)
/** The broker's incident-record directory. `VICE_INCIDENTS_DIR` wins first,
 * else an `incidents` subdirectory of the machine-level root. */
export function brokerIncidentsDir(opts: BrokerHomeOptions = {}): string {
  const env = resolveEnv(opts);
  if (env.VICE_INCIDENTS_DIR) return resolve(env.VICE_INCIDENTS_DIR);
  return join(brokerHome(opts), "incidents");
}
```
No production module calls this function yet [VERIFIED: exhaustive grep, this session — only `broker-home.mts` itself and its own test file reference it].

### `StatusInstanceEntry`'s current, identity-free shape

```typescript
// Source: src/mcp/vice/broker-control.mts:159-172 (verified this session)
export interface StatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
  hasMonitorClient: boolean;
}
```
No `grantId`, `pid`, `tag`, `sessionId`, or any caller-declared label exists on this shape today — SESS-06 requires adding one.

## State of the Art

| Old Approach | Current/Needed Approach | When Changed | Impact |
|---|---|---|---|
| `stockConnect()`/`textConnect()` dial the emulator's own port directly, after a bookkeeping-only `claimMonitor()` call over the control connection | Dial the broker's fixed endpoint, complete a `hello`+attach handshake, hand the resulting connection to `ViceMonitorClient.attach()`/`TextMonitorClient.attach()` | This phase | Removes the client's need for ANY network path to the emulator itself — only the fixed broker endpoint needs to be reachable, which is the milestone's core hypothesis |
| `broker-endpoint.ts`'s `dialBrokerEndpoint()` exists but has zero production callers | Becomes load-bearing: at minimum the new relay-connection dial uses it; whether `vice-proxy.ts`'s own control connection also migrates onto it is an open question this research flags below (Open Question 1) | This phase (partially) / Phase 65 (fully, per SEAM-01) | Determines whether Phase 63 leaves TWO parallel dial mechanisms (old broker.json path for control, new fixed-endpoint path for relay) for one more phase, or unifies them early |
| `hello`'s `tag` field is echoed, unused | Becomes the discriminator between a plain identification dial and a monitor-relay attach | This phase | The single piece of Phase 62 surface this phase is explicitly designed to consume |

**Deprecated/outdated:** none yet — Phase 63 does not delete anything (deletions are `RM-*`, Phases 65-67).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The relay connection should be a SEPARATE physical TCP connection per claimed `(targetId, channel)` pair, dialled via `hello`+attach, rather than multiplexing binmon bytes onto the EXISTING control connection with a length-prefix wrapper | Architecture Patterns, Primary recommendation | Medium — this is a design synthesis from Decision 6's wording ("multiple tagged connections," explicitly rejecting "the single-physical-socket multiplexed alternative"), not a value read from a locked CONTEXT.md decision for THIS phase specifically. If the planner disagrees, Decision 6 is the binding constraint to satisfy either way; the exact op names (`hello`, `attach`) are this research's own naming suggestion, not settled. |
| A2 | `ViceMonitorClient`/`TextMonitorClient` need a genuinely NEW `attach(socket)` entry point (rather than some existing but unnoticed injection seam) | Summary, Pattern 1 | Low — verified by reading both classes' `connect()` methods in full this session; both unconditionally call `net.createConnection()` internally with no socket-injection parameter anywhere in either file. |
| A3 | `vice-proxy.ts`'s own control connection (acquire/release/recycle/status) stays on the OLD `openBrokerControl()`/`broker.json` path for this phase, and only the NEW relay connection(s) use the fixed endpoint | Summary, State of the Art | Medium — the roadmap's convergence-metric note ("expected 5... `vice-proxy.ts` [keeps importing legacy things] until Phase 66") is consistent with this reading but does not say so explicitly for the control connection specifically. If wrong, and the planner is expected to cut `vice-proxy.ts`'s control connection over to `dialBrokerEndpoint()` THIS phase too, that is materially more surface than this research scopes — flagged as Open Question 1. |
| A4 | The broker should dial the emulator's binmon/text port itself using a plain, unauthenticated local `net.connect()` (the broker's own machine can always reach `127.0.0.1:<port>` since it launched the process there) | Architecture Patterns | Low — `broker-launch.mts` already launches `x64sc` with `-binarymonitoraddress`/`-remotemonitor` bound to an address the broker's own host resolves; the broker dialling its own launch target needs no new capability, only new code that does so. |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does Phase 63 also cut `vice-proxy.ts`'s own control connection over to `dialBrokerEndpoint()` (the fixed endpoint), or does the control connection stay on the legacy `broker.json` path until Phase 65's `SEAM-01`?**
   - What we know: `dialBrokerEndpoint()` (Phase 62) has zero production callers today. The roadmap's Phase 63 goal talks specifically about the monitor/binmon *channel*, and its convergence-metric note only tracks `hostpath.ts`/`containerpath.ts`/`stock-paths.ts` importers — `vice-broker-client.ts`'s `openBrokerControl()` (the `broker.json` reader) is not itself one of the six tracked importers.
   - What's unclear: whether leaving TWO separate dial mechanisms live for one more phase (fixed-endpoint for the relay, `broker.json` for control) is the intended incremental shape, or whether it creates an awkward seam SEAM-01 then has to unwind.
   - Recommendation: the narrower reading (leave control connection alone, only the relay is new) is smaller, more atomic, and matches "ATOMIC at the seam level" better — recommend the planner adopt A3 explicitly and record it as a plan-level decision rather than silently picking one.

2. **What exact string(s) identify a session for SESS-06, and where does the value come from?**
   - What we know: `CLAUDE_CODE_SESSION_ID` is the one existing precedent for "a value that names which agent session this is," but it's Claude-Code-specific — a skill script invoked by a different tool, or a bare `curl`-style test client, would have none. A cwd-derived project name is universally available but less precise (two Claude sessions in the same repo would collide).
   - What's unclear: whether SESS-06 wants ONE mandatory identity string, an optional one with a sensible fallback (e.g., pid + cwd basename), or a user-settable label.
   - Recommendation: default to `CLAUDE_CODE_SESSION_ID` when present, falling back to `${cwd basename}-${pid}` when absent — cheap, always available, and matches the existing incident-record precedent's own choice of value.

3. **Does the incident-before-reclaim record for SESS-05 reuse `incident-record.ts`'s existing renderer, or does the broker need its own, host-bound writer?**
   - What we know: `incident-record.ts` is a plain `.ts` module with no host/container-specific dependency in its own body (only `node:fs`/`node:crypto`/`node:path` and `repo-root.ts`'s `toolsDir()` for the default path) — but `toolsDir()` itself resolves a PER-PROJECT path, wrong for a machine-level broker. `broker-home.mts` already has the right PATH resolver (`brokerIncidentsDir()`) but is `.mts` (host-bound, compiled) and cannot import a container-side `.ts` module (mirrors the exact constraint `broker-home.mts`'s own header comment states for why it can't import `repo-root.ts`).
   - What's unclear: whether the renderer logic (`renderIncidentRecord()`, `writeAtomic()`) gets extracted into something host-importable, duplicated in a host-bound sibling, or whether the broker writes a simpler, distinct incident shape entirely for this phase.
   - Recommendation: since `incident-record.ts` has zero `.mts`-incompatible dependencies in its OWN logic (only its *default path* is container-oriented), the cleanest fix is threading `incidentsDir` as an explicit parameter (mirroring `writeIncidentRecord`'s existing options-object convention) rather than duplicating the renderer — but this changes an existing module's call sites (`stock-recycle.ts`) too, which the planner should weigh against a small, purpose-built host-side writer instead.

4. **Is "the operation that was in flight" (SESS-05) derivable from existing state, or does it require new bookkeeping?**
   - What we know: `channel-lock.ts`'s `ChannelLockHolder` already tracks "who holds the halt authority, since when, doing what" for the cross-channel mutex (its own header comment: "makes contention readable to `vice_diagnose`... rather than a bare 'something is locked'"). This looks like a directly reusable source for "what operation was in flight."
   - What's unclear: whether `channel-lock.ts`'s holder record is visible/reachable from the BROKER side at all (it's a container-side, `.ts` module per-process state, not broker state) — the broker cannot read the client's own in-process lock holder.
   - Recommendation: the "operation that was in flight" most likely has to be reported TO the broker as part of the relay protocol itself (e.g., the client tags the relay connection with a coarse operation label whenever it starts a multi-step sequence), since the broker has no other way to observe it. This needs a plan-level design decision, not an assumption.

## Environment Availability

This phase depends only on infrastructure already verified present or already gated by prior phases:

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| A running v2.0.0 broker (Phase 62 output) | Every SESS-* requirement | ✓ (built, not yet the live default) | this repo's HEAD | N/A — this phase's own work IS extending that broker |
| `x64sc` (stock VICE) | The emulator the relay ultimately proxies to | ✓ [per user's standing memory note: `/usr/bin/x64sc` is genuine unpatched stock] | 3.9 (per CLAUDE.md) | N/A |
| Node >= 24 | `net.Socket.setTimeout`/`setKeepAlive`, all stdlib, no new floor | ✓ | project floor unchanged | N/A |

No missing dependencies identified for this phase.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node:test`), no third-party runner [VERIFIED: `src/mcp/vice/package.json`, unchanged since Phase 62] |
| Config file | None — `test-gate.mjs` is the automated-suite selector |
| Quick run command | `node --test <new-or-edited-file>.test.ts` (this project's colocated-test convention) |
| Full suite command | `npm test` (`node --test '*.test.*'`) — per user's standing memory, measured green twice, no longer hangs |

**Critical gate-composition fact carried forward from Phase 62 (still true, re-verified this session):** `npm run test:automated` (`test_command` in `.planning/config.json`) excludes the 12-member `MANUAL_ONLY_TESTS` array, which still includes `vice-proxy.test.ts` and `broker-e2e.test.ts`. **New relay-lifecycle tests MUST land in a file NOT on that list** (see Pitfall 6) or CI's configured `test_command` will never see them.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SESS-01 | A stateless host-tool-style call binds no lease, holds no session | unit/structural | Extend `host-tool.test.ts`/`host-tool-transport.test.ts` if `vice_*` needs an analogous stateless path, or a structural assertion that no `vice_*` dispatch handler ever calls `host_tool`'s connection pattern | ✅ files exist, likely no new case needed if SESS-01 is confirmation-only |
| SESS-02 | MCP-server connection lifetime == emulator-hold lifetime, observable in `status` | integration (real spawned broker, `VICE_BROKER_CONTROL_PORT: "0"`) | New cases in `broker-e2e.test.ts` (⚠ manual-only, per Pitfall 6 — mirror the assertions into a NEW automated file too) | ❌ Wave 0 |
| SESS-03 | `socket.destroy()` (abrupt) on the relay connection reclaims the instance | integration, synthetic loopback, no live VICE needed | New file, e.g. `broker-relay.test.ts` | ❌ Wave 0 |
| SESS-04 | No-`FIN` idle death detected within a bounded, injected-clock time | integration, synthetic loopback, injected `now()`/timer per this project's own `stock-checkpoints.ts:298/384` convention | Same new file, injectable timeout | ❌ Wave 0 |
| SESS-05 | Incident record exists BEFORE reclaim, names the in-flight op | integration | Same new file; assert file-write ordering relative to the kill call (mirrors `stock-recycle.ts`'s own "evidence, then record, then RPC — in that order" test discipline) | ❌ Wave 0 |
| SESS-06 | `status` output lets a user identify their own session | unit | Extend `broker-control.test.ts`'s `status` cases | ❌ Wave 0 (new field) |

### Sampling Rate
- **Per task commit:** the single edited/new test file via `node --test <file>` directly.
- **Per wave merge:** `npm test` (full glob) — per user's own standing memory this no longer hangs.
- **Phase gate:** `npm test` green is required before `/gsd-verify-work`; additionally, explicitly confirm the new lifecycle tests are NOT in a `MANUAL_ONLY_TESTS` file, since `npm run test:automated` (this project's `test_command`) is what CI actually runs.

### Wave 0 Gaps
- [ ] A new automated test file for the synthetic client/server relay-lifecycle matrix (abrupt/graceful/idle × binary/text channel), styled after `stock-run-until.ts`'s own single-resume-per-wait synthetic-client precedent and this project's established `now?: () => number` injection convention (`stock-checkpoints.ts:298,384`).
- [ ] New `attach`-op cases in `broker-control.test.ts`.
- [ ] New `status`-field cases (SESS-06) in `broker-control.test.ts`.
- [ ] Framework install: none — `node:test` is already fully wired.

### What can only be proven against a live emulator vs. a synthetic pair
- **Synthetic loopback pair suffices for:** all of SESS-01..06's core lifecycle assertions (connection death detection, reclaim ordering, incident-write ordering, status field presence) — none of these depend on VICE's actual binmon semantics, only on TCP socket behavior, which a hand-written stub server reproduces exactly (this is the roadmap's own explicit instruction).
- **Only provable against real, live `x64sc`:** true byte-transparency end-to-end (Success Criterion 1) — that a REAL register read, memory write, checkpoint hit, and `JAM` still parse correctly after being relayed, since `stock-protocol.ts`'s parser needs genuine wire bytes to exercise. This is exactly the kind of case this project's `MANUAL_ONLY_TESTS`/live-test convention exists for (e.g. `stock-live-broker-monitor.test.ts`'s existing shape, default-SKIP, opt-in via an env var) — a NEW live test in this family, gated the same way, is the right home for Criterion 1's full verification.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No (by design, per settled decision 5 — reaffirmed, not re-opened here) | Bind narrowing (already Phase 62's job) is the control, not a credential |
| V3 Session Management | Yes | This IS this phase's subject: "the connection is the session" — the standard control is the existing close-triggers-release mechanism (Pattern 2), extended, plus the new bounded-idle-timeout (SESS-04) |
| V4 Access Control | Yes | Per-operation ownership checks: the roadmap's own cross-cutting constraint ("Ownership is checked per operation, never by bare target id") maps directly onto `broker-control.mts`'s existing `ownsTarget()` predicate (verified this session, guards `monitor_claim`/`monitor_release`/`recycle` today) — the new `attach` op must be gated the SAME way, never trusting a caller-supplied `targetId` alone |
| V5 Input Validation | Yes | The relay handshake's JSON line (`hello`+`attach`) must follow the SAME never-throw parse discipline already used everywhere else in this file; an unrecognized `channel` or malformed `targetId` must be refused by name, not defaulted silently |
| V6 Cryptography | No | No new credential, no signature; the existing `timingSafeEqual` token comparison is untouched and irrelevant to the NEW `hello`-descended path (which is, by design, unauthenticated at the network layer, per D-06) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A connection dials `hello` with `tag: "monitor-binary"`, then attempts to `attach` to a `targetId` it never legitimately `claimMonitor()`'d | Elevation of Privilege | Reuse the EXISTING `ownsTarget()` check (`broker-control.mts`) — a connection may only attach to the grant it itself holds, mirroring the recycle-ownership rule the same file already enforces |
| A slow-loris-style relay connection that completes `hello`/`attach` but never sends or receives another byte, tying up the emulator's single-client binmon slot indefinitely | Denial of Service | SESS-04's own bounded idle-timeout (`socket.setTimeout()`) is the direct mitigation — this is not only a UX nicety, it is the DoS control for the single-binmon-client concurrency rule CLAUDE.md already names as a standing risk |
| A malformed or oversized frame injected mid-relay by a compromised or buggy client, exploiting the fact that the broker no longer inspects binmon bytes at all (it only splices) | Tampering | Out of scope for the broker to detect (byte-transparency is the whole point — Success Criterion 1 explicitly forbids the broker parsing binmon content); `stock-protocol.ts`'s OWN existing frame validation on the client side is the only defense, unchanged by this phase |
| Two connections racing to `attach` to the SAME `(targetId, channel)` pair concurrently | Race Condition / DoS | Mirror `monitor_claim`'s EXISTING single-holder-per-channel enforcement (`InstanceRecord.monitorClients`, keyed by `MonitorChannel`) — the attach op should be gated by the SAME structure, not a new one |

## Sources

### Primary (HIGH confidence — read against HEAD this session)
- `src/mcp/vice/stock-dispatch.ts` — `ensureStockSession()` read in full, both call sites confirmed
- `src/mcp/vice/stock-connect.ts` — `stockConnect()` read in full, the direct-dial call site confirmed
- `src/mcp/vice/text-connect.ts` — read in full (157 lines), the parallel direct-dial confirmed, the no-textReconnect() design note quoted
- `src/mcp/vice/stock-protocol.ts` — `ViceMonitorClient.connect()` internals confirmed (`net.createConnection`, `Buffer.concat` accumulation, no socket-injection seam)
- `src/mcp/vice/text-protocol.ts` — `TextMonitorClient.connect()`/`command()` read around lines 750-905, CR-01's exact line (850) confirmed
- `src/mcp/vice/broker-control.mts` — header, `ControlRequestKind`, `hello` dispatch, `attachControlProtocol()`'s close handler, `StatusInstanceEntry`, `MonitorClaimOutcome`/`MonitorReleaseOutcome`, `ownsTarget()` all read this session
- `src/mcp/vice/vice-broker.mts` — `handleRelease()` read in full (identity-verified kill on release)
- `src/mcp/vice/vice-broker-client.ts` — `HeldLease`, `createSession()`'s FIFO reader, `ClaimMonitorOptions`/`MonitorClaimChannel` all read this session
- `src/mcp/vice/vice-proxy.ts` — `buildHeldLease()`, `ensureBrokerLease()` read this session, confirming `host` derives from `activeInstance().url` (the already-containerized loopback rewrite)
- `src/mcp/vice/broker-endpoint.ts` — read in full header + first 180 lines; confirmed zero production callers via exhaustive grep this session
- `src/mcp/vice/broker-home.mts` — read in full (169 lines); `brokerIncidentsDir()`/`brokerStagingDir()`/`brokerRunsDir()` confirmed unwired
- `src/mcp/vice/incident-record.ts` — read in full (453 lines); `stock-recycle.ts`'s `CLAUDE_CODE_SESSION_ID` usage confirmed client-only
- `src/mcp/vice/host-tool-client.ts` — header read in full, confirming the SESS-01 reference implementation
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS` (11 entries) confirmed
- `src/mcp/vice/test-gate.mjs` — `MANUAL_ONLY_TESTS` (12 entries) confirmed unchanged since Phase 62
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §§ Phase 62/63/64/66, `.planning/STATE.md` §§ Current Position/Session Continuity, `.planning/config.json`
- `.planning/phases/62-.../62-CONTEXT.md`, `62-RESEARCH.md`, `62-0{1..5}-SUMMARY.md` — all read this session for what Phase 62 actually shipped vs. planned

### Secondary (MEDIUM confidence)
- Node `net.Socket.setKeepAlive`/`setTimeout` semantics and Linux `tcp_keepalive_time` defaults: [ASSUMED from training knowledge, cross-checked against CLAUDE.md's own already-recorded ~7200s figure] — not independently re-measured this session on this host; the CLAUDE.md figure is treated as the project's own prior verified claim, not re-verified here.

### Tertiary (LOW confidence)
- None beyond what's flagged `[ASSUMED]` inline above.

## Metadata

**Confidence breakdown:**
- Current direct-dial architecture (Finding set 1): HIGH — every citation re-read against HEAD this session, both `stockConnect()`/`textConnect()` fully read.
- Phase 62 leftover surface (`broker-endpoint.ts`, `broker-home.mts`): HIGH — read in full, callers confirmed via exhaustive grep.
- Relay wire-mechanics design (the `hello`/`attach` two-step, Buffer-mode handoff): MEDIUM — a design synthesis consistent with Decision 6 and the byte-transparency constraint, but not itself a value copied from a locked decision; flagged via Assumption A1.
- SESS-04's keepalive-vs-timeout distinction: MEDIUM — standard Node/Linux networking knowledge, not independently re-measured against this specific host's sysctls this session (cross-checked against CLAUDE.md's own already-recorded figure instead).

**Research date:** 2026-09-19
**Valid until:** 30 days (stable Node stdlib APIs; Phase 62's leftover surface is the fastest-moving risk — re-verify `broker-endpoint.ts`'s caller count and `broker-home.mts`'s wiring status if planning is delayed, since either could gain a consumer from unrelated work in the interim)

## RESEARCH COMPLETE
