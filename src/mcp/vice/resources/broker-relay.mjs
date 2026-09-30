// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-relay.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.ts copies THIS file's on-disk contents
// verbatim to .c64-re-tools/local/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-relay.mts
//
// Phase 63 (SESS-02): the client can no longer reach the emulator's binary-
// monitor port directly -- the broker owns the byte path now, splicing a
// relay connection straight through to a dialled emulator socket. That path
// must never round-trip through a JS string: a relayed binmon frame is
// arbitrary binary data, not valid UTF-8, and `chunk.toString("utf8")`
// mangles it silently (lone bytes in the 0x80-0xFF range collapse under
// UTF-8 replacement, and an embedded 0x00 survives a string round-trip only
// by accident). Every function in this file that touches a relayed byte
// works on a `Buffer`, never a `string`, past the one JSON handshake line
// this module ALSO has to read off the front of a brand-new connection
// before any splicing can begin.
//
// WHAT NOT TO DO:
//   - Never call `.toString("utf8")` (or any other string decode) on a
//     chunk that has already crossed, or is about to cross, the splice.
//     The one and only string decode in this file is readAttachLine()'s own
//     decode of the bytes STRICTLY BEFORE the first 0x0a -- the handshake
//     line itself, which this project's own JSON control protocol already
//     requires to be ASCII.
//   - Never hand-roll the byte copy loop between the two sockets.
//     `Socket.prototype.pipe()` is the stdlib primitive for exactly this
//     (Node streams already handle backpressure); this module uses it
//     directly rather than reinventing it.
//   - Never let a relay connection buffer pre-splice bytes without bound.
//     MAX_ATTACH_LINE_BYTES mirrors broker-control.mts's own MAX_LINE_BYTES
//     cap -- a connection that never sends a terminator is destroyed, not
//     buffered further.
import { connect as netConnect } from "node:net";
/**
 * The default, real implementation: sets the socket's own inactivity
 * timeout (`Socket.prototype.setTimeout()`) and routes its `"timeout"`
 * event to `onExpire`. THE COMPARISON THIS RELIES ON IS AT-OR-PAST THE
 * BOUND, NEVER STRICTLY PAST -- Node's own idle timer fires once at least
 * `ms` milliseconds have elapsed with no read or write activity, which is
 * the semantics this whole mechanism depends on; do not replace this with
 * a hand-rolled counter that uses strictly-past instead. The reset on
 * activity is ALSO the socket's own built-in behaviour for the underlying
 * Node timer -- `onActivity()` below additionally re-arms explicitly
 * (`socket.setTimeout(ms)` again), which is redundant for THIS real
 * implementation but keeps the `ArmedIdleTimer` contract uniform with an
 * injected fake, which has no such built-in reset to rely on.
 * `suspend()`/`resume()` track their own `suspended` flag locally so a
 * byte arriving while suspended (`onActivity()`) can never accidentally
 * un-suspend the deadline -- suspension and activity are two different
 * questions, and only `resume()` itself answers the first one.
 */
