// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-control.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-control.mts
//
// N / D-01 (plan 01, tracer): the framing, the token gate, and acquire/
// release. Plan 05 (task 1) completed the message set: recycle, status,
// host_state, the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's low-level bind primitive. THIS PLAN's
// task 2 adds a SEVENTH and EIGHTH op, `monitor_claim`/`monitor_release`
// (BROK-02/PROTO-08, D-13): exclusive ownership of an instance's raw binmon
// socket, enforced here rather than left to a client-side heuristic --
// stock VICE services exactly one binmon client, and a second connect()
// produces no reply and no EOF, so the refusal must happen BEFORE any
// second dial is ever attempted. The subsystem's FIRST network listener: a
// TCP control plane replacing the bash broker's requests/grants/denials/
// leases directory tree entirely. One JSON object per line; the connection
// open IS the claim, connection close IS the release (T-01.6.2-01 through
// -09).
//
// Wire format confirmed at plan 01's blocking checkpoint:decision
// (2026-08-03, `as-specified`, no amendments -- see .planning/RE-FINDINGS.md
// for the full record, including the two accepted residual risks and the
// unix-domain-socket dead end). Auth: per-boot capability token compared
// constant-time, checked BEFORE any state read or write. Bind: 0.0.0.0
// explicitly, never 127.0.0.1 -- host.docker.internal is the bridge
// address, not loopback, so a loopback-only listener is structurally
// unreachable from the container. Port: 19510 default via
// VICE_BROKER_CONTROL_PORT.
import { createServer } from "node:net";
import { timingSafeEqual, randomBytes } from "node:crypto";
/** 32 cryptographically random bytes rendered as hex -- the per-boot
 * capability token. Held in memory only by the caller; written once into
 * broker.json and never logged, never included in an error message
 * (T-01.6.2-02). */
export function newControlToken() {
    return randomBytes(32).toString("hex");
}
const MAX_LINE_BYTES = 65536;
/** CR-03: the one refusal wording for a target-naming op whose `target_id` is
 * not the grant the asking connection itself holds. Deliberately worded as an
 * authorisation refusal and NOT as an ownership conflict between two
 * legitimate holders (`monitor_owned`, which names a holder) and never as an
 * emulator fault -- see attachControlProtocol()'s own ownsTarget() comment,
 * and T-02-18's prohibition on wedge/hang vocabulary in this file's
 * monitor-op refusals. */
const MONITOR_OWNERSHIP_DENIAL = "monitor_claim/monitor_release may only target the grant this connection itself holds";
/** Resolves the `channel` field on a `monitor_claim`/`monitor_release`
 * request line (plan 41-03, D-14): an ABSENT field means `binary`
 * deliberately -- a broker restarted mid-phase against a client that
 * predates this field keeps working (backward compatibility, this plan's
 * own must-have). An unrecognised NON-EMPTY value is `bad_request`, never a
 * silent fallback and never cast -- the caller below names both accepted
 * values in the refusal message. */
function resolveMonitorChannel(raw) {
    if (raw === undefined)
        return "binary";
    if (raw === "binary" || raw === "text")
        return raw;
    return "bad_request";
}
// ---------------------------------------------------------------------------
// Phase 33, plan 33-06 (REPRO-05, D-15, T-33-03/T-33-04): the launch-profile
// narrowing site.
//
// THIS IS THE ONE PLACE `profile` IS NARROWED. Do not re-derive this check
// anywhere else -- not in vice-broker.mts, not in broker-launch.mts, not in
// the container-side client. A second copy is how one of them ends up
// accepting a shape the other refuses.
//
// WHY IT HAS TO EXIST AT ALL: `ControlRequest` above carries an index
// signature, so *anything* a container writes on the wire parses into it. The
// profile then feeds buildViceArgs(), i.e. an `execve(x64sc, argv)` on the
// HOST. An unvalidated `profile` is therefore an argv-construction surface
// across a trust boundary, not merely a typing inconvenience.
//
// WHY UNKNOWN KEYS ARE REFUSED BY NAME rather than dropped: a silently
// accepted typo means a caller asked for warp, got an unwarped instance, and
// received a confident success. That is the same undetectable-lie failure
// D-16 exists to prevent one layer down, and it is why the message below
// names the offending key -- the by-name unexpected-argument discipline the
// tool handlers already use (RUN_UNTIL_KEYS' own convention).
//
// WHAT MUST NEVER BE ADDED HERE: a passthrough string, an `extraArgs`, or any
// key whose VALUE reaches argv. `profile` maps to exactly two literal flag
// tokens (`-console`, `-warp`) and to nothing else (T-33-04). `VICE_ARGS`
// stays the single, deliberate operator-only whole-argv override.
// ---------------------------------------------------------------------------
/** The complete accepted key set -- the ONE binding list this narrowing
 * checks against, so adding a knob to LaunchProfile without adding it here
 * refuses the knob rather than silently widening the boundary. */
