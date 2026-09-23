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
//   - Never delete a staged file on an AUTOSTART/DUMP/UNDUMP reply. A reply
//     confirms the command was ACCEPTED, not that the load completed -- for
//     `vice_disk_attach` the image must stay attached to unit 8 for the rest
//     of the session (D-05). The failure a reader would otherwise cause: a
//     disk pulled out from under a running emulator. This module's staging
//     surface (below) is deleted ONLY on a fresh `stageFileSlot()` for the
//     SAME (grantId, slot) -- which supersedes, never a command reply -- or
//     on `clearStagingForSession()`, which runs when the session's own
//     connection closes (XFER-07), never when a command merely answers.
import { createReadStream, createWriteStream, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import { brokerStagingDir, ensureBrokerDir } from "./broker-home.mjs";
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
export async function sendPayloadFromFile({ socket, sourcePath, capBytes = TRANSFER_MAX_BYTES, kind = "file" }) {
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
    writeTransferHeader(socket, { kind, byteLength, sha256 });
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
/** Handle -> entry. The ONE map `resolveStagedFile()` reads and every other
 * function in this section writes -- there is no second copy of a staged
 * entry anywhere in this module. */
const handleIndex = new Map();
/** `(grantId, slot)` -> the CURRENT handle for that slot, joined with a NUL
 * byte -- a byte `refuseUnsafeSegment()` below already refuses inside
 * either half, so this composite key can never collide ambiguously between
 * two different (grantId, slot) pairs. */
const slotIndex = new Map();
/** The set of handles with a transfer currently in flight -- membership
 * check and insertion are a single synchronous pair with no `await` between
 * them (`markTransferInFlight()` below), the same discipline
 * `broker-launch.mts`'s single-owner launch guard already keeps, for the
 * same reason (T-64-16). */
const inFlightHandles = new Set();
function stagingSlotKey(grantId, slot) {
    return `${grantId}\u0000${slot}`;
}
/** Refuse-not-sanitise: `candidate` must be non-empty, contain no NUL byte,
 * not be exactly `.` or `..`, and contain no path separator at all (`/` or
 * `\`) -- refusing every separator unconditionally also catches every
 * absolute-path and traversal-segment case, since none of those forms can
 * exist without one. `label` names the field in the refusal message; the
 * refusal never echoes the offending value itself (T-64-13's own posture
 * for a handle refusal, applied here too). */
function refuseUnsafeSegment(candidate, label) {
    if (candidate.includes("\u0000"))
        return { ok: false, reason: `vice: ${label} contains a NUL byte` };
    if (candidate.length === 0)
        return { ok: false, reason: `vice: ${label} is empty` };
    if (candidate === "." || candidate === "..")
        return { ok: false, reason: `vice: ${label} is '${candidate}'` };
    if (candidate.includes("/") || candidate.includes("\\"))
        return { ok: false, reason: `vice: ${label} contains a path separator` };
    return { ok: true };
}
/**
 * Mints a handle for `(grantId, slot)`, creating the grant's own staging
 * session directory (`<brokerStagingDir()>/<grantId>/`) if absent, and
 * returns `{ ok: true, handle, stagedPath }` where `stagedPath` is the
 * ABSOLUTE path the emulator itself must open -- the staged file's own name
 * is the handle, so the filename carries no client-supplied text at all.
 *
 * A repeat call for the SAME `(grantId, slot)` SUPERSEDES the previous entry
 * (D-05): the previous handle's file is best-effort unlinked (a failure here
 * must never fail the NEW staging request), the previous handle is dropped
 * from every index, and the new handle is installed in its place -- staged
 * bytes are bounded by (slots x cap), never (uploads x cap).
 *
 * `grantId` and `slot` are both refused, never rewritten, when either fails
 * `refuseUnsafeSegment()` above -- BEFORE any directory is created.
 */
export function stageFileSlot({ grantId, slot, now = Date.now }) {
    const grantCheck = refuseUnsafeSegment(grantId, "grant id");
    if (!grantCheck.ok)
        return { ok: false, reason: grantCheck.reason };
    const slotCheck = refuseUnsafeSegment(slot, "slot");
    if (!slotCheck.ok)
        return { ok: false, reason: slotCheck.reason };
    const sessionDir = join(brokerStagingDir(), grantId);
    ensureBrokerDir(sessionDir);
    const handle = randomBytes(16).toString("hex");
    const stagedPath = join(sessionDir, handle);
    const key = stagingSlotKey(grantId, slot);
    const previousHandle = slotIndex.get(key);
    if (previousHandle) {
        const previousEntry = handleIndex.get(previousHandle);
        handleIndex.delete(previousHandle);
        inFlightHandles.delete(previousHandle);
        if (previousEntry) {
            try {
                rmSync(previousEntry.path, { force: true });
            }
            catch {
                // Best-effort unlink -- a superseding stage must never fail because
                // the PREVIOUS file could not be removed (D-05).
            }
        }
    }
    const entry = { handle, path: stagedPath, grantId, slot, claimedAt: now() };
    handleIndex.set(handle, entry);
    slotIndex.set(key, handle);
    return { ok: true, handle, stagedPath };
}
/**
 * A handle-index lookup, nothing more -- this function does NOT check
 * whether `entry.path` still exists on disk (a caller wanting THAT question
 * answered, e.g. a download, checks it itself; see `vice-broker.mts`'s own
 * `handleFileTransfer()`). Returns a refusal, never revealing the staging
 * path, for an unknown, empty, or superseded handle -- a superseded handle
 * is simply no longer a key in `handleIndex` at all, so it refuses by the
 * SAME "unknown" path as a handle that was never minted.
 */
export function resolveStagedFile(handle) {
    const entry = handleIndex.get(handle);
    if (!entry)
        return { ok: false, reason: "vice: unknown transfer handle" };
    return { ok: true, entry };
}
/**
 * The in-flight guard a transfer dispatch arm takes before streaming a
 * single byte (T-64-16): the membership check and the set insertion below
 * are ONE synchronous statement pair, with no `await` between them, so two
 * concurrent transfers presenting the SAME handle cannot both observe an
 * empty set and both proceed.
 */
export function markTransferInFlight(handle) {
    if (inFlightHandles.has(handle)) {
        return { ok: false, reason: "vice: a transfer for this handle is already in flight" };
    }
    inFlightHandles.add(handle);
    return { ok: true };
}
/** Releases the in-flight guard for `handle` -- a no-op if it was never
 * held (a caller's own `finally` block calls this unconditionally on every
 * path, including refusals, per this plan's own wiring contract). */
export function clearTransferInFlight(handle) {
    inFlightHandles.delete(handle);
}
/**
 * D-06's whole point: "gone when the session closes" is ONE recursive
 * delete of ONE directory, never per-file bookkeeping. Removes
 * `<brokerStagingDir()>/<grantId>/` recursively (best-effort -- a directory
 * that never existed, or one already removed, is tolerated as a no-op, not
 * an error), then drops every registry entry this grant ever staged, across
 * every index in this module. Called from `vice-broker.mts`'s own
 * `handleRelease()` -- the SAME function the control-plane's `onRelease`
 * callback invokes BOTH on an explicit `release` request AND on the
 * control connection's own close event (`broker-control.mts`'s own
 * `onRelease` header comment), so a client killed with `SIGKILL` -- which
 * sends no goodbye, only a socket close -- still loses its staging.
 */
export function clearStagingForSession(grantId) {
    const sessionDir = join(brokerStagingDir(), grantId);
    try {
        rmSync(sessionDir, { recursive: true, force: true });
    }
    catch {
        // Best-effort -- a directory that never existed (no slot was ever
        // staged for this grant) must not be treated as a failure.
    }
    const prefix = `${grantId}\u0000`;
    for (const [handle, entry] of handleIndex) {
        if (entry.grantId === grantId) {
            handleIndex.delete(handle);
            inFlightHandles.delete(handle);
        }
    }
    for (const key of Array.from(slotIndex.keys())) {
        if (key.startsWith(prefix))
            slotIndex.delete(key);
    }
}
/** Test-only reset, following `stock-paths.ts`'s `setIsInsideContainerForTest()`
 * / `stock-runstate.ts`'s `resetRunStateTrackersForTest()` precedent: a
 * module-level registry must not leak state between test cases in the SAME
 * process. Production code never calls this. */
export function resetStagingForTest() {
    handleIndex.clear();
    slotIndex.clear();
    inFlightHandles.clear();
}
