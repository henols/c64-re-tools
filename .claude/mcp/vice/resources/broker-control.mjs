// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-control.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-control.mts
//
// N / D-01 (plan 01, tracer): the framing, the token gate, and acquire/
// release. THIS PLAN (05) completes the message set: recycle, status,
// host_state, the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's low-level bind primitive. The
// subsystem's FIRST network listener: a TCP control plane replacing the
// bash broker's requests/grants/denials/leases directory tree entirely. One
// JSON object per line; the connection open IS the claim, connection close
// IS the release (T-01.6.2-01 through -09).
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
        function attemptAcquire(requestId) {
            // Half one: a queued entry whose owning socket is already gone is
            // settled immediately, WITHOUT ever calling onAcquire() -- this is
            // what keeps a retried drain pass from performing a real, ownerless
            // launch.
            if (socket.destroyed)
                return Promise.resolve(true);
            return opts
                .onAcquire(requestId)
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
            if (req.op === "acquire") {
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
                void attemptAcquire(requestId).then((settled) => {
                    if (!settled) {
                        enqueueAcquire(pendingAcquires, { requestId, attempt: () => attemptAcquire(requestId) });
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
                // empty for this case.
                if (requestIdForThisConnection === null || targetId !== requestIdForThisConnection) {
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
                    warm_floor: hs.warmFloor,
                    max_instances: hs.maxInstances,
                    base_port: hs.basePort,
                });
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
