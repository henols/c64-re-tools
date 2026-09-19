# Phase 62: The Fixed Endpoint and the Broker That Owns the Machine - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 12 (4 new, 8 modified)
**Analogs found:** 12 / 12 (all have at least a role-match; two — the CI route
gate and the service definitions — have no exact-shape prior art in this repo
and are flagged as such below, per Open Questions 2/3 in 62-RESEARCH.md)

All analog paths below were verified with `git ls-files -- <path>` before being
named; every one is git-tracked source under `src/mcp/vice/` or repo root, none
is a gitignored install/runtime mirror.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/vice-cli.mjs` (NEW) | CLI entry point | request-response (process bootstrap + dispatch) | `src/mcp/vice/smoke.mjs` (spawn/delegate shape) + `src/mcp/vice/resources/vice-launcher.sh:190-287` (floor-refusal shape it replaces) + `src/mcp/vice/vice-proxy.ts:252` (the `argv[2]` dispatch it must preserve for `anno`) | role-match (no existing `.mjs` does floor-check-then-delegate; composed from 3 analogs) |
| `src/mcp/vice/service/vice-broker.service` (NEW, systemd `--user`) | config | batch (one-shot OS-managed process supervision) | none in this repo (confirmed: no `*.service`/`*.plist` file exists anywhere in the tree) | no analog — see "No Analog Found" |
| `src/mcp/vice/service/com.henols.vice-broker.plist` (NEW, launchd) | config | batch | none in this repo | no analog — see "No Analog Found" |
| A new structural test asserting no module invokes `systemctl`/`launchctl` (NEW test file, e.g. `service-no-invoke.test.ts`) | test | transform (tree scan → assertion) | `src/mcp/vice/hostpath-consumers.test.ts` (closed-consumer-set tree scan) and `src/mcp/vice/tool-location-consumers.test.ts` (same idiom, different token set) | role-match (general shape exists; no test scans for `systemctl`/`launchctl` specifically today — Open Question 3 resolved below) |
| New `hello`-op test cases (in `src/mcp/vice/broker-control.test.ts`) | test | request-response | `src/mcp/vice/broker-e2e.test.ts:1063-1069` (no-token / wrong-token assertion shape against a live listener) | exact (same file family, same op-dispatch surface, opposite polarity — hello must succeed with no token) |
| New two-candidate dial test cases (in `src/mcp/vice/vice-broker-client.test.ts`) | test | request-response | `src/mcp/vice/vice-broker-client.ts:1183-1263` (`openBrokerControl()`'s connect/timeout/settled machinery, to be exercised twice concurrently) | exact (same module, same pattern, doubled) |
| New interface-enumeration test cases (in `src/mcp/vice/vice-broker.test.ts` or new `interface-enum.test.ts`) | test | transform (I/O → filtered set) | `src/mcp/vice/broker-state.mts:321-326` (`BrokerDeps`'s injectable `spawn`/`now`/`probeReady`/`portInUse` seam) | role-match (the *injectable-override* convention transfers directly; no existing test touches `os.networkInterfaces()`) |
| New machine-level state-root test cases | test | transform | `src/mcp/vice/repo-root.ts` tests (pattern: assert resolved path does NOT collide with two distinct project roots) — no single file cited by RESEARCH.md; use the `VICE_POOL_DIR`/`VICE_SUPERVISOR_DIR`-style env-override tests in `broker-state.test.ts`/`broker-launch.test.ts` as the override-precedence shape | role-match |
| `src/mcp/vice/broker-control.mts` (EDIT) | control-plane / middleware | request-response | itself (extend in place) | exact — see Pattern Assignments |
| `src/mcp/vice/resources/broker-control.mjs` (EDIT, generated) | control-plane (compiled) | request-response | itself, regenerated via `npm run build` | exact |
| `src/mcp/vice/vice-broker-client.ts` (EDIT) | service/client | request-response | itself (extend `resolveControlTarget()`/add a sibling dial function) | exact |
| `src/mcp/vice/vice-broker.mts` (EDIT) | service (host daemon) | request-response + startup batch | itself | exact |
| `src/mcp/vice/vice-errors.ts` (EDIT, prose only) | utility (error types) | — | itself | exact |
| `src/mcp/vice/vice-proxy.ts` (EDIT, prose + dispatch) | controller (stdio MCP entry) | request-response | itself; `hostLaunchInstructions()`-style refusal in `install-resources.ts:173-192` for the message shape being retired | exact |
| `src/mcp/vice/package.json` (EDIT) | config | — | itself (`bin`/`main`/`scripts`) | exact |
| `src/mcp/vice/broker-e2e.test.ts`, `vice-broker-launch.test.ts` (EDIT, D-12 assertions) | test | request-response | themselves | exact |
| `README.md` (root, EDIT) | docs | — | itself; `<!-- prereq-gen:*:start/end -->` regions must not be hand-edited | exact |

## Pattern Assignments

### `src/mcp/vice/vice-cli.mjs` (NEW — CLI entry point, request-response)

**Analogs:** `src/mcp/vice/smoke.mjs` (spawn/delegate shape, hand-authored top-level `.mjs`), `src/mcp/vice/resources/vice-launcher.sh:190-287` (the floor-refusal ladder this file must reproduce in JS), `src/mcp/vice/vice-proxy.ts:252-270` (the existing `argv[2]` dispatch it must preserve).

**Why this file is genuinely new, not a copy of one analog:** no existing `.mjs` in this tree does "check Node floor, refuse by name, else dispatch to a subcommand." `test-gate.mjs` and `smoke.mjs` are both hand-authored, top-level, never compiled by `build.ts` (confirmed: neither appears in `HOST_BOUND_ARTIFACTS`, `src/mcp/vice/build.ts:43-55`) — that placement precedent is what `vice-cli.mjs` should follow. The floor-check LOGIC comes from the bash launcher; the delegate-to-existing-entry-point shape comes from `vice-proxy.ts`'s own `anno` branch.

**Placement precedent — hand-authored, never-compiled top-level `.mjs`** (`src/mcp/vice/build.ts:43-55`, verified exact):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
  "host-tool.mjs",
  "ghidra-project.mjs",
  "tool-location.mjs",
];
```
`vice-cli.mjs` must NOT be added to this array — it is plain JS, never a compiled `.mts`.

