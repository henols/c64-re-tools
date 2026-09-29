// node:test coverage of stock-input.ts's keyboard and joystick handlers.
// DI-stub convention (stock-session.test.ts's own idiom): a fake session
// whose client.send() is a spy recording [commandType, body] -- never a
// real socket. beforeEach() resets the runState trackers so stockAnswer()'s
// runState projection starts clean for every test, matching
// resetRunStateTrackersForTest()'s own documented role.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { handleKeyboardType, handleKeyboardPetscii, handleJoystickSet, JOYPORT_BITS, resetJoyportDevicesForTest } from "../../src/mcp/vice/stock-input.ts";
import { CommandType, JOYPORT_DEVICE_IO_SIMULATION } from "../../src/mcp/vice/stock-protocol.ts";
import { resetBankCatalogsForTest } from "../../src/mcp/vice/stock-memory.ts";
import { resetRunStateTrackersForTest } from "../../src/mcp/vice/stock-runstate.ts";
import type { StockConnectSession } from "../../src/mcp/vice/stock-connect.ts";

interface RecordedSend {
  commandType: number;
  body: Buffer;
}

/** Builds a fake StockConnectSession whose client.send() is a counting/
 * recording spy -- never a real socket. Matches stock-session.test.ts's own
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

test("handleKeyboardType: 'HELLO' with petscii_upper omitted sends a 5-byte feed of unshifted letters 0x48 0x45 0x4c 0x4c 0x4f", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleKeyboardType({ text: "HELLO" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].commandType, CommandType.KeyboardFeed);
  assert.equal(sends[0].body[0], 5);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0x48, 0x45, 0x4c, 0x4c, 0x4f]);
});

test("handleKeyboardType: 'hello' records 0x48 0x45 0x4c 0x4c 0x4f", async () => {
  const { session, sends } = createFakeSession();
  await handleKeyboardType({ text: "hello" }, session, {} as never);
  assert.equal(sends.length, 1);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0x48, 0x45, 0x4c, 0x4c, 0x4f]);
});

test("handleKeyboardType: 'hello' with petscii_upper: false sends the raw bytes 0x68 0x65 0x6c 0x6c 0x6f", async () => {
  const { session, sends } = createFakeSession();
  await handleKeyboardType({ text: "hello", petscii_upper: false }, session, {} as never);
  assert.equal(sends.length, 1);
  assert.deepEqual(Array.from(sends[0].body.subarray(1)), [0x68, 0x65, 0x6c, 0x6c, 0x6f]);
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

const IO_SIM = JOYPORT_DEVICE_IO_SIMULATION;

/** A fake binary monitor that models the joyport devices the way stock VICE
 * does: JOYPORT_SET only reaches the CIA while the port's device is the I/O
 * simulation device, which reads back `lines & 0x1f` (bits 5-7 low). */
function createJoyportFake(options: { refuseDevice?: boolean } = {}) {
  const devices: Record<number, number> = { 1: 1, 2: 1 };
  const lines: Record<number, number> = { 0: 0, 1: 0 };
  const sends: RecordedSend[] = [];
  const fakeClient = {
    send: async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
      sends.push({ commandType, body });
      switch (commandType) {
        case CommandType.BanksAvailable:
          return { type: "banks_available", banks: [{ id: 0, name: "default" }, { id: 4, name: "io" }] };
        case CommandType.ResourceGet: {
          const port = Number(body.subarray(1).toString("ascii").match(/JoyPort(\d)Device/)![1]);
          return { type: "resource_get", valueType: "integer", value: devices[port] };
        }
        case CommandType.ResourceSet: {
          const nameLength = body[1];
          const port = Number(body.subarray(2, 2 + nameLength).toString("ascii").match(/JoyPort(\d)Device/)![1]);
          if (!options.refuseDevice) devices[port] = body.readUInt32LE(3 + nameLength);
          return { type: "unknown", errorCode: 0 };
        }
        case CommandType.JoyportSet:
          lines[body.readUInt16LE(0)] = body.readUInt16LE(2) & 0x1f;
          return { type: "unknown", errorCode: 0 };
        case CommandType.MemoryGet: {
          const address = body.readUInt16LE(1);
          const port = address === 0xdc01 ? 1 : 2;
          const value = devices[port] === IO_SIM ? lines[port - 1] : address === 0xdc00 ? 0x7f : 0xff;
          return { type: "memory_get", bytes: Uint8Array.of(value) };
        }
        default:
          return { type: "unknown", errorCode: 0 };
      }
    },
    on: () => {},
  };
  const session = { client: fakeClient, targetId: "fake-target" } as unknown as StockConnectSession;
  return { session, sends, devices };
}

