# Phase 62: The Fixed Endpoint and the Broker That Owns the Machine - Research

**Researched:** 2026-09-19
**Domain:** Node TCP control-plane protocol design, host network interface enumeration, npm CLI entry-point mechanics, systemd/launchd service definitions
**Confidence:** HIGH for code-shape claims (all read against HEAD this session); MEDIUM for the systemd/launchd content shape; LOW/ASSUMED flagged individually below

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-16, not open for re-litigation)

- **D-01**: Start command is `npx -y @henols/vice-mcp broker` — an invocation, not an install, carved out of the never-auto-install rule the same way `npx -y @henols/vice-mcp anno <verb>` already is. Reversibility: costly (quoted in 5 places).
- **D-02**: `broker` is a subcommand on the existing `vice-mcp` bin, mirroring `anno <verb>`, not a second bin entry.
- **D-03**: The Node-floor refusal needs a `.mjs` entry point — `vice-proxy.ts` is a `.ts` file and below Node 24 native type-stripping throws before any code in it runs, so a floor check written inside it can never execute. `VICE_BROKER_NODE` keeps its meaning. Reversible.
- **D-04**: `install-resources.ts` is obsolete (verdict recorded here; **deletion is Phase 66's work, not this phase's**). One-way reversibility once deleted.
- **D-05** (project-wide settled decision, not phase-scoped): Compatibility is "package major version must match." Not open for re-derivation.
- **D-06**: The handshake is a dedicated `hello` op, sent as the first line of every connection, becoming the 9th `ControlRequestKind`. Reply carries a magic string, the broker's package version, and the connection's tag (open-ended tag vocabulary — see Specific Ideas below).
- **D-07**: Both candidates are ALWAYS dialled; the first *completed* handshake wins; the refusal reports the most informative failure seen across both, ranked: (1) nothing listening, (2) foreign listener, (3) stale pre-v2.0.0 broker, (4) genuine broker, wrong version.
- **D-08**: The rootless-Docker disclosure is gated on a dial-observed condition (`host.docker.internal` resolved but connection failed), never on `isInsideContainer()`. MEDIUM-confidence, community-sourced, wording only — not a diagnosis.
- **D-09**: Interface-name allowlist: loopback plus `docker0`, `br-*`, `podman*`, `cni-*`. No env-override knob. Refuse only when the TOTAL bound set is empty (loopback itself failed), never merely because the bridge subset is empty (macOS has none, correctly).
- **D-10**: Bind set enumerated ONCE at startup, immutable for the process's life. No re-enumeration, no watch-and-warn.
- **D-11**: The stale `0.0.0.0` guidance is rewritten in Phase 62 (not Phase 66, despite `RM-04` still mapping to Phase 66 in the traceability table — reconcile at the ledger level, don't re-execute).
- **D-12**: Narrowing the bind changes an existing default and reddens two existing tests. This is an accepted in-phase cost, distinct from D-11 (comments) — a behavior change.
- **D-13**: Machine-level root is `~/.c64-re-tools/`, with an env override.
- **D-14**: `VICE_BROKER_HOME` is ONE new variable that supersedes `VICE_POOL_DIR` / `VICE_SUPERVISOR_DIR` / `VICE_INCIDENTS_DIR` / `VICE_EPOCH_FILE`, which keep working unchanged through the parallel period. Removing the four is UNOWNED work — no v2.0.0 requirement covers it; raise at roadmap level before Phase 66 absorbs it by inference.
- **D-15**: Service definitions ship as committed files (systemd `--user` unit + launchd plist) with README copy-paste steps; a CI grep gate asserts no module invokes `systemctl`/`launchctl`, copying the shape of the existing host-tool route gate. No `--print-unit` verb — D-01 makes it unnecessary since `npx -y @henols/vice-mcp broker` needs no machine-specific path.
- **D-16**: The warm floor is untouched this phase (deferred; sharper rationale recorded in CONTEXT.md's Deferred Ideas).

### Claude's Discretion (delegated, reasoning recorded in CONTEXT.md, disagree in writing if a planner finds cause)

| Decision | What was delegated |
|---|---|
| D-01 / D-02 / D-03 | Start command, CLI shape, Node-floor refusal location |
| D-04 | `install-resources.ts`'s verdict and deletion timing |
| D-06 | Handshake shape |
| D-07 | Candidate-failure handling and refusal ranking |
| D-08 | Rootless-Docker disclosure gate/wording |
| D-15 | Service-definition shape |
| D-16 | Whether the warm floor is this phase's work |

### Deferred Ideas (OUT OF SCOPE for this phase)

- The warm floor's rationale under a machine-level broker (D-16) — sharper case recorded, not this phase's work.
- Removing `VICE_POOL_DIR`/`VICE_SUPERVISOR_DIR`/`VICE_INCIDENTS_DIR`/`VICE_EPOCH_FILE` — unowned, D-14.
- `RM-04`'s traceability-table ownership reconciliation (D-11) — a bookkeeping fix, not code.
- Whether the broker start command joins `prerequisites.json` — **explicitly left for the researcher to weigh; see "Deferred Question" section below.**
- SESS-01..06 (Phase 63), XFER-01..08 (Phase 64), SEAM-01..03 (Phase 65), every deletion RM-01..08 (Phases 65-67), Podman ≥5.0 `pasta` (DEFER-01).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENDPOINT-01 | No file on disk; fixed port, `127.0.0.1` then `host.docker.internal`, first completed handshake wins | See "The two-candidate dial" — extends `openBrokerControl()`'s exact connect/timeout/settled pattern (`vice-broker-client.ts:1183-1265`), never reads `broker.json` |
| ENDPOINT-02 | Per-candidate timeout, independent | Same pattern: `setTimeout`+`unref()`+`settled` flag per socket, one instance per candidate, run concurrently not sequentially |
| ENDPOINT-03 | Handshake proves identity/version | New `hello` op (D-06) — see "The hello arm must bypass the token gate" finding below, this is the load-bearing correction to CONTEXT.md's "drops into the existing op switch" framing |
| ENDPOINT-04 | Refuse by name with exact start command | D-01's fixed string; see "Deferred Question" on whether it routes through `prerequisites.json`'s `withRemedy()` seam — recommendation: no, inline constant instead |
| ENDPOINT-05 | Version-skew refusal names which side to update | `hello` reply's `version` field vs client's own `version.ts`; D-05's major-match rule |
| BROKER-01 | One broker, host or devcontainer | Falls out of ENDPOINT-01..03; no BROKER-01-specific code beyond the dial+handshake |
| BROKER-02 | No client spawns the broker | Already true today (`ControlRequestKind` has no `spawn`/`start` op); this phase only needs to NOT add one |
| BROKER-03 | Bind loopback + enumerated bridge gateways, never `0.0.0.0`/hardcoded | See "Interface enumeration" — live `os.networkInterfaces()` shape captured on this host, D-09's allowlist against it |
| BROKER-04 | Refuse by name on port-already-held | `EADDRINUSE` — see "Port-already-held" section; **an almost-identical refusal already exists** at `vice-broker.mts:1320-1352` for the CONTROL port; extend/reuse it rather than inventing a second shape |
| BROKER-05 | Systemd `--user` unit + launchd plist, committed, never auto-applied | See "Service definitions" section; no prior art in this repo (`find` for `*.service`/`*.plist` returns nothing) |
| BROKER-06 | State off both `.c64-re-tools/`s, under machine-level root | D-13/D-14; `repo-root.ts:132` `repoRoot()`/`:276` `toolsDir()` are the functions to NOT reuse for broker-owned paths going forward — a parallel `VICE_BROKER_HOME`-rooted resolver is new code |

</phase_requirements>

## Summary

Everything this phase needs to extend already exists in a directly reusable shape: the framing (`writeLine()`/newline-delimited JSON), the connect-with-timeout pattern (`openBrokerControl()`), the EADDRINUSE port-conflict refusal (`vice-broker.mts`'s control-port startup), and the bind-one-host primitive (`bindControlListener()`). Verifying CONTEXT.md's own line citations against HEAD found them **exactly accurate everywhere except one**: the "BACK-05 D-G ordering" test CONTEXT.md and the project's own memory notes name as a testing trap no longer exists in the codebase — the fork backend it depended on was deleted in a separate cleanup (FORKRM-05), and the specific test was deleted with it (confirmed absent by exhaustive grep). The general *class* of trap (a live broker on the fixed port breaking a test that assumes none) remains real and is **more**, not less, dangerous for this phase, because this phase is the one that makes port 19510 a machine-wide, persistently-running fixture for the first time.

The single most consequential code-reading finding this session produced, not stated in CONTEXT.md: **the token gate in `broker-control.mts`'s `handleLine()` runs BEFORE the op dispatch, for every op, with no exception.** D-06's own reasoning ("`{"op":"hello"}` with no token returns `unauthorized`" as the stale-broker signature) is describing what an OLD broker's *identical* code does today — which means a NEW broker's `hello` arm cannot simply "drop into the existing op switch" as CONTEXT.md words it; it must be dispatched *before* `tokensMatch()` is ever called, or every `hello` (which by design carries no token) fails identically to what D-06 predicts only for a stale broker. This is a required restructuring, not an additive one-line insertion, and the planner needs to know it before writing tasks.

The second: `package.json`'s `bin`/`main` field points at `vice-proxy.ts` — a `.ts` file — and that file already has the identical latent problem for `anno` that D-03 raises for `broker` (both dispatch via `process.argv[2]` checks living *inside* a file the Node module loader cannot even parse below the type-stripping floor). D-02's "no second bin entry" and D-03's "give `broker` a `.mjs` entry" are only simultaneously satisfiable by **retargeting** the existing single bin/main field at a new, hand-authored, plain-JS entry file — not by adding a second npm `bin` key. This session found a strong precedent for exactly this shape already in the repo (`resources/vice-launcher.sh`, a hand-authored, never-generated script that resolves node, probes its version, and `exec`s into the real artifact) and a strong precedent for the placement (`test-gate.mjs`/`smoke.mjs`, hand-authored top-level `.mjs` files never added to `HOST_BOUND_ARTIFACTS`).

**Primary recommendation:** retarget `package.json`'s `bin`+`main` from `vice-proxy.ts` to a new hand-authored `src/mcp/vice/vice-cli.mjs` (plain JS, not compiled, not in `HOST_BOUND_ARTIFACTS`, added to the `files` array) that checks `process.versions.node` against the `engines.node` floor first, refuses by name if below, then dispatches: `argv[2] === "broker"` starts the broker (importing the compiled `resources/vice-broker.mjs` machinery), anything else dynamically `import()`s `vice-proxy.ts` unchanged — which, as a side effect, gives `anno` the SAME floor protection it currently lacks. Extend `startControlListener()`/`attachControlProtocol()` to dispatch `hello` before the token check, and to bind a SET of hosts (looping the existing `bindControlListener(host, port)` primitive) sharing ONE `pendingAcquires` queue rather than one per listener.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fixed-port dial + candidate ordering | Client (MCP server / skill script, `vice-broker-client.ts`) | — | The dial order IS the host/container detection per the phase goal; lives entirely client-side, no server participation beyond answering |
| `hello` handshake protocol | Broker (control plane, `broker-control.mts`) | Client (parses the reply) | The broker is the one place that can authoritatively state its own version/identity; the client only classifies what comes back |
| Interface enumeration + bind narrowing | Broker (host process, `vice-broker.mts`/`broker-control.mts`) | — | Only the host process can see the live interface list; a client cannot enumerate the broker's interfaces |
| Port-conflict refusal | Broker (startup) | — | Kernel-enforced (`EADDRINUSE`), inherently server-side |
| Machine-level state root | Broker (host process) | — | `~/.c64-re-tools/` is outside any project checkout; only the long-lived broker process, not a per-project client, should own it |
| Service supervision (systemd/launchd) | OS / Host | — | Out of process entirely; the project ships definitions, never invokes `systemctl`/`launchctl` itself (D-15) |
| `broker` CLI verb / Node-floor refusal | Client entry point (new `.mjs`, npm `bin`) | — | Runs before any broker or client code; a pure process-bootstrap concern |

## Standard Stack

No new external packages. This phase is built entirely on Node built-ins already in use elsewhere in this codebase:

| Module | Purpose | Already used at |
|--------|---------|------------------|
| `node:net` (`createServer`, `connect`) | Control-plane listener and dial | `broker-control.mts`, `vice-broker-client.ts` |
| `node:os` (`networkInterfaces`) | BROKER-03's live enumeration | Not yet used anywhere in `src/mcp/vice/` — new consumer, but a stdlib call, no package needed [VERIFIED: node:os is a Node built-in, confirmed by running it live on this host this session] |
| `node:crypto` (`randomBytes`, `timingSafeEqual`) | Existing token machinery, untouched this phase | `broker-control.mts` |
| `node:child_process` | Unaffected — broker still spawns `x64sc` via `broker-launch.mts`, untouched | `broker-launch.mts` |

**Version verification:** N/A — no npm packages added. `engines.node` stays `>=24.0.0` [VERIFIED: `src/mcp/vice/package.json:102-104`, read this session].

## Package Legitimacy Audit

**Not applicable.** This phase installs no external npm/PyPI/crates packages. Nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
CLIENT (MCP server on host, MCP server in devcontainer, or a skill script)
  │
  │  1. dial 127.0.0.1:19510  ──────┐
  │  2. dial host.docker.internal:19510 ──┐  (BOTH always dialled, D-07)
  │     each bounded by its OWN timeout    │
  ▼                                        ▼
[candidate 1 socket]                [candidate 2 socket]
  │  send {"op":"hello"}                │  send {"op":"hello"}
  │  (bypasses the token gate)          │  (bypasses the token gate)
  ▼                                        ▼
        first COMPLETED handshake wins (race, not a fallback chain)
                         │
                         ▼
              BROKER (one process, one machine)
   ┌─────────────────────────────────────────────┐
   │ startControlListener()                       │
   │   binds a SET of addresses on port 19510:    │
   │     - loopback (always)                      │
   │     - docker0/br-*/podman*/cni-* gateways     │
   │       (enumerated ONCE at startup, D-10)      │
   │   ONE shared pendingAcquires queue across     │
   │   every bound listener                        │
   │                                                │
   │   handleLine() per connection:                │
   │     op === "hello"  → answered BEFORE          │
   │                        tokensMatch() runs       │
   │     else            → existing token gate,      │
   │                        existing 8-arm dispatch  │
   │                        (untouched)               │
   └─────────────────────────────────────────────┘
                         │
                         ▼
        machine-level state root (~/.c64-re-tools/,
        VICE_BROKER_HOME override, D-13/14) —
        NOT inside either client project's own
        .c64-re-tools/
```

### Recommended Project Structure

No new directories. New files, all inside the existing `src/mcp/vice/` tree:

```
src/mcp/vice/
├── vice-cli.mjs          # NEW — hand-authored, plain JS, npm bin+main target,
│                         #   floor check, then dispatch broker | delegate-to-vice-proxy
├── broker-control.mts    # EDIT — 9th op `hello`, dispatched pre-token-gate;
│                         #   startControlListener() binds a HOST ARRAY
├── vice-broker-client.ts # EDIT — new two-candidate dial function (does NOT
│                         #   read broker.json; existing openBrokerControl()
│                         #   stays untouched, still broker.json-based)
├── vice-broker.mts       # EDIT — interface enumeration at startup, bind SET
├── resources/
│   ├── broker-control.mjs  # regenerated by `npm run build` (D-11 rewrite ships here too)
│   └── vice-broker.mjs     # regenerated by `npm run build`
├── systemd/                # NEW (or similar location, planner's choice)
│   └── vice-broker.service
└── launchd/
    └── com.henols.vice-broker.plist
```

### Pattern 1: The hello arm must bypass the token gate

**What:** `attachControlProtocol()`'s `handleLine()` (`broker-control.mts:701-928`) checks `tokensMatch(token, opts.token)` at line 717-723, **before** the `if (req.op === "host_tool")` chain begins at line 735. Every one of the 8 existing ops is unreachable without a valid token. A `hello` op added as a 9th `else if` in that same chain (as CONTEXT.md's "drops into the existing op switch" implies) would ALSO require a token — but `hello` by design carries none, so it would ALWAYS return `unauthorized`, indistinguishable from D-06's own stated stale-broker signature. That defeats the entire point of D-07's ranked outcome #3 ("connected, replies `unauthorized`... → a stale pre-v2.0.0 broker").

**When to use:** Any time a wire-protocol op must be answerable without the caller already holding a credential — which `hello`, by definition (it is what establishes trust), must be.

**Example (current code, read this session):**
```typescript
// Source: src/mcp/vice/broker-control.mts:701-723 (verified this session)
function handleLine(line: string): void {
  if (line.trim() === "") return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "malformed JSON line" });
    return;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "request must be a JSON object" });
    return;
  }
  const req = parsed as ControlRequest;

  // Token check BEFORE any state is read or written -- absence or
  // mismatch is refused, the connection is destroyed, and nothing is
  // allocated, spawned or signalled (T-01.6.2-01, T-01.6.2-03).
  const token = typeof req.token === "string" ? req.token : "";
  if (!tokensMatch(token, opts.token)) {
    writeLine(socket, { kind: "error", code: "unauthorized" as ControlErrorCode, message: "missing or invalid control token" });
    socket.destroy();
    return;
  }
  // ... op dispatch chain starts here, at line 735 ...
