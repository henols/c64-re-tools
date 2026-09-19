# Project Research Summary: v2.0.0 "One Broker, One Socket"

**Project:** c64-re-tools
**Domain:** Transport/deployment redesign of an existing Node/TypeScript MCP plugin — collapsing per-project discovery and path-translation into one machine-wide TCP broker
**Researched:** 2026-09-19
**Confidence:** HIGH overall — stack and features draw heavily from codebase precedent; architecture recommendations are evidence-based against measured blast radius; pitfalls are calibrated to this project's own history

> **Orchestrator note, 2026-09-19.** This file was written by the orchestrator
> under the #222 self-heal path (the synthesizer returned the document inline
> rather than writing it). Two passages in the returned draft were **corrected
> rather than transcribed**, because they contradicted decisions and
> measurements already taken. Both corrections are marked **[CORRECTED]** in
> place. Do not restore the draft's wording from any transcript.

---

## Executive Summary

The v2.0.0 redesign replaces on-disk discovery files and per-project brokers with a single, manually-started, machine-wide daemon reached via a well-known TCP port (19510) in a fixed candidate order. No new runtime dependencies are introduced. The key technical shift is that files now travel as bytes over the control socket instead of as shared filesystem paths: the broker becomes the sole thing that ever speaks to the emulator or traverses its filesystem, and the client/skill-script layer reads and writes only under its own `.c64-re-tools/` directory.

The design is a **net simplification** of the transport layer — it removes three files worth of path-translation logic (6 real importers) and deletes the per-project auto-deployment machinery — but introduces new hazards around stateful session lifecycle, socket-event-driven reclaim, and file integrity that must be designed conservatively. The recommended approach is an 8-phase build order that keeps the suite green throughout and treats deletion not as a one-time cutover but as a converging countdown of eliminated call sites, with structural tests rewritten rather than discarded.

**Critical risk:** the fixed port's reachability and the bind address are load-bearing on container reachability, and the same socket now carries file bytes in both directions — so path-traversal validation is security-critical in **both** directions. **Mitigation:** treat the dial/handshake/bind trio (Pitfalls 1–3) as a gated checkpoint before any other transport code is written.

---

## Settled owner decisions — NOT open questions

These were decided by the owner on 2026-09-19, during and after research. Anything in the source research files that treats them as open is **superseded by this section**.