export const defaultArmIdleTimer = ({ socket, ms, onExpire }) => {
    let suspended = false;
    socket.on("timeout", onExpire);
    socket.setTimeout(ms);
    return {
        suspend: () => {
            suspended = true;
            socket.setTimeout(0);
        },
        resume: () => {
            suspended = false;
            socket.setTimeout(ms);
        },
        onActivity: () => {
            if (suspended)
                return;
            socket.setTimeout(ms);
        },
    };
};
/**
 * Splices an ALREADY-CONNECTED emulator socket (`opts.emulatorSocket`) to
 * `opts.clientSocket` with `Socket.prototype.pipe()` in BOTH directions --
 * never a hand-rolled copy loop, never a decode of either direction's
 * bytes. `opts.pending`, if non-empty, is written to the emulator socket
 * BEFORE either pipe is wired, so nothing the client already sent is
 * reordered behind a later chunk. Byte counters are updated from each
 * socket's own `"data"` listener, installed alongside (not instead of) the
 * pipe -- `pipe()` does not itself expose a running byte count.
 *
 * THIS FUNCTION NO LONGER DIALS (G-64-4, plan 64-12): it used to call an
 * injectable `connect` itself and splice the result immediately, before the
 * TCP connect had actually succeeded -- which is exactly what let a cold
 * session's first `attached` acknowledgement reach the client before the
 * freshly launched emulator had bound its monitor port at all (see
 * SpliceRelayOptions.emulatorSocket's own header comment for the full
 * incident). The dial is now dialEmulatorLeg()'s own job, awaited by the
 * caller (vice-broker.mts's handleRelayAttach()) BEFORE this function is
 * ever called; by the time this runs, the emulator leg is already
 * connected, and any FURTHER failure on it (a post-connect RST, an
 * idle-timeout close, an ordinary end) is reported through `onDeath()`
 * exactly as before -- never acted on here, never thrown. WHAT NOT TO DO:
 * never reintroduce a dial in this function, and never call it before the
 * emulator socket handed in has actually connected.
 *
 * DEATH DETECTION (Phase 63, SESS-03/04): each leg's own `"close"` event
 * carries Node's own `hadError` boolean -- MEASURED this session against a
 * real loopback pair (never assumed from the Node docs' prose alone): a
 * peer calling plain `.destroy()` OR `.end()` with no pending unread data
 * both deliver a graceful FIN to the OTHER side, so `"close"` fires with
 * `hadError: false` for BOTH -- there is no reliable way to tell a "no FIN"
 * abrupt death from a graceful one merely by watching for the ABSENCE of an
 * `"end"` event, because ordinary loopback TCP behaviour does not send an
 * RST just because the local side called `destroy()` rather than `end()`.
 * The one thing that DOES reliably produce `hadError: true` on the peer is
 * an actual transmission error -- a TCP RST, which `Socket.prototype.
 * resetAndDestroy()` sends explicitly, or any other genuine socket error --
 * and Node's own `"close"` event already classifies that for us. So:
 * `hadError` true -> `"relay_error"`; `hadError` false -> `"relay_close"`.
 * An explicit `"error"` event (which Node always fires BEFORE its own
 * following `"close"`) also reports `"relay_error"` directly, so a genuine
 * transmission error wins the race against its own later close regardless
 * of timing -- the per-channel guard below is what makes calling into the
 * notifier twice for the SAME death harmless.
 */
