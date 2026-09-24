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
import type { Socket } from "node:net";
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
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES, type ExpectedTransfer } from "./transfer-hash.mjs";

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
function discardSink(): Writable {
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

/** The one JSON header line a transfer connection carries before its raw
 * payload bytes (D-02). `kind` names the frame (this phase's only value is
 * `"file"`; a short, free-form string rather than an enum, so a later phase
 * can add a kind without touching this type). `byteLength`/`sha256` are the
 * SENDER's declared values -- untrusted input on the receiving side, per
 * D-11, and independently re-validated there. */
export interface TransferHeader {
  kind: string;
  byteLength: number;
  sha256: string;
}

/** `readTransferHeader()`'s result: either the terminator has not yet
 * arrived (`header` and `error` both absent, `remainder` is everything
 * accumulated so far -- the next call's `carry`), or it has, in which case
 * EITHER `header` is a fully type-checked `TransferHeader` (a well-formed
 * line) OR `error` names why the line was refused (malformed JSON, wrong
 * field types, or a missing field) -- never both, and never a thrown
 * exception either way. `remainder` is every byte strictly after the
 * terminator, untouched as a raw `Buffer` -- these may already be payload
 * bytes from the same TCP segment (`receivePayloadToFile()`'s own `pending`
 * parameter). `overflow` is set the instant the accumulated, still
 * unterminated carry exceeds `MAX_TRANSFER_HEADER_LINE_BYTES` -- the caller
 * destroys the connection on this flag rather than calling this function
 * again. */
export interface ReadTransferHeaderResult {
  header?: TransferHeader;
  remainder: Buffer;
  overflow: boolean;
  error?: string;
}

/**
 * Serialises `header` to one JSON line, terminated by a single `0x0a`, and
 * writes it to `socket`. The only encoder in this file's send-side path --
 * everything written after this call is raw payload bytes, streamed through
 * `pipeline()`, never through this function again.
 */
export function writeTransferHeader(socket: Socket, header: TransferHeader): void {
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
export function readTransferHeader(chunk: Buffer, carry: Buffer = Buffer.alloc(0)): ReadTransferHeaderResult {
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(lineText);
  } catch {
    return { remainder, overflow: false, error: "vice: transfer header line is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { remainder, overflow: false, error: "vice: transfer header line is not a JSON object" };
  }
  const obj = parsed as Record<string, unknown>;
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

/** `code`/`wireReason` (Phase 64 gap closure G-64-3, plan 64-13) exist ONLY
 * for `receivePayloadToFile()`'s own failure branch -- `sendPayloadFromFile()`
 * never sets them, and every existing caller that reads only `.reason`
 * (this file's own tests among them) is unaffected, since both fields are
 * optional. `code` classifies the refusal for the wire: `bad_request` for a
 * malformed/over-cap declared length or a digest/count mismatch (the
 * SENDER's own declared values disagreeing with what was observed --
 * D-11), `internal` for a receive or publish fault (a local I/O failure on
 * the broker's own side). `wireReason` is the PATH-FREE text a caller
 * writes to the client on the transfer connection (D-15/D-17); `reason`
 * stays the full text -- including `destPath` where one of the two fs
 * failure branches below embeds it -- for the broker's own stderr line
 * only. When `wireReason` is absent, `reason` is already path-free (every
 * validation-before-the-pipeline branch, and `verifyObserved()`'s own
 * reasons) and a caller may use it verbatim on the wire too.
 *
 * G-64-5 (plan 64-15, CR-01): `receivePayloadToFile()` itself no longer
 * returns this loosely-typed union on its failure branch -- see
 * `ReceivePayloadToFileResult` below, which makes `code`/`wireReason`
 * MANDATORY on a receive failure so a future caught-fault branch cannot
 * omit path-free wire text and have the compiler stay silent about it.
 * `TransferResult` itself is unchanged and stays the type for
 * `sendPayloadFromFile()`, whose `code`/`wireReason` really are optional
 * (it never puts a caught error's message on the wire in the first
 * place -- see that function's own body). */
export type TransferResult =
  | { ok: true; byteLength: number; sha256: string }
  | { ok: false; reason: string; code?: "bad_request" | "internal"; wireReason?: string };

/** G-64-5 (plan 64-15, CR-01): `receivePayloadToFile()`'s own return type --
 * a stricter narrowing of `TransferResult` where a failure MUST carry both
 * `code` and `wireReason`. The incident this type exists to prevent: an
 * upload whose publish failed sent the broker's own absolute staging paths
 * (`tmpPath`, `destPath`) to the client, because a caught-fault branch
 * built `wireReason` from the raw, unfiltered `Error.message` a Node `fs`
 * call throws -- and that message embeds the full path (64-REVIEW.md
 * CR-01). Declared as `Extract<>` plus an intersection, not a fresh object
 * literal, so `TransferResult`'s own shape (and every existing comment
 * pointer at it, e.g. broker-endpoint.ts's) stays valid -- this type adds a
 * constraint, it does not redefine the success branch. */
export type ReceivePayloadToFileResult =
  | Extract<TransferResult, { ok: true }>
  | (Extract<TransferResult, { ok: false }> & { code: "bad_request" | "internal"; wireReason: string });

/** The errno-token shape `formatPathFreeFault()` admits into wire text: an
 * uppercase ASCII letter first, then only uppercase ASCII letters, digits
 * or underscores, two to sixty-four characters total. This shape admits
 * every Node errno code (`ENOENT`, `EACCES`, `ENOSPC`, `EISDIR`,
 * `ENAMETOOLONG`) and Node's own internal codes
 * (`ERR_STREAM_PREMATURE_CLOSE`, `ABORT_ERR`). It cannot hold a path
 * separator, a space or a dot, so a code matching it cannot itself carry a
 * path -- this is the WHOLE filter; there is no second, separate
 * path-scrubbing step (D-17's own prohibition on a scrubber, which fails
 * open on the first path shape it did not anticipate). Not exported --
 * `formatPathFreeFault()` is the only caller. */
const WIRE_SAFE_ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

/** The fixed text `formatPathFreeFault()` appends after an optional errno
 * token -- pointing the client at the broker's own log for the full
 * failure, without saying where that log is. Contains no slash and no
 * parenthesis, so it can never itself be mistaken for the `(CODE)` form
 * this function's own output uses. Not exported. */
const PATH_FREE_FAULT_LOG_HINT = "the broker's own log carries the full error";

/**
 * The ONE place wire text for a caught transfer fault is built (G-64-5,
 * plan 64-15). The incident this function exists to close: an upload whose
 * publish failed on a real filesystem error sent the broker's own absolute
 * staging paths to the client, because `receivePayloadToFile()`'s
 * caught-fault branches built their client-facing text from the raw,
 * unfiltered `(e as Error).message` -- and Node's own `fs` errors embed the
 * full source and destination paths in that message verbatim
 * (64-REVIEW.md CR-01). Every one of this file's caught-fault branches now
 * calls this function instead of reading `.message` itself.
 *
 * Returns `summary`, then a space and the fault's `code` in parentheses
 * ONLY when that code is a string matching `WIRE_SAFE_ERROR_CODE_RE`
 * above, then the fixed `PATH_FREE_FAULT_LOG_HINT`. The `code` read is
 * wrapped in its own `try`, so a fault whose `code` property is a
 * throwing getter counts as no code, exactly like a fault with no `code`
 * at all -- this function never throws, on any input.
 *
 * WHAT NOT TO DO:
 *   - Never read `fault.message` here, or call `String(fault)` on it --
 *     that is exactly the leak this function exists to close.
 *   - Never scrub path text out of a message instead of avoiding the
 *     message entirely -- a scrubber fails open on the first path shape it
 *     did not anticipate (D-17).
 *   - Never widen `WIRE_SAFE_ERROR_CODE_RE` to admit a character a path
 *     needs (`/`, `\`, a space, a dot) -- the shape's whole safety
 *     property is that it cannot hold a separator.
 */
export function formatPathFreeFault(summary: string, fault: unknown): string {
  let code: string | undefined;
  try {
    if (fault !== null && typeof fault === "object") {
      const candidate = (fault as { code?: unknown }).code;
      if (typeof candidate === "string" && WIRE_SAFE_ERROR_CODE_RE.test(candidate)) {
        code = candidate;
      }
    }
  } catch {
    // A throwing `code` getter counts as no code -- never propagate it.
  }
  const codePart = code ? ` (${code})` : "";
  return `${summary}${codePart} -- ${PATH_FREE_FAULT_LOG_HINT}`;
}

export interface SendPayloadFromFileOptions {
  socket: Socket;
  sourcePath: string;
  /** Defaults to `TRANSFER_MAX_BYTES` -- see `transfer-hash.mts`'s own
   * header for why a production caller never overrides this. */
  capBytes?: number;
  /** The header line's own `kind` field -- defaults to `"file"` (this
   * function's pre-Phase-64-03 behaviour, unchanged for every existing
   * caller). `handleFileTransfer()` (vice-broker.mts, plan 64-03) overrides
   * this to `"transfer_payload"` for a download reply, so `dialFileTransfer()`
   * (broker-endpoint.ts)'s own reply-line classifier -- which keys on
   * `obj.kind === "transfer_payload"`, never `"file"` -- recognises it. The
   * byteLength/sha256 fields either kind carries are identical either way;
   * only the frame's own name differs by caller. */
  kind?: string;
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
export async function sendPayloadFromFile({ socket, sourcePath, capBytes = TRANSFER_MAX_BYTES, kind = "file" }: SendPayloadFromFileOptions): Promise<TransferResult> {
  let size: number;
  try {
    size = statSync(sourcePath).size;
  } catch (e) {
    return { ok: false, reason: `vice: cannot read source file ${sourcePath}: ${(e as Error).message}` };
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
  } catch (e) {
    return { ok: false, reason: `vice: failed to digest source file ${sourcePath}: ${(e as Error).message}` };
  }
  const { byteLength, sha256 } = digestPass.result();

  writeTransferHeader(socket, { kind, byteLength, sha256 });

  // Second pass: the real send, through a FRESH Transform instance (a
  // Transform is single-use) -- re-enforces the cap from bytes actually
  // read this pass, independently of the first pass's own count.
  const sendPass = createHashAndCountTransform({ capBytes });
  try {
    await pipeline(createReadStream(sourcePath), sendPass, socket);
  } catch (e) {
    return { ok: false, reason: `vice: transfer failed while sending ${sourcePath}: ${(e as Error).message}` };
  }
  return { ok: true, byteLength, sha256 };
}

export interface ReceivePayloadToFileOptions {
  socket: Socket;
  destPath: string;
  /** The already-parsed header (`readTransferHeader()`'s own `header`
   * field) -- this function does NOT read it off the socket itself, so a
   * caller must have already found the terminator and stopped decoding this
   * socket's bytes as JSON before calling this function (matching this
   * file's own module-header prohibition: the header line's decode is the
   * ONLY string decode anywhere in this file, and it happens exactly once,
   * in `readTransferHeader()`). */
  header: TransferHeader;
  /** Bytes that arrived in the SAME TCP segment as the header line's own
   * terminator, past it (`readTransferHeader()`'s own `remainder`) --
   * unshifted back onto `socket`'s own readable buffer before this
   * function's pipeline starts reading, so they are consumed as the FIRST
   * payload bytes rather than lost. Absent or empty means nothing was
   * pending. */
  pending?: Buffer;
  /** Defaults to `TRANSFER_MAX_BYTES`. */
  capBytes?: number;
  /** Optional pre-publish timing hook (Phase 64 gap closure G-64-3, plan
   * 64-13, Task 1): if present, awaited AFTER `verifyObserved()` has
   * already confirmed the observed byte count and digest match the
   * header's declared values, and STRICTLY BEFORE `renameSync()` ever
   * runs. Takes no path and returns nothing -- a timing seam only, never
   * the injectable filesystem-root seam D-17 forbids on any transfer
   * module. A rejected hook is treated exactly like a publish failure: the
   * temp file is removed and this function resolves `{ ok: false, ... }`
   * with no rename attempted. The real broker's production wiring
   * (`vice-broker.mts`'s `run()`) never supplies this -- only a test does,
   * to make the publish-race this plan closes deterministic instead of a
   * 37-67% coin flip. G-64-5 (plan 64-15): a test may also use its own
   * closure to place a REAL filesystem fault between the verdict and the
   * rename (e.g. removing the destination's own directory) -- that use
   * leaves this hook's shape unchanged: no path in, nothing out, and the
   * real broker's `run()` wiring still supplies none. */
  beforePublish?: () => Promise<void>;
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
 *
 * G-64-5 (plan 64-15): every failure's `wireReason` comes from exactly one
 * of three sources -- a fixed phrase with no caught-error content at all
 * (the two declared-length refusals above and `verifyObserved()`'s own
 * reasons), `formatPathFreeFault()` (a genuine receive, hook or publish
 * fault caught from a real `fs`/stream error), or a phrase built ONLY from
 * `capBytes` and the transform's own observed byte count (the
 * receive-pipeline's own cap enforcement, classified by that OBSERVED
 * count -- never by the caught error's class or text, since the same
 * `pipeline()` promise rejection covers both a genuine cap overflow and an
 * unrelated stream fault). `wireReason` never reads a caught error's
 * `.message` directly anywhere in this function.
 */
export async function receivePayloadToFile({
  socket,
  destPath,
  header,
  pending,
  capBytes = TRANSFER_MAX_BYTES,
  beforePublish,
}: ReceivePayloadToFileOptions): Promise<ReceivePayloadToFileResult> {
  // The declared byteLength is untrusted input (D-11) -- validated here,
  // independently of whatever check `readTransferHeader()` may already have
  // run, because this function is directly callable with a hand-built
  // header too. Refused BEFORE the pipeline is ever constructed.
  if (typeof header.byteLength !== "number" || !Number.isSafeInteger(header.byteLength) || header.byteLength < 0) {
    const reason = `vice: transfer header field 'byteLength' must be a non-negative safe integer, got ${JSON.stringify(header.byteLength)}`;
    return { ok: false, reason, code: "bad_request", wireReason: reason };
  }
  if (header.byteLength > capBytes) {
    const reason = `vice: transfer declared byteLength ${header.byteLength} exceeds the ${capBytes} byte cap (sixteen mebibytes)`;
    return { ok: false, reason, code: "bad_request", wireReason: reason };
  }

  if (pending && pending.length > 0) {
    socket.unshift(pending);
  }

  mkdirSync(dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;

  const cleanupTmp = (): void => {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // Best-effort cleanup -- a failure removing an already-removed or
      // never-created temp file must never mask the real refusal reason.
    }
  };

  const expected: ExpectedTransfer = { byteLength: header.byteLength, sha256: header.sha256 };
  const transform = createHashAndCountTransform({ capBytes });
  try {
    await pipeline(socket, transform, createWriteStream(tmpPath));
  } catch (e) {
    cleanupTmp();
    // Classify by the transform's OWN observed count, never by the caught
    // error's text or class -- the same pipeline() rejection covers both
    // the receiver's own cap enforcement (the transform's `_transform`
    // callback rejecting once the observed count exceeds `capBytes`, per
    // transfer-hash.mts) and an unrelated stream fault (a destination that
    // cannot be opened, a socket destroyed mid-payload). Only the OBSERVED
    // count tells them apart.
    const observedByteLength = transform.result().byteLength;
    if (observedByteLength > capBytes) {
      const capMessage = `vice: transfer exceeds the ${capBytes} byte cap (sixteen mebibytes); observed at least ${observedByteLength} bytes`;
      return {
        ok: false,
        code: "bad_request",
        reason: `${capMessage} while receiving into ${destPath}`,
        wireReason: capMessage,
      };
    }
    return {
      ok: false,
      code: "internal",
      reason: `vice: transfer failed while receiving into ${destPath}: ${(e as Error).message}`,
      wireReason: formatPathFreeFault("vice: transfer failed while receiving the payload", e),
    };
  }

  const observed = transform.result();
  const verdict = verifyObserved(expected, observed);
  if (!verdict.ok) {
    cleanupTmp();
    return { ok: false, reason: verdict.reason, code: "bad_request", wireReason: verdict.reason };
  }

  // Pre-publish timing hook (G-64-3, plan 64-13): awaited strictly AFTER
  // the digest/count verdict above and STRICTLY BEFORE renameSync() below
  // -- a rejected hook is a publish failure, exactly like a renameSync()
  // throw. Absent in every production call (only a test supplies it).
  if (beforePublish) {
    try {
      await beforePublish();
    } catch (e) {
      cleanupTmp();
      return {
        ok: false,
        code: "internal",
        reason: `vice: transfer publish hook rejected before ${destPath} was published: ${(e as Error).message}`,
        wireReason: formatPathFreeFault("vice: transfer failed before the upload could be published", e),
      };
    }
  }

  try {
    renameSync(tmpPath, destPath);
  } catch (e) {
    cleanupTmp();
    const message = (e as Error).message;
    return {
      ok: false,
      code: "internal",
      reason: `vice: failed to publish ${destPath}: ${message}`,
      wireReason: formatPathFreeFault("vice: failed to publish the received file", e),
    };
  }

  return { ok: true, byteLength: observed.byteLength, sha256: observed.sha256 };
}

// ---------------------------------------------------------------------------
// Staging (Phase 64, plan 64-03, XFER-04/XFER-07, D-05/D-06). The broker's
// OWN staging model: it mints the handle, it chooses the path, it
// supersedes a slot on reuse, and it deletes the whole directory when the
// session's connection closes. `vice-broker.mts` owns the STATE MAP (which
// grant resolves to which running instance) and the WIRING (dispatching
// `stage_file`/`transfer` control ops into this module's functions); this
// module owns the staging DIRECTORY LAYOUT and the HANDLE MINTING. Neither
// duplicates the other.
//
// WHAT NOT TO DO:
//   - Never let a client-supplied string reach a path. `slot` is a pure
//     registry KEY here (never a path component -- the staged file's own
//     name is always derived from the MINTED handle, below), but it is
//     still refused-not-rewritten against the same allow-list posture the
//     grant id gets, per T-64-12's disposition: a future refactor that
//     starts using `slot` as a path component must inherit this refusal
//     rather than a silent gap.
//   - Never import `transfer-paths.ts`'s own `validateContainedDestination()`
//     for this. That module transitively imports `repo-root.ts` (via
//     `toolsDir()`) -- a host-bound module importing a container-side one is
//     exactly the mistake `broker-home.mts`'s own header comment warns
//     against. `refuseUnsafeSegment()` below is a small, LOCAL, deliberately
//     duplicated copy of the same ordered-checks shape, mirroring
//     `broker-home.mts`'s own precedent of duplicating a literal rather than
//     importing a container-side module for it.
// ---------------------------------------------------------------------------

/** One minted staging entry -- everything `vice-broker.mts`'s
 * `handleStageFile()`/`handleFileTransfer()` need to answer a `stage_file`
 * or `transfer` request. `grantId`/`slot` are carried on the entry itself
 * (not just as an external index key) so `clearStagingForSession()` can find
 * every entry for a grant by a single scan of `handleIndex`, with no second
 * per-grant index to keep in sync. */
export interface StagedFileEntry {
  handle: string;
  path: string;
  grantId: string;
  slot: string;
  claimedAt: number;
}

export interface StageFileSlotOptions {
  grantId: string;
  slot: string;
  /** Injectable clock (this project's standard env/time/spawning/I-O
   * injection register) -- defaults to `Date.now`. A test supplies a fixed
   * value for a deterministic `claimedAt`. */
  now?: () => number;
}

export type StageFileSlotResult = { ok: true; handle: string; stagedPath: string } | { ok: false; reason: string };

/** Handle -> entry. The ONE map `resolveStagedFile()` reads and every other
 * function in this section writes -- there is no second copy of a staged
 * entry anywhere in this module. */
const handleIndex = new Map<string, StagedFileEntry>();
/** `(grantId, slot)` -> the CURRENT handle for that slot, joined with a NUL
 * byte -- a byte `refuseUnsafeSegment()` below already refuses inside
 * either half, so this composite key can never collide ambiguously between
 * two different (grantId, slot) pairs. */
const slotIndex = new Map<string, string>();
/** The set of handles with a transfer currently in flight -- membership
 * check and insertion are a single synchronous pair with no `await` between
 * them (`markTransferInFlight()` below), the same discipline
 * `broker-launch.mts`'s single-owner launch guard already keeps, for the
 * same reason (T-64-16). */
const inFlightHandles = new Set<string>();

function stagingSlotKey(grantId: string, slot: string): string {
  return `${grantId}\u0000${slot}`;
}

/** Refuse-not-sanitise: `candidate` must be non-empty, contain no NUL byte,
 * not be exactly `.` or `..`, and contain no path separator at all (`/` or
 * `\`) -- refusing every separator unconditionally also catches every
 * absolute-path and traversal-segment case, since none of those forms can
 * exist without one. `label` names the field in the refusal message; the
 * refusal never echoes the offending value itself (T-64-13's own posture
 * for a handle refusal, applied here too). */
function refuseUnsafeSegment(candidate: string, label: string): { ok: true } | { ok: false; reason: string } {
  if (candidate.includes("\u0000")) return { ok: false, reason: `vice: ${label} contains a NUL byte` };
  if (candidate.length === 0) return { ok: false, reason: `vice: ${label} is empty` };
  if (candidate === "." || candidate === "..") return { ok: false, reason: `vice: ${label} is '${candidate}'` };
  if (candidate.includes("/") || candidate.includes("\\")) return { ok: false, reason: `vice: ${label} contains a path separator` };
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
export function stageFileSlot({ grantId, slot, now = Date.now }: StageFileSlotOptions): StageFileSlotResult {
  const grantCheck = refuseUnsafeSegment(grantId, "grant id");
  if (!grantCheck.ok) return { ok: false, reason: grantCheck.reason };
  const slotCheck = refuseUnsafeSegment(slot, "slot");
  if (!slotCheck.ok) return { ok: false, reason: slotCheck.reason };

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
      } catch {
        // Best-effort unlink -- a superseding stage must never fail because
        // the PREVIOUS file could not be removed (D-05).
      }
    }
  }

  const entry: StagedFileEntry = { handle, path: stagedPath, grantId, slot, claimedAt: now() };
  handleIndex.set(handle, entry);
  slotIndex.set(key, handle);

  return { ok: true, handle, stagedPath };
}

export type ResolveStagedFileResult = { ok: true; entry: StagedFileEntry } | { ok: false; reason: string };

/**
 * A handle-index lookup, nothing more -- this function does NOT check
 * whether `entry.path` still exists on disk (a caller wanting THAT question
 * answered, e.g. a download, checks it itself; see `vice-broker.mts`'s own
 * `handleFileTransfer()`). Returns a refusal, never revealing the staging
 * path, for an unknown, empty, or superseded handle -- a superseded handle
 * is simply no longer a key in `handleIndex` at all, so it refuses by the
 * SAME "unknown" path as a handle that was never minted.
 */
export function resolveStagedFile(handle: string): ResolveStagedFileResult {
  const entry = handleIndex.get(handle);
  if (!entry) return { ok: false, reason: "vice: unknown transfer handle" };
  return { ok: true, entry };
}

export type TransferInFlightResult = { ok: true } | { ok: false; reason: string };

/**
 * The in-flight guard a transfer dispatch arm takes before streaming a
 * single byte (T-64-16): the membership check and the set insertion below
 * are ONE synchronous statement pair, with no `await` between them, so two
 * concurrent transfers presenting the SAME handle cannot both observe an
 * empty set and both proceed.
 */
export function markTransferInFlight(handle: string): TransferInFlightResult {
  if (inFlightHandles.has(handle)) {
    return { ok: false, reason: "vice: a transfer for this handle is already in flight" };
  }
  inFlightHandles.add(handle);
  return { ok: true };
}

/** Releases the in-flight guard for `handle` -- a no-op if it was never
 * held (a caller's own `finally` block calls this unconditionally on every
 * path, including refusals, per this plan's own wiring contract). */
export function clearTransferInFlight(handle: string): void {
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
export function clearStagingForSession(grantId: string): void {
  const sessionDir = join(brokerStagingDir(), grantId);
  try {
    rmSync(sessionDir, { recursive: true, force: true });
  } catch {
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
    if (key.startsWith(prefix)) slotIndex.delete(key);
  }
}

/** Test-only reset, following `stock-paths.ts`'s `setIsInsideContainerForTest()`
 * / `stock-runstate.ts`'s `resetRunStateTrackersForTest()` precedent: a
 * module-level registry must not leak state between test cases in the SAME
 * process. Production code never calls this. */
export function resetStagingForTest(): void {
  handleIndex.clear();
  slotIndex.clear();
  inFlightHandles.clear();
}
