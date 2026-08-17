// node:test coverage of stock-vicii.ts -- decodeVicii() and
// handleViciiGetState. Every "session" below is built by makeSession(),
// whose `client` is a real EventEmitter (never a real socket) with a `send`
// spy recording every call as [commandType, body] -- matching
// stock-disassemble.test.ts's own DI-stub convention: these tests assert
// WIRING (call order, call count, byte-level body contents, answer shape)
// and pure decode correctness, never a real protocol round trip.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleViciiGetState, decodeVicii, VICII_UNAVAILABLE_FIELDS } from "./stock-vicii.ts";
import { CommandType, ErrorCode } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

type SendCall = [number, Buffer];

/** Builds a fake StockConnectSession whose `client` is a real EventEmitter
 * with a `send` spy recording every call as [commandType, body]. `sendImpl`
 * decides what each call resolves (or throws) to. Never a real socket. */
function makeSession(sendImpl: (commandType: number, body: Buffer) => unknown): {
  session: StockConnectSession;
  calls: SendCall[];
} {
  const calls: SendCall[] = [];
  const client = Object.assign(new EventEmitter(), {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      calls.push([commandType, body]);
      return sendImpl(commandType, body);
    },
  });
  const session = { client } as unknown as StockConnectSession;
  return { session, calls };
}

const DEPS = {} as unknown as StockDispatchDeps;

function memoryGetReply(bytes: number[], requestId = 1) {
  return { type: "memory_get" as const, requestId, errorCode: ErrorCode.Ok, bytes: Buffer.from(bytes), related: [] };
}

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// Shared 47-byte fixture. Index n maps to address 0xd000 + n. Deliberately
// distinguishable values so a swapped field cannot pass by coincidence.
// ---------------------------------------------------------------------------

function buildFixture(): number[] {
  const b = new Array(47).fill(0);
  // $D000-$D00F: sprite X/Y pairs.
  const xs = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];
  const ys = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
  for (let i = 0; i < 8; i += 1) {
    b[0x00 + i * 2] = xs[i];
    b[0x01 + i * 2] = ys[i];
  }
  b[0x10] = 0b10100101; // sprites 0, 2, 5, 7 have X bit 8 set
  b[0x11] = 0x9b; // %10011011
  b[0x12] = 0x64;
  b[0x13] = 0x07;
  b[0x14] = 0x09;
  b[0x15] = 0b00001111;
  b[0x16] = 0xc8; // %11001000
  b[0x17] = 0b00000011;
  b[0x18] = 0x31;
  b[0x19] = 0b10000001;
  b[0x1a] = 0b00000001;
  b[0x1b] = 0b01000000;
  b[0x1c] = 0b00000010;
  b[0x1d] = 0b10000000;
  b[0x1e] = 0b00000110;
  b[0x1f] = 0b00011000;
  b[0x20] = 0x0e;
  b[0x21] = 0x06;
  b[0x22] = 0x01;
  b[0x23] = 0x02;
  b[0x24] = 0x03;
  b[0x25] = 0x04;
  b[0x26] = 0x05;
  for (let i = 0; i < 8; i += 1) {
    b[0x27 + i] = i + 1;
  }
  return b;
}

const FIXTURE = buildFixture();

// ---------------------------------------------------------------------------
// Decode correctness -- drive decodeVicii() directly, it is pure.
// ---------------------------------------------------------------------------

test("decodeVicii: spriteX reconstructs the 9-bit value across $D000-$D00F and $D010", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteX, [0x110, 0x20, 0x130, 0x40, 0x50, 0x160, 0x70, 0x180]);
});

test("decodeVicii: spriteY reads $D001,$D003,...,$D00F directly", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteY, [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
});

test("decodeVicii: spriteEnabled decodes $D015 bit-for-bit", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteEnabled, [true, true, true, true, false, false, false, false]);
});