```
The fix shape: insert a `req.op === "hello"` branch **above** the token check (right after JSON parse/shape validation), so it is answered unconditionally, and leave every existing op's token requirement untouched below it.

### Pattern 2: Binding a SET of addresses needs one server per address, sharing state

**What:** `bindControlListener(host, port)` (`broker-control.mts:532-541`) creates exactly ONE `net.Server` bound to ONE host. `startControlListener()` (`broker-control.mts:919-928`) calls it once and then calls `attachControlProtocol(bound.server, opts, pendingAcquires)` once, with `pendingAcquires` a fresh array local to that one call. BROKER-03 requires binding potentially SEVERAL addresses (loopback + N enumerated bridge gateways) on the SAME port simultaneously. Node's `net.Server` has no multi-address `.listen()` — binding a set means calling `bindControlListener()` once PER address, producing N independent `Server` objects, each needing `attachControlProtocol()` attached — but they must NOT each get their own `pendingAcquires` array, or "acquire" fairness silently forks into per-listener silos (a client dialling via the bridge address would never see requests queued by a client that connected via loopback).

**When to use:** Any listener that must be reachable from more than one network path on a single logical service.

**Example (recommended restructuring, not yet in the codebase):**
```typescript
// Illustrative -- not existing code. Extends startControlListener()'s
// existing two-step shape (bind, then attach) to N binds sharing ONE queue.
export function startControlListenerOnHosts(hosts: string[], opts: StartControlListenerOptions): Promise<StartControlListenerResult[]> {
  const port = resolveControlPort(opts.port);
  const pendingAcquires: PendingAcquireQueue = []; // ONE queue, shared
  return Promise.all(
    hosts.map((host) =>
      bindControlListener(host, port).then((bound) => {
        attachControlProtocol(bound.server, opts, pendingAcquires); // same queue every time
        return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
      }),
    ),
  );
}
```

### Pattern 3: The existing EADDRINUSE refusal, directly reusable for BROKER-04

**What:** `vice-broker.mts:1320-1352` already implements "refuse by name at startup when the port is already held" for the CONTROL port specifically — and already distinguishes "another live broker legitimately holds it" (exit quietly, status 0) from "something else holds it" (fail loudly, status 1, naming the port and suggesting `lsof -i :<port>` / `ss -ltnp`). This is the exact shape BROKER-04 asks for; it needs generalizing to run per-address when binding a SET (Pattern 2), not reinventing.

**Example:**
```typescript
// Source: src/mcp/vice/vice-broker.mts:1338-1352 (verified this session)
const err = e as NodeJS.ErrnoException;
if (err.code === "EADDRINUSE") {
  const liveness = classifyBrokerLivenessLocal(finalPath);
  if (liveness === "alive") {
    process.stderr.write(
      `vice-broker: another broker is already running and holds control port ${controlPort} -- exiting quietly as a second instance (record: ${finalPath})\n`,
    );
    process.exitCode = 0;
    return;
  }
  process.stderr.write(
    `vice-broker: FATAL -- control port ${controlPort} is held by something that does not answer as a broker (discovery record classified "${liveness}"). ` +
      `Check what is bound to port ${controlPort} on the host (e.g. \`lsof -i :${controlPort}\` or \`ss -ltnp\`) before restarting. Record: ${finalPath}\n`,
  );
  process.exitCode = 1;
  return;
}
```
**Caveat for the planner:** this existing classification reads `broker.json` (the discovery file) to decide "alive" vs "stale" — which is fine to keep for now since `broker.json` is untouched this phase, but note that it is exactly the file the milestone's end-state (Phase 66) removes. A future phase's EADDRINUSE refusal will need to reclassify using the `hello` handshake instead (dial the port that just failed to bind, and if `hello` answers with a valid, version-compatible reply, it's a live sibling; otherwise it's a squatter). Not this phase's problem to solve, but worth a one-line comment where the reused code lands, so the next reader isn't surprised by the `broker.json` dependency.

### Interface enumeration — live-measured shape (BROKER-03/D-09/D-10)

Ran `os.networkInterfaces()` live on the actual development host this session (Node v24.20.0):

```json
// Actual output, this host, this session (abbreviated to the load-bearing entries)
{
  "lo": [
    { "address": "127.0.0.1", "family": "IPv4", "internal": true, "netmask": "255.0.0.0", "cidr": "127.0.0.1/8" },
    { "address": "::1", "family": "IPv6", "internal": true, "cidr": "::1/128" }
  ],
  "docker0": [
    { "address": "172.17.0.1", "family": "IPv4", "internal": false, "netmask": "255.255.0.0", "cidr": "172.17.0.1/16" },
    { "address": "fe80::c440:f4ff:feab:ff65", "family": "IPv6", "internal": false, "cidr": "fe80::.../64" }
  ],
  "vethb98b6d9": [ /* per-container veth pair, IPv6 link-local only -- NOT in D-09's allowlist, correctly excluded by name */ ],
  "wlp0s20f3": [ /* the host's own LAN interface -- NOT in D-09's allowlist, correctly excluded */ ]
}
```
[VERIFIED: live `os.networkInterfaces()` output, this host, this session — see the raw JSON dump captured during research]

**Shape to match:**
- Top-level key = interface name (exactly the string D-09's allowlist matches against: `docker0`, `br-*`, `podman*`, `cni-*`).
- Each value is an ARRAY of address records (a `docker0`-named interface here carries BOTH an IPv4 and an IPv6 entry — the allowlist match is on the interface NAME, the family filter (IPv4 for a bind address) is a separate, second filter over that interface's array).
- `internal: true` is the loopback flag — `lo`'s BOTH entries (v4 and v6) carry it; every other interface observed here carries `internal: false`.
- Loopback identification for BROKER-03 should key on `internal === true`, not on the interface name `lo` (which is `lo0` on macOS/BSD) — this is the portable signal.
- Bridge-candidate identification is a NAME match (`docker0`/`br-*`/`podman*`/`cni-*`) against interfaces where `internal === false`, filtered to `family === "IPv4"` (a bridge gateway address for Docker/Podman purposes is always IPv4; matching the IPv6 link-local entry too would bind an address with no real routing purpose here and complicate the refuse-on-empty-set logic for no benefit).
- **D-09's macOS case cannot be verified on this Linux host** — [ASSUMED, per CONTEXT.md's own citation] that Docker Desktop on macOS runs in a VM with no host-side bridge interface, so `os.networkInterfaces()` there returns no `docker0`/`br-*`/`podman*`/`cni-*` entries at all, and the bind set is loopback-only. This matches the general macOS Docker Desktop architecture (Docker Desktop's VM does NAT translation for `host.docker.internal`, not a host bridge) but was not independently measured this session (no macOS host available).
- `veth*` interfaces (one per running container, ephemeral) are correctly excluded by D-09's allowlist — confirmed live: this host has 3 active `veth*` entries from running containers, none matching `docker0`/`br-*`/`podman*`/`cni-*`.

### Port-already-held refusal — the exact error shape (BROKER-04)

Reproduced live this session:
```
code: EADDRINUSE syscall: listen port: 19599 address: 127.0.0.1
```
[VERIFIED: reproduced live this session by binding a second `net.Server` to an already-bound port]

- The error surfaces on the **`"error"`** event of the `net.Server` returned by `createServer()`, as a `NodeJS.ErrnoException` with `.code === "EADDRINUSE"`, `.syscall === "listen"`, `.port`, and `.address` fields populated.
- This is ALREADY the exact pattern this codebase's own `defaultPortInUse()` (`broker-state.mts:390-400`, reads `err.code === "EADDRINUSE"` on `server.once("error", ...)`) and `vice-broker.mts:1338` (Pattern 3 above) both use — no new detection technique needed.
- **Interaction with binding a SET (Pattern 2):** a partial failure (loopback binds, one bridge address's `listen()` throws `EADDRINUSE` or any other error) is NOT the same as the whole set failing. D-09's "refuse only when the TOTAL bound set is empty" wording, read together with this, implies: loopback failing to bind is always fatal (mirror Pattern 3's existing refusal verbatim); a SPECIFIC bridge candidate failing to bind (for any reason, including but not limited to `EADDRINUSE`) should be logged and the broker should continue with the reduced set, never treated as fatal on its own — only an entirely empty TOTAL set (which, per D-09, can only happen if loopback itself failed, since a bridge subset being empty is a legitimate steady state on macOS) is fatal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connect-with-timeout to a candidate host | A new retry/timeout primitive | The existing `settled`-flag + `setTimeout(...).unref()` + `once("connect")`/`once("error")` pattern in `openBrokerControl()` (`vice-broker-client.ts:1183-1263`) | Already handles the double-resolve race (timer vs socket event) correctly; a second hand-rolled version risks reintroducing that race |
| Loopback/wildcard-bind classification | A new regex or string-equality check | `classifyConnectHost()` / `isLoopbackConnectHost()` / `isWildcardBindHost()` (`vice-broker-client.ts:237-259`) | Already handles bracketed IPv6, fully-expanded IPv6 zero forms, and `localhost` — a second classifier risks missing a spelling this one already covers |
| Port-in-use detection | A `lsof`/`ss` shell-out | `EADDRINUSE` on the server's `"error"` event, exactly as `defaultPortInUse()`/`vice-broker.mts:1338` already do | Kernel-enforced, no subprocess, no parsing of shell tool output |
| Node-version floor check | Spawning `node --version` as a subprocess (the bash launcher's approach, needed there because bash cannot introspect a foreign interpreter) | `process.versions.node` directly — the NEW entry point IS already running under some Node, so no subprocess is needed, unlike `vice-launcher.sh`'s bash context | Simpler, no subprocess, and the exact interpreter being checked is the one already running |

**Key insight:** every low-level primitive this phase needs (bind-a-host, connect-with-timeout, classify-a-host-string, detect-port-in-use) already exists in this codebase in a form this phase's requirements can extend directly. The work is almost entirely in ORCHESTRATING these primitives across a new dimension (a SET of hosts instead of one, a race between two independent dial attempts instead of one), not in writing new low-level network code.

## Common Pitfalls

### Pitfall 1: Reading CONTEXT.md's "drops into the existing op switch" too literally
**What goes wrong:** A planner writes a task that adds `hello` as one more `else if` in the existing chain, discovers in testing that `hello` always returns `unauthorized`, and either (a) is confused because this looks identical to the "stale broker" signature D-06 itself defines, or (b) "fixes" it by having the CLIENT send a fake/empty token — quietly reintroducing a client-side workaround for a server-side gating bug.
**Why it happens:** CONTEXT.md's own wording says "drops into the existing op switch" without flagging that the token gate runs BEFORE that switch.
**How to avoid:** Insert the `hello` branch before the `tokensMatch()` call (see Pattern 1). Write a test that calls `hello` with NO token field at all against a live-started (new) broker and asserts a real handshake reply, not `unauthorized`.
**Warning signs:** A hello-handshake integration test that passes a token to satisfy it — that is masking the exact defect this pitfall describes.

### Pitfall 2: Assuming `startControlListener()` can be called N times for N hosts with no other change
**What goes wrong:** A planner loops `startControlListener({ host: candidate, ... })` once per bind address, and gets N servers each with its OWN `pendingAcquires` array — arrival-ordered fairness across the whole broker silently breaks, and pending acquires queued via one bound address never drain when a slot frees up on another.
**Why it happens:** `startControlListener()`'s signature (`host?: string`) and its internal `pendingAcquires: PendingAcquireQueue = []` (line 921) both assume ONE listener per call; nothing in the type signature warns that calling it twice produces two independent queues.
**How to avoid:** Restructure per Pattern 2 — one shared `pendingAcquires`, N calls to the lower-level `bindControlListener()`+`attachControlProtocol()` pair instead of N calls to `startControlListener()` itself.
**Warning signs:** A test with two simultaneous acquires arriving on different bound addresses that observes them served out of arrival order.

### Pitfall 3: Writing a new hello/dial test that hardcodes port 19510
**What goes wrong:** The test passes in isolation but fails — or worse, silently connects to and mutates the state of — a REAL broker already running on the developer's machine, since BROKER-01..06's whole point is that a persistent, machine-wide broker on this exact port is now the expected steady state (unlike before this phase, when a live broker on 19510 was an occasional, not a default, condition).
**Why it happens:** The convenience of not having to plumb a port override through a new test.
**How to avoid:** Every existing broker-lifecycle test in this codebase (`broker-e2e.test.ts`, `broker-control.test.ts`, `vice-broker-launch.test.ts`, `broker-kill.test.ts`, `stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `stock-live-broker-monitor.test.ts` — 7 files, confirmed by grep this session) already sets `VICE_BROKER_CONTROL_PORT: "0"` to get an OS-assigned ephemeral port. Follow the identical convention for every new test this phase adds; for tests of the CLIENT-side two-candidate dial specifically, inject a stub server's actual bound `.address().port` rather than assuming 19510.
**Warning signs:** A test file with the literal string `19510` anywhere in it, other than a test that explicitly asserts the PRODUCTION DEFAULT is 19510 (which is legitimate and should exist exactly once, per `resolveControlPort()`'s own default).

### Pitfall 4: Citing "BACK-05" as a currently-live testing trap
**What goes wrong:** A planner writes a verification step that says "confirm the BACK-05 D-G ordering test still passes" — but that test no longer exists (see "Verification of CONTEXT.md's cited line numbers" below), so the step is either a silent no-op (if it greps for a test name that no longer matches anything) or blocks on a false premise.
**Why it happens:** The project's own memory notes, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`, and the pending todo file all still describe this test as live; none of them have been corrected since the fork-backend removal (FORKRM-05) deleted it.
**How to avoid:** Treat the GENERAL class of trap (a live broker interferes with a test assuming none) as real and design new tests defensively (Pitfall 3), but do not write a verification step that names the specific deleted test by name or line number.
**Warning signs:** Grepping `src/mcp/vice/vice-proxy.test.ts` for `"BACK-05"` or `"D-G ordering"` returns nothing — confirmed this session (file is 3723 lines total; the historically-cited `:6382`/`:6421` line numbers do not exist in a file this short).

## Code Examples

### The existing connect-with-timeout pattern to extend for the two-candidate dial

```typescript
// Source: src/mcp/vice/vice-broker-client.ts:1183-1263 (verified this session,
// this is openBrokerControl() -- reads broker.json, which the new dial must NOT do,
// but the connect/timeout/settled machinery below is exactly reusable)
let settled = false;
const socket = connect({ host, port });

const connectTimer = setTimeout(() => {
  if (settled) return;
  settled = true;
  socket.removeListener("connect", onConnect);
  socket.removeListener("error", onError);
  socket.destroy();
  resolvePromise({ ok: false, kind: "connect_refused", message: `...within ${connectTimeoutMs}ms`, target: `${host}:${port}` });
}, connectTimeoutMs);
if (typeof connectTimer.unref === "function") connectTimer.unref();

function onConnect(): void {
  if (settled) return;
  settled = true;
  clearTimeout(connectTimer);
  socket.removeListener("error", onError);
  resolvePromise({ ok: true, session: createSession(socket, token as string) });
}
function onError(err: Error): void {
  if (settled) return;
  settled = true;
  clearTimeout(connectTimer);
  socket.removeListener("connect", onConnect);
  resolvePromise({ ok: false, kind: "connect_refused", message: `...${err.message}`, target: `${host}:${port}` });
}
socket.once("connect", onConnect);
socket.once("error", onError);
```
For the two-candidate dial, this same shape runs TWICE concurrently (once per candidate, `Promise.race`-shaped but NOT a simple race — per D-07 both must be allowed to complete so the failure ranking can consider both outcomes even when candidate 1 fails first). On `onConnect`, write `{"op":"hello"}\n` (no token) instead of assuming a grant flow, and classify the reply per D-07's four-outcome ranking.

### Existing test convention for ephemeral control ports

```typescript
// Source: src/mcp/vice/broker-e2e.test.ts:95 (verified this session, one of 7 sites using this exact convention)
VICE_BROKER_CONTROL_PORT: "0",
```
`resolveControlPort()` (`broker-control.mts:419-424`) passes `"0"` through `Number("0")` = `0`, which `net.Server.listen(0, host)` interprets as "OS, pick an ephemeral port" — the returned `AddressInfo.port` (already read at `bindControlListener()`'s `resolvePromise({ ..., port: boundPort, ... })`, line 538) gives the test the real bound port to dial.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-project host-launcher deployment (`install-resources.ts` deploying `resources/*` into `.c64-re-tools/bin/`) | One machine-level broker, started once, found via fixed-port dial | This phase (verdict recorded, deletion in Phase 66) | `install-resources.ts`, `repo-root.ts:59`/`:303`'s side-effect call, and `VICE_SKIP_RESOURCE_INSTALL` all become dead code walking — untouched this phase but no longer load-bearing |
| Broker bind `0.0.0.0` + per-boot token as the security model | Bind narrowed to loopback + enumerated bridge gateways, no token | Reversal decided 2026-09-19 (project-wide settled decision 5) | The header comments in `broker-control.mts:20`, `resources/broker-control.mjs:26`, `vice-broker-client.ts:195-197`, `vice-errors.ts:51` all teach the REVERSED (old) rule as of HEAD — D-11 rewrites 4 of these 5 sites this phase; `vice-proxy.ts:820` is prose to check in the same pass but is not one of the 4 "production sites" D-11 names |
| Fork backend / single-backend | Stock-only backend | Already complete (FORKRM-05, prior milestone) | The "BACK-05" test this phase's own testing-trap folklore refers to no longer exists — see Pitfall 4 |

**Deprecated/outdated:**
- `resources/vice-launcher.sh`'s `--repo-root` argument and the per-project deployment model it serves: strongly implied dead by this phase's own D-01 (an npx invocation needs no path at all), formally verdicted D-04, deletion deferred to Phase 66.
- `.planning/codebase/TESTING.md`'s "Trap 4" section: the document itself carries a "SUPERSEDED note (2026-09-12)" at its own top, and this session confirms the specific test it describes is gone, not merely renamed.

## Deferred Question: Should `npx -y @henols/vice-mcp broker` join `prerequisites.json`?

**Recommendation: No — inline the constant, do not extend the schema.**

Read `src/mcp/vice/prerequisites.json` in full this session (416 lines, 7 tool records: `x64sc`, `c1541`, `petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`). Read `src/mcp/vice/prereq-readme-gen.ts` (its exported surface: `regionMarkers`, `readDeclarationFile`, `deriveEcosystemRows`, `renderEcosystemTable`, `deriveOverviewRows`, `renderOverviewTable`, `writeGeneratedRegions`, `findRepoRoot`, and the constants `REGENERATE_COMMAND = "npm --prefix src/mcp/vice run generate:readme"`, `VICE_PACKAGE_TOOL_IDS`, `FILE_ONLY_OVERRIDE = ".c64-re-tools/tools.json"`). Read `src/mcp/vice/prerequisites.test.ts` lines 60-100 and 380-405, and `docs/phase58-declaration-provenance.md`.

**Two structural facts, both `[VERIFIED: src/mcp/vice/prerequisites.test.ts]`, decide this:**

1. **The `kind` field is a closed TypeScript union with exactly two members**, verified at `prerequisites.test.ts:67`: `kind?: "executable" | "directory";`, and enforced at `prerequisites.test.ts:222`: `if (kind !== "executable" && kind !== "directory") { ... }` (a validation failure branch). A machine-level, long-running TCP listener a user starts with a command is neither a locatable executable file nor a directory — fitting it in would require widening this union to a third value (e.g. `"service"`), a schema change with its own blast radius across `deriveOverviewRows()`/`renderOverviewTable()`, both of which branch on `kind` to decide what "location" text to print.
2. **The `location` schema (`envVar`/`fileOverridable`/`reason`) assumes a filesystem-locatable thing.** Every existing record's `location` answers "where on disk is this" — `x64sc`'s `envVar: "VICE_BIN"`, `ghidra`'s `envVar: "GHIDRA_HOME"`, even `node`'s own record (`prerequisites.json:370-378`) frames its location as "an executable file, `fileOverridable: false`, because `vice-launcher.sh` is bash and reads `VICE_BROKER_NODE` before any working Node exists to parse JSON with." A broker's "location" is a TCP port on a specific machine at a specific moment — not a filesystem fact this schema's `location` concept was built to express.

**The counter-argument, and why it doesn't overcome the schema mismatch:** the `node` record IS already a precedent for something that isn't a strictly-third-party tool (it's the runtime itself, and its remedy text is tagged `"provenance": "carried"` from `vice-launcher.sh:219` rather than independently discovered) — softening CONTEXT.md's framing that "every other record is an external tool the user installs." But `node`'s `kind` is still `"executable"` because Node's own binary genuinely IS a locatable file; the broker is not comparably locatable, it is a live process on a port. `DECL-04`'s own rule (`prerequisites.test.ts:389`: "exactly one record may carry a `versionFloor` field, and it must be the `node` record") shows this file's schema is already deliberately narrow and asserted so by a named test — adding a second irregular shape to accommodate `broker` works against that narrowness rather than with it.

**Also weighing against joining:** the user's own standing principle, cited in CONTEXT.md's own canonical_refs from the immediately-prior phase — "a tool that needs something absent says so at the point of use, not through a doctor or pre-flight check" — and the project's independently-recorded preference against growing any doctor/check/verify pre-flight surface. `ENDPOINT-04`'s refusal already fires at the exact point of use (a failed dial), which is the point-of-use shape this principle asks for; routing it through the generated-README/`withRemedy()` machinery would be adding a pre-flight-flavored indirection to a refusal that is already correctly triggered by a real-time observation (nothing answered), not an absence check.

**Recommendation in one line:** export the start-command string as a single well-named constant (e.g., `export const BROKER_START_COMMAND = "npx -y @henols/vice-mcp broker";` in whatever module owns the dial/refusal logic) and reference it from the 5 places D-01's own reversibility note names (the refusal, README, both service definitions, the "universal fallback" doc line) — a `git grep` for the constant name is sufficient to keep the 5 sites from drifting, without a schema change to a file whose narrowness is itself asserted by a named test.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | macOS Docker Desktop's VM architecture means `os.networkInterfaces()` there returns no `docker0`/`br-*`/`podman*`/`cni-*` entries at all (D-09's "no bridge candidate on macOS is correct" premise) | Interface enumeration | If wrong, the "refuse only when TOTAL set is empty" logic could refuse a macOS broker that in fact has a bindable bridge candidate it's ignoring, or (less likely) bind an unexpected interface. Low risk since D-09 already names this as the owner's own accepted premise, not something this research introduces. |
| A2 | The systemd `--user` unit and launchd plist content sketched (not fully written — left to the planner) follow the general shapes found via web search (freedesktop.org systemd.unit docs, Apple/thoughtbot launchd examples) rather than a project-specific precedent, since no `.service`/`.plist` file exists anywhere in this repo to mirror | Service definitions (BROKER-05) | Low risk — these are well-documented, stable OS mechanisms; the main project-specific risk is `Environment=VICE_BROKER_NODE=...` needing the RIGHT absolute path pattern, which the planner should verify against the actual `%h`/`$HOME` expansion rules for the target `systemd`/`launchd` versions at implementation time. |
| A3 | A hand-authored `vice-cli.mjs` (not compiled by `build.ts`, not in `HOST_BOUND_ARTIFACTS`) is the right shape for D-03's `.mjs` entry, by analogy to `test-gate.mjs`/`smoke.mjs` (hand-authored, top-level, never compiled) and `resources/vice-launcher.sh` (hand-authored, never generated) | Summary / Recommended Project Structure | Medium — this is a genuine design recommendation, not a settled decision (D-02/D-03 leave the exact mechanic open). If the planner disagrees, the alternative (compiling it via `build.ts` as a 12th `HOST_BOUND_ARTIFACT`) is also viable but requires the source to be `.mts` rather than plain `.mjs`, and would need to live in `resources/` rather than at the top level to be deployed automatically — a real tradeoff, not a research gap. |

## Open Questions

1. **Does the new `vice-cli.mjs` entry point need to also change how `.mcp.json`'s direct `node .../vice-proxy.ts` invocation works?**
   - What we know: `.mcp.json:3-4` (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts"]`) [VERIFIED: `.mcp.json`, read this session] invokes `vice-proxy.ts` DIRECTLY, bypassing `package.json`'s `bin`/`main` entirely.
   - What's unclear: whether this plugin-launch path is expected to ever gain the same Node-floor protection, or whether it's accepted as already requiring a satisfactory Node on PATH (the plugin/devcontainer environment is presumably provisioned to already meet `engines.node`).
   - Recommendation: leave `.mcp.json` untouched this phase — D-03's stated problem is specifically about the PUBLISHED npm package's `bin` entry (reached via `npx`), not the plugin's direct invocation. Flag if a future phase wants floor protection there too.

2. **Where exactly do the two committed service-definition files live (`systemd/`, `launchd/`, or beside `resources/`)?**
   - What we know: D-15 requires them committed and never auto-applied, with a CI grep gate. No existing directory convention in this repo for OS service files.
   - What's unclear: the planner's preferred location — this is a naming/organization decision with no functional consequence researched here.
   - Recommendation: any location works structurally; `src/mcp/vice/service/` (systemd unit + launchd plist together) keeps them beside the code that documents starting them, consistent with this project's "one module/one seam" convention extended to non-code artifacts.

3. **Does the CI route gate (D-15) need a brand-new test file, or can it extend an existing structural-scan test?**
   - What we know: this session could not locate one single existing test file that scans the WHOLE tree for a forbidden `spawnSync`/`execFileSync` argument (the closest analogs found were `hostpath-consumers.test.ts`'s closed-import-consumer-set scan, and scattered `assert.doesNotMatch(source, /pattern/)` structural assertions inside `vice-proxy.test.ts`).
   - What's unclear: whether a "host-tool route gate" test CONTEXT.md refers to exists under a name this session's searches missed, or whether "the same shape as the project's existing host-tool route gate" is describing the GENERAL pattern of grep-based structural absence tests (of which several exist) rather than one specific file.
   - Recommendation: the planner should grep for `execFileSync\(|spawnSync\(|spawn\(` combined with `"systemctl"|"launchctl"` across the whole tracked tree (mirroring `hostpath-consumers.test.ts`'s comment-stripping discipline and using `grep -a` per the NUL-byte caveat below) as a NEW small test file if no existing one is found at implementation time — this is a low-risk, mechanical test to write from scratch if needed.

## Verification of CONTEXT.md's cited line numbers (drift check, as required by the research brief)

Every specific `file:line` citation in CONTEXT.md's `<canonical_refs>` and `<decisions>` sections was re-read against HEAD this session. Results:

| Citation | Status |
|----------|--------|
| `broker-control.mts:57` (`ControlRequestKind`) | **Exact match** |
| `broker-control.mts:64` (`ControlErrorCode`) | **Exact match** (block starts line 64, closes line 71) |
| `broker-control.mts:419` (`resolveControlPort`) | **Exact match** |
| `broker-control.mts:532` (`bindControlListener`) | **Exact match** |
| `broker-control.mts:920` (`VICE_BROKER_CONTROL_HOST ?? "0.0.0.0"`) | **Exact match** |
| `broker-control.mts:20` (stale bind comment) | **Exact match** |
| `vice-broker-client.ts:195-197` (quoted rule) | **Exact match** |
| `vice-broker-client.ts:239` (wildcard matcher) | **Exact match** |
| `vice-broker.mts:1134` (second `0.0.0.0` default) | **Exact match** |
| `install-resources.ts:100/122/539` | **Exact match**, all three |
| `repo-root.ts:59` and `:303` | **Exact match**, both |
| `resources/vice-launcher.sh:135` | **Exact match** |
| `resources/vice-launcher.sh:287` | **Exact match** (file is exactly 287 lines; this is the final line) |
| `vice-errors.ts:51` | **Exact match** |
| `vice-proxy.ts:820` | **Exact match** |
| `resources/broker-control.mjs:26` | **Exact match** |
| `broker-e2e.test.ts:364` | **Exact match** |
| `vice-broker-launch.test.ts:231` | **Exact match** |
| `vice-proxy.test.ts:6382` (the BACK-05 test, cited in the folded todo, NOT in 62-CONTEXT.md's own body) | **STALE — does not exist.** File is 3723 lines total. Confirmed by direct grep: neither `"BACK-05"` nor `"D-G ordering"` nor `"DENY_LIST still wins"` (the test's full historical name, per `.planning/phases/55-.../55-03-SUMMARY.md`) appears anywhere in the current file. The test, and the `VICE_BACKEND: "stock"` vs `fork` mismatch guard it exercised, were deleted in the FORKRM-05 cleanup (single-backend consolidation, prior milestone) — see Pitfall 4. |

**Net assessment: CONTEXT.md's own line citations (the ones it states directly, in `<canonical_refs>` and `<decisions>`) have NOT drifted at all** — every one checked exact. The single stale citation found (`vice-proxy.test.ts:6382`) originates from the FOLDED TODO file and the project's own `TESTING.md`/`CONCERNS.md`/memory notes, not from CONTEXT.md's own line-cited claims, and CONTEXT.md itself does not repeat that specific line number anywhere in its body — it only folds the todo "for awareness." The planner should treat CONTEXT.md's own citations as reliable and should NOT carry the BACK-05 test's specific location forward into any plan or verification step.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node:test`), no third-party runner [VERIFIED: `src/mcp/vice/package.json:132-134`] |
| Config file | None — `test-gate.mjs` (hand-authored) is the automated-suite selector, not a framework config |
| Quick run command | `node --test broker-control.test.ts` (or whichever single new/edited file, per this project's colocated-test convention) |
| Full suite command | `npm test` (`node --test '*.test.*'`) — runs EVERYTHING including the 12 `MANUAL_ONLY_TESTS` files; confirmed measured green twice at commit per user's own standing memory note (no longer hangs) |

**Critical gate-composition fact, verified this session:** `test:automated` (`node test-gate.mjs`, [VERIFIED: `src/mcp/vice/package.json:133`]) runs `automatedTestFiles()`, which is `readdirSync` filtered to EXCLUDE the 12-member `MANUAL_ONLY_TESTS` array [VERIFIED: `src/mcp/vice/test-gate.mjs:141-155`, read this session — the frozen array is: `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`]. **`broker-e2e.test.ts` and `vice-broker-launch.test.ts` — the two files D-12 says this phase reddens — are BOTH in this exclusion list.** CI's `npm run test:automated` gate will NOT catch a regression in either assertion. The planner MUST include an explicit verification step running `node --test broker-e2e.test.ts vice-broker-launch.test.ts` (or the full `npm test`) to confirm the D-12 assertion updates actually land, since the automated CI gate structurally cannot see them.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENDPOINT-01 | Two candidates dialled, first completed handshake wins, no disk read | unit/integration | `node --test vice-broker-client.test.ts` (new cases) | ❌ Wave 0 — new test cases needed |
| ENDPOINT-02 | Per-candidate independent timeout; a wedged candidate 1 does not block candidate 2 | integration | Same file, a case using a stub server that accepts but never replies on candidate 1 | ❌ Wave 0 |
| ENDPOINT-03 | `hello` distinguishes genuine broker from foreign listener from stale broker | unit | `node --test broker-control.test.ts` (new `hello` cases) + client-side classification cases | ❌ Wave 0 |
| ENDPOINT-04 | No-broker-found refusal names the exact start command | unit | Assert the refusal message contains the `BROKER_START_COMMAND` constant verbatim | ❌ Wave 0 |
| ENDPOINT-05 | Version-skew refusal names which side to update | unit | Stub a `hello` reply with a mismatched major version, assert both package names/versions appear | ❌ Wave 0 |
| BROKER-01 | One broker serves host + devcontainer clients | integration (real spawned broker, `VICE_BROKER_CONTROL_PORT: "0"`) | `node --test broker-e2e.test.ts` (new case) | ✅ file exists, new case needed |
| BROKER-02 | No client spawns the broker | structural | Grep-based: no client-side module calls `spawn`/`fork` with a broker artifact path | Partially covered — extend existing structural pattern |
| BROKER-03 | Bind narrowing, real interface enumeration | integration (needs `docker0` present — CI runner has one per this session's own live measurement showing this dev host does; verify CI runner too) | `node --test vice-broker.test.ts` (new cases, injecting a fake `os.networkInterfaces()` via this codebase's existing "accepts an injectable override" convention) | ❌ Wave 0 |
| BROKER-04 | Port-already-held refusal | integration | Bind the port externally first, then start broker, assert exit code + message — mirror `broker-control.test.ts:1334-1350`'s EXISTING singleton-collision test shape | ✅ existing analog to extend |
| BROKER-05 | Committed service files, CI gate on non-invocation | structural | New grep-based test (see Open Question 3) | ❌ Wave 0 |
| BROKER-06 | State under machine-level root, not either project's `.c64-re-tools/` | unit | Assert the new resolver's output path does NOT start with either of two distinct temp `toolsDir()` paths | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single edited/new test file, via `node --test <file>` directly (NEVER via `npm run test:automated` alone for `broker-e2e.test.ts`/`vice-broker-launch.test.ts` edits — see the critical gate-composition fact above).
- **Per wave merge:** `npm test` (full glob, all `*.test.*`, including manual-only) — per user's own standing memory this no longer hangs and was measured green twice; do not substitute `test:automated` as a stand-in for a full green baseline on this phase.
- **Phase gate:** `npm test` green (not `test:automated`) is required before `/gsd-verify-work`, specifically because this phase's two known-reddened assertions (D-12) live in files `test:automated` excludes.

### Wave 0 Gaps
- [ ] New `hello`-op test cases in `broker-control.test.ts` — no existing case exercises a 9th op or the pre-token-gate dispatch this phase requires.
- [ ] New two-candidate dial test cases in `vice-broker-client.test.ts` (confirm this file exists; if the dial function is genuinely new, a new colocated `*.test.ts` may be needed instead).
- [ ] New interface-enumeration test cases with an injectable `os.networkInterfaces()` override (the codebase's own "accepts an injectable override" convention for anything touching env/time/spawning/I-O applies here — `os.networkInterfaces` is exactly such an I/O call).
- [ ] New structural test for the D-15 CI route gate (systemd/launchctl non-invocation) — no existing file found matching this exact shape this session.
- [ ] Framework install: none — `node:test` is already fully wired.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (by design) | D-05 project-wide decision: the per-boot token is dropped for the NEW `hello`/dial model; bind narrowing (V4) is the replacement control, not a credential |
| V3 Session Management | No | Out of scope this phase (SESS-01..06 is Phase 63) |
| V4 Access Control | Yes | Network-level access control via bind restriction: loopback + enumerated bridge gateways ONLY, never `0.0.0.0`, never a routable LAN address — BROKER-03 IS the access-control mechanism |
| V5 Input Validation | Yes | The existing never-throw parse discipline (`handleLine()`'s try/catch around `JSON.parse`, `typeof parsed !== "object"` guard) already covers this; the new `hello` reply parsed client-side must follow the SAME discipline — treat an unknown listener's bytes as untrusted input exactly as `vice-broker-client.ts`'s header comment already states ("A `hello` reply from an unknown listener is untrusted input by the same standard") |
| V6 Cryptography | No | No credential, no signature, no hash beyond the EXISTING `timingSafeEqual` token comparison (untouched, still used by the 8 legacy ops) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A foreign process squats port 19510 and answers connections | Spoofing | The `hello` magic string + version check (ENDPOINT-03) — a bare TCP accept proves nothing about who is listening, which is exactly why the roadmap's own notes flag the stale-broker collision as "near-certain during upgrade rather than hypothetical" |
| A malicious/malformed `hello` reply from an unexpected listener crashes the dialling client | Denial of Service | Never-throw parsing discipline (V5 above) — every field read from an unsolicited reply must be type-checked before use, matching this codebase's existing `vice-broker-client.ts` never-cache-a-negative-result / try-catch-every-untrusted-read pattern |
| Binding `0.0.0.0` exposes the control plane to the LAN | Information Disclosure / Elevation of Privilege | BROKER-03's enumerated bind set is the direct mitigation — this is precisely the vulnerability class the D-05 reversal exists to close (the OLD `0.0.0.0`+token model relied on the token as the only barrier; the NEW model makes the network path itself the barrier) |
| A bridge address bound today disappears/changes when Docker restarts, and the broker's stale bind silently continues listening on an address no longer meaningful | Tampering (of the trust boundary, not data) | D-10's explicit non-goal (no re-enumeration) accepts this as a documented tradeoff — requires a broker restart, not code; the security posture depends on this being DOCUMENTED prominently in the refusal/README text, not silently degraded |

## Sources

### Primary (HIGH confidence — read against HEAD this session)
- `src/mcp/vice/broker-control.mts` — full file read in sections (header, `ControlRequestKind`/`ControlErrorCode`, `resolveControlPort`, `bindControlListener`, `attachControlProtocol`/`handleLine` in full, `startControlListener`)
- `src/mcp/vice/vice-broker-client.ts` — `resolveControlTarget`, `classifyConnectHost`/`isWildcardBindHost`/`isLoopbackConnectHost`, `acquireOverControlPlane`, `openBrokerControl` read in full
- `src/mcp/vice/vice-broker.mts` — startup banner/control-host default, EADDRINUSE handling (lines ~1120-1360)
- `src/mcp/vice/vice-errors.ts`, `vice-proxy.ts` (dispatch block + line 820 area), `repo-root.ts` (full), `install-resources.ts` (function signatures), `resources/vice-launcher.sh` (full file), `resources/broker-control.mjs` (header)
- `src/mcp/vice/package.json`, `src/mcp/vice/build.ts` (`HOST_BOUND_ARTIFACTS`), `.mcp.json`, `installer/bin/cli.mjs` (grep)
- `src/mcp/vice/prerequisites.json` (full 416 lines), `src/mcp/vice/prereq-readme-gen.ts` (function/const inventory), `src/mcp/vice/prerequisites.test.ts` (`kind` union, DECL-04 test), `docs/phase58-declaration-provenance.md`
- `src/mcp/vice/broker-e2e.test.ts`, `vice-broker-launch.test.ts`, `vice-proxy.test.ts` (confirmed length + absence of BACK-05), `test-gate.mjs` (`MANUAL_ONLY_TESTS` full array), `.planning/codebase/TESTING.md` (superseded note)
- `.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`, `.planning/phases/55-.../55-03-SUMMARY.md` (test's historical full name)
- Live measurements this session: `os.networkInterfaces()` on the actual dev host (Node v24.20.0); a live `EADDRINUSE` reproduction via two `net.Server`s
- `.planning/phases/62-.../62-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` § Phase 62/63, `.planning/STATE.md` § Current Position

### Secondary (MEDIUM confidence)
- systemd `--user` unit shape: [CITED: freedesktop.org/software/systemd/man/latest/systemd.unit.html, ArchWiki Systemd/User] — general `[Unit]`/`[Service]`/`[Install]` shape, `Type=simple` for a non-forking foreground process, `Environment=`, `WantedBy=default.target`
- launchd plist shape: [CITED: developer.apple.com Creating Launch Daemons and Agents, thoughtbot.com launch-agent example] — `Label`/`ProgramArguments`/`RunAtLoad`, `~/Library/LaunchAgents/` naming convention

### Tertiary (LOW confidence)
- None — every claim above was either read against HEAD, live-measured, or drawn from a cited official doc; nothing rests on unverified training-data recall alone except where explicitly marked `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Code-shape claims (current function signatures, line numbers, dispatch order): HIGH — every citation re-read against HEAD this session, with one confirmed drift (BACK-05 test, deleted) called out explicitly.
- Interface enumeration shape: HIGH for Linux (live-measured), MEDIUM for macOS (architecturally sound but not independently measured this session, matches CONTEXT.md's own stated premise).
- Service-definition content: MEDIUM — general shape is well-documented and stable; exact `Environment=`/path handling should be spot-checked against the target systemd/launchd version at implementation time.
- Deferred-question recommendation (`prerequisites.json`): HIGH — grounded in two structural facts read directly from the schema and its own enforcing test this session, not opinion.

**Research date:** 2026-09-19
**Valid until:** 30 days (stable Node stdlib APIs; the one fast-moving risk is further codebase churn on the files this phase edits, since this milestone is mid-flight — re-verify line numbers if planning is delayed past a few more phase closures)

## RESEARCH COMPLETE
