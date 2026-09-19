# Feature Research

**Domain:** single-machine, connection-is-the-session broker for a developer tool (v2.0.0 "One Broker, One Socket")
**Researched:** 2026-09-19
**Confidence:** HIGH for claims grounded in this project's own code and docs (`broker-control.mts`, `CLAUDE.md`, `vice-wedge-triage/SKILL.md`, `PROJECT.md`) — cited inline as `[codebase, HIGH]`. MEDIUM/LOW for general distributed-systems pattern claims pulled from uncurated web search — cited inline as `[web, MEDIUM]` or `[web, LOW]` per `classify-confidence --provider websearch` (LOW, unverified). No curated/Context7-grade source exists for "how does a connection-is-session broker behave" — it is a design pattern, not a library API — so this file leans on the codebase's own precedent wherever one already exists, and treats general web patterns as illustrative, never authoritative.

## Deep Dive: The Two Highest-Value Questions

### 1. Handshake against a wrong process on a fixed port

This is not a hypothetical. **The current broker already defaults its TCP control port to 19510** (`resolveControlPort()` in `broker-control.mts`), and the v2.0.0 goal explicitly reuses "a fixed well-known TCP port." A user who has not yet stopped their pre-upgrade broker will have a **real, live v1.x process already bound to the exact port a v2.0.0 client will dial** — this is the single most likely "wrong process" scenario, not a theoretical port collision with some unrelated service `[codebase, HIGH]`.

CLAUDE.md already documents the structurally identical failure mode at the binary-monitor layer: *"Stock VICE's binary monitor services exactly one client. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge"* `[codebase, HIGH]`. A fixed-port control socket has the same hazard shape one layer up: a process that **accepts the TCP connection** (so `connect()` succeeds) but never speaks the expected protocol (an old broker with a full accept queue, a leftover `nc` session, an unrelated dev server someone left on 19510) is indistinguishable from a genuinely wedged broker unless the client bounds its wait.

What makes a handshake unambiguous, in order of what's load-bearing:
1. **A bounded per-candidate timeout**, not a magic string, is the actual fix for the "wrong process" case — a magic string only tells you the peer is wrong *after* it answers; if it never answers, you need a clock, not a parser. This must gate the fixed dial order (`127.0.0.1`, then `host.docker.internal`) or a wedged first candidate blocks discovery of a healthy second one — the exact bug shape CLAUDE.md's binmon citation describes, recurring at a new layer.
2. **A version/identity field in the very first response**, framed inside the *existing* `{kind: "error"|"grant"|...}` envelope shape rather than a new bespoke handshake message. This buys forward AND backward legibility for free: an old v1.x client's parser already knows how to render `{kind:"error", code, message}` even if it has never seen the new `code` value, because that shape already exists today `[codebase, HIGH]`.
3. **A magic/version check is still necessary**, but only to positively confirm "this is our broker, and it is new enough" — not to detect a hang (timeout does that) and not to be the sole authentication (see the token question below).

