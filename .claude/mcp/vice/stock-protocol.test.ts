// node:test coverage of stock-protocol.ts's framing/parsing seam --
// VERIF-02's byte-at-a-time, JAM, DISPLAY_GET, error-code, desync, and
// unknown-response-type cases (plan 02-04's five of the case's eight), plus
// the socket-driven variants added in Task 2. Colocated, same harness shape
// as vice-probe.test.ts and binmon-fixtures.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";

import {
  parseBuffer,
  parseResponse,
  encodeRequestHeader,
  ViceMonitorClient,
  StockProtocolError,
  StockFramingError,
  StockDesyncError,
  CommandType,
  ResponseType,
  ErrorCode,
  VICE_STX,
  VICE_API_VERSION,
  VICE_BROADCAST_REQUEST_ID,
  RESPONSE_HEADER_LEN,
  REQUEST_HEADER_LEN,
  MAX_BODY_LEN,
} from "./stock-protocol.ts";
import {
  encodeResponseFrame,
  syntheticJamFrame,
  syntheticUnknownTypeFrame,
  syntheticDesyncStream,
  syntheticDisplayGetFrame,
  chunkBytes,
  loadCapturedFixture,
} from "./binmon-fixtures.ts";

// ---------------------------------------------------------------------------
// encodeRequestHeader
// ---------------------------------------------------------------------------

test("encodeRequestHeader: builds the normative 11-byte request header", () => {
  const body = Buffer.from([0xaa, 0xbb]);
  const packet = encodeRequestHeader({ commandType: CommandType.Ping, requestId: 7, body });
  assert.equal(packet.length, REQUEST_HEADER_LEN + body.length);
  assert.equal(packet[0], VICE_STX);
  assert.equal(packet[1], VICE_API_VERSION);
  assert.equal(packet.readUInt32LE(2), body.length);
  assert.equal(packet.readUInt32LE(6), 7);
  assert.equal(packet[10], CommandType.Ping);
});

// ---------------------------------------------------------------------------
// byte-at-a-time framing
// ---------------------------------------------------------------------------

test("parseBuffer: byte-at-a-time delivery yields nothing until the final byte, then one response", () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 42, body: Buffer.alloc(0) });
  const oneShot = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(oneShot.responses.length, 1);

  let buffered = Buffer.alloc(0);
  const counters = { desyncBytes: 0 };
  const collected: unknown[] = [];
  for (const chunk of chunkBytes(frame, 1)) {
    buffered = Buffer.concat([buffered, chunk]);
    const { responses, remainder } = parseBuffer(buffered, counters);
    buffered = remainder;
    collected.push(...responses);
  }
  assert.equal(collected.length, 1);
  assert.deepEqual(collected[0], oneShot.responses[0]);
});

test("parseBuffer: a header whose declared body length exceeds bytes present yields zero responses and leaves the buffer intact", () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.from([1, 2, 3, 4]) });
  const partial = frame.subarray(0, RESPONSE_HEADER_LEN + 2); // header complete, body short
  const { responses, remainder } = parseBuffer(partial, { desyncBytes: 0 });
  assert.equal(responses.length, 0);
  assert.ok(remainder.equals(partial));
});

// ---------------------------------------------------------------------------
// jam
// ---------------------------------------------------------------------------

test("parseBuffer: jam frame with zero-length body parses without throwing, programCounter is null", () => {
  const frame = syntheticJamFrame();
  const { responses, remainder } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  const jam = responses[0] as { type: string; programCounter: number | null };
  assert.equal(jam.type, "jam");
  assert.equal(jam.programCounter, null);
  assert.equal(remainder.length, 0);
});

test("parseBuffer: jam frame never fabricates a PC of 0, and a following valid frame still parses", () => {
  const jamFrame = syntheticJamFrame();
  const nextFrame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 99, body: Buffer.alloc(0) });
  const { responses } = parseBuffer(Buffer.concat([jamFrame, nextFrame]), { desyncBytes: 0 });
  assert.equal(responses.length, 2);
  assert.equal((responses[0] as { programCounter: unknown }).programCounter, null);
  assert.equal((responses[1] as { requestId: number }).requestId, 99);
});

test("parseResponse: jam directly, still null (not fabricated 0)", () => {
  const jam = parseResponse({
    apiVersion: VICE_API_VERSION,
    responseType: ResponseType.Jam,
    errorCode: ErrorCode.Ok,
    requestId: VICE_BROADCAST_REQUEST_ID,
    body: Buffer.alloc(0),
  });
  assert.deepEqual(jam, { type: "jam", requestId: VICE_BROADCAST_REQUEST_ID, errorCode: ErrorCode.Ok, programCounter: null });
});

// ---------------------------------------------------------------------------
// display-get / 157 KB
// ---------------------------------------------------------------------------