test("decodeVicii: spriteExpandY/spriteExpandX/spriteMulticolour/spritePriorityBehindBackground match their fixture bytes", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteExpandY, [true, true, false, false, false, false, false, false]);
  assert.deepEqual(d.spriteExpandX, [false, false, false, false, false, false, false, true]);
  assert.deepEqual(d.spriteMulticolour, [false, true, false, false, false, false, false, false]);
  assert.deepEqual(d.spritePriorityBehindBackground, [false, false, false, false, false, false, true, false]);
});

test("decodeVicii: spriteColour applies the &0x0f mask", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteColour, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("decodeVicii: control1 ($D011) decodes yScroll/rows25/screenOn/bitmapMode/extendedBackgroundMode/rasterMsb", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.control1, {
    raw: 0x9b,
    yScroll: 3,
    rows25: true,
    screenOn: true,
    bitmapMode: false,
    extendedBackgroundMode: false,
    rasterMsb: true,
  });
});

test("decodeVicii: control2 ($D016) decodes xScroll/columns40/multicolourMode", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.control2, { raw: 0xc8, xScroll: 0, columns40: true, multicolourMode: false });
});

test("decodeVicii: rasterLine reconstructs the 9-bit value across $D012 and $D011 bit 7", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.equal(d.rasterLine, 0x164);
});

test("decodeVicii: lightPenX/lightPenY read $D013/$D014 directly", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.equal(d.lightPenX, 0x07);
  assert.equal(d.lightPenY, 0x09);
});

test("decodeVicii: memorySetup ($D018=0x31) decodes screenOffset/charsetOffset/bitmapOffset/relativeTo", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.memorySetup, {
    raw: 0x31,
    screenOffset: 3072,
    charsetOffset: 0,
    bitmapOffset: 0,
    relativeTo: "vic bank",
  });
});

test("decodeVicii: interruptStatus ($D019) decodes rasterIrq/anyIrqPending true, others false", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.interruptStatus, {
    raw: 0b10000001,
    rasterIrq: true,
    spriteBackgroundCollisionIrq: false,
    spriteSpriteCollisionIrq: false,
    lightPenIrq: false,
    anyIrqPending: true,
  });
});

test("decodeVicii: interruptEnable ($D01A) decodes rasterIrqEnabled true, others false", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.interruptEnable, {
    raw: 0b00000001,
    rasterIrqEnabled: true,
    spriteBackgroundCollisionIrqEnabled: false,
    spriteSpriteCollisionIrqEnabled: false,
    lightPenIrqEnabled: false,
  });
});

test("decodeVicii: spriteSpriteCollision/spriteBackgroundCollision match their fixture masks bit for bit", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.deepEqual(d.spriteSpriteCollision, {
    raw: 0b00000110,
    sprites: [false, true, true, false, false, false, false, false],
  });
  assert.deepEqual(d.spriteBackgroundCollision, {
    raw: 0b00011000,
    sprites: [false, false, false, true, true, false, false, false],
  });
});

test("decodeVicii: colour fields decode with the &0x0f mask applied", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.equal(d.borderColour, 0x0e & 0x0f);
  assert.equal(d.backgroundColour, 0x06);
  assert.equal(d.extraBackgroundColour1, 0x01);
  assert.equal(d.extraBackgroundColour2, 0x02);
  assert.equal(d.extraBackgroundColour3, 0x03);
  assert.equal(d.spriteMulticolour1, 0x04);
  assert.equal(d.spriteMulticolour2, 0x05);
});

test("decodeVicii: registersHex is 94 lowercase hex characters and round-trips the fixture bytes", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  const hex = d.registersHex as string;
  assert.equal(hex.length, 94);
  assert.equal(hex, hex.toLowerCase());
  assert.deepEqual([...Buffer.from(hex, "hex")], FIXTURE);
});

// ---------------------------------------------------------------------------
// Criterion 3 -- unavailable fields are never zero and never absent.
// ---------------------------------------------------------------------------

