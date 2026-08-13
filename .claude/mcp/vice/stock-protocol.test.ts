// node:test coverage of stock-protocol.ts's framing/parsing seam --
// VERIF-02's byte-at-a-time, JAM, DISPLAY_GET, error-code, desync, and
// unknown-response-type cases (plan 02-04's five of the case's eight), the
// socket-driven variants added in plan 02-04's Task 2, and the
// correlation/demux + socket-lifecycle-rejection layer added in plan 02-06
// (VERIF-02's remaining three cases: duplicate reply, event-interleaved,
// checkpoint-list correlation). Colocated, same harness shape as
// vice-probe.test.ts and binmon-fixtures.test.ts.
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
  StockResponseMismatchError,
  StockConnectionClosedError,
  StockRequestTimeoutError,
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
  syntheticDuplicateReplyStream,
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

  let buffered: Buffer = Buffer.alloc(0);
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
// CR-01 (code review 2026-08-13): a COMPLETE frame whose body is shorter
// than its response type requires. The pre-existing coverage above only ever
// exercised an INCOMPLETE frame (declared length exceeding bytes present),
// which parseBuffer() breaks on before parseResponse() is ever called -- the
// four shapes below all reached parseResponse() and threw a bare RangeError
// straight out of a seam documented as "never throws", taking the whole
// accumulated buffer (including valid frames beside them) with it inside
// ViceMonitorClient.
// ---------------------------------------------------------------------------

/** Every reproduced short-body shape, as `[label, responseType, body]`. Each
 * is a frame whose DECLARED length matches the bytes present -- i.e. framing
 * is correct and the body is genuinely too short for its type. */
const SHORT_BODY_CASES: Array<[string, number, Buffer]> = [
  ["A: STOPPED (0x62) with a zero-length body", 0x62, Buffer.alloc(0)],
  ["A': RESUMED (0x63) with a zero-length body", 0x63, Buffer.alloc(0)],
  ["A'': UNDUMP (0x42) with a zero-length body", 0x42, Buffer.alloc(0)],
  ["B: MEM_GET (0x01) with a 1-byte body", 0x01, Buffer.from([0x02])],
  ["B': MEM_GET (0x01) declaring more bytes than its body carries", 0x01, Buffer.from([0x10, 0x00, 0xff])],
  ["D: CHECKPOINT_INFO (0x11) with a 10-byte body", 0x11, Buffer.alloc(10)],
  ["REGISTER_INFO (0x31) claiming 4 registers with no items", 0x31, Buffer.from([0x04, 0x00])],
  ["PALETTE_GET (0x91) claiming 16 items with no items", 0x91, Buffer.from([0x10, 0x00])],
  ["CHECKPOINT_LIST (0x14) with a 2-byte body", 0x14, Buffer.alloc(2)],
];

for (const [label, responseType, body] of SHORT_BODY_CASES) {
  test(`parseBuffer: ${label} is a returned StockFramingError, never a throw`, () => {
    const frame = encodeResponseFrame({ responseType, errorCode: 0x00, requestId: 11, body });
    assert.doesNotThrow(() => parseBuffer(frame, { desyncBytes: 0 }));
    const result = parseBuffer(frame, { desyncBytes: 0 });
    assert.equal(result.responses.length, 1);
    assert.ok(result.responses[0] instanceof StockFramingError, `expected a StockFramingError, got ${String(result.responses[0])}`);
    const err = result.responses[0] as StockFramingError;
    assert.equal(err.responseType, responseType);
    assert.equal(err.requestId, 11);
    // The frame is CONSUMED, so the same bytes cannot re-raise on the next chunk.
    assert.equal(result.remainder.length, 0);
  });
}

test("parseBuffer: case C -- a DISPLAY_GET whose wire info_len lies (0xfffffff0) is a returned StockFramingError, never a RangeError", () => {
  const body = Buffer.alloc(24);
  body.writeUInt32LE(0xfffffff0, 0); // info_len far past the body
  const frame = encodeResponseFrame({ responseType: 0x84, errorCode: 0x00, requestId: 12, body });
  const { responses, remainder } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.ok(responses[0] instanceof StockFramingError);
  assert.equal((responses[0] as StockFramingError).responseType, 0x84);
  assert.equal(remainder.length, 0);
});

