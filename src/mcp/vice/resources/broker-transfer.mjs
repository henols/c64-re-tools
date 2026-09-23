// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-transfer.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-transfer.mts
//
// Phase 64 (XFER-01..08, D-01/D-02/D-04): the ONE module that owns a file
// payload crossing a socket, in either direction, on either side of the
// broker/client boundary. Before this phase, the only bytes this codebase
// ever moved across a shared boundary were request/response frames small
// enough to fit in one buffer (`stock-protocol.ts`) or a relayed
// binary-monitor byte stream with no length, digest or cap of its own
// (`broker-relay.mts`). A file payload is different: it has a KNOWN length
// and a digest to verify, framed as one JSON header line (`writeTransferHeader`/
// `readTransferHeader`) followed by exactly N raw bytes, per D-02. This file
// is the one place that framing, the streaming send (`sendPayloadFromFile`)
// and the streaming, cap-and-digest-verified receive
// (`receivePayloadToFile`) live.
//
// WHAT NOT TO DO:
//   - Never call `.toString("utf8")` (or any other string decode) on a
//     payload byte. The ONE string decode anywhere in this file is
//     `readTransferHeader()`'s own decode of the bytes STRICTLY BEFORE the
//     header line's own `0x0a` terminator -- copied from
//     `broker-relay.mts`'s `readAttachLine()`, the same byte-level
//     terminator-search shape.
//   - Never hand-roll the byte copy loop between a file and a socket.
//     `pipeline()` from `node:stream/promises` owns backpressure end to
//     end, in both directions -- `broker-relay.mts`'s own header names this
//     exact prohibition for its splice, and it applies here identically.
//   - Never buffer the whole payload before hashing or cap-checking it.
//     Every byte this file moves passes through
//     `transfer-hash.mts`'s `createHashAndCountTransform()`, which enforces
//     the cap and updates the digest AS BYTES ARRIVE -- never after
//     accumulating the whole payload (Pitfall 3, `64-RESEARCH.md`).
import { createReadStream, createWriteStream, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
// VALUE import of a sibling host-bound module uses the COMPILED artifact's
// own ".mjs" extension -- the same convention every other host-bound sibling
// in this directory follows (vice-broker.mts's own imports of
// "./broker-relay.mjs" etc.) -- because tsconfig.build.json disallows a
// ".mts"-suffixed import specifier (`allowImportingTsExtensions: false`) and
// NodeNext module resolution maps a ".mjs" specifier written in a ".mts"
// source file back to its sibling ".mts" source for type-checking, while
// resolving to the real compiled ".mjs" at runtime. This means
// broker-transfer.test.mts, like broker-relay.test.ts, must build() first
// and import the COMPILED resources/broker-transfer.mjs rather than this
// source file directly -- see that test file's own header comment.
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mjs";
/** A `Writable` that discards every chunk written to it -- the drain sink a
 * digest-only pass needs. `createHashAndCountTransform()`'s Transform is
 * BOTH readable and writable: piping a real source into it produces output
 * on its readable side that something must consume, or the internal buffer
 * fills to its `highWaterMark` and backpressure stalls the whole pipeline
 * forever (measured live against this exact shape while writing this
 * module's own tracer test -- `pipeline(source, transform)` with no third
 * stream hangs indefinitely on any file past a few KB). `sendPayloadFromFile()`'s
 * digest-only first pass needs the digest and byte count, not the bytes
 * themselves, so this sink drains the Transform's own passthrough output
 * with no destination file and no memory growth. */
function discardSink() {
    return new Writable({
        write(_chunk, _encoding, callback) {
            callback();
        },
    });
}
/** The pre-terminator line-length cap, mirroring `broker-relay.mts`'s own
 * `MAX_ATTACH_LINE_BYTES` (65536) -- same reasoning: a connection that
 * accumulates this many bytes without ever completing its header line is an
 * overflow, never buffered further. */
export const MAX_TRANSFER_HEADER_LINE_BYTES = 65536;
/**
 * Serialises `header` to one JSON line, terminated by a single `0x0a`, and
 * writes it to `socket`. The only encoder in this file's send-side path --
 * everything written after this call is raw payload bytes, streamed through
 * `pipeline()`, never through this function again.
 */
export function writeTransferHeader(socket, header) {
    socket.write(JSON.stringify(header) + "\n");
}
/**
 * Reads one newline-terminated JSON header line off the FRONT of a transfer
 * connection's byte stream, by the same byte-level `indexOf(0x0a)` search
 * `broker-relay.mts`'s `readAttachLine()` uses -- NEVER `chunk.toString()`
 * on the accumulator as a whole, which would corrupt any payload byte that
 * happens to arrive in the SAME `"data"` event as the header's own
 * terminator. `carry` is whatever a previous call already accumulated with
 * no terminator found yet (empty Buffer on the first call).
 *
 * The header line is parsed inside try/catch and every field is type-checked
 * before use -- a malformed header is a REFUSAL (`error` set), never a thrown
 * exception past this function's own boundary. This is a first, cheap type
 * check only (string/number shape); the deeper "is `byteLength` actually a
 * safe, non-negative, in-cap integer" validation happens again, independently,
 * inside `receivePayloadToFile()` itself (D-11: the declared length is
 * untrusted input, checked wherever it is consumed, not only once at parse
 * time).
 */
export function readTransferHeader(chunk, carry = Buffer.alloc(0)) {
    const combined = Buffer.concat([carry, chunk]);
    const idx = combined.indexOf(0x0a);
    if (idx === -1) {
        return { remainder: combined, overflow: combined.length > MAX_TRANSFER_HEADER_LINE_BYTES };
    }
    // `.toString()` with no encoding argument -- Buffer's own documented
    // default is "utf8" -- decoding ONLY the header line itself, strictly
    // before the terminator. Everything from `idx + 1` on is returned as a
    // raw Buffer, untouched, whatever byte values it holds.
    const lineText = combined.subarray(0, idx).toString();
    const remainder = combined.subarray(idx + 1);
    let parsed;
    try {
        parsed = JSON.parse(lineText);
    }
    catch {
        return { remainder, overflow: false, error: "vice: transfer header line is not valid JSON" };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { remainder, overflow: false, error: "vice: transfer header line is not a JSON object" };
    }
    const obj = parsed;
    if (typeof obj.kind !== "string") {
        return { remainder, overflow: false, error: `vice: transfer header field 'kind' must be a string, got ${JSON.stringify(obj.kind)}` };
    }
    if (typeof obj.sha256 !== "string") {
        return { remainder, overflow: false, error: `vice: transfer header field 'sha256' must be a string, got ${JSON.stringify(obj.sha256)}` };
    }
    if (typeof obj.byteLength !== "number") {
        return { remainder, overflow: false, error: `vice: transfer header field 'byteLength' must be a number, got ${JSON.stringify(obj.byteLength)}` };
    }
    return { header: { kind: obj.kind, byteLength: obj.byteLength, sha256: obj.sha256 }, remainder, overflow: false };
}
/**
 * Sends `sourcePath`'s bytes over `socket` as one transfer: stats the file
 * and refuses BEFORE opening the socket write when its size exceeds
 * `capBytes` (D-11's sender half -- fail fast, nothing wasted, one round
 * trip), then computes its digest with a first streaming pass (never a
 * `readFileSync`-whole-file read, per `transfer-hash.mts`'s own header --
 * the header line this function writes must declare the digest BEFORE any
 * payload byte moves, and a digest can only be known by having processed
 * every byte), writes the header, then streams the SAME file a second time
 * through a fresh cap-and-digest `Transform` straight onto the socket.
 * Resolves `{ ok: true, byteLength, sha256 }` on success or
 * `{ ok: false, reason }` on any failure -- never throws.
 */
export async function sendPayloadFromFile({ socket, sourcePath, capBytes = TRANSFER_MAX_BYTES }) {
    let size;
    try {
        size = statSync(sourcePath).size;
    }
    catch (e) {
        return { ok: false, reason: `vice: cannot read source file ${sourcePath}: ${e.message}` };
    }
    if (size > capBytes) {
        return {
            ok: false,
            reason: `vice: transfer exceeds the ${capBytes} byte cap (sixteen mebibytes); source file ${sourcePath} is ${size} bytes`,
        };
    }
    // First pass: digest the file streaming, never loading it whole into
    // memory (Pitfall 3) -- needed because the header, written BEFORE any
    // payload byte, must already declare the digest.
    const digestPass = createHashAndCountTransform({ capBytes });
    try {
        await pipeline(createReadStream(sourcePath), digestPass, discardSink());
    }
    catch (e) {
        return { ok: false, reason: `vice: failed to digest source file ${sourcePath}: ${e.message}` };
    }
    const { byteLength, sha256 } = digestPass.result();
    writeTransferHeader(socket, { kind: "file", byteLength, sha256 });
    // Second pass: the real send, through a FRESH Transform instance (a
    // Transform is single-use) -- re-enforces the cap from bytes actually
    // read this pass, independently of the first pass's own count.
    const sendPass = createHashAndCountTransform({ capBytes });
    try {
        await pipeline(createReadStream(sourcePath), sendPass, socket);
    }
    catch (e) {
        return { ok: false, reason: `vice: transfer failed while sending ${sourcePath}: ${e.message}` };
    }
    return { ok: true, byteLength, sha256 };
}
/**
 * Receives one transfer's payload from `socket` into `destPath`: validates
 * the header's OWN declared `byteLength` first (D-11 -- a non-negative safe
 * integer at or below `capBytes`, refused by name before a single payload
 * byte is consumed if not), then streams `socket`'s bytes through a fresh
 * cap-and-digest `Transform` into a temp file in `destPath`'s OWN directory
 * (so the final rename is same-filesystem, never `EXDEV`), then compares the
 * OBSERVED byte count and digest against the header's DECLARED values with
 * `verifyObserved()`. On agreement, atomically publishes the temp file to
 * `destPath` with `renameSync()` -- the ONLY way a byte becomes visible at
 * the final name. On ANY failure path -- a malformed declared length, the
 * observed cap firing mid-stream, a short read, a digest mismatch, a
 * destroyed socket, a failed rename -- the temp file is removed with
 * `rmSync(..., { force: true })` and this function resolves
 * `{ ok: false, reason }`. Never throws.
 */
export async function receivePayloadToFile({ socket, destPath, header, pending, capBytes = TRANSFER_MAX_BYTES }) {
    // The declared byteLength is untrusted input (D-11) -- validated here,
    // independently of whatever check `readTransferHeader()` may already have
    // run, because this function is directly callable with a hand-built
    // header too. Refused BEFORE the pipeline is ever constructed.
    if (typeof header.byteLength !== "number" || !Number.isSafeInteger(header.byteLength) || header.byteLength < 0) {
        return {
            ok: false,
            reason: `vice: transfer header field 'byteLength' must be a non-negative safe integer, got ${JSON.stringify(header.byteLength)}`,
        };
    }
    if (header.byteLength > capBytes) {
        return {
            ok: false,
            reason: `vice: transfer declared byteLength ${header.byteLength} exceeds the ${capBytes} byte cap (sixteen mebibytes)`,
        };
    }
    if (pending && pending.length > 0) {
        socket.unshift(pending);
    }
    mkdirSync(dirname(destPath), { recursive: true });
    const tmpPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;
    const cleanupTmp = () => {
        try {
            rmSync(tmpPath, { force: true });
        }
        catch {
            // Best-effort cleanup -- a failure removing an already-removed or
            // never-created temp file must never mask the real refusal reason.
        }
    };
    const expected = { byteLength: header.byteLength, sha256: header.sha256 };
    const transform = createHashAndCountTransform({ capBytes });
    try {
        await pipeline(socket, transform, createWriteStream(tmpPath));
    }
    catch (e) {
        cleanupTmp();
        return { ok: false, reason: `vice: transfer failed while receiving into ${destPath}: ${e.message}` };
    }
    const observed = transform.result();
    const verdict = verifyObserved(expected, observed);
    if (!verdict.ok) {
        cleanupTmp();
        return { ok: false, reason: verdict.reason };
    }
    try {
        renameSync(tmpPath, destPath);
    }
    catch (e) {
        cleanupTmp();
        return { ok: false, reason: `vice: failed to publish ${destPath}: ${e.message}` };
    }
    return { ok: true, byteLength: observed.byteLength, sha256: observed.sha256 };
}
