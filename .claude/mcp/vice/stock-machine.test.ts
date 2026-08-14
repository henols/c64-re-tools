// node:test coverage of stock-machine.ts -- Family D's machine-control
// handlers. Every session is a DI stub: `session.client` is an EventEmitter
// (so runStateFor()'s tracker attach point works, though no events are
// fired -- runState stays "unknown", which every test just asserts is
// present) with a `send` spy recording [commandType, body] and a
// caller-supplied canned response per call. isInsideContainer() is stubbed
// false via stock-paths.ts's setIsInsideContainerForTest() so no real mount
// lookup happens -- these tests never touch a real filesystem bind mount.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { handleMachineReset, handleAutostart, handleDiskAttach } from "./stock-machine.ts";
import { CommandType } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { setIsInsideContainerForTest } from "./stock-paths.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { ViceMonitorClient } from "./stock-protocol.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

interface RecordedSend {
  commandType: number;
  body: Buffer;
}

/** Builds a fake session whose `client.send()` is a spy: records every call
 * as [commandType, body] and resolves per `responder(commandType, body)` --
 * `undefined` from the responder resolves to `undefined` (fine for RESET/
 * EXIT/AUTOSTART, whose replies this module never reads). Throwing from
 * `responder` rejects the send() call, exercising the error-conversion path. */
function makeSession(responder?: (commandType: number, body: Buffer) => unknown): { session: StockConnectSession; sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  const emitter = new EventEmitter();
  (emitter as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    sends.push({ commandType, body });
    return responder ? responder(commandType, body) : undefined;
  };
  const client = emitter as unknown as ViceMonitorClient;

  const session = {
    client,
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" },
    host: "127.0.0.1",
    port: 6502,
    targetId: "test-target",
    brokerControl: {} as StockConnectSession["brokerControl"],
    deps: {},
    baselineEpoch: null,
  } as StockConnectSession;

  return { session, sends };
}

const fakeDeps = {} as StockDispatchDeps;

beforeEach(() => {
  resetRunStateTrackersForTest();
  setIsInsideContainerForTest(() => false);
});

afterEach(() => {
  setIsInsideContainerForTest(null);
});

// --------------------------------------------------------- handleMachineReset

test("handleMachineReset: mode omitted -> Reset body is exactly [0x00] (soft), one send, no Exit", async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({}, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.Reset);
  assert.deepEqual(sends[0]!.body, Buffer.from([0x00]));
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.mode, "soft");
  assert.equal(payload.runAfter, false);
  assert.equal(payload.resumed, false);
  assert.equal(payload.runState, "unknown");
});

test('handleMachineReset: mode "hard" -> Reset body is exactly [0x01]', async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ mode: "hard" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0]!.body, Buffer.from([0x01]));
});

test('handleMachineReset: mode "power" refuses with zero sends', async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ mode: "power" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleMachineReset: run_after omitted -> exactly one send, no CommandType.Exit", async () => {
  const { session, sends } = makeSession();
  await handleMachineReset({}, session, fakeDeps);
  assert.equal(sends.length, 1);
  assert.ok(sends.every((s) => s.commandType !== CommandType.Exit));
});

test("handleMachineReset: run_after: true -> two sends, second is CommandType.Exit with a zero-length body, resumed true", async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ run_after: true }, session, fakeDeps);
  assert.equal(sends.length, 2);
  assert.equal(sends[0]!.commandType, CommandType.Reset);
  assert.equal(sends[1]!.commandType, CommandType.Exit);
  assert.equal(sends[1]!.body.length, 0);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.resumed, true);
  assert.equal(payload.runAfter, true);
});

// --------------------------------------------------------- handleAutostart

test('handleAutostart: program: "GAME" refuses with a message containing "index", zero sends', async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({ path: "/workspace/game.d64", program: "GAME" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /index/);
  assert.equal(sends.length, 0);
});

test("handleAutostart: records an AutoStart body with default run/index, and the sent path in the ASCII tail", async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({ path: "/workspace/game.prg" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.AutoStart);
  const body = sends[0]!.body;
  assert.equal(body[0], 0x01); // default run = true
  assert.equal(body.readUInt16LE(1), 0); // default index = 0
  const filenameLen = body[3]!;
  const filename = body.subarray(4, 4 + filenameLen).toString("ascii");
  assert.equal(filename, "/workspace/game.prg");
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.sentPath, "/workspace/game.prg");
  assert.equal(payload.run, true);
  assert.equal(payload.index, 0);
});

test("handleAutostart: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({}, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

// --------------------------------------------------------- handleDiskAttach

test("handleDiskAttach: unit: 9 refuses with a message containing 'no drive-unit field', zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 9, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /no drive-unit field/);
  assert.equal(sends.length, 0);
});

test("handleDiskAttach: unit: 12 refuses naming the 8..11 range", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 12, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /8\.\.11/);
  assert.equal(sends.length, 0);
});

test("handleDiskAttach: unit: 8 records an AutoStart body whose byte 0 is 0x00 (run flag clear)", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 8, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.AutoStart);
  assert.equal(sends[0]!.body[0], 0x00);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.unit, 8);
  assert.equal(payload.approximation, "AUTOSTART with the run flag clear (D-14)");
});

test("handleDiskAttach: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 8 }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

// --------------------------------------------------------- runState on every ok answer

test("every ok-answer from this module carries runState", async () => {
  const { session: s1 } = makeSession();
  const r1 = await handleMachineReset({}, s1, fakeDeps);
  assert.ok("runState" in JSON.parse(r1.content[0]!.text));

  const { session: s2 } = makeSession();
  const r2 = await handleAutostart({ path: "/workspace/x.prg" }, s2, fakeDeps);
  assert.ok("runState" in JSON.parse(r2.content[0]!.text));

  const { session: s3 } = makeSession();
  const r3 = await handleDiskAttach({ unit: 8, path: "/workspace/x.d64" }, s3, fakeDeps);
  assert.ok("runState" in JSON.parse(r3.content[0]!.text));
});