test("parseBuffer: a DISPLAY_GET whose buflen exceeds the body is a returned StockFramingError, not a silently short image", () => {
  const infoLen = 13;
  const info = Buffer.alloc(infoLen);
  const infoLenField = Buffer.alloc(4);
  infoLenField.writeUInt32LE(infoLen, 0);
  const buflenField = Buffer.alloc(4);
  buflenField.writeUInt32LE(1024, 0); // claims 1024 pixel bytes
  const body = Buffer.concat([infoLenField, info, buflenField, Buffer.alloc(8)]); // supplies 8
  const frame = encodeResponseFrame({ responseType: 0x84, errorCode: 0x00, requestId: 13, body });
  const { responses } = parseBuffer(frame, { desyncBytes: 0 });
  assert.equal(responses.length, 1);
  assert.ok(responses[0] instanceof StockFramingError);
});

test("parseBuffer: a short body does NOT discard a valid frame sitting beside it in the same buffer", () => {
  const short = encodeResponseFrame({ responseType: 0x62, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: Buffer.alloc(0) });
  const good = encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 77, body: Buffer.alloc(0) });
  const { responses, remainder } = parseBuffer(Buffer.concat([short, good]), { desyncBytes: 0 });
  assert.equal(responses.length, 2);
  assert.ok(responses[0] instanceof StockFramingError);
  assert.equal((responses[1] as { requestId: number }).requestId, 77);
  assert.equal(remainder.length, 0);
});

test("parseResponse: a short body throws StockFramingError (parseBuffer's documented channel), never a RangeError", () => {
  assert.throws(
    () =>
      parseResponse({
        apiVersion: VICE_API_VERSION,
        responseType: ResponseType.Stopped,
        errorCode: ErrorCode.Ok,
        requestId: 1,
        body: Buffer.alloc(0),
      }),
    (err: unknown) => {
      assert.ok(err instanceof StockFramingError, `expected StockFramingError, got ${String(err)}`);
      assert.ok(!(err instanceof RangeError));
      assert.equal((err as StockFramingError).observed, 0);
      assert.equal((err as StockFramingError).expected, 2);
      return true;
    },
  );
});

test("ViceMonitorClient: a short-body event frame does not abandon an in-flight request on the same stream", async () => {
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        // A zero-length STOPPED (the CR-01 case-A shape) arriving BEFORE the
        // real reply. Pre-fix this threw out of parseBuffer(), the client
        // dropped the whole buffer, and the pending PING timed out.
        socket.write(
          encodeResponseFrame({ responseType: 0x62, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: Buffer.alloc(0) }),
        );
        socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) }));
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const desyncs: unknown[] = [];
      client.on("desync", (e) => desyncs.push(e));
      await client.connect("127.0.0.1", port);
      const reply = await client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 1000 });
      assert.equal(reply.requestId, 1);
      assert.equal(desyncs.length, 0, "a short body is a framing error, not a buffer-destroying desync");
      await client.disconnect();
    },
  );
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
 * it, then shut down -- every accepted socket is tracked and destroyed
 * BEFORE close() so a stub that never finishes a frame (or a client that
 * never disconnects) cannot leave a lingering handle open and wedge the
 * suite. net.Server has no closeAllConnections() (that method exists only
 * on http.Server) -- tracking accepted sockets ourselves is the net.Server
 * equivalent of vice-probe.test.ts's withStubServer() harness discipline. */
async function withStubNetServer<T>(
  handler: (socket: import("node:net").Socket) => void,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
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

// ===========================================================================
// Task 1 (plan 02-06): correlation/demux layer -- pending map,
// request-id-first routing, N+1 related-frame accumulation,
// expected-response validation, duplicate-reply detection.
// ===========================================================================

/** Minimal CHECKPOINT_INFO body (23 bytes per monitor_binary.c's
 * monitor_binary_response_checkpoint_info()) with only the checkpoint id
 * field set -- every other field defaults to 0, which parseResponse()
 * happily decodes without further validation. */
function checkpointInfoBody(id: number): Buffer {
  const body = Buffer.alloc(23);
  body.writeUInt32LE(id, 0);
  return body;
}

/** Minimal REGISTER_INFO body: a uint16LE register count with no entries. */
function registerInfoBody(count = 0): Buffer {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(count, 0);
  return body;
}

test("correlat: two commands with distinct request ids each resolve with their own reply even when replies arrive out of order", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        // Reply to request id 2 first, then request id 1 -- out of order.
        socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 2, body: Buffer.alloc(0) }));
        socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) }));
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      const first = client.send(CommandType.Ping);
      const second = client.send(CommandType.Ping);
      const [firstResult, secondResult] = await Promise.all([first, second]);
      assert.equal((firstResult as { requestId: number }).requestId, 1);
      assert.equal((secondResult as { requestId: number }).requestId, 2);
      await client.disconnect();
    },
  );
});