**The floor-refusal ladder to port from bash to JS** (`src/mcp/vice/resources/vice-launcher.sh:256-267`, verified exact):
```bash
# ---------------------------------------------------------------- interpreter gate
#
# Refuses BEFORE exec, by name, with a remedy -- a below-floor or
# unresolvable interpreter must never reach the broker artifact, because
# once it does, whatever fails next presents as a wedge with no obvious
# cause. This project detects and refuses by name; it never installs
# anything and never shells out to a package manager.
if [ -z "$NODE_BIN" ]; then
  printf 'vice-launcher: refusing to start -- %s\n' "$NODE_RESOLUTION_ERROR" >&2
  exit 4
fi

if [ "$NODE_MAJOR" -lt "$NODE_FLOOR_MAJOR" ]; then
  printf 'vice-launcher: refusing to start -- resolved node interpreter %s reports %s, which is below the required floor v%s.x. Install a Node >= v%s and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one that satisfies the floor.\n' \
    "$NODE_BIN" "$NODE_VERSION" "$NODE_FLOOR_MAJOR" "$NODE_FLOOR_MAJOR" >&2
  exit 4
fi
```
Per D-03/RESEARCH's "Don't Hand-Roll" table: `vice-cli.mjs` does NOT need the `VICE_BROKER_NODE` override or a subprocess `--version` probe (that machinery exists in the bash script only because bash cannot introspect a foreign interpreter). `vice-cli.mjs` IS already running under some Node, so the check is simply:
```javascript
const floor = 24; // mirror engines.node's ">=24.0.0" — read from package.json rather than hardcoded, per DECL-04's "exactly one record carries versionFloor" discipline if this project wants a single source of truth
const major = Number(process.versions.node.split(".")[0]);
if (major < floor) {
  process.stderr.write(`vice-mcp: refusing to start -- resolved node interpreter reports ${process.versions.node}, below the required floor v${floor}.x. Install Node >= ${floor} and put it on PATH.\n`);
  process.exit(4); // match the launcher's own exit code for the same failure class
}
```
`VICE_BROKER_NODE` "keeps its meaning" (D-03) via the **systemd unit's** `Environment=` line, not via `vice-cli.mjs` itself — the unit is what runs in a PATH-less service context; `npx`-invoked `vice-cli.mjs` always has a working `node` (it IS one).