export function spliceRelay(opts) {
    const emulatorSocket = opts.emulatorSocket;
    let bytesClientToEmulator = 0;
    let bytesEmulatorToClient = 0;
    let deathReported = false;
    let closed = false;
    // Per-channel teardown guard (T-63-14): the FIRST death observed, from
    // EITHER leg, wins -- every later observation, on either leg, is a no-op.
    // This is the SAME guard `close()` below defers to implicitly via its own
    // `closed` flag; the two flags are deliberately separate booleans because
    // `onDeath()` (report) and the actual socket teardown (close()) are two
    // DIFFERENT moments in time now -- a caller is expected to write evidence
    // in between them, which is the entire point of splitting the two.
    function reportDeath(trigger) {
        if (deathReported)
            return;
        deathReported = true;
        opts.onDeath?.(trigger);
    }
    // Plan 63-04 Task 2 (SESS-04): the broker-owned idle deadline, armed ONLY
    // when a caller asked for one -- absent `idleMs` means this session
    // behaves exactly as it did before Task 2 existed. Applied to the
    // CLIENT-facing leg only (see SpliceRelayOptions.idleMs's own comment).
    const idleTimer = opts.idleMs === undefined ? null : (opts.armIdleTimer ?? defaultArmIdleTimer)({ socket: opts.clientSocket, ms: opts.idleMs, onExpire: () => reportDeath("relay_idle_expiry") });
    // The keepalive setting -- a labelled SECONDARY signal (see
    // DEFAULT_RELAY_KEEPALIVE_MS's own comment), applied only when asked for.
    if (opts.keepAliveMs !== undefined) {
        opts.clientSocket.setKeepAlive(true, opts.keepAliveMs);
    }
    function close(_trigger) {
        if (closed)
            return;
        closed = true;
        idleTimer?.suspend();
        if (!emulatorSocket.destroyed)
            emulatorSocket.destroy();
        if (!opts.clientSocket.destroyed)
            opts.clientSocket.destroy();
    }
    if (opts.pending && opts.pending.length > 0) {
        bytesClientToEmulator += opts.pending.length;
        emulatorSocket.write(opts.pending);
    }
    // Byte counters -- installed BESIDE the pipe wiring below, not instead of
    // it. `pipe()` consumes the same `"data"` events these listeners observe;
    // Node supports multiple listeners on the same event, and a `Readable`
    // fans the SAME chunk out to every one of them, so this in no way steals
    // bytes from the splice. Also resets the idle deadline on EITHER
    // direction's traffic (T-63-02's own "any byte resets it" requirement) --
    // a no-op when no idle timer was armed (idleTimer is null) or while
    // suspended (ArmedIdleTimer.onActivity()'s own contract).
    opts.clientSocket.on("data", (chunk) => {
        bytesClientToEmulator += chunk.length;
        idleTimer?.onActivity();
    });
    emulatorSocket.on("data", (chunk) => {
        bytesEmulatorToClient += chunk.length;
        idleTimer?.onActivity();
    });
    // The splice itself -- byte-transparent by construction, never a decode.
    opts.clientSocket.pipe(emulatorSocket);
    emulatorSocket.pipe(opts.clientSocket);
    // Death detection -- NEVER a destroy here anymore (Phase 63, SESS-03/05):
    // a caller must get the chance to write an incident record before either
    // socket is torn down, so this wiring only ever REPORTS, through
    // reportDeath() above, never acts. `hadError` is Node's OWN classification
    // (see this function's own header comment for why that -- not an "end"
    // presence check -- is the measured-reliable signal).
    opts.clientSocket.once("close", (hadError) => {
        reportDeath(hadError ? "relay_error" : "relay_close");
    });
    emulatorSocket.once("close", (hadError) => {
        reportDeath(hadError ? "relay_error" : "relay_close");
    });
    // Per-connection error isolation, matching broker-control.mts's own
    // per-connection `socket.on("error", () => {})` posture -- an unhandled
    // 'error' on either socket would otherwise crash this broker process.
    // Also reports the death: an "error" always precedes its own "close"
    // (Node's own event ordering), so this is what makes a genuine
    // transmission error win the race against the plain close handlers above,
    // via reportDeath()'s own once-only guard.
    opts.clientSocket.on("error", () => {
        reportDeath("relay_error");
    });
    emulatorSocket.on("error", () => {
        reportDeath("relay_error");
    });
    return {
        emulatorSocket,
        close,
        suspendIdle: () => idleTimer?.suspend(),
        resumeIdle: () => idleTimer?.resume(),
        bytesClientToEmulator: () => bytesClientToEmulator,
        bytesEmulatorToClient: () => bytesEmulatorToClient,
    };
}
/** Builds the ONE key `state.relaySessions` (broker-state.mts) is ever
 * indexed by -- `${grantId}:${channel}` -- so a grant id containing a colon
 * of its own cannot collide with a different grant/channel pair (a grant id
 * is a broker-minted request id, never caller-controlled free text, but this
 * keeps the key construction in exactly one place regardless). The ONE
 * function that builds this key; never hand-format it a second time. */
export function relaySessionKey(grantId, channel) {
    return `${grantId}:${channel}`;
}
/**
 * Resolves which emulator port an `attach` on `channel` should dial: the
 * instance record's own primary `port` for the binary channel, its own
 * `remoteMonitorPort` for the text channel. Never `instance.port` as a
 * fallback for a missing `remoteMonitorPort` -- that would dial the WRONG
 * emulator socket (the binary monitor) for a text attach, silently.
 */
export function resolveRelayChannelTarget(channel, targetId, instance) {
    if (channel === "text") {
        if (typeof instance.remoteMonitorPort !== "number") {
            return {
                ok: false,
                reason: `attach: target ${targetId} has no text-monitor port recorded -- refusing to dial the binary port or a guessed one`,
            };
        }
        return { ok: true, port: instance.remoteMonitorPort };
    }
    return { ok: true, port: instance.port };
}
/** Default deadline (ms) for the bounded emulator-leg dial -- about 35 times
 * the slowest real x64sc bind latency measured on this host (142ms). */