test("parseBuffer: the captured display-get fixture parses with body.length matching its declared length and exceeding 157000 bytes", () => {
  const { bytes } = loadCapturedFixture("display-get");
  const declaredBodyLength = bytes.readUInt32LE(2);
  const { responses, remainder } = parseBuffer(bytes, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.equal(remainder.length, 0);
  assert.ok(declaredBodyLength > 157000, `declared body length ${declaredBodyLength} should exceed 157000`);
  const display = responses[0] as { type: string; imageBytes: Uint8Array; debugWidth: number; debugHeight: number };
  assert.equal(display.type, "display");
  assert.equal(display.imageBytes.length, display.debugWidth * display.debugHeight);
});

test("parseBuffer: the synthetic display-get frame's image bytes are located correctly (not overlapping the buflen field)", () => {
  const frame = syntheticDisplayGetFrame({ requestId: 5 });
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  const display = responses[0] as {
    type: string;
    debugWidth: number;
    debugHeight: number;
    bitsPerPixel: number;
    imageBytes: Uint8Array;
  };
  assert.equal(display.type, "display");
  assert.equal(display.debugWidth, 504);
  assert.equal(display.debugHeight, 312);
  assert.equal(display.bitsPerPixel, 8);
  assert.equal(display.imageBytes.length, 504 * 312);
});

// ---------------------------------------------------------------------------
// error code / protocol error
// ---------------------------------------------------------------------------

test("parseBuffer: a frame with error code 0x8f is reported as a distinguishable StockProtocolError, not an empty success", () => {
  const frame = encodeResponseFrame({ responseType: 0x01, errorCode: 0x8f, requestId: 3, body: Buffer.alloc(0) });
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.ok(responses[0] instanceof StockProtocolError);
  const err = responses[0] as StockProtocolError;
  assert.equal(err.errorCode, 0x8f);
  assert.equal(err.responseType, 0x01);
  assert.equal(err.requestId, 3);
});

test("parseBuffer: a frame with error code 0x00 is not reported as a protocol error", () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 4, body: Buffer.alloc(0) });
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.ok(!(responses[0] instanceof StockProtocolError));
});

test("parseResponse: an api_version mismatch is a distinguishable StockFramingError naming the observed value, not a throw out of parseBuffer", () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 5, apiVersion: 0x03, body: Buffer.alloc(0) });
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.ok(responses[0] instanceof StockFramingError);
  const err = responses[0] as StockFramingError;
  assert.equal(err.observed, 0x03);
});

// ---------------------------------------------------------------------------
// unknown response type (VERIF-02 case 6)
// ---------------------------------------------------------------------------

test("parseBuffer: an unknown response type byte (0x00) parses to the fallback shape rather than throwing, and a following frame still parses", () => {
  const unknownFrame = syntheticUnknownTypeFrame();
  const nextFrame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 6, body: Buffer.alloc(0) });
  const { responses } = parseBuffer(Buffer.concat([unknownFrame, nextFrame]), { desyncBytes: 0 });
  assert.equal(responses.length, 2);
  const fallback = responses[0] as { type: string; responseType: number };
  assert.equal(fallback.type, "unknown");
  assert.equal(fallback.responseType, 0x00);
  assert.equal((responses[1] as { requestId: number }).requestId, 6);
});

// ---------------------------------------------------------------------------
// desync
// ---------------------------------------------------------------------------

test("parseBuffer: a garbage byte between two valid frames costs exactly one byte of desync and both frames still parse", () => {
  const stream = syntheticDesyncStream();
  const { responses, desyncBytes } = parseBuffer(stream, { desyncBytes: 0 });
  assert.equal(responses.length, 2);
  assert.equal(desyncBytes, 1);
});