**Version skew, concretely, given two independently-updatable npm packages:**
- *Old client → new broker*: the new broker should refuse by name, in the same "detect, then refuse by name with the remedy" shape this project already uses for external tools (`host-tool.mts`'s pattern) — e.g. `error, code: version_too_old, message: "this broker is v2.0.0; @henols/vice-mcp v1.x cannot use it — npm install @henols/vice-mcp@latest"`.
- *New client → old (leftover v1.x) broker*: the existing dispatcher's own fallthrough — `unknown op` for anything it doesn't recognize `[codebase, HIGH, broker-control.mts:903-905]` — already answers a new op name (e.g. `hello`) with a legible `bad_request`/`unknown op` error rather than hanging, **provided** the v2 client's first line is valid JSON the v1 parser can at least tokenize. The handshake should be designed to exploit this existing behavior deliberately (send a real op name first, read the response, THEN decide whether to proceed) rather than accidentally depending on it.
- **A real open question this research surfaces, not resolved by the milestone description**: the current per-boot capability token is minted fresh and written into `broker.json` (`newControlToken()` + T-01.6.2-02) `[codebase, HIGH]`. v2.0.0 deletes `broker.json` and every other discovery file. It does not yet say how a client obtains whatever credential the fixed-port handshake needs. Simply dropping auth is a live regression risk (see Table Stakes below) — this needs an explicit decision before requirements are written, not an assumption either way.

### 2. Connection drop mid-operation

The "connection close IS the release" mechanism **already exists and is already tested** — `attachControlProtocol()`'s `socket.on("close", ...)` calls `opts.onRelease(id)` unconditionally, explicitly including "on the client's own SIGKILL, since `close` always fires either way" `[codebase, HIGH, broker-control.mts:569-579]`. This is the direct ancestor of the stateful-session reclaim the milestone describes ("the broker holds that connection's VICE instance and reclaims it when the socket drops") — it is an extension of a proven pattern, not new territory, which meaningfully lowers the risk on this half of the design.

What genuinely is new risk:
- **A clean FIN is not the only way a client dies.** A killed process, a lost network path (real for the `host.docker.internal` bridge case), or an OS-level hang can leave a TCP connection half-open with no FIN and no RST for minutes (OS keepalive defaults). `socket.on("close")` never fires until the OS notices. Table stakes: an application-level heartbeat or a TCP keepalive with an aggressive idle timeout, or the "reclaims it when the socket drops" promise silently fails to hold for this whole class of client death.
- **Reclaiming an instance mid-checkpoint/mid-capture is not simply "kill it."** CLAUDE.md's own standing rule: *"Do not kill or relaunch the emulator to serve a newer request. Write the incident record first."* `[codebase, HIGH]` Today that discipline is wired to the explicit `vice_recycle` call path (`incident-record.ts` writes before any recycle/kill). Under v2.0.0, an ABRUPT drop must trigger the same incident-before-reclaim discipline automatically — nobody is left alive to call `vice_recycle` on behalf of a dead client. This is a genuinely new wiring requirement, not a restatement of an existing one.
- **Crashed client vs. crashed emulator are orthogonal axes and must stay orthogonal.** A dead client is a closed/timed-out socket, handled by connection-close-as-release. A dead emulator is the *existing*, independent crash-supervision + epoch-bump + `restarted` verdict machinery (`vice_diagnose`'s `restarted` verdict, live-proven per the skill's own provenance table `[codebase, HIGH]`). The new transport must not conflate the two: a socket dropping because the CLIENT died must not be reported the same way as an instance restarting because the EMULATOR crashed, or `vice_diagnose`'s five-verdict vocabulary silently degrades.
- **Session resumption is explicitly not wanted, and that is correct, not a gap.** The milestone's own wording — "the connection IS the session" — is a design commitment against resumability: reconnecting could not distinguish "the same client coming back" from "a different client claiming the same identity" without inventing a new identity mechanism the milestone deliberately avoids (no discovery file, no lease token to hand back). Treat resumability as an anti-feature (below), not an omission.

## Feature Landscape

### Table Stakes (the redesign does not work correctly without these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| The client fails fast (bounded timeout) when the first dial candidate accepts a connection but never completes the handshake | Prevents a wedged/foreign process on the fixed port from ever blocking fallback to the next candidate — the same "accept, no reply, no EOF" hazard CLAUDE.md documents for stock VICE's own binmon | MEDIUM | Depends on: `vice-broker-client.ts` (today dials one place; needs an ordered, per-candidate-timeout dial loop) |
| Every handshake response uses the *existing* `{kind, code, message}` envelope, even for a version refusal | Lets an old v1.x client's parser render an unrecognized new refusal legibly instead of throwing on an unknown message shape | LOW | Depends on: `broker-control.mts`'s existing `ControlResponse` union — extend, do not replace |
| The broker refuses an out-of-range client version BY NAME with the exact remedy, before doing anything stateful | Matches this project's own standing convention ("detect, then refuse by name with the remedy") already used for every external tool | LOW–MEDIUM | Depends on: a documented minimum-version table shared by the two independently-updatable npm packages |
| An old (pre-upgrade, still-running) broker answers a v2 client's new op with a legible `unknown op` error, not silence | This is the realistic version-skew scenario (a leftover v1.x process on the same default port), not a hypothetical unrelated service | Already largely true | Depends on: `broker-control.mts:903-905`'s existing fallthrough — the new handshake op must be a real, well-formed JSON line for this to trigger |
| A dropped stateful connection is detected even without a clean FIN (idle/heartbeat timeout, not just `close`) | `socket.on("close")` alone does not fire on a hung/killed peer for a long time; "reclaims it when the socket drops" must hold for that case too | MEDIUM | Depends on: extending the proven `broker-control.mts` close-handler pattern with an app-level liveness check |
| An abrupt connection drop triggers the SAME incident-record-before-reclaim discipline as an explicit `vice_recycle` | CLAUDE.md's standing rule ("write the incident record first") currently only fires on an explicit call; nobody calls it on behalf of a dead client | MEDIUM | Depends on: `incident-record.ts`, wired into the new drop-detection path |
| A crashed client (socket death) and a crashed emulator (process death / epoch bump) remain two separate, non-conflated signals | `vice_diagnose`'s five-verdict vocabulary (`restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`) depends on this separation already holding | LOW (preserve, don't rebuild) | Depends on: existing epoch/crash-supervision machinery, unchanged by this milestone per its own scope statement |
| Stateless one-shot calls (skill scripts) are simple open→send→receive→close with a bounded request timeout | This is the shape the milestone specifies; a hung stateless call must not be able to starve the accept loop | LOW | Depends on: the existing `MAX_LINE_BYTES`-style bounding discipline already in `broker-control.mts` |
| The existing FIFO `pendingAcquires` fairness (arrival order, never re-sorted) is preserved once multiple *projects*, not just multiple calls from one project, contend for instance slots | The milestone turns "several concurrent MCP servers, one project" into "several concurrent MCP servers, several projects" — the queue's fairness guarantee now has to hold across a wider caller set | LOW (already built) | Depends on: `broker-control.mts`'s `enqueueAcquire`/`drainPendingAcquires` |
| `status` continues to list every live instance, not just the caller's own | Needed for the wedge-triage skill's existing "find the other holder" playbook, and now doubly needed to tell "my session" from "someone else's project's session" | LOW (already built) | Depends on: `StatusInstanceEntry`, `onStatus()` |
| File bytes crossing the socket are integrity-checked (hash) by the receiver before use | A multi-file, multi-process handoff over a brand-new wire path is exactly where silent corruption bugs get introduced; cheap to add, expensive to debug if skipped | LOW | Applies to all six file-carrying tools (`vice_autostart`, `vice_disk_attach`, `vice_symbols_load`, `vice_program_load`, `vice_snapshot_save`, `vice_snapshot_load`) plus Ghidra/dxa artifact paths |
| File transfer has an explicit, generous size cap with a clean refusal message | The existing control protocol already destroys the socket outright above `MAX_LINE_BYTES` for JSON lines — a file transfer needs a much larger but still bounded and *legibly refused* limit, not a silent socket kill | LOW | New cap distinct from `MAX_LINE_BYTES`; needs its own refusal code |
| Broker-side staged files use a per-connection/per-request unique namespace, not a shared filename | Two projects can legitimately both send a file named `game.prg` at the same moment; the broker is no longer per-project, so filename collision in shared staging is now a real risk it wasn't before | MEDIUM | New problem introduced BY this milestone — the client-side final destination (`.c64-re-tools/` per project) is already namespaced; only the broker's in-transit staging area is new |
| Staged files are deleted from the broker's side once handed off/confirmed | Without expiry, a shared, always-on broker accumulates every project's in-transit artifacts on one machine's disk indefinitely | LOW–MEDIUM | New operational concern; previously each project's broker had its own short-lived, per-project footprint |
| The upgrade order (stop old broker → update both packages → start new broker → run clients) is documented, and the failure mode of getting it wrong is an explicit, legible refusal | Owed to users of a clean-break major version; matches "an existing install does not keep working unchanged, which is what a major version is for" from the milestone's own framing | LOW (docs) | Testable as: "a user who forgets the order sees a named refusal with a remedy, never a hang or a stack trace" |