test("correlat: the captured checkpoint-list fixture resolves exactly once, with every interim CHECKPOINT_INFO frame accumulated into related[]", async () => {
  const { bytes } = loadCapturedFixture("checkpoint-list");
  await withStubNetServer(
    (socket) => socket.on("data", () => socket.write(bytes)),
    async (port) => {
      const client = new ViceMonitorClient({ initialRequestId: 4 });
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.CheckpointList);
      const list = result as { type: string; related: Array<{ type: string }>; total: number };
      assert.equal(list.type, "checkpoint_list");
      assert.equal(list.related.length, 2);
      assert.ok(list.related.every((entry) => entry.type === "checkpoint_info"));
      // The captured stream's two earlier CHECKPOINT_INFO replies (request
      // ids 2 and 3, from the CHECKPOINT_SET calls the fixture models) were
      // never pending under this client -- emitted as events, not folded
      // into related[].
      assert.equal(events.length, 2);
      await client.disconnect();
    },
  );
});

test("correlat: the captured event-interleaved fixture resolves the command it contains and emits at least one event, in that order", async () => {
  const { bytes } = loadCapturedFixture("event-interleaved");
  await withStubNetServer(
    (socket) => socket.on("data", () => socket.write(bytes)),
    async (port) => {
      const client = new ViceMonitorClient({ initialRequestId: 2 });
      const order: string[] = [];
      client.on("event", () => order.push("event"));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.AdvanceInstructions).then((r) => {
        order.push("resolved");
        return r;
      });
      assert.equal((result as { requestId: number }).requestId, 2);
      assert.ok(order.filter((entry) => entry === "event").length >= 1);
      assert.equal(order[order.length - 1], "resolved");
      await client.disconnect();
    },
  );
});

test("correlat: a reply whose response type is not in the command's expected set rejects with StockResponseMismatchError naming both the expected and the received type", async () => {
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        // Ping (command 0x81) expects response type 0x81, but the reply
        // carries checkpoint_info's response type (0x11) instead.
        socket.write(encodeResponseFrame({ responseType: 0x11, errorCode: 0x00, requestId: 1, body: checkpointInfoBody(1) }));
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      await assert.rejects(client.send(CommandType.Ping), (err: unknown) => {
        assert.ok(err instanceof StockResponseMismatchError);
        const mismatch = err as StockResponseMismatchError;
        assert.equal(mismatch.expected, 0x81);
        assert.equal(mismatch.received, 0x11);
        assert.equal(mismatch.requestId, 1);
        return true;
      });
      await client.disconnect();
    },
  );
});

test("WR-02: a request that times out and is answered afterwards counts as a duplicate reply and emits NO event", async () => {
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        // Answer well after the caller's own 50ms deadline has elapsed.
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) })), 120);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);

      await assert.rejects(client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 50 }), StockRequestTimeoutError);
      assert.equal(client.counters.duplicateReplies, 0, "nothing has arrived yet");

      await new Promise((r) => setTimeout(r, 200));

      assert.equal(client.counters.duplicateReplies, 1, "the late reply for an abandoned id must be counted as a duplicate");
      assert.deepEqual(events, [], "a late COMMAND REPLY must never be emitted on the event channel");
      await client.disconnect();
    },
  );
});

test("correlat: mintRequestId never produces VICE_BROADCAST_REQUEST_ID across 1000 consecutive mints", () => {
  const client = new ViceMonitorClient();
  const seen = new Set<number>();
  for (let i = 0; i < 1000; i += 1) {
    seen.add(client.mintRequestId());
  }
  assert.equal(seen.has(VICE_BROADCAST_REQUEST_ID), false);
  assert.equal(seen.size, 1000);
});

test("correlat: mintRequestId defensively skips VICE_BROADCAST_REQUEST_ID even when seeded exactly at it", () => {
  const client = new ViceMonitorClient({ initialRequestId: VICE_BROADCAST_REQUEST_ID });
  const first = client.mintRequestId();
  assert.notEqual(first, VICE_BROADCAST_REQUEST_ID);
  assert.equal(first, 1);
});

test("correlat: mintRequestId wraps back to 1 at 0xfffffffe, never minting 0xffffffff", () => {
  const client = new ViceMonitorClient({ initialRequestId: 0xfffffffd });
  assert.equal(client.mintRequestId(), 0xfffffffd);
  assert.equal(client.mintRequestId(), 0xfffffffe);
  assert.equal(client.mintRequestId(), 1); // 0xffffffff skipped entirely
});

test("demux/event: a JAM (0x61) frame at the broadcast id is emitted as an event and does not resolve an unrelated pending PING", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        socket.write(syntheticJamFrame());
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) })), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.Ping);
      assert.equal((result as { type: string }).type, "unknown");
      assert.equal(events.length, 1);
      assert.equal((events[0] as { type: string }).type, "jam");
      await client.disconnect();
    },
  );
});

