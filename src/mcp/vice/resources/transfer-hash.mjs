// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from transfer-hash.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.ts copies THIS file's on-disk contents
// verbatim to .c64-re-tools/local/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// transfer-hash.mts
//
// Phase 64 (XFER-05/XFER-06, D-04/D-09/D-10/D-11): before this phase, nothing
// in this codebase streamed a `Transform` over an unbounded byte source at
// all -- confirmed by a repo-wide grep this phase's own research ran.
// `host-tool.mts`'s `digestOutputFile()` is the closest precedent, and it
// reads its whole (already-small, already-on-disk) target into memory with
// `readFileSync` before hashing it. That shape is the exact OOM ceiling this
// module exists to avoid: `broker-transfer.mts` moves a payload that is
// capped at sixteen mebibytes today, and Phase 65's host-tool outputs (tens
// of megabytes) ride this same code later. This module is the ONE place a
// payload's running byte count and running sha256 digest are computed, and
// the ONE place the sixteen-mebibyte cap is written down as a number.
//
// WHAT NOT TO DO:
//   - Never buffer the whole payload before hashing or cap-checking it.
//     `createHashAndCountTransform()`'s `_transform` updates the count and
//     the digest as EACH chunk arrives -- never after a `Buffer.concat()` of
//     accumulated chunks (Pitfall 3, `64-RESEARCH.md`).
//   - Never make `TRANSFER_MAX_BYTES` settable by an environment variable, a
//     wire field, a tool argument or any other runtime input (D-10). It is a
//     plain module constant, read by no `process.env` lookup anywhere in
//     this file -- a cap an agent can talk a user into raising is not a cap.
//   - The cap check on each chunk runs BEFORE the hash update, so a refused
//     transfer's digest never reflects a byte past the limit.
import { Transform } from "node:stream";
import { createHash } from "node:crypto";
/**
 * Sixteen mebibytes (D-09) -- the one size a transfer payload is capped at,
 * in either direction. A module constant: it reads no environment variable
 * and takes no override parameter anywhere production code calls it (D-10).
 * `HashAndCountOptions.capBytes` exists ONLY so a test can probe a smaller
 * boundary cheaply without allocating a real sixteen-mebibyte fixture for
 * every case; no production caller in this tree ever passes it.
 */
export const TRANSFER_MAX_BYTES = 16 * 1024 * 1024;
/**
 * A `Transform` that passes every chunk through unchanged while
 * incrementally computing a running byte count and a sha256 digest, and
 * refusing (via `callback(error)`) the instant the OBSERVED count exceeds
 * `capBytes` -- independently of anything a peer may have declared about the
 * payload's length (D-11). The cap check runs BEFORE the hash update on
 * every chunk, so a refused transfer's digest never reflects a byte past the
 * limit, and the comparison is strictly-greater: a payload of exactly
 * `capBytes` observed bytes is accepted, `capBytes + 1` is the first refused
 * count.
 *
 * `result()` is only a complete answer once the stream has actually
 * finished (its own `"finish"` event, or -- the common case in this
 * codebase -- once a `pipeline()` built from this Transform has resolved).
 * Calling it earlier returns whatever has been observed so far, which is a
 * valid but incomplete snapshot; the digest itself is idempotent to read
 * more than once (`Hash.prototype.digest()` throws on a second call, so this
 * function caches the finalised hex string after the first read).
 */
export function createHashAndCountTransform(options = {}) {
    const capBytes = options.capBytes ?? TRANSFER_MAX_BYTES;
    const hash = createHash("sha256");
    let byteLength = 0;
    let digestHex = null;
    const transform = new Transform({
        transform(chunk, _encoding, callback) {
            byteLength += chunk.length;
            if (byteLength > capBytes) {
                callback(new Error(`vice: transfer exceeds the ${capBytes} byte cap (sixteen mebibytes); observed at least ${byteLength} bytes so far`));
                return;
            }
            hash.update(chunk);
            callback(null, chunk);
        },
    });
    transform.result = () => {
        if (digestHex === null)
            digestHex = hash.digest("hex");
        return { byteLength, sha256: digestHex };
    };
    return transform;
}
/**
 * Compares a transfer's DECLARED values (from its header line) against its
 * OBSERVED values (from `createHashAndCountTransform()`'s `result()`),
 * checking both the byte count and the hex digest. Returns a discriminated
 * result naming WHICH field disagreed and both values, never a bare
 * boolean -- a caller (`receivePayloadToFile()`) uses the `reason` string
 * directly as the refusal message.
 */
export function verifyObserved(expected, observed) {
    if (expected.byteLength !== observed.byteLength) {
        return {
            ok: false,
            reason: `vice: transfer byte count mismatch -- header declared ${expected.byteLength} bytes, observed ${observed.byteLength} bytes`,
        };
    }
    if (expected.sha256 !== observed.sha256) {
        return {
            ok: false,
            reason: `vice: transfer digest mismatch -- header declared sha256 ${expected.sha256}, observed sha256 ${observed.sha256}`,
        };
    }
    return { ok: true };
}
