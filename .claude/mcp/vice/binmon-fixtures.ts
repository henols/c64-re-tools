// Test-support module: a byte-exact response-frame encoder, synthetic
// builders for the VERIF-02 cases that need no running emulator, and a
// loader for the captured fixtures plan 02-02 commits under
// fixtures/binmon/. This is the ONE place any test in this package builds or
// loads a binary-monitor response frame from -- no test file should hand-roll
// its own header-byte offsets.
//
// WHY THIS FILE EXISTS: docs/phase0-binmon-findings.md §5 fixes the wire
// layout, but nothing before this plan could produce a byte-exact frame
// (or a garbage/duplicate/desynced stream) without a live x64sc. That left
// five of VERIF-02's eight cases unobtainable in this container, which has
// no VICE and no display (see docs/phase1-probe-results.md's own framing).
// This module makes those five cases synthesize-only fixtures; the other
// three (display-get, event-interleaved, checkpoint-list) are captured for
// real by probe-binmon.mjs's --capture mode and loaded back through
// loadCapturedFixture() below.
//
// WHAT NOT TO DO: never import the vendor's contracts.ts/errors.ts here or
// anywhere else in this package -- they pull in `zod`, which
// package.json's dependencies block does not carry and must not gain (D-16).
// The three pure wire constants below are hand-copied, not imported. This
// module must not be imported by any published runtime file (it lives
// outside package.json's `files` array on purpose) and must never itself be
// added to that array -- check-npm-packages.mjs asserts the tarball ships no
// test tooling.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Hand-copied from VICE's wire format (docs/phase0-binmon-findings.md §5) --
 * never imported from the vendor's contracts.ts. */
export const VICE_STX = 0x02;
export const VICE_API_VERSION = 0x02;
export const VICE_BROADCAST_REQUEST_ID = 0xffffffff;
export const RESPONSE_HEADER_LEN = 12;

export interface EncodeResponseFrameOptions {
  /** Response type byte (offset 6) -- e.g. 0x61 for JAM. */
  responseType: number;
  /** Error code byte (offset 7). Defaults to 0x00 (OK). */
  errorCode?: number;
  /** Request id (offset 8-11). VICE_BROADCAST_REQUEST_ID for an async event. */
  requestId: number;
  /** Response body, appended verbatim after the 12-byte header. */
  body?: Buffer;
  /** api_version byte (offset 1). Defaults to VICE_API_VERSION. */
  apiVersion?: number;
  /** Override for the body-length field (offset 2-5). Defaults to
   * body.length; set explicitly to construct a deliberately lying-length
   * frame for a desync/framing test. */
  bodyLength?: number;
}

/** Build the normative 12-byte binary-monitor response header
 * (docs/phase0-binmon-findings.md §5) plus body. This is the ONE frame
 * builder every test/fixture in this package goes through. */
export function encodeResponseFrame({
  responseType,
  errorCode = 0x00,
  requestId,
  body = Buffer.alloc(0),
  apiVersion = VICE_API_VERSION,
  bodyLength,
}: EncodeResponseFrameOptions): Buffer {
  const header = Buffer.alloc(RESPONSE_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = apiVersion;
  header.writeUInt32LE((bodyLength ?? body.length) >>> 0, 2);
  header[6] = responseType;
  header[7] = errorCode;
  header.writeUInt32LE(requestId >>> 0, 8);
  return Buffer.concat([header, body]);
}

/** JAM (0x61): per monitor_binary.c:384-394, the PC is computed then a
 * zero-length body is sent -- every client that assumes a 2-byte body breaks
 * on this. */
export function syntheticJamFrame(): Buffer {
  return encodeResponseFrame({
    responseType: 0x61,
    errorCode: 0x00,
    requestId: VICE_BROADCAST_REQUEST_ID,
    body: Buffer.alloc(0),
  });
}

/** A response type this client has no name for (0x00 is never a real
 * response/event type on the wire) -- the demux must not throw on it. */
export function syntheticUnknownTypeFrame(): Buffer {
  return encodeResponseFrame({
    responseType: 0x00,
    errorCode: 0x00,
    requestId: 1,
    body: Buffer.alloc(0),
  });
}

/** Two byte-identical frames carrying the same non-broadcast request id --
 * a demux that resolves the same pending request twice must be provably
 * inert on the second delivery. */
export function syntheticDuplicateReplyStream(requestId: number): Buffer {
  const frame = encodeResponseFrame({
    responseType: 0x01, // MEM_GET reply shape; the exact type is incidental here
    errorCode: 0x00,
    requestId,
    body: Buffer.from([0x00, 0x00]),
  });
  return Buffer.concat([frame, frame]);
}

/** A valid frame, one non-0x02 garbage byte, then a second valid frame --
 * the exact shape probe-binmon.mjs's _onData() resync loop (lines 119-150)
 * must recover from: drop one byte and keep looking for STX, never trust an
 * arbitrary 32-bit length read at a byte that merely looked like STX. */
export function syntheticDesyncStream(): Buffer {
  const frame1 = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) });
  const garbage = Buffer.from([0x99]); // any non-0x02 byte
  const frame2 = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 2, body: Buffer.alloc(0) });
  return Buffer.concat([frame1, garbage, frame2]);
}