const LAUNCH_PROFILE_KEYS = Object.freeze(["warp", "headless"]);
const LAUNCH_PROFILE_SHAPE = `an object with optional boolean keys ${LAUNCH_PROFILE_KEYS.join("/")}, or absent`;
/** Narrows an untrusted `profile` field off the wire. Never throws; answers a
 * discriminated result so the caller writes the existing `bad_request` error
 * shape rather than needing a try/catch at the protocol boundary.
 *
 * Rules, in the order they are applied:
 * - `undefined` (key absent) and `null` -> `ok` with `undefined`. Both mean
 *   profile-less, which is byte-identically today's behaviour.
 * - a PLAIN object (arrays and every other non-plain value refused) whose
 *   keys are a subset of LAUNCH_PROFILE_KEYS and whose PRESENT values are
 *   booleans -> `ok` with that object.
 * - anything else -> `ok: false`, with a message naming the offending value
 *   (or key) and the accepted shape. Never coerced, never silently dropped:
 *   `"yes"`, `1` and `"warp"` are refusals, not truthy warp requests. */
export function normaliseLaunchProfile(raw) {
    if (raw === undefined || raw === null)
        return { ok: true, profile: undefined };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        // Arrays are specifically excluded: `typeof [] === "object"` in JS, so
        // without the Array.isArray() arm a JSON array would reach the key walk
        // below and pass it vacuously (an empty array has no own keys).
        return { ok: false, message: `profile must be ${LAUNCH_PROFILE_SHAPE}; got ${JSON.stringify(raw) ?? String(raw)}` };
    }
    const entries = Object.entries(raw);
    const unknownKeys = entries.filter(([key]) => !LAUNCH_PROFILE_KEYS.includes(key)).map(([key]) => key);
    if (unknownKeys.length > 0) {
        return { ok: false, message: `profile has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${LAUNCH_PROFILE_SHAPE}` };
    }
    const profile = {};
    for (const [key, value] of entries) {
        if (typeof value !== "boolean") {
            return { ok: false, message: `profile.${key} must be a boolean; got ${JSON.stringify(value) ?? String(value)}` };
        }
        if (key === "warp")
            profile.warp = value;
        if (key === "headless")
            profile.headless = value;
    }
    return { ok: true, profile };
}
export function resolveControlPort(override) {
    if (typeof override === "number")
        return override;
    const raw = process.env.VICE_BROKER_CONTROL_PORT;
    if (raw === undefined || raw === "")
        return 19510;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 19510;
}
/** Constant-time token comparison over EQUAL-LENGTH buffers -- an
 * unequal-length comparison is refused without ever calling
 * timingSafeEqual (which throws on a length mismatch), so the length check
 * itself leaks nothing beyond what a fixed-length comparison already
 * would not avoid. */
