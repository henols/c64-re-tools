// node:test coverage of stock-execution.ts -- Family C (pause/run/step/
// until-return). Every "client" below is a real EventEmitter with a
// hand-attached `send` spy, cast `as unknown as ViceMonitorClient`, matching
// this codebase's own dependency-injection mocking convention
// (stock-runstate.test.ts / stock-handler.test.ts) -- never a real socket.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  handleExecutionPause,
  handleExecutionRun,
  handleExecutionStep,
  handleExecutionUntilReturn,
} from "./stock-execution.ts";
import { attachRunStateTracker, resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { CommandType, type ResolvedResponse, type ViceMonitorClient } from "./stock-protocol.ts";
import type { StockConnectSession } from "./stock-connect.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

beforeEach(() => {
  resetRunStateTrackersForTest();
});

interface SendCall {
  commandType: number;
  body: Buffer;
}

/** Builds a fake client (a real EventEmitter, so attachRunStateTracker()'s
 * 'event' listener works unchanged) with a `send` spy that records every
 * call and resolves with a synthetic "unknown"-shaped ResolvedResponse
 * (matching what AdvanceInstructions/ExecuteUntilReturn/Ping/Exit actually
 * parse to today), unless `sendImpl` overrides the resolution/rejection. */
function fakeClient(sendImpl?: (commandType: number, body: Buffer) => Promise<ResolvedResponse>): {
  client: ViceMonitorClient;
  calls: SendCall[];
} {
  const emitter = new EventEmitter();
  const calls: SendCall[] = [];
  (emitter as unknown as { send: ViceMonitorClient["send"] }).send = (async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    calls.push({ commandType, body });
    if (sendImpl) {
      return sendImpl(commandType, body);
    }
    return { type: "unknown", requestId: 1, errorCode: 0, responseType: commandType, related: [] } as unknown as ResolvedResponse;
  }) as ViceMonitorClient["send"];
  return { client: emitter as unknown as ViceMonitorClient, calls };
}

function fakeSession(client: ViceMonitorClient): StockConnectSession {
  return { client } as unknown as StockConnectSession;
}

const NO_DEPS = {} as unknown as StockDispatchDeps;

function payloadOf(result: { content: { type: "text"; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

// --------------------------------------------------------- handleExecutionPause

test("pause: short-circuits (zero sends) when the derived state is already \"stopped\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 0, "no send() call must be made when already stopped");
  assert.equal(result.isError, false);
  const payload = payloadOf(result);
  assert.equal(payload.sent, false);
  assert.equal(payload.alreadyStopped, true);
});

test("pause: sends PING with a zero-length body when the derived state is \"running\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.commandType, CommandType.Ping);
  assert.equal(calls[0]!.body.length, 0);
  const payload = payloadOf(result);
  assert.equal(payload.sent, true);
  assert.equal(payload.alreadyStopped, false);
});

test("pause: DOES send while the derived state is \"unknown\" -- nothing to short-circuit against", async () => {
  const { client, calls } = fakeClient();
  const result = await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1, "unknown must not be treated as \"already stopped\"");
  assert.equal(calls[0]!.commandType, CommandType.Ping);
  assert.equal(result.isError, false);
});

test("pause: two calls with a \"stopped\" event emitted between them produce exactly one send in total", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  await handleExecutionPause({}, fakeSession(client), NO_DEPS);

  assert.equal(calls.length, 1, "a retry after the machine is confirmed stopped must be a total no-op");
});

test("pause: an unexpected argument is refused, naming the key", async () => {
  const { client } = fakeClient();
  const result = await handleExecutionPause({ bogus: 1 }, fakeSession(client), NO_DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /bogus/);
});

// --------------------------------------------------------- handleExecutionRun

test("run: short-circuits (zero sends) when the derived state is already \"running\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionRun({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 0, "no send() call must be made when already running");
  const payload = payloadOf(result);
  assert.equal(payload.sent, false);
  assert.equal(payload.alreadyRunning, true);
});

test("run: sends EXIT with a zero-length body when the derived state is \"stopped\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionRun({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.commandType, CommandType.Exit);
  assert.equal(calls[0]!.body.length, 0);
  const payload = payloadOf(result);
  assert.equal(payload.sent, true);
  assert.equal(payload.alreadyRunning, false);
});

test("run: DOES send while the derived state is \"unknown\"", async () => {
  const { client, calls } = fakeClient();
  const result = await handleExecutionRun({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.commandType, CommandType.Exit);
  assert.equal(result.isError, false);
});

test("run: two calls with a \"resumed\" event emitted between them produce exactly one send in total", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  await handleExecutionRun({}, fakeSession(client), NO_DEPS);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  await handleExecutionRun({}, fakeSession(client), NO_DEPS);

  assert.equal(calls.length, 1, "a retry after the machine is confirmed running must be a total no-op");
});