export const DEFAULT_RELAY_DIAL_DEADLINE_MS = 5000;
/** Default retry interval (ms) between ECONNREFUSED attempts -- puts the
 * first successful attempt within about this long of the emulator's own
 * bind, on real x64sc's measured 55-142ms bind latency. */
export const DEFAULT_RELAY_DIAL_RETRY_MS = 50;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** One connect attempt, settled exactly once on the FIRST of `"connect"` or
 * `"error"` -- never both, since each attempt removes the other's listener
 * the instant it fires. Resolves, never rejects: an `"error"` is data, not
 * an exception, to this function's own caller. */
function attemptEmulatorConnect(connectFn, host, port) {
    return new Promise((resolve) => {
        const socket = connectFn({ host, port });
        let settled = false;
        const onConnect = () => {
            if (settled)
                return;
            settled = true;
            socket.removeListener("error", onError);
            resolve({ connected: true, socket });
        };
        const onError = (err) => {
            if (settled)
                return;
            settled = true;
            socket.removeListener("connect", onConnect);
            resolve({ connected: false, code: err.code ?? null, socket });
        };
        socket.once("connect", onConnect);
        socket.once("error", onError);
    });
}
/**
 * The bounded emulator-leg dial (G-64-4): calls `opts.connect` (defaulting
 * to node:net's own), and on an `ECONNREFUSED` error destroys that
 * attempt's socket and tries again after `retryIntervalMs`, until
 * `deadlineMs` has elapsed -- any OTHER connect error (a different errno, a
 * refused host) fails at once, with no retry, since retrying it can never
 * change the outcome. Checks `opts.isAbandoned()` before every attempt and
 * again immediately after a successful connect, destroying the socket it
 * just opened if abandonment fired in that window (see
 * DialEmulatorLegOptions.isAbandoned's own comment). Never throws.
 */
export function dialEmulatorLeg(opts) {
    const connectFn = opts.connect ?? netConnect;
    const deadlineMs = opts.deadlineMs ?? DEFAULT_RELAY_DIAL_DEADLINE_MS;
    const retryIntervalMs = opts.retryIntervalMs ?? DEFAULT_RELAY_DIAL_RETRY_MS;
    const startedAt = Date.now();
    let attempts = 0;
    let lastErrorCode = null;
    return (async () => {
        for (;;) {
            if (opts.isAbandoned())
                return { ok: false, abandoned: true };
            attempts += 1;
            const attempt = await attemptEmulatorConnect(connectFn, opts.host, opts.port);
            if (attempt.connected) {
                if (opts.isAbandoned()) {
                    if (!attempt.socket.destroyed)
                        attempt.socket.destroy();
                    return { ok: false, abandoned: true };
                }
                return { ok: true, socket: attempt.socket };
            }
            if (!attempt.socket.destroyed)
                attempt.socket.destroy();
            lastErrorCode = attempt.code;
            if (attempt.code !== "ECONNREFUSED") {
                return {
                    ok: false,
                    abandoned: false,
                    reason: `connect failed with ${attempt.code ?? "an unknown error"} -- not retried (only ECONNREFUSED is retried)`,
                    lastErrorCode,
                    attempts,
                    elapsedMs: Date.now() - startedAt,
                };
            }
            const elapsedMs = Date.now() - startedAt;
            if (elapsedMs >= deadlineMs) {
                return {
                    ok: false,
                    abandoned: false,
                    reason: `no connection accepted after ${attempts} attempt(s) within ${deadlineMs}ms`,
                    lastErrorCode,
                    attempts,
                    elapsedMs,
                };
            }
            if (opts.isAbandoned())
                return { ok: false, abandoned: true };
            await delay(retryIntervalMs);
        }
    })();
}
/** Builds the ONE wire message a relay client sees for a dial that never
 * connected (G-64-4, plan 64-12, Task 2) -- from the channel, the port and
 * the deadline ONLY. Deliberately carries NO errno token and NO path:
 * stock-handler.ts's convertHandshakeError() has a container-bind branch
 * that matches a raw ECONNREFUSED/EHOSTUNREACH/ENETUNREACH token and tells
 * the caller to reconfigure VICE_BROKER_BINMON_HOST -- exactly the wrong
 * advice for an emulator that is merely still starting. The errno, the
 * attempt count and the elapsed time belong in the broker's OWN stderr
 * journal line (vice-broker.mts's own handleRelayAttach()), never here. */