test("decodeVicii: every VICII_UNAVAILABLE_FIELDS member is a plain {available:false,reason} object, never 0 or absent", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  const unavailable = d.unavailable as Record<string, unknown>;
  for (const [name] of VICII_UNAVAILABLE_FIELDS) {
    const value = unavailable[name];
    assert.notEqual(value, undefined, `${name} must not be absent`);
    assert.notEqual(value, null, `${name} must not be null`);
    assert.equal(typeof value, "object", `${name} must be an object, not a primitive`);
    const field = value as { available: unknown; reason: unknown };
    assert.equal(field.available, false);
    assert.equal(typeof field.reason, "string");
    assert.ok((field.reason as string).length > 0, `${name} must carry a non-empty reason`);
  }
});

test("decodeVicii: unavailable.rasterIrqLine is not the number 0 and the key is present", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  const unavailable = d.unavailable as Record<string, unknown>;
  assert.notEqual(unavailable.rasterIrqLine, 0);
  assert.equal("rasterIrqLine" in unavailable, true);
});

test("decodeVicii: rasterLine (readable current line) and unavailable.rasterIrqLine (unreadable compare latch) are distinct keys with different shapes", () => {
  const d = decodeVicii(new Uint8Array(FIXTURE));
  assert.equal(typeof d.rasterLine, "number");
  const unavailable = d.unavailable as Record<string, unknown>;
  assert.equal(typeof unavailable.rasterIrqLine, "object");
  assert.notEqual(d.rasterLine, unavailable.rasterIrqLine);
});

// ---------------------------------------------------------------------------
// Wire body and guards -- drive handleViciiGetState through the fake session.
// ---------------------------------------------------------------------------

test("handleViciiGetState: sidefx:false wire body covers exactly $D000-$D02E", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(FIXTURE));
  const result = await handleViciiGetState({}, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], CommandType.MemoryGet);
  assert.equal(calls[0]![1].length, 8);
  assert.equal(calls[0]![1][0], 0x00);
  assert.equal(calls[0]![1].readUInt16LE(1), 0xd000);
  assert.equal(calls[0]![1].readUInt16LE(3), 0xd02e);
});

test("handleViciiGetState: any argument at all is refused naming the key, zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(FIXTURE));
  const result = await handleViciiGetState({ cia: 1 }, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /cia/);
  assert.match(result.content[0]!.text, /takes no arguments/);
  assert.equal(calls.length, 0);
});

test("handleViciiGetState: an empty object is accepted (no arguments at all)", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(FIXTURE));
  const result = await handleViciiGetState({}, session, DEPS);
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
});

test("handleViciiGetState: non-object args are refused with zero sends", async () => {
  const { session, calls } = makeSession(() => memoryGetReply(FIXTURE));
  const result = await handleViciiGetState(null as unknown as Record<string, unknown>, session, DEPS);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("handleViciiGetState: a reply of the wrong type is refused naming memory_get", async () => {
  const { session } = makeSession(() => ({ type: "registers_get" as const, requestId: 1, errorCode: ErrorCode.Ok, related: [] }));
  const result = await handleViciiGetState({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /memory_get/);
});

test("handleViciiGetState: a 46-byte reply is refused, naming both 47 and 46", async () => {
  const { session } = makeSession(() => memoryGetReply(FIXTURE.slice(0, 46)));
  const result = await handleViciiGetState({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /a short read is a wrong answer/);
  assert.match(result.content[0]!.text, /47/);
  assert.match(result.content[0]!.text, /46/);
});

test("handleViciiGetState: a send() rejection is converted, not thrown", async () => {
  const { session } = makeSession(() => {
    throw new Error("boom");
  });
  const result = await handleViciiGetState({}, session, DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /vice_vicii_get_state/);
});

test("handleViciiGetState: successful answer carries runState and base/end/length", async () => {
  const { session } = makeSession(() => memoryGetReply(FIXTURE));
  const result = await handleViciiGetState({}, session, DEPS);
  const answer = parseAnswer(result);
  assert.equal(typeof answer.runState, "string");
  assert.equal(answer.base, 0xd000);
  assert.equal(answer.end, 0xd02e);
  assert.equal(answer.length, 47);
});