test("demux/event: a STOPPED (0x62) frame at the broadcast id is emitted as an event and does not resolve an unrelated pending PING", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        socket.write(
          encodeResponseFrame({ responseType: 0x62, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: Buffer.from([0x00, 0x10]) }),
        );
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) })), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.Ping);
      assert.equal((result as { type: string }).type, "unknown");
      assert.equal(events.length, 1);
      assert.equal((events[0] as { type: string }).type, "stopped");
      await client.disconnect();
    },
  );
});

test("demux/event: a RESUMED (0x63) frame at the broadcast id is emitted as an event and does not resolve an unrelated pending PING", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        socket.write(
          encodeResponseFrame({ responseType: 0x63, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: Buffer.from([0x00, 0x10]) }),
        );
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) })), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.Ping);
      assert.equal((result as { type: string }).type, "unknown");
      assert.equal(events.length, 1);
      assert.equal((events[0] as { type: string }).type, "resumed");
      await client.disconnect();
    },
  );
});

test("demux/event: a CHECKPOINT_INFO (0x11) frame at the broadcast id is emitted as an event and does not resolve a pending CHECKPOINT_GET with the wrong checkpoint's data", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        // Broadcast CHECKPOINT_INFO for a DIFFERENT checkpoint (999) -- a
        // demux that checked response type before request id could wrongly
        // resolve the pending CHECKPOINT_GET below with this data instead.
        socket.write(
          encodeResponseFrame({ responseType: 0x11, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: checkpointInfoBody(999) }),
        );
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x11, errorCode: 0x00, requestId: 1, body: checkpointInfoBody(7) })), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.CheckpointGet, Buffer.from([7, 0, 0, 0]));
      const checkpoint = result as { type: string; checkpoint: { id: number } };
      assert.equal(checkpoint.type, "checkpoint_info");
      assert.equal(checkpoint.checkpoint.id, 7); // the pending command's OWN checkpoint, not 999
      assert.equal(events.length, 1);
      const event = events[0] as { type: string; checkpoint: { id: number } };
      assert.equal(event.type, "checkpoint_info");
      assert.equal(event.checkpoint.id, 999);
      await client.disconnect();
    },
  );
});

test("demux/event: a REGISTER_INFO (0x31) frame at the broadcast id is emitted as an event and does not resolve a pending REGISTERS_GET", async () => {
  await withStubNetServer(
    (socket) => {
      let replied = false;
      socket.on("data", () => {
        if (replied) return;
        replied = true;
        socket.write(
          encodeResponseFrame({ responseType: 0x31, errorCode: 0x00, requestId: VICE_BROADCAST_REQUEST_ID, body: registerInfoBody(0) }),
        );
        setTimeout(() => socket.write(encodeResponseFrame({ responseType: 0x31, errorCode: 0x00, requestId: 1, body: registerInfoBody(0) })), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.RegistersGet, Buffer.from([0]));
      assert.equal((result as { type: string }).type, "registers");
      assert.equal((result as { requestId: number }).requestId, 1);
      assert.equal(events.length, 1);
      assert.equal((events[0] as { type: string }).type, "registers");
      assert.equal((events[0] as { requestId: number }).requestId, VICE_BROADCAST_REQUEST_ID);
      await client.disconnect();
    },
  );
});

test("demux/event: a frame at a non-broadcast id that was never pending and is not in the settled ring is emitted as an event", async () => {
  await withStubNetServer(
    (socket) => socket.write(encodeResponseFrame({ responseType: 0x62, errorCode: 0x00, requestId: 42, body: Buffer.from([0x00, 0x10]) })),
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(events.length, 1);
      assert.equal((events[0] as { requestId: number }).requestId, 42);
      await client.disconnect();
    },
  );
});

test("duplicate: syntheticDuplicateReplyStream(id) resolves the pending command exactly once, increments counters.duplicateReplies by one, and emits no 'event'", async () => {
  await withStubNetServer(
    (socket) => socket.on("data", () => socket.write(syntheticDuplicateReplyStream(1))),
    async (port) => {
      const client = new ViceMonitorClient();
      const events: unknown[] = [];
      client.on("event", (e) => events.push(e));
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.MemoryGet, Buffer.alloc(4));
      assert.equal((result as { type: string }).type, "memory_get");
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(client.counters.duplicateReplies, 1);
      assert.equal(events.length, 0);
      await client.disconnect();
    },
  );
});

// ===========================================================================
// Task 2 (plan 02-06): socket-lifecycle rejection distinguishable from
// timeout (D-11).
// ===========================================================================