### Differentiators (worth building beyond the bare minimum, in service of this redesign's own goals)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Session labeling: a client-supplied project/cwd tag on acquire, surfaced back in `status` | Directly answers "is it MY session that's stuck, or another project's?" — genuinely new confusion this milestone introduces by making one broker serve many projects at once | MEDIUM | Depends on: `AcquireGrant`, `StatusInstanceEntry`, `onAcquire()` signature in `broker-control.mts`, and the container-side `vice-broker-client.ts` |
| An operator-only "force-recycle regardless of `ownsTarget`" escape hatch, restricted to the same machine the broker runs on | Covers the real gap the current single-check `ownsTarget()` predicate leaves: a client process killed hard enough to never send FIN can pin an orphaned, wedged instance that no live connection can now recycle (only its own dead connection could) | MEDIUM | Depends on: `ownsTarget()` in `broker-control.mts`; must NOT be exposed as a general network-reachable bypass — same-machine-only, by convention, not by a new auth layer |
| A one-line addition to `vice-wedge-triage/SKILL.md`: compare `host_state.pid`/`started_at` across two diagnoses to detect a BROKER-level restart, distinct from a per-instance epoch restart | New diagnosable failure mode: one broker crashing/restarting now invalidates every project's session at once, a fan-out event the current skill (written for one-broker-per-project) has no language for | LOW | Depends on: existing `host_state` op (already returns `pid`, `started_at`); pure documentation, no broker code change |
| A thin CLI wrapper (`vice-broker status`) that dials the control port and pretty-prints `status`/`host_state` | Nice, not required — the raw JSON responses already answer every operator question; a formatter is convenience only | LOW | Optional; do not let this become a web dashboard (see anti-features) |
| A `hello`/capability-exchange op that returns the broker's supported op list, not just a version number | Lets a client degrade gracefully to a compatible subset instead of a hard all-or-nothing refusal | MEDIUM–HIGH | Explicitly a "not now" call for THIS milestone (see below) — flagged here only because it is a genuine future differentiator, not because it belongs in scope |

