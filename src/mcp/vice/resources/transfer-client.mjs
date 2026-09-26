// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from transfer-client.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// transfer-client.mts
//
// Phase 65 (SEAM-01, D-01/D-02/D-11): the ONE container-side place a payload
// actually crosses the fixed endpoint, in either direction. Before this
// plan, `stock-connect.ts` carried this exact logic as its own
// `defaultTransferFile()` -- correct, but reachable only from that one
// module. Phase 65's own host-tool route (`host-tool-endpoint.mts`) needs
// the identical upload/download shape for a skill script's input/output
// files, so this module gives both callers ONE driver rather than a second,
// drifting copy. `stock-connect.ts` now imports `transferFileOverEndpoint()`
// from here as its own `transferFile` default and re-exports the three
// request/result types unchanged, so every existing caller and test sees no
// behavioural change at all.
//
// This module also owns `validateContainedDestination()` (moved here from
// `transfer-paths.ts`, D-13/XFER-03): `transfer-paths.ts` imports
// `repo-root.ts` (via `toolsDir()`), and `host-tool-endpoint.mts` (this
// plan) must NOT import `repo-root.ts` at all (it never resolves this
// project's own workspace root -- every path it writes is relative to a
// CALLER-supplied `toolsRoot`). Keeping the validator here, with no
// `repo-root.ts` import anywhere in this file, keeps it reachable from
// `host-tool-endpoint.mts` without dragging that import along.
// `transfer-paths.ts` re-exports both the function and its result type
// unchanged, so every existing importer of `transfer-paths.ts` keeps
// working with no edit of its own.
//
// WHAT NOT TO DO:
//   - Never import `broker-transfer.mts` directly. That module is `.mts`,
//     host-bound, and registered in `build.ts`'s `HOST_BOUND_ARTIFACTS`
//     specifically because it must run on a BARE host Node with no
//     TypeScript toolchain available -- its own
//     `import ... from "./transfer-hash.mjs"` specifier resolves correctly
//     only once BUILT into `resources/`. This module is the OPPOSITE: a
//     plain, never-built container-side `.mts` file that runs as source
//     under Node's own type-stripping (`CLAUDE.md`: "No build step for the
//     shipped server"). `transfer-hash.mts` itself carries no such relative
//     import (only `node:crypto`/`node:stream`), so it alone is safely
//     reusable from both sides of the host/container boundary, and IS
//     imported directly below.
//   - Never write or read a SECOND header line on a transfer connection.
//     The `byteLength`/`sha256` header `broker-transfer.mts`'s own
//     `writeTransferHeader()`/`readTransferHeader()` exist to frame is, on
//     THIS connection, already carried by the `transfer` control op's own
//     request (upload) or `transfer_payload` reply (download) --
//     `dialFileTransfer()`'s own job.
//   - Never add filesystem access to `validateContainedDestination()` -- no
//     stat, no realpath, no existsSync (XFER-03 requires it testable as a
//     pure function over fixture strings).
//   - Never sanitise a candidate `validateContainedDestination()` refuses.
//     Per D-13's refuse-not-sanitise posture, every one of the six checks
//     below REJECTS the whole candidate rather than stripping the
//     offending part.
import { createReadStream, createWriteStream, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { isAbsolute, dirname, join } from "node:path";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { dialFileTransfer, awaitTransferComplete } from "./broker-endpoint.mjs";
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mjs";
/** A `Writable` that discards every chunk written to it -- the digest-only
 * pre-pass drain sink an upload's `byteLength`/`sha256` computation needs
 * BEFORE the `transfer` control op is even sent (the op's own request line
 * declares them up front). Mirrors `broker-transfer.mts`'s own
 * `discardSink()` line for line -- that module is not imported directly
 * (see this file's own header), so this is a second, small copy of the
 * same shape rather than a shared import, exactly as `stock-connect.ts`'s
 * own former copy was. */
function discardSink() {
    return new Writable({
        write(_chunk, _encoding, callback) {
            callback();
        },
    });
}
/**
 * The ONE production place a payload connection is opened and driven end to
 * end over the fixed endpoint. Dials via `dialFileTransfer()`
 * (`broker-endpoint.mts`), presenting `request.handle` as its only authority
 * (G-64-1, owner decision 5) -- no credential of any kind -- then streams
 * the payload through the SAME cap-and-digest `Transform`
 * (`transfer-hash.mts`'s `createHashAndCountTransform()`)
 * `broker-transfer.mts`'s own send/receive halves use on the broker's own
 * side of this same exchange. Destroys the socket in a `finally` on every
 * path -- a transfer connection is short-lived by design.
 *
 * An upload is reported done ONLY once `awaitTransferComplete()` resolves
 * ok -- never on this side's own write finishing (G-64-3's whole point,
 * preserved verbatim from `stock-connect.ts`'s own former
 * `defaultTransferFile()`).
 */
export async function transferFileOverEndpoint(request, options = {}) {
    if (request.direction === "upload") {
        let size;
        try {
            size = statSync(request.sourcePath).size;
        }
        catch (e) {
            return { ok: false, reason: `vice: cannot read source file ${request.sourcePath}: ${e.message}` };
        }
        if (size > TRANSFER_MAX_BYTES) {
            return {
                ok: false,
                reason: `vice: transfer exceeds the ${TRANSFER_MAX_BYTES} byte cap (sixteen mebibytes); source file ${request.sourcePath} is ${size} bytes`,
            };
        }
        // Digest pre-pass: streamed, never a whole-file read (Pitfall 3) --
        // needed because dialFileTransfer()'s own `transfer` request must
        // declare byteLength/sha256 BEFORE the socket even opens.
        const digestPass = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
        try {
            await pipeline(createReadStream(request.sourcePath), digestPass, discardSink());
        }
        catch (e) {
            return { ok: false, reason: `vice: failed to digest source file ${request.sourcePath}: ${e.message}` };
        }
        const { byteLength, sha256 } = digestPass.result();
        const dialResult = await dialFileTransfer({
            handle: request.handle,
            direction: "upload",
            byteLength,
            sha256,
            port: options.port,
            candidates: options.candidates,
            connect: options.connect,
            clientVersion: options.clientVersion,
        });
        if (!dialResult.ok)
            return { ok: false, reason: dialResult.reason };
        const { socket } = dialResult;
        try {
            // Armed BEFORE the payload pipeline starts, and awaited AFTER it --
            // never the reverse. dialFileTransfer()'s own performTransfer() tears
            // down its `transfer_ready` listeners once it settles and leaves this
            // socket flowing with NO data listener at all; a completion line that
            // arrived before this reader attached would be lost with no listener
            // to catch it (G-64-3, plan 64-13).
            const completionPromise = awaitTransferComplete({ socket, byteLength, sha256, pending: dialResult.pending });
            // Second, real streamed pass, through a FRESH Transform instance (a
            // Transform is single-use) -- re-enforces the cap from bytes actually
            // read this pass, independently of the digest pre-pass's own count.
            const sendPass = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
            try {
                await pipeline(createReadStream(request.sourcePath), sendPass, socket);
            }
            catch (e) {
                // The local write itself failed -- but if the broker has ALREADY
                // told us why (an `error` line, or its own connection closing), that
                // is the more useful, broker-side reason: report it instead of this
                // side's own write error.
                const completion = await completionPromise;
                if (!completion.ok)
                    return { ok: false, reason: completion.reason };
                return { ok: false, reason: `vice: transfer failed while sending ${request.sourcePath}: ${e.message}` };
            }
            // The upload is DONE only once the broker says so -- never on this
            // side's own write finishing (G-64-3's whole point).
            const completion = await completionPromise;
            if (!completion.ok)
                return { ok: false, reason: completion.reason };
            return { ok: true, byteLength, sha256 };
        }
        finally {
            if (!socket.destroyed)
                socket.destroy();
        }
    }
    // direction === "download"
    const dialResult = await dialFileTransfer({
        handle: request.handle,
        direction: "download",
        port: options.port,
        candidates: options.candidates,
        connect: options.connect,
        clientVersion: options.clientVersion,
    });
    if (!dialResult.ok)
        return { ok: false, reason: dialResult.reason };
    if (dialResult.direction !== "download") {
        // Structurally unreachable: dialFileTransfer() only ever resolves a
        // "download" direction result for a "download" request. Guarded anyway,
        // matching this file's own never-fabricate-a-plausible-value posture.
        dialResult.socket.destroy();
        return { ok: false, reason: "vice: internal error -- expected a download transfer reply" };
    }
    const { socket, byteLength, sha256, pending } = dialResult;
    try {
        // The broker's OWN declared byteLength is untrusted input (D-11),
        // independently re-checked here exactly as
        // broker-transfer.mts's own receivePayloadToFile() re-checks it on the
        // broker's side of the same exchange.
        if (byteLength > TRANSFER_MAX_BYTES) {
            return {
                ok: false,
                reason: `vice: broker declared byteLength ${byteLength} exceeds the ${TRANSFER_MAX_BYTES} byte cap (sixteen mebibytes)`,
            };
        }
        if (pending.length > 0)
            socket.unshift(pending);
        mkdirSync(dirname(request.destPath), { recursive: true });
        // Phase 65 (plan 65-03, D-09/SEAM-03/concurrency): a random suffix joins
        // pid+timestamp -- `Date.now()` alone is MILLISECOND granularity, so two
        // downloads racing to the SAME destPath from the SAME process (two
        // concurrent host-tool requests whose sources share a basename) can
        // collide on the exact same tmpPath within one millisecond. MEASURED
        // live while writing this plan's own concurrency test: an intermittent
        // ENOENT renaming a tmp file the OTHER racer had already renamed-and-
        // removed out from under this one. `randomBytes(8).toString("hex")` is
        // vanishingly unlikely to collide even within the same millisecond.
        const tmpPath = `${request.destPath}.tmp-${process.pid}-${Date.now()}-${randomBytes(8).toString("hex")}`;
        const cleanupTmp = () => {
            try {
                rmSync(tmpPath, { force: true });
            }
            catch {
                // Best-effort cleanup -- a failure removing an already-removed or
                // never-created temp file must never mask the real refusal reason.
            }
        };
        const transform = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
        try {
            await pipeline(socket, transform, createWriteStream(tmpPath));
        }
        catch (e) {
            cleanupTmp();
            return { ok: false, reason: `vice: transfer failed while receiving into ${request.destPath}: ${e.message}` };
        }
        const observed = transform.result();
        const verdict = verifyObserved({ byteLength, sha256 }, observed);
        if (!verdict.ok) {
            cleanupTmp();
            return { ok: false, reason: verdict.reason };
        }
        try {
            renameSync(tmpPath, request.destPath);
        }
        catch (e) {
            cleanupTmp();
            return { ok: false, reason: `vice: failed to publish ${request.destPath}: ${e.message}` };
        }
        return { ok: true, byteLength: observed.byteLength, sha256: observed.sha256 };
    }
    finally {
        if (!socket.destroyed)
            socket.destroy();
    }
}
/**
 * D-13/XFER-03's pure containment validator: refuses a broker-supplied
 * destination name rather than sanitising it, checking six rules in this
 * order, each returning its OWN named reason so a caller (and this
 * function's own tests) can tell which rule fired:
 *
 * 1. a NUL byte anywhere in the candidate
 * 2. an empty candidate (never resolves to `rootDir` itself)
 * 3. a candidate equal to a single dot or a double dot
 * 4. a candidate containing a double-dot (`..`) SEGMENT, split on both
 *    ASCII path separators
 * 5. an absolute path, as judged by `isAbsolute()` from `node:path` (a
 *    platform-dependent check -- see rule 6 for why `C:\` is refused on
 *    every platform regardless)
 * 6. a forward slash or a backslash ANYWHERE in the candidate -- this is
 *    what refuses a Windows drive form like `C:\` even on a POSIX host,
 *    where `isAbsolute("C:\\")` returns `false`
 *
 * Only a candidate surviving all six checks resolves, by joining it onto
 * `rootDir`. Performs NO filesystem access whatsoever -- no stat, no
 * realpath, no existsSync -- and applies no Unicode normalisation and no
 * case folding: the check runs on the raw string.
 */
export function validateContainedDestination(candidate, rootDir) {
    if (candidate.includes("\0")) {
        return { ok: false, reason: "destination name contains a NUL byte" };
    }
    if (candidate.length === 0) {
        return { ok: false, reason: "destination name is empty -- an empty name must not resolve to the root directory itself" };
    }
    if (candidate === "." || candidate === "..") {
        return { ok: false, reason: `destination name is '${candidate}'` };
    }
    if (candidate.split(/[\\/]+/).includes("..")) {
        return { ok: false, reason: "destination name contains a traversal segment ('..')" };
    }
    if (isAbsolute(candidate)) {
        return { ok: false, reason: "destination name is an absolute path" };
    }
    if (candidate.includes("/") || candidate.includes("\\")) {
        return { ok: false, reason: "destination name contains a path separator" };
    }
    return { ok: true, resolved: join(rootDir, candidate) };
}
