import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkHello,
  encodeFrame,
  FrameDecoder,
  HOST_PROTOCOL_ID,
  HOST_PROTOCOL_VERSION,
  MAX_FRAME_BYTES,
  parseClientMessage,
  parseHostMessage,
  ProtocolError,
  validateViceParams,
  validateViceResult,
  WireFailure,
} from "./protocol.ts";

const hello = { type: "hello", protocol: HOST_PROTOCOL_ID, version: HOST_PROTOCOL_VERSION, role: "vice-session" } as const;

test("private protocol has a stable internal identity", () => {
  assert.equal(HOST_PROTOCOL_ID, "c64-re-tools-host");
  assert.equal(HOST_PROTOCOL_VERSION, 1);
});

test("a frame is a 4-byte big-endian length followed by UTF-8 JSON", () => {
  const frame = encodeFrame({ type: "ready" });
  const body = Buffer.from('{"type":"ready"}', "utf8");
  assert.equal(frame.readUInt32BE(0), body.length);
  assert.deepEqual(frame.subarray(4), body);
});

test("the decoder reassembles frames split at every byte boundary", () => {
  const stream = Buffer.concat([encodeFrame(hello), encodeFrame({ type: "request", id: 7, op: "status", params: {} })]);
  for (let split = 0; split <= stream.length; split++) {
    const decoder = new FrameDecoder();
    const messages = [...decoder.push(stream.subarray(0, split)), ...decoder.push(stream.subarray(split))];
    assert.deepEqual(messages, [hello, { type: "request", id: 7, op: "status", params: {} }]);
  }
});

test("the decoder refuses an oversized length before buffering the body", () => {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(MAX_FRAME_BYTES + 1, 0);
  assert.throws(() => new FrameDecoder().push(header), ProtocolError);
});

test("the decoder refuses a body that is not JSON or not UTF-8", () => {
  const frameOf = (body: Buffer) => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body]);
  };
  assert.throws(() => new FrameDecoder().push(frameOf(Buffer.from("{nope", "utf8"))), /not valid JSON/);
  assert.throws(() => new FrameDecoder().push(frameOf(Buffer.from([0x22, 0xff, 0x22]))), /not valid UTF-8/);
});

test("the encoder refuses a frame larger than the limit", () => {
  const huge = { type: "reply", id: 1, result: "x".repeat(MAX_FRAME_BYTES) } as const;
  assert.throws(() => encodeFrame(huge), ProtocolError);
});

test("client messages are validated", () => {
  assert.deepEqual(parseClientMessage(hello), hello);
  assert.deepEqual(parseClientMessage({ ...hello, videoStandard: "ntsc" }), { ...hello, videoStandard: "ntsc" });
  assert.throws(() => parseClientMessage({ ...hello, role: "admin" }), ProtocolError);
  assert.throws(() => parseClientMessage({ ...hello, videoStandard: "secam" }), ProtocolError);
  assert.throws(() => parseClientMessage({ type: "hello", role: "tool" }), ProtocolError);
  assert.throws(() => parseClientMessage({ type: "request", id: -1, op: "status", params: {} }), ProtocolError);
  assert.throws(() => parseClientMessage({ type: "request", id: 1, op: "status" }), ProtocolError);
  assert.throws(() => parseClientMessage({ type: "shutdown" }), ProtocolError);
  assert.throws(() => parseClientMessage([]), ProtocolError);
});

test("host messages are validated", () => {
  assert.deepEqual(parseHostMessage({ type: "ready" }), { type: "ready" });
  const error = { code: "machine-unavailable", message: "VICE did not start" };
  assert.deepEqual(parseHostMessage({ type: "error", error }), { type: "error", error });
  assert.deepEqual(parseHostMessage({ type: "reply", id: 3, error }), { type: "reply", id: 3, error });
  assert.deepEqual(parseHostMessage({ type: "reply", id: 3, result: { a: 1 } }), { type: "reply", id: 3, result: { a: 1 } });
  assert.throws(() => parseHostMessage({ type: "reply", id: 3 }), ProtocolError);
  assert.throws(() => parseHostMessage({ type: "reply", id: 3, error: { code: "boom", message: "x" } }), ProtocolError);
});

