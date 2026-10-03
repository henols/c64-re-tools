import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attachmentCount,
  checkHello,
  encodeFrame,
  FrameDecoder,
  HOST_PROTOCOL_ID,
  HOST_PROTOCOL_VERSION,
  MAX_ATTACHMENT_BYTES,
  MAX_FRAME_BYTES,
  MessageReader,
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

test("attachments follow their message as raw frames and reassemble at any split", () => {
  const request = { type: "request", id: 5, op: "diskAttach", params: { type: "d64" } } as const;
  const image = Buffer.from(Array.from({ length: 300 }, (_, index) => index & 0xff));
  const stream = Buffer.concat([encodeFrame(request, [image, Buffer.alloc(0), Buffer.from("ab")]), encodeFrame({ type: "hello", protocol: "p", version: 1, role: "tool" })]);
  for (const split of [0, 1, 4, 50, 200, stream.length - 3, stream.length]) {
    const reader = new MessageReader();
    const received = [...reader.push(stream.subarray(0, split)), ...reader.push(stream.subarray(split))];
    assert.equal(received.length, 2);
    assert.deepEqual(received[0]!.message, request, "the announcement is removed from the message");
    assert.deepEqual(received[0]!.attachments, [image, Buffer.alloc(0), Buffer.from("ab")]);
    assert.deepEqual(received[1]!.attachments, []);
  }
});

test("an attachment larger than one frame is split and rejoined", () => {
  const big = Buffer.alloc(MAX_FRAME_BYTES * 2 + 17, 0x5a);
  const [received] = new MessageReader().push(encodeFrame({ type: "request", id: 1, op: "autostart", params: {} }, [big]));
  assert.equal(received!.attachments[0]!.length, big.length);
  assert.ok(received!.attachments[0]!.equals(big));
});

test("bad attachment announcements and overlong attachment frames are refused", () => {
  const raw = (value: unknown, ...extra: Buffer[]) => {
    const body = Buffer.from(JSON.stringify(value));
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body, ...extra]);
  };
  const frameOf = (body: Buffer) => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body]);
  };
  assert.throws(() => new MessageReader().push(raw({ type: "request", attachments: [-1] })), ProtocolError);
  assert.throws(() => new MessageReader().push(raw({ type: "request", attachments: "3" })), ProtocolError);
  assert.throws(() => new MessageReader().push(raw({ type: "request", attachments: [MAX_ATTACHMENT_BYTES, 1] })), ProtocolError);
  assert.throws(() => new MessageReader().push(raw({ type: "request", attachments: [2] }, frameOf(Buffer.from("abc")))), /runs past/);
  assert.throws(() => encodeFrame({ type: "ready" }, [Buffer.alloc(MAX_ATTACHMENT_BYTES + 1)]), ProtocolError);
  assert.throws(() => new FrameDecoder().push(encodeFrame({ type: "ready" }, [Buffer.from("x")])), /unexpected attachments/);
});

test("media parameters are validated with invalid-input", () => {
  assert.deepEqual(validateViceParams("autostart", { type: "d64", index: 0, run: true }), { type: "d64", index: 0, run: true });
  assert.deepEqual(validateViceParams("diskAttach", { type: "g64" }), { type: "g64" });
  assert.deepEqual(validateViceParams("programLoad", {}), {});
  assert.deepEqual(validateViceParams("programLoad", { address: 0xc000 }), { address: 0xc000 });
  assert.throws(() => validateViceParams("autostart", { type: "exe", index: 0, run: true }), /\.prg/);
  assert.throws(() => validateViceParams("diskAttach", { type: "prg" }), /\.d64/);
  assert.throws(() => validateViceParams("programLoad", { address: 0x10000 }), WireFailure);
  assert.equal(attachmentCount("diskAttach"), 1);
  assert.equal(attachmentCount("status"), 0);
});