### Anti-Features (would look reasonable to add, and would be over-engineering for a single-user local dev tool)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| TLS/mTLS on the control socket | "It's a network service, encrypt it" | Adds certificate management for traffic that never leaves loopback + the docker bridge on one developer's own machine; no external exposure to defend against | Keep it plaintext, restrict by design to `127.0.0.1`/`host.docker.internal`, document that this must never be exposed to a real network, keep a shared-secret token (see below) |
| A full multi-tenant auth/ACL system (per-project accounts, RBAC, permissions) | "Many projects share one broker now, isolate them" | One human owns every project on the machine; an ACL enforces nothing real and adds its own bug surface. This is NOT multi-tenancy in the sense that term usually implies (many distrusting principals) | Session labeling for VISIBILITY/triage only (see differentiator above), not for access control; keep the existing single `ownsTarget()` check as the only real "permission," plus the same-machine-only operator override |
| Session resumption / reconnect-to-same-instance after a dropped connection | Feels wasteful to lose a live, checkpointed emulator to a network blip | Directly contradicts the design's own stated correctness property ("the connection IS the session") — resuming reintroduces exactly the identity ambiguity that property exists to avoid, with no lease token left (post-`broker.json`) to prove "this reconnect is really the same client" | Document the data loss plainly; lean on the project's own existing snapshot discipline (`vice_snapshot_save`) for anything worth preserving across a real restart |
| A resumable/chunked file-transfer protocol (byte-range resume, tus-style) | "Don't resend a large file after a flaky connection" | This is local-machine or docker-bridge traffic; files are small by this project's own numbers (RAM images, snapshots, PRGs, Ghidra/dxa artifacts — none is transfer-protocol-scale); a broken connection here usually means the emulator instance behind it is also gone, so resuming the bytes doesn't save the operation anyway | Whole-request retry, hash-verified, with a clean size cap and refusal |
| Replacing the hand-rolled newline-JSON framing with a general RPC/serialization framework (gRPC, Protobuf, etc.) | "Use a real RPC framework instead of hand-rolled framing" | Discards a working, tested, dependency-free protocol whose fairness/ownership/framing correctness is already proven, in exchange for a new runtime dependency this project's own conventions explicitly guard against adding without deciding to | Extend the existing `ControlRequestKind` union with new ops (`hello`, `send_file`, `recv_file`, …) the same way `host_tool` was added as an eighth member |
| A live status/monitoring web UI or dashboard | "See all sessions at a glance" | Single-user CLI/skill tool; a whole HTTP server + frontend to maintain for something the existing `status`/`host_state` JSON + a thin CLI print already covers | The thin `vice-broker status` CLI wrapper differentiator above, nothing served over HTTP |
| Automatic broker install/spawn-on-demand fallback if a client finds none | Convenience — "just work" | Explicitly overridden by the milestone's own decision ("no client may spawn it… refuses BY NAME with the remedy") and by the standing single-owner-launch-guard lesson (`broker-launch.mts`'s `inFlight` guard exists because of a real 2026-08-01 triple-launch outage) | Refuse by name with the exact manual-start remedy, the same pattern already used for `x64sc`/`c1541`/ACME/Ghidra |
| Per-client rate limiting / request quotas | "Protect the broker from a runaway client" | No adversarial multi-tenant scenario exists — one trusted user, and the one resource that actually needs bounding (emulator instance slots) is already bounded by `maxInstances` + the FIFO pending-acquire queue | Keep the existing instance-count ceiling; do not add call-rate throttling |
| A broker reachable beyond one machine and its own docker bridge (e.g. shared across a laptop and a remote box) | "Share one broker across two machines" | Explicitly out of scope by the milestone's own fixed dial order (`127.0.0.1`, then `host.docker.internal` — this machine only); a remote broker reopens exactly the auth/exposure problem the TLS anti-feature above avoids | None needed — one broker per machine, as decided |
| Full protocol capability negotiation (old clients running against a newer broker in a degraded-but-working compatible-subset mode) | Feels like good API hygiene for a long-lived protocol | This milestone is an explicit, decided CLEAN BREAK — "an existing install does not keep working unchanged, which is what a major version is for." Building graceful multi-version compatibility now contradicts that decision and adds real complexity to a milestone that should stay narrowly scoped | A hard version gate with a clear refusal (table stakes above); revisit capability negotiation only if a LATER milestone needs the protocol to evolve without another major bump |