| # | Decision | Consequence |
|---|---|---|
| 1 | **Discovery** — fixed well-known TCP port, dialled `127.0.0.1` then `host.docker.internal`; first successful handshake wins. No discovery file on disk. Port **19510** retained (today's `VICE_BROKER_CONTROL_PORT` default). | `broker.json` and every reader of it is deleted. The dial order *is* the host/container detection. |
| 2 | **Lifecycle** — one **manually started** broker per machine. No client may ever spawn it. | A client that finds no broker refuses **by name** with the per-platform remedy, mirroring the existing ACME/Ghidra/dxa convention. The `inFlight` launch guard survives unchanged — the broker still spawns `x64sc`. |
| 3 | **Session model** — skill-script calls are **stateless** (open/send/receive/close, no lease, no emulator binding). MCP-server connections are **stateful**; **the connection IS the session**. | Extends the already-shipped `socket.on("close") → onRelease` mechanism rather than inventing one. |
| 4 | **Files** — all movement is bytes over the socket. Client saves under its own `.c64-re-tools/<kind>/` and the response carries the **local** path. | Nobody shares a filesystem path across the boundary. Path translation loses its reason to exist. |
| 5 | **[CORRECTED] Bind and auth — `PKG-04` IS REVERSED.** The broker will **NOT** bind `0.0.0.0`. It binds **loopback plus the container bridge gateway address(es), enumerated at startup**. The per-boot capability token is **DROPPED**. | Deliberate reversal of the 2026-08-22 `PKG-04` accepted risk, taken because deleting `broker.json` removed the token's only distribution channel AND because the socket now carries file bytes and all skill-script traffic — a materially wider surface than the acquire/release/recycle-only plane `PKG-04` accepted. Narrowing the bind removes the token's job entirely. **A hardcoded `172.17.0.1` is WRONG** — a custom Docker network has its own gateway, so the enumeration must be real. |
| 6 | **Scope** — redesign only. | Carried debt (2026-09-14 planning-vocabulary reconciliation, `CR-01`, the stale-doc strings, `INSTALL-01`..`05`, Phase 55's missing verification, `PROOF-03`, `ANNO-14`/`ANNO-15`) is explicitly NOT in this milestone. |

**No phase may plan a token-distribution mechanism, a credential file, or a `0.0.0.0` bind.** Decision 5 settles all three. If an implementer's first-principles reasoning suggests re-widening the bind "so containers can reach it", the answer is the bridge-gateway enumeration, not the wildcard.

---

## Key Findings

### Recommended Stack

**No new runtime dependencies.** This is purely protocol and operations work on top of the existing stack (Node ≥ 24, `node:net`, `@mastra/mcp` 1.15.0, `@mastra/core` 1.55.0).

**Fixed-port dial-order discovery.** Client tries `127.0.0.1`, then `host.docker.internal`, stopping at the first successful handshake, each candidate under a **bounded timeout**. Port 19510 is already outside every OS's ephemeral range (Linux ~32768+, Windows/macOS ~49152+) and has no IANA conflict.

**Hybrid framing for the single socket.** A newline-terminated JSON header (operation, session id, byte count when a payload follows) then exactly that many raw bytes, then resuming line mode. This extends the existing newline-JSON convention and avoids base64's ~33% bloat for the 1KB–20MB payloads in play.

> **Load-bearing correctness trap, measured.** The existing framers accumulate as UTF-8 **strings** — `buffer += chunk.toString("utf8")` at `vice-broker-client.ts:457`, `vice-broker-client.ts:895` and `broker-control.mts:556`. That corrupts binary bytes. The byte segment needs a **Buffer-accumulation path**; string mode must never touch a payload.

**Multiplexing.** Strict request/response serialization is adequate — `heldSession` is a singleton and `@mastra/mcp` dispatches one stdio call at a time. But if the stateful socket ever carries VICE's own unsolicited events (five types at request-id `0xffffffff`, two sharing a response type with a legitimate reply), a FIFO `pending.shift()` matcher is unsafe: port `stock-protocol.ts`'s already-proven **keyed request-id demux**, never the naive shift.

**Service lifecycle.** Ship a systemd `--user` unit template (Linux) and a launchd plist (macOS) as **committed but never auto-applied** files, plus a documented foreground fallback. No process-manager npm package.

**Container-networking reality (the load-bearing external fact).** The two-candidate dial order is sufficient for Docker Desktop (macOS/Windows/Linux) and Podman (rootful, and rootless pre-5.0), which resolve `host.docker.internal` / `host.containers.internal` automatically. It is **NOT sufficient on plain Docker Engine on Linux**, which needs the container started with `--add-host=host.docker.internal:host-gateway` (Engine ≥ 20.10). **Recommendation: do NOT add a third dial candidate** — no hostname or IP fixes a missing `--add-host` flag. Document the remedy and disclose the rootless-Docker gap in the refusal message instead.

### Expected Features

**Must have (P1 — required for correctness):**
- Bounded per-candidate dial timeout, so a wedged or foreign process on 19510 cannot block fallback to the second candidate
- Version/magic handshake proving "this is genuinely our broker", using the existing `{kind, code, message}` envelope
- Hard version gate refusing an out-of-range client by name with the exact remedy (the two npm packages update independently, so skew is real)
- Incident-record-before-reclaim triggered on **socket drop**, not just on an explicit `vice_recycle`
- Idle/heartbeat detection for non-FIN client death (OS TCP keepalive defaults are ~2 hours on Linux — far too slow)
- File integrity (hash), size caps with clean refusal, per-session broker-side staging, cleanup on close plus an age-based sweep for crash recovery
- **Path-traversal refusal in BOTH directions** (see Pitfalls 9 and 10 — security-critical)

**Should have (P2):** session labeling (project/cwd tag) in `status` so "is it MY instance?" is answerable; an operator-only force-recycle for orphaned sessions; a `vice-wedge-triage/SKILL.md` update for the broker-restart-affects-everyone case.

**Anti-features — explicitly rejected, must not be absorbed into the roadmap:** TLS/mTLS, a full auth/ACL system, session resumption (contradicts "the connection IS the session"), resumable/chunked file transfer, RPC frameworks (gRPC/Protobuf/Socket.IO — the last also auto-reconnects, defeating connection-as-session), process-supervisor npm packages, Unix domain sockets (already considered and rejected 2026-08-03, `broker-control.mts:18`), a web dashboard, auto-spawn fallback, per-client rate limiting, cross-machine reachability, full capability negotiation.

### Architecture Approach

Everything — control operations, session state, file transfers, monitor claims — flows through the fixed broker port. The broker becomes the only process that speaks to the emulator or traverses its filesystem; it dials the emulator on behalf of the client and relays binmon bytes. Files are staged on the broker's **own machine-level state root** (never any project's `.c64-re-tools/`), and only local client-side paths are returned.

**Module disposition:**
- **Deleted:** `hostpath.ts`, `containerpath.ts`, `stock-paths.ts`, `broker.json` and all its readers, `install-resources.ts` (per-project auto-deployment) — *the last is flagged as strongly implied but not explicitly in the milestone's stated scope; see Open Questions*
- **Modified:** `broker-control.mts` (new `attach` / `file_transfer` ops), `vice-broker-client.ts` (dial-order consolidation, discovery readers removed), `host-tool-client.ts` (container-detection transport branch removed)
- **New:** a consolidated `broker-client.ts` in `src/mcp/vice/`, imported directly by same-package callers and reached by skill scripts through the **existing, unchanged** `mcp-module.mjs` resolve-then-spawn ladder — the pattern already proven for `host-tool-client.ts`. Duplication into both packages was rejected (`mcpHost()`'s three copies are the cautionary precedent); a cross-package `npm` dependency was rejected (breaks the plugin route, which never runs `npm install`); a third package solves nothing the ladder does not.
- **Narrowed, not deleted:** `container-guard.mts` — the broker still needs it to refuse running *as* a container at its own startup. Only its use for *routing* decisions goes away.
- **Untouched:** the `anno-*` family, pure decoders, `broker-launch.mts`'s `inFlight` guard, the dispatch table's contents.

**Blast radius (measured 2026-09-19, corrections applied):**
- **Path-translation importers: 6**, not ~38 — `containerpath.ts`, `host-tool-client.ts`, `install-resources.ts`, `stock-machine.ts`, `stock-paths.ts`, `vice-proxy.ts`. The other ~32 textual matches are *"never import hostpath.ts"* guard comments documenting NON-consumption — dead documentation to strip.
- **[CORRECTED] File-carrying tools: 4**, not 6 — `vice_autostart`, `vice_disk_attach` (inbound), `vice_snapshot_save` (outbound), `vice_snapshot_load` (inbound). **`vice_symbols_load` and `vice_program_load` were VERIFIED by the orchestrator as NOT file-carrying** — this is settled, not pending verification. `vice_program_load` refuses a filename outright and takes an enumerated subject id, saying so in its own refusal text (`src/mcp/vice/text-tools.ts:859`); `vice_symbols_load` reads client-side via `readFileSync` under `needsSession: false` (`src/mcp/vice/stock-symbols.ts:350`, `stock-dispatch.ts:780`). **No phase may plan file-transfer work for either.**
- **Host-tool seam: 14 referencing modules** — 8 under `src/mcp/vice/` (including two generated `resources/` mirrors), 6 under `src/skills/`.

**Ghidra symlink.** The *mechanism* (`ensureGhidraRunsHandle()`, `GHIDRA_RUNS_HANDLE_TARGET`, the minted symlink) is removable in full. The *rule* is not and never goes away: Ghidra's `ProjectLocator` calls `getAbsolutePath()` and refuses any dot-prefixed segment. It is satisfied trivially once the broker picks its own **dot-free** machine-level staging root instead of nesting inside a project's dotted `.c64-re-tools/`. The data relocates; the alias trick is deleted. `repo-root.ts`'s literal-string census **will** go red when this lands — that redness is the checklist, not a failure.

### Critical Pitfalls and Prevention

**Pitfall 1 — [CORRECTED] Authentication is settled, not open.** The draft of this file treated token distribution as an unresolved owner decision. It is resolved: **the bind is narrowed and the token is dropped** (see Settled Decisions #5). The residual work is not "choose a credential mechanism" but "**enumerate the bridge gateways correctly**" — a hardcoded `172.17.0.1` is wrong, because a custom Docker network has its own gateway. Prevention: enumerate at startup from the live interface list; refuse by name if no reachable candidate can be bound.

**Pitfall 2 — Fixed-port collision.** A stale pre-v2.0.0 broker (which defaults to this **exact** port, 19510), an unrelated process, or a second broker racing to bind can accept TCP but speak the wrong protocol, hang, or refuse. The stale-broker case is near-certain during upgrade, not hypothetical. Prevention: the handshake must prove identity before the connection is trusted; the broker must refuse loudly at startup on `EADDRINUSE`; every dial candidate is bounded by a timeout so a wedged listener cannot swallow the fallback.

**Pitfall 3 — [CORRECTED] Bind narrowing is the decision, not a hazard to avoid.** The draft warned against re-deriving a narrow bind and advised carrying `PKG-04` forward. That is **backwards** for v2.0.0: `PKG-04` is deliberately **reversed** (Settled Decisions #5). The real hazard is the opposite one — an implementer reading `broker-control.mts`'s header, which still says *"Bind: 0.0.0.0 explicitly, never 127.0.0.1"*, and faithfully preserving it. Prevention: that header comment is now **stale and must be rewritten** in the same phase that changes the bind, or it will keep teaching the reversed decision to every future reader.

**Pitfall 5 — Connection drop must drive reclaim.** A SIGKILLed client sends no goodbye. Reclaim fires on kernel socket events (`close`, `error`) — never on an application-level message. The pattern already exists at `broker-control.mts:571-577` (documented as covering client SIGKILL); it needs applying to the new stateful path, plus the idle/heartbeat path for deaths that produce no FIN at all.

**Pitfall 7 — Incident record on abrupt drop.** The standing rule is that an incident record is written **before** any recycle or kill. Under stateful sessions the likeliest trigger is now the client vanishing mid-operation with nobody left alive to supply a reason. Prevention: the broker mints its own synthetic reason (e.g. `connection_closed_mid_operation: <last known operation>`) through the *same* incident-record code path as a human-supplied one, and voids the run if a checkpoint or capture was in flight.

**Pitfall 9 — Path traversal, broker → client (SECURITY-CRITICAL).** The broker's response literally names where the client writes bytes. An unvalidated `..` or absolute component is a direct arbitrary-write primitive. Prevention: the client resolves every broker-supplied name against the fixed `.c64-re-tools/<kind>/` root and **refuses on non-containment** — refusal, not sanitization. Reject `..`, empty components, separators, absolute paths and NUL bytes. Fixture strings: `../../etc/passwd`, `/etc/passwd`, `C:\`, a NUL-embedded name.

**Pitfall 10 — Path traversal, client → broker (SECURITY-CRITICAL).** Same shape reversed. Prevention: the broker-side staging path is **broker-chosen** (e.g. `mkdtempSync`), never client-supplied; the client sends bytes plus at most a diagnostic label; any later reference uses an **opaque broker-minted handle**, never a re-echoed path string.

**Pitfall 18 — "The fallback survives."** The milestone's own hypothesis is only Validated if the old seam is **gone from production code, not merely bypassed**. A retained fallback route falsifies it directly. Related trap: a structural test that scans a named region becomes **vacuously green** once that region is deleted. Prevention: widen the assertion *before* deleting, so the test proves absence rather than silently proving nothing.

---

## Implications for Roadmap

**Suggested 8-phase structure.** Each phase is either safely incremental (old and new coexist, suite stays green) or explicitly atomic.

**Phase 1 — Consolidated broker client.** New `broker-client.ts`: dial-order discovery, bounded per-candidate timeout, version/magic handshake, CLI entry point for cross-package callers. *Incremental* — existing ops untouched, new ops additive. Addresses Pitfalls 1–2. **No token work** (Settled Decision #5).

**Phase 2 — Machine-level broker deployment.** State root moves from project-relative to machine-scoped; **bind narrowed to loopback + enumerated bridge gateways**; `broker-control.mts`'s stale `0.0.0.0` header comment rewritten; systemd/launchd templates; refusal-on-`EADDRINUSE`. *Incremental.* Addresses Pitfalls 2–3.

**Phase 3 — Monitor-channel cutover (ATOMIC).** `ensureStockSession()` is a single choke point by design, so no tool-by-tool migration is possible. It calls `attach` instead of `acquireOverControlPlane()` + direct dial; a relayed duplex stream replaces the direct binmon socket; `stock-protocol.ts` is unchanged, only its input socket's source changes. Addresses Pitfalls 5–7. **Blocked on the multiplexing decision below.**

**Phase 4 — The four file-carrying tools (incremental, per tool).** `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load`. The file-transfer protocol — framing, hashing, staging, cleanup, atomic write, **both-direction traversal refusal** — is the load-bearing work. Addresses Pitfalls 9–13.

**Phase 5 — Skill-script migration (incremental).** `acme.mjs`, `c1541.mjs`, `petcat.mjs`, `vsf-slice.mjs`, `packer-finding.mjs` and siblings resolve the new client through the **unchanged** `mcp-module.mjs` ladder.

**Phase 6 — CI bare-host route.** `.github/workflows/ci.yml` runs ACME tests on a flat runner with no container and no broker. Phase 5 removes that escape hatch, so this must be resolved **before** Phase 7 deletes it. Operational decision, not research.

**Phase 7 — Deletion cutover (ATOMIC, forced).** `hostpath-consumers.test.ts` asserts a closed, exact consumer set that cannot be half-true. Remove `hostpath.ts`, `containerpath.ts`, `stock-paths.ts`, the `broker.json` readers, `host-tool-client.ts`'s container branch, the old direct-dial path, and the ~32 dead guard comments. **This is where the milestone's hypothesis becomes true or false.** Exit criteria include a green suite *without* a running broker (a live broker deterministically reddens at least one existing test) and a green suite *with* one, exercising all four file tools end to end.

**Phase 8 — Ghidra runs-root relocation (incremental).** Delete the symlink mechanism; point at the broker's dot-free machine-level root; update `repo-root.ts`'s census and delete the symlink-guard live tests.

**Convergence metric:** the count of real `hostpath.ts`/`containerpath.ts`/`stock-paths.ts` importers. Starts at **6**, must reach **0** before Phase 7. Each phase's exit criterion is a grep census showing the number fell.

**Testing constraints that shape every phase.** `node --test`, no mocking library; env/time/spawn/IO take injectable overrides. Use pure-function tests for framing and path validation, synthetic loopback client/server pairs in the style of `stock-run-until.ts`, and `mkdtempSync` scratch dirs. Four measured local traps to design around: a live broker deterministically reddens an existing test; `node --test` silently **skips** a missing or typo'd test file and still exits 0; piping `npm test` through `tail` reports tail's exit code and fakes a green baseline; and the suite has a history of races on scratch files written into the repo tree.

---

## Open Questions

Genuinely unresolved. Each needs an answer before the phase that depends on it — none is a re-litigation of a settled decision above.

1. **Single multiplexed socket, or one fixed endpoint with multiple tagged connections?** The research recommends the latter (long-lived relayed binmon connection + short-lived stateless connections for files, both dialling 19510), because it needs no new envelope format and does not touch `stock-protocol.ts`'s socket-consumption contract. A literal single-physical-socket design expands Phase 3 substantially. **Needed before Phase 3 is planned in detail.**
2. **Does `install-resources.ts`'s per-project deployment survive "one broker per machine"?** Strongly implied obsolete, but not named in the milestone's stated scope — flagged rather than silently deleted. **Needed before Phase 7.**
3. **The plain-Linux-Docker-Engine remedy text**, and how prominently to disclose the **rootless-Docker gap** (RootlessKit's `slirp4netns --disable-host-loopback` may block host access even with `--add-host` set — community-sourced, no vendor confirmation, MEDIUM confidence). **Needed before Phase 2's refusal message is written.**
4. **CI's bare-host route** — start a throwaway broker in CI, move ACME tests to a manual-only gate, or something else. **Needed before Phase 6.**
5. **Podman ≥ 5.0's `pasta` default** and its effect on `host.containers.internal` resolution needs verification against a primary release note (currently blog-sourced, MEDIUM).

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH (2 nuances MEDIUM) | No new dependencies; decisions ground in existing codebase precedent. Container-networking facts cited from official Docker/Podman docs; rootless-Docker and Podman-5 `pasta` specifics are community-sourced and flagged. |
| Features | HIGH | Derived from the codebase's own shipped mechanisms — `socket.on("close") → onRelease`, the incident-record pattern, `vice_diagnose`'s verdict vocabulary. |
| Architecture | HIGH | Component dispositions read from the tree on 2026-09-19; blast-radius figures independently re-measured and corrected twice. Ghidra behaviour measured against real Ghidra 12.1.3. |
| Pitfalls | HIGH | Each cites this codebase's own history — the 2026-08-01 triple-launch outage, `PKG-04`, the binmon single-client hazard, the demux-by-request-id rule. None are hypothetical. |
| Overall | HIGH | The only MEDIUM claims are rootless-Docker and Podman 5 `pasta`; neither affects the main recommendation. |

---

## Sources

**Primary (HIGH):** `CLAUDE.md`; `src/mcp/vice/broker-control.mts` (framing, port 19510 default, token gate, close-as-release at :571-577, the stale `0.0.0.0` header at :16-23, the 2026-08-03 UDS rejection at :18); `src/mcp/vice/vice-broker-client.ts` (dial resolution, serialization, string-mode buffering at :457 and :895); `src/mcp/vice/stock-protocol.ts` (keyed request-id demux); `src/mcp/vice/stock-connect.ts`, `stock-dispatch.ts`, `stock-machine.ts`, `text-tools.ts:859`, `stock-symbols.ts:350`; `.planning/PROJECT.md`; `src/skills/vice-wedge-triage/SKILL.md`; `.planning/milestones/v0.4.0-REQUIREMENTS.md` (`PKG-04`, 2026-08-22).

**Secondary (MEDIUM):** Docker official documentation (Engine ≥ 20.10 `host-gateway`, Desktop networking, rootless mode); Podman documentation (v5.3.2, `host.containers.internal`, the 5.0 `pasta` change); a Docker community forum thread on rootless `--disable-host-loopback` (no vendor confirmation); VS Code devcontainer examples for the `--add-host` runArgs pattern.

---
*Research completed 2026-09-19. Settled owner decisions are recorded above and are not open for re-derivation during planning.*