function joyportSends(sends: RecordedSend[]) {
  return sends.filter((send) => send.commandType === CommandType.JoyportSet).map((send) => ({ port: send.body.readUInt16LE(0), value: send.body.readUInt16LE(2) }));
}

beforeEach(() => {
  resetJoyportDevicesForTest();
  resetBankCatalogsForTest();
});

test("handleJoystickSet: holding up on port 2 attaches the I/O simulation device and clears bit 0 of $DC00", async () => {
  const { session, sends, devices } = createJoyportFake();
  const result = await handleJoystickSet({ port: 2, direction: "up" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(devices[2], IO_SIM);
  assert.deepEqual(joyportSends(sends), [{ port: 1, value: 0x1e }]);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.ciaRegister, "$DC00");
  assert.equal(payload.ciaValue & 0x01, 0);
  assert.equal(payload.device, "io-simulation");
});

test("handleJoystickSet: port 1 drives VICE joyport 0 and reads back through $DC01", async () => {
  const { session, sends } = createJoyportFake();
  const result = await handleJoystickSet({ port: 1, direction: ["up", "left"], fire: true }, session, {} as never);
  assert.equal(result.isError, false);
  assert.deepEqual(joyportSends(sends), [{ port: 0, value: 0x0a }]);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.ciaRegister, "$DC01");
  assert.equal(payload.ciaValue, 0x0a);
  assert.deepEqual(payload.valueBits, ["up", "left", "fire"]);
  assert.equal(payload.value, 0x15);
  assert.equal(payload.lines, 0x0a);
  assert.equal(payload.runState, "unknown");
});

test("handleJoystickSet: port defaults to control port 1", async () => {
  const { session, sends } = createJoyportFake();
  await handleJoystickSet({ direction: "down" }, session, {} as never);
  assert.deepEqual(joyportSends(sends), [{ port: 0, value: 0x1d }]);
});

test("handleJoystickSet: a release after a hold idles the lines and puts back the port's joystick device", async () => {
  const { session, sends, devices } = createJoyportFake();
  await handleJoystickSet({ port: 2, direction: "right" }, session, {} as never);
  const result = await handleJoystickSet({ port: 2, direction: "center" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.equal(devices[2], 1);
  assert.deepEqual(joyportSends(sends), [{ port: 1, value: 0x17 }, { port: 1, value: 0x1f }]);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.device, "restored");
  assert.equal(payload.ciaValue, 0x7f);
});

test("handleJoystickSet: a release with nothing held sends no joyport command and changes no device", async () => {
  const { session, sends, devices } = createJoyportFake();
  const result = await handleJoystickSet({}, session, {} as never);
  assert.equal(result.isError, false);
  assert.deepEqual(joyportSends(sends), []);
  assert.equal(sends.some((send) => send.commandType === CommandType.ResourceSet), false);
  assert.equal(devices[1], 1);
  assert.equal(JSON.parse(result.content[0].text).device, "unchanged");
});

test("handleJoystickSet: refuses by name when VICE does not keep the I/O simulation device, and sends no joyport command", async () => {
  const { session, sends } = createJoyportFake({ refuseDevice: true });
  const result = await handleJoystickSet({ port: 2, direction: "up" }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /^vice_joystick_set: /);
  assert.match(result.content[0].text, /vice_keyboard_type/);
  assert.deepEqual(joyportSends(sends), []);
});

test("handleJoystickSet: direction 'UP' is accepted case-insensitively", async () => {
  const { session, sends } = createJoyportFake();
  const result = await handleJoystickSet({ direction: "UP" }, session, {} as never);
  assert.equal(result.isError, false);
  assert.deepEqual(joyportSends(sends), [{ port: 0, value: 0x1f & ~JOYPORT_BITS.up }]);
});

test("handleJoystickSet: direction ['up', 'down'] refuses naming both, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["up", "down"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /up/);
  assert.match(result.content[0].text, /down/);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction ['left', 'right'] refuses, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["left", "right"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction ['center', 'up'] refuses, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: ["center", "up"] }, session, {} as never);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: direction 'diagonal' refuses naming the five accepted values, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ direction: "diagonal" }, session, {} as never);
  assert.equal(result.isError, true);
  for (const word of ["up", "down", "left", "right", "center"]) {
    assert.match(result.content[0].text, new RegExp(word));
  }
  assert.equal(sends.length, 0);
});

test("handleJoystickSet: port 3 refuses naming 1 and 2, with zero sends", async () => {
  const { session, sends } = createFakeSession();
  const result = await handleJoystickSet({ port: 3 }, session, {} as never);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /\b1\b/);
  assert.match(result.content[0].text, /\b2\b/);
  assert.equal(sends.length, 0);
});