/** DISPLAY_GET (0x84) response for the recorded 504x312 8bpp debug-screen
 * geometry (docs/phase1-probe-results.md: dw=504 dh=312 xo=136 yo=51 iw=320
 * ih=200 bpp=8). Body layout per docs/phase0-binmon-findings.md §3 /
 * probe-binmon.mjs's parseDisplayGet(): [info_len:u32LE][dw,dh,xo,yo,iw,ih:
 * u16LE each][bpp:1][buflen:u32LE][buffer...]. Exists so PROTO-07's test is
 * not blocked on host availability; plan 02-02's committed real capture
 * supersedes this synthetic frame. */
export function syntheticDisplayGetFrame({ requestId = 1 }: { requestId?: number } = {}): Buffer {
  const dw = 504;
  const dh = 312;
  const xo = 136;
  const yo = 51;
  const iw = 320;
  const ih = 200;
  const bpp = 8;
  const infoLen = 13; // six u16 fields (12 bytes) + one bpp byte

  const info = Buffer.alloc(infoLen);
  info.writeUInt16LE(dw, 0);
  info.writeUInt16LE(dh, 2);
  info.writeUInt16LE(xo, 4);
  info.writeUInt16LE(yo, 6);
  info.writeUInt16LE(iw, 8);
  info.writeUInt16LE(ih, 10);
  info[12] = bpp;

  const infoLenField = Buffer.alloc(4);
  infoLenField.writeUInt32LE(infoLen, 0);

  const pixelBuffer = Buffer.alloc(dw * dh, 0); // 504*312 = 157,248 index bytes
  const buflenField = Buffer.alloc(4);
  buflenField.writeUInt32LE(pixelBuffer.length, 0);

  const body = Buffer.concat([infoLenField, info, buflenField, pixelBuffer]);
  return encodeResponseFrame({ responseType: 0x84, errorCode: 0x00, requestId, body });
}

/** Split `buffer` into `size`-byte chunks, in order, for the byte-at-a-time
 * (or arbitrary-chunk) delivery technique a framing test needs. */
export function chunkBytes(buffer: Buffer, size: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += size) {
    chunks.push(buffer.subarray(offset, offset + size));
  }
  return chunks;
}

export interface MissingFixtureErrorOptions {
  path?: string;
  command?: string;
}

/** A named, local error -- not a bare ENOENT and not a runtime ViceError --
 * so a test can assert on the absence of a captured fixture without
 * catching every other possible filesystem failure. */
export class MissingFixtureError extends Error {
  path?: string;
  command?: string;

  constructor(message: string, { path, command }: MissingFixtureErrorOptions = {}) {
    super(message);
    this.name = "MissingFixtureError";
    this.path = path;
    this.command = command;
  }
}

const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command"] as const;

export interface CapturedFixture {
  bytes: Buffer;
  provenance: Record<string, unknown>;
}

export interface LoadCapturedFixtureOptions {
  /** Directory the `<caseName>.bin` / `<caseName>.json` pair live in.
   * Defaults to fixtures/binmon/ next to this module. */
  dir?: string;
}

/** Load a captured `<caseName>.bin` plus its `<caseName>.json` provenance
 * sidecar. Throws MissingFixtureError, naming the expected path and the
 * capture command that produces it, when either file is absent or the
 * sidecar is missing a required provenance key. */
export function loadCapturedFixture(caseName: string, { dir }: LoadCapturedFixtureOptions = {}): CapturedFixture {
  const baseDir = dir ?? join(HERE, "fixtures", "binmon");
  const binPath = join(baseDir, `${caseName}.bin`);
  const jsonPath = join(baseDir, `${caseName}.json`);
  const command = `node probe-binmon.mjs --capture ${caseName}`;

  if (!existsSync(binPath) || !existsSync(jsonPath)) {
    throw new MissingFixtureError(
      `Captured fixture "${caseName}" is missing at ${binPath} -- regenerate it with: ${command}`,
      { path: binPath, command },
    );
  }

  const bytes = readFileSync(binPath);
  const provenance = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
  const missingKeys = REQUIRED_PROVENANCE_KEYS.filter((k) => !(k in provenance));
  if (missingKeys.length > 0) {
    throw new MissingFixtureError(
      `Captured fixture "${caseName}" sidecar at ${jsonPath} is missing required key(s): ${missingKeys.join(", ")} -- regenerate it with: ${command}`,
      { path: jsonPath, command },
    );
  }

  return { bytes, provenance };
}