## Feature Dependencies

```
Bounded per-candidate dial timeout
    └──required-by──> Handshake unambiguity (Q1)
                           └──required-by──> Version-mismatch refusal-by-name

Connection-close-as-release (EXISTING, broker-control.mts)
    └──extended-by──> Idle/heartbeat detection for non-FIN death
                           └──required-by──> Incident-record-before-reclaim on drop
                                                  └──must-not-conflate-with──> Emulator-crash epoch/restarted machinery (EXISTING, unchanged)

Session labeling (project/cwd tag on acquire)
    └──enables──> "Is it MY session?" visibility in `status`
                      └──enables──> vice-wedge-triage doc update (broker-restart vs instance-restart)

File hashing + size cap + refusal
    └──required-by──> Broker-side staging namespace (per-connection)
                           └──required-by──> Staged-file cleanup after handoff

Operator force-recycle escape hatch
    └──depends-on──> `ownsTarget()` predicate (EXISTING) being deliberately widened, same-machine-only

Hard version gate (THIS milestone)
    └──conflicts-with──> Full capability negotiation (deferred; see anti-features)
```

### Dependency Notes

- **Bounded dial timeout is a precondition for the handshake to mean anything**, not an optional robustness add-on: without it, a wedged/foreign first candidate never lets the client reach a healthy second candidate, which defeats the whole "fixed candidate order" discovery design.
- **Idle/heartbeat detection extends, rather than replaces, the already-built `socket.on("close")` release path** — the existing mechanism handles the easy 90% (clean disconnects); the new work is only the non-FIN 10%.
- **Incident-record-before-reclaim must never be conflated with the emulator-crash path** — these are two different failure origins (dead client vs. dead emulator) that happen to look similar at the reclaim moment; keeping them separate is what lets `vice_diagnose`'s verdict vocabulary keep meaning what it currently means.
- **Session labeling is a soft prerequisite for the wedge-triage doc update**, not a hard one — the triage skill can be updated to check `host_state.pid` today without labeling, but labeling is what turns "some other grant holds this" into "PROJECT X holds this," which is the actual new confusion this milestone creates.
- **Full capability negotiation conflicts with the hard version gate** in the sense that building both in one milestone is redundant scope — pick the hard gate for a clean-break major version, defer negotiation.

## MVP Definition

### Launch With (this milestone)

