# Stack Research

**Domain:** Redesign of an existing Node/TypeScript MCP plugin's transport and deployment model — one manually-started, machine-wide broker daemon reached over a single fixed TCP endpoint, replacing on-disk discovery and per-project spawn.
**Researched:** 2026-09-19
**Confidence:** HIGH for the container-networking facts (official docs cited per claim); MEDIUM for the two Podman/rootless nuances flagged below (community-sourced, no primary-doc quote found); HIGH for the framing/multiplexing/lifecycle recommendations (derived directly from this codebase's own committed code and documented constraints).

## Recommended Stack

### Core Technologies

No new core technology. This redesign is additive protocol/ops work on top of the stack that already exists and is explicitly settled (Node ≥ 24, `node:net`, `@mastra/mcp` 1.15.0, `@mastra/core` 1.55.0). The only "core" additions are two new **conventions**, not packages:

| Addition | Purpose | Why Recommended |
|----------|---------|-----------------|
| Fixed-port dial-order discovery (candidate list, first successful handshake wins) | Replaces `broker.json` | Requires no new dependency — `node:net`'s `connect()` already used in `vice-broker-client.ts` tries candidates sequentially; this is a loop change, not a library |
| Hybrid framing: newline-delimited JSON header + declared-length raw byte body on the same socket | Carries both control ops and file bytes on one connection | Extends the existing newline-JSON convention (`broker-control.mts`) rather than replacing it; no new dependency |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:net` | built-in (Node ≥ 24) | TCP client and server for the one fixed-port broker socket | Already the sole transport for the existing control plane (`broker-control.mts`, `vice-broker-client.ts`) — reuse the same primitive for the redesigned socket, do not introduce a second transport library |
| `node:fs` / `node:fs/promises` | built-in | Reading a local file to stream out, writing received bytes under `.c64-re-tools/<kind>/` | Both directions of "files travel as bytes" resolve to a local read or a local write; no streaming library needed at the stated file-size ceiling (~20MB) |
| `node:crypto` (`randomBytes`, `timingSafeEqual`) | built-in | Per-boot capability token, constant-time comparison | Already used in `broker-control.mts`; unchanged by this redesign |

No new npm runtime dependency is warranted for anything in this milestone. See "What NOT to Use" below for the specific libraries that will look tempting and should be rejected, with reasons.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | Exercise the new framer and dial-order logic | Same posture as today: a synthetic `net.Socket`/`net.Server` pair, no mocking library, colocated `*.test.ts` |
| systemd user-unit template (committed, not auto-installed) | Linux service lifecycle for the broker | See Q5 below — a template file the user opts into, never invoked automatically |
| launchd plist template (committed, not auto-installed) | macOS service lifecycle for the broker | Same posture as the systemd template |

## Installation

```bash
# No new runtime dependency. Nothing to install beyond what package.json already lists.
# The only new files are:
#   - a fixed-port dial resolver (extends vice-broker-client.ts)
#   - a hybrid framer module (peer to broker-control.mts)
#   - a systemd unit template and a launchd plist template (documentation-adjacent, not code dependencies)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hybrid framing (JSON header line + declared-length binary body) | Pure length-prefixed binary frames for everything | If the control vocabulary ever needs to be binary-safe from byte zero (e.g. embedding arbitrary bytes in every field) — not the case here; ops/ids/paths/counts are all plain JSON-safe scalars |
| Hybrid framing | Base64-in-JSON | If payloads stayed under a few KB and simplicity of "everything is one JSON line" outweighed the ~33% size and copy overhead — wrong tradeoff once payloads reach 64KB–20MB (see Q3 below) |
| Keep port 19510 | A brand-new port number | If the team wants a hard, unmistakable signal that "this is the v2.0.0 broker, not a leftover v1.x one" — see Q2 below for why a self-identifying handshake solves the same problem more cheaply |
| Strict request/response serialization per connection | Request-id multiplexed concurrent in-flight requests | If a single MCP-server connection ever needs to issue two tool calls to the same broker connection truly concurrently — it does not today (`heldSession` is a singleton; `@mastra/mcp` dispatches one stdio tool call at a time per process) |
| systemd user unit / launchd plist, documented, opt-in | A cross-platform Node process-manager package (pm2, forever) | Never — see "What NOT to Use" |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| gRPC / Protocol Buffers | Needs a schema + codegen step, which conflicts directly with "the shipped server has no build step" (Node type-stripping only); enormous dependency for ~8 verbs on a loopback/bridge socket | Hand-written JSON-line + declared-length-body framer, matching the project's own two existing hand-rolled binary framings (`stock-protocol.ts` for the VICE binary monitor, `broker-control.mts` for the control plane) |
| Socket.IO / `ws` (WebSocket libraries) | Built for HTTP-upgrade browser transport; brings its own heartbeat/auto-reconnect layer that would **silently paper over** the exact signal this design depends on — "the connection IS the session; the broker reclaims the instance when the socket drops" | Plain `node:net` `Socket`/`Server`, exactly as today |
| A generic RPC framework (JSON-RPC library, tRPC, Thrift, Cap'n Proto, MessagePack-RPC) | Router/schema abstraction this project's existing `ControlRequestKind` union + explicit dispatch already does more simply and more legibly for a fixed, small verb set | The existing hand-written `attachControlProtocol()` dispatch pattern, extended with the new ops |
| A process-supervisor npm package (pm2, forever, nodemon in production) | Duplicates what systemd (`Restart=on-failure`) and launchd (`KeepAlive`) already provide at the OS layer for free; would become a ninth external tool this "never-auto-install" project would then have to detect-and-refuse for | A committed, opt-in systemd user-unit template (Linux) and launchd plist template (macOS); a documented foreground command as the lowest-common-denominator fallback on any platform |
| Unix domain sockets | **Already considered and explicitly rejected** at a blocking decision checkpoint on 2026-08-03 (`broker-control.mts`'s own header comment) — a UDS needs a shared filesystem path on both sides of the boundary, which is precisely the bind-mount/shared-path machinery this milestone exists to delete | TCP over the fixed dial-order candidates (loopback, then the container-to-host bridge alias) |
| HTTP multipart upload libraries (`multer`, `formidable`) | Multipart is an HTTP-server concept; adopting it means standing up an HTTP server where a raw TCP socket already exists and works | The same hybrid framer used for every other op: a JSON header naming the byte count, followed by that many raw bytes |
| msgpack / CBOR for the control header itself | The control lines are small, human-debuggable JSON today (`nc`/`socat` can watch the wire live); binary-encoding the header trades that away for no measurable win at this message size | Keep the header as one JSON line; binary-encode only the file payload that follows it (which is already binary, not JSON, in this design) |
| Auto-reconnect wrapper libraries | Same objection as Socket.IO: transparent reconnection would hide the drop event the broker's session-reclaim logic depends on | Let a dropped connection be a dropped connection; a client that needs a new session opens a new connection and, if stateful, loses its prior VICE instance by design |

## Stack Patterns by Variant

**If the stateful MCP-server connection ever needs to carry raw VICE binary-monitor traffic (async `STOPPED`/`RESUMED`/`JAM`/`CHECKPOINT_INFO`/`REGISTER_INFO` events) through the broker socket, not just lease-management ops:**
- Do **not** reuse the existing container-side client's naive `pending.shift()` FIFO dispatch (`vice-broker-client.ts`'s `createSession()`) unmodified — see Q4 below for why it is unsafe the moment any unsolicited line can arrive on that same socket.
- Because this codebase already has a correct, tested pattern for exactly this shape of problem (keyed dispatch that never resolves a pending request with an event) in the raw binary-monitor client, mirror that discipline at the broker-socket layer rather than inventing a new one.

**If a file transfer needs to be resumable or chunked across multiple round trips (not assumed necessary at the stated 20MB ceiling):**
- Add a `chunk_index`/`total_chunks` pair to the JSON header rather than reaching for a streaming protocol library — the ceiling stated in this milestone (64KB RAM snapshot, `.vsf` snapshots, Ghidra project data, all "1KB–20MB") does not justify chunking; a single declared-length body transfer is sufficient and simpler to reason about and test.

## Version Compatibility

| Fact | Applies From | Notes |
|------|--------------|-------|
| `host.docker.internal` on plain Docker Engine (non-Desktop) Linux, via `--add-host=host.docker.internal:host-gateway` | Docker Engine **≥ 20.10** (released December 2020) | Before 20.10 there is no `host-gateway` special value at all; the flag must be added explicitly on every `docker run`/Compose invocation — it is never automatic on plain Linux Engine |
| `host.docker.internal` automatic (no flag) | Docker Desktop, all three OS builds (macOS, Windows, and the Linux **Desktop app**, which itself runs containers inside a VM unlike plain Engine) | Any currently-supported Docker Desktop version; this is a documented, stable feature of Desktop's networking layer, not of the Linux kernel or `dockerd` itself |
| `host.containers.internal` (and, for Docker compatibility, `host.docker.internal`) automatic in `/etc/hosts` | Podman, current versions (verified against the v5.3.2 docs) | Rootful and the pre-5.0 rootless (`slirp4netns`) default both get this write automatically; disable via `--no-hosts` or `host_containers_internal_ip="none"` |
| Podman rootless networking backend change | Podman **5.0** made `pasta` the default rootless network backend, replacing `slirp4netns` | **MEDIUM confidence, not verified against a primary Podman release note in this pass** — community sources describe `pasta`'s default as no-NAT/shared-IP, which can make the host-gateway-style address behave differently; `pasta:--map-gw` is the reported remedy. Flag for direct verification before the roadmap commits to a specific rootless Podman dial address |
| Rootless **Docker** and `host.docker.internal`/host-gateway access | No fixed version — **an open, currently unresolved limitation**, not a version floor | **MEDIUM confidence** (Docker community forum thread, no primary doc found): RootlessKit's default `slirp4netns --disable-host-loopback` invocation blocks the container from reaching host-bound services regardless of which hostname/IP resolves to the host. Even after adding `--add-host=host.docker.internal:host-gateway`, a rootless Docker user may still be unable to reach a host-bound broker. This must be disclosed to the user, not silently assumed to work |

## Sources

- [Docker Desktop networking](https://docs.docker.com/desktop/features/networking/) — HIGH — confirms `host.docker.internal` resolves to the host's internal IP; documented as Desktop's own DNS name, not OS/kernel-level
- [Docker Desktop networking how-tos](https://docs.docker.com/desktop/features/networking/networking-how-tos/) — HIGH — same fact, framed as a how-to across Desktop platforms
- Docker Engine 20.10 release notes (found via search of docs.docker.com) — HIGH — states Docker 20.10 added `host.docker.internal` support in `dockerd` on Linux via the `--add-host`/`host-gateway` mechanism
- [Docker host network driver docs](https://docs.docker.com/engine/network/tutorials/host/) — HIGH — confirms plain Linux Engine has no automatic host-name resolution; `--net=host` plus `localhost` is the documented Linux-native alternative when `host-gateway` is not used
- [Podman `podman-run` man page, v5.3.2](https://docs.podman.io/en/latest/markdown/podman-run.1.html) — HIGH — quotes: "the *host-gateway* address is also used by Podman to automatically add the `host.containers.internal` and `host.docker.internal` hostnames to `/etc/hosts`"; also documents the `podman machine` (Mac/Windows VM) case, where these hostnames resolve via the `gvproxy` DNS resolver instead of an `/etc/hosts` entry, and are silently skipped if no gateway address can be determined
- [Docker rootless mode docs](https://docs.docker.com/engine/security/rootless/) — HIGH for what it says (fundamentals only) / confirms this exact gap: the official page has **no** mention of `host.docker.internal`, `host-gateway`, or RootlessKit networking limitations
- Docker community forum thread on rootless `host.docker.internal` (docs.docker.com forum, `t/141683`) — MEDIUM — describes RootlessKit's `slirp4netns --disable-host-loopback` as the root cause of rootless Docker's inability to reach host-bound services even with `host-gateway` configured; no official doc corroborates this directly, treat as community-measured, not vendor-confirmed
- VS Code devcontainer.json examples (multiple project repos found via search, e.g. `project-chip/connectedhomeip`, Dlubal API docs) — MEDIUM (pattern confirmed by multiple independent real-world `.devcontainer.json` files, not a single official spec page) — confirms `"runArgs": ["--add-host=host.docker.internal:host-gateway"]` is the standard way to force the mapping on a devcontainer host that is plain Linux Docker Engine; VS Code's devcontainer tooling itself adds no special-cased networking beyond passing `runArgs` through to `docker run`
- IANA ephemeral/dynamic port range research (multiple secondary sources; RFC 6335 for the canonical 49152–65535 IANA range) — HIGH for the RFC 6335 range itself; MEDIUM for the per-OS defaults (Linux ~32768–60999, Windows/macOS/BSD ≈ 49152–65535), which are OS-configurable and only "typical defaults" rather than a written standard
- `src/mcp/vice/broker-control.mts` (this repo) — HIGH — primary source for the existing control-plane framing, port default (19510), and the explicit rejection of a Unix-domain-socket alternative
- `src/mcp/vice/vice-broker-client.ts` (this repo) — HIGH — primary source for the existing dial-target resolution, the FIFO strict-serialization session pattern, and the documented reasoning for why that FIFO pattern is safe today only because no unsolicited line is ever pushed on that socket
- `CLAUDE.md` (this repo) — HIGH — primary source for the binary-monitor's five unsolicited event types at request-id `0xffffffff` and the demux rule ("must key on request-id and never resolve a pending request with an event"), which is the direct basis for the Q4 warning above

---

## Detailed Answers to the Six Questions

### 1. Container networking reality (the load-bearing fact)

| Platform | `host.docker.internal` resolves by default? | What makes it work / not work | Version |
|----------|----------------------------------------------|--------------------------------|---------|
| Docker Desktop macOS | **Yes** | Desktop's own VM + DNS layer injects it; not an OS or kernel feature | Any current Desktop release |
| Docker Desktop Windows | **Yes** | Same as macOS — Desktop-layer feature, independent of the Windows kernel | Any current Desktop release |
| Docker Engine on plain Linux (no Desktop) | **No, by default** | Requires an explicit `--add-host=host.docker.internal:host-gateway` (or Compose `extra_hosts`); `host-gateway` resolves to the default bridge gateway address (typically `172.17.0.1`) and Docker writes it into the container's `/etc/hosts` | Requires Docker Engine **≥ 20.10** (Dec 2020); the `host-gateway` special value does not exist before that |
| Docker Desktop **for Linux** (the Desktop app, not plain Engine) | **Yes** | Runs containers inside a VM the same way macOS/Windows Desktop do, despite running on a Linux kernel — this is the Desktop-layer feature again, not the plain-Engine behavior | Any current Desktop-for-Linux release |
| Rootless Docker (`dockerd-rootless`, plain Engine, no Desktop) | **No — and the standard fix may not fully work** | RootlessKit's default networking (`slirp4netns --disable-host-loopback`) blocks a container from reaching host-bound services regardless of hostname/IP. Even adding `--add-host=host.docker.internal:host-gateway` can still fail to reach the host. MEDIUM confidence: this is community-documented (Docker forum thread), not covered on the official rootless-mode doc page at all | No known fixed version; open as of this research |
| Podman, rootful | **Yes, automatic** | Podman writes `host.containers.internal` **and** `host.docker.internal` into `/etc/hosts` automatically, using a host-gateway address suited to the active network mode (e.g. the bridge gateway, commonly `10.88.0.1`) | Confirmed against Podman docs current as of v5.3.2; long-standing behavior |
| Podman, rootless, pre-5.0 default (`slirp4netns`) | **Yes, automatic**, same mechanism as rootful | Same `/etc/hosts` auto-write | Pre-Podman-5.0 |
| Podman, rootless, Podman **≥ 5.0** default (`pasta`) | **Possibly not, by default** — MEDIUM confidence, unverified against a primary release note in this pass | `pasta`'s default mode copies the host's address into the container (no NAT), so container and host can share an IP and a gateway-style address may not behave as expected; the reported remedy is `pasta:--map-gw` | Podman ≥ 5.0 |
| Podman via `podman machine` (macOS/Windows VM) | **Yes, but via DNS, not `/etc/hosts`** | Official `podman-run` docs state Podman "will silently skip adding the internal hostnames to `/etc/hosts` ... the internal hostnames are resolved by the gvproxy DNS resolver instead" | Current `podman machine` versions |
| VS Code devcontainers (any engine underneath) | **Inherits whatever the underlying engine does** | devcontainer.json adds no networking feature of its own; on plain Linux Docker Engine, the fix is the identical flag, injected via `"runArgs": ["--add-host=host.docker.internal:host-gateway"]`. On Docker/Podman Desktop it needs nothing extra | N/A — pass-through of `runArgs` to `docker run`/`podman run` |

**What this means for the fixed two-candidate dial order (`127.0.0.1`, then `host.docker.internal`):**

- **Sufficient, unmodified, for the majority case**: Docker Desktop (all three OS builds) and rootful/pre-5.0-rootless Podman all resolve `host.docker.internal` (Podman also serving it as a compatibility alias) without extra configuration on the container side.
- **NOT sufficient on its own for plain Docker Engine on Linux** — the container needs `--add-host=host.docker.internal:host-gateway` passed at container-create time (a `docker run`/Compose/devcontainer.json `runArgs` concern, outside this project's control) before the name resolves at all. This is a **documentation and remedy-message** obligation, not a code obligation: the client's refusal-by-name message, when neither candidate answers, should name this exact flag as the fix for a plain-Linux-Engine devcontainer user, mirroring the project's existing "detect, then refuse by name with the remedy" doctrine.
- **A third dial candidate is not warranted as a blind default** (e.g. probing the bridge gateway IP directly, or `host.containers.internal`), because:
  - The bridge gateway address is not fixed (`172.17.0.1` is Docker's *default* bridge gateway only — a custom network changes it), so hard-coding it is fragile in exactly the way a fixed-port design is trying to avoid.
  - `host.containers.internal` only matters for Podman, and Podman already answers to `host.docker.internal` too (the compatibility alias is written by Podman itself) — so the existing second candidate already covers the Podman case without adding a third name.
  - The one platform combination where NEITHER candidate resolves today — plain Docker Engine on Linux without the `--add-host` flag, and rootless Docker even with it — is a **configuration gap on the container side**, not something a third DNS-name candidate could paper over; no additional hostname fixes a missing `--add-host` flag or a `slirp4netns --disable-host-loopback` block.
  - **Recommendation**: keep the two-candidate order exactly as decided, and add the plain-Docker-Engine-Linux remedy (`--add-host=host.docker.internal:host-gateway`, or the devcontainer.json `runArgs` equivalent) to the project's README/remedy text as a **documented prerequisite for that one deployment shape**, the same way the project already documents `apt`/`brew`/`pacman` lines for external tools it will not auto-install. Disclose the rootless-Docker gap explicitly (it is currently unresolved industry-wide) rather than silently failing.

### 2. Choosing the fixed port

- The project already has a live precedent: `broker-control.mts` defaults `VICE_BROKER_CONTROL_PORT` to **19510**, well below the ephemeral range on every OS surveyed (Linux ~32768+, Windows/macOS ≈ 49152+), so no OS will transiently hand this port to an outbound connection out from under a listening broker. No IANA registration was found for 19510 (checked against the IANA Service Name and Port Number Registry search), so there is no known collision with a registered service either.
- **Recommendation: keep 19510** as the one fixed, well-known, machine-wide broker port. Reasons:
  - Zero churn: it is already the number every existing test, doc reference, and env-var default in this codebase uses.
  - Already outside the emulator's own reserved block (`6510`–`6599` reserved by convention, `6600`+ allocated to live instances) and outside every OS's default ephemeral range.
  - The project's own D-33 precedent ("clean break: no dual-read of the previous locations... a pre-existing old-layout tree is simply ignored") already establishes the right posture for a major-version transport change: don't invent parallel infrastructure to smooth over the break, document the break and let the user restart the daemon.
- **What the client must do on a collision** (something else answers on 19510, or a stale pre-v2.0.0 broker is still bound there): the very first exchange on a new connection must be **self-identifying** before any op is trusted. Concretely: the connecting client sends its first line, and if the peer's first response is not a well-formed line of the expected shape within a short connect-and-greet timeout (a few hundred ms to a couple of seconds, well under the existing `CONTROL_CONNECT_TIMEOUT_MS` = 5000), the client must treat that dial candidate as "answered, but not this broker" — not as "found the broker, protocol error." This distinction matters because a stale pre-v2.0.0 broker (old JSON-only protocol, no file-byte framing) or an unrelated process squatting the port will both produce *some* response, and the failure mode must read as **"wrong thing is listening on 19510"** in the refusal message, distinctly from **"nothing is listening at all."** This is a new, small piece of client logic — a version/capability marker in the first control line, checked before any acquire/status/host_tool op is attempted — not a new dependency.

### 3. Framing request/response JSON and file bytes on one socket

**Recommendation: a hybrid — JSON header line + length-prefixed binary body — not pure binary framing and not base64.**

| Approach | Memory/throughput at 1KB–20MB | Verdict |
|----------|-------------------------------|---------|
| Base64-in-JSON (encode the whole file as a string field in the JSON line) | ~33% size inflation on the wire; the encoder and the JSON stringifier both need the *entire* encoded string in memory at once, on top of the original bytes — for a 20MB file this is briefly ~27MB of base64 text plus the original 20MB Buffer, ~47MB peak for one transfer; `JSON.parse` on the receiving end must scan the whole line before any byte is usable, so nothing can be written to disk until the full line has arrived | **Reject.** Needlessly bloats exactly the payload sizes named in this milestone (a `.vsf` snapshot, Ghidra project data) for no benefit |
| Pure length-prefixed binary frames for everything (including ordinary ops with no file) | Every message, even a bare `status` or `acquire`, now needs a 4-or-8-byte length prefix and loses the human-debuggability of a raw JSON line (`nc`/`socat` can no longer show you what's happening) | **Reject as the default**, but the *mechanism* (a declared byte count consumed as raw bytes) is exactly right for the one case that needs it — a trailing file payload |
| **Hybrid: newline-terminated JSON header line, naming a `bytes` field when a payload follows, then exactly that many raw bytes before resuming line-mode** | The JSON header stays tiny (op name, id, token, path hint, byte count) and human-readable; the binary body is read as raw `Buffer` chunks up to the declared count, with no encoding/decoding step at all — for a 20MB file, peak memory is one ~20MB `Buffer`, not two overlapping copies | **Recommended.** Extends today's convention (one JSON line per message) rather than replacing it, and only pays a framing cost on the messages that actually carry bytes |

**Node primitives and the correctness trap to name explicitly:** today's control-plane reader treats the whole socket as UTF-8 text — `buffer += chunk.toString("utf8")` in `broker-control.mts`/`vice-broker-client.ts`. That is **only safe for JSON lines**. Any framer extended to carry binary bytes must switch reading modes explicitly: accumulate `Buffer` chunks (never `.toString("utf8")`) for exactly the declared byte count named in the preceding JSON header, then resume newline-delimited string mode for the next header line. Reusing the existing string-concatenation buffer for a binary segment would corrupt the bytes (invalid UTF-8 sequences are lossy through a decode/encode round trip) — this is a real, specific bug this redesign must not reproduce, not a hypothetical one.

**Backpressure traps:**
- Writing: `socket.write(buffer)` for a single up-to-20MB buffer does not block Node's event loop (Node queues it internally against the OS socket buffer and the network's own flow control), so a single whole-buffer write per file transfer is adequate at this size ceiling — no need to chunk the write or listen for `'drain'` for a *single* large write. `'drain'` only matters if the same connection issues several large writes back-to-back without waiting for each to flush, which the strict serialization recommended in Q4 already rules out.
- Reading: never scan a binary segment for a delimiter (e.g. treating it as "read until newline") — it must be consumed by declared count, because arbitrary file bytes can legally contain a `\n` byte.
- The existing `MAX_LINE_BYTES` cap (65536) on the JSON header line itself stays correct and unchanged, because the header never carries the file's own bytes — that is precisely what the hybrid design buys over base64-in-JSON.

**Framing library verdict:** not warranted. `node:net` plus this hand-written framer keeps the two-runtime-dependency constraint intact and matches the project's own precedent — it already hand-rolls binary framing twice (`stock-protocol.ts` for the VICE binary monitor's length-prefixed frames, `broker-control.mts` for the newline-JSON control plane). A third hand-rolled framer, reusing the same two primitives (`Buffer` accumulation with a byte counter; string accumulation with a newline scan), is a smaller and more auditable addition than any length-prefixed-stream npm package would be, and it is directly testable with `node --test` against a synthetic `net.Socket` pair exactly as the existing framers are tested today.

### 4. Multiplexing

**Recommendation: keep strict request/response serialization per connection. Do not add request-id multiplexed concurrent in-flight requests.**

Evidence this is what the system actually needs:
- `vice-broker-client.ts`'s existing `BrokerControlSession` already documents and relies on strict serialization: "every session method awaits its own `sendAndAwaitLine()` call to settle before this client ever writes a second request line — responses can therefore never arrive out of the order their requests were sent in, so matching purely by arrival order... is correct." This is a **deliberate, documented, already-working design**, not a gap.
- This project's own global-state inventory (`CLAUDE.md`) records `heldSession` in `stock-dispatch.ts` as a **singleton**, not a map keyed by concurrent request — the MCP server itself is architected around one held session, one thing in flight, at a time per process.
- `@mastra/mcp` over stdio forwards `tools/call` requests from Claude Code, which itself issues tool calls to a given MCP server sequentially within a session in the normal flow this project's tools are used in (checkpoint waits, memory reads, disassembly) — there is no existing call pattern in this codebase that needs two outstanding broker requests from the *same* MCP-server process at once.

**One real wrinkle this research surfaces, distinct from "does it need multiplexed client-issued requests":** if the redesigned stateful connection is also the channel that carries the VICE binary monitor's own traffic once a session is live — and the milestone's own language ("the broker holds that connection's VICE emulator instance") strongly implies exactly that — then the socket can carry **unsolicited, asynchronous lines** interleaved with ordinary request/response pairs. `CLAUDE.md` is explicit about this on the raw binmon protocol: five unsolicited message types (`STOPPED`, `RESUMED`, `JAM`, `CHECKPOINT_INFO`, `REGISTER_INFO`) arrive at request-id `0xffffffff`, two of which **share a response type with a legitimate command reply**, and "demux must key on request-id and never resolve a pending request with an event."

The existing container-side client's dispatch (`pending.shift()` — take the oldest pending entry and resolve it with whatever line just arrived) is **only safe today because the control plane never pushes an unsolicited line** (its own comment states this explicitly: "unsolicited line -- this protocol never pushes one; ignored defensively"). If the v2.0.0 socket starts carrying binmon-originated async events too, that FIFO-shift assumption breaks, and the broker-socket layer needs the **same keyed, request-id-aware demux discipline the raw binary-monitor client already implements one layer down** — not full multiplexing (many client-issued requests outstanding at once), but a real distinction between "a response to something I sent" and "an event nobody asked for." This is a concrete design point the roadmap should carry forward explicitly, because reusing the naive FIFO pattern unmodified in that scenario would reproduce a defect class this project has already named and fixed once.

**Verdict on a framing library for this:** still no. The correct demux logic already exists, proven, in `stock-protocol.ts`; the right move is to port its discipline (key by request id / by the reserved unsolicited-id sentinel, never positionally) to the new socket layer, by hand, not to add a pub/sub or RPC library to get "correlation IDs" as a feature.

### 5. Service lifecycle on the host

The broker is user-started and must outlive the terminal session, and this project never auto-installs anything — it detects and refuses by name with the remedy.

**Recommendation:**
- **Ship, as committed but *not automatically applied*, one systemd `--user` unit template for Linux** (e.g. `resources/systemd/vice-broker.service`), with `ExecStart` pointing at the broker's launcher script, `Restart=on-failure`, and `WantedBy=default.target`. The user runs `systemctl --user enable --now vice-broker.service` themselves — this is an opt-in template, not an install step, matching the ACME/Ghidra/dxa posture exactly.
- **Ship, as committed but not auto-applied, one launchd agent plist template for macOS** (e.g. `resources/launchd/com.henols.vice-broker.plist`), with `RunAtLoad` and `KeepAlive` set, loaded by the user via `launchctl load -w ~/Library/LaunchAgents/com.henols.vice-broker.plist`.
- **Document a plain foreground command as the lowest-common-denominator fallback on any platform** (including native Windows, which this project does not otherwise target as a host OS): "run `node <path>/vice-broker.mjs` in a terminal you leave open." This is the option that needs zero platform-specific tooling and is the right answer for a user who does not want a system service at all.
- **The refusal message**, when a client exhausts both dial candidates, should name the exact remedy for the detected platform: on Linux, the `systemctl --user` command and the template's path; on macOS, the `launchctl load` command and the plist's path; otherwise, the foreground command. This mirrors the existing `x64sc`/`c1541`/`ACME`/`Ghidra`/`dxa` remedy-in-the-refusal convention word for word — it is the same shape of problem (a required piece of infrastructure the user, not the tool, must start) applied to the broker itself rather than to an external binary.
- **Do not** ship or depend on a process-supervisor npm package to achieve "survive the terminal session" — see "What NOT to Use."

### 6. What NOT to add

Already covered in the table above; the shortlist, with the sharpest reason for each:
- **gRPC/Protobuf** — needs a build/codegen step this project structurally does not have.
- **Socket.IO/ws** — its automatic reconnection actively defeats "the connection is the session."
- **A generic RPC/schema framework** — this project's small, explicit, hand-dispatched verb set is already simpler than anything a framework would generate.
- **A process-supervisor dependency (pm2/forever/nodemon)** — systemd/launchd already do this for free, and adding one creates a tenth external tool this project would then have to detect-and-refuse for.
- **Unix domain sockets** — already formally rejected at a blocking decision checkpoint (2026-08-03) for the exact reason relevant here: it needs a shared path across the boundary this milestone is deleting.
- **HTTP multipart upload libraries** — solves a problem (HTTP file upload) this design does not have (raw TCP already carries the bytes).
- **msgpack/CBOR for the JSON header** — trades away today's human-debuggable wire format for no measurable gain at this message size.
- **A length-prefixed-frame npm package** — the project already hand-rolls this twice; a third hand-rolled instance is smaller and more consistent than a new dependency.

---
*Stack research for: c64-re-tools v2.0.0 "One Broker, One Socket" transport/deployment redesign*
*Researched: 2026-09-19*