test("parseBuffer: a declared body length above MAX_BODY_LEN is treated as desync and never allocated against", () => {
  const header = Buffer.alloc(RESPONSE_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = VICE_API_VERSION;
  header.writeUInt32LE(0xffffffff, 2);
  header[6] = 0x01;
  header[7] = 0x00;
  header.writeUInt32LE(1, 8);
  const counters = { desyncBytes: 0 };
  const { responses, desyncBytes } = parseBuffer(header, counters);
  assert.equal(responses.length, 0);
  assert.ok(desyncBytes >= 1);
  assert.ok(counters.desyncBytes >= 1);
});

// ---------------------------------------------------------------------------
// exports / hierarchy sanity
// ---------------------------------------------------------------------------

test("error hierarchy: StockProtocolError, StockFramingError, StockDesyncError are distinguishable", () => {
  const protocolErr = new StockProtocolError("boom", { errorCode: 0x8f, responseType: 0x01, requestId: 1 });
  const framingErr = new StockFramingError("boom", { observed: 0x03, expected: 0x02 });
  const desyncErr = new StockDesyncError("boom", { bytesSkipped: 5 });
  assert.equal(protocolErr.name, "StockProtocolError");
  assert.equal(framingErr.name, "StockFramingError");
  assert.equal(desyncErr.name, "StockDesyncError");
  assert.notEqual(protocolErr.constructor, framingErr.constructor);
});

// ===========================================================================
// Task 2: ViceMonitorClient socket layer
// ===========================================================================

/** Start a raw net server driven by `handler(socket)`, run `fn(port)` against
 * it, then shut down -- closeAllConnections() BEFORE close() so a stub that
 * never finishes a frame cannot wedge the suite. Mirrors vice-probe.test.ts's
 * withStubServer() harness discipline for net.Server instead of http.Server. */
async function withStubNetServer<T>(
  handler: (socket: import("node:net").Socket) => void,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("ViceMonitorClient: a full frame written in one write() emits exactly one parsed response", async () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) });
  await withStubNetServer(
    (socket) => socket.write(frame),
    async (port) => {
      const client = new ViceMonitorClient();
      const received: unknown[] = [];
      client.on("response", (r) => received.push(r));
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(received.length, 1);
      await client.disconnect();
    },
  );
});

test("ViceMonitorClient: byte-at-a-time delivery over a real socket parses one response with identical fields", async () => {
  const frame = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 2, body: Buffer.alloc(0) });
  await withStubNetServer(
    (socket) => {
      for (const chunk of chunkBytes(frame, 1)) {
        socket.write(chunk);
      }
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const received: unknown[] = [];
      client.on("response", (r) => received.push(r));
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(received.length, 1);
      assert.equal((received[0] as { requestId: number }).requestId, 2);
      await client.disconnect();
    },
  );
});

test("ViceMonitorClient: the captured display-get frame delivered in 4KB chunks emits one response with the declared body length intact", async () => {
  const { bytes } = loadCapturedFixture("display-get");
  await withStubNetServer(
    (socket) => {
      for (const chunk of chunkBytes(bytes, 4096)) {
        socket.write(chunk);
      }
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const received: unknown[] = [];
      client.on("response", (r) => received.push(r));
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(received.length, 1);
      const display = received[0] as { debugWidth: number; debugHeight: number; imageBytes: Uint8Array };
      assert.equal(display.imageBytes.length, display.debugWidth * display.debugHeight);
      await client.disconnect();
    },
  );
});

test("ViceMonitorClient: a jam frame and an unknown response type do not produce an unhandled exception", async () => {
  const jamFrame = syntheticJamFrame();
  const unknownFrame = syntheticUnknownTypeFrame();
  let uncaught: unknown = null;
  const onUncaught = (err: unknown) => {
    uncaught = err;
  };
  process.on("uncaughtException", onUncaught);
  try {
    await withStubNetServer(
      (socket) => {
        socket.write(jamFrame);
        socket.write(unknownFrame);
      },
      async (port) => {
        const client = new ViceMonitorClient();
        let socketErrored = false;
        client.on("transport-error", () => {
          socketErrored = true;
        });
        await client.connect("127.0.0.1", port);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(socketErrored, false);
        await client.disconnect();
      },
    );
  } finally {
    process.removeListener("uncaughtException", onUncaught);
  }
  assert.equal(uncaught, null);
});

test("ViceMonitorClient: accumulated buffer above MAX_BODY_LEN without a complete frame emits a StockDesyncError instead of growing without bound", async () => {
  const declaredBodyLength = MAX_BODY_LEN; // boundary: allowed by parseBuffer's own MAX_BODY_LEN check
  const header = Buffer.alloc(RESPONSE_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = VICE_API_VERSION;
  header.writeUInt32LE(declaredBodyLength, 2);
  header[6] = 0x01;
  header[7] = 0x00;
  header.writeUInt32LE(1, 8);
  const sentTotal = MAX_BODY_LEN + 5; // > MAX_BODY_LEN cap, but < the full declared frame length
  const partialBody = Buffer.alloc(sentTotal - RESPONSE_HEADER_LEN, 0);
  const stream = Buffer.concat([header, partialBody]);

  await withStubNetServer(
    (socket) => socket.write(stream),
    async (port) => {
      const client = new ViceMonitorClient();
      const desyncs: unknown[] = [];
      client.on("desync", (e) => desyncs.push(e));
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(desyncs.length, 1);
      assert.ok(desyncs[0] instanceof StockDesyncError);
      await client.disconnect();
    },
  );
});

test("ViceMonitorClient: disconnect() closes the socket and leaves no listener attached", async () => {
  await withStubNetServer(
    () => {
      /* server never writes anything; client just connects then disconnects */
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      assert.equal(client.connected, true);
      await client.disconnect();
      assert.equal(client.connected, false);
    },
  );
});