// --------------------------------------------------------- shared: runState + wire errors

test("every ok-answer's parsed JSON carries a runState key", async () => {
  const { client } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const pauseResult = await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  assert.ok("runState" in payloadOf(pauseResult));

  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  const runResult = await handleExecutionRun({}, fakeSession(client), NO_DEPS);
  assert.ok("runState" in payloadOf(runResult));

  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  const stepResult = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  assert.ok("runState" in payloadOf(stepResult));

  const untilReturnResult = await handleExecutionUntilReturn({}, fakeSession(client), NO_DEPS);
  assert.ok("runState" in payloadOf(untilReturnResult));
});

test("a send() rejection produces isError: true text that does not mention wedge", async () => {
  const { client } = fakeClient(async () => {
    throw new Error("socket exploded");
  });
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionPause({}, fakeSession(client), NO_DEPS);
  assert.equal(result.isError, true);
  assert.doesNotMatch(result.content[0]!.text.toLowerCase(), /wedge/);
});

// --------------------------------------------------------- handleExecutionStep

test("step: refuses while the derived state is \"unknown\", recording zero sends", async () => {
  const { client, calls } = fakeClient();
  const result = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /unknown/);
});

test("untilReturn: refuses while the derived state is \"unknown\", recording zero sends", async () => {
  const { client, calls } = fakeClient();
  const result = await handleExecutionUntilReturn({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /unknown/);
});

test("step: the unknown-state refusal names that memory/register/checkpoint tools are not gated", async () => {
  const { client } = fakeClient();
  const result = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  assert.match(result.content[0]!.text, /memory/);
  assert.match(result.content[0]!.text, /register/);
  assert.match(result.content[0]!.text, /checkpoint/);
});

test("step: with default arguments encodes ADVANCE_INSTRUCTIONS body length 3, stepOver=0x00, count=1", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.commandType, CommandType.AdvanceInstructions);
  const body = calls[0]!.body;
  assert.equal(body.length, 3);
  assert.equal(body[0], 0x00);
  assert.equal(body.readUInt16LE(1), 1);
  assert.equal(result.isError, false);
});

test("step: count=5, stepOver=true encodes stepOver=0x01, count=5", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  await handleExecutionStep({ count: 5, stepOver: true }, fakeSession(client), NO_DEPS);
  const body = calls[0]!.body;
  assert.equal(body[0], 0x01);
  assert.equal(body.readUInt16LE(1), 5);
});

test("step: count=0 refuses, recording zero sends", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionStep({ count: 0 }, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 0);
  assert.equal(result.isError, true);
});

test("step: DOES send while the derived state is \"running\" -- the gate is on \"unknown\" only", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(result.isError, false);
});

test("step: an unexpected argument is refused, naming the key", async () => {
  const { client } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  const result = await handleExecutionStep({ bogus: 1 }, fakeSession(client), NO_DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /bogus/);
});

test("step: reports programCounter when a settled \"stopped\" event exposes one", async () => {
  const { client } = fakeClient(async (commandType, _body) => {
    // Simulate the wire delivering a STOPPED event during the round trip
    // (as a real VICE step reply's side effect), then resolve the reply
    // itself (which today carries no programCounter of its own).
    client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0xc000 });
    return { type: "unknown", requestId: 1, errorCode: 0, responseType: commandType, related: [] } as unknown as ResolvedResponse;
  });
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionStep({}, fakeSession(client), NO_DEPS);
  const payload = payloadOf(result);
  assert.equal(payload.programCounter, 0xc000);
});

// --------------------------------------------------------- handleExecutionUntilReturn

test("untilReturn: sends EXECUTE_UNTIL_RETURN with a zero-length body when the derived state is \"stopped\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionUntilReturn({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.commandType, CommandType.ExecuteUntilReturn);
  assert.equal(calls[0]!.body.length, 0);
  assert.equal(result.isError, false);
});

test("untilReturn: DOES send while the derived state is \"running\"", async () => {
  const { client, calls } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "resumed", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });

  const result = await handleExecutionUntilReturn({}, fakeSession(client), NO_DEPS);
  assert.equal(calls.length, 1);
  assert.equal(result.isError, false);
});

test("untilReturn: an unexpected argument is refused, naming the key", async () => {
  const { client } = fakeClient();
  attachRunStateTracker(client);
  client.emit("event", { type: "stopped", requestId: 0xffffffff, errorCode: 0, programCounter: 0x1000 });
  const result = await handleExecutionUntilReturn({ bogus: 1 }, fakeSession(client), NO_DEPS);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /bogus/);
});
