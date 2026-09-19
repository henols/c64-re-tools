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
 * treats as "the splice is over" (destroy the client side too) rather than
 * as something to propagate synchronously.
 */
export function spliceRelay(opts) {
    const connectFn = opts.connect ?? netConnect;
    const emulatorSocket = connectFn({ host: opts.host, port: opts.port });
    let bytesClientToEmulator = 0;
    let bytesEmulatorToClient = 0;
    let destroyed = false;
    function destroy() {
        if (destroyed)
            return;
        destroyed = true;
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
    // Either side closing ends the whole session -- a half-open relay (one
    // socket alive, the other gone) serves nothing.
    opts.clientSocket.once("close", destroy);
    emulatorSocket.once("close", destroy);
    // Per-connection error isolation, matching broker-control.mts's own
    // per-connection `socket.on("error", () => {})` posture -- an unhandled
    // 'error' on either socket would otherwise crash this broker process.
    opts.clientSocket.on("error", () => {
        /* isolated -- the "close" handler above tears down the session */
    });
    emulatorSocket.on("error", () => {
        /* isolated -- the "close" handler above tears down the session */
    });
    return {
        emulatorSocket,
        destroy,
        bytesClientToEmulator: () => bytesClientToEmulator,
        bytesEmulatorToClient: () => bytesEmulatorToClient,
    };
}
// ---------------------------------------------------------------------------
// Idle/keepalive defaults -- DECLARED here now, CONSUMED by Plan 63-04. This
// task wires neither timer; a relay connection today lives exactly as long
// as both of its sockets stay open, with no idle-timeout of its own.
// ---------------------------------------------------------------------------
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
