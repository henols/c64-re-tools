// node:test coverage of stock-input.ts's keyboard and joystick handlers.
// DI-stub convention (stock-dispatch.test.ts's own idiom): a fake session
// whose client.send() is a spy recording [commandType, body] -- never a
// real socket. beforeEach() resets the runState trackers so stockAnswer()'s
// runState projection starts clean for every test, matching
// resetRunStateTrackersForTest()'s own documented role.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { handleKeyboardType, handleKeyboardPetscii, handleJoystickSet, JOYPORT_BITS } from "./stock-input.ts";
import { CommandType } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession } from "./stock-connect.ts";

interface RecordedSend {
  commandType: number;
  body: Buffer;
}

/** Builds a fake StockConnectSession whose client.send() is a counting/
 * recording spy -- never a real socket. Matches stock-dispatch.test.ts's own
 * "two-method stub object cast via `as unknown as <RealType>`" convention. */
function createFakeSession(): { session: StockConnectSession; sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  const fakeClient = {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      sends.push({ commandType, body });
      return { type: "ok" };
    },
    on: () => {
      // No-op: nothing in this test suite attaches a run-state tracker, so
      // stockAnswer()'s runStateFor() always reads "unknown" here -- the
      // honest, unattached default (D-07).
    },
  };
  const session = { client: fakeClient } as unknown as StockConnectSession;
  return { session, sends };
}

beforeEach(() => {
  resetRunStateTrackersForTest();
});

// ---------------------------------------------------------------------------
// handleKeyboardType
// ---------------------------------------------------------------------------

test("handleKeyboardType: 'HELLO' with petscii_upper omitted records byte 0 = 5 and bytes 1-5 = 0xc8 0xc5 0xcc 0xcc 0xcf", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardType({ text: "HELLO" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].commandType, CommandType.KeyboardFeed);
  assert.equal(sends[0].body[0], 5);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0xc8, 0xc5, 0xcc, 0xcc, 0xcf]);
});

test("handleKeyboardType: 'hello' records 0x48 0x45 0x4c 0x4c 0x4f", async () => {
  const { session, sends } = createFakeSession();
  await handleKeyboardType({ text: "hello" }, session, {} as never);
  assert.equal(sends.length, 1);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0x48, 0x45, 0x4c, 0x4c, 0x4f]);
});

test("handleKeyboardType: 'HELLO' with petscii_upper: false records 0x48 0x45 0x4c 0x4c 0x4f", async () => {
  const { session, sends } = createFakeSession();
  await handleKeyboardType({ text: "HELLO", petscii_upper: false }, session, {} as never);
  assert.equal(sends.length, 1);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0x48, 0x45, 0x4c, 0x4c, 0x4f]);
});

test("handleKeyboardType: an embedded PETSCII control code (0x93) at index 1 refuses with the PETSCII error's own message and records zero sends", async () => {
  const { session, sends } = createFakeSession();
  const text = "a" + String.fromCharCode(0x93) + "b";
  const result = await handleKeyboardType({ text }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\b1\b/);
  assert.match(result.content[0].text, /0x93/);
  assert.equal(sends.length, 0);
});

test("handleKeyboardType: an empty string refuses with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardType({ text: "" }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleKeyboardType: a missing/non-string text refuses with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardType({}, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleKeyboardType: the ok-answer carries runState and a petsciiHex field matching the recorded wire bytes", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardType({ text: "hi" }, session, {} as never);
  assert.equal(result.isError, false);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.runState, "unknown");
  assert.equal(payload.petsciiHex, sends[0].body.subarray(1).toString("hex"));
  assert.equal(payload.byteCount, 2);
});

// ---------------------------------------------------------------------------
// handleKeyboardPetscii
// ---------------------------------------------------------------------------

test("handleKeyboardPetscii: data: [0x93] records a body of [0x01, 0x93] (the control-code escape hatch works)", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardPetscii({ data: [0x93] }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].commandType, CommandType.KeyboardFeed);
  assert.deepEqual(Array.from(sends[0].body), [0x01, 0x93]);
});

test("handleKeyboardPetscii: data: [256] refuses naming index 0, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardPetscii({ data: [256] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\b0\b/);
  assert.equal(sends.length, 0);
});

test("handleKeyboardPetscii: data: [] refuses with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardPetscii({ data: [] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleKeyboardPetscii: a 256-element array refuses with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardPetscii({ data: new Array(256).fill(0x41) }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleKeyboardPetscii: the ok-answer carries runState and a petsciiHex field matching the recorded wire bytes", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardPetscii({ data: [0x0d, 0x93] }, session, {} as never);
  assert.equal(result.isError, false);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.runState, "unknown");
  assert.equal(payload.petsciiHex, sends[0].body.subarray(1).toString("hex"));
});

// ---------------------------------------------------------------------------
// handleJoystickSet
// ---------------------------------------------------------------------------

test("handleJoystickSet: direction omitted records a JoyportSet body of length 4 with readUInt16LE(0) === 1 and readUInt16LE(2) === 0", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({}, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].commandType, CommandType.JoyportSet);
  assert.equal(sends[0].body.length, 4);
  assert.equal(sends[0].body.readUInt16LE(0), 1);
  assert.equal(sends[0].body.readUInt16LE(2), 0);
});

test("handleJoystickSet: direction: 'up', fire: true records readUInt16LE(2) === 0x11", async () => {
  const { session, sends } = createFakeSession();
  await handleJoystickSet({ direction: "up", fire: true }, session, {} as never);
  assert.equal(sends[0].body.readUInt16LE(2), 0x11);
});

test("handleJoystickSet: direction: ['up', 'left'] records readUInt16LE(2) === 0x05", async () => {
  const { session, sends } = createFakeSession();
  await handleJoystickSet({ direction: ["up", "left"] }, session, {} as never);
  assert.equal(sends[0].body.readUInt16LE(2), 0x05);
});

test("handleJoystickSet: direction: 'UP' is accepted case-insensitively", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: "UP" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(sends[0].body.readUInt16LE(2), JOYPORT_BITS.up);
});

test("handleJoystickSet: direction: ['up', 'down'] refuses naming both, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["up", "down"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /up/);
  assert.match(result.content[0].text, /down/);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction: ['left', 'right'] refuses naming both, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["left", "right"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction: ['center', 'up'] refuses, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["center", "up"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction: 'diagonal' refuses naming the five accepted values, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: "diagonal" }, session, {} as never);
  assert.equal(result.isError, true);
  for (const word of ["up", "down", "left", "right", "center"]) {
    assert.match(result.content[0].text, new RegExp(word));
  }
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: port: 3 refuses naming 1 and 2, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ port: 3 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\b1\b/);
  assert.match(result.content[0].text, /\b2\b/);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: the answer's valueBits for ['up','left'] with fire: true is exactly ['up','left','fire'] in that order", async () => {
  const { session } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["up", "left"], fire: true }, session, {} as never);
  assert.equal(result.isError, false);
  const payload = JSON.parse(result.content[0].text);
  assert.deepEqual(payload.valueBits, ["up", "left", "fire"]);
  assert.equal(payload.runState, "unknown");
});

test("stock-input.ts exports no handleJoystickTap", () => {
  const source = readFileSync(new URL("./stock-input.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /handleJoystickTap/);
});