**The existing `argv[2]` dispatch to preserve/extend** (`src/mcp/vice/vice-proxy.ts:252-263`, verified exact):
```typescript
if (process.argv[2] === "anno") {
  // A broken pipe (the reader closing early, e.g. `| head`) makes
  // `stream.write()` fail with EPIPE. ...
  process.stdout.on("error", () => {});
  process.stderr.on("error", () => {});
  // ... anno dispatch continues, this .ts file never gets a Node-floor
  // check today because a below-floor Node throws parsing this FILE
  // before this line is ever reached — the exact defect D-03 fixes.
```
`vice-cli.mjs` becomes the new `bin`/`main` target; `argv[2] === "broker"` starts the broker (importing `resources/vice-broker.mjs`), anything else `import()`s `vice-proxy.ts` unchanged — which incidentally gives `anno` the same floor protection it lacks today (RESEARCH.md's second major finding).

---

### `src/mcp/vice/broker-control.mts` (EDIT — control-plane, request-response)

**Analog:** itself; extend in place, following the file's own existing conventions.

**Header teaching the REVERSED rule, to rewrite per D-11** (`broker-control.mts:16-20`, verified exact):
```typescript
// Wire format confirmed at a blocking checkpoint decision (2026-08-03,
// `as-specified`, no amendments), which accepted some residual risk and
// considered and rejected a unix-domain-socket alternative. Auth: per-boot
// capability token compared constant-time, checked BEFORE any state read
// or write. Bind: 0.0.0.0 explicitly, never 127.0.0.1 --
// host.docker.internal is the bridge address, not loopback, so a
// loopback-only listener is structurally unreachable from the container.
// Port: 19510 default via VICE_BROKER_CONTROL_PORT.
```
Replace "Bind: 0.0.0.0 explicitly, never 127.0.0.1" with the new D-09 rule (loopback plus enumerated `docker0`/`br-*`/`podman*`/`cni-*` gateways, never `0.0.0.0`).

**The op union to widen to nine** (`broker-control.mts:57`, verified exact):
```typescript
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release" | "host_tool";
```
Add `"hello"` as the ninth member.

**`ControlErrorCode`, already carrying both codes D-06's stale-broker discriminator needs** (`broker-control.mts:64-71`, verified exact):
```typescript
export type ControlErrorCode =
  | "unauthorized"
  | "bad_request"
  | "denied"
  | "no_free_port"
  | "no_free_text_port"
  | "at_capacity"
  | "internal"
  | "monitor_owned";
```
No new error code is needed for D-06/D-07 — `unauthorized` and `bad_request` already exist and are what a stale broker or a version-incompatible answer resolve to.

**`tokensMatch()`, untouched, and the gate it sits behind — THE LOAD-BEARING FINDING** (`broker-control.mts:432-436` for the function, `:717-723` for the gate call site, verified exact, matches RESEARCH.md's Pattern 1 exactly):
```typescript
function tokensMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```
```typescript
      // Token check BEFORE any state is read or written -- absence or
      // mismatch is refused, the connection is destroyed, and nothing is
      // allocated, spawned or signalled (T-01.6.2-01, T-01.6.2-03).
      const token = typeof req.token === "string" ? req.token : "";
      if (!tokensMatch(token, opts.token)) {
        writeLine(socket, { kind: "error", code: "unauthorized" as ControlErrorCode, message: "missing or invalid control token" });
        socket.destroy();
        return;
      }

      // Dispatched FIRST in the chain, before "acquire" ...
      if (req.op === "host_tool") {
```
**A `hello` branch inserted as one more `else if` in the existing op chain (as CONTEXT.md's own "drops into the existing op switch" wording implies) would ALWAYS fail with `unauthorized`, identical to D-06's own stated stale-broker signature — this is a required restructuring, not an additive insertion.** The `hello` arm must be placed BEFORE the `tokensMatch()` call shown above, immediately after the JSON-parse/shape-validation guards (`broker-control.mts:701-716`, the `try { parsed = JSON.parse(line) } catch { ... }` / `typeof parsed !== "object"` checks), answered unconditionally with the magic string, package version, and connection tag. Every one of the 8 existing ops keeps requiring the token, untouched, below it.

**`resolveControlPort()`, unchanged, the default this phase's fixed-port dial depends on** (`broker-control.mts:419-424`, verified exact):
```typescript
export function resolveControlPort(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_CONTROL_PORT;
  if (raw === undefined || raw === "") return 19510;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 19510;
}
```

**`bindControlListener(host, port)` — the one-host-per-call primitive to loop for BROKER-03's bind SET** (`broker-control.mts:532-541`, verified exact):
```typescript
export function bindControlListener(host: string, port: number): Promise<BoundListener> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr !== null ? addr.port : port;
      resolvePromise({ server, port: boundPort, host });
    });
  });
}
```

**`startControlListener()` — the `"0.0.0.0"` default D-12 changes, and the ONE `pendingAcquires` per call that Pitfall 2 warns against duplicating** (`broker-control.mts:919-928`, verified exact):
```typescript
export function startControlListener(opts: StartControlListenerOptions): Promise<StartControlListenerResult> {
  const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";
  const port = resolveControlPort(opts.port);

  return bindControlListener(host, port).then((bound) => {
    const pendingAcquires: PendingAcquireQueue = [];
    attachControlProtocol(bound.server, opts, pendingAcquires);
    return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
  });
}
```
Per RESEARCH.md's Pattern 2, binding a SET means calling `bindControlListener()` + `attachControlProtocol()` once PER address with **one shared `pendingAcquires` array**, not N calls to `startControlListener()` itself (which would each allocate its own queue and silently fork acquire fairness).

**Error handling / never-throw discipline already in place, to extend for `hello`** (`broker-control.mts:701-716`, verified exact):
```typescript
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
```

---

### `src/mcp/vice/resources/broker-control.mjs` (EDIT — compiled copy)

**Analog:** itself. **Build/regenerate command:** `npm run build` (`package.json:136`, `"build": "node build.ts"`). **Drift guard:** `resources-sync.test.ts` fails CI if the compiled `.mjs` doesn't match a fresh build of the `.mts` source.

**Header carrying the same reversed rule, verified exact match at line 26 as RESEARCH.md states** (`resources/broker-control.mjs:1-27`):
```javascript
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-control.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-control.mts
//
// ... [same header prose as the .mts source, including the "Bind: 0.0.0.0
// explicitly, never 127.0.0.1" line D-11 rewrites] ...
```
Never hand-edit this file. Edit `broker-control.mts`, then run `npm run build`, and commit the regenerated `.mjs` in the SAME change (D-11's own stated requirement).

---

### `src/mcp/vice/vice-broker-client.ts` (EDIT — client, request-response)

**Analog:** itself; the new two-candidate dial function is a sibling to `openBrokerControl()`, reusing its exact connect/timeout/settled machinery, but must NOT read `broker.json`.

**Lines 195-197 area quoting the reversed rule verbatim — exact match, D-11 site** (`vice-broker-client.ts:191-197`, verified exact):
```typescript
// `broker.json`'s `control_host` field is the broker's BIND address
// (vice-broker.mts:782 writes `listener.host` into it, which is
// deliberately `0.0.0.0` per broker-control.mts:16-20's own rule: "Bind:
// 0.0.0.0 explicitly, never 127.0.0.1 -- host.docker.internal is the bridge
// address, not loopback"). A bind address is not a dial address: `0.0.0.0`
// dialed from inside THIS container reaches this container's own network
// stack, where nothing listens.
```

**The wildcard-bind / loopback classifiers to reuse, never re-derive** (`vice-broker-client.ts:225-259`, verified exact):
```typescript
function isWildcardBindHost(host: string): boolean {
  const bare = stripBrackets(host);
  return bare === "0.0.0.0" || bare === "::" || IPV6_ALL_ZEROS_RE.test(bare);
}

function isLoopbackConnectHost(host: string): boolean {
  const bare = stripBrackets(host);
  return bare === "localhost" || bare === "::1" || IPV4_LOOPBACK_RE.test(bare) || IPV6_LOOPBACK_FULL_RE.test(bare);
}

export function classifyConnectHost(host: string): "wildcard_bind" | "loopback" | "routable" {
  if (isWildcardBindHost(host)) return "wildcard_bind";
  if (isLoopbackConnectHost(host)) return "loopback";
  return "routable";
}
```

**`resolveControlTarget()` signature to extend/parallel** (`vice-broker-client.ts:280`, confirmed present):
```typescript
export function resolveControlTarget(record: Record<string, unknown>, port: number): ResolveControlTargetResult {
```
The new two-candidate dial does NOT call this function (it is `broker.json`-shaped); it needs a sibling that takes no record at all, just the two fixed candidates (`127.0.0.1`, `host.docker.internal`) on the fixed port.

**The connect-with-timeout pattern to run TWICE concurrently (not `Promise.race`)** (`vice-broker-client.ts:1183, 1225-1263`, verified exact — this is `openBrokerControl()`; the reusable part is everything from `let settled = false` down):
```typescript
    let settled = false;
    const socket = connect({ host, port });

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
      socket.destroy();
      resolvePromise({
        ok: false,
        kind: "connect_refused",
        message: `openBrokerControl: no connection to ${host}:${port} within ${connectTimeoutMs}ms`,
        target: `${host}:${port}`,
      });
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
      resolvePromise({
        ok: false,
        kind: "connect_refused",
        message: `openBrokerControl: connection to ${host}:${port} failed -- ${err.message}`,
        target: `${host}:${port}`,
      });
    }

    socket.once("connect", onConnect);
    socket.once("error", onError);
```
For the two-candidate dial (D-07), run this shape ONCE per candidate, both started immediately (never sequential), and — per D-07 — do NOT resolve the overall dial on the first `onError`; let BOTH candidates settle, then rank by the four-outcome table (see Shared Patterns below) and resolve with the highest-ranked observation. On `onConnect`, send `{"op":"hello"}\n` (no token) instead of assuming a grant flow.

---

### `src/mcp/vice/vice-broker.mts` (EDIT — host daemon, request-response + startup batch)

**Analog:** itself.

**The `"0.0.0.0"` default to replace with the enumerated bind set** (`vice-broker.mts:1132-1134`, verified exact):
```typescript
  const state = createBrokerState();
  const token = newControlToken();
  const controlHost = process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";
```

**The EADDRINUSE refuse-by-name block — ALREADY the exact BROKER-04 shape, extend rather than reinvent** (`vice-broker.mts:1320-1352`, verified exact, matches RESEARCH.md's Pattern 3):
```typescript
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
**Caveat carried forward from RESEARCH.md:** this reads `broker.json` to classify alive/stale — fine to keep this phase (broker.json is untouched), but add a one-line comment that a future phase should reclassify using the `hello` handshake instead once `broker.json` is removed (Phase 66).

**Sibling primitive for the per-candidate-bind EADDRINUSE distinction (loopback-fatal vs. bridge-address-non-fatal, D-09)** (`broker-state.mts:393-402`, verified exact — `defaultPortInUse()`):
```typescript
export function defaultPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
```

**Injectable-override convention to reuse for `os.networkInterfaces()`** (`broker-state.mts:321-326`, verified exact — `BrokerDeps`, this codebase's standing shape for "anything touching env/time/spawning/I-O accepts an injectable override," per CLAUDE.md's Injection convention):
```typescript
export interface BrokerDeps {
  spawn: (command: string, args: string[]) => ChildProcess;
  now: () => number;
  probeReady: (record: InstanceRecord) => Promise<boolean>;
  portInUse?: PortInUseProbe;
}
```
The new interface-enumeration function should take the same shape: a destructured options object with an optional `networkInterfaces?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>` override, defaulting to `os.networkInterfaces` — never a positional boolean, per CLAUDE.md's Injection rule.

---

### `src/mcp/vice/vice-errors.ts:51` (EDIT — prose only)

**Analog:** itself. Read at the cited line (verified exact per RESEARCH.md's drift check): states "the broker binds `0.0.0.0`" as fact, in the header comment explaining why a connectivity failure against an `alive`-classified broker.json is reported the way it is. Rewrite to state the new bind rule (loopback + enumerated bridge gateways) without otherwise touching the surrounding error-class logic.

---

### `src/mcp/vice/vice-proxy.ts` (EDIT — controller, request-response)

**Analog:** itself.

**The `anno` dispatch that has the SAME latent floor problem D-03 fixes for `broker`** (`vice-proxy.ts:252-263`, verified exact):
```typescript
if (process.argv[2] === "anno") {
  process.stdout.on("error", () => {});
  process.stderr.on("error", () => {});
  // ...
```

**The `:820`-area prose referencing the bind address, to check in the same D-11 pass** (`vice-proxy.ts:816-824`, verified exact):
```typescript
// Non-container branch is 127.0.0.1 rather than "localhost" DELIBERATELY:
// "localhost" may resolve to ::1 first, and the broker binds 0.0.0.0 --
// IPv4-only (broker-control.mts's documented bind), so an IPv6 loopback
// connect would be refused by a listener that is in fact running. An
// explicit IPv4 literal cannot pick the wrong family. It also classifies as
// `loopback` under vice-broker-client.ts's classifyConnectHost(), which
```

**The broker-absent refusal-message pattern (ENDPOINT-04's closest existing analog, THIS phase's shape, not `install-resources.ts`'s retiring one)** (`vice-proxy.ts:747-763`, verified exact):
```typescript
// ------------------------------------------------- broker-absent diagnostics
//
// Plan 01.2-03 task 1 / must_have C10. A missing broker answers exactly one
// generic message two times out of three sends the reader to the wrong fix.
// Every message here quotes brokerHostPath() (an absolute HOST path,
// recomputed fresh -- see that function's own comment) and the single
// shared ONLY_ROUTE_NOTE definition; no message below writes its own second
// only-route sentence.

/** State: readBrokerLiveness() found no broker.json at all -- the broker has
 * never been started on this host. Nothing on the other side would ever
 * read a request, so ensureBrokerLease() returns this BEFORE writing one. */
function brokerNeverStartedMessage(): string {
  return (
    `vice: the on-demand VICE broker has never been started on this host -- no broker.json ` +
    `record exists at all. Start it on the host with:\n` +
    `  ${brokerHostPath()}\n` +
    ONLY_ROUTE_NOTE
  );
}
```
This is the pattern to FOLLOW for ENDPOINT-04's new refusal (one function per distinct failure state, each quoting a single shared constant), but the new refusal must quote `BROKER_START_COMMAND = "npx -y @henols/vice-mcp broker"` (D-01, RESEARCH.md's recommended inline constant) instead of `brokerHostPath()` — D-01's whole point is that no host path can be computed from inside a container. D-07's four-outcome ranking (see Shared Patterns) needs FOUR such message functions, one per outcome, not one generic message with a variable clause (per CONTEXT.md's "Specific Ideas").

**What this pattern is retiring (context, not to copy):** `install-resources.ts:173-192`'s `hostLaunchInstructions()` — the SAME per-state-message idiom, but it quotes a computed HOST PATH (`hostPath(target, {...})`) rather than a fixed npx string. D-01 exists specifically because that path cannot be computed from inside a container with no bind mount.

---

### `src/mcp/vice/package.json` (EDIT — config)

**Analog:** itself.

**Current `bin`/`main`/`engines`, to retarget** (`package.json:6-11,101-103`, verified exact):
```json
  "bin": {
    "vice-mcp": "vice-proxy.ts"
  },
  "main": "vice-proxy.ts",
```
```json
  "engines": {
    "node": ">=24.0.0"
  },
```
Per D-02/D-03, retarget BOTH `bin` and `main` to `vice-cli.mjs` (D-02 forbids a second `bin` key; D-03 requires the floor check to live somewhere the module loader can always parse). Add `"vice-cli.mjs"` to the `files` array (currently 90+ entries starting `"vice-proxy.ts"` at the top) and add it to `package.json`'s `scripts` only if a convenience script is wanted — not required.

**The existing `anno` subcommand's dispatch is NOT a second `bin` entry — it is `argv[2]` branching inside the single `vice-proxy.ts` entry** (already shown above, `vice-proxy.ts:252`). D-02 mirrors this exact shape for `broker`: one bin, `argv[2]`-branched.

---

### `src/mcp/vice/broker-e2e.test.ts` and `src/mcp/vice/vice-broker-launch.test.ts` (EDIT — D-12 reddened assertions)

**Analog:** themselves; update the two literal assertions.

**`broker-e2e.test.ts:364`, verified exact:**
```typescript
      assert.equal(brokerJson.control_host, "0.0.0.0", `container.json contents: ${JSON.stringify(brokerJson)}`);
      // This assertion now documents the whole point of the fix (quick-260805-9ha):
      // the record says "0.0.0.0" -- the broker's own BIND address -- and the
      // client below dials elsewhere (this file's own VICE_BROKER_CONTROL_DIAL_HOST
      // override), never that recorded value.
```

**`vice-broker-launch.test.ts:231`, verified exact:**
```typescript
    assert.equal(record.control_host, "0.0.0.0");
    assert.ok(Number.isInteger(record.control_port) && (record.control_port as number) > 0);
```

**CRITICAL, from RESEARCH.md's Validation Architecture section — both files are in `test-gate.mjs`'s `MANUAL_ONLY_TESTS` exclusion list** (`test-gate.mjs:141-155` region, per RESEARCH.md's own verified citation), so `npm run test:automated` (the CI gate) structurally CANNOT see a regression in either assertion. The planner MUST add an explicit verification step running `node --test broker-e2e.test.ts vice-broker-launch.test.ts` (or the full `npm test`), never relying on `test:automated` alone, to confirm these two updates actually land.

**Ephemeral-port test convention, used identically at 7 sites in this codebase, to follow for every NEW test this phase adds (Pitfall 3)** (`broker-e2e.test.ts:95`, verified exact):
```typescript
    VICE_BROKER_CONTROL_PORT: "0",
```

**try/finally scratch-reaping convention already in `broker-e2e.test.ts`** (`broker-e2e.test.ts:1074-1077`, verified exact):
```typescript
  } finally {
    await stopBroker(handle);
    rmSync(stateDir, { recursive: true, force: true });
  }
```

**No-token / wrong-token assertion shape to mirror (with OPPOSITE expected outcome) for the new `hello` tests** (`broker-e2e.test.ts:1063-1069`, verified exact):
```typescript
    const noToken = await rawAcquire(host, port, { op: "acquire", id: "req-no-token" });
    assert.equal(noToken.response.kind, "error");
    assert.equal(noToken.response.code, "unauthorized");

    const wrongToken = await rawAcquire(host, port, { op: "acquire", id: "req-wrong-token", token: "0".repeat(64) });
    assert.equal(wrongToken.response.kind, "error");
    assert.equal(wrongToken.response.code, "unauthorized");
```
The new `hello` case must assert the OPPOSITE: `{"op":"hello"}` with NO token field returns a real handshake reply, never `unauthorized` — this is the direct regression test for Pitfall 1.

---

### `README.md` (root, EDIT — docs)

**Analog:** itself. The `## Install` section (`README.md:19-41`) is the natural home for `npx -y @henols/vice-mcp broker` as the universal start command (D-01/D-15's "same string, three places"), alongside the existing npm/npx install block:
```markdown
### A. npm / npx (any project)

From the project you want to set up:

    npx @henols/c64-re-tools

This copies the six skills into `<project>/.claude/skills/` and wires the
`vice` MCP server into `<project>/.mcp.json` (launched via `npx -y @henols/vice-mcp`).
```

**GENERATED REGIONS THAT MUST NOT BE HAND-EDITED** (`README.md:95,109,122,136`, verified present via grep):
```
<!-- prereq-gen:prerequisite-overview:start -->
...
<!-- prereq-gen:prerequisite-overview:end -->
<!-- prereq-gen:vice-ecosystems:start -->
...
<!-- prereq-gen:vice-ecosystems:end -->
```
Per RESEARCH.md's Deferred Question (answered "no, inline the constant, don't extend `prerequisites.json`"), the broker start command does NOT belong inside either generated region — it is hand-written prose in `## Install` or a new `## Starting the broker` section placed near `## Installing VICE` (`README.md:111`), never inside a `prereq-gen:*` marker pair (`src/mcp/vice/prerequisites.json`'s `kind` union is a closed two-member type per `prerequisites.test.ts:67`, and a broker is neither an `"executable"` nor a `"directory"`).

---

## Shared Patterns

### Detect-then-refuse-by-name-with-the-remedy (ENDPOINT-04, BROKER-02, BROKER-04)
**Source:** `vice-proxy.ts:747-763` (`brokerNeverStartedMessage()` and its siblings), `vice-broker.mts:1338-1351` (EADDRINUSE refusal), `resources/vice-launcher.sh:256-267` (floor refusal).
**Apply to:** every refusal this phase writes — the fixed-endpoint dial failure (ENDPOINT-04), the version-skew refusal (ENDPOINT-05), the Node-floor refusal in `vice-cli.mjs` (D-03), and BROKER-04's port-conflict refusal (already exists, extend don't reinvent).
**Shape:** one small, named function per distinct failure state; each quotes exactly one shared constant/computed value (never a second hand-written copy of the remedy text); never a generic message with a variable clause.

### The four-outcome dial ranking (D-07, ENDPOINT-01/02/05)
**Source:** CONTEXT.md D-07, applied over `vice-broker-client.ts`'s existing connect/timeout/settled machinery (above).
**Apply to:** the new two-candidate dial function in `vice-broker-client.ts` and the refusal it feeds in `vice-proxy.ts`.
**Four distinct outcomes, ranked, report the HIGHEST rank seen across BOTH candidates:**
1. connect refused / DNS does not resolve → "nothing is listening"
2. connected, no valid/timely reply → "something else is on that port"
3. connected, `unauthorized`/`bad_request` → "that is an old broker" (pre-v2.0.0, per D-06's own stale-broker signature)
4. connected, valid `hello`, incompatible major → "that broker is too old/new for this client" (ENDPOINT-05, name BOTH package names and BOTH versions)

### The `hello` pre-token-gate dispatch (D-06, ENDPOINT-03) — THE SINGLE MOST LOAD-BEARING PATTERN THIS PHASE INTRODUCES
**Source:** `broker-control.mts:701-723` (existing parse/shape guards + token gate, shown in full above).
**Apply to:** `broker-control.mts`'s `handleLine()` only.
**Rule:** the `hello` branch is inserted BETWEEN the JSON-parse/shape-validation guards and the `tokensMatch()` call — never after it, never as one more `else if` in the existing 8-arm chain. Every one of the 8 existing ops keeps requiring the token, completely untouched.

### Injectable overrides for anything touching env/time/spawning/I-O (BROKER-03's interface enumeration, BROKER-06's state root)
**Source:** `broker-state.mts:321-326` (`BrokerDeps`).
**Apply to:** the new interface-enumeration function (`os.networkInterfaces` override) and any new state-root resolver (env override already named by D-13/D-14 as `VICE_BROKER_HOME`, but the function itself should still accept an injectable override for testing, per this codebase's own no-mocking-library convention).
**Rule:** a destructured options object, never a positional boolean; the suite has no mocking library, so this is the only seam available.

### Generated-but-committed drift guard (D-11's `resources/broker-control.mjs` site)
**Source:** `build.ts`'s `HOST_BOUND_ARTIFACTS` + `resources-sync.test.ts`.
**Apply to:** any edit to `broker-control.mts`.
**Rule:** run `npm run build` and commit the regenerated `.mjs` in the SAME change; never hand-edit the `.mjs`.

### Ephemeral-port + try/finally test hygiene (Pitfall 3, all new tests)
**Source:** `broker-e2e.test.ts:95` (`VICE_BROKER_CONTROL_PORT: "0"`, one of 7 sites using this exact convention) + `broker-e2e.test.ts:1074-1077` (try/finally teardown).
**Apply to:** every new test file/case this phase adds. Never hardcode port 19510 except in the one test that explicitly asserts the production default (`resolveControlPort()`'s own default test, which should exist exactly once).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/mcp/vice/service/vice-broker.service` (systemd `--user` unit) | config | batch | No `.service`/`.plist` file exists anywhere in this repo (confirmed by `find . -iname "*.service" -o -iname "*.plist"` returning nothing). RESEARCH.md's own Assumption A2: content follows general freedesktop.org/ArchWiki shape (`[Unit]`/`[Service]`/`[Install]`, `Type=simple`, `Environment=VICE_BROKER_NODE=...`, `WantedBy=default.target`), not a project-specific precedent. Placement precedent (D-15's Open Question 2, unresolved by CONTEXT.md): a new `src/mcp/vice/service/` directory, next to the code that documents starting the broker, extending this project's "one module/one seam" convention to a non-code artifact. |
| `src/mcp/vice/service/com.henols.vice-broker.plist` (launchd plist) | config | batch | Same as above — no prior art. General shape per Apple's Launch Daemons/Agents doc and the thoughtbot example RESEARCH.md cites (`Label`/`ProgramArguments`/`RunAtLoad`, `~/Library/LaunchAgents/` naming). |
| CI structural gate: no module invokes `systemctl`/`launchctl` | test | transform | **Open Question 3, resolved:** no single existing file scans the WHOLE tree for a forbidden `spawnSync`/`execFileSync`/`spawn` argument the way D-15 needs. The closest analogs — `hostpath-consumers.test.ts` and `tool-location-consumers.test.ts` — establish the SHAPE (comment-stripped source, `readdirSync` over top-level production `.ts`/`.mts` files, a closed-set assertion) but check a different token set (import statements / env-var names, not subprocess-invocation arguments). **Recommendation, per RESEARCH.md: write this as a NEW small test file** (e.g. `service-no-invoke.test.ts`), copying `hostpath-consumers.test.ts`'s comment-stripping discipline (`importsHostpath()`-style predicate, but matching `spawnSync\(|execFileSync\(|spawn\(` combined with `"systemctl"|"launchctl"`) rather than trying to retrofit either existing file, since both are named for a different closed-consumer-set concept and widening either would blur what each already asserts. Must use `readFileSync(path)` (NOT a shell `grep`) precisely because it needs to scan the WHOLE tree including the four NUL-byte-carrying files (`anno-memmap-render.ts`, `anno-store-export.ts`, `prereq-readme-gen.ts`, `prerequisites.test.ts`) — `readFileSync` with `"utf8"` decodes a NUL byte as a normal (if unusual) character and does NOT truncate, unlike a shell `grep` invocation which silently skips a file it treats as binary. `anno-memmap-render.test.ts:321,328` already demonstrates this project's own byte-safe-read idiom (`readFileSync(...)` without forcing a string encoding, then `.includes(0x00)`) for exactly this reason — model the new gate's file-reading on that, not on invoking `grep` as a subprocess. |

## Metadata

**Analog search scope:** `src/mcp/vice/` (all `.ts`/`.mts`/`.mjs`/`.test.ts` files, ~150+ files), repo root `README.md`, `.claude-plugin/`.
**Files scanned:** ~40 read/grepped directly this session (broker-control.mts, vice-broker-client.ts, vice-broker.mts, vice-proxy.ts, vice-errors.ts, package.json, build.ts, resources/broker-control.mjs, resources/vice-launcher.sh, broker-e2e.test.ts, vice-broker-launch.test.ts, hostpath-consumers.test.ts, tool-location-consumers.test.ts, host-tool-transport.test.ts, anno-memmap-render.test.ts, broker-state.mts, install-resources.ts, smoke.mjs, test-gate.mjs, README.md), plus a repo-wide `find`/`grep` for `.service`/`.plist` files and `systemctl`/`launchctl` invocations (both empty, confirming "No Analog Found" entries).
**Pattern extraction date:** 2026-09-19

## PATTERN MAPPING COMPLETE