function tokensMatch(candidate, expected) {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length)
        return false;
    return timingSafeEqual(a, b);
}
function writeLine(socket, obj) {
    if (socket.writable) {
        socket.write(`${JSON.stringify(obj)}\n`);
    }
}
/** Phase 34, plan 34-01: writes a `host_tool` SUCCESS response line -- the
 * object host-tool.mts's runHostTool() produced, whatever shape that is
 * (`{ ok: true, ... }` or its own `{ ok: false, message }` refusal). This is
 * deliberately NOT `writeLine()`/`ControlResponse`: the host-tool response
 * shape is host-tool.mts's own contract, not one more `ControlResponse`
 * variant this module would otherwise have to keep in sync with a sibling
 * module's allowlist. A REJECTED onHostTool() promise never reaches this
 * function -- it is answered through the ordinary `writeLine()`/`error`
 * path instead, so every protocol-level failure still goes through one
 * shape. */
function writeHostToolLine(socket, obj) {
    if (socket.writable) {
        socket.write(`${JSON.stringify(obj)}\n`);
    }
}
function defaultRequestId(prefix) {
    return `${prefix}-${process.pid}-${Date.now()}`;
}
/** Appends to the BACK of the queue -- the only mutation this structure
 * ever performs on receipt. Nothing here sorts or re-orders; arrival order
 * falls out of the array's own insertion order. */
export function enqueueAcquire(queue, entry) {
    queue.push(entry);
}
/** Drains the queue from the front, strictly in the order this CALL found
 * them: takes a snapshot of everything currently pending (`splice`, never a
 * sort), then attempts each in that order. An entry whose launch is still
 * in flight is pushed back onto the queue for the NEXT drain pass rather
 * than retried immediately in a tight loop -- a later-arriving acquire that
 * queued behind it during THIS pass is not overtaken (it is appended after
 * the requeued entry, never before), so the array never needs re-ordering
 * to stay correct; a genuinely adversarial retry pattern could still starve
 * an entry across MULTIPLE passes, which is exactly the direct fairness
 * proof this module deliberately does not author -- injecting N acquires
 * and asserting grants return in that order is Phase 01.6.2.1's D-08
 * deliverable. The original defect this queue replaces (a lexical iteration
 * over `req-<pid>-<ms>-<hex>` filenames) cannot exist here regardless: there
 * is no file, and no re-ordering call of any kind anywhere in this region. */
export async function drainPendingAcquires(queue) {
    const snapshot = queue.splice(0, queue.length);
    for (const entry of snapshot) {
        const settled = await entry.attempt();
        if (!settled) {
            queue.push(entry);
        }
    }
}
/** Binds a bare TCP listener with NO protocol wired up -- no token check, no
 * request handling, nothing. `startControlListener()` below calls this
 * internally and then attaches the real protocol; a test wanting to occupy
 * a control port with "something that is not a broker" (the loud singleton
 * path's own fixture) can call this directly and never see anything that
 * looks like this broker's wire format. */