- [ ] Fixed control port, magic/version-tagged handshake, reusing the existing response envelope shape — required for both directions of version skew to fail legibly
- [ ] Bounded per-candidate dial timeout across the fixed candidate order — required or the "wrong process on the port" case (near-certain: a leftover v1.x broker on the same default port) can hang discovery
- [ ] Hard version gate: broker refuses an out-of-range client version by name with the exact remedy
- [ ] Stateless one-shot request path for skill scripts (open→send→receive→close, bounded timeout)
- [ ] Stateful connection-is-session path extending the existing connection-close-as-release mechanism
- [ ] Idle/heartbeat detection so a non-FIN client death still triggers reclaim
- [ ] Incident-record-before-reclaim wired into the abrupt-drop path, not just the explicit-recycle path
- [ ] File bytes over the socket for all six file-carrying tools plus Ghidra/dxa artifact paths, with sha256 integrity check, an explicit size cap with clean refusal, per-connection broker-side staging namespace, and cleanup after handoff
- [ ] Documented upgrade order and documented "what you see if you get it wrong" for both version-skew directions
- [ ] An explicit decision (not an assumption) on how the shared-secret/token survives the loss of `broker.json`

### Add After Validation

- [ ] Session labeling (project/cwd tag) surfaced in `status`, once real multi-project confusion is observed in practice
- [ ] Operator-only force-recycle escape hatch, once an orphaned-session incident is actually hit
- [ ] `vice-wedge-triage/SKILL.md` update teaching the broker-restart-affects-everyone case

### Future Consideration

- [ ] Full protocol capability negotiation, only if a later milestone needs incremental protocol evolution without another major version bump
- [ ] A thin `vice-broker status` CLI pretty-printer over the existing `status`/`host_state` ops

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Bounded per-candidate dial timeout | HIGH | MEDIUM | P1 |
| Hard version gate + refusal-by-name | HIGH | LOW–MEDIUM | P1 |
| Stateful connection-close reclaim (extend existing) | HIGH | MEDIUM | P1 |
| Idle/heartbeat non-FIN death detection | HIGH | MEDIUM | P1 |
| Incident-record-before-reclaim on drop | HIGH | MEDIUM | P1 |
| File hash + size cap + staging namespace + cleanup | HIGH | MEDIUM | P1 |
| Documented upgrade order / skew messaging | MEDIUM | LOW | P1 |
| Token/credential distribution decision (post-`broker.json`) | HIGH | MEDIUM | P1 |
| Session labeling in `status` | MEDIUM | MEDIUM | P2 |
| Operator force-recycle escape hatch | MEDIUM | MEDIUM | P2 |
| vice-wedge-triage doc update | MEDIUM | LOW | P2 |
| `vice-broker status` CLI wrapper | LOW | LOW | P3 |
| Full capability negotiation | LOW (for this milestone) | HIGH | P3 (deferred) |

**Priority key:** P1: required for the redesign to be correct and safe. P2: should follow once the redesign is live and real multi-project usage surfaces the gaps it's meant for. P3: nice to have or deliberately deferred.

## Sources

- `[codebase, HIGH]` `/home/henrik/dev/henrik/git/c64-re-tools/CLAUDE.md` — binmon single-client hazard, incident-record-before-recycle rule, never-auto-install/refuse-by-name convention, single-owner launch guard rationale
- `[codebase, HIGH]` `/home/henrik/dev/henrik/git/c64-re-tools/.planning/PROJECT.md` § Current Milestone v2.0.0 — goal, target features, decided/not-decided scope, measured blast radius
- `[codebase, HIGH]` `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-control.mts` — the existing control-plane protocol: framing, token gate, acquire/release/recycle/status/host_state/monitor_claim/monitor_release/host_tool, connection-close-as-release, FIFO pending-acquire fairness, `ownsTarget()`, default control port 19510
- `[codebase, HIGH]` `/home/henrik/dev/henrik/git/c64-re-tools/src/skills/vice-wedge-triage/SKILL.md` — the five-verdict diagnosis vocabulary, epoch/restart mechanism, `monitor_held_elsewhere` contention pattern this redesign must keep legible
- `[web, LOW–MEDIUM, uncurated]` general search results on TCP/TLS handshake negotiation and magic-byte conventions, stateful-connection session patterns (WebSocket/game-server framing), and Docker's daemon/CLI client-server split — used only as illustrative background for widely-known patterns already independently justified by the codebase citations above; no claim in this document rests on the web results alone

---
*Feature research for: v2.0.0 "One Broker, One Socket" — transport/deployment redesign of an existing MCP plugin*
*Researched: 2026-09-19*
