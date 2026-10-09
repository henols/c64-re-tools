import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attachmentCount,
  checkHello,
  encodeFrame,
  isRelativePath,
  validateSourceTree,
  validateToolParams,
  validateToolResult,
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
import { FrameDecoder } from "./protocol.testkit.ts";

const hello = { type: "hello", protocol: HOST_PROTOCOL_ID, version: HOST_PROTOCOL_VERSION, role: "vice-session" } as const;

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
  assert.deepEqual(parseClientMessage({ type: "ping" }), { type: "ping" });
  assert.throws(() => parseClientMessage([]), ProtocolError);
});

test("host messages are validated", () => {
  assert.deepEqual(parseHostMessage({ type: "ready" }), { type: "ready" });
  assert.deepEqual(parseHostMessage({ type: "pong" }), { type: "pong" });
  const error = { code: "machine-unavailable", message: "VICE did not start" };
  assert.deepEqual(parseHostMessage({ type: "error", error }), { type: "error", error });
  assert.deepEqual(parseHostMessage({ type: "reply", id: 3, error }), { type: "reply", id: 3, error });
  assert.deepEqual(parseHostMessage({ type: "reply", id: 3, result: { a: 1 } }), { type: "reply", id: 3, result: { a: 1 } });
  assert.throws(() => parseHostMessage({ type: "reply", id: 3 }), ProtocolError);
  assert.throws(() => parseHostMessage({ type: "reply", id: 3, error: { code: "boom", message: "x" } }), ProtocolError);
});