export function bindControlListener(host, port) {
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
/** Attaches the newline-delimited-JSON protocol (framing, token gate, all
 * five request kinds) to an ALREADY-BOUND server. Split out of
 * startControlListener() so the bind step and the protocol-wiring step are
 * two separately callable primitives -- the real broker still calls
 * startControlListener() as one step (this function is not part of its own
 * public surface); this module's own tests exercise the two independently. */
function attachControlProtocol(server, opts, pendingAcquires) {
    server.on("connection", (socket) => {
        let buffer = "";
        let requestIdForThisConnection = null;
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            if (Buffer.byteLength(buffer, "utf8") > MAX_LINE_BYTES) {
                socket.destroy();
                return;
            }
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIdx);
                buffer = buffer.slice(newlineIdx + 1);
                handleLine(line);
            }
        });
        socket.on("close", () => {
            // Connection close IS the release -- including on the client's own
            // SIGKILL, since "close" always fires either way. Idempotent: an
            // explicit `release` already having cleared
            // requestIdForThisConnection makes this a no-op.
            if (requestIdForThisConnection) {
                const id = requestIdForThisConnection;
                requestIdForThisConnection = null;
                opts.onRelease(id);
            }
        });
        socket.on("error", () => {
            // Per-connection error handling isolates one peer's failure from
            // every other connection and from the server itself (T-01.6.2-06).
        });
        /**
         * CR-03 (code review 2026-08-13). THE per-connection ownership predicate
         * every target-naming op is gated on -- the same rule `recycle` has
         * enforced since T-01.6.2-31, now shared rather than copied.
         *
         * Before this existed, `monitor_claim`/`monitor_release` took `target_id`
         * from the request and passed it straight through, so any connection
         * holding the per-boot control token (which every container-side proxy
         * sharing this broker does) could name ANOTHER session's grant id.
         * vice-broker.mts's handleMonitorClaim() uses that id as BOTH the target
         * and the claiming identity, and handleMonitorRelease()'s "only the
         * holder may release" check compared the request against itself -- so
         * session B could lock session A out of its own monitor socket, or
         * RELEASE A's live claim, after which a third client was free to dial the
         * same single-client binmon socket. That is precisely the unserviced-
         * backlog state D-13 exists to prevent and that CLAUDE.md says must never
         * be reachable.
         *
         * WHAT NOT TO DO: never add another op that acts on a caller-supplied
         * `target_id` without gating it here first. The grant a connection holds
         * is the ONLY identity this protocol has -- `target_id` is a request
         * field, not a credential.
         */
        function ownsTarget(targetId) {
            return requestIdForThisConnection !== null && targetId === requestIdForThisConnection;
        }
        /** Attempts one acquire over THIS connection/socket, writing the
         * terminal response (grant or a non-queueing error) when settled, or
         * enqueueing itself and returning unsettled when a launch is already in
         * flight. Shared by the immediate first attempt and every later retry
         * `drainPendingAcquires()` drives, so the two paths can never answer
         * differently for the same requestId.
         *
         * Gap closure (plan 14, WR-03/T-01.6.2-87/-88): two destroyed-socket
         * checks guard a grant against outliving the connection that owns it,
         * and they bound TWO DIFFERENT failures -- do not conflate them into one
         * claim.
         *
         * Half one -- the pre-check immediately below, BEFORE onAcquire() is
         * ever called -- closes the ALWAYS-REACHABLE leak: a client that
         * disconnects while queued leaves its entry pending (nothing removes it,
         * since it never held a grant id to release), and the next drain pass
         * would otherwise call the launch callback anyway -- which on the real
         * broker allocates a port, spawns a real child, writes an epoch record
         * and records a grant that no connection owns. This half turns that
         * always-reachable leak into a bounded race (half two, below).
         *
         * Half two -- the release-on-late-grant branch on the success path --
         * bounds the NARROW race the pre-check cannot close: a disconnect
         * landing between the pre-check passing and onAcquire()'s own
         * completion. This half does NOT eliminate that race -- it cannot, the
         * pre-check and the callback are separated by a real await -- it turns
         * the race from a leak into a reclaim, by invoking the existing release
         * callback with the same request id instead of silently dropping the
         * grant it produced.
         */
        function attemptAcquire(requestId, profile) {
            // Half one: a queued entry whose owning socket is already gone is
            // settled immediately, WITHOUT ever calling onAcquire() -- this is
            // what keeps a retried drain pass from performing a real, ownerless
            // launch.
            if (socket.destroyed)
                return Promise.resolve(true);
            return opts
                // Phase 33, plan 33-06: the profile is threaded through THIS shared
                // helper, which both the immediate first attempt and every later
                // drainPendingAcquires() retry go through -- so a request that
                // queued behind an in-flight launch is retried later with the
                // profile it was MADE with, never with a profile-less one.
                .onAcquire(requestId, profile)
                .then((outcome) => {
                if (outcome.ok) {
                    // Half two: the pre-check above ran before this call; a
                    // disconnect landing DURING the await is still possible and is
                    // bounded, not eliminated, here -- a grant that settles for a
                    // socket that is now gone is released through the existing
                    // release path rather than dropped.
                    if (socket.destroyed) {
                        opts.onRelease(requestId);
                        return true;
                    }
                    requestIdForThisConnection = requestId;
                    writeLine(socket, {
                        kind: "grant",
                        id: requestId,
                        port: outcome.grant.port,
                        url: outcome.grant.url,
                        epoch_file: outcome.grant.epochFile,
                        supervisor_dir: outcome.grant.supervisorDir,
                        // D-15; tightened by plan 41-05 (D-16): key omitted entirely
                        // when absent -- the fork case only now. A stock grant whose
                        // second (text-monitor) port allocation failed never reaches
                        // this line at all: acquirePortAndLaunch() fails the WHOLE
                        // acquire (`no_free_text_port`) before any grant is produced,
                        // so "absent" no longer needs to cover that case. Never a
                        // fabricated 0 or null standing in for "no port".
                        ...(outcome.grant.remoteMonitorPort === undefined ? {} : { remote_monitor_port: outcome.grant.remoteMonitorPort }),
                    });
                    return true;
                }
                if (outcome.reason === "launch_in_flight") {
                    return false; // still blocked -- caller re-queues
                }
                if (socket.destroyed)
                    return true; // no grant was produced -- nothing to release, nothing left to answer
                const code = outcome.reason === "internal" ? "internal" : outcome.reason;
                writeLine(socket, { kind: "error", code, message: `acquire failed: ${outcome.reason}` });
                return true;
            })
                .catch(() => {
                if (!socket.destroyed) {
                    writeLine(socket, { kind: "error", code: "internal", message: "acquire threw" });
                }
                return true;
            });
        }
        function handleLine(line) {
            if (line.trim() === "")
                return;
            let parsed;
            try {
                parsed = JSON.parse(line);
            }
            catch {
                writeLine(socket, { kind: "error", code: "bad_request", message: "malformed JSON line" });
                return;
            }
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                writeLine(socket, { kind: "error", code: "bad_request", message: "request must be a JSON object" });
                return;
            }
            const req = parsed;
            // Token check BEFORE any state is read or written -- absence or
            // mismatch is refused, the connection is destroyed, and nothing is
            // allocated, spawned or signalled (T-01.6.2-01, T-01.6.2-03).
            const token = typeof req.token === "string" ? req.token : "";
            if (!tokensMatch(token, opts.token)) {
                writeLine(socket, { kind: "error", code: "unauthorized", message: "missing or invalid control token" });
                socket.destroy();
                return;
            }
            // Phase 34, plan 34-01 (SEAM-01): dispatched FIRST in the chain, before
            // "acquire" -- so the ordering reads as the requirement does. Dispatch
            // here is on EXACT STRING EQUALITY, never fallthrough, so branch order
            // does not itself change which requests reach attemptAcquire() -- what
            // actually makes this branch unable to touch lease state is that
            // opts.onHostTool is its OWN callback (see StartControlListenerOptions'
            // own comment), never composed from onAcquire/onRelease/onRecycle/
            // onStatus/onHostState/onMonitorClaim/onMonitorRelease.
            if (req.op === "host_tool") {
                opts
                    .onHostTool(req)
                    .then((result) => {
                    if (!socket.destroyed)
                        writeHostToolLine(socket, result);
                })
                    .catch(() => {
                    if (!socket.destroyed) {
                        writeLine(socket, { kind: "error", code: "internal", message: "host_tool threw" });
                    }
                });
            }
            else if (req.op === "acquire") {
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
                // Phase 33, plan 33-06 (T-33-03): narrow BEFORE attemptAcquire, so a
                // malformed profile never reaches onAcquire and therefore never
                // reaches the port allocator, a spawn, or argv construction. A
                // refusal also does NOT enqueue -- the request is answered and
                // dropped, never retried on a later drain pass with the same bad
                // shape.
                const normalised = normaliseLaunchProfile(req.profile);
                if (!normalised.ok) {
                    writeLine(socket, { kind: "error", code: "bad_request", message: normalised.message });
                    return;
                }
                const profile = normalised.profile;
                // 33 review WR-03: the profile is STOCK-ONLY, so refuse it on fork
                // rather than accept it and ignore it.
                //
                // `buildViceArgs()`'s entire profile handling lives inside its
                // `backend === "stock"` branch -- on fork, neither `-warp` nor
                // `-console` is ever emitted. Nothing on the path used to notice:
                // normaliseLaunchProfile() has no backend gate, handleAcquire threads
                // the profile through unchanged, and spawnAndRecordInstance() mirrors
                // it onto the InstanceRecord regardless of backend. So a fork caller
                // asking for {warp:true} got a confident grant and an UNWARPED
                // machine, with no field in the response saying so; the record then
                // claimed `profile: {warp:true}` while its own viceArgs carried no
                // `-warp`, and profileEligible() would later hand that instance to
                // another warp request as a match. That is exactly the "undetectable
                // lie" profileEligible()'s own banner and D-16 exist to make
                // impossible, reintroduced one backend over -- and fork is still the
                // sole production backend across v0.1.x, so it is the branch most
                // callers are on.
                //
                // Refused HERE because this is the one narrowing site and the wire
                // boundary that already answers `bad_request`, so the caller LEARNS
                // its request was dropped instead of having to infer it. Gating the
                // record mirror instead would stop the record lying but would leave
                // the caller with no way to find out. Only the two flag-bearing keys
                // are refused: an empty `{}` and an explicit `{warp:false}` request
                // nothing the fork argv cannot deliver, so they stay accepted rather
                // than turning a no-op into an error.
                const backend = opts.onHostState().backend;
                if (backend !== "stock" && (profile?.warp === true || profile?.headless === true)) {
                    const asked = [profile?.warp === true ? "warp" : null, profile?.headless === true ? "headless" : null]
                        .filter((key) => key !== null)
                        .join(", ");
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `profile is stock-only: this broker's backend is "${backend}", whose argv has no -warp/-console route, so ` +
                            `profile.${asked} could only be accepted and IGNORED -- the grant would succeed, the machine would not have ` +
                            `the knob, and the instance record would still claim it. Refused rather than accepted and ignored (D-16).`,
                    });
                    return;
                }
                void attemptAcquire(requestId, profile).then((settled) => {
                    if (!settled) {
                        enqueueAcquire(pendingAcquires, { requestId, attempt: () => attemptAcquire(requestId, profile) });
                    }
                });
            }
            else if (req.op === "release") {
                if (requestIdForThisConnection) {
                    const id = requestIdForThisConnection;
                    requestIdForThisConnection = null;
                    opts.onRelease(id);
                }
                writeLine(socket, { kind: "released" });
            }
            else if (req.op === "recycle") {
                const recycleId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("recycle");
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                // T-01.6.2-31: a connection may only recycle the grant IT ITSELF
                // holds. This check happens here, before onRecycle() is ever
                // called, so a mismatched target never reaches the kill discipline
                // and never signals anything -- an injected signal recorder stays
                // empty for this case. Now expressed through the SAME ownsTarget()
                // predicate monitor_claim/monitor_release use (CR-03), so the three
                // target-naming ops cannot drift apart.
                if (!ownsTarget(targetId)) {
                    writeLine(socket, {
                        kind: "error",
                        code: "denied",
                        message: "recycle may only target the grant this connection itself holds",
                    });
                    return;
                }
                opts
                    .onRecycle(targetId)
                    .then((result) => {
                    writeLine(socket, {
                        kind: "recycle_ack",
                        id: recycleId,
                        target_id: targetId,
                        port: result.port,
                        x64sc_pid: result.pid,
                        vice_bin: result.viceBin,
                        kill_stage: result.killStage,
                        epoch_before: result.epochBefore,
                        outcome: result.outcome,
                        reason: result.reason,
                    });
                })
                    .catch(() => {
                    writeLine(socket, { kind: "error", code: "internal", message: "recycle threw" });
                });
            }
            else if (req.op === "status") {
                writeLine(socket, { kind: "status", instances: opts.onStatus() });
            }
            else if (req.op === "host_state") {
                const hs = opts.onHostState();
                writeLine(socket, {
                    kind: "host_state",
                    pid: hs.pid,
                    started_at: hs.startedAt,
                    node_version: hs.nodeVersion,
                    vice_bin: hs.viceBin,
                    max_instances: hs.maxInstances,
                    base_port: hs.basePort,
                    backend: hs.backend,
                });
            }
            else if (req.op === "monitor_claim") {
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                if (targetId === "") {
                    writeLine(socket, { kind: "error", code: "bad_request", message: "monitor_claim requires target_id" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, { kind: "error", code: "denied", message: MONITOR_OWNERSHIP_DENIAL });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `monitor_claim: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
                    });
                    return;
                }
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("claim");
                const outcome = opts.onMonitorClaim(requestId, targetId, channel);
                if (outcome.ok) {
                    writeLine(socket, { kind: "monitor_claimed" });
                }
                else if (outcome.code === "monitor_owned") {
                    // Ownership conflict, named by holder AND channel (plan 41-03,
                    // D-14) -- deliberately worded to never suggest the emulator
                    // itself has stopped answering (T-02-18; the plan's own grep gate
                    // polices this).
                    //
                    // WR-08 (broker side): `holder` is REQUIRED by MonitorClaimOutcome for
                    // this code, but this handler runs inside socket.on("data") with no
                    // try/catch above it, so a producer that ever omitted it would throw a
                    // TypeError out of the control listener and take the broker process
                    // with it -- a type contract is not a runtime guarantee at a wire
                    // boundary. The fallback names the holder as unknown rather than
                    // fabricating one (matching what the container-side client now does
                    // with a malformed holder payload), and defaults `channel` to the
                    // channel THIS request asked for -- never a fabricated third value.
                    const holder = outcome.holder ?? { grantId: "unknown", claimedAt: 0, pid: null, channel };
                    writeLine(socket, {
                        kind: "error",
                        code: "monitor_owned",
                        message: `instance already has a monitor client on the ${holder.channel} channel (grant ${holder.grantId}, claimed at ${holder.claimedAt}) -- this is an ownership conflict, not an emulator failure`,
                        holder,
                    });
                }
                else {
                    writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_claim failed: ${outcome.code}` });
                }
            }
            else if (req.op === "monitor_release") {
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                if (targetId === "") {
                    writeLine(socket, { kind: "error", code: "bad_request", message: "monitor_release requires target_id" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, { kind: "error", code: "denied", message: MONITOR_OWNERSHIP_DENIAL });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `monitor_release: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
                    });
                    return;
                }
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("release-monitor");
                const outcome = opts.onMonitorRelease(requestId, targetId, channel);
                if (outcome.ok) {
                    writeLine(socket, { kind: "monitor_released" });
                }
                else {
                    writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_release refused: ${outcome.code}` });
                }
            }
            else {
                writeLine(socket, { kind: "error", code: "bad_request", message: `unknown op: ${String(req.op)}` });
            }
        }
    });
}
/** Starts the TCP control listener: binds (bindControlListener()), then
 * attaches the full newline-delimited-JSON protocol (attachControlProtocol()
 * above) -- all five request kinds, the token gate, and the arrival-ordered
 * pending-acquire queue this listener instance owns. Frames inbound bytes as
 * newline-delimited JSON: buffers, splits on "\n", parses each line with
 * the never-throw posture this codebase already uses for untrusted input --
 * a malformed line answers `bad_request` and the connection survives. A
 * connection exceeding MAX_LINE_BYTES without a newline is destroyed rather
 * than buffered further (T-01.6.2-04). */
export function startControlListener(opts) {
    const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";
    const port = resolveControlPort(opts.port);
    return bindControlListener(host, port).then((bound) => {
        const pendingAcquires = [];
        attachControlProtocol(bound.server, opts, pendingAcquires);
        return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
    });
}