test("closed: a stub server that closes the connection with two commands in flight rejects both with StockConnectionClosedError, and neither rejection is a timeout error", async () => {
  await withStubNetServer(
    (socket) => {
      setTimeout(() => socket.end(), 20);
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      const first = client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 5000 });
      const second = client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 5000 });
      await assert.rejects(first, (err: unknown) => {
        assert.ok(err instanceof StockConnectionClosedError);
        assert.ok(!(err instanceof StockRequestTimeoutError));
        return true;
      });
      await assert.rejects(second, (err: unknown) => {
        assert.ok(err instanceof StockConnectionClosedError);
        return true;
      });
    },
  );
});

test("timeout: a stub server that accepts a command and never replies rejects it with StockRequestTimeoutError after timeoutMs, a different class from the close-path error", async () => {
  await withStubNetServer(
    () => {
      /* never write anything back, never close either */
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      const startedAt = Date.now();
      await assert.rejects(client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 100 }), (err: unknown) => {
        assert.ok(err instanceof StockRequestTimeoutError);
        assert.ok(!(err instanceof StockConnectionClosedError));
        return true;
      });
      assert.ok(Date.now() - startedAt >= 90);
      await client.disconnect();
    },
  );
});

test("died: a socket 'error' (ECONNRESET) is treated the same as a close -- every pending command rejects with the died-underneath error", async () => {
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        setTimeout(() => socket.resetAndDestroy(), 10);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      let transportErrored = false;
      client.on("transport-error", () => {
        transportErrored = true;
      });
      await client.connect("127.0.0.1", port);
      await assert.rejects(client.send(CommandType.Ping), (err: unknown) => {
        assert.ok(err instanceof StockConnectionClosedError);
        assert.equal((err as StockConnectionClosedError).trigger, "error");
        return true;
      });
      assert.equal(transportErrored, true);
    },
  );
});

test("closed: after a close, a new command issued on the closed client rejects immediately with the same died-underneath error rather than hanging", async () => {
  await withStubNetServer(
    (socket) => {
      setTimeout(() => socket.end(), 10);
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      await new Promise((resolve) => client.on("close", resolve));
      await assert.rejects(client.send(CommandType.Ping), (err: unknown) => {
        assert.ok(err instanceof StockConnectionClosedError);
        return true;
      });
    },
  );
});

test("closed: the close path clears the pending map, so a late frame for the abandoned request id on the next connection resolves nothing and is merely emitted as an event", async () => {
  await withStubNetServer(
    (socket) => setTimeout(() => socket.end(), 10),
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      const abandoned = client.send(CommandType.Ping); // mints request id 1
      await assert.rejects(abandoned, (err: unknown) => err instanceof StockConnectionClosedError);

      await withStubNetServer(
        (socket2) => {
          socket2.on("data", () => {
            // A "late" frame for the OLD abandoned request id (1) -- since
            // the pending map was cleared on close, this finds no pending
            // entry and is merely emitted as an event, not a stale
            // resolution of a promise nothing still references.
            socket2.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 1, body: Buffer.alloc(0) }));
            socket2.write(encodeResponseFrame({ responseType: 0x81, errorCode: 0x00, requestId: 2, body: Buffer.alloc(0) }));
          });
        },
        async (port2) => {
          const events: unknown[] = [];
          client.on("event", (e) => events.push(e));
          await client.connect("127.0.0.1", port2);
          const result = await client.send(CommandType.Ping); // mints request id 2 -- the minter never resets
          assert.equal((result as { requestId: number }).requestId, 2);
          assert.equal(events.length, 1);
          assert.equal((events[0] as { requestId: number }).requestId, 1);
          await client.disconnect();
        },
      );
    },
  );
});

test("closed: counters survive a close and report the desync and duplicate totals accumulated during the connection", async () => {
  await withStubNetServer(
    (socket) => {
      socket.on("data", () => {
        // One garbage byte (a desync), then a duplicate reply pair, then close.
        socket.write(Buffer.from([0x99]));
        socket.write(syntheticDuplicateReplyStream(1));
        setTimeout(() => socket.end(), 20);
      });
    },
    async (port) => {
      const client = new ViceMonitorClient();
      await client.connect("127.0.0.1", port);
      const result = await client.send(CommandType.MemoryGet, Buffer.alloc(4));
      assert.equal((result as { type: string }).type, "memory_get");
      await new Promise((resolve) => client.on("close", resolve));
      assert.ok(client.counters.desyncBytes >= 1);
      assert.equal(client.counters.duplicateReplies, 1);
    },
  );
});