export function buildEmulatorUnreachableMessage(channel, port, deadlineMs) {
    return (`attach: the emulator's ${channel} monitor at port ${port} did not accept a connection within ${deadlineMs}ms -- ` +
        `it may still be starting, or may have exited; retrying the same call is safe.`);
}
/** Default idle timeout (ms) applied to a relay connection carrying no
 * traffic in either direction (Plan 63-04, SESS-04) -- the broker's OWN
 * bounded deadline, never disabled silently. See resolveRelayIdleMs()'s own
 * comment for why this bound, specifically, is the one this broker actually
 * controls, unlike the keepalive setting below. */
export const DEFAULT_RELAY_IDLE_MS = 300000;
/** Default TCP keepalive delay (ms) arms on the client-facing relay socket
 * and on every accepted control connection (Plan 63-04, SESS-04) -- a
 * SECONDARY, labelled signal, never the bounded mechanism. `Socket.
 * prototype.setKeepAlive(true, ms)` sets ONLY the delay before the FIRST
 * probe; the interval BETWEEN probes and the number of probes past that
 * delay remain the host's own kernel settings (`tcp_keepalive_intvl`/
 * `tcp_keepalive_probes` on Linux), which this broker cannot change. State
 * this plainly wherever this constant is consumed, so nobody later mistakes
 * it for the owned bound -- that is resolveRelayIdleMs()'s own job. */
export const DEFAULT_RELAY_KEEPALIVE_MS = 30000;
/** Never-throw, never-silently-disabling env-var resolver shared by
 * resolveRelayIdleMs()/resolveRelayKeepAliveMs() below: an absent,
 * non-numeric, zero or negative raw value resolves to `fallback` and logs
 * the REJECTED raw value BY NAME -- neither resolver may ever return zero
 * (a zero bound would disable its own mechanism silently, which is exactly
 * the failure mode T-63-02's own mitigation forbids) and neither may
 * disable itself on a bad override. `envVarName` is named in the log line
 * so an operator sees exactly which variable was rejected, not merely "a
 * bad relay setting". */
function resolvePositiveMsFromEnv(envVarName, fallback) {
    const raw = process.env[envVarName];
    if (raw === undefined || raw === "")
        return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        console.error(`broker-relay: rejected ${envVarName}=${JSON.stringify(raw)} (must be a positive number) -- falling back to the default of ${fallback}ms`);
        return fallback;
    }
    return n;
}
/** Resolves the broker-OWNED idle deadline (Plan 63-04, SESS-04): reads
 * `VICE_BROKER_RELAY_IDLE_MS`, falling back to DEFAULT_RELAY_IDLE_MS on an
 * absent, non-numeric, zero or negative value (logged by name -- see
 * resolvePositiveMsFromEnv()'s own comment). This is the mechanism the
 * broker actually controls end-to-end: `Socket.prototype.setTimeout(ms)`
 * fires purely in userspace, on read+write inactivity, needing no
 * cooperation from the OS or the peer -- unlike the keepalive setting
 * below, which is a secondary, best-effort signal only. */
export function resolveRelayIdleMs() {
    return resolvePositiveMsFromEnv("VICE_BROKER_RELAY_IDLE_MS", DEFAULT_RELAY_IDLE_MS);
}
/** Resolves the keepalive delay (Plan 63-04, SESS-04): reads
 * `VICE_BROKER_RELAY_KEEPALIVE_MS`, same absent/non-numeric/zero/negative
 * fallback discipline as resolveRelayIdleMs() above. See
 * DEFAULT_RELAY_KEEPALIVE_MS's own comment for what this setting does NOT
 * bound -- the idle deadline above is the owned mechanism; this is a
 * labelled secondary one. */
export function resolveRelayKeepAliveMs() {
    return resolvePositiveMsFromEnv("VICE_BROKER_RELAY_KEEPALIVE_MS", DEFAULT_RELAY_KEEPALIVE_MS);
}