test("a hello from another protocol version is installation-incomplete without naming versions", () => {
  assert.equal(checkHello(hello), undefined);
  for (const other of [{ ...hello, version: HOST_PROTOCOL_VERSION - 1 }, { ...hello, version: HOST_PROTOCOL_VERSION + 1 }, { ...hello, protocol: "something-else" }]) {
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

test("an operation refuses a field it does not take, also inside a nested object", () => {
  const unknown = (field: string) => (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && error.message.endsWith(`: ${field}`);
  const range = { address: 0, size: 1, space: "c64", view: "cpu" };
  assert.throws(() => validateViceParams("status", { verbose: true }), unknown("verbose"));
  assert.throws(() => validateViceParams("memoryRead", { ...range, format: "hex" }), unknown("format"));
  assert.throws(() => validateViceParams("snapshot", { action: "list", name: "a" }), unknown("name"));
  assert.throws(() => validateViceParams("breakpoint", { action: "list", space: "c64" }), unknown("space"));
  assert.throws(() => validateViceParams("breakpoint", { action: "add", address: 0, space: "c64", size: 2 }), unknown("size"));
  assert.throws(() => validateViceParams("observe", { memory: [{ ...range, extra: 1 }] }), unknown("extra"));
  assert.throws(() => validateViceParams("memoryCompare", { left: { address: 0, space: "c64", view: "cpu", bank: 1 }, right: { address: 0, space: "c64", view: "cpu" }, size: 1 }), unknown("bank"));
  assert.throws(
    () => validateViceParams("screenCompare", { baseline: "b", maxMismatchRatio: 0, mask: [{ x: 0, y: 0, width: 1, height: 1, z: 0 }], includeDiff: false }),
    unknown("z"),
  );
  assert.throws(
    () => validateViceParams("runUntil", { target: { kind: "raster", line: 0, frame: 1 }, timeoutFrames: 1 }),
    unknown("frame"),
  );
  assert.throws(
    () => validateViceParams("runUntil", { target: { kind: "address", address: 0, space: "c64", condition: { kind: "register", register: "a", operator: "eq", value: 0, mask: 1 } }, timeoutFrames: 1 }),
    unknown("mask"),
  );
  assert.throws(() => validateToolParams("host.status", { verbose: true }, []), unknown("verbose"));
});

test("operation results are validated on the client", () => {
  const registers = { pc: 0xe5cf, a: 0, x: 0, y: 10, sp: 0xf3, flags: { n: false, v: false, b: true, d: false, i: true, z: false, c: false } };
  assert.deepEqual(validateViceResult("registersGet", registers), registers);
  assert.throws(() => validateViceResult("registersGet", { ...registers, a: 256 }), ProtocolError);
  assert.deepEqual(validateViceResult("memoryRead", { address: 1, data: "a900" }), { address: 1, data: "a900" });
  assert.throws(() => validateViceResult("memoryRead", { address: 1, data: "A9" }), ProtocolError);
  assert.throws(() => validateViceResult("memoryRead", { address: 1, data: "a9f" }), ProtocolError);
  // D21: a point carries its condition; a reset that stops gives its pc.
  const point = { id: 1, address: 0x2100, space: "c64", enabled: true, condition: { kind: "register", register: "a", operator: "eq", value: 66 } };
  assert.deepEqual(validateViceResult("breakpoint", point), point);
  assert.throws(() => validateViceResult("breakpoint", { ...point, condition: { kind: "register", register: "q" } }), ProtocolError);
  assert.deepEqual(validateViceResult("reset", { state: "stopped", pc: 0xfce2 }), { state: "stopped", pc: 0xfce2 });
  assert.throws(() => validateViceResult("reset", { state: "stopped", pc: 0x10000 }), ProtocolError);
  const status = { state: "running", videoStandard: "pal", warp: false, window: false };
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

test("bad attachment announcements and empty or overlong attachment frames are refused", () => {
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
  assert.throws(() => new MessageReader().push(raw({ type: "request", attachments: [2] }, frameOf(Buffer.alloc(0)))), /attachment frame is empty/);
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

test("checkpoint parameters and typed conditions are validated", () => {
  assert.deepEqual(validateViceParams("breakpoint", { action: "list" }), { action: "list" });
  assert.deepEqual(validateViceParams("breakpoint", { action: "disable", id: 4 }), { action: "disable", id: 4 });
  assert.deepEqual(
    validateViceParams("watchpoint", {
      action: "add",
      address: 0xc020,
      size: 2,
      access: "write",
      space: "c64",
      condition: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" },
    }),
    {
      action: "add",
      address: 0xc020,
      size: 2,
      access: "write",
      space: "c64",
      condition: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" },
    },
  );
  for (const params of [
    { action: "add", address: 0x2100, space: "c64", condition: { kind: "register", register: "pc", operator: "eq", value: 1 } },
    { action: "add", address: 0x2100, space: "c64", condition: { kind: "register", register: "a", operator: "==", value: 1 } },
    { action: "add", address: 0x2100, space: "c64", condition: { kind: "register", register: "a", operator: "eq", value: 256 } },
    { action: "add", address: 0x2100, space: "c64", condition: { kind: "raster", line: 400 } },
    { action: "add", address: 0x2100, space: "c64", condition: { kind: "expression", text: "A == 1" } },
    { action: "remove", id: 0 },
    { action: "toggle", id: 1 },
  ]) {
    assert.throws(() => validateViceParams("breakpoint", params), WireFailure, JSON.stringify(params));
  }
  for (const params of [
    { action: "add", address: 0xfff0, size: 17, access: "write", space: "c64" },
    { action: "add", address: 0x1000, size: 257, access: "write", space: "c64" },
    { action: "add", address: 0x1000, size: 1, access: "exec", space: "c64" },
  ]) {
    assert.throws(() => validateViceParams("watchpoint", params), WireFailure, JSON.stringify(params));
  }
});

test("advance-frames needs a count and run-until targets are validated", () => {
  assert.throws(() => validateViceParams("execution", { action: "advance-frames", space: "c64" }), /needs count/);
  assert.deepEqual(validateViceParams("execution", { action: "advance-frames", count: 20, space: "c64" }), {
    action: "advance-frames",
    count: 20,
    space: "c64",
  });
  assert.deepEqual(validateViceParams("runUntil", { target: { kind: "raster", line: 100, cycle: 20 }, timeoutFrames: 3000 }), {
    target: { kind: "raster", line: 100, cycle: 20 },
    timeoutFrames: 3000,
  });
  assert.deepEqual(
    validateViceParams("runUntil", {
      target: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" },
      timeoutFrames: 1,
    }),
    { target: { kind: "memory", address: 0xc020, operator: "eq", value: 3, space: "c64", view: "cpu" }, timeoutFrames: 1 },
  );
  for (const params of [
    { target: { kind: "address", address: 0xc000, space: "c64" }, timeoutFrames: 0 },
    { target: { kind: "address", address: 0xc000, space: "c64" }, timeoutFrames: 30001 },
    { target: { kind: "pc", address: 0xc000 }, timeoutFrames: 10 },
    { target: { kind: "memory", address: 0xc020, operator: "eq", value: 300, space: "c64", view: "cpu" }, timeoutFrames: 10 },
  ]) {
    assert.throws(() => validateViceParams("runUntil", params), WireFailure, JSON.stringify(params));
  }
});

test("search, compare and disassemble parameters are validated", () => {
  const search = { start: 0x0800, end: 0xffff, pattern: [0xa9, null, 0x8d], space: "c64", view: "cpu", maxResults: 100 };
  assert.deepEqual(validateViceParams("memorySearch", search), search);
  for (const bad of [
    { ...search, pattern: [] },
    { ...search, pattern: [null, null] },
    { ...search, pattern: Array(257).fill(1) },
    { ...search, pattern: [256] },
    { ...search, end: 0x0700 },
    { ...search, maxResults: 1001 },
  ]) {
    assert.throws(() => validateViceParams("memorySearch", bad), WireFailure, JSON.stringify(bad).slice(0, 80));
  }
  assert.throws(
    () =>
      validateViceParams("memoryCompare", {
        left: { address: 0xfff0, space: "c64", view: "cpu" },
        right: { address: 0, space: "c64", view: "cpu" },
        size: 32,
      }),
    /left range/,
  );
  assert.throws(() => validateViceParams("disassemble", { address: 0, count: 257, space: "c64", view: "cpu" }), WireFailure);
});

test("observe needs at least one observation and bounds its memory", () => {
  assert.throws(() => validateViceParams("observe", {}), /at least one/);
  assert.throws(() => validateViceParams("observe", { vicii: false }), /at least one/);
  const range = { address: 0x1000, size: 300, space: "c64", view: "cpu" };
  assert.throws(() => validateViceParams("observe", { memory: Array(14).fill(range) }), /4096/);
  assert.throws(() => validateViceParams("observe", { memory: Array(17).fill({ ...range, size: 1 }) }), /16/);
  assert.throws(() => validateViceParams("observe", { sprites: [1, 1] }), WireFailure);
  assert.deepEqual(validateViceParams("observe", { timing: true, cia: "both" }), { timing: true, cia: "both" });
});

test("relative paths and source trees are validated", () => {
  for (const good of ["main.a", "lib/consts.a", "a b/c.d"]) assert.ok(isRelativePath(good), good);
  for (const bad of ["", "/etc/passwd", "../x", "a/../b", "./a", "a//b", "a/", "a\\b", "a/./b", ".."]) assert.ok(!isRelativePath(bad), bad);
  const files = [{ path: "main.a", size: 2 }, { path: "lib/x.a", size: 0 }];
  assert.deepEqual(validateSourceTree(files, [Buffer.from("ab"), Buffer.alloc(0)]), files);
  assert.throws(() => validateSourceTree(files, [Buffer.from("ab")]), /attachment/);
  assert.throws(() => validateSourceTree([{ path: "main.a", size: 3 }], [Buffer.from("ab")]), /size/);
  assert.throws(() => validateSourceTree([...files, files[0]], [Buffer.from("ab"), Buffer.alloc(0), Buffer.from("ab")]), /twice/);
});

test("c1541.inspect parameters and results are validated", () => {
  const image = [Buffer.alloc(174848)];
  assert.deepEqual(validateToolParams("c1541.inspect", { action: "directory", imageType: "d64" }, image), { action: "directory", imageType: "d64" });
  assert.deepEqual(validateToolParams("c1541.inspect", { action: "read", imageType: "d81", name: "game{$c1}" }, image).name, "game{$c1}");
  for (const params of [
    { action: "format", imageType: "d64" },
    { action: "directory", imageType: "t64" },
    { action: "directory", imageType: "d64", name: "X" },
    { action: "read", imageType: "d64" },
    { action: "read", imageType: "d64", name: "café" },
    { action: "read", imageType: "d64", name: "SEVENTEEN LETTERS" },
    { action: "bam", imageType: "d64", command: "-format" },
  ]) {
    assert.throws(() => validateToolParams("c1541.inspect", params, image), WireFailure, JSON.stringify(params));
  }
  assert.throws(() => validateToolParams("c1541.inspect", { action: "bam", imageType: "d64" }, []), WireFailure, "the image is necessary");
  const read = { action: "read", found: true, name: "GAME", bytes: 3 };
  assert.deepEqual(validateToolResult("c1541.inspect", read, [Buffer.alloc(3)]), read);
  assert.throws(() => validateToolResult("c1541.inspect", read, [Buffer.alloc(4)]), ProtocolError, "the byte count must match");
  assert.throws(() => validateToolResult("c1541.inspect", { action: "read", found: false }, [Buffer.alloc(1)]), ProtocolError);
  const directory = { action: "directory", diskName: "D", diskId: "01", dosType: "2A", freeBlocks: 664, entries: [{ name: "A", type: "prg", blocks: 1, closed: true, locked: false }] };
  assert.deepEqual(validateToolResult("c1541.inspect", directory, []), directory);
  assert.throws(() => validateToolResult("c1541.inspect", { ...directory, entries: [{ name: "A", type: "exe", blocks: 1, closed: true, locked: false }] }, []), ProtocolError);
  const entry = { action: "entry", found: true, entry: { name: "A", type: "prg", blocks: 1, closed: true, locked: false, startTrack: 17, startSector: 0 } };
  assert.deepEqual(validateToolResult("c1541.inspect", entry, []), entry);
  assert.deepEqual(validateToolResult("c1541.inspect", { action: "chain", found: true, sectors: [{ track: 17, sector: 0 }] }, []).action, "chain");
});

test("c1541.inspect and petcat.decode refuse an empty attachment in the same words", () => {
  const empty = [Buffer.alloc(0)];
  const refused = (what: string) => (error: unknown) =>
    error instanceof WireFailure && error.code === "invalid-input" && error.message === `${what} must be the one attachment, and it must not be empty`;
  assert.throws(() => validateToolParams("c1541.inspect", { action: "directory", imageType: "d64" }, empty), refused("the disk image"));
  assert.throws(() => validateToolParams("petcat.decode", {}, empty), refused("the program"));
});

test("petcat.decode takes only the program and validates its result", () => {
  assert.deepEqual(validateToolParams("petcat.decode", {}, [Buffer.alloc(4)]), {});
  assert.throws(() => validateToolParams("petcat.decode", { dialect: "70" }, [Buffer.alloc(4)]), WireFailure);
  assert.throws(() => validateToolParams("petcat.decode", {}, []), WireFailure);
  const decoded = {
    decoded: true,
    loadAddress: 0x0801,
    basicEnd: 0x080d,
    listing: "10 sys2061",
    lines: [{ number: 10, text: "sys2061" }],
    handoffs: [
      { kind: "sys", line: 10, address: 0x080d },
      { kind: "usr", line: 20, computed: true },
    ],
  };
  assert.deepEqual(validateToolResult("petcat.decode", decoded, []), decoded);
  assert.deepEqual(validateToolResult("petcat.decode", { decoded: false, reason: "no end" }, []), { decoded: false, reason: "no end" });
  assert.throws(() => validateToolResult("petcat.decode", { ...decoded, handoffs: [{ kind: "usr", line: 10, address: 1 }] }, []), ProtocolError);
  assert.throws(() => validateToolResult("petcat.decode", { ...decoded, handoffs: [{ kind: "sys", line: 10, address: 1, computed: true }] }, []), ProtocolError);
});