test("a hello from another protocol version is installation-incomplete without naming versions", () => {
  assert.equal(checkHello(hello), undefined);
  for (const other of [{ ...hello, version: 2 }, { ...hello, protocol: "something-else" }]) {
    const failure = checkHello(other);
    assert.equal(failure?.code, "installation-incomplete");
    assert.doesNotMatch(failure.message, /\b\d+\b|protocol/);
  }
});

test("operation parameters are validated with invalid-input", () => {
  assert.deepEqual(validateViceParams("memoryRead", { address: 0xe000, size: 16, space: "c64", view: "cpu" }), {
    address: 0xe000,
    size: 16,
    space: "c64",
    view: "cpu",
  });
  assert.deepEqual(validateViceParams("registersGet", { space: "drive8" }), { space: "drive8" });
  assert.deepEqual(validateViceParams("status", {}), {});
  for (const params of [
    { address: 0x10000, size: 1, space: "c64", view: "cpu" },
    { address: 0, size: 0, space: "c64", view: "cpu" },
    { address: 0, size: 4097, space: "c64", view: "cpu" },
    { address: 0xfff0, size: 17, space: "c64", view: "cpu" },
    { address: 0, size: 1, space: "drive9", view: "cpu" },
    { address: 0, size: 1, space: "c64", view: "rom" },
  ]) {
    assert.throws(
      () => validateViceParams("memoryRead", params),
      (error: unknown) => error instanceof WireFailure && error.code === "invalid-input",
    );
  }
  assert.throws(() => validateViceParams("reboot" as never, {}), WireFailure);
});

test("operation results are validated on the client", () => {
  const registers = { pc: 0xe5cf, a: 0, x: 0, y: 10, sp: 0xf3, flags: { n: false, v: false, b: true, d: false, i: true, z: false, c: false } };
  assert.deepEqual(validateViceResult("registersGet", registers), registers);
  assert.throws(() => validateViceResult("registersGet", { ...registers, a: 256 }), ProtocolError);
  assert.deepEqual(validateViceResult("memoryRead", { address: 1, data: "a900" }), { address: 1, data: "a900" });
  assert.throws(() => validateViceResult("memoryRead", { address: 1, data: "A9" }), ProtocolError);
  assert.throws(() => validateViceResult("memoryRead", { address: 1, data: "a9f" }), ProtocolError);
  const status = { state: "running", videoStandard: "pal", warp: false };
  assert.deepEqual(validateViceResult("status", status), status);
  assert.throws(() => validateViceResult("status", { ...status, state: "unknown" }), ProtocolError);
});

test("write parameters are validated with invalid-input", () => {
  assert.deepEqual(validateViceParams("memoryWrite", { address: 0x2000, data: "a900", space: "c64", view: "ram" }), {
    address: 0x2000,
    data: "a900",
    space: "c64",
    view: "ram",
  });
  for (const params of [
    { address: 0x2000, data: "", space: "c64", view: "cpu" },
    { address: 0x2000, data: "A9", space: "c64", view: "cpu" },
    { address: 0xffff, data: "a900", space: "c64", view: "cpu" },
    { address: 0, data: "00".repeat(4097), space: "c64", view: "cpu" },
  ]) {
    assert.throws(() => validateViceParams("memoryWrite", params), WireFailure);
  }
  assert.deepEqual(validateViceParams("registersSet", { space: "c64", values: { pc: 0x2100, flags: { c: true } } }), {
    space: "c64",
    values: { pc: 0x2100, flags: { c: true } },
  });
  for (const values of [{}, { q: 1 }, { a: 256 }, { pc: -1 }, { flags: { q: true } }, { flags: { c: 1 } }]) {
    assert.throws(() => validateViceParams("registersSet", { space: "c64", values }), WireFailure, JSON.stringify(values));
  }
});
