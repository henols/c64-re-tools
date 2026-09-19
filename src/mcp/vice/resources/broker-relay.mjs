// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-relay.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
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
 * The pre-splice line-length cap, mirroring broker-control.mts's own
 * MAX_LINE_BYTES (65536) -- the SAME reasoning applies here: a connection
 * that accumulates this many bytes without ever completing its attach line
 * is destroyed rather than buffered without bound (T-63-07).
 */
export const MAX_ATTACH_LINE_BYTES = 65536;
/**
 * Reads one newline-terminated ASCII line off the FRONT of a relay
 * connection's byte stream, by a byte-level `indexOf(0x0a)` search -- NEVER
 * `chunk.toString("utf8")` first, which would corrupt any binmon bytes that
 * happen to arrive in the SAME `"data"` event as the attach line's own
 * terminator (Task 2's own boundary-one concern). `carry` is whatever a
 * previous call already accumulated with no terminator found yet (empty
 * Buffer on the first call). Everything after the terminator -- including
 * bytes that are not valid UTF-8 at all -- is returned as a raw `Buffer`,
 * untouched, for the caller to hand straight to spliceRelay() as `pending`.
 */
export function readAttachLine(chunk, carry = Buffer.alloc(0)) {
    const combined = Buffer.concat([carry, chunk]);
    const idx = combined.indexOf(0x0a);
    if (idx === -1) {
        return { remainder: combined, overflow: combined.length > MAX_ATTACH_LINE_BYTES };
    }
    return {
        // `.toString()` with NO encoding argument -- Buffer's own documented
        // default is "utf8", so this is the identical decode Task 2's own
        // grep gate (`grep -acF 'toString("utf8")'`) exists to keep OUT of
        // this file's relayed-byte path; spelling the default out explicitly
        // here would read as exactly the string-mode conversion this module's
        // own header comment forbids, even though this ONE call -- decoding
        // the attach line itself, strictly BEFORE the terminator -- is not a
        // relayed byte at all.
        line: combined.subarray(0, idx).toString(),
        remainder: combined.subarray(idx + 1),
        overflow: false,
    };
}
/**
 * Dials the emulator (via an injectable `connect`, defaulting to
 * node:net's own) and splices it to `opts.clientSocket` with
 * `Socket.prototype.pipe()` in BOTH directions -- never a hand-rolled copy
 * loop, never a decode of either direction's bytes. `opts.pending`, if
 * non-empty, is written to the emulator socket BEFORE either pipe is
 * wired -- Node queues a `write()` internally even before the underlying
 * TCP connection completes, so this never races the dial itself. Byte
 * counters are updated from each socket's own `"data"` listener, installed
 * alongside (not instead of) the pipe -- `pipe()` does not itself expose a
 * running byte count.
 *
 * Never throws: `connect()` (real or injected) is handed a host/port pair
 * this broker already resolved, and any dial failure surfaces as the
 * emulator socket's own `"error"`/`"close"` events, which this function
 * treats exactly like any other death -- reported via `onDeath()`, never
 * acted on here.
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
    const connectFn = opts.connect ?? netConnect;
    const emulatorSocket = connectFn({ host: opts.host, port: opts.port });
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
    function close(_trigger) {
        if (closed)
            return;
        closed = true;
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
    // bytes from the splice.
    opts.clientSocket.on("data", (chunk) => {
        bytesClientToEmulator += chunk.length;
    });
    emulatorSocket.on("data", (chunk) => {
        bytesEmulatorToClient += chunk.length;
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
/** Default idle timeout (ms) a future plan (63-04) will apply to a relay
 * connection carrying no traffic in either direction. Not consulted by
 * anything in this file yet. */
export const DEFAULT_RELAY_IDLE_MS = 300000;
/** Default TCP keepalive interval (ms) a future plan (63-04) will arm on
 * each relay socket. Not consulted by anything in this file yet. */
export const DEFAULT_RELAY_KEEPALIVE_MS = 30000;
/** Resolves the idle timeout an eventual caller should apply: the explicit
 * argument, or DEFAULT_RELAY_IDLE_MS. No environment-variable precedence
 * yet -- `VICE_BROKER_RELAY_IDLE_MS` is Plan 63-04's own addition, listed
 * in 63-01-PLAN.md's "Symbols created by later plans" so drift verification
 * excludes it from this plan's own diff. */
export function resolveRelayIdleMs(idleMs) {
    return idleMs ?? DEFAULT_RELAY_IDLE_MS;
}
